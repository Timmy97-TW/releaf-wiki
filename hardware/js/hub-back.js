/* v6: the way back to the top of the page, in place of the topbar (see v.css).
   Past the landing it shows when the reader heads back up or reaches the end,
   and steps aside while they read on down and while the timeline plays. */
(function () {
  "use strict";
  var btn = document.querySelector(".hw-back");
  var hero = document.querySelector(".hero");
  var vtl = document.querySelector(".vtl");
  if (!btn) return;
  btn.hidden = false;
  var queued = false, lastY = window.scrollY, wanted = false;
  function update() {
    queued = false;
    var y = window.scrollY, dy = y - lastY; lastY = y;
    if (dy > 6) wanted = false;                      // reading on down
    else if (dy < -6) wanted = true;                 // heading back up
    var past = hero ? hero.getBoundingClientRect().bottom < window.innerHeight * .25 : y > 600;
    var playing = vtl && vtl.classList.contains("vtl-go") && !vtl.classList.contains("vtl-done");
    var atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 160;
    btn.classList.toggle("on", past && !playing && (wanted || atEnd) && !onText());
  }
  // Never over the footer's words (round 15): near the end, a reader 100px short
  // of the bottom had the three.js credit under the button. Checked against the
  // button's resting box, with 8px to spare.
  var foot = Array.prototype.slice.call(document.querySelectorAll(".hub-foot .outro-meta, .hub-foot .legal p"));
  function onText() {
    var b = btn.getBoundingClientRect(), top = b.top - (btn.classList.contains("on") ? 0 : 12) - 8, left = b.left - 8;
    for (var i = 0; i < foot.length; i++) {
      var r = foot[i].getBoundingClientRect();
      if (r.bottom > top && r.top < b.bottom && r.right > left && r.left < b.right + 8) {
        // the box of a centred paragraph is wider than its words: test the words themselves
        var range = document.createRange(); range.selectNodeContents(foot[i]);
        var rs = range.getClientRects();
        for (var k = 0; k < rs.length; k++) if (rs[k].bottom > top && rs[k].top < b.bottom && rs[k].right > left && rs[k].left < b.right + 8) return true;
      }
    }
    return false;
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", soon, { passive: true });
  window.addEventListener("resize", soon);
  if (vtl && "MutationObserver" in window) new MutationObserver(soon).observe(vtl, { attributes: true, attributeFilter: ["class"] });
  update();
  // back to the top, smoothly where motion is welcome
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    var main = document.getElementById("main");
    if (main) main.focus({ preventScroll: true });
  });
})();

/* v8: the blend between the landing's film and the white bench section (own.css). Owner, 3 Oct 2026, evening: "I don't
   like the cloudy design, looks as if it is dirty ... I was imagining some sort of futuristic tech design like circuit
   lines kind of creeping into the white page."

   A clean tonal gradient from the film's black into the white page, and over it a circuit: buses of thin traces with
   45-degree jogs, vias and pads, coming out from under the film and creeping a little way down into the white, where
   they end. They are lighter than the ground in the dark and darker than it in the light, and they get thinner and
   fewer as they go down, so the circuit resolves into the page instead of stopping on a line.

   - Drawn as SVG (vector, so it is crisp at any pixel ratio), from a seeded generator: every visit draws the same
     circuit for the same width. It is redrawn, without animation, when the band's size changes.
   - It draws itself in once, as the band comes into view (each trace at a steady pen speed, its via or pad arriving
     with it), and then it stops. One faint pulse runs down two of the longest traces every few seconds while the band
     is on screen. Under reduced motion it is simply there, and nothing moves.
   - Parallel traces turn together, with their corners staggered by pitch x tan(22.5 deg) so a bus keeps its spacing
     through the turn, and no two buses cross (lanes are reserved as they are routed).
   - The trace colour is pre-blended with the ground at each depth (opaque stops), so where two segments meet, their
     round caps do not darken the joint. */
(function () {
  "use strict";
  var band = document.querySelector(".bench-blend");
  if (!band) return;
  var svg = band.querySelector(".bench-circuit");
  var NS = "http://www.w3.org/2000/svg";
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // the ground: the film's black to white (also the band's CSS background, so the vias' holes match it)
  var GROUND = [[0, "#05060a"], [0.1, "#07080c"], [0.18, "#101217"], [0.26, "#26292f"], [0.34, "#4a4d53"], [0.42, "#7d7f84"],
                [0.5, "#afb1b4"], [0.58, "#d8d9db"], [0.66, "#efeff0"], [0.74, "#fafafb"], [0.82, "#ffffff"], [1, "#ffffff"]];
  // the traces: a cool light line on the dark, a slate line on the light, fainter toward the end of their reach
  var INK = [[0, "#7f9cc7", 0], [0.035, "#86a4cf", 0.22], [0.12, "#97b5de", 0.74], [0.24, "#c2d3ea", 0.78], [0.34, "#eef2f7", 0.62],
             [0.41, "#55626f", 0.5], [0.56, "#6f7b88", 0.56], [0.8, "#a1abb6", 0.5], [1, "#c8cdd3", 0.36]];

  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function at(T, t) {
    for (var i = 1; i < T.length; i++) if (t <= T[i][0]) {
      var a = T[i - 1], b = T[i], k = (t - a[0]) / (b[0] - a[0]), ca = rgb(a[1]), cb = rgb(b[1]);
      return { c: ca.map(function (v, j) { return v + (cb[j] - v) * k; }), a: a[2] === undefined ? 1 : a[2] + (b[2] - a[2]) * k };
    }
    var z = T[T.length - 1]; return { c: rgb(z[1]), a: z[2] === undefined ? 1 : z[2] };
  }
  function css(c) { return "rgb(" + c.map(Math.round).join(",") + ")"; }
  band.style.background = "linear-gradient(" + GROUND.map(function (s) { return s[1] + " " + (s[0] * 100).toFixed(0) + "%"; }).join(", ") + ")";

  function el(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  var traces = [], drawnW = 0, drawnH = 0, pulses = [];
  function draw(W, H) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var R = rng(20261003 + Math.round(W / 40));
    var p = W < 700 ? 7 : 8;                                // lane pitch (px)
    var lanes = Math.floor(W / p);
    var K = p * Math.tan(Math.PI / 8);
    var occ = []; for (var i = 0; i <= lanes + 12; i++) occ.push([]);
    function free(l, y0, y1, own) {
      if (l < 1 || l > lanes - 1) return false;
      var o = occ[l];
      for (var i = 0; i < o.length; i++) if (o[i][2] !== own && y0 < o[i][1] + p * 1.25 && y1 > o[i][0] - p * 1.25) return false;
      return true;
    }
    function take(l, y0, y1, own) { if (occ[l]) occ[l].push([Math.min(y0, y1), Math.max(y0, y1), own]); }

    // gradients: the ink pre-blended with the ground at each depth, and the ground itself (for the vias' holes)
    var defs = el("defs", {}, svg);
    var gi = el("linearGradient", { id: "bc-ink", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: H }, defs);
    var gg = el("linearGradient", { id: "bc-ground", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: H }, defs);
    for (i = 0; i <= 48; i++) {
      var t = i / 48, g = at(GROUND, t).c, k = at(INK, t);
      el("stop", { offset: t.toFixed(4), "stop-color": css(k.c.map(function (v, j) { return g[j] + (v - g[j]) * k.a; })) }, gi);
      el("stop", { offset: t.toFixed(4), "stop-color": css(g) }, gg);
    }

    // buses across the width; how far each reaches follows a slow envelope across the band, with a few long ones
    var bundles = [], l = 1 + Math.floor(R() * 3);
    while (l < lanes - 2) {
      var n = Math.max(1, Math.round(0.6 + Math.pow(R(), 1.35) * 5.4));
      if (l + n >= lanes - 1) break;
      bundles.push({ l: l, n: n, id: bundles.length });
      l += n + 2 + Math.floor(Math.pow(R(), 1.7) * (W < 700 ? 6 : 12));
    }
    var ph1 = R() * 6.28, ph2 = R() * 6.28;
    function envelope(x) { var u = x / W; return 0.5 + 0.28 * Math.sin(u * 6.1 + ph1) * Math.sin(u * 2.3 + ph2); }
    bundles.forEach(function (b) { for (var i = 0; i < b.n; i++) take(b.l + i, -10, 4, b.id); });
    var order = bundles.map(function (b) { return [R(), b]; }).sort(function (a, c) { return a[0] - c[0]; }).map(function (a) { return a[1]; });
    traces = [];
    order.forEach(function (b) {
      var own = b.id, members = [];
      for (var i = 0; i < b.n; i++) members.push({ lane: b.l + i, pts: [[(b.l + i) * p + 0.5, -6]], y: -6, alive: true });
      var long = R() < 0.12;
      var reach = H * Math.min(0.9, long ? 0.72 + 0.18 * R() : (0.16 + 0.42 * envelope(b.l * p) + 0.12 * R()));
      var y = 2;
      for (var step = 0; step < 10 && y < reach; step++) {
        var alive = members.filter(function (m) { return m.alive; });
        if (!alive.length) break;
        // a straight run
        var yr = Math.min(reach, y + p * (2 + Math.floor(R() * 7)));
        if (!alive.every(function (m) { return free(m.lane, y, yr, own); })) break;
        alive.forEach(function (m) { m.pts.push([m.lane * p + 0.5, yr]); take(m.lane, m.y, yr, own); m.y = yr; });
        y = yr;
        if (y >= reach - 2) break;
        // a 45-degree jog, the whole bus together, corners staggered so it keeps its spacing
        if (R() < 0.68) {
          var mag = 1 + Math.floor(Math.pow(R(), 1.5) * 5), s = mag * (R() < 0.5 ? -1 : 1);
          var plan = function (s) {
            var out = [];
            for (var i = 0; i < alive.length; i++) {
              var c1 = y + (s > 0 ? (alive.length - 1 - i) : i) * K, c2 = c1 + Math.abs(s) * p;
              for (var k = 0; k <= Math.abs(s); k++) if (!free(alive[i].lane + (s > 0 ? k : -k), c1, c2, own)) return null;
              out.push([c1, c2]);
            }
            return out;
          };
          var pl = plan(s);
          if (!pl) { s = -s; pl = plan(s); }
          if (!pl && mag > 1) { s = s > 0 ? 1 : -1; pl = plan(s); if (!pl) { s = -s; pl = plan(s); } }
          if (pl) {
            var ymax = y;
            alive.forEach(function (m, i) {
              var c1 = pl[i][0], c2 = pl[i][1];
              if (c1 > m.y + 0.01) m.pts.push([m.lane * p + 0.5, c1]);
              for (var k = 0; k <= Math.abs(s); k++) take(m.lane + (s > 0 ? k : -k), c1, c2, own);
              m.lane += s; m.pts.push([m.lane * p + 0.5, c2]); m.y = c2; ymax = Math.max(ymax, c2);
            });
            alive.forEach(function (m) { if (m.y < ymax - 0.01) { m.pts.push([m.lane * p + 0.5, ymax]); take(m.lane, m.y, ymax, own); m.y = ymax; } });
            y = ymax;
          }
        }
        // the bus thins as it goes: an outer trace ends here, now and then
        if (alive.length > 1 && R() < 0.36) (R() < 0.5 ? alive[0] : alive[alive.length - 1]).alive = false;
      }
      members.forEach(function (m) {
        if (m.pts.length < 2) return;
        m.end = R() < 0.8 ? "via" : "pad"; take(m.lane, m.y, m.y + p * 1.6, own);
        traces.push(m);
      });
    });

    // draw: each straight piece its own path, thinner the deeper it runs; the via or pad at the end
    var gTr = el("g", { class: "bc-tr", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    var speed = 300;                                          // px per second, the pen
    traces.forEach(function (m) {
      var x0 = m.pts[0][0], start = 0.15 + 0.5 * Math.abs(x0 / W - 0.5) + 0.25 * R(), tcur = start;
      for (var i = 1; i < m.pts.length; i++) {
        var a = m.pts[i - 1], b = m.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.2) continue;
        var w = 1.4 - 0.72 * Math.min(1, (a[1] + b[1]) / 2 / H);
        el("path", { d: "M" + a[0].toFixed(1) + "," + a[1].toFixed(1) + "L" + b[0].toFixed(1) + "," + b[1].toFixed(1),
                     "stroke-width": w.toFixed(2), style: "--l:" + (L + 1).toFixed(1) + "px;--d:" + tcur.toFixed(3) + "s;--t:" + (L / speed).toFixed(3) + "s" }, gTr);
        tcur += L / speed;
      }
      var e = m.pts[m.pts.length - 1], we = 1.4 - 0.72 * Math.min(1, e[1] / H);
      if (m.end === "via") el("circle", { class: "bc-via", cx: e[0], cy: (e[1] + 2.4).toFixed(1), r: 2.4, "stroke-width": we.toFixed(2), style: "--d:" + tcur.toFixed(3) + "s" }, gTr);
      else el("rect", { class: "bc-pad", x: (e[0] - 2.2).toFixed(1), y: (e[1] - 0.5).toFixed(1), width: 4.4, height: 7, rx: 1, style: "--d:" + tcur.toFixed(3) + "s" }, gTr);
      m.done = tcur;
    });

    // the pulse: two of the longest traces, each as one path, with a short dash of light that runs down it
    pulses = [];
    var longest = traces.slice().sort(function (a, b) { return b.y - a.y; }).filter(function (m, i, arr) {
      return arr.slice(0, i).every(function (o) { return Math.abs(o.pts[0][0] - m.pts[0][0]) > W * 0.25; });
    }).slice(0, 2);
    var gP = el("g", { class: "bc-pulse", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    longest.forEach(function (m, i) {
      var L = 0; for (var j = 1; j < m.pts.length; j++) L += Math.hypot(m.pts[j][0] - m.pts[j - 1][0], m.pts[j][1] - m.pts[j - 1][1]);
      el("path", { d: "M" + m.pts.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join("L"),
                   style: "--l:" + L.toFixed(1) + "px;--pd:" + (i * 3.6).toFixed(1) + "s" }, gP);
    });
    drawnW = W; drawnH = H;
    svg.dataset.traces = traces.length;
  }

  function size() {
    var W = band.clientWidth, H = band.clientHeight;
    if (!W || !H || (W === drawnW && H === drawnH)) return;
    draw(W, H);
  }
  size();
  var rz = 0;
  addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(size, 120); }, { passive: true });

  // draw in once, as the band comes into view; the pulse runs only while it is on screen
  if (REDUCED || !("IntersectionObserver" in window)) { band.classList.add("bc-on", "bc-static"); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio >= 0.15) band.classList.add("bc-on");
      band.classList.toggle("bc-live", e.isIntersecting);
    });
  }, { threshold: [0, 0.15] });
  io.observe(band);
})();

/* v8: the way on to the notebook (own.css, .bench-next). A link to #notebook; on click (or Enter) the page glides
   down so the notebook's book comes to where its ride frames it, and the ride takes over as soon as it starts (the
   ride starts on its own, from the scroll, when the book reaches the upper 62% of the screen). If the ride has
   already played, it glides to the notebook's heading instead. Reduced motion: a jump. */
(function () {
  "use strict";
  var link = document.querySelector(".bn-link"), sec = document.getElementById("notebook");
  if (!link || !sec) return;
  var book = sec.querySelector(".nbk"), head = sec.querySelector(".sh");
  var trace = link.querySelector(".bn-trace");
  function sizeTrace() { if (trace) link.style.setProperty("--bn-h", trace.clientHeight + "px"); }
  sizeTrace(); addEventListener("resize", sizeTrace, { passive: true });
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var anim = null;
  function stop() { if (anim) cancelAnimationFrame(anim); anim = null; removeEventListener("wheel", stop); removeEventListener("touchstart", stop); }
  link.addEventListener("click", function (e) {
    e.preventDefault();
    stop();
    var done = sec.classList.contains("vtl-done") || !sec.classList.contains("vtl-armed") || sec.classList.contains("vtl-go");
    var navTop = 56 + (innerWidth < 820 ? 12 : 22);           // where the ride frames the book (vtl.js frameBook)
    var el = (!done && book) ? book : (head || sec);
    var y0 = scrollY, maxY = document.documentElement.scrollHeight - innerHeight;
    var y1 = Math.max(0, Math.min(maxY, y0 + el.getBoundingClientRect().top - (el === book ? navTop : 76)));
    if (e.detail === 0 && head) {                             // from the keyboard: focus moves on to the notebook's heading
      var h = head.querySelector(".sh-t") || head;
      if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
    if (REDUCED) { scrollTo(0, y1); return; }
    var D = Math.min(1100, 500 + Math.abs(y1 - y0) * 0.35), t0 = null;
    addEventListener("wheel", stop, { passive: true }); addEventListener("touchstart", stop, { passive: true });
    (function step(now) {
      if (t0 === null) t0 = now;
      // the ride has started: it holds the page and glides it the rest of the way itself
      if (!done && sec.classList.contains("vtl-go")) { stop(); return; }
      var t = Math.min(1, (now - t0) / D), k = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      scrollTo(0, y0 + (y1 - y0) * k);
      if (t < 1) anim = requestAnimationFrame(step); else stop();
    })(performance.now());
  });
})();

