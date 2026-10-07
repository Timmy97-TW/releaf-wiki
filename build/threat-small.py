"""Build the two later frames of the 01 map's scroll sequence (7 Oct):

    threat-small.webp      every small-scale parcel (under 2 ha) in --leaf-700
    threat-converge.webp   the same parcels, each painted in the class of the
                           climate volatility index it sits in

Frame 1 is threat-volatility.webp (build/threat-map.py). All three share the
840 x 1267 canvas, so they crossfade in place.

Run from the site root, after build/threat-map.py:
    python3 build/threat-small.py
Needs numpy, scipy and Pillow.

SMALL-SCALE PARCELS: assets/img/bigpicture/map/smalldim.webp alone, the team's
  QGIS layer of parcels under two hectares (Geospatial Analysis, Figure 6;
  --parcel-small in the old big-picture atlas). Only its alpha is used. The
  QGIS export stops at x = 800, so the few parcels on the north-east cape
  beyond it are not drawn.
CLASSES, OTHER LAND and COAST: exactly as build/threat-farms.py, so the
  Convergence frame reads with the volatility ramp in the key.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "assets/img/home/threat-volatility.webp"
SMALL = "assets/img/bigpicture/map/smalldim.webp"
DIR = "assets/img/home/"
VOL = np.array([(0xec, 0xea, 0xdf), (0xdd, 0xd8, 0xc2), (0xcb, 0xbf, 0x98),
                (0xc2, 0x98, 0x4e), (0x9a, 0x3d, 0x22)], float)       # --vol-1..5
FARM = np.array((0x23, 0x68, 0x4a), float)                           # --leaf-700
LAND = np.array((0xf5, 0xf5, 0xf5), float)                           # --th-land
COAST = np.array((0xd4, 0xd4, 0xd4), float)                          # --th-coast
COAST_W = 2.0

v = np.array(Image.open(SRC).convert("RGBA")).astype(float)
land = v[..., 3]
cls = np.sqrt(((v[..., None, :3] - VOL[None, None]) ** 2).sum(-1)).argmin(-1)
H, W = land.shape
farm = np.zeros((H, W))
al = np.array(Image.open(SMALL).convert("RGBA"))[..., 3] / 255.0
farm[:, :al.shape[1]] = al
farm = np.minimum(farm, land / 255.0)[..., None]

dist = ndimage.distance_transform_edt(land > 127)
coast = np.clip(COAST_W + 0.5 - dist, 0, 1)[..., None]


def save(name, paint):
    rgb = paint * farm + LAND * (1 - farm)
    rgb = COAST * coast + rgb * (1 - coast)
    out = np.dstack([np.clip(np.rint(rgb), 0, 255), land]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(DIR + name, "WEBP", lossless=True, method=6)
    print("wrote", DIR + name, out.shape)


save("threat-small.webp", FARM)
save("threat-converge.webp", VOL[cls])
