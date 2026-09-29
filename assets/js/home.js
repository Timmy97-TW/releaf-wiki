/* =============================================================================
   ReLeaf: homepage behaviour
   -----------------------------------------------------------------------------
   Independent pieces. Each one checks for the element it drives and stops
   if it is missing, so removing a section from index.html never breaks the
   rest of the file.

     0  spotlight   the pointer opens a light in the hero's photograph onto the reactor
     1  reveal      one-shot fade-and-rise for .rise
     2  reactor     wakes the WebGL reactor; pins its section for a short entrance
     3  parts       point at a demand card, its parts light in the WebGL reactor
     5  ihp tabs    the five demands and the objection as tabs over one panel
     6  chapters    marks the chapter the reader is in on the right-hand rail
     7  merge       the recap's five demands merge and open onto the answer
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
  /* Two jobs. The first always runs: wake the reactor (home-reactor.js loads
     nothing until start() is called) once #rx is within 1.6 screens, so the
     model is usually ready before the reader arrives. The second runs only
     with motion allowed and only where the whole stage fits one screen with
     room to spare: it pins the stage for a short runway (.is-live adds it)
     while the reactor settles and the five demand cards come in, the side
     ones from their own sides and Farm-owned from below.

     IT PLAYS ONCE. When the last card is in, or when the reader arrives by a
     jump (a link to #solution, the chapters rail, a reload in the middle of
     the page, a drag of the scrollbar, keyboard focus on a demand card),
     the entrance is over: the properties
     are removed and the section stays built. Scrolling back up does not take
     it apart again, and nobody lands on a stage with its cards missing.

     THE RESTING STATE IS THE FINISHED LAYOUT. Every property written here
     falls back to its final value in home-reactor.css, and they are removed
     again whenever the pinned layout stops applying (a resize to a narrow or
     short window). read() only measures; it never throws. */

  (function reactor() {
    var sec = document.getElementById("solution");
    if (!sec) return;
    var host = document.getElementById("rx");
    var stage = sec.querySelector(".rxs__stage");
    // the heading now sits inside the stage, so nothing scrolls away before
    // the stage pins: the lead is zero
    var head = null;
    var rx = window.__homeRx;

    // --- wake: reduced motion and narrow screens need it too
    if (rx && !rx.failed && host) {
      var woken = false;
      var wake = function () { if (!woken) { woken = true; rx.start(); } };
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) { io.disconnect(); wake(); return; }
          }
        }, { rootMargin: "0px 0px 160% 0px" });
        io.observe(host);
      } else {
        wake();
      }
    }

    // --- the pinned entrance
    if (reduced || !stage || !window.matchMedia) return;
    // the same test as the pinned rules in home-reactor.css
    var fits = window.matchMedia("(min-width: 980px) and (min-height: 700px)");
    var NAMES = ["--rxs-s", "--rxs-c1", "--rxs-c2", "--rxs-c3", "--rxs-c4", "--rxs-c5"];
    // the five cards' wrappers, in the order of --rxs-c1 to --rxs-c5 (left
    // pair, right pair, Farm-owned). A card that is not yet most of the way in
    // is marked .is-out, and home-reactor.css takes the pointer off it: an
    // invisible card must not light the model under a resting cursor, or
    // take a click that ends the entrance with every card popping in.
    var wraps = [].slice.call(sec.querySelectorAll(".rxs__side--l > li, .rxs__side--r > li, .rxs__wide"));
    // the stage has to fit with this much to spare, or it stays an ordinary
    // band: a stage that only just fits reads as crammed, not as a moment
    var SPARE = 24;
    var live = false, done = false, navH = 68, pad = 0, written = {}, lastT = null;

    function set(name, v) {
      var s = String(Math.round(v * 1000) / 1000);
      if (written[name] === s) return;
      written[name] = s;
      sec.style.setProperty(name, s);
    }
    function clear() {
      NAMES.forEach(function (n) { sec.style.removeProperty(n); });
      wraps.forEach(function (w) { w.classList.remove("is-out"); });
      written = {};
    }
    // the entrance is over: everything goes to its resting (final) value
    function finish() {
      if (done) return;
      done = true;
      clear();
    }

    // the nav height the stage pins under
    function metrics() {
      var v = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
      navH = v > 0 ? v : 68;
    }
    // how far below the section's top the stage starts: the opening (kicker,
    // heading, lede) sits above it and scrolls away before the stage pins.
    // Read every frame, because the heading's height changes when the web
    // font arrives.
    function lead() {
      return head ? head.offsetTop + head.offsetHeight : 0;
    }

    function setLive(on) {
      if (on === live) return;
      live = on;
      sec.classList.toggle("is-live", on);
      if (!on) clear();
      metrics();
      lastT = null;
      homeFrame.request();
    }

    // Pin only if the whole stage fits one screen under the nav, with SPARE
    // to spare. The media query is the cheap first answer; the real one is to
    // try it and measure, since the cards' height depends on the words in
    // them. Once the entrance has played the pin stays as it is (dropping it
    // would pull the page up by the runway under the reader), unless the
    // window stops matching at all.
    function decide() {
      var on = fits.matches;
      if (on && !(done && live)) {
        sec.classList.add("is-live");
        var inner = stage.firstElementChild;
        var cs = window.getComputedStyle(stage);
        var room = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        on = inner ? inner.offsetHeight + SPARE <= room : false;
        if (!live) sec.classList.remove("is-live");
      }
      setLive(on);
    }

    function measure() {
      if (!live || done) return;
      var r = sec.getBoundingClientRect();
      pad = lead();
      return { top: r.top, h: window.innerHeight, pad: pad,
               runway: Math.max(1, sec.offsetHeight - pad - stage.offsetHeight) };
    }

    // t is how far the section's top has come up from the bottom of the
    // window. The stage's top reaches the bottom of the window at t = pad,
    // pins at t = h − nav + pad and lets go R later.
    function frame(m) {
      if (!live || done) return;
      var t = m.h - m.top, pin = m.h - navH + m.pad, R = m.runway;
      // Arriving already inside the entrance (a reload in the middle of the
      // page, the first frame after a resize), or by a jump of more than
      // three quarters of a screen between two frames, is not someone
      // scrolling through it: land them on the finished section.
      var begun = t > pin - R * 0.14;
      if (begun && (lastT === null || Math.abs(t - lastT) > m.h * 0.75)) { finish(); return; }
      lastT = t;
      // the reactor rises into place while its stage comes up the screen,
      // and is settled a tenth of the way into the pin
      set("--rxs-s", ease(span(t, m.pad + m.h * 0.08, pin + R * 0.1)));
      // the five cards in the demands' own order (left pair, right pair,
      // then Protective under the model), each over 36% of the runway; the
      // last one lands at about 62%, and the rest is a hold
      var last = 0;
      for (var k = 0; k < 5; k++) {
        var a = pin - R * 0.14 + k * R * 0.1;
        last = ease(span(t, a, a + R * 0.36));
        set(NAMES[k + 1], last);
        if (wraps[k]) wraps[k].classList.toggle("is-out", last < 0.6);
      }
      if (last >= 1) finish();
    }

    // a throw in either phase ends the entrance on the finished layout
    homeFrame.add(measure, frame, finish);
    window.addEventListener("scroll", homeFrame.request, { passive: true });

    // arriving by a link: the chapters rail, "Our answer" anywhere, or the
    // address itself. The click lands before the scroll does.
    function isHere(href) { return href && href.slice(href.indexOf("#")) === "#solution"; }
    if (location.hash === "#solution") finish();
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href*='#solution']");
      if (a && isHere(a.getAttribute("href"))) finish();
    });
    window.addEventListener("hashchange", function () { if (location.hash === "#solution") finish(); });
    // Tab onto a card: piece 3 brings the stage to its pinned place, and the
    // reader should find it built there
    sec.addEventListener("focusin", function (e) {
      var t = e.target;
      if (t && t.hasAttribute && t.hasAttribute("data-comp")) finish();
    });

    var sized = 0;
    window.addEventListener("resize", function () {
      metrics();
      homeFrame.request();
      window.clearTimeout(sized);
      sized = window.setTimeout(decide, 150);
    });
    if (fits.addEventListener) fits.addEventListener("change", decide);
    else if (fits.addListener) fits.addListener(decide);
    decide();
    // The check depends on how tall the words set, which changes when Inter
    // arrives after the fallback face; watch the content instead of guessing
    // when that is. Toggling .is-live does not change the content's own size,
    // so this cannot feed itself.
    var inner = stage.firstElementChild;
    if (inner && "ResizeObserver" in window) {
      var queued = 0;
      new ResizeObserver(function () {
        window.cancelAnimationFrame(queued);
        queued = window.requestAnimationFrame(decide);
      }).observe(inner);
    }
    window.addEventListener("load", decide);
    var first = measure();
    if (first) frame(first);
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
    // it. Where the stage pins, its place is right under the nav (the
    // entrance has been finished by piece 2, so every card is in). Where
    // the model sticks on a narrow screen, the card has to come out below
    // it. In an ordinary band, the model and the card both, when they fit.
    // Instant with reduced motion.
    function reveal(card) {
      if (!stage || !box) return;
      var v = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
      var top = v > 0 ? v : 68, vh = window.innerHeight, gap = 12, dy = 0;
      var c = card.getBoundingClientRect();
      if (sec.classList.contains("is-live")) {
        dy = stage.getBoundingClientRect().top - top;
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

  /* ═════════════════════════════════════════════════════════ 7  THE MERGE ══ */
  /* The recap (#demands) closes the problem arc; this turns it into the way
     in to the answer. Where the recap fits the screen, the section pins for
     a runway (.is-live, home-reactor.css) and scroll progress drives, in
     order: the words fade; the five tags gather in a ring at the centre of
     the screen; the ring closes and the tags merge; a dark circle opens from
     where they met until it covers the screen, a thin green edge leading it.
     The reactor section, also dark, follows on.

     THE RESTING STATE IS THE PLAIN RECAP. Nothing happens with reduced
     motion, on screens where the recap does not fit, or if this throws (the
     fail() puts the recap back). A keyboard reader who tabs into a faded
     link is scrolled back to where the recap can be read. */
  (function merge() {
    var sec = document.getElementById("demands");
    if (!sec || reduced || !window.matchMedia) return;
    var stage = sec.querySelector(".dmd__stage");
    var curtain = sec.querySelector(".dmd__curtain");
    var tags = [].slice.call(sec.querySelectorAll(".dmd__tag"));
    if (!stage || !curtain || tags.length !== 5) return;

    var fits = window.matchMedia("(min-width: 1024px) and (min-height: 640px)");
    var live = false, rest = [], navH = 68, headB = 0;
    var headEl = sec.querySelector(".dmd__head");

    function clear() {
      ["--dmd-fade", "--dmd-head"].forEach(function (k) { sec.style.removeProperty(k); });
      ["--r", "--edge", "--oy", "--glow", "--dot", "--line"].forEach(function (k) { curtain.style.removeProperty(k); });
      tags.forEach(function (t) { ["--tx", "--ty", "--ts", "--to"].forEach(function (k) { t.style.removeProperty(k); }); });
      sec.classList.remove("is-merging");
    }
    // where each tag sits at rest, from the stage's centre (transforms off)
    function measureRest() {
      tags.forEach(function (t) { t.style.removeProperty("--tx"); t.style.removeProperty("--ty"); t.style.removeProperty("--ts"); });
      var sr = stage.getBoundingClientRect();
      var cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
      rest = tags.map(function (t) {
        var r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2 - cx, y: r.top + r.height / 2 - cy };
      });
      headB = headEl ? headEl.getBoundingClientRect().bottom - cy : 0;
    }
    function decide() {
      var on = fits.matches;
      if (on) {
        sec.classList.add("is-live");
        var inner = stage.firstElementChild;
        on = inner ? inner.offsetHeight + 24 <= stage.clientHeight : false;
        if (!on) sec.classList.remove("is-live");
      }
      if (!on) { sec.classList.remove("is-live"); clear(); }
      live = on;
      var v = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
      navH = v > 0 ? v : 68;
      if (live) measureRest();
      homeFrame.request();
    }

    function read() {
      if (!live) return;
      var r = sec.getBoundingClientRect();
      var run = sec.offsetHeight - stage.offsetHeight;
      return { p: clamp01((navH - r.top) / Math.max(1, run)), w: stage.clientWidth, h: stage.clientHeight };
    }
    function write(m) {
      var p = m.p;
      var fade = 1 - ease(span(p, 0.08, 0.24));      // the lines under the tags
      var head = 1 - ease(span(p, 0.40, 0.52));      // the heading stays while they gather
      var gather = ease(span(p, 0.14, 0.42));
      var close = ease(span(p, 0.44, 0.6));
      var open = span(p, 0.6, 0.94);
      sec.style.setProperty("--dmd-fade", fade.toFixed(3));
      sec.style.setProperty("--dmd-head", head.toFixed(3));
      sec.classList.toggle("is-merging", fade < 0.6);
      // an ellipse, wider than tall, so the pills do not overlap in the ring
      var ry = Math.min(m.w, m.h) * 0.2, rx = Math.min(m.w * 0.3, ry * 1.9);
      // the ring sits under the heading, which stays up while the tags gather;
      // the tags meet, and the circle opens, at the ring's centre
      var oy = Math.min(m.h / 2 - ry - 28, Math.max(0, headB + ry + 36));
      tags.forEach(function (t, i) {
        var a = -Math.PI / 2 + i * (2 * Math.PI / 5);
        var ring = { x: rx * Math.cos(a), y: oy + ry * Math.sin(a) };
        var s0 = rest[i] || { x: 0, y: 0 };
        var x = s0.x + (ring.x - s0.x) * gather, y = s0.y + (ring.y - s0.y) * gather;
        x = x * (1 - close); y = y + (oy - y) * close;
        t.style.setProperty("--tx", (x - s0.x).toFixed(1) + "px");
        t.style.setProperty("--ty", (y - s0.y).toFixed(1) + "px");
        // they swell a little in the ring, then shrink to nothing as they meet
        t.style.setProperty("--ts", Math.max(0.05, 1 + 0.15 * gather - 0.95 * close).toFixed(3));
        t.style.setProperty("--to", (1 - span(close, 0.55, 1)).toFixed(3));
      });
      // where they met, a small glowing seed; then the dark circle opens from it
      var seed = span(p, 0.56, 0.62);
      var rmax = Math.sqrt(m.w * m.w / 4 + Math.pow(m.h / 2 + Math.abs(oy), 2)) + 24;
      var e = open * open * (3 - 2 * open);
      var r = seed > 0 ? 10 * ease(seed) + (rmax - 10) * e * e : 0;
      curtain.style.setProperty("--r", r.toFixed(1) + "px");
      curtain.style.setProperty("--oy", (oy * (1 - e)).toFixed(1) + "px");
      curtain.style.setProperty("--edge", (seed > 0 ? ease(seed) * (1 - e) : 0).toFixed(3));
      curtain.style.setProperty("--glow", (seed > 0 ? 1 - e : 0).toFixed(3));
      curtain.style.setProperty("--dot", ease(seed).toFixed(3));
      curtain.style.setProperty("--line", ease(span(p, 0.88, 1)).toFixed(3));
    }
    function fail() { live = false; sec.classList.remove("is-live"); clear(); }

    homeFrame.add(read, write, fail);
    window.addEventListener("scroll", homeFrame.request, { passive: true });
    window.addEventListener("resize", function () { decide(); });
    if (fits.addEventListener) fits.addEventListener("change", decide);
    // a keyboard reader who tabs onto a faded link is taken back to where
    // the recap can be read
    sec.addEventListener("focusin", function () {
      if (!live) return;
      var f = parseFloat(sec.style.getPropertyValue("--dmd-fade") || "1");
      if (f < 0.9) window.scrollTo(0, window.scrollY + sec.getBoundingClientRect().top - navH);
    });
    window.addEventListener("beforeprint", function () { sec.classList.remove("is-live"); clear(); });
    window.addEventListener("afterprint", decide);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(decide);
    decide();
  })();

})();
