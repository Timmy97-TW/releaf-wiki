#!/usr/bin/env python3
"""
Compact trajectory payloads for the Molecular Dynamics page.

The nine per-run reports under /md-simulations/ each ship a 3.5 MB JSON whose
`anim` block is 300 frames of every receptor Ca plus every peptide and clamp
heavy atom. Timmy asked for the key animations to play on the Protein Design
Molecular Dynamics page itself, so this script writes one small file per run
that the page can fetch when a reader asks for it.

Two things make it small, and the apo control is what licenses the first:
  1. the receptor barely moves (apo Ca RMSD 1.57 A against 1.58 to 2.16 A
     bound, and the bound runs differ from each other by more than the apo
     run differs from the steadiest of them), so the 710 receptor Ca are
     stored once as the trajectory mean rather than per frame;
  2. frames are taken every third one, 300 -> 100, which at 11 fps is a nine
     second loop over the same 30 ns.

Atom indexing is unchanged from the report, so the renderer on the page is the
one in the reports: [0, nCa) receptor Ca, [nCa, nCa+nPep) peptide heavy atoms,
[nCa+nPep, natoms) the four clamp partners. Positions for the first block come
from `rec`, the rest from the frame in `mob`.

Run:  python3 build/md_page_anim.py
Out:  assets/data/md-anim/<key>.json
"""
import base64, json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(HERE, "md-simulations", "data")
OUT  = os.path.join(HERE, "assets", "data", "md-anim")

STRIDE   = 3      # 300 source frames -> 100
SURF_MAX = 2600   # surface dots kept, farthest-point thinned by stride

# key -> (source report, what the page calls it, the one-line reading)
RUNS = {
  "wt": ("bopep4-wt-round1",
         "BoPEP4 1-23, pH 7",
         "The reference. Asn23 holds Arg487 in every frame."),
  "chis": ("bopep4-chis-vs-wt",
           "BoPEP4 1-23 + 6xHis, pH 7",
           "The tag stays in the groove and the carboxylate leaves: 11.65 A at closest approach."),
  "lowph": ("bopep4-lowph-vs-wt",
            "BoPEP4 1-23, pH 5.5",
            "Protonation puts Glu12 on His227 without loosening the C-terminal clamp."),
  "t923l": ("bopep4-9-23-lowph",
            "BoPEP4 9-23, pH 5.5",
            "The only run that failed its gate: His22 folds back onto the peptide's own C-terminus."),
}


def b64u16(a):
    return base64.b64encode(np.asarray(a, dtype="<u2").tobytes()).decode("ascii")


def build(key, stem):
    with open(os.path.join(SRC, stem + ".json")) as fh:
        D = json.load(fh)
    A, S = D["anim"], D["surf"]
    nCa, nPep, nCl = A["n_ca"], A["n_pep"], A["n_clamp"]
    NP, NF = A["natoms"], A["nframes"]

    q = np.frombuffer(base64.b64decode(A["data"]), dtype="<u2").astype(np.float64)
    xyz = q.reshape(NF, NP, 3) * A["scale"] + np.array(A["origin"])

    keep = list(range(0, NF, STRIDE))
    rec  = xyz[:, :nCa, :].mean(axis=0)            # receptor: one mean frame
    mob  = xyz[np.ix_(keep, range(nCa, NP))]       # peptide + clamp, per frame

    # one quantisation grid for both, so the page can decode with one scale
    allp = np.concatenate([rec.reshape(-1, 3), mob.reshape(-1, 3)])
    origin = allp.min(axis=0)
    scale  = float((allp.max(axis=0) - origin).max() / 65000.0)
    enc = lambda P: b64u16(np.rint((P - origin) / scale).clip(0, 65535).reshape(-1))

    si = list(range(0, S["n"], max(1, S["n"] // SURF_MAX)))
    sq = np.frombuffer(base64.b64decode(S["xyz"]), dtype="<u2").astype(np.float64)
    sxyz = (sq.reshape(S["n"], 3) * S["scale"] + np.array(S["origin"]))[si]
    chem = np.frombuffer(base64.b64decode(S["chem"]), dtype=np.uint8)[si]
    foot = np.frombuffer(base64.b64decode(S["foot"]), dtype=np.uint8)[si]

    label, read = RUNS[key][1], RUNS[key][2]
    out = {
      "key": key, "system": D["system"], "label": label, "reading": read,
      "nframes": len(keep), "nCa": nCa, "nPep": nPep, "nClamp": nCl,
      "natoms": NP, "scale": scale, "origin": [float(v) for v in origin],
      "frameNs": [round(A["frame_ns"][i], 3) for i in keep],
      "rec": enc(rec), "mob": enc(mob),
      "trace": A["trace"], "bonds": A["bonds"],
      "pepRes": A["pep_res"], "pepName": A["pep_name"], "clampRes": A["clamp_res"],
      "asn23": A["asn23_i"], "arg487": A["arg487_i"],
      "surf": {"n": len(si), "xyz": enc(sxyz),
               "chem": base64.b64encode(chem.tobytes()).decode("ascii"),
               "foot": base64.b64encode(foot.tobytes()).decode("ascii")},
      "clamp": [round(float(v), 3) for v in D["clamp"][::max(1, len(D["clamp"]) // len(keep))][:len(keep)]],
    }
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, key + ".json")
    with open(p, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"{key:7} {os.path.getsize(p)/1024:7.0f} KB  {len(keep)} frames, "
          f"{nPep+nCl} mobile atoms, {len(si)} surface dots")


if __name__ == "__main__":
    for k, (stem, *_rest) in RUNS.items():
        build(k, stem)
