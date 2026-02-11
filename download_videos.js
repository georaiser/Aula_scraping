import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { glob } from 'glob';

// Helper: Sanitize filter name for directory
function sanitizeFilterName(filter) {
    return filter
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
}

// Helper: Extract timestamp from video URL and convert to YYYYMMDDHHMM
function extractTimestampFromUrl(videoUrl) {
    // Video URLs contain timestamp: .../presentation/hash-TIMESTAMP/video/webcams.webm
    // Example: .../86cbb5c36361c9471658fc29134a603ab1b0ad30-1767646200903/video/
    const match = videoUrl.match(/-(\d{13})\//);
    if (!match) return null;
    
    try {
        const timestamp = parseInt(match[1]);
        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) return null;
        
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        
        return `${y}${m}${d}${h}${min}`;
    } catch {
        return null;
    }
}

// Helper: Download file via stream
async function downloadFile(url, outputPath) {
    const response = await axios({ url, method: 'GET', responseType: 'stream' });
    const writer = fs.createWriteStream(outputPath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function main() {
    console.log("Starting SENCE Video Downloader...\n");
    
    // Determine search directory based on BBB_FILTER
    const filter = process.env.BBB_FILTER;
    let searchDir = '.';
    
    if (filter) {
        const safeName = sanitizeFilterName(filter);
        searchDir = `scraped_data/${safeName}`;
        
        if (!await fs.pathExists(searchDir)) {
            console.log(`No scraped data folder found at ${searchDir}`);
            return;
        }
    }
    
    // Find latest playback data
    const pattern = path.join(searchDir, 'playback_data_*.json');
    const files = await glob(pattern);
    if (files.length === 0) {
        console.log("No playback_data_*.json files found");
        return;
    }
    
    // Sort by modification time (newest first)
    files.sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());
    
    const latestFile = files[0];
    console.log(`Processing: ${latestFile}`);
    
    const data = await fs.readJson(latestFile);
    console.log(`Found ${data.length} recordings\n`);
    
    // Determine output directory
    let outputDir = 'downloaded_videos';
    let mergedDir = 'merged_videos';
    const moduleFilter = process.env.BBB_FILTER;
    
    if (moduleFilter) {
        const safeName = sanitizeFilterName(moduleFilter);
        outputDir = path.join(outputDir, safeName);
        mergedDir = path.join(mergedDir, safeName);
        console.log(`Output: ${outputDir}`);
        console.log(`Checking Merged: ${mergedDir}\n`);
    } else {
        console.log(`Output: ${outputDir}\n`);
    }
    
    await fs.ensureDir(outputDir);
    
    // Download videos
    let skippedCount = 0;
    
    for (const item of data) {
        const videos = item.scraped_content?.videos || [];
        
        if (videos.length === 0) {
            console.log(`⚠ Skipping: No videos for '${item.name}'`);
            continue;
        }
        
        // Extract timestamp from first video URL
        const filePrefix = extractTimestampFromUrl(videos[0]);
        
        if (!filePrefix) {
            console.log(`⚠ Skipping: Could not extract timestamp from URL for '${item.name}'`);
            continue;
        }
        
        // Check if merged video already exists
        const mergedPath = path.join(mergedDir, `${filePrefix}_merged.mp4`);
        if (await fs.pathExists(mergedPath)) {
            console.log(`⏭ ${filePrefix}_merged.mp4 (already merged)`);
            skippedCount++;
            continue;
        }
        
        for (const videoUrl of videos) {
            const suffix = videoUrl.includes("webcams") ? "webcams" : 
                          videoUrl.includes("deskshare") ? "deskshare" : "video";
            
            const filename = `${filePrefix}_${suffix}.webm`;
            const outputPath = path.join(outputDir, filename);
            
            if (await fs.pathExists(outputPath)) {
                console.log(`⏭ ${filename} (exists)`);
                continue;
            }
            
            console.log(`⬇ ${filename}...`);
            try {
                await downloadFile(videoUrl, outputPath);
                console.log(`  ✓`);
            } catch (e) {
                console.error(`  ✗ ${e.message}`);
            }
        }
    }
    
    console.log(`\n✓ Complete. Processed ${data.length} items.`);
    if (skippedCount > 0) {
        console.log(`  (Skipped ${skippedCount} already merged videos)`);
    }
    console.log(`  Check '${outputDir}'`);
}

main();
