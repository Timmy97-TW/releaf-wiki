"""The How ReLEAF works drawing (homepage #how), painted in the manner of
the design team's valley on the vision section (18 Oct 2026, owner: "the
style of the vision section, Naomi's design work").

    python3 build/how-art.py            # rewrites the SVG inside index.html
    python3 build/how-art.py --svg out.svg   # also writes a standalone copy

HER MANNER, as read from the valley painting: flat shapes in two or three
tones, no outlines and no gradients, edges that wander like a dry brush, a
small palette of sky blue, blue-grey ridge, olive, ochre, lime, yellow and
soil brown. Everything here keeps to that. The picture is vector, not a
raster: every shape is a polygon whose edge is jittered the way
build/vision_details.py's Painter jitters its masks, so the film's camera
can go in close (2.6x) and the edge stays a brush edge, not a blur.

THE SCENE (1200 x 680, the same stage the monoline schematic stood on, so
the film's camera and beats in home-scenes.js carry over): her sky in four
flat bands, her ridge, a patchwork plain in perspective with a river, and
on the near field the whole system: the crop with the leaf sensor at the
left, the forecast in the sky above it, the controller on a post in the
middle, the machine standing at the right with its case open (LED strip on
the inside wall, vessel, pump, hollow-fibre cartridge, photometer), and a
cutaway of the soil along the foot of the picture where the permeate line
runs back to a drip emitter at the crop.

WHAT THE FILM MOVES (home-story.js reads <g data-k>): the flows, pulses,
cells, protectant, drops, LEDs, beams, traces and labels, the same parts
as before by name. The scene stands whole from the first frame (owner,
18 Oct: open on the field and the reactor); the brush-clip paint-on is
kept in wipe() but off.

These additions are AI-assisted drawing after her style, not hers, and the
page says so in its HTML comment.
"""
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(20261018)
XL, XR = -240.0, 1440.0            # the painted extent: all the camera can ever see

# ----------------------------------------------------------------- palette --
SKY = [(120, 172, 222), (150, 192, 230), (184, 212, 236), (222, 228, 222), (244, 232, 190)]
RIDGE_FAR = (112, 134, 154)
RIDGE_MID = (74, 96, 112)
RIDGE_DK = (50, 68, 86)
RIDGE_NAVY = (38, 50, 72)
RIDGE_GREEN = (78, 136, 92)
RIDGE_GREEN_D = (52, 104, 66)
HILL_LIME = (156, 172, 92)
HILL_LIME_L = (176, 190, 104)
GAP = (214, 214, 164)                  # the pale paths between her fields
FIELDS = [(146, 168, 66), (176, 180, 112), (148, 166, 96), (191, 167, 110), (122, 90, 42),
          (217, 201, 68), (160, 176, 84), (206, 184, 126), (134, 158, 74), (182, 172, 104)]
NEAR = (168, 178, 104)
NEAR_L = (186, 194, 118)
RIVER = (126, 176, 206)
RIVER_L = (184, 214, 226)
BANK = (56, 102, 46)
SOIL = (122, 90, 42)
SOIL_L = (150, 116, 62)
SOIL_D = (98, 70, 32)
ROOTC = (206, 178, 124)
GREEN_D = (56, 102, 46)
GREEN_M = (92, 146, 62)
GREEN_L = (128, 178, 80)
GREEN_LIME = (170, 200, 92)
WOOD = (120, 92, 60)
CREAM = (246, 240, 220)
SCREEN = (34, 46, 56)
GLASS = (218, 230, 232)
GLASS_D = (160, 182, 190)
BROTH = (164, 186, 80)
BROTH_D = (132, 156, 60)
BROTH_P = (186, 190, 162)
SLATE = (58, 92, 130)
SLATE_L = (96, 130, 168)
AMBER = (236, 168, 48)
AMBER_L = (255, 226, 160)
STEEL = (132, 150, 158)
STEEL_L = (184, 198, 204)
STEEL_D = (84, 100, 110)
CASE = (40, 52, 74)
CASE_IN = (104, 118, 132)
CASE_IN_L = (128, 142, 154)
CASE_FLOOR = (70, 84, 100)
INK = (40, 48, 56)
LIME = (166, 220, 120)
SHADOW = "rgb(50 60 30 / .28)"

out = []


def rgb(c):
    return "rgb(%d %d %d)" % c if isinstance(c, tuple) else c


def rough(pts, r=1.2, step=5.0, closed=True, wob=1.2):
    """A polygon with a dry-brush edge: each edge sampled every `step` units,
    pushed along its normal by noise of `r` and a slow wobble."""
    pts = np.asarray(pts, dtype=np.float64)
    m = len(pts)
    res = []
    for i in range(m if closed else m - 1):
        a, b = pts[i], pts[(i + 1) % m]
        seg = b - a
        ln = float(np.hypot(*seg))
        n = max(int(ln / step), 1)
        nrm = np.array([-seg[1], seg[0]]) / max(ln, 1e-6)
        jit = rng.normal(0, r, n)
        jit[0] *= 0.3
        ph = rng.uniform(0, 6.28)
        for j in range(n):
            t = j / n
            w = wob * r * (0.6 * np.sin(t * ln / 23.0 + ph) + 0.4 * np.sin(t * ln / 9.0 + ph * 1.7))
            res.append(a + seg * t + nrm * (jit[j] + w))
    if not closed:
        res.append(pts[-1])
    return np.array(res)


def rrect(x0, y0, x1, y1, rad=0.0, n=5):
    """A rectangle, with rounded corners of `rad` if asked."""
    if rad <= 0:
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    pts = []
    for cx, cy, a0 in ((x1 - rad, y0 + rad, -np.pi / 2), (x1 - rad, y1 - rad, 0), (x0 + rad, y1 - rad, np.pi / 2), (x0 + rad, y0 + rad, np.pi)):
        for a in np.linspace(a0, a0 + np.pi / 2, n):
            pts.append((cx + rad * np.cos(a), cy + rad * np.sin(a)))
    return pts


def ell(cx, cy, rx, ry, n=20, rot=0.0):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x, y = rx * np.cos(t), ry * np.sin(t)
    c, s = np.cos(rot), np.sin(rot)
    return np.stack([cx + x * c - y * s, cy + x * s + y * c], 1)


def brush(pts, w, r=0.8, step=5.0, taper=0.0, cap=True):
    """A brush stroke along a polyline: its outline as a polygon, the sides
    ragged, the width thinning by `taper` toward the end."""
    pts = np.asarray(pts, dtype=np.float64)
    seg = np.diff(pts, axis=0)
    L = np.hypot(seg[:, 0], seg[:, 1])
    cum = np.concatenate([[0], np.cumsum(L)])
    tot = max(cum[-1], 1e-6)
    n = max(int(tot / step), 2)
    ts = np.linspace(0, tot, n + 1)
    P = np.stack([np.interp(ts, cum, pts[:, 0]), np.interp(ts, cum, pts[:, 1])], 1)
    d = np.gradient(P, axis=0)
    d /= np.maximum(np.hypot(d[:, 0], d[:, 1]), 1e-6)[:, None]
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    half = (w / 2) * (1 - taper * ts / tot)
    jl = rng.normal(0, r, n + 1)
    jr = rng.normal(0, r, n + 1)
    left = P + nrm * (half + jl)[:, None]
    right = P - nrm * (half + jr)[:, None]
    end, start = [], []
    if cap:
        for a in np.linspace(0, np.pi, 6)[1:-1]:
            end.append(P[-1] + nrm[-1] * np.cos(a) * half[-1] + d[-1] * np.sin(a) * half[-1])
        for a in np.linspace(0, np.pi, 6)[1:-1]:
            start.append(P[0] - nrm[0] * np.cos(a) * half[0] - d[0] * np.sin(a) * half[0])
    return np.concatenate([left, np.array(end).reshape(-1, 2), right[::-1], np.array(start).reshape(-1, 2)])


def dpath(pts, closed=True):
    """Path data in relative steps: a point costs about five bytes."""
    q = np.round(np.asarray(pts, dtype=np.float64)).astype(int)
    s = "M%d %d" % tuple(q[0])
    prev = q[0]
    body = []
    for pt in q[1:]:
        d = pt - prev
        if d[0] == 0 and d[1] == 0:
            continue
        body.append(("%d" if d[0] < 0 else " %d") % d[0] + ("%d" if d[1] < 0 else " %d") % d[1])
        prev = pt
    return s + "l" + "".join(body).lstrip(" ") + ("z" if closed else "")


def shape(pts, fill, alpha=None, cls=None, attrs="", closed=True):
    a = ' fill="%s"' % rgb(fill) if fill is not None else ""
    if alpha is not None and alpha < 1:
        a += ' fill-opacity="%.2f"' % alpha
    if cls:
        a += ' class="%s"' % cls
    out.append('<path%s%s d="%s" />' % (a, (" " + attrs) if attrs else "", dpath(pts, closed)))


def poly(pts, fill, r=1.0, step=5.0, alpha=None, cls=None, attrs="", wob=0.7):
    shape(rough(pts, r, step, True, wob), fill, alpha, cls, attrs)


def stroke(pts, w, fill, r=0.6, step=5.0, alpha=None, cls=None, taper=0.0, attrs=""):
    shape(brush(pts, w, r, step, taper), fill, alpha, cls, attrs)


def shadow(cx, cy, rx, ry, alpha=1.0):
    shape(rough(ell(cx, cy, rx, ry, 16), 0.8, 4), SHADOW, None, None,
          'style="opacity:%.2f"' % alpha if alpha < 1 else "")


def g(attrs=""):
    out.append("<g%s>" % ((" " + attrs) if attrs else ""))


def end():
    out.append("</g>")


WIPES_ON = False   # 18 Oct, owner: the film opens on the painted scene, nothing paints on


def wipe(name, x0, y0, x1, y1, axis="x"):
    """A brush-edged clip for a group that paints on (home-scenes.js moves
    it in along `axis`; in the markup it already covers the group). Off
    since the owner asked for the film to open on the whole scene."""
    if not WIPES_ON:
        return ""
    m = 14
    x0, x1 = max(x0, -220), min(x1, 1420)          # the camera never sees past these
    box = rrect(x0 - m, y0 - m, x1 + m, y1 + m)
    lead = rough(box[1:3] if axis == "x" else box[0:2], 3.0, 7, closed=False)   # the right edge, or the top
    pts = np.concatenate([lead, box[3:4] if axis == "x" else box[2:4]]) if axis == "x" else np.concatenate([lead, box[2:4]])
    if axis == "x":
        pts = np.concatenate([box[0:1], lead, box[3:4]])
    w = (x1 - x0 if axis == "x" else y1 - y0) + 2 * m + 8
    out.append('<clipPath id="wp-%s"><path data-k="wp-%s" data-axis="%s" data-w="%d" transform="translate(0 0)" d="%s" /></clipPath>'
               % (name, name, axis, w, dpath(pts)))
    return 'clip-path="url(#wp-%s)"' % name


# ====================================================================== SKY --
out.append('<rect class="rw-paper" x="-900" y="-700" width="3000" height="2200" />')
g('class="rw-sky"')
bands = [(-700, 20), (20, 150), (150, 250), (250, 420)]
for (y0, y1), col in zip(bands, (SKY[0], SKY[1], SKY[2], SKY[4])):
    poly([(XL, y0), (XR, y0), (XR, y1), (XL, y1)], col, r=1.4, step=18, wob=3.0)
# two long pale drags of the brush across the sky, the way she paints it
for yy, x0, ln, a in ((80, 120, 620, 0.4), (190, 560, 540, 0.35)):
    stroke([(x0, yy), (x0 + ln * 0.5, yy - 4), (x0 + ln, yy + 2)], 16, (238, 242, 242), r=1.2, step=10, alpha=a, taper=0.6)
end()

# ==================================================================== RIDGE --
# far range: pale blue-grey, the whole width
g(wipe("ridge", XL, 150, XR, 360) + ' class="rw-ridge"')
far = [(XL, 300), (-120, 284), (10, 258), (120, 236), (210, 214), (300, 232), (380, 246), (450, 212), (520, 196), (600, 222),
       (690, 238), (780, 218), (860, 234), (940, 206), (1010, 226), (1090, 244), (1200, 236), (1300, 252), (XR, 262), (XR, 360), (XL, 360)]
poly(far, RIDGE_FAR, r=1.2, step=9, wob=1.0)
poly([(450, 212), (520, 196), (600, 222), (560, 262), (470, 266)], (128, 150, 168), r=1.0, step=7, alpha=0.8)
poly([(860, 234), (940, 206), (1010, 226), (980, 266), (880, 270)], (128, 150, 168), r=1.0, step=7, alpha=0.8)
# mid range: her dark blue-grey peaks with green faces
mid = [(XL, 340), (-150, 320), (-60, 296), (40, 304), (120, 282), (200, 258), (270, 248), (340, 272), (400, 262),
       (470, 292), (540, 280), (610, 254), (660, 270), (720, 250), (780, 264), (840, 286), (900, 272), (960, 296), (1040, 300), (1130, 286),
       (1240, 306), (1400, 300), (XR, 320), (XR, 400), (XL, 400)]
poly(mid, RIDGE_MID, r=1.2, step=8, wob=1.0)
# dark facets and green faces, where the light falls
for pts in ([(190, 266), (260, 252), (300, 300), (230, 318), (170, 300)],
            [(610, 258), (660, 272), (700, 300), (640, 322), (590, 296)],
            [(720, 254), (780, 266), (800, 304), (740, 318)],
            [(960, 296), (1040, 300), (1070, 326), (980, 330)],
            [(-140, 294), (-20, 308), (10, 336), (-110, 340)]):
    poly(pts, RIDGE_DK, r=1.0, step=6)
for pts in ([(260, 252), (330, 274), (360, 310), (290, 320), (262, 290)],
            [(400, 262), (470, 296), (430, 326), (380, 300)],
            [(660, 272), (720, 254), (740, 300), (690, 314)],
            [(840, 286), (900, 272), (930, 312), (860, 322)],
            [(90, 296), (190, 266), (170, 320), (100, 330)]):
    poly(pts, RIDGE_GREEN, r=1.0, step=6)
for pts in ([(300, 300), (360, 310), (340, 336), (280, 338)], [(690, 314), (740, 300), (760, 334), (700, 338)], [(100, 330), (170, 320), (150, 344), (90, 346)]):
    poly(pts, RIDGE_GREEN_D, r=0.9, step=6)
# the near dark bluff at the right, like hers
poly([(1040, 336), (1100, 280), (1150, 222), (1200, 176), (1260, 150), (1330, 164), (1400, 210), (XR, 236), (XR, 420), (1030, 420)], RIDGE_NAVY, r=1.4, step=7, wob=1.0)
poly([(1150, 222), (1200, 176), (1260, 150), (1240, 230), (1190, 290)], RIDGE_DK, r=1.2, step=6)
poly([(1280, 160), (1330, 164), (1400, 210), (1360, 260), (1300, 240)], (60, 80, 104), r=1.2, step=6)
# the lime hill at the left, like hers
poly([(XL, 420), (XL, 330), (-160, 312), (-60, 310), (20, 326), (80, 350), (110, 384), (60, 420)], HILL_LIME, r=1.4, step=8, wob=1.2)
poly([(XL, 348), (-170, 326), (-70, 330), (0, 350), (-60, 370), (XL, 382)], HILL_LIME_L, r=1.2, step=8, alpha=0.85)
poly([(-150, 336), (-70, 338), (-20, 362), (-130, 370)], (132, 150, 70), r=1.0, step=6, alpha=0.7)
end()

# =================================================================== FIELDS --
HZ = 334.0          # where the plain meets the ridge
GROUND = 560.0      # where things stand
VX, VY = 600.0, 250.0
g(wipe("plain", XL, 320, XR, 600) + ' class="rw-plain"')
poly([(XL, HZ - 2), (XR, HZ - 2), (XR, GROUND + 6), (XL, GROUND + 6)], GAP, r=1.2, step=12)
rows_y = [HZ + (GROUND + 30 - HZ) * (k / 7.0) ** 2.0 for k in range(8)]
cols_near = np.linspace(-700, 1900, 15) + rng.normal(0, 30, 15)


def xat(xn, y):
    return VX + (xn - VX) * (y - VY) / (GROUND - VY)


last = None
for k in range(7):
    y0, y1 = rows_y[k], rows_y[k + 1]
    gap = 2.5 + 2.5 * (k / 6.0)
    j = 0
    while j < len(cols_near) - 1:
        span = 2 if rng.random() < 0.18 and j < len(cols_near) - 2 else 1
        xa, xb = cols_near[j], cols_near[j + span]
        col = FIELDS[rng.integers(len(FIELDS))]
        if col == last:
            col = FIELDS[(FIELDS.index(col) + 3) % len(FIELDS)]
        last = col
        q = [(xat(xa, y0) + gap, y0 + gap * 0.6), (xat(xb, y0) - gap, y0 + gap * 0.6), (xat(xb, y1) - gap, y1 - gap * 0.6), (xat(xa, y1) + gap, y1 - gap * 0.6)]
        if q[1][0] - q[0][0] < 6 or max(q[1][0], q[2][0]) < XL or min(q[0][0], q[3][0]) > XR:
            j += span
            continue
        poly(q, col, r=0.7 + 0.5 * k / 6, step=6 + 5 * k / 6, wob=1.0)
        # a lighter drag of the brush inside the field, the way she paints them
        if k >= 2 and rng.random() < 0.7:
            cx0 = (q[0][0] * 0.7 + q[1][0] * 0.3), (q[0][1] + q[3][1]) / 2
            cx1 = (q[0][0] * 0.25 + q[1][0] * 0.75), (q[1][1] + q[2][1]) / 2
            w = (q[3][1] - q[0][1]) * 0.35
            light = tuple(min(255, int(c * 1.12 + 10)) for c in col)
            stroke([cx0, cx1], max(w, 3), light, r=1.0, step=6, alpha=0.5, taper=0.3)
        j += span
# the near field everything stands on: one wide olive band with a lighter drag
poly([(XL, 470), (XR, 462), (XR, GROUND + 8), (XL, GROUND + 8)], NEAR, r=1.2, step=10, wob=1.5)
stroke([(-200, 500), (700, 496)], 26, NEAR_L, r=1.0, step=10, alpha=0.6, taper=0.4)
stroke([(820, 530), (1300, 526)], 20, NEAR_L, r=1.0, step=10, alpha=0.5, taper=0.4)
# her river, down the left of the plain, with her dark bushes on its banks
river = [(470, HZ + 2), (440, 360), (390, 392), (330, 416), (262, 440), (180, 466), (96, 492), (10, 520), (-100, 548), (-220, 580)]
stroke(river, 9, RIVER, r=0.9, step=5, taper=-0.9)
stroke(river[1:], 4, RIVER_L, r=0.6, step=5, alpha=0.8, taper=-0.6)
for bx, by, br in ((452, 352, 5), (402, 384, 6), (346, 410, 6), (300, 430, 5), (214, 456, 7), (130, 484, 7), (62, 504, 8), (-30, 532, 9)):
    poly(ell(bx, by, br, br * 0.75, 12), BANK, r=0.8, step=3)
    poly(ell(bx + br * 0.3, by - br * 0.3, br * 0.5, br * 0.4, 10), GREEN_M, r=0.5, step=3)
# rows of young crops across the near field, receding
for yy, s in ((540, 1.0), (508, 0.7)):
    x = XL + rng.uniform(0, 20)
    while x < XR:
        if not (380 < x < 620 or 600 < x < 1180 and yy > 500) and not (180 < x < 290 and yy > 520):
            poly(ell(x, yy, 7 * s, 4.6 * s, 10), GREEN_D, r=0.6, step=3)
            poly(ell(x + 1 * s, yy - 3 * s, 4 * s, 3.2 * s, 9), GREEN_L if rng.random() < 0.5 else GREEN_M, r=0.4, step=3)
        x += 34 * s + rng.uniform(-4, 4)
end()

# ===================================================================== SOIL --
# the cutaway at the foot of the picture: the ground in section, where the
# permeate line runs back to the roots
g(wipe("soil", XL, 540, XR, 1400) + ' class="rw-soil"')
poly([(XL, GROUND), (XR, GROUND), (XR, 1400), (XL, 1400)], SOIL, r=1.4, step=10, wob=1.4)
poly([(XL, GROUND), (XR, GROUND), (XR, GROUND + 13), (XL, GROUND + 13)], SOIL_L, r=1.2, step=8)
for i in range(14):
    x = rng.uniform(XL, XR)
    y = rng.uniform(GROUND + 22, 900)
    rr = rng.uniform(2, 4)
    poly(ell(x, y, rr, rr * 0.7, 9), SOIL_D if rng.random() < 0.6 else SOIL_L, r=0.5, step=3, alpha=0.7)
for x0, x1, yy in ((XL, -300, 640), (300, 560, 700), (1250, XR, 650), (-200, 120, 760)):
    stroke([(x0, yy), (x1, yy + rng.normal(0, 4))], 10, SOIL_D, r=1.6, step=8, alpha=0.45, taper=0.5)
end()

# =================================================================== FIELD ---
# the crops with the leaf sensor: a big leafy plant and two smaller ones,
# their roots in the soil below


def leaf(cx, cy, ln, wd, ang, col, r=0.9):
    t = np.linspace(0, 2 * np.pi, 22, endpoint=False)
    # a leaf: an ellipse, fuller at the tip than at the stem
    x = ln / 2 * np.cos(t) + ln / 2
    y = wd / 2 * np.sin(t) * (0.5 + 0.5 * (1 - np.cos(t)) / 2) ** 0.5
    c, s = np.cos(ang), np.sin(ang)
    pts = np.stack([cx + x * c - y * s, cy + x * s + y * c], 1)
    poly(pts, col, r=r, step=3)


def plant(x, y, h, seed=1):
    """A leafy crop standing on (x, y), h tall: a head of rounded leaves,
    the outer ones dark and open, the inner ones lighter and upright, the
    heart lime."""
    r0 = np.random.default_rng(seed)
    shadow(x - 0.1 * h, y + 2, 0.55 * h, 0.07 * h, 0.9)
    for ang, ln, wd, col in ((-176, 0.52, 0.26, GREEN_D), (-4, 0.52, 0.26, GREEN_D), (-150, 0.6, 0.3, GREEN_D), (-30, 0.6, 0.3, GREEN_D),
                             (-128, 0.72, 0.34, GREEN_M), (-52, 0.72, 0.34, GREEN_M), (-105, 0.86, 0.36, GREEN_M), (-75, 0.86, 0.36, GREEN_L),
                             (-90, 1.0, 0.4, GREEN_L)):
        leaf(x, y - 0.06 * h, ln * h, wd * h, np.radians(ang + r0.normal(0, 3)), col, r=0.7)
    poly(ell(x, y - 0.48 * h, 0.16 * h, 0.2 * h, 12), GREEN_LIME, r=0.7, step=4)


g(wipe("field", -40, 300, 420, 575, "y") + ' class="rw-field"')
plant(104, GROUND, 96, 3)
plant(352, GROUND, 84, 4)
plant(230, GROUND, 176, 5)
# the sensor clipped to a leaf, its wire running up to the controller
g('transform="translate(286 438) rotate(-15)"')
poly(rrect(-20, -9, 20, 9, 4), INK, r=0.5, step=3)
poly(rrect(-14, -5, 14, 5, 2), (74, 84, 92), r=0.3, step=3)
stroke([(-20, 0), (-30, 0)], 3, INK, r=0.2)
stroke([(20, 0), (30, 0)], 3, INK, r=0.2)
stroke([(10, -9), (10, -24)], 3, INK, r=0.2, cls="rw-ant")
end()
end()
out.append('<g data-k="blink" transform="translate(296 412)"><circle class="rw-led-glow" r="9" filter="url(#rw-glow-s)" /><circle class="rw-blink" r="3.5" /></g>')
# the roots, in the soil cutaway, and the drip emitter beside them
g(wipe("roots", 150, 548, 320, 640, "y") + ' class="rw-roots"')
for pts in ([(230, GROUND), (222, 584), (206, 606)], [(230, GROUND), (238, 590), (254, 612)], [(230, GROUND), (231, 582), (229, 618)], [(228, 572), (214, 590)], [(233, 586), (246, 600)]):
    stroke(pts, 4, ROOTC, r=0.5, step=4, taper=0.6)
end()

# ==================================================================== HEAT --
# 18 Oct (Jacquelyn): the first step shows the heat the crop is standing in.
# A warm wash in the air over the field and shimmer rising off it, in her
# palette; home-scenes.js brings both in under the first caption and takes
# them off once the protectant reaches the crop.
g('data-k="heat" transform="translate(0 0)"')
poly(ell(228, 486, 212, 104, 26), AMBER, r=2.4, step=7, alpha=0.17)
poly(ell(232, 500, 150, 72, 22), AMBER, r=2.0, step=6, alpha=0.13)
# one off each canopy, rising into the air over the field
for i, (x, y, h, w) in enumerate(((104, 502, 52, 7), (174, 468, 62, 9), (238, 452, 68, 10), (298, 474, 56, 8), (358, 508, 48, 7))):
    pts = [(x + w * np.sin(j * 1.1 + i * 1.7), y - j * h / 6.0) for j in range(7)]
    stroke(pts, 5.0, AMBER, r=0.6, step=5, alpha=0.7, taper=0.85)
    stroke(pts, 2.0, AMBER_L, r=0.4, step=5, alpha=0.55, taper=0.85)
end()

# ================================================================= FORECAST --
# the weather, drawn in the sky: a sun behind a cloud, its forecast wired to
# the controller
g(wipe("forecast", 60, 150, 230, 270) + ' class="rw-forecast"')
poly(ell(178, 192, 24, 24, 18), (238, 206, 84), r=0.8, step=3)
poly(ell(174, 188, 14, 14, 14), (250, 228, 120), r=0.5, step=3, alpha=0.7)
for cx, cy, rx, ry in ((124, 226, 30, 20), (152, 218, 32, 24), (184, 228, 28, 18), (150, 236, 46, 14)):
    poly(ell(cx, cy, rx, ry, 18), (246, 246, 240), r=1.0, step=3)
poly(ell(150, 240, 44, 9, 16), (212, 220, 224), r=0.8, step=3, alpha=0.7)
end()
out.append('<g data-k="wire-fc" data-draw transform="translate(0 0)"><path class="rw-wire" pathLength="1" d="M140 250 C140 306 330 292 420 298" /></g>')
out.append('<g data-k="wire-sn" data-draw transform="translate(0 0)"><path class="rw-wire" pathLength="1" d="M296 408 C310 340 370 316 420 318" data-path="wire-sn" /></g>')
out.append('<g data-k="pulse1" data-flow transform="translate(0 0)"><circle class="rw-pulse" r="4.5" /></g>')

# =============================================================== CONTROLLER --
g(wipe("ctrl", 410, 226, 600, 575, "y") + ' class="rw-ctrl"')
shadow(500, GROUND + 2, 40, 6)
stroke([(505, GROUND), (505, 366)], 11, WOOD, r=0.7, step=5)
stroke([(498, GROUND - 8), (498, 380)], 3, (150, 118, 80), r=0.3, step=5, alpha=0.6)
poly(rrect(420, 236, 590, 366, 8), CREAM, r=1.0, step=4)
poly([(420, 358), (590, 358), (590, 366), (420, 366)], (214, 206, 182), r=0.6, step=4, alpha=0.8)
poly(rrect(436, 248, 574, 352, 4), SCREEN, r=0.6, step=4)
stroke([(440, 344), (570, 344)], 1.6, (120, 134, 134), r=0.1, step=6)
stroke([(444, 346), (444, 256)], 1.6, (120, 134, 134), r=0.1, step=6)
end()
out.append('<g data-k="thr" transform="translate(0 0)"><path class="rw-thr" d="M444 282 H570" /></g>')
out.append('<g data-k="idx" data-draw transform="translate(0 0)"><path class="rw-trace rw-trace--idx" pathLength="1" d="M446 338 C470 336 490 328 505 312 S538 292 550 276 S566 258 570 254" /></g>')
out.append('<g data-k="thrdot" transform="translate(547 282)"><circle class="rw-led-glow" r="11" filter="url(#rw-glow-s)" /><circle class="rw-thrdot" r="4.5" /></g>')
out.append('<g data-k="wire-lamp" data-draw transform="translate(0 0)"><path class="rw-wire" pathLength="1" d="M590 330 C612 330 618 320 626 300 C634 282 638 268 644 258" data-path="wire-lamp" /></g>')
out.append('<g data-k="pulseB1" data-flow transform="translate(0 0)"><circle class="rw-pulse rw-pulse--g" r="4.5" /></g>')

# ================================================================== THE CASE --
CX0, CY0, CX1, CY1 = 624.0, 160.0, 1140.0, GROUND
g(wipe("case", 600, 120, 1160, 580) + ' class="rw-case"')
shadow(882, GROUND + 4, 290, 10)
poly(rrect(CX0, CY0, CX1, CY1, 10), CASE, r=1.0, step=8, wob=1.0)
poly(rrect(CX0 + 14, CY0 + 14, CX1 - 14, CY1 - 12, 4), CASE_IN, r=0.8, step=8, wob=1.0)
# the inside: a lighter wall at the left, where the strip is fixed, the floor
poly([(CX0 + 14, CY0 + 14), (CX0 + 42, CY0 + 14), (CX0 + 42, CY1 - 12), (CX0 + 14, CY1 - 12)], CASE_IN_L, r=0.7, step=8)
poly([(CX0 + 14, CY1 - 30), (CX1 - 14, CY1 - 30), (CX1 - 14, CY1 - 12), (CX0 + 14, CY1 - 12)], CASE_FLOOR, r=0.7, step=8)
# the wall's paint, dragged
for yy, a in ((230, 0.3), (350, 0.25), (470, 0.3)):
    stroke([(CX0 + 70, yy + rng.normal(0, 3)), (CX1 - 50, yy + rng.normal(0, 3))], 24, CASE_IN_L, r=1.2, step=10, alpha=a, taper=0.5)
# her small panel on the lid, as on her own reactor drawing
poly([(CX0 + 30, CY0 + 2), (CX0 + 74, CY0 + 2), (CX0 + 80, CY0 - 22), (CX0 + 36, CY0 - 22)], (60, 70, 84), r=0.6, step=5)
poly([(CX0 + 38, CY0 - 4), (CX0 + 68, CY0 - 4), (CX0 + 72, CY0 - 18), (CX0 + 42, CY0 - 18)], SCREEN, r=0.4, step=5)
stroke([(CX0 + 46, CY0 - 10), (CX0 + 52, CY0 - 6), (CX0 + 64, CY0 - 16)], 2.4, LIME, r=0.2, step=4)
end()
# the light: the wash across the inside of the case, green then red
out.append('<g data-k="beam" transform="translate(0 0)"><path class="rw-beam" d="%s" /></g>' % dpath(rough([(654, 262), (654, 520), (884, 550), (884, 230)], 2.0, 6)))
out.append('<g data-k="beam-red" transform="translate(0 0)"><path class="rw-beam rw-beam--red" d="%s" /></g>' % dpath(rough([(654, 262), (654, 520), (884, 550), (884, 230)], 2.0, 6)))

# the LED strip on the inside wall
g(wipe("strip", 626, 246, 666, 536, "y") + ' class="rw-strip"')
poly(rrect(638, 256, 654, 526, 5), (222, 228, 222), r=0.5, step=4)
LEDY = [272 + 32 * i for i in range(8)]
out.append('<g class="rw-leds">' + "".join('<circle cx="646" cy="%d" r="4" />' % y for y in LEDY) + "</g>")
end()
out.append('<g class="rw-leds rw-leds--glow rw-leds--on" filter="url(#rw-glow)">' + "".join('<circle cx="646" cy="%d" r="9" />' % y for y in LEDY) + "</g>")
out.append('<g class="rw-leds rw-leds--on">' + "".join('<circle cx="646" cy="%d" r="4" />' % y for y in LEDY) + "</g>")
out.append('<g class="rw-leds rw-leds--glow rw-leds--red" filter="url(#rw-glow)">' + "".join('<circle cx="646" cy="%d" r="9" />' % y for y in LEDY) + "</g>")
out.append('<g class="rw-leds rw-leds--red">' + "".join('<circle cx="646" cy="%d" r="4" />' % y for y in LEDY) + "</g>")

# =================================================================== VESSEL --
VX0, VY0, VX1, VY1 = 690.0, 250.0, 860.0, 530.0
g(wipe("vessel", 670, 210, 880, 550, "y") + ' class="rw-vessel"')
shadow(775, VY1 + 2, 90, 7)
poly(rrect(VX0, VY0, VX1, VY1, 26), GLASS, r=1.0, step=5)
# the broth: pale and still until the light is on
poly(rrect(VX0 + 7, 340, VX1 - 7, VY1 - 6, 20), BROTH_P, r=1.0, step=5, cls="rw-broth")
end()
g('data-k="broth-on" transform="translate(0 0)"')
poly(rrect(VX0 + 7, 340, VX1 - 7, VY1 - 6, 20), BROTH, r=1.0, step=5)
poly([(VX1 - 50, 348), (VX1 - 10, 352), (VX1 - 9, VY1 - 24), (VX1 - 44, VY1 - 8)], BROTH_D, r=1.0, step=5, alpha=0.55)
poly([(VX0 + 12, 342), (VX1 - 12, 342), (VX1 - 16, 350), (VX0 + 16, 350)], (196, 212, 110), r=0.8, step=5, alpha=0.7)
end()
g(wipe("vessel2", 670, 210, 880, 550, "y") + ' class="rw-vessel"')
# the glass again over the broth: its shaded side, its highlight, its cap
poly([(VX1 - 34, VY0 + 6), (VX1 - 4, VY0 + 26), (VX1 - 4, VY1 - 26), (VX1 - 30, VY1 - 6), (VX1 - 30, VY0 + 20)], GLASS_D, r=0.9, step=5, alpha=0.5)
stroke([(VX0 + 14, VY0 + 36), (VX0 + 12, VY1 - 40)], 5, (248, 252, 250), r=0.5, step=6, alpha=0.75, taper=0.3)
poly(rrect(740, 226, 810, 254, 4), STEEL_D, r=0.6, step=4)
poly(rrect(748, 220, 802, 230, 3), STEEL, r=0.4, step=4)
end()
# the stir bar, the cells and the protectant live inside the broth
out.append('<g data-k="stir" transform="translate(775 514)"><path class="rw-stir" d="%s" /></g>' % dpath(rough(rrect(-16, -3.5, 16, 3.5, 3.5), 0.4, 3)))


def capsule(ln, wd, n=7):
    pts = [(ln / 2 + np.cos(a) * wd / 2, np.sin(a) * wd / 2) for a in np.linspace(-np.pi / 2, np.pi / 2, n)]
    pts += [(-ln / 2 + np.cos(a) * wd / 2, np.sin(a) * wd / 2) for a in np.linspace(np.pi / 2, 3 * np.pi / 2, n)]
    return pts


RODS = [(722, 372, -20), (776, 362, 14), (822, 384, -34), (734, 420, 26), (792, 414, -6), (756, 458, 40), (816, 452, 18), (724, 486, -12), (786, 496, 8)]
for i, (x, y, a) in enumerate(RODS, 1):
    out.append('<g data-k="rod%d" transform="translate(%d %d)"><g transform="rotate(%d)"><path class="rw-rod" d="%s" /><path class="rw-rod rw-rod--on" d="%s" /></g></g>'
               % (i, x, y, a, dpath(rough(capsule(24, 9), 0.4, 2.5)), dpath(rough(capsule(15, 3.6), 0.25, 2.5))))
DOTS = [(748, 386), (804, 400), (716, 446), (770, 436), (834, 428), (742, 506), (808, 480)]
for i, (x, y) in enumerate(DOTS, 1):
    out.append('<g data-k="dot%d" transform="translate(%d %d)"><path class="rw-dot" d="%s" /><circle class="rw-dot-hi" cx="-1.4" cy="-1.4" r="1.4" /></g>'
               % (i, x, y, dpath(rough(ell(0, 0, 4.6, 4.6, 12), 0.35, 2.5))))

# ===================================================================== LOOP --
LOOP_UP = "M860 290 H898 Q926 290 926 262 V238 Q926 214 950 214 H1016 Q1040 214 1040 238 V290"
LOOP_BACK = "M1040 520 V534 Q1040 548 1026 548 H749 Q735 548 735 534 V530"
g('data-k="grp-loop" data-draw transform="translate(0 0)"')
out.append('<path class="rw-tube" pathLength="1" d="%s" />' % LOOP_UP)
out.append('<path class="rw-tube" pathLength="1" d="%s" />' % LOOP_BACK)
end()
g(wipe("photo", 870, 526, 930, 570) + ' class="rw-photo"')
poly(rrect(882, 536, 918, 560, 3), INK, r=0.5, step=3)
poly(rrect(892, 541, 908, 555, 2), (74, 84, 92), r=0.3, step=3)
end()
out.append('<path class="rw-none" data-path="loop" d="M860 290 H898 Q926 290 926 262 V238 Q926 214 950 214 H1016 Q1040 214 1040 238 V290 V520 V534 Q1040 548 1026 548 H749 Q735 548 735 534 V530" />')
out.append('<path class="rw-none" data-path="toout" d="M860 290 H898 Q926 290 926 262 V238 Q926 214 950 214 H1016 Q1040 214 1040 238 V290 V420 H1064" />')
out.append('<path class="rw-none" data-path="perm" d="M1064 420 H1096 Q1118 420 1118 442 V598 Q1118 620 1096 620 H228 Q206 620 206 598 V560" />')
out.append('<g data-k="flow-loop" data-flow transform="translate(0 0)"><path class="rw-flow" data-flowel="loop" d="M860 290 H898 Q926 290 926 262 V238 Q926 214 950 214 H1016 Q1040 214 1040 238 V290 V520 V534 Q1040 548 1026 548 H749 Q735 548 735 534 V530" /></g>')
out.append('<g data-k="pbeam" transform="translate(0 0)"><path class="rw-pbeam" d="M900 541 V555" /></g>')

# the pump head
g(wipe("pump", 950, 180, 1016, 248) + ' class="rw-pump"')
poly(ell(983, 216, 26, 26, 20), STEEL_D, r=0.7, step=4)
poly(ell(983, 214, 23, 23, 20), STEEL_L, r=0.6, step=4)
poly(ell(977, 208, 10, 8, 12), (214, 224, 228), r=0.5, step=3, alpha=0.7)
end()
out.append('<g data-k="rotor" transform="translate(983 214)"><g transform="rotate(20)"><path class="rw-arm" d="M0 -13 V13 M-11.3 -6.5 L11.3 6.5 M-11.3 6.5 L11.3 -6.5" /><circle class="rw-roller" cy="-13" r="5" /><circle class="rw-roller" cx="11.3" cy="6.5" r="5" /><circle class="rw-roller" cx="-11.3" cy="6.5" r="5" /></g></g>')

# the hollow-fibre cartridge
g(wipe("cart", 1000, 276, 1110, 536, "y") + ' class="rw-cart"')
poly(rrect(1016, 290, 1064, 520, 14), GLASS, r=0.8, step=4)
for fx in (1030, 1040, 1050):
    stroke([(fx, 306), (fx, 504)], 3, (196, 212, 208), r=0.3, step=6)
poly([(1052, 296), (1062, 304), (1062, 506), (1052, 514)], GLASS_D, r=0.6, step=4, alpha=0.5)
poly(rrect(1012, 284, 1068, 296, 3), STEEL_D, r=0.5, step=4)
poly(rrect(1012, 514, 1068, 526, 3), STEEL_D, r=0.5, step=4)
end()
g('data-k="grp-cart" data-draw transform="translate(0 0)"')
out.append('<path class="rw-tube" pathLength="1" d="M1064 420 H1096" />')
end()
out.append('<g data-k="pores" transform="translate(0 0)"><path class="rw-pores" d="M1064 332 V492" /></g>')

# ================================================================= PERMEATE --
g('data-k="grp-perm" data-draw transform="translate(0 0)"')
out.append('<path class="rw-perm rw-perm--case" pathLength="1" d="M1096 420 Q1118 420 1118 442 V548" />')
out.append('<path class="rw-perm" pathLength="1" d="M1118 548 V598 Q1118 620 1096 620 H228 Q206 620 206 598 V560" />')
end()
g(wipe("emit", 188, 536, 224, 566) + ' class="rw-emit"')
poly(rrect(198, 546, 214, 560, 2), INK, r=0.4, step=3)
end()
out.append('<g data-k="flow-perm" data-flow transform="translate(0 0)"><path class="rw-flow rw-flow--perm" data-flowel="perm" d="M1064 420 H1096 Q1118 420 1118 442 V598 Q1118 620 1096 620 H228 Q206 620 206 598 V560" /></g>')
out.append('<g data-k="halo" transform="translate(236 448)"><ellipse class="rw-halo" rx="118" ry="132" filter="url(#rw-glow-l)" /></g>')
for i in (1, 2, 3):
    out.append('<g data-k="drop%d" data-flow transform="translate(206 562)"><path class="rw-drop" d="M0 -6 C3 -2 5 1 5 3 A5 5 0 0 1 -5 3 C-5 1 -3 -2 0 -6 Z" /></g>' % i)
for i in range(1, 6):
    out.append('<g data-k="frod%d" data-flow transform="translate(0 0)"><path class="rw-rod" d="%s" /><path class="rw-rod rw-rod--lit" d="%s" /></g>'
               % (i, dpath(rough(capsule(22, 8), 0.4, 2.5)), dpath(rough(capsule(13, 3.2), 0.25, 2.5))))
for name, n in (("fdot", 6), ("pdot", 6)):
    for i in range(1, n + 1):
        out.append('<g data-k="%s%d" data-flow transform="translate(0 0)"><path class="rw-dot" d="%s" /></g>' % (name, i, dpath(rough(ell(0, 0, 4.4, 4.4, 12), 0.35, 2.5))))

# =================================================================== LABELS --
LABELS = [
    ("lab-forecast", 150, 150, "middle", "", "forecast"),
    ("lab-sensor", 316, 456, "start", "", "leaf sensor"),
    ("lab-index", 505, 226, "middle", "", "stress index"),
    ("lab-thr", 598, 286, "start", "", "threshold"),
    ("lab-strip", 662, 244, "start", "st-lab--green", "green light, 520 nm"),
    ("lab-cells", 874, 372, "start", "", '<tspan font-style="italic">B. subtilis</tspan>'),
    ("lab-prot", 874, 398, "start", "st-lab--prot", "plant protectants"),
    ("lab-photo", 900, 526, "middle", "", "photometer"),
    ("lab-pump", 983, 180, "middle", "", "pump"),
    ("lab-stay", 983, 262, "middle", "", "the cells stay in the loop"),
    ("lab-membrane", 1004, 338, "end", "", "hollow-fibre membrane"),
    ("lab-pores", 1004, 362, "end", "", "0.2 µm pores"),
    ("lab-perm", 1128, 500, "start", "st-lab--prot", "permeate"),
    ("lab-crop", 262, 606, "start", "", "to the crop"),
    ("lab-off", 662, 244, "start", "st-lab--red", "red light, 660 nm: off"),
]
for k, x, y, anc, cls, text in LABELS:
    out.append('<g data-k="%s" data-label transform="translate(%d %d)"><text class="st-lab%s" text-anchor="%s">%s</text></g>'
               % (k, x, y, (" " + cls) if cls else "", anc, text))

# ================================================================ THE CARD --
# 18 Oct (Jacquelyn): the card is a clean white sheet with a hairline, set in
# CSS (home-story.css); the painted sheet and the picture's brush-edged clip
# that this script used to write are gone.

DEFS = ('<defs>' + '<filter id="rw-glow" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="7" /></filter>'
        '<filter id="rw-glow-s" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="3" /></filter>'
        '<filter id="rw-glow-l" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22" /></filter></defs>')

svg_inner = DEFS + "\n" + "\n".join(out)
print("svg inner: %.1f kB, %d elements" % (len(svg_inner) / 1024, len(out)))

# ---------------------------------------------------------------- splice --
html_path = ROOT / "index.html"
html = html_path.read_text()
m = re.search(r'(<svg class="st-svg" data-story-svg[^>]*>)(.*?)(</svg>)', html, re.S)
if not m:
    sys.exit("the story SVG was not found in index.html")
html = html[:m.start(2)] + "\n" + svg_inner + "\n              " + html[m.end(2):]
html_path.write_text(html)
print("wrote", html_path.relative_to(ROOT))
if "--svg" in sys.argv:
    p = Path(sys.argv[sys.argv.index("--svg") + 1])
    p.write_text('<svg xmlns="http://www.w3.org/2000/svg" class="st-svg" viewBox="0 0 1200 680">' + svg_inner + "</svg>")
    print("wrote", p)
