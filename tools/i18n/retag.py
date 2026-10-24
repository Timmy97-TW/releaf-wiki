#!/usr/bin/env python3
"""Put back the inline tags a translation dropped, where it is safe to.

A hand-written translation sometimes loses an <i>, a <sup> or a link: the
words are right, the markup is not. Most of those are mechanical to repair,
because what the tag wrapped survives in the Chinese unchanged — a Latin
binomial, an exponent, a number. This re-wraps exactly those and leaves
anything it cannot be sure of to a person.

    python3 -I tools/i18n/retag.py <page> [...]   # report
    python3 -I tools/i18n/retag.py --write <page>
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools" / "i18n" / "src"
TAG = re.compile(r"<[^>]+>")
PAIR = re.compile(r"<(i|b|sup|sub|em|strong|small|code)>(.*?)</\1>", re.S)


def tags(s):
    s = s.replace("&#x27;", "'")
    return [re.sub(r"\s+", " ", t) for t in TAG.findall(s)]


# What an <i> usually wraps, and what the Chinese calls it. A translation
# that rendered the Latin into Chinese dropped the tag with it; these put it
# back on the Chinese word.
SAME = {
    "Arabidopsis thaliana": ["阿拉伯芥"],
    "Arabidopsis": ["阿拉伯芥"],
    "Bacillus subtilis": ["枯草桿菌"],
    "B. subtilis": ["枯草桿菌"],
    "Pseudomonas putida": ["惡臭假單胞菌"],
    "Bacillus": ["芽孢桿菌"],
    "Escherichia coli": ["大腸桿菌"],
    "E. coli": ["大腸桿菌"],
}


def fix(en, zh):
    """Return a repaired zh, or None when this one needs a person."""
    out = zh
    for m in PAIR.finditer(en):
        tag, inner = m.group(1), m.group(2)
        if TAG.search(inner):
            continue                      # nested: leave it alone
        whole = m.group(0)
        if whole in out:
            continue                      # already there
        plain = inner.strip()
        if len(plain) < 2 or not re.search(r"[A-Za-z0-9]", plain):
            continue
        # the wrapped text has to survive in the Chinese, exactly once, and
        # not already be inside a tag of its own
        target = plain
        if out.count(target) != 1:
            # the translation may carry the Chinese name instead
            for alt in SAME.get(plain, []):
                if out.count(alt) == 1:
                    target = alt
                    break
            else:
                continue
        at = out.index(target)
        plain = target
        before, after = out[:at], out[at + len(plain):]
        if before.count("<") != before.count(">"):
            continue
        out = before + "<" + tag + ">" + plain + "</" + tag + ">" + after
    return out if tags(out) == tags(en) else None


def main(argv):
    write = "--write" in argv
    pages = [a for a in argv if not a.startswith("--")]
    for page in pages:
        p = SRC / (page + ".json")
        d = json.loads(p.read_text(encoding="utf-8"))
        fixed = left = 0
        for i, b in enumerate(d["blocks"]):
            if not b.get("zh") or tags(b["en"]) == tags(b["zh"]):
                continue
            repaired = fix(b["en"], b["zh"])
            if repaired:
                if write:
                    b["zh"] = repaired
                fixed += 1
            else:
                left += 1
                print(f"  {page} {i}: needs a person")
                print(f"    en {b['en'][:120]}")
                print(f"    zh {b['zh'][:120]}")
        if write and fixed:
            p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n",
                         encoding="utf-8")
        print(f"{page}: {fixed} re-tagged{' (written)' if write else ''}, "
              f"{left} for a person")


if __name__ == "__main__":
    main(sys.argv[1:])
