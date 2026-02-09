# SENCE Aula Digital Scraper

A web scraping and video processing pipeline for SENCE Aula Digital (BigBlueButton recordings).

## Features

- **Scraping**: Extracts recording links and detailed video content (webcam/deskshare).
- **Downloading**: Downloads videos with date-based filenames (e.g., `202601051750_webcams.webm`).
- **Processing**: Merges webcam and deskshare videos into a single Picture-in-Picture (PiP) MP4 file using FFmpeg.
- **Dual Support**: Available in **Python** and **JavaScript (Node.js)**.

## Prerequisites

- **FFmpeg**: Required for video merging (`merge_videos`).
- **Python Version**: Python 3.7+ (for Python scripts).
- **Node.js**: Node 18+ (for JS version).

---

## 🐍 Python Usage

Python scripts are located in the `pyhon_code/` directory.

### Setup

1.  Install dependencies:
    ```bash
    pip install selenium requests
    # Ensure ffmpeg is installed on your system
    ```
2.  (Optional) Create a virtual environment.

### Workflow

Run scripts in order (from project root):

1.  **Get Recording List** (Manual Login required):

    ```bash
    python pyhon_code/session_scraper.py
    ```

    _Output: `session_data.json`_

2.  **Get Video Details** (Manual Login required once):

    ```bash
    python pyhon_code/playback_scraper.py
    ```

    _Output: `playback_data_TIMESTAMP.json`_

3.  **Download Videos**:

    ```bash
    python pyhon_code/download_videos.py
    ```

    _Output: `downloaded_videos/` folder_

4.  **Merge & Optimize Videos** (H.264 MP4):
    ```bash
    python pyhon_code/merge_videos.py
    ```
    _Output: `merged_videos/` folder_

---

## 🚀 JavaScript Usage (Node.js)

JavaScript scripts are located in the **root** directory.

### Setup

1.  Install dependencies:
    ```bash
    npm install
    # Installs puppeteer, axios, fs-extra, etc.
    ```

### Workflow

Run scripts in order:

1.  **Get Recording List**:

    ```bash
    node session_scraper.js
    ```

2.  **Get Video Details**:

    ```bash
    node playback_scraper.js
    ```

3.  **Download Videos**:

    ```bash
    node download_videos.js
    ```

4.  **Merge & Optimize Videos**:
    ```bash
    node merge_videos.js
    ```

---

## Notes

- **Authentication**: Scripts use a manual login flow. A browser window will open; log in via ClaveÚnica, then press ENTER in the terminal to continue.
- **Do Not Close Browser**: The browser must remain open during scraping.
- **Merging**: `merge_videos` creates a **new** MP4 file in `merged_videos/` and does not delete the originals.
