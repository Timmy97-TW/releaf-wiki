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

  var frames = [];
  var ticking = false;
  function tick() {
    ticking = false;
    frames.forEach(function (f) { f(); });
  }
  function request() {
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
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

    frames.push(function () {
      var p = progress(wrap);
      var unit = scene.clientHeight / 1000;
      var vw = window.innerWidth;

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
      orb.setAttribute("transform", "translate(" + ox.toFixed(1) + " " + oy.toFixed(1) + ")");
      trail.setAttribute("x2", Math.max(X0, ox).toFixed(1));

      var camX = ox + (FARMER - SHELF) * ease(span(p, 0.86, 1));
      var maxPan = 6000 * unit - vw;
      var pan = Math.max(0, Math.min(maxPan, camX * unit - vw / 2));
      scene.style.transform = "translate3d(" + (-pan).toFixed(1) + "px,0,0)";
      var panUnits = pan / unit;
      far.setAttribute("transform", "translate(" + (panUnits * 0.55).toFixed(1) + " 0)");
      mid.setAttribute("transform", "translate(" + (panUnits * 0.25).toFixed(1) + " 0)");

      var done = clamp01((ox - X0) / (SHELF - X0));
      tickRect.setAttribute("width", (Math.max(0, ox - X0) + 5).toFixed(1));
      var windows = Math.round(done * WINDOWS);
      winEl.textContent = windows;
      var year = Math.min(YEARS, Math.floor(windows / 73));
      if (year !== last) {
        last = year;
        yearEl.textContent = year;
        ageEl.textContent = AGE + year;
        posts.forEach(function (g) { g.classList.toggle("on", +g.dataset.y <= year); });
        suns.forEach(function (g) { g.classList.toggle("on", +g.dataset.y <= year); });
      }
      wrap.style.setProperty("--endIn", ease(span(p, 0.9, 0.98)).toFixed(3));
    });
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

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  tick();
})();
