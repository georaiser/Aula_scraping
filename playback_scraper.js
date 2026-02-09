import 'dotenv/config'; // Load .env
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import readline from 'readline';

import { autoLogin } from './auth.js';

async function scrapePlayback() {
  console.log("Starting SENCE Playback Scraper (JS)...");

  // 1. Load Session Data (find all session_data_*.json files)
  try {
    const files = await fs.readdir('.');
    // Match session_data.json OR session_data_*.json
    const sessionFiles = files.filter(f => f.startsWith('session_data') && f.endsWith('.json'));
    
    if (sessionFiles.length === 0) {
        console.log("No session_data*.json files found.");
        return;
    }

    console.log(`Found ${sessionFiles.length} session data files to process:`, sessionFiles);

    let allRecordings = [];

    for (const file of sessionFiles) {
        try {
            const data = await fs.readJson(file);
            const recs = data.bbb_session.recordings || [];
            console.log(` - ${file}: ${recs.length} recordings`);
            allRecordings = allRecordings.concat(recs);
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }
    
    // De-duplicate recordings by playback_link
    const uniqueRecordings = [];
    const seenLinks = new Set();
    
    for (const r of allRecordings) {
        if (!seenLinks.has(r.playback_link)) {
            seenLinks.add(r.playback_link);
            uniqueRecordings.push(r);
        }
    }
    
    const recordings = uniqueRecordings;
    
    if (recordings.length === 0) {
        console.log("No recordings found in session files.");
        return;
    }
    
    console.log(`Total unique recordings to process: ${recordings.length}`);
    
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
    if (process.argv.includes('--debug')) {
        await page.screenshot({ path: 'debug_playback_error.png', fullPage: true });
        console.log("Saved debug_playback_error.png");
    }
  }
}

scrapePlayback();
