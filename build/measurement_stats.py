"""Recompute every statistic quoted in the Measurement page's photometer chapter.

    python3 build/measurement_stats.py

The page states that the Pro needs no calibration transform against a benchtop
spectrophotometer, and that what separates it from the reference is a constant
offset rather than a scale error. Those are two testable statements, so they are
tested here rather than asserted: the slope of the Pro on the BioDrop against a
null of one, and the intercept against a null of zero, inside the 0 to 1 OD
window where the BioDrop is a valid comparator.

The nine points are the ones od600_silica_window.py draws, straight from the
"10_10 Photometer Calibration" workbook, so the figure, the fits table and these
intervals are one calculation. Ordinary least squares throughout, Student-t
intervals; no third-party package is used, and the incomplete beta below is the
standard continued-fraction expansion (Numerical Recipes, 6.4), checked against
published critical values in main().
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from od600_silica_window import MASS, SERIES          # noqa: E402


def _betacf(a, b, x, itmax=300, eps=3e-16, fpmin=1e-300):
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    if abs(d) < fpmin:
        d = fpmin
    d = 1.0 / d
    h = d
    for m in range(1, itmax + 1):
        m2 = 2 * m
        for aa in (m * (b - m) * x / ((qam + m2) * (a + m2)),
                   -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))):
            d = 1.0 + aa * d
            if abs(d) < fpmin:
                d = fpmin
            c = 1.0 + aa / c
            if abs(c) < fpmin:
                c = fpmin
            d = 1.0 / d
            h *= d * c
        if abs(d * c - 1.0) < eps:
            break
    return h


def betainc(a, b, x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lb = (math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
          + a * math.log(x) + b * math.log1p(-x))
    if x < (a + 1.0) / (a + b + 2.0):
        return math.exp(lb) * _betacf(a, b, x) / a
    return 1.0 - math.exp(lb) * _betacf(b, a, 1.0 - x) / b


def t_p(t, df):
    """Two-sided p for Student t."""
    return betainc(df / 2.0, 0.5, df / (df + t * t))


def t_crit(df, p=0.05):
    lo, hi = 0.0, 100.0
    for _ in range(200):
        mid = (lo + hi) / 2.0
        lo, hi = (mid, hi) if t_p(mid, df) > p else (lo, mid)
    return (lo + hi) / 2.0


def mean(v):
    return sum(v) / len(v)


def fit(xs, ys):
    """slope, intercept, their standard errors, R2 and the residual df."""
    n = len(xs)
    mx, my = mean(xs), mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    a = my - b * mx
    res = [y - (a + b * x) for x, y in zip(xs, ys)]
    df = n - 2
    s2 = sum(r * r for r in res) / df
    return (b, a, math.sqrt(s2 / sxx), math.sqrt(s2 * (1.0 / n + mx * mx / sxx)),
            1 - sum(r * r for r in res) / sum((y - my) ** 2 for y in ys), df)


def ci(v, se, df):
    t = t_crit(df)
    return v - t * se, v + t * se


def main():
    assert abs(t_p(2.228, 10) - 0.05) < 5e-4, "t distribution is wrong"
    assert abs(t_crit(6) - 2.447) < 5e-4, "t critical value is wrong"

    series = {name.split(",")[0]: ys for name, _c, ys in SERIES}
    print("Against the silica mass standard, 0 to 20 mg, nine points with the blank:")
    for name, ys in series.items():
        b, a, seb, sea, r2, df = fit(MASS, ys)
        lo, hi = ci(b, seb, df)
        print(f"  {name:8} y = {b:.4f}x {a:+.4f}   R2 = {r2:.4f}   "
              f"slope 95% CI {lo:.4f} to {hi:.4f}")

    bd, pro = series["BioDrop"][1:], series["Pro"][1:]
    print("\nThe Pro read against the BioDrop, the eight dosed points:")
    b, a, seb, sea, r2, df = fit(bd, pro)
    lo, hi = ci(b, seb, df)
    t1 = (b - 1.0) / seb
    print(f"  slope     {b:.3f}   95% CI {lo:.3f} to {hi:.3f}   "
          f"H0 slope = 1:     t({df}) = {t1:+.2f}, p = {t_p(t1, df):.3f}")
    lo, hi = ci(a, sea, df)
    t0 = a / sea
    print(f"  intercept {a:+.3f}  95% CI {lo:+.3f} to {hi:+.3f}  "
          f"H0 intercept = 0: t({df}) = {t0:+.2f}, p = {t_p(t0, df):.4f}")
    print(f"  R2 = {r2:.4f}")

    d = [p - q for p, q in zip(pro, bd)]
    n = len(d)
    sd = math.sqrt(sum((x - mean(d)) ** 2 for x in d) / (n - 1))
    t = mean(d) / (sd / math.sqrt(n))
    lo, hi = ci(mean(d), sd / math.sqrt(n), n - 1)
    print(f"\n  paired difference Pro - BioDrop: {mean(d):+.3f} OD, "
          f"95% CI {lo:+.3f} to {hi:+.3f}, t({n-1}) = {t:.2f}, p = {t_p(t, n-1):.5f}")


if __name__ == "__main__":
    main()
