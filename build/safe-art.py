"""Build the #safe figure (7 Oct 2026): engineered cells held in a culture,
the biostimulant they make carried out over the valley to the crops.

    python3 build/safe-art.py "<folder with the five vision PNGs>" [--preview out.png]

Writes assets/img/home/safe-art-1600.webp, safe-art-1000.webp and
safe-art-1200.jpg (the fallback), all 2:1. Needs numpy, Pillow and scipy.

THE GROUND is the design team's valley ("Zoomed out w_o green dots.PNG", the
same painting the vision section lights; see assets/img/home/vision/README.md),
otherwise left as she painted it. No reactor is drawn: the problem arc never
shows the answer. HER SUN IS PAINTED OUT (7 Oct, owner): the sunrise belongs
to the vision section at the foot of the page, so this figure keeps her sky
and loses the disc, inpainted from the sky's own rows.

WHAT IS ADDED, by code, in her manner (flat shapes in two or three tones,
dry-brush edges, no outlines; build/vision_details.py's Painter):
  the dish     a culture seen from above in the MIDDLE of the near field: a
               pale broth in a glass wall. The wall is a ring of short segments with pores
               between them, smaller than a cell.
  the cells    engineered rods in blue-slate, a colour nothing in the valley
               uses, so they never read as crop. Some are dividing. They crowd
               the wall on the field side and none is outside it.
  the product  small amber chains (the biostimulant), made beside the cells,
               passing the pores and carried on a wide arc over the fields,
               smaller and fainter with distance.
  the mark     a prohibition badge outside the wall on the field side: a rod
               under a rust ring and bar. The product may leave; a cell may
               not. Nothing else on the page says this in a picture.
  the fields   where the product settles, the crop takes a fresher green.
  the crops    young plants in the near foreground: to the LEFT of the
               culture, out of the product's way, they are bent over and
               yellowed; to the RIGHT, where the product goes, they stand
               upright and full. The pair is the whole argument of the
               figure in one glance.

These additions are AI-assisted drawing, not hers, and the page says so in
its HTML comment; her painting underneath is untouched.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from vision_details import Painter  # noqa: E402

SRC = Path(sys.argv[1])
PREVIEW = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
OUT = Path("assets/img/home")
W, H = 1600, 1000
rng = np.random.default_rng(7)

# ------------------------------------------------------------------ ground --
src = Image.open(SRC / "Zoomed out w_o green dots.PNG").convert("RGB")
sw, sh = src.size                                  # 2048 x 1152
cw = int(round(sh * W / H))                         # 16:10 at full height
x0 = sw - cw                                        # keep the right: river and sun
ground = src.crop((x0, 0, sw, sh)).resize((W, H), Image.LANCZOS)
C = np.asarray(ground, dtype=np.float64).copy()
K = W / cw                                          # her px -> ours

# ---- her sun, painted out (7 Oct) ---------------------------------------
# The disc is the brightest thing in the top half of her sky. Its own rows
# are a near-flat gradient, so the patch is filled from the median of each
# row taken outside the disc and its glow, then feathered back in. The
# sunrise is the vision section's, not this figure's.
def desun(img):
    h, w = img.shape[:2]
    lum = img.mean(-1)

    # where her sky stops: scanning down each column, the first row that is
    # much darker than the top of that column is the ridge line
    top = lum[:60].mean(0)
    below = lum < (top - 28)[None, :]
    first = np.where(below.any(0), below.argmax(0), h)
    yy_, xx_ = np.mgrid[0:h, 0:w]
    sky = yy_ < first[None, :]

    # the disc: the one big patch of near-white in the sky
    hot = (lum >= 250) & sky
    lab, n = ndimage.label(hot)
    if not n:
        return img
    k = 1 + int(np.argmax(ndimage.sum(hot, lab, range(1, n + 1))))
    ys, xs = np.where(lab == k)
    cx, cy = xs.mean(), ys.mean()
    r = max(np.ptp(xs), np.ptp(ys)) / 2

    d = np.hypot(xx_ - cx, yy_ - cy)
    glow = (d < r * 5.0) & sky                     # the disc and the light round it
    keep = (d > r * 6.2) & sky
    out = img.copy()
    for y in range(h):
        if not glow[y].any():
            continue
        src = img[y][keep[y]]
        if len(src) < 24:
            continue
        out[y][glow[y]] = np.median(src, axis=0)
    a = ndimage.gaussian_filter(np.clip((r * 5.0 - d) / (r * 1.3), 0, 1) * sky, 11)[..., None]
    return img * (1 - a) + out * a


C = desun(C)

P = Painter(C, 0, 0, 1)


def soft(mask, r):
    return ndimage.gaussian_filter(mask.astype(np.float64), r)


yy, xx = np.mgrid[0:H, 0:W]

# --------------------------------------------- the fields that are reached --
# Where the product settles the crop takes a fresher green: whole fields of
# her painting, found by growing a region of one colour from a seed, and
# recoloured with her brushwork kept (each pixel scaled, not replaced).
G0 = np.asarray(ground, dtype=np.float64)
SM = ndimage.uniform_filter(G0, (5, 5, 1))


def field(x, y, tol=26):
    c = SM[y, x]
    m = np.sqrt(((SM - c) ** 2).sum(-1)) < tol
    lab, _ = ndimage.label(m)
    r = ndimage.binary_fill_holes(lab == lab[y, x])
    return ndimage.binary_dilation(r, iterations=2)


TARGETS = [(960, 520), (1250, 610), (1180, 700), (1480, 780), (1050, 860), (1420, 640)]
FRESH = [np.array(c, float) for c in ((112, 160, 56), (96, 146, 58), (124, 168, 62))]
reached = np.zeros((H, W))
for i, (fx, fy) in enumerate(TARGETS):
    m = field(fx, fy)
    mean = G0[m].mean(0)
    tint = np.clip(G0 * (FRESH[i % 3] / mean), 0, 255)
    a = soft(m, 1.2)[..., None]
    C = C * (1 - a) + tint * a
    reached = np.maximum(reached, m)
# a little sun on the young leaves
C = C + (255 - C) * (.07 * soft(reached, 2)[..., None])
P.c = C
G1 = C.copy()                       # the valley as it now stands, for the lens's shadow

# ----------------------------------------------------------- the crops -----
# Young plants in the near foreground, flanking the culture: bent and
# yellowed on the left, upright and full on the right. Flat shapes with
# jittered edges, as everything else here.
GREEN = (np.array((56, 102, 46), float), np.array((92, 146, 62), float), np.array((128, 178, 80), float))
DRY = (np.array((136, 114, 50), float), np.array((174, 154, 76), float), np.array((200, 182, 108), float))


def crop_plant(x, y, h, wilt=0.0):
    """A crop standing on (x, y), h tall. wilt 0 = upright and green,
    1 = bent over, drooping and dry."""
    rng = np.random.default_rng(int(abs(x) * 31 + abs(y) * 7) % 100000)
    dark, mid, lite = (g * (1 - wilt) + d * wilt for g, d in zip(GREEN, DRY))
    P.ellipse(x - .1 * h, y + .01 * h, .44 * h, .10 * h, (112, 122, 104), mul=True, alpha=.5, rough=.35, n=16)
    lean = wilt * (.26 + .14 * rng.random()) * h
    tipy = y - h * (1 - .2 * wilt)

    def leaf(sx, sy, ux, uy, L, wd, col):
        n = np.hypot(ux, uy)
        ux, uy = ux / n, uy / n
        nx, ny = -uy * wd, ux * wd
        P.poly([(sx, sy), (sx + ux * L * .45 + nx, sy + uy * L * .45 + ny),
                (sx + ux * L, sy + uy * L),
                (sx + ux * L * .45 - nx, sy + uy * L * .45 - ny)], col, rough=.3)

    for i, t in enumerate((.22, .45, .66, .86)):
        sx = x + lean * (t ** 1.8)
        sy = y - h * t * (1 - .2 * wilt)
        L = (.54 - .07 * i) * h * (.9 + .2 * rng.random())
        for k, side in enumerate((-1, 1)):
            uy = (.62 + .25 * rng.random()) if wilt > .5 else -(.5 + .25 * rng.random())
            leaf(sx, sy, side * (1 + .25 * rng.random()), uy, L, .17 * L, mid if (i + k) % 2 else dark)
    # the stem over the leaves, and the lit side of it
    P.stroke([(x, y), (x + lean * .25, y - h * .55), (x + lean, tipy)], max(.07 * h, 1.6), dark, rough=.12)
    P.stroke([(x - .012 * h, y - .1 * h), (x + lean * .3, tipy + .1 * h)], max(.022 * h, .8), lite, alpha=.75, rough=.1)
    if wilt > .5:                                   # a leaf or two already down
        for _ in range(2):
            fx, fy = x + rng.uniform(-.55, .55) * h, y + rng.uniform(.01, .07) * h
            P.ellipse(fx, fy, .17 * h, .05 * h, DRY[0], rot=rng.uniform(-.5, .5), rough=.25, n=12)


# Hand-placed, in the canvas's own pixels, and all standing clear of the
# bottom edge of the 2:1 crop (which is y 972). Six bent on the left, seven
# full on the right.
for x, y, h, w in ((96, 902, 158, 1), (212, 938, 176, 1), (330, 906, 162, 1),
                   (44, 856, 132, 1), (154, 866, 142, 1), (272, 870, 146, 1)):
    crop_plant(float(x), float(y), float(h), w)
for x, y, h, w in ((982, 912, 162, 0), (1104, 944, 180, 0), (1232, 910, 166, 0),
                   (1360, 940, 176, 0), (1486, 904, 158, 0), (1046, 866, 140, 0),
                   (1300, 862, 144, 0)):
    crop_plant(float(x), float(y), float(h), w)

# ---------------------------------------------------------------- the lens --
# A culture seen close, lifted off the valley: it casts a soft shadow on the
# fields, so it reads as a view onto something kept apart from them.
CX, CY, R = 616.0, 668.0, 242.0
WALL = 22.0
dist = np.hypot(xx - CX, yy - CY)

shadow = soft(np.hypot(xx - CX - 18, yy - CY - 30) < R + WALL, 26)[..., None]
C *= 1 - .5 * shadow * (1 - np.array((80, 92, 86)) / 255)
P.c = C

inside = dist < R
BROTH = np.array((234, 236, 220), float)
before = C.copy()
C[inside] = BROTH
P.c = C
for _ in range(34):
    a = rng.uniform(0, 2 * np.pi); rr = R * np.sqrt(rng.uniform(0, .85))
    bx, by = CX + rr * np.cos(a), CY + rr * np.sin(a)
    tone = (222, 228, 206) if rng.random() < .5 else (244, 244, 230)
    P.ellipse(bx, by, rng.uniform(40, 120), rng.uniform(14, 36), tone, rot=rng.uniform(-.5, .5), alpha=.6, rough=2.4, n=22)
# depth: the broth darkens a little toward the wall
edge = np.clip((dist - R * .72) / (R * .28), 0, 1) ** 2
C[inside] = C[inside] * (1 - .16 * edge[inside, None]) + np.array((150, 170, 168)) * (.16 * edge[inside, None])
C[~inside] = before[~inside]
P.c = C

# ------------------------------------------------------------- the cells ----
SLATE = np.array((58, 92, 130), float)
SLATE_D = np.array((38, 62, 94), float)
SLATE_L = np.array((156, 188, 210), float)


def capsule(cx, cy, ln, wd, ang, n=10):
    """outline of a rod: two half circles joined."""
    hl = max(ln / 2 - wd / 2, 0)
    pts = [(hl + wd / 2 * np.cos(t), wd / 2 * np.sin(t)) for t in np.linspace(-np.pi / 2, np.pi / 2, n)]
    pts += [(-hl + wd / 2 * np.cos(t), wd / 2 * np.sin(t)) for t in np.linspace(np.pi / 2, 3 * np.pi / 2, n)]
    c, s = np.cos(ang), np.sin(ang)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in pts]


def rod(cx, cy, ln, ang, wd=21.0, tone=0.0):
    c, s = np.cos(ang), np.sin(ang)
    nx, ny = -s, c                                  # across the rod
    if ny < 0: nx, ny = -nx, -ny                    # "down" across it, toward the bottom of the page
    P.poly(capsule(cx + 4, cy + 5, ln, wd, ang), (178, 184, 168), mul=True, alpha=.6, rough=.35)
    base = SLATE * (1 - tone) + SLATE_L * tone
    P.poly(capsule(cx, cy, ln, wd, ang), base, rough=.4)
    P.poly(capsule(cx + nx * .2 * wd, cy + ny * .2 * wd, ln - .25 * wd, wd * .5, ang), SLATE_D, alpha=.6, rough=.3)
    hx, hy = cx - nx * .2 * wd, cy - ny * .2 * wd
    P.stroke([(hx - .3 * ln * c, hy - .3 * ln * s), (hx + .26 * ln * c, hy + .26 * ln * s)], wd * .2, SLATE_L, alpha=.85, rough=.15)


cells = []
tries = 0
while len(cells) < 30 and tries < 9000:
    tries += 1
    a = rng.uniform(0, 2 * np.pi)
    rr = R * np.sqrt(rng.uniform(0, 1)) * .84
    x, y = CX + rr * np.cos(a), CY + rr * np.sin(a)
    ang = rng.uniform(0, np.pi)
    k = 1 if rng.random() < .62 else int(rng.integers(2, 4))      # B. subtilis grows in short chains
    ln = rng.uniform(54, 66)
    if np.hypot(x - CX, y - CY) + k * ln / 2 + 14 > R:
        continue
    if any(np.hypot(x - u, y - v) < 26 + 20 * (k + kk) for u, v, _, _, kk in cells):
        continue
    d = np.hypot(x - CX, y - CY)
    if d > R * .6 and x > CX - 40:                  # against the wall: lie along it
        ang = np.arctan2(y - CY, x - CX) + np.pi / 2 + rng.normal(0, .2)
    cells.append((x, y, ln, ang, k))
# a row of them against the wall on the field side, held there
row = []
for a in np.linspace(-1.0, .8, 7):
    rr = R - 15
    row.append((CX + rr * np.cos(a), CY + rr * np.sin(a), rng.uniform(52, 58), a + np.pi / 2 + rng.normal(0, .06), 1))
cells = [cc for cc in cells if min(np.hypot(cc[0] - x, cc[1] - y) for x, y, *_ in row) > 46 + 22 * cc[4]] + row
for i, (x, y, ln, ang, k) in enumerate(cells):
    c, s = np.cos(ang), np.sin(ang)
    for j in range(k):
        o = (j - (k - 1) / 2) * (ln + 3)
        tone = (.05 + .12 * ((i + j) % 3))
        if i % 7 == 3 and k == 1:                   # dividing: two halves and a waist
            rod(x - .26 * ln * c, y - .26 * ln * s, ln * .55, ang, tone=tone)
            rod(x + .26 * ln * c, y + .26 * ln * s, ln * .55, ang, tone=tone)
        else:
            rod(x + o * c, y + o * s, ln, ang, tone=tone)

# ------------------------------------------------------------ the product ---
AMBER = np.array((236, 168, 48), float)
AMBER_D = np.array((184, 112, 30), float)
AMBER_L = np.array((255, 226, 160), float)
light = np.zeros((H, W))                           # warm glow under the product, added at the end


def chain(x, y, r, ang, n=3, alpha=1.0, halo=1.0):
    c, s = np.cos(ang), np.sin(ang)
    pts = [(x + (i - (n - 1) / 2) * 1.6 * r * c + (r * .3 if i % 2 else 0) * -s,
            y + (i - (n - 1) / 2) * 1.6 * r * s + (r * .3 if i % 2 else 0) * c) for i in range(n)]
    P.stroke(pts, r * .5, AMBER_D, alpha=alpha, rough=0)
    for px, py in pts:
        P.ellipse(px, py, r, r, AMBER, alpha=alpha, rough=0, n=14)
        P.ellipse(px - .32 * r, py - .32 * r, .4 * r, .34 * r, AMBER_L, alpha=alpha * .95, rough=0, n=8)
    if halo:
        ix, iy = int(round(x)), int(round(y))
        if 0 <= ix < W and 0 <= iy < H:
            light[iy, ix] += halo * alpha * r / 4.6


# made beside the cells, inside the culture
placed = 0
while placed < 34:
    a = rng.uniform(0, 2 * np.pi); rr = R * np.sqrt(rng.uniform(.02, .9))
    x, y = CX + rr * np.cos(a), CY + rr * np.sin(a)
    if any(np.hypot(x - u, y - v) < 26 + 32 * (kk - 1) + 10 for u, v, _, _, kk in cells):
        continue
    chain(x, y, 5.2, rng.uniform(0, np.pi), n=int(rng.integers(2, 4)), halo=0)
    placed += 1

# --------------------------------------------------------------- the wall ---
# glass in short segments; the pores between them are smaller than a cell
GLASS = np.array((214, 228, 232), float)
GLASS_D = np.array((140, 162, 172), float)
seg = np.deg2rad(6.0); gap = np.deg2rad(1.4)
t = 0.0
while t < 2 * np.pi - 1e-6:
    a0, a1 = t, t + seg - gap
    arc = np.linspace(a0, a1, 6)
    outer = [(CX + (R + WALL) * np.cos(u), CY + (R + WALL) * np.sin(u)) for u in arc]
    inner = [(CX + R * np.cos(u), CY + R * np.sin(u)) for u in arc[::-1]]
    m = (a0 + a1) / 2
    lit = .5 + .5 * np.cos(m - 3.93)               # lit from the upper left
    P.poly(outer + inner, GLASS_D * (1 - lit) + GLASS * lit, rough=.2)
    t += seg
for a0, a1, col, al, rr in ((3.5, 4.9, (255, 255, 255), .95, .55), (.25, 1.35, (110, 132, 142), .45, .55),
                            (3.6, 4.4, (255, 255, 255), .5, -.15)):
    arc = np.linspace(a0, a1, 50)
    P.stroke([(CX + (R + WALL * rr) * np.cos(u), CY + (R + WALL * rr) * np.sin(u)) for u in arc], 4.0, col, alpha=al, rough=.1)

# ----------------------------------------- out through the wall, and away ---
def bez(p0, p1, p2, p3, t):
    t = np.asarray(t, float)[..., None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def leave(ang):
    return np.array((CX + (R + WALL * .5) * np.cos(ang), CY + (R + WALL * .5) * np.sin(ang)))


ROUTES = [  # (angle it leaves the wall at, control points, the field it reaches)
    (-.78, (820, 420), (920, 440), (960, 520)),
    (-.46, (900, 520), (1140, 540), (1250, 610)),
    (-.60, (880, 460), (1300, 510), (1420, 640)),
    (-.12, (960, 660), (1100, 670), (1180, 700)),
    (.22, (980, 790), (1340, 745), (1480, 780)),
    (.50, (900, 880), (980, 872), (1050, 860)),
]
mist = np.zeros((H, W))
for k, (ang, c1, c2, end) in enumerate(ROUTES):
    p0, p1, p2, p3 = leave(ang), np.array(c1, float), np.array(c2, float), np.array(end, float)
    ts = np.linspace(0, 1, 160)
    pts = bez(p0, p1, p2, p3, ts)
    for (x, y), tt in zip(pts, ts):
        ix, iy = int(x), int(y)
        if 0 <= ix < W and 0 <= iy < H:
            mist[iy, ix] += (1 - .5 * tt)
    n = 10
    for j in range(1, n + 1):
        tt = (j - .5 + rng.uniform(-.2, .2)) / n
        x, y = bez(p0, p1, p2, p3, tt)
        x += rng.normal(0, 4); y += rng.normal(0, 4)
        far = np.clip((900 - y) / 420, 0, 1)        # higher on the page is further away
        r = 6.4 * (1 - .3 * tt) * (1 - .5 * far)
        chain(x, y, max(r, 2.4), rng.uniform(0, np.pi), n=3 if r > 3.4 else 2, alpha=1 - .2 * tt)
    # where it settles
    light[int(p3[1]), int(p3[0])] += 6
# in the pores, half through
for a in (-.78, -.60, -.46, -.26, -.12, .08, .22, .36, .50):
    x, y = leave(a)
    chain(x, y, 5.6, a + np.pi / 2, n=2, halo=.6)

# ------------------------------------------------- no cell may leave -------
# A prohibition badge just outside the wall, on the field side and clear of
# the product's routes: a rod, a rust ring and a rust bar across it. Drawn
# last of the objects so nothing sits on top of it.
RUST = np.array((154, 61, 34), float)
bx, by = CX + (R + WALL + 54) * np.cos(.62), CY + (R + WALL + 54) * np.sin(.62)
br = 37.0
P.ellipse(bx + 3, by + 5, br, br, (120, 128, 112), mul=True, alpha=.5, rough=.3, n=26)
P.ellipse(bx, by, br, br, (250, 250, 246), rough=.25, n=26)
rod(bx, by, 40, -.38, wd=15.0, tone=.1)
ring = [(bx + (br - 3.4) * np.cos(t), by + (br - 3.4) * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 72)]
P.stroke(ring + [ring[0]], 7.0, RUST, rough=.12)
P.stroke([(bx - .66 * br, by + .66 * br), (bx + .66 * br, by - .66 * br)], 7.0, RUST, rough=.1)

# the trail of each route, a faint warm haze, and the glow round the product
mist = ndimage.gaussian_filter(mist, 9)
mist = np.clip(mist / max(mist.max(), 1e-6) * 1.7, 0, 1)[..., None]
glow = ndimage.gaussian_filter(light, 9)
glow = np.clip(glow / max(np.percentile(glow[glow > 0], 99.5), 1e-6), 0, 1)[..., None]
WARM = np.array((255, 214, 130), float)
P.c = P.c + (WARM - P.c) * (.26 * mist * (~inside)[..., None])
P.c = P.c + (WARM - P.c) * (.36 * glow * (~inside)[..., None])

# ------------------------------------------------------------------ output --
# 2:1, the empty top of her sky cut away, so the figure can run the width of
# the page under the heading
TOP = 172
img = Image.fromarray(np.clip(np.rint(P.c), 0, 255).astype(np.uint8), "RGB").crop((0, TOP, W, TOP + W // 2))
if PREVIEW:
    img.save(PREVIEW)
img.save(OUT / "safe-art-1600.webp", "WEBP", quality=82, method=6)
img.resize((1000, 500), Image.LANCZOS).save(OUT / "safe-art-1000.webp", "WEBP", quality=82, method=6)
img.resize((1200, 600), Image.LANCZOS).save(OUT / "safe-art-1200.jpg", "JPEG", quality=80, optimize=True, progressive=True)
for f in ("safe-art-1600.webp", "safe-art-1000.webp", "safe-art-1200.jpg"):
    print(f, (OUT / f).stat().st_size // 1024, "kB")
