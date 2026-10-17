"""Plant notebook: split the one mixed export into its three kinds of record.

    python3 build/plant_notebook_split.py              # say what would come out
    python3 build/plant_notebook_split.py --write      # write notebook/pdf/

Needs pymupdf.

The plant sub-team keeps one Google Doc. Three different kinds of record go
into it, and the export interleaves them in the order they were typed rather
than by date, which is why the file reads as a jumble:

  * experiment records   dated entries, each Date / Title / Purpose /
                         Procedure / Result / Done by / Recorded by, the same
                         shape as the five monthly wet lab notebooks
  * weekly meetings      "<date> Progress Report + Meeting with Professor
                         Kyle", the week's status put to the supervisor, with
                         his comments and the photographs discussed
  * daily plan log       "<mmdd> forecast:" / "<mmdd> progression:", what was
                         planned for a day and what was actually done

Each goes to a file of its own, in date order. The page ranges below were read
off the source by hand and then checked two ways: no page outside the
experiment ranges carries a Date/Purpose/Procedure header, and no page inside
them carries a Progress Report heading.

Page 103 is the one page holding two kinds of record: an experiment entry ends
at y=259 and the 30 September plan entry starts at y=276. It is cut in two at
SPLIT_Y, so neither file loses a line.

Pages 1, 2 and 125 are empty and come out. Page 121 carries a photograph with
no text and stays, so the drop list is written out rather than derived from a
text test.

The photographs are re-encoded on the way through: the source is a 265 MB
export and the three files have to be small enough to sit in git and inside
the iGEM page budget. No page, entry or figure is removed.
"""
import argparse
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "notebook" / "pdf"
SOURCE = Path.home() / "Downloads" / "Plant notebook_progress(will save as pdf).pdf"

SPLIT_PAGE = 103        # 1-based, the page holding the end of one kind and the start of another
SPLIT_Y = 267.0         # experiment entry ends y=259.2, plan entry starts y=276.0
EMPTY = (1, 2, 125)     # no text and no image; checked by ink, not assumed

# (first page, last page) inclusive, 1-based, in the order they are to be read.
EXPERIMENTS = [(16, 31), (54, 58), (101, SPLIT_PAGE)]
MEETINGS = [
    ("10 June", 3, 6), ("17 June", 7, 11), ("24 June", 12, 15),
    ("1 July", 32, 35), ("8 July", 36, 38), ("15 July", 39, 41),
    ("22 July", 42, 45), ("29 July", 46, 53),
    ("5 August", 59, 70), ("12 August", 71, 78), ("13 August", 79, 82),
    ("19 August", 83, 93), ("26 August", 94, 100),
    ("1 September", 104, 108), ("8 September", 109, 112),
    ("15 September", 113, 115), ("22 September", 116, 121),
    ("6 October", 126, 126), ("13 October", 127, 129),
]
PLAN_LOG = [(SPLIT_PAGE, SPLIT_PAGE), (122, 124)]

FILES = {
    "plant-notebook-experiments.pdf": ("experiment records", EXPERIMENTS),
    "plant-notebook-meetings.pdf": ("weekly meetings", [(a, b) for _, a, b in MEETINGS]),
    "plant-notebook-plan-log.pdf": ("daily plan log", PLAN_LOG),
}

DPI_TARGET = 110        # photographs land around this on the page; anything denser is resampled
DPI_THRESHOLD = 130
JPEG_QUALITY = 55


def build(src, ranges, keep_top, keep_bottom):
    """Copy the ranges into a new document, cutting SPLIT_PAGE where asked."""
    out = pymupdf.open()
    for first, last in ranges:
        for page in range(first, last + 1):
            if page in EMPTY:
                continue
            if page == SPLIT_PAGE and (keep_top or keep_bottom):
                src_page = src[page - 1]
                rect = src_page.rect
                clip = (pymupdf.Rect(rect.x0, rect.y0, rect.x1, SPLIT_Y) if keep_top
                        else pymupdf.Rect(rect.x0, SPLIT_Y, rect.x1, rect.y1))
                new = out.new_page(width=clip.width, height=clip.height)
                new.show_pdf_page(new.rect, src, page - 1, clip=clip)
            else:
                out.insert_pdf(src, from_page=page - 1, to_page=page - 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--source", type=Path, default=SOURCE)
    args = ap.parse_args()

    if not args.source.exists():
        sys.exit(f"source not found: {args.source}")
    src = pymupdf.open(args.source)
    print(f"{args.source.name}: {src.page_count} pages, {args.source.stat().st_size / 1e6:.0f} MB\n")

    for name, (what, ranges) in FILES.items():
        top = name.endswith("experiments.pdf")
        bottom = name.endswith("plan-log.pdf")
        out = build(src, ranges, top, bottom)
        pages = out.page_count
        if args.write:
            out.rewrite_images(dpi_target=DPI_TARGET, dpi_threshold=DPI_THRESHOLD,
                               quality=JPEG_QUALITY, lossy=True, lossless=True)
            out.subset_fonts()
            out.save(OUT / name, garbage=4, deflate=True, clean=True)
            size = (OUT / name).stat().st_size / 1e6
            print(f"  {name}  {pages} pages  {size:.1f} MB  ({what})")
        else:
            spans = ", ".join(f"{a}" if a == b else f"{a}-{b}" for a, b in ranges)
            print(f"  {name}  {pages} pages  from {spans}  ({what})")
        out.close()

    if not args.write:
        print("\nnothing written; pass --write")


if __name__ == "__main__":
    main()
