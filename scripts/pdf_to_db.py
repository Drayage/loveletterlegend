#!/usr/bin/env python3
"""Convert LLS card-sheet PDFs (rasterized, no text layer) into a JSON card database.

Pipeline: rasterize each page -> crop into a 3x3 grid of card cells (using
measured grid-line fractions, not a naive even split -- the middle row/column
is narrower than the outer ones on this print sheet) -> OCR each cell region
(header/body/footer separately for accuracy) -> parse fields per the card
schema defined in the official rulebook (LLS_Rules415.pdf).

OCR is not perfect, especially for the decorative title/category font.
Card IDs are computed from sheet position (9 cards per page, row-major)
rather than OCR'd from the ticket-box digits, which turned out to be far
less reliable. A handful of "게임 : 정체" cards intentionally share one id
across two grid cells (male/female variants); those are hardcoded in
ID_OVERRIDES from a manual read, with a verified constant offset
(ID_DRIFT_CORRECTION) applied to every card after that zone. See README.md
for the full explanation and caveats. Cards that fail to parse cleanly are
kept with needs_review=True and their raw OCR text preserved, instead of
being dropped silently.
"""
import argparse
import difflib
import json
import re
import sys
from pathlib import Path

import pdfplumber
import pytesseract

GRID_COLS = 3
GRID_ROWS = 3
# Measured from the print sheet's crop-mark tick positions (consistent
# across pages/parts): the middle row/column is narrower than the outer two,
# so a naive width/3, height/3 split cuts into neighboring cards.
COL_FRACS = [0.0, 0.3419, 0.6575, 1.0]
ROW_FRACS = [0.0, 0.3431, 0.6571, 1.0]

HEADER_RATIO = 0.12    # top slice used to read the card title
FOOTER_RATIO = 0.20    # bottom slice used to read id / category / subtype
OCR_LANG = "kor+eng"
CARDS_PER_PAGE = GRID_COLS * GRID_ROWS

CATEGORY_VOCAB = ["게임", "시나리오", "캐릭터"]
CATEGORY_FUZZY_THRESHOLD = 0.4

# Base game-deck table (rulebook p.9): the 16 base cards have a fixed,
# known name/rank/count, and OCR cannot reliably read the decorative rank
# numeral or ♦ count marks -- so these 16 IDs are looked up here instead of
# relying on OCR for those fields. IDs 001-016 per the sample sheet.
BASE_GAME_CARDS = {}
_base_order = [
    ("경비병", 1, 5), ("광대", 2, 2), ("기사", 3, 2), ("승려", 4, 2),
    ("마술사", 5, 2), ("장군", 6, 1), ("대신", 7, 1), ("공주", 8, 1),
]
_next_id = 1
for _name, _rank, _count in _base_order:
    for _ in range(_count):
        BASE_GAME_CARDS[f"{_next_id:03d}"] = {"name": _name, "rank": _rank, "count": _count}
        _next_id += 1
# The last 공주 card also carries the 공주/왕자 module subtype per the sample sheet.
BASE_GAME_LAST_SUBTYPE = ("016", "공주 / 왕자")

# Some "게임 : 정체" (identity) cards are printed as male/female variant
# PAIRS that intentionally share one printed id across two grid cells (see
# rulebook: "성별도 결정합니다... 성별에 따른 효과의 차이는 없음"). That
# breaks the pure sequential-position id formula below for every card from
# here on. Confirmed by directly reading LLS_cards_part_1.pdf pages 4-5 at
# high resolution: page 4's last row and all of page 5 pair up, so the
# affected 12 cells are hardcoded from that manual read, and a constant
# offset (verified against the true first id printed on
# LLS_cards_part_2.pdf page 1, which is 058, not the formula's 064) corrects
# every card after. This assumes part1 is processed before any later part in
# the same run, matching the documented usage (all parts passed together in
# order) -- running part2/part3 alone would need this recalibrated.
# CAVEAT: if further identity-style pairing occurs later in part2/part3
# that we haven't manually inspected, drift could reappear from that point
# on -- cross-check raw_ocr_text against the source PDF for any card whose
# id looks suspicious (e.g. duplicate names, category "게임 : 정체").
ID_OVERRIDES = {
    ("LLS_cards_part_1.pdf", 4, 2, 0): "033",
    ("LLS_cards_part_1.pdf", 4, 2, 1): "034",
    ("LLS_cards_part_1.pdf", 4, 2, 2): "034",
    ("LLS_cards_part_1.pdf", 5, 0, 0): "035",
    ("LLS_cards_part_1.pdf", 5, 0, 1): "035",
    ("LLS_cards_part_1.pdf", 5, 0, 2): "036",
    ("LLS_cards_part_1.pdf", 5, 1, 0): "036",
    ("LLS_cards_part_1.pdf", 5, 1, 1): "037",
    ("LLS_cards_part_1.pdf", 5, 1, 2): "037",
    ("LLS_cards_part_1.pdf", 5, 2, 0): "038",
    ("LLS_cards_part_1.pdf", 5, 2, 1): "038",
    ("LLS_cards_part_1.pdf", 5, 2, 2): "039",
}
ID_DRIFT_CORRECTION = 6          # net id count "lost" to pairing in the override zone
ID_DRIFT_STARTS_AT_GLOBAL_PAGE = 6  # part1 page 6 onward (and all later parts)
PAIRED_IDS = set(ID_OVERRIDES.values())

TAG_LINE_RE = re.compile(r"^(S|E|!)\b\s*:?\s*")
TAG_NAMES = {"S": "시작", "E": "종료", "!": "중요"}
DIGIT_RE = re.compile(r"\d{3}")


def ocr_text(img, psm):
    return pytesseract.image_to_string(img, lang=OCR_LANG, config=f"--psm {psm}")


def ocr_tokens(img, psm):
    data = pytesseract.image_to_data(img, lang=OCR_LANG, config=f"--psm {psm}",
                                      output_type=pytesseract.Output.DICT)
    return [t.strip() for t in data["text"] if t.strip()]


def clean_lines(text):
    return [line.strip() for line in text.splitlines() if line.strip()]


def normalize(s):
    return re.sub(r"\s+", "", s)


def looks_similar(a, b):
    a, b = normalize(a), normalize(b)
    if not a or not b:
        return False
    return a == b or a in b or b in a


def is_probably_garbage(line):
    """Lines OCR'd from illustration art rarely contain Korean or digits."""
    return not re.search(r"[가-힣0-9]", line)


def iter_grid_cells(page_image):
    w, h = page_image.size
    xs = [int(f * w) for f in COL_FRACS]
    ys = [int(f * h) for f in ROW_FRACS]
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            box = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            yield row, col, page_image.crop(box)


def detect_category(cell_img):
    w, h = cell_img.size
    footer_img = cell_img.crop((0, int(h * (1 - FOOTER_RATIO)), w, h)).convert("L")
    footer_img = footer_img.point(lambda p: 255 if p > 180 else 0)
    text = ocr_text(footer_img, psm=6)
    flat = text.replace("\n", " ")

    best_cat, best_score, best_pos = None, 0.0, None
    for cat in CATEGORY_VOCAB:
        for i in range(max(1, len(flat) - len(cat) + 2)):
            chunk = flat[i:i + len(cat)]
            score = difflib.SequenceMatcher(None, chunk, cat).ratio()
            if score > best_score:
                best_cat, best_score, best_pos = cat, score, i + len(cat)

    if best_score < CATEGORY_FUZZY_THRESHOLD:
        return None, None, flat

    subtype = None
    tail = flat[best_pos:]
    m = re.search(r"^\s*[:：]\s*(.+)$", tail)
    if m:
        subtype = m.group(1).strip(" ]|[").strip() or None
    return best_cat, subtype, flat


def parse_name(cell_img):
    w, h = cell_img.size
    header_img = cell_img.crop((0, 0, w, int(h * HEADER_RATIO)))
    text = ocr_text(header_img, psm=11)
    korean_lines = [l for l in clean_lines(text) if re.search(r"[가-힣]", l)]
    if not korean_lines:
        return "", text
    name = max(korean_lines, key=len)
    name = re.sub(r"^[|\[\]\s]+|[|\[\]\s]+$", "", name)
    return name, text


def parse_body_lines(cell_img, name):
    w, h = cell_img.size
    body_img = cell_img.crop((0, 0, w, int(h * (1 - FOOTER_RATIO))))
    text = ocr_text(body_img, psm=6)
    lines = clean_lines(text)
    while lines and looks_similar(lines[0], name):
        lines.pop(0)
    lines = [l for l in lines if not is_probably_garbage(l)]
    return lines, text


def split_effects(lines):
    effects = []
    current_tag, current_text = None, []
    for line in lines:
        m = TAG_LINE_RE.match(line)
        if m:
            if current_text:
                effects.append({"tag": current_tag, "text": " ".join(current_text)})
            current_tag = TAG_NAMES[m.group(1)]
            current_text = [line[m.end():].strip()]
        else:
            current_text.append(line)
    if current_text:
        effects.append({"tag": current_tag, "text": " ".join(current_text)})
    return effects


def resolve_card_id(source_file, source_page, global_page, row, col):
    # Position-based id (9 cards/page, row-major) turned out far more
    # reliable than OCR'ing the decorative ticket-box digits, which is
    # inconsistent even between visually-similar cells. global_page
    # accumulates across input files so ids stay sequential when multiple
    # part PDFs are merged (source_page resets per file and is kept only
    # for human-readable "where in this PDF" bookkeeping).
    override = ID_OVERRIDES.get((source_file, source_page, row, col))
    if override is not None:
        return override
    raw = (global_page - 1) * CARDS_PER_PAGE + row * GRID_COLS + col + 1
    if global_page >= ID_DRIFT_STARTS_AT_GLOBAL_PAGE:
        raw -= ID_DRIFT_CORRECTION
    return f"{raw:03d}"


def process_cell(cell_img, source_file, source_page, global_page, row, col):
    card_id = resolve_card_id(source_file, source_page, global_page, row, col)
    base_info = BASE_GAME_CARDS.get(card_id)

    if base_info is not None:
        # The base 16-card deck is fixed and known (rulebook p.9); OCR
        # can't reliably read the decorative rank numeral or count marks,
        # so name/rank/count/category are looked up instead of OCR'd.
        name = base_info["name"]
        category = "게임"
        subtype = BASE_GAME_LAST_SUBTYPE[1] if card_id == BASE_GAME_LAST_SUBTYPE[0] else None
        body_lines, body_raw = parse_body_lines(cell_img, name)
        raw_ocr_text = body_raw
        needs_review = False
    else:
        name, header_raw = parse_name(cell_img)
        body_lines, body_raw = parse_body_lines(cell_img, name)
        category, subtype, footer_raw = detect_category(cell_img)
        raw_ocr_text = "\n".join([header_raw, body_raw, footer_raw])

        if not name and not body_lines and category is None:
            return None  # blank cell (this page had fewer than 9 cards)

        needs_review = category is None or not name

    record = {
        "id": card_id,
        "category": category,
        "subtype": subtype,
        "name": name,
        "raw_ocr_text": raw_ocr_text,
        "source_file": source_file,
        "source_page": source_page,
    }

    if base_info is not None:
        ability = "\n".join(body_lines).strip()
        trigger = "play" if ability.startswith("플레이") else "passive"
        record.update({
            "rank": base_info["rank"],
            "count": base_info["count"],
            "ability": ability,
            "trigger": trigger,
        })
        if not ability:
            needs_review = True
    else:
        effects = split_effects(body_lines)
        record["effects"] = effects
        if not effects:
            needs_review = True

    record["needs_review"] = needs_review
    return record


def convert(pdf_paths, resolution, verbose=True):
    cards = {}
    warnings = []
    page_offset = 0
    for pdf_path in pdf_paths:
        pdf_path = Path(pdf_path)
        if verbose:
            print(f"Processing {pdf_path.name} ...", file=sys.stderr)
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                if verbose:
                    print(f"  page {page_num}/{len(pdf.pages)}", file=sys.stderr)
                global_page = page_offset + page_num
                img = page.to_image(resolution=resolution).original
                for row, col, cell_img in iter_grid_cells(img):
                    card = process_cell(cell_img, pdf_path.name, page_num, global_page, row, col)
                    if card is None:
                        continue
                    card_id = card["id"]
                    if card_id in cards:
                        if card_id in PAIRED_IDS:
                            # Known male/female variant pair sharing one id
                            # (see ID_OVERRIDES) -- merge names instead of
                            # dropping one; effects/ability are identical
                            # per the rulebook so the rest of the record is
                            # kept as-is.
                            prev_name = cards[card_id]["name"]
                            if prev_name and card["name"] and prev_name != card["name"]:
                                card["name"] = f"{prev_name} / {card['name']}"
                            elif not card["name"]:
                                card["name"] = prev_name
                        else:
                            warnings.append(
                                f"Duplicate id {card_id}: {cards[card_id]['source_file']}"
                                f" p{cards[card_id]['source_page']} overwritten by"
                                f" {pdf_path.name} p{page_num}"
                            )
                    cards[card_id] = card
            page_offset += len(pdf.pages)
    return cards, warnings


def build_output(cards):
    by_category = {}
    for card in cards.values():
        by_category.setdefault(card["category"] or "미분류", []).append(card["id"])
    for ids in by_category.values():
        ids.sort()
    ordered_ids = sorted(cards.keys())
    return {
        "cards": [cards[cid] for cid in ordered_ids],
        "by_category": by_category,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdfs", nargs="+", help="Input card-sheet PDF file(s)")
    parser.add_argument("-o", "--output", default="data/cards.json", help="Output JSON path")
    parser.add_argument("--resolution", type=int, default=400, help="Rasterization DPI")
    args = parser.parse_args()

    cards, warnings = convert(args.pdfs, args.resolution)
    output = build_output(cards)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    total = len(output["cards"])
    needs_review = [c["id"] for c in output["cards"] if c["needs_review"]]
    print(f"\nWrote {total} cards to {out_path}")
    for category, ids in sorted(output["by_category"].items()):
        print(f"  {category}: {len(ids)}")
    print(f"needs_review: {len(needs_review)}")
    if needs_review:
        print("  " + ", ".join(needs_review))
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  {w}")


if __name__ == "__main__":
    main()
