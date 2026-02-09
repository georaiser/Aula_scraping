
import time
import json
import urllib.parse
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

def setup_driver():
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def extract_real_url(wrapper_url):
    """Extracts the 'href' parameter from the Moodle wrapper URL."""
    try:
        parsed = urllib.parse.urlparse(wrapper_url)
        params = urllib.parse.parse_qs(parsed.query)
        if 'href' in params:
            return params['href'][0]
    except:
        pass
    return wrapper_url

def scrape_playback_content():
    # 1. Load Session Data
    input_filename = "session_data.json" 
    if not os.path.exists(input_filename):
        print(f"Error: {input_filename} not found. Please run session_scraper.py first.")
        return

    with open(input_filename, "r", encoding="utf-8") as f:
        session_data = json.load(f)

    recordings = session_data.get("bbb_session", {}).get("recordings", [])
    if not recordings:
        print("No recordings found in session_data.json.")
        return

    print(f"Loaded {len(recordings)} recordings from {input_filename}")

    # 2. Setup Driver
    driver = setup_driver()
    
    try:
        # 3. Manual Login (Perform once)
        # Use a generic URL or the first recording link to trigger login
        first_url = extract_real_url(recordings[0]["playback_link"])
        print("\n" + "="*60)
        print("INITIAL NAVIGATION & LOGIN")
        print(f"Navigating to first link to trigger login: {first_url}")
        driver.get(first_url)
        
        print("\nIMPORTANT: PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW.")
        print("Navigate through the ClaveÚnica process if required.")
        print("Wait until you are fully logged in.")
        print("="*60 + "\n")
        
        input("Press ENTER here ONLY after you have successfully logged in...")

        # 4. Iterate and Scrape
        enriched_data = []
        
        print(f"\nStarting scrape of {len(recordings)} recordings...")
        
        for i, rec in enumerate(recordings):
            original_link = rec.get("playback_link")
            name = rec.get("name", "Unknown")
            
            if not original_link or original_link == "#":
                print(f"[{i+1}/{len(recordings)}] Skipping invalid link for '{name}'")
                continue

            real_url = extract_real_url(original_link)
            print(f"[{i+1}/{len(recordings)}] Scaping: {name[:30]}...")
            
            try:
                driver.get(real_url)
                time.sleep(5) # Wait for player to load (videos/svgs)
                
                # Scrape Content
                videos = driver.find_elements(By.TAG_NAME, "video")
                audios = driver.find_elements(By.TAG_NAME, "audio")
                svgs = driver.find_elements(By.TAG_NAME, "svg")
                
                video_sources = [v.get_attribute('src') for v in videos if v.get_attribute('src')]
                audio_sources = [a.get_attribute('src') for a in audios if a.get_attribute('src')]
                
                # Enrich the record
                rec["real_playback_url"] = real_url
                rec["scraped_content"] = {
                    "videos": video_sources,
                    "audios": audio_sources,
                    "slide_count": len(svgs)
                }
                
                enriched_data.append(rec)
                print(f"    -> Found {len(video_sources)} videos, {len(audio_sources)} audios.")
                
            except Exception as e:
                print(f"    -> Error scraping {real_url}: {e}")
                rec["error"] = str(e)
                enriched_data.append(rec)

        # 5. Save Enriched Data
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        output_filename = f"playback_data_{timestamp}.json"
        
        with open(output_filename, "w", encoding="utf-8") as f:
            json.dump(enriched_data, f, indent=4, ensure_ascii=False)
            
        print(f"\nScrape complete. Data saved to {output_filename}")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    scrape_playback_content()
