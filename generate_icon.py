from PIL import Image, ImageDraw, ImageFont

# Create black background
img = Image.new('RGB', (512, 512), color='#000000')

# Prepare to draw text
draw = ImageDraw.Draw(img)
font_size_big = 100
font_size_small = 50

try:
    font_big = ImageFont.truetype("arial.ttf", font_size_big)
    font_small = ImageFont.truetype("arial.ttf", font_size_small)
except:
    font_big = ImageFont.load_default()
    font_small = ImageFont.load_default()

# Center text positions manually
draw.text((160, 150), "OCR", fill="#007bff", font=font_big)
draw.text((150, 300), "cyber kid", fill="#007bff", font=font_small)

# Save icon
img.save("static/icon.png")
print("✅ Icon successfully generated: static/icon.png")