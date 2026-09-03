// DiOPAL technical record — contents rail, condition matrix, and the I² chart.
(function () {

  // ---------- condition matrix ----------
  // The 2 × 3 layout the whole instrument is organised around.
  (function () {
    const el = document.getElementById("matrix");
    if (!el || typeof CHANNELS === "undefined") return;
    const tiers = ["Low", "Mid", "High"];
    let html = '<div class="mx-corner"></div>';
    tiers.forEach(function (t) { html += '<div class="mx-h">' + t + "</div>"; });

    ["green", "red"].forEach(function (hue) {
      html += '<div class="mx-w ' + hue + '"><span></span>' +
        (hue === "green" ? "535 nm" : "670 nm") + "</div>";
      tiers.forEach(function (t) {
        const ch = CHANNELS.filter(function (c) { return c.hue === hue && c.tier === t; })[0];
        const mean = ch.lux.reduce(function (s, v) { return s + v; }, 0) / ch.lux.length;
        html += '<button type="button" class="mx-c ' + hue + " " + t.toLowerCase() +
          '" aria-pressed="false" aria-label="' + t + " " + hue +
          ' channel, mean ' + mean.toFixed(ch.unit === "kLux" ? 2 : 0) + " " + ch.unit +
          '. Show its four LEDs in the matching chart.">' +
          '<div class="mx-dots">' + ch.lux.map(function () { return "<i></i>"; }).join("") + "</div>" +
          '<div class="mx-v">' + mean.toFixed(ch.unit === "kLux" ? 2 : 0) +
          "<em>" + ch.unit + "</em></div></button>";
      });
    });
    html += '<div class="mx-note">' +
      "Green induces protectant production · red halts it · four replicates per cell" +
      '<span class="mx-hint">Choose a condition to find its four LEDs below</span></div>';
    el.innerHTML = html;

    /* ---- link the matrix to the I² chart ----
       The LED matching is the most rigorous work on this page, and it sat as two
       figures that never referred to each other: a grid of conditions here, a
       dot plot of every LED bought further down. Clicking a condition now picks
       out the four units that ended up in it — the question the chart exists to
       answer, and which could not previously be asked. */
    const TIER_INDEX = { low: 0, mid: 1, high: 2 };
    el.addEventListener("click", function (ev) {
      const cell = ev.target.closest(".mx-c");
      if (!cell) return;
      const hue = cell.classList.contains("green") ? "green" : "red";
      const tier = ["low", "mid", "high"].filter(function (t) {
        return cell.classList.contains(t);
      })[0];
      const on = !cell.classList.contains("picked");
      el.querySelectorAll(".mx-c").forEach(function (c) {
        c.classList.remove("picked");
        c.setAttribute("aria-pressed", "false");
      });
      if (on) { cell.classList.add("picked"); cell.setAttribute("aria-pressed", "true"); }

      const chart = document.getElementById("i2-chart");
      if (!chart) return;
      chart.classList.toggle("focused", on);
      chart.querySelectorAll(".i2-dot").forEach(function (d) {
        d.classList.remove("lit");
        if (on && d.classList.contains(hue) && d.classList.contains("t" + TIER_INDEX[tier])) {
          d.classList.add("lit");
        }
      });
    });
  })();

  // ---------- I² chart ----------
  // A dot plot of every LED bought, with the selected groups called out. Values
  // are matched back to the stock list by value, so the chart cannot drift from
  // the numbers in the walkthrough.
  (function () {
    const el = document.getElementById("i2-chart");
    if (!el || typeof LED_STOCK === "undefined") return;

    function panel(hue, label, unit, dp) {
      const stock = LED_STOCK[hue].slice();
      const groups = CHANNELS.filter(function (c) { return c.hue === hue; });

      // consume matched values out of the stock so duplicates are handled once each
      const pool = stock.slice();
      const picked = [];
      groups.forEach(function (g, gi) {
        g.lux.forEach(function (v) {
          const k = pool.indexOf(v);
          if (k >= 0) { pool.splice(k, 1); picked.push({ v: v, g: gi }); }
        });
      });
      const rejects = pool;

      const lo = Math.min.apply(null, stock), hi = Math.max.apply(null, stock);
      const pad = (hi - lo) * 0.08;
      const W = 640, H = 132, L = 12, R = 12;
      const x = function (v) { return L + ((v - lo + pad) / (hi - lo + pad * 2)) * (W - L - R); };

      let s = '<svg viewBox="0 0 ' + W + " " + H + '" class="i2" role="img" aria-label="' +
        label + ' LED measurements">';
      // axis
      s += '<line x1="' + L + '" y1="86" x2="' + (W - R) + '" y2="86" class="i2-ax"/>';
      [lo, (lo + hi) / 2, hi].forEach(function (v) {
        s += '<text x="' + x(v) + '" y="104" class="i2-tick">' + v.toFixed(dp) + "</text>";
      });
      s += '<text x="' + (W - R) + '" y="122" class="i2-unit">' + unit + "</text>";

      // tier bands over the three selected groups
      const TIER = ["Low", "Mid", "High"];
      groups.forEach(function (g, gi) {
        const vs = g.lux, a = x(Math.min.apply(null, vs)), b = x(Math.max.apply(null, vs));
        s += '<rect x="' + (a - 7) + '" y="30" width="' + (b - a + 14) + '" height="48" rx="4" class="i2-band t' + gi + '"/>';
        s += '<text x="' + ((a + b) / 2) + '" y="24" class="i2-band-l t' + gi + '">' + TIER[gi] + "</text>";
      });

      // rejected units
      rejects.forEach(function (v) {
        s += '<circle cx="' + x(v) + '" cy="86" r="3.4" class="i2-dot rej"/>';
      });
      // selected units
      picked.forEach(function (p) {
        s += '<circle cx="' + x(p.v) + '" cy="54" r="4.6" class="i2-dot sel ' + hue + ' t' + p.g + '"/>';
      });

      return '<div class="i2-panel ' + hue + '">' +
        '<div class="i2-h"><span class="i2-sw"></span>' + label +
        '<b>' + picked.length + " kept</b><i>" + rejects.length + " rejected</i></div>" +
        s + "</svg></div>";
    }

    el.innerHTML = panel("green", "Green", "kLux", 2) + panel("red", "Red", "Lux", 0);
  })();

  // ---------- contents rail ----------
  const nav = document.getElementById("doc-nav");
  if (!nav) return;
  const links = Array.prototype.slice.call(nav.querySelectorAll("a"));
  const targets = links.map(function (a) {
    const el = document.querySelector(a.getAttribute("href"));
    return el ? { a: a, el: el } : null;
  }).filter(Boolean);
  if (!targets.length) return;

  function update() {
    const line = window.innerHeight * 0.34;
    let active = null;
    targets.forEach(function (t) {
      if (t.el.getBoundingClientRect().top <= line) active = t;
    });
    links.forEach(function (a) { a.classList.toggle("on", !!active && a === active.a); });
  }

  let ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { update(); ticking = false; });
  }, { passive: true });
  window.addEventListener("resize", update);
  update();

  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener("click", function (e) {
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const el = document.querySelector(a.getAttribute("href"));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  });
})();
