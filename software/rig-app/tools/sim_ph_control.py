# -*- coding: utf-8 -*-
"""
PC simulation of automatic pH control (no board needed): runs the same logic as python/ph_control.py against a simple reactor model.
    python3 tools/sim_ph_control.py            # run all scenarios and print the results
Model: reactor pH follows the 'base added' with a first-order lag (mixing time tau_mix); acid production by the cells slowly lowers pH;
      the probe reading then passes through the same EMA as main.py (alpha = 0.2, every 0.5 s).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "python"))
import ph_control as PC  # noqa: E402


def run(name, ph0=6.6, gain=0.04, tau_mix=40.0, acid_per_min=0.002, minutes=120, cfg=None,
        ph_invalid=None, feed_offline=None, verbose=False):
    """gain = pH rise per second of base dosing (after mixing); ph_invalid = (t0, t1) period during which pH is invalid."""
    c = dict(enabled=True, target=7.0, deadband=0.05, pulse_s=5.0, settle_min_s=60, settle_max_s=600)
    c.update(cfg or {})
    d = PC.PhDoser(c)
    true_ph, mixed_target, ema = ph0, ph0, ph0
    feed_state, feed_goal, valve_t = "closed", "closed", 0.0
    base_until, base_on = -1.0, False
    events, max_ph = [], ph0
    t, dt = 0.0, 0.5
    while t < minutes * 60:
        # ---- Equipment ----
        if feed_goal != feed_state and t - valve_t >= 2.0:
            feed_state = feed_goal
        base_on = t < base_until and feed_state == "base"
        if base_on:
            mixed_target += gain * dt
        mixed_target -= acid_per_min / 60.0 * dt
        true_ph += (mixed_target - true_ph) * dt / tau_mix
        ema += 0.2 * (true_ph - ema)
        max_ph = max(max_ph, true_ph)
        # ---- Controller (every second) ----
        if abs(t - round(t)) < 1e-9:
            ok = not (ph_invalid and ph_invalid[0] <= t < ph_invalid[1])
            online = not (feed_offline and feed_offline[0] <= t < feed_offline[1])
            acts = d.tick(t, ema, ok, feed_state, feed_state == feed_goal, online, base_on, False, "done")
            for a in acts:
                if a[0] == "feed_valve":
                    feed_goal, valve_t = a[1], t
                elif a[0] == "pulse":
                    if feed_state == "base" and online:
                        base_until = t + a[1] / 1000.0
                        acts2 = d.on_pulse_result(t, True)
                    else:
                        acts2 = d.on_pulse_result(t, False, "feed valve not confirmed at base position")
                    events += [(t, x) for x in acts2 if x[0] == "event"]
                elif a[0] == "event":
                    events.append((t, a))
        t = round(t + dt, 6)
    s = d.snapshot(t)
    kinds = [e[1][1] for e in events]
    print(f"[{name}] final pH {true_ph:.3f} (max {max_ph:.3f}), state {s['state']}, {s['total_doses']} pulses total, "
          f"feed valve {feed_state}, events: " + ", ".join(f"{k}×{kinds.count(k)}" for k in dict.fromkeys(kinds)))
    if verbose:
        for e in events:
            print(f"   t={e[0]:7.1f}s {e[1][1]} {e[1][2]}")
    return d, true_ph, max_ph, feed_state, kinds


def main():
    fails = 0

    def check(cond, msg):
        nonlocal fails
        print(("  ok   " if cond else "  FAIL ") + msg)
        fails += 0 if cond else 1

    d, ph, mx, fs, k = run("normal: 6.6 -> 7.0")
    check(d.state == "idle" and ph >= 6.95 and mx < 7.15, "reaches target without large overshoot")
    check(fs == "closed", "feed valve returns to original \"closed\" afterwards")

    d, ph, mx, fs, k = run("base solution empty (no response)", gain=0.0)
    check(d.state == "fault" and "pH did not rise" in d.fault_msg, "3 consecutive no-response doses -> FAULT")
    check(fs == "closed", "feed valve returns to closed on FAULT")

    d, ph, mx, fs, k = run("pH invalid mid-run 20-25 min", ph_invalid=(1200, 1500), minutes=60)
    check("paused" in k and "resumed" in k, "pauses while pH invalid, resumes afterwards")

    d, ph, mx, fs, k = run("hourly limit 3", gain=0.01, cfg=dict(max_doses_h=3), minutes=50)
    check(d.total_doses == 3 and d.state == "idle", "hourly pulse limit enforced")

    d, ph, mx, fs, k = run("already above target", ph0=7.3, minutes=20)
    check(d.total_doses == 0, "no base dosing when pH already sufficient")
    a = d.alerts(7.6, True)
    check(any(x["code"] == "ph_high" for x in a), "pH too high only raises an alert")

    d, ph, mx, fs, k = run("feed valve offline during base dosing", feed_offline=(100, 160), minutes=30)
    check("paused" in k, "feed valve offline -> pause")

    print("\n" + ("all checks passed" if not fails else f"{fails} checks failed"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
