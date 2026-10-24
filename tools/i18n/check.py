#!/usr/bin/env python3
"""Check every finished translation against the English it replaces.

A translation is written by hand, so the things that go wrong are mechanical:
a dropped tag, a mangled Jinja call, a straight quote inside an attribute, a
number that changed on the way across. This reports all four.

    python3 -I tools/i18n/check.py           # every page
    python3 -I tools/i18n/check.py plant     # one page
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools" / "i18n" / "src"

TAG = re.compile(r"<[^>]+>")
JINJA = re.compile(r"\{[{%].*?[}%]\}")
NUM = re.compile(r"\d+(?:[.,]\d+)*")
HREF = re.compile(r'href="([^"]*)"')


def tags(s):
    """The tag sequence, attributes and all, with whitespace flattened.

    A translator writing a Jinja call by hand types ' where the extractor
    recorded &#x27;, and build.py resolves both the same way, so the two spell
    the same link.
    """
    s = s.replace("&#x27;", "'").replace("&quot;", '"')
    return [re.sub(r"\s+", " ", t) for t in TAG.findall(s)]


def check(page):
    f = SRC / (page + ".json")
    d = json.loads(f.read_text(encoding="utf-8"))
    out = []
    for i, b in enumerate(d["blocks"]):
        zh = b.get("zh")
        if not zh:
            continue
        en = b["en"]
        if tags(en) != tags(zh):
            out.append((i, "tags", tags(en), tags(zh)))
        elif [j.replace("&#x27;", "'") for j in JINJA.findall(en)] != \
                [j.replace("&#x27;", "'") for j in JINJA.findall(zh)]:
            out.append((i, "jinja", JINJA.findall(en), JINJA.findall(zh)))
        elif ([h.replace("&#x27;", "'") for h in HREF.findall(en)]
              != [h.replace("&#x27;", "'") for h in HREF.findall(zh)]):
            out.append((i, "href", HREF.findall(en), HREF.findall(zh)))
        else:
            # every number in the English should still be there; the Chinese
            # may add its own (月, 第 N 個), so this is one-way
            # a Chinese sentence may write 2 億 9,500 萬 for "295 million",
            # so this is a hint to look, not a failure
            miss = [n for n in NUM.findall(b["text"]) if n not in zh]
            if miss:
                out.append((i, "numbers", miss, ""))
    for i, a in enumerate(d["attrs"]):
        zh = a.get("zh")
        if zh and ('"' in zh or "<" in zh):
            out.append((i, "attr-quote", a["en"][:40], zh[:40]))
    return out


def main(argv):
    pages = argv or sorted(p.stem for p in SRC.glob("*.json")
                           if not p.name.startswith("_"))
    total = 0
    for page in pages:
        rows = check(page)
        if rows:
            print(f"\n{page}: {len(rows)}")
            for i, kind, en, zh in rows[:6]:
                print(f"  {i} {kind}")
                print(f"    en {str(en)[:150]}")
                print(f"    zh {str(zh)[:150]}")
            if len(rows) > 6:
                print(f"  … {len(rows) - 6} more")
        total += len(rows)
    print(f"\n{total} findings across {len(pages)} pages")


if __name__ == "__main__":
    main(sys.argv[1:])
