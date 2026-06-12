#!/usr/bin/env python3
"""Build assets/og-card.png (1200x630) from a hero screenshot, removing the CTA buttons."""
import sys
from PIL import Image

src_path = sys.argv[1]
out_path = sys.argv[2]

img = Image.open(src_path).convert("RGB")
w, h = img.size

# Sample background blue from a safe solid spot (right of the buttons)
blue = img.getpixel((int(w * 0.88), int(h * 0.73)))

# Paint over the "Contact me" / "View" buttons (proportional region)
x0, x1 = int(w * 0.34), int(w * 0.65)
y0, y1 = int(h * 0.62), int(h * 0.84)
patch = Image.new("RGB", (x1 - x0, y1 - y0), blue)
img.paste(patch, (x0, y0))

# Crop to 1.9048:1 (1200x630), trimming from the right (solid blue) only
target_ratio = 1200 / 630
if w / h > target_ratio:
    new_w = int(h * target_ratio)
    img = img.crop((0, 0, new_w, h))
else:
    new_h = int(w / target_ratio)
    top = (h - new_h) // 2
    img = img.crop((0, top, w, top + new_h))

img = img.resize((1200, 630), Image.LANCZOS)
img.save(out_path, "PNG")
print("wrote", out_path, img.size)
