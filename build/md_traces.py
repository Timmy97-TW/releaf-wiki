#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pull the Asn23-Arg487 distance out of every trajectory, frame by frame.

    python3 build/md_traces.py

The overview quotes occupancies: 100%, 46.9%, 2.4%, 6.9%. A percentage hides
whether a contact was steady or flickering, and for two of these runs that is
the whole difference. So this reads the same coordinate arrays the report
players read, measures the closest approach between the Asn23 oxygens and the
Arg487 side chain in each of the 300 saved frames, and writes the traces out for
the page to plot.

Writes md-simulations/data/traces.js.
"""

import base64
import io
import json
import os
import re

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "md-simulations")
OUT = os.path.join(DIR, "data", "traces.js")

CUT = 3.5     # angstrom, the same cutoff the reports use for the salt bridge


def payload(name):
    """The one JSON block each report carries, unwrapped.

    Most reports put the run at the top level. The AtPep1 page is a two-system
    comparison and nests them under A and B, and only the one with coordinates
    is of any use here.
    """
    src = io.open(os.path.join(DIR, name), encoding="utf-8").read()
    m = re.search(r'<script id="D" type="application/json">(.*?)</script>', src, re.S)
    d = json.loads(m.group(1))
    if "anim" in d:
        return d
    for v in d.values():
        if isinstance(v, dict) and "anim" in v:
            return v
    raise SystemExit("no coordinates in %s" % name)


def contact_atoms(anim):
    """Indices of the Asn23 oxygens and of the arginine that clamps them.

    The later builders write asn23_i and arg487_i into the payload; the earliest
    one did not, so fall back to the atom names. The Asn23 oxygens are O and OXT
    on the last mature residue, and the clamping arginine is the last residue in
    the clamp block -- numbered 459 there, because the topology starts at
    residue 29 and the paper counts from 1.
    """
    if "asn23_i" in anim and "arg487_i" in anim:
        return anim["asn23_i"], anim["arg487_i"]

    last = max(anim["pep_res"])
    asn = [anim["n_ca"] + i for i, (nm, rs) in
           enumerate(zip(anim["pep_name"], anim["pep_res"]))
           if rs == last and nm in ("O", "OXT")]

    base = anim["n_ca"] + anim["n_pep"]
    tail = anim["clamp_res"][-1]
    arg = [base + i for i, r in enumerate(anim["clamp_res"]) if r == tail]
    return asn, arg


def main():
    runs = json.loads(
        re.search(r"const MD_SET = (.*);\s*$",
                  io.open(os.path.join(DIR, "data", "runs.js"), encoding="utf-8").read(),
                  re.S).group(1))["runs"]

    out = {}
    for r in runs:
        if r["apo"]:
            continue
        d = payload(r["href"])
        a = d["anim"]
        xyz = (np.frombuffer(base64.b64decode(a["data"]), dtype="<u2")
               .reshape(a["nframes"], a["natoms"], 3).astype(np.float64)
               * a["scale"] + np.asarray(a["origin"]))
        ai, ri = contact_atoms(a)
        p = xyz[:, ai, :]
        q = xyz[:, ri, :]
        dist = np.linalg.norm(p[:, :, None, :] - q[:, None, :, :], axis=-1).min(axis=(1, 2))

        # how many separate times the contact opens and closes again, which is
        # what "flickering" means and what an occupancy cannot say
        closed = dist < CUT
        breaks = int(np.sum((~closed[1:]) & closed[:-1]))

        out[r["key"]] = dict(
            t=[round(float(v), 2) for v in a["frame_ns"]],
            d=[round(float(v), 2) for v in dist],
            occ=round(float(100.0 * closed.mean()), 1),
            breaks=breaks,
            nOxy=len(ai),
        )
        print("%-6s %3d frames  mean %.2f A  within %.1f A in %5.1f%% of frames  "
              "opened %d times" % (r["key"], len(dist), dist.mean(), CUT,
                                   out[r["key"]]["occ"], breaks))

    io.open(OUT, "w", encoding="utf-8").write(
        "/* =============================================================================\n"
        "   ReLeaf: the Asn23-Arg487 distance, frame by frame\n"
        "   ---------------------------------------------------------------------------\n"
        "   Written by build/md_traces.py, measured off the coordinate arrays embedded in\n"
        "   the eight peptide-bearing report files. `d` is the closest approach between\n"
        "   the Asn23 oxygens and the Arg487 side chain in each saved frame, in angstrom;\n"
        "   `occ` is the fraction of frames under %.1f A and `breaks` is how many separate\n"
        "   times that contact reopened. Do not hand-edit.\n"
        "   ======================================================================== */\n\n"
        "const MD_TRACE = " % CUT
        + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("wrote %s" % OUT)


if __name__ == "__main__":
    main()
