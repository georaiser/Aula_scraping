import os
import json
from dotenv import load_dotenv
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Load environment variables
load_dotenv()

COOKIE_FILE = 'session_cookies.json'

def save_session(driver):
    """Save session cookies to file"""
    try:
        cookies = driver.get_cookies()
        with open(COOKIE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cookies, f, indent=2)
        print(f"✓ Session saved to {COOKIE_FILE}")
    except Exception as e:
        print(f"✗ Failed to save session: {e}")

def load_session(driver):
    """Load session cookies from file"""
    if not os.path.exists(COOKIE_FILE):
        return False
    
    try:
        with open(COOKIE_FILE, 'r', encoding='utf-8') as f:
            cookies = json.load(f)
        
        if isinstance(cookies, list) and len(cookies) > 0:
            for cookie in cookies:
                driver.add_cookie(cookie)
            print(f"✓ Loaded {len(cookies)} session cookies")
            return True
    except Exception as e:
        print(f"✗ Failed to load session: {e}")
    
    return False

def is_logged_in(url):
    """Check if already logged in to SENCE"""
    return ('auladigital.sence.cl' in url and 
            'login' not in url and 
            'claveunica' not in url)

def handle_sence_landing(driver, run):
    """Handle SENCE landing page with RUT input"""
    try:
        rut_selector = 'input[placeholder*="Rut"], input[id*="rut"], input[name*="rut"]'
        rut_input = driver.find_element(By.CSS_SELECTOR, rut_selector)
        
        print("Found SENCE Landing Page")
        rut_input.send_keys(run)
        rut_input.submit()
        
        # Wait a bit for navigation
        import time
        time.sleep(2)
        
        # Try clicking Acceder button if present
        try:
            btns = driver.find_elements(By.XPATH, "//button[contains(translate(., 'ACDER', 'acder'), 'acceder')] | //button[@id='btnLogin']")
            if btns:
                btns[0].click()
                time.sleep(2)
        except:
            pass
            
    except:
        # Not on SENCE landing page
        pass

def handle_claveunica_login(driver, run, password):
    """Handle ClaveÚnica login page"""
    try:
        # Wait for ClaveÚnica form
        WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[name="run"], input[id="run"]'))
        )
        
        print("Found ClaveÚnica page")
        
        # Clear and fill credentials
        run_input = driver.find_element(By.CSS_SELECTOR, 'input[name="run"], input[id="run"]')
        run_input.clear()
        run_input.send_keys(run)
        
        pwd_input = driver.find_element(By.CSS_SELECTOR, 'input[name="password"], input[id="password"]')
        pwd_input.send_keys(password)
        
        # Wait a moment
        import time
        time.sleep(1)
        
        # Submit
        btn = driver.find_element(By.CSS_SELECTOR, 'button[type="submit"], input[type="submit"], #btn-submit, .btn-primary, #login-submit')
        btn.click()
        
        # Wait for redirect
        time.sleep(10)
        
        # Check success
        if 'claveunica.gob.cl' in driver.current_url:
            print("✗ Login failed - still on ClaveÚnica")
            return False
        
        print("✓ Login successful")
        save_session(driver)
        return True
        
    except Exception as e:
        # Not on ClaveÚnica or already logged in
        if is_logged_in(driver.current_url):
            save_session(driver)
            return True
        return False

def auto_login(driver):
    """Main auto-login function"""
    run = os.getenv('RUN', '').replace('.', '')
    password = os.getenv('PASSWORD', '')
    
    if not run or not password:
        return False
    
    print("Checking authentication...")
    
    # Try restoring session
    if load_session(driver):
        if driver.current_url and driver.current_url != 'about:blank':
            try:
                driver.refresh()
                import time
                time.sleep(3)
            except:
                print("⚠ Refresh timed out")
    
    # Check if already logged in
    if is_logged_in(driver.current_url):
        print("✓ Already logged in")
        return True
    
    print("Session expired - attempting login")
    
    try:
        # Step 1: SENCE Landing
        handle_sence_landing(driver, run)
        
        # Step 2: ClaveÚnica
        return handle_claveunica_login(driver, run, password)
        
    except Exception as e:
        print(f"✗ Auto-login failed: {e}")
        
        # Fallback: save session if somehow on target site
        if is_logged_in(driver.current_url):
            save_session(driver)
            return True
    
    return False
