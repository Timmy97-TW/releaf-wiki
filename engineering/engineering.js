/* =============================================================================
   ENGINEERING · page script
   -----------------------------------------------------------------------------
   One behaviour, the same one the Integrated Human Practices page uses for its
   pipelines: a segmented control over one panel at a time, with a white thumb
   that slides under the chosen button, and cards that ease in the first time a
   reader reaches them.

   The contents rail, the [n] citations and the figure lightbox all come from
   assets/js/page.js. Native <details> carries every "Show details" toggle.

   With scripts off every cycle of every track is visible, nothing is reachable
   only by clicking, and the record reads top to bottom.
   ========================================================================== */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. one track ------------------------------------------------------ */

  function track(root) {
    var btns   = $$(":scope > .seg > .seg__track > .seg__btn", root);
    var panels = $$(":scope > .cyc", root);
    if (!btns.length || !panels.length) return;

    var strip = btns[0].parentNode;
    var current = -1;

    var thumb = document.createElement("span");
    thumb.className = "seg__thumb";
    thumb.setAttribute("aria-hidden", "true");
    strip.insertBefore(thumb, strip.firstChild);
    strip.classList.add("has-thumb");

    function place(animate) {
      if (current < 0) return;
      var b = btns[current];
      if (!animate) thumb.style.transition = "none";
      thumb.style.width = b.offsetWidth + "px";
      thumb.style.transform = "translateX(" + b.offsetLeft + "px)";
      if (!animate) { void thumb.offsetWidth; thumb.style.transition = ""; }
      /* keep the chosen cycle in view when the control scrolls sideways */
      if (strip.scrollWidth > strip.clientWidth) {
        var l = b.offsetLeft - (strip.clientWidth - b.offsetWidth) / 2;
        strip.scrollTo({ left: l, behavior: animate && !reduce ? "smooth" : "auto" });
      }
    }

    function show(i, animate) {
      var changed = i !== current;
      current = i;
      btns.forEach(function (b, n) {
        b.setAttribute("aria-selected", n === i ? "true" : "false");
        b.tabIndex = n === i ? 0 : -1;
      });
      panels.forEach(function (p, n) {
        p.hidden = n !== i;
        if (n === i && changed && animate && !reduce) {
          p.classList.remove("is-entering");
          void p.offsetWidth;
          p.classList.add("is-entering");
        }
      });
      place(animate);
    }

    /* A reader's own click on another cycle starts them at the top of it; a
       link landing inside a cycle switches the control without moving the
       page out from under them. */
    btns.forEach(function (b, i) {
      b.addEventListener("click", function (e) {
        show(i, true);
        if (e.isTrusted) {
          var nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 68;
          var top = root.getBoundingClientRect().top;
          if (top < nav) window.scrollTo({ top: window.scrollY + top - nav - 12, behavior: "instant" });
        }
      });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
              : e.key === "ArrowLeft"  || e.key === "ArrowUp"   ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + btns.length) % btns.length;
        btns[n].focus();
        show(n, true);
      });
    });

    /* opened on a link to a cycle: start on the one that holds it */
    var start = 0, target = null;
    try { target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
    panels.forEach(function (p, n) { if (target && (p === target || p.contains(target))) start = n; });
    show(start, false);
    if (target && root.contains(target)) {
      requestAnimationFrame(function () { target.scrollIntoView({ block: "start", behavior: "instant" }); });
    }

    window.addEventListener("resize", function () { place(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });

    /* A link, from the contents rail or from another cycle, can point at
       something inside a cycle that is not the open one. page.js knows how to
       do this for .tabs__panel and nothing here is one, so the track opens its
       own panel. The page is not moved: the browser does the scrolling.      */
    root.openFor = function (el) {
      for (var n = 0; n < panels.length; n++) {
        if (panels[n] === el || panels[n].contains(el)) {
          if (n !== current) show(n, false);
          return true;
        }
      }
      return false;
    };

    reveal(root);
  }

  /* ---- 1a. links into a closed cycle -------------------------------------- */

  function openFor(hash) {
    if (!hash || hash.length < 2) return;
    var el;
    try { el = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return; }
    if (!el) return;
    var t = el.closest ? el.closest("[data-track]") : null;
    if (t && t.openFor) t.openFor(el);
  }

  /* ---- 2. cards arrive ---------------------------------------------------- */

  function reveal(root) {
    if (reduce || !("IntersectionObserver" in window)) return;
    root.classList.add("cyc-anim");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-seen"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".dbtl__step, .ledger > div", root).forEach(function (n) { io.observe(n); });
  }

  /* ---- 3. a card in the overview opens its track --------------------------- */
  /* Following a map card should put that track's first cycle on screen and
     move focus to its control, so the keyboard lands where the eye does.     */

  function mapFocus() {
    $$(".map__card").forEach(function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("href");
        if (!id || id.charAt(0) !== "#") return;
        var sec = document.getElementById(id.slice(1));
        if (!sec) return;
        var first = $(".seg__btn[aria-selected='true']", sec) || $(".seg__btn", sec);
        if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 0);
      });
    });
  }

  /* ---- 4. short labels in the contents rail -------------------------------- */
  /* page.js builds the rail from the heading text; a heading carrying data-toc
     gets that shorter label instead, with the number page.js rendered kept.   */

  function shortenToc() {
    var list = $(".toc__list");
    if (!list) return false;
    var links = $$("a", list);
    if (!links.length) return false;
    links.forEach(function (a) {
      var h;
      try { h = document.getElementById(a.getAttribute("href").slice(1)); } catch (e) { return; }
      if (!h || !h.dataset.toc) return;
      var span = a.querySelector(".toc__label");
      if (span) span.textContent = h.dataset.toc;
      else {
        var no = (a.textContent.match(/^\s*([\d.]+)\s/) || [])[1];
        a.textContent = (no ? no + " " : "") + h.dataset.toc;
      }
      a.title = h.textContent.replace(/¶$/, "").replace(/^[\d.]+\s*/, "").trim();
    });
    return true;
  }

  function init() {
    $$("[data-track]").forEach(track);
    mapFocus();

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) openFor(a.getAttribute("href"));
    });
    window.addEventListener("hashchange", function () { openFor(location.hash); });

    if (shortenToc()) return;
    var toc = $(".toc");
    if (!toc || !window.MutationObserver) return;
    var mo = new MutationObserver(function () { if (shortenToc()) mo.disconnect(); });
    mo.observe(toc, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
