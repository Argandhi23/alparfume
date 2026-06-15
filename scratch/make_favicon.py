from PIL import Image
import os

image_path = r"C:\Users\argan\.gemini\antigravity\brain\b7641fbf-7aef-4cd5-8675-0351af53d8db\media__1781549299939.png"
dest_dir = r"c:\Projects\alparfume\src\app"

if not os.path.exists(image_path):
    print(f"Error: Original image not found at {image_path}")
    exit(1)

# Open image
img = Image.open(image_path)
print(f"Original image size: {img.size}")

# Convert to grayscale to find the bounding box of the logo
gray = img.convert("L")
binary = gray.point(lambda p: 255 if p > 15 else 0)
bbox = binary.getbbox()

if bbox:
    print(f"Detected logo bounding box: {bbox}")
    left, top, right, bottom = bbox
    logo_w = right - left
    logo_h = bottom - top
    
    # Calculate center of the bounding box
    center_x = left + logo_w // 2
    center_y = top + logo_h // 2
    
    # Crop size is exactly the width of the logo to maximize its size inside the square
    crop_size = logo_w
    
    # Ensure crop size is square and within original image limits
    crop_size = min(crop_size, img.width, img.height)
    
    # Calculate initial crop bounds
    crop_left = center_x - crop_size // 2
    crop_top = center_y - crop_size // 2
    crop_right = crop_left + crop_size
    crop_bottom = crop_top + crop_size
    
    # Adjust bounds if they exceed image boundaries
    if crop_left < 0:
        crop_right += abs(crop_left)
        crop_left = 0
    if crop_top < 0:
        crop_bottom += abs(crop_top)
        crop_top = 0
    if crop_right > img.width:
        diff = crop_right - img.width
        crop_left = max(0, crop_left - diff)
        crop_right = img.width
    if crop_bottom > img.height:
        diff = crop_bottom - img.height
        crop_top = max(0, crop_top - diff)
        crop_bottom = img.height
        
    print(f"Cropping square area: ({crop_left}, {crop_top}, {crop_right}, {crop_bottom}) with size {crop_size}x{crop_size}")
    cropped_img = img.crop((crop_left, crop_top, crop_right, crop_bottom))
else:
    print("Warning: Bounding box not found, using original image.")
    cropped_img = img

# Ensure destination directory exists
os.makedirs(dest_dir, exist_ok=True)

# 1. Generate icon.png (32x32)
icon_png_path = os.path.join(dest_dir, "icon.png")
icon_32 = cropped_img.resize((32, 32), Image.Resampling.LANCZOS)
icon_32.save(icon_png_path, "PNG")
print(f"Saved icon.png to {icon_png_path}")

# 2. Generate apple-icon.png (180x180)
apple_icon_path = os.path.join(dest_dir, "apple-icon.png")
icon_180 = cropped_img.resize((180, 180), Image.Resampling.LANCZOS)
icon_180.save(apple_icon_path, "PNG")
print(f"Saved apple-icon.png to {apple_icon_path}")

# 3. Generate favicon.ico (multi-resolution containing 16x16, 32x32, 48x48)
favicon_path = os.path.join(dest_dir, "favicon.ico")
favicon_sizes = [(16, 16), (32, 32), (48, 48)]
# Save as ICO
cropped_img.save(favicon_path, format="ICO", sizes=favicon_sizes)
print(f"Saved favicon.ico to {favicon_path}")

print("Favicon generation completed successfully!")
