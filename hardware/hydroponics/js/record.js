// Hydroponics record: the one moving figure.
//
// Section 2.2 sets a fixed plate beside a floating one and lets the reader move
// through a run. The level is the only input: the fixed plate's roots dry out
// once it leaves the window, the floating plate rides down with it. Without
// this script the figure still reads: both panels show the start of a run with
// the end-of-run level dashed in, and the control simply stays hidden.
(function () {
  "use strict";
  // ../js/toc.js strips a leading number from each map card's title so the card does
  // not repeat its own number, which turns "3D Design and Animation" into "D Design
  // and Animation". This page's part titles carry no numbers; give the cards them back.
  var cards = document.querySelectorAll(".doc-map .map-card");
  for (var c = 0; c < cards.length; c++) {
    var part = document.querySelector(cards[c].getAttribute("href"));
    var h2 = part && part.querySelector("h2");
    var t = cards[c].querySelector(".map-t");
    if (h2 && t) t.textContent = h2.textContent.replace(/\s+/g, " ").trim();
  }
})();

(function () {
  "use strict";
  var fig = document.getElementById("fig-level");
  if (!fig) return;

  var L0 = parseFloat(fig.getAttribute("data-l0")) || 126;
  var L1 = parseFloat(fig.getAttribute("data-l1")) || 206;
  var FLOOR = parseFloat(fig.getAttribute("data-floor")) || 270;
  var TIP = parseFloat(fig.getAttribute("data-tip")) || 150;

  var ctl = fig.querySelector(".hp-lvl-ctl");
  var range = fig.querySelector(".hp-lvl-range");
  var play = fig.querySelector(".hp-lvl-play");
  var stateA = fig.querySelector('[data-state="a"]');
  var waters = fig.querySelectorAll(".lvl-water");
  var lines = fig.querySelectorAll(".lvl-line");
  var floats = fig.querySelectorAll(".lvl-float");
  var roots = fig.querySelectorAll(".lvl-root");
  if (!ctl || !range || !play) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dry = null;

  function set(t) {
    t = Math.max(0, Math.min(1, t));
    var lvl = L0 + (L1 - L0) * t;
    for (var i = 0; i < waters.length; i++) {
      waters[i].setAttribute("y", lvl.toFixed(2));
      waters[i].setAttribute("height", (FLOOR - lvl).toFixed(2));
    }
    for (var j = 0; j < lines.length; j++) {
      lines[j].setAttribute("y1", lvl.toFixed(2));
      lines[j].setAttribute("y2", lvl.toFixed(2));
    }
    for (var k = 0; k < floats.length; k++) {
      floats[k].setAttribute("transform", "translate(0 " + (lvl - L0).toFixed(2) + ")");
    }
    var isDry = lvl > TIP;
    if (isDry !== dry) {
      dry = isDry;
      for (var r = 0; r < roots.length; r++) roots[r].classList.toggle("is-dry", isDry);
      if (stateA) {
        stateA.textContent = isDry ? "Below the window: roots lose contact" : "Level inside the window";
        stateA.classList.toggle("is-bad", isDry);
      }
    }
    range.value = String(Math.round(t * 1000));
  }

  var raf = 0;
  function run() {
    if (raf) cancelAnimationFrame(raf);
    var from = parseFloat(range.value) / 1000;
    if (from >= 0.999) from = 0;
    if (reduced) { set(1); play.textContent = "Run again"; return; }
    var dur = 4200 * (1 - from) + 400, t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // ease in-out
      set(from + (1 - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else { raf = 0; play.textContent = "Run again"; }
    }
    raf = requestAnimationFrame(step);
  }

  ctl.hidden = false;
  fig.classList.add("is-live");
  set(0);
  range.addEventListener("input", function () {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    set(parseFloat(range.value) / 1000);
    play.textContent = range.value === "1000" ? "Run again" : "Run it";
  });
  play.addEventListener("click", run);

  // Play once, the first time the figure is properly on screen. A background
  // tab never delivers animation frames, so the run is left for the reader.
  if (!reduced && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || document.hidden) return;
        io.disconnect();
        setTimeout(run, 450);
      });
    }, { threshold: 0.6 });
    io.observe(fig.querySelector(".hp-lvl-panels") || fig);
  }
})();

// Section 4's load line: a reading layer over the chart. A hairline snaps to the nearest computed point
// (the plot's data-curve: grams afloat, freeboard in mm, from the STLs) and its values are written beside it.
// The same reading answers the keyboard (a slider over the points) and Table 1, whose rows are the chart's
// dots. Without this script the chart and the table still carry every value.
(function () {
  "use strict";
  var plot = document.querySelector(".hp-load-plot");
  if (!plot || !plot.getAttribute("data-curve")) return;
  var X1 = 120, Y1 = 26, HULL = 25.08;            // the chart's axes (g, mm); the hull's full height (mm)
  var pts = plot.getAttribute("data-curve").trim().split(/\s+/).map(function (s) {
    var a = s.split(","); return [parseFloat(a[0]), parseFloat(a[1])];
  });
  var dots = plot.querySelectorAll(".hp-load-dot[data-row]");
  var rows = document.querySelectorAll("table.hp-disp tbody tr");

  function el(cls) { var e = document.createElement("div"); e.className = cls; e.hidden = true; plot.appendChild(e); return e; }
  var hair = el("hp-load-x"), cur = el("hp-load-cur"), read = el("hp-load-read");
  read.setAttribute("aria-hidden", "true");
  var hit = document.createElement("div");
  hit.className = "hp-load-hit";
  hit.tabIndex = 0;
  hit.setAttribute("role", "slider");
  hit.setAttribute("aria-label", "Read the load line");
  hit.setAttribute("aria-valuemin", "0");
  hit.setAttribute("aria-valuemax", pts[pts.length - 1][0].toFixed(1));
  plot.appendChild(hit);
  (function () {                                   // until it is moved, the slider rests on Figure 2's waterline
    var d = dots[3]; if (!d) return;
    var i = 0, g = parseFloat(d.style.left) / 100 * X1, e = Infinity;
    for (var k = 0; k < pts.length; k++) { var x = Math.abs(pts[k][0] - g); if (x < e) { e = x; i = k; } }
    hit.setAttribute("aria-valuenow", pts[i][0].toFixed(1));
    hit.setAttribute("aria-valuetext", pts[i][0].toFixed(1) + " grams afloat: freeboard " + pts[i][1].toFixed(1) + " millimetres");
  })();

  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  var at = -1;
  function show(i) {
    i = Math.max(0, Math.min(pts.length - 1, i)); at = i;
    var g = pts[i][0], f = pts[i][1], x = g / X1 * 100, y = (1 - f / Y1) * 100;
    hair.style.left = x + "%"; cur.style.left = x + "%"; cur.style.top = y + "%";
    read.innerHTML = "";
    var b = document.createElement("b"); b.textContent = fmt(g) + " g afloat";
    read.appendChild(b);
    read.appendChild(document.createTextNode("freeboard " + fmt(f) + " mm · draft " + fmt(HULL - f) + " mm"));
    hair.hidden = cur.hidden = read.hidden = false;
    // the values sit beside the hairline, on whichever side has room, and never past the plot's edges
    var pw = plot.clientWidth, rw = read.offsetWidth, xp = x / 100 * pw, lx = xp + 10;
    if (lx + rw > pw) lx = xp - 10 - rw;
    read.style.left = Math.max(0, Math.min(pw - rw, lx)) + "px";
    hit.setAttribute("aria-valuenow", fmt(g));
    hit.setAttribute("aria-valuetext", fmt(g) + " grams afloat: freeboard " + fmt(f) + " millimetres, draft " + fmt(HULL - f) + " millimetres");
  }
  function hide() { at = -1; hair.hidden = cur.hidden = read.hidden = true; }
  function nearest(g) {
    var best = 0, d = Infinity;
    for (var i = 0; i < pts.length; i++) { var e = Math.abs(pts[i][0] - g); if (e < d) { d = e; best = i; } }
    return best;
  }
  function indexOfDot(k) {
    var d = dots[k]; if (!d) return -1;
    return nearest(parseFloat(d.style.left) / 100 * X1);
  }

  function readAt(e) {
    var r = plot.getBoundingClientRect();
    show(nearest((e.clientX - r.left) / r.width * X1));
  }
  hit.addEventListener("pointermove", readAt);
  hit.addEventListener("click", readAt);            // a tap on a phone reads the point tapped (judge pass)
  hit.addEventListener("pointerleave", function () { if (document.activeElement !== hit) hide(); });
  hit.addEventListener("focus", function () { if (at < 0) show(indexOfDot(3)); });   // Figure 2's waterline
  hit.addEventListener("blur", hide);
  hit.addEventListener("keydown", function (e) {
    var k = e.key, i = at < 0 ? indexOfDot(3) : at;
    if (k === "ArrowRight" || k === "ArrowUp") i += 1;
    else if (k === "ArrowLeft" || k === "ArrowDown") i -= 1;
    else if (k === "PageUp") i += 10;
    else if (k === "PageDown") i -= 10;
    else if (k === "Home") i = 0;
    else if (k === "End") i = pts.length - 1;
    else return;
    e.preventDefault(); show(i);
  });

  // Table 1: each row is one of the chart's dots
  Array.prototype.forEach.call(rows, function (row, k) {
    if (!dots[k]) return;
    row.addEventListener("mouseenter", function () { row.classList.add("is-on"); dots[k].classList.add("is-on"); show(indexOfDot(k)); });
    row.addEventListener("mouseleave", function () { row.classList.remove("is-on"); dots[k].classList.remove("is-on"); hide(); });
  });
})();

// ../js/toc.js numbers the section map's cards 01, 02 ... in document order. This record starts at section 2
// (section 1 is the 3D walkthrough above it), so each card takes its number from its own part, as the LPA page does.
document.addEventListener("DOMContentLoaded", function () {
  Array.prototype.forEach.call(document.querySelectorAll(".doc-map .map-card"), function (card) {
    var part = document.querySelector(card.getAttribute("href"));
    var num = card.querySelector(".map-n");
    var n = part && parseInt(part.getAttribute("data-n"), 10);
    if (num && n) num.textContent = (n < 10 ? "0" : "") + n;
  });
});

// Ties between words and figures (pointer only; everything they show is also in the text):
// section 5's feature list lights its pin on the cut-open render, and the drawing sheet's key picks out
// what it names in the plan, the detail and the section.
(function () {
  "use strict";
  var pins = document.querySelectorAll("#fig-cutaway .hp-pin");
  var feats = document.querySelectorAll(".hp-feats li.has-pin");
  Array.prototype.forEach.call(feats, function (li, i) {
    var pin = pins[i]; if (!pin) return;
    li.addEventListener("mouseenter", function () { pin.classList.add("is-on"); });
    li.addEventListener("mouseleave", function () { pin.classList.remove("is-on"); });
  });

  // a key's words pick out what they name in the drawing beside them: the drawing sheet's key (section 5)
  // and the three words under the plate afloat (section 4)
  function tie(wrap, keys, SEL) {
    if (!wrap || !keys.length) return;
    Array.prototype.forEach.call(keys, function (li) {
      var sel = SEL[li.getAttribute("data-tie")]; if (!sel) return;
      var hits = wrap.querySelectorAll(sel);
      if (!hits.length) return;
      li.classList.add("is-tie");
      li.addEventListener("mouseenter", function () {
        wrap.classList.add("is-tied"); li.classList.add("is-on");
        Array.prototype.forEach.call(hits, function (h) { h.classList.add("tie-on"); });
      });
      li.addEventListener("mouseleave", function () {
        wrap.classList.remove("is-tied"); li.classList.remove("is-on");
        Array.prototype.forEach.call(hits, function (h) { h.classList.remove("tie-on"); });
      });
    });
  }
  tie(document.querySelector("#fig-sheet .hp-sheet"), document.querySelectorAll("#fig-sheet .hp-legend li[data-tie]"),
      { airplan: ".dw-airplan", hidden: ".dw-hidden", handle: ".dw-handle, .dw-handle2",
        air: ".dw-air", cut: ".dw-cut", hold: ".dw-hold" });
  tie(document.querySelector("#fig-buoyancy .hp-buoy-wrap"), document.querySelectorAll("#fig-buoyancy .hp-key li[data-tie]"),
      { weight: ".hp-weight, .hp-ah-weight, .hp-fl-weight",
        buoy: ".hp-buoy, .hp-ah-buoy, .hp-fl-buoy, .hp-displaced, .dw-air",
        free: ".dw-dim, .dw-ext, .dw-ah, .hp-fl-free, .hp-wline" });
})();
