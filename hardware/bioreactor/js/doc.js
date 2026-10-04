// Bioreactor technical record — contents rail (copied from the DiOPAL record; its matrix and I² chart do nothing here).
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
        html += '<div class="mx-c ' + hue + " " + t.toLowerCase() + '">' +
          '<div class="mx-dots">' + ch.lux.map(function () { return "<i></i>"; }).join("") + "</div>" +
          '<div class="mx-v">' + mean.toFixed(ch.unit === "kLux" ? 2 : 0) +
          "<em>" + ch.unit + "</em></div></div>";
      });
    });
    html += '<div class="mx-note">' +
      "Green induces protectant production · red halts it · four replicates per cell</div>";
    el.innerHTML = html;
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

  // Each part lists its own sections under it, read from the record's h3s so the list cannot drift from the
  // headings; only the part being read shows them. Built before polish.js runs, so its scrollspy picks the
  // section entries up with the rest.
  Array.prototype.forEach.call(nav.querySelectorAll(":scope > ol > li > a"), function (a) {
    const part = document.querySelector(a.getAttribute("href"));
    if (!part) return;
    const subs = [];
    for (let el = part.nextElementSibling; el && !el.classList.contains("part"); el = el.nextElementSibling) {
      const h = el.id ? el.querySelector(":scope > h3") : null;
      if (h) subs.push({ id: el.id, h: h });
    }
    if (!subs.length) return;
    const ol = document.createElement("ol");
    ol.className = "rail-sub";
    subs.forEach(function (s) {
      const i = s.h.querySelector("i");
      const num = i ? i.textContent.trim() : "";
      const text = s.h.textContent.replace(/\s+/g, " ").trim().slice(num.length).trim();
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#" + s.id;
      link.title = text;
      const b = document.createElement("b"); b.textContent = num;
      const span = document.createElement("span"); span.textContent = text;
      link.appendChild(b); link.appendChild(span);
      li.appendChild(link);
      ol.appendChild(li);
    });
    a.parentNode.appendChild(ol);
  });
  const parts = Array.prototype.slice.call(nav.querySelectorAll(":scope > ol > li"));

  const links = Array.prototype.slice.call(nav.querySelectorAll("a"));
  const targets = links.map(function (a) {
    const el = document.querySelector(a.getAttribute("href"));
    return el ? { a: a, el: el } : null;
  }).filter(Boolean);
  if (!targets.length) return;

  // The same reading line as polish.js's scrollspy, so the two never disagree about the entry that is lit.
  function update() {
    const line = window.innerHeight * 0.42;
    let active = null;
    targets.forEach(function (t) {
      if (t.el.getBoundingClientRect().top <= line) active = t;
    });
    links.forEach(function (a) { a.classList.toggle("on", !!active && a === active.a); });
    const open = active ? active.a.closest("#doc-nav > ol > li") : null;
    parts.forEach(function (li) { li.classList.toggle("open", li === open); });
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
    // A smooth scroll that never moves focus leaves the skip link pointing at nothing: the
    // next Tab lands back in the header. Give the target focus without scrolling it again.
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, "", a.getAttribute("href"));
  });
})();
