/* =============================================================================
   ReLeaf: homepage problem section behaviour
   Three independent pieces, each stops if its element is missing:
     1  map       01's toggle, opening on the weather and then laying farms over it
     2  journey   03's camera, following a new product from research centre to shop
     3  sources   citations open the collapsed source list
   With JS off or motion reduced, both show their final state.
   ========================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var span = function (v, a, b) { return clamp01((v - a) / (b - a)); };
  var ease = function (t) { return t * t * (3 - 2 * t); };

  // progress of a tall wrapper whose sticky child is one screen high
  function progress(wrap) {
    var total = wrap.offsetHeight - window.innerHeight;
    return total > 0 ? clamp01(-wrap.getBoundingClientRect().top / total) : 1;
  }

  // The homepage's shared frame: every scroll-driven piece measures first and
  // writes second, so the page is laid out once a frame. home.js makes the
  // same object; whichever file runs first creates it.
  var homeFrame = window.__homeFrame || (window.__homeFrame = (function () {
    var jobs = [], queued = false;
    function run() {
      queued = false;
      var seen = jobs.map(function (j) { return j.read(); });
      jobs.forEach(function (j, i) { if (seen[i] !== undefined) j.write(seen[i]); });
    }
    return {
      add: function (read, write) { jobs.push({ read: read, write: write }); },
      request: function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(run);
      }
    };
  })());

  // set an attribute, a text or a style property only when it differs from
  // what this file last wrote there
  function writer() {
    var last = {};
    return function (key, v, apply) {
      if (last[key] === v) return;
      last[key] = v;
      apply(v);
    };
  }

  /* 1  map: opens on the weather, then lays the farms over it */
  (function () {
    var atlas = document.getElementById("pb-atlas");
    if (!atlas) return;
    var buttons = document.querySelectorAll(".pb-map__toggle button");
    var touched = false;
    function show(view) {
      atlas.setAttribute("data-view", view);
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.view === view));
      });
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { touched = true; show(b.dataset.view); });
    });
    if (reduced || !("IntersectionObserver" in window)) return;
    show("weather");
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      setTimeout(function () { if (!touched) show("farms"); }, 2200);
    }, { threshold: 0.5 });
    io.observe(atlas);
  })();

  /* 2  the distance: the camera follows a new biological from lab to shelf */
  (function () {
    var wrap = document.getElementById("journey");
    if (!wrap || reduced) return;
    var scene = document.getElementById("jr-scene");
    var orb = document.getElementById("jr-orb");
    var trail = document.getElementById("jr-trail");
    var far = document.getElementById("jr-far");
    var mid = document.getElementById("jr-mid");
    var yearEl = document.getElementById("jr-year");
    var ageEl = document.getElementById("jr-age");
    var winEl = document.getElementById("jr-windows");
    var tickRect = document.getElementById("jr-tickrect");
    var posts = wrap.querySelectorAll(".jr-post");
    var suns = wrap.querySelectorAll(".jr-summer");
    wrap.classList.add("is-live");

    // scene units: 6000 x 1000. Year k sits at X0 + k * STEP.
    var X0 = 1100, STEP = 390, LAB = { x: 806, y: 680 }, ROAD = 760, SHELF = 5000, FARMER = 5470;
    var AGE = 63, YEARS = 10, WINDOWS = 730;
    var last = -1;

    // The camera only has work to do while the journey is on screen. Off it,
    // the progress is pinned at 0 (still to come) or 1 (gone past), and so is
    // everything drawn from it. There one rect says which end; a frame runs
    // only when that changes, which is the first frame after leaving and any
    // jump straight across the section. A resize always runs.
    var near = true, pinnedAt = null;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        near = entries[entries.length - 1].isIntersecting;
        homeFrame.request();
      }).observe(wrap);
    }
    window.addEventListener("resize", function () { pinnedAt = null; homeFrame.request(); });

    var put = writer();

    function measure() {
      if (near) pinnedAt = null;
      else {
        var end = wrap.getBoundingClientRect().top > 0 ? 0 : 1;
        if (end === pinnedAt) return;
        pinnedAt = end;
      }
      return { p: progress(wrap), unit: scene.clientHeight / 1000, vw: window.innerWidth };
    }

    function draw(m) {
      var p = m.p, unit = m.unit, vw = m.vw;

      // 0–0.08 in the lab, 0.08–0.86 on the road, then the camera moves on to her
      var ox, oy;
      if (p < 0.08) {
        var t = ease(span(p, 0, 0.08));
        ox = LAB.x + (X0 - LAB.x) * t;
        oy = LAB.y + (ROAD - LAB.y) * t;
      } else {
        ox = X0 + (SHELF - X0) * span(p, 0.08, 0.86);
        oy = ROAD;
      }
      put("orb", "translate(" + ox.toFixed(1) + " " + oy.toFixed(1) + ")",
          function (v) { orb.setAttribute("transform", v); });
      put("trail", Math.max(X0, ox).toFixed(1), function (v) { trail.setAttribute("x2", v); });

      var camX = ox + (FARMER - SHELF) * ease(span(p, 0.86, 1));
      var maxPan = 6000 * unit - vw;
      var pan = Math.max(0, Math.min(maxPan, camX * unit - vw / 2));
      put("scene", "translate3d(" + (-pan).toFixed(1) + "px,0,0)",
          function (v) { scene.style.transform = v; });
      var panUnits = pan / unit;
      put("far", "translate(" + (panUnits * 0.55).toFixed(1) + " 0)",
          function (v) { far.setAttribute("transform", v); });
      put("mid", "translate(" + (panUnits * 0.25).toFixed(1) + " 0)",
          function (v) { mid.setAttribute("transform", v); });

      var done = clamp01((ox - X0) / (SHELF - X0));
      put("tick", (Math.max(0, ox - X0) + 5).toFixed(1), function (v) { tickRect.setAttribute("width", v); });
      var windows = Math.round(done * WINDOWS);
      put("windows", String(windows), function (v) { winEl.textContent = v; });
      var year = Math.min(YEARS, Math.floor(windows / 73));
      if (year !== last) {
        last = year;
        yearEl.textContent = year;
        ageEl.textContent = AGE + year;
        posts.forEach(function (g) { g.classList.toggle("on", +g.dataset.y <= year); });
        suns.forEach(function (g) { g.classList.toggle("on", +g.dataset.y <= year); });
      }
      put("endIn", ease(span(p, 0.9, 0.98)).toFixed(3),
          function (v) { wrap.style.setProperty("--endIn", v); });
    }

    homeFrame.add(measure, draw);
    window.addEventListener("scroll", homeFrame.request, { passive: true });
    draw(measure());
  })();

  /* 3  a citation opens the collapsed source list before jumping to it */
  (function () {
    var box = document.getElementById("pb-sources");
    if (!box) return;
    document.addEventListener("click", function (e) {
      var ref = e.target.closest && e.target.closest(".pb-ref");
      if (ref) box.open = true;
    });
  })();

})();
