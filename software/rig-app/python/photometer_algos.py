# -*- coding: utf-8 -*-
"""
Inline Photometer - algorithms (computed entirely on the Linux side since v1.2.0)
=========================================================
Shared by main.py (live) and tools/replay.py (offline rerun), so both are guaranteed to give identical results.
Uses only the Python standard library.

Raw readings of one attempt (MCU on_od_raw):
    ds / dr : dark current, 4 samples (sample / reference)
    ls / lr : LED on, 16 samples; the first WARMUP_DISCARD are the LED settling period and are always discarded
    read failures are recorded as -1 and always excluded first (not treated as readings)

Estimation algorithms (within one measurement, 14 lit readings -> one value):
    mad       mean within a median +/- 3*MAD gate
    qn        gate using the Rousseeuw-Croux Qn scale
    biweight  Tukey biweight (c = 4.685)
    upper     one-sided: rejects only low values (bubble shading), takes the mean of values above the median
    mean      plain mean (control)
    median    median
    p75, p90  75th / 90th percentile (upper envelope)
Scale floor 1 count + 0.2% (with integer counts and many identical readings, MAD/Qn would become 0).

Bubble fraction (independent of algorithm, sample channel only):
    fraction of lit readings below upper envelope P90 x (1 - BUBBLE_DROP). Above REJECT_LIMIT_PCT (50%),
    the measurement is invalid for all algorithms - when most readings are bubbles, median-based methods take the bubble as the true value,
    and their own rejection rate looks like 0 (silently wrong), so the per-algorithm rejection rates alone cannot be relied on.
"""

import math
from collections import OrderedDict

MAD_K = 3.0
WARMUP_DISCARD = 2
MIN_VALID_LIT = 8
REJECT_LIMIT_PCT = 50.0
RAW_SAT = 65535.0
LOW_SIGNAL_COUNTS = 300.0
BUBBLE_DROP = 0.05          # counts as a bubble only if 5% or more below the upper envelope (plus a minimum distance of 3 x scale floor)


def median(a):
    s = sorted(a)
    n = len(s)
    return s[n // 2] if n % 2 else 0.5 * (s[n // 2 - 1] + s[n // 2])


def scale_floor(med):
    return 1.0 + 0.002 * abs(med)


def mad_scale(a, med):
    return max(median([abs(x - med) for x in a]) * 1.4826, scale_floor(med))


def qn_scale(a):
    d = sorted(abs(a[i] - a[j]) for i in range(len(a)) for j in range(i + 1, len(a)))
    if not d:
        return 1e-6
    h = len(a) // 2 + 1
    k = min(max(h * (h - 1) // 2, 1), len(d))
    return max(2.2219 * d[k - 1], 1e-6)


def est_mad(a):
    med = median(a)
    sc = mad_scale(a, med)
    kept = [x for x in a if abs(x - med) <= MAD_K * sc]
    return (sum(kept) / len(kept) if kept else med), 100.0 * (len(a) - len(kept)) / len(a)


def est_qn(a):
    med = median(a)
    sc = max(qn_scale(a), scale_floor(med))
    kept = [x for x in a if abs(x - med) <= MAD_K * sc]
    return (sum(kept) / len(kept) if kept else med), 100.0 * (len(a) - len(kept)) / len(a)


def est_biweight(a):
    med = median(a)
    sc = mad_scale(a, med)
    c = 4.685
    T = med
    for _ in range(8):
        sw = swx = 0.0
        for x in a:
            u = (x - T) / (c * sc)
            if abs(u) < 1.0:
                w = (1 - u * u) ** 2
                sw += w
                swx += w * x
        if sw <= 0:
            break
        Tn = swx / sw
        if abs(Tn - T) < 1e-4 * (abs(T) + 1e-3):
            T = Tn
            break
        T = Tn
    rej = sum(1 for x in a if abs((x - T) / (c * sc)) >= 1.0)
    return T, 100.0 * rej / len(a)


def est_upper(a):
    med = median(a)
    sc = mad_scale(a, med)
    rej = sum(1 for x in a if x < med - MAD_K * sc)
    kept = [x for x in a if x >= med]
    return (sum(kept) / len(kept) if kept else med), 100.0 * rej / len(a)


def est_mean(a):
    return sum(a) / len(a), 0.0


def est_median(a):
    return median(a), 0.0


def _percentile(a, p):
    s = sorted(a)
    k = (len(s) - 1) * p / 100.0
    lo, hi = math.floor(k), math.ceil(k)
    return s[lo] if lo == hi else s[lo] + (s[hi] - s[lo]) * (k - lo)


def est_pct(p):
    def f(a):
        v = _percentile(a, p)
        sc = mad_scale(a, median(a))
        rej = sum(1 for x in a if x < v - MAD_K * sc)    # fraction clearly below the upper envelope (quality metric)
        return v, 100.0 * rej / len(a)
    return f


ESTIMATORS = OrderedDict([
    ("mad", est_mad), ("qn", est_qn), ("biweight", est_biweight), ("upper", est_upper),
    ("mean", est_mean), ("median", est_median), ("p75", est_pct(75)), ("p90", est_pct(90)),
])
ALG_NAMES = list(ESTIMATORS)
ALG_LABELS = {
    "mad": "MAD", "qn": "Qn", "biweight": "Tukey biweight", "upper": "upper (one-sided)",
    "mean": "mean", "median": "median", "p75": "P75", "p90": "P90",
}


def valid(a):
    return [x for x in a if x >= 0]


def bubble_pct(a):
    """Algorithm-independent bubble fraction: percentage of readings clearly below the upper envelope (P90)."""
    if not a:
        return 100.0
    top = _percentile(a, 90)
    thr = top - max(BUBBLE_DROP * top, 3.0 * scale_floor(top))
    return 100.0 * sum(1 for x in a if x < thr) / len(a)


def attempt_result(att, alg, single):
    """One attempt + one algorithm -> dict (S, R are dark-subtracted equivalent lux)"""
    est = ESTIMATORS[alg]
    s = valid(att["ls"][WARMUP_DISCARD:])
    r = valid(att["lr"][WARMUP_DISCARD:])
    litS, rejS = est(s) if s else (0.0, 100.0)
    litR, rejR = est(r) if r else (0.0, 100.0)
    ds, dr = valid(att["ds"]), valid(att["dr"])
    dS = median(ds) if ds else 0.0
    dR = median(dr) if dr else 0.0
    lpc = att["lpc"]
    satS = any(x >= RAW_SAT - 0.5 for x in s)
    satR = any(x >= RAW_SAT - 0.5 for x in r)
    enoughS = len(s) >= MIN_VALID_LIT
    enoughR = len(r) >= MIN_VALID_LIT
    rej = rejS if single else max(rejS, rejR)
    netS, netR = litS - dS, litR - dR
    hw_ok = att.get("hw_ok", enoughS and (single or enoughR))
    bub = bubble_pct(s)
    ok = hw_ok and rej <= REJECT_LIMIT_PCT and bub <= REJECT_LIMIT_PCT and not satS and (single or not satR) and enoughS and (single or enoughR)
    return {
        "S": max(netS * lpc, 0.0), "R": max(netR * lpc, 0.0),
        "counts_s": litS, "counts_r": litR, "rej": rej, "bubble": bub, "ok": ok,
        "sat_s": satS, "sat_r": satR, "enough_s": enoughS, "enough_r": enoughR,
        "low_s": netS < LOW_SIGNAL_COUNTS, "low_r": netR < LOW_SIGNAL_COUNTS,
        "n_valid_s": len(s), "n_valid_r": len(r),
    }


def measurement_result(attempts, alg, single):
    """Multiple attempts of the same measurement: pick valid ones first, then compare rejection rates (same rule as firmware v1.1.3)."""
    best = None
    for att in attempts:
        res = attempt_result(att, alg, single)
        if best is None or (res["ok"] and not best["ok"]) or (res["ok"] == best["ok"] and res["rej"] < best["rej"]):
            best = res
    return best


def od_values(res, blank_alg, plf):
    """dual / single OD. blank_alg = this algorithm's own blank {"s","r","ratio"} (None = not yet calibrated)."""
    if not blank_alg or plf <= 0:
        return None, None
    S, R = res["S"], res["R"]
    bS, bR = blank_alg.get("s") or 0.0, blank_alg.get("r") or 0.0
    bRatio = blank_alg.get("ratio") or (bS / bR if bS > 0 and bR > 0 else 0.0)   # manual entry may only have the ratio
    dual = single = None
    if S > 0 and R > 0 and bRatio > 0:
        dual = math.log10(bRatio / (S / R)) * plf
    if S > 0 and bS > 0:
        single = math.log10(bS / S) * plf
    return dual, single


def hampel(series, window=7, k=3.0, causal=False):
    """Hampel filter: points outside the window median +/- k*MAD are replaced by the median. causal=True uses only past points (for live use)."""
    out = list(series)
    half = window // 2
    for i, v in enumerate(series):
        if v is None:
            continue
        lo, hi = (max(0, i - window + 1), i + 1) if causal else (max(0, i - half), i + half + 1)
        win = [x for x in series[lo:hi] if x is not None]
        if len(win) < 3:
            continue
        med = median(win)
        mad = 1.4826 * median([abs(x - med) for x in win])
        if mad > 0 and abs(v - med) > k * mad:
            out[i] = med
    return out
