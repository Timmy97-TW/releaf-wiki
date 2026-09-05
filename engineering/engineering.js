/* =============================================================================
   ReLeaf: Engineering Success — sheet behaviour
   -----------------------------------------------------------------------------
   Five jobs, all additive. With JavaScript off the page is still a complete
   drawing set: the cycles are <details> and open on click, the atlas is a
   static SVG with a written description, the revision table is a table, and
   every cycle is reachable by its anchor.

     1. the atlas: hover or focus a cycle to read it, select it to jump there
     2. atlas filters: dim what you are not asking about
     3. the record: fold cycles open, filter to failures or open work
     4. deep links: #p4 opens P4 and scrolls to it
     5. the sheet-edge index, which follows the scroll
   ========================================================================== */
(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var DATA = (function () {
    var el = document.getElementById("atlas-data");
    try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; }
  })();

  var STATE_WORD = { closed: "Closed", fail: "Closed by a named failure", open: "Still open" };

  /* ---- 1 + 2. the atlas ------------------------------------------------- */

  var PHASE_WORD = { d: "Design", b: "Build", t: "Test", l: "Learn" };
  /* a hollow arc: this cycle never separated that step from its neighbour, or
     there was nothing to build. Said plainly rather than left blank. */
  var NO_STEP = "No separate step in this cycle.";

  function atlas() {
    var svg = $(".atlas__svg");
    var tip = $("#atlas-tip");
    if (!svg || !tip || !DATA) return;

    var nodes = $$(".cyc-node", svg);
    var arcs  = $$(".dbtl-arc", svg);
    var links = $$(".link, .link-cross", svg);
    var home  = tip.innerHTML;

    function describe(id) {
      var c = DATA.cycles[id];
      if (!c) return;
      var crossing = DATA.cross.filter(function (x) { return x.a === id || x.b === id; });
      var html =
        '<span class="field">' + c.n + " &middot; " + STATE_WORD[c.s] + "</span>" +
        "<h3>" + esc(c.t) + "</h3>" +
        "<p>" + esc(c.q) + "</p>" +
        "<p><b>Result.</b> " + esc(c.f) + "</p>";
      /* the four arcs, written out, so the loop on the plate is readable as a
         loop and not only as a shape */
      if (c.ph) {
        html += '<ol class="tip__ring">';
        ["d", "b", "t", "l"].forEach(function (k) {
          var line = c.ph[k];
          html += '<li data-phase="' + k + '"' + (line ? "" : ' class="is-absent"') + "><b>" +
                  PHASE_WORD[k] + "</b>" + (line || NO_STEP) + "</li>";
        });
        html += "</ol>";
      }
      if (c.x) html += "<p><b>Redesign, which is the arrow out.</b> " + esc(c.x) + "</p>";
      crossing.forEach(function (x) { html += "<p><b>Crosses tracks.</b> " + esc(x.why) + "</p>"; });
      html += '<p><a href="#' + id + '">Open the full record for ' + id.toUpperCase() + " &rarr;</a></p>";
      tip.innerHTML = html;
    }

    /* one arc: the same header, then that step alone. Hovering round a ring
       reads the cycle a quarter at a time. */
    function describePhase(id, k) {
      var c = DATA.cycles[id];
      if (!c || !c.ph) return describe(id);
      var line = c.ph[k];
      tip.innerHTML =
        '<span class="field">' + c.n + " &middot; " + STATE_WORD[c.s] + "</span>" +
        "<h3>" + esc(c.t) + "</h3>" +
        '<p class="tip__phase"><b>' + PHASE_WORD[k] + ".</b> " + (line || NO_STEP) + "</p>" +
        (line
          ? '<p><a href="#' + id + "-" + k + '">Open ' + PHASE_WORD[k] + " in " +
            id.toUpperCase() + " &rarr;</a></p>"
          : '<p><a href="#' + id + '">Open the full record for ' + id.toUpperCase() + " &rarr;</a></p>");
    }

    function highlight(id) {
      nodes.forEach(function (n) {
        n.classList.toggle("is-dim", !!id && n.dataset.cyc !== id && !related(id, n.dataset.cyc));
      });
      links.forEach(function (l) {
        var on = !id || l.dataset.from === id || l.dataset.to === id;
        l.classList.toggle("is-dim", !on);
      });
    }
    function related(id, other) {
      return links.some(function (l) {
        return (l.dataset.from === id && l.dataset.to === other) ||
               (l.dataset.to === id && l.dataset.from === other);
      });
    }
    function markArc(id, k) {
      arcs.forEach(function (a) {
        a.classList.toggle("is-lit", !!k && a.dataset.cyc === id && a.dataset.phase === k);
      });
      $$(".dbtl-letter", svg).forEach(function (t) {
        var g = t.closest(".cyc-node");
        t.classList.toggle("is-lit", !!k && g && g.dataset.cyc === id && t.dataset.phase === k);
      });
    }

    nodes.forEach(function (n) {
      var id = n.dataset.cyc;
      n.addEventListener("mouseenter", function () { announce(tip, true); describe(id); highlight(id); markArc(null); });
      n.addEventListener("focus", function () { announce(tip, false); describe(id); highlight(id); markArc(null); });
      n.addEventListener("click", function (e) {
        var arc = e.target.closest && e.target.closest(".dbtl-arc");
        go(arc ? id + "-" + arc.dataset.phase : id, id);
      });
      n.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(id); }
      });
    });

    /* The arcs are pointer targets only. Making 28 of them tab stops would put
       four extra stops in front of every cycle for a keyboard reader who has
       already been read all four steps by the node itself. */
    arcs.forEach(function (a) {
      a.addEventListener("mouseenter", function () {
        announce(tip, true);
        describePhase(a.dataset.cyc, a.dataset.phase);
        highlight(a.dataset.cyc);
        markArc(a.dataset.cyc, a.dataset.phase);
      });
    });

    var plate = $(".atlas__scroll");
    if (plate) plate.addEventListener("mouseleave", function () {
      highlight(null); markArc(null); tip.innerHTML = home;
    });

    /* filters dim rather than remove, so the shape of the whole set stays
       visible while you ask a narrower question of it */
    var want = { track: "all", state: "all" };
    $$(".atlas__tools .chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.dataset.filter;
        want[kind] = btn.dataset.value;
        $$('.atlas__tools .chip[data-filter="' + kind + '"]').forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        var live = {};
        nodes.forEach(function (n) {
          var ok = (want.track === "all" || n.dataset.track === want.track) &&
                   (want.state === "all" || n.dataset.state === want.state);
          live[n.dataset.cyc] = ok;
          n.classList.toggle("is-dim", !ok);
        });
        /* an arrow survives only if both cycles it joins survived, so filtering
           to one track keeps that track's causation visible instead of erasing it */
        links.forEach(function (l) {
          l.classList.toggle("is-dim", !(live[l.dataset.from] && live[l.dataset.to]));
        });
        var shown = Object.keys(live).filter(function (k) { return live[k]; }).length;
        var count = $("#atlas-count");
        if (count) count.textContent = shown + " of " + nodes.length + " cycles shown";
      });
    });
  }

  function announce(el, on) {
    /* the tip is only a live region while the pointer drives it; with the
       keyboard the focused node already announces itself, and a second
       announcement on every tab stop is noise */
    if (on) { el.setAttribute("aria-live", "polite"); }
    else { el.removeAttribute("aria-live"); }
  }

  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---- 3 + 4. the record ------------------------------------------------ */

  function go(id, cycleId) {
    var host = document.getElementById(cycleId || id);
    var target = document.getElementById(id) || host;
    if (!host) return;
    host.open = true;
    (target || host).scrollIntoView({ behavior: prefersMotion() ? "smooth" : "auto", block: "start" });
    var s = $("summary", host);
    if (s) s.focus({ preventScroll: true });
  }

  function prefersMotion() {
    return !window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function record() {
    var cycles = $$(".cyc");
    if (!cycles.length) return;

    $$("[data-cfilter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.dataset.cfilter;
        $$("[data-cfilter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        cycles.forEach(function (c) { c.hidden = !(v === "all" || c.dataset.state === v); });
        /* a track whose cycles are all hidden should not leave a bare heading */
        $$(".cycles").forEach(function (group) {
          var any = $$(".cyc", group).some(function (c) { return !c.hidden; });
          var sheet = group.closest(".sheet");
          if (sheet) sheet.hidden = !any;
        });
      });
    });

    var all = $("#expand-all");
    if (all) {
      all.addEventListener("click", function () {
        var open = all.getAttribute("aria-pressed") === "true";
        cycles.forEach(function (c) { if (!c.hidden) c.open = !open; });
        all.setAttribute("aria-pressed", String(!open));
        all.textContent = open ? "Open all" : "Close all";
      });
    }

    /* a link to #c3 should show C3, not a shut box with C3 somewhere inside */
    function openFromHash() {
      var id = location.hash.replace("#", "");
      if (!id) return;
      var d = document.getElementById(id);
      if (!d || !d.classList.contains("cyc")) return;
      d.open = true;
      /* The browser resolved the anchor while the cycle was still shut, so its
         position has moved. Wait for the images above it to settle, then land
         on it without smooth-scrolling the length of the page. */
      var land = function () { d.scrollIntoView({ block: "start", behavior: "instant" }); };
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
      var d = document.getElementById(id);
      if (d && d.classList.contains("cyc")) { e.preventDefault(); go(id); history.replaceState(null, "", "#" + id); return; }
      /* #c1-d is a step inside a folded cycle: open its cycle, then land on it */
      var step = document.getElementById(id);
      var owner = step && step.closest(".cyc");
      if (owner) { e.preventDefault(); go(id, owner.id); history.replaceState(null, "", "#" + id); }
    });
  }

  /* ---- 5. the sheet-edge index ------------------------------------------ */

  function edge() {
    var host = $("#edge-index");
    if (!host) return;
    var sheets = $$("main .sheet[id], main .cycfilter-wrap[id]");
    if (!sheets.length) { host.parentNode.remove(); return; }

    sheets.forEach(function (s) {
      /* the rail carries a short name of its own: a sheet's heading is a full
         sentence now, and a rail full of ellipses names nothing */
      var h = $(".sheethead h2", s);
      var label = s.getAttribute("data-rail") ||
                  (h ? h.textContent.trim() : (s.id === "cover" ? "Cover" : s.id));
      if (label.length > 38) label = label.slice(0, 36).trim() + "…";
      /* A tick until you are on the sheet; then the sheet's own mark, in the
         same slot, so the rail says where you are without a second colour. */
      var ico = s.getAttribute("data-ico");
      var mark = '<span class="mark"><span class="tick"></span>' +
                 (ico ? '<svg class="edge__ico" aria-hidden="true"><use href="#ico-' +
                        esc(ico) + '"/></svg>' : "") + "</span>";
      var li = document.createElement("li");
      li.innerHTML = '<a href="#' + s.id + '">' + mark +
                     '<span class="lbl">' + esc(label) + "</span></a>";
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
      /* the rail is graphite on stock and inverts over a blueprint plate; while
         the cover still owns the screen there is nothing to index yet */
      rail.classList.toggle("on-plate", !!node && node.classList.contains("sheet--plate"));
      rail.classList.toggle("is-hidden", current === "cover" || !current);
    }, { rootMargin: "-25% 0px -60% 0px", threshold: 0 });
    sheets.forEach(function (s) { io.observe(s); });
  }

  /* ---- figures open full-window, as they did before --------------------- */

  function lightbox() {
    var imgs = $$(".fig:not(.fig--pending) img");
    if (!imgs.length) return;
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button class="lightbox__close" aria-label="Close">&times;</button>' +
      '<figure style="margin:0;text-align:center"><figcaption></figcaption></figure>';
    /* built rather than templated, so no element ever ships with an empty src */
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
    atlas(); record(); edge(); lightbox();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
