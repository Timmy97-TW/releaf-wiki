"""Build the four layers that animate the "All" view of the 01 map: threats
stacking on the farmland one at a time. Same canvas, land, farmland and coast as
build/threat-all.py (see build/threat_common.py); same three thresholds.

Run from the site root, after build/threat-map.py:
    python3 build/threat-stack.py
Needs numpy, scipy and Pillow.

    threat-stack-base.webp    land --th-land, 2 px --th-coast, all farmland in BASE
    threat-stack-vol.webp     transparent except farmland in the top two volatility classes
    threat-stack-nights.webp  transparent except farmland in Figure 4's classes 4-5
    threat-stack-age.webp     transparent except farmland in the oldest class drawn (57)

The three threat layers are one rust (--vol-5) at alpha ALPHA, meant to be laid
over the base with CSS mix-blend-mode: multiply. Per channel each layer scales
the base by 1 - ALPHA * (1 - rust/255), so with BASE #e4dfcf:
    one layer   #a56851     two layers  #773120     three  #56170d (none on the map)
Two layers land near threat-all's darkest step. Edges are the parcel alpha as
drawn, with no blur; the coast line is cut out so it stays grey.
"""
import importlib
import numpy as np
from PIL import Image
from scipy import ndimage
import threat_common as T

DIR = "assets/img/home/"
BASE = T.hexrgb("#e4dfcf")
RUST = T.hexrgb("#9a3d22")                                          # --vol-5
ALPHA = 0.70

ALL = importlib.import_module("threat-all")


def save(name, rgb, alpha):
    img = np.dstack([np.clip(np.rint(rgb), 0, 255), np.clip(np.rint(alpha), 0, 255)]).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(DIR + name, "WEBP", lossless=True, method=6, exact=False)
    print("wrote", DIR + name)


if __name__ == "__main__":
    land, vol, farm = T.canvas()
    lab, names = T.counties(land)
    T.paint(DIR + "threat-stack-base.webp", land, farm, np.broadcast_to(BASE, land.shape + (3,)))
    masks = {
        "vol": vol >= 3,
        "nights": T.per_county(lab, names, {k: int(v >= 4) for k, v in ALL.NIGHTS.items()}, default=0) == 1,
        "age": T.per_county(lab, names, {k: int(v in ALL.OLD_AGE) for k, v in ALL.AGE.items()}, default=0) == 1,
    }
    dist = ndimage.distance_transform_edt(land > 127)
    notcoast = 1 - np.clip(T.COAST_W + 0.5 - dist, 0, 1)
    rgb = np.broadcast_to(RUST, land.shape + (3,))
    for k, m in masks.items():
        save("threat-stack-%s.webp" % k, rgb, 255 * ALPHA * farm * notcoast * m)
