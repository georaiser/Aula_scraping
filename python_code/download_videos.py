
import json
import os
import re
import datetime
import subprocess
import glob

def parse_date_from_name(name_str):
    # Search for pattern: "Mon, 5 Jan 2026, 5:50 PM"
    # Regex: [DayName], [Day] [Month] [Year], [Time] [AM/PM]
    # Example match: Mon, 5 Jan 2026, 5:50 PM
    
    # We look for the date part specifically
    match = re.search(r"(\w{3}, \d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} [AP]M)", name_str)
    if match:
        date_str = match.group(1)
        try:
            # Parse format: "Mon, 5 Jan 2026, 5:50 PM"
            dt = datetime.datetime.strptime(date_str, "%a, %d %b %Y, %I:%M %p")
            # Format to: 202601051750
            return dt.strftime("%Y%m%d%H%M")
        except ValueError as e:
            print(f"Error parsing date '{date_str}': {e}")
            return None
    return None

def download_videos():
    # 1. Find latest playback_data file
    files = glob.glob("playback_data_*.json")
    if not files:
        print("No playback_data_*.json files found.")
        return
    
    # Get latest file
    latest_file = max(files, key=os.path.getctime)
    print(f"Propcessing file: {latest_file}")
    
    with open(latest_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # Create downloads directory
    output_dir = "downloaded_videos"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    print(f"Found {len(data)} recordings.")
    
    for item in data:
        name = item.get("name", "")
        # Parse date
        file_prefix = parse_date_from_name(name)
        
        if not file_prefix:
            print(f"Skipping: Could not parse date from '{name[:30]}...'")
            continue
            
        videos = item.get("scraped_content", {}).get("videos", [])
        
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
                print(f"Skipping {filename} (already exists)")
                continue
                
            print(f"Downloading {filename}...")
            try:
                # Using wget
                subprocess.run(
                    ["wget", "-q", "--show-progress", "-O", output_path, video_url],
                    check=True
                )
            except subprocess.CalledProcessError as e:
                print(f"Failed to download {video_url}: {e}")
            except FileNotFoundError:
                print("Error: 'wget' not found. Please install wget or use a different method.")
                return

    print(f"\nAll downloads processed. Check '{output_dir}' folder.")

if __name__ == "__main__":
    download_videos()
