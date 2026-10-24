/* =============================================================================
   ReLEAF: Moments
   1. Lays the collage out: column span from the size class, row span from the
      card's real height, a small tilt and nudge per card.
   2. Lets cards drift in as they scroll into view.
   3. The photo viewer: arrows, Esc, swipe, neighbours preloaded.
   4. The sprout in the title (or typing "releaf") shakes some leaves loose and
      re-tosses the photos.
   ========================================================================== */
(function () {
  "use strict";
  var grid = document.querySelector(".mo-grid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".mo-card"));
  var notes = Array.prototype.slice.call(grid.querySelectorAll(".mo-note"));
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. layout ---------------------------------------------------------- */
  var SPAN = {
    12: { xl: 7, l: 5, m: 4, s: 3, note: 3 },
    8:  { xl: 8, l: 5, m: 4, s: 3, note: 3 },
    4:  { xl: 4, l: 4, m: 2, s: 2, note: 4 }
  };
  var UNIT = 8, GAP = 30;
  var seed = 0;

  function sizeOf(el) {
    var m = el.className.match(/mo-(xl|l|m|s)\b/);
    return m ? m[1] : "m";
  }
  function toss(i) {
    var k = i * 7 + seed * 13;
    return {
      r: (((k * 37) % 9) - 4) * 0.7,
      dx: (((k * 53) % 5) - 2) * 4,
      dy: (((k * 29) % 5) - 2) * 5
    };
  }
  function tilt() {
    var small = window.innerWidth < 640;
    cards.forEach(function (c, i) {
      var t = toss(i);
      c.style.setProperty("--r", (small ? t.r / 2 : t.r).toFixed(2) + "deg");
      c.style.setProperty("--dx", (small ? 0 : t.dx) + "px");
      c.style.setProperty("--dy", (small ? 0 : t.dy) + "px");
    });
  }
  function lay() {
    var w = grid.clientWidth;
    var cols = w >= 960 ? 12 : w >= 600 ? 8 : 4;
    var span = SPAN[cols];
    grid.style.setProperty("--cols", cols);
    grid.classList.add("is-laid");
    cards.forEach(function (c) {
      var s = sizeOf(c), n = span[s];
      var ar = parseFloat(c.style.getPropertyValue("--ar")) || 1.5;
      if (ar < 0.9 && cols > 4 && (s === "l" || s === "m")) n -= 1;  /* tall photos a column narrower */
      c.style.gridColumn = "span " + n;
    });
    notes.forEach(function (n) { n.style.gridColumn = "span " + span.note; });
    /* heights only settle once the spans are in */
    cards.concat(notes).forEach(function (el) {
      el.style.gridRow = "span " + Math.ceil((el.offsetHeight + GAP) / UNIT);
    });
  }
  tilt();
  lay();
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { tilt(); lay(); }, 120);
  });
  /* captions in a fallback font can change height once fonts settle */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lay);

  /* ---- 2. entrance ------------------------------------------------------- */
  if (!still && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      var d = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.transitionDelay = d + "ms";
        d += 70;
        el.classList.remove("is-waiting");
        io.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ""; }, 900 + d);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    var fold = window.innerHeight;
    cards.forEach(function (c) {
      if (c.getBoundingClientRect().top > fold * 0.9) {
        c.classList.add("is-waiting");
        io.observe(c);
      }
    });
  }

  /* ---- 3. viewer --------------------------------------------------------- */
  var lb = document.querySelector(".mo-lb");
  var lbImg = lb.querySelector("img");
  var lbCap = lb.querySelector("figcaption");
  var lbN = lb.querySelector(".mo-lb__n");
  var at = 0, opener = null;

  function full(i) { return cards[i].querySelector("img").getAttribute("data-full"); }
  function show(i) {
    at = (i + cards.length) % cards.length;
    var img = cards[at].querySelector("img");
    var cap = cards[at].querySelector("figcaption");
    lbImg.src = full(at);
    lbImg.alt = img.alt;
    lbImg.style.animation = "none";
    void lbImg.offsetWidth;
    lbImg.style.animation = "";
    lbCap.textContent = cap ? cap.textContent : "";
    lbCap.className = cap ? cap.className : "";
    lbN.textContent = (at + 1) + " / " + cards.length;
    [at - 1, at + 1].forEach(function (j) {
      var p = new Image();
      p.crossOrigin = "anonymous";
      p.src = full((j + cards.length) % cards.length);
    });
  }
  function open(i) {
    opener = document.activeElement;
    lb.hidden = false;
    document.documentElement.style.overflow = "hidden";
    show(i);
    lb.querySelector(".mo-lb__x").focus();
  }
  function close() {
    lb.hidden = true;
    document.documentElement.style.overflow = "";
    lbImg.removeAttribute("src");
    if (opener) opener.focus();
  }
  cards.forEach(function (c, i) {
    c.querySelector(".mo-open").addEventListener("click", function () { open(i); });
  });
  lb.querySelector(".mo-lb__x").addEventListener("click", close);
  lb.querySelector(".mo-lb__prev").addEventListener("click", function () { show(at - 1); });
  lb.querySelector(".mo-lb__next").addEventListener("click", function () { show(at + 1); });
  lb.addEventListener("click", function (e) {
    if (e.target === lb || e.target.classList.contains("mo-lb__fig")) close();
  });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(at - 1);
    else if (e.key === "ArrowRight") show(at + 1);
    else if (e.key === "Tab") {
      /* keep focus inside the viewer */
      var f = lb.querySelectorAll("button");
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  var tx = null, ty = null;
  lb.addEventListener("touchstart", function (e) {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(at + (dx < 0 ? 1 : -1));
    else if (dy > 90) close();
    tx = null;
  });

  /* ---- 4. the sprout ----------------------------------------------------- */
  var LEAF = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 20C3 10 10 3 21 3c0 11-7 18-17 17z" fill="currentColor"/></svg>';
  var TINTS = ["#5ca44e", "#7fbf6d", "#457b3a", "#cbe6c3", "#e7b84a"];
  function shake() {
    seed += 1;
    tilt();
    if (still) return;
    for (var i = 0; i < 26; i++) {
      var l = document.createElement("span");
      l.className = "mo-fall";
      l.innerHTML = LEAF;
      l.style.left = Math.random() * 100 + "vw";
      l.style.color = TINTS[i % TINTS.length];
      l.style.setProperty("--sx", (Math.random() * 160 - 80) + "px");
      l.style.setProperty("--sr", (Math.random() * 720 - 360) + "deg");
      l.style.animationDuration = (2.4 + Math.random() * 2.2) + "s";
      l.style.animationDelay = Math.random() * 0.6 + "s";
      var z = 0.7 + Math.random() * 0.9;
      l.style.width = l.style.height = (22 * z) + "px";
      document.body.appendChild(l);
      l.addEventListener("animationend", function () { this.remove(); });
    }
  }
  var sprout = document.querySelector(".mo-sprout");
  if (sprout) sprout.addEventListener("click", function () {
    sprout.classList.remove("is-pop");
    void sprout.offsetWidth;
    sprout.classList.add("is-pop");
    shake();
  });
  var typed = "";
  document.addEventListener("keydown", function (e) {
    if (!lb.hidden || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === "releaf") shake();
  });
})();
