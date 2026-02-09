import os
import json
import re
import datetime
import subprocess
import glob
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def sanitize_filter_name(filter_name):
    """Sanitize filter name for use in filenames and directories"""
    import unicodedata
    normalized = unicodedata.normalize('NFD', filter_name)
    without_accents = ''.join(char for char in normalized if unicodedata.category(char) != 'Mn')
    sanitized = ''.join(c if c.isalnum() else '_' for c in without_accents).lower()
    return sanitized

def extract_timestamp_from_url(video_url):
    """Extract timestamp from video URL and convert to YYYYMMDDHHMM"""
    # Video URLs contain timestamp: .../presentation/hash-TIMESTAMP/video/webcams.webm
    # Example: .../86cbb5c36361c9471658fc29134a603ab1b0ad30-1767646200903/video/
    match = re.search(r'-(\d{13})/', video_url)
    if not match:
        return None
    
    try:
        timestamp = int(match.group(1))
        dt = datetime.datetime.fromtimestamp(timestamp / 1000)  # Convert from milliseconds
        return dt.strftime("%Y%m%d%H%M")
    except:
        return None

def download_videos():
    """Download videos from playback data"""
    print("Starting SENCE Video Downloader (Python)...\n")
    
    # Get filter from environment
    bbb_filter = os.getenv('BBB_FILTER', '')
    
    # Find playback data files
    if bbb_filter:
        safe_name = sanitize_filter_name(bbb_filter)
        search_pattern = f"scraped_data/{safe_name}/playback_data_*.json"
        output_dir = f"downloaded_videos/{safe_name}"
    else:
        search_pattern = "scraped_data/playback_data_*.json"
        output_dir = "downloaded_videos"
    
    files = glob.glob(search_pattern)
    if not files:
        print(f"No playback data files found matching: {search_pattern}")
        return
    
    # Get latest file
    latest_file = max(files, key=os.path.getctime)
    print(f"Processing: {latest_file}")
    
    with open(latest_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Create downloads directory
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Found {len(data)} recordings\n")
    print(f"Output: {output_dir}\n")
    
    for item in data:
        name = item.get("name", "")
        videos = item.get("scraped_content", {}).get("videos", [])
        
        if not videos:
            print(f"⚠ Skipping: No videos for '{name}'")
            continue
        
        # Extract timestamp from first video URL
        file_prefix = extract_timestamp_from_url(videos[0])
        
        if not file_prefix:
            print(f"⚠ Skipping: Could not extract timestamp from URL for '{name}'")
            continue
        
        for video_url in videos:
            # Determine suffix (webcams vs deskshare)
            if "webcams" in video_url:
                suffix = "webcams"
            elif "deskshare" in video_url:
                suffix = "deskshare"
            else:
                suffix = "video"
            
            # Construct filename
            filename = f"{file_prefix}_{suffix}.webm"
            output_path = os.path.join(output_dir, filename)
            
            # Download using wget
            if os.path.exists(output_path):
                print(f"⏭ {filename} (already exists)")
                continue
            
            print(f"⬇ {filename}...")
            try:
                subprocess.run(
                    ["wget", "-q", "--show-progress", "-O", output_path, video_url],
                    check=True
                )
                print(f"  ✓")
            except subprocess.CalledProcessError as e:
                print(f"  ✗ Failed to download: {e}")
            except FileNotFoundError:
                print("  ✗ 'wget' not found. Please install wget.")
                return
    
    print(f"\n✓ Complete. Check '{output_dir}'")

if __name__ == "__main__":
    download_videos()
