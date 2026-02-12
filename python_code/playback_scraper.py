import os
import time
import json
import glob
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import auth

# Load environment variables
load_dotenv()

def sanitize_filter_name(filter_name):
    """Sanitize filter name for use in filenames and directories"""
    import unicodedata
    normalized = unicodedata.normalize('NFD', filter_name)
    without_accents = ''.join(char for char in normalized if unicodedata.category(char) != 'Mn')
    sanitized = ''.join(c if c.isalnum() else '_' for c in without_accents).lower()
    return sanitized

def setup_driver():
    """Set up Chrome WebDriver"""
    options = Options()
    options.add_argument("--headless")  # Run headless for playback scraping
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def scrape_playback(driver, playback_url):
    """Scrape video URLs from playback page"""
    print(f"   Scraping playback: {playback_url[:60]}...")
    
    try:
        driver.get(playback_url)
        time.sleep(5)  # Wait for page to load
        
        # Find video elements
        videos = []
        
        # Try finding video elements by source tags
        video_elements = driver.find_elements(By.TAG_NAME, "video")
        for video in video_elements:
            sources = video.find_elements(By.TAG_NAME, "source")
            for source in sources:
                src = source.get_attribute("src")
                if src and src.endswith('.webm'):
                    videos.append(src)
        
        # Also check for direct links to videos
        links = driver.find_elements(By.TAG_NAME, "a")
        for link in links:
            href = link.get_attribute("href")
            if href and ('.webm' in href or 'video' in href):
                if href not in videos:
                    videos.append(href)
        
        return list(set(videos))  # Remove duplicates
        
    except Exception as e:
        print(f"   ✗ Error scraping playback: {e}")
        return []

def load_recordings(bbb_filter=''):
    """Load recordings from session data"""
    # Determine search directory
    if bbb_filter:
        safe_name = sanitize_filter_name(bbb_filter)
        search_dir = f"scraped_data/{safe_name}"
    else:
        search_dir = "scraped_data"
    
    # Find session files
    session_files = glob.glob(f"{search_dir}/session_*.json")
    if not session_files:
        print(f"No session files found in {search_dir}")
        return []
    
    # Load the most recent session file
    latest_file = max(session_files, key=os.path.getctime)
    print(f"Loading: {latest_file}")
    
    with open(latest_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_existing_playback_data(search_dir):
    """Load existing playback data to avoid re-scraping"""
    try:
        if not os.path.exists(search_dir):
            return {}
        
        # Find all playback files
        playback_files = glob.glob(f"{search_dir}/playback_data_*.json")
        if not playback_files:
            return {}
        
        # Sort by modification time (newest first)
        playback_files.sort(key=os.path.getctime, reverse=True)
        
        latest_file = playback_files[0]
        print(f"Loading existing data from: {latest_file}")
        
        with open(latest_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Map playback_link -> data
        existing_map = {}
        for item in data:
            if 'playback_link' in item and 'scraped_content' in item:
                existing_map[item['playback_link']] = item
        
        print(f"✓ Loaded {len(existing_map)} existing recordings")
        return existing_map
        
    except Exception as e:
        print(f"⚠ Could not load existing data: {e}")
        return {}

def main():
    """Main function"""
    print("Starting SENCE Playback Scraper (Python)...\n")
    
    # Get filter from environment
    bbb_filter = os.getenv('BBB_FILTER', '')
    
    # Determine directories
    if bbb_filter:
        safe_name = sanitize_filter_name(bbb_filter)
        output_dir = f"scraped_data/{safe_name}"
    else:
        output_dir = "scraped_data"
        
    # Load recordings to process
    recordings = load_recordings(bbb_filter)
    if not recordings:
        print("No recordings to process.")
        return
    
    # Load existing data
    existing_map = load_existing_playback_data(output_dir)
    
    # Identify new recordings
    new_recordings = [r for r in recordings if r['playback_link'] not in existing_map]
    print(f"\nStatus: {len(existing_map)} existing, {len(new_recordings)} new\n")
    
    # Setup driver only if needed
    if new_recordings:
        driver = setup_driver()
        print("Browser started for scraping new recordings...")
    else:
        driver = None
        print("No new recordings to scrape.")
    
    try:
        enriched_data = []
        
        for i, recording in enumerate(recordings, 1):
            print(f"[{i}/{len(recordings)}] {recording.get('name', 'Unknown')[:60]}...")
            playback_link = recording.get('playback_link', '')
            
            # Check existing
            if playback_link in existing_map:
                print("   ✓ Using cached data")
                enriched_data.append(existing_map[playback_link])
                continue
            
            # Scrape new
            if not playback_link:
                print("   ⚠ No playback link")
                continue
                
            videos = scrape_playback(driver, playback_link)
            
            if videos:
                print(f"   ✓ Found {len(videos)} video(s) (Scraped)")
                enriched_data.append({
                    "name": recording['name'],
                    "playback_link": playback_link,
                    "scraped_content": {
                        "videos": videos
                    }
                })
            else:
                print("   ⚠ No videos found")

        # Save results
        os.makedirs(output_dir, exist_ok=True)
        
        timestamp = time.strftime("%Y-%m-%dT%H-%M-%S")
        filename = f"{output_dir}/playback_data_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(enriched_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Saved {len(enriched_data)} results to {filename}")
        
    except Exception as e:
        print(f"\n✗ An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            print("\nClosing browser...")
            driver.quit()

if __name__ == "__main__":
    main()
