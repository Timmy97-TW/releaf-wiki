/* =============================================================================
   ReLeaf: homepage behaviour
   -----------------------------------------------------------------------------
   Independent pieces. Each one checks for the element it drives and stops
   if it is missing, so removing a section from index.html never breaks the
   rest of the file.

     0  drift       the farm drifts behind the page and fades to white on the way out
     1  reveal      one-shot fade-and-rise for .rise
     2  reactor     wakes the WebGL reactor before it is needed
     3  parts       point at a demand card, its parts light in the WebGL reactor
     5  ihp tabs    the five demands and the objection as tabs over one panel
     7  scene       the five demands become the labels round the reactor
     8  threat      the map's three frames, walked by the scroll
     (4 doors was retired on 28 September 2026 with the section it drove,
     and 6 chapters on 18 October with the dot rail; the numbers of the
     others were kept.)

   Elsewhere: the model
   itself (home-reactor.js, loaded before this file), the big picture's one
   control that opens every block (big-picture.js) and the vision's pull-back
   (home-vision.js, loaded after this file because it scrolls on the
   window.__homeFrame made below).

   THE RESTING STATE IS THE FINISHED STATE. Every default in home.css shows the
   final frame, and this file only moves things once it has taken control. With
   JavaScript off, or prefers-reduced-motion set, the page is static and
   complete rather than static and empty. Test both before shipping a change.
   ========================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  // progress through [a, b], eased, clamped at both ends
  var span = function (v, a, b) { return clamp01((v - a) / (b - a)); };
  var ease = function (t) { return t * t * (3 - 2 * t); };

  /* ONE FRAME, TWO PHASES. Everything on this page that follows the scroll
     measures in the first phase and writes in the second, across files, so the
     browser lays the page out once a frame rather than once for every script
     that reads after another one wrote. A job's read() returns what its
     write() needs, or undefined to skip the frame. This file creates the
     object; home-vision.js uses it and loads after this file (without it, the
     vision stays the finished <img>).

     ONE BROKEN JOB STOPS ONLY ITSELF. Each read() and write() runs on its
     own; a job that throws is dropped for good and its fail(), if it gave
     one, puts its section into the finished state. Every other job carries
     on in the same frame. */
  var homeFrame = window.__homeFrame || (window.__homeFrame = (function () {
    var jobs = [], queued = false;
    function kill(j) {
      j.dead = true;
      if (j.fail) { try { j.fail(); } catch (e) { /* nothing left to do */ } }
    }
    function run() {
      queued = false;
      var seen = jobs.map(function (j) {
        if (j.dead) return undefined;
        try { return j.read(); } catch (e) { kill(j); return undefined; }
      });
      jobs.forEach(function (j, i) {
        if (j.dead || seen[i] === undefined) return;
        try { j.write(seen[i]); } catch (e) { kill(j); }
      });
    }
    return {
      add: function (read, write, fail) { jobs.push({ read: read, write: write, fail: fail || null, dead: false }); },
      request: function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(run);
      }
    };
  })());

  /* ═════════════════════════════════════════════════════════════ 0  DRIFT ══ */
  /* On the way out of the hero the field moves at a third of the scroll and
     grows a little, so it reads as further away than the words, which leave a
     little faster than the page and fade; in the last half the white veil
     comes up, so the field dissolves into the white the map opens on (the
     map's first stop is this same farm). Transform and opacity only, written
     in the shared frame. Reduced motion: nothing moves. */

  (function drift() {
    var hero = document.querySelector(".hero");
    if (!hero || reduced) return;
    var farm = hero.querySelector(".hero__frame--farm");
    var inner = hero.querySelector(".hero__inner");
    var veil = hero.querySelector(".hero__veil");
    if (!farm || !inner || !veil) return;
    hero.classList.add("is-drift");
    var last = -1;
    homeFrame.add(function () {
      var r = hero.getBoundingClientRect();
      var k = clamp01(-r.top / r.height);
      if (k === last) return undefined;
      return { k: k, h: r.height };
    }, function (s) {
      last = s.k;
      farm.style.transform = s.k ? "translate3d(0," + (s.k * s.h * .34).toFixed(1) + "px,0) scale(" + (1 + .05 * s.k).toFixed(4) + ")" : "";
      inner.style.transform = s.k ? "translate3d(0," + (-s.k * s.h * .1).toFixed(1) + "px,0)" : "";
      inner.style.opacity = s.k ? (1 - ease(span(s.k, .12, .55))).toFixed(3) : "";
      veil.style.opacity = s.k ? (ease(span(s.k, .4, .95)) * .92).toFixed(3) : "";
    }, function () {
      farm.style.transform = inner.style.transform = inner.style.opacity = veil.style.opacity = "";
    });
    window.addEventListener("scroll", homeFrame.request, { passive: true });
    window.addEventListener("resize", homeFrame.request, { passive: true });
    homeFrame.request();
  })();

  /* ══════════════════════════════════════════════════════════ 1  REVEAL ══ */

  /* .rise is visible in home.css. Only an element that is still below the
     screen is hidden here (.is-armed), just before it is watched, so nothing
     already in view blinks out, and nothing is hidden unless this script is
     running to bring it back. */
  (function reveal() {
    var targets = document.querySelectorAll(".rise");
    if (!targets.length || reduced || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    Array.prototype.forEach.call(targets, function (el) {
      if (el.getBoundingClientRect().top <= window.innerHeight) return;
      el.classList.add("is-armed");
      io.observe(el);
    });
  })();

  /* ══════════════════════════════════════════════════════ 2  THE REACTOR ══ */
  /* Wakes the reactor: home-reactor.js loads nothing until start() is
     called. It is woken twice over, and whichever comes first wins.

     EARLY, ON ITS OWN (11 Oct, owner: "can it load before people scroll down
     to it"). three.js, the glTF loader and the model are about 2.5 MB, and
     at 1.6 screens' warning a reader who scrolls briskly used to arrive
     while the photograph was still standing in for it. So once the FIRST
     SCREEN IS PAID FOR — the load event, which on this page means the farm
     photograph and the machine in it are in — and the browser next goes
     idle, it starts loading anyway. The reader is still reading the problem
     at that point, seven screens up, and the files come down while nothing
     else wants the line.

     NOT ON A LINE THAT CANNOT AFFORD IT. With Data Saver on, or on a
     connection the browser calls 2g, the early wake is skipped and the
     observer below is the only one: 2.5 MB is not something to spend on a
     section the reader may never reach.

     THE OBSERVER IS THE FLOOR. It calls start() once #rx is within 1.6
     screens, so a reader who scrolls straight down is never waiting on the
     idle queue. Inside the scene (piece 7) #rx sits at the top of the
     pinned screen, so it fires as the demands come up, several screens
     before the model pops in. Reduced motion and narrow screens need it
     too. */

  (function reactor() {
    var host = document.getElementById("rx");
    var rx = window.__homeRx;
    if (!host || !rx || rx.failed) return;
    var woken = false;
    var wake = function () { if (!woken) { woken = true; rx.start(); } };
    if (!("IntersectionObserver" in window)) { wake(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); wake(); return; }
      }
    }, { rootMargin: "0px 0px 160% 0px" });
    io.observe(host);

    var net = navigator.connection || {};
    if (net.saveData || /(^|-)2g$/.test(net.effectiveType || "")) return;
    function early() {
      // the opening's own promise, where there is one: the white must be off
      // the farm before anything else is asked for
      Promise.resolve(window.__introDone).then(function () {
        if (window.requestIdleCallback) window.requestIdleCallback(wake, { timeout: 3000 });
        else window.setTimeout(wake, 1500);
      });
    }
    if (document.readyState === "complete") early();
    else window.addEventListener("load", early, { once: true });
  })();

  /* ═══════════════════════════════════════════════════════════ 3  PARTS ══ */
  /* Point at a demand card and the components it names light up in the
     model while everything else dims; the other cards step back too. Moving
     off puts it all back. Nothing needs a click.

       mouse or pen   the card under the pointer
       keyboard       the card with visible focus (Tab), until focus leaves;
                      the stage is brought on screen first, so the lit parts
                      can be seen
       press          the cards are toggle buttons (aria-pressed): a click,
                      a tap, Enter or Space keeps a card lit when the pointer
                      or the focus moves on; pressing it again, pressing
                      another card, a click outside the cards (a drag on
                      the model, or a tap on it, keeps it), or Escape puts
                      it back. On a touch screen this is how a card is lit
                      at all.

     What shows is the card under the pointer, else the card with keyboard
     focus, else the pressed card. data-comp may hold several ids separated
     by spaces; the whole string is the identity here, and home-reactor.js
     does the splitting.

     A tap outside is read from the click it ends in, not from the touch that
     starts it: a finger that starts a scroll in a gutter ends in
     pointercancel and never clicks, so reading on down the cards keeps the
     light. A tap on a plain element that some mobile browsers do not turn
     into a click is caught by the touch pointerup that did not move. */

  (function partlist() {
    var list = document.getElementById("partlist");
    if (!list) return;
    var cards = [].slice.call(list.querySelectorAll("[data-comp]"));
    if (!cards.length) return;
    var rx = window.__homeRx;
    var sec = document.getElementById("solution");
    var stage = sec ? sec.querySelector(".rxs__stage") : null;
    var model = document.getElementById("rx");
    var box = model ? (model.querySelector(".rxs__canvas") || model) : null;
    var hovered = null, focused = null, pressed = null, shown = null;
    var lastPointer = "mouse", downX = 0, downY = 0;

    // The cards are model controls only while there is a model to light. The
    // markup ships them as plain buttons; they become toggles (aria-pressed,
    // described as lighting the model) here, and go back to plain text beside
    // the photograph for good if the model gives up (no WebGL, a failed load,
    // a lost context: home-reactor.js fires "rx-giveup" on #rx). Scripting
    // off, they never become toggles at all.
    var off = false;
    function armed(on) {
      cards.forEach(function (c) {
        if (on) {
          c.setAttribute("aria-pressed", "false");
          c.setAttribute("aria-describedby", "rxs-how");
        } else {
          c.removeAttribute("aria-pressed");
          c.removeAttribute("aria-describedby");
          c.classList.remove("is-on");
        }
      });
      if (on) return;
      off = true;
      hovered = focused = pressed = shown = null;
      list.classList.remove("is-pointing");
      if (sec) sec.classList.add("rx-static");
    }
    if (!rx || rx.failed || (model && model.classList.contains("no-gl"))) { armed(false); return; }
    armed(true);
    if (model) model.addEventListener("rx-giveup", function () { armed(false); });

    function keyboardFocus(el) {
      try { return el.matches(":focus-visible"); } catch (e) { return true; }
    }

    function sync() {
      if (off) return;
      cards.forEach(function (c) { c.setAttribute("aria-pressed", c === pressed ? "true" : "false"); });
      var on = hovered || focused || pressed;
      if (on === shown) return;
      shown = on;
      cards.forEach(function (c) { c.classList.toggle("is-on", c === on); });
      list.classList.toggle("is-pointing", !!on);
      if (rx && rx.highlight) rx.highlight(on ? on.getAttribute("data-comp") : null);
    }

    // Keyboard focus lands on a card: make sure the model is on screen with
    // it. Inside the scene (piece 7) the whole stage is the pinned screen,
    // and piece 7 takes a card that is not in yet to the finished frame. Where
    // the model sticks on a narrow screen, the card has to come out below
    // it. In an ordinary band, the model and the card both, when they fit.
    // Instant with reduced motion.
    function reveal(card) {
      if (!stage || !box) return;
      var v = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
      var top = v > 0 ? v : 68, vh = window.innerHeight, gap = 12, dy = 0;
      var c = card.getBoundingClientRect();
      var dx = document.getElementById("dx");
      if (dx && dx.classList.contains("is-live")) {
        return;
      } else if (window.getComputedStyle(model).position === "sticky") {
        var floor = top + model.offsetHeight + 2 * gap;
        if (c.top < floor) dy = c.top - floor;
        else if (c.bottom > vh - gap) dy = c.bottom - (vh - gap);
      } else {
        var m = box.getBoundingClientRect();
        var t = Math.min(m.top, c.top), b = Math.max(m.bottom, c.bottom);
        if (b - t <= vh - top - 2 * gap) {
          if (t < top + gap) dy = t - top - gap;
          else if (b > vh - gap) dy = b - (vh - gap);
        } else if (c.top < top + gap || c.bottom > vh - gap) {
          dy = c.top - top - gap;
        }
      }
      if (Math.abs(dy) < 2) return;
      window.scrollBy({ top: dy, left: 0, behavior: reduced ? "auto" : "smooth" });
    }

    // what the last press was made with, and where, so a touch that did not
    // move can be told from a scroll
    document.addEventListener("pointerdown", function (e) {
      lastPointer = e.pointerType || "mouse";
      downX = e.clientX; downY = e.clientY;
    }, { capture: true, passive: true });

    cards.forEach(function (c) {
      c.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        hovered = c; sync();
      });
      c.addEventListener("pointerleave", function (e) {
        if (e.pointerType === "touch" || hovered !== c) return;
        hovered = null; sync();
      });
      c.addEventListener("focus", function () {
        if (off || !keyboardFocus(c)) return;
        focused = c; sync();
        reveal(c);
      });
      c.addEventListener("blur", function () {
        if (focused !== c) return;
        focused = null; sync();
      });
      // a click, a tap, Enter or Space
      c.addEventListener("click", function () {
        pressed = pressed === c ? null : c;
        sync();
      });
    });

    // A click outside the cards puts the light out. On the model (its
    // canvas runs the width of the band) a drag keeps it, so a reader can
    // turn a lit part round, and so does a tap, because a finger on a
    // phone's sticky model is usually turning it; a mouse click that did
    // not move puts it out like any other.
    function release(e) {
      var t = e.target;
      if (!pressed || (t && t.closest && t.closest("[data-comp]"))) return;
      var moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4;
      if (model && model.contains(t) && (moved || lastPointer === "touch")) return;
      pressed = null; sync();
    }
    document.addEventListener("click", release);
    document.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "touch") return;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 10) return;
      release(e);
    }, { passive: true });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !(pressed || focused)) return;
      pressed = null; focused = null; sync();
    });
  })();

  /* ═════════════════════════════════════════════════════ 5  iHP TABS ══ */
  /* The five demands and the objection as tabs over one panel. The markup
     ships every panel visible and the tab row [hidden]; this takes control,
     shows the tabs and one panel. Arrow keys, Home and End move between
     tabs (automatic activation); the panel follows. */
  (function ihpTabs() {
    var sec = document.getElementById("ihp");
    var list = sec && sec.querySelector(".ihd__tabs");
    if (!list) return;
    var tabs = [].slice.call(list.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    if (!tabs.length || panels.indexOf(null) !== -1) return;

    function select(i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, false); });
      t.addEventListener("keydown", function (e) {
        var n = tabs.length, j = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % n;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + n) % n;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = n - 1;
        if (j === null) return;
        e.preventDefault();
        select(j, true);
      });
    });
    list.hidden = false;
    sec.classList.add("is-tabbed");
    select(0, false);
  })();

  /* ═══════════════════════════════════════════ 7  DEMANDS INTO THE ANSWER ══ */
  /* #dx wraps the five demands (#demands) and the answer (#solution). Where
     the answer's stage fits one screen, this adds .is-live (home-demands.css):
     .dx__pin holds the screen for a runway of RUN screens, and the scroll,
     read in screens from the moment the pin holds, scrubs one calm hand-off.
     Transform and opacity only, written once a frame through
     window.__homeFrame.

       0.10 to 1.16  the question alone, then the five demands arrive
                     under it, one by one, each with its line
       1.16 to 1.30  the five, held
       1.30 to 1.55  the question and the lines fade out, on white
       1.58 to 1.88  the white turns to ink, quickly and on a steep curve so
                     it hardly lingers in grey; the chips stay where they
                     are (dark green on white, then the tag's look on ink)
       1.90 to 2.45  each chip glides straight onto the tag of its card round
                     the reactor
       2.35 to 2.70  the reactor comes up from the middle of the five,
                     0.85 to 1 with its opacity; no overshoot
       2.62 to 2.82  the name, ReLEAF
       2.74 to 2.94  the line under it
       2.84 to 3.06  each card's words open under its tag
       3.00 to 3.20  the finished band, held
     18 Oct (owner): then the answer makes room for how it works.
       3.15 to 3.45  the five cards, the line and the name fade
       3.20 to 3.85  the reactor glides to the middle of the room left of
                     the HUD and grows to most of the screen's height (the
                     canvas is drawn with more pixels to match, so it stays
                     sharp)
       3.45 to 3.90  How ReLEAF works (#how) comes in on the right, a dark
                     HUD beside the machine
       3.90 to 6.60  the scroll plays its drawing (home-story.js, hosted on
                     this runway from data-story-lead = 3.9)
       6.60 to 6.95  the HUD and the section's name go, all of them
       6.72 to 7.10  the machine comes back to the middle of the screen and
                     takes the room the card leaves
       7.10 to 7.35  the whole machine alone, held
     18 Oct (Jacquelyn): the last two are hers — the right-hand card and
     "How ReLEAF works" disappear entirely at the end, and the machine
     returns to the centre.

     The chips land exactly on the tags and are drawn like them (they share
     the proportions, home-demands.css), so at 2.47 the chips hand over to
     the real tags without a visible step.

     THE RESTING STATE IS THE FINISHED LAYOUT: the two sections stacked. No
     scene with reduced motion, on a narrow or short screen, while printing,
     or if this throws (fail() puts it all back). Without the scene the
     chips come in one by one the first time they are seen. A link to either
     section, and keyboard focus on a card, land on the finished frame of
     their part of the scene. */

  (function scene() {
    var dx = document.getElementById("dx");
    var dmd = document.getElementById("demands");
    var sol = document.getElementById("solution");
    if (!dx || !dmd || !sol) return;
    var pin = dx.querySelector(".dx__pin");
    var runwayEl = dx.querySelector(".dx__runway");
    var paper = dx.querySelector(".dx__paper");
    var row = dmd.querySelector(".dmd__chips");
    var title = dmd.querySelector(".dmd__head");
    var kick = dmd.querySelector(".dmd__k");
    var chips = [].slice.call(dmd.querySelectorAll(".dmd__chip"));
    var stage = sol.querySelector(".rxs__stage");
    var head = sol.querySelector(".rxs__head");
    var lede = sol.querySelector(".rxs__lede");
    var model = document.getElementById("rx");
    var grid = document.getElementById("partlist");
    // How ReLEAF works, hosted in this screen (home-story.js), and the parts
    // of the answer that make room for it
    var howSec = document.getElementById("how");
    var howCard = howSec && howSec.querySelector(".st-card");
    var inner = sol.querySelector(".rxs__inner");
    var sides = [".rxs__side--l", ".rxs__side--r", ".rxs__wide"].map(function (q) { return sol.querySelector(q); });
    // the card tags, in the chips' order: Protective (under the model), On
    // demand and Automated (left), Biosafe and Monitored (right)
    var tags = [".rxs__wide", ".rxs__side--l > li:nth-child(1)", ".rxs__side--l > li:nth-child(2)",
                ".rxs__side--r > li:nth-child(1)", ".rxs__side--r > li:nth-child(2)"].map(function (q) {
      var el = sol.querySelector(q);
      return el ? el.querySelector(".rxs-card__tag") : null;
    });
    if (!pin || !runwayEl || !paper || !row || !title || chips.length !== 5 ||
        tags.indexOf(null) !== -1 || !stage || !head || !lede || !model || !grid ||
        !howSec || !howCard || !inner || sides.indexOf(null) !== -1) return;
    var rx = window.__homeRx;

    /* ---- without the scene: the chips come in one by one, once ---- */
    var armed = false;
    if (!reduced && "IntersectionObserver" in window && row.getBoundingClientRect().top > window.innerHeight) {
      armed = true;
      dmd.classList.add("is-armed");
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        dmd.classList.add("in");
        seen.disconnect();
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.4 });
      seen.observe(row);
    }

    if (reduced || !window.matchMedia) return;
    // the runway in screens: the same number as .dx__runway's height in
    // home-demands.css
    var RUN = 7.35, LEAD = 3.9;
    var fits = window.matchMedia("(min-width: 980px) and (min-height: 640px)");
    var live = false, geo = null, navH = 68, parked = null, printing = false;
    var moved = [title, kick, head, lede, model, sol, paper].concat(chips, sides);
    var cache = new Map();

    // write only what changed since the last frame
    function put(el, prop, v) {
      var c = cache.get(el);
      if (!c) { c = {}; cache.set(el, c); }
      if (c[prop] === v) return;
      c[prop] = v;
      if (prop.charAt(0) === "-") el.style.setProperty(prop, v);
      else el.style[prop] = v;
    }
    function park(on) {
      if (parked === on || !rx || !rx.park) return;
      parked = on;
      rx.park(on);
    }
    function clear() {
      moved.forEach(function (el) {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
      });
      dmd.style.removeProperty("--dmd-m");
      grid.style.removeProperty("--dx-card");
      grid.style.removeProperty("--dx-tag");
      model.style.removeProperty("--rxui-k");
      dx.style.removeProperty("--dx-how");
      dx.classList.remove("is-early", "is-how");
      cache = new Map();
      park(false);
    }

    // Where each chip sits in its row and where its tag sits in the
    // finished band, in the pin's pixels, with every transform off. Runs
    // when the scene starts and after any change of size or type.
    function measure() {
      clear();
      var pr = pin.getBoundingClientRect();
      var box = function (el) {
        var r = el.getBoundingClientRect();
        return { x: r.left - pr.left + r.width / 2, y: r.top - pr.top + r.height / 2, w: r.width };
      };
      geo = { run: Math.max(1, runwayEl.offsetHeight), from: chips.map(box), to: tags.map(box) };
      // where the reactor goes: the middle of the room left of the HUD, as
      // the HUD stands once it is in (hosted layout, --dx-how at 1), and as
      // big as that room and the pin's height allow (the machine is about
      // 1.1 x the canvas height across)
      howSec.classList.add("is-live", "is-hosted");
      dx.style.setProperty("--dx-how", "1");
      var cr = howCard.getBoundingClientRect(), ir = inner.getBoundingClientRect();
      var left = ir.left + (parseFloat(window.getComputedStyle(inner).paddingLeft) || 0);
      var mr = model.getBoundingClientRect();
      dx.style.removeProperty("--dx-how");
      // 18 Oct (Jacquelyn): "do not overlap the diagram and the CAD model",
      // so the machine is measured against the room left of the card with a
      // clear gap (it is about 1.12 x the canvas height across)
      var room = Math.max(1, cr.left - left - 28);
      var k = Math.min(1.9, pr.height * 0.88 / Math.max(1, mr.height), room / Math.max(1, mr.height * 1.12));
      // and where it goes once the card is gone: the middle of the screen,
      // as big as the whole pin allows
      var k2 = Math.min(1.9, pr.height * 0.92 / Math.max(1, mr.height), pr.width * 0.92 / Math.max(1, mr.height * 1.12));
      geo.go = { x: (left + cr.left) / 2 - (mr.left + mr.width / 2),
                 y: (pr.top + pr.height / 2) - (mr.top + mr.height / 2),
                 k: Math.max(1, k),
                 cx: (pr.left + pr.width / 2) - (mr.left + mr.width / 2) };
      geo.go.k2 = Math.max(geo.go.k, k2);
    }

    function decide() {
      var on = fits.matches && !printing;
      if (on) {
        dx.classList.add("is-live");
        clear();
        // the whole finished stage must fit the pinned screen, with room
        var inner = stage.firstElementChild;
        var cs = window.getComputedStyle(stage);
        var room = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        on = inner ? inner.offsetHeight + 16 <= room : false;
      }
      if (!on) { dx.classList.remove("is-live"); clear(); geo = null; }
      live = on;
      var v = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
      navH = v > 0 ? v : 68;
      if (live) { measure(); write(read()); }
    }

    // progress in screens of runway, 0 when the pin takes hold, RUN when it
    // lets go
    function read() {
      if (!live || !geo) return;
      return { s: RUN * clamp01((navH - dx.getBoundingClientRect().top) / geo.run) };
    }

    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
    var inOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var f3 = function (v) { return (Math.round(v * 1000) / 1000).toString(); };
    var px = function (v) { return (Math.round(v * 10) / 10) + "px"; };

    function write(m) {
      if (!m || !geo) return;
      var s = m.s, g = geo;

      // the question and the lines fade out while the page is still white
      var tOut = inOut(span(s, 1.3, 1.55));
      put(title, "opacity", f3(1 - tOut));
      put(title, "transform", tOut <= 0 ? "none" : "translateY(" + px(-20 * tOut) + ")");
      // then the paper gives way to the band's ink, fast and steep (a
      // smoothstep of a smoothstep), so the grey in between barely shows;
      // the chips change skin with it, where they stand
      put(paper, "opacity", f3(1 - ease(ease(span(s, 1.58, 1.88)))));
      put(dmd, "--dmd-m", f3(ease(span(s, 1.68, 1.9))));
      // the answer's band stays below the pin until the page turns, so the
      // chapters rail reads the demands until then
      put(sol, "transform", s < 1.58 ? "translateY(100%)" : "none");

      var handed = s >= 2.47;                         // the tags have taken over
      chips.forEach(function (c, k) {
        var a = easeOut(span(s, 0.1 + 0.18 * k, 0.44 + 0.18 * k));
        var f = inOut(span(s, 1.9 + 0.025 * k, 2.35 + 0.025 * k));
        var s0 = g.from[k], s1 = g.to[k];
        var sc = 1 + (s1.w / s0.w - 1) * f;
        var x = (s1.x - s0.x) * f, y = (s1.y - s0.y) * f + (1 - a) * 22;
        put(c, "transform", "translate(" + px(x) + "," + px(y) + ") scale(" + f3(sc * (0.9 + 0.1 * a)) + ")");
        put(c, "opacity", f3(handed ? 0 : a));
      });
      // the kicker counts the chips, so it comes in with the first of them
      if (kick) {
        var kv = easeOut(span(s, 0.14, 0.62));
        put(kick, "opacity", f3(kv));
        put(kick, "transform", kv >= 1 ? "none" : "translateY(" + px((1 - kv) * 10) + ")");
      }
      put(grid, "--dx-tag", handed ? "1" : "0");

      // the reactor comes up from the middle of the five
      var r = easeOut(span(s, 2.35, 2.7));
      // and later glides to the room left of the HUD and grows, as the
      // cards, the line and the name make way and How ReLEAF works comes in
      // and at the end the card goes and it comes back to the middle
      var go = inOut(span(s, 3.2, 3.85)), back = inOut(span(s, 6.72, 7.1));
      var gx = (g.go.x + (g.go.cx - g.go.x) * back) * go, gy = g.go.y * go;
      var gk = 1 + (g.go.k + (g.go.k2 - g.go.k) * back - 1) * go;
      var out = easeOut(span(s, 3.15, 3.45)), hin = easeOut(span(s, 3.45, 3.9));
      var hout = ease(span(s, 6.6, 6.95));
      put(model, "opacity", f3(r));
      put(model, "transform", go > 0 ? "translate(" + px(gx) + "," + px(gy) + ") scale(" + f3(gk) + ")"
                                     : r >= 1 ? "none" : "scale(" + f3(0.85 + 0.15 * r) + ")");
      // the field monitor on the machine keeps its own size inside that scale
      put(model, "--rxui-k", f3(1 / Math.max(0.001, gk)));
      if (rx && rx.oversample) rx.oversample(go > 0 ? Math.max(g.go.k, g.go.k2) : 1);
      // then its name, then the line under it, then the cards' words
      var h = easeOut(span(s, 2.62, 2.82)), l = easeOut(span(s, 2.74, 2.94));
      put(head, "opacity", f3(h * (1 - out)));
      put(head, "transform", h >= 1 ? "none" : "translateY(" + px(16 * (1 - h)) + ")");
      put(lede, "opacity", f3(l * (1 - out)));
      put(lede, "transform", l >= 1 ? "none" : "translateY(" + px(12 * (1 - l)) + ")");
      var card = easeOut(span(s, 2.84, 3.06));
      put(grid, "--dx-card", f3(card));
      dx.classList.toggle("is-early", card < 0.6);
      sides.forEach(function (el) { put(el, "opacity", out > 0 ? f3(1 - out) : ""); });
      put(dx, "--dx-how", f3(hin * (1 - hout)));
      dx.classList.toggle("is-how", out > 0.5);

      // the model's own loop is held until it is about to be seen, so the
      // hand-off has the frame to itself
      park(s < 2.15);
    }

    function fail() { live = false; dx.classList.remove("is-live"); clear(); }

    homeFrame.add(read, write, fail);
    window.addEventListener("scroll", homeFrame.request, { passive: true });
    var sized = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(sized);
      sized = window.setTimeout(decide, 120);
    });
    if (fits.addEventListener) fits.addEventListener("change", decide);
    else if (fits.addListener) fits.addListener(decide);
    window.addEventListener("beforeprint", function () { printing = true; decide(); });
    window.addEventListener("afterprint", function () { printing = false; decide(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(decide);
    window.addEventListener("load", decide);
    // whether the stage fits depends on how tall its words set, which
    // changes when Inter arrives after the fallback face; watch the content
    // rather than guess when. The scene does not change the content's own
    // size, so this cannot feed itself.
    if ("ResizeObserver" in window && stage.firstElementChild) {
      var rq = 0;
      new ResizeObserver(function () {
        window.cancelAnimationFrame(rq);
        rq = window.requestAnimationFrame(decide);
      }).observe(stage.firstElementChild);
    }

    /* ---- arriving by a link or by the keyboard ---- */
    // where in the scene a section is "found": the demands once all five
    // chips are in, the answer at its finished frame
    function spot(id) {
      var top = dx.getBoundingClientRect().top + window.scrollY - navH;
      var at = id === "demands" ? 1.25 : id === "how" ? LEAD : 3.12;
      return top + geo.run * at / RUN;
    }
    function go(id, how) {
      if (!live || !geo) return false;
      window.scrollTo({ top: spot(id), left: 0, behavior: how || "auto" });
      return true;
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href*='#']");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var href = a.getAttribute("href"), id = href.slice(href.indexOf("#") + 1);
      if (id !== "demands" && id !== "solution" && id !== "how") return;
      if (href.charAt(0) !== "#" && a.pathname !== location.pathname) return;
      if (go(id)) {
        e.preventDefault();
        if (history.pushState) history.pushState(null, "", "#" + id);
      }
    });
    function fromHash(how) {
      var id = location.hash.slice(1);
      if (id === "demands" || id === "solution" || id === "how") go(id, how);
    }
    window.addEventListener("hashchange", function () { fromHash("instant"); });
    // keyboard focus on a card, while the cards are not in yet: to the
    // finished frame at once, so the reader finds it built
    sol.addEventListener("focusin", function (e) {
      if (!live || !dx.classList.contains("is-early")) return;
      var t = e.target;
      if (t && t.hasAttribute && t.hasAttribute("data-comp")) go("solution", "instant");
    });

    decide();
    if (live) { if (armed) dmd.classList.add("in"); fromHash("instant"); }
  })();

  /* ══════════════════════════════════════════════════ 8  THE THREAT MAP ══ */
  /* 7 Oct (owner). Where the whole of 01 fits one screen, .is-scrolly
     (home-threat.css) turns .th-run into a runway and holds .th-pin on the
     screen, and the scroll walks the map's three frames in order:
     Volatility, Farmland (small-scale farms), Convergence. Each frame is
     shown by ticking its radio, so the words, the map and the key change
     through the same :has() rules the switch uses.

     The switch is hidden while the sequence runs. Reaching the last frame
     adds .is-explore, which brings it in for good (remembered in
     localStorage, so a later visit has it from the start). From then on the
     scroll still moves the frames as it crosses each third of the runway,
     and a pick on the switch holds until the scroll crosses the next one.

     THE RESTING STATE IS THE FINISHED STATE: no runway and the switch in
     view without script, with reduced motion, while printing, or where the
     frame does not fit the screen (decide()). */

  (function threat() {
    var th = document.getElementById("threat");
    if (!th) return;
    var run = th.querySelector(".th-run");
    var pin = th.querySelector(".th-pin");
    var grid = pin && pin.querySelector(".th__grid");
    var plate = th.querySelector(".th-map__plate");
    var radios = [].slice.call(th.querySelectorAll(".th-views input"));
    var bars = [].slice.call(th.querySelectorAll(".th-prog i"));
    var ORDER = ["vol", "small", "conv"];
    if (!run || !pin || !grid || !plate || radios.length !== ORDER.length || !window.matchMedia) return;
    // with reduced motion the section is the ordinary one: no pinned screen,
    // and the switch in view from the start, as with scripting off
    if (reduced) return;
    var KEY = "releaf-threat-seen";
    try { if (window.localStorage.getItem(KEY) === "1") th.classList.add("is-explore"); } catch (e) { /* private window */ }

    var live = false, step = -1, navH = 68, printing = false;

    function show(k) {
      radios.forEach(function (r) { r.checked = r.value === ORDER[k]; });
      bars.forEach(function (b, i) { b.classList.toggle("is-on", i <= k); });
      if (k === ORDER.length - 1 && !th.classList.contains("is-explore")) {
        th.classList.add("is-explore");
        try { window.localStorage.setItem(KEY, "1"); } catch (e) { /* private window */ }
      }
    }

    function decide() {
      var on = !printing;
      if (on) {
        th.classList.add("is-scrolly");
        // the frame has to fit the held screen, and the map stay readable
        on = grid.offsetHeight <= pin.clientHeight + 1 && plate.getBoundingClientRect().height >= 220;
      }
      if (!on) th.classList.remove("is-scrolly");
      live = on;
      var v = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
      navH = v > 0 ? v : 68;
      if (live) write(read());
    }

    // progress through the runway, 0 when the pin takes hold, 1 when it lets go
    function read() {
      if (!live) return;
      var r = run.getBoundingClientRect();
      return clamp01((navH - r.top) / Math.max(1, r.height - pin.offsetHeight));
    }
    function write(p) {
      if (p === undefined) return;
      var k = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
      if (k === step) return;
      step = k;
      show(k);
    }
    function fail() { live = false; th.classList.remove("is-scrolly"); }

    homeFrame.add(read, write, fail);
    window.addEventListener("scroll", homeFrame.request, { passive: true });
    var sized = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(sized);
      sized = window.setTimeout(decide, 120);
    });
    window.addEventListener("beforeprint", function () { printing = true; decide(); });
    window.addEventListener("afterprint", function () { printing = false; decide(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(decide);
    decide();
  })();

})();
