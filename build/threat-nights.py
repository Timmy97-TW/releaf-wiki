"""Build threat-nights.webp, the "Hot nights" view of the 01 map: the farmland
painted in its county's class of night temperature, all other land in one pale
grey, and a thin grey coastline. Same canvas, land, farmland and coast as
threat-farms.py (see build/threat_common.py).

Run from the site root, after build/threat-map.py:
    python3 build/threat-nights.py [out.webp]
Needs numpy, scipy and Pillow.

CLASSES: Geospatial Analysis, Figure 4 (assets/img/geospatial/
  night-temp-yield-2013-2016.webp), "Nighttime temperatures (18:00-00:00)",
  2013 to 2016, five classes in degrees C. Each county's class was read off the
  figure by eye and checked by registering the figure onto this canvas and
  counting legend-coloured pixels inside each county (every county with a
  readable fill came out 99 to 100 % one class). Two small cities sit under the
  figure's white yield circles:
    Chiayi City is unreadable and takes Chiayi County's class;
    Hsinchu City shows red around its circles on the coast (the pixel count
    there is a handful of blended pixels) and is taken as red.
  Note: the figure puts Yilan in the coolest class, although the sub-page's
  text says it sits in the high-risk night band. The map follows the figure.
COLOURS: the site's volatility ramp (--vol-2..--vol-5) with one step between
  --vol-4 and --vol-5. --vol-1 is not used: at 1.08:1 against --th-land the
  coolest farmland would vanish, and here the coolest class holds the most
  farmland.
"""
import sys
import numpy as np
import threat_common as T

OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/img/home/threat-nights.webp"
BREAKS = ["20.51-24.22", "24.22-25.36", "25.36-25.89", "25.89-26.53", "26.53-27.26"]   # Figure 4 legend
RAMP = [T.hexrgb(h) for h in ("#ddd8c2", "#cbbf98", "#c2984e", "#ae6a38", "#9a3d22")]

# Figure 4 class per county, 1 = 20.51-24.22 ... 5 = 26.53-27.26 (degrees C)
NIGHTS = {
    "Keelung City": 5, "Taipei City": 4, "New Taipei City": 4, "Taoyuan City": 4,
    "Hsinchu City": 5, "Hsinchu County": 5, "Miaoli County": 2, "Taichung City": 4,
    "Changhua County": 1, "Nantou County": 1, "Yunlin County": 2,
    "Chiayi County": 1, "Chiayi City": 1,          # Chiayi City under a circle: Chiayi County's class
    "Tainan City": 1, "Kaohsiung City": 3, "Pingtung County": 5,
    "Yilan County": 1, "Hualien County": 3, "Taitung County": 3,
    "Penghu County": 5,                            # red in Figure 4; not on this canvas
}

if __name__ == "__main__":
    land, _, farm = T.canvas()
    lab, names = T.counties(land)
    cls = T.per_county(lab, names, {k: v - 1 for k, v in NIGHTS.items()}, default=0)
    T.paint(OUT, land, farm, np.array(RAMP)[cls])
    T.shares(land, farm, cls, 5, "nights")
