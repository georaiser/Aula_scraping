import { spawn } from 'child_process';
import path from 'path';

// Define the steps in order
const STEPS = [
    { script: 'session_scraper.js', desc: 'Scraping Session List' },
    { script: 'playback_scraper.js', desc: 'Scraping Video Links' },
    { script: 'download_videos.js', desc: 'Downloading Raw Videos' },
    { script: 'merge_videos.js',    desc: 'Merging into MP4' }
];

async function runStep(step) {
    return new Promise((resolve, reject) => {
        console.log(`\n🔹 [Step] ${step.desc}...`);
        
        const child = spawn('node', [step.script], { 
            stdio: 'inherit',
            shell: true 
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ [Step] ${step.desc} Completed`);
                resolve();
            } else {
                console.error(`❌ [Step] ${step.desc} Failed (Exit Code: ${code})`);
                reject(new Error(`Script ${step.script} failed`));
            }
        });
        
        child.on('error', (err) => {
            console.error(`❌ [Step] Error launching ${step.script}: ${err.message}`);
            reject(err);
        });
    });
}

async function main() {
    console.log("🚀 Starting Full Scraping Pipeline");
    console.log("=========================================");
    
    // Check for .env file
    // (Optional simple check, but good practice)
    
    const startTime = Date.now();
    
    try {
        for (const step of STEPS) {
            await runStep(step);
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log("\n=========================================");
        console.log(`🎉 Pipeline Completed Successfully in ${duration}s!`);
        console.log("=========================================");
        
    } catch (error) {
        console.error("\n⛔ Pipeline Stopped due to error.");
        process.exit(1);
    }
}

main();
