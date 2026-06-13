"""
Extract member portraits from Trombinoscope LIMA 2025-2026.pdf and upload them.
Usage: py scripts/upload_trombi_photos.py [--dry-run]

Portraits are on pages 3-9 (0-indexed: 2-8), 8 per page in a 4×2 grid,
left→right, top→bottom. Some slots on pages 9-10 are empty frames.
"""

import os
import sys
import base64
import io
import fitz  # PyMuPDF
import requests
from PIL import Image

API_BASE = "https://api-production-e15b.up.railway.app"
ADMIN_EMAIL = os.environ.get("LIMA_ADMIN_EMAIL", "admin@lima-impro.fr")
ADMIN_PASSWORD = os.environ.get("LIMA_ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise SystemExit("Definis LIMA_ADMIN_PASSWORD dans l'environnement avant de lancer ce script.")
PDF_PATH = r"C:\Users\jerom\Downloads\Lima\Trombinoscope LIMA 2025-2026.pdf"

DRY_RUN = "--dry-run" in sys.argv

# Ordered member names per page (page 3 = index 0), 8 per page, left→right top→bottom.
# None = empty frame (no photo).
PAGE_MEMBERS = [
    # Page 3 (PDF page 3, 0-indexed: 2)
    ["Alain Bolzer", "Lucie Berson", "Romain Mornet", "Élodie Audigane",
     "Céline Delhoumeau", "Maïlys Dupont", "Karim Jamet", "Élisabeth Trognon"],
    # Page 4
    ["Hugues Meerschman", "Jérôme Jacq", "Johanna Dreano", "Vincent Marais",
     "Marie Fortin", "Benoît Flamec", "Géraldine Guillome", "Stéphanie Méo"],
    # Page 5
    ["Marie Trottier", "Maxime Vrillauld", "Nathalie Vaq", "Cécile Hubert",
     "Jane Durif", "Clément Veyer", "Léa Lebru", "Paul Heuveline"],
    # Page 6
    ["Carole Davy Favret", "Soline Avrillas", "Aurélien Le Corre", "Nicolas Zigon",
     "Antoine Gasnier", "Ronan Michel", "Élise Verchère", "Sylvain Lemoine"],
    # Page 7
    ["Thomas Gohier", "Thierry Verger", "Valentin Trognon", "Laure Nafziger",
     "Emmanuelle Landais", "Antoine Blin", "Hélène Clausse", "Karine Raphoz"],
    # Page 8
    ["François Barraud", "Maud Ricou", "Guillaume Huchet", "Charlotte Vincent",
     "Antoine Fouchet", "Simon Galland", "Eric Cremers", "Laurène Bregeault"],
    # Page 9 — last 4 slots are empty frames
    ["Rémi Lebois", "Gladys Ayreault", "Nicolas Krzyzanowski", "Pauline Boissel",
     "Alexis De Labeau", None, None, None],
]

# Flat list of (name, page_index_0based, slot_0based)
MEMBERS_ORDER = []
for page_offset, members in enumerate(PAGE_MEMBERS):
    pdf_page_idx = 2 + page_offset  # PDF 0-indexed pages (page 3 = index 2)
    for slot, name in enumerate(members):
        MEMBERS_ORDER.append((name, pdf_page_idx, slot))


session = requests.Session()
_logged_in = False


def api(method, path, **kwargs):
    global session, _logged_in
    for attempt in range(3):
        try:
            r = session.request(method, API_BASE + path, **kwargs)
            if not r.ok:
                raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
            return r.json() if r.status_code != 204 else None
        except requests.exceptions.ConnectionError:
            if attempt == 2:
                raise
            session = requests.Session()
            if _logged_in:
                session.post(API_BASE + "/auth/login",
                             json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})


def login():
    global _logged_in
    api("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    _logged_in = True


def build_name_index(members):
    import unicodedata
    def strip(s):
        return ''.join(c for c in unicodedata.normalize('NFD', s)
                       if unicodedata.category(c) != 'Mn').lower()

    idx = {}
    for m in members:
        full = f"{m['first_name']} {m['last_name']}"
        idx[full.casefold()] = m
        idx[strip(full)] = m
    return idx


def lookup(idx, name):
    import unicodedata
    def strip(s):
        return ''.join(c for c in unicodedata.normalize('NFD', s)
                       if unicodedata.category(c) != 'Mn').lower()
    return idx.get(name.casefold()) or idx.get(strip(name))


def extract_portraits_from_page(pdf_doc, page_idx):
    """
    Return portrait images sorted by (y, x) position (top→bottom, left→right).
    Filters out: page background (>1000px either dim), off-page images (neg coords),
    near-white placeholders (empty frames), and caption/label strips (<100px height).
    """
    page = pdf_doc[page_idx]
    img_list = page.get_images(full=True)

    candidates = []
    for img_info in img_list:
        xref = img_info[0]
        base_image = pdf_doc.extract_image(xref)
        img_bytes = base_image["image"]
        img_width = base_image["width"]
        img_height = base_image["height"]

        # Skip tiny labels/captions and full-page backgrounds
        if img_width < 100 or img_height < 100:
            continue
        if img_width > 1000 or img_height > 1000:
            continue

        # Get bounding box on the page — skip off-page images (backgrounds)
        rects = [r for r in page.get_image_rects(xref)]
        if not rects:
            continue
        rect = rects[0]
        if rect.x0 < 0 or rect.y0 < 0:
            continue

        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Skip near-white images (empty frame placeholders)
        cx, cy = img.width // 2, img.height // 2
        r, g, b = img.getpixel((cx, cy))
        if r > 230 and g > 230 and b > 230:
            continue

        candidates.append((rect.y0, rect.x0, img))

    # Sort by top-to-bottom, then left-to-right
    candidates.sort(key=lambda c: (round(c[0] / 50) * 50, c[1]))
    return [c[2] for c in candidates]


def image_to_data_url(img: Image.Image, max_px=300, quality=82) -> str:
    img = img.convert("RGB")
    scale = min(1.0, max_px / max(img.width, img.height))
    new_w = round(img.width * scale)
    new_h = round(img.height * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def main():
    print("Opening PDF...")
    pdf_doc = fitz.open(PDF_PATH)
    print(f"  {pdf_doc.page_count} pages")

    print("Logging in...")
    login()

    all_members = (api("GET", "/members?is_active=true") or []) + \
                  (api("GET", "/members?is_active=false") or [])
    name_idx = build_name_index(all_members)
    print(f"  {len(all_members)} members loaded")

    ok = skipped = errors = 0

    # Group entries by page
    from itertools import groupby
    from operator import itemgetter

    page_groups = {}
    for name, page_idx, slot in MEMBERS_ORDER:
        page_groups.setdefault(page_idx, []).append((slot, name))

    for page_idx in sorted(page_groups.keys()):
        slots = page_groups[page_idx]
        print(f"\nPage {page_idx + 1} (PDF page index {page_idx}):")

        portraits = extract_portraits_from_page(pdf_doc, page_idx)
        print(f"  Found {len(portraits)} portrait images")

        for slot, name in sorted(slots, key=itemgetter(0)):
            if name is None:
                print(f"  Slot {slot}: [empty frame, skipped]")
                skipped += 1
                continue

            if slot >= len(portraits):
                print(f"  Slot {slot}: {name} — no image at this slot (only {len(portraits)} found)")
                skipped += 1
                continue

            img = portraits[slot]
            member = lookup(name_idx, name)
            if not member:
                print(f"  Slot {slot}: {name} — MEMBER NOT FOUND in DB")
                skipped += 1
                continue

            data_url = image_to_data_url(img)
            size_kb = len(data_url) * 3 // 4 // 1024

            if DRY_RUN:
                print(f"  Slot {slot}: {name} ({member['id']}) — DRY-RUN, {size_kb}KB JPEG ready")
                ok += 1
                continue

            try:
                api("POST", f"/members/{member['id']}/photo-data", json={"data": data_url})
                print(f"  Slot {slot}: {name} — uploaded ({size_kb}KB)")
                ok += 1
            except RuntimeError as e:
                print(f"  Slot {slot}: {name} — ERROR: {e}")
                errors += 1

    print(f"\nDone. Uploaded: {ok}  Skipped: {skipped}  Errors: {errors}")


if __name__ == "__main__":
    main()
