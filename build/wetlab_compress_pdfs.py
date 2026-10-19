"""Wet Lab Notebook: bring the monthly PDFs down to a size we can keep in git.

    python3 build/wetlab_compress_pdfs.py            # say what would change
    python3 build/wetlab_compress_pdfs.py --write    # rewrite notebook/pdf/*.pdf

Needs pymupdf. Run it after build/wetlab_trim_pdfs.py, never before: the trim
reads the pages with poppler and the photographs have to be the originals when
the ink check decides whether a page is blank.

The team photographs gels and plates on a phone, so a single August page can
carry three 4000 px images. They are re-encoded to about 110 dpi at the size
they are printed on the page, and anything already under 130 dpi is left alone.
Checked by eye at 100%: band positions, ladder rungs, plate labels and colony
counts are all still readable. No page, entry or figure is removed.
"""
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDFS = sorted((ROOT / "notebook" / "pdf").glob("wetlab-notebook-*.pdf"))

DPI_TARGET = 110
DPI_THRESHOLD = 130
QUALITY = 55
LEAVE_UNDER = 1_500_000     # April, May and October are text; nothing to gain


def main(write):
    for pdf in PDFS:
        before = pdf.stat().st_size
        if before < LEAVE_UNDER:
            print("%-38s %6.1f MB  (left alone)" % (pdf.name, before / 1e6))
            continue
        doc = pymupdf.open(pdf)
        doc.rewrite_images(dpi_target=DPI_TARGET, dpi_threshold=DPI_THRESHOLD,
                           quality=QUALITY)
        out = doc.tobytes(garbage=4, deflate=True)
        doc.close()
        if write:
            pdf.write_bytes(out)
        after = len(out)
        print("%-38s %6.1f MB -> %5.1f MB" % (pdf.name, before / 1e6, after / 1e6))


if __name__ == "__main__":
    main("--write" in sys.argv)
