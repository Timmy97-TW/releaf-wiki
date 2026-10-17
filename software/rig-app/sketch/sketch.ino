/*
  ============================================================================
  ReLeaf Perfusion HFB - MCU Sketch v4.2.2 "raw sampling edition + feed pump / base dosing / multi-valve / pressure protection"
  (Arduino UNO Q / STM32U585 + Zephyr, App Lab)
  ============================================================================
  v4.2.2 (2026-10-16):
    - Channel B is single-direction: on the board IN3 (D12) never goes high, so forward is unusable. Every channel-B
      function (feed pump run, base dosing pulses) now drives IN4 (D13) with IN3 held low, i.e. the old "reverse".
      If the liquid flows the wrong way, swap the two motor wires on OUT3 / OUT4. set_feed_pump ignores dir (fdir=0),
      and the IN3 / IN4 swap option (inv) is removed.
  v4.2.1 (2026-10-16):
    - Feed pump: reverse worked but forward did not, so IN4 (D13) and ENB (D11) work and IN3 (D12) never went high.
      D12 is PB14, which the UNO Q device tree also lists as a PWM pin (TIM1_CH2N); a PWM write elsewhere can hand the pin
      back to the timer. Now ENB is written first and IN3 / IN4 last (pinMode(OUTPUT) re-asserted each time), and the IN
      levels are re-asserted every 200 ms.
    - chb_pin_test("in3=1,in4=0,enb=1,ms=..") holds plain levels on the channel-B pins for measuring with a meter; the reply
      and status carry rb=<IN3><IN4>, the level read back from the pins.
    - set_base_config("inv=1"): swaps IN3 / IN4 (forward drives IN4). Workaround if D12 stays dead: swap the motor wires
      on OUT3 / OUT4 and set inv=1, then forward and base dosing run on IN4 (reverse is then unavailable).
  v4.2.0 (2026-10-16):
    - The second pump (L298N channel B) is now the feed pump: what it pumps is chosen by the feed valve (base / external feed).
      set_feed_pump(pwm,dir) runs it continuously like the main pump (forward / reverse, PWM 0-255). It needs no particular
      feed valve position, but will not start or keep running while the feed valve is online and "fully closed" (pumping
      against a closed valve), and stops on pressure protection / emergency stop.
    - Base dosing pulses (base_pump_pulse, used by auto pH and manual dosing) are unchanged: forward, base dosing PWM,
      feed valve confirmed at "base", hourly limit. A pulse is rejected while the feed pump runs continuously, and vice versa.
  v4.1.0 (2026-10-16):
    - Second pump (L298N channel B, diaphragm pump, forward only) dedicated to base dosing: base_pump_pulse(ms) runs as a "pulse",
      timed and switched off by the MCU itself (stops even if Linux hangs). Safety interlock: feed valve not confirmed at the "base" position -> reject / stop immediately;
      max 10 s per pulse; hourly cumulative limit (default 60 s).
    - Two new STS3215 valves (same Serial1 bus as the pinch valve, different IDs):
        shell sampling valve (ID 2): 0 fully closed 315° / 1 to pressure transmitter 270° / 2 fully open (transmitter + collection bottle) 0°
        feed valve    (ID 3): 0 fully closed 315° / 1 base 270°            / 2 external feed 180°
      On boot: shell valve goes to "to pressure transmitter", feed valve goes to "fully closed".
    - Pressure protection: any of the three channels > p_limit (default 0.7 bar) for 5 consecutive 10 ms samples -> stop main pump, stop base pump,
      release pinch valve (latch FAULT), and latch PTRIP; while latched, main pump start is rejected; clear with pressure_trip_clear.
    - Fix: pressure sampling now also runs inside the wait loops of valveBlindMove / valveLoopbackOnce (previously could block loop() for up to 1.28 s);
      on_p_raw dt per sample is only 2 hex digits, so a batch is flushed once it exceeds 240 ms, and dt is clamped to 255.
  v4.0.0 (2026-10-14) architecture change: the MCU only does "sensor sampling" and "pump / pinch valve control + safety interlock".
  All conversion, filtering, statistics, OD algorithms and pH conversion moved to Python on the Linux side; all raw readings are pushed to Python for logging.

    Sensor        What the MCU does                            What is pushed to Python
    ----------    -------------------------------------------  ------------------------------------------
    Pressure A0-A2  100 Hz scheduled sampling (each = discard first + sum of 16 ADC reads)  on_p_raw  one batch every 200 ms (20 samples), with sequence number and timestamps
    Flow D2       interrupt counting + 500 µs debounce, settled every 1 s     on_flow_raw pulse count, first-to-last pulse interval, cumulative pulse count
    OD600 I2C     measurement timing 4 dark + 16 light, I2C stuck detection and auto recovery  on_od_raw all raw counts of every attempt (photometer v1.2.0)
    pH A4         sum of 256 ADC reads every 500 ms               on_aux_raw every 1 s: pH sum, DS18B20 raw value, pump status
    DS18B20 D4    1-Wire read (driver embedded)                   (same as above)
    Pinch valve STS3215  open/close/configure + safe release        on_valve_update every 1 s + on state change

  Why: experiment records are data that cannot be reproduced. Previously the MCU computed mean, MAD, EMA before sending, so the raw readings were lost,
  and if an algorithm was wrong nothing could be recomputed. Now raw counts are kept in full on the board (Python writes recordings/<recording>_raw/),
  and any algorithm can later be re-run on the same data (tools/replay_raw.py, tools/replay_od.py).

  Only two kinds of computation remain on the MCU, both of which "must work even if Linux crashes":
    1. Pinch valve safety interlock: every 10 ms pressure sample is converted to bar and TMP and Lumen in are checked;
       release only after VALVE_TRIP_SAMPLES consecutive samples (default 5 = 50 ms) over the limit (v3's "2 consecutive overlapping 1 s windows" could not reject single-point spikes).
       Lumen in can optionally be judged on the "mean of the last 1 s". The zero offsets used for conversion are pushed over by Python after zeroing.
    2. Hardware-level self-recovery: BH1750 reading stuck / I2C failure -> re-initialize, reset the I2C controller (ported from
       inline photometer v1.2.0, fixes "light sensor cannot reconnect after a disconnect without a reboot").

  Bridge bandwidth: the UNO Q Bridge runs at 115200 bps (about 11 KB/s). Raw pressure data hex-encoded is about 1.8 KB/s,
  the rest is a few hundred bytes per second; Monitor.print uses the same line, so routine logs are reduced to one line every 10 s.

  Pins (v4.1.1: L298N six pins consecutive D8-D13, three pins per pump, EN on PWM-capable D9 / D11):
    Main pump D8 IN1   D9 ENA (PWM)   D10 IN2      Feed pump D11 ENB (PWM)   D12 IN3   D13 IN4   (v4.2.2: IN3 held low, the feed pump runs on IN4 only)
    D0/D1 STS3215 x3 (Serial1)   D2 flow meter   D3 OD LED (2N2222)   D4 DS18B20
    A0 Feed=Lumen in   A1 Retentate=Lumen out   A2 Permeate=Shell   A4 pH
    I2C: BH1750 sample 0x5C (ADDR→3V3) / reference 0x23 (ADDR→GND)

  Required Sketch Libraries: Arduino_RouterBridge, SCServo (1.0.2). BH1750 and DS18B20 drivers are embedded.

  ---- Bridge functions (Python -> MCU, String -> String) ----
    get_diag()                "loop_max_us,p_samples_last_sec,od_state,reinit_step,uptime_ms,FW,0,60,rpc_calls,
                               i2c=S:..|R:..,rc=S:n|R:n|B:n,io=S:slow/blk/fail|R:..,pskip=n,pbatch=n"
    get_config()              "adc_bits=..,vref=..,div=..,vmax=..,barmax=..,ovs=..,p_period_ms=..,
                               od_interval_s=..,ref_mode=..,mt=..,h2=..,period_ms=..,lpc=..,ppl=0"
    set_config(kv)            od_interval_s / ref_mode(0 dual optical path, 1 single optical path) -> get_config() or "rejected:<reason>"
    set_pressure_offsets(a)   "feed,retentate,permeate"(bar) -> zero offsets for the safety interlock (pushed by Python after zeroing)
    get_pressure_offsets()    "feed,retentate,permeate"
    --- OD600 ---
    trigger_measurement()     "queued" / "busy"
    get_last_raw()            on_od_raw content of the last completed measurement + ",age_ms=..,busy=0|1"
    set_dev_mode(on)          alignment mode (LED always on, automatic measurement paused) -> "1"/"0"
    get_dev_readings()        "dev,raw_s,raw_r,lux_s,lux_r" (live, dark current not subtracted; -1 on failure)
    reinit_sensors()          manually reset I2C + re-initialize both BH1750 -> "S:ok|R:ok" or "busy"
    --- Pump ---
    set_pump_pwm(pwm) / set_pump_direction(1|0) / stop_pump() / get_pump_status() / get_pump_kick() / set_pump_kick(kv)
    --- DS18B20 ---
    ds_diag() / ds_timing(spin|busy|cal)
    --- Pinch valve --- (same as v3.10.8)
    valve_open / valve_close / valve_goto_raw / valve_torque / valve_get_status / valve_get_config /
    valve_set_config / valve_clear_fault / valve_rescan / valve_scan / valve_scan_status /
    valve_blind_move / valve_loopback / valve_loopback_status
    --- Pressure protection (v4.1.0) ---
    get_pressure_protect()    "limit=..,trip=0|1,hits=..,pmax=..,msg=.."
    set_pressure_protect(kv)  limit(0.1–5.0 bar)
    pressure_trip_clear()     rejected while pressure is still above the limit
    --- Base pump (v4.1.0) ---
    base_pump_pulse(ms)       100-10000 ms; feed valve must be confirmed at the "base" position -> "ok,ms=.." or "rejected:<reason>"
    base_pump_stop() / get_base_status() / set_base_config(kv: pwm, max_s_h)
    --- Feed pump = channel B continuous run (v4.2.0) ---
    chb_pin_test("in3=0|1,in4=0|1,enb=0|1,ms=..")  v4.2.1: hold levels on IN3 / IN4 / ENB up to 30 s (wiring check)
    set_feed_pump("pwm=..")  pwm 0-255 (0 = stop); v4.2.2: always drives IN4 (dir is ignored) -> status or "rejected:<reason>"
    --- Shell valve / feed valve (v4.1.0) ---
    av_set("w,s")             w: 0 = shell, 1 = feed; s: 0/1/2 (see above)
    av_goto_raw("w,pos") / av_torque("w,on") / av_get_status() / av_get_config()
    av_set_config("w=..,id=..,p0=..,p1=..,p2=..,speed=..,acc=..")
    servo_set_id("old,new")   change the ID stored in servo EEPROM (only this one servo may be on the bus)
    --- Test ---
    rpc_wd_set / rpc_test_block

  ---- Push notifications (MCU -> Python, Bridge.notify) ----
    on_p_raw     "seq,t0_ms,HEX"  HEX = 17 chars per sample: dt(2, ms, relative to t0) + feed(5) + retentate(5) + permeate(5)
                 all three channels are the "sum" of 16 ADC reads (14-bit, 0~262128), zero offset not subtracted
    on_flow_raw  "seq,t_ms,window_ms,pulses,span_us,total_pulses"
    on_od_raw    "seq=..,att=..,final=0|1,hw_ok=0|1,stuck=S|R|SR|-,t0=..,per=..,mt=..,h2=..,lpc=..,ref_mode=..,
                  ds=a|b|c|d,dr=..,ls=16 values,lr=16 values"   (read failure = -1)
    on_aux_raw   "seq=..,t=..,ph=sum:n:t_ms;..,ds=ok|none|error,traw=..,tage=..,derr=..,pwm=..,fwd=..,kick=..,
                  bon=0|1,bpwm=..,bleft=..,bhour=..,bmaxh=..,bcnt=..,bwhy=..,fpwm=..,fdir=1|0,ptrip=0|1,plim=.."
    on_valve_update  same as valve_get_status()
    on_avalve_update same as av_get_status() (every 1 s + on state change)
    on_safety    "ptrip=1,msg=.." (at the moment pressure protection trips)
  ============================================================================
*/

#include <Wire.h>
#include <Arduino_RouterBridge.h>
#include <SCServo.h>
#include <math.h>
#include <string.h>

// DS18B20 temperature sensor (D4). Set to 0 to not touch 1-Wire at all.
#define PH_USE_DS18B20 1

// Firmware version: field 6 of get_diag(). Python compares it; on mismatch the web UI shows "the sketch running on the MCU is not this version".
#define FW_VERSION "v4.2.2"

#ifndef ENABLE_PH
#define ENABLE_PH     1
#endif
#ifndef ENABLE_VALVE
#define ENABLE_VALVE  1
#endif

// Routine log interval (Monitor shares the 115200 Bridge with data; do not print every second)
const unsigned long ROUTINE_LOG_MS = 10000UL;

// ---- Cross-section declarations ----
void pumpStallCheck(unsigned long pulses);
bool kvGet(const String &s, const char *key, float &out);
void valveInterlockSample(float tmpBar, float feedBar, float feedMeanBar);
void valveRequestOpen(const char *why, bool latchFault);
void pressureTick(unsigned long now);                          // v4.1.0: sampling also done inside blocking diagnostic functions
void pressureProtectSample(float f, float r, float p);
void basePumpStop(const char *why);
void feedRunStop(const char *why);
void chbPinTestCancel();
extern bool valveScanning;

// ---- Python call counter (command channel monitoring) ----
volatile unsigned long rpcCountTotal = 0;
unsigned long rpcCountWindowStart = 0, rpcLastLogMs = 0, rpcLastSeenMs = 0;
bool rpcEverSeen = false, rpcWarned = false;
bool rpcWdEnabled = false;                    // permanently disabled auto-restart since v3.10.7
unsigned long rpcWdSec = 60;
unsigned long rpcTestBlockUntil = 0;
inline void rpcMark() {
  rpcCountTotal++;
  if (rpcTestBlockUntil && (long)(millis() - rpcTestBlockUntil) < 0) return;
  rpcTestBlockUntil = 0;
  rpcLastSeenMs = millis(); rpcEverSeen = true;
}

// Global ADC resolution: shared by pressure and pH
const int ADC_BITS = 14;

// libm's log10f etc. call __errno(); the UNO Q minimal libc does not provide it
extern "C" int *__errno(void) {
  static int releaf_dummy_errno = 0;
  return &releaf_dummy_errno;
}

unsigned long pressureSamplesThisSec = 0;   // diagnostics: number of pressure samples actually completed in the last second
unsigned long pressureSkipped = 0;          // diagnostics: number of samples skipped because loop() was blocked (cumulative)

int splitFloats(const String &s, float *out, int maxN) {
  int count = 0;
  int start = 0;
  while (count < maxN) {
    int idx = s.indexOf(',', start);
    String tok = (idx < 0) ? s.substring(start) : s.substring(start, idx);
    tok.trim();
    if (tok.length() == 0) break;
    out[count++] = tok.toFloat();
    if (idx < 0) break;
    start = idx + 1;
  }
  return count;
}

bool kvGet(const String &s, const char *key, float &out) {
  String k = String(key) + "=";
  int start = 0;
  int len = s.length();
  while (start < len) {
    int end = s.indexOf(',', start);
    if (end < 0) end = len;
    String tok = s.substring(start, end);
    tok.trim();
    if (tok.startsWith(k)) {
      String v = tok.substring(k.length());
      v.trim();
      if (v.length() == 0) return false;
      out = v.toFloat();
      return !isnan(out);
    }
    start = end + 1;
  }
  return false;
}

static const char HEXCHARS[] = "0123456789ABCDEF";
// Write v to p as fixed-width `digits` uppercase hex (no trailing \0), return the pointer after the written chars
static char *putHex(char *p, uint32_t v, int digits) {
  for (int i = digits - 1; i >= 0; i--) { p[i] = HEXCHARS[v & 0xF]; v >>= 4; }
  return p + digits;
}

// ===========================================================================
// 1. OD600 photometer - ported from inline photometer v1.2.0 (reads raw values only, algorithms are in Python)
// ===========================================================================
// Fix for "light sensor sometimes disconnects and cannot reconnect without a reboot":
//   When the BH1750 leaves measurement mode due to a momentary supply dip (internal reset) or a bad command from bus noise, it "still responds on I2C",
//   but returns 0 or the same old value forever; v3.10.x only re-initialized on "read failure (-1)", so it stayed stuck on the wrong value,
//   and when the I2C controller itself hangs even re-initialization does not help. Now:
//     1. Re-send Power On + measurement mode before every measurement
//     2. All light readings identical (all 0 or a fixed value) = stuck -> immediately reset the I2C controller (Wire.end/begin) + reconfigure both sensors,
//        retry within the same measurement; still stuck after retry -> reset again before the next measurement
//     3. Too few successful readings -> queue a non-blocking re-initialization; sensors that failed at boot retry automatically every 10 s
//     4. 3 consecutive I2C operations >= 50 ms -> suspend that sensor for 2 s (avoids blocking loop; 100 Hz pressure sampling is unaffected)
//     5. Web UI "re-initialize sensors" button (reinit_sensors)
//   Both sensors use fixed MTreg 69 + continuous high-resolution mode 2 (0.5 lx/count, about 120 ms per reading, read interval 130 ms).
//   Note: v3.10.x used mode 1 (1 lx/count); after switching to this version, re-calibrate the blank.

const uint8_t FIXED_MT   = 69;
const bool    FIXED_H2   = true;
const uint8_t MT_DEFAULT = 69;
const float   RAW_SATURATED = 65535.0f;
const float   LUX_PER_COUNT = 1.0f / (1.2f * (FIXED_MT / (float)MT_DEFAULT) * (FIXED_H2 ? 2.0f : 1.0f));
const unsigned long I2C_READ_TIMEOUT_MS = 3;
const uint16_t SAMPLE_PERIOD_MS = (uint16_t)(130.0f * FIXED_MT / MT_DEFAULT + (FIXED_MT > MT_DEFAULT ? 10 : 0));

class BH1750Simple {
  public:
    explicit BH1750Simple(uint8_t addr) : _addr(addr) {}

    unsigned long slowOps = 0, blockEvents = 0, readFails = 0;
    bool blocked() { return (long)(_skipUntil - millis()) > 0; }
    void noteDuration(unsigned long t0, const char *what) {
      unsigned long dt = millis() - t0;
      if (dt < 50) { _slowRun = 0; return; }
      slowOps++;
      _slowRun++;
      Monitor.print("[od600][warn] I2C 0x"); Monitor.print(String(_addr, HEX));
      Monitor.print(" "); Monitor.print(what); Monitor.print(" took "); Monitor.print(dt); Monitor.println(" ms");
      if (_slowRun >= 3) {
        _slowRun = 0;
        blockEvents++;
        _skipUntil = millis() + 2000UL;
        Monitor.print("[od600][warn] I2C 0x"); Monitor.print(String(_addr, HEX));
        Monitor.println(": 3 slow operations in a row -> skipping this sensor for 2 s");
      }
    }

    bool cmd(uint8_t c) {
      if (blocked()) return false;
      unsigned long t0 = millis();
      Wire.beginTransmission(_addr);
      Wire.write(c);
      bool ok = Wire.endTransmission() == 0;
      noteDuration(t0, "write");
      return ok;
    }
    bool powerOn() { return cmd(0x01); }

    bool configure() {
      bool ok = cmd(0x40 | (FIXED_MT >> 5));
      ok = cmd(0x60 | (FIXED_MT & 0x1F)) && ok;
      ok = cmd(FIXED_H2 ? 0x11 : 0x10) && ok;
      return ok;
    }

    // Raw 16-bit count (0~65535); returns -1 on failure
    float readRaw() {
      if (blocked()) { readFails++; return -1.0f; }
      unsigned long t0 = millis();
      int got = Wire.requestFrom((int)_addr, 2);
      noteDuration(t0, "read");
      if (got != 2) { readFails++; return -1.0f; }
      unsigned long start = millis();
      while (Wire.available() < 2) {
        if (millis() - start > I2C_READ_TIMEOUT_MS) { readFails++; return -1.0f; }
      }
      uint16_t raw = (uint16_t)Wire.read() << 8;
      raw |= Wire.read();
      return (float)raw;
    }

  private:
    uint8_t _addr;
    unsigned long _skipUntil = 0;
    uint8_t _slowRun = 0;
};

struct Channel {
  BH1750Simple dev;
  const char  *name;
  bool         inited;
  bool reconfigure() {
    bool ok = dev.powerOn();
    ok = dev.configure() && ok;
    return ok;
  }
};

const uint8_t LED_PIN     = 3;
const uint8_t SAMPLE_ADDR = 0x5C;
const uint8_t REF_ADDR    = 0x23;

Channel chS = { BH1750Simple(SAMPLE_ADDR), "sample",    false };
Channel chR = { BH1750Simple(REF_ADDR),    "reference", false };

bool ledIsOn = false;
unsigned long ledOffMs = 0;
void ledSet(bool on) {
  if (ledIsOn && !on) ledOffMs = millis();
  ledIsOn = on;
  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

unsigned long settleUntilMs = 0;
void markSettle() { settleUntilMs = millis() + 2UL * SAMPLE_PERIOD_MS; }

const uint8_t  N_SAMPLES      = 16;
const uint8_t  N_DARK_SAMPLES = 4;
const uint16_t LED_WARMUP_MS  = 60;
const uint8_t  WARMUP_DISCARD = 2;
const int      MIN_VALID_LIT  = 8;
const uint8_t  MAX_RETRIES    = 1;

unsigned long measureIntervalMs = 30000UL;
const unsigned long MIN_MEASURE_INTERVAL_MS = 5000UL;
const unsigned long MAX_MEASURE_INTERVAL_MS = 86400000UL;

uint8_t refMode = 0;                    // 0 = dual optical path (reference must also be valid), 1 = single optical path

unsigned long lastMeasMillis = 0;
unsigned long lastMeasStartMs = 0;
unsigned long odMeasSeq = 0;
// No global String (global objects with destructors make the Zephyr core fail to load, see v3.8.3 notes)
char lastRawPayload[720] = "";

bool devModeOn = false;

enum OdState : uint8_t { OD_IDLE = 0, OD_DARK = 1, OD_WARMUP = 2, OD_LIT = 3 };
OdState odState = OD_IDLE;
unsigned long odNextStepMs = 0;
unsigned long odAttemptStartMs = 0;
int      odSampleIdx = 0;
uint8_t  odAttempt = 0;

float odDarkS[8], odDarkR[8];
float odLitS[32], odLitR[32];

enum ReinitStep : uint8_t { RI_IDLE = 0, RI_POWER = 1, RI_CONF = 2, RI_SETTLE = 3 };
ReinitStep riStep = RI_IDLE;
unsigned long riNextMs = 0;
unsigned long riLastAutoMs = 0;
bool riOk = false;
bool riSampleNeeded = false, riRefNeeded = false;
Channel *riTarget = nullptr;
unsigned long reinitCountS = 0, reinitCountR = 0, busResetCount = 0;
bool lastAttemptStuck = false;
bool busResetPending = false;

char i2cStatusS[12] = "?";
char i2cStatusR[12] = "?";

int countValid(const float *a, int n) {
  int c = 0;
  for (int i = 0; i < n; i++) if (a[i] >= 0) c++;
  return c;
}

// Stuck: all successful readings identical, and either 0 or >= 50 counts (a few repeated counts in low light are normal), not saturation
bool isStuck(const float *a, int n) {
  float v = -2.0f;
  int m = 0;
  for (int i = 0; i < n; i++) {
    if (a[i] < 0) continue;
    if (m == 0) v = a[i];
    else if (a[i] != v) return false;
    m++;
  }
  if (m < MIN_VALID_LIT || v >= RAW_SATURATED - 0.5f) return false;
  return v == 0.0f || v >= 50.0f;
}

String fullI2CReset(const char *why) {
  busResetCount++;
  Monitor.print("[od600][warn] I2C controller reset ("); Monitor.print(why); Monitor.println(")");
  Wire.end();
  delay(2);
  Wire.begin();
  bool okS = chS.reconfigure();
  bool okR = chR.reconfigure();
  chS.inited = okS;
  chR.inited = okR;
  reinitCountS++; reinitCountR++;
  markSettle();
  return String("S:") + (okS ? "ok" : "fail") + "|R:" + (okR ? "ok" : "fail");
}

void reinitTick() {
  unsigned long now = millis();
  if (riStep == RI_IDLE) {
    if (odState != OD_IDLE) return;
    if ((!chS.inited || (!chR.inited && refMode == 0)) && now - riLastAutoMs >= 10000UL) {
      riLastAutoMs = now;
      if (!chS.inited) riSampleNeeded = true;
      if (!chR.inited && refMode == 0) riRefNeeded = true;
    }
    if (riSampleNeeded)   { riTarget = &chS; riSampleNeeded = false; }
    else if (riRefNeeded) { riTarget = &chR; riRefNeeded = false; }
    else return;
    riStep = RI_POWER;
    riNextMs = now;
  }
  if ((long)(now - riNextMs) < 0) return;

  if (riStep == RI_POWER) {
    if (riTarget == &chS) reinitCountS++; else reinitCountR++;
    riOk = riTarget->dev.powerOn();
    riStep = RI_CONF;
    riNextMs = now + 10;
  } else if (riStep == RI_CONF) {
    riOk = riTarget->dev.configure() && riOk;
    riStep = RI_SETTLE;
    riNextMs = now + 2UL * SAMPLE_PERIOD_MS;
  } else if (riStep == RI_SETTLE) {
    bool was = riTarget->inited;
    riTarget->inited = riOk;
    if (riOk || was) {
      Monitor.print(riOk ? "[od600] " : "[od600][warn] ");
      Monitor.print(riTarget->name);
      Monitor.println(riOk ? " sensor (re)initialized OK" : " sensor reinit FAILED");
    }
    riStep = RI_IDLE;
    riTarget = nullptr;
    markSettle();
  }
}

bool odStartMeasurement() {
  if (devModeOn || odState != OD_IDLE) return false;
  odAttempt = 0;
  odSampleIdx = 0;
  odState = OD_DARK;
  ledSet(false);
  lastMeasStartMs = millis();
  if (busResetPending) {
    busResetPending = false;
    fullI2CReset("sensor stuck again after reinit");
  } else {
    if (chS.inited) chS.reconfigure();
    if (chR.inited) chR.reconfigure();
    markSettle();
  }
  unsigned long t = millis();
  if ((long)(settleUntilMs - t) > 0) t = settleUntilMs;
  unsigned long darkOk = ledOffMs + 2UL * SAMPLE_PERIOD_MS;
  if ((long)(darkOk - t) > 0) t = darkOk;
  odNextStepMs = t;
  return true;
}

void appendVals(String &s, const float *a, int n) {
  for (int i = 0; i < n; i++) {
    if (i) s += "|";
    s += String((long)lroundf(a[i]));
  }
}

// End of one attempt: check hardware-level validity, push raw, decide whether to retry. Returns true = this measurement is finished.
bool odFinishAttempt() {
  const float *s = odLitS + WARMUP_DISCARD;
  const float *r = odLitR + WARMUP_DISCARD;
  int n = N_SAMPLES - WARMUP_DISCARD;
  bool useRef = (refMode == 0);

  bool stS = isStuck(s, n), stR = isStuck(r, n);
  bool enoughS = countValid(s, n) >= MIN_VALID_LIT;
  bool enoughR = countValid(r, n) >= MIN_VALID_LIT;
  bool hwOk = enoughS && !stS && (!useRef || (enoughR && !stR));
  bool final = hwOk || odAttempt >= MAX_RETRIES;

  if (!enoughS) riSampleNeeded = true;
  if (!enoughR && useRef) riRefNeeded = true;
  bool sS = stS, sR = useRef && stR;
  if (sS || sR) {
    Monitor.print("[od600][warn] sensor stuck (readings frozen):");
    if (sS) Monitor.print(" sample");
    if (sR) Monitor.print(" reference");
    if (final) {
      busResetPending = true;
      Monitor.println(" -> still frozen after I2C reset, reset again before next measurement");
    } else {
      Monitor.println(" -> I2C controller reset, retry now");
    }
  }
  lastAttemptStuck = sS || sR;

  String p;
  p.reserve(700);
  p = String("seq=") + (odMeasSeq + 1) +
      ",att=" + odAttempt +
      ",final=" + (final ? 1 : 0) +
      ",hw_ok=" + (hwOk ? 1 : 0) +
      ",stuck=" + (stS && stR ? "SR" : stS ? "S" : stR ? "R" : "-") +
      ",t0=" + odAttemptStartMs +
      ",per=" + SAMPLE_PERIOD_MS +
      ",mt=" + FIXED_MT + ",h2=" + (FIXED_H2 ? 1 : 0) +
      ",lpc=" + String(LUX_PER_COUNT, 6) +
      ",ref_mode=" + refMode + ",ds=";
  appendVals(p, odDarkS, N_DARK_SAMPLES);
  p += ",dr=";
  appendVals(p, odDarkR, N_DARK_SAMPLES);
  p += ",ls=";
  appendVals(p, odLitS, N_SAMPLES);
  p += ",lr=";
  appendVals(p, odLitR, N_SAMPLES);
  Bridge.notify("on_od_raw", p);

  if (final) {
    strncpy(lastRawPayload, p.c_str(), sizeof(lastRawPayload) - 1);
    lastRawPayload[sizeof(lastRawPayload) - 1] = '\0';
    lastMeasMillis = millis();
    odMeasSeq++;
    Monitor.print("[od600] seq="); Monitor.print(odMeasSeq);
    Monitor.print(" attempts="); Monitor.print(odAttempt + 1);
    Monitor.print(" hw_ok="); Monitor.println(hwOk ? "yes" : "no");
  }
  return final;
}

void odTick() {
  if (devModeOn) return;
  unsigned long now = millis();

  switch (odState) {
    case OD_IDLE:
      if (now - lastMeasStartMs >= measureIntervalMs && riStep == RI_IDLE) odStartMeasurement();
      break;

    case OD_DARK:
      if ((long)(now - odNextStepMs) < 0) break;
      if (odSampleIdx == 0) odAttemptStartMs = now;
      odDarkS[odSampleIdx] = chS.dev.readRaw();
      odDarkR[odSampleIdx] = (refMode == 0 || chR.inited) ? chR.dev.readRaw() : -1.0f;
      odSampleIdx++;
      odNextStepMs = now + SAMPLE_PERIOD_MS;
      if (odSampleIdx >= N_DARK_SAMPLES) {
        ledSet(true);
        odState = OD_WARMUP;
        odNextStepMs = now + LED_WARMUP_MS;
      }
      break;

    case OD_WARMUP:
      if ((long)(now - odNextStepMs) < 0) break;
      odSampleIdx = 0;
      odState = OD_LIT;
      odNextStepMs = now;
      break;

    case OD_LIT:
      if ((long)(now - odNextStepMs) < 0) break;
      odLitS[odSampleIdx] = chS.dev.readRaw();
      odLitR[odSampleIdx] = (refMode == 0 || chR.inited) ? chR.dev.readRaw() : -1.0f;
      odSampleIdx++;
      odNextStepMs = now + SAMPLE_PERIOD_MS;
      if (odSampleIdx >= N_SAMPLES) {
        ledSet(false);
        if (odFinishAttempt()) {
          odState = OD_IDLE;
        } else {
          odAttempt++;
          odSampleIdx = 0;
          odState = OD_DARK;
          if (lastAttemptStuck) {
            fullI2CReset("sensor stuck, before retry");
          } else {
            if (chS.inited) chS.reconfigure();
            if (chR.inited) chR.reconfigure();
            markSettle();
          }
          unsigned long t = now + 2UL * SAMPLE_PERIOD_MS;
          if ((long)(settleUntilMs - t) > 0) t = settleUntilMs;
          odNextStepMs = t;
        }
      }
      break;
  }
}

String trigger_measurement(String arg) {
  rpcMark();
  return odStartMeasurement() ? "queued" : "busy";
}

String get_last_raw(String arg) {
  rpcMark();
  return String(lastRawPayload) + ",age_ms=" + String(millis() - lastMeasMillis) + ",busy=" + (odState != OD_IDLE ? 1 : 0);
}

String set_dev_mode(String arg) {
  rpcMark();
  bool on = (arg.toInt() != 0);
  devModeOn = on;
  if (on) {
    odState = OD_IDLE;
    if (chS.inited) chS.reconfigure();
    if (chR.inited) chR.reconfigure();
    ledSet(true);
  } else {
    ledSet(false);
    lastMeasMillis = millis();
    lastMeasStartMs = millis();
  }
  Monitor.println(on ? "[od600][align] LED forced ON, auto measurement paused"
                     : "[od600][align] LED off, auto measurement resumed");
  return on ? "1" : "0";
}

String get_dev_readings(String arg) {
  rpcMark();
  if (!devModeOn) return "0,-1,-1,-1,-1";
  float rs = chS.dev.readRaw();
  float rr = chR.dev.readRaw();
  float ls = rs < 0 ? -1.0f : rs * LUX_PER_COUNT;
  float lr = rr < 0 ? -1.0f : rr * LUX_PER_COUNT;
  return String("1,") + String(rs, 0) + "," + String(rr, 0) + "," + String(ls, 3) + "," + String(lr, 3);
}

String reinit_sensors(String arg) {
  rpcMark();
  if (odState != OD_IDLE) return "busy";
  String r = fullI2CReset("manual");
  lastAttemptStuck = false;
  return r;
}

String i2cProbe(uint8_t addr, unsigned long &dtMs) {
  unsigned long t0 = millis();
  Wire.beginTransmission(addr);
  uint8_t err = Wire.endTransmission();
  dtMs = millis() - t0;
  if (err == 0) return "ok";
  if (dtMs >= 50) return "timeout";
  if (err == 2 || err == 3) return "nak";
  return String("err") + err;
}

// ===========================================================================
// 2. Flow meter (ZJ-TM02) - counting only, conversion is in Python
// ===========================================================================
// Pushed every 1 s: pulse count in this window, time between first and last pulse (for reciprocal counting), cumulative pulse count.
// Pulses/liter (2580 large-bore, 5160 small-bore) and the choice of gate vs. reciprocal counting are in Python (constants.json -> flow).
const int FLOW_SENSOR_PIN = 2;
const unsigned long FLOW_UPDATE_INTERVAL_MS = 1000;
const unsigned long MIN_PULSE_INTERVAL_US   = 500;   // debounce

volatile unsigned long pulseCounter     = 0;
volatile unsigned long pulseCounterEver = 0;
volatile unsigned long lastPulseMicros  = 0;
volatile unsigned long winFirstPulseUs  = 0;
volatile unsigned long winLastPulseUs   = 0;
unsigned long lastFlowPulses = 0;
unsigned long lastFlowUpdateMs = 0;
unsigned long flowSeq = 0;

void handlePulse() {
  unsigned long now = micros();
  if (now - lastPulseMicros >= MIN_PULSE_INTERVAL_US) {
    if (pulseCounter == 0) winFirstPulseUs = now;
    winLastPulseUs = now;
    pulseCounter++;
    pulseCounterEver++;
    lastPulseMicros = now;
  }
}

void update_flow() {
  noInterrupts();
  unsigned long pulses = pulseCounter;
  unsigned long tFirst = winFirstPulseUs;
  unsigned long tLast  = winLastPulseUs;
  unsigned long total  = pulseCounterEver;
  pulseCounter = 0;
  interrupts();

  unsigned long now = millis();
  unsigned long windowMs = now - lastFlowUpdateMs;
  lastFlowUpdateMs = now;
  lastFlowPulses = pulses;
  pumpStallCheck(pulses);
  unsigned long spanUs = (pulses >= 2) ? (tLast - tFirst) : 0;
  flowSeq++;
  Bridge.notify("on_flow_raw", String(flowSeq) + "," + String(now) + "," + String(windowMs) + "," +
                String(pulses) + "," + String(spanUs) + "," + String(total));
}

// ===========================================================================
// 3. Pressure - 100 Hz scheduled sampling, raw ADC sums pushed to Python in batches
// ===========================================================================
// Each sample = discard the first analogRead after switching channel + "sum" of 16 analogReads (not divided, zero not subtracted),
// the three channels are read in order. Python converts to bar using the constants from get_config(), then does all statistics.
//
// Sampling schedule: next sample time = previous scheduled time + 10 ms (v3 used "current time", so any loop delay slowed everything down).
// If loop() is blocked for more than 50 ms, no catch-up: jump to now and record the skipped count in pressureSkipped (pskip in get_diag).
// Every sample carries its own timestamp (ms relative to batch start), so Python sees the real sampling intervals.

const float VREF          = 3.3f;     // fill in after measuring 3V3; shared by pressure and pH
const float ADC_MAX       = (float)((1UL << ADC_BITS) - 1);
const float DIV_R_TOP_KOHM    = 15.0f;
const float DIV_R_BOTTOM_KOHM = 22.0f;
const float DIVIDER_RATIO = DIV_R_BOTTOM_KOHM / (DIV_R_TOP_KOHM + DIV_R_BOTTOM_KOHM);
const float SENSOR_VMAX   = 5.0f;
const float SENSOR_BARMAX = 10.0f;    // 0-1 MPa = 0-10 bar

const unsigned long PRESSURE_SAMPLE_INTERVAL_MS = 10;   // 100 Hz
const int PRESSURE_OVERSAMPLE_BLOCK = 16;
const int P_BATCH_MAX = 20;                              // at most 20 samples per batch (200 ms)
const unsigned long P_BATCH_MAX_MS = 200;
const unsigned long P_CATCHUP_LIMIT_MS = 50;

const int PA_PIN[3] = { A0, A1, A2 };                    // feed, retentate, permeate
float pOffsetBar[3] = { 0.0f, 0.0f, 0.0f };              // zero offsets for the safety interlock (pushed by Python)

unsigned long pNextSampleMs = 0;
unsigned long pBatchSeq = 0;
unsigned long pBatchT0 = 0;
int  pBatchN = 0;
char pBatchBuf[P_BATCH_MAX * 17 + 1];
char *pBatchPtr = pBatchBuf;

// 1 s moving average (used only for the Lumen in "mean" check)
const int FEED_MEAN_N = 100;
float feedRing[FEED_MEAN_N];
int   feedRingHead = 0, feedRingCount = 0;
float feedRingSum = 0.0f;

inline float sumToBar(uint32_t sum, int ch) {
  float adc = (float)sum / PRESSURE_OVERSAMPLE_BLOCK;
  float vPin = adc / ADC_MAX * VREF;
  return (vPin / DIVIDER_RATIO) / SENSOR_VMAX * SENSOR_BARMAX - pOffsetBar[ch];
}

uint32_t readBlockSum(int pin) {
  (void)analogRead(pin);                 // source impedance about 8.9 kΩ; the first read after switching channel is pulled by the previous channel, discard it
  uint32_t sum = 0;
  for (int i = 0; i < PRESSURE_OVERSAMPLE_BLOCK; i++) sum += (uint32_t)analogRead(pin);
  return sum;
}

void pressureFlushBatch() {
  if (pBatchN == 0) return;
  *pBatchPtr = '\0';
  pBatchSeq++;
  Bridge.notify("on_p_raw", String(pBatchSeq) + "," + String(pBatchT0) + "," + String(pBatchBuf));
  pBatchN = 0;
  pBatchPtr = pBatchBuf;
}

void pressureSampleOnce(unsigned long now) {
  uint32_t s[3];
  for (int c = 0; c < 3; c++) s[c] = readBlockSum(PA_PIN[c]);
  pressureSamplesThisSec++;

  // ---- Safety interlock (every sample) ----
  float f = sumToBar(s[0], 0), r = sumToBar(s[1], 1), p = sumToBar(s[2], 2);
  if (feedRingCount == FEED_MEAN_N) feedRingSum -= feedRing[feedRingHead];
  else feedRingCount++;
  feedRing[feedRingHead] = f;
  feedRingSum += f;
  feedRingHead = (feedRingHead + 1) % FEED_MEAN_N;
  valveInterlockSample((f + r) * 0.5f - p, f, feedRingSum / feedRingCount);
  pressureProtectSample(f, r, p);                           // v4.1.0: max-pressure protection independent of pinch valve state

  // ---- Add to batch ----
  // dt is only 2 hex digits (max 255 ms): flush the batch once it spans 240 ms, and clamp to 255 when writing (no truncation that would go backwards)
  if (pBatchN > 0 && (now - pBatchT0) >= 240) pressureFlushBatch();
  if (pBatchN == 0) pBatchT0 = now;
  uint32_t dt = (uint32_t)min((unsigned long)(now - pBatchT0), 255UL);
  pBatchPtr = putHex(pBatchPtr, dt, 2);
  for (int c = 0; c < 3; c++) pBatchPtr = putHex(pBatchPtr, s[c] & 0xFFFFF, 5);
  pBatchN++;
  if (pBatchN >= P_BATCH_MAX || (now - pBatchT0) >= P_BATCH_MAX_MS - PRESSURE_SAMPLE_INTERVAL_MS) pressureFlushBatch();
}

void pressureTick(unsigned long now) {
  if ((long)(now - pNextSampleMs) < 0) return;
  if (now - pNextSampleMs > P_CATCHUP_LIMIT_MS) {          // loop blocked too long: no catch-up, record how many were skipped
    pressureSkipped += (now - pNextSampleMs) / PRESSURE_SAMPLE_INTERVAL_MS;
    pNextSampleMs = now;
  }
  pressureSampleOnce(now);
  pNextSampleMs += PRESSURE_SAMPLE_INTERVAL_MS;
}

void pressureResetMean() {
  feedRingHead = feedRingCount = 0;
  feedRingSum = 0.0f;
}

String set_pressure_offsets(String arg) {
  rpcMark();
  float v[3];
  if (splitFloats(arg, v, 3) != 3) return "rejected";
  for (int c = 0; c < 3; c++) {
    if (isnan(v[c]) || fabsf(v[c]) > 2.0f) return "rejected";
  }
  for (int c = 0; c < 3; c++) pOffsetBar[c] = v[c];
  pressureResetMean();
  Monitor.print("[pressure] interlock offsets = ");
  Monitor.print(v[0], 5); Monitor.print(","); Monitor.print(v[1], 5); Monitor.print(","); Monitor.println(v[2], 5);
  return String(pOffsetBar[0], 5) + "," + String(pOffsetBar[1], 5) + "," + String(pOffsetBar[2], 5);
}

String get_pressure_offsets(String arg) {
  rpcMark();
  return String(pOffsetBar[0], 5) + "," + String(pOffsetBar[1], 5) + "," + String(pOffsetBar[2], 5);
}

// ===========================================================================
// 4. Peristaltic pump control (L298N) - same as v3.10.x
// ===========================================================================
const int PUMP_ENA_PIN = 9;  // PWM speed control -> L298N ENA (v4.1.1: L298N six pins consecutive D8-D13)
const int PUMP_IN1_PIN = 8;  // direction -> L298N IN1
const int PUMP_IN2_PIN = 10;  // direction -> L298N IN2

// v3.1: pump replaced; the old pump's measured "PWM < 100 only hums, does not turn" dead zone no longer applies, clamping logic removed,
//       full 0-255 range output directly. Measure the new pump's minimum running PWM and avoid it yourself.

int  pumpPwm     = 0;
bool pumpForward = true;

// ---- v3.10.0: kick-start ----
// A stationary motor needs more torque to overcome static friction (measured: PWM 200 needed to start), but once turning PWM 150 sustains it.
// When starting from stop with a target PWM below the kick PWM: drive at kickPwm for kickMs milliseconds, then drop to the target.
// Optional "stall re-kick": PWM is set but no flow pulses for stallSec consecutive seconds -> kick again (at most 3 times);
// no re-kick when the pinch valve is not "open" (flow naturally drops when pinched, and a re-kick would push pressure up).
bool pumpKickEnabled = true;
int  pumpKickPwm     = 255;
unsigned long pumpKickMs = 500;
bool pumpStallRekick = false;
const unsigned long PUMP_STALL_SEC = 3;
const int PUMP_STALL_MAX_KICKS = 3;
bool pumpKicking = false;
unsigned long pumpKickStart = 0;
int  pumpStallSecs = 0;
int  pumpStallKicks = 0;
unsigned long pumpKickCount = 0;

void pumpStartKick() {
  pumpKicking = true;
  pumpKickStart = millis();
  pumpKickCount++;
  analogWrite(PUMP_ENA_PIN, pumpKickPwm);
}

void setPumpSpeed(int pwm) {
  int target = constrain(pwm, 0, 255);
  bool wasStopped = (pumpPwm == 0);
  pumpPwm = target;
  pumpStallSecs = 0;
  if (target == 0) pumpStallKicks = 0;
  if (target > 0 && wasStopped && pumpKickEnabled && target < pumpKickPwm && pumpKickMs > 0) {
    pumpStartKick();                       // kick first; pumpTick() drops back to target when time is up
  } else {
    pumpKicking = false;
    analogWrite(PUMP_ENA_PIN, pumpPwm);
  }
}

// Called every loop(): when the kick time is up, drop back to the target PWM
void pumpTick(unsigned long now) {
  if (pumpKicking && now - pumpKickStart >= pumpKickMs) {
    pumpKicking = false;
    analogWrite(PUMP_ENA_PIN, pumpPwm);
  }
}

// Called once per second by update_flow(): stall re-kick
bool pumpValveOpen();
void pumpStallCheck(unsigned long pulses) {
  if (pumpPwm == 0 || pumpKicking) { pumpStallSecs = 0; return; }
  if (pulses > 0) { pumpStallSecs = 0; pumpStallKicks = 0; return; }
  if (!pumpStallRekick || !pumpKickEnabled || !pumpValveOpen()) { pumpStallSecs = 0; return; }
  if (++pumpStallSecs >= (int)PUMP_STALL_SEC && pumpStallKicks < PUMP_STALL_MAX_KICKS) {
    pumpStallSecs = 0;
    pumpStallKicks++;
    Monitor.print("[pump] no flow, re-kick #"); Monitor.println(pumpStallKicks);
    pumpStartKick();
  }
}

String pumpKickString() {
  return String("en=") + (pumpKickEnabled ? "1" : "0") + ",pwm=" + String(pumpKickPwm) +
         ",ms=" + String(pumpKickMs) + ",stall=" + (pumpStallRekick ? "1" : "0") +
         ",kicking=" + (pumpKicking ? "1" : "0") + ",stall_kicks=" + String(pumpStallKicks) +
         ",kicks=" + String(pumpKickCount);
}
String get_pump_kick(String arg) { return pumpKickString(); }
// arg: "en=1,pwm=255,ms=500,stall=0" (any subset may be given)
String set_pump_kick(String arg) {
  float v;
  if (kvGet(arg, "pwm", v)) { if (v < 1 || v > 255) return "rejected:pwm 1-255"; }
  if (kvGet(arg, "ms", v))  { if (v < 0 || v > 5000) return "rejected:ms 0-5000"; }
  if (kvGet(arg, "en", v))    pumpKickEnabled = (v != 0);
  if (kvGet(arg, "pwm", v))   pumpKickPwm = (int)v;
  if (kvGet(arg, "ms", v))    pumpKickMs = (unsigned long)v;
  if (kvGet(arg, "stall", v)) pumpStallRekick = (v != 0);
  Monitor.print("[pump] kick "); Monitor.println(pumpKickString());
  return pumpKickString();
}

void setPumpDirection(bool forward) {
  pumpForward = forward;
  digitalWrite(PUMP_IN1_PIN, forward ? HIGH : LOW);
  digitalWrite(PUMP_IN2_PIN, forward ? LOW : HIGH);
}

bool pTripLatched = false;               // v4.1.0: pressure protection latch (defined below in "4-1")
String set_pump_pwm(String arg) {
  if (pTripLatched && arg.toInt() > 0) return "rejected:pressure trip latched, clear first";
  setPumpSpeed(arg.toInt());
  Monitor.print("[pump] set pwm="); Monitor.println(pumpPwm);
  return String(pumpPwm);
}

// For safety, Python should call stop_pump() before changing direction; this function does not zero the speed by itself.
String set_pump_direction(String arg) {
  bool forward = (arg.toInt() != 0);
  setPumpDirection(forward);
  Monitor.print("[pump] set direction forward="); Monitor.println(forward ? "1" : "0");
  return forward ? "1" : "0";
}

String stop_pump(String arg) {
  setPumpSpeed(0);
  basePumpStop("emergency stop");       // v4.1.0: emergency stop also stops the base pump
  feedRunStop("emergency stop");        // v4.2.0: and the feed pump
  chbPinTestCancel();                   // v4.2.1
  // v3: emergency stop also releases the pinch valve (only queues a request, actual servo I/O happens in loop()). Does not latch FAULT.
  valveRequestOpen("pump emergency stop", false);
  Monitor.println("[pump] stop");
  return "0";
}

String get_pump_status(String arg) {
  return String(pumpPwm) + "," + (pumpForward ? "1" : "0");
}

// ===========================================================================
// 4-1. Pressure protection (v4.1.0) - independent of pinch valve state
// ===========================================================================
// The v4.0.0 interlock only checked while the pinch valve was "pinched"; with the valve open, a kinked tube, clogged fibers or a mistakenly clamped outlet can make pressure keep rising
// while the pump keeps running. This layer checks the maximum of the three channels on every 10 ms sample:
//   max(Feed, Retentate, Permeate) > pProtectLimitBar (default 0.7 bar) for P_PROTECT_TRIP_SAMPLES consecutive samples
//   -> main pump PWM 0, base pump stopped, pinch valve released (latch FAULT), latch PTRIP
// While latched, set_pump_pwm(>0) is always rejected; pressure_trip_clear only clears once pressure is back below the limit.
// Zero offsets are shared with the pinch valve interlock via pOffsetBar (pushed by Python after zeroing).
const int P_PROTECT_TRIP_SAMPLES = 5;      // 5 x 10 ms = 50 ms, single-point spikes do not trip
float pProtectLimitBar = 0.70f;
int   pProtectHits = 0;
float pLastMaxBar = 0.0f;                  // three-channel max of the latest sample (checked when clearing)
char  pTripMsg[64] = "";
unsigned long pTripCount = 0;

void pressureProtectSample(float f, float r, float p) {
  float mx = f > r ? f : r;
  if (p > mx) mx = p;
  pLastMaxBar = mx;
  if (mx <= pProtectLimitBar) { pProtectHits = 0; return; }
  if (++pProtectHits < P_PROTECT_TRIP_SAMPLES) return;
  pProtectHits = 0;
  if (pTripLatched) { if (pumpPwm != 0) setPumpSpeed(0); return; }   // already latched: make sure the pump stays stopped
  pTripLatched = true;
  pTripCount++;
  const char *ch = (mx == f) ? "Feed" : ((mx == r) ? "Retentate" : "Permeate");
  String m = String(ch) + " " + String(mx, 3) + " bar > " + String(pProtectLimitBar, 2);   // no %f (the minimal libc may not support it)
  strncpy(pTripMsg, m.c_str(), sizeof(pTripMsg) - 1);
  pTripMsg[sizeof(pTripMsg) - 1] = '\0';
  setPumpSpeed(0);
  basePumpStop("pressure trip");
  feedRunStop("pressure trip");
  chbPinTestCancel();                   // v4.2.1
  valveRequestOpen(pTripMsg, true);
  Monitor.print("[safety] !! pressure protection: "); Monitor.print(pTripMsg); Monitor.println(" -> main pump stopped + pinch valve released");
  Bridge.notify("on_safety", String("ptrip=1,msg=") + pTripMsg);
}

String pressureProtectString() {
  return String("limit=") + String(pProtectLimitBar, 3) + ",trip=" + (pTripLatched ? "1" : "0") +
         ",count=" + String(pTripCount) + ",pmax=" + String(pLastMaxBar, 4) + ",msg=" + pTripMsg;
}
String get_pressure_protect(String arg) { return pressureProtectString(); }
String set_pressure_protect(String arg) {
  float v;
  if (kvGet(arg, "limit", v)) {
    if (!(v >= 0.1f && v <= 5.0f)) return "rejected:limit 0.1-5.0 bar";
    pProtectLimitBar = v;
  }
  pProtectHits = 0;
  Monitor.print("[safety] "); Monitor.println(pressureProtectString());
  return pressureProtectString();
}
String pressure_trip_clear(String arg) {
  if (pLastMaxBar > pProtectLimitBar) return "rejected:pressure still above limit";
  pTripLatched = false;
  pTripMsg[0] = '\0';
  pProtectHits = 0;
  Monitor.println("[safety] pressure protection cleared");
  return pressureProtectString();
}

// ===========================================================================
// 4-2. Channel B: feed pump (v4.2.0) + base dosing pulses (v4.1.0) - L298N channel B, diaphragm pump
// ===========================================================================
// Python's pH control decides "whether to dose and for how long"; the MCU only makes sure a pulse is fully executed and enforces the safety conditions:
//   1. Pulse accepted only if the feed valve is online, its target is "base", position error <= AV_POS_TOL and it is not moving
//   2. During a pulse, feed valve leaves "base" or goes offline, or pressure protection trips / emergency stop -> stop immediately
//   3. 100-10000 ms per pulse; the MCU switches off by itself when time is up (stops even if Linux hangs)
//   4. Hourly cumulative on-time limit baseMaxOnMsH (default 60 s), blocks runaway continuous base dosing from the Linux side
const int BASE_ENB_PIN = 11;     // PWM -> L298N ENB (remove the ENB jumper cap, 10 kΩ pull-down)
const int BASE_IN3_PIN = 12;
const int BASE_IN4_PIN = 13;
const unsigned long BASE_PULSE_MIN_MS = 100;
const unsigned long BASE_PULSE_HARD_MAX_MS = 10000;
const unsigned long BASE_HOUR_MS = 3600000UL;

int  basePwm = 255;
unsigned long baseMaxOnMsH = 60000UL;
bool baseOn = false;
unsigned long baseOnStart = 0, baseOnDur = 0;
unsigned long baseHourStart = 0, baseOnMsHour = 0;
unsigned long basePulseCount = 0;
char baseWhy[32] = "";

bool avFeedAtBase(bool strict);           // defined in "8-2"
bool avFeedClosed();                      // defined in "8-2"

// v4.2.0: continuous run (feed pump). Only one of "continuous run" / "base pulse" is active at a time.
int  feedRunPwm = 0;                      // 0 = not running
const bool feedRunFwd = false;            // v4.2.2: single direction (IN4)

// v4.2.1: IN levels are remembered and re-asserted, so a pin taken back by a timer / peripheral recovers within 200 ms
int  chbIn3 = LOW, chbIn4 = LOW;
unsigned long chbTestUntil = 0;           // pin test active until this millis() (0 = off)
unsigned long chbLastAssert = 0;

void chbAssertIn() {
  pinMode(BASE_IN3_PIN, OUTPUT); digitalWrite(BASE_IN3_PIN, chbIn3);
  pinMode(BASE_IN4_PIN, OUTPUT); digitalWrite(BASE_IN4_PIN, chbIn4);
}

// v4.2.2: single direction. IN3 (D12) does not go high on the board, so IN3 stays low and IN4 (D13) drives the pump.
void chBOutput(int pwm, bool fwd) {
  (void)fwd;
  bool a = false, b = (pwm > 0);
  if (pwm == 0) { chbIn3 = LOW; chbIn4 = LOW; chbAssertIn(); }    // stopping: IN low first
  analogWrite(BASE_ENB_PIN, pwm > 0 ? pwm : 0);
  chbIn3 = a ? HIGH : LOW; chbIn4 = b ? HIGH : LOW;
  chbAssertIn();                                                   // IN pins written last
}

void chbPinTestCancel() { if (chbTestUntil) { chbTestUntil = 0; chBOutput(0, true); Monitor.println("[feed] pin test end"); } }

void baseOutput(bool on) { chBOutput(on ? basePwm : 0, true); }

void feedRunStop(const char *why) {
  if (feedRunPwm == 0) return;
  feedRunPwm = 0;
  chBOutput(0, true);
  Monitor.print("[feed] stop ("); Monitor.print(why); Monitor.println(")");
}

void baseSetWhy(const char *w) { strncpy(baseWhy, w, sizeof(baseWhy) - 1); baseWhy[sizeof(baseWhy) - 1] = '\0'; }

void basePumpStop(const char *why) {
  if (!baseOn) return;
  baseOutput(false);
  baseOn = false;
  unsigned long ran = millis() - baseOnStart;
  baseOnMsHour += ran;
  baseSetWhy(why);
  Monitor.print("[base] stop ("); Monitor.print(why); Monitor.print(") after "); Monitor.print(ran); Monitor.println(" ms");
}

void basePumpTick(unsigned long now) {
  if (now - baseHourStart >= BASE_HOUR_MS) { baseHourStart = now; if (!baseOn) baseOnMsHour = 0; }
  if (!baseOn) return;
  if (now - baseOnStart >= baseOnDur) { basePumpStop("done"); return; }
  if (pTripLatched) { basePumpStop("pressure trip"); return; }
  if (!avFeedAtBase(false)) basePumpStop("feed valve left base");
}

void feedRunTick() {
  unsigned long now = millis();
  if (now - chbLastAssert >= 200) { chbLastAssert = now; chbAssertIn(); }
  if (chbTestUntil && (long)(now - chbTestUntil) >= 0) chbPinTestCancel();
  if (feedRunPwm == 0) return;
  if (pTripLatched) { feedRunStop("pressure trip"); return; }
  if (avFeedClosed()) feedRunStop("feed valve closed");
}

String baseStatusString() {
  unsigned long now = millis();
  unsigned long left = baseOn ? (baseOnDur - min(baseOnDur, now - baseOnStart)) : 0;
  unsigned long hourMs = baseOnMsHour + (baseOn ? (now - baseOnStart) : 0);
  return String("bon=") + (baseOn ? "1" : "0") + ",bpwm=" + String(basePwm) + ",bleft=" + String(left) +
         ",bhour=" + String(hourMs) + ",bmaxh=" + String(baseMaxOnMsH) + ",bcnt=" + String(basePulseCount) +
         ",bwhy=" + baseWhy + ",fpwm=" + String(feedRunPwm) + ",fdir=" + (feedRunFwd ? "1" : "0") +
         ",ptest=" + (chbTestUntil ? "1" : "0") +
         ",rb=" + (digitalRead(BASE_IN3_PIN) ? "1" : "0") + (digitalRead(BASE_IN4_PIN) ? "1" : "0");
}

String base_pump_pulse(String arg) {
  long ms = arg.toInt();
  if (ms < (long)BASE_PULSE_MIN_MS || ms > (long)BASE_PULSE_HARD_MAX_MS) return "rejected:ms 100-10000";
  if (pTripLatched) return "rejected:pressure trip latched";
  if (baseOn) return "rejected:already running";
  if (feedRunPwm > 0) return "rejected:feed pump running";
  if (chbTestUntil) return "rejected:pin test running";
  if (!avFeedAtBase(true)) return "rejected:feed valve not confirmed at base position";
  if (baseOnMsHour + (unsigned long)ms > baseMaxOnMsH) return "rejected:hourly base limit reached";
  baseOnStart = millis();
  baseOnDur = (unsigned long)ms;
  baseOn = true;
  basePulseCount++;
  baseSetWhy("running");
  baseOutput(true);
  Monitor.print("[base] pulse "); Monitor.print(ms); Monitor.println(" ms");
  return String("ok,ms=") + String(ms) + "," + baseStatusString();
}
String base_pump_stop(String arg) { basePumpStop("manual stop"); return baseStatusString(); }
String get_base_status(String arg) { return baseStatusString(); }
String set_base_config(String arg) {
  float v;
  if (kvGet(arg, "pwm", v))   { if (v < 1 || v > 255) return "rejected:pwm 1-255"; }
  if (kvGet(arg, "max_s_h", v)) { if (v < 0 || v > 600) return "rejected:max_s_h 0-600"; }
  if (kvGet(arg, "pwm", v))   basePwm = (int)v;
  if (kvGet(arg, "max_s_h", v)) baseMaxOnMsH = (unsigned long)(v * 1000.0f);
  if (baseOn) analogWrite(BASE_ENB_PIN, basePwm);
  return baseStatusString();
}

// v4.2.1: wiring check. Holds plain levels (no direction logic, no inversion) for up to 30 s, then switches off.
String chb_pin_test(String arg) {
  float v;
  if (pTripLatched) return "rejected:pressure trip latched";
  if (baseOn || feedRunPwm > 0) return "rejected:channel B running";
  int a = kvGet(arg, "in3", v) ? (v != 0) : 0, b = kvGet(arg, "in4", v) ? (v != 0) : 0, e = kvGet(arg, "enb", v) ? (v != 0) : 0;
  long ms = kvGet(arg, "ms", v) ? (long)v : 10000;
  if (ms < 0 || ms > 30000) return "rejected:ms 0-30000";
  if (a && b && e) return "rejected:in3 and in4 both high with enb (brake)";
  if (e && (a || b) && avFeedClosed()) return "rejected:feed valve is fully closed";
  analogWrite(BASE_ENB_PIN, e ? 255 : 0);
  chbIn3 = a ? HIGH : LOW; chbIn4 = b ? HIGH : LOW;
  chbAssertIn();
  chbTestUntil = (a || b || e) && ms > 0 ? millis() + (unsigned long)ms : 0;
  Monitor.print("[feed] pin test D12(IN3)="); Monitor.print(a); Monitor.print(" D13(IN4)="); Monitor.print(b);
  Monitor.print(" D11(ENB)="); Monitor.print(e); Monitor.print(" for "); Monitor.print(ms); Monitor.print(" ms, read back ");
  Monitor.print(digitalRead(BASE_IN3_PIN)); Monitor.println(digitalRead(BASE_IN4_PIN));
  return baseStatusString();
}

// arg "pwm=..". v4.2.2: single direction (IN4); a "dir" key is accepted and ignored.
String set_feed_pump(String arg) {
  float v;
  int pwm = feedRunPwm;
  if (kvGet(arg, "pwm", v)) { if (v < 0 || v > 255) return "rejected:pwm 0-255"; pwm = (int)v; }
  if (pwm == 0) {
    feedRunStop("manual stop");
    return baseStatusString();
  }
  if (pTripLatched) return "rejected:pressure trip latched";
  if (baseOn) return "rejected:base dosing pulse running";
  chbPinTestCancel();                   // v4.2.1: running the pump ends a pin test
  if (avFeedClosed()) return "rejected:feed valve is fully closed";
  feedRunPwm = pwm;
  chBOutput(feedRunPwm, feedRunFwd);
  Monitor.print("[feed] run pwm="); Monitor.print(feedRunPwm); Monitor.println(" (IN4)");
  return baseStatusString();
}

// ===========================================================================
// 5. Diagnostics and configuration
// ===========================================================================
unsigned long loopMaxUs = 0, loopMaxUsLastSec = 0;
unsigned long pressureSamplesLastSec = 0;
unsigned long lastDiagMs = 0, lastRoutineLogMs = 0;
const char * volatile bootStage = "bridge";

String get_diag(String arg) {
  rpcMark();
  // The first 9 fields are in the same positions as v3.10.x (old Python parsing still works), followed by key=value
  return String(loopMaxUsLastSec) + "," +
         String(pressureSamplesLastSec) + "," +
         String((int)odState) + "," +
         String((int)riStep) + "," +
         String(millis()) + "," +
         FW_VERSION + "," + (rpcWdEnabled ? "1" : "0") + "," + String(rpcWdSec) + "," + String(rpcCountTotal) + "," +
         "i2c=S:" + i2cStatusS + "|R:" + i2cStatusR + "," +
         "rc=S:" + reinitCountS + "|R:" + reinitCountR + "|B:" + busResetCount + "," +
         "io=S:" + chS.dev.slowOps + "/" + chS.dev.blockEvents + "/" + chS.dev.readFails +
         "|R:" + chR.dev.slowOps + "/" + chR.dev.blockEvents + "/" + chR.dev.readFails + "," +
         "pskip=" + pressureSkipped + ",pbatch=" + pBatchSeq + ",stage=" + String((const char *)bootStage);
}

String get_config(String arg) {
  rpcMark();
  return String("adc_bits=") + ADC_BITS +
         ",vref=" + String(VREF, 4) +
         ",div=" + String(DIVIDER_RATIO, 6) +
         ",vmax=" + String(SENSOR_VMAX, 3) +
         ",barmax=" + String(SENSOR_BARMAX, 3) +
         ",ovs=" + PRESSURE_OVERSAMPLE_BLOCK +
         ",p_period_ms=" + PRESSURE_SAMPLE_INTERVAL_MS +
         ",od_interval_s=" + String(measureIntervalMs / 1000.0f, 2) +
         ",ref_mode=" + (int)refMode +
         ",mt=" + FIXED_MT + ",h2=" + (FIXED_H2 ? 1 : 0) +
         ",period_ms=" + SAMPLE_PERIOD_MS +
         ",lpc=" + String(LUX_PER_COUNT, 6) +
         ",ph_ovs=256,fw=" + FW_VERSION;
}

String set_config(String arg) {
  rpcMark();
  float v;
  float interval = -1; int rm = -1;
  if (kvGet(arg, "od_interval_s", v)) {
    if (v < MIN_MEASURE_INTERVAL_MS / 1000.0f || v > MAX_MEASURE_INTERVAL_MS / 1000.0f) return "rejected:od_interval_s 5-86400";
    interval = v;
  }
  if (kvGet(arg, "ref_mode", v)) {
    if (v != 0 && v != 1) return "rejected:ref_mode 0|1";
    rm = (int)v;
  }
  if (interval > 0) measureIntervalMs = (unsigned long)(interval * 1000.0f);
  if (rm >= 0) refMode = (uint8_t)rm;
  Monitor.print("[cfg] "); Monitor.println(arg);
  return get_config("");
}

void diagTick(unsigned long now) {
  if (now - lastDiagMs < 1000) return;
  lastDiagMs = now;
  loopMaxUsLastSec = loopMaxUs;
  loopMaxUs = 0;
  pressureSamplesLastSec = pressureSamplesThisSec;
  pressureSamplesThisSec = 0;

  if (now - rpcLastLogMs >= 30000) {
    rpcLastLogMs = now;
    unsigned long n = rpcCountTotal - rpcCountWindowStart;
    rpcCountWindowStart = rpcCountTotal;
    if (rpcEverSeen && n == 0 && !rpcWarned) {
      rpcWarned = true;
      Monitor.println("[rpc] !! no Python calls for 30 s: Linux->MCU command channel may be down (MCU still running, data still pushed)");
    } else if (n > 0 && rpcWarned) {
      rpcWarned = false;
      Monitor.println("[rpc] Python calls resumed");
    }
  }
  if (now - lastRoutineLogMs >= ROUTINE_LOG_MS) {
    lastRoutineLogMs = now;
    Monitor.print("[diag] loop_max_us="); Monitor.print(loopMaxUsLastSec);
    Monitor.print(" p_samples/s="); Monitor.print(pressureSamplesLastSec);
    Monitor.print(" pskip="); Monitor.print(pressureSkipped);
    Monitor.print(" pbatch="); Monitor.print(pBatchSeq);
    Monitor.print(" flow_pulses="); Monitor.print(lastFlowPulses);
    Monitor.print(" od_state="); Monitor.print((int)odState);
    Monitor.print(" rpc_calls="); Monitor.println(rpcCountTotal);
  }
}

// DS18B20 raw value (driver is in the next section, declared here first)
int16_t dsRaw16Last = 0;
unsigned long dsLastReadMs = 0;

// ===========================================================================
// 6. pH and DS18B20 - sampling only, conversion done in Python
// ===========================================================================
const int PH_PIN = A4;                 // pH probe (DFRobot SEN0169-V2)
#if PH_USE_DS18B20
const int PH_DS18B20_PIN = 4;          // v4.1.1: moved from D8 to D4 (D8-D13 given to the L298N as a contiguous block)

// ---- Built-in 1-Wire driver (v3.8.1) ----
// Does not use the OneWire / DallasTemperature libraries: App Lab does not always auto-install the libraries listed in sketch.yaml
// (you get OneWire.h: No such file or directory). The timing here matches the OneWire library on non-AVR platforms in
// its "fallback mode" (also pinMode/digitalWrite/digitalRead); only one DS18B20 is attached, using Skip ROM.
// Open-drain approach: output LOW = pull the bus low; switch to INPUT = release, pulled back up to 3.3V by the 4.7kOhm resistor.
// v3.9.0: 1-Wire now uses direct Zephyr GPIO access (open-drain mode, configured only once).
// Found on hardware: Arduino's pinMode() on Zephyr reconfigures the pin every time (gpio_pin_configure), taking tens of us per call,
// while a 1-Wire write-1 low time must be < 15 us and reads must sample within 15 us - switching with pinMode simply cannot keep up.
// The result: presence was occasionally detected (first "responding"), then every later command was garbled ("no response"), and loop was dragged past 20 ms.
// Now: at boot D4 is configured once as "open-drain output + input"; pull low = clear bit, release = set bit (pulled up to 3.3 V by 4.7 kOhm),
// read = read the port input register. Each operation takes about 1 us or less. Falls back to the old pinMode approach only if configuration fails.
#define DS_IRQ_LOCK 1          // In fast mode, interrupts are disabled during each bit time slot (< 70 us) so it cannot be interrupted and misread
static const struct device *owDev = nullptr;
static uint32_t owMask = 0;
static uint8_t owPinIdx = 0;
static bool owFast = false;
static bool owInited = false;

// v3.10.3: 1-Wire microsecond delays now use a "calibrated busy loop".
// Observed on hardware: the first reset gets a presence (sensor found), but every read afterwards fails. Reset timing is tolerant (480/70 us),
// but bit time slots need < 15 us precision; if Zephyr's system timer is the low-speed LPTIM (32.768 kHz, 30.5 us per tick),
// delayMicroseconds()=k_busy_wait() can be off by tens of us at single-digit us, so write-1 becomes write-0 and the read sample point is missed -> CRC error.
// Busy-loop speed depends only on the CPU clock: at boot, measure 50 ms with millis() to get "loops per us", then use it for all bit time slots.
#if defined(__arm__) || defined(__ARM_ARCH)
#define OW_CAN_SPIN 1
#else
#define OW_CAN_SPIN 0          // for simulation tests on a PC
#endif
char dsLastErr[48] = "none";
uint8_t  owTiming = OW_CAN_SPIN ? 0 : 1;   // 0 = calibrated busy loop, 1 = delayMicroseconds(k_busy_wait)
uint32_t owLoopsPerUs = 0;      // for display
uint32_t owLoopsPerMs = 0;      // actually used (higher precision)
float    owBusy6Us = -1, owSpin6Us = -1;    // measured: actual duration of delayMicroseconds(6) / busy-loop 6 us
static void __attribute__((noinline)) owSpin(uint32_t n) { for (volatile uint32_t i = 0; i < n; i++) { } }
static inline void owDelay(uint32_t us) {
  if (owTiming == 0 && owLoopsPerMs) owSpin((us * owLoopsPerMs + 500) / 1000);
  else delayMicroseconds(us);
}
static float owMeasureUs(bool spin, uint32_t us, uint32_t reps) {
  uint32_t t = millis(); while (millis() == t) { }
  uint32_t t0 = millis();
  for (uint32_t i = 0; i < reps; i++) { if (spin) owSpin((us * owLoopsPerMs + 500) / 1000); else delayMicroseconds(us); }
  return (float)(millis() - t0) * 1000.0f / (float)reps;
}
void owCalibrate() {
#if OW_CAN_SPIN
  uint32_t t = millis(); while (millis() == t) { }
  uint32_t t0 = millis(), loops = 0;
  while (millis() - t0 < 50) { owSpin(200); loops += 200; }
  owLoopsPerMs = loops / 50UL;
  if (owLoopsPerMs < 1000) owLoopsPerMs = 1000;
  owLoopsPerUs = owLoopsPerMs / 1000;
  owBusy6Us = owMeasureUs(false, 6, 2000);
  owSpin6Us = owMeasureUs(true, 6, 2000);
#endif
  Monitor.print("[ds18b20] timing calibration: spin loop "); Monitor.print((int)owLoopsPerUs);
  Monitor.print(" loops/µs, delayMicroseconds(6) measured "); Monitor.print(owBusy6Us, 1);
  Monitor.print(" µs, spin loop 6 µs measured "); Monitor.print(owSpin6Us, 1);
  Monitor.print(" µs, using "); Monitor.println(owTiming == 0 ? "spin loop" : "delayMicroseconds");
}

// v3.10.1: open-drain also enables the internal pull-up (about 40 kOhm) as a backup; the external 4.7 kOhm is still required (internal pull-up is too weak, long wires fail).
bool owIntPullup = true;
int  owConfigure(bool pullup) {
  gpio_flags_t f = GPIO_OUTPUT_HIGH | GPIO_INPUT | GPIO_OPEN_DRAIN | (pullup ? GPIO_PULL_UP : 0);
  int r = gpio_pin_configure(owDev, owPinIdx, f);
  if (r != 0) r = gpio_pin_configure(owDev, owPinIdx, GPIO_OUTPUT_HIGH | GPIO_OPEN_DRAIN | (pullup ? GPIO_PULL_UP : 0));
  return r;
}

void owInit() {
  owInited = true;
  owDev = digitalPinToPortDevice(PH_DS18B20_PIN);
  int idx = digitalPinToPinIndex(PH_DS18B20_PIN);
  if (owDev != nullptr && idx >= 0) {
    owPinIdx = (uint8_t)idx;
    owMask = (1UL << idx);
    int r = owConfigure(owIntPullup);
    if (r != 0 && owIntPullup) { owIntPullup = false; r = owConfigure(false); }
    owFast = (r == 0);
  }
  Monitor.print("[ds18b20] D4 1-Wire mode: ");
  Monitor.print(owFast ? "Zephyr GPIO open-drain (fast)" : "pinMode switching (compat mode, timing may be too slow)");
  Monitor.println(owFast && owIntPullup ? " + internal pull-up" : "");
  owCalibrate();
}

static inline void owLock()   { if (DS_IRQ_LOCK && owFast) noInterrupts(); }
static inline void owUnlock() { if (DS_IRQ_LOCK && owFast) interrupts(); }
static inline void owLow() {
  if (owFast) gpio_port_clear_bits_raw(owDev, owMask);
  else { pinMode(PH_DS18B20_PIN, OUTPUT); digitalWrite(PH_DS18B20_PIN, LOW); }
}
static inline void owRelease() {
  if (owFast) gpio_port_set_bits_raw(owDev, owMask);
  else pinMode(PH_DS18B20_PIN, INPUT);
}
static inline uint8_t owSample() {
  if (owFast) {
    gpio_port_value_t v = 0;
    gpio_port_get_raw(owDev, &v);
    return (v & owMask) ? 1 : 0;
  }
  return digitalRead(PH_DS18B20_PIN) ? 1 : 0;
}

// Returns true = a device answered with a presence pulse
// owLastFail: 0 = success, 1 = bus still low after release (pull-up resistor not connected / DQ shorted to GND / miswired), 2 = no presence pulse
uint8_t owLastFail = 0;
bool owReset() {
  if (!owInited) owInit();
  owRelease();
  // The bus must be high first (pull-up OK); wait up to 250us
  int retries = 125;
  while (!owSample()) { if (--retries == 0) { owLastFail = 1; return false; } delayMicroseconds(2); }
  owLow();
  delayMicroseconds(480);                 // reset low time only needs to be >= 480us; being stretched by interrupts is fine
  owLock();
  owRelease();
  owDelay(70);
  bool present = !owSample();
  owUnlock();
  delayMicroseconds(410);
  owLastFail = present ? 0 : 2;
  return present;
}

// v3.10.1: 1-Wire diagnostics (printed automatically the first time nothing is found at boot; Bridge "ds_diag" can call it anytime)
//   ext = level 1 ms after disabling the internal pull-up and releasing (1 = external pull-up works)
//   int = level with the internal pull-up enabled (ext=0 but int=1 -> external 4.7 kOhm not connected; both 0 -> something pulls the line to GND)
//   drive = level read while pulling low (should be 0; reading 1 means the pin does not control this line)
//   pres = presence pulse start time / length after reset (us, normally about 15-60 / 60-240; -1 = none)
String owDiagString() {
  if (!owInited) owInit();
  String s = String("pin=D4 port=") + (owDev ? owDev->name : "?") + " idx=" + String(owPinIdx) +
             " mode=" + (owFast ? "fast" : "compat");
  int ext = -1, inr = -1, drv = -1;
  if (owFast) {
    owConfigure(false); owRelease(); delay(1); ext = owSample();
    owConfigure(true);  owRelease(); delay(1); inr = owSample();
    owConfigure(owIntPullup);
  } else {
    pinMode(PH_DS18B20_PIN, INPUT); delay(1); ext = digitalRead(PH_DS18B20_PIN) ? 1 : 0;
    pinMode(PH_DS18B20_PIN, INPUT_PULLUP); delay(1); inr = digitalRead(PH_DS18B20_PIN) ? 1 : 0;
    pinMode(PH_DS18B20_PIN, INPUT);
  }
  owLow(); delayMicroseconds(5); drv = owSample(); owRelease(); delay(1);
  // presence pulse waveform
  int presStart = -1, presLen = -1;
  if (owSample()) {
    owLow(); delayMicroseconds(480);
    owLock();
    owRelease();
    unsigned long t0 = micros();
    unsigned long tEnd = t0 + 400;
    bool wasLow = false; unsigned long tl = 0;
    while ((long)(micros() - tEnd) < 0) {
      uint8_t v = owSample();
      if (!v && !wasLow) { wasLow = true; tl = micros(); presStart = (int)(tl - t0); }
      if (v && wasLow) { presLen = (int)(micros() - tl); break; }
    }
    owUnlock();
    if (wasLow && presLen < 0) presLen = 999;   // never returned to high
    delay(1);
  }
  s += " ext=" + String(ext) + " int=" + String(inr) + " drive=" + String(drv) +
       " pres_start_us=" + String(presStart) + " pres_len_us=" + String(presLen) +
       " intpull=" + String(owIntPullup ? 1 : 0) +
       " timing=" + (owTiming == 0 ? "spin" : "busy") + " loops_us=" + String((int)owLoopsPerUs) +
       " busy6_us=" + String(owBusy6Us, 1) + " spin6_us=" + String(owSpin6Us, 1) +
       " last_err=" + String(dsLastErr);
  const char *hint;
  if (drv == 1)                 hint = "pin cannot be pulled low: wrong pin mapping or D4 used by another function";
  else if (ext == 0 && inr == 0) hint = "line pulled to GND: check DQ not shorted to GND, sensor VDD/GND not reversed (gets hot)";
  else if (ext == 0)            hint = "external 4.7k pull-up not working: check 4.7k is between D4 (DQ) and 3.3V";
  else if (presStart < 0)       hint = "pull-up OK but no sensor response: check DQ is on D4, VDD on 3.3V, common GND";
  else if (presLen == 999)      hint = "line stays low after presence: sensor fault or DQ shorted";
  else                          hint = "1-Wire electrically OK";
  s += String(" => ") + hint;
  return s;
}

void owWriteBit(uint8_t v) {
  owLock();
  owLow();
  if (v & 1) { owDelay(6); owRelease(); owUnlock(); owDelay(64); }
  else       { owDelay(60); owRelease(); owUnlock(); owDelay(10); }
}

uint8_t owReadBit() {
  owLock();
  owLow();
  owDelay(2);
  owRelease();
  owDelay(10);
  uint8_t r = owSample();
  owUnlock();
  owDelay(55);
  return r;
}

void owWriteByte(uint8_t b) { for (uint8_t i = 0; i < 8; i++) owWriteBit((b >> i) & 1); }
uint8_t owReadByte() { uint8_t r = 0; for (uint8_t i = 0; i < 8; i++) if (owReadBit()) r |= (1 << i); return r; }

uint8_t owCrc8(const uint8_t *d, uint8_t n) {     // Dallas/Maxim CRC8 (x^8+x^5+x^4+1)
  uint8_t crc = 0;
  while (n--) {
    uint8_t in = *d++;
    for (uint8_t i = 0; i < 8; i++) {
      uint8_t mix = (crc ^ in) & 0x01;
      crc >>= 1;
      if (mix) crc ^= 0x8C;
      in >>= 1;
    }
  }
  return crc;
}

// DS18B20 commands (single device, Skip ROM). Power-on default is already 12-bit resolution, no extra setup needed.
bool dsStartConversion() {
  if (!owReset()) { snprintf(dsLastErr, sizeof(dsLastErr), "convert:no_presence(%u)", owLastFail); return false; }
  owWriteByte(0xCC);   // Skip ROM
  owWriteByte(0x44);   // Convert T (12-bit about 750ms)
  return true;
}

// Read the scratchpad and check CRC; returns true on success, temperature stored in out
bool dsReadTemp(float &out) {
  if (!owReset()) { snprintf(dsLastErr, sizeof(dsLastErr), "read:no_presence(%u)", owLastFail); return false; }
  owWriteByte(0xCC);
  owWriteByte(0xBE);   // Read Scratchpad
  uint8_t sp[9];
  for (uint8_t i = 0; i < 9; i++) sp[i] = owReadByte();
  bool allSame = true;
  for (uint8_t i = 1; i < 9; i++) if (sp[i] != sp[0]) { allSame = false; break; }
  if (allSame) { snprintf(dsLastErr, sizeof(dsLastErr), "all_0x%02X", sp[0]); return false; }   // all 0x00 / all 0xFF
  if (owCrc8(sp, 8) != sp[8]) {
    snprintf(dsLastErr, sizeof(dsLastErr), "crc %02X%02X%02X%02X%02X%02X%02X%02X/%02X",
             sp[0], sp[1], sp[2], sp[3], sp[4], sp[5], sp[6], sp[7], sp[8]);
    return false;
  }
  snprintf(dsLastErr, sizeof(dsLastErr), "ok");
  int16_t raw = (int16_t)((sp[1] << 8) | sp[0]);
  dsRaw16Last = raw;               // v4.0: raw value goes to Python (including suspicious values like 85.0 C; Python decides)
  out = raw / 16.0f;
  return true;
}
#endif

// DS18B20 state: 0 = not found, 1 = OK, 2 = found but consecutive reads failing
// (v4.0: the MCU no longer decides which temperature pH uses; it only reports raw readings and state; selection and range checks are in Python)
uint8_t dsState = 0;
uint8_t dsFailCount = 0;
const char *dsStateName() { return dsState == 1 ? "ok" : (dsState == 2 ? "error" : "none"); }

#if PH_USE_DS18B20
bool phTempPending = false;
unsigned long phTempReqMs = 0;
unsigned long dsLastSearchMs = 0;
unsigned long dsSearchCount = 0;
uint8_t dsLastReportFail = 0xFF;
bool dsRescanNow = false;
unsigned long dsLastStartMs = 0;

bool dsFind() { return owReset(); }

String ds_timing(String arg) {
  rpcMark();
  arg.trim();
  if (arg == "spin" && OW_CAN_SPIN) owTiming = 0;
  else if (arg == "busy") owTiming = 1;
  else if (arg == "cal") { if (!owInited) owInit(); else owCalibrate(); }
  if (dsState != 1) dsRescanNow = true;
  dsFailCount = 0;
  Monitor.print("[ds18b20] timing method: "); Monitor.println(owTiming == 0 ? "spin loop" : "delayMicroseconds");
  return String("timing=") + (owTiming == 0 ? "spin" : "busy") + " loops_us=" + String((int)owLoopsPerUs) +
         " busy6_us=" + String(owBusy6Us, 1) + " spin6_us=" + String(owSpin6Us, 1);
}
String ds_diag(String) {
  rpcMark();
  String r = owDiagString();
  Monitor.print("[ds18b20] diagnostics (web request): "); Monitor.println(r);
  if (dsState != 1) dsRescanNow = true;
  return String("state=") + dsStateName() + " searches=" + String(dsSearchCount) + " " + r;
}
#endif

// Non-blocking: first search 5 s after boot; if not found, search again every 10 s; once found, convert every 1 s and read 800 ms later
void dsTick(unsigned long now) {
#if PH_USE_DS18B20
  if (dsState == 0) {
    if (!dsRescanNow && (dsLastSearchMs == 0 ? (now < 5000) : (now - dsLastSearchMs < 10000))) return;
    dsRescanNow = false;
    bool firstSearch = (dsLastSearchMs == 0);
    dsLastSearchMs = now;
    dsSearchCount++;
    if (firstSearch) Monitor.println("[ds18b20] first search on D4 ...");
    if (dsFind()) {
      dsState = 1; dsFailCount = 0; phTempPending = false; dsLastReportFail = 0xFF;
      Monitor.print("[ds18b20] sensor found (D4, search #"); Monitor.print(dsSearchCount); Monitor.println(")");
    } else {
      if (owLastFail != dsLastReportFail || (dsSearchCount % 6) == 1) {
        Monitor.print("[ds18b20] search #"); Monitor.print(dsSearchCount); Monitor.print(": ");
        Monitor.println(owLastFail == 1 ? "bus is low (pull-up not working / sensor unpowered / short)"
                                        : "pull-up OK but no presence response (sensor not connected)");
        Monitor.print("[ds18b20] diagnostics: "); Monitor.println(owDiagString());
        dsLastReportFail = owLastFail;
      }
      return;
    }
  }
  if (!phTempPending) {
    if (now - dsLastStartMs < 1000) return;
    dsLastStartMs = now;
    if (!dsStartConversion()) {
      if (++dsFailCount >= 3) dsState = 2;
      if (dsFailCount >= 10) { dsState = 0; dsLastSearchMs = now; Monitor.println("[ds18b20] failing too long, back to searching every 10 s"); }
      return;
    }
    phTempPending = true;
    phTempReqMs = now;
  } else if (now - phTempReqMs >= 800) {
    phTempPending = false;
    float t = -127.0f;
    bool rd = dsReadTemp(t);
    if (rd) {
      dsLastReadMs = now;              // dsRaw16Last already updated in dsReadTemp (including suspicious values like 85.0; Python decides)
      dsFailCount = 0;
      if (dsState != 1) Monitor.println("[ds18b20] readings restored");
      dsState = 1;
    } else if (++dsFailCount >= 3) {
      if (dsState == 1) { Monitor.print("[ds18b20] repeated read failures: "); Monitor.println(dsLastErr); }
      dsState = 2;
      if (dsFailCount >= 10) { dsState = 0; dsLastSearchMs = now; Monitor.println("[ds18b20] failing too long, back to searching every 10 s"); }
    }
  }
#else
  (void)now;
#endif
}

// ---- pH: start a round every 500 ms; each loop() reads 32 samples (first one discarded); store one sum once 256 samples are collected ----
const int   PH_OVERSAMPLE = 256;
const int   PH_CHUNK      = 32;
const unsigned long PH_SAMPLE_INTERVAL_MS = 500;
const int   PH_QUEUE = 6;
uint32_t phAcc = 0;
int      phAccN = 0;
bool     phAccActive = false;
unsigned long phLastSampleStart = 0;
uint32_t phQSum[PH_QUEUE];
uint16_t phQN[PH_QUEUE];
unsigned long phQT[PH_QUEUE];
int      phQCount = 0;

void phSamplerTick(unsigned long now) {
  if (!phAccActive) {
    if (now - phLastSampleStart < PH_SAMPLE_INTERVAL_MS) return;
    phLastSampleStart = now;
    phAcc = 0;
    phAccN = 0;
    phAccActive = true;
  }
  (void)analogRead(PH_PIN);              // discard the first sample after switching channel (same as pressure)
  for (int i = 0; i < PH_CHUNK && phAccN < PH_OVERSAMPLE; i++) {
    phAcc += (uint32_t)analogRead(PH_PIN);
    phAccN++;
  }
  if (phAccN >= PH_OVERSAMPLE) {
    phAccActive = false;
    if (phQCount < PH_QUEUE) {
      phQSum[phQCount] = phAcc; phQN[phQCount] = (uint16_t)phAccN; phQT[phQCount] = phLastSampleStart;
      phQCount++;
    }
  }
}

// ---- Push aux once per 1 s (pH sum, DS18B20 raw value, pump status) ----
unsigned long auxSeq = 0, auxLastMs = 0;
extern int pumpPwm;
extern bool pumpForward;
extern bool pumpKicking;

void auxTick(unsigned long now) {
#if ENABLE_PH
  dsTick(now);
  phSamplerTick(now);
#endif
  if (now - auxLastMs < 1000) return;
  auxLastMs = now;
  auxSeq++;
  String p = String("seq=") + auxSeq + ",t=" + now + ",ph=";
  for (int i = 0; i < phQCount; i++) {
    if (i) p += ";";
    p += String(phQSum[i]) + ":" + phQN[i] + ":" + phQT[i];
  }
  phQCount = 0;
  p += String(",ds=") + dsStateName() + ",traw=" + dsRaw16Last +
       ",tage=" + (dsLastReadMs ? (long)(now - dsLastReadMs) : -1L) +
#if PH_USE_DS18B20
       ",derr=" + String(dsLastErr) +
#endif
       ",pwm=" + pumpPwm + ",fwd=" + (pumpForward ? 1 : 0) + ",kick=" + (pumpKicking ? 1 : 0);
  p += "," + baseStatusString() + ",ptrip=" + (pTripLatched ? "1" : "0") + ",plim=" + String(pProtectLimitBar, 3);   // v4.1.0
  Bridge.notify("on_aux_raw", p);
}

// ===========================================================================
// 8. Pinch valve - STS3215 bus servo (v3, ported from STS3215test)
// ===========================================================================
// Purpose: clamp the retentate outlet tube so fluid is forced through the membrane wall -> TMP rises -> sample flows out the permeate side.
// Only two positions, "open / closed" (the user decides when to release), plus raw position moves for setup.
//
// Safety design (all in the MCU, works even if the Linux side crashes):
//   1. TMP or Lumen in (Feed) above limit (default 0.5 bar; Lumen in can use instantaneous or 1 s average), 5 consecutive 10 ms samples -> release + FAULT
//   2. Closed longer than max_close_s -> release + FAULT
//   3. Servo temperature >= VALVE_MAX_TEMP_C -> release + FAULT
//   4. Servo fails to respond 3 times in a row while closed -> FAULT (if it cannot release, people must know)
//   5. Always moves to the "open" position at boot; pinch valve refuses to close while in FAULT, must be cleared manually
//   6. Pump emergency stop also releases it (does not latch FAULT)
//
// Bus I/O happens only inside valveTick(): Bridge functions (and the pressure-section safety checks) only queue requests,
// so there is never a problem with two threads using Serial1 at the same time.

// v3.4: wrap SMS_STS to count whether any bytes at all are received on Serial1.
// When the servo cannot be found, this number tells you directly:
//   0 bytes received           -> wiring/power/jumper (signal never comes back): driver board unpowered, jumper not on A, RX/TX swapped, no common ground
//   received but unparseable   -> wrong baud rate, or the adapter board echoes back what it sent
//   parseable but different ID -> servo ID is not the configured one (auto scan will find it)
class CountingSTS : public SMS_STS {
 public:
  unsigned long rxBytes = 0;
 protected:
  int readSCS(unsigned char *nDat, int nLen) override {
    int n = SMS_STS::readSCS(nDat, nLen);
    if (n > 0) rxBytes += (unsigned long)n;
    return n;
  }
  void rFlushSCS() override {
    while (pSerial->read() != -1) rxBytes++;
  }
};

CountingSTS sts;

// ---- Settings (boot defaults; the Python side pushes the saved settings back) ----
uint8_t valveId            = 1;
unsigned long valveBaud    = 1000000UL;   // v3.4: configurable (STS3215 factory default 1 Mbps)
bool    valveScanning      = false;       // v3.4: auto scan in progress (scan logic in section "8.1")
int     valvePosOpen       = 2048;   // raw position for "open" - must be measured and set
int     valvePosClosed     = 2048;   // raw position for "closed" - must be measured and set (same as open = not set)
int     valveSpeed         = 1500;   // step/s
int     valveAcc           = 50;     // 1 unit is about 100 step/s^2
int     valveTorqueLimit   = 1000;   // 0~1000 (RAM register 48), limits clamping force/heating
unsigned long valveMaxCloseMs = 900000UL;   // 15 minutes
float   valveTmpLimitBar   = 0.50f;  // aligned with constants.json thresholds.tmp_critical_bar
float   valveFeedLimitBar  = 0.50f;  // v3.10.8: Lumen in (Feed, A0) limit 1.0 -> 0.5 bar
uint8_t valveFeedBasis     = 0;      // Lumen in criterion 0 = instantaneous value (5 consecutive), 1 = average over last 1 s

const int  VALVE_MIN_TRAVEL      = 20;     // open/closed differing by less than this many steps is treated as "not set"
const int  VALVE_TRIP_SAMPLES = 5;       // v4.0: number of consecutive 10 ms pressure samples over limit before releasing (5 samples = 50 ms)
const int  VALVE_MAX_TEMP_C      = 60;
const unsigned long VALVE_POLL_MS        = 500;
const unsigned long VALVE_RESCAN_MS      = 2000;
const unsigned long VALVE_NOTIFY_MS      = 1000;
const int  VALVE_COMM_FAIL_LIMIT = 3;
const unsigned long VALVE_IO_TIMEOUT_MS  = 15;  // SCServo default is 100ms (would block loop()); v3.4 relaxed from 8 to 15ms

enum ValveCmd : uint8_t { VALVE_CMD_OPEN = 0, VALVE_CMD_CLOSED = 1, VALVE_CMD_JOG = 2 };
const char *VALVE_CMD_NAME[] = { "open", "closed", "jog" };

bool     valveOnline     = false;
ValveCmd valveCmd        = VALVE_CMD_OPEN;
bool pumpValveOpen() { return valveCmd == VALVE_CMD_OPEN; }
bool     valveFault      = false;
char     valveMsg[48]    = "";
bool     valveTorqueOn   = false;
unsigned long valveClosedSince = 0;   // time it left OPEN (for closed/JOG timing)

int valvePresentPos = -1, valveGoalPos = -1, valveLoad = 0, valveTempC = -1;
int valveVoltDv = -1, valveCurrent = 0, valveMoving = 0;
int valveCommFails = 0;
int valveInterlockHits = 0;

// ---- Requests from Bridge / pressure section (actually executed by valveTick in loop) ----
volatile bool valveReqOpen     = false;   // release (highest priority)
volatile bool valveReqClose    = false;
volatile int  valveReqRaw      = -1;      // raw position for setup
volatile int  valveReqTorque   = -1;      // 0/1
volatile bool valveReqReinit   = false;   // re-ping / write torque limit
volatile bool valveReqNotify   = false;
volatile bool valvePendingFault = false;
char valvePendingMsg[48] = "";

unsigned long valveLastPollMs = 0, valveLastScanMs = 0, valveLastNotifyMs = 0;

bool valveConfigured() { return abs(valvePosClosed - valvePosOpen) >= VALVE_MIN_TRAVEL; }

void valveRequestOpen(const char *why, bool latchFault) {
  valveReqOpen = true;
  valveReqClose = false;
  valveReqRaw = -1;
  if (latchFault) {
    strncpy(valvePendingMsg, why, sizeof(valvePendingMsg) - 1);
    valvePendingMsg[sizeof(valvePendingMsg) - 1] = '\0';
    valvePendingFault = true;
  }
  valveReqNotify = true;
}

// v4.0: called by pressureSampleOnce() for every 10 ms sample.
// Releases only after VALVE_TRIP_SAMPLES consecutive samples (default 5 = 50 ms) exceed the limit. v3 used "peak of a 1 s sliding window, 2 consecutive 200 ms windows",
// but adjacent windows overlapped 80%, so a single 10 ms spike was the peak in 5 windows, i.e. no real confirmation; now a single-point spike will not trigger.
// TMP is computed from the three channels at the same instant: (Feed + Retentate)/2 - Permeate (v3 combined each channel's own extreme, at different times).
// feed_basis: 0 = instantaneous value (N consecutive), 1 = average over last 1 s (also N consecutive).
void valveInterlockSample(float tmpBar, float feedBar, float feedMeanBar) {
  if (valveCmd == VALVE_CMD_OPEN) { valveInterlockHits = 0; return; }
  float fb = (valveFeedBasis == 1) ? feedMeanBar : feedBar;
  bool tmpOver = tmpBar > valveTmpLimitBar;
  bool feedOver = fb > valveFeedLimitBar;
  if (!tmpOver && !feedOver) { valveInterlockHits = 0; return; }
  if (++valveInterlockHits >= VALVE_TRIP_SAMPLES) {
    valveInterlockHits = 0;
    String m = feedOver
               ? String("Lumen in ") + (valveFeedBasis == 1 ? "mean " : "") + String(fb, 3) +
                 " bar > " + String(valveFeedLimitBar, 2)
               : String("TMP ") + String(tmpBar, 3) + " bar > " + String(valveTmpLimitBar, 2);
    Monitor.print("[valve] !! pressure too high, pinch valve auto-released: "); Monitor.println(m);
    valveRequestOpen(m.c_str(), true);
  }
}

String valveStatusString() {
  return String("online=") + String(valveOnline ? 1 : 0) +
         ",cmd=" + VALVE_CMD_NAME[valveCmd] +
         ",fault=" + String(valveFault ? 1 : 0) +
         ",pos=" + String(valvePresentPos) +
         ",goal=" + String(valveGoalPos) +
         ",load=" + String(valveLoad) +
         ",temp=" + String(valveTempC) +
         ",volt=" + String(valveVoltDv) +
         ",cur=" + String(valveCurrent) +
         ",moving=" + String(valveMoving) +
         ",closed_ms=" + String(valveCmd == VALVE_CMD_OPEN ? 0UL : (millis() - valveClosedSince)) +
         ",torque=" + String(valveTorqueOn ? 1 : 0) +
         ",configured=" + String(valveConfigured() ? 1 : 0) +
         ",baud=" + String(valveBaud) +
         ",rx=" + String(sts.rxBytes) +
         ",scanning=" + String(valveScanning ? 1 : 0) +
         ",msg=" + String(valveMsg);
}

String valveConfigString() {
  return String("id=") + String((int)valveId) +
         ",open=" + String(valvePosOpen) +
         ",closed=" + String(valvePosClosed) +
         ",speed=" + String(valveSpeed) +
         ",acc=" + String(valveAcc) +
         ",torque_limit=" + String(valveTorqueLimit) +
         ",max_close_s=" + String(valveMaxCloseMs / 1000UL) +
         ",tmp_limit=" + String(valveTmpLimitBar, 3) +
         ",feed_limit=" + String(valveFeedLimitBar, 3) +
         ",feed_basis=" + String((int)valveFeedBasis) +
         ",baud=" + String(valveBaud);
}

void valveSetMsg(const char *m) {
  strncpy(valveMsg, m, sizeof(valveMsg) - 1);
  valveMsg[sizeof(valveMsg) - 1] = '\0';
}

void valveNotifyNow() {
  valveLastNotifyMs = millis();
  Bridge.notify("on_valve_update", valveStatusString());
}

// Note SCServo's return conventions: write calls (WritePosEx / EnableTorque / writeWord) return 1 on success, 0 on failure;
// Ping returns the ID on success, -1 on failure; FeedBack returns -1 on failure. (The original STS3215test checked write success with ">= 0",
// which is always true; changed to "> 0" here.)
bool valveMoveTo(int pos) {
  pos = constrain(pos, 0, 4095);
  if (!valveTorqueOn) {
    if (sts.EnableTorque(valveId, 1) > 0) valveTorqueOn = true;
  }
  int r = sts.WritePosEx(valveId, (s16)pos, (u16)valveSpeed, (u8)valveAcc);
  if (r <= 0) { valveCommFails++; return false; }
  valveGoalPos = pos;
  valveCommFails = 0;
  return true;
}

// Consecutive communication failures: go offline; if not currently "open", latch FAULT (if it cannot release, people must know)
void valveGoOffline(unsigned long now, const char *why) {
  valveOnline = false;
  valveLastScanMs = now;
  if (valveCmd != VALVE_CMD_OPEN) {
    valveFault = true;
    valveSetMsg("servo lost while not open");
    valveReqOpen = true;          // on coming back online valveInitOnline() moves to open
  }
  Monitor.print("[valve] "); Monitor.print(why); Monitor.println(" -> offline");
  valveNotifyNow();
}

// Servo just came online (or ID/torque limit changed): write torque limit, enable torque, move to "open"
void valveInitOnline() {
  sts.writeWord(valveId, SMS_STS_TORQUE_LIMIT_L, (u16)constrain(valveTorqueLimit, 0, 1000));
  valveTorqueOn = (sts.EnableTorque(valveId, 1) > 0);
  valveCmd = VALVE_CMD_OPEN;
  valveMoveTo(valvePosOpen);
  Monitor.print("[valve] servo ID "); Monitor.print((int)valveId);
  Monitor.print(" online, moving to OPEN ("); Monitor.print(valvePosOpen); Monitor.println(")");
}

// ===========================================================================
// 8.1 Servo auto scan (v3.4)
// ===========================================================================
// Tries the 8 STS-series baud rates in order; at each baud rate first sends one broadcast Ping (ID 254; with only one servo on the bus it reports
// its own ID), then Pings IDs 0~253 one by one. Only one Ping per loop() (blocks at most IOTimeOut = 15ms),
// so pressure sampling never stalls for long. A full scan takes about 30 s; normal pinch valve actions pause during the scan (must be "open" to scan).
const unsigned long VALVE_BAUDS[] = { 1000000UL, 500000UL, 250000UL, 128000UL,
                                      115200UL, 76800UL, 57600UL, 38400UL };
const int VALVE_N_BAUDS = sizeof(VALVE_BAUDS) / sizeof(VALVE_BAUDS[0]);
const int VALVE_SCAN_MAX_FOUND = 8;

bool     valveScanDone = false;
bool     valveScanFull = true;      // false = broadcast Ping only (fast, about 1 s)
int      valveScanBaudIdx = 0;
int      valveScanId = -1;          // -1 = broadcast Ping not yet done at this baud rate
int      valveScanFoundN = 0;
uint8_t  valveScanFoundId[VALVE_SCAN_MAX_FOUND];
unsigned long valveScanFoundBaud[VALVE_SCAN_MAX_FOUND];
unsigned long valveScanRx[8];        // bytes received at each baud rate (indexed like VALVE_BAUDS)
volatile bool valveReqScan = false;
volatile bool valveReqScanFull = true;
volatile int  valveReqBlind = -1;      // v3.5: blind move test target position (-1 = none)
volatile bool valveReqLoopback = false; // v3.6: D0-D1 loopback test
// v3.8.3: never use a global String! Global objects with destructors make the compiler emit __aeabi_atexit/__dso_handle,
// which the UNO Q Zephyr core (0.90 and later) does not export, so the whole sketch "fails to load" -
// with no error message at all, not a single [boot] line in Serial Monitor, and every function is not available on the Python side.
char valveLoopbackResult[80] = "state=idle";

void valveSerialBegin(unsigned long baud) {
  Serial1.begin(baud);
  sts.pSerial = &Serial1;
  sts.IOTimeOut = VALVE_IO_TIMEOUT_MS;
}

void valveScanAddFound(int id, unsigned long baud) {
  for (int i = 0; i < valveScanFoundN; i++)
    if (valveScanFoundId[i] == id && valveScanFoundBaud[i] == baud) return;
  if (valveScanFoundN >= VALVE_SCAN_MAX_FOUND) return;
  valveScanFoundId[valveScanFoundN] = (uint8_t)id;
  valveScanFoundBaud[valveScanFoundN] = baud;
  valveScanFoundN++;
  Monitor.print("[valve][scan] found servo ID "); Monitor.print(id);
  Monitor.print(" @ "); Monitor.print(baud); Monitor.println(" baud");
}

void valveScanFinish() {
  valveScanning = false;
  valveScanDone = true;
  valveSerialBegin(valveBaud);          // back to the configured baud rate
  valveOnline = false;                  // let valveTick re-ping once with the current settings
  valveLastScanMs = 0;
  Monitor.print("[valve][scan] done, found "); Monitor.println(valveScanFoundN);
  valveReqNotify = true;
}

// Returns true if this pass was used by the scan; skip the rest of valveTick
bool valveScanTick() {
  if (valveReqScan) {
    valveReqScan = false;
    valveScanning = true;
    valveScanDone = false;
    valveScanFull = valveReqScanFull;
    valveScanBaudIdx = 0;
    valveScanId = -1;
    valveScanFoundN = 0;
    for (int i = 0; i < VALVE_N_BAUDS; i++) valveScanRx[i] = 0;
    valveSerialBegin(VALVE_BAUDS[0]);
    Monitor.println(valveScanFull ? "[valve][scan] full scan started (8 bauds x ID 0-253)"
                                  : "[valve][scan] quick scan started (broadcast ping x 8 bauds)");
  }
  if (!valveScanning) return false;

  unsigned long rx0 = sts.rxBytes;
  unsigned long baud = VALVE_BAUDS[valveScanBaudIdx];
  if (valveScanId < 0) {
    int r = sts.Ping(0xFE);             // broadcast: the reply packet carries the servo's own ID
    if (r >= 0 && r <= 253) valveScanAddFound(r, baud);
    valveScanId = 0;
    if (!valveScanFull) valveScanId = 254;   // fast mode: done with this baud rate
  } else if (valveScanId <= 253) {
    if (sts.Ping((uint8_t)valveScanId) == valveScanId) valveScanAddFound(valveScanId, baud);
    valveScanId++;
  }
  valveScanRx[valveScanBaudIdx] += sts.rxBytes - rx0;

  if (valveScanId > 253) {              // this baud rate is done, move to the next
    valveScanBaudIdx++;
    valveScanId = -1;
    if (valveScanBaudIdx >= VALVE_N_BAUDS) { valveScanFinish(); return true; }
    valveSerialBegin(VALVE_BAUDS[valveScanBaudIdx]);
  }
  return true;
}

String valveScanStatusString() {
  int total = VALVE_N_BAUDS * (valveScanFull ? 255 : 1);
  int done = valveScanBaudIdx * (valveScanFull ? 255 : 1) + (valveScanFull ? (valveScanId + 1) : 0);
  if (!valveScanning) done = valveScanDone ? total : 0;
  String found = "";
  for (int i = 0; i < valveScanFoundN; i++) {
    if (i) found += ";";
    found += String((int)valveScanFoundId[i]) + "@" + String(valveScanFoundBaud[i]);
  }
  String rx = "";
  for (int i = 0; i < VALVE_N_BAUDS; i++) {
    if (i) rx += ";";
    rx += String(VALVE_BAUDS[i]) + ":" + String(valveScanRx[i]);
  }
  return String("state=") + (valveScanning ? "running" : (valveScanDone ? "done" : "idle")) +
         ",progress=" + String(total ? (100 * done / total) : 0) +
         ",baud=" + String(valveScanning ? VALVE_BAUDS[valveScanBaudIdx] : valveBaud) +
         ",found=" + found +
         ",rx=" + rx;
}

String valve_scan(String arg) {
  arg.trim();
  if (valveScanning) return "rejected:scan already running";
  if (valveOnline && valveCmd != VALVE_CMD_OPEN) return "rejected:valve must be open before scanning";
  valveReqScanFull = (arg != "quick");
  valveReqScan = true;
  return "started";
}

String valve_scan_status(String arg) { return valveScanStatusString(); }

// ---- v3.5: blind move test (no servo reply needed) ----
// Sends torque-enable + move commands to "broadcast ID 254". Broadcast writes never reply by protocol, so as long as
// the TX wiring, driver board and servo power are good, the servo moves regardless of its ID or whether the RX line is connected.
// Sends once at each of the 8 baud rates in order. Used to split "servo not found" into two halves:
//   servo moves     -> TX and power OK, problem is on the reply path (D0/RX wire, driver board RX, TX/RX swapped)
//   servo no move   -> problem on the TX path or power (D1/TX wire, jumper cap, driver board power, servo cable)
void valveBlindMove(int pos) {
  pos = constrain(pos, 0, 4095);
  Monitor.print("[valve][blind] broadcast move to "); Monitor.print(pos);
  Monitor.println(" at all 8 bauds (no reply expected)");
  for (int i = 0; i < VALVE_N_BAUDS; i++) {
    valveSerialBegin(VALVE_BAUDS[i]);
    delay(2);
    pressureTick(millis());               // v4.1.0: 8 baud rates take about 60 ms total, do pressure sampling in between
    sts.EnableTorque(0xFE, 1);
    sts.WritePosEx(0xFE, (s16)pos, (u16)valveSpeed, (u8)valveAcc);
    delay(5);
    pressureTick(millis());
  }
  valveSerialBegin(valveBaud);
  valveOnline = false;          // let valveTick re-ping with the current settings
  valveLastScanMs = 0;
}

// ---- v3.6: D0/D1 loopback test (unplug the driver board, connect D0 and D1 directly with a jumper wire) ----
// Sends 64 known bytes at both 115200 and 1 Mbps and checks whether they come back unchanged.
// Comes back      -> UNO Q Serial1 (D0/D1) TX/RX both OK, problem is in driver board / power / voltage levels / servo
// Does not return -> problem is on the UNO Q side D0/D1 itself (pins, core version, Serial1 is not D0/D1)
int valveLoopbackOnce(unsigned long baud) {
  valveSerialBegin(baud);
  delay(5);
  pressureTick(millis());
  while (Serial1.read() != -1) {}
  int ok = 0;
  for (int i = 0; i < 64; i++) {
    uint8_t b = (uint8_t)(0x55 ^ (i * 37));
    Serial1.write(b);
    unsigned long t0 = millis();
    int r = -1;
    while (millis() - t0 < 10) {          // v4.1.0: with no loopback each byte waits 10 ms, 64 x 2 baud rates = 1.28 s total
      r = Serial1.read();
      if (r != -1) break;
      pressureTick(millis());
    }
    if (r == b) ok++;
  }
  return ok;
}

void valveLoopbackRun() {
  int okSlow = valveLoopbackOnce(115200UL);
  int okFast = valveLoopbackOnce(1000000UL);
  valveSerialBegin(valveBaud);
  valveOnline = false;
  valveLastScanMs = 0;
  snprintf(valveLoopbackResult, sizeof(valveLoopbackResult), "state=done,ok115200=%d,ok1000000=%d,total=64",
           (int)okSlow, (int)okFast);
  Monitor.print("[valve][loopback] 115200: "); Monitor.print(okSlow);
  Monitor.print("/64, 1000000: "); Monitor.print(okFast); Monitor.println("/64");
}

String valve_loopback(String arg) {
  if (valveScanning) return "rejected:scan running";
  if (valveOnline && valveCmd != VALVE_CMD_OPEN) return "rejected:valve must be open";
  strncpy(valveLoopbackResult, "state=running", sizeof(valveLoopbackResult) - 1);
  valveReqLoopback = true;
  return "started";
}

String valve_loopback_status(String arg) { return String(valveLoopbackResult); }

bool avAnyOnline();                       // defined in section "8.2"
String valve_blind_move(String arg) {
  long p = arg.toInt();
  if (p < 0 || p > 4095) return "rejected:pos 0-4095";
  if (valveScanning)     return "rejected:scan running";
  // v4.1.0: blind move uses the broadcast ID, so the shell valve / feed valve on the bus also turn to the same position
  if (avAnyOnline())     return "rejected:shell/feed valve servos online (broadcast would move them too)";
  if (valveOnline && valveCmd != VALVE_CMD_OPEN) return "rejected:valve must be open";
  valveReqBlind = (int)p;
  return "ok";
}

void valveTick(unsigned long now) {
  // ---- 0. Latch FAULT coming from the pressure section ----
  if (valvePendingFault) {
    valvePendingFault = false;
    valveFault = true;
    valveSetMsg(valvePendingMsg);
    Monitor.print("[valve] !! FAULT -> force OPEN: "); Monitor.println(valveMsg);
  }

  // ---- 0.3 Loopback test (v3.6) ----
  if (valveReqLoopback) {
    valveReqLoopback = false;
    valveLoopbackRun();
    return;
  }

  // ---- 0.4 Blind move test (v3.5) ----
  if (valveReqBlind >= 0) {
    int p = valveReqBlind;
    valveReqBlind = -1;
    valveBlindMove(p);
    return;
  }

  // ---- 0.5 Auto scan (v3.4) in progress: this pass only scans ----
  if (valveScanTick()) {
    if (now - valveLastNotifyMs >= VALVE_NOTIFY_MS) valveNotifyNow();
    return;
  }

  // ---- 1. Offline: ping every 2 s ----
  if (valveReqReinit) { valveReqReinit = false; valveOnline = false; valveLastScanMs = 0; }
  if (!valveOnline) {
    if (valveLastScanMs != 0 && now - valveLastScanMs < VALVE_RESCAN_MS) return;
    valveLastScanMs = now;
    if (sts.Ping(valveId) != -1) {
      valveOnline = true;
      valveCommFails = 0;
      valveInitOnline();
      valveReqOpen = false;      // already moved to OPEN when coming online
      valveReqClose = false;
      valveReqRaw = -1;
      valveNotifyNow();
    } else if (now - valveLastNotifyMs >= VALVE_NOTIFY_MS * 5) {
      valveNotifyNow();          // push occasionally even while offline so the display knows it is still offline
    }
    return;
  }

  // ---- 2. Execute requests (release first) ----
  if (valveReqOpen) {
    valveReqClose = false;
    valveReqRaw = -1;
    if (valveMoveTo(valvePosOpen)) {
      valveReqOpen = false;
      if (valveCmd != VALVE_CMD_OPEN) Monitor.println("[valve] OPEN");
      valveCmd = VALVE_CMD_OPEN;
      valveNotifyNow();
    } else if (valveCommFails >= VALVE_COMM_FAIL_LIMIT) {
      valveGoOffline(now, "open command failed");
      return;
    }
    // Failed but limit not reached: valveReqOpen stays true, retry next pass (release must not be tried only once)
  } else if (valveReqClose) {
    valveReqClose = false;
    if (valveMoveTo(valvePosClosed)) {
      if (valveCmd == VALVE_CMD_OPEN) valveClosedSince = now;
      valveCmd = VALVE_CMD_CLOSED;
      valveInterlockHits = 0;
      if (!valveFault) valveMsg[0] = '\0';
      Monitor.println("[valve] CLOSED (pinch)");
    } else {
      valveSetMsg("close command failed");
    }
    valveNotifyNow();
  } else if (valveReqRaw >= 0) {
    int p = valveReqRaw;
    valveReqRaw = -1;
    if (valveMoveTo(p)) {
      if (p == valvePosOpen) {
        valveCmd = VALVE_CMD_OPEN;
      } else {
        if (valveCmd == VALVE_CMD_OPEN) valveClosedSince = now;
        valveCmd = VALVE_CMD_JOG;      // any non-"open" position is always covered by safety release and timing
      }
    }
    valveNotifyNow();
  }
  if (valveReqTorque >= 0) {
    int on = valveReqTorque;
    valveReqTorque = -1;
    if (sts.EnableTorque(valveId, on ? 1 : 0) > 0) valveTorqueOn = (on != 0);
    valveNotifyNow();
  }

  // ---- 3. Periodically read back status ----
  if (now - valveLastPollMs >= VALVE_POLL_MS) {
    valveLastPollMs = now;
    if (sts.FeedBack(valveId) != -1) {
      valveCommFails = 0;
      valvePresentPos = sts.ReadPos(-1);
      valveLoad       = sts.ReadLoad(-1);
      valveTempC      = sts.ReadTemper(-1);
      valveVoltDv     = sts.ReadVoltage(-1);
      valveCurrent    = sts.ReadCurrent(-1);
      valveMoving     = sts.ReadMove(-1);
    } else if (++valveCommFails >= VALVE_COMM_FAIL_LIMIT) {
      valveGoOffline(now, "servo not responding");
      return;
    }
  }

  // ---- 4. Timing / temperature protection ----
  if (valveCmd != VALVE_CMD_OPEN) {
    if (now - valveClosedSince >= valveMaxCloseMs) {
      valveRequestOpen("max close time reached", true);
    } else if (valveTempC >= VALVE_MAX_TEMP_C) {
      valveRequestOpen("servo over temperature", true);
    }
  }

  // ---- 5. Push ----
  if (valveReqNotify || now - valveLastNotifyMs >= VALVE_NOTIFY_MS) {
    valveReqNotify = false;
    valveNotifyNow();
  }
}

// ---- Pinch valve Bridge interface ----
String valve_open(String arg) {
  valveRequestOpen("", false);
  return "ok";
}

String valve_close(String arg) {
  if (valveFault)          return "rejected:fault latched, clear first";
  if (!valveOnline)        return "rejected:servo offline";
  if (!valveConfigured())  return "rejected:closed position not configured";
  valveReqOpen = false;
  valveReqRaw = -1;
  valveReqClose = true;
  return "ok";
}

String valve_goto_raw(String arg) {
  long p = arg.toInt();
  if (valveFault)        return "rejected:fault latched, clear first";
  if (!valveOnline)      return "rejected:servo offline";
  if (p < 0 || p > 4095) return "rejected:pos 0-4095";
  valveReqClose = false;
  valveReqRaw = (int)p;
  return "ok";
}

String valve_torque(String arg) {
  if (!valveOnline) return "rejected:servo offline";
  valveReqTorque = (arg.toInt() != 0) ? 1 : 0;
  return valveReqTorque ? "1" : "0";
}

String valve_get_status(String arg) { return valveStatusString(); }
String valve_get_config(String arg) { return valveConfigString(); }

String valve_set_config(String arg) {
  float id = valveId, op = valvePosOpen, cl = valvePosClosed, sp = valveSpeed, ac = valveAcc;
  float tl = valveTorqueLimit, mc = valveMaxCloseMs / 1000.0f, tmpL = valveTmpLimitBar, feedL = valveFeedLimitBar;
  float x;
  if (kvGet(arg, "id", x))           id = x;
  if (kvGet(arg, "open", x))         op = x;
  if (kvGet(arg, "closed", x))       cl = x;
  if (kvGet(arg, "speed", x))        sp = x;
  if (kvGet(arg, "acc", x))          ac = x;
  if (kvGet(arg, "torque_limit", x)) tl = x;
  if (kvGet(arg, "max_close_s", x))  mc = x;
  if (kvGet(arg, "tmp_limit", x))    tmpL = x;
  if (kvGet(arg, "feed_limit", x))   feedL = x;
  float fb = valveFeedBasis;
  if (kvGet(arg, "feed_basis", x))   fb = x;
  float bd = (float)valveBaud;
  if (kvGet(arg, "baud", x))         bd = x;
  bool baudOk = false;
  for (int i = 0; i < VALVE_N_BAUDS; i++) if ((unsigned long)bd == VALVE_BAUDS[i]) baudOk = true;
  if (!baudOk) return "rejected:baud must be one of 1000000/500000/250000/128000/115200/76800/57600/38400";
  if (valveScanning) return "rejected:scan running";

  if (!(id >= 0 && id <= 253))           return "rejected:id 0-253";
  if (!(op >= 0 && op <= 4095 && cl >= 0 && cl <= 4095)) return "rejected:open/closed 0-4095";
  if (!(sp >= 0 && sp <= 4000))          return "rejected:speed 0-4000";
  if (!(ac >= 0 && ac <= 254))           return "rejected:acc 0-254";
  if (!(tl >= 50 && tl <= 1000))         return "rejected:torque_limit 50-1000";
  if (!(mc >= 10 && mc <= 7200))         return "rejected:max_close_s 10-7200";
  if (!(tmpL > 0.02f && tmpL <= 2.0f))   return "rejected:tmp_limit 0.02-2.0";
  if (!(feedL > 0.05f && feedL <= 5.0f)) return "rejected:feed_limit 0.05-5.0";
  if (!(fb == 0 || fb == 1))             return "rejected:feed_basis 0(peak)/1(mean)";

  bool idChanged = ((uint8_t)id != valveId) || ((unsigned long)bd != valveBaud);
  if ((unsigned long)bd != valveBaud) {
    valveBaud = (unsigned long)bd;
    valveSerialBegin(valveBaud);
  }
  bool tlChanged = ((int)tl != valveTorqueLimit);
  bool openChanged = ((int)op != valvePosOpen);
  valveId = (uint8_t)id;
  valvePosOpen = (int)op;
  valvePosClosed = (int)cl;
  valveSpeed = (int)sp;
  valveAcc = (int)ac;
  valveTorqueLimit = (int)tl;
  valveMaxCloseMs = (unsigned long)(mc * 1000.0f);
  valveTmpLimitBar = tmpL;
  valveFeedLimitBar = feedL;
  valveFeedBasis = (uint8_t)fb;

  if (idChanged || tlChanged) valveReqReinit = true;          // re-ping + write torque limit + move to open
  else if (openChanged && valveCmd == VALVE_CMD_OPEN) valveReqOpen = true;  // open position changed, follow it
  valveReqNotify = true;
  Monitor.print("[valve] config: "); Monitor.println(valveConfigString());
  return valveConfigString();
}

String valve_clear_fault(String arg) {
  valveFault = false;
  valveMsg[0] = '\0';
  valveInterlockHits = 0;
  valveReqNotify = true;
  Monitor.println("[valve] fault cleared");
  return "ok";
}

String valve_rescan(String arg) {
  valveReqReinit = true;
  return "ok";
}

// ===========================================================================
// 8.2 Shell sampling valve / feed valve (v4.1.0) - the other two servos on the same STS3215 bus
// ===========================================================================
// Three positions each (raw 0-4095 = 0-360 deg; defaults derived from angles, can be overridden after measuring in the web UI):
//   shell valve (ID 2): 0 closed  fully closed 315 deg(3584)  /  1 sensor  connected to pressure transmitter 270 deg(3072)  /  2 collect fully open 0 deg(0)
//   feed valve  (ID 3): 0 closed  fully closed 315 deg(3584)  /  1 base    base dosing 270 deg(3072)                       /  2 feed    outer feed 180 deg(2048)
// Shares Serial1 and the baud rate with the pinch valve; each avTick() call does at most one bus transaction (blocks at most VALVE_IO_TIMEOUT_MS),
// paused during pinch valve scan / blind move / loopback test. At boot: shell -> sensor (keep pressure monitoring), feed -> closed.
// Safety: when the feed valve leaves "base" or goes offline, the base pump stops immediately (basePumpTick).
const int AV_N = 2;
const int AV_SHELL = 0, AV_FEED = 1;
const int AV_POS_TOL = 40;                       // in-position tolerance (about 3.5 deg)
const char *AV_NAME[AV_N] = { "shell", "feed" };
const char *AV_STATE_NAME[AV_N][3] = { { "closed", "sensor", "collect" }, { "closed", "base", "feed" } };
const int AV_FEED_BASE_STATE = 1;

struct AuxValve {
  uint8_t id;
  int pos[3];
  int bootState;
  int speed, acc;
  bool online;
  int  fails;
  int  target;                 // -1 = not in any preset state (jog)
  int  present, goal, temp, load, moving;
  unsigned long lastPoll, lastScan, lastNotify;
  volatile int reqState, reqRaw, reqTorque;
  volatile bool reqReinit;
};

AuxValve av[AV_N] = {
  { 2, { 3584, 3072, 0 },    1, 1500, 50, false, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, -1, -1, -1, false },
  { 3, { 3584, 3072, 2048 }, 0, 1500, 50, false, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, -1, -1, -1, false },
};
int avNext = 0;
unsigned long avLastNotifyMs = 0;
volatile bool avReqNotify = false;

bool avAnyOnline() { for (int i = 0; i < AV_N; i++) if (av[i].online) return true; return false; }

// strict: check before base dosing (in position and stationary); non-strict: continuous check while running (online and target still base)
bool avFeedAtBase(bool strict) {
  AuxValve &v = av[AV_FEED];
  if (!v.online || v.target != AV_FEED_BASE_STATE || v.reqState >= 0 || v.reqRaw >= 0) return false;
  if (!strict) return true;
  return v.present >= 0 && abs(v.present - v.pos[AV_FEED_BASE_STATE]) <= AV_POS_TOL && !v.moving;
}

// v4.2.0: feed valve online and commanded "fully closed" -> the feed pump must not run (unknown / offline valve does not block)
bool avFeedClosed() {
  AuxValve &v = av[AV_FEED];
  return v.online && (v.target == 0 || v.reqState == 0);
}

String avOneString(int i) {
  AuxValve &v = av[i];
  int t = v.target;
  return String(AV_NAME[i]) + ":online=" + (v.online ? "1" : "0") + ",id=" + String((int)v.id) +
         ",state=" + (t >= 0 ? AV_STATE_NAME[i][t] : "jog") + ",target=" + String(t) +
         ",pos=" + String(v.present) + ",goal=" + String(v.goal) + ",moving=" + String(v.moving) +
         ",temp=" + String(v.temp) + ",load=" + String(v.load) +
         ",inpos=" + ((t >= 0 && v.present >= 0 && abs(v.present - v.pos[t]) <= AV_POS_TOL) ? "1" : "0");
}
String avStatusString() { return avOneString(AV_SHELL) + "|" + avOneString(AV_FEED); }
String avConfigString() {
  String s = "";
  for (int i = 0; i < AV_N; i++) {
    if (i) s += "|";
    s += String(AV_NAME[i]) + ":id=" + String((int)av[i].id) + ",p0=" + String(av[i].pos[0]) + ",p1=" + String(av[i].pos[1]) +
         ",p2=" + String(av[i].pos[2]) + ",speed=" + String(av[i].speed) + ",acc=" + String(av[i].acc);
  }
  return s;
}

void avNotifyNow() {
  avLastNotifyMs = millis();
  Bridge.notify("on_avalve_update", avStatusString());
}

// Takes the valve index, not an AuxValve&: the Arduino builder auto-generates prototypes
// above the struct definition, so a user type in the signature fails to compile.
bool avMove(int i, int pos) {
  AuxValve &v = av[i];
  pos = constrain(pos, 0, 4095);
  int r = sts.WritePosEx(v.id, (s16)pos, (u16)v.speed, (u8)v.acc);
  if (r <= 0) { v.fails++; return false; }
  v.goal = pos;
  v.fails = 0;
  return true;
}

void avGoOffline(int i, const char *why) {
  av[i].online = false;
  av[i].lastScan = millis();
  if (i == AV_FEED) basePumpStop("feed valve offline");
  Monitor.print("[avalve] "); Monitor.print(AV_NAME[i]); Monitor.print(" "); Monitor.print(why); Monitor.println(" -> offline");
  avReqNotify = true;
}

// Returns true = a bus transaction was done this call
bool avTickOne(int i, unsigned long now) {
  AuxValve &v = av[i];
  if (v.reqReinit) { v.reqReinit = false; v.online = false; v.lastScan = 0; }
  if (!v.online) {
    if (v.lastScan != 0 && now - v.lastScan < VALVE_RESCAN_MS) return false;
    v.lastScan = now;
    if (sts.Ping(v.id) == -1) return true;
    v.online = true;
    v.fails = 0;
    sts.EnableTorque(v.id, 1);
    int st = (v.target >= 0) ? v.target : v.bootState;
    if (i == AV_FEED && st == AV_FEED_BASE_STATE) st = 0;      // coming back online does not return to base by itself
    if (avMove(i, v.pos[st])) v.target = st;
    Monitor.print("[avalve] "); Monitor.print(AV_NAME[i]); Monitor.print(" ID "); Monitor.print((int)v.id);
    Monitor.print(" online -> "); Monitor.println(AV_STATE_NAME[i][st]);
    avReqNotify = true;
    return true;
  }
  if (v.reqState >= 0) {
    int st = v.reqState;
    if (i == AV_FEED && st != AV_FEED_BASE_STATE) basePumpStop("feed valve moved");
    if (avMove(i, v.pos[st])) { v.target = st; v.reqState = -1; v.moving = 1; }
    else if (v.fails >= VALVE_COMM_FAIL_LIMIT) { v.reqState = -1; avGoOffline(i, "move failed"); }
    avReqNotify = true;
    return true;
  }
  if (v.reqRaw >= 0) {
    int p = v.reqRaw;
    v.reqRaw = -1;
    if (i == AV_FEED) basePumpStop("feed valve jog");
    if (avMove(i, p)) { v.target = -1; v.moving = 1; }
    avReqNotify = true;
    return true;
  }
  if (v.reqTorque >= 0) {
    int on = v.reqTorque;
    v.reqTorque = -1;
    if (!on && i == AV_FEED) basePumpStop("feed valve torque off");
    sts.EnableTorque(v.id, on ? 1 : 0);
    if (!on) v.target = -1;                        // position no longer controlled after torque off
    avReqNotify = true;
    return true;
  }
  if (now - v.lastPoll >= VALVE_POLL_MS) {
    v.lastPoll = now;
    if (sts.FeedBack(v.id) != -1) {
      v.fails = 0;
      v.present = sts.ReadPos(-1);
      v.load    = sts.ReadLoad(-1);
      v.temp    = sts.ReadTemper(-1);
      v.moving  = sts.ReadMove(-1);
    } else if (++v.fails >= VALVE_COMM_FAIL_LIMIT) {
      avGoOffline(i, "not responding");
    }
    return true;
  }
  return false;
}

void avTick(unsigned long now) {
  if (valveScanning || valveReqLoopback || valveReqBlind >= 0) return;   // baud rate changes during scan / tests
  for (int k = 0; k < AV_N; k++) {                 // at most one transaction per call, the two servos take turns
    int i = avNext;
    avNext = (avNext + 1) % AV_N;
    if (avTickOne(i, now)) break;
  }
  if (avReqNotify || now - avLastNotifyMs >= VALVE_NOTIFY_MS) {
    avReqNotify = false;
    avNotifyNow();
  }
}

// arg "w,x": w = 0(shell) / 1(feed)
bool avParse2(const String &arg, int &w, long &x) {
  int c = arg.indexOf(',');
  if (c < 0) return false;
  w = arg.substring(0, c).toInt();
  x = arg.substring(c + 1).toInt();
  return w >= 0 && w < AV_N;
}
String av_set(String arg) {
  int w; long st;
  if (!avParse2(arg, w, st) || st < 0 || st > 2) return "rejected:arg w(0|1),state(0-2)";
  if (!av[w].online) return "rejected:servo offline";
  if (valveScanning) return "rejected:scan running";
  av[w].reqRaw = -1;
  av[w].reqState = (int)st;
  return String("ok,") + AV_NAME[w] + "=" + AV_STATE_NAME[w][st];
}
String av_goto_raw(String arg) {
  int w; long p;
  if (!avParse2(arg, w, p) || p < 0 || p > 4095) return "rejected:arg w(0|1),pos(0-4095)";
  if (!av[w].online) return "rejected:servo offline";
  av[w].reqState = -1;
  av[w].reqRaw = (int)p;
  return "ok";
}
String av_torque(String arg) {
  int w; long on;
  if (!avParse2(arg, w, on)) return "rejected:arg w(0|1),on(0|1)";
  if (!av[w].online) return "rejected:servo offline";
  av[w].reqTorque = on ? 1 : 0;
  return "ok";
}
String av_get_status(String arg) { return avStatusString(); }
String av_get_config(String arg) { return avConfigString(); }
String av_set_config(String arg) {
  float x;
  if (!kvGet(arg, "w", x) || x < 0 || x >= AV_N) return "rejected:w 0|1";
  int w = (int)x;
  AuxValve &v = av[w];
  float id = v.id, p0 = v.pos[0], p1 = v.pos[1], p2 = v.pos[2], sp = v.speed, ac = v.acc;
  if (kvGet(arg, "id", x)) id = x;
  if (kvGet(arg, "p0", x)) p0 = x;
  if (kvGet(arg, "p1", x)) p1 = x;
  if (kvGet(arg, "p2", x)) p2 = x;
  if (kvGet(arg, "speed", x)) sp = x;
  if (kvGet(arg, "acc", x)) ac = x;
  if (!(id >= 0 && id <= 253)) return "rejected:id 0-253";
  if (!(p0 >= 0 && p0 <= 4095 && p1 >= 0 && p1 <= 4095 && p2 >= 0 && p2 <= 4095)) return "rejected:positions 0-4095";
  if (!(sp >= 0 && sp <= 4000)) return "rejected:speed 0-4000";
  if (!(ac >= 0 && ac <= 254)) return "rejected:acc 0-254";
  if ((uint8_t)id == valveId || (uint8_t)id == av[1 - w].id) return "rejected:id already used by another valve";
  bool idChanged = (uint8_t)id != v.id;
  int oldTarget = v.target;
  bool posChanged = oldTarget >= 0 && (int)(oldTarget == 0 ? p0 : (oldTarget == 1 ? p1 : p2)) != v.pos[oldTarget];
  if (w == AV_FEED && (idChanged || (posChanged && oldTarget == AV_FEED_BASE_STATE))) basePumpStop("feed valve config");
  v.id = (uint8_t)id;
  v.pos[0] = (int)p0; v.pos[1] = (int)p1; v.pos[2] = (int)p2;
  v.speed = (int)sp; v.acc = (int)ac;
  if (idChanged) v.reqReinit = true;
  else if (posChanged && v.online) v.reqState = oldTarget;          // position of the current state changed: follow it
  avReqNotify = true;
  Monitor.print("[avalve] config: "); Monitor.println(avConfigString());
  return avConfigString();
}

// Change the ID in the servo EEPROM. New STS3215s all ship as ID 1 (same as the pinch valve); must be changed with "only this one servo on the bus".
String servo_set_id(String arg) {
  int c = arg.indexOf(',');
  if (c < 0) return "rejected:arg old,new";
  long oldId = arg.substring(0, c).toInt(), newId = arg.substring(c + 1).toInt();
  if (oldId < 0 || oldId > 253 || newId < 0 || newId > 253 || oldId == newId) return "rejected:id 0-253, old != new";
  if (valveScanning) return "rejected:scan running";
  if (valveOnline && valveCmd != VALVE_CMD_OPEN) return "rejected:pinch valve must be open";
  if (baseOn || feedRunPwm > 0) return "rejected:feed pump running";
  if (sts.Ping((uint8_t)oldId) != oldId) return "rejected:no servo answers at old id";
  if (sts.Ping((uint8_t)newId) != -1) return "rejected:new id already in use";
  sts.unLockEprom((uint8_t)oldId);
  int r = sts.writeByte((uint8_t)oldId, SMS_STS_ID, (uint8_t)newId);
  sts.LockEprom((uint8_t)newId);
  pressureTick(millis());
  bool ok = (r > 0) && (sts.Ping((uint8_t)newId) == newId);
  Monitor.print("[servo] set id "); Monitor.print(oldId); Monitor.print(" -> "); Monitor.print(newId);
  Monitor.println(ok ? " OK" : " FAILED");
  valveOnline = false; valveLastScanMs = 0;                       // re-ping all three
  for (int i = 0; i < AV_N; i++) av[i].reqReinit = true;
  return ok ? String("ok,") + String(newId) : String("failed");
}

// ===========================================================================
// 9. setup / loop
// ===========================================================================
bool bootBannerPrinted = false;

String rpc_wd_set(String arg) {         // kept for older Python callers; auto-restart is permanently disabled
  rpcMark();
  float v;
  if (kvGet(arg, "en", v))  rpcWdEnabled = false;
  if (kvGet(arg, "sec", v)) rpcWdSec = (unsigned long)constrain((long)v, 20L, 3600L);
  return String("en=0,sec=") + String(rpcWdSec) + ",seen=" + (rpcEverSeen ? "1" : "0") + ",calls=" + String(rpcCountTotal);
}
String rpc_test_block(String arg) {      // test: treat calls received within N seconds as not received
  long sec = constrain(arg.toInt(), 0L, 600L);
  rpcTestBlockUntil = sec > 0 ? millis() + (unsigned long)sec * 1000UL : 0;
  Monitor.print("[rpc] test: for the next "); Monitor.print(sec); Monitor.println(" s simulating no Python calls");
  return String("block=") + String(sec);
}

// Bridge functions are always registered at the very start of setup() (on a new board without sensors, I2C/pinch valve init can take a long time)
void registerBridgeFunctions() {
  Bridge.provide_safe("get_diag", get_diag);
  Bridge.provide_safe("get_config", get_config);
  Bridge.provide_safe("set_config", set_config);
  Bridge.provide_safe("set_pressure_offsets", set_pressure_offsets);
  Bridge.provide_safe("get_pressure_offsets", get_pressure_offsets);
  Bridge.provide_safe("set_pump_pwm", set_pump_pwm);
  Bridge.provide_safe("set_pump_direction", set_pump_direction);
  Bridge.provide_safe("stop_pump", stop_pump);
  Bridge.provide_safe("get_pump_status", get_pump_status);
  Bridge.provide_safe("get_pump_kick", get_pump_kick);
  Bridge.provide_safe("set_pump_kick", set_pump_kick);
  Bridge.provide_safe("trigger_measurement", trigger_measurement);
  Bridge.provide_safe("get_last_raw", get_last_raw);
  Bridge.provide_safe("set_dev_mode", set_dev_mode);
  Bridge.provide_safe("get_dev_readings", get_dev_readings);
  Bridge.provide_safe("reinit_sensors", reinit_sensors);
  Monitor.println("[boot] step: core Bridge functions registered");
  Bridge.provide_safe("valve_open", valve_open);
  Bridge.provide_safe("valve_close", valve_close);
  Bridge.provide_safe("valve_goto_raw", valve_goto_raw);
  Bridge.provide_safe("valve_torque", valve_torque);
  Bridge.provide_safe("valve_get_status", valve_get_status);
  Bridge.provide_safe("valve_get_config", valve_get_config);
  Bridge.provide_safe("valve_set_config", valve_set_config);
  Bridge.provide_safe("valve_clear_fault", valve_clear_fault);
  Bridge.provide_safe("valve_rescan", valve_rescan);
  Bridge.provide_safe("valve_scan", valve_scan);
  Bridge.provide_safe("valve_scan_status", valve_scan_status);
  Bridge.provide_safe("valve_blind_move", valve_blind_move);
  Bridge.provide_safe("valve_loopback", valve_loopback);
  Bridge.provide_safe("valve_loopback_status", valve_loopback_status);
  // v4.1.0: pressure protection, base pump, shell valve / feed valve
  Bridge.provide_safe("get_pressure_protect", get_pressure_protect);
  Bridge.provide_safe("set_pressure_protect", set_pressure_protect);
  Bridge.provide_safe("pressure_trip_clear", pressure_trip_clear);
  Bridge.provide_safe("base_pump_pulse", base_pump_pulse);
  Bridge.provide_safe("base_pump_stop", base_pump_stop);
  Bridge.provide_safe("get_base_status", get_base_status);
  Bridge.provide_safe("set_base_config", set_base_config);
  Bridge.provide_safe("set_feed_pump", set_feed_pump);           // v4.2.0
  Bridge.provide_safe("chb_pin_test", chb_pin_test);             // v4.2.1
  Bridge.provide_safe("av_set", av_set);
  Bridge.provide_safe("av_goto_raw", av_goto_raw);
  Bridge.provide_safe("av_torque", av_torque);
  Bridge.provide_safe("av_get_status", av_get_status);
  Bridge.provide_safe("av_get_config", av_get_config);
  Bridge.provide_safe("av_set_config", av_set_config);
  Bridge.provide_safe("servo_set_id", servo_set_id);
#if PH_USE_DS18B20
  Bridge.provide_safe("ds_diag", ds_diag);
  Bridge.provide_safe("ds_timing", ds_timing);
#endif
  Bridge.provide_safe("rpc_wd_set", rpc_wd_set);
  Bridge.provide_safe("rpc_test_block", rpc_test_block);
  Monitor.println("[boot] step: valve / ds18b20 Bridge functions registered");
}

void setup() {
  // First thing: before touching Bridge, lock the pump pins at "stop" (so L298N inputs do not float if external power comes up first)
  pinMode(PUMP_ENA_PIN, OUTPUT); digitalWrite(PUMP_ENA_PIN, LOW);
  pinMode(PUMP_IN1_PIN, OUTPUT); digitalWrite(PUMP_IN1_PIN, LOW);
  pinMode(PUMP_IN2_PIN, OUTPUT); digitalWrite(PUMP_IN2_PIN, LOW);
  pinMode(BASE_ENB_PIN, OUTPUT); digitalWrite(BASE_ENB_PIN, LOW);   // v4.1.0: base pump (same approach as ENA)
  pinMode(BASE_IN3_PIN, OUTPUT); digitalWrite(BASE_IN3_PIN, LOW);
  pinMode(BASE_IN4_PIN, OUTPUT); digitalWrite(BASE_IN4_PIN, LOW);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Boot diagnostic LED (built-in LED, active LOW): 2 fast blinks -> solid on (waiting for Bridge) -> off then 3 blinks (init complete)
  pinMode(LED_BUILTIN, OUTPUT);
  for (int i = 0; i < 2; i++) { digitalWrite(LED_BUILTIN, LOW); delay(80); digitalWrite(LED_BUILTIN, HIGH); delay(80); }
  digitalWrite(LED_BUILTIN, LOW);

  bool bridgeOk = Bridge.begin();   // do not call Serial.begin() (see v3.2 notes)
  Monitor.begin();
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);

  Monitor.println();
  Monitor.print("[boot] ReLeaf sketch " FW_VERSION " (raw acquisition) starting, Bridge.begin=");
  Monitor.println(bridgeOk ? "OK" : "FAILED");
  registerBridgeFunctions();
  Monitor.print("[boot] t="); Monitor.print(millis()); Monitor.println(" ms: Bridge functions registered, initializing sensors");

  analogReadResolution(ADC_BITS);

  // ---- OD600 ----
  bootStage = "i2c_scan";
  Wire.begin();
  {
    unsigned long dtS = 0, dtR = 0;
    String st = i2cProbe(SAMPLE_ADDR, dtS);
    strncpy(i2cStatusS, st.c_str(), sizeof(i2cStatusS) - 1);
    st = i2cProbe(REF_ADDR, dtR);
    strncpy(i2cStatusR, st.c_str(), sizeof(i2cStatusR) - 1);
    Monitor.print("[boot]   sample    0x5C: "); Monitor.print(i2cStatusS); Monitor.print(" ("); Monitor.print(dtS); Monitor.println(" ms)");
    Monitor.print("[boot]   reference 0x23: "); Monitor.print(i2cStatusR); Monitor.print(" ("); Monitor.print(dtR); Monitor.println(" ms)");
  }
  bootStage = "sensor_init";
  bool busDead = (strcmp(i2cStatusS, "timeout") == 0) || (strcmp(i2cStatusR, "timeout") == 0);
  bool okS = false, okR = false;
  if (!busDead) {
    if (strcmp(i2cStatusS, "ok") == 0) okS = chS.dev.powerOn();
    if (strcmp(i2cStatusR, "ok") == 0) okR = chR.dev.powerOn();
    delay(10);
    if (okS) okS = chS.dev.configure();
    if (okR) okR = chR.dev.configure();
    delay(2 * SAMPLE_PERIOD_MS);
  }
  chS.inited = okS;
  chR.inited = okR;
  riLastAutoMs = millis();
  Monitor.print("[boot] BH1750 (MTreg "); Monitor.print(FIXED_MT); Monitor.print(FIXED_H2 ? ", H-res mode 2" : ", H-res mode 1");
  Monitor.print(") sample="); Monitor.print(okS ? "OK" : "FAILED"); Monitor.print(" reference="); Monitor.println(okR ? "OK" : "FAILED");
  lastMeasMillis = millis();
  lastMeasStartMs = millis();

  // ---- Flow meter ----
  bootStage = "flow";
  pinMode(FLOW_SENSOR_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), handlePulse, RISING);
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN, LOW); delay(150);
    digitalWrite(LED_BUILTIN, HIGH); delay(150);
  }
  lastFlowUpdateMs = millis();

  // ---- Pressure ----
  pNextSampleMs = millis();

  // ---- Pumps ----
  setPumpDirection(true);
  setPumpSpeed(0);
  baseOutput(false);
  baseHourStart = millis();

#if ENABLE_PH && PH_USE_DS18B20
  dsState = 0;
  Monitor.println("[boot] DS18B20 (D4): searched in loop() 5 s after boot");
#endif

  // ---- Pinch valve ----
#if ENABLE_VALVE
  bootStage = "valve";
  valveSerialBegin(valveBaud);
  if (sts.Ping(valveId) != -1) {
    valveOnline = true;
    valveInitOnline();                 // always moves to "open" at boot (fail-safe)
  } else {
    Monitor.print("[boot] valve servo ID "); Monitor.print((int)valveId);
    Monitor.println(" not found, will retry every 2 s");
  }
  valveLastScanMs = millis();
  // v4.1.0: shell valve / feed valve - first ping is done in avTick() in loop() (does not block setup)
  for (int i = 0; i < AV_N; i++) av[i].lastScan = 0;
#endif

  bootStage = "ready";
  lastDiagMs = millis();
  Monitor.println("[boot] ready (raw acquisition: on_p_raw / on_flow_raw / on_od_raw / on_aux_raw)");
}

void loop() {
  if (!bootBannerPrinted) {
    Monitor.println("[boot] entering loop() - Monitor link confirmed alive.");
    bootBannerPrinted = true;
  }
  unsigned long loopStartUs = micros();
  unsigned long now = millis();

  pumpTick(now);
  if (now - lastFlowUpdateMs >= FLOW_UPDATE_INTERVAL_MS) update_flow();
  pressureTick(now);
  odTick();
  reinitTick();
  pressureTick(millis());          // OD I2C read takes about 0.3 ms, check the pressure schedule once more
  auxTick(now);
#if ENABLE_VALVE
  valveTick(now);
  pressureTick(millis());          // v4.1.0: the pinch valve and the other two servos can each block 15 ms, sample once more in between
  avTick(millis());
#endif
  basePumpTick(millis());
  feedRunTick();                         // v4.2.0

  unsigned long loopUs = micros() - loopStartUs;
  if (loopUs > loopMaxUs) loopMaxUs = loopUs;
  diagTick(now);
}
