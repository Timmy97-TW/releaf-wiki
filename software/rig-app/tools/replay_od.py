#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ReLeaf v5.1 - offline rerun of raw OD600 readings (replay_od, ported from replay.py of inline photometer v1.2.0)
==============================================================================================
Reads recordings/<recording name>_raw/od_raw.csv produced by a recording, reruns all algorithms and the Hampel filter on the same raw readings, writes a per-measurement comparison table,
and prints a statistical summary for each method. Algorithms are shared with the App via ../python/photometer_algos.py, so results match the live computation.

Uses only the Python standard library (3.8+):

    python3 replay_od.py recordings/record_20261014_154649_raw/od_raw.csv
    python3 replay_od.py run_raw.csv --reference 0.80 --threshold 0.05     # known true OD (e.g. a standard)
    python3 replay_od.py run_raw.csv --mode single --plf 5 --out compare.csv
    python3 replay_od.py run_raw.csv --blank-s 812.4 --blank-r 433.7        # supply manually when the raw file has no blank
    python3 replay_od.py run_raw.csv --gate                                 # add the v5.1 OD gate layer (default thresholds)
    python3 replay_od.py run_raw.csv --gate --gate-jump-abs 0.08 --gate-confirm-n 4   # recompute with different thresholds

The v5.1 OD gate layer (od_gate.py) sits after the estimators: discrepancy gate (|od - od_p90|), jump gate (compared with the last accepted value),
a new level is accepted only after N consecutive consistent readings, and the median of the last few accepted values is reported. With --gate, the output gains three columns for the primary algorithm,
gate_reason / gate_accepted / gate_reported, so the same raw data can be rerun with different thresholds for out-of-sample validation
(the thresholds used at recording time are stored in meta.json under od600.gate; that is the pre-registration).

Location: this file is in tools/, the algorithm module is python/photometer_algos.py (in the same App folder).
If replay.py is copied elsewhere on its own, putting photometer_algos.py in the same folder also works.

Notes:
  - One measurement may have two attempts (the MCU retries on read failure or stuck readings); each algorithm picks independently: valid first, then by rejection rate.
  - blank defaults to the raw readings of the most recent blank calibration before this measurement (blank_measure=1); each algorithm uses the blank it computes itself.
  - A re-measurement requested by the App because the primary algorithm's rejection rate > 50% appears in the raw file as a new measurement (new meas_seq).
"""

import argparse
import csv
import math
import os
import statistics
import sys

_here = os.path.dirname(os.path.abspath(__file__))
for p in (_here, os.path.join(_here, "..", "python")):
    if os.path.exists(os.path.join(p, "photometer_algos.py")):
        sys.path.insert(0, p)
        break
import photometer_algos as PA  # noqa: E402

try:
    import od_gate as OG              # v5.1: OD gate layer (shared with main.py)
except ImportError:
    OG = None

N_DARK, N_LIT = 4, 16


def load_raw(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                rows.append({
                    "epoch": float(r["epoch_s"]), "seq": int(r["meas_seq"]), "att": int(r["attempt"]),
                    "final": r.get("final", "1") == "1",
                    "hw_ok": r.get("hw_ok", "1") == "1",
                    "blank": int(r.get("blank_measure", "0") or 0) == 1,
                    "lpc": float(r["lux_per_count"]), "ref_mode": int(r["ref_mode"]),
                    "ds": [float(r[f"dark_s_{i}"]) for i in range(N_DARK)],
                    "dr": [float(r[f"dark_r_{i}"]) for i in range(N_DARK)],
                    "ls": [float(r[f"lit_s_{i}"]) for i in range(N_LIT)],
                    "lr": [float(r[f"lit_r_{i}"]) for i in range(N_LIT)],
                })
            except (KeyError, ValueError) as e:
                print(f"[skip] unparseable row: {e}", file=sys.stderr)
    return rows


def group_measurements(rows):
    """Group in time order; follow-up attempts (att > 0) with the same seq are merged into the previous group. seq restarts after an MCU restart, so seq alone is not enough."""
    groups = []
    for r in sorted(rows, key=lambda x: x["epoch"]):
        if groups and groups[-1][0]["seq"] == r["seq"] and r["att"] > 0:
            groups[-1].append(r)
        else:
            groups.append([r])
    return groups


def main():
    ap = argparse.ArgumentParser(description="Replay photometer raw readings with all algorithms.")
    ap.add_argument("raw_csv")
    ap.add_argument("--plf", type=float, default=5.0, help="path length factor (default 5.0)")
    ap.add_argument("--mode", choices=["auto", "dual", "single"], default="auto",
                    help="auto = each measurement uses its own recorded ref_mode (correct even if the optical path changed mid-recording)")
    ap.add_argument("--blank-s", type=float, help="manual sample lux when the raw file has no blank")
    ap.add_argument("--blank-r", type=float, help="manual reference lux when the raw file has no blank (dual path)")
    ap.add_argument("--reference", type=float, help="known true OD (standard experiment), for bias/RMSE/silent failure")
    ap.add_argument("--threshold", type=float, default=0.05, help="OD error above which a reading counts as failed (default 0.05)")
    ap.add_argument("--hampel-window", type=int, default=7)
    ap.add_argument("--hampel-k", type=float, default=3.0)
    ap.add_argument("--out", help="output per-reading comparison CSV (default <raw>_replay.csv)")
    ap.add_argument("--gate", action="store_true", help="apply the v5.1 gate layer (to the algorithm given by --gate-alg)")
    ap.add_argument("--gate-alg", default="mad", help="algorithm the gate layer uses as main estimator (default mad)")
    for _k, _t in (("disc-abs", float), ("disc-rel", float), ("jump-abs", float), ("jump-rel", float),
                   ("confirm-n", int), ("report-median-n", int), ("stale-n", int)):
        ap.add_argument(f"--gate-{_k}", type=_t, help=f"gate threshold {_k.replace('-', '_')} (default if omitted)")
    a = ap.parse_args()

    rows = load_raw(a.raw_csv)
    if not rows:
        sys.exit("raw file has no data")
    groups = group_measurements(rows)
    forced = None if a.mode == "auto" else (a.mode == "single")
    names = PA.ALG_NAMES
    manual = {"s": a.blank_s or 0.0, "r": a.blank_r or 0.0} if (a.blank_s or a.blank_r) else None
    blanks = {n: manual for n in names}

    table = []
    for g in groups:
        is_blank = g[0]["blank"]
        single = forced if forced is not None else (g[-1]["ref_mode"] == 1)
        row = {"epoch": g[0]["epoch"], "seq": g[0]["seq"], "attempts": len(g), "blank_measure": int(is_blank),
               "mode": "single" if single else "dual"}
        for n in names:
            res = PA.measurement_result(g, n, single)
            if is_blank:
                blanks[n] = {"s": res["S"], "r": res["R"]}
                od = 0.0
            else:
                dual, sing = PA.od_values(res, blanks[n], a.plf)
                od = sing if single else dual
            row[f"od_{n}"] = od
            row[f"rej_{n}"] = res["rej"]
            row[f"bad_{n}"] = int(not res["ok"])
        table.append(row)

    # ---- v5.1: OD gate layer (same od_gate.py as the App, so verdicts are guaranteed identical) ----
    gate_cols = []
    if a.gate:
        if OG is None:
            sys.exit("od_gate.py not found (put it in python/ or next to this script)")
        if a.gate_alg not in names:
            sys.exit(f"--gate-alg must be one of {'/'.join(names)}")
        # By default use the thresholds written into meta.json at recording time (pre-registration), then overlay values given on the command line.
        # So 'no arguments' = exactly reproduce the original verdicts, 'arguments given' = explicit out-of-sample recomputation.
        cfg, cfg_src = {}, "od_gate.py built-in defaults"
        meta_p = os.path.join(os.path.dirname(os.path.abspath(a.raw_csv)), "meta.json")
        if os.path.exists(meta_p):
            try:
                import json as _json
                mg = ((_json.load(open(meta_p, encoding="utf-8")).get("od600") or {}).get("gate") or {})
                for k in ("disc_abs", "disc_rel", "jump_abs", "jump_rel", "confirm_n", "report_median_n", "stale_n"):
                    if mg.get(k) is not None:
                        cfg[k] = mg[k]
                if cfg:
                    cfg_src = "pre-registered thresholds in meta.json"
            except (ValueError, OSError) as e:
                print(f"[warn] cannot read thresholds from {meta_p} ({e}), using built-in defaults")
        over = []
        for k in ("disc_abs", "disc_rel", "jump_abs", "jump_rel", "confirm_n", "report_median_n", "stale_n"):
            v = getattr(a, "gate_" + k, None)
            if v is not None:
                cfg[k] = v
                over.append(k)
        if over:
            cfg_src += " + command-line overrides (" + ", ".join(over) + ")"
        gate = OG.ODGate(cfg)
        for r in table:
            if r["blank_measure"]:
                continue
            od = r.get(f"od_{a.gate_alg}")
            res = gate.feed(od, r.get("od_p90"), not r.get(f"bad_{a.gate_alg}"), r.get("epoch"))
            r["gate_reason"] = res["reason"]
            r["gate_accepted"] = int(bool(res["accepted"]))
            r["gate_reported"] = res["reported"]
        gate_cols = ["gate_reason", "gate_accepted", "gate_reported"]
        print(f"Gate layer: main estimator {a.gate_alg}, thresholds from = {cfg_src}")
        print("        " + ", ".join(f"{k}={v}" for k, v in gate.config().items() if k != "version")
              + f" ({gate.config()['version']})")

    data_rows = [r for r in table if not r["blank_measure"]]
    for n in names:
        filt = PA.hampel([r[f"od_{n}"] for r in data_rows], a.hampel_window, a.hampel_k)
        for r, v in zip(data_rows, filt):
            r[f"od_{n}_hampel"] = v

    out = a.out or a.raw_csv.rsplit(".", 1)[0] + "_replay.csv"
    cols = ["epoch", "seq", "attempts", "blank_measure", "mode"] + [f"{p}_{n}" for n in names for p in ("od", "rej", "bad")] \
        + [f"od_{n}_hampel" for n in names] + gate_cols
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in table:
            w.writerow({k: ("" if r.get(k) is None else (f"{r[k]:.5f}" if isinstance(r.get(k), float) else r.get(k)))
                        for k in cols})

    n_blank = sum(r["blank_measure"] for r in table)
    print(f"File: {a.raw_csv}")
    modes = sorted({r["mode"] for r in data_rows})
    print(f"Mode: {'/'.join('single path' if m == 'single' else 'dual path' for m in modes) or '-'}"
          f"{' (per measurement record)' if forced is None else ' (forced)'}  path length factor: {a.plf}  measurements: {len(data_rows)}  blanks: {n_blank}"
          + ("" if n_blank or manual else "  ⚠️ no blank, OD cannot be computed (set with --blank-s / --blank-r)"))
    if a.reference is not None:
        print(f"Reference OD = {a.reference}, failure threshold |error| > {a.threshold}")
    print()
    hdr = f"{'method':<18}{'n':>5}{'mean':>10}{'SD':>9}{'invalid%':>10}"
    if a.reference is not None:
        hdr += f"{'bias':>9}{'RMSE':>9}{'fail%':>8}{'silent%':>9}"
    print(hdr)
    print("-" * len(hdr))
    for n in names:
        for suffix in ("", "_hampel"):
            vals = [(r[f"od_{n}{suffix}"], r[f"bad_{n}"]) for r in data_rows if r.get(f"od_{n}{suffix}") is not None]
            if not vals:
                continue
            ods = [v[0] for v in vals]
            line = (f"{n + suffix:<18}{len(ods):>5}{statistics.fmean(ods):>10.4f}"
                    f"{(statistics.stdev(ods) if len(ods) > 1 else 0):>9.4f}{100 * sum(v[1] for v in vals) / len(vals):>10.1f}")
            if a.reference is not None:
                err = [o - a.reference for o in ods]
                fail = [abs(e) > a.threshold for e in err]
                silent = [f and not bad for f, (_, bad) in zip(fail, vals)]     # wrong yet judged valid
                line += (f"{statistics.fmean(err):>9.4f}{math.sqrt(statistics.fmean([e * e for e in err])):>9.4f}"
                         f"{100 * sum(fail) / len(fail):>8.1f}{100 * sum(silent) / len(silent):>9.1f}")
            print(line)
    print(f"\nPer-reading comparison written to: {out}")


if __name__ == "__main__":
    main()
