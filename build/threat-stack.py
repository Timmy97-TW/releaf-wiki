"""Build the four layers that animate the "All" view of the 01 map: three
threats stacking on the farmland one at a time. Same canvas, land, farmland and
coast as build/threat-all.py (see build/threat_common.py).

Run from the site root, after build/threat-map.py:
    python3 build/threat-stack.py
Needs numpy, scipy and Pillow.

    threat-stack-base.webp    land --th-land, 2 px --th-coast, all farmland in BASE
    threat-stack-vol.webp     every farmland pixel in VOL_HUE, alpha by its volatility class
    threat-stack-nights.webp  every farmland pixel in NIGHT_HUE, alpha by its Figure 4 class
    threat-stack-age.webp     every farmland pixel in AGE_HUE, alpha by its Figure 5 class

GRADED, NOT THRESHOLDED: no farmland is left out of a layer. Each layer's
classes are spread over 0..1 (t = (class - 1) / (n - 1)) and lifted by a FLOOR
so the lowest class still tints a little:
    alpha = A_MAX * (FLOOR + (1 - FLOOR) * t) ** GAMMA
  volatility  classes 1-5 of threat-volatility.webp, per pixel (build/threat-map.py;
              class 1 holds no farmland)
  nights      Figure 4 classes 1-5 (NIGHTS in build/threat-nights.py)
  age         the three classes Figure 5 draws on the main island, 55 / 56 / 57
              (AGE in build/threat-age.py), spread over 0..1 like the others
Stacked with CSS mix-blend-mode: multiply, each layer scales the colour under it
by 1 - alpha * (1 - hue / 255) per channel, so the three multiply together:
farmland low on every layer stays a warm light tan, farmland high on two or
three turns a dark red-brown. The hues are three steps of the site's rust
(--vol-5 and two neighbours) so the order of arrival still reads. GAMMA > 1
keeps the low classes light, so coinciding high classes separate from the rest.
With A_MAX 0.94, FLOOR 0.10, GAMMA 1.5 the full stack over farmland, from
lightest to darkest (5th / 20th / 50th / 75th / 95th percentile of darkness):
    #be9986   #9b6351   #883f29   #712a18   #480d06 (also the darkest pixel)
Edges are the parcel alpha as drawn, with no blur; the coast line is cut out so
it stays grey.
"""
import importlib
import numpy as np
from PIL import Image
from scipy import ndimage
import threat_common as T

DIR = "assets/img/home/"
BASE = T.hexrgb("#e4dfcf")
VOL_HUE = T.hexrgb("#9a3d22")                                       # --vol-5, rust
NIGHT_HUE = T.hexrgb("#b5532a")                                     # warm orange-red
AGE_HUE = T.hexrgb("#7a2a1a")                                       # deep brick
A_MAX = 0.94
FLOOR = 0.10
GAMMA = 1.5

NIGHTS = importlib.import_module("threat-nights").NIGHTS
AGE = importlib.import_module("threat-age")


def alpha(cls, n):
    """class index 0..n-1 per pixel -> layer alpha 0..1."""
    t = np.clip(cls, 0, n - 1) / (n - 1)
    return A_MAX * (FLOOR + (1 - FLOOR) * t) ** GAMMA


def save(name, hue, a):
    rgb = np.broadcast_to(hue, a.shape + (3,))
    img = np.dstack([np.clip(np.rint(rgb), 0, 255), np.clip(np.rint(255 * a), 0, 255)]).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(DIR + name, "WEBP", lossless=True, method=6, exact=False)
    print("wrote", DIR + name)


if __name__ == "__main__":
    land, vol, farm = T.canvas()
    lab, names = T.counties(land)
    T.paint(DIR + "threat-stack-base.webp", land, farm, np.broadcast_to(BASE, land.shape + (3,)))
    nights = T.per_county(lab, names, {k: v - 1 for k, v in NIGHTS.items()}, default=0)
    age = T.per_county(lab, names, {k: AGE.LABELS.index(v) for k, v in AGE.AGE.items()}, default=0)
    dist = ndimage.distance_transform_edt(land > 127)
    keep = farm * (1 - np.clip(T.COAST_W + 0.5 - dist, 0, 1))          # parcel alpha, coast cut out
    save("threat-stack-vol.webp", VOL_HUE, keep * alpha(vol, 5))
    save("threat-stack-nights.webp", NIGHT_HUE, keep * alpha(nights, 5))
    save("threat-stack-age.webp", AGE_HUE, keep * alpha(age, 3))
