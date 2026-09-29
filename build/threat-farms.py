"""Build threat-farms.webp, the 01 map: the farmland painted in its class of the
climate volatility index, all other land in one pale grey, and a thin grey
coastline. Colour on the map sits only where there are farms.

Run from the site root, after build/threat-map.py:
    python3 build/threat-farms.py [out.webp]
Needs numpy, scipy and Pillow. Output: 840 x 1267 RGBA, lossless WebP, the same
canvas as threat-volatility.webp, so the marker positions in home-threat.css hold.

CLASSES: read back from assets/img/home/threat-volatility.webp, which
  build/threat-map.py paints in exactly the five --vol-* colours from the
  sub-page's Figure 7 (Geospatial Analysis). Nothing about the classes changes.
  Class 1 (0.38-0.49) does not occur on the main island, so no farmland is in it.
FARMLAND: the union of the team's QGIS parcel layers
  assets/img/bigpicture/map/smalldim.webp and large.webp (all parcels, both
  size classes; only their alpha is used, so farm size plays no part). These
  are the parcels of the sub-page's Figure 8 ("Every farmland parcel on the
  main island", Ministry of Agriculture parcel map). The QGIS export stops at
  x = 800, so the few parcels on the north-east cape beyond it are not drawn.
OTHER LAND: LAND below, which is --gray-100 and must equal --th-land in
  home-threat.css. It is lighter than every class that holds farmland, so the
  steadiest farmland (class 2, #ddd8c2) keeps 1.31:1 against it and differs in
  hue (warm against neutral). A darker neutral cannot do that: it would have to
  sit between two classes and collide with one of them.
COAST: a 2 px line in COAST (--gray-300, = --th-coast) inside the coastline,
  because the pale land alone is only 1.09:1 against the white page. The
  coastline itself is the alpha of threat-volatility.webp (unchanged).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "assets/img/home/threat-volatility.webp"
PARCELS = ["assets/img/bigpicture/map/smalldim.webp", "assets/img/bigpicture/map/large.webp"]
OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/img/home/threat-farms.webp"
VOL = np.array([(0xec, 0xea, 0xdf), (0xdd, 0xd8, 0xc2), (0xcb, 0xbf, 0x98),
                (0xc2, 0x98, 0x4e), (0x9a, 0x3d, 0x22)], float)       # --vol-1..5
LAND = np.array((0xf5, 0xf5, 0xf5), float)                           # --th-land  (--gray-100)
COAST = np.array((0xd4, 0xd4, 0xd4), float)                          # --th-coast (--gray-300)
COAST_W = 2.0                                                        # px on this canvas

v = np.array(Image.open(SRC).convert("RGBA")).astype(float)
land = v[..., 3]
cls = np.sqrt(((v[..., None, :3] - VOL[None, None]) ** 2).sum(-1)).argmin(-1)
H, W = land.shape

farm = np.zeros((H, W))
for p in PARCELS:
    al = np.array(Image.open(p).convert("RGBA"))[..., 3] / 255.0
    farm[:, :al.shape[1]] = np.maximum(farm[:, :al.shape[1]], al)
farm = np.minimum(farm, land / 255.0)[..., None]

rgb = VOL[cls] * farm + LAND * (1 - farm)
dist = ndimage.distance_transform_edt(land > 127)          # px to the sea
coast = np.clip(COAST_W + 0.5 - dist, 0, 1)[..., None]
rgb = COAST * coast + rgb * (1 - coast)
out = np.dstack([np.clip(np.rint(rgb), 0, 255), land]).astype(np.uint8)
Image.fromarray(out, "RGBA").save(OUT, "WEBP", lossless=True, method=6)

# For checking the picture only. None of these shares is on a sub-page, so none
# of them may be printed on the homepage.
isl = land > 127
f = (farm[..., 0] > .5) & isl
print("wrote", OUT, out.shape)
print("farmland share of land %.3f" % (f.sum() / isl.sum()))
print("per class 1..5: share of farmland", [round(float((f & (cls == k)).sum() / f.sum()), 3) for k in range(5)],
      " share of all land", [round(float((isl & (cls == k)).sum() / isl.sum()), 3) for k in range(5)])
