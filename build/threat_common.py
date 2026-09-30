"""Shared by build/threat-nights.py, threat-age.py and threat-all.py: the canvas,
the farmland, the counties and the paint of the 01 map on the homepage.

Everything lands on the 840 x 1267 canvas of assets/img/home/threat-volatility.webp
(build/threat-map.py), so the markers in home-threat.css hold on every view.

LAND and COAST: the alpha of threat-volatility.webp, a 2 px --th-coast line inside
  the coastline and --th-land for land without farmland, exactly as in
  build/threat-farms.py and build/threat-farmland.py.
FARMLAND: the union of assets/img/bigpicture/map/smalldim.webp and large.webp
  (alpha only), as in those two scripts.
COUNTIES: the county outlines of the sub-page's farm calculator
  (geospatial-analysis/interactive/farm-calculator.html, COUNTIES: MOI county
  boundaries via taiwan-atlas), placed on the canvas by a six-parameter affine
  fitted by matching the main-island coastline of the outlines to the canvas
  coastline (chamfer distance, Powell), the same method build/threat-map.py
  uses for its figure. Land the outlines miss along the coast takes the nearest
  county. Enclaves (Taipei City, Chiayi City) and Hsinchu City are drawn last.
"""
import json
import re
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize

VOLATILITY = "assets/img/home/threat-volatility.webp"
PARCELS = ["assets/img/bigpicture/map/smalldim.webp", "assets/img/bigpicture/map/large.webp"]
CALC = "geospatial-analysis/interactive/farm-calculator.html"

VOL = np.array([(0xec, 0xea, 0xdf), (0xdd, 0xd8, 0xc2), (0xcb, 0xbf, 0x98),
                (0xc2, 0x98, 0x4e), (0x9a, 0x3d, 0x22)], float)       # --vol-1..5
LAND = np.array((0xf5, 0xf5, 0xf5), float)                           # --th-land  (--gray-100)
COAST = np.array((0xd4, 0xd4, 0xd4), float)                          # --th-coast (--gray-300)
COAST_W = 2.0
LAST = ("Taipei City", "Chiayi City", "Hsinchu City")                # enclaves and the small city on top


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def canvas():
    """land alpha (0..255), volatility class index 0..4 per pixel, farmland alpha 0..1."""
    v = np.array(Image.open(VOLATILITY).convert("RGBA")).astype(float)
    land = v[..., 3]
    cls = np.sqrt(((v[..., None, :3] - VOL[None, None]) ** 2).sum(-1)).argmin(-1)
    H, W = land.shape
    farm = np.zeros((H, W))
    for p in PARCELS:
        al = np.array(Image.open(p).convert("RGBA"))[..., 3] / 255.0
        farm[:, :al.shape[1]] = np.maximum(farm[:, :al.shape[1]], al)
    farm = np.minimum(farm, land / 255.0)
    return land, cls, farm


def _counties_json():
    s = open(CALC, encoding="utf-8").read()
    i = s.find("[", s.find("const COUNTIES"))
    return json.loads(s[i:s.find("\n", i)].rstrip().rstrip(";"))


def _rings(d):
    return [[(float(x), float(y)) for x, y in re.findall(r"([-\d.]+),([-\d.]+)", sub)]
            for sub in d.split("M")[1:]]


def counties(land):
    """(label raster 0 = sea, 1..n = county, list of English names), on the canvas."""
    C = _counties_json()
    H, W = land.shape
    # 1. fit the affine: outline union (largest piece = main island) onto the canvas coast
    K = 2
    im = Image.new("L", (640 * K, 860 * K), 0)
    dr = ImageDraw.Draw(im)
    for c in C:
        for r in _rings(c["d"]):
            dr.polygon([(x * K, y * K) for x, y in r], fill=255)
    m = np.array(im) > 127
    lab, n = ndimage.label(m)
    main = ndimage.binary_fill_holes(lab == 1 + np.argmax(ndimage.sum(m, lab, range(1, n + 1))))
    labr, _ = ndimage.label(land > 127)
    mr = ndimage.binary_fill_holes(labr == labr[600, 500])
    dt = ndimage.distance_transform_edt(~(mr ^ ndimage.binary_erosion(mr)))
    fy, fx = np.nonzero(main ^ ndimage.binary_erosion(main))
    fx, fy = fx / K, fy / K
    b, br = ndimage.find_objects(main.astype(int))[0], ndimage.find_objects(mr.astype(int))[0]
    sx = (br[1].stop - br[1].start) / ((b[1].stop - b[1].start) / K)
    sy = (br[0].stop - br[0].start) / ((b[0].stop - b[0].start) / K)
    p0 = [sx, 0, br[1].start - b[1].start / K * sx, 0, sy, br[0].start - b[0].start / K * sy]

    def at(p):
        return ndimage.map_coordinates(dt, [p[3] * fx + p[4] * fy + p[5], p[0] * fx + p[1] * fy + p[2]],
                                       order=1, cval=50)

    p = optimize.minimize(lambda q: np.mean(np.minimum(at(q), 30) ** 2), p0, method="Powell",
                          options={"maxiter": 20000, "xtol": 1e-4, "ftol": 1e-6}).x
    res = at(p)
    print("counties: coast residual median %.2f px, 90th percentile %.2f px" % (np.median(res), np.percentile(res, 90)))
    # 2. draw every county on the canvas
    order = sorted(range(len(C)), key=lambda k: C[k]["nameEn"] in LAST)
    im = Image.new("I", (W, H), 0)
    dr = ImageDraw.Draw(im)
    for k in order:
        for r in _rings(C[k]["d"]):
            dr.polygon([(p[0] * x + p[1] * y + p[2], p[3] * x + p[4] * y + p[5]) for x, y in r], fill=k + 1)
    lab = np.array(im)
    idx = ndimage.distance_transform_edt(lab == 0, return_distances=False, return_indices=True)
    lab = lab[idx[0], idx[1]] * (land > 0)
    return lab, [c["nameEn"] for c in C]


def per_county(lab, names, table, default=-1):
    """class index per pixel from a {county name: class index} table."""
    missing = set(names) - set(table)
    assert not missing - {"Penghu County"}, missing
    lut = np.array([default] + [table.get(nm, default) for nm in names])
    return lut[lab]


def paint(out, land, farm, colour):
    """colour: H x W x 3 for farmland; other land --th-land; 2 px coast; alpha = land."""
    f = farm[..., None]
    rgb = colour * f + LAND * (1 - f)
    dist = ndimage.distance_transform_edt(land > 127)
    coast = np.clip(COAST_W + 0.5 - dist, 0, 1)[..., None]
    rgb = COAST * coast + rgb * (1 - coast)
    img = np.dstack([np.clip(np.rint(rgb), 0, 255), land]).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(out, "WEBP", lossless=True, method=6)
    print("wrote", out, img.shape)


def shares(land, farm, cls, n, label):
    """for checking the picture only; none of these shares is on a sub-page."""
    f = (farm > .5) & (land > 127)
    print(label, "share of farmland per class:",
          [round(float((f & (cls == k)).sum() / f.sum()), 3) for k in range(n)])
