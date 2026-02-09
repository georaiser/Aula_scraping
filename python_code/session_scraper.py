import os
import time
import json
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
    # Remove accents
    normalized = unicodedata.normalize('NFD', filter_name)
    without_accents = ''.join(char for char in normalized if unicodedata.category(char) != 'Mn')
    # Replace non-alphanumeric with underscore and lowercase
    sanitized = ''.join(c if c.isalnum() else '_' for c in without_accents).lower()
    return sanitized

def setup_driver():
    """Set up Chrome WebDriver"""
    options = Options()
    # options.add_argument("--headless")  # Uncomment for headless mode
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def scrape_recordings(driver, bbb_url):
    """Scrape BigBlueButton recordings from target URL"""
    print(f"\nNavigating to: {bbb_url}")
    driver.get(bbb_url)
    time.sleep(5)  # Wait for table to load
    
    print(f"Scraping: {driver.title}")
    recordings = []
    
    try:
        # Find recordings table
        recording_rows = driver.find_elements(By.CSS_SELECTOR, "#bigbluebuttonbn_recordings_table tbody tr")
        if not recording_rows:
            print("   -> 'bigbluebuttonbn_recordings_table' not found. Trying '.generaltable'...")
            recording_rows = driver.find_elements(By.CSS_SELECTOR, ".generaltable tbody tr")
        
        print(f"   -> Found {len(recording_rows)} recordings")
        
        for row in recording_rows:
            try:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) < 5:
                    continue
                
                # Get the recording name from column 1 (c1)
                name_text = cells[1].text.strip() if cells[1] else 'Recording'
                
                # Get the date from column 4 (c4)
                date_text = cells[4].text.strip() if cells[4] else ''
                
                # Combine: "Date - Name"
                full_name = f"{date_text} - {name_text}" if date_text else name_text
                
                # Extract playback link from data-href attribute
                links = row.find_elements(By.TAG_NAME, "a")
                playback_link = None
                
                for link in links:
                    # Check data-href attribute first
                    data_href = link.get_attribute("data-href")
                    if data_href and ('aulavirtual.sence.cl' in data_href or 'playback' in data_href):
                        playback_link = data_href
                        break
                    
                    # Fallback to href
                    href = link.get_attribute("href")
                    if href and ('aulavirtual.sence.cl' in href or 'playback' in href):
                        playback_link = href
                        break
                
                if playback_link:
                    recordings.append({
                        "name": full_name,
                        "playback_link": playback_link
                    })
                    print(f"   ✓ {full_name[:60]}...")
                    
            except Exception as e:
                print(f"   ✗ Error processing row: {e}")
                continue
        
    except Exception as e:
        print(f"   ✗ Error extracting recordings: {e}")
    
    return recordings

def main():
    """Main function"""
    print("Starting SENCE Session Scraper (Python)...")
    
    # Get BBB URL and filter from environment
    bbb_url = os.getenv('BBB_URL', 'https://auladigital.sence.cl/mod/bigbluebuttonbn/view.php?id=748489')
    bbb_filter = os.getenv('BBB_FILTER', '')
    
    driver = setup_driver()
    
    try:
        # Navigate to BBB URL
        driver.get(bbb_url)
        time.sleep(2)
        
        # Attempt auto-login
        if not auth.auto_login(driver):
            print("\n" + "="*60)
            print("Auto-login failed or no credentials provided.")
            print("Please log in manually in the browser window.")
            print("Press ENTER after you have successfully logged in...")
            print("="*60 + "\n")
            input()
        
        # Scrape recordings
        recordings = scrape_recordings(driver, bbb_url)
        
        # Prepare output directory
        if bbb_filter:
            safe_name = sanitize_filter_name(bbb_filter)
            output_dir = f"scraped_data/{safe_name}"
            os.makedirs(output_dir, exist_ok=True)
            filename = f"{output_dir}/session_{safe_name}.json"
        else:
            output_dir = "scraped_data"
            os.makedirs(output_dir, exist_ok=True)
            filename = f"{output_dir}/session_data.json"
        
        # Save data
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(recordings, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Saved {len(recordings)} recordings to {filename}")
        
    except Exception as e:
        print(f"\n✗ An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\nClosing browser...")
        driver.quit()

if __name__ == "__main__":
    main()
