"""Rebuild assets/img/home/threat-volatility.webp, the one raster behind the 01 map.

Run from the site root:  python3 build/threat-map.py [out.webp]
Needs numpy, scipy and Pillow. Output: 840 x 1267 RGBA, lossless WebP.

The CLASSES come from the sub-page's own figure, and nowhere else.
  Geospatial Analysis, Figure 7 (assets/img/geospatial/volatility-vs-yield.webp),
  left panel: the climate volatility index in five classes, 0.38-0.49,
  0.49-0.60, 0.60-0.71, 0.71-0.82 and 0.82-0.93, drawn in the five legend
  colours below. A pixel of that panel is taken as a class only when
    * it is within 28 (RGB distance) of one legend colour,
    * it is not a rice dot, a dot's white rim, a river, a road or a border
      (black and grey pixels, white pixels, each grown by one pixel), and
    * it survives a 3 x 3 opening and sits in a patch of at least 6 pixels,
      which removes the thin blends where a dark line crosses a fill and
      would otherwise read as the darkest class.
  Every other pixel (under the dots, lines and borders) takes the class of
  the nearest pixel that was taken, and a 5 x 5 majority smooths the seams.
  Class 1 (0.38-0.49) is not found anywhere on the main island in Figure 7.

The COASTLINE comes from the team's QGIS layers, which are sharper than the
  figure: the union of assets/img/bigpicture/map/{base,smalldim,large,v1-v5,
  sb1-sb5}.webp. Only their alpha is used here, never their colours or their
  classes. The QGIS export clipped the north-east cape at x = 800; that strip
  of coastline is taken from the sub-page's Figure 8
  (assets/img/geospatial/farmland-volatility.webp), registered on five
  landmarks (residual under 3 px).
  Penghu and the islets west of the main island are left off: Figure 7 draws
  them in grey with no readable class, and the old export clipped them.

REGISTRATION of Figure 7 onto this raster: a six-parameter affine fitted by
  matching the two main-island coastlines (chamfer distance, Powell). Median
  residual about 1.5 px on this 840 x 1267 canvas.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage, optimize

SRC = "assets/img/bigpicture/map/"
FIG7 = "assets/img/geospatial/volatility-vs-yield.webp"
FIG8 = "assets/img/geospatial/farmland-volatility.webp"
OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/img/home/threat-volatility.webp"
VOL = np.array([(0xec, 0xea, 0xdf), (0xdd, 0xd8, 0xc2), (0xcb, 0xbf, 0x98),
                (0xc2, 0x98, 0x4e), (0x9a, 0x3d, 0x22)], np.uint8)   # --vol-1..5
LEG7 = np.array([(255, 245, 240), (255, 188, 161), (255, 100, 69),
                 (231, 0, 5), (113, 0, 9)])                          # Figure 7 legend
W0, W, H = 800, 840, 1267


def alpha(name):
    return np.array(Image.open(SRC + name + ".webp").convert("RGBA"))[..., 3].astype(np.float32)


# ---------------------------------------------------------------- 1. land
land0 = np.maximum.reduce([alpha(n) for n in ["base", "smalldim", "large"]
                           + [f"v{i}" for i in range(1, 6)] + [f"sb{i}" for i in range(1, 6)]])
a = np.zeros((H, W), np.float32)
a[:, :W0] = np.clip(land0, 0, 255)

# north-east cape from Figure 8 (fig8 px -> map px, then inverted)
fig8_pts = np.array([(947.5, 370), (658, 1899), (922, 1555), (455, 1698), (948, 1830)])
map_pts = np.array([(689, 16), (464, 1234), (677, 961), (305, 1075), (698, 1180)])
A8 = np.c_[fig8_pts, np.ones(len(fig8_pts))]
cx = np.linalg.lstsq(A8, map_pts[:, 0], rcond=None)[0]
cy = np.linalg.lstsq(A8, map_pts[:, 1], rcond=None)[0]
Mi = np.linalg.inv(np.array([[cx[0], cx[1]], [cy[0], cy[1]]]))
fig8 = np.array(Image.open(FIG8).convert("RGB")).astype(int)
lab8, _ = ndimage.label(~(fig8.min(2) > 235))
f8main = (lab8 == lab8[1100, 700]).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
acc = np.zeros((H, W), np.float32)
for dx in (-.25, .25):                                        # 4x supersample
    for dy in (-.25, .25):
        px, py = xx + dx - cx[2], yy + dy - cy[2]
        acc += ndimage.map_coordinates(
            f8main, [Mi[1, 0] * px + Mi[1, 1] * py, Mi[0, 0] * px + Mi[0, 1] * py], order=1, cval=0)
strip = np.zeros((H, W), bool); strip[:400, W0:] = True
a[strip] = (np.clip(acc / 4, 0, 1) * 255)[strip]

# drop Penghu and the western islets (no class in Figure 7)
labl, nl = ndimage.label(a > 0)
west = [i + 1 for i, o in enumerate(ndimage.find_objects(labl)) if o is not None and o[1].stop <= 140]
a[np.isin(labl, west)] = 0

# ------------------------------------------------- 2. classes from Figure 7
fig7 = np.array(Image.open(FIG7).convert("RGB")).astype(int)
X0, Y0, X1, Y1 = 490, 225, 880, 880                            # the left panel's island
crop = fig7[Y0:Y1, X0:X1]
R, G, B = crop[..., 0], crop[..., 1], crop[..., 2]
dist = np.sqrt(((crop[..., None, :] - LEG7[None, None]) ** 2).sum(-1))
near_cls, dmin = dist.argmin(-1), dist.min(-1)
black = (R < 75) & (G < 75) & (B < 75)
grey = (np.abs(R - G) < 14) & (np.abs(G - B) < 14) & (R < 236)
white = (crop.min(2) >= 236) & ((R - B) < 8)
bad = ndimage.binary_dilation(black | grey, iterations=1) | ndimage.binary_dilation(white, iterations=1)
taken = np.full(crop.shape[:2], -1)
for k in range(5):
    m = ndimage.binary_opening((dmin < 28) & (near_cls == k) & ~bad, structure=np.ones((3, 3), bool))
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, 1 + np.nonzero(sizes >= 6)[0])
    taken[m] = k
idx = ndimage.distance_transform_edt(taken < 0, return_distances=False, return_indices=True)
cls7 = taken[idx[0], idx[1]]
votes = np.stack([ndimage.uniform_filter((cls7 == k).astype(np.float32), 5) for k in range(5)])
cls7 = votes.argmax(0)

# register: Figure 7 main-island coast onto the raster's main-island coast
m7 = (crop.min(2) < 236) | ((R - B) > 8)
lab7, _ = ndimage.label(m7)
m7 = ndimage.binary_fill_holes(lab7 == lab7[400, 200])
labr, _ = ndimage.label(a > 127)
mr = ndimage.binary_fill_holes(labr == labr[600, 500])
dt = ndimage.distance_transform_edt(~(mr ^ ndimage.binary_erosion(mr)))
fy, fx = np.nonzero(m7 ^ ndimage.binary_erosion(m7))
b7, br = ndimage.find_objects(m7.astype(int))[0], ndimage.find_objects(mr.astype(int))[0]
sx = (br[1].stop - br[1].start) / (b7[1].stop - b7[1].start)
sy = (br[0].stop - br[0].start) / (b7[0].stop - b7[0].start)
p0 = [sx, 0, br[1].start - b7[1].start * sx, 0, sy, br[0].start - b7[0].start * sy]


def cost(p):
    v = ndimage.map_coordinates(dt, [p[3] * fx + p[4] * fy + p[5], p[0] * fx + p[1] * fy + p[2]],
                                order=1, cval=50)
    return np.mean(np.minimum(v, 30) ** 2)


p = optimize.minimize(cost, p0, method="Powell",
                      options={"maxiter": 20000, "xtol": 1e-4, "ftol": 1e-6}).x
M = np.array([[p[0], p[1]], [p[3], p[4]]]); t = np.array([p[2], p[5]])
Minv = np.linalg.inv(M)
res = ndimage.map_coordinates(dt, [p[3] * fx + p[4] * fy + p[5], p[0] * fx + p[1] * fy + p[2]], order=1)
print("registration: median residual %.2f px, 90th percentile %.2f px" % (np.median(res), np.percentile(res, 90)))

# sample each class as a soft layer (bilinear), then take the strongest: smooth edges
px, py = xx - t[0], yy - t[1]
sx7 = Minv[0, 0] * px + Minv[0, 1] * py
sy7 = Minv[1, 0] * px + Minv[1, 1] * py
soft = np.stack([ndimage.map_coordinates((cls7 == k).astype(np.float32), [sy7, sx7], order=1, mode="nearest")
                 for k in range(5)])
c = soft.argmax(0)

# ---------------------------------------------------------------- 3. paint
out = np.dstack([VOL[c], a.astype(np.uint8)])
Image.fromarray(out, "RGBA").save(OUT, "WEBP", lossless=True, method=6)
isl = a > 127
print("wrote", OUT, out.shape)
print("land share per class:", [round(float((isl & (c == k)).sum() / isl.sum()), 3) for k in range(5)])
