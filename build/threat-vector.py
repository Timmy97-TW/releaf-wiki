"""Build the sharp version of the 01 map: county outlines as vectors and one
high-resolution farmland mask, both on the 01 map's canvas (840 x 1267 units).

Run from the site root:
    python3 build/threat-vector.py
Needs numpy, scipy and Pillow.

Writes
    assets/data/threat-counties.js   window.THREAT_COUNTIES = [{name, d, vol, night, age}, ...]
                                     d is an SVG path in canvas units; vol is the
                                     volatility class 1-5 (Geospatial Analysis,
                                     Figure 6), night the night-temperature class
                                     1-5 (Figure 4), age the farmer-age class 1-3
                                     (Figure 5), as the light layers use them
    assets/img/home/threat-farmland-hi.webp
                                     farmland coverage as alpha, 3 x the canvas
                                     (2520 x 3801), from the team's 19 georeferenced
                                     county parcel rasters (geospatial-analysis/
                                     routing/raster_*.png, their alpha), placed by
                                     their lon/lat bounds
    python3 build/threat-vector.py --mask-only     only the mask

17 Oct (map, third pass): two fixes.
  THE MASK READ THE PALETTE INDEX. The routing rasters are palette images
  that keep their alpha in a transparency table, shuffled differently in each
  file; np.array(Image.open(...)) gave the index, so Hualien and Taitung came
  out almost empty (the east rift valley was missing) and Chiayi County and
  Pingtung at about two thirds. mask() now reads the true alpha
  (.convert("RGBA").getchannel("A")).
  THE OUTLINES STEPPED at the map's closer views. smooth() smooths every
  county outline on a shared topology: the rings are cut into arcs where the
  set of counties along them changes, each arc is smoothed once (a Gaussian
  of SIGMA units along its length, ends pinned) and simplified, and every ring
  is put back together from the same arcs, so neighbours stay sealed and a
  shared border still has the same vertices on both sides (home-threat.js
  tells coast from border by that).

THE CANVAS. The 01 map's canvas is linear in longitude and latitude (the fit in
home-threat.css's history, residual about 2 px):
    x = 336.3 * lon - 40180        y = -358.3 * lat + 9080
The county outlines (farm calculator, Geospatial Analysis) are fitted onto the
same canvas by build/threat_common.counties, whose affine this reuses.
"""
import importlib.util
import json
import re
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize
import threat_common as T

S = 3                                    # the mask's scale over the canvas
OUT_JS = "assets/data/threat-counties.js"
OUT_MASK = "assets/img/home/threat-farmland-hi.webp"
ROUTING = "geospatial-analysis/routing/"


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def county_affine(land):
    """the same fit as threat_common.counties: county outline union onto the canvas coast"""
    C = T._counties_json()
    K = 2
    im = Image.new("L", (640 * K, 860 * K), 0)
    dr = ImageDraw.Draw(im)
    for c in C:
        for r in T._rings(c["d"]):
            dr.polygon([(x * K, y * K) for x, y in r], fill=255)
    m = np.array(im) > 127
    lab, n = ndimage.label(m)
    main = ndimage.binary_fill_holes(lab == 1 + np.argmax(ndimage.sum(m, lab, range(1, n + 1))))
    labr, _ = ndimage.label(land > 127)
    mr = ndimage.binary_fill_holes(labr == labr[600, 500])
    dt = ndimage.distance_transform_edt(~(mr ^ ndimage.binary_erosion(mr)))
    fy, fx = np.nonzero(main ^ ndimage.binary_erosion(main))
    fx, fy = fx / K, fy / K
    b, br = ndimage.find_objects(main.astype(int))[0], ndimage.find_objects(mr.astype(int))[0]
    sx = (br[1].stop - br[1].start) / ((b[1].stop - b[1].start) / K)
    sy = (br[0].stop - br[0].start) / ((b[0].stop - b[0].start) / K)
    p0 = [sx, 0, br[1].start - b[1].start / K * sx, 0, sy, br[0].start - b[0].start / K * sy]

    def at(p):
        return ndimage.map_coordinates(dt, [p[3] * fx + p[4] * fy + p[5], p[0] * fx + p[1] * fy + p[2]],
                                       order=1, cval=50)

    p = optimize.minimize(lambda q: np.mean(np.minimum(at(q), 30) ** 2), p0, method="Powell",
                          options={"maxiter": 20000, "xtol": 1e-4, "ftol": 1e-6}).x
    print("county fit: coast residual median %.2f px" % np.median(at(p)))
    return C, p


def _best_shift(ref, tile, max_s=9):
    """integer (dx, dy) that best lays tile on ref (same size), by phase correlation"""
    a = ref - ref.mean(); b = tile - tile.mean()
    if not a.any() or not b.any():
        return 0, 0
    r = np.abs(np.fft.ifft2(np.fft.fft2(a) * np.conj(np.fft.fft2(b))))
    r = np.fft.fftshift(r)
    cy, cx = r.shape[0] // 2, r.shape[1] // 2
    win = r[cy - max_s:cy + max_s + 1, cx - max_s:cx + max_s + 1]
    y, x = np.unravel_index(win.argmax(), win.shape)
    return x - max_s, y - max_s


# small cities have too little farmland for the match to hold: they take the
# nudge of the county around or beside them
NUDGE_FROM = {"Keelung City": "New Taipei City", "Chiayi City": "Chiayi County",
              "Hsinchu City": "Hsinchu County"}


def mask():
    """Each county raster is placed by its lon/lat bounds, then nudged onto the
    canvas's own farmland (threat_common.canvas, the team's QGIS layers, which
    sit on the same coast as the county outlines): the rasters are in TWD97
    TM2 and the canvas is linear in lon/lat, so a straight placement drifts by
    up to 5 canvas px across the island. The nudge is found per county."""
    meta = json.load(open(ROUTING + "county_meta.json"))
    land, _, farm = T.canvas()
    W, H = 840 * S, 1267 * S
    out = np.zeros((H, W), np.float32)
    PAD = 12
    nudges = {}
    order = sorted(meta, key=lambda k: k in NUDGE_FROM)      # the small cities last
    for name in order:
        m = meta[name]
        b = m["raster_bounds"]
        # the true alpha, not the palette index (see the 17 Oct note above)
        a = np.array(Image.open(ROUTING + m["raster_file"].replace(".webp", ".png"))
                     .convert("RGBA").getchannel("A")).astype(np.float32)
        x0 = (336.3 * b["west"] - 40180) * S
        x1 = (336.3 * b["east"] - 40180) * S
        y0 = (-358.3 * b["north"] + 9080) * S
        y1 = (-358.3 * b["south"] + 9080) * S
        X0, Y0, X1, Y1 = int(np.floor(x0)), int(np.floor(y0)), int(np.ceil(x1)), int(np.ceil(y1))
        t = np.array(Image.fromarray(a).resize((X1 - X0, Y1 - Y0), Image.BOX))
        # find the nudge at canvas scale, on a padded window
        cx0, cy0 = X0 // S - PAD, Y0 // S - PAD
        cw, ch = (X1 - X0) // S + 2 * PAD, (Y1 - Y0) // S + 2 * PAD
        win_ref = np.zeros((ch, cw)); win_t = np.zeros((ch, cw))
        ys, xs = max(0, cy0), max(0, cx0)
        ye, xe = min(1267, cy0 + ch), min(840, cx0 + cw)
        win_ref[ys - cy0:ye - cy0, xs - cx0:xe - cx0] = farm[ys:ye, xs:xe]
        small = np.array(Image.fromarray(t).resize(((X1 - X0) // S, (Y1 - Y0) // S), Image.BOX)) / 255.0
        win_t[PAD:PAD + small.shape[0], PAD:PAD + small.shape[1]] = small[:ch - PAD, :cw - PAD]
        dx, dy = nudges[NUDGE_FROM[name]] if name in NUDGE_FROM else _best_shift(win_ref, win_t)
        nudges[name] = (dx, dy)
        X0 += dx * S; X1 += dx * S; Y0 += dy * S; Y1 += dy * S
        ya, yb = max(0, Y0), min(H, Y1)
        xa, xb = max(0, X0), min(W, X1)
        out[ya:yb, xa:xb] = np.maximum(out[ya:yb, xa:xb], t[ya - Y0:yb - Y0, xa - X0:xb - X0])
        print("  %-16s nudged %+d, %+d canvas px" % (name, dx, dy))
    # keep farmland on land: the canvas's own land, scaled up and slightly widened
    landhi = np.array(Image.fromarray(land.astype(np.uint8)).resize((W, H), Image.BILINEAR)) > 60
    out *= landhi
    a = np.clip(out * 1.6, 0, 255).astype(np.uint8)        # the box filter thins the parcels; lift them back
    rgba = np.dstack([np.full((H, W), 255, np.uint8)] * 3 + [a])
    Image.fromarray(rgba, "RGBA").save(OUT_MASK, "WEBP", lossless=True, method=6)
    print("wrote", OUT_MASK, (W, H), "farmland px", int((a > 64).sum()))


SIGMA = 1.1        # outline smoothing, canvas units (1 unit is about 300 m)
STEP = 0.3         # resampling step before smoothing, units
TOL = 0.08         # simplification after smoothing, units


def _rdp(P, tol):
    """Ramer-Douglas-Peucker on an open polyline (n x 2), ends kept"""
    if len(P) < 3:
        return P
    keep = np.zeros(len(P), bool); keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = P[i], P[j]
        ab = b - a; L = np.hypot(*ab)
        seg = P[i + 1:j] - a
        d = np.abs(ab[0] * seg[:, 1] - ab[1] * seg[:, 0]) / L if L > 1e-9 else np.hypot(seg[:, 0], seg[:, 1])
        k = int(np.argmax(d))
        if d[k] > tol:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return P[keep]


def _resample(P, closed):
    Q = np.vstack([P, P[:1]]) if closed else P
    seg = np.hypot(*np.diff(Q, axis=0).T)
    t = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(np.ceil(t[-1] / STEP)) + 1)
    u = np.linspace(0, t[-1], n)
    R = np.column_stack([np.interp(u, t, Q[:, 0]), np.interp(u, t, Q[:, 1])])
    return R[:-1] if closed else R


def _smooth_arc(P, closed):
    """smooth one arc: resample, Gaussian along its length, simplify. An open
    arc keeps its two ends exactly (odd reflection about each end)."""
    if len(P) < 3:
        return P
    R = _resample(P, closed)
    sd = SIGMA / STEP
    if closed:
        if len(R) < 8:
            return P
        S_ = np.column_stack([ndimage.gaussian_filter1d(R[:, k], sd, mode="wrap") for k in (0, 1)])
        # simplify a ring as two open halves, so it keeps a fixed start
        h = len(S_) // 2
        A = _rdp(np.vstack([S_[:h + 1]]), TOL); B = _rdp(np.vstack([S_[h:], S_[:1]]), TOL)
        return np.vstack([A, B[1:-1]])
    pad = min(len(R) - 1, int(4 * sd) + 1)
    head = 2 * R[0] - R[pad:0:-1]
    tail = 2 * R[-1] - R[-2:-2 - pad:-1]
    X = np.vstack([head, R, tail])
    S_ = np.column_stack([ndimage.gaussian_filter1d(X[:, k], sd, mode="nearest") for k in (0, 1)])[pad:pad + len(R)]
    S_[0], S_[-1] = P[0], P[-1]
    return _rdp(S_, TOL)


def smooth(county_rings):
    """county_rings: per county, a list of rings (lists of (x, y)). Returns the
    same structure, smoothed on the shared topology (see the note at the top)."""
    key = lambda q: (round(q[0], 2), round(q[1], 2))
    rings, where = [], []
    for ci, rs in enumerate(county_rings):
        for r in rs:
            ks, pts = [], []
            for q in r:
                k = key(q)
                if ks and ks[-1] == k:
                    continue
                ks.append(k); pts.append(q)
            if len(ks) > 1 and ks[0] == ks[-1]:
                ks.pop(); pts.pop()
            if len(ks) > 2:
                rings.append((ks, pts)); where.append(ci)
    owners, nbrs = {}, {}
    for ri, (ks, _) in enumerate(rings):
        for i in range(len(ks)):
            a, b = ks[i], ks[(i + 1) % len(ks)]
            e = (a, b) if a < b else (b, a)
            owners.setdefault(e, set()).add(where[ri])
            nbrs.setdefault(a, set()).add(e); nbrs.setdefault(b, set()).add(e)

    def junction(k):
        es = nbrs[k]
        if len(es) != 2:
            return True
        e1, e2 = es
        return owners[e1] != owners[e2]

    done = {}
    out = [[] for _ in county_rings]
    for ri, (ks, pts) in enumerate(rings):
        P = np.array(pts, float)
        J = [i for i, k in enumerate(ks) if junction(k)]
        area = np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1])
        if not J:
            # a closed arc: smooth it once in a canonical rotation and direction
            i0 = min(range(len(ks)), key=lambda i: ks[i])
            fwd = ks[i0:] + ks[:i0]
            rev = [fwd[0]] + fwd[:0:-1]
            canon = tuple(min(fwd, rev))
            if canon not in done:
                order = [ks.index(k) for k in canon]
                done[canon] = _smooth_arc(P[order], True)
            Q = done[canon]
            a2 = np.sum(Q[:, 0] * np.roll(Q[:, 1], -1) - np.roll(Q[:, 0], -1) * Q[:, 1])
            out[where[ri]].append(Q if (a2 > 0) == (area > 0) else Q[::-1])
            continue
        n = len(ks)
        ring = []
        for j in range(len(J)):
            i, i2 = J[j], J[(j + 1) % len(J)]
            idx = list(range(i, (i2 if i2 > i else i2 + n) + 1))
            arc = tuple(ks[t % n] for t in idx)
            canon = min(arc, arc[::-1])
            if canon not in done:
                src = P[[t % n for t in idx]] if canon == arc else P[[t % n for t in idx]][::-1]
                done[canon] = _smooth_arc(src, False)
            Q = done[canon] if canon == arc else done[canon][::-1]
            ring.append(Q[:-1])
        out[where[ri]].append(np.vstack(ring))
    print("smooth: %d rings, %d arcs" % (len(rings), len(done)))
    return out


def _d(rings):
    """SVG path of rings, at 0.1 unit, without repeated vertices"""
    parts = []
    for r in rings:
        pts = []
        for x, y in r:
            q = "%.1f,%.1f" % (x, y)
            if not pts or pts[-1] != q:
                pts.append(q)
        while len(pts) > 1 and pts[0] == pts[-1]:
            pts.pop()
        if len(pts) > 2:
            parts.append("M" + "L".join(pts) + "Z")
    return "".join(parts)


def counties():
    nights = load("build/threat-nights.py", "threat_nights")
    age = load("build/threat-age.py", "threat_age")
    land, _, _ = T.canvas()
    v = np.array(Image.open(T.VOLATILITY).convert("RGBA")).astype(float)
    vol_cls = np.sqrt(((v[..., None, :3] - T.VOL[None, None]) ** 2).sum(-1)).argmin(-1) + 1
    C, p = county_affine(land)
    placed = [[[(p[0] * x + p[1] * y + p[2], p[3] * x + p[4] * y + p[5]) for x, y in r]
               for r in T._rings(c["d"])] for c in C]
    soft = smooth(placed)
    rows = []
    for c, pts, sm in zip(C, placed, soft):
        d = _d(sm)
        # its volatility class: the most common class of the light map inside it
        im = Image.new("L", (840, 1267), 0)
        dr = ImageDraw.Draw(im)
        for r in pts:
            if len(r) > 2:
                dr.polygon(r, fill=255)
        inside = (np.array(im) > 127) & (land > 127)
        vc = int(np.bincount(vol_cls[inside].ravel(), minlength=6).argmax()) if inside.any() else 1
        en = c["nameEn"]
        rows.append({"name": en, "d": d, "vol": vc,
                     "night": nights.NIGHTS.get(en, 1),
                     "age": age.LABELS.index(age.AGE[en]) + 1 if en in age.AGE else 1})
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("/* The 01 map's counties on its 840 x 1267 canvas, made by build/threat-vector.py.\n"
                "   vol: volatility class 1-5 (Figure 6); night: night-temperature class 1-5 (Figure 4);\n"
                "   age: farmer-age class 1-3 (Figure 5). Do not edit by hand. */\n")
        f.write("window.THREAT_COUNTIES = " + json.dumps(rows, ensure_ascii=False) + ";\n")
    print("wrote", OUT_JS, len(rows), "counties",
          sum(len(r["d"]) for r in rows) // 1024, "kB of paths")


if __name__ == "__main__":
    import sys
    if "--mask-only" not in sys.argv:
        counties()
    mask()
