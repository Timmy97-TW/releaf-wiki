/* ===========================================================================
   7.3.2 · Four pressure ports, two alarms (15 Oct 2026; four situations to
   press since 17 Oct 2026). Markup: figure#xp-pressure, in the Future Plan.
   ---------------------------------------------------------------------------
   The membrane module with its four pressure transducers, one at each port
   (In-Lumen, Out-Lumen, In-Shell, Out-Shell), each behind a filter (owner,
   15 Oct), and the transmembrane pressure
       TMP = (P_in,L + P_out,L)/2 − (P_in,S + P_out,S)/2
   on a small chart. 17 Oct, the owner: the models looked "very complicated".
   The valve slider and four action buttons became four situations to press,
   Normal run, Membrane clogging, Fiber breaks, Fitting leaks, each played out
   from the normal run, with two alarm lights saying which planned layer
   catches it, and one plain sentence. Everything the card shows is PLANNED:
   neither alarm exists yet (7.3.2, 7.3.3), so the words are "planned", never
   "designed".

   On record, and the only measured numbers here:
     - the 4 September 2026 dashboard read feed, retentate and permeate each
       near 0.20 bar (4.1, 5.1, the dashboard photo in 4.3); P0 below;
     - the operating point 4.1 recommends: 263 mL/min at a TMP of 0.30 bar;
       the normal run holds that TMP (TMP_N below);
     - the transducers are fitted and logging (7.3.2); the alarms, the pump
       stop and the droplet sensor are the plan of 7.3.2 and 7.3.3: lumen
       pressure or TMP above a threshold for several readings in a row, or a
       sudden drop -> alarm, the culture pump stops, the pinch valve opens
       (a sudden drop: the run stops and a shell-side sample is plated, 6.1);
       any moisture under the unit -> alarm, pumps stop;
     - the owner's answers of 16 Oct 2026 (missing-info B10): (a) the valve that
       regulates the pressure is the one in the diagram, clamping the end of
       the lumen tube, past the Out-Lumen tap; (b) the four taps are right as
       drawn; (c) the In-Shell port is not capped: the two shell ports form a
       loop, and the loop branches out to the harvest line; (d) whether the
       harvest pump runs at a set flow is not known; (e) no alarm thresholds
       are set yet.
   Everything else is a MODEL with illustrative numbers: a peristaltic pump
   holds the loop flow, the valve adds a pressure drop downstream of the
   Out-Lumen tap, the wall passes liquid in proportion to TMP (Darcy) through a
   resistance that a cake raises as liquid is filtered (clogging: the valve
   closes further to hold the flow across the wall, as a set harvest flow
   would), the shell loop carries what crosses the wall round to the In-Shell
   port and its branch takes the excess out through a plain outlet line (an
   assumption: (d)), a broken fiber opens a short circuit to the shell, a leak
   drains the Out-Lumen fitting, a stopped pump lets every port fall back to
   P0. The alarm level (HIGH) and the sudden-drop rule (TMP below half of what
   it was 1.5 s before) are the model's own and illustrative: (e).

   Colours: the page's culture amber and protectant green (bv-contain.css);
   red is the alarm and nothing else.

   Uses window.XP (../js/xp-kit.js): XP.loop pauses off screen and in hidden tabs;
   with reduced motion each situation lands at once on its outcome (no rolling,
   no drips in flight), chart included, and the buttons still work. The script
   builds its own buttons, readout and lights into .xps-pick and .xps-panel.
   =========================================================================== */
(function () {
  "use strict";
  var XP = window.XP;
  var fig = document.getElementById("xp-pressure");
  if (!XP || !fig) return;
  var box = fig.querySelector(".xps-draw");
  var cv = fig.querySelector(".xps-canvas");
  var stageEl = fig.querySelector(".xp-stage");
  if (!box || !cv || !cv.getContext || !stageEl) return;

  /* ---- the record ---- */
  var P0 = 0.20;          // bar: feed, retentate and permeate on the 4 Sep 2026 dashboard (4.1, 5.1)
  var TMP_N = 0.30;       // bar: the operating point 4.1 recommends (263 mL/min at a TMP of 0.30 bar)

  /* ---- the model's constants (illustrative) ---- */
  var DELTA = 0.003;      // bar: pressure drop along the fibers at the loop flow
  var RS = 0.06;          // shell outlet line: bar per unit of flow across the wall (keeps the shell near P0)
  var KV = 1.2;           // bar: the valve's pressure rise, scaled by closure^1.6
  var CMAX = 0.9;         // the valve stops at 90 % closed
  var GB = 25;            // a broken fiber: conductance of the short circuit to the shell
  var GL = 0.06;          // a leak at the Out-Lumen fitting, to the bench
  var ALPHA = 0.035;      // cake: wall resistance gained per unit flow per hour
  var FF_H = 72, FF_S = 6.5;  // clogging: up to 72 h of run, played in 6.5 s
  var HIGH = 0.45;        // bar: the alarm level drawn here, illustrative (none is set yet)
  var DROP = 0.5;         // the sudden-drop rule: TMP under half of what it was DROP_S before
  var DROP_S = 1.5;
  var LEAD = 0.9;         // s: the normal run shown before a fault starts
  var GMAX = 1.0;         // bar: full scale of the dials
  var YMAX = 0.6;         // bar: top of the TMP chart
  var WIN = 10;           // s: the chart's window

  var C = {
    lumen: "#b8650f", lumenTube: "#e9b77a", lumenFill: "#fbe8cf",
    shell: "#1b6b3f", shellTube: "#8cc4a2", shellFill: "#e1f1e7", shellSpace: "#f1f8f4",
    perm: "#23864f", part: "#8795a3", partFill: "#eef1f4", head: "#dfe4e9",
    ink: "#1f2933", ink2: "#556070", ink3: "#7a8591",
    alarm: "#c62828", alarmFill: "#fdecec", cake: "#a08f7a", grid: "#e6eae8", line: "#1b6b3f",
    halo: "rgba(255,255,255,.9)"
  };
  var FONT = (getComputedStyle(fig).getPropertyValue("--sans") || "").trim() || "-apple-system, system-ui, sans-serif";
  var MONO = (getComputedStyle(fig).getPropertyValue("--mono") || "").trim() || "ui-monospace, Menlo, monospace";

  /* ---- the four situations, and what each one shows, in words ---- */
  var SITS = [
    { id: "normal", name: "Normal run",
      icon: '<path d="M1.5 9.5h13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M1.5 5.5h13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>' },
    { id: "clog", name: "Membrane clogging",
      icon: '<path d="M1.5 12.5c4 0 6-1 8-4s3-5 5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: "breach", name: "Fiber breaks",
      icon: '<path d="M1.5 4.5h5l1.5 2-1 2 1.5 2h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    { id: "leak", name: "Fitting leaks",
      icon: '<path d="M8 1.8c2.4 3.1 4 5.3 4 7.4a4 4 0 0 1-8 0c0-2.1 1.6-4.3 4-7.4z" fill="currentColor"/>' }
  ];
  function b2(v) { return Math.max(0, v).toFixed(2); }

  /* ---- the flow model ----
     A peristaltic pump holds the loop flow Q = 1. The Out-Lumen node drains through the valve (pressure rise
     Kv·Q_v above the downstream P0) and, with a leak, to the bench (Gl·P_out,L). The wall passes J = TMP·G, with
     G = 1/Rw (+ Gb for a broken fiber); the shell outlet line sits RS·J above P0. Solved exactly for TMP:   */
  function kv(c) { return KV * Math.pow(Math.max(0, c), 1.6); }
  function solve(c, Rw, gb, gl) {
    var Kv = kv(c), G = 1 / Rw + gb, re = 1.1 * RS, D = 1 + Kv * gl;
    var tmp = (Kv + DELTA * D / 2 - P0 * Kv * gl) / ((1 + re * G) * D + Kv * G);
    var J = tmp * G;
    var A = (P0 + Kv - Kv * J) / D;
    return { pinL: A + DELTA, poutL: A, pinS: P0 + 1.2 * RS * J, poutS: P0 + RS * J,
             tmp: tmp, jm: tmp / Rw, jb: tmp * gb };
  }
  /* the valve setting that holds the flow across the membrane at J0 (clogging) */
  function holdValve(J0, Rw, gb, gl) {
    var lo = 0, hi = CMAX;
    if (solve(hi, Rw, gb, gl).jm < J0) return hi;
    for (var i = 0; i < 32; i++) { var m = (lo + hi) / 2; if (solve(m, Rw, gb, gl).jm < J0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  /* the valve setting of the normal run: TMP_N on a clean wall */
  var C_N = (function () {
    var lo = 0, hi = CMAX;
    for (var i = 0; i < 40; i++) { var m = (lo + hi) / 2; if (solve(m, 1, 0, 0).tmp < TMP_N) lo = m; else hi = m; }
    return (lo + hi) / 2;
  })();

  /* ---- the controls and the readout (built here; the old markup's own row, sum and chart box retire) ---- */
  var pick = fig.querySelector(".xps-pick");
  var panel = fig.querySelector(".xps-panel");
  var status = fig.querySelector(".xps-status");
  if (!pick) return;
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "xps-panel xps-live";
    box.parentNode.insertBefore(panel, box.nextSibling);
  }
  if (!status) {
    status = document.createElement("p");
    status.className = "xps-status xps-live";
    stageEl.parentNode.insertBefore(status, stageEl.nextSibling);
  }
  status.setAttribute("aria-live", "polite");
  pick.setAttribute("role", "group");
  pick.setAttribute("aria-label", "Situation");
  pick.innerHTML = '<span class="xps-pick-k" aria-hidden="true">Situation</span><span class="xps-opts">' + SITS.map(function (s) {
    return '<button type="button" class="xps-opt" data-s="' + s.id + '" aria-pressed="false"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' + s.icon + "</svg><span>" + s.name + "</span></button>";
  }).join("") + "</span>" +
    '<span class="xps-tools"><button type="button" class="xp-btn xps-again"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.6 2.4v3h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Run again</span></button></span>';
  panel.innerHTML =
    '<div class="xps-tmpbox">' +
      '<p class="xps-k">TMP <span>how hard the culture side pushes on the wall</span></p>' +
      '<p class="xps-v"><b class="xps-tmp">0.30</b> bar</p>' +
      '<canvas class="xps-chart" role="img" aria-label="TMP over the last seconds, in bar, against the alarm level. The value now is printed above."></canvas>' +
    "</div>" +
    '<div class="xps-lamps">' +
      '<div class="xps-lamp" data-l="p"><i aria-hidden="true"></i><span><b>Pressure alarm</b><small>Layer&nbsp;1 &middot; planned</small></span><em>quiet</em></div>' +
      '<div class="xps-lamp" data-l="w"><i aria-hidden="true"></i><span><b>Droplet sensor</b><small>Layer&nbsp;2 &middot; planned</small></span><em>dry</em></div>' +
    "</div>";
  var opts = Array.prototype.slice.call(pick.querySelectorAll(".xps-opt"));
  var again = pick.querySelector(".xps-again");
  var ch = panel.querySelector(".xps-chart");
  var tmpEl = panel.querySelector(".xps-tmp");
  var lampP = panel.querySelector('[data-l="p"]'), lampW = panel.querySelector('[data-l="w"]');

  /* ---- state ---- */
  var M, disp, hist, events, parts, drops, recent, still = XP.reduced, sit = "normal";
  function fresh() {
    M = { c: C_N, Rw: 1, gb: 0, gbT: 0, gl: 0, glT: 0, pump: 1, pumpT: 1, open: false, t: 0, st: 0, wet: 0,
          phase: 0, ff: false, ffT0: 0, J0: 0, tmpRef: TMP_N, aP: "", aW: false, highFor: 0, stopAt: 0,
          ct: 0, doneAt: 0, lastH: -1, dropAcc: 0, permAcc: 0, brAcc: 0 };
    var s = solve(M.c, 1, 0, 0);
    disp = { pinL: s.pinL, poutL: s.poutL, pinS: s.pinS, poutS: s.poutS, tmp: s.tmp, jm: s.jm };
    hist = []; events = []; parts = []; drops = []; recent = [];
    for (var i = 0; i <= 80; i++) hist.push({ t: -WIN + i * WIN / 80, v: s.tmp });   // the run so far, steady
    for (var k = 0; k < 14; k++) parts.push({ kind: 0, x: k / 14, f: k % 4, y: 0 });
  }

  /* ---- layout of the drawing, recomputed on width change ---- */
  var ctx = null, L = {}, cctx = null, CW = 0, CH = 0;
  function layout() {
    var W = Math.max(300, Math.round(box.clientWidth));
    var ph = W < 560;
    L = { W: W, ph: ph };
    L.H = ph ? 296 : 236;
    L.g = ph ? 20 : 23;
    L.y = ph ? 148 : 126;                 // the lumen line, through the module's axis
    L.mh = ph ? 52 : 56;
    L.my0 = L.y - L.mh / 2; L.my1 = L.y + L.mh / 2;
    L.mx0 = ph ? 70 : Math.round(W * 0.22);
    L.mx1 = ph ? W - 96 : Math.round(W * 0.72);
    L.hw = ph ? 11 : 15;                  // the potted headers at each end
    L.tapIn = ph ? 34 : Math.round(L.mx0 - W * 0.095);
    L.tapOut = ph ? L.mx1 + 34 : Math.round(L.mx1 + W * 0.075);
    L.vx = ph ? L.tapOut + 28 : Math.round(L.tapOut + W * 0.072);
    L.sIn = L.mx0 + (ph ? 32 : 64);
    L.sOut = L.mx1 - (ph ? 32 : 64);
    L.gTop = ph ? 48 : 44;
    L.gBot = ph ? 236 : 191;
    L.fTop = L.my0 - (ph ? 22 : 24);      // the filters on the shell lines
    L.fBot = L.y + (ph ? 40 : 34);        // and on the lumen lines
    L.hy = L.my0 - 9;                     // the harvest line leaves the Out-Shell line here
    L.padY = L.my1 + (ph ? 52 : 35);
    L.px0 = L.mx0 - 12; L.px1 = L.mx1 + (ph ? 12 : 22);
    L.leakX = L.mx1 + 6;
    L.nf = ph ? 3 : 4;
    L.ft = ph ? 7 : 8;
    L.fy = [];
    for (var i = 0; i < L.nf; i++) L.fy.push(L.my0 + 11 + (L.mh - 22) * (L.nf === 1 ? 0.5 : i / (L.nf - 1)));
    L.bx = L.mx0 + (L.mx1 - L.mx0) * 0.44; L.bf = 1;   // where a fiber breaks: fiber 2
    ctx = XP.dpr(cv, W, L.H);
    var bs = getComputedStyle(ch.parentNode);
    CW = Math.max(220, Math.round(ch.parentNode.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight)));
    CH = ph ? 104 : 96;
    cctx = XP.dpr(ch, CW, CH);
  }

  /* ---- small drawing helpers ---- */
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function text(c, str, x, y, o) {
    c.font = (o.weight || 600) + " " + (o.size || 11) + "px " + (o.mono ? MONO : FONT);
    c.textAlign = o.align || "left"; c.textBaseline = "alphabetic";
    if (o.halo !== false) { c.lineJoin = "round"; c.lineWidth = 3.5; c.strokeStyle = C.halo; c.strokeText(str, x, y); }
    c.fillStyle = o.color || C.ink; c.fillText(str, x, y);
  }
  function tube(x0, y0, x1, y1, outer, inner) {
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = 7; ctx.strokeStyle = outer; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = 4; ctx.strokeStyle = inner; ctx.stroke();
  }
  function line(x0, y0, x1, y1) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = 1.6; ctx.strokeStyle = C.part; ctx.lineCap = "round"; ctx.stroke();
  }
  function filter(x, y) {
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 6.2832); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = C.part; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3.2, y); ctx.lineTo(x + 3.2, y); ctx.moveTo(x, y - 3.2); ctx.lineTo(x, y + 3.2);
    ctx.lineWidth = 1; ctx.stroke();
  }
  function arrow(x, y, dir, col) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7 * dir, y - 4.5); ctx.lineTo(x - 7 * dir, y + 4.5); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }
  function gauge(x, y, r, v, name, side, above) {
    var a0 = Math.PI * 5 / 6, sw = Math.PI * 4 / 3, col = side === "L" ? C.lumen : C.shell;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = "#c3ccd5"; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r - 5, a0, a0 + sw); ctx.lineWidth = 1.6; ctx.strokeStyle = "#d3dae0"; ctx.stroke();
    for (var i = 0; i <= 10; i++) {
      var a = a0 + sw * i / 10, l = i % 5 === 0 ? 4.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 5), y + Math.sin(a) * (r - 5));
      ctx.lineTo(x + Math.cos(a) * (r - 5 - l), y + Math.sin(a) * (r - 5 - l));
      ctx.lineWidth = i % 5 === 0 ? 1.4 : 1; ctx.strokeStyle = "#a9b4be"; ctx.stroke();
    }
    var an = a0 + sw * XP.clamp(v / GMAX, 0, 1);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * (r - 7), y + Math.sin(an) * (r - 7));
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = col; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.7, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
    text(ctx, v.toFixed(2), x, y + r * 0.78, { size: L.ph ? 11.5 : 12, weight: 650, mono: true, align: "center", halo: false });
    var ny = above ? y - r - 7 : y + r + 15;
    var tw = (ctx.measureText(name).width || 50) / 2, nx = XP.clamp(x, tw + 3, L.W - tw - 3);
    text(ctx, name, nx, ny, { size: 11, weight: 650, color: C.ink2, align: "center" });
  }
  function pill(str, x, y, col) {
    ctx.font = "700 10.5px " + FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0.8px";
    var w = ctx.measureText(str).width + 30, h = 20;
    x = XP.clamp(x, w / 2 + 2, L.W - w / 2 - 2);
    rr(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.fillStyle = col || C.alarm; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    var tx = x - w / 2 + 9;                                   // a small warning triangle, then the word
    ctx.beginPath(); ctx.moveTo(tx + 4.5, y - 5); ctx.lineTo(tx + 9.5, y + 4.5); ctx.lineTo(tx - 0.5, y + 4.5); ctx.closePath();
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(str, tx + 14, y + 0.5);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.textBaseline = "alphabetic";
  }
  function capsule(c, x, y, th, len, w) {
    var r = w / 2, h = Math.max(0, len / 2 - r), co = Math.cos(th), si = Math.sin(th);
    c.beginPath();
    c.moveTo(x - co * h + si * r, y - si * h - co * r);
    c.lineTo(x + co * h + si * r, y + si * h - co * r);
    c.arc(x + co * h, y + si * h, r, th - Math.PI / 2, th + Math.PI / 2);
    c.lineTo(x - co * h - si * r, y - si * h + co * r);
    c.arc(x - co * h, y - si * h, r, th + Math.PI / 2, th + Math.PI * 1.5);
    c.closePath();
  }

  /* ---- particles: culture round the lumen, permeate out through the shell ---- */
  function lumenXY(p) {
    // p.x in 0..1 along: inlet (0..a), header, fiber, header, outlet (b..1)
    var x = p.x * L.W, fy = L.fy[p.f % L.nf], y;
    if (x < L.mx0) y = L.y;
    else if (x < L.mx0 + L.hw) y = XP.lerp(L.y, fy, (x - L.mx0) / L.hw);
    else if (x < L.mx1 - L.hw) y = fy;
    else if (x < L.mx1) y = XP.lerp(fy, L.y, (x - (L.mx1 - L.hw)) / L.hw);
    else y = L.y;
    return [x, y];
  }
  function spawnPerm(kind) {
    var f, x, y;
    if (kind === 2) { f = L.bf; x = L.bx; y = L.fy[f] - L.ft / 2; }
    else {
      f = Math.floor(Math.random() * L.nf);
      x = XP.lerp(L.mx0 + L.hw + 6, L.mx1 - L.hw - 6, Math.random());
      y = L.fy[f] + (Math.random() < 0.5 ? -1 : 1) * (L.ft / 2 + 0.5);
    }
    if (kind === 2) x += (Math.random() - 0.5) * 8;
    parts.push({ kind: kind, x: x, y: y, st: 0, vx: (Math.random() - 0.5) * (kind === 2 ? 40 : 10),
                 vy: (y < L.fy[f] ? -1 : 1) * (kind === 2 ? 8 + Math.random() * 16 : 14),
                 ox: (Math.random() - 0.5) * (L.mx1 - L.mx0) * 0.5, th: Math.random() * 3, life: 0 });
  }
  function stepParts(dt) {
    var keep = [], sp = (L.ph ? 54 : 70) * M.pump, out = L.W - 6, go = M.pump;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.kind === 0) {                                     // culture, round the loop
        p.x += dt * sp / L.W;
        if (p.x * L.W > out) { p.x = 6 / L.W; p.f = (p.f + 1) % 4; }
        keep.push(p); continue;
      }
      var dts = dt * Math.max(0.15, go);
      p.life += dts;
      if (p.st === 0) {                                       // in the shell space, drawn to the Out-Shell port
        var far = Math.abs(L.sOut - p.x) > 26, tx = L.sOut + (far ? p.ox * 0.6 : 0), ty = far ? L.y : L.my0 + 2;
        var dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var w = p.life < 0.35 ? 0 : 1, sp2 = (p.kind === 2 ? 30 : 46) * go;
        if (far && Math.abs(dx) < 10) { p.ox *= 0.5; }
        p.vx += ((dx / d) * sp2 * w - p.vx) * Math.min(1, dt * 2.2) + (Math.random() - 0.5) * 60 * dts;
        p.vy += ((dy / d) * sp2 * w * (far ? 0.25 : 1) - p.vy) * Math.min(1, dt * 2.2) + (Math.random() - 0.5) * 60 * dts;
        p.x += p.vx * dts; p.y += p.vy * dts;
        p.x = XP.clamp(p.x, L.mx0 + L.hw + 2, L.mx1 - L.hw - 2);
        p.y = XP.clamp(p.y, L.my0 + 2, L.my1 - 2);
        if (Math.abs(p.x - tx) < 5 && p.y < L.my0 + 6) { p.st = 1; p.x = tx; p.y = L.my0; }
      } else if (p.st === 1) {                                // up the Out-Shell port into the shell loop
        p.y -= dts * 40;
        // at the loop: most of it out along the branch to harvest, some round the loop and back into the shell
        if (p.y <= L.hy) { p.st = p.kind === 1 && Math.random() < 0.4 ? 3 : 2; p.y = L.hy; }
      } else if (p.st === 3) {                                // round the loop, to the In-Shell port
        p.x -= dts * 60;
        if (p.x <= L.sIn) { p.x = L.sIn; p.st = 4; }
      } else if (p.st === 4) {                                // down the In-Shell port, back into the shell space
        p.y += dts * 40;
        if (p.y >= L.my0 + 4) { p.st = 0; p.life = 0; p.ox = (Math.random() - 0.5) * (L.mx1 - L.mx0) * 0.5; }
      } else {                                                // along the harvest branch, out of the picture
        p.x += dts * 60;
        if (p.x > out) continue;
      }
      keep.push(p);
    }
    parts = keep;
  }

  /* ---- the words ---- */
  var ALARM = '<svg class="xps-warn" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.6 15 14H1z" fill="currentColor"/><path d="M8 6v3.6M8 11.6v.1" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var OKMARK = '<svg class="xps-okm" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var lastSay = "";
  function say(html, kind) {
    var full = (kind === "alarm" ? ALARM : kind === "ok" ? OKMARK : "") + "<span>" + html + "</span>";
    if (full === lastSay) return;
    lastSay = full; status.innerHTML = full;
    status.classList.toggle("is-alarm", kind === "alarm");
    status.classList.toggle("is-ok", kind === "ok");
  }
  function lamps() {
    var p = M.aP, w = M.aW;
    lampP.classList.toggle("is-on", !!p);
    lampW.classList.toggle("is-on", w);
    lampP.querySelector("em").textContent = p === "high" ? "alarm: TMP too high" : p === "drop" ? "alarm: sudden drop" : "quiet";
    lampW.querySelector("em").textContent = w ? "alarm: liquid" : "dry";
  }
  function intro() {
    if (sit === "normal") say("<b>Normal run.</b> The culture side pushes on the wall about 0.30&nbsp;bar harder than the shell side (that push is the TMP), so liquid crosses into the shell at a steady rate. Both planned alarms stay quiet.", "ok");
    else if (sit === "clog") say("<b>Membrane clogging.</b> The run carries on as normal for a moment&hellip;");
    else if (sit === "breach") say("<b>Fiber breaks.</b> The run carries on as normal for a moment&hellip;");
    else say("<b>Fitting leaks.</b> The run carries on as normal for a moment&hellip;");
  }

  /* ---- one model step; dt is real seconds ---- */
  function addEvent(kind, label) {
    events.push({ t: M.st, kind: kind, label: label || "" });
    // once an alarm has fired, the chart runs on for a few seconds, then holds the whole story still
    if (kind === "alarm") M.doneAt = M.st + 3;
  }
  function fire(kind) {
    if (kind === "high") {
      M.aP = "high"; M.ff = false; M.pumpT = 0; M.open = true;
      addEvent("alarm");
      say("<b>Pressure alarm (Layer&nbsp;1, planned).</b> A layer of cells and debris has built up on the wall, so the culture side had to push harder and TMP climbed past the alarm level. The planned controller sounds the alarm, stops the culture pump and opens the pinch valve. Clogging shows as a slow rise, long before anything breaks.", "alarm");
    } else if (kind === "drop") {
      M.aP = "drop"; M.stopAt = M.st + 0.9;
      addEvent("alarm");
      say("<b>Pressure alarm (Layer&nbsp;1, planned).</b> TMP fell suddenly, from about " + b2(M.tmpRef) + " to " + b2(disp.tmp) + "&nbsp;bar: the two sides&rsquo; pressures met through the broken fiber. A sudden drop can mean the membrane has given way, so the run stops and a shell&#8209;side sample is plated to check (<a href=\"#sec61\">6.1</a>).", "alarm");
    } else if (kind === "wet") {
      M.aW = true; M.pumpT = 0;
      addEvent("alarm");
      var dT = Math.abs(disp.tmp - M.tmpRef);
      say("<b>Droplet alarm (Layer&nbsp;2, planned).</b> The pressures hardly moved (TMP changed by " + (dT < 0.01 ? "less than 0.01" : "only " + b2(dT)) + "&nbsp;bar), so the pressure alarm cannot see this one. The droplet sensor under the setup feels the liquid and the pumps stop. The two layers watch different failures.", "alarm");
    }
    lamps();
  }
  function tick(dt, quick) {
    M.st += dt;
    var speed = 1;
    // the situation's script: the normal run first, then the fault
    if (M.phase === 0 && sit !== "normal" && M.st >= LEAD) {
      M.phase = 1;
      M.tmpRef = disp.tmp;
      if (sit === "clog") {
        M.ff = true; M.ffT0 = M.t; M.J0 = solve(M.c, M.Rw, 0, 0).jm;
        addEvent("mark", "fast-forward");
        say("<b>Fast&#8209;forwarding a long run&hellip;</b> Cells and debris slowly build up on the fiber walls, so the culture side has to push harder to keep the harvest flowing: watch TMP climb toward the alarm level.");
      } else if (sit === "breach") {
        M.gbT = GB;
        addEvent("mark", "fiber breaks");
        say("<b>A fiber breaks.</b> Culture now flows straight into the shell side, so the lumen and shell pressures move toward each other&hellip;");
      } else if (sit === "leak") {
        M.glT = GL;
        addEvent("mark", "leak");
        say("<b>A fitting leaks.</b> Culture drips from the Out&#8209;Lumen fitting onto the bench&hellip;");
      }
    }
    if (M.ff) speed = FF_H * 3600 / FF_S;
    var dm = dt * speed;
    M.t += dm;

    // a break or a leak opens quickly but not in a single frame; a stopped pump runs down; an opened valve opens
    var k = quick ? 1 : Math.min(1, dt * 6);
    M.gb += (M.gbT - M.gb) * k;
    M.gl += (M.glT - M.gl) * k;
    M.pump += (M.pumpT - M.pump) * (quick ? 1 : Math.min(1, dt * 2.4));
    if (M.open) M.c += (0 - M.c) * (quick ? 1 : Math.min(1, dt * 3));
    if (M.stopAt && M.st >= M.stopAt) { M.pumpT = 0; M.stopAt = 0; }

    var s = solve(M.c, M.Rw, M.gb, M.gl);
    if (M.ff) {
      M.Rw += ALPHA * s.jm * dm / 3600;                      // the cake grows with the liquid filtered
      M.c = holdValve(M.J0, M.Rw, M.gb, M.gl);
      s = solve(M.c, M.Rw, M.gb, M.gl);
      if (M.t - M.ffT0 >= FF_H * 3600) M.ff = false;
    }
    // a stopped pump: every port falls back to P0, nothing crosses the wall
    var q = M.pump, r = {
      pinL: P0 + (s.pinL - P0) * q, poutL: P0 + (s.poutL - P0) * q, pinS: P0 + (s.pinS - P0) * q, poutS: P0 + (s.poutS - P0) * q,
      tmp: s.tmp * q, jm: s.jm * q };
    // the transducers read with a short lag (none with reduced motion)
    var a = quick ? 1 : 1 - Math.exp(-dt / 0.3);
    ["pinL", "poutL", "pinS", "poutS", "tmp", "jm"].forEach(function (key) { disp[key] += (r[key] - disp[key]) * a; });

    // Layer 1, as planned: TMP above the alarm level for a few readings in a row, or a sudden drop
    recent.push({ t: M.st, v: disp.tmp });
    while (recent.length > 2 && recent[1].t < M.st - DROP_S) recent.shift();
    if (!M.aP && !M.aW && M.pumpT > 0) {
      if (disp.tmp > HIGH) { M.highFor += dt; if (M.highFor >= 0.3) fire("high"); } else M.highFor = 0;
      var then = recent[0];
      if (!M.aP && then && M.st - then.t >= DROP_S * 0.9 && then.v > 0.1 && disp.tmp < DROP * then.v) fire("drop");
    }

    // Layer 2, as planned: drips land on the droplet sensor under the setup
    if (M.glT && M.pump > 0.25) {
      if (quick) M.wet = Math.min(1, M.wet + dt * 0.3);
      else { M.dropAcc += dt; if (M.dropAcc > 0.42) { M.dropAcc = 0; drops.push({ y: L.y + 5, v: 0 }); } }
    }
    if (!quick) {
      var keepD = [];
      drops.forEach(function (d) { d.v += 900 * dt; d.y += d.v * dt; if (d.y >= L.padY - 1) M.wet = Math.min(1, M.wet + 0.14); else keepD.push(d); });
      drops = keepD;
    }
    if (!M.aW && !M.aP && M.wet >= 0.3) fire("wet");

    // particles
    if (!quick) {
      M.permAcc += dt * Math.min(30, disp.jm * 70);
      while (M.permAcc >= 1) { M.permAcc -= 1; if (parts.length < 90) spawnPerm(1); }
      if (M.gb > 1 && M.pump > 0.2) { M.brAcc += dt * 3.5; while (M.brAcc >= 1) { M.brAcc -= 1; if (parts.length < 110) spawnPerm(2); } }
      stepParts(dt);
    }

    // the chart: a sample every 50 ms of the situation, until it has played out
    if (!M.doneAt || M.st <= M.doneAt) {
      M.ct = M.st;
      if (M.st - M.lastH >= 0.05) {
        M.lastH = M.st;
        hist.push({ t: M.st, v: disp.tmp });
        while (hist.length > 2 && hist[1].t < M.st - WIN * 1.05) hist.shift();
      }
    }
  }

  /* ---- drawing ---- */
  function drawScene() {
    var W = L.W, i, s = disp;
    ctx.clearRect(0, 0, W, L.H);

    // the droplet sensor under the whole setup: planned (7.3.3)
    rr(ctx, L.px0, L.padY, L.px1 - L.px0, 8, 4);
    ctx.fillStyle = M.aW ? C.alarmFill : C.partFill; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = M.aW ? C.alarm : C.part;
    if (!M.aW && ctx.setLineDash) ctx.setLineDash([4, 3]);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(L.px0 + 10, L.padY + 4, 2.6, 0, 6.2832); ctx.fillStyle = M.aW ? C.alarm : C.part; ctx.fill();
    if (M.wet > 0) {
      ctx.beginPath(); ctx.ellipse(L.leakX, L.padY - 0.5, 4 + 26 * M.wet, 2.2 + 1.6 * M.wet, 0, Math.PI, 0);
      ctx.fillStyle = "rgba(224, 138, 34, .45)"; ctx.fill();
    }
    if (M.aW) text(ctx, "droplet sensor: liquid", (L.px0 + L.px1) / 2, L.padY + 22, { size: 11, weight: 700, color: C.alarm, align: "center" });
    else text(ctx, "droplet sensor (planned)", (L.px0 + L.px1) / 2, L.padY + 22, { size: 11, weight: 600, color: C.ink2, align: "center" });

    // the lumen lines: in from the pump, out through the valve
    tube(4, L.y, L.mx0, L.y, C.lumenTube, C.lumenFill);
    tube(L.mx1, L.y, W - 6, L.y, C.lumenTube, C.lumenFill);
    arrow(W - 2, L.y, 1, C.lumenTube);
    text(ctx, "from pump", 6, L.y - 10, { size: 11, weight: 500, color: C.ink3 });
    if (!L.ph) text(ctx, "to reservoir", W - 4, L.y + 21, { size: 11, weight: 500, color: C.ink3, align: "right" });
    else { text(ctx, "to", W - 4, L.y + 21, { size: 11, weight: 500, color: C.ink3, align: "right" });
           text(ctx, "reservoir", W - 4, L.y + 34, { size: 11, weight: 500, color: C.ink3, align: "right" }); }

    // the shell loop (the owner, 16 Oct: the In-Shell port is not capped; the shell ports form a loop, then branch
    // out): out of the Out-Shell port, back over the module into the In-Shell port, and the branch to harvest
    var shellLines = function (w, col) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = w; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(L.sOut, L.my0); ctx.lineTo(L.sOut, L.hy); ctx.lineTo(L.sIn, L.hy); ctx.lineTo(L.sIn, L.my0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L.sOut, L.hy); ctx.lineTo(W - 6, L.hy); ctx.stroke();
    };
    shellLines(7, C.shellTube); shellLines(4, C.shellFill);
    var chX = L.sIn + (L.sOut - L.sIn) * 0.3;                 // the loop runs back toward the In-Shell port
    ctx.beginPath(); ctx.moveTo(chX + 3, L.hy - 3.4); ctx.lineTo(chX - 1.6, L.hy); ctx.lineTo(chX + 3, L.hy + 3.4);
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.shell; ctx.stroke();
    text(ctx, "shell loop", (L.sIn + L.sOut) / 2, L.hy - 7, { size: 11, weight: 500, color: C.ink3, align: "center" });
    arrow(W - 2, L.hy, 1, C.shellTube);
    text(ctx, "to harvest", W - 4, L.hy - 9, { size: 11, weight: 500, color: C.ink3, align: "right" });

    // the module: shell space, potted headers, fibers
    var alarmP = !!M.aP;
    rr(ctx, L.mx0, L.my0, L.mx1 - L.mx0, L.mh, 12);
    ctx.fillStyle = C.shellSpace; ctx.fill();
    ctx.lineWidth = alarmP ? 2.2 : 1.5; ctx.strokeStyle = alarmP ? C.alarm : C.part; ctx.stroke();
    ctx.save(); rr(ctx, L.mx0, L.my0, L.mx1 - L.mx0, L.mh, 12); ctx.clip();
    ctx.fillStyle = C.head; ctx.fillRect(L.mx0, L.my0, L.hw, L.mh); ctx.fillRect(L.mx1 - L.hw, L.my0, L.hw, L.mh);
    ctx.restore();
    var cake = XP.clamp((M.Rw - 1) / 0.8, 0, 1) * (L.ft / 2 - 1);
    for (i = 0; i < L.nf; i++) {
      var fy = L.fy[i];
      rr(ctx, L.mx0 + 2, fy - L.ft / 2, L.mx1 - L.mx0 - 4, L.ft, L.ft / 2);
      ctx.fillStyle = C.lumenFill; ctx.fill();
      if (cake > 0.2) {
        ctx.fillStyle = C.cake;
        ctx.fillRect(L.mx0 + L.hw, fy - L.ft / 2 + 0.8, L.mx1 - L.mx0 - 2 * L.hw, cake);
        ctx.fillRect(L.mx0 + L.hw, fy + L.ft / 2 - 0.8 - cake, L.mx1 - L.mx0 - 2 * L.hw, cake);
      }
      rr(ctx, L.mx0 + 2, fy - L.ft / 2, L.mx1 - L.mx0 - 4, L.ft, L.ft / 2);
      ctx.lineWidth = 1; ctx.strokeStyle = C.lumen; ctx.stroke();
    }
    if (M.gbT) {                                              // the break: a split in one fiber's wall
      var by = L.fy[L.bf] - L.ft / 2;
      ctx.fillStyle = C.shellSpace; ctx.fillRect(L.bx - 3, by - 1.5, 6, 3);
      ctx.beginPath(); ctx.arc(L.bx, by, 7.5, 0, 6.2832); ctx.lineWidth = 1.6; ctx.strokeStyle = C.alarm; ctx.stroke();
    }

    // culture round the lumen
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.kind !== 0) continue;
      var xy = lumenXY(p);
      ctx.beginPath(); ctx.arc(xy[0], xy[1], 1.8, 0, 6.2832); ctx.fillStyle = C.lumen; ctx.fill();
    }
    // across the wall: permeate (green); after a break, culture too (amber, ringed red)
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p.kind === 1) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.2832); ctx.fillStyle = C.perm; ctx.fill(); }
      else if (p.kind === 2) {
        capsule(ctx, p.x, p.y, p.th, 7, 3.6); ctx.fillStyle = "#fbe0bf"; ctx.fill();
        ctx.lineWidth = 1.1; ctx.strokeStyle = C.alarm; ctx.stroke();
      }
    }

    var pillX = L.mx0 + (L.mx1 - L.mx0) * 0.64;
    if (alarmP) pill(M.aP === "high" ? "TMP TOO HIGH" : "SUDDEN DROP", L.ph ? (L.mx0 + L.mx1) / 2 : pillX, L.ph ? L.my1 + 13 : L.y);
    if (M.pumpT === 0 && M.pump < 0.6) pill("PUMP STOPPED", L.ph ? (L.mx0 + L.mx1) / 2 : 58, L.ph ? L.my1 + (alarmP ? 36 : 13) : L.y - 30, "#3c4650");

    // the pinch valve, on the Out-Lumen line after the transducer's tap
    var gap = 7 * (1 - 0.82 * M.c / CMAX) + 0.6;
    ctx.fillStyle = "#3c4650";
    rr(ctx, L.vx - 7, L.y - gap / 2 - 7, 14, 7, 2); ctx.fill();
    rr(ctx, L.vx - 7, L.y + gap / 2, 14, 7, 2); ctx.fill();
    text(ctx, M.open ? (L.ph ? "valve open" : "pinch valve: open") : "pinch valve", L.vx, L.y - 15 - (L.ph ? 0 : 1),
         { size: 11, weight: M.open ? 700 : 600, color: M.open ? C.ink : C.ink2, align: L.ph ? "right" : "center" });

    // the leak, dripping from the Out-Lumen fitting
    if (M.glT) {
      ctx.beginPath(); ctx.arc(L.leakX, L.y + 4.5, 2.2, 0, 6.2832); ctx.fillStyle = "rgba(224, 138, 34, .6)"; ctx.fill();
      drops.forEach(function (d) {
        ctx.beginPath(); ctx.moveTo(L.leakX, d.y - 4); ctx.quadraticCurveTo(L.leakX + 3, d.y + 1, L.leakX, d.y + 2.5);
        ctx.quadraticCurveTo(L.leakX - 3, d.y + 1, L.leakX, d.y - 4);
        ctx.fillStyle = "rgba(224, 138, 34, .75)"; ctx.fill();
      });
    }

    // four transducers, one per port, each behind a filter
    line(L.sIn, L.my0, L.sIn, L.gTop + L.g + 2); filter(L.sIn, L.fTop);
    line(L.sOut, L.my0, L.sOut, L.gTop + L.g + 2); filter(L.sOut, L.fTop);
    line(L.tapIn, L.y + 4, L.tapIn, L.gBot - L.g - 2); filter(L.tapIn, L.fBot);
    line(L.tapOut, L.y + 4, L.tapOut, L.gBot - L.g - 2); filter(L.tapOut, L.fBot);
    if (!L.ph) text(ctx, "filter", L.tapIn + 9, L.fBot + 4, { size: 10.5, weight: 500, color: C.ink3 });
    gauge(L.sIn, L.gTop, L.g, s.pinS, "In‑Shell", "S", true);
    gauge(L.sOut, L.gTop, L.g, s.poutS, "Out‑Shell", "S", true);
    gauge(L.tapIn, L.gBot, L.g, s.pinL, "In‑Lumen", "L", false);
    gauge(L.tapOut, L.gBot, L.g, s.poutL, "Out‑Lumen", "L", false);
  }

  /* the TMP chart: the last ten seconds of the situation, one line, the alarm level */
  function drawChart() {
    var c = cctx, W = CW, H = CH, l = 34, r = W - 8, t = 10, b = H - 16;
    c.clearRect(0, 0, W, H);
    var x = function (tt) { return r - (M.ct - tt) / WIN * (r - l); };
    var y = function (v) { return b - XP.clamp(v, 0, YMAX) / YMAX * (b - t); };
    [0, 0.3, 0.6].forEach(function (v) {
      c.beginPath(); c.moveTo(l, y(v)); c.lineTo(r, y(v)); c.lineWidth = 1; c.strokeStyle = v === 0 ? "#c9d0cc" : C.grid; c.stroke();
      text(c, v === 0 ? "0" : v.toFixed(1), l - 6, y(v) + 4, { size: 10.5, weight: 500, color: C.ink3, align: "right", halo: false, mono: true });
    });
    // the alarm level, dashed, in the alarm's red
    c.save();
    if (c.setLineDash) c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(l, y(HIGH)); c.lineTo(r, y(HIGH)); c.lineWidth = 1.3; c.strokeStyle = "rgba(198, 40, 40, .7)"; c.stroke();
    c.restore();
    text(c, "alarm level", l + 4, y(HIGH) - 4, { size: 10.5, weight: 650, color: "#a32020", halo: true });
    text(c, "time →", r, H - 3, { size: 10.5, weight: 500, color: C.ink3, align: "right", halo: false });

    // what happened, marked where it happened
    c.font = "600 10.5px " + FONT;
    events.forEach(function (e) {
      var ex = x(e.t); if (ex < l || ex > r || e.kind !== "mark") return;
      c.beginPath(); c.moveTo(ex, t); c.lineTo(ex, b); c.lineWidth = 1; c.strokeStyle = "#cfd5da"; c.stroke();
      var lw = (c.measureText(e.label).width || 40), left = ex - 6 - lw >= l + 2;
      text(c, e.label, left ? ex - 5 : ex + 5, b - 5, { size: 10.5, weight: 600, color: C.ink2, align: left ? "right" : "left" });
    });

    var t0 = M.ct - WIN * 1.02, pts = hist.filter(function (h) { return h.t >= t0; });
    if (pts.length > 1) {
      c.save(); c.beginPath(); c.rect(l, t - 4, r - l, b - t + 8); c.clip();
      c.beginPath();
      pts.forEach(function (h, i) { var px = x(h.t), py = y(h.v); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
      c.lineTo(x(pts[pts.length - 1].t), b); c.lineTo(x(pts[0].t), b); c.closePath();
      c.fillStyle = "rgba(35, 134, 79, .1)"; c.fill();
      c.beginPath();
      pts.forEach(function (h, i) { var px = x(h.t), py = y(h.v); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
      c.lineWidth = 2.2; c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = C.line; c.stroke();
      c.restore();
      var last = pts[pts.length - 1];
      c.beginPath(); c.arc(x(last.t), y(last.v), 4, 0, 6.2832); c.fillStyle = C.line; c.fill();
      c.lineWidth = 2; c.strokeStyle = "#fff"; c.stroke();
    }
    events.forEach(function (e) {
      if (e.kind !== "alarm") return;
      var ex = x(e.t); if (ex < l || ex > r) return;
      var v = 0; for (var i = 0; i < hist.length; i++) if (hist[i].t >= e.t) { v = hist[i].v; break; }
      c.beginPath(); c.arc(ex, y(v), 5, 0, 6.2832); c.fillStyle = C.alarm; c.fill();
      c.lineWidth = 2; c.strokeStyle = "#fff"; c.stroke();
    });
  }

  var shownT = "";
  function readouts() {
    var tv = b2(disp.tmp);
    if (tv !== shownT) { shownT = tv; tmpEl.textContent = tv; }
  }
  function render() { drawScene(); drawChart(); readouts(); }

  /* ---- the situations ---- */
  function start(id, announce) {
    sit = id;
    opts.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-s") === id ? "true" : "false"); });
    status.setAttribute("aria-live", announce ? "polite" : "off");
    fresh();
    lamps();
    intro();
    if (still) settle(); else render();
  }
  /* reduced motion: play the whole situation at once, to its outcome, then draw it */
  function settle() {
    var cap = sit === "normal" ? 3 : LEAD + FF_S + 3;
    for (var k = 0; k < cap / 0.05; k++) {
      tick(0.05, true);
      if (M.doneAt && M.st > M.doneAt) break;
    }
    if (sit === "normal") intro();
    render();
  }

  /* ---- wiring ---- */
  layout();
  fig.classList.add("is-live");
  XP.watch(fig, function (v) { fig.classList.toggle("is-vis", v); });
  start("normal", false);

  var loop = null;
  // the whole stage, drawing and readout, counts as on screen: the chart keeps moving while only it is in view
  if (!still) loop = XP.loop(stageEl, function (dt) { if (dt > 0) tick(dt, false); render(); });

  opts.forEach(function (b) { b.addEventListener("click", function () { start(b.getAttribute("data-s"), true); }); });
  again.addEventListener("click", function () { start(sit, true); });

  var lastW = L.W;
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      var w = Math.round(box.clientWidth);
      if (Math.abs(w - lastW) < 2) return;
      lastW = w;
      var keep = parts.filter(function (p) { return p.kind === 0; });
      layout(); parts = keep; drops = [];
      render();
    }).observe(box);
  }
})();
