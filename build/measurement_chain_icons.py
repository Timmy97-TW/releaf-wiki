"""Rebuild the five chain illustrations on the Measurement page overview.

    python3 build/measurement_chain_icons.py assets/img/measurement

Five flat drawings, 120x120, one per family of measurement.

They replace five cropped photographs that were dark, unevenly lit and unreadable
at the size the chain draws them. Each is the real apparatus, not a generic icon:
the vessel with its loop through the in-line flow cell, the reading before and
after the firmware's arithmetic, the light plate on its driver box, Arabidopsis
stood on an agar plate, and a protein gel.
"""
import math, random, pathlib, sys

OUT = pathlib.Path(sys.argv[1])

def head(label, bg):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" '
            f'aria-label="{label}">\n'
            f'<rect width="120" height="120" rx="15" fill="{bg}"/>\n')

def bioreactor():
    D, M, L, BG, TUBE = "#1b4f73", "#4a8fbe", "#cfe2ee", "#ecf3f9", "#9cc2da"
    s = head("A bioreactor vessel whose loop runs out through an in-line flow cell, "
             "where a lamp reads the culture as it passes.", BG)
    s += (f'<path d="M104 76 C116 76 116 44 102 42 H56 C51 42 47 38 47 33" fill="none" '
          f'stroke="{TUBE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>\n')
    s += f'<path d="M47 78 H70" fill="none" stroke="{TUBE}" stroke-width="5" stroke-linecap="round"/>\n'
    s += (f'<path d="M80 38.5 l-4.5 3.5 4.5 3.5" fill="none" stroke="{M}" stroke-width="2.2" '
          f'stroke-linecap="round" stroke-linejoin="round"/>\n')
    s += f'<rect x="15" y="33" width="33" height="58" rx="10" fill="#ffffff" stroke="{D}" stroke-width="2.4"/>\n'
    s += f'<path d="M18 62 h27 v21 a5.5 5.5 0 0 1 -5.5 5.5 h-16 a5.5 5.5 0 0 1 -5.5 -5.5 z" fill="{L}"/>\n'
    s += (f'<path d="M18 62 c3.4 -3.4 6.8 3.4 10.2 0 s6.8 -3.4 10.2 0 6 2.4 6.6 0" fill="none" '
          f'stroke="{M}" stroke-width="2" stroke-linecap="round"/>\n')
    s += '<circle cx="26" cy="73" r="2.3" fill="#ffffff" opacity=".9"/>\n'
    s += '<circle cx="35" cy="80" r="1.7" fill="#ffffff" opacity=".9"/>\n'
    s += '<circle cx="29" cy="84" r="1.3" fill="#ffffff" opacity=".9"/>\n'
    s += f'<rect x="19" y="25" width="25" height="9" rx="3.5" fill="{M}"/>\n'
    s += f'<rect x="66" y="59" width="40" height="33" rx="8" fill="#ffffff" stroke="{D}" stroke-width="2.4"/>\n'
    s += f'<rect x="81" y="63.5" width="10" height="24" rx="3" fill="{L}" stroke="{M}" stroke-width="1.6"/>\n'
    s += '<path d="M74 75.5 H98" stroke="#e8a92b" stroke-width="2.6" stroke-linecap="round"/>\n'
    s += '<circle cx="73" cy="75.5" r="4.4" fill="#f5bf4c" stroke="#c6880f" stroke-width="1.5"/>\n'
    s += f'<rect x="97.5" y="70.5" width="5.5" height="10" rx="2" fill="{D}"/>\n'
    return s + '</svg>\n'

def algorithm():
    D, G, BG = "#2f3f4e", "#9fabb5", "#eef2f6"
    s = head("A density reading on screen: the raw counts as points, the curve the "
             "firmware reduces them to, and a shaded window where the gate held a "
             "reading back.", BG)
    s += f'<rect x="12" y="24" width="96" height="76" rx="9" fill="#ffffff" stroke="{D}" stroke-width="2.4"/>\n'
    s += '<path d="M12 37 H108" stroke="#dde3e9" stroke-width="1.6"/>\n'
    for cx in (21.5, 28.5, 35.5):
        s += f'<circle cx="{cx}" cy="30.5" r="2" fill="#ccd4da"/>\n'
    cx, cy, r1, r2, w = 98, 30.5, 2.6, 4.6, 0.46
    d = []
    for i in range(7):
        a0 = i * 2 * math.pi / 7
        for rr, aa in ((r2, a0 - w), (r2, a0 + w), (r1, a0 + w + 0.3),
                       (r1, a0 + 2 * math.pi / 7 - w - 0.3)):
            d.append(f"{cx + rr*math.cos(aa):.1f} {cy + rr*math.sin(aa):.1f}")
    s += '<path d="M' + d[0] + ' L' + " L".join(d[1:]) + ' Z" fill="#ccd4da"/>\n'
    s += f'<circle cx="{cx}" cy="{cy}" r="1.5" fill="#ffffff"/>\n'
    s += '<rect x="71" y="44" width="21" height="44" fill="#f0dcae" opacity=".8"/>\n'
    s += '<path d="M71 44 V88 M92 44 V88" stroke="#d8b76e" stroke-width="1.2" stroke-dasharray="3 3"/>\n'
    s += '<path d="M24 88 H100 M24 88 V44" stroke="#cdd5db" stroke-width="1.8" stroke-linecap="round"/>\n'

    def curve(x):
        return 84 - 34 / (1 + math.exp(-(x - 52) / 8.5))

    random.seed(5)
    pts, x = [], 28.0
    while x <= 97.0:
        n = random.gauss(0, 1.9)
        if 71 <= x <= 92:
            n += random.gauss(0, 5.4)
        pts.append((x, min(max(curve(x) + n, 47.0), 85.5)))
        x += 3.1
    sm = " L".join(f"{x:.1f} {curve(x):.1f}" for x in [26 + i * 3.7 for i in range(21)])
    s += f'<path d="M{sm}" fill="none" stroke="{D}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>\n'
    cand = sorted([q for q in pts if 72 < q[0] < 91], key=lambda q: q[1])
    spikes = cand[:1]
    for q in cand[1:]:
        if abs(q[0] - spikes[0][0]) > 8:
            spikes.append(q)
            break
    for a, b in pts:
        if (a, b) in spikes:
            continue
        s += f'<circle cx="{a:.1f}" cy="{b:.1f}" r="2" fill="#ffffff" stroke="{G}" stroke-width="1.6"/>\n'
    for a, b in spikes:
        s += (f'<path d="M{a-3.3:.1f} {b-3.3:.1f} l6.6 6.6 M{a+3.3:.1f} {b-3.3:.1f} l-6.6 6.6" '
              f'stroke="#a24c33" stroke-width="2" stroke-linecap="round"/>\n')
    return s + '</svg>\n'

def light():
    BG = "#faf3e6"
    s = head("The light plate apparatus: a well plate of red and green lit wells "
             "sitting on its black driver box.", BG)
    for dx, ln in ((-25, 5), (0, 8), (25, 5)):
        s += (f'<path d="M{60+dx} {19 - ln} V19" stroke="#c9972f" stroke-width="2.4" '
              f'stroke-linecap="round" opacity=".55"/>\n')
    s += '<rect x="15" y="58" width="90" height="43" rx="9" fill="#3c434b"/>\n'
    s += '<rect x="15" y="58" width="90" height="10" rx="5" fill="#4b535c"/>\n'
    s += '<rect x="80" y="87" width="18" height="5" rx="2.5" fill="#5c656f"/>\n'
    s += '<circle cx="24" cy="92" r="2" fill="#c9972f"/>\n'
    s += '<rect x="23" y="24" width="74" height="54" rx="7" fill="#ffffff" stroke="#bfb9ac" stroke-width="2.2"/>\n'
    s += '<rect x="27" y="28" width="66" height="46" rx="5" fill="#f7f6f3"/>\n'
    red, grn = "#cf5b43", "#55a179"
    for r, row in enumerate(("grgrgg", "rggrgr", "grrgrg", "rgrggr")):
        for c, ch in enumerate(row):
            cx, cy = 34 + c * 10.4, 36 + r * 10.4
            fill = red if ch == "r" else grn
            s += f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="4.6" fill="{fill}" opacity=".2"/>\n'
            s += f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="3.3" fill="{fill}"/>\n'
    return s + '</svg>\n'

def plant():
    D, M, BG = "#1b5138", "#4f9c6f", "#ecf5f0"
    s = head("An agar plate of Arabidopsis seedlings stood on end, one root "
             "measured down the plate.", BG)
    s += '<rect x="16" y="19" width="88" height="82" rx="11" fill="#ffffff" stroke="#9fb0a5" stroke-width="2.2"/>\n'
    s += '<rect x="21" y="24" width="78" height="72" rx="7" fill="#e9f4ee"/>\n'
    for x, k in ((35, 1.0), (60, 1.18), (85, .8)):
        tip = min(42 + 42 * k, 90)
        s += (f'<path d="M{x} 43 C{x-3.6} {42+9*k:.0f} {x+3.6} {42+17*k:.0f} {x} {42+26*k:.0f} '
              f'C{x-3} {42+33*k:.0f} {x+2.2} {tip-5:.0f} {x-0.8} {tip:.0f}" fill="none" '
              f'stroke="{D}" stroke-width="2.1" stroke-linecap="round"/>\n')
        for f, side in ((0.36, -1), (0.62, 1), (0.84, -1)):
            yy = 42 + 26 * k * f
            s += (f'<path d="M{x} {yy:.1f} q{3.2*side} 1.4 {5.4*side} 4.4" fill="none" '
                  f'stroke="{M}" stroke-width="1.5" stroke-linecap="round"/>\n')
        s += f'<path d="M{x} 43 V36.5" stroke="{D}" stroke-width="2.1" stroke-linecap="round"/>\n'
        for side in (-1, 1):
            s += (f'<ellipse cx="{x+4.7*side}" cy="33.5" rx="4.7" ry="3" '
                  f'transform="rotate({18*side} {x+4.7*side} 33.5)" fill="{M}" stroke="{D}" stroke-width="1.5"/>\n')
    s += ('<path d="M70.5 43 V91 M67 43 H74 M67 91 H74" fill="none" stroke="#8ba496" '
          'stroke-width="1.4" stroke-dasharray="3.5 3"/>\n')
    return s + '</svg>\n'

def protein():
    D, M, BG = "#5e2d4f", "#9a5b85", "#f7edf3"
    s = head("A protein gel: a ladder lane beside four sample lanes, with the band "
             "of the expected size picked out across them.", BG)
    s += '<rect x="15" y="20" width="90" height="80" rx="9" fill="#ffffff" stroke="#6b3a5c" stroke-width="2.3"/>\n'
    s += '<rect x="19" y="24" width="82" height="72" rx="6" fill="#f7eef4"/>\n'
    lanes = [27, 42, 57, 72, 87]
    for i, cx in enumerate(lanes):
        s += f'<rect x="{cx-6}" y="28" width="12" height="3.4" rx="1.4" fill="#4a2440" opacity=".65"/>\n'
        if i:
            s += f'<path d="M{cx-7.5} 36 V92" stroke="#e3cedd" stroke-width="1"/>\n'
    for y, a in ((41, .8), (50, .62), (59, .8), (68, .5), (77, .62), (86, .42)):
        s += f'<rect x="{lanes[0]-5.5}" y="{y}" width="11" height="3" rx="1.5" fill="{M}" opacity="{a:.2f}"/>\n'
    bands = {1: ((59, 1.0), (44, .5), (79, .38)),
             2: ((59, .8), (72, .45)),
             3: ((59, .45), (47, .34), (84, .28)),
             4: ((59, .95), (66, .4), (41, .32))}
    for i, bb in bands.items():
        for y, a in bb:
            hit = abs(y - 59) < 0.5
            h = 4.2 if hit else 3
            s += (f'<rect x="{lanes[i]-6.5}" y="{y}" width="13" height="{h}" rx="{h/2}" '
                  f'fill="{D if hit else M}" opacity="{a:.2f}"/>\n')
    s += f'<path d="M19 58 H101" stroke="{D}" stroke-width="1.2" stroke-dasharray="3 4" opacity=".5"/>\n'
    return s + '</svg>\n'

for name, fn in (("bioreactor", bioreactor), ("algorithm", algorithm), ("light", light),
                 ("plant", plant), ("protein", protein)):
    p = OUT / f"chain-{name}.svg"
    p.write_text(fn(), encoding="utf-8")
    print(p.name, p.stat().st_size)
