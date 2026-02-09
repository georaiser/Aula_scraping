import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import { autoLogin } from './auth.js';

async function scrapeHome() {
  console.log("Starting SENCE Home Scraper (JS)...");

  // Default URL from env
  const defaultUrl = process.env.COURSE_HOME_URL;
  
  // Allow passing URL as arg
  const targetUrl = process.argv[2] || defaultUrl;

  if (!targetUrl) {
      console.error("Error: COURSE_HOME_URL not set in .env and no URL provided as argument.");
      process.exit(1);
  }

  console.log(`Using URL: ${targetUrl}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    console.log("1. Navigating to Initial URL...");
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    // Try Auto-Login
    const loggedIn = await autoLogin(page);

    console.log("\n" + "=".repeat(60));
    if (loggedIn) {
        console.log("Auto-login attempted. Please verify you are logged in.");
    } else {
        console.log("IMPORTANT: PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW.");
        console.log("Navigate through the Clave Única process if required.");
    }
    console.log("Wait until you are fully logged in and see the Course page.");
    console.log("The script will wait for navigation to complete if needed.");
    console.log("=".repeat(60) + "\n");
    
    // In Python script there was a manual input wait. 
    // Here we can check if we are redirected to a course page or use --auto-confirm logic if we want consistency
    // But since this is a direct port, we should ensure we are on the target page.
    
    // If auto-login worked, we might be on the target page or a landing page.
    // Let's assume after login we are redirected.
    
    // Get current details
    const currentUrl = page.url();
    const title = await page.title();
    
    console.log(`\n2. Scraping Current Page (Course Home): ${currentUrl}`);
    
    // Scrape Links - FILTER FOR BBB LINKS ONLY
    const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors
            .filter(a => a.href.includes('mod/bigbluebuttonbn/view.php'))
            .map(a => ({
                text: a.innerText.trim(),
                link: a.href
            }));
    });
    
    console.log(`   -> Found ${links.length} BigBlueButton links.`);

    const data = {
        modules: links
    };
    
    const filename = `bbb_modules.json`;
    await fs.writeJson(filename, data, { spaces: 4 });
    console.log(`Data saved to ${filename}`);

  } catch (error) {
    console.error("Error scraping home:", error);
  } finally {
    console.log("Closing browser...");
    await browser.close();
  }
}

scrapeHome();
