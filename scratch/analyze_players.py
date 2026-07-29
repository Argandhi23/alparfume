import os
import glob
from PIL import Image
import numpy as np

players_dir = r"c:\Projects\alparfume\public\images\players"
files = glob.glob(os.path.join(players_dir, "media__*"))

print(f"Analyzing {len(files)} player images:")
for f in sorted(files):
    try:
        img = Image.open(f)
        width, height = img.size
        # Check if transparent
        has_alpha = False
        if img.mode == 'RGBA':
            rgba = np.array(img)
            alpha_channel = rgba[:, :, 3]
            num_transparent = np.sum(alpha_channel < 255)
            if num_transparent > 0:
                has_alpha = True
        
        print(f"- {os.path.basename(f)}: mode={img.mode}, size={width}x{height}, transparent={has_alpha}")
    except Exception as e:
        print(f"- {os.path.basename(f)}: Error: {e}")
