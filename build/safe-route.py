"""Build the #safe figure (9 Oct 2026): the road a protectant has to travel
from the lab to the field, painted in the manner of the student's valley.

    python3 build/safe-route.py "<folder with the five vision PNGs>" [--preview out.png]

Writes assets/img/home/safe-route-2400.webp, safe-route-1200.webp and
safe-route-1200.jpg (the fallback), all 3:1. Needs numpy, Pillow and scipy.

THE GROUND is her valley ("Zoomed out w_o green dots.PNG", the painting the
vision section lights; see assets/img/home/vision/README.md): her sky, her
ridge, and on the right her own fields and river, which is where the road
ends. Her sun is painted out (7 Oct, owner: the sunrise belongs to the
vision section). Over the left of her fields a near plain is painted in her
field colours, and the road runs across it.

WHAT STANDS ON THE ROAD, by code, in her manner (flat shapes in two or three
tones, dry-brush edges, no outlines; build/vision_details.py's Painter):
  the lab        a flask of lime broth on a bench. The engineered cells are
                 blue-slate rods, a colour nothing in the valley uses, and
                 they are INSIDE the glass only. The protectant is amber.
  separation     a steel vessel on legs, the protectant drawn off clean into
                 a small amber vial.
  storage        a pale tank and a tote of the amber product.
  transport      a cold van: cream box, her blue cab, a snowflake badge.
  delivery       a crate of the product on the road, and a farmer in a
                 conical hat come to meet it.
  the field      her fields, with a row of young crops.
No road blocks, no signs: the distance itself is the argument. Nothing says
ReLeaf: the problem arc never shows the answer.

These additions are AI-assisted drawing after her style, not hers, and the
page says so in its HTML comment; her painting underneath is untouched.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
import vision_details as details  # noqa: E402
from vision_details import Painter, SHADOW  # noqa: E402

SRC = Path(sys.argv[1])
PREVIEW = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
OUT = Path("assets/img/home")
W, H = 2400, 800

# ------------------------------------------------------------------ ground --
src = np.asarray(Image.open(SRC / "Zoomed out w_o green dots.PNG").convert("RGB"), dtype=np.float64)


def desun(img):
    """Her sky without the disc: filled from the sky's own rows."""
    h, w = img.shape[:2]
    lum = img.mean(-1)
    top = lum[:60].mean(0)
    below = lum < (top - 28)[None, :]
    first = np.where(below.any(0), below.argmax(0), h)
    yy_, xx_ = np.mgrid[0:h, 0:w]
    sky = yy_ < first[None, :]
    hot = (lum >= 250) & sky
    lab, n = ndimage.label(hot)
    if not n:
        return img
    k = 1 + int(np.argmax(ndimage.sum(hot, lab, range(1, n + 1))))
    ys, xs = np.where(lab == k)
    cx, cy = xs.mean(), ys.mean()
    r = max(np.ptp(xs), np.ptp(ys)) / 2
    d = np.hypot(xx_ - cx, yy_ - cy)
    glow = (d < r * 5.0) & sky
    keep = (d > r * 6.2) & sky
    out = img.copy()
    for y in range(h):
        if not glow[y].any():
            continue
        s = img[y][keep[y]]
        if len(s) < 24:
            continue
        out[y][glow[y]] = np.median(s, axis=0)
    a = ndimage.gaussian_filter(np.clip((r * 5.0 - d) / (r * 1.3), 0, 1) * sky, 11)[..., None]
    return img * (1 - a) + out * a


src = desun(src)
K = W / src.shape[1]                 # her px -> ours
Y0 = 193                             # her row at our top: her ridge base lands near y 430
crop = Image.fromarray(src[Y0:Y0 + int(round(H / K))].astype(np.uint8)).resize((W, H), Image.LANCZOS)
C = np.asarray(crop, dtype=np.float64).copy()

# the Painter's perspective scale, retuned to this picture: 1 at the road
details.HORIZON = 430.0
details.REF_Y = 485.0

P = Painter(C, 0, 0, 1)
rng = np.random.default_rng(9)

# ---------------------------------------------------------------- the plain --
# her field colours, sampled from the painting
PALE = (178, 178, 122)
PALE_L = (192, 190, 134)
OLIVE = (152, 168, 96)
LIME = (150, 172, 70)
OCHRE = (196, 172, 112)
OCHRE_D = (160, 132, 76)
SOIL = (122, 90, 42)
GREEN_D = (56, 102, 46)
GREEN_M = (92, 146, 62)
GREEN_L = (128, 178, 80)

ROAD_Y = 650
# the near plain: over her fields on the left, giving way to them on the right
P.poly([(-20, 478), (1560, 474), (1700, 540), (1780, 640), (1820, 830), (-20, 830)], PALE, rough=1.6)
# a few of her patches on it, pale and olive strips with wandering edges
P.poly([(-20, 478), (700, 480), (760, 540), (-20, 548)], PALE_L, rough=1.4)
P.poly([(1100, 476), (1560, 474), (1690, 540), (1240, 560)], OLIVE, rough=1.4, alpha=0.8)
P.poly([(-20, 720), (640, 712), (720, 830), (-20, 830)], OLIVE, rough=1.6, alpha=0.55)
P.poly([(900, 740), (1500, 724), (1620, 830), (980, 830)], PALE_L, rough=1.6, alpha=0.7)
# the road: ochre, a soil-brown edge, two wheel tracks
road = [(-20, 690), (300, 676), (700, 684), (1100, 670), (1500, 676), (1860, 660), (2180, 640), (2420, 626)]
ROAD = (172, 140, 88)
ROAD_D = (138, 106, 58)
P.stroke(road, 90, ROAD_D, rough=1.8, alpha=0.85)
P.stroke(road, 68, ROAD, rough=1.3)
for off in (-15, 15):
    P.stroke([(x, y + off) for x, y in road], 5, ROAD_D, rough=0.9, alpha=0.5)
# her river-bank bushes, a few along the far edge of the plain
for bx, by, br in ((330, 492, 13), (352, 498, 10), (880, 486, 12), (1380, 500, 14), (1402, 506, 10), (1660, 548, 12)):
    P.ellipse(bx, by, br, br * 0.75, GREEN_D, rough=0.9)
    P.ellipse(bx + br * 0.35, by - br * 0.3, br * 0.5, br * 0.38, GREEN_M, rough=0.6)


def shadow(cx, cy, rx, ry):
    P.ellipse(cx, cy, rx, ry, SHADOW, mul=True, alpha=0.6, rough=1.0)


# ------------------------------------------------------------------ the lab --
GLASS = (218, 230, 232)
GLASS_D = (160, 182, 190)
BROTH = (164, 186, 80)
BROTH_D = (132, 156, 60)
SLATE = (58, 92, 130)
SLATE_D = (38, 62, 94)
AMBER = (236, 168, 48)
AMBER_D = (184, 112, 30)
AMBER_L = (255, 226, 160)
STEEL = (132, 150, 158)
STEEL_L = (184, 198, 204)
STEEL_D = (84, 100, 110)
INK = (62, 72, 80)


def capsule(cx, cy, ln, wd, ang, n=9):
    c, s = np.cos(ang), np.sin(ang)
    pts = []
    for sign in (1, -1):
        t = np.linspace(-np.pi / 2, np.pi / 2, n) * sign + (0 if sign == 1 else np.pi)
        for a in t:
            x = sign * ln / 2 + np.cos(a) * wd / 2
            y = np.sin(a) * wd / 2
            pts.append((cx + x * c - y * s, cy + x * s + y * c))
    return pts


def rod(cx, cy, ln, ang, wd=20.0):
    P.poly(capsule(cx, cy, ln, wd, ang), SLATE, rough=0.5)
    P.poly(capsule(cx - np.sin(ang) * wd * 0.1, cy - np.cos(ang) * wd * 0.18, ln * 0.7, wd * 0.5, ang), SLATE_D, rough=0.35, alpha=0.55)


def lab(x, y):
    # the bench
    shadow(x + 10, y + 6, 150, 14)
    P.poly([(x - 130, y - 22), (x + 130, y - 22), (x + 124, y), (x - 124, y)], (176, 156, 122), rough=0.9)
    P.poly([(x - 130, y - 22), (x + 130, y - 22), (x + 130, y - 30), (x - 130, y - 30)], (206, 190, 156), rough=0.8)
    for lx in (x - 104, x + 104):
        P.poly([(lx - 9, y), (lx + 9, y), (lx + 9, y + 40), (lx - 9, y + 40)], (150, 130, 98), rough=0.6)
    b = y - 30                                   # the flask stands on the bench
    neck_t, body = b - 262, b - 150
    outline = [(x - 22, neck_t), (x + 22, neck_t), (x + 22, body), (x + 92, b - 12), (x + 84, b), (x - 84, b), (x - 92, b - 12), (x - 22, body)]
    P.poly(outline, GLASS, rough=0.9)
    # the broth, up to a wandering line
    lvl = b - 92
    P.poly([(x - 22 - (lvl - body) / (b - 12 - body) * 70, lvl), (x + 22 + (lvl - body) / (b - 12 - body) * 70, lvl), (x + 92, b - 12), (x + 84, b), (x - 84, b), (x - 92, b - 12)],
           BROTH, rough=1.1)
    P.poly([(x - 56, lvl + 2), (x + 56, lvl + 2), (x + 62, lvl + 10), (x - 62, lvl + 10)], (196, 212, 110), rough=0.8, alpha=0.7)
    P.poly([(x + 30, lvl + 20), (x + 86, b - 14), (x + 80, b - 4), (x + 40, b - 4)], BROTH_D, rough=0.9, alpha=0.6)
    # the engineered cells, inside only
    for rx, ry, ang in ((x - 34, b - 56, -0.5), (x + 14, b - 66, 0.4), (x + 46, b - 34, -1.1), (x - 10, b - 24, 0.7), (x - 54, b - 20, -0.1), (x + 20, b - 44, 2.6)):
        rod(rx, ry, 42, ang)
    for ax, ay in ((x - 40, b - 76), (x + 36, b - 70), (x + 58, b - 20), (x - 66, b - 40), (x + 2, b - 12), (x - 20, b - 50)):
        P.ellipse(ax, ay, 5.5, 5.5, AMBER, rough=0.3, n=10)
        P.ellipse(ax - 1.5, ay - 1.5, 2.2, 2.2, AMBER_L, rough=0.1, n=8)
    # glass: a highlight down the left, a shade on the right, the rim and a stopper
    P.stroke([(x - 32, body + 8), (x - 74, b - 24)], 7, (246, 250, 248), rough=0.4, alpha=0.7)
    P.poly([(x + 22, neck_t), (x + 22, body), (x + 92, b - 12), (x + 84, b), (x + 66, b), (x + 76, b - 14), (x + 12, body + 2), (x + 12, neck_t)], GLASS_D, rough=0.8, alpha=0.5)
    P.poly([(x - 28, neck_t - 4), (x + 28, neck_t - 4), (x + 28, neck_t + 8), (x - 28, neck_t + 8)], GLASS_D, rough=0.6)
    P.poly([(x - 20, neck_t - 24), (x + 20, neck_t - 24), (x + 22, neck_t - 2), (x - 22, neck_t - 2)], INK, rough=0.6)


# --------------------------------------------------------------- separation --
def vessel(x, y):
    shadow(x + 6, y + 4, 120, 13)
    top, bot = y - 230, y - 40
    for lx in (x - 56, x + 56):
        P.poly([(lx - 9, bot - 6), (lx + 9, bot - 6), (lx + 11, y), (lx - 11, y)], STEEL_D, rough=0.6)
    P.poly([(x - 86, top + 30), (x + 86, top + 30), (x + 86, bot - 24), (x - 86, bot - 24)], STEEL, rough=1.0)
    P.ellipse(x, bot - 24, 86, 24, STEEL_D, rough=0.9, n=26)
    P.poly([(x - 86, top + 30), (x - 30, top + 30), (x - 30, bot - 26), (x - 86, bot - 26)], STEEL_L, rough=0.9, alpha=0.85)
    P.poly([(x + 44, top + 30), (x + 86, top + 30), (x + 86, bot - 26), (x + 44, bot - 26)], STEEL_D, rough=0.9, alpha=0.75)
    P.ellipse(x, top + 30, 86, 24, STEEL_L, rough=0.9, n=26)
    P.ellipse(x, top + 30, 86, 24, STEEL, rough=0.9, n=26, alpha=0.5)
    P.ellipse(x - 14, top + 24, 44, 12, (210, 222, 226), rough=0.7, n=20)
    P.poly([(x - 12, top + 2), (x + 12, top + 2), (x + 12, top + 16), (x - 12, top + 16)], STEEL_D, rough=0.5)
    for ly in (top + 90, top + 150):
        P.stroke([(x - 80, ly), (x + 80, ly)], 4, STEEL_D, rough=0.5, alpha=0.55)
    # the control box
    P.poly([(x - 150, y - 150), (x - 112, y - 150), (x - 112, y - 4), (x - 150, y - 4)], STEEL_D, rough=0.7)
    P.poly([(x - 144, y - 142), (x - 118, y - 142), (x - 118, y - 112), (x - 144, y - 112)], (34, 46, 56), rough=0.3)
    for i, col in enumerate(((150, 220, 150), (150, 220, 150), AMBER)):
        P.ellipse(x - 138 + (i % 2) * 14, y - 134 + (i // 2) * 12, 3.5, 3.5, col, rough=0.1, n=8)
    # the take-off and the clean product
    P.stroke([(x + 86, y - 92), (x + 118, y - 92), (x + 126, y - 72)], 8, STEEL_D, rough=0.4)
    P.poly([(x + 112, y - 70), (x + 142, y - 70), (x + 142, y - 10), (x + 112, y - 10)], GLASS, rough=0.7)
    P.poly([(x + 114, y - 44), (x + 140, y - 44), (x + 140, y - 12), (x + 114, y - 12)], AMBER, rough=0.7)
    P.poly([(x + 116, y - 40), (x + 124, y - 40), (x + 124, y - 14), (x + 116, y - 14)], AMBER_L, rough=0.4, alpha=0.6)
    P.poly([(x + 118, y - 80), (x + 136, y - 80), (x + 136, y - 70), (x + 118, y - 70)], STEEL_D, rough=0.4)


# ------------------------------------------------------------------ storage --
def storage(x, y):
    shadow(x, y + 4, 140, 13)
    # the tank
    tx, top, bot = x - 70, y - 236, y
    P.poly([(tx - 54, top + 34), (tx + 54, top + 34), (tx + 54, bot), (tx - 54, bot)], (196, 206, 206), rough=1.0)
    P.poly([(tx + 22, top + 34), (tx + 54, top + 34), (tx + 54, bot), (tx + 22, bot)], (150, 165, 170), rough=0.9, alpha=0.8)
    P.poly([(tx - 54, top + 34), (tx - 30, top + 34), (tx - 30, bot), (tx - 54, bot)], (224, 230, 228), rough=0.9, alpha=0.7)
    P.ellipse(tx, top + 34, 54, 20, (214, 222, 222), rough=0.9, n=24)
    P.poly([(tx - 10, top + 6), (tx + 10, top + 6), (tx + 10, top + 20), (tx - 10, top + 20)], STEEL_D, rough=0.5)
    for ly in (top + 100, top + 160):
        P.stroke([(tx - 50, ly), (tx + 50, ly)], 4, (150, 165, 170), rough=0.5, alpha=0.6)
    # the tote: a cage round the amber product, on a pallet
    cx, cw, ch = x + 72, 64, 112
    P.poly([(cx - cw - 8, y - 12), (cx + cw + 8, y - 12), (cx + cw + 8, y), (cx - cw - 8, y)], (120, 92, 56), rough=0.6)
    P.poly([(cx - cw, y - 12 - ch), (cx + cw, y - 12 - ch), (cx + cw, y - 12), (cx - cw, y - 12)], (250, 240, 214), rough=0.8)
    P.poly([(cx - cw + 4, y - 12 - ch * 0.72), (cx + cw - 4, y - 12 - ch * 0.72), (cx + cw - 4, y - 16), (cx - cw + 4, y - 16)], AMBER, rough=0.8)
    P.poly([(cx - cw + 4, y - 12 - ch * 0.72), (cx - cw + 26, y - 12 - ch * 0.72), (cx - cw + 26, y - 16), (cx - cw + 4, y - 16)], AMBER_L, rough=0.6, alpha=0.5)
    for i in range(1, 3):
        P.stroke([(cx - cw + i * cw * 2 / 3, y - 12 - ch), (cx - cw + i * cw * 2 / 3, y - 12)], 5, STEEL_D, rough=0.3)
        P.stroke([(cx - cw, y - 12 - ch + i * ch / 3), (cx + cw, y - 12 - ch + i * ch / 3)], 5, STEEL_D, rough=0.3)
    P.poly([(cx - cw, y - 12 - ch), (cx + cw, y - 12 - ch), (cx + cw, y - 12), (cx - cw, y - 12)], STEEL_D, rough=0.5, width=5, closed=True) if False else None
    P.stroke([(cx - cw, y - 12 - ch), (cx + cw, y - 12 - ch), (cx + cw, y - 12), (cx - cw, y - 12), (cx - cw, y - 12 - ch)], 5, STEEL_D, rough=0.3)
    P.poly([(cx - 14, y - 12 - ch - 12), (cx + 14, y - 12 - ch - 12), (cx + 14, y - 12 - ch), (cx - 14, y - 12 - ch)], STEEL_D, rough=0.4)


# ---------------------------------------------------------------- transport --
def van(x, y):
    shadow(x + 10, y + 2, 190, 13)
    bx0, bx1, top = x - 170, x + 60, y - 170
    P.poly([(bx0, top), (bx1, top), (bx1, y - 30), (bx0, y - 30)], (238, 236, 222), rough=1.0)
    P.poly([(bx1 - 26, top), (bx1, top), (bx1, y - 30), (bx1 - 26, y - 30)], (200, 204, 192), rough=0.8, alpha=0.8)
    P.poly([(bx0, top - 6), (bx1 + 4, top - 6), (bx1 + 4, top + 4), (bx0, top + 4)], (214, 214, 202), rough=0.8)
    # the cab, her farm-truck blue
    P.poly([(bx1 + 4, y - 120), (bx1 + 70, y - 120), (bx1 + 98, y - 84), (bx1 + 104, y - 44), (bx1 + 104, y - 30), (bx1 + 4, y - 30)], (74, 124, 190), rough=0.8)
    P.poly([(bx1 + 4, y - 74), (bx1 + 104, y - 74), (bx1 + 104, y - 30), (bx1 + 4, y - 30)], (62, 108, 170), rough=0.7, alpha=0.8)
    P.poly([(bx1 + 14, y - 112), (bx1 + 64, y - 112), (bx1 + 88, y - 82), (bx1 + 14, y - 82)], (196, 216, 224), rough=0.5)
    P.poly([(bx1 + 92, y - 54), (bx1 + 104, y - 54), (bx1 + 104, y - 44), (bx1 + 92, y - 44)], AMBER_L, rough=0.3)
    # the chassis and the wheels
    P.poly([(bx0 - 6, y - 32), (bx1 + 104, y - 32), (bx1 + 104, y - 22), (bx0 - 6, y - 22)], INK, rough=0.5)
    for wx in (bx0 + 44, bx0 + 96, bx1 + 76):
        P.ellipse(wx, y - 18, 22, 22, (44, 44, 48), rough=0.4, n=16)
        P.ellipse(wx, y - 18, 9, 9, (150, 150, 154), rough=0.2, n=10)
    # the cold badge on the box: a pale blue disc and a six-armed flake
    cx, cy = x - 56, y - 100
    P.ellipse(cx, cy, 34, 34, (206, 226, 236), rough=0.5, n=20)
    for a in np.linspace(0, np.pi, 3, endpoint=False):
        dx, dy = np.cos(a) * 24, np.sin(a) * 24
        P.stroke([(cx - dx, cy - dy), (cx + dx, cy + dy)], 4, (74, 124, 190), rough=0.15)
        for t in (0.55, -0.55):
            px, py = cx + dx * t, cy + dy * t
            nx, ny = -dy * 0.28, dx * 0.28
            P.stroke([(px + nx * 0.9 + dx * 0.18 * np.sign(t), py + ny * 0.9 + dy * 0.18 * np.sign(t)), (px, py), (px - nx * 0.9 + dx * 0.18 * np.sign(t), py - ny * 0.9 + dy * 0.18 * np.sign(t))], 3, (74, 124, 190), rough=0.1)


# ----------------------------------------------------------------- delivery --
def crate(x, y):
    shadow(x, y + 3, 80, 10)
    P.poly([(x - 64, y - 60), (x + 64, y - 60), (x + 64, y), (x - 64, y)], (190, 150, 100), rough=0.8)
    P.poly([(x + 40, y - 60), (x + 64, y - 60), (x + 64, y), (x + 40, y)], (150, 112, 66), rough=0.7, alpha=0.8)
    for ly in (y - 40, y - 20):
        P.stroke([(x - 64, ly), (x + 64, ly)], 3, (140, 105, 60), rough=0.4, alpha=0.8)
    for i, bx in enumerate((x - 40, x - 14, x + 12, x + 38)):
        P.poly([(bx - 9, y - 96 + (i % 2) * 6), (bx + 9, y - 96 + (i % 2) * 6), (bx + 11, y - 58), (bx - 11, y - 58)], AMBER, rough=0.5)
        P.poly([(bx - 5, y - 106 + (i % 2) * 6), (bx + 5, y - 106 + (i % 2) * 6), (bx + 5, y - 94 + (i % 2) * 6), (bx - 5, y - 94 + (i % 2) * 6)], AMBER_D, rough=0.3)
        P.stroke([(bx - 5, y - 92 + (i % 2) * 6), (bx - 6, y - 64)], 3, AMBER_L, rough=0.2, alpha=0.6)


# ---------------------------------------------------------------- the field --
def crops(x0, x1, y, n, size=1.0, color=GREEN_M):
    step = (x1 - x0) / n
    for i in range(n):
        cx = x0 + step * (i + 0.5) + rng.normal(0, 2)
        cy = y + rng.normal(0, 1.5)
        s = size * (0.9 + 0.2 * rng.random())
        P.ellipse(cx, cy, 11 * s, 7 * s, GREEN_D, rough=0.6, n=10)
        P.ellipse(cx + 3 * s, cy - 3 * s, 6 * s, 4 * s, color, rough=0.4, n=8)
        P.ellipse(cx - 2 * s, cy - 6 * s, 4 * s, 5 * s, GREEN_L, rough=0.4, n=8)


# -------------------------------------------------------------- the scene --
lab(200, ROAD_Y - 10)
vessel(600, ROAD_Y - 4)
storage(1000, ROAD_Y - 2)
van(1400, ROAD_Y - 2)
crate(1760, ROAD_Y + 4)
details.farmer(P, 1866, ROAD_Y + 12, shirt=(76, 108, 160), size=34)
# the field: a strip of young crops in her near field, and a farmer bent to it
P.stroke([(1900, 744), (2420, 716)], 44, (170, 150, 92), rough=1.4, alpha=0.75)
P.stroke([(1900, 744), (2420, 716)], 6, SOIL, rough=0.8, alpha=0.5)
crops(1920, 2420, 736, 11, 1.0)
crops(2000, 2420, 690, 8, 0.8)

# ------------------------------------------------------------------- write --
img = Image.fromarray(np.clip(C, 0, 255).astype(np.uint8))
if PREVIEW:
    img.save(PREVIEW)
OUT.mkdir(parents=True, exist_ok=True)
img.save(OUT / "safe-route-2400.webp", "WEBP", quality=80, method=6)
img.resize((1200, 400), Image.LANCZOS).save(OUT / "safe-route-1200.webp", "WEBP", quality=82, method=6)
img.resize((1200, 400), Image.LANCZOS).save(OUT / "safe-route-1200.jpg", "JPEG", quality=80, optimize=True, progressive=True)
print("wrote", OUT / "safe-route-2400.webp")
