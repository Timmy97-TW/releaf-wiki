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

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rail(root) {
    var btns   = $$(":scope > .rail__strip > .rail__btn, :scope > .seg > .rail__strip > .rail__btn", root);
    var panels = $$(":scope > .rail__panel", root);
    if (!btns.length) return;
    var strip  = btns[0].parentNode;
    var seg    = strip.classList.contains("seg__track");
    var current = -1;

    /* the segmented control's white thumb slides under the chosen button */
    var thumb = null;
    if (seg) {
      thumb = document.createElement("span");
      thumb.className = "seg__thumb";
      thumb.setAttribute("aria-hidden", "true");
      strip.insertBefore(thumb, strip.firstChild);
      strip.classList.add("has-thumb");
    }
    function place(animate) {
      if (!thumb || current < 0) return;
      var b = btns[current];
      if (!animate) thumb.style.transition = "none";
      thumb.style.width = b.offsetWidth + "px";
      thumb.style.transform = "translateX(" + b.offsetLeft + "px)";
      if (!animate) { void thumb.offsetWidth; thumb.style.transition = ""; }
      /* keep the chosen button in view when the control scrolls sideways */
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
        if (n === i && changed && animate && seg && !reduce) {
          p.classList.remove("is-entering");
          void p.offsetWidth;
          p.classList.add("is-entering");
        }
      });
      place(animate);
    }

    /* a rail marked data-rail-top (the pipelines) is long: choosing another
       tab from deep inside one starts the reader at the top of the new one.
       Only a reader's own click does this; a link landing in a write-up
       switches the tab without moving the page.                          */
    var toTop = root.hasAttribute("data-rail-top");
    btns.forEach(function (b, i) {
      b.addEventListener("click", function (e) {
        show(i, true);
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
        show(n, true);
      });
    });
    /* opened on a link to a write-up: start on the pipeline that holds it */
    var start = 0, target = null;
    try { target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
    panels.forEach(function (p, n) { if (target && p.contains(target)) start = n; });
    show(start, false);
    if (target && root.contains(target)) requestAnimationFrame(function () { target.scrollIntoView({ block: "start", behavior: "instant" }); });
    if (thumb) {
      window.addEventListener("resize", function () { place(false); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });
    }
    if (seg) reveal(root);
  }

  /* cards and connections ease in the first time each one is reached */
  function reveal(root) {
    if (reduce || !("IntersectionObserver" in window)) return;
    var items = $$(".node, .bridge, .pipe__end", root);
    root.classList.add("pipe-anim");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-seen"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (n) { io.observe(n); });
    if (location.hash) {
      var h = document.getElementById(location.hash.slice(1));
      if (h && root.contains(h)) $$(".node, .bridge, .pipe__end", h.closest(".rail__panel")).forEach(function (n) { n.classList.add("is-seen"); });
    }
    /* a jump straight to a card must never land on an invisible one */
    window.addEventListener("hashchange", function () {
      var t = document.getElementById(location.hash.slice(1));
      var n = t && t.closest(".node");
      if (n) n.classList.add("is-seen");
    });
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#rec-"]');
      var t = a && document.getElementById(a.getAttribute("href").slice(1));
      if (t) $$(".node, .bridge, .pipe__end", t.closest(".rail__panel")).forEach(function (n) { n.classList.add("is-seen"); });
    }, true);
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
