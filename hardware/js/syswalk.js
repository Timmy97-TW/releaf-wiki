// The bioreactor's walk through its system, stage by stage (3.4, div#syswalk).
//
// 17 Oct 2026 rebuild (div#syswalk.sy, styled by bioreactor/css/syswalk.css). One panel holds the drawing, the
// stage card and the controls; the script picks how it walks:
//   track   a desktop window tall enough for the whole panel: the panel pins and the page scrolls through seven
//           equal steps; the card beside the drawing changes at each.
//   cards   phones, tablets and short windows: the drawing pins at the top and the seven cards scroll under it; the
//           card that crosses the middle of the space below the drawing is the live one.
//   static  reduced motion (and no script, since it is the markup's own state): the drawing fully lit above every
//           stage. Nothing pins, nothing moves.
// Back, Next and the seven dots scroll the page to their stage, so scrolling and the controls never disagree; the
// stage they asked for holds while the page travels there. What is live glows and flows, what has been passed stays
// dimly on, what has not been reached waits. The drawing animates only while the walk is near the screen and the
// tab is visible (.is-on); the scroll handler does nothing while the walk is far away.
//
// Time-throttled with a trailing call rather than rAF: rAF is starved in background tabs and embedded views, and the
// trailing call means the stage the reader stopped on is never the one that gets dropped.
(function () {
  "use strict";
  var root = document.getElementById("syswalk");
  if (!root) return;
  if (!root.classList.contains("sy")) return;
  walk(root);

  function toArr(list) { return Array.prototype.slice.call(list); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function walk(root) {
    var panel = root.querySelector(".sy-panel"),
        track = root.querySelector(".sy-track"),
        list = root.querySelector(".sy-cards"),
        slot = root.querySelector(".sy-slot"),
        nav = root.querySelector(".sy-nav"),
        prevB = root.querySelector(".sy-prev"),
        nextB = root.querySelector(".sy-next"),
        nEl = root.querySelector(".sy-n"),
        nameEl = root.querySelector(".sy-name-w"),
        sayEl = root.querySelector(".sy-say");
    if (!panel || !track || !list || !slot || !nav || !prevB || !nextB) return;
    var cards = toArr(list.querySelectorAll(".sy-card")),
        marks = toArr(root.querySelectorAll(".sy-svg [data-stage]")),
        dots = toArr(root.querySelectorAll(".sy-dot")),
        dotItems = dots.map(function (d) { return d.parentNode; });
    var N = cards.length;
    if (!N) return;
    var titles = cards.map(function (c) { var h = c.querySelector("h4"); return h ? h.textContent.trim() : ""; });
    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    var mode = "", stage = 0, step = 400, near = true, inView = false;
    var lockTo = 0, lockTimer = 0, lockUntil = 0;

    /* ---- modes ---- */
    function stickyTop() { return parseFloat(getComputedStyle(panel).top) || 80; }
    function apply(m) {
      if (m === mode) return;
      mode = m;
      root.setAttribute("data-mode", m);
      root.classList.toggle("is-walk", m !== "static");
      nav.hidden = m === "static";
      if (m === "track") { if (list.parentNode !== slot) slot.appendChild(list); }
      else if (list.parentNode !== track) track.appendChild(list);
      if (m !== "track") panel.style.top = "";
      if (m === "static") { track.style.height = ""; clearMarks(); }
    }
    function navH() {
      var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nv-h"));
      return v > 0 ? v : 68;
    }
    function measure() {
      if (mode !== "track") { track.style.height = ""; panel.style.top = ""; return; }
      // the pinned panel sits in the middle of the space under the site's bar
      var nh = navH(), ph = panel.offsetHeight;
      panel.style.top = Math.max(nh + 12, Math.round(nh + (window.innerHeight - nh - ph) / 2)) + "px";
      step = Math.round(clamp(window.innerHeight * 0.55, 300, 520));
      track.style.height = (ph + N * step) + "px";
    }
    function setMode() {
      var reduced = !!(mq && mq.matches);
      if (reduced) { apply("static"); return; }
      apply(window.innerWidth >= 900 ? "track" : "cards");
      // the pinned panel has to fit under the site's bar, with a little air below it
      if (mode === "track" && panel.offsetHeight > window.innerHeight - navH() - 24) apply("cards");
      measure();
      pick(true);
    }

    /* ---- which stage the page is at ---- */
    function trigger() {
      var pb = panel.getBoundingClientRect().bottom;
      return Math.max(pb + 1, pb + (window.innerHeight - pb) * 0.5);
    }
    function current() {
      if (mode === "track") {
        var y = stickyTop() - track.getBoundingClientRect().top;
        return clamp(Math.floor(y / step) + 1, 1, N);
      }
      // cards: the last card whose top has crossed the middle of the space under the pinned drawing
      var line = trigger(), k = 1;
      for (var i = 0; i < N; i++) if (cards[i].getBoundingClientRect().top <= line) k = i + 1;
      return k;
    }
    function target(k) {
      if (mode === "track") {
        return track.getBoundingClientRect().top + window.scrollY - stickyTop() + (k - 0.5) * step;
      }
      // cards: the card's top just under the pinned drawing (it is then past the trigger, and the next card is not)
      var pinnedBottom = stickyTop() + panel.offsetHeight;
      return cards[k - 1].getBoundingClientRect().top + window.scrollY - pinnedBottom - 18;
    }

    /* ---- showing a stage ---- */
    function clearMarks() {
      stage = 0;
      root.classList.remove("is-all");
      marks.forEach(function (el) { el.classList.remove("is-live", "is-past"); });
      cards.forEach(function (c) { c.classList.remove("is-live"); });
    }
    function show(k, force) {
      if (k === stage && !force) return;
      stage = k;
      var all = k === N;
      root.classList.toggle("is-all", all);
      marks.forEach(function (el) {
        var s = +el.getAttribute("data-stage");
        el.classList.toggle("is-live", all || s === k);
        el.classList.toggle("is-past", !all && s < k);
      });
      cards.forEach(function (c, i) { c.classList.toggle("is-live", i + 1 === k); });
      dots.forEach(function (d, i) {
        d.classList.toggle("is-live", i + 1 === k);
        d.classList.toggle("is-past", i + 1 < k);
        if (i + 1 === k) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
      });
      dotItems.forEach(function (li, i) { li.classList.toggle("is-reached", i + 1 <= k); });
      prevB.setAttribute("aria-disabled", k <= 1 ? "true" : "false");
      nextB.setAttribute("aria-disabled", k >= N ? "true" : "false");
      if (nEl) nEl.textContent = String(k);
      if (nameEl) nameEl.textContent = titles[k - 1];
    }
    function pick(force) {
      if (mode === "static" || !mode) return;
      if (lockTo && Date.now() < lockUntil) return;
      show(current(), force);
    }

    /* ---- Back, Next, the dots: scroll there, and hold that stage while the page travels ---- */
    function release() { lockTo = 0; lockTimer = 0; pick(); }
    function armLock() {
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = setTimeout(release, 160);
    }
    function go(k) {
      if (mode === "static") return;
      k = clamp(k, 1, N);
      show(k);
      if (sayEl) sayEl.textContent = "Stage " + k + " of " + N + ": " + titles[k - 1];
      lockTo = k; lockUntil = Date.now() + 1600;
      armLock();
      var y = Math.max(0, Math.round(target(k)));
      if (Math.abs(y - window.scrollY) > 2) window.scrollTo({ top: y, left: 0, behavior: "smooth" });
    }
    prevB.addEventListener("click", function () { if (stage > 1) go(stage - 1); });
    nextB.addEventListener("click", function () { if (stage < N) go(stage + 1); });
    dots.forEach(function (d) { d.addEventListener("click", function () { go(+d.getAttribute("data-to")); }); });
    nav.addEventListener("keydown", function (e) {
      var k = e.key === "ArrowRight" ? stage + 1 : e.key === "ArrowLeft" ? stage - 1 :
              e.key === "Home" ? 1 : e.key === "End" ? N : 0;
      if (!k || e.target.closest(".sy-btn")) return;
      e.preventDefault();
      go(k);
      if (dots[stage - 1]) dots[stage - 1].focus();
    });

    /* ---- scroll and resize ---- */
    var last = 0, trail = 0;
    function onScroll() {
      if (!near || mode === "static") return;
      if (lockTo) { armLock(); return; }
      var now = Date.now();
      if (now - last < 80) {
        if (!trail) trail = setTimeout(function () { trail = 0; last = Date.now(); pick(); }, 90);
        return;
      }
      last = now;
      pick();
    }
    var rt = 0;
    function onResize() {
      if (rt) clearTimeout(rt);
      rt = setTimeout(function () { rt = 0; setMode(); }, 140);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", setMode);
      else if (mq.addListener) mq.addListener(setMode);
    }
    // the panel's height moves with late fonts and a resized column; the track's length follows it
    if ("ResizeObserver" in window) {
      var lastH = 0;
      new ResizeObserver(function () {
        var h = panel.offsetHeight;
        if (Math.abs(h - lastH) < 2) return;
        lastH = h;
        if (mode === "track") { measure(); pick(); }
      }).observe(panel);
    }

    /* ---- motion only on screen ---- */
    function setOn() { root.classList.toggle("is-on", inView && !document.hidden); }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          inView = e.isIntersecting;
          near = inView;
          setOn();
          if (inView) pick();
        });
      }, { rootMargin: "240px 0px" }).observe(root);
    } else { inView = true; }
    document.addEventListener("visibilitychange", setOn);

    setMode();
    setOn();
    window.addEventListener("load", function () { setMode(); }, { once: true });
  }
})();
