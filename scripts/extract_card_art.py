#!/usr/bin/env python3
"""One-off script: crop the illustration-only region of each of the 8 base
game cards out of LLS_cards_part_1.pdf, reusing the grid constants measured
in pdf_to_db.py, and save them as PNGs for use as card art in game/.
"""
import pdfplumber
from pathlib import Path
from PIL import Image

GRID_COLS = 3
GRID_ROWS = 3
COL_FRACS = [0.0, 0.3419, 0.6575, 1.0]
ROW_FRACS = [0.0, 0.3431, 0.6571, 1.0]

# Illustration band within a cell: below the title/rank numerals, above the
# dotted-line + ability text.
ART_TOP = 0.16
ART_BOTTOM = 0.63

# (page_num 1-indexed, row, col, english_slug)
REPRESENTATIVES = [
    (1, 0, 0, "guard"),      # 경비병 001
    (1, 1, 2, "clown"),      # 광대 006
    (1, 2, 1, "knight"),     # 기사 008
    (2, 0, 0, "priestess"),  # 승려 010
    (2, 0, 2, "wizard"),     # 마술사 012
    (2, 1, 1, "general"),    # 장군 014
    (2, 1, 2, "minister"),   # 대신 015
    (2, 2, 0, "princess"),   # 공주 016
]

RESOLUTION = 400


def main():
    out_dir = Path("game/src/assets/cards")
    out_dir.mkdir(parents=True, exist_ok=True)

    with pdfplumber.open("pdfs/LLS_cards_part_1.pdf") as pdf:
        pages_needed = {p for p, _, _, _ in REPRESENTATIVES}
        rendered = {}
        for page_num in pages_needed:
            page = pdf.pages[page_num - 1]
            rendered[page_num] = page.to_image(resolution=RESOLUTION).original

        for page_num, row, col, slug in REPRESENTATIVES:
            img = rendered[page_num]
            w, h = img.size
            xs = [int(f * w) for f in COL_FRACS]
            ys = [int(f * h) for f in ROW_FRACS]
            cell = img.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
            cw, ch = cell.size
            art = cell.crop((0, int(ch * ART_TOP), cw, int(ch * ART_BOTTOM)))
            # Downscale for web use -- these are flat-color illustrations,
            # 480px wide is plenty sharp and keeps the bundle small.
            target_w = 480
            target_h = int(art.height * target_w / art.width)
            art = art.resize((target_w, target_h), Image.LANCZOS)
            out_path = out_dir / f"{slug}.jpg"
            art.convert("RGB").save(out_path, "JPEG", quality=88)
            print(f"{slug}: page{page_num} r{row}c{col} -> {out_path} ({art.size})")


if __name__ == "__main__":
    main()
