/* =============================================================================
   ReLeaf: homepage behaviour
   -----------------------------------------------------------------------------
   Four independent pieces. Each one checks for the element it drives and stops
   if it is missing, so removing a section from index.html never breaks the
   rest of the file.

     1  reveal      one-shot fade-and-rise for .rise and the pathway
     2  darkact     scroll progress -> CSS custom properties on .stagewrap
     3  parts       the component list <-> the WebGL reactor
     4  timeline    show the iHP figure only if its artwork exists

   THE RESTING STATE IS THE FINISHED STATE. Every default in home.css shows the
   final frame, and this file only moves things once it has taken control. With
   JavaScript off, or prefers-reduced-motion set, the page is static and
   complete rather than static and empty. Test both before shipping a change.
   ========================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  // progress through [a, b], eased, clamped at both ends
  var span = function (v, a, b) { return clamp01((v - a) / (b - a)); };
  var ease = function (t) { return t * t * (3 - 2 * t); };

  /* ══════════════════════════════════════════════════════════ 1  REVEAL ══ */

  (function reveal() {
    var targets = document.querySelectorAll(".rise, .pathway");
    if (!targets.length) return;
    if (reduced || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  })();

  /* ═════════════════════════════════════════════════════════ 2  DARK ACT ══ */
  /* The wrapper is tall, the stage inside it is one screen and sticky, and the
     three empty beats before the parts section are the runway the reveal needs.
     Progress is measured against that runway only. */

  (function darkact() {
    var wrap = document.getElementById("solution");
    var parts = document.getElementById("system");
    if (!wrap) return;

    var rx = window.__homeRx;
    var started = false;

    // offsetTop is measured against whichever ancestor happens to be
    // positioned, and .stagewrap is, so mixing offsetTop values from inside and
    // outside it silently produces a negative runway. Measure both ends in
    // document coordinates instead.
    function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

    function runway() {
      // everything above the parts section, minus the one screen the sticky
      // stage occupies before it starts moving
      var end = parts ? docTop(parts) : docTop(wrap) + wrap.offsetHeight;
      return Math.max(1, end - docTop(wrap) - window.innerHeight);
    }

    function set(name, v) { wrap.style.setProperty(name, String(v)); }

    function frame() {
      var top = docTop(wrap);
      var p = clamp01((window.scrollY - top) / runway());

      // wake the reactor a screen before it is needed, so the fade-in is not
      // also a loading spinner
      if (!started && rx && !rx.failed && window.scrollY > top - window.innerHeight * 1.6) {
        started = true;
        rx.start();
      }

      set("--dark", 1 - ease(span(p, 0.00, 0.10)));
      set("--sparkOn", ease(span(p, 0.01, 0.07)) * (1 - ease(span(p, 0.34, 0.52))));
      set("--spark", Math.round(ease(span(p, 0.04, 0.34)) * 100));
      set("--rxIn", ease(span(p, 0.26, 0.46)));

      var shift = ease(span(p, 0.54, 0.72));
      var name = ease(span(p, 0.62, 0.80));

      // as the parts section arrives the name steps back and the reactor moves
      // further out of the way, because the list is what the reader is now
      // pointing at and it needs the right half to itself
      var q = 0;
      if (parts) {
        var pr = parts.getBoundingClientRect();
        q = ease(clamp01((window.innerHeight * 0.9 - pr.top) / (window.innerHeight * 0.6)));
      }

      set("--rxShift", shift * (1 + q * 0.35));
      set("--nameIn", name * (1 - q));
      set("--sloganIn", ease(span(p, 0.80, 0.94)) * (1 - q));
    }

    if (reduced) {
      // final frame, no runway: light off, reactor centred, name and slogan in
      set("--dark", 0); set("--sparkOn", 0); set("--rxIn", 1);
      set("--rxShift", 1); set("--nameIn", 1); set("--sloganIn", 1);
      if (rx && !rx.failed) {
        var wake = function () {
          if (wrap.getBoundingClientRect().top > window.innerHeight * 1.6) return;
          rx.start();
          window.removeEventListener("scroll", wake);
        };
        window.addEventListener("scroll", wake, { passive: true });
        wake();
      }
      return;
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; frame(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();
  })();

  /* ═══════════════════════════════════════════════════════════ 3  PARTS ══ */
  /* Hover, focus or click a component and it lights up in the assembly. Click
     also pins it, which is the only way this works on a touch screen. */

  (function partlist() {
    var list = document.getElementById("partlist");
    if (!list) return;
    var buttons = list.querySelectorAll(".part");
    var rx = window.__homeRx;
    var pinned = null;

    function show(id) {
      Array.prototype.forEach.call(buttons, function (b) {
        b.classList.toggle("is-on", b.getAttribute("data-comp") === id);
        b.setAttribute("aria-pressed", String(b.getAttribute("data-comp") === id && id === pinned));
      });
      if (rx && rx.highlight) rx.highlight(id);
    }

    Array.prototype.forEach.call(buttons, function (b) {
      var id = b.getAttribute("data-comp");
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("mouseenter", function () { if (!pinned) show(id); });
      b.addEventListener("mouseleave", function () { if (!pinned) show(null); });
      b.addEventListener("focus", function () { show(pinned || id); });
      b.addEventListener("click", function () {
        pinned = pinned === id ? null : id;
        show(pinned);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && pinned) { pinned = null; show(null); }
    });
  })();

  /* ═══════════════════════════════════════════════════════ 4  ART SLOTS ══ */
  /* Some figures on this page are waiting on artwork the team has not made
     yet. Each one names the file it wants in data-art. If the file loads, the
     figure shows its picture; if it does not, the figure either stays hidden
     (the iHP timeline, which has nothing to show without it) or keeps its
     "render pending" placeholder (the vision frames, which would otherwise
     leave a hole in a two-column layout).

     Delete a figure's data-art attribute, its [hidden], and its .artslot once
     the file is committed. Nothing else needs changing. */

  (function artslots() {
    var figs = document.querySelectorAll("[data-art]");
    Array.prototype.forEach.call(figs, function (fig) {
      var pic = fig.querySelector("picture");
      var slot = fig.querySelector("[data-artslot]");
      var probe = new Image();
      probe.onload = function () {
        fig.hidden = false;
        if (pic) pic.hidden = false;
        if (slot) slot.remove();
      };
      probe.src = fig.getAttribute("data-art");
    });
  })();

})();
