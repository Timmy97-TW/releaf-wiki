/* =============================================================================
   ReLeaf hardware: the record's behaviour
   -----------------------------------------------------------------------------
   The three things hwdoc.css needs a script for, and nothing else:

     1. rails   the frosted segmented control that switches between a record's
                design-build-test-learn cycles. Ported from assets/js/engage.js
                so a cycle switches, slides and eases exactly the way a chapter
                does on the Engagement pages.
     2. rail    the contents sidebar, built from the record's own headings:
                section numbers, a pill on the section the reader is in, and
                sub-headings that unfold under it. The hand-written <ol> in the
                page is the no-script fallback and is replaced here.
     3. landing a link (or a URL) pointing into a cycle that is not showing, or
                into a shut fold, opens it first and then goes there.

   With JavaScript off every cycle is on the page, every fold works on its own,
   and the written <ol> is the contents list, so nothing is reachable only by
   clicking. Load after ../js/polish.js:
     <script src="../js/hwdoc.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The site nav and the instrument strip are both fixed, so anything scrolled
     to has to clear the pair of them. 44px is .hwnav's height in nav-dark.css. */
  function navH() {
    var nv = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nv-h")) || 68;
    return nv + 44;
  }

  function targetOf(hash) {
    if (!hash || hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
  }

  /* ---- 1. the segmented control ------------------------------------------ */

  var rails = [];

  function rail(root) {
    var btns   = $$(":scope > .seg > .rail__strip > .rail__btn, :scope > .rail__strip > .rail__btn", root);
    var panels = $$(":scope > .rail__panel", root);
    if (!btns.length) return;
    var strip = btns[0].parentNode;
    var seg   = strip.classList.contains("seg__track");
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
      /* the rail owns a slice of the contents list; rebuild it for the cycle
         now showing, so the sidebar never lists headings that are hidden */
      if (changed) buildToc();
    }

    /* A reader who switches cycles from deep inside one would otherwise land
       in the middle of the next. Take them to the top of it. */
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
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
              : e.key === "ArrowLeft"  || e.key === "ArrowUp"   ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + btns.length) % btns.length;
        btns[n].focus();
        show(n, true);
      });
    });

    /* open on whichever cycle the URL points into */
    var start = 0, target = targetOf(location.hash);
    panels.forEach(function (p, n) { if (target && (p === target || p.contains(target))) start = n; });
    show(start, false);
    if (thumb) {
      window.addEventListener("resize", function () { place(false); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });
    }
    rails.push({ root: root, panels: panels, show: show });
  }

  /* ---- 2. the contents rail ---------------------------------------------- */
  /* Built from `section.part` (the numbered parts) and the h3s that belong to
     each. The two records are shaped differently -- some keep their
     subsections inside the part, others follow it as sibling `section.sec`
     elements -- so a part's scope runs from the part to the next one, which is
     the assumption toc.js already makes for the card map.                   */

  var nav, list, secs = [];

  /* The written <ol> in the page is the no-script fallback, and its first
     entries can point at things that are not parts of the record -- on the
     instrument pages, "01 Hardware highlights" points back up at the 3D
     walkthrough, which is section 1 of the document and has no section.part to
     be found. Those are read off once, before the list is replaced, so the
     generated rail still offers the way back to the stage. */
  var lead = [];
  function readLead() {
    nav = nav || $(".doc-nav");
    var doc = $(".doc");
    if (!nav || !doc || lead.length) return;
    $$("ol > li > a", nav).forEach(function (a) {
      var t = targetOf(a.getAttribute("href"));
      if (t && !doc.contains(t)) {
        var b = $("b", a);
        lead.push({ href: a.getAttribute("href"),
                    no: b ? b.textContent.trim() : "",
                    text: (a.textContent || "").replace(/^\s*\d+\s*/, "").trim() });
      }
    });
  }

  function label(el) {
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return t.replace(/¶$/, "").replace(/^\d+(\.\d+)*\s*/, "");
  }

  /* A heading or a part inside a cycle that is not showing must not appear in
     the rail, and -- the part that bites -- must not be counted as scrolled
     past either: a hidden element's rect is all zeros, so `top <= line` is
     true for every one of them and the last cycle always wins. */
  function visible(el) { return !!(el.offsetParent || el.getClientRects().length); }

  function buildToc() {
    nav = nav || $(".doc-nav");
    if (!nav) return;
    var doc = $(".doc");
    if (!doc) return;

    var parts = $$("section.part", doc).filter(function (p) { return p.id && $("h2", p); });
    if (parts.length < 2) return;

    readLead();

    var ol = document.createElement("ol");
    ol.className = "hwtoc";
    secs = [];

    /* the hero's entry, ahead of the record's own parts */
    lead.forEach(function (L) {
      var li = document.createElement("li");
      li.className = "hwtoc__sec hwtoc__sec--lead";
      var a = document.createElement("a");
      a.className = "hwtoc__h";
      a.href = L.href;
      var n = document.createElement("span");
      n.className = "hwtoc__no";
      n.textContent = L.no;
      var t = document.createElement("span");
      t.className = "hwtoc__lab";
      t.textContent = L.text;
      a.appendChild(n); a.appendChild(t);
      li.appendChild(a);
      ol.appendChild(li);
    });

    parts.forEach(function (part, i) {
      var h2 = $("h2", part);

      /* the part's scope: itself, then every sibling up to the next part */
      var scope = [part];
      for (var el = part.nextElementSibling; el && !el.classList.contains("part"); el = el.nextElementSibling) scope.push(el);

      var subs = [];
      scope.forEach(function (s) {
        $$("h3", s).forEach(function (h) {
          if (!visible(h)) return;
          var holder = h.closest("section.sec, .rail__panel, section.part") || h.parentNode;
          var id = holder.id || h.id;
          if (!id) return;
          if (subs.some(function (x) { return x.id === id; })) return;
          subs.push({ id: id, text: h.dataset.toc || label(h), h: h });
        });
      });

      var li = document.createElement("li");
      li.className = "hwtoc__sec";

      var a = document.createElement("a");
      a.className = "hwtoc__h";
      a.href = "#" + part.id;
      var n = document.createElement("span");
      n.className = "hwtoc__no";
      /* the record numbers its own parts (data-n, and the "Section 03" mark
         beside each heading); the rail has to agree with them, not count from
         one, or the sidebar and the page disagree about what section 5 is */
      var num = parseInt(part.dataset.n, 10);
      if (!num) num = i + 1 + lead.length;
      n.textContent = (num < 10 ? "0" : "") + num;
      var t = document.createElement("span");
      t.className = "hwtoc__lab";
      t.textContent = h2.dataset.toc || label(h2);
      a.appendChild(n); a.appendChild(t);
      li.appendChild(a);

      if (subs.length) {
        var sol = document.createElement("ol");
        sol.className = "hwtoc__subs";
        subs.forEach(function (s) {
          var sli = document.createElement("li");
          sli.className = "hwtoc__sub";
          var sa = document.createElement("a");
          sa.href = "#" + s.id;
          sa.textContent = s.text;
          sli.appendChild(sa);
          sol.appendChild(sli);
        });
        li.appendChild(sol);
      }

      ol.appendChild(li);
      secs.push({ li: li, part: part, subs: subs });
    });

    /* the written <ol> is the no-script fallback; swap it out now */
    var old = $(".hwtoc", nav) || $("ol", nav);
    if (old) old.parentNode.replaceChild(ol, old); else nav.appendChild(ol);
    list = ol;
    mark();
  }

  /* which part the reader is in, and which sub-heading inside it */
  function mark() {
    if (!secs.length) return;
    var line = navH() + 80;
    var here = null;
    secs.forEach(function (s) {
      if (!visible(s.part)) return;
      if (s.part.getBoundingClientRect().top <= line) here = s;
    });
    secs.forEach(function (s) { s.li.classList.toggle("is-here", s === here); });

    if (!here) return;
    var active = null;
    here.subs.forEach(function (sub) {
      var el = document.getElementById(sub.id);
      if (el && el.getBoundingClientRect().top <= line) active = sub.id;
    });
    $$(".hwtoc__sub a", here.li).forEach(function (a) {
      a.classList.toggle("is-active", !!active && a.getAttribute("href") === "#" + active);
    });
  }

  /* ---- 3. a link into something shut opens it ---------------------------- */

  function land(hash, jump) {
    var t = targetOf(hash);
    if (!t) return;
    rails.forEach(function (r) {
      r.panels.forEach(function (p, n) { if ((p === t || p.contains(t)) && p.hidden) r.show(n, false); });
    });
    for (var n = t; n && n !== document.body; n = n.parentNode) {
      if (n.tagName === "DETAILS" && !n.open) n.open = true;
    }
    var fold = t.closest && t.closest(".fold");
    if (fold) { fold.classList.remove("is-flash"); void fold.offsetWidth; fold.classList.add("is-flash"); }
    if (jump) requestAnimationFrame(function () { t.scrollIntoView({ block: "start", behavior: "instant" }); });
  }

  /* ---- start -------------------------------------------------------------- */

  function start() {
    $$("[data-rail]").forEach(rail);
    buildToc();

    /* A page opened straight at #cycle2 lands twice. The stage above the
       record is a sticky scene inside a tall scroll track whose height is
       settled late -- by the hero scripts, by the fonts, by the figures
       loading -- and every one of those pushes the record further down the
       page after the first jump has already happened, which leaves the reader
       a section or two short of where they asked to be. The second landing,
       after load, is the one that holds. */
    if (location.hash) {
      var want = location.hash;
      land(want, true);
      window.addEventListener("load", function () {
        requestAnimationFrame(function () {
          var t = targetOf(want);
          if (!t) return;
          var top = t.getBoundingClientRect().top;
          /* only if the page has moved under us; a reader who has already
             scrolled away since load is left where they are */
          if (Math.abs(top - navH() - 20) > 40 && window.scrollY > 0) land(want, true);
        });
      });
    }
    window.addEventListener("hashchange", function () { land(location.hash, false); });
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) land(a.getAttribute("href"), false);
    }, true);

    /* a fold opening or closing changes what the rail should list */
    document.addEventListener("toggle", function (e) {
      if (e.target.classList && e.target.classList.contains("fold")) mark();
    }, true);

    /* ---- the instrument strip's own reveal --------------------------------
       The strip waits for the reader to reach the record. The obvious hook was
       polish.js's `doc-light`, which marks the same moment -- but that flag is
       recomputed only on scroll and resize, which is fine for a colour scheme
       and not fine for navigation: a layout shift landing after the reader's
       last scroll (a figure arriving, the stage settling, a font swapping)
       leaves the flag stale, and a stale colour is a blemish where a stale nav
       is a page with no way off it. So this file decides it, from the same
       geometry, and re-checks it everywhere it could have changed: on scroll,
       on resize, at load, and whenever the record's own height moves.
       Same hysteresis as polish.js, so the two never disagree visibly. */
    var atRecord = false;
    function revealStrip() {
      var wrap = $(".doc-wrap");
      if (!wrap) return;
      var vh = document.documentElement.clientHeight || window.innerHeight || 800;
      var top = wrap.getBoundingClientRect().top;
      var next = atRecord ? top < vh * 0.52 : top < vh * 0.34;
      if (next === atRecord) return;
      atRecord = next;
      document.body.classList.toggle("at-record", next);
    }
    revealStrip();
    window.addEventListener("load", function () {
      requestAnimationFrame(revealStrip);
      setTimeout(revealStrip, 400);
    });
    if ("ResizeObserver" in window) {
      var docEl = $(".doc");
      if (docEl) {
        var lastH = 0, settle = 0;
        new ResizeObserver(function () {
          var n = docEl.offsetHeight;
          if (n === lastH) return;
          lastH = n;
          clearTimeout(settle);
          settle = setTimeout(revealStrip, 120);
        }).observe(docEl);
      }
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; revealStrip(); mark(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
