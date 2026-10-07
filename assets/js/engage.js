/* =============================================================================
   ReLeaf: the Engagement pages
   -----------------------------------------------------------------------------
   The behaviour engage.css needs, taken from human-practices/ihp.js so the
   six pages beside IHP switch, slide and ease in exactly the way it does.

     1. rails: the frosted segmented control (.rail--seg), the side list
        (.rail--app) and any plain rail. The white thumb slides under the
        chosen button; a chapter eases in when it is chosen; a rail marked
        data-rail-top takes a reader who switches from deep inside it back to
        the top of the new chapter.
     2. cards, bridges and chapter ends ease in the first time they are reached.
     3. a link (or a URL) pointing into a shut chapter or a shut fold opens it.
     4. a heading with data-toc gets that shorter label in the contents rail.

   With JavaScript off every chapter is on the page and every fold works on
   its own, so nothing is reachable only by clicking. Load it at the end of
   <body>, after page.js:  <script src="../assets/js/engage.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var navH = function () { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 68; };

  function targetOf(hash) {
    if (!hash || hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
  }

  /* ---- 1. rails ---------------------------------------------------------- */

  var rails = [];

  function rail(root) {
    var btns   = $$(":scope > .rail__strip > .rail__btn, :scope > .seg > .rail__strip > .rail__btn", root);
    var panels = $$(":scope > .rail__panel", root);
    if (!btns.length) return;
    var strip  = btns[0].parentNode;
    var seg    = strip.classList.contains("seg__track");
    var app    = strip.classList.contains("app__list");
    var current = -1;

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
        if (n === i && changed && animate && (seg || app) && !reduce) {
          p.classList.remove("is-entering");
          void p.offsetWidth;
          p.classList.add("is-entering");
        }
      });
      place(animate);
      /* cards in a chapter that has never been shown have not been "reached" */
      if (changed) seen(panels[i]);
    }

    var toTop = root.hasAttribute("data-rail-top");
    btns.forEach(function (b, i) {
      b.addEventListener("click", function (e) {
        show(i, true);
        if (toTop && e.isTrusted) {
          var top = root.getBoundingClientRect().top;
          if (top < navH()) window.scrollTo({ top: window.scrollY + top - navH() - 12, behavior: "instant" });
        }
      });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + btns.length) % btns.length;
        btns[n].focus();
        show(n, true);
      });
    });

    var start = 0, target = targetOf(location.hash);
    panels.forEach(function (p, n) { if (target && (p === target || p.contains(target))) start = n; });
    show(start, false);
    if (thumb) {
      window.addEventListener("resize", function () { place(false); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });
    }
    rails.push({ root: root, panels: panels, show: show });
  }

  /* ---- 2. cards ease in -------------------------------------------------- */

  var io = null;
  function seen(scope) {
    if (!io || !scope) return;
    $$(".node, .bridge, .chap__end", scope).forEach(function (n) { if (!n.classList.contains("is-seen")) io.observe(n); });
  }
  function reveal() {
    if (reduce || !("IntersectionObserver" in window)) return;
    var roots = $$(".rail--seg");
    if (!roots.length) return;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-seen"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    roots.forEach(function (r) { r.classList.add("e-anim"); seen(r); });
  }

  /* ---- 3. a link into a shut chapter or fold opens it --------------------- */

  function land(hash, jump) {
    var t = targetOf(hash);
    if (!t) return;
    rails.forEach(function (r) {
      r.panels.forEach(function (p, n) { if ((p === t || p.contains(t)) && p.hidden) r.show(n, false); });
    });
    for (var n = t; n && n !== document.body; n = n.parentNode) {
      if (n.tagName === "DETAILS" && !n.open) n.open = true;
    }
    $$(".node, .bridge, .chap__end", t.closest(".rail__panel") || document).forEach(function (x) {
      if (x === t || x.contains(t) || t.contains(x)) x.classList.add("is-seen");
    });
    var mark = t.closest(".node, .fold, .card") ;
    if (mark) { mark.classList.remove("is-flash"); void mark.offsetWidth; mark.classList.add("is-flash"); }
    if (jump) requestAnimationFrame(function () { t.scrollIntoView({ block: "start", behavior: "instant" }); });
  }

  /* ---- 4. short labels in the contents rail ------------------------------- */

  function shortenToc() {
    var list = $(".toc__list");
    if (!list) return false;
    var links = $$("a", list);
    if (!links.length) return false;
    links.forEach(function (a) {
      var h = targetOf(a.getAttribute("href"));
      if (!h || !h.dataset.toc) return;
      var no = (a.textContent.match(/^\s*([\d.]+)\s/) || [])[1];
      a.textContent = (no ? no + " " : "") + h.dataset.toc;
      a.title = h.textContent.replace(/¶$/, "").replace(/^[\d.]+\s*/, "").trim();
    });
    return true;
  }

  function start() {
    reveal();
    $$("[data-rail]").forEach(rail);
    if (location.hash) land(location.hash, true);
    window.addEventListener("hashchange", function () { land(location.hash, false); });
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) land(a.getAttribute("href"), false);
    }, true);

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
