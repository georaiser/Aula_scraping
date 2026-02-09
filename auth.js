import 'dotenv/config';
import fs from 'fs-extra';

const COOKIE_FILE = 'session_cookies.json';

export async function saveSession(page) {
    try {
        const cookies = await page.cookies();
        await fs.writeJson(COOKIE_FILE, cookies, { spaces: 2 });
        console.log(`Session cookies saved to ${COOKIE_FILE}`);
    } catch (e) {
        console.error("Failed to save session cookies:", e.message);
    }
}

async function loadSession(page) {
    if (!fs.existsSync(COOKIE_FILE)) return false;
    try {
        const cookies = await fs.readJson(COOKIE_FILE);
        if (Array.isArray(cookies) && cookies.length > 0) {
            await page.setCookie(...cookies);
            console.log(`Loaded ${cookies.length} session cookies.`);
            return true;
        }
    } catch (e) {
        console.error("Failed to load session cookies:", e.message);
    }
    return false;
}

export async function autoLogin(page) {
    const run = process.env.RUN ? process.env.RUN.replace(/\./g, '') : '';
    const password = process.env.PASSWORD;

    if (!run || !password) return false;

    console.log("Checking authentication status...");

    // 1. Try restoring session
    const cookiesLoaded = await loadSession(page);
    if (cookiesLoaded) {
        // Reload to apply cookies if we are already on a page
        if (page.url() && page.url() !== 'about:blank') {
            console.log("Refreshing page to apply session...");
            try {
                await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {
                 console.log("Reload timed out, continuing...");
            }
        }
    }
    
    // Check if valid session
    if (page.url().includes("auladigital.sence.cl") && !page.url().includes("login") && !page.url().includes("claveunica")) {
          console.log("Already logged in (Session Valid).");
          // Re-save cookies to keep them fresh? Maybe not needed every time, but good practice.
          return true;
    }

    console.log("Session invalid or expired. Attempting usage of credentials from .env...");
    
    try {
        // STEP 1: Check if we are on SENCE Landing (RUT input)
        try {
            const rutSelector = 'input[placeholder*="Rut"], input[id*="rut"], input[name*="rut"]';
            // Short timeout to check if we are on landing
            if (await page.$(rutSelector) !== null) {
                console.log("Found SENCE Landing Page. Entering RUT...");
                await page.waitForSelector(rutSelector, { timeout: 5000 });
                await page.type(rutSelector, run);
                await page.keyboard.press('Enter'); 
                
                // Wait for AJAX to check RUT
                await new Promise(r => setTimeout(r, 2000));
                
                // "Acceder" button - check various selectors
                const btns = await page.$$("xpath///button[contains(translate(., 'ACDER', 'acder'), 'acceder')] | //button[@id='btnLogin']");
                if (btns.length > 0) {
                     console.log("Clicking 'Acceder'...");
                     await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2' }),
                        btns[0].click()
                     ]);
                } else {
                     console.log("No 'ACCEDER' button found or Enter sufficed. Waiting for nav...");
                     try {
                        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
                     } catch (e) {}
                }
            }
        } catch (e) {
            console.log("SENCE Landing interaction error:", e.message);
        }

        // STEP 2: ClaveÚnica Login
        try {
            // Check if we are on ClaveÚnica page
            const cuSelector = 'input[name="run"], input[id="run"]';
            try {
                await page.waitForSelector(cuSelector, { timeout: 5000 });
            } catch(e) {
                // If not found, check if we are already logged in or elsewhere
                if (page.url().includes("auladigital.sence.cl") && !page.url().includes("login")) {
                    await saveSession(page); // Success! Save cookies
                    return true; 
                }
                throw e; // Rethrow to go to catch block
            }
            
            console.log("Found ClaveÚnica login form...");
            console.log("Filling ClaveÚnica credentials...");
            
            await page.$eval('input[name="run"], input[id="run"]', el => el.value = ''); // Clear
            await page.type('input[name="run"], input[id="run"]', run);
            
            await page.type('input[name="password"], input[id="password"]', password);
            
            // Wait for keyup handlers to enable button
            await new Promise(r => setTimeout(r, 1000));

            const btn = await page.$('button[type="submit"], input[type="submit"], #btn-submit, .btn-primary, #login-submit');
            if (btn) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    btn.click()
                ]);
                console.log("ClaveÚnica Login submitted. Waiting for redirection...");
                
                console.log("Waiting 10 seconds for redirects to settle...");
                await new Promise(r => setTimeout(r, 10000));
                
                // Check if still on ClaveÚnica (failed login)
                if (page.url().includes('claveunica.gob.cl')) {
                    console.error("Login might have failed, still on ClaveÚnica domain.");
                    return false;
                }

                console.log("Login successful.");
                await saveSession(page); // SAVE COOKIES
                return true;
            } else {
                 console.log("ClaveÚnica submit button not found.");
            }
        } catch (e) {
             console.log("ClaveÚnica login attempt failed:", e.message);
             if (page.url().includes("auladigital.sence.cl")) {
                 await saveSession(page); // Assume success if redirected back
                 return true;
             }
        }

    } catch (e) {
        console.error("Auto-login failed:", e.message);
    }
    return false;
}
