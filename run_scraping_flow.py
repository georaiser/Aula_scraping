import subprocess
import time
import sys
import os

# Define the steps in order
STEPS = [
    {'script': 'python_code/session_scraper.py', 'desc': 'Scraping Session List'},
    {'script': 'python_code/playback_scraper.py', 'desc': 'Scraping Video Links'},
    {'script': 'python_code/download_videos.py', 'desc': 'Downloading Raw Videos'},
    {'script': 'python_code/merge_videos.py',    'desc': 'Merging into MP4'}
]

def run_step(step):
    """Run a single step"""
    print(f"\n🔹 [Step] {step['desc']}...")
    
    try:
        # Use python3 explicit command or just python depending on env
        # We assume 'python' is the correct interpreter here
        cmd = ["python", step['script']]
        
        # Check if script exists relative to current dir
        if not os.path.exists(step['script']):
            # Try without python_code/ prefix if we are inside it
            if os.path.exists(os.path.basename(step['script'])):
                cmd = ["python", os.path.basename(step['script'])]
            else:
                print(f"❌ Script not found: {step['script']}")
                return False
        
        result = subprocess.run(cmd, check=False)
        
        if result.returncode == 0:
            print(f"✅ [Step] {step['desc']} Completed")
            return True
        else:
            print(f"❌ [Step] {step['desc']} Failed (Exit Code: {result.returncode})")
            return False
            
    except Exception as e:
        print(f"❌ [Step] Error launching {step['script']}: {e}")
        return False

def main():
    print("🚀 Starting Full Scraping Pipeline (Python)")
    print("=========================================")
    
    start_time = time.time()
    
    try:
        for step in STEPS:
            if not run_step(step):
                print("\n⛔ Pipeline Stopped due to error.")
                sys.exit(1)
        
        duration = round(time.time() - start_time, 1)
        print("\n=========================================")
        print(f"🎉 Pipeline Completed Successfully in {duration}s!")
        print("=========================================")
        
    except KeyboardInterrupt:
        print("\n\n⛔ Pipeline stopped by user.")
        sys.exit(1)

if __name__ == "__main__":
    main()
