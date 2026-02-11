import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';

// Helper: Sanitize filter name for directory
function sanitizeFilterName(filter) {
    return filter
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
}

// Helper: Run FFmpeg merge
async function mergeWithFFmpeg(deskFile, webcamFile, outputFile) {
    const args = [
        '-v', 'quiet', '-stats',
        '-i', deskFile,
        '-i', webcamFile,
        '-filter_complex', '[1]scale=iw/5:-1[pip];[0][pip]overlay=main_w-overlay_w-20:main_h-overlay_h-40[merged];[merged]scale=1280:-2',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '28',
        '-c:a', 'aac',
        outputFile
    ];
    
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', args, { stdio: 'inherit' });
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log(`  ✓ Success`);
            } else {
                console.error(`  ✗ FFmpeg exited with code ${code}`);
            }
            resolve();
        });
        
        ffmpeg.on('error', (err) => {
            console.error(`  ✗ Failed to start FFmpeg: ${err.message}`);
            resolve();
        });
    });
}

async function main() {
    console.log("Starting SENCE Video Merger...\n");
    
    // Determine directories
    let inputDir = 'downloaded_videos';
    let outputDir = 'merged_videos';
    
    const filter = process.env.BBB_FILTER;
    if (filter) {
        const safeName = sanitizeFilterName(filter);
        inputDir = path.join(inputDir, safeName);
        outputDir = path.join(outputDir, safeName);
        console.log(`Input:  ${inputDir}`);
        console.log(`Output: ${outputDir}\n`);
    }
    
    if (!await fs.pathExists(inputDir)) {
        console.log(`✗ Error: Directory '${inputDir}' not found`);
        return;
    }
    
    await fs.ensureDir(outputDir);
    
    // Find deskshare files
    const deskshareFiles = await glob(path.join(inputDir, '*_deskshare.webm'));
    console.log(`Found ${deskshareFiles.length} recording sets\n`);
    
    let skippedCount = 0;
    
    for (const deskFile of deskshareFiles) {
        const prefix = path.basename(deskFile).replace('_deskshare.webm', '');
        const webcamFile = path.join(inputDir, `${prefix}_webcams.webm`);
        const outputFile = path.join(outputDir, `${prefix}_merged.mp4`);
        
        if (!await fs.pathExists(webcamFile)) {
            console.log(`⏭ ${prefix}: Webcam file not found`);
            continue;
        }
        
        if (await fs.pathExists(outputFile)) {
            console.log(`⏭ ${prefix}_merged.mp4 (exists)`);
            skippedCount++;
            continue;
        }
        
        console.log(`🎬 ${prefix}...`);
        await mergeWithFFmpeg(deskFile, webcamFile, outputFile);
    }
    
    console.log(`\n✓ Merge complete. Processed ${deskshareFiles.length} items.`);
    if (skippedCount > 0) {
        console.log(`  (Skipped ${skippedCount} existing files)`);
    }
    console.log(`  Check '${outputDir}'`);
}

main();
