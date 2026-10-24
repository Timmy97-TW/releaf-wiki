#!/usr/bin/env python3
"""Turn the translator files into what the browser fetches.

    tools/i18n/src/<page>.json   en + zh, indented: what a translator and a
                                 reviewer read. Not served, so the frozen site
                                 does not carry the English twice.
    static/i18n/<page>.zh.json   only the finished zh strings, on one line:
                                 what i18n.js fetches.

The runtime file holds no English, so it stays small: the keys are the hashes
i18n.js computes from the page itself.

    {"v":1,"b":{"<hash>:<n>":"<zh html>"},"a":{"<attr>|<hash>:<n>":"<zh>"},
     "t":"<title>","d":"<meta description>","n":<translated>,"m":<total>}

tools/i18n/src/_ui.json holds the strings no page file can hold, because the nav
card and the contents rail are drawn by JavaScript: they are merged into every
page's runtime file, so one fetch covers the whole page.

    python3 -I tools/i18n/build.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools" / "i18n" / "src"
OUT = ROOT / "static" / "i18n"

SPACE = re.compile(r"[\s     ]+")

# A data-* string is read by a page's own script and written into the page as
# text. That script runs before i18n.js, so the words are already on screen by
# the time we look: put the translation in the text dictionary too, where the
# pass over the script-drawn regions will find it by hash.
MIRROR = ("data-toc", "data-label", "data-cap", "data-name", "data-title",
          "data-role", "data-en")



def norm(s: str) -> str:
    return SPACE.sub(" ", s).strip()


# A translation is written against the page SOURCE, so a link in it still
# carries the Jinja the source carries. The browser gets the translation as
# markup long after Flask has rendered the page, so the Jinja has to be
# resolved here or the href lands in the DOM as literal text and the link
# breaks. Pages are flat, and the English renders as "./<page>", so this
# produces exactly what the server produced.
Q = r"(?:&#x27;|'|&quot;|\")"
URLFOR_PAGE = re.compile(
    r"\{\{\s*url_for\(\s*" + Q + r"pages" + Q + r"\s*,\s*page\s*=\s*"
    + Q + r"([A-Za-z0-9_-]+)" + Q + r"\s*\)\s*\}\}")
URLFOR_STATIC = re.compile(
    r"\{\{\s*url_for\(\s*" + Q + r"static" + Q + r"\s*,\s*filename\s*=\s*"
    + Q + r"([^'\"&]+)" + Q + r"\s*\)\s*\}\}")


def resolve(html: str) -> str:
    html = URLFOR_PAGE.sub(lambda m: "./" + m.group(1), html)
    return URLFOR_STATIC.sub(lambda m: "static/" + m.group(1), html)


def key(s: str) -> str:
    h = 0xCBF29CE484222325
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return format(h, "016x")


def ui() -> tuple[dict, dict]:
    """The shared strings: nav, footer, and the copy that lives in JavaScript.

    Every _ui*.json is merged, so a component whose text sits in a JS data
    file (the bioreactor scroll scene, the notebook's tag list, the roster)
    can have its own file and be translated without fighting over one.
    """
    b, a = {}, {}
    for f in sorted(SRC.glob("_ui*.json")):
        _merge_ui(json.loads(f.read_text(encoding="utf-8")), b, a)
    return b, a


def _merge_ui(d, b, a):
    for e in d.get("blocks", []):
        if e.get("zh"):
            b.setdefault(key(norm(e["en"])) + ":0", resolve(e["zh"]))
    for e in d.get("attrs", []):
        if e.get("zh"):
            a.setdefault(e["attr"] + "|" + key(norm(e["en"])) + ":0", e["zh"])
            if e["attr"] in MIRROR:
                b.setdefault(key(norm(e["en"])) + ":0", e["zh"])


def main(argv):
    ub, ua = ui()
    OUT.mkdir(parents=True, exist_ok=True)
    names = argv or sorted(p.stem for p in SRC.glob("*.json")
                           if not p.name.startswith("_"))
    tot = done = 0
    for name in names:
        src = SRC / (name + ".json")
        if not src.exists():
            print("no such page file:", name)
            continue
        d = json.loads(src.read_text(encoding="utf-8"))
        b, a = dict(ub), dict(ua)
        t = dd = ""
        n = m = 0
        for e in d.get("blocks", []):
            m += 1
            if not e.get("zh"):
                continue
            n += 1
            if e["tag"] == "#title":
                t = e["zh"]
            elif e["tag"] == "#description":
                dd = e["zh"]
            else:
                b[e["k"] + ":" + str(e["n"])] = resolve(e["zh"])
        for e in d.get("attrs", []):
            m += 1
            if e.get("zh"):
                n += 1
                a[e["attr"] + "|" + e["k"] + ":" + str(e["n"])] = e["zh"]
                if e["attr"] in MIRROR:
                    b.setdefault(e["k"] + ":0", e["zh"])
        out = {"v": 1, "b": b, "a": a, "n": n, "m": m}
        if t:
            out["t"] = t
        if dd:
            out["d"] = dd
        p = OUT / (name + ".zh.json")
        p.write_text(json.dumps(out, ensure_ascii=False,
                                separators=(",", ":")) + "\n",
                     encoding="utf-8")
        tot += m
        done += n
        pct = (100 * n / m) if m else 0
        print(f"{name:46s} {n:5d}/{m:5d} {pct:5.1f}%  "
              f"{p.stat().st_size // 1024:4d} KB")
    pct = (100 * done / tot) if tot else 0
    print(f"\n{'TOTAL':46s} {done:5d}/{tot:5d} {pct:5.1f}% translated")


if __name__ == "__main__":
    main(sys.argv[1:])
