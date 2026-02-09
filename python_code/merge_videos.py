import os
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

def merge_with_ffmpeg(desk_file, webcam_file, output_file):
    """Merge webcam and deskshare videos using FFmpeg"""
    print(f"⚙ Merging: {os.path.basename(output_file)}...")
    
    try:
        # FFmpeg command to merge side-by-side
        cmd = [
            "ffmpeg",
            "-i", desk_file,
            "-i", webcam_file,
            "-filter_complex",
            "[0:v]scale=iw/2:ih[left];[1:v]scale=iw/2:ih[right];[left][right]hstack",
            "-c:v", "libvpx",
            "-b:v", "1M",
            "-c:a", "libvorbis",
            "-y",  # Overwrite output file
            output_file
        ]
        
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"  ✓")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ✗ FFmpeg error: {e.stderr.decode()[:200]}")
        return False
    except FileNotFoundError:
        print("  ✗ FFmpeg not found. Please install ffmpeg.")
        return False

def merge_videos():
    """Merge downloaded videos"""
    print("Starting SENCE Video Merger (Python)...\n")
    
    # Get filter from environment
    bbb_filter = os.getenv('BBB_FILTER', '')
    
    # Determine directories
    if bbb_filter:
        safe_name = sanitize_filter_name(bbb_filter)
        input_dir = f"downloaded_videos/{safe_name}"
        output_dir = f"merged_videos/{safe_name}"
    else:
        input_dir = "downloaded_videos"
        output_dir = "merged_videos"
    
    # Check if input directory exists
    if not os.path.exists(input_dir):
        print(f"Input directory not found: {input_dir}")
        return
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Input: {input_dir}")
    print(f"Output: {output_dir}\n")
    
    # Find all deskshare files
    deskshare_files = glob.glob(f"{input_dir}/*_deskshare.webm")
    
    if not deskshare_files:
        print("No deskshare videos found to merge.")
        return
    
    print(f"Found {len(deskshare_files)} video pairs to merge\n")
    
    merged_count = 0
    skipped_count = 0
    
    for desk_file in deskshare_files:
        # Get corresponding webcam file
        prefix = os.path.basename(desk_file).replace('_deskshare.webm', '')
        webcam_file = os.path.join(input_dir, f"{prefix}_webcams.webm")
        output_file = os.path.join(output_dir, f"{prefix}_merged.webm")
        
        # Check if webcam file exists
        if not os.path.exists(webcam_file):
            print(f"⚠ Skipping {prefix} - webcam file not found")
            skipped_count += 1
            continue
        
        # Check if already merged
        if os.path.exists(output_file):
            print(f"⏭ {prefix}_merged.webm (already exists)")
            skipped_count += 1
            continue
        
        # Merge
        if merge_with_ffmpeg(desk_file, webcam_file, output_file):
            merged_count += 1
    
    print(f"\n✓ Merged {merged_count} videos")
    if skipped_count > 0:
        print(f"  Skipped {skipped_count} videos")
    print(f"\nCheck '{output_dir}' folder")

if __name__ == "__main__":
    merge_videos()
