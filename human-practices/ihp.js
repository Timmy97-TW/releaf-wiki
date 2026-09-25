/* =============================================================================
   ReLeaf: the Integrated Human Practices page
   -----------------------------------------------------------------------------
   Two small behaviours. With JavaScript off every rail shows its first panel
   and every carousel is a strip you can scroll sideways; nothing on the page
   is reachable only by clicking. The evolution map is evomap.js.
   ========================================================================== */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- 1. tab rails ------------------------------------------------------ */

  function rail(root) {
    var btns   = $$(":scope > .rail__strip > .rail__btn", root);
    var panels = $$(":scope > .rail__panel", root);
    if (!btns.length) return;

    function show(i) {
      btns.forEach(function (b, n) {
        b.setAttribute("aria-selected", n === i ? "true" : "false");
        b.tabIndex = n === i ? 0 : -1;
      });
      panels.forEach(function (p, n) { p.hidden = n !== i; });
    }

    btns.forEach(function (b, i) {
      b.addEventListener("click", function () { show(i); });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + btns.length) % btns.length;
        btns[n].focus();
        show(n);
      });
    });
    show(0);
  }

  /* ---- 2. carousels ------------------------------------------------------ */

  function carousel(root) {
    var track  = $(".carousel__track", root);
    var slides = $$(".carousel__slide", root);
    var prev   = $(".carousel__btn--prev", root);
    var next   = $(".carousel__btn--next", root);
    var count  = $(".carousel__count", root);
    if (!track || !slides.length) return;

    function current() {
      var left = track.getBoundingClientRect().left, best = 0, d = Infinity;
      slides.forEach(function (s, i) {
        var dd = Math.abs(s.getBoundingClientRect().left - left);
        if (dd < d) { d = dd; best = i; }
      });
      return best;
    }

    function update() {
      var i = current();
      var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (count) count.textContent = (atEnd ? slides.length : i + 1) + " / " + slides.length;
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = atEnd;
    }

    function go(d) {
      var i = Math.max(0, Math.min(slides.length - 1, current() + d));
      var dx = slides[i].getBoundingClientRect().left - track.getBoundingClientRect().left;
      track.scrollTo({ left: track.scrollLeft + dx });
    }

    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); go(-1); }
    });

    var t;
    track.addEventListener("scroll", function () { clearTimeout(t); t = setTimeout(update, 60); }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---- 3. short labels in the contents rail ------------------------------ */
  /* page.js builds the rail from the heading text. Our headings are long,
     deliberately: each one is a claim, not a category. A rail of claims is a
     rail you have to scroll, so the rail gets the short name instead. Every
     heading carries data-toc; the evolution map's heading is owned by
     evomap.js, so its label lives in the fallback below, keyed on section id.
     The number span page.js renders stays where it is.                      */

  var SECTION_LABEL = { evolution: "Evolution map" };

  function shortenToc() {
    var list = $(".toc__list");
    if (!list) return false;

    var links = $$("a", list);
    if (!links.length) return false;

    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      var h;
      try { h = document.getElementById(id); } catch (e) { return; }
      if (!h) return;

      var sec = h.closest(".sec");
      var label = h.dataset.toc || (sec && SECTION_LABEL[sec.id]);
      if (!label) return;

      /* keep the "3.2" page.js put at the front of the link text */
      var no = (a.textContent.match(/^\s*([\d.]+)\s/) || [])[1];
      a.textContent = (no ? no + " " : "") + label;
      a.title = h.textContent.replace(/¶$/, "").replace(/^[\d.]+\s*/, "").trim();
    });
    return true;
  }

  function start() {
    $$("[data-rail]").forEach(rail);
    $$("[data-carousel]").forEach(carousel);

    /* This file is loaded after page.js, so the rail is already there. If the
       load order is ever changed back, watch for it rather than give up.     */
    if (shortenToc()) return;
    var toc = $(".toc");
    if (!toc || !window.MutationObserver) return;
    var mo = new MutationObserver(function () { if (shortenToc()) mo.disconnect(); });
    mo.observe(toc, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
