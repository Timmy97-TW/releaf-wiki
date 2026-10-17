## v6.2.2 (firmware v4.2.2 / backend v6.2.2 / web UI v6.2.2)

- **Feed pump is single-direction.** On the board forward stayed dead even with v4.2.1 (IN3 = D12 does not go high), so every function of the second pump (feed run, base dosing pulses) drives IN4 (D13), the old "reverse"; IN3 is held low. `set_feed_pump` ignores `dir` and reports `fdir=0`.
- Removed: the feed pump direction display and **Reverse** button, the **Swap IN3 / IN4** option (`inv`) and the **IN3 + ENB** test button. The wiring check (IN3 / IN4 high, read-back) stays.
- If the liquid flows the wrong way, swap the two motor wires on OUT3 / OUT4. Firmware and main.py must be updated together (main.py expects v4.2.2).

## v6.2.1 (firmware v4.2.1 / backend v6.2.1 / web UI v6.2.1)

- **Feed pump ran in reverse but not forward.** Reverse working shows ENB (D11) and IN4 (D13) are fine and IN3 (D12) never went high. D12 (PB14) is also a timer output (TIM1_CH2N) in the UNO Q device tree, so the firmware now writes ENB first and IN3 / IN4 last (with `pinMode(OUTPUT)` each time) and re-asserts the IN levels every 200 ms.
- **Wiring check** in the feed pump panel (`chb_pin_test`): hold IN3 / IN4 / ENB high for 1–30 s to measure with a meter; the status reports the level read back from IN3 / IN4 (`rb=`). Switched off by time, emergency stop, pressure trip, or by starting the pump; refused while channel B runs, and IN3 + ENB is refused while the feed valve is fully closed.
- **Swap IN3 / IN4** (`set_base_config inv=1`, saved with the base pump settings): fallback when D12 is dead and the ribbon cable cannot move. Swap the motor wires on OUT3 / OUT4 too; forward and base dosing then run on IN4, and reverse is unavailable.
- Web UI: **Feed valve & feed pump** in one panel (valve on top, pump below, wiring check folded); **Pinch valve & shell sampling valve** in one panel, with the sampling / feed valve setup at its bottom. The separate sampling & feed valve panel is gone.
- Firmware and main.py must be updated together (main.py expects v4.2.1).

## v6.2 (firmware v4.2.0 / backend v6.2 / web UI v6.2)

- **Second pump = feed pump.** What it pumps is chosen by the feed valve (Base / External feed). It now has its own panel right below the main pump with PWM, forward / reverse and stop, and runs continuously (`set_feed_pump`). The MCU refuses or stops it while the feed valve is online and fully closed, on pressure protection and on emergency stop; a missing feed valve no longer blocks it.
- **Why it did not turn before:** firmware v4.1.x only ran channel B as a base dosing pulse, and only with the feed valve (ID 3) online and confirmed at Base. Without that valve nothing moved, even with correct wiring.
- **Base dosing settings merged into automatic pH control**: manual dose, dosing PWM and hourly limit. Manual dosing no longer turns the feed valve by itself and only works while the feed valve is set to Base (and the feed pump is stopped). The feed valve Base position can now be selected by hand.
- Automatic pH pauses while the feed pump runs; base pulses and continuous running exclude each other on the MCU.
- CSV adds `feed_pump_pwm`, `feed_pump_forward` (109 columns). Firmware and main.py must be updated together (main.py expects v4.2.0).

## v6.1 (backend v6.1 / web UI v6.1, firmware unchanged v4.1.1)

- **PC layout** rearranged into OD600 + pH | pressure | pump & valves. The OD600 value cards sit to the right of its chart; pH shows its chart first, then the cards.
- **Temperature folded into the pH panel**: tap the temperature card to open the temperature trend, DS18B20 status, manual temperature input and probe diagnostics. The separate temperature panel is gone; the manual temperature moved there from the pH calibration panel.
- **Pressure-protection limit** moved into the pressure panel toolbar (status bar and Clear button too); the separate panel is gone.
- **Specific growth rate μ** (`python/growth_rate.py`): least-squares slope of ln(OD600 reported) over a sliding window (default 60 min) of gate-accepted readings; restarts after a declared operation / level shift / new blank. New card on the OD600 panel, settings in the OD600 gating layer, 2 new CSV columns (`od600_mu_per_h`, `od600_mu_r2`, 107 columns in total), saved settings key `growth_rate`.
- Panel order in the right column: main pump, pinch valve, sampling & feed valves, data recording.
- **Automatic pH control and the base pump** moved into **pH meter calibration & adjustment** (left column, open by default): probe calibration, then automatic pH control, then the base pump; the header shows the automatic pH state when collapsed.
- The web UI now requires main.py v6.1.
- Sampling settings and algorithm selection moved into data recording; engineering mode moved into the OD600 panel; calibration value management and spec management merged into **Calibration values & specs**.
- All reading cards sit below their live charts: OD600 (four-column cards), pressure (Feed / Retentate / Permeate / TMP and the max-pressure bar), temperature (current value, source, DS18B20 state).
- The English edition's web UI is bilingual again: English by default, with a language switch at the top right (Traditional Chinese). Separators and units in generated text follow the selected language.
- The PC view no longer shows the key-value bar at the top (the local display keeps it); the main pump panel no longer shows the Cumulative card (the CSV still records flow_total_ml).

# v6.0 changelog (firmware v4.1.1 / backend v6.0 / web UI v6.0, 2026-10-16)

> Not yet tested on real hardware. The firmware, backend and web UI have all been run on a PC against a simulated MCU and simulated sensors (README §16.6). Firmware v4.1.1 is v4.1.0 plus the L298N move to consecutive pins D8–D13 (see feature 1 and README §15).

## Three bugs found in cross-review

| ID | Problem | Fix |
|---|---|---|
| BUG-01 | The web UI had its own copy of `HFM_CSV_KEYS` / `rowsToCsv()` whose columns were out of sync with main.py (missing the OD gate, the 8 OD algorithms, p_raw_dropped and other columns) | Removed. `record_saved` no longer sends `rows`; the web UI uses only `download_url`, falling back to the `csv_text` assembled by the backend. The CSV column definition exists only once, in `main.py` |
| BUG-02 | No sampling happened during the `delay(2)`/`delay(5)` of `valveBlindMove` or the wait loop of `valveLoopbackOnce`, so pressure protection and the interlocks were blind during that time | `pressureTick` is forward-declared and `pressureTick(millis())` is called after each delay and inside the wait loop. Simulation: `pskip` does not increase during a blind move / loopback test |
| BUG-03 | The batch dt used 2 hex digits; when a batch was stretched beyond 255 ms it overflowed and corrupted the time axis | A batch is sent early once it reaches 240 ms; dt is clamped to 255 |

## Other issues found and fixed

- **Board build error** (`'AuxValve' was not declared in this scope` at `avMove`): the Arduino builder inserts auto-generated function prototypes above the first function, i.e. before `struct AuxValve` is declared. `avMove` now takes the valve index instead of `AuxValve&`. `tools/tests/hostsim/arduino_proto.py` emulates this step so the PC test catches it.
- **v5.1 web UI script aborted entirely**: `ui.on_message('od600_reinit_result', …)` and `ui.on_message('raw_status', …)` were placed before `const ui = new WebUI()`, so the browser threw "Cannot access 'ui' before initialization" and none of the following code (including all message handlers) ran. `ui` is now created at the top of the script.
- The pinch valve "blind move" uses the broadcast ID, so with the new valves online all three servos would turn together → the MCU now refuses blind moves while the new valves are online.
- When the MCU rejected `set_pump_pwm`, the backend still set its state to the new PWM → it now keeps the previous state and the web UI shows the reason.

## New features

1. **Base pump** (L298N second channel; since v4.1.1 the L298N uses six consecutive pins D8–D13: D8 IN1, D9 ENA, D10 IN2, D11 ENB, D12 IN3, D13 IN4, and the DS18B20 moved to D4). The MCU handles pulse timing (0.1–10 s), the feed-valve-in-position interlock, the hourly cumulative limit and the pressure protection interlock; manual base dosing switches the feed valve automatically.
2. **Automatic pH control** (`python/ph_control.py`, pure logic, testable on its own): below "target − deadband" → feed valve to Base → dose 5 s → wait for steady state (slope criterion) → decide whether to dose again; once the target is reached the feed valve returns. High pH only raises an alarm. No-response FAULT, hourly dose-count limit, and pause when pH is invalid / pressure protection is latched / a valve is offline. Events are written to `recordings/ph_dose_events.csv`.
3. **Shell sampling valve (ID 2) and feed valve (ID 3)**: STS3215 on the same bus as the pinch valve. The three state positions can be saved from the web UI; after an MCU reboot or App restart, the state the user last selected is restored (the feed valve's "Base" state is not restored); the servo ID can be changed from the web UI.
4. **Pressure protection**: any of the three channels > 0.70 bar (adjustable) for 50 ms in a row → stop the main pump, stop base dosing, release the pinch valve, latch; effective whether the pinch valve is open or closed. The Python side keeps the latch after an MCU reboot, so the pump is not turned back on automatically.
5. **Web UI**: two layouts, PC view and local display 1024×600 (the local display has five tabs and the page does not scroll); the key-value bar at the top is prioritised OD600 > pressure > pH > temperature = flow; derived parameters are now an expandable monitoring table; red banner for pressure protection.
6. **Recording**: 8 new CSV columns (105 in total); the raw data gains an `avalve` stream and the `aux` stream gains 3 columns; `meta.json` and the calibration file include the new settings.

## Upgrade notes

- The firmware and main.py must be updated together (main.py expects firmware v4.1.1).
- New servos all ship as ID 1, which conflicts with the pinch valve; change the IDs one servo at a time before wiring them in (README §3.9).
- `constants.json` gains four sections: `pressure_protect`, `base_pump`, `aux_valves`, `ph_control`; values changed in the web UI are still taken from `ph_valve_state.json`.
- When resuming an old recording whose columns differ, the data is automatically written to a new file (same mechanism as v5).
