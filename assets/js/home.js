/* =============================================================================
   ReLeaf: homepage behaviour
   -----------------------------------------------------------------------------
   Five independent pieces. Each one checks for the element it drives and stops
   if it is missing, so removing a section from index.html never breaks the
   rest of the file.

     1  reveal      one-shot fade-and-rise for .rise and the pathway
     2  darkact     scroll progress -> CSS custom properties on .stagewrap
     3  parts       the component list <-> the WebGL reactor
     4  doors       cross-highlighting between related pages in Explore
     5  timeline    show the iHP figure only if its artwork exists

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

      // The act runs in one move, not two. The chain arrives on the same white
      // paper as the section above it and holds there long enough to be read.
      // Then the paper goes, the labels and the rail go with it, the nine dots
      // walk to the centre, the six that happen before the farmer is involved
      // fade out on the way, and the farmer's three land together and become
      // the light. The reactor that light belongs to comes up after.
      //
      // The handovers overlap on purpose. The ink starts arriving while the
      // labels are still fading, and the spark is already blooming while the
      // last dots land, so nothing in the sequence reads as a new object
      // appearing. Everything reads as the thing before it, changed.
      set("--paper", 1 - ease(span(p, 0.06, 0.18)));
      set("--railText", 1 - ease(span(p, 0.05, 0.14)));
      set("--railLine", 1 - ease(span(p, 0.07, 0.17)));

      set("--chainIn", 1 - ease(span(p, 0.38, 0.46)));
      set("--conv", ease(span(p, 0.10, 0.28)));
      // the dots land on the farmer first, then that point walks to the middle,
      // so the collapse reads as arriving somewhere rather than averaging out
      set("--recentre", ease(span(p, 0.26, 0.38)));
      set("--chainGrey", 1 - ease(span(p, 0.15, 0.26)));

      set("--turn1", ease(span(p, 0.19, 0.25)) * (1 - ease(span(p, 0.33, 0.39))));
      set("--turn2", ease(span(p, 0.40, 0.46)) * (1 - ease(span(p, 0.56, 0.62))));

      set("--sparkOn", ease(span(p, 0.34, 0.42)) * (1 - ease(span(p, 0.54, 0.66))));
      set("--spark", Math.round(ease(span(p, 0.36, 0.56)) * 100));
      set("--rxIn", ease(span(p, 0.48, 0.62)));

      var shift = ease(span(p, 0.66, 0.80));
      var name = ease(span(p, 0.72, 0.86));

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
      set("--sloganIn", ease(span(p, 0.88, 0.97)) * (1 - q));
    }

    if (reduced) {
      // final frame, no runway: paper gone, chain already collapsed and gone,
      // light off, reactor centred, name and slogan in
      set("--paper", 0); set("--railText", 0); set("--railLine", 0);
      set("--chainIn", 0); set("--conv", 1); set("--recentre", 1);
      set("--turn1", 0); set("--turn2", 0);
      set("--sparkOn", 0); set("--rxIn", 1);
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
  /* Hover, focus or click a highlight and the components it names light up in
     the assembly. Click also pins it, which is the only way this works on a
     touch screen. data-comp may hold several ids separated by spaces; the
     whole string is the identity here, and home-reactor.js does the splitting. */

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

  /* ═══════════════════════════════════════════════════════════ 4  DOORS ══ */
  /* Four boxes in a row say nothing about how the pages inside them relate.
     This puts the relationships back without drawing a diagram: point at any
     page and the pages it actually works with light up, wherever they live,
     and the line underneath names them.

     PAGE_LINKS is declared one way and mirrored below, so "hardware works with
     measurement" automatically means "measurement works with hardware". Add a
     page here, not in the markup. */

  var PAGE_LINKS = {
    "description":            ["peptide-design", "hardware", "model", "human-practices", "results"],
    "engineering":            ["hardware", "results", "milestone", "drylab-notebook"],
    "contribution":           ["parts", "software"],
    "results":                ["measurement", "experiments", "engineering"],
    "experiments":            ["plant", "measurement", "safety-and-security", "notebook", "parts"],
    "parts":                  ["peptide-design"],
    "plant":                  ["measurement", "geospatial-analysis"],
    "measurement":            ["hardware", "model"],
    "safety-and-security":    ["laws-and-regulations"],
    "model":                  ["bioreactor-calculations", "software", "hardware"],
    "hardware":               ["software", "bioreactor-calculations", "drylab-notebook"],
    "peptide-design":         ["model"],
    "human-practices":        ["hardware", "plant", "laws-and-regulations", "entrepreneurship",
                               "education", "geospatial-analysis"],
    "education":              ["gallery", "data-physicalization"],
    "entrepreneurship":       ["sustainability"],
    "sustainability":         ["entrepreneurship"],
    "data-physicalization":   ["results"],
    "team":                   ["attributions", "milestone", "gallery"],
    "milestone":              ["gallery"]
  };

  (function doors() {
    var wrap = document.getElementById("doors");
    var read = document.getElementById("doors-read");
    if (!wrap) return;

    // mirror the map so every relationship reads both ways
    var links = {};
    function add(a, b) {
      if (a === b) return;
      (links[a] = links[a] || {})[b] = true;
      (links[b] = links[b] || {})[a] = true;
    }
    Object.keys(PAGE_LINKS).forEach(function (a) {
      PAGE_LINKS[a].forEach(function (b) { add(a, b); });
    });

    var chips = wrap.querySelectorAll(".pg");
    var byPage = {};
    Array.prototype.forEach.call(chips, function (c) {
      byPage[c.getAttribute("data-pg")] = c;
    });

    var resting = read ? read.innerHTML : "";

    function label(slug) {
      var c = byPage[slug];
      return c ? c.querySelector("span").textContent : slug;
    }

    function light(slug) {
      if (!slug) {
        wrap.classList.remove("hot");
        Array.prototype.forEach.call(chips, function (c) {
          c.classList.remove("lit", "src");
        });
        if (read) read.innerHTML = resting;
        return;
      }
      var near = links[slug] || {};
      wrap.classList.add("hot");
      Array.prototype.forEach.call(chips, function (c) {
        var id = c.getAttribute("data-pg");
        c.classList.toggle("src", id === slug);
        c.classList.toggle("lit", id !== slug && !!near[id]);
      });
      if (read) {
        var names = Object.keys(near).filter(function (n) { return byPage[n]; }).map(label);
        read.innerHTML = names.length
          ? "<b>" + label(slug) + "</b> is read alongside " + names.join(", ") + "."
          : "<b>" + label(slug) + "</b> stands on its own.";
      }
    }

    Array.prototype.forEach.call(chips, function (c) {
      var id = c.getAttribute("data-pg");
      c.addEventListener("mouseenter", function () { light(id); });
      c.addEventListener("focus", function () { light(id); });
      c.addEventListener("mouseleave", function () { light(null); });
      c.addEventListener("blur", function () { light(null); });
    });
  })();

  /* ═══════════════════════════════════════════════════════ 5  ART SLOTS ══ */
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
