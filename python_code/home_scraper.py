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

def setup_driver():
    """Set up Chrome WebDriver"""
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def scrape_home(driver, base_url):
    """Scrape BigBlueButton modules from home page"""
    print(f"\nNavigating to: {base_url}")
    driver.get(base_url)
    time.sleep(3)
    
    print(f"Scraping: {driver.title}")
    modules = []
    
    try:
        # Find all BBB module links
        links = driver.find_elements(By.CSS_SELECTOR, "a[href*='mod/bigbluebuttonbn']")
        
        print(f"   -> Found {len(links)} BBB modules")
        
        for link in links:
            try:
                module_name = link.text.strip()
                module_url = link.get_attribute("href")
                
                if module_name and module_url:
                    modules.append({
                        "name": module_name,
                        "url": module_url
                    })
                    print(f"   ✓ {module_name}")
                    
            except Exception as e:
                print(f"   ✗ Error processing link: {e}")
                continue
        
    except Exception as e:
        print(f"   ✗ Error finding modules: {e}")
    
    return modules

def main():
    """Main function"""
    print("Starting SENCE Home Scraper (Python)...")
    
    # Get home URL from environment
    home_url = os.getenv('HOME_URL', 'https://auladigital.sence.cl/my/')
    
    driver = setup_driver()
    
    try:
        # Navigate to home URL
        driver.get(home_url)
        time.sleep(2)
        
        # Attempt auto-login
        if not auth.auto_login(driver):
            print("\n" + "="*60)
            print("Auto-login failed or no credentials provided.")
            print("Please log in manually in the browser window.")
            print("Press ENTER after you have successfully logged in...")
            print("="*60 + "\n")
            input()
        
        # Scrape modules
        modules = scrape_home(driver, home_url)
        
        # Save data
        filename = "bbb_modules.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(modules, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Saved {len(modules)} modules to {filename}")
        
    except Exception as e:
        print(f"\n✗ An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\nClosing browser...")
        driver.quit()

if __name__ == "__main__":
    main()
