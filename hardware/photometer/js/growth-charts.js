// Photometer record, part 3 Bacterial Growth (5.1 until the 15 Oct reorder): the two growth charts, read by touch. 15 Oct 2026.
//
// The bacteria-growth prototypes moved here from the bioreactor page (its 4.1) on 15 Oct, and their charts came with
// them; this file is their one home. It is the growth half of the bioreactor page's former js/charts.js, its code
// unchanged but for two fixes: idle() now hides the arms' crosshair markers, which used to stay on the chart after
// the pointer left it, and the clip paths take their own id prefix (gc-clip-N), since js/tio2-charts.js numbers
// its own bc-clip-N on this page too. The TiO2 half was already this page's js/tio2-charts.js. Each script draws
// only the `.bc[data-chart]` hosts it has a chart for and leaves every other host alone, so no chart is drawn twice.
//
// A crosshair snaps to the readings and a readout gives both arms at that time; each arm's name is a button that
// shows or hides it; prototype 3's chart (37 °C) draws on each arm's plateau as the record states it, and prototype 2's
// (22 °C) marks where its run ended early. Since 15 Oct the part is numbered as in the team's cycle diagram: prototype 1 is a
// placeholder, so the chart ids growth-c1 and growth-c2 (and the keys growth_c1, growth_c2) are prototypes 2 and 3. Their numbers come from js/growth-data.js (the team's raw data, the one place it goes)
// or, until that arrives, from the series traced from the team's chart images (GROWTH_TRACED, below).
// Styles: css/xp-charts.css; the "Measured" tag is the shared kit's (../css/explore.css).

// ---------- the traced series ----------
// Series traced from the chart images in the team's write-up (Hardware Wiki Writing (3).pdf); until 15 Oct they sat in
// the bioreactor page's js/traced.js, beside the TiO2 Test 2 series that are now in js/tio2-charts.js. Each marker was
// located by colour and calibrated against at least three axis ticks; the method was checked on the TiO2 figures,
// whose printed values (Test 2 R² 0.9999 / 0.9998, agreement slope 0.942, R² 0.9997) all reproduce from their traced
// series. Each value here is about ±0.02 OD600. Leave these in place: when the team's spreadsheet arrives the raw
// data goes in js/growth-data.js instead, which this file prefers, and these stay as the fallback.
window.GROWTH_TRACED = {
  // p15_1.png (prototype 2, 22 °C, hours)
  growth_c1: {"flask":[[0.0,0.172],[0.5,0.189],[1.0,0.207],[1.5,0.208],[2.0,0.229],[2.5,0.346],[3.0,0.314],[3.5,0.308],[4.0,0.376],[4.5,0.444],[5.0,0.556],[5.5,0.699],[6.0,0.812],[6.5,0.988],[7.0,1.132],[24.0,2.168],[25.0,2.462],[26.0,2.402]],"bioreactor":[[0.0,0.172],[0.5,0.11],[1.0,0.102],[1.5,0.196],[2.0,0.131],[2.5,0.177],[3.0,0.165],[3.5,0.112],[4.0,0.124],[4.5,0.135],[5.0,0.126],[5.5,0.124],[6.0,0.083],[6.5,0.132],[7.0,0.113],[24.0,0.196],[25.0,0.342],[26.0,0.369],[27.0,0.304]]},
  // p17_1.png (prototype 3, 37 °C, minutes)
  growth_c2: {"flask":[[0,0.121],[15,0.13],[42,0.154],[62,0.171],[79,0.226],[96,0.225],[113,0.258],[130,0.297],[145,0.38],[161,0.408],[180,0.438],[197,0.584],[212,0.536],[229,0.605],[245,0.641],[263,0.76],[278,0.831],[295,0.634],[314,0.622],[336,0.571],[353,0.686],[370,0.674],[387,0.656],[406,0.817],[425,0.73]],"bioreactor":[[0,0.162],[15,0.148],[42,0.136],[62,0.175],[79,0.261],[96,0.389],[113,0.518],[130,0.766],[145,0.895],[161,0.784],[180,0.832],[197,0.862],[212,0.874],[229,0.937],[245,0.879],[263,0.883],[278,0.819],[295,0.841],[314,0.74],[336,0.763],[353,0.916],[370,0.826],[387,0.811],[406,0.876],[425,0.843]]}
};

(function () {
  const MINUS = "−";

  const TRACED = window.GROWTH_TRACED || {};

  // ---------- the growth curves (part 3): the team's raw data when it arrives, the traced series until then ----------
  // js/growth-data.js is the one place the raw CSV goes; its header documents the format. With its csv left null
  // (or unreadable), each chart draws the series traced from the team's chart image, each value about ±0.02 OD600.
  const GROWTH = window.BIO_GROWTH || {};
  function cell(s) { return String(s == null ? "" : s).trim().replace(/^"(.*)"$/, "$1").trim(); }
  // a time in the chart's unit: a number in the paste's unit, or elapsed h:mm
  function readTime(s, unit, to) {
    s = cell(s);
    if (s === "") return NaN;
    const hm = /^(\d+):(\d{1,2})$/.exec(s);
    const v = hm ? +hm[1] + +hm[2] / 60 : Number(s);
    const u = hm ? "h" : unit;
    if (!isFinite(v)) return NaN;
    return u === to ? v : u === "min" ? v / 60 : v * 60;
  }
  function parseCSV(text, unit, to) {
    const lines = String(text).split(/\r?\n/).filter(function (r) { return r.trim(); });
    if (lines.length < 2) return null;
    const sep = lines[0].indexOf("\t") >= 0 ? "\t" : (lines[0].indexOf(";") >= 0 && lines[0].indexOf(",") < 0) ? ";" : ",";
    const head = lines[0].split(sep).map(function (h) { return cell(h).toLowerCase(); });
    let iR = -1, iF = -1;
    head.forEach(function (h, i) {
      if (!i) return;
      if (iR < 0 && h.indexOf("reactor") >= 0) iR = i;
      else if (iF < 0 && h.indexOf("flask") >= 0) iF = i;
    });
    if (iR < 0 && iF < 0) return null;
    const out = { bioreactor: [], flask: [] };
    lines.slice(1).forEach(function (line) {
      const r = line.split(sep);
      const t = readTime(r[0], unit, to);
      if (!isFinite(t)) return;
      [[iR, out.bioreactor], [iF, out.flask]].forEach(function (c) {
        if (c[0] < 0) return;
        const s = cell(r[c[0]]);
        const v = s === "" ? NaN : Number(s);
        if (isFinite(v)) c[1].push([t, v]);
      });
    });
    [out.bioreactor, out.flask].forEach(function (a) { a.sort(function (p, q) { return p[0] - q[0]; }); });
    return out;
  }
  function growth(key, unit) {
    const g = GROWTH[key];
    if (g && g.csv) {
      const p = parseCSV(g.csv, g.unit || unit, unit);
      if (p && p.bioreactor.length + p.flask.length > 1) return { source: "raw", bioreactor: p.bioreactor, flask: p.flask };
      if (window.console) console.warn("js/growth-data.js: " + key + " could not be read, so its traced series is drawn");
    }
    const t = TRACED[key];
    return t ? { source: "traced", bioreactor: t.bioreactor, flask: t.flask } : null;
  }
  // the chart's own axis, stretched in whole steps only if the data runs past it
  function reach(g, i, step, floor) {
    let m = floor;
    g.bioreactor.concat(g.flask).forEach(function (p) { if (p[i] > m) m = Math.ceil(p[i] / step - 1e-9) * step; });
    return m;
  }

  // ---------- helpers ----------
  function num(v, dp) { return (v < 0 ? MINUS : "") + Math.abs(v).toFixed(dp); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  // The clip paths' ids: this page also runs js/tio2-charts.js, which numbers its own as bc-clip-N from 1, so these
  // take their own prefix, or two charts would share an id and one would be clipped by the other's rectangle.
  let uid = 0;

  // ---------- the charts ----------
  const CHARTS = {
    // Bacteria growth, DBTL 1 (22 °C) and DBTL 2 (37 °C): read by touch. growth() gives the raw data or the traced series.
    "growth-c1": function () {
      const g = growth("growth_c1", "h");
      if (!g) return null;
      return {
        interactive: true, source: g.source, unit: "h",
        aria: "Bacteria growth, DBTL 1: OD600 against time in hours for the bioreactor and a flask control",
        x: { min: 0, max: reach(g, 0, 5, 30), step: 5, dp: 0, label: "Time (h)" },
        y: { min: 0, max: reach(g, 1, 0.5, 3), step: 0.5, dp: 1, label: "OD600" },
        series: [
          { name: "Bioreactor", cls: "s-reactor", pts: g.bioreactor, line: true },
          { name: "Flask control", short: "Flask", cls: "s-ref", shape: "square", pts: g.flask, line: true }
        ],
        // 3.2, prototype 2, Test (the bioreactor page's 4.1 until 15 Oct, as its prototype 1): "the trial ended early when medium leaked
        // at the pump. Final OD600 readings were 0.304 in the tube and 0.48 in the medium reservoir". The bioreactor
        // series' last point is that final tube reading (0.304 in the trace), so the mark stands on it. Content doc
        // v5, DBTL 1, 1.3 Test: the same.
        // 17 Oct: the doc's DBTL 1 and 2 are one 22 °C cycle (the owner); the run's last point is at 27 h, when the
        // pump failed ("This test ran for a period of 27 total hours before the pump failed on us as well").
        notes: [{ type: "end", k: 0, text: "Run ended at 27 h when the pump failed", short: ["Ended at 27 h:", "pump failed"] }]
      };
    },
    "growth-c2": function () {
      const g = growth("growth_c2", "min");
      if (!g) return null;
      return {
        interactive: true, source: g.source, unit: "min",
        aria: "Bacteria growth, DBTL 2: OD600 against time in minutes for the bioreactor and a flask control at 37 degrees C",
        x: { min: 0, max: reach(g, 0, 100, 500), step: 100, dp: 0, label: "Time (min)" },
        y: { min: 0, max: reach(g, 1, 0.2, 1), step: 0.2, dp: 1, label: "OD600" },
        series: [
          { name: "Bioreactor", cls: "s-reactor", pts: g.bioreactor, line: true },
          { name: "Flask control", short: "Flask", cls: "s-ref", shape: "square", pts: g.flask, line: true }
        ],
        // 3.3, prototype 3, Test (the bioreactor page's 4.1 until 15 Oct, as its prototype 2): "the bioreactor reached its plateau
        // (OD600 ~0.8–0.9) after 2 hours, the flask (OD600 ~0.6–0.8) after 4.5 hours" (content doc v5, DBTL cycle 2,
        // Test, in the same words). These are the team's own readings of the run, drawn as stated: each arm's band
        // from its time to its last reading.
        notes: [
          { type: "plateau", k: 0, at: 2, y0: 0.8, y1: 0.9, text: "plateau ~2 h", short: "~2 h", band: "0.8–0.9" },
          { type: "plateau", k: 1, at: 4.5, y0: 0.6, y1: 0.8, text: "plateau ~4.5 h", short: "~4.5 h", band: "0.6–0.8" }
        ]
      };
    }
  };

  // ---------- the growth charts, read by touch ----------
  // The same geometry and classes as js/tio2-charts.js's draw(), so the two kinds of chart look like one family; each
  // arm is its own group so its key can hide it, the notes sit under the data, and a crosshair sits over it.
  function med(a) { const s = a.slice().sort(function (p, q) { return p - q; }); return s.length ? s[s.length >> 1] : 0; }
  function unitX(o, h) { return o.unit === "min" ? h * 60 : h; }      // a note's time (hours) on this chart's axis

  function plotSvg(o, st) {
    const W = Math.round(Math.min(640, Math.max(260, o.w || 640)));
    const narrow = W < 480;
    const H = narrow ? Math.round(W * 0.92) : (o.h || 400);
    const L = narrow ? 50 : 58, T = 16, B = narrow ? 46 : 50;
    let R = narrow ? 12 : 18;
    const xr = function (v) { return (v - o.x.min) / (o.x.max - o.x.min); };
    // a plateau band's label stands just past the band's end; make room at the right if the data runs to the edge
    if (o.notes && o.notes.some(function (n) { return n.band; })) {
      const lastX = Math.max.apply(null, o.notes.filter(function (n) { return n.band; }).map(function (n) {
        const p = o.series[n.k].pts; return p.length ? p[p.length - 1][0] : o.x.min; }));
      // the label runs from the band's end to the drawing's right edge: the plot's room past the last reading plus R
      const need = 50, have = (1 - xr(lastX)) * (W - L - R) + R;
      if (have < need) R += Math.ceil((need - have) / Math.max(0.05, xr(lastX)));
    }
    const X = function (v) { return L + xr(v) * (W - L - R); };
    const Y = function (v) { return H - B - (v - o.y.min) / (o.y.max - o.y.min) * (H - T - B); };
    const f2 = function (v) { return v.toFixed(1); };
    const id = "gc-clip-" + (++uid);
    let s = '<svg class="bc-svg" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true" focusable="false">';
    s += '<defs><clipPath id="' + id + '"><rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/></clipPath></defs>';

    const every = (W - L - R) / ((o.x.max - o.x.min) / o.x.step) < 34 ? 2 : 1;
    for (let v = o.x.min, k = 0; v <= o.x.max + 1e-9; v += o.x.step, k++) {
      s += '<line class="bc-grid" x1="' + f2(X(v)) + '" y1="' + T + '" x2="' + f2(X(v)) + '" y2="' + (H - B) + '"/>';
      if (k % every === 0) s += '<text class="bc-tick x" x="' + f2(X(v)) + '" y="' + (H - B + 17) + '">' + num(v, o.x.dp) + "</text>";
    }
    for (let v = o.y.min; v <= o.y.max + 1e-9; v += o.y.step) {
      s += '<line class="bc-grid" x1="' + L + '" y1="' + f2(Y(v)) + '" x2="' + (W - R) + '" y2="' + f2(Y(v)) + '"/>';
      s += '<text class="bc-tick y" x="' + (L - 8) + '" y="' + f2(Y(v) + 3.5) + '">' + num(v, o.y.dp) + "</text>";
    }
    s += '<text class="bc-ax" x="' + ((L + W - R) / 2) + '" y="' + (H - 10) + '">' + esc(o.x.label) + "</text>";
    s += '<text class="bc-ax" transform="translate(15 ' + ((T + H - B) / 2) + ') rotate(-90)">' + esc(o.y.label) + "</text>";

    // the record's notes, under the data. Each part carries how it draws on (data-a) and when (data-d).
    (o.notes || []).forEach(function (n, j) {
      const sr = o.series[n.k], p = sr.pts;
      if (!p.length) return;
      const off = st.off[n.k] ? " is-off" : "";
      const d = (j * 0.35).toFixed(2);
      s += '<g class="bc-ann ' + sr.cls + off + '" data-k="' + n.k + '">';
      if (n.type === "plateau") {
        const xa = X(unitX(o, n.at)), xe = X(p[p.length - 1][0]), y0 = Y(n.y0), y1 = Y(n.y1), yb = H - B;
        if (xe > xa) {
          s += '<rect class="bc-band" x="' + f2(xa) + '" y="' + f2(y1) + '" width="0" height="' + f2(y0 - y1) +
            '" data-a="band" data-w="' + f2(xe - xa) + '" data-d="' + d + '"/>';
          s += '<text class="bc-note band" x="' + f2(xe + 5) + '" y="' + f2((y0 + y1) / 2 + 3.8) + '" data-a="label" data-d="' + d + '">' + esc(n.band) + "</text>";
        }
        s += '<line class="bc-guide" x1="' + f2(xa) + '" y1="' + yb + '" x2="' + f2(xa) + '" y2="' + yb +
          '" data-a="line" data-from="' + yb + '" data-to="' + f2(y0) + '" data-d="' + d + '"/>';
        s += '<text class="bc-note" x="' + f2(xa + 5) + '" y="' + (yb - 6) + '" data-a="label" data-d="' + d + '">' +
          esc(narrow ? n.short : n.text) + "</text>";
      } else if (n.type === "end") {
        const last = p[p.length - 1], xe = X(last[0]), yb = H - B;
        const ly = Y(o.y.min + (o.y.max - o.y.min) * 0.3), top = ly - (narrow ? 26 : 14);
        s += '<line class="bc-guide" x1="' + f2(xe) + '" y1="' + yb + '" x2="' + f2(xe) + '" y2="' + yb +
          '" data-a="line" data-from="' + yb + '" data-to="' + f2(top) + '" data-d="' + d + '"/>';
        const lines = narrow ? n.short : [n.text];
        lines.forEach(function (t, i) {
          s += '<text class="bc-note end" x="' + f2(xe - 6) + '" y="' + f2(top + 9 + i * 14) + '" data-a="label" data-d="' + d + '">' + esc(t) + "</text>";
        });
      }
      s += "</g>";
    });

    // the arms: solid where readings are close, dashed across a long stretch with none (prototype 2's 7 h to 24 h)
    o.series.forEach(function (sr, k) {
      const p = sr.pts;
      s += '<g class="bc-s ' + sr.cls + (st.off[k] ? " is-off" : "") + '" data-k="' + k + '">';
      if (sr.line && p.length > 1) {
        const steps = []; for (let i = 1; i < p.length; i++) steps.push(p[i][0] - p[i - 1][0]);
        const gap = med(steps) * 3;
        let run = [p[0]];
        const flush = function () {
          if (run.length > 1) s += '<polyline class="bc-line ' + sr.cls + '" clip-path="url(#' + id + ')" points="' +
            run.map(function (q) { return f2(X(q[0])) + "," + f2(Y(q[1])); }).join(" ") + '"/>';
        };
        for (let i = 1; i < p.length; i++) {
          if (p[i][0] - p[i - 1][0] > gap) {
            flush();
            s += '<line class="bc-line bc-gap ' + sr.cls + '" x1="' + f2(X(p[i - 1][0])) + '" y1="' + f2(Y(p[i - 1][1])) +
              '" x2="' + f2(X(p[i][0])) + '" y2="' + f2(Y(p[i][1])) + '"/>';
            run = [p[i]];
          } else run.push(p[i]);
        }
        flush();
      }
      p.forEach(function (q) {
        const cx = X(q[0]), cy = Y(q[1]);
        s += sr.shape === "square"
          ? '<rect class="bc-pt ' + sr.cls + '" x="' + f2(cx - 3.4) + '" y="' + f2(cy - 3.4) + '" width="6.8" height="6.8"/>'
          : '<circle class="bc-pt ' + sr.cls + '" cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="3.6"/>';
      });
      s += "</g>";
    });

    // the crosshair, hidden until the reader points
    s += '<g class="bc-xh" visibility="hidden"><line class="bc-xh-l" x1="0" y1="' + T + '" x2="0" y2="' + (H - B) + '"/>';
    o.series.forEach(function (sr, k) {
      s += sr.shape === "square"
        ? '<rect class="bc-xh-pt ' + sr.cls + '" data-k="' + k + '" x="0" y="0" width="10" height="10" visibility="hidden"/>'
        : '<circle class="bc-xh-pt ' + sr.cls + '" data-k="' + k + '" cx="0" cy="0" r="5.4" visibility="hidden"/>';
    });
    s += "</g></svg>";
    return { svg: s, W: W, H: H, L: L, R: R, T: T, B: B, X: X, Y: Y, narrow: narrow };
  }

  const ease = function (t) { return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); };
  const clamp01 = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; };

  function live(el, o) {
    const coarse = !!(window.matchMedia && window.matchMedia("(hover: none)").matches);
    const st = { off: o.series.map(function () { return false; }), i: -1, t: 0, done: false, down: false, touch: coarse };
    const end = (o.notes || []).length ? ((o.notes.length - 1) * 0.35 + 1.5) : 0;
    const traced = o.source !== "raw";
    const mk = function (tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

    el.innerHTML = "";
    el.classList.add("is-drawn", "is-live");
    // the arms' names are the buttons that show or hide them
    const legend = mk("div", "bc-legend");
    const keys = o.series.map(function (sr, k) {
      const b = mk("button", "bc-key " + sr.cls);
      b.type = "button";
      b.setAttribute("aria-pressed", "true");
      b.innerHTML = '<i class="' + (sr.shape || "round") + '" aria-hidden="true"></i>' + esc(sr.name);
      b.addEventListener("click", function () { toggle(k); });
      legend.appendChild(b);
      return b;
    });
    // how to read it: beside the names on a wide screen, in the readout's line on a phone
    const hint = mk("span", "bc-hint");
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = "Point at the chart to read both arms";
    legend.appendChild(hint);
    const plot = mk("div", "bc-plot");
    plot.tabIndex = 0;
    plot.setAttribute("role", "group");
    plot.setAttribute("aria-label", o.aria + ". Arrow keys step through the readings.");
    const read = mk("div", "bc-read");
    read.setAttribute("aria-hidden", "true");
    // 17 Oct 2026: no provenance line under the chart (the owner: remove "Measured · Traced from the team's chart ...
    // raw data to add")
    const say = mk("p", "bc-live");
    say.setAttribute("aria-live", "polite");
    el.appendChild(legend); el.appendChild(plot); el.appendChild(say);

    let g = null, svg = null, xh = null;
    function render() {
      o.w = Math.round(el.clientWidth) || 640;
      g = plotSvg(o, st);
      plot.innerHTML = g.svg;
      // the readout sits in the plot's empty top-left corner; on a phone it is a line under the plot
      if (g.narrow) el.insertBefore(read, say); else plot.appendChild(read);   // on a phone: the line under the plot
      svg = plot.firstChild;
      xh = svg.querySelector(".bc-xh");
      el.classList.toggle("is-narrow", g.narrow);
      read.style.left = ((g.L + 8) / g.W * 100) + "%";
      read.style.top = ((g.T + 6) / g.H * 100) + "%";
      apply(st.done ? end : st.t);
      if (st.i >= 0) show(st.i, false); else idle();
    }

    // ---- reading it ----
    function times() {
      const all = [];
      o.series.forEach(function (sr, k) { if (!st.off[k]) sr.pts.forEach(function (p) { all.push(p[0]); }); });
      all.sort(function (a, b) { return a - b; });
      return all.filter(function (v, i) { return !i || v - all[i - 1] > 1e-6; });
    }
    function at(sr, t) {
      // a reading at that time: exact for the traced series (both arms share their times), nearest within half a
      // step for raw data whose arms were read a little apart
      const p = sr.pts;
      if (!p.length) return null;
      const steps = []; for (let i = 1; i < p.length; i++) steps.push(p[i][0] - p[i - 1][0]);
      const tol = Math.max(1e-6, med(steps) * 0.5);
      let best = null;
      p.forEach(function (q) { if (Math.abs(q[0] - t) <= tol && (!best || Math.abs(q[0] - t) < Math.abs(best[0] - t))) best = q; });
      return best;
    }
    function fmtT(t) {
      const r = o.unit === "min" ? String(Math.round(t)) : String(Math.round(t * 10) / 10);
      return r + (o.unit === "min" ? " min" : " h");
    }
    function fmtV(v) { return v.toFixed(traced ? 2 : 3); }
    function idle() {
      xh && xh.setAttribute("visibility", "hidden");
      // each arm's marker carries its own visibility="visible" from show(), which outranks the group's hidden; put
      // them away too, or they stay on the chart after the pointer has left it (15 Oct 2026, found on the move)
      if (xh) xh.querySelectorAll(".bc-xh-pt").forEach(function (m) { m.setAttribute("visibility", "hidden"); });
      read.classList.remove("is-on");
      read.innerHTML = g && g.narrow
        ? '<span class="bc-hint">' + (st.touch ? "Tap or drag across the chart to read it" : "Point at the chart to read both arms") + "</span>"
        : "";
    }
    function show(i, speak) {
      const ts = times();
      if (!ts.length) { st.i = -1; idle(); return; }
      i = Math.max(0, Math.min(ts.length - 1, i));
      st.i = i;
      const t = ts[i], x = g.X(t).toFixed(1);
      const l = xh.querySelector(".bc-xh-l");
      l.setAttribute("x1", x); l.setAttribute("x2", x);
      xh.setAttribute("visibility", "visible");
      let html = '<b>' + (traced ? "≈ " : "") + fmtT(t) +
        (o.unit === "min" && t >= 60 ? '<small>' + (Math.round(t / 6) / 10) + " h</small>" : "") + "</b>";
      const words = [];
      o.series.forEach(function (sr, k) {
        const m = xh.querySelector('.bc-xh-pt[data-k="' + k + '"]');
        const q = st.off[k] ? null : at(sr, t);
        if (!q) { m.setAttribute("visibility", "hidden"); }
        else {
          const cx = g.X(q[0]), cy = g.Y(q[1]);
          if (m.tagName === "rect") { m.setAttribute("x", (cx - 5).toFixed(1)); m.setAttribute("y", (cy - 5).toFixed(1)); }
          else { m.setAttribute("cx", cx.toFixed(1)); m.setAttribute("cy", cy.toFixed(1)); }
          m.setAttribute("visibility", "visible");
        }
        if (st.off[k]) return;
        html += '<span class="bc-rv ' + sr.cls + '"><i class="' + (sr.shape || "round") + '"></i>' + esc(g.narrow && sr.short ? sr.short : sr.name) +
          "<em>" + (q ? fmtV(q[1]) : "no reading") + "</em></span>";
        words.push(sr.name.toLowerCase() + " " + (q ? fmtV(q[1]) : "no reading"));
      });
      read.innerHTML = html;
      read.classList.add("is-on");
      if (speak) say.textContent = (traced ? "About " : "") + fmtT(t).replace(" min", " minutes").replace(" h", " hours") + ": " + words.join(", ") + ".";
    }
    function fromX(clientX) {
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const u = (clientX - r.left) * (g.W / r.width);
      const ts = times();
      if (!ts.length) return;
      let bi = 0, bd = Infinity;
      ts.forEach(function (t, i) { const dd = Math.abs(g.X(t) - u); if (dd < bd) { bd = dd; bi = i; } });
      if (bi !== st.i || read.classList.contains("is-on") === false) show(bi, true);
    }
    let kb = false;                                 // reading by keyboard: leaving the plot puts the reading away
    plot.addEventListener("pointerdown", function (e) {
      st.down = true;
      kb = false;
      if (e.pointerType !== "mouse") st.touch = true;
      fromX(e.clientX);
    });
    plot.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse" || st.down) fromX(e.clientX); });
    plot.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && !plot.matches(":focus-visible")) { st.i = -1; idle(); } });
    window.addEventListener("pointerup", function () { st.down = false; }, { passive: true });
    window.addEventListener("pointercancel", function () { st.down = false; }, { passive: true });
    // a tap anywhere else puts a touch reading away
    document.addEventListener("pointerdown", function (e) {
      if (st.i >= 0 && !el.contains(e.target)) { st.i = -1; idle(); }
    }, { passive: true });
    plot.addEventListener("keydown", function (e) {
      const n = times().length;
      let i = st.i;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") i = i < 0 ? 0 : i + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") i = i < 0 ? n - 1 : i - 1;
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = n - 1;
      else if (e.key === "Escape") { st.i = -1; idle(); return; }
      else return;
      kb = true;
      e.preventDefault();
      show(i, true);
    });
    plot.addEventListener("focus", function () { if (st.i < 0 && plot.matches(":focus-visible")) { kb = true; show(0, true); } });
    // a tap on an arm's name keeps the reading (the name's button takes the focus); a tap elsewhere puts it away
    plot.addEventListener("blur", function (e) {
      if (!kb || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      st.i = -1; idle();
    });

    function toggle(k) {
      const keep = st.i >= 0 ? times()[st.i] : null;
      st.off[k] = !st.off[k];
      keys[k].setAttribute("aria-pressed", st.off[k] ? "false" : "true");
      svg.querySelectorAll('[data-k="' + k + '"]').forEach(function (e) {
        if (e.classList.contains("bc-s") || e.classList.contains("bc-ann")) e.classList.toggle("is-off", st.off[k]);
      });
      say.textContent = o.series[k].name + (st.off[k] ? " hidden." : " shown.");
      if (keep != null) {
        const ts = times();
        let bi = -1, bd = Infinity;
        ts.forEach(function (t, i) { if (Math.abs(t - keep) < bd) { bd = Math.abs(t - keep); bi = i; } });
        if (bi >= 0) show(bi, false); else idle();
      } else idle();
    }

    // ---- the notes draw on once, when the chart is well in view; still and complete with reduced motion ----
    function apply(t) {
      if (!svg) return;
      svg.querySelectorAll("[data-a]").forEach(function (e) {
        const d = parseFloat(e.getAttribute("data-d")) || 0, a = e.getAttribute("data-a");
        if (a === "line") {
          const p = ease(clamp01((t - d) / 0.6)), y0 = +e.getAttribute("data-from"), y1 = +e.getAttribute("data-to");
          e.setAttribute("y2", (y0 + (y1 - y0) * p).toFixed(1));
        } else if (a === "band") {
          e.setAttribute("width", (+e.getAttribute("data-w") * ease(clamp01((t - d - 0.45) / 0.8))).toFixed(1));
        } else if (a === "label") {
          e.style.opacity = clamp01((t - d - 0.95) / 0.45).toFixed(3);
        }
      });
    }
    function start() {
      if (!end) { st.done = true; return; }
      if (!window.XP || XP.reduced) { st.done = true; apply(end); return; }
      const loop = XP.loop(el, function (dt) {
        if (st.done) return;
        const r = el.getBoundingClientRect(), vh = window.innerHeight;
        if (r.top > vh * 0.75 || r.bottom < vh * 0.25) return;      // wait until it is well in view
        st.t += dt;
        if (st.t >= end) { st.t = end; st.done = true; loop.stop(); }
        apply(st.t);
      });
    }

    render();
    start();
    return { render: render, state: st, el: el };
  }

  const drawn = [];
  document.querySelectorAll(".bc[data-chart]").forEach(function (el) {
    const make = CHARTS[el.getAttribute("data-chart")];
    const o = make && make();
    if (!o) return;                 // not a growth chart, or no data: leave the host (and its image) alone
    drawn.push({ el: el, o: o, w: -1, live: null });
  });
  // drawn at the host's width, and again when that width changes enough to matter
  function render(force) {
    drawn.forEach(function (d) {
      const w = Math.round(d.el.clientWidth) || 640;
      if (!force && Math.abs(w - d.w) < 24) return;
      d.w = w; d.o.w = w;
      if (!d.live) d.live = live(d.el, d.o); else d.live.render();
    });
  }
  render(true);
  let resizeT = null;
  function later() {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { render(false); }, 160);
  }
  window.addEventListener("resize", later, { passive: true });
  // The page turns from the dark hero theme to the paper record under the charts, and the paper layout is
  // narrower (a 664px host at load is 529px in the record at 1440), so the window never resizes but each chart's
  // own box does. Watching the boxes keeps every chart drawn at the width it is shown at.
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(later);
    drawn.forEach(function (d) { ro.observe(d.el); });
  }

  window.__growthCharts = { charts: Object.keys(CHARTS), growth: growth, parseCSV: parseCSV,
    live: drawn.map(function (d) { return d.live; }) };
})();
