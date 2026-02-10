import 'dotenv/config';
import fs from 'fs-extra';

const COOKIE_FILE = 'session_cookies.json';

// Helper: Save session cookies
export async function saveSession(page) {
    try {
        const cookies = await page.cookies();
        await fs.writeJson(COOKIE_FILE, cookies, { spaces: 2 });
        console.log(`✓ Session saved to ${COOKIE_FILE}`);
    } catch (e) {
        console.error(`✗ Failed to save session: ${e.message}`);
    }
}

// Helper: Load session cookies
async function loadSession(page) {
    if (!fs.existsSync(COOKIE_FILE)) return false;
    
    try {
        const cookies = await fs.readJson(COOKIE_FILE);
        if (Array.isArray(cookies) && cookies.length > 0) {
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} session cookies`);
            return true;
        }
    } catch (e) {
        console.error(`✗ Failed to load session: ${e.message}`);
    }
    return false;
}

// Helper: Check if already logged in
function isLoggedIn(url) {
    return url.includes("auladigital.sence.cl") && 
           !url.includes("login") && 
           !url.includes("claveunica");
}

// Helper: Handle SENCE landing page
async function handleSenceLanding(page, run) {
    const rutSelector = 'input[placeholder*="Rut"], input[id*="rut"], input[name*="rut"]';
    
    if (!await page.$(rutSelector)) return;
    
    console.log("Found SENCE Landing Page");
    await page.waitForSelector(rutSelector, { timeout: 5000 });
    await page.type(rutSelector, run);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    
    // Try clicking Acceder button
    const btns = await page.$$("xpath///button[contains(translate(., 'ACDER', 'acder'), 'acceder')] | //button[@id='btnLogin']");
    if (btns.length > 0) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            btns[0].click()
        ]);
    }
}

// Helper: Handle ClaveÚnica login
async function handleClaveUnicaLogin(page, run, password) {
    const cuSelector = 'input[name="run"], input[id="run"]';
    
    try {
        await page.waitForSelector(cuSelector, { timeout: 5000 });
    } catch {
        // If not on ClaveÚnica, check if already logged in
        if (isLoggedIn(page.url())) {
            await saveSession(page);
            return true;
        }
        return false;
    }
    
    console.log("Found ClaveÚnica page");
    
    // Clear and fill credentials
    await page.$eval(cuSelector, el => el.value = '');
    await page.type(cuSelector, run);
    await page.type('input[name="password"], input[id="password"]', password);
    await new Promise(r => setTimeout(r, 1000));
    
    // Submit
    const btn = await page.$('button[type="submit"], input[type="submit"], #btn-submit, .btn-primary, #login-submit');
    if (!btn) {
        console.log("⚠ Submit button not found");
        return false;
    }
    
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        btn.click()
    ]);
    
    await new Promise(r => setTimeout(r, 10000)); // Wait for redirects
    
    // Check success
    if (page.url().includes('claveunica.gob.cl')) {
        console.error("✗ Login failed - still on ClaveÚnica");
        return false;
    }
    
    console.log("✓ Login successful");
    await saveSession(page);
    return true;
}

// Main auto-login function
export async function autoLogin(page) {
    const run = process.env.RUN?.replace(/\./g, '') || '';
    const password = process.env.PASSWORD;

    if (!run || !password) return false;

    console.log("Checking authentication...");

    // Try restoring session
    const cookiesLoaded = await loadSession(page);
    
    if (cookiesLoaded) {
        // Test if cookies are still valid by reloading the page
        if (page.url() && page.url() !== 'about:blank') {
            try {
                console.log("   Testing saved session...");
                await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
                
                // Check if session is still valid
                if (isLoggedIn(page.url())) {
                    console.log("✓ Session restored successfully");
                    return true;
                } else {
                    console.log("   Session expired, re-authenticating...");
                }
            } catch {
                console.log("⚠ Reload timed out");
            }
        }
    }
    
    // Check if already logged in (without cookies)
    if (isLoggedIn(page.url())) {
        console.log("✓ Already logged in");
        await saveSession(page); // Save current session
        return true;
    }

    console.log("Session expired - attempting login");
    
    try {
        // Step 1: SENCE Landing
        await handleSenceLanding(page, run);
        
        // Step 2: ClaveÚnica
        return await handleClaveUnicaLogin(page, run, password);
        
    } catch (e) {
        console.error(`✗ Auto-login failed: ${e.message}`);
        
        // Fallback: save session if somehow on target site
        if (isLoggedIn(page.url())) {
            await saveSession(page);
            return true;
        }
    }
    
    return false;
}
