"""Wet Lab Notebook: take the blank pages out of the monthly PDFs.

    python3 build/wetlab_trim_pdfs.py            # say what would come out
    python3 build/wetlab_trim_pdfs.py --write    # rewrite notebook/pdf/*.pdf

Needs pypdf and the poppler command line tools (pdftotext, pdfinfo, pdftoppm).

The team writes each notebook as a Google Doc, one tab a day, and the export
puts the day's date on a page of its own before the day's records, with empty
pages between tabs. On the wiki those pages are dead weight, so this takes
them out and one day's records run straight into the next. It also drops the
two-page reference format template at the front, which is a blank form rather
than a record.

A page comes out when it has no text, or its only text is a date
("2026/8/30"), or a tab marker ("Tab 34"). Before dropping one the page is
rendered: a few of the notebooks hold a photograph with no text at all beside
it, and those pages stay. Nothing else is touched, so the records themselves
are still the team's own export.
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parent.parent
PDFS = sorted((ROOT / "notebook" / "pdf").glob("wetlab-notebook-*.pdf"))

DATEONLY = re.compile(r"^(\(Only 1 task\)\s*)?\d{4}[/.]\d{1,2}[/.]\d{1,2}$")
TABONLY = re.compile(r"^(Tab|分頁)\s*\d+$")
REFERENCE_FORMAT = 2        # the template at the front of every file
INK = 0.02                  # a date stub inks under 0.008, a photograph over 0.17


def text(pdf, page):
    out = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), str(pdf), "-"],
                         capture_output=True, text=True).stdout
    return " ".join(out.replace("✅", "").replace("￼", "").split())


def ink(pdf, page):
    """Fraction of non-white pixels at 20 dpi, so an image-only page is kept."""
    raw = subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", "20", "-gray", str(pdf)],
                         capture_output=True).stdout
    head = raw.split(b"\n", 3)
    if len(head) < 4 or head[0] != b"P5":
        return 1.0
    data = head[3]
    return sum(1 for b in data if b < 200) / max(1, len(data))


def keepers(pdf):
    n = len(PdfReader(str(pdf)).pages)
    keep, drop = [], []
    for page in range(1, n + 1):
        if page <= REFERENCE_FORMAT:
            drop.append((page, "reference format"))
            continue
        s = text(pdf, page)
        if (s == "" or DATEONLY.match(s) or TABONLY.match(s)) and ink(pdf, page) < INK:
            drop.append((page, s or "blank"))
            continue
        keep.append(page)
    return n, keep, drop


def main(write):
    for pdf in PDFS:
        n, keep, drop = keepers(pdf)
        print("%-38s %3d -> %3d  (%d out)" % (pdf.name, n, len(keep), len(drop)))
        if not write:
            continue
        reader = PdfReader(str(pdf))
        writer = PdfWriter()
        for page in keep:
            writer.add_page(reader.pages[page - 1])
        meta = {k: v for k, v in (reader.metadata or {}).items() if isinstance(v, str)}
        if meta:
            writer.add_metadata(meta)
        with open(pdf, "wb") as fh:
            writer.write(fh)


if __name__ == "__main__":
    main("--write" in sys.argv)
