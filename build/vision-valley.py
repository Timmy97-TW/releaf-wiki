#!/usr/bin/env python3
"""Draws the valley for the vision section ("Every farmer a biomanufacturer.")
at first light.

Generated rather than hand-drawn because it has to hold a few hundred small
farms in correct perspective, and every farm needs the same parts in the same
order so home-vision.js can light them one by one. Same seed, same drawing,
every time. Run it after any change here; it rewrites the SVG (the finished
frame) and the JSON (the same drawing as layers):

    in the prototype folder:   valley.svg, valley.json (next to this file)
    as build/vision-valley.py: build/vision/valley.svg and build/vision/valley.json

Since 29 Sep 2026 the homepage does not load either file. The section is
built from picture layers (assets/img/home/vision/, see the README there),
so the design team's hand-drawn landscape can replace them. Until it does,
the layers are painted from this drawing by build/vision/render.html and
packed by build/vision-layers.py.

The picture is 1600 wide. The valley itself fills y 0..1000; the sky goes on
up to y -800 so that a tall screen (a phone) can end further out, with the
extra height given to the sky rather than cropped off the valley's sides.

GEOMETRY. A flat valley floor seen from a low camera. Ground point (X, Z), with
Z the distance from the camera, projects to
    x = VPX + F * X / Z,    y = HY + F / Z.
Fields sit on a rectangular ground grid turned against the camera, so their
edges run to two vanishing points (rows: Z - M X = c, columns: X + M Z = d),
which is what stops it looking like a chart. Rows get deeper and fields get
wider with distance so the far valley does not turn into thousands of slivers.

LIGHT. It starts in the hour before sunrise and ends at first light. At night
the sky is ink. As the farms light, first light comes up behind them: a deep
blue sky, warm along the horizon and strongest on the right, where the sun is
about to rise (the words sit on the left, where the sky stays deep enough to
read them on); lit cloud, paler far ranges, warm haze over the far fields.
Standing water (paddies, the river) mirrors the sky, so the far paddies and
the river turn gold. The only saturated colour in the picture is --sig-green
(#35e08a), and it only ever means "this farm's reactor is on". Warm window
light is --dawn (#f6cf94).

FARMS. Every kind of smallholding the valley holds: row crops, paddies, net
houses, banana groves, orchards, farmsteads with betel palms, terraces on the
hills. What a farm grows never changes what lights: its own reactor.

LIGHTING SEQUENCE. Everything that changes when a farm lights belongs to that
farm (its header line, its reactor's vessel, its glow). The resting state
written here is ALL LIT at full dawn: the finished frame. The script darkens
the farms it has not reached yet, and holds the dawn back, only once it runs.
"""
import json
import math
import random
from pathlib import Path

R = random.Random(20260926)
HY = 404.0            # horizon (40% down: the line and its sentence need the sky)
VPX = 800.0
F = 700.0
M = 0.22              # slope of the field rows against the camera
K = 1 + M * M


def gnd(c, d):
    """ground point where row line c meets column line d"""
    return (d - M * c) / K, (c + M * d) / K


def proj(X, Z):
    return VPX + F * X / Z, HY + F / Z


def unproj_z(y):
    return F / max(0.01, y - HY)


def f1(v):
    s = f"{v:.1f}"
    s = s[:-2] if s.endswith(".0") else s
    return "0" if s == "-0" else s


def pts(ps):
    return " ".join(f"{f1(x)},{f1(y)}" for x, y in ps)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp2(p, q, t):
    return (lerp(p[0], q[0], t), lerp(p[1], q[1], t))


def clamp01(v):
    return 0.0 if v < 0 else 1.0 if v > 1 else v


# ------------------------------------------------------------------ colour --
def hexrgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgbhex(c, q=1):
    return "#" + "".join(f"{max(0, min(255, int(round(v / q) * q))):02x}" for v in c)


def mix(a, b, t):
    return [lerp(a[i], b[i], t) for i in range(3)]


def piecewise(stops, y):
    """stops: [(y, [r,g,b], a)] sorted by y -> (rgb, a) at y"""
    if y <= stops[0][0]:
        return stops[0][1], stops[0][2]
    for (ya, ca, aa), (yb, cb, ab) in zip(stops, stops[1:]):
        if y <= yb:
            t = (y - ya) / (yb - ya)
            return mix(ca, cb, t), lerp(aa, ab, t)
    return stops[-1][1], stops[-1][2]


INK = hexrgb("#070b09")
DAWN = hexrgb("#f6cf94")                 # --dawn
SLATE = hexrgb("#3f5468")                # --slate-700

# the sky before any light: ink, a little bluer towards the ground
NIGHT = [(-900, hexrgb("#040708"), 1), (0, hexrgb("#060a0b"), 1), (150, hexrgb("#091114"), 1),
         (270, hexrgb("#0f191d"), 1), (350, hexrgb("#172227"), 1), (HY + 2, hexrgb("#1d282b"), 1)]
# first light, laid over it: a deep blue sky that stays deep where the words
# sit (up to about y 330 it is never lighter than #5a5a68, so --leaf-200 text
# keeps better than 4.5:1 on it), mauve and then warm only near the horizon
DAWNSKY = [(-900, hexrgb("#0d1826"), .9), (-300, hexrgb("#122134"), .9), (0, hexrgb("#1a2b3f"), .9),
           (150, hexrgb("#24374b"), .9), (240, hexrgb("#314257"), .92), (300, hexrgb("#3e4a5e"), .93),
           (330, hexrgb("#5a5a68"), .94), (352, hexrgb("#8f7672"), .95), (374, hexrgb("#cf9c76"), .96),
           (392, hexrgb("#efbf8a"), .98), (HY + 2, DAWN, 1)]
# and where the sun will come up: behind the right-hand mountains, away from the words
SUN = dict(cx=1270.0, cy=HY - 24, rx=760.0, ry=400.0, a=.95)
SUN_STOPS = [(0, 1.0), (.18, .7), (.4, .36), (.66, .11), (1, 0)]


HAZE_C = hexrgb("#343e44")               # the air between here and the far valley


def haze_t(Z):
    return 0.78 * clamp01((Z - 4.5) / 34.0) ** 0.85


def hazed(c, Z, q=3):
    return rgbhex(mix(hexrgb(c) if isinstance(c, str) else c, HAZE_C, haze_t(Z)), q)


# ------------------------------------------------------------------ river ---
def river_x(Z):
    return 0.25 + 0.06 * Z + 0.28 * math.sin(1.25 * Z + 0.3) + 0.5 * math.sin(0.3 * Z + 1.0)


def river_hw(Z):
    return 0.075 + 0.005 * Z


def in_river(X, Z, pad=0.0):
    return abs(X - river_x(Z)) < river_hw(Z) * 1.45 + pad


# ------------------------------------------------------------------ rows ----
rows = [0.62]
while rows[-1] < 60:
    rows.append(rows[-1] * (1 + R.uniform(0.2, 0.3)))


def nearest_row(c):
    return min(rows, key=lambda r: abs(r - c))


def row_line_pts(c, X0, X1, n=24):
    return [proj(lerp(X0, X1, i / n), c + M * lerp(X0, X1, i / n)) for i in range(n + 1)]


# ------------------------------------------------------------------ hills ---
# The two hills either side of the valley. Screen-space silhouettes whose lower
# edge runs exactly along one field row line, so the fields in front of them
# never overlap them and the ones behind them are simply covered.
C_HILL_L = nearest_row(9.0)
C_HILL_R = nearest_row(12.0)
LB = sorted(row_line_pts(C_HILL_L, -3.9, -12.0))
RB = sorted(row_line_pts(C_HILL_R, 4.6, 24.0))


def base_y_at(base, x):
    if x <= base[0][0]:
        return base[0][1]
    if x >= base[-1][0]:
        return base[-1][1]
    for i in range(len(base) - 1):
        if base[i][0] <= x <= base[i + 1][0]:
            t = (x - base[i][0]) / (base[i + 1][0] - base[i][0] + 1e-9)
            return lerp(base[i][1], base[i + 1][1], t)
    return base[-1][1]


def canopy(x):
    """the tree line along a hilltop: small round bumps"""
    return 3.2 * abs(math.sin(x / 6.1)) + 2.2 * abs(math.sin(x / 3.7 + 1.1)) + 1.4 * abs(math.sin(x / 2.3 + .4))


def left_top(x):
    # lower than the right-hand hill: the words sit over this side of the sky
    t = max(0.0, x) / 520.0
    return HY - 96 + 156 * (t ** 1.55) + 8 * math.sin(x / 47.0) + 5 * math.sin(x / 19.0 + 1.3) - canopy(x)


def right_top(x):
    t = max(0.0, 1600 - x) / 560.0
    return HY - 170 + 232 * (t ** 1.45) + 11 * math.sin(x / 41.0 + 2.1) + 6 * math.sin(x / 17.0) - canopy(x + 300)


def point_in_poly(x, y, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


N_S = 180
L_xs = [lerp(-40, LB[-1][0], i / N_S) for i in range(N_S + 1)]
R_xs = [lerp(RB[0][0], 1640, i / N_S) for i in range(N_S + 1)]
L_end = LB[-1][0]
R_end = RB[0][0]
L_top = [(x, lerp(min(left_top(x), base_y_at(LB, x)), base_y_at(LB, x), ease((x - (L_end - 190)) / 190)))
         for x in L_xs]
R_top = [(x, lerp(min(right_top(x), base_y_at(RB, x)), base_y_at(RB, x), ease(((R_end + 190) - x) / 190)))
         for x in R_xs]
L_bot = [(x, base_y_at(LB, x)) for x in L_xs]
R_bot = [(x, base_y_at(RB, x)) for x in R_xs]
L_poly = L_top + list(reversed(L_bot))
R_poly = R_top + list(reversed(R_bot))


def hidden_by_hills(x, y):
    return point_in_poly(x, y, L_poly) or point_in_poly(x, y, R_poly)


def terraces(top, bot, n):
    out = []
    for k in range(n + 1):
        t = (k / n) ** 0.85
        out.append([(x, lerp(yb, yt, t)) for (x, yt), (_, yb) in zip(top, bot)])
    return out


L_ter = terraces(L_top, L_bot, 10)
R_ter = terraces(R_top, R_bot, 9)

# ------------------------------------------------------------------ ridges --
# Three ranges behind the valley, each paler than the one in front of it: the
# far one is jagged (the mountains), the near two roll.
R2 = random.Random(7)
PEAKS = []
x = -120
while x < 1720:
    PEAKS.append((x, R2.uniform(24, 74), R2.uniform(90, 200)))
    x += R2.uniform(110, 210)


def ridge_mtn(x):
    # the range rises from left to right: low under the words, high where the
    # sun comes up
    lift = 0.5 + 0.5 * ease((x - 420) / 760)
    h = max(max(0.0, 1 - abs(x - px) / pw) ** 1.25 * ph for px, ph, pw in PEAKS)
    return HY - 22 - 36 * lift - h * lift - 2.4 * math.sin(x / 7.3) - 1.6 * math.sin(x / 3.1 + .8)


def ridge_roll(x, y0, seeds):
    return y0 + sum(a * math.sin(x / f + ph) for a, f, ph in seeds)


def ridge_poly(fn, step=6):
    out = [(-420, HY + 60)]
    for i in range(0, 2440 // step + 1):
        xx = -420 + i * step
        out.append((xx, fn(xx)))
    out.append((2020, HY + 60))
    return out


RIDGE0 = ridge_poly(ridge_mtn, 4)
RIDGE1 = ridge_poly(lambda x: ridge_roll(x, HY - 36, [(12, 170, 2.2), (7, 71, 0.4), (3, 29, 2.6)]) - canopy(x) * .5)
RIDGE2 = ridge_poly(lambda x: ridge_roll(x, HY - 15, [(7, 140, 0.9), (4, 53, 2.9), (2, 21, 1.4)]) - canopy(x + 90) * .6)

# ------------------------------------------------------------------ fields --
CROP = ["#14271d", "#162c20", "#11221a", "#193022", "#13291d", "#15291c"]
FALLOW = ["#1e1f17", "#201f17"]
STEAD = "#121c15"

# The farm the section starts on. It is placed, not found: its near-left corner
# sits a little left of centre and low (a phone only sees the middle third of
# the drawing, and it has to see this one), and it is a wide crop field.
TARGET = (742, 736)
_Zt = F / (TARGET[1] - HY)
_Xt = (TARGET[0] - VPX) * _Zt / F
C_T, D_T = _Zt - M * _Xt, _Xt + M * _Zt
HERO_ROW = min(range(len(rows) - 1), key=lambda i: abs(rows[i] - C_T))
HERO_W = 1.05

plots = []
hero = None
for ri in range(len(rows) - 1):
    ca, cb = rows[ri], rows[ri + 1]
    Zm = (ca + cb) / 2
    Zmax = cb + M * 30 + 2
    d = -1.35 * Zmax
    dmax = 1.35 * Zmax + M * Zmax
    base_w = 0.9 * max(1.0, (Zm / 5.5) ** 0.62)
    placed = False
    while d < dmax:
        w = base_w * R.uniform(0.55, 1.65)
        d2 = d + w
        is_hero = False
        if ri == HERO_ROW and not placed:
            if d2 > D_T - 0.25:
                d2 = D_T
                if d >= D_T:
                    d = D_T
                if d2 - d < 0.05:
                    d, d2 = D_T, D_T + HERO_W
                    is_hero = True
                    placed = True
        g = [gnd(ca, d), gnd(ca, d2), gnd(cb, d2), gnd(cb, d)]
        d = d2
        if min(Z for _, Z in g) < 0.34:
            continue
        sc = [proj(X, Z) for X, Z in g]
        xs = [q[0] for q in sc]
        ys = [q[1] for q in sc]
        if max(xs) < -30 or min(xs) > 1630 or min(ys) > 1030:
            continue
        if all(hidden_by_hills(x, y) for x, y in sc):
            continue
        r = R.random()
        kind = "crop" if (r < 0.66 or is_hero) else ("paddy" if r < 0.86 else "fallow")
        plots.append(dict(ri=ri, g=g, s=sc, kind=kind, along=R.random() < 0.7 or is_hero,
                          Zm=sum(Z for _, Z in g) / 4, hero=is_hero))
        if is_hero:
            hero = plots[-1]

assert hero is not None, "hero field was not placed"

# the plot beside the first farm is its farmstead: a house and its trees
_row = [p for p in plots if p["ri"] == HERO_ROW]
_hi = _row.index(hero)
home = _row[_hi - 1]
home["kind"] = "stead"
# and a few more farmsteads across the valley, never in the far distance where
# they would only be noise
for p in plots:
    if p is hero or p is home or p["kind"] == "stead":
        continue
    if 1.6 < p["Zm"] < 26 and R.random() < 0.18:
        # but not within sight of the first farm: the close-up holds one house
        cx = sum(x for x, _ in p["s"]) / 4
        cy = sum(y for _, y in p["s"]) / 4
        if math.hypot(cx - hero["s"][0][0], cy - hero["s"][0][1]) > 330:
            p["kind"] = "stead"

# and the other kinds of smallholding: net houses, banana groves, orchards.
# Their own random stream, so which plots carry a reactor does not move.
RK = random.Random(4242)


def plot_centre(p):
    return sum(x for x, _ in p["s"]) / 4, sum(y for _, y in p["s"]) / 4


for p in plots:
    if p is hero or p is home or p["kind"] != "crop":
        continue
    if not (2.2 < p["Zm"] < 24):
        continue
    cx, cy = plot_centre(p)
    if math.hypot(cx - hero["s"][0][0], cy - hero["s"][0][1]) < 360:
        continue
    Xc = sum(X for X, _ in p["g"]) / 4
    if in_river(Xc, p["Zm"], 0.45):
        continue
    r = RK.random()
    if r < 0.13:
        p["kind"] = "net"
    elif r < 0.22:
        p["kind"] = "banana"
    elif r < 0.3:
        p["kind"] = "orchard"

# ------------------------------------------------------------------ farms ---
farms = []


def add_farm(x, y, s, hero_=False, plot=None, hdr=None, Z=99.0):
    farms.append(dict(x=x, y=y, s=s, hero=hero_, plot=plot, hdr=hdr, Z=Z))
    return len(farms) - 1


for p in plots:
    if p["kind"] in ("fallow", "stead"):
        continue
    is_hero = p is hero
    if not is_hero and R.random() > (0.84 if p["Zm"] < 6 else 0.7):
        continue
    (Xa, Za), (Xb, Zb) = p["g"][0], p["g"][1]
    ux, uz = (Xb - Xa), (Zb - Za)
    L = math.hypot(ux, uz)
    ux, uz = ux / L, uz / L
    # just off the field, on the bund at its near-left corner: "at the end of
    # the field", facing the camera
    off = 0.06
    Xr, Zr = Xa - ux * off, Za - uz * off - 0.012 * Za
    if in_river(Xr, Zr, 0.04):
        continue
    x, y = proj(Xr, Zr)
    if x < -10 or x > 1610 or y > 1010:
        continue
    if hidden_by_hills(x, y - 1):
        continue
    # keep the first field's corners clear, so it never looks as if one
    # field had two reactors
    if not is_hero and any(math.hypot(x - cx, y - cy) < 60 for cx, cy in hero["s"]):
        continue
    # and the farmstead beside it, so the close-up holds one farm and one reactor
    if not is_hero and any(math.hypot(x - cx, y - cy) < 110 for cx, cy in home["s"]):
        continue
    s = 0.062 * F / Zr
    a = p["s"][0]
    if is_hero:
        b = proj(*lerp2(p["g"][0], p["g"][3], 0.96))
    else:
        b = proj(*lerp2(p["g"][0], p["g"][1], R.uniform(0.28, 0.5)))
    hdr = None if p["Zm"] > 7 else f"M{f1(x)} {f1(y - s * 0.12)}L{f1(a[0])} {f1(a[1])}L{f1(b[0])} {f1(b[1])}"
    p["farm"] = add_farm(x, y, s, is_hero, p, hdr, Z=Zr)

# farms on the terraces: on terrace edges, spaced out, smaller higher up
for ter in (L_ter, R_ter):
    n = len(ter) - 1
    for k in range(1, n):
        line = [q for q in ter[k] if -5 < q[0] < 1605]
        used = []
        want = 2 + (k % 3)
        tries = 0
        while len(used) < want and tries < 60 and len(line) > 5:
            tries += 1
            q = R.choice(line[2:-2])
            j = ter[k].index(q)
            if abs(ter[k - 1][j][1] - q[1]) < 3.2:
                continue
            if any(abs(q[0] - u) < 46 for u in used):
                continue
            used.append(q[0])
            s = R.uniform(2.6, 4.4) * (1.0 - 0.45 * k / n)
            add_farm(q[0], q[1] - 0.3, s, Z=40)

# ------------------------------------------------------------------ props ---
# Everything that stands up: reactors, houses, trees, betel palms. Drawn back
# to front in one list so a near tree covers a far house and never the reverse.
props = []           # dict(g=glyph, x, y, s, flip, col) or dict(g="r", farm=i)


def rx_boxes():
    return [(f["x"] - f["s"] * .45, f["y"] - f["s"] * 1.05, f["x"] + f["s"] * .5, f["y"]) for f in farms]


RX_BOX = rx_boxes()


def blocks_reactor(x, y, w, h):
    """would a prop with its base at (x, y) stand in front of a reactor?"""
    x0, y0, x1, y1 = x - w / 2, y - h, x + w / 2, y
    for (a0, b0, a1, b1), f in zip(RX_BOX, farms):
        if y >= f["y"] - 1 and x0 < a1 + 2 and x1 > a0 - 2 and y0 < b1 and y1 > b0 - 4:
            return True
    return False


def add_prop(glyph, X, Z, scale, col, jitter=True, rng=None):
    x, y = proj(X, Z)
    if x < -60 or x > 1660 or y > 1060:
        return False
    if hidden_by_hills(x, y - 1) or in_river(X, Z, 0.03):
        return False
    s = scale * F / Z
    w = s * (1.25 if glyph[0] in "tb" else 1.5 if glyph == "h" else .7)
    if blocks_reactor(x, y, w, s):
        return False
    # nothing stands on or in front of the first field: the close-up is its rows
    hx = [q[0] for q in hero["s"]]
    if min(hx) - w / 2 < x < max(hx) + w / 2 and y > min(q[1] for q in hero["s"]) - 2 and \
            (point_in_poly(x, y, hero["s"]) or point_in_poly(x, y - s * .5, hero["s"])):
        return False
    props.append(dict(g=glyph, x=x, y=y, s=s, flip=(rng or R).random() < .5, col=hazed(col, Z), Z=Z))
    return True


TREE_C = "#0a1411"
PALM_C = "#0b1512"
BANANA_C = "#0c1713"
HOUSE_C = "#1d2925"
N_TREES = 6


def grove(p):
    """a banana grove or an orchard: plants in rows across the plot"""
    g = p["g"]
    wpx = max(x for x, _ in p["s"]) - min(x for x, _ in p["s"])
    hpx = max(y for _, y in p["s"]) - min(y for _, y in p["s"])
    if p["kind"] == "banana":
        nu, nv, sc = int(max(2, min(9, wpx / 20))), int(max(1, min(4, hpx / 12))), (.15, .19)
    else:
        nu, nv, sc = int(max(2, min(11, wpx / 16))), int(max(1, min(4, hpx / 10))), (.085, .11)
    for j in range(nv):
        for i in range(nu):
            u = (i + .5 + RK.uniform(-.12, .12)) / nu
            v = (j + .55) / nv
            X, Z = lerp2(lerp2(g[0], g[1], u), lerp2(g[3], g[2], u), v)
            if p["kind"] == "banana":
                add_prop("b", X, Z, RK.uniform(*sc), BANANA_C, rng=RK)
            else:
                add_prop(f"t{RK.randrange(N_TREES)}", X, Z, RK.uniform(*sc), TREE_C, rng=RK)

for p in plots:
    g = p["g"]
    if p["kind"] == "stead":
        # the house somewhere in the middle, set back; trees round it
        u, v = (0.56, 0.52) if p is home else (R.uniform(.3, .7), R.uniform(.45, .7))
        X, Z = lerp2(lerp2(g[0], g[1], u), lerp2(g[3], g[2], u), v)
        add_prop("h", X, Z, 0.12, HOUSE_C)
        if p is home:
            props[-1]["flip"] = True        # its window looks towards the field
        for _ in range(R.randint(3, 6)):
            uu, vv = R.uniform(0, 1), R.uniform(.66, 1.0)
            X2, Z2 = lerp2(lerp2(g[0], g[1], uu), lerp2(g[3], g[2], uu), vv)
            add_prop(f"t{R.randrange(N_TREES)}", X2, Z2, R.uniform(.13, .19), TREE_C)
        if R.random() < .7:
            for _ in range(R.randint(1, 3)):
                uu, vv = R.uniform(0, 1), R.uniform(.2, .6)
                X2, Z2 = lerp2(lerp2(g[0], g[1], uu), lerp2(g[3], g[2], uu), vv)
                add_prop("p", X2, Z2, R.uniform(.2, .26), PALM_C)
    elif p is not hero and p["Zm"] < 30:
        r = R.random()
        if p["kind"] in ("banana", "orchard"):
            grove(p)
        elif p["kind"] == "net":
            pass
        elif r < .16:
            # a row of betel palms along the far bund
            n = R.randint(3, 7)
            for k in range(n):
                X, Z = lerp2(g[3], g[2], (k + R.uniform(.2, .8)) / n)
                add_prop("p", X, Z, R.uniform(.19, .25), PALM_C)
        elif r < .34:
            # a hedge of trees along the far bund
            n = R.randint(2, 5)
            for k in range(n):
                X, Z = lerp2(g[3], g[2], (k + R.uniform(.1, .9)) / n)
                add_prop(f"t{R.randrange(N_TREES)}", X, Z, R.uniform(.11, .16), TREE_C)

for i, f in enumerate(farms):
    props.append(dict(g="r", x=f["x"], y=f["y"], s=f["s"], farm=i))

props.sort(key=lambda q: q["y"])

# ------------------------------------------------------------------ glyphs --
def rr(x, y, w, h, r):
    return (f"M{f1(x + r)} {f1(y)}h{f1(w - 2 * r)}a{f1(r)} {f1(r)} 0 0 1 {f1(r)} {f1(r)}v{f1(h - 2 * r)}"
            f"a{f1(r)} {f1(r)} 0 0 1 {f1(-r)} {f1(r)}h{f1(-(w - 2 * r))}a{f1(r)} {f1(r)} 0 0 1 {f1(-r)} {f1(-r)}"
            f"v{f1(-(h - 2 * r))}a{f1(r)} {f1(r)} 0 0 1 {f1(r)} {f1(-r)}z")


def circ(cx, cy, r):
    return f"M{f1(cx - r)} {f1(cy)}a{f1(r)} {f1(r)} 0 1 0 {f1(2 * r)} 0a{f1(r)} {f1(r)} 0 1 0 {f1(-2 * r)} 0z"


def blob(parts):
    """a canopy: overlapping circles, as one path (nonzero fill joins them)"""
    return "".join(circ(cx, cy, r) for cx, cy, r in parts)


# Glyphs are drawn standing on their base point, in units of their own height
# (100). "$" means the prop's own colour (its depth haze), "v" the part that
# lights (a reactor's vessel), "w" a window.
GLYPHS = {
    # the reactor: a bottle of culture lit from inside, the hollow-fibre
    # column beside it, a pump, on a plinth
    "r2": [
        dict(d=rr(-38, -9, 78, 9, 2), fill="rxBase", stroke="rxEdge"),
        dict(d=rr(-32, -74, 32, 65, 13), v=1),
        dict(d=rr(-22, -86, 12, 13, 3), fill="neck", stroke="rxEdge"),
        dict(d=rr(9, -82, 11, 73, 5.5), fill="col"),
        dict(d="M-16 -86c0-13 30-14 30 4", stroke="tube"),
        dict(d=circ(31, -20, 7), fill="rxBase", stroke="tube"),
        dict(d=rr(-27, -66, 5, 44, 2.5), fill="shine"),
    ],
    "r1": [
        dict(d=rr(-38, -10, 78, 10, 2), fill="rxBase", stroke="rxEdge"),
        dict(d=rr(-32, -78, 36, 68, 15), v=1),
        dict(d=rr(10, -80, 14, 70, 7), fill="col"),
    ],
    # a farmhouse: low walls, a hipped roof caught by the first light along
    # its ridge, one lit window, a door
    "h": [
        dict(d="M-76 0V-52H78V0Z", fill="$"),
        dict(d="M-88 -50L-44 -94H46L90 -50Z", fill="roof"),
        dict(d="M-88 -50L-44 -94H46L90 -50", stroke="rim"),
        dict(d="M-76 -50H78V-44H-76Z", fill="eave"),
        dict(d=rr(-50, -36, 11, 13, 1) + rr(-37, -36, 11, 13, 1), w=1),
        dict(d=rr(16, -34, 15, 34, 1), fill="door"),
    ],
    # a banana plant: a short pseudo-stem under big paddle leaves
    "b": [
        dict(d="M-4 0L-3 -48H3L4 0Z"
               "M0 -50C-8 -80 -30 -98 -46 -96C-34 -86 -18 -70 -2 -48Z"
               "M0 -50C8 -80 30 -98 46 -96C34 -86 18 -70 2 -48Z"
               "M0 -52C-22 -66 -48 -62 -60 -44C-44 -54 -24 -56 -1 -48Z"
               "M0 -52C22 -66 48 -62 60 -44C44 -54 24 -56 1 -48Z"
               "M0 -52C-4 -74 -2 -92 6 -100C6 -86 4 -70 2 -50Z"
               "M0 -46C-16 -48 -34 -38 -42 -22C-30 -34 -16 -40 0 -42Z", fill="$"),
    ],
    # a betel palm: a thin trunk with a small crown
    "p": [
        dict(d="M-2.8 0L-1.5 -86H1.5L2.8 0Z" + circ(0, -88, 3.4), fill="$"),
        dict(d="M0 -90C-9 -96 -18 -92 -24 -82C-15 -90 -7 -90 0 -88Z"
               "M0 -90C9 -96 18 -92 24 -82C15 -90 7 -90 0 -88Z"
               "M0 -91C-5 -100 -13 -103 -19 -100C-11 -99 -5 -96 0 -89Z"
               "M0 -91C5 -100 13 -103 19 -100C11 -99 5 -96 0 -89Z"
               "M0 -92C-2 -99 0 -106 3 -108C2 -101 2 -96 0 -89Z"
               "M0 -89C-6 -86 -11 -79 -12 -72C-8 -80 -4 -84 0 -87Z"
               "M0 -89C6 -86 11 -79 12 -72C8 -80 4 -84 0 -87Z", fill="$"),
    ],
}
TR = random.Random(11)
for i in range(N_TREES):
    parts = [(0, -52, 30)]
    for _ in range(TR.randint(4, 7)):
        a = TR.uniform(math.pi * .9, math.pi * 2.1)
        rad = TR.uniform(18, 30)
        parts.append((math.cos(a) * TR.uniform(18, 34), -58 + math.sin(a) * TR.uniform(14, 30), rad))
    top = min(cy - r for cx, cy, r in parts)
    # normalise so the crown's top sits at -100
    k = 88 / (0 - top)
    parts = [(cx * k, cy * k, r * k) for cx, cy, r in parts]
    trunk = f"M-3 0L-2 -{f1(30 * k)}H2L3 0Z"
    GLYPHS[f"t{i}"] = [dict(d=trunk + blob(parts), fill="$")]

# ------------------------------------------------------------------ layers --
C = {
    "floor": "#0d1612",
    "edge": "rgba(207,228,216,.075)", "edgeFar": "rgba(207,228,216,.04)",
    "rows": "rgba(111,160,125,.14)", "rowsFar": "rgba(111,160,125,.07)", "rowsHero": "rgba(111,160,125,.34)",
    "rowsPaddy": "rgba(111,160,125,.16)",
    "hdr": "rgba(53,224,138,.62)", "hdrHero": "rgba(53,224,138,.85)", "hdrOff": "rgba(207,228,216,.1)",
    "plants": "#4f9c6f", "dose": "#35e08a",
    "bank": "#0c1512", "riverEdge": "rgba(159,179,196,.16)",
    "hillL": "#0b1411", "hillLalt": "#0d1813", "hillR": "#0c1512", "hillRalt": "#0e1914",
    "terr": "rgba(111,160,125,.075)",
    "ridge0": "#2a363b", "ridge1": "#1c272a", "ridge2": "#141e1c",
    "rxBase": "#16362a", "rxEdge": "rgba(207,228,216,.35)", "vessel": "#35e08a", "vesselOff": "#1d3d2f",
    "neck": "#1d4433", "col": "rgba(227,240,232,.82)", "tube": "rgba(227,240,232,.55)", "shine": "rgba(255,255,255,.35)",
    "roof": "#0b1210", "eave": "rgba(0,0,0,.3)", "rim": "rgba(246,207,148,.34)",
    "door": "rgba(0,0,0,.4)", "window": "rgba(246,207,148,.86)",
    # net houses: pale mesh over the rows, never green
    "net": "rgba(214,226,234,.12)", "netWall": "rgba(214,226,234,.07)", "netLine": "rgba(222,232,238,.24)",
    # lit cloud (drawn only as the dawn comes up)
    "cloudWarm": "rgba(242,196,150,.42)", "cloudCool": "rgba(150,150,170,.2)", "cloudHigh": "rgba(238,176,150,.36)",
}
# The same keys at first light: the canvas mixes night -> first light by how far
# the dawn has come; the SVG (the finished frame) uses these directly.
CD = {
    "ridge0": "#3c4452", "ridge1": "#29313a", "ridge2": "#1c2424",
    "floor": "#111c16",
    "hillL": "#0f1a15", "hillLalt": "#111d17", "hillR": "#101b16", "hillRalt": "#131f19",
}


def lin_stops(stops, y0, y1):
    """[(y, rgb, a)] in drawing units -> [[offset, hex, a]] along y0..y1"""
    return [[round((y - y0) / (y1 - y0), 4), rgbhex(c), round(a, 3)] for y, c, a in stops]


SKY = dict(x=-420, y=-900, w=2440, h=HY + 62 + 900)
WATER_C, WATER_K = hexrgb("#0a1316"), 0.36
# the mirrored gradients run from here (sky offset 0) to here (sky offset 1)
WATER = dict(y0=2 * HY - SKY["y"], y1=2 * HY - (HY + 2), cy=2 * HY - SUN["cy"])
STAR_FADE = .62      # how much of each star the full dawn takes away
G = {
    "sky": lin_stops(NIGHT, SKY["y"], HY + 2),
    "dawn": lin_stops(DAWNSKY, SKY["y"], HY + 2),
    "sun": [[o, "#f6cf94", round(SUN["a"] * v, 3)] for o, v in SUN_STOPS],
    # standing water mirrors the sky: the same stops, flipped about the horizon
    # (see WATER below), darkened by the water itself
    "wnight": [[round((y - SKY["y"]) / (HY + 2 - SKY["y"]), 4), rgbhex(mix(c, WATER_C, WATER_K)), 1] for y, c, a in NIGHT],
    "wdawn": [[round((y - SKY["y"]) / (HY + 2 - SKY["y"]), 4), rgbhex(c), round(a * (1 - WATER_K), 3)] for y, c, a in DAWNSKY],
    "wsun": [[o, "#f6cf94", round(SUN["a"] * v * (1 - WATER_K), 3)] for o, v in SUN_STOPS],
    "glow": [[0, "#35e08a", .9], [.2, "#35e08a", .38], [.55, "#35e08a", .09], [1, "#35e08a", 0]],
    # low mist lying in the valley and between the ranges
    "mist": [[0, "#9fb3c4", 0], [.5, "#9fb3c4", .1], [1, "#9fb3c4", 0]],
    "fog": [[0, "#9fb3c4", 0], [.6, "#b8b3a4", .13], [1, "#9fb3c4", 0]],
    # first light only: warm air lying over the far fields, and on the fog
    "farlight": [[0, "#e6bb8c", .34], [.3, "#d2a882", .16], [.65, "#b79a86", .05], [1, "#b79a86", 0]],
    "foglight": [[0, "#e8c39a", 0], [.6, "#e8c39a", .2], [1, "#e8c39a", 0]],
}
FARLIGHT = dict(x=-420, y=HY - 2, w=2440, h=150)
MIST = dict(x=-420, y=HY - 16, w=2440, h=44)
FOG1 = dict(x=-420, y=HY - 60, w=2440, h=40)
FOG2 = dict(x=-420, y=HY - 34, w=2440, h=30)

layers = []


def Lyr(kind, **kw):
    kw["k"] = kind
    layers.append(kw)


Lyr("sky")
# the last stars, in three brightnesses; first light washes most of them out
SR = random.Random(3)
stars = {0: [], 1: [], 2: []}
for _ in range(150):
    sx, sy = SR.uniform(-420, 2020), -900 + 1170 * (SR.random() ** 0.8)
    if sy > 262:
        continue
    stars[SR.choice((0, 0, 0, 1, 1, 2))].append(circ(sx, sy, SR.uniform(.7, 1.25)))
for b_, lst in stars.items():
    Lyr("stars", d="".join(lst), a=(.22, .38, .6)[b_])
Lyr("dawn")          # first light over the night sky; the script holds it back
Lyr("sun")


def cloud(cx, cy, length, thick, rng):
    """a long thin streak of cloud: a few flat ellipses along one line"""
    out, n = [], rng.randint(3, 5)
    for i in range(n):
        t = (i + .5) / n - .5
        rx = length * rng.uniform(.22, .4)
        ry = thick * rng.uniform(.55, 1.0)
        x, y = cx + t * length * .8, cy + rng.uniform(-.6, .6) * thick
        out.append(f"M{f1(x - rx)} {f1(y)}a{f1(rx)} {f1(ry)} 0 1 0 {f1(2 * rx)} 0a{f1(rx)} {f1(ry)} 0 1 0 {f1(-2 * rx)} 0z")
    return "".join(out)


# Cloud only where no words sit: to the right of x 1020 in the upper sky
# (the line and its sentence live left of that on every screen), and low
# over the mountains everywhere.
CR = random.Random(5)
warm = [cloud(CR.uniform(1080, 1560), CR.uniform(150, 330), CR.uniform(160, 330), CR.uniform(5, 9), CR) for _ in range(6)]
warm += [cloud(CR.uniform(900, 1500), CR.uniform(338, 356), CR.uniform(120, 260), CR.uniform(3, 5), CR) for _ in range(3)]
cool = [cloud(CR.uniform(1100, 1620), CR.uniform(40, 150), CR.uniform(200, 380), CR.uniform(6, 11), CR) for _ in range(4)]
# High cloud, the first thing first light catches. It sits above the top of a
# wide screen's frame (y < 0), so only a tall screen sees it: on a phone it
# fills the sky between the words and the mountains.
high = [cloud(CR.uniform(470, 1150), CR.uniform(-95, -25), CR.uniform(180, 340), CR.uniform(5, 9), CR) for _ in range(4)]
Lyr("lightfill", d="".join(cool), fill="cloudCool")
Lyr("lightfill", d="".join(high), fill="cloudHigh")
Lyr("lightfill", d="".join(warm), fill="cloudWarm")
Lyr("fill", d=f"M{pts(RIDGE0)}Z", fill="ridge0")
Lyr("grad", g="fog", **FOG1)
Lyr("light", g="foglight", **FOG1)
Lyr("fill", d=f"M{pts(RIDGE1)}Z", fill="ridge1")
Lyr("grad", g="fog", **FOG2)
Lyr("light", g="foglight", **FOG2)
Lyr("fill", d=f"M{pts(RIDGE2)}Z", fill="ridge2")
Lyr("fill", d=f"M-420 {f1(HY)}H2020V1400H-420Z", fill="floor")

# fields: they tile and never overlap, so they are batched by colour
by_fill, water, edges_near, edges_far, rows_near, rows_far, rows_paddy = {}, [], [], [], [], [], []
for p in sorted(plots, key=lambda q: -q["Zm"]):
    s_, g = p["s"], p["g"]
    far = p["Zm"] > 14
    d = f"M{pts(s_)}Z"
    if p["kind"] == "paddy":
        cx = sum(x for x, _ in s_) / 4
        cy = sum(y for _, y in s_) / 4
        water.append(d)
    else:
        base = "#122b1f" if p["hero"] else STEAD if p["kind"] == "stead" else R.choice(FALLOW if p["kind"] == "fallow" else CROP)
        by_fill.setdefault(hazed(base, p["Zm"]), []).append(d)
    (edges_far if far else edges_near).append(d)
    hpx = max(y for _, y in s_) - min(y for _, y in s_)
    wpx = max(x for x, _ in s_) - min(x for x, _ in s_)
    segs = []
    if p["kind"] == "crop" and hpx > 3.4 and not p["hero"]:
        if p["along"]:
            n = int(max(2, min(14 if not far else 6, wpx / 16)))
            for k in range(1, n):
                t = k / n
                segs.append((proj(*lerp2(g[0], g[1], t)), proj(*lerp2(g[3], g[2], t))))
        else:
            n = int(max(1, min(9 if not far else 3, hpx / 8)))
            for k in range(1, n + 1):
                t = k / (n + 1)
                segs.append((proj(*lerp2(g[0], g[3], t)), proj(*lerp2(g[1], g[2], t))))
    elif p["kind"] == "paddy" and hpx > 4 and not far:
        # rice planted in rows, standing in the water
        n = int(max(2, min(12, wpx / 20)))
        pseg = []
        for k in range(1, n):
            t = k / n
            a_, b_ = proj(*lerp2(g[0], g[1], t)), proj(*lerp2(g[3], g[2], t))
            pseg.append(f"M{f1(a_[0])} {f1(a_[1])}L{f1(b_[0])} {f1(b_[1])}")
        rows_paddy.append("".join(pseg))
    dd = "".join(f"M{f1(a_[0])} {f1(a_[1])}L{f1(b_[0])} {f1(b_[1])}" for a_, b_ in segs)
    if dd:
        (rows_far if far else rows_near).append(dd)
for col in sorted(by_fill):
    Lyr("fill", d="".join(by_fill[col]), fill=col)
Lyr("water", d="".join(water), id="wp")
Lyr("stroke", d="".join(edges_near), stroke="edge", w=1)
Lyr("stroke", d="".join(edges_far), stroke="edgeFar", w=1)
Lyr("stroke", d="".join(rows_near), stroke="rows", w=1)
Lyr("stroke", d="".join(rows_far), stroke="rowsFar", w=1)
Lyr("stroke", d="".join(rows_paddy), stroke="rowsPaddy", w=1)

# net houses: a pale mesh roof raised over the plot, its front wall and the
# side wall that faces the middle of the valley, and the tunnels' ridges
NET_H = 0.2


def raised(X, Z, h):
    x, y = proj(X, Z)
    return x, y - F * h / Z


net_roof, net_wall, net_line = [], [], []
for p in sorted(plots, key=lambda q: -q["Zm"]):
    if p["kind"] != "net":
        continue
    g = p["g"]
    G_ = [proj(X, Z) for X, Z in g]
    R_ = [raised(X, Z, NET_H) for X, Z in g]
    net_roof.append(f"M{pts(R_)}Z")
    net_wall.append(f"M{pts([G_[0], G_[1], R_[1], R_[0]])}Z")
    a_, b_ = (0, 3) if sum(X for X, _ in g) > 0 else (1, 2)
    net_wall.append(f"M{pts([G_[a_], G_[b_], R_[b_], R_[a_]])}Z")
    n = int(max(2, min(12, abs(G_[1][0] - G_[0][0]) / 11)))
    for k in range(1, n):
        t = k / n
        f0 = raised(*lerp2(g[0], g[1], t), NET_H)
        b0 = raised(*lerp2(g[3], g[2], t), NET_H)
        gp = proj(*lerp2(g[0], g[1], t))
        net_line.append(f"M{f1(gp[0])} {f1(gp[1])}L{f1(f0[0])} {f1(f0[1])}L{f1(b0[0])} {f1(b0[1])}")
    net_line.append(f"M{pts([R_[3], R_[0], R_[1], R_[2]])}")
Lyr("fill", d="".join(net_wall), fill="netWall")
Lyr("fill", d="".join(net_roof), fill="net")
Lyr("stroke", d="".join(net_line), stroke="netLine", w=1)

# the first field: rows across it, seedlings along them, and the dose running
# out from the header up its left edge along every row
g = hero["g"]
n_rows = 9
row_d, plant_d, dose_d = [], [], []
for k in range(1, n_rows + 1):
    t = (k - 0.35) / n_rows
    a_g, b_g = lerp2(g[0], g[3], t), lerp2(g[1], g[2], t)
    pa, pb = proj(*a_g), proj(*b_g)
    row_d.append(f"M{f1(pa[0])} {f1(pa[1])}L{f1(pb[0])} {f1(pb[1])}")
    dose_d.append(f"M{f1(pa[0])} {f1(pa[1])}L{f1(pb[0])} {f1(pb[1])}")
    steps = 13
    for j in range(steps):
        u = (j + 0.6) / (steps + 0.2)
        X, Z = lerp2(a_g, b_g, u)
        x, y = proj(X, Z)
        h = 0.021 * F / Z
        if h < 1.0:
            continue
        plant_d.append(
            f"M{f1(x)} {f1(y)}v{f1(-h)}"
            f"M{f1(x)} {f1(y - h * .55)}c{f1(-h * .6)} 0 {f1(-h * .9)} {f1(-h * .35)} {f1(-h * .9)} {f1(-h * .8)}"
            f"c{f1(h * .6)} 0 {f1(h * .9)} {f1(h * .35)} {f1(h * .9)} {f1(h * .8)}"
            f"M{f1(x)} {f1(y - h * .72)}c0 {f1(-h * .45)} {f1(h * .35)} {f1(-h * .75)} {f1(h * .9)} {f1(-h * .75)}"
            f"c0 {f1(h * .45)} {f1(-h * .35)} {f1(h * .75)} {f1(-h * .9)} {f1(h * .75)}")
Lyr("stroke", d="".join(row_d), stroke="rowsHero", w=1)
Lyr("plants", d="".join(plant_d))
Lyr("dose", d="".join(dose_d))
Lyr("headers")

# the river: a bank, then water in short reaches, each mirroring its own patch of sky
Zs = [0.6 * (1.07 ** i) for i in range(80) if 0.6 * (1.07 ** i) < 75]
bank_l = [proj(river_x(Z) - river_hw(Z) * 1.28, Z) for Z in Zs]
bank_r = [proj(river_x(Z) + river_hw(Z) * 1.28, Z) for Z in Zs]
Lyr("fill", d=f"M{pts(bank_l + list(reversed(bank_r)))}Z", fill="bank")
wl = [proj(river_x(Z) - river_hw(Z), Z) for Z in Zs]
wr = [proj(river_x(Z) + river_hw(Z), Z) for Z in Zs]
Lyr("water", d=f"M{pts(wl + list(reversed(wr)))}Z", id="wr")
Lyr("stroke", d=f"M{pts(wl)}M{pts(wr)}", stroke="riverEdge", w=1)

Lyr("light", g="farlight", **FARLIGHT)
for ter, key in ((L_ter, "hillL"), (R_ter, "hillR")):
    even = "".join(f"M{pts(ter[k] + list(reversed(ter[k + 1])))}Z" for k in range(0, len(ter) - 1, 2))
    odd = "".join(f"M{pts(ter[k] + list(reversed(ter[k + 1])))}Z" for k in range(1, len(ter) - 1, 2))
    Lyr("fill", d=even, fill=key)
    Lyr("fill", d=odd, fill=key + "alt")
    Lyr("stroke", d="".join("M" + pts(line) for line in ter[1:-1]), stroke="terr", w=1)
Lyr("grad", g="mist", **MIST)
Lyr("props")
Lyr("glows")

# ------------------------------------------------------------------ farms (out)
order = sorted(range(len(farms)), key=lambda i: farms[i]["y"])
remap = {old: new for new, old in enumerate(order)}
FJ = []
for i in order:
    f = farms[i]
    typ = 2 if f["s"] >= 8 else 1 if f["s"] >= 3 else 0
    FJ.append([round(f["x"], 1), round(f["y"], 1), round(f["s"], 2), typ, 1 if f["hero"] else 0, f["hdr"] or ""])
PJ = []
for q in props:
    if q["g"] == "r":
        PJ.append(["r", remap[q["farm"]]])
    else:
        PJ.append([q["g"], round(q["x"], 1), round(q["y"], 1), round(q["s"], 2), 1 if q["flip"] else 0, q["col"]])

# ------------------------------------------------------------------ the SVG --
def grad_stops(key):
    return "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in G[key])


def part_svg(part):
    if part.get("v"):
        fill = C["vessel"]
    elif part.get("w"):
        fill = C["window"]
    elif part.get("fill") == "$":
        fill = "currentColor"
    else:
        fill = C[part["fill"]] if "fill" in part else "none"
    st = f' stroke="{C[part["stroke"]]}" vector-effect="non-scaling-stroke"' if "stroke" in part else ""
    return f'<path d="{part["d"]}" fill="{fill}"{st}/>'


out = []
A = out.append
VIEW = dict(top=-800, h=1800)
A(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {VIEW["top"]} 1600 {VIEW["h"]}" width="1600" height="{VIEW["h"]}" '
  f'preserveAspectRatio="xMidYMid slice">')
A('<defs>')
A(f'<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="0" y1="{SKY["y"]}" x2="0" y2="{f1(HY + 2)}">{grad_stops("sky")}</linearGradient>')
A(f'<linearGradient id="d" gradientUnits="userSpaceOnUse" x1="0" y1="{SKY["y"]}" x2="0" y2="{f1(HY + 2)}">{grad_stops("dawn")}</linearGradient>')
A(f'<radialGradient id="u" gradientUnits="userSpaceOnUse" cx="{f1(SUN["cx"])}" cy="{f1(SUN["cy"])}" r="{f1(SUN["rx"])}" '
  f'gradientTransform="translate({f1(SUN["cx"])} {f1(SUN["cy"])}) scale(1 {SUN["ry"] / SUN["rx"]:.4f}) translate({f1(-SUN["cx"])} {f1(-SUN["cy"])})">{grad_stops("sun")}</radialGradient>')
A(f'<radialGradient id="g">{grad_stops("glow")}</radialGradient>')
A(f'<linearGradient id="wn" gradientUnits="userSpaceOnUse" x1="0" y1="{f1(WATER["y0"])}" x2="0" y2="{f1(WATER["y1"])}">{grad_stops("wnight")}</linearGradient>')
A(f'<linearGradient id="wd" gradientUnits="userSpaceOnUse" x1="0" y1="{f1(WATER["y0"])}" x2="0" y2="{f1(WATER["y1"])}">{grad_stops("wdawn")}</linearGradient>')
A(f'<radialGradient id="ws" gradientUnits="userSpaceOnUse" cx="{f1(SUN["cx"])}" cy="{f1(WATER["cy"])}" r="{f1(SUN["rx"])}" '
  f'gradientTransform="translate({f1(SUN["cx"])} {f1(WATER["cy"])}) scale(1 {SUN["ry"] / SUN["rx"]:.4f}) translate({f1(-SUN["cx"])} {f1(-WATER["cy"])})">{grad_stops("wsun")}</radialGradient>')
A(f'<linearGradient id="m" x1="0" y1="0" x2="0" y2="1">{grad_stops("mist")}</linearGradient>')
A(f'<linearGradient id="f" x1="0" y1="0" x2="0" y2="1">{grad_stops("fog")}</linearGradient>')
A(f'<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1">{grad_stops("foglight")}</linearGradient>')
A(f'<linearGradient id="fa" x1="0" y1="0" x2="0" y2="1">{grad_stops("farlight")}</linearGradient>')
for key, parts in GLYPHS.items():
    A(f'<symbol id="{key}" overflow="visible">{"".join(part_svg(pt) for pt in parts)}</symbol>')
A('</defs>')
sky_rect = f'x="{SKY["x"]}" y="{SKY["y"]}" width="{SKY["w"]}" height="{f1(SKY["h"])}"'
for ly in layers:
    k = ly["k"]
    if k == "sky":
        A(f'<rect {sky_rect} fill="url(#s)"/>')
    elif k == "dawn":
        A(f'<rect {sky_rect} fill="url(#d)"/>')
    elif k == "sun":
        A(f'<rect {sky_rect} fill="url(#u)"/>')
    elif k == "stars":
        A(f'<path d="{ly["d"]}" fill="#ffffff" fill-opacity="{ly["a"] * (1 - STAR_FADE):.3f}"/>')
    elif k in ("grad", "light"):
        gid = {"mist": "m", "fog": "f", "foglight": "fl", "farlight": "fa"}[ly["g"]]
        A(f'<rect x="{ly["x"]}" y="{f1(ly["y"])}" width="{ly["w"]}" height="{ly["h"]}" fill="url(#{gid})"/>')
    elif k == "lightfill":
        A(f'<path d="{ly["d"]}" fill="{C[ly["fill"]]}"/>')
    elif k == "fill":
        st = f' stroke="{C[ly["stroke"]]}" stroke-width="{ly["w"]}" vector-effect="non-scaling-stroke"' if "stroke" in ly else ""
        A(f'<path d="{ly["d"]}" fill="{CD.get(ly["fill"], C.get(ly["fill"], ly["fill"]))}"{st}/>')
    elif k == "water":
        A(f'<defs><path id="{ly["id"]}" d="{ly["d"]}"/></defs>')
        for gid in ("wn", "wd", "ws"):
            A(f'<use href="#{ly["id"]}" fill="url(#{gid})"/>')
    elif k == "stroke":
        A(f'<path d="{ly["d"]}" fill="none" stroke="{C[ly["stroke"]]}" stroke-width="{ly["w"]}" vector-effect="non-scaling-stroke"/>')
    elif k == "plants":
        A(f'<path d="{ly["d"]}" fill="none" stroke="{C["plants"]}" stroke-opacity=".32" stroke-linecap="round" vector-effect="non-scaling-stroke"/>')
    elif k == "headers":
        for fx in FJ:
            if fx[5]:
                col = C["hdrHero"] if fx[4] else C["hdr"]
                A(f'<path d="{fx[5]}" fill="none" stroke="{col}" stroke-width="{2 if fx[4] else 1.2}" '
                  f'stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>')
    elif k == "props":
        for q in PJ:
            if q[0] == "r":
                x, y, s_, typ, h, _ = FJ[q[1]]
                if typ:
                    A(f'<use href="#r{typ}" transform="translate({f1(x)} {f1(y)}) scale({s_ / 100:.4f})"/>')
                else:
                    A(f'<circle cx="{f1(x)}" cy="{f1(y - s_ * .5)}" r="{f1(max(.85, s_ * .4))}" fill="{C["vessel"]}"/>')
            else:
                gl, x, y, s_, flip, col = q
                sx = -s_ / 100 if flip else s_ / 100
                A(f'<use href="#{gl}" color="{col}" transform="translate({f1(x)} {f1(y)}) scale({sx:.4f} {s_ / 100:.4f})"/>')
    elif k == "glows":
        for x, y, s_, typ, h, _ in FJ:
            r = s_ * 2.3 if h else max(5.5, s_ * 1.9)
            A(f'<circle cx="{f1(x - s_ * .16)}" cy="{f1(y - s_ * .45)}" r="{f1(r)}" fill="url(#g)"/>')
A('</svg>')
svg = "".join(out)

# ------------------------------------------------------------------ the JSON (live)
data = dict(vb=[1600, 1000], view=VIEW, hy=HY, c=C, cD=CD, g=G, sky=SKY, sun=SUN, water=WATER, starFade=STAR_FADE,
            glyphs=GLYPHS, layers=layers, farms=FJ, props=PJ)
js = json.dumps(data, separators=(",", ":"))

here = Path(__file__).resolve().parent
if here.name == "build":          # integrated: build/vision-valley.py
    # Source material only. The page no longer reads either file: build/vision/
    # render.html paints the placeholder layers in assets/img/home/vision/
    # from the JSON, and the SVG is the vector reference for the design team.
    (here / "vision").mkdir(exist_ok=True)
    OUT_SVG = here / "vision" / "valley.svg"
    OUT_JSON = here / "vision" / "valley.json"
else:                             # the prototype folder
    OUT_SVG, OUT_JSON = here / "valley.svg", here / "valley.json"
OUT_SVG.write_text(svg + "\n")
OUT_JSON.write_text(js + "\n")
hf = farms[hero["farm"]]
kinds = {}
for q in props:
    kinds[q["g"][0]] = kinds.get(q["g"][0], 0) + 1
print(f"plots {len(plots)}  farms {len(farms)}  props {kinds}  hero at {f1(hf['x'])},{f1(hf['y'])} s={f1(hf['s'])}  "
      f"svg {len(svg) // 1024} KB  json {len(js) // 1024} KB  layers {len(layers)}")
