/* =============================================================================
   ReLeaf: homepage behaviour
   -----------------------------------------------------------------------------
   Five independent pieces. Each one checks for the element it drives and stops
   if it is missing, so removing a section from index.html never breaks the
   rest of the file.

     1  reveal      one-shot fade-and-rise for .rise and the pathway
     2  darkact     scroll progress -> CSS custom properties on .stagewrap
     3  parts       the component list <-> the WebGL reactor
     4  map         the relationship graph in the Explore section
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

  /* ═════════════════════════════════════════════════════════════ 4  MAP ══ */
  /* Twenty-six pages is too many to draw, so this is the spine: the pages that
     have to be read in relation to each other. `to` is what a page feeds into.
     Coordinates are percentages of the frame and are the only layout there is,
     so move a node here rather than in the stylesheet. */

  var MAP_NODES = [
    { id: "description",        x: 50, y: 8,  label: "Description",   href: "description/",        hub: true,
      read: "The problem we picked, the system we designed, and why it had to be alive. Everything else is a defence of this page." },
    { id: "human-practices",    x: 15, y: 22, label: "Human Practices", href: "human-practices/",
      read: "Farmers, growers, regulators and researchers, each entry logged with the design change it caused." },
    { id: "hardware",           x: 85, y: 22, label: "Hardware",      href: "hardware/",
      read: "Three instruments built from nothing: the perfusion reactor, an in-line photometer and a dual-wavelength LED array." },
    { id: "peptide-design",     x: 31, y: 38, label: "Peptide Design", href: "peptide-design/",
      read: "Which protectant the circuit makes first, and how the candidates were narrowed before a single gene was ordered." },
    { id: "model",              x: 68, y: 38, label: "Math Model",    href: "model/",
      read: "The maths behind perfusion, membrane flux and light dose. It tells the hardware what to aim for." },
    { id: "software",           x: 86, y: 52, label: "Software",      href: "software/",
      read: "The controller: local soil sensing plus weather forecasting, deciding when the light turns green." },
    { id: "parts",              x: 15, y: 54, label: "Parts",         href: "parts/",
      read: "The ccaS/R modules as registry parts, with the promoters, codon choices and construct maps." },
    { id: "measurement",        x: 52, y: 56, label: "Measurement",   href: "measurement/",
      read: "How we know what we know. Every reading on this wiki was taken with a method described here." },
    { id: "engineering",        x: 86, y: 74, label: "Engineering",   href: "engineering/",
      read: "Fifteen design, build, test and learn cycles across the reactor, the photometer and the LED array." },
    { id: "experiments",        x: 28, y: 74, label: "Experiments",   href: "experiments/",
      read: "Protocols and runs, written so another team could repeat them without asking us anything." },
    { id: "plant",              x: 13, y: 90, label: "Plants",        href: "plant/",
      read: "Three growth systems for Arabidopsis: agar plates, hydroponics and soil. The thing the protectant is for." },
    { id: "safety-and-security", x: 42, y: 92, label: "Safety",       href: "safety-and-security/",
      read: "Containment as a property of the machine, plus the classification questions Taiwan has not answered yet." },
    { id: "results",            x: 70, y: 88, label: "Results",       href: "results/",
      read: "What the system actually did on the bench, and the list of things that are still not true." },
  ];

  var MAP_EDGES = [
    ["human-practices", "description"],
    ["human-practices", "hardware"],
    ["description", "peptide-design"],
    ["description", "hardware"],
    ["description", "model"],
    ["peptide-design", "parts"],
    ["parts", "experiments"],
    ["hardware", "software"],
    ["hardware", "measurement"],
    ["hardware", "engineering"],
    ["software", "model"],
    ["model", "measurement"],
    ["measurement", "results"],
    ["experiments", "results"],
    ["experiments", "plant"],
    ["experiments", "safety-and-security"],
    ["hardware", "safety-and-security"],
    ["plant", "results"],
    ["engineering", "results"],
  ];

  (function map() {
    var root = document.getElementById("map");
    var frame = document.getElementById("map-frame");
    var wires = document.getElementById("map-wires");
    var read = document.getElementById("map-read");
    if (!root || !frame || !wires) return;

    var els = {};
    MAP_NODES.forEach(function (n) {
      var a = document.createElement("a");
      a.className = "node" + (n.hub ? " node--hub" : "");
      a.href = n.href;
      a.textContent = n.label;
      a.style.left = n.x + "%";
      a.style.top = n.y + "%";
      a.setAttribute("data-id", n.id);
      frame.appendChild(a);
      els[n.id] = a;
    });

    var paths = [];
    function draw() {
      var box = frame.getBoundingClientRect();
      wires.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
      while (wires.firstChild) wires.removeChild(wires.firstChild);
      paths = [];
      MAP_EDGES.forEach(function (e) {
        var a = els[e[0]], b = els[e[1]];
        if (!a || !b) return;
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        var x1 = ra.left - box.left + ra.width / 2, y1 = ra.top - box.top + ra.height / 2;
        var x2 = rb.left - box.left + rb.width / 2, y2 = rb.top - box.top + rb.height / 2;
        var dy = (y2 - y1) * 0.45;
        var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", "M" + x1 + "," + y1 + " C" + x1 + "," + (y1 + dy) +
                            " " + x2 + "," + (y2 - dy) + " " + x2 + "," + y2);
        wires.appendChild(p);
        paths.push({ el: p, a: e[0], b: e[1] });
      });
    }

    var defaultRead = read ? read.innerHTML : "";
    function light(id) {
      if (!id) {
        root.classList.remove("hot");
        paths.forEach(function (p) { p.el.classList.remove("lit"); });
        Object.keys(els).forEach(function (k) { els[k].classList.remove("lit"); });
        if (read) read.innerHTML = defaultRead;
        return;
      }
      root.classList.add("hot");
      var near = {};
      near[id] = true;
      paths.forEach(function (p) {
        var on = p.a === id || p.b === id;
        p.el.classList.toggle("lit", on);
        if (on) { near[p.a] = true; near[p.b] = true; }
      });
      Object.keys(els).forEach(function (k) { els[k].classList.toggle("lit", !!near[k]); });
      var def = MAP_NODES.filter(function (n) { return n.id === id; })[0];
      if (read && def) read.innerHTML = "<b>" + def.label + "</b> &middot; " + def.read;
    }

    MAP_NODES.forEach(function (n) {
      var a = els[n.id];
      a.addEventListener("mouseenter", function () { light(n.id); });
      a.addEventListener("focus", function () { light(n.id); });
      a.addEventListener("mouseleave", function () { light(null); });
      a.addEventListener("blur", function () { light(null); });
    });

    draw();
    window.addEventListener("resize", draw);
    // labels shift when the webfont lands, and the wires are drawn from label
    // geometry, so redraw once it has
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  })();

  /* ══════════════════════════════════════════════════════════ 5  TIMELINE ══ */
  /* The iHP artwork is not in the repository yet. Rather than ship a broken
     image, the figure stays hidden until the file loads. Delete this block
     once assets/img/home/ihp-timeline.png is committed, and unhide the
     <figure> in index.html. */

  (function timeline() {
    var fig = document.getElementById("ihp-timeline");
    if (!fig) return;
    var img = fig.querySelector("img");
    if (!img) return;
    var probe = new Image();
    probe.onload = function () { fig.hidden = false; };
    probe.src = img.getAttribute("src");
  })();
})();
