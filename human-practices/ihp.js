/* =============================================================================
   ReLeaf: the Integrated Human Practices page
   -----------------------------------------------------------------------------
   Two small behaviours. With JavaScript off every rail shows all of its
   panels, so nothing on the page is reachable only by clicking. The
   evolution map, and opening a record a link points at, are evomap.js.
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

    /* a rail marked data-rail-top (the pipelines) is long: choosing another
       tab from deep inside one starts the reader at the top of the new one.
       Only a reader's own click does this; a link landing in a write-up
       switches the tab without moving the page.                          */
    var toTop = root.hasAttribute("data-rail-top");
    btns.forEach(function (b, i) {
      b.addEventListener("click", function (e) {
        show(i);
        if (toTop && e.isTrusted) {
          var nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 68;
          var top = root.getBoundingClientRect().top;
          if (top < nav) window.scrollTo({ top: window.scrollY + top - nav - 12, behavior: "instant" });
        }
      });
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

  /* ---- 2. short labels in the contents rail ------------------------------ */
  /* page.js builds the rail from the heading text; a heading that carries
     data-toc gets that shorter label in the rail instead. The number span
     page.js renders stays where it is.                                      */

  var SECTION_LABEL = {};

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
