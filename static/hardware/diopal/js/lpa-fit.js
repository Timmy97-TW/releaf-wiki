// LPA record, 3.1 First Culture Run: the growth-fit chart, read by touch. 18 Oct 2026.
//
// The owner: "remake the results 1 graph yourself so that u can sort of make it interactive". Until then 3.1 showed the
// team's Digital Twin figure (fig-r5-lpa-fit.svg) rendered to photos/lpa-fit-20260919.webp. This draws the same chart
// in the photometer page's growth-chart pattern (its js/growth-charts.js and css/xp-charts.css: a .bc[data-chart] host,
// the arms' names as buttons that show or hide them, a readout, arrow keys), with what a scatter of six arms needs:
//   - point at a reading, or tap it: its arm, time, tube and OD600 in the readout, and its arm picked out;
//   - point at an arm's key, or focus it: that arm picked out, the others dimmed; press it: the arm hidden or shown;
//   - the plot takes the focus: arrow keys left and right step through the readings, up and down move between arms
//     at the same time, Home and End, Escape puts the reading away; each step is spoken (aria-live).
//
// THE NUMBERS. The readings are read from the table in the fold under the chart (#lpa-fit-table: one cell per arm and
// time, each reading a span[data-v], data-ex on the four excluded from the fit), as 2.2's spread chart reads its lux
// tables, so the chart cannot disagree with the table. Where they come from is written above the figure in index.html.
// The fit is the Digital Twin page's: a logistic with r = 0.299 per h, K = 1.005, X0 = 0.0235 (NRMSE 1.9%, n = 56).
// BAND is its 5-95% band, which is published only as a drawing: each vertex of the figure's polygon converted with the
// figure's own axis mapping (x: 0 h at 62 px, 24 h at 815.2 px; y: OD 0 at 328 px, 1.2 at 22 px). [t (h), low, high].
// Styles: css/lpa-fit.css.
(function () {
  "use strict";

  const FIT = { r: 0.299, K: 1.005, X0: 0.0235, nrmse: "1.9%", n: 56 };
  const BAND = [[0,0.02,0.029],[0.25,0.021,0.031],[0.5,0.023,0.033],[0.75,0.025,0.035],[1,0.027,0.037],[1.25,0.029,0.04],[1.5,0.032,0.042],[1.75,0.034,0.045],[2,0.037,0.048],[2.25,0.04,0.051],[2.5,0.043,0.055],[2.75,0.047,0.058],[3,0.051,0.062],[3.25,0.055,0.066],[3.5,0.059,0.071],[3.75,0.064,0.075],[4,0.068,0.08],[4.25,0.073,0.085],[4.5,0.079,0.091],[4.75,0.085,0.097],[5,0.092,0.104],[5.25,0.098,0.111],[5.5,0.105,0.118],[5.75,0.113,0.125],[6,0.121,0.133],[6.25,0.129,0.142],[6.5,0.138,0.151],[6.75,0.147,0.161],[7,0.158,0.171],[7.25,0.167,0.182],[7.5,0.178,0.193],[7.75,0.189,0.206],[8,0.2,0.219],[8.25,0.212,0.233],[8.5,0.224,0.247],[8.75,0.236,0.262],[9,0.25,0.278],[9.25,0.263,0.295],[9.5,0.277,0.311],[9.75,0.291,0.329],[10,0.305,0.347],[10.25,0.321,0.365],[10.5,0.336,0.384],[10.75,0.352,0.404],[11,0.368,0.424],[11.25,0.384,0.443],[11.5,0.401,0.463],[11.75,0.418,0.483],[12,0.435,0.503],[12.25,0.452,0.523],[12.5,0.47,0.544],[12.75,0.487,0.563],[13,0.505,0.583],[13.25,0.523,0.603],[13.5,0.54,0.621],[13.75,0.558,0.64],[14,0.575,0.658],[14.25,0.592,0.676],[14.5,0.609,0.693],[14.75,0.625,0.71],[15,0.641,0.726],[15.25,0.658,0.742],[15.5,0.673,0.757],[15.75,0.689,0.772],[16,0.704,0.785],[16.25,0.719,0.798],[16.5,0.733,0.811],[16.75,0.747,0.822],[17,0.761,0.833],[17.25,0.774,0.844],[17.5,0.786,0.854],[17.75,0.798,0.864],[18,0.81,0.873],[18.25,0.821,0.881],[18.5,0.832,0.889],[18.75,0.842,0.896],[19,0.852,0.904],[19.25,0.861,0.91],[19.5,0.87,0.916],[19.75,0.878,0.922],[20,0.886,0.928],[20.25,0.894,0.932],[20.5,0.901,0.937],[20.75,0.908,0.942],[21,0.915,0.945],[21.25,0.92,0.949],[21.5,0.926,0.953],[21.75,0.931,0.956],[22,0.936,0.96],[22.25,0.94,0.963],[22.5,0.944,0.966],[22.75,0.949,0.969],[23,0.952,0.972],[23.25,0.955,0.975],[23.5,0.958,0.977],[23.75,0.96,0.98],[24,0.963,0.982],[24.25,0.965,0.984],[24.5,0.967,0.986],[24.75,0.968,0.988],[25,0.97,0.99],[25.25,0.971,0.992],[25.5,0.973,0.994],[25.75,0.974,0.996],[26,0.975,0.997]];

  // The six arms, in the record's order (3.1's table: R1-R3 and G1-G3, each at a low, medium and high intensity).
  // Wavelength is carried by hue and by shape (red squares, green circles), so it does not rest on colour alone;
  // intensity by the page's tier shades, light to dark, as in 2.2's spread chart.
  const ARMS = [
    { id: "R1", name: "Red, low",     hue: "r", tier: "low",  shape: "square" },
    { id: "R2", name: "Red, medium",  hue: "r", tier: "mid",  shape: "square" },
    { id: "R3", name: "Red, high",    hue: "r", tier: "high", shape: "square" },
    { id: "G1", name: "Green, low",   hue: "g", tier: "low",  shape: "round" },
    { id: "G2", name: "Green, medium", hue: "g", tier: "mid", shape: "round" },
    { id: "G3", name: "Green, high",  hue: "g", tier: "high", shape: "round" }
  ];
  const DODGE = 0.16;                       // h between neighbouring arms at one sampling time (drawing only)
  const MINUS = "−";

  const host = document.querySelector('.bc[data-chart="lpa-fit"]');
  if (!host) return;
  const table = document.getElementById(host.getAttribute("data-table") || "lpa-fit-table");
  if (!table) return;

  // ---------- the readings, from the table ----------
  const pts = [];
  table.querySelectorAll("tbody tr[data-t]").forEach(function (tr) {
    const t = parseFloat(tr.getAttribute("data-t"));
    tr.querySelectorAll("td[data-arm]").forEach(function (td) {
      const k = ARMS.findIndex(function (a) { return a.id === td.getAttribute("data-arm"); });
      if (k < 0) return;
      const spans = td.querySelectorAll("span[data-v]");
      spans.forEach(function (sp, j) {
        const v = parseFloat(sp.getAttribute("data-v"));
        if (isFinite(v)) pts.push({ t: t, v: v, k: k, tube: j + 1, tubes: spans.length, ex: sp.hasAttribute("data-ex") });
      });
    });
  });
  if (!pts.length) return;
  // reading order: by time, then arm, then tube (the order the arrow keys step in)
  pts.sort(function (a, b) { return a.t - b.t || a.k - b.k || a.tube - b.tube; });
  const TIMES = pts.map(function (p) { return p.t; }).filter(function (t, i, a) { return a.indexOf(t) === i; });

  function fit(t) { return FIT.K / (1 + (FIT.K - FIT.X0) / FIT.X0 * Math.exp(-FIT.r * t)); }
  function num(v, dp) { return (v < 0 ? MINUS : "") + Math.abs(v).toFixed(dp); }
  const mk = function (tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

  // ---------- state ----------
  const st = { off: ARMS.map(function () { return false; }), fitOff: false, i: -1, hi: -1, kb: false };

  // ---------- the frame: stats, keys, plot, readout ----------
  host.innerHTML = "";
  host.classList.add("is-drawn", "is-live");
  const stats = mk("p", "lf-stats");
  stats.innerHTML = "<span><i>r</i> = " + FIT.r.toFixed(3) + "&nbsp;h<sup>" + MINUS + "1</sup></span>" +
    "<span><i>K</i> = " + FIT.K.toFixed(3) + "</span><span>NRMSE " + FIT.nrmse + "</span><span><i>n</i> = " + FIT.n + "</span>";
  const legend = mk("div", "bc-legend lf-legend");
  legend.setAttribute("role", "group");
  legend.setAttribute("aria-label", "Light arms: press to show or hide; point or focus to pick one out");
  const keys = ARMS.map(function (a, k) {
    const b = mk("button", "bc-key lf-key " + a.hue + " t-" + a.tier);
    b.type = "button";
    b.setAttribute("aria-pressed", "true");
    b.innerHTML = '<i class="' + a.shape + '" aria-hidden="true"></i><b>' + a.id + "</b>" + a.name.replace(/^\w+, /, "");
    b.setAttribute("aria-label", a.id + ", " + a.name.toLowerCase());
    b.addEventListener("click", function () { toggle(k); });
    b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") highlight(k); });
    b.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") highlight(st.i >= 0 ? pts[st.i].k : -1); });
    b.addEventListener("focus", function () { highlight(k); });
    b.addEventListener("blur", function () { highlight(st.i >= 0 ? pts[st.i].k : -1); });
    legend.appendChild(b);
    return b;
  });
  const fitKey = mk("button", "bc-key lf-key lf-fitkey");
  fitKey.type = "button";
  fitKey.setAttribute("aria-pressed", "true");
  fitKey.innerHTML = '<i class="fit" aria-hidden="true"></i>Pooled fit, 5&ndash;95%';
  fitKey.addEventListener("click", function () {
    st.fitOff = !st.fitOff;
    fitKey.setAttribute("aria-pressed", st.fitOff ? "false" : "true");
    if (svg) svg.querySelectorAll(".lf-fitg").forEach(function (g) { g.classList.toggle("is-off", st.fitOff); });
    say.textContent = "Pooled fit " + (st.fitOff ? "hidden." : "shown.");
  });
  legend.appendChild(fitKey);
  const exKey = mk("span", "lf-exkey");
  exKey.innerHTML = '<i aria-hidden="true"></i>Excluded from the fit';
  legend.appendChild(exKey);

  const plot = mk("div", "bc-plot lf-plot");
  plot.tabIndex = 0;
  plot.setAttribute("role", "group");
  plot.setAttribute("aria-roledescription", "chart");
  plot.setAttribute("aria-label", "OD600, background subtracted, against hours after inoculation, for six light arms " +
    "at 2, 4, 6, 8 and 24 hours, with the pooled logistic fit (r " + FIT.r + " per hour, K " + FIT.K + "). " +
    "All arms rise from about 0.05 at 2 hours to between 0.91 and 1.02 at 24 hours. " +
    "Arrow keys step through the readings; up and down change the arm. The readings are also in the table below.");
  const read = mk("div", "bc-read lf-read");
  read.setAttribute("aria-hidden", "true");
  const say = mk("p", "bc-live");
  say.setAttribute("aria-live", "polite");
  host.appendChild(stats); host.appendChild(legend); host.appendChild(plot); host.appendChild(say);

  // ---------- drawing ----------
  let g = null, svg = null;
  function geom(w) {
    const W = Math.round(Math.min(760, Math.max(260, w || 640)));
    const narrow = W < 480;
    const H = narrow ? Math.round(W * 0.86) : Math.round(Math.min(400, W * 0.5));
    const L = narrow ? 42 : 54, R = narrow ? 10 : 16, T = 14, B = narrow ? 40 : 46;
    const x = { min: 0, max: 26 }, y = { min: 0, max: 1.2 };
    const X = function (v) { return L + (v - x.min) / (x.max - x.min) * (W - L - R); };
    const Y = function (v) { return H - B - (v - y.min) / (y.max - y.min) * (H - T - B); };
    return { W: W, H: H, L: L, R: R, T: T, B: B, X: X, Y: Y, narrow: narrow, x: x, y: y };
  }
  const f1 = function (v) { return v.toFixed(1); };
  function px(p) { return { x: g.X(p.t + (p.k - (ARMS.length - 1) / 2) * DODGE), y: g.Y(p.v) }; }

  function draw() {
    g = geom(Math.round(host.clientWidth));
    const r = g.narrow ? 3 : 3.6;
    let s = '<svg class="bc-svg lf-svg" viewBox="0 0 ' + g.W + " " + g.H + '" aria-hidden="true" focusable="false">';
    // no samples between 8 h and 24 h
    s += '<rect class="lf-gap" x="' + f1(g.X(8)) + '" y="' + g.T + '" width="' + f1(g.X(24) - g.X(8)) + '" height="' + (g.H - g.T - g.B) + '"/>';
    s += '<text class="lf-gap-t" x="' + f1((g.X(8) + g.X(24)) / 2) + '" y="' + (g.T + 16) + '">' +
      (g.narrow ? "no samples, 8&ndash;24 h" : "no samples between 8 h and 24 h") + "</text>";
    // grid and ticks
    [0, 2, 4, 6, 8, 12, 16, 20, 24].forEach(function (v) {
      if (g.narrow && (v === 2 || v === 6)) { s += '<line class="bc-grid" x1="' + f1(g.X(v)) + '" y1="' + g.T + '" x2="' + f1(g.X(v)) + '" y2="' + (g.H - g.B) + '"/>'; return; }
      s += '<line class="bc-grid" x1="' + f1(g.X(v)) + '" y1="' + g.T + '" x2="' + f1(g.X(v)) + '" y2="' + (g.H - g.B) + '"/>';
      s += '<text class="bc-tick x" x="' + f1(g.X(v)) + '" y="' + (g.H - g.B + 16) + '">' + v + "</text>";
    });
    for (let v = 0; v <= 1.2 + 1e-9; v += 0.2) {
      s += '<line class="bc-grid" x1="' + g.L + '" y1="' + f1(g.Y(v)) + '" x2="' + (g.W - g.R) + '" y2="' + f1(g.Y(v)) + '"/>';
      s += '<text class="bc-tick y" x="' + (g.L - 7) + '" y="' + f1(g.Y(v) + 3.5) + '">' + num(v, 1) + "</text>";
    }
    s += '<line class="lf-axis" x1="' + g.L + '" y1="' + (g.H - g.B) + '" x2="' + (g.W - g.R) + '" y2="' + (g.H - g.B) + '"/>';
    s += '<text class="bc-ax" x="' + ((g.L + g.W - g.R) / 2) + '" y="' + (g.H - 8) + '">Hours after inoculation</text>';
    s += '<text class="bc-ax" transform="translate(13 ' + ((g.T + g.H - g.B) / 2) + ') rotate(-90)">OD600' + (g.narrow ? "" : ", background subtracted") + "</text>";
    // the fit: its band, its curve, its ceiling
    const off = st.fitOff ? " is-off" : "";
    s += '<g class="lf-fitg' + off + '">';
    s += '<polygon class="lf-band" points="' + BAND.map(function (b) { return f1(g.X(b[0])) + "," + f1(g.Y(b[2])); }).join(" ") + " " +
      BAND.slice().reverse().map(function (b) { return f1(g.X(b[0])) + "," + f1(g.Y(b[1])); }).join(" ") + '"/>';
    const curve = [];
    for (let t = 0; t <= 26 + 1e-9; t += 0.25) curve.push(f1(g.X(t)) + "," + f1(g.Y(fit(t))));
    s += '<polyline class="lf-fit" points="' + curve.join(" ") + '"/>';
    s += '<line class="lf-k" x1="' + g.L + '" y1="' + f1(g.Y(FIT.K)) + '" x2="' + (g.W - g.R) + '" y2="' + f1(g.Y(FIT.K)) + '"/>';
    s += '<text class="lf-k-t" x="' + f1(g.X(g.narrow ? 0.4 : 0.5)) + '" y="' + f1(g.Y(FIT.K) - 6) + '">plateau <tspan font-style="italic">K</tspan> = ' + FIT.K.toFixed(3) + "</text>";
    s += "</g>";
    // the arms: kept readings filled, excluded ones hollow
    ARMS.forEach(function (a, k) {
      s += '<g class="lf-arm ' + a.hue + " t-" + a.tier + (st.off[k] ? " is-off" : "") + '" data-k="' + k + '">';
      pts.forEach(function (p, i) {
        if (p.k !== k) return;
        const q = px(p), cls = "lf-pt" + (p.ex ? " ex" : "");
        s += a.shape === "square"
          ? '<rect class="' + cls + '" data-i="' + i + '" x="' + f1(q.x - r * 0.92) + '" y="' + f1(q.y - r * 0.92) + '" width="' + f1(r * 1.84) + '" height="' + f1(r * 1.84) + '" rx="0.8"/>'
          : '<circle class="' + cls + '" data-i="' + i + '" cx="' + f1(q.x) + '" cy="' + f1(q.y) + '" r="' + r + '"/>';
      });
      s += "</g>";
    });
    // the picked reading's ring, hidden until there is one
    s += '<circle class="lf-ring" cx="0" cy="0" r="' + (r + 4) + '" visibility="hidden"/>';
    s += "</svg>";
    plot.innerHTML = s;
    svg = plot.firstChild;
    if (g.narrow) host.insertBefore(read, say); else plot.appendChild(read);
    host.classList.toggle("is-narrow", g.narrow);
    highlight(st.hi);
    if (st.i >= 0) show(st.i, false); else idle();
  }

  // ---------- picking out an arm ----------
  function highlight(k) {
    st.hi = k;
    if (!svg) return;
    svg.classList.toggle("has-hi", k >= 0);
    svg.querySelectorAll(".lf-arm").forEach(function (e) { e.classList.toggle("is-hi", +e.getAttribute("data-k") === k); });
    keys.forEach(function (b, j) { b.classList.toggle("is-hi", j === k); });
  }

  // ---------- reading one point ----------
  function describe(p) {
    const a = ARMS[p.k];
    return a.id + ", " + a.name.toLowerCase() + (p.tubes > 1 ? ", tube " + p.tube + " of " + p.tubes : "") + ", " + p.t +
      " hours: OD600 " + p.v.toFixed(3) + (p.ex ? ", excluded from the fit" : "") + ".";
  }
  function idle() {
    if (!svg) return;
    svg.querySelector(".lf-ring").setAttribute("visibility", "hidden");
    svg.querySelectorAll(".lf-pt.is-on").forEach(function (e) { e.classList.remove("is-on"); });
    read.classList.remove("is-on");
    read.innerHTML = "";
  }
  function show(i, speak) {
    if (i < 0 || i >= pts.length) return;
    st.i = i;
    const p = pts[i], a = ARMS[p.k], q = px(p);
    const ring = svg.querySelector(".lf-ring");
    ring.setAttribute("cx", f1(q.x)); ring.setAttribute("cy", f1(q.y));
    ring.setAttribute("class", "lf-ring " + a.hue);
    ring.setAttribute("visibility", "visible");
    svg.querySelectorAll(".lf-pt.is-on").forEach(function (e) { e.classList.remove("is-on"); });
    const m = svg.querySelector('.lf-pt[data-i="' + i + '"]');
    if (m) m.classList.add("is-on");
    highlight(p.k);
    read.innerHTML = '<b>' + p.t + " h" + (p.tubes > 1 ? "<small>tube " + p.tube + " of " + p.tubes + "</small>" : "") + "</b>" +
      '<span class="bc-rv lf-rv ' + a.hue + " t-" + a.tier + '"><i class="' + a.shape + '"></i>' + a.id + " &middot; " + a.name +
      "<em>" + p.v.toFixed(3) + "</em></span>" +
      (p.ex ? '<span class="lf-rx">Excluded from the fit</span>' : '<span class="lf-rf">Fit at ' + p.t + " h: " + fit(p.t).toFixed(3) + "</span>");
    read.classList.add("is-on");
    if (!g.narrow) {
      // beside the point, kept inside the plot
      const rw = read.offsetWidth || 170, rh = read.offsetHeight || 60, sc = plot.clientWidth / g.W;
      let left = q.x * sc + 14, top = q.y * sc - rh - 10;
      if (left + rw > plot.clientWidth - 4) left = q.x * sc - rw - 14;
      if (top < 2) top = q.y * sc + 14;
      read.style.left = Math.max(2, left) + "px";
      read.style.top = Math.max(2, Math.min(top, plot.clientHeight - rh - 2)) + "px";
    }
    if (speak) say.textContent = describe(p);
  }
  function clear() { st.i = -1; idle(); highlight(-1); }

  function visible(i) { return !st.off[pts[i].k]; }
  function nearest(clientX, clientY, maxPx) {
    const rc = svg.getBoundingClientRect();
    if (!rc.width) return -1;
    const sc = g.W / rc.width;
    const ux = (clientX - rc.left) * sc, uy = (clientY - rc.top) * sc;
    let bi = -1, bd = Infinity;
    pts.forEach(function (p, i) {
      if (!visible(i)) return;
      const q = px(p), d = Math.hypot(q.x - ux, q.y - uy);
      if (d < bd) { bd = d; bi = i; }
    });
    return bd <= maxPx * sc ? bi : -1;
  }

  // ---------- pointer and touch ----------
  plot.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    st.kb = false;
    const i = nearest(e.clientX, e.clientY, 22);
    if (i >= 0) { if (i !== st.i) show(i, true); }
    else if (st.i >= 0) clear();
  });
  plot.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && !st.kb) clear(); });
  plot.addEventListener("pointerdown", function (e) {
    st.kb = false;
    const i = nearest(e.clientX, e.clientY, e.pointerType === "mouse" ? 22 : 30);
    if (i >= 0) show(i, true); else clear();
  });
  document.addEventListener("pointerdown", function (e) { if (st.i >= 0 && !host.contains(e.target)) clear(); }, { passive: true });

  // ---------- keyboard ----------
  function step(from, dir) {
    for (let i = from + dir; i >= 0 && i < pts.length; i += dir) if (visible(i)) return i;
    return from;
  }
  function armStep(from, dir) {
    // the same time and tube in the next visible arm (or that arm's nearest tube)
    const p = pts[from];
    for (let k = p.k + dir; k >= 0 && k < ARMS.length; k += dir) {
      if (st.off[k]) continue;
      const c = pts.map(function (q, i) { return { q: q, i: i }; }).filter(function (o) { return o.q.k === k && o.q.t === p.t; });
      if (c.length) return (c.find(function (o) { return o.q.tube === p.tube; }) || c[c.length - 1]).i;
    }
    return from;
  }
  function first() { return step(-1, 1); }
  plot.addEventListener("keydown", function (e) {
    let i = st.i;
    if (e.key === "ArrowRight") i = i < 0 ? first() : step(i, 1);
    else if (e.key === "ArrowLeft") i = i < 0 ? step(pts.length, -1) : step(i, -1);
    else if (e.key === "ArrowUp") i = i < 0 ? first() : armStep(i, 1);
    else if (e.key === "ArrowDown") i = i < 0 ? first() : armStep(i, -1);
    else if (e.key === "Home") i = first();
    else if (e.key === "End") i = step(pts.length, -1);
    else if (e.key === "Escape") { clear(); return; }
    else return;
    e.preventDefault();
    st.kb = true;
    if (i >= 0 && i < pts.length && visible(i)) show(i, true);
  });
  plot.addEventListener("focus", function () {
    if (st.i < 0 && plot.matches(":focus-visible")) { st.kb = true; const i = first(); if (i >= 0) show(i, true); }
  });
  plot.addEventListener("blur", function (e) {
    if (!st.kb || (e.relatedTarget && host.contains(e.relatedTarget))) return;
    clear();
  });

  // ---------- showing and hiding an arm ----------
  function toggle(k) {
    st.off[k] = !st.off[k];
    keys[k].setAttribute("aria-pressed", st.off[k] ? "false" : "true");
    if (svg) svg.querySelectorAll('.lf-arm[data-k="' + k + '"]').forEach(function (e) { e.classList.toggle("is-off", st.off[k]); });
    if (st.i >= 0 && pts[st.i].k === k && st.off[k]) { st.i = -1; idle(); }
    say.textContent = ARMS[k].id + ", " + ARMS[k].name.toLowerCase() + (st.off[k] ? ", hidden." : ", shown.");
  }

  // ---------- drawn at the host's width, again when it changes enough to matter ----------
  let lastW = -1, t = null;
  function render(force) {
    const w = Math.round(host.clientWidth) || 640;
    if (!force && Math.abs(w - lastW) < 24) return;
    lastW = w;
    draw();
  }
  render(true);
  const later = function () { clearTimeout(t); t = setTimeout(function () { render(false); }, 140); };
  window.addEventListener("resize", later, { passive: true });
  // the record turns from the dark hero to paper under the chart and its column narrows without a window resize
  if ("ResizeObserver" in window) new ResizeObserver(later).observe(host);

  window.__lpaFit = { pts: pts, arms: ARMS, fit: fit, band: BAND, show: show, clear: clear, toggle: toggle, highlight: highlight };
})();
