import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import { autoLogin } from './auth.js';

const CONFIG = {
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
};

async function scrapeBBBLinks(page) {
    return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
            .filter(a => a.href.includes('mod/bigbluebuttonbn/view.php'))
            .map(a => ({
                text: a.innerText.trim(),
                link: a.href
            }));
    });
}

async function main() {
    console.log("Starting SENCE Home Scraper...\n");

    const targetUrl = process.argv[2] || process.env.COURSE_HOME_URL;

    if (!targetUrl) {
        console.error("Error: COURSE_HOME_URL not set in .env and no URL provided");
        console.log("\nUsage: node home_scraper.js [URL]");
        process.exit(1);
    }

    console.log(`URL: ${targetUrl}`);

    const browser = await puppeteer.launch(CONFIG);
    const page = await browser.newPage();

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });

        if (!await autoLogin(page)) {
            console.log("\n⚠ Auto-login failed - verify manual login if needed\n");
        }

        const links = await scrapeBBBLinks(page);
        console.log(`✓ Found ${links.length} BigBlueButton links`);

        await fs.writeJson('bbb_modules.json', { modules: links }, { spaces: 4 });
        console.log('✓ Saved to bbb_modules.json');

    } catch (error) {
        console.error("✗ Error:", error.message);
    } finally {
        console.log("\n✓ Closing browser...");
        await browser.close();
    }
}

main();
