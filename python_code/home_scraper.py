
import time
import json
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

def scrape_sence_home(initial_url):
    driver = setup_driver()
    
    try:
        print(f"1. Initial Navigation: {initial_url}")
        driver.get(initial_url)
        
        # --- MANUAL LOGIN STEP ---
        print("\n" + "="*60)
        print("IMPORTANT: PLEASE LOG IN MANUALLY IN THE BROWSER WINDOW.")
        print("Navigate through the ClaveÚnica process if required.")
        print("Wait until you are fully logged in and see a Course page or Dashboard.")
        print("DO NOT CLOSE THE BROWSER WINDOW. THE SCRIPT NEEDS IT TO CONTINUE.")
        print("="*60 + "\n")
        
        input("Press ENTER here ONLY after you have successfully logged in...")
        
        # --- PART A: Scrape Course Home (Current Page after Login) ---
        current_url = driver.current_url
        print(f"\n2. Scraping Current Page (Course Home): {current_url}")
        
        # This explicitly saves just the Course Home data
        data = {
            "course_home": {
                "url": current_url,
                "title": driver.title,
                "content_links": []
            } # No BBB data here
        }
        
        try:
            links = driver.find_elements(By.TAG_NAME, "a")
            for link in links:
                href = link.get_attribute("href")
                text = link.text.strip()
                if href and text:
                     data["course_home"]["content_links"].append({"text": text, "link": href})
            
            print(f"   -> Found {len(data['course_home']['content_links'])} links on course home.")
            
        except Exception as e:
            print(f"   -> Error scraping course home: {e}")

        # --- PART B: BigBlueButton Scraping ---
        # SKIPPED: This script only scrapes the course home.
        # Use final_scraper.py for BBB data.

        print(f"\nScrape complete.")
        
        # 3. Save Data
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        filename = f"sence_home_data_{timestamp}.json"
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        print(f"Data saved to {filename}")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        
    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    # The URL to start the login flow (can be anything that triggers login)
    # The user mentioned the redirect goes to course/view.php?id=5967, but we can start anywhere
    TARGET_URL = "https://auladigital.sence.cl/mod/bigbluebuttonbn/view.php?id=748489"
    scrape_sence_home(TARGET_URL)
