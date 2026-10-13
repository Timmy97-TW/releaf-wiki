/*
  ============================================================================
  整合版 MCU Sketch — OD600 + 流量 + 壓力 + 幫浦PWM + pH監測 + 夾閥(STS3215)
  (Arduino UNO Q / STM32U585 + Zephyr, App Lab)
  ============================================================================
  合併來源:
    1. OD600 光度計 (BH1750 ×2 + 脈衝LED, 原 sketch.ino)
    2. ZJ-TM02 流量計讀取 (中斷計數, D2)
    3. 中空纖維薄膜過濾 - 壓力讀取 (類比 A0/A1/A2, 含歸零校正)
    4. 蠕動幫浦 PWM 控制 (L298N)
    5. 【v3 新增】pH 監測 (原 ph_control_koh.ino; v3.1 起只監測記錄, 加鹼控制已移除)
    6. 【v3 新增】STS3215 匯流排伺服夾閥 (原 STS3215test), 夾住 retentate 管提高 TMP 收樣本

  === v3.1 (2026-10-03) ===
  - 換了蠕動幫浦: 移除「PWM 1~99 自動歸零」的無效區間夾制, 0-255 直接輸出。
  - 拿掉 KOH 加鹼控制, pH 只監測 + 校正 + 推播給 Linux 端記錄。D7 不再使用。

  === v3 (2026-10-02) 整合重點 ===
  - pH 腳位搬家: 原本 A0(pH) 已被壓力 Feed 佔用, 改成 pH 訊號 -> A4 (README §2.1)。
  - ADC 解析度統一: analogReadResolution() 是全域設定, 原 pH 程式設 14-bit、
    壓力程式假設 10-bit(ADC_MAX=1023)。現在兩邊共用 ADC_BITS, 壓力換算自動跟著變,
    壓力零點 offset 的單位是 bar, 不受解析度影響, 存檔的值照樣可用。
  - pH 取樣改成非阻塞: 原本一次 256 筆 analogRead 一口氣讀完, 現在每圈 loop()
    只讀 PH_CHUNK 筆, 分幾圈湊滿, 不吃掉壓力 100Hz 的時間片。
  - 原 pH 程式的 Serial 指令改成 Bridge 函式(網頁操作), 每秒 Bridge.notify 一次狀態。
  - 夾閥只做手動開/關; MCU 端有三道自動放開保護, 不依賴 Linux:
      (a) TMP 瞬時峰值或 Feed 峰值超過上限 (每 200ms 檢查, 連續 2 次)
      (b) 夾閉時間超過 valveMaxCloseMs
      (c) 伺服溫度過高 / 夾閉中通訊中斷
    任一觸發 -> 放開並鎖存 FAULT, 須在網頁按「解除」才能再夾。
  - 幫浦「緊急停止」也會一併放開夾閥。
  - 伺服匯流排 I/O 只在 loop() 裡做, Bridge 函式只設請求旗標。

  === 本版最重要的改動: OD600 量測改成「非阻塞狀態機」 ===
  原本的 OD600 sketch 用 delay(SAMPLE_PERIOD_MS) 在 doMeasurement() 裡面把
  dark frame(4筆) + lit burst(16筆) 一路跑完, 單次量測會把 loop() 卡住約
  (4+16) × 130ms + LED warmup ≈ 2.7 秒(遇到重試會到 5 秒以上)。
  在只有 OD600 的專案裡這無所謂, 但合併進來之後, 這段期間:
    - 壓力的 100Hz 滑動視窗會整整少掉 2-3 秒的取樣, peak/trough/mean 統計
      會被截斷, collapse pressure 保護與 TMP 轉負偵測都會出現盲區;
    - update_flow() 的 1 秒節拍會被拉長, 換算出來的瞬時流量(脈衝數/實際經過
      秒數)雖然還是對的, 但推播節奏會抖動;
    - Bridge/Monitor 的服務也會延遲, 幫浦「緊急停止」指令可能要等 2-3 秒
      才被處理 —— 這是安全問題, 不只是資料品質問題。
  所以這一版把 OD600 量測拆成 loop() 裡用 millis() 排程的狀態機
  (OD_IDLE → OD_DARK → OD_WARMUP → OD_LIT → 統計/重試 → OD_IDLE),
  每次 loop() 只做「時間到就讀一筆 I2C(約0.3ms)」, 不再有任何長時間 delay()。
  量測邏輯(暗電流扣除、MAD氣泡剔除、重試、log10 計算)與原版完全相同,
  只是把「一次跑完」改成「分次跑」。

  腳位分配(彼此不衝突, 可同時執行):
    - OD600 LED         : D3   (低邊 NPN 開關, 見 README §1.2a)
    - OD600 感測器      : I2C  (sample 0x5C / reference 0x23)
    - 流量感測器訊號    : D2   (需支援中斷)
    - 壓力感測器        : A0(Feed) / A1(Retentate) / A2(Permeate)
    - 幫浦控制          : D9(ENA, PWM) / D5(IN1) / D6(IN2)
    - pH 探頭訊號       : A4  (DFRobot SEN0169-V2, 建議經類比隔離模組)
    - DS18B20 溫度      : D8  (v3.8 預設啟用; DQ 接 4.7kΩ 上拉到 3.3V; 讀不到時自動改用手動溫度)
    - STS3215 夾閥      : D0/D1 = Serial1, 1 Mbps, 經 Waveshare Serial Bus Servo Driver Board
                          (跳線帽在 A = UART 模式; 依 Waveshare 標示 RX->RX、TX->TX 不交叉; 共地)

  需要安裝的 Sketch Library:
    - Arduino_RouterBridge (App Lab 左側 Add sketch library 搜尋安裝)
    - SCServo (1.0.2)      (STS3215, 已寫在 sketch/sketch.yaml)
    - BH1750 不需要安裝, 驅動已內嵌(見 README §2.4)
    - DS18B20 不需要安裝函式庫, 1-Wire 驅動已內嵌(v3.8.1; 若要完全停用, 把 PH_USE_DS18B20 改成 0)

  對外提供 (Bridge.provide, 給 Linux/Python 端呼叫, 一律 String → String):
    --- 流量 ---
    get_flow_data()            -> "頻率Hz,瞬時流量mL/min,累積流量mL"
    --- 壓力 ---
    zero_calibrate()           -> 壓力三通道歸零校正(void)
    --- 幫浦 ---
    set_pump_pwm(pwm)          -> 設定幫浦PWM (0-255), 回傳實際PWM
    set_pump_direction(dir)    -> "1"=正轉 / "0"=反轉
    stop_pump()                -> 立即停止(PWM歸零)
    get_pump_status()          -> "PWM,方向(1/0)"
    --- OD600 ---
    get_od_data()              -> "od600,lux_sample,lux_ref,bubble_pct,valid,
                                   blank_set,meas_seq,age_ms,busy"
    get_blank_info()           -> "blank_set,blank_lux_sample,blank_lux_ref,blank_ratio"
    calibrate_blank()          -> 排入一次量測, 完成後把該次讀值設為 blank(I0)
                                  回傳 "queued" 或 "busy"
    trigger_measurement()      -> 排入一次立即量測, 回傳 "queued" 或 "busy"
    set_dev_mode(on)           -> "1"/"0", 開發者模式(LED恆亮, 暫停自動量測)
    get_dev_readings()         -> "dev_mode(1/0),lux_sample,lux_ref" (即時未濾波)
    set_measure_interval_sec(s)-> 設定OD600自動量測間隔, 回傳實際值或 "rejected"
    get_measure_interval_sec() -> 目前間隔(秒)
    set_path_length_factor(f)  -> 設定光程長校正係數, 回傳實際值或 "rejected"
    get_path_length_factor()   -> 目前係數
    --- 校正值手動設定 / 讀回 (MCU 重開後用來還原, 見 README §9) ---
    set_blank_manual(a)        -> "blank_ratio,blank_lux_sample,blank_lux_ref"
                                  直接指定 OD600 空白基準, 不用真的再量一次
    clear_blank()              -> 清除空白基準, 回到未校正狀態
    set_pressure_offsets(a)    -> "feed,retentate,permeate" (bar) 直接指定壓力零點偏移
    get_pressure_offsets()     -> "feed,retentate,permeate" 讀回目前的零點偏移
    --- 即時性診斷 ---
    get_diag()                 -> "loop_max_us,pressure_samples_last_sec,od_state,reinit_step,uptime_ms"
                                  loop_max_us: 上一秒內最長的一次 loop() 耗時(微秒)
                                  pressure_samples_last_sec: 上一秒實際完成的壓力取樣筆數
                                  (100Hz 應接近 100, 明顯偏低就代表 loop() 被卡住了)

    --- 演算法切換 (v3.7) ---
    get_algorithms()           -> "flow=gate|reciprocal,od=mad|qn|biweight|upper"
    set_algorithms(kv)         -> "flow=0|1,od=0..3"(只改有給的 key), 回傳 get_algorithms()
    --- pH 監測 (v3.1, 全部 key=value 逗號分隔) ---
    get_ph_status()            -> "ph=..,v=..,t=..,state=WARMUP|OK|PROBE_ERROR"
    get_ph_config()            -> "v7=..,v4=..,cal_temp=..,temp=..,temp_src=manual|ds18b20"
    set_ph_config(kv)          -> 接受 v7 / v4 / cal_temp / temp(手動溫度), 回傳 get_ph_config() 或 "rejected:<原因>"
    ph_calibrate(point)        -> "7" 或 "4", 可加 ",標準液溫度": 以目前電壓當校正點, 回傳電壓
    --- 夾閥 STS3215 (v3) ---
    valve_open() / valve_close()  -> "ok" 或 "rejected:<原因>"
    valve_goto_raw(pos)        -> 設定用: 直接走到原始位置 0~4095
    valve_torque(on)           -> "1"/"0", 關扭力後可用手轉動找位置
    valve_get_status()         -> "online=..,cmd=..,fault=..,pos=..,goal=..,load=..,temp=..,volt=..,
                                   cur=..,moving=..,closed_ms=..,torque=..,configured=..,msg=.."
    valve_get_config() / valve_set_config(kv)
                               -> "id=..,open=..,closed=..,speed=..,acc=..,torque_limit=..,
                                   max_close_s=..,tmp_limit=..,feed_limit=.."
    valve_clear_fault()        -> 解除夾閥 FAULT
    valve_rescan()             -> 重新 ping 伺服
    valve_scan(mode)           -> v3.4 自動掃描: "full"(8 種鮑率 x ID 0-253, 約 30 秒) 或 "quick"(只廣播 ping)
    valve_scan_status()        -> "state=idle|running|done,progress=%,baud=..,found=ID@baud;..,rx=baud:bytes;.."
    valve_blind_move(pos)      -> v3.5 盲送: 用廣播 ID 在 8 種鮑率各送一次移動指令(不需回應), 判斷 TX/電源是否正常

  主動推送 (Bridge.notify, MCU -> Linux/Python):
    on_ph_update(payload)        每秒一次, 內容同 get_ph_status()
    on_valve_update(payload)     每秒一次 + 狀態改變時立即, 內容同 valve_get_status()
    on_pressure_update(payload)  每 PRESSURE_WINDOW_UPDATE_MS (預設200ms) 一次
      payload: "feed_peak,feed_trough,feed_mean_raw,feed_cycle_hz,
                retentate_...(4個), permeate_...(4個)"  共12個值
    on_od600_update(payload)     每完成一次OD600量測時推一次
      payload: "od600,lux_sample,lux_ref,bubble_pct,valid,blank_set,meas_seq"

  監看方式:
    - App Lab Console 看不到 Serial.println(), 請用 Monitor.println()
  ============================================================================
*/

#include <Wire.h>
#include <Arduino_RouterBridge.h>
#include <SCServo.h>
#include <math.h>
#include <string.h>

// DS18B20 溫度感測器(v3.8 預設啟用, D8)。沒接也能跑: 找不到感測器時自動用網頁手動輸入的溫度。
// 放在檔案最上面是故意的: Arduino builder 會在「最後一個 #include」後面插入自動產生的
// 函式原型, include 散落在檔案中間容易讓原型插到奇怪的位置。
#define PH_USE_DS18B20 1

// 韌體版本: get_diag() 第 6 欄會帶這個字串, 網頁狀態列會顯示。看到它就代表「新的 sketch
// 真的有在 MCU 上跑」—— 排錯第一步就是確認這件事。
#define FW_VERSION "v3.10.9"

// 功能開關(排錯用): 改成 0 就整段不初始化、不執行, 可以逐一排除是哪個子系統出問題。
#ifndef ENABLE_PH
#define ENABLE_PH     1
#endif
#ifndef ENABLE_VALVE
#define ENABLE_VALVE  1
#endif

// 跨區段呼叫的函式先宣告(壓力區在前、夾閥區在後)
void pumpStallCheck(unsigned long pulses);   // v3.10.0
// v3.10.5: 統計 Python 呼叫 MCU 的次數。Serial Monitor 每 30 秒印一次;
// 若 Python 原本有在呼叫、之後整整 30 秒都沒收到, 代表「Linux → MCU」的指令通道斷了
// (MCU 自己的資料仍會照常推送, 所以壓力等數值看起來正常)。
volatile unsigned long rpcCountTotal = 0;
unsigned long rpcCountWindowStart = 0, rpcLastLogMs = 0, rpcLastSeenMs = 0;
bool rpcEverSeen = false, rpcWarned = false;
// v3.10.6 → v3.10.7: 指令通道 watchdog
//   v3.10.6 曾在逾時後用 SYSRESETREQ 自動重開 MCU; 實機測試(2026-10-08)重開後 MCU 再也沒有接回 Bridge
//   (沒有新的 [boot], 壓力推送也停止), 必須人工停止 App/斷電才能恢復 —— 比不重開更糟, 因此移除。
//   現在只保留偵測與警告(Serial Monitor 的 [rpc] 行)。
//   Python 原本有在呼叫(rpcEverSeen), 之後連續 rpcWdSec 秒沒收到任何呼叫 → MCU 自己重新開機,
//   重新跟 Linux 端建立 Bridge 連線; 重開後由 Python 推回校正值並恢復幫浦。
//   重開後要等 Python 再次呼叫才會重新武裝, 所以通道若仍不通, 不會反覆重開。
//   Python 會依「最近一小時重開次數」用 rpc_wd_set 開關此功能(每小時最多 2 次)。
bool rpcWdEnabled = false;                    // v3.10.7: 實測 UNO Q 軟體重開後 MCU 不會自己接回 Bridge → 永久停用自動重開
unsigned long rpcWdSec = 60;
unsigned long rpcTestBlockUntil = 0;          // 測試用: 這段時間內把收到的呼叫當作沒收到
inline void rpcMark() {
  rpcCountTotal++;
  if (rpcTestBlockUntil && (long)(millis() - rpcTestBlockUntil) < 0) return;
  rpcTestBlockUntil = 0;
  rpcLastSeenMs = millis(); rpcEverSeen = true;
}
bool kvGet(const String &s, const char *key, float &out);
void valveInterlockCheck(float tmpPeakBar, float feedPeakBar, float feedMeanBar);
void valveRequestOpen(const char *why, bool latchFault);

// ---------------------------------------------------------------------------
// 全域 ADC 解析度 (v3)
// analogReadResolution() 會影響「所有」類比腳位, 壓力與 pH 必須用同一個值。
// STM32U585 的 ADC1 是 14-bit; 若實測讀值看起來只有 12-bit 的級距, 核心是把
// 12-bit 結果左移, 數值仍然正確, 只是解析度沒有變好。
// ---------------------------------------------------------------------------
const int   ADC_BITS = 14;

// ---------------------------------------------------------------------------
// Linker workaround: libm 的 log10f() 內部會呼叫 __errno(), 但 UNO Q 的
// Zephyr/newlib-nano 最小 libc 沒有提供, 會出現 "undefined reference to `__errno'"。
// 本 sketch 從不讀 errno, 補一個空殼即可(見 README §2.5)。
// ---------------------------------------------------------------------------
extern "C" int *__errno(void) {
  static int od600_dummy_errno = 0;
  return &od600_dummy_errno;
}

// 即時性診斷計數器(統計與輸出在第六節)。宣告在這裡是因為壓力取樣函式會用到，
// 而那段程式碼在診斷區之前。
unsigned long pressureSamplesThisSec = 0;

// 把 "a,b,c" 這種逗號分隔字串拆成浮點數陣列, 回傳實際拆出幾個。
// Bridge 的介面全部是 String, 手動輸入校正值的幾個函式都用得到。
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

// ===========================================================================
// 一、OD600 光度計
// ===========================================================================

// ---- 內嵌 BH1750 (GY-302) 驅動: 連續高解析模式, 不需外部函式庫 ----
//
// !! 這裡是 2026-09-01 修掉的「壓力/流速在 OD600 取樣期間停擺」的元凶 !!
// 舊版的 readLightLevel() 長這樣:
//     if (requestFrom(addr,2) != 2) return -1;
//     while (available() < 2) { if (millis()-start > 200) return -1; }   // <-- 忙等 200ms
// requestFrom() 在 Wire 的同步實作裡「回來的時候整筆傳輸就已經做完了」,
// 所以那個 while 迴圈在正常情況下一次都不會轉; 但只要感測器有一次沒正常回應,
// 這裡就會原地空轉最多 200ms。一次 OD600 量測是 20 筆 × 2 顆感測器,
// 最壞情況等於把 loop() 卡死 8 秒 —— 期間壓力的 100Hz 取樣、流量的 1 秒節拍、
// 甚至幫浦的緊急停止指令全部停擺。狀態機做得再漂亮, 底層讀取是阻塞的就沒有用。
//
// 現在: requestFrom() 已經回報成功卻還是湊不滿 2 bytes 是硬體異常, 不是「再等一下
// 就會好」的情況, 所以上限縮到 3ms(2 bytes @100kHz 只需要不到 1ms), 逾時就當作
// 這一筆讀取失敗回傳 -1。上層本來就有完整的 I2C 失效偵測 + 重新初始化機制在處理
// 這種狀況(見 odFinishAttempt), 不需要在這裡空等。
const unsigned long I2C_READ_TIMEOUT_MS = 3;

class BH1750Simple {
  public:
    explicit BH1750Simple(uint8_t addr) : _addr(addr) {}

    // 拆成兩個單獨的動作, 讓「重新初始化」可以做成非阻塞的分段流程
    // (見下方 reinitTick(); 舊版直接在量測流程裡呼叫 begin(), 那裡面的
    //  delay(10)+delay(180) 一次就會卡住 loop() 190ms, 兩顆就是 380ms)。
    bool powerOn(TwoWire &wire = Wire) {
      _wire = &wire;
      _wire->beginTransmission(_addr);
      _wire->write(0x01);                 // Power On
      return _wire->endTransmission() == 0;
    }

    bool setContinuousHRes() {
      _wire->beginTransmission(_addr);
      _wire->write(0x10);                 // Continuous H-Resolution Mode
      return _wire->endTransmission() == 0;
    }

    // 阻塞版, 只給 setup() 用(開機時卡幾百毫秒沒關係, 那時還沒有東西在跑)
    bool begin(TwoWire &wire = Wire) {
      if (!powerOn(wire)) return false;
      delay(10);
      if (!setContinuousHRes()) return false;
      delay(180);                          // 等第一次轉換完成
      return true;
    }

    float readLightLevel() {
      if (_wire->requestFrom((int)_addr, 2) != 2) return -1.0f;
      unsigned long start = millis();
      while (_wire->available() < 2) {
        if (millis() - start > I2C_READ_TIMEOUT_MS) return -1.0f;
      }
      uint16_t raw = (uint16_t)_wire->read() << 8;
      raw |= _wire->read();
      return raw / 1.2f;
    }

  private:
    uint8_t  _addr;
    TwoWire *_wire = &Wire;
};

const uint8_t LED_PIN     = 3;     // D3 -> 1.2k -> 2N2222 Base (低邊開關)
const uint8_t SAMPLE_ADDR = 0x5C;  // GY-302 #1 (sample)    ADDR -> 3V3
const uint8_t REF_ADDR    = 0x23;  // GY-302 #2 (reference) ADDR -> GND

BH1750Simple sampleSensor(SAMPLE_ADDR);
BH1750Simple refSensor(REF_ADDR);

// ---- 量測參數(與原 OD600 sketch 相同) ----
const uint8_t  N_SAMPLES        = 16;   // 每次亮燈burst的取樣數(每通道)
const uint8_t  N_DARK_SAMPLES   = 4;    // 每次暗電流(LED關)取樣數
const uint16_t SAMPLE_PERIOD_MS = 130;  // >= BH1750 連續模式更新週期(~120ms)
const uint16_t LED_WARMUP_MS    = 60;   // LED點亮後的穩定時間
const uint8_t  WARMUP_DISCARD   = 2;    // 丟掉burst前N筆(光學/電氣穩定)
const float    MAD_K            = 3.0f; // 離群值閘門 = median ± K*MAD (氣泡剔除)
const float    REJECT_RETRY_PCT = 50.0f;// 拒收率>50%就重試一次
const uint8_t  MAX_RETRIES      = 1;

// 自動量測節奏(非const, 可由Web UI調整)
unsigned long measureIntervalMs = 30000UL;
const unsigned long MIN_MEASURE_INTERVAL_MS = 5000UL;
const unsigned long MAX_MEASURE_INTERVAL_MS = 86400000UL;

// 光程長校正係數: (參考光程 / 實際流通池光程) = 1.0cm / 0.2cm = 5.0
float pathLengthFactor = 5.0f;
const float MAX_PATH_LENGTH_FACTOR = 1000.0f;

// 設 1 會把每一筆原始 dark/lit 讀值都印到 App Lab Console。
// 合併版預設關閉: 現在 Console 同時有壓力/流量/幫浦的訊息, 全開會刷到看不到重點。
#define OD_VERBOSE_LOG 0

// ---- OD600 對外狀態 ----
float blankRatio      = 1.0f;   // I0 校正常數(blank 的 net sample/reference 比值)
bool  blankSet        = false;
float blankLuxSample  = 0.0f;
float blankLuxRef     = 0.0f;

float lastOD600       = 0.0f;
float lastLuxSample   = 0.0f;
float lastLuxRef      = 0.0f;
float lastBubblePct   = 0.0f;
bool  lastReadingValid = false;
unsigned long lastMeasMillis = 0;   // 上一次「完成」量測的時間
unsigned long odMeasSeq = 0;        // 完成量測的序號, Python端用來判斷有沒有新資料

bool devModeOn = false;             // 開發者模式: LED恆亮, 暫停自動量測

// ---- 非阻塞量測狀態機 ----
enum OdState : uint8_t { OD_IDLE = 0, OD_DARK = 1, OD_WARMUP = 2, OD_LIT = 3 };
OdState odState = OD_IDLE;

unsigned long odNextStepMs = 0;  // 下一個動作(讀一筆/離開warmup)的時間點
int      odSampleIdx = 0;
uint8_t  odAttempt   = 0;        // 目前是第幾次嘗試(0=第一次)
bool     odBlankPending = false; // 這次量測完成後要不要把結果設成 blank

float odDarkS[8], odDarkR[8];
float odLitS[32], odLitR[32];
float odDarkMedS = 0.0f, odDarkMedR = 0.0f;

// 多次嘗試之間保留「拒收率最低」的那一次結果(與原版 doMeasurement() 相同策略)
bool  odHaveBest = false;
float odBestNetS = 0.0f, odBestNetR = 0.0f, odBestRej = 0.0f;
bool  odBestOk   = false;

// ---- 感測器「非阻塞重新初始化」 ----
// BH1750 的初始化序列本質上需要等待(power on 後 ~10ms, 切到連續高解析模式後
// ~180ms 第一次轉換才完成), 但那個等待不需要用 delay() 把整顆 MCU 佔住。
// 這裡拆成 POWER -> (10ms) -> MODE -> (180ms) -> 完成 三段, 由 reinitTick()
// 在 loop() 裡依 millis() 推進, 一次只處理一顆感測器。
enum ReinitStep : uint8_t { RI_IDLE = 0, RI_POWER = 1, RI_MODE = 2, RI_SETTLE = 3 };
ReinitStep riStep = RI_IDLE;
unsigned long riNextMs = 0;
bool riSampleNeeded = false;
bool riRefNeeded = false;
BH1750Simple *riTarget = nullptr;
const char *riTargetName = "";

// ---- 小工具: 中位數 / MAD 穩健平均 ----
float medianOf(float *arr, int n) {
  float tmp[32];
  memcpy(tmp, arr, n * sizeof(float));
  for (int i = 1; i < n; i++) {
    float key = tmp[i];
    int j = i - 1;
    while (j >= 0 && tmp[j] > key) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = key;
  }
  return (n % 2) ? tmp[n / 2] : 0.5f * (tmp[n / 2 - 1] + tmp[n / 2]);
}

// 統計 "-1"(I2C讀取失敗)的筆數。這跟氣泡造成的離群值是不同的失效模式:
// 若整個burst全是-1(感測器完全沒回應), MAD式的 robustMean() 會看到「零變異」
// 而回報0%拒收(所有值互相一致, 儘管全是垃圾), 所以需要這個獨立檢查。
int countI2CFailures(float *arr, int n) {
  int c = 0;
  for (int i = 0; i < n; i++) if (arr[i] < 0) c++;
  return c;
}

// ---------------------------------------------------------------------------
// v3.7: OD600 穩健位置估計可切換(依《訊號處理演算法檢討報告》E 節)
//   0 = mad      E-1 現行: median ± 3·MAD 閘門內取平均
//   1 = qn       E-2: 改用 Rousseeuw–Croux Qn 當尺度(常態效率 82% vs MAD 37%), 閘門較穩定
//   2 = biweight E-5: Tukey biweight M-estimator(c = 4.685), 軟性降權而非硬剔除
//   3 = upper    E-3: 單邊剔除 —— 氣泡只會「擋光讓讀值變低」, 取中位數以上的上半部平均,
//                     只把低於 median − 3·MAD 的點算成拒收
// 拒收率(氣泡百分比)一律定義為「被判定為離群的點數 / 總點數」。
// ---------------------------------------------------------------------------
uint8_t odEstimator = 0;
const char *OD_EST_NAME[] = { "mad", "qn", "biweight", "upper" };

float madScale(float *arr, int n, float med) {
  float absDev[32];
  for (int i = 0; i < n; i++) absDev[i] = fabsf(arr[i] - med);
  float mad = medianOf(absDev, n) * 1.4826f;
  return (mad < 1e-6f) ? 1e-6f : mad;
}

// Qn = 2.2219 · {|xi − xj|; i<j} 的第 k 小值, k = C(h,2), h = floor(n/2)+1
// n ≤ 32 → 最多 496 個差值, 在 MCU 上用插入排序也只要毫秒等級
float qnScale(float *arr, int n) {
  static float d[496];
  int m = 0;
  for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++) d[m++] = fabsf(arr[i] - arr[j]);
  if (m == 0) return 1e-6f;
  int h = n / 2 + 1;
  int k = h * (h - 1) / 2;
  if (k < 1) k = 1;
  if (k > m) k = m;
  for (int i = 1; i < m; i++) {               // 插入排序(只需要前 k 個有序, 但 m 很小)
    float key = d[i]; int j = i - 1;
    while (j >= 0 && d[j] > key) { d[j + 1] = d[j]; j--; }
    d[j + 1] = key;
  }
  float q = 2.2219f * d[k - 1];
  return (q < 1e-6f) ? 1e-6f : q;
}

float robustMean(float *arr, int n, float *rejectedPct) {
  float med = medianOf(arr, n);
  if (odEstimator == 1) {                     // ---- Qn ----
    float sc = qnScale(arr, n);
    float sum = 0; int kept = 0;
    for (int i = 0; i < n; i++) if (fabsf(arr[i] - med) <= MAD_K * sc) { sum += arr[i]; kept++; }
    if (rejectedPct) *rejectedPct = 100.0f * (n - kept) / (float)n;
    return kept ? (sum / kept) : med;
  }
  if (odEstimator == 2) {                     // ---- Tukey biweight ----
    float sc = madScale(arr, n, med);
    const float c = 4.685f;
    float T = med;
    for (int it = 0; it < 8; it++) {
      float sw = 0, swx = 0;
      for (int i = 0; i < n; i++) {
        float u = (arr[i] - T) / (c * sc);
        if (fabsf(u) < 1.0f) { float w = (1 - u * u) * (1 - u * u); sw += w; swx += w * arr[i]; }
      }
      if (sw <= 0) break;
      float Tn = swx / sw;
      if (fabsf(Tn - T) < 1e-4f * (fabsf(T) + 1e-3f)) { T = Tn; break; }
      T = Tn;
    }
    int rej = 0;
    for (int i = 0; i < n; i++) if (fabsf((arr[i] - T) / (c * sc)) >= 1.0f) rej++;
    if (rejectedPct) *rejectedPct = 100.0f * rej / (float)n;
    return T;
  }
  if (odEstimator == 3) {                     // ---- 單邊(上包絡) ----
    float sc = madScale(arr, n, med);
    float sum = 0; int kept = 0, rej = 0;
    for (int i = 0; i < n; i++) {
      if (arr[i] < med - MAD_K * sc) { rej++; continue; }
      if (arr[i] >= med) { sum += arr[i]; kept++; }
    }
    if (rejectedPct) *rejectedPct = 100.0f * rej / (float)n;
    return kept ? (sum / kept) : med;
  }
  // ---- 0 = MAD(現行, 預設) ----
  float absDev[32];
  for (int i = 0; i < n; i++) absDev[i] = fabsf(arr[i] - med);
  float mad = medianOf(absDev, n) * 1.4826f;
  if (mad < 1e-6f) mad = 1e-6f;

  float sum = 0; int kept = 0;
  for (int i = 0; i < n; i++) {
    if (fabsf(arr[i] - med) <= MAD_K * mad) { sum += arr[i]; kept++; }
  }
  if (rejectedPct) *rejectedPct = 100.0f * (n - kept) / (float)n;
  return kept ? (sum / kept) : med;
}

// 非阻塞的感測器重新初始化推進器: 每次 loop() 呼叫一次, 絕不 delay()
void reinitTick() {
  unsigned long now = millis();

  if (riStep == RI_IDLE) {
    if (riSampleNeeded)      { riTarget = &sampleSensor; riTargetName = "sample";    riSampleNeeded = false; }
    else if (riRefNeeded)    { riTarget = &refSensor;    riTargetName = "reference"; riRefNeeded = false; }
    else return;
    riStep = RI_POWER;
    riNextMs = now;
  }

  if ((long)(now - riNextMs) < 0) return;

  if (riStep == RI_POWER) {
    riTarget->powerOn(Wire);
    riStep = RI_MODE;
    riNextMs = now + 10;
  } else if (riStep == RI_MODE) {
    riTarget->setContinuousHRes();
    riStep = RI_SETTLE;
    riNextMs = now + 180;
  } else if (riStep == RI_SETTLE) {
    Monitor.print("[od600][warn] ");
    Monitor.print(riTargetName);
    Monitor.println(" sensor reinitialized (non-blocking).");
    riStep = RI_IDLE;
    riTarget = nullptr;
  }
}

// ---- 狀態機: 啟動一次量測 ----
// blankAfter=true 代表這次量完之後要把結果當成 blank(I0)。
bool odStartMeasurement(bool blankAfter) {
  if (devModeOn) return false;      // 開發者模式下LED被強制恆亮, 不做量測
  if (odState != OD_IDLE) {
    // 已經在量測中: 如果這次是要校正blank, 就把旗標記起來, 讓進行中的這次量完直接沿用
    if (blankAfter) odBlankPending = true;
    return false;
  }
  odBlankPending = blankAfter || odBlankPending;
  odAttempt = 0;
  odHaveBest = false;
  odSampleIdx = 0;
  odState = OD_DARK;
  odNextStepMs = millis();          // 立刻開始第一筆暗電流取樣
  digitalWrite(LED_PIN, LOW);       // 暗電流階段確保LED關閉
  return true;
}

// 一次嘗試(dark + lit)收完之後的統計。回傳這次嘗試是否算「有效」。
bool odFinishAttempt() {
  int n = N_SAMPLES - WARMUP_DISCARD;
  float *s = odLitS + WARMUP_DISCARD;
  float *r = odLitR + WARMUP_DISCARD;

  float rejS, rejR;
  float litS = robustMean(s, n, &rejS);
  float litR = robustMean(r, n, &rejR);

  float netS = litS - odDarkMedS;
  float netR = litR - odDarkMedR;
  float rejPct = max(rejS, rejR);

  // I2C 硬失效偵測 + 自動復原: 某顆感測器這輪有一半以上讀值是 -1,
  // 比較可能是卡住/脫落而不是氣泡雜訊, 立刻重跑一次初始化, 讓下一次嘗試
  // 有機會自己好起來, 不用人工重新上電(README §8.6)。
  int totalPerSensor = N_DARK_SAMPLES + N_SAMPLES;
  int sampleFails = countI2CFailures(odDarkS, N_DARK_SAMPLES) + countI2CFailures(odLitS, N_SAMPLES);
  int refFails    = countI2CFailures(odDarkR, N_DARK_SAMPLES) + countI2CFailures(odLitR, N_SAMPLES);
  bool sampleHardFail = sampleFails >= (totalPerSensor / 2);
  bool refHardFail    = refFails    >= (totalPerSensor / 2);

  // 注意: 這裡只「排隊」重新初始化, 不直接呼叫 begin()。begin() 內含
  // delay(10)+delay(180), 兩顆都失敗就是 380ms 的 loop() 停擺, 而這段程式碼
  // 剛好就在每次量測的收尾流程上。實際的重新初始化交給 reinitTick() 分段做。
  if (sampleHardFail) {
    Monitor.println("[od600][warn] sample sensor lost >=50% of I2C reads -- queueing reinit...");
    riSampleNeeded = true;
  }
  if (refHardFail) {
    Monitor.println("[od600][warn] reference sensor lost >=50% of I2C reads -- queueing reinit...");
    riRefNeeded = true;
  }

  bool ok = (rejPct <= REJECT_RETRY_PCT) && !sampleHardFail && !refHardFail;

  // 保留拒收率最低的一次
  if (!odHaveBest || rejPct < odBestRej) {
    odHaveBest = true;
    odBestNetS = netS;
    odBestNetR = netR;
    odBestRej  = rejPct;
    odBestOk   = ok;
  }
  return ok;
}

// 所有嘗試跑完, 把結果落到對外狀態並推播
void odCommitResult() {
  float netS = odBestNetS;
  float netR = odBestNetR;
  if (netS < 0) netS = 0;
  if (netR < 0) netR = 0;

  lastLuxSample    = netS;
  lastLuxRef       = netR;
  lastBubblePct    = odBestRej;
  lastReadingValid = odBestOk;

  float ratio = (netR > 1e-3f) ? (netS / netR) : 0.0f;

  if (odBlankPending) {
    // 這次量測是為了校正 blank: 把當下讀值設成 I0 基準
    blankRatio     = (netR > 1e-3f) ? ratio : 1.0f;
    blankLuxSample = netS;
    blankLuxRef    = netR;
    blankSet       = true;
    lastOD600      = 0.0f;
    odBlankPending = false;
    Monitor.println("[od600] blank calibrated (OD600 = 0 reference point set)");
  } else if (blankSet && ratio > 1e-6f && blankRatio > 1e-6f) {
    lastOD600 = log10f(blankRatio / ratio) * pathLengthFactor;
  }

  lastMeasMillis = millis();
  odMeasSeq++;

  Monitor.print("[od600] seq="); Monitor.print(odMeasSeq);
  Monitor.print("  sample="); Monitor.print(lastLuxSample, 2); Monitor.print("lx");
  Monitor.print("  ref="); Monitor.print(lastLuxRef, 2); Monitor.print("lx");
  Monitor.print("  OD600="); Monitor.print(lastOD600, 5);
  Monitor.print("  bubble="); Monitor.print(lastBubblePct, 1); Monitor.print("%");
  Monitor.print("  valid="); Monitor.print(lastReadingValid ? "yes" : "no");
  Monitor.print("  blankSet="); Monitor.println(blankSet ? "yes" : "no");

  // 主動推播給 Python 端, 不用等它輪詢(輪詢仍保留為重連時的補值手段)
  String payload = String(lastOD600, 5) + "," +
                   String(lastLuxSample, 2) + "," +
                   String(lastLuxRef, 2) + "," +
                   String(lastBubblePct, 1) + "," +
                   String(lastReadingValid ? 1 : 0) + "," +
                   String(blankSet ? 1 : 0) + "," +
                   String((unsigned long)odMeasSeq);
  Bridge.notify("on_od600_update", payload);
}

// 每次 loop() 呼叫一次: 只有「時間到」才做一個小動作, 絕不 delay()
void odTick() {
  if (devModeOn) return;
  unsigned long now = millis();

  switch (odState) {
    case OD_IDLE:
      if (now - lastMeasMillis >= measureIntervalMs) {
        odStartMeasurement(false);
      }
      break;

    case OD_DARK:
      if ((long)(now - odNextStepMs) < 0) break;
      odDarkS[odSampleIdx] = sampleSensor.readLightLevel();
      odDarkR[odSampleIdx] = refSensor.readLightLevel();
#if OD_VERBOSE_LOG
      Monitor.print("[od600][dark] i="); Monitor.print(odSampleIdx);
      Monitor.print("  sample="); Monitor.print(odDarkS[odSampleIdx], 2);
      Monitor.print("  ref="); Monitor.println(odDarkR[odSampleIdx], 2);
#endif
      odSampleIdx++;
      odNextStepMs = now + SAMPLE_PERIOD_MS;
      if (odSampleIdx >= N_DARK_SAMPLES) {
        odDarkMedS = medianOf(odDarkS, N_DARK_SAMPLES);
        odDarkMedR = medianOf(odDarkR, N_DARK_SAMPLES);
        digitalWrite(LED_PIN, HIGH);          // 點亮LED
        odState = OD_WARMUP;
        odNextStepMs = now + LED_WARMUP_MS;
      }
      break;

    case OD_WARMUP:
      if ((long)(now - odNextStepMs) < 0) break;
      odSampleIdx = 0;
      odState = OD_LIT;
      odNextStepMs = now;                      // 立刻開始第一筆亮燈取樣
      break;

    case OD_LIT:
      if ((long)(now - odNextStepMs) < 0) break;
      odLitS[odSampleIdx] = sampleSensor.readLightLevel();
      odLitR[odSampleIdx] = refSensor.readLightLevel();
#if OD_VERBOSE_LOG
      Monitor.print("[od600][lit ] i="); Monitor.print(odSampleIdx);
      Monitor.print("  sample="); Monitor.print(odLitS[odSampleIdx], 2);
      Monitor.print("  ref="); Monitor.println(odLitR[odSampleIdx], 2);
#endif
      odSampleIdx++;
      odNextStepMs = now + SAMPLE_PERIOD_MS;
      if (odSampleIdx >= N_SAMPLES) {
        digitalWrite(LED_PIN, LOW);            // burst一結束立刻關燈(脈衝供電)
        bool ok = odFinishAttempt();
        if (!ok && odAttempt < MAX_RETRIES) {
          odAttempt++;
          odSampleIdx = 0;
          odState = OD_DARK;                    // 重跑一次完整的 dark + lit
          odNextStepMs = now;
        } else {
          odCommitResult();
          odState = OD_IDLE;
        }
      }
      break;
  }
}

// ===========================================================================
// 二、流量計 (ZJ-TM02)
// ===========================================================================
const int FLOW_SENSOR_PIN = 2;   // 需支援中斷的腳位

// ---- 依買到的孔徑版本選擇其中一個, 把另一個註解掉 ----
const float PULSES_PER_LITER = 2580.0;   // 大孔版本 (F = 43*Q)
// const float PULSES_PER_LITER = 5160.0; // 小孔版本 (F = 86*Q)

const unsigned long FLOW_UPDATE_INTERVAL_MS = 1000;  // 每1秒彙總一次
const unsigned long MIN_PULSE_INTERVAL_US   = 500;   // 去彈跳

volatile unsigned long pulseCounter     = 0;
volatile unsigned long pulseCounterEver = 0;
volatile unsigned long lastPulseMicros  = 0;
// v3.7: 倒數計數(C-1)用: 這個彙總視窗內第一個與最後一個脈衝的時戳
volatile unsigned long winFirstPulseUs  = 0;
volatile unsigned long winLastPulseUs   = 0;
// 0 = gate(現行: 1 秒閘門計數) 1 = reciprocal(C-1: (N−1)/(t_last − t_first), N<2 退回閘門)
uint8_t flowAlg = 0;
const char *FLOW_ALG_NAME[] = { "gate", "reciprocal" };
unsigned long lastFlowPulses = 0;

unsigned long lastFlowUpdateMs = 0;
float lastFreqHz     = 0.0;
float lastFlowMlMin  = 0.0;
float totalVolumeMl  = 0.0;

// 每個脈衝都印一行在合併版會把Console洗掉(壓力/OD600也在印), 預設關閉;
// 只有在單獨debug流量計時才打開。
const bool ENABLE_RAW_PULSE_LOG = false;
const bool ENABLE_FLOW_SUMMARY_LOG = true;   // 每秒一行的彙總, 保留

const int DEBUG_LED_PIN = LED_BUILTIN;
bool debugLedState = false;

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

void logRawPulseIfAny() {
  if (!ENABLE_RAW_PULSE_LOG) return;
  noInterrupts();
  unsigned long currentCount = pulseCounterEver;
  interrupts();
  static unsigned long lastSeen = 0;
  if (currentCount != lastSeen) {
    debugLedState = !debugLedState;
    digitalWrite(DEBUG_LED_PIN, debugLedState ? LOW : HIGH);
    Monitor.print("[flow][pulse] +");
    Monitor.print(currentCount - lastSeen);
    Monitor.print("  total_ever=");
    Monitor.print(currentCount);
    Monitor.print("  at t=");
    Monitor.println(millis());
    lastSeen = currentCount;
  }
}

void update_flow() {
  noInterrupts();
  unsigned long pulses = pulseCounter;
  unsigned long tFirst = winFirstPulseUs;
  unsigned long tLast  = winLastPulseUs;
  pulseCounter = 0;
  interrupts();

  unsigned long now = millis();
  float elapsedSec = (now - lastFlowUpdateMs) / 1000.0;
  if (elapsedSec <= 0) elapsedSec = FLOW_UPDATE_INTERVAL_MS / 1000.0;

  lastFlowPulses = pulses;
  pumpStallCheck(pulses);      // v3.10.0: 卡住重推
  if (flowAlg == 1 && pulses >= 2 && tLast != tFirst) {
    // C-1 倒數計數: 用脈衝之間的真實時間, 消除閘門計數 ±1 脈衝的量化誤差
    lastFreqHz = (pulses - 1) / ((tLast - tFirst) / 1e6f);
  } else {
    lastFreqHz = pulses / elapsedSec;                      // 閘門計數(現行)
  }
  float flowLmin = (lastFreqHz * 60.0) / PULSES_PER_LITER; // L/min
  lastFlowMlMin = flowLmin * 1000.0;                        // mL/min

  totalVolumeMl += (pulses / PULSES_PER_LITER) * 1000.0;    // mL
  lastFlowUpdateMs = now;

  if (ENABLE_FLOW_SUMMARY_LOG) {
    Monitor.print("[flow] pulses="); Monitor.print(pulses);
    Monitor.print("  freq_Hz="); Monitor.print(lastFreqHz, 3);
    Monitor.print("  flow_mL_min="); Monitor.print(lastFlowMlMin, 2);
    Monitor.print("  total_mL="); Monitor.println(totalVolumeMl, 2);
  }
  // v3.10.9: 流量改成 MCU 主動推送(跟壓力、pH 一樣), Python→MCU 指令通道斷掉時仍會記錄
  Bridge.notify("on_flow_update", String(lastFreqHz, 3) + "," + String(lastFlowMlMin, 2) + "," +
                String(totalVolumeMl, 2) + "," + String(pulses));
}

String get_flow_data(String arg) {
  rpcMark();
  // v3.7: 第 4 欄 = 上一個視窗的脈衝數(Python 舊版只讀前 3 欄, 向下相容)
  return String(lastFreqHz, 3) + "," + String(lastFlowMlMin, 2) + "," + String(totalVolumeMl, 2) +
         "," + String(lastFlowPulses);
}

// ---- v3.7: MCU 端演算法切換 ----
// set_algorithms("flow=0|1,od=0..3") / get_algorithms() -> "flow=gate,od=mad"
String algorithmsString() {
  return String("flow=") + FLOW_ALG_NAME[flowAlg] + ",od=" + OD_EST_NAME[odEstimator];
}

String get_algorithms(String arg) { return algorithmsString(); }

String set_algorithms(String arg) {
  float x;
  if (kvGet(arg, "flow", x)) {
    if (x < 0 || x > 1) return "rejected:flow 0-1";
    flowAlg = (uint8_t)x;
  }
  if (kvGet(arg, "od", x)) {
    if (x < 0 || x > 3) return "rejected:od 0-3";
    odEstimator = (uint8_t)x;
  }
  Monitor.print("[alg] "); Monitor.println(algorithmsString());
  return algorithmsString();
}

// ===========================================================================
// 三、壓力 (薄膜過濾, 高頻取樣 + peak/trough/mean)
// ===========================================================================
// 依 pressure_sampling_algorithm_spec.md: shell側的蠕動幫浦會讓壓力訊號疊加
// 週期性脈動, 單次讀值會把峰值/谷值平均掉。改成 100Hz 高頻取樣 -> 滑動視窗
// -> 每200ms統計 peak/trough/mean_raw + 粗估脈動頻率; mean的低通濾波與
// TMP 的 peak/trough/mean 組合都在 Python 端做(濾波常數可調不需重燒錄)。
//
// [PROVISIONAL] 取樣頻率/視窗長度都是合理預設值, 規格書§1.3要求先實測 shell 側
// 幫浦的實際脈動頻率, 量到後回頭調整 PRESSURE_WINDOW_MS(需涵蓋2-3個脈動週期)
// 與 PRESSURE_WINDOW_UPDATE_MS(要比脈動週期短)。

const int PRESSURE_ZERO_SAMPLES = 32;  // 歸零校正的平均取樣次數

// ---- 校正參數 ----
// 分壓電路: 變送器輸出 --[R_TOP 15kΩ]--+--[R_BOTTOM 22kΩ]-- GND, 中點接 A0/A1/A2
// 比例 = 22/(15+22) = 0.5946 → 5 V 輸出在腳位上是 2.97 V(< 3.3 V, 安全)
// 若換電阻, 只要改這兩個數字(建議用三用電表量實際阻值填入)
const float VREF          = 3.3f;     // 實測 3V3 後填入, 壓力與 pH 共用
const float ADC_MAX       = (float)((1UL << ADC_BITS) - 1);   // v3: 跟著 ADC_BITS 走(原本寫死 1023)
const float DIV_R_TOP_KOHM    = 15.0f;
const float DIV_R_BOTTOM_KOHM = 22.0f;
const float DIVIDER_RATIO = DIV_R_BOTTOM_KOHM / (DIV_R_TOP_KOHM + DIV_R_BOTTOM_KOHM);
const float SENSOR_VMAX   = 5.0f;
const float SENSOR_BARMAX = 10.0f;   // 0-1MPa = 0-10 bar

// ---- 高頻取樣設定 [PROVISIONAL] ----
const unsigned long PRESSURE_SAMPLE_INTERVAL_MS = 10;   // 100Hz
const int PRESSURE_OVERSAMPLE_BLOCK = 16;                // 每次瞬時讀值內部16點平均降噪
const unsigned long PRESSURE_WINDOW_MS = 1000;            // 滑動視窗長度
const unsigned long PRESSURE_WINDOW_UPDATE_MS = 200;      // 統計+推播頻率
const int PRESSURE_RING_SIZE = (int)(PRESSURE_WINDOW_MS / PRESSURE_SAMPLE_INTERVAL_MS);

struct PressureChannel {
  int pin;
  float offset;
  float ring[PRESSURE_RING_SIZE];
  int ringHead;
  int ringCount;
};

PressureChannel chFeed      = { A0, 0.0f, {}, 0, 0 };
PressureChannel chRetentate = { A1, 0.0f, {}, 0, 0 };
PressureChannel chPermeate  = { A2, 0.0f, {}, 0, 0 };

// 手動宣告原型: Arduino builder 會在最後一個 #include 之後(struct 定義之前)
// 自動插入前向宣告, 那個位置看不到 PressureChannel 型別會編譯失敗。
// 這裡先手動宣告過, builder 就不會再自動產生壞掉的版本。
void pressureChannelSample(PressureChannel &ch);
void pressureChannelStats(PressureChannel &ch, float &peak, float &trough, float &meanRaw, float &cycleFreqHz);

unsigned long lastPressureSampleMs = 0;
unsigned long lastPressureWindowMs = 0;

float rawToBar(float adcRaw) {
  float vAtPin  = (adcRaw / ADC_MAX) * VREF;
  float vSensor = vAtPin / DIVIDER_RATIO;
  return (vSensor / SENSOR_VMAX) * SENSOR_BARMAX;
}

float readBlockAveragedBar(int pin) {
  long sum = 0;
  // 分壓電路的源阻抗約 15k//22k = 8.9 kΩ, ADC 從上一個腳位(A0→A1→A2→A4)切過來時
  // 取樣電容可能還沒充飽, 第一筆會被上一通道「拉過去」。丟掉第一筆再平均。
  (void)analogRead(pin);
  for (int i = 0; i < PRESSURE_OVERSAMPLE_BLOCK; i++) {
    sum += analogRead(pin);
  }
  return rawToBar((float)sum / PRESSURE_OVERSAMPLE_BLOCK);
}

void pressureChannelSample(PressureChannel &ch) {
  float bar = readBlockAveragedBar(ch.pin) - ch.offset;
  ch.ring[ch.ringHead] = bar;
  ch.ringHead = (ch.ringHead + 1) % PRESSURE_RING_SIZE;
  if (ch.ringCount < PRESSURE_RING_SIZE) ch.ringCount++;
}

void pressureChannelStats(PressureChannel &ch, float &peak, float &trough, float &meanRaw, float &cycleFreqHz) {
  int n = ch.ringCount;
  if (n == 0) { peak = trough = meanRaw = 0.0f; cycleFreqHz = 0.0f; return; }

  float sum = 0.0f;
  peak = -1e9f;
  trough = 1e9f;
  int startIdx = (ch.ringHead - n + PRESSURE_RING_SIZE) % PRESSURE_RING_SIZE;
  for (int i = 0; i < n; i++) {
    float v = ch.ring[(startIdx + i) % PRESSURE_RING_SIZE];
    sum += v;
    if (v > peak) peak = v;
    if (v < trough) trough = v;
  }
  meanRaw = sum / n;

  // 粗估脈動頻率: 過零(平均值)次數, 一個完整週期會過零2次。只供除錯/驗收比對。
  int crossings = 0;
  bool prevAbove = (ch.ring[startIdx] >= meanRaw);
  for (int i = 1; i < n; i++) {
    float v = ch.ring[(startIdx + i) % PRESSURE_RING_SIZE];
    bool above = (v >= meanRaw);
    if (above != prevAbove) crossings++;
    prevAbove = above;
  }
  float windowSec = (n * PRESSURE_SAMPLE_INTERVAL_MS) / 1000.0f;
  cycleFreqHz = (windowSec > 0.0f) ? (crossings / 2.0f) / windowSec : 0.0f;
}

// 供 Python/網頁呼叫: 假設此刻系統確實已洩壓到大氣, 把目前讀值當作新零點
void zeroCalibrate() {
  float sumF = 0, sumR = 0, sumP = 0;
  for (int i = 0; i < PRESSURE_ZERO_SAMPLES; i++) {
    sumF += readBlockAveragedBar(chFeed.pin);   // 與正常取樣同一路徑(丟首筆+16點平均)
    sumR += readBlockAveragedBar(chRetentate.pin);
    sumP += readBlockAveragedBar(chPermeate.pin);
    delay(5);
  }
  chFeed.offset      = sumF / PRESSURE_ZERO_SAMPLES;
  chRetentate.offset = sumR / PRESSURE_ZERO_SAMPLES;
  chPermeate.offset  = sumP / PRESSURE_ZERO_SAMPLES;
  // 清空滑動視窗, 避免殘留校正前的舊資料(offset改變會讓舊資料整批偏移)
  chFeed.ringHead = chFeed.ringCount = 0;
  chRetentate.ringHead = chRetentate.ringCount = 0;
  chPermeate.ringHead = chPermeate.ringCount = 0;
  Monitor.println("[pressure] zero_calibrate done");
}

// --- 手動設定 / 讀回壓力歸零 offset ---
// MCU 一重開, 三個通道的 offset 就回到 0, 之前歸零校正的結果全部消失。這兩個函式讓
// Python 端可以把上次存下來的 offset 直接推回來, 不用整套系統重新洩壓再校正一次。
// 單位是 bar, 與 zeroCalibrate() 算出來的完全相同。
String set_pressure_offsets(String arg) {
  float v[3];
  if (splitFloats(arg, v, 3) != 3) {
    Monitor.println("[pressure] set_pressure_offsets: 參數格式錯誤(需要 feed,retentate,permeate)");
    return "rejected";
  }
  chFeed.offset      = v[0];
  chRetentate.offset = v[1];
  chPermeate.offset  = v[2];
  // 跟 zeroCalibrate() 一樣要清空滑動視窗: offset 一改, 視窗裡的舊資料整批都偏了
  chFeed.ringHead = chFeed.ringCount = 0;
  chRetentate.ringHead = chRetentate.ringCount = 0;
  chPermeate.ringHead = chPermeate.ringCount = 0;
  Monitor.print("[pressure] offsets 手動設定為 ");
  Monitor.print(v[0], 5); Monitor.print(","); Monitor.print(v[1], 5);
  Monitor.print(","); Monitor.println(v[2], 5);
  return String(chFeed.offset, 5) + "," + String(chRetentate.offset, 5) + "," + String(chPermeate.offset, 5);
}

String get_pressure_offsets(String arg) {
  return String(chFeed.offset, 5) + "," + String(chRetentate.offset, 5) + "," + String(chPermeate.offset, 5);
}

void pressureSampleTick() {
  pressureChannelSample(chFeed);
  pressureChannelSample(chRetentate);
  pressureChannelSample(chPermeate);
  pressureSamplesThisSec++;   // 診斷計數, 見第六節
}

void pressureWindowTick() {
  float fPeak, fTrough, fMean, fFreq;
  float rPeak, rTrough, rMean, rFreq;
  float pPeak, pTrough, pMean, pFreq;
  pressureChannelStats(chFeed, fPeak, fTrough, fMean, fFreq);
  pressureChannelStats(chRetentate, rPeak, rTrough, rMean, rFreq);
  pressureChannelStats(chPermeate, pPeak, pTrough, pMean, pFreq);

  // v3: 夾閥的 TMP 安全放開。用瞬時峰值(最壞情境), 跟 Python 端 tmp_peak 的定義相同:
  //     TMP_peak = (Feed_peak + Retentate_peak)/2 − Permeate_trough
  float tmpPeak = (fPeak + rPeak) / 2.0f - pTrough;
  valveInterlockCheck(tmpPeak, fPeak, fMean);

  String payload = String(fPeak, 5) + "," + String(fTrough, 5) + "," + String(fMean, 5) + "," + String(fFreq, 3) + "," +
                   String(rPeak, 5) + "," + String(rTrough, 5) + "," + String(rMean, 5) + "," + String(rFreq, 3) + "," +
                   String(pPeak, 5) + "," + String(pTrough, 5) + "," + String(pMean, 5) + "," + String(pFreq, 3);
  Bridge.notify("on_pressure_update", payload);
}

// ===========================================================================
// 四、蠕動幫浦控制 (L298N) — 僅 PWM 控制
// ===========================================================================
const int PUMP_ENA_PIN = 9;  // PWM調速 -> L298N ENA
const int PUMP_IN1_PIN = 5;  // 方向 -> L298N IN1
const int PUMP_IN2_PIN = 6;  // 方向 -> L298N IN2

// v3.1: 換了幫浦, 舊幫浦實測的「PWM < 100 只嗡鳴不轉」無效區間已不適用, 夾制邏輯移除,
//       0-255 全範圍直接輸出。新幫浦的最低可轉 PWM 請實測後自行避開。

int  pumpPwm     = 0;
bool pumpForward = true;

// ---- v3.10.0: 啟動助推(kick-start) ----
// 馬達靜止時需要較大的力矩才能克服靜摩擦(實測要 PWM 200 才轉得起來), 但轉動後 PWM 150 就能維持。
// 從停止狀態啟動、且目標 PWM 低於助推 PWM 時: 先以 kickPwm 推 kickMs 毫秒, 再降到目標值。
// 選用「卡住重推」: 有設定 PWM 卻連續 stallSec 秒沒有流量脈衝 → 再助推一次(最多 3 次);
// 夾閥沒有在「開」的狀態時不重推(夾閉時流量本來就會掉, 重推會把壓力往上衝)。
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
    pumpStartKick();                       // 先推一下, pumpTick() 時間到再降回 target
  } else {
    pumpKicking = false;
    analogWrite(PUMP_ENA_PIN, pumpPwm);
  }
}

// 每圈 loop() 呼叫: 助推時間到就降回目標 PWM
void pumpTick(unsigned long now) {
  if (pumpKicking && now - pumpKickStart >= pumpKickMs) {
    pumpKicking = false;
    analogWrite(PUMP_ENA_PIN, pumpPwm);
  }
}

// update_flow() 每秒呼叫一次: 卡住重推
bool pumpValveOpen();
void pumpStallCheck(unsigned long pulses) {
  if (pumpPwm == 0 || pumpKicking) { pumpStallSecs = 0; return; }
  if (pulses > 0) { pumpStallSecs = 0; pumpStallKicks = 0; return; }
  if (!pumpStallRekick || !pumpKickEnabled || !pumpValveOpen()) { pumpStallSecs = 0; return; }
  if (++pumpStallSecs >= (int)PUMP_STALL_SEC && pumpStallKicks < PUMP_STALL_MAX_KICKS) {
    pumpStallSecs = 0;
    pumpStallKicks++;
    Monitor.print("[pump] 沒有流量, 重新助推 #"); Monitor.println(pumpStallKicks);
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
// arg: "en=1,pwm=255,ms=500,stall=0"(可只給部分)
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

String set_pump_pwm(String arg) {
  setPumpSpeed(arg.toInt());
  Monitor.print("[pump] set pwm="); Monitor.println(pumpPwm);
  return String(pumpPwm);
}

// 為了安全, 切換方向前建議由Python端先呼叫 stop_pump(), 這裡本身不會自動歸零。
String set_pump_direction(String arg) {
  bool forward = (arg.toInt() != 0);
  setPumpDirection(forward);
  Monitor.print("[pump] set direction forward="); Monitor.println(forward ? "1" : "0");
  return forward ? "1" : "0";
}

String stop_pump(String arg) {
  setPumpSpeed(0);
  // v3: 緊急停止時一併放開夾閥(只是排請求, 實際伺服 I/O 在 loop() 做)。不鎖存 FAULT。
  valveRequestOpen("pump emergency stop", false);
  Monitor.println("[pump] stop");
  return "0";
}

String get_pump_status(String arg) {
  return String(pumpPwm) + "," + (pumpForward ? "1" : "0");
}

// ===========================================================================
// 五、OD600 的 Bridge 介面
// ===========================================================================
String get_od_data(String arg) {
  unsigned long ageMs = millis() - lastMeasMillis;
  return String(lastOD600, 5) + "," +
         String(lastLuxSample, 2) + "," +
         String(lastLuxRef, 2) + "," +
         String(lastBubblePct, 1) + "," +
         String(lastReadingValid ? 1 : 0) + "," +
         String(blankSet ? 1 : 0) + "," +
         String((unsigned long)odMeasSeq) + "," +
         String(ageMs) + "," +
         String(odState != OD_IDLE ? 1 : 0);
}

String get_blank_info(String arg) {
  return String(blankSet ? 1 : 0) + "," +
         String(blankLuxSample, 2) + "," +
         String(blankLuxRef, 2) + "," +
         String(blankRatio, 5);
}

// 在流通池裡裝入乾淨培養基/空白樣品時呼叫一次, 用來設定 I0 (OD600 = 0 基準點)。
// 非阻塞: 只是排入一次量測, 量完(約3秒後)才會真的生效, Python端會收到
// on_od600_update 通知。
String calibrate_blank(String arg) {
  bool started = odStartMeasurement(true);
  Monitor.println(started ? "[od600] blank calibration queued" : "[od600] blank calibration will use the in-flight measurement");
  return started ? "queued" : "busy";
}

String trigger_measurement(String arg) {
  bool started = odStartMeasurement(false);
  return started ? "queued" : "busy";
}

// 手動設定 OD600 的空白基準(I0), 不用真的再量一次。
// arg: "blank_ratio,blank_lux_sample,blank_lux_ref"
//   blank_ratio 是唯一真正參與計算的值(OD600 = log10(blankRatio / ratio) × pathLengthFactor);
//   後面兩個 lux 只是當時的原始讀值, 純粹給畫面顯示用, 可以填 0。
// 用途: MCU 重開之後把上次的校正值推回來, 省掉「流通池換回乾淨培養基再校正一次」
// 這個在實驗進行中根本做不到的動作。
String set_blank_manual(String arg) {
  float v[3] = {0, 0, 0};
  int n = splitFloats(arg, v, 3);
  if (n < 1 || isnan(v[0]) || v[0] <= 0.0f) {
    Monitor.println("[od600] set_blank_manual: blank_ratio 必須是大於 0 的數值");
    return "rejected";
  }
  blankRatio     = v[0];
  blankLuxSample = (n >= 2) ? v[1] : 0.0f;
  blankLuxRef    = (n >= 3) ? v[2] : 0.0f;
  blankSet       = true;

  // 立刻用目前最新一次的讀值重算一次 OD600, 這樣畫面不用等到下一次量測才更新
  float ratio = (lastLuxRef > 1e-3f) ? (lastLuxSample / lastLuxRef) : 0.0f;
  if (ratio > 1e-6f) lastOD600 = log10f(blankRatio / ratio) * pathLengthFactor;

  Monitor.print("[od600] blank 手動設定: ratio="); Monitor.print(blankRatio, 5);
  Monitor.print(" sample="); Monitor.print(blankLuxSample, 2);
  Monitor.print(" ref="); Monitor.println(blankLuxRef, 2);
  return String(blankRatio, 5);
}

// 清掉空白基準(回到「未校正」狀態)。給誤設值時可以退回去。
String clear_blank(String arg) {
  blankSet = false;
  blankRatio = 1.0f;
  blankLuxSample = blankLuxRef = 0.0f;
  lastOD600 = 0.0f;
  Monitor.println("[od600] blank 已清除, 回到未校正狀態");
  return "ok";
}

// --- 開發者模式: LED恆亮的對光工具 ---
String set_dev_mode(String arg) {
  bool on = (arg.toInt() != 0);
  devModeOn = on;
  if (on) {
    // 若正在量測中, 直接中止(不commit半套資料), 把LED交給對光用
    odState = OD_IDLE;
    odBlankPending = false;
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
    lastMeasMillis = millis();  // 乾淨地接回正常節奏, 不要一離開就立刻量一次
  }
  Monitor.print("[od600][dev] developer mode ");
  Monitor.println(devModeOn ? "ENABLED -- LED forced ON, autonomous measurement paused."
                            : "disabled -- LED off, autonomous measurement resumed.");
  return devModeOn ? "1" : "0";
}

// 即時未濾波單次讀值, 專供對光用(刻意不做暗電流扣除/MAD平均, 才能即時反映
// 硬體調整結果)。感測器沒回應回傳 -1, 非開發者模式回傳 0。
String get_dev_readings(String arg) {
  if (!devModeOn) return "0,0.00,0.00";
  float s = sampleSensor.readLightLevel();
  float r = refSensor.readLightLevel();
  return String("1,") + String(s, 2) + "," + String(r, 2);
}

String set_measure_interval_sec(String arg) {
  float sec = arg.toFloat();
  if (isnan(sec) || sec < (MIN_MEASURE_INTERVAL_MS / 1000.0f) || sec > (MAX_MEASURE_INTERVAL_MS / 1000.0f)) {
    Monitor.print("[od600][cfg] rejected measurement interval "); Monitor.println(sec, 2);
    return "rejected";
  }
  measureIntervalMs = (unsigned long)(sec * 1000.0f);
  Monitor.print("[od600][cfg] measurement interval set to "); Monitor.print(sec, 2); Monitor.println("s");
  return String(sec, 2);
}

String get_measure_interval_sec(String arg) {
  return String(measureIntervalMs / 1000.0f, 2);
}

// 改這個係數不需要重新校正 blank(blankRatio 是無因次的強度比值, 與光程無關),
// 但會讓「之後」算出來的每一個 OD600 重新縮放, 同一次實驗前後的數值不可直接比較。
String set_path_length_factor(String arg) {
  float f = arg.toFloat();
  if (isnan(f) || f <= 0.0f || f > MAX_PATH_LENGTH_FACTOR) {
    Monitor.print("[od600][cfg] rejected path length factor "); Monitor.println(f, 4);
    return "rejected";
  }
  pathLengthFactor = f;
  Monitor.print("[od600][cfg] path length factor set to "); Monitor.println(f, 4);
  return String(f, 4);
}

String get_path_length_factor(String arg) {
  return String(pathLengthFactor, 4);
}

// ===========================================================================
// 六、即時性診斷
// ===========================================================================
// 「壓力/流速在 OD600 取樣時停擺」這種問題最難的是看不到誰在卡住 loop()。
// 這裡量兩個東西, 每秒統計一次:
//   loop_max_us  : 這一秒內最長的一次 loop() 迭代耗時(微秒)。正常應該是幾百 us
//                  以內(主要是 100Hz 那次 48 個 analogRead)。如果看到幾萬甚至
//                  幾十萬, 就代表有人在 loop() 裡阻塞, 直接對應到壓力取樣的缺口。
//   pressure_samples_last_sec : 上一秒實際完成的壓力取樣筆數。100Hz 應該接近 100,
//                  明顯少於 100 就是被卡掉的筆數。
// 兩個值都會每秒印到 Console, 也可以由 Python 端用 get_diag() 取回。
// (pressureSamplesThisSec 宣告在檔案上方的診斷計數區, 因為 pressureSampleTick() 會用到)
unsigned long loopMaxUs = 0;            // 累積中(這一秒)
unsigned long loopMaxUsLastSec = 0;     // 上一秒的結果
unsigned long pressureSamplesLastSec = 0;
unsigned long lastDiagMs = 0;

const bool ENABLE_DIAG_LOG = true;      // 排除完問題後可以設 false 讓 Console 清爽一點

String get_diag(String arg) {
  rpcMark();
  // 最後那個 millis() 是 MCU 的開機時間: Python 端拿它來偵測「MCU 偷偷重開過了」
  // (uptime 突然變小), 進而自動把存檔的校正值推回來。沒有這個訊號的話, Python 只能
  // 靠「blank 沒設定」之類的間接跡象猜, 會漏掉一些情況。
  return String(loopMaxUsLastSec) + "," +
         String(pressureSamplesLastSec) + "," +
         String((int)odState) + "," +
         String((int)riStep) + "," +
         String(millis()) + "," +
         FW_VERSION + "," + (rpcWdEnabled ? "1" : "0") + "," + String(rpcWdSec) + "," + String(rpcCountTotal);
}

void diagTick(unsigned long now) {
  if (now - lastDiagMs < 1000) return;
  lastDiagMs = now;
  if (now - rpcLastLogMs >= 30000) {
    rpcLastLogMs = now;
    unsigned long n = rpcCountTotal - rpcCountWindowStart;
    rpcCountWindowStart = rpcCountTotal;
    Monitor.print("[rpc] 最近 30 秒收到 Python 呼叫 "); Monitor.print(n); Monitor.print(" 次 (累計 ");
    Monitor.print(rpcCountTotal); Monitor.println(")");
    if (rpcEverSeen && n == 0 && !rpcWarned) {
      rpcWarned = true;
      Monitor.println("[rpc] !! 30 秒內完全沒收到 Python 的呼叫: Linux→MCU 指令通道可能中斷 (MCU 本身仍正常運作、資料照常推送)");
    } else if (n > 0 && rpcWarned) {
      rpcWarned = false;
      Monitor.println("[rpc] Python 呼叫恢復");
    }
  }
  loopMaxUsLastSec = loopMaxUs;
  loopMaxUs = 0;
  pressureSamplesLastSec = pressureSamplesThisSec;
  pressureSamplesThisSec = 0;
  if (ENABLE_DIAG_LOG) {
    Monitor.print("[diag] loop_max_us=");
    Monitor.print(loopMaxUsLastSec);
    Monitor.print("  pressure_samples_last_sec=");
    Monitor.print(pressureSamplesLastSec);
    Monitor.print("/100  od_state=");
    Monitor.println((int)odState);
  }
}

// ===========================================================================
// 七、pH 監測 (v3.1: 只監測與記錄, 不加鹼)
// ===========================================================================
// v3.1 依需求拿掉 KOH 加鹼控制, 只保留量測 + 校正 + 每秒推播給 Linux 端記錄。
// 保留的部分(與原 ph_control_koh.ino 相同): 256 筆過取樣、溫度補償、突變確認 + EMA 濾波、
// 兩點校正。取樣仍是非阻塞分段(每圈 loop 讀 PH_CHUNK 筆), 不吃掉壓力 100Hz 的時間片。
// 加鹼版(含 D7 KOH 幫浦、劑量模型、安全上限)保留在 v3 的程式碼裡, 之後要恢復可以從那裡拿回來。
//
// 狀態只有三種:
//   WARMUP      開機後還沒拿到第一筆讀值
//   OK          讀值在合理範圍(PH_MIN_OK ~ PH_MAX_OK)
//   PROBE_ERROR 讀值超出合理範圍 —— 探頭沒接、線斷了、或校正值錯了。只是標記, 不影響其他功能

// ---- 腳位 ----
const int PH_PIN = A4;
#if PH_USE_DS18B20
const int PH_DS18B20_PIN = 8;          // v3.8: D8(論壇上 UNO Q 實測可用的腳位; A5 留給 I2C/類比)

// ---- 內嵌 1-Wire 驅動(v3.8.1) ----
// 不用 OneWire / DallasTemperature 函式庫: App Lab 不一定會自動安裝 sketch.yaml 裡的函式庫
// (會出現 OneWire.h: No such file or directory)。這裡的時序與 OneWire 函式庫在非 AVR 平台的
// 「fallback 模式」相同(也是 pinMode/digitalWrite/digitalRead), 只接一顆 DS18B20, 用 Skip ROM。
// 開汲極的作法: 輸出 LOW = 拉低匯流排; 切成 INPUT = 放開, 由 4.7kΩ 上拉回 3.3V。
// v3.9.0: 1-Wire 改走 Zephyr GPIO 直接存取(開汲極模式, 只設定一次)。
// 實機發現: Arduino 的 pinMode() 在 Zephyr 上每次都會重新設定腳位(gpio_pin_configure), 一次要數十 µs,
// 1-Wire 寫 1 的低電位必須 < 15 µs, 讀取要在 15 µs 內取樣 —— 用 pinMode 切換根本來不及,
// 結果是 presence 偶爾抓得到(第一次「有回應」), 之後的指令全部錯亂(「沒有回應」), loop 也被拖到 20 ms 以上。
// 現在: 開機時把 D8 設成「開汲極輸出 + 輸入」一次; 拉低 = 清 bit, 放開 = 設 bit(由 4.7 kΩ 上拉回 3.3 V),
// 讀取 = 讀 port 輸入暫存器。每個動作約 1 µs 以內。設定失敗時才退回舊的 pinMode 寫法。
#define DS_IRQ_LOCK 1          // 快速模式下, 每個位元時槽(< 70 µs)期間關中斷, 避免被打斷而讀錯
static const struct device *owDev = nullptr;
static uint32_t owMask = 0;
static uint8_t owPinIdx = 0;
static bool owFast = false;
static bool owInited = false;

// v3.10.3: 1-Wire 微秒延遲改用「校正過的空迴圈」。
// 實機現象: 第一次 reset 有 presence(找到感測器), 之後讀值一直失敗。reset 的時序容忍度大(480/70 µs),
// 位元時槽卻要求 <15 µs 的精度; 若 Zephyr 的系統計時器是低速 LPTIM(32.768 kHz, 一格 30.5 µs),
// delayMicroseconds()=k_busy_wait() 在個位數 µs 會差到幾十 µs, 寫 1 變成寫 0、讀取取樣點錯過 → CRC 錯。
// 空迴圈的速度只跟 CPU 時脈有關: 開機時用 millis() 量 50 ms 換算「每 µs 幾圈」, 之後位元時槽都用它。
#if defined(__arm__) || defined(__ARM_ARCH)
#define OW_CAN_SPIN 1
#else
#define OW_CAN_SPIN 0          // 電腦上的模擬測試用
#endif
char dsLastErr[48] = "none";
uint8_t  owTiming = OW_CAN_SPIN ? 0 : 1;   // 0 = 校正空迴圈, 1 = delayMicroseconds(k_busy_wait)
uint32_t owLoopsPerUs = 0;      // 顯示用
uint32_t owLoopsPerMs = 0;      // 實際使用(精度較高)
float    owBusy6Us = -1, owSpin6Us = -1;    // 量測: delayMicroseconds(6) / 空迴圈 6 µs 實際花多久
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
  Monitor.print("[ds18b20] 時序校正: 空迴圈 "); Monitor.print((int)owLoopsPerUs);
  Monitor.print(" 圈/µs, delayMicroseconds(6) 實測 "); Monitor.print(owBusy6Us, 1);
  Monitor.print(" µs, 空迴圈 6 µs 實測 "); Monitor.print(owSpin6Us, 1);
  Monitor.print(" µs, 使用 "); Monitor.println(owTiming == 0 ? "空迴圈" : "delayMicroseconds");
}

// v3.10.1: 開汲極同時開內部上拉(約 40 kΩ)當備援; 外部 4.7 kΩ 仍然必要(內部上拉太弱, 長線會失敗)。
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
  Monitor.print("[ds18b20] D8 1-Wire 模式: ");
  Monitor.print(owFast ? "Zephyr GPIO 開汲極(快速)" : "pinMode 切換(相容模式, 時序可能不夠快)");
  Monitor.println(owFast && owIntPullup ? " + 內部上拉" : "");
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

// 回傳 true = 有裝置回應 presence pulse
// owLastFail: 0 = 成功, 1 = 匯流排放開後仍是低電位(上拉電阻沒接上 / DQ 短路到 GND / 接線錯), 2 = 沒有 presence pulse
uint8_t owLastFail = 0;
bool owReset() {
  if (!owInited) owInit();
  owRelease();
  // 匯流排要先是高電位(上拉正常), 最多等 250us
  int retries = 125;
  while (!owSample()) { if (--retries == 0) { owLastFail = 1; return false; } delayMicroseconds(2); }
  owLow();
  delayMicroseconds(480);                 // reset 低電位只要 >= 480us, 被中斷拉長也沒關係
  owLock();
  owRelease();
  owDelay(70);
  bool present = !owSample();
  owUnlock();
  delayMicroseconds(410);
  owLastFail = present ? 0 : 2;
  return present;
}

// v3.10.1: 1-Wire 診斷(開機第一次找不到時自動印出; Bridge "ds_diag" 可隨時呼叫)
//   ext = 關掉內部上拉、放開 1 ms 後的電位(1 = 外部上拉有作用)
//   int = 開內部上拉後的電位(ext=0 但 int=1 → 外部 4.7 kΩ 沒接上; 兩者都 0 → 有東西把線拉到 GND)
//   drive = 拉低時讀到的電位(應為 0; 讀到 1 代表腳位控制不到這條線)
//   pres = reset 後 presence pulse 的開始時間 / 長度(µs, 正常約 15-60 / 60-240; -1 = 沒有)
String owDiagString() {
  if (!owInited) owInit();
  String s = String("pin=D8 port=") + (owDev ? owDev->name : "?") + " idx=" + String(owPinIdx) +
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
  // presence pulse 波形
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
    if (wasLow && presLen < 0) presLen = 999;   // 一直沒回到高電位
    delay(1);
  }
  s += " ext=" + String(ext) + " int=" + String(inr) + " drive=" + String(drv) +
       " pres_start_us=" + String(presStart) + " pres_len_us=" + String(presLen) +
       " intpull=" + String(owIntPullup ? 1 : 0) +
       " timing=" + (owTiming == 0 ? "spin" : "busy") + " loops_us=" + String((int)owLoopsPerUs) +
       " busy6_us=" + String(owBusy6Us, 1) + " spin6_us=" + String(owSpin6Us, 1) +
       " last_err=" + String(dsLastErr);
  const char *hint;
  if (drv == 1)                 hint = "腳位拉不低: 腳位對應錯誤或 D8 被其他功能占用";
  else if (ext == 0 && inr == 0) hint = "線被拉到 GND: 檢查 DQ 是否接到 GND、感測器 VDD/GND 是否接反(會發燙)";
  else if (ext == 0)            hint = "外部 4.7k 上拉沒有作用: 確認 4.7k 一端接 D8(DQ)、另一端接 3.3V";
  else if (presStart < 0)       hint = "上拉正常但感測器沒回應: 檢查 DQ 是否真的接到 D8、VDD 是否接 3.3V、GND 是否共地";
  else if (presLen == 999)      hint = "presence 後線一直是低電位: 感測器異常或 DQ 短路";
  else                          hint = "1-Wire 電氣正常";
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

// DS18B20 指令(單顆, Skip ROM)。上電預設就是 12-bit 解析度, 不必另外設定。
bool dsStartConversion() {
  if (!owReset()) { snprintf(dsLastErr, sizeof(dsLastErr), "convert:no_presence(%u)", owLastFail); return false; }
  owWriteByte(0xCC);   // Skip ROM
  owWriteByte(0x44);   // Convert T (12-bit 約 750ms)
  return true;
}

// 讀 scratchpad 並檢查 CRC; 成功回傳 true, 溫度放 out
bool dsReadTemp(float &out) {
  if (!owReset()) { snprintf(dsLastErr, sizeof(dsLastErr), "read:no_presence(%u)", owLastFail); return false; }
  owWriteByte(0xCC);
  owWriteByte(0xBE);   // Read Scratchpad
  uint8_t sp[9];
  for (uint8_t i = 0; i < 9; i++) sp[i] = owReadByte();
  bool allSame = true;
  for (uint8_t i = 1; i < 9; i++) if (sp[i] != sp[0]) { allSame = false; break; }
  if (allSame) { snprintf(dsLastErr, sizeof(dsLastErr), "all_0x%02X", sp[0]); return false; }   // 全 0x00 / 全 0xFF
  if (owCrc8(sp, 8) != sp[8]) {
    snprintf(dsLastErr, sizeof(dsLastErr), "crc %02X%02X%02X%02X%02X%02X%02X%02X/%02X",
             sp[0], sp[1], sp[2], sp[3], sp[4], sp[5], sp[6], sp[7], sp[8]);
    return false;
  }
  snprintf(dsLastErr, sizeof(dsLastErr), "ok");
  int16_t raw = (int16_t)((sp[1] << 8) | sp[0]);
  out = raw / 16.0f;
  return true;
}
#endif
// DS18B20 狀態: 0 = 沒找到(用手動溫度), 1 = 正常, 2 = 找到但連續讀取失敗(暫用手動溫度)
uint8_t dsState = 0;
uint8_t dsFailCount = 0;
float   dsLastTempC = NAN;
const char *dsStateName() { return dsState == 1 ? "ok" : (dsState == 2 ? "error" : "none"); }

const float PH_MIN_OK = 2.00f;   // 合理範圍，超出視為探頭/線路故障
const float PH_MAX_OK = 12.00f;

// ---- 兩點校正(出廠近似值，務必用標準液重新校正; 此板高 pH 對應低電壓) ----
float PH_V_AT_7 = 1.500f;
float PH_V_AT_4 = 2.000f;
const float PH_CAL_HIGH = 7.00f;
const float PH_CAL_LOW  = 4.01f;
float PH_CAL_TEMP_C = 25.0f;

// ---- 溫度 ----
// v3.4: 沒裝 DS18B20 時, 溫度補償用「手動輸入的溫度」(網頁上可改, Python 會存檔並在 MCU 重開後推回)
float phManualTempC = 37.0f;            // 開機預設值 = 培養溫度

// ---- 濾波 / 取樣 ----
const int   PH_OVERSAMPLE     = 256;   // 每次讀值的過取樣次數(與原版相同)
const int   PH_CHUNK          = 32;    // 每圈 loop() 最多讀幾筆(非阻塞分段)
const unsigned long PH_SAMPLE_INTERVAL_MS = 500;
const float PH_EMA_ALPHA      = 0.20f;
const float PH_SPIKE          = 0.50f; // 單次跳動超過此值視為可疑
const int   PH_SPIKE_CONFIRM  = 3;     // 連續 N 次才接受突變

float    phFiltered    = NAN;
float    phLastVoltage = 0.0f;
bool     phHaveVoltage = false;
float    phTempC       = 37.0f;
int      phSpikeCount  = 0;

// 非阻塞過取樣累加器
uint32_t phAcc = 0;
int      phAccN = 0;
bool     phAccActive = false;
unsigned long phLastSampleStart = 0;
unsigned long phLastNotifyMs = 0;

#if PH_USE_DS18B20
#endif

/* 電壓 -> pH，含溫度補償 (Nernst 斜率 ∝ T(K)，以 pH 7 為軸心) */
float phVoltageToPH(float v, float t) {
  float slope = (PH_CAL_HIGH - PH_CAL_LOW) / (PH_V_AT_7 - PH_V_AT_4);   // pH/V，負值
  slope *= (PH_CAL_TEMP_C + 273.15f) / (t + 273.15f);
  return PH_CAL_HIGH + (v - PH_V_AT_7) * slope;
}

// DS18B20 非阻塞(v3.8 改寫):
//   - 開機找一次位址; 沒找到就每 10 秒重找一次(可以熱插)
//   - 送出轉換後隔 800ms 才讀(12-bit 轉換要 750ms), 不在 loop() 裡空等
//   - 讀到 -127(斷線)、85.0(上電預設值, 代表沒轉換完)或超出 -10~100 °C 視為失敗;
//     連續 3 次失敗就改用手動溫度, 直到再讀到正常值
//   - 獨立於 pH 取樣的時程, 每 1 秒一次
#if PH_USE_DS18B20
bool phTempPending = false;
unsigned long phTempReqMs = 0;
unsigned long dsLastSearchMs = 0;
unsigned long dsSearchCount = 0;
uint8_t dsLastReportFail = 0xFF;
unsigned long dsLastTempLogMs = 0;
bool dsRescanNow = false;
unsigned long dsLastStartMs = 0;

bool dsFind() {
  return owReset();    // 有 presence pulse 就算找到
}
String ds_timing(String arg) {          // v3.10.3: "spin" / "busy" 切換 1-Wire 延遲方式(比較用)
  arg.trim();
  if (arg == "spin" && OW_CAN_SPIN) owTiming = 0;
  else if (arg == "busy") owTiming = 1;
  else if (arg == "cal") { if (!owInited) owInit(); else owCalibrate(); }
  if (dsState != 1) dsRescanNow = true;
  dsFailCount = 0;
  Monitor.print("[ds18b20] 時序方式: "); Monitor.println(owTiming == 0 ? "空迴圈" : "delayMicroseconds");
  return String("timing=") + (owTiming == 0 ? "spin" : "busy") + " loops_us=" + String((int)owLoopsPerUs) +
         " busy6_us=" + String(owBusy6Us, 1) + " spin6_us=" + String(owSpin6Us, 1);
}
String ds_diag(String) {
  String r = owDiagString();
  Monitor.print("[ds18b20] 診斷(網頁要求): "); Monitor.println(r);
  if (dsState != 1) dsRescanNow = true;     // 順便立刻重新搜尋, 不用等 10 秒
  return String("state=") + dsStateName() + " searches=" + String(dsSearchCount) + " " + r;
}
#endif

void dsTick(unsigned long now) {
#if PH_USE_DS18B20
  if (dsState == 0) {
    if (!dsRescanNow && (dsLastSearchMs == 0 ? (now < 5000) : (now - dsLastSearchMs < 10000))) { phTempC = phManualTempC; return; }
    dsRescanNow = false;
    bool firstSearch = (dsLastSearchMs == 0);
    dsLastSearchMs = now;
    dsSearchCount++;
    if (firstSearch) Monitor.println("[ds18b20] 第一次搜尋 D8 ...");
    bool found = dsFind();
    if (found) {
      Monitor.print("[ds18b20] D8 有回應(第 "); Monitor.print(dsSearchCount); Monitor.println(" 次搜尋)");
      dsState = 1; dsFailCount = 0; phTempPending = false; dsLastReportFail = 0xFF;
      Monitor.println("[ds18b20] 找到感測器 (D8)");
    } else {
      // v3.10.2: 每次重新搜尋(10 秒一次)都印一行; 失敗原因改變或每 6 次(約 1 分鐘)再附完整診斷
      Monitor.print("[ds18b20] 搜尋 #"); Monitor.print(dsSearchCount); Monitor.print(": ");
      Monitor.print(owLastFail == 1 ? "匯流排是低電位(上拉沒作用 / 感測器沒供電 / 短路)"
                                    : "上拉正常但沒有 presence 回應(感測器沒接上)");
      Monitor.println(", 10 秒後重試; 目前使用手動溫度");
      if (owLastFail != dsLastReportFail || (dsSearchCount % 6) == 1) {
        Monitor.print("[ds18b20] 診斷: "); Monitor.println(owDiagString());
        dsLastReportFail = owLastFail;
      }
      phTempC = phManualTempC;
      return;
    }
  }
  if (!phTempPending) {
    if (now - dsLastStartMs < 1000) return;
    dsLastStartMs = now;
    if (!dsStartConversion()) {                          // 沒回應: 算一次失敗
      Monitor.print("[ds18b20] 讀取失敗 #"); Monitor.print(dsFailCount + 1); Monitor.print(": "); Monitor.println(dsLastErr);
      if (++dsFailCount >= 3) { if (dsState == 1) { Monitor.println("[ds18b20] 沒有回應, 改用手動溫度"); Monitor.print("[ds18b20] 診斷: "); Monitor.println(owDiagString()); } dsState = 2; phTempC = phManualTempC; }
      if (dsFailCount >= 10) { dsState = 0; dsLastSearchMs = now; Monitor.println("[ds18b20] 失敗太久, 回到每 10 秒重新搜尋"); }
      return;
    }
    phTempPending = true;
    phTempReqMs = now;
  } else if (now - phTempReqMs >= 800) {
    phTempPending = false;
    float t = -127.0f;
    bool rd = dsReadTemp(t);
    bool ok = rd && (t != 85.0f) && (t > -10.0f) && (t < 100.0f);
    if (rd && !ok) snprintf(dsLastErr, sizeof(dsLastErr), t == 85.0f ? "85.0C(轉換沒完成/指令沒收到)" : "out_of_range %.2f", (double)t);
    if (!ok) { Monitor.print("[ds18b20] 讀取失敗 #"); Monitor.print(dsFailCount + 1); Monitor.print(": "); Monitor.println(dsLastErr); }
    if (ok) {
      dsLastTempC = t;
      phTempC = t;
      dsFailCount = 0;
      if (dsState != 1) Monitor.println("[ds18b20] 讀值恢復");
      dsState = 1;
      if (now - dsLastTempLogMs >= 30000) {          // v3.10.2: 正常時每 30 秒印一次溫度
        dsLastTempLogMs = now;
        Monitor.print("[ds18b20] 溫度 "); Monitor.print(t, 2); Monitor.println(" °C");
      }
    } else if (++dsFailCount >= 3) {
      if (dsState == 1) {
        Monitor.print("[ds18b20] 連續讀取失敗(最後讀值 "); Monitor.print(t);
        Monitor.println("), 改用手動溫度");
      }
      dsState = 2;
      phTempC = phManualTempC;
      if (dsFailCount >= 10) { dsState = 0; dsLastSearchMs = now; Monitor.println("[ds18b20] 失敗太久, 回到每 10 秒重新搜尋"); }
    }
  }
#else
  (void)now;
  phTempC = phManualTempC;
#endif
}

/* 一筆新的平均電壓進來: 更新 phFiltered (含突變確認 + EMA) */
void phApplySample(float v) {
  phLastVoltage = v;
  phHaveVoltage = true;
  float raw = phVoltageToPH(v, phTempC);

  if (isnan(phFiltered)) { phFiltered = raw; return; }

  if (fabsf(raw - phFiltered) > PH_SPIKE) {
    if (++phSpikeCount < PH_SPIKE_CONFIRM) return;
  }
  phSpikeCount = 0;
  phFiltered += PH_EMA_ALPHA * (raw - phFiltered);
}

/* 非阻塞取樣: 每 500ms 啟動一輪, 每圈讀 PH_CHUNK 筆, 湊滿 256 筆才算一次讀值 */
void phSamplerTick(unsigned long now) {
  if (!phAccActive) {
    if (now - phLastSampleStart < PH_SAMPLE_INTERVAL_MS) return;
    phLastSampleStart = now;
    phAcc = 0;
    phAccN = 0;
    phAccActive = true;
  }
  for (int i = 0; i < PH_CHUNK && phAccN < PH_OVERSAMPLE; i++) {
    phAcc += (uint32_t)analogRead(PH_PIN);
    phAccN++;
  }
  if (phAccN >= PH_OVERSAMPLE) {
    phAccActive = false;
    float v = ((float)phAcc / PH_OVERSAMPLE) * VREF / ADC_MAX;
    phApplySample(v);
  }
}

const char *phStateName() {
  if (isnan(phFiltered)) return "WARMUP";
  if (phFiltered < PH_MIN_OK || phFiltered > PH_MAX_OK) return "PROBE_ERROR";
  return "OK";
}

String phStatusString() {
  return String("ph=") + (isnan(phFiltered) ? String("nan") : String(phFiltered, 3)) +
         ",v=" + String(phLastVoltage, 4) +
         ",t=" + String(phTempC, 2) +
         ",state=" + phStateName() +
         ",src=" + (dsState == 1 ? "ds18b20" : "manual") +
         ",ds=" + dsStateName();
}

String phConfigString() {
  return String("v7=") + String(PH_V_AT_7, 5) +
         ",v4=" + String(PH_V_AT_4, 5) +
         ",cal_temp=" + String(PH_CAL_TEMP_C, 2) +
         ",temp=" + String(phManualTempC, 2) +
         ",temp_src=" + (dsState == 1 ? "ds18b20" : "manual");
}

/* 每圈 loop() 呼叫: 分段取樣 + 每秒推播 */
void phTick(unsigned long now) {
  dsTick(now);
  phSamplerTick(now);
  if (now - phLastNotifyMs >= 1000) {
    phLastNotifyMs = now;
    Bridge.notify("on_ph_update", phStatusString());
  }
}

// ---- 從 "a=1,b=2" 取出 key 的數值。找到回傳 true (夾閥區、演算法切換也會用到) ----
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

// ---- pH 的 Bridge 介面 (provide_safe 註冊, 在 loop() 的時間片裡執行) ----
String get_ph_status(String arg) { return phStatusString(); }
String get_ph_config(String arg) { return phConfigString(); }

// 接受: v7, v4, cal_temp(校正值), temp(手動溫度, v3.4)。MCU 重開後由 Python 推回存檔值
String set_ph_config(String arg) {
  float v7 = PH_V_AT_7, v4 = PH_V_AT_4, calT = PH_CAL_TEMP_C, tManual = phManualTempC;
  float x;
  if (kvGet(arg, "v7", x))       v7 = x;
  if (kvGet(arg, "v4", x))       v4 = x;
  if (kvGet(arg, "cal_temp", x)) calT = x;
  if (kvGet(arg, "temp", x))     tManual = x;
  if (!(tManual >= 0.0f && tManual <= 80.0f)) return "rejected:temp 0-80";

  if (!(v7 > 0.0f && v7 < VREF && v4 > 0.0f && v4 < VREF)) return "rejected:v7/v4 must be 0-VREF";
  if (fabsf(v7 - v4) < 0.05f)                 return "rejected:v7 and v4 too close";
  if (!(calT > 0.0f && calT < 60.0f))         return "rejected:cal_temp 0-60";

  bool changed = (v7 != PH_V_AT_7) || (v4 != PH_V_AT_4) || (calT != PH_CAL_TEMP_C) ||
                 (tManual != phManualTempC);
  PH_V_AT_7 = v7; PH_V_AT_4 = v4; PH_CAL_TEMP_C = calT;
  phManualTempC = tManual;
  if (dsState != 1) phTempC = phManualTempC;   // 沒有 DS18B20 讀值時立刻生效
  if (changed && phHaveVoltage) {
    // 換了校正斜率: 用目前電壓直接重算, 不經過 EMA / 突變確認
    phFiltered = phVoltageToPH(phLastVoltage, phTempC);
    phSpikeCount = 0;
  }
  Monitor.print("[ph] config: "); Monitor.println(phConfigString());
  return phConfigString();
}

// 兩點校正: 以最近一次 256 筆平均電壓當校正點。拿掉加鹼之後不再需要先暫停。
// v3.4: arg 可以是 "7" 或 "7,25.0"(逗號後是標準液溫度)。標準液通常在室溫, 跟培養液溫度不同;
//       有給就用它當校正溫度, 沒給就用目前的補償溫度。
String ph_calibrate(String arg) {
  arg.trim();
  if (!phHaveVoltage) return "rejected:no voltage yet";
  float v = phLastVoltage;
  float bufT = phTempC;
  int comma = arg.indexOf(',');
  if (comma >= 0) {
    String ts = arg.substring(comma + 1);
    ts.trim();
    float tv = ts.toFloat();
    if (!(tv >= 0.0f && tv <= 80.0f)) return "rejected:buffer temp 0-80";
    bufT = tv;
    arg = arg.substring(0, comma);
    arg.trim();
  }
  if (arg == "7") {
    if (fabsf(v - PH_V_AT_4) < 0.05f) return "rejected:too close to pH4 point";
    PH_V_AT_7 = v;
    PH_CAL_TEMP_C = bufT;
  } else if (arg == "4") {
    if (fabsf(v - PH_V_AT_7) < 0.05f) return "rejected:too close to pH7 point";
    PH_V_AT_4 = v;
  } else {
    return "rejected:point must be 7 or 4";
  }
  phFiltered = phVoltageToPH(v, phTempC);   // 立刻用新斜率重算
  phSpikeCount = 0;
  Monitor.print("[ph] calibrated pH"); Monitor.print(arg);
  Monitor.print(" at V="); Monitor.println(v, 4);
  return String(v, 5);
}

// ===========================================================================
// 八、夾閥 — STS3215 匯流排伺服 (v3, 由 STS3215test 移植)
// ===========================================================================
// 用途: 夾住 retentate 出口管, 讓流體改走膜壁 -> TMP 上升 -> permeate 側流出樣本。
// 只做「開 / 關」兩個位置(使用者決定何時放開), 加上設定用的原始位置移動。
//
// 安全設計(全部在 MCU, Linux 端當掉也有效):
//   1. TMP 瞬時峰值 > tmp_limit 或 Lumen in(Feed) > feed_limit(預設 0.5 bar, 峰值或平均可選), 連續 2 個 200ms 視窗 -> 放開 + FAULT
//   2. 夾閉超過 max_close_s -> 放開 + FAULT
//   3. 伺服溫度 >= VALVE_MAX_TEMP_C -> 放開 + FAULT
//   4. 夾閉中伺服連續 3 次沒回應 -> FAULT(放不開也要讓人知道)
//   5. 開機一律走到「開」的位置; 夾閥在 FAULT 時拒絕夾閉, 須手動解除
//   6. 幫浦緊急停止會一併放開(不鎖 FAULT)
//
// 匯流排 I/O 只在 valveTick() 裡做: Bridge 函式(以及壓力區的安全檢查)只排請求,
// 不會有兩個執行緒同時用 Serial1 的問題。

// v3.4: 包一層 SMS_STS, 統計 Serial1 上「到底有沒有收到任何位元組」。
// 抓不到伺服時, 這個數字可以直接分辨:
//   收到 0 bytes        -> 線路/電源/跳線(訊號根本沒回來): 驅動板沒電、跳線不在 A、RX/TX 接反、沒共地
//   有收到但解析不出來  -> 鮑率不對, 或轉接板把自己送出的資料回送(echo)
//   解析得出來但 ID 不同 -> 伺服 ID 不是設定的那個(自動掃描會找到)
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

// ---- 設定(開機預設值; Python 端會把存檔的設定推回來) ----
uint8_t valveId            = 1;
unsigned long valveBaud    = 1000000UL;   // v3.4: 可改(STS3215 出廠 1 Mbps)
bool    valveScanning      = false;       // v3.4: 自動掃描進行中(掃描邏輯見「八之一」)
int     valvePosOpen       = 2048;   // 「開」的原始位置 —— 必須實測設定
int     valvePosClosed     = 2048;   // 「夾閉」的原始位置 —— 必須實測設定(與 open 相同 = 未設定)
int     valveSpeed         = 1500;   // step/s
int     valveAcc           = 50;     // 1 單位約 100 step/s^2
int     valveTorqueLimit   = 1000;   // 0~1000 (RAM 暫存器 48), 用來限制夾管力道/發熱
unsigned long valveMaxCloseMs = 900000UL;   // 15 分鐘
float   valveTmpLimitBar   = 0.50f;  // 與 constants.json thresholds.tmp_critical_bar 對齊
float   valveFeedLimitBar  = 0.50f;  // v3.10.8: Lumen in(Feed, A0) 上限 1.0 → 0.5 bar
uint8_t valveFeedBasis     = 0;      // v3.10.8: Lumen in 判斷依據 0 = 1 s 滑動視窗的瞬時峰值(較保守), 1 = 同視窗平均值

const int  VALVE_MIN_TRAVEL      = 20;     // open/closed 相差小於這個 step 視為「未設定」
const int  VALVE_INTERLOCK_CONFIRM = 2;    // 連續幾個 200ms 視窗超限才放開
const int  VALVE_MAX_TEMP_C      = 60;
const unsigned long VALVE_POLL_MS        = 500;
const unsigned long VALVE_RESCAN_MS      = 2000;
const unsigned long VALVE_NOTIFY_MS      = 1000;
const int  VALVE_COMM_FAIL_LIMIT = 3;
const unsigned long VALVE_IO_TIMEOUT_MS  = 15;  // SCServo 預設 100ms(會卡住 loop()); v3.4 由 8 放寬到 15ms

enum ValveCmd : uint8_t { VALVE_CMD_OPEN = 0, VALVE_CMD_CLOSED = 1, VALVE_CMD_JOG = 2 };
const char *VALVE_CMD_NAME[] = { "open", "closed", "jog" };

bool     valveOnline     = false;
ValveCmd valveCmd        = VALVE_CMD_OPEN;
bool pumpValveOpen() { return valveCmd == VALVE_CMD_OPEN; }
bool     valveFault      = false;
char     valveMsg[48]    = "";
bool     valveTorqueOn   = false;
unsigned long valveClosedSince = 0;   // 離開 OPEN 的時間點(夾閉/JOG 計時用)

int valvePresentPos = -1, valveGoalPos = -1, valveLoad = 0, valveTempC = -1;
int valveVoltDv = -1, valveCurrent = 0, valveMoving = 0;
int valveCommFails = 0;
int valveInterlockHits = 0;

// ---- 來自 Bridge / 壓力區的請求(loop 裡的 valveTick 才真正執行) ----
volatile bool valveReqOpen     = false;   // 放開(最高優先)
volatile bool valveReqClose    = false;
volatile int  valveReqRaw      = -1;      // 設定用原始位置
volatile int  valveReqTorque   = -1;      // 0/1
volatile bool valveReqReinit   = false;   // 重新 ping / 寫入 torque limit
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

// 由 pressureWindowTick() 每 200ms 呼叫一次
// v3.10.8: 夾閉期間(夾閉中或正在移動往夾閉)只要 TMP 或 Lumen in 超過上限, 連續 2 個 200ms 視窗
// (約 0.4 s) → 自動放開並鎖存 FAULT。整個判斷在 MCU 上, Linux/Python/網頁當掉也有效。
void valveInterlockCheck(float tmpPeakBar, float feedPeakBar, float feedMeanBar) {
  if (valveCmd == VALVE_CMD_OPEN) { valveInterlockHits = 0; return; }
  float feedBar = (valveFeedBasis == 1) ? feedMeanBar : feedPeakBar;
  bool tmpOver = tmpPeakBar > valveTmpLimitBar;
  bool feedOver = feedBar > valveFeedLimitBar;
  if (!tmpOver && !feedOver) { valveInterlockHits = 0; return; }
  if (++valveInterlockHits >= VALVE_INTERLOCK_CONFIRM) {
    valveInterlockHits = 0;
    // 不用 snprintf("%f"): Zephyr 的 printf 不一定有開浮點支援, 改用 String 組字串
    String m = feedOver
               ? String("Lumen in ") + (valveFeedBasis == 1 ? "mean " : "peak ") + String(feedBar, 3) +
                 " bar > " + String(valveFeedLimitBar, 2)
               : String("TMP peak ") + String(tmpPeakBar, 3) + " bar > " + String(valveTmpLimitBar, 2);
    Monitor.print("[valve] !! 壓力過高, 自動放開夾閥: "); Monitor.println(m);
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

// 注意 SCServo 的回傳慣例: 寫入類(WritePosEx / EnableTorque / writeWord)成功回 1、失敗回 0;
// Ping 成功回 ID、失敗回 -1; FeedBack 失敗回 -1。(原 STS3215test 用 ">= 0" 判斷寫入成功,
// 那個條件永遠成立, 這裡改成 "> 0"。)
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

// 連續通訊失敗: 轉離線; 若當下不是「開」, 鎖存 FAULT(放不開一定要讓人知道)
void valveGoOffline(unsigned long now, const char *why) {
  valveOnline = false;
  valveLastScanMs = now;
  if (valveCmd != VALVE_CMD_OPEN) {
    valveFault = true;
    valveSetMsg("servo lost while not open");
    valveReqOpen = true;          // 重新上線時 valveInitOnline() 會走到開
  }
  Monitor.print("[valve] "); Monitor.print(why); Monitor.println(" -> offline");
  valveNotifyNow();
}

// 伺服剛上線(或 ID/扭力上限改了): 寫入扭力上限、開扭力、走到「開」
void valveInitOnline() {
  sts.writeWord(valveId, SMS_STS_TORQUE_LIMIT_L, (u16)constrain(valveTorqueLimit, 0, 1000));
  valveTorqueOn = (sts.EnableTorque(valveId, 1) > 0);
  valveCmd = VALVE_CMD_OPEN;
  valveMoveTo(valvePosOpen);
  Monitor.print("[valve] servo ID "); Monitor.print((int)valveId);
  Monitor.print(" online, moving to OPEN ("); Monitor.print(valvePosOpen); Monitor.println(")");
}

// ===========================================================================
// 八之一、伺服自動掃描 (v3.4)
// ===========================================================================
// 依序試 8 種 STS 系列鮑率; 每個鮑率先送一次廣播 Ping(ID 254, 匯流排上只有一顆時它會回報
// 自己的 ID), 再逐一 Ping ID 0~253。每圈 loop() 只做一次 Ping(最多卡 IOTimeOut = 15ms),
// 不會讓壓力取樣停擺太久。全掃約 30 秒; 掃描期間夾閥暫停一般動作(必須在「開」才能掃)。
const unsigned long VALVE_BAUDS[] = { 1000000UL, 500000UL, 250000UL, 128000UL,
                                      115200UL, 76800UL, 57600UL, 38400UL };
const int VALVE_N_BAUDS = sizeof(VALVE_BAUDS) / sizeof(VALVE_BAUDS[0]);
const int VALVE_SCAN_MAX_FOUND = 8;

bool     valveScanDone = false;
bool     valveScanFull = true;      // false = 只做廣播 Ping(快速, 約 1 秒)
int      valveScanBaudIdx = 0;
int      valveScanId = -1;          // -1 = 這個鮑率還沒做廣播 Ping
int      valveScanFoundN = 0;
uint8_t  valveScanFoundId[VALVE_SCAN_MAX_FOUND];
unsigned long valveScanFoundBaud[VALVE_SCAN_MAX_FOUND];
unsigned long valveScanRx[8];        // 各鮑率收到的位元組數(與 VALVE_BAUDS 對應)
volatile bool valveReqScan = false;
volatile bool valveReqScanFull = true;
volatile int  valveReqBlind = -1;      // v3.5: 盲送測試的目標位置(-1 = 無)
volatile bool valveReqLoopback = false; // v3.6: D0-D1 迴路測試
// v3.8.3: 不可以用全域 String! 有解構子的全域物件會讓編譯器產生 __aeabi_atexit/__dso_handle,
// UNO Q 的 Zephyr 核心(0.90 起)沒有匯出這兩個符號, 整個 sketch 會「載入失敗」——
// 不會有任何錯誤訊息, Serial Monitor 一行 [boot] 都沒有, Python 端所有函式都是 not available。
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
  valveSerialBegin(valveBaud);          // 回到設定中的鮑率
  valveOnline = false;                  // 讓 valveTick 用目前設定重新 ping 一次
  valveLastScanMs = 0;
  Monitor.print("[valve][scan] done, found "); Monitor.println(valveScanFoundN);
  valveReqNotify = true;
}

// 回傳 true 代表這一圈被掃描佔用, valveTick 其餘部分不要執行
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
    int r = sts.Ping(0xFE);             // 廣播: 回應封包裡帶著伺服自己的 ID
    if (r >= 0 && r <= 253) valveScanAddFound(r, baud);
    valveScanId = 0;
    if (!valveScanFull) valveScanId = 254;   // 快速模式: 這個鮑率到此為止
  } else if (valveScanId <= 253) {
    if (sts.Ping((uint8_t)valveScanId) == valveScanId) valveScanAddFound(valveScanId, baud);
    valveScanId++;
  }
  valveScanRx[valveScanBaudIdx] += sts.rxBytes - rx0;

  if (valveScanId > 253) {              // 這個鮑率做完, 換下一個
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

// ---- v3.5: 盲送測試(不需要伺服回應) ----
// 對「廣播 ID 254」送開扭力 + 移動指令。廣播寫入依協定本來就不回應, 所以只要
// TX 線路、驅動板、伺服電源是好的, 不論伺服是什麼 ID、RX 線有沒有接好, 伺服都會動。
// 依序用 8 種鮑率各送一次。用來把「抓不到伺服」拆成兩半:
//   伺服有動  -> TX 與電源 OK, 問題在回應那條路(D0/RX 線、驅動板 RX、TX/RX 接反)
//   伺服沒動  -> TX 那條路或電源有問題(D1/TX 線、跳線帽、驅動板電源、伺服線)
void valveBlindMove(int pos) {
  pos = constrain(pos, 0, 4095);
  Monitor.print("[valve][blind] broadcast move to "); Monitor.print(pos);
  Monitor.println(" at all 8 bauds (no reply expected)");
  for (int i = 0; i < VALVE_N_BAUDS; i++) {
    valveSerialBegin(VALVE_BAUDS[i]);
    delay(2);
    sts.EnableTorque(0xFE, 1);
    sts.WritePosEx(0xFE, (s16)pos, (u16)valveSpeed, (u8)valveAcc);
    delay(5);
  }
  valveSerialBegin(valveBaud);
  valveOnline = false;          // 讓 valveTick 用目前設定重新 ping
  valveLastScanMs = 0;
}

// ---- v3.6: D0/D1 迴路測試(拔掉驅動板, 用一條杜邦線把 D0 和 D1 直接接在一起) ----
// 在 115200 與 1 Mbps 各送 64 個已知位元組, 看能不能原封不動收回來。
// 收得回來 -> UNO Q 的 Serial1(D0/D1)收發都正常, 問題在驅動板 / 電源 / 電壓準位 / 伺服
// 收不回來 -> UNO Q 這端的 D0/D1 就有問題(腳位、核心版本、Serial1 不是 D0/D1)
int valveLoopbackOnce(unsigned long baud) {
  valveSerialBegin(baud);
  delay(5);
  while (Serial1.read() != -1) {}
  int ok = 0;
  for (int i = 0; i < 64; i++) {
    uint8_t b = (uint8_t)(0x55 ^ (i * 37));
    Serial1.write(b);
    unsigned long t0 = millis();
    int r = -1;
    while (millis() - t0 < 10) { r = Serial1.read(); if (r != -1) break; }
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

String valve_blind_move(String arg) {
  long p = arg.toInt();
  if (p < 0 || p > 4095) return "rejected:pos 0-4095";
  if (valveScanning)     return "rejected:scan running";
  if (valveOnline && valveCmd != VALVE_CMD_OPEN) return "rejected:valve must be open";
  valveReqBlind = (int)p;
  return "ok";
}

void valveTick(unsigned long now) {
  // ---- 0. 鎖存來自壓力區的 FAULT ----
  if (valvePendingFault) {
    valvePendingFault = false;
    valveFault = true;
    valveSetMsg(valvePendingMsg);
    Monitor.print("[valve] !! FAULT -> force OPEN: "); Monitor.println(valveMsg);
  }

  // ---- 0.3 迴路測試(v3.6) ----
  if (valveReqLoopback) {
    valveReqLoopback = false;
    valveLoopbackRun();
    return;
  }

  // ---- 0.4 盲送測試(v3.5) ----
  if (valveReqBlind >= 0) {
    int p = valveReqBlind;
    valveReqBlind = -1;
    valveBlindMove(p);
    return;
  }

  // ---- 0.5 自動掃描(v3.4)進行中: 這一圈只做掃描 ----
  if (valveScanTick()) {
    if (now - valveLastNotifyMs >= VALVE_NOTIFY_MS) valveNotifyNow();
    return;
  }

  // ---- 1. 離線: 每 2 秒 ping 一次 ----
  if (valveReqReinit) { valveReqReinit = false; valveOnline = false; valveLastScanMs = 0; }
  if (!valveOnline) {
    if (valveLastScanMs != 0 && now - valveLastScanMs < VALVE_RESCAN_MS) return;
    valveLastScanMs = now;
    if (sts.Ping(valveId) != -1) {
      valveOnline = true;
      valveCommFails = 0;
      valveInitOnline();
      valveReqOpen = false;      // 上線時已經走到 OPEN
      valveReqClose = false;
      valveReqRaw = -1;
      valveNotifyNow();
    } else if (now - valveLastNotifyMs >= VALVE_NOTIFY_MS * 5) {
      valveNotifyNow();          // 離線時也偶爾推一次, 讓畫面知道它還是離線
    }
    return;
  }

  // ---- 2. 執行請求(放開優先) ----
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
    // 失敗但還沒到上限: valveReqOpen 保持 true, 下一圈再試(放開不能只試一次)
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
        valveCmd = VALVE_CMD_JOG;      // 非「開」位置一律受安全放開與計時保護
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

  // ---- 3. 定期讀回狀態 ----
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

  // ---- 4. 計時 / 溫度保護 ----
  if (valveCmd != VALVE_CMD_OPEN) {
    if (now - valveClosedSince >= valveMaxCloseMs) {
      valveRequestOpen("max close time reached", true);
    } else if (valveTempC >= VALVE_MAX_TEMP_C) {
      valveRequestOpen("servo over temperature", true);
    }
  }

  // ---- 5. 推播 ----
  if (valveReqNotify || now - valveLastNotifyMs >= VALVE_NOTIFY_MS) {
    valveReqNotify = false;
    valveNotifyNow();
  }
}

// ---- 夾閥的 Bridge 介面 ----
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

  if (idChanged || tlChanged) valveReqReinit = true;          // 重新 ping + 寫扭力上限 + 走到開
  else if (openChanged && valveCmd == VALVE_CMD_OPEN) valveReqOpen = true;  // 開的位置改了, 跟著走過去
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
// 九、setup / loop
// ===========================================================================
bool bootBannerPrinted = false;

// 原始 I2C 掃描, 獨立於 BH1750 驅動邏輯之外。用來分辨「接線/供電問題」
// (什麼都掃不到或位址不對)與「接線正常但BH1750指令序列失敗」(0x23/0x5C掃得到
// 但 begin() 仍 FAILED)。見 README §2.8。
void i2cScan() {
  // v3.10.4: 只探測兩顆 BH1750 的位址(原本掃 0x01-0x7E 共 126 個; 空板沒有上拉電阻時可能每個都等很久)
  Monitor.println("[boot] I2C: 檢查 BH1750 位址 0x23 / 0x5C ...");
  const uint8_t addrs[2] = { SAMPLE_ADDR, REF_ADDR };
  for (int k = 0; k < 2; k++) {
    Wire.beginTransmission(addrs[k]);
    uint8_t err = Wire.endTransmission();
    char buf[48];
    snprintf(buf, sizeof(buf), "[boot]   0x%02X %s (err=%u)", addrs[k], err == 0 ? "有回應" : "沒有回應", err);
    Monitor.println(buf);
  }
}

String rpc_wd_set(String arg) {         // "en=1,sec=60"
  rpcMark();
  float v;
  if (kvGet(arg, "en", v))  rpcWdEnabled = false;   // v3.10.7: 自動重開已移除, 一律關閉
  if (kvGet(arg, "sec", v)) rpcWdSec = (unsigned long)constrain((long)v, 20L, 3600L);
  return String("en=") + (rpcWdEnabled ? "1" : "0") + ",sec=" + String(rpcWdSec) +
         ",seen=" + (rpcEverSeen ? "1" : "0") + ",calls=" + String(rpcCountTotal);
}
String rpc_test_block(String arg) {      // 測試: N 秒內把收到的呼叫當作沒收到(觸發自我恢復)
  long sec = constrain(arg.toInt(), 0L, 600L);
  rpcTestBlockUntil = sec > 0 ? millis() + (unsigned long)sec * 1000UL : 0;
  Monitor.print("[rpc] 測試: 接下來 "); Monitor.print(sec); Monitor.println(" 秒模擬收不到 Python 呼叫");
  return String("block=") + String(sec) + ",wd=" + (rpcWdEnabled ? "1" : "0") + ",sec=" + String(rpcWdSec);
}

// v3.10.4: Bridge 函式一律在 setup() 一開始就註冊(原本在 I2C/夾閥初始化之後)。
// 新板(核心 1.0.0)實測: 沒接感測器時 I2C 掃描/夾閥 Ping 可能拖很久甚至卡住,
// 這段期間 Python 只會看到 "method ... not available"。先註冊, 就算後面卡住也查得到 get_diag。
void registerBridgeFunctions() {
  Bridge.provide_safe("get_flow_data", get_flow_data);
  Bridge.provide_safe("zero_calibrate", zeroCalibrate);
  Bridge.provide_safe("set_pump_pwm", set_pump_pwm);
  Bridge.provide_safe("set_pump_direction", set_pump_direction);
  Bridge.provide_safe("stop_pump", stop_pump);
  Bridge.provide_safe("get_pump_status", get_pump_status);
  Bridge.provide_safe("get_pump_kick", get_pump_kick);       // v3.10.0
  Bridge.provide_safe("set_pump_kick", set_pump_kick);
  Bridge.provide_safe("get_od_data", get_od_data);
  Bridge.provide_safe("get_blank_info", get_blank_info);
  Bridge.provide_safe("calibrate_blank", calibrate_blank);
  Bridge.provide_safe("trigger_measurement", trigger_measurement);
  Bridge.provide_safe("set_dev_mode", set_dev_mode);
  Bridge.provide_safe("get_dev_readings", get_dev_readings);
  Bridge.provide_safe("set_measure_interval_sec", set_measure_interval_sec);
  Bridge.provide_safe("get_measure_interval_sec", get_measure_interval_sec);
  Bridge.provide_safe("set_path_length_factor", set_path_length_factor);
  Bridge.provide_safe("get_path_length_factor", get_path_length_factor);
  Bridge.provide_safe("set_blank_manual", set_blank_manual);
  Bridge.provide_safe("clear_blank", clear_blank);
  Bridge.provide_safe("set_pressure_offsets", set_pressure_offsets);
  Bridge.provide_safe("get_pressure_offsets", get_pressure_offsets);
  Bridge.provide_safe("get_diag", get_diag);
  Monitor.println("[boot] step: core Bridge functions registered");

  // v3 新增的函式用 provide_safe: 回呼在 loop() 的時間片裡執行, 跟 phTick()/valveTick()
  // 不會同時碰同一組變數(STS3215test 就是用 provide_safe, 已實測可用)。
  Bridge.provide_safe("get_ph_status", get_ph_status);
  Bridge.provide_safe("get_ph_config", get_ph_config);
  Bridge.provide_safe("set_ph_config", set_ph_config);
  Bridge.provide_safe("ph_calibrate", ph_calibrate);
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
  Bridge.provide_safe("get_algorithms", get_algorithms);
#if PH_USE_DS18B20
  Bridge.provide_safe("ds_diag", ds_diag);               // v3.10.1: 1-Wire 電氣診斷
  Bridge.provide_safe("ds_timing", ds_timing);           // v3.10.3
#endif
  Bridge.provide_safe("set_algorithms", set_algorithms);
  Bridge.provide_safe("rpc_wd_set", rpc_wd_set);         // v3.10.6
  Bridge.provide_safe("rpc_test_block", rpc_test_block);
  Monitor.println("[boot] step: v3 Bridge functions registered");
}

void setup() {
  // v3.2 排錯: 移除原本的 Serial.begin(9600)。
  // 新版 UNO Q Zephyr 核心(0.55+)把 Serial 定義成 Arduino_RouterBridge 的 Monitor 別名,
  // Serial.begin() 會「順手」把 Bridge 啟動(含背景的 bridge 執行緒); 緊接著的 Bridge.begin()
  // 又會對那幾個正在被 bridge 執行緒使用的 mutex 重新 k_mutex_init()。運氣不好時 bridge
  // 執行緒會卡死, 結果就是: Python 呼叫 MCU 全部逾時、MCU 端 Bridge.notify() 永遠拿不到
  // 寫入鎖而把 loop() 卡住 —— 感測器全部不更新、幫浦也控制不了。STS3215test 沒有這行,
  // 所以同一塊板子跑它是正常的。

  // v3.8.4: 第一件事 —— 在碰 Bridge 之前就把幫浦腳位鎖在「停止」。
  // 之前的現象: 外部電源先開時 sketch 卡在 Bridge.begin() (看不到 [boot]), 這段期間 D9/D5/D6
  // 還沒被設定成輸出, L298N 的輸入浮接, 幫浦過一陣子會自己轉起來, 馬達的雜訊又可能干擾
  // Bridge 連線。先把腳位拉低, 至少保證 MCU 一開始跑 sketch, 幫浦就不會亂轉。
  pinMode(PUMP_ENA_PIN, OUTPUT); digitalWrite(PUMP_ENA_PIN, LOW);
  pinMode(PUMP_IN1_PIN, OUTPUT); digitalWrite(PUMP_IN1_PIN, LOW);
  pinMode(PUMP_IN2_PIN, OUTPUT); digitalWrite(PUMP_IN2_PIN, LOW);

  // v3.8.4: 不靠 Serial Monitor 的開機診斷燈(板上內建 LED, active LOW):
  //   快閃 2 下         = sketch 已開始執行
  //   接著恆亮          = 正在等 Bridge.begin() / Monitor.begin()
  //   熄滅 → 之後閃 3 下 = Bridge 已連上, 正常往下初始化
  // 看不到 [boot] 時, 看這顆燈就知道卡在哪: 完全不閃 = sketch 沒被載入; 停在恆亮 = 卡在 Bridge。
  pinMode(LED_BUILTIN, OUTPUT);
  for (int i = 0; i < 2; i++) { digitalWrite(LED_BUILTIN, LOW); delay(80); digitalWrite(LED_BUILTIN, HIGH); delay(80); }
  digitalWrite(LED_BUILTIN, LOW);

  // Bridge 必須在 Monitor 之前初始化(Monitor 走同一條 RPC 連線)
  bool bridgeOk = Bridge.begin();
  Monitor.begin();
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);          // 讓 RPC 版的 Monitor 連線穩定後再開始印

  Monitor.println();
  Monitor.print("[boot] 整合版 sketch " FW_VERSION " 啟動中 (OD600 + 流量 + 壓力 + 幫浦 + pH監測 + 夾閥), Bridge.begin=");
  Monitor.println(bridgeOk ? "OK" : "FAILED");
  registerBridgeFunctions();
  Monitor.print("[boot] t="); Monitor.print(millis()); Monitor.println(" ms: Bridge 函式已註冊, 接著初始化感測器");

  // v3: 全域 ADC 解析度, 壓力與 pH 共用(見檔案上方 ADC_BITS 說明)
  analogReadResolution(ADC_BITS);

  // ---- OD600 初始化 ----
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);   // 預設熄滅, 只有量測burst期間才點亮
  Wire.begin();
  { unsigned long t0 = millis(); i2cScan();
    Monitor.print("[boot] I2C 檢查花了 "); Monitor.print(millis() - t0); Monitor.println(" ms"); }
  bool sampleOk = sampleSensor.begin(Wire);
  bool refOk    = refSensor.begin(Wire);
  Monitor.print("[boot] sample sensor    (I2C 0x5C) init: ");
  Monitor.println(sampleOk ? "OK" : "FAILED - check wiring/address/pull-ups");
  Monitor.print("[boot] reference sensor (I2C 0x23) init: ");
  Monitor.println(refOk ? "OK" : "FAILED - check wiring/address/pull-ups");
  lastMeasMillis = millis();

  // ---- 流量計初始化 ----
  pinMode(FLOW_SENSOR_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), handlePulse, RISING);
  pinMode(DEBUG_LED_PIN, OUTPUT);
  for (int i = 0; i < 3; i++) {          // 開機閃三下, 確認板子活著
    digitalWrite(DEBUG_LED_PIN, LOW);    // 內建LED為 active LOW: 亮
    delay(150);
    digitalWrite(DEBUG_LED_PIN, HIGH);   // 滅
    delay(150);
  }
  digitalWrite(DEBUG_LED_PIN, HIGH);
  debugLedState = false;
  lastFlowUpdateMs = millis();

  // ---- 壓力初始化 ----
  lastPressureSampleMs = millis();
  lastPressureWindowMs = millis();

  // ---- 幫浦初始化 ----
  // v3.3: 恢復成舊版(v2.3)的寫法 —— 舊版在你們的板子上幫浦是正常的, 排錯期間不改動它。
  pinMode(PUMP_ENA_PIN, OUTPUT);
  pinMode(PUMP_IN1_PIN, OUTPUT);
  pinMode(PUMP_IN2_PIN, OUTPUT);
  setPumpDirection(true);  // 開機預設正轉方向, 但PWM=0所以不會轉動
  setPumpSpeed(0);         // 開機/重啟一律先確保幫浦停止

  Monitor.println("[boot] step: OD600/flow/pressure/pump init done");

  // ---- pH 監測初始化 (v3.1) ----
#if ENABLE_PH
#if PH_USE_DS18B20
  // v3.8.2: 不在 setup() 裡碰 1-Wire。改由 loop() 開機 5 秒後才第一次搜尋,
  // 就算 1-Wire 出問題, Bridge 函式也已經註冊好, Python 端不會整個連不上。
  dsState = 0;
  Monitor.println("[boot] DS18B20 (D8): 開機 5 秒後於 loop() 中搜尋");
#endif
  Monitor.println("[boot] pH monitor: A4 (只監測記錄, 不加鹼)");
#else
  Monitor.println("[boot] pH monitor DISABLED (ENABLE_PH = 0)");
#endif

  // ---- 夾閥 STS3215 初始化 (v3) ----
#if ENABLE_VALVE
  Monitor.println("[boot] step: valve init (Serial1 D0/D1 @1Mbps)...");
  // Zephyr 平台 0.55.0 起: Serial = Monitor(走 Bridge), Serial1 = D0/D1 硬體 UART
  valveSerialBegin(valveBaud);          // STS3215 出廠鮑率 1 Mbps; IOTimeOut 在裡面設成 15ms
  unsigned long vt0 = millis();
  bool vping = (sts.Ping(valveId) != -1);
  Monitor.print("[boot] 夾閥 Ping 花了 "); Monitor.print(millis() - vt0); Monitor.println(" ms");
  if (vping) {
    valveOnline = true;
    valveInitOnline();                 // 開機一律走到「開」(fail-safe)
  } else {
    Monitor.print("[boot] valve servo ID "); Monitor.print((int)valveId);
    Monitor.println(" not found, will retry every 2 s (check driver-board power, jumper=A, RX->RX/TX->TX, GND, ID)");
  }
  valveLastScanMs = millis();
  Monitor.println("[boot] step: valve init done");
#else
  Monitor.println("[boot] valve DISABLED (ENABLE_VALVE = 0)");
#endif


  lastDiagMs = millis();

  Monitor.print("[boot] Bridge ready. 第一次OD600自動量測將在 ");
  Monitor.print(measureIntervalMs / 1000);
  Monitor.println(" 秒後(或由Python端呼叫 trigger_measurement 提前執行)。");
}

void loop() {
  // 某些 App Lab 版本會漏掉 setup() 期間印出的 Monitor 訊息(Console還沒接上),
  // 這行是 canary: 只看到這行、看不到上面的 [boot] 訊息, 代表程式其實正常,
  // 只是 Console 接上的時機問題。
  if (!bootBannerPrinted) {
    Monitor.println("[boot] entering loop() - Monitor link confirmed alive.");
    bootBannerPrinted = true;
  }

  unsigned long loopStartUs = micros();
  unsigned long now = millis();

  pumpTick(now);   // v3.10: 啟動助推結束後降回目標 PWM

  // --- 流量 ---
  logRawPulseIfAny();
  if (now - lastFlowUpdateMs >= FLOW_UPDATE_INTERVAL_MS) {
    update_flow();
  }

  // --- 壓力: 100Hz取樣進滑動視窗, 每200ms統計並推播 ---
  if (now - lastPressureSampleMs >= PRESSURE_SAMPLE_INTERVAL_MS) {
    lastPressureSampleMs = now;
    pressureSampleTick();
  }
  if (now - lastPressureWindowMs >= PRESSURE_WINDOW_UPDATE_MS) {
    lastPressureWindowMs = now;
    pressureWindowTick();
  }

  // --- OD600: 非阻塞狀態機, 每次最多做一筆I2C讀取(約0.3ms) ---
  odTick();

  // --- 感測器重新初始化(分段, 不阻塞) ---
  reinitTick();

  // --- pH: 分段過取樣 + 每秒推播 (v3.1 只監測) ---
#if ENABLE_PH
  phTick(now);
#endif

  // --- 夾閥: 執行請求 / 讀回狀態 / 計時與溫度保護 (v3) ---
#if ENABLE_VALVE
  valveTick(now);
#endif

  // --- 即時性診斷: 每秒統計一次 loop 最大耗時與實際壓力取樣筆數 ---
  unsigned long loopUs = micros() - loopStartUs;
  if (loopUs > loopMaxUs) loopMaxUs = loopUs;
  diagTick(now);

  // 注意: Bridge註冊的函式不可用delay(), 所有耗時邏輯都放在loop()背景執行
}
