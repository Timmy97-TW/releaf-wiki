"""Build threat-farmland.webp, the "Farmland" view of the 01 map: every farmland
parcel in one colour, all other land in one pale grey, and a thin grey coastline.

It sits beside the two other views of the same figure, on the same 840 x 1267
canvas, so the markers in home-threat.css hold on all three:
    threat-volatility.webp   the climate volatility index over all land (build/threat-map.py)
    threat-farmland.webp     this file
    threat-farms.webp        the farmland painted in its volatility class (build/threat-farms.py)

Run from the site root, after build/threat-map.py:
    python3 build/threat-farmland.py [out.webp]
Needs numpy, scipy and Pillow.

FARMLAND: the union of the team's QGIS parcel layers (the parcels of Geospatial
  Analysis, Figure 6), both size classes merged; only their alpha is used, so
  farm size plays no part. FARM is --leaf-700.
OTHER LAND and COAST: as in build/threat-farms.py (--th-land, --th-coast).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "assets/img/home/threat-volatility.webp"
PARCELS = ["assets/img/bigpicture/map/smalldim.webp", "assets/img/bigpicture/map/large.webp"]
OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/img/home/threat-farmland.webp"
FARM = np.array((0x23, 0x68, 0x4a), float)                           # --leaf-700
LAND = np.array((0xf5, 0xf5, 0xf5), float)                           # --th-land
COAST = np.array((0xd4, 0xd4, 0xd4), float)                          # --th-coast
COAST_W = 2.0

v = np.array(Image.open(SRC).convert("RGBA")).astype(float)
land = v[..., 3]
H, W = land.shape
farm = np.zeros((H, W))
for p in PARCELS:
    al = np.array(Image.open(p).convert("RGBA"))[..., 3] / 255.0
    farm[:, :al.shape[1]] = np.maximum(farm[:, :al.shape[1]], al)
farm = np.minimum(farm, land / 255.0)[..., None]

rgb = FARM * farm + LAND * (1 - farm)
dist = ndimage.distance_transform_edt(land > 127)
coast = np.clip(COAST_W + 0.5 - dist, 0, 1)[..., None]
rgb = COAST * coast + rgb * (1 - coast)
out = np.dstack([np.clip(np.rint(rgb), 0, 255), land]).astype(np.uint8)
Image.fromarray(out, "RGBA").save(OUT, "WEBP", lossless=True, method=6)
print("wrote", OUT, out.shape)
