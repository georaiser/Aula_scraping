import 'dotenv/config';
import puppeteer from 'puppeteer';
import { autoLogin, saveSession } from './auth.js';

// ─── Config ──────────────────────────────────────────────────────────────────
const TARGET_URL    = process.env.COURSE_HOME_URL;
const REFRESH_HOURS = Number(process.env.SESSION_REFRESH_HOURS || 1);
const REFRESH_MS    = REFRESH_HOURS * 60 * 60 * 1000;
const CHECK_MODE    = process.argv.includes('--check');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timestamp() {
    return new Date().toLocaleTimeString('es-CL', { hour12: false });
}
function log(msg) { console.log(`[${timestamp()}] ${msg}`); }
function err(msg) { console.error(`[${timestamp()}] ✗ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isLoggedIn(url) {
    return url.includes('auladigital.sence.cl') &&
           !url.includes('login') &&
           !url.includes('claveunica');
}

// ─── Core: one login cycle (mirrors pattern used in session_scraper.js) ───────
async function doLogin(page) {
    log(`Navigating to ${TARGET_URL} ...`);
    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
    } catch (e) {
        err(`Navigation failed: ${e.message}`);
        return false;
    }

    // Same flow as scrapeSession() in session_scraper.js
    const ok = await autoLogin(page);
    if (!ok) {
        err('Login failed. Will retry on next cycle.');
        return false;
    }

    // Re-navigate if autoLogin redirected us away from the course page
    if (page.url() !== TARGET_URL) {
        log('Redirected after login — navigating back to course...');
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
    }

    // Final check: are we actually on the course page?
    if (!isLoggedIn(page.url())) {
        err(`Still not on course page (landed on: ${page.url()})`);
        return false;
    }

    // Persist cookies so other scripts (session_scraper, playback_scraper, etc.) benefit
    await saveSession(page);
    log(`✓ Session active — page: ${page.url()}`);
    return true;
}

// ─── --check mode: one shot, print status, exit ───────────────────────────────
async function checkMode() {
    console.log('\n🔍 Session check mode\n');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    try {
        const ok = await doLogin(page);
        console.log(ok ? '\n🟢 Session is ACTIVE' : '\n🔴 Session is INACTIVE');
        process.exit(ok ? 0 : 1);
    } finally {
        await browser.close();
    }
}

// ─── Daemon loop ──────────────────────────────────────────────────────────────
async function daemonMode() {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║      SENCE Session Daemon  🔐         ║');
    console.log(`║  Refresh interval: every ${REFRESH_HOURS}h          ║`);
    console.log('║  Press Ctrl+C to stop                ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Graceful shutdown
    const shutdown = async (signal) => {
        log(`${signal} — saving session and closing...`);
        try { await saveSession(page); } catch {}
        try { await browser.close(); } catch {}
        log('Daemon stopped.');
        process.exit(0);
    };
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    let cycle = 1;
    while (true) {
        log(`── Cycle #${cycle} ──────────────────────`);
        await doLogin(page);
        const nextAt = new Date(Date.now() + REFRESH_MS).toLocaleTimeString('es-CL', { hour12: false });
        log(`Sleeping ${REFRESH_HOURS}h — next refresh at ${nextAt}`);
        cycle++;
        await sleep(REFRESH_MS);
    }
}

// ─── Entry ────────────────────────────────────────────────────────────────────
async function main() {
    if (!TARGET_URL) {
        err('COURSE_HOME_URL is not set in .env'); process.exit(1);
    }
    if (!process.env.RUN || !process.env.PASSWORD) {
        err('RUN and PASSWORD must be set in .env'); process.exit(1);
    }
    CHECK_MODE ? await checkMode() : await daemonMode();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
