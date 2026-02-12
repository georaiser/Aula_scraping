import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { autoLogin } from './auth.js';

const CONFIG = {
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
};

// Helper: Load all session files and deduplicate recordings
async function loadRecordings() {
    // Determine search directory based on BBB_FILTER
    const filter = process.env.BBB_FILTER;
    let searchDir = '.';
    
    if (filter) {
        const safeName = filter
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase(); // Match session_scraper.js sanitization
        searchDir = `scraped_data/${safeName}`;
        
        if (!await fs.pathExists(searchDir)) {
            console.log(`No session data folder found at ${searchDir}`);
            return [];
        }
    }
    
    const files = await fs.readdir(searchDir);
    const sessionFiles = files.filter(f => f.startsWith('session_') && f.endsWith('.json') && f !== 'session_cookies.json');
    
    if (sessionFiles.length === 0) {
        console.log("No session_data*.json files found");
        return [];
    }

    console.log(`Found ${sessionFiles.length} session files`);
    
    const allRecordings = [];
    for (const file of sessionFiles) {
        try {
            const filePath = path.join(searchDir, file);
            const { bbb_session: { recordings = [] } } = await fs.readJson(filePath);
            console.log(` - ${file}: ${recordings.length} recordings`);
            allRecordings.push(...recordings);
        } catch (e) {
            console.error(`  ✗ Error reading ${file}:`, e.message);
        }
    }
    
    // Deduplicate by playback_link
    const unique = allRecordings.filter((r, i, arr) => 
        arr.findIndex(x => x.playback_link === r.playback_link) === i
    );
    
    console.log(`✓ Total unique recordings: ${unique.length}\n`);
    return unique;
}

// Helper: Extract media sources from page
async function extractMediaSources(page) {
    return await page.evaluate(() => {
        const videos = new Set();
        const audios = new Set();
        
        // Collect from video tags
        document.querySelectorAll('video').forEach(v => {
            if (v.src) videos.add(v.src);
            v.querySelectorAll('source').forEach(s => s.src && videos.add(s.src));
        });
        
        // Collect from audio tags
        document.querySelectorAll('audio').forEach(a => {
            if (a.src) audios.add(a.src);
            a.querySelectorAll('source').forEach(s => s.src && audios.add(s.src));
        });
        
        // Collect orphan sources
        document.querySelectorAll('source').forEach(s => {
            if (!s.src) return;
            const parent = s.parentElement?.tagName;
            if (parent === 'VIDEO') videos.add(s.src);
            else if (parent === 'AUDIO') audios.add(s.src);
            else videos.add(s.src); // Fallback
        });
        
        return {
            videos: [...videos],
            audios: [...audios],
            slide_count: document.querySelectorAll('svg').length
        };
    });
}

// Helper: Load existing playback data to avoid re-scraping
async function loadExistingPlaybackData(searchDir) {
    try {
        if (!await fs.pathExists(searchDir)) return new Map();
        
        const files = await fs.readdir(searchDir);
        const playbackFiles = files.filter(f => f.startsWith('playback_data_') && f.endsWith('.json'));
        
        if (playbackFiles.length === 0) return new Map();
        
        // Sort by time (newest first) to get latest data
        playbackFiles.sort((a, b) => {
            const timeA = fs.statSync(path.join(searchDir, a)).mtime.getTime();
            const timeB = fs.statSync(path.join(searchDir, b)).mtime.getTime();
            return timeB - timeA;
        });
        
        // Load the latest file
        const latestFile = path.join(searchDir, playbackFiles[0]);
        console.log(`Loading existing data from ${playbackFiles[0]}`);
        const data = await fs.readJson(latestFile);
        
        // Map playback_link -> scraped data
        const map = new Map();
        data.forEach(item => {
            if (item.playback_link && item.scraped_content) {
                map.set(item.playback_link, item);
            }
        });
        
        console.log(`✓ Loaded ${map.size} existing recordings`);
        return map;
    } catch (e) {
        console.log(`⚠ Could not load existing data: ${e.message}`);
        return new Map();
    }
}

async function main() {
    console.log("Starting SENCE Playback Scraper...\n");

    try {
        const recordings = await loadRecordings();
        
        if (recordings.length === 0) {
            console.log("No recordings to process");
            return;
        }

        // Determine output directory to check for existing data
        const filter = process.env.BBB_FILTER;
        let outputDir = 'scraped_data';
        if (filter) {
            const safeName = filter
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();
            outputDir = `scraped_data/${safeName}`;
        }

        // Load existing data
        const existingDataMap = await loadExistingPlaybackData(outputDir);
        
        // Identify new recordings
        const newRecordings = recordings.filter(rec => !existingDataMap.has(rec.playback_link));
        console.log(`\nStatus: ${existingDataMap.size} existing, ${newRecordings.length} new\n`);

        const browser = await puppeteer.launch(CONFIG);
        const page = await browser.newPage();
        const enrichedData = [];

        try {
            // Only authenticate if we have new recordings to scrape
            if (newRecordings.length > 0) {
                console.log("Authenticating...");
                // Use the first new recording link for auth, or fallback to first recording
                const authLink = newRecordings[0].playback_link;
                await page.goto(authLink, { waitUntil: 'networkidle2' });
                
                if (!await autoLogin(page)) {
                    console.log("⚠ Auto-login incomplete - session may be required\n");
                }
            }

            // Process all recordings (use existing or scrape new)
            for (let i = 0; i < recordings.length; i++) {
                const rec = recordings[i];
                console.log(`[${i + 1}/${recordings.length}] ${rec.name.substring(0, 40)}...`);
                
                // Check if we already have data
                if (existingDataMap.has(rec.playback_link)) {
                    console.log("  ✓ Using cached data");
                    enrichedData.push(existingDataMap.get(rec.playback_link));
                    continue;
                }

                // Scrape new recording
                try {
                    await page.goto(rec.playback_link, { waitUntil: 'networkidle2', timeout: 60000 });
                    
                    // Wait for media elements
                    try {
                        await page.waitForSelector('video, audio, source', { timeout: 10000 });
                    } catch (e) {
                        console.log("  ⚠ No media tags found");
                    }
                    
                    await new Promise(r => setTimeout(r, 2000)); // Stability wait
                    
                    const scrapedContent = await extractMediaSources(page);
                    
                    if (scrapedContent.videos.length > 0) {
                        console.log(`  ✓ ${scrapedContent.videos.length} video(s) (Scraped)`);
                        enrichedData.push({
                            ...rec,
                            realplayback_url: page.url(),
                            scraped_content: scrapedContent
                        });
                    } else {
                        console.log("  ⚠ No videos found");
                    }
                    
                } catch (e) {
                    console.error(`  ✗ Error: ${e.message}`);
                }
            }
            
            // Save results
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let outFile = `playback_data_${timestamp}.json`;
            
            // Create output directory if BBB_FILTER is set
            if (filter) {
                const safeName = filter
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]/gi, '_')
                    .toLowerCase();
                const outputDir = `scraped_data/${safeName}`;
                await fs.ensureDir(outputDir);
                outFile = `${outputDir}/${outFile}`;
            }
            
            await fs.writeJson(outFile, enrichedData, { spaces: 4 });
            console.log(`\n✓ Saved to ${outFile}`);
            
        } finally {
            await browser.close();
        }

    } catch (error) {
        console.error("✗ Error:", error.message);
        if (process.argv.includes('--debug')) {
            console.log("Debug screenshot saved");
        }
    }
}

main();
