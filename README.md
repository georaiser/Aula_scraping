# Aula Digital Scraper - Windows Installation Guide

Complete step-by-step guide for Windows users to install and run the SENCE Aula scraper.

---

## Prerequisites Installation

### Step 1: Install Node.js

1. **Download Node.js**
   - Go to [https://nodejs.org/](https://nodejs.org/)
   - Click the **"LTS"** (Long Term Support) button to download the installer
   - Download the **Windows Installer (.msi)** - 64-bit version

2. **Run the Installer**
   - Double-click the downloaded `.msi` file
   - Click "Next" through the installer
   - Accept the license agreement
   - Keep the default installation path (usually `C:\Program Files\nodejs\`)
   - **Important:** Make sure "**Add to PATH**" is checked (it's checked by default)
   - Click "Install"

3. **Verify Installation**
   - Press `Windows Key + R`
   - Type `cmd` and press Enter
   - In the Command Prompt, type:
     ```cmd
     node --version
     ```
   - You should see something like `v20.x.x` or `v22.x.x`
   - Also check npm:
     ```cmd
     npm --version
     ```
   - You should see something like `10.x.x`

### Step 2: Install FFmpeg

FFmpeg is required for merging videos.

#### Option A: Using Windows Package Manager (Recommended)

1. **Install FFmpeg**
   - Open **PowerShell** (regular user, no admin needed):
     - Press `Windows Key`
     - Type "PowerShell"
     - Press Enter
   - Run this command:
     ```powershell
     winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
     ```
   - Wait for installation to complete

2. **Update PATH**
   - In the same PowerShell window, run:
     ```powershell
     $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
     ```

3. **Verify Installation**
   - In PowerShell, type:
     ```powershell
     ffmpeg -version
     ```
   - You should see FFmpeg version information (e.g., `ffmpeg version 8.0.1`)

---

## Project Setup

### Step 3: Download the Project

1. **Option A: Using Git**
   - If you have Git installed:
     ```cmd
     cd C:\Users\YourUsername\Documents
     git clone [repository-url]
     cd Aula_scraping
     ```

2. **Option B: Download ZIP**
   - Download the project as a ZIP file
   - Extract to a location like `C:\Users\YourUsername\Documents\Aula_scraping`
   - Open Command Prompt and navigate to the folder:
     ```cmd
     cd C:\Users\YourUsername\Documents\Aula_scraping
     ```

### Step 4: Install Project Dependencies

In the Command Prompt (inside the project folder), run:

```cmd
npm install
```

This will install all required Node.js packages (Puppeteer, fs-extra, dotenv, axios, glob).

Wait for the installation to complete. You should see a progress bar and no errors.

### Step 5: Configure Credentials

1. **Copy the example configuration file**

   ```cmd
   copy .env.example .env
   ```

2. **Edit the `.env` file**
   - Right-click `.env` file
   - Open with Notepad (or Notepad++)
   - Edit the following:
     ```ini
     RUN=12345678-9
     PASSWORD=yourpassword
     COURSE_HOME_URL=https://auladigital.sence.cl/course/view.php?id=XXXX
     BBB_FILTER=Módulo 2
     ```

   **Replace:**
   - `12345678-9` with your RUT
   - `yourpassword` with your ClaveÚnica password
   - `BBB_FILTER` with the module you want to scrape (e.g., "Módulo 2", "Módulo 4")

3. **Save and close** the file

---

## Running the Scripts

### Step 6: Scrape Home Page (Get Module List)

Run this command to get a list of all available BBB modules:

```cmd
node home_scraper.js
```

**What happens:**

- Browser window will open automatically
- Automatic login will be attempted
- If successful, it will scrape all module links
- Creates `bbb_modules.json` file

### Step 7: Scrape Session Links

Run this to get recording links from modules matching your `BBB_FILTER`:

```cmd
node session_scraper.js
```

**What happens:**

- Uses saved session cookies (no login needed if session is valid)
- Scrapes recording links from modules matching your filter
- Creates `scraped_data/modulo_2/session_modulo_2.json`

### Step 8: Scrape Playback Data

Run this to extract video URLs from the recording pages:

```cmd
node playback_scraper.js
```

**What happens:**

- Processes all session files
- Extracts actual video URLs
- Creates `scraped_data/modulo_2/playback_data_TIMESTAMP.json`

### Step 9: Download Videos

Run this to download the video files:

```cmd
node download_videos.js
```

**What happens:**

- Downloads webcam and deskshare videos
- Saves to `downloaded_videos/modulo_2/`
- Filenames are based on recording timestamps (e.g., `202601051750_webcams.webm`)

**Note:** This may take a while depending on the number and size of videos.

### Step 10: Merge Videos

Run this to merge webcam and deskshare videos:

```cmd
node merge_videos.js
```

**What happens:**

- Uses FFmpeg to merge videos side-by-side
- Creates `merged_videos/modulo_2/202601051750_merged.mp4`

**Note:** Video merging is CPU-intensive and may take time.

---

## Output Structure

After running all scripts with `BBB_FILTER=Módulo 2`, your folder structure will be:

```
Aula_scraping/
├── scraped_data/
│   └── modulo_2/
│       ├── session_modulo_2.json
│       └── playback_data_2026-02-09T19-22-57.json
├── downloaded_videos/
│   └── modulo_2/
│       ├── 202601051750_webcams.webm
│       ├── 202601051750_deskshare.webm
│       └── ...
├── merged_videos/
│   └── modulo_2/
│       ├── 202601051750_merged.mp4
│       └── ...
└── bbb_modules.json
```

---

## Common Issues & Solutions

### Issue: "node is not recognized"

**Solution:** Node.js is not in your PATH. Reinstall Node.js and make sure "Add to PATH" is checked.

### Issue: "ffmpeg is not recognized"

**Solution:** FFmpeg is not in your PATH. Follow Step 2 again, especially the PATH configuration.

### Issue: Browser doesn't open

**Solution:**

- Make sure Puppeteer installed correctly
- Try running: `npm install puppeteer --force`

### Issue: Login fails

**Solution:**

- Check your RUT and password in `.env` file
- Make sure RUT format is correct (12345678-9)
- Delete `session_cookies.json` and try again

### Issue: Downloads are slow

**Solution:** This is normal. Video files are large. Be patient!

### Issue: Merge fails

**Solution:**

- Make sure both webcam and deskshare files exist
- Check that FFmpeg is installed correctly
- Try a smaller video first to test

---

## Tips

1. **Session Cookies:** After first successful login, cookies are saved to `session_cookies.json`. Future runs won't need to login again (unless session expires).

2. **Filtering Modules:** Change `BBB_FILTER` in `.env` to scrape different modules:
   - `BBB_FILTER=Módulo 1`
   - `BBB_FILTER=Módulo 4`

3. **Re-running Scripts:** It's safe to re-run scripts. They skip already downloaded/merged files.

4. **Disk Space:** Make sure you have enough space. Video files can be several GB per recording.

---

## Need Help?

If you encounter issues:

1. Make sure all steps were followed in order
2. Check that Node.js and FFmpeg are installed correctly
3. Verify your `.env` credentials are correct
4. Read the error messages carefully

---

## Visual Indicators

Scripts use emoji indicators:

- ✓ Success
- ✗ Error
- ⚠ Warning
- ⏭ Skipped
- ⬇ Downloading
- 🎬 Merging
