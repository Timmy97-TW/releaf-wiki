#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pull two real frames out of two trajectories and project them for the page.

    python3 build/md_hero_frames.py

The landing figure on md-simulations/index.html is not a drawing of a peptide.
It is BoPep4 wild type and BoPep4 + C-terminal 6xHis, both taken out of the
trajectory data embedded in their own report files, superposed on the receptor
and projected through one shared camera so the two panels differ only where the
simulations differ.

What it does:

  1. decodes anim.data, which is uint16 coordinates plus a scale and an origin,
     the same array the report's 3D player reads;
  2. picks the frame whose Asn23-Arg487 distance is closest to that run's own
     median, so neither panel is a lucky frame;
  3. superposes the second run's receptor onto the first with Kabsch, so the
     peptides can be compared and not just looked at;
  4. builds one camera from the wild-type frame and points it at the Asn23
     -Arg487 site, because that is the contact the whole page turns on: the
     C-terminal stretch runs across, the salt bridge stands up, and the rest of
     the peptide runs out of frame to the left, which the SVG clips;
  5. keeps the same receptor residues in both panels, so a difference on the
     page is a difference in the physics;
  6. reads the Asn23 oxygens straight off the atom list. The wild type ends
     C, O, OXT and both of those oxygens sit on Arg487 in every frame. The
     tagged construct ends C, O: its OXT has moved to His29, because the
     carboxylate went into the amide bond. One oxygen cannot be bidentate, and
     that is the whole of the 100% against 2.4%.

Writes md-simulations/data/hero.js.
"""

import base64
import io
import json
import os
import re

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "md-simulations")
OUT = os.path.join(DIR, "data", "hero.js")

PAIR = [
    ("WT",   "bopep4-wt-round1.html"),
    ("CHIS", "bopep4-chis-vs-wt.html"),
]

NEAR = 15.0          # angstrom: receptor CA kept if this close to the peptide
BOX = (320.0, 215.0)  # the drawing box each panel is fitted into
WINDOW = 31.0        # angstrom across the box; the C-terminal site, not the whole run
MIN_RUN = 3          # receptor fragments shorter than this read as lint, not backbone


def payload(name):
    src = io.open(os.path.join(DIR, name), encoding="utf-8").read()
    m = re.search(r'<script id="D" type="application/json">(.*?)</script>', src, re.S)
    return json.loads(m.group(1))


def frames(anim):
    raw = np.frombuffer(base64.b64decode(anim["data"]), dtype="<u2")
    xyz = raw.reshape(anim["nframes"], anim["natoms"], 3).astype(np.float64)
    return xyz * anim["scale"] + np.asarray(anim["origin"], dtype=np.float64)


def pair_distance(xyz, anim):
    """Closest approach between the Asn23 terminal oxygens and the Arg487 guanidinium."""
    a = xyz[:, anim["asn23_i"], :]
    r = xyz[:, anim["arg487_i"], :]
    return np.linalg.norm(a[:, :, None, :] - r[:, None, :, :], axis=-1).min(axis=(1, 2))


def typical_frame(dist):
    return int(np.argmin(np.abs(dist - np.median(dist))))


def kabsch(mobile, target):
    """Rotation and translation putting `mobile` onto `target`."""
    mc, tc = mobile.mean(0), target.mean(0)
    h = (mobile - mc).T @ (target - tc)
    u, _, vt = np.linalg.svd(h)
    d = np.sign(np.linalg.det(vt.T @ u.T))
    rot = vt.T @ np.diag([1.0, 1.0, d]) @ u.T
    return rot, tc - rot @ mc


def backbone(anim, xyz):
    """Peptide N-CA-C path, and the residue each point belongs to."""
    off = anim["n_ca"]
    pts, res = [], []
    for i, (nm, rs) in enumerate(zip(anim["pep_name"], anim["pep_res"])):
        if nm in ("N", "CA", "C"):
            pts.append(xyz[off + i])
            res.append(int(rs))
    return np.asarray(pts), res


def main():
    data = {k: payload(f) for k, f in PAIR}
    anims = {k: d["anim"] for k, d in data.items()}
    traj = {k: frames(a) for k, a in anims.items()}
    dist = {k: pair_distance(traj[k], anims[k]) for k in anims}
    pick = {k: typical_frame(dist[k]) for k in dist}

    ref = PAIR[0][0]
    snap = {k: traj[k][pick[k]].copy() for k in traj}

    # 2. superpose every other run's receptor onto the reference receptor
    n_ca = anims[ref]["n_ca"]
    for k in snap:
        if k == ref:
            continue
        rot, shift = kabsch(snap[k][:n_ca], snap[ref][:n_ca])
        snap[k] = (rot @ snap[k].T).T + shift

    # 3. one camera, built from the reference frame and aimed at the contact
    pep_ref, res_ref = backbone(anims[ref], snap[ref])
    asn_ref = snap[ref][anims[ref]["asn23_i"], :].mean(0)
    arg_ref = snap[ref][anims[ref]["arg487_i"], :].mean(0)
    centre = (asn_ref + arg_ref) / 2.0

    tailmask = np.asarray(res_ref) >= 13            # the C-terminal stretch
    tail = pep_ref[tailmask]
    _, _, vh = np.linalg.svd(tail - tail.mean(0))
    e1 = vh[0]
    up = arg_ref - asn_ref                          # the salt bridge stands up
    e2 = up - np.dot(up, e1) * e1
    e2 /= np.linalg.norm(e2)
    e3 = np.cross(e1, e2)
    basis = np.vstack([e1, e2, e3])

    def cam(p):
        return (np.atleast_2d(p) - centre) @ basis.T

    # 4. the receptor residues to draw, chosen once on the reference and reused
    ca_ref = snap[ref][:n_ca]
    d = np.linalg.norm(ca_ref[:, None, :] - pep_ref[None, :, :], axis=-1).min(1)
    keep = np.flatnonzero(d < NEAR)

    panels = []
    for key, _ in PAIR:
        a, s = anims[key], snap[key]
        pep, res = backbone(a, s)
        runs = []
        run = [int(keep[0])]
        for i in keep[1:]:                       # break the trace at chain jumps
            if i == run[-1] + 1:
                run.append(int(i))
            else:
                runs.append(run)
                run = [int(i)]
        runs.append(run)
        # one bond per Asn23 oxygen, to whichever Arg487 atom it is nearest in
        # this frame. The wild type has two oxygens to draw from; the tagged
        # construct has one, and that is the figure's argument.
        bonds = []
        for oi in a["asn23_i"]:
            dd = np.linalg.norm(s[a["arg487_i"], :] - s[oi], axis=1)
            j = int(np.argmin(dd))
            bonds.append(dict(o=oi, r=a["arg487_i"][j], d=round(float(dd[j]), 2)))

        panels.append(dict(
            key=key, frameNs=round(a["frame_ns"][pick[key]], 2),
            d=round(float(dist[key][pick[key]]), 2),
            median=round(float(np.median(dist[key])), 2),
            nPepRes=data[key]["n_peptide_res"],
            nOxy=len(a["asn23_i"]),
            oxyNames=[a["pep_name"][i - a["n_ca"]] for i in a["asn23_i"]],
            lastAtoms=[n for n, r in zip(a["pep_name"], a["pep_res"])
                       if r == 22][-3:],
            rec=[cam(s[r, :]).tolist() for r in runs],
            pep=cam(pep).tolist(), pepRes=res,
            asn=cam(s[a["asn23_i"], :]).tolist(),
            arg=cam(s[a["arg487_i"], :]).tolist(),
            bonds=[dict(a=cam(s[b["o"]])[0].tolist(), b=cam(s[b["r"]])[0].tolist(),
                        d=b["d"]) for b in bonds],
        ))

    # 5. one scale for both panels, so the comparison is not a trick of framing.
    #    The window is fixed in angstrom rather than fitted to the content, so
    #    neither panel can be quietly zoomed to flatter itself.
    k = BOX[0] / WINDOW
    every = np.vstack([np.asarray(p["pep"]) for p in panels] +
                      [np.asarray(seg) for p in panels for seg in p["rec"]])
    depth = every[:, 2]
    dlo, dhi = float(depth.min()), float(depth.max())

    # centre the box on what the figure is about, not on the sprawl of receptor
    # fragments, so neither panel is mostly empty
    focus = np.vstack([np.asarray(p["pep"])[-24:] for p in panels] +
                      [np.asarray(p["asn"]) for p in panels] +
                      [np.asarray(p["arg"]) for p in panels])
    yc = float(focus[:, 1].mean())

    def place(v):
        v = np.atleast_2d(np.asarray(v, dtype=float))
        x = v[:, 0] * k + BOX[0] / 2.0
        y = BOX[1] / 2.0 - (v[:, 1] - yc) * k
        z = (v[:, 2] - dlo) / (dhi - dlo or 1.0)          # 0 far, 1 near
        return [[round(a, 1), round(b, 1), round(c, 3)]
                for a, b, c in zip(x, y, z)]

    def visible(seg):
        """Split a receptor fragment where it leaves the box, and drop the crumbs."""
        out, run = [], []
        pad = 26.0
        for q in seg:
            if -pad <= q[0] <= BOX[0] + pad and -pad <= q[1] <= BOX[1] + pad:
                run.append(q)
            else:
                if len(run) >= MIN_RUN:
                    out.append(run)
                run = []
        if len(run) >= MIN_RUN:
            out.append(run)
        return out

    for p in panels:
        p["rec"] = [t for seg in p["rec"] for t in visible(place(seg))]
        p["pep"] = place(p["pep"])
        p["asn"] = place(p["asn"])
        p["arg"] = place(p["arg"])
        p["bonds"] = [dict(a=place(b["a"])[0], b=place(b["b"])[0], d=b["d"])
                      for b in p["bonds"]]

    out = dict(box=dict(w=BOX[0], h=BOX[1]), near=NEAR, window=WINDOW,
               nRec=int(keep.size), panels=panels)
    io.open(OUT, "w", encoding="utf-8").write(
        "/* =============================================================================\n"
        "   ReLeaf: two real frames, one camera\n"
        "   ---------------------------------------------------------------------------\n"
        "   Written by build/md_hero_frames.py out of the trajectory arrays embedded in\n"
        "   bopep4-wt-round1.html and bopep4-chis-vs-wt.html. Both frames are the one\n"
        "   closest to their own run's median Asn23-Arg487 distance, the receptors are\n"
        "   superposed, and the same %d receptor residues are drawn from the same angle\n"
        "   in both panels. Coordinates are already projected: x, y, and a 0-1 depth.\n"
        "   Do not hand-edit.\n"
        "   ======================================================================== */\n\n"
        "const MD_HERO = " % keep.size
        + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")

    for p in panels:
        print("%-5s frame %5.2f ns   Asn23-Arg487 %.2f A   Asn23 ends %s   "
              "%d oxygen(s), %d bond(s) drawn"
              % (p["key"], p["frameNs"], p["d"], ",".join(p["lastAtoms"]),
                 p["nOxy"], len(p["bonds"])))
    print("receptor residues within %.0f A of the peptide: %d" % (NEAR, keep.size))
    print("window %.0f A across; fragments drawn per panel: %s"
          % (WINDOW, [len(p["rec"]) for p in panels]))
    print("wrote %s" % OUT)


if __name__ == "__main__":
    main()
