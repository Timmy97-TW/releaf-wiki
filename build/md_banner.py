#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Project five real MD snapshots for the banner behind the page title.

    python3 build/md_banner.py

BoPep4 on PEPR1 in the middle, and one snapshot from each of the four things
the set varies at the corners: the AtPep1 control, a truncation, the 6xHis tag
and the protonated run. Every one is a real frame out of that run's own
trajectory, all five superposed on the receptor and drawn through one camera,
so the corners are the same picture with a different peptide in it.

Unlike the figures further down the page this is a molecular drawing rather than
a schematic: the peptide is drawn bond by bond from anim.bonds, coloured by
element, with the five receptor side chains of the clamp behind it and the
pocket surface stippled in. All of that is in the report payloads already,
because their own 3D players need it.

Writes md-simulations/data/banner.js.
"""

import base64
import io
import json
import os
import re

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "md-simulations")
OUT = os.path.join(DIR, "data", "banner.js")

# key -> (file, which limb of the map it stands for)
CAST = [
    ("WT",    "bopep4-wt-round1.html",           "centre"),
    ("REF",   "atpep1-benchmark-vs-bopep4.html", "control"),
    ("T923",  "bopep4-9-23-vs-wt.html",          "ladder"),
    ("CHIS",  "bopep4-chis-vs-wt.html",          "tag"),
    ("LOWPH", "bopep4-lowph-vs-wt.html",         "ph"),
]

NEAR = 16.0        # angstrom: receptor CA kept if this close to the peptide
BOX = (420.0, 250.0)
MIN_RUN = 4
SURF_MAX = 620     # stipple points on the centre panel, subsampled evenly


def payload(name):
    src = io.open(os.path.join(DIR, name), encoding="utf-8").read()
    d = json.loads(re.search(r'<script id="D" type="application/json">(.*?)</script>',
                             src, re.S).group(1))
    if "anim" in d:
        return d
    for v in d.values():
        if isinstance(v, dict) and "anim" in v:
            return v
    raise SystemExit("no coordinates in %s" % name)


def unpack(blob, scale, origin, n):
    raw = np.frombuffer(base64.b64decode(blob), dtype="<u2")
    return raw.reshape(n, -1, 3).astype(np.float64) * scale + np.asarray(origin)


def kabsch(mobile, target):
    mc, tc = mobile.mean(0), target.mean(0)
    u, _, vt = np.linalg.svd((mobile - mc).T @ (target - tc))
    d = np.sign(np.linalg.det(vt.T @ u.T))
    rot = vt.T @ np.diag([1.0, 1.0, d]) @ u.T
    return rot, tc - rot @ mc


def element(name):
    """First letter of a PDB atom name is its element, for protein atoms."""
    c = name[0]
    return c if c in "CNOS" else "C"


def main():
    data = {k: payload(f) for k, f, _ in CAST}
    anims = {k: d["anim"] for k, d in data.items()}

    # a frame two thirds of the way in, so nothing is still relaxing
    snap = {}
    for k, a in anims.items():
        xyz = unpack(a["data"], a["scale"], a["origin"], a["nframes"])
        snap[k] = xyz[int(a["nframes"] * 0.66)].copy()

    ref = "WT"
    n_ca = anims[ref]["n_ca"]
    for k in snap:
        if k == ref:
            continue
        rot, shift = kabsch(snap[k][:n_ca], snap[ref][:n_ca])
        snap[k] = (rot @ snap[k].T).T + shift

    # one camera: the peptide lies across, the receptor sits below it
    a0, s0 = anims[ref], snap[ref]
    pep0 = s0[n_ca:n_ca + a0["n_pep"]]
    centre = pep0.mean(0)
    _, _, vh = np.linalg.svd(pep0 - centre)
    e1 = vh[0]
    ca0 = s0[:n_ca]
    near = ca0[np.linalg.norm(ca0[:, None, :] - pep0[None, :, :], axis=-1).min(1) < NEAR]
    up = centre - near.mean(0)
    e2 = up - np.dot(up, e1) * e1
    e2 /= np.linalg.norm(e2)
    basis = np.vstack([e1, e2, np.cross(e1, e2)])
    cam = lambda p: (np.atleast_2d(p) - centre) @ basis.T

    # the same receptor residues in every panel, chosen once
    keep = np.flatnonzero(
        np.linalg.norm(ca0[:, None, :] - pep0[None, :, :], axis=-1).min(1) < NEAR)
    runs = []
    for i in keep[1:]:
        if runs and i == runs[-1][-1] + 1:
            runs[-1].append(int(i))
        else:
            runs.append([int(i)])
    runs = [r for r in runs if len(r) >= MIN_RUN]

    panels = []
    for key, _, limb in CAST:
        a, s = anims[key], snap[key]
        lo, hi = a["n_ca"], a["n_ca"] + a["n_pep"]

        pep_bonds = [(i, j) for i, j in a["bonds"] if lo <= i < hi and lo <= j < hi]
        clamp_bonds = [(i, j) for i, j in a["bonds"] if i >= hi and j >= hi]

        pts = cam(s)
        panels.append(dict(
            key=key, limb=limb,
            rec=[pts[r, :].tolist() for r in runs],
            pep=[[pts[i].tolist(), pts[j].tolist()] for i, j in pep_bonds],
            clamp=[[pts[i].tolist(), pts[j].tolist()] for i, j in clamp_bonds],
            atoms=[[pts[lo + n].tolist(), element(nm)]
                   for n, nm in enumerate(a["pep_name"])],
        ))

    # the pocket surface, on the centre panel only
    sf = data[ref]["surf"]
    sxyz = unpack(sf["xyz"], sf["scale"], sf["origin"], 1)[0]
    d = np.linalg.norm(sxyz[:, None, :] - pep0[None, :, :], axis=-1).min(1)
    pick = np.flatnonzero(d < 11.0)
    if pick.size > SURF_MAX:
        pick = pick[np.linspace(0, pick.size - 1, SURF_MAX).astype(int)]
    surf = cam(sxyz[pick, :])

    # one scale for all five, so a shorter peptide looks shorter. The receptor
    # fragments are ragged, so flatten rather than stack.
    rows = []
    for p in panels:
        for seg in p["rec"]:
            rows.extend(seg)
        rows.extend(xyz for xyz, _ in p["atoms"])
    every = np.asarray(rows, dtype=float)
    lo2, hi2 = every[:, :2].min(0), every[:, :2].max(0)
    k = min((BOX[0] - 16) / (hi2 - lo2)[0], (BOX[1] - 16) / (hi2 - lo2)[1])
    mid = (lo2 + hi2) / 2.0
    dlo, dhi = float(every[:, 2].min()), float(every[:, 2].max())

    def place(v):
        v = np.atleast_2d(np.asarray(v, dtype=float))
        return [[round(float(x), 1), round(float(y), 1), round(float(z), 3)] for x, y, z in
                zip(v[:, 0] * k + BOX[0] / 2.0,
                    BOX[1] / 2.0 - v[:, 1] * k,
                    (v[:, 2] - dlo) / (dhi - dlo or 1.0))]

    for p in panels:
        p["rec"] = [place(seg) for seg in p["rec"]]
        p["pep"] = [[place(b[0])[0], place(b[1])[0]] for b in p["pep"]]
        p["clamp"] = [[place(b[0])[0], place(b[1])[0]] for b in p["clamp"]]
        p["atoms"] = [[place(x)[0], e] for x, e in p["atoms"]]

    out = dict(box=dict(w=BOX[0], h=BOX[1]), near=NEAR,
               surf=place(surf), panels=panels)
    io.open(OUT, "w", encoding="utf-8").write(
        "/* =============================================================================\n"
        "   ReLeaf: the banner behind the MD Simulations title\n"
        "   ---------------------------------------------------------------------------\n"
        "   Written by build/md_banner.py. Five real frames -- BoPep4 wild type in the\n"
        "   middle, and the AtPep1 control, the 9-23 truncation, the 6xHis tag and the\n"
        "   pH 5.5 run at the corners -- superposed on the receptor and drawn through one\n"
        "   camera. Bonds come from anim.bonds, atoms carry their element, and `surf` is\n"
        "   the pocket surface of the wild-type system. Do not hand-edit.\n"
        "   ======================================================================== */\n\n"
        "const MD_BANNER = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")

    for p in panels:
        print("%-6s %-8s %3d receptor fragments, %3d peptide bonds, %3d atoms"
              % (p["key"], p["limb"], len(p["rec"]), len(p["pep"]), len(p["atoms"])))
    print("surface points on the centre panel: %d" % len(out["surf"]))
    print("wrote %s" % OUT)


if __name__ == "__main__":
    main()
