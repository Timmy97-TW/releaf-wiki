#!/usr/bin/env python3
"""Builds the vision section's artwork from the design team's hand-drawn valley.

THE DRAWING. Jacquelyn drew the valley on 2 October 2026 as five 2048 x 1152
PNGs (kept outside the repository, with the team's other source art):

    Zoomed out w_o green dots.PNG   the valley in daylight, no reactors
    Zoomed out green dots.PNG       the reactors' glows alone, transparent
    Zoomed out.PNG                  the two together
    Zoomed in.PNG                   one field, 12x (a crop of the valley)
    Zoomed in with bioreactor .PNG  the same field with a reactor drawn on it

Every shape in the section is hers. This script separates her drawing into
layers, draws the farm details onto it (build/vision_details.py: houses,
trees, palms, farmers, crops and the rest, in her manner), and leaves the
lighting to the page: assets/js/home-vision.js takes the valley from night to
first light in the browser, so her daylight colours are never thrown away.

WHAT IT WRITES, into assets/img/home/vision/:
    land.webp       her mountains and fields in daylight with the details, at
                    twice her size so a sharp screen has something to show
    land-mask.webp  the land's outline, small: keeps the night off the sky
    masks.webp      one sprite per reactor: the shape of the field it lights
    close.webp      the first field, with its details, at five times her size
    hero-mask.webp  that field's shape, to the same scale
    sky-night.webp  her sky at night, with stars, carried up for tall screens
    sky-dawn.webp   the same sky at first light
    sun.webp        her sun, lifted out of the sky so it can rise
    reactor.webp    her bioreactor, cut out of the close-up
and assets/js/home-vision-data.js, the rectangles and lists the page reads.

The artboard is 2048 x 1552: her drawing at y 400..1552, sky above it.

    python3 build/vision-art.py "<folder with the five PNGs>" [--preview out.png]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import vision_details as details

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/img/home/vision"
OUT.mkdir(parents=True, exist_ok=True)

EXT = 400                     # sky carried up above her drawing
W, H = 2048, 1152
AH = H + EXT
K2 = 2                        # the land's scale
K5 = 5                        # the opening field's scale
ZX, ZY, ZS = 972, 780, 12.0   # where "Zoomed in" sits in the valley (template match)
FOCAL = (1069, 832)           # the reactor the camera starts on
HUE = 38                      # her lime turned to --sig-green (55 deg, in PIL units)
LUMA = np.array([.299, .587, .114])


def webp(img, name, q=80, alpha_q=90, extra=()):
    tmp = OUT / (name + ".png")
    img.save(tmp)
    subprocess.run(["cwebp", "-quiet", "-q", str(q), "-alpha_q", str(alpha_q), "-m", "6", *extra,
                    str(tmp), "-o", str(OUT / (name + ".webp"))], check=True)
    tmp.unlink()
    print(f"{name}.webp  {img.size[0]}x{img.size[1]}  {(OUT / (name + '.webp')).stat().st_size // 1024} kB")


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


base = np.asarray(Image.open(SRC / "Zoomed out w_o green dots.PNG").convert("RGB"), dtype=np.float64)
lum = base @ LUMA
yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)

# ---- sky and land ----------------------------------------------------------
lab, _ = ndimage.label(lum > 185)
top = np.unique(lab[0])
sky = ndimage.binary_fill_holes(np.isin(lab, top[top > 0]))
land = ~sky
LAND_TOP = int(np.where(land.any(1))[0].min()) - 4
SKY_BOT = int(np.where(sky.any(1))[0].max()) + 12

# her sun: the white disc in the sky
white = sky & (base.min(2) > 246) & (xx > 1400)
ys, xs = np.where(white)
sun_r = (xs.max() - xs.min() + 1) / 2
sun_cx, sun_cy = (xs.max() + xs.min()) / 2, ys.min() + sun_r
dsun = np.hypot(xx - sun_cx, yy - sun_cy)

# ---- the sky, at night and at first light ----------------------------------
# her sky with the land and the sun's disc filled in from around them, so the
# sun can rise through it and the mountains can be lit on their own
valid = sky & (dsun > sun_r + 12)
plate = base.copy()
todo = ~valid
for sigma in (14, 40, 120, 400):
    wgt = ndimage.gaussian_filter(valid.astype(np.float64), sigma)
    fill = np.dstack([ndimage.gaussian_filter(base[..., c] * valid, sigma) for c in range(3)]) / np.maximum(wgt, 1e-6)[..., None]
    ok = todo & (wgt > 0.04)
    plate[ok] = fill[ok]
    todo &= ~ok
if todo.any():
    idx = ndimage.distance_transform_edt(todo, return_distances=False, return_indices=True)
    plate[todo] = plate[idx[0][todo], idx[1][todo]]

# carried up: her top band mirrored back and forth, softer and deeper as it goes
band = plate[:215]
rows, i, d = [], 0, 1
while len(rows) < EXT:
    rows.append(band[i]); i += d
    if i in (len(band) - 1, 0):
        d = -d
ext = np.stack(rows[::-1])
t = np.linspace(1, 0, EXT)[:, None, None]
ext = ext * (1 - t ** 0.7) + ndimage.gaussian_filter(ext, sigma=(6, 40, 0)) * t ** 0.7
skyfull = np.concatenate([ext, plate[:SKY_BOT]])
SH = skyfull.shape[0]
sy, sx = np.mgrid[0:SH, 0:W].astype(np.float64)
near_sun = np.exp(-((sx - sun_cx) / 620) ** 2)

# first light: deep blue overhead, her own warm horizon kept, warmest by the sun
tt = smoothstep(EXT + 110, EXT + 440, sy + 120 * near_sun) ** 1.25
gain = np.array([.20, .30, .52]) * (1 - tt[..., None]) + np.array([1.03, .93, .80]) * tt[..., None]
gain *= (0.30 + 0.70 * smoothstep(0, EXT + 60, sy))[..., None]       # towards ink at the very top
webp(Image.fromarray((skyfull * gain).clip(0, 255).astype(np.uint8)), "sky-dawn", q=82)

# night: ink blue, her brushwork just visible, a scatter of stars
sl = (skyfull @ LUMA) / 255
grad = smoothstep(0, SH, sy)[..., None]
sky_night = (np.array([5, 8, 16]) * (1 - grad) + np.array([17, 27, 48]) * grad) * (0.8 + 0.35 * sl[..., None])
rng = np.random.default_rng(11)
stars = np.zeros((SH, W))
for _ in range(230):
    x, y = rng.integers(2, W - 2), int(rng.beta(1.1, 2.2) * (SH - 40))
    stars[y, x] = rng.uniform(0.25, 1) ** 2 * 900
sky_night = sky_night + ndimage.gaussian_filter(stars, 0.8)[..., None] * np.array([.9, .95, 1.0])
webp(Image.fromarray(sky_night.clip(0, 255).astype(np.uint8)), "sky-night", q=78)

# her sun, whole: its top half is clear of the ridge, so mirror it down
r = int(sun_r + 14)
cx, cy = int(round(sun_cx)), int(round(sun_cy))
half = base[cy - r:cy, cx - r:cx + r]
dy_, dx_ = np.mgrid[-r:r, -r:r] + 0.5
sun_a = 1 - smoothstep(sun_r + 1, sun_r + 9, np.hypot(dx_, dy_))
webp(Image.fromarray(np.dstack([np.concatenate([half, half[::-1]]), sun_a * 255]).clip(0, 255).astype(np.uint8), "RGBA"), "sun", q=88)

# ---- her bioreactor, cut out of the close-up -------------------------------
zi = np.asarray(Image.open(SRC / "Zoomed in.PNG").convert("RGB"), dtype=np.float64)
zr = np.asarray(Image.open(SRC / "Zoomed in with bioreactor .PNG").convert("RGB"), dtype=np.float64)
diff = np.abs(zi - zr).sum(2)
mask = ndimage.binary_opening(ndimage.binary_fill_holes(ndimage.binary_closing(diff > 22, iterations=6)), iterations=2)
lab, n = ndimage.label(mask)
mask = lab == (1 + int(np.argmax(ndimage.sum(mask, lab, range(1, n + 1)))))
alpha = ndimage.gaussian_filter(mask.astype(np.float64), 1.6)
ys, xs = np.where(alpha > 0.02)
rx0, rx1, ry0, ry1 = xs.min() - 4, xs.max() + 5, ys.min() - 4, ys.max() + 5
al = alpha[ry0:ry1, rx0:rx1]
# un-mix the field from the soft edge: C = a F + (1 - a) B, and B is "Zoomed in"
spr = (zr[ry0:ry1, rx0:rx1] - (1 - al[..., None]) * zi[ry0:ry1, rx0:rx1]) / np.maximum(al[..., None], 0.05)
spr = np.where(al[..., None] > 0.05, spr, zr[ry0:ry1, rx0:rx1]).clip(0, 255)
# her lime (~95 deg) turned to the page's reactor green (150 deg), one turn for
# every pixel, so the drawing keeps its own light and shade
hsv = np.asarray(Image.fromarray(spr.astype(np.uint8)).convert("HSV"), dtype=np.float64)
hsv[..., 0] = (hsv[..., 0] + HUE) % 256
spr = np.asarray(Image.fromarray(hsv.clip(0, 255).astype(np.uint8), "HSV").convert("RGB"), dtype=np.float64)
reactor_img = Image.fromarray(np.dstack([spr, al * 255]).clip(0, 255).astype(np.uint8), "RGBA") \
    .filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=1))
webp(reactor_img, "reactor", q=85)
REACTOR = [round(ZX + rx0 / ZS, 2), round(ZY + ry0 / ZS + EXT, 2), round((rx1 - rx0) / ZS, 2), round((ry1 - ry0) / ZS, 2)]

# ---- her dots, and the field under each ------------------------------------
dd = np.asarray(Image.open(SRC / "Zoomed out green dots.PNG"), dtype=np.float64)
wgt = dd[..., 3] * dd[..., 0] / 255                     # the white-hot cores
peak = (wgt == ndimage.maximum_filter(wgt, size=25)) & (wgt > 60)
dots = []
for y, x in np.argwhere(peak):
    if any(abs(x - px) < 6 and abs(y - py) < 6 for px, py, _ in dots):
        continue
    v = wgt[y, x]
    dots.append((int(x), int(y), 15 if v < 220 else 32 if v < 240 else 73))     # her three sizes
dots.sort(key=lambda p: (p[1], p[0]))
sm = np.dstack([ndimage.median_filter(base[..., c], size=5) for c in range(3)])


def field_of(x, y):
    """The field she painted under a point: flood fill on her flat colours."""
    x, y = min(x, W - 1), min(y, H - 1)
    seed = np.median(sm[max(0, y - 4):y + 5, max(0, x - 4):x + 5].reshape(-1, 3), axis=0)
    dist = np.sqrt(((sm - seed) ** 2).sum(2))
    limit = 14000 if y < 620 else 45000 if y < 800 else 100000
    for tol in (34, 26, 20, 15):
        lb, _ = ndimage.label(dist < tol)
        if not lb[y, x]:
            continue
        reg = ndimage.binary_fill_holes(lb == lb[y, x])
        # drop the hairlines that run off along a neighbour's painted outline
        lb2, _ = ndimage.label(ndimage.binary_opening(reg, iterations=3))
        if not lb2[y, x]:
            continue
        reg = ndimage.binary_dilation(lb2 == lb2[y, x], iterations=1) & reg
        ry, rx = np.where(reg)
        box = (rx.max() - rx.min() + 1) * (ry.max() - ry.min() + 1)
        core = ndimage.binary_erosion(reg, iterations=4)                        # solid, not an outline
        if reg.sum() < limit and reg.sum() / box > 0.33 and core[y, x] and core.sum() > 0.4 * reg.sum():
            return reg
    return None


hero = min(range(len(dots)), key=lambda i: abs(dots[i][0] - FOCAL[0]) + abs(dots[i][1] - FOCAL[1]))

# ---- the land in daylight, at twice her size, with the farm details --------
big = Image.fromarray(base.astype(np.uint8)).resize((W * K2, H * K2), Image.LANCZOS) \
    .filter(ImageFilter.UnsharpMask(radius=2, percent=45, threshold=2))
day2 = np.asarray(big, dtype=np.float64).copy()
P = details.Painter(day2, 0, 0, K2)
details.paint(P, field_of, dots, rich=True, reactor_img=reactor_img, hero=hero)
windows = P.windows
if "--preview" in sys.argv:                             # the daylight picture, to check the details
    Image.fromarray(day2.clip(0, 255).astype(np.uint8)).save(sys.argv[sys.argv.index("--preview") + 1])
# a fine tooth, so her enlarged brushwork does not read as blur
tooth = ndimage.gaussian_filter(np.random.default_rng(5).normal(0, 1, day2.shape[:2]), 0.7)
day2 = day2 * (1 + tooth[..., None] * 0.02)
land2 = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).resize((W * K2, H * K2), Image.BICUBIC), dtype=np.float64) / 255
land_a = np.clip(ndimage.gaussian_filter(land2, 1.4) * 1.6 - 0.3, 0, 1)
webp(Image.fromarray(np.dstack([day2, land_a * 255])[LAND_TOP * K2:].clip(0, 255).astype(np.uint8), "RGBA"),
     "land", q=78, alpha_q=90, extra=("-sharp_yuv",))
soft = np.clip(ndimage.gaussian_filter(land.astype(np.float64), 1.0) * 1.6 - 0.3, 0, 1)[LAND_TOP:]
mask_small = Image.fromarray(np.dstack([np.full((H - LAND_TOP, W, 3), 255, np.uint8), (soft * 255).astype(np.uint8)]), "RGBA")
webp(mask_small.resize((W // 2, (H - LAND_TOP) // 2), Image.LANCZOS), "land-mask", q=30, alpha_q=80)

# ---- the shape of the field each reactor lights ----------------------------
sprites = []
for i, (x, y, size) in enumerate(dots):
    reg = field_of(x, y)
    px, py = min(x, W - 1), min(y, H - 1)
    d2 = np.hypot(xx - px, (yy - py) * 2.0)             # the ground is foreshortened
    if reg is None:                                     # no clean field: a round pool on the ground
        rad = 26 + (y - 545) * 0.16
        reg = (d2 < rad) & land
        m_full = np.clip(1.25 - d2 / (0.8 * rad), 0, 1) * reg
    else:
        m_full = ndimage.gaussian_filter(reg.astype(np.float64), 0.8)
    ry, rx = np.where(reg)
    x0, x1, y0, y1 = max(rx.min() - 3, 0), min(rx.max() + 4, W), max(ry.min() - 3, 0), min(ry.max() + 4, H)
    sprites.append({"i": i, "x": int(x0), "y": int(y0), "rmax": float(np.percentile(d2[reg], 95)),
                    "reg": reg, "m": m_full[y0:y1, x0:x1]})

order = sorted(sprites, key=lambda s: -s["m"].shape[0])  # pack on shelves
AWID, pad = 2048, 4
cx_, cy_, shelf = 0, 0, 0
for s in order:
    h, w = s["m"].shape
    if cx_ + w > AWID:
        cx_, cy_, shelf = 0, cy_ + shelf + pad, 0
    s["ax"], s["ay"] = cx_, cy_
    cx_ += w + pad
    shelf = max(shelf, h)
atlas = np.zeros((cy_ + shelf, AWID, 4), dtype=np.uint8)
atlas[..., :3] = 255
for s in order:
    h, w = s["m"].shape
    atlas[s["ay"]:s["ay"] + h, s["ax"]:s["ax"] + w, 3] = (s["m"] * 255).astype(np.uint8)
webp(Image.fromarray(atlas, "RGBA"), "masks", q=20, alpha_q=70)

# ---- the opening field at five times her size ------------------------------
CW, CH = 384, 216
cx0, cy0 = FOCAL[0] - CW // 2, FOCAL[1] - CH // 2 - 20
crop = Image.fromarray(base[cy0:cy0 + CH, cx0:cx0 + CW].astype(np.uint8))
day5 = np.asarray(crop.resize((CW * K5, CH * K5), Image.LANCZOS)
                  .filter(ImageFilter.UnsharpMask(radius=3, percent=60, threshold=2)), dtype=np.float64).copy()
details.paint(details.Painter(day5, cx0, cy0, K5), field_of, dots, rich=True, reactor_img=reactor_img, hero=hero)
g2 = ndimage.gaussian_filter(np.random.default_rng(7).normal(0, 1, (CH * K5, CW * K5)), 0.8)
day5 = day5 * (1 + g2[..., None] * 0.03)
cyy, cxx = np.mgrid[0:CH * K5, 0:CW * K5]
fx = np.minimum(cxx, CW * K5 - 1 - cxx) / (0.14 * CW * K5)
fy = np.minimum(cyy, CH * K5 - 1 - cyy) / (0.14 * CH * K5)
edge = np.clip(np.minimum(fx, fy), 0, 1)
edge = edge * edge * (3 - 2 * edge)                      # melts into the land underneath
webp(Image.fromarray(np.dstack([day5.clip(0, 255), edge * 255]).astype(np.uint8), "RGBA"), "close", q=80, extra=("-sharp_yuv",))
hm = ndimage.gaussian_filter(sprites[hero]["reg"][cy0:cy0 + CH, cx0:cx0 + CW].astype(np.float64), 0.8)
hm5 = Image.fromarray((hm * 255).astype(np.uint8)).resize((CW * K5, CH * K5), Image.BICUBIC)
webp(Image.merge("RGBA", (Image.new("L", hm5.size, 255),) * 3 + (hm5,)), "hero-mask", q=20, alpha_q=80)

# ---- what the page reads ---------------------------------------------------
DATA = {
    "aw": W, "ah": AH, "focal": [FOCAL[0], FOCAL[1] + EXT], "hero": hero,
    "sky": [0, 0, W, SH], "sun": [cx - r, cy - r + EXT, 2 * r, 2 * r],
    "sunC": [round(sun_cx, 1), round(sun_cy + EXT, 1), round(sun_r, 1)],
    "land": [0, LAND_TOP + EXT, W, H - LAND_TOP], "close": [cx0, cy0 + EXT, CW, CH], "reactor": REACTOR,
    # per reactor: x, y, her dot size, the field it lights (sprite x, y, w, h in
    # masks.webp; x, y on the artboard), how far its light reaches, its height
    "dots": [[x, y + EXT, size, s["ax"], s["ay"], s["m"].shape[1], s["m"].shape[0], s["x"], s["y"] + EXT,
              round(s["rmax"]), round(23 * details.scale(y), 1)]
             for (x, y, size), s in zip(dots, sprites)],
    "windows": [[x, round(y + EXT, 1), w, h] for x, y, w, h in windows],
}
js = ROOT / "assets/js/home-vision-data.js"
js.write_text("/* Written by build/vision-art.py; do not edit by hand. Rectangles are\n"
              "   [x, y, w, h] on the 2048 x 1552 artboard. */\n"
              "window.__visionData = " + json.dumps(DATA, separators=(",", ":")) + ";\n")
print("wrote", js.name, len(DATA["dots"]), "reactors,", len(windows), "windows")
