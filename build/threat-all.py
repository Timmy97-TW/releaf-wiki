"""Build threat-all.webp, the "All" view of the 01 map: each farmland pixel
painted by how many of three threats sit on it, all other land in one pale grey,
and a thin grey coastline. Same canvas, land, farmland and coast as
threat-farms.py (see build/threat_common.py).

Run from the site root, after build/threat-map.py:
    python3 build/threat-all.py [out.webp]
Needs numpy, scipy and Pillow.

THE THREE THREATS, each read from the layer that draws it and nothing else:
  a. climate volatility in the top two classes, 0.71-0.82 and 0.82-0.93
     (--vol-4, --vol-5 in threat-volatility.webp, build/threat-map.py);
  b. night temperature in Figure 4's top two classes, 25.89-26.53 and
     26.53-27.26 degrees C (NIGHTS in build/threat-nights.py);
  c. average farmer age in the oldest class Figure 5 draws on the main island,
     57 (AGE in build/threat-age.py). The legend's two oldest swatches (59, 61)
     hold no county, so "the two oldest classes" read literally is empty; the
     oldest class actually drawn is used instead. OLD_AGE widens it if wanted.
COLOURS: 0 --vol-2, 1 --vol-4, 2 --vol-5, 3 a deeper rust.
"""
import importlib
import sys
import numpy as np
import threat_common as T

OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/img/home/threat-all.webp"
OLD_AGE = {57}
RAMP = [T.hexrgb(h) for h in ("#ddd8c2", "#c2984e", "#9a3d22", "#521a10")]

NIGHTS = importlib.import_module("threat-nights").NIGHTS
AGE = importlib.import_module("threat-age").AGE

if __name__ == "__main__":
    land, vol, farm = T.canvas()
    lab, names = T.counties(land)
    a = vol >= 3
    b = T.per_county(lab, names, {k: int(v >= 4) for k, v in NIGHTS.items()}, default=0) == 1
    c = T.per_county(lab, names, {k: int(v in OLD_AGE) for k, v in AGE.items()}, default=0) == 1
    n = a.astype(int) + b + c
    T.paint(OUT, land, farm, np.array(RAMP)[n])
    T.shares(land, farm, n, 4, "threats stacked 0/1/2/3")
    f = (farm > .5) & (land > 127)
    for nm in names:
        m = f & (lab == names.index(nm) + 1)
        if m.sum():
            print("  %-16s a %.2f b %.2f c %.2f  stacked>=2 %.2f" % (nm, a[m].mean(), b[m].mean(), c[m].mean(), (n[m] >= 2).mean()))
