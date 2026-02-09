
import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { glob } from 'glob';

// Helper to parse date
function parseDateFromName(nameStr) {
    // Regex: Mon, 5 Jan 2026, 5:50 PM (or similar)
    const match = nameStr.match(/(\w{3}, \d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} [AP]M)/);
    if (match) {
        const dateStr = match[1];
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            
            // Format: YYYYMMDDHHMM
            const iso = date.toISOString(); // 2026-01-05T20:50:00.000Z
            // Need to handle timezone? Provided string has offset sometimes?
            // "Mon, 5 Jan 2026, 5:50 PM -03 75" -> regex might miss -03.
            // Simplified: just use local numeric format from string if possible.
            // Or just format ISO to string.
            // Let's use simple string replacement on ISO for now, assuming UTC or handled by Date.
            // Actually, `new Date("Mon, 5 Jan 2026, 5:50 PM")` works in Chrome/Node usually.
            
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hour = date.getHours().toString().padStart(2, '0');
            const minute = date.getMinutes().toString().padStart(2, '0');
            return `${date.getFullYear()}${month}${day}${hour}${minute}`;
        } catch (e) {
            console.error(e);
            return null;
        }
    }
    return null;
}

async function downloadFile(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function main() {
    console.log("Starting SENCE Video Downloader (JS)...");
    
    // Find latest playback_data file
    const files = await glob('playback_data_*.json');
    if (files.length === 0) {
        console.log("No playback_data_*.json files found.");
        return;
    }
    
    // Sort by modification time
    files.sort((a, b) => {
        return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
    });
    
    const latestFile = files[0];
    console.log(`Processing file: ${latestFile}`);
    
    const data = await fs.readJson(latestFile);
    console.log(`Found ${data.length} recordings.`);
    
    // Determine Output Folder based on Filter
    let outputDir = 'downloaded_videos';
    const filter = process.env.BBB_FILTER;
    
    if (filter) {
        // Sanitize: "Módulo 4" -> "Modulo_4"
        const safeName = filter
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^a-z0-9]/gi, '_'); // Replace non-alphanumeric with _
        
        outputDir = path.join(outputDir, safeName);
        console.log(`Using filter-based output directory: ${outputDir}`);
    }
    
    await fs.ensureDir(outputDir);
    
    for (const item of data) {
        const name = item.name || "";
        const filePrefix = parseDateFromName(name);
        
        if (!filePrefix) {
            console.log(`Skipping: Could not parse date from '${name.substring(0, 30)}...'`);
            continue;
        }
        
        const videos = item.scraped_content?.videos || [];
        
        for (const videoUrl of videos) {
            let suffix = "video";
            if (videoUrl.includes("webcams")) suffix = "webcams";
            else if (videoUrl.includes("deskshare")) suffix = "deskshare";
            
            const filename = `${filePrefix}_${suffix}.webm`; // Assuming webm source
            const outputPath = path.join(outputDir, filename);
            
            if (await fs.pathExists(outputPath)) {
                console.log(`Skipping ${filename} (already exists)`);
                continue;
            }
            
            console.log(`Downloading ${filename}...`);
            try {
                await downloadFile(videoUrl, outputPath);
                console.log(`   -> Done.`);
            } catch (e) {
                console.error(`   -> Failed to download ${videoUrl}: ${e.message}`);
            }
        }
    }
    
    console.log(`\nAll downloads processed. Check '${outputDir}' folder.`);
}

main();
