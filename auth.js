import 'dotenv/config';

export async function autoLogin(page) {
    const run = process.env.RUN ? process.env.RUN.replace(/\./g, '') : '';
    const password = process.env.PASSWORD;

    if (!run || !password) return false;

    console.log("Attempting usage of credentials from .env...");
    
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

                return true;
            } else {
                 console.log("ClaveÚnica submit button not found.");
            }
        } catch (e) {
             console.log("ClaveÚnica login attempt failed:", e.message);
             if (page.url().includes("auladigital.sence.cl")) return true;
        }

    } catch (e) {
        console.error("Auto-login failed:", e.message);
    }
    return false;
}
