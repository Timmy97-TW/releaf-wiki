/* ===========================================================================
   6.2 · Pressure at the four ports (15 Oct 2026). Markup: figure#xp-pressure.
   ---------------------------------------------------------------------------
   The membrane module with its four pressure transducers, one at each port
   (In-Lumen, Out-Lumen, In-Shell, Out-Shell), each behind a filter (owner,
   15 Oct), live gauges for each, and the transmembrane pressure
       TMP = (P_in,L + P_out,L)/2 − (P_in,S + P_out,S)/2
   on a small rolling chart. The reader closes the pinch valve, fast-forwards
   a long run, breaches the membrane or leaks onto the bench, and sees which
   sensor notices.

   On record, and the only measured numbers here:
     - the 4 September 2026 dashboard read feed, retentate and permeate each
       near 0.20 bar (4.1 and the specification table, 5.1; the dashboard
       photo in 4.3). The model starts all four ports there, so TMP starts
       near zero.
     - the transducers are fitted and logging; the droplet sensor sits under
       the setup; the pinch valve is fitted near the Out-Lumen end (4.3, 5.1,
       6.2). The alarms are designed and have not been validated with an
       induced leak or breach (6.2, 7.2).
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
   resistance that a cake raises as liquid is filtered, the shell loop carries
   what crosses the wall from the Out-Shell port round to the In-Shell port and
   its branch takes the excess out through a plain outlet line (an assumption:
   (d)), a breach opens a short circuit to the shell, a leak drains the
   Out-Lumen fitting. The low-TMP rule (TMP below half of what the valve
   setting should give) is the model's own and illustrative: (e).

   Uses window.XP (../js/xp-kit.js): XP.loop pauses off screen and in hidden tabs;
   with reduced motion every change lands at once (no rolling, no drips in
   flight) and the controls still work.
   =========================================================================== */
(function () {
  "use strict";
  var XP = window.XP;
  var fig = document.getElementById("xp-pressure");
  if (!XP || !fig) return;
  var box = fig.querySelector(".xps-draw");
  var cv = fig.querySelector(".xps-canvas");
  var ch = fig.querySelector(".xps-chart");
  var valve = fig.querySelector(".xps-valve input");
  if (!box || !cv || !cv.getContext || !ch || !valve) return;
  var valveOut = fig.querySelector(".xps-valve output");
  var bFF = fig.querySelector('[data-act="ff"]');
  var bBreach = fig.querySelector('[data-act="breach"]');
  var bLeak = fig.querySelector('[data-act="leak"]');
  var bReset = fig.querySelector('[data-act="reset"]');
  var status = fig.querySelector(".xps-status");
  var calc = {};
  ["pinL", "poutL", "pinS", "poutS", "tmp"].forEach(function (k) { calc[k] = fig.querySelector('[data-k="' + k + '"]'); });
  var flux = fig.querySelector(".xps-flux");
  var fluxBar = fig.querySelector(".xps-flux i");

  /* ---- the record ---- */
  var P0 = 0.20;          // bar: feed, retentate and permeate on the 4 Sep 2026 dashboard (this page, 4.1 and 5.1)

  /* ---- the model's constants (illustrative) ---- */
  var DELTA = 0.003;      // bar: pressure drop along the fibers at the loop flow
  var RS = 0.15;          // shell outlet line: bar per unit of flow across the wall
  var KV = 0.6;           // bar: the valve's pressure rise, scaled by closure^1.6
  var CMAX = 0.9;         // the slider stops at 90 % closed
  var GB = 25;            // a breach: conductance of the short circuit to the shell
  var GL = 0.06;          // a leak at the Out-Lumen fitting, to the bench
  var ALPHA = 0.19;       // cake: wall resistance gained per unit flow per hour
  var FF_H = 72, FF_S = 9;// fast-forward: 72 h of run in 9 s
  var GMAX = 1.0;         // bar: full scale of the dials
  var YMAX = 0.5;         // bar: top of the TMP chart

  var C = {
    lumen: "#1d5a9e", lumenTube: "#7f9fc6", lumenFill: "#e2edf9",
    shell: "#23684a", shellTube: "#7fb89a", shellFill: "#e8f4ed", shellSpace: "#f1f8f4",
    perm: "#2f8f5b", part: "#8795a3", partFill: "#eef1f4", head: "#dfe4e9",
    ink: "#1f2933", ink2: "#556070", ink3: "#7a8591",
    alarm: "#c62828", alarmFill: "#fdecec", cake: "#97a3b0", grid: "#e6eae8", line: "#23684a",
    halo: "rgba(255,255,255,.9)"
  };
  var FONT = (getComputedStyle(fig).getPropertyValue("--sans") || "").trim() || "-apple-system, system-ui, sans-serif";
  var MONO = (getComputedStyle(fig).getPropertyValue("--mono") || "").trim() || "ui-monospace, Menlo, monospace";

  /* ---- the flow model ----
     A peristaltic pump holds the loop flow Q = 1. The Out-Lumen node drains through the valve (pressure rise
     Kv·Q_v above the downstream P0) and, with a leak, to the bench (Gl·P_out,L). The wall passes J = TMP·G, with
     G = 1/Rw (+ Gb for a breach); the shell outlet line sits RS·J above P0. Solved exactly for TMP:          */
  function kv(c) { return KV * Math.pow(Math.max(0, c), 1.6); }
  function solve(c, Rw, gb, gl) {
    var Kv = kv(c), G = 1 / Rw + gb, re = 1.1 * RS, D = 1 + Kv * gl;
    var tmp = (Kv + DELTA * D / 2 - P0 * Kv * gl) / ((1 + re * G) * D + Kv * G);
    var J = tmp * G;
    var A = (P0 + Kv - Kv * J) / D;
    return { pinL: A + DELTA, poutL: A, pinS: P0 + 1.2 * RS * J, poutS: P0 + RS * J,
             tmp: tmp, jm: tmp / Rw, jb: tmp * gb };
  }
  /* the valve setting that holds the flow across the membrane at J0 (fast-forward) */
  function holdValve(J0, Rw, gb, gl) {
    var lo = 0, hi = CMAX;
    if (solve(hi, Rw, gb, gl).jm < J0) return hi;
    for (var i = 0; i < 32; i++) { var m = (lo + hi) / 2; if (solve(m, Rw, gb, gl).jm < J0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  /* ---- state ---- */
  var M, disp, hist, events, parts, drops, still = XP.reduced;
  function fresh() {
    M = { c: 0, Rw: 1, gb: 0, gbT: 0, gl: 0, glT: 0, t: 0, wet: 0, aT: false, aW: false, expT: 0,
          ff: null, win: 60, winT: 60, lastT: 0, dropAcc: 0, permAcc: 0, brAcc: 0, tmpBeforeBreach: 0, tmpBeforeLeak: 0 };
    var s = solve(0, 1, 0, 0);
    disp = { pinL: s.pinL, poutL: s.poutL, pinS: s.pinS, poutS: s.poutS, tmp: s.tmp, jm: s.jm };
    M.expT = s.tmp;
    hist = []; events = []; parts = []; drops = [];
    // the minute before the reader arrives: the start state, held
    for (var i = 0; i <= 300; i++) hist.push({ t: -60 + i * 0.2, v: s.tmp });
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
    L.bx = L.mx0 + (L.mx1 - L.mx0) * 0.44; L.bf = 1;   // where a breach opens: fiber 2
    ctx = XP.dpr(cv, W, L.H);
    CW = Math.max(300, Math.round(ch.parentNode.clientWidth));
    CH = ph ? 112 : 104;
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
  function pill(str, x, y) {
    ctx.font = "700 10.5px " + FONT;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0.8px";
    var w = ctx.measureText(str).width + 30, h = 20;
    rr(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.fillStyle = C.alarm; ctx.fill();
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
    var keep = [], sp = L.ph ? 54 : 70, out = L.W - 6;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.kind === 0) {                                     // culture, round the loop
        p.x += dt * sp / L.W;
        if (p.x * L.W > out) { p.x = 6 / L.W; p.f = (p.f + 1) % 4; }
        keep.push(p); continue;
      }
      p.life += dt;
      if (p.st === 0) {                                       // in the shell space, drawn to the Out-Shell port
        var far = Math.abs(L.sOut - p.x) > 26, tx = L.sOut + (far ? p.ox * 0.6 : 0), ty = far ? L.y : L.my0 + 2;
        var dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var w = p.life < 0.35 ? 0 : 1, sp2 = p.kind === 2 ? 30 : 46;
        if (far && Math.abs(dx) < 10) { p.ox *= 0.5; }
        p.vx += ((dx / d) * sp2 * w - p.vx) * Math.min(1, dt * 2.2) + (Math.random() - 0.5) * 60 * dt;
        p.vy += ((dy / d) * sp2 * w * (far ? 0.25 : 1) - p.vy) * Math.min(1, dt * 2.2) + (Math.random() - 0.5) * 60 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = XP.clamp(p.x, L.mx0 + L.hw + 2, L.mx1 - L.hw - 2);
        p.y = XP.clamp(p.y, L.my0 + 2, L.my1 - 2);
        if (Math.abs(p.x - tx) < 5 && p.y < L.my0 + 6) { p.st = 1; p.x = tx; p.y = L.my0; }
      } else if (p.st === 1) {                                // up the Out-Shell port into the shell loop
        p.y -= dt * 40;
        // at the loop: most of it out along the branch to harvest, some round the loop and back into the shell
        if (p.y <= L.hy) { p.st = p.kind === 1 && Math.random() < 0.4 ? 3 : 2; p.y = L.hy; }
      } else if (p.st === 3) {                                // round the loop, to the In-Shell port
        p.x -= dt * 60;
        if (p.x <= L.sIn) { p.x = L.sIn; p.st = 4; }
      } else if (p.st === 4) {                                // down the In-Shell port, back into the shell space
        p.y += dt * 40;
        if (p.y >= L.my0 + 4) { p.st = 0; p.life = 0; p.ox = (Math.random() - 0.5) * (L.mx1 - L.mx0) * 0.5; }
      } else {                                                // along the harvest branch, out of the picture
        p.x += dt * 60;
        if (p.x > out) continue;
      }
      keep.push(p);
    }
    parts = keep;
  }

  /* ---- the run ---- */
  var lastSay = "";
  function say(html) {
    if (html === lastSay) return;
    lastSay = html; status.innerHTML = html;
    status.classList.toggle("is-alarm", html.indexOf("xps-warn") >= 0);
  }
  function pct(c) { return Math.round(c * 100); }
  function b2(v) { return v.toFixed(2); }

  function setValve(c, fromUser) {
    M.c = XP.clamp(c, 0, CMAX);
    var v = Math.round(M.c * 100);
    if (+valve.value !== v) valve.value = String(v);
    valveOut.textContent = v === 0 ? "open" : v + "% closed";
    valve.setAttribute("aria-valuetext", v === 0 ? "open" : v + " percent closed");
    if (fromUser && M.ff) endFF(true);
  }

  function addEvent(kind) { events.push({ t: M.t, kind: kind }); if (events.length > 24) events.shift(); }

  function toLive() { M.winT = 60; }

  function startFF() {
    if (M.ff) return;
    toLive();
    var pre = M.c < 0.15;
    M.ff = { phase: pre ? 0 : 1, k: 0, c0: M.c, t0: 0, J0: 0, tmp0: 0, cStart: 0, limitAt: null };
    bFF.disabled = true;
    if (pre) say("First the pinch valve closes to 40%, so there is a flow across the wall to watch.");
    else beginRun();
    if (still) { while (M.ff) tick(0.05, true); render(); }
  }
  function beginRun() {
    var s = solve(M.c, M.Rw, M.gb, M.gl);
    M.ff.phase = 1; M.ff.t0 = M.t; M.ff.J0 = s.jm; M.ff.tmp0 = s.tmp; M.ff.cStart = M.c;
    say("Fast&#8209;forwarding: a cake builds on the wall, and the valve closes further to hold the same flow across it.");
  }
  function endFF(aborted) {
    var f = M.ff; if (!f) return;
    M.ff = null;
    bFF.disabled = false;
    bFF.querySelector("span").textContent = "Fast-forward a long run";
    if (aborted || f.phase !== 1) return;
    var s = solve(M.c, M.Rw, M.gb, M.gl), h = Math.round((M.t - f.t0) / 3600);
    if (f.limitAt == null) {
      say("After " + h + "&nbsp;h at the same flow across the wall, TMP rose from <b>" + b2(f.tmp0) + "</b> to <b>" + b2(s.tmp) +
          "&nbsp;bar</b> and the valve had to close from " + pct(f.cStart) + "% to " + pct(M.c) + "%. Fouling shows as a rising trend, not a sudden failure.");
    } else {
      say("The valve reached its 90% limit after " + f.limitAt + "&nbsp;h. From then on the flow across the wall fell while TMP kept rising, to <b>" +
          b2(s.tmp) + "&nbsp;bar</b> after " + h + "&nbsp;h. Fouling shows as a rising trend, not a sudden failure.");
    }
  }

  function breach() {
    if (M.gbT) return;
    if (M.ff) endFF(true);
    toLive();
    M.gbT = GB; M.tmpBeforeBreach = solve(M.c, M.Rw, 0, M.gl).tmp;
    addEvent("breach");
    bBreach.disabled = true;
    if (M.tmpBeforeBreach < 0.04) {
      say("Breach: culture now flows straight into the shell. With the valve open, TMP was already about zero, so there is no drop to see. <b>Close the pinch valve</b> and watch TMP.");
    } else say("Breach: culture now flows straight into the shell, and the lumen and shell pressures move together.");
    if (still) settle();
  }
  function leak() {
    if (M.glT) return;
    if (M.ff) endFF(true);
    toLive();
    M.glT = GL; M.tmpBeforeLeak = solve(M.c, M.Rw, M.gb, 0).tmp;
    addEvent("leak");
    bLeak.disabled = true;
    say("A fitting at the Out&#8209;Lumen end starts to drip onto the bench.");
    if (still) settle();
  }
  function reset() {
    fresh();
    setValve(0, false);
    bFF.disabled = false; bBreach.disabled = false; bLeak.disabled = false;
    bFF.querySelector("span").textContent = "Fast-forward a long run";
    status.classList.remove("is-alarm");
    say("Back to the 4 September reading: every port near 0.20&nbsp;bar, TMP about zero.");
    render();
  }

  /* an alarm is said in the status line (aria-live) and stays drawn where it happens: a red pill on the module,
     a red pad. Both are the alarms the system is designed to raise; neither path has been tested (6.2, 7.2). */
  var ALARM = '<svg class="xps-warn" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.6 15 14H1z" fill="currentColor"/><path d="M8 6v3.6M8 11.6v.1" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>';

  /* one model step; dt is real seconds */
  function tick(dt, quick) {
    var speed = 1, f = M.ff;
    if (f && f.phase === 0) {                                // easing the valve to 40 % first
      f.k += dt;
      setValve(XP.lerp(f.c0, 0.4, XP.ease(Math.min(1, f.k / 1.2))), false);
      if (f.k > 2.2 || quick && f.k > 1.2) beginRun();
    } else if (f && f.phase === 1) speed = FF_H * 3600 / FF_S;
    var dm = dt * speed;
    M.t += dm;

    // breach and leak open quickly but not in a single frame
    M.gb += (M.gbT - M.gb) * Math.min(1, dt * 6);
    M.gl += (M.glT - M.gl) * Math.min(1, dt * 6);
    if (quick) { M.gb = M.gbT; M.gl = M.glT; }

    var s = solve(M.c, M.Rw, M.gb, M.gl);
    if (f && f.phase === 1) {
      M.Rw += ALPHA * s.jm * dm / 3600;                      // the cake grows with the liquid filtered
      var cNeed = holdValve(f.J0, M.Rw, M.gb, M.gl);
      if (cNeed >= CMAX - 1e-4 && f.limitAt == null) f.limitAt = Math.max(1, Math.round((M.t - f.t0) / 3600));
      setValve(cNeed, false);
      s = solve(M.c, M.Rw, M.gb, M.gl);
      bFF.querySelector("span").textContent = "Fast-forwarding… " + Math.min(FF_H, Math.round((M.t - f.t0) / 3600)) + " h";
      if (M.t - f.t0 >= FF_H * 3600) { endFF(false); }
    }

    // the transducers read with a short lag (none with reduced motion)
    var a = quick ? 1 : 1 - Math.exp(-dt / 0.45);
    ["pinL", "poutL", "pinS", "poutS", "tmp", "jm"].forEach(function (k) { disp[k] += (s[k] - disp[k]) * a; });
    var exp = solve(M.c, M.Rw, 0, 0).tmp;
    M.expT += (exp - M.expT) * a;

    // the model's low-TMP rule: TMP under half of what this valve setting should give
    if (!M.aT && M.expT > 0.04 && disp.tmp < 0.5 * M.expT) {
      M.aT = true; addEvent("alarm");
      status.classList.add("is-alarm");
      if (M.tmpBeforeBreach >= 0.04) {
        say(ALARM + "<b>Low&#8209;TMP alarm</b>, as designed: the lumen and shell pressures have met, so TMP fell from about <b>" + b2(M.tmpBeforeBreach) +
            "</b> to <b>" + b2(Math.max(0, s.tmp)) + "&nbsp;bar</b>. A breach shows here before any liquid is seen.");
      } else {
        say(ALARM + "<b>Low&#8209;TMP alarm</b>, as designed: the valve is closing, but TMP stays near <b>" + b2(Math.max(0, s.tmp)) +
            "&nbsp;bar</b>, under half of what this setting should give. That is how a breach shows, before any liquid is seen.");
      }
    }

    // the leak: drops, a puddle on the sensor pad, the sensor trips
    if (M.glT) {
      M.dropAcc += dt;
      if (quick) { M.wet = 0.55; }
      else if (M.dropAcc > 0.5) { M.dropAcc = 0; drops.push({ y: L.y + 5, v: 0 }); }
      var keepD = [];
      drops.forEach(function (d) { d.v += 900 * dt; d.y += d.v * dt; if (d.y >= L.padY - 1) M.wet = Math.min(1, M.wet + 0.16); else keepD.push(d); });
      drops = keepD;
      if (!M.aW && M.wet >= 0.3) {
        M.aW = true; addEvent("wet");
        status.classList.add("is-alarm");
        var dT = Math.abs(solve(M.c, M.Rw, M.gb, M.gl).tmp - M.tmpBeforeLeak);
        say(ALARM + "<b>Droplet alarm</b>, as designed: liquid under the setup. TMP moved by " + (dT < 0.01 ? "less than 0.01" : "only " + b2(dT)) +
            "&nbsp;bar, so only the droplet sensor sees this one. The two sensors watch different failures.");
      }
    }

    // particles
    if (!quick) {
      M.permAcc += dt * Math.min(30, disp.jm * 70);
      while (M.permAcc >= 1) { M.permAcc -= 1; if (parts.length < 90) spawnPerm(1); }
      if (M.gb > 1) { M.brAcc += dt * 3.5; while (M.brAcc >= 1) { M.brAcc -= 1; if (parts.length < 110) spawnPerm(2); } }
      stepParts(dt);
    }

    // the chart: about 500 samples across the window, and every frame while fast-forwarding
    if (M.t - M.lastT >= Math.max(0.2, M.win / 500) || (M.ff && M.ff.phase === 1) || quick) {
      M.lastT = M.t;
      hist.push({ t: M.t, v: disp.tmp });
      if (hist.length > 2400) hist.splice(0, hist.length - 2400);
    }
    // the window: a minute when live; the whole fast-forward while it runs, until the next action
    var running = M.ff && M.ff.phase === 1;
    if (running) M.winT = Math.max(60, M.t - M.ff.t0 + 60);
    // the window follows a fast-forward exactly; only the way back to the live minute is eased
    M.win = quick || running ? M.winT : Math.exp(XP.lerp(Math.log(M.win), Math.log(M.winT), Math.min(1, dt * 2.5)));
    while (hist.length > 2 && hist[1].t < M.t - Math.max(M.win, M.winT) * 1.02) hist.shift();
  }
  /* reduced motion: run the model forward until it settles, then draw once */
  function settle() { for (var k = 0; k < 40; k++) tick(0.05, true); render(); }

  /* ---- drawing ---- */
  function drawScene() {
    var W = L.W, H = L.H, i;
    ctx.clearRect(0, 0, W, H);
    var alarmT = M.aT, s = disp;

    // the droplet sensor under the whole setup
    rr(ctx, L.px0, L.padY, L.px1 - L.px0, 8, 4);
    ctx.fillStyle = M.aW ? C.alarmFill : C.partFill; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = M.aW ? C.alarm : C.part; ctx.stroke();
    ctx.beginPath(); ctx.arc(L.px0 + 10, L.padY + 4, 2.6, 0, 6.2832); ctx.fillStyle = M.aW ? C.alarm : C.perm; ctx.fill();
    if (M.wet > 0) {
      ctx.beginPath(); ctx.ellipse(L.leakX, L.padY - 0.5, 4 + 26 * M.wet, 2.2 + 1.6 * M.wet, 0, Math.PI, 0);
      ctx.fillStyle = "rgba(29, 90, 158, .35)"; ctx.fill();
    }
    if (M.aW) text(ctx, "droplet sensor: liquid", (L.px0 + L.px1) / 2, L.padY + 22, { size: 11, weight: 700, color: C.alarm, align: "center" });
    else text(ctx, "droplet sensor", (L.px0 + L.px1) / 2, L.padY + 22, { size: 11, weight: 600, color: C.ink2, align: "center" });

    // the lumen lines: in from the pump, out through the valve
    tube(4, L.y, L.mx0, L.y, C.lumenTube, C.lumenFill);
    tube(L.mx1, L.y, W - 6, L.y, C.lumenTube, C.lumenFill);
    arrow(W - 2, L.y, 1, C.lumenTube);
    text(ctx, "from pump", 6, L.y - 10, { size: 11, weight: 500, color: C.ink3 });
    // on phones too (reviewer, 15 Oct): the line has to say where it goes. There it is on two lines, in the gap
    // between the Out-Lumen tap and the edge, so the tap's line does not run through it.
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
    rr(ctx, L.mx0, L.my0, L.mx1 - L.mx0, L.mh, 12);
    ctx.fillStyle = C.shellSpace; ctx.fill();
    ctx.lineWidth = alarmT ? 2.2 : 1.5; ctx.strokeStyle = alarmT ? C.alarm : C.part; ctx.stroke();
    ctx.save(); rr(ctx, L.mx0, L.my0, L.mx1 - L.mx0, L.mh, 12); ctx.clip();
    ctx.fillStyle = C.head; ctx.fillRect(L.mx0, L.my0, L.hw, L.mh); ctx.fillRect(L.mx1 - L.hw, L.my0, L.hw, L.mh);
    ctx.restore();
    var cake = XP.clamp((M.Rw - 1) / 3, 0, 1) * (L.ft / 2 - 1);
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
    if (M.gbT) {                                              // the breach: a split in one fiber's wall
      var by = L.fy[L.bf] - L.ft / 2;
      ctx.fillStyle = C.shellSpace; ctx.fillRect(L.bx - 3, by - 1.5, 6, 3);
      ctx.beginPath(); ctx.arc(L.bx, by, 7.5, 0, 6.2832); ctx.lineWidth = 1.6; ctx.strokeStyle = C.alarm; ctx.stroke();
    }

    // culture round the lumen
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.kind !== 0) continue;
      var xy = lumenXY(p);
      ctx.beginPath(); ctx.arc(xy[0], xy[1], 1.7, 0, 6.2832); ctx.fillStyle = C.lumen; ctx.fill();
    }
    // across the wall: permeate (green); after a breach, culture too (blue, ringed red)
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p.kind === 1) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.2832); ctx.fillStyle = C.perm; ctx.fill(); }
      else if (p.kind === 2) {
        capsule(ctx, p.x, p.y, p.th, 7, 3.6); ctx.fillStyle = C.alarmFill; ctx.fill();
        ctx.lineWidth = 1.1; ctx.strokeStyle = C.alarm; ctx.stroke();
      }
    }

    if (alarmT) pill("LOW TMP", (L.mx0 + L.mx1) / 2, L.y);

    // the pinch valve, on the Out-Lumen line after the transducer's tap
    var gap = 7 * (1 - 0.82 * M.c / CMAX) + 0.6;
    ctx.fillStyle = "#3c4650";
    rr(ctx, L.vx - 7, L.y - gap / 2 - 7, 14, 7, 2); ctx.fill();
    rr(ctx, L.vx - 7, L.y + gap / 2, 14, 7, 2); ctx.fill();
    text(ctx, "pinch valve", L.vx, L.y - 15 - (L.ph ? 0 : 1), { size: 11, weight: 600, color: C.ink2, align: L.ph ? "right" : "center" });

    // the leak, dripping from the Out-Lumen fitting
    if (M.glT) {
      ctx.beginPath(); ctx.arc(L.leakX, L.y + 4.5, 2.2, 0, 6.2832); ctx.fillStyle = "rgba(29, 90, 158, .55)"; ctx.fill();
      drops.forEach(function (d) {
        ctx.beginPath(); ctx.moveTo(L.leakX, d.y - 4); ctx.quadraticCurveTo(L.leakX + 3, d.y + 1, L.leakX, d.y + 2.5);
        ctx.quadraticCurveTo(L.leakX - 3, d.y + 1, L.leakX, d.y - 4);
        ctx.fillStyle = "rgba(29, 90, 158, .6)"; ctx.fill();
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

  /* the rolling TMP chart, one series, one axis */
  var hover = null;
  function fmtAgo(sec) {
    if (sec < 1) return "now";
    if (sec < 120) return Math.round(sec) + " s ago";
    if (sec < 7200) return Math.round(sec / 60) + " min ago";
    return Math.round(sec / 3600) + " h ago";
  }
  function fmtSpan(sec) {
    if (sec < 120) return "−" + Math.round(sec) + " s";
    if (sec < 7200) return "−" + Math.round(sec / 60) + " min";
    return "−" + Math.round(sec / 3600) + " h";
  }
  function drawChart() {
    var c = cctx, W = CW, H = CH, l = 44, r = W - 14, t = 22, b = H - 20;
    c.clearRect(0, 0, W, H);
    var x = function (tt) { return r - (M.t - tt) / M.win * (r - l); };
    var y = function (v) { return b - XP.clamp(v, 0, YMAX) / YMAX * (b - t); };
    // grid and axes
    [0, 0.25, 0.5].forEach(function (v) {
      c.beginPath(); c.moveTo(l, y(v)); c.lineTo(r, y(v)); c.lineWidth = 1; c.strokeStyle = v === 0 ? "#c9d0cc" : C.grid; c.stroke();
      text(c, v === 0 ? "0" : String(v), l - 6, y(v) + 4, { size: 10.5, weight: 500, color: C.ink3, align: "right", halo: false, mono: true });
    });
    text(c, "TMP, bar", l, 12, { size: 10.5, weight: 650, color: C.ink2, halo: false });
    text(c, fmtSpan(M.win), l, H - 5, { size: 10.5, weight: 500, color: C.ink3, halo: false });
    text(c, "now", r, H - 5, { size: 10.5, weight: 500, color: C.ink3, align: "right", halo: false });

    // events: a hairline and a word; words that would touch share one label. The alarm also gets its dot on the line.
    var marks = [];
    events.forEach(function (e) {
      var ex = x(e.t); if (ex < l || ex > r || (e.kind !== "breach" && e.kind !== "leak")) return;
      c.beginPath(); c.moveTo(ex, t - 12); c.lineTo(ex, b); c.lineWidth = 1; c.strokeStyle = "#cfd5da"; c.stroke();
      var last = marks[marks.length - 1];
      if (last && ex - last.x < 64) last.word += " · " + e.kind; else marks.push({ x: ex, word: e.kind });
    });
    c.font = "600 10.5px " + FONT;
    marks.forEach(function (m) {
      var lw = c.measureText(m.word).width, left = m.x + 4 + lw > r + 10;   // near "now", the word goes on the left
      text(c, m.word, left ? m.x - 4 : m.x + 4, 12, { size: 10.5, weight: 600, color: C.ink2, align: left ? "right" : "left" });
    });

    // the line, with a 10 % wash under it
    var t0 = M.t - M.win * 1.02, pts = [];
    for (var hi = 0; hi < hist.length; hi++) {
      if (hist[hi].t >= t0) { if (!pts.length && hi > 0) pts.push(hist[hi - 1]); pts.push(hist[hi]); }
    }
    if (pts.length > 1) {
      c.save(); c.beginPath(); c.rect(l, t - 4, r - l, b - t + 8); c.clip();
      c.beginPath();
      pts.forEach(function (h, i) { var px = x(h.t), py = y(h.v); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
      c.lineTo(x(pts[pts.length - 1].t), b); c.lineTo(x(pts[0].t), b); c.closePath();
      c.fillStyle = "rgba(35, 104, 74, .1)"; c.fill();
      c.beginPath();
      pts.forEach(function (h, i) { var px = x(h.t), py = y(h.v); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
      c.lineWidth = 2; c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = C.line; c.stroke();
      c.restore();
      var last = pts[pts.length - 1];
      c.beginPath(); c.arc(x(last.t), y(last.v), 4, 0, 6.2832); c.fillStyle = C.line; c.fill();
      c.lineWidth = 2; c.strokeStyle = "#fff"; c.stroke();
    }
    events.forEach(function (e) {
      if (e.kind !== "alarm") return;
      var ex = x(e.t); if (ex < l || ex > r) return;
      var v = 0; for (var i = 0; i < hist.length; i++) if (hist[i].t >= e.t) { v = hist[i].v; break; }
      c.beginPath(); c.arc(ex, y(v), 4.5, 0, 6.2832); c.fillStyle = C.alarm; c.fill();
      c.lineWidth = 2; c.strokeStyle = "#fff"; c.stroke();
    });

    // hover: a crosshair on the nearest sample
    if (hover != null && pts.length) {
      var tt = M.t - (r - XP.clamp(hover, l, r)) / (r - l) * M.win, best = pts[0];
      pts.forEach(function (h) { if (Math.abs(h.t - tt) < Math.abs(best.t - tt)) best = h; });
      var hx = x(best.t), hy = y(best.v);
      c.beginPath(); c.moveTo(hx, t - 2); c.lineTo(hx, b); c.lineWidth = 1; c.strokeStyle = "#9aa5af"; c.stroke();
      c.beginPath(); c.arc(hx, hy, 4, 0, 6.2832); c.fillStyle = C.line; c.fill(); c.lineWidth = 2; c.strokeStyle = "#fff"; c.stroke();
      var label = best.v.toFixed(3) + " bar · " + fmtAgo(M.t - best.t);
      c.font = "600 11px " + FONT;
      var tw = c.measureText(label).width + 14, tx = XP.clamp(hx + 8, l, r - tw);
      rr(c, tx, 1, tw, 19, 6); c.fillStyle = "rgba(255,255,255,.97)"; c.fill(); c.lineWidth = 1; c.strokeStyle = "#d5dbe0"; c.stroke();
      text(c, label, tx + 7, 14.5, { size: 11, weight: 600, color: C.ink, halo: false });
    }
  }

  var shown = {};
  function readouts() {
    // the gauges' rounded readings, and TMP from exactly those, so the sum on screen always adds up
    var r = { pinL: +disp.pinL.toFixed(2), poutL: +disp.poutL.toFixed(2), pinS: +disp.pinS.toFixed(2), poutS: +disp.poutS.toFixed(2) };
    r.tmp = (r.pinL + r.poutL) / 2 - (r.pinS + r.poutS) / 2;
    ["pinL", "poutL", "pinS", "poutS"].forEach(function (k) { var v = r[k].toFixed(2); if (shown[k] !== v) { shown[k] = v; calc[k].textContent = v; } });
    var tv = XP.fmt(r.tmp, 3);
    if (shown.tmp !== tv) { shown.tmp = tv; calc.tmp.textContent = tv; }
    var j = XP.clamp(disp.jm / 0.32, 0, 1), word = j < 0.03 ? "none" : j < 0.3 ? "low" : j < 0.65 ? "moderate" : "high";
    fluxBar.style.transform = "scaleX(" + j.toFixed(3) + ")";
    if (shown.flux !== word) { shown.flux = word; flux.setAttribute("aria-valuetext", word); flux.setAttribute("aria-valuenow", String(Math.round(j * 100))); }
  }
  function render() { drawScene(); drawChart(); readouts(); }

  /* ---- wiring ---- */
  fresh();
  layout();
  fig.classList.add("is-live");
  setValve(0, false);
  say("Start: the 4 September reading. Feed (In&#8209;Lumen), retentate (Out&#8209;Lumen) and permeate (shell) each read about 0.20&nbsp;bar, so TMP is about zero and nothing pushes liquid across the wall. <b>Close the pinch valve.</b>");
  render();

  var loop = null;
  if (!still) loop = XP.loop(box, function (dt) { if (dt > 0) tick(dt, false); render(); });

  valve.addEventListener("input", function () {
    setValve(+valve.value / 100, true);
    toLive();
    if (still) settle();
  });
  valve.addEventListener("change", function () {
    setValve(+valve.value / 100, true);
    if (still) settle();
    if (M.aT || M.gbT) return;               // during a breach, the alarm rule in tick() does the talking
    var s = solve(M.c, M.Rw, M.gb, M.gl);
    if (M.c < 0.02) say("Valve open: every port near 0.20&nbsp;bar again and TMP about zero, so nothing is pushed across the wall.");
    else say("Pinch valve " + pct(M.c) + "% closed: the lumen side rises to about <b>" + b2(s.poutL) + "&nbsp;bar</b>, TMP to <b>" + b2(s.tmp) +
             "&nbsp;bar</b>, and liquid is pushed across the wall into the shell.");
  });
  bFF.addEventListener("click", startFF);
  bBreach.addEventListener("click", breach);
  bLeak.addEventListener("click", leak);
  bReset.addEventListener("click", reset);

  // the chart's crosshair (pointer); the readouts above carry the same numbers for keyboard and screen readers
  ch.addEventListener("pointermove", function (e) { var rc = ch.getBoundingClientRect(); hover = e.clientX - rc.left; if (still || !loop) drawChart(); });
  ch.addEventListener("pointerleave", function () { hover = null; if (still || !loop) drawChart(); });

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
