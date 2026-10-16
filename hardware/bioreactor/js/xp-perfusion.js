// The bioreactor record, 2.2 "Why a Hollow-Fiber Bioreactor": batch or perfusion (15 Oct 2026).
//
// A MODEL, and the card is tagged so. The argument it lets the reader play with is the content doc v5's 2.2
// (dev/night-logs/2026-10-15-content-v5/pages/CONTENT-v5.txt): "Medium is exchanged continuously, so the culture
// holds high density for weeks rather than growing to a peak and being harvested." No number in here is measured:
// the axes are relative and the parameters illustrative. The record has no weeks-long run with a medium feed yet
// (3.2 says the bioreactor "is designed to allow fresh medium to be supplied"; 7.3 lists longer operation as future
// testing), and no protectant transfer rate (7.2), so the card's note says both. The equations below are printed in
// the card's "How this is computed" too; keep the two in step.
//
//   mu(S) = MU S / (KS + S)                                    growth slows as the nutrient runs out
//   dX/dt = mu X (1 - X/K) - KD X - (1 - R) D X                R = 1: the membrane holds every cell back
//   dS/dt = D (SIN - S) - mu X (1 - X/K) / Y - M X             D: fresh medium in = permeate out
//   dP/dt = q X - D P                                          protectant secreted into the culture
//   Perfusion collects D P all the time. The batch runs at D = 0, is harvested every N days (collecting P), then
//   spends TURN days being emptied, cleaned, refilled and re-inoculated.
//
// One canvas (XP.dpr, re-sized on width change), animated only through XP.loop: the curves draw on once the card is
// in view, then ease to each new answer; under XP.reduced they are drawn still and the controls still work.
(function () {
  "use strict";
  const card = document.getElementById("xp-perfusion");
  if (!card || !window.XP) return;
  const XP = window.XP;
  const stage = card.querySelector(".xp-stage");
  const canvas = stage && stage.querySelector("canvas");
  const tip = stage && stage.querySelector(".xp-pf-tip");
  const rate = card.querySelector("#xp-pf-rate");
  const rateOut = card.querySelector("#xp-pf-rate-out");
  const cadBtns = Array.prototype.slice.call(card.querySelectorAll(".xp-pf-cad button[data-n]"));
  const stopBtn = card.querySelector("#xp-pf-stop");
  const read = card.querySelector(".xp-pf-read");
  if (!canvas || !canvas.getContext || !rate) return;

  /* ---------------------------------------------------------------- the model */
  // Illustrative values (per day where a rate). Growth is fast against a four-week axis, as B. subtilis is; nothing
  // here is fitted to the record's OD600 curves.
  const MU = 24, KS = 0.05, K = 1, KD = 0.4, Y = 0.8, M = 0.1, SIN = 1, R = 1, Q = 1;
  const X0 = 0.02, TURN = 0.5, T = 28, H = 0.0025, EVERY = 10, STOP_DAY = 14, D_MAX = 1;
  const STEPS = Math.round(T / H), NS = STEPS / EVERY + 1, DT_S = H * EVERY;    // a sample every 0.025 day
  const SLOPE = 0.06;            // per-capita |dX/dt| / X (per day) below this reads as "holding" in the hover narrator

  const k1 = new Float64Array(4), k2 = new Float64Array(4), k3 = new Float64Array(4), k4 = new Float64Array(4);
  const tmp = new Float64Array(4);
  // state: X, S, P, and C (protectant collected through the permeate)
  function deriv(st, d, out) {
    const x = st[0], s = st[1] > 0 ? st[1] : 0, p = st[2];
    const mu = MU * s / (KS + s);
    const g = mu * x * (1 - x / K);
    out[0] = g - KD * x - (1 - R) * d * x;
    out[1] = d * (SIN - s) - g / Y - M * x;
    out[2] = Q * x - d * p;
    out[3] = d * p;
  }
  function rk4(st, d) {
    let i;
    deriv(st, d, k1);
    for (i = 0; i < 4; i++) tmp[i] = st[i] + H / 2 * k1[i];
    deriv(tmp, d, k2);
    for (i = 0; i < 4; i++) tmp[i] = st[i] + H / 2 * k2[i];
    deriv(tmp, d, k3);
    for (i = 0; i < 4; i++) tmp[i] = st[i] + H * k3[i];
    deriv(tmp, d, k4);
    for (i = 0; i < 4; i++) st[i] += H / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    if (st[0] < 0) st[0] = 0;
    if (st[1] < 0) st[1] = 0;
    if (st[2] < 0) st[2] = 0;
  }
  // 0 growing, 1 holding / at its peak, 2 declining, 3 harvested and being restarted
  function phase(st, d) {
    deriv(st, d, k1);
    const r = k1[0] / Math.max(st[0], 1e-3);           // per capita, so a small culture still dying reads as declining
    return r > SLOPE ? 0 : r < -SLOPE ? 2 : 1;
  }

  function runPerfusion(D, stop) {
    const x = new Float32Array(NS), c = new Float32Array(NS), ph = new Uint8Array(NS);
    const st = new Float64Array([X0, SIN, 0, 0]);
    let medium = 1;                                     // the first fill
    x[0] = X0; ph[0] = phase(st, D);
    for (let i = 0; i < STEPS; i++) {
      const d = stop && i * H >= STOP_DAY - 1e-9 ? 0 : D;
      rk4(st, d);
      medium += d * H;
      if ((i + 1) % EVERY === 0) {
        const j = (i + 1) / EVERY;
        x[j] = st[0]; c[j] = st[3];
        ph[j] = phase(st, stop && j * DT_S >= STOP_DAY - 1e-9 ? 0 : D);
      }
    }
    return { x: x, c: c, ph: ph, medium: medium };
  }

  function runBatch(N) {
    const x = new Float32Array(NS), c = new Float32Array(NS), ph = new Uint8Array(NS);
    const st = new Float64Array([X0, SIN, 0, 0]);
    let got = 0, age = 0, down = -1, fills = 1;
    x[0] = X0; ph[0] = phase(st, 0);
    for (let i = 0; i < STEPS; i++) {
      if (down >= 0) {
        down += H;
        if (down >= TURN - 1e-9 && (i + 1) * H < T - 1e-9) {   // a fresh start (and a fresh fill of medium)
          down = -1; age = 0; fills++;
          st[0] = X0; st[1] = SIN; st[2] = 0; st[3] = 0;
        }
      } else {
        rk4(st, 0);
        age += H;
        if (age >= N - 1e-9) {                                   // harvest: everything secreted is collected
          got += st[2];
          st[0] = 0; st[1] = 0; st[2] = 0; st[3] = 0;
          down = 0;
        }
      }
      if ((i + 1) % EVERY === 0) {
        const j = (i + 1) / EVERY;
        x[j] = st[0]; c[j] = got;
        ph[j] = down >= 0 ? 3 : phase(st, 0);
      }
    }
    return { x: x, c: c, ph: ph, fills: fills };
  }

  // the protectant axis: 1 = the most the perfusion culture collects in four weeks, at the top of the slider
  const CMAX = runPerfusion(D_MAX, false).c[NS - 1] || 1;
  const VMAX = 1.06;                                   // both panels' headroom over 1

  /* ---------------------------------------------------------------- state */
  let D = parseFloat(rate.value) || 0;
  let N = 3;
  cadBtns.forEach(function (b) { if (b.getAttribute("aria-pressed") === "true") N = +b.getAttribute("data-n"); });
  let stop = false;

  const tgt = { px: new Float32Array(NS), pc: new Float32Array(NS), bx: new Float32Array(NS), bc: new Float32Array(NS) };
  const cur = { px: new Float32Array(NS), pc: new Float32Array(NS), bx: new Float32Array(NS), bc: new Float32Array(NS) };
  const KEYS = ["px", "pc", "bx", "bc"];
  let pph = new Uint8Array(NS), bph = new Uint8Array(NS);
  let totals = { pc: 0, bc: 0, pm: 1, bm: 1 };
  const batchCache = {};

  function solve() {
    const p = runPerfusion(D, stop);
    const b = batchCache[N] || (batchCache[N] = runBatch(N));
    for (let j = 0; j < NS; j++) {
      tgt.px[j] = p.x[j]; tgt.pc[j] = p.c[j] / CMAX;
      tgt.bx[j] = b.x[j]; tgt.bc[j] = b.c[j] / CMAX;
    }
    pph = p.ph; bph = b.ph;
    totals = { pc: tgt.pc[NS - 1], bc: tgt.bc[NS - 1], pm: p.medium, bm: b.fills };
  }
  function snap() { KEYS.forEach(function (k) { cur[k].set(tgt[k]); }); }

  /* ---------------------------------------------------------------- drawing */
  let L = null, ctx = null, font = "sans-serif";
  const col = {};
  function readStyle() {
    const cs = getComputedStyle(card);
    const v = function (name, dflt) { const s = cs.getPropertyValue(name).trim(); return s || dflt; };
    font = cs.fontFamily || "sans-serif";
    col.perf = v("--pf-perf", "#23684a");
    col.batch = v("--pf-batch", "#8492a0");
    col.ink = v("--xp-ink", "#1f2933");
    col.ink2 = v("--xp-ink-2", "#556070");
    col.guide = v("--pf-guide", "#edf1ee");
    col.axis = v("--pf-axis", "#d5ddd8");
    const bg = getComputedStyle(stage).backgroundColor;
    col.bg = bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "#fbfcfb";
  }

  function layout() {
    const w = Math.round(stage.clientWidth);
    if (!w) return false;
    const phone = w < 520;
    const l = { w: w, phone: phone, fs: phone ? 11.5 : 12 };
    l.x0 = phone ? 12 : 18;
    l.x1 = w - (phone ? 76 : 98);
    l.aTop = 28; l.aBot = l.aTop + (phone ? 128 : 156);
    l.bTop = l.aBot + 44; l.bBot = l.bTop + (phone ? 78 : 90);
    l.h = l.bBot + 30;
    L = l;
    ctx = XP.dpr(canvas, w, l.h);
    return true;
  }
  function rgba(color, a) {                            // "#23684a" or "rgb(35, 104, 74)" with an alpha
    let r = 35, g = 104, b = 74;
    const hex = /^#([0-9a-f]{6})$/i.exec(color), rgb = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color);
    if (hex) { const n = parseInt(hex[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
    else if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; }
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function xOf(day) { return L.x0 + (L.x1 - L.x0) * day / T; }
  function yA(v) { return L.aBot - (L.aBot - L.aTop) * v / VMAX; }
  function yB(v) { return L.bBot - (L.bBot - L.bTop) * v / VMAX; }
  function crisp(v) { return Math.round(v) + 0.5; }

  let rev = 0, revT = 0, labA = 0, stopA = 0, armed = false;
  const REVEAL = 2.6;                                   // seconds for the curves to draw on
  // A new harvest cadence is a different batch schedule, not a reshaped curve, so the batch draws on again over the
  // old one as that fades (easing one sawtooth into another point by point makes humps that never existed).
  let bRev = 1, bRevT = 0, bLab = 1, ghostA = 0;
  const REDRAW = 1.3;
  const ghost = { bx: new Float32Array(NS), bc: new Float32Array(NS) };
  let hoverDay = null;

  function seg(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

  function path(c, arr, yf, upto) {
    const last = Math.floor(upto);
    c.beginPath();
    c.moveTo(xOf(0), yf(arr[0]));
    for (let j = 1; j <= last; j++) c.lineTo(xOf(j * DT_S), yf(arr[j]));
    if (upto > last && last + 1 < NS) {
      const f = upto - last, v = arr[last] + (arr[last + 1] - arr[last]) * f;
      c.lineTo(xOf((last + f) * DT_S), yf(v));
    }
  }
  function valAt(arr, upto) {
    const last = Math.floor(upto);
    if (last + 1 >= NS) return arr[NS - 1];
    return arr[last] + (arr[last + 1] - arr[last]) * (upto - last);
  }
  function dot(c, x, y, color, r) {
    c.fillStyle = col.bg; c.beginPath(); c.arc(x, y, r + 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  function title(c, main, rest, x, y) {
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.font = "600 " + L.fs + "px " + font; c.fillStyle = col.ink;
    c.fillText(main, x, y);
    const w = c.measureText(main).width;
    c.font = "500 " + L.fs + "px " + font; c.fillStyle = col.ink2;
    c.fillText(" · " + rest, x + w, y);
  }
  // two end labels in the right gutter, kept at least `gap` apart and inside their panel
  function labels(c, a, b, top, bot) {
    const gap = L.fs + 4;
    let ya = a.y, yb = b.y;
    if (Math.abs(ya - yb) < gap) {
      const mid = (ya + yb) / 2, up = ya <= yb;
      ya = mid + (up ? -gap / 2 : gap / 2); yb = mid + (up ? gap / 2 : -gap / 2);
    }
    const lo = top + L.fs / 2, hi = bot - L.fs / 2;
    const shift = Math.max(0, lo - Math.min(ya, yb)) - Math.max(0, Math.max(ya, yb) - hi);
    ya += shift; yb += shift;
    c.textAlign = "left"; c.textBaseline = "middle";
    c.globalAlpha = a.a;
    c.font = "600 " + (L.fs + 0.5) + "px " + font; c.fillStyle = col.ink;
    c.fillText(a.t, L.x1 + 13, ya);
    c.globalAlpha = b.a;
    c.font = "500 " + (L.fs + 0.5) + "px " + font; c.fillStyle = col.ink2;
    c.fillText(b.t, L.x1 + 13, yb);
    c.globalAlpha = 1;
  }

  function draw() {
    if (!L || !ctx) return;
    const c = ctx, l = L;
    c.clearRect(0, 0, l.w, l.h);
    c.lineCap = "round"; c.lineJoin = "round";

    title(c, "Cell density", "relative", l.x0, l.aTop - 12);
    title(c, "Protectant collected", "relative", l.x0, l.bTop - 12);

    // a hairline at each week, and the two baselines
    c.lineWidth = 1; c.strokeStyle = col.guide;
    [7, 14, 21, 28].forEach(function (d) {
      const x = crisp(xOf(d));
      seg(c, x, l.aTop, x, l.aBot); seg(c, x, l.bTop, x, l.bBot);
    });
    c.strokeStyle = col.axis;
    seg(c, l.x0, crisp(l.aBot), l.x1, crisp(l.aBot));
    seg(c, l.x0, crisp(l.bBot), l.x1, crisp(l.bBot));
    c.font = "500 " + l.fs + "px " + font; c.fillStyle = col.ink2; c.textBaseline = "alphabetic"; c.textAlign = "center";
    [0, 7, 14, 21, 28].forEach(function (d) { c.fillText(String(d), xOf(d), l.bBot + 19); });
    c.textAlign = "left"; c.fillText("days", l.x1 + 13, l.bBot + 19);

    // the medium switch: where the feed stops
    if (stopA > 0.01) {
      const x = crisp(xOf(STOP_DAY));
      c.globalAlpha = stopA;
      c.strokeStyle = col.ink2; c.lineWidth = 1; c.setLineDash([]);
      c.globalAlpha = stopA * 0.5; seg(c, x, l.aTop - 2, x, l.bBot);
      c.globalAlpha = stopA;
      c.font = "600 " + (l.fs - 0.5) + "px " + font; c.textAlign = "left"; c.textBaseline = "middle";
      c.lineWidth = 4; c.strokeStyle = col.bg; c.fillStyle = col.ink2;
      c.strokeText("medium stops", x + 6, l.aTop + 7); c.fillText("medium stops", x + 6, l.aTop + 7);
      c.globalAlpha = 1;
    }

    const upto = XP.ease(rev) * (NS - 1);
    if (upto > 0) {
      // a faint wash under the held culture, fading toward the baseline
      path(c, cur.px, yA, upto);
      c.lineTo(xOf(upto * DT_S), l.aBot); c.lineTo(xOf(0), l.aBot); c.closePath();
      if (!l.wash) {
        l.wash = c.createLinearGradient(0, l.aTop, 0, l.aBot);
        l.wash.addColorStop(0, rgba(col.perf, 0.14)); l.wash.addColorStop(1, rgba(col.perf, 0.02));
      }
      c.fillStyle = l.wash; c.fill();

      const uptoB = Math.min(upto, XP.ease(bRev) * (NS - 1));
      c.lineWidth = 2;
      if (ghostA > 0.01) {                              // the old harvest cadence, fading out
        c.globalAlpha = ghostA * 0.75; c.strokeStyle = col.batch;
        path(c, ghost.bx, yA, upto); c.stroke();
        path(c, ghost.bc, yB, upto); c.stroke();
        c.globalAlpha = 1;
      }
      if (uptoB > 0) { c.strokeStyle = col.batch; path(c, cur.bx, yA, uptoB); c.stroke(); }
      c.strokeStyle = col.perf; path(c, cur.px, yA, upto); c.stroke();
      if (uptoB > 0) { c.strokeStyle = col.batch; path(c, cur.bc, yB, uptoB); c.stroke(); }
      c.strokeStyle = col.perf; path(c, cur.pc, yB, upto); c.stroke();

      const hx = xOf(upto * DT_S), hb = xOf(uptoB * DT_S);
      if (uptoB > 0) dot(c, hb, yA(valAt(cur.bx, uptoB)), col.batch, 4);
      dot(c, hx, yA(valAt(cur.px, upto)), col.perf, 4);
      if (uptoB > 0) dot(c, hb, yB(valAt(cur.bc, uptoB)), col.batch, 4);
      dot(c, hx, yB(valAt(cur.pc, upto)), col.perf, 4);
    }
    if (labA > 0) {
      const e = NS - 1, ba = labA * bLab;
      labels(c, { t: "Perfusion", y: yA(cur.px[e]), a: labA }, { t: "Batch", y: yA(cur.bx[e]), a: ba }, l.aTop, l.aBot);
      labels(c, { t: "Perfusion", y: yB(cur.pc[e]), a: labA }, { t: "Batch", y: yB(cur.bc[e]), a: ba }, l.bTop, l.bBot);
    }

    // the crosshair: one day, both panels
    if (hoverDay != null && rev >= 1) {
      const j = Math.round(hoverDay / DT_S), x = crisp(xOf(j * DT_S));
      c.strokeStyle = col.ink2; c.lineWidth = 1; c.globalAlpha = 0.38;
      seg(c, x, l.aTop - 4, x, l.bBot); c.globalAlpha = 1;
      dot(c, x, yA(cur.bx[j]), col.batch, 3.5);
      dot(c, x, yA(cur.px[j]), col.perf, 3.5);
      dot(c, x, yB(cur.bc[j]), col.batch, 3.5);
      dot(c, x, yB(cur.pc[j]), col.perf, 3.5);
    }
  }

  /* ---------------------------------------------------------------- the hover narrator */
  const PERF_SAY = ["growing", "holding steady", ""];
  const BATCH_SAY = ["growing", "at its peak", "declining: nutrient spent", "harvested; turnaround, then a fresh start"];
  let tipRows = null;
  function buildTip() {
    if (!tip) return;
    tip.textContent = "";
    const b = document.createElement("b"); tip.appendChild(b);
    const rows = [["Perfusion", "perf"], ["Batch", "batch"]].map(function (r) {
      const s = document.createElement("span"); s.className = "r";
      const i = document.createElement("i"); i.style.background = col[r[1]];
      const t = document.createElement("span"); t.className = "t";
      const em = document.createElement("em");
      t.appendChild(document.createTextNode(r[0] + ": ")); t.appendChild(em);
      s.appendChild(i); s.appendChild(t); tip.appendChild(s);
      return em;
    });
    tipRows = { day: b, perf: rows[0], batch: rows[1] };
  }
  function perfSays(j) {
    const ph = pph[j];
    if (ph !== 2) return PERF_SAY[ph];
    if (stop && j * DT_S >= STOP_DAY - 1e-9) return "starving: the medium has stopped";
    if (D === 0) return "declining: no fresh medium";
    return "settling to what the medium can feed";
  }
  function showTip() {
    if (!tip || !tipRows || hoverDay == null || rev < 1) { if (tip) tip.classList.remove("on"); return; }
    const j = Math.round(hoverDay / DT_S);
    const day = j * DT_S;
    tipRows.day.textContent = "Day " + (day < 10 ? XP.fmt(day, 1) : Math.round(day));
    tipRows.perf.textContent = perfSays(j);
    tipRows.batch.textContent = BATCH_SAY[bph[j]];
    // beside the crosshair, inside the plot, so it never covers the end labels in the gutter
    const x = xOf(day), tw = tip.offsetWidth || 180;
    let left = x + 14;
    if (left + tw > L.x1 + 4) left = x - 14 - tw;
    if (left < 4) left = Math.min(4, L.w - tw - 4);
    tip.style.transform = "translate(" + Math.round(left) + "px," + Math.round(L.aTop + 10) + "px)";
    tip.classList.add("on");
  }

  /* ---------------------------------------------------------------- the readout */
  let readTimer = 0;
  function say(parts) {
    const box = document.createElement("span");          // one inline run, so the flex readout keeps it one paragraph
    parts.forEach(function (p) {
      if (typeof p === "string") box.appendChild(document.createTextNode(p));
      else { const b = document.createElement("b"); b.textContent = p.b; box.appendChild(b); }
    });
    read.textContent = "";
    read.appendChild(box);
  }
  function ratio(a, b) { return b > 1e-9 ? XP.fmt(a / b, 1) + "×" : "—"; }
  function writeRead() {
    if (!read) return;
    if (D === 0) {
      say(["At 0 no medium flows: the culture peaks and declines like a batch that is never harvested, and ",
           { b: "nothing is collected" }, "."]);
    } else if (stop) {
      say(["With the medium stopped on day 14 the culture starves and collection stops; over four weeks it still collects ",
           { b: ratio(totals.pc, totals.bc) }, " the batch\u2019s protectant."]);
    } else {
      say(["Over four weeks, from the same vessel, perfusion collects ", { b: ratio(totals.pc, totals.bc) },
           " the batch\u2019s protectant, for ", { b: ratio(totals.pm, totals.bm) }, " its fresh medium."]);
    }
  }
  function queueRead() { clearTimeout(readTimer); readTimer = setTimeout(writeRead, 280); }

  /* ---------------------------------------------------------------- motion */
  const loop = XP.loop(card, step);
  loop.stop();                                          // nothing to animate until the card is in view

  function ease(a) {
    let moving = false;
    for (let k = 0; k < 4; k++) {
      const c = cur[KEYS[k]], t = tgt[KEYS[k]];
      for (let j = 0; j < NS; j++) {
        const d = t[j] - c[j];
        if (d > 2e-4 || d < -2e-4) { c[j] += d * a; moving = true; } else c[j] = t[j];
      }
    }
    return moving;
  }
  function step(dt) {
    let busy = false;
    if (armed && rev < 1) { revT += dt; rev = Math.min(1, revT / REVEAL); busy = true; }
    if (rev >= 1 && labA < 1) { labA = Math.min(1, labA + dt / 0.5); busy = true; }
    if (bRev < 1) { bRevT += dt; bRev = Math.min(1, bRevT / REDRAW); busy = true; }
    if (ghostA > 0) { ghostA = Math.max(0, ghostA - dt / 0.55); busy = true; }
    if (bRev >= 1 && bLab < 1) { bLab = Math.min(1, bLab + dt / 0.35); busy = true; }
    const a = 1 - Math.exp(-dt * 7);
    if (ease(a)) busy = true;
    const s = stop ? 1 : 0;
    if (Math.abs(s - stopA) > 0.004) { stopA += (s - stopA) * a; busy = true; } else stopA = s;
    draw();
    if (hoverDay != null) showTip();
    if (!busy) loop.stop();
  }
  function settle() {
    if (XP.reduced) { snap(); stopA = stop ? 1 : 0; draw(); showTip(); }
    else loop.start();
  }

  /* ---------------------------------------------------------------- controls */
  function setRateText() {
    const txt = D === 0 ? "0 = batch" : D.toFixed(2);
    if (rateOut) rateOut.textContent = txt;
    rate.setAttribute("aria-valuetext", D === 0 ? "0: no medium exchange, a batch culture" : D.toFixed(2) + ", relative");
    if (stopBtn) {
      stopBtn.disabled = D === 0;
      stopBtn.title = D === 0 ? "No medium flows at a perfusion rate of 0" : "";
    }
  }
  function changed() { solve(); queueRead(); settle(); }

  rate.addEventListener("input", function () {
    D = Math.round(parseFloat(rate.value) * 100) / 100 || 0;
    setRateText(); changed();
  });
  cadBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      const n = +b.getAttribute("data-n");
      if (n === N) return;
      N = n;
      cadBtns.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      if (XP.reduced || rev < 1) { changed(); return; }
      if (bRev >= 1) { ghost.bx.set(cur.bx); ghost.bc.set(cur.bc); ghostA = 1; }   // mid-redraw: keep the first ghost
      solve();
      cur.bx.set(tgt.bx); cur.bc.set(tgt.bc);
      bRev = 0; bRevT = 0; bLab = 0;
      queueRead(); loop.start();
    });
  });
  if (stopBtn) stopBtn.addEventListener("click", function () {
    stop = !stop;
    stopBtn.setAttribute("aria-pressed", stop ? "true" : "false");
    changed();
  });

  function pointer(e) {
    if (!L) return;
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < L.x0 - 12 || px > L.x1 + 6) { leave(); return; }
    hoverDay = XP.clamp((px - L.x0) / (L.x1 - L.x0), 0, 1) * T;
    if (!loop.running) draw();
    showTip();
  }
  function leave() {
    if (hoverDay == null) return;
    hoverDay = null;
    if (tip) tip.classList.remove("on");
    if (!loop.running) draw();
  }
  canvas.addEventListener("pointermove", pointer);
  canvas.addEventListener("pointerdown", pointer);
  // a finger lifts as soon as it taps, so on touch the day stays shown until the next tap elsewhere
  canvas.addEventListener("pointerleave", function (e) { if (e.pointerType !== "touch") leave(); });
  canvas.addEventListener("pointercancel", leave);
  document.addEventListener("pointerdown", function (e) { if (e.target !== canvas) leave(); }, { passive: true });

  /* ---------------------------------------------------------------- start */
  readStyle();
  solve(); snap();
  setRateText(); writeRead();
  buildTip();
  if (XP.reduced) { rev = 1; labA = 1; }
  if (layout()) draw();

  if ("ResizeObserver" in window) {
    let lastW = stage.clientWidth;
    new ResizeObserver(function () {
      const w = stage.clientWidth;
      if (Math.abs(w - lastW) < 1) return;
      lastW = w;
      if (layout()) { draw(); if (hoverDay != null) showTip(); }
    }).observe(stage);
  }
  // draw on once a third of the drawing is on screen, not when it is still below the fold
  if ("IntersectionObserver" in window && !XP.reduced) {
    const io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting && !armed) { armed = true; io.disconnect(); loop.start(); }
      });
    }, { threshold: 0.33 });
    io.observe(canvas);
  } else { rev = 1; labA = 1; draw(); }
})();
