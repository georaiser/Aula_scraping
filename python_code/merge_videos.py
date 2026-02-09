
import os
import glob
import subprocess

def merge_videos():
    # 1. Scan for files
    input_dir = "downloaded_videos"
    output_dir = "merged_videos"
    
    if not os.path.exists(input_dir):
        print(f"Error: Directory '{input_dir}' not found. Please run download_videos.py first.")
        return
        
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    # Find all deskshare files as the base
    deskshare_files = glob.glob(os.path.join(input_dir, "*_deskshare.webm"))
    
    print(f"Found {len(deskshare_files)} recording sets.")
    
    for desk_file in deskshare_files:
        # Construct corresponding webcam filename
        # Pattern: 202601051750_deskshare.webm -> 202601051750_webcams.webm
        base_name = os.path.basename(desk_file)
        prefix = base_name.replace("_deskshare.webm", "")
        
        webcam_file = os.path.join(input_dir, f"{prefix}_webcams.webm")
        output_file = os.path.join(output_dir, f"{prefix}_merged.mp4")
        
        if not os.path.exists(webcam_file):
            print(f"Skipping {prefix}: Webcam file not found.")
            continue
        
        if os.path.exists(output_file):
            print(f"Skipping {prefix}: Output already exists.")
            continue
            
        print(f"Merging {prefix} (Optimized)...")
        
        # FFmpeg Command
        # 1. Output as MP4 (H.264 is faster on CPU than VP9)
        # 2. Preset 'fast' or 'faster' speeds up encoding significantly
        # 3. CRF 28 reduces file size (default is 23, higher is smaller)
        # 4. Scale output to 1280:-2 (720p) to reduce processing pixels
        
        cmd = [
            "ffmpeg",
            "-v", "quiet", "-stats",
            "-i", desk_file, # 0
            "-i", webcam_file, # 1
            # Filter: 
            #  - Scale webcam to 1/5 width
            #  - Overlay bottom-right
            #  - Scale ENTIRE output to 1280 width (720p) for speed/size
            "-filter_complex", "[1]scale=iw/5:-1[pip];[0][pip]overlay=main_w-overlay_w-20:main_h-overlay_h-20[merged];[merged]scale=1280:-2",
            "-map", "1:a", # Use audio from webcam
            "-c:v", "libx264", # H.264 is faster
            "-preset", "fast", # Speed up encoding
            "-crf", "28", # Smaller size (quality trade-off, 18-28 is good range)
            "-c:a", "aac", # Standard audio for MP4
            output_file
        ]
        
        try:
            subprocess.run(cmd, check=True)
            print(f"Success: {output_file}")
        except subprocess.CalledProcessError as e:
            print(f"Error merging {prefix}: {e}")
            
    print(f"\nMerge complete. Check '{output_dir}' folder.")

if __name__ == "__main__":
    merge_videos()
