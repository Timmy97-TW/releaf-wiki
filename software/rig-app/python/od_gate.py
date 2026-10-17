# -*- coding: utf-8 -*-
"""
OD600 gate layer (v5.1)
====================
A decision layer placed after the estimators (the 8 algorithms in photometer_algos). The estimators handle outliers among the 14 lit readings within one measurement;
this layer handles anomalies between measurements - bubbles, gas slugs - and separates real level changes (dilution, inoculation)
from spurious jumps.

Shared by main.py (live) and tools/replay_od.py (offline rerun), so both are guaranteed to give identical results.
Uses only the Python standard library.

Gate order (failing any stage means the reading is not accepted; the reported value stays at the last accepted level):

  1. Estimator gate   the estimator itself flags the reading invalid (hardware, saturation, too few valid samples, majority bubbles) -> rejected
                  Reason: firmware/estimator flags miss some bubbles (about 21% on V2), but those that are caught must still be blocked.

  2. Discrepancy gate   |od(primary estimator) - od_p90| > max(disc_abs, disc_rel x |od|) -> rejected
                  Reason: bubbles darken some readings (or brighten them on V1), so the upper envelope P90 and the robust mean diverge;
                  for clean readings the two are nearly identical. This is OR-ed with stage 1 - together the two stages catch about 97% on both machines,
                  with 0% false rejection of clean readings. disc_rel defaults to 0 (exactly the absolute threshold derived from the 10/10 measurements);
                  if the false rejection rate rises at high OD (signal near the noise floor), enable disc_rel.

  3. Jump gate     difference from the last accepted value > max(jump_abs, jump_rel x |last accepted value|) -> not accepted yet,
                  placed in the candidate cluster (pending).
                  Reason: gas slug readings are very stable but completely wrong (3.18 read as 0.8); stages 1 and 2 cannot catch them,
                  only comparison with history can block them.

  4. Level change confirmation   once confirm_n mutually consistent readings accumulate in the candidate cluster -> accepted as the new level, and an alarm is raised.
                  Reason: real changes (dilution, inoculation) must be followed; the cost is that a gas slug lasting longer than confirm_n x measurement interval
                  will also be accepted, so an alarm is always raised to make it visible.
                  Note: cluster consistency is among the candidates themselves, not relative to the old level - otherwise after a dilution every reading is far from the old level,
                  the cluster never fills up, and the value locks at the old level (this is the easiest mistake to make in this layer).

  5. Reported value       median of the last report_median_n accepted values.
                  Reason: single slipped-through anomalies still exist. Growth is measured in hours, so a confirm_n x interval (default 3 x 30 s = 90 s)
                  delay does not affect the trend; but the buffer is cleared when a level change is accepted, so the reported value does not straddle the step.

Two additions not in the original proposal but needed in practice:

  declare_step()  press before a planned operation (dilution, inoculation, medium exchange); the next reading that passes stages 1 and 2
                  is accepted directly as the new level without waiting for confirm_n readings, and is not treated as a suspicious event.
  Stall alarm        stale_n consecutive readings not accepted -> raise an alarm. The fact that the reported value is frozen at the old level must itself be visible,
                  otherwise everything looks normal on screen.

This layer only decides which value to report and never rewrites raw data: estimator output and each stage's verdict go into the CSV and raw files,
and can be recomputed later with different thresholds (tools/replay_od.py --gate-*).
"""

GATE_VERSION = "od-gate-1.0"

DEFAULTS = {
    "enabled": True,
    "disc_abs": 0.03,          # discrepancy gate absolute threshold (OD)
    "disc_rel": 0.0,           # discrepancy gate relative term: threshold = max(disc_abs, disc_rel x |od|)
    "jump_abs": 0.05,          # jump gate absolute threshold (OD)
    "jump_rel": 0.05,          # jump gate relative term (5%)
    "confirm_n": 3,            # number of mutually consistent readings needed to accept a new level
    "report_median_n": 3,      # report the median of this many most recent accepted values
    "stale_n": 5,              # number of consecutive rejected readings before a stall alarm
}

REASONS = {
    "ok": "accepted",
    "bootstrap": "accepted (first reading, sets baseline)",
    "estimator": "rejected: estimator invalid (hardware/saturation/mostly bubbles)",
    "disc": "rejected: dispersion gate (robust value disagrees with upper envelope, likely bubble)",
    "pending": "rejected: jump gate (awaiting confirmation of a real level change)",
    "level_shift": "accepted: confirmed new level",
    "declared": "accepted: declared operation, set as new level",
    "disabled": "accepted (gate disabled)",
}


def _median(a):
    s = sorted(a)
    n = len(s)
    if not n:
        return None
    return s[n // 2] if n % 2 else 0.5 * (s[n // 2 - 1] + s[n // 2])


class ODGate:
    def __init__(self, cfg=None):
        self.cfg = dict(DEFAULTS)
        if cfg:
            for k in DEFAULTS:
                if cfg.get(k) is not None:
                    self.cfg[k] = type(DEFAULTS[k])(cfg[k]) if not isinstance(DEFAULTS[k], bool) else bool(cfg[k])
        self.reset("init")

    # ---- State ----
    def reset(self, reason="manual"):
        """Must reset whenever the estimator / blank / path-length coefficient changes: the level scale has changed, so the old last_accepted is meaningless."""
        self.last_accepted = None
        self.last_accepted_ts = None
        self.pending = []
        self.history = []
        self.reject_run = 0
        self.n_accepted = 0
        self.n_rejected = 0
        self.declared = False
        self.reset_reason = reason

    def declare_step(self):
        """Planned operation: the next valid reading is taken directly as the new level."""
        self.declared = True
        self.pending = []

    def config(self):
        return dict(self.cfg, version=GATE_VERSION)

    def status(self):
        return {
            "enabled": bool(self.cfg["enabled"]), "version": GATE_VERSION,
            "last_accepted": self.last_accepted, "pending_n": len(self.pending),
            "reject_run": self.reject_run, "n_accepted": self.n_accepted, "n_rejected": self.n_rejected,
            "declared": self.declared, "reported": self.reported(),
        }

    def reported(self):
        n = max(1, int(self.cfg["report_median_n"]))
        h = self.history[-n:]
        return None if not h else round(_median(h), 5)

    # ---- Internal ----
    def _tol(self, ref):
        return max(float(self.cfg["jump_abs"]), float(self.cfg["jump_rel"]) * abs(ref))

    def _accept(self, od, ts):
        self.last_accepted = round(od, 5)
        self.last_accepted_ts = ts
        self.history.append(round(od, 5))
        n = max(1, int(self.cfg["report_median_n"]))
        if len(self.history) > n:
            self.history = self.history[-n:]
        self.reject_run = 0
        self.n_accepted += 1
        self.declared = False

    def _reject(self):
        self.reject_run += 1
        self.n_rejected += 1

    # ---- Main entry ----
    def feed(self, od, od_p90=None, estimator_ok=True, ts=None):
        """Takes the result of one measurement and returns this layer's verdict.

        od            OD from the primary estimator (default mad); None = could not be computed
        od_p90        OD from the p90 estimator for the same measurement (used by the discrepancy gate)
        estimator_ok  the estimator's own valid flag (hardware, saturation, majority bubbles, etc.)
        """
        c = self.cfg
        out = {"reason": "ok", "accepted": False, "d_disc": None, "d_jump": None,
               "thr_disc": None, "thr_jump": None, "alarm": None, "level_shift": False}

        if not c["enabled"]:
            if od is not None:
                self._accept(od, ts)
            out.update(reason="disabled", accepted=od is not None)
            out.update(self._tail())
            return out

        # --- 1. Estimator gate ---
        if od is None or not estimator_ok:
            self._reject()
            out.update(reason="estimator")
            out.update(self._tail())
            out["alarm"] = self._stale_alarm()
            return out

        # --- 2. Discrepancy gate ---
        if od_p90 is not None:
            thr = max(float(c["disc_abs"]), float(c["disc_rel"]) * abs(od))
            d = abs(od - od_p90)
            out["d_disc"], out["thr_disc"] = round(d, 5), round(thr, 5)
            if d > thr:
                self._reject()
                out.update(reason="disc")
                out.update(self._tail())
                out["alarm"] = self._stale_alarm()
                return out

        # --- Declared operation: set directly as the new level ---
        if self.declared:
            self.history = []
            self.pending = []
            self._accept(od, ts)
            out.update(reason="declared", accepted=True, level_shift=True)
            out.update(self._tail())
            return out

        # --- First reading: establish the baseline ---
        if self.last_accepted is None:
            self._accept(od, ts)
            out.update(reason="bootstrap", accepted=True)
            out.update(self._tail())
            return out

        # --- 3. Jump gate ---
        tol = self._tol(self.last_accepted)
        d = abs(od - self.last_accepted)
        out["d_jump"], out["thr_jump"] = round(d, 5), round(tol, 5)
        if d <= tol:
            self.pending = []
            self._accept(od, ts)
            out.update(reason="ok", accepted=True)
            out.update(self._tail())
            return out

        # --- 4. Candidate cluster: only mutually consistent readings count as a new level ---
        if self.pending and abs(od - self.pending[0]) > self._tol(self.pending[0]):
            self.pending = []                      # inconsistent even with the cluster itself -> restart
        self.pending.append(round(od, 5))
        if len(self.pending) >= int(c["confirm_n"]):
            new = _median(self.pending)
            span = max(self.pending) - min(self.pending)
            old = self.last_accepted
            self.history = []                      # keep the reported value from straddling the step
            self._accept(new, ts)
            self.pending = []
            out.update(reason="level_shift", accepted=True, level_shift=True)
            out["alarm"] = {
                "code": "od_level_shift", "level": "warning",
                "message": (f"OD600 level change: {old:.3f} -> {new:.3f}"
                            f" ({int(c['confirm_n'])} consecutive consistent readings, spread {span:.3f}). "
                            f"If not a dilution/inoculation, check the flow cell for an air column"),
            }
            out.update(self._tail())
            return out

        self._reject()
        out.update(reason="pending")
        out.update(self._tail())
        out["alarm"] = self._stale_alarm()
        return out

    def _stale_alarm(self):
        n = int(self.cfg["stale_n"])
        if n > 0 and self.reject_run == n:          # fire only once, right when the threshold is crossed
            return {"code": "od_gate_stale", "level": "warning",
                    "message": (f"OD600: {self.reject_run} consecutive readings failed the gate, reported value held at "
                                f"{self.last_accepted if self.last_accepted is not None else '--'}:"
                                f" check flow cell for bubbles/air column and the light sensor")}
        return None

    def _tail(self):
        return {"reported": self.reported(), "last_accepted": self.last_accepted,
                "pending_n": len(self.pending), "reject_run": self.reject_run,
                "n_accepted": self.n_accepted, "n_rejected": self.n_rejected}
