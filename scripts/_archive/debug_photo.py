"""
Debug photo extraction for a specific member.
Shows all images found on a page with their dimensions and position.
"""
import fitz
from PIL import Image
import io

PDF_PATH = r"C:\Users\jerom\Downloads\Lima\Trombinoscope LIMA 2025-2026.pdf"
PAGE_IDX = 3  # Page 4 (0-indexed) — Jérôme Jacq is slot 1

pdf = fitz.open(PDF_PATH)
page = pdf[PAGE_IDX]
img_list = page.get_images(full=True)

print(f"Page {PAGE_IDX+1}: {len(img_list)} total images")

candidates = []
for img_info in img_list:
    xref = img_info[0]
    base_image = pdf.extract_image(xref)
    w, h = base_image["width"], base_image["height"]
    colorspace = base_image.get("colorspace", "?")

    if w < 50 or h < 50:
        continue
    if w > 1500 and h > 1500:
        continue

    rects = page.get_image_rects(xref)
    if not rects:
        continue
    rect = rects[0]

    img = Image.open(io.BytesIO(base_image["image"])).convert("RGB")

    # Sample center pixel to detect blank/white images
    cx, cy = img.width // 2, img.height // 2
    center_pixel = img.getpixel((cx, cy))

    print(f"  [{len(candidates)}] size={w}x{h} pos=({rect.x0:.0f},{rect.y0:.0f}) "
          f"center_pixel={center_pixel} colorspace={colorspace}")

    candidates.append((rect.y0, rect.x0, img, xref, w, h, center_pixel))

    # Save each candidate for inspection
    img.save(f"C:/tmp/page4_img{len(candidates)-1}.jpg", "JPEG")

candidates.sort(key=lambda c: (round(c[0] / 50) * 50, c[1]))
print(f"\nSorted order (slot -> original index):")
for slot, c in enumerate(candidates):
    print(f"  Slot {slot}: pos=({c[1]:.0f},{c[0]:.0f}) size={c[4]}x{c[5]} center={c[6]}")

import os
os.makedirs("C:/tmp", exist_ok=True)
print(f"\nImages saved to C:/tmp/page4_img*.jpg — check slot 1 (Jerome)")
