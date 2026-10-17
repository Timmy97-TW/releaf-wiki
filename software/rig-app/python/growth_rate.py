"""Specific growth rate (mu) from the OD600 reported value.

mu is the slope of ln(OD600) against time, fitted by least squares over a sliding
window (default 60 min):  ln OD(t) = ln OD0 + mu * t   ->   mu in 1/h.
Doubling time t_d = ln 2 / mu (only when mu > 0).

Only readings the OD gate accepted are used, and only above min_od (near the blank
ln(OD) is dominated by noise). The window restarts whenever the OD "ruler" or the
culture level changes on purpose: a declared intervention (dilution / inoculation),
a new blank, a different estimator or path-length factor, or a manual gate reset.
Otherwise a dilution step would show up as a large negative mu.

Pure logic with no I/O, so it can be tested on its own.
"""
import math
from collections import deque


class GrowthRate:
    def __init__(self, window_min=60.0, min_points=6, min_span_min=15.0, min_od=0.02, max_points=2000):
        self.window_min = float(window_min)
        self.min_points = int(min_points)
        self.min_span_min = float(min_span_min)
        self.min_od = float(min_od)
        self._pts = deque(maxlen=int(max_points))      # (epoch_s, ln_od)
        self.reset_reason = "start"
        self.reset_at = None

    def config(self):
        return {"window_min": self.window_min, "min_points": self.min_points,
                "min_span_min": self.min_span_min, "min_od": self.min_od}

    def set_config(self, window_min=None, min_points=None, min_span_min=None, min_od=None):
        if window_min is not None:
            self.window_min = min(max(float(window_min), 5.0), 24 * 60.0)
        if min_points is not None:
            self.min_points = min(max(int(min_points), 3), 500)
        if min_span_min is not None:
            self.min_span_min = min(max(float(min_span_min), 1.0), self.window_min)
        if min_od is not None:
            self.min_od = min(max(float(min_od), 0.001), 5.0)

    def reset(self, reason, now=None):
        self._pts.clear()
        self.reset_reason = reason
        self.reset_at = now

    def add(self, t, od):
        """Add one accepted reading. Returns False when it is not usable (None, <= min_od, not finite)."""
        try:
            od = float(od)
        except (TypeError, ValueError):
            return False
        if not math.isfinite(od) or od <= self.min_od:
            return False
        if self._pts and t <= self._pts[-1][0]:
            return False
        self._pts.append((float(t), math.log(od)))
        return True

    def status(self, now):
        lo = now - self.window_min * 60.0
        while self._pts and self._pts[0][0] < lo:
            self._pts.popleft()
        pts = list(self._pts)
        n = len(pts)
        span_min = (pts[-1][0] - pts[0][0]) / 60.0 if n >= 2 else 0.0
        out = {"mu_per_h": None, "td_h": None, "r2": None, "n": n, "span_min": round(span_min, 1),
               "window_min": self.window_min, "min_points": self.min_points,
               "min_span_min": self.min_span_min, "state": "collecting",
               "reset_reason": self.reset_reason}
        if n < self.min_points or span_min < self.min_span_min:
            return out
        t0 = pts[0][0]
        xs = [(t - t0) / 3600.0 for t, _ in pts]
        ys = [y for _, y in pts]
        mx = sum(xs) / n
        my = sum(ys) / n
        sxx = sum((x - mx) ** 2 for x in xs)
        if sxx <= 0:
            return out
        sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        mu = sxy / sxx
        syy = sum((y - my) ** 2 for y in ys)
        r2 = (sxy * sxy) / (sxx * syy) if syy > 0 else 1.0
        out.update({"mu_per_h": round(mu, 5), "r2": round(r2, 4), "state": "ok",
                    "td_h": round(math.log(2) / mu, 3) if mu > 1e-6 else None})
        return out
