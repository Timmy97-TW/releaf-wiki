#!/usr/bin/env python3
"""Put the two i18n tags on every page, once.

A page gets, in <head>:      <link rel="stylesheet" href="static/assets/css/i18n.css" />
and at the end of <body>:    <script src="static/assets/js/i18n.js" data-page="<page>"></script>

data-page is written in rather than guessed from the URL, because the frozen
pages are served without a trailing slash under a team prefix and the dev
server serves "/" for the homepage.

Pages that extend wiki/layout.html get the tags from the layout instead; they
are skipped here.

    python3 -I tools/i18n/inject.py            # all pages
    python3 -I tools/i18n/inject.py --check    # report, change nothing
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGES = ROOT / "wiki" / "pages"

CSS = '<link rel="stylesheet" href="static/assets/css/i18n.css?v=i18n1" />'
JS = '<script src="static/assets/js/i18n.js?v=i18n1" data-page="{page}"></script>'


def inject(path: Path, check: bool) -> str:
    s = path.read_text(encoding="utf-8")
    if "{% extends" in s:
        return "layout"
    if "assets/js/i18n.js" in s:
        return "already"
    out = s
    if "assets/css/i18n.css" not in out:
        m = re.search(r"\n([ \t]*)</head>", out)
        if m:
            out = out[:m.start()] + "\n" + m.group(1) + CSS + out[m.start():]
        else:
            # a page minified onto one line (the Gantt roadmap) still has a head
            m = re.search(r"</head>", out)
            if not m:
                return "no </head>"
            out = out[:m.start()] + CSS + out[m.start():]
    m = None
    for m in re.finditer(r"\n([ \t]*)</body>", out):
        pass
    tag = JS.format(page=path.stem)
    if m:
        out = out[:m.start()] + "\n" + m.group(1) + tag + out[m.start():]
    else:
        m = None
        for m in re.finditer(r"</body>", out):
            pass
        if not m:
            return "no </body>"
        out = out[:m.start()] + tag + out[m.start():]
    if not check:
        path.write_text(out, encoding="utf-8")
    return "injected"


def main(argv):
    check = "--check" in argv
    counts = {}
    for p in sorted(PAGES.glob("*.html")):
        r = inject(p, check)
        counts[r] = counts.get(r, 0) + 1
        if r not in ("injected", "layout", "already"):
            print(f"  {p.name}: {r}")
    for k, v in sorted(counts.items()):
        print(f"{k:12s} {v}")


if __name__ == "__main__":
    main(sys.argv[1:])
