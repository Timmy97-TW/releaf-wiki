# ReLeaf Perfusion Hollow Fiber Bioreactor

Monitoring and control App for a hollow-fiber membrane perfusion bioreactor on the Arduino UNO Q (App Lab): OD600, flow rate, three-point pressure and membrane-filtration derived parameters, pH (with **automatic base dosing**), temperature, peristaltic pump, **base pump**, STS3215 pinch valve plus **shell sampling valve / feed valve**, **0.7 bar pressure protection**, and on-board CSV and **raw data** recording.

> **Language note:** this is the English edition: code, comments, runtime log/error messages and this README contain no Chinese text. The web UI is bilingual (since v6.1): English by default, with a switch to Traditional Chinese at the top right; the Chinese text lives only in the page's translation table. A separate Chinese edition (Chinese logs, bilingual web UI, Chinese README, same program logic) is delivered alongside.

| Component | Current version | Location |
|---|---|---|
| MCU firmware | **v4.2.2** | `sketch/sketch.ino` |
| Python backend | **v6.2.2** | `python/main.py`, `python/growth_rate.py`, `python/ph_control.py`, `python/photometer_algos.py`, `python/od_gate.py`, `python/raw_logger.py` |
| Web UI | **v6.2.2** | `assets/index.html` |
| Constants | 2026-10-16-v6 | `python/constants.json` |
| Offline tools | v6.0 | `tools/replay_raw.py`, `tools/replay_od.py`, `tools/sim_ph_control.py` |
| PC simulation tests | v6.0 | `tools/tests/` (firmware, backend, web UI; see §16) |

> **New in v6.2.2:** the feed pump is **single-direction**. On the board IN3 (D12) never goes high, so everything on the second pump (feed run, base dosing) now drives IN4 (D13), the old "reverse"; IN3 stays low. The direction / reverse buttons and the IN3 / IN4 swap are gone. If the liquid flows the wrong way, swap the two motor wires on OUT3 / OUT4. Firmware v4.2.2 and main.py v6.2.2 must be updated together.
>
> **New in v6.2.1:** fix for a feed pump that runs in reverse but not forward (IN3 = D12): the firmware writes the direction pins last and re-asserts them every 200 ms, the feed pump panel has a **Wiring check** (hold IN3 / IN4 / ENB high, read the pin level back) and an **IN3 / IN4 swap** fallback (§3.5b). The pump column is regrouped: **Feed valve & feed pump** in one panel, **Pinch valve & shell sampling valve** in another. Firmware v4.2.1 and main.py v6.2.1 must be updated together.
>
> **New in v6.2:** the second L298N pump is now the **feed pump**: it sits right below the main pump with its own PWM, forward / reverse and stop, and what it pumps is chosen by the feed valve (§3.5b, §7.5b). Manual base dosing and the base dosing settings moved into automatic pH control; manual dosing only works while the feed valve is set to **Base**. Firmware v4.2.0 and main.py v6.2 must be updated together.
>
> **New in v6.1:** PC layout rearranged (OD600 + pH | pressure | pump & valves), temperature folded into the pH panel, **specific growth rate μ** on the OD600 panel (§7.1, §8.3).
>
> **New in v6.0: see §16** (base pump and automatic pH, shell sampling valve and feed valve, 0.7 bar pressure protection, two layouts: PC view / local display).
> **In v6.0 the firmware and the Python backend must be updated together** (main.py v6.2.2 checks for firmware version v4.2.2).
> **v6.0 has not yet been flashed and tested on real hardware**: the firmware, backend and web UI have all been run on a PC against a simulated MCU and simulated sensor signals (§16.6). For the first bring-up on the board, follow the order in §16.5.
> **v5.1 changed the default OD600 estimator from upper to mad; you must take a new blank after upgrading.**
> The older version-by-version documentation accumulated before 2026-10-08 is kept in `docs/README_legacy_2026-10-08.md`.

---

## Contents

1. [System overview](#1-system-overview)
2. [File structure and requirements](#2-file-structure-and-requirements)
3. [Hardware and wiring](#3-hardware-and-wiring)
4. [Electrical safety rules (must read)](#4-electrical-safety-rules-must-read)
5. [Deployment and boot](#5-deployment-and-boot)
6. [First-time setup procedure](#6-first-time-setup-procedure)
7. [Web UI](#7-web-ui)
8. [Measurements and calculations](#8-measurements-and-calculations)
9. [Safety protection mechanisms](#9-safety-protection-mechanisms)
10. [Data recording](#10-data-recording)
11. [Saving, exporting and importing settings](#11-saving-exporting-and-importing-settings)
12. [Communication between MCU and Python](#12-communication-between-mcu-and-python)
13. [Troubleshooting](#13-troubleshooting)
14. [Known limitations and to-do](#14-known-limitations-and-to-do)
15. [Version history (summary)](#15-version-history-summary)
16. [v6.0 new features and first bring-up on the board](#16-v60-new-features-and-first-bring-up-on-the-board)

---

## 1. System overview

Since v5.0 **the MCU is responsible only for sensor sampling, pump and pinch valve control, and the safety interlocks; all conversions, filtering, statistics and algorithms run in Python on the Linux side**. Every raw reading sent by the MCU is stored in full while recording.

```
┌──────────── Arduino UNO Q ────────────────────────────────────────────────────┐
│  MCU (STM32U585, Zephyr)                Linux (Debian, Docker)                 │
│  sketch.ino v4.0.0                      python/main.py v5.1 ── WebUI :7000 ────┼─▶ browser
│   ├ pressure 100 Hz ADC sums ─on_p_raw──▶ ├ bar conversion, zero, 1 s stats, TMP│
│   ├ flow pulse counting ─────on_flow_raw▶ ├ gate / reciprocal count, exact     │
│   │                                       │   window flow                      │
│   ├ BH1750 raw counts ───────on_od_raw──▶ ├ OD600 8 algorithms, blank          │
│   │  + I2C hang auto-recovery             │                                    │
│   ├ pH ADC sums, DS18B20 ────on_aux_raw─▶ ├ pH conversion, temp comp., filter  │
│   ├ pump PWM, kick-start                  ├ HFM derived params, steady, alarms │
│   └ pinch valve + interlocks (10 ms)      ├ aggregate CSV (one row per window) │
│          ▲  Bridge (115200 bps)           └ raw data recordings/<rec>_raw/     │
└──────────┼────────────────────────────────────────────────────────────────────┘
```

| Direction | Content |
|---|---|
| MCU **pushes** (`Bridge.notify`) | `on_p_raw` (a batch of 20 pressure samples every 200 ms), `on_flow_raw` (every second), `on_aux_raw` (every second: pH, temperature, pump status), `on_od_raw` (every OD attempt), `on_valve_update` (every second) |
| Python **calls** the MCU (`Bridge.call`) | Pump, pinch valve, OD trigger / LED alignment / re-initialisation, pressure zero offsets for the safety interlocks, measurement interval, diagnostics (every 5 s) |

- All safety protection (automatic pinch valve release, pump emergency stop) still runs on the MCU and stays effective if Linux or the web UI hangs.
- All sensor data is pushed by the MCU, so data keeps being recorded even if the Python → MCU command channel is down.
- Calibration values (pressure zero offsets, OD blank, path-length factor, pH calibration) are stored on the Linux side and **are not lost when the MCU reboots**.

---

## 2. File structure and requirements

```
app.yaml                 App name "ReLeaf Perfusion HFB"; declares the arduino:web_ui brick
sketch/sketch.ino        MCU firmware
sketch/sketch.yaml       Required library: SCServo (1.0.2)
python/main.py           Backend
python/photometer_algos.py  OD600 algorithms (same as inline photometer v1.2.0; shared with tools/replay_od.py)
python/raw_logger.py     Raw data logger
python/growth_rate.py    Specific growth rate mu from ln(OD600) (v6.1)
python/constants.json    Constants (algorithm parameters, thresholds, pinch valve defaults; conversion constants come from MCU get_config())
tools/replay_raw.py      Recompute pressure / flow / pH time series from raw data (runs on a PC, needs only Python 3.8+)
tools/replay_od.py       Re-run the 8 OD600 algorithms on raw readings
python/requirements.txt  May be empty
assets/index.html        Web UI
assets/libs/             Placed automatically by the WebUI brick (socket.io, arduino.js)
README.md                This document
docs/                    Legacy documentation, technical documents
```

Generated automatically under `python/` at runtime:

| File | Content |
|---|---|
| `calibration_state.json` | OD600 blank (one per each of the 8 algorithms), pressure zero offsets, path-length factor, with source tags |
| `ph_valve_state.json` | pH calibration (converted on the Linux side since v5.0), pinch valve settings, algorithms, HFM state (ρgh, ΔP–Q), spec overrides, pump kick-start, etc. |
| `recordings/*.csv` | Recording files and checkpoints |
| `recordings/<recording>_raw/` | v5.0 raw data (§10.2) |
| `recording_state.json` | Recording progress marker (used to resume after an interruption) |

**Requirements**

- Arduino App Lab; board core `arduino:zephyr` (1.0.0 on new boards; 0.90.0 on old boards; both tested)
- MCU libraries: `Arduino_RouterBridge` (bundled with App Lab), `SCServo 1.0.2` (added by sketch.yaml)
- OneWire is not needed: the DS18B20 driver is built in

---

## 3. Hardware and wiring

> The UNO Q MCU pins use **3.3 V logic**; always treat them as **not 5 V tolerant**. Confirm that every external signal is ≤ 3.3 V before it enters the board.

### 3.1 Pin table

| Pin | Function | Direction | Notes |
|---|---|---|---|
| D0 / D1 | STS3215 bus (Serial1, 1 Mbps): pinch valve ID 1, shell sampling valve ID 2, feed valve ID 3 | RX / TX | Via a Waveshare Bus Servo Adapter (A); all three servos in parallel on the same bus |
| D2 | ZJ-TM02 flow meter | Input (interrupt) | Signal must be divided down to ≤ 3.3 V |
| D3 | OD600 LED (via 2N2222) | Output | 1.2 kΩ to the base |
| D4 | DS18B20 thermometer DQ (moved from D8 in v4.1.1) | Open drain | 4.7 kΩ pull-up to **UNO Q 3.3 V** |
| D5 / D6 | Unused | — | |
| D7 | Unused | — | Planned: external power relay |
| **D8 / D9 / D10** | L298N **IN1 / ENA (PWM) / IN2** (main pump) | Output | **D8–D13 are six consecutive pins** (v4.1.1), three pins per pump |
| **D11 / D12 / D13** | L298N **ENB (PWM) / IN3 / IN4** (feed pump) | Output | D11 is PWM-capable; D12 / D13 are plain outputs for direction |
| A0 | Pressure Feed = **Lumen in** (P_in) | Analog | 15 k / 22 k divider |
| A1 | Pressure Retentate = Lumen out (P_out) | Analog | Same as above |
| A2 | Pressure Permeate = Shell (P_s) | Analog | Same as above |
| A4 | pH probe (DFRobot SEN0169-V2) | Analog | Analog isolation module recommended |
| SDA / SCL | BH1750 ×2 (OD600) | I2C | sample `0x5C`, reference `0x23` |

### 3.2 Pressure transmitters ×3

The transmitters are powered from 12 V and output 0–5 V for 0–10 bar. Each has its own voltage divider:

```
transmitter signal ──[15 kΩ]──┬── A0 / A1 / A2
                             [22 kΩ]
                              │
                             GND        ratio 0.5946: 5 V → 2.97 V
```

If you change the resistors, only update `DIV_R_TOP_KOHM` and `DIV_R_BOTTOM_KOHM` in the sketch. Measure the actual resistances with a multimeter and enter those values.

### 3.3 Flow meter (ZJ-TM02)

Powered from 5 V; the signal goes to D2 through a divider, and the pulse high level must be ≤ 3.3 V. `PULSES_PER_LITER = 2580` (large-bore version; use 5160 for the small-bore version).

### 3.4 OD600

```
D3 ──[1.2 kΩ]──┬── 2N2222 base
              [10 kΩ]── GND
5 V ──[330 Ω]── LED ── collector; emitter ── GND
```

BH1750 (GY-302) ×2: SDA/SCL to the UNO Q; ADDR to 3V3 for sample (`0x5C`), to GND for reference (`0x23`). **Powering VCC from 3.3 V is recommended** so that the module's pull-up resistors do not pull SDA/SCL up to 5 V.

### 3.5 Peristaltic pump (L298N)

```
UNO Q D8  ──[1 kΩ]── IN1
UNO Q D9  ──[1 kΩ]── ENA (with the jumper cap removed, the pin NOT connected to 5V)
UNO Q D10 ──[1 kΩ]── IN2
UNO Q GND ───────── GND (common ground only; no motor current)

Add 10 kΩ from each of ENA, IN1, IN2 to GND (pull-down: the pump always stops when the MCU reboots or the pins float)

12 V(+) ──┬────────┬──── L298N +12V        470 µF (≥25 V, mind the polarity)
       [470µF]  [100nF]                    100 nF ceramic
12 V(−) ──┴────────┴──── L298N GND
```

- **Keep the 5V jumper** (the module generates its own 5 V logic supply from 12 V); **leave the +5V terminal unconnected**, and never connect it to the UNO Q.
- **The ENA jumper cap must be removed.** Check with a multimeter: the pin connected to the +5V terminal is the 5 V pin; the other one is ENA.
- Motor current returns directly to the 12 V supply; do not route it through the UNO Q GND.
- The 12 V supply must not exceed 12 V (limit of the module's regulator).

### 3.5b Feed pump (second channel of the same L298N; base pump until v6.1)

```
UNO Q D11 ──[1 kΩ]── ENB (remove the ENB jumper cap as well)
UNO Q D12 ──[1 kΩ]── IN3
UNO Q D13 ──[1 kΩ]── IN4
Add 10 kΩ from each of ENB, IN3, IN4 to GND
Feed pump connects to OUT3 / OUT4
```

**Since v4.2.2 the feed pump runs in one direction only: IN4 high, IN3 low** (IN3 = D12 does not go high on the board, so the old "forward" is not used). The feed run and base dosing pulses both use this direction. If the liquid flows the wrong way, swap the two motor wires on OUT3 / OUT4. (v4.2.0–v4.2.1: forward = IN3 high, reverse = IN4 high.)

**Runs in reverse but not forward (v6.2.1):** reverse working means ENB (D11), IN4 (D13), the 12 V supply and the motor are fine, and IN3 (D12) never goes high. Open **Feed valve & feed pump → Wiring check**:

1. Press **IN3 (D12) high** (held for the time in "Hold", default 10 s, then switched off automatically). Measure the UNO Q header pin **D12** against GND: it should read about 3.3 V. Then measure the **IN3** terminal on the L298N.
2. 3.3 V on D12 but not on IN3: the ribbon cable or its connector. No voltage on D12, and the read-back line shows `IN3 (D12) = LOW`: the board does not drive D12.
3. **IN3 + ENB (forward, full speed)** runs the motor forward without the direction logic, as a cross-check.
4. Result on the real board: D12 cannot be used (and the ribbon cable only reaches D8–D13), so v4.2.2 drives the pump on IN4 only (see above). The v6.2.1 **Swap IN3 / IN4** option and the **IN3 + ENB** button were removed again in v6.2.2.

Firmware v4.2.1 also writes ENB first and IN3 / IN4 last and re-asserts the IN levels every 200 ms, because D12 (PB14) is also a timer output (TIM1_CH2N) in the UNO Q device tree and a PWM write elsewhere could hand the pin back to the timer. If that was the cause, forward works after flashing v4.2.1 without any rewiring.

**If the pump does not turn (v6.1 and earlier):** the firmware only ran this pump as a base dosing pulse, and only while the feed valve (servo ID 3) was online and confirmed at the **Base** position, so with the feed valve missing, on another ID or not at Base, nothing moved even with correct wiring (the Serial Monitor printed nothing and the web UI showed "feed valve not confirmed at base position"). Since v4.2.0 the feed pump runs from its own panel without needing the feed valve; it only refuses while the feed valve is online and **fully closed**. If it still does not turn at PWM 255: check that the ENB jumper cap is removed, the motor supply (12 V) is connected to the L298N and its GND is shared with the UNO Q GND.

### 3.6 pH probe

DFRobot SEN0169-V2, OUT → A4 (an analog isolation module is recommended), output 0–3.0 V.

### 3.7 DS18B20 thermometer (waterproof probe)

```
UNO Q 3.3V ──┬──────────── red (VDD)
           [4.7 kΩ]
UNO Q D4 ────┴──────────── yellow / white (DQ)
UNO Q GND ──────────────── black (GND)
```

- The waterproof probe has **no** internal pull-up; you must add the 4.7 kΩ yourself. The resistor goes from DQ to **3.3 V**, not to GND.
- Connect both VDD and the pull-up to **the UNO Q 3.3 V**, not to the power distribution board. An unpowered sensor pulls DQ low and causes back-feeding.
- Follow the seller's color code. Swapping VDD / GND makes the sensor overheat and fail.

### 3.8 STS3215 pinch valve

```
UNO Q D0 (RX) ──[1 kΩ]── driver board RX     Waveshare labels: RX→RX, TX→TX (not crossed)
UNO Q D1 (TX) ──[1 kΩ]── driver board TX
UNO Q GND ────────────── driver board GND
Driver board jumper: A (UART mode); power = servo rated voltage (12 V for the 12 V version)
```

The driver board TX / RX were measured to be 3.3 V logic. The driver board has its own supply and still feeds current through D0 / D1 when the UNO Q is unpowered, so use series resistors and follow the power-up sequence.

### 3.9 Shell sampling valve and feed valve (STS3215 ×2, v6.0)

The two new servos are **in parallel with the pinch valve on the same bus** (same driver board, same baud rate). All STS3215 servos ship as **ID 1**, the same as the pinch valve, so on first wiring you must change the IDs one servo at a time:

1. Power off, connect only new servo A (unplug the pinch valve first), power on, and in the web UI go to **Sampling & feed valves (STS3215) → Valve setup (positions / servo ID) → Change servo ID (new servos ship as ID 1)** and change 1 to **2** (shell sampling valve).
2. Power off, swap in new servo B and likewise change 1 to **3** (feed valve).
3. Power off and reconnect all three. The ID is stored in the servo EEPROM and is not lost on power-off.

| Valve | ID | Closed | Second position | Third position | After boot |
|---|---|---|---|---|---|
| Shell sampling valve | 2 | 315° (3584) | To sensor 270° (3072) | Fully open: sensor + collection bottle 0° (0) | To sensor (or the state the user last selected) |
| Feed valve | 3 | 315° (3584) | Base 270° (3072) | External feed 180° (2048) | Closed (or the state the user last selected; "Base" is not restored) |

Angle conversion: position = angle ÷ 360 × 4096. If the actual mounting is off, in **Valve setup** use **Torque off (turn by hand)** to turn it by hand or **Move** to approach the position, then press **Save position**.

---

## 4. Electrical safety rules (must read)

Two UNO Q boards were destroyed in 2026-10 (3.3 V shorted to GND, power IC on the back of the board overheating). The code was checked line by line and cannot cause this kind of damage; the cause is external voltage or current entering the UNO Q. All of the following rules apply:

1. **Before any rewiring, power everything off (12 V, power distribution board, UNO Q).** Never plug or unplug while powered, and never "plug in the new wire before removing the old one".
2. **The UNO Q 3.3 V, 5 V and VIN pins only supply small loads outward** (thermometer, pull-up resistors) and must never be connected to the power distribution board, the L298N or any external supply.
3. **Power-up sequence**: first the UNO Q (USB-C); wait until the Serial Monitor shows `[boot] … entering loop()`, then switch on 12 V and the power distribution board; reverse the order when shutting down. Switching external power on first back-feeds through the signal pins, prevents the MCU from booting, and can destroy it over time.
4. **Put a current-limiting resistor in series with every signal line**: 1 kΩ each on D0, D1, D8–D13; 4.7 kΩ each on D2, A0–A2, A4. Even if 5 V / 12 V accidentally appears on a line, the current is limited.
5. **Every signal entering the UNO Q must be ≤ 3.3 V.** Before connecting a new board, unplug the UNO Q, switch on all external supplies and measure every line with a multimeter:
   - D0, D2, SDA, SCL, A0–A4: ≤ 3.3 V
   - Lines that used to go to the UNO Q 3.3 V / 5 V / VIN: 0 V
   - For any line reading 3 V or more, put 1 kΩ to GND across it and measure again; if the voltage barely drops, the line can source real current and needs special handling.
6. **L298N**: see §3.5 (remove the ENA jumper, leave +5V unconnected, capacitors on the 12 V input, 10 kΩ pull-downs, star grounding).
7. **Liquids**: the system contains culture medium; check that there is no liquid or dried salt residue near the breadboard and wiring.
8. **On a new board, first connect only USB** and run `mcu_selftest`; once it passes, reconnect the peripherals one group at a time, rebooting after each group to confirm.

**Root fix (to be implemented)**: power the external supplies through a relay or load switch controlled by the MCU (D7), so they are switched on only after the MCU has finished booting and are cut together with the UNO Q.

---

## 5. Deployment and boot

1. App Lab → Import App → select the complete App zip (or replace `sketch.ino`, `main.py` and `index.html` as whole files; do not copy and paste fragments).
2. Run. The App Lab output window should show `SCServo` being added, `Sketch uses … bytes`, and the upload completing.
3. The Serial Monitor should show, in order:
   ```
   [boot] ReLeaf sketch v4.0.0 (raw acquisition) starting, Bridge.begin=OK
   [boot] step: core Bridge functions registered
   [boot]   sample    0x5C: ok (0 ms)        ← ok / nak (no device at the address) / timeout (bus hung)
   [boot]   reference 0x23: ok (0 ms)
   [boot] BH1750 (MTreg 69, H-res mode 2) sample=OK reference=OK
   [boot] ready (raw acquisition: on_p_raw / on_flow_raw / on_od_raw / on_aux_raw)
   [boot] entering loop()
   [diag] loop_max_us=… p_samples/s=100 pskip=0 pbatch=… …   ← one line every 10 seconds
   ```
4. Open `http://<board IP>:7000` in a browser (do not use the file preview). After replacing files press Ctrl+Shift+R and confirm that the status bar shows "MCU: ● OK (v4.0.0)", `main.py v5.1` and `UI v5.1`.
5. LED pattern after boot: 2 quick blinks → steady on (connecting to Bridge) → off, then 3 blinks (initialisation complete). No blinking at all = sketch not loaded; stuck at steady on = stuck at Bridge.

**MCU not responding at all (no `[boot]`, Python shows `method … not available`)**: unplug the UNO Q USB-C, wait at least 10 seconds and plug it back in. Re-running the App does not restart the Bridge service on the Linux side.

---


**First bring-up check on the board (v5.0 not yet tested on real hardware)**

1. Serial Monitor `[diag]` lines: `p_samples/s` should be close to 100 and `pskip` should not keep increasing.
2. The Python Console should not show `on_p_raw parse failed`; it should show `[mcu] firmware version: v4.2.0` without the version-mismatch warning `!! differs from … expected by main.py`.
3. Pressure values in the web UI move and the flow rate roughly matches reality; under **Engineering mode → MCU link status & tests**, the diagnostics show no steadily increasing `p_dropped_batches` (it increases when Bridge bandwidth is insufficient; see §12).
4. Record for 1 minute and stop; under **Recordings on the board** press **raw data**, and you should see `pressure_*.csv.gz`, `flow_*`, `aux_*`, `od_raw.csv`, `events.csv`, `meta.json`.

## 6. First-time setup procedure

After assembling new tubing, changing the membrane or changing the board, do the following in order:

0. **When upgrading from v4.x**: the OD600 sensor setting changed to MTreg 69 + high-resolution mode 2 (photometer v1.2.0), so **old blanks no longer apply; take a new blank** (the old value is applied initially but flagged with a yellow notice). Pressure zero offsets and pH calibration values are kept.
1. **Pressure zeroing**: with the system vented (open to atmosphere), press **Zero calibrate** (v5.0: Python collects 3 seconds of raw data, averages it, then pushes it to the MCU for the safety interlocks).
2. **ρgh self-test**: stop the pump (PWM 0) → **Start self-test**. It waits 10 s for the flow to decay and records 30 s; the reading must be a plateau (≤ 0.15 kPa/min). **Redo this every time the module is re-mounted**: ρgh is set by the vertical height difference between the two ends; tilted inside the incubator (about 40–50 cm) it is about 3.9–4.9 kPa, not the 5.9 kPa of a fully vertical module.
3. **ΔP–Q sweep**: clean membrane, pinch valve open → enter the PWM points → **Start sweep** → review the result and apply the fit (§7.3).
4. **pH calibration**: pH 7.00 → pH 4.01 buffer; the temperature defaults to the thermometer (put the thermometer into the buffer as well). v5.0 uses the average voltage of the last 5 seconds as the calibration point; the buffer temperature at the pH 4.01 point is the calibration temperature for the slope.
5. **Pinch valve positions**: move the servo until it just pinches the tube → **Save current as "pinched"**; same for the open position.
6. **Operating parameters**: check the Q_L source, Q_perm and culture volume (§7.2).
7. **Export calibration** as a backup (§11).

---

## 7. Web UI

Two layouts can be selected at the top right (remembered by the browser; you can also force one by adding `?mode=local` or `?mode=pc` to the URL):

- **Desktop** (PC view), v6.1 layout in three columns:
  - **Left**: OD600 (chart on top, value cards below it, the specific growth rate μ next to the current OD600), then pH (chart, then current pH / temperature / probe voltage), then **pH meter calibration & adjustment** (open by default; it holds probe calibration, automatic pH control and the base pump, and shows the automatic pH state in its header when collapsed).
  - **Middle**: pressure and derived analysis; the pressure-protection limit sits in the toolbar; the four pressure cards and the max-pressure status bar sit below the chart.
  - **Right**: main pump, **feed valve & feed pump** (v6.2.1), **pinch valve & shell sampling valve** (v6.2.1), data recording (with **Sampling settings** and **Algorithm selection** folded inside it), then the collapsed **Calibration values & specs**. **Engineering mode** is folded at the bottom of the OD600 panel.
- **Local 1024×600** (local display): for the 7-inch touch screen attached to the board. The page does not scroll; the bottom is split into five tabs (**Monitor**, **pH / Temp**, **Pumps / Valves**, **Record**, **Settings**), with enlarged buttons.

The local display has a **key-value bar** at the top (v6.1: the PC view has none, its panels show the same values), sized by priority: **OD600 > max pressure > pH > temperature = flow**. The red line on the max-pressure bar is the pressure protection limit; tapping any cell jumps to the corresponding panel (in local mode it switches to the corresponding tab). When pressure protection trips, a red banner with a **Clear pressure trip** button appears above the bar and is visible on every tab.

The web UI starts in English; the language switch at the top right changes it to Traditional Chinese and back (remembered by the browser). Messages that come from the backend (fault reasons, log lines) stay in English in either language. Values marked "ⓘ" or clickable values open an explanation (meaning and normal range).

### 7.1 Growth-related parameters

- **OD600**: measured automatically every 30 s (adjustable in the sampling settings); the blank can be calibrated in engineering mode.
- **pH**: updated every second; temperature compensation uses the thermometer by default and falls back to the manual temperature only when the thermometer cannot be read.
- **Specific growth rate μ** (v6.1): second card below the OD600 chart, in h⁻¹, with doubling time, R² and the number of points in the fit window. Computed by the backend (§8.3); the fit window, minimum points and minimum OD are set at the bottom of **OD600 gating layer**.
- **Temperature** (v6.1: inside the pH panel): tap the **Temp (compensation)** card to open the temperature trend, the DS18B20 status and source (thermometer / manual), the **manual temperature** input (used when the thermometer cannot be read) and **Probe diagnostics / rescan now**. When the sensor cannot be read, the Serial Monitor prints `[ds18b20] search #N: <reason>` every 10 s; when it works, the temperature is printed every 30 s.

### 7.2 Pressure and membrane filtration monitoring

- **Derived parameter monitoring table** (v6.0, expandable): when collapsed, the header shows L_p, TMP_in, γ_ratio and the number of warning / critical items; when expanded, one table lists the key indicators (L_p, TMP_in, TMP_out, γ_ratio, ΔP ratio, shear rate, J) and the secondary / diagnostic parameters (§8.4). Abnormal rows are highlighted yellow / red; click a row name to open its explanation.
- **Operating inputs**: Q_L source (flow meter / manual) and manual Q_L, Q_perm (can be computed with **Q_perm from collected amount ÷ time**, g ÷ min), culture volume V.
- Trend charts: clogging indicators (γ_ratio, ΔP ratio), L_p; instantaneous P_out waveform.
- **Gravity-offset self-test & settings**: ρgh self-test, manual ρgh / a / b / Q_perm, **Set current state as ΔP baseline** (single-point scaling), ΔP–Q sweep.

### 7.3 ΔP–Q sweep

- Enter 2–10 PWM points, the sweep order (default **high to low**, to avoid unstable starts from rest at low PWM), the settle time per point (20 s) and the record time (30 s).
- Each point records ΔP_total = P_in − P_out and the flow; ΔP_friction = ΔP_total − ρgh.
- Fits a quadratic through the origin `a·Q + b·Q²` and a linear `a·Q`, showing R² and residuals; linear is recommended when b < 0. Nothing is written until you press **Apply**.
- After the sweep the original PWM is restored; manually changing the PWM or an emergency stop aborts the sweep and does not turn the pump back on.
- Measured points and the fit result (including `dp_total_kpa`, so the fit can be redone after ρgh is re-measured) are saved and can be exported.

### 7.4 Peristaltic pump

- The PWM slider or input box is only a preview; nothing is sent until you press **Apply**. Changing direction or pressing **Emergency Stop** first sets the PWM to zero. Emergency stop also releases the pinch valve.
- Click the flow-rate card to open the live flow-rate chart.
- **Kick-start**: when starting from stop, the pump first runs at the kick PWM (default 255) for 500 ms, then drops back to the target value; this solves pumps not starting at low PWM. Optional **Re-kick on stall**: if the flow meter sees no pulses for 3 s, kick once more, up to 3 times; not done while the pinch valve is not open.

### 7.5 Pinch valve (STS3215)

Pinch / release, pinched time, live TMP, FAULT and **Clear**, event log (duration of each pinch, TMP mean / peak, release reason). The pinch valve settings include the open / pinched positions, **TMP limit**, **Lumen in limit and basis**, maximum pinch time, torque, speed, servo ID and baud rate, auto-scan, and the D0–D1 loopback test.

### 7.5b Pressure protection, sampling and feed valves, base pump, automatic pH (v6.0)

(v6.1: automatic pH control is inside **pH meter calibration & adjustment**; v6.2: the second pump is the feed pump in the pump column, and manual dosing / dosing settings are part of automatic pH control.)

- **Pressure protection** (v6.1: in the pressure panel toolbar): limit setting (default 0.70 bar), live max-pressure bar, trip count, **Clear pressure trip** (§9.3).
- **Feed valve & feed pump** (v6.2.1, right below the main pump): the feed valve's three state buttons (Closed / Base / External feed, with position / temperature / load), then the feed pump (single direction, v6.2.2): PWM slider / input, **Apply** and **Stop**. The pump will not start while the feed valve is fully closed; automatic pH pauses while it runs. **Wiring check** (folded): hold IN3 or IN4 high for a few seconds, pin read-back (§3.5b).
- **Pinch valve & shell sampling valve** (v6.2.1): the pinch valve controls, then the shell sampling valve's three state buttons. Since v6.2 the feed valve's **Base** position can be selected by hand (needed for manual dosing). **Sampling & feed valve setup (positions / servo ID)** (at the bottom of this panel): move to a raw position, torque off / on, **Save current position as** a given state, ID / speed / acceleration, **Change servo ID**.
- **Manual dosing & base dosing settings** (v6.2: inside automatic pH control): dosing state, seconds used this hour, **Manual dose (s, 0.1–10)** (only while the feed valve is set to Base and the feed pump is stopped; the valve is not turned automatically any more), dosing PWM and hourly limit.
- **Automatic pH control**: **Enable automatic base dosing** (asks for confirmation), target pH, start deadband, high pH alarm, dose length per dose, advanced steady-state criteria and limits; state, doses this hour, pH change after the last pulse, **Clear FAULT** (§9.4).

### 7.6 Data recording

**Start Recording**, **Pause**, **Stop & Save**, **Save checkpoint**, **Timed Recording**, and the **Recordings on the board** list (§10).

### 7.7 Other panels (collapsed by default)

- **Sampling Settings**: sampling window length, aggregation method (median / mean).
- **pH probe calibration**, **Calibration Values** (including export / import and manual entry of the two pH calibration points), **Specifications** (membrane module geometry, volumes, fluid properties, alarm thresholds).
- **Algorithm selection**: flow, OD600 estimator, analysis source, aggregation, steady state, curvature.
- **Engineering mode**: OD600 blank / **Measure Now** / path-length factor, **LED alignment** mode (LED forced on with live ratio), **MCU link status & tests** (§12).

---

## 8. Measurements and calculations

Since v5.0 everything is computed in Python (`python/main.py`); the MCU only sends raw counts. Base units: pressure **bar** (kPa for derived parameters), flow rate **mL/min**, OD600 **AU**.

### 8.1 Pressure

```
MCU:    one sample every 10 ms = after switching channel, discard one reading + sum of 16 ADC readings (14-bit, 0~262128); three channels in turn
Python: bar = sum / 16 / (2^14 − 1) × VREF / divider ratio / 5 V × 10 bar − zero offset
```

- The conversion constants (VREF 3.3, divider ratio 22/37, ADC resolution, oversampling count) are provided by MCU `get_config()`; if you change the resistors, only change `DIV_R_TOP_KOHM` and `DIV_R_BOTTOM_KOHM` in the sketch.
- For each batch (200 ms), peak / trough / mean / pulsation frequency over the last 1 s are computed; once the pulsation frequency f is measured, the window is automatically lengthened to 3 / f seconds (at most 5 s) so that it covers several cycles.
- **TMP peak / trough use the same instant**: (Feed + Retentate)/2 − Permeate (v4.x combined the extremes of each channel separately). Strict TMP_out = minimum of the same-instant P_out − P_s over the last 3 s.
- The mean additionally gets an EMA (α = 0.3) for display; the analysis source now defaults to `raw`, without EMA.
- Zero offsets are stored on the Linux side; the same set of zero offsets is pushed to the MCU for the safety interlocks.

### 8.2 Flow

Every second the MCU sends: pulse count, time from the first to the last pulse, cumulative pulses. Python:

- Gate count = pulses ÷ 1 s; reciprocal count = (pulses − 1) ÷ first-to-last interval (default; much more precise at low flow).
- **Flow for an aggregation window = total pulses in the window ÷ total time**, without the ±1-pulse quantisation of a 1 s gate (at 130 mL/min one pulse = 23 mL/min).
- Pulses per liter are in `constants.json → flow.pulses_per_liter` (large bore 2580, small bore 5160), so changing the flow meter does not require reflashing the MCU.

### 8.3 OD600 (ported from inline photometer v1.2.0)

- MCU: each measurement takes 4 dark readings → LED on for 60 ms → 16 lit readings; both BH1750s are fixed at MTreg 69 + high-resolution mode 2 (0.5 lx/count). **Hardware-level self-repair stays on the MCU**: all lit readings identical (stuck) → reset the I2C controller immediately and retry within the same measurement; read failure → non-blocking re-initialisation; sensors that failed at boot are retried automatically every 10 s; 3 consecutive I2C transactions ≥ 50 ms → pause that sensor for 2 s. Engineering mode also has a **Re-initialise light sensors** button.
- Python: 8 algorithms (mad, qn, biweight, upper, mean, median, p75, p90) are computed simultaneously on every measurement, each with its own blank; the OD600 estimator in **Algorithm selection** determines the displayed value and validity (default `upper`), and all 8 are written to the CSV. If the bubble fraction (share of readings more than 5% below the upper envelope P90) exceeds half, all algorithms are judged invalid and a new measurement is taken immediately.
- **Specific growth rate μ** (v6.1, `python/growth_rate.py`): least-squares slope of ln(OD600 reported value) against time over the last `window_min` minutes (default 60), using only readings the OD gate accepted and above `min_od` (default 0.02). It is shown once there are at least `min_points` readings (6) spanning `min_span_min` minutes (15). Doubling time = ln 2 / μ. The window restarts after a declared operation, a confirmed level shift, a new blank / estimator / path-length factor or a gate reset, so a dilution step does not appear as negative growth. Defaults are in `constants.json → od600.growth_rate`; values changed in the web UI are saved to `ph_valve_state.json`. The window starts empty after the App restarts.
- `OD600 = log10(blank S/R ÷ current S/R) × path-length factor` (default 5.0 = 1 cm / 0.2 cm). Single-beam mode (`constants.json → od600.optical_mode = single`) uses only the sample sensor.

### 8.4 Membrane filtration derived parameters (kPa)

| Parameter | Definition |
|---|---|
| TMP_out | P_out − P_s; the strict version uses the minimum of the same-instant P_out − P_s over the last 3 s |
| TMP_in | P_in − (P_s + ρgh) |
| TMP_mean | **(TMP_in + TMP_out)/2 = (P_in + P_out)/2 − P_s − ρgh/2** (v5.0 fix: v4.x did not subtract ρgh/2) |
| ΔP_friction | (P_in − P_out) − ρgh (subtracts the water column of the height difference between the two ends) |
| ΔP ratio | ΔP_friction ÷ (a·Q + b·Q²) |
| τ_w, γ_pressure | ΔP_friction × d ÷ (4L); τ_w ÷ μ |
| γ_flow, γ_ratio | 8v ÷ d; γ_pressure ÷ γ_flow |
| μ | **v5.0: when spec `mu_from_temp` = 1 and the DS18B20 has a reading, μ = viscosity of water at that temperature × `mu_water_factor`**; otherwise the fixed `mu_cp`. CSV column `mu_cp_used` |
| J, L_p, D, R_t, τ_shell | Based on manual Q_perm; L_p = J ÷ TMP_mean. **The initial L_p value is captured only at steady state; changing Q_perm re-captures it** |

Q_L comes from the flow meter by default and can be switched to manual. Ratio-type parameters are not computed when Q_L < 10 mL/min or when the flow data is stale.

**Alarms**: TMP_out ≤ 0, strict TMP_out ≤ 0, **instantaneous TMP peak > 0.5 bar, instantaneous TMP trough (minus ρgh/2) < −0.02 bar (restored in v5.0)**, TMP_mean > 50 kPa, ΔP ratio > 1.3, γ_ratio > 1.3, L_p < 70% of the initial value, P_s more than 2 kPa above the self-test value. Clogging-type alarms are suspended while the pinch valve is pinched and for 60 s after release.

ΔP–Q sweep fit: linear is recommended when the quadratic term is negative, there are fewer than 4 points, or the adjusted R² of the quadratic is no better than the linear fit.

### 8.5 pH and temperature

- MCU: every 500 ms, sum 256 ADC readings; read the DS18B20 raw value (1/16 °C) once per second.
- Python: voltage = sum ÷ 256 ÷ (2^14 − 1) × 3.3 V; temperature from the DS18B20 (status OK, read within 5 s, −10~100 °C, not 85.0), otherwise the manual temperature; `pH = 7 + (V − V7) × 2.99/(V7 − V4) × (T_cal + 273.15)/(T + 273.15)`; a jump > 0.5 must be seen 3 times in a row, then EMA (α = 0.2). Values outside 2–12 are flagged PROBE_ERROR and not written to the pH column of the CSV.

---

## 9. Safety protection mechanisms

All run on the MCU and do not depend on Linux or the web UI.

### 9.1 Automatic pinch valve release

| Trigger (while pinched) | Action |
|---|---|
| **Lumen in (P_in, A0) > `feed_limit`** (default **0.5 bar**) for **5 consecutive 10 ms samples (50 ms)** | Release + latch FAULT |
| Same-instant TMP = (Feed + Retentate)/2 − Permeate > `tmp_limit` (default 0.5 bar) for 5 consecutive samples | Release + latch FAULT |
| Pinch time > `max_close_s` (default 900 s) | Release + latch FAULT |
| Servo temperature ≥ 60 °C | Release + latch FAULT |
| Servo does not respond 3 times in a row while pinched | Latch FAULT; moves to "open" automatically when it comes back online |
| Pump emergency stop | Release (no FAULT latch) |
| MCU boot | Always moves to "open" |

- Firmware v4.0.0: every 10 ms sample is checked, and the valve is released after 5 consecutive samples over the limit. v3.10.x used "peak of a 1 s sliding window, 2 consecutive 200 ms windows", but adjacent windows overlapped by 80%, so a single 10 ms noise spike could trigger it.
- The Lumen in basis is selectable: **instantaneous value** (default, 5 consecutive samples) or **mean of the last 1 second** (less prone to false triggers from pulsation). Change it under **Valve settings (open/closed positions, speed, safety limits)** (UI options: **Instantaneous peak (stricter)** / **Mean**).
- On a trigger the Serial Monitor prints `[valve] !! pressure too high, pinch valve auto-released: Lumen in 0.549 bar > 0.50`, the web UI shows FAULT, and the release reason is written to the event log.
- In the FAULT state pinching is refused; remove the cause first, then press **Clear**.
- If an old saved Lumen in limit is still the old default of 1.0 bar, it is changed automatically to 0.5 bar on the first start after the upgrade (done only once; values you change yourself afterwards are left alone).

### 9.2 Pumps

The first boot step drives D8–D13 all low; emergency stop stops both pumps and releases the pinch valve. In hardware, adding 10 kΩ pull-downs is recommended (§3.5).

### 9.3 Pressure protection (v6.0, runs on the MCU, effective whether the pinch valve is open or closed)

| Trigger | Action |
|---|---|
| **Any one** of Feed / Retentate / Permeate **> limit** (default **0.70 bar**) for **5 consecutive 10 ms samples (50 ms)** | Stop the main pump, stop the base pump, release the pinch valve, latch |

- While latched, the MCU rejects `set_pump_pwm` (> 0), and the web UI pump panel shows the reason.
- **Clear pressure trip** succeeds only when the pressure has fallen back below the limit; after clearing, the main pump **stays stopped** and you must press **Apply** again.
- An MCU reboot clears the MCU-side latch, but the Python side keeps the latch (the pump is not turned back on automatically and the alarm does not disappear); the user still has to clear it.
- The limit can be changed in the web UI (0.1–5.0 bar); it is saved and pushed back after an MCU reboot. The v4.0.0 pinch valve interlock (§9.1) is kept; both coexist.

### 9.4 Base pump and automatic pH (v6.0)

MCU-side interlocks (effective even if Linux hangs):
- The pump runs only when the feed valve is **in the Base position and has arrived there**; if the feed valve leaves the position or goes offline during dosing, the pump stops immediately.
- Single pulse 0.1–10 s (hard limit); hourly cumulative run-time limit (default 60 s, adjustable 0–600 s).
- It does not run while pressure protection is latched; emergency stop stops it as well.

Python side (`ph_control.py`, pure logic, once per second):
- pH < target − deadband → feed valve to Base → dose for `pulse_s` seconds → wait at least `settle_min_s` and until the pH slope over the last `steady_window_s` is < `steady_slope_per_min` (wait at most `settle_max_s`) → if pH ≥ target, finish and return the feed valve to its previous state; otherwise dose again.
- If pH rises by less than `min_response_ph` for `no_response_n` consecutive pulses → **FAULT** (base solution used up, tubing blocked); the feed valve is returned, and you must press **Clear FAULT**.
- Invalid pH reading, pressure protection latched, or feed valve offline → pause; re-evaluate after recovery. Hourly dose-count limit `max_doses_h`.
- pH > the high alarm value only raises an alarm (the system has no acid dosing).
- Every event is written to `recordings/ph_dose_events.csv` and to the events of the raw data.

---

## 10. Data recording

- Recording happens entirely on the board: at the end of each sampling window (default 30 s) the row is written and fsynced immediately to `python/recordings/record_YYYYMMDD_HHMMSS.csv`. Sleeping the PC, closing the browser, or even restarting the App does not interrupt it; after an App restart it resumes the same file automatically, and the `gap_s` column marks the interruption.
- **Checkpoint**: while recording or paused, press **💾 Save checkpoint** to copy the CSV so far to `<original-name>_checkpoint_YYYYMMDD_HHMMSS.csv` and download it automatically; recording is not interrupted.
- Data that cannot be read is left empty, never written as 0 (for example, when flow was neither pushed nor successfully polled, the flow columns for that window are blank and the flow-rate card in the web UI is dimmed).
- Download: automatically on stop, or from the **Recordings on the board** list (HTTP endpoint `/download/recording?name=…`).

### 10.1 Aggregate CSV (one row per sampling window, 109 columns)

| Group | Columns |
|---|---|
| Window | window_index, elapsed_s, timestamp_start, timestamp_end, window_sec, gap_s, agg_method, n_samples_pressure, n_samples_flow, partial |
| OD600 | od600_au, od600_lux_sample, od600_lux_ref, od600_bubble_pct, od600_valid, od600_blank_set, od600_age_s, od600_new, od600_alg, od600_bubble_frac_pct, od600_flags, od600_reported, od600_p90, od600_gate_accepted, od600_gate_reason, od600_gate_d_disc, od600_gate_d_jump, od600_gate_pending, **od600_mu_per_h, od600_mu_r2** (v6.1 specific growth rate and fit R², blank while collecting), od_mad … od_p90 (8 algorithms) |
| Flow | flow_mlmin (total pulses in the window ÷ time), flow_freq_hz, flow_total_ml, flow_pulses |
| Pressure | pressure_feed_bar, pressure_retentate_bar, pressure_permeate_bar, pressure_tmp_bar, pressure_tmp_peak_bar, pressure_tmp_trough_bar, pressure_cycle_freq_hz |
| Pump / pH / pinch valve | pump_pwm, pump_forward, ph, ph_temp_c, temp_src, ph_state, valve_state, valve_closed_frac, valve_pos |
| v6.0 | shell_valve, feed_valve (state at the end of the window; offline is written as offline), **feed_pump_pwm, feed_pump_forward** (v6.2, feed pump PWM 0–255 and direction 1 / 0 at the end of the window), base_pulses, base_pulse_ms (number of base doses and total milliseconds in this window), ph_ctrl_state, ph_target (blank when disabled), p_trip (1 = latched at some point in this window), p_max_bar (maximum of the 1 s peaks of the three channels) |
| Derived parameters | delta_p_bar, rho_gh_kpa, tmp_out_kpa, tmp_out_min_kpa, dp_friction_kpa, dp_ratio, tau_w_pa, gamma_pressure_s1, gamma_flow_s1, gamma_ratio, re, tmp_mean_kpa, tmp_in_kpa, tmp_nonuniformity, ps_kpa, q_perm_mlmin, j_lmh, lp_lmh_bar, d_actual_h, rt_m1, tau_shell_min, mu_cp_used |
| Trend and steady state | dtmp_dt_bar_per_min, d2tmp_dt2, steady |
| Dispersion within the window | tmp_sd_bar, tmp_iqr_bar, tmp_min_bar, tmp_max_bar, feed_sd_bar, flow_sd_mlmin, flow_iqr_mlmin, flow_min_mlmin, flow_max_mlmin |
| Traceability | alg_profile, p_raw_dropped (pressure batches missed in this window), raw_dir, config_version, constants_version |

Pinch valve events are saved separately to `recordings/valve_events.csv`; base dosing events to `recordings/ph_dose_events.csv`. The CSV column definition exists only in `main.py` (`CSV_HEADER` / `_row_to_csv_line`); the web UI no longer builds its own CSV. The raw data gains an `avalve` stream (the MCU's raw text for the two new valves), and the `aux` stream gains three trailing columns `base_on, base_left_ms, ptrip`.

### 10.2 Raw data (v5.0)

While recording, `recordings/<recording-name>_raw/` is also written; every raw value sent by the MCU is kept, so any algorithm can be re-run afterwards:

| File | Content | Volume |
|---|---|---|
| `meta.json` | Complete state at the start of recording: firmware / backend versions, MCU conversion constants, pressure zero offsets, OD blanks (8 algorithms), path-length factor, pH calibration, HFM state, specs, algorithms, pump, pinch valve settings | — |
| `events.csv` | Events that affect the conversion: zeroing, blank, pH calibration, algorithm change, Q_perm, ρgh self-test, ΔP–Q baseline, pump / pinch valve commands, MCU reboot, data gaps (`*_gap`), sensor re-initialisation | Rare |
| `pressure_YYYYMMDD_HH.csv(.gz)` | epoch_s, mcu_ms, batch_seq, feed_sum, retentate_sum, permeate_sum (sum of 16 ADC readings, **zero offset not subtracted**) | 100 rows/s |
| `flow_…` | epoch_s, mcu_ms, seq, window_ms, pulses, span_us, total_pulses | 1 row/s |
| `aux_…` | epoch_s, mcu_ms, seq, ph_samples (sum:count:time;…), ds_state, t_raw16, t_age_ms, ds_err, pump_pwm, pump_fwd, pump_kick | 1 row/s |
| `valve_…` | epoch_s, MCU raw text | 1 row/s |
| `od_raw.csv` | For each attempt, 4 dark + 16 lit readings (raw counts of both channels; same format as the inline photometer); at the start of recording, the raw readings of the most recent blank are written first | 1–2 rows per measurement |

- Pressure / flow / aux / pinch valve files rotate hourly and are gzipped in the background after the hour changes (about 1/4 the size); flush every 1 s, fsync every 5 s (a power loss loses at most about 5 s of raw data; the aggregate CSV is still fsynced on every row). Uncompressed 100 Hz pressure is about 300 MB per day, about 80 MB compressed.
- The recording section of the web UI shows the raw data size and the free disk space; below 2 GB it warns, below 500 MB it stops raw data logging (the aggregate CSV continues). The thresholds are in `constants.json → raw_logging`.
- Raw data keeps being logged while recording is paused (events are tagged `record_pause`/`record_resume`); when the App restarts and resumes recording, the same folder is reused.
- Download: the **raw data** button on each row of **Recordings on the board** opens the file list (HTTP `/raw?dir=…`).

**Offline recomputation (runs on a PC, needs only Python 3.8+)**

```bash
python3 tools/replay_raw.py recordings/record_20261014_154649_raw                    # one row per 1 s
python3 tools/replay_raw.py <raw folder> --interval 0.1 --start 10:00 --end 10:05    # view the pump pulsation waveform
python3 tools/replay_raw.py <raw folder> --offsets 0.2996,0.2496,0.0200               # use a different set of zero offsets
python3 tools/replay_od.py  <raw folder>/od_raw.csv --reference 0.80                  # 8 OD algorithms + Hampel
```

`replay_raw.py` applies the zero offsets and pH calibration in effect at the correct points in time according to `events.csv`; `replay_od.py` uses the same `photometer_algos.py` as the App.

## 11. Saving, exporting and importing settings

All settings are saved automatically when changed; when the MCU reboots (uptime decreases), Python automatically pushes back the calibration values, pH, pinch valve and kick-start settings, and restores the pump to the direction and PWM it had before the reboot.

**Calibration Values** → **Export calibration** produces a `.json`; **Import calibration** lets you tick which sections to apply:

| Section | Content |
|---|---|
| mcu_calibration | OD600 blank, pressure zero offsets, path-length factor |
| ph_config | pH 7 / 4 voltages, calibration temperature, manual temperature |
| hfm | ρgh, P_s reference, ΔP–Q a / b and source, ΔP–Q measured points and fit, Q_perm, initial L_p, Q_L source and manual value |
| specs | Membrane module geometry, volumes, fluid properties, alarm thresholds |
| valve_config | Open / pinched positions, TMP limit, Lumen in limit and basis, maximum pinch time, torque, speed, ID, baud rate (usually leave unticked when moving to another rig) |
| pump_kick | Kick-start settings |

---

## 12. Communication between MCU and Python

**Call queueing**: all Python calls to the MCU go through `_QueuedBridge`, one at a time, with a default timeout of 5 s (15 s for pressure zeroing, 8 s for thermometer diagnostics). This prevents a flood of simultaneous calls into the MCU when the browser reconnects (for example after the PC wakes from sleep). On the MCU side, all Bridge functions are registered with `provide_safe` and run sequentially in `loop()`.

**Disconnect detection**: 3 consecutive failed calls → the Console prints `[mcu] !! MCU not receiving commands…` and the web UI shows a red banner; on recovery it prints `[mcu] command channel restored`. The Serial Monitor prints `[rpc] !! no Python calls for 30 s …` when Python calls stop, and `[rpc] Python calls resumed` when they come back.

**Engineering mode → MCU link status & tests**: channel state, last successful time, call and failure counts, firmware, MCU uptime; **Resync**; **Stress test** (sends N read calls at once; all should succeed); **Simulate Python-side outage 30 s** (the red banner should appear and clear automatically).

> Automatic MCU reboot (watchdog) was added in v3.10.6; hardware testing showed that after a software reboot the UNO Q MCU does not reconnect to Bridge, so it was removed in v3.10.7. If the channel is interrupted, stop and restart the App manually; if that does not help, remove power for 10 seconds.

**v5.0 bandwidth**: the UNO Q Bridge runs at 115200 bps (about 11 KB/s, shared with Monitor.print). Raw pressure data is hex-encoded at about 360 bytes per batch of 20 samples, about 1.8 KB/s; everything else is a few hundred bytes per second, and routine logs were reduced to one line every 10 seconds. Every batch has a sequence number; when Python detects a gap it is counted in `p_dropped_batches` (web UI raw data status, CSV `p_raw_dropped`, `pressure_gap` in `events.csv`). If batches keep being dropped on real hardware, Bridge can be raised to 460800 bps (there is a method on the Arduino forum, but App Lab updates may overwrite it).

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No `[boot]`, every Python call gives `method … not available` | Bridge hung, sketch not loaded, back-feeding because external power was switched on first | Unplug USB-C for 10 s and plug back in; check the power-up sequence; connect only USB and run `mcu_selftest` |
| `not available` even on a new bare board, but selftest passes | Old versions registered functions only after the I2C scan / pinch valve ping | Fixed since v3.10.4 (functions registered first); wait at least 30 s before judging |
| Pump / pinch valve buttons do nothing, red banner (data still updating) | Linux → MCU command channel hung | Data keeps being recorded (including flow since v3.10.9); to operate, stop and restart the App (the pump stops, the pinch valve returns to open, recording resumes automatically) |
| No button in the web UI works, red box `WebUI is not defined` | Web UI opened via file preview | Open `http://<board IP>:7000` instead |
| Status bar shows `MCU is not running this sketch version` | main.py and sketch versions do not match | Replace both together and reflash |
| `OneWire.h` / `SCServo.h: No such file` | App Lab did not install the libraries in sketch.yaml | OneWire is no longer needed; add SCServo to the App's libraries |
| Thermometer not found, diagnostics `ext=0 int=0` | DQ pulled to GND: pull-up resistor wired wrong, sensor unpowered or wired backwards | 4.7 kΩ between DQ and 3.3 V; VDD to UNO Q 3.3 V |
| Thermometer `ext=1` but no presence | Sensor not connected or hung | Check DQ on D4 and common ground; power-cycle the sensor; test it standalone with the `ds18b20_test` App |
| Feed pump runs in reverse but not forward | IN3 (D12) never goes high on the board | Since v4.2.2 the pump only uses IN4; swap the motor wires on OUT3 / OUT4 if the flow direction is wrong |
| Pump does not turn at low PWM | Static friction | Kick-start (enabled by default) |
| Pressure readings off by about 1% | Divider ratio does not match the actual resistors | Measure the actual resistances and enter them in the sketch |
| Pinch valve often released automatically because of Lumen in | Peak includes pump pulsation | Switch the basis to **Mean**, or raise the limit moderately |
| STS3215 not found by scan | Jumper, wiring, power | Jumper A, RX→RX / TX→TX, common ground; use auto-scan and the D0–D1 loopback test |
| Board destroyed (3.3 V shorted to GND) | External voltage entered the UNO Q | See §4; measure all lines before replacing the board |
| OD600 reading drops to 0 or freezes and only recovers after a reboot (v4.x) | BH1750 still answers I2C after a reset but has left measurement mode, or the I2C controller is hung | v5.0 detects this and resets I2C automatically; if the Console keeps showing `sensor stuck`, check the GY-302 3.3 V supply (add 10 µF + 100 nF close to it), I2C wire length and jumper-wire contacts |
| Web UI shows `MCU is not running this sketch version`, pressure frozen | v5.0 main.py with v3.10.x firmware (or the other way round) | Replace both together and reflash |
| `p_dropped_batches` keeps increasing | Insufficient Bridge bandwidth or loop blocked | Check `loop_max_us` and `pskip` in `[diag]`; see §12 |

**Standalone test Apps**: `mcu_selftest` (checks the MCU and Bridge on a bare board), `ds18b20_test` (older versions test on D8 / D7; since v4.1.1 the thermometer is on D4, so change that App's pin to 4 before testing).

---

## 14. Known limitations and to-do

- The v6.0 base pump, the two new valves and pressure protection have only been simulated on a PC and not yet connected to real hardware.
- Automatic pH can only add base; high pH is not handled (no acid or CO₂ dosing).
- The pinch valve **Quick scan (~1 s)** uses a broadcast ping, so replies collide when several servos are on the bus; once the new valves are online, use **Full scan (~30 s)** or enter the ID directly. **Blind move** (broadcast) is refused while the new valves are online because all three would move together.
- The external power relay (planned on D7) is not implemented yet; the power-up sequence must still be followed manually.
- The hardware protection (series resistors, L298N pull-downs, BH1750 on 3.3 V) must be completed on the new board and verified by measurement.
- The STS3215 pinch valve has not yet been detected successfully on the original board; retest with the correct power-up sequence.
- The collection-bottle scale is not installed yet: J, L_p and D are based on manual Q_perm (in that case L_p only reflects changes in TMP).
- Level / tank-weight sensing and closed-loop feeding are not implemented.
- v5.0 has not yet been flashed and tested on real hardware; the actual drop rate of 100 Hz raw pressure at Bridge 115200 bps is still to be confirmed.
- No calibration curve between OD600 readings and spectrophotometer OD600 exists yet (the light source is an amber LED and the sensor is a wide-angle illuminance meter, non-linear at high OD); one can be built with `replay_od.py` on a dilution series.
- If a transmitter is not at the height of its port (P_s and P_out not at the same height), TMP_out needs an additional height correction.

---

## 15. Version history (summary)

| Firmware / backend / web UI | Date | Highlights |
|---|---|---|
| **v4.2.2 / v6.2.2 / v6.2.2** | 2026-10-16 | Feed pump single-direction on IN4 (IN3 = D12 does not drive on the board); direction buttons and IN3 / IN4 swap removed |
| v4.2.1 / v6.2.1 / v6.2.1 | 2026-10-16 | Feed pump forward fix (IN pins written last and re-asserted), wiring check with pin read-back, IN3 / IN4 swap; feed valve + feed pump and pinch valve + shell sampling valve each merged into one panel |
| v4.2.0 / v6.2 / v6.2 | 2026-10-16 | Second pump becomes the feed pump (continuous PWM, forward / reverse, under the main pump); manual dosing only while the feed valve is on Base; feed valve Base selectable; CSV adds feed_pump_pwm, feed_pump_forward |
| v4.1.1 / v6.1 / v6.1 | 2026-10-16 | PC layout rearranged; temperature folded into the pH panel; pressure-protection limit moved into the pressure panel; specific growth rate μ (OD600 panel, 2 new CSV columns, adjustable window) |
| v4.1.1 / v6.0 / v6.0 | 2026-10-16 | L298N moved to consecutive pins D8–D13 (IN1, ENA, IN2, ENB, IN3, IN4); DS18B20 moved to D4 |
| v4.1.0 / v6.0 / v6.0 | 2026-10-16 | Base pump (L298N second channel) and automatic pH control; shell sampling valve and feed valve (STS3215 ID 2 / 3); 0.7 bar three-channel pressure protection (in any valve state); two layouts (PC view / local display 1024×600), key-value bar, derived parameter monitoring table; fixed BUG-01 (web UI building the CSV), BUG-02 (pressure sampling stalled during valve diagnostics), BUG-03 (batch dt overflow); fixed the v5.1 bug where `ui` was not yet created when the web page loaded, aborting the whole script |
| **v4.0.0 / v5.1 / v5.1** | 2026-10-14 | Gate layer added after the OD600 estimator (`od_gate.py`): default estimator changed to mad; dispersion gate (\|OD−OD_p90\|), jump gate (compared with the last accepted value), a new level is accepted (with an alert) only after confirm_n consecutive consistent readings, reports the median of the last 3 accepted values, stall alert, **Declare operation (dilution / inoculation)** button; thresholds are pre-registered in `meta.json` before the run and can be recomputed afterwards with `replay_od.py --gate-*`. UI revised according to the derived-parameter review in the documentation: backflow alarm evaluated only while collecting (when closed, compared against −ΔP_f/2 instead), γ upper limit changed to 11,000 s⁻¹ (laminar-model limit, not a biological limit), Re > 2000 notice, Q_perm entered as collected volume / time, τ_shell and TMP non-uniformity shown conditionally |
| **v4.0.0 / v5.0 / v5.0** | 2026-10-14 | MCU only samples and controls; all algorithms moved to Python; raw data logging and offline recomputation tools; ported photometer v1.2.0's BH1750 stuck detection and automatic I2C reset (fixes light-sensor dropouts); 8 OD algorithms; safety interlocks now evaluated per 10 ms sample; per section 4 of the documentation, fixed TMP_mean, μ(T), flow quantisation, TMP peak/trough alarms, initial L_p, ΔP–Q model selection, pH calibration temperature |
| v3.10.9 / v4.12 / v4.13 | 2026-10-08 | Flow now pushed by the MCU (still recorded when the command channel is down); unreadable values left empty instead of 0; flow dimmed in the web UI when stale |
| v3.10.8 / v4.11 / v4.12 | 2026-10-08 | Automatic release when Lumen in > 0.5 bar while pinched (peak / mean selectable); old 1.0 bar default migrated automatically; new README |
| v3.10.7 / v4.10 / v4.11 | 2026-10-08 | Checkpoints; web UI version comparison now segment by segment |
| v3.10.7 / v4.9.1 / v4.10.1 | 2026-10-08 | Removed automatic MCU reboot (shown unreliable on hardware) |
| v3.10.5 / v4.8 | 2026-10-08 | Python call queueing, disconnect detection; all MCU functions provide_safe; `[rpc]` statistics |
| v3.10.4 | 2026-10-07 | Register Bridge functions first at boot; I2C probes only two addresses (core 1.0.0 new boards) |
| v3.10.1–v3.10.3 | 2026-10-06 | DS18B20 internal pull-up fallback, 1-Wire electrical diagnostics, retry logging every 10 s, timing calibration |
| v4.6–v4.9.2 | 2026-10-06 | ΔP–Q sweep (default high to low), temperature defaults to the thermometer, operating inputs |
| v3.10.0 / v4.4 | 2026-10-06 | Pump kick-start |
| v4.0–v4.5 | 2026-10-06 | Derived parameters redesigned per the HFM UI spec; calibration export / import, specification management, parameter help dialogs, main title |
| v3.8–v3.9.0 | 2026-10-05/06 | 15 k / 22 k dividers, DS18B20 (D8), full history charts, three-column layout, power-up sequence handling |
| v3–v3.7 | 2026-10-02/04 | Merged in pH and the STS3215 pinch valve, 14-bit ADC, algorithm selection |
| v1–v2.3 | 2026-09 | Merged three projects (OD600, flow rate + pressure, pump); non-blocking OD600; aggregated sampling, writing to disk and resuming after interruption |

---

## 16. v6.0 new features and first bring-up on the board

See `CHANGELOG_v6.0.md` for the detailed changes.

### 16.1 Division of responsibilities (kept and enforced)

- **MCU**: only raw sampling, actuators, I2C self-repair and the safety interlocks (pressure protection, base dosing interlock, pinch valve interlock). No algorithms.
- **Python**: all algorithms (conversion, derived parameters, OD gate, automatic pH decisions), saving and recording. No synchronous `Bridge.call` inside Bridge notify callbacks.
- **Web UI**: only displays and sends commands; it does not build CSVs or make control decisions.

### 16.2 New MCU Bridge functions

| Function | Description |
|---|---|
| `get_pressure_protect` / `set_pressure_protect("limit=0.70")` / `pressure_trip_clear` | Pressure protection |
| `base_pump_pulse("ms")` / `base_pump_stop` / `get_base_status` / `set_base_config("pwm=..,max_s_h=..")` | Base dosing pulse on channel B |
| `set_feed_pump("pwm=..,dir=1\|0")` | Feed pump continuous run (v4.2.0) |
| `chb_pin_test("in3=..,in4=..,enb=..,ms=..")` | Wiring check: hold the channel B pins HIGH / LOW for up to 30 s (v4.2.1) |
| `av_set("w,s")` / `av_goto_raw("w,pos")` / `av_torque("w,on")` / `av_get_status` / `av_get_config` / `av_set_config(...)` | Shell sampling valve (w=0) and feed valve (w=1) |
| `servo_set_id("old,new")` | Change servo ID (writes EEPROM) |
| notify `on_avalve_update`, `on_safety`; `on_aux_raw` gains `bon,bpwm,bleft,bhour,bmaxh,bcnt,bwhy,ptrip,plim` | |

### 16.3 New saved items (`ph_valve_state.json`)

`avalve_config`, `avalve_desired`, `pressure_protect`, `base_pump`, `ph_ctrl`. Calibration export / import also includes these (the automatic pH "enabled" flag is not carried in the file).

### 16.4 Defaults I chose for you (editable in the web UI)

| Item | Default | Rationale |
|---|---|---|
| L298N pins | D8 IN1, D9 ENA, D10 IN2, D11 ENB, D12 IN3, D13 IN4 | You specified consecutive pins D8–D13; of D8–D13 only D9, D10 and D11 support PWM, so ENA goes on D9 and ENB on D11, three pins per pump; the L298N header order is ENA IN1 IN2 IN3 IN4 ENB, so the wires must cross and a single ribbon cable cannot be used directly; the thermometer therefore moved from D8 to D4 |
| New valve IDs | shell 2, feed 3 | The pinch valve is 1 |
| Pressure protection | 0.70 bar, 50 ms | Your specification; same debounce as the existing interlock |
| Automatic pH | Target 7.00, start below 6.95, dose 5 s, wait at least 60 s, slope < 0.02 pH/min counts as steady, at most 12 doses per hour, FAULT after 3 consecutive doses with no response | 5 s comes from your specification; the rest is conservative to avoid overdosing |
| Base dosing hourly limit (MCU) | 60 s | 12 doses × 5 s; the MCU-side last line of defence |
| Boot state | shell to sensor, feed closed | Keeps measuring, no accidental feeding |

### 16.5 First bring-up on the board

1. Wire with the power off following the rules in §4 (feed pump §3.5b, new valves §3.9). **Change the IDs of the new valves one at a time** first.
2. Flash `sketch.ino` (v4.2.2); the Serial Monitor should show `[avalve] shell ID 2 online -> sensor` and `[avalve] feed ID 3 online -> closed`.
3. Start the App; the top right of the web UI should show `UI v6.2.2 · main.py v6.2.2` and MCU firmware v4.2.2.
4. First test **without tubing**: under **Feed valve & feed pump** and **Pinch valve & shell sampling valve** switch through the three states of each valve one by one and confirm the angles reached; recalibrate the positions if they are off.
5. Feed pump without the valve first: in **Feed valve & feed pump** set PWM 150 and **Apply**, check it turns, then **Reverse** and **Stop**. Then set the feed valve to **Base**, put the tubing into the base bottle and use a manual dose of 1 s (**Manual dose (s, 0.1–10)** = 1, then **Dose once**) to check direction and flow.
6. Pressure protection: temporarily lower the limit (e.g. 0.2 bar), run the main pump slowly, and confirm that the pump stops, the pinch valve is released and the red banner appears in the web UI; then set the limit back to 0.70 and clear the trip.
7. Enable automatic pH only at the very end (asks for confirmation).

### 16.6 PC simulation tests (`tools/tests/`)

| Test | Command | Content |
|---|---|---|
| Firmware | `cd tools/tests/hostsim && g++ -std=c++17 -O1 -I. -o sim sim.cpp && ./sim` | Builds `sketch.ino` as a PC program with fake Arduino / Bridge / servos: sampling rate, batch dt, pressure protection, base dosing interlock, feed pump (forward / reverse, closed-valve and trip interlocks), valves, ID change; 39 checks in total |
| Firmware (board build) | `cd tools/tests/hostsim && python3 arduino_proto.py ../../../sketch/sketch.ino /tmp/sketch_proto.ino && sed "s#../../../sketch/sketch.ino#/tmp/sketch_proto.ino#" sim.cpp > /tmp/sim_proto.cpp && g++ -std=c++17 -fsyntax-only -I. /tmp/sim_proto.cpp` | Emulates the Arduino builder, which inserts auto-generated function prototypes above the first function; catches signatures that use a type declared later in the sketch (plain g++ does not) |
| Automatic pH logic | `python3 tools/sim_ph_control.py` | Vessel model: normal, no-response FAULT, invalid pH, hourly limit, pH already high, feed valve offline |
| Backend integration | `cd tools/tests/pysim && python3 test_v6.py` | Loads the whole `main.py` with a fake `arduino` module: valves, feed pump, manual dosing only on Base, automatic base dosing (pauses while the feed pump runs), pressure protection (including MCU reboot), CSV columns, calibration file, recording; 46 checks in total |
| Web UI | `cd tools/tests/pysim && python3 capture.py msgs.json`, then `cd ../uitest && node run.js ../pysim/msgs.json shots` | Feeds simulated backend data into the web UI, takes 1024×600 and desktop screenshots, checks for JS errors |
