#!/usr/bin/env python3
"""Shrink the blueprint ghost SVGs.

These are feature-edge exports: tens of thousands of separate <line> elements,
each spending ~50 characters on attribute names. They are drawn as a background
watermark at 5-8% opacity behind the record text, and hidden entirely below
900px, so nothing about them needs sub-pixel precision.

Two lossless-at-display-size changes: coordinates are rounded to integers (the
viewBox is 1600 wide and the element renders at most 780px, so one unit is
already half a pixel), and consecutive segments that share an endpoint are
chained into one path instead of repeating the boilerplate per segment.
"""
import re, sys, os

def shrink(path):
    s = open(path).read()
    head = s[:s.index('<line')]
    tail = '</g></svg>'
    segs = []
    for m in re.finditer(r'<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/>', s):
        x1, y1, x2, y2 = (round(float(v)) for v in m.groups())
        if (x1, y1) != (x2, y2):                    # drop sub-pixel stubs
            segs.append((x1, y1, x2, y2))

    # chain segments that continue from where the last one ended
    parts, cur = [], None
    for x1, y1, x2, y2 in segs:
        if cur and cur[-1] == (x1, y1):
            cur.append((x2, y2))
        else:
            if cur: parts.append(cur)
            cur = [(x1, y1), (x2, y2)]
    if cur: parts.append(cur)

    d = "".join("M{} {}".format(*p[0]) + "".join("L{} {}".format(*q) for q in p[1:])
                for p in parts)
    out = head + '<path d="' + d + '"/>' + tail
    return out, len(segs), len(parts)

for p in sys.argv[1:]:
    before = os.path.getsize(p)
    out, nseg, npath = shrink(p)
    open(p, "w").write(out)
    after = os.path.getsize(p)
    print(f"  {os.path.basename(p):<28} {nseg:>6} segments -> {npath:>6} chains   "
          f"{before/1024:>6.0f} KB -> {after/1024:>5.0f} KB  ({after/before*100:.0f}%)")
