# -*- coding: utf-8 -*-
"""
Automatic pH control (base dosing) v1.0 - pure logic, does not touch Bridge / files / web UI
===========================================================
main.py calls tick(now, inputs) once per second and, based on the returned actions, switches the feed valve and sends base dosing pulses;
the same logic can also be tested on a PC with a simulated pH curve (tools/sim_ph_control.py).

Rules (user specification, 2026-10-16):
  - pH below setpoint -> feed valve turns to 'base dosing', the second pump runs one pulse (default 5 s) then pauses,
    waits for the pH reading to reach steady state, then decides whether to continue dosing, until the target is reached.
  - pH too high -> only raise an alarm, take no action (the system can only add base, no acid).

Details:
  Start threshold  pH < target - deadband (hysteresis: stop at target to avoid toggling around the threshold)
  Stop condition   after steady state, pH >= target -> feed valve returns to its state before dosing (if it was on external feed, back to external feed)
  Steady state     at least settle_min_s after the pulse ends; then the linear regression slope of pH over the last steady_window_s
            |slope| < steady_slope_per_min (pH/min) counts as steady state; if still not steady after settle_max_s, decide once anyway
  Safety limits    at most max_doses_h pulses per hour (the MCU separately limits cumulative on-time per hour);
            no_response_n consecutive pulses each with pH rise < min_response_ph -> latch FAULT
            (base solution empty, line disconnected, feed valve stuck); must be manually cleared
            feed valve not in position within valve_timeout_s -> FAULT
            pH reading invalid (probe fault / stale / warming up) or pressure protection latched -> pause (no dosing), resume automatically once conditions recover
            feed pump running continuously (v6.2: the second pump is shared with feeding) -> pause, resume when it stops
The MCU additionally guarantees: rejects pulses unless the feed valve is confirmed at the base dosing position, stops the pump as soon as the valve leaves, max 10 s per pulse, and shuts off even if Linux crashes.
"""

import math
from collections import deque

VERSION = "ph-ctrl-1.0"

DEFAULTS = {
    "enabled": False,
    "target": 7.00,               # target pH
    "deadband": 0.05,             # start base dosing only below target - deadband
    "high_alarm": 7.50,           # above this value only raise an alarm
    "pulse_s": 5.0,               # duration of each base dose (s)
    "settle_min_s": 60.0,         # minimum wait after a pulse before judging steady state (mixing time)
    "settle_max_s": 900.0,        # if still not steady after this long, decide once anyway
    "steady_window_s": 60.0,      # length of pH history used for the steady-state check
    "steady_slope_per_min": 0.02, # |dpH/dt| below this value (pH/min) = steady state
    "max_doses_h": 12,            # max pulses per hour
    "no_response_n": 3,           # FAULT after this many consecutive pulses with no response
    "min_response_ph": 0.01,      # pH must rise at least this much after one pulse to count as a response
    "valve_timeout_s": 20.0,      # time limit for the feed valve to reach the base dosing position
}

LIMITS = {   # (min, max)
    "target": (2.0, 12.0), "deadband": (0.0, 2.0), "high_alarm": (2.0, 14.0), "pulse_s": (0.1, 10.0),
    "settle_min_s": (5.0, 7200.0), "settle_max_s": (10.0, 14400.0), "steady_window_s": (10.0, 1800.0),
    "steady_slope_per_min": (0.0005, 1.0), "max_doses_h": (1, 120), "no_response_n": (1, 50),
    "min_response_ph": (0.0, 1.0), "valve_timeout_s": (3.0, 120.0),
}

STATES = ("off", "idle", "valve", "dosing", "settling", "paused", "fault")


def validate(cfg):
    """Returns (clean dict, error list). Only checks fields that were provided."""
    out, errs = {}, []
    for k, v in (cfg or {}).items():
        if k not in DEFAULTS:
            continue
        if k == "enabled":
            out[k] = bool(v)
            continue
        try:
            x = float(v)
        except (TypeError, ValueError):
            errs.append(f"{k}: not a number")
            continue
        if not math.isfinite(x):
            errs.append(f"{k}: not a finite number")
            continue
        lo, hi = LIMITS[k]
        if not (lo <= x <= hi):
            errs.append(f"{k}: must be within {lo}-{hi}")
            continue
        out[k] = int(round(x)) if isinstance(DEFAULTS[k], int) and not isinstance(DEFAULTS[k], bool) else x
    merged = dict(DEFAULTS)
    merged.update(out)
    if merged["high_alarm"] <= merged["target"]:
        errs.append("high_alarm must be greater than target")
    if merged["settle_max_s"] < merged["settle_min_s"]:
        errs.append("settle_max_s must be >= settle_min_s")
    return out, errs


def slope_per_min(points):
    """points = [(t_s, ph)]; least-squares slope (pH/min). Returns None if too few points."""
    n = len(points)
    if n < 5:
        return None
    t0 = points[0][0]
    xs = [p[0] - t0 for p in points]
    ys = [p[1] for p in points]
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx <= 0:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / sxx * 60.0


class PhDoser:
    def __init__(self, cfg=None):
        self.cfg = dict(DEFAULTS)
        if cfg:
            good, _ = validate(cfg)
            self.cfg.update(good)
        self.state = "off" if not self.cfg["enabled"] else "idle"
        self.t_state = None
        self.hist = deque()                 # (t, pH) recent valid pH
        self.dose_times = deque()           # pulse times within the last hour
        self.total_doses = 0
        self.total_ms = 0
        self.episode = False                # whether a dosing cycle is in progress (feed valve taken over by the controller)
        self.prev_feed_state = None         # feed valve state before dosing, restored at the end
        self.ph_before = None
        self.last_delta = None
        self.no_resp = 0
        self.t_pulse = None
        self.t_settle = None
        self.pause_reason = ""
        self.fault_msg = ""
        self.message = ""
        self.last_slope = None
        self.pending_pulse = False          # pulse sent, waiting for MCU reply
        self.last_dose_at = None

    # ---------- Settings ----------
    def configure(self, cfg):
        good, errs = validate(cfg)
        if errs:
            return False, errs
        was_enabled = self.cfg["enabled"]
        self.cfg.update(good)
        if self.cfg["enabled"] and not was_enabled and self.state == "off":
            self._go("idle", None, "Enabled")
        return True, []

    def reset_fault(self, now):
        if self.state == "fault":
            self.fault_msg = ""
            self.no_resp = 0
            self._go("idle" if self.cfg["enabled"] else "off", now, "FAULT cleared")
            return True
        return False

    # ---------- Internal ----------
    def _go(self, st, now, msg=""):
        self.state = st
        self.t_state = now
        if msg:
            self.message = msg

    def _end_episode(self, actions, now, why):
        if self.episode:
            back = self.prev_feed_state if self.prev_feed_state in ("closed", "feed") else "closed"
            actions.append(("feed_valve", back))
            actions.append(("event", "episode_end", {"why": why, "restore_feed": back}))
        self.episode = False
        self.prev_feed_state = None

    def _fault(self, actions, now, msg):
        self.fault_msg = msg
        self._end_episode(actions, now, "fault")
        actions.append(("event", "fault", {"msg": msg}))
        self._go("fault", now, msg)

    def abort(self, now, why="abort"):
        """External abort (MCU restart, manual feed valve operation, etc.): end the current cycle and return to idle/off; returns the actions to execute."""
        actions = []
        self.pending_pulse = False
        if self.state in ("valve", "dosing", "settling") or self.episode:
            self._end_episode(actions, now, why)
            actions.append(("event", "abort", {"why": why}))
        if self.state != "fault":
            self._go("idle" if self.cfg["enabled"] else "off", now, f"Aborted: {why}")
        return actions

    def doses_last_hour(self, now):
        while self.dose_times and now - self.dose_times[0] > 3600.0:
            self.dose_times.popleft()
        return len(self.dose_times)

    # ---------- MCU replies to pulse commands ----------
    def on_pulse_result(self, now, ok, msg=""):
        self.pending_pulse = False
        actions = []
        if self.state != "dosing":
            return actions
        if ok:
            self.dose_times.append(now)
            self.total_doses += 1
            self.total_ms += int(self.cfg["pulse_s"] * 1000)
            self.last_dose_at = now
            actions.append(("event", "dose", {"ms": int(self.cfg["pulse_s"] * 1000), "ph_before": self.ph_before,
                                              "n_hour": self.doses_last_hour(now)}))
            return actions
        if "hourly" in (msg or ""):
            self._end_episode(actions, now, "mcu_hourly_limit")
            self._go("idle", now, "MCU hourly base dosing limit reached, dosing paused")
            actions.append(("event", "dose_rejected", {"msg": msg}))
            return actions
        if "pressure trip" in (msg or ""):
            self._go("paused", now, "Pressure protection latched")
            self.pause_reason = "pressure_trip"
            return actions
        self._fault(actions, now, f"MCU rejected base dosing: {msg}")
        return actions

    # ---------- Every second ----------
    def tick(self, now, ph, ph_ok, feed_state, feed_inpos, feed_online, base_on, ptrip, base_why="", feed_run=False):
        """Returns a list of actions: ("feed_valve", "base"|"closed"|"feed"), ("pulse", ms), ("event", kind, detail)."""
        c = self.cfg
        actions = []
        if ph_ok and ph is not None:
            self.hist.append((now, ph))
        while self.hist and now - self.hist[0][0] > max(c["steady_window_s"], 30.0) + 5.0:
            self.hist.popleft()
        pts = [p for p in self.hist if now - p[0] <= c["steady_window_s"]]
        self.last_slope = slope_per_min(pts)

        if self.state == "fault":
            return actions
        if not c["enabled"]:
            if self.state != "off":
                self._end_episode(actions, now, "disabled")
                self._go("off", now, "Disabled")
            return actions
        if self.state == "off":
            self._go("idle", now, "Enabled")

        # ---- Pause conditions: pH invalid / pressure protection / feed valve offline ----
        why = ""
        if ptrip:
            why = "Pressure protection latched"
        elif not ph_ok or ph is None:
            why = "pH reading invalid (probe fault / stale / warming up)"
        elif not feed_online:
            why = "Feed valve offline"
        elif feed_run:
            why = "Feed pump running (manual)"        # v6.2: the second pump is shared with the feed pump
        if why:
            if self.state != "paused":
                if self.state in ("valve", "dosing", "settling") or self.episode:
                    self._end_episode(actions, now, "paused")
                actions.append(("event", "paused", {"why": why}))
            self.pause_reason = why
            self._go("paused", now if self.state != "paused" else self.t_state, why)
            return actions
        if self.state == "paused":
            actions.append(("event", "resumed", {}))
            self._go("idle", now, "Conditions restored, resuming monitoring")

        start_thr = c["target"] - c["deadband"]

        if self.state == "idle":
            if ph < start_thr:
                if self.doses_last_hour(now) >= c["max_doses_h"]:
                    self.message = f"Hourly dose limit of {c['max_doses_h']} reached, waiting"
                    return actions
                self.episode = True
                self.prev_feed_state = feed_state if feed_state in ("closed", "feed") else "closed"
                self.no_resp = 0
                actions.append(("feed_valve", "base"))
                actions.append(("event", "episode_start", {"ph": ph, "target": c["target"],
                                                           "prev_feed": self.prev_feed_state}))
                self._go("valve", now, f"pH {ph:.2f} < {start_thr:.2f}: feed valve to base dosing")
            else:
                self.message = "Monitoring"
            return actions

        if self.state == "valve":
            if feed_state == "base" and feed_inpos:
                if self.pending_pulse:
                    return actions
                self.ph_before = ph
                self.t_pulse = now
                self.pending_pulse = True
                actions.append(("pulse", int(c["pulse_s"] * 1000)))
                self._go("dosing", now, f"Base dosing {c['pulse_s']:.1f} s")
            elif now - (self.t_state or now) > c["valve_timeout_s"]:
                self._fault(actions, now, f"Feed valve did not reach base dosing position within {c['valve_timeout_s']:.0f} s")
            return actions

        if self.state == "dosing":
            if self.pending_pulse:
                return actions
            # The MCU reports bon once per second; wait at least the pulse duration + 1.5 s to avoid reading the stale state from before the pulse started
            if not base_on and now - (self.t_pulse or now) >= c["pulse_s"] + 1.5:
                if base_why and base_why not in ("done", "running"):
                    actions.append(("event", "dose_cut", {"why": base_why}))
                self.t_settle = now
                self._go("settling", now, "Waiting for pH to settle")
            return actions

        if self.state == "settling":
            el = now - (self.t_settle or now)
            steady = (el >= c["settle_min_s"] and self.last_slope is not None
                      and abs(self.last_slope) < c["steady_slope_per_min"])
            timeout = el >= c["settle_max_s"]
            if not (steady or timeout):
                s = "--" if self.last_slope is None else f"{self.last_slope:+.3f}"
                self.message = f"Waiting for pH to settle {el:.0f} s (slope {s} pH/min)"
                return actions
            self.last_delta = (ph - self.ph_before) if self.ph_before is not None else None
            if self.last_delta is not None and self.last_delta < c["min_response_ph"]:
                self.no_resp += 1
            else:
                self.no_resp = 0
            actions.append(("event", "settled", {"ph": ph, "delta": self.last_delta, "steady": steady,
                                                 "timeout": timeout, "settle_s": round(el, 1),
                                                 "slope": self.last_slope}))
            if ph >= c["target"]:
                self._end_episode(actions, now, "target_reached")
                self._go("idle", now, f"Target pH {c['target']:.2f} reached")
                return actions
            if self.no_resp >= c["no_response_n"]:
                self._fault(actions, now, f"pH did not rise after {self.no_resp} consecutive base doses"
                                          f" (< {c['min_response_ph']}): check base solution, tubing and feed valve")
                return actions
            if self.doses_last_hour(now) >= c["max_doses_h"]:
                self._end_episode(actions, now, "hourly_limit")
                self._go("idle", now, f"Hourly dose limit of {c['max_doses_h']} reached")
                return actions
            self._go("valve", now, f"pH {ph:.2f} still below target {c['target']:.2f}, continuing base dosing")
            return actions
        return actions

    # ---------- For web UI / alarms ----------
    def alerts(self, ph, ph_ok):
        out = []
        c = self.cfg
        if ph_ok and ph is not None and ph > c["high_alarm"]:
            out.append({"level": "warning", "code": "ph_high", "value": round(ph, 3),
                        "message": f"pH {ph:.2f} above limit {c['high_alarm']:.2f} (system can only add base, no automatic action)"})
        if self.state == "fault":
            out.append({"level": "critical", "code": "ph_ctrl_fault", "value": self.fault_msg,
                        "message": f"Auto pH control FAULT: {self.fault_msg} (check, then press \"Clear\")"})
        elif self.state == "paused" and c["enabled"]:
            out.append({"level": "warning", "code": "ph_ctrl_paused", "value": self.pause_reason,
                        "message": f"Auto pH control paused: {self.pause_reason}"})
        if (c["enabled"] and self.state == "idle" and ph_ok and ph is not None
                and ph < c["target"] - c["deadband"] and len(self.dose_times) >= c["max_doses_h"]):
            out.append({"level": "warning", "code": "ph_dose_limit",
                        "message": f"pH low but hourly dose limit of {c['max_doses_h']} reached"})
        return out

    def snapshot(self, now):
        c = self.cfg
        return {
            "version": VERSION, "state": self.state, "enabled": c["enabled"], "config": dict(c),
            "message": self.message, "fault_msg": self.fault_msg, "pause_reason": self.pause_reason,
            "episode": self.episode, "prev_feed_state": self.prev_feed_state,
            "doses_last_h": self.doses_last_hour(now), "total_doses": self.total_doses, "total_ms": self.total_ms,
            "last_dose_ago_s": round(now - self.last_dose_at, 0) if self.last_dose_at else None,
            "ph_before": self.ph_before, "last_delta": self.last_delta, "no_resp": self.no_resp,
            "slope_per_min": None if self.last_slope is None else round(self.last_slope, 4),
            "settle_elapsed_s": round(now - self.t_settle, 0) if (self.state == "settling" and self.t_settle) else None,
            "start_below": round(c["target"] - c["deadband"], 3),
        }
