"""Build the #safe figure (9 Oct 2026): the bar a promising biostimulant has
to clear before a farm can buy it, painted in the manner of the student's
valley on the vision section.

    python3 build/safe-route.py "<folder with the five vision PNGs>" [--preview out.png]

Writes assets/img/home/safe-route-2400.webp, safe-route-1200.webp and
safe-route-1200.jpg (the fallback), all 3:1. Needs numpy, Pillow and scipy.

WHAT IT ARGUES (9 Oct, owner: a filter, not a delay). Four flasks stand at
the bench: four promising molecules. One road leads away from them through
production, purification, formulation and trials, and only ONE candidate is
carried along it. The road then thins and fades out before it reaches her
fields. The farm is painted beyond the end of it. Nothing is being delayed;
the molecules that clear the bar are the ones worth making at scale, and a
small farm is on the wrong side of that. There is no cold chain here: the
cold truck of the first draft overstated the problem (CH Biotech's own
product does not travel iced), and the distance was never refrigeration.

THE GROUND is her valley ("Zoomed out w_o green dots.PNG", the painting the
vision section lights; see assets/img/home/vision/README.md): her sky, her
ridge, and on the right her own fields and river, which is where the road
fails to arrive. Her sun is painted out (7 Oct, owner: the sunrise belongs
to the vision section). Over the left of her fields a near plain is painted
in her field colours, and the road runs across it.

WHAT STANDS ON THE ROAD, by code, in her manner (flat shapes in two or three
tones, dry-brush edges, no outlines; build/vision_details.py's Painter):
  discovery      four flasks on a bench. ONE is lime and alive, with the
                 engineered cells (blue-slate rods, a colour nothing in the
                 valley uses) INSIDE the glass only; the other three are
                 pale and still. The count is the whole argument.
  production     a steel vessel on legs.
  purification   a tall column on a stand, the product drawn off clean into
                 a small amber vial.
  formulation    a tote and bottles of the amber product, made to last.
  trials         two small test beds with rows of crops and a stake.
  the farm       her own fields, past the end of the road.
No road blocks and no signs: the road ending short of the farm is the whole
of it. Nothing says ReLeaf; the problem arc never shows the answer.

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

# her field colours, sampled from the painting
PALE = (178, 178, 122)
PALE_L = (192, 190, 134)
OLIVE = (152, 168, 96)
OCHRE_D = (160, 132, 76)
SOIL = (122, 90, 42)
GREEN_D = (56, 102, 46)
GREEN_M = (92, 146, 62)
GREEN_L = (128, 178, 80)
ROAD = (172, 140, 88)
ROAD_D = (138, 106, 58)

GLASS = (218, 230, 232)
GLASS_D = (160, 182, 190)
GLASS_P = (206, 214, 210)            # the candidates that went no further
BROTH = (164, 186, 80)
BROTH_D = (132, 156, 60)
BROTH_P = (186, 190, 162)
SLATE = (58, 92, 130)
SLATE_D = (38, 62, 94)
AMBER = (236, 168, 48)
AMBER_D = (184, 112, 30)
AMBER_L = (255, 226, 160)
STEEL = (132, 150, 158)
STEEL_L = (184, 198, 204)
STEEL_D = (84, 100, 110)
INK = (62, 72, 80)

ROAD_Y = 650
STATIONS = (200, 600, 1000, 1400, 1800, 2200)   # six equal columns of 2400

# ---------------------------------------------------------------- the plain --
P.poly([(-20, 478), (1560, 474), (1700, 540), (1780, 640), (1820, 830), (-20, 830)], PALE, rough=1.6)
P.poly([(-20, 478), (700, 480), (760, 540), (-20, 548)], PALE_L, rough=1.4)
P.poly([(1100, 476), (1560, 474), (1690, 540), (1240, 560)], OLIVE, rough=1.4, alpha=0.8)
P.poly([(-20, 720), (640, 712), (720, 830), (-20, 830)], OLIVE, rough=1.6, alpha=0.55)
P.poly([(900, 740), (1500, 724), (1620, 830), (980, 830)], PALE_L, rough=1.6, alpha=0.7)

# the road: full where the molecule is still being carried, then thinning and
# fading out short of her fields. The last stretch is the argument.
SPINE = [(-20, 690), (300, 676), (700, 684), (1100, 670), (1500, 676), (1700, 672), (1850, 668), (1980, 662)]
SX = [p[0] for p in SPINE]
SY = [p[1] for p in SPINE]


def along(x0, x1, n=14):
    xs = np.linspace(x0, x1, n)
    return [(x, float(np.interp(x, SX, SY))) for x in xs]


P.stroke(along(-20, 1680), 92, ROAD_D, rough=1.8, alpha=0.85)
P.stroke(along(-20, 1680), 70, ROAD, rough=1.3)
for off in (-15, 15):
    P.stroke([(x, y + off) for x, y in along(-20, 1660)], 5, ROAD_D, rough=0.9, alpha=0.5)
for x0, x1, wd, a in ((1660, 1790, 56, 0.9), (1780, 1870, 38, 0.66), (1860, 1930, 24, 0.44), (1920, 1975, 13, 0.24)):
    P.stroke(along(x0, x1, 8), wd, ROAD, rough=1.4, alpha=a)

# her river-bank bushes along the far edge of the plain
for bx, by, br in ((436, 492, 13), (458, 498, 10), (880, 486, 12), (1380, 500, 14), (1402, 506, 10), (1660, 548, 12)):
    P.ellipse(bx, by, br, br * 0.75, GREEN_D, rough=0.9)
    P.ellipse(bx + br * 0.35, by - br * 0.3, br * 0.5, br * 0.38, GREEN_M, rough=0.6)


def shadow(cx, cy, rx, ry):
    P.ellipse(cx, cy, rx, ry, SHADOW, mul=True, alpha=0.6, rough=1.0)


def capsule(cx, cy, ln, wd, ang, n=9):
    """A rod: right cap -y to +y, then left cap +y to -y. The two caps must
    run in that order or the polygon crosses itself and the rod renders as a
    dumbbell."""
    c, s = np.cos(ang), np.sin(ang)
    pts = [(ln / 2 + np.cos(a) * wd / 2, np.sin(a) * wd / 2) for a in np.linspace(-np.pi / 2, np.pi / 2, n)]
    pts += [(-ln / 2 + np.cos(a) * wd / 2, np.sin(a) * wd / 2) for a in np.linspace(np.pi / 2, 3 * np.pi / 2, n)]
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in pts]


# ----------------------------------------------------------- 1  DISCOVERY --
def flask(x, b, h, live):
    """One conical flask standing on (x, b), h tall. `live` is the candidate
    that goes on: lime broth with the engineered cells in it. Every cell is
    placed from the cone's own half-width at that height, so none can sit
    outside the glass whatever the proportions are changed to."""
    nw, bw = h * 0.125, h * 0.46
    neck_t, shoulder, foot = b - h, b - h * 0.72, b - h * 0.045

    def half(yy):
        if yy <= shoulder:
            return nw
        return nw + min((yy - shoulder) / (foot - shoulder), 1.0) * (bw - nw)

    glass = GLASS if live else GLASS_P
    shadow(x - bw * 0.3, b + 2, bw * 1.2, h * 0.04)
    P.poly([(x - nw, neck_t), (x + nw, neck_t), (x + nw, shoulder), (x + bw, foot),
            (x + bw * 0.94, b), (x - bw * 0.94, b), (x - bw, foot), (x - nw, shoulder)], glass, rough=0.9)
    lvl = b - h * 0.34
    hw = half(lvl)
    P.poly([(x - hw, lvl), (x + hw, lvl), (x + bw, foot), (x + bw * 0.94, b),
            (x - bw * 0.94, b), (x - bw, foot)], BROTH if live else BROTH_P, rough=1.1)
    if live:
        P.poly([(x - hw * 0.86, lvl + 1), (x + hw * 0.86, lvl + 1), (x + hw * 0.94, lvl + h * 0.035),
                (x - hw * 0.94, lvl + h * 0.035)], (196, 212, 110), rough=0.8, alpha=0.7)
        P.poly([(x + bw * 0.26, lvl + h * 0.09), (x + bw * 0.92, foot + 2), (x + bw * 0.84, b - 3),
                (x + bw * 0.38, b - 3)], BROTH_D, rough=0.9, alpha=0.6)
        for fx, fy, ang in ((-0.62, 0.26, -0.5), (0.22, 0.17, 0.4), (0.60, 0.52, -1.1),
                            (-0.08, 0.63, 0.7), (-0.70, 0.74, -0.1), (0.30, 0.42, 2.6)):
            cy = lvl + fy * (b - lvl)
            cx = x + fx * half(cy) * 0.70
            P.poly(capsule(cx, cy, h * 0.15, h * 0.056, ang), SLATE, rough=0.35)
            P.poly(capsule(cx - np.sin(ang) * h * 0.012, cy - np.cos(ang) * h * 0.012,
                           h * 0.105, h * 0.017, ang), SLATE_D, rough=0.2, alpha=0.4)
        for fx, fy in ((-0.5, 0.12), (0.46, 0.3), (0.72, 0.66), (-0.8, 0.5), (0.04, 0.85), (-0.3, 0.42)):
            cy = lvl + fy * (b - lvl)
            P.ellipse(x + fx * half(cy) * 0.74, cy, h * 0.019, h * 0.019, AMBER, rough=0.3, n=10)
    P.stroke([(x - nw * 1.1, shoulder + h * 0.04), (x - bw * 0.78, foot - h * 0.03)], h * 0.022,
             (246, 250, 248), rough=0.4, alpha=0.7 if live else 0.45)
    P.poly([(x + nw * 0.4, shoulder), (x + nw, shoulder), (x + bw, foot), (x + bw * 0.92, b),
            (x + bw * 0.74, b), (x + bw * 0.8, foot), (x + nw * 0.4, shoulder + 2)], GLASS_D, rough=0.8, alpha=0.5)
    P.poly([(x - nw * 1.25, neck_t - h * 0.012), (x + nw * 1.25, neck_t - h * 0.012),
            (x + nw * 1.25, neck_t + h * 0.026), (x - nw * 1.25, neck_t + h * 0.026)], GLASS_D, rough=0.6)
    P.poly([(x - nw * 0.9, neck_t - h * 0.055), (x + nw * 0.9, neck_t - h * 0.055),
            (x + nw, neck_t - h * 0.008), (x - nw, neck_t - h * 0.008)],
           INK if live else (146, 150, 148), rough=0.6)


def discovery(x, y):
    """Four promising molecules on a bench. One of them goes on."""
    shadow(x + 10, y + 6, 190, 15)
    P.poly([(x - 168, y - 22), (x + 168, y - 22), (x + 160, y), (x - 160, y)], (176, 156, 122), rough=0.9)
    P.poly([(x - 168, y - 22), (x + 168, y - 22), (x + 168, y - 30), (x - 168, y - 30)], (206, 190, 156), rough=0.8)
    for lx in (x - 138, x + 138):
        P.poly([(lx - 9, y), (lx + 9, y), (lx + 9, y + 40), (lx - 9, y + 40)], (150, 130, 98), rough=0.6)
    b = y - 30
    flask(x - 118, b, 128, False)
    flask(x + 44, b, 120, False)
    flask(x + 126, b, 110, False)
    flask(x - 32, b, 168, True)          # the one that clears the bar


# ---------------------------------------------------------- 2  PRODUCTION --
def production(x, y):
    shadow(x + 6, y + 4, 124, 14)
    top, bot = y - 240, y - 40
    for lx in (x - 58, x + 58):
        P.poly([(lx - 9, bot - 6), (lx + 9, bot - 6), (lx + 11, y), (lx - 11, y)], STEEL_D, rough=0.6)
    P.poly([(x - 88, top + 30), (x + 88, top + 30), (x + 88, bot - 24), (x - 88, bot - 24)], STEEL, rough=1.0)
    P.ellipse(x, bot - 24, 88, 24, STEEL_D, rough=0.9, n=26)
    P.poly([(x - 88, top + 30), (x - 30, top + 30), (x - 30, bot - 26), (x - 88, bot - 26)], STEEL_L, rough=0.9, alpha=0.85)
    P.poly([(x + 46, top + 30), (x + 88, top + 30), (x + 88, bot - 26), (x + 46, bot - 26)], STEEL_D, rough=0.9, alpha=0.75)
    P.ellipse(x, top + 30, 88, 24, STEEL_L, rough=0.9, n=26)
    P.ellipse(x, top + 30, 88, 24, STEEL, rough=0.9, n=26, alpha=0.5)
    P.ellipse(x - 14, top + 24, 44, 12, (210, 222, 226), rough=0.7, n=20)
    P.poly([(x - 12, top + 2), (x + 12, top + 2), (x + 12, top + 16), (x - 12, top + 16)], STEEL_D, rough=0.5)
    for ly in (top + 92, top + 152):
        P.stroke([(x - 82, ly), (x + 82, ly)], 4, STEEL_D, rough=0.5, alpha=0.55)
    # the control box beside it
    P.poly([(x - 152, y - 150), (x - 114, y - 150), (x - 114, y - 4), (x - 152, y - 4)], STEEL_D, rough=0.7)
    P.poly([(x - 146, y - 142), (x - 120, y - 142), (x - 120, y - 112), (x - 146, y - 112)], (34, 46, 56), rough=0.3)
    for i, col in enumerate(((150, 220, 150), (150, 220, 150), AMBER)):
        P.ellipse(x - 140 + (i % 2) * 14, y - 134 + (i // 2) * 12, 3.5, 3.5, col, rough=0.1, n=8)


# -------------------------------------------------------- 3  PURIFICATION --
def purification(x, y):
    """A column on a stand: the product drawn off clean into a vial."""
    shadow(x + 4, y + 4, 110, 13)
    top, bot = y - 252, y - 54
    for lx in (x - 44, x + 44):
        P.poly([(lx - 8, bot), (lx + 8, bot), (lx + 10, y), (lx - 10, y)], STEEL_D, rough=0.6)
    P.poly([(x - 54, bot), (x + 54, bot), (x + 54, bot + 14), (x - 54, bot + 14)], STEEL_D, rough=0.5)
    P.poly([(x - 34, top), (x + 34, top), (x + 34, bot), (x - 34, bot)], GLASS, rough=0.9)
    # the packed bed, and the band of product running down it
    P.poly([(x - 30, top + 30), (x + 30, top + 30), (x + 30, bot - 8), (x - 30, bot - 8)], (222, 226, 218), rough=0.8)
    P.poly([(x - 30, top + 62), (x + 30, top + 62), (x + 30, top + 96), (x - 30, top + 96)], AMBER, rough=0.7)
    P.poly([(x - 30, top + 100), (x + 30, top + 100), (x + 30, top + 118), (x - 30, top + 118)], AMBER_D, rough=0.6, alpha=0.5)
    P.stroke([(x - 24, top + 40), (x - 24, bot - 16)], 7, (246, 250, 248), rough=0.4, alpha=0.6)
    P.poly([(x + 16, top), (x + 34, top), (x + 34, bot), (x + 16, bot)], GLASS_D, rough=0.8, alpha=0.45)
    P.poly([(x - 40, top - 16), (x + 40, top - 16), (x + 40, top + 4), (x - 40, top + 4)], STEEL_D, rough=0.6)
    P.poly([(x - 10, top - 44), (x + 10, top - 44), (x + 10, top - 14), (x - 10, top - 14)], STEEL_D, rough=0.5)
    # the take-off into a vial
    P.stroke([(x, bot + 14), (x, bot + 34), (x + 54, bot + 34), (x + 62, bot + 52)], 8, STEEL_D, rough=0.4)
    vx = x + 62
    P.poly([(vx - 16, y - 58), (vx + 16, y - 58), (vx + 16, y - 2), (vx - 16, y - 2)], GLASS, rough=0.7)
    P.poly([(vx - 14, y - 34), (vx + 14, y - 34), (vx + 14, y - 4), (vx - 14, y - 4)], AMBER, rough=0.7)
    P.poly([(vx - 12, y - 30), (vx - 4, y - 30), (vx - 4, y - 6), (vx - 12, y - 6)], AMBER_L, rough=0.4, alpha=0.6)
    P.poly([(vx - 10, y - 68), (vx + 10, y - 68), (vx + 10, y - 56), (vx - 10, y - 56)], STEEL_D, rough=0.4)


# --------------------------------------------------------- 4  FORMULATION --
def formulation(x, y):
    """A tote and bottles: the product made into something that keeps."""
    shadow(x, y + 4, 140, 13)
    cx, cw, ch = x - 46, 62, 110
    P.poly([(cx - cw - 8, y - 12), (cx + cw + 8, y - 12), (cx + cw + 8, y), (cx - cw - 8, y)], (120, 92, 56), rough=0.6)
    P.poly([(cx - cw, y - 12 - ch), (cx + cw, y - 12 - ch), (cx + cw, y - 12), (cx - cw, y - 12)], (250, 240, 214), rough=0.8)
    P.poly([(cx - cw + 4, y - 12 - ch * 0.72), (cx + cw - 4, y - 12 - ch * 0.72), (cx + cw - 4, y - 16), (cx - cw + 4, y - 16)], AMBER, rough=0.8)
    P.poly([(cx - cw + 4, y - 12 - ch * 0.72), (cx - cw + 26, y - 12 - ch * 0.72), (cx - cw + 26, y - 16), (cx - cw + 4, y - 16)], AMBER_L, rough=0.6, alpha=0.5)
    for i in range(1, 3):
        P.stroke([(cx - cw + i * cw * 2 / 3, y - 12 - ch), (cx - cw + i * cw * 2 / 3, y - 12)], 5, STEEL_D, rough=0.3)
        P.stroke([(cx - cw, y - 12 - ch + i * ch / 3), (cx + cw, y - 12 - ch + i * ch / 3)], 5, STEEL_D, rough=0.3)
    P.stroke([(cx - cw, y - 12 - ch), (cx + cw, y - 12 - ch), (cx + cw, y - 12), (cx - cw, y - 12), (cx - cw, y - 12 - ch)], 5, STEEL_D, rough=0.3)
    P.poly([(cx - 14, y - 12 - ch - 12), (cx + 14, y - 12 - ch - 12), (cx + 14, y - 12 - ch), (cx - 14, y - 12 - ch)], STEEL_D, rough=0.4)
    # bottles of the finished product beside it
    for i, (bx, bh) in enumerate(((x + 62, 86), (x + 96, 76), (x + 128, 82))):
        P.poly([(bx - 15, y - bh), (bx + 15, y - bh), (bx + 15, y), (bx - 15, y)], AMBER, rough=0.6)
        P.poly([(bx - 15, y - bh * 0.62), (bx + 15, y - bh * 0.62), (bx + 15, y - bh * 0.3), (bx - 15, y - bh * 0.3)], (250, 240, 214), rough=0.5)
        P.poly([(bx - 12, y - bh * 0.9), (bx - 6, y - bh * 0.9), (bx - 6, y - 6), (bx - 12, y - 6)], AMBER_L, rough=0.35, alpha=0.5)
        P.poly([(bx - 7, y - bh - 14), (bx + 7, y - bh - 14), (bx + 8, y - bh + 2), (bx - 8, y - bh + 2)], AMBER_D, rough=0.4)


# -------------------------------------------------------------- 5  TRIALS --
def crops(x0, x1, y, n, size=1.0, color=GREEN_M):
    step = (x1 - x0) / n
    for i in range(n):
        cx = x0 + step * (i + 0.5) + rng.normal(0, 2)
        cy = y + rng.normal(0, 1.5)
        s = size * (0.9 + 0.2 * rng.random())
        P.ellipse(cx, cy, 11 * s, 7 * s, GREEN_D, rough=0.6, n=10)
        P.ellipse(cx + 3 * s, cy - 3 * s, 6 * s, 4 * s, color, rough=0.4, n=8)
        P.ellipse(cx - 2 * s, cy - 6 * s, 4 * s, 5 * s, GREEN_L, rough=0.4, n=8)


def trials(x, y):
    """Two small test beds, measured season after season."""
    for bx, by, bw, nn, sz in ((x - 4, y - 58, 160, 5, 1.1), (x + 10, y + 16, 190, 6, 1.45)):
        P.poly([(bx - bw, by + 26), (bx + bw, by + 20), (bx + bw - 16, by - 22), (bx - bw + 16, by - 16)], (186, 164, 104), rough=1.4)
        P.poly([(bx - bw + 8, by + 20), (bx + bw - 8, by + 15), (bx + bw - 20, by - 16), (bx - bw + 20, by - 11)], (168, 142, 84), rough=1.2, alpha=0.7)
        for r in (-0.5, 0.25):
            P.stroke([(bx - bw + 22, by + r * 24 + 4), (bx + bw - 22, by + r * 24)], 5, SOIL, rough=0.9, alpha=0.4)
        crops(bx - bw + 24, bx + bw - 24, by, nn, sz)
        # a stake with a blank label: the trial is measured, not announced
        sx = bx - bw + 10
        P.stroke([(sx, by + 22), (sx, by - 42 * sz)], 5, (168, 146, 104), rough=0.3)
        P.poly([(sx - 3, by - 60 * sz), (sx + 40 * sz, by - 60 * sz), (sx + 40 * sz, by - 38 * sz), (sx - 3, by - 38 * sz)],
               (240, 234, 214), rough=0.5)
        P.stroke([(sx + 6, by - 53 * sz), (sx + 31 * sz, by - 53 * sz)], 3, (176, 170, 150), rough=0.3, alpha=0.7)
        P.stroke([(sx + 6, by - 46 * sz), (sx + 25 * sz, by - 46 * sz)], 3, (176, 170, 150), rough=0.3, alpha=0.7)


# -------------------------------------------------------------- the scene --
discovery(STATIONS[0], ROAD_Y - 10)
production(STATIONS[1], ROAD_Y - 4)
purification(STATIONS[2], ROAD_Y - 2)
formulation(STATIONS[3], ROAD_Y - 2)
trials(STATIONS[4], ROAD_Y - 6)

# 6  THE FARM: her own fields, past the end of the road
P.stroke([(1990, 742), (2420, 716)], 46, (170, 150, 92), rough=1.4, alpha=0.7)
P.stroke([(1990, 742), (2420, 716)], 6, SOIL, rough=0.8, alpha=0.45)
crops(2010, 2420, 734, 10, 1.0)
crops(2060, 2420, 688, 8, 0.8)
details.farmer(P, 2040, 706, shirt=(76, 108, 160), size=30, hoe=True)

# ------------------------------------------------------------------- write --
img = Image.fromarray(np.clip(C, 0, 255).astype(np.uint8))
if PREVIEW:
    img.save(PREVIEW)
OUT.mkdir(parents=True, exist_ok=True)
img.save(OUT / "safe-route-2400.webp", "WEBP", quality=80, method=6)
img.resize((1200, 400), Image.LANCZOS).save(OUT / "safe-route-1200.webp", "WEBP", quality=82, method=6)
img.resize((1200, 400), Image.LANCZOS).save(OUT / "safe-route-1200.jpg", "JPEG", quality=80, optimize=True, progressive=True)
print("wrote", OUT / "safe-route-2400.webp")
