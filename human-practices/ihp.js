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
    var span   = strip.classList.contains("span");
    var app    = strip.classList.contains("app__list");
    var current = -1;

    /* the segmented control's white thumb slides under the chosen button;
       on the continuous-engagement ruler it slides down to the chosen row */
    var thumb = null;
    if (seg || span) {
      thumb = document.createElement("span");
      thumb.className = span ? "span__thumb" : "seg__thumb";
      thumb.setAttribute("aria-hidden", "true");
      strip.insertBefore(thumb, strip.firstChild);
      strip.classList.add("has-thumb");
    }
    function place(animate) {
      if (!thumb || current < 0) return;
      var b = btns[current];
      if (!animate) thumb.style.transition = "none";
      if (span) {
        thumb.style.height = b.offsetHeight + "px";
        thumb.style.transform = "translateY(" + b.offsetTop + "px)";
      } else {
        thumb.style.width = b.offsetWidth + "px";
        thumb.style.transform = "translateX(" + b.offsetLeft + "px)";
      }
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
        if (n === i && changed && animate && (seg || span || app) && !reduce) {
          p.classList.remove("is-entering");
          void p.offsetWidth;
          p.classList.add("is-entering");
        }
      });
      place(animate);
      if (mini) mini.forEach(function (m, n) { m.setAttribute("aria-pressed", n === i ? "true" : "false"); });
      if (span) thread.update();
    }

    /* under the conversations, the ruler again: choosing another expert
       there switches to them and goes back up to the start of their turn */
    var mini = null;
    if (span) {
      var copy = strip.cloneNode(true);
      $$(".span__thumb", copy).forEach(function (t) { t.remove(); });
      copy.className = "span span--mini";
      copy.removeAttribute("role");
      copy.removeAttribute("aria-orientation");
      copy.setAttribute("role", "group");
      mini = $$(".span__row", copy);
      mini.forEach(function (m, n) {
        ["id", "role", "aria-controls", "aria-selected", "tabindex"].forEach(function (a) { m.removeAttribute(a); });
        m.addEventListener("click", function () {
          if (n === current) return;
          btns[n].click();
          var hero = $(".conv__hero", panels[n]) || panels[n];
          var nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 68;
          window.scrollTo({ top: window.scrollY + hero.getBoundingClientRect().top - nav - 24, behavior: reduce ? "auto" : "smooth" });
        });
      });
      root.appendChild(copy);
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
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
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
    if (span) ruler(strip);
  }

  /* the ruler's bars grow from first meeting to second the first time it is seen */
  function ruler(strip) {
    if (reduce || !("IntersectionObserver" in window)) return;
    strip.classList.add("span-anim");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { strip.classList.add("is-seen"); io.disconnect(); } });
    }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(strip);
  }

  /* a conversation thread. On a wide screen each reply starts beside the
     turn before it, as far up as it can go without touching a bubble on
     its own side; the spine stops at the last speaker. The spine fills down
     to a line a little below the middle of the screen, and each turn
     appears once the fill reaches it.                                     */
  var thread = (function () {
    var ts = [], queued = false, anim = false;

    function layout(t) {
      var items = $$(":scope > .msg, :scope > .meet, :scope > .gap", t);
      items.forEach(function (n) { n.style.marginTop = ""; });
      var first = $(".msg", t);
      var wide = first && getComputedStyle(first).gridTemplateColumns.split(" ").length === 3;
      var bottom = { them: -1e9, us: -1e9 }, prev = null, prevTop = -1e9;
      items.forEach(function (n) {
        if (!n.classList.contains("msg")) { prev = n; return; }
        var side = n.classList.contains("msg--us") ? "us" : "them";
        var body = $(".msg__body", n);
        var pics = $(".msg__pics", n);
        /* a turn with photographs fills both columns, so it keeps its own row */
        if (wide && prev && prev.classList.contains("msg") && !pics && !$(".msg__pics", prev)) {
          var natural = n.offsetTop;
          var lift = $(".msg__body", prev).offsetHeight * 0.5;
          var top = Math.max(bottom[side] + 20, prevTop + 76, natural - lift);
          if (top < natural) n.style.marginTop = (top - natural) + "px";
        }
        bottom[side] = n.offsetTop + body.offsetTop + body.offsetHeight;
        if (pics) bottom[side === "us" ? "them" : "us"] = n.offsetTop + pics.offsetTop + pics.offsetHeight;
        prevTop = n.offsetTop;
        prev = n;
      });
      var last = $$(":scope > .msg", t).pop();
      var node = last && $(".msg__node", last);
      t._len = node ? last.offsetTop + node.offsetTop + node.offsetHeight / 2 : t.offsetHeight;
      t.style.setProperty("--tail", Math.max(0, t.offsetHeight - t._len) + "px");
      t._laid = t.offsetWidth;
    }

    function update() {
      queued = false;
      var line = window.innerHeight * 0.66;
      ts.forEach(function (t) {
        if (t.offsetParent === null) return;
        if (t._laid !== t.offsetWidth) layout(t);
        if (!anim) return;
        var r = t.getBoundingClientRect();
        if (r.top > window.innerHeight + 200) return;
        light(t, r.bottom < 0 ? t._len + 1 : line - r.top);
      });
    }
    function light(t, y) {
      var f = Math.max(0, Math.min(1, y / t._len));
      if (!t._max || f > t._max) t._max = f;       /* the spine never empties again */
      t.style.setProperty("--fill", t._max.toFixed(4));
      var reach = t._max * t._len;
      $$(":scope > .msg, :scope > .meet, :scope > .gap", t).forEach(function (n) {
        var at = n.offsetTop + (n.classList.contains("msg") ? 28 : n.classList.contains("gap") ? 10 : n.offsetHeight / 2);
        if (at <= reach + 1) n.classList.add("is-lit");
      });
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    function relayout() { ts.forEach(function (t) { t._laid = 0; }); queue(); }
    function init() {
      ts = $$(".thread");
      if (!ts.length) return;
      anim = !reduce;
      if (anim) ts.forEach(function (t) { t.classList.add("thread-anim"); });
      window.addEventListener("scroll", queue, { passive: true });
      window.addEventListener("resize", relayout);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
      $$(".thread img").forEach(function (im) { if (!im.complete) im.addEventListener("load", relayout); });
      queue();
    }
    return { init: init, update: queue };
  })();

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
    thread.init();
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
