"""Rebuild assets/img/measurement/od600-silica-window.svg.

The Measurement page's photometer chapter states three fits of the 10 October
silica run restricted to the 0 to 1 OD window, and had no picture of them. This
draws that window: nine points per instrument (the stored blank at the origin
and 2.5 to 20 mg SiO2 in 2.5 mg steps) with each instrument's least-squares line.

Numbers come straight from the "10_10 Photometer Calibration" workbook, column C
for mass, F for the BioDrop's direct channel, H for the Pro and I for the Slim.
Fitting those nine points reproduces the page's table exactly, which is the check
that this figure and that table are the same calculation:
    BioDrop  y = 0.0489x + 0.0151   R2 0.9956
    Pro      y = 0.0458x - 0.0636   R2 0.9874
    Slim     y = 0.0086x + 0.0081   R2 0.9947
Style follows od600-silica-ladder.svg: 640x430, the page's own series colours,
#e5e5e5 gridlines, labels in #6b6b6b and #525252, legend in the right margin.

    python3 build/od600_silica_window.py assets/img/measurement
"""
import pathlib, sys

MASS = [0.0, 2.5, 5.0, 7.5, 10.0, 12.5, 15.0, 17.5, 20.0]
SERIES = [
    ("BioDrop, direct", "#92610c",
     [0.0, 0.145, 0.264, 0.377, 0.499, 0.621, 0.801, 0.861, 0.966]),
    ("Pro, beam splitter", "#3f5468",
     [0.0, 0.0505, 0.146, 0.2524, 0.346, 0.4833, 0.6254, 0.7615, 0.8885]),
    ("Slim, fibre", "#23684a",
     [0.0, 0.0306, 0.0542, 0.0757, 0.0982, 0.1205, 0.1353, 0.1552, 0.1774]),
]

W, H = 640, 430
L, R, T, B = 62.0, 470.0, 44.0, 348.0          # the plot frame, as on the ladder
XMAX, YMAX = 20.0, 1.0


def fit(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    a = my - b * mx
    ss = sum((y - my) ** 2 for y in ys)
    rs = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys))
    return b, a, 1 - rs / ss


def px(x):
    return L + (R - L) * x / XMAX


def py(y):
    return B - (B - T) * y / YMAX


def main(out_dir):
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" '
         f'height="{H}" role="img" font-family="Inter, -apple-system, \'Segoe UI\', '
         f'Helvetica, Arial, sans-serif">']
    s.append('<title>The three instruments against the silica mass standard, '
             'inside the 0 to 1 OD window</title>')
    s.append('<desc>Optical density at 600 nm against milligrams of silica added, for the '
             'nine points of the 10 October 2026 run that fall inside the BioDrop’s own '
             'specified range. The BioDrop and the Pro climb on almost the same slope, 0.0489 '
             'and 0.0458 OD per milligram, with the Pro about 0.12 OD below the reference at '
             'every point. The Slim climbs at 0.0086, roughly a fifth as steep, and is as '
             'straight as either.</desc>')
    s.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')

    for gy in (0, 0.25, 0.5, 0.75, 1.0):
        y = py(gy)
        s.append(f'<line x1="{L}" y1="{y:.1f}" x2="{R}" y2="{y:.1f}" stroke="#e5e5e5" stroke-width="1"/>')
        s.append(f'<text x="{L-8:.1f}" y="{y+4:.1f}" font-size="11" fill="#6b6b6b" '
                 f'text-anchor="end" font-weight="400">{gy:g}</text>')
    for gx in (0, 5, 10, 15, 20):
        s.append(f'<text x="{px(gx):.1f}" y="{B+17:.0f}" font-size="11" fill="#6b6b6b" '
                 f'text-anchor="middle" font-weight="400">{gx}</text>')
    s.append(f'<line x1="{L}" y1="{B}" x2="{R}" y2="{B}" stroke="#cfcfcf" stroke-width="1"/>')

    fits = {}
    for name, colour, ys in SERIES:
        b, a, r2 = fit(MASS, ys)
        fits[name.split(",")[0]] = (b, a, r2)
        # a fit line is only drawn where it is inside the frame: the Pro's
        # intercept is negative, and the part below zero means nothing
        x0 = max(0.0, -a / b) if b else 0.0
        s.append(f'<line x1="{px(x0):.1f}" y1="{py(a + b * x0):.1f}" x2="{px(XMAX):.1f}" '
                 f'y2="{py(a + b * XMAX):.1f}" stroke="{colour}" stroke-width="1.5"/>')
        for x, y in zip(MASS, ys):
            s.append(f'<circle cx="{px(x):.1f}" cy="{py(y):.1f}" r="2.8" fill="{colour}"/>')

    # the gap between the reference and the Pro, which is the chapter's open item
    bb, ab, _ = fits["BioDrop"]
    bp, ap, _ = fits["Pro"]
    xg = 16.0
    y1, y2 = py(ab + bb * xg), py(ap + bp * xg)
    s.append(f'<line x1="{px(xg):.1f}" y1="{y1:.1f}" x2="{px(xg):.1f}" y2="{y2:.1f}" '
             f'stroke="#8a8a8a" stroke-width="1"/>')
    for yy in (y1, y2):
        s.append(f'<line x1="{px(xg)-3.5:.1f}" y1="{yy:.1f}" x2="{px(xg)+3.5:.1f}" '
                 f'y2="{yy:.1f}" stroke="#8a8a8a" stroke-width="1"/>')
    s.append(f'<text x="{px(xg)+8:.1f}" y="{(y1+y2)/2+4:.1f}" font-size="11" fill="#525252" '
             f'text-anchor="start" font-weight="400">0.12 OD</text>')

    s.append(f'<text x="{(L+R)/2:.1f}" y="{B+38:.0f}" font-size="12" fill="#525252" '
             f'text-anchor="middle" font-weight="400">Silica added (mg into 500 mL)</text>')
    s.append(f'<text x="16" y="196" font-size="12" fill="#525252" text-anchor="middle" '
             f'transform="rotate(-90 16 196)">Optical density at 600 nm</text>')

    ly = 65
    for name, colour, _ in SERIES:
        s.append(f'<rect x="492" y="{ly}" width="11" height="3" rx="1.5" fill="{colour}"/>')
        s.append(f'<text x="509" y="{ly+6}" font-size="11" fill="#525252" text-anchor="start" '
                 f'font-weight="400">{name}</text>')
        ly += 17

    s.append('<text x="492" y="156" font-size="12" fill="#3f5468" text-anchor="start" '
             'font-weight="600">1.001×</text>')
    for i, line in enumerate(("the Pro read against", "the BioDrop here, low", "by a constant 0.12 OD")):
        s.append(f'<text x="492" y="{172+i*13}" font-size="10.5" fill="#6b6b6b" '
                 f'text-anchor="start" font-weight="400">{line}</text>')
    s.append('<text x="492" y="237" font-size="12" fill="#23684a" text-anchor="start" '
             'font-weight="600">5.3×</text>')
    for i, line in enumerate(("the Pro’s slope against", "the Slim’s, which buys", "the Slim its range")):
        s.append(f'<text x="492" y="{253+i*13}" font-size="10.5" fill="#6b6b6b" '
                 f'text-anchor="start" font-weight="400">{line}</text>')

    s.append('</svg>')
    p = pathlib.Path(out_dir) / "od600-silica-window.svg"
    p.write_text("".join(s) + "\n", encoding="utf-8")
    for k, (b, a, r2) in fits.items():
        print(f"{k:8} y = {b:.4f}x {a:+.4f}  R2 {r2:.4f}")
    print(p, p.stat().st_size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets/img/measurement")
