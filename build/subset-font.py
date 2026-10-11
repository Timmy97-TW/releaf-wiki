#!/usr/bin/env python3
"""Cut assets/fonts/inter-variable.woff2 down to the characters the wiki sets.

    python3 build/subset-font.py [--check]

Inter ships 2,849 codepoints: Cyrillic, Greek Extended, Latin Extended
Additional, the IPA, and some 740 private-use glyphs. The wiki uses 180
characters above ASCII and almost all of them are punctuation, Greek letters
in formulae, arrows, or emoji that no Latin face draws anyway. The whole font
is 165 kB on the wire, and it is on the critical path of every page: it is
preloaded in the homepage's <head> and the opening waits for it.

What is kept:
  · everything the repository's own HTML, CSS, JS and JSON actually contain
    (read fresh on every run, so new writing cannot outrun the subset);
  · ASCII, Latin-1 and Latin Extended-A whole, so a name with an accent that
    nobody has typed yet still sets correctly (precomposed: the wiki has no
    combining marks anywhere, and that block costs 12 kB with its lookups);
  · the Greek letters, the general punctuation block and the few currency,
    arrow and maths signs that go with them.
Both axes (opsz 14-32, wght 100-900) survive: this is a subset of the
character set, not of the design space, so not one letter changes shape or
width. Pinning the optical size would take another 49 kB off, and it was
measured and rejected: it sets the hero's headline 3.6% wider, which moves
every heading on the wiki and risks a new line break at the breakpoints.

--check only reports; without it the file is replaced. Needs fonttools and
brotli (pip install fonttools brotli).
"""
import glob
import html
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
TTF = os.path.join(ROOT, "assets", "fonts", "inter-variable.ttf")
WOFF2 = os.path.join(ROOT, "assets", "fonts", "inter-variable.woff2")
READ = ("**/*.html", "**/*.js", "**/*.css", "**/*.json", "**/*.svg")

# kept whole, whatever the pages happen to say today
RANGES = [
    (0x0020, 0x007E),   # ASCII
    (0x00A0, 0x00FF),   # Latin-1: accented names, deg, micro, times, middot
    (0x0100, 0x017F),   # Latin Extended-A: the rest of Europe's names
    (0x0370, 0x03CE),   # Greek: alpha, beta, mu, pi, sigma, Delta, Omega
    (0x2000, 0x206F),   # general punctuation: the dashes, quotes, prime, bullet
    (0x2070, 0x209F),   # super- and subscripts
    (0x20A0, 0x20BF),   # currency
    (0x2100, 0x214F),   # letterlike: the degree Celsius sign, the trade mark
    (0x2150, 0x218F),   # fractions
    (0x2190, 0x21FF),   # arrows
    (0x2200, 0x22FF),   # maths
    (0x25A0, 0x25FF),   # geometric shapes: the squares and triangles in legends
    (0x2713, 0x2718),   # the ticks and crosses the tables mark results with
]

# The shaping the pages ask for, and nothing else: figure and fraction
# handling, the alternates tokens.css turns on, and the kerning. Keeping
# every feature Inter ships ("*") costs about 9 kB of lookups the site never
# calls for, most of it the thirteen character-variant sets.
FEATURES = ["calt", "case", "ccmp", "cv11", "dnom", "frac", "locl", "numr",
            "ss01", "subs", "sups", "tnum", "zero", "kern", "mark", "mkmk"]


def used():
    seen = set()
    for pat in READ:
        for f in glob.glob(os.path.join(ROOT, pat), recursive=True):
            if os.sep + ".git" + os.sep in f:
                continue
            try:
                seen |= set(html.unescape(open(f, encoding="utf-8", errors="ignore").read()))
            except OSError:
                pass
    return {ord(c) for c in seen}


def main():
    want = used()
    for a, b in RANGES:
        want |= set(range(a, b + 1))
    have = set(TTFont(TTF).getBestCmap())
    keep = sorted(want & have)

    before = os.path.getsize(WOFF2)
    print("the font has %d codepoints; keeping %d" % (len(have), len(keep)))
    if "--check" in sys.argv:
        return

    opt = subset.Options()
    opt.layout_features = FEATURES
    opt.name_IDs = ["*"]
    opt.drop_tables += ["DSIG"]
    opt.retain_gids = False
    opt.notdef_outline = True
    opt.flavor = "woff2"                 # save_font reads this, not font.flavor
    font = subset.load_font(TTF, opt)
    sub = subset.Subsetter(options=opt)
    sub.populate(unicodes=keep)
    sub.subset(font)
    subset.save_font(font, WOFF2, opt)
    after = os.path.getsize(WOFF2)
    print("inter-variable.woff2  %d -> %d bytes (%d%% off)"
          % (before, after, round(100 * (1 - after / before))))


if __name__ == "__main__":
    main()
