import 'dotenv/config'; // Load .env
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import readline from 'readline';

async function autoLogin(page) {
    const run = process.env.RUN;
    const password = process.env.PASSWORD;

    if (!run || !password) return false;

    console.log("Attempting usage of credentials from .env...");
    
    try {
        // STEP 1: Check if we are on SENCE Landing (RUT input)
        try {
            const rutSelector = 'input[placeholder*="Rut"], input[id*="rut"], input[name*="rut"]';
            await page.waitForSelector(rutSelector, { timeout: 5000 });
            
            console.log("Found SENCE Landing Page. Entering RUT...");
            await page.type(rutSelector, run);
            await page.keyboard.press('Enter'); 
            
            // "ACCEDER" button logic
            const accederBtn = await page.$('button, input[type="submit"], a.btn');
            await new Promise(r => setTimeout(r, 1000));
            
            const btns = await page.$x("//button[contains(., 'ACCEDER')] | //a[contains(., 'ACCEDER')]");
            if (btns.length > 0) {
                 console.log("Clicking 'ACCEDER'...");
                 await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    btns[0].click()
                 ]);
            } else {
                 console.log("No 'ACCEDER' button found or Enter sufficed. Waiting for nav...");
                 try {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
                 } catch (e) {}
            }
            
        } catch (e) {
            console.log("SENCE Landing RUT input not found. Checking if already at ClaveÚnica...");
        }

        // STEP 2: ClaveÚnica Login
        try {
            console.log("Checking for ClaveÚnica login form...");
            await page.waitForSelector('input[name="run"], input[id="run"]', { timeout: 5000 });
            
            console.log("Filling ClaveÚnica credentials...");
            await page.$eval('input[name="run"], input[id="run"]', el => el.value = ''); // Clear
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
             if (page.url().includes("auladigital.sence.cl")) return true;
        }

    } catch (e) {
        console.error("Auto-login failed:", e.message);
    }
    return false;
}

async function scrapeSession() {
  console.log("Starting SENCE Session Scraper (JS)...");

  // 0. Prompt for URL (or use env/arg)
  const rl0 = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const defaultUrl = process.env.BBB_URL || "https://auladigital.sence.cl/mod/bigbluebuttonbn/view.php?id=748489";
  
  // If provided in env, skip prompt? Or just set default.
  // Let's keep prompt but use env as default.
  
  let targetUrl = defaultUrl;
  
  // Only prompt if not passed as arg and not explicitly "quiet" (optional improvement)
  // For now, keep simple behavior:
  
  if (process.argv[2]) {
      targetUrl = process.argv[2];
      rl0.close();
  } else {
      targetUrl = await new Promise(resolve => {
        rl0.question(`Enter BBB Activity URL (Default: ${defaultUrl}): `, ans => {
            rl0.close();
            resolve(ans.trim() || defaultUrl);
        });
      });
  }

  console.log(`Using URL: ${targetUrl}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    console.log("1. Navigating to Login Page...");
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    // Try Auto-Login
    const loggedIn = await autoLogin(page);

    console.log("\n" + "=".repeat(60));
    if (loggedIn) {
        console.log("Auto-login attempted. Please verify you are logged in.");
    } else {
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

    console.log(`2. Force Navigating to Target BBB Page: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'load' });
    
    // Wait for table
    // Wait for table
    try {
        await page.waitForSelector('#bigbluebuttonbn_recordings_table', { timeout: 10000 });
    } catch (e) {
        console.log("Table '#bigbluebuttonbn_recordings_table' not found immediately. Trying '.generaltable'...");
        try {
            await page.waitForSelector('.generaltable', { timeout: 5000 });
        } catch (e2) {
             console.log("Could not find table selectors. Proceeding to check DOM anyway...");
        }
    }

    // Scrape Recordings
    console.log("3. Scraping Recordings...");
    
    // Evaluate in browser context
    const recordings = await page.evaluate(() => {
        let rows = document.querySelectorAll('#bigbluebuttonbn_recordings_table tbody tr');
        if (rows.length === 0) {
             rows = document.querySelectorAll('.generaltable tbody tr');
        }
        
        const results = [];
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return; // Skip empty/header rows if any
            
            const linkElement = row.querySelector('a.btn');
            // Check for data-href
            let playbackLink = linkElement ? linkElement.getAttribute('data-href') : null;
            
            // Fallback to href if valid and not '#'
            if (!playbackLink && linkElement) {
                const href = linkElement.getAttribute('href');
                if (href && href !== '#') playbackLink = href;
            }
            
            // If still valid
            if (playbackLink) {
                 results.push({
                     name: row.innerText.split('\n')[0].trim(), // Approx name
                     type: "Presentation", // Assuming presentation
                     playback_link: playbackLink.startsWith('http') ? playbackLink : `https://auladigital.sence.cl${playbackLink}`
                 });
            }
        });
        return results;
    });

    console.log(`Extracted ${recordings.length} recordings.`);

    const outputData = {
        bbb_session: {
            recordings: recordings
        }
    };

    const filename = "session_data.json";
    await fs.writeJson(filename, outputData, { spaces: 4 });
    console.log(`Data saved to ${filename}`);

  } catch (error) {
    console.error("Error scraping session:", error);
  } finally {
    console.log("Closing browser...");
    await browser.close();
  }
}

scrapeSession();
