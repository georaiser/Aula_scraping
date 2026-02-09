
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';

async function mergeVideos() {
    console.log("Starting SENCE Video Merger (JS)...");
    
    const inputDir = 'downloaded_videos';
    const outputDir = 'merged_videos';
    
    if (!await fs.pathExists(inputDir)) {
        console.log(`Error: Directory '${inputDir}' not found.`);
        return;
    }
    
    await fs.ensureDir(outputDir);
    
    // Find deskshare files
    const deskshareFiles = await glob(path.join(inputDir, '*_deskshare.webm'));
    console.log(`Found ${deskshareFiles.length} recording sets.`);
    
    for (const deskFile of deskshareFiles) {
        const baseName = path.basename(deskFile);
        const prefix = baseName.replace('_deskshare.webm', '');
        
        const webcamFile = path.join(inputDir, `${prefix}_webcams.webm`);
        const outputFile = path.join(outputDir, `${prefix}_merged.mp4`);
        
        if (!await fs.pathExists(webcamFile)) {
            console.log(`Skipping ${prefix}: Webcam file not found.`);
            continue;
        }
        
        if (await fs.pathExists(outputFile)) {
            console.log(`Skipping ${prefix}: Output already exists.`);
            continue;
        }
        
        console.log(`Merging ${prefix} (Optimized JS)...`);
        
        // FFmpeg Command (Same optimization as Python)
        const args = [
            '-v', 'quiet', '-stats',
            '-i', deskFile,
            '-i', webcamFile,
            '-filter_complex', '[1]scale=iw/5:-1[pip];[0][pip]overlay=main_w-overlay_w-20:main_h-overlay_h-20[merged];[merged]scale=1280:-2',
            '-map', '1:a',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '28',
            '-c:a', 'aac',
            outputFile
        ];
        
        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', args, { stdio: 'inherit' });
            
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    console.log(`Success: ${outputFile}`);
                    resolve();
                } else {
                    console.error(`FFmpeg exited with code ${code}`);
                    // Don't reject to allow loop to continue? 
                    // Better to resolve but log error.
                    resolve(); 
                }
            });
            
            ffmpeg.on('error', (err) => {
                console.error(`Failed to start FFmpeg: ${err.message}`);
                resolve();
            });
        });
    }
    
    console.log(`\nMerge complete. Check '${outputDir}' folder.`);
}

mergeVideos();
