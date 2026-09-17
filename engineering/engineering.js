/* =============================================================================
   ReLeaf: Engineering Success — wet lab record, sheet behaviour
   -----------------------------------------------------------------------------
   Six jobs, all additive. With JavaScript off the page is still a complete
   document: the six cycles are <details open>, so the whole record is flat on
   arrival and nothing has to be clicked to be read, the dial is a static ring
   of six anchors, the ladder is a static SVG, and every cycle and every DBTL
   step is reachable by its own anchor.

     1. the dial: turn the ring so the cycle you are reading sits at the top,
        and light the quadrant of the DBTL loop whose step is on screen
     2. the record: the cycles start open; close all, deep links
     3. the sheet-edge index, which follows the scroll
     4. the scroll gauge down the right edge
     5. figures open full-window
     6. the ladder plate: every box on Sheet 04 explains itself and lights its road
   ========================================================================== */
(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function prefersMotion() {
    return !window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---- 1. the dial ------------------------------------------------------ */

  function dial() {
    var host = $(".dial");
    if (!host) return;

    var rotor   = $(".dial__rotor", host);
    var counter = $(".dial__counter", host);
    var nodes   = $$(".dial-node", host);
    var chips   = $$(".dial__chips a", host);
    var hubNo   = $(".dial-hub-no", host);
    var hubLbl  = $(".dial-hub-lbl", host);
    var quads   = $$(".dial-quad", host);
    var letters = $$(".dial-letter", host);
    var cycles  = $$(".cyc");
    if (!cycles.length) return;

    var order = cycles.map(function (c) { return c.id; });
    var STEP  = 360 / Math.max(order.length, 1);
    var current = null;
    /* The ring keeps turning in whichever direction is shorter, so going from
       cycle 6 back to cycle 1 is one notch clockwise and not five anticlockwise.
       That means tracking a cumulative angle instead of an absolute one. */
    var angle = 0;

    function turnTo(id) {
      if (id === current) return;
      current = id;
      var i = order.indexOf(id);

      nodes.forEach(function (n) { n.classList.toggle("is-current", n.dataset.cyc === id); });
      chips.forEach(function (a) {
        a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + id));
      });

      /* The ring turns; every label inside it counter-turns by the same angle,
         so the numbers stay upright while the geometry moves. */
      if (rotor && i >= 0) {
        var want = -i * STEP;
        var delta = ((want - angle) % 360 + 540) % 360 - 180;
        angle += delta;
        rotor.setAttribute("transform", "rotate(" + angle + " 60 60)");
        if (counter) {
          $$(".dial-node", rotor).forEach(function (n) {
            var cx = n.dataset.cx, cy = n.dataset.cy;
            n.setAttribute("transform", "rotate(" + (-angle) + " " + cx + " " + cy + ")");
          });
        }
      }
      var node = nodes.filter(function (n) { return n.dataset.cyc === id; })[0];
      if (hubNo)  hubNo.textContent  = node ? node.dataset.no : "";
      if (hubLbl) hubLbl.textContent = node ? node.dataset.owner : "";
      markQuad(null);
    }

    function markQuad(k) {
      quads.forEach(function (q) { q.classList.toggle("is-lit", q.dataset.phase === k); });
      letters.forEach(function (t) { t.classList.toggle("is-lit", t.dataset.phase === k); });
    }

    nodes.forEach(function (n) {
      n.addEventListener("click", function () { turnTo(n.dataset.cyc); go(n.dataset.cyc); });
      n.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); turnTo(n.dataset.cyc); go(n.dataset.cyc); }
      });
    });

    /* A deep link to #d5 should arrive with the ring already on cycle 5, rather
       than waiting for the first scroll to correct it. */
    function fromHash() {
      var id = location.hash.replace("#", "");
      if (!id) return;
      var el = document.getElementById(id);
      var owner = el && (el.classList.contains("cyc") ? el : el.closest(".cyc"));
      if (owner) turnTo(owner.id);
    }

    if (!("IntersectionObserver" in window)) { turnTo(order[0]); fromHash(); return; }

    /* Which cycle is being read: the topmost one whose box crosses the upper
       third of the window. A shut cycle is one row tall, so this also works
       while the whole record is folded. */
    var live = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { live[e.target.id] = e.isIntersecting; });
      for (var i = 0; i < order.length; i++) {
        if (live[order[i]]) { turnTo(order[i]); return; }
      }
    }, { rootMargin: "-15% 0px -65% 0px", threshold: 0 });
    cycles.forEach(function (c) { io.observe(c); });

    /* And which quarter of the loop: the step heading currently on screen. */
    var steps = $$(".cyc .step[data-phase]");
    if (steps.length) {
      var seen = {};
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
        var lit = null;
        steps.forEach(function (s) {
          if (seen[s.id] && s.closest(".cyc").id === current && !lit) lit = s.dataset.phase;
        });
        markQuad(lit);
      }, { rootMargin: "-20% 0px -55% 0px", threshold: 0 });
      steps.forEach(function (s) { io2.observe(s); });
    }

    turnTo(order[0]);
    fromHash();
    window.addEventListener("hashchange", fromHash);
  }

  /* ---- 2. the record ---------------------------------------------------- */

  function go(id, cycleId) {
    var host = document.getElementById(cycleId || id);
    var target = document.getElementById(id) || host;
    if (!host) return;
    if (host.tagName === "DETAILS") host.open = true;
    (target || host).scrollIntoView({ behavior: prefersMotion() ? "smooth" : "auto", block: "start" });
  }

  function record() {
    var cycles = $$(".cyc");
    if (!cycles.length) return;

    var all = $("#expand-all");
    if (all) {
      all.addEventListener("click", function () {
        var open = all.getAttribute("aria-pressed") === "true";
        cycles.forEach(function (c) { c.open = !open; });
        all.setAttribute("aria-pressed", String(!open));
        all.textContent = open ? "Open every cycle" : "Close every cycle";
      });
    }

    /* a link to #d3 should show D3, not a shut box with D3 somewhere inside */
    function openFromHash() {
      var id = location.hash.replace("#", "");
      if (!id) return;
      var el = document.getElementById(id);
      if (!el) return;
      var owner = el.classList.contains("cyc") ? el : el.closest(".cyc");
      if (!owner) return;
      owner.open = true;
      var land = function () { el.scrollIntoView({ block: "start", behavior: "instant" }); };
      requestAnimationFrame(land);
      setTimeout(land, 300);
      window.addEventListener("load", land, { once: true });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (!el) return;
      var owner = el.classList.contains("cyc") ? el : el.closest(".cyc");
      if (!owner) return;
      e.preventDefault();
      go(id, owner.id);
      history.replaceState(null, "", "#" + id);
    });
  }

  /* ---- 3. the sheet-edge index ------------------------------------------ */

  function edge() {
    var host = $("#edge-index");
    if (!host) return;
    /* Only a sheet that names itself gets a rail entry, which is how the cover
       stays out of the list. */
    var sheets = $$("main .sheet[id][data-rail]");
    var all    = $$("main .sheet[id]");
    if (!sheets.length) { host.parentNode.remove(); return; }

    sheets.forEach(function (s) {
      var label = s.getAttribute("data-rail");
      if (label.length > 22) label = label.slice(0, 20).trim() + "…";
      var ico = s.getAttribute("data-ico");
      var mark = '<span class="mark"><span class="tick"></span>' +
                 (ico ? '<svg class="edge__ico" aria-hidden="true" width="0" height="0"><use href="#ico-' +
                        esc(ico) + '"/></svg>' : "") + "</span>";
      var li = document.createElement("li");
      li.innerHTML = '<a href="#' + s.id + '">' + mark + '<span class="lbl">' + esc(label) + "</span></a>";
      host.appendChild(li);
    });

    var links = $$("a", host);
    var rail = host.parentNode;
    if (!("IntersectionObserver" in window)) return;
    var seen = {};
    /* The rail stays out of the way on two sheets: the cover, where it would
       letter over a photograph before the reader has anything to navigate, and
       the assembly plate, which wants the whole width. */
    var QUIET = { cover: 1, ladder: 1 };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { seen[en.target.id] = en.isIntersecting; });
      var current = null, node = null;
      all.forEach(function (s) { if (seen[s.id] && !current) { current = s.id; node = s; } });
      links.forEach(function (a) {
        a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + current));
      });
      rail.classList.toggle("on-plate", !!node && node.classList.contains("sheet--plate"));
      rail.classList.toggle(
        "is-hidden",
        !current || QUIET[current] === 1 ||
        (!!node && node.classList.contains("sheet--plate")));
    }, { rootMargin: "-25% 0px -60% 0px", threshold: 0 });
    all.forEach(function (s) { io.observe(s); });
  }

  /* ---- 4. the scroll gauge ---------------------------------------------- */

  function gauge() {
    var bar = $(".gauge i");
    if (!bar) return;
    var pending = false;
    function paint() {
      pending = false;
      var d = document.documentElement;
      var span = d.scrollHeight - d.clientHeight;
      bar.style.height = (span > 0 ? Math.min(1, d.scrollTop / span) * 100 : 0) + "%";
    }
    window.addEventListener("scroll", function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }

  /* ---- 5. figures open full-window --------------------------------------- */

  function lightbox() {
    /* Every figure on the page is a .fig, so this is every image on it: gels,
       blots, plate counts, photographs, plasmid maps and construct maps. The
       inline frame crops or contains; the full image is in here. */
    var imgs = $$(".fig img");
    if (!imgs.length) return;
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button class="lightbox__close" aria-label="Close">&times;</button>' +
      '<figure style="margin:0;text-align:center"><figcaption></figcaption></figure>';
    var big = document.createElement("img");
    big.alt = "";
    $("figure", box).insertBefore(big, $("figcaption", box));
    document.body.appendChild(box);
    var cap = $("figcaption", box), opener = null;

    function close() {
      box.classList.remove("is-open");
      document.body.style.overflow = "";
      if (opener) opener.focus();
    }
    imgs.forEach(function (img) {
      img.addEventListener("click", function () {
        opener = img;
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        var c = img.closest("figure") && img.closest("figure").querySelector("figcaption");
        cap.textContent = c ? c.textContent.trim() : "";
        box.classList.add("is-open");
        document.body.style.overflow = "hidden";
        $(".lightbox__close", box).focus();
      });
    });
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".lightbox__close")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("is-open")) close();
    });
  }

  /* ---- 6. the ladder plate ----------------------------------------------- */

  /* Sheet 04 is a drawing of nineteen entry parts, five modules and one
     circuit, and the thing a reader wants from it is never the whole drawing
     at once. It is one box: what is that, and where does it go.

     So the plate answers per box. Pointing at one lights it and everything one
     step along its road and dims the rest; choosing one keeps that lit and
     opens its written entry in the panel. Both states come from the same two
     lookups: data-lit on a node lists what it feeds, and the reverse of that
     same list is what feeds it. Nothing about the routes is written twice, and
     the panel prose is not written in here at all. It is the definition list
     already in the HTML, which is what a reader with scripts off gets.

     The one control worth having is a shortcut to choosing a module, because a
     module's parts are spread across all five slot columns and cannot be
     picked out by eye. */

  function plate() {
    var fig = $(".ladder");
    if (!fig) return;
    var svg    = $(".ladder__svg", fig);
    var panel  = $(".ladder__panel", fig);
    var hint   = $(".ladder__hint", fig);
    var scroll = $(".ladder__scroll", fig);
    var nodes  = $$(".lad-node", fig);
    var edges  = $$(".lad-edge", fig);
    var items  = $$(".ladder__item", fig);
    var chips  = $$(".lad-chip", fig);
    if (!svg || !panel || !nodes.length) return;

    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });

    function lit(n) {
      var v = (n.getAttribute("data-lit") || "").trim();
      return v ? v.split(/\s+/) : [];
    }

    /* What feeds a box is just the reverse of what every other box feeds. */
    var feeds = {};
    nodes.forEach(function (n) {
      lit(n).forEach(function (t) { (feeds[t] = feeds[t] || []).push(n.id); });
    });

    function related(n) {
      var set = {};
      set[n.id] = true;
      lit(n).forEach(function (t) { set[t] = true; });
      (feeds[n.id] || []).forEach(function (t) { set[t] = true; });
      return set;
    }

    function name(id) {
      var n = byId[id];
      return n ? n.getAttribute("data-name") : "";
    }
    function isLevel(id, cls) {
      var n = byId[id];
      return !!n && n.classList.contains(cls);
    }

    /* ---- painting ------------------------------------------------------- */

    function paint(set) {
      svg.classList.toggle("is-active", !!set);
      nodes.forEach(function (n) { n.classList.toggle("is-lit", !!set && !!set[n.id]); });
      edges.forEach(function (e) { e.classList.toggle("is-lit", !!set && !!set[e.id]); });
    }

    /* The route lines are read off the arrows, so the words and the drawing
       cannot drift apart. Only a module or the circuit is somewhere a part
       goes into; only a part or a module is something built from. */
    var routeEl = document.createElement("p");
    routeEl.className = "ladder__route";
    routeEl.hidden = true;
    panel.appendChild(routeEl);

    function route(n) {
      var into = [], from = [], html = "";
      if (n) {
        lit(n).forEach(function (t) {
          if (isLevel(t, "lad-node--1") || isLevel(t, "lad-node--2")) into.push(name(t));
        });
        (feeds[n.id] || []).forEach(function (t) {
          if (isLevel(t, "lad-node--0") || isLevel(t, "lad-node--1")) from.push(name(t));
        });
      }
      if (into.length) html += "<span><b>Into</b><i>" + esc(into.join(", ")) + "</i></span>";
      if (from.length) html += "<span><b>Built from</b><i>" + esc(from.join(", ")) + "</i></span>";
      routeEl.innerHTML = html;
      routeEl.hidden = !html;
    }

    function show(n) {
      var want = n ? n.getAttribute("aria-describedby") : null;
      items.forEach(function (it) { it.hidden = it.id !== want; });
      if (hint) hint.hidden = !!n;
      route(n);
    }

    var chosen = null, hover = null;

    function restore() {
      var n = hover || chosen;
      paint(n ? related(n) : null);
      show(n);
    }

    function choose(n) {
      chosen = n || null;
      nodes.forEach(function (x) { x.setAttribute("aria-pressed", String(x === chosen)); });
      chips.forEach(function (c) {
        if (!c.hasAttribute("aria-pressed")) return;
        c.setAttribute("aria-pressed", String(!!chosen && c.getAttribute("data-trace") === chosen.id));
      });
      restore();
    }

    /* At 375px the plate is wider than its frame, so a chip press that lands on
       a box off to the right has to bring the box with it. */
    function centre(n) {
      if (!scroll || scroll.scrollWidth <= scroll.clientWidth + 1) return;
      var a = n.getBoundingClientRect(), b = scroll.getBoundingClientRect();
      var dx = (a.left + a.width / 2) - (b.left + b.width / 2);
      if (Math.abs(dx) < 8) return;
      if (scroll.scrollTo) {
        scroll.scrollTo({ left: scroll.scrollLeft + dx, behavior: prefersMotion() ? "smooth" : "auto" });
      } else {
        scroll.scrollLeft += dx;
      }
    }

    /* ---- the live region ------------------------------------------------ */

    /* A pointer moving over the plate rewrites the panel with nothing else to
       announce it, so the panel is a live region for exactly as long as the
       pointer is on the plate. Focus and a press announce themselves through
       the node's own name and aria-pressed, and a second announcement of the
       same text on top of that is noise, so keyboard use switches it off. */
    function live(on) {
      if (on && panel.getAttribute("aria-live") !== "polite") panel.setAttribute("aria-live", "polite");
      if (!on && panel.hasAttribute("aria-live")) panel.removeAttribute("aria-live");
    }

    /* ---- the plate ------------------------------------------------------ */

    function nodeFrom(el) {
      return el && el.closest ? el.closest(".lad-node") : null;
    }

    svg.addEventListener("pointerover", function (e) {
      live(true);
      var n = nodeFrom(e.target);
      if (!n || n === hover) return;
      hover = n;
      restore();
    });
    svg.addEventListener("pointerout", function (e) {
      var n = nodeFrom(e.target);
      if (!n || n !== hover) return;
      if (nodeFrom(e.relatedTarget) === n) return;
      hover = null;
      restore();
    });
    svg.addEventListener("pointerleave", function () {
      live(false);
      hover = null;
      restore();
    });

    svg.addEventListener("focusin", function (e) {
      var n = nodeFrom(e.target);
      if (!n) return;
      hover = n;
      restore();
    });
    svg.addEventListener("focusout", function (e) {
      if (nodeFrom(e.target) !== hover) return;
      hover = null;
      restore();
    });

    nodes.forEach(function (n) {
      n.addEventListener("click", function () { choose(chosen === n ? null : n); });
      n.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        e.preventDefault();
        choose(chosen === n ? null : n);
      });
    });

    /* ---- the trace chips ------------------------------------------------ */

    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var id = c.getAttribute("data-trace");
        var n = id ? byId[id] : null;
        if (n && n === chosen) n = null;
        choose(n);
        if (n) centre(n);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Tab") live(false);
      if (e.key !== "Escape" || !chosen) return;
      if (!fig.contains(document.activeElement)) return;
      choose(null);
    });

    show(null);
  }

  function start() {
    document.documentElement.classList.add("js");
    $$("[data-needs-js]").forEach(function (el) { el.hidden = false; });
    dial(); record(); edge(); gauge(); lightbox(); plate();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
