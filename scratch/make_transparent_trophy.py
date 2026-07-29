from PIL import Image, ImageOps
import numpy as np

# Paths
image_path = r"C:\Users\argan\.gemini\antigravity\brain\2026e41d-60c3-4b07-848f-b6d9dbd3a261\media__1781713425015.png"
dest_path = r"c:\Projects\alparfume\public\images\trophy.png"

# Load image
img = Image.open(image_path)
rgba_img = img.convert("RGBA")
data = np.array(rgba_img)

# The background color is dark brown/black.
# Let's inspect the corner pixels (top-left, top-right, bottom-left, bottom-right)
corners = [
    data[0, 0, :3],
    data[0, -1, :3],
    data[-1, 0, :3],
    data[-1, -1, :3]
]
bg_color = np.mean(corners, axis=0)
print("Detected background color:", bg_color)

# Calculate color distance to background color for each pixel
# We want to be careful because some parts of the trophy (like the dark green stripes on the base or dark gold shadows) might be dark.
# But the dark green on the base is green: e.g. R=0, G=80, B=40, which is different from background (R=45, G=30, B=28 or similar).
# Let's compute color distance.
# Let's also use a bounding box / mask to avoid making the interior of the trophy transparent.
# Actually, the background is very uniform.
# Let's check distance to bg_color.
rgb = data[:, :, :3]
diff = rgb - bg_color
dist = np.sqrt(np.sum(diff ** 2, axis=2))

# We can find a threshold. Since the background is very uniform, the distance within background should be very small.
# Let's see the distribution of distances or use a threshold.
# Let's try threshold = 30.
# If dist < threshold, make transparent.
# To make it smooth, we can use a soft range.
threshold_min = 25
threshold_max = 50

alpha = np.ones_like(dist) * 255
mask_bg = dist <= threshold_min
alpha[mask_bg] = 0

mask_transition = (dist > threshold_min) & (dist < threshold_max)
alpha[mask_transition] = ((dist[mask_transition] - threshold_min) / (threshold_max - threshold_min) * 255).astype(np.uint8)

data[:, :, 3] = alpha

# Also let's crop the image to the bounding box of the non-transparent pixels to make it clean
# Convert back to PIL Image
output_img = Image.fromarray(data)

# Let's crop it to the bounding box of the trophy
# Find bounding box where alpha > 0
non_transparent = data[:, :, 3] > 0
rows = np.any(non_transparent, axis=1)
cols = np.any(non_transparent, axis=0)
ymin, ymax = np.where(rows)[0][[0, -1]]
xmin, xmax = np.where(cols)[0][[0, -1]]

cropped_img = output_img.crop((xmin, ymin, xmax, ymax))
print(f"Original size: {img.size}, Cropped size: {cropped_img.size}")

# Save
import os
os.makedirs(os.path.dirname(dest_path), exist_ok=True)
cropped_img.save(dest_path, "PNG")
print("Saved transparent trophy to", dest_path)
