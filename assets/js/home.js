/* =============================================================================
   ReLeaf: homepage behaviour
   -----------------------------------------------------------------------------
   Independent pieces. Each one checks for the element it drives and stops
   if it is missing, so removing a section from index.html never breaks the
   rest of the file.

     0  spotlight   the pointer opens a light in the hero's photograph onto the reactor
     1  reveal      one-shot fade-and-rise for .rise
     2  reactor     wakes the WebGL reactor before it is needed
     3  parts       point at a demand card, its parts light in the WebGL reactor
     5  ihp tabs    the five demands and the objection as tabs over one panel
     6  chapters    marks the chapter the reader is in on the right-hand rail
     7  scene       the five demands become the labels round the reactor
     (4 doors was retired on 28 September 2026 with the section it drove;
     the numbers of the others were kept.)

   Elsewhere: 03's entrance and the source list (home-problem.js), the model
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

  /* ═══════════════════════════════════════════════════════ 0  SPOTLIGHT ══ */
  /* The hero is two pictures stacked, and the photograph on top has a mask
     whose light is centred on --spot-x / --spot-y with core --spot-r
     (home.css). This moves the centre, says when the light is on, and sets
     --spot-near: 1 while the pointer is on the machine, falling smoothly to 0
     one and a half lights away from it, which is how far the light opens
     onto the machine rather than only dimming the photograph. The machine's
     place comes from the same custom properties home.css draws it with. A
     mouse lights it by hovering and puts it out by leaving; a finger lights it
     where it lands and leaves it there, since a touch screen has no hover and
     a drag across the hero is the reader scrolling. */

  (function spotlight() {
    var frames = document.getElementById("hero-spot");
    var hero = frames && frames.closest(".hero");
    if (!hero) return;
    var art = frames.querySelector(".hero__frame--reactor");

    var hint = hero.querySelector(".hero__hint");
    if (hint && !window.matchMedia("(hover: hover)").matches) {
      hint.textContent = "Tap the field to find the reactor";
    }
    hero.classList.add("has-spot");

    /* The machine's box and the light's reach, in the hero's pixels. Read
       once, and again after a resize (the phone file has its own numbers). */
    var box = null;
    function measure() {
      var cs = getComputedStyle(frames);
      var n = function (k) { return parseFloat(cs.getPropertyValue(k)); };
      var f = frames.getBoundingClientRect(), b = art.getBoundingClientRect();
      var ar = n("--r-ar"), w = Math.min(b.width, ar * b.height), h = Math.min(b.height, b.width / ar);
      var m = {
        x: b.left - f.left + n("--r-ox") * (b.width - w) + n("--r-cx") * w,
        y: b.top - f.top + n("--r-oy") * (b.height - h) + n("--r-cy") * h,
        hw: n("--r-hw") * w, hh: n("--r-hh") * h,
        reach: 1.5 * (n("--spot-size") || 0.096 * f.width)
      };
      return isFinite(m.x + m.y + m.hw + m.hh + m.reach) && m.reach > 0 ? m : null;
    }
    window.addEventListener("resize", function () { box = null; });

    function near() {
      if (!art) return 1;
      if (!box) box = measure();
      if (!box) return 1;
      var dx = Math.max(0, Math.abs(x - box.x) - box.hw);
      var dy = Math.max(0, Math.abs(y - box.y) - box.hh);
      var t = Math.min(1, Math.sqrt(dx * dx + dy * dy) / box.reach);
      return 1 - t * t * (3 - 2 * t);
    }

    var x = 0, y = 0, queued = false;
    // The cue goes for good once the light has actually opened on the
    // machine (half way or more), not at the first move anywhere in the
    // photograph: a reader who crosses Chen's face has not found anything.
    function draw() {
      queued = false;
      var n = near();
      frames.style.setProperty("--spot-x", x + "px");
      frames.style.setProperty("--spot-y", y + "px");
      frames.style.setProperty("--spot-near", n.toFixed(3));
      if (n >= 0.5) hero.classList.add("is-found");
    }
    function aim(e) {
      var r = frames.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!queued) { queued = true; requestAnimationFrame(draw); }
    }
    function light(e) {
      aim(e);
      frames.classList.add("is-lit");
    }

    hero.addEventListener("pointermove", function (e) {
      if (e.pointerType === "mouse" || e.pointerType === "pen") light(e);
    });
    hero.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" || e.pointerType === "pen") frames.classList.remove("is-lit");
    });
    // A finger lights the field only with a tap. pointerdown comes before
    // the browser knows whether the touch is a scroll, so the light waits for
    // the pointerup of a touch that did not travel; a scroll ends in
    // pointercancel instead, and the reader's first flick reveals nothing.
    var tap = null;
    hero.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    hero.addEventListener("pointercancel", function (e) {
      if (tap && tap.id === e.pointerId) tap = null;
    });
    hero.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "touch" || !tap || tap.id !== e.pointerId) return;
      var moved = Math.abs(e.clientX - tap.x) + Math.abs(e.clientY - tap.y);
      tap = null;
      if (moved < 10) light(e);
    });
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
     called, and this calls it once #rx is within 1.6 screens. Inside the
     scene (piece 7) #rx sits at the top of the pinned screen, so it wakes
     as the demands come up, several screens before the model pops in.
     Reduced motion and narrow screens need it too. */

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

  /* ═══════════════════════════════════════════════════════ 6  CHAPTERS ══ */
  /* Marks which chapter the reader is in, and keeps the rail readable over
     whatever is behind it. Both jobs are read-only: the links are in the
     markup and work without this.

     WHICH CHAPTER. The one whose section has crossed a line a third of the way
     down the window, which is where a reader is actually looking, rather than
     the topmost visible one, which would hand the mark on too early (the
     reactor section, pinned, is nearly two screens tall).

     LIGHT OR DARK. The page changes ground four times and the rail sits over
     all of it, so rather than hard-coding which sections are ink, it asks what
     is actually painted behind the rail: the first element under that point
     with an opaque background decides. Add a dark section later and this keeps
     working with no edit here. */

  (function chapters() {
    var rail = document.getElementById("chapters");
    var hero = document.querySelector(".hero");
    if (!rail) return;

    var links = [].slice.call(rail.querySelectorAll("a"));
    var marks = links.map(function (a) {
      return document.querySelector(a.getAttribute("href"));
    });

    var current = null, ink = null, shown = null, still = 0;

    function luminance(bg) {
      var m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/.exec(bg || "");
      if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;   /* see-through: keep looking */
      return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
    }

    function onInk(box) {
      if (!document.elementsFromPoint) return false;
      var stack = document.elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      for (var i = 0; i < stack.length; i++) {
        if (rail.contains(stack[i])) continue;
        var l = luminance(window.getComputedStyle(stack[i]).backgroundColor);
        if (l !== null) return l < 0.5;
      }
      return false;
    }

    // Read phase: which chapter, and what is painted behind the rail. Below
    // 1180 px the rail is display: none and has no ground to read, so the hit
    // test is skipped there and on-ink keeps its last value.
    function measure() {
      var y = window.scrollY;
      var m = { show: !hero || y > hero.offsetHeight * 0.6 };
      if (!m.show) return m;

      var line = y + window.innerHeight * 0.34;
      var at = 0;
      marks.forEach(function (el, i) {
        if (el && el.getBoundingClientRect().top + y <= line) at = i;
      });
      m.at = at;
      var box = rail.getBoundingClientRect();
      m.dark = box.width ? onInk(box) : ink;
      return m;
    }

    // Write phase: only what changed.
    function update(m) {
      if (m.show !== shown) { shown = m.show; rail.classList.toggle("is-shown", m.show); }
      if (!m.show) return;

      if (m.at !== current) {
        current = m.at;
        links.forEach(function (a, i) {
          if (i === m.at) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      }

      if (m.dark !== ink) { ink = m.dark; rail.classList.toggle("on-ink", m.dark); }
    }

    /* the current chapter names itself while the page is moving and the name
       fades once the reader settles, so it never sits on the figure beside it */
    function moving() {
      if (!rail.classList.contains("is-moving")) rail.classList.add("is-moving");
      window.clearTimeout(still);
      still = window.setTimeout(function () {
        rail.classList.remove("is-moving");
      }, 1100);
      homeFrame.request();
    }

    homeFrame.add(measure, update);
    window.addEventListener("scroll", moving, { passive: true });
    window.addEventListener("resize", homeFrame.request);
    update(measure());
  })();

  /* ═══════════════════════════════════════════ 7  DEMANDS INTO THE ANSWER ══ */
  /* #dx wraps the five demands (#demands) and the answer (#solution). Where
     the answer's stage fits one screen, this adds .is-live (home-demands.css):
     .dx__pin holds the screen for a runway, and the scroll, read as p from 0
     to 1, scrubs one continuous scene. Everything is transform and opacity,
     written once a frame through window.__homeFrame.

       .00 to .27  "An answer has to meet five demands." alone, then the five
                   chips arrive one by one under it
       .30 to .47  the heading goes, ink opens over the paper from where the
                   reactor will stand, and each chip glides onto the tag of
                   its card round the reactor, changing to the tag's outline
                   on the way
       .47 to .51  a green point opens where the reactor will stand
       .53 to .63  the view dives into it: the five fly out, green fills the
                   screen, and it says what the green light does
       .68 to .77  and back out to the five
       .79 to .88  the reactor pops out of the point, lit by its own green
                   light at first
       .84 to .97  "Make it where it grows." and the lede settle; the cards
                   open round their tags

     The chips land exactly on the tags and are drawn like them (they share
     the proportions, home-demands.css), so at .78 the chips hand over to the
     real tags without a visible step.

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
    var ink = dx.querySelector(".dx__ink");
    var glow = dx.querySelector(".dx__glow");
    var say = dx.querySelector(".dx__say");
    var row = dmd.querySelector(".dmd__chips");
    var title = dmd.querySelector(".dmd__title");
    var chips = [].slice.call(dmd.querySelectorAll(".dmd__chip"));
    var stage = sol.querySelector(".rxs__stage");
    var head = sol.querySelector(".rxs__head");
    var lede = sol.querySelector(".rxs__lede");
    var model = document.getElementById("rx");
    var grid = document.getElementById("partlist");
    // the card tags, in the chips' order: Protective (under the model), On
    // demand and Automatic (left), Cell-free and Monitored (right)
    var tags = [".rxs__wide", ".rxs__side--l > li:nth-child(1)", ".rxs__side--l > li:nth-child(2)",
                ".rxs__side--r > li:nth-child(1)", ".rxs__side--r > li:nth-child(2)"].map(function (q) {
      var el = sol.querySelector(q);
      return el ? el.querySelector(".rxs-card__tag") : null;
    });
    if (!pin || !runwayEl || !paper || !ink || !glow || !say || !row || !title || chips.length !== 5 ||
        tags.indexOf(null) !== -1 || !stage || !head || !lede || !model || !grid) return;
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
    var fits = window.matchMedia("(min-width: 980px) and (min-height: 640px)");
    var live = false, geo = null, navH = 68, lit = false, parked = null;
    var moved = [title, head, lede, model, sol, glow, say, paper, ink].concat(chips);
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
    function clear() {
      moved.forEach(function (el) {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
      });
      [glow, ink].forEach(function (el) { el.style.removeProperty("left"); el.style.removeProperty("top"); });
      dmd.style.removeProperty("--dmd-m");
      grid.style.removeProperty("--dx-card");
      grid.style.removeProperty("--dx-tag");
      dx.classList.remove("is-early");
      cache = new Map();
      if (lit && rx && rx.highlight) { rx.highlight(null); lit = false; }
      park(false);
    }
    function park(on) {
      if (parked === on || !rx || !rx.park) return;
      parked = on;
      rx.park(on);
    }

    // Where everything sits in the finished layout, in the pin's pixels,
    // with every transform off. Runs when the scene starts and after any
    // change of size or type.
    function measure() {
      clear();
      var pr = pin.getBoundingClientRect();
      var box = function (el) {
        var r = el.getBoundingClientRect();
        return { x: r.left - pr.left + r.width / 2, y: r.top - pr.top + r.height / 2, w: r.width, h: r.height };
      };
      var m = box(model);
      geo = {
        w: pr.width, h: pr.height,
        run: Math.max(1, runwayEl.offsetHeight),
        from: chips.map(box),
        to: tags.map(box),
        dot: { x: m.x, y: m.y }
      };
      // the point's disc is 200px across: at rest a dot of 14px, at full
      // dive large enough that its solid core covers the far corner
      var far = Math.max(Math.hypot(m.x, m.y), Math.hypot(geo.w - m.x, m.y),
                         Math.hypot(m.x, geo.h - m.y), Math.hypot(geo.w - m.x, geo.h - m.y));
      geo.s0 = 14 / 200;
      geo.sMax = (far + 40) / (200 * 0.58 / 2) ;
      geo.inkMax = (far + 24) / 100;
      [glow, ink].forEach(function (el) { el.style.left = m.x + "px"; el.style.top = m.y + "px"; });
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

    function read() {
      if (!live || !geo) return;
      return { p: clamp01((navH - dx.getBoundingClientRect().top) / geo.run) };
    }

    var easeIn = function (t) { return t * t * t; };
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
    var inOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    // a pop that goes a little past and settles
    var back = function (t) { var c = 1.4; t = t - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
    var f3 = function (v) { return (Math.round(v * 1000) / 1000).toString(); };
    var px = function (v) { return (Math.round(v * 10) / 10) + "px"; };

    function write(m) {
      if (!m || !geo) return;
      var p = m.p, g = geo;

      // the ink opens from where the reactor will stand and covers the
      // paper; once it has, both step aside for the band's own ink
      var inked = span(p, 0.345, 0.45), covered = inked >= 1;
      put(ink, "transform", "scale(" + f3(g.inkMax * inOut(inked)) + ")");
      put(ink, "opacity", covered ? "0" : "1");
      put(paper, "opacity", covered ? "0" : "1");
      // the heading, and the chips' change of skin
      var tOut = inOut(span(p, 0.3, 0.36));
      put(title, "opacity", f3(1 - tOut));
      put(title, "transform", "translateY(" + px(-48 * tOut) + ") scale(" + f3(1 - 0.05 * tOut) + ")");
      put(dmd, "--dmd-m", f3(inOut(span(p, 0.37, 0.46))));
      // the answer's band stays below the pin until the page turns, so the
      // chapters rail reads the demands until then
      put(sol, "transform", p < 0.33 ? "translateY(100%)" : "none");

      // the dive: z runs 0 to 1 into the point and back to 0
      var z = inOut(span(p, 0.53, 0.63)) * (1 - inOut(span(p, 0.68, 0.77)));
      // one camera for the point and the five: as the point grows by cam,
      // the five move away from it by cam, so they leave the screen early
      // and the point goes on growing until it fills it
      var cam = Math.pow(g.sMax / g.s0, z);
      var handed = p >= 0.78;                         // the tags have taken over

      chips.forEach(function (c, k) {
        var a = easeOut(span(p, 0.03 + 0.042 * k, 0.11 + 0.042 * k));
        var f = inOut(span(p, 0.31 + 0.014 * k, 0.45 + 0.014 * k));
        var s0 = g.from[k], s1 = g.to[k];
        var sc = s1.w / s0.w;
        var x = s0.x + (s1.x - s0.x) * f, y = s0.y + (s1.y - s0.y) * f;
        var s = 1 + (sc - 1) * f;
        // the camera: away from the point, and a little larger
        x = g.dot.x + (x - g.dot.x) * cam;
        y = g.dot.y + (y - g.dot.y) * cam;
        s = s * Math.pow(cam, 0.5);
        var rise = (1 - a) * 22;
        put(c, "transform", "translate(" + px(x - s0.x) + "," + px(y - s0.y + rise) + ") scale(" + f3(s * (0.9 + 0.1 * a)) + ")");
        put(c, "opacity", f3(handed ? 0 : a * (1 - span(cam, 1.5, 3))));
      });
      put(grid, "--dx-tag", handed ? "1" : "0");

      // the green point: it opens, dives to fill the screen, comes back,
      // and swells and fades as the reactor comes out of it
      var dot = easeOut(span(p, 0.47, 0.51));
      var pop = span(p, 0.79, 0.88);
      var gs = g.s0 * cam * (0.2 + 0.8 * dot) * (1 + 5 * easeOut(pop));
      put(glow, "transform", "scale(" + f3(gs) + ")");
      put(glow, "opacity", f3(dot * (1 - easeOut(span(pop, 0, 0.55)))));
      var sayIn = span(z, 0.82, 1);
      put(say, "opacity", f3(inOut(sayIn)));
      put(say, "transform", "translate(-50%,-50%) scale(" + f3(0.94 + 0.06 * easeOut(sayIn)) + ")");

      // the reactor pops out of the point
      put(model, "opacity", f3(easeOut(span(pop, 0, 0.45))));
      put(model, "transform", pop >= 1 ? "none" : "scale(" + f3(0.12 + 0.88 * back(pop)) + ")");
      // the band's words settle, and the cards open round their tags
      var h = easeOut(span(p, 0.84, 0.91)), l = easeOut(span(p, 0.86, 0.93));
      put(head, "opacity", f3(h));
      put(head, "transform", h >= 1 ? "none" : "translateY(" + px(28 * (1 - h)) + ")");
      put(lede, "opacity", f3(l));
      put(lede, "transform", l >= 1 ? "none" : "translateY(" + px(20 * (1 - l)) + ")");
      var card = easeOut(span(p, 0.9, 0.97));
      put(grid, "--dx-card", f3(card));
      dx.classList.toggle("is-early", card < 0.6);

      // the model's own loop is held until it is about to be seen, and it
      // comes up lit by its green light alone, then whole
      park(p < 0.74);
      var glowing = p >= 0.77 && p < 0.9;
      if (glowing !== lit && rx && rx.highlight) { lit = glowing; rx.highlight(glowing ? "light" : null); }
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
    var printing = false;
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
      return top + geo.run * (id === "demands" ? 0.28 : 1);
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
      if (id !== "demands" && id !== "solution") return;
      if (href.charAt(0) !== "#" && a.pathname !== location.pathname) return;
      if (go(id)) {
        e.preventDefault();
        if (history.pushState) history.pushState(null, "", "#" + id);
      }
    });
    function fromHash(how) {
      var id = location.hash.slice(1);
      if (id === "demands" || id === "solution") go(id, how);
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
    if (live) { armed && dmd.classList.add("in"); fromHash("instant"); }
  })();

})();
