// DiOPAL technical record: the LED spread chart, the section map's numbers, and
// the contents rail.
(function () {
  "use strict";

  /* ---------- spread chart (4.4) ----------
     Drawn from the two lux tables in 4.3, not from a copy of their numbers, so
     the chart cannot disagree with the tables it summarises. Each cell carries
     its reading in data-v and its matched group in data-g (low, mid, high, or
     none for the eight LEDs per colour that were not used).

     The SVG is drawn at the figure's real pixel width rather than scaled from a
     fixed viewBox, so its labels stay at 11px on a phone instead of shrinking
     with the drawing. */
  /* ---------- table numbers for cross-references ----------
     ../js/figures.js numbers tables in document order and resolves a link to
     one from its data-fignum, which it only writes on figures. This page links
     to its tables by name (#tbl-green), so each table is given the number
     figures.js is about to print in its caption. Same order, same count:
     the two cannot disagree. */
  document.querySelectorAll(".doc table").forEach(function (t, i) {
    t.setAttribute("data-fignum", String(i + 1));
  });

  const NS = "http://www.w3.org/2000/svg";
  const TIERS = ["low", "mid", "high"];
  const TIER_NAME = { low: "Low", mid: "Mid", high: "High" };

  function readTable(id) {
    const t = document.getElementById(id);
    if (!t) return null;
    const out = [];
    t.querySelectorAll("td[data-v]").forEach(function (td) {
      const v = parseFloat(td.getAttribute("data-v"));
      if (!isNaN(v)) out.push({ v: v, g: td.getAttribute("data-g") || "none", tag: td.getAttribute("data-tag") || "" });
    });
    return out.length ? out : null;
  }

  function pct(a, b) { return (b - a) / a * 100; }
  function fmtPct(p) { return (p < 10 ? p.toFixed(1) : Math.round(p).toString()) + "%"; }

  function el(name, attrs, text) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  // One colour: every LED on the full axis, then the matched twelve magnified.
  function panel(host, cfg) {
    const leds = readTable(cfg.table);
    if (!leds) return false;
    const vals = leds.map(function (d) { return d.v; });
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const kept = leds.filter(function (d) { return d.g !== "none"; });
    const kv = kept.map(function (d) { return d.v; });
    const klo = Math.min.apply(null, kv), khi = Math.max.apply(null, kv);

    const groups = TIERS.map(function (t) {
      const vs = kept.filter(function (d) { return d.g === t; }).map(function (d) { return d.v; });
      const a = Math.min.apply(null, vs), b = Math.max.apply(null, vs);
      return { t: t, vs: vs, a: a, b: b, p: pct(a, b) };
    });

    // header, in HTML so it wraps on a phone
    const head = document.createElement("div");
    head.className = "sp-head";
    // The two figures the panel exists to show, at a size that reads before the dots do: the
    // spread of all twenty, then the spread inside each matched group of four (low, mid, high).
    head.innerHTML =
      '<span class="sp-name"><i class="sp-sw ' + cfg.hue + '"></i>' + cfg.label + "</span>" +
      '<span class="sp-sum"><span class="sp-stat"><b>' + fmtPct(pct(lo, hi)) + "</b>across all 20</span>" +
      '<i aria-hidden="true">&rarr;</i><span class="sp-stat"><b>' +
      groups.map(function (g) { return fmtPct(g.p); }).join(" &middot; ") +
      "</b>within each matched group</span></span>";
    host.appendChild(head);

    const W = Math.max(280, Math.round(host.clientWidth));
    const H = 196, L = 16, R = 16;
    const fx = function (v) { return L + (v - cfg.full[0]) / (cfg.full[1] - cfg.full[0]) * (W - L - R); };
    const zx = function (v) { return L + (v - cfg.zoom[0]) / (cfg.zoom[1] - cfg.zoom[0]) * (W - L - R); };

    const svg = el("svg", {
      class: "sp-svg " + cfg.hue, width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": cfg.label + ": twenty LEDs from " + lo + " to " + hi + " " + cfg.unit +
        ", a " + fmtPct(pct(lo, hi)) + " spread. The twelve kept form three groups: " +
        groups.map(function (g) {
          return TIER_NAME[g.t].toLowerCase() + " " + g.a + " to " + g.b + " (" + fmtPct(g.p) + ")";
        }).join(", ") + ". The other eight were not used."
    });

    // overall spread, drawn as a dimension line with its figure in the gap
    const yb = 16;
    const dim = "ALL 20 · " + fmtPct(pct(lo, hi));
    const mid = (fx(lo) + fx(hi)) / 2, gap = dim.length * 3.4 + 8;
    svg.appendChild(el("line", { class: "sp-br", x1: fx(lo), y1: yb, x2: mid - gap, y2: yb }));
    svg.appendChild(el("line", { class: "sp-br", x1: mid + gap, y1: yb, x2: fx(hi), y2: yb }));
    svg.appendChild(el("line", { class: "sp-br", x1: fx(lo), y1: yb - 4, x2: fx(lo), y2: yb + 4 }));
    svg.appendChild(el("line", { class: "sp-br", x1: fx(hi), y1: yb - 4, x2: fx(hi), y2: yb + 4 }));
    svg.appendChild(el("text", { class: "sp-dim", x: mid, y: yb + 4 }, dim));

    // the zoomed window, marked on the full axis
    const ya = 66;
    svg.appendChild(el("rect", { class: "sp-win", x: fx(cfg.zoom[0]), y: ya - 12, width: fx(cfg.zoom[1]) - fx(cfg.zoom[0]), height: 16, rx: 2 }));

    // every LED, duplicates stacked upward
    const seen = {};
    leds.slice().sort(function (a, b) { return a.v - b.v; }).forEach(function (d) {
      const k = d.v.toFixed(3);
      const n = seen[k] = (seen[k] || 0) + 1;
      const c = el("circle", {
        class: "sp-dot " + (d.g === "none" ? "off" : "t-" + d.g),
        cx: fx(d.v), cy: ya - 20 - (n - 1) * 9, r: 3.8
      });
      c.appendChild(el("title", {}, (d.tag ? d.tag + ": " : "") + d.v + " " + cfg.unit +
        (d.g === "none" ? ", not used" : ", " + d.g + " group")));
      svg.appendChild(c);
    });

    // full axis
    svg.appendChild(el("line", { class: "sp-ax", x1: L, y1: ya, x2: W - R, y2: ya }));
    cfg.fullTicks.forEach(function (v) {
      svg.appendChild(el("line", { class: "sp-tk", x1: fx(v), y1: ya, x2: fx(v), y2: ya + 4 }));
      svg.appendChild(el("text", { class: "sp-tl", x: fx(v), y: ya + 17 }, v.toFixed(cfg.dp)));
    });

    // guides from the window down to the magnified axis
    const yz = 168;
    svg.appendChild(el("path", {
      class: "sp-guide",
      d: "M" + fx(cfg.zoom[0]) + " " + (ya + 4) + " L" + L + " " + (yz - 62) +
         " M" + fx(cfg.zoom[1]) + " " + (ya + 4) + " L" + (W - R) + " " + (yz - 62)
    }));

    // the three matched groups
    groups.forEach(function (g) {
      const a = zx(g.a) - 7, b = zx(g.b) + 7;
      svg.appendChild(el("rect", { class: "sp-cap t-" + g.t, x: a, y: yz - 44, width: b - a, height: 30, rx: 6 }));
      const n = {};
      g.vs.slice().sort().forEach(function (v) {
        const k = v.toFixed(3);
        const i = n[k] = (n[k] || 0) + 1;
        const same = g.vs.filter(function (u) { return u.toFixed(3) === k; }).length;
        const off = (i - 1 - (same - 1) / 2) * 7.5;
        svg.appendChild(el("circle", { class: "sp-dot t-" + g.t, cx: zx(v), cy: yz - 29 + off, r: 3.4 }));
      });
      const lbl = el("text", { class: "sp-gl", x: (zx(g.a) + zx(g.b)) / 2, y: yz - 52 });
      lbl.appendChild(el("tspan", { class: "sp-gn" }, TIER_NAME[g.t] + " "));
      lbl.appendChild(el("tspan", {}, fmtPct(g.p)));
      svg.appendChild(lbl);
    });

    // magnified axis
    svg.appendChild(el("line", { class: "sp-ax", x1: L, y1: yz, x2: W - R, y2: yz }));
    cfg.zoomTicks.forEach(function (v) {
      svg.appendChild(el("line", { class: "sp-tk", x1: zx(v), y1: yz, x2: zx(v), y2: yz + 4 }));
      svg.appendChild(el("text", { class: "sp-tl", x: zx(v), y: yz + 17 }, v.toFixed(cfg.zdp)));
    });
    svg.appendChild(el("text", { class: "sp-unit", x: W - R, y: yz - 6 }, cfg.unit));
    svg.appendChild(el("text", { class: "sp-unit", x: W - R, y: ya - 6 }, cfg.unit));

    host.appendChild(svg);
    return true;
  }

  const PANELS = [
    { table: "tbl-green", hue: "green", label: "Green LEDs at 5 V", unit: "kLux",
      full: [1.96, 2.58], fullTicks: [2.0, 2.1, 2.2, 2.3, 2.4, 2.5], dp: 1,
      zoom: [2.32, 2.43], zoomTicks: [2.32, 2.34, 2.36, 2.38, 2.40, 2.42], zdp: 2 },
    { table: "tbl-red", hue: "red", label: "Red LEDs at 5 V", unit: "lux",
      full: [350, 446], fullTicks: [360, 380, 400, 420, 440], dp: 0,
      zoom: [386, 435], zoomTicks: [390, 400, 410, 420, 430], zdp: 0 },
  ];

  const chart = document.getElementById("spread-chart");
  if (chart) {
    let lastW = 0;
    const draw = function () {
      const w = Math.round(chart.clientWidth);
      if (!w || w === lastW) return;
      lastW = w;
      chart.innerHTML = "";
      PANELS.forEach(function (cfg) {
        const p = document.createElement("div");
        p.className = "sp-panel " + cfg.hue;
        chart.appendChild(p);
        if (!panel(p, cfg)) chart.removeChild(p);
      });
    };
    draw();
    let queued = false;
    const again = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; draw(); });
    };
    if ("ResizeObserver" in window) new ResizeObserver(again).observe(chart);
    else window.addEventListener("resize", again);
    // rAF is not delivered in a background tab; a late resize must still land
    window.addEventListener("resize", function () { setTimeout(draw, 120); });
  }

  /* ---------- the two schematics on a phone ----------
     Both drawings are 660 units wide. Shared autodraw rules keep such drawings
     at 640px and let them scroll, which on a phone hid half the array plate and
     all but the first two boxes of the drive chain. Each is cropped instead to
     the part that carries it: the array itself (its side notes are repeated in
     the caption), and the bus, the three MOSFETs and the six columns (the
     software and Arduino boxes are named in the caption). */
  // The test is the figure's own width, not the viewport's: the shared rule
  // holds the drawing at 640px, so any column narrower than that (a phone, or
  // a window between 680 and 745px) would otherwise scroll it sideways.
  const FULL = 640;
  function cropOnPhone(sel, narrowBox) {
    const fig = document.querySelector(sel);
    const svg = fig && fig.querySelector("svg");
    if (!svg) return;
    const wide = svg.getAttribute("viewBox");
    let was = null;
    const fit = function () {
      const cs = getComputedStyle(fig);
      const inner = fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const narrow = inner > 0 && inner < FULL;
      if (narrow === was) return;
      was = narrow;
      fig.classList.toggle("narrow", narrow);
      svg.setAttribute("viewBox", narrow ? narrowBox : wide);
    };
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(fig);
    window.addEventListener("resize", fit);
  }
  cropOnPhone(".autodraw.layout", "160 8 338 272");
  cropOnPhone(".autodraw.drive", "284 18 324 322");

  /* ---------- part numbers: a balloon and its name light up together ----------
     Figures 14 (the parts plate) and 16 (the section) number the parts the same
     way, and their captions name them by number. Pointing at a name or a balloon
     lights every place that number appears, so a reader never has to hold a
     number in mind while scanning a drawing for it. Hover only: the captions
     already say everything this shows. */
  const keyed = Array.prototype.slice.call(document.querySelectorAll(".doc [data-p]"));
  function light(el, on) {
    el.getAttribute("data-p").split(" ").forEach(function (p) {
      document.querySelectorAll('.doc [data-p~="' + p + '"]').forEach(function (k) { k.classList.toggle("hot", on); });
    });
  }
  keyed.forEach(function (el) {
    el.addEventListener("mouseenter", function () { light(el, true); });
    el.addEventListener("mouseleave", function () { light(el, false); });
  });

  /* ---------- section map numbers ----------
     ../js/toc.js numbers its cards 01, 02 ... in document order. This record
     starts at section 2 (section 1 is the 3D walkthrough above it), so the map
     takes each card's number from its own part instead. Runs once every script
     has, which is when the map exists. */
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".doc-map .map-card").forEach(function (card) {
      const part = document.querySelector(card.getAttribute("href"));
      const num = card.querySelector(".map-n");
      const n = part && parseInt(part.getAttribute("data-n"), 10);
      if (num && n) num.textContent = (n < 10 ? "0" : "") + n;
    });
  });

  /* ---------- contents rail ---------- */
  const nav = document.getElementById("doc-nav");
  if (!nav) return;
  const links = Array.prototype.slice.call(nav.querySelectorAll("a"));
  const targets = links.map(function (a) {
    const t = document.querySelector(a.getAttribute("href"));
    return t ? { a: a, el: t } : null;
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
    const t = document.querySelector(a.getAttribute("href"));
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    // A smooth scroll that never moves focus leaves the skip link pointing at nothing: the
    // next Tab lands back in the header. Give the target focus without scrolling it again.
    if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
    t.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, "", a.getAttribute("href"));
  });
})();
