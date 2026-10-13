# ReLeaf Perfusion Hollow Fiber Bioreactor

Arduino UNO Q（App Lab）上的中空纖維灌流生物反應器監控 App：OD600、流速、三點壓力與膜過濾衍生參數、pH、溫度、蠕動幫浦、STS3215 夾閥，以及板上 CSV 錄製。

| 檔案 | 目前版本 | 位置 |
|---|---|---|
| MCU 韌體 | **v3.10.9** | `sketch/sketch.ino` |
| Python 後端 | **v4.12** | `python/main.py` |
| 網頁介面 | **v4.13** | `assets/index.html` |
| 常數設定 | 2026-10-08 | `python/constants.json` |

> 本文件描述「現在的系統」。2026-10-08 以前逐版累積的舊版說明保留在 `docs/README_legacy_2026-10-08.md`；完整版本歷史另見 Claude Docs「ReLeaf 灌流中空纖維生物反應器 — 版本歷史」。

---

## 目錄

1. [系統概觀](#1-系統概觀)
2. [檔案結構與需求](#2-檔案結構與需求)
3. [硬體與接線](#3-硬體與接線)
4. [電氣安全規則（必讀）](#4-電氣安全規則必讀)
5. [部署與開機](#5-部署與開機)
6. [首次設定流程](#6-首次設定流程)
7. [網頁介面](#7-網頁介面)
8. [量測與計算](#8-量測與計算)
9. [安全保護機制](#9-安全保護機制)
10. [資料記錄](#10-資料記錄)
11. [設定的存檔、輸出與輸入](#11-設定的存檔輸出與輸入)
12. [MCU 與 Python 的通訊](#12-mcu-與-python-的通訊)
13. [疑難排解](#13-疑難排解)
14. [已知限制與待辦](#14-已知限制與待辦)
15. [版本沿革（摘要）](#15-版本沿革摘要)

---

## 1. 系統概觀

```
┌──────────── Arduino UNO Q ────────────────────────────────────────┐
│  MCU（STM32U585, Zephyr）          Linux（Debian, Docker）          │
│  sketch.ino                         python/main.py  ── WebUI :7000 ─┼─▶ 瀏覽器
│   ├ 100 Hz 壓力取樣、統計            ├ 聚合取樣、衍生參數、告警        │
│   ├ OD600 狀態機、流量計數            ├ CSV 錄製（板上 recordings/）   │
│   ├ pH、DS18B20                      ├ 校正值與設定的存檔／還原        │
│   ├ 幫浦 PWM、啟動助推               └ ΔP–Q 掃描、測試工具            │
│   └ 夾閥與所有安全連鎖                                                │
│          ▲  Bridge（arduino-router）                                  │
└──────────┼────────────────────────────────────────────────────────┘
```

MCU 與 Python 之間有兩個方向：

| 方向 | 用途 |
|---|---|
| MCU **主動推送**（`Bridge.notify`） | 壓力（每 200 ms）、流量（每秒）、pH 與溫度（每秒）、OD600（每次量測完）、夾閥狀態 |
| Python **呼叫** MCU（`Bridge.call`） | 幫浦與夾閥指令、校正、設定、診斷（每 5 s）；流量只在沒收到推送時（舊韌體）才輪詢 |

所有安全保護（夾閥自動放開、幫浦急停）都在 MCU 上執行，Linux、Python 或網頁當掉也有效。

**感測資料全部由 MCU 主動推送**（v3.10.9 起流量也是）。因此即使「Python → MCU」的指令通道斷掉，壓力、流量、pH、溫度、OD600、夾閥狀態都會繼續寫進 CSV；斷線期間只是無法操作幫浦與夾閥。資料由板上的 Python 寫檔，與瀏覽器是否開著無關。

---

## 2. 檔案結構與需求

```
app.yaml                 App 名稱「ReLeaf Perfusion HFB」，宣告 arduino:web_ui brick
sketch/sketch.ino        MCU 韌體
sketch/sketch.yaml       需要的函式庫：SCServo (1.0.2)
python/main.py           後端
python/constants.json    常數（膜模組規格、門檻、夾閥預設）
python/requirements.txt  空檔即可
assets/index.html        網頁
assets/libs/             由 WebUI brick 自動放入（socket.io、arduino.js）
README.md                本文件
docs/                    舊版說明、技術文件
```

執行後在 `python/` 底下自動產生：

| 檔案 | 內容 |
|---|---|
| `calibration_state.json` | OD600 blank、壓力零點、光程係數 |
| `ph_valve_state.json` | pH 校正、夾閥設定、演算法、HFM 狀態（ρgh、ΔP–Q）、規格覆寫、幫浦助推等 |
| `recordings/*.csv` | 錄製檔與中途存檔 |
| `recording_state.json` | 錄製進度標記（中斷後接續用） |

**需求**

- Arduino App Lab；板子核心 `arduino:zephyr`（新板為 1.0.0，舊板 0.90.0 皆已實測）
- MCU 函式庫：`Arduino_RouterBridge`（App Lab 自帶）、`SCServo 1.0.2`（sketch.yaml 會加入）
- 不需要 OneWire：DS18B20 驅動已內嵌

---

## 3. 硬體與接線

> UNO Q 的 MCU 腳位是 **3.3 V 邏輯**，請一律視為**不耐 5 V**。所有外部訊號進入前都要確認 ≤ 3.3 V。

### 3.1 腳位表

| 腳位 | 用途 | 方向 | 備註 |
|---|---|---|---|
| D0 / D1 | STS3215 夾閥（Serial1，1 Mbps） | RX / TX | 經 Waveshare Bus Servo Adapter (A) |
| D2 | ZJ-TM02 流量計 | 輸入（中斷） | 訊號須分壓到 ≤ 3.3 V |
| D3 | OD600 LED（經 2N2222） | 輸出 | 1.2 kΩ 到基極 |
| D5 / D6 | L298N IN1 / IN2（幫浦方向） | 輸出 | |
| D7 | 空 | — | 規劃：外部電源繼電器 |
| D8 | DS18B20 溫度計 DQ | 開汲極 | 4.7 kΩ 上拉到 **UNO Q 3.3 V** |
| D9 | L298N ENA（幫浦 PWM） | 輸出 | |
| A0 | 壓力 Feed = **Lumen in**（P_in） | 類比 | 15 k／22 k 分壓 |
| A1 | 壓力 Retentate = Lumen out（P_out） | 類比 | 同上 |
| A2 | 壓力 Permeate = Shell（P_s） | 類比 | 同上 |
| A4 | pH 探頭（DFRobot SEN0169-V2） | 類比 | 建議經類比隔離模組 |
| SDA / SCL | BH1750 ×2（OD600） | I2C | sample `0x5C`、reference `0x23` |

### 3.2 壓力變送器 ×3

變送器 12 V 供電，輸出 0–5 V 對應 0–10 bar。每一顆各自一組分壓：

```
變送器訊號 ──[15 kΩ]──┬── A0 / A1 / A2
                      [22 kΩ]
                       │
                      GND        比例 0.5946：5 V → 2.97 V
```

換電阻只要改 sketch 的 `DIV_R_TOP_KOHM`、`DIV_R_BOTTOM_KOHM`。建議用電表量實際阻值填入。

### 3.3 流量計（ZJ-TM02）

5 V 供電，訊號經分壓後接 D2，脈衝高電位須 ≤ 3.3 V。`PULSES_PER_LITER = 2580`（大孔版本；小孔版本改 5160）。

### 3.4 OD600

```
D3 ──[1.2 kΩ]──┬── 2N2222 基極
              [10 kΩ]── GND
5 V ──[330 Ω]── LED ── 集極；射極 ── GND
```

BH1750（GY-302）×2：SDA/SCL 接 UNO Q；ADDR 接 3V3 為 sample（`0x5C`），接 GND 為 reference（`0x23`）。**建議 VCC 接 3.3 V**，避免模組的上拉電阻把 SDA/SCL 拉到 5 V。

### 3.5 蠕動幫浦（L298N）

```
UNO Q D9 ──[1 kΩ]── ENA（跳線帽拔掉後，與 5V 不導通的那根針）
UNO Q D5 ──[1 kΩ]── IN1
UNO Q D6 ──[1 kΩ]── IN2
UNO Q GND ───────── GND（只共地，不走馬達電流）

ENA、IN1、IN2 各加 10 kΩ 到 GND（下拉：MCU 重開或腳位懸空時幫浦一定停止）

12 V(+) ──┬────────┬──── L298N +12V        470 µF（≥25 V，注意極性）
       [470µF]  [100nF]                    100 nF 陶瓷
12 V(−) ──┴────────┴──── L298N GND
```

- **5V 跳線保留**（模組自己由 12 V 產生邏輯 5 V），**+5V 端子空著不接**，絕不接到 UNO Q。
- **ENA 跳線帽一定要拔掉**。用電表確認：與 +5V 端子導通的是 5 V 針，另一根才是 ENA。
- 馬達電流直接回 12 V 電源，不要經過 UNO Q 的 GND。
- 12 V 電源不可超過 12 V（模組穩壓器上限）。

### 3.6 pH 探頭

DFRobot SEN0169-V2，OUT → A4（建議經類比隔離模組），輸出 0–3.0 V。

### 3.7 DS18B20 溫度計（防水探頭）

```
UNO Q 3.3V ──┬──────────── 紅（VDD）
           [4.7 kΩ]
UNO Q D8 ────┴──────────── 黃／白（DQ）
UNO Q GND ──────────────── 黑（GND）
```

- 防水探頭內部**沒有**上拉電阻，4.7 kΩ 必須自己加；電阻是 DQ 對 **3.3 V**，不是對 GND。
- VDD 與上拉都接 **UNO Q 的 3.3 V**，不要接供電板。感測器沒電時會把 DQ 拉低並造成倒灌。
- 色碼以賣家標示為準。VDD／GND 接反會發燙損壞。

### 3.8 STS3215 夾閥

```
UNO Q D0 (RX) ──[1 kΩ]── 驅動板 RX     Waveshare 標示：RX→RX、TX→TX（不交叉）
UNO Q D1 (TX) ──[1 kΩ]── 驅動板 TX
UNO Q GND ────────────── 驅動板 GND
驅動板跳線：A（UART 模式）；電源 = 伺服額定電壓（12 V 版給 12 V）
```

實測驅動板 TX／RX 為 3.3 V 邏輯。驅動板有自己的電源，UNO Q 沒電時它仍會經 D0／D1 送電，所以要串電阻並遵守上電順序。

---

## 4. 電氣安全規則（必讀）

2026-10 已燒毀兩塊 UNO Q（3.3 V 對 GND 短路、板背電源晶片發熱）。程式碼經逐行檢查，無法造成這種損壞；原因在外部電壓或電流進入 UNO Q。以下規則全部適用：

1. **任何改線前，所有電源（12 V、供電板、UNO Q）都要先斷電。** 不在通電時插拔、不「先插新線再拔舊線」。
2. **UNO Q 的 3.3 V、5 V、VIN 腳只往外供電給小負載**（溫度計、上拉電阻），絕不與供電板、L298N 或任何外部電源相接。
3. **上電順序**：先 UNO Q（USB-C），等 Serial Monitor 出現 `[boot] … entering loop()`，再開 12 V 與供電板；關機反過來。外部電源先開會從訊號腳倒灌，使 MCU 無法開機，長期可能燒毀。
4. **每條訊號線串限流電阻**：D0、D1、D5、D6、D9 各 1 kΩ；D2、A0–A2、A4 各 4.7 kΩ。即使線上意外出現 5 V／12 V，電流也被限制。
5. **所有進入 UNO Q 的訊號 ≤ 3.3 V**。接新板前，拔掉 UNO Q、打開所有外部電源，用電表量每條線：
   - D0、D2、SDA、SCL、A0–A4：≤ 3.3 V
   - 原本接 UNO Q 3.3 V／5 V／VIN 的線：0 V
   - 量到 3 V 以上的線，並接 1 kΩ 到 GND 再量；電壓幾乎不掉代表推得出電流，要特別處理。
6. **L298N**：見 §3.5（拔 ENA 跳線、+5V 空接、12 V 端並電容、10 kΩ 下拉、星狀接地）。
7. **液體**：系統有培養液，檢查麵包板與接線附近沒有液體或乾掉的鹽漬。
8. **新板第一次只接 USB** 跑 `mcu_selftest`，正常後再一組一組接回周邊，每接一組重開一次確認。

**根本解法（待實作）**：外部電源由 MCU 控制的繼電器或負載開關供電（D7），MCU 開機完成後才通電，UNO Q 斷電時外部電源也一起斷。

---

## 5. 部署與開機

1. App Lab → Import App → 選完整 App zip（或整檔取代 `sketch.ino`、`main.py`、`index.html`，不要複製貼上片段）。
2. 執行。App Lab 輸出視窗應看到 `SCServo` 被加入、`Sketch uses … bytes`、燒錄完成。
3. Serial Monitor 應依序出現：
   ```
   [boot] 整合版 sketch v3.10.8 啟動中 … Bridge.begin=OK
   [boot] t=… ms: Bridge 函式已註冊, 接著初始化感測器
   [boot] I2C 檢查花了 … ms
   [boot] entering loop()
   ```
4. 瀏覽器開 `http://<板子 IP>:7000`（不要用檔案預覽）。換檔後按 Ctrl+Shift+R，確認狀態列顯示「MCU：正常（v3.10.8）」、`main.py v4.11`、`UI v4.12`。
5. 開機後 LED 燈號：快閃 2 下 → 恆亮（連接 Bridge）→ 熄滅後閃 3 下（初始化完成）。完全不閃 = sketch 沒載入；停在恆亮 = 卡在 Bridge。

**MCU 完全沒回應（沒有 `[boot]`、Python 顯示 `method … not available`）**：拔掉 UNO Q 的 USB-C，等 10 秒以上再插回。重新執行 App 不會重開 Linux 端的 Bridge 服務。

---

## 6. 首次設定流程

新組管路、換膜或換板子後依序做：

1. **壓力歸零**：洩壓（通大氣）狀態下按「壓力歸零」。
2. **ρgh 自檢**：停泵（PWM 0）→「開始自檢」。等 10 s 流動衰減、記錄 30 s，讀數須為平台（≤ 0.15 kPa/min）。
3. **ΔP–Q 掃描**：乾淨的膜、夾閥放開 → 填 PWM 點 → 開始掃描 → 檢查結果後套用擬合（§7.3）。
4. **pH 校正**：pH 7.00 → pH 4.01 標準液，溫度預設用溫度計（溫度計要一起放進標準液）。
5. **夾閥位置**：移動伺服到剛好夾住管子 →「目前位置記為夾閉」；開的位置同理。
6. **操作參數**：確認 Q_L 來源、Q_perm、培養體積（§7.2）。
7. **輸出校正值**備份（§11）。

---

## 7. 網頁介面

三欄版面：生長參數｜壓力與膜過濾監測｜控制。預設英文，可切換正體中文（記在瀏覽器）。帶「ⓘ」或可點擊的數值會跳出說明（意義與正常範圍）。

### 7.1 生長相關參數

- **OD600**：每 30 s 自動量測一次（可在取樣設定調整），可在工程模式校正 blank。
- **pH**：每秒更新；溫度補償預設使用溫度計，讀不到才用手動溫度。
- **溫度**：DS18B20 讀值、來源（溫度計／手動）、狀態；「溫度計診斷／立即重新搜尋」按鈕。讀不到時 Serial Monitor 每 10 s 印一行 `[ds18b20] 搜尋 #N: 原因`，正常時每 30 s 印溫度。

### 7.2 壓力與膜過濾監測

- 數值方塊：TMP_out、ΔP 比值、γ_ratio、剪切率、L_p、J、D 等（§8.4）。
- **操作參數輸入**：Q_L 來源（流量計／手動）與手動 Q_L、Q_perm（可用「收集量 g ÷ 時間 min」計算）、培養體積 V。
- 趨勢圖：堵塞指標（γ_ratio、ΔP 比值）、L_p；P_out 瞬時波形。
- 「重力 offset 自檢與設定」：ρgh 自檢、手動 ρgh／a／b／Q_perm、以目前狀態設為 ΔP 基準（單點縮放）、ΔP–Q 掃描。

### 7.3 ΔP–Q 掃描

- 填 2–10 個 PWM 點、掃描順序（預設**由高到低**，避免低 PWM 從靜止起動不穩）、每點穩定時間（20 s）與記錄時間（30 s）。
- 每點記錄 ΔP_total = P_in − P_out 與流量，ΔP_friction = ΔP_total − ρgh。
- 擬合過原點的二次 `a·Q + b·Q²` 與線性 `a·Q`，顯示 R² 與殘差；b < 0 時建議線性。按「套用」才寫入。
- 掃描結束恢復原本的 PWM；途中手動改 PWM 或急停會中止，且不會把幫浦開回去。
- 量測點與擬合結果（含 `dp_total_kpa`，ρgh 重測後可重新擬合）都會存檔並可輸出。

### 7.4 蠕動幫浦

- PWM 拉桿或輸入格只是預覽，按「套用」才送出；切換方向或急停會先把 PWM 歸零。急停同時放開夾閥。
- 流速卡片點一下開啟流速即時曲線。
- **啟動助推**：從停止啟動時先以助推 PWM（預設 255）跑 500 ms 再降回目標值，解決低 PWM 起動不了的問題。選用「停轉自動再助推」：流量計 3 s 無脈衝時再助推一次，最多 3 次，夾閥未開時不做。

### 7.5 夾閥（STS3215）

夾閉／放開、已夾閉時間、即時 TMP、FAULT 與「解除」、事件紀錄（每次夾閉的時長、TMP 平均／峰值、放開原因）。夾閥設定包含開／夾閉位置、**TMP 上限**、**Lumen in 上限與判斷依據**、最長夾閉時間、扭力、速度、伺服 ID 與鮑率、自動掃描、D0–D1 迴路測試。

### 7.6 資料記錄

開始、暫停、停止並存檔、**中途存檔**、定時錄製、板子上的錄製檔清單（§10）。

### 7.7 其他面板（預設收合）

- **取樣設定**：取樣視窗長度、聚合方式（中位數／平均）。
- **pH 探頭校正**、**校正值管理**（含輸出／輸入、手動輸入 pH 兩點校正值）、**規格管理**（膜模組幾何、體積、流體性質、告警門檻）。
- **演算法切換**：流量、OD600 估計、分析來源、聚合、穩態、曲率。
- **工程模式**：OD600 blank／立即量測／光程係數、LED 對光模式（強制恆亮與即時比值）、**MCU 連線狀態與測試**（§12）。

---

## 8. 量測與計算

單位基準：壓力 **bar**（衍生參數用 kPa）、流速 **mL/min**、OD600 **AU**。

### 8.1 壓力

```
V_pin    = ADC / (2^14 − 1) × 3.3 V        （14-bit，16 點過取樣，丟棄換通道後第一筆）
V_sensor = V_pin / 0.5946
bar      = V_sensor / 5.0 × 10.0 − offset
```

100 Hz 取樣 → 1 s 滑動視窗 → 每 200 ms 統計 peak／trough／mean／脈動頻率並推送。

### 8.2 流量

`flow (mL/min) = 脈衝頻率 × 60 / 2580 × 1000`；兩脈衝間隔 < 500 µs 視為彈跳。

### 8.3 OD600

`OD600 = log10(blankRatio / ratio) × pathLengthFactor`，ratio = (sample 亮 − 暗)／(ref 亮 − 暗)；pathLengthFactor 預設 5.0。每次量測：4 筆暗電流 → LED 亮 60 ms → 16 筆 burst → MAD 剔除氣泡 → 拒收 > 50% 重試一次，全程非阻塞。

### 8.4 膜過濾衍生參數（kPa）

| 參數 | 定義 |
|---|---|
| TMP_out | P_out − P_s；嚴格版用最近數秒 P_out 波谷 − P_s |
| ΔP_friction | (P_in − P_out) − ρgh（扣除垂直模組水柱） |
| ΔP 比值 | ΔP_friction ÷ (a·Q + b·Q²) |
| τ_w | ΔP_friction × d ÷ (4L) |
| γ_pressure | τ_w ÷ μ |
| γ_flow | 8v ÷ d（約 Q × 15.4） |
| γ_ratio | γ_pressure ÷ γ_flow（主要堵塞指標） |
| J、L_p、D | J（LMH）由 Q_perm 與膜面積；L_p = J ÷ TMP_mean（長期主判據）；D = Q_perm × 0.06 ÷ V |
| 其他 | Re、TMP_in、TMP 不均勻度、R_t、τ_shell |

Q_L 預設來自流量計，可改手動。比值類參數在 Q_L < 10 mL/min 時不計算。

**告警**：TMP_out ≤ 0（倒流風險）、P_out 波谷 − P_s ≤ 0、ΔP 比值 > 1.3、γ_ratio > 1.3、L_p < 初始值 70%、P_s 無故上升 > 2 kPa。夾閥夾閉時會暫停與夾閉直接相關的告警。

### 8.5 pH 與溫度

每 500 ms 一筆（256 點過取樣、非阻塞），Nernst 斜率依溫度補償，突變需連續 3 次確認，EMA 濾波。讀值超出 2–12 標記 PROBE_ERROR，不寫入 CSV 的 pH。

---

## 9. 安全保護機制

全部在 MCU 執行，不依賴 Linux 或網頁。

### 9.1 夾閥自動放開

| 觸發條件（夾閉中） | 動作 |
|---|---|
| **Lumen in（P_in, A0）> `feed_limit`**（預設 **0.5 bar**），連續 2 個 200 ms 視窗（約 0.4 s） | 放開 + 鎖存 FAULT |
| TMP 瞬時峰值 > `tmp_limit`（預設 0.5 bar），連續 2 個視窗 | 放開 + 鎖存 FAULT |
| 夾閉時間 > `max_close_s`（預設 900 s） | 放開 + 鎖存 FAULT |
| 伺服溫度 ≥ 60 °C | 放開 + 鎖存 FAULT |
| 夾閉中伺服連續 3 次沒回應 | 鎖存 FAULT；重新上線時自動走到「開」 |
| 幫浦急停 | 放開（不鎖 FAULT） |
| MCU 開機 | 一律走到「開」 |

- Lumen in 判斷依據可選：**瞬時峰值**（預設，較保守，含蠕動幫浦脈動）或**平均值**（最近 1 秒滑動視窗的平均，較不會因脈動誤觸）。在「夾閥設定」修改。
- 觸發時 Serial Monitor 印 `[valve] !! 壓力過高, 自動放開夾閥: Lumen in peak 0.549 bar > 0.50`，網頁顯示 FAULT，事件紀錄寫入放開原因。
- FAULT 狀態下拒絕夾閉，必須先排除原因再按「解除」。
- 舊存檔中的 Lumen in 上限若仍是舊預設 1.0 bar，升級後第一次啟動會自動改成 0.5 bar（只做一次；之後自己改的值不再變動）。

### 9.2 幫浦

開機第一步把 D9／D5／D6 拉低；急停把 PWM 歸零並放開夾閥。硬體上建議再加 10 kΩ 下拉（§3.5）。

---

## 10. 資料記錄

- 錄製完全在板子上進行：每個取樣視窗（預設 30 s）結束就立即寫入並 fsync 到 `python/recordings/record_YYYYMMDD_HHMMSS.csv`。電腦休眠、關瀏覽器、甚至 App 重啟都不會中斷；App 重啟後自動接續同一個檔，`gap_s` 欄標出中斷時間。
- **中途存檔**：錄製或暫停中按「💾 中途存檔」，把到目前為止的 CSV 複製成 `原檔名_checkpoint_YYYYMMDD_HHMMSS.csv` 並自動下載，錄製不中斷。
- 讀不到的資料留空，不會以 0 寫入（例如流量既沒有推送、輪詢也失敗時，該視窗的流量欄為空白，網頁流速卡片變淡）。
- 下載：停止時自動下載；或從「板子上的錄製檔」清單（HTTP 端點 `/download/recording?name=…`）。

**CSV 欄位（73 欄）**

| 群組 | 欄位 |
|---|---|
| 視窗 | window_index, elapsed_s, timestamp_start, timestamp_end, window_sec, gap_s, agg_method, n_samples_pressure, n_samples_flow, partial |
| OD600 | od600_au, od600_lux_sample, od600_lux_ref, od600_bubble_pct, od600_valid, od600_blank_set, od600_age_s, od600_new |
| 流量 | flow_mlmin, flow_freq_hz, flow_total_ml |
| 壓力 | pressure_feed_bar, pressure_retentate_bar, pressure_permeate_bar, pressure_tmp_bar, pressure_tmp_peak_bar, pressure_tmp_trough_bar, pressure_cycle_freq_hz |
| 幫浦／pH／夾閥 | pump_pwm, pump_forward, ph, ph_temp_c, temp_src, ph_state, valve_state, valve_closed_frac, valve_pos |
| 衍生參數 | delta_p_bar, rho_gh_kpa, tmp_out_kpa, tmp_out_min_kpa, dp_friction_kpa, dp_ratio, tau_w_pa, gamma_pressure_s1, gamma_flow_s1, gamma_ratio, re, tmp_mean_kpa, tmp_in_kpa, tmp_nonuniformity, ps_kpa, q_perm_mlmin, j_lmh, lp_lmh_bar, d_actual_h, rt_m1, tau_shell_min |
| 趨勢與穩態 | dtmp_dt_bar_per_min, d2tmp_dt2, steady |
| 視窗內離散 | tmp_sd_bar, tmp_iqr_bar, tmp_min_bar, tmp_max_bar, feed_sd_bar, flow_sd_mlmin, flow_iqr_mlmin, flow_min_mlmin, flow_max_mlmin |
| 追溯 | alg_profile, config_version, constants_version |

夾閥事件另存 `recordings/valve_events.csv`。

---

## 11. 設定的存檔、輸出與輸入

所有設定在修改時自動存檔；MCU 重開（uptime 變小）時 Python 自動推回校正值、pH、夾閥、助推設定，並把幫浦恢復成重開前的方向與 PWM。

「校正值管理」→「輸出校正值」產生 `.json`；「輸入校正值」可勾選要套用的區段：

| 區段 | 內容 |
|---|---|
| mcu_calibration | OD600 blank、壓力零點、光程係數 |
| ph_config | pH 7／4 電壓、校正溫度、手動溫度 |
| hfm | ρgh、P_s 參考、ΔP–Q a／b 與來源、ΔP–Q 量測點與擬合、Q_perm、L_p 初始值、Q_L 來源與手動值 |
| specs | 膜模組幾何、體積、流體性質、告警門檻 |
| valve_config | 開／夾閉位置、TMP 上限、Lumen in 上限與判斷依據、最長夾閉、扭力、速度、ID、鮑率（換機台時通常不要勾） |
| pump_kick | 啟動助推設定 |

---

## 12. MCU 與 Python 的通訊

**呼叫排隊**：Python 對 MCU 的所有呼叫經 `_QueuedBridge` 一次送一個，預設逾時 5 s（壓力歸零 15 s、溫度計診斷 8 s）。避免瀏覽器重新連線（例如電腦休眠喚醒）時大量呼叫同時擠進 MCU。MCU 端全部 Bridge 函式以 `provide_safe` 在 `loop()` 中依序執行。

**斷線偵測**：連續 3 次呼叫失敗 → Console 印 `[mcu] !! MCU 收不到指令…`、網頁紅色橫幅；恢復時印 `[mcu] 指令通道恢復`。Serial Monitor 每 30 s 印 `[rpc] 最近 30 秒收到 Python 呼叫 N 次`（正常約 30）；原本有呼叫、30 s 內為 0 會警告。

**工程模式 →「MCU 連線狀態與測試」**：通道狀態、最後成功時間、呼叫與失敗次數、韌體、MCU 開機時間；「重新同步」；「壓力測試」（同時送出 N 個讀取呼叫，應全部成功）；「模擬 Python 端斷線 30 秒」（應出現紅色橫幅並自動恢復）。

> MCU 自動重開（watchdog）曾於 v3.10.6 加入，實機測試證實 UNO Q 軟體重開後 MCU 不會接回 Bridge，已於 v3.10.7 移除。通道中斷時請人工停止再啟動 App，仍不行就斷電 10 秒。

---

## 13. 疑難排解

| 症狀 | 原因 | 處理 |
|---|---|---|
| 沒有 `[boot]`、Python 全部 `method … not available` | Bridge 卡住、sketch 沒載入、外部電源先開造成倒灌 | 拔 USB-C 10 s 再插；確認上電順序；只接 USB 跑 `mcu_selftest` |
| 新板空板也 `not available`，但 selftest 正常 | 舊版在 I2C 掃描／夾閥 Ping 之後才註冊函式 | v3.10.4 起已修正（先註冊）；至少等 30 s 再判斷 |
| 幫浦／夾閥按了沒反應、紅色橫幅（資料仍在更新） | Linux → MCU 指令通道卡住 | 資料照常記錄（v3.10.9 起流量也是）；要操作時停止再啟動 App（幫浦會停、夾閥回到開，記錄自動接續） |
| 網頁所有按鈕沒反應、紅框 `WebUI is not defined` | 用檔案預覽開啟網頁 | 改開 `http://<板子 IP>:7000` |
| 狀態列「MCU 上跑的不是這一版 sketch」 | main.py 與 sketch 版本不一致 | 兩者一起換並重新燒錄 |
| `OneWire.h` / `SCServo.h: No such file` | App Lab 沒安裝 sketch.yaml 的函式庫 | OneWire 已不需要；SCServo 在 App 的函式庫加入 |
| 溫度計找不到，診斷 `ext=0 int=0` | DQ 被拉到 GND：上拉電阻接錯、感測器沒電或接反 | 4.7 kΩ 接 DQ 與 3.3 V；VDD 接 UNO Q 3.3 V |
| 溫度計 `ext=1` 但沒有 presence | 感測器沒接上或卡住 | 確認 DQ 接 D8、共地；感測器斷電重接；用 `ds18b20_test` App 獨立測試 |
| 幫浦 PWM 低時不轉 | 靜摩擦 | 啟動助推（預設已開） |
| 壓力讀值偏差約 1% | 分壓比與實際電阻不符 | 量實際阻值填入 sketch |
| 夾閥常因 Lumen in 自動放開 | 峰值含幫浦脈動 | 改用「平均值」判斷，或適度提高上限 |
| STS3215 掃描不到 | 跳線、接線、電源 | 跳線 A、RX→RX／TX→TX、共地；用自動掃描與 D0–D1 迴路測試 |
| 板子燒毀（3.3 V 對 GND 短路） | 外部電壓進入 UNO Q | 見 §4，換板前必須量測全部線路 |

**獨立測試 App**：`mcu_selftest`（空板確認 MCU 與 Bridge）、`ds18b20_test`（D8／D7 兩種驅動方式測溫度計並讀 ROM 碼）。

---

## 14. 已知限制與待辦

- 外部電源繼電器（D7）尚未實作；上電順序仍需人工遵守。
- 硬體保護（串聯電阻、L298N 下拉、BH1750 改 3.3 V）需在新板上完成並量測驗證。
- 夾閥 STS3215 在原板上尚未成功偵測，需依正確上電順序重測。
- 收集瓶電子秤尚未安裝：J、L_p、D 依手動 Q_perm。
- 液位／槽重感測與補料閉迴路未實作。
- Python 端的錯誤訊息只有中文。
- 低流速時流量計的閘門計數有量化誤差。

---

## 15. 版本沿革（摘要）

| 韌體／後端／網頁 | 日期 | 重點 |
|---|---|---|
| v3.10.9／v4.12／v4.13 | 2026-10-08 | 流量改由 MCU 主動推送（指令通道斷掉時照常記錄）；讀不到時留空不記 0；網頁流量過期時變淡 |
| v3.10.8／v4.11／v4.12 | 2026-10-08 | 夾閉時 Lumen in > 0.5 bar 自動放開（峰值／平均可選）；舊 1.0 bar 預設自動遷移；新版 README |
| v3.10.7／v4.10／v4.11 | 2026-10-08 | 中途存檔；網頁版本比較改為逐段 |
| v3.10.7／v4.9.1／v4.10.1 | 2026-10-08 | 移除 MCU 自動重開（實機證實不可靠） |
| v3.10.5／v4.8 | 2026-10-08 | Python 呼叫排隊、斷線偵測；MCU 全部 provide_safe；`[rpc]` 統計 |
| v3.10.4 | 2026-10-07 | 開機先註冊 Bridge 函式；I2C 只探測兩個位址（核心 1.0.0 新板） |
| v3.10.1–v3.10.3 | 2026-10-06 | DS18B20 內部上拉備援、1-Wire 電氣診斷、每 10 s 重試記錄、時序校正 |
| v4.6–v4.9.2 | 2026-10-06 | ΔP–Q 掃描（預設由高到低）、溫度預設用溫度計、操作參數輸入 |
| v3.10.0／v4.4 | 2026-10-06 | 幫浦啟動助推 |
| v4.0–v4.5 | 2026-10-06 | 依 HFM UI 規格重新設計衍生參數；校正值輸出／輸入、規格管理、參數說明視窗、主標題 |
| v3.8–v3.9.0 | 2026-10-05/06 | 15 k／22 k 分壓、DS18B20（D8）、完整歷史曲線、三欄版面、上電順序處理 |
| v3–v3.7 | 2026-10-02/04 | 併入 pH 與 STS3215 夾閥、14-bit ADC、演算法切換 |
| v1–v2.3 | 2026-09 | OD600、流速＋壓力、幫浦三專案合併；非阻塞 OD600；聚合取樣、落盤與中斷接續 |
