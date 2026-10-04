// Bioreactor record — data charts, drawn from the numbers rather than pasted as screenshots.
//
// Every chart host is `<div class="bc" data-chart="name">`. If a chart has no data here the host keeps
// whatever it already contains (the figure's image), so a chart can be swapped in without touching the
// markup. Fits and R² are computed at load, so a figure cannot disagree with its own data.
(function () {
  const MINUS = "−";

  // ---------- TiO₂ calibration, Test 1 ----------
  // Source: the team's workbook "0823_Inline photometer to biodrop.xlsx" (sheet 1), mass in mg.
  // The photometer was read at every mass from 2 to 60 mg, the Bio-Drop from 2 to 46 mg.
  const T1_MASS_FROM = 2;
  const T1_PHOTOMETER = [0.08, 0.1321, 0.2035, 0.2635, 0.3186, 0.3598, 0.4193, 0.4722, 0.5238, 0.583,
    0.6118, 0.6798, 0.7149, 0.7732, 0.8683, 0.93, 0.9722, 1.0397, 1.1386, 1.179, 1.168, 1.2003, 1.2529,
    1.3066, 1.3725, 1.4066, 1.4619, 1.5182, 1.5708, 1.6078, 1.654, 1.6912, 1.7305, 1.7885, 1.832, 1.8893,
    1.9331, 1.9842, 2.0517, 2.0818, 2.1254, 2.1508, 2.1767, 2.2083, 2.2323, 2.2529, 2.2934, 2.345, 2.3674,
    2.4232, 2.4502, 2.4521, 2.4801, 2.5022, 2.5225, 2.5504, 2.572, 2.6094, 2.6199];
  const T1_BIODROP = [0.128, 0.223, 0.219, 0.272, 0.325, 0.371, 0.425, 0.476, 0.529, 0.587, 0.639, 0.689,
    0.747, 0.799, 0.864, 0.964, 1.021, 1.067, 1.12, 1.179, 1.219, 1.258, 1.335, 1.386, 1.447, 1.503, 1.551,
    1.602, 1.664, 1.717, 1.773, 1.832, 1.9, 1.998, 1.968, 2.5, 2.115, 2.252, 2.357, 2.276, 2.48, 2.52, 2.46,
    2.53, 2.55];
  const T1_EXCLUDED = [37];        // BioDrop handling error, off the trend of its neighbours
  const T1_PLOTTED_TO = 41;        // the extent of the team's own Test 1 agreement figure

  // Traced series are filled in from traced chart images; each carries its own provenance note.
  const TRACED = window.BIO_TRACED || {};

  // ---------- helpers ----------
  function fit(pts) {
    const n = pts.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; syy += p[1] * p[1]; });
    const k = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const c = (sy - k * sx) / n;
    const my = sy / n;
    let ssr = 0, sst = 0;
    pts.forEach(function (p) { const r = p[1] - (k * p[0] + c); ssr += r * r; sst += (p[1] - my) * (p[1] - my); });
    return { k: k, c: c, r2: 1 - ssr / sst, n: n };
  }
  function num(v, dp) { return (v < 0 ? MINUS : "") + Math.abs(v).toFixed(dp); }
  // three significant figures for the coefficients (a slope of 0.0307 OD per mg must not print as 0.03), and a
  // fourth decimal on R² once it is above 0.99, where 0.9997 and 0.9948 would otherwise both read "1.000"
  function sig(v) { return Math.abs(v) >= 1 ? Math.abs(v).toFixed(2) : String(parseFloat(Math.abs(v).toPrecision(3))); }
  function fitText(f) {
    return "y = " + (f.k < 0 ? MINUS : "") + sig(f.k) + "x " + (f.c < 0 ? MINUS : "+") + " " + sig(f.c) +
      " · R² " + f.r2.toFixed(f.r2 >= 0.99 ? 4 : 3) + " · n " + f.n;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  let uid = 0;
  function draw(o) {
    // Drawn at the width it is shown at, so the type is the size the stylesheet says. A fixed
    // 640-unit drawing squeezed into a phone's column shrank the 10px ticks to about 4px.
    const W = Math.round(Math.min(640, Math.max(260, o.w || 640)));
    const narrow = W < 480;
    const H = narrow ? Math.round(W * 0.92) : (o.h || 400);
    const L = narrow ? 50 : 58, R = narrow ? 12 : 18, T = 16, B = narrow ? 46 : 50;
    const id = "bc-clip-" + (++uid);
    const X = function (v) { return L + (v - o.x.min) / (o.x.max - o.x.min) * (W - L - R); };
    const Y = function (v) { return H - B - (v - o.y.min) / (o.y.max - o.y.min) * (H - T - B); };
    const f2 = function (v) { return v.toFixed(1); };
    let s = '<svg class="bc-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(o.aria) + '">';
    s += '<defs><clipPath id="' + id + '"><rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/></clipPath></defs>';

    // every other x label when they would crowd; the grid keeps every line
    const every = (W - L - R) / ((o.x.max - o.x.min) / o.x.step) < 34 ? 2 : 1;
    for (let v = o.x.min, k = 0; v <= o.x.max + 1e-9; v += o.x.step, k++) {
      s += '<line class="bc-grid" x1="' + f2(X(v)) + '" y1="' + T + '" x2="' + f2(X(v)) + '" y2="' + (H - B) + '"/>';
      if (k % every === 0) s += '<text class="bc-tick x" x="' + f2(X(v)) + '" y="' + (H - B + 17) + '">' + num(v, o.x.dp) + "</text>";
    }
    for (let v = o.y.min; v <= o.y.max + 1e-9; v += o.y.step) {
      s += '<line class="bc-grid" x1="' + L + '" y1="' + f2(Y(v)) + '" x2="' + (W - R) + '" y2="' + f2(Y(v)) + '"/>';
      s += '<text class="bc-tick y" x="' + (L - 8) + '" y="' + f2(Y(v) + 3.5) + '">' + num(v, o.y.dp) + "</text>";
    }
    const xl = narrow && o.x.short ? o.x.short : o.x.label, yl = narrow && o.y.short ? o.y.short : o.y.label;
    s += '<text class="bc-ax" x="' + ((L + W - R) / 2) + '" y="' + (H - 10) + '">' + esc(xl) + "</text>";
    s += '<text class="bc-ax" transform="translate(15 ' + ((T + H - B) / 2) + ') rotate(-90)">' + esc(yl) + "</text>";

    s += '<g clip-path="url(#' + id + ')">';
    if (o.identity) {
      const lo = Math.max(o.x.min, o.y.min), hi = Math.min(o.x.max, o.y.max);
      s += '<line class="bc-id" x1="' + f2(X(lo)) + '" y1="' + f2(Y(lo)) + '" x2="' + f2(X(hi)) + '" y2="' + f2(Y(hi)) + '"/>';
    }
    o.series.forEach(function (sr) {
      if (sr.line) {
        s += '<polyline class="bc-line ' + sr.cls + '" points="' +
          sr.pts.map(function (p) { return f2(X(p[0])) + "," + f2(Y(p[1])); }).join(" ") + '"/>';
      }
      if (sr.fit) {
        const a = o.x.min, b = o.x.max;
        s += '<line class="bc-fit ' + sr.cls + '" x1="' + f2(X(a)) + '" y1="' + f2(Y(sr.fit.k * a + sr.fit.c)) +
          '" x2="' + f2(X(b)) + '" y2="' + f2(Y(sr.fit.k * b + sr.fit.c)) + '"/>';
      }
    });
    s += "</g>";
    o.series.forEach(function (sr) {
      const mark = function (p, extra) {
        const cx = f2(X(p[0])), cy = f2(Y(p[1]));
        if (sr.shape === "square") return '<rect class="bc-pt ' + sr.cls + extra + '" x="' + (cx - 3.4) + '" y="' + (cy - 3.4) + '" width="6.8" height="6.8"/>';
        return '<circle class="bc-pt ' + sr.cls + extra + '" cx="' + cx + '" cy="' + cy + '" r="3.6"/>';
      };
      sr.pts.forEach(function (p) { s += mark(p, ""); });
      (sr.open || []).forEach(function (p) { s += mark(p, " open"); });
    });
    s += "</svg>";

    let legend = '<div class="bc-legend">';
    o.series.forEach(function (sr) {
      legend += '<span class="bc-key ' + sr.cls + '"><i class="' + (sr.shape || "round") + '"></i>' + esc(sr.name) +
        (sr.fit ? " <em>" + fitText(sr.fit) + "</em>" : "") + "</span>";
      if (sr.open && sr.open.length && sr.openName) {
        legend += '<span class="bc-key ' + sr.cls + '"><i class="' + (sr.shape || "round") + ' open"></i>' + esc(sr.openName) + "</span>";
      }
    });
    if (o.identity) legend += '<span class="bc-key id"><i class="dash"></i>y = x</span>';
    legend += "</div>";
    return legend + s;
  }

  // ---------- the charts ----------
  const CHARTS = {
    // Test 1 agreement: Bio-Drop against the raw photometer reading, paired by mass.
    "tio2-t1": function () {
      const keep = [], open = [];
      T1_BIODROP.forEach(function (b, i) {
        const mass = T1_MASS_FROM + i;
        if (mass > T1_PLOTTED_TO) return;
        const p = [T1_PHOTOMETER[i], b];
        (T1_EXCLUDED.indexOf(mass) >= 0 ? open : keep).push(p);
      });
      return {
        aria: "Test 1: BioDrop OD600 against RELEAF photometer OD600 for TiO2 suspensions from 2 to 41 mg, with a least-squares line and the line of identity",
        x: { min: 0, max: 2.5, step: 0.5, dp: 1, label: "RELEAF photometer OD600 (raw)", short: "RELEAF OD600 (raw)" },
        y: { min: 0, max: 2.5, step: 0.5, dp: 1, label: "BioDrop OD600" },
        identity: true,
        series: [{ name: "Test 1, 2–41 mg", cls: "s-photo", pts: keep, open: open, fit: fit(keep),
                   openName: "37 mg, excluded (BioDrop handling error)" }]
      };
    },

    // Test 2 against the ground-truth mass axis (traced).
    "tio2-t2-mass": function () {
      const t = TRACED.tio2_t2_mass;
      if (!t) return null;
      return {
        aria: "Test 2: OD600 of the RELEAF photometer and the BioDrop against TiO2 mass added, each with its own least-squares line",
        x: { min: 0, max: 60, step: 10, dp: 0, label: "TiO₂ added (mg)" },
        y: { min: 0, max: 2, step: 0.5, dp: 1, label: "OD600" },
        series: [
          { name: "RELEAF photometer", cls: "s-photo", pts: t.releaf, fit: fit(t.releaf) },
          { name: "BioDrop", cls: "s-ref", shape: "square", pts: t.biodrop, open: t.biodropExcluded || [],
            fit: fit(t.biodrop), openName: "BioDrop, excluded (breaks monotonicity)" }
        ]
      };
    },

    // Test 2 direct agreement (traced).
    "tio2-t2-identity": function () {
      const t = TRACED.tio2_t2_identity;
      if (!t) return null;
      return {
        aria: "Test 2: RELEAF photometer OD600 against BioDrop OD600 with the line of identity",
        x: { min: 0, max: 2, step: 0.5, dp: 1, label: "BioDrop OD600" },
        y: { min: 0, max: 2, step: 0.5, dp: 1, label: "RELEAF photometer OD600 (raw)", short: "RELEAF OD600 (raw)" },
        identity: true,
        series: [{ name: "Test 2", cls: "s-photo", pts: t.pairs, fit: fit(t.pairs) }]
      };
    },

    // Bacteria growth, cycle 1 and cycle 2 (traced).
    "growth-c1": function () {
      const t = TRACED.growth_c1;
      if (!t) return null;
      return {
        aria: "Cycle 1: OD600 against time in hours for the bioreactor and a flask control",
        x: { min: 0, max: 30, step: 5, dp: 0, label: "Time (h)" },
        y: { min: 0, max: 3, step: 0.5, dp: 1, label: "OD600" },
        series: [
          { name: "Bioreactor", cls: "s-reactor", pts: t.bioreactor, line: true },
          { name: "Flask control", cls: "s-ref", shape: "square", pts: t.flask, line: true }
        ]
      };
    },
    "growth-c2": function () {
      const t = TRACED.growth_c2;
      if (!t) return null;
      return {
        aria: "Cycle 2: OD600 against time in minutes for the bioreactor and a flask control at 37 degrees C",
        x: { min: 0, max: 500, step: 100, dp: 0, label: "Time (min)" },
        y: { min: 0, max: 1, step: 0.2, dp: 1, label: "OD600" },
        series: [
          { name: "Bioreactor", cls: "s-reactor", pts: t.bioreactor, line: true },
          { name: "Flask control", cls: "s-ref", shape: "square", pts: t.flask, line: true }
        ]
      };
    }
  };

  const drawn = [];
  document.querySelectorAll(".bc[data-chart]").forEach(function (el) {
    const make = CHARTS[el.getAttribute("data-chart")];
    const o = make && make();
    if (!o) return;                 // no data: keep the figure's image
    drawn.push({ el: el, o: o, w: -1 });
  });
  // drawn at the host's width, and again when that width changes enough to matter
  function render(force) {
    drawn.forEach(function (d) {
      const w = Math.round(d.el.clientWidth) || 640;
      if (!force && Math.abs(w - d.w) < 24) return;
      d.w = w; d.o.w = w;
      d.el.innerHTML = draw(d.o);
      d.el.classList.add("is-drawn");
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

  window.__bioCharts = { fit: fit, charts: Object.keys(CHARTS) };
})();
