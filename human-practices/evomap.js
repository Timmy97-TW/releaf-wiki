/* =============================================================================
   ReLeaf: Project Evolution Map (the river)
   -----------------------------------------------------------------------------
   The map is complete without this file: the drawing, the four stages and
   every face as a link to its write-up are plain HTML (index.html, section 2).
   This adds:

     1. water. The drawing is shown with a dry riverbed, and the river fills
        from the hose downwards as the reader scrolls, so the front of the
        water is always level with the line being read. It never drains.
     2. arrival. A stage comes in whole when it is reached: its words, its
        faces and every note card that belongs to it. A strip pinned under
        the nav names the stage being read, and the contents rail steps
        aside so the map can take its room.
     3. the card. Pointing at (or tabbing to) a face shows who it is, when we
        met, and the line of theirs that changed the project. The face itself
        is the link; the card is a second, larger target for the same place.
     4. landing. Following a link to a write-up in a pipeline that is not
        showing switches to that pipeline, and the write-up is marked for a
        moment so the eye finds it.
     5. tint. While the map is being read the page takes its colours.

   With reduced motion the river is shown full and nothing moves.
   ========================================================================== */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var W = 1366, H = 3401;

  /* The river's centre line, traced on the drawing in its own pixels. Its y
     only ever increases, which is what lets the water front follow the
     reading line: for any height there is exactly one point on the river. */
  var LINE = [[292,328],[360,372],[430,410],[560,440],[700,455],[850,470],[960,500],[1060,560],[1120,640],[1100,740],[907,840],
              [667,867],[507,893],[400,960],[360,1050],[387,1140],[470,1235],[600,1293],[827,1347],[1013,1413],[1150,1468],[1195,1538],
              [1150,1606],[1050,1653],[900,1690],[747,1715],[600,1750],[480,1800],[400,1870],[373,1960],[400,2050],[500,2095],[650,2115],
              [800,2135],[1000,2180],[1100,2260],[1125,2390],[1050,2470],[933,2505],[667,2553],[507,2580],[380,2620],[310,2680],[285,2770],
              [300,2880],[400,2985],[533,3087],[667,3180],[747,3233]];

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hover  = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* Catmull-Rom through the traced points, written out as cubic Beziers. */
  function pathData(p) {
    var d = "M" + p[0][0] + " " + p[0][1];
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += " C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
           " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
           " " + p2[0] + " " + p2[1];
    }
    return d;
  }

  /* ---- 1. water ----------------------------------------------------------- */

  function water(river) {
    var art = $(".river__art", river);
    var img = $(".river__img", art);
    var dry = img && img.getAttribute("data-dry");
    if (!dry || reduce || !window.requestAnimationFrame) return;

    /* onload, not decode(): decode() can wait for a hidden tab to be shown */
    var pre = new Image();
    pre.onload = build;
    pre.src = dry;

    function build() {
      pre.onload = null;
      var svg = el("svg", { "class": "river__svg", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
      var defs = el("defs", {}, svg);
      var d = pathData(LINE);
      el("path", { id: "river-line", d: d }, defs);

      var fade = el("linearGradient", { id: "river-trail", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
      el("stop", { offset: "0", "stop-color": "#fff" }, fade);
      el("stop", { offset: ".86", "stop-color": "#fff" }, fade);
      el("stop", { offset: "1", "stop-color": "#fff", "stop-opacity": "0" }, fade);

      var mask = el("mask", { id: "river-flow", maskUnits: "userSpaceOnUse", x: "0", y: "0", width: W, height: H }, defs);
      el("rect", { width: W, height: H, fill: "#000" }, mask);
      var trail = el("rect", { x: "0", y: "0", width: W, height: "0", fill: "url(#river-trail)" }, mask);
      /* three widths, the narrow ones a little behind, so the front is soft */
      var strokes = [[390, .38, 0], [340, .7, 26], [300, 1, 54]].map(function (s) {
        return el("use", { href: "#river-line", fill: "none", stroke: "#fff", "stroke-width": s[0], "stroke-opacity": s[1],
                           "stroke-linecap": "round", "data-lag": s[2] }, mask);
      });

      el("image", { href: dry, x: "0", y: "0", width: W, height: H, preserveAspectRatio: "none" }, svg);
      var wet = el("g", { mask: "url(#river-flow)" }, svg);
      el("image", { href: img.currentSrc || img.src, x: "0", y: "0", width: W, height: H, preserveAspectRatio: "none" }, wet);
      el("use", { href: "#river-line", "class": "river__shimmer", fill: "none", stroke: "#fff", "stroke-width": "5",
                  "stroke-opacity": ".55", "stroke-linecap": "round", "stroke-dasharray": "2 46 7 88" }, wet);
      /* two more strands either side of the middle, slower, so the current has depth */
      [[-34, "3 70 9 61", ".38", ""], [38, "6 96 2 39", ".32", " river__shimmer--b"]].forEach(function (o) {
        el("use", { href: "#river-line", "class": "river__shimmer" + o[3], fill: "none", stroke: "#fff", "stroke-width": "4",
                    "stroke-opacity": o[2], "stroke-linecap": "round", "stroke-dasharray": o[1], transform: "translate(" + o[0] + " " + (o[0] * .6) + ")" }, wet);
      });
      var rg = el("radialGradient", { id: "river-glow" }, defs);
      el("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": ".9" }, rg);
      el("stop", { offset: "1", "stop-color": "#fff", "stop-opacity": "0" }, rg);
      var glow = el("circle", { r: "60", fill: "url(#river-glow)", opacity: "0", "class": "river__front" }, svg);

      art.appendChild(svg);

      var probe = $("#river-line", svg);
      var L = probe.getTotalLength();
      strokes.forEach(function (u) { u.setAttribute("stroke-dasharray", L + " " + L); });

      /* y at every 6 units of length; y never decreases along the line */
      var ys = [], step = 6;
      for (var s = 0; s <= L; s += step) ys.push(probe.getPointAtLength(s).y);
      function lengthAt(y) {
        if (y <= ys[0]) return 0;
        if (y >= ys[ys.length - 1]) return L;
        var lo = 0, hi = ys.length - 1;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (ys[mid] < y) lo = mid; else hi = mid; }
        return lo * step;
      }

      var reached = 0, shown = -1, queued = false;
      function frame() {
        queued = false;
        var r = art.getBoundingClientRect();
        var y = (window.innerHeight * 0.62 - r.top) / r.height * H;
        reached = Math.max(reached, lengthAt(y));
        if (reached === shown) return;
        shown = reached;
        strokes.forEach(function (u) {
          var lag = +u.getAttribute("data-lag");
          u.setAttribute("stroke-dashoffset", (L - Math.max(0, reached - lag)).toFixed(1));
        });
        var front = probe.getPointAtLength(reached);
        trail.setAttribute("height", Math.max(0, front.y - 230).toFixed(1));
        glow.setAttribute("cx", front.x.toFixed(1));
        glow.setAttribute("cy", front.y.toFixed(1));
        glow.setAttribute("opacity", reached > 0 && reached < L ? ".38" : "0");
        if (reached >= L) {
          window.removeEventListener("scroll", tick);
          window.removeEventListener("resize", tick);
          svg.classList.add("is-full");
        }
      }
      function tick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
      window.addEventListener("scroll", tick, { passive: true });
      window.addEventListener("resize", tick);
      frame();
    }
  }

  /* ---- 2. arrival --------------------------------------------------------- */
  /* A stage arrives whole: its number, its paragraph, its faces and every
     note card that belongs to it come in together when the reader reaches
     the first of them. The strip pinned under the nav names the stage being
     read, and while the map is on screen the contents rail steps aside.   */

  function arrival(river) {
    var st = $$(".st", river);
    var steps = $$(".river__steps a", river);
    var bar = $(".river__steps ol", river);
    var colours = ["--s1", "--s2", "--s3", "--s4"];
    river.classList.add("is-live");
    if (!reduce) river.classList.add("is-anim");
    var parts = st.map(function (s) { return $$(".st__head, .note", s); });
    var now = -1, queued = false;

    function frame() {
      queued = false;
      var vh = window.innerHeight, r = river.getBoundingClientRect();
      document.body.classList.toggle("evo-open", r.top < vh * 0.72 && r.bottom > vh * 0.42);
      var cur = -1;
      st.forEach(function (s, k) {
        var top = Infinity;
        parts[k].forEach(function (p) { top = Math.min(top, p.getBoundingClientRect().top); });
        if (top < vh * 0.8) { s.classList.add("is-in"); }
        if (top < vh * 0.6) cur = k;
      });
      if (cur !== now) {
        now = cur;
        steps.forEach(function (a, k) {
          a.classList.toggle("is-now", k === cur);
          a.classList.toggle("is-done", k < cur);
          if (k === cur) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
        });
        if (bar) bar.style.setProperty("--now", "var(" + colours[Math.max(0, cur)] + ")");
      }
    }
    function tick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    frame();
  }

  /* ---- 3. the card -------------------------------------------------------- */

  function cards(river) {
    var faces = $$("a.mface", river);
    if (!faces.length) return;

    var card = document.createElement("a");
    card.className = "rcard";
    card.setAttribute("aria-hidden", "true");
    card.tabIndex = -1;
    card.innerHTML = '<img class="rcard__img" alt="" /><span class="rcard__who"><b class="rcard__name"></b><span class="rcard__meta"></span></span>' +
                     '<p class="rcard__hook"></p><span class="rcard__go"></span>';
    river.appendChild(card);

    var current = null, hideT = 0;

    function show(face) {
      clearTimeout(hideT);
      if (current === face && card.classList.contains("is-on")) return;
      if (current) current.classList.remove("is-hot");
      current = face;
      face.classList.add("is-hot");
      river.classList.add("is-peek");

      var ds = face.dataset;
      card.href = face.getAttribute("href");
      $(".rcard__img", card).src = $("img", face).currentSrc || $("img", face).src;
      $(".rcard__name", card).innerHTML = "";
      $(".rcard__name", card).appendChild(document.createTextNode(ds.name + (ds.zh ? " " : "")));
      if (ds.zh) { var z = document.createElement("span"); z.textContent = ds.zh; $(".rcard__name", card).appendChild(z); }
      $(".rcard__meta", card).textContent = [ds.when, ds.role].filter(Boolean).join(" · ");
      $(".rcard__hook", card).textContent = ds.hook;
      $(".rcard__go", card).textContent = ds.dest;

      /* place it: under the face if it fits, otherwise over it */
      card.style.visibility = "hidden";
      card.classList.add("is-measure");
      var rb = river.getBoundingClientRect(), fb = face.getBoundingClientRect();
      var cw = card.offsetWidth, ch = card.offsetHeight;
      var fx = fb.left - rb.left, fy = fb.top - rb.top;
      var x = Math.max(8, Math.min(rb.width - cw - 8, fx + fb.width / 2 - 44));
      var below = fy + fb.height + 12;
      var y = (below + ch < rb.height - 8 || fy - ch - 12 < 0) ? below : fy - ch - 12;
      card.style.left = x + "px";
      card.style.top = y + "px";
      card.style.setProperty("--ox", (fx + fb.width / 2 - x) + "px");
      card.style.setProperty("--oy", y > fy ? "0%" : "100%");
      card.style.visibility = "";
      card.classList.remove("is-measure");
      requestAnimationFrame(function () { card.classList.add("is-on"); });
    }

    function hide(now) {
      clearTimeout(hideT);
      hideT = setTimeout(function () {
        card.classList.remove("is-on");
        river.classList.remove("is-peek");
        if (current) current.classList.remove("is-hot");
        current = null;
      }, now ? 0 : 140);
    }

    faces.forEach(function (f) {
      if (hover) {
        f.addEventListener("mouseenter", function () { show(f); });
        f.addEventListener("mouseleave", function () { hide(); });
      }
      f.addEventListener("focus", function () { if (f.matches(":focus-visible")) show(f); });
      f.addEventListener("blur", function () { hide(true); });
    });
    card.addEventListener("mouseenter", function () { clearTimeout(hideT); });
    card.addEventListener("mouseleave", function () { hide(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(true); });
    window.addEventListener("scroll", function () { if (current && !card.matches(":hover") && !(current.matches(":hover"))) hide(true); }, { passive: true });
  }

  /* ---- 5. tint ------------------------------------------------------------ */
  /* The drawing's ground runs from cream at the top to pale green at the
     foot. While the map holds the middle of the window, the page behind it
     takes the colours of the strip of drawing that is on screen, so the map
     reads as a place the reader walks into, not a picture on white.       */

  var GROUND = ["#fcf8c6","#faf7c4","#f8f7c2","#f6f6c0","#f4f6be","#f2f5bc","#f0f5ba","#eef4b8","#ecf4b6","#ebf3b4","#e9f3b2",
                "#e7f4b4","#e5f5b7","#e3f6b9","#e1f7bc","#dff9bf","#ddfac1","#dbfbc4","#d9fcc6","#d8fdc9","#d6ffcc"];
  var RGB = GROUND.map(function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); });
  function ground(t) {
    t = Math.max(0, Math.min(1, t)) * (RGB.length - 1);
    var i = Math.min(RGB.length - 2, Math.floor(t)), f = t - i;
    return "rgb(" + RGB[i].map(function (c, k) { return Math.round(c + (RGB[i + 1][k] - c) * f); }).join(" ") + ")";
  }

  function tint(river) {
    var art = $(".river__art", river);
    var layer = document.createElement("div");
    layer.className = "river-tint";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    var queued = false;
    function frame() {
      queued = false;
      var vh = window.innerHeight;
      var r = river.getBoundingClientRect(), a = art.getBoundingClientRect();
      var on = r.top < vh * 0.55 && r.bottom > vh * 0.45;
      layer.classList.toggle("is-on", on);
      if (on) {
        layer.style.setProperty("--t0", ground(-a.top / a.height));
        layer.style.setProperty("--t1", ground((vh - a.top) / a.height));
      }
    }
    function tick() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    frame();
  }

  /* ---- 4. landing --------------------------------------------------------- */

  function land(hash, flash) {
    if (!hash || hash.length < 2) return;
    var t;
    try { t = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return; }
    if (!t) return;
    for (var p = t; p; p = p.parentElement) {
      if (p.tagName === "DETAILS") p.open = true;
      /* a write-up inside a pipeline that is not the one showing */
      if (p.classList && p.classList.contains("rail__panel") && p.hidden) {
        var btn = document.querySelector('[role="tab"][aria-controls="' + p.id + '"]');
        if (btn) btn.click();
      }
    }
    if (flash) {
      /* mark it when it arrives on screen, not when the jump starts: a long
         smooth scroll would otherwise finish after the mark had faded */
      var mark = t.closest(".node, .event, h3") || t;
      var go = function () {
        mark.classList.remove("is-flash");
        void mark.offsetWidth;
        mark.classList.add("is-flash");
        setTimeout(function () { mark.classList.remove("is-flash"); }, 2400);
      };
      if (!("IntersectionObserver" in window)) { go(); return; }
      var seen = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { seen.disconnect(); setTimeout(go, 250); }
      }, { rootMargin: "-10% 0px -40% 0px" });
      seen.observe(mark);
      setTimeout(function () { seen.disconnect(); }, 6000);
    }
  }

  function landing() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      land(a.getAttribute("href"), true);
    });
    window.addEventListener("hashchange", function () { land(location.hash, false); });
    if (location.hash) land(location.hash, true);
  }

  function start() {
    landing();
    $$("[data-river]").forEach(function (r) {
      arrival(r);
      cards(r);
      tint(r);
      water(r);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
