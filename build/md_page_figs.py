#!/usr/bin/env python3
"""
The figures on the Protein Design / Molecular Dynamics page, as inline SVG.

Timmy asked for the analysis and the visualisations to be on the one MD page
rather than only inside the nine reports, so the plots a reader needs to follow
the argument are generated here, straight out of the same JSON the reports
draw, and pasted into protein-design/molecular-dynamics/index.html.

Inline SVG rather than a raster: it stays sharp, it prints, it inherits the
page's colour tokens, and a student editing the page can read the labels.

Run:  python3 build/md_page_figs.py
Out:  build/_md_figs/<name>.svg  (inline these into the page)
"""
import json, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(HERE, "md-simulations", "data")
OUT  = os.path.join(HERE, "build", "_md_figs")

LEAF, RUST, AMBR, SLAT = "#23684a", "#9a3d22", "#92610c", "#3f5468"
GRID, AXIS, INK, SUB   = "#e5e5e5", "#a3a3a3", "#1d1d1f", "#6e6e73"
MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"
SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"


def load(stem):
    with open(os.path.join(SRC, stem + ".json")) as fh:
        return json.load(fh)


def svg(name, w, h, body, title, desc):
    s = (f'<svg class="mdfig" viewBox="0 0 {w} {h}" width="100%" role="img" '
         f'xmlns="http://www.w3.org/2000/svg" aria-labelledby="{name}-t {name}-d" '
         f'font-family="{SANS}">\n'
         f'  <title id="{name}-t">{title}</title>\n'
         f'  <desc id="{name}-d">{desc}</desc>\n{body}</svg>\n')
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + ".svg"), "w") as fh:
        fh.write(s)
    print(f"{name:14} {len(s)/1024:5.1f} KB")


def txt(x, y, s, size=11, fill=SUB, anchor="start", weight="400", font=SANS, extra=""):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" font-family="{font}"{extra}>{s}</text>\n')


def wrap(x, y, s, width, size=10, fill=SUB, lh=14, weight="400", anchor="start"):
    """Crude but adequate: break on words at an estimated character width."""
    per = max(8, int(width / (size * 0.52)))
    out, line, w = "", "", 0
    lines = []
    for word in s.split():
        n = len(word.replace("&#8491;", "A").replace("&#183;", "."))
        if w and w + n + 1 > per:
            lines.append(line); line, w = word, n
        else:
            line = (line + " " + word).strip(); w += n + 1
    if line: lines.append(line)
    for i, ln in enumerate(lines):
        out += txt(x, y + i * lh, ln, size, fill, anchor=anchor, weight=weight)
    return out


# ----------------------------------------------------------------- 1. the gate
def fig_gate():
    """One construct, two criteria. The bars the project's own gate drew, and
       the bars an atom-resolved, angle-aware definition draws instead."""
    W, H = 780, 400
    pad_l, top = 236, 104
    bw, rowh, gap = 360, 30, 20
    above = [
      ("Asn23-Arg487 within 4 &#8491;",   "either oxygen counts",   100.0,  99.8, "pct"),
      ("Clamp, 3 of 4 contacts held",     "either oxygen counts",   100.0,  99.7, "pct"),
      ("Conserved-window RMSD",           "lower is steadier",        1.67,  1.12, "rmsd"),
    ]
    below = [
      ("Bidentate salt bridge",           "both oxygens, angle-aware", 100.0, 0.0, "pct"),
      ("Two or more H-bonds to Arg487",   "named donor and acceptor",   99.8, 0.0, "pct"),
      ("Carboxylate in Arg487 shell",     "first solvation shell",     100.0, 0.0, "pct"),
    ]
    b = ''
    b += f'<rect x="0" y="0" width="{W}" height="{H}" fill="none"/>\n'
    b += txt(26, 26, "One pair of trajectories, two definitions of the same contact",
             11.5, INK, weight="700")
    b += txt(26, 42, "bars are the measured value &#183; 1,500 frames each", 9.5, SUB)
    b += (f'<rect x="{W - 212}" y="{18}" width="14" height="10" rx="2" fill="{LEAF}"/>\n')
    b += txt(W - 192, 27, "wild type", 11, LEAF, weight="700")
    b += (f'<rect x="{W - 118}" y="{18}" width="14" height="10" rx="2" fill="{RUST}"/>\n')
    b += txt(W - 98, 27, "+ 6&#215;His", 11, RUST, weight="700")

    def band(rows, y0, head, headcol, note):
        out = txt(pad_l - 16, y0 - 18, head, 9.5, headcol, anchor="end", weight="700",
                  extra=' letter-spacing="0.07em"')
        out += txt(pad_l, y0 - 18, note, 9.5, headcol)
        for i, (name, sub, wtv, tgv, kind) in enumerate(rows):
            y = y0 + i * (rowh + gap)
            out_scale = (lambda v: v / 2.6 * bw) if kind == "rmsd" else (lambda v: v / 100 * bw)
            unit = " &#8491;" if kind == "rmsd" else "%"
            out_ = txt(pad_l - 16, y + 10, name, 11, INK, anchor="end", weight="600")
            out_ += txt(pad_l - 16, y + 24, sub, 9.5, SUB, anchor="end")
            for j, (v, col) in enumerate(((wtv, LEAF), (tgv, RUST))):
                yy = y + j * 14
                out_ += (f'<rect x="{pad_l}" y="{yy}" width="{max(1.6, out_scale(v)):.1f}" '
                         f'height="10" rx="2" fill="{col}" opacity="{0.95 if j == 0 else 0.88}"/>\n')
                lab = f"{v:.2f}{unit}" if kind == "rmsd" else f"{v:.1f}{unit}"
                out_ += txt(pad_l + out_scale(v) + 7, yy + 8.5, lab, 10, col,
                            weight="700", font=MONO)
            out += out_
        return out

    b += band(above, top, "BEFORE THE CONSTRUCT EXISTED", SUB,
              "the gate as written: distances between atoms")
    y2 = top + 3 * (rowh + gap) + 18
    b += (f'<line x1="26" y1="{y2 - 40}" x2="{W - 20}" y2="{y2 - 40}" '
          f'stroke="{AXIS}" stroke-dasharray="3 4"/>\n')
    b += band(below, y2, "AFTER, ON NAMED ATOMS", RUST,
              "the same trajectory, measured on the chemistry")
    svg("fig-gate", W, H, b,
        "The same tagged construct under the project's own acceptance gate and under an atom-resolved criterion",
        "Six measures of one pair of trajectories. Under the three distance-only measures above the "
        "dashed line the tagged construct is indistinguishable from wild type and has the lowest "
        "conserved-window RMSD in the whole set, 1.12 angstroms. Under the three atom-resolved "
        "measures below it, every one reads 0.0 per cent against 99.8 to 100 per cent for wild type.")


# ------------------------------------------------------- 2. two identical traces
def fig_tagtrace():
    """The distance trace the gate watched, for both runs, at the same scale."""
    W, H = 760, 336
    L, R, T, B = 56, 18, 40, 96
    pw, ph = W - L - R, H - T - B
    wt = load("bopep4-wt-round1")["contacts"][0]["series"]
    tg = load("bopep4-chis-vs-wt")["contacts"][0]["series"]
    n = min(len(wt), len(tg))
    step = 2
    ylo, yhi = 2.0, 5.0
    x = lambda i: L + i / (n - 1) * pw
    y = lambda v: T + ph - (min(max(v, ylo), yhi) - ylo) / (yhi - ylo) * ph
    b = ''
    b += (f'<rect x="{L}" y="{y(4):.1f}" width="{pw}" height="{y(ylo)-y(4):.1f}" '
          f'fill="{LEAF}" opacity="0.05"/>\n')
    for v in (2, 3, 4, 5):
        b += f'<line x1="{L}" y1="{y(v):.1f}" x2="{L+pw}" y2="{y(v):.1f}" stroke="{GRID}"/>\n'
        b += txt(L - 8, y(v) + 4, f"{v}", 10, SUB, anchor="end", font=MONO)
    b += txt(L - 8, T - 12, "&#8491;", 10, SUB, anchor="end")
    b += (f'<line x1="{L}" y1="{y(4):.1f}" x2="{L+pw}" y2="{y(4):.1f}" '
          f'stroke="{LEAF}" stroke-dasharray="4 3" opacity="0.6"/>\n')
    b += txt(L + pw - 4, y(4) - 7, "the gate's 4 &#8491; line, crossed by neither run", 9.5, LEAF,
             anchor="end")
    for series, col, dash in ((wt, LEAF, ""), (tg, RUST, ' stroke-dasharray="4 3"')):
        pts = " ".join(f"{x(i):.1f},{y(series[i]):.1f}" for i in range(0, n, step))
        b += (f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="1.1" '
              f'opacity="0.85"{dash}/>\n')
    for i, lab in ((0, "0"), (n // 2, "15"), (n - 1, "30")):
        b += txt(x(i), T + ph + 16, lab, 10, SUB, anchor="middle", font=MONO)
    b += txt(L + pw / 2, T + ph + 32, "production time (ns)", 10, SUB, anchor="middle")
    b += txt(L, 20, "Wild type", 11.5, LEAF, weight="700")
    b += txt(L + 78, 20, "mean 2.75 &#8491;", 10, SUB, font=MONO)
    b += txt(L + 190, 20, "+ 6&#215;His", 11.5, RUST, weight="700")
    b += txt(L + 258, 20, "mean 2.90 &#8491;", 10, SUB, font=MONO)
    b += txt(L + pw, 20, "charge centres: 3.98 &#8491; &#8594; 20.07 &#8491;", 10.5, INK,
             anchor="end", weight="600")
    b += wrap(L - 36, T + ph + 56,
              "Both traces are within the gate for the whole trajectory. The approach the tagged "
              "run records is a neutral amide carbonyl, because His24 has consumed the carboxylate "
              "into a peptide bond. Measured between charge centres the same pair is 20.07 &#8491; "
              "apart, and the carboxylate's closest approach in the tagged run is 11.65 &#8491;.",
              W - 24, 10, SUB, 15)
    svg("fig-tagtrace", W, H, b,
        "Asn23 to Arg487 distance over 30 nanoseconds, wild type against the tagged construct",
        "Two traces at the same scale. Both sit near 2.8 angstroms for the whole trajectory and "
        "neither leaves the four-angstrom window the acceptance criterion drew, which is why the "
        "tagged construct passed. The approach the tagged trace records is a neutral amide carbonyl, "
        "not the charged carboxylate: measured between charge centres the same pair is 20.07 "
        "angstroms apart.")


# ------------------------------------------------------------ 3. the ladder
def fig_ladder():
    """Four rungs, three measures. The dip is at the construct that was ordered."""
    W, H = 760, 346
    runs = [
      ("1-23",  "full length",        100.0, 100.0, 96.5, 1.67, LEAF),
      ("7-23",  "Lys7 terminal",       98.5,  87.7, 94.6, 1.38, LEAF),
      ("9-23",  "ordered construct",   77.1,  46.9, 68.5, 2.28, AMBR),
      ("15-23", "conserved core",      99.9,  97.2, 89.6, 1.81, LEAF),
    ]
    L, T = 86, 90
    colw, ph = 148, 172
    b = ''
    b += txt(L - 10, 26, "Clamp integrity and the Arg487 salt bridge, by rung",
             11.5, INK, weight="700")
    b += txt(L - 10, 42, "share of 1,500 frames &#183; the ladder is not monotonic", 9.5, SUB)
    for v in (0, 50, 100):
        yy = T + ph - v / 100 * ph
        b += f'<line x1="{L}" y1="{yy:.1f}" x2="{L + 4*colw - 40}" y2="{yy:.1f}" stroke="{GRID}"/>\n'
        b += txt(L - 8, yy + 4, f"{v}", 10, SUB, anchor="end", font=MONO)
    gate = T + ph - 60 / 100 * ph
    b += (f'<line x1="{L}" y1="{gate:.1f}" x2="{L + 4*colw - 40}" y2="{gate:.1f}" '
          f'stroke="{RUST}" stroke-dasharray="4 3" opacity="0.65"/>\n')
    b += txt(L - 8, gate + 4, "gate 60%", 9, RUST, anchor="end", weight="700")
    for i, (name, note, clamp, bident, ncon, rmsd, col) in enumerate(runs):
        cx = L + i * colw + 22
        for j, (v, c, lab) in enumerate(((clamp, col, "clamp"), (bident, col, "bidentate"))):
            bx = cx + j * 42
            hh = v / 100 * ph
            b += (f'<rect x="{bx}" y="{T + ph - hh:.1f}" width="34" height="{max(1.5, hh):.1f}" '
                  f'rx="3" fill="{c}" opacity="{0.95 if j == 0 else 0.42}"/>\n')
            b += txt(bx + 17, T + ph - hh - 7, f"{v:.1f}", 10, c, anchor="middle",
                     weight="700", font=MONO)
        b += txt(cx + 38, T + ph + 18, name, 12, INK, anchor="middle", weight="700", font=MONO)
        b += txt(cx + 38, T + ph + 33, note, 9.5, col if col != LEAF else SUB, anchor="middle")
        b += txt(cx + 38, T + ph + 52, f"{ncon:.1f} contacts", 9.5, SUB, anchor="middle", font=MONO)
        b += txt(cx + 38, T + ph + 65, f"RMSD {rmsd:.2f} &#8491;", 9.5, SUB, anchor="middle", font=MONO)
    b += (f'<rect x="{L - 10}" y="{60}" width="12" height="9" rx="2" fill="{SLAT}"/>\n')
    b += txt(L + 8, 68, "clamp integrity, 3 of 4 native contacts", 9.5, SUB)
    b += (f'<rect x="{L + 228}" y="{60}" width="12" height="9" rx="2" fill="{SLAT}" opacity="0.42"/>\n')
    b += txt(L + 246, 68, "bidentate Arg487 salt bridge", 9.5, SUB)
    svg("fig-ladder", W, H, b,
        "The truncation ladder is not monotonic: the four-rung comparison dips at 9 to 23",
        "Clamp integrity and bidentate salt-bridge occupancy for the full-length peptide and the "
        "three cuts. Full length, 7 to 23 and 15 to 23 all hold the clamp above 98 per cent. "
        "Only the intermediate 9 to 23 construct, the one that was ordered, falls to 77.1 per cent "
        "clamp integrity and 46.9 per cent bidentate occupancy. Shorter is not the variable.")


# ------------------------------------------------------- 4. per-residue, wild type
def fig_perres():
    """What the reference run says about which end of the peptide does the work."""
    W, H = 760, 352
    d = load("bopep4-wt-round1")
    pr = d["per_res"]
    L, T = 48, 74
    pw, ph = W - L - 30, 148
    bw = pw / len(pr)
    b = ''
    b += txt(L - 8, 24, "Contact occupancy (bars) and fluctuation (line), full-length BoPEP4",
             11.5, INK, weight="700")
    b += txt(L - 8, 40, "occupancy = share of 1,500 frames within 4 &#8491; of the receptor", 9.5, SUB)
    xcons = L + 14 * bw
    b += (f'<rect x="{xcons:.1f}" y="{T}" width="{9 * bw:.1f}" height="{ph}" '
          f'fill="{LEAF}" opacity="0.06"/>\n')
    b += txt(xcons + 4.5 * bw, T - 8, "conserved window 15-23", 9.5, LEAF, anchor="middle", weight="700")
    b += (f'<rect x="{L}" y="{T}" width="{6 * bw:.1f}" height="{ph}" fill="{AMBR}" opacity="0.055"/>\n')
    b += txt(L + 3 * bw, T - 8, "GILIGS, the cut", 9.5, AMBR, anchor="middle", weight="700")
    for v in (0, 50, 100):
        yy = T + ph - v / 100 * ph
        b += f'<line x1="{L}" y1="{yy:.1f}" x2="{L + pw:.1f}" y2="{yy:.1f}" stroke="{GRID}"/>\n'
        b += txt(L - 7, yy + 4, f"{v}", 9.5, SUB, anchor="end", font=MONO)
    rmax = 4.0
    for i, r in enumerate(pr):
        x0 = L + i * bw
        hh = r["occ4"] / 100 * ph
        col = LEAF if r["i"] >= 15 else (AMBR if r["i"] <= 6 else SLAT)
        b += (f'<rect x="{x0 + 1.5:.1f}" y="{T + ph - hh:.1f}" width="{bw - 3:.1f}" '
              f'height="{max(1.2, hh):.1f}" rx="2" fill="{col}" opacity="0.8"/>\n')
        b += txt(x0 + bw / 2, T + ph + 15, r["code"], 10.5, INK, anchor="middle",
                 weight="700", font=MONO)
        if r["i"] in (1, 7, 9, 15, 18, 23):
            b += txt(x0 + bw / 2, T + ph + 29, str(r["i"]), 9, SUB, anchor="middle", font=MONO)
    pts = " ".join(f'{L + i*bw + bw/2:.1f},{T + ph - min(r["rmsf"], rmax)/rmax*ph:.1f}'
                   for i, r in enumerate(pr))
    b += f'<polyline points="{pts}" fill="none" stroke="{RUST}" stroke-width="1.6"/>\n'
    for i, r in enumerate(pr):
        yy = T + ph - min(r["rmsf"], rmax) / rmax * ph
        b += f'<circle cx="{L + i*bw + bw/2:.1f}" cy="{yy:.1f}" r="2.1" fill="{RUST}"/>\n'
    b += (f'<line x1="{L}" y1="{T + ph - 2/rmax*ph:.1f}" x2="{L + pw:.1f}" '
          f'y2="{T + ph - 2/rmax*ph:.1f}" stroke="{RUST}" stroke-dasharray="2 4" opacity="0.45"/>\n')
    b += txt(L + 6, T + ph - 2 / rmax * ph - 6, "2 &#8491; fluctuation", 9, RUST)
    b += (f'<circle cx="{L + pw - 212}" cy="{42}" r="3" fill="{RUST}"/>'
          f'<line x1="{L + pw - 222}" y1="42" x2="{L + pw - 202}" y2="42" '
          f'stroke="{RUST}" stroke-width="1.6"/>\n')
    b += txt(L + pw - 194, 46, "fluctuation, scale 0 to 4 &#8491;", 9.5, SUB)
    b += wrap(L - 40, T + ph + 56,
              "Every residue past Pro10 holds over 75% contact except Pro19, and every residue "
              "past Arg11 fluctuates under 1 &#8491; except Lys18. The two ends of this peptide do "
              "different jobs, and the end that can be cut is the end that is already loose.",
              W - 20, 10, SUB, 15)
    svg("fig-perres", W, H, b,
        "Per-residue contact occupancy and fluctuation for the wild-type reference run",
        "Twenty-three bars, one per residue. The opening GILIGS segment is low-occupancy and the "
        "fluctuation line sits above two angstroms across it. From Ser15 to Asn23 occupancy is near "
        "100 per cent and fluctuation is sub-angstrom. The two ends of the peptide behave "
        "differently, and the conserved end is the one in contact.")


# ------------------------------------------------------------ 5. pH crossed
def fig_phgrid():
    """Protonation is not a universal improvement: it depends what is left."""
    W, H = 700, 354
    cells = [
      (0, 0, "1-23 &#183; pH 7",   100.0,  0.8, 1.67, "reference",            LEAF),
      (1, 0, "1-23 &#183; pH 5.5", 99.9,  99.9, 1.34, "best untagged run",    LEAF),
      (0, 1, "9-23 &#183; pH 7",    46.9,  3.0, 2.28, "passed, but worst",    AMBR),
      (1, 1, "9-23 &#183; pH 5.5",   6.9, 26.4, 1.33, "failed the gate",      RUST),
    ]
    L, T, cw, ch, g = 150, 76, 230, 96, 14
    b = ''
    b += txt(L, 28, "The same two changes, crossed", 11.5, INK, weight="700")
    b += txt(L, 44, "bidentate salt bridge (left) and Glu12-His227 (right), % of frames", 9.5, SUB)
    b += txt(L + cw / 2, T - 10, "pH 7", 11, SUB, anchor="middle", weight="700")
    b += txt(L + cw + g + cw / 2, T - 10, "pH 5.5, three histidines protonated", 11, SUB,
             anchor="middle", weight="700")
    b += txt(L - 14, T + ch / 2, "full length", 11, SUB, anchor="end", weight="700")
    b += txt(L - 14, T + ch / 2 + 15, "1-23", 10, SUB, anchor="end", font=MONO)
    b += txt(L - 14, T + ch + g + ch / 2, "truncated", 11, SUB, anchor="end", weight="700")
    b += txt(L - 14, T + ch + g + ch / 2 + 15, "9-23", 10, SUB, anchor="end", font=MONO)
    for cx, cy, name, bident, glu, rmsd, note, col in cells:
        x0, y0 = L + cx * (cw + g), T + cy * (ch + g)
        b += (f'<rect x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="12" '
              f'fill="{col}" opacity="0.06"/>\n')
        b += (f'<rect x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="12" fill="none" '
              f'stroke="{col}" stroke-width="1" opacity="0.3"/>\n')
        b += txt(x0 + 16, y0 + 22, name, 10.5, SUB, weight="600", font=MONO)
        for j, (v, lab) in enumerate(((bident, "bidentate"), (glu, "Glu12-His227"))):
            bx = x0 + 16 + j * 104
            c = col if j == 0 else SLAT
            b += txt(bx, y0 + 54, f"{v:.1f}", 24, c, weight="700", font=MONO)
            b += txt(bx, y0 + 68, lab, 9, SUB)
            bar = v / 100 * 88
            b += f'<rect x="{bx}" y="{y0 + 76}" width="88" height="4" rx="2" fill="{GRID}"/>\n'
            b += (f'<rect x="{bx}" y="{y0 + 76}" width="{max(1.5, bar):.1f}" height="4" rx="2" '
                  f'fill="{c}"/>\n')
        b += txt(x0 + cw - 16, y0 + 22, note, 9.5, col, anchor="end", weight="700")
        b += txt(x0 + cw - 16, y0 + 90, f"RMSD {rmsd:.2f} &#8491;", 9, SUB, anchor="end", font=MONO)
    b += wrap(L - 130, T + 2 * ch + g + 36,
              "Neither change alone pulls the C-terminus off the receptor: the His22 self-contact "
              "runs at 17.4% of frames from truncation and 64.7% from protonation. Only the two "
              "together reach 96.9%, and that is the frame count on which the clamp collapses.",
              W - 40, 10, SUB, 15)
    svg("fig-phgrid", W, H, b,
        "Truncation crossed with protonation: only the combination fails",
        "A two-by-two. Full length at pH 7 is the reference. Protonating three histidines on the "
        "full-length peptide recovers the Glu12 to His227 contact from 0.8 to 99.9 per cent of "
        "frames and leaves the bidentate salt bridge at 99.9 per cent. The same protonation applied "
        "to the 9 to 23 construct drops bidentate occupancy from 46.9 to 6.9 per cent, the only run "
        "in the set to fail its acceptance criteria, and its backbone RMSD improves while it fails.")


# ---------------------------------------------------- 6. RMSD does not track it
def fig_decouple():
    """The one result that needs every run: the aggregate number is not the bond."""
    W, H = 760, 440
    L, T = 62, 120
    pw, ph = W - L - 36, 188
    xr = (1.02, 2.40)
    x = lambda v: L + (v - xr[0]) / (xr[1] - xr[0]) * pw
    y = lambda v: T + ph - v / 100 * ph
    b = ''
    b += txt(L - 36, 26, "Backbone RMSD does not predict whether the salt bridge survives",
             11.5, INK, weight="700")
    b += txt(L - 36, 42, "eight peptide-bearing runs &#183; Pearson +0.13, Spearman +0.29",
             9.5, SUB)
    b += txt(L + pw, 42, "vertical: bidentate Arg487 salt bridge, % of 1,500 frames",
             9.5, SUB, anchor="end")
    for v in (0, 25, 50, 75, 100):
        yy = y(v)
        b += f'<line x1="{L}" y1="{yy:.1f}" x2="{L + pw:.1f}" y2="{yy:.1f}" stroke="{GRID}"/>\n'
        b += txt(L - 8, yy + 4, f"{v}", 9.5, SUB, anchor="end", font=MONO)
    b += (f'<line x1="{L}" y1="{y(60):.1f}" x2="{L + pw:.1f}" y2="{y(60):.1f}" '
          f'stroke="{AXIS}" stroke-dasharray="3 4"/>\n')
    for v in (1.2, 1.6, 2.0, 2.4):
        b += txt(x(v), T + ph + 17, f"{v:.1f}", 9.5, SUB, anchor="middle", font=MONO)
    b += txt(L + pw / 2, T + ph + 34,
             "conserved-window backbone RMSD (&#8491;)  &#8212;  steadier to the left",
             10, SUB, anchor="middle")

    #  name, rmsd, bidentate, colour, tag, label x, label y, anchor, leader
    pts = [
      ("AtPEP1 7-23",  1.17,  99.9, SLAT, "crystal benchmark", x(1.17),      T - 58, "middle", 1),
      ("1-23",         1.67, 100.0, LEAF, "reference",         x(1.67),      T - 58, "middle", 1),
      ("1-23 pH 5.5",  1.34,  99.9, LEAF, "best untagged run", x(1.34),      T - 26, "middle", 1),
      ("15-23",        1.81,  97.2, LEAF, "control that held", x(1.81) + 54, T - 26, "middle", 1),
      ("7-23",         1.38,  87.7, LEAF, "",                  x(1.38),      y(87.7) + 22, "middle", 0),
      ("9-23",         2.28,  46.9, AMBR, "ordered construct", x(2.28) - 12, y(46.9) + 4, "end", 0),
      ("9-23 pH 5.5",  1.33,   6.9, RUST, "failed the gate",   x(1.33) + 12, y(6.9) + 18, "start", 0),
      ("1-23 + 6xHis", 1.12,   2.4, RUST, "tag",               x(1.12) + 12, y(2.4) - 16, "start", 0),
    ]
    for name, rmsd, bid, col, tag, lx, ly, anc, lead in pts:
        cxp, cyp = x(rmsd), y(bid)
        if lead:
            b += (f'<line x1="{cxp:.1f}" y1="{cyp - 7:.1f}" x2="{lx:.1f}" y2="{ly + 16:.1f}" '
                  f'stroke="{col}" stroke-width="0.8" opacity="0.4"/>\n')
        b += f'<circle cx="{cxp:.1f}" cy="{cyp:.1f}" r="5.5" fill="{col}" opacity="0.92"/>\n'
        b += txt(lx, ly, name, 10, INK, anchor=anc, weight="600", font=MONO)
        if tag:
            b += txt(lx, ly + 12, tag, 9, col, anchor=anc, weight="700")
    b += wrap(L - 36, T + ph + 62,
              "The two steadiest runs in the set, by the number a construct would normally be "
              "ranked on, are the tagged construct and the only run that failed its gate. Contact "
              "count does better, Spearman +0.71 over the seven untagged runs, but on seven "
              "points. Named atom pairs do better than either.", W - 40, 10.5, INK, 15)
    svg("fig-decouple", W, H, b,
        "Conserved-window backbone RMSD against bidentate salt-bridge occupancy, eight runs",
        "A scatter of the eight peptide-bearing runs. The horizontal axis is backbone RMSD over "
        "the conserved window, the vertical axis is the share of frames holding the bidentate "
        "Arg487 salt bridge. The points do not line up: the tagged construct at 1.12 angstroms and "
        "the failed 9 to 23 run at pH 5.5 at 1.33 angstroms are the two lowest RMSDs in the set "
        "and hold the salt bridge in 2.4 and 6.9 per cent of frames, while the 15 to 23 control at "
        "1.81 angstroms holds it in 97.2 per cent.")


# ------------------------------------------------------------- 7. the apo floor
def fig_apo():
    """Changing the peptide moves the receptor more than removing it."""
    W, H = 700, 300
    runs = [
      ("apo, no peptide", 1.57, SLAT, True),
      ("1-23 + 6xHis",    1.59, SUB,  False),
      ("1-23",            1.58, SUB,  False),
      ("7-23",            1.63, SUB,  False),
      ("AtPEP1 7-23",     1.70, SUB,  False),
      ("9-23",            1.72, SUB,  False),
      ("1-23 pH 5.5",     1.87, SUB,  False),
      ("9-23 pH 5.5",     2.14, SUB,  False),
      ("15-23",           2.16, SUB,  False),
    ]
    L, T = 150, 76
    pw = W - L - 90
    xr = (1.45, 2.3)
    x = lambda v: L + (v - xr[0]) / (xr[1] - xr[0]) * pw
    b = ''
    b += txt(L - 130, 26, "Receptor C&#945; RMSD, all nine runs", 11.5, INK, weight="700")
    b += txt(L - 130, 42, "the receptor on its own is the steadiest trajectory in the set", 9.5, SUB)
    for i, (name, v, col, is_apo) in enumerate(runs):
        yy = T + i * 17
        b += txt(L - 12, yy + 4, name, 10, INK if is_apo else SUB, anchor="end",
                 weight="700" if is_apo else "400", font=MONO)
        b += f'<line x1="{L}" y1="{yy:.1f}" x2="{x(v):.1f}" y2="{yy:.1f}" stroke="{GRID}"/>\n'
        b += (f'<circle cx="{x(v):.1f}" cy="{yy:.1f}" r="{5 if is_apo else 3.6}" '
              f'fill="{SLAT if is_apo else AXIS}"/>\n')
        b += txt(x(v) + 10, yy + 4, f"{v:.2f}", 9.5, INK if is_apo else SUB, weight="700" if is_apo else "400", font=MONO)
    yb = T + len(runs) * 17 + 4
    b += (f'<line x1="{x(1.57):.1f}" y1="{T - 14}" x2="{x(1.57):.1f}" y2="{yb}" '
          f'stroke="{SLAT}" stroke-dasharray="3 4" opacity="0.6"/>\n')
    b += txt(x(1.57) - 8, yb + 14, "apo floor 1.57 &#8491;", 9.5, SLAT, anchor="middle", weight="700")
    b += wrap(L - 130, yb + 36,
              "0.59 &#8491; separates the bound runs from each other; 0.01 &#8491; separates the "
              "apo run from the steadiest of them. Changing the peptide moves the receptor more "
              "than removing it, so no receptor-side difference here is read as stabilisation.",
              W - 60, 10, SUB, 15)
    svg("fig-apo", W, H, b,
        "Receptor alpha-carbon RMSD across all nine runs, with the apo run as the floor",
        "Nine rows. The receptor simulated with no peptide at all has the lowest RMSD of the set at "
        "1.57 angstroms, one hundredth of an angstrom below the steadiest bound run. The bound runs "
        "spread over 0.59 angstroms among themselves. Changing the peptide moves the receptor more "
        "than removing it, so no receptor-side difference in this set is read as peptide-induced "
        "stabilisation.")


if __name__ == "__main__":
    fig_gate(); fig_tagtrace(); fig_ladder(); fig_perres()
    fig_phgrid(); fig_decouple(); fig_apo()
