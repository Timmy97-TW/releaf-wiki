/* =============================================================================
   ReLeaf hardware: the record's behaviour
   -----------------------------------------------------------------------------
   The four things hwdoc.css needs a script for, and nothing else:

     1. rail    the contents sidebar, built from the record's own headings:
                section numbers, a pill on the section the reader is in, and
                sub-headings that unfold under it. The pill follows the reader
                down the page; only that section is unfolded. The hand-written
                <ol> in the page is the no-script fallback and is replaced here.
     2. landing a link (or a URL) pointing into a shut fold opens it first and
                then goes there.
     3. aim     a jump re-measures once the page stops moving, so it lands on
                its target even when what it passed on the way grew.
     4. cycles  a record's design-build-test-learn prototypes, one tab per
                prototype over each set (16 Oct 2026; between 15 and 16 Oct
                they were stacked under a sticky stepper).

   With JavaScript off every prototype is on the page, one after another, every fold works on its own,
   and the written <ol> is the contents list, so nothing is reachable only by
   clicking. Load after ../js/polish.js:
     <script src="../js/hwdoc.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The site nav is fixed, so anything scrolled to has to clear it. (Until
     11 Oct 2026 the instrument strip sat under it and this added its 44px.) */
  function navH() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nv-h")) || 68;
  }

  function targetOf(hash) {
    if (!hash || hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
  }

  /* ---- 1. the contents rail ---------------------------------------------- */
  /* Built from `section.part` (the numbered parts) and the h3s that belong to
     each. The two records are shaped differently -- some keep their
     subsections inside the part, others follow it as sibling `section.sec`
     elements -- so a part's scope runs from the part to the next one, which is
     the assumption toc.js already makes for the card map.                   */

  var nav, list, secs = [], leads = [], shown = null, follower = 0;

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
    leads = [];
    shown = null;

    /* the hero's entry, ahead of the record's own parts */
    lead.forEach(function (L) {
      var li = document.createElement("li");
      leads.push(li);
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

      /* a part marked data-subs="none" lists no sub-headings: the edit doc's
         sidebars name none under some parts that do have h3s */
      var subs = [];
      if (part.dataset.subs !== "none") scope.forEach(function (s) {
        $$("h3", s).forEach(function (h) {
          /* a prototype in a shut tab is still listed; its link opens the tab */
          if (!visible(h) && !h.closest(".cyc-set > .cyc")) return;
          var holder = h.closest("section.sec, section.part") || h.parentNode;
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

  /* which part the reader is in, and which sub-heading inside it. One part
     at a time carries the pill and is unfolded; every other one is shut. */
  function mark() {
    if (!secs.length) return;
    var line = navH() + 80;
    var here = null;
    secs.forEach(function (s) {
      if (!visible(s.part)) return;
      if (s.part.getBoundingClientRect().top <= line) here = s;
    });
    /* A short last part (the references, the files) can never climb to the
       line, so at the foot of the page the last part is the one being read. */
    var root = document.scrollingElement || document.documentElement;
    var foot = window.innerHeight + window.scrollY >= root.scrollHeight - 4;
    if (foot) {
      for (var k = secs.length - 1; k >= 0; k--) if (visible(secs[k].part)) { here = secs[k]; break; }
    }
    secs.forEach(function (s) { s.li.classList.toggle("is-here", s === here); });
    /* above the first part the reader is still on the stage or the sheet,
       which is what the hero's entry points at */
    leads.forEach(function (li, n) { li.classList.toggle("is-here", !here && n === leads.length - 1); });
    var now = here ? here.li : leads[leads.length - 1] || null;
    if (now && now !== shown) { shown = now; follow(now); }

    /* the sub-heading dot is the current part's alone: a part the reader has
       left keeps none, so coming back up it does not light two at once */
    var active = null;
    if (here) here.subs.forEach(function (sub) {
      var el = document.getElementById(sub.id);
      if (el && visible(el) && el.getBoundingClientRect().top <= line) active = sub.id;
    });
    /* and at the foot, the last sub-heading of the last part, which can no
       more climb to the line than a short last part can */
    if (here && foot && here === secs[secs.length - 1]) {
      for (var j = here.subs.length - 1; j >= 0; j--) {
        var last = document.getElementById(here.subs[j].id);
        if (last && visible(last)) { active = here.subs[j].id; break; }
      }
    }
    $$(".hwtoc__sub a", list).forEach(function (a) {
      a.classList.toggle("is-active", !!active && a.getAttribute("href") === "#" + active);
    });
  }

  /* The rail lists every part, and in a short laptop window (about 600px
     tall on the LPA) the list with one part unfolded no longer fits, so the
     rail scrolls inside itself (hwdoc.css). When the pill moves, bring it to the upper third of
     the rail -- after the fold under it has finished opening (.4s), or the
     measurement is of a list that is still changing height. Only the rail
     scrolls, never the page. */
  function follow(li) {
    clearTimeout(follower);
    follower = setTimeout(function () {
      if (!nav || nav.scrollHeight <= nav.clientHeight + 1) return;
      var top = li.getBoundingClientRect().top - nav.getBoundingClientRect().top;
      var to = nav.scrollTop + top - nav.clientHeight / 3;
      nav.scrollTo({ top: Math.max(0, to), behavior: reduce ? "auto" : "smooth" });
    }, reduce ? 0 : 420);
  }

  /* ---- 2. a link into something shut opens it ---------------------------- */

  function land(hash, jump) {
    var t = targetOf(hash);
    if (!t) return;
    openCycle(t);
    for (var n = t; n && n !== document.body; n = n.parentNode) {
      if (n.tagName === "DETAILS" && !n.open) n.open = true;
    }
    var fold = t.closest && t.closest(".fold");
    if (fold) { fold.classList.remove("is-flash"); void fold.offsetWidth; fold.classList.add("is-flash"); }
    if (jump) requestAnimationFrame(function () { t.scrollIntoView({ block: "start", behavior: "instant" }); });
  }

  /* ---- 3. a jump lands where it was aimed -------------------------------- */
  /* 15 Oct 2026. A link to anything far down a record -- the rail, a
     cross-reference, the ledger -- glides there (each page's doc.js scrolls
     smoothly), and on the way it passes charts that draw themselves, figures
     that reveal, images that load lazily and tabs that open. Each of those
     grows a little while the glide is already aimed at a fixed point, so on
     the bioreactor a jump below Engineering stopped 300-600px short. Opening
     the same URL cold lands right, because nothing grows after it.

     So once the page has stopped moving the target is measured again against
     its own scroll-margin-top and, if it is off, the page is taken the rest
     of the way: up to three times, then one last look a little later for an
     image that finished late. Any wheel, touch, key or pointer press from the
     reader ends it at once; it never fights someone who has started to
     scroll. Not `scrollend`: Safari only gained it recently, and "no scroll
     event for 180ms" is the same thing everywhere. */
  var hold = null;

  function aim(t) {
    if (hold) clearTimeout(hold.timer);
    hold = { t: t, tries: 0, last: false, timer: 0 };
    rest();
  }
  function rest() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold.timer = setTimeout(check, 180);
  }
  function check() {
    var h = hold;
    if (!h) return;
    if (!visible(h.t)) { hold = null; return; }
    var want = parseFloat(getComputedStyle(h.t).scrollMarginTop) || 0;
    var off = h.t.getBoundingClientRect().top - want;
    var root = document.scrollingElement || document.documentElement;
    var to = Math.max(0, Math.min(root.scrollHeight - window.innerHeight, window.scrollY + off));
    if (Math.abs(to - window.scrollY) < 4) {
      /* on target (or as close as the foot of the page allows) */
      if (h.last) { hold = null; return; }
      h.last = true;
      h.timer = setTimeout(check, 700);
      return;
    }
    if (h.tries >= 3) { hold = null; return; }
    h.tries++;
    h.last = false;
    window.scrollTo({ top: to, behavior: reduce || Math.abs(off) < 160 ? "instant" : "smooth" });
    rest();
  }
  function letGo() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold = null;
  }

  /* ---- 4. cycles as horizontal tabs --------------------------------------- */
  /* 16 Oct 2026, Timmy: the record reads straight down, but every set of
     design-build-test-learn prototypes sits in horizontal tabs. (Anton's
     15 Oct stepper stacked them all; this puts the tabs back on top of his
     markup, which is unchanged.)

     Markup, the same on all four instrument pages:
       <div class="cycles" data-cycles aria-label="...">
         [<div class="cyc-group" data-group="..."> intro section, then its .cyc ... </div>]
         <div class="cyc" data-step="Vertical">              (one per prototype)
           <section class="sec cyc__band" id="cyc2"> ring, kick, title, stage list </section>
           <section class="sec cyc__body"> the four stages </section>
         </div> ...
       </div>
     Each run of sibling .cyc elements (a group's, or the set's own) is
     wrapped in a .cyc-set with a tab strip over it; a run of one gets no
     strip. With JavaScript off nothing is wrapped or hidden. A link to
     anything inside a shut prototype opens its tab first (land(), above). */

  var tabsets = [];

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function cycles(root) {
    var runs = [];
    $$(".cyc[data-step]", root).forEach(function (c) {
      var last = runs[runs.length - 1];
      if (last && last[last.length - 1].parentNode === c.parentNode &&
          last[last.length - 1].nextElementSibling === c) last.push(c);
      else runs.push([c]);
    });
    var noun = root.dataset.noun || "Prototype";
    runs.forEach(function (steps) {
      if (steps.length < 2) return;
      var set = mk("div", "cyc-set");
      steps[0].parentNode.insertBefore(set, steps[0]);
      var bar = mk("div", "cyc-tabs");
      var track = mk("div", "cyc-tabs__track");
      track.setAttribute("role", "tablist");
      var g = steps[0].parentNode.closest("[data-group]");
      track.setAttribute("aria-label", (g ? (g.dataset.groupName || g.dataset.group) + ", " : "") +
                         (root.getAttribute("aria-label") || noun + "s"));
      var thumb = mk("span", "cyc-tabs__thumb");
      thumb.setAttribute("aria-hidden", "true");
      track.appendChild(thumb);
      bar.appendChild(track);
      set.appendChild(bar);
      var ts = { set: set, track: track, thumb: thumb, steps: steps, btns: [], cur: -1 };
      steps.forEach(function (s, i) {
        set.appendChild(s);
        if (!s.id) s.id = (root.id || "cyc") + "-" + tabsets.length + "-" + (i + 1);
        s.setAttribute("role", "tabpanel");
        var b = mk("button", "cyc-tabs__btn");
        b.type = "button";
        b.id = s.id + "-tab";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-controls", s.id);
        s.setAttribute("aria-labelledby", b.id);
        /* the prototype's own number, from its band ("Prototype 2"): a set
           whose first prototype is not on the page starts at 2 */
        var kick = $(".dbtl-kick", s), m = kick && /(\d+)/.exec(kick.textContent);
        var no = m ? m[1] : String(i + 1);
        var n = mk("b", null, no);
        n.setAttribute("aria-hidden", "true");
        var name = (s.dataset.step || "").replace(/\s+/g, " ").trim();
        var lab = mk("span", "cyc-tabs__lab");
        lab.innerHTML = name ? s.dataset.step : noun + " " + no;
        b.setAttribute("aria-label", noun + " " + no + (name ? ": " + lab.textContent : ""));
        b.appendChild(n); b.appendChild(lab);
        b.addEventListener("click", function () { show(ts, i, true); });
        b.addEventListener("keydown", function (e) {
          var k = e.key, j = -1;
          if (k === "ArrowRight") j = (i + 1) % steps.length;
          else if (k === "ArrowLeft") j = (i - 1 + steps.length) % steps.length;
          else if (k === "Home") j = 0;
          else if (k === "End") j = steps.length - 1;
          if (j < 0) return;
          e.preventDefault();
          show(ts, j, true);
          ts.btns[j].focus();
        });
        track.appendChild(b);
        ts.btns.push(b);
      });
      tabsets.push(ts);
      root.classList.add("has-tabs");
      show(ts, 0, false);
    });
  }

  function place(ts) {
    var b = ts.btns[ts.cur];
    if (!b || !b.offsetWidth) return;
    ts.thumb.style.width = b.offsetWidth + "px";
    ts.thumb.style.transform = "translateX(" + b.offsetLeft + "px)";
    ts.track.classList.add("has-thumb");
  }

  function show(ts, i, user) {
    if (i === ts.cur) return;
    ts.cur = i;
    ts.steps.forEach(function (s, k) {
      var on = k === i;
      s.hidden = !on;
      ts.btns[k].setAttribute("aria-selected", on ? "true" : "false");
      ts.btns[k].tabIndex = on ? 0 : -1;
    });
    place(ts);
    /* the strip scrolls inside itself, never the page */
    var b = ts.btns[i];
    if (ts.track.scrollWidth > ts.track.clientWidth + 1) {
      var x = b.offsetLeft + b.offsetWidth / 2 - ts.track.clientWidth / 2;
      ts.track.scrollTo({ left: Math.max(0, x), behavior: reduce || !user ? "auto" : "smooth" });
    }
    /* a reader who switched from far down a long prototype goes back to the
       top of the one they chose; one already at the top stays put */
    if (user) {
      var top = ts.set.getBoundingClientRect().top;
      var line = navH() + 12;
      if (top < line - 4) window.scrollTo({ top: window.scrollY + top - line, behavior: "instant" });
    }
    if (list) mark();
  }

  /* open the tab holding `el`, if it is in a shut one */
  function openCycle(el) {
    tabsets.forEach(function (ts) {
      ts.steps.forEach(function (s, k) { if (s.hidden && s.contains(el)) show(ts, k, false); });
    });
  }

  function placeAll() { tabsets.forEach(place); }

  /* ---- start -------------------------------------------------------------- */

  function start() {
    $$("[data-cycles]").forEach(cycles);
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
      if (!a) return;
      var href = a.getAttribute("href");
      land(href, false);
      /* a plain click follows the link; one with a modifier opens a tab */
      var t = targetOf(href);
      if (t && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) aim(t);
    }, true);
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (type) {
      window.addEventListener(type, letGo, { passive: true, capture: true });
    });

    /* a fold opening or closing changes what the rail should list */
    document.addEventListener("toggle", function (e) {
      if (e.target.classList && e.target.classList.contains("fold")) mark();
    }, true);

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; mark(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", rest, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    if (tabsets.length) {
      var refit = placeAll;
      window.addEventListener("resize", refit, { passive: true });
      window.addEventListener("load", refit);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
