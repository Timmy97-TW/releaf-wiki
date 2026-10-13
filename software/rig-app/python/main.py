# -*- coding: utf-8 -*-
# ==========================================================================
# v3.4.1: 檔頭說明從 """docstring""" 改成 # 註解。只要檔案在複製/貼上時多一段或少一段,
#         docstring 的引號就會錯位, 整段中文說明被當成程式碼而出現
#         "SyntaxError: invalid character" —— 改成註解後不會再發生這種事。
# ==========================================================================
# 整合版 main.py (Linux/MPU 端, Arduino UNO Q / App Lab)
# ============================================================================
# 合併來源:
#   1. OD600 光度計 (原 OD600 專案的 main.py)
#   2. ZJ-TM02 流量計 - 即時Web監控
#   3. 中空纖維薄膜過濾系統 - 壓力即時監測
#   4. 蠕動幫浦 PWM 控制 (L298N)
#
# 本版(整合版 v1)相對於前一版「流速+壓力+幫浦」的變更:
#   1. 【新增】OD600 整合: MCU端量測完成時主動 notify("on_od600_update"),
#      Python端也會定期輪詢 get_od_data() 補值(重連/漏訊息時的保險)。
#      OD600 的 blank 校正、立即量測、量測間隔、光程長校正係數、開發者模式
#      (LED對光工具)全部保留, 並改成透過本檔的 WebSocket 訊息操作。
#   2. 【新增】錄製CSV同時記錄 OD600 與幫浦PWM: 錄製取樣頻率維持 1Hz,
#      OD600 因為量測週期較長(預設30秒), 每一列都沿用「目前最新一次」的量測值,
#      另外附上 od600_age_s(這筆OD600是幾秒前量到的)與 od600_new(這一列是否
#      剛好對應一次新的量測), 事後分析可以只挑 od600_new=1 的列還原真正的量測點。
#   3. 【刪除】自動化 ΔP-Q 掃描實驗(start_dp_q_sweep / abort_dp_q_sweep 及相關
#      CSV/狀態廣播)與跳線/中空纖維對照檔(calibration_library.json 及
#      get_calibration_library / apply_calibration_entry)。
#      blank/module 係數改為直接維護 constants.json。
#   4. 【刪除】幫浦「流速模式」(目標流速 + P控制器 pump_flow_control_loop)。
#      實測顯示蠕動幫浦的瞬時流量脈動會讓P控制器來回震盪, 現在只保留 PWM 直接控制。
#   5. 壓力的基準單位仍固定是 bar(記錄/計算/常數全部以 bar 為準),
#      psi / MPa 只在前端顯示時即時換算, 不影響記錄的原始值。
#      流速單位 mL/min, OD600 單位 AU。
#
# 整合版 v2 (2026-09-01) 變更:
#   A. 【修正】「OD600 取樣期間壓力/流速停擺」的其中一個成因就在這支檔案:
#      on_od600_update() 是 Bridge 的 notify 回呼, 舊版在裡面直接呼叫
#      refresh_blank_info(), 而它內部是一個同步的 Bridge.call("get_blank_info")。
#      在 RPC 回呼裡再發同步 RPC 會把整條 Bridge 鏈路佔住(要等回呼返回, 鏈路才會
#      繼續處理下一個封包), 而壓力的 notify 與流量的輪詢走的正是同一條鏈路。
#      現在回呼只設旗標, 實際讀取交給 od600_poll_loop 那條獨立執行緒。
#      (另外兩個成因在 MCU 端, 見 sketch.ino 的 BH1750Simple 註解。)
#   B. 【新增】聚合取樣: 壓力與流速改成在一個「取樣視窗」(預設30秒, 介面可改)內
#      收集, 每個視窗結束時取中位數或平均(介面可切換), 作為畫面顯示值與 CSV 的一列。
#      取樣時長是三者共用的 —— 改這個值會同時把 MCU 的 OD600 量測間隔設成一樣,
#      讓 OD600 / 壓力 / 流速永遠落在同一個時間節奏上。
#      安全相關的快速路徑不受影響: TMP 瞬時峰值/谷值告警與 collapse pressure 保護
#      仍然吃 MCU 每 200ms 送來的原始統計值, 不會被 30 秒的平均蓋掉。
#   C. 【新增】mcu_diag: 每 5 秒讀一次 MCU 的即時性診斷(loop 最大耗時、上一秒實際
#      完成的壓力取樣筆數), 用來確認 loop() 有沒有再被誰卡住。
#   D. 【變更】錄製 CSV 改成「一個視窗一列」(預設30秒一列), 不再是每秒一列。
#
# 整合版 v2.3 (2026-09-06) 變更 —— 「板子獨立記錄」這件事的補強:
#   A. 【變更】錄製改成「每個視窗一產生就立刻落盤」(append + flush + fsync), 不再是
#      整場放在記憶體、停止時才寫檔。以前那種作法代表停電/當機/重開機就整場歸零,
#      也代表「板子獨立記錄」其實只在正常收尾時才成立。現在最壞只會失去還沒結束的
#      那一個視窗。順帶讓記憶體用量與錄製長度脫鉤(72小時的錄製不再整包留在 RAM)。
#   B. 【新增】中斷後自動接續: recording_state.json 記著進行中的錄製, App 或整塊板子
#      重開之後會自動接回同一個檔案繼續寫, elapsed 依真實經過時間累計, 中斷的那段
#      會誠實記在下一列的 gap_s 欄位裡(CSV 新增此欄)。
#   C. 【新增】HTTP 下載端點 /download/recording 與 /api/recordings, 以及介面上的
#      錄製檔清單。完整檔案不再需要經過 WebSocket, 也不再依賴「停止當下瀏覽器有連著」。
#      (WebUI Brick 若沒有 expose_api 會自動略過, 檔案仍在 recordings/ 資料夾。)
#   D. 提醒: 記錄本來就跑在板子的 Linux 側, 與瀏覽器無關 —— 電腦休眠不會中斷記錄。
#      若休眠期間真的沒有資料, 要查的是板子有沒有斷電(用電腦 USB 供電時很常見)
#      或 App 有沒有被停掉, 見 README §11。
#
# 整合版 v3.7 (2026-10-04): 依《訊號處理演算法檢討報告》做成可切換的取樣/分析演算法
#   (流量倒數計數 C-1、OD600 估計 E-2/E-3/E-5、分析路徑去 EMA F-1、聚合 G-2/G-3、
#    穩態信賴區間+遲滯 H-1/H-3、二次擬合曲率 H-8), CSV 加 G-4 統計欄與 alg_profile。
#   新訊息: "alg_settings" { ok, error, settings, options, profile }
#   前端 -> 後端: "get_algorithms" / "set_algorithms" {flow?, od_estimator?, analysis_source?, steady?, curvature?}
#
# 整合版 v3.4 (2026-10-03):
#   A. pH 手動補償溫度(ph_set_temp), 兩點校正可指定標準液溫度; 都會存檔並在 MCU 重開後推回。
#   B. 夾閥伺服自動掃描(valve_scan / valve_use_found): 8 種鮑率 x ID 0~253, 依收到的位元組數
#      判斷是線路問題還是 ID/鮑率問題; 夾閥設定多一個 baud。
#
# 整合版 v3.2 (2026-10-03) 排錯版:
#   A. 開機時跟 MCU 同步的 Bridge.call 全部搬到背景執行緒, 網頁不再被 MCU 逾時卡住。
#   B. 新增 mcu_link 狀態: get_diag 失敗時 Console 印出原因, 網頁顯示紅色橫幅與 MCU 韌體版本。
#
# 整合版 v3.1 (2026-10-03) 變更:
#   A. 【移除】幫浦 PWM 無效區間(1~99 自動歸零)。換了幫浦, 0-255 直接送出。
#   B. 【移除】pH 的 KOH 加鹼控制。pH 只監測 + 兩點校正 + 記錄。CSV 的 pH 欄位剩
#      ph, ph_temp_c, ph_state(WARMUP / OK / PROBE_ERROR)。
#
# 整合版 v3 (2026-10-02) 變更 —— 併入 pH 與 STS3215 夾閥:
#   A. 【新增】pH: MCU 每秒 notify("on_ph_update"); 校正點存到 ph_valve_state.json,
#      MCU 重開時自動推回。
#   B. 【新增】夾閥: 手動開/關 + 設定工具(jog、關扭力、把目前位置記為開/夾閉)。
#      TMP/Feed 超限、夾閉超時、過熱的自動放開在 MCU 端。每次「夾閉→放開」寫一列到
#      recordings/valve_events.csv(夾閉時長、期間 TMP 平均/峰值、放開原因)。
#   C. 【新增】CSV 多 6 欄: ph, ph_temp_c, ph_state, valve_state, valve_closed_frac, valve_pos。
#      中斷接續時若舊檔是舊欄位格式, 會改開新檔接續(不往舊檔塞錯位的列)。
#   D. 【新增】系統告警: pH 資料中斷 / 探頭異常、夾閥 FAULT / 離線 / 夾閉中。
#      夾閉期間與放開後 valve.alert_settle_sec(預設60秒)內, ΔP/R/dTMP/dt/d²TMP 這類
#      積垢趨勢告警暫停(收樣本本來就會讓它們劇變), TMP 絕對上限類告警不受影響。
#   E. 幫浦緊急停止時 MCU 會一併放開夾閥。
#
# 適用: Arduino UNO Q, Arduino App Lab, WebUI - HTML Brick
#
# 需要在 App Lab 中設定:
#   1. 左側 Add Brick -> 搜尋並加入 "WebUI - HTML"
#   2. assets/libs/socket.io.min.js 與 assets/libs/arduino.js 需自行放入
#   3. 確認 UNO Q 已連上 WiFi
#   4. MCU端燒錄整合版 sketch.ino
#   5. constants.json 需與 main.py 放在同一資料夾
#
# ----------------------------------------------------------------------------
# 前端 (index.html) 收到的 WebSocket 訊息:
#   - "flow_config"        : { maxValue, unit }
#   - "flow_update"        : { freq, flow, total }
#   - "pressure_update"    : { ts, channels:{feed/retentate/permeate:{peak,trough,
#                              mean_raw,mean_filtered,cycle_freq_hz}},
#                              tmp:{peak,trough,mean_raw,mean_filtered},
#                              filtered:{feed,retentate,permeate,tmp} }   單位 bar
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
#     前端 -> 後端: hfm_get_state / hfm_set{rho_gh_kpa?, dp_a?, dp_b?, q_perm_mlmin?, reset_lp_initial?}
#                   / hfm_dp_baseline_from_now / hfm_selftest_start / hfm_selftest_cancel
#   - "chart_history"      : (v3.8) { t0, now, window_sec, rows:[{t,od,flow,ph,temp,vc,pr{},pf{},b?}], markers:[{t,k}] }
#   - "chart_marker"       : (v3.8) { t, k: start|stop|resume }  錄製開始/停止/接續的曲線標記
#   - "record_saved"       : { filename, sample_count, elapsed_sec, auto, rows }
#   - "derived_update"     : 見 derive_loop(), 每秒推播一次
#   - "baseline_captured"  : { R_bar_per_mlmin, delta_p_bar, tmp_bar, captured_at, source }
#   - "pump_status"        : { pwm, forward, bridge_error }
#   - "aggregate_update"   : 一個取樣視窗結束時推一次(預設30秒)。欄位見 _build_aggregate_row(),
#                            含視窗資訊(window_index/window_sec/agg_method/n_samples_*)、
#                            聚合後的壓力(bar)與流速(mL/min)、視窗內最壞的 TMP 峰值/谷值、
#                            當下的 OD600 與幫浦狀態、以及用聚合值重算的衍生參數。
#                            這也就是錄製 CSV 的一列。
#   - "aggregate_settings" : { window_sec, method, min_window_sec, max_window_sec, next_update_in_sec }
#   - "record_resumed"     : { filename, row_count, elapsed_sec, gap_sec }
#                            App/板子重開後自動接續中斷的那份錄製
#   - "recordings_list"    : { dir, files:[{name,size_bytes,modified_at,active,download_url}] }
#   - "record_error"       : { error } 建立錄製檔失敗
#   - "ph_update"          : { ts, ph, voltage, temp_c, state(WARMUP|OK|PROBE_ERROR), config, stale }
#   - "ph_config"          : { ok, error, action, config:{v7,v4,cal_temp}, source }
#   - "valve_update"       : { online, cmd(open|closed|jog), fault, pos, goal, load, temp_c, voltage_v,
#                              current, moving, closed_s, torque, configured, msg, config,
#                              settle_remaining_s }   (v3)
#   - "valve_config"       : { ok, error, action, config:{id,open,closed,speed,acc,torque_limit,
#                              max_close_s,tmp_limit,feed_limit} }
#   - "valve_action_result": { action, ok, error }
#   - "valve_event"        : 一次「夾閉→放開」的紀錄(同 valve_events.csv 一列)
#   - "valve_events_list"  : { events:[...], file }
#   - "valve_scan"         : { state(running|done|error), progress, baud, found:[{id,baud}], rx:{baud:bytes},
#                              hint(found|no_bytes|garbled), error }   (v3.4)
#   - "mcu_diag"           : { loop_max_us, pressure_samples_last_sec, od_state, reinit_step }
#   - "mcu_link"           : { ok, error, since, fw, last_ok }   (v3.2) Python ↔ MCU Bridge 是否通
#                            MCU 即時性診斷: loop_max_us 是上一秒最長的一次 loop() 耗時,
#                            pressure_samples_last_sec 正常應接近 100(100Hz), 明顯偏低
#                            就代表 loop() 又被誰卡住了
#
# 前端 -> 後端:
#   - "get_config"          : 要求流量計設定 (maxValue/unit)
#   - "subscribe"           : 要求立即補送一次目前流量資料
#   - "zero_calibrate"      : 觸發壓力歸零校正
#   - "start_record"        : { duration_sec? } 開始錄製(有給秒數則時間到自動停止存檔)
#   - "pause_record"        : 錄製中/暫停中 互相切換
#   - "stop_record"         : 手動停止錄製並輸出CSV
#   - "capture_baseline"    : 把目前的 R / ΔP / TMP 設為基準線
#   - "set_manual_baseline" : { R_bar_per_mlmin?, delta_p_bar?, tmp_bar? }
#   - "clear_baseline"      : 清除基準線
#   - "set_pump_pwm"        : { pwm } 設定幫浦PWM (0-255), 按「套用」才會送出
#   - "set_pump_direction"  : { forward } 切換方向(會先把PWM歸零)
#   - "stop_pump"           : 緊急停止
#   - "od_calibrate_blank"  : 排入一次量測並把結果設為 OD600=0 的基準(I0)
#   - "od_measure_now"      : 立即排入一次OD600量測(不等自動週期)
#   - "od_set_dev_mode"     : { on } 開發者模式(LED恆亮對光, 暫停OD600自動量測)
#   - "od_get_dev_readings" : 要求一次即時未濾波的 sample/reference 讀值
#   - "od_get_settings"     : 要求目前 OD600 量測間隔 / 光程長校正係數
#   - "od_set_settings"     : { measure_interval_sec?, path_length_factor? }
#   - "list_recordings"     : 要求板子上 recordings/ 資料夾裡的錄製檔清單
#   - "get_aggregate_settings" : 要求目前的取樣時長與聚合方式
#   - "set_aggregate_settings" : { window_sec?, method? } method 為 "median" 或 "mean";
#                                改 window_sec 會同時把 MCU 的 OD600 量測間隔設成一樣
#   --- v3 pH ---
#   - "ph_get_config"   - "ph_calibrate" {point:"7"|"4", buffer_temp?}   - "ph_set_temp" {temp}   (v3.4)
#   - "ph_set_calibration" {v7, v4, cal_temp}   (v3.10: 校正值管理手動輸入)
#   --- v3 夾閥 ---
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

# ============================= v4.8: MCU 呼叫一律排隊 =============================
# 實測問題(2026-10-08): 電腦休眠喚醒後, 網頁重新連線會一口氣送出十幾個要求, 其中 6~8 個要呼叫 MCU,
# 再加上背景每秒的 get_flow_data, 同時有多個 Bridge.call 擠進 MCU。之後「Linux → MCU」的指令通道
# 就不再有回應: 幫浦/夾閥按了沒反應、流量停在舊值; 但 MCU 自己推送的資料(壓力)與 Serial Monitor 照常。
# 對策: 所有 Python → MCU 的呼叫都經過這一層 —— 一次只送一個(排隊)、逾時縮短、
# 連續失敗時在 Console 與網頁紅色橫幅明確顯示。
_RawBridge = Bridge
MCU_CALL_TIMEOUT_S = 5.0
MCU_CALL_SLOW = {"zero_calibrate": 15.0, "ds_diag": 8.0, "ds_timing": 8.0, "calibrate_blank": 10.0}
MCU_RPC_FAIL_STREAK = 3          # 連續幾次失敗才算「指令通道中斷」
_mcu_call_lock = threading.RLock()
_sim_py_down_until = 0.0
mcu_rpc = {"ok": True, "fail_streak": 0, "calls": 0, "fails": 0, "last_ok": None,
           "last_err": None, "down_since": None}


class _QueuedBridge:
    """包住 arduino.app_utils.Bridge: call() 排隊送出; provide()/notify() 原樣轉交。"""

    @staticmethod
    def provide(*a, **k):
        return _RawBridge.provide(*a, **k)

    @staticmethod
    def notify(*a, **k):
        return _RawBridge.notify(*a, **k)

    @staticmethod
    def call(method_name, *params, timeout=None):
        if _sim_py_down_until and time.time() < _sim_py_down_until:      # v4.9 測試: 模擬 Python 端斷線
            _mcu_rpc_record(False, f"{method_name}: 模擬斷線(測試)")
            raise TimeoutError(f"模擬斷線(測試): {method_name}")
        t = timeout if timeout is not None else MCU_CALL_SLOW.get(method_name, MCU_CALL_TIMEOUT_S)
        if not _mcu_call_lock.acquire(timeout=t + 10.0):
            _mcu_rpc_record(False, f"{method_name}: 排隊逾時(前一個 MCU 呼叫卡住)")
            raise TimeoutError(f"MCU 呼叫排隊逾時: {method_name}")
        try:
            try:
                res = _RawBridge.call(method_name, *params, timeout=t)
            except TypeError:
                res = _RawBridge.call(method_name, *params)      # 舊版/測試用 Bridge 沒有 timeout 參數
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
        msg = ("MCU 收不到指令" + ("(但 MCU 的資料仍在推送: Linux→MCU 指令通道中斷)" if alive else "")
               + f"; 最後錯誤: {err}")
        print(f"[mcu] !! {msg}\n       → 處理: 在 App Lab 停止再啟動 App; 仍不行就拔掉 UNO Q 電源 10 秒再插回")
        try:
            _set_mcu_link(False, msg)
        except Exception:
            pass
    elif came_back:
        print("[mcu] 指令通道恢復")
        try:
            _set_mcu_link(True)
        except Exception:
            pass


def _mcu_push_recent():
    """最近 5 秒內有沒有收到 MCU 主動推送的壓力資料(判斷 MCU 本身是否還活著)。"""
    try:
        return (time.time() - float(latest_pressure.get("ts") or 0)) < 5.0
    except Exception:
        return False


Bridge = _QueuedBridge

# ============================= 共用 =============================
ui = WebUI()

# ---- v3.3 排錯: 追蹤網頁 ↔ Python 的訊息 ----
# 網頁送來的每一個指令都在 Console 印一行 "[ui] <- 名稱 資料"; 每 10 秒印一次送往網頁的
# 訊息數量與 WebUI 的事件迴圈是否在跑。用來判斷「按了沒反應」是卡在網頁→Python、
# Python→MCU、還是 MCU 本身。排完錯可以把 UI_TRACE 改成 False。
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
            print(f"[ui] !! 處理 '{_name}' 時發生例外:\n{traceback.format_exc()}")
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
                print(f"[ui] -> 過去 10 秒送往網頁: {top or '無'} | WebUI 事件迴圈運作中: {running}")
                _ui_sent_counts.clear()
                _ui_trace_last = now
    return _orig_send_message(message_type, message, *args, **kwargs)


ui.on_message = _traced_on_message
ui.send_message = _traced_send_message

# ============================= 外部常數設定檔 =============================
# 規格書§2要求: 所有常數(尤其標定/暫定值)不可硬編碼, 須放在外部設定檔,
# 並在每筆資料上記錄當時使用的常數版本。
#
# 正常情況下 constants.json 應該跟 main.py 放在同一個資料夾(App Lab部署後
# 通常是 /app/python/constants.json)。找不到/讀不到時不會直接crash, 會退回
# 內嵌預設值並印出警告, 同時透過 derived_update 告訴前端目前用的是內嵌值。
_SEARCH_DIR = os.path.dirname(os.path.abspath(__file__))
_CANDIDATE_CONFIG_PATHS = [
    os.path.join(_SEARCH_DIR, "constants.json"),
    os.path.join(os.getcwd(), "constants.json"),
    "/app/python/constants.json",
]

_DEFAULT_CONST = {
    "config_version": "embedded-fallback",
    "constants_version": "embedded-fallback",
    "membrane_area_m2": 0.02,
    "fiber_count": 11,
    "fiber_id_m": 1.0e-3,
    "fiber_length_m": 0.60,
    "pore_size_um": 0.2,
    "max_working_volume_l": 2.0,
    "temp_operating_c": 22.0,
    "viscosity_mpas_by_temp": {"20": 1.002, "22": 0.955, "25": 0.890, "30": 0.798},
    "theory_slope_bar_per_mlmin_by_temp": {"20": 3.711e-4, "22": 3.537e-4, "25": 3.297e-4, "30": 2.956e-4},
    "blank_slope_bar_per_mlmin": 2.195e-4,
    "blank_intercept_bar": -0.0011,
    "module_slope_net_bar_per_mlmin": 5.379e-4,
    "n_eff_nominal": 11,
    "tee_a": 0.0,
    "tee_b": 0.0,
    "provisional_constants": [
        "blank_slope_bar_per_mlmin", "blank_intercept_bar", "module_slope_net_bar_per_mlmin",
        "n_eff_nominal", "tee_a", "tee_b", "pressure_mean_filter_alpha",
    ],
    "steady_window_s": 60,
    "steady_slope_thresh_bar_per_min": 0.001,
    "steady_sd_thresh_bar": 0.003,
    "steady_flow_slope_thresh_mlmin_per_min": 5.0,
    "steady_flow_sd_thresh_mlmin": 5.0,
    "trend_window_s": 60,
    "d2_window_s": 120,
    "pressure_mean_filter_alpha": 0.3,
    "aggregate_window_sec": 30.0,
    "aggregate_method": "median",
    "od600_poll_interval_sec": 5.0,
    "od600_expected_lux_ratio": 10.0,
    "od600_lux_ratio_warn_band": [5.0, 20.0],
    "od600_dev_mode_poll_timeout_sec": 30.0,
    "thresholds": {
        "tmp_critical_bar": 0.5, "tmp_warning_bar": 0.4, "tmp_trough_negative_bar": -0.02,
        "delta_p_critical_factor_over_baseline": 2.5, "R_warning_factor_over_baseline": 2.0,
        "shear_rate_warning_s1": 6000,
        "dtmp_dt_warning_bar_per_min": 0.01, "dtmp_dt_critical_bar_per_min": 0.02,
        "conversion_warning": 0.30,
    },
}


def _load_constants():
    for path in _CANDIDATE_CONFIG_PATHS:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"[constants] 已從 {path} 讀取常數設定檔")
            return data, path
        except FileNotFoundError:
            continue
        except (json.JSONDecodeError, OSError) as e:
            print(f"[constants] WARNING: {path} 存在但讀取/解析失敗({e}), 繼續嘗試其他路徑")
            continue

    print(
        "[constants] WARNING: 在以下路徑都找不到 constants.json, 改用內嵌預設值(embedded-fallback):\n  "
        + "\n  ".join(_CANDIDATE_CONFIG_PATHS)
        + "\n  請確認 constants.json 有跟 main.py 放在同一個資料夾(App Lab上通常是 /app/python/)。"
    )
    return dict(_DEFAULT_CONST), None


CONST, CONFIG_SOURCE_PATH = _load_constants()
CONSTANTS_FROM_FILE = CONFIG_SOURCE_PATH is not None

CONFIG_VERSION = CONST.get("config_version", "unknown")
CONSTANTS_VERSION = CONST.get("constants_version", "unknown")
PROVISIONAL_CONSTANTS = list(CONST.get("provisional_constants", []))
if not CONSTANTS_FROM_FILE:
    PROVISIONAL_CONSTANTS = PROVISIONAL_CONSTANTS + ["ALL (constants.json not found, using embedded defaults)"]

MEMBRANE_AREA_M2 = CONST["membrane_area_m2"]
FIBER_COUNT = CONST["fiber_count"]
FIBER_ID_M = CONST["fiber_id_m"]
FIBER_LENGTH_M = CONST["fiber_length_m"]
TEMP_OPERATING_C = CONST["temp_operating_c"]
THEORY_SLOPE = {float(k): v for k, v in CONST["theory_slope_bar_per_mlmin_by_temp"].items()}
BLANK_SLOPE = CONST["blank_slope_bar_per_mlmin"]
BLANK_INTERCEPT = CONST["blank_intercept_bar"]
N_EFF_NOMINAL = CONST["n_eff_nominal"]
THRESH = CONST.get("thresholds", {})

STEADY_WINDOW_S = CONST.get("steady_window_s", 60)
STEADY_SLOPE_THRESH_BAR_MIN = CONST.get("steady_slope_thresh_bar_per_min", 0.001)
STEADY_SD_THRESH_BAR = CONST.get("steady_sd_thresh_bar", 0.003)
STEADY_FLOW_SLOPE_THRESH = CONST.get("steady_flow_slope_thresh_mlmin_per_min", 5.0)
STEADY_FLOW_SD_THRESH = CONST.get("steady_flow_sd_thresh_mlmin", 5.0)

TREND_WINDOW_S = CONST.get("trend_window_s", 60)
D2_WINDOW_S = CONST.get("d2_window_s", 120)

_FIBER_R_M = FIBER_ID_M / 2.0
_THEORY_SLOPE_REF = THEORY_SLOPE.get(TEMP_OPERATING_C, next(iter(THEORY_SLOPE.values())))

# ============================= 流量計 (ZJ-TM02) =============================
MAX_FLOW_MLMIN = 4000   # 大孔版本上限約 4L/min = 4000mL/min; 小孔版本改成 1000
FLOW_UNIT = "mL/min"
FLOW_PUSH_INTERVAL_SEC = 1.0  # 推送頻率(秒), 對應MCU端 FLOW_UPDATE_INTERVAL_MS

latest_flow = {"freq": 0.0, "flow": 0.0, "total": 0.0, "ts": 0.0, "src": None, "stale": True}
_flow_push_ts = 0.0          # v4.12: 最後一次收到 MCU 主動推送流量的時間
FLOW_PUSH_FRESH_SEC = 2.5    # 這段時間內有推送, 就不用再輪詢


def read_flow():
    """呼叫MCU的Bridge函式, 取得 (頻率Hz, 瞬時流量mL/min, 累積流量mL)。
    v4.12: 讀不到時回傳 None —— 以前回傳 0, 斷線期間的流量會被當成「0 mL/min」寫進 CSV。"""
    try:
        raw = Bridge.call("get_flow_data", "")
        parts = raw.split(",")
        return float(parts[0]), float(parts[1]), float(parts[2])
    except Exception:
        return None


def _apply_flow(freq, flow, total, src):
    global latest_flow
    latest_flow = {"freq": freq, "flow": flow, "total": total, "ts": time.time(), "src": src, "stale": False}
    agg_push_flow(freq, flow, total)   # 餵給聚合視窗, 見「聚合取樣」一節
    ui.send_message("flow_update", latest_flow)


def on_flow_update(payload):
    """v4.12: MCU 每秒主動推送 "freq,flow_mlmin,total_ml,pulses"(韌體 v3.10.9 起)。
    這是 Bridge 回呼: 只更新狀態, 不做同步 Bridge.call。"""
    global _flow_push_ts
    try:
        parts = str(payload).split(",")
        freq, flow, total = float(parts[0]), float(parts[1]), float(parts[2])
    except (ValueError, IndexError):
        print(f"[flow] WARNING: on_flow_update 收到異常 payload: {payload}")
        return
    _flow_push_ts = time.time()
    _apply_flow(freq, flow, total, "push")


Bridge.provide("on_flow_update", on_flow_update)


def on_get_config(client, data):
    ui.send_message("flow_config", {"maxValue": MAX_FLOW_MLMIN, "unit": FLOW_UNIT}, client)


def on_subscribe(client, data):
    ui.send_message("flow_update", dict(latest_flow), client)


def push_flow_loop():
    """v4.12: 有 MCU 主動推送時什麼都不做; 推送停了(舊韌體)才改用輪詢。
    兩者都拿不到時不寫入聚合視窗(CSV 該欄留空), 只通知網頁「流量資料過期」。"""
    global latest_flow
    while True:
        try:
            if time.time() - _flow_push_ts > FLOW_PUSH_FRESH_SEC:
                r = read_flow()
                if r is not None:
                    _apply_flow(r[0], r[1], r[2], "poll")
                elif not latest_flow.get("stale") and time.time() - (latest_flow.get("ts") or 0) > 3.0:
                    latest_flow = dict(latest_flow, stale=True)
                    ui.send_message("flow_update", latest_flow)
        except Exception:
            pass
        time.sleep(FLOW_PUSH_INTERVAL_SEC)


ui.on_message("get_config", on_get_config)
ui.on_message("subscribe", on_subscribe)

# ============================= 壓力 (薄膜過濾) =============================
# MCU端已改成 100Hz 高頻取樣進滑動視窗, 每200ms送來每通道的
# peak/trough/mean_raw/cycle_freq_hz 四個統計值。Python端只需對 mean_raw 再套一層
# 低通濾波(alpha 由 constants.json 控制, 不用重燒錄MCU)得到 mean_filtered。
#
# 目前硬體是3通道(feed/retentate/permeate), 不是規格書假設的 lumen in/out +
# shell in/out 四通道, 因此 "lumen" 對應 feed/retentate 的平均、"shell" 對應
# permeate, 沿用 TMP = avg(feed,retentate) - permeate 的定義。
PRESSURE_CHANNELS = ("feed", "retentate", "permeate")
PSI_PER_BAR = 14.5038  # 僅供文件/前端換算參考, 後端內部一律用 bar
PRESSURE_MEAN_FILTER_ALPHA = float(CONST.get("pressure_mean_filter_alpha", 0.3))

_mean_filtered_state = {ch: None for ch in PRESSURE_CHANNELS}

latest_pressure = {
    "ts": 0.0,
    "channels": {
        ch: {"peak": 0.0, "trough": 0.0, "mean_raw": 0.0, "mean_filtered": 0.0, "cycle_freq_hz": 0.0}
        for ch in PRESSURE_CHANNELS
    },
    "tmp": {"peak": 0.0, "trough": 0.0, "mean_raw": 0.0, "mean_filtered": 0.0},
    # 向下相容: 給 compute_derived/update_steady/CSV 直接取用的「目前主要判讀值」,
    # 統一取 mean_filtered(規格書§2定義中唯一可餵給控制迴路/一般監控的訊號)
    "filtered": {ch: 0.0 for ch in PRESSURE_CHANNELS + ("tmp",)},
}
_pressure_lock = threading.Lock()


def _lowpass(channel, mean_raw):
    """一階低通濾波(等同EMA)。alpha 可從 constants.json 調整, 不用重燒錄MCU。"""
    prev = _mean_filtered_state[channel]
    filtered = mean_raw if prev is None else (
        PRESSURE_MEAN_FILTER_ALPHA * mean_raw + (1 - PRESSURE_MEAN_FILTER_ALPHA) * prev
    )
    _mean_filtered_state[channel] = filtered
    return filtered


def push_pressure_to_frontend(snapshot):
    # bar 數值量級小(操作範圍約 0.06-0.31 bar), 用 4-5 位小數保留足夠解析度
    ui.send_message("pressure_update", {
        "ts": snapshot["ts"],
        "channels": {
            ch: {k: round(v, 5) for k, v in snapshot["channels"][ch].items()}
            for ch in PRESSURE_CHANNELS
        },
        "tmp": {k: round(v, 5) for k, v in snapshot["tmp"].items()},
        "filtered": {ch: round(snapshot["filtered"][ch], 4) for ch in PRESSURE_CHANNELS + ("tmp",)},
    })


def on_pressure_update(payload):
    """由 MCU 端 Bridge.notify("on_pressure_update", payload) 觸發, 預設每200ms一次。
    payload 是逗號分隔字串: feed_peak,feed_trough,feed_mean_raw,feed_cycle_hz,
    retentate_...(4個), permeate_...(4個), 共12個值; MCU端已做過歸零校正。"""
    try:
        parts = [float(x) for x in str(payload).split(",")]
    except (ValueError, AttributeError):
        return
    if len(parts) != 12:
        print(f"[pressure] WARNING: on_pressure_update 收到異常payload(欄位數={len(parts)}, 預期12): {payload}")
        return

    channels = {}
    for i, ch in enumerate(PRESSURE_CHANNELS):
        peak, trough, mean_raw, cycle_freq = parts[i * 4: i * 4 + 4]
        channels[ch] = {
            "peak": peak, "trough": trough,
            "mean_raw": mean_raw, "mean_filtered": _lowpass(ch, mean_raw),
            "cycle_freq_hz": cycle_freq,
        }

    lumen_peak = (channels["feed"]["peak"] + channels["retentate"]["peak"]) / 2.0
    lumen_trough = (channels["feed"]["trough"] + channels["retentate"]["trough"]) / 2.0
    lumen_mean_raw = (channels["feed"]["mean_raw"] + channels["retentate"]["mean_raw"]) / 2.0
    lumen_mean = (channels["feed"]["mean_filtered"] + channels["retentate"]["mean_filtered"]) / 2.0
    tmp_peak = lumen_peak - channels["permeate"]["trough"]            # 最壞情境, collapse pressure保護用
    tmp_trough = lumen_trough - channels["permeate"]["peak"]          # 是否曾經瞬間轉負
    tmp_mean_raw = lumen_mean_raw - channels["permeate"]["mean_raw"]  # 低通濾波前
    tmp_mean = lumen_mean - channels["permeate"]["mean_filtered"]     # 一般監控用, 即既有 tmp_bar

    ts = time.time()
    with _pressure_lock:
        latest_pressure["ts"] = ts
        latest_pressure["channels"] = channels
        latest_pressure["tmp"] = {
            "peak": tmp_peak, "trough": tmp_trough,
            "mean_raw": tmp_mean_raw, "mean_filtered": tmp_mean,
        }
        latest_pressure["filtered"] = {
            "feed": channels["feed"]["mean_filtered"],
            "retentate": channels["retentate"]["mean_filtered"],
            "permeate": channels["permeate"]["mean_filtered"],
            "tmp": tmp_mean,
        }
        snapshot = {
            "ts": ts,
            "channels": {ch: dict(channels[ch]) for ch in PRESSURE_CHANNELS},
            "tmp": dict(latest_pressure["tmp"]),
            "filtered": dict(latest_pressure["filtered"]),
        }

    agg_push_pressure(snapshot)   # 餵給聚合視窗(中位數/平均), 見「聚合取樣」一節
    _valve_track_pressure(snapshot)   # v3: 夾閉期間累積壓力統計(夾閥事件紀錄用)
    hfm_track_pressure(snapshot)      # v4: 嚴格版 TMP_out + 開機自檢
    push_pressure_to_frontend(snapshot)


def handle_zero_calibrate(client, data):
    # 包 try/except: 避免MCU沒回應時例外往上炸穿, 導致 zero_calibrate_done 永遠
    # 不會送回前端, 按鈕卡在「校正中」轉不停。
    try:
        Bridge.call("zero_calibrate")
    except Exception as e:
        print(f"[pressure] Bridge.call('zero_calibrate') 失敗: {e}")
    # 校正後重置低通濾波狀態, 避免殘留校正前的舊資料(offset改變會讓舊資料整批偏移)
    for ch in PRESSURE_CHANNELS:
        _mean_filtered_state[ch] = None
    ui.send_message("zero_calibrate_done", {"ts": time.time()})
    # 這是真正的現場校正: 把 MCU 算出來的新 offset 抓回來存檔, 並清掉
    # 「目前用的是還原值/手動輸入值」的提示。
    try:
        parts = Bridge.call("get_pressure_offsets", "").split(",")
        calib_remember("pressure_offsets", {
            "feed": round(float(parts[0]), 6),
            "retentate": round(float(parts[1]), 6),
            "permeate": round(float(parts[2]), 6),
        }, source="measured")
    except Exception as e:
        print(f"[calib] 歸零後讀回 offset 失敗(校正本身仍然有效, 只是沒存到檔): {e}")


ui.on_message("zero_calibrate", handle_zero_calibrate)
Bridge.provide("on_pressure_update", on_pressure_update)

# ============================= OD600 光度計 =============================
# MCU端量測完成時會主動 Bridge.notify("on_od600_update", ...), 這裡直接更新並廣播,
# 所以正常情況下不需要輪詢。od600_poll_loop() 只是保險: 定期(預設5秒)呼叫一次
# get_od_data() 同步狀態, 用來涵蓋「Python重啟/漏收 notify/剛連上還沒量過」等情況。
OD600_POLL_INTERVAL_SEC = float(CONST.get("od600_poll_interval_sec", 5.0))
OD600_EXPECTED_LUX_RATIO = float(CONST.get("od600_expected_lux_ratio", 10.0))
OD600_LUX_RATIO_WARN_BAND = list(CONST.get("od600_lux_ratio_warn_band", [5.0, 20.0]))
# 開發者模式(LED恆亮對光)如果瀏覽器停止輪詢超過這麼久(關掉分頁/筆電睡著/斷線),
# 由後端自動關掉, 不能只信任前端一定會按「離開」。開發者模式會暫停OD600自動量測,
# 且LED持續通電, 放著不管一整夜是實質問題而不只是美觀問題。
OD600_DEV_MODE_POLL_TIMEOUT_SEC = float(CONST.get("od600_dev_mode_poll_timeout_sec", 30.0))

_od_lock = threading.Lock()
latest_od600 = {
    "ts": 0.0,
    "od600": 0.0,
    "lux_sample": 0.0,
    "lux_ref": 0.0,
    "lux_ratio": None,
    "bubble_pct": 0.0,
    "valid": False,
    "blank_set": False,
    "meas_seq": 0,
    "age_s": None,     # 這筆OD600是幾秒前量到的(以MCU的 millis 差計算)
    "busy": False,     # MCU目前是否正在量測中
}
od600_blank_info = {"blank_set": False, "lux_sample": 0.0, "lux_ref": 0.0, "lux_ratio": None}

od600_dev_mode = False
_od_dev_last_poll_time = None
_blank_refresh_pending = False  # 見 on_od600_update(): 由 Bridge 回呼設旗標, 輪詢執行緒才真的去讀


def _od_ratio(lux_sample, lux_ref):
    return round(lux_sample / lux_ref, 4) if lux_ref > 1e-3 else None


def _od_snapshot(client=None):
    with _od_lock:
        snap = dict(latest_od600)
    snap["expected_lux_ratio"] = OD600_EXPECTED_LUX_RATIO
    snap["lux_ratio_warn_band"] = OD600_LUX_RATIO_WARN_BAND
    ui.send_message("od600_update", snap, client)


def on_od600_update(payload):
    """MCU端每完成一次OD600量測就會呼叫這裡。
    payload: "od600,lux_sample,lux_ref,bubble_pct,valid,blank_set,meas_seq" """
    try:
        parts = str(payload).split(",")
        od600 = float(parts[0])
        lux_sample = float(parts[1])
        lux_ref = float(parts[2])
        bubble = float(parts[3])
        valid = bool(int(float(parts[4])))
        blank_set = bool(int(float(parts[5])))
        meas_seq = int(float(parts[6]))
    except (ValueError, IndexError, AttributeError, TypeError):
        print(f"[od600] WARNING: on_od600_update 收到異常payload: {payload}")
        return

    with _od_lock:
        latest_od600.update({
            "ts": time.time(),
            "od600": round(od600, 5),
            "lux_sample": round(lux_sample, 2),
            "lux_ref": round(lux_ref, 2),
            "lux_ratio": _od_ratio(lux_sample, lux_ref),
            "bubble_pct": round(bubble, 1),
            "valid": valid,
            "blank_set": blank_set,
            "meas_seq": meas_seq,
            "age_s": 0.0,
            "busy": False,
        })

    flag = "" if valid else "  <-- HIGH BUBBLE/NOISE, check flow"
    print(f"[od600] seq={meas_seq} OD600={od600:.4f} sample={lux_sample:.1f}lx "
          f"ref={lux_ref:.1f}lx reject={bubble:.1f}%{flag}")

    _od_snapshot()

    # 這裡「只」設旗標, 絕對不要直接呼叫 refresh_blank_info() ——
    # 它裡面是一個同步的 Bridge.call("get_blank_info"), 而我們現在正跑在
    # Bridge 的 notify 回呼裡面。在回呼裡再發一個同步 RPC 會把整條 Bridge 鏈路
    # 佔住(要等這個回呼返回, 鏈路才會繼續處理下一個封包), 而壓力的 notify 與
    # 流量的輪詢走的是同一條鏈路 —— 結果就是每次 OD600 量完, 壓力/流速都會出現
    # 一段空窗。實際的讀取交給 od600_poll_loop 那條獨立執行緒去做。
    global _blank_refresh_pending
    _blank_refresh_pending = True


Bridge.provide("on_od600_update", on_od600_update)


def poll_od600_once():
    """輪詢MCU目前的OD600狀態(保險用, 見上方說明)。回傳是否成功。"""
    try:
        raw = Bridge.call("get_od_data", "")
        parts = raw.split(",")
        od600 = float(parts[0])
        lux_sample = float(parts[1])
        lux_ref = float(parts[2])
        bubble = float(parts[3])
        valid = bool(int(float(parts[4])))
        blank_set = bool(int(float(parts[5])))
        meas_seq = int(float(parts[6]))
        age_s = float(parts[7]) / 1000.0
        busy = bool(int(float(parts[8])))
    except Exception:
        return False

    with _od_lock:
        latest_od600.update({
            "ts": time.time(),
            "od600": round(od600, 5),
            "lux_sample": round(lux_sample, 2),
            "lux_ref": round(lux_ref, 2),
            "lux_ratio": _od_ratio(lux_sample, lux_ref),
            "bubble_pct": round(bubble, 1),
            "valid": valid,
            "blank_set": blank_set,
            "meas_seq": meas_seq,
            "age_s": round(age_s, 1),
            "busy": busy,
        })
    return True


def refresh_blank_info(client=None):
    """讀回目前 blank(I0) 校正當下的原始 sample/reference 讀值與比值。
    blank 是一次性的校正事件, 不是時間序列, 所以跟 latest_od600 分開存。"""
    try:
        raw = Bridge.call("get_blank_info", "")
        parts = raw.split(",")
        blank_set = bool(int(float(parts[0])))
        lux_sample = float(parts[1])
        lux_ref = float(parts[2])
        blank_ratio = float(parts[3])
    except Exception as e:
        print(f"[od600] 讀取 blank 資訊失敗(下次校正/輪詢時會再試): {e}")
        return
    od600_blank_info.update({
        "blank_set": blank_set,
        "lux_sample": round(lux_sample, 2),
        "lux_ref": round(lux_ref, 2),
        "lux_ratio": round(blank_ratio, 4),
    })
    ui.send_message("od600_blank", dict(od600_blank_info), client)

    # 順便存檔。來源標記只有在「使用者按過校正空白、而且 MCU 真的量完了」時才寫成
    # measured; 其餘情況(還原值、手動輸入值)保留原本的標記, 提示才不會被誤清掉。
    global _blank_calibration_requested
    if blank_set:
        if _blank_calibration_requested:
            _blank_calibration_requested = False
            calib_remember("od600_blank", {
                "ratio": round(blank_ratio, 6),
                "lux_sample": round(lux_sample, 2),
                "lux_ref": round(lux_ref, 2),
            }, source="measured")
        else:
            with _calib_lock:
                calibration_saved["od600_blank"] = {
                    "ratio": round(blank_ratio, 6),
                    "lux_sample": round(lux_sample, 2),
                    "lux_ref": round(lux_ref, 2),
                    "saved_at": time.time(),
                }
                calibration_source.setdefault("od600_blank", {"source": "measured", "at": time.time()})
                _write_calibration_file()


def poll_mcu_diag():
    """讀回 MCU 的即時性診斷(見 sketch 第六節)。loop_max_us 明顯偏大或
    pressure_samples_last_sec 明顯低於 100, 就代表 loop() 有被誰卡住。"""
    try:
        raw = Bridge.call("get_diag", "")
        parts = str(raw).split(",")
        diag = {
            "loop_max_us": int(float(parts[0])),
            "pressure_samples_last_sec": int(float(parts[1])),
            "od_state": int(float(parts[2])),
            "reinit_step": int(float(parts[3])),
            "uptime_ms": int(float(parts[4])) if len(parts) > 4 else None,
        }
        fw = parts[5].strip() if len(parts) > 5 else "舊版 sketch(沒有版本號)"
        if len(parts) > 8:                       # v3.10.6: 指令通道 watchdog 狀態
            diag["rpc_wd_en"] = parts[6].strip() == "1"
            diag["rpc_wd_sec"] = int(float(parts[7]))
            diag["rpc_calls"] = int(float(parts[8]))
    except Exception as e:
        # v3.2: 以前這裡安靜地 return, 結果 MCU 沒回應時 Console 什麼都看不到。
        _set_mcu_link(False, f"get_diag 失敗: {type(e).__name__}: {e}")
        return
    _set_mcu_link(True, fw=fw)
    latest_diag.update(diag)
    ui.send_message("mcu_diag", dict(latest_diag))
    # uptime 變小代表 MCU 重開過 → 自動把存檔的校正值推回去(見「校正值的保存與還原」)
    if diag["uptime_ms"] is not None:
        check_mcu_reboot(diag["uptime_ms"])


latest_diag = {"loop_max_us": 0, "pressure_samples_last_sec": 0, "od_state": 0, "reinit_step": 0}

# ---- v3.2: MCU 連線狀態(排錯用) ----
# 「感測器不動、幫浦按了沒反應」幾乎都是 Python ↔ MCU 的 Bridge 不通: MCU 的 sketch 沒在跑
# (編譯/載入失敗、卡在 setup())、或 Bridge 本身卡死。這裡把它變成看得見的狀態:
# Console 印一行、網頁狀態列與紅色橫幅顯示, 並帶上 MCU 回報的韌體版本(確認新 sketch 真的有跑)。
mcu_link = {"ok": None, "error": None, "since": time.time(), "fw": None, "last_ok": None}
BACKEND_VERSION = "v4.12"          # 網頁會檢查這個版本(太舊會在畫面上提醒更新 main.py)
EXPECTED_FW = "v3.10.9"            # 跟 sketch.ino 的 FW_VERSION 對照; 不一樣代表 MCU 跑的是舊 sketch
_startup_thread_done = False   # 啟動同步執行緒跑完之前, od600_poll_loop 不重試(避免兩邊同時推校正值)
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
                    print(f"[mcu] 韌體版本: {fw}" + ("" if fw == EXPECTED_FW else
                          f"  !! 與 main.py 預期的 {EXPECTED_FW} 不同: MCU 上跑的不是這一版 sketch"))
                mcu_link["fw"] = fw
        else:
            mcu_link["error"] = error
        if changed:
            mcu_link["since"] = time.time()
        snap = dict(mcu_link)
    snap["expected_fw"] = EXPECTED_FW
    if changed:
        if ok:
            print(f"[mcu] Bridge 連線正常 (fw={snap['fw']})")
        else:
            print(f"[mcu] !! MCU 沒有回應: {error}\n"
                  "       → 檢查: 1) App Lab 下方 MCU 的 Serial Monitor 有沒有 [boot] 訊息 "
                  "2) sketch 有沒有編譯/上傳錯誤 3) 板子是否需要重新上電")
    try:
        ui.send_message("mcu_link", snap)
    except Exception:
        pass


def od600_poll_loop():
    global od600_dev_mode, _od_dev_last_poll_time, _blank_refresh_pending
    while True:
        time.sleep(OD600_POLL_INTERVAL_SEC)

        # on_od600_update 只設旗標(避免在 Bridge 回呼裡發同步 RPC), 真正的讀取在這裡做
        if _blank_refresh_pending:
            _blank_refresh_pending = False
            refresh_blank_info()

        poll_mcu_diag()

        # v3: pH/夾閥的開機同步重試
        if _startup_thread_done:
            try:
                ph_valve_housekeeping()
            except Exception:
                print(f"[ph/valve] housekeeping 失敗:\n{traceback.format_exc()}")

        # 啟動時如果 Bridge 還沒就緒, 校正值的還原判斷會被延後到這裡重試
        if _startup_thread_done and not _startup_calib_done:
            startup_calibration_sync()

        # 開發者模式的自動關閉保護: 瀏覽器超過 timeout 沒來要即時讀值就自動離開
        if od600_dev_mode and _od_dev_last_poll_time is not None \
                and (time.time() - _od_dev_last_poll_time) > OD600_DEV_MODE_POLL_TIMEOUT_SEC:
            try:
                Bridge.call("set_dev_mode", "0")
            except Exception as e:
                print(f"[od600][dev] 自動關閉開發者模式失敗, 下個週期再試: {e}")
            else:
                od600_dev_mode = False
                _od_dev_last_poll_time = None
                print(f"[od600][dev] 開發者模式已自動關閉 -- 超過 {OD600_DEV_MODE_POLL_TIMEOUT_SEC} 秒沒有瀏覽器活動。")
                ui.send_message("od600_dev_status", {"dev_mode": False})

        if od600_dev_mode:
            continue  # 開發者模式下MCU暫停自動量測, 輪詢也沒有新資料

        if poll_od600_once():
            _od_snapshot()


def handle_od_calibrate_blank(client, data):
    """把流通池裡目前的內容物(應為乾淨培養基/空白樣品)設為 OD600 = 0 的基準。
    MCU端是非阻塞的: 這裡只是排入一次量測, 約3秒後量完才真的生效,
    屆時 on_od600_update 會被觸發, 前端會自動看到更新後的 blank 讀值。"""
    global _blank_calibration_requested
    _blank_calibration_requested = True   # MCU 量完後才會被認定成「現場校正」
    try:
        result = Bridge.call("calibrate_blank", "")
    except Exception as e:
        print(f"[od600] calibrate_blank 失敗: {e}")
        return
    print(f"[od600] blank 校正已排入 (MCU回應: {result})")


def handle_od_measure_now(client, data):
    try:
        Bridge.call("trigger_measurement", "")
    except Exception as e:
        print(f"[od600] trigger_measurement 失敗: {e}")


def handle_od_set_dev_mode(client, data):
    global od600_dev_mode, _od_dev_last_poll_time
    on = bool((data or {}).get("on", False))
    try:
        Bridge.call("set_dev_mode", "1" if on else "0")
    except Exception as e:
        print(f"[od600][dev] set_dev_mode 失敗: {e}")
        ui.send_message("od600_dev_status", {"dev_mode": od600_dev_mode, "error": str(e)}, client)
        return
    od600_dev_mode = on
    _od_dev_last_poll_time = time.time() if on else None  # 進入時就開始計時, 不等第一次輪詢
    ui.send_message("od600_dev_status", {"dev_mode": od600_dev_mode})


def handle_od_get_dev_readings(client, data):
    """即時未濾波的單次讀值, 專供對光用: 刻意不做暗電流扣除/MAD平均, 才能讓硬體
    調整立刻反映在畫面上, 而不是隔幾秒才透過穩健統計慢慢浮現。這些值完全不會進
    in-memory 資料或錄製CSV。"""
    global _od_dev_last_poll_time
    if not od600_dev_mode:
        ui.send_message("od600_dev_readings", {"dev_mode": False}, client)
        return
    _od_dev_last_poll_time = time.time()  # 每次前端輪詢都重置安全逾時
    try:
        raw = Bridge.call("get_dev_readings", "")
        parts = raw.split(",")
        lux_sample = float(parts[1])
        lux_ref = float(parts[2])
    except Exception as e:
        ui.send_message("od600_dev_readings", {"dev_mode": True, "error": str(e)}, client)
        return

    sample_error = lux_sample < 0   # -1 是 sketch 的 I2C 失敗哨兵值
    ref_error = lux_ref < 0
    ratio = None
    if not sample_error and not ref_error and lux_ref > 1e-3:
        ratio = round(lux_sample / lux_ref, 3)
    ui.send_message("od600_dev_readings", {
        "dev_mode": True,
        "lux_sample": None if sample_error else round(lux_sample, 2),
        "lux_ref": None if ref_error else round(lux_ref, 2),
        "lux_ratio": ratio,
        "sample_error": sample_error,
        "ref_error": ref_error,
        "expected_lux_ratio": OD600_EXPECTED_LUX_RATIO,
        "lux_ratio_warn_band": OD600_LUX_RATIO_WARN_BAND,
    }, client)


def handle_od_get_settings(client, data):
    try:
        interval_sec = float(Bridge.call("get_measure_interval_sec", ""))
        path_factor = float(Bridge.call("get_path_length_factor", ""))
    except Exception as e:
        ui.send_message("od600_settings", {"ok": False, "error": str(e)}, client)
        return
    ui.send_message("od600_settings", {
        "ok": True, "measure_interval_sec": interval_sec, "path_length_factor": path_factor,
    }, client)


def handle_od_set_settings(client, data):
    """量測間隔與光程長校正係數都存在MCU端(重新整理頁面/Python重啟都不會遺失)。
    改光程長係數不需要重新校正 blank, 但會重新縮放「之後」的每一個 OD600 值,
    同一次實驗前後的數字不能直接放在同一條曲線上比較。"""
    data = data or {}
    result = {"ok": True}

    if data.get("measure_interval_sec") not in (None, ""):
        try:
            resp = Bridge.call("set_measure_interval_sec", str(float(data["measure_interval_sec"])))
        except Exception as e:
            ui.send_message("od600_settings", {"ok": False, "error": str(e)}, client)
            return
        if str(resp).strip() == "rejected":
            ui.send_message("od600_settings",
                            {"ok": False, "error": "板子拒絕了量測間隔(允許範圍 5 秒 - 24 小時)"}, client)
            return
        result["measure_interval_sec"] = float(resp)

    if data.get("path_length_factor") not in (None, ""):
        try:
            resp = Bridge.call("set_path_length_factor", str(float(data["path_length_factor"])))
        except Exception as e:
            ui.send_message("od600_settings", {"ok": False, "error": str(e)}, client)
            return
        if str(resp).strip() == "rejected":
            ui.send_message("od600_settings",
                            {"ok": False, "error": "板子拒絕了光程長校正係數(必須 > 0 且在合理範圍內)"}, client)
            return
        result["path_length_factor"] = float(resp)
        calib_remember("od600_path_length_factor", {"value": float(resp)}, source="measured")

    ui.send_message("od600_settings", result, client)


ui.on_message("od_calibrate_blank", handle_od_calibrate_blank)
ui.on_message("od_measure_now", handle_od_measure_now)
ui.on_message("od_set_dev_mode", handle_od_set_dev_mode)
ui.on_message("od_get_dev_readings", handle_od_get_dev_readings)
ui.on_message("od_get_settings", handle_od_get_settings)
ui.on_message("od_set_settings", handle_od_set_settings)

# ============================= 蠕動幫浦控制 (L298N) — 僅PWM =============================
# 本版只保留「直接設定PWM」。原本的流速模式(設定目標流速, 由背景P控制器自動調整PWM)
# 已移除: 實測顯示蠕動幫浦的瞬時流量本身就有脈動雜訊, P控制器依這個有雜訊的回授去調整
# PWM 會來回震盪、永遠到不了穩態。
#
# 拉桿變動時只更新畫面上的「待套用值」, 真正呼叫 Bridge.call 一律要等使用者按下
# 「套用」按鈕。方向切換與緊急停止時一律先把PWM歸零, 避免馬達全速運轉中被瞬間反轉。
PUMP_PWM_MAX = 255
# v3.1: 換了幫浦, 移除舊幫浦的「PWM 1~99 無效區間自動歸零」設計, 0-255 直接送出。

pump_state = {"pwm": 0, "forward": True}
_pump_lock = threading.Lock()
_pump_bridge_error = None  # 最近一次跟MCU溝通失敗的訊息, 成功後清成 None


def _safe_pump_bridge_call(name, arg=""):
    """包一層 try/except: 避免MCU沒回應時例外往上炸穿, 讓後面的 push_pump_status()
    永遠不會執行 —— 那樣前端會完全收不到回應, 使用者會以為是按鈕壞了, 但其實是
    指令根本沒送到MCU。回傳 (成功與否, 結果字串或None)。"""
    global _pump_bridge_error
    try:
        result = Bridge.call(name, arg)
        _pump_bridge_error = None
        return True, result
    except Exception as e:
        _pump_bridge_error = f"{name} 失敗: {e}"
        print(f"[pump] Bridge.call({name!r}, {arg!r}) 失敗: {e}")
        return False, None


def _sync_pump_status_from_mcu():
    """開機時先問一次MCU目前實際的PWM/方向, 避免Python端狀態跟硬體對不上
    (例如MCU曾被單獨重開機, 但Python端還記得舊狀態)。"""
    try:
        raw = Bridge.call("get_pump_status", "")
        pwm_str, dir_str = raw.split(",")
        with _pump_lock:
            pump_state["pwm"] = int(float(pwm_str))
            pump_state["forward"] = (dir_str.strip() == "1")
    except Exception:
        pass  # 讀不到就沿用目前記錄的狀態(預設停止)


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
    print(f"[pump] -> MCU set_pump_pwm({pwm}) {'回應 ' + str(resp) if ok else '失敗(見上一行)'}")
    # 不論MCU有沒有回應成功都更新Python端狀態並廣播, 確保按下「套用」後前端一定
    # 收到回應; 溝通失敗時 pump_status 會帶 bridge_error 說明實際上可能沒送到硬體。
    with _pump_lock:
        pump_state["pwm"] = pwm
    push_pump_status()


def handle_set_pump_direction(client, data):
    """切換方向前一律先讓MCU把PWM歸零, 避免正在全速運轉時被直接反向。"""
    data = data or {}
    forward = bool((data or {}).get("forward", True))
    _safe_pump_bridge_call("set_pump_pwm", "0")
    _safe_pump_bridge_call("set_pump_direction", "1" if forward else "0")
    with _pump_lock:
        pump_state["pwm"] = 0
        pump_state["forward"] = forward
    push_pump_status()


def handle_stop_pump(client, data):
    global _valve_last_open_request
    # v3: MCU 的 stop_pump 會一併放開夾閥; 先記下原因, 夾閥事件紀錄才寫得出是誰放開的
    _valve_last_open_request = ("pump_emergency_stop", time.time())
    _safe_pump_bridge_call("stop_pump", "")
    with _pump_lock:
        pump_state["pwm"] = 0
    push_pump_status()


ui.on_message("set_pump_pwm", handle_set_pump_pwm)
ui.on_message("set_pump_direction", handle_set_pump_direction)
ui.on_message("stop_pump", handle_stop_pump)


# ---------------------------------------------------------------------------
# v4.4 (FW v3.10): 幫浦啟動助推 (kick-start)
# 蠕動幫浦靜止時有靜摩擦, 低 PWM(例如 150)常常轉不起來, 但一旦轉動後 150 就能維持。
# MCU 在「從停止 → 啟動」時先以 kick_pwm 跑 kick_ms, 再降回目標 PWM。
# stall: 啟用後若 PWM>0 但流量計連續 3 秒沒有脈衝, 自動再助推(最多 3 次, 夾閥未開時不做)。
# 設定存在 ph_valve_state.json 的 "pump_kick", MCU 重開機後自動推回。
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
        print(f"[pump] get_pump_kick 失敗: {e}")
        return False


def _pump_kick_apply(partial, save=True):
    arg = ",".join(f"{k}={int(partial[k])}" for k in PUMP_KICK_KEYS if partial.get(k) is not None)
    if not arg:
        return False, "沒有要修改的值"
    try:
        resp = Bridge.call("set_pump_kick", arg)
    except Exception as e:
        return False, str(e)
    if str(resp).startswith("rejected"):
        return False, str(resp).split(":", 1)[-1]
    if not _pump_kick_store(resp):
        return False, f"MCU 回應無法解析: {resp}"
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
            push_pump_kick(client, ok=False, error=f"{k} 不是數字")
            return
        partial[k] = v
    if "pwm" in partial and not (1 <= partial["pwm"] <= 255):
        push_pump_kick(client, ok=False, error="助推 PWM 需在 1–255")
        return
    if "ms" in partial and not (0 <= partial["ms"] <= 5000):
        push_pump_kick(client, ok=False, error="助推時間需在 0–5000 ms")
        return
    ok, err = _pump_kick_apply(partial)
    print(f"[pump] 啟動助推設定 {partial}: {'成功' if ok else '失敗 ' + str(err)}")
    push_pump_kick(None, ok=ok, error=err)


def pump_kick_restore():
    """MCU 重開機 / 程式啟動時把存檔的助推設定推回 MCU(只推不同的部分)。"""
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
        print(f"[pump] 還原啟動助推設定: {'成功' if ok else '失敗 ' + str(err)}")
    push_pump_kick()
    return True


ui.on_message("pump_get_kick", handle_pump_get_kick)
ui.on_message("pump_set_kick", handle_pump_set_kick)


# ============================= v4.9: MCU 自我恢復、狀態／重新同步、測試工具 =============================
RPC_WD_MAX_PER_HOUR = 2
mcu_reboot_times = deque(maxlen=50)      # Python 偵測到的 MCU 重開時間
rpc_wd_pref = {"en": 0, "sec": 60}     # v4.9.1: 自動重開已停用
_mcu_test = {"stress": None, "sim_mcu_block_until": 0.0}


def _reboots_last_hour():
    now = time.time()
    return sum(1 for t in mcu_reboot_times if now - t < 3600)


def rpc_wd_apply():
    """v4.9.1: MCU 自動重開已移除(實測 UNO Q 軟體重開後 MCU 不會接回 Bridge)。
    這裡一律送 en=0, 確保舊韌體(v3.10.6)的自動重開也被關閉。"""
    en = False
    try:
        r = Bridge.call("rpc_wd_set", f"en={1 if en else 0},sec={int(rpc_wd_pref.get('sec', 60))}")
        return True, str(r)
    except Exception as e:
        return False, str(e)


def mcu_restore_pump_after_reboot():
    """MCU 重開後幫浦一定是停的(開機先拉低腳位)。照重開前的設定(pump_state)恢復方向與 PWM。"""
    with _pump_lock:
        pwm, fwd = int(pump_state.get("pwm") or 0), bool(pump_state.get("forward", True))
    if pwm <= 0:
        print("[pump] MCU 重開: 重開前幫浦是停止的, 維持停止")
        return {"pwm": 0, "forward": fwd, "ok": True}
    ok1, _ = _safe_pump_bridge_call("set_pump_direction", "1" if fwd else "0")
    ok2, resp = _safe_pump_bridge_call("set_pump_pwm", str(pwm))
    ok = ok1 and ok2
    print(f"[pump] MCU 重開: 恢復幫浦 PWM {pwm} {'正轉' if fwd else '反轉'} → {'成功' if ok else '失敗'}")
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
                msg = "已重新讀回並同步所有設定"
            except Exception as e:
                ok, msg = False, f"同步失敗: {e}"
        else:
            msg = "MCU 沒有回應, 無法同步: " + str(mcu_link.get("error"))
        print(f"[mcu] 重新同步: {msg}")
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
    methods = ("get_pump_status", "get_ph_config", "get_flow_data", "get_pump_kick", "valve_get_status")

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
        print(f"[mcu] 壓力測試: {res}")
        push_mcu_status(None, action="stress", ok=res["fail"] == 0,
                        msg=f"{res['ok']}/{n} 成功, 平均 {res['avg_ms']} ms, 最慢 {res['max_ms']} ms")
    threading.Thread(target=_bg, daemon=True).start()


def handle_mcu_sim_py_down(client, data):
    global _sim_py_down_until
    sec = float(max(5, min(300, float((data or {}).get("sec", 30)))))
    _sim_py_down_until = time.time() + sec
    print(f"[mcu] 測試: 模擬 Python 端斷線 {sec:.0f} 秒")
    push_mcu_status(None, action="sim_py", msg=f"模擬斷線 {sec:.0f} 秒")


def handle_mcu_sim_mcu_block(client, data):
    sec = int(max(10, min(600, float((data or {}).get("sec", 90)))))
    try:
        r = Bridge.call("rpc_test_block", str(sec))
        _mcu_test["sim_mcu_block_until"] = time.time() + sec
        print(f"[mcu] 測試: MCU 模擬收不到指令 {sec} 秒 → {r}")
        push_mcu_status(None, action="sim_mcu", msg=str(r))
    except Exception as e:
        push_mcu_status(None, action="sim_mcu", ok=False, msg=str(e))


for _n, _h in (("mcu_status_get", handle_mcu_status_get), ("mcu_resync", handle_mcu_resync),
               ("mcu_wd_set", handle_mcu_wd_set), ("mcu_stress", handle_mcu_stress),
               ("mcu_sim_py_down", handle_mcu_sim_py_down), ("mcu_sim_mcu_block", handle_mcu_sim_mcu_block)):
    ui.on_message(_n, _h)


def _disable_wd_on_exit():
    """App 正常停止時關掉 MCU 的 watchdog, 避免 MCU 在沒有 Python 的情況下自己重開(會停掉幫浦)。"""
    try:
        _RawBridge.call("rpc_wd_set", "en=0", timeout=2)
        print("[rpc] App 停止: 已關閉 MCU 自動重開")
    except Exception:
        pass


import atexit
atexit.register(_disable_wd_on_exit)


# v4.5 (FW v3.10.2): DS18B20 1-Wire 診斷(網頁按鈕), 順便要 MCU 立刻重新搜尋
def handle_ds_diag(client, data):
    try:
        resp = str(Bridge.call("ds_diag", ""))
        ok = not resp.startswith("rejected")
    except Exception as e:
        resp, ok = f"Bridge 呼叫失敗: {e}(韌體需要 v3.10.1 以上)", False
    kv = {}
    head, _, hint = resp.partition(" => ")
    for part in head.split():
        if "=" in part:
            k, v = part.split("=", 1)
            kv[k] = v
    print(f"[ds18b20] 網頁要求診斷: {resp}")
    ui.send_message("ds_diag", {"ok": ok, "raw": resp, "kv": kv, "hint": hint, "t": time.time()}, client)


ui.on_message("ds_diag", handle_ds_diag)

# (v3.2: _sync_pump_status_from_mcu() 改到啟動執行緒裡做, 見檔案最後的 _startup_mcu_sync)


# ============================= 共用: key=value 字串 =============================
def _parse_kv(payload):
    """把 MCU 送來的 "a=1,b=2,msg=xxx" 拆成 dict(值保持字串)。"""
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


# ============================= pH 校正值與夾閥設定的保存 (v3) =============================
# pH 校正點、夾閥位置/安全上限全部存在 MCU 的 RAM, MCU 一重開就
# 回到 sketch 裡的預設值。跟 OD600/壓力校正一樣, Linux 側存一份(ph_valve_state.json),
# 偵測到 MCU 重開就推回去。
#
# 規則: 「網頁上改過並存檔的設定」優先於 sketch 預設值。想回到 sketch 預設值,
#       把 ph_valve_state.json 刪掉再重開 App 即可。
PH_VALVE_STATE_PATH = os.path.join(_SEARCH_DIR, "ph_valve_state.json")
_pv_lock = threading.Lock()
pv_saved = {}            # {"ph_config": {...}, "valve_config": {...}}
_pv_startup_done = False # 開機同步(把存檔推回 MCU)完成之前, 不存任何從 MCU 讀到的值


def _load_pv_state():
    try:
        with open(PH_VALVE_STATE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except (json.JSONDecodeError, OSError) as e:
        print(f"[ph/valve] 讀取 {PH_VALVE_STATE_PATH} 失敗({e}), 當作沒有存檔")
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
            os.replace(tmp_path, PH_VALVE_STATE_PATH)   # 原子替換, 寫到一半斷電也不會壞檔
        except OSError as e:
            print(f"[ph/valve] 寫入 {PH_VALVE_STATE_PATH} 失敗: {e}")


# ============================= pH 監測 (v3.1: 只監測與記錄) =============================
# v3.1 拿掉 KOH 加鹼控制。MCU 每秒 notify 一次 pH/電壓/溫度/狀態, 這裡負責顯示、兩點校正、
# 把校正點存檔(MCU 重開自動推回), 以及餵給聚合視窗寫進 CSV。
PH_CONFIG_KEYS = ("v7", "v4", "cal_temp", "temp")   # temp = 手動補償溫度(v3.4)
PH_STALE_SEC = 10.0

_ph_lock = threading.Lock()
latest_ph = {"ts": 0.0, "ph": None, "voltage": None, "temp_c": None, "state": "UNKNOWN"}
ph_config = {}                  # MCU 目前生效的校正值


def _ph_from_kv(kv):
    return {
        "ts": time.time(),
        "ph": _f(kv.get("ph")),
        "voltage": _f(kv.get("v")),
        "temp_c": _f(kv.get("t")),
        "state": kv.get("state", "UNKNOWN"),   # WARMUP / OK / PROBE_ERROR
        # v3.8: 溫度來源 ds18b20 | manual, DS18B20 狀態 ok | none | error(舊韌體沒有這兩欄)
        "temp_src": kv.get("src", "manual"),
        "ds_state": kv.get("ds", "none"),
    }


def _ph_snapshot():
    with _ph_lock:
        snap = dict(latest_ph)
    snap["config"] = dict(ph_config)
    snap["stale"] = (time.time() - snap["ts"]) > PH_STALE_SEC if snap["ts"] else True
    return snap


def push_ph_status(client=None):
    ui.send_message("ph_update", _ph_snapshot(), client)


def on_ph_update(payload):
    """MCU 每秒 Bridge.notify("on_ph_update")。這是 Bridge 回呼: 只更新狀態與推播,
    絕對不在這裡做同步 Bridge.call(原因見 on_od600_update 的說明)。"""
    kv = _parse_kv(payload)
    if "state" not in kv:
        print(f"[ph] WARNING: on_ph_update 收到異常 payload: {payload}")
        return
    d = _ph_from_kv(kv)
    with _ph_lock:
        prev_state = latest_ph.get("state")
        latest_ph.update(d)
    if d["state"] == "PROBE_ERROR" and prev_state != "PROBE_ERROR":
        print(f"[ph] WARNING: pH 讀值超出合理範圍(pH={d['ph']}, V={d['voltage']}), 檢查探頭/接線/校正")
    if d["state"] == "OK":
        agg_push_ph(d)          # 探頭異常或暖機中的讀值不進 CSV 的聚合值
    push_ph_status()


Bridge.provide("on_ph_update", on_ph_update)


def _ph_read_config_from_mcu():
    """讀回 MCU 目前生效的 pH 校正值。失敗回傳 None。"""
    try:
        kv = _parse_kv(Bridge.call("get_ph_config", ""))
    except Exception as e:
        print(f"[ph] get_ph_config 失敗: {e}")
        return None
    cfg = {k: _f(kv.get(k)) for k in PH_CONFIG_KEYS}
    if any(v is None for v in cfg.values()):
        return None
    cfg["temp_src"] = kv.get("temp_src", "manual")
    return cfg


def _ph_apply_config(cfg_partial, save_as=None):
    """送 set_ph_config(只有 v7/v4/cal_temp)。成功時更新 ph_config 並存檔, 回傳 (ok, error)。"""
    global ph_config
    arg = ",".join(f"{k}={cfg_partial[k]}" for k in PH_CONFIG_KEYS if cfg_partial.get(k) is not None)
    if not arg:
        return False, "沒有要修改的值"
    try:
        resp = Bridge.call("set_ph_config", arg)
    except Exception as e:
        return False, str(e)
    if _rejected(resp):
        return False, _reject_reason(resp)
    kv = _parse_kv(resp)
    new_cfg = {k: _f(kv.get(k)) for k in PH_CONFIG_KEYS}
    if all(v is not None for v in new_cfg.values()):
        _pv_save("ph_config", dict(new_cfg, source=save_as or "manual"))
        new_cfg["temp_src"] = kv.get("temp_src", "manual")
        ph_config = new_cfg
    return True, None


def push_ph_config(client=None, ok=True, error=None, action=None):
    with _pv_lock:
        saved = pv_saved.get("ph_config") or {}
        src = saved.get("source")
        saved_at = saved.get("saved_at")
    ui.send_message("ph_config", {
        "ok": ok, "error": error, "action": action,
        "config": dict(ph_config), "source": src, "saved_at": saved_at,
    }, client)


def handle_ph_get_config(client, data):
    global ph_config
    cfg = _ph_read_config_from_mcu()
    if cfg:
        ph_config = cfg
    push_ph_config(client, ok=cfg is not None, error=None if cfg else "讀不到 MCU 的 pH 校正值")


def handle_ph_calibrate(client, data):
    """兩點校正: point = "7" 或 "4"。拿掉加鹼控制後不需要先暫停。"""
    global ph_config
    point = str((data or {}).get("point", "")).strip()
    buf_t = _f((data or {}).get("buffer_temp"))
    arg = f"{point},{buf_t}" if buf_t is not None else point   # v3.4: 可帶標準液溫度
    try:
        resp = Bridge.call("ph_calibrate", arg)
    except Exception as e:
        push_ph_config(client, ok=False, error=str(e), action="calibrate")
        return
    if _rejected(resp):
        push_ph_config(client, ok=False, error=_reject_reason(resp), action="calibrate")
        return
    cfg = _ph_read_config_from_mcu()
    if cfg:
        ph_config = cfg
        _pv_save("ph_config", dict({k: cfg[k] for k in PH_CONFIG_KEYS}, source="measured"))
    print(f"[ph] 校正點 pH{point} 已設定, V={resp}" + (f", 標準液 {buf_t} °C" if buf_t is not None else ""))
    push_ph_config(None, ok=True, action=f"calibrate{point}")


def handle_ph_set_temp(client, data):
    """v3.4: 手動輸入 pH 溫度補償用的溫度(沒裝 DS18B20 時生效)。存檔, MCU 重開會推回。"""
    t = _f((data or {}).get("temp"))
    if t is None or not (0.0 <= t <= 80.0):
        push_ph_config(client, ok=False, error="溫度必須是 0–80 °C", action="temp")
        return
    ok, err = _ph_apply_config({"temp": round(t, 2)}, save_as="manual")
    if ok:
        print(f"[ph] 手動補償溫度設為 {t:.2f} °C")
    push_ph_config(None if ok else client, ok=ok, error=err, action="temp")


def handle_ph_set_calibration(client, data):
    """v3.10: 校正值管理 → 手動輸入 pH 7.00 / 4.01 的原始電壓與校正溫度。存檔, MCU 重開會推回。"""
    d = data or {}
    v7, v4, ct = _f(d.get("v7")), _f(d.get("v4")), _f(d.get("cal_temp"))
    err = None
    if v7 is None or v4 is None or ct is None:
        err = "v7、v4、校正溫度三個值都要填"
    elif not (0.0 < v7 < 3.3 and 0.0 < v4 < 3.3):
        err = "電壓必須在 0–3.3 V 之間"
    elif abs(v7 - v4) < 0.01:
        err = "pH 7 與 pH 4 的電壓太接近(相差需 ≥ 0.01 V)"
    elif not (0.0 <= ct <= 80.0):
        err = "校正溫度必須是 0–80 °C"
    if err:
        push_ph_config(client, ok=False, error=err, action="manual_cal")
        return
    ok, err = _ph_apply_config({"v7": round(v7, 5), "v4": round(v4, 5), "cal_temp": round(ct, 2)},
                               save_as="manual")
    if ok:
        print(f"[ph] 手動輸入校正值: pH7={v7:.4f} V, pH4={v4:.4f} V, 校正溫度 {ct:.1f} °C")
    push_ph_config(None if ok else client, ok=ok, error=err, action="manual_cal")


ui.on_message("ph_get_config", handle_ph_get_config)
ui.on_message("ph_set_calibration", handle_ph_set_calibration)
ui.on_message("ph_calibrate", handle_ph_calibrate)
ui.on_message("ph_set_temp", handle_ph_set_temp)


# ============================= 夾閥 STS3215 (v3) =============================
# 只做手動開 / 關。安全放開(TMP/Feed 超限、夾閉超時、伺服過熱、通訊中斷)全部在 MCU 端,
# 這裡負責: 操作介面、設定存檔還原、每一次「夾閉→放開」寫一列到 valve_events.csv。
VALVE_CONFIG_KEYS = ("id", "open", "closed", "speed", "acc", "torque_limit",
                     "max_close_s", "tmp_limit", "feed_limit", "baud", "feed_basis")   # baud: v3.4, feed_basis: v4.11
_VALVE_CONST = CONST.get("valve", {}) or {}
# 夾閥動作會讓 ΔP / R / dTMP/dt 劇烈變化, 這些「積垢趨勢」類告警在夾閉期間與放開後
# 這段時間內暫停, 避免把收樣本誤判成膜堵塞。TMP 絕對上限類告警不受影響。
VALVE_ALERT_SETTLE_SEC = float(_VALVE_CONST.get("alert_settle_sec", 60.0))
VALVE_SUPPRESSED_ALERTS = ("dp_ratio_high", "gamma_ratio_high", "lp_low", "ps_rise")

_valve_lock = threading.Lock()
latest_valve = {
    "ts": 0.0, "online": False, "cmd": "unknown", "fault": False, "pos": None, "goal": None,
    "load": None, "temp_c": None, "voltage_v": None, "current": None, "moving": False,
    "closed_s": 0.0, "torque": False, "configured": False, "msg": "",
}
valve_config = {}
_valve_opened_at_mono = None       # 最近一次回到 open 的時間(告警抑制用)
_valve_event = None                # 進行中(夾閉中)的事件累積
_valve_last_open_request = (None, 0.0)   # (原因, wall time): 用來判斷放開是誰觸發的
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
    """夾閥目前不在「開」(夾閉中或設定用的 jog 位置)。"""
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
    """夾閉期間收集壓力統計(由 on_pressure_update 每 200ms 呼叫)。"""
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
        print(f"[valve] 寫入 {path} 失敗: {e}")


def on_valve_update(payload):
    """MCU 每秒 + 狀態改變時 notify。Bridge 回呼: 不做同步 RPC。
    在這裡偵測「open → closed/jog」與「→ open」的轉換, 組成一筆夾閥事件。"""
    global _valve_event, _valve_opened_at_mono, _valve_event_index
    kv = _parse_kv(payload)
    if "cmd" not in kv:
        print(f"[valve] WARNING: on_valve_update 收到異常 payload: {payload}")
        return
    d = _valve_from_kv(kv)
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
        print(f"[valve] valve_get_config 失敗: {e}")
        return None
    cfg = {k: _f(kv.get(k)) for k in VALVE_CONFIG_KEYS}
    return cfg if all(v is not None for v in cfg.values()) else None


def _valve_apply_config(partial, source="manual"):
    global valve_config
    arg = ",".join(f"{k}={partial[k]}" for k in VALVE_CONFIG_KEYS if partial.get(k) is not None)
    if not arg:
        return False, "沒有要修改的值"
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
    _valve_call(client, "valve_open", "", "open")


def handle_valve_close(client, data):
    _valve_call(client, "valve_close", "", "close")


def handle_valve_goto_raw(client, data):
    pos = _i((data or {}).get("pos"))
    if pos is None:
        ui.send_message("valve_action_result", {"action": "goto", "ok": False, "error": "位置必須是 0~4095 的整數"}, client)
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
    push_valve_config(client, ok=cfg is not None, error=None if cfg else "讀不到 MCU 的夾閥設定")


def handle_valve_set_config(client, data):
    data = data or {}
    partial = {}
    for k in VALVE_CONFIG_KEYS:
        if data.get(k) not in (None, ""):
            v = _f(data.get(k))
            if v is None:
                push_valve_config(client, ok=False, error=f"{k} 不是數值", action="settings")
                return
            partial[k] = int(v) if k in ("id", "open", "closed", "speed", "acc", "torque_limit",
                                         "max_close_s", "baud", "feed_basis") else v
    ok, err = _valve_apply_config(partial)
    push_valve_config(None if ok else client, ok=ok, error=err, action="settings")


def handle_valve_save_position(client, data):
    """把伺服「目前實際位置」記為開 / 夾閉位置(搭配關扭力用手轉, 或 jog 微調)。"""
    which = (data or {}).get("which")
    if which not in ("open", "closed"):
        return
    with _valve_lock:
        pos = latest_valve.get("pos")
        online = latest_valve.get("online")
    if not online or pos is None or pos < 0:
        push_valve_config(client, ok=False, error="伺服離線或還沒讀到位置", action=f"save_{which}")
        return
    ok, err = _valve_apply_config({which: int(pos)})
    push_valve_config(None if ok else client, ok=ok, error=err, action=f"save_{which}")


# ---- v3.4: 伺服自動掃描 ----
# MCU 端依序試 8 種鮑率 x ID 0~253(完整, 約 30 秒)或只送廣播 Ping(快速, 約 1 秒)。
# 這裡啟動後開一條執行緒輪詢進度, 推給網頁; 掃完依「收到的位元組數」給出排錯提示。
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
            # v3.5: 每換一次鮑率 UART 重新設定時會讀到 1 個雜訊位元組, 所以每個鮑率 <= 2 bytes
            #       仍算「完全沒有回應」(v3.4 把這種情況誤判成 garbled)
            st["hint"] = "no_bytes"      # 沒有任何回應: 線路/電源/跳線
        else:
            st["hint"] = "garbled"       # 有收到但解析不出: 接法/回送(echo)/干擾
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
            print(f"[valve][scan] 完成: 找到 {st['found'] or '無'}; 各鮑率收到位元組 {st['rx']}")
            return
    ui.send_message("valve_scan", {"state": "error", "error": "掃描逾時(90 秒)"})


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
    print(f"[valve][scan] 開始{'快速' if mode == 'quick' else '完整'}掃描")
    ui.send_message("valve_scan", {"state": "running", "progress": 0, "mode": mode, "found": [], "rx": {}})
    if _valve_scan_thread is None or not _valve_scan_thread.is_alive():
        _valve_scan_thread = threading.Thread(target=_valve_scan_poll, daemon=True, name="valve_scan_poll")
        _valve_scan_thread.start()


def handle_valve_blind_move(client, data):
    """v3.5 盲送測試: 不需要伺服回應, 用來分辨是 TX/電源壞還是 RX(回應)那條路壞。"""
    pos = _i((data or {}).get("pos"))
    if pos is None:
        return
    print(f"[valve] 盲送測試: 廣播移動到 {pos}(8 種鮑率)")
    _valve_call(client, "valve_blind_move", str(pos), "blind")


def handle_valve_loopback(client, data):
    """v3.6: D0-D1 迴路測試。結果用 valve_loopback 訊息回傳。"""
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
                print(f"[valve] 迴路測試: 115200 {res['ok115200']}/64, 1Mbps {res['ok1000000']}/64")
                ui.send_message("valve_loopback", res, client)
                return
        ui.send_message("valve_loopback", {"state": "error", "error": "逾時"}, client)
    except Exception as e:
        ui.send_message("valve_loopback", {"state": "error", "error": str(e)}, client)


def handle_valve_use_found(client, data):
    """掃描結果按「使用」: 把伺服 ID 與鮑率寫進設定(並存檔)。"""
    data = data or {}
    sid, baud = _i(data.get("id")), _i(data.get("baud"))
    if sid is None or baud is None:
        return
    ok, err = _valve_apply_config({"id": sid, "baud": baud})
    if ok:
        print(f"[valve] 改用伺服 ID {sid} @ {baud} baud")
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


# ============================= pH / 夾閥: 開機同步、重開還原、背景維護 =============================


def restore_ph_valve_state(reason="restored"):
    """把存檔的 pH 校正值 / 夾閥設定推回 MCU(只推跟 MCU 目前不同的部分)。
    回傳 True 代表 MCU 有回應(不論有沒有東西需要推)。"""
    global ph_config, valve_config
    with _pv_lock:
        saved = {k: dict(v) for k, v in pv_saved.items()}

    mcu_ph = _ph_read_config_from_mcu()
    mcu_valve = _valve_read_config_from_mcu()
    if mcu_ph is None and mcu_valve is None:
        return False

    # ---- pH 校正點 ----
    if mcu_ph is not None:
        ph_config = mcu_ph
        sp = saved.get("ph_config")
        if sp:
            want = {k: sp.get(k) for k in PH_CONFIG_KEYS if sp.get(k) is not None}
            if any(abs((want[k] or 0) - (mcu_ph.get(k) or 0)) > 1e-4 for k in want):
                ok, err = _ph_apply_config(want, save_as=sp.get("source", reason))
                print(f"[ph] 還原存檔的 pH 校正點: {'成功' if ok else '失敗 ' + str(err)}")
        else:
            # 沒有存檔: 以 MCU(sketch 預設值)為準存一份, 之後重開才有東西可還原
            _pv_save("ph_config", dict({k: mcu_ph[k] for k in PH_CONFIG_KEYS}, source="sketch_default"))

    # ---- 夾閥設定 ----
    if mcu_valve is not None:
        valve_config = mcu_valve
        sv = saved.get("valve_config")
        # v4.11: Lumen in 上限預設 1.0 → 0.5 bar。舊存檔若還是 1.0, 一次性改成 0.5(之後使用者自己改的值不再動)
        if sv and not saved.get("feed_limit_v411"):
            if sv.get("feed_limit") is not None and abs(float(sv["feed_limit"]) - 1.0) < 1e-6:
                sv = dict(sv, feed_limit=0.5)
                print("[valve] Lumen in 上限由舊預設 1.0 bar 更新為 0.5 bar")
            _pv_save("feed_limit_v411", {"done": True})
        if sv:
            want = {k: sv.get(k) for k in VALVE_CONFIG_KEYS if sv.get(k) is not None}
            if any(abs((want[k] or 0) - (mcu_valve.get(k) or 0)) > 1e-4 for k in want):
                ok, err = _valve_apply_config(want, source=sv.get("source", reason))
                print(f"[valve] 還原存檔的夾閥設定: {'成功' if ok else '失敗 ' + str(err)}")
        else:
            # 沒有存檔: 用 constants.json 的 valve 區塊當初始值(若有)
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
                print(f"[valve] 套用 constants.json 的夾閥初始設定: {'成功' if ok else '失敗 ' + str(err)}")
            else:
                _pv_save("valve_config", dict(mcu_valve, source="sketch_default"))

    # v3.7: MCU 端的演算法選擇(流量 / OD600 估計)也一起推回去
    ok, err = push_alg_to_mcu()
    if not ok:
        print(f"[alg] 推送演算法設定到 MCU 失敗: {err}")
    push_ph_config()
    push_valve_config()
    push_alg_settings()
    try:
        pump_kick_restore()          # v4.4: 幫浦啟動助推設定
    except Exception as e:
        print(f"[pump] 還原啟動助推設定失敗: {e}")
    rpc_wd_apply()                   # v4.9: 指令通道 watchdog
    return True


def ph_valve_startup_sync():
    global _pv_startup_done
    if _pv_startup_done:
        return True
    if restore_ph_valve_state(reason="restored"):
        _pv_startup_done = True
        return True
    print("[ph/valve] 目前讀不到 MCU 的 pH/夾閥狀態(Bridge 可能還沒就緒), 稍後重試")
    return False


def ph_valve_housekeeping():
    """由 od600_poll_loop 每 5 秒呼叫: 開機同步(讀不到 MCU 時)重試。"""
    if not _pv_startup_done:
        ph_valve_startup_sync()


def ph_valve_system_alerts():
    """給 derive_loop 的系統告警(pH / 夾閥)。message 是中文後備字串, 前端用 code 組雙語文字。"""
    alerts = []
    ph = _ph_snapshot()
    if ph["ts"] and ph["stale"]:
        alerts.append({"level": "warning", "code": "ph_stale",
                       "message": "超過 10 秒沒有收到 pH 資料"})
    elif ph["ts"] and ph["state"] == "PROBE_ERROR":
        alerts.append({"level": "warning", "code": "ph_probe_error", "value": ph["ph"],
                       "message": "pH 讀值超出合理範圍(2–12), 請檢查探頭、接線或校正值"})
    with _valve_lock:
        v = dict(latest_valve)
    if v["ts"]:
        if v["fault"]:
            alerts.append({"level": "critical", "code": "valve_fault", "value": v["msg"],
                           "message": f"夾閥 FAULT: {v['msg']}(已自動放開, 確認後按「解除」)"})
        elif not v["online"] and not v.get("scanning"):
            alerts.append({"level": "warning", "code": "valve_offline",
                           "message": "夾閥伺服離線(可在「夾閥設定」用自動掃描找伺服)"})
        if v["cmd"] in ("closed", "jog"):
            alerts.append({"level": "warning", "code": "valve_closed", "value": v["closed_s"],
                           "message": f"夾閥夾閉中({v['closed_s']:.0f} 秒), 積垢趨勢類告警暫停"})
    return alerts


def on_client_connect(sid):
    """有新的網頁client連進來時, 先把目前狀態補送一次, 畫面才不會是空的/顯示錯的。
    每一步個別包 try/except: 任何一步出錯都不能連累其他步驟送不出去。"""
    for label, fn in (
        ("pressure_update", lambda: ui.send_message("pressure_update", latest_pressure, sid)),
        ("pump_status", lambda: push_pump_status(sid)),
        ("od600_update", lambda: _od_snapshot(sid)),
        ("od600_blank", lambda: ui.send_message("od600_blank", dict(od600_blank_info), sid)),
        ("od600_dev_status", lambda: ui.send_message("od600_dev_status", {"dev_mode": od600_dev_mode}, sid)),
        ("od600_settings", lambda: handle_od_get_settings(sid, None)),
        ("aggregate_settings", lambda: push_agg_settings(sid)),
        # 補送最近一次的聚合結果, 但標記 stale=True: 這是「上一個視窗」的舊值, 不是
        # 為這個瀏覽器新算的。前端收到 stale 的就只拿來當佔位, 卡片會繼續跟著 5Hz 的
        # 瞬時值走、曲線圖也先不畫點, 直到第一個「真正屬於這次連線」的視窗結束為止 ——
        # 否則使用者一連上就看到一組不會動的數字, 會以為系統當掉了。
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
    ):
        try:
            fn()
        except Exception as e:
            print(f"[on_client_connect] {label} 發送失敗: {e}")


ui.on_connect(on_client_connect)


# ============================= HFM 衍生參數 (v4, 依 HFM_bioreactor_UI_spec.md) =============================
# 通道對應: feed = P_in(模組底部 lumen 入口), retentate = P_out(模組頂部 lumen 出口),
#           permeate = P_s(shell 取樣 luer, 與 P_out 等高), 流量計 = Q_L(lumen 循環)。
# 壓力內部一律 bar, 這一節的輸出一律 kPa(本系統的壓差只有幾 kPa, 用 bar 顯示看不出變化)。
_HFM_DEFAULTS = {
    "membrane_area_cm2": 200.0, "n_eff": 11, "fiber_id_cm": 0.1, "fiber_length_cm": 60.0,
    "shell_id_cm": 1.0, "v_lumen_ml": 5.2, "v_shell_ml": 36.0, "v_culture_l": 1.0,
    "rho_gh_kpa_default": 5.9, "mu_cp": 0.7, "fluid_density_kg_m3": 1000.0,
    "dp_q_a_kpa_per_mlmin": 0.02615, "dp_q_b_kpa_per_mlmin2": 0.0,
    "gamma_target_s1": 2000.0, "gamma_max_s1": 6000.0, "design_j_lmh": 2.0, "design_d_h": 0.04,
    "alarm_dp_ratio": 1.3, "alarm_gamma_ratio": 1.3, "alarm_lp_fraction": 0.7,
    "alarm_ps_rise_kpa": 2.0, "q_min_for_ratio_mlmin": 10.0, "tmp_out_min_window_s": 3.0,
    "selftest_settle_s": 10.0, "selftest_record_s": 30.0, "selftest_max_s": 180.0,
    "selftest_plateau_kpa_per_min": 0.15, "selftest_diff_warn_fraction": 0.10,
}
HFM = dict(_HFM_DEFAULTS)
HFM.update({k: v for k, v in (CONST.get("hfm") or {}).items() if not str(k).startswith("_")})
HFM_FILE_DEFAULTS = dict(HFM)      # 「恢復預設」= constants.json 的值(規格管理覆寫前)

# ---- 規格管理 (v4.1): 使用者可在網頁上改的規格, 覆寫值存在 ph_valve_state.json 的 "specs" ----
# (key, 最小值, 最大值, 群組)。群組只給前端排版用。
SPEC_FIELDS = (
    ("n_eff", 1, 10000, "geometry"), ("fiber_id_cm", 0.005, 5, "geometry"),
    ("fiber_length_cm", 1, 500, "geometry"), ("membrane_area_cm2", 1, 1e6, "geometry"),
    ("shell_id_cm", 0.1, 50, "geometry"),
    ("v_lumen_ml", 0.01, 1e4, "volume"), ("v_shell_ml", 0.01, 1e4, "volume"), ("v_culture_l", 0.01, 1e3, "volume"),
    ("mu_cp", 0.1, 100, "fluid"), ("fluid_density_kg_m3", 500, 2000, "fluid"), ("rho_gh_kpa_default", -20, 20, "fluid"),
    ("gamma_target_s1", 10, 1e5, "operating"), ("gamma_max_s1", 10, 1e5, "operating"),
    ("design_j_lmh", 0.01, 1000, "operating"), ("design_d_h", 0.0001, 10, "operating"),
    ("alarm_dp_ratio", 1.0, 10, "alarm"), ("alarm_gamma_ratio", 1.0, 10, "alarm"),
    ("alarm_lp_fraction", 0.05, 1.0, "alarm"), ("alarm_ps_rise_kpa", 0.1, 100, "alarm"),
    ("q_min_for_ratio_mlmin", 0, 1000, "alarm"), ("tmp_out_min_window_s", 0.5, 60, "alarm"),
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
            errs.append(f"{k}: 不是數字"); continue
        lo, hi = ranges[k]
        if not (lo <= x <= hi) or x != x:
            errs.append(f"{k}: 必須在 {lo} ~ {hi}"); continue
        out[k] = int(round(x)) if k == "n_eff" else x
    gt = out.get("gamma_target_s1", HFM["gamma_target_s1"])
    gm = out.get("gamma_max_s1", HFM["gamma_max_s1"])
    if gt >= gm:
        errs.append("gamma_target_s1 必須小於 gamma_max_s1")
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
        push_specs_state(client, ok=False, error="；".join(errs), action="set")
        return
    merged = dict(spec_overrides)
    for k, v in vals.items():
        if abs(float(v) - float(HFM_FILE_DEFAULTS[k])) < 1e-12:
            merged.pop(k, None)        # 跟預設一樣就不必存成覆寫
        else:
            merged[k] = v
    specs_apply(merged)
    print(f"[specs] 規格更新: {vals}")
    push_specs_state(None, ok=True, action="set")
    push_hfm_state()


def handle_specs_reset(client, data):
    specs_apply({})
    print("[specs] 規格恢復為 constants.json 的預設值")
    push_specs_state(None, ok=True, action="reset")
    push_hfm_state()


ui.on_message("specs_get", handle_specs_get)
ui.on_message("specs_set", handle_specs_set)
ui.on_message("specs_reset", handle_specs_reset)

_hfm_lock = threading.Lock()
# 可調整/會存檔的狀態(存在 ph_valve_state.json 的 "hfm" 項目)
hfm_state = {
    "rho_gh_kpa": float(HFM["rho_gh_kpa_default"]), "rho_gh_source": "default", "rho_gh_at": None,
    "ps_ref_kpa": None,                      # 自檢時的 P_s(停泵、通大氣), 「P_s 無故上升」的參考
    "dp_a": float(HFM["dp_q_a_kpa_per_mlmin"]), "dp_b": float(HFM["dp_q_b_kpa_per_mlmin2"]),
    "dp_source": "default", "dp_at": None,
    "q_perm_mlmin": None, "q_perm_source": None,   # 目前沒有電子秤: 只能手動輸入
    "lp_initial": None, "lp_initial_at": None,
    "q_l_mode": "meter", "q_l_manual": None,  # v4.7: Q_L 來源(流量計 / 手動輸入)
    "dp_points": None, "dp_fit": None,       # v4.6: ΔP–Q 掃描的量測點與擬合結果(可輸出/輸入)
}
_HFM_SAVE_KEYS = tuple(hfm_state.keys())
# P_out 波谷 − P_s 的最近幾秒(嚴格版 TMP_out, 涵蓋數個蠕動泵週期)
_hfm_trough_buf = deque()     # (monotonic_t, kPa)


def _hfm_geom():
    d = HFM["fiber_id_cm"] / 100.0          # m
    L = HFM["fiber_length_cm"] / 100.0      # m
    n = float(HFM["n_eff"])
    mu = HFM["mu_cp"] / 1000.0              # Pa·s
    area_flow = n * math.pi * d * d / 4.0   # m² (所有纖維截面積)
    return d, L, n, mu, area_flow


def hfm_track_pressure(snapshot):
    """on_pressure_update(5 Hz) 呼叫: 記錄 P_out 瞬時波谷 − P_s, 供嚴格版 TMP_out。也餵自檢。"""
    now = time.monotonic()
    c = snapshot["channels"]
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
    """規格書 §4/§6 的所有衍生參數。缺資料的項目回傳 None, 不會丟例外。"""
    if st is None:
        with _hfm_lock:
            st = dict(hfm_state)
    if p_in_bar is None or p_out_bar is None or p_s_bar is None:
        return {}
    q = q_l if (q_l is not None and q_l > 0) else 0.0
    q_src = "meter"
    if st.get("q_l_mode") == "manual" and st.get("q_l_manual"):   # v4.7: 手動 Q_L 取代流量計
        q, q_src = float(st["q_l_manual"]), "manual"
    d, L, n, mu, area_flow = _hfm_geom()
    rho = st["rho_gh_kpa"]
    p_in, p_out, p_s = p_in_bar * 100.0, p_out_bar * 100.0, p_s_bar * 100.0

    dp_total = p_in - p_out
    dpf = dp_total - rho                                   # §4.2 扣除重力的摩擦壓降
    tmp_out = p_out - p_s                                  # §4.1
    tmp_mean = (p_in + p_out) / 2.0 - p_s                  # §6
    tmp_in = p_in - (p_s + rho)
    qmin = HFM["q_min_for_ratio_mlmin"]

    dp_base = st["dp_a"] * q + st["dp_b"] * q * q if q >= qmin else None
    dp_ratio = (dpf / dp_base) if (dp_base and dp_base > 1e-6) else None

    tau_w = dpf * 1000.0 * d / (4.0 * L)                   # Pa  (= dP[Pa] × 4.17e-4)
    gamma_p = tau_w / mu                                   # s⁻¹ §4.3
    v = (q * 1e-6 / 60.0) / area_flow                      # m/s, 每根纖維的平均流速
    gamma_f = 8.0 * v / d                                  # s⁻¹ (= Q × 15.4)
    gamma_ratio = (gamma_p / gamma_f) if (q >= qmin and gamma_f > 1e-6) else None
    re = HFM["fluid_density_kg_m3"] * v * d / mu
    nonuni = (dpf / tmp_mean) if abs(tmp_mean) > 0.05 else None

    qp = st.get("q_perm_mlmin")
    j = lp = d_act = rt = tau_shell = lp_frac = None
    if qp is not None and qp > 0:
        area_m2 = HFM["membrane_area_cm2"] / 1e4
        j = (qp * 60.0 / 1000.0) / area_m2                 # LMH
        d_act = (qp * 60.0 / 1000.0) / HFM["v_culture_l"]  # h⁻¹
        tau_shell = HFM["v_shell_ml"] / qp                 # min
        if tmp_mean > 0.1:                                 # kPa; 太小時比值沒有意義
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
        "tmp_mean_kpa": r(tmp_mean, 3), "tmp_in_kpa": r(tmp_in, 3), "tmp_nonuniformity": r(nonuni, 3),
        "tau_w_pa": r(tau_w, 3), "gamma_pressure_s1": r(gamma_p, 0), "gamma_flow_s1": r(gamma_f, 0),
        "gamma_ratio": r(gamma_ratio, 3), "re": r(re, 0),
        "q_perm_mlmin": r(qp, 3), "j_lmh": r(j, 3), "lp_lmh_bar": r(lp, 2), "lp_fraction": r(lp_frac, 3),
        "d_actual_h": r(d_act, 4), "rt_m1": (float("%.3e" % rt) if rt is not None else None),
        "tau_shell_min": r(tau_shell, 1),
        # 相容: steady/trend/CSV 原本用的兩個量
        "delta_p_bar": r(p_in_bar - p_out_bar, 5), "tmp_bar": r(tmp_mean / 100.0, 5),
    }


def compute_hfm_alerts(h, st):
    """規格書 §7 告警清單 + 保留膜的絕對壓力上限(collapse)保護。"""
    alerts = []
    if not h:
        return alerts
    tmp_out = h.get("tmp_out_kpa")
    if tmp_out is not None and tmp_out <= 0:
        alerts.append({"level": "critical", "code": "tmp_out_nonpositive",
                       "message": f"TMP_out = {tmp_out:.2f} kPa ≤ 0：倒流風險，請立即檢查取樣閥／收集瓶管路"})
    tmin = h.get("tmp_out_min_kpa")
    if tmin is not None and tmin <= 0 and not (tmp_out is not None and tmp_out <= 0):
        alerts.append({"level": "critical", "code": "tmp_out_min_nonpositive",
                       "message": f"P_out 波谷 − P_s = {tmin:.2f} kPa ≤ 0：泵脈動觸及倒流"})
    dr = h.get("dp_ratio")
    if dr is not None and dr > HFM["alarm_dp_ratio"]:
        alerts.append({"level": "warning", "code": "dp_ratio_high",
                       "message": f"ΔP_friction 為基準的 {dr:.2f} 倍（> {HFM['alarm_dp_ratio']}）：纖維堵塞疑慮"})
    gr = h.get("gamma_ratio")
    if gr is not None and gr > HFM["alarm_gamma_ratio"]:
        alerts.append({"level": "warning", "code": "gamma_ratio_high",
                       "message": f"γ_ratio = {gr:.2f}（> {HFM['alarm_gamma_ratio']}）：有效纖維數下降，堵塞預警"})
    lf = h.get("lp_fraction")
    if lf is not None and lf < HFM["alarm_lp_fraction"]:
        alerts.append({"level": "warning", "code": "lp_low",
                       "message": f"L_p 降到初始值的 {lf*100:.0f}%（< {HFM['alarm_lp_fraction']*100:.0f}%）：結垢或膜異常（低通量下應極慢，屬異常）"})
    ps, ps_ref = h.get("ps_kpa"), st.get("ps_ref_kpa")
    if ps is not None and ps_ref is not None and ps - ps_ref > HFM["alarm_ps_rise_kpa"]:
        alerts.append({"level": "warning", "code": "ps_rise",
                       "message": f"P_s 比自檢時高 {ps-ps_ref:.2f} kPa：收集側排液可能受阻"})
    # 保留: 膜/模組的絕對壓力上限(與夾閥 MCU 端連鎖同一個門檻)
    tmp_bar = h.get("tmp_bar")
    lim = THRESH.get("tmp_critical_bar", 0.5)
    if tmp_bar is not None and tmp_bar > lim:
        alerts.append({"level": "critical", "code": "tmp_critical",
                       "message": f"TMP_mean {tmp_bar*100:.1f} kPa 超過絕對上限 {lim*100:.0f} kPa"})
    return alerts


# ---- 狀態存檔 / 推播 / 設定 ----
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
    print(f"[hfm] 已載入存檔: ρgh={hfm_state['rho_gh_kpa']} kPa ({hfm_state['rho_gh_source']}), "
          f"ΔP–Q a={hfm_state['dp_a']} b={hfm_state['dp_b']}, Q_perm={hfm_state['q_perm_mlmin']}")


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
    """手動設定: rho_gh_kpa / dp_a / dp_b / q_perm_mlmin(null=清除) / reset_lp_initial。"""
    d = data or {}
    err = None
    changed = []
    with _hfm_lock:
        try:
            if d.get("rho_gh_kpa") not in (None, ""):
                v = float(d["rho_gh_kpa"])
                if not (-20.0 <= v <= 20.0):
                    raise ValueError("ρgh 必須在 −20 ~ 20 kPa")
                hfm_state.update(rho_gh_kpa=v, rho_gh_source="manual", rho_gh_at=time.time()); changed.append("rho_gh")
            if d.get("dp_a") not in (None, "") or d.get("dp_b") not in (None, ""):
                a = float(d["dp_a"]) if d.get("dp_a") not in (None, "") else hfm_state["dp_a"]
                b = float(d["dp_b"]) if d.get("dp_b") not in (None, "") else hfm_state["dp_b"]
                if a < 0 or b < 0 or (a == 0 and b == 0):
                    raise ValueError("ΔP–Q 係數必須 ≥ 0 且不能同時為 0")
                hfm_state.update(dp_a=a, dp_b=b, dp_source="manual", dp_at=time.time()); changed.append("dp_q")
            if "q_perm_mlmin" in d:
                q = d["q_perm_mlmin"]
                if q in (None, ""):
                    hfm_state.update(q_perm_mlmin=None, q_perm_source=None)
                else:
                    q = float(q)
                    if not (0 < q < 100):
                        raise ValueError("Q_perm 必須在 0–100 mL/min")
                    hfm_state.update(q_perm_mlmin=q, q_perm_source="manual")
                changed.append("q_perm")
            if "q_l_manual" in d:                    # v4.7
                q = d["q_l_manual"]
                if q in (None, ""):
                    hfm_state.update(q_l_manual=None)
                else:
                    q = float(q)
                    if not (0 < q <= MAX_FLOW_MLMIN):
                        raise ValueError(f"手動 Q_L 必須在 0–{MAX_FLOW_MLMIN} mL/min")
                    hfm_state.update(q_l_manual=q)
                changed.append("q_l_manual")
            if d.get("q_l_mode") not in (None, ""):
                if d["q_l_mode"] not in ("meter", "manual"):
                    raise ValueError("q_l_mode 只能是 meter 或 manual")
                if d["q_l_mode"] == "manual" and not hfm_state.get("q_l_manual"):
                    raise ValueError("請先填手動 Q_L")
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
    print(f"[hfm] 設定更新: {', '.join(changed) or '(無)'}")
    push_hfm_state(None, ok=True, action=act)


def handle_hfm_dp_baseline_from_now(client, data):
    """以目前狀態設為基準: 等比例縮放 ΔP–Q 曲線, 讓現在的 ΔP_friction 比值 = 1。"""
    h = dict(_last_derived)
    with _hfm_lock:
        a, b = hfm_state["dp_a"], hfm_state["dp_b"]
    q, dpf = h.get("q_l_mlmin"), h.get("dp_friction_kpa")
    if q is None or q < HFM["q_min_for_ratio_mlmin"] or dpf is None or dpf <= 0:
        push_hfm_state(client, ok=False, action="dp_from_now",
                       error=f"需要幫浦運轉（Q_L ≥ {HFM['q_min_for_ratio_mlmin']:.0f} mL/min）且 ΔP_friction > 0")
        return
    base = a * q + b * q * q
    if base <= 0:
        a, b, base = 1.0, 0.0, q
    f = dpf / base
    with _hfm_lock:
        hfm_state.update(dp_a=a * f, dp_b=b * f, dp_source="measured", dp_at=time.time())
    _hfm_save()
    print(f"[hfm] ΔP–Q 基準以目前狀態校正: Q={q} mL/min, ΔP_friction={dpf} kPa, 縮放 ×{f:.3f}")
    push_hfm_state(None, ok=True, action="dp_from_now")


# ---- §9 開機自檢: 停泵量重力 offset ρgh(同時驗證導壓管) ----
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

    # 1) 停泵後等 settle 秒
    while time.monotonic() - t0 < settle:
        if _selftest["state"] == "cancel":
            return _selftest_push("idle", "已取消")
        if pump_running():
            return _selftest_push("failed", "自檢期間幫浦被啟動，已中止")
        _selftest_push("settling", f"等待流動衰減 {settle - (time.monotonic()-t0):.0f} s",
                       progress=(time.monotonic() - t0) / (settle + rec) * 100)
        time.sleep(1.0)
    # 2) 記錄; 3) 判斷平台: 最近 rec 秒的 ΔP 斜率要夠小, 否則繼續等(最多 tmax)
    _selftest_samples = []
    _selftest.update(state="recording")
    t_rec = time.monotonic()
    while True:
        time.sleep(1.0)
        now = time.monotonic()
        if _selftest["state"] == "cancel":
            return _selftest_push("idle", "已取消")
        if pump_running():
            return _selftest_push("failed", "自檢期間幫浦被啟動，已中止")
        win = [s for s in _selftest_samples if now - s[0] <= rec]
        elapsed = now - t_rec
        if elapsed < rec:
            _selftest_push("recording", f"記錄中 {elapsed:.0f}/{rec:.0f} s",
                           progress=(settle + elapsed) / (settle + rec) * 100)
            continue
        if len(win) < 10:
            return _selftest_push("failed", "收不到壓力資料（MCU 沒在送？）")
        pts = [(s[0] / 60.0, (s[1] - s[2]) * 100.0) for s in win]       # (min, kPa)
        slope, _, _ = linreg(pts)
        plateau = abs(slope) <= HFM["selftest_plateau_kpa_per_min"]
        if not plateau and now - t0 < tmax:
            _selftest_push("recording", f"讀數仍在移動（{slope:+.2f} kPa/min），繼續等待平台…",
                           progress=min(99.0, (now - t0) / tmax * 100))
            continue
        rho = sum(p[1] for p in pts) / len(pts)
        ps = sum(s[3] for s in win) / len(win) * 100.0
        with _hfm_lock:
            prev = hfm_state["rho_gh_kpa"] if hfm_state["rho_gh_source"] == "measured" else None
        warn = []
        if not plateau:
            warn.append(f"等了 {tmax:.0f} s 仍未達穩定平台（{slope:+.2f} kPa/min），結果可信度低")
        if prev is not None and abs(rho - prev) > max(0.3, abs(prev) * HFM["selftest_diff_warn_fraction"]):
            warn.append(f"與前次 {prev:.2f} kPa 差異超過 {HFM['selftest_diff_warn_fraction']*100:.0f}%："
                        "請檢查導壓管氣泡 / 變送器零點")
        if abs(ps) > 1.0:
            warn.append(f"P_s = {ps:.2f} kPa，未接近 0（收集瓶應通大氣）：檢查零點或排液管")
        with _hfm_lock:
            hfm_state.update(rho_gh_kpa=round(rho, 3), rho_gh_source="measured", rho_gh_at=time.time(),
                             ps_ref_kpa=round(ps, 3))
        _hfm_save()
        result = {"rho_gh_kpa": round(rho, 3), "ps_kpa": round(ps, 3), "slope_kpa_per_min": round(slope, 3),
                  "n": len(win), "prev_kpa": prev, "warnings": warn, "at": time.time()}
        print(f"[hfm] 自檢完成: ρgh = {rho:.3f} kPa, P_s = {ps:.3f} kPa, 斜率 {slope:+.3f} kPa/min"
              + (" | " + "; ".join(warn) if warn else ""))
        return _selftest_push("done", "完成" if not warn else "完成（有警告）", progress=100.0, result=result)


def handle_hfm_selftest_start(client, data):
    if _selftest["state"] in ("settling", "recording"):
        push_hfm_state(client, ok=False, error="自檢已在進行中", action="selftest")
        return
    with _pump_lock:
        running = (pump_state.get("pwm") or 0) > 0
    if running:
        push_hfm_state(client, ok=False, error="請先停止幫浦（PWM = 0）再做自檢", action="selftest")
        return
    _selftest.update(state="settling", progress=0.0, message="開始", result=None)

    def _bg():
        try:
            _selftest_run()
        except Exception:
            print(f"[hfm] 自檢失敗:\n{traceback.format_exc()}")
            _selftest_push("failed", "程式錯誤，請看 Python log")
    threading.Thread(target=_bg, daemon=True).start()
    push_hfm_state(None, action="selftest")


def handle_hfm_selftest_cancel(client, data):
    if _selftest["state"] in ("settling", "recording"):
        _selftest["state"] = "cancel"


# ---- v4.6: ΔP–Q 掃描(多個流速 → 擬合 ΔP_friction = a·Q + b·Q²) ----
# 依序把幫浦設成使用者給的 PWM(預設由大到小, 可選由小到大), 每一點先等 settle 秒穩定, 再記錄 measure 秒:
#   ΔP_friction = (P_in − P_out) − ρgh   (5 Hz 壓力快照的 mean_raw)
#   Q           = 流量計(1 Hz)
# 全部跑完後恢復掃描前的 PWM, 用最小平方法擬合(過原點):二次 a·Q + b·Q² 與線性 a·Q。
# 結果要按「套用」才寫入 dp_a / dp_b, 量測點與擬合一起存檔、可輸出/輸入。
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
    """points: [{q, dpf}, ...]。回傳二次(過原點)與線性(過原點)擬合、R² 與建議模型。"""
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
    # 建議: 二次項為負(物理上不合理, 多半是雜訊)或點數不足 → 線性
    rec = "quadratic" if (quad and quad["b"] >= 0 and quad["a"] > 0) else "linear"
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
            return "已取消"
        with _pump_lock:
            cur = pump_state.get("pwm")
        if cur != target:
            nonlocal_flags["override"] = True       # 使用者手動改了幫浦(含緊急停止): 不要再把幫浦開回去
            return f"掃描期間 PWM 被改成 {cur}，已中止（保留目前的 PWM）"
        return None

    try:
        for i, pwm in enumerate(pwms):
            _dpq["step"] = i + 1
            if not _dpq_set_pwm(pwm):
                return _dpq_push("failed", f"送出 PWM {pwm} 失敗（MCU 沒回應）")
            t0 = time.monotonic()
            while time.monotonic() - t0 < settle:
                why = aborted(pwm)
                if why:
                    return _dpq_push("failed" if "中止" in why else "idle", why)
                _dpq_push("running", f"第 {i+1}/{len(pwms)} 點 PWM {pwm}：等待穩定 "
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
                    return _dpq_push("failed" if "中止" in why else "idle", why)
                qs.append(float(latest_flow.get("flow") or 0.0))
                _dpq_push("running", f"第 {i+1}/{len(pwms)} 點 PWM {pwm}：記錄中 "
                          f"{time.monotonic()-t1:.0f}/{measure:.0f} s", elapsed_pct())
                time.sleep(1.0)
            _dpq_recording = False
            dps = [v for _, v in _dpq_samples]
            q_m, q_sd = _mean_sd(qs)
            dp_m, dp_sd = _mean_sd(dps)
            warn = []
            if not dps:
                warn.append("沒有壓力資料")
            if q_m is None or q_m <= 0:
                warn.append("流量為 0（幫浦沒轉或流量計沒訊號）")
            elif q_sd is not None and q_sd / q_m > 0.15:
                warn.append(f"流量不穩（CV {q_sd/q_m*100:.0f}%）")
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
            return _dpq_push("failed", "有效點數不足（至少 2 點有流量與壓力）")
        fit.update(rho_gh_kpa=rho, settle_s=settle, measure_s=measure)
        _dpq["fit"] = fit
        _dpq["at"] = time.time()
        rec = fit[fit["recommended"]]
        print(f"[dpq] 擬合完成({fit['recommended']}): a={rec['a']:.6g}, b={rec['b']:.6g}, R²={rec['r2']}")
        return _dpq_push("done", "完成：請檢查結果後按「套用」", 100.0)
    finally:
        _dpq_recording = False
        if _dpq["state"] in ("running", "cancel"):
            _dpq["state"] = "idle"
        if not nonlocal_flags["override"]:
            try:
                _dpq_set_pwm(restore_pwm)
                print(f"[dpq] 已恢復掃描前的 PWM {restore_pwm}")
            except Exception:
                pass


def handle_dpq_start(client, data):
    d = data or {}
    if _dpq["state"] in ("running", "cancel"):
        return push_dpq_state(client, ok=False, error="掃描已在進行中")
    if _selftest["state"] in ("settling", "recording"):
        return push_dpq_state(client, ok=False, error="ρgh 自檢進行中，請等它完成")
    try:
        pwms = [int(round(float(x))) for x in (d.get("pwms") or [])]
        settle = float(d.get("settle_s", 20)); measure = float(d.get("measure_s", 30))
    except (TypeError, ValueError):
        return push_dpq_state(client, ok=False, error="參數格式錯誤")
    order = d.get("order", "desc")
    if order not in ("asc", "desc"):
        order = "desc"
    # v4.7.2: 預設由高到低 —— 低 PWM 從靜止起動容易不穩; 先跑高 PWM, 之後一路降速, 幫浦一直在轉
    pwms = sorted(set(p for p in pwms if 1 <= p <= 255), reverse=(order == "desc"))
    if len(pwms) < 2 or len(pwms) > DPQ_LIMITS["max_points"]:
        return push_dpq_state(client, ok=False, error=f"PWM 點數需 2–{DPQ_LIMITS['max_points']} 個（1–255）")
    lo, hi = DPQ_LIMITS["settle_s"]
    if not lo <= settle <= hi:
        return push_dpq_state(client, ok=False, error=f"穩定時間需 {lo}–{hi} s")
    lo, hi = DPQ_LIMITS["measure_s"]
    if not lo <= measure <= hi:
        return push_dpq_state(client, ok=False, error=f"記錄時間需 {lo}–{hi} s")
    with _pump_lock:
        restore = int(pump_state.get("pwm") or 0)
    _dpq.update(state="running", message="開始", progress=0.0, step=0, total=len(pwms), points=[], fit=None,
                config={"pwms": pwms, "order": order, "settle_s": settle, "measure_s": measure, "restore_pwm": restore},
                at=None)
    print(f"[dpq] 開始 ΔP–Q 掃描: PWM {pwms}, 穩定 {settle:.0f} s, 記錄 {measure:.0f} s, 結束後恢復 PWM {restore}")

    def _bg():
        try:
            _dpq_run(pwms, settle, measure, restore)
        except Exception:
            print(f"[dpq] 掃描失敗:\n{traceback.format_exc()}")
            _dpq_push("failed", "程式錯誤，請看 Python log")
    threading.Thread(target=_bg, daemon=True).start()
    push_dpq_state()


def handle_dpq_cancel(client, data):
    if _dpq["state"] == "running":
        _dpq["state"] = "cancel"


def handle_dpq_apply(client, data):
    model = (data or {}).get("model") or (_dpq.get("fit") or {}).get("recommended")
    fit = _dpq.get("fit")
    if not fit or model not in ("linear", "quadratic") or not fit.get(model):
        return push_dpq_state(client, ok=False, error="沒有可套用的擬合結果")
    m = fit[model]
    if not (m["a"] > 0):
        return push_dpq_state(client, ok=False, error="擬合的 a ≤ 0，不合理，請檢查量測點")
    with _hfm_lock:
        hfm_state.update(dp_a=float(m["a"]), dp_b=float(m["b"]), dp_source="measured", dp_at=time.time(),
                         dp_points=list(_dpq["points"]),
                         dp_fit=dict(fit, model=model, applied_at=time.time()))
    _hfm_save()
    print(f"[dpq] 已套用 {model}: a={m['a']:.6g}, b={m['b']:.6g}")
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


# ============================= 校正值匯出 / 匯入 (v4.1) =============================
CALIB_EXPORT_FORMAT = "hfm-bioreactor-calibration"
CALIB_EXPORT_VERSION = 1
_HFM_EXPORT_KEYS = ("rho_gh_kpa", "rho_gh_source", "rho_gh_at", "ps_ref_kpa", "dp_a", "dp_b", "dp_source",
                    "dp_at", "q_perm_mlmin", "lp_initial", "lp_initial_at", "dp_points", "dp_fit",
                    "q_l_mode", "q_l_manual")


def build_calibration_bundle():
    live = read_mcu_calibration()            # MCU 目前「實際生效」的值; 讀不到就用存檔
    with _calib_lock:
        saved = {k: dict(v) for k, v in calibration_saved.items()}
    mcu = {}
    for item in ("od600_blank", "pressure_offsets", "od600_path_length_factor"):
        v = live.get(item) or saved.get(item)
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
    }


def handle_calib_export(client, data):
    try:
        bundle = build_calibration_bundle()
    except Exception as e:
        ui.send_message("calib_export_data", {"ok": False, "error": str(e)}, client)
        return
    fn = "calibration_" + time.strftime("%Y%m%d_%H%M%S") + ".json"
    print(f"[calib] 匯出校正值 -> {fn}")
    ui.send_message("calib_export_data", {"ok": True, "filename": fn, "bundle": bundle}, client)


def handle_calib_import(client, data):
    """data = {bundle: {...}, sections: [...]}。sections 為要套用的區段; 沒給就全部。"""
    d = data or {}
    b = d.get("bundle") or {}
    if b.get("format") != CALIB_EXPORT_FORMAT:
        ui.send_message("calib_import_result", {"ok": False, "error": "不是本系統匯出的校正檔（format 不符）"}, client)
        return
    want = set(d.get("sections") or ("mcu_calibration", "ph_config", "hfm", "specs", "valve_config", "pump_kick"))
    done, failed = [], []

    if "specs" in want and isinstance(b.get("specs"), dict):
        vals, errs = _spec_validate(b["specs"])
        if errs:
            failed.append("specs: " + "；".join(errs))
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
            failed.append(f"mcu_calibration: 格式錯誤 {e}")
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

    print(f"[calib] 匯入校正檔: 成功 {done}, 失敗 {failed}")
    ui.send_message("calib_import_result", {"ok": not failed, "done": done, "failed": failed}, client)
    push_calibration_state()


ui.on_message("calib_export", handle_calib_export)
ui.on_message("calib_import", handle_calib_import)

# ============================= 衍生參數計算 (規格書 §3) =============================
# 只使用目前硬體實際「有」的訊號: p_in(feed)、p_out(retentate)、p_perm(permeate)、q_feed。
# 沒有滲透流量計、沒有溫度感測器, 所以 flux/conversion/S/tmp_corrected/溫度校正 不計算。

def compute_derived(p_in_bar, p_out_bar, p_perm_bar, q_feed_mlmin):
    delta_p = p_in_bar - p_out_bar
    tmp = (p_in_bar + p_out_bar) / 2.0 - p_perm_bar

    delta_p_blank = BLANK_SLOPE * q_feed_mlmin + BLANK_INTERCEPT
    delta_p_net = delta_p - delta_p_blank

    R = (delta_p_net / q_feed_mlmin) if q_feed_mlmin > 1e-6 else None

    if q_feed_mlmin > 1e-6:
        q_fiber_m3s = (q_feed_mlmin / N_EFF_NOMINAL) / 60e6  # mL/min -> m^3/s
        shear_rate = 4 * q_fiber_m3s / (math.pi * _FIBER_R_M ** 3)
    else:
        shear_rate = 0.0

    shear_stress = delta_p_net * 1e5 * _FIBER_R_M / (2 * FIBER_LENGTH_M)  # Pa

    tmp_uniformity = (delta_p_net / tmp) if abs(tmp) > 1e-6 else None

    # 單點反推, 不確定度很大(規格書§3.7), 僅供即時參考, 正式標定仍須用掃描迴歸
    n_eff_from_dp = (FIBER_COUNT * _THEORY_SLOPE_REF / R) if (R is not None and R > 1e-9) else None

    return {
        "delta_p_bar": round(delta_p, 5),
        "tmp_bar": round(tmp, 5),
        "delta_p_blank_bar": round(delta_p_blank, 5),
        "delta_p_net_bar": round(delta_p_net, 5),
        "R_bar_per_mlmin": round(R, 6) if R is not None else None,
        "shear_rate_s1": round(shear_rate, 1),
        "shear_stress_pa": round(shear_stress, 3),
        "tmp_uniformity": round(tmp_uniformity, 3) if tmp_uniformity is not None else None,
        "n_eff_from_dp": round(n_eff_from_dp, 2) if n_eff_from_dp is not None else None,
    }


def linreg(points):
    """points: [(x, y), ...]。回傳 (slope, intercept, resid_sd)。點數<2回傳(None,None,None)。"""
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
_tmp_buf = deque()     # (monotonic_t, bar)  用於 dTMP/dt
_dtdt_buf = deque()    # (monotonic_t, bar/min) 用於 d²TMP/dt²
_R_buf = deque()       # (monotonic_t, R) 用於 dR/dt

_steady_since = None   # 連續達到穩態的起始時間(monotonic), None代表目前非穩態


def _trim(buf, now, keep_s):
    while buf and now - buf[0][0] > keep_s:
        buf.popleft()


# ============================= v3.7 演算法切換 =============================
# 依《訊號處理演算法檢討報告》第 2 節, 把報告建議的備用演算法做成可切換。
# 預設值全部是「現行(legacy)」, 不切換就跟以前完全一樣; 每一列 CSV 都會記錄當時用的
# 演算法組合(alg_profile 欄), 事後分析可以分得清楚。
#
#   flow             gate(現行 1 秒閘門計數) | reciprocal(C-1 倒數計數)          ← MCU
#   od_estimator     mad(E-1 現行) | qn(E-2) | biweight(E-5) | upper(E-3 單邊)   ← MCU
#   analysis_source  ema(現行: 衍生參數/穩態/趨勢/聚合吃 EMA 後的壓力)
#                    | raw(F-1: 分析路徑改吃 mean_raw, EMA 只留給畫面)
#   steady           legacy(固定斜率+殘差 SD 門檻) | ci(H-1 斜率信賴區間 + H-3 M-of-N 遲滯)
#   curvature        legacy(對 dTMP/dt 序列再迴歸) | quadfit(H-8 對 TMP 直接擬合二次式, 取 2a)
#   聚合方式(取樣設定面板): median | mean | trimmed10(G-2) | hodges_lehmann(G-3)
ALG_OPTIONS = {
    "flow": ("gate", "reciprocal"),
    "od_estimator": ("mad", "qn", "biweight", "upper"),
    "analysis_source": ("ema", "raw"),
    "steady": ("legacy", "ci"),
    "curvature": ("legacy", "quadfit"),
}
ALG_MCU_KEYS = {"flow": "flow", "od_estimator": "od"}     # Python 名稱 -> MCU set_algorithms 的 key
_ALG_CONST = CONST.get("algorithms", {}) or {}
alg_settings = {k: (_ALG_CONST.get(k) if _ALG_CONST.get(k) in v else v[0]) for k, v in ALG_OPTIONS.items()}
_alg_lock = threading.Lock()

STEADY_CI_T = float(_ALG_CONST.get("steady_ci_t", 0))      # 0 = 依自由度自動取 t(0.975)
STEADY_MOFN_M = int(_ALG_CONST.get("steady_m_of_n_m", 8))
STEADY_MOFN_N = int(_ALG_CONST.get("steady_m_of_n_n", 10))
# ci 模式的門檻與視窗: 報告 B.3 指出 60 秒視窗、殘差 3 mbar 時斜率本身的標準誤就有 1.34e-3 bar/min,
# 比現行門檻 1e-3 還大 —— 用信賴區間判定時, 門檻必須明顯大於 t·SE 才有意義。
# 視窗拉長到 120 秒時 SE 約降為 1/2.8(SE ∝ n^-1.5), 門檻 0.002 bar/min 才判得出來。
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


def push_alg_to_mcu(settings=None):
    """把 MCU 端的兩個演算法選擇推給 MCU。回傳 (ok, error)。"""
    with _alg_lock:
        a = dict(settings or alg_settings)
    arg = ",".join(f"{ALG_MCU_KEYS[k]}={ALG_OPTIONS[k].index(a[k])}" for k in ALG_MCU_KEYS)
    try:
        resp = Bridge.call("set_algorithms", arg)
    except Exception as e:
        return False, str(e)
    if _rejected(resp):
        return False, _reject_reason(resp)
    return True, None


def handle_get_algorithms(client, data):
    push_alg_settings(client)


def handle_set_algorithms(client, data):
    data = data or {}
    new = {}
    for k, opts in ALG_OPTIONS.items():
        if k in data and data[k] not in (None, ""):
            if data[k] not in opts:
                push_alg_settings(client, ok=False, error=f"{k} 必須是 {'/'.join(opts)}")
                return
            new[k] = data[k]
    if not new:
        push_alg_settings(client)
        return
    with _alg_lock:
        merged = dict(alg_settings, **new)
    if any(k in new for k in ALG_MCU_KEYS):
        ok, err = push_alg_to_mcu(merged)
        if not ok:
            push_alg_settings(client, ok=False, error=f"MCU 拒絕/沒回應: {err}")
            return
    with _alg_lock:
        changed_steady = new.get("steady") not in (None, alg_settings["steady"])
        alg_settings.update(new)
    if changed_steady or "analysis_source" in new:
        _reset_analysis_buffers()      # 判定邏輯或資料來源換了, 舊的累積不能混用
    _pv_save("algorithms", dict(alg_settings))
    print(f"[alg] {alg_profile_string()}")
    push_alg_settings()


ui.on_message("get_algorithms", handle_get_algorithms)
ui.on_message("set_algorithms", handle_set_algorithms)


def _t975(df):
    """Student t 的 0.975 分位數(雙尾 95%)近似, 不引進 scipy。"""
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
    """回傳 (slope, se_slope, n)。SE 用 n−2 自由度的殘差標準差(報告 B.3)。"""
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
    """H-8: 對 (t, y) 直接擬合 y = a·t² + b·t + c, 回傳 2a(單位: y/s²)。點數 < 5 回傳 None。"""
    n = len(points)
    if n < 5:
        return None
    t0 = points[0][0]
    ts = [p[0] - t0 for p in points]
    mt = sum(ts) / n
    ts = [t - mt for t in ts]              # 置中, 改善數值條件
    ys = [p[1] for p in points]
    s0 = n
    s1 = sum(ts)
    s2 = sum(t * t for t in ts)
    s3 = sum(t ** 3 for t in ts)
    s4 = sum(t ** 4 for t in ts)
    sy = sum(ys)
    sty = sum(t * y for t, y in zip(ts, ys))
    st2y = sum(t * t * y for t, y in zip(ts, ys))
    # 正規方程 [[s4 s3 s2],[s3 s2 s1],[s2 s1 s0]] · [a b c] = [st2y sty sy], 用 Cramer 法則
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
    """規格書§5.2: P_in、P_out、Q 同時滿足斜率與殘差門檻才算穩態。"""
    global _steady_since
    with _buf_lock:
        _p_in_buf.append((now, p_in_bar))
        _p_out_buf.append((now, p_out_bar))
        _q_buf.append((now, q_feed))
        keep = max(STEADY_WINDOW_S, STEADY_CI_WINDOW_S)     # v3.7: 兩種判定共用緩衝, 保留較長的那個
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
    """H-1 + H-3: 斜率的 95% 信賴區間 |slope| + t·SE 必須落在門檻內(三個訊號同時),
    再用 M-of-N 遲滯(最近 N 次評估中至少 M 次通過)避免單一異常點重設計時器。"""
    global _steady_since
    res = {}
    ok_all = True
    for name, pts, thr in (("p_in", p_in_pts, STEADY_CI_SLOPE_THRESH),
                           ("p_out", p_out_pts, STEADY_CI_SLOPE_THRESH),
                           ("q", q_pts, STEADY_CI_FLOW_THRESH)):
        slope, se, n = linreg_se(pts)
        if slope is None:
            return {"steady": False, "steady_duration_s": 0, "detail": None}
        bound = (abs(slope) + _t975(n - 2) * se) * 60          # 每分鐘
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
    res["m_of_n"] = f"{passed}/{len(_steady_hist)} (需 {STEADY_MOFN_M}/{STEADY_MOFN_N})"
    return {
        "steady": steady,
        "steady_duration_s": round((now - _steady_since) if _steady_since is not None else 0, 1),
        "detail": res,
        "method": "ci",
    }


def update_trend(now, tmp_bar, R_value):
    """dTMP/dt(bar/min, 階段內迴歸)、二階導數 d²TMP/dt², 以及 dR/dt。"""
    with _buf_lock:
        _tmp_buf.append((now, tmp_bar))
        _trim(_tmp_buf, now, D2_WINDOW_S)
        recent = [(t, v) for t, v in _tmp_buf if now - t <= TREND_WINDOW_S]
    slope, _, _ = linreg(recent)
    dtmp_dt = slope * 60 if slope is not None else None  # bar/min

    d2tmp_dt2 = None
    if alg_settings["curvature"] == "quadfit":
        # H-8: 對 D2_WINDOW_S 內的 TMP 直接擬合二次式; 2a 單位 bar/s² → (bar/min)/min 乘 3600
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


# ---- 基準線 (供 R / ΔP 相對告警使用) ----
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
    """手動輸入基準值。可以只給其中幾項, 沒給的欄位維持原值不變。"""
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


def compute_alerts(derived, trend, baseline_snapshot, tmp_peak_trough=None):
    """規格書§7.3。R/ΔP 相對告警需要先設定基準線, 沒有基準線就略過那幾條。
    tmp_peak_trough: 額外檢查每個脈動週期的TMP瞬時峰值/谷值(不是mean_filtered),
    用來偵測 mean 看起來還正常、但瞬間已超過 collapse pressure 上限或轉負的情形。
    這裡只做偵測+廣播告警(規格書§6: 尚未接自動降速/停機的保護動作)。"""
    alerts = []
    tmp = derived.get("tmp_bar")
    R = derived.get("R_bar_per_mlmin")
    delta_p = derived.get("delta_p_bar")
    shear_rate = derived.get("shear_rate_s1")
    dtmp_dt = trend.get("dtmp_dt_bar_per_min")
    d2tmp_dt2 = trend.get("d2tmp_dt2")

    if tmp is not None and tmp > THRESH.get("tmp_critical_bar", 0.5):
        alerts.append({"level": "critical", "code": "tmp_critical",
                       "message": f"TMP {tmp:.3f} bar 超過絕對上限 {THRESH.get('tmp_critical_bar', 0.5)} bar"})
    elif tmp is not None and tmp > THRESH.get("tmp_warning_bar", 0.4):
        alerts.append({"level": "warning", "code": "tmp_warning", "message": f"TMP {tmp:.3f} bar 偏高"})

    if tmp_peak_trough is not None:
        tmp_peak = tmp_peak_trough.get("peak")
        tmp_trough = tmp_peak_trough.get("trough")
        if tmp_peak is not None and tmp_peak > THRESH.get("tmp_critical_bar", 0.5):
            alerts.append({"level": "critical", "code": "tmp_peak_critical",
                           "message": f"TMP瞬時峰值 {tmp_peak:.3f} bar 超過絕對上限, 疑似collapse pressure風險"})
        trough_thresh = THRESH.get("tmp_trough_negative_bar", -0.02)
        if tmp_trough is not None and tmp_trough < trough_thresh:
            alerts.append({"level": "warning", "code": "tmp_trough_negative",
                           "message": f"TMP瞬時谷值 {tmp_trough:.3f} bar 低於 {trough_thresh} bar, 疑似脈動期間曾經轉負"})

    base_dp = baseline_snapshot.get("delta_p_bar")
    if base_dp and delta_p is not None:
        factor = THRESH.get("delta_p_critical_factor_over_baseline", 2.5)
        if delta_p > factor * base_dp:
            alerts.append({"level": "critical", "code": "delta_p_severe_fouling",
                           "message": f"ΔP 超過基準線 {factor} 倍, 嚴重堵塞疑慮"})

    base_R = baseline_snapshot.get("R_bar_per_mlmin")
    if base_R and R is not None:
        factor = THRESH.get("R_warning_factor_over_baseline", 2.0)
        if R > factor * base_R:
            alerts.append({"level": "warning", "code": "R_high",
                           "message": f"水力阻力 R 超過基準線 {factor} 倍, 建議安排清洗"})

    if shear_rate is not None and shear_rate > THRESH.get("shear_rate_warning_s1", 6000):
        alerts.append({"level": "warning", "code": "shear_rate_high",
                       "message": f"剪切率 {shear_rate:.0f} s⁻¹ 超過細胞損傷風險閾值"})

    if dtmp_dt is not None:
        if dtmp_dt > THRESH.get("dtmp_dt_critical_bar_per_min", 0.02):
            alerts.append({"level": "critical", "code": "dtmp_dt_critical",
                           "message": f"dTMP/dt {dtmp_dt:.4f} bar/min 過高, 建議立即降階"})
        elif dtmp_dt > THRESH.get("dtmp_dt_warning_bar_per_min", 0.01):
            alerts.append({"level": "warning", "code": "dtmp_dt_warning",
                           "message": f"dTMP/dt {dtmp_dt:.4f} bar/min 偏高, 可能已接近或超過臨界通量"})

    if d2tmp_dt2 is not None and d2tmp_dt2 > 0:
        alerts.append({"level": "warning", "code": "d2tmp_positive",
                       "message": "TMP 二階導數為正, 可能是 cake 層自我加速的前兆"})

    return alerts


def derive_loop():
    """每秒用目前最新的壓力+流量, 計算衍生參數/趨勢/穩態/告警, 推播給前端。
    實際計算放在 _derive_once(), 這裡只負責節拍與「單一輪失敗不要拖垮整條迴圈」。"""
    while True:
        time.sleep(1.0)
        try:
            _derive_once()
        except Exception:
            print(f"[derive] 這一輪計算失敗, 跳過並繼續:\n{traceback.format_exc()}")


def _derive_once():
    global _last_derived, _last_trend, _last_steady
    if True:   # 保留一層縮排, 讓下面這段與原本 while 迴圈裡的程式碼完全相同
        now = time.monotonic()

        with _pressure_lock:
            if alg_settings["analysis_source"] == "raw":
                # F-1: 分析路徑吃低通濾波前的 mean_raw(EMA 只留給畫面顯示)
                ch = latest_pressure["channels"]
                pf = {"feed": ch["feed"]["mean_raw"], "retentate": ch["retentate"]["mean_raw"],
                      "permeate": ch["permeate"]["mean_raw"], "tmp": latest_pressure["tmp"]["mean_raw"]}
            else:
                pf = dict(latest_pressure["filtered"])
            tmp_peak_trough = dict(latest_pressure["tmp"])
        q_feed = latest_flow["flow"]
        with _hfm_lock:
            hst = dict(hfm_state)

        p_in_bar = pf["feed"]
        p_out_bar = pf["retentate"]
        p_perm_bar = pf["permeate"]

        derived = compute_hfm(p_in_bar, p_out_bar, p_perm_bar, q_feed, hfm_tmp_out_min_kpa(), hst)
        # L_p 初始值: 第一次算得出 L_p 時自動記下(可在介面重設)
        if derived.get("lp_lmh_bar") is not None and hst.get("lp_initial") is None:
            with _hfm_lock:
                hfm_state.update(lp_initial=derived["lp_lmh_bar"], lp_initial_at=time.time())
            _hfm_save()
            push_hfm_state()
        _last_derived = derived

        steady_info = update_steady(now, p_in_bar, p_out_bar, q_feed)
        trend = update_trend(now, derived["tmp_bar"], derived.get("dp_ratio"))
        _last_trend = trend
        _last_steady = steady_info

        with _baseline_lock:
            baseline_snapshot = dict(baseline)

        alerts = compute_hfm_alerts(derived, hst)
        # v3: 夾閥夾閉中 / 剛放開的穩定期內, 積垢趨勢類告警暫停(收樣本本來就會讓 ΔP/R 劇變)
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
        })


# ============================= 校正值的保存與還原 =============================
# 問題: OD600 的空白基準(blankRatio)、壓力三通道的零點 offset、光程長校正係數
# 全部都存在 MCU 的 RAM 裡, MCU 一重開就全部回到預設值。實驗跑到一半遇到重開機時,
# 「把流通池換回乾淨培養基重新校正空白」「整套系統洩壓重新歸零」這兩件事實務上根本
# 做不到 —— 樣品還在裡面。
#
# 作法:
#   1. 每次校正成功都把值寫到 calibration_state.json(在 Linux 側, MCU 重開不影響)。
#   2. 偵測到 MCU 重開(get_diag 回報的 uptime 突然變小, 或啟動時 MCU 明顯是乾淨狀態)
#      就自動把存檔的值推回 MCU。
#   3. 只要目前生效的值不是「真的量出來的」(而是還原的或手動輸入的), 畫面上就持續
#      顯示黃色提示, 直到重新做一次真正的校正為止。這點很重要: 還原的零點是否仍然
#      成立取決於現場狀況(溫度漂移、管路有沒有動過), 系統不該假裝那跟剛校正完一樣可信。
#   4. 也可以手動輸入(從你自己的紀錄抄回來), 一樣會被標記成「非現場校正」。
CALIBRATION_STATE_PATH = os.path.join(_SEARCH_DIR, "calibration_state.json")
_calib_lock = threading.Lock()

# 目前每一項校正值的來源: "measured"(現場量的) | "restored"(重開後自動還原) | "manual"(手動輸入)
CALIB_ITEMS = ("od600_blank", "pressure_offsets", "od600_path_length_factor", "baseline")
# 這兩項是會隨溫度/管路狀態漂移的物理零點: 只要目前生效的值不是現場量出來的, 就要提醒操作者
ATTENTION_ITEMS = ("od600_blank", "pressure_offsets")
calibration_source = {}     # item -> {"source": ..., "at": epoch}
calibration_saved = {}      # item -> 已存檔的值(dict)

_mcu_last_uptime_ms = None
_blank_calibration_requested = False   # 使用者按了「校正空白」, 等 MCU 量完才算數


def _load_calibration_file():
    try:
        with open(CALIBRATION_STATE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (FileNotFoundError, json.JSONDecodeError, OSError) as e:
        if not isinstance(e, FileNotFoundError):
            print(f"[calib] 讀取 {CALIBRATION_STATE_PATH} 失敗({e}), 當作沒有存檔")
    return {}


def _write_calibration_file():
    try:
        with open(CALIBRATION_STATE_PATH, "w", encoding="utf-8") as f:
            json.dump({"saved_at": time.time(), "items": calibration_saved}, f,
                      ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"[calib] 寫入 {CALIBRATION_STATE_PATH} 失敗: {e}")


def calib_remember(item, value, source):
    """記下某一項校正值(存檔 + 標記來源 + 廣播)。source 見 calibration_source 的說明。"""
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
    # 黃色提示橫幅只針對「零點類」的校正: 空白基準與壓力零點是會隨溫度、管路狀態漂移的
    # 物理零點, 用還原/手動輸入的值就必須提醒操作者確認。光程長係數與 R/ΔP/TMP 基準線
    # 則是幾何常數與參考值, 還原它們本來就是正確行為, 拿去洗版只會讓真正重要的提示被忽略。
    needs_attention = [k for k, v in source.items()
                       if k in ATTENTION_ITEMS and v.get("source") in ("restored", "manual")]
    ui.send_message("calibration_state", {
        "saved": saved,
        "source": source,
        "needs_attention": needs_attention,
        "state_file": CALIBRATION_STATE_PATH,
    }, client)


def read_mcu_calibration():
    """讀回 MCU 目前實際生效的校正值。讀不到的項目回傳 None。"""
    out = {"od600_blank": None, "pressure_offsets": None, "od600_path_length_factor": None}
    try:
        parts = Bridge.call("get_blank_info", "").split(",")
        if bool(int(float(parts[0]))):
            out["od600_blank"] = {
                "ratio": round(float(parts[3]), 6),
                "lux_sample": round(float(parts[1]), 2),
                "lux_ref": round(float(parts[2]), 2),
            }
    except Exception:
        pass
    try:
        parts = Bridge.call("get_pressure_offsets", "").split(",")
        offsets = {"feed": float(parts[0]), "retentate": float(parts[1]), "permeate": float(parts[2])}
        out["pressure_offsets"] = offsets
    except Exception:
        pass
    try:
        out["od600_path_length_factor"] = {"value": float(Bridge.call("get_path_length_factor", ""))}
    except Exception:
        pass
    return out


def _offsets_look_unset(offsets):
    """MCU 剛開機時三個 offset 都是 0。歸零校正後幾乎不可能剛好三個都是 0,
    所以「三個都非常接近 0」就當作還沒校正過。"""
    if not offsets:
        return True
    return all(abs(offsets.get(ch, 0.0)) < 1e-9 for ch in ("feed", "retentate", "permeate"))


def apply_saved_calibration(items=None, source="restored", client=None):
    """把存檔的校正值推回 MCU。items=None 代表全部。回傳實際套用成功的項目清單。"""
    with _calib_lock:
        saved = {k: dict(v) for k, v in calibration_saved.items()}
    targets = items or list(CALIB_ITEMS)
    applied, failed = [], []

    if "od600_blank" in targets and saved.get("od600_blank"):
        b = saved["od600_blank"]
        arg = f"{b['ratio']},{b.get('lux_sample', 0.0)},{b.get('lux_ref', 0.0)}"
        try:
            resp = Bridge.call("set_blank_manual", arg)
            (applied if str(resp).strip() != "rejected" else failed).append("od600_blank")
        except Exception as e:
            print(f"[calib] 還原 OD600 blank 失敗: {e}")
            failed.append("od600_blank")

    if "pressure_offsets" in targets and saved.get("pressure_offsets"):
        o = saved["pressure_offsets"]
        arg = f"{o['feed']},{o['retentate']},{o['permeate']}"
        try:
            resp = Bridge.call("set_pressure_offsets", arg)
            if str(resp).strip() != "rejected":
                applied.append("pressure_offsets")
                for ch in PRESSURE_CHANNELS:
                    _mean_filtered_state[ch] = None   # offset 換了, 濾波器要重來
            else:
                failed.append("pressure_offsets")
        except Exception as e:
            print(f"[calib] 還原壓力 offset 失敗: {e}")
            failed.append("pressure_offsets")

    if "od600_path_length_factor" in targets and saved.get("od600_path_length_factor"):
        try:
            resp = Bridge.call("set_path_length_factor", str(saved["od600_path_length_factor"]["value"]))
            (applied if str(resp).strip() != "rejected" else failed).append("od600_path_length_factor")
        except Exception as e:
            print(f"[calib] 還原光程長係數失敗: {e}")
            failed.append("od600_path_length_factor")

    if "baseline" in targets and saved.get("baseline"):
        b = saved["baseline"]
        with _baseline_lock:
            for key in ("R_bar_per_mlmin", "delta_p_bar", "tmp_bar"):
                if b.get(key) is not None:
                    baseline[key] = b[key]
            baseline["captured_at"] = time.time()
            baseline["source"] = source
            snap = dict(baseline)
        ui.send_message("baseline_captured", snap)
        applied.append("baseline")

    if applied:
        with _calib_lock:
            for item in applied:
                calibration_source[item] = {"source": source, "at": time.time()}
        print(f"[calib] 已{('自動還原' if source == 'restored' else '套用')}校正值: {', '.join(applied)}")
        refresh_blank_info()
    if failed:
        print(f"[calib] 下列項目套用失敗: {', '.join(failed)}")

    push_calibration_state(client)
    ui.send_message("calibration_applied", {
        "ok": bool(applied) and not failed,
        "applied": applied, "failed": failed, "source": source,
    }, client)
    return applied


def sync_calibration_from_mcu(mark_measured=False):
    """把 MCU 目前生效的校正值抓回來存檔。
    mark_measured=True 代表這是剛剛真的量出來的(現場校正), 會把「非現場校正」的標記清掉。"""
    mcu = read_mcu_calibration()
    for item in ("od600_blank", "pressure_offsets", "od600_path_length_factor"):
        value = mcu.get(item)
        if value is None:
            continue
        if item == "pressure_offsets" and _offsets_look_unset(value):
            continue   # 全 0 = 還沒校正過, 沒有存的價值
        with _calib_lock:
            calibration_saved[item] = dict(value, saved_at=time.time())
            if mark_measured:
                calibration_source[item] = {"source": "measured", "at": time.time()}
            elif item not in calibration_source:
                calibration_source[item] = {"source": "measured", "at": time.time()}
            _write_calibration_file()
    push_calibration_state()


def check_mcu_reboot(uptime_ms):
    """get_diag 回報的 uptime 變小 = MCU 重開過了 → 自動把存檔的校正值推回去。"""
    global _mcu_last_uptime_ms
    prev = _mcu_last_uptime_ms
    _mcu_last_uptime_ms = uptime_ms
    if prev is None or uptime_ms >= prev:
        return
    print(f"[calib] 偵測到 MCU 重新開機(uptime {prev} → {uptime_ms} ms), 嘗試還原存檔的校正值...")
    with _calib_lock:
        has_saved = bool(calibration_saved)
    if has_saved:
        apply_saved_calibration(source="restored")
    else:
        print("[calib] 沒有任何存檔的校正值可以還原, 請重新校正")
    # v3: pH 校正點、夾閥設定也一起推回去
    try:
        restore_ph_valve_state(reason="restored")
    except Exception as e:
        print(f"[ph/valve] MCU 重開後還原失敗: {e}")
    pump_restored = mcu_restore_pump_after_reboot()
    mcu_reboot_times.append(time.time())
    rpc_wd_apply()
    ui.send_message("mcu_rebooted", {"ts": time.time(), "restored": has_saved, "pump_restored": pump_restored})
    push_mcu_status()


_startup_calib_done = False


def startup_calibration_sync():
    """啟動時決定「要不要把存檔的校正值推回 MCU」。

    判斷依據是 MCU 現在看起來像不像「乾淨的剛開機狀態」: 沒有 blank、而且三個壓力
    offset 都還是 0。兩個條件同時成立才算, 避免把「使用者根本還沒校正過」誤判成
    需要還原。只有 Python 重啟(MCU 還活著)時, 反過來以 MCU 為準把值抓回來存檔。

    如果這時候 Bridge 還沒通(冷開機時 Python 常常比 MCU 早就緒), 就什麼都不做並回傳
    False, 由 od600_poll_loop 稍後重試 —— 在拿不到 MCU 真實狀態的情況下亂推校正值,
    比晚幾秒再推糟糕得多。
    """
    global _startup_calib_done, _mcu_last_uptime_ms
    if _startup_calib_done:
        return True

    mcu_now = read_mcu_calibration()
    if mcu_now.get("pressure_offsets") is None:
        print("[calib] 目前讀不到 MCU 的校正狀態(Bridge 可能還沒就緒), 稍後重試")
        return False

    try:
        _mcu_last_uptime_ms = int(float(Bridge.call("get_diag", "").split(",")[4]))
    except Exception:
        _mcu_last_uptime_ms = None

    mcu_looks_fresh = (mcu_now.get("od600_blank") is None
                       and _offsets_look_unset(mcu_now.get("pressure_offsets")))

    if mcu_looks_fresh and calibration_saved:
        print("[calib] MCU 目前是未校正狀態, 但本機有存檔的校正值 → 自動還原")
        apply_saved_calibration(source="restored")
    else:
        sync_calibration_from_mcu()   # MCU 上的值還在, 以 MCU 為準
        if calibration_saved.get("baseline"):
            # baseline 存在 Python 記憶體, Python 一重啟就沒了, 一律從存檔還原
            apply_saved_calibration(items=["baseline"], source="restored")

    _startup_calib_done = True
    return True


# ---- 手動輸入 ----
def handle_set_manual_blank(client, data):
    """手動指定 OD600 空白基準。可以直接給 ratio, 也可以給 sample/reference 兩個 lux
    讓系統自己算比值(比值 = sample / reference, 與 calibrate_blank 的定義相同)。"""
    data = data or {}
    ratio = data.get("ratio")
    lux_sample = data.get("lux_sample")
    lux_ref = data.get("lux_ref")

    try:
        lux_sample = float(lux_sample) if lux_sample not in (None, "") else None
        lux_ref = float(lux_ref) if lux_ref not in (None, "") else None
        ratio = float(ratio) if ratio not in (None, "") else None
    except (TypeError, ValueError):
        ui.send_message("calibration_applied",
                        {"ok": False, "error": "數值格式錯誤", "applied": [], "failed": ["od600_blank"]}, client)
        return

    if ratio is None and lux_sample is not None and lux_ref is not None and lux_ref > 1e-9:
        ratio = lux_sample / lux_ref
    if ratio is None or ratio <= 0:
        ui.send_message("calibration_applied", {
            "ok": False, "applied": [], "failed": ["od600_blank"],
            "error": "請填 blank ratio, 或同時填 sample 與 reference 兩個 lux 值(reference 不能為 0)",
        }, client)
        return

    arg = f"{ratio},{lux_sample if lux_sample is not None else 0.0},{lux_ref if lux_ref is not None else 0.0}"
    try:
        resp = Bridge.call("set_blank_manual", arg)
    except Exception as e:
        ui.send_message("calibration_applied",
                        {"ok": False, "error": str(e), "applied": [], "failed": ["od600_blank"]}, client)
        return
    if str(resp).strip() == "rejected":
        ui.send_message("calibration_applied", {
            "ok": False, "applied": [], "failed": ["od600_blank"],
            "error": "板子拒絕了這個 blank ratio(必須大於 0)",
        }, client)
        return

    calib_remember("od600_blank", {
        "ratio": round(ratio, 6),
        "lux_sample": round(lux_sample, 2) if lux_sample is not None else 0.0,
        "lux_ref": round(lux_ref, 2) if lux_ref is not None else 0.0,
    }, source="manual")
    refresh_blank_info()
    ui.send_message("calibration_applied",
                    {"ok": True, "applied": ["od600_blank"], "failed": [], "source": "manual"}, client)


def handle_clear_blank(client, data):
    try:
        Bridge.call("clear_blank", "")
    except Exception as e:
        print(f"[calib] clear_blank 失敗: {e}")
        return
    with _calib_lock:
        calibration_source.pop("od600_blank", None)
    refresh_blank_info()
    push_calibration_state()


def handle_set_pressure_offsets(client, data):
    """手動指定壓力三通道的零點偏移(bar)。單位與 zeroCalibrate() 算出來的完全相同。"""
    data = data or {}
    try:
        offsets = {ch: float(data[ch]) for ch in ("feed", "retentate", "permeate")}
    except (TypeError, ValueError, KeyError):
        ui.send_message("calibration_applied", {
            "ok": False, "applied": [], "failed": ["pressure_offsets"],
            "error": "三個通道的 offset 都要填, 而且必須是數值",
        }, client)
        return

    try:
        resp = Bridge.call("set_pressure_offsets",
                           f"{offsets['feed']},{offsets['retentate']},{offsets['permeate']}")
    except Exception as e:
        ui.send_message("calibration_applied",
                        {"ok": False, "error": str(e), "applied": [], "failed": ["pressure_offsets"]}, client)
        return
    if str(resp).strip() == "rejected":
        ui.send_message("calibration_applied", {
            "ok": False, "applied": [], "failed": ["pressure_offsets"], "error": "板子拒絕了這組 offset",
        }, client)
        return

    for ch in PRESSURE_CHANNELS:
        _mean_filtered_state[ch] = None   # offset 換了, 低通濾波器要重來
    calib_remember("pressure_offsets", {k: round(v, 6) for k, v in offsets.items()}, source="manual")
    ui.send_message("calibration_applied",
                    {"ok": True, "applied": ["pressure_offsets"], "failed": [], "source": "manual"}, client)


def handle_get_calibration_state(client, data):
    push_calibration_state(client)


def handle_read_mcu_calibration(client, data):
    """讀回 MCU 目前實際生效的校正值, 讓使用者可以抄下來備份。"""
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


# ============================= 聚合取樣 (中位數 / 平均) =============================
# 壓力進來是 5Hz、流速 1Hz、OD600 預設 30 秒一次 —— 三個訊號的節奏差很多, 而且
# 壓力/流速本來就疊著蠕動幫浦的週期性脈動, 逐筆的瞬時值拿來做紀錄與比對意義不大。
#
# 這一層把壓力與流速在一個「取樣視窗」(預設 30 秒, 可從介面改)內收集起來, 每個視窗
# 結束時取一次中位數或平均, 作為:
#   1. 畫面上壓力/流速卡片與曲線圖的值(跟 OD600 同一個節奏, 三者永遠對齊)
#   2. 錄製 CSV 的一列(每個視窗一列)
# 取樣時長是三者共用的: 改這個值時會同時把 OD600 的量測間隔(存在 MCU)也設成一樣。
#
# 中位數 vs 平均:
#   中位數 — 對氣泡、單次雜訊尖峰最健全, 一兩筆離譜的值完全不影響結果(預設)
#   平均   — 對幫浦造成的週期性脈動比較合理, 峰值與谷值會互相抵銷, 物理上更接近
#            「這段時間的平均壓力」
#
# 重要: 這一層「不」影響安全相關的快速路徑。TMP 瞬時峰值/谷值告警、collapse
# pressure 保護仍然吃 MCU 每 200ms 送來的原始統計值(見 derive_loop / compute_alerts),
# 不會被 30 秒的平均蓋掉 —— 那正是當初改成高頻取樣要解決的問題。
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
        # 低通濾波前的原始平均值也一起收: 前端的「已濾波 / 原始值」切換才能繼續運作
        "feed_raw": [], "retentate_raw": [], "permeate_raw": [], "tmp_raw": [],
        "tmp_peak": [], "tmp_trough": [], "cycle_hz": [], "pout_trough_ps": [],
        "flow": [], "freq": [], "total": None,
        # v3: pH(1Hz) 與夾閥(1Hz, 1=夾閉/jog 0=開)
        "ph": [], "ph_temp": [], "valve_closed": [],
    }


_agg_buf = _new_agg_buffer()
latest_aggregate = None   # 最近一次算出來的聚合結果(新client連上時補送)


def _aggregate(values):
    """依目前設定的方式把一串瞬時值縮成一個代表值。空串回傳 None。"""
    if not values:
        return None
    method = agg_settings["method"]
    if method == "mean":
        return sum(values) / len(values)
    s = sorted(values)
    n = len(s)
    if method == "trimmed10":
        # G-2: 兩端各去掉 10% 再平均(穩健性與效率的折衷, 常態效率約 94%)
        k = int(n * 0.10)
        core = s[k:n - k] if n - 2 * k > 0 else s
        return sum(core) / len(core)
    if method == "hodges_lehmann":
        return _hodges_lehmann(s)
    # median: 自己算, 不引進 statistics 模組的額外相依
    mid = n // 2
    return s[mid] if n % 2 else 0.5 * (s[mid - 1] + s[mid])


HL_MAX_POINTS = 400   # 取樣時長很長時(上千筆), 先等間隔抽到 400 筆再算, 避免 O(n²) 爆掉


def _hodges_lehmann(sorted_vals):
    """G-3: 所有兩兩平均(Walsh averages, i ≤ j)的中位數。常態效率 95.5%, 崩潰點 29%。"""
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
    """G-4: 視窗內的 SD / IQR / min / max(不受聚合方式影響, 事後判斷代表值可不可信)。"""
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
        # 峰值/谷值不取中位數: 這個視窗內「最壞的一次」才是有意義的安全資訊
        _agg_buf["tmp_peak"].append(snapshot["tmp"]["peak"])
        _agg_buf["tmp_trough"].append(snapshot["tmp"]["trough"])
        _agg_buf["cycle_hz"].append(snapshot["channels"]["feed"]["cycle_freq_hz"])
        _agg_buf["pout_trough_ps"].append(
            (c["retentate"]["trough"] - c["permeate"]["mean_raw"]) * 100.0)   # v4 嚴格版 TMP_out


def agg_push_flow(freq, flow, total):
    with _agg_lock:
        _agg_buf["flow"].append(flow)
        _agg_buf["freq"].append(freq)
        _agg_buf["total"] = total   # 累積量是單調遞增的計數, 取視窗結束時的值而不是平均


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
    """重設視窗(開始錄製、暫停/繼續、改設定時呼叫), 讓下一列是乾淨的一整段。"""
    global _agg_buf, _agg_window_start, _agg_window_start_wall
    with _agg_lock:
        _agg_buf = _new_agg_buffer()
        _agg_window_start = time.monotonic()
        _agg_window_start_wall = time.time()


def _build_aggregate_row(partial=False):
    """把目前視窗的緩衝收掉並算出一列聚合結果。沒有任何壓力樣本就回傳 None。"""
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

    # v3.7 F-1 / G-1: 分析來源 = raw 時, CSV 與衍生參數用低通濾波前的 mean_raw 聚合
    src = "" if alg_settings["analysis_source"] == "ema" else "_raw"
    feed = _aggregate(buf["feed" + src])
    retentate = _aggregate(buf["retentate" + src])
    permeate = _aggregate(buf["permeate" + src])
    tmp = _aggregate(buf["tmp" + src])
    flow = _aggregate(buf["flow"])
    freq = _aggregate(buf["freq"])
    st_tmp = _window_stats(buf["tmp" + src])      # G-4
    st_feed = _window_stats(buf["feed" + src])
    st_flow = _window_stats(buf["flow"])

    # 衍生參數用「聚合後」的壓力與流量重算一次, 而不是把每一秒算出來的衍生值再平均。
    # R = ΔP_net / Q 這種比值型的量, 先平均分子分母再相除, 跟先相除再平均是不一樣的,
    # 前者才是這段時間真正的代表值。
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
        # 給前端切換顯示用(CSV 只寫上面那組低通濾波後的值)
        "pressure_filtered": {"feed": feed, "retentate": retentate, "permeate": permeate, "tmp": tmp},
        "pressure_raw": {
            "feed": _aggregate(buf["feed_raw"]), "retentate": _aggregate(buf["retentate_raw"]),
            "permeate": _aggregate(buf["permeate_raw"]), "tmp": _aggregate(buf["tmp_raw"]),
        },
        # 視窗內最壞的一次峰值/谷值(不是中位數), 供事後檢查這段時間有沒有踩到安全線
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
        "pump_pwm": pump.get("pwm"),
        "pump_forward": pump.get("forward"),
        # v3: pH / 夾閥
        "ph": round(ph_agg, 3) if ph_agg is not None else None,
        "ph_temp_c": round(ph_temp_agg, 2) if ph_temp_agg is not None else None,
        "temp_src": ph_now.get("temp_src") if ph_now.get("ts") else None,   # v3.8
        "ph_state": ph_now.get("state") if ph_now.get("ts") else None,
        "valve_state": valve_now.get("cmd") if valve_now.get("ts") else None,
        # 這個視窗裡夾閥不在「開」的時間比例(0~1), 事後分析用來排除收樣本期間的資料列
        "valve_closed_frac": round(sum(vc) / len(vc), 3) if vc else None,
        "valve_pos": valve_now.get("pos") if valve_now.get("ts") else None,
        "delta_p_bar": derived.get("delta_p_bar"),
        # v4: HFM 衍生參數(用聚合後的壓力/流量重算)
        **{k: derived.get(k) for k, _ in HFM_CSV_COLS},
        "dtmp_dt_bar_per_min": trend.get("dtmp_dt_bar_per_min"),
        "d2tmp_dt2": trend.get("d2tmp_dt2"),
        "steady": steady_info.get("steady", ""),
        # v3.7 G-4: 視窗內的離散程度, 事後判斷代表值可不可信、雜訊有沒有隨時間變大
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
    # next_update_in_sec: 距離目前這個視窗結束還有多久。重新連線的瀏覽器必須拿到這個值,
    # 否則它只能假設「從現在算 window_sec 秒」, 倒數會跟實際更新時間對不上
    # (例如剛好在視窗尾巴連上, 畫面會說還要 30 秒, 但其實 2 秒後就更新了)。
    remaining = agg_settings["window_sec"] - (time.monotonic() - _agg_window_start)
    ui.send_message("aggregate_settings", {
        "window_sec": agg_settings["window_sec"],
        "method": agg_settings["method"],
        "min_window_sec": AGG_MIN_WINDOW_SEC,
        "max_window_sec": AGG_MAX_WINDOW_SEC,
        "next_update_in_sec": round(max(0.0, remaining), 1),
    }, client)


def handle_set_aggregate_settings(client, data):
    """取樣時長是三者共用的: 除了改本地的聚合視窗, 也一併把 MCU 的 OD600 量測間隔
    設成同一個值, 這樣壓力/流速的聚合值與 OD600 才會落在同一個時間節奏上。"""
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
            try:
                resp = Bridge.call("set_measure_interval_sec", str(w))
                if str(resp).strip() == "rejected":
                    print(f"[agg] MCU 拒絕了 OD600 量測間隔 {w}s, 聚合視窗仍然改成 {w}s")
            except Exception as e:
                print(f"[agg] 同步 OD600 量測間隔到 MCU 失敗: {e}")

    if changed:
        agg_reset_window()   # 設定變了, 目前這個視窗已經混到舊設定, 直接重來
        print(f"[agg] 取樣時長 = {agg_settings['window_sec']}s, 聚合方式 = {agg_settings['method']}")
    push_agg_settings()


def handle_get_aggregate_settings(client, data):
    push_agg_settings(client)


ui.on_message("set_aggregate_settings", handle_set_aggregate_settings)
ui.on_message("get_aggregate_settings", handle_get_aggregate_settings)


# ============================= 曲線圖歷史 (v3.8) =============================
# 曲線圖不再滾動/清空: 從 App 啟動(或按「重設曲線」)起的所有聚合點都留在這裡, 新連上的
# 網頁(或重新整理)會一次拿到完整歷史, 整段壓縮在圖上。點數超過上限就把相鄰兩點合併成
# 一點(取平均), 時間軸上的形狀保留、記憶體有上限。資料缺口用 b=1 標記, 合併時不跨缺口。
# 只影響「顯示」, CSV 仍是每個視窗一列的完整資料。
CHART_HIST_MAX = 6000
_chart_lock = threading.Lock()
chart_hist = {"t0": time.time(), "rows": [], "markers": []}


def _chart_point(row, gap_thr):
    pr = row.get("pressure_raw") or {}
    pf = row.get("pressure_filtered") or {}
    pt = {
        "t": round(row.get("ts_end") or time.time(), 2),
        "od": row.get("od600_au"), "flow": row.get("flow_mlmin"), "ph": row.get("ph"),
        "temp": row.get("ph_temp_c"), "vc": row.get("valve_closed_frac"),
        # v4: HFM 趨勢圖(堵塞指標 / L_p / TMP_out)
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
    """錄製開始/停止/接續時在曲線圖上畫一條直線標記。"""
    m = {"t": round(time.time(), 2), "k": kind}
    with _chart_lock:
        chart_hist["markers"].append(m)
        del chart_hist["markers"][:-200]
    try:
        ui.send_message("chart_marker", m)
    except Exception as e:
        print(f"[chart] marker 送出失敗: {e}")


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
    """「重設曲線」按鈕: 清掉顯示用的歷史(不影響 CSV/錄製), 所有已連線的網頁一起重設。"""
    with _chart_lock:
        chart_hist["t0"] = time.time()
        chart_hist["rows"] = []
        chart_hist["markers"] = []
    print("[chart] 曲線圖歷史已重設")
    push_chart_history()


def handle_get_chart_history(client, data):
    push_chart_history(client)


ui.on_message("chart_reset", handle_chart_reset)
ui.on_message("get_chart_history", handle_get_chart_history)


def aggregate_loop():
    """每個取樣視窗結束時算一次聚合值: 廣播給前端, 錄製中就順便寫一列。"""
    global latest_aggregate
    while True:
        time.sleep(0.25)
        try:
            if (time.monotonic() - _agg_window_start) < agg_settings["window_sec"]:
                continue

            row = _build_aggregate_row()
            if row is None:
                # 這個視窗完全沒收到壓力資料。這通常代表 MCU 沒在送 on_pressure_update
                # (Bridge 斷了 / MCU 當了 / 還沒開機完成), 而使用者看到的就是「畫面卡住」,
                # 所以這裡要出聲, 不能安靜地跳過。
                print("[agg] WARNING: 這個取樣視窗完全沒有收到壓力資料, 不產生資料列。"
                      "請檢查 MCU 是否正常運作(Console 應該每秒都有 [diag] 訊息)。")
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
                print(f"[chart] 歷史新增失敗: {e}")
            ui.send_message("aggregate_update", row)
            record_append_row(row)
        except Exception:
            # 單一次視窗出錯不該讓整條迴圈停掉(外層 _run_forever 是最後一道防線,
            # 但那會讓當下的視窗計時重來; 在這裡接住比較不影響節奏)。
            print(f"[agg] 這個視窗處理失敗, 跳過並繼續下一個:\n{traceback.format_exc()}")


# ============================= 手動 / 定時 錄製 =============================
RECORD_STATUS_INTERVAL_SEC = 1.0  # 狀態列(經過秒數)更新頻率; 資料列是每個聚合視窗一列

RECORDINGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "recordings")
os.makedirs(RECORDINGS_DIR, exist_ok=True)
# 進行中的錄製標記檔: App 或整塊板子重開之後, 靠它把沒停止過的那份錄製接回來繼續寫。
RECORDING_MARKER_PATH = os.path.join(_SEARCH_DIR, "recording_state.json")

# v4: HFM 衍生參數欄位(取代 v3 的 delta_p_net/R/shear_rate/shear_stress/tmp_uniformity/n_eff)
HFM_CSV_COLS = (
    ("rho_gh_kpa", ".3f"), ("tmp_out_kpa", ".3f"), ("tmp_out_min_kpa", ".3f"),
    ("dp_friction_kpa", ".3f"), ("dp_ratio", ".3f"), ("tau_w_pa", ".3f"),
    ("gamma_pressure_s1", ".0f"), ("gamma_flow_s1", ".0f"), ("gamma_ratio", ".3f"), ("re", ".0f"),
    ("tmp_mean_kpa", ".3f"), ("tmp_in_kpa", ".3f"), ("tmp_nonuniformity", ".3f"), ("ps_kpa", ".3f"),
    ("q_perm_mlmin", ".3f"), ("j_lmh", ".3f"), ("lp_lmh_bar", ".2f"), ("d_actual_h", ".4f"),
    ("rt_m1", ".3e"), ("tau_shell_min", ".1f"),
)

# 一個聚合視窗一列(預設 30 秒一列)。欄位順序必須與 _row_to_csv_line() 及
# index.html 的 rowsToCsv() 完全一致。
CSV_HEADER = (
    "window_index,elapsed_s,timestamp_start,timestamp_end,window_sec,gap_s,agg_method,"
    "n_samples_pressure,n_samples_flow,partial,"
    "od600_au,od600_lux_sample,od600_lux_ref,od600_bubble_pct,od600_valid,"
    "od600_blank_set,od600_age_s,od600_new,"
    "flow_mlmin,flow_freq_hz,flow_total_ml,"
    "pressure_feed_bar,pressure_retentate_bar,pressure_permeate_bar,pressure_tmp_bar,"
    "pressure_tmp_peak_bar,pressure_tmp_trough_bar,pressure_cycle_freq_hz,"
    "pump_pwm,pump_forward,"
    "ph,ph_temp_c,temp_src,ph_state,"
    "valve_state,valve_closed_frac,valve_pos,"
    "delta_p_bar," + ",".join(k for k, _ in HFM_CSV_COLS) + ","
    "dtmp_dt_bar_per_min,d2tmp_dt2,steady,"
    "tmp_sd_bar,tmp_iqr_bar,tmp_min_bar,tmp_max_bar,feed_sd_bar,"
    "flow_sd_mlmin,flow_iqr_mlmin,flow_min_mlmin,flow_max_mlmin,alg_profile,"
    "config_version,constants_version\n"
)

# 送回前端的資料列上限。以前是把整場錄製的每一列都留在記憶體、停止時整包用 WebSocket
# 送給瀏覽器下載 —— 72 小時的錄製那包會是好幾 MB, 而且瀏覽器沒連著就等於沒有。
# 現在每一列在產生的當下就已經寫進磁碟了, 瀏覽器只需要拿到「最近這些列」做預覽,
# 完整檔案一律從 /download/recording 這個 HTTP 端點抓(或直接去板子上的 recordings/ 拿)。
RECORD_ROWS_TO_CLIENT = 500

_record_lock = threading.Lock()
record_state = "idle"          # "idle" | "recording" | "paused"
record_start_monotonic = None
record_paused_accum = 0.0       # 累積被暫停掉的秒數(暫停期間不計入 elapsed)
record_pause_started = None
record_duration_sec = None      # None = 手動模式; 有值 = 定時模式, 時間到自動結束
record_csv_path = None          # 這次錄製正在寫的檔案(從按下開始就存在)
record_row_count = 0
record_recent_rows = deque(maxlen=RECORD_ROWS_TO_CLIENT)
_record_last_od_seq = None      # 上一列記錄到的OD600量測序號, 用來標記 od600_new
_record_last_row_end = None     # 上一列的結束時間(wall clock), 用來算 gap_s


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
        _fmt(row.get("flow_mlmin"), ".2f"), _fmt(row.get("flow_freq_hz"), ".3f"),
        _fmt(row.get("flow_total_ml"), ".2f"),
        _fmt(row.get("pressure_feed_bar"), ".5f"), _fmt(row.get("pressure_retentate_bar"), ".5f"),
        _fmt(row.get("pressure_permeate_bar"), ".5f"), _fmt(row.get("pressure_tmp_bar"), ".5f"),
        _fmt(row.get("pressure_tmp_peak_bar"), ".5f"), _fmt(row.get("pressure_tmp_trough_bar"), ".5f"),
        _fmt(row.get("pressure_cycle_freq_hz"), ".2f"),
        str(row.get("pump_pwm", "")), str(row.get("pump_forward", "")),
        _fmt(row.get("ph"), ".3f"), _fmt(row.get("ph_temp_c"), ".2f"),
        _s(row.get("temp_src")), _s(row.get("ph_state")),
        _s(row.get("valve_state")), _fmt(row.get("valve_closed_frac"), ".3f"),
        _s(row.get("valve_pos")),
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
        row.get("config_version", ""), row.get("constants_version", ""),
    ]) + "\n"


def _append_row_to_disk(path, row):
    """把一列寫進磁碟並確實落盤(flush + fsync)。
    以前是整場錄製都放在記憶體、停止時才寫檔 —— 那代表停電/當機/重開機就全部歸零,
    也代表「板子獨立記錄」這件事其實只在正常收尾時成立。現在每個視窗一產生就落盤,
    最壞情況只會失去還沒結束的那一個視窗。"""
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(_row_to_csv_line(row))
            f.flush()
            os.fsync(f.fileno())
        return True
    except OSError as e:
        print(f"[record] 寫入 {path} 失敗: {e}")
        return False


def _write_recording_marker():
    """記下這次錄製的進度, 讓 App/板子重開之後可以接回來繼續寫。"""
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
                # 上一列的結束時間: 接續之後第一列的 gap_s 要靠它才算得出真正的中斷長度
                "last_row_end": _record_last_row_end,
                "updated_at": time.time(),
            }, f, ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"[record] 寫入進度標記檔失敗: {e}")


def _clear_recording_marker():
    try:
        if os.path.exists(RECORDING_MARKER_PATH):
            os.remove(RECORDING_MARKER_PATH)
    except OSError as e:
        print(f"[record] 刪除進度標記檔失敗: {e}")


_record_start_wall = None


def push_record_status(state, elapsed_sec, sample_count, duration_sec, client=None):
    ui.send_message("record_status", {
        "state": state,
        "elapsed_sec": round(elapsed_sec, 2),
        "sample_count": sample_count,
        "duration_sec": duration_sec,
        # 讓畫面看得到「資料是寫在板子上的」, 而不是存在瀏覽器裡
        "csv_filename": os.path.basename(record_csv_path) if record_csv_path else None,
        "rows_on_disk": record_row_count,
    }, client)


def push_record_status_snapshot(client=None):
    """新的瀏覽器連上時立刻補送一次目前的錄製狀態。
    沒有這個的話, 閒置中(idle)時 record_status_loop 根本不會推播, 重新連線的頁面
    要靠自己的預設值猜; 錄製中則要等最多 1 秒。重連當下最需要的就是「現在到底有沒有
    在錄」這個資訊, 不該讓它有空窗。"""
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
    """由 aggregate_loop 在每個取樣視窗結束時呼叫。非錄製中就什麼都不做。"""
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
        # gap_s: 這一列的起點距離上一列的終點有多久。正常就是 0 上下; 中間如果
        # 因為 App/板子重開、或壓力資料中斷而少了幾分鐘, 這裡會直接把缺口寫出來,
        # 事後看 CSV 不需要自己比對時間戳才發現「這段其實沒資料」。
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


def _start_recording_file():
    """建立這次錄製的 CSV 並寫入表頭。回傳檔案路徑。"""
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
            print(f"[record] 無法建立錄製檔: {e}")
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
        _write_recording_marker()
        path = record_csv_path
    print(f"[record] 開始錄製 -> {path}")
    # 從乾淨的一整個視窗開始, 第一列才不會只有半段時間的資料
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
    # 暫停與繼續都重設視窗: 否則會產生一列橫跨暫停前後的資料, 那一列的
    # 「取樣時長」跟實際涵蓋的時間對不起來, 事後分析會很難解釋。
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

    # 收尾時把目前這個還沒滿的視窗也結算成一列(標記 partial=1), 免得最後
    # 不到一個視窗的資料就這樣丟掉 —— 定時錄製秒數比視窗短時, 這一列就是唯一的資料。
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
    filename = os.path.basename(path) if path else None
    print(f"[record] 錄製結束 -> {filename} (共 {count} 列, 已全部寫入磁碟)")
    chart_hist_marker("stop")
    push_record_status("idle", elapsed, count, None)
    ui.send_message("record_saved", {
        "filename": filename,
        "sample_count": count,
        "elapsed_sec": round(elapsed, 2),
        "auto": auto,
        "reason": reason,
        # rows 只是最近幾列的預覽; 完整檔案在板子上, 也可以用 download_url 抓
        "rows": rows,
        "truncated": truncated,
        "download_url": f"/download/recording?name={filename}" if filename else None,
    })


def handle_stop_record(client, data):
    finish_recording(auto=False)


def handle_record_checkpoint(client, data):
    """v4.10: 中途存檔 —— 錄製不中斷, 把目前為止的 CSV 複製成一個獨立檔案並讓瀏覽器下載。
    每一列寫入時都已 flush+fsync, 所以複製下來的就是到這一刻為止的完整資料。"""
    import shutil
    with _record_lock:
        state, path, rows = record_state, record_csv_path, record_row_count
        if state not in ("recording", "paused") or not path or not os.path.exists(path):
            ui.send_message("record_checkpoint_saved", {"ok": False, "error": "目前沒有進行中的錄製"}, client)
            return
        base = os.path.splitext(os.path.basename(path))[0]
        snap = f"{base}_checkpoint_{time.strftime('%Y%m%d_%H%M%S')}.csv"
        try:
            shutil.copyfile(path, os.path.join(RECORDINGS_DIR, snap))
        except OSError as e:
            ui.send_message("record_checkpoint_saved", {"ok": False, "error": str(e)}, client)
            return
    print(f"[record] 中途存檔: {snap} ({rows} 列), 錄製繼續進行")
    ui.send_message("record_checkpoint_saved", {
        "ok": True, "filename": snap, "sample_count": rows, "source": os.path.basename(path),
        "download_url": f"/download/recording?name={snap}"}, client)
    ui.send_message("recordings_list", {"dir": RECORDINGS_DIR, "files": list_recording_files()})


ui.on_message("record_checkpoint", handle_record_checkpoint)
ui.on_message("start_record", handle_start_record)
ui.on_message("pause_record", handle_pause_record)
ui.on_message("stop_record", handle_stop_record)


def resume_interrupted_recording():
    """App 或整塊板子重開之後, 把沒有正常停止的那份錄製接回來繼續寫。

    因為每一列在產生的當下就已經落盤了, 中斷時最多只會缺最後一個還沒結束的視窗;
    這裡要做的只是把「錄製中」這個狀態接回來, 並讓後續的列繼續往同一個檔案附加。
    elapsed 依照真實經過的時間繼續累計(不是從 0 重來), 中斷的那段會在下一列的
    gap_s 欄位裡誠實標出來。
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
        print(f"[record] 進度標記檔指向的 CSV 不存在({path}), 忽略並清除標記")
        _clear_recording_marker()
        return

    # v3: CSV 欄位變多了。如果要接續的是舊版欄位的檔案, 不能往裡面附加新格式的列
    # (欄位會錯位), 改開一個新檔接著錄, 舊檔原封不動保留。
    try:
        with open(path, "r", encoding="utf-8") as f:
            first_line = f.readline()
    except OSError:
        first_line = ""
    if first_line.strip() != CSV_HEADER.strip():
        try:
            new_path = _start_recording_file()
            print(f"[record] {os.path.basename(path)} 是舊版欄位格式, 改接續到新檔 {os.path.basename(new_path)}")
            path = new_path
            marker["row_count"] = 0
            marker["last_row_end"] = None
        except OSError as e:
            print(f"[record] 無法建立接續用的新檔({e}), 放棄接續")
            _clear_recording_marker()
            return

    start_wall = float(marker.get("start_time_wall") or time.time())
    paused = float(marker.get("paused_accum") or 0.0)
    duration = marker.get("duration_sec")
    elapsed = max(0.0, time.time() - start_wall - paused)
    gap = max(0.0, time.time() - float(marker.get("updated_at") or start_wall))

    if duration is not None and elapsed >= float(duration):
        # 定時錄製在中斷期間就已經到期了: 直接收尾, 不要再繼續錄下去
        print(f"[record] 偵測到中斷的定時錄製且時間已到, 直接收尾: {os.path.basename(path)}")
        _clear_recording_marker()
        ui.send_message("record_saved", {
            "filename": os.path.basename(path), "sample_count": int(marker.get("row_count") or 0),
            "elapsed_sec": round(elapsed, 2), "auto": True, "reason": "interrupted_timer_expired",
            "rows": [], "truncated": True,
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
        # 用中斷前最後一列的結束時間當基準, 接續後第一列的 gap_s 就會是真正的中斷長度。
        # 設成 None 的話那一列會顯示 gap_s=0, 等於把中斷藏起來, 正好違背這個欄位的目的。
        _record_last_row_end = marker.get("last_row_end")
        # 視窗編號接著數下去, 不要在同一個檔案裡從 1 重來
        try:
            _agg_window_index = max(_agg_window_index, int(marker.get("window_index") or 0))
        except (TypeError, ValueError):
            pass
        record_state = "recording"
        _write_recording_marker()

    print(f"[record] 接續中斷的錄製: {os.path.basename(path)} "
          f"(已錄 {record_row_count} 列, 已經過 {elapsed:.0f}s, 中斷約 {gap:.0f}s)")
    agg_reset_window()
    chart_hist_marker("resume")
    ui.send_message("record_resumed", {
        "filename": os.path.basename(path),
        "row_count": record_row_count,
        "elapsed_sec": round(elapsed, 2),
        "gap_sec": round(gap, 1),
    })
    push_record_status("recording", elapsed, record_row_count, record_duration_sec)


# ---- 錄製檔案的列表與下載 ----
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
            out.append({
                "name": name,
                "size_bytes": st.st_size,
                "modified_at": st.st_mtime,
                "active": (record_csv_path is not None and os.path.basename(record_csv_path) == name),
                "download_url": f"/download/recording?name={name}",
            })
    except OSError as e:
        print(f"[record] 列出 recordings/ 失敗: {e}")
    return out


def handle_list_recordings(client, data):
    ui.send_message("recordings_list", {"dir": RECORDINGS_DIR, "files": list_recording_files()}, client)


ui.on_message("list_recordings", handle_list_recordings)


# HTTP 下載端點: 讓完整的 CSV 不必經過 WebSocket, 也不必依賴「停止當下瀏覽器有連著」。
# WebUI Brick 不一定每個版本都有 expose_api, 所以整段包在能力偵測裡; 沒有的話
# 檔案仍然在板子的 recordings/ 資料夾, 只是要自己去拿。
def _register_download_endpoint():
    if not hasattr(ui, "expose_api"):
        print("[record] 這個 WebUI Brick 版本沒有 expose_api, 略過 HTTP 下載端點; "
              f"錄製檔仍然會寫到 {RECORDINGS_DIR}")
        return
    try:
        from fastapi.responses import FileResponse, JSONResponse
    except ImportError:
        print("[record] 找不到 fastapi, 略過 HTTP 下載端點")
        return

    def api_download_recording(name: str = None):
        # 只允許取 recordings/ 底下的檔名本身, 擋掉 ../ 之類的路徑穿越
        safe = os.path.basename(name or "")
        if not safe.endswith(".csv"):
            return JSONResponse({"error": "invalid name"}, status_code=400)
        full = os.path.join(RECORDINGS_DIR, safe)
        if not os.path.exists(full):
            return JSONResponse({"error": "not found"}, status_code=404)
        return FileResponse(full, filename=safe, media_type="text/csv")

    def api_list_recordings():
        return {"dir": RECORDINGS_DIR, "files": list_recording_files()}

    try:
        ui.expose_api("GET", "/download/recording", api_download_recording)
        ui.expose_api("GET", "/api/recordings", api_list_recordings)
        print("[record] 已註冊 HTTP 下載端點 /download/recording")
    except Exception as e:
        print(f"[record] 註冊 HTTP 下載端點失敗(不影響錄製): {e}")


_register_download_endpoint()


def record_status_loop():
    """資料列是由 aggregate_loop 每個視窗寫一列; 這條迴圈只負責讓畫面上的
    「已錄製秒數」每秒跳動, 以及處理『定時秒數比一個取樣視窗還短』的情況
    (那種情況不會有任何一個完整視窗結束, 得由這裡來收尾)。"""
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


# ============================= 背景執行緒的保命包裝 =============================
# 2026-09-01 加: 之前這些背景迴圈是直接 threading.Thread(target=fn) 丟出去的,
# 只要迴圈裡丟出一次沒接到的例外, 那條執行緒就「永久」死掉 —— 而且死得很安靜:
# 網頁不會斷線、其他訊息照常跑, 只有那一路的資料停止更新。實際症狀就是
# 「畫面卡住, 重新整理/重新連線也救不回來, 只有重啟整個 App 才會好」,
# 因為瀏覽器端一切正常, 壞掉的是後端那條執行緒。
#
# 現在每條背景執行緒都包在這裡面: 例外會被印出完整 traceback(方便事後追),
# 然後 1 秒後自動把那條迴圈重新啟動, 而不是讓它就這樣消失。
def _run_forever(name, fn, restart_delay_sec=1.0):
    def runner():
        while True:
            try:
                fn()   # 正常情況下 fn 自己是無窮迴圈, 不會返回
                print(f"[thread] {name} 意外返回(沒有例外), {restart_delay_sec}s 後重新啟動")
            except Exception:
                print(f"[thread] {name} 丟出未處理的例外, {restart_delay_sec}s 後重新啟動:\n"
                      f"{traceback.format_exc()}")
            time.sleep(restart_delay_sec)
    return runner


# ============================= 啟動 =============================
# v3.2: 所有「要跟 MCU 講話」的開機同步搬到背景執行緒。
# 以前這些 Bridge.call 是在 App.run() 之前依序執行的; 每一個在 MCU 沒回應時都要等 10 秒逾時,
# 十幾個加起來網頁要一兩分鐘後才起得來, 看起來就像整個系統當掉。現在網頁立刻可用,
# MCU 若沒回應會在狀態列 / 紅色橫幅與 Console 明確顯示(見 mcu_link)。

# ---- 只讀本機檔案的部分照舊在這裡做 ----
_calib_file = _load_calibration_file()
calibration_saved = dict(_calib_file.get("items") or {})
if calibration_saved:
    print(f"[calib] 已載入存檔的校正值: {', '.join(sorted(calibration_saved))}")

pv_saved.update(_load_pv_state())
if isinstance(pv_saved.get("rpc_wd"), dict):              # v4.9
    rpc_wd_pref.update({k: pv_saved["rpc_wd"][k] for k in ("en", "sec") if k in pv_saved["rpc_wd"]})
if pv_saved:
    print(f"[ph/valve] 已載入存檔: {', '.join(sorted(pv_saved))}")
for _k, _v in (pv_saved.get("algorithms") or {}).items():   # v3.7: 存檔的演算法選擇
    if _k in ALG_OPTIONS and _v in ALG_OPTIONS[_k]:
        alg_settings[_k] = _v
print(f"[alg] {alg_profile_string()}")
if pv_saved.get("specs"):                  # v4.1: 規格管理的覆寫值
    _sv, _se = _spec_validate(pv_saved["specs"])
    specs_apply(_sv, save=False)
    print(f"[specs] 已載入規格覆寫: {', '.join(sorted(_sv)) or '(無)'}" + (f" | 略過: {_se}" if _se else ""))
hfm_load_saved(pv_saved.get("hfm"))      # v4: ρgh / ΔP–Q 基準 / Q_perm / L_p 初始值

# 如果上次的錄製沒有正常停止(App 重啟 / 板子重開 / 斷電), 把它接回來繼續寫。
# 每一列在產生的當下就已經落盤了, 所以這裡接回來的是完整的資料, 不是重頭來過。
resume_interrupted_recording()


def _startup_mcu_sync():
    t0 = time.time()
    print("[startup] 開始與 MCU 同步...")
    poll_mcu_diag()              # 先確認 Bridge 通不通, 結果會印在 Console
    _sync_pump_status_from_mcu()
    poll_od600_once()            # 開機時先同步一次OD600狀態(可能MCU早就量過了)
    refresh_blank_info()         # 以及 blank 校正狀態(只有Python重啟時特別重要)
    startup_calibration_sync()   # 失敗的話 od600_poll_loop 會重試
    ph_valve_startup_sync()      # 失敗的話 od600_poll_loop 會重試
    # 取樣時長是三者共用的: 開機時把 MCU 的 OD600 量測間隔對齊目前的聚合視窗設定,
    # 否則 MCU 會維持自己的 30 秒預設值, 跟 constants.json 改過的視窗長度對不上。
    try:
        _resp = Bridge.call("set_measure_interval_sec", str(agg_settings["window_sec"]))
        if str(_resp).strip() == "rejected":
            print(f"[agg] MCU 拒絕了開機時的 OD600 量測間隔同步({agg_settings['window_sec']}s)")
        else:
            print(f"[agg] 取樣時長 {agg_settings['window_sec']}s (聚合方式 {agg_settings['method']}), 已同步給 MCU")
    except Exception as e:
        print(f"[agg] 開機同步 OD600 量測間隔失敗(稍後可從介面重設): {e}")
    push_pump_status()
    print(f"[startup] MCU 同步結束, 花了 {time.time() - t0:.1f} s, Bridge {'正常' if mcu_link['ok'] else '沒有回應'}")


def _startup_mcu_sync_once():
    global _startup_thread_done
    try:
        _startup_mcu_sync()
    except Exception:
        print(f"[startup] MCU 同步失敗:\n{traceback.format_exc()}")
    finally:
        _startup_thread_done = True


threading.Thread(target=_startup_mcu_sync_once, daemon=True, name="startup_mcu_sync").start()

agg_reset_window()

for _name, _fn in (
    ("push_flow_loop", push_flow_loop),
    ("od600_poll_loop", od600_poll_loop),
    ("derive_loop", derive_loop),
    ("aggregate_loop", aggregate_loop),
    ("record_status_loop", record_status_loop),
):
    threading.Thread(target=_run_forever(_name, _fn), daemon=True, name=_name).start()

App.run()
