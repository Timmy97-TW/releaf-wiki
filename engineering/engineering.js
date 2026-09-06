/* =============================================================================
   ReLeaf: Engineering Success — wet lab record, sheet behaviour
   -----------------------------------------------------------------------------
   Six jobs, all additive. With JavaScript off the page is still a complete
   document: the cycles are <details> that open on click, the dial is a static
   ring of six anchors, the ladder is a static SVG with a written caption, and
   every cycle and every DBTL step is reachable by its own anchor.

     1. the dial: turn the ring so the cycle you are reading sits at the top,
        and light the quadrant of the DBTL loop whose step is on screen
     2. the record: fold cycles open, open all, deep links
     3. the sheet-edge index, which follows the scroll
     4. the scroll gauge down the right edge
     5. figures open full-window
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
      n.addEventListener("click", function () { go(n.dataset.cyc); });
      n.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(n.dataset.cyc); }
      });
    });

    if (!("IntersectionObserver" in window)) { turnTo(order[0]); return; }

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
    var sheets = $$("main .sheet[id]");
    if (!sheets.length) { host.parentNode.remove(); return; }

    sheets.forEach(function (s) {
      var h = $(".sheethead h2", s);
      var label = s.getAttribute("data-rail") ||
                  (h ? h.textContent.trim() : (s.id === "cover" ? "Cover" : s.id));
      if (label.length > 34) label = label.slice(0, 32).trim() + "…";
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
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { seen[en.target.id] = en.isIntersecting; });
      var current = null, node = null;
      sheets.forEach(function (s) { if (seen[s.id] && !current) { current = s.id; node = s; } });
      links.forEach(function (a) {
        a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + current));
      });
      rail.classList.toggle("on-plate", !!node && node.classList.contains("sheet--plate"));
      rail.classList.toggle("is-hidden", current === "cover" || !current);
    }, { rootMargin: "-25% 0px -60% 0px", threshold: 0 });
    sheets.forEach(function (s) { io.observe(s); });
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

  function start() {
    document.documentElement.classList.add("js");
    $$("[data-needs-js]").forEach(function (el) { el.hidden = false; });
    dial(); record(); edge(); gauge(); lightbox();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
