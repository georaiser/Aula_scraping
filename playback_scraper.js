import 'dotenv/config'; // Load .env
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import readline from 'readline';

// --- Auto-Login Helper (Same as session_scraper) ---
async function autoLogin(page) {
    const run = process.env.RUN;
    const password = process.env.PASSWORD;

    if (!run || !password) return false;

    console.log("Attempting usage of credentials from .env...");
    
    try {
        // STEP 1: Check if we are on SENCE Landing (RUT input)
        try {
            // Selectors based on provided screenshot/description
            // "Rut Usuario" placeholder or name
            // User says "input rut, it need an 'enter' to continue with button 'acceder'"
            const rutSelector = 'input[placeholder*="Rut"], input[id*="rut"], input[name*="rut"]';
            await page.waitForSelector(rutSelector, { timeout: 5000 });
            
            console.log("Found SENCE Landing Page. Entering RUT...");
            await page.type(rutSelector, run);
            await page.keyboard.press('Enter'); // User says Enter is needed
            
            // Wait for "ACCEDER" button to be clickable or next step
            // Maybe Enter triggers it, or we need to click it.
            // "ACCEDER" button
            const accederBtn = await page.$('button, input[type="submit"], a.btn');
            // Try to click Acceder if Enter didn't navigate
            
            // Wait a sec for UI update
            await new Promise(r => setTimeout(r, 1000));
            
            // If still on same page, try clicking Acceder button containing text "ACCEDER"
            // Use XPath for text match
            const btns = await page.$x("//button[contains(., 'ACCEDER')] | //a[contains(., 'ACCEDER')]");
            if (btns.length > 0) {
                 console.log("Clicking 'ACCEDER'...");
                 await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    btns[0].click()
                 ]);
            } else {
                 // Maybe Enter caused navigation?
                 console.log("No 'ACCEDER' button found or Enter sufficed. Waiting for nav...");
                 try {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
                 } catch (e) {
                     // check if we are already on ClaveUnica
                 }
            }
            
        } catch (e) {
            console.log("SENCE Landing RUT input not found. Checking if already at ClaveÚnica...");
        }

        // STEP 2: ClaveÚnica Login (If redirected there)
        try {
            console.log("Checking for ClaveÚnica login form...");
            await page.waitForSelector('input[name="run"], input[id="run"]', { timeout: 5000 });
            
            console.log("Filling ClaveÚnica credentials...");
            // Ensure fields are empty or clear them
            await page.$eval('input[name="run"], input[id="run"]', el => el.value = '');
            await page.type('input[name="run"], input[id="run"]', run);
            
            await page.type('input[name="password"], input[id="password"]', password);
            
            const btn = await page.$('button[type="submit"], input[type="submit"], #btn-submit, .btn-primary');
            if (btn) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    btn.click()
                ]);
                console.log("ClaveÚnica Login submitted. Waiting for redirection...");
                return true;
            }
        } catch (e) {
             console.log("ClaveÚnica form not found (or already logged in).");
             // If we are not on login page, verify if we are logged in?
             // Checking if we are back at 'auladigital.sence.cl'
             if (page.url().includes("auladigital.sence.cl")) return true;
        }

    } catch (e) {
        console.error("Auto-login failed:", e.message);
    }
    return false;
}

async function scrapePlayback() {
  console.log("Starting SENCE Playback Scraper (JS)...");

  // 1. Load Session Data
  try {
    const sessionData = await fs.readJson('session_data.json');
    const recordings = sessionData.bbb_session.recordings || [];
    
    if (recordings.length === 0) {
        console.log("No recordings found in session_data.json");
        return;
    }
    
    console.log(`Loaded ${recordings.length} recordings.`);
    
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });

    const page = await browser.newPage();
    
    // 2. Manual Login (Once)
    const firstLink = recordings[0].playback_link;
    console.log(`\nNavigating to first link to trigger login: ${firstLink}`);
    
    await page.goto(firstLink, { waitUntil: 'networkidle2' });
    
    const loggedIn = await autoLogin(page);

    console.log("\n" + "=".repeat(60));
    if (!loggedIn) {
        console.log("IMPORTANT: PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW.");
        console.log("Navigate through the ClaveÚnica process if required.");
    }
    console.log("Wait until you are fully logged in.");
    console.log("=".repeat(60) + "\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      rl.question("Press ENTER here ONLY after you have successfully logged in...", ans => {
        rl.close();
        resolve(ans);
      });
    });

    // 3. Iterate and Scrape
    const enrichedData = [];
    
    for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i];
        console.log(`\n[${i+1}/${recordings.length}] Scraping: ${rec.name.substring(0, 30)}...`);
        
        try {
            // FIX: Ensure complete navigation and wait for stability
            await page.goto(rec.playback_link, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // Wait explicitly for video tags or timeout if they don't appear
            // This ensures the frame is attached and DOM is ready
            try {
                await page.waitForSelector('video, audio, source', { timeout: 10000 });
            } catch (e) {
                console.log("   -> Media tags not found immediately, continuing to check...");
            }
            
            // Extra safety wait
            await new Promise(r => setTimeout(r, 2000));
            
            // Check for potential redirect
            const realUrl = page.url();
            
            // Scrape Details
            const scrapedContent = await page.evaluate(() => {
                const videoTags = Array.from(document.querySelectorAll('video'));
                const audioTags = Array.from(document.querySelectorAll('audio'));
                const sourceTags = Array.from(document.querySelectorAll('source'));
                const svgs = document.querySelectorAll('svg'); 
                
                const videos = [];
                const audios = [];
                
                videoTags.forEach(v => {
                    if (v.src) videos.push(v.src);
                    v.querySelectorAll('source').forEach(s => {
                        if (s.src) videos.push(s.src);
                    });
                });
                
                sourceTags.forEach(s => {
                    if (s.src) {
                        // Check parent logic if needed, or just grab all sources
                        if (s.parentElement && s.parentElement.tagName === 'VIDEO') videos.push(s.src);
                        else if (s.parentElement && s.parentElement.tagName === 'AUDIO') audios.push(s.src);
                        else videos.push(s.src); // Fallback
                    }
                });
                
                return {
                    videos: [...new Set(videos)],
                    audios: [...new Set(audios)],
                    slide_count: svgs.length
                };
            });
            
            if (scrapedContent.videos.length > 0) {
                console.log(`   -> Found ${scrapedContent.videos.length} videos.`);
                enrichedData.push({
                    ...rec,
                    real_playback_url: realUrl,
                    scraped_content: scrapedContent
                });
            } else {
                console.log("   -> No videos found.");
            }
            
        } catch (e) {
            console.error(`   -> Error processing ${rec.name}:`, e.message);
        }
    }
    
    // Save
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = `playback_data_${timestamp}.json`;
    await fs.writeJson(outFile, enrichedData, { spaces: 4 });
    console.log(`\nScrape complete. Data saved to ${outFile}`);
    
    await browser.close();

  } catch (error) {
    console.error("Error in playback scraper:", error);
  }
}

scrapePlayback();
