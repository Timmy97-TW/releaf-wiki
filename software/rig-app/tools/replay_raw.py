#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ReLeaf v5.0 - offline recomputation of raw data (replay_raw)
=============================================
Reads the raw data folder of one recording, recordings/<recording name>_raw/, and using the conversion constants in meta.json and the zeros / pH calibration
in effect at the time from events.csv, recomputes the pressure, flow and pH time series, one row per interval (default 1 s).

Uses:
  - re-examine the data with different intervals and statistics (e.g. 0.1 s to see the pump pulsation waveform, 60 s for long-term trends)
  - recompute with --offsets when conversion constants or zeros are later found to be wrong
  - verify the aggregate CSV written live by the App

Uses only the Python standard library (3.8+):

    python3 replay_raw.py recordings/record_20261014_154649_raw
    python3 replay_raw.py <raw folder> --interval 0.1 --start 10:00:00 --end 10:05:00 --out pulse.csv
    python3 replay_raw.py <raw folder> --interval 60 --offsets 0.2996,0.2496,0.0200

Output columns:
  epoch_s, time_local, n_p,
  feed_mean/peak/trough_bar, retentate_..., permeate_...,
  tmp_mean_bar, tmp_peak_bar, tmp_trough_bar ((F+R)/2 - P at the same instant), tmp_out_min_kpa (minimum of P_out - P_s at the same instant),
  flow_mlmin (total pulses in interval / time), flow_pulses, ph_v_mean, ph, temp_c, temp_src
"""

import argparse
import csv
import glob
import gzip
import io
import json
import math
import os
import sys
import time


def open_text(path):
    if path.endswith(".gz"):
        return io.TextIOWrapper(gzip.open(path, "rb"), encoding="utf-8", newline="")
    return open(path, "r", encoding="utf-8", newline="")


def stream_files(folder, stream):
    files = sorted(glob.glob(os.path.join(folder, f"{stream}_*.csv")) + glob.glob(os.path.join(folder, f"{stream}_*.csv.gz")),
                   key=lambda p: os.path.basename(p).split(".")[0])
    for p in files:
        try:
            with open_text(p) as f:
                for row in csv.DictReader(f):
                    yield row
        except (OSError, EOFError) as e:          # the last file may still be being written / incomplete after a power loss
            print(f"[warn] reading {os.path.basename(p)} interrupted: {e}", file=sys.stderr)


def load_events(folder):
    ev = []
    p = os.path.join(folder, "events.csv")
    if os.path.exists(p):
        with open(p, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                try:
                    ev.append((float(r["epoch_s"]), r["kind"], json.loads(r["detail_json"]) if r["detail_json"] else None))
                except (ValueError, KeyError):
                    pass
    return sorted(ev, key=lambda x: x[0])


def parse_clock(s, ref_epoch):
    """'HH:MM[:SS]' -> epoch on that day (using the date of ref_epoch); a number -> used directly as epoch."""
    if s is None:
        return None
    try:
        return float(s)
    except ValueError:
        pass
    parts = [int(x) for x in s.split(":")]
    while len(parts) < 3:
        parts.append(0)
    lt = time.localtime(ref_epoch)
    return time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, parts[0], parts[1], parts[2], 0, 0, -1))


class Timeline:
    """Apply setting changes from events in time order."""
    def __init__(self, events, kind, initial):
        self.points = [(t, d) for t, k, d in events if k == kind and d is not None]
        self.value = initial
        self.i = 0

    def at(self, t):
        while self.i < len(self.points) and self.points[self.i][0] <= t:
            self.value = self.points[self.i][1]
            self.i += 1
        return self.value


def main():
    ap = argparse.ArgumentParser(description="Rebuild pressure / flow / pH series from a ReLeaf raw folder.")
    ap.add_argument("raw_dir")
    ap.add_argument("--interval", type=float, default=1.0, help="output interval (s, default 1)")
    ap.add_argument("--start", help="start time HH:MM[:SS] or epoch")
    ap.add_argument("--end", help="end time HH:MM[:SS] or epoch")
    ap.add_argument("--offsets", help="force these pressure zero offsets (bar): feed,retentate,permeate; default: offsets in effect per events")
    ap.add_argument("--out", help="output CSV (default <raw folder>/replay_<interval>s.csv)")
    a = ap.parse_args()

    folder = a.raw_dir.rstrip("/")
    meta = json.load(open(os.path.join(folder, "meta.json"), encoding="utf-8"))
    mc = meta["mcu_config"]
    adc_max = float((1 << int(mc["adc_bits"])) - 1)
    k_bar = 1.0 / float(mc["ovs"]) / adc_max * float(mc["vref"]) / float(mc["div"]) / float(mc["vmax"]) * float(mc["barmax"])
    ppl = float(meta["flow"]["pulses_per_liter"])
    events = load_events(folder)
    if a.offsets:
        o = [float(x) for x in a.offsets.split(",")]
        off_tl = Timeline([], "", {"offsets_bar": {"feed": o[0], "retentate": o[1], "permeate": o[2]}})
    else:
        off_tl = Timeline(events, "pressure_offsets", {"offsets_bar": meta["pressure"]["offsets_bar"]})
    ph_tl = Timeline(events, "ph_config", dict(meta["ph"]))
    iv = a.interval

    bins = {}

    def b(t):
        k = math.floor(t / iv)
        x = bins.get(k)
        if x is None:
            x = bins[k] = {"n": 0, "s": [0.0, 0.0, 0.0], "mx": [-1e9] * 3, "mn": [1e9] * 3,
                           "tmp_s": 0.0, "tmp_mx": -1e9, "tmp_mn": 1e9, "to_mn": 1e9,
                           "pulses": 0, "win_ms": 0, "ph_v": [], "ph": [], "temp": [], "tsrc": ""}
        return x

    t_start = t_end = None
    first = None
    for r in stream_files(folder, "pressure"):
        t = float(r["epoch_s"])
        if first is None:
            first = t
            t_start = parse_clock(a.start, first)
            t_end = parse_clock(a.end, first)
        if (t_start and t < t_start) or (t_end and t > t_end):
            continue
        o = off_tl.at(t)["offsets_bar"]
        f = int(r["feed_sum"]) * k_bar - o["feed"]
        rr = int(r["retentate_sum"]) * k_bar - o["retentate"]
        p = int(r["permeate_sum"]) * k_bar - o["permeate"]
        x = b(t)
        x["n"] += 1
        for i, v in enumerate((f, rr, p)):
            x["s"][i] += v
            x["mx"][i] = max(x["mx"][i], v)
            x["mn"][i] = min(x["mn"][i], v)
        tmp = (f + rr) / 2.0 - p
        x["tmp_s"] += tmp
        x["tmp_mx"] = max(x["tmp_mx"], tmp)
        x["tmp_mn"] = min(x["tmp_mn"], tmp)
        x["to_mn"] = min(x["to_mn"], (rr - p) * 100.0)

    for r in stream_files(folder, "flow"):
        t = float(r["epoch_s"])
        if (t_start and t < t_start) or (t_end and t > t_end):
            continue
        x = b(t)
        x["pulses"] += int(r["pulses"])
        x["win_ms"] += int(r["window_ms"])

    for r in stream_files(folder, "aux"):
        t = float(r["epoch_s"])
        if (t_start and t < t_start) or (t_end and t > t_end):
            continue
        x = b(t)
        cfg = ph_tl.at(t)
        traw = r.get("t_raw16")
        try:
            tds = int(traw) / 16.0
            ds_ok = r.get("ds_state") == "ok" and 0 <= int(r.get("t_age_ms") or -1) <= 5000 and -10 < tds < 100 and tds != 85.0
        except ValueError:
            ds_ok = False
        temp = tds if ds_ok else float(cfg.get("temp", 37.0))
        x["temp"].append(temp)
        x["tsrc"] = "ds18b20" if ds_ok else "manual"
        for tok in (r.get("ph_samples") or "").split(";"):
            parts = tok.split(":")
            if len(parts) < 2 or not parts[1]:
                continue
            v = int(parts[0]) / int(parts[1]) / adc_max * float(mc["vref"])
            slope = (7.00 - 4.01) / (cfg["v7"] - cfg["v4"]) * (cfg["cal_temp"] + 273.15) / (temp + 273.15)
            x["ph_v"].append(v)
            x["ph"].append(7.00 + (v - cfg["v7"]) * slope)

    out = a.out or os.path.join(folder, f"replay_{iv:g}s.csv")
    cols = ["epoch_s", "time_local", "n_p"]
    for ch in ("feed", "retentate", "permeate"):
        cols += [f"{ch}_mean_bar", f"{ch}_peak_bar", f"{ch}_trough_bar"]
    cols += ["tmp_mean_bar", "tmp_peak_bar", "tmp_trough_bar", "tmp_out_min_kpa", "flow_mlmin", "flow_pulses",
             "ph_v_mean", "ph", "temp_c", "temp_src"]

    def fm(v, d=5):
        return "" if v is None else f"{v:.{d}f}"
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for k in sorted(bins):
            x = bins[k]
            t0 = k * iv
            row = [f"{t0:.3f}", time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t0)), x["n"]]
            for i in range(3):
                row += [fm(x["s"][i] / x["n"]) if x["n"] else "", fm(x["mx"][i]) if x["n"] else "",
                        fm(x["mn"][i]) if x["n"] else ""]
            row += [fm(x["tmp_s"] / x["n"]) if x["n"] else "", fm(x["tmp_mx"]) if x["n"] else "",
                    fm(x["tmp_mn"]) if x["n"] else "", fm(x["to_mn"], 3) if x["n"] else ""]
            row += [fm(x["pulses"] / (x["win_ms"] / 60000.0) / ppl * 1000.0, 3) if x["win_ms"] else "", x["pulses"]]
            row += [fm(sum(x["ph_v"]) / len(x["ph_v"])) if x["ph_v"] else "",
                    fm(sum(x["ph"]) / len(x["ph"]), 3) if x["ph"] else "",
                    fm(sum(x["temp"]) / len(x["temp"]), 2) if x["temp"] else "", x["tsrc"]]
            w.writerow(row)
    n_p = sum(x["n"] for x in bins.values())
    print(f"Folder: {folder}")
    print(f"{n_p} pressure samples, {len(bins)} rows written (every {iv:g} s) -> {out}")
    gaps = [(t, d) for t, k, d in events if k.endswith("_gap")]
    if gaps:
        print(f"Note: events.csv recorded {len(gaps)} data gaps (missed MCU pushes), see *_gap events")


if __name__ == "__main__":
    main()
