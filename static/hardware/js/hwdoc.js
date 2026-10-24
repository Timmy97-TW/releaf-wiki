/* =============================================================================
   ReLEAF hardware: the record's behaviour
   -----------------------------------------------------------------------------
   The four things hwdoc.css needs a script for, and nothing else:

     1. rail    the contents sidebar, built from the record's own headings:
                section numbers, a pill on the section the reader is in, and
                sub-headings that unfold under it. The pill follows the reader
                down the page; only that section is unfolded. The hand-written
                <ol> in the page is the no-script fallback and is replaced here.
     2. landing a link (or a URL) pointing into a prototype whose tab is not
                showing, or into a shut fold, opens it first and then goes there.
     3. aim     a jump re-measures once the page stops moving, so it lands on
                its target even when what it passed on the way grew.
     4. cycles  a record's design-build-test-learn prototypes, one group at a
                time behind a horizontal tab bar the reader clicks, in any order
                (17 Oct 2026; it replaced the 15 Oct stacked prototypes and
                their sticky stepper, and brings back the tabs they replaced).

   With JavaScript off every prototype is on the page, every fold works on its own,
   and the written <ol> is the contents list, so nothing is reachable only by
   clicking. Load after ../js/polish.js:
     <script src="static/hardware/js/hwdoc.js"></script>
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

  /* A heading or a part inside a cycle that is not showing must not be
     counted as scrolled past: a hidden element's rect is all zeros, so
     `top <= line` is true for every one of them and the last cycle always
     wins. */
  function visible(el) { return !!(el.offsetParent || el.getClientRects().length); }

  /* The edit doc's sidebars name every prototype of a set of cycles, the ones
     behind a tab that is not showing included, and a click on one opens its
     tab (landing, below). So a heading hidden only because its prototype's
     tab is shut is listed; one hidden for any other reason -- inside a shut
     fold, or in a set that is itself out of sight -- is not. Listing is all
     this changes: `mark()` still asks `visible()`, for the reason above. */
  function listed(h) {
    if (visible(h)) return true;
    var panel = h.closest && h.closest(".cyc[role=tabpanel]");
    if (!panel || !panel.hidden || !visible(panel.parentNode)) return false;
    for (var n = h.parentNode; n && n !== panel; n = n.parentNode) {
      if (n.tagName === "DETAILS" && !n.open) return false;
      if (n.hidden || getComputedStyle(n).display === "none") return false;
    }
    return true;
  }

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
      n.textContent = String(parseInt(L.no, 10) || L.no);
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
          if (!listed(h)) return;
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
      /* plain, as the twin's "On this page" numbers them and as each part's
         own heading now does ("5.", hwdoc.css 6); until 17 Oct "05" */
      n.textContent = String(num);
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
    /* 18 Oct 2026 (photometer audit): the reading line is the upper third of the window, not 80 px under the bar.
       At 1440 x 900 a heading had to climb to ~140 px before it lit, so the rail stayed one sub-section behind
       ("Design Changes" lit while 4.3 filled the screen). */
    var line = Math.max(navH() + 80, window.innerHeight * 0.34);
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
    reveal(t);
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
    if (Math.abs(off) > 1.5 * window.innerHeight) { hold = null; return; }   // the reader has moved on (W6 R2, V25)
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

  /* ---- 4. the cycles: a tab bar over each group ----------------------------- */
  /* 17 Oct 2026. The owner: "bring back the horizontal bar that we click for
     the dbtl, don't make it linear they can choose whether to skip or not."
     It replaces the 15 Oct layout, which stacked every prototype with a
     sticky stepper over the set.

     Each group of prototypes -- a `.cyc-group`, or the whole set when it has
     no groups -- gets one bar: the digital twin page's segmented pill, a tab
     per prototype with its number and its short name (data-step). A click
     shows that prototype, its band and its four stages, and hides the group's
     others; nothing forces an order. The bar sits right above the group's
     first prototype, after the group's own introduction, and is sticky inside
     the group alone, so it leaves with the group and never stacks on another
     group's bar. At the foot of each prototype a small "Next" opens the one
     after it, for a reader who would rather go in order. A group of one
     prototype has nothing to switch and gets no bar.

     Markup, the same on all four instrument pages (unchanged since 15 Oct):
       <div class="cycles" data-cycles [data-noun="DBTL"] aria-label="...">
         [<div class="cyc-group" data-group="Growth" data-group-name="Bacterial Growth">]
           [<section class="sec"> the group's introduction </section>]
           <div class="cyc [is-todo]" data-step="Vertical">       (one per prototype)
             <section class="sec cyc__band" id="cyc2"> ring, kick, title, stage list </section>
             <section class="sec cyc__body"> the four stages </section>
           </div> ...
         [</div>]
       </div>
     With JavaScript off, and in print, every prototype is on the page,
     stacked, as before. A link, the rail, the cycle map or a URL pointing into
     a prototype that is not showing opens its tab first (land(), above). */

  var sets = [], uid = 0, START_LAST = true;

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function cycles(root) {
    var steps = $$(".cyc[data-step]", root);
    if (!steps.length) return;
    var groups = [];
    steps.forEach(function (s) {
      var g = s.parentNode.closest("[data-group]");
      if (!g || !root.contains(g)) g = root;
      var grp = null;
      groups.forEach(function (x) { if (x.el === g) grp = x; });
      if (!grp) { grp = { el: g, steps: [] }; groups.push(grp); }
      grp.steps.push(s);
    });
    var noun = root.dataset.noun || "Prototype";
    root.classList.add("is-tabbed");
    groups.forEach(function (g) { if (g.steps.length > 1) tabs(root, g, noun); });
  }

  function tabs(root, g, noun) {
    var k = ++uid;
    var first = g.steps[0];
    var name = g.el === root ? (root.getAttribute("aria-label") || noun + "s")
                             : (g.el.dataset.groupName || g.el.dataset.group || noun + "s");

    /* where the bar sits when it is not pinned: the bar's own rect moves
       while it is sticky, this one does not */
    var at = mk("span", "cyc-tabs__at");
    at.setAttribute("aria-hidden", "true");
    var bar = mk("div", "cyc-tabs");
    var tl = mk("div", "cyc-tabs__list");
    tl.setAttribute("role", "tablist");
    tl.setAttribute("aria-label", name);
    bar.appendChild(tl);

    var set = { root: root, grp: g.el, at: at, bar: bar, list: tl, items: [], cur: -1, compact: false, touched: false };

    /* 19 Oct 2026, the owner: each group opens on its final prototype, so a
       reader who only scrolls past still sees the finished work. A thin
       segmented line under the bar says where in the run that is, and a small
       "Start at 1" (until the reader picks a tab) says there is a story
       before it. START_LAST = false puts the old behaviour back. */
    var prog = mk("div", "cyc-prog");
    prog.setAttribute("aria-hidden", "true");
    bar.appendChild(prog);
    set.prog = prog;
    var hint = mk("button", "cyc-hint");
    hint.type = "button";
    hint.appendChild(mk("i", null, "←"));
    hint.appendChild(mk("span", null, "Start at " + noun + " 1"));
    hint.hidden = true;
    hint.addEventListener("click", function () { set.touched = true; select(set, 0, true); });
    bar.appendChild(hint);
    set.hint = hint;

    g.steps.forEach(function (s, i) {
      var n = i + 1;
      var step = (s.dataset.step || "").replace(/\s+/g, " ").trim();
      var todo = s.classList.contains("is-todo");
      var b = mk("button", "cyc-tab" + (todo ? " is-todo" : ""));
      b.type = "button";
      b.id = "cyc-tab-" + k + "-" + n;
      if (!s.id) s.id = "cyc-panel-" + k + "-" + n;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", s.id);
      /* the whole name for a screen reader, and as the tooltip when the bar
         is too narrow to print every name */
      b.setAttribute("aria-label", noun + " " + n + (step ? ": " + step : "") + (todo ? ", not written yet" : ""));
      var badge = mk("b", "cyc-tab__n", String(n));
      badge.setAttribute("aria-hidden", "true");
      var lab = mk("span", "cyc-tab__t", step || noun + " " + n);
      lab.setAttribute("aria-hidden", "true");
      b.appendChild(badge); b.appendChild(lab);
      tl.appendChild(b);

      s.setAttribute("role", "tabpanel");
      s.setAttribute("aria-labelledby", b.id);
      set.items.push({ el: s, btn: b, n: n, step: step, target: $(".cyc__band[id]", s) || s });

      b.addEventListener("click", function () { set.touched = true; select(set, i, true); });
      prog.appendChild(mk("i"));
      b.addEventListener("keydown", function (e) { keys(set, i, e); });
    });

    /* "Next" at the foot of each prototype but the last: an ordinary link to
       the next one's band, so land() opens its tab and doc.js takes the reader
       there, the way any link into a shut prototype does */
    set.items.forEach(function (it, i) {
      var nx = set.items[i + 1];
      if (!nx) return;
      var p = mk("p", "cyc-next");
      var a = mk("a");
      a.href = "#" + nx.target.id;
      a.appendChild(mk("span", "cyc-next__lead", "Next"));
      a.appendChild(mk("span", "cyc-next__t", noun + " " + nx.n + (nx.step ? " · " + nx.step : "")));
      var ar = mk("i", null, "→");
      ar.setAttribute("aria-hidden", "true");
      a.appendChild(ar);
      p.appendChild(a);
      it.el.appendChild(p);
    });
    /* the final prototype, the one a group opens on, points back to the start */
    if (START_LAST && set.items.length > 1) {
      var f = set.items[0], lp = mk("p", "cyc-next cyc-next--back"), la = mk("a");
      la.href = "#" + f.target.id;
      var bi = mk("i", null, "←");
      bi.setAttribute("aria-hidden", "true");
      la.appendChild(bi);
      la.appendChild(mk("span", "cyc-next__lead", "From the start"));
      la.appendChild(mk("span", "cyc-next__t", noun + " 1" + (f.step ? " · " + f.step : "")));
      lp.appendChild(la);
      set.items[set.items.length - 1].el.appendChild(lp);
    }

    first.parentNode.insertBefore(at, first);
    first.parentNode.insertBefore(bar, first);
    g.el.classList.add("has-tabs");

    /* open on whichever prototype the URL points into, else the last one
       that is written (the first, with START_LAST off) */
    var start = 0, t = targetOf(location.hash);
    if (START_LAST) set.items.forEach(function (it, i) { if (!it.btn.classList.contains("is-todo")) start = i; });
    set.items.forEach(function (it, i) { if (t && (it.el === t || it.el.contains(t))) start = i; });
    sets.push(set);
    set.start = start;
    select(set, start, false);
    fit(set);
  }

  /* show prototype i of a set. `user` is a click or a key on the bar itself,
     and the new prototype slides in. Either way a reader inside the group,
     under the pinned bar, is taken to the top of the new prototype rather
     than left somewhere in its middle. */
  function select(set, i, user) {
    if (i === set.cur) return false;
    var first = set.cur < 0;
    /* measured before the switch: hiding a long prototype can shorten the
       page under the reader, and then they would no longer look inside */
    var inside = !first && pinned(set);
    set.cur = i;
    if (set.prog) $$("i", set.prog).forEach(function (seg, j) { seg.classList.toggle("is-on", j <= i); });
    if (set.hint) set.hint.hidden = set.touched || i === 0 || i !== set.start;
    set.items.forEach(function (it, j) {
      var on = j === i;
      it.btn.setAttribute("aria-selected", on ? "true" : "false");
      it.btn.tabIndex = on ? 0 : -1;
      it.el.hidden = !on;
      if (on && user && !reduce) {
        it.el.classList.remove("is-entering");
        void it.el.offsetWidth;
        it.el.classList.add("is-entering");
      }
    });
    if (first) return true;
    if (set.compact) fit(set); else into(set);
    if (inside) settle(set);
    mark();
    paintAll();
    return true;
  }

  function keys(set, i, e) {
    var n = set.items.length, j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % n;
    else if (e.key === "ArrowLeft") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    select(set, j, true);
    set.items[j].btn.focus({ preventScroll: true });
  }

  /* the bar's pinned top, from hwdoc.css, and whether the reader is inside
     the group with the bar pinned over what they are reading */
  function stickTop(set) { return parseFloat(getComputedStyle(set.bar).top) || navH() + 8; }
  function pinned(set) {
    var top = stickTop(set);
    return set.at.getBoundingClientRect().top < top - 1 &&
           set.grp.getBoundingClientRect().bottom > top + set.bar.offsetHeight;
  }
  /* bring the bar back to its own place, just under the nav, so the
     prototype now showing starts right under it */
  function settle(set) {
    var d = set.at.getBoundingClientRect().top - stickTop(set);
    if (d < -1) window.scrollTo({ top: Math.max(0, window.scrollY + d), behavior: "instant" });
  }

  /* open the prototype that holds `t`, if its tab is shut. A reader inside
     the group (the bar pinned) is first taken to the top of it (select()),
     so whatever the link then glides to is measured from there and not from
     a page that just changed height under them. */
  function reveal(t) {
    var opened = null;
    sets.forEach(function (set) {
      set.items.forEach(function (it, i) {
        if (it.el.hidden && (it.el === t || it.el.contains(t)) && select(set, i, false)) opened = set;
      });
    });
    return opened;
  }
  window.hwdocReveal = function (t) { return !!(t && reveal(t)); };

  /* Every name when they all fit; when they do not (a phone, a long set),
     the numbers alone and the name of the prototype that is showing. If even
     that is too wide the bar scrolls inside itself, its edges fading. */
  function fit(set) {
    var bar = set.bar, tl = set.list;
    bar.classList.remove("is-compact", "is-scroll");
    var over = tl.scrollWidth > tl.clientWidth + 1;
    set.compact = over;
    bar.classList.toggle("is-compact", over);
    set.items.forEach(function (it) {
      if (over) it.btn.title = it.btn.getAttribute("aria-label"); else it.btn.removeAttribute("title");
    });
    bar.classList.toggle("is-scroll", tl.scrollWidth > tl.clientWidth + 1);
    if (bar.offsetHeight) set.grp.style.setProperty("--cyc-bar-h", bar.offsetHeight + "px");
    into(set);
    paintAll();
  }

  /* a bar that scrolls keeps the open tab in view; only the bar moves */
  function into(set) {
    var tl = set.list;
    if (tl.scrollWidth <= tl.clientWidth + 1 || set.cur < 0) return;
    var b = set.items[set.cur].btn;
    var x = b.offsetLeft - (tl.clientWidth - b.offsetWidth) / 2;
    tl.scrollTo({ left: Math.max(0, x), behavior: "auto" });
  }

  /* Two groups' bars are never on screen together (the 14 Oct edit doc:
     "Horizontal navbars never overlap"). Sticky inside its own group a bar
     cannot stack on another, but on the photometer the growth bar, pinned and
     on its way out, and the Pro bar coming in shared the screen for a
     moment. So a pinned bar steps aside while another group's bar is in view
     at its own place, and comes back when that one has gone. */
  function paintAll() {
    var vh = window.innerHeight;
    var home = sets.map(function (s) {
      var t = s.at.getBoundingClientRect().top;
      return t >= stickTop(s) - 1 && t < vh;
    });
    sets.forEach(function (s, i) {
      var stuck = s.at.getBoundingClientRect().top < stickTop(s) - 1;
      var other = home.some(function (h, j) { return h && j !== i; });
      s.bar.classList.toggle("is-away", stuck && other);
      s.bar.classList.toggle("is-pinned", pinned(s));
    });
  }

  /* ---- start -------------------------------------------------------------- */

  function start() {
    $$("[data-cycles]").forEach(cycles);
    buildToc();

    /* The rail is the record's own headings, copied out of the page. i18n.js
       rewrites those headings afterwards, so the rail would keep the language
       the page was built in: read them again once they have changed. */
    document.addEventListener("releaf:lang", function () { buildToc(); });

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
          if (Math.abs(top - parseFloat(getComputedStyle(t).scrollMarginTop || 0)) > 40 && window.scrollY > 0) land(want, true);
        });
      });
    }
    /* a hash typed into the address bar, or Back to one: the browser has
       already tried to scroll to it, which does nothing if its tab was shut */
    window.addEventListener("hashchange", function () {
      var t = targetOf(location.hash);
      land(location.hash, !!t && !visible(t));
    });
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
      requestAnimationFrame(function () { queued = false; mark(); paintAll(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", rest, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    if (sets.length) {
      var refit = function () { sets.forEach(fit); };
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
