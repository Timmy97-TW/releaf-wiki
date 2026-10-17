# -*- coding: utf-8 -*-
# ==========================================================================
# v3.4.1: the file header was changed from a """docstring""" to # comments. If a section is added or lost when the file is copied/pasted,
#         docstring quotes end up misaligned, and the whole Chinese description is parsed as code, producing
#         "SyntaxError: invalid character" - with comments this can no longer happen.
# ==========================================================================
# Integrated main.py (Linux/MPU side, Arduino UNO Q / App Lab)
# ============================================================================
# v6.2 (2026-10-16) - pairs with MCU firmware v4.2.0. The second L298N pump is the feed pump: what it pumps is chosen by the feed
#   valve; it runs continuously like the main pump (feed_pump_set: PWM + direction). Base dosing pulses (auto pH / manual) are
#   unchanged but manual dosing no longer turns the feed valve by itself: it only works while the feed valve is on "base".
#   v6.2.2: the feed pump is single-direction (fw v4.2.2 drives IN4 only; IN3 = D12 does not go high on the board).
#   The feed valve "base" position can now be chosen by the user. Auto pH pauses while the feed pump runs. CSV adds feed_pump_pwm, feed_pump_forward.
# v6.1 (2026-10-16) - specific growth rate mu (growth_rate.py, 2 new CSV columns); web UI layout v6.1.
# v6.0 (2026-10-16) - pairs with MCU firmware v4.1.1 (v4.1.0 + consecutive L298N pins)
#   Division of responsibility unchanged: MCU does sampling / actuation / safety interlocks; this file does all algorithms, storage and logging; the web UI only displays and sends commands.
#   A. Pressure protection: any of the 3 MCU channels > 0.7 bar (adjustable) for 50 ms in a row -> stop main pump + stop base dosing + release pinch valve + latch.
#      This side stores the limit and pushes it back after an MCU reboot; while latched pump_state is zeroed (no auto-restart after reboot); only the user can clear it.
#   B. Second L298N pump = base pump (6 consecutive L298N pins D8-D13: IN1 D8 / ENA D9 / IN2 D10 / ENB D11 / IN3 D12 / IN4 D13). The MCU handles pulse timing, the feed-valve-in-position interlock and the hourly limit.
#   C. Two new STS3215 valves: shell sampling valve (ID 2: fully closed 315° / to pressure gauge 270° / fully open 0°)
#      and feed valve (ID 3: fully closed 315° / base dosing 270° / external feed 180°).
#   D. Automatic pH (base dosing only): ph_control.py decides every second "switch valve -> pump 5 s -> wait for steady state -> re-evaluate"; pH too high only raises an alarm.
#   E. CSV adds shell_valve, feed_valve, base_pulses, base_pulse_ms, ph_ctrl_state, ph_target, p_trip, p_max_bar.
#   F. record_saved no longer sends rows (the web UI no longer builds the CSV; it only uses csv_text / download_url).
#   G. set_pump_pwm no longer pretends to succeed when the MCU rejects it (pressure protection latched).
# ============================================================================
# v5.0 (2026-10-14) - pairs with MCU firmware v4.0.0 "raw sampling edition"
#   A. The MCU only samples and controls; all algorithms moved here:
#        pressure  on_p_raw    100 Hz ADC sums -> bar conversion, zero offset, 1 s window stats, same-instant TMP peak/trough, pulsation frequency
#        flow      on_flow_raw pulse count / first-to-last interval -> gated or reciprocal counting; aggregate-window flow = total pulses in window / total time (no quantization error)
#        OD600 on_od_raw   the 8 algorithms of photometer v1.2.0 (photometer_algos.py), each with its own blank, bubble weighting
#        pH    on_aux_raw  256-point ADC sum -> voltage -> Nernst temperature compensation -> jump confirmation + EMA; temperature source selected here
#      All calibration values (pressure zero, OD blank, path-length factor, pH calibration) live on the Linux side and survive MCU reboots;
#      only the pressure zero needed by the pinch valve safety interlock is pushed to the MCU.
#   B. Raw data logging (raw_logger.py): while recording, also saves recordings/<recording>_raw/, keeping every raw value sent by the MCU;
#      tools/replay_raw.py and tools/replay_od.py can recompute afterwards.
#   C. Fixes per section 4 of the "Documentation": TMP_mean subtracts rho*g*h/2, mu uses DS18B20 temperature, TMP instantaneous peak/trough alarms restored,
#      initial L_p captured only at steady state, dP-Q fit model selection now uses adjusted R², removed unused compute_derived/compute_alerts.
#   Frontend message format unchanged (web UI v5.0 only adds the 8 OD algorithms, sensor re-init, and raw data status).
# ============================================================================
# Merged sources:
#   1. OD600 photometer (main.py of the former OD600 project)
#   2. ZJ-TM02 flow meter - real-time web monitoring
#   3. Hollow-fiber membrane filtration system - real-time pressure monitoring
#   4. Peristaltic pump PWM control (L298N)
#
# Changes in this version (integrated v1) relative to the previous "flow + pressure + pump" version:
#   1. [Added] OD600 integration: the MCU proactively calls notify("on_od600_update") when a measurement completes,
#      and the Python side also periodically polls get_od_data() to fill gaps (insurance for reconnects/missed messages).
#      OD600 blank calibration, measure-now, measurement interval, path-length correction factor and developer mode
#      (LED alignment tool) are all kept, and are now operated via WebSocket messages in this file.
#   2. [Added] Recording CSV also logs OD600 and pump PWM: recording sample rate stays at 1 Hz;
#      since OD600 has a longer measurement period (default 30 s), each row reuses the "latest" measurement,
#      plus od600_age_s (how many seconds ago this OD600 was measured) and od600_new (whether this row
#      corresponds exactly to a new measurement); analysis can pick only rows with od600_new=1 to recover the true measurement points.
#   3. [Removed] Automated dP-Q sweep experiment (start_dp_q_sweep / abort_dp_q_sweep and related
#      CSV/status broadcasts) and the jumper/hollow-fiber reference file (calibration_library.json and
#      get_calibration_library / apply_calibration_entry).
#      blank/module factors are now maintained directly in constants.json.
#   4. [Removed] Pump "flow mode" (target flow + P controller pump_flow_control_loop).
#      Tests showed the peristaltic pump's instantaneous flow pulsation makes the P controller oscillate; only direct PWM control remains.
#   5. The base pressure unit is still fixed to bar (logging/calculation/constants all in bar);
#      psi / MPa are converted only for frontend display and do not affect the logged raw values.
#      Flow unit mL/min, OD600 unit AU.
#
# Integrated v2 (2026-09-01) changes:
#   A. [Fixed] One cause of "pressure/flow freezing during OD600 sampling" was in this file:
#      on_od600_update() is a Bridge notify callback, and the old version called
#      refresh_blank_info() directly inside it, which internally does a synchronous Bridge.call("get_blank_info").
#      Issuing a synchronous RPC inside an RPC callback ties up the entire Bridge link (the link only continues
#      with the next packet after the callback returns), and pressure notify and flow polling use that very same link.
#      Now the callback only sets a flag; the actual read is handed to the separate od600_poll_loop thread.
#      (The other two causes are on the MCU side; see the BH1750Simple comments in sketch.ino.)
#   B. [Added] Aggregate sampling: pressure and flow are now collected within a "sampling window" (default 30 s, adjustable in the UI)
#      and at the end of each window the median or mean is taken (switchable in the UI) as the displayed value and one CSV row.
#      The sampling duration is shared by all three - changing it also sets the MCU OD600 measurement interval to the same value,
#      so OD600 / pressure / flow always stay on the same time cadence.
#      Safety-related fast paths are unaffected: TMP instantaneous peak/trough alarms and collapse pressure protection
#      still use the raw statistics the MCU sends every 200 ms and are not masked by the 30 s average.
#   C. [Added] mcu_diag: reads the MCU real-time diagnostics every 5 s (max loop duration, number of pressure samples
#      actually completed in the last second), to check whether loop() is being blocked again.
#   D. [Changed] Recording CSV is now "one row per window" (default one row per 30 s), no longer one row per second.
#
# Integrated v2.3 (2026-09-06) changes - strengthening "the board records on its own":
#   A. [Changed] Recording now "writes each window to disk as soon as it is produced" (append + flush + fsync), instead of
#      keeping the whole session in memory and writing the file on stop. The old way meant a power loss/crash/reboot wiped the whole session,
#      and that "the board records on its own" only held on a normal stop. Now at worst only the window that has not
#      finished yet is lost. It also decouples memory usage from recording length (a 72-hour recording no longer sits entirely in RAM).
#   B. [Added] Automatic resume after interruption: recording_state.json tracks the active recording; after the App or the whole board
#      restarts, it automatically reopens the same file and continues writing; elapsed accumulates real elapsed time, and the interrupted span
#      is honestly recorded in the next row's gap_s field (new CSV column).
#   C. [Added] HTTP download endpoints /download/recording and /api/recordings, plus a recording file list in the UI.
#      Full files no longer need to go through the WebSocket, nor depend on "a browser being connected at the moment of stopping".
#      (If the WebUI Brick has no expose_api this is skipped automatically; the files remain in the recordings/ folder.)
#   D. Reminder: logging already runs on the board's Linux side, independent of the browser - a sleeping PC does not interrupt logging.
#      If data is really missing during sleep, check whether the board lost power (common when powered from a PC USB port)
#      or whether the App was stopped; see README §11.
#
# Integrated v3.7 (2026-10-04): switchable sampling/analysis algorithms per the "Signal Processing Algorithm Review Report"
#   (flow reciprocal counting C-1, OD600 estimation E-2/E-3/E-5, analysis path without EMA F-1, aggregation G-2/G-3,
#    steady-state confidence interval + hysteresis H-1/H-3, quadratic-fit curvature H-8); CSV adds G-4 stats columns and alg_profile.
#   New message: "alg_settings" { ok, error, settings, options, profile }
#   Frontend -> backend: "get_algorithms" / "set_algorithms" {flow?, od_estimator?, analysis_source?, steady?, curvature?}
#
# Integrated v3.4 (2026-10-03):
#   A. pH manual compensation temperature (ph_set_temp); two-point calibration can specify the buffer temperature; both are saved and pushed back after MCU reboot.
#   B. Pinch valve servo auto-scan (valve_scan / valve_use_found): 8 baud rates x ID 0~253; based on the number of bytes received
#      decides whether it is a wiring problem or an ID/baud problem; pinch valve config gains a baud field.
#
# Integrated v3.2 (2026-10-03) debugging release:
#   A. All startup Bridge.call syncs with the MCU moved to a background thread; the web UI is no longer stalled by MCU timeouts.
#   B. New mcu_link status: when get_diag fails the Console prints the reason, and the web UI shows a red banner and the MCU firmware version.
#
# Integrated v3.1 (2026-10-03) changes:
#   A. [Removed] Pump PWM dead zone (1~99 auto-zeroed). New pump, 0-255 sent directly.
#   B. [Removed] pH KOH base dosing control. pH is monitoring + two-point calibration + logging only. The CSV pH columns are now
#      ph, ph_temp_c, ph_state (WARMUP / OK / PROBE_ERROR).
#
# Integrated v3 (2026-10-02) changes - merging in pH and the STS3215 pinch valve:
#   A. [Added] pH: MCU calls notify("on_ph_update") every second; calibration points are saved to ph_valve_state.json
#      and pushed back automatically when the MCU reboots.
#   B. [Added] Pinch valve: manual open/close + setup tools (jog, torque off, save current position as open/clamped).
#      Automatic release on TMP/Feed over-limit, clamp timeout and overheating is on the MCU side. Each "clamp -> release" writes one row to
#      recordings/valve_events.csv (clamp duration, TMP mean/peak during clamp, release reason).
#   C. [Added] CSV gains 6 columns: ph, ph_temp_c, ph_state, valve_state, valve_closed_frac, valve_pos.
#      When resuming, if the old file uses the old column format, a new file is opened instead (no misaligned rows appended to the old file).
#   D. [Added] System alarms: pH data interrupted / probe fault, pinch valve FAULT / offline / clamped.
#      During clamping and for valve.alert_settle_sec (default 60 s) after release, fouling-trend alarms such as dP/R/dTMP/dt/d²TMP
#      are suspended (taking a sample naturally makes them jump); absolute TMP limit alarms are unaffected.
#   E. On pump emergency stop the MCU also releases the pinch valve.
#
# Target: Arduino UNO Q, Arduino App Lab, WebUI - HTML Brick
#
# Required setup in App Lab:
#   1. Left side Add Brick -> search for and add "WebUI - HTML"
#   2. assets/libs/socket.io.min.js and assets/libs/arduino.js must be added manually
#   3. Make sure the UNO Q is connected to WiFi
#   4. Flash the integrated sketch.ino on the MCU side
#   5. constants.json must be in the same folder as main.py
#
# ----------------------------------------------------------------------------
# WebSocket messages received by the frontend (index.html):
#   - "flow_config"        : { maxValue, unit }
#   - "flow_update"        : { freq, flow, total }
#   - "pressure_update"    : { ts, channels:{feed/retentate/permeate:{peak,trough,
#                              mean_raw,mean_filtered,cycle_freq_hz}},
#                              tmp:{peak,trough,mean_raw,mean_filtered},
#                              filtered:{feed,retentate,permeate,tmp} }   unit bar
#   - "zero_calibrate_done": { ts }
#   - "od600_update"       : { ts, od600, lux_sample, lux_ref, lux_ratio, bubble_pct,
#                              valid, blank_set, meas_seq, age_s, busy }
#   - "od600_blank"        : { blank_set, lux_sample, lux_ref, lux_ratio }
#   - "od600_settings"     : { ok, measure_interval_sec, path_length_factor, error? }
#   - "od600_dev_status"   : { dev_mode }
#   - "od600_dev_readings" : { dev_mode, lux_sample, lux_ref, lux_ratio,
#                              sample_error, ref_error, expected_lux_ratio,
#                              lux_ratio_warn_band }
#   - "record_status"      : { state, elapsed_sec, sample_count, duration_sec }
#   - "hfm_state"          : (v4) { ok, error, action, state{rho_gh_kpa, dp_a, dp_b, q_perm_mlmin, lp_initial, ps_ref_kpa...},
#                            selftest{state, progress, message, result}, constants{...} }
#     Frontend -> backend: hfm_get_state / hfm_set{rho_gh_kpa?, dp_a?, dp_b?, q_perm_mlmin?, reset_lp_initial?}
#                   / hfm_dp_baseline_from_now / hfm_selftest_start / hfm_selftest_cancel
#   - "chart_history"      : (v3.8) { t0, now, window_sec, rows:[{t,od,flow,ph,temp,vc,pr{},pf{},b?}], markers:[{t,k}] }
#   - "chart_marker"       : (v3.8) { t, k: start|stop|resume }  chart marker for recording start/stop/resume
#   - "record_saved"       : { filename, sample_count, elapsed_sec, auto, rows }
#   - "derived_update"     : see derive_loop(), pushed once per second
#   - "baseline_captured"  : { R_bar_per_mlmin, delta_p_bar, tmp_bar, captured_at, source }
#   - "pump_status"        : { pwm, forward, bridge_error }
#   - "aggregate_update"   : pushed once at the end of each sampling window (default 30 s). Fields: see _build_aggregate_row(),
#                            including window info (window_index/window_sec/agg_method/n_samples_*),
#                            aggregated pressure (bar) and flow (mL/min), worst TMP peak/trough in the window,
#                            current OD600 and pump status, and derived parameters recomputed from the aggregated values.
#                            This is exactly one row of the recording CSV.
#   - "aggregate_settings" : { window_sec, method, min_window_sec, max_window_sec, next_update_in_sec }
#   - "record_resumed"     : { filename, row_count, elapsed_sec, gap_sec }
#                            after App/board restart, automatically resumed the interrupted recording
#   - "recordings_list"    : { dir, files:[{name,size_bytes,modified_at,active,download_url}] }
#   - "record_error"       : { error } failed to create the recording file
#   - "ph_update"          : { ts, ph, voltage, temp_c, state(WARMUP|OK|PROBE_ERROR), config, stale }
#   - "ph_config"          : { ok, error, action, config:{v7,v4,cal_temp}, source }
#   - "valve_update"       : { online, cmd(open|closed|jog), fault, pos, goal, load, temp_c, voltage_v,
#                              current, moving, closed_s, torque, configured, msg, config,
#                              settle_remaining_s }   (v3)
#   - "valve_config"       : { ok, error, action, config:{id,open,closed,speed,acc,torque_limit,
#                              max_close_s,tmp_limit,feed_limit} }
#   - "valve_action_result": { action, ok, error }
#   - "valve_event"        : record of one "clamp -> release" cycle (same as one row of valve_events.csv)
#   - "valve_events_list"  : { events:[...], file }
#   - "valve_scan"         : { state(running|done|error), progress, baud, found:[{id,baud}], rx:{baud:bytes},
#                              hint(found|no_bytes|garbled), error }   (v3.4)
#   - "mcu_diag"           : { loop_max_us, pressure_samples_last_sec, od_state, reinit_step }
#   - "mcu_link"           : { ok, error, since, fw, last_ok }   (v3.2) whether the Python <-> MCU Bridge is up
#                            MCU real-time diagnostics: loop_max_us is the longest loop() duration in the last second,
#                            pressure_samples_last_sec should normally be close to 100 (100 Hz); clearly lower
#                            means loop() is being blocked by something again
#
# Frontend -> backend:
#   - "get_config"          : request flow meter config (maxValue/unit)
#   - "subscribe"           : request an immediate resend of current flow data
#   - "zero_calibrate"      : trigger pressure zero calibration
#   - "start_record"        : { duration_sec? } start recording (if seconds given, auto-stop and save when time is up)
#   - "pause_record"        : toggle between recording / paused
#   - "stop_record"         : manually stop recording and output CSV
#   - "capture_baseline"    : set current R / dP / TMP as the baseline
#   - "set_manual_baseline" : { R_bar_per_mlmin?, delta_p_bar?, tmp_bar? }
#   - "clear_baseline"      : clear the baseline
#   - "set_pump_pwm"        : { pwm } set pump PWM (0-255); sent only when "Apply" is pressed
#   - "set_pump_direction"  : { forward } switch direction (sets PWM to zero first)
#   - "stop_pump"           : emergency stop
#   - "od_calibrate_blank"  : queue one measurement and set the result as the OD600=0 reference (I0)
#   - "od_measure_now"      : queue an OD600 measurement immediately (without waiting for the auto cycle)
#   - "od_set_dev_mode"     : { on } developer mode (LED always on for alignment, OD600 auto measurement paused)
#   - "od_get_dev_readings" : request one real-time unfiltered sample/reference reading
#   - "od_get_settings"     : request current OD600 measurement interval / path-length correction factor
#   - "od_set_settings"     : { measure_interval_sec?, path_length_factor? }
#   - "list_recordings"     : request the list of recording files in the board's recordings/ folder
#   - "get_aggregate_settings" : request the current sampling duration and aggregation method
#   - "set_aggregate_settings" : { window_sec?, method? } method is "median" or "mean";
#                                changing window_sec also sets the MCU OD600 measurement interval to the same value
#   --- v3 pH ---
#   - "ph_get_config"   - "ph_calibrate" {point:"7"|"4", buffer_temp?}   - "ph_set_temp" {temp}   (v3.4)
#   - "ph_set_calibration" {v7, v4, cal_temp}   (v3.10: manual entry in calibration management)
#   --- v3 pinch valve ---
#   - "valve_open" / "valve_close" / "valve_clear_fault" / "valve_rescan" / "valve_list_events"
#   - "valve_scan" {mode:"full"|"quick"}   - "valve_use_found" {id, baud}   (v3.4)
#   - "valve_goto_raw" {pos}   - "valve_torque" {on}   - "valve_save_position" {which:"open"|"closed"}
#   - "valve_get_config" / "valve_set_config" {id?,open?,closed?,speed?,acc?,torque_limit?,
#                                               max_close_s?,tmp_limit?,feed_limit?}
# ============================================================================

import threading
import time
import os
import json
import math
import traceback
from collections import deque

from arduino.app_utils import *
from arduino.app_bricks.web_ui import WebUI

# ============================= v4.8: all MCU calls are queued =============================
# Observed problem (2026-10-08): after the PC wakes from sleep, the web UI reconnects and sends a dozen-plus requests at once, 6~8 of which call the MCU,
# plus the background get_flow_data every second, so several Bridge.calls squeeze into the MCU at the same time. After that the "Linux -> MCU" command channel
# stops responding: pump/pinch valve buttons do nothing, flow stuck at an old value; but data pushed by the MCU itself (pressure) and the Serial Monitor keep working.
# Fix: every Python -> MCU call goes through this layer - only one sent at a time (queued), shorter timeout,
# and consecutive failures are shown clearly in the Console and as a red banner in the web UI.
_RawBridge = Bridge
MCU_CALL_TIMEOUT_S = 5.0
MCU_CALL_SLOW = {"zero_calibrate": 15.0, "ds_diag": 8.0, "ds_timing": 8.0, "calibrate_blank": 10.0}
MCU_RPC_FAIL_STREAK = 3          # number of consecutive failures before the "command channel down" state
_mcu_call_lock = threading.RLock()
_sim_py_down_until = 0.0
mcu_rpc = {"ok": True, "fail_streak": 0, "calls": 0, "fails": 0, "last_ok": None,
           "last_err": None, "down_since": None}


class _QueuedBridge:
    """Wraps arduino.app_utils.Bridge: call() is queued; provide()/notify() are passed through unchanged."""

    @staticmethod
    def provide(*a, **k):
        return _RawBridge.provide(*a, **k)

    @staticmethod
    def notify(*a, **k):
        return _RawBridge.notify(*a, **k)

    @staticmethod
    def call(method_name, *params, timeout=None):
        if _sim_py_down_until and time.time() < _sim_py_down_until:      # v4.9 test: simulate a Python-side disconnect
            _mcu_rpc_record(False, f"{method_name}: simulated disconnect (test)")
            raise TimeoutError(f"Simulated disconnect (test): {method_name}")
        t = timeout if timeout is not None else MCU_CALL_SLOW.get(method_name, MCU_CALL_TIMEOUT_S)
        if not _mcu_call_lock.acquire(timeout=t + 10.0):
            _mcu_rpc_record(False, f"{method_name}: queue timeout (previous MCU call stuck)")
            raise TimeoutError(f"MCU call queue timeout: {method_name}")
        try:
            try:
                res = _RawBridge.call(method_name, *params, timeout=t)
            except TypeError:
                res = _RawBridge.call(method_name, *params)      # old/test Bridge has no timeout parameter
        except Exception as e:
            _mcu_rpc_record(False, f"{method_name}: {type(e).__name__}: {e}")
            raise
        finally:
            _mcu_call_lock.release()
        _mcu_rpc_record(True)
        return res


def _mcu_rpc_record(ok, err=None):
    went_down = came_back = False
    with _mcu_call_lock:
        mcu_rpc["calls"] += 1
        if ok:
            came_back = not mcu_rpc["ok"]
            mcu_rpc.update(ok=True, fail_streak=0, last_ok=time.time(), down_since=None)
        else:
            mcu_rpc["fails"] += 1
            mcu_rpc["fail_streak"] += 1
            mcu_rpc["last_err"] = err
            if mcu_rpc["ok"] and mcu_rpc["fail_streak"] >= MCU_RPC_FAIL_STREAK:
                mcu_rpc.update(ok=False, down_since=time.time())
                went_down = True
    if went_down:
        alive = _mcu_push_recent()
        msg = ("MCU not receiving commands" + (" (MCU data still streaming: Linux->MCU command channel down)" if alive else "")
               + f"; last error: {err}")
        print(f"[mcu] !! {msg}\n       -> Fix: stop and restart the App in App Lab; if that fails, unplug UNO Q power for 10 s")
        try:
            _set_mcu_link(False, msg)
        except Exception:
            pass
    elif came_back:
        print("[mcu] command channel restored")
        try:
            _set_mcu_link(True)
        except Exception:
            pass


def _mcu_push_recent():
    """Whether pressure data pushed by the MCU was received in the last 5 s (tells whether the MCU itself is still alive)."""
    try:
        return (time.time() - float(latest_pressure.get("ts") or 0)) < 5.0
    except Exception:
        return False


Bridge = _QueuedBridge

# ============================= Shared =============================
ui = WebUI()

# ---- v3.3 debugging: trace web UI <-> Python messages ----
# Every command from the web UI prints one line "[ui] <- name data" in the Console; every 10 s it prints the count of messages sent to the web UI
# and whether the WebUI event loop is running. Used to tell whether "pressed but nothing happened" is stuck at web UI -> Python,
# Python -> MCU, or the MCU itself. After debugging, UI_TRACE can be set to False.
UI_TRACE = True
_UI_TRACE_SKIP = ("od_get_dev_readings",)
_orig_on_message = ui.on_message
_orig_send_message = ui.send_message
_ui_sent_counts = {}
_ui_sent_lock = threading.Lock()
_ui_trace_last = time.time()


def _traced_on_message(message_type, callback):
    def wrapper(client, data, _cb=callback, _name=message_type):
        if UI_TRACE and _name not in _UI_TRACE_SKIP:
            print(f"[ui] <- {_name} {data}")
        try:
            return _cb(client, data)
        except Exception:
            print(f"[ui] !! exception while handling '{_name}':\n{traceback.format_exc()}")
            raise
    _orig_on_message(message_type, wrapper)


def _traced_send_message(message_type, message, *args, **kwargs):
    global _ui_trace_last
    if UI_TRACE:
        with _ui_sent_lock:
            _ui_sent_counts[message_type] = _ui_sent_counts.get(message_type, 0) + 1
            now = time.time()
            if now - _ui_trace_last >= 10:
                loop = getattr(ui, "_server_loop", "n/a")
                running = loop.is_running() if hasattr(loop, "is_running") else loop
                top = ", ".join(f"{k}×{v}" for k, v in sorted(_ui_sent_counts.items(), key=lambda kv: -kv[1])[:6])
                print(f"[ui] -> sent to web in last 10 s: {top or 'none'} | WebUI event loop running: {running}")
                _ui_sent_counts.clear()
                _ui_trace_last = now
    return _orig_send_message(message_type, message, *args, **kwargs)


ui.on_message = _traced_on_message
ui.send_message = _traced_send_message

# ============================= External constants file =============================
# Spec §2 requires: no constants (especially calibrated/provisional values) may be hard-coded; they must be in an external config file,
# and the constants version in use must be recorded with every data record.
#
# Normally constants.json should be in the same folder as main.py (after App Lab deployment
# usually /app/python/constants.json). If it cannot be found/read it does not crash; it falls back to
# embedded defaults and prints a warning, and also tells the frontend via derived_update that embedded values are in use.
_SEARCH_DIR = os.path.dirname(os.path.abspath(__file__))
_CANDIDATE_CONFIG_PATHS = [
    os.path.join(_SEARCH_DIR, "constants.json"),
    os.path.join(os.getcwd(), "constants.json"),
    "/app/python/constants.json",
]

_DEFAULT_CONST = {
    # Minimal embedded values when constants.json is not found (everything else uses the defaults of each CONST.get call)
    "config_version": "embedded-fallback",
    "constants_version": "embedded-fallback",
    "provisional_constants": ["pressure_mean_filter_alpha"],
    "thresholds": {"tmp_critical_bar": 0.5, "tmp_trough_negative_bar": -0.02},
}


def _load_constants():
    for path in _CANDIDATE_CONFIG_PATHS:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"[constants] loaded constants from {path}")
            return data, path
        except FileNotFoundError:
            continue
        except (json.JSONDecodeError, OSError) as e:
            print(f"[constants] WARNING: {path} exists but failed to read/parse ({e}), trying other paths")
            continue

    print(
        "[constants] WARNING: constants.json not found in any of these paths, using embedded defaults (embedded-fallback):\n  "
        + "\n  ".join(_CANDIDATE_CONFIG_PATHS)
        + "\n  Make sure constants.json is in the same folder as main.py (on App Lab usually /app/python/)."
    )
    return dict(_DEFAULT_CONST), None


CONST, CONFIG_SOURCE_PATH = _load_constants()
CONSTANTS_FROM_FILE = CONFIG_SOURCE_PATH is not None

CONFIG_VERSION = CONST.get("config_version", "unknown")
CONSTANTS_VERSION = CONST.get("constants_version", "unknown")
PROVISIONAL_CONSTANTS = list(CONST.get("provisional_constants", []))
if not CONSTANTS_FROM_FILE:
    PROVISIONAL_CONSTANTS = PROVISIONAL_CONSTANTS + ["ALL (constants.json not found, using embedded defaults)"]

THRESH = CONST.get("thresholds", {})

STEADY_WINDOW_S = CONST.get("steady_window_s", 60)
STEADY_SLOPE_THRESH_BAR_MIN = CONST.get("steady_slope_thresh_bar_per_min", 0.001)
STEADY_SD_THRESH_BAR = CONST.get("steady_sd_thresh_bar", 0.003)
STEADY_FLOW_SLOPE_THRESH = CONST.get("steady_flow_slope_thresh_mlmin_per_min", 5.0)
STEADY_FLOW_SD_THRESH = CONST.get("steady_flow_sd_thresh_mlmin", 5.0)

TREND_WINDOW_S = CONST.get("trend_window_s", 60)
D2_WINDOW_S = CONST.get("d2_window_s", 120)

import photometer_algos as PA          # v5.0: OD600 algorithms (shared with the inline photometer)
import raw_logger as RL                # v5.0: raw data logging
import od_gate as OG                   # v5.1: gate layer after the OD600 estimator (shared with replay_od)
import growth_rate as GR             # v6.1: specific growth rate mu from ln(OD600)

_RAW_CONST = CONST.get("raw_logging") or {}
RAW_LOG_ENABLED = bool(_RAW_CONST.get("enabled", True))
RAW_DISK_WARN_BYTES = float(_RAW_CONST.get("disk_warn_mb", 2048)) * 1e6
RAW_DISK_STOP_BYTES = float(_RAW_CONST.get("disk_stop_mb", 500)) * 1e6

# ============================= v5.0: MCU conversion constants / time mapping / background jobs =============================
# The MCU sends only raw counts; conversion constants (divider ratio, VREF, ADC bits, oversample count, BH1750 lux/count) are provided by the MCU get_config(),
# and the values actually flashed on the MCU are authoritative (keeping two copies of the constants will drift apart someday). Until read, the v4.0.0 defaults are used.
mcu_cfg = {"adc_bits": 14, "vref": 3.3, "div": 22.0 / 37.0, "vmax": 5.0, "barmax": 10.0, "ovs": 16,
           "p_period_ms": 10, "od_interval_s": 30.0, "ref_mode": 0, "mt": 69, "h2": 1, "period_ms": 130,
           "lpc": 1.0 / 2.4, "ph_ovs": 256, "fw": None, "from_mcu": False}


def mcu_cfg_refresh():
    """Read the MCU get_config(). Returns whether it succeeded."""
    try:
        kv = _parse_kv(Bridge.call("get_config", ""))
    except Exception as e:
        print(f"[mcu] get_config failed: {e}")
        return False
    for k in ("vref", "div", "vmax", "barmax", "od_interval_s", "lpc"):
        if _f(kv.get(k)) is not None:
            mcu_cfg[k] = _f(kv.get(k))
    for k in ("adc_bits", "ovs", "p_period_ms", "ref_mode", "mt", "h2", "period_ms", "ph_ovs"):
        if _i(kv.get(k)) is not None:
            mcu_cfg[k] = _i(kv.get(k))
    mcu_cfg["fw"] = kv.get("fw")
    mcu_cfg["from_mcu"] = True
    return True


def _adc_max():
    return float((1 << int(mcu_cfg["adc_bits"])) - 1)


def counts_to_bar0(s):
    """16-point ADC sum -> bar (zero not subtracted). Same formula as MCU sumToBar()."""
    adc = s / float(mcu_cfg["ovs"])
    return (adc / _adc_max() * mcu_cfg["vref"] / mcu_cfg["div"]) / mcu_cfg["vmax"] * mcu_cfg["barmax"]


# MCU millis() -> wall-clock time: take the approximate minimum of "receive time - MCU time" (the samples with the least transport delay are most accurate),
# allowing 0.5 ms drift per batch; if the difference exceeds 5 s (MCU reboot, millis reset) it is reset.
_clock = {"off": None}


def mcu_ms_to_epoch(mcu_ms, recv_epoch):
    cand = recv_epoch - mcu_ms / 1000.0
    off = _clock["off"]
    if off is None or abs(cand - off) > 5.0:
        off = cand
    else:
        off = min(off + 0.0005, cand)
    _clock["off"] = off
    return off


# Inside a Bridge callback never do a synchronous Bridge.call (it ties up the whole Bridge); work that needs to call the MCU goes onto this queue
import queue as _queue
_mcu_jobs = _queue.Queue()


def mcu_job(fn, *args):
    _mcu_jobs.put((fn, args))


def _mcu_job_loop():
    while True:
        fn, args = _mcu_jobs.get()
        try:
            fn(*args)
        except Exception:
            print(f"[mcu] background task failed:\n{traceback.format_exc()}")


# Raw-data session of the active recording (see the "Raw data logging" section); None = not recording
raw_session = None


def raw_event(kind, detail=None):
    rs = raw_session
    if rs is not None:
        try:
            rs.event(kind, detail)
        except Exception as e:
            print(f"[raw] event write failed: {e}")


# ============================= flow meter (ZJ-TM02) =============================
_FLOW_CONST = CONST.get("flow") or {}
FLOW_PULSES_PER_LITER = float(_FLOW_CONST.get("pulses_per_liter", 2580.0))   # large orifice 2580; small orifice 5160
MAX_FLOW_MLMIN = float(_FLOW_CONST.get("max_flow_mlmin", 4000))
FLOW_UNIT = "mL/min"
FLOW_STALE_SEC = 3.0

latest_flow = {"freq": 0.0, "flow": 0.0, "total": 0.0, "ts": 0.0, "src": None, "stale": True,
               "pulses": 0, "window_ms": 0, "freq_gate": 0.0, "freq_recip": None}
_flow_last_seq = None
flow_dropped = 0


def on_flow_raw(payload):
    """MCU every second: "seq,t_ms,window_ms,pulses,span_us,total_pulses". Bridge callback: no synchronous RPC."""
    global latest_flow, _flow_last_seq, flow_dropped
    try:
        p = [int(float(x)) for x in str(payload).split(",")]
        seq, t_ms, win_ms, pulses, span_us, total = p[:6]
    except (ValueError, TypeError):
        print(f"[flow] WARNING: on_flow_raw got bad payload: {payload}")
        return
    recv = time.time()
    if _flow_last_seq is not None and seq > _flow_last_seq + 1:
        flow_dropped += seq - _flow_last_seq - 1
        raw_event("flow_gap", {"missing": seq - _flow_last_seq - 1, "seq": seq})
    _flow_last_seq = seq
    win_s = max(win_ms, 1) / 1000.0
    f_gate = pulses / win_s
    f_recip = ((pulses - 1) / (span_us / 1e6)) if (pulses >= 2 and span_us > 0) else None
    freq = f_recip if (alg_settings.get("flow") == "reciprocal" and f_recip is not None) else f_gate
    flow = freq * 60.0 / FLOW_PULSES_PER_LITER * 1000.0
    total_ml = total / FLOW_PULSES_PER_LITER * 1000.0
    latest_flow = {"freq": round(freq, 4), "flow": round(flow, 3), "total": round(total_ml, 2), "ts": recv,
                   "src": "push", "stale": False, "pulses": pulses, "window_ms": win_ms,
                   "freq_gate": round(f_gate, 4), "freq_recip": None if f_recip is None else round(f_recip, 4)}
    agg_push_flow(freq, flow, total_ml, pulses, win_ms)
    rs = raw_session
    if rs is not None:
        rs.write("flow", [[f"{mcu_ms_to_epoch(t_ms, recv) + t_ms / 1000.0:.3f}", t_ms, seq, win_ms, pulses, span_us, total]])
    ui.send_message("flow_update", latest_flow)


Bridge.provide("on_flow_raw", on_flow_raw)


def on_get_config(client, data):
    ui.send_message("flow_config", {"maxValue": MAX_FLOW_MLMIN, "unit": FLOW_UNIT}, client)


def on_subscribe(client, data):
    ui.send_message("flow_update", dict(latest_flow), client)


def push_flow_loop():
    """When MCU push stops (disconnect / old firmware), notify the web UI that flow data is stale; not written to the aggregate (CSV column left empty)."""
    global latest_flow
    while True:
        try:
            if not latest_flow.get("stale") and time.time() - (latest_flow.get("ts") or 0) > FLOW_STALE_SEC:
                latest_flow = dict(latest_flow, stale=True)
                ui.send_message("flow_update", latest_flow)
        except Exception:
            pass
        time.sleep(1.0)


ui.on_message("get_config", on_get_config)
ui.on_message("subscribe", on_subscribe)

# ============================= Pressure (membrane filtration) =============================
# Every 200 ms the MCU sends a batch of 100 Hz raw ADC sums (zero not subtracted). Here we:
#   1. convert to bar and subtract zero (zero is stored on the Linux side; the same set is also pushed to the MCU for the safety interlock)
#   2. put into a ring buffer; per batch compute, over the last 1 s (or auto-extended per pulsation frequency to cover 3 cycles, max 5 s),
#      peak / trough / mean / pulsation frequency - output format identical to v4.x on_pressure_update
#   3. TMP peak/trough computed from the three channels at "the same instant" (v4.x combined each channel's own extremes, at different times)
#   4. raw sums are written to the recording's raw folder
PRESSURE_CHANNELS = ("feed", "retentate", "permeate")
PSI_PER_BAR = 14.5038
PRESSURE_MEAN_FILTER_ALPHA = float(CONST.get("pressure_mean_filter_alpha", 0.3))
_P_CONST = CONST.get("pressure") or {}
P_STATS_WINDOW_S = float(_P_CONST.get("stats_window_s", 1.0))
P_STATS_WINDOW_MAX_S = float(_P_CONST.get("stats_window_max_s", 5.0))
P_STATS_CYCLES = float(_P_CONST.get("stats_window_cycles", 3.0))

pressure_offsets = {"feed": 0.0, "retentate": 0.0, "permeate": 0.0}     # bar, Linux side is authoritative
_mean_filtered_state = {ch: None for ch in PRESSURE_CHANNELS}
_p_ring = deque()                 # (mcu_ms, feed, ret, perm) bar
_p_last_seq = None
_p_last_mcu_ms = None
p_stats = {"batches": 0, "dropped_batches": 0, "samples": 0, "window_s": P_STATS_WINDOW_S, "last_dt_ms_max": 0}
_zero_capture = None              # zeroing in progress: list of (feed0, ret0, perm0) bar without zero subtracted

latest_pressure = {
    "ts": 0.0,
    "channels": {
        ch: {"peak": 0.0, "trough": 0.0, "mean_raw": 0.0, "mean_filtered": 0.0, "cycle_freq_hz": 0.0}
        for ch in PRESSURE_CHANNELS
    },
    "tmp": {"peak": 0.0, "trough": 0.0, "mean_raw": 0.0, "mean_filtered": 0.0},
    "filtered": {ch: 0.0 for ch in PRESSURE_CHANNELS + ("tmp",)},
}
_pressure_lock = threading.Lock()


def _lowpass(channel, mean_raw):
    prev = _mean_filtered_state[channel]
    filtered = mean_raw if prev is None else (
        PRESSURE_MEAN_FILTER_ALPHA * mean_raw + (1 - PRESSURE_MEAN_FILTER_ALPHA) * prev
    )
    _mean_filtered_state[channel] = filtered
    return filtered


def push_pressure_to_frontend(snapshot):
    ui.send_message("pressure_update", {
        "ts": snapshot["ts"],
        "channels": {
            ch: {k: round(v, 5) for k, v in snapshot["channels"][ch].items()}
            for ch in PRESSURE_CHANNELS
        },
        "tmp": {k: round(v, 5) for k, v in snapshot["tmp"].items()},
        "filtered": {ch: round(snapshot["filtered"][ch], 4) for ch in PRESSURE_CHANNELS + ("tmp",)},
        "window_s": round(p_stats["window_s"], 2),
    })


def _parse_p_batch(payload):
    seq_s, t0_s, hx = str(payload).split(",", 2)
    seq, t0 = int(seq_s), int(t0_s)
    hx = hx.strip()
    if len(hx) % 17:
        raise ValueError(f"hex length {len(hx)} is not a multiple of 17")
    out = []
    for i in range(0, len(hx), 17):
        out.append((t0 + int(hx[i:i + 2], 16), int(hx[i + 2:i + 7], 16), int(hx[i + 7:i + 12], 16),
                    int(hx[i + 12:i + 17], 16)))
    return seq, t0, out


def _cycle_freq(vals, times_ms, mean):
    if len(vals) < 4:
        return 0.0
    crossings = 0
    prev = vals[0] >= mean
    for v in vals[1:]:
        cur = v >= mean
        if cur != prev:
            crossings += 1
        prev = cur
    span = (times_ms[-1] - times_ms[0]) / 1000.0
    return (crossings / 2.0) / span if span > 0 else 0.0


def on_p_raw(payload):
    """MCU every 200 ms: "seq,t0_ms,HEX". Bridge callback: compute and broadcast only, no synchronous RPC."""
    global _p_last_seq
    try:
        seq, t0, samples = _parse_p_batch(payload)
    except (ValueError, TypeError) as e:
        print(f"[pressure] WARNING: on_p_raw parse failed ({e}): {str(payload)[:80]}")
        return
    if not samples:
        return
    recv = time.time()
    if _p_last_seq is not None:
        if seq > _p_last_seq + 1:
            miss = seq - _p_last_seq - 1
            p_stats["dropped_batches"] += miss
            raw_event("pressure_gap", {"missing_batches": miss, "seq": seq})
        elif seq <= _p_last_seq:                      # MCU rebooted: seq restarts from 1
            _p_ring.clear()
            raw_event("pressure_seq_reset", {"seq": seq, "prev": _p_last_seq})
    _p_last_seq = seq
    p_stats["batches"] += 1
    p_stats["samples"] += len(samples)
    off_epoch = mcu_ms_to_epoch(samples[-1][0], recv)

    rs = raw_session
    if rs is not None:
        rs.write("pressure", [[f"{off_epoch + t / 1000.0:.3f}", t, seq, f, r, p] for (t, f, r, p) in samples])

    o = pressure_offsets
    zc = _zero_capture
    tmp_out_inst_min = None
    for (t, f, r, p) in samples:
        f0, r0, p0 = counts_to_bar0(f), counts_to_bar0(r), counts_to_bar0(p)
        if zc is not None:
            zc.append((f0, r0, p0))
        fb, rb, pb = f0 - o["feed"], r0 - o["retentate"], p0 - o["permeate"]
        _p_ring.append((t, fb, rb, pb))
        v = (rb - pb) * 100.0                       # P_out - P_s at the same instant (kPa), strict TMP_out
        tmp_out_inst_min = v if tmp_out_inst_min is None else min(tmp_out_inst_min, v)
    t_last = samples[-1][0]
    while _p_ring and t_last - _p_ring[0][0] > P_STATS_WINDOW_MAX_S * 1000.0:
        _p_ring.popleft()

    # Stats window: default 1 s; once the pulsation frequency is measured, extend to cover P_STATS_CYCLES cycles (max P_STATS_WINDOW_MAX_S)
    prev_f = latest_pressure["channels"]["feed"].get("cycle_freq_hz") or 0.0
    win_s = P_STATS_WINDOW_S
    if prev_f > 0.05:
        win_s = min(max(win_s, P_STATS_CYCLES / prev_f), P_STATS_WINDOW_MAX_S)
    p_stats["window_s"] = win_s
    win = [x for x in _p_ring if t_last - x[0] <= win_s * 1000.0]
    times = [x[0] for x in win]

    channels = {}
    for i, ch in enumerate(PRESSURE_CHANNELS):
        vals = [x[i + 1] for x in win]
        mean_raw = sum(vals) / len(vals)
        channels[ch] = {"peak": max(vals), "trough": min(vals), "mean_raw": mean_raw,
                        "mean_filtered": _lowpass(ch, mean_raw), "cycle_freq_hz": _cycle_freq(vals, times, mean_raw)}
    tmps = [(x[1] + x[2]) / 2.0 - x[3] for x in win]
    tmp_mean_raw = sum(tmps) / len(tmps)
    lumen_mean = (channels["feed"]["mean_filtered"] + channels["retentate"]["mean_filtered"]) / 2.0
    tmp = {"peak": max(tmps), "trough": min(tmps), "mean_raw": tmp_mean_raw,
           "mean_filtered": lumen_mean - channels["permeate"]["mean_filtered"]}
    if len(times) >= 2:
        p_stats["last_dt_ms_max"] = max(b - a for a, b in zip(times, times[1:]))

    ts = time.time()
    with _pressure_lock:
        latest_pressure["ts"] = ts
        latest_pressure["channels"] = channels
        latest_pressure["tmp"] = tmp
        latest_pressure["filtered"] = {
            "feed": channels["feed"]["mean_filtered"], "retentate": channels["retentate"]["mean_filtered"],
            "permeate": channels["permeate"]["mean_filtered"], "tmp": tmp["mean_filtered"],
        }
        snapshot = {
            "ts": ts,
            "channels": {ch: dict(channels[ch]) for ch in PRESSURE_CHANNELS},
            "tmp": dict(tmp),
            "filtered": dict(latest_pressure["filtered"]),
            "tmp_out_inst_min_kpa": tmp_out_inst_min,
        }

    agg_push_pressure(snapshot)
    _valve_track_pressure(snapshot)
    hfm_track_pressure(snapshot)
    push_pressure_to_frontend(snapshot)


Bridge.provide("on_p_raw", on_p_raw)


def push_offsets_to_mcu():
    """Push the Linux-side pressure zero to the MCU (for the pinch valve safety interlock). Returns whether it succeeded."""
    o = pressure_offsets
    try:
        resp = Bridge.call("set_pressure_offsets", f"{o['feed']:.6f},{o['retentate']:.6f},{o['permeate']:.6f}")
        return not _rejected(resp)
    except Exception as e:
        print(f"[pressure] failed to push zero offsets to MCU: {e}")
        return False


def set_pressure_offsets_local(offsets, source):
    for ch in PRESSURE_CHANNELS:
        pressure_offsets[ch] = float(offsets[ch])
        _mean_filtered_state[ch] = None
    _p_ring.clear()
    raw_event("pressure_offsets", {"offsets_bar": dict(pressure_offsets), "source": source})


ZERO_CAPTURE_S = 3.0


def handle_zero_calibrate(client, data):
    """Pressure zeroing (system vented to atmosphere): collect 3 s of raw data, average as zero, save and push to the MCU."""
    def _bg():
        global _zero_capture
        _zero_capture = []
        time.sleep(ZERO_CAPTURE_S)
        cap, _zero_capture = _zero_capture, None
        if not cap or len(cap) < 50:
            print(f"[pressure] zeroing failed: in {ZERO_CAPTURE_S:.0f} s got only {len(cap or [])} pressure samples (is the MCU sending?)")
            ui.send_message("zero_calibrate_done", {"ts": time.time(), "ok": False,
                                                    "error": "No pressure data received"})
            return
        n = len(cap)
        offs = {ch: round(sum(c[i] for c in cap) / n, 6) for i, ch in enumerate(PRESSURE_CHANNELS)}
        set_pressure_offsets_local(offs, "measured")
        mcu_ok = push_offsets_to_mcu()
        calib_remember("pressure_offsets", offs, source="measured")
        print(f"[pressure] zeroing done ({n} samples): {offs}" + ("" if mcu_ok else "  !! push to MCU failed, pinch valve interlock still uses old zero"))
        ui.send_message("zero_calibrate_done", {"ts": time.time(), "ok": True, "offsets": offs, "mcu_ok": mcu_ok})
    threading.Thread(target=_bg, daemon=True, name="zero_calibrate").start()


ui.on_message("zero_calibrate", handle_zero_calibrate)

# ============================= OD600 photometer (port of photometer v1.2.0) =============================
# Each MCU attempt sends on_od_raw (4 dark-current + 16 LED-on readings, raw counts of both channels); here the 8 algorithms of photometer_algos.py
# are computed together; the primary algorithm ("OD600 estimator" in algorithm settings) decides the displayed value and validity; all 8 are written to the CSV.
# One blank is stored per algorithm, on the Linux side (calibration_state.json), so it survives MCU reboots.
_OD_CONST = CONST.get("od600") or {}
OD600_POLL_INTERVAL_SEC = float(CONST.get("od600_poll_interval_sec", 5.0))
OD600_EXPECTED_LUX_RATIO = float(CONST.get("od600_expected_lux_ratio", 10.0))
OD600_LUX_RATIO_WARN_BAND = list(CONST.get("od600_lux_ratio_warn_band", [5.0, 20.0]))
OD600_DEV_MODE_POLL_TIMEOUT_SEC = float(CONST.get("od600_dev_mode_poll_timeout_sec", 30.0))
OD_BUBBLE_RETRY = bool(_OD_CONST.get("bubble_retry", True))
OD_REF_REL_BAND = [float(x) for x in _OD_CONST.get("ref_rel_warn_band", [0.85, 1.15])]
PA.BUBBLE_DROP = float(_OD_CONST.get("bubble_drop_pct", 5.0)) / 100.0
OD_ALGS = PA.ALG_NAMES
od_cfg = {"plf": float(_OD_CONST.get("default_path_length_factor", 5.0)),
          "optical_mode": _OD_CONST.get("optical_mode", "fiber")}          # fiber (dual optical path) | single
if od_cfg["optical_mode"] not in ("fiber", "single"):
    od_cfg["optical_mode"] = "fiber"

# v5.1: gate layer after the estimator. Thresholds live in constants.json od600.gate and are written into the raw meta.json at start
# (pre-registration: thresholds were set from the 2026-10-10 bubble/air-column test data; the next run is the out-of-sample validation).
od_gate = OG.ODGate(_OD_CONST.get("gate") or {})
# v6.1: specific growth rate mu = d ln(OD600)/dt, least-squares fit over a sliding window of gate-accepted readings
growth = GR.GrowthRate(**{k: v for k, v in (_OD_CONST.get("growth_rate") or {}).items() if not k.startswith("_")})
OD_ALERT_LATCH_SEC = float((_OD_CONST.get("gate") or {}).get("level_shift_latch_sec", 300.0))
_od_alert = None                      # level-shift alarm (latched for OD_ALERT_LATCH_SEC seconds)


def _od_alert_clear():
    global _od_alert
    _od_alert = None


def od_gate_alerts():
    """OD600 gate alarms for derive_loop. Stall is a live state (clears by itself); level shift is a latched event."""
    out = []
    st = od_gate.status()
    n = int(od_gate.cfg["stale_n"])
    if st["enabled"] and n > 0 and st["reject_run"] >= n:
        la = st["last_accepted"]
        out.append({"level": "warning", "code": "od_gate_stale", "value": st["reject_run"],
                    "message": (f"OD600: {st['reject_run']} consecutive readings rejected by gate, reported value held at "
                                f"{'--' if la is None else f'{la:.3f}'}: check flow cell for bubbles/air column and the light sensor")})
    a = _od_alert
    if a and time.time() - a["ts"] <= OD_ALERT_LATCH_SEC:
        out.append({"level": a["level"], "code": a["code"], "message": a["message"]})
    return out

_od_lock = threading.Lock()
latest_od600 = {
    "ts": 0.0, "od600": None, "lux_sample": 0.0, "lux_ref": 0.0, "lux_ratio": None, "bubble_pct": 0.0,
    "valid": False, "blank_set": False, "meas_seq": 0, "age_s": None, "busy": False,
    "algs": {}, "flag_list": [], "od_alg": None, "bubble_frac_pct": None, "od_dual": None, "od_single": None,
    # Gate layer: od600 stays the raw estimator output (not overwritten); od600_reported is the reported value used for display/trends/CSV
    "od600_reported": None, "od_p90": None, "gate_accepted": None, "gate_reason": None,
    "gate_detail": None, "gate": None,
}
od_blank = {"blank_set": False, "per_alg": {}, "at": None}
od600_blank_info = {"blank_set": False, "lux_sample": 0.0, "lux_ref": 0.0, "lux_ratio": None}
od600_dev_mode = False
_od_dev_last_poll_time = None
_od_last_attempts = []
_od_pending = {}
_od_last_seen_seq = None
_od_blank_pending = False
_od_retry_for_seq = None
_od_last_blank_raw = []
_od_proc_lock = threading.RLock()
OD_RAW_HEADER = (["timestamp_iso", "epoch_s", "meas_seq", "attempt", "final", "hw_ok", "stuck", "blank_measure",
                  "t0_ms", "period_ms", "mtreg", "hres_mode", "lux_per_count", "ref_mode", "optical_mode"]
                 + [f"dark_s_{i}" for i in range(4)] + [f"dark_r_{i}" for i in range(4)]
                 + [f"lit_s_{i}" for i in range(16)] + [f"lit_r_{i}" for i in range(16)])


def od_primary_alg():
    a = alg_settings.get("od_estimator")
    return a if a in OD_ALGS else "upper"


def _od_single():
    return od_cfg["optical_mode"] == "single"


def _od_blank_view(alg=None):
    with _od_lock:
        b = (od_blank["per_alg"].get(alg or od_primary_alg()) or {}) if od_blank["blank_set"] else {}
        bs = od_blank["blank_set"]
    s, r = b.get("s") or 0.0, b.get("r") or 0.0
    ratio = b.get("ratio") or (s / r if s > 0 and r > 0 else 0.0)
    return {"blank_set": bs, "ratio": ratio, "s": s, "r": r}


def _od_compute(attempts):
    with _od_lock:
        bl = {k: dict(v) for k, v in od_blank["per_alg"].items()} if od_blank["blank_set"] else {}
        bset = od_blank["blank_set"]
    single = _od_single()
    plf = od_cfg["plf"]
    alg = od_primary_alg()
    algs, results = {}, {}
    for a in OD_ALGS:
        res = PA.measurement_result(attempts, a, single)
        dual, sing = PA.od_values(res, bl.get(a), plf) if bset else (None, None)
        od = sing if single else dual
        results[a] = res
        algs[a] = {"od": None if od is None else round(od, 5), "rej": round(res["rej"], 1), "ok": bool(res["ok"])}
    p = results[alg]
    pa = algs[alg]
    dual, sing = PA.od_values(p, bl.get(alg), plf) if bset else (None, None)
    hw_ok = any(att.get("hw_ok") for att in attempts)
    stuck = "".join(att.get("stuck", "") for att in attempts if att.get("stuck") not in (None, "-"))
    flags = []
    for cond, name in ((p["sat_s"], "sat_s"), (p["sat_r"], "sat_r"), (p["low_s"], "low_s"), (p["low_r"], "low_r"),
                       (not p["enough_s"], "i2c_s"), (not p["enough_r"], "i2c_r"),
                       ("S" in stuck, "stuck_s"), ("R" in stuck, "stuck_r"), (pa["od"] is None, "no_od"),
                       (p["bubble"] > PA.REJECT_LIMIT_PCT, "bubbles")):
        if cond:
            flags.append(name)
    bv = _od_blank_view(alg)
    ref_rel = round(p["R"] / bv["r"], 4) if bset and bv["r"] > 0 and p["R"] > 0 else None
    if not single and ref_rel is not None and not (OD_REF_REL_BAND[0] <= ref_rel <= OD_REF_REL_BAND[1]):
        flags.append("ref_drift")
    if single:
        flags = [f for f in flags if f not in ("sat_r", "low_r", "i2c_r", "stuck_r", "ref_drift")]
    valid = bool(p["ok"] and hw_ok and pa["od"] is not None)
    lux_ratio = None if single or p["R"] <= 1e-6 else round(p["S"] / p["R"], 4)
    return {
        "od600": pa["od"], "od_dual": None if dual is None else round(dual, 5),
        "od_single": None if sing is None else round(sing, 5),
        "lux_sample": round(p["S"], 3), "lux_ref": round(p["R"], 3), "lux_ratio": lux_ratio,
        "counts_s": round(p["counts_s"], 1), "counts_r": round(p["counts_r"], 1),
        "bubble_pct": pa["rej"], "bubble_frac_pct": round(p["bubble"], 1), "valid": valid, "blank_set": bset,
        "ref_rel": None if single else ref_rel, "flag_list": flags, "algs": algs, "od_alg": alg,
        "optical_mode": od_cfg["optical_mode"], "attempts": len(attempts), "hw_ok": hw_ok, "plf": plf,
        # For the discrete gate: OD computed by the p90 estimator from the same measurement (upper envelope)
        "od_p90": (algs.get("p90") or {}).get("od"),
    }


def _od_snapshot(client=None):
    with _od_lock:
        snap = dict(latest_od600)
    if snap.get("ts"):
        snap["age_s"] = round(time.time() - snap["ts"], 1)
    snap["expected_lux_ratio"] = OD600_EXPECTED_LUX_RATIO
    snap["lux_ratio_warn_band"] = OD600_LUX_RATIO_WARN_BAND
    snap["growth"] = growth.status(time.time())
    ui.send_message("od600_update", snap, client)


def od_recompute_latest(reason="recompute"):
    """Algorithm / blank / path-length factor changed: recompute immediately from the last raw readings (no CSV write).

    v5.1: each of these changes switches the "ruler" for the OD level (new estimator, new blank, new path-length factor),
    so the old last_accepted and candidate cluster can no longer be used; the gate layer is always reset - after reset the first reading
    re-establishes the baseline via bootstrap and is not wrongly blocked by the jump gate.
    """
    od_gate.reset(reason)
    growth.reset(reason, time.time())     # v6.1: new ruler -> new mu window
    _od_alert_clear()
    atts = list(_od_last_attempts)
    if not atts:
        with _od_lock:
            latest_od600.update({"od600_reported": None, "gate_accepted": None,
                                 "gate_reason": None, "gate_detail": None, "gate": od_gate.status()})
        _od_snapshot()
        return
    res = _od_compute(atts)
    with _od_lock:
        latest_od600.update(res)
        # Recompute bypasses the gate (not a new measurement); the reported value waits for the next real measurement
        latest_od600.update({"od600_reported": None, "gate_accepted": None,
                             "gate_reason": None, "gate_detail": None, "gate": od_gate.status()})
    _od_snapshot()


def _od_raw_row(att):
    return ([time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(att["epoch_s"])), f"{att['epoch_s']:.2f}",
             att["seq"], att["att"], int(att["final"]), int(att["hw_ok"]), att["stuck"], att.get("blank_measure", 0),
             att["t0_ms"], att["period_ms"], att["mtreg"], att["hres_mode"], f"{att['lpc']:.6f}", att["ref_mode"],
             att.get("optical_mode", "")] + att["ds"] + att["dr"] + att["ls"] + att["lr"])


def _parse_od_raw(payload):
    kv = _parse_kv(payload)

    def vals(key, n):
        v = [int(float(x)) for x in kv.get(key, "").split("|") if x != ""]
        if len(v) != n:
            raise ValueError(f"{key} has {len(v)} entries, expected {n}")
        return v
    return {
        "epoch_s": time.time(), "seq": int(float(kv.get("seq"))), "att": int(float(kv.get("att", 0))),
        "final": kv.get("final") == "1", "hw_ok": kv.get("hw_ok") == "1", "stuck": kv.get("stuck", "-"),
        "t0_ms": int(float(kv.get("t0", 0))), "period_ms": int(float(kv.get("per", 130))),
        "mtreg": int(float(kv.get("mt", 69))), "hres_mode": 2 if kv.get("h2") == "1" else 1,
        "lpc": float(kv.get("lpc", 1.0 / 2.4)), "ref_mode": int(float(kv.get("ref_mode", 0))),
        "ds": vals("ds", 4), "dr": vals("dr", 4), "ls": vals("ls", 16), "lr": vals("lr", 16),
    }


def _od_set_blank_from(attempts):
    single = _od_single()
    alg = od_primary_alg()
    p = PA.measurement_result(attempts, alg, single)
    hw_ok = any(att.get("hw_ok") for att in attempts)
    why = None
    if p["sat_s"] or (not single and p["sat_r"]):
        why = "sensor saturated: reduce light level and recalibrate"
    elif not hw_ok or not p["enough_s"] or (not single and not p["enough_r"]):
        why = "sensor read failed"
    elif p["S"] <= 0 or (not single and p["R"] <= 0):
        why = "no signal: check LED / optical path"
    if why:
        print(f"[od600] blank calibration rejected: {why}")
        ui.send_message("calibration_applied", {"ok": False, "applied": [], "failed": ["od600_blank"], "error": why})
        return
    per = {}
    for a in OD_ALGS:
        r = PA.measurement_result(attempts, a, single)
        per[a] = {"s": round(r["S"], 4), "r": round(r["R"], 4)}
    with _od_lock:
        od_blank.update({"blank_set": True, "per_alg": per, "at": time.time()})
    calib_remember("od600_blank", _od_blank_record(per), source="measured")
    raw_event("od600_blank", {"source": "measured", "per_alg": per})
    print(f"[od600] blank set ({alg}: S={per[alg]['s']:.2f} lx, R={per[alg]['r']:.2f} lx)")
    push_od_blank()


def _od_blank_record(per):
    """Saved format: per_alg + ratio/lux of the primary algorithm (compatible with the v4.x calibration management screen)."""
    a = od_primary_alg()
    s, r = per.get(a, {}).get("s") or 0.0, per.get(a, {}).get("r") or 0.0
    return {"per_alg": per, "ratio": round(s / r, 6) if s > 0 and r > 0 else (per.get(a, {}).get("ratio") or 0.0),
            "lux_sample": round(s, 3), "lux_ref": round(r, 3)}


def push_od_blank(client=None):
    b = _od_blank_view()
    od600_blank_info.update({"blank_set": b["blank_set"], "lux_sample": round(b["s"], 3),
                             "lux_ref": round(b["r"], 3), "lux_ratio": round(b["ratio"], 5) if b["ratio"] else None})
    ui.send_message("od600_blank", dict(od600_blank_info), client)


def refresh_blank_info(client=None):          # v4.x compatible name
    push_od_blank(client)


def _od_process(attempts, source):
    global _od_last_seen_seq, _od_blank_pending, _od_last_attempts, _od_retry_for_seq
    with _od_proc_lock:
        seq = attempts[-1]["seq"]
        if seq == _od_last_seen_seq:
            return
        _od_last_seen_seq = seq
        _od_last_attempts = list(attempts)
        was_blank = _od_blank_pending
        if _od_blank_pending:
            _od_blank_pending = False
            _od_set_blank_from(attempts)
        res = _od_compute(attempts)
        # v5.1 gate layer: the blank measurement bypasses the gate (it defines the baseline, it is not a reading to be judged)
        gate = None
        if not was_blank and res.get("blank_set"):
            gate = od_gate.feed(res.get("od600"), res.get("od_p90"), bool(res.get("valid")), time.time())
            res = dict(res, od600_reported=gate["reported"], gate_accepted=gate["accepted"],
                       gate_reason=gate["reason"], gate_detail=gate, gate=od_gate.status())
            # v6.1: a declared operation or a confirmed level shift (dilution, inoculation) restarts the mu window
            if gate.get("level_shift"):
                growth.reset(gate["reason"], time.time())
            if gate["accepted"]:
                growth.add(time.time(), gate["reported"])
        with _od_lock:
            latest_od600.update(res)
            latest_od600.update({"ts": time.time(), "meas_seq": seq, "age_s": 0.0, "busy": False})
            snap = dict(latest_od600)
    if gate is not None:
        raw_event("od_gate", {"seq": seq, "od": res.get("od600"), "od_p90": res.get("od_p90"),
                              "reason": gate["reason"], "accepted": gate["accepted"],
                              "reported": gate["reported"], "d_disc": gate["d_disc"],
                              "d_jump": gate["d_jump"], "pending_n": gate["pending_n"]})
        if gate["alarm"]:
            print(f"[od600] !! {gate['alarm']['message']}")
            if gate["alarm"]["code"] == "od_level_shift":     # level shift: latched for a while so someone sees it
                global _od_alert
                _od_alert = dict(gate["alarm"], ts=time.time())
        elif gate["reason"] in ("ok", "bootstrap", "declared"):
            _od_alert_clear()
    _od_snapshot()
    od_txt = "--" if snap["od600"] is None else f"{snap['od600']:.4f}"
    print(f"[od600] seq={seq} OD={od_txt} [{snap['od_alg']}] S={snap['lux_sample']:.1f}lx R={snap['lux_ref']:.1f}lx "
          f"rej={snap['bubble_pct']:.0f}% bub={snap['bubble_frac_pct']:.0f}% valid={snap['valid']} "
          f"flags={','.join(snap['flag_list']) or '-'}")
    too_many = max(snap["bubble_pct"], snap["bubble_frac_pct"] or 0) > PA.REJECT_LIMIT_PCT
    if (OD_BUBBLE_RETRY and source == "notify" and snap["blank_set"] and not snap["valid"]
            and too_many and _od_retry_for_seq != seq - 1):
        _od_retry_for_seq = seq
        print(f"[od600] seq={seq} too many bubbles -> re-measuring now")
        mcu_job(lambda: Bridge.call("trigger_measurement", ""))


def on_od_raw(payload):
    """One per MCU attempt. Bridge callback: compute and broadcast only, no synchronous RPC."""
    global _od_last_blank_raw
    try:
        att = _parse_od_raw(payload)
    except Exception as e:
        print(f"[od600] WARNING: cannot parse on_od_raw ({e}): {str(payload)[:120]}")
        return
    att["blank_measure"] = 1 if _od_blank_pending else 0
    att["optical_mode"] = od_cfg["optical_mode"]
    if att["blank_measure"]:
        if att["att"] == 0:
            _od_last_blank_raw = []
        _od_last_blank_raw.append(att)
    rs = raw_session
    if rs is not None:
        rs.write_od(_od_raw_row(att))
    lst = _od_pending.setdefault(att["seq"], [])
    lst.append(att)
    if att["final"]:
        _od_pending.pop(att["seq"], None)
        for k in [k for k in _od_pending if k < att["seq"] - 2 or k > att["seq"]]:
            _od_pending.pop(k, None)
        _od_process(lst, "notify")


Bridge.provide("on_od_raw", on_od_raw)


def poll_od600_once():
    """Fallback: read the most recent completed measurement (when a notify was missed or Python just restarted)."""
    try:
        r = Bridge.call("get_last_raw", "")
        kv = _parse_kv(r)
        with _od_lock:
            latest_od600["busy"] = kv.get("busy") == "1"
        if not kv.get("seq"):
            return True
        att = _parse_od_raw(r)
    except Exception:
        return False
    if att["seq"] != _od_last_seen_seq:
        att["blank_measure"] = 0
        _od_process([att], "poll")
    return True


def handle_od_calibrate_blank(client, data):
    """Use the next completed measurement as the blank (the flow cell should contain clean medium)."""
    global _od_blank_pending
    _od_blank_pending = True
    try:
        r = Bridge.call("trigger_measurement", "")
    except Exception as e:
        print(f"[od600] trigger_measurement failed: {e}")
        return
    print(f"[od600] blank calibration: waiting for this measurement to finish (MCU: {r})")


def push_od_gate(client=None, ok=True, error=None, action=None):
    ui.send_message("od_gate_state", {
        "ok": ok, "error": error, "action": action,
        "config": od_gate.config(), "status": od_gate.status(),
        "reasons": OG.REASONS, "latch_sec": OD_ALERT_LATCH_SEC,
        "measure_interval_sec": mcu_cfg.get("od_interval_s"),
    }, client)


def handle_od_declare_step(client, data):
    """Press before a planned operation (dilution / inoculation / medium change): the next valid reading is set directly as the new level without waiting for confirmation readings."""
    od_gate.declare_step()
    _od_alert_clear()
    raw_event("od_declare_step", {"source": "manual", "last_accepted": od_gate.last_accepted})
    print("[od600] intervention declared: next valid reading becomes the new baseline")
    push_od_gate(action="declare_step")


def handle_od_gate_reset(client, data):
    od_gate.reset("manual")
    growth.reset("manual", time.time())
    _od_alert_clear()
    raw_event("od_gate_reset", {"source": "manual"})
    push_od_gate(action="reset")


def handle_od_gate_get(client, data):
    push_od_gate(client)


def handle_od_gate_set(client, data):
    """Threshold adjustment. Changing thresholds resets the state and writes a raw event (so it is known afterwards which thresholds this segment ran with)."""
    d = data or {}
    new = {}
    for k in OG.DEFAULTS:
        if d.get(k) in (None, ""):
            continue
        try:
            new[k] = bool(d[k]) if isinstance(OG.DEFAULTS[k], bool) else type(OG.DEFAULTS[k])(d[k])
        except (TypeError, ValueError):
            push_od_gate(client, ok=False, error=f"cannot parse value of {k}", action="set")
            return
    if not new:
        push_od_gate(client)
        return
    for k in ("disc_abs", "jump_abs"):
        if k in new and not (0 < new[k] <= 5.0):
            push_od_gate(client, ok=False, error=f"{k} must be 0-5 OD", action="set")
            return
    for k in ("disc_rel", "jump_rel"):
        if k in new and not (0 <= new[k] <= 1.0):
            push_od_gate(client, ok=False, error=f"{k} must be 0-1 (fraction)", action="set")
            return
    for k in ("confirm_n", "report_median_n"):
        if k in new and not (1 <= new[k] <= 20):
            push_od_gate(client, ok=False, error=f"{k} must be 1-20", action="set")
            return
    if "stale_n" in new and not (0 <= new["stale_n"] <= 100):
        push_od_gate(client, ok=False, error="stale_n must be 0-100 (0 = no stale alert)", action="set")
        return
    od_gate.cfg.update(new)
    od_gate.reset("config_changed")
    _od_alert_clear()
    _pv_save("od_gate", od_gate.config())
    raw_event("od_gate_config", od_gate.config())
    print(f"[od600] gate thresholds updated: {new}")
    push_od_gate(action="set")


ui.on_message("od_declare_step", handle_od_declare_step)
ui.on_message("od_gate_reset", handle_od_gate_reset)
ui.on_message("od_gate_get", handle_od_gate_get)
ui.on_message("od_gate_set", handle_od_gate_set)


def handle_od_growth_set(client, data):
    """v6.1: specific growth rate window / minimum points / minimum OD. Changing them does not clear the stored readings."""
    d = data or {}
    try:
        growth.set_config(**{k: d[k] for k in ("window_min", "min_points", "min_span_min", "min_od") if d.get(k) not in (None, "")})
    except (TypeError, ValueError) as e:
        ui.send_message("od_growth_result", {"ok": False, "error": str(e)}, client)
        return
    _pv_save("growth_rate", growth.config())
    raw_event("od_growth_config", growth.config())
    print(f"[od600] growth-rate settings updated: {growth.config()}")
    ui.send_message("od_growth_result", {"ok": True, "config": growth.config()}, client)
    _od_snapshot()


ui.on_message("od_growth_set", handle_od_growth_set)


def handle_od_measure_now(client, data):
    try:
        Bridge.call("trigger_measurement", "")
    except Exception as e:
        print(f"[od600] trigger_measurement failed: {e}")


def handle_od_reinit(client, data):
    """v5.0: manual I2C reset + re-initialization of both BH1750s."""
    try:
        r = str(Bridge.call("reinit_sensors", ""))
        ok = r != "busy"
    except Exception as e:
        r, ok = str(e), False
    print(f"[od600] manual sensor re-init: {r}")
    raw_event("od600_reinit", {"result": r, "source": "manual"})
    ui.send_message("od600_reinit_result", {"ok": ok, "result": r}, client)


def handle_od_set_dev_mode(client, data):
    global od600_dev_mode, _od_dev_last_poll_time
    on = bool((data or {}).get("on", False))
    try:
        Bridge.call("set_dev_mode", "1" if on else "0")
    except Exception as e:
        ui.send_message("od600_dev_status", {"dev_mode": od600_dev_mode, "error": str(e)}, client)
        return
    od600_dev_mode = on
    _od_dev_last_poll_time = time.time() if on else None
    ui.send_message("od600_dev_status", {"dev_mode": od600_dev_mode})


def handle_od_get_dev_readings(client, data):
    """Real-time readings for alignment (dark current not subtracted, no algorithm applied); not written to any log."""
    global _od_dev_last_poll_time
    if not od600_dev_mode:
        ui.send_message("od600_dev_readings", {"dev_mode": False}, client)
        return
    _od_dev_last_poll_time = time.time()
    try:
        parts = str(Bridge.call("get_dev_readings", "")).split(",")
        lux_sample, lux_ref = float(parts[3]), float(parts[4])
    except Exception as e:
        ui.send_message("od600_dev_readings", {"dev_mode": True, "error": str(e)}, client)
        return
    sample_error, ref_error = lux_sample < 0, lux_ref < 0
    ratio = round(lux_sample / lux_ref, 3) if (not sample_error and not ref_error and lux_ref > 1e-3) else None
    ui.send_message("od600_dev_readings", {
        "dev_mode": True,
        "lux_sample": None if sample_error else round(lux_sample, 2),
        "lux_ref": None if ref_error else round(lux_ref, 2),
        "lux_ratio": ratio, "sample_error": sample_error, "ref_error": ref_error,
        "expected_lux_ratio": OD600_EXPECTED_LUX_RATIO, "lux_ratio_warn_band": OD600_LUX_RATIO_WARN_BAND,
    }, client)


def handle_od_get_settings(client, data):
    ui.send_message("od600_settings", {
        "ok": True, "measure_interval_sec": mcu_cfg.get("od_interval_s"), "path_length_factor": od_cfg["plf"],
        "optical_mode": od_cfg["optical_mode"],
    }, client)


def push_od_config_to_mcu():
    try:
        resp = Bridge.call("set_config", f"od_interval_s={agg_settings['window_sec']},"
                                         f"ref_mode={1 if _od_single() else 0}")
        if _rejected(resp):
            print(f"[od600] MCU rejected settings: {resp}")
            return False
        mcu_cfg["od_interval_s"] = _f(_parse_kv(resp).get("od_interval_s"), mcu_cfg["od_interval_s"])
        return True
    except Exception as e:
        print(f"[od600] failed to push measurement interval/optics to MCU: {e}")
        return False


def handle_od_set_settings(client, data):
    """Measurement interval is shared with the aggregate window (change it in "Sampling settings"); this only changes the path-length factor (Linux side)."""
    data = data or {}
    result = {"ok": True}
    if data.get("measure_interval_sec") not in (None, ""):
        result["note"] = "Measurement interval is shared with the sampling window; change it in 'Sampling Settings'"
    if data.get("path_length_factor") not in (None, ""):
        try:
            f = float(data["path_length_factor"])
        except (TypeError, ValueError):
            f = -1
        if not (0 < f <= 1000):
            ui.send_message("od600_settings", {"ok": False, "error": "Path length factor must be > 0 and <= 1000"}, client)
            return
        od_cfg["plf"] = f
        calib_remember("od600_path_length_factor", {"value": f}, source="measured")
        raw_event("od600_path_length_factor", {"value": f})
        od_recompute_latest()
        result["path_length_factor"] = f
    result["measure_interval_sec"] = mcu_cfg.get("od_interval_s")
    ui.send_message("od600_settings", result, client)


ui.on_message("od_calibrate_blank", handle_od_calibrate_blank)
ui.on_message("od_measure_now", handle_od_measure_now)
ui.on_message("od_reinit", handle_od_reinit)
ui.on_message("od_set_dev_mode", handle_od_set_dev_mode)
ui.on_message("od_get_dev_readings", handle_od_get_dev_readings)
ui.on_message("od_get_settings", handle_od_get_settings)
ui.on_message("od_set_settings", handle_od_set_settings)


# ============================= MCU diagnostics / link status =============================
latest_diag = {"loop_max_us": 0, "pressure_samples_last_sec": 0, "od_state": 0, "reinit_step": 0}
_last_reinit_counts = None


def poll_mcu_diag():
    try:
        raw = Bridge.call("get_diag", "")
        parts = [x.strip() for x in str(raw).split(",")]
        diag = {
            "loop_max_us": int(float(parts[0])),
            "pressure_samples_last_sec": int(float(parts[1])),
            "od_state": int(float(parts[2])),
            "reinit_step": int(float(parts[3])),
            "uptime_ms": int(float(parts[4])) if len(parts) > 4 else None,
        }
        fw = parts[5] if len(parts) > 5 else "old sketch (no version)"
        if len(parts) > 8:
            diag["rpc_calls"] = _i(parts[8])
        for tok in parts[9:]:
            if "=" in tok:
                k, v = tok.split("=", 1)
                diag[k] = v
    except Exception as e:
        _set_mcu_link(False, f"get_diag failed: {type(e).__name__}: {e}")
        return
    _set_mcu_link(True, fw=fw)
    diag["p_dropped_batches"] = p_stats["dropped_batches"]
    diag["p_window_s"] = round(p_stats["window_s"], 2)
    diag["flow_dropped"] = flow_dropped
    latest_diag.update(diag)
    _note_reinit_counts(diag.get("rc"))
    ui.send_message("mcu_diag", dict(latest_diag))
    if diag["uptime_ms"] is not None:
        check_mcu_reboot(diag["uptime_ms"])


def _note_reinit_counts(rc):
    """When the BH1750 auto re-init / I2C reset count increases, print it and write a raw data event."""
    global _last_reinit_counts
    if not rc or rc == _last_reinit_counts:
        return
    prev, _last_reinit_counts = _last_reinit_counts, rc
    if prev is not None:
        print(f"[od600] sensor auto re-init / I2C reset: {prev} -> {rc}")
        raw_event("od600_sensor_reinit", {"from": prev, "to": rc})


mcu_link = {"ok": None, "error": None, "since": time.time(), "fw": None, "last_ok": None}
BACKEND_VERSION = "v6.2.2"           # the web UI checks this version
EXPECTED_FW = "v4.2.2"             # compared against FW_VERSION in sketch.ino
_startup_thread_done = False
_mcu_link_lock = threading.Lock()


def _set_mcu_link(ok, error=None, fw=None):
    with _mcu_link_lock:
        changed = (mcu_link["ok"] != ok)
        mcu_link["ok"] = ok
        if ok:
            mcu_link["error"] = None
            mcu_link["last_ok"] = time.time()
            if fw:
                if fw != mcu_link["fw"]:
                    print(f"[mcu] firmware version: {fw}" + ("" if fw == EXPECTED_FW else
                          f"  !! differs from {EXPECTED_FW} expected by main.py: MCU is not running this sketch version"
                          " (main.py v5.0 requires the v4.0.0 raw-sampling sketch)"))
                mcu_link["fw"] = fw
        else:
            mcu_link["error"] = error
        if changed:
            mcu_link["since"] = time.time()
        snap = dict(mcu_link)
    snap["expected_fw"] = EXPECTED_FW
    if changed:
        if ok:
            print(f"[mcu] Bridge link OK (fw={snap['fw']})")
        else:
            print(f"[mcu] !! MCU not responding: {error}\n"
                  "       -> Check: 1) [boot] message in the MCU Serial Monitor in App Lab "
                  "2) sketch compile/upload errors 3) whether the board needs a power cycle")
        raw_event("mcu_link", {"ok": ok, "error": error})
    try:
        ui.send_message("mcu_link", snap)
    except Exception:
        pass


def od600_poll_loop():
    """Every 5 s: MCU diagnostics, startup sync retry, alignment mode timeout, OD gap fill."""
    global od600_dev_mode, _od_dev_last_poll_time
    while True:
        time.sleep(OD600_POLL_INTERVAL_SEC)
        poll_mcu_diag()
        if _startup_thread_done:
            try:
                ph_valve_housekeeping()
            except Exception:
                print(f"[ph/valve] housekeeping failed:\n{traceback.format_exc()}")
        if _startup_thread_done and not _startup_calib_done:
            startup_calibration_sync()
        if od600_dev_mode and _od_dev_last_poll_time is not None \
                and (time.time() - _od_dev_last_poll_time) > OD600_DEV_MODE_POLL_TIMEOUT_SEC:
            try:
                Bridge.call("set_dev_mode", "0")
            except Exception as e:
                print(f"[od600][dev] failed to auto-exit alignment mode, retrying next cycle: {e}")
            else:
                od600_dev_mode = False
                _od_dev_last_poll_time = None
                print(f"[od600][dev] alignment mode auto-exited -- no browser activity for {OD600_DEV_MODE_POLL_TIMEOUT_SEC} s.")
                ui.send_message("od600_dev_status", {"dev_mode": False})
        if od600_dev_mode:
            continue
        if poll_od600_once():
            _od_snapshot()
        refresh_disk_status()


# ============================= Peristaltic pump control (L298N) - PWM only =============================
# This version keeps only "set PWM directly". The former flow mode (set target flow, background P controller adjusts PWM)
# was removed: tests showed the peristaltic pump's instantaneous flow itself has pulsation noise, and a P controller adjusting
# PWM on that noisy feedback oscillates back and forth and never reaches steady state.
#
# Moving the slider only updates the "pending value" on screen; the actual Bridge.call always waits until the user presses
# the "Apply" button. Direction changes and emergency stop always zero the PWM first, so the motor is never instantly reversed at full speed.
PUMP_PWM_MAX = 255
# v3.1: new pump; removed the old pump's "PWM 1~99 dead zone auto-zero" design; 0-255 sent directly.

pump_state = {"pwm": 0, "forward": True}
_pump_lock = threading.Lock()
_pump_bridge_error = None  # message of the most recent failed MCU communication; cleared to None on success


def _safe_pump_bridge_call(name, arg=""):
    """try/except wrapper: prevents an exception from blowing up the stack when the MCU does not respond, which would leave the later push_pump_status()
    never executed - then the frontend would get no response at all and the user would think the button is broken, when actually
    the command never reached the MCU. Returns (success, result string or None)."""
    global _pump_bridge_error
    try:
        result = Bridge.call(name, arg)
        _pump_bridge_error = None
        return True, result
    except Exception as e:
        _pump_bridge_error = f"{name} failed: {e}"
        print(f"[pump] Bridge.call({name!r}, {arg!r}) failed: {e}")
        return False, None


def _sync_pump_status_from_mcu():
    """At startup, ask the MCU once for its actual PWM/direction so the Python-side state does not mismatch the hardware
    (e.g. the MCU was rebooted on its own while the Python side still remembers the old state)."""
    try:
        raw = Bridge.call("get_pump_status", "")
        pwm_str, dir_str = raw.split(",")
        with _pump_lock:
            pump_state["pwm"] = int(float(pwm_str))
            pump_state["forward"] = (dir_str.strip() == "1")
    except Exception:
        pass  # if unreadable, keep the currently recorded state (default stopped)


def push_pump_status(client=None):
    with _pump_lock:
        snapshot = dict(pump_state)
    snapshot["bridge_error"] = _pump_bridge_error
    ui.send_message("pump_status", snapshot, client)


def handle_set_pump_pwm(client, data):
    data = data or {}
    try:
        pwm = int(round(float(data.get("pwm", 0))))
    except (TypeError, ValueError):
        return
    pwm = max(0, min(PUMP_PWM_MAX, pwm))
    ok, resp = _safe_pump_bridge_call("set_pump_pwm", str(pwm))
    print(f"[pump] -> MCU set_pump_pwm({pwm}) {'response ' + str(resp) if ok else 'failed (see previous line)'}")
    raw_event("pump_pwm", {"pwm": pwm, "ok": ok})
    if ok and _rejected(resp):
        # v6.0: the MCU rejects while pressure protection is latched. State is not updated, and the web UI is told explicitly that it did not start.
        why = _reject_reason(resp)
        ui.send_message("pump_status", dict(pump_state, bridge_error=None, rejected=True,
                                            reject_reason="Pressure protection latched, clear it first" if "pressure" in why else why), client)
        return
    # Whether or not the MCU responded successfully, update the Python-side state and broadcast, so that after pressing "Apply" the frontend always
    # gets a response; on communication failure pump_status carries bridge_error explaining it may not have actually reached the hardware.
    with _pump_lock:
        pump_state["pwm"] = pwm
    push_pump_status()


def handle_set_pump_direction(client, data):
    """Always have the MCU zero the PWM before changing direction, so it is never reversed directly while running at full speed."""
    data = data or {}
    forward = bool((data or {}).get("forward", True))
    _safe_pump_bridge_call("set_pump_pwm", "0")
    _safe_pump_bridge_call("set_pump_direction", "1" if forward else "0")
    with _pump_lock:
        pump_state["pwm"] = 0
        pump_state["forward"] = forward
    raw_event("pump_direction", {"forward": forward})
    push_pump_status()


def handle_stop_pump(client, data):
    global _valve_last_open_request
    # v3: the MCU stop_pump also releases the pinch valve; record the reason first so the valve event log can say who released it
    _valve_last_open_request = ("pump_emergency_stop", time.time())
    _safe_pump_bridge_call("stop_pump", "")
    with _pump_lock:
        pump_state["pwm"] = 0
    with _v6_lock:
        latest_base["feed_pwm"] = 0          # v6.2: the MCU emergency stop also stops the feed pump
    raw_event("pump_emergency_stop", None)
    push_pump_status()


ui.on_message("set_pump_pwm", handle_set_pump_pwm)
ui.on_message("set_pump_direction", handle_set_pump_direction)
ui.on_message("stop_pump", handle_stop_pump)


# ---------------------------------------------------------------------------
# v4.4 (FW v3.10): pump start boost (kick-start)
# A peristaltic pump at rest has static friction; low PWM (e.g. 150) often fails to start it, but once turning, 150 keeps it running.
# On "stopped -> start" the MCU first runs at kick_pwm for kick_ms, then drops back to the target PWM.
# stall: when enabled, if PWM>0 but the flow meter sees no pulses for 3 s in a row, auto-boost again (max 3 times, not done while the pinch valve is not open).
# Settings are stored as "pump_kick" in ph_valve_state.json and pushed back automatically after MCU reboot.
# ---------------------------------------------------------------------------
PUMP_KICK_KEYS = ("en", "pwm", "ms", "stall")
_PUMP_KICK_CONST = (CONST.get("pump") or {}) if isinstance(globals().get("CONST"), dict) else {}
PUMP_KICK_DEFAULTS = {"en": 1, "pwm": 255, "ms": 500, "stall": 0}
pump_kick = {"config": dict(PUMP_KICK_DEFAULTS), "status": {}, "mcu_ok": False}


def _pump_kick_parse(resp):
    kv = {}
    for part in str(resp or "").split(","):
        if "=" in part:
            k, v = part.split("=", 1)
            try:
                kv[k.strip()] = int(float(v))
            except ValueError:
                pass
    return kv


def _pump_kick_store(resp):
    kv = _pump_kick_parse(resp)
    if all(k in kv for k in PUMP_KICK_KEYS):
        pump_kick["config"] = {k: kv[k] for k in PUMP_KICK_KEYS}
        pump_kick["status"] = {k: kv.get(k) for k in ("kicking", "stall_kicks", "kicks")}
        pump_kick["mcu_ok"] = True
        return True
    return False


def pump_kick_read_from_mcu():
    try:
        return _pump_kick_store(Bridge.call("get_pump_kick", ""))
    except Exception as e:
        print(f"[pump] get_pump_kick failed: {e}")
        return False


def _pump_kick_apply(partial, save=True):
    arg = ",".join(f"{k}={int(partial[k])}" for k in PUMP_KICK_KEYS if partial.get(k) is not None)
    if not arg:
        return False, "Nothing to change"
    try:
        resp = Bridge.call("set_pump_kick", arg)
    except Exception as e:
        return False, str(e)
    if str(resp).startswith("rejected"):
        return False, str(resp).split(":", 1)[-1]
    if not _pump_kick_store(resp):
        return False, f"cannot parse MCU response: {resp}"
    if save:
        _pv_save("pump_kick", dict(pump_kick["config"]))
    return True, None


def push_pump_kick(client=None, ok=True, error=None):
    ui.send_message("pump_kick", {"ok": ok, "error": error, "config": dict(pump_kick["config"]),
                                  "status": dict(pump_kick["status"]),
                                  "mcu_ok": pump_kick["mcu_ok"]}, client)


def handle_pump_get_kick(client, data):
    pump_kick_read_from_mcu()
    push_pump_kick(client)


def handle_pump_set_kick(client, data):
    data = data or {}
    partial = {}
    for k in PUMP_KICK_KEYS:
        if data.get(k) is None:
            continue
        try:
            v = int(round(float(data[k]))) if not isinstance(data[k], bool) else int(data[k])
        except (TypeError, ValueError):
            push_pump_kick(client, ok=False, error=f"{k} is not a number")
            return
        partial[k] = v
    if "pwm" in partial and not (1 <= partial["pwm"] <= 255):
        push_pump_kick(client, ok=False, error="Kick PWM must be 1-255")
        return
    if "ms" in partial and not (0 <= partial["ms"] <= 5000):
        push_pump_kick(client, ok=False, error="Kick time must be 0-5000 ms")
        return
    ok, err = _pump_kick_apply(partial)
    print(f"[pump] start kick settings {partial}: {'OK' if ok else 'failed ' + str(err)}")
    push_pump_kick(None, ok=ok, error=err)


def pump_kick_restore():
    """On MCU reboot / program start, push the saved boost settings back to the MCU (only the differing parts)."""
    with _pv_lock:
        saved = dict(pv_saved.get("pump_kick") or {})
    if not pump_kick_read_from_mcu():
        return False
    if not saved:
        init = {k: _PUMP_KICK_CONST.get(f"kick_{k}") for k in PUMP_KICK_KEYS}
        init = {k: v for k, v in init.items() if v is not None}
        saved = init
    want = {k: int(saved[k]) for k in PUMP_KICK_KEYS if saved.get(k) is not None}
    if any(want[k] != pump_kick["config"].get(k) for k in want):
        ok, err = _pump_kick_apply(want)
        print(f"[pump] restore start kick settings: {'OK' if ok else 'failed ' + str(err)}")
    push_pump_kick()
    return True


ui.on_message("pump_get_kick", handle_pump_get_kick)
ui.on_message("pump_set_kick", handle_pump_set_kick)


# ============================= v4.9: MCU self-recovery, status / resync, test tools =============================
RPC_WD_MAX_PER_HOUR = 2
mcu_reboot_times = deque(maxlen=50)      # MCU reboot times detected by Python
rpc_wd_pref = {"en": 0, "sec": 60}     # v4.9.1: automatic reboot has been disabled
_mcu_test = {"stress": None, "sim_mcu_block_until": 0.0}


def _reboots_last_hour():
    now = time.time()
    return sum(1 for t in mcu_reboot_times if now - t < 3600)


def rpc_wd_apply():
    """v4.9.1: MCU auto-reboot removed (in testing, after a UNO Q software reboot the MCU does not reconnect to the Bridge).
    Always send en=0 here, to make sure the auto-reboot of old firmware (v3.10.6) is also disabled."""
    en = False
    try:
        r = Bridge.call("rpc_wd_set", f"en={1 if en else 0},sec={int(rpc_wd_pref.get('sec', 60))}")
        return True, str(r)
    except Exception as e:
        return False, str(e)


def mcu_restore_pump_after_reboot():
    """After an MCU reboot the pumps are always stopped (pins pulled low at boot). Restore direction and PWM from the pre-reboot settings (pump_state)."""
    with _pump_lock:
        pwm, fwd = int(pump_state.get("pwm") or 0), bool(pump_state.get("forward", True))
    if latest_safety.get("ptrip"):
        print("[pump] MCU restarted: pressure protection latched, pump stays stopped")
        return {"pwm": 0, "forward": fwd, "ok": True}
    if pwm <= 0:
        print("[pump] MCU restarted: pump was stopped before restart, stays stopped")
        return {"pwm": 0, "forward": fwd, "ok": True}
    ok1, _ = _safe_pump_bridge_call("set_pump_direction", "1" if fwd else "0")
    ok2, resp = _safe_pump_bridge_call("set_pump_pwm", str(pwm))
    ok = ok1 and ok2
    print(f"[pump] MCU restarted: restoring pump PWM {pwm} {'fwd' if fwd else 'rev'} -> {'OK' if ok else 'failed'}")
    push_pump_status()
    return {"pwm": pwm, "forward": fwd, "ok": ok}


def mcu_status_snapshot():
    with _mcu_call_lock:
        rpc = dict(mcu_rpc)
    return {
        "link": dict(mcu_link, expected_fw=EXPECTED_FW),
        "rpc": rpc,
        "diag": dict(latest_diag),
        "reboots": list(mcu_reboot_times)[-10:],
        "reboots_last_hour": _reboots_last_hour(),
        "wd_pref": dict(rpc_wd_pref), "wd_max_per_hour": RPC_WD_MAX_PER_HOUR,
        "sim_py_down_until": _sim_py_down_until if _sim_py_down_until > time.time() else 0,
        "sim_mcu_block_until": _mcu_test["sim_mcu_block_until"] if _mcu_test["sim_mcu_block_until"] > time.time() else 0,
        "stress": _mcu_test["stress"],
        "now": time.time(),
    }


def push_mcu_status(client=None, action=None, ok=True, msg=None):
    d = mcu_status_snapshot()
    d.update(action=action, ok=ok, msg=msg)
    ui.send_message("mcu_status", d, client)


def handle_mcu_status_get(client, data):
    push_mcu_status(client)


def handle_mcu_resync(client, data):
    def _bg():
        poll_mcu_diag()
        ok = bool(mcu_link.get("ok"))
        msg = None
        if ok:
            try:
                restore_ph_valve_state(reason="resync")
                push_pump_status(); push_ph_status(); push_valve_status(); push_calibration_state()
                msg = "All settings re-read and synced"
            except Exception as e:
                ok, msg = False, f"Sync failed: {e}"
        else:
            msg = "MCU not responding, cannot sync: " + str(mcu_link.get("error"))
        print(f"[mcu] resync: {msg}")
        push_mcu_status(None, action="resync", ok=ok, msg=msg)
    threading.Thread(target=_bg, daemon=True).start()


def handle_mcu_wd_set(client, data):
    d = data or {}
    if "en" in d:
        rpc_wd_pref["en"] = 1 if d["en"] else 0
    if d.get("sec") not in (None, ""):
        try:
            rpc_wd_pref["sec"] = int(max(20, min(3600, float(d["sec"]))))
        except (TypeError, ValueError):
            pass
    _pv_save("rpc_wd", dict(rpc_wd_pref))
    ok, r = rpc_wd_apply()
    push_mcu_status(None, action="wd", ok=ok, msg=r)


def handle_mcu_stress(client, data):
    n = int(max(1, min(200, float((data or {}).get("n", 50)))))
    methods = ("get_pump_status", "get_config", "get_pressure_offsets", "get_pump_kick", "valve_get_status")

    def _bg():
        results = []
        lock = threading.Lock()

        def one(i):
            m = methods[i % len(methods)]
            t0 = time.time()
            try:
                Bridge.call(m, "")
                ok = True
            except Exception:
                ok = False
            with lock:
                results.append((ok, time.time() - t0))
        _mcu_test["stress"] = {"state": "running", "n": n}
        push_mcu_status(None, action="stress")
        ths = [threading.Thread(target=one, args=(i,), daemon=True) for i in range(n)]
        t0 = time.time()
        for th in ths:
            th.start()
        for th in ths:
            th.join(timeout=120)
        lat = [d for ok, d in results if ok]
        res = {"state": "done", "n": n, "ok": sum(1 for ok, _ in results if ok), "fail": sum(1 for ok, _ in results if not ok),
               "avg_ms": round(sum(lat) / len(lat) * 1000, 1) if lat else None,
               "max_ms": round(max(lat) * 1000, 1) if lat else None, "total_s": round(time.time() - t0, 2)}
        _mcu_test["stress"] = res
        print(f"[mcu] stress test: {res}")
        push_mcu_status(None, action="stress", ok=res["fail"] == 0,
                        msg=f"{res['ok']}/{n} OK, avg {res['avg_ms']} ms, max {res['max_ms']} ms")
    threading.Thread(target=_bg, daemon=True).start()


def handle_mcu_sim_py_down(client, data):
    global _sim_py_down_until
    sec = float(max(5, min(300, float((data or {}).get("sec", 30)))))
    _sim_py_down_until = time.time() + sec
    print(f"[mcu] test: simulating Python-side disconnect for {sec:.0f} s")
    push_mcu_status(None, action="sim_py", msg=f"Simulated disconnect {sec:.0f} s")


def handle_mcu_sim_mcu_block(client, data):
    sec = int(max(10, min(600, float((data or {}).get("sec", 90)))))
    try:
        r = Bridge.call("rpc_test_block", str(sec))
        _mcu_test["sim_mcu_block_until"] = time.time() + sec
        print(f"[mcu] test: MCU simulating no commands for {sec} s -> {r}")
        push_mcu_status(None, action="sim_mcu", msg=str(r))
    except Exception as e:
        push_mcu_status(None, action="sim_mcu", ok=False, msg=str(e))


for _n, _h in (("mcu_status_get", handle_mcu_status_get), ("mcu_resync", handle_mcu_resync),
               ("mcu_wd_set", handle_mcu_wd_set), ("mcu_stress", handle_mcu_stress),
               ("mcu_sim_py_down", handle_mcu_sim_py_down), ("mcu_sim_mcu_block", handle_mcu_sim_mcu_block)):
    ui.on_message(_n, _h)


def _disable_wd_on_exit():
    """On normal App stop, disable the MCU watchdog so the MCU does not reboot by itself without Python (which would stop the pumps)."""
    try:
        _RawBridge.call("rpc_wd_set", "en=0", timeout=2)
        print("[rpc] App stopping: MCU auto-restart disabled")
    except Exception:
        pass


import atexit
atexit.register(_disable_wd_on_exit)


# v4.5 (FW v3.10.2): DS18B20 1-Wire diagnostics (web UI button); also asks the MCU to re-scan immediately
def handle_ds_diag(client, data):
    try:
        resp = str(Bridge.call("ds_diag", ""))
        ok = not resp.startswith("rejected")
    except Exception as e:
        resp, ok = f"Bridge call failed: {e} (requires firmware v3.10.1+)", False
    kv = {}
    head, _, hint = resp.partition(" => ")
    for part in head.split():
        if "=" in part:
            k, v = part.split("=", 1)
            kv[k] = v
    print(f"[ds18b20] diagnostics requested by web: {resp}")
    ui.send_message("ds_diag", {"ok": ok, "raw": resp, "kv": kv, "hint": hint, "t": time.time()}, client)


ui.on_message("ds_diag", handle_ds_diag)

# (v3.2: _sync_pump_status_from_mcu() moved into the startup thread, see _startup_mcu_sync at the end of the file)


# ============================= Shared: key=value strings =============================
def _parse_kv(payload):
    """Split "a=1,b=2,msg=xxx" from the MCU into a dict (values kept as strings)."""
    out = {}
    for tok in str(payload or "").split(","):
        if "=" not in tok:
            continue
        k, v = tok.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def _f(v, default=None):
    try:
        x = float(v)
        return x if math.isfinite(x) else default
    except (TypeError, ValueError):
        return default


def _i(v, default=None):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def _rejected(resp):
    return str(resp).strip().startswith("rejected")


def _reject_reason(resp):
    s = str(resp).strip()
    return s.split(":", 1)[1] if ":" in s else s


# ============================= Persistence of pH calibration and pinch valve settings (v3) =============================
# pH calibration points and pinch valve positions / safety limits all live in MCU RAM; once the MCU reboots they
# revert to the defaults in the sketch. As with OD600/pressure calibration, the Linux side keeps a copy (ph_valve_state.json),
# and pushes it back when an MCU reboot is detected.
#
# Rule: settings changed and saved in the web UI take precedence over sketch defaults. To return to sketch defaults,
#       delete ph_valve_state.json and restart the App.
PH_VALVE_STATE_PATH = os.path.join(_SEARCH_DIR, "ph_valve_state.json")
_pv_lock = threading.Lock()
pv_saved = {}            # {"ph_config": {...}, "valve_config": {...}}
_pv_startup_done = False # Until startup sync (pushing saved values back to the MCU) completes, do not save any values read from the MCU


def _load_pv_state():
    try:
        with open(PH_VALVE_STATE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except (json.JSONDecodeError, OSError) as e:
        print(f"[ph/valve] failed to read {PH_VALVE_STATE_PATH} ({e}), treating as no saved state")
        return {}


def _pv_save(item, value):
    with _pv_lock:
        pv_saved[item] = dict(value, saved_at=time.time())
        try:
            tmp_path = PH_VALVE_STATE_PATH + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(pv_saved, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, PH_VALVE_STATE_PATH)   # atomic replace, so a power loss mid-write cannot corrupt the file
        except OSError as e:
            print(f"[ph/valve] failed to write {PH_VALVE_STATE_PATH}: {e}")


# ============================= pH monitoring (v5.0: conversion done on the Linux side) =============================
# Every 500 ms the MCU sums 256 ADC readings and sends them each second via on_aux_raw (1-2 entries at a time), along with the raw DS18B20 value. Here:
#   voltage = sum / count / ADC_MAX x VREF
#   temperature = DS18B20 (status ok, read within 5 s, -10~100 °C, not the power-on default 85.0), otherwise the manual temperature
#   pH   = 7.00 + (V − V7) × (7.00 − 4.01)/(V7 − V4) × (T_cal + 273.15)/(T + 273.15)
#          (Nernst slope proportional to absolute temperature, pivoting on pH 7; T_cal = buffer temperature when the pH 4.01 point was measured)
#   filtering = a single jump > 0.5 pH must repeat 3 consecutive times to be accepted, then EMA (alpha = 0.2)
# v5.0 fix: calibration points use the average voltage over the last 5 s (v4.x used a single sample); pH 4 calibration records the buffer temperature as T_cal
# (the slope is determined by the pH 4 point; v4.x wrongly used the temperature of the pH 7 point as T_cal).
PH_CONFIG_KEYS = ("v7", "v4", "cal_temp", "temp")   # temp = manual compensation temperature
PH_DEFAULTS = {"v7": 1.5, "v4": 2.0, "cal_temp": 25.0, "temp": 37.0}
PH_STALE_SEC = 10.0
PH_MIN_OK, PH_MAX_OK = 2.0, 12.0
PH_EMA_ALPHA = 0.20
PH_SPIKE = 0.50
PH_SPIKE_CONFIRM = 3
PH_CAL_AVG_S = 5.0
DS_MAX_AGE_MS = 5000

_ph_lock = threading.Lock()
latest_ph = {"ts": 0.0, "ph": None, "voltage": None, "temp_c": None, "state": "UNKNOWN",
             "temp_src": "manual", "ds_state": "none", "ds_err": None}
latest_temp = {"ts": 0.0, "temp_c": None, "valid": False}        # DS18B20 (used for mu(T))
ph_config = dict(PH_DEFAULTS)
_ph_filt = {"value": None, "spike": 0}
_ph_volts = deque()               # (time, V) over the last PH_CAL_AVG_S seconds, for calibration
_aux_last_seq = None


def ph_from_voltage(v, t):
    c = ph_config
    slope = (7.00 - 4.01) / (c["v7"] - c["v4"])
    slope *= (c["cal_temp"] + 273.15) / (t + 273.15)
    return 7.00 + (v - c["v7"]) * slope


def _ph_filter(raw):
    f = _ph_filt
    if f["value"] is None:
        f["value"] = raw
        return raw
    if abs(raw - f["value"]) > PH_SPIKE:
        f["spike"] += 1
        if f["spike"] < PH_SPIKE_CONFIRM:
            return f["value"]
    f["spike"] = 0
    f["value"] += PH_EMA_ALPHA * (raw - f["value"])
    return f["value"]


def _ph_snapshot():
    with _ph_lock:
        snap = dict(latest_ph)
    snap["config"] = dict(ph_config, temp_src=snap.get("temp_src"))
    snap["stale"] = (time.time() - snap["ts"]) > PH_STALE_SEC if snap["ts"] else True
    return snap


def push_ph_status(client=None):
    ui.send_message("ph_update", _ph_snapshot(), client)


def on_aux_raw(payload):
    """MCU every second: "seq=..,t=..,ph=sum:n:t;..,ds=..,traw=..,tage=..,derr=..,pwm=..,fwd=..,kick=..".
    Bridge callback: computation and broadcast only."""
    global _aux_last_seq
    kv = _parse_kv(payload)
    seq, t_ms = _i(kv.get("seq")), _i(kv.get("t"))
    if seq is None or t_ms is None:
        print(f"[ph] WARNING: on_aux_raw got bad payload: {str(payload)[:100]}")
        return
    recv = time.time()
    if _aux_last_seq is not None and seq > _aux_last_seq + 1:
        raw_event("aux_gap", {"missing": seq - _aux_last_seq - 1, "seq": seq})
    _aux_last_seq = seq
    rs = raw_session
    if rs is not None:
        rs.write("aux", [[f"{mcu_ms_to_epoch(t_ms, recv) + t_ms / 1000.0:.3f}", t_ms, seq, kv.get("ph", ""),
                          kv.get("ds", ""), kv.get("traw", ""), kv.get("tage", ""), kv.get("derr", ""),
                          kv.get("pwm", ""), kv.get("fwd", ""), kv.get("kick", ""),
                          kv.get("bon", ""), kv.get("bleft", ""), kv.get("ptrip", "")]])
    safety_base_from_aux(kv)      # v6.0: base pump / pressure protection status

    # ---- Temperature ----
    ds_state = kv.get("ds", "none")
    traw, tage = _i(kv.get("traw")), _i(kv.get("tage"), -1)
    t_ds = (traw / 16.0) if traw is not None else None
    ds_ok = (ds_state == "ok" and t_ds is not None and 0 <= tage <= DS_MAX_AGE_MS
             and -10.0 < t_ds < 100.0 and t_ds != 85.0)
    if ds_ok:
        latest_temp.update(ts=recv, temp_c=round(t_ds, 4), valid=True)
    elif recv - (latest_temp["ts"] or 0) > 10.0:
        latest_temp.update(valid=False)
    temp = t_ds if ds_ok else ph_config["temp"]
    src = "ds18b20" if ds_ok else "manual"

    # ---- pH ----
    adc_max = _adc_max()
    last_v = None
    for tok in (kv.get("ph") or "").split(";"):
        parts = tok.split(":")
        if len(parts) < 2:
            continue
        ssum, n = _f(parts[0]), _f(parts[1])
        if not ssum or not n:
            continue
        v = ssum / n / adc_max * mcu_cfg["vref"]
        last_v = v
        _ph_volts.append((recv, v))
        _ph_filter(ph_from_voltage(v, temp))
    while _ph_volts and recv - _ph_volts[0][0] > PH_CAL_AVG_S:
        _ph_volts.popleft()
    ph = _ph_filt["value"]
    state = "WARMUP" if ph is None else ("PROBE_ERROR" if not (PH_MIN_OK <= ph <= PH_MAX_OK) else "OK")
    with _ph_lock:
        prev_state = latest_ph.get("state")
        latest_ph.update({"ts": recv, "ph": None if ph is None else round(ph, 3),
                          "voltage": round(last_v, 5) if last_v is not None else latest_ph.get("voltage"),
                          "temp_c": round(temp, 2), "state": state, "temp_src": src, "ds_state": ds_state,
                          "ds_err": kv.get("derr")})
        d = dict(latest_ph)
    if state == "PROBE_ERROR" and prev_state != "PROBE_ERROR":
        print(f"[ph] WARNING: pH reading out of range (pH={d['ph']}, V={d['voltage']}), check probe/wiring/calibration")
    if state == "OK" and last_v is not None:
        agg_push_ph(d)
    push_ph_status()


Bridge.provide("on_aux_raw", on_aux_raw)


def _ph_apply_config(cfg_partial, save_as=None):
    """Update pH calibration (Linux side), save, log an event, and recompute immediately with the latest voltage. Returns (ok, error)."""
    new = dict(ph_config)
    for k in PH_CONFIG_KEYS:
        if cfg_partial.get(k) is not None:
            new[k] = float(cfg_partial[k])
    if not (0.0 < new["v7"] < 3.3 and 0.0 < new["v4"] < 3.3):
        return False, "Voltage must be 0-3.3 V"
    if abs(new["v7"] - new["v4"]) < 0.05:
        return False, "pH 7 and pH 4 voltages too close (need >= 0.05 V apart)"
    if not (0.0 <= new["cal_temp"] <= 80.0 and 0.0 <= new["temp"] <= 80.0):
        return False, "Temperature must be 0-80 °C"
    ph_config.update(new)
    _pv_save("ph_config", dict(new, source=save_as or "manual"))
    raw_event("ph_config", dict(new, source=save_as or "manual"))
    if _ph_volts:
        with _ph_lock:
            t = latest_ph.get("temp_c") or new["temp"]
        _ph_filt.update(value=ph_from_voltage(_ph_volts[-1][1], t), spike=0)
    return True, None


def push_ph_config(client=None, ok=True, error=None, action=None):
    with _pv_lock:
        saved = pv_saved.get("ph_config") or {}
    with _ph_lock:
        src = latest_ph.get("temp_src")
    ui.send_message("ph_config", {
        "ok": ok, "error": error, "action": action,
        "config": dict(ph_config, temp_src=src), "source": saved.get("source"), "saved_at": saved.get("saved_at"),
    }, client)


def handle_ph_get_config(client, data):
    push_ph_config(client)


def handle_ph_calibrate(client, data):
    """Two-point calibration: point = "7" or "4"; buffer_temp = buffer temperature (the temperature of the pH 4 point, which determines the slope)."""
    point = str((data or {}).get("point", "")).strip()
    buf_t = _f((data or {}).get("buffer_temp"))
    vs = [v for t, v in _ph_volts if time.time() - t <= PH_CAL_AVG_S]
    if len(vs) < 3:
        push_ph_config(client, ok=False, error="Not enough pH voltage readings (need at least 3 in the last 5 s)", action="calibrate")
        return
    v = sum(vs) / len(vs)
    if point == "7":
        ok, err = _ph_apply_config({"v7": round(v, 5)}, save_as="measured")
    elif point == "4":
        with _ph_lock:
            t_now = latest_ph.get("temp_c")
        t_cal = buf_t if buf_t is not None else (t_now if t_now is not None else ph_config["temp"])
        ok, err = _ph_apply_config({"v4": round(v, 5), "cal_temp": round(t_cal, 2)}, save_as="measured")
    else:
        ok, err = False, "point must be 7 or 4"
    if ok:
        print(f"[ph] calibration point pH{point}: V = {v:.4f} (mean of last {len(vs)} readings)" +
              (f", buffer {buf_t} °C" if buf_t is not None else ""))
    push_ph_config(None if ok else client, ok=ok, error=err, action=f"calibrate{point}" if ok else "calibrate")


def handle_ph_set_temp(client, data):
    t = _f((data or {}).get("temp"))
    if t is None or not (0.0 <= t <= 80.0):
        push_ph_config(client, ok=False, error="Temperature must be 0-80 °C", action="temp")
        return
    ok, err = _ph_apply_config({"temp": round(t, 2)}, save_as="manual")
    push_ph_config(None if ok else client, ok=ok, error=err, action="temp")


def handle_ph_set_calibration(client, data):
    d = data or {}
    v7, v4, ct = _f(d.get("v7")), _f(d.get("v4")), _f(d.get("cal_temp"))
    if v7 is None or v4 is None or ct is None:
        push_ph_config(client, ok=False, error="v7, v4 and calibration temperature are all required", action="manual_cal")
        return
    ok, err = _ph_apply_config({"v7": round(v7, 5), "v4": round(v4, 5), "cal_temp": round(ct, 2)}, save_as="manual")
    if ok:
        print(f"[ph] manual calibration: pH7={v7:.4f} V, pH4={v4:.4f} V, cal temp {ct:.1f} °C")
    push_ph_config(None if ok else client, ok=ok, error=err, action="manual_cal")


ui.on_message("ph_get_config", handle_ph_get_config)
ui.on_message("ph_set_calibration", handle_ph_set_calibration)
ui.on_message("ph_calibrate", handle_ph_calibrate)
ui.on_message("ph_set_temp", handle_ph_set_temp)


# ============================= Pinch valve STS3215 (v3) =============================
# Manual open / close only. Safety release (TMP/Feed over limit, clamp timeout, servo overheat, comms loss) is all on the MCU side;
# this side handles: the UI, saving/restoring settings, and writing one row to valve_events.csv per clamp -> release cycle.
VALVE_CONFIG_KEYS = ("id", "open", "closed", "speed", "acc", "torque_limit",
                     "max_close_s", "tmp_limit", "feed_limit", "baud", "feed_basis")   # baud: v3.4, feed_basis: v4.11
_VALVE_CONST = CONST.get("valve", {}) or {}
# Pinch valve actions cause sharp changes in dP / R / dTMP/dt, so these fouling-trend alerts are suspended while clamped and
# for this period after release, to avoid mistaking sample collection for membrane clogging. Absolute TMP limit alerts are unaffected.
VALVE_ALERT_SETTLE_SEC = float(_VALVE_CONST.get("alert_settle_sec", 60.0))
VALVE_SUPPRESSED_ALERTS = ("dp_ratio_high", "gamma_ratio_high", "lp_low", "ps_rise")

_valve_lock = threading.Lock()
latest_valve = {
    "ts": 0.0, "online": False, "cmd": "unknown", "fault": False, "pos": None, "goal": None,
    "load": None, "temp_c": None, "voltage_v": None, "current": None, "moving": False,
    "closed_s": 0.0, "torque": False, "configured": False, "msg": "",
}
valve_config = {}
_valve_opened_at_mono = None       # time of the most recent return to open (for alert suppression)
_valve_event = None                # accumulator for the in-progress (clamped) event
_valve_last_open_request = (None, 0.0)   # (reason, wall time): used to determine what triggered the release
_valve_event_index = 0
recent_valve_events = deque(maxlen=20)

VALVE_EVENTS_HEADER = ("event_index,closed_at,opened_at,duration_s,mode,open_reason,"
                       "tmp_mean_bar,tmp_peak_bar,feed_peak_bar,permeate_mean_bar,"
                       "flow_mean_mlmin,n_pressure_samples,recording_file\n")


def _valve_events_path():
    return os.path.join(RECORDINGS_DIR, "valve_events.csv")


def _valve_from_kv(kv):
    volt = _i(kv.get("volt"))
    return {
        "ts": time.time(),
        "online": kv.get("online") == "1",
        "cmd": kv.get("cmd", "unknown"),
        "fault": kv.get("fault") == "1",
        "pos": _i(kv.get("pos")),
        "goal": _i(kv.get("goal")),
        "load": _i(kv.get("load")),
        "temp_c": _i(kv.get("temp")),
        "voltage_v": (volt / 10.0) if (volt is not None and volt >= 0) else None,
        "current": _i(kv.get("cur")),
        "moving": kv.get("moving") not in (None, "", "0"),
        "closed_s": round((_i(kv.get("closed_ms"), 0) or 0) / 1000.0, 1),
        "torque": kv.get("torque") == "1",
        "configured": kv.get("configured") == "1",
        "baud": _i(kv.get("baud")),
        "rx_bytes": _i(kv.get("rx")),
        "scanning": kv.get("scanning") == "1",
        "msg": kv.get("msg", ""),
    }


def valve_is_active():
    """The pinch valve is currently not "open" (clamped, or at a jog position used for setup)."""
    with _valve_lock:
        return latest_valve.get("cmd") in ("closed", "jog")


def valve_alerts_suppressed():
    if valve_is_active():
        return True
    return (_valve_opened_at_mono is not None
            and (time.monotonic() - _valve_opened_at_mono) < VALVE_ALERT_SETTLE_SEC)


def push_valve_status(client=None):
    with _valve_lock:
        snap = dict(latest_valve)
    snap["config"] = dict(valve_config)
    snap["settle_remaining_s"] = (
        round(max(0.0, VALVE_ALERT_SETTLE_SEC - (time.monotonic() - _valve_opened_at_mono)), 0)
        if (_valve_opened_at_mono is not None and snap["cmd"] == "open") else 0
    )
    ui.send_message("valve_update", snap, client)


def _valve_track_pressure(snapshot):
    """Collect pressure statistics while clamped (called by on_pressure_update every 200ms)."""
    ev = _valve_event
    if ev is None:
        return
    ev["n"] += 1
    ev["tmp_sum"] += snapshot["tmp"]["mean_filtered"]
    ev["perm_sum"] += snapshot["channels"]["permeate"]["mean_filtered"]
    ev["tmp_peak"] = max(ev["tmp_peak"], snapshot["tmp"]["peak"])
    ev["feed_peak"] = max(ev["feed_peak"], snapshot["channels"]["feed"]["peak"])
    ev["flow_sum"] += latest_flow.get("flow", 0.0)


def _valve_write_event(row):
    path = _valve_events_path()
    try:
        new_file = not os.path.exists(path)
        with open(path, "a", encoding="utf-8") as f:
            if new_file:
                f.write(VALVE_EVENTS_HEADER)
            f.write(",".join(str(row.get(k, "")) for k in VALVE_EVENTS_HEADER.strip().split(",")) + "\n")
            f.flush()
            os.fsync(f.fileno())
    except OSError as e:
        print(f"[valve] failed to write {path}: {e}")


def on_valve_update(payload):
    """Notify from MCU every second + on state change. Bridge callback: no synchronous RPC.
    Detect "open -> closed/jog" and "-> open" transitions here and assemble them into one pinch valve event."""
    global _valve_event, _valve_opened_at_mono, _valve_event_index
    kv = _parse_kv(payload)
    if "cmd" not in kv:
        print(f"[valve] WARNING: on_valve_update got bad payload: {payload}")
        return
    d = _valve_from_kv(kv)
    rs = raw_session
    if rs is not None:
        rs.write("valve", [[f"{time.time():.3f}", str(payload)]])
    with _valve_lock:
        prev_cmd = latest_valve.get("cmd")
        prev_fault = latest_valve.get("fault")
        latest_valve.update(d)

    now_wall = time.time()
    if d["cmd"] in ("closed", "jog") and prev_cmd not in ("closed", "jog"):
        _valve_event = {
            "closed_at": now_wall - d["closed_s"], "mode": d["cmd"], "n": 0,
            "tmp_sum": 0.0, "perm_sum": 0.0, "flow_sum": 0.0,
            "tmp_peak": float("-inf"), "feed_peak": float("-inf"),
        }
        print(f"[valve] {d['cmd'].upper()} (goal {d['goal']})")
    elif d["cmd"] == "open" and prev_cmd in ("closed", "jog"):
        _valve_opened_at_mono = time.monotonic()
        reason, req_at = _valve_last_open_request
        if d["fault"] and d["msg"]:
            why = f"auto: {d['msg']}"
        elif reason and now_wall - req_at < 10:
            why = reason
        else:
            why = "mcu"
        ev = _valve_event
        _valve_event = None
        if ev is not None:
            _valve_event_index += 1
            n = max(ev["n"], 1)
            row = {
                "event_index": _valve_event_index,
                "closed_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ev["closed_at"])),
                "opened_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now_wall)),
                "duration_s": round(now_wall - ev["closed_at"], 1),
                "mode": ev["mode"],
                "open_reason": why.replace(",", ";"),
                "tmp_mean_bar": round(ev["tmp_sum"] / n, 5) if ev["n"] else "",
                "tmp_peak_bar": round(ev["tmp_peak"], 5) if ev["n"] else "",
                "feed_peak_bar": round(ev["feed_peak"], 5) if ev["n"] else "",
                "permeate_mean_bar": round(ev["perm_sum"] / n, 5) if ev["n"] else "",
                "flow_mean_mlmin": round(ev["flow_sum"] / n, 2) if ev["n"] else "",
                "n_pressure_samples": ev["n"],
                "recording_file": os.path.basename(record_csv_path) if record_csv_path else "",
            }
            _valve_write_event(row)
            recent_valve_events.appendleft(row)
            ui.send_message("valve_event", row)
            print(f"[valve] OPEN after {row['duration_s']} s ({why})")
    if d["fault"] and not prev_fault:
        print(f"[valve] !! FAULT: {d['msg']}")
    agg_push_valve(d)
    push_valve_status()


Bridge.provide("on_valve_update", on_valve_update)


def _valve_read_config_from_mcu():
    try:
        kv = _parse_kv(Bridge.call("valve_get_config", ""))
    except Exception as e:
        print(f"[valve] valve_get_config failed: {e}")
        return None
    cfg = {k: _f(kv.get(k)) for k in VALVE_CONFIG_KEYS}
    return cfg if all(v is not None for v in cfg.values()) else None


def _valve_apply_config(partial, source="manual"):
    global valve_config
    arg = ",".join(f"{k}={partial[k]}" for k in VALVE_CONFIG_KEYS if partial.get(k) is not None)
    if not arg:
        return False, "Nothing to change"
    try:
        resp = Bridge.call("valve_set_config", arg)
    except Exception as e:
        return False, str(e)
    if _rejected(resp):
        return False, _reject_reason(resp)
    kv = _parse_kv(resp)
    cfg = {k: _f(kv.get(k)) for k in VALVE_CONFIG_KEYS}
    if all(v is not None for v in cfg.values()):
        valve_config = cfg
        _pv_save("valve_config", dict(cfg, source=source))
    return True, None


def push_valve_config(client=None, ok=True, error=None, action=None):
    ui.send_message("valve_config", {"ok": ok, "error": error, "action": action,
                                     "config": dict(valve_config)}, client)


def _valve_call(client, name, arg, action):
    try:
        resp = Bridge.call(name, arg)
    except Exception as e:
        ui.send_message("valve_action_result", {"action": action, "ok": False, "error": str(e)}, client)
        return None
    ok = not _rejected(resp)
    ui.send_message("valve_action_result", {
        "action": action, "ok": ok, "error": None if ok else _reject_reason(resp),
    }, client)
    return resp if ok else None


def handle_valve_open(client, data):
    global _valve_last_open_request
    _valve_last_open_request = ("manual", time.time())
    raw_event("valve_open_cmd", None)
    _valve_call(client, "valve_open", "", "open")


def handle_valve_close(client, data):
    raw_event("valve_close_cmd", None)
    _valve_call(client, "valve_close", "", "close")


def handle_valve_goto_raw(client, data):
    pos = _i((data or {}).get("pos"))
    if pos is None:
        ui.send_message("valve_action_result", {"action": "goto", "ok": False, "error": "Position must be an integer 0-4095"}, client)
        return
    _valve_call(client, "valve_goto_raw", str(pos), "goto")


def handle_valve_torque(client, data):
    on = bool((data or {}).get("on", True))
    _valve_call(client, "valve_torque", "1" if on else "0", "torque_on" if on else "torque_off")


def handle_valve_clear_fault(client, data):
    _valve_call(client, "valve_clear_fault", "", "clear_fault")


def handle_valve_rescan(client, data):
    _valve_call(client, "valve_rescan", "", "rescan")


def handle_valve_get_config(client, data):
    global valve_config
    cfg = _valve_read_config_from_mcu()
    if cfg:
        valve_config = cfg
    push_valve_config(client, ok=cfg is not None, error=None if cfg else "Cannot read pinch valve settings from MCU")


def handle_valve_set_config(client, data):
    data = data or {}
    partial = {}
    for k in VALVE_CONFIG_KEYS:
        if data.get(k) not in (None, ""):
            v = _f(data.get(k))
            if v is None:
                push_valve_config(client, ok=False, error=f"{k} is not a number", action="settings")
                return
            partial[k] = int(v) if k in ("id", "open", "closed", "speed", "acc", "torque_limit",
                                         "max_close_s", "baud", "feed_basis") else v
    ok, err = _valve_apply_config(partial)
    push_valve_config(None if ok else client, ok=ok, error=err, action="settings")


def handle_valve_save_position(client, data):
    """Record the servo's current actual position as the open / clamped position (used with torque off and turning by hand, or jog fine-tuning)."""
    which = (data or {}).get("which")
    if which not in ("open", "closed"):
        return
    with _valve_lock:
        pos = latest_valve.get("pos")
        online = latest_valve.get("online")
    if not online or pos is None or pos < 0:
        push_valve_config(client, ok=False, error="Servo offline or position not read yet", action=f"save_{which}")
        return
    ok, err = _valve_apply_config({which: int(pos)})
    push_valve_config(None if ok else client, ok=ok, error=err, action=f"save_{which}")


# ---- v3.4: servo auto-scan ----
# The MCU tries 8 baud rates x ID 0~253 in turn (full, about 30 s) or sends only a broadcast Ping (quick, about 1 s).
# After starting, this side runs a thread polling progress and pushing it to the web UI; when done, gives troubleshooting hints based on bytes received.
_valve_scan_thread = None


def _parse_scan_status(raw):
    kv = _parse_kv(raw)
    found = []
    for tok in (kv.get("found") or "").split(";"):
        if "@" in tok:
            i, b = tok.split("@", 1)
            if _i(i) is not None and _i(b) is not None:
                found.append({"id": _i(i), "baud": _i(b)})
    rx = {}
    for tok in (kv.get("rx") or "").split(";"):
        if ":" in tok:
            b, n = tok.split(":", 1)
            if _i(b) is not None:
                rx[str(_i(b))] = _i(n, 0)
    st = {"state": kv.get("state", "idle"), "progress": _i(kv.get("progress"), 0),
          "baud": _i(kv.get("baud")), "found": found, "rx": rx}
    if st["state"] == "done":
        if found:
            st["hint"] = "found"
        elif all((n or 0) <= 2 for n in rx.values()):
            # v3.5: each baud-rate switch reads 1 noise byte when the UART is reconfigured, so <= 2 bytes per baud rate
            #       still counts as no response at all (v3.4 misclassified this case as garbled)
            st["hint"] = "no_bytes"      # no response at all: wiring / power / jumpers
        else:
            st["hint"] = "garbled"       # received but unparseable: wiring / echo / interference
    return st


def _valve_scan_poll():
    deadline = time.time() + 90
    while time.time() < deadline:
        time.sleep(0.7)
        try:
            st = _parse_scan_status(Bridge.call("valve_scan_status", ""))
        except Exception as e:
            ui.send_message("valve_scan", {"state": "error", "error": str(e)})
            return
        ui.send_message("valve_scan", st)
        if st["state"] == "done":
            print(f"[valve][scan] done: found {st['found'] or 'none'}; bytes received per baud {st['rx']}")
            return
    ui.send_message("valve_scan", {"state": "error", "error": "Scan timed out (90 s)"})


def handle_valve_scan(client, data):
    global _valve_scan_thread
    mode = "quick" if (data or {}).get("mode") == "quick" else "full"
    try:
        resp = Bridge.call("valve_scan", mode)
    except Exception as e:
        ui.send_message("valve_scan", {"state": "error", "error": str(e)}, client)
        return
    if _rejected(resp):
        ui.send_message("valve_scan", {"state": "error", "error": _reject_reason(resp)}, client)
        return
    print(f"[valve][scan] starting {'quick' if mode == 'quick' else 'full'} scan")
    ui.send_message("valve_scan", {"state": "running", "progress": 0, "mode": mode, "found": [], "rx": {}})
    if _valve_scan_thread is None or not _valve_scan_thread.is_alive():
        _valve_scan_thread = threading.Thread(target=_valve_scan_poll, daemon=True, name="valve_scan_poll")
        _valve_scan_thread.start()


def handle_valve_blind_move(client, data):
    """v3.5 blind move test: needs no servo response; used to tell whether TX/power or the RX (response) path is broken."""
    pos = _i((data or {}).get("pos"))
    if pos is None:
        return
    print(f"[valve] blind move test: broadcast move to {pos} (8 baud rates)")
    _valve_call(client, "valve_blind_move", str(pos), "blind")


def handle_valve_loopback(client, data):
    """v3.6: D0-D1 loopback test. Result is returned via the valve_loopback message."""
    try:
        resp = Bridge.call("valve_loopback", "")
        if _rejected(resp):
            ui.send_message("valve_loopback", {"state": "error", "error": _reject_reason(resp)}, client)
            return
        for _ in range(20):
            time.sleep(0.25)
            kv = _parse_kv(Bridge.call("valve_loopback_status", ""))
            if kv.get("state") == "done":
                res = {"state": "done", "ok115200": _i(kv.get("ok115200"), 0),
                       "ok1000000": _i(kv.get("ok1000000"), 0), "total": _i(kv.get("total"), 64)}
                print(f"[valve] loopback test: 115200 {res['ok115200']}/64, 1Mbps {res['ok1000000']}/64")
                ui.send_message("valve_loopback", res, client)
                return
        ui.send_message("valve_loopback", {"state": "error", "error": "Timed out"}, client)
    except Exception as e:
        ui.send_message("valve_loopback", {"state": "error", "error": str(e)}, client)


def handle_valve_use_found(client, data):
    """Scan result "Use" button: write the servo ID and baud rate into settings (and save)."""
    data = data or {}
    sid, baud = _i(data.get("id")), _i(data.get("baud"))
    if sid is None or baud is None:
        return
    ok, err = _valve_apply_config({"id": sid, "baud": baud})
    if ok:
        print(f"[valve] switching to servo ID {sid} @ {baud} baud")
    push_valve_config(None if ok else client, ok=ok, error=err, action="use_found")


def handle_valve_list_events(client, data):
    ui.send_message("valve_events_list", {"events": list(recent_valve_events),
                                          "file": _valve_events_path()}, client)


ui.on_message("valve_open", handle_valve_open)
ui.on_message("valve_close", handle_valve_close)
ui.on_message("valve_goto_raw", handle_valve_goto_raw)
ui.on_message("valve_torque", handle_valve_torque)
ui.on_message("valve_clear_fault", handle_valve_clear_fault)
ui.on_message("valve_rescan", handle_valve_rescan)
ui.on_message("valve_get_config", handle_valve_get_config)
ui.on_message("valve_set_config", handle_valve_set_config)
ui.on_message("valve_save_position", handle_valve_save_position)
ui.on_message("valve_list_events", handle_valve_list_events)
ui.on_message("valve_scan", handle_valve_scan)
ui.on_message("valve_use_found", handle_valve_use_found)
ui.on_message("valve_blind_move", handle_valve_blind_move)
ui.on_message("valve_loopback", handle_valve_loopback)


# ============================= v6.0: pressure protection / base pump / shell valve and feed valve / auto pH =============================
# Division of responsibility (same as v5): MCU does execution and safety interlocks, this side does decisions, persistence and logging, web UI only sends commands.
#   Pressure protection  MCU: any of three channels > limit (default 0.7 bar) for 50 ms -> stop main pump + stop base dosing + release pinch valve + latch PTRIP.
#             Here: store limit, push back on MCU reboot, zero pump_state when latched (so pumps are not automatically turned back on after reboot).
#   Base pump  MCU: pulse timing, may only run when the feed valve is in position, hourly cumulative limit. Here: manual pulse (priming) and settings.
#   Shell valve / feed valve  MCU: movement, position readback, offline detection. Here: position settings persistence, state restore, event logging.
#   Auto pH   ph_control.py (pure logic) decides every second "switch valve / send pulse / wait for steady state"; this side executes and logs.
import ph_control as PC                # v6.0: auto pH (base dosing) control logic

AV_NAMES = ("shell", "feed")
AV_STATES = {"shell": ("closed", "sensor", "collect"), "feed": ("closed", "base", "feed")}
AV_DEG = {"shell": (315, 270, 0), "feed": (315, 270, 180)}
_AV_CONST = CONST.get("aux_valves") or {}
AV_DEFAULT_CFG = {
    n: {"id": int((_AV_CONST.get(n) or {}).get("servo_id", 2 if n == "shell" else 3)),
        "pos": [int(round(d / 360.0 * 4096)) % 4096 for d in AV_DEG[n]],
        "speed": int(_AV_CONST.get("speed", 1500)), "acc": int(_AV_CONST.get("acc", 50))}
    for n in AV_NAMES
}
_PP_CONST = CONST.get("pressure_protect") or {}
_BASE_CONST = CONST.get("base_pump") or {}

_v6_lock = threading.Lock()
latest_avalve = {n: {"ts": 0.0, "online": False, "id": None, "state": "unknown", "target": None, "pos": None,
                     "goal": None, "moving": False, "temp_c": None, "load": None, "inpos": False, "seen": False}
                 for n in AV_NAMES}
av_config = {n: dict(AV_DEFAULT_CFG[n], pos=list(AV_DEFAULT_CFG[n]["pos"])) for n in AV_NAMES}
av_desired = {"shell": "sensor", "feed": "closed"}      # state last selected by the user (restored after MCU reboot; base dosing is not restored)
_av_restore_pending = {}                                # states pending restore after MCU reboot / startup
latest_safety = {"ts": 0.0, "ptrip": False, "msg": "", "limit": float(_PP_CONST.get("limit_bar", 0.7)),
                 "count": 0, "pmax": None}
pressure_protect_cfg = {"limit": float(_PP_CONST.get("limit_bar", 0.7))}
latest_base = {"ts": 0.0, "on": False, "pwm": None, "left_ms": 0, "hour_ms": 0, "max_h_ms": None, "count": 0, "why": "",
               "feed_pwm": 0, "feed_fwd": False,   # v6.2: feed pump (channel B continuous run)
               "pin_test": False, "rb": ""}   # v6.2.1: pin test, pin read-back
base_cfg = {"pwm": int(_BASE_CONST.get("pwm", 255)), "max_s_h": float(_BASE_CONST.get("max_s_per_hour", 60))}
ph_doser = PC.PhDoser({k: v for k, v in (CONST.get("ph_control") or {}).items()
                       if not str(k).startswith("_") and k != "enabled"})
PH_DOSE_LOG_HEADER = "timestamp,event,ph,target,state,detail\n"


def _ph_dose_log_path():
    return os.path.join(RECORDINGS_DIR, "ph_dose_events.csv")


def _ph_dose_log(kind, detail, ph=None):
    path = _ph_dose_log_path()
    try:
        new_file = not os.path.exists(path)
        with open(path, "a", encoding="utf-8") as f:
            if new_file:
                f.write(PH_DOSE_LOG_HEADER)
            d = json.dumps(detail or {}, ensure_ascii=False).replace('"', "'")
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')},{kind},{'' if ph is None else round(ph, 3)},"
                    f"{ph_doser.cfg['target']},{ph_doser.state},\"{d}\"\n")
            f.flush()
            os.fsync(f.fileno())
    except OSError as e:
        print(f"[ph_ctrl] failed to write {path}: {e}")


def _v6_result(action, ok, error=None, client=None, **extra):
    ui.send_message("v6_result", dict({"action": action, "ok": ok, "error": error}, **extra), client)


# ---------------- MCU → Python ----------------
def _parse_av(payload):
    out = {}
    for part in str(payload or "").split("|"):
        if ":" not in part:
            continue
        name, rest = part.split(":", 1)
        name = name.strip()
        if name not in AV_NAMES:
            continue
        kv = _parse_kv(rest)
        pos = _i(kv.get("pos"))
        out[name] = {"ts": time.time(), "online": kv.get("online") == "1", "id": _i(kv.get("id")),
                     "state": kv.get("state", "unknown"), "target": _i(kv.get("target")),
                     "pos": pos if (pos is not None and pos >= 0) else None, "goal": _i(kv.get("goal")),
                     "moving": kv.get("moving") not in (None, "", "0"), "temp_c": _i(kv.get("temp")),
                     "load": _i(kv.get("load")), "inpos": kv.get("inpos") == "1"}
    return out


def on_avalve_update(payload):
    """MCU every second + on state change: "shell:online=1,id=2,state=sensor,...|feed:...". Bridge callback: no synchronous RPC."""
    d = _parse_av(payload)
    if not d:
        print(f"[avalve] WARNING: on_avalve_update got bad payload: {str(payload)[:100]}")
        return
    rs = raw_session
    if rs is not None:
        rs.write("avalve", [[f"{time.time():.3f}", str(payload)]])
    changed = []
    with _v6_lock:
        for n, v in d.items():
            prev = latest_avalve[n]
            if prev.get("state") != v["state"] or prev.get("online") != v["online"]:
                changed.append((n, prev.get("state"), v["state"], v["online"]))
            v["seen"] = prev.get("seen") or v["online"]
            latest_avalve[n] = v
    for n, a, b, online in changed:
        raw_event("avalve", {"valve": n, "from": a, "to": b, "online": online})
        if a != "unknown":
            print(f"[avalve] {n}: {a} -> {b}{'' if online else ' (offline)'}")
    agg_push_avalve()
    push_avalve_status()


def _apply_trip(msg, source):
    """Pressure protection latched (MCU has already stopped the pumps and released the pinch valve): zero the pump state here so pumps are not turned back on after an MCU reboot."""
    global _valve_last_open_request
    with _v6_lock:
        was = latest_safety["ptrip"]
        latest_safety.update(ptrip=True, msg=msg or latest_safety.get("msg", ""), ts=time.time())
    with _agg_lock:
        _agg_buf["ptrip"] = 1
    if was:
        return
    with _v6_lock:
        latest_safety["count"] = int(latest_safety.get("count") or 0) + 1
    _valve_last_open_request = ("pressure_trip", time.time())
    with _pump_lock:
        pump_state["pwm"] = 0
    with _v6_lock:
        latest_base["feed_pwm"] = 0
    raw_event("pressure_trip", {"msg": msg, "source": source})
    print(f"[safety] !! pressure protection tripped: {msg} -> main pump stopped, pinch valve released (press 'Clear pressure trip' before restarting)")
    push_pump_status()
    push_safety_status()


def on_safety(payload):
    kv = _parse_kv(payload)
    if kv.get("ptrip") == "1":
        _apply_trip(kv.get("msg", ""), "notify")


def safety_base_from_aux(kv):
    """Base pump and pressure protection status delivered by on_aux_raw every second."""
    now = time.time()
    if "bon" in kv:
        with _v6_lock:
            latest_base.update(ts=now, on=kv.get("bon") == "1", pwm=_i(kv.get("bpwm")), left_ms=_i(kv.get("bleft"), 0),
                               hour_ms=_i(kv.get("bhour"), 0), max_h_ms=_i(kv.get("bmaxh")), count=_i(kv.get("bcnt"), 0),
                               why=kv.get("bwhy", ""))
            if "fpwm" in kv:
                latest_base.update(feed_pwm=_i(kv.get("fpwm"), 0), feed_fwd=kv.get("fdir", "1") == "1")
            if "ptest" in kv:
                latest_base.update(pin_test=kv.get("ptest") == "1", rb=kv.get("rb", ""))
    if "ptrip" in kv:
        trip = kv.get("ptrip") == "1"
        with _v6_lock:
            latest_safety.update(limit=_f(kv.get("plim"), latest_safety["limit"]))
            was = latest_safety["ptrip"]
        # MCU ptrip=0 while still latched here = MCU reboot cleared the latch in RAM. Keep it latched here
        # (pumps zeroed, alert stays), cleared only when the user presses "clear pressure protection".
        if trip and not was:
            _apply_trip(latest_safety.get("msg") or "(MCU reported latched)", "aux")
    push_safety_status()


Bridge.provide("on_avalve_update", on_avalve_update)
Bridge.provide("on_safety", on_safety)


# ---------------- Python -> web UI ----------------
def avalve_snapshot():
    with _v6_lock:
        live = {n: dict(latest_avalve[n]) for n in AV_NAMES}
    for n in AV_NAMES:
        live[n]["age_s"] = round(time.time() - live[n]["ts"], 1) if live[n]["ts"] else None
    return {"valves": live, "config": {n: dict(av_config[n], pos=list(av_config[n]["pos"])) for n in AV_NAMES},
            "desired": dict(av_desired), "states": {n: list(AV_STATES[n]) for n in AV_NAMES},
            "degrees": {n: list(AV_DEG[n]) for n in AV_NAMES},
            "controlled_by_ph": ph_doser.episode}


def push_avalve_status(client=None):
    ui.send_message("avalve_update", avalve_snapshot(), client)


def safety_snapshot():
    with _v6_lock:
        s, b = dict(latest_safety), dict(latest_base)
    return {"protect": s, "protect_cfg": dict(pressure_protect_cfg), "base": b, "base_cfg": dict(base_cfg)}


def push_safety_status(client=None):
    ui.send_message("safety_update", safety_snapshot(), client)


def push_ph_ctrl(client=None):
    ui.send_message("ph_ctrl_state", ph_doser.snapshot(time.time()), client)


# ---------------- MCU commands ----------------
def _av_index(name):
    return AV_NAMES.index(name)


def _av_call_set(name, state):
    """Switch the shell valve / feed valve. Returns (ok, error)."""
    if name not in AV_NAMES or state not in AV_STATES[name]:
        return False, "Unknown valve or state"
    try:
        resp = Bridge.call("av_set", f"{_av_index(name)},{AV_STATES[name].index(state)}")
    except Exception as e:
        return False, f"MCU not responding: {e}"
    if _rejected(resp):
        return False, _reject_reason(resp)
    raw_event("avalve_cmd", {"valve": name, "state": state})
    return True, None


def _av_push_config(name):
    c = av_config[name]
    arg = (f"w={_av_index(name)},id={int(c['id'])},p0={int(c['pos'][0])},p1={int(c['pos'][1])},"
           f"p2={int(c['pos'][2])},speed={int(c['speed'])},acc={int(c['acc'])}")
    try:
        resp = Bridge.call("av_set_config", arg)
    except Exception as e:
        return False, f"MCU not responding: {e}"
    if _rejected(resp):
        return False, _reject_reason(resp)
    return True, None


def _ph_ctrl_busy():
    return ph_doser.state in ("valve", "dosing", "settling")


def handle_avalve_set(client, data):
    d = data or {}
    name, state = d.get("which"), d.get("state")
    if name == "feed" and _ph_ctrl_busy():
        _v6_result("avalve_set", False, "Auto pH control is using the feed valve (disable auto pH first)", client)
        return
    ok, err = _av_call_set(name, state)
    if ok:
        av_desired[name] = state
        _pv_save("avalve_desired", dict(av_desired))
    _v6_result("avalve_set", ok, err, client, which=name, state=state)


def handle_avalve_goto_raw(client, data):
    d = data or {}
    name = d.get("which")
    try:
        pos = int(d.get("pos"))
    except (TypeError, ValueError):
        _v6_result("avalve_goto_raw", False, "Position must be an integer 0-4095", client)
        return
    if name not in AV_NAMES:
        return
    if name == "feed" and _ph_ctrl_busy():
        _v6_result("avalve_goto_raw", False, "Auto pH control is using the feed valve", client)
        return
    try:
        resp = Bridge.call("av_goto_raw", f"{_av_index(name)},{pos}")
        ok, err = (not _rejected(resp)), (_reject_reason(resp) if _rejected(resp) else None)
    except Exception as e:
        ok, err = False, str(e)
    _v6_result("avalve_goto_raw", ok, err, client, which=name)


def handle_avalve_torque(client, data):
    d = data or {}
    name = d.get("which")
    if name not in AV_NAMES:
        return
    try:
        resp = Bridge.call("av_torque", f"{_av_index(name)},{1 if d.get('on') else 0}")
        ok, err = (not _rejected(resp)), (_reject_reason(resp) if _rejected(resp) else None)
    except Exception as e:
        ok, err = False, str(e)
    _v6_result("avalve_torque", ok, err, client, which=name)


def handle_avalve_save_position(client, data):
    """Record the servo's current position as the position of a state (used with "torque off and turn by hand" or jog to find the position)."""
    d = data or {}
    name, state = d.get("which"), d.get("state")
    if name not in AV_NAMES or state not in AV_STATES[name]:
        return
    with _v6_lock:
        pos = latest_avalve[name].get("pos")
    if pos is None:
        _v6_result("avalve_save_position", False, "Cannot read current servo position (offline?)", client)
        return
    av_config[name]["pos"][AV_STATES[name].index(state)] = int(pos)
    ok, err = _av_push_config(name)
    if ok:
        _pv_save("avalve_config", {n: dict(av_config[n], pos=list(av_config[n]["pos"])) for n in AV_NAMES})
        raw_event("avalve_config", {"valve": name, "state": state, "pos": pos})
    _v6_result("avalve_save_position", ok, err, client, which=name, state=state, pos=pos)
    push_avalve_status()


def handle_avalve_set_config(client, data):
    d = data or {}
    name = d.get("which")
    if name not in AV_NAMES:
        return
    new = dict(av_config[name], pos=list(av_config[name]["pos"]))
    try:
        if d.get("id") is not None:
            new["id"] = int(d["id"])
        if isinstance(d.get("pos"), list) and len(d["pos"]) == 3:
            new["pos"] = [int(x) for x in d["pos"]]
        for k in ("speed", "acc"):
            if d.get(k) is not None:
                new[k] = int(d[k])
    except (TypeError, ValueError):
        _v6_result("avalve_set_config", False, "Fields must be integers", client)
        return
    if d.get("reset_angles"):
        new["pos"] = list(AV_DEFAULT_CFG[name]["pos"])
    old = av_config[name]
    av_config[name] = new
    ok, err = _av_push_config(name)
    if ok:
        _pv_save("avalve_config", {n: dict(av_config[n], pos=list(av_config[n]["pos"])) for n in AV_NAMES})
        raw_event("avalve_config", {"valve": name, **new})
    else:
        av_config[name] = old
    _v6_result("avalve_set_config", ok, err, client, which=name)
    push_avalve_status()


def handle_servo_set_id(client, data):
    d = data or {}
    try:
        old, new = int(d.get("old")), int(d.get("new"))
        resp = Bridge.call("servo_set_id", f"{old},{new}", timeout=8.0)
        ok, err = (str(resp).startswith("ok")), (None if str(resp).startswith("ok") else _reject_reason(resp))
    except (TypeError, ValueError):
        ok, err = False, "ID must be an integer"
    except Exception as e:
        ok, err = False, str(e)
    print(f"[servo] change ID {d.get('old')} -> {d.get('new')}: {'OK' if ok else 'failed ' + str(err)}")
    _v6_result("servo_set_id", ok, err, client)


def _pp_push():
    try:
        resp = Bridge.call("set_pressure_protect", f"limit={pressure_protect_cfg['limit']:.3f}")
    except Exception as e:
        return False, f"MCU not responding: {e}"
    if _rejected(resp):
        return False, _reject_reason(resp)
    kv = _parse_kv(resp)
    with _v6_lock:
        latest_safety.update(limit=_f(kv.get("limit"), pressure_protect_cfg["limit"]),
                             ptrip=latest_safety["ptrip"] or kv.get("trip") == "1",   # only ever set; clearing requires the user to press
                             count=_i(kv.get("count"), 0), pmax=_f(kv.get("pmax")),
                             msg=kv.get("msg") or latest_safety.get("msg", ""))
    return True, None


def handle_pressure_protect_set(client, data):
    d = data or {}
    lim = _f(d.get("limit"))
    if lim is None or not (0.1 <= lim <= 5.0):
        _v6_result("pressure_protect_set", False, "Pressure limit must be 0.1-5.0 bar", client)
        return
    old = pressure_protect_cfg["limit"]
    pressure_protect_cfg["limit"] = lim
    ok, err = _pp_push()
    if ok:
        _pv_save("pressure_protect", dict(pressure_protect_cfg))
        raw_event("pressure_protect", {"limit": lim})
    else:
        pressure_protect_cfg["limit"] = old
    _v6_result("pressure_protect_set", ok, err, client)
    push_safety_status()


def handle_pressure_trip_clear(client, data):
    try:
        resp = Bridge.call("pressure_trip_clear", "")
    except Exception as e:
        _v6_result("pressure_trip_clear", False, f"MCU not responding: {e}", client)
        return
    if _rejected(resp):
        why = _reject_reason(resp)
        _v6_result("pressure_trip_clear", False,
                   "Pressure still above limit, fix the cause first (tubing, pinch valve, fiber clog)" if "above" in why else why, client)
        return
    with _v6_lock:
        latest_safety.update(ptrip=False, msg="")
    raw_event("pressure_trip_cleared", {"by": "user"})
    print("[safety] pressure protection cleared (main pump stays stopped, press 'Apply' to start)")
    _v6_result("pressure_trip_clear", True, None, client)
    push_safety_status()


def _base_push_cfg():
    try:
        resp = Bridge.call("set_base_config", f"pwm={int(base_cfg['pwm'])},max_s_h={float(base_cfg['max_s_h']):.1f}")
    except Exception as e:
        return False, f"MCU not responding: {e}"
    if _rejected(resp):
        return False, _reject_reason(resp)
    _chb_apply_resp(resp)
    return True, None


def handle_base_config_set(client, data):
    d = data or {}
    pwm, mx = _i(d.get("pwm"), base_cfg["pwm"]), _f(d.get("max_s_h"), base_cfg["max_s_h"])
    if not (1 <= pwm <= 255) or not (0 <= mx <= 600):
        _v6_result("base_config_set", False, "PWM 1-255, hourly limit 0-600 s", client)
        return
    old = dict(base_cfg)
    base_cfg.update(pwm=pwm, max_s_h=mx)
    ok, err = _base_push_cfg()
    if ok:
        _pv_save("base_pump", dict(base_cfg))
        raw_event("base_config", dict(base_cfg))
    else:
        base_cfg.update(old)
    _v6_result("base_config_set", ok, err, client)
    push_safety_status()


def _chb_apply_resp(resp):
    kv = _parse_kv(resp)
    if "ptest" in kv:
        with _v6_lock:
            latest_base.update(pin_test=kv.get("ptest") == "1", rb=kv.get("rb", ""), ts=time.time())


def handle_chb_pin_test(client, data):
    """v6.2.1: wiring check, holds HIGH/LOW on IN3 (D12) / IN4 (D13) / ENB (D11) for a few seconds to measure with a meter."""
    d = data or {}
    a, b, e = (1 if d.get(k) else 0 for k in ("in3", "in4", "enb"))
    ms = _i(d.get("ms"), 10000)
    if a and b and e:
        _v6_result("chb_pin_test", False, "IN3 and IN4 must not both be high with ENB on", client)
        return
    if not (0 <= ms <= 30000):
        _v6_result("chb_pin_test", False, "Time 0-30 s", client)
        return
    if (a or b or e) and _ph_ctrl_busy():
        _v6_result("chb_pin_test", False, "Auto pH control is dosing base", client)
        return
    try:
        resp = Bridge.call("chb_pin_test", f"in3={a},in4={b},enb={e},ms={ms}")
        ok, err = (not _rejected(resp)), (_reject_reason(resp) if _rejected(resp) else None)
        if ok:
            _chb_apply_resp(resp)
    except Exception as ex:
        ok, err = False, f"MCU not responding: {ex}"
    rb = latest_base.get("rb", "")
    raw_event("chb_pin_test", {"in3": a, "in4": b, "enb": e, "ms": ms, "ok": ok, "error": err, "readback": rb})
    print(f"[feed] pin test IN3={a} IN4={b} ENB={e} {ms} ms: {'OK, read back IN3/IN4=' + rb if ok else err}")
    _v6_result("chb_pin_test", ok, err, client)
    push_safety_status()


def _base_pulse(ms, source):
    try:
        resp = Bridge.call("base_pump_pulse", str(int(ms)))
    except Exception as e:
        return False, f"MCU not responding: {e}"
    if _rejected(resp):
        return False, _reject_reason(resp)
    with _agg_lock:
        _agg_buf["base_pulses"] += 1
        _agg_buf["base_ms"] += int(ms)
    raw_event("base_pulse", {"ms": int(ms), "source": source})
    return True, None


def _feed_at_base_now():
    with _v6_lock:
        fv = dict(latest_avalve["feed"])
    return (fv["online"] and fv["state"] == "base" and fv["inpos"] and not fv["moving"]
            and time.time() - (fv["ts"] or 0) < 3)


def handle_base_pump_pulse(client, data):
    """Manual base dosing pulse. v6.2: only while the user has set the feed valve to "base" (the valve is no longer turned automatically)."""
    d = data or {}
    ms = _i(d.get("ms"), 0)
    if _ph_ctrl_busy():
        _v6_result("base_pump_pulse", False, "Auto pH control is dosing base", client)
        return
    if not (100 <= ms <= 10000):
        _v6_result("base_pump_pulse", False, "Time must be 0.1-10 s", client)
        return
    if not _feed_at_base_now():
        _v6_result("base_pump_pulse", False, "Manual dosing only works while the feed valve is set to 'Base'", client)
        return
    if latest_base.get("feed_pwm"):
        _v6_result("base_pump_pulse", False, "Stop the feed pump first", client)
        return
    ok, err = _base_pulse(ms, "manual")
    _ph_dose_log("manual_pulse" if ok else "manual_pulse_rejected", {"ms": ms, "error": err}, latest_ph.get("ph"))
    _v6_result("base_pump_pulse", ok, err, client)
    push_safety_status()


def handle_base_pump_stop(client, data):
    try:
        Bridge.call("base_pump_stop", "")
        ok, err = True, None
    except Exception as e:
        ok, err = False, str(e)
    raw_event("base_stop", {"by": "user"})
    _v6_result("base_pump_stop", ok, err, client)


def _feed_apply_resp(resp):
    kv = _parse_kv(resp)
    if "fpwm" in kv:
        with _v6_lock:
            latest_base.update(feed_pwm=_i(kv.get("fpwm"), 0), feed_fwd=kv.get("fdir", "1") == "1", ts=time.time())


def handle_feed_pump_set(client, data):
    """v6.2: feed pump continuous run. data: {pwm: 0-255}. v6.2.2: single direction (IN4, fw v4.2.2); "forward" is ignored."""
    d = data or {}
    pwm = _i(d.get("pwm"), latest_base.get("feed_pwm") or 0)
    if not (0 <= pwm <= 255):
        _v6_result("feed_pump_set", False, "PWM 0-255", client)
        return
    if pwm > 0 and _ph_ctrl_busy():
        _v6_result("feed_pump_set", False, "Auto pH control is dosing base", client)
        return
    try:
        resp = Bridge.call("set_feed_pump", f"pwm={pwm}")
        ok, err = (not _rejected(resp)), (_reject_reason(resp) if _rejected(resp) else None)
        if ok:
            _feed_apply_resp(resp)
    except Exception as e:
        ok, err = False, f"MCU not responding: {e}"
    raw_event("feed_pump", {"pwm": pwm, "ok": ok, "error": err})
    print(f"[feed] -> MCU set_feed_pump pwm={pwm}: {'OK' if ok else err}")
    _v6_result("feed_pump_set", ok, err, client)
    push_safety_status()


def handle_ph_ctrl_set(client, data):
    d = dict(data or {})
    ok, errs = ph_doser.configure(d)
    if ok:
        _pv_save("ph_ctrl", dict(ph_doser.cfg))
        raw_event("ph_ctrl_config", dict(ph_doser.cfg))
        print(f"[ph_ctrl] settings: " + ", ".join(f"{k}={v}" for k, v in ph_doser.cfg.items()))
    _v6_result("ph_ctrl_set", ok, "; ".join(errs) if errs else None, client)
    push_ph_ctrl()


def handle_ph_ctrl_reset(client, data):
    ok = ph_doser.reset_fault(time.time())
    raw_event("ph_ctrl_reset", None)
    _v6_result("ph_ctrl_reset", ok, None if ok else "No active FAULT", client)
    push_ph_ctrl()


def handle_v6_get(client, data):
    push_avalve_status(client)
    push_safety_status(client)
    push_ph_ctrl(client)


for _n, _h in (("avalve_set", handle_avalve_set), ("avalve_goto_raw", handle_avalve_goto_raw),
               ("avalve_torque", handle_avalve_torque), ("avalve_save_position", handle_avalve_save_position),
               ("avalve_set_config", handle_avalve_set_config), ("servo_set_id", handle_servo_set_id),
               ("pressure_protect_set", handle_pressure_protect_set), ("pressure_trip_clear", handle_pressure_trip_clear),
               ("base_config_set", handle_base_config_set), ("base_pump_pulse", handle_base_pump_pulse),
               ("base_pump_stop", handle_base_pump_stop), ("ph_ctrl_set", handle_ph_ctrl_set),
               ("feed_pump_set", handle_feed_pump_set),
               ("chb_pin_test", handle_chb_pin_test),
               ("ph_ctrl_reset", handle_ph_ctrl_reset), ("v6_get", handle_v6_get)):
    ui.on_message(_n, _h)


# ---------------- Auto pH control loop (every second) ----------------
def _ph_ctrl_exec(actions, now):
    for a in actions:
        if a[0] == "feed_valve":
            ok, err = _av_call_set("feed", a[1])
            if not ok:
                print(f"[ph_ctrl] failed to switch feed valve to {a[1]}: {err}")
        elif a[0] == "pulse":
            ok, err = _base_pulse(a[1], "ph_ctrl")
            _ph_ctrl_exec(ph_doser.on_pulse_result(now, ok, err or ""), now)
        elif a[0] == "event":
            kind, detail = a[1], a[2]
            ph = latest_ph.get("ph")
            raw_event("ph_ctrl_" + kind, detail)
            _ph_dose_log(kind, detail, ph)
            print(f"[ph_ctrl] {kind}: {detail}")


def ph_control_loop():
    while True:
        time.sleep(1.0)
        if not _startup_thread_done:
            continue
        now = time.time()
        snap = _ph_snapshot()
        ph_ok = snap.get("state") == "OK" and not snap.get("stale") and snap.get("ph") is not None
        with _v6_lock:
            fv, base, saf = dict(latest_avalve["feed"]), dict(latest_base), dict(latest_safety)
        feed_fresh = fv["ts"] and now - fv["ts"] < 5.0
        acts = ph_doser.tick(now, snap.get("ph"), ph_ok, fv.get("state"), bool(fv.get("inpos")) and not fv.get("moving"),
                             bool(feed_fresh and fv["online"]), bool(base["on"] and now - base["ts"] < 3.0),
                             bool(saf["ptrip"]), base.get("why", ""),
                             feed_run=bool(base.get("feed_pwm")) and now - base["ts"] < 5.0)
        _ph_ctrl_exec(acts, now)
        _av_restore_tick()
        push_ph_ctrl()


def _av_restore_tick():
    """After MCU reboot / App startup, wait for the servos to come online, then turn the shell valve / feed valve back to the user's last selected state (once only)."""
    for n in list(_av_restore_pending):
        with _v6_lock:
            v = dict(latest_avalve[n])
        if not v["online"] or (n == "feed" and _ph_ctrl_busy()):
            continue
        want = _av_restore_pending.pop(n)
        if v["state"] != want:
            ok, err = _av_call_set(n, want)
            print(f"[avalve] restore {n} -> {want}: {'OK' if ok else 'failed ' + str(err)}")


def v6_restore(reason):
    """App startup / MCU reboot: push pressure protection limit, base pump settings, and both valves' IDs and positions back to the MCU, and schedule valve state restore."""
    ok1, e1 = _pp_push()
    ok2, e2 = _base_push_cfg()
    res = []
    for n in AV_NAMES:
        ok, err = _av_push_config(n)
        res.append(f"{n} {'OK' if ok else err}")
    _av_restore_pending.update({"shell": av_desired.get("shell", "sensor"),
                                "feed": av_desired.get("feed", "closed")})
    if ph_doser.episode or _ph_ctrl_busy():
        _ph_ctrl_exec(ph_doser.abort(time.time(), f"MCU {reason}"), time.time())
    print(f"[v6] restore ({reason}): pressure protection {'OK' if ok1 else e1}, base dosing config {'OK' if ok2 else e2}, valves " + ", ".join(res))
    push_safety_status()
    push_avalve_status()


def v6_system_alerts():
    alerts = []
    with _v6_lock:
        saf = dict(latest_safety)
        avs = {n: dict(latest_avalve[n]) for n in AV_NAMES}
    if saf["ptrip"]:
        alerts.append({"level": "critical", "code": "p_trip", "value": saf.get("msg"),
                       "message": f"Pressure protection tripped ({saf.get('msg')}): main pump stopped, pinch valve released. Fix the cause, then press 'Clear pressure trip'"})
    for n in AV_NAMES:
        v = avs[n]
        if v["seen"] and (not v["online"] or (v["ts"] and time.time() - v["ts"] > 5)):
            alerts.append({"level": "warning", "code": f"avalve_offline_{n}",
                           "message": f"{'Shell sampling valve' if n == 'shell' else 'Feed valve'} servo offline"})
    if avs["shell"]["online"] and avs["shell"]["state"] == "closed":
        alerts.append({"level": "warning", "code": "shell_isolated",
                       "message": "Shell valve fully closed: P_s transducer isolated from shell, TMP-type values do not reflect true transmembrane pressure"})
    snap = _ph_snapshot()
    ph_ok = snap.get("state") == "OK" and not snap.get("stale")
    alerts += ph_doser.alerts(snap.get("ph"), ph_ok)
    return alerts


def agg_push_avalve():
    """On each on_avalve_update: record the final state of both valves in this window (for CSV)."""
    with _v6_lock:
        s, f = latest_avalve["shell"], latest_avalve["feed"]
        ss = s["state"] if s["online"] else "offline"
        fs = f["state"] if f["online"] else "offline"
    with _agg_lock:
        _agg_buf["shell_state"] = ss
        _agg_buf["feed_state"] = fs


def _av_state_now(name):
    with _v6_lock:
        v = latest_avalve[name]
        return (v["state"] if v["online"] else "offline") if v["ts"] else None


# ============================= pH / pinch valve: startup sync, reboot restore, background maintenance =============================


def restore_ph_valve_state(reason="restored"):
    """v5.0: on MCU reboot / App startup push back the settings "the MCU needs to know": pinch valve settings, pressure zero for the safety interlock,
    OD measurement interval and optical path, pump kick boost. pH calibration and algorithms are no longer on the MCU, so no need to push them.
    Returns True if the MCU responded."""
    global valve_config
    with _pv_lock:
        saved = {k: dict(v) for k, v in pv_saved.items()}
    mcu_valve = _valve_read_config_from_mcu()
    if mcu_valve is None:
        return False
    mcu_cfg_refresh()
    push_offsets_to_mcu()
    push_od_config_to_mcu()

    valve_config = mcu_valve
    sv = saved.get("valve_config")
    if sv and not saved.get("feed_limit_v411"):
        if sv.get("feed_limit") is not None and abs(float(sv["feed_limit"]) - 1.0) < 1e-6:
            sv = dict(sv, feed_limit=0.5)
            print("[valve] Lumen in limit updated from old default 1.0 bar to 0.5 bar")
        _pv_save("feed_limit_v411", {"done": True})
    if sv:
        want = {k: sv.get(k) for k in VALVE_CONFIG_KEYS if sv.get(k) is not None}
        if any(abs((want[k] or 0) - (mcu_valve.get(k) or 0)) > 1e-4 for k in want):
            ok, err = _valve_apply_config(want, source=sv.get("source", reason))
            print(f"[valve] restore saved pinch valve settings: {'OK' if ok else 'failed ' + str(err)}")
    else:
        init = {}
        for ck, mk in (("servo_id", "id"), ("tmp_limit_bar", "tmp_limit"),
                       ("feed_limit_bar", "feed_limit"), ("feed_basis", "feed_basis"), ("max_close_s", "max_close_s"),
                       ("torque_limit", "torque_limit"), ("speed", "speed"), ("acc", "acc")):
            if _VALVE_CONST.get(ck) is not None:
                init[mk] = _VALVE_CONST[ck]
        if "tmp_limit" not in init and THRESH.get("tmp_critical_bar") is not None:
            init["tmp_limit"] = THRESH["tmp_critical_bar"]
        if init:
            ok, err = _valve_apply_config(init, source="constants")
            print(f"[valve] apply pinch valve defaults from constants.json: {'OK' if ok else 'failed ' + str(err)}")
        else:
            _pv_save("valve_config", dict(mcu_valve, source="sketch_default"))
    push_ph_config()
    push_valve_config()
    push_alg_settings()
    try:
        pump_kick_restore()
    except Exception as e:
        print(f"[pump] failed to restore start kick settings: {e}")
    try:
        v6_restore(reason)        # v6.0: pressure protection limit, base dosing settings, shell valve / feed valve
    except Exception as e:
        print(f"[v6] restore failed: {e}")
    return True


def ph_valve_startup_sync():
    global _pv_startup_done
    if _pv_startup_done:
        return True
    if restore_ph_valve_state(reason="restored"):
        _pv_startup_done = True
        return True
    print("[ph/valve] cannot read pH/pinch valve state from MCU yet (Bridge may not be ready), retrying later")
    return False


def ph_valve_housekeeping():
    """Called by od600_poll_loop every 5 seconds: retry startup sync (when the MCU could not be read)."""
    if not _pv_startup_done:
        ph_valve_startup_sync()


def ph_valve_system_alerts():
    """System alerts (pH / pinch valve) for derive_loop. message is a Chinese fallback string; the frontend builds bilingual text from code."""
    alerts = []
    ph = _ph_snapshot()
    if ph["ts"] and ph["stale"]:
        alerts.append({"level": "warning", "code": "ph_stale",
                       "message": "No pH data for over 10 s"})
    elif ph["ts"] and ph["state"] == "PROBE_ERROR":
        alerts.append({"level": "warning", "code": "ph_probe_error", "value": ph["ph"],
                       "message": "pH reading out of range (2-12), check probe, wiring or calibration"})
    with _valve_lock:
        v = dict(latest_valve)
    if v["ts"]:
        if v["fault"]:
            alerts.append({"level": "critical", "code": "valve_fault", "value": v["msg"],
                           "message": f"Pinch valve FAULT: {v['msg']} (auto-released; check, then press 'Clear')"})
        elif not v["online"] and not v.get("scanning"):
            alerts.append({"level": "warning", "code": "valve_offline",
                           "message": "Pinch valve servo offline (use auto scan in 'Valve setup' to find it)"})
        if v["cmd"] in ("closed", "jog"):
            alerts.append({"level": "warning", "code": "valve_closed", "value": v["closed_s"],
                           "message": f"Pinch valve closed ({v['closed_s']:.0f} s), fouling trend alerts paused"})
    alerts += od_gate_alerts()                      # v5.1: OD600 gate layer
    alerts += v6_system_alerts()                    # v6.0: pressure protection / new valves / auto pH
    return alerts


def on_client_connect(sid):
    """When a new web client connects, resend the current state once so the screen is not empty / wrong.
    Each step has its own try/except: an error in any step must not prevent the other steps from being sent."""
    for label, fn in (
        ("pressure_update", lambda: ui.send_message("pressure_update", latest_pressure, sid)),
        ("pump_status", lambda: push_pump_status(sid)),
        ("od600_update", lambda: _od_snapshot(sid)),
        ("od600_blank", lambda: push_od_blank(sid)),
        ("od_gate_state", lambda: push_od_gate(sid)),
        ("raw_status", lambda: refresh_disk_status(sid)),
        ("od600_dev_status", lambda: ui.send_message("od600_dev_status", {"dev_mode": od600_dev_mode}, sid)),
        ("od600_settings", lambda: handle_od_get_settings(sid, None)),
        ("aggregate_settings", lambda: push_agg_settings(sid)),
        # Resend the most recent aggregate result, but marked stale=True: it is an old value from the "previous window", not
        # freshly computed for this browser. The frontend uses stale data only as a placeholder; cards keep following the 5 Hz
        # instantaneous values and charts do not plot the point until the first window that truly belongs to this connection ends -
        # otherwise the user would see a frozen set of numbers right after connecting and think the system had hung.
        ("aggregate_update", lambda: latest_aggregate and ui.send_message(
            "aggregate_update", dict(latest_aggregate, stale=True), sid)),
        ("record_status", lambda: push_record_status_snapshot(sid)),
        ("chart_history", lambda: push_chart_history(sid)),
        ("calibration_state", lambda: push_calibration_state(sid)),
        ("alg_settings", lambda: push_alg_settings(sid)),
        ("backend_info", lambda: ui.send_message("backend_info", {"version": BACKEND_VERSION}, sid)),
        ("hfm_state", lambda: push_hfm_state(sid)),
        ("specs_state", lambda: push_specs_state(sid)),
        ("dpq_state", lambda: push_dpq_state(sid)),
        ("mcu_link", lambda: ui.send_message("mcu_link", dict(mcu_link, expected_fw=EXPECTED_FW), sid)),
        ("ph_update", lambda: push_ph_status(sid)),
        ("ph_config", lambda: push_ph_config(sid)),
        ("valve_update", lambda: push_valve_status(sid)),
        ("valve_config", lambda: push_valve_config(sid)),
        ("pump_kick", lambda: push_pump_kick(sid)),
        ("mcu_status", lambda: push_mcu_status(sid)),
        ("valve_events_list", lambda: handle_valve_list_events(sid, None)),
        ("avalve_update", lambda: push_avalve_status(sid)),        # v6.0
        ("safety_update", lambda: push_safety_status(sid)),
        ("ph_ctrl_state", lambda: push_ph_ctrl(sid)),
    ):
        try:
            fn()
        except Exception as e:
            print(f"[on_client_connect] {label} send failed: {e}")


ui.on_connect(on_client_connect)


# ============================= HFM derived parameters (v4, per HFM_bioreactor_UI_spec.md) =============================
# Channel mapping: feed = P_in (lumen inlet at module bottom), retentate = P_out (lumen outlet at module top),
#           permeate = P_s (shell sampling luer, same height as P_out), flow meter = Q_L (lumen recirculation).
# Pressures are always bar internally; all outputs of this section are kPa (the pressure differences here are only a few kPa, invisible in bar).
_HFM_DEFAULTS = {
    "membrane_area_cm2": 200.0, "n_eff": 11, "fiber_id_cm": 0.1, "fiber_length_cm": 60.0,
    "shell_id_cm": 1.0, "v_lumen_ml": 5.2, "v_shell_ml": 36.0, "v_culture_l": 1.0,
    "rho_gh_kpa_default": 5.9, "mu_cp": 0.7, "fluid_density_kg_m3": 1000.0,
    "mu_from_temp": 1, "mu_water_factor": 1.0,
    "dp_q_a_kpa_per_mlmin": 0.02615, "dp_q_b_kpa_per_mlmin2": 0.0,
    "gamma_target_s1": 2000.0, "gamma_max_s1": 11000.0, "design_j_lmh": 2.0, "design_d_h": 0.04,
    "alarm_dp_ratio": 1.3, "alarm_gamma_ratio": 1.3, "alarm_lp_fraction": 0.7,
    "alarm_ps_rise_kpa": 2.0, "q_min_for_ratio_mlmin": 10.0, "tmp_out_min_window_s": 3.0,
    "alarm_tmp_out_excess_kpa": 3.0, "re_laminar_limit": 2000.0,
    "selftest_settle_s": 10.0, "selftest_record_s": 30.0, "selftest_max_s": 180.0,
    "selftest_plateau_kpa_per_min": 0.15, "selftest_diff_warn_fraction": 0.10,
}
HFM = dict(_HFM_DEFAULTS)
HFM.update({k: v for k, v in (CONST.get("hfm") or {}).items() if not str(k).startswith("_")})
HFM_FILE_DEFAULTS = dict(HFM)      # "Restore defaults" = the constants.json values (before spec-management overrides)

# ---- Spec management (v4.1): specs the user can edit in the web UI; overrides stored under "specs" in ph_valve_state.json ----
# (key, min, max, group). The group is only used for frontend layout.
SPEC_FIELDS = (
    ("n_eff", 1, 10000, "geometry"), ("fiber_id_cm", 0.005, 5, "geometry"),
    ("fiber_length_cm", 1, 500, "geometry"), ("membrane_area_cm2", 1, 1e6, "geometry"),
    ("shell_id_cm", 0.1, 50, "geometry"),
    ("v_lumen_ml", 0.01, 1e4, "volume"), ("v_shell_ml", 0.01, 1e4, "volume"), ("v_culture_l", 0.01, 1e3, "volume"),
    ("mu_cp", 0.1, 100, "fluid"), ("fluid_density_kg_m3", 500, 2000, "fluid"), ("rho_gh_kpa_default", -20, 20, "fluid"),
    ("mu_from_temp", 0, 1, "fluid"), ("mu_water_factor", 0.5, 20, "fluid"),
    ("gamma_target_s1", 10, 1e5, "operating"), ("gamma_max_s1", 10, 1e5, "operating"),
    ("design_j_lmh", 0.01, 1000, "operating"), ("design_d_h", 0.0001, 10, "operating"),
    ("alarm_dp_ratio", 1.0, 10, "alarm"), ("alarm_gamma_ratio", 1.0, 10, "alarm"),
    ("alarm_lp_fraction", 0.05, 1.0, "alarm"), ("alarm_ps_rise_kpa", 0.1, 100, "alarm"),
    ("q_min_for_ratio_mlmin", 0, 1000, "alarm"), ("tmp_out_min_window_s", 0.5, 60, "alarm"),
    ("alarm_tmp_out_excess_kpa", 0.1, 100, "alarm"), ("re_laminar_limit", 100, 1e5, "alarm"),
    ("selftest_settle_s", 1, 600, "selftest"), ("selftest_record_s", 5, 600, "selftest"),
    ("selftest_max_s", 10, 3600, "selftest"), ("selftest_plateau_kpa_per_min", 0.001, 10, "selftest"),
    ("selftest_diff_warn_fraction", 0.01, 1, "selftest"),
)
SPEC_KEYS = tuple(f[0] for f in SPEC_FIELDS)
spec_overrides = {}


def _spec_validate(values):
    out, errs = {}, []
    ranges = {f[0]: (f[1], f[2]) for f in SPEC_FIELDS}
    for k, v in (values or {}).items():
        if k not in ranges or v in (None, ""):
            continue
        try:
            x = float(v)
        except (TypeError, ValueError):
            errs.append(f"{k}: not a number"); continue
        lo, hi = ranges[k]
        if not (lo <= x <= hi) or x != x:
            errs.append(f"{k}: must be within {lo} ~ {hi}"); continue
        out[k] = int(round(x)) if k in ("n_eff", "mu_from_temp") else x
    gt = out.get("gamma_target_s1", HFM["gamma_target_s1"])
    gm = out.get("gamma_max_s1", HFM["gamma_max_s1"])
    if gt >= gm:
        errs.append("gamma_target_s1 must be less than gamma_max_s1")
    return out, errs


def specs_apply(overrides, save=True):
    global spec_overrides
    spec_overrides = {k: v for k, v in overrides.items() if k in SPEC_KEYS}
    HFM.clear(); HFM.update(HFM_FILE_DEFAULTS); HFM.update(spec_overrides)
    if save:
        _pv_save("specs", dict(spec_overrides))


def push_specs_state(client=None, ok=True, error=None, action=None):
    payload = {"ok": ok, "error": error, "action": action,
               "values": {k: HFM[k] for k in SPEC_KEYS},
               "defaults": {k: HFM_FILE_DEFAULTS[k] for k in SPEC_KEYS},
               "overridden": sorted(spec_overrides),
               "fields": [{"key": f[0], "min": f[1], "max": f[2], "group": f[3]} for f in SPEC_FIELDS]}
    if client:
        ui.send_message("specs_state", payload, client)
    else:
        ui.send_message("specs_state", payload)


def handle_specs_get(client, data):
    push_specs_state(client)


def handle_specs_set(client, data):
    vals, errs = _spec_validate((data or {}).get("values"))
    if errs:
        push_specs_state(client, ok=False, error="; ".join(errs), action="set")
        return
    merged = dict(spec_overrides)
    for k, v in vals.items():
        if abs(float(v) - float(HFM_FILE_DEFAULTS[k])) < 1e-12:
            merged.pop(k, None)        # Same as default -> no need to store as an override
        else:
            merged[k] = v
    specs_apply(merged)
    print(f"[specs] specs updated: {vals}")
    push_specs_state(None, ok=True, action="set")
    push_hfm_state()


def handle_specs_reset(client, data):
    specs_apply({})
    print("[specs] specs reset to constants.json defaults")
    push_specs_state(None, ok=True, action="reset")
    push_hfm_state()


ui.on_message("specs_get", handle_specs_get)
ui.on_message("specs_set", handle_specs_set)
ui.on_message("specs_reset", handle_specs_reset)

_hfm_lock = threading.Lock()
# Adjustable/persisted state (stored under the "hfm" entry in ph_valve_state.json)
hfm_state = {
    "rho_gh_kpa": float(HFM["rho_gh_kpa_default"]), "rho_gh_source": "default", "rho_gh_at": None,
    "ps_ref_kpa": None,                      # P_s during self-test (pump stopped, vented to atmosphere); reference for "P_s rising for no reason"
    "dp_a": float(HFM["dp_q_a_kpa_per_mlmin"]), "dp_b": float(HFM["dp_q_b_kpa_per_mlmin2"]),
    "dp_source": "default", "dp_at": None,
    # No electronic scale yet. v5.1: preferably enter "collected volume + elapsed time" (q_perm_source="volume"); the program converts it to
    # the period-average Q_perm; an instantaneous value can also be entered directly (source="manual"). Leaving it empty is fine too -- J / L_p / D / R_t /
    # τ_shell stay empty, and fouling monitoring still has ΔP_ratio and γ_ratio.
    "q_perm_mlmin": None, "q_perm_source": None,
    "q_perm_volume_ml": None, "q_perm_minutes": None,
    "lp_initial": None, "lp_initial_at": None,
    "q_l_mode": "meter", "q_l_manual": None,  # v4.7: Q_L source (flow meter / manual input)
    "dp_points": None, "dp_fit": None,       # v4.6: ΔP-Q sweep measurement points and fit result (exportable/importable)
}
_HFM_SAVE_KEYS = tuple(hfm_state.keys())
# Last few seconds of P_out trough - P_s (strict TMP_out, spanning several peristaltic pump cycles)
_hfm_trough_buf = deque()     # (monotonic_t, kPa)


def water_viscosity_mpas(t_c):
    """Pure-water viscosity (Vogel equation, error < 1% over 0-100 °C): 20 °C 1.00, 25 °C 0.89, 37 °C 0.69 mPa·s."""
    return 0.02939 * math.exp(507.88 / (t_c + 273.15 - 149.3))


def current_mu_cp():
    """v5.0: when spec mu_from_temp = 1 and the DS18B20 has a reading, μ = water viscosity at that temperature × mu_water_factor
    (medium relative to water, default 1.0); otherwise use the fixed mu_cp. Returns (μ cP, source)."""
    if int(HFM.get("mu_from_temp", 0)) == 1 and latest_temp.get("valid") and latest_temp.get("temp_c") is not None:
        return water_viscosity_mpas(latest_temp["temp_c"]) * float(HFM.get("mu_water_factor", 1.0)), "temp"
    return float(HFM["mu_cp"]), "fixed"


def _hfm_geom():
    d = HFM["fiber_id_cm"] / 100.0          # m
    L = HFM["fiber_length_cm"] / 100.0      # m
    n = float(HFM["n_eff"])
    mu = current_mu_cp()[0] / 1000.0        # Pa·s
    area_flow = n * math.pi * d * d / 4.0   # m² (total cross-sectional area of all fibers)
    return d, L, n, mu, area_flow


def hfm_track_pressure(snapshot):
    """Called from on_pressure_update (5 Hz): records instantaneous P_out trough - P_s for strict TMP_out. Also feeds the self-test."""
    now = time.monotonic()
    c = snapshot["channels"]
    v = snapshot.get("tmp_out_inst_min_kpa")          # v5.0: minimum of P_out - P_s at the same instant
    if v is None:
        v = (c["retentate"]["trough"] - c["permeate"]["mean_raw"]) * 100.0
    with _hfm_lock:
        _hfm_trough_buf.append((now, v))
        while _hfm_trough_buf and now - _hfm_trough_buf[0][0] > HFM["tmp_out_min_window_s"]:
            _hfm_trough_buf.popleft()
    _selftest_feed(now, c)
    _dpq_feed(now, c)


def hfm_tmp_out_min_kpa():
    with _hfm_lock:
        return min(v for _, v in _hfm_trough_buf) if _hfm_trough_buf else None


def compute_hfm(p_in_bar, p_out_bar, p_s_bar, q_l, tmp_out_min_kpa=None, st=None):
    """All derived parameters of spec §4/§6. Items with missing data return None; never raises."""
    if st is None:
        with _hfm_lock:
            st = dict(hfm_state)
    if p_in_bar is None or p_out_bar is None or p_s_bar is None:
        return {}
    q = q_l if (q_l is not None and q_l > 0) else 0.0
    q_src = "meter"
    if st.get("q_l_mode") == "manual" and st.get("q_l_manual"):   # v4.7: manual Q_L replaces the flow meter
        q, q_src = float(st["q_l_manual"]), "manual"
    d, L, n, mu, area_flow = _hfm_geom()
    rho = st["rho_gh_kpa"]
    p_in, p_out, p_s = p_in_bar * 100.0, p_out_bar * 100.0, p_s_bar * 100.0

    dp_total = p_in - p_out
    dpf = dp_total - rho                                   # §4.2 friction pressure drop with gravity removed
    tmp_out = p_out - p_s                                  # §4.1
    # v5.0: mean TMP = (TMP_in + TMP_out)/2. v4.x failed to subtract ρgh/2 (the shell is also full of liquid; bottom shell pressure = P_s + ρgh)
    tmp_mean = (p_in + p_out) / 2.0 - p_s - rho / 2.0
    tmp_in = p_in - (p_s + rho)
    qmin = HFM["q_min_for_ratio_mlmin"]

    dp_base = st["dp_a"] * q + st["dp_b"] * q * q if q >= qmin else None
    dp_ratio = (dpf / dp_base) if (dp_base and dp_base > 1e-6) else None

    tau_w = dpf * 1000.0 * d / (4.0 * L)                   # Pa  (= dP[Pa] × 4.17e-4)
    gamma_p = tau_w / mu                                   # s⁻¹ §4.3
    v = (q * 1e-6 / 60.0) / area_flow                      # m/s, mean velocity per fiber
    gamma_f = 8.0 * v / d                                  # s⁻¹ (= Q × 15.4)
    gamma_ratio = (gamma_p / gamma_f) if (q >= qmin and gamma_f > 1e-6) else None
    re = HFM["fluid_density_kg_m3"] * v * d / mu
    nonuni = (dpf / tmp_mean) if abs(tmp_mean) > 0.05 else None
    # v5.1: in a closed system (zero net flux) the fiber-averaged TMP is 0, so the "expected value" of TMP_out = -ΔP_friction/2.
    # A measured value much more negative than this -> shell-side pressure is too high (collection line blocked or gas trapped in the shell); that is the diagnostic to watch while closed.
    tmp_out_expected = -dpf / 2.0
    tmp_out_excess = tmp_out - tmp_out_expected

    qp = st.get("q_perm_mlmin")
    j = lp = d_act = rt = tau_shell = lp_frac = None
    if qp is not None and qp > 0:
        area_m2 = HFM["membrane_area_cm2"] / 1e4
        j = (qp * 60.0 / 1000.0) / area_m2                 # LMH
        d_act = (qp * 60.0 / 1000.0) / HFM["v_culture_l"]  # h⁻¹
        tau_shell = HFM["v_shell_ml"] / qp                 # min
        if tmp_mean > 0.1:                                 # kPa; ratio is meaningless when this is too small
            lp = j / (tmp_mean / 100.0)                    # LMH/bar
            rt = (tmp_mean * 1000.0) / (mu * (j / 1000.0 / 3600.0))   # 1/m
            if st.get("lp_initial"):
                lp_frac = lp / st["lp_initial"]

    r = lambda x, k: round(x, k) if x is not None else None
    return {
        "p_in_kpa": r(p_in, 3), "p_out_kpa": r(p_out, 3), "ps_kpa": r(p_s, 3), "q_l_mlmin": r(q, 2), "q_l_src": q_src,
        "rho_gh_kpa": r(rho, 3), "dp_total_kpa": r(dp_total, 3), "dp_friction_kpa": r(dpf, 3),
        "dp_base_kpa": r(dp_base, 3), "dp_ratio": r(dp_ratio, 3),
        "tmp_out_kpa": r(tmp_out, 3), "tmp_out_min_kpa": r(tmp_out_min_kpa, 3),
        "tmp_out_expected_kpa": r(tmp_out_expected, 3), "tmp_out_excess_kpa": r(tmp_out_excess, 3),
        "tmp_mean_kpa": r(tmp_mean, 3), "tmp_in_kpa": r(tmp_in, 3), "tmp_nonuniformity": r(nonuni, 3),
        "tau_w_pa": r(tau_w, 3), "gamma_pressure_s1": r(gamma_p, 0), "gamma_flow_s1": r(gamma_f, 0),
        "gamma_ratio": r(gamma_ratio, 3), "re": r(re, 0),
        "q_perm_mlmin": r(qp, 3), "j_lmh": r(j, 3), "lp_lmh_bar": r(lp, 2), "lp_fraction": r(lp_frac, 3),
        "d_actual_h": r(d_act, 4), "rt_m1": (float("%.3e" % rt) if rt is not None else None),
        "tau_shell_min": r(tau_shell, 1),
        "mu_cp_used": r(mu * 1000.0, 4), "mu_source": current_mu_cp()[1],
        # Compatibility: the two quantities originally used by steady/trend/CSV
        "delta_p_bar": r(p_in_bar - p_out_bar, 5), "tmp_bar": r(tmp_mean / 100.0, 5),
    }


def permeate_path_open():
    """Whether the permeate (shell) side is open to the outside.

    v5.1: only when the pinch valve clamps the retentate is TMP pushed up and permeate actually flows out; only then does the shell side have a path "to the outside".
    During closed culture the net flux is zero, so the fiber-averaged TMP necessarily tends to 0, and thus TMP_out ≈ -ΔP_friction/2 is always negative --
    this is an inevitable result of a closed system, not a backflow fault, so the backflow alert is only evaluated when this function returns True.
    """
    with _valve_lock:
        v = dict(latest_valve)
    if v.get("cmd") in ("closed", "jog"):
        return True
    with _v6_lock:                                  # v6.0: shell sampling valve fully open = shell side connected to the collection bottle
        if latest_avalve["shell"]["online"] and latest_avalve["shell"]["state"] == "collect":
            return True
    qp = st_q = None
    with _hfm_lock:
        st_q = hfm_state.get("q_perm_mlmin")
    qp = st_q
    return bool(qp and qp > 0)        # A declared Q_perm (actually collecting liquid) also counts as open


def compute_hfm_alerts(h, st, pulsation=None, perm_open=None):
    """Spec §7 alert list + absolute membrane pressure limit (collapse) protection + v5.0 restored TMP instantaneous peak/trough alerts.
    pulsation = latest_pressure["tmp"] (TMP peak/trough computed at the same instant within the last 1 s window, bar, ρgh/2 not subtracted)."""
    alerts = []
    if not h:
        return alerts
    if pulsation:
        lim = THRESH.get("tmp_critical_bar", 0.5)
        pk = pulsation.get("peak")
        if pk is not None and pk > lim:     # Peak not corrected by ρgh/2: conservative side for collapse protection
            alerts.append({"level": "critical", "code": "tmp_peak_critical", "value": round(pk, 4),
                           "message": f"TMP instantaneous peak {pk:.3f} bar exceeds absolute limit {lim} bar (collapse risk)"})
        tr = pulsation.get("trough")
        trough_thr = THRESH.get("tmp_trough_negative_bar", -0.02)
        rho_bar = (st.get("rho_gh_kpa") or 0.0) / 100.0
        if tr is not None and tr - rho_bar / 2.0 < trough_thr:   # Trough corrected by ρgh/2: conservative side for backflow detection
            alerts.append({"level": "warning", "code": "tmp_trough_negative", "value": round(tr - rho_bar / 2.0, 4),
                           "message": f"TMP instantaneous trough {tr - rho_bar / 2.0:.3f} bar below {trough_thr} bar: went negative during pulsation"})
    # v5.1: backflow alert is evaluated only when the permeate path is open to the outside. During closed culture net flux is zero -> mean TMP necessarily tends to 0
    # -> TMP_out ≈ -ΔP_friction/2 is always negative; that is the inevitable result of Starling flow (filtration in the inlet half, return flow in the outlet half),
    # the same liquid recirculates within the module, harmless. Only when the pinch valve drives collection (or Q_perm is declared) does reverse filtration at the outlet really
    # carry material from the collection side back into the lumen.
    tmp_out = h.get("tmp_out_kpa")
    if perm_open is None:
        perm_open = permeate_path_open()
    if perm_open:
        if tmp_out is not None and tmp_out <= 0:
            alerts.append({"level": "critical", "code": "tmp_out_nonpositive",
                           "message": f"TMP_out = {tmp_out:.2f} kPa <= 0: backflow risk during collection, check sampling valve/collection bottle tubing now"})
        tmin = h.get("tmp_out_min_kpa")
        if tmin is not None and tmin <= 0 and not (tmp_out is not None and tmp_out <= 0):
            alerts.append({"level": "critical", "code": "tmp_out_min_nonpositive",
                           "message": f"P_out trough - P_s = {tmin:.2f} kPa <= 0: pump pulsation reaches backflow during collection"})
    else:
        # While closed, look instead at "how much more negative than expected": abnormally high shell-side pressure is the real problem
        exc = h.get("tmp_out_excess_kpa")
        lim = HFM.get("alarm_tmp_out_excess_kpa", 3.0)
        if exc is not None and exc < -lim:
            alerts.append({"level": "warning", "code": "tmp_out_shell_high",
                           "message": (f"TMP_out is below the closed-system expected {h.get('tmp_out_expected_kpa'):.2f} kPa "
                                       f"by {-exc:.2f} kPa: shell-side pressure high, check for blocked collection line or trapped air in shell")})
    # v5.1: γ_flow = 8v/d and τ_w both assume laminar flow; above Re 2000 these derived parameters themselves are unreliable
    re = h.get("re")
    if re is not None and re > HFM.get("re_laminar_limit", 2000.0):
        alerts.append({"level": "warning", "code": "re_turbulent",
                       "message": (f"Re = {re:.0f} exceeds {HFM.get('re_laminar_limit', 2000.0):.0f}: "
                                   f"not laminar, γ_flow/τ_w/γ_ratio calculations invalid (reduce Q_L)")})
    dr = h.get("dp_ratio")
    if dr is not None and dr > HFM["alarm_dp_ratio"]:
        alerts.append({"level": "warning", "code": "dp_ratio_high",
                       "message": f"ΔP_friction is {dr:.2f}x baseline (> {HFM['alarm_dp_ratio']}): possible fiber clogging"})
    gr = h.get("gamma_ratio")
    if gr is not None and gr > HFM["alarm_gamma_ratio"]:
        alerts.append({"level": "warning", "code": "gamma_ratio_high",
                       "message": f"γ_ratio = {gr:.2f} (> {HFM['alarm_gamma_ratio']}): fewer effective fibers, clogging warning"})
    lf = h.get("lp_fraction")
    if lf is not None and lf < HFM["alarm_lp_fraction"]:
        alerts.append({"level": "warning", "code": "lp_low",
                       "message": f"L_p dropped to {lf*100:.0f}% of initial (< {HFM['alarm_lp_fraction']*100:.0f}%): fouling or membrane fault (should be very slow at low flux)"})
    ps, ps_ref = h.get("ps_kpa"), st.get("ps_ref_kpa")
    if ps is not None and ps_ref is not None and ps - ps_ref > HFM["alarm_ps_rise_kpa"]:
        alerts.append({"level": "warning", "code": "ps_rise",
                       "message": f"P_s is {ps-ps_ref:.2f} kPa above self-test value: collection drain may be blocked"})
    # Kept: absolute pressure limit of membrane/module (same threshold as the pinch valve MCU-side interlock)
    tmp_bar = h.get("tmp_bar")
    lim = THRESH.get("tmp_critical_bar", 0.5)
    if tmp_bar is not None and tmp_bar > lim:
        alerts.append({"level": "critical", "code": "tmp_critical",
                       "message": f"TMP_mean {tmp_bar*100:.1f} kPa exceeds absolute limit {lim*100:.0f} kPa"})
    return alerts


# ---- State persistence / push / settings ----
def _hfm_save():
    with _hfm_lock:
        snap = {k: hfm_state[k] for k in _HFM_SAVE_KEYS}
    _pv_save("hfm", snap)


def hfm_load_saved(saved):
    if not saved:
        return
    with _hfm_lock:
        for k in _HFM_SAVE_KEYS:
            if k in saved:
                hfm_state[k] = saved[k]
    print(f"[hfm] loaded saved state: ρgh={hfm_state['rho_gh_kpa']} kPa ({hfm_state['rho_gh_source']}), "
          f"ΔP-Q a={hfm_state['dp_a']} b={hfm_state['dp_b']}, Q_perm={hfm_state['q_perm_mlmin']}")


def push_hfm_state(client=None, ok=True, error=None, action=None):
    with _hfm_lock:
        st = dict(hfm_state)
    payload = {"ok": ok, "error": error, "action": action, "state": st,
               "selftest": dict(_selftest),
               "constants": dict({k: HFM[k] for k in _HFM_DEFAULTS},
                                 tmp_abs_limit_kpa=THRESH.get("tmp_critical_bar", 0.5) * 100.0)}
    if client:
        ui.send_message("hfm_state", payload, client)
    else:
        ui.send_message("hfm_state", payload)


def handle_hfm_get_state(client, data):
    push_hfm_state(client)


def handle_hfm_set(client, data):
    """Manual settings: rho_gh_kpa / dp_a / dp_b / q_perm_mlmin (null = clear) / reset_lp_initial."""
    d = data or {}
    err = None
    changed = []
    with _hfm_lock:
        try:
            if d.get("rho_gh_kpa") not in (None, ""):
                v = float(d["rho_gh_kpa"])
                if not (-20.0 <= v <= 20.0):
                    raise ValueError("ρgh must be within -20 ~ 20 kPa")
                hfm_state.update(rho_gh_kpa=v, rho_gh_source="manual", rho_gh_at=time.time()); changed.append("rho_gh")
            if d.get("dp_a") not in (None, "") or d.get("dp_b") not in (None, ""):
                a = float(d["dp_a"]) if d.get("dp_a") not in (None, "") else hfm_state["dp_a"]
                b = float(d["dp_b"]) if d.get("dp_b") not in (None, "") else hfm_state["dp_b"]
                if a < 0 or b < 0 or (a == 0 and b == 0):
                    raise ValueError("ΔP-Q coefficients must be >= 0 and not both 0")
                hfm_state.update(dp_a=a, dp_b=b, dp_source="manual", dp_at=time.time()); changed.append("dp_q")
            # v5.1: collected volume / elapsed time. How much is in the bottle and how long it took are hard facts; guessing an instantaneous mL/min is not;
            # and the result is the average over the whole period, which is exactly the resolution the L_p fouling trend needs (instantaneous L_p is too noisy at very low flux).
            # Once an electronic scale is installed, the formula is the same (volume delta / time delta); no architecture change needed.
            if d.get("q_perm_volume_ml") not in (None, "") and d.get("q_perm_minutes") not in (None, ""):
                vol = float(d["q_perm_volume_ml"])
                mins = float(d["q_perm_minutes"])
                if vol < 0:
                    raise ValueError("Collected volume cannot be negative")
                if not (0 < mins <= 100000):
                    raise ValueError("Elapsed time must be > 0 min")
                q = vol / mins
                if not (0 <= q < 100):
                    raise ValueError("Computed Q_perm is outside 0-100 mL/min")
                hfm_state.update(q_perm_mlmin=(q if q > 0 else None),
                                 q_perm_source=("volume" if q > 0 else None),
                                 q_perm_volume_ml=vol, q_perm_minutes=mins,
                                 lp_initial=None, lp_initial_at=None)
                changed.append("q_perm")
            elif "q_perm_mlmin" in d:
                q = d["q_perm_mlmin"]
                if q in (None, ""):
                    hfm_state.update(q_perm_mlmin=None, q_perm_source=None,
                                     q_perm_volume_ml=None, q_perm_minutes=None)
                else:
                    q = float(q)
                    if not (0 < q < 100):
                        raise ValueError("Q_perm must be within 0-100 mL/min")
                    hfm_state.update(q_perm_mlmin=q, q_perm_source="manual",
                                     q_perm_volume_ml=None, q_perm_minutes=None)
                # v5.0: Q_perm changed, so the L_p baseline is no longer comparable -> recapture it (at the next steady state)
                hfm_state.update(lp_initial=None, lp_initial_at=None)
                changed.append("q_perm")
            if "q_l_manual" in d:                    # v4.7
                q = d["q_l_manual"]
                if q in (None, ""):
                    hfm_state.update(q_l_manual=None)
                else:
                    q = float(q)
                    if not (0 < q <= MAX_FLOW_MLMIN):
                        raise ValueError(f"Manual Q_L must be within 0-{MAX_FLOW_MLMIN} mL/min")
                    hfm_state.update(q_l_manual=q)
                changed.append("q_l_manual")
            if d.get("q_l_mode") not in (None, ""):
                if d["q_l_mode"] not in ("meter", "manual"):
                    raise ValueError("q_l_mode must be meter or manual")
                if d["q_l_mode"] == "manual" and not hfm_state.get("q_l_manual"):
                    raise ValueError("Enter manual Q_L first")
                hfm_state.update(q_l_mode=d["q_l_mode"]); changed.append("q_l_mode")
            if d.get("reset_lp_initial"):
                hfm_state.update(lp_initial=None, lp_initial_at=None); changed.append("lp_initial")
        except (TypeError, ValueError) as e:
            err = str(e)
    act = "hin" if d.get("_from") == "hin" else "set"
    if err:
        push_hfm_state(client, ok=False, error=err, action=act)
        return
    _hfm_save()
    raw_event("hfm_set", {k: d.get(k) for k in d if not str(k).startswith("_")})
    print(f"[hfm] settings updated: {', '.join(changed) or '(none)'}")
    push_hfm_state(None, ok=True, action=act)


def handle_hfm_dp_baseline_from_now(client, data):
    """Set the current state as baseline: scale the ΔP-Q curve proportionally so the current ΔP_friction ratio = 1."""
    h = dict(_last_derived)
    with _hfm_lock:
        a, b = hfm_state["dp_a"], hfm_state["dp_b"]
    q, dpf = h.get("q_l_mlmin"), h.get("dp_friction_kpa")
    if q is None or q < HFM["q_min_for_ratio_mlmin"] or dpf is None or dpf <= 0:
        push_hfm_state(client, ok=False, action="dp_from_now",
                       error=f"Requires pump running (Q_L >= {HFM['q_min_for_ratio_mlmin']:.0f} mL/min) and ΔP_friction > 0")
        return
    base = a * q + b * q * q
    if base <= 0:
        a, b, base = 1.0, 0.0, q
    f = dpf / base
    with _hfm_lock:
        hfm_state.update(dp_a=a * f, dp_b=b * f, dp_source="measured", dp_at=time.time())
    _hfm_save()
    raw_event("dp_q_baseline_from_now", {"q": q, "dpf": dpf, "scale": f})
    print(f"[hfm] ΔP-Q baseline calibrated to current state: Q={q} mL/min, ΔP_friction={dpf} kPa, scale x{f:.3f}")
    push_hfm_state(None, ok=True, action="dp_from_now")


# ---- §9 Startup self-test: stop the pump and measure the gravity offset ρgh (also verifies the pressure lines) ----
_selftest = {"state": "idle", "progress": 0.0, "message": "", "result": None, "t0": None}
_selftest_samples = []        # (monotonic_t, feed_bar, ret_bar, perm_bar)  mean_raw


def _selftest_feed(now, c):
    if _selftest["state"] == "recording":
        _selftest_samples.append((now, c["feed"]["mean_raw"], c["retentate"]["mean_raw"], c["permeate"]["mean_raw"]))


def _selftest_push(state, message="", progress=None, result=None):
    _selftest.update(state=state, message=message)
    if progress is not None:
        _selftest["progress"] = round(progress, 1)
    if result is not None:
        _selftest["result"] = result
    push_hfm_state(None, action="selftest")


def _selftest_run():
    global _selftest_samples
    settle, rec, tmax = HFM["selftest_settle_s"], HFM["selftest_record_s"], HFM["selftest_max_s"]
    t0 = time.monotonic()
    _selftest["t0"] = t0

    def pump_running():
        with _pump_lock:
            return (pump_state.get("pwm") or 0) > 0

    # 1) After stopping the pump, wait settle seconds
    while time.monotonic() - t0 < settle:
        if _selftest["state"] == "cancel":
            return _selftest_push("idle", "Cancelled")
        if pump_running():
            return _selftest_push("failed", "Pump started during self-test, aborted")
        _selftest_push("settling", f"Waiting for flow to decay {settle - (time.monotonic()-t0):.0f} s",
                       progress=(time.monotonic() - t0) / (settle + rec) * 100)
        time.sleep(1.0)
    # 2) Record; 3) Check for a plateau: ΔP slope over the last rec seconds must be small enough, otherwise keep waiting (up to tmax)
    _selftest_samples = []
    _selftest.update(state="recording")
    t_rec = time.monotonic()
    while True:
        time.sleep(1.0)
        now = time.monotonic()
        if _selftest["state"] == "cancel":
            return _selftest_push("idle", "Cancelled")
        if pump_running():
            return _selftest_push("failed", "Pump started during self-test, aborted")
        win = [s for s in _selftest_samples if now - s[0] <= rec]
        elapsed = now - t_rec
        if elapsed < rec:
            _selftest_push("recording", f"Recording {elapsed:.0f}/{rec:.0f} s",
                           progress=(settle + elapsed) / (settle + rec) * 100)
            continue
        if len(win) < 10:
            return _selftest_push("failed", "No pressure data (MCU not sending?)")
        pts = [(s[0] / 60.0, (s[1] - s[2]) * 100.0) for s in win]       # (min, kPa)
        slope, _, _ = linreg(pts)
        plateau = abs(slope) <= HFM["selftest_plateau_kpa_per_min"]
        if not plateau and now - t0 < tmax:
            _selftest_push("recording", f"Reading still drifting ({slope:+.2f} kPa/min), waiting for plateau...",
                           progress=min(99.0, (now - t0) / tmax * 100))
            continue
        rho = sum(p[1] for p in pts) / len(pts)
        ps = sum(s[3] for s in win) / len(win) * 100.0
        with _hfm_lock:
            prev = hfm_state["rho_gh_kpa"] if hfm_state["rho_gh_source"] == "measured" else None
        warn = []
        if not plateau:
            warn.append(f"No stable plateau after {tmax:.0f} s ({slope:+.2f} kPa/min), low confidence")
        if prev is not None and abs(rho - prev) > max(0.3, abs(prev) * HFM["selftest_diff_warn_fraction"]):
            warn.append(f"Differs from previous {prev:.2f} kPa by more than {HFM['selftest_diff_warn_fraction']*100:.0f}%: "
                        "check impulse line for bubbles / transmitter zero")
        if abs(ps) > 1.0:
            warn.append(f"P_s = {ps:.2f} kPa, not near 0 (collection bottle should be vented): check zero or drain line")
        with _hfm_lock:
            hfm_state.update(rho_gh_kpa=round(rho, 3), rho_gh_source="measured", rho_gh_at=time.time(),
                             ps_ref_kpa=round(ps, 3))
        _hfm_save()
        raw_event("rho_gh_selftest", {"rho_gh_kpa": round(rho, 3), "ps_kpa": round(ps, 3), "warnings": warn})
        result = {"rho_gh_kpa": round(rho, 3), "ps_kpa": round(ps, 3), "slope_kpa_per_min": round(slope, 3),
                  "n": len(win), "prev_kpa": prev, "warnings": warn, "at": time.time()}
        print(f"[hfm] self-test done: ρgh = {rho:.3f} kPa, P_s = {ps:.3f} kPa, slope {slope:+.3f} kPa/min"
              + (" | " + "; ".join(warn) if warn else ""))
        return _selftest_push("done", "Done" if not warn else "Done (with warnings)", progress=100.0, result=result)


def handle_hfm_selftest_start(client, data):
    if _selftest["state"] in ("settling", "recording"):
        push_hfm_state(client, ok=False, error="Self-test already running", action="selftest")
        return
    with _pump_lock:
        running = (pump_state.get("pwm") or 0) > 0
    if running:
        push_hfm_state(client, ok=False, error="Stop the pump (PWM = 0) before self-test", action="selftest")
        return
    _selftest.update(state="settling", progress=0.0, message="Started", result=None)

    def _bg():
        try:
            _selftest_run()
        except Exception:
            print(f"[hfm] self-test failed:\n{traceback.format_exc()}")
            _selftest_push("failed", "Program error, see Python log")
    threading.Thread(target=_bg, daemon=True).start()
    push_hfm_state(None, action="selftest")


def handle_hfm_selftest_cancel(client, data):
    if _selftest["state"] in ("settling", "recording"):
        _selftest["state"] = "cancel"


# ---- v4.6: ΔP-Q sweep (multiple flow rates -> fit ΔP_friction = a·Q + b·Q²) ----
# Set the pump to the user-supplied PWM values in order (default high to low, optionally low to high); at each point wait settle seconds to stabilize, then record measure seconds:
#   ΔP_friction = (P_in - P_out) - ρgh   (mean_raw of the 5 Hz pressure snapshot)
#   Q           = flow meter (1 Hz)
# After all points, restore the pre-sweep PWM and do a least-squares fit (through the origin): quadratic a·Q + b·Q² and linear a·Q.
# Results are written to dp_a / dp_b only after pressing "Apply"; measurement points are saved with the fit and can be exported/imported.
DPQ_LIMITS = {"max_points": 10, "settle_s": (5, 300), "measure_s": (10, 600)}
_dpq = {"state": "idle", "message": "", "progress": 0.0, "step": 0, "total": 0,
        "points": [], "fit": None, "config": None, "at": None}
_dpq_samples = []          # (monotonic_t, dp_total_kpa)
_dpq_recording = False


def _dpq_feed(now, c):
    if _dpq_recording:
        _dpq_samples.append((now, (c["feed"]["mean_raw"] - c["retentate"]["mean_raw"]) * 100.0))


def push_dpq_state(client=None, ok=True, error=None):
    payload = {"ok": ok, "error": error, **{k: _dpq[k] for k in _dpq}}
    with _hfm_lock:
        payload["applied"] = {"dp_a": hfm_state["dp_a"], "dp_b": hfm_state["dp_b"],
                              "dp_source": hfm_state["dp_source"], "dp_at": hfm_state["dp_at"],
                              "dp_points": hfm_state.get("dp_points"), "dp_fit": hfm_state.get("dp_fit")}
    ui.send_message("dpq_state", payload, client)


def _mean_sd(xs):
    n = len(xs)
    if n == 0:
        return None, None
    m = sum(xs) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in xs) / (n - 1)) if n > 1 else 0.0
    return m, sd


def dpq_fit(points):
    """points: [{q, dpf}, ...]. Returns quadratic (through origin) and linear (through origin) fits, R², and the recommended model."""
    pts = [(p["q"], p["dpf"]) for p in points if p.get("q") and p["q"] > 0 and p.get("dpf") is not None]
    n = len(pts)
    if n < 2:
        return None
    sq2 = sum(q ** 2 for q, _ in pts); sq3 = sum(q ** 3 for q, _ in pts); sq4 = sum(q ** 4 for q, _ in pts)
    sqy = sum(q * y for q, y in pts); sq2y = sum(q * q * y for q, y in pts)
    ys = [y for _, y in pts]; my = sum(ys) / n
    sst = sum((y - my) ** 2 for y in ys)

    def r2(f):
        sse = sum((y - f(q)) ** 2 for q, y in pts)
        return (1.0 - sse / sst) if sst > 1e-12 else None, math.sqrt(sse / n)

    def adj(r2v, k):          # Adjusted R² (k = number of parameters): an extra parameter must give a real improvement to count
        return None if r2v is None or n - k <= 0 else 1.0 - (1.0 - r2v) * (n - 1) / (n - k)

    a_lin = sqy / sq2 if sq2 > 0 else None
    lin = None
    if a_lin is not None:
        rr, rms = r2(lambda q: a_lin * q)
        lin = {"a": a_lin, "b": 0.0, "r2": rr, "rms_kpa": rms}
    quad = None
    det = sq2 * sq4 - sq3 * sq3
    if n >= 3 and abs(det) > 1e-12 * max(1.0, sq2 * sq4):
        a = (sqy * sq4 - sq2y * sq3) / det
        b = (sq2 * sq2y - sq3 * sqy) / det
        rr, rms = r2(lambda q: a * q + b * q * q)
        quad = {"a": a, "b": b, "r2": rr, "rms_kpa": rms}
    # v5.0 recommendation rule: negative quadratic term (physically unreasonable), points < 4, or adjusted R² not better than linear -> linear
    if lin:
        lin["adj_r2"] = adj(lin["r2"], 1)
    if quad:
        quad["adj_r2"] = adj(quad["r2"], 2)
    rec = "linear"
    if quad and quad["b"] >= 0 and quad["a"] > 0 and n >= 4:
        if lin is None or (quad["adj_r2"] is not None and (lin["adj_r2"] is None or quad["adj_r2"] > lin["adj_r2"])):
            rec = "quadratic"
    q_range = [min(q for q, _ in pts), max(q for q, _ in pts)]
    return {"n": n, "linear": lin, "quadratic": quad, "recommended": rec, "q_range": q_range}


def _dpq_set_pwm(pwm):
    ok, resp = _safe_pump_bridge_call("set_pump_pwm", str(int(pwm)))
    with _pump_lock:
        pump_state["pwm"] = int(pwm)
    push_pump_status()
    return ok


def _dpq_push(state=None, message=None, progress=None):
    if state is not None:
        _dpq["state"] = state
    if message is not None:
        _dpq["message"] = message
    if progress is not None:
        _dpq["progress"] = round(max(0.0, min(100.0, progress)), 1)
    push_dpq_state()


def _dpq_run(pwms, settle, measure, restore_pwm):
    global _dpq_samples, _dpq_recording
    total_t = len(pwms) * (settle + measure)
    t_start = time.monotonic()
    with _hfm_lock:
        rho = hfm_state["rho_gh_kpa"]

    nonlocal_flags = {"override": False}

    def elapsed_pct():
        return (time.monotonic() - t_start) / total_t * 100.0

    def aborted(target):
        if _dpq["state"] == "cancel":
            return "Cancelled"
        with _pump_lock:
            cur = pump_state.get("pwm")
        if cur != target:
            nonlocal_flags["override"] = True       # User manually changed the pump (incl. emergency stop): do not turn the pump back on
            return f"PWM changed to {cur} during sweep, aborted (keeping current PWM)"
        return None

    try:
        for i, pwm in enumerate(pwms):
            _dpq["step"] = i + 1
            if not _dpq_set_pwm(pwm):
                return _dpq_push("failed", f"Sending PWM {pwm} failed (no MCU response)")
            t0 = time.monotonic()
            while time.monotonic() - t0 < settle:
                why = aborted(pwm)
                if why:
                    return _dpq_push("failed" if "aborted" in why else "idle", why)
                _dpq_push("running", f"Point {i+1}/{len(pwms)} PWM {pwm}: settling "
                          f"{settle - (time.monotonic()-t0):.0f} s", elapsed_pct())
                time.sleep(1.0)
            _dpq_samples = []
            _dpq_recording = True
            qs = []
            t1 = time.monotonic()
            while time.monotonic() - t1 < measure:
                why = aborted(pwm)
                if why:
                    _dpq_recording = False
                    return _dpq_push("failed" if "aborted" in why else "idle", why)
                qs.append(float(latest_flow.get("flow") or 0.0))
                _dpq_push("running", f"Point {i+1}/{len(pwms)} PWM {pwm}: recording "
                          f"{time.monotonic()-t1:.0f}/{measure:.0f} s", elapsed_pct())
                time.sleep(1.0)
            _dpq_recording = False
            dps = [v for _, v in _dpq_samples]
            q_m, q_sd = _mean_sd(qs)
            dp_m, dp_sd = _mean_sd(dps)
            warn = []
            if not dps:
                warn.append("No pressure data")
            if q_m is None or q_m <= 0:
                warn.append("Flow is 0 (pump not running or no flowmeter signal)")
            elif q_sd is not None and q_sd / q_m > 0.15:
                warn.append(f"Unstable flow (CV {q_sd/q_m*100:.0f}%)")
            pt = {"pwm": pwm, "q": None if q_m is None else round(q_m, 3),
                  "q_sd": None if q_sd is None else round(q_sd, 3),
                  "dp_total_kpa": None if dp_m is None else round(dp_m, 4),
                  "dpf": None if dp_m is None else round(dp_m - rho, 4),
                  "dpf_sd": None if dp_sd is None else round(dp_sd, 4),
                  "n_p": len(dps), "n_q": len(qs), "warn": warn}
            _dpq["points"].append(pt)
            print(f"[dpq] PWM {pwm}: Q={pt['q']} mL/min, ΔP_total={pt['dp_total_kpa']} kPa, "
                  f"ΔP_friction={pt['dpf']} kPa" + (" | " + "; ".join(warn) if warn else ""))
            push_dpq_state()
        good = [p for p in _dpq["points"] if p["q"] and p["q"] > 0 and p["dpf"] is not None]
        fit = dpq_fit(good)
        if fit is None:
            return _dpq_push("failed", "Not enough valid points (need >= 2 with flow and pressure)")
        fit.update(rho_gh_kpa=rho, settle_s=settle, measure_s=measure)
        _dpq["fit"] = fit
        _dpq["at"] = time.time()
        rec = fit[fit["recommended"]]
        print(f"[dpq] fit done({fit['recommended']}): a={rec['a']:.6g}, b={rec['b']:.6g}, R²={rec['r2']}")
        return _dpq_push("done", "Done: review results, then press Apply", 100.0)
    finally:
        _dpq_recording = False
        if _dpq["state"] in ("running", "cancel"):
            _dpq["state"] = "idle"
        if not nonlocal_flags["override"]:
            try:
                _dpq_set_pwm(restore_pwm)
                print(f"[dpq] restored pre-sweep PWM {restore_pwm}")
            except Exception:
                pass


def handle_dpq_start(client, data):
    d = data or {}
    if _dpq["state"] in ("running", "cancel"):
        return push_dpq_state(client, ok=False, error="Sweep already running")
    if _selftest["state"] in ("settling", "recording"):
        return push_dpq_state(client, ok=False, error="ρgh self-test running, wait for it to finish")
    try:
        pwms = [int(round(float(x))) for x in (d.get("pwms") or [])]
        settle = float(d.get("settle_s", 20)); measure = float(d.get("measure_s", 30))
    except (TypeError, ValueError):
        return push_dpq_state(client, ok=False, error="Invalid parameter format")
    order = d.get("order", "desc")
    if order not in ("asc", "desc"):
        order = "desc"
    # v4.7.2: default high to low -- low PWM is unstable when starting from rest; run high PWM first, then step down so the pump keeps turning
    pwms = sorted(set(p for p in pwms if 1 <= p <= 255), reverse=(order == "desc"))
    if len(pwms) < 2 or len(pwms) > DPQ_LIMITS["max_points"]:
        return push_dpq_state(client, ok=False, error=f"Need 2-{DPQ_LIMITS['max_points']} PWM points (1-255)")
    lo, hi = DPQ_LIMITS["settle_s"]
    if not lo <= settle <= hi:
        return push_dpq_state(client, ok=False, error=f"Settle time must be {lo}-{hi} s")
    lo, hi = DPQ_LIMITS["measure_s"]
    if not lo <= measure <= hi:
        return push_dpq_state(client, ok=False, error=f"Record time must be {lo}-{hi} s")
    with _pump_lock:
        restore = int(pump_state.get("pwm") or 0)
    _dpq.update(state="running", message="Started", progress=0.0, step=0, total=len(pwms), points=[], fit=None,
                config={"pwms": pwms, "order": order, "settle_s": settle, "measure_s": measure, "restore_pwm": restore},
                at=None)
    print(f"[dpq] starting ΔP-Q sweep: PWM {pwms}, settle {settle:.0f} s, record {measure:.0f} s, restore PWM {restore} afterwards")

    def _bg():
        try:
            _dpq_run(pwms, settle, measure, restore)
        except Exception:
            print(f"[dpq] sweep failed:\n{traceback.format_exc()}")
            _dpq_push("failed", "Program error, see Python log")
    threading.Thread(target=_bg, daemon=True).start()
    push_dpq_state()


def handle_dpq_cancel(client, data):
    if _dpq["state"] == "running":
        _dpq["state"] = "cancel"


def handle_dpq_apply(client, data):
    model = (data or {}).get("model") or (_dpq.get("fit") or {}).get("recommended")
    fit = _dpq.get("fit")
    if not fit or model not in ("linear", "quadratic") or not fit.get(model):
        return push_dpq_state(client, ok=False, error="No fit result to apply")
    m = fit[model]
    if not (m["a"] > 0):
        return push_dpq_state(client, ok=False, error="Fitted a <= 0 is invalid, check measurement points")
    with _hfm_lock:
        hfm_state.update(dp_a=float(m["a"]), dp_b=float(m["b"]), dp_source="measured", dp_at=time.time(),
                         dp_points=list(_dpq["points"]),
                         dp_fit=dict(fit, model=model, applied_at=time.time()))
    _hfm_save()
    raw_event("dp_q_baseline", {"model": model, "a": m["a"], "b": m["b"], "mu_cp": current_mu_cp()[0]})
    print(f"[dpq] applied {model}: a={m['a']:.6g}, b={m['b']:.6g}")
    push_hfm_state(None, ok=True, action="dp_sweep")
    push_dpq_state(None)


def handle_dpq_get(client, data):
    push_dpq_state(client)


ui.on_message("dpq_start", handle_dpq_start)
ui.on_message("dpq_cancel", handle_dpq_cancel)
ui.on_message("dpq_apply", handle_dpq_apply)
ui.on_message("dpq_get", handle_dpq_get)


ui.on_message("hfm_get_state", handle_hfm_get_state)
ui.on_message("hfm_set", handle_hfm_set)
ui.on_message("hfm_dp_baseline_from_now", handle_hfm_dp_baseline_from_now)
ui.on_message("hfm_selftest_start", handle_hfm_selftest_start)
ui.on_message("hfm_selftest_cancel", handle_hfm_selftest_cancel)


# ============================= Calibration export / import (v4.1) =============================
CALIB_EXPORT_FORMAT = "hfm-bioreactor-calibration"
CALIB_EXPORT_VERSION = 1
_HFM_EXPORT_KEYS = ("rho_gh_kpa", "rho_gh_source", "rho_gh_at", "ps_ref_kpa", "dp_a", "dp_b", "dp_source",
                    "dp_at", "q_perm_mlmin", "lp_initial", "lp_initial_at", "dp_points", "dp_fit",
                    "q_l_mode", "q_l_manual")


def build_calibration_bundle():
    live = read_mcu_calibration()            # Values currently "actually in effect" on the MCU; fall back to the saved file if unreadable
    with _calib_lock:
        saved = {k: dict(v) for k, v in calibration_saved.items()}
    mcu = {}
    for item in ("od600_blank", "pressure_offsets", "od600_path_length_factor"):
        v = (saved.get(item) or live.get(item)) if item == "od600_blank" else (live.get(item) or saved.get(item))
        if v:
            mcu[item] = {k: v[k] for k in v if k != "saved_at"}
    with _hfm_lock:
        h = {k: hfm_state.get(k) for k in _HFM_EXPORT_KEYS}
    return {
        "format": CALIB_EXPORT_FORMAT, "format_version": CALIB_EXPORT_VERSION,
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "firmware": mcu_link.get("fw"), "config_version": CONFIG_VERSION, "constants_version": CONSTANTS_VERSION,
        "mcu_calibration": mcu,
        "ph_config": {k: ph_config.get(k) for k in PH_CONFIG_KEYS} if ph_config else None,
        "hfm": h,
        "specs": {k: HFM[k] for k in SPEC_KEYS},
        "valve_config": {k: valve_config.get(k) for k in VALVE_CONFIG_KEYS} if valve_config else None,
        "pump_kick": dict(pump_kick["config"]),
        # v6.0
        "aux_valves": {n: dict(av_config[n], pos=list(av_config[n]["pos"])) for n in AV_NAMES},
        "pressure_protect": dict(pressure_protect_cfg),
        "base_pump": dict(base_cfg),
        "ph_control": {k: v for k, v in ph_doser.cfg.items() if k != "enabled"},   # Enabled state is not carried in the file
    }


def handle_calib_export(client, data):
    try:
        bundle = build_calibration_bundle()
    except Exception as e:
        ui.send_message("calib_export_data", {"ok": False, "error": str(e)}, client)
        return
    fn = "calibration_" + time.strftime("%Y%m%d_%H%M%S") + ".json"
    print(f"[calib] exported calibration -> {fn}")
    ui.send_message("calib_export_data", {"ok": True, "filename": fn, "bundle": bundle}, client)


def handle_calib_import(client, data):
    """data = {bundle: {...}, sections: [...]}. sections are the sections to apply; all if not given."""
    d = data or {}
    b = d.get("bundle") or {}
    if b.get("format") != CALIB_EXPORT_FORMAT:
        ui.send_message("calib_import_result", {"ok": False, "error": "Not a calibration file exported by this system (format mismatch)"}, client)
        return
    want = set(d.get("sections") or ("mcu_calibration", "ph_config", "hfm", "specs", "valve_config", "pump_kick",
                                      "aux_valves", "pressure_protect", "base_pump", "ph_control"))
    done, failed = [], []

    if "specs" in want and isinstance(b.get("specs"), dict):
        vals, errs = _spec_validate(b["specs"])
        if errs:
            failed.append("specs: " + "; ".join(errs))
        else:
            merged = {k: v for k, v in vals.items() if abs(float(v) - float(HFM_FILE_DEFAULTS[k])) > 1e-12}
            specs_apply(merged); done.append("specs")
            push_specs_state()

    if "mcu_calibration" in want and isinstance(b.get("mcu_calibration"), dict):
        items = []
        mc = b["mcu_calibration"]
        try:
            if mc.get("od600_blank") and float(mc["od600_blank"].get("ratio", 0)) > 0:
                calib_remember("od600_blank", {"ratio": float(mc["od600_blank"]["ratio"]),
                                               "lux_sample": float(mc["od600_blank"].get("lux_sample", 0.0)),
                                               "lux_ref": float(mc["od600_blank"].get("lux_ref", 0.0))}, "manual")
                items.append("od600_blank")
            if mc.get("pressure_offsets"):
                o = mc["pressure_offsets"]
                calib_remember("pressure_offsets", {ch: float(o[ch]) for ch in ("feed", "retentate", "permeate")}, "manual")
                items.append("pressure_offsets")
            if mc.get("od600_path_length_factor"):
                calib_remember("od600_path_length_factor",
                               {"value": float(mc["od600_path_length_factor"]["value"])}, "manual")
                items.append("od600_path_length_factor")
        except (TypeError, ValueError, KeyError) as e:
            failed.append(f"mcu_calibration: invalid format {e}")
            items = []
        if items:
            applied = apply_saved_calibration(items, source="manual", client=client)
            done += [f"mcu:{x}" for x in applied]
            failed += [f"mcu:{x}" for x in items if x not in applied]

    if "ph_config" in want and isinstance(b.get("ph_config"), dict):
        pc = {k: _f(b["ph_config"].get(k)) for k in PH_CONFIG_KEYS}
        ok, err = _ph_apply_config(pc, save_as="manual")
        (done.append("ph_config") if ok else failed.append(f"ph_config: {err}"))
        push_ph_config(None, ok=ok, error=err, action="import")

    if "hfm" in want and isinstance(b.get("hfm"), dict):
        hb = b["hfm"]
        with _hfm_lock:
            for k in ("rho_gh_kpa", "ps_ref_kpa", "dp_a", "dp_b", "q_perm_mlmin", "lp_initial"):
                if k in hb:
                    hfm_state[k] = None if hb[k] is None else float(hb[k])
            if hb.get("rho_gh_kpa") is not None:
                hfm_state.update(rho_gh_source="imported", rho_gh_at=time.time())
            if hb.get("dp_a") is not None:
                hfm_state.update(dp_source="imported", dp_at=time.time())
            hfm_state["q_perm_source"] = "manual" if hfm_state.get("q_perm_mlmin") else None
            if hb.get("q_l_mode") in ("meter", "manual"):
                hfm_state["q_l_manual"] = hb.get("q_l_manual")
                hfm_state["q_l_mode"] = hb["q_l_mode"] if hb.get("q_l_manual") else "meter"
            if isinstance(hb.get("dp_points"), list):
                hfm_state["dp_points"] = hb["dp_points"]
            if isinstance(hb.get("dp_fit"), dict):
                hfm_state["dp_fit"] = hb["dp_fit"]
        _hfm_save(); done.append("hfm")
        push_hfm_state()

    if "valve_config" in want and isinstance(b.get("valve_config"), dict):
        vc = {k: b["valve_config"].get(k) for k in VALVE_CONFIG_KEYS if b["valve_config"].get(k) is not None}
        ok, err = _valve_apply_config(vc, source="imported")
        (done.append("valve_config") if ok else failed.append(f"valve_config: {err}"))
        push_valve_config(None, ok=ok, error=err, action="import")

    if "pump_kick" in want and isinstance(b.get("pump_kick"), dict):
        pk = {k: b["pump_kick"].get(k) for k in PUMP_KICK_KEYS if b["pump_kick"].get(k) is not None}
        ok, err = _pump_kick_apply(pk)
        (done.append("pump_kick") if ok else failed.append(f"pump_kick: {err}"))
        push_pump_kick(None, ok=ok, error=err)

    # v6.0
    if "aux_valves" in want and isinstance(b.get("aux_valves"), dict):
        for n in AV_NAMES:
            src = b["aux_valves"].get(n)
            if not isinstance(src, dict):
                continue
            old = av_config[n]
            try:
                av_config[n] = {"id": int(src.get("id", old["id"])),
                                "pos": [int(x) for x in (src.get("pos") or old["pos"])][:3],
                                "speed": int(src.get("speed", old["speed"])), "acc": int(src.get("acc", old["acc"]))}
                ok, err = _av_push_config(n)
            except (TypeError, ValueError) as e:
                ok, err = False, str(e)
            if not ok:
                av_config[n] = old
            (done.append(f"aux_valves.{n}") if ok else failed.append(f"aux_valves.{n}: {err}"))
        _pv_save("avalve_config", {n: dict(av_config[n], pos=list(av_config[n]["pos"])) for n in AV_NAMES})
        push_avalve_status()
    if "pressure_protect" in want and isinstance(b.get("pressure_protect"), dict):
        lim = _f(b["pressure_protect"].get("limit"))
        if lim is not None and 0.1 <= lim <= 5.0:
            old = pressure_protect_cfg["limit"]
            pressure_protect_cfg["limit"] = lim
            ok, err = _pp_push()
            if ok:
                _pv_save("pressure_protect", dict(pressure_protect_cfg))
            else:
                pressure_protect_cfg["limit"] = old
            (done.append("pressure_protect") if ok else failed.append(f"pressure_protect: {err}"))
        else:
            failed.append("pressure_protect: limit must be within 0.1-5.0 bar")
    if "base_pump" in want and isinstance(b.get("base_pump"), dict):
        old = dict(base_cfg)
        pwm, mx = _i(b["base_pump"].get("pwm"), base_cfg["pwm"]), _f(b["base_pump"].get("max_s_h"), base_cfg["max_s_h"])
        if 1 <= pwm <= 255 and 0 <= mx <= 600:
            base_cfg.update(pwm=pwm, max_s_h=mx)
            ok, err = _base_push_cfg()
            if ok:
                _pv_save("base_pump", dict(base_cfg))
            else:
                base_cfg.update(old)
        else:
            ok, err = False, "PWM 1-255, hourly limit 0-600 s"
        (done.append("base_pump") if ok else failed.append(f"base_pump: {err}"))
    if "ph_control" in want and isinstance(b.get("ph_control"), dict):
        pc = {k: v for k, v in b["ph_control"].items() if k != "enabled"}
        ok, errs = ph_doser.configure(pc)
        if ok:
            _pv_save("ph_ctrl", dict(ph_doser.cfg))
        (done.append("ph_control") if ok else failed.append("ph_control: " + "; ".join(errs)))
        push_ph_ctrl()
    push_safety_status()

    print(f"[calib] imported calibration file: ok {done}, failed {failed}")
    ui.send_message("calib_import_result", {"ok": not failed, "done": done, "failed": failed}, client)
    push_calibration_state()


ui.on_message("calib_export", handle_calib_export)
ui.on_message("calib_import", handle_calib_import)

# ============================= Derived parameter computation (spec §3) =============================
# Uses only signals the current hardware actually has: p_in (feed), p_out (retentate), p_perm (permeate), q_feed.
# No permeate flow meter and no temperature sensor, so flux/conversion/S/tmp_corrected/temperature correction are not computed.

def linreg(points):
    """points: [(x, y), ...]. Returns (slope, intercept, resid_sd). Returns (None,None,None) if fewer than 2 points."""
    n = len(points)
    if n < 2:
        return None, None, None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    sxx = sum((x - mean_x) ** 2 for x in xs)
    if sxx < 1e-12:
        return 0.0, mean_y, 0.0
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    slope = sxy / sxx
    intercept = mean_y - slope * mean_x
    resid_sd = math.sqrt(sum((y - (slope * x + intercept)) ** 2 for x, y in zip(xs, ys)) / n)
    return slope, intercept, resid_sd


_buf_lock = threading.Lock()
_p_in_buf = deque()    # (monotonic_t, bar)
_p_out_buf = deque()
_q_buf = deque()       # (monotonic_t, mL/min)
_tmp_buf = deque()     # (monotonic_t, bar)  for dTMP/dt
_dtdt_buf = deque()    # (monotonic_t, bar/min) for d²TMP/dt²
_R_buf = deque()       # (monotonic_t, R) for dR/dt

_steady_since = None   # Start time (monotonic) of continuous steady state; None means currently not steady


def _trim(buf, now, keep_s):
    while buf and now - buf[0][0] > keep_s:
        buf.popleft()


# ============================= v3.7 algorithm switching =============================
# Per section 2 of the signal-processing algorithm review report, the backup algorithms it recommends are made switchable.
# All defaults are "current (legacy)"; without switching, behavior is exactly as before; every CSV row records the
# algorithm combination in use (alg_profile column) so post-hoc analysis can tell them apart.
#
#   flow             gate (current 1 s gate counting) | reciprocal (C-1 reciprocal counting)          <- MCU
#   od_estimator     mad (E-1 current) | qn (E-2) | biweight (E-5) | upper (E-3 one-sided)   <- MCU
#   analysis_source  ema (current: derived params/steady/trend/aggregation use EMA-filtered pressure)
#                    | raw (F-1: analysis path uses mean_raw, EMA kept for display only)
#   steady           legacy (fixed slope + residual SD thresholds) | ci (H-1 slope confidence interval + H-3 M-of-N hysteresis)
#   curvature        legacy (regress again on the dTMP/dt series) | quadfit (H-8 fit a quadratic directly to TMP, take 2a)
#   aggregation (sampling settings panel): median | mean | trimmed10 (G-2) | hodges_lehmann (G-3)
ALG_OPTIONS = {
    "flow": ("gate", "reciprocal"),
    "od_estimator": tuple(PA.ALG_NAMES),          # v5.0: 8 kinds (mad qn biweight upper mean median p75 p90)
    "analysis_source": ("ema", "raw"),
    "steady": ("legacy", "ci"),
    "curvature": ("legacy", "quadfit"),
}
_ALG_CONST = CONST.get("algorithms", {}) or {}
alg_settings = {k: (_ALG_CONST.get(k) if _ALG_CONST.get(k) in v else v[0]) for k, v in ALG_OPTIONS.items()}
_alg_lock = threading.Lock()

STEADY_CI_T = float(_ALG_CONST.get("steady_ci_t", 0))      # 0 = pick t(0.975) automatically from degrees of freedom
STEADY_MOFN_M = int(_ALG_CONST.get("steady_m_of_n_m", 8))
STEADY_MOFN_N = int(_ALG_CONST.get("steady_m_of_n_n", 10))
# ci-mode thresholds and window: report B.3 notes that with a 60 s window and 3 mbar residual, the slope's own standard error is already 1.34e-3 bar/min,
# larger than the current 1e-3 threshold -- when judging by confidence interval, the threshold must be clearly larger than t·SE to be meaningful.
# Lengthening the window to 120 s reduces SE to about 1/2.8 (SE ∝ n^-1.5), so a 0.002 bar/min threshold becomes decidable.
STEADY_CI_WINDOW_S = float(_ALG_CONST.get("steady_ci_window_s", 120))
STEADY_CI_SLOPE_THRESH = float(_ALG_CONST.get("steady_ci_slope_thresh_bar_per_min", 0.002))
STEADY_CI_FLOW_THRESH = float(_ALG_CONST.get("steady_ci_flow_slope_thresh_mlmin_per_min", 5.0))


def alg_profile_string():
    with _alg_lock:
        a = dict(alg_settings)
    return ";".join(f"{k}={a[k]}" for k in ALG_OPTIONS) + f";agg={agg_settings['method']}"


def push_alg_settings(client=None, ok=True, error=None):
    with _alg_lock:
        a = dict(alg_settings)
    ui.send_message("alg_settings", {
        "ok": ok, "error": error, "settings": a,
        "options": {k: list(v) for k, v in ALG_OPTIONS.items()},
        "profile": alg_profile_string(),
    }, client)


def handle_get_algorithms(client, data):
    push_alg_settings(client)


def handle_set_algorithms(client, data):
    data = data or {}
    new = {}
    for k, opts in ALG_OPTIONS.items():
        if k in data and data[k] not in (None, ""):
            if data[k] not in opts:
                push_alg_settings(client, ok=False, error=f"{k} must be {'/'.join(opts)}")
                return
            new[k] = data[k]
    if not new:
        push_alg_settings(client)
        return
    with _alg_lock:
        changed_steady = new.get("steady") not in (None, alg_settings["steady"])
        alg_settings.update(new)
    if changed_steady or "analysis_source" in new:
        _reset_analysis_buffers()      # Decision logic or data source changed; old accumulated data must not be mixed in
    _pv_save("algorithms", dict(alg_settings))
    raw_event("algorithms", dict(alg_settings))
    print(f"[alg] {alg_profile_string()}")
    if "od_estimator" in new:            # v5.0: OD algorithm is in Python; recompute immediately from the last raw reading
        od_recompute_latest()
        push_od_blank()
    push_alg_settings()


ui.on_message("get_algorithms", handle_get_algorithms)
ui.on_message("set_algorithms", handle_set_algorithms)


def _t975(df):
    """Approximate 0.975 quantile of Student t (two-tailed 95%), without pulling in scipy."""
    if STEADY_CI_T > 0:
        return STEADY_CI_T
    if df <= 0:
        return float("inf")
    table = {1: 12.71, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306,
             9: 2.262, 10: 2.228, 15: 2.131, 20: 2.086, 30: 2.042}
    if df in table:
        return table[df]
    if df > 30:
        return 1.96 + 2.4 / df
    keys = sorted(table)
    for lo, hi in zip(keys, keys[1:]):
        if lo < df < hi:
            return table[lo] + (table[hi] - table[lo]) * (df - lo) / (hi - lo)
    return 2.0


def linreg_se(points):
    """Returns (slope, se_slope, n). SE uses the residual standard deviation with n-2 degrees of freedom (report B.3)."""
    n = len(points)
    if n < 3:
        return None, None, n
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx < 1e-12:
        return 0.0, float("inf"), n
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    icpt = my - slope * mx
    ss = sum((y - (slope * x + icpt)) ** 2 for x, y in zip(xs, ys))
    s = math.sqrt(ss / (n - 2))
    return slope, s / math.sqrt(sxx), n


def quadfit_second_derivative(points):
    """H-8: fit y = a·t² + b·t + c directly to (t, y), return 2a (units: y/s²). Returns None if fewer than 5 points."""
    n = len(points)
    if n < 5:
        return None
    t0 = points[0][0]
    ts = [p[0] - t0 for p in points]
    mt = sum(ts) / n
    ts = [t - mt for t in ts]              # Center, improves numerical conditioning
    ys = [p[1] for p in points]
    s0 = n
    s1 = sum(ts)
    s2 = sum(t * t for t in ts)
    s3 = sum(t ** 3 for t in ts)
    s4 = sum(t ** 4 for t in ts)
    sy = sum(ys)
    sty = sum(t * y for t, y in zip(ts, ys))
    st2y = sum(t * t * y for t, y in zip(ts, ys))
    # Normal equations [[s4 s3 s2],[s3 s2 s1],[s2 s1 s0]] · [a b c] = [st2y sty sy], solved with Cramer's rule
    m = [[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]]
    r = [st2y, sty, sy]

    def det3(a):
        return (a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
                - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
                + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]))
    d = det3(m)
    if abs(d) < 1e-18:
        return None
    ma = [[r[0], m[0][1], m[0][2]], [r[1], m[1][1], m[1][2]], [r[2], m[2][1], m[2][2]]]
    a = det3(ma) / d
    return 2.0 * a


_steady_hist = deque(maxlen=max(1, STEADY_MOFN_N))


def _reset_analysis_buffers():
    global _steady_since
    with _buf_lock:
        for b in (_p_in_buf, _p_out_buf, _q_buf, _tmp_buf, _dtdt_buf, _R_buf):
            b.clear()
        _steady_hist.clear()
    _steady_since = None


def update_steady(now, p_in_bar, p_out_bar, q_feed):
    """Spec §5.2: steady state only when P_in, P_out and Q all satisfy the slope and residual thresholds."""
    global _steady_since
    with _buf_lock:
        _p_in_buf.append((now, p_in_bar))
        _p_out_buf.append((now, p_out_bar))
        _q_buf.append((now, q_feed))
        keep = max(STEADY_WINDOW_S, STEADY_CI_WINDOW_S)     # v3.7: both decision modes share the buffer; keep the longer of the two
        _trim(_p_in_buf, now, keep)
        _trim(_p_out_buf, now, keep)
        _trim(_q_buf, now, keep)
        p_in_all, p_out_all, q_all = list(_p_in_buf), list(_p_out_buf), list(_q_buf)

    win = STEADY_CI_WINDOW_S if alg_settings["steady"] == "ci" else STEADY_WINDOW_S
    p_in_pts = [p for p in p_in_all if now - p[0] <= win]
    p_out_pts = [p for p in p_out_all if now - p[0] <= win]
    q_pts = [p for p in q_all if now - p[0] <= win]
    if not p_in_all or (now - p_in_all[0][0]) < win:
        _steady_since = None
        return {"steady": False, "steady_duration_s": 0, "detail": None}

    if alg_settings["steady"] == "ci":
        return _update_steady_ci(now, p_in_pts, p_out_pts, q_pts)

    slope_pin, _, sd_pin = linreg(p_in_pts)
    slope_pout, _, sd_pout = linreg(p_out_pts)
    slope_q, _, sd_q = linreg(q_pts)
    if None in (slope_pin, slope_pout, slope_q):
        _steady_since = None
        return {"steady": False, "steady_duration_s": 0, "detail": None}

    ok_pin = abs(slope_pin * 60) < STEADY_SLOPE_THRESH_BAR_MIN and sd_pin < STEADY_SD_THRESH_BAR
    ok_pout = abs(slope_pout * 60) < STEADY_SLOPE_THRESH_BAR_MIN and sd_pout < STEADY_SD_THRESH_BAR
    ok_q = abs(slope_q * 60) < STEADY_FLOW_SLOPE_THRESH and sd_q < STEADY_FLOW_SD_THRESH
    steady = ok_pin and ok_pout and ok_q

    if steady:
        if _steady_since is None:
            _steady_since = now
    else:
        _steady_since = None

    duration = (now - _steady_since) if _steady_since is not None else 0
    return {
        "steady": steady,
        "steady_duration_s": round(duration, 1),
        "detail": {
            "p_in_slope_bar_min": round(slope_pin * 60, 5), "p_in_resid_sd_bar": round(sd_pin, 5),
            "p_out_slope_bar_min": round(slope_pout * 60, 5), "p_out_resid_sd_bar": round(sd_pout, 5),
            "q_slope_mlmin_per_min": round(slope_q * 60, 3), "q_resid_sd_mlmin": round(sd_q, 3),
        },
    }


def _update_steady_ci(now, p_in_pts, p_out_pts, q_pts):
    """H-1 + H-3: the 95% confidence bound of the slope |slope| + t·SE must be within the threshold (all three signals at once),
    then M-of-N hysteresis (at least M passes in the last N evaluations) keeps a single outlier from resetting the timer."""
    global _steady_since
    res = {}
    ok_all = True
    for name, pts, thr in (("p_in", p_in_pts, STEADY_CI_SLOPE_THRESH),
                           ("p_out", p_out_pts, STEADY_CI_SLOPE_THRESH),
                           ("q", q_pts, STEADY_CI_FLOW_THRESH)):
        slope, se, n = linreg_se(pts)
        if slope is None:
            return {"steady": False, "steady_duration_s": 0, "detail": None}
        bound = (abs(slope) + _t975(n - 2) * se) * 60          # per minute
        ok = bound < thr
        ok_all = ok_all and ok
        res[f"{name}_slope_per_min"] = round(slope * 60, 6)
        res[f"{name}_ci_bound_per_min"] = round(bound, 6) if math.isfinite(bound) else None
        res[f"{name}_ok"] = ok
        res[f"{name}_thresh_per_min"] = thr
    with _buf_lock:
        _steady_hist.append(ok_all)
        passed = sum(1 for x in _steady_hist if x)
        full = len(_steady_hist) >= _steady_hist.maxlen
    steady = full and passed >= STEADY_MOFN_M
    if steady:
        if _steady_since is None:
            _steady_since = now
    else:
        _steady_since = None
    res["m_of_n"] = f"{passed}/{len(_steady_hist)} (need {STEADY_MOFN_M}/{STEADY_MOFN_N})"
    return {
        "steady": steady,
        "steady_duration_s": round((now - _steady_since) if _steady_since is not None else 0, 1),
        "detail": res,
        "method": "ci",
    }


def update_trend(now, tmp_bar, R_value):
    """dTMP/dt (bar/min, in-phase regression), second derivative d²TMP/dt², and dR/dt."""
    with _buf_lock:
        _tmp_buf.append((now, tmp_bar))
        _trim(_tmp_buf, now, D2_WINDOW_S)
        recent = [(t, v) for t, v in _tmp_buf if now - t <= TREND_WINDOW_S]
    slope, _, _ = linreg(recent)
    dtmp_dt = slope * 60 if slope is not None else None  # bar/min

    d2tmp_dt2 = None
    if alg_settings["curvature"] == "quadfit":
        # H-8: fit a quadratic directly to TMP within D2_WINDOW_S; 2a in bar/s² -> (bar/min)/min, multiply by 3600
        with _buf_lock:
            tmp_pts = list(_tmp_buf)
        k = quadfit_second_derivative(tmp_pts)
        d2tmp_dt2 = k * 3600.0 if k is not None else None
    elif dtmp_dt is not None:
        with _buf_lock:
            _dtdt_buf.append((now, dtmp_dt))
            _trim(_dtdt_buf, now, D2_WINDOW_S)
            dtdt_pts = list(_dtdt_buf)
        slope2, _, _ = linreg(dtdt_pts)
        d2tmp_dt2 = slope2 * 60 if slope2 is not None else None

    dR_dt = None
    if R_value is not None:
        with _buf_lock:
            _R_buf.append((now, R_value))
            _trim(_R_buf, now, TREND_WINDOW_S)
            r_pts = list(_R_buf)
        slope_r, _, _ = linreg(r_pts)
        dR_dt = slope_r * 60 if slope_r is not None else None

    return {
        "dtmp_dt_bar_per_min": round(dtmp_dt, 5) if dtmp_dt is not None else None,
        "d2tmp_dt2": round(d2tmp_dt2, 6) if d2tmp_dt2 is not None else None,
        "d_dp_ratio_dt_per_min": round(dR_dt, 5) if dR_dt is not None else None,
    }


# ---- Baseline (used for R / ΔP relative alerts) ----
_baseline_lock = threading.Lock()
baseline = {
    "R_bar_per_mlmin": None, "delta_p_bar": None, "tmp_bar": None,
    "captured_at": None, "source": None,  # source: "click" | "manual" | "cleared"
}
_last_derived = {}
_last_trend = {}
_last_steady = {}


def handle_capture_baseline(client, data):
    with _baseline_lock:
        baseline["R_bar_per_mlmin"] = _last_derived.get("R_bar_per_mlmin")
        baseline["delta_p_bar"] = _last_derived.get("delta_p_bar")
        baseline["tmp_bar"] = _last_derived.get("tmp_bar")
        baseline["captured_at"] = time.time()
        baseline["source"] = "click"
        snap = dict(baseline)
    ui.send_message("baseline_captured", snap)
    calib_remember("baseline", {k: snap.get(k) for k in
                                ("R_bar_per_mlmin", "delta_p_bar", "tmp_bar")}, source="measured")


def handle_set_manual_baseline(client, data):
    """Manually enter baseline values. Any subset may be given; fields not given keep their current values."""
    data = data or {}
    updated_any = False
    with _baseline_lock:
        for key in ("R_bar_per_mlmin", "delta_p_bar", "tmp_bar"):
            if key in data and data[key] not in (None, ""):
                try:
                    baseline[key] = float(data[key])
                    updated_any = True
                except (TypeError, ValueError):
                    pass
        if updated_any:
            baseline["captured_at"] = time.time()
            baseline["source"] = "manual"
        snap = dict(baseline)
    ui.send_message("baseline_captured", snap)
    if updated_any:
        calib_remember("baseline", {k: snap.get(k) for k in
                                    ("R_bar_per_mlmin", "delta_p_bar", "tmp_bar")}, source="manual")


def handle_clear_baseline(client, data):
    with _baseline_lock:
        baseline.update({"R_bar_per_mlmin": None, "delta_p_bar": None, "tmp_bar": None,
                         "captured_at": None, "source": "cleared"})
        snap = dict(baseline)
    ui.send_message("baseline_captured", snap)
    with _calib_lock:
        calibration_saved.pop("baseline", None)
        calibration_source.pop("baseline", None)
        _write_calibration_file()
    push_calibration_state()


ui.on_message("capture_baseline", handle_capture_baseline)
ui.on_message("set_manual_baseline", handle_set_manual_baseline)
ui.on_message("clear_baseline", handle_clear_baseline)


def derive_loop():
    """Every second, take the latest pressure + flow, compute derived parameters/trend/steady state/alerts, and push to the frontend.
    The actual computation lives in _derive_once(); this only handles the timing and "one failed round must not take down the whole loop"."""
    while True:
        time.sleep(1.0)
        try:
            _derive_once()
        except Exception:
            print(f"[derive] this round failed, skipping and continuing:\n{traceback.format_exc()}")


def _derive_once():
    global _last_derived, _last_trend, _last_steady
    if True:   # Keep one indentation level so the code below is identical to the original while-loop body
        now = time.monotonic()

        with _pressure_lock:
            if alg_settings["analysis_source"] == "raw":
                # F-1: analysis path uses mean_raw before low-pass filtering (EMA kept only for display)
                ch = latest_pressure["channels"]
                pf = {"feed": ch["feed"]["mean_raw"], "retentate": ch["retentate"]["mean_raw"],
                      "permeate": ch["permeate"]["mean_raw"], "tmp": latest_pressure["tmp"]["mean_raw"]}
            else:
                pf = dict(latest_pressure["filtered"])
            tmp_peak_trough = dict(latest_pressure["tmp"])
            p_fresh = (time.time() - (latest_pressure.get("ts") or 0)) < 3.0
        flow_fresh = not latest_flow.get("stale") and (time.time() - (latest_flow.get("ts") or 0)) < 3.0
        q_feed = latest_flow["flow"] if flow_fresh else None     # v5.0: when flow data is stale, do not compute derived parameters from old values
        with _hfm_lock:
            hst = dict(hfm_state)
        if not p_fresh:
            return                                              # No new pressure data: do not push stale derived parameters

        p_in_bar = pf["feed"]
        p_out_bar = pf["retentate"]
        p_perm_bar = pf["permeate"]

        derived = compute_hfm(p_in_bar, p_out_bar, p_perm_bar, q_feed, hfm_tmp_out_min_kpa(), hst)
        _last_derived = derived

        if q_feed is not None:
            steady_info = update_steady(now, p_in_bar, p_out_bar, q_feed)
        else:
            _reset_analysis_buffers()
            steady_info = {"steady": False, "steady_duration_s": 0, "detail": None}
        # v5.0: initial L_p is captured only at "steady state" (v4.x recorded it the first time it was computable, possibly during pump start-up transients)
        if derived.get("lp_lmh_bar") is not None and hst.get("lp_initial") is None and steady_info.get("steady"):
            with _hfm_lock:
                hfm_state.update(lp_initial=derived["lp_lmh_bar"], lp_initial_at=time.time())
            _hfm_save()
            raw_event("lp_initial", {"lp_lmh_bar": derived["lp_lmh_bar"]})
            push_hfm_state()
        trend = update_trend(now, derived["tmp_bar"], derived.get("dp_ratio"))
        _last_trend = trend
        _last_steady = steady_info

        with _baseline_lock:
            baseline_snapshot = dict(baseline)

        perm_open = permeate_path_open()
        alerts = compute_hfm_alerts(derived, hst, tmp_peak_trough, perm_open)
        # v3: while the pinch valve is closed / within the settling period after release, fouling-trend alerts are suspended (taking samples inherently makes ΔP/R change sharply)
        suppressed = []
        if valve_alerts_suppressed():
            suppressed = [a["code"] for a in alerts if a["code"] in VALVE_SUPPRESSED_ALERTS]
            alerts = [a for a in alerts if a["code"] not in VALVE_SUPPRESSED_ALERTS]
        alerts = ph_valve_system_alerts() + alerts

        ui.send_message("derived_update", {
            "ts": time.time(),
            "config_version": CONFIG_VERSION,
            "constants_version": CONSTANTS_VERSION,
            "alg_profile": alg_profile_string(),
            "constants_from_file": CONSTANTS_FROM_FILE,
            "provisional_constants": PROVISIONAL_CONSTANTS,
            "derived": derived,
            "trend": trend,
            "steady": steady_info,
            "baseline": baseline_snapshot,
            "alerts": alerts,
            "suppressed_alerts": suppressed,
            "pressure_pulsation": tmp_peak_trough,
            "hfm": hst,
            # v5.1: whether the permeate path is open to the outside (pinch valve closed or Q_perm declared).
            # The frontend uses this to decide whether the TMP_out tile shows "monitoring" or "expected value for a closed system".
            "perm_open": perm_open,
        })


# ============================= Saving and restoring calibration values =============================
# v5.0: OD600 blank, pressure zero, and path-length factor are all stored on the Linux side (calibration_state.json), and conversion also happens on the Linux side,
# so an MCU restart loses no calibration values. The MCU only needs the "pressure zero used by the safety interlock", which is pushed from here at boot / restart.
# Source tags:
#   measured  measured on site
#   manual    entered manually / imported from a calibration file -> zero-type values (OD blank, pressure zero) keep showing a yellow notice until re-calibrated on site
# (v4.x "restored" is no longer needed: the values already live on the Linux side, and an App restart that reuses the saved file keeps the original source)
CALIBRATION_STATE_PATH = os.path.join(_SEARCH_DIR, "calibration_state.json")
_calib_lock = threading.Lock()

CALIB_ITEMS = ("od600_blank", "pressure_offsets", "od600_path_length_factor", "baseline")
ATTENTION_ITEMS = ("od600_blank", "pressure_offsets")
calibration_source = {}     # item -> {"source": ..., "at": epoch}
calibration_saved = {}      # item -> saved value (dict)

_mcu_last_uptime_ms = None


def _load_calibration_file():
    try:
        with open(CALIBRATION_STATE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (FileNotFoundError, json.JSONDecodeError, OSError) as e:
        if not isinstance(e, FileNotFoundError):
            print(f"[calib] reading {CALIBRATION_STATE_PATH} failed ({e}), treating as no saved state")
    return {}


def _write_calibration_file():
    tmp = CALIBRATION_STATE_PATH + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"saved_at": time.time(), "items": calibration_saved, "source": calibration_source}, f,
                      ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, CALIBRATION_STATE_PATH)
    except OSError as e:
        print(f"[calib] writing {CALIBRATION_STATE_PATH} failed: {e}")


def calib_remember(item, value, source):
    if item not in CALIB_ITEMS or value is None:
        return
    with _calib_lock:
        calibration_saved[item] = dict(value, saved_at=time.time())
        calibration_source[item] = {"source": source, "at": time.time()}
        _write_calibration_file()
    push_calibration_state()


def push_calibration_state(client=None):
    with _calib_lock:
        saved = {k: dict(v) for k, v in calibration_saved.items()}
        source = {k: dict(v) for k, v in calibration_source.items()}
    needs_attention = [k for k, v in source.items()
                       if k in ATTENTION_ITEMS and v.get("source") in ("restored", "manual")]
    ui.send_message("calibration_state", {
        "saved": saved, "source": source, "needs_attention": needs_attention,
        "state_file": CALIBRATION_STATE_PATH,
    }, client)


def read_mcu_calibration():
    """Currently active calibration values (on the Linux side in v5.0), plus the zero actually used by the MCU safety interlock."""
    b = _od_blank_view()
    out = {
        "od600_blank": ({"ratio": round(b["ratio"], 6), "lux_sample": round(b["s"], 3), "lux_ref": round(b["r"], 3)}
                        if b["blank_set"] else None),
        "pressure_offsets": dict(pressure_offsets),
        "od600_path_length_factor": {"value": od_cfg["plf"]},
        "mcu_interlock_offsets": None,
    }
    try:
        parts = Bridge.call("get_pressure_offsets", "").split(",")
        out["mcu_interlock_offsets"] = {"feed": float(parts[0]), "retentate": float(parts[1]),
                                        "permeate": float(parts[2])}
    except Exception:
        pass
    return out


def _apply_blank_record(rec):
    """Saved od600_blank -> od_blank. Use per_alg if present; if there is only a ratio (manual / v4.x save), apply it to all algorithms."""
    per = rec.get("per_alg")
    if not per:
        ratio = float(rec.get("ratio") or 0.0)
        if ratio <= 0:
            return False
        per = {a: {"s": float(rec.get("lux_sample") or 0.0), "r": float(rec.get("lux_ref") or 0.0),
                   "ratio": ratio} for a in OD_ALGS}
    with _od_lock:
        od_blank.update({"blank_set": True, "per_alg": {a: dict(v) for a, v in per.items()},
                         "at": rec.get("saved_at")})
    return True


def apply_saved_calibration(items=None, source=None, client=None, quiet=False):
    """Apply saved calibration values on the Linux side (pressure zero is pushed to the MCU separately). source=None means keep the source stored in the file.
    quiet=True: used at App load; does not call the MCU or send web UI messages (neither side is ready yet)."""
    with _calib_lock:
        saved = {k: dict(v) for k, v in calibration_saved.items()}
    targets = items or list(CALIB_ITEMS)
    applied, failed = [], []
    if "od600_blank" in targets and saved.get("od600_blank"):
        (applied if _apply_blank_record(saved["od600_blank"]) else failed).append("od600_blank")
    if "pressure_offsets" in targets and saved.get("pressure_offsets"):
        o = saved["pressure_offsets"]
        try:
            set_pressure_offsets_local({ch: float(o[ch]) for ch in PRESSURE_CHANNELS}, source or "restored")
            applied.append("pressure_offsets")
            if not quiet and not push_offsets_to_mcu():
                print("[calib] pressure zero applied on Linux, but push to MCU (safety interlock) failed, will retry")
        except (KeyError, TypeError, ValueError):
            failed.append("pressure_offsets")
    if "od600_path_length_factor" in targets and saved.get("od600_path_length_factor"):
        try:
            od_cfg["plf"] = float(saved["od600_path_length_factor"]["value"])
            applied.append("od600_path_length_factor")
        except (KeyError, TypeError, ValueError):
            failed.append("od600_path_length_factor")
    if "baseline" in targets and saved.get("baseline"):
        b = saved["baseline"]
        with _baseline_lock:
            for key in ("R_bar_per_mlmin", "delta_p_bar", "tmp_bar"):
                if b.get(key) is not None:
                    baseline[key] = b[key]
            baseline["captured_at"] = time.time()
            baseline["source"] = source or "restored"
            snap = dict(baseline)
        if not quiet:
            ui.send_message("baseline_captured", snap)
        applied.append("baseline")
    if applied and source:
        with _calib_lock:
            for item in applied:
                calibration_source[item] = {"source": source, "at": time.time()}
            _write_calibration_file()
    if applied:
        print(f"[calib] applied calibration: {', '.join(applied)}" + (f" (source {source})" if source else ""))
    if failed:
        print(f"[calib] failed to apply: {', '.join(failed)}")
    if quiet:
        return applied
    if applied:
        push_od_blank()
        od_recompute_latest()
    push_calibration_state(client)
    ui.send_message("calibration_applied", {"ok": bool(applied) and not failed, "applied": applied,
                                            "failed": failed, "source": source or "saved"}, client)
    return applied


def check_mcu_reboot(uptime_ms):
    """A smaller uptime reported by get_diag = the MCU has restarted. v5.0: calibration values are unaffected (they live on the Linux side);
    just push back the safety-interlock zero, OD settings, pinch valve, and pump boost, and resume the pumps."""
    global _mcu_last_uptime_ms
    prev = _mcu_last_uptime_ms
    _mcu_last_uptime_ms = uptime_ms
    if prev is None or uptime_ms >= prev:
        return
    print(f"[mcu] MCU reboot detected (uptime {prev} -> {uptime_ms} ms), re-pushing settings and restoring pump...")
    raw_event("mcu_reboot", {"uptime_prev_ms": prev, "uptime_ms": uptime_ms})
    try:
        restore_ph_valve_state(reason="restored")
    except Exception as e:
        print(f"[mcu] restore after MCU reboot failed: {e}")
    pump_restored = mcu_restore_pump_after_reboot()
    mcu_reboot_times.append(time.time())
    ui.send_message("mcu_rebooted", {"ts": time.time(), "restored": True, "pump_restored": pump_restored})
    push_mcu_status()


_startup_calib_done = False


def startup_calibration_sync():
    """App startup: apply saved calibration values (keeping the original source) and push the pressure zero to the MCU. Retry later if the MCU is not ready yet."""
    global _startup_calib_done, _mcu_last_uptime_ms
    if _startup_calib_done:
        return True
    try:
        _mcu_last_uptime_ms = int(float(Bridge.call("get_diag", "").split(",")[4]))
    except Exception:
        print("[calib] MCU not ready, will push pressure zero to MCU later")
        return False
    if not push_offsets_to_mcu():
        return False
    _startup_calib_done = True
    return True


# ---- Manual entry ----
def handle_set_manual_blank(client, data):
    """Manually set the OD600 blank baseline: give a ratio, or two lux values (sample / reference). Applied to all algorithms."""
    data = data or {}
    try:
        lux_sample = float(data["lux_sample"]) if data.get("lux_sample") not in (None, "") else None
        lux_ref = float(data["lux_ref"]) if data.get("lux_ref") not in (None, "") else None
        ratio = float(data["ratio"]) if data.get("ratio") not in (None, "") else None
    except (TypeError, ValueError):
        ui.send_message("calibration_applied",
                        {"ok": False, "error": "Invalid number format", "applied": [], "failed": ["od600_blank"]}, client)
        return
    if ratio is None and lux_sample is not None and lux_ref is not None and lux_ref > 1e-9:
        ratio = lux_sample / lux_ref
    if ratio is None or ratio <= 0:
        ui.send_message("calibration_applied", {
            "ok": False, "applied": [], "failed": ["od600_blank"],
            "error": "Enter blank ratio, or both sample and reference lux values (reference must not be 0)",
        }, client)
        return
    rec = {"ratio": round(ratio, 6), "lux_sample": round(lux_sample or 0.0, 3), "lux_ref": round(lux_ref or 0.0, 3)}
    _apply_blank_record(rec)
    calib_remember("od600_blank", rec, source="manual")
    raw_event("od600_blank", dict(rec, source="manual"))
    push_od_blank()
    od_recompute_latest()
    ui.send_message("calibration_applied",
                    {"ok": True, "applied": ["od600_blank"], "failed": [], "source": "manual"}, client)


def handle_clear_blank(client, data):
    with _od_lock:
        od_blank.update({"blank_set": False, "per_alg": {}, "at": None})
    with _calib_lock:
        calibration_saved.pop("od600_blank", None)
        calibration_source.pop("od600_blank", None)
        _write_calibration_file()
    raw_event("od600_blank_cleared", None)
    push_od_blank()
    od_recompute_latest()
    push_calibration_state()


def handle_set_pressure_offsets(client, data):
    """Manually set the zeros (bar) of the three pressure channels."""
    data = data or {}
    try:
        offsets = {ch: float(data[ch]) for ch in PRESSURE_CHANNELS}
    except (TypeError, ValueError, KeyError):
        ui.send_message("calibration_applied", {
            "ok": False, "applied": [], "failed": ["pressure_offsets"],
            "error": "All three channel offsets are required and must be numeric",
        }, client)
        return
    if any(abs(v) > 2.0 for v in offsets.values()):
        ui.send_message("calibration_applied", {"ok": False, "applied": [], "failed": ["pressure_offsets"],
                                                "error": "offset exceeds ±2 bar, check the value"}, client)
        return
    set_pressure_offsets_local(offsets, "manual")
    mcu_ok = push_offsets_to_mcu()
    calib_remember("pressure_offsets", {k: round(v, 6) for k, v in offsets.items()}, source="manual")
    ui.send_message("calibration_applied",
                    {"ok": True, "applied": ["pressure_offsets"], "failed": [], "source": "manual",
                     "warning": None if mcu_ok else "Applied on Linux, but push to MCU safety interlock failed"}, client)


def handle_get_calibration_state(client, data):
    push_calibration_state(client)


def handle_read_mcu_calibration(client, data):
    ui.send_message("mcu_calibration", read_mcu_calibration(), client)


def handle_apply_saved_calibration(client, data):
    items = (data or {}).get("items") or None
    apply_saved_calibration(items=items, source="restored", client=client)


ui.on_message("set_manual_blank", handle_set_manual_blank)
ui.on_message("clear_blank", handle_clear_blank)
ui.on_message("set_pressure_offsets", handle_set_pressure_offsets)
ui.on_message("get_calibration_state", handle_get_calibration_state)
ui.on_message("read_mcu_calibration", handle_read_mcu_calibration)
ui.on_message("apply_saved_calibration", handle_apply_saved_calibration)


# ============================= Aggregated sampling (median / mean) =============================
# Pressure arrives at 5Hz, flow at 1Hz, OD600 by default once every 30 s -- the three signals run at very different rates, and
# pressure/flow already carry the periodic pulsation of the peristaltic pump, so per-sample instantaneous values are of little use for logging and comparison.
#
# This layer collects pressure and flow within a "sampling window" (default 30 s, adjustable from the UI), and at the end of each window
# takes one median or mean, used as:
#   1. the values on the pressure/flow cards and charts (same cadence as OD600, so the three are always aligned)
#   2. one row of the recording CSV (one row per window)
# The sampling duration is shared by all three: changing it also sets the OD600 measurement interval (stored on the MCU) to the same value.
#
# Median vs mean:
#   median - most robust to bubbles and single noise spikes; one or two outliers do not affect the result at all (default)
#   mean   - more sensible for periodic pump-induced pulsation; peaks and troughs cancel out, physically closer to
#            "the average pressure over this period"
#
# Important: this layer does NOT affect the safety-related fast path. TMP instantaneous peak/trough alerts and collapse
# pressure protection still use the raw statistics the MCU sends every 200ms (see derive_loop / compute_alerts),
# and are not masked by the 30 s average -- that is exactly the problem high-rate sampling was introduced to solve.
AGG_METHODS = ("median", "mean", "trimmed10", "hodges_lehmann")   # v3.7: G-2 / G-3

agg_settings = {
    "window_sec": float(CONST.get("aggregate_window_sec", 30.0)),
    "method": str(CONST.get("aggregate_method", "median")),
}
if agg_settings["method"] not in AGG_METHODS:
    agg_settings["method"] = "median"
AGG_MIN_WINDOW_SEC = 5.0
AGG_MAX_WINDOW_SEC = 86400.0

_agg_lock = threading.Lock()
_agg_window_start = time.monotonic()
_agg_window_start_wall = time.time()
_agg_window_index = 0


def _new_agg_buffer():
    return {
        "feed": [], "retentate": [], "permeate": [], "tmp": [],
        # Also collect the raw mean before low-pass filtering, so the frontend "filtered / raw" toggle keeps working
        "feed_raw": [], "retentate_raw": [], "permeate_raw": [], "tmp_raw": [],
        "tmp_peak": [], "tmp_trough": [], "cycle_hz": [], "pout_trough_ps": [],
        "flow": [], "freq": [], "total": None,
        "flow_pulses": 0, "flow_win_ms": 0, "p_dropped0": p_stats["dropped_batches"],
        # v3: pH (1Hz) and pinch valve (1Hz, 1=closed/jog 0=open)
        "ph": [], "ph_temp": [], "valve_closed": [],
        # v6.0: max of the three channels (the quantity pressure protection watches), base dosing, protection latch, two new valves
        "pmax": [], "base_pulses": 0, "base_ms": 0, "ptrip": 1 if latest_safety.get("ptrip") else 0,
        "shell_state": None, "feed_state": None,
    }


_agg_buf = _new_agg_buffer()
latest_aggregate = None   # most recent aggregate result (re-sent when a new client connects)


def _aggregate(values):
    """Reduce a list of instantaneous values to one representative value using the currently configured method. Returns None for an empty list."""
    if not values:
        return None
    method = agg_settings["method"]
    if method == "mean":
        return sum(values) / len(values)
    s = sorted(values)
    n = len(s)
    if method == "trimmed10":
        # G-2: trim 10% from each end then average (a compromise between robustness and efficiency, ~94% efficiency under normality)
        k = int(n * 0.10)
        core = s[k:n - k] if n - 2 * k > 0 else s
        return sum(core) / len(core)
    if method == "hodges_lehmann":
        return _hodges_lehmann(s)
    # median: computed here to avoid an extra dependency on the statistics module
    mid = n // 2
    return s[mid] if n % 2 else 0.5 * (s[mid - 1] + s[mid])


HL_MAX_POINTS = 400   # for very long sampling durations (thousands of samples), first decimate evenly to 400 samples before computing, to avoid O(n^2) blowup


def _hodges_lehmann(sorted_vals):
    """G-3: median of all pairwise averages (Walsh averages, i <= j). 95.5% efficiency under normality, 29% breakdown point."""
    v = sorted_vals
    n = len(v)
    if n > HL_MAX_POINTS:
        step = n / HL_MAX_POINTS
        v = [v[int(i * step)] for i in range(HL_MAX_POINTS)]
        n = len(v)
    w = sorted((v[i] + v[j]) * 0.5 for i in range(n) for j in range(i, n))
    m = len(w)
    return w[m // 2] if m % 2 else 0.5 * (w[m // 2 - 1] + w[m // 2])


def _window_stats(values):
    """G-4: SD / IQR / min / max within the window (independent of the aggregation method; used afterwards to judge whether the representative value is trustworthy)."""
    if not values:
        return {"sd": None, "iqr": None, "min": None, "max": None}
    s = sorted(values)
    n = len(s)
    mean = sum(s) / n
    sd = math.sqrt(sum((x - mean) ** 2 for x in s) / (n - 1)) if n > 1 else 0.0

    def q(p):
        pos = p * (n - 1)
        lo = int(math.floor(pos))
        hi = min(lo + 1, n - 1)
        return s[lo] + (s[hi] - s[lo]) * (pos - lo)
    return {"sd": sd, "iqr": q(0.75) - q(0.25), "min": s[0], "max": s[-1]}


def agg_push_pressure(snapshot):
    with _agg_lock:
        f = snapshot["filtered"]
        _agg_buf["feed"].append(f["feed"])
        _agg_buf["retentate"].append(f["retentate"])
        _agg_buf["permeate"].append(f["permeate"])
        _agg_buf["tmp"].append(f["tmp"])
        c = snapshot["channels"]
        _agg_buf["feed_raw"].append(c["feed"]["mean_raw"])
        _agg_buf["retentate_raw"].append(c["retentate"]["mean_raw"])
        _agg_buf["permeate_raw"].append(c["permeate"]["mean_raw"])
        _agg_buf["tmp_raw"].append(snapshot["tmp"]["mean_raw"])
        # peaks/troughs are not medians: the "worst single instance" in this window is the meaningful safety information
        _agg_buf["tmp_peak"].append(snapshot["tmp"]["peak"])
        _agg_buf["tmp_trough"].append(snapshot["tmp"]["trough"])
        _agg_buf["pmax"].append(max(c[ch]["peak"] for ch in ("feed", "retentate", "permeate")))
        _agg_buf["cycle_hz"].append(snapshot["channels"]["feed"]["cycle_freq_hz"])
        v = snapshot.get("tmp_out_inst_min_kpa")       # v5.0: P_out - P_s at the same instant
        _agg_buf["pout_trough_ps"].append(
            v if v is not None else (c["retentate"]["trough"] - c["permeate"]["mean_raw"]) * 100.0)


def agg_push_flow(freq, flow, total, pulses=None, win_ms=None):
    with _agg_lock:
        _agg_buf["flow"].append(flow)
        _agg_buf["freq"].append(freq)
        _agg_buf["total"] = total   # the cumulative total is a monotonically increasing count; take the value at window end, not the average
        if pulses is not None and win_ms:
            _agg_buf["flow_pulses"] += int(pulses)
            _agg_buf["flow_win_ms"] += int(win_ms)


def agg_push_ph(d):
    if d.get("ph") is None:
        return
    with _agg_lock:
        _agg_buf["ph"].append(d["ph"])
        if d.get("temp_c") is not None:
            _agg_buf["ph_temp"].append(d["temp_c"])


def agg_push_valve(d):
    with _agg_lock:
        _agg_buf["valve_closed"].append(1.0 if d.get("cmd") in ("closed", "jog") else 0.0)


def agg_reset_window():
    """Reset the window (called on recording start, pause/resume, settings change) so the next row covers a clean full period."""
    global _agg_buf, _agg_window_start, _agg_window_start_wall
    with _agg_lock:
        _agg_buf = _new_agg_buffer()
        _agg_window_start = time.monotonic()
        _agg_window_start_wall = time.time()


def _build_aggregate_row(partial=False):
    """Drain the current window buffer and compute one aggregated row. Returns None if there are no pressure samples."""
    global _agg_buf, _agg_window_start, _agg_window_start_wall, _agg_window_index

    with _agg_lock:
        buf = _agg_buf
        t_start_wall = _agg_window_start_wall
        window_actual = time.monotonic() - _agg_window_start
        _agg_buf = _new_agg_buffer()
        _agg_window_start = time.monotonic()
        _agg_window_start_wall = time.time()

    if not buf["feed"]:
        return None

    _agg_window_index += 1

    # v3.7 F-1 / G-1: when the analysis source = raw, the CSV and derived parameters aggregate mean_raw (before low-pass filtering)
    src = "" if alg_settings["analysis_source"] == "ema" else "_raw"
    feed = _aggregate(buf["feed" + src])
    retentate = _aggregate(buf["retentate" + src])
    permeate = _aggregate(buf["permeate" + src])
    tmp = _aggregate(buf["tmp" + src])
    # v5.0: window flow = total pulses in window / total time (exact average, without the +/-1 pulse quantization of a 1 s gate);
    #       at 130 mL/min the median of per-second values can only be one of two values, 116 or 140 (documentation section 4.1)
    if buf["flow_win_ms"] > 0:
        flow = buf["flow_pulses"] / (buf["flow_win_ms"] / 60000.0) / FLOW_PULSES_PER_LITER * 1000.0
        freq = buf["flow_pulses"] / (buf["flow_win_ms"] / 1000.0)
    else:
        flow = _aggregate(buf["flow"])
        freq = _aggregate(buf["freq"])
    st_tmp = _window_stats(buf["tmp" + src])      # G-4
    st_feed = _window_stats(buf["feed" + src])
    st_flow = _window_stats(buf["flow"])

    # Derived parameters are recomputed from the "aggregated" pressure and flow, rather than averaging per-second derived values.
    # For ratio quantities like R = dP_net / Q, averaging numerator and denominator before dividing is not the same as dividing then averaging;
    # the former is the true representative value for this period.
    derived = compute_hfm(feed, retentate, permeate, flow if flow is not None else 0.0,
                          min(buf["pout_trough_ps"]) if buf["pout_trough_ps"] else None)

    with _od_lock:
        od = dict(latest_od600)
    with _pump_lock:
        pump = dict(pump_state)
    trend = dict(_last_trend)
    steady_info = dict(_last_steady)
    with _ph_lock:
        ph_now = dict(latest_ph)
    with _valve_lock:
        valve_now = dict(latest_valve)
    ph_agg = _aggregate(buf["ph"])
    ph_temp_agg = _aggregate(buf["ph_temp"])
    vc = buf["valve_closed"]

    return {
        "window_index": _agg_window_index,
        "ts_start": t_start_wall,
        "ts_end": time.time(),
        "window_sec": round(window_actual, 2),
        "partial": partial,
        "agg_method": agg_settings["method"],
        "n_samples_pressure": len(buf["feed"]),
        "n_samples_flow": len(buf["flow"]),
        "flow_mlmin": flow,
        "flow_freq_hz": freq,
        "flow_total_ml": buf["total"] if buf["total"] is not None else latest_flow["total"],
        "pressure_feed_bar": feed,
        "pressure_retentate_bar": retentate,
        "pressure_permeate_bar": permeate,
        "pressure_tmp_bar": tmp,
        # for frontend display switching (the CSV only writes the low-pass-filtered set above)
        "pressure_filtered": {"feed": feed, "retentate": retentate, "permeate": permeate, "tmp": tmp},
        "pressure_raw": {
            "feed": _aggregate(buf["feed_raw"]), "retentate": _aggregate(buf["retentate_raw"]),
            "permeate": _aggregate(buf["permeate_raw"]), "tmp": _aggregate(buf["tmp_raw"]),
        },
        # worst peak/trough within the window (not the median), for checking afterwards whether this period crossed a safety line
        "pressure_tmp_peak_bar": max(buf["tmp_peak"]) if buf["tmp_peak"] else None,
        "pressure_tmp_trough_bar": min(buf["tmp_trough"]) if buf["tmp_trough"] else None,
        "pressure_cycle_freq_hz": _aggregate(buf["cycle_hz"]),
        "od600_au": od.get("od600"),
        "od600_lux_sample": od.get("lux_sample"),
        "od600_lux_ref": od.get("lux_ref"),
        "od600_bubble_pct": od.get("bubble_pct"),
        "od600_valid": od.get("valid"),
        "od600_blank_set": od.get("blank_set"),
        "od600_age_s": round(time.time() - od["ts"], 1) if od.get("ts") else None,
        "od600_meas_seq": od.get("meas_seq"),
        "od600_alg": od.get("od_alg"), "od600_bubble_frac_pct": od.get("bubble_frac_pct"),
        "od600_flags": "|".join(od.get("flag_list") or []),
        # v5.1 gate layer: od600_au keeps the estimator's raw output (not overwritten); below are the gate's verdicts and reported values
        "od600_reported": od.get("od600_reported"),
        "od600_p90": od.get("od_p90"),
        "od600_gate_accepted": od.get("gate_accepted"),
        "od600_gate_reason": od.get("gate_reason"),
        "od600_gate_d_disc": (od.get("gate_detail") or {}).get("d_disc"),
        "od600_gate_d_jump": (od.get("gate_detail") or {}).get("d_jump"),
        "od600_gate_pending": (od.get("gate_detail") or {}).get("pending_n"),
        **(lambda g: {"od600_mu_per_h": g.get("mu_per_h"), "od600_mu_r2": g.get("r2")})(growth.status(time.time())),
        **{f"od_{a}": ((od.get("algs") or {}).get(a) or {}).get("od") for a in OD_ALGS},
        "flow_pulses": buf["flow_pulses"],
        "p_raw_dropped": p_stats["dropped_batches"] - buf["p_dropped0"],
        "raw_dir": os.path.basename(raw_session.folder) if raw_session is not None else "",
        "pump_pwm": pump.get("pwm"),
        "pump_forward": pump.get("forward"),
        # v3: pH / pinch valve
        "ph": round(ph_agg, 3) if ph_agg is not None else None,
        "ph_temp_c": round(ph_temp_agg, 2) if ph_temp_agg is not None else None,
        "temp_src": ph_now.get("temp_src") if ph_now.get("ts") else None,   # v3.8
        "ph_state": ph_now.get("state") if ph_now.get("ts") else None,
        "valve_state": valve_now.get("cmd") if valve_now.get("ts") else None,
        # fraction (0~1) of this window during which the pinch valve was not "open"; used in post-analysis to exclude rows recorded while sampling
        "valve_closed_frac": round(sum(vc) / len(vc), 3) if vc else None,
        "valve_pos": valve_now.get("pos") if valve_now.get("ts") else None,
        # v6.0
        "shell_valve": buf["shell_state"] or _av_state_now("shell"),
        "feed_valve": buf["feed_state"] or _av_state_now("feed"),
        "feed_pump_pwm": latest_base.get("feed_pwm") if latest_base.get("ts") else None,
        "feed_pump_forward": (1 if latest_base.get("feed_fwd") else 0) if latest_base.get("ts") else None,
        "base_pulses": buf["base_pulses"], "base_pulse_ms": buf["base_ms"],
        "ph_ctrl_state": ph_doser.state,
        "ph_target": ph_doser.cfg["target"] if ph_doser.cfg["enabled"] else None,
        "p_trip": 1 if (buf["ptrip"] or latest_safety.get("ptrip")) else 0,
        "p_max_bar": max(buf["pmax"]) if buf["pmax"] else None,
        "delta_p_bar": derived.get("delta_p_bar"),
        # v4: HFM derived parameters (recomputed from aggregated pressure/flow)
        **{k: derived.get(k) for k, _ in HFM_CSV_COLS},
        "dtmp_dt_bar_per_min": trend.get("dtmp_dt_bar_per_min"),
        "d2tmp_dt2": trend.get("d2tmp_dt2"),
        "steady": steady_info.get("steady", ""),
        # v3.7 G-4: dispersion within the window, to judge afterwards whether the representative value is trustworthy and whether noise grows over time
        "tmp_sd_bar": st_tmp["sd"], "tmp_iqr_bar": st_tmp["iqr"],
        "tmp_min_bar": st_tmp["min"], "tmp_max_bar": st_tmp["max"],
        "feed_sd_bar": st_feed["sd"],
        "flow_sd_mlmin": st_flow["sd"], "flow_iqr_mlmin": st_flow["iqr"],
        "flow_min_mlmin": st_flow["min"], "flow_max_mlmin": st_flow["max"],
        "alg_profile": alg_profile_string(),
        "config_version": CONFIG_VERSION,
        "constants_version": CONSTANTS_VERSION,
    }


def push_agg_settings(client=None):
    # next_update_in_sec: how long until the current window ends. A reconnecting browser must receive this value,
    # otherwise it can only assume "window_sec seconds from now", and the countdown will not match the actual update time
    # (e.g. connecting right at the tail of a window, the screen would say 30 more seconds, but it actually updates 2 seconds later).
    remaining = agg_settings["window_sec"] - (time.monotonic() - _agg_window_start)
    ui.send_message("aggregate_settings", {
        "window_sec": agg_settings["window_sec"],
        "method": agg_settings["method"],
        "min_window_sec": AGG_MIN_WINDOW_SEC,
        "max_window_sec": AGG_MAX_WINDOW_SEC,
        "next_update_in_sec": round(max(0.0, remaining), 1),
    }, client)


def handle_set_aggregate_settings(client, data):
    """The sampling duration is shared by all three: besides changing the local aggregation window, also set the MCU's OD600 measurement interval
    to the same value, so the aggregated pressure/flow values and OD600 fall on the same time cadence."""
    data = data or {}
    changed = False

    if data.get("method") in AGG_METHODS:
        agg_settings["method"] = data["method"]
        changed = True

    if data.get("window_sec") not in (None, ""):
        try:
            w = float(data["window_sec"])
        except (TypeError, ValueError):
            w = None
        if w is not None and AGG_MIN_WINDOW_SEC <= w <= AGG_MAX_WINDOW_SEC:
            agg_settings["window_sec"] = w
            changed = True
            push_od_config_to_mcu()

    if changed:
        agg_reset_window()   # settings changed; the current window already mixes in old settings, so just start over
        print(f"[agg] sampling window = {agg_settings['window_sec']}s, aggregation = {agg_settings['method']}")
    push_agg_settings()


def handle_get_aggregate_settings(client, data):
    push_agg_settings(client)


ui.on_message("set_aggregate_settings", handle_set_aggregate_settings)
ui.on_message("get_aggregate_settings", handle_get_aggregate_settings)


# ============================= Chart history (v3.8) =============================
# Charts no longer scroll/clear: all aggregate points since App startup (or since "Reset charts") are kept here, and a newly connected
# web UI (or a refresh) gets the full history at once, compressed onto the chart. When the point count exceeds the limit, adjacent pairs are merged into
# one point (averaged), preserving the shape along the time axis with bounded memory. Data gaps are marked with b=1, and merging never crosses a gap.
# Affects "display" only; the CSV still has the full data, one row per window.
CHART_HIST_MAX = 6000
_chart_lock = threading.Lock()
chart_hist = {"t0": time.time(), "rows": [], "markers": []}


def _chart_point(row, gap_thr):
    pr = row.get("pressure_raw") or {}
    pf = row.get("pressure_filtered") or {}
    pt = {
        "t": round(row.get("ts_end") or time.time(), 2),
        # v5.1: history charts plot the gate's reported value (fall back to the estimator's raw output only when there is no reported value)
        "od": row.get("od600_reported") if row.get("od600_reported") is not None else row.get("od600_au"),
        "od_raw": row.get("od600_au"),
        "flow": row.get("flow_mlmin"), "ph": row.get("ph"),
        "temp": row.get("ph_temp_c"), "vc": row.get("valve_closed_frac"),
        # v4: HFM trend charts (fouling index / L_p / TMP_out)
        "gr": row.get("gamma_ratio"), "dr": row.get("dp_ratio"), "lp": row.get("lp_lmh_bar"),
        "to": row.get("tmp_out_kpa"),
        "pr": {k: pr.get(k) for k in ("feed", "retentate", "permeate", "tmp")},
        "pf": {k: pf.get(k) for k in ("feed", "retentate", "permeate", "tmp")},
    }
    rows = chart_hist["rows"]
    if rows and (pt["t"] - rows[-1]["t"]) > gap_thr:
        pt["b"] = 1
    return pt


def _avg(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return (a + b) / 2.0


def _merge_points(a, b):
    m = {"t": round((a["t"] + b["t"]) / 2.0, 2)}
    for k in ("od", "flow", "ph", "temp", "vc", "gr", "dr", "lp", "to"):
        m[k] = _avg(a.get(k), b.get(k))
    for g in ("pr", "pf"):
        m[g] = {k: _avg((a.get(g) or {}).get(k), (b.get(g) or {}).get(k))
                for k in ("feed", "retentate", "permeate", "tmp")}
    if a.get("b"):
        m["b"] = 1
    return m


def _decimate_chart_rows(rows):
    out, i = [], 0
    while i < len(rows):
        if i + 1 < len(rows) and not rows[i + 1].get("b"):
            out.append(_merge_points(rows[i], rows[i + 1]))
            i += 2
        else:
            out.append(rows[i])
            i += 1
    return out


def chart_hist_add(row):
    gap_thr = max(agg_settings["window_sec"] * 2.5, 5.0)
    with _chart_lock:
        chart_hist["rows"].append(_chart_point(row, gap_thr))
        if len(chart_hist["rows"]) > CHART_HIST_MAX:
            chart_hist["rows"] = _decimate_chart_rows(chart_hist["rows"])


def chart_hist_marker(kind):
    """Draw a vertical marker line on the charts when recording starts/stops/resumes."""
    m = {"t": round(time.time(), 2), "k": kind}
    with _chart_lock:
        chart_hist["markers"].append(m)
        del chart_hist["markers"][:-200]
    try:
        ui.send_message("chart_marker", m)
    except Exception as e:
        print(f"[chart] marker send failed: {e}")


def push_chart_history(client=None):
    with _chart_lock:
        payload = {"t0": chart_hist["t0"], "now": time.time(),
                   "window_sec": agg_settings["window_sec"],
                   "rows": list(chart_hist["rows"]), "markers": list(chart_hist["markers"])}
    if client:
        ui.send_message("chart_history", payload, client)
    else:
        ui.send_message("chart_history", payload)


def handle_chart_reset(client, data):
    """The "Reset charts" button: clear the display history (does not affect CSV/recording), and reset all connected web UIs together."""
    with _chart_lock:
        chart_hist["t0"] = time.time()
        chart_hist["rows"] = []
        chart_hist["markers"] = []
    print("[chart] chart history reset")
    push_chart_history()


def handle_get_chart_history(client, data):
    push_chart_history(client)


ui.on_message("chart_reset", handle_chart_reset)
ui.on_message("get_chart_history", handle_get_chart_history)


def aggregate_loop():
    """Compute aggregate values at the end of each sampling window: broadcast to the frontend, and write a row if recording."""
    global latest_aggregate
    while True:
        time.sleep(0.25)
        try:
            if (time.monotonic() - _agg_window_start) < agg_settings["window_sec"]:
                continue

            row = _build_aggregate_row()
            if row is None:
                # This window received no pressure data at all. That usually means the MCU is not sending on_pressure_update
                # (Bridge down / MCU hung / not finished booting), and what the user sees is a "frozen screen",
                # so we must report it here instead of silently skipping.
                print("[agg] WARNING: no pressure data in this sampling window, no row produced. "
                      "Check that the MCU is running (Console should show [diag] every second).")
                ui.send_message("aggregate_stalled", {
                    "ts": time.time(),
                    "window_sec": agg_settings["window_sec"],
                    "reason": "no_pressure_samples",
                })
                continue

            latest_aggregate = row
            try:
                chart_hist_add(row)
            except Exception as e:
                print(f"[chart] history append failed: {e}")
            ui.send_message("aggregate_update", row)
            record_append_row(row)
        except Exception:
            # A single window error should not stop the whole loop (the outer _run_forever is the last line of defense,
            # but that would restart the current window timing; catching it here disturbs the cadence less).
            print(f"[agg] processing this window failed, skipping to next:\n{traceback.format_exc()}")


# ============================= Manual / timed recording =============================
RECORD_STATUS_INTERVAL_SEC = 1.0  # status bar (elapsed seconds) update rate; data rows are one per aggregation window

RECORDINGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "recordings")
os.makedirs(RECORDINGS_DIR, exist_ok=True)
# In-progress recording marker file: after the App or the whole board restarts, it is used to resume the recording that was never stopped.
RECORDING_MARKER_PATH = os.path.join(_SEARCH_DIR, "recording_state.json")

# v4: HFM derived-parameter columns (replace v3's delta_p_net/R/shear_rate/shear_stress/tmp_uniformity/n_eff)
HFM_CSV_COLS = (
    ("rho_gh_kpa", ".3f"), ("tmp_out_kpa", ".3f"), ("tmp_out_min_kpa", ".3f"),
    ("tmp_out_expected_kpa", ".3f"), ("tmp_out_excess_kpa", ".3f"),
    ("dp_friction_kpa", ".3f"), ("dp_ratio", ".3f"), ("tau_w_pa", ".3f"),
    ("gamma_pressure_s1", ".0f"), ("gamma_flow_s1", ".0f"), ("gamma_ratio", ".3f"), ("re", ".0f"),
    ("tmp_mean_kpa", ".3f"), ("tmp_in_kpa", ".3f"), ("tmp_nonuniformity", ".3f"), ("ps_kpa", ".3f"),
    ("q_perm_mlmin", ".3f"), ("j_lmh", ".3f"), ("lp_lmh_bar", ".2f"), ("d_actual_h", ".4f"),
    ("rt_m1", ".3e"), ("tau_shell_min", ".1f"), ("mu_cp_used", ".4f"),
)

# One row per aggregation window (default one row per 30 s). Column order must match _row_to_csv_line() exactly.
# v6.0: columns are defined only here, in one place; the web UI no longer builds the CSV itself.
CSV_HEADER = (
    "window_index,elapsed_s,timestamp_start,timestamp_end,window_sec,gap_s,agg_method,"
    "n_samples_pressure,n_samples_flow,partial,"
    "od600_au,od600_lux_sample,od600_lux_ref,od600_bubble_pct,od600_valid,"
    "od600_blank_set,od600_age_s,od600_new,od600_alg,od600_bubble_frac_pct,od600_flags,"
    "od600_reported,od600_p90,od600_gate_accepted,od600_gate_reason,"
    "od600_gate_d_disc,od600_gate_d_jump,od600_gate_pending,od600_mu_per_h,od600_mu_r2,"
    + ",".join(f"od_{a}" for a in PA.ALG_NAMES) + ","
    "flow_mlmin,flow_freq_hz,flow_total_ml,flow_pulses,"
    "pressure_feed_bar,pressure_retentate_bar,pressure_permeate_bar,pressure_tmp_bar,"
    "pressure_tmp_peak_bar,pressure_tmp_trough_bar,pressure_cycle_freq_hz,"
    "pump_pwm,pump_forward,"
    "ph,ph_temp_c,temp_src,ph_state,"
    "valve_state,valve_closed_frac,valve_pos,"
    "shell_valve,feed_valve,feed_pump_pwm,feed_pump_forward,base_pulses,base_pulse_ms,ph_ctrl_state,ph_target,p_trip,p_max_bar,"
    "delta_p_bar," + ",".join(k for k, _ in HFM_CSV_COLS) + ","
    "dtmp_dt_bar_per_min,d2tmp_dt2,steady,"
    "tmp_sd_bar,tmp_iqr_bar,tmp_min_bar,tmp_max_bar,feed_sd_bar,"
    "flow_sd_mlmin,flow_iqr_mlmin,flow_min_mlmin,flow_max_mlmin,alg_profile,"
    "p_raw_dropped,raw_dir,config_version,constants_version\n"
)

# Cap on data rows sent back to the frontend. Previously every row of the whole recording was kept in memory and on stop the whole bundle was sent over WebSocket
# to the browser for download -- a 72-hour recording would be several MB, and if the browser was not connected it was simply lost.
# Now each row is written to disk the moment it is produced, so the browser only needs the "most recent rows" for preview;
# the full file is always fetched from the /download/recording HTTP endpoint (or directly from recordings/ on the board).
RECORD_ROWS_TO_CLIENT = 500

_record_lock = threading.Lock()
record_state = "idle"          # "idle" | "recording" | "paused"
record_start_monotonic = None
record_paused_accum = 0.0       # accumulated paused seconds (paused time is not counted in elapsed)
record_pause_started = None
record_duration_sec = None      # None = manual mode; set = timed mode, ends automatically when time is up
record_csv_path = None          # file this recording is writing to (exists from the moment start is pressed)
record_row_count = 0
record_recent_rows = deque(maxlen=RECORD_ROWS_TO_CLIENT)
_record_last_od_seq = None      # OD600 measurement sequence number recorded in the previous row, used to flag od600_new
_record_last_row_end = None     # end time of the previous row (wall clock), used to compute gap_s


def _fmt(v, spec):
    return format(v, spec) if v is not None else ""


def _s(v):
    return "" if v is None else str(v)


def _row_to_csv_line(row):
    def ts(v):
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(v)) if v else ""
    return ",".join([
        str(row.get("window_index", "")), f"{row.get('elapsed_s', 0):.2f}",
        ts(row.get("ts_start")), ts(row.get("ts_end")),
        _fmt(row.get("window_sec"), ".2f"), _fmt(row.get("gap_s"), ".2f"),
        row.get("agg_method", ""),
        str(row.get("n_samples_pressure", "")), str(row.get("n_samples_flow", "")),
        "1" if row.get("partial") else "0",
        _fmt(row.get("od600_au"), ".5f"), _fmt(row.get("od600_lux_sample"), ".2f"),
        _fmt(row.get("od600_lux_ref"), ".2f"), _fmt(row.get("od600_bubble_pct"), ".1f"),
        str(row.get("od600_valid", "")), str(row.get("od600_blank_set", "")),
        _fmt(row.get("od600_age_s"), ".1f"), str(row.get("od600_new", 0)),
        _s(row.get("od600_alg")), _fmt(row.get("od600_bubble_frac_pct"), ".1f"), _s(row.get("od600_flags")),
        _fmt(row.get("od600_reported"), ".5f"), _fmt(row.get("od600_p90"), ".5f"),
        _s(row.get("od600_gate_accepted")), _s(row.get("od600_gate_reason")),
        _fmt(row.get("od600_gate_d_disc"), ".5f"), _fmt(row.get("od600_gate_d_jump"), ".5f"),
        _s(row.get("od600_gate_pending")),
        _fmt(row.get("od600_mu_per_h"), ".5f"), _fmt(row.get("od600_mu_r2"), ".4f"),
        *[_fmt(row.get(f"od_{a}"), ".5f") for a in PA.ALG_NAMES],
        _fmt(row.get("flow_mlmin"), ".3f"), _fmt(row.get("flow_freq_hz"), ".4f"),
        _fmt(row.get("flow_total_ml"), ".2f"), _s(row.get("flow_pulses")),
        _fmt(row.get("pressure_feed_bar"), ".5f"), _fmt(row.get("pressure_retentate_bar"), ".5f"),
        _fmt(row.get("pressure_permeate_bar"), ".5f"), _fmt(row.get("pressure_tmp_bar"), ".5f"),
        _fmt(row.get("pressure_tmp_peak_bar"), ".5f"), _fmt(row.get("pressure_tmp_trough_bar"), ".5f"),
        _fmt(row.get("pressure_cycle_freq_hz"), ".2f"),
        str(row.get("pump_pwm", "")), str(row.get("pump_forward", "")),
        _fmt(row.get("ph"), ".3f"), _fmt(row.get("ph_temp_c"), ".2f"),
        _s(row.get("temp_src")), _s(row.get("ph_state")),
        _s(row.get("valve_state")), _fmt(row.get("valve_closed_frac"), ".3f"),
        _s(row.get("valve_pos")),
        _s(row.get("shell_valve")), _s(row.get("feed_valve")),
        _s(row.get("feed_pump_pwm")), _s(row.get("feed_pump_forward")), _s(row.get("base_pulses")),
        _s(row.get("base_pulse_ms")), _s(row.get("ph_ctrl_state")), _fmt(row.get("ph_target"), ".2f"),
        _s(row.get("p_trip")), _fmt(row.get("p_max_bar"), ".4f"),
        _fmt(row.get("delta_p_bar"), ".5f"),
        *[_fmt(row.get(k), f) for k, f in HFM_CSV_COLS],
        _fmt(row.get("dtmp_dt_bar_per_min"), ".5f"), _fmt(row.get("d2tmp_dt2"), ".6f"),
        str(row.get("steady", "")),
        _fmt(row.get("tmp_sd_bar"), ".5f"), _fmt(row.get("tmp_iqr_bar"), ".5f"),
        _fmt(row.get("tmp_min_bar"), ".5f"), _fmt(row.get("tmp_max_bar"), ".5f"),
        _fmt(row.get("feed_sd_bar"), ".5f"),
        _fmt(row.get("flow_sd_mlmin"), ".2f"), _fmt(row.get("flow_iqr_mlmin"), ".2f"),
        _fmt(row.get("flow_min_mlmin"), ".2f"), _fmt(row.get("flow_max_mlmin"), ".2f"),
        _s(row.get("alg_profile")),
        _s(row.get("p_raw_dropped")), _s(row.get("raw_dir")),
        row.get("config_version", ""), row.get("constants_version", ""),
    ]) + "\n"


def _append_row_to_disk(path, row):
    """Write one row to disk and make sure it is persisted (flush + fsync).
    Previously the whole recording was kept in memory and only written on stop -- meaning a power loss/crash/reboot wiped everything,
    and "the board records independently" only held when it shut down normally. Now each window is persisted as soon as it is produced,
    so the worst case loses only the one window that has not finished yet."""
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(_row_to_csv_line(row))
            f.flush()
            os.fsync(f.fileno())
        return True
    except OSError as e:
        print(f"[record] writing {path} failed: {e}")
        return False


def _write_recording_marker():
    """Record this recording's progress so it can be resumed after the App/board restarts."""
    if record_csv_path is None:
        return
    try:
        with open(RECORDING_MARKER_PATH, "w", encoding="utf-8") as f:
            json.dump({
                "csv_path": record_csv_path,
                "start_time_wall": _record_start_wall,
                "paused_accum": record_paused_accum,
                "duration_sec": record_duration_sec,
                "row_count": record_row_count,
                "window_index": _agg_window_index,
                "od_seq": _record_last_od_seq,
                # end time of the previous row: needed for the first row after resuming so gap_s reflects the true interruption length
                "last_row_end": _record_last_row_end,
                "raw_dir": raw_session.folder if raw_session is not None else None,
                "updated_at": time.time(),
            }, f, ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"[record] writing progress marker failed: {e}")


def _clear_recording_marker():
    try:
        if os.path.exists(RECORDING_MARKER_PATH):
            os.remove(RECORDING_MARKER_PATH)
    except OSError as e:
        print(f"[record] deleting progress marker failed: {e}")


_record_start_wall = None


def push_record_status(state, elapsed_sec, sample_count, duration_sec, client=None):
    ui.send_message("record_status", {
        "state": state,
        "elapsed_sec": round(elapsed_sec, 2),
        "sample_count": sample_count,
        "duration_sec": duration_sec,
        # let the screen show that "the data is written on the board", not stored in the browser
        "csv_filename": os.path.basename(record_csv_path) if record_csv_path else None,
        "rows_on_disk": record_row_count,
    }, client)


def push_record_status_snapshot(client=None):
    """Immediately send the current recording status when a new browser connects.
    Without this, record_status_loop does not push at all while idle, and a reconnecting page
    has to guess from its own defaults; while recording it would wait up to 1 second. What matters most on reconnect is "are we
    recording right now", and there should be no gap in that information."""
    with _record_lock:
        state = record_state
        elapsed = (
            (time.monotonic() - record_start_monotonic - record_paused_accum)
            if record_start_monotonic is not None else 0.0
        )
        count = record_row_count
        duration = record_duration_sec
    push_record_status(state, elapsed, count, duration, client)


def record_append_row(agg_row):
    """Called by aggregate_loop at the end of each sampling window. Does nothing when not recording."""
    global _record_last_od_seq, record_row_count, _record_last_row_end
    with _record_lock:
        if record_state != "recording":
            return
        elapsed = time.monotonic() - record_start_monotonic - record_paused_accum
        seq = agg_row.get("od600_meas_seq") or 0
        od_new = 1 if (seq and seq != _record_last_od_seq) else 0
        _record_last_od_seq = seq

        row = dict(agg_row)
        row["elapsed_s"] = round(elapsed, 2)
        row["od600_new"] = od_new
        # gap_s: how long between the start of this row and the end of the previous row. Normally around 0; if
        # a few minutes are missing due to an App/board restart or a pressure data outage, the gap is written out here directly,
        # so when reviewing the CSV you do not have to compare timestamps yourself to discover "there was actually no data here".
        row["gap_s"] = (round(row["ts_start"] - _record_last_row_end, 2)
                        if _record_last_row_end is not None else 0.0)
        _record_last_row_end = row.get("ts_end")

        path = record_csv_path
        duration = record_duration_sec

    if path and _append_row_to_disk(path, row):
        with _record_lock:
            record_row_count += 1
            record_recent_rows.append(row)
            count = record_row_count
            _write_recording_marker()
    else:
        with _record_lock:
            count = record_row_count

    push_record_status("recording", elapsed, count, duration)
    if duration is not None and elapsed >= duration:
        finish_recording(auto=True)


# ---- v5.0: raw data session ----
raw_status = {"active": False, "folder": None, "rows": {}, "size_bytes": 0, "disk_free_bytes": None,
              "warn": None, "enabled": RAW_LOG_ENABLED}


def build_raw_meta():
    with _hfm_lock:
        h = dict(hfm_state)
    with _pump_lock:
        pump = dict(pump_state)
    return {
        "format": "releaf-raw", "format_version": 1, "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "backend_version": BACKEND_VERSION, "firmware": mcu_link.get("fw"), "expected_fw": EXPECTED_FW,
        "config_version": CONFIG_VERSION, "constants_version": CONSTANTS_VERSION,
        "mcu_config": dict(mcu_cfg),
        "pressure": {"offsets_bar": dict(pressure_offsets), "channels": list(PRESSURE_CHANNELS),
                     "bar_formula": "bar = sum/ovs/(2^adc_bits-1)*vref/div/vmax*barmax - offset",
                     "ema_alpha": PRESSURE_MEAN_FILTER_ALPHA, "stats_window_s": P_STATS_WINDOW_S},
        "flow": {"pulses_per_liter": FLOW_PULSES_PER_LITER},
        "od600": {"blank": {"blank_set": od_blank["blank_set"], "per_alg": od_blank["per_alg"]},
                  "path_length_factor": od_cfg["plf"], "optical_mode": od_cfg["optical_mode"],
                  "primary_alg": od_primary_alg(),
                  # v5.1 pre-registration: this recording runs with this set of gate thresholds. The thresholds are locked into the file before the run,
                  # so later validation with this data is a clean out-of-sample validation (thresholds were not picked after the fact).
                  "gate": od_gate.config(),
                  "gate_registered_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                  "gate_threshold_source": (_OD_CONST.get("gate") or {}).get("source",
                                                                            "constants.json od600.gate")},
        "ph": dict(ph_config),
        "hfm_state": h, "specs": {k: HFM[k] for k in SPEC_KEYS},
        "algorithms": dict(alg_settings), "aggregate": dict(agg_settings),
        "pump": pump, "valve_config": dict(valve_config),
        # v6.0
        "aux_valves": {"config": {n: dict(av_config[n], pos=list(av_config[n]["pos"])) for n in AV_NAMES},
                       "desired": dict(av_desired), "degrees": {n: list(AV_DEG[n]) for n in AV_NAMES}},
        "pressure_protect": dict(pressure_protect_cfg), "base_pump": dict(base_cfg),
        "ph_control": dict(ph_doser.cfg, version=PC.VERSION),
        "streams": {k: list(v) for k, v in RL.STREAMS.items()},
        "od_raw_header": OD_RAW_HEADER,
    }


def raw_session_open(csv_path, reuse=False):
    """Open the raw data folder <recording filename>_raw/ when recording starts (or resumes)."""
    global raw_session
    if not RAW_LOG_ENABLED:
        return None
    free = RL.disk_free_bytes(RECORDINGS_DIR)
    if free is not None and free < RAW_DISK_STOP_BYTES:
        print(f"[raw] !! disk free {free / 1e6:.0f} MB, below {RAW_DISK_STOP_BYTES / 1e6:.0f} MB, not recording raw data")
        raw_status["warn"] = "disk_low_stopped"
        return None
    folder = os.path.splitext(csv_path)[0] + "_raw"
    try:
        rs = RL.RawSession(folder, meta=build_raw_meta(), od_header=OD_RAW_HEADER)
    except OSError as e:
        print(f"[raw] cannot create raw data folder {folder}: {e}")
        return None
    raw_session = rs
    if not reuse and _od_last_blank_raw:          # so offline reruns have a blank available
        for att in _od_last_blank_raw:
            rs.write_od(_od_raw_row(dict(att, blank_measure=1)))
    print(f"[raw] raw data -> {folder}")
    refresh_disk_status()
    return rs


def raw_session_close(reason):
    global raw_session
    rs = raw_session
    raw_session = None
    if rs is not None:
        try:
            rs.event("record_stop", {"reason": reason})
        except Exception:
            pass
        rs.close()
        print(f"[raw] raw data closed: {rs.folder} ({rs.rows})")
    refresh_disk_status()


def refresh_disk_status(client=None):
    global raw_session
    rs = raw_session
    free = RL.disk_free_bytes(RECORDINGS_DIR)
    warn = None
    if free is not None and free < RAW_DISK_WARN_BYTES:
        warn = "disk_low"
    if rs is not None and free is not None and free < RAW_DISK_STOP_BYTES:
        print(f"[raw] !! disk free {free / 1e6:.0f} MB, stopped raw data recording (aggregated CSV continues)")
        rs.event("raw_stopped_disk_low", {"free_bytes": free})
        raw_session_close("disk_low")
        rs = None
        warn = "disk_low_stopped"
    raw_status.update({"active": rs is not None, "folder": os.path.basename(rs.folder) if rs else None,
                       "rows": dict(rs.rows) if rs else {}, "size_bytes": RL.folder_size(rs.folder) if rs else 0,
                       "disk_free_bytes": free, "warn": warn or raw_status.get("warn") if rs is None else warn,
                       "p_dropped_batches": p_stats["dropped_batches"]})
    try:
        ui.send_message("raw_status", dict(raw_status), client)
    except Exception:
        pass


def _start_recording_file():
    """Create this recording's CSV and write the header. Returns the file path."""
    filename = f"record_{time.strftime('%Y%m%d_%H%M%S')}.csv"
    path = os.path.join(RECORDINGS_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(CSV_HEADER)
        f.flush()
        os.fsync(f.fileno())
    return path


def handle_start_record(client, data):
    global record_state, record_start_monotonic, record_paused_accum
    global record_duration_sec, _record_last_od_seq, record_csv_path
    global record_row_count, _record_start_wall, _record_last_row_end
    with _record_lock:
        if record_state != "idle":
            return
        try:
            record_csv_path = _start_recording_file()
        except OSError as e:
            print(f"[record] cannot create recording file: {e}")
            ui.send_message("record_error", {"error": str(e)}, client)
            return
        record_recent_rows.clear()
        record_row_count = 0
        record_start_monotonic = time.monotonic()
        _record_start_wall = time.time()
        record_paused_accum = 0.0
        _record_last_od_seq = None
        _record_last_row_end = None
        dur = (data or {}).get("duration_sec")
        try:
            record_duration_sec = float(dur) if dur not in (None, "", 0) else None
        except (TypeError, ValueError):
            record_duration_sec = None
        record_state = "recording"
        duration_sec = record_duration_sec
        path = record_csv_path
    raw_session_open(path)
    raw_event("record_start", {"csv": os.path.basename(path), "duration_sec": duration_sec})
    with _record_lock:
        _write_recording_marker()
    print(f"[record] recording started -> {path}")
    # Start from a clean full window so the first row does not contain only half a period of data
    agg_reset_window()
    chart_hist_marker("start")
    push_record_status("recording", 0.0, 0, duration_sec)


def handle_pause_record(client, data):
    global record_state, record_pause_started, record_paused_accum
    with _record_lock:
        if record_state == "recording":
            record_state = "paused"
            record_pause_started = time.monotonic()
        elif record_state == "paused":
            if record_pause_started is not None:
                record_paused_accum += time.monotonic() - record_pause_started
            record_pause_started = None
            record_state = "recording"
        else:
            return
        elapsed = (
            (time.monotonic() - record_start_monotonic - record_paused_accum)
            if record_start_monotonic is not None else 0.0
        )
        count = record_row_count
        state = record_state
        duration_sec = record_duration_sec
        _write_recording_marker()
    raw_event("record_" + ("pause" if state == "paused" else "resume"), None)   # raw data keeps being logged during pause
    # Both pause and resume reset the window: otherwise a row would span before and after the pause, and that row's
    # "sampling duration" would not match the time actually covered, making post-analysis hard to explain.
    agg_reset_window()
    push_record_status(state, elapsed, count, duration_sec)


def finish_recording(auto, reason=None):
    global record_state, record_start_monotonic, record_csv_path
    global record_paused_accum, record_pause_started, record_duration_sec
    global record_row_count, _record_start_wall, _record_last_row_end

    with _record_lock:
        if record_state == "idle":
            return
        active = True

    # On finish, also settle the current not-yet-full window into a row (flagged partial=1), so the final
    # less-than-one-window of data is not thrown away -- when a timed recording is shorter than a window, this row is the only data.
    partial_row = _build_aggregate_row(partial=True) if active else None

    with _record_lock:
        if record_state == "idle":
            return
        if partial_row is not None and record_csv_path:
            elapsed_now = time.monotonic() - record_start_monotonic - record_paused_accum
            partial_row = dict(partial_row)
            partial_row["elapsed_s"] = round(elapsed_now, 2)
            seq = partial_row.get("od600_meas_seq") or 0
            partial_row["od600_new"] = 1 if (seq and seq != _record_last_od_seq) else 0
            partial_row["gap_s"] = (round(partial_row["ts_start"] - _record_last_row_end, 2)
                                    if _record_last_row_end is not None else 0.0)
            if _append_row_to_disk(record_csv_path, partial_row):
                record_row_count += 1
                record_recent_rows.append(partial_row)

        elapsed = (
            (time.monotonic() - record_start_monotonic - record_paused_accum)
            if record_start_monotonic is not None else 0.0
        )
        path = record_csv_path
        rows = list(record_recent_rows)
        count = record_row_count
        truncated = count > len(rows)

        record_state = "idle"
        record_start_monotonic = None
        _record_start_wall = None
        record_paused_accum = 0.0
        record_pause_started = None
        record_duration_sec = None
        record_csv_path = None
        _record_last_row_end = None

    _clear_recording_marker()
    raw_session_close("auto" if auto else (reason or "manual"))
    filename = os.path.basename(path) if path else None
    print(f"[record] recording finished -> {filename} ({count} rows, all written to disk)")
    chart_hist_marker("stop")
    push_record_status("idle", elapsed, count, None)
    ui.send_message("record_saved", {
        "filename": filename,
        "sample_count": count,
        "elapsed_sec": round(elapsed, 2),
        "auto": auto,
        "reason": reason,
        # v6.0: rows are no longer sent (the web UI does not build the CSV). Preview uses csv_text, the full file uses download_url
        "truncated": truncated,
        # v5.0: the preview CSV text is built by the backend (columns defined only here, in one place), so the web UI no longer assembles columns itself
        "csv_text": CSV_HEADER + "".join(_row_to_csv_line(r) for r in rows),
        "download_url": f"/download/recording?name={filename}" if filename else None,
        "raw_dir": (os.path.splitext(filename)[0] + "_raw") if filename else None,
    })


def handle_stop_record(client, data):
    finish_recording(auto=False)


def handle_record_checkpoint(client, data):
    """v4.10: Mid-run save -- without interrupting recording, copy the CSV so far into a separate file and let the browser download it.
    Every row is flush+fsync'ed when written, so the copy is the complete data up to this moment."""
    import shutil
    with _record_lock:
        state, path, rows = record_state, record_csv_path, record_row_count
        if state not in ("recording", "paused") or not path or not os.path.exists(path):
            ui.send_message("record_checkpoint_saved", {"ok": False, "error": "No recording in progress"}, client)
            return
        base = os.path.splitext(os.path.basename(path))[0]
        snap = f"{base}_checkpoint_{time.strftime('%Y%m%d_%H%M%S')}.csv"
        try:
            shutil.copyfile(path, os.path.join(RECORDINGS_DIR, snap))
        except OSError as e:
            ui.send_message("record_checkpoint_saved", {"ok": False, "error": str(e)}, client)
            return
    print(f"[record] checkpoint saved: {snap} ({rows} rows), recording continues")
    ui.send_message("record_checkpoint_saved", {
        "ok": True, "filename": snap, "sample_count": rows, "source": os.path.basename(path),
        "download_url": f"/download/recording?name={snap}"}, client)
    ui.send_message("recordings_list", {"dir": RECORDINGS_DIR, "files": list_recording_files()})


ui.on_message("record_checkpoint", handle_record_checkpoint)
ui.on_message("start_record", handle_start_record)
ui.on_message("pause_record", handle_pause_record)
ui.on_message("stop_record", handle_stop_record)


def resume_interrupted_recording():
    """After the App or the whole board restarts, resume the recording that was not stopped normally.

    Because each row is persisted the moment it is produced, an interruption loses at most the last unfinished window;
    all that is needed here is to restore the "recording" state and let subsequent rows keep appending to the same file.
    elapsed keeps accumulating according to real elapsed time (not restarting from 0), and the interrupted span is honestly flagged in the next row's
    gap_s column.
    """
    global record_state, record_start_monotonic, record_paused_accum
    global record_duration_sec, record_csv_path, record_row_count
    global _record_start_wall, _record_last_od_seq, _record_last_row_end
    global _agg_window_index

    marker = None
    try:
        with open(RECORDING_MARKER_PATH, "r", encoding="utf-8") as f:
            marker = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return

    path = marker.get("csv_path")
    if not path or not os.path.exists(path):
        print(f"[record] CSV referenced by progress marker missing ({path}), ignoring and clearing marker")
        _clear_recording_marker()
        return

    # v3: the CSV has more columns now. If the file to resume has the old column layout, new-format rows must not be appended to it
    # (columns would be misaligned); instead open a new file to continue recording and leave the old file untouched.
    try:
        with open(path, "r", encoding="utf-8") as f:
            first_line = f.readline()
    except OSError:
        first_line = ""
    if first_line.strip() != CSV_HEADER.strip():
        try:
            new_path = _start_recording_file()
            print(f"[record] {os.path.basename(path)} has old column format, resuming into new file {os.path.basename(new_path)}")
            path = new_path
            marker["row_count"] = 0
            marker["last_row_end"] = None
        except OSError as e:
            print(f"[record] cannot create resume file ({e}), not resuming")
            _clear_recording_marker()
            return

    start_wall = float(marker.get("start_time_wall") or time.time())
    paused = float(marker.get("paused_accum") or 0.0)
    duration = marker.get("duration_sec")
    elapsed = max(0.0, time.time() - start_wall - paused)
    gap = max(0.0, time.time() - float(marker.get("updated_at") or start_wall))

    if duration is not None and elapsed >= float(duration):
        # The timed recording already expired during the interruption: finish directly, do not keep recording
        print(f"[record] interrupted timed recording already past end time, finalizing: {os.path.basename(path)}")
        _clear_recording_marker()
        ui.send_message("record_saved", {
            "filename": os.path.basename(path), "sample_count": int(marker.get("row_count") or 0),
            "elapsed_sec": round(elapsed, 2), "auto": True, "reason": "interrupted_timer_expired",
            "truncated": True, "csv_text": "",
            "download_url": f"/download/recording?name={os.path.basename(path)}",
        })
        return

    with _record_lock:
        record_csv_path = path
        record_row_count = int(marker.get("row_count") or 0)
        record_recent_rows.clear()
        _record_start_wall = start_wall
        record_paused_accum = paused
        record_start_monotonic = time.monotonic() - elapsed
        record_duration_sec = float(duration) if duration is not None else None
        _record_last_od_seq = marker.get("od_seq")
        # Use the end time of the last row before the interruption as the reference, so the first row after resuming has gap_s equal to the true interruption length.
        # Setting it to None would make that row show gap_s=0, effectively hiding the interruption, which defeats the purpose of this column.
        _record_last_row_end = marker.get("last_row_end")
        # continue the window numbering; do not restart from 1 in the same file
        try:
            _agg_window_index = max(_agg_window_index, int(marker.get("window_index") or 0))
        except (TypeError, ValueError):
            pass
        record_state = "recording"
        _write_recording_marker()

    if marker.get("raw_dir") or RAW_LOG_ENABLED:
        raw_session_open(path, reuse=True)
        raw_event("record_resume_after_restart", {"gap_s": round(gap, 1)})
    print(f"[record] resuming interrupted recording: {os.path.basename(path)} "
          f"({record_row_count} rows so far, {elapsed:.0f}s elapsed, gap ~{gap:.0f}s)")
    agg_reset_window()
    chart_hist_marker("resume")
    ui.send_message("record_resumed", {
        "filename": os.path.basename(path),
        "row_count": record_row_count,
        "elapsed_sec": round(elapsed, 2),
        "gap_sec": round(gap, 1),
    })
    push_record_status("recording", elapsed, record_row_count, record_duration_sec)


# ---- Listing and downloading recording files ----
def list_recording_files():
    out = []
    try:
        for name in sorted(os.listdir(RECORDINGS_DIR), reverse=True):
            if not name.endswith(".csv"):
                continue
            full = os.path.join(RECORDINGS_DIR, name)
            try:
                st = os.stat(full)
            except OSError:
                continue
            raw_dir = os.path.join(RECORDINGS_DIR, os.path.splitext(name)[0] + "_raw")
            has_raw = os.path.isdir(raw_dir)
            out.append({
                "name": name,
                "size_bytes": st.st_size,
                "modified_at": st.st_mtime,
                "active": (record_csv_path is not None and os.path.basename(record_csv_path) == name),
                "download_url": f"/download/recording?name={name}",
                "raw_dir": os.path.basename(raw_dir) if has_raw else None,
                "raw_size_bytes": RL.folder_size(raw_dir) if has_raw else 0,
                "raw_url": f"/raw?dir={os.path.basename(raw_dir)}" if has_raw else None,
            })
    except OSError as e:
        print(f"[record] listing recordings/ failed: {e}")
    return out


def handle_list_recordings(client, data):
    ui.send_message("recordings_list", {"dir": RECORDINGS_DIR, "files": list_recording_files()}, client)


ui.on_message("list_recordings", handle_list_recordings)


# HTTP download endpoint: the full CSV need not go through WebSocket, nor depend on "a browser being connected at the moment of stop".
# Not every WebUI Brick version has expose_api, so the whole block is wrapped in capability detection; without it
# the files are still in the board's recordings/ folder, you just have to fetch them yourself.
def _register_download_endpoint():
    if not hasattr(ui, "expose_api"):
        print("[record] this WebUI Brick version has no expose_api, skipping HTTP download endpoint; "
              f"recordings are still written to {RECORDINGS_DIR}")
        return
    try:
        from fastapi.responses import FileResponse, JSONResponse
    except ImportError:
        print("[record] fastapi not found, skipping HTTP download endpoint")
        return

    def api_download_recording(name: str = None):
        # only allow the bare filename under recordings/, blocking path traversal such as ../
        safe = os.path.basename(name or "")
        if not safe.endswith(".csv"):
            return JSONResponse({"error": "invalid name"}, status_code=400)
        full = os.path.join(RECORDINGS_DIR, safe)
        if not os.path.exists(full):
            return JSONResponse({"error": "not found"}, status_code=404)
        return FileResponse(full, filename=safe, media_type="text/csv")

    def api_list_recordings():
        return {"dir": RECORDINGS_DIR, "files": list_recording_files()}

    def _raw_dir_path(d):
        safe = os.path.basename(d or "")
        full = os.path.join(RECORDINGS_DIR, safe)
        return full if (safe.endswith("_raw") and os.path.isdir(full)) else None

    def api_raw_index(dir: str = None):
        """File list of the raw data folder (simple HTML, one download link per file)."""
        try:
            from fastapi.responses import HTMLResponse
        except ImportError:
            return JSONResponse({"error": "no fastapi"}, status_code=500)
        full = _raw_dir_path(dir)
        if not full:
            return JSONResponse({"error": "not found"}, status_code=404)
        rows = []
        for n in sorted(os.listdir(full)):
            try:
                sz = os.path.getsize(os.path.join(full, n))
            except OSError:
                continue
            rows.append(f'<tr><td><a href="/download/raw?dir={os.path.basename(full)}&name={n}">{n}</a></td>'
                        f'<td style="text-align:right">{sz / 1e6:.2f} MB</td></tr>')
        html = (f"<!doctype html><meta charset='utf-8'><title>{os.path.basename(full)}</title>"
                f"<body style='font-family:sans-serif;padding:16px'><h2>{os.path.basename(full)}</h2>"
                "<p>Raw data: pressure/flow/aux one file per hour (.csv.gz), od_raw.csv, events.csv, meta.json. "
                "To recompute, see README and tools/replay_raw.py.</p>"
                f"<table cellpadding='4'>{''.join(rows)}</table></body>")
        return HTMLResponse(html)

    def api_download_raw(dir: str = None, name: str = None):
        full = _raw_dir_path(dir)
        safe = os.path.basename(name or "")
        if not full or not safe or not os.path.exists(os.path.join(full, safe)):
            return JSONResponse({"error": "not found"}, status_code=404)
        mt = "application/gzip" if safe.endswith(".gz") else ("application/json" if safe.endswith(".json") else "text/csv")
        return FileResponse(os.path.join(full, safe), filename=safe, media_type=mt)

    try:
        ui.expose_api("GET", "/download/recording", api_download_recording)
        ui.expose_api("GET", "/api/recordings", api_list_recordings)
        ui.expose_api("GET", "/raw", api_raw_index)
        ui.expose_api("GET", "/download/raw", api_download_raw)
        print("[record] registered HTTP download endpoint /download/recording")
    except Exception as e:
        print(f"[record] registering HTTP download endpoint failed (recording unaffected): {e}")


_register_download_endpoint()


def record_status_loop():
    """Data rows are written by aggregate_loop, one per window; this loop only makes the on-screen
    "recorded seconds" tick every second, and handles the case where "the timed duration is shorter than one sampling window"
    (in that case no full window ever ends, so this loop has to finish the recording)."""
    while True:
        time.sleep(RECORD_STATUS_INTERVAL_SEC)
        with _record_lock:
            if record_state == "idle" or record_start_monotonic is None:
                continue
            elapsed = time.monotonic() - record_start_monotonic - record_paused_accum
            state = record_state
            count = record_row_count
            duration = record_duration_sec
        push_record_status(state, elapsed, count, duration)
        if state == "recording" and duration is not None and elapsed >= duration:
            finish_recording(auto=True)


# ============================= Keep-alive wrapper for background threads =============================
# Added 2026-09-01: previously these background loops were launched directly with threading.Thread(target=fn),
# so a single uncaught exception in a loop killed that thread "permanently" -- and silently:
# the web UI did not disconnect, other messages kept flowing, only that one data path stopped updating. The actual symptom was
# "the screen freezes, refresh/reconnect does not help, only restarting the whole App fixes it",
# because everything on the browser side was fine; what broke was that backend thread.
#
# Now every background thread is wrapped here: the exception prints a full traceback (for later debugging),
# and the loop is automatically restarted after 1 second instead of just disappearing.
def _run_forever(name, fn, restart_delay_sec=1.0):
    def runner():
        while True:
            try:
                fn()   # normally fn is itself an infinite loop and never returns
                print(f"[thread] {name} returned unexpectedly (no exception), restarting in {restart_delay_sec}s")
            except Exception:
                print(f"[thread] {name} raised unhandled exception, restarting in {restart_delay_sec}s:\n"
                      f"{traceback.format_exc()}")
            time.sleep(restart_delay_sec)
    return runner


# ============================= Startup =============================
# v3.2: all boot-time syncing that "talks to the MCU" moved to a background thread.
# Previously these Bridge.call calls ran sequentially before App.run(); each one waited for a 10 s timeout when the MCU did not respond,
# and with a dozen or so of them the web UI took one or two minutes to come up, looking as if the whole system had hung. Now the web UI is usable immediately,
# and an unresponsive MCU is clearly shown in the status bar / red banner and the Console (see mcu_link).

# ---- Parts that only read local files are still done here ----
_calib_file = _load_calibration_file()
calibration_saved = dict(_calib_file.get("items") or {})
calibration_source = dict(_calib_file.get("source") or {})
if calibration_saved:
    print(f"[calib] loaded saved calibration: {', '.join(sorted(calibration_saved))}")
    for _k in calibration_saved:
        calibration_source.setdefault(_k, {"source": "measured", "at": calibration_saved[_k].get("saved_at")})
    _bl = calibration_saved.get("od600_blank") or {}
    if _bl and not _bl.get("per_alg"):
        # a v4.x blank is a single ratio measured by the old MCU algorithm (mode 1): apply it but mark it manual, as a reminder to re-calibrate with v5.0
        calibration_source["od600_blank"] = {"source": "manual", "at": time.time()}
        print("[calib] OD600 blank is in v4.x format (sensor settings changed), applied but please recalibrate blank")
    apply_saved_calibration(source=None, quiet=True)   # apply on the Linux side (pushing the pressure zero to the MCU happens in the startup sync)

pv_saved.update(_load_pv_state())
if isinstance(pv_saved.get("rpc_wd"), dict):              # v4.9
    rpc_wd_pref.update({k: pv_saved["rpc_wd"][k] for k in ("en", "sec") if k in pv_saved["rpc_wd"]})
if pv_saved:
    print(f"[ph/valve] loaded saved state: {', '.join(sorted(pv_saved))}")
for _k, _v in (pv_saved.get("algorithms") or {}).items():   # v3.7: saved algorithm selections
    if _k in ALG_OPTIONS and _v in ALG_OPTIONS[_k]:
        alg_settings[_k] = _v
print(f"[alg] {alg_profile_string()}")
if isinstance(pv_saved.get("od_gate"), dict):      # v5.1: saved OD gate thresholds
    for _k, _v in pv_saved["od_gate"].items():
        if _k in OG.DEFAULTS and _v is not None:
            od_gate.cfg[_k] = bool(_v) if isinstance(OG.DEFAULTS[_k], bool) else type(OG.DEFAULTS[_k])(_v)
    od_gate.reset("restored")
if isinstance(pv_saved.get("growth_rate"), dict):  # v6.1: saved growth-rate settings
    try:
        growth.set_config(**{k: v for k, v in pv_saved["growth_rate"].items() if k in growth.config()})
    except (TypeError, ValueError):
        pass
print(f"[od600] growth rate: " + ", ".join(f"{k}={v}" for k, v in growth.config().items()))
print(f"[od600] gate thresholds: " + ", ".join(f"{k}={v}" for k, v in od_gate.config().items()))
if pv_saved.get("specs"):                  # v4.1: spec-management override values
    _sv, _se = _spec_validate(pv_saved["specs"])
    specs_apply(_sv, save=False)
    print(f"[specs] loaded spec overrides: {', '.join(sorted(_sv)) or '(none)'}" + (f" | skipped: {_se}" if _se else ""))
hfm_load_saved(pv_saved.get("hfm"))      # v4: rho*g*h / dP-Q baseline / Q_perm / L_p initial values
if isinstance(pv_saved.get("ph_config"), dict):   # v5.0: pH calibration conversion happens on the Linux side
    for _k in PH_CONFIG_KEYS:
        if _f(pv_saved["ph_config"].get(_k)) is not None:
            ph_config[_k] = float(pv_saved["ph_config"][_k])
    print(f"[ph] calibration: pH7 {ph_config['v7']:.4f} V, pH4 {ph_config['v4']:.4f} V, "
          f"cal temp {ph_config['cal_temp']:.1f} °C, manual temp {ph_config['temp']:.1f} °C")

# v6.0: saved settings for shell valve / feed valve, pressure protection, base pump, auto pH
if isinstance(pv_saved.get("avalve_config"), dict):
    for _n in AV_NAMES:
        _c = pv_saved["avalve_config"].get(_n)
        if isinstance(_c, dict):
            try:
                av_config[_n] = {"id": int(_c.get("id", av_config[_n]["id"])),
                                 "pos": [int(x) for x in (_c.get("pos") or av_config[_n]["pos"])][:3],
                                 "speed": int(_c.get("speed", av_config[_n]["speed"])),
                                 "acc": int(_c.get("acc", av_config[_n]["acc"]))}
            except (TypeError, ValueError):
                pass
if isinstance(pv_saved.get("avalve_desired"), dict):
    for _n in AV_NAMES:
        _st = pv_saved["avalve_desired"].get(_n)
        if _st in AV_STATES[_n] and not (_n == "feed" and _st == "base"):
            av_desired[_n] = _st
if _f((pv_saved.get("pressure_protect") or {}).get("limit")) is not None:
    pressure_protect_cfg["limit"] = min(5.0, max(0.1, float(pv_saved["pressure_protect"]["limit"])))
    latest_safety["limit"] = pressure_protect_cfg["limit"]
if isinstance(pv_saved.get("base_pump"), dict):
    base_cfg.update(pwm=_i(pv_saved["base_pump"].get("pwm"), base_cfg["pwm"]),
                    max_s_h=_f(pv_saved["base_pump"].get("max_s_h"), base_cfg["max_s_h"]))
if isinstance(pv_saved.get("ph_ctrl"), dict):
    ph_doser.configure({k: v for k, v in pv_saved["ph_ctrl"].items() if k in PC.DEFAULTS})
print(f"[v6] pressure protection {pressure_protect_cfg['limit']:.2f} bar | base pump PWM {base_cfg['pwm']}, "
      f"hourly limit {base_cfg['max_s_h']:.0f} s | valve ID shell={av_config['shell']['id']} feed={av_config['feed']['id']}, "
      f"restore to shell={av_desired['shell']} feed={av_desired['feed']} | auto pH "
      f"{'enabled, target ' + str(ph_doser.cfg['target']) if ph_doser.cfg['enabled'] else 'disabled'}")

# If the last recording was not stopped normally (App restart / board reboot / power loss), resume it and keep writing.
# Each row was persisted the moment it was produced, so what is resumed here is the complete data, not a restart from scratch.
resume_interrupted_recording()


def _startup_mcu_sync():
    t0 = time.time()
    print("[startup] syncing with MCU...")
    poll_mcu_diag()              # first check whether the Bridge is reachable; the result is printed to the Console
    if mcu_cfg_refresh():
        print(f"[startup] MCU conversion constants: vref={mcu_cfg['vref']} div={mcu_cfg['div']:.6f} adc={mcu_cfg['adc_bits']}-bit "
              f"ovs={mcu_cfg['ovs']} lpc={mcu_cfg['lpc']:.6f}")
    _sync_pump_status_from_mcu()
    poll_od600_once()
    push_od_blank()
    startup_calibration_sync()   # push the pressure zero to the MCU (od600_poll_loop retries if it fails)
    ph_valve_startup_sync()      # pinch valve settings, OD measurement interval / light path, pump boost
    push_pump_status()
    print(f"[startup] MCU sync finished in {time.time() - t0:.1f} s, Bridge {'OK' if mcu_link['ok'] else 'not responding'}")


def _startup_mcu_sync_once():
    global _startup_thread_done
    try:
        _startup_mcu_sync()
    except Exception:
        print(f"[startup] MCU sync failed:\n{traceback.format_exc()}")
    finally:
        _startup_thread_done = True


threading.Thread(target=_startup_mcu_sync_once, daemon=True, name="startup_mcu_sync").start()

agg_reset_window()

for _name, _fn in (
    ("mcu_job_loop", _mcu_job_loop),
    ("push_flow_loop", push_flow_loop),
    ("od600_poll_loop", od600_poll_loop),
    ("derive_loop", derive_loop),
    ("aggregate_loop", aggregate_loop),
    ("record_status_loop", record_status_loop),
    ("ph_control_loop", ph_control_loop),          # v6.0
):
    threading.Thread(target=_run_forever(_name, _fn), daemon=True, name=_name).start()

App.run()
