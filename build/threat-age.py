"""Build threat-age.webp, the "Ageing farmers" view of the 01 map: the farmland
painted in its county's class of average farmer age (2016), all other land in
one pale grey, and a thin grey coastline. Same canvas, land, farmland and coast
as threat-farms.py (see build/threat_common.py).

Run from the site root, after build/threat-map.py:
    python3 build/threat-age.py [out.webp]
Needs numpy, scipy and Pillow.

CLASSES: Geospatial Analysis, Figure 5 (assets/img/geospatial/farmer-age-heat.webp),
  "Average Age of Farmers in Each County in 2016 (years)". The legend has seven
  swatches labelled 55, 56, 57, 58, 59, 61 (the seventh unlabelled). On the main
  island only the first three are drawn: 55, 56 and 57. Each county was read off
  the figure by eye and checked by registering the figure onto this canvas and
  counting legend-coloured pixels inside each county (96 to 100 % one class).
  Three small cities sit under the figure's red station circles and cannot be
  read: Taipei City and Keelung City take New Taipei's class, Chiayi City takes
  Chiayi County's. Together they hold well under 1 % of the farmland drawn.
COLOURS: --vol-2, --vol-4, --vol-5 (the three classes drawn, evenly apart in
  lightness; --vol-1 would vanish against --th-land).
"""
import sys
import numpy as np
import threat_common as T

OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/img/home/threat-age.webp"
LABELS = [55, 56, 57]                                  # Figure 5 legend swatches 1-3
RAMP = [T.hexrgb(h) for h in ("#ddd8c2", "#c2984e", "#9a3d22")]

# Figure 5 average farmer age per county, 2016, as the legend label of its swatch
AGE = {
    "Keelung City": 56, "Taipei City": 56,         # under station circles: New Taipei's class
    "New Taipei City": 56, "Taoyuan City": 56, "Hsinchu City": 56, "Hsinchu County": 56,
    "Miaoli County": 57, "Taichung City": 55, "Changhua County": 56, "Nantou County": 55,
    "Yunlin County": 56, "Chiayi County": 56,
    "Chiayi City": 56,                             # under a station circle: Chiayi County's class
    "Tainan City": 57, "Kaohsiung City": 56, "Pingtung County": 55,
    "Yilan County": 57, "Hualien County": 56, "Taitung County": 55,
}

if __name__ == "__main__":
    land, _, farm = T.canvas()
    lab, names = T.counties(land)
    cls = T.per_county(lab, names, {k: LABELS.index(v) for k, v in AGE.items()}, default=0)
    T.paint(OUT, land, farm, np.array(RAMP)[cls])
    T.shares(land, farm, cls, 3, "age 55/56/57")
