# Aula Digital Scraper

A web scraping and video processing pipeline for SENCE Aula Digital (BigBlueButton recordings).

## Features

- **Automated Scraping**: Full auto-login support (ClaveÚnica) via `.env` credentials
- **Session Persistence**: Cookie-based session reuse to avoid repeated logins
- **Batch Processing**: Filter and scrape multiple modules automatically
- **Dynamic Folders**: Organized downloads/merges by module name
- **Optimized Code**: Clean, modular scripts with helper functions and emoji indicators

## Prerequisites

- **Node.js**: v18+ required
- **FFmpeg**: Required for video merging
- **Python 3.7+**: (Optional, for Python scripts)

**Windows Users:** See [README_WINDOWS.md](README_WINDOWS.md) for detailed step-by-step installation instructions.

## Installation

```bash
npm install puppeteer fs-extra dotenv axios glob
```

## Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```ini
RUN=12345678-9
PASSWORD=yourpassword
COURSE_HOME_URL=https://auladigital.sence.cl/...
BBB_FILTER="Módulo 4"  # Optional: Filter specific modules
```

## Workflow

### Step 1: Scrape Home (Get Module List)

Extracts all available BBB modules from the course home page.

```bash
node home_scraper.js
```

**Output:** `bbb_modules.json` (root directory, contains all modules)

### Step 2: Scrape Sessions (Get Recording Links)

Iterates through modules and extracts recording links.

**Batch Mode (Recommended):** Scrapes modules matching `BBB_FILTER` in `.env`

```bash
node session_scraper.js
```

**Single URL Mode:** Scrape a specific BBB page directly

```bash
node session_scraper.js "https://auladigital.sence.cl/mod/bigbluebuttonbn/view.php?id=XXXX"
```

**Output:** `scraped_data/{Module_Name}/session_modulename.json`

**Features:**

- Automatic session persistence (saves/loads cookies)
- Deduplicates module links

### Step 3: Scrape Playback (Get Video Sources)

Processes all session data files to extract actual video/audio URLs.

```bash
node playback_scraper.js
```

**Output:** `scraped_data/{Module_Name}/playback_data_TIMESTAMP.json`

### Step 4: Download Videos

Downloads the video and audio files with date-based filenames.

```bash
node download_videos.js
```

**Output:** `downloaded_videos/{Module_Name}/`

### Step 5: Merge Videos

Merges video and audio tracks into a final Picture-in-Picture MP4.

```bash
node merge_videos.js
```

**Output:** `merged_videos/{Module_Name}/`

**Note:** All outputs are organized by the `BBB_FILTER` value (e.g., "Módulo 2" → `Modulo_2/` folder)

## Folder Structure

When using `BBB_FILTER="Módulo 2"`, the output structure is:

```
scraped_data/
  └── Modulo_2/
      ├── session_modulo_2.json
      └── playback_data_TIMESTAMP.json
downloaded_videos/
  └── Modulo_2/
      ├── 202601051750_webcams.webm
      └── 202601051750_deskshare.webm
merged_videos/
  └── Modulo_2/
      └── 202601051750_merged.mp4
```

## Session Persistence

Cookies are automatically saved to `session_cookies.json` after login. Subsequent runs will reuse the session, eliminating the need for repeated authentication.

## Debugging

Pass `--debug` to any scraper script to generate screenshots and HTML dumps on error:

```bash
node session_scraper.js --debug
```

## Visual Indicators

All scripts use emoji indicators for quick visual feedback:

- ✓ Success
- ✗ Error
- ⚠ Warning
- ⏭ Skipped
- ⬇ Downloading
- 🎬 Merging

## Python Scripts

Python scripts are available in `python_code/` with full feature parity to Node.js scripts.

### Installation

```bash
cd python_code
pip install -r requirements.txt
```

### Features

- **Auto-login**: Automatic ClaveÚnica authentication via `.env`
- **Session Persistence**: Cookie-based session reuse
- **Module Organization**: Same folder structure as Node.js
- **URL Timestamps**: Locale-independent filename generation

### Usage

All Python scripts use the same `.env` configuration and workflow as Node.js:

```bash
# Scrape home page
python python_code/home_scraper.py

# Scrape sessions
python python_code/session_scraper.py

# Scrape playback
python python_code/playback_scraper.py

# Download videos
python python_code/download_videos.py

# Merge videos
python python_code/merge_videos.py
```

**Output Structure:** Same as Node.js - organized by `BBB_FILTER` into `scraped_data/{module}/`, `downloaded_videos/{module}/`, and `merged_videos/{module}/`

## Technology Stack

- **Node.js**: Puppeteer for web automation
- **Python**: Selenium WebDriver for alternative implementation
- **FFmpeg**: Video processing and merging
- **dotenv**: Environment configuration management
