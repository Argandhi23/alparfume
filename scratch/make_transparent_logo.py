from PIL import Image
import os

image_path = r"C:\Users\argan\.gemini\antigravity\brain\b7641fbf-7aef-4cd5-8675-0351af53d8db\media__1781549299939.png"
dest_path = r"c:\Projects\alparfume\public\logo.png"

if not os.path.exists(image_path):
    print(f"Error: Original image not found at {image_path}")
    exit(1)

# Open image
img = Image.open(image_path)
print(f"Original image size: {img.size}")

# Convert to grayscale to find the bounding box
gray = img.convert("L")
binary = gray.point(lambda p: 255 if p > 15 else 0)
bbox = binary.getbbox()

if bbox:
    print(f"Detected logo bounding box: {bbox}")
    left, top, right, bottom = bbox
    
    # Crop exactly to the logo's bounding box to remove vertical and horizontal margins
    cropped_img = img.crop((left, top, right, bottom))
    print(f"Cropped logo size: {cropped_img.size}")
else:
    print("Warning: Bounding box not found, using original image.")
    cropped_img = img

# Convert cropped image to RGBA (to support transparency)
rgba_img = cropped_img.convert("RGBA")
datas = rgba_img.getdata()

# Process pixels: make black/dark pixels transparent
newData = []
for item in datas:
    # item is (r, g, b, a)
    # If the pixel is dark (brightness < 20), make it transparent
    brightness = (item[0] + item[1] + item[2]) / 3
    if brightness < 20:
        # Set to transparent white to avoid dark edges
        newData.append((255, 255, 255, 0))
    else:
        # Keep bright pixels as white with full opacity
        # If the original logo is slightly off-white, make it pure white (255, 255, 255, 255)
        # to ensure the filter: invert(1) works perfectly.
        newData.append((255, 255, 255, 255))

rgba_img.putdata(newData)

# Backup old logo if it exists
if os.path.exists(dest_path):
    backup_path = dest_path + ".bak"
    if not os.path.exists(backup_path):
        os.rename(dest_path, backup_path)
        print(f"Backed up old logo to {backup_path}")
    else:
        os.remove(dest_path)

# Save the transparent logo
rgba_img.save(dest_path, "PNG")
print(f"Saved transparent logo to {dest_path}")
