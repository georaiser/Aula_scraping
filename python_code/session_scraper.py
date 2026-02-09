
import time
import json
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

def setup_driver():
    """Sets up the Chrome WebDriver."""
    options = Options()
    # options.add_argument("--headless")  # Commented out to allow manual login
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    # Initialize WebDriver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def scrape_sence_final(bbb_url):
    driver = setup_driver()
    
    try:
        print(f"1. Initial Navigation to BBB URL: {bbb_url}")
        driver.get(bbb_url)
        
        # --- MANUAL LOGIN STEP ---
        print("\n" + "="*60)
        print("IMPORTANT: PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW.")
        print("Navigate through the ClaveÚnica process if required.")
        print("Wait until you are fully logged in and see a Course page or Dashboard.")
        print("DO NOT CLOSE THE BROWSER WINDOW. THE SCRIPT NEEDS IT TO CONTINUE.")
        print("="*60 + "\n")
        
        input("Press ENTER here ONLY after you have successfully logged in...")
        
        data = {
            "course_home": {},
            "bbb_session": {}
        }

        # --- PART A: Scrape Course Home ---
        # SKIPPED as per user request to "not scrape this"
        # The user only wants the BigBlueButton data after forced navigation.


        # --- PART B: Force Navigate to Target BBB Page ---
        print(f"\n3. Force Navigating to Target BBB Page: {bbb_url}")
        driver.get(bbb_url)
        time.sleep(5) # Wait for table to load
        
        print(f"4. Scraping BigBlueButton Session Page: {driver.title}")
        bbb_data = {
            "url": driver.current_url,
            "title": driver.title,
            "recordings": []
        }
        
        try:
            # Strategies to find the recordings table
            # 1. ID: bigbluebuttonbn_recordings_table
            # 2. Class: generaltable
            recording_rows = driver.find_elements(By.CSS_SELECTOR, "#bigbluebuttonbn_recordings_table tbody tr")
            if not recording_rows:
                 print("   -> 'bigbluebuttonbn_recordings_table' not found. Trying '.generaltable'...")
                 recording_rows = driver.find_elements(By.CSS_SELECTOR, ".generaltable tbody tr")
            
            print(f"   -> Found {len(recording_rows)} rows in the table.")
            
            # DEBUG: Print first row HTML to understand structure if rows found
            if recording_rows:
                print("   -> DEBUG: First row HTML structure:")
                print(recording_rows[0].get_attribute('outerHTML')[:500] + "...") # Print first 500 chars

            for row in recording_rows:
                row_text = row.text.strip()
                
                # Find ALL links in the row
                links = row.find_elements(By.TAG_NAME, "a")
                
                # Check if this row has a relevant link
                found_recording = False
                
                for l in links:
                    href = l.get_attribute("href")
                    # Check for data-href which is often used in BBB Moodle integrations
                    data_href = l.get_attribute("data-href")
                    
                    real_link = data_href if data_href else href
                    link_text = l.text.strip()
                    
                    # Heuristic: 'playback', 'presentation', 'video', 'screenshare'
                    # OR if the button has class 'btn-primary' (common for play buttons)
                    class_attr = l.get_attribute("class")
                    
                    # Check if it looks like a recording link
                    is_recording_link = False
                    if real_link:
                        if "playback" in real_link or "recording" in real_link:
                            is_recording_link = True
                        elif "presentation" in real_link or "btn-primary" in class_attr:
                            is_recording_link = True
                        elif data_href: # If it has data-href, it's very likely a recording link
                            is_recording_link = True
                            
                    if is_recording_link and real_link != "#":
                        bbb_data["recordings"].append({
                            "name": row_text, # Full row text as name
                            "type": link_text, # Button text usually (e.g. "Presentation")
                            "playback_link": real_link
                        })
                        found_recording = True
                        # We might want to capture multiple links per row (e.g. video + stats), so don't break
                
                # Fallback: If we didn't find a "known" recording link but there ARE links, capture them
                if not found_recording and links:
                    for l in links:
                        href = l.get_attribute("href")
                        data_href = l.get_attribute("data-href")
                        real_link = data_href if data_href else href
                        
                        if real_link and real_link != "#":
                            bbb_data["recordings"].append({
                                "name": row_text + " (Generic Link)",
                                "type": l.text.strip(),
                                "playback_link": real_link
                            })

        except Exception as e:
            print(f"   -> Error extracting recordings table: {e}")

        data["bbb_session"] = bbb_data
        print(f"   -> Extracted {len(bbb_data['recordings'])} recording entries.")

        print(f"\nScrape complete.")
        
        # 3. Save Data
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        # Standardized filename for easier pipeline usage
        filename = "session_data.json" 
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        print(f"Data saved to {filename}")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        
    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    TARGET_URL = "https://auladigital.sence.cl/mod/bigbluebuttonbn/view.php?id=748489"
    # Ensure correct function name is called (if renaming logic changed it, but here it's fine)
    scrape_sence_final(TARGET_URL)
