#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Draw the three plots the Math Model page needs from the numbers themselves.

    python3 build/model_figures.py

The docx the page was written from ships its charts as screenshots. Three of
them are worth redrawing rather than cropping, because in each case the picture
is making a claim about evidence and the screenshot does not show where the
evidence stops:

  salt-ladder-hill-fit        the only dose response the project owns. The docx
                              never plots it. Nine seedlings per group are on
                              the plot as faint dots so the spread is visible,
                              and the Hill curve is fitted here, in this file,
                              so the page can say what was fitted to what.
  pcpcg2-predicted-output     the docx draws this as a solid line, which reads
                              as a measurement. No induction curve exists. It
                              is drawn dashed here, with the interior marked as
                              unmeasured.
  bioreactor-density-by-soil  the inversion (coarse soil needs MORE reactors)
                              is the result, and a bar chart shows it in one
                              look where the table does not.

Everything is drawn as SVG by hand, rasterised with rsvg-convert and squeezed
with cwebp, because this machine has neither matplotlib nor scipy and the rest
of build/ does the same thing.

Writes assets/img/model/*.webp.
"""

import math
import os
import subprocess
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img", "model")

# ------------------------------------------------------------------ the data

# Arabidopsis Root Length Raw Data.xlsx, sheet "experiment 6", day 6, 3 Aug
# 2026. Nine seedlings per group, transcribed as the sheet records them. The
# wiki has carried 1.8 mm for the 150 mM group; the sheet averages 1.36.
LADDER = {
    0:   [73.898, 76.236, 76.181, 68.984, 75.299, 76.839, 73.466, 78.882, 74.773],
    75:  [30.682, 27.588, 35.686, 33.735, 30.490, 38.696, 40.118, 39.115, 36.797],
    100: [12.650, 11.526, 17.512,  4.649, 12.821, 11.756, 13.283,  4.998,  9.792],
    150: [0.000,   1.534,  2.014,  1.856,  1.424,  0.806,  3.544,  1.096,  0.000],
}

# Math Model Content.docx, GIS Economic Impact, stages 4 and 5.
SOILS = [                       # name, coverage radius cm, units per hectare
    ("Sandy loam",  8, 50),
    ("Loam",       12, 22),
    ("Inceptisol", 13, 19),
    ("Alfisol",    14, 16),
    ("Clay",       18, 10),
]

K_CCAS, N_CCAS = 4.66, 1.88     # Ohlendorf et al. 2019, via the docx
MEFL_OFF, MEFL_ON = 1500, 30000

INK   = "#171717"
BODY  = "#525252"
MUTE  = "#a3a3a3"
RULE  = "#e5e5e5"
LEAF  = "#23684a"
LEAF5 = "#4f9c6f"
AMBER = "#92610c"
RUST  = "#9a3d22"
FONT  = ("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
         "'Helvetica Neue', Arial, sans-serif")


def hill_fit(conc, rel):
    """Least squares on y = 1 / (1 + (C/K)^n), by grid then by refinement.

    Two parameters against four points, so the residual is not a test of
    anything. What is worth reporting is that n comes out the same whichever
    pair of points you take it from, which the page says instead of an R-square.
    """
    best = None
    for K in np.arange(40.0, 130.0, 0.5):
        for n in np.arange(2.0, 10.0, 0.05):
            r = (1.0 / (1.0 + (conc / K) ** n) - rel)
            s = float((r * r).sum())
            if best is None or s < best[0]:
                best = (s, K, n)
    _, K0, n0 = best
    for step in (0.05, 0.005):
        for K in np.arange(K0 - 20 * step, K0 + 20 * step, step):
            for n in np.arange(n0 - 20 * step, n0 + 20 * step, step):
                r = (1.0 / (1.0 + (conc / K) ** n) - rel)
                s = float((r * r).sum())
                if s < best[0]:
                    best = (s, K, n)
        _, K0, n0 = best
    return best[1], best[2], best[0]


# ------------------------------------------------------------------ svg parts

def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def txt(x, y, s, size=15, fill=BODY, anchor="start", weight="400", style=""):
    st = f' font-style="{style}"' if style else ""
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" '
            f'font-size="{size}" fill="{fill}" text-anchor="{anchor}" '
            f'font-weight="{weight}"{st}>{esc(s)}</text>')


def frame(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" '
            f'fill="#ffffff"/>{body}</svg>')


def write(name, svg, width=1600):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        s = os.path.join(tmp, "f.svg")
        p = os.path.join(tmp, "f.png")
        open(s, "w", encoding="utf-8").write(svg)
        subprocess.run(["rsvg-convert", "-w", str(width), "-b", "white",
                        "-o", p, s], check=True)
        dst = os.path.join(OUT, name + ".webp")
        subprocess.run(["cwebp", "-quiet", "-q", "92", p, "-o", dst], check=True)
    print("wrote", os.path.relpath(dst, ROOT))


# ------------------------------------------------------------- 1 · the ladder

def fig_ladder():
    W, H = 1200, 760
    L, R, T, B = 108, 40, 76, 96
    conc = np.array(sorted(LADDER))
    mean = np.array([np.mean(LADDER[c]) for c in conc])
    sd = np.array([np.std(LADDER[c], ddof=1) for c in conc])
    K, n, sse = hill_fit(conc, mean / mean[0])
    print(f"  Hill fit: K = {K:.2f} mM, n = {n:.2f}, SSE = {sse:.2e}")

    x0, x1, y0, y1 = 0.0, 162.0, 0.0, 85.0
    px = lambda v: L + (v - x0) / (x1 - x0) * (W - L - R)
    py = lambda v: H - B - (v - y0) / (y1 - y0) * (H - T - B)

    g = []
    for v in range(0, 90, 10):
        g.append(f'<line x1="{L}" y1="{py(v):.1f}" x2="{W-R}" y2="{py(v):.1f}" '
                 f'stroke="{RULE}" stroke-width="1"/>')
        g.append(txt(L - 14, py(v) + 5, str(v), 15, MUTE, "end"))
    for v in (0, 25, 50, 75, 100, 125, 150):
        g.append(txt(px(v), H - B + 28, str(v), 15, MUTE, "middle"))

    # the fitted curve first, so the data sits on top of it
    d = []
    for i in range(0, 501):
        c = x0 + (x1 - x0) * i / 500.0
        d.append(("M" if i == 0 else "L") +
                 f"{px(c):.2f} {py(mean[0] / (1 + (c / K) ** n)):.2f}")
    g.append(f'<path d="{"".join(d)}" fill="none" stroke="{LEAF5}" '
             f'stroke-width="3"/>')

    for c, m, s in zip(conc, mean, sd):
        for v in LADDER[c]:                       # every seedling, faintly
            g.append(f'<circle cx="{px(c):.1f}" cy="{py(v):.1f}" r="4.5" '
                     f'fill="{LEAF}" opacity="0.20"/>')
        g.append(f'<line x1="{px(c):.1f}" y1="{py(max(0, m-s)):.1f}" '
                 f'x2="{px(c):.1f}" y2="{py(m+s):.1f}" stroke="{INK}" '
                 f'stroke-width="2"/>')
        for e in (max(0.0, m - s), m + s):
            g.append(f'<line x1="{px(c)-9:.1f}" y1="{py(e):.1f}" '
                     f'x2="{px(c)+9:.1f}" y2="{py(e):.1f}" stroke="{INK}" '
                     f'stroke-width="2"/>')
        g.append(f'<circle cx="{px(c):.1f}" cy="{py(m):.1f}" r="8" '
                 f'fill="#ffffff" stroke="{INK}" stroke-width="2.5"/>')
        g.append(txt(px(c) + 20, py(m) - 12, f"{m:.2f} mm", 15, INK, "start", "650"))

    g.append(f'<line x1="{L}" y1="{py(0):.1f}" x2="{W-R}" y2="{py(0):.1f}" '
             f'stroke="{MUTE}" stroke-width="1"/>')
    g.append(f'<line x1="{L}" y1="{T-16}" x2="{L}" y2="{py(0):.1f}" '
             f'stroke="{MUTE}" stroke-width="1"/>')

    g.append(txt(L, 34, "Root length against sodium chloride, day 6", 22, INK,
                 "start", "650"))
    g.append(txt(L, 58, "Arabidopsis thaliana on agar, 3 August 2026, nine "
                        "seedlings per group", 16, BODY))
    g.append(txt(L - 76, T - 34, "mm", 15, MUTE, "start"))
    g.append(txt((L + W - R) / 2, H - 30, "NaCl in the medium (mM)", 16, BODY,
                 "middle"))

    bx, by = px(6), py(30)
    g.append(f'<rect x="{bx:.0f}" y="{by:.0f}" width="330" height="96" rx="5" '
             f'fill="#ffffff" stroke="{RULE}" stroke-width="1"/>')
    g.append(txt(bx + 18, by + 30, "Fitted here, to these four means", 14,
                 LEAF, "start", "700"))
    g.append(txt(bx + 18, by + 56, f"L(C) = 74.95 / (1 + (C/{K:.1f})^{n:.2f})",
                 16, INK))
    g.append(txt(bx + 18, by + 79, "bars are one standard deviation; dots are "
                                   "seedlings", 14, MUTE))
    write("salt-ladder-hill-fit", frame(W, H, "".join(g)))
    return K, n


# ------------------------------------------------- 2 · the promoter we assumed

def fig_promoter():
    W, H = 1200, 720
    L, R, T, B = 118, 250, 76, 96
    x0, x1, y0, y1 = 0.0, 20.0, 0.0, 32000.0
    px = lambda v: L + (v - x0) / (x1 - x0) * (W - L - R)
    py = lambda v: H - B - (v - y0) / (y1 - y0) * (H - T - B)
    hill = lambda p: MEFL_OFF + (MEFL_ON - MEFL_OFF) * (
        p ** N_CCAS / (K_CCAS ** N_CCAS + p ** N_CCAS))

    g = []
    for v in range(0, 32001, 5000):
        g.append(f'<line x1="{L}" y1="{py(v):.1f}" x2="{W-R}" y2="{py(v):.1f}" '
                 f'stroke="{RULE}" stroke-width="1"/>')
        g.append(txt(L - 14, py(v) + 5, f"{v:,}", 15, MUTE, "end"))
    for v in (0, 4.66, 10, 15, 20):
        lab = "4.66" if v == 4.66 else str(int(v))
        g.append(txt(px(v), H - B + 28, lab, 15, MUTE, "middle"))

    # the band nothing was ever measured in
    g.append(f'<rect x="{px(0.5):.1f}" y="{py(MEFL_ON):.1f}" '
             f'width="{px(20)-px(0.5):.1f}" height="{py(MEFL_OFF)-py(MEFL_ON):.1f}" '
             f'fill="{AMBER}" opacity="0.055"/>')

    for v, lab, col in ((MEFL_OFF, "OFF state, 1,500 MEFL", BODY),
                        (MEFL_ON, "ON asymptote, 30,000 MEFL", BODY)):
        g.append(f'<line x1="{L}" y1="{py(v):.1f}" x2="{W-R}" y2="{py(v):.1f}" '
                 f'stroke="{INK}" stroke-width="1.5" stroke-dasharray="2 5"/>')
        g.append(txt(W - R + 14, py(v) + 5, lab, 14, col, "start", "650"))

    d = []
    for i in range(0, 501):
        p = 0.5 + (20.0 - 0.5) * i / 500.0
        d.append(("M" if i == 0 else "L") + f"{px(p):.2f} {py(hill(p)):.2f}")
    g.append(f'<path d="{"".join(d)}" fill="none" stroke="{LEAF5}" '
             f'stroke-width="3.5" stroke-dasharray="9 7"/>')

    g.append(f'<line x1="{px(K_CCAS):.1f}" y1="{py(0):.1f}" '
             f'x2="{px(K_CCAS):.1f}" y2="{py(hill(K_CCAS)):.1f}" '
             f'stroke="{MUTE}" stroke-width="1.5" stroke-dasharray="3 4"/>')
    g.append(f'<circle cx="{px(K_CCAS):.1f}" cy="{py(hill(K_CCAS)):.1f}" r="7" '
             f'fill="#ffffff" stroke="{LEAF}" stroke-width="2.5"/>')
    g.append(txt(px(K_CCAS) + 20, py(hill(K_CCAS)) - 24,
                 "K = 4.66, borrowed from CcaS", 15, LEAF, "start", "650"))

    g.append(f'<line x1="{L}" y1="{py(0):.1f}" x2="{W-R}" y2="{py(0):.1f}" '
             f'stroke="{MUTE}" stroke-width="1"/>')
    g.append(f'<line x1="{L}" y1="{T-16}" x2="{L}" y2="{py(0):.1f}" '
             f'stroke="{MUTE}" stroke-width="1"/>')

    g.append(txt(L, 34, "Predicted P_cpcG2 output against green light", 22, INK,
                 "start", "650"))
    g.append(txt(L, 58, "Nothing on this curve has been measured. The shape is "
                        "the CcaS Hill function, not the promoter's.", 16, RUST))
    g.append(txt(L - 86, T - 34, "MEFL", 15, MUTE, "start"))
    g.append(txt((L + W - R) / 2, H - 30,
                 "PPFD at the vessel wall (μmol m⁻² s⁻¹)",
                 16, BODY, "middle"))
    g.append(txt(px(10.2), py(6200), "no induction measurement anywhere in "
                                     "this band", 15, AMBER, "middle", "650"))
    write("pcpcg2-predicted-output", frame(W, H, "".join(g)))


# -------------------------------------------------------- 3 · units per soil

def fig_density():
    W, H = 1200, 620
    L, R, T, B = 230, 300, 92, 56
    top = max(u for _, _, u in SOILS)
    bw = (H - T - B) / len(SOILS)
    px = lambda v: L + v / (top * 1.06) * (W - L - R)

    g = []
    for v in (0, 10, 20, 30, 40, 50):
        g.append(f'<line x1="{px(v):.1f}" y1="{T-12}" x2="{px(v):.1f}" '
                 f'y2="{H-B:.0f}" stroke="{RULE}" stroke-width="1"/>')
        g.append(txt(px(v), H - B + 26, str(v), 15, MUTE, "middle"))

    for i, (name, rad, units) in enumerate(SOILS):
        y = T + i * bw
        h = bw * 0.54
        col = RUST if name == "Sandy loam" else LEAF5
        g.append(f'<rect x="{L}" y="{y + (bw-h)/2:.1f}" '
                 f'width="{px(units)-L:.1f}" height="{h:.1f}" fill="{col}" '
                 f'rx="2"/>')
        g.append(txt(L - 18, y + bw / 2 + 6, name, 17, INK, "end", "600"))
        g.append(txt(px(units) + 14, y + bw / 2 + 6, f"{units} units",
                     17, INK, "start", "650"))
        g.append(txt(px(units) + 128, y + bw / 2 + 6,
                     f"r = {rad} cm", 15, MUTE, "start"))

    g.append(f'<line x1="{L}" y1="{T-12}" x2="{L}" y2="{H-B:.0f}" '
             f'stroke="{MUTE}" stroke-width="1"/>')
    g.append(txt(L - 212, 36, "Bioreactors needed per hectare, by soil texture",
                 22, INK, "start", "650"))
    g.append(txt(L - 212, 60, "Coarse soil needs five times as many units as "
                              "clay, which is the opposite of the intuition.",
                 16, BODY))
    g.append(txt((L + W - R) / 2, H - 16, "units per hectare", 16, BODY,
                 "middle"))
    write("bioreactor-density-by-soil", frame(W, H, "".join(g)))


if __name__ == "__main__":
    fig_ladder()
    fig_promoter()
    fig_density()
