# -*- coding: utf-8 -*-
# ============================================================================
# ReLeaf v5.0 - raw data logger
# ============================================================================
# Each recording adds a folder <recording name>_raw/ under recordings/, containing the completely unprocessed data sent by the MCU:
#
#   meta.json                  full state at recording start: firmware/backend versions, pressure conversion constants, zeros, OD blank, pH calibration, specs...
#   events.csv                 all events during recording that affect conversion (zeroing, blank, pH calibration, algorithm switch, pump/pinch valve commands,
#                              MCU restart, data gaps...). Applied by timestamp when recomputing.
#   pressure_YYYYMMDD_HH.csv   100 Hz pressure: 16-sample ADC sum per channel, three channels (zero not subtracted)        <- one file per hour, gzip after the hour rolls over
#   flow_YYYYMMDD_HH.csv       per second: pulse count, first-to-last pulse interval, cumulative pulses                  <- same as above
#   aux_YYYYMMDD_HH.csv        per second: pH ADC sum (one every 500 ms), DS18B20 raw value, pump state <- same as above
#   valve_YYYYMMDD_HH.csv      pinch valve state (verbatim MCU text)                                    <- same as above
#   od_raw.csv                 per OD600 attempt: 4 dark current + 16 LED-on readings (same format as inline photometer,
#                              tools/replay_od.py can rerun the 8 algorithms directly)
#
# Write strategy: each write goes into the OS buffer, flush every 1 s, fsync every 5 s (pressure at 100 Hz cannot fsync per row,
# it would wear out the eMMC). A power loss loses at most about the last 5 s of raw data; the aggregate CSV is still fsynced per row.
# After the hour rolls over, the old file is gzipped in the background (about 1/4 size) and the original is deleted only on success. When the app restarts and resumes recording, the same folder is reused.
# Uses only the Python standard library.
# ============================================================================

import csv
import gzip
import io
import json
import os
import shutil
import threading
import time

STREAMS = {
    "pressure": ("epoch_s", "mcu_ms", "batch_seq", "feed_sum", "retentate_sum", "permeate_sum"),
    "flow": ("epoch_s", "mcu_ms", "seq", "window_ms", "pulses", "span_us", "total_pulses"),
    "aux": ("epoch_s", "mcu_ms", "seq", "ph_samples", "ds_state", "t_raw16", "t_age_ms", "ds_err",
            "pump_pwm", "pump_fwd", "pump_kick", "base_on", "base_left_ms", "ptrip"),   # v6.0: base pump / pressure protection
    "valve": ("epoch_s", "payload"),
    "avalve": ("epoch_s", "payload"),        # v6.0: shell sampling valve + feed valve (verbatim MCU on_avalve_update text)
}
ROTATING = set(STREAMS)                     # these roll over to a new file every hour
EVENTS_HEADER = ("epoch_s", "time_local", "kind", "detail_json")


def _hour_tag(t):
    return time.strftime("%Y%m%d_%H", time.localtime(t))


class RawSession:
    def __init__(self, folder, meta=None, od_header=None, flush_s=1.0, fsync_s=5.0):
        self.folder = folder
        os.makedirs(folder, exist_ok=True)
        self._lock = threading.Lock()
        self._files = {}           # stream -> (hour_tag, file, csv.writer)
        self._od = None
        self._od_header = od_header
        self._events = None
        self.rows = {k: 0 for k in list(STREAMS) + ["od", "events"]}
        self.closed = False
        self.bytes_written = 0
        self._flush_s, self._fsync_s = flush_s, fsync_s
        self._last_flush = self._last_fsync = time.monotonic()
        if meta is not None and not os.path.exists(os.path.join(folder, "meta.json")):
            self.write_meta(meta)
        self._compress_leftovers()
        self._timer = threading.Thread(target=self._sync_loop, daemon=True, name="raw_sync")
        self._timer.start()

    # ---------- meta / events ----------
    def write_meta(self, meta):
        tmp = os.path.join(self.folder, "meta.json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2, default=str)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, os.path.join(self.folder, "meta.json"))

    def event(self, kind, detail=None, t=None):
        t = time.time() if t is None else t
        with self._lock:
            if self.closed:
                return
            if self._events is None:
                path = os.path.join(self.folder, "events.csv")
                new = not os.path.exists(path)
                f = open(path, "a", encoding="utf-8", newline="")
                w = csv.writer(f)
                if new:
                    w.writerow(EVENTS_HEADER)
                self._events = (f, w)
            f, w = self._events
            w.writerow([f"{t:.3f}", time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t)), kind,
                        json.dumps(detail, ensure_ascii=False, default=str) if detail is not None else ""])
            f.flush()
            os.fsync(f.fileno())               # events are rare, so every one is flushed to disk
            self.rows["events"] += 1

    # ---------- Streams ----------
    def write(self, stream, rows):
        """rows: list of lists (can write multiple rows at once)."""
        if not rows:
            return
        with self._lock:
            if self.closed:
                return
            tag = _hour_tag(time.time())
            cur = self._files.get(stream)
            if cur is None or cur[0] != tag:
                if cur is not None:
                    cur[1].close()
                    self._compress_async(cur[1].name)
                path = os.path.join(self.folder, f"{stream}_{tag}.csv")
                new = not os.path.exists(path)
                f = open(path, "a", encoding="utf-8", newline="")
                w = csv.writer(f)
                if new:
                    w.writerow(STREAMS[stream])
                cur = (tag, f, w)
                self._files[stream] = cur
            w = cur[2]
            for r in rows:
                w.writerow(r)
            self.rows[stream] += len(rows)

    def write_od(self, row):
        with self._lock:
            if self.closed:
                return
            if self._od is None:
                path = os.path.join(self.folder, "od_raw.csv")
                new = not os.path.exists(path)
                f = open(path, "a", encoding="utf-8", newline="")
                w = csv.writer(f)
                if new and self._od_header:
                    w.writerow(self._od_header)
                self._od = (f, w)
            f, w = self._od
            w.writerow(row)
            f.flush()
            os.fsync(f.fileno())
            self.rows["od"] += 1

    # ---------- Flush to disk ----------
    def _all_files(self):
        fs = [c[1] for c in self._files.values()]
        if self._od:
            fs.append(self._od[0])
        if self._events:
            fs.append(self._events[0])
        return fs

    def sync(self, fsync=True):
        with self._lock:
            for f in self._all_files():
                try:
                    f.flush()
                    if fsync:
                        os.fsync(f.fileno())
                except (OSError, ValueError):
                    pass

    def _sync_loop(self):
        while not self.closed:
            time.sleep(self._flush_s)
            now = time.monotonic()
            do_fsync = now - self._last_fsync >= self._fsync_s
            self.sync(fsync=do_fsync)
            if do_fsync:
                self._last_fsync = now

    def close(self):
        with self._lock:
            if self.closed:
                return
            files = self._all_files()
            rotating = [c[1].name for c in self._files.values()]
            self.closed = True
        for f in files:
            try:
                f.flush()
                os.fsync(f.fileno())
                f.close()
            except (OSError, ValueError):
                pass
        for p in rotating:                    # recording ends: compress the current hour's file too
            self._compress_async(p)

    # ---------- Compression ----------
    def _compress_async(self, path):
        threading.Thread(target=compress_file, args=(path,), daemon=True, name="raw_gzip").start()

    def _compress_leftovers(self):
        """When resuming a recording: compress in the background any uncompressed files not from the current hour (left over from the last interruption)."""
        tag = _hour_tag(time.time())
        for name in os.listdir(self.folder):
            if name.endswith(".csv") and any(name.startswith(s + "_") for s in ROTATING) and tag not in name:
                self._compress_async(os.path.join(self.folder, name))

    # ---------- Status ----------
    def summary(self):
        return {"folder": os.path.basename(self.folder), "rows": dict(self.rows), "size_bytes": folder_size(self.folder)}


def compress_file(path):
    gz = path + ".gz"
    if not os.path.exists(path) or os.path.exists(gz):
        return
    tmp = gz + ".tmp"
    try:
        with open(path, "rb") as src, gzip.open(tmp, "wb", compresslevel=6) as dst:
            shutil.copyfileobj(src, dst, 1024 * 1024)
        with open(tmp, "rb") as f:
            os.fsync(f.fileno())
        os.replace(tmp, gz)
        os.remove(path)
    except OSError as e:
        print(f"[raw] compressing {os.path.basename(path)} failed (original kept): {e}")
        try:
            os.remove(tmp)
        except OSError:
            pass


def folder_size(folder):
    total = 0
    try:
        for name in os.listdir(folder):
            try:
                total += os.path.getsize(os.path.join(folder, name))
            except OSError:
                pass
    except OSError:
        pass
    return total


def disk_free_bytes(path):
    try:
        return shutil.disk_usage(path).free
    except OSError:
        return None


def open_text(path):
    """Reads .csv or .csv.gz (for tools)."""
    if path.endswith(".gz"):
        return io.TextIOWrapper(gzip.open(path, "rb"), encoding="utf-8", newline="")
    return open(path, "r", encoding="utf-8", newline="")
