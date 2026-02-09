
import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import { autoLogin, saveSession } from './auth.js';

// Configuration
const CONFIG = {
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
};

/**
 * Scrapes a single BBB session.
 * @param {puppeteer.Browser} browser - The Puppeteer browser instance.
 * @param {string} url - The URL of the BBB session.
 * @param {string} outputFilename - The filename to save the JSON data.
 */
async function scrapeSession(browser, url, outputFilename) {
    console.log(`\nProcessing Session: ${url}`);
    const page = await browser.newPage();
    
    try {
        console.log("1. Navigating...");
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Auto-login (idempotent - checks if already logged in)
        const loggedIn = await autoLogin(page);
        if (!loggedIn) {
            console.log("   WARNING: Login might have failed or manual intervention needed.");
        }

        // Wait for potential redirects
        await new Promise(r => setTimeout(r, 5000));
        
        // Ensure we are at the target (re-navigate if redirected to dashboard/home)
        if (page.url() !== url) {
             console.log(`   Redirected to ${page.url()}. Forcing navigation to ${url}...`);
             await page.goto(url, { waitUntil: 'load' });
        }

        // Attempt to find the recordings table
        try {
            await page.waitForSelector('#bigbluebuttonbn_recordings_table, .generaltable', { timeout: 10000 });
        } catch (e) {
            console.log("   Table not found immediately. Checking DOM...");
        }

        // Scrape
        console.log("2. Scraping recordings...");
        const recordings = await page.evaluate(() => {
            let rows = document.querySelectorAll('#bigbluebuttonbn_recordings_table tbody tr');
            if (rows.length === 0) rows = document.querySelectorAll('.generaltable tbody tr');
            
            const results = [];
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 5) return;
                
                const linkElement = row.querySelector('a.btn');
                let playbackLink = linkElement ? linkElement.getAttribute('data-href') : null;
                
                if (!playbackLink && linkElement) {
                    const href = linkElement.getAttribute('href');
                    if (href && href !== '#') playbackLink = href;
                }
                
                if (playbackLink) {
                    results.push({
                        name: row.innerText.split('\n')[0].trim(),
                        type: "Presentation",
                        playback_link: playbackLink.startsWith('http') ? playbackLink : `https://auladigital.sence.cl${playbackLink}`
                    });
                }
            });
            return results;
        });

        console.log(`   -> Extracted ${recordings.length} recordings.`);

        // Handle verification debug (optional)
        if (recordings.length === 0 && process.argv.includes('--debug')) {
            await page.screenshot({ path: `debug_${outputFilename}.png`, fullPage: true });
        }

        // Save Data
        const outputData = { bbb_session: { recordings: recordings } };
        await fs.writeJson(outputFilename, outputData, { spaces: 4 });
        console.log(`   -> Saved to ${outputFilename}`);

    } catch (e) {
        console.error(`   Error processing ${url}:`, e.message);
    } finally {
        await page.close();
    }
}

async function main() {
    console.log("Starting SENCE Session Scraper...");

    // Determine Work Mode
    const argUrl = process.argv[2];
    const filter = process.env.BBB_FILTER;
    
    let tasks = [];

    if (argUrl && argUrl.startsWith('http')) {
        // MODE A: Single URL from Arg
        console.log("Mode: Single URL (Argument)");
        tasks.push({ url: argUrl, name: 'session_data.json' });
    } else if (filter) {
        // MODE B: Filter from ENV
        console.log(`Mode: Batch Filter ("${filter}")`);
        
        if (!fs.existsSync('bbb_modules.json')) {
            console.error("Error: bbb_modules.json not found. Run 'node home_scraper.js' first.");
            process.exit(1);
        }
        
        const data = await fs.readJson('bbb_modules.json');
        let modules = (data.modules || []).filter(m => m.text.toLowerCase().includes(filter.toLowerCase()));
        
        if (modules.length === 0) {
            console.error(`No modules matched filter: ${filter}`);
            process.exit(0);
        }
        
        // Deduplicate by Link
        const uniqueModules = [];
        const seenLinks = new Set();
        for (const m of modules) {
            if (!seenLinks.has(m.link)) {
                seenLinks.add(m.link);
                uniqueModules.push(m);
            }
        }
        modules = uniqueModules;
        
        console.log(`Found ${modules.length} matching modules (unique).`);
        
        tasks = modules.map((m, i) => ({
            url: m.link,
            name: `session_data_${i+1}_${m.text.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
        }));
    } else {
        console.error("Error: No URL provided (arg) and no BBB_FILTER (env).");
        console.log("Usage:");
        console.log("  1. node session_scraper.js <URL>");
        console.log("  2. Set BBB_FILTER in .env and run: node session_scraper.js");
        process.exit(1);
    }

    // Execution
    const browser = await puppeteer.launch(CONFIG);
    
    try {
        for (const task of tasks) {
            await scrapeSession(browser, task.url, task.name);
        }
    } finally {
        console.log("\nClosing browser...");
        await browser.close();
    }
}

main();
