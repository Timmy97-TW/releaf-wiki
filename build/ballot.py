#!/usr/bin/env python3
"""Write the judge's ballot map into each judged page.

The data live in one place, assets/data/ballot.js. This script reads them and
renders an ordinary <ol class="ai"> into every page that carries the pair of
markers

    <!-- ballot:start SLUG -->
    <!-- ballot:end -->

inside that page's existing .callout--medal box. The list is written into the
page markup, so it is there with JavaScript off, it prints, and it survives in
a saved copy of the page. Nothing is rendered in the browser.

    python3 build/ballot.py             write every page that has markers
    python3 build/ballot.py model       write one page
    python3 build/ballot.py --check     exit 1 if any page is out of date

A slug in the data file with no markers on its page is reported and skipped:
that is how a map is prepared for a page somebody else is editing.

Only the Python standard library is used.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data" / "ballot.js"

START = re.compile(r"<!--\s*ballot:start\s+([a-z0-9-]+)\s*-->")
END = "<!-- ballot:end -->"


def load():
    """Pull the JSON object literal out of the data file."""
    text = DATA.read_text(encoding="utf-8")
    i = text.index("window.RELEAF_BALLOT")
    i = text.index("{", i)
    j = text.rindex("}")
    return json.loads(text[i:j + 1])


def render(entry, indent):
    """One <ol class="ai">, indented to sit under the marker."""
    pad = " " * indent
    out = [f'{pad}<p class="ai">{entry["lead"]}</p>', f'{pad}<ol class="ai">']
    for q in entry["questions"]:
        out.append(f'{pad}  <li><b>{q["q"]}</b> {q["a"]}</li>')
    out.append(f"{pad}</ol>")
    return "\n".join(out)


def apply(slug, entry, check=False):
    page = ROOT / slug / "index.html"
    if not page.exists():
        return "missing page"
    text = page.read_text(encoding="utf-8")
    m = None
    for cand in START.finditer(text):
        if cand.group(1) == slug:
            m = cand
            break
    if m is None:
        return "no markers"
    end = text.find(END, m.end())
    if end == -1:
        return "no ballot:end"

    # indent the block to match the marker's own column
    line_start = text.rfind("\n", 0, m.start()) + 1
    indent = m.start() - line_start
    block = render(entry, indent)
    new = text[:m.end()] + "\n" + block + "\n" + " " * indent + text[end:]
    if new == text:
        return "unchanged"
    if check:
        return "OUT OF DATE"
    page.write_text(new, encoding="utf-8")
    return "written"


def main(argv):
    check = "--check" in argv
    wanted = [a for a in argv if not a.startswith("-")]
    data = load()
    stale = False
    for slug, entry in data.items():
        if wanted and slug not in wanted:
            continue
        result = apply(slug, entry, check)
        n = len(entry["questions"])
        gaps = sum(1 for q in entry["questions"] if q.get("gap"))
        print(f"{slug:24} {result:12} {n} questions, {gaps} named as gaps")
        if result == "OUT OF DATE":
            stale = True
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
