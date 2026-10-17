# Hollow-Fiber Membrane Filtration — Integrated Monitoring System

**Arduino UNO Q + Arduino App Lab**
OD600 photometer · pressure monitoring · flow-rate monitoring · peristaltic / diaphragm pump control · **pH monitoring · STS3215 pinch-valve sample collection** · continuous data logging

A single sketch (MCU firmware) + a single Python App (Linux side) + a single Web UI.
This document covers the **hardware specifications, wiring, power design, software architecture and version history**.

Last updated: 2026-10-03 | Program version: **v3.6** | Constants file version: `rig-v2-integrated` / `2026-10-03a`

> **The v3 additions are concentrated in [§12 pH Monitoring and Pinch Valve (v3)](#12-ph-monitoring-and-pinch-valve-v3)**; the other sections of this document were only updated where the pin table, Bridge interface, CSV columns and version table are concerned.

---

## Table of Contents

| Section | Contents |
|---|---|
| [0. System Overview](#0-system-overview) | Three-tier architecture, **current state vs. planned comparison table** |
| [1. Hardware Specifications](#1-hardware-specifications) | Component list, measurement specs, conversion formulas |
| [2. Pin Assignment](#2-pin-assignment) | Full pin table, UNO Q pin capabilities, known pitfalls |
| [3. Wiring](#3-wiring) | Step-by-step wiring instructions for each subsystem |
| [4. Power System](#4-power-system) | Power budget, three-rail architecture, grounding strategy |
| [5. Software Architecture](#5-software-architecture) | Data flow, Bridge interface, message protocol |
| [6. Data Logging](#6-data-logging) | CSV columns, flush-to-disk mechanism, retrieving files |
| [7. Calibration](#7-calibration) | Three calibrations, save/restore, manual entry |
| [8. Deployment and Operation](#8-deployment-and-operation) | Deployment steps, first start-up sequence |
| [9. Version History](#9-version-history) | Predecessor projects and every revision from v1 to v2.3 |
| [10. Troubleshooting](#10-troubleshooting) | |
| [11. Known Limitations and To-Do](#11-known-limitations-and-to-do) | |
| [12. pH Monitoring and Pinch Valve (v3)](#12-ph-monitoring-and-pinch-valve-v3) | Wiring, safety design, operating procedure, Bridge interface |

---

## 0. System Overview

### 0.1 Three-Tier Architecture

```
┌─── MCU (STM32U585, Zephyr) ─────┐   ┌─── Linux/MPU (Qualcomm, Debian) ───┐   ┌─ Browser ┐
│ • OD600 non-blocking state       │   │ • Bridge RPC client                 │   │          │
│   machine                        │   │                                     │   │          │
│ • Pressure 100Hz sampling +      │◀─▶│ • Aggregated sampling (median/mean) │◀─▶│ Web UI   │
│   sliding-window statistics      │   │                                     │ws│ operator │
│ • Flow pulse interrupt counting  │   │ • Derived params / trends / steady  │   │ interface│
│                                  │   │   state / alarms                    │   │ only     │
│ • Pump PWM output                │   │ • CSV logging (flushed per window)  │   │          │
│ • Real-time self-diagnostics     │   │ • Calibration save and restore      │   │          │
└──────────────────────────────────┘   └─────────────────────────────────────┘   └──────────┘
   Time-critical, deterministic work      State, files, tunable params, web service   Display & control
```

**Key design principle: logging happens entirely on the board.** The browser is only an operator interface; closing it, putting the PC to sleep or even shutting the PC down completely will not interrupt logging. See [§6.2](#62-flushing-to-disk-and-resuming-after-interruption).

### 0.2 Current State vs. Planned (Important)

The hardware is already ahead of the software; this table is the thing that most needs to be kept in sync right now:

| Subsystem | Hardware status | Software support | Notes |
|---|---|---|---|
| OD600 (2× BH1750 + LED) | ✅ Wired | ✅ Fully supported | |
| Pressure transmitters | ✅ **4 wired** | ⚠️ **Only 3 read** (A0–A2) | The 4th must go to A3; software extension pending |
| Flow meters | ✅ **2 wired** | ⚠️ **Only 1 read** (D2) | The 2nd is planned for D4; software extension pending |
| Pumps (L298N) | ✅ **2 wired** | ⚠️ **Only 1 driven** | The 2nd is the diaphragm pump; software extension pending |
| pH probe | ✅ | ✅ **v3** (monitoring and logging only since v3.1) | pH → A4 (see §12); KOH base dosing control removed |
| STS3215 pinch valve | ✅ | ✅ **v3** | Serial1 (D0/D1), manual open/close + MCU-side safety release |
| Relays ×3 (12V devices) | 📋 Planned | ❌ Not supported | D7 / D5 / A5 (A4 is now used by pH; D5 must wait for the pump pin relocation) |
| Dedicated power board | 📋 Planned | — | See [§4](#4-power-system) |

> **The current 12V 3A power adapter is not sufficient for the full configuration**; see [§4.1 Power Budget](#41-power-budget).

---

## 1. Hardware Specifications

### 1.1 Main Controller

| Item | Specification |
|---|---|
| Development board | Arduino UNO Q (ABX00162 / ABX00173) |
| MCU | STM32U585, runs Zephyr, handles time-critical work |
| MPU | Qualcomm Dragonwing, runs Debian, handles the App and the web UI |
| Logic voltage | **3.3V** (note: most pins are not 5V tolerant) |
| Power options | USB-C VBUS 5V/3A | VIN 7–24V | 5V_SYS 5V/3A |
| Development environment | Arduino App Lab |
| Required Sketch Library | **Arduino_RouterBridge** (this one only) |
| Required Brick | **WebUI - HTML** (`arduino:web_ui`) |

### 1.2 Sensors

| Component | Qty | Interface | Specification |
|---|---|---|---|
| BH1750 (GY-302) light sensor | 2 | I2C | sample = `0x5C` (ADDR→3V3), reference = `0x23` (ADDR→GND); continuous high-resolution mode, ~120ms conversion |
| Pressure transmitter | 4 | Analog 0–5V | Three-wire (V+/GND/signal), **5V supply**, 0–1 MPa = 0–10 bar, ratiometric output |
| ZJ-TM02 flow meter | 2 | Pulse | Hall-effect, 5V supply, signal high level 4.7V (requires a voltage divider) |

### 1.3 Actuators

| Component | Qty | Driver | Specification |
|---|---|---|---|
| Amber LED (OD600 light source) | 1 | 2N2222 low-side switch | ~8.5 mA, pulsed (lit only during the measurement burst) |
| Peristaltic pump | 1 | L298N ch.A | **12V / 10W (≈0.83A)**, bidirectional |
| Diaphragm pump | 1 | L298N ch.B | **6–12V / 1A (12W at 12V)**, **one direction only, not reversible** |
| Relay module | 3 (planned) | GPIO | Switches three 12V DC devices |

### 1.4 Membrane Module Constants

Defined in `python/constants.json` (`config_version: rig-v2-integrated`):

| Parameter | Value |
|---|---|
| Effective membrane area | 0.02 m² |
| Number of fibers | 11 |
| Fiber inner diameter | 1.0 mm |
| Fiber length | 0.60 m |
| Pore size | 0.2 µm |
| Maximum working volume | 2.0 L |
| Operating temperature (assumed) | 22 °C |

> Once the configuration (tubing / fittings / tees / flow cell) changes, all constants flagged in `provisional_constants` become invalid; update `config_version` and recalibrate.

### 1.5 Measurement Specifications and Conversion Formulas

**Pressure**

```
V_pin   = (ADC / 1023) × 3.3V           ADC is a float averaged from 16-point oversampling
V_sensor = V_pin / 0.6                   undo the voltage divider (10kΩ + 15kΩ)
bar      = (V_sensor / 5.0) × 10.0       0–5V maps to 0–10 bar
final    = bar − offset                  offset obtained from zero calibration
```

Sampling chain: 100 Hz sampling (each sample includes 16-point oversampling for noise reduction) → 1-second sliding window → peak / trough / mean_raw / pulsation frequency computed every 200 ms → the Python side applies a low-pass filter to mean_raw (α = 0.3).

**Flow**

```
flow (mL/min) = (pulse frequency Hz × 60 / PULSES_PER_LITER) × 1000
PULSES_PER_LITER = 2580  (large-orifice version, F = 43×Q)
                 = 5160  (small-orifice version, F = 86×Q, requires a sketch change)
Debounce: pulses spaced < 500 µs apart are ignored
```

**OD600**

```
OD600 = log10(blankRatio / ratio) × pathLengthFactor
ratio = (lit_sample − dark_sample) / (lit_ref − dark_ref)
pathLengthFactor = 5.0   (1.0 cm reference path length / 0.2 cm flow-cell path length)
```

Single-measurement sequence: 4 dark-current readings (LED off) → LED on + 60 ms settling → 16-reading lit burst (first 2 discarded) → MAD outlier rejection (K = 3.0) → retry once if the rejection rate is > 50%. A single measurement takes about 2.7 seconds and **runs as a non-blocking state machine** (see [§9](#9-version-history) v1/v2).

**Base units**: pressure **bar**, flow rate **mL/min**, OD600 **AU**. psi / MPa are converted on the fly only for display and do not affect the logged values.

### 1.6 Safety Thresholds

| Parameter | Warning | Critical |
|---|---|---|
| TMP | 0.4 bar | **0.5 bar** (absolute collapse-pressure limit) |
| TMP instantaneous trough | −0.02 bar (suspected negative TMP, shell→lumen backflow) | — |
| dTMP/dt | 0.01 bar/min | 0.02 bar/min |
| Shear rate | 6000 s⁻¹ | — |
| ΔP relative to baseline | — | 2.5× |
| R relative to baseline | 2.0× | — |

---

## 2. Pin Assignment

### 2.1 Full Pin Table

| Pin | MCU | Current use | Planned use | Characteristics |
|---|---|---|---|---|
| **D2** | PB3 | Flow meter 1 signal | Same | EXTI3 |
| **D3** | PB0 | OD600 LED (via 2N2222) | Same | ~PWM (used as digital only here) |
| **D4** | PA12 | — | **Flow meter 2 signal** | EXTI12 |
| D5 | PA11 | Pump 1 IN1 | **Reserved** (true PWM) | ~PWM, TIM1_CH4 |
| D6 | PB1 | Pump 1 IN2 | **Reserved** (true PWM) | ~PWM, TIM3_CH4 |
| **D7** | PB2 | — (used for the KOH pump in v3, removed in v3.1) | **Relay 1** | EXTI2 |
| **D8** | PB4 | — | **Pump 1 IN1** | Non-PWM |
| **D9** | PB8 | **Pump 1 ENA (PWM)** | Same | ~PWM, TIM4_CH3 |
| **D10** | PB9 | — | **Pump 2 ENB (PWM)** | ~PWM, TIM4_CH4 |
| **D11** | PB15 | — | **Pump 2 IN4** | ~PWM (complementary channel, used as digital) |
| **D12** | PB14 | — | **Pump 1 IN2** | Non-PWM, SPI2_MISO |
| **D13** | PB13 | — | **Pump 2 IN3** | Non-PWM, SPI2_SCK; **D13 on the UNO Q has no LED attached** |
| **A0** | PA4 | Pressure Feed | Same | ADC, **not 5V tolerant** |
| **A1** | PA5 | Pressure Retentate | Same | ADC, **not 5V tolerant** |
| **A2** | PA6 | Pressure Permeate | Same | ADC |
| **A3** | PA7 | — | **Pressure transmitter 4** | ADC |
| **A4** | PC1 | **pH probe signal (v3)** | Same | ADC / I2C3_SDA |
| **A5** | PC0 | — | **Relay 3** (if DS18B20 is enabled, A5 goes to the DS18B20 and relay 3 moves to D6) | ADC / I2C3_SCL |
| **D20/D21** | PB11/PB10 | I2C2 SDA/SCL → BH1750 ×2 | Same | |
| **D0/D1** | PB7/PB6 | **STS3215 pinch valve (Serial1, 1 Mbps, via Waveshare Serial Bus Servo Driver Board, jumper A, RX→RX / TX→TX) (v3)** | Same | USART1; `Serial1` on Zephyr 0.55+ |

**Plan after v3.1**: relay 2's original pin A4 is now used by pH, so relay 2 moves to **D5**, which becomes free after the pump pin relocation (IN1/IN2 → D8/D12). Relay 1 stays on D7.

### 2.2 UNO Q Pin Capability Notes

Based on the JDIGITAL / JANALOG pin tables in the official datasheet (ABX00162/ABX00173):

- **There are only 6 PWM pins (marked `~`)**: D3, D5, D6, D9, D10, D11. Same as the classic UNO.
- **D11 is TIM1_CH3N (complementary output)**; some core versions invert N channels, so test it on hardware before using it as PWM. Using it as digital is fine.
- **D9 / D10 are different channels of the same TIM4**, so the two PWM outputs share the same frequency with independent duty cycles — the standard setup for driving two motors.
- **External interrupts share EXTI lines by pin number** (regardless of port). EXTI3 (D2) and EXTI12 (D4) are currently in use; to add a third pulse input, avoid those two numbers, e.g. use D7 (EXTI2) or A3 (EXTI7).
- **A0 / A1 are explicitly marked as not 5V tolerant**, and the other 3.3V pins should also be assumed not to tolerate 5V ⇒ **every 5V signal must go through a voltage divider**.

### 2.3 Known Pitfall: `pinMode()` + `analogWrite()`

The UNO Q Zephyr core has a known issue: **calling `pinMode()` first makes `analogWrite()` on that pin stop working (output 0V), while `digitalWrite()` still works normally**.

```cpp
pinMode(PUMP_ENA_PIN, OUTPUT);     // ← this line breaks PWM on D9
analogWrite(PUMP_ENA_PIN, pumpPwm);
```

**Fix**: do not call `pinMode()` on PWM pins; `analogWrite()` configures the pin itself. `setup()` should still call `analogWrite(ENA, 0)` once to make sure the duty cycle is 0% at power-up.

> v3.2 removed `pinMode()` from D9; during v3.3 troubleshooting it was restored to the old code (with which the pump worked correctly on real hardware).

---

## 3. Wiring

> **Disconnect power before doing any wiring.** Recommended order: GND → signal wires → power wires → actuator loads last.

### 3.1 OD600 Optics

**LED driver (low-side NPN switch)**

```
UNO Q D3 ──[1.2kΩ]──┬── 2N2222 Base
                     └──[10kΩ]── GND      (pull-down, prevents false turn-on when floating)

5V ──[330Ω]── LED anode
              LED cathode ── 2N2222 Collector
                          2N2222 Emitter ── GND
```

The firmware does not depend on the switching device (MOSFET, BJT or optocoupler all work); it only needs `digitalWrite(D3, HIGH/LOW)`.

**BH1750 ×2**

| GY-302 | Connect to | Notes |
|---|---|---|
| VCC | 5V (or 3.3V) | The module has its own regulator |
| GND | Clean ground | |
| SDA | D20 | |
| SCL | D21 | |
| ADDR (sample) | 3V3 | → address `0x5C` |
| ADDR (reference) | GND | → address `0x23` |

> **Powering from 3.3V is recommended**: on some GY-302 modules the I2C pull-up resistors are tied to VCC, so powering them from 5V puts 5V on the UNO Q's I2C pins (not 5V tolerant). Powering from 3.3V eliminates this risk entirely.

### 3.2 Pressure Transmitters ×4

Each transmitter needs **its own separate** voltage divider:

```
Transmitter V+     ── 5V analog rail (see §4)
Transmitter GND    ── clean ground
Transmitter signal ──┬──[10kΩ]──┬── A0 / A1 / A2 / A3
                     │          │
                  (signal)    [15kΩ]
                                │
                               GND
```

Divider ratio 0.6: 5V full scale → 3.0V, within the 3.3V ADC range. Adding a 100 nF ceramic capacitor to ground next to each connector is recommended.

Channel mapping: **A0 = Feed, A1 = Retentate, A2 = Permeate, A3 = fourth point (software extension pending)**.

### 3.3 Flow Meters ×2

```
Sensor red (VCC)      ── 5V
Sensor black (GND)    ── clean ground
Sensor yellow (signal) ──┬──[10kΩ]──┬── D2 (flow meter 1) / D4 (flow meter 2)
                         │          │
                      (signal)    [20kΩ]
                                    │
                                   GND
```

The divider brings the 4.7V high level down to about 3.1V. **Neither D2 nor D4 is 5V tolerant, so the divider cannot be omitted.**

### 3.4 L298N + Two Pumps

**Signal wires (7)**

```
UNO Q                      L298N
─────                      ─────
 D9  ──────────────────▶   ENA      Pump 1 PWM speed control
 D8  ──────────────────▶   IN1      Pump 1 direction
 D12 ──────────────────▶   IN2      Pump 1 direction
 D10 ──────────────────▶   ENB      Pump 2 PWM speed control
 D13 ──────────────────▶   IN3      Pump 2 direction
 D11 ──────────────────▶   IN4      Pump 2 direction
 GND ──────────────────▶   GND      Common ground, absolutely required
```

Without the common ground wire, the PWM and direction signals have no shared reference potential and the behavior is completely random — this is the wire most often forgotten, and the one most likely to make people think "the board is broken".

The UNO Q uses 3.3V logic; the L298N's input high threshold is about 2.3V, so driving it directly at 3.3V is fine.

**Power and outputs**

| L298N | Connect to |
|---|---|
| 12V | 12V dirty rail (**run directly from the power supply terminals, not through the small power module**) |
| GND | 12V supply − + UNO Q GND |
| 5V | See the jumper notes below |
| OUT1 / OUT2 | Pump 1 (peristaltic) motor terminals |
| OUT3 / OUT4 | Pump 2 (diaphragm) motor terminals |

**Jumper settings**

| Jumper | Action | Reason |
|---|---|---|
| ENA | **Remove** | If left in, it ties ENA to 5V and the MCU's PWM has no effect |
| ENB | **Remove** | Same as above |
| 5V-EN | **Remove**, then run a wire from the UNO Q or the 5V rail **into** the module's 5V pin | See below |

> **5V-EN is commonly misunderstood**: with the jumper **left in**, the module uses its onboard 78M05 to generate 5V from 12V, and the 5V pin is an **output** (do not feed anything into it); with the jumper **removed**, the regulator is disabled and the 5V pin becomes an **input**, so 5V **must** be supplied externally, otherwise the module's logic has no power.
> **Never use the module's 5V output to power the UNO Q** (insufficient current).

**Required protection**

```
ENA ──┬── UNO Q D9          ENB ──┬── UNO Q D10
      └──[10kΩ]── GND             └──[10kΩ]── GND
```

From MCU power-up until `setup()` has finished, these two pins float, and the L298N may read them as HIGH and give the pump a brief burst. Two resistors prevent this.

**Diaphragm pump direction**: the wiring keeps bidirectional capability, but the diaphragm pump has internal one-way check valves; when reversed, liquid does not flow backward and the motor works against closed check valves, which easily leads to stalling and overheating. The software should lock it to forward by default and require an extra confirmation for reverse.

**Heat dissipation and voltage drop**: the L298N is a Darlington BJT bridge with a voltage drop of about 1.4–2.5V, so with 12V in, the motor actually gets only about 9.5–10.6V. With the actual pumps (peristaltic 12V/10W, diaphragm 6–12V/1A, 1.83A total), this drop burns about **3.7W purely as heat**, so **a heatsink is mandatory when both pumps run continuously**; the peristaltic pump's torque also drops by about 30% as a result. See [§4.1](#41-power-budget) for the full analysis and the MOSFET driver alternative.

### 3.5 Relays ×3 (Planned)

| Control pin | Relay | Load |
|---|---|---|
| D7 | Relay 1 | 12V device A |
| A4 | Relay 2 | 12V device B |
| A5 | Relay 3 | 12V device C |

**Two pitfalls:**

1. **The UNO Q uses 3.3V logic, and many 5V relay modules cannot be triggered by it.** Choose an optocoupled module that explicitly supports 3.3V triggering (active-low trigger usually works), or drive it yourself with a MOSFET. **Confirm before buying.**
2. **A module with 12V coils is recommended**, moving the roughly 210 mA of coil current from the tight 5V rail to the 12V rail. If the module has a `VCC` / `JD-VCC` jumper, remove the jumper, feed 12V to `JD-VCC` and the logic voltage to `VCC`.

Fuse each contact load separately; add an RC snubber or flyback diode for inductive loads.

---

## 4. Power System

### 4.1 Power Budget

> **⚠️ This section was corrected on 2026-09-20.** The previous version treated the UNO Q's **5V/3A (15W) supply specification as its actual power consumption**, estimating 19W — an overestimate of a full 6–10×, which in turn pushed the power adapter recommendation up to 8–10A. Actual consumption is shown below.

**Power consumption of the UNO Q itself** (measured on the official Arduino forum, at the wall plug, WiFi on, no external peripherals):

| State | Measured power | Equivalent current on the 5V side |
|---|---|---|
| Idle | 0.5 W | ~0.1 A |
| Typical load (simulated stress test) | 1.9 W | ~0.4 A |
| Geekbench multi-core | 2.5 W | ~0.5 A |
| HPL full load (not reached in practice) | 3.5 W | ~0.7 A |

The **5V/3A** required by the datasheet is the **supply contract** the board negotiates over USB-C PD, not its consumption — that 3A of headroom is reserved for WiFi bursts, display initialization and peripherals the user hangs off the USB host port. This system's load profile (web server + Bridge RPC running continuously, no image processing) falls in the **1.5–2.5W** class.

> **Local measurement**: with a power meter in series on the power cord, the total consumption of the UNO Q **plus a 7-inch external display** **during OD600 measurement** was about **5W**. Subtracting the display's typical 2–3W leaves about 2–3W for the UNO Q itself, consistent with the table above.

**Measurement coverage**

| Item | Status |
|---|---|
| Boot and display initialization | ✅ **Monitored; never exceeded 5W at any point** |
| WiFi transmit bursts | ✅ **Not applicable — this system does not use WiFi** (the PC reaches the operator interface over USB) |
| During OD600 measurement | ✅ 5W (the measurement condition of this table) |
| Pump operation | Not applicable — the pumps are not powered by the UNO Q; only PWM control lines connect them |

The datasheet's stated reason for requiring 5V/3A is "to prevent voltage sag during **WiFi bursts** and **display initialization**". **In this system one of these scenarios does not exist and the other has been measured**, so that 3A of headroom has no corresponding load in this configuration.

> ### Conclusion: the UNO Q branch can be budgeted at a fixed 5W
> Not "a typical 2–3W plus an unknown peak", but **a 5W ceiling including the 7-inch display and including the boot transient** (about 1A on the 5V side, or about 0.47A on the 12V side through the buck converter).
> The 220µF + 10µF on the 5V rail in [§4.5](#45-protection-component-list) are still kept — decoupling capacitors are cheap and deal with high-frequency noise that should be blocked anyway — but they are no longer the critical component holding up the supply.

**System-wide power budget (corrected)**

With the nameplate ratings of both pumps now known, **the 12V-side budget has converged**:

| Load | Rail | Basis | Current | Power on 12V side |
|---|---|---|---|---|
| **UNO Q + 7-inch display** | 5V | **Measured ceiling** | ~1 A @5V | **5 W → 0.47 A** (via buck converter, η≈88%)|
| 4× pressure transmitters | 5V | Estimate | ~40 mA | 0.2 W |
| 2× flow meters | 5V | Estimate | ~20 mA | 0.1 W |
| OD600 LED | 5V | Estimate (pulsed) | ~9 mA | 0.05 W |
| L298N logic | 5V | Estimate | ~50 mA | 0.3 W |
| 3× relay coils (5V version) | 5V | Estimate | ~210 mA | 1.2 W |
| **Pump 1 (peristaltic)** | 12V | **Nameplate 12V / 10W** | **0.83 A** | **10 W** |
| **Pump 2 (diaphragm)** | 12V | **Nameplate 6–12V / 1A** | **1.0 A** | **12 W** |
| L298N voltage-drop loss | — | 1.83A × ~2V | — | **~3.7 W** (pure heat) |
| 3× 12V devices | 12V | **The only unknown** | ? | ? |

**The known portion totals about 33 W (2.8 A @ 12V)**, not yet including the three relay-switched devices.

Breakdown: the two pumps together with the L298N losses account for **26 W (about 78%)**, the UNO Q + display for **5 W (15%)**, and all remaining sensors and logic together for less than 2 W.

> ### ⚠️ 12V 3A (36W) = 93% load factor, not usable
> 33W ÷ 36W = 92.6%. A power adapter in continuous operation should not exceed an **80% load factor** (heat, lifetime, output droop), and this does not yet include the three relay-switched devices — if they draw more than about 0.25A combined, the budget is blown outright.
>
> **12V 5A (60W) is recommended**: 56% load factor, leaving about 2A for the three 12V devices, which is enough for the vast majority of solenoid valves / small fans / heater pads. If the three devices draw more than 1A combined, go to 6A (72W). **8A or more is unnecessary.**
>
> **Handle start-up inrush separately.** The stall current of a brushed DC motor is 3–6× its rated current, so the diaphragm pump may momentarily draw 3–6A at start-up. But that is a millisecond-scale transient; the correct solution is the 2200–4700µF reservoir capacitor in the three-rail diagram, plus firmware that ramps the pump PWM from 0 to the target value (over about 200–500 ms) — **not a bigger power adapter**. See [§11](#11-known-limitations-and-to-do).

> ### ⚠️ The L298N voltage drop is now a real problem, not just a footnote
> The L298N is a Darlington BJT bridge with a **total voltage drop of about 1.4–2.5V**. With the actual pumps connected:
>
> | | Nameplate | Actually received through the L298N | Consequence |
> |---|---|---|---|
> | Peristaltic pump | 12V / 10W | **~10V / ~7W** | Torque drops by about 30%; against the membrane module's back-pressure it may fail to turn or deliver too little flow |
> | Diaphragm pump | 6–12V / 1A | **~10V** | Still within range, but head and flow are both reduced |
>
> At the same time, all of this ~3.7W becomes heat in the L298N, so **a heatsink is mandatory when both pumps run continuously**.
>
> **Switching to a MOSFET driver solves three things at once** (voltage drop, heat, heatsink). Taking the DRV8871 (3.6A, single channel, total RDS(on) about 0.3Ω) as an example, the drop at 1A is only 0.3V, the pump gets 11.7V and the loss is 0.3W. The cost is that the interface changes from three pins (ENA/IN1/IN2) to two pins (IN1/IN2, with PWM applied directly to one of them), so the firmware must change — but it actually uses fewer pins. The BTS7960 has more headroom but is also larger.

### 4.2 Three-Rail Architecture

```
  12V 5A power adapter (known load 2.8A = 56% load factor)
        │
    [Main fuse 6.3A]
        │
    [Reverse-polarity protection + 470µF]
        │
        ├────────────────▶ 12V dirty rail (high current, fluctuating)
        │                  ├─ L298N 12V (two pumps)            [4A fuse]
        │                  ├─ Relays 1/2/3 → 12V devices       [individual fuses]
        │                  └─ 2200–4700µF reservoir capacitor (absorbs motor start-up inrush)
        │
        ├──[1A]──▶ UNO Q VIN (7–24V, let it do its own step-down) ★
        │
        ├──[2A]──▶ 3A synchronous buck module ──▶ 5V digital rail
        │                                         ├─ 2× flow meters
        │                                         ├─ OD600 LED
        │                                         ├─ L298N logic 5V
        │                                         └─ Relay modules
        │
        └──[0.5A]──▶ AMS1117 linear module + LC filter ──▶ 5V analog rail ★★
                                                           └─ 4× pressure transmitters (nothing else)
```

★ **The UNO Q is powered via VIN rather than 5V**, for two reasons (note: after correcting the power consumption figures, **the order of importance of these two reasons has swapped**):
1. **During development the USB-C cable is plugged in; if power is also fed into 5V_SYS at the same time, the two supplies fight on the same rail.** The datasheet states plainly that USB-C VBUS and the 5V output of the 7–24V buck converter are diode-ORed onto the system 5V bus; going through VIN avoids this problem entirely. **This is now the main reason.**
2. The AMS1117 module on hand still cannot power the UNO Q — even though the measured requirement is only ~1A (including the display), a linear regulator going from 12V to 5V would have to dissipate **7W**, which a SOT-223 without a heatsink cannot handle (see [§4.3](#43-correct-use-of-the-ams1117-module)). The conclusion is unchanged; only the reason has changed from "3× short on current" to "an order of magnitude short on heat dissipation".

★★ **Why the pressure transmitters get their own linear 5V supply**

The transmitters are three-wire 0–5V devices, and almost all such devices have a **ratiometric output** — the output voltage is proportional to the supply voltage, so **supply noise turns 1:1 into pressure noise**.

```
Steady-state detection threshold 0.003 bar ÷ full scale 10 bar = 0.03% FS
0.03% × 5V = 1.5 mV   ← supply noise must be below this figure
```

Buck module output ripple is commonly 20–50 mV, so **the ripple alone exceeds the limit by more than ten times** (this system does not use WiFi, so the aggravating factor of burst load steps is absent, but the 20–50 mV vs 1.5 mV gap is fatal enough without it). **A linear regulator's output noise is one to two orders of magnitude lower than a buck module's**, and 12V→5V at 40 mA dissipates only 0.28W, so no heatsink is needed.

This is the **component with the highest return on investment** on the entire power board — much of what the software currently does (100 Hz oversampling, median, EMA, 30-second aggregation) is compensating for this problem.

### 4.3 Correct Use of the AMS1117 Module

The multi-output small board on hand (DC-IN jack + slide switch + AMS1117 SOT-223) is a **linear** regulator, not a buck converter. A linear regulator's loss = (voltage difference × current), all of which turns into heat:

| Output current | Loss (12V→5V) | SOT-223 temperature rise (θJA ≈ 60–100 °C/W) |
|---|---|---|
| 40 mA | 0.28 W | +17~28 °C ✅ |
| 150 mA | 1.05 W | +63~105 °C ⚠️ too hot to touch |
| 300 mA | 2.1 W | +126~210 °C ❌ thermal shutdown |
| **~1 A (UNO Q + display, measured)** | **7 W** | ❌ far beyond what a SOT-223 without a heatsink can handle |
| 3A (datasheet PD contract value) | 21 W | Burns out immediately |

**Conclusion: this board can only be used for the 5V analog rail (4 transmitters, about 40 mA)**, which is exactly the role required by ★★ above. Do not use it to power the UNO Q, and do not take the 12V for the pumps / relays from its header pins (the DC jack and onboard traces are usually only good for around 2A).

> **Known anomaly**: the header pin labeled 3.3V was measured outputting 12V. **Do not connect anything** to this board until this is resolved.
> Troubleshooting steps: ① unloaded, with only 12V connected, measure **every** header pin against GND (the silkscreen often leads people to count from the wrong end); ② flip the slide switch and measure again; ③ confirm whether the board actually carries both an `AMS1117-5.0` and an `AMS1117-3.3` (missing parts are common); ④ if both are present, the 3.3V one may have failed short (the most common failure mode of linear regulators).
> **This system does not actually need an off-board 3.3V**; the simplest approach is to confirm the 5V group is correct, then treat the 3.3V group as nonexistent and tape it over.

### 4.4 Grounding Strategy ★

**This is the easiest place to ruin data quality.**

The pumps' return current is ampere-level and chopped into square waves by PWM. If it shares a stretch of ground wire with the sensors, the I×R drop across that copper is superimposed directly on the 0–5V signals — the symptom is **pressure readings that rise and fall with the pump PWM**, which is easily mistaken for fluid pulsation.

```
        ┌──── Dirty ground (thick wire 1.5mm²) ──── L298N GND / relay load return / motor return
  PSU   │
  GND ──┤◀── the single meeting point (star ground)
        │
        └──── Clean ground (separate trace) ──── UNO Q GND / 4× transmitter GND / flow meter GND / BH1750 GND
```

**Never** connect the sensor GNDs to the L298N's GND terminal, even though they all ultimately return to the same supply.

If a six-pin power module is used (`12V+ ×2 / 5V+ ×2 / GND ×2`), the six pins are **power sources**, not "one pin per load"; fan-out is done with bus bars on the perfboard:

| Pin | Use |
|---|---|
| 12V+ (1) | 12V dirty-rail bus |
| 12V+ (2) | Clean branch → input of the 5V analog-rail linear regulator (separate trace) |
| 5V+ (1) | UNO Q (if using the 5V supply option) |
| 5V+ (2) | 5V digital-rail bus |
| GND (1) | **Dirty ground** |
| GND (2) | **Clean ground** |

On the perfboard, use two 1.5mm² solid copper wires as the dirty-ground and clean-ground buses respectively; the two grounds **meet only once, at the power input**.

### 4.5 Protection Component List

| Location | Component | Why |
|---|---|---|
| Main input | 6.3A fuse (with the 5A adapter) + reverse-polarity protection (P-MOSFET ideal diode or series Schottky) | One reversed connection can burn out the whole setup |
| Main input | 470–1000 µF electrolytic + 100 nF ceramic | Stabilizes the input |
| 12V motor bus | **2200–4700 µF**, as close to the L298N as possible | Absorbs start-up inrush so it does not drag down the 5V rail |
| 5V digital rail | 220 µF + 10 µF ceramic (close to the UNO Q) | Burst loads from the UNO Q |
| 5V analog rail | 10 µH + 100 µF (LC low-pass) + 100 nF next to each sensor connector | See the 1.5 mV analysis in §4.2 |
| 5V_SYS input | 5.6V TVS | Protects the UNO Q from buck-module overshoot on load release |
| ENA / ENB | One 10 kΩ pull-down each | Pumps do not spin randomly at power-up |
| Each relay contact load | Individual fuse + RC snubber for inductive loads | Contact life and EMI |

### 4.6 Post-Assembly Test Sequence

1. **Connect only the power adapter** and measure the three rails: 12V, 5V digital, 5V analog. The 5V rails should be 4.9–5.2V.
2. **Connect only the UNO Q**, run it for a while and check whether 5V sags (including boot and display initialization; measured ceiling 5W).
3. Connect the sensors, **pumps off**, and look at the peak/trough range in the "Pressure pulsation diagnostics" panel. **Write this number down; it is the baseline noise.**
4. **Start the pumps** and look at the same number again. Noticeably larger → there is a grounding problem; go back and check the star ground.
5. Connect the relay loads last, one at a time, checking after each one whether the 12V rail drops.

> Comparing steps 3 and 4 is the most valuable part of the whole test — it tells you whether the grounding is right before you start running experiments.

### 4.7 Figures Still to Be Confirmed

**The only figures still missing**

- [ ] **The current of each of the three 12V relay-switched devices** ← this is now the only item blocking the final power adapter choice
- [ ] The actual output voltage of every header pin on the AMS1117 module (labeled 3.3V, measured 12V; see [§4.3](#43-correct-use-of-the-ams1117-module))

**Optional**

- [ ] Actual pump current against the membrane module's back-pressure (the nameplate values are enough to set the spec; measuring only confirms whether it is noticeably below rating, which can show whether the L298N drop really causes insufficient flow)
- [ ] Peak start-up inrush of the diaphragm pump (affects the choice of reservoir capacitor, but once soft start is implemented this figure matters much less)

**Closed**

- [x] ~~Power consumption of the UNO Q itself~~ → measured, including the 7-inch display and the whole boot and initialization period, **5W ceiling**; this system does not use WiFi ([§4.1](#41-power-budget))
- [x] ~~Pump rated power~~ → nameplate values: peristaltic **12V / 10W**, diaphragm **6–12V / 1A**

---

## 5. Software Architecture

### 5.1 Data Flow

```
        MCU (sketch.ino)                  Linux/MPU (main.py)                  Browser (index.html)
  ┌───────────────────────────────┐      ┌─────────────────────────────────────┐    ┌──────────────────┐
  │ Pressure 100Hz → stats/200ms ─┼notify▶ on_pressure_update → low-pass filter ┼─ws─▶ pressure_update  │
  │ Flow IRQ count → summary/1s  ─┼◀call─┤ push_flow_loop (1Hz)                ┼─ws─▶ flow_update      │
  │ OD600 state machine → each   ─┼notify▶ on_od600_update                     ┼─ws─▶ od600_update     │
  │   completed measurement       │      │                                     │    │                  │
  │ Pump analogWrite ─────────────┼◀call─┤ set_pump_pwm / direction / stop     ◀ws─┤ Apply / E-stop   │
  │ Real-time diagnostics ────────┼◀call─┤ poll_mcu_diag (5s)                  ┼─ws─▶ mcu_diag         │
  └───────────────────────────────┘      │ derive_loop (1Hz) derived / alarms  ┼─ws─▶ derived_update   │
                                         │ aggregate_loop (per window) aggreg. ┼─ws─▶ aggregate_update │
                                         │   └─ writes a CSV row if recording  ┼─ws─▶ record_status    │
                                         └─────────────────────────────────────┘    └──────────────────┘
```

**Background threads** (all wrapped in the exception protection of `_run_forever()`; see [§9](#9-version-history) v2.1):

| Thread | Period | Responsibility |
|---|---|---|
| `push_flow_loop` | 1 s | Polls flow and broadcasts it |
| `od600_poll_loop` | 5 s | OD600 status catch-up, blank update, MCU diagnostics, developer-mode timeout protection |
| `derive_loop` | 1 s | Derived parameters, trends, steady-state detection, **safety alarms** |
| `aggregate_loop` | Per window | Aggregation, broadcast, writes one CSV row |
| `record_status_loop` | 1 s | Recording elapsed seconds, timed finalization |

### 5.2 MCU Bridge Interface (all String → String)

| Function | Description |
|---|---|
| `get_flow_data()` | `"frequencyHz,flow mL/min,cumulative mL"` |
| `zero_calibrate()` | Zero the three pressure channels (void) |
| `set_pump_pwm(pwm)` / `set_pump_direction(1\|0)` / `stop_pump()` / `get_pump_status()` | Pump |
| `get_od_data()` | `"od600,lux_sample,lux_ref,bubble_pct,valid,blank_set,meas_seq,age_ms,busy"` |
| `get_blank_info()` | `"blank_set,blank_lux_sample,blank_lux_ref,blank_ratio"` |
| `calibrate_blank()` / `trigger_measurement()` | Queue one measurement; returns `"queued"` or `"busy"` |
| `set_dev_mode(on)` / `get_dev_readings()` | Developer mode (LED alignment) |
| `set_measure_interval_sec(s)` / `get_measure_interval_sec()` | OD600 measurement interval |
| `set_path_length_factor(f)` / `get_path_length_factor()` | Path-length correction factor |
| `set_blank_manual(a)` / `clear_blank()` | Manually set / clear the blank reference (v2.2) |
| `set_pressure_offsets(a)` / `get_pressure_offsets()` | Manually set / read back the pressure zero points (v2.2) |
| `get_diag()` | `"loop_max_us,pressure_samples_last_sec,od_state,reinit_step,uptime_ms"` |
| `get_ph_status()` / `get_ph_config()` / `set_ph_config(kv)` | pH status and calibration values (v3, `key=value` format, see §12.4) |
| `ph_calibrate(7\|4)` | pH two-point calibration (v3) |
| `valve_open()` / `valve_close()` / `valve_goto_raw(pos)` / `valve_torque(1\|0)` | Pinch valve actions (v3) |
| `valve_get_status()` / `valve_get_config()` / `valve_set_config(kv)` / `valve_clear_fault()` / `valve_rescan()` | Pinch valve status and settings (v3) |

**Active push**: `on_pressure_update` (every 200 ms, 12 statistics), `on_od600_update` (each time a measurement completes), `on_ph_update` (every second, v3), `on_valve_update` (every second + on state change, v3).

Functions added in v3 are registered with `Bridge.provide_safe` (the callback runs in a time slice of `loop()`); existing functions keep using `provide`.

### 5.3 Aggregated Sampling

Pressure at 5 Hz, flow rate at 1 Hz, OD600 once every 30 seconds — the three signals have very different rhythms, and pressure / flow rate are inherently overlaid with the pump's periodic pulsation.

Data is collected continuously within the **sampling window** (default 30 seconds, adjustable in the UI from 5 seconds to 24 hours); at the end of each window a median or mean is taken once and used as:
1. The value on the pressure / flow-rate cards on screen
2. One point on each of the three charts (**the same X coordinate**, so the three signals always line up)
3. One row of the recording CSV

**The sampling duration is shared by all three**: when this value is changed, the backend also sets the MCU's OD600 measurement interval to the same value.

| Aggregation method | Suited for |
|---|---|
| **Median** (default) | Most robust against bubbles and single noise spikes |
| Mean | Peaks and troughs of periodic pulsation cancel out; physically closer to "the average pressure over this period" |

> **The fast safety path is not averaged away.** The TMP instantaneous peak / trough alarms and the collapse-pressure protection still use the MCU's raw statistics every 200 ms (`derive_loop` runs once per second) and are not masked by the 30-second average — that is exactly the problem that switching pressure to 100 Hz high-frequency sampling was meant to solve. The `pressure_tmp_peak_bar` / `pressure_tmp_trough_bar` in each CSV row also record **the worst single value within that window**.

**Derived parameters are recomputed from the aggregated values**: for ratios such as `R = ΔP_net / Q`, "average numerator and denominator first, then divide" differs from "divide first, then average"; the former is the representative value for the period.

### 5.4 Derived Parameters

Uses only the signals available on the current hardware (p_in / p_out / p_perm / q_feed):

| Parameter | Formula / meaning |
|---|---|
| ΔP | p_in − p_out |
| ΔP_blank | Tubing blank model = slope × Q + intercept |
| ΔP_net | ΔP − ΔP_blank (net pressure drop across the module) |
| **R** | ΔP_net / Q (hydraulic resistance, **the main day-to-day monitoring metric**) |
| TMP | (p_in + p_out)/2 − p_perm |
| TMP uniformity | ΔP_net / TMP |
| Shear rate | 4Q_fiber / (π r³) |
| Shear stress | ΔP_net × 1e5 × r / (2L) |
| n_eff | Effective number of fibers back-calculated from the instantaneous R (single-point estimate, for reference only) |
| dTMP/dt, d²TMP/dt² | Linear-regression slope and its second derivative |
| Steady-state detection | Slopes and residuals of P_in, P_out and Q over 60 seconds all meet their criteria simultaneously |

**Cannot be computed on the current hardware** (missing permeate flow meter / temperature sensor / offline sampling): flux, conversion, sieving coefficient S, tmp_corrected, flux_25c.

> If the second flow meter is installed on the permeate side, **flux and conversion become computable** — those are the two quantities the specification has always marked as "not computed because there is no permeate flow meter".

---

## 6. Data Logging

### 6.1 CSV Columns (73 columns since v4.0: columns added in v3.7 see §13, v3.8 adds `temp_src`, v4.0 derived parameters see §15)

| Column | Description |
|---|---|
| `window_index` | Index of the sampling window |
| `elapsed_s` | Recording seconds at the end of the window (paused time not counted) |
| `timestamp_start` / `timestamp_end` | Window start and end time |
| `window_sec` | Seconds actually covered |
| **`gap_s`** | Gap since the end of the previous row. Normally ≈0; after an interruption (App/board restart) the gap is honestly recorded |
| `agg_method` | `median` / `mean` (no guessing afterwards) |
| `n_samples_pressure` / `n_samples_flow` | Number of samples actually aggregated. Pressure should be close to `window_sec × 5`; noticeably fewer means the MCU was not sending data normally |
| `partial` | 1 = the final row at finalization, covering less than a full window |
| `od600_au` | OD600 |
| `od600_lux_sample` / `_lux_ref` / `_bubble_pct` | OD600 raw diagnostic values |
| `od600_valid` / `od600_blank_set` | Whether that measurement was valid, whether the blank has been calibrated |
| `od600_age_s` / `od600_new` | How old this OD600 value is / whether it corresponds to a new measurement |
| `flow_mlmin` / `flow_freq_hz` | Flow rate (window aggregate) |
| `flow_total_ml` | Cumulative volume (value at the end of the window) |
| `pressure_feed_bar` / `_retentate_bar` / `_permeate_bar` / `_tmp_bar` | Pressure (filtered, then aggregated) |
| `pressure_tmp_peak_bar` / `_trough_bar` | **The worst single value within the window** (not an aggregate) |
| `pressure_cycle_freq_hz` | Rough estimate of the pulsation frequency |
| `pump_pwm` / `pump_forward` | Pump status |
| `ph` / `ph_temp_c` | pH (window aggregate) and the temperature used for compensation (v3) |
| `ph_state` | WARMUP / OK / PROBE_ERROR (v3.1); readings taken while the probe is faulty are not included in `ph` |
| `valve_state` | `open` / `closed` / `jog` (v3) |
| **`valve_closed_frac`** | Fraction of time 0–1 within this window during which the pinch valve was not "open". **When analyzing membrane performance, use `valve_closed_frac == 0` to filter out rows from sample-collection periods** (v3) |
| `valve_pos` | Actual servo position (v3) |
| `delta_p_bar` / `delta_p_net_bar` / `R_bar_per_mlmin` | Derived parameters (recomputed from aggregated values) |
| `shear_rate_s1` / `shear_stress_pa` / `tmp_uniformity` / `n_eff_from_dp` | Derived parameters |
| `dtmp_dt_bar_per_min` / `d2tmp_dt2` / `steady` | Trends and steady state |
| `config_version` / `constants_version` | Constants versions in use at the time |

**File size**: one row every 30 seconds, about 8600 rows in 72 hours (a few hundred KB). Changing the sampling duration to 5 seconds multiplies the row count by 6.

### 6.2 Flushing to Disk and Resuming After Interruption

| Old behavior (v2.2 and earlier) | Now (v2.3) |
|---|---|
| The whole run was held in memory and **written to file only on stop** | **Each window is written to the CSV as soon as it is produced** (append + flush + fsync) |
| Power loss / crash / restart = the entire run is lost | At worst only the window that has not yet finished is lost |
| After an interruption, that recording was gone | **Automatically resumes the same file** (`recording_state.json` tracks progress) |
| A 72-hour recording stayed entirely in RAM | Memory usage is decoupled from recording length |

**Resume behavior**: `elapsed_s` keeps accumulating according to real elapsed time (it does not restart from 0); the length of the interruption is recorded in the next row's `gap_s`; `window_index` continues counting; if a timed recording expired during the interruption, it is finalized immediately.

### 6.3 Retrieving Files

1. The **"Recordings on the board"** button in the UI's "Data logging" panel → lists all recording files for direct download
2. Automatic download when recording stops (via the HTTP endpoint `/download/recording`)
3. Take them directly from the board's `python/recordings/` folder

**The file already exists and keeps growing while recording is in progress**, so you can grab a copy to look at at any time without waiting for the recording to finish.

---

## 7. Calibration

### 7.1 Three Calibrations

| Calibration | When to do it | Where it is stored |
|---|---|---|
| **Pressure zeroing** | When the system is fully depressurized (atmospheric pressure) | MCU RAM (lost on restart) |
| **OD600 blank** | When the flow cell is filled with clean medium | MCU RAM (lost on restart) |
| **R / ΔP / TMP baselines** | When the system is running stably | Python memory (lost when the App restarts) |

### 7.2 Automatic Save and Restore

Every successful calibration is written to `python/calibration_state.json` (Linux side, unaffected by MCU restarts). When an MCU restart is detected, the values are pushed back automatically, via two paths:

1. At App start-up, the MCU appears to be in a "clean freshly booted state" (no blank **and** all three offsets are 0)
2. During operation, the MCU uptime reported by `get_diag` suddenly decreases

**Persistent reminder**: as long as the blank reference or pressure zero points currently in effect **were not measured on site** (restored or entered manually), a yellow banner stays at the top of the screen until a genuine calibration is done again. Whether a restored zero point is still valid depends on the on-site conditions (temperature drift, whether the tubing has been touched), and the system should not pretend it is as trustworthy as a fresh calibration.

> The path-length factor and the baselines **do not trigger** the yellow notice — they are geometric constants and reference values, so restoring them is the correct behavior anyway, and flooding the screen with notices would only cause the truly important ones to be ignored. Their source is still shown in the "Calibration value management" table.

### 7.3 Manual Entry

In the "Calibration value management" panel you can directly enter values you have recorded yourself:

- **OD600 blank reference**: filling in only `blank ratio` is enough (it is the only value used in the calculation); alternatively, fill in only the sample and reference lux values and the system computes the ratio. The two lux values affect only the display.
- **Pressure zero offsets**: three fields for feed / retentate / permeate, in bar.
- The **"Read back the values currently in effect"** button reads back the values the MCU is actually using now and fills them into the fields, so they can be copied down as a backup. **It is recommended to copy them down after every formal calibration.**

### 7.4 What Is Still Lost

- **The last unfinished window of a recording in progress** (everything else has been flushed to disk)
- **Cumulative flow `flow_total_ml`**: reset to zero after an MCU restart
- **Chart history**: exists only in browser memory

(The v3 pH calibration points and pinch valve settings are stored separately in `ph_valve_state.json` and are pushed back automatically after an MCU restart; see §12.5.)

---

## 8. Deployment and Operation

### 8.1 File Structure

```
app.yaml                       # declares the arduino:web_ui brick
sketch/sketch.ino              # MCU-side firmware
python/main.py                 # Linux/MPU-side App
python/constants.json          # calibration constants (must be in the same folder as main.py)
python/requirements.txt        # intentionally left empty
python/recordings/             # recording CSVs (created automatically)
python/calibration_state.json  # saved calibration values (created automatically)
python/recording_state.json    # progress marker for the recording in progress (created / deleted automatically)
python/ph_valve_state.json     # v3: pH calibration points, pinch valve settings (created automatically)
python/recordings/valve_events.csv  # v3: one row per "close -> release" cycle
sketch/sketch.yaml             # v3: declares the SCServo (1.0.2) library
assets/index.html              # Web UI
assets/libs/                   # socket.io.min.js + arduino.js (placed automatically by App Lab)
```

### 8.2 Deployment Steps

1. In App Lab, left side, **Add Brick** → add `WebUI - HTML`
2. Left side, **Add sketch library** → install `Arduino_RouterBridge`
3. Check the wiring against [§2](#2-pin-assignment) and [§3](#3-wiring), then flash `sketch/sketch.ino`
4. Put `python/main.py` and `python/constants.json` into the project's `python/` folder (**they must be at the same level**)
5. Put `assets/index.html` into `assets/`
6. Point the browser at `http://<board IP>:7000` (this system does not use WiFi; the PC connects via the USB network interface. If WiFi or wired Ethernet is used instead, the address is obtained differently but the port is the same)

> **The port must be 7000** — that is the port hard-coded in the WebUI Brick's `brick_config.yaml` and actually forwarded out. Changing it to another port in `main.py` only binds it inside the container, and it cannot be reached from outside (you will see "connection refused").

**Standalone operation**: App Lab has a "Run at startup" option (press it first, then press RUN); after that the board runs this App by itself on boot, without a PC. For long experiments use an **independent 5V/12V power supply** instead of relying on the PC's USB power — USB power may be cut when the PC goes to sleep.

### 8.3 First Start-Up Sequence

1. Look at the `[boot]` messages in the App Lab Console and confirm that the I2C scan found `0x23` and `0x5C` and that both sensors initialized OK
2. Confirm that `[diag] loop_max_us=... pressure_samples_last_sec=.../100` appears every second
3. With the system fully depressurized, press **Zero calibration**
4. Fill the flow cell with clean medium and press **Calibrate blank (Blank)**; it takes effect after about 3 seconds
5. When optical alignment is needed, use **Developer mode** (LED constantly on + real-time sample/reference ratio, theoretically about 10:1)
6. The PWM slider outputs 0–255 directly (the dead zone was removed in v3.1); after moving it press **Apply**. Measure the minimum PWM at which the new pump turns yourself

### 8.4 Chart Behavior (since v3.8)

**Layout (v3.9, adjusted in v3.10)**: three columns — column 1 "Growth-related parameters" (OD600 / pH / temperature combined into one unit), column 2 "Pressure and derived analysis" (pressure chart, derived parameters, steady-state detection; manual baseline entry, metric explanations and pressure pulsation diagnostics are in expandable sections), column 3 the control panels (data logging, pump (including the flow-rate value), pinch valve, pH probe calibration, sampling settings, algorithm selection, engineering mode, calibration value management). When the screen width is < 1280 px the charts merge into one column; at < 860 px everything is in one column.

- **Flow-rate chart**: click the flow-rate value in the pump panel to open a floating window (close with ✕, Esc or by clicking the background); the chart logic is the same as for the other charts (full history, compressed).
- **PWM input box**: synchronized both ways with the slider; values outside 0–255 are clamped automatically; send with "Apply" or by pressing Enter in the input box.
- **Engineering mode**: OD600 blank calibration / measure now / path-length factor, plus LED alignment (formerly "Developer mode").
- **Collapsible panels (v3.10)**: pH probe calibration, sampling settings, algorithm selection, engineering mode and calibration value management show only their title by default; click the title to expand.
- **Language (v3.10)**: English by default; can be switched to Traditional Chinese at the top right; the choice is remembered in that browser.
- **pH in calibration value management (v3.10)**: the table lists the raw voltages and calibration temperatures for pH 7.00 / 4.01; they can be entered manually and applied (`ph_set_calibration`), are saved, and are pushed back after an MCU restart. "Read back the values currently in effect" also fills the pH values into the input boxes.

- **No more scrolling, no more automatic clearing**: all data since App start-up (or since pressing "⟲ Reset charts") is kept; the X axis = start → now, with the whole span compressed into the chart width; starting / stopping a recording does not clear it either.
- The X axis shows clock time (HH:MM; the date is added beyond 20 hours). Recording start / stop / resume is marked with red / gray dashed lines.
- The history is stored on the Python side, so the charts are still there after reloading the web page or opening it from another PC (they are cleared only when Python restarts).
- "⟲ Reset charts" clears only the display history, for all connected web pages at once; **it does not affect the CSV or the file being recorded**.
- When the number of points exceeds 6000, adjacent pairs of points are merged (averaged); with a 30-second window merging starts only after about 50 hours; **data gaps are always drawn as breaks in the line**, and merging never spans a gap.
- Time always comes from the board's (Linux) clock, so an inaccurate browser clock has no effect.
- It is normal for values to update only once per sampling window; the "Sampling settings" panel has a countdown.

---

## 9. Version History

### 9.1 Predecessor Projects

This system was formed by merging three independent projects:

| Predecessor | Contents |
|---|---|
| **OD600 photometer** | BH1750 ×2 + pulsed LED, MAD bubble rejection, blank calibration, developer mode (LED alignment), WebUI Brick dashboard |
| **Flow rate + pressure monitoring** | ZJ-TM02 flow meter, three-channel pressure, derived parameters, steady-state detection, manual recording. It went through its own evolution from v1 to v13 (v11 switched to 100 Hz high-frequency sampling + peak/trough statistics; v13 changed the ΔP-Q sweep to timed averaging) |
| **Pump control** | L298N PWM + direction, minimum effective PWM protection, apply-to-commit operation |

### 9.2 Integrated Version Table

| Version | Date | Files changed | Firmware reflash required | Highlights |
|---|---|---|---|---|
| **v1** | 2026-09-01 | All (new) | ✅ | Merged the three projects; OD600 changed to a non-blocking state machine; automated experiments removed; only PWM kept; new layout |
| **v2** | 2026-09-01 | All | ✅ | Fixed three causes of blocking; added aggregated sampling; `loop_max_us` diagnostics |
| **v2.1** | 2026-09-01 | `main.py`, `index.html` | ❌ | Exception protection for background threads; the screen no longer appears frozen after reconnecting |
| **v2.2** | 2026-09-01 | All | ✅ | Calibration values automatically saved / restored / manually entered |
| **v2.3** | 2026-09-06 | `main.py`, `index.html` | ❌ | Each window flushed to disk immediately; automatic resume after interruption; HTTP download; new `gap_s` column |
| **v3** | 2026-10-02 | All + `sketch.yaml` | ✅ | Merged in pH/KOH control (A4/D7) and the STS3215 pinch valve (Serial1); unified ADC resolution; CSV +9 columns; pinch valve event log (see §12) |
| **v3.8.2** | 2026-10-05 | `sketch.ino`, `main.py` | ✅ | DS18B20 is no longer initialized in setup() (instead searched for in loop() 5 seconds after boot), so that a 1-Wire problem cannot prevent the Bridge functions from being registered in time; 1-Wire timing no longer disables interrupts by default (`DS_IRQ_LOCK`) |
| **v3.9.0** | 2026-10-06 | `sketch.ino`, `main.py` | ✅ | DS18B20 switched to direct Zephyr GPIO open-drain access (configured only once): on real hardware it was found that `pinMode()` takes tens of µs every time it reconfigures the pin, which breaks 1-Wire timing and caused "responds the first time, no response afterwards" and loop times of 20 ms or more; falls back to the old method if configuration fails |
| **v4.5** | 2026-10-06 | `index.html` | ❌ | Page main title changed to "ReLeaf Perfusion Hollow Fiber Bioreactor ver. 4.5" (version inserted automatically) |
| **v3.10.0 / v4.4 / v4.6** | 2026-10-06 | `sketch.ino`, `main.py`, `index.html` | ✅ | Pump start-up kick: when starting from standstill, first run at the kick PWM (default 255) for 500 ms, then drop back to the target PWM, solving "the pump needs PWM 200 to start turning, but the required flow rate is at 150"; optional automatic re-kick on stall (no flow meter pulses for 3 seconds, only while the pinch valve is open, at most 3 times); settings are saved, restored automatically after an MCU restart, and included in calibration value export / import |
| **v3.10.1** | 2026-10-06 | `sketch.ino`, `main.py` (only EXPECTED_FW changed) | ✅ | DS18B20: D8 open-drain with the internal pull-up also enabled as a backup; when no sensor is found, prints 1-Wire electrical diagnostics (external pull-up / internal pull-up / pull-low / presence waveform) and points out likely causes; new Bridge `ds_diag` |
| **v3.10.2 / v4.5 / v4.7** | 2026-10-06 | `sketch.ino`, `main.py`, `index.html` | ✅ | DS18B20 logging: prints one line of results on every re-search (10 seconds), with full diagnostics attached when the cause changes or about once a minute; once found, prints the temperature every 30 seconds; new "Thermometer diagnostics / re-search now" button in the web UI's temperature area. Fixed v3.10.1's FW_VERSION still showing v3.10.0 |
| **v4.6 / v4.8** | 2026-10-06 | `main.py`, `index.html` | ❌ | ΔP–Q sweep: automatically runs through multiple PWM values in sequence, records ΔP_friction and flow at each point once stable, fits ΔP = a·Q + b·Q² (quadratic and linear, R², residuals), applies after confirmation; measurement points and fit results are saved and included in calibration value export / import |
| **v4.7 / v4.9** | 2026-10-06 | `main.py`, `index.html` | ❌ | All temperature inputs (pH compensation temperature, buffer solution temperature, manual calibration temperature) use the thermometer by default and switch to manual only when it cannot be read; new "Operating parameter input": Q_L source (flow meter / manual), manual Q_L, Q_perm (including calculation from collected volume ÷ time), culture volume; Q_L settings included in calibration value export / import |
| **v3.10.3 / v4.7.1 / v4.9.1** | 2026-10-06 | `sketch.ino`, `main.py`, `index.html` | ✅ | DS18B20 "found the first time, unreadable afterwards": 1-Wire bit slots now use a busy-loop delay calibrated at boot (independent of delayMicroseconds / system timer accuracy); each read failure prints its cause (no_presence, all_0xFF, crc + raw bytes, 85.0 °C); diagnostics include measured timing values; Bridge `ds_timing` (spin / busy / cal) |
| **v4.7.2 / v4.9.2** | 2026-10-06 | `main.py`, `index.html` | ❌ | ΔP–Q sweep gains a "Sweep order" option, defaulting to high PWM → low PWM (at low PWM the pump is already running and does not need to start from standstill); can be switched back to low → high |
| **v4.10 / v4.11** | 2026-10-08 | `main.py`, `index.html` | ❌ | New "💾 Checkpoint save" in the recording area: available while recording (or paused), it copies the CSV so far to `<original-name>_checkpoint_<time>.csv` and downloads it automatically without interrupting the recording; the web UI's main.py version check now compares segment by segment (4.10 > 4.9) |
| **v3.10.7 / v4.9.1 / v4.10.1** | 2026-10-08 | `sketch.ino`, `main.py`, `index.html` | ✅ | **Automatic MCU restart removed**: in real-hardware testing, after v3.10.6's software restart (SYSRESETREQ) the MCU did not reconnect to the Bridge (no new [boot], pressure pushes stopped), and recovery was only possible by stopping the App or cutting power. Kept: call queuing, disconnect detection with the red banner, Serial Monitor `[rpc]` statistics and warnings, status / resync, stress test, simulated Python-side disconnect; Python actively sends en=0 to disable the automatic restart in older firmware |
| **v3.10.6 / v4.9 / v4.10** | 2026-10-08 | `sketch.ino`, `main.py`, `index.html` | ✅ | Command channel self-recovery: if the MCU had been receiving Python calls and then receives none for 60 consecutive seconds (adjustable) → automatic software restart (equivalent to reset, power not interrupted); after Python detects the restart it pushes back the calibration values and settings and restores the pump PWM / direction; at most 2 automatic restarts per hour; the feature is disabled when the App stops normally. Engineering mode gains "MCU connection and self-recovery": status, resync, watchdog settings, stress test, simulated Python-side disconnect, simulated MCU not receiving commands |
| **v3.10.5 / v4.8** | 2026-10-08 | `sketch.ino`, `main.py` | ✅ | After the PC wakes from sleep, "no Python→MCU command gets any response, while MCU data keeps being pushed normally": all MCU calls on the Python side are now queued (one at a time, 5 s timeout), and 3 consecutive failures are shown in the Console and as a red banner in the web UI; on the MCU side all Bridge functions now use provide_safe (run in loop(), no longer on the Bridge background thread with its 500-byte stack); the Serial Monitor prints the number of Python calls received every 30 seconds and warns if none at all are received for 30 seconds |
| **v3.10.4** | 2026-10-07 | `sketch.ino`, `main.py` (only EXPECTED_FW changed) | ✅ | On a new board (Zephyr core 1.0.0), running with nothing attached, Python reported `not available` for everything: Bridge functions are now registered at the very start of setup() (previously after the I2C scan and pinch valve Ping); I2C probes only 0x23 / 0x5C; boot prints the time taken by each step |
| **v4.4** | 2026-10-06 | `index.html` | ❌ | In offline preview (about:srcdoc / file:// or missing libs) the page runs with a stand-in WebUI instead of failing entirely, and suggests opening the board's URL instead |
| **v4.3** | 2026-10-06 | `main.py`, `index.html` | ❌ | Troubleshooting: web page JS errors are shown directly in a red box at the bottom of the screen; the status bar shows the UI and main.py versions, with a notice when main.py is too old; spec management fields are drawn even before board data arrives |
| **v4.2** | 2026-10-06 | `index.html` | ❌ | Removed the "Metric explanations" unit; instead each metric itself is clickable (event delegation, including the OD600 card, steady-state badge and ρgh); the status bar shows the UI version to confirm that the browser loaded the new file |
| **v4.1** | 2026-10-06 | `main.py`, `index.html`, `constants.json` | ❌ | Calibration value "export / import" (.json, with selectable items to apply); new "Spec management" unit (module geometry, volumes, fluid, operating targets, alarm thresholds, self-test parameters; A / V_lumen can be computed from the geometry); each membrane filtration monitoring parameter can be clicked to show its meaning and normal range |
| **v4.0** | 2026-10-06 | `main.py`, `index.html`, `constants.json` | ❌ | Derived parameters redesigned according to HFM_bioreactor_UI_spec.md: TMP_out (including a strict trough-based version), ΔP_friction ratio (with ρgh subtracted), γ (pressure), γ_ratio, J / L_p / D (require Q_perm), secondary diagnostic parameters; pump-stopped self-test measures ρgh; new alarm list; fouling indicator / L_p trend charts and P_out instantaneous waveform; CSV 73 columns |
| **v3.8.4** | 2026-10-06 | `sketch.ino`, `main.py`, `index.html` | ✅ | The first step of setup() pulls the pump pins low (prevents the L298N inputs from floating and the pump from running by itself while the MCU is stuck in Bridge); built-in LED boot diagnostic indicator; power-up order hint added to the "MCU not responding" banner |
| **v3.8.3** | 2026-10-05 | `sketch.ino`, `main.py` | ✅ | The global `String valveLoopbackResult` changed to a char array (at the time this was wrongly thought to be the cause of "no [boot]"; the actual cause was the power-up order, see §10.00). It is still recommended to avoid declaring global objects with destructors in the sketch |
| **v3.10** | 2026-10-05 | `index.html`, `main.py` | ❌ | OD600 / pH / temperature combined into "Growth-related parameters"; calibration value management adds the pH two-point calibration voltages and calibration temperature (manual entry possible); pH probe calibration / sampling settings / algorithm selection / engineering mode / calibration value management collapsed by default; English by default, switchable to Traditional Chinese (remembered in the browser) |
| **v3.9** | 2026-10-05 | `index.html` | ❌ | UI changed to three columns (charts | charts | controls); PWM can be typed in directly; flow-rate value moved to the pump panel, click to open a floating flow-rate chart window; OD600 controls + LED alignment combined into "Engineering mode"; pressure chart and derived analysis combined |
| **v3.8.1** | 2026-10-05 | `sketch.ino`, `sketch.yaml`, `main.py` | ✅ | Fixed `OneWire.h: No such file`: DS18B20 now uses an embedded 1-Wire driver and no longer depends on external libraries |
| **v3.8** | 2026-10-05 | `sketch.ino`, `sketch.yaml`, `main.py`, `index.html` | ✅ | Pressure divider ratio changed to 15k/22k (0.5946) and the first ADC reading after a pin switch is discarded; DS18B20 temperature (D8, automatically falls back to the manual temperature when it cannot be read); new temperature chart; charts changed to a compressed full-history display + "Reset charts" button; CSV adds `temp_src` (59 columns) |
| **v3.7** | 2026-10-04 | `sketch.ino`, `main.py`, `index.html`, `constants.json` | ✅ | Selectable sampling / analysis algorithms (per the algorithm review report, see §13); CSV increased to 58 columns (G-4 multiple statistics + `alg_profile`) |
| **v3.6** | 2026-10-03 | `sketch.ino`, `main.py`, `index.html` | ✅ | Pinch valve settings gain a D0–D1 loopback test (verifies Serial1 transmit/receive on the UNO Q side) |
| **v3.5** | 2026-10-03 | `sketch.ino`, `main.py`, `index.html` | ✅ | Pinch valve "blind move test" (broadcast ID, 8 baud rates, no response needed); fixed the scan hint misinterpreting baud-rate-switch noise as "data received" |
| **v3.4** | 2026-10-03 | `sketch.ino`, `main.py`, `index.html` | ✅ | pH manual compensation temperature and buffer solution temperature; automatic servo scan (8 baud rates × ID 0–253) and baud rate setting; diagnostic of bytes received on the bus |
| **v3.3** | 2026-10-03 | `sketch.ino`, `main.py`, `index.html` | ✅ | Troubleshooting: the web UI detects missing files in `assets/libs/`; Python traces web messages and pump commands; D9 reverted to the old `pinMode()` code |
| **v3.2** | 2026-10-03 | `sketch.ino`, `main.py`, `index.html` | ✅ | Troubleshooting build: removed `Serial.begin()` (on the new core it starts the Bridge a second time); D9 no longer calls `pinMode()`; boot synchronization moved to a background thread; MCU connection status and firmware version display; `ENABLE_PH` / `ENABLE_VALVE` switches |
| **v3.1** | 2026-10-03 | All | ✅ | Pump replaced: PWM dead zone removed; KOH base dosing control removed, pH is monitored and logged only (D7 freed); CSV changed to +6 columns |

### 9.3 Detailed Notes per Version

#### v1 — Merging the Three Projects (2026-09-01)

**The most important change: OD600 measurement became a non-blocking state machine.**

Originally `doMeasurement()` used `delay(SAMPLE_PERIOD_MS)` to run straight through the 4 dark-current readings + 16-reading lit burst, so a single measurement blocked `loop()` for about 2.7 seconds (more than 5 seconds when a retry occurred). That did not matter with OD600 alone, but after the merge, during that time:

1. The pressure 100 Hz sliding window lost 2–3 seconds of samples → peak/trough/mean statistics were truncated, leaving blind spots in collapse-pressure protection and negative-TMP detection
2. The 1-second flow tick was stretched
3. **Bridge service was delayed → a pump "emergency stop" might take 2–3 seconds to be processed** (a safety issue)

It was changed to a state machine scheduled with `millis()` inside `loop()`:

```
OD_IDLE ──(measurement time reached / trigger received)──▶ OD_DARK ──(4 readings collected)──▶ OD_WARMUP
   ▲                                                                                              │
   └────── statistics + one retry if needed ◀──── OD_LIT ◀──(LED stable 60ms)─────────────────────┘
```

The measurement logic itself (dark-current subtraction, MAD rejection, retry, log10, I2C failure detection) is exactly the same as the original; only "run it all at once" became "run it in steps". As a consequence, `calibrate_blank()` changed from synchronous to queuing one measurement, with the MCU actively sending a notify about 3 seconds later.

**Other changes**: removed the automatic ΔP-Q sweep and the jumper/hollow-fiber lookup file; removed closed-loop pump flow-rate control (the flow pulsation of the peristaltic pump makes the P controller oscillate); logging changed to a single CSV including OD600 + pump PWM; new layout (left 2/3 charts, right 1/3 control panels).

**Old bug fixed along the way**: `rawToBar(int)` truncated the fractional part of the 16-point oversampling (`readBlockAveragedBar()` passes in a float), which effectively undermined the noise reduction and dropped the resolution back to 1 ADC count ≈ 0.0054 bar. Changed to `rawToBar(float)`. Side effect: readings are slightly higher by about half an ADC count (~0.003 bar); **re-zeroing is recommended**.

#### v2 — The State Machine Was Right, but the Calls Underneath Were Still Blocking (2026-09-01)

After v1, **pressure and flow rate still stalled during OD600 sampling**. Three causes:

**(1) The busy-wait loop in `readLightLevel()` ← main cause**

```cpp
if (requestFrom(addr, 2) != 2) return -1;
while (available() < 2) { if (millis() - start > 200) return -1; }   // busy-wait up to 200ms
```

In a synchronous Wire implementation, the whole transfer is already complete when `requestFrom()` returns, so normally that `while` never iterates even once — but if the sensor fails to respond properly even once, it spins in place for up to 200 ms. One measurement is 20 readings × 2 sensors, so **in the worst case `loop()` is frozen for 8 seconds**.
→ The timeout was cut to **3 ms** (2 bytes @100kHz take less than 1 ms); a timeout is treated as a read failure returning −1 and handed to the existing upper-level I2C failure detection.

**(2) Re-initialization on I2C failure**: `begin()` contains `delay(10)+delay(180)`, so if both sensors fail that is 380 ms, and it was attached to the wrap-up of every measurement.
→ Split into `powerOn()` / `setContinuousHRes()`, advanced step by step by `reinitTick()` using `millis()`.

**(3) Python issuing synchronous RPCs inside a Bridge callback**: `on_od600_update()` directly called `refresh_blank_info()` (which contains a synchronous `Bridge.call`), occupying the entire Bridge link — and the pressure notify and flow polling go over that very same link.
→ The callback now only sets a flag, and the actual read is handed to `od600_poll_loop`.

**New real-time diagnostics**: the MCU prints `[diag] loop_max_us=... pressure_samples_last_sec=.../100` every second, the web status bar shows the same, and turns red on anomalies.

| Value | Normal | Abnormal means |
|---|---|---|
| `loop_max_us` | A few hundred µs | Tens of thousands of µs = something is blocking in `loop()` |
| `pressure_samples_last_sec` | Close to 100 | Noticeably low = number of samples dropped due to blocking |

**New aggregated sampling** (see [§5.3](#53-aggregated-sampling)); the CSV changed to one row per window.

#### v2.1 — Exception Protection for Background Threads (2026-09-01)

The background loops were originally launched directly with `threading.Thread(target=fn)`, with no try/except around them. A single unhandled exception made that thread disappear **permanently**, and it died very quietly: the web page did not disconnect and other messages kept flowing; only that one stream stopped updating — the symptom was exactly "the screen is frozen, reconnecting does not help, only restarting the App fixes it".

- Every background thread is wrapped in `_run_forever()`: it prints the full traceback and restarts automatically after 1 second
- When a window receives no pressure data at all, the system **speaks up** (Console warning + red text in the web UI) instead of silently skipping it
- After reconnecting, the cards first follow the 200 ms instantaneous values until the first window that genuinely belongs to this connection ends
- The countdown now uses the remaining seconds computed by the backend; when reconnecting to a recording in progress, the chart's X-axis origin is moved back to the true recording start using `elapsed_sec`

#### v2.2 — Saving and Restoring Calibration Values (2026-09-01)

The OD600 blank reference, pressure zero offsets and path-length factor were all stored in MCU RAM and reverted to defaults on every restart. When a restart happens in the middle of an experiment, "refill the flow cell with clean medium and recalibrate" or "depressurize the whole system and re-zero" is simply impossible in practice — the sample is still inside.

Added automatic saving (`calibration_state.json`), automatic restore, persistent reminders, manual entry, plus 4 new Bridge functions on the MCU side (`set_blank_manual` / `clear_blank` / `set_pressure_offsets` / `get_pressure_offsets`) and `uptime_ms` at the end of `get_diag`. See [§7](#7-calibration).

#### v2.3 — Making "the Board Logs Independently" Actually True (2026-09-06)

Logging always ran on the board's Linux side, independent of the browser — but **the data rows for the whole run were kept in memory and written to file only on stop**, which meant "the board logs independently" only held when the run was wrapped up normally.

Changed to flush each window to disk as soon as it is produced (append + flush + fsync), automatically resume the same file after an interruption, add an HTTP download endpoint and a list of recording files, add the `gap_s` column to the CSV, and draw gaps in the charts as breaks in the line. See [§6.2](#62-flushing-to-disk-and-resuming-after-interruption).

### 9.4 Removed Features

| Removed | Impact / alternative |
|---|---|
| Automatic ΔP-Q sweep experiment | `blank_slope` / `blank_intercept` / `module_slope_net` are now maintained manually in `constants.json`. You can still obtain the data with "recording + manually adjusting PWM" and fit it yourself |
| Jumper/hollow-fiber lookup file | `calibration_library.json` is no longer generated or read. Coefficients in old files can be copied back into `constants.json` manually |
| Closed-loop pump flow-rate control (P controller) | Only direct PWM control is kept. It already oscillated because of the peristaltic pump's flow pulsation and was unreliable in practice |

**Kept**: OD600 developer mode, blank calibration and measure-now, pressure zeroing, baselines and relative alarms, steady-state detection, pulsation diagnostics, bilingual UI (Chinese/English).

---

## 10. Troubleshooting

> **The MCU does not respond at all (no `[boot]`, `method not available`), even with nothing attached**: unplug the UNO Q's USB-C, wait at least 10 seconds, plug it back in, and run the App only after boot has finished. Re-running the App does not restart the Bridge service on the Linux side; when it hangs, only a full power cycle recovers it (verified on 2026-10-06).

### 10.00 Power-Up Order (Confirmed on Real Hardware 2026-10-05)

**Plug in the UNO Q's USB first and wait until `[boot]` appears in the Serial Monitor before switching on the 12 V and other external supplies.**
If the external supplies are powered first, signals from the pinch valve driver board (D0), flow meters, pressure transmitters, L298N, etc. back-feed through the pins into the not-yet-powered MCU and the MCU boots abnormally: the Serial Monitor shows no `[boot]` at all and every Bridge function on the Python side reports `method ... not available`. It looks as if the sketch is broken, but the program is actually fine (it runs normally with nothing attached).
Hardware improvements (optional): put a 1 kΩ current-limiting resistor in series on every "external device → UNO Q" signal line (the pressure lines already have 15 kΩ); or use a single power switch/relay so that the external supplies are switched on only after the UNO Q has booted; do not connect the L298N's 5 V terminal to the UNO Q.

**Boot diagnostic indicator (v3.8.4, onboard built-in LED)**: 2 quick flashes = sketch has started; then steady on = waiting for the Bridge; off followed by 3 more flashes = Bridge connected. No flashing at all = the sketch was not loaded; stays steady on = stuck in Bridge.begin().

### 10.0 No Sensor Updates, Pump / Pinch Valve Buttons Do Nothing (v3.2 / v3.3)

**First check whether `assets/libs/` contains these two files: `socket.io.min.js` and `arduino.js`.**
They are placed there by App Lab's WebUI Brick and **are not included in this project's zip in the first place**. When an App is created from a new zip (rather than overwriting the files of an old App), they do not come along, with the result that the MCU and Python Consoles look completely normal and the Bridge connection is fine, but the web page receives no readings and the buttons send no commands (no `[ui] <-` appears in the Python Console). Fix: copy the whole `assets/libs/` from the old App, or remove the WebUI - HTML Brick in App Lab and add it again. Since v3.3 the web page shows a red notice directly when it detects missing files.

In v3.3 the Python Console prints every command sent from the web page (`[ui] <- set_pump_pwm {...}`), the result of sending it to the MCU (`[pump] -> MCU set_pump_pwm(200) response 200`), and every 10 seconds the number of messages sent to the web page. Use these to determine where things are stuck:

| Python Console | MCU Console | Stuck at |
|---|---|---|
| No `[ui] <-` | — | Web page → Python (usually the missing libs above, or an error in the browser's F12 Console) |
| `[ui] <-` present, `[pump] -> ...` reports a failure | No `[pump] set pwm` | Python → MCU (Bridge) |
| `[pump] -> ...` reports MCU responded 200 | `[pump] set pwm=200` present | The command reached the MCU; the problem is in the L298N / power / wiring |

This is almost always a **broken Python ↔ MCU Bridge**. Since v3.2 the web status bar shows "MCU: ● OK (v3.2)" or a red banner "MCU not responding"; troubleshoot in this order:

1. **Firmware version in the status bar**: only `v3.2` means the new sketch is actually running on the MCU. If it shows "old sketch" or a yellow version-mismatch banner → the sketch was not successfully re-uploaded (App Lab compile errors appear in the Console at the bottom).
2. **The MCU's Serial Monitor** (bottom of App Lab, MCU tab): you should see, in order,
   `[boot] integrated sketch v3.2 starting ... Bridge.begin=OK` → `[boot] step: OD600/flow/pressure/pump init done` → `[boot] step: valve init ...` → `[boot] step: core Bridge functions registered` → `[boot] step: v3 Bridge functions registered` → `[boot] entering loop()`, followed by one `[diag]` line per second. Wherever it stops, the problem is in the initialization right after that step.
   No `[boot]` at all → the sketch did not load successfully (check the Console for `Undefined symbol` / llext load errors), or the Bridge did not start.
3. **Bisection**: change `ENABLE_VALVE` at the top of `sketch.ino` to `0` and re-upload; if it still does not work, also change `ENABLE_PH` to `0`. Whichever one restores operation when disabled is the subsystem with the problem.
4. **Python-side Console**: `[mcu] !! MCU not responding: ...` states the timeout or error cause; `[startup] MCU sync finished, took N s` tells you whether the boot synchronization got stuck.
5. Disconnect the servo driver board from D0/D1 and try again to rule out bus / wiring problems (D0/D1 is also Zephyr's boot console UART).

Two suspected causes fixed in v3.2:

- **`Serial.begin(9600)` removed**: on the new core (0.55+), `Serial` is an alias for the RouterBridge `Monitor`; `Serial.begin()` starts the Bridge first, and then `Bridge.begin()` re-initializes a mutex that the bridge thread is already using, which can deadlock the Bridge — the symptom being exactly "no sensor updates and no button responds". STS3215test does not have this line, which is why it runs fine on the same board.
- **D9 `pinMode()` removed**: the known pitfall from §2.3, which makes the pump PWM output 0V.

**Q: After reconnecting, the screen is frozen and no numbers change**
Check three places in order: ① whether the "Pressure pulsation diagnostics" at the bottom of the page is updating (200 ms updates, not affected by aggregation) — if it is, the data is fine and the cards and charts simply update once per window; ② the MCU diagnostics in the status bar (5-second updates); ③ whether there is a Python traceback in the App Lab Console (since v2.1 it restarts automatically and prints it).

**Q: Pressure / flow rate stall during OD600 sampling**
v2 fixed the three causes. First confirm that v2 firmware is running: the Console should show the `[diag]` line every second. Then check `loop_max_us` (should be a few hundred µs) and `pressure_samples_last_sec` (should be close to 100).

**Q: There seems to be no data while the PC was asleep**
① Usually it is just a gap in the display (chart history lives only in browser memory) and the CSV should be complete — open the file on the board directly to confirm; ② check whether the board lost power too (common when powered from the PC's USB); ③ check whether the App was stopped (use App Lab's Run at startup).

**Q: All calibration values are gone after a restart**
Since v2.2 they are restored automatically. If you upgraded from an old version and nothing has been saved yet, fill them back in manually per [§7.3](#73-manual-entry).

**Q: The numbers on screen only change every 30 seconds**
That is the normal behavior of aggregated sampling. The "Sampling settings" panel has a countdown; for real-time response, look at "Pressure pulsation diagnostics".

**Q: Cannot reach the web page / "connection refused"**
Use port 7000, not 8080.

**Q: The layout appears but the values stay at `--`**
Usually the MCU did not start or the Bridge names do not match. Check the Console for `[boot] Bridge ready` and the `[flow]` / `[od600]` messages.

**Q: The Console only shows `entering loop()`, not `[boot]`**
Some App Lab versions drop the Monitor messages printed during `setup()` (the Console is not attached yet). This canary line exists precisely to tell these cases apart.

**Q: OD600 stays at 0 / does not change**
Check whether "Calibrate blank" has been pressed. Without a blank, OD600 is not updated to a meaningful value.

**Q: The pump hums but does not turn**
PWM too low, insufficient torque. Since v3.1 (pump replaced) the system no longer automatically clamps low PWM values to 0; measure the minimum PWM at which the new pump turns and avoid values below it — prolonged humming makes the motor heat up.

**Q: Pressure / flow rate show regular fluctuations**
Pulsation from the peristaltic pump; this is normal. "Pressure pulsation diagnostics" shows the peak/trough range and `cycle_freq_hz`. The specification requires first measuring the true pulsation frequency on the shell side with an oscilloscope, and then adjusting the sketch's `PRESSURE_WINDOW_MS` (must cover 2–3 pulsation cycles) and `PRESSURE_WINDOW_UPDATE_MS` accordingly.

**Q: Pressure readings rise and fall with the pump PWM**
A grounding problem, not fluid pulsation. See [§4.4 Grounding Strategy](#44-grounding-strategy-).

---

## 11. Known Limitations and To-Do

### Software Extensions Pending (Hardware Already in Place)

- [ ] **4th pressure transmitter** (A3): `PressureChannel` in `sketch.ino`, payload format, `PRESSURE_CHANNELS` in `main.py`, CSV columns, UI card
- [ ] **2nd flow meter** (D4): second interrupt counter and Bridge functions, `flow2_*` CSV columns, UI
- [ ] **2nd pump** (D10/D13/D11): second set of Bridge functions, `pump2_*` status and messages, UI panel (diaphragm pump locked to forward by default)
- [ ] **3 relays** (changed to D5/D6/A5 since v3; requires the pump pin relocation first): GPIO control, UI switches, CSV status columns
- [ ] Pump pin relocation (IN1/IN2 from D5/D6 → D8/D12) with the firmware constants updated accordingly
- [ ] Remove `pinMode()` from PWM pins (see [§2.3](#23-known-pitfall-pinmode--analogwrite); tried in v3.2, temporarily restored during v3.3 troubleshooting)
- [ ] **Pump PWM soft start**: ramp from 0 to the target value (over about 200–500 ms) instead of jumping straight there, eliminating the motor start-up inrush. Much cheaper than a bigger power adapter (see [§4.1](#41-power-budget))

### If the Second Flow Meter Is Installed on the Permeate Side

This unlocks the quantities the specification has always marked as "not computed because there is no permeate flow meter": **flux** and **conversion**.

### Hardware To-Do

- [ ] **12V 5A power adapter** (known load of 2.8A calculated from the pumps' nameplate ratings; the old version misestimated the UNO Q's consumption and specified 8–10A, see [§4.1](#41-power-budget))
- [ ] Evaluate replacing the L298N with a MOSFET driver (DRV8871 ×2 or BTS7960 ×2): recovers about 2V of voltage drop and 3.7W of heat, gives the peristaltic pump back about 30% torque, and eliminates the heatsink. Requires a matching change to the firmware interface (ENA/IN1/IN2 → IN1/IN2)
- [ ] Troubleshoot the header pin voltages of the AMS1117 module (labeled 3.3V, measured 12V)
- [ ] Solder the power board (three rails + star ground + protection components)
- [ ] ENA / ENB pull-down resistors
- [ ] L298N heatsink
- [ ] The four currents still to be measured in [§4.7](#47-figures-still-to-be-confirmed)

### Structural Limitations

- **The last unfinished window of a recording in progress** is lost on power failure (everything else has been flushed to disk)
- **Cumulative flow** is reset to zero after an MCU restart
- **Chart history** exists only in browser memory
- `zeroCalibrate()` is still blocking (32 readings × 5 ms ≈ 160 ms), but it is a one-off user-triggered action, so this is acceptable
- No temperature sensor: all viscosities / theoretical slopes use the assumed value `temp_operating_c = 22°C`

---

## 12. pH Monitoring and Pinch Valve (v3)

v3 merges in two independent projects: `ph_control_koh.ino` (pH) and `STS3215test` (bus servo). The latter serves here as the **pinch valve on the retentate outlet**: pinch the tube → flow is diverted through the membrane wall → TMP rises → a sample flows out on the permeate side.

> **v3.1 (2026-10-03)**: KOH base dosing control has been removed; pH is only monitored, calibrated and logged; D7 is no longer used. The full code of the base dosing version (dosing model, usage limits, FAULT logic) is kept in the v3 files and can be retrieved from there if it needs to be restored later.

### 12.1 Wiring

**pH probe (DFRobot Gravity pH V2 PRO, SEN0169-V2)**

```
Probe board OUT ──[analog isolation module (recommended)]──▶ UNO Q A4
Probe board VCC ── 3.3V or 5V (depending on the board; output 0–3.0V, does not exceed A4's 3.3V)
Probe board GND ── GND
```

The original program used A0, but A0 is already the Feed pressure, so it was moved to **A4**. The isolation module blocks noise from the peristaltic pump / L298N coupled in through the culture medium and the shared ground.

**DS18B20 (optional, disabled by default)**: connect to A5 (4.7kΩ pull-up to 3.3V), change `PH_USE_DS18B20` at the top of `sketch.ino` to `1`, and install OneWire + DallasTemperature. Without it, temperature compensation uses the fixed `PH_FIXED_TEMP_C = 37 °C`.

**STS3215 pinch valve (via Waveshare Serial Bus Servo Driver Board / Bus Servo Adapter (A))**

```
UNO Q D0 (RX) ──── Driver board RX      ← note: Waveshare labels it RX to RX, TX to TX (not crossed)
UNO Q D1 (TX) ──── Driver board TX
UNO Q GND     ──── Driver board GND     ← required, common ground
Driver board jumper cap ── set to "A" (UART control mode; B is USB mode)
Driver board power (DC5521 or green terminal) ── same voltage as the STS3215 spec (12V for the 12V version)
Driver board servo port ──── STS3215
```

- Waveshare labels the board's TX/RX from the point of view of the "external host controller", so wire them literally **RX→RX, TX→TX**; wiring them crossed gives no response at all (the web UI will show "servo offline").
- The jumper cap must be on **A**; on B the board uses USB and the signals on D0/D1 do not reach the servo.
- The driver board's supply voltage must equal the servo's rated voltage; **do not** take power from the UNO Q.
- The Waveshare documentation does not state the UART logic level; the official example uses an ESP32 (3.3V), and the UNO Q is also 3.3V, so a direct connection should work.
- Software settings are the same as STS3215test: `Serial1`, 1 Mbps, servo ID 1 by default (to change the ID, keep using STS3215test's `change_id` mode, with only one servo on the bus while changing the ID).

### 12.2 Unified ADC Resolution (Important)

`analogReadResolution()` is a global setting. The original pH program set 14-bit, while the original pressure program assumed 10-bit (`ADC_MAX = 1023`) — merging them directly would scale all pressure readings up by 16×. v3 switches to a single shared `ADC_BITS = 14`, and `ADC_MAX` for the pressure conversion is derived from it. The pressure zero offset is in bar and independent of resolution, so **saved offsets remain usable**; still, after the first flash it is recommended to check that the pressure reads close to 0 when depressurized.

`VREF = 3.3` is also shared by both: measure the actual 3V3 pin voltage and enter it, which improves the absolute accuracy of both pH and pressure.

### 12.3 pH Measurement and Pinch Valve Safety Design

**pH (v3.1)**

- One reading every 500 ms: 256-sample oversampling (non-blocking and segmented, only 32 samples read per `loop()` pass) → temperature compensation → sudden changes require 3 consecutive confirmations → EMA filter, same as the original program
- States: `WARMUP` (no first reading yet), `OK`, `PROBE_ERROR` (reading outside 2–12: probe disconnected / broken wire / bad calibration). An error only produces a flag and an alarm and does not affect other functions; readings from that period are not written to the CSV's `ph`
- Two-point calibration does not require pausing first (there is no base dosing action any more); after calibration the current reading is immediately recomputed with the new slope (fixing the original program's issue where `phFiltered = NAN` after calibration was judged as a fault)

**Pinch valve (all on the MCU)**

| Trigger condition | Action |
|---|---|
| TMP instantaneous peak > `tmp_limit` (default 0.5 bar) or Feed peak > `feed_limit` (default 1.0 bar), for 2 consecutive 200 ms windows | Release + latch FAULT |
| Closed time > `max_close_s` (default 900 s) | Release + latch FAULT |
| Servo temperature ≥ 60 °C | Release + latch FAULT |
| Servo fails to respond 3 times in a row while closed | Latch FAULT (even if it cannot release, people must be told); automatically moves to "open" when it comes back online |
| Pump emergency stop | Release (FAULT not latched) |
| MCU boot | Always moves to "open" |

In the FAULT state closing is refused; "Clear" must be pressed in the web UI. TMP uses the instantaneous peak `(Feed_peak + Retentate_peak)/2 − Permeate_trough`, the same definition as `tmp_peak` on the Python side.

Servo I/O is done only inside `loop()`; the SCServo timeout was reduced from the default 100 ms to 8 ms so that an offline servo does not stall the 100 Hz pressure sampling.

### 12.4 Bridge Interface Format

pH and pinch valve functions all use `key=value,key=value`, so adding or removing fields does not misalign older parsers. `set_*_config` changes only the keys provided, applies them all at once only if the whole set passes validation, and returns `rejected:<reason>` on failure.

```
get_ph_status   → ph=7.012,v=1.4931,t=37.0,state=OK
get_ph_config   → v7=1.50306,v4=2.00000,cal_temp=25.00
valve_get_status→ online=1,cmd=closed,fault=0,pos=2600,goal=2700,load=612,temp=38,volt=121,cur=40,
                  moving=0,closed_ms=47200,torque=1,configured=1,msg=
valve_get_config→ id=1,open=2048,closed=2700,speed=1500,acc=50,torque_limit=1000,max_close_s=900,
                  tmp_limit=0.500,feed_limit=1.000
```

### 12.5 Saving and Restoring Settings

`python/ph_valve_state.json` stores the pH calibration points and pinch valve settings.

- **Values saved from the web UI take precedence over the sketch defaults**. They are pushed back automatically when the MCU restarts (the uptime in `get_diag` decreases). To return to the sketch defaults, delete this file and restart the App.
- When upgrading from v3, the base dosing parameters and KOH usage in the old file are ignored; only `v7` / `v4` / `cal_temp` are taken.
- On the pinch valve's first start (no saved file yet), the `valve` block of `constants.json` is used as the initial values (safety limits, ID, speed, torque); the open / closed positions must be measured and set in the web UI.

### 12.6 First-Time Operating Procedure

**Pinch valve**
1. Web UI "Pinch valve settings" → "Torque off" → turn the clamp by hand until it just flattens the tube → "Record current position as closed"
2. Turn it back to a position that does not press the tube at all → "Record current position as open" → "Torque on"
3. (Optional) Lower the torque limit to reduce the pinching force and servo heating while still sealing fully
4. With the pump running, press "Close" and watch TMP rise and permeate flow out; when enough has been collected, press "Release"
5. Each "close → release" cycle writes one row to `recordings/valve_events.csv` (duration, mean/peak TMP during the period, Feed peak, release reason, corresponding recording file name)

**pH**
1. Immerse the probe in pH 7.00 buffer → "Record as pH 7.00"; immerse in pH 4.01 → "Record as pH 4.01"
2. Put the probe back in the reactor; the reading and temperature are written to the CSV every sampling window

### 12.7 Alarms and Analysis

- System alarms: pH no data for 10 seconds / probe error, pinch valve FAULT / offline / closed
- **While closed and for 60 seconds after release** (`valve.alert_settle_sec`), fouling-trend alarms such as ΔP / R / dTMP/dt / d²TMP are suspended — collecting a sample inherently makes them change drastically. Absolute TMP limit alarms are not affected
- On the pressure and pH charts, windows during which the pinch valve was closed are marked with a light purple background
- When analyzing membrane performance (R, steady state), use the CSV's `valve_closed_frac == 0` to filter out sample-collection periods

### 12.8 Known Limitations

- The PDFs and PPTX under `docs/` have not yet been updated to v3 / v3.1
- `Serial.begin(9600)` is still kept; on the new Zephyr platform `Serial` goes through the Bridge and does not conflict with `Serial1` (pinch valve)
- The DS18B20 OneWire read itself is bit-banged and takes a few ms each time (conversion is now non-blocking, so it no longer stalls for 750 ms)
- The pinch valve has only two positions, open / closed; if "partial closing to control TMP" is wanted later, the MCU side already has `valve_goto_raw`, so a closed loop can be added on the Python side

### 12.9 v3.4: pH Manual Temperature and Automatic Servo Scan

**pH compensation temperature**: without a DS18B20, the culture medium temperature can be entered in the web UI's "pH probe calibration"; pressing "Apply temperature" takes effect immediately and saves it in `ph_valve_state.json` (pushed back automatically after an MCU restart). For two-point calibration, also fill in the "Buffer solution temperature" (usually room temperature), which is recorded as the calibration temperature; it does not affect the culture medium compensation temperature.

**Automatic servo scan**: "Pinch valve settings → Servo not found? Auto scan"

- Quick scan (about 1 second): sends one broadcast Ping at each of 8 baud rates. With only one servo on the bus, it reports its own ID.
- Full scan (about 30 seconds): Pings 8 baud rates × ID 0–253 one by one, and can find multiple servos.
- Once found, press "Use" → the ID and baud rate are written and saved, and the pinch valve immediately reconnects with the new settings.
- After the scan, a hint is given based on the "number of bytes received":
  - **Not a single byte received** → hardware problem (driver board power, jumper A, RX/TX, common ground, servo cable), not an ID problem.
  - **Bytes received but not parseable** → TX/RX swapped so the board reads back its own transmitted data, another device on the bus, or a poor contact.
- The status bar also normally shows the baud rate and the cumulative number of bytes received on the bus, so when offline you can tell directly whether there was any response at all.
- The SCServo timeout was relaxed from 8 ms to 15 ms.

**Blind move test (v3.5)**: "Pinch valve settings → Blind move" sends "torque on + move" to broadcast ID 254 once at each of the 8 baud rates. By protocol, broadcast writes get no response, so regardless of the servo ID and whether the RX line works:
- **The servo moves** → D1/TX, the driver board and power are all fine; the problem is in the response path (D0/RX, TX/RX swapped).
- **The servo does not move** → the problem is in D1/TX, the jumper cap, the driver board power or the servo cable.

The automatic scan reads 1 noise byte every time it switches baud rate; since v3.5, ≤ 2 bytes per baud rate is still judged as "no response at all".

**D0–D1 loopback test (v3.6)**: disconnect the driver board, connect D0 to D1 with a wire, and press "D0–D1 loopback test". It sends 64 bytes at both 115200 and 1 Mbps and checks whether they come back: if they do, the UNO Q side is fine and the problem is in the driver board / power / voltage levels / servo; if not, D0/D1 on the UNO Q side has a problem.



## 13. Algorithm Selection (v3.7)

Following the fallback options in the "Algorithm Review Report", the web UI's "Algorithm selection" panel allows switching on the fly; the settings are stored under `algorithms` in `ph_valve_state.json` and pushed back automatically after an MCU restart. All defaults are equivalent to the old version (legacy).

| Item | Options | Report reference | Runs on |
|---|---|---|---|
| Flow-rate frequency | `gate` (gated counting, default) / `reciprocal` (reciprocal timing, higher resolution at low frequency) | C-1 | MCU |
| OD600 outlier removal | `mad` (default) / `qn` / `biweight` (Tukey c=4.685) / `upper` (one-sided, rejects only low values, i.e. bubble shadowing) | E-1/E-2/E-5/E-3 | MCU |
| Analysis data source | `ema` (default) / `raw` (analysis path bypasses the EMA, eliminating phase lag) | F-1 | Python |
| Aggregate statistic | Median / mean / `trimmed10` (10% trimmed mean) / `hodges_lehmann` | G-2/G-3 | Python |
| Steady-state criterion | `legacy` (default) / `ci` (slope + t·SE < threshold, and steady only when 8 of 10 checks pass) | H-1 + H-3 | Python |
| Curvature | `legacy` (difference of two slopes) / `quadfit` (quadratic fit 2a) | H-8 | Python |

- `ci` mode uses a 120 s window and a threshold of 0.002 bar/min (flow rate 5 mL/min²), because with a 60 s window the standard error of the slope is about 1.3×10⁻³, so a 0.001 threshold would almost never be met. Adjustable in `constants.json → algorithms`.
- The CSV adds `tmp_sd/iqr/min/max_bar`, `feed_sd_bar`, `flow_sd/iqr/min/max_mlmin` (G-4) and `alg_profile` (records the algorithm combination used for that row), 58 columns in total.
- Not implemented: A-4/A-5, the §3 hardware items; H-9/H-10 (Hermia model, flux) require a permeate-side flow meter.


## 14. Pressure Divider and DS18B20 Temperature (v3.8)

**Pressure divider**: transmitter output → 15 kΩ → midpoint to A0/A1/A2 → 22 kΩ → GND, ratio 22/37 = 0.5946, so 5 V becomes 2.97 V at the pin. In the code these are `DIV_R_TOP_KOHM` / `DIV_R_BOTTOM_KOHM`; when changing resistors, change only these two numbers (entering the measured resistance is recommended). One ADC reading is discarded before each pressure read (source impedance is about 8.9 kΩ, so the first reading after switching pins is pulled toward the previous channel); adding 100 nF from each analog pin to GND is recommended. After flashing, depressurize and redo "Pressure zeroing".

**DS18B20**: VDD→3.3 V, GND→GND, DQ→D8, with a 4.7 kΩ pull-up between DQ and 3.3 V (an ordinary 5% resistor is fine; do not add another if the adapter board already has one). Requires App Lab platform 0.54.1 or later (which fixed `delayMicroseconds()`). Since v3.8.1 the 1-Wire driver is embedded in the sketch, so **no library needs to be installed** (v3.8 depended on OneWire / DallasTemperature, which App Lab did not install automatically, causing a compile failure).

- The sensor is searched for at boot; if not found, it is searched for again every 10 seconds (hot-pluggable); it is read once per second, non-blocking.
- A reading of -127 (disconnected), 85.0 (conversion not completed) or outside -10–100 °C counts as a failure; after 3 consecutive failures the manual temperature from the pH panel is used, switching back automatically once readings recover.
- The temperature is also used for pH compensation; the CSV's `ph_temp_c` (0.01 °C) and `temp_src` (ds18b20 / manual) record which source each row actually used.
- To not use the DS18B20 at all: change `PH_USE_DS18B20` to 0.


## 15. HFM Derived Parameters (v4.0, per `HFM_bioreactor_UI_spec.md`)

Channel mapping: Feed = **P_in** (module bottom), Retentate = **P_out** (module top), Permeate = **P_s** (shell sampling luer, at the same height as P_out), flow meter = **Q_L**. Derived parameters are always displayed in kPa.

**Tier 1 (always shown, large font)**: TMP_out = P_out − P_s (small text: P_out trough over the last 3 seconds − P_s); ΔP ratio = ΔP_friction / baseline (ΔP_friction = (P_in − P_out) − ρgh, baseline = a·Q + b·Q²); γ (pressure) = τ_w/μ; γ_ratio = γ (pressure) / γ (flow); J, L_p, D (require Q_perm); liquid level (no sensor installed).

**Tier 2 (trends)**: γ_ratio and ΔP ratio on the same chart (dashed lines at 1.0 / 1.3), L_p trend (dashed lines at initial value / 70%), P_out instantaneous waveform (last 60 seconds, trough vs P_s).

**Tier 3 (diagnostics, expandable)**: TMP_mean, TMP_in, TMP non-uniformity, R_t, P_s, τ_w (with a note "far below the cell damage threshold"), τ_shell, Re, ΔP_friction, ΔP reading, dTMP/dt, γ_flow.

**Alarms**: TMP_out ≤ 0 (critical), trough − P_s ≤ 0 (critical), ΔP ratio > 1.3, γ_ratio > 1.3, L_p < 70% of initial value, P_s more than 2 kPa above its self-test value; the absolute TMP limit is kept. Fouling-type alarms are suspended while the pinch valve is closed and for 60 seconds after release. The old R / ΔP multiple, shear rate > 6000, dTMP/dt and d²TMP/dt² alarms have been removed.

**Start-up self-test (ρgh)**: "Gravity offset self-test and settings" → stop the pump → start the self-test. Wait 10 seconds → record for 30 seconds → counts as a plateau only if the slope is ≤ 0.15 kPa/min (otherwise waits up to 3 minutes) → ρgh = mean of (P_in − P_out), and the P_s reference value is recorded at the same time; a difference of > 10% from the previous result, or P_s deviating from 0, prompts a check of the pressure lines for bubbles / the zero point. The result is saved and reused after an App restart. **Note**: if "Pressure zeroing" was previously done with the system full of liquid and the pump stopped, the hydrostatic column has already been subtracted and ρgh will be close to 0; this is normal.

**Q_perm**: until an electronic scale is installed, it can be entered manually in the settings (weigh the collection bottle and calculate it yourself, g/min ≈ mL/min); only then do J, L_p, D, R_t and τ_shell appear. The L_p initial value is recorded automatically the first time it can be computed, and can be reset.

**Constants**: the `hfm` block of `constants.json` (A = 200 cm², n_eff = 11, d_i = 0.1 cm, L = 60 cm, V_shell = 36 mL, V_culture = 1 L, μ = 0.7 cP, alarm thresholds, self-test parameters). The ΔP–Q baseline defaults to a = 0.02615 kPa/(mL/min) (= 3.4 kPa at 130 mL/min); it can be changed in the web UI or via "Set current state as ΔP baseline".


## 16. Calibration Value Export / Import, Spec Management, Parameter Explanations (v4.1)

**Export calibration values**: Calibration value management → "⬇ Export calibration values" downloads `calibration_YYYYMMDD_HHMMSS.json`, containing the MCU's currently effective OD600 blank / pressure zero points / path length, pH two-point calibration, ρgh / ΔP–Q baseline / Q_perm / L_p initial value, specs, and pinch valve settings.
**Import calibration values**: "⬆ Import calibration values" → choose a file → tick the sections to apply → Apply. After the OD600 blank and pressure zero points are written to the MCU, their source is marked "Manual entry" (the yellow notice will appear); ρgh and the ΔP–Q baseline are marked "Imported from file". Only files exported by this system are accepted (`format = hfm-bioreactor-calibration`).

**Spec management** (below calibration value management): the specs required by the derived parameters, grouped into module geometry, volumes, fluid properties, operating targets, alarm thresholds and start-up self-test parameters. Changes take effect immediately and are saved in `ph_valve_state.json` (`specs`), persisting across App restarts; fields that differ from the `constants.json` defaults are marked ●; "Compute A and V_lumen from geometry" fills them in using A = n·π·d·L, V = n·π·d²/4·L (Apply must still be pressed); "Restore defaults" clears all overrides.

**Parameter explanations** (replacing the "Metric explanations" unit since v4.2): every large-figure tile and diagnostic card in membrane filtration monitoring, the OD600 current-value card, the steady-state badge and the ρgh text are clickable (or keyboard Enter); a floating window shows the current value, meaning and normal range / criteria; thresholds in the ranges follow the spec management settings. Close with Esc or by clicking the background.


## 17. Pump Start-Up Kick (v3.10.0 / v4.4 / v4.6)

**Problem**: at standstill the peristaltic pump has static friction (rollers pressing the tube + gearbox), and the L298N eats about 2 V on top of that, so it cannot start at low PWM; but once turning, it needs less torque and PWM 150 is enough to keep it going.

**Approach (MCU side)**: when `setPumpSpeed()` detects "PWM changes from 0 to > 0" and the target is below the kick PWM, it first outputs the kick PWM, and after `kick_ms` the `pumpTick()` in `loop()` drops it back to the target value. Changing the PWM while running does not kick again; no kick is applied when the target ≥ the kick PWM.

| Setting | Default | Range | Description |
|---|---|---|---|
| en | 1 | 0/1 | Enable start-up kick |
| pwm | 255 | 1–255 | Kick PWM |
| ms | 500 | 0–5000 | Kick duration |
| stall | 0 | 0/1 | Automatic re-kick on stall: PWM>0 but no flow meter pulses for 3 consecutive seconds → kick once more, at most 3 times (counter resets only after stopping and restarting); not done when the pinch valve is not in the "open" state |

- Bridge: `get_pump_kick`, `set_pump_kick("en=1,pwm=255,ms=500,stall=0")`; the `get_pump_status` format is unchanged (`pwm,dir`).
- Python: messages `pump_get_kick` / `pump_set_kick` / `pump_kick`; stored under `pump_kick` in `ph_valve_state.json` and pushed back automatically when the MCU restarts; calibration value export / import gains a `pump_kick` section.
- Web UI: "Start-up kick" collapsible section below the pump panel.
- **Tuning advice**: start with the defaults; if starting at 150 still occasionally sticks, increase the kick duration to 800–1000 ms. If the flow meter is reliable, "Automatic re-kick on stall" can be enabled. The instantaneous flow is higher during the kick, so for pressure-sensitive experiments the kick PWM can be lowered (e.g. 220).

## 18. DS18B20 1-Wire Diagnostics (v3.10.1)

When no sensor is found, the Serial Monitor prints an extra line:

```
[ds18b20] diag: pin=D8 port=gpio@... idx=4 mode=fast ext=0 int=1 drive=0 pres_start_us=15 pres_len_us=120 intpull=1 => external 4.7k pull-up has no effect ...
```


| Field | Meaning | Normal |
|---|---|---|
| ext | Level with the internal pull-up off and the bus released | 1 |
| int | Level with the internal pull-up on | 1 |
| drive | Level read while pulling low | 0 |
| pres_start_us / pres_len_us | Start time / length of the presence pulse after reset | 15–60 / 60–240 (-1 = none) |

Interpretation: `ext=0,int=1` → the external 4.7 kΩ is not connected; `ext=0,int=0` → DQ is pulled to GND (wiring error; VDD/GND swapped will get hot); `ext=1` but `pres=-1` → the pull-up is fine but the sensor does not respond (DQ not connected to D8, no power on VDD, no common ground).

Wiring (common color code for waterproof probes; follow the seller's labeling): red = VDD → 3.3 V; black = GND → GND; yellow (or white) = DQ → D8; 4.7 kΩ between DQ and 3.3 V. D8 = STM32 PB4.

**Since v3.10.2**: when no sensor is found, a new search runs automatically every 10 seconds, each printing `[ds18b20] search #N: ...`; when the failure cause changes, or about once a minute, a full diagnostic line is attached; once found, it prints "sensor found" and then prints the temperature every 30 seconds. The "Thermometer diagnostics / re-search now" button in the web UI's temperature area shows the diagnostic result immediately and re-searches right away (no need to wait 10 seconds).

**Connect the sensor's VDD to the UNO Q's 3.3 V** (the same 3.3 V as the 4.7 kΩ pull-up), not to the main power supply side: an unpowered sensor pulls DQ low (the diagnostics show `ext=0 int=0`), and 3.3 V back-feeds into the sensor through the pull-up resistor.

## 19. ΔP–Q Sweep (main.py v4.6 / Web UI v4.8, No Reflash Needed)

Location: Membrane filtration monitoring → bottom of "Gravity offset self-test and settings".

1. Preparation: pressure zeroing → stop the pump and do the ρgh self-test → clean membrane, pinch valve released.
2. Enter the PWM points (2–10 of them, e.g. `120, 150, 180, 210, 240`), the sweep order (default high to low), the settling time per point (default 20 s) and the recording time (default 30 s), then press "Start sweep".
3. For each point: set PWM → wait to settle → record ΔP_total = P_in − P_out (average of 5 Hz pressure snapshots) and flow (1 Hz) → ΔP_friction = ΔP_total − ρgh.
4. When finished, the PWM from before the sweep is restored; manually changing the PWM or an emergency stop during the sweep aborts it, and the pump is not switched back on.
5. Shows the measurement table, scatter plot, quadratic and linear fits (through the origin), R² and residuals; when the quadratic term is negative, linear is recommended. `dp_a` and `dp_b` are written only when "Apply quadratic / linear fit" is pressed.

Saved and exported / imported (`hfm` section): `dp_a`, `dp_b`, `dp_source`, `dp_at`, plus
- `dp_points`: for each point `pwm`, `q`, `q_sd`, `dp_total_kpa`, `dpf`, `dpf_sd`, `n_p`, `n_q`, `warn`
- `dp_fit`: `linear` / `quadratic` (a, b, r2, rms_kpa), `recommended`, `model` (the one actually applied), `q_range`, `rho_gh_kpa` (ρgh at the time of the sweep), `settle_s`, `measure_s`

`dp_total_kpa` is kept, so if ρgh is re-measured later, the data can be refitted using `dp_total_kpa − new ρgh`.

## 20. Thermometer as Default Temperature Source, Operating Parameter Input (main.py v4.7 / Web UI v4.9, No Reflash Needed)

**Temperature fields**: the pH compensation temperature, buffer solution temperature and the calibration temperature in calibration value management each have a "Use thermometer" checkbox next to them. When the thermometer is working it is checked by default and the field is filled automatically with the live temperature (blue, read-only); when the thermometer cannot be read, it is unchecked automatically and switches to manual entry.
- pH compensation temperature: when checked, the MCU already compensates using the thermometer and the "Apply temperature" button is hidden; uncheck it to change the manual fallback temperature used when the thermometer cannot be read.
- Buffer solution temperature: when using the thermometer, its probe must be placed in the buffer together with the pH probe.
- Calibration temperature: pressing "Read back the values currently in effect" automatically unchecks it and shows the temperature at the time of calibration.

**Operating parameter input** (membrane filtration monitoring area, below the value tiles):
| Field | Purpose | Stored in |
|---|---|---|
| Q_L source (flow meter / manual) | When manual, all derived parameters (γ, Re, ΔP ratio, τ) use the manual Q_L | `hfm.q_l_mode` |
| Manual Q_L (mL/min) | Same as above | `hfm.q_l_manual` |
| Q_perm (mL/min) | J, L_p, D; can be calculated from "collected amount (g) ÷ time (min)" | `hfm.q_perm_mlmin` |
| Culture volume V (L) | D | `specs.v_culture_l` |

All of the above are saved and included in calibration value export / import (`hfm`, `specs` sections). The derived parameters gain a `q_l_src` (meter / manual). The ΔP–Q sweep always uses the flow meter reading.

## 21. DS18B20 Timing (v3.10.3)

Symptom: the sensor is found at boot (reset/presence normal), but reads keep failing afterwards. Reset timing is very tolerant, but the write-1 / read bit slots need < 15 µs precision; if `delayMicroseconds()` (= `k_busy_wait()`) is inaccurate at single-digit microseconds, wrong commands are written and wrong data is read.

Since v3.10.3, 1-Wire bit slots use a "calibrated busy loop": on the first search, `millis()` is used to count how many busy-loop iterations run in 50 ms, converted into iterations per microsecond (costs about 0.1 seconds extra, done only once). At boot it prints:

```
[ds18b20] timing calibration: busy loop NN iterations/µs, delayMicroseconds(6) measured X µs, busy loop 6 µs measured Y µs, using busy loop
```

If X is far greater than 6 (e.g. 30), the system timer accuracy is confirmed as the problem. Each read failure prints `[ds18b20] read failure #N: <cause>`:
| Cause | Meaning |
|---|---|
| `convert:no_presence(1/2)`, `read:no_presence(…)` | No response to reset (1 = line pulled low, 2 = no presence) |
| `all_0xFF` / `all_0x00` | Everything read is 1 / 0: the sensor is not returning data (usually the command was not received correctly) |
| `crc …/…` | Data came back but with bit errors (timing or noise); the 9 raw bytes are attached |
| `85.0C(...)` | Read the power-on default value: the convert command was not received |

## 22. Command Channel Outage (v3.10.5 / main.py v4.8)

Symptom: after the PC wakes from sleep, pressure in the web UI keeps updating, but flow freezes and the pump and pinch valve buttons do nothing; values in the Serial Monitor are normal.

Root-cause analysis: pressure, pH, OD600 and pinch valve status are all **actively pushed** by the MCU (Bridge.notify); flow, pump, pinch valve commands and calibration reads are Python **calling** the MCU (Bridge.call). Only the latter failing means the "Linux → MCU" command channel is stuck. The trigger is the browser reconnecting: the web page sends a dozen or so requests at once, several of which call the MCU simultaneously, on top of the per-second flow polling in the background.

Fix:
- Python: every `Bridge.call` goes through a queuing layer (`_QueuedBridge`) that sends only one at a time; default timeout 5 s (zero_calibrate 15 s, ds_diag 8 s); 3 consecutive failures → the Console prints `[mcu] !! MCU not receiving commands…` and the web UI shows a red banner; on recovery it prints `[mcu] command channel restored`.
- MCU: all Bridge functions now use `provide_safe` and run sequentially inside loop(), so they no longer access variables concurrently with loop() and no longer run on the Bridge background thread (whose stack is only 500 bytes).
- MCU: the Serial Monitor prints `[rpc] received N Python calls in the last 30 s` every 30 seconds; if calls had been arriving and then there are 0 for 30 seconds, it prints a warning (`[rpc] !! no calls received at all within 30 s…`).

Interpretation:
| Serial Monitor | Python Console | Meaning |
|---|---|---|
| `[rpc]` call-count line, N calls (N about 30) | No errors | Normal |
| `[rpc] !!` warning: no calls at all within 30 seconds | `[mcu] !!` "MCU is not receiving commands" | Commands are not reaching the MCU from the Linux side (router): stop and restart the App; if that fails, unplug power for 10 seconds |
| `[rpc]` call-count line, N calls (N > 0) | `[mcu] !!` "MCU is not receiving commands" | The MCU receives the calls but the responses do not come back: send both logs to the maintainer |

## 23. MCU Self-Recovery and Verification (v3.10.6 / main.py v4.9 / Web UI v4.10)

> **Automatic restart has been removed since v3.10.7**: real-hardware testing confirmed that after a software restart of the UNO Q, the MCU does not reconnect to the Bridge. The content below is kept for the record only; "Simulate MCU not receiving commands" and the watchdog settings have been removed from the web UI.

**Mechanism**: Python calls the MCU every second (to read flow). The MCU records the time of the last call received; if it "had been receiving calls" and then receives none for longer than the threshold (default 60 s), the MCU prints a warning and restarts itself (Cortex-M SYSRESETREQ, power not interrupted). After a restart it is re-armed only once Python calls again, so if the channel is still broken it will not restart repeatedly. Python detects the restart via the decreased uptime in get_diag → pushes back the calibration values, pH, pinch valve and start-up kick settings → restores the pump direction and PWM to the pre-restart settings (if it was stopped, it stays stopped) → re-configures the watchdog (if there have been ≥ 2 restarts in the last hour, it is disabled and only warns). When the App stops normally, atexit first disables the watchdog (best effort).

**Hardware recommendation**: add a 10 kΩ pull-down to GND on each of the L298N's ENA, IN1 and IN2, so that the pump is guaranteed to be stopped while the pins float during the few seconds of an MCU restart.

**Location**: Engineering mode → "MCU connection and self-recovery" (status updates every 3 seconds while expanded).

**Verification steps** (first with only USB connected, then with the L298N connected but no motor, then with clean water):
| Test | Procedure | Pass criterion |
|---|---|---|
| Stress test | Concurrent calls 50 → Stress test | 50/50 succeed; no "MCU is not receiving commands" message in the Console; afterwards the pump and pinch valve can be operated |
| Simulate Python-side disconnect | Press it and wait 30 s | Within about 3 s, the red banner and the `[mcu] !!` "MCU is not receiving commands" message; after 30 s, `[mcu]` "command channel restored" and the banner disappears |
| Simulate MCU not receiving commands | First set pump PWM to 150, press it and confirm | After the threshold, the Serial Monitor shows `[rpc] !! … automatically restarting MCU` → a new `[boot]`; within about 10 s the Console shows `[pump] MCU restarted: restoring pump PWM 150` and the calibration values are restored; flow returns to its previous value; the pinch valve returns to "open" |
| Restart while the pump is stopped | Do the previous test with pump PWM 0 | After the restart the pump stays stopped |
| Hourly limit | Do it a 3rd time within one hour | The Console reports that automatic restart is paused; the status bar automatically shows "Off" again |
| Resync | Press "Resync" | Shows "All settings have been read back and synchronized" |
| Real-world | Put the PC to sleep for 10 minutes and wake it, repeated 5 times | After each wake, flow updates and the pump can be operated |

