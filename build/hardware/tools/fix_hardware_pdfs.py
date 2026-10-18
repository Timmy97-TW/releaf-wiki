#!/usr/bin/env python3
"""Correct the hardware documents before they go on the wiki.

Two things are wrong across the set, and the generator that made these PDFs is
not on this machine, so the fixes are made on the files themselves.

1. Retired part numbers. The 14 October material-list rulings settled that the
   culture pump is the ZP4000-N79H, not the BP1000-DNUN64B, and that H0009 and
   CKP-DC-S08 were draft-only strings that come off. They survive in the
   bioreactor assembly guide (parts checklist and loop diagram) and in the user
   manual's pump table.
2. A personal email address on the title page of all four assembly guides.

Each offending text run is cut out of its content stream — covering it would
leave it in the file for anyone to copy — and the replacement is set over the
page in Helvetica at the same position, size and colour. Afterwards every file
is re-read and checked for all of the retired strings and for any "@".

Usage:  python3 -P fix_hardware_pdfs.py <source dir> <output dir>
"""

import os
import re
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, DictionaryObject

W = {" ": 278, "(": 333, ")": 333, ",": 278, ".": 278, "-": 333, "/": 278,
     "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "7": 556, "9": 556,
     "?": 556, "A": 667, "B": 667, "H": 722, "L": 556, "N": 722, "P": 667, "Q": 778,
     "R": 722, "Z": 611, "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278,
     "g": 556, "h": 556, "i": 222, "k": 500, "l": 222, "m": 833, "n": 556, "o": 556,
     "p": 556, "q": 556, "r": 333, "s": 500, "t": 278, "u": 556, "v": 500, "w": 722,
     "x": 500, "y": 500}

def width(t, size):
    return sum(W.get(c, 556) for c in t) / 1000.0 * size

INK = ".1216 .1608 .2"      # the documents' body ink
SLATE = ".3569 .4 .4392"    # the loop diagram's sub-labels


def footer(where):
    """The title-page line, with the email replaced by where to ask instead."""
    return dict(page=1, cut=["81.59375 980", "279.39064 980"],
                draw=[("Questions or difficulties? Ask on the %s page of our wiki." % where,
                       10.0, INK, 61.2, 57.0)])


JOBS = {
    "releaf-bioreactor-assembly-guide.pdf": [
        footer("Bioreactor"),
        dict(page=2, cut=["260.92189 1837", "260.92189 1860", "260.92189 1882"],
             draw=[("ZP4000-N79H peristaltic, 1 L/min", 8.7, INK, 247.44, 161.25),
                   ("1.5 L/min", 8.7, INK, 247.44, 144.00),
                   ("5 mL/min", 8.7, INK, 247.44, 127.50)]),
        dict(page=8, cut=["61.921876 177.23", "588.3125 175.29", "226.79688 418.40"],
             draw=[("ZP4000", 6.39, SLATE, ("center", 109.8), 452.82),
                   ("1.5 L/min", 6.39, SLATE, ("center", 501.5), 454.28),
                   ("5 mL/min", 6.39, SLATE, ("center", 238.3), 271.95)]),
    ],
    "releaf-bioreactor-user-manual.pdf": [
        dict(page=4, cut=["625.9999 -1520", "1234.222 -1520", "1246.016 -1520"],
             draw=[("Peristaltic pump for crossflow (ZP4000-N79H, up to 1 L/min).",
                    8.4, "0 0 0", 150.24, 275.28)]),
    ],
    "releaf-lpa-assembly-guide.pdf": [footer("LPA")],
    "releaf-pro-photometer-assembly-guide.pdf": [footer("Photometer")],
    "releaf-slim-photometer-assembly-guide.pdf": [footer("Photometer")],
    "releaf-bioreactor-brochure.pdf": [],
}

FORBIDDEN = ["BP1000", "DNUN64B", "H0009", "CKP", "S08", "tau.noah", "gmail", "@"]


def cut_run(data, tm):
    i = data.find(tm)
    if i < 0:
        return data, False
    bt = data.rfind("BT", 0, i)
    et = data.find("ET", i)
    if bt < 0 or et < 0:
        return data, False
    return data[:bt] + data[et + 2:], True


def open_depth(data):
    bare = re.sub(r"\([^()]*\)|<[^<>]*>", " ", data)
    return (len(re.findall(r"(?<![A-Za-z0-9])q(?![A-Za-z0-9])", bare))
            - len(re.findall(r"(?<![A-Za-z0-9])Q(?![A-Za-z0-9])", bare)))


def esc(s):
    return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def fix(src, dst, edits):
    writer = PdfWriter(clone_from=PdfReader(src))
    for e in edits:
        page = writer.pages[e["page"] - 1]
        data = page.get_contents().get_data().decode("latin1")
        for tm in e["cut"]:
            data, hit = cut_run(data, tm)
            if not hit:
                sys.exit("  %s page %d: no run at %s" % (os.path.basename(src), e["page"], tm))
        depth = open_depth(data)
        ops = (["Q" * depth] if depth > 0 else []) + ["q"]
        for s, size, colour, x, y in e["draw"]:
            if isinstance(x, tuple):
                x = x[1] - width(s, size) / 2.0
            ops.append("%s rg BT /ZPatch %.2f Tf %.2f %.2f Td (%s) Tj ET"
                       % (colour, size, x, y, esc(s)))
        ops.append("Q")
        stream = DecodedStreamObject()
        stream.set_data((data + "\n" + "\n".join(ops) + "\n").encode("latin1"))
        page.replace_contents(stream)

        helv = DictionaryObject()
        helv.update({NameObject("/Type"): NameObject("/Font"),
                     NameObject("/Subtype"): NameObject("/Type1"),
                     NameObject("/BaseFont"): NameObject("/Helvetica"),
                     NameObject("/Encoding"): NameObject("/WinAnsiEncoding")})
        res = page["/Resources"]
        if "/Font" not in res:
            res[NameObject("/Font")] = DictionaryObject()
        res["/Font"][NameObject("/ZPatch")] = writer._add_object(helv)
        print("  page %d: %d run(s) out, %d line(s) in" % (e["page"], len(e["cut"]), len(e["draw"])))
    with open(dst, "wb") as f:
        writer.write(f)


def audit(path):
    r = PdfReader(path)
    hits = {}
    for n, p in enumerate(r.pages, 1):
        t = p.extract_text() or ""
        for b in FORBIDDEN:
            if b in t:
                hits.setdefault(b, []).append(n)
    return hits


def main():
    srcdir, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    bad = False
    for name, edits in JOBS.items():
        src = os.path.join(srcdir, name)
        dst = os.path.join(outdir, name)
        print(name)
        if edits:
            fix(src, dst, edits)
        else:
            with open(src, "rb") as a, open(dst, "wb") as b:
                b.write(a.read())
            print("  nothing to change")
        hits = audit(dst)
        print("  after: %s" % (hits or "clean"))
        bad = bad or bool(hits)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
