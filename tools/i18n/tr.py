#!/usr/bin/env python3
"""Read out a page's untranslated strings; write translations back.

    python3 -I tools/i18n/tr.py list <page> [first] [last]
    python3 -I tools/i18n/tr.py todo
    python3 -I tools/i18n/tr.py apply <patch.json>

`list` prints one unit per line: index, b/a, tag, then the markup if the unit
carries any and the plain text if it does not.

A patch is JSON, and `swap` is for a unit whose markup must come through
untouched (a bar chart's tick numbers, a figure's <img>): it replaces only the
English fragments named.

    {"page": "description",
     "blocks": {"7": "<b>一個</b>句子"},
     "swap":   {"14": [["Climate volatility index", "氣候波動度指數"]]},
     "attrs":  {"2": "圖片的中文替代文字"}}
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools" / "i18n" / "src"


def load(page):
    p = SRC / (page + ".json")
    if not p.exists():
        sys.exit("no such page file: " + str(p))
    return p, json.loads(p.read_text(encoding="utf-8"))


def cmd_list(argv):
    page = argv[0]
    first = int(argv[1]) if len(argv) > 1 else 0
    last = int(argv[2]) if len(argv) > 2 else 10 ** 9
    _, d = load(page)
    for i, b in enumerate(d["blocks"]):
        if b["zh"] or not (first <= i <= last):
            continue
        v = b["en"] if "<" in b["en"] else b["text"]
        print(f"{i}\tb\t{b['tag']}\t{v}")
    for i, a in enumerate(d["attrs"]):
        if a["zh"] or not (first <= i <= last):
            continue
        print(f"{i}\ta\t{a['attr']}\t{a['en']}")


def cmd_todo(_argv):
    rows = []
    for p in sorted(SRC.glob("*.json")):
        if p.name.startswith("_"):
            continue
        d = json.loads(p.read_text(encoding="utf-8"))
        units = d["blocks"] + d["attrs"]
        left = [u for u in units if not u["zh"]]
        words = sum(len(u.get("text", u["en"]).split()) for u in left)
        if left:
            rows.append((words, len(left), len(units), p.stem))
    rows.sort(reverse=True)
    print(f"{'words':>7} {'left':>6} {'of':>6}  page")
    for w, l, t, n in rows:
        print(f"{w:>7} {l:>6} {t:>6}  {n}")
    print(f"\n{sum(r[0] for r in rows):>7} words left in {len(rows)} pages")


def cmd_apply(argv):
    """Write a patch in, and refuse to paint over work already done.

    The unit lists renumber whenever the extractor learns a new kind of
    string, so an index written against an older list can land on the wrong
    unit. A patch may only fill an empty zh; set "force": true to mean it.
    """
    patch = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    path, d = load(patch["page"])
    force = patch.get("force", False)
    n = 0

    def guard(unit, i, kind):
        if unit["zh"] and not force:
            sys.exit(f"{patch['page']} {kind} {i} already reads "
                     f"{unit['zh'][:40]!r} for {unit.get('text', unit['en'])[:40]!r}"
                     f" — indices have moved; re-read the list")
    for i, zh in patch.get("blocks", {}).items():
        guard(d["blocks"][int(i)], i, "block")
        d["blocks"][int(i)]["zh"] = zh
        n += 1
    for i, pairs in patch.get("swap", {}).items():
        guard(d["blocks"][int(i)], i, "block")
        s = d["blocks"][int(i)]["en"]
        for en, zh in pairs:
            if en not in s:
                sys.exit(f"{patch['page']} block {i}: {en!r} is not in {s!r}")
            s = s.replace(en, zh)
        d["blocks"][int(i)]["zh"] = s
        n += 1
    for i, zh in patch.get("attrs", {}).items():
        guard(d["attrs"][int(i)], i, "attr")
        d["attrs"][int(i)]["zh"] = zh
        n += 1
    path.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")
    units = d["blocks"] + d["attrs"]
    done = sum(1 for u in units if u["zh"])
    print(f"{patch['page']}: +{n}, now {done}/{len(units)}")




def cmd_reuse(argv):
    """Fill a unit whose English is built out of strings already translated.

    The technical map on /description, the entry cards on several hubs and the
    hub tiles repeat a heading and a sentence that appear in full elsewhere on
    the same page. Rather than translate them twice, substitute the Chinese of
    every translated unit whose text appears inside this one, and report what
    is left so a person can look.
    """
    page = argv[0]
    write = "--write" in argv
    path, d = load(page)
    known = []
    for u in d["blocks"] + d["attrs"]:
        t = u.get("text", u["en"])
        if u["zh"] and "<" not in t and "<" not in u["zh"] and len(t) > 2:
            known.append((t, u["zh"]))
    known.sort(key=lambda kv: -len(kv[0]))
    import re as _re
    filled = left = 0
    for i, u in enumerate(d["blocks"]):
        if u["zh"]:
            continue
        s = u["en"]
        hit = 0
        for en, zh in known:
            if en in s:
                s = s.replace(en, zh)
                hit += 1
        if not hit:
            continue
        # what English prose is still in there, outside the tags?
        rest = _re.sub(r"<[^>]+>", " ", s)
        rest = _re.sub(r"\{[{%].*?[}%]\}", " ", rest)
        words = [w for w in _re.findall(r"[A-Za-z][A-Za-z'’-]{3,}", rest)]
        if words:
            print(f"{i}\tLEFT\t{' '.join(words[:8])}\t{s[:160]}")
            left += 1
        else:
            if write:
                u["zh"] = s
            filled += 1
    if write:
        path.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8")
    print(f"{page}: {filled} filled{' (written)' if write else ' (dry run)'}, "
          f"{left} still hold English")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    {"list": cmd_list, "todo": cmd_todo, "apply": cmd_apply,
     "reuse": cmd_reuse}[sys.argv[1]](sys.argv[2:])
