# SENCE Aula Digital Scraper

A web scraping and video processing pipeline for SENCE Aula Digital (BigBlueButton recordings).

## Features

- **Automated Scraping**: Full auto-login support (ClaveÚnica) via `.env` credentials.
- **Batch Processing**: Filter and scrape multiple modules automatically.
- **Downloading**: Downloads videos with date-based filenames.
- **Processing**: Merges webcam and deskshare videos into a single Picture-in-Picture (PiP) MP4 file using FFmpeg.

## Prerequisites

- **Node.js**: Node 18+ (Required for main scripts).
- **FFmpeg**: Required for video merging.
- **Python 3.7+**: (Optional legacy support).

## 🚀 Usage (JavaScript)

### 1. Setup

1.  Install dependencies:
    ```bash
    npm install
    # Installs puppeteer, fs-extra, dotenv, etc.
    ```
2.  Configure `.env` file:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` with your ClaveÚnica credentials:
    ```ini
    RUN=12345678-9
    PASSWORD=yourpassword
    COURSE_HOME_URL=https://auladigital.sence.cl/...
    BBB_FILTER="Módulo 4"  # Optional: Filter specific modules
    ```

### 2. Workflow

Run the scripts in the following order:

#### Step 1: Scrape Home (Get Module List)

Extracts all available BBB modules from the course home page.

```bash
node home_scraper.js
```

_Output: `bbb_modules.json`_

#### Step 2: Scrape Sessions (Get Recording Links)

Iterates through modules and extracts recording links.

- **Batch Mode (Recommended):** Scrapes modules matches `BBB_FILTER` in `.env`.

  ```bash
  node session_scraper.js
  ```

  _Output: `session_data_X_modulename.json`_

- **Single URL Mode:** Scrape a specific BBB page directly.
  ```bash
  node session_scraper.js "https://auladigital.sence.cl/mod/bigbluebuttonbn/view.php?id=XXXX"
  ```

#### Step 3: Scrape Playback (Get Video Sources)

Processes all session data files to extract actual video/audio URLs.

```bash
node playback_scraper.js
```

_Output: `playback_data_TIMESTAMP.json`_

#### Step 4: Download Videos

Downloads the video and audio files.

```bash
node download_videos.js
```

_Downloads to: `downloaded_videos/`_

#### Step 5: Merge Videos

Merges video and audio tracks into a final MP4.

```bash
node merge_videos.js
```

_Output: `merged_videos/`_

## Debugging

- Pass `--debug` to any scraper script to generate screenshots and HTML dumps on error.
  ```bash
  node session_scraper.js --debug
  ```

---

## 🐍 Python Usage (Legacy)

Legacy Python scripts are available in `python_code/` but do not support the new auto-login features.

```bash
python python_code/session_scraper.py
```
