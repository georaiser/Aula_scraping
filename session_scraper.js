import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import { autoLogin, saveSession } from './auth.js';

const CONFIG = {
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
};

// Helper: Sanitize text for filename
function sanitizeFilename(text) {
    return text
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
}

// Helper: Get playback link from row
function extractPlaybackLink(linkElement) {
    if (!linkElement) return null;
    
    const dataHref = linkElement.getAttribute('data-href');
    const href = linkElement.getAttribute('href');
    const link = dataHref || (href !== '#' ? href : null);
    
    return link?.startsWith('http') ? link : `https://auladigital.sence.cl${link}`;
}

// Scrape recordings from page
async function scrapeRecordings(page) {
    return await page.evaluate(() => {
        const rows = document.querySelectorAll('#bigbluebuttonbn_recordings_table tbody tr, .generaltable tbody tr');
        const results = [];
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;
            
            const linkElement = row.querySelector('a.btn');
            if (!linkElement) return;
            
            // Get the recording name from column 1 (c1)
            const nameText = cells[1]?.textContent?.trim() || 'Recording';
            
            // Get the date from column 4 (c4)
            const dateText = cells[4]?.textContent?.trim() || '';
            
            // Combine: "Mon, 5 Jan 2026, 5:50 PM -03 - 💻Aula virtual en vivo Módulo 2"
            const fullName = dateText ? `${dateText} - ${nameText}` : nameText;
            
            // Extract the actual playback URL from data-href or href parameter
            const dataHref = linkElement.getAttribute('data-href');
            const href = linkElement.getAttribute('href');
            let playbackUrl = dataHref || href;
            
            // If URL contains href parameter, extract the actual playback URL
            if (playbackUrl && playbackUrl.includes('href=')) {
                try {
                    const urlParams = new URLSearchParams(playbackUrl.split('?')[1]);
                    const hrefParam = urlParams.get('href');
                    if (hrefParam) {
                        playbackUrl = decodeURIComponent(hrefParam);
                    }
                } catch (e) {
                    // Keep original URL if parsing fails
                }
            }
            
            if (playbackUrl && playbackUrl !== '#') {
                // Ensure absolute URL
                if (!playbackUrl.startsWith('http')) {
                    playbackUrl = `https://auladigital.sence.cl${playbackUrl}`;
                }
                
                results.push({
                    name: fullName,
                    type: "Presentation",
                    playback_link: playbackUrl
                });
            }
        });
        
        return results;
    });
}

// Scrape a single session
async function scrapeSession(browser, url, outputFilename) {
    console.log(`\nProcessing: ${url}`);
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        if (!await autoLogin(page)) {
            console.log("   ⚠ Login may have failed");
        }

        await new Promise(r => setTimeout(r, 5000));
        
        // Re-navigate if redirected
        if (page.url() !== url) {
            console.log(`   Redirected, forcing navigation...`);
            await page.goto(url, { waitUntil: 'load' });
        }

        const recordings = await scrapeRecordings(page);
        console.log(`   ✓ Found ${recordings.length} recordings`);

        if (recordings.length === 0 && process.argv.includes('--debug')) {
            await page.screenshot({ path: `debug_${outputFilename}.png`, fullPage: true });
        }

        // Create output directory if BBB_FILTER is set
        const filter = process.env.BBB_FILTER;
        let outputPath = outputFilename;
        
        if (filter) {
            const safeName = sanitizeFilename(filter);
            const outputDir = `scraped_data/${safeName}`;
            await fs.ensureDir(outputDir);
            outputPath = `${outputDir}/${outputFilename}`;
        }

        await fs.writeJson(outputPath, { bbb_session: { recordings } }, { spaces: 4 });
        console.log(`   ✓ Saved to ${outputPath}`);

    } catch (e) {
        console.error(`   ✗ Error: ${e.message}`);
    } finally {
        await page.close();
    }
}

// Load and filter modules
async function loadTasks(filter) {
    if (!fs.existsSync('bbb_modules.json')) {
        console.error("Error: bbb_modules.json not found. Run 'node home_scraper.js' first.");
        process.exit(1);
    }
    
    const { modules = [] } = await fs.readJson('bbb_modules.json');
    
    // Filter and deduplicate
    const filtered = modules.filter(m => m.text.toLowerCase().includes(filter.toLowerCase()));
    const unique = filtered.filter((m, i, arr) => arr.findIndex(x => x.link === m.link) === i);
    
    if (unique.length === 0) {
        console.error(`No modules matched filter: ${filter}`);
        process.exit(0);
    }
    
    console.log(`Found ${unique.length} unique modules`);
    
    return unique.map((m, i) => {
        // Extract module name: "💻Aula virtual en vivo Módulo 2\nBigBlueButton" -> "modulo_2"
        const moduleMatch = m.text.match(/módulo\s+\d+/i);
        const simpleName = moduleMatch ? sanitizeFilename(moduleMatch[0]) : `module_${i + 1}`;
        
        return {
            url: m.link,
            name: `session_${simpleName}.json`
        };
    });
}

async function main() {
    console.log("Starting SENCE Session Scraper...\n");

    const argUrl = process.argv[2];
    const filter = process.env.BBB_FILTER;
    
    let tasks;

    if (argUrl?.startsWith('http')) {
        console.log("Mode: Single URL");
        tasks = [{ url: argUrl, name: 'session_data.json' }];
    } else if (filter) {
        console.log(`Mode: Batch Filter ("${filter}")`);
        tasks = await loadTasks(filter);
    } else {
        console.error("Error: No URL or BBB_FILTER provided");
        console.log("\nUsage:");
        console.log("  1. node session_scraper.js <URL>");
        console.log("  2. Set BBB_FILTER in .env and run: node session_scraper.js");
        process.exit(1);
    }

    const browser = await puppeteer.launch(CONFIG);
    
    try {
        for (const task of tasks) {
            await scrapeSession(browser, task.url, task.name);
        }
    } finally {
        console.log("\n✓ Closing browser...");
        await browser.close();
    }
}

main();
