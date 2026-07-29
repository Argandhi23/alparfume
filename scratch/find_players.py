import os
import shutil
import glob

brain_dir = r"C:\Users\argan\.gemini\antigravity\brain"
dest_dir = r"c:\Projects\alparfume\public\images\players"
os.makedirs(dest_dir, exist_ok=True)

# Find all media__* files in any subdirectory of brain_dir
pattern = os.path.join(brain_dir, "**", "media__*")
files = glob.glob(pattern, recursive=True)

print(f"Found {len(files)} media files in brain directory:")
for f in files:
    size = os.path.getsize(f)
    print(f"- {f} ({size} bytes)")
    
    # Let's copy it to dest_dir with its original name
    basename = os.path.basename(f)
    dest_file = os.path.join(dest_dir, basename)
    try:
        shutil.copy2(f, dest_file)
        print(f"  Copied to {dest_file}")
    except Exception as e:
        print(f"  Failed to copy: {e}")
