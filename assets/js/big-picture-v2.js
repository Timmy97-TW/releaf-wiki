/* =============================================================================
   ReLeaf: the big picture, V2
   -----------------------------------------------------------------------------
   Three jobs, and no fourth.

     1  reveal      the one-shot entrance, matching .rise elsewhere on the page
     2  emphasis    pointing at something holds the run it belongs to
     3  the map     the legend drives the layers; the dial draws a share

   NOTHING OPENS. There is no panel to build, no state to remember and no route
   to change. Every word on this page is in the markup before this file runs, so
   the page is complete with scripting off. If a future edit starts storing
   content in here, the section has stopped doing its job.

   ON FLICKER. An earlier build wired pointerenter and pointerleave to every
   tile. Crossing from one tile to its neighbour fired leave-then-enter, and the
   frame in between had everything un-held, so a slow drag across a row strobed.
   This version listens once, on the container, using pointerover, which bubbles:
   moving between two tiles is a single event and the held set is swapped in one
   pass with no blank frame between. Leaving is handled by pointerleave on the
   container, which does not fire while you are still inside it.

   THE HOLDING RULES, IN FULL

     a step       holds itself and the work that feeds it
     a tile       holds itself, the step it feeds, every step after that one and
                  the segments between them. That is the answer to the only
                  question worth asking of a figure like this: how does my work
                  reach a farm. It also MARKS, in amber, the pieces it talks to
                  elsewhere, so the web of who-talks-to-whom shows without
                  permanent lines turning the trunk into a hairball. Cross-links
                  live in data-with.
     a legend row holds its layer on the map, with the small parcels left in

   Segments carry data-flow rather than data-lit, because a segment belongs to
   the gap after a step rather than to the step itself.
   ========================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------- 3a  map --- */

  (function () {
    var key   = document.getElementById("key");
    var atlas = document.getElementById("atlas");
    if (!key || !atlas) return;

    function hold(row) {
      [].forEach.call(key.querySelectorAll(".key__row"), function (r) {
        r.removeAttribute("data-lit");
      });
      if (row) {
        row.setAttribute("data-lit", "");
        key.setAttribute("data-focus", "1");
        atlas.setAttribute("data-hold", row.getAttribute("data-hold"));
      } else {
        key.removeAttribute("data-focus");
        atlas.removeAttribute("data-hold");
      }
    }

    key.addEventListener("pointerover", function (e) {
      hold(e.target.closest ? e.target.closest(".key__row") : null);
    });
    key.addEventListener("pointerleave", function () { hold(null); });
    key.addEventListener("focusin",  function (e) {
      hold(e.target.closest ? e.target.closest(".key__row") : null);
    });
    key.addEventListener("focusout", function (e) {
      if (!key.contains(e.relatedTarget)) hold(null);
    });
  })();

  /* ------------------------------------------------------------ 3b  dial --- */

  (function () {
    var input = document.getElementById("share");
    var rule  = document.getElementById("dial-rule");
    var val   = document.getElementById("dial-val");
    var read  = document.getElementById("dial-read");
    if (!input || !rule) return;

    var ticks = [], i;
    for (i = 0; i < 100; i++) ticks.push(document.createElement("i"));
    ticks.forEach(function (t) { rule.appendChild(t); });

    /* The map answers the dial, and it answers it in the order somebody would
       actually deploy: hardest ground first. Each band holds a known share of
       the small-farm area on our own layer, so the dial walks down the index
       and the readout names how far it got. The shares are measured, not
       assumed; band_assign.py in the repo is what measured them. */
    var atlas = document.getElementById("atlas");

    /* small-farm area per volatility band, worst first, as a share of all
       small-farm area on the map. Measured off the layer itself. */
    var BANDS = [
      { id: 5, label: "0.82 to 0.93", share: 0.004 },
      { id: 4, label: "0.71 to 0.82", share: 0.145 },
      { id: 3, label: "0.60 to 0.71", share: 0.240 },
      { id: 2, label: "0.49 to 0.60", share: 0.504 },
      { id: 1, label: "0.38 to 0.49", share: 0.107 }
    ];

    function paint() {
      var n = Number(input.value), k;
      for (k = 0; k < 100; k++) {
        if (k < n) ticks[k].setAttribute("data-on", "");
        else ticks[k].removeAttribute("data-on");
      }
      if (val) val.innerHTML = n + "<i>%</i>";

      var left = n / 100, done = [], edge = null;
      BANDS.forEach(function (b) {
        var fill = Math.max(0, Math.min(1, left / b.share));
        if (atlas) atlas.style.setProperty("--b" + b.id, fill.toFixed(3));
        if (fill >= 1) done.push(b);
        else if (fill > 0 && !edge) edge = b;
        left -= b.share;
      });

      if (!read) return;
      if (n === 0) {
        read.textContent = "None yet. Move it and the map fills from the hardest ground down.";
      } else if (n >= 100) {
        read.textContent = "Every small farm on the island, down to the steadiest ground in the north and east.";
      } else if (!done.length) {
        read.textContent = "Still inside the hardest band, " + edge.label + ", which is a sliver of ground in the centre west.";
      } else {
        var last = done[done.length - 1];
        read.textContent = "Every small farm on ground that swings " + last.label.slice(0, 4) +
          " or harder" + (edge ? ", and part of " + edge.label + " below it." : ".");
      }
    }
    input.addEventListener("input", paint);
    paint();
  })();

  /* --------------------------------------------------------------- spine --- */

  var spine = document.getElementById("spine");
  if (!spine) return;

  var nodes = [].slice.call(spine.querySelectorAll(".node"));
  var links = [].slice.call(spine.querySelectorAll(".link"));
  var tasks = [].slice.call(spine.querySelectorAll(".task"));

  /* The trajectory in the tile for Docking. Forty-six frames of our own 30 ns
     run live in data attributes on the SVG, so with scripting off the drawing is
     a still frame and nothing on this page moves on its own. It plays only while
     its tile is held, which folds it into the highlight primitive rather than
     adding a third one that never stops. */
  var mdSvg   = document.querySelector(".task--md .mdanim");
  var mdOwner = document.getElementById("t-md");
  var mdOn    = false;
  var mdFrames, mdChain, mdTip, mdX, mdY, mdRaf = 0, mdT0 = 0, mdAt = -1;

  if (mdSvg && !reduced) {
    mdFrames = (mdSvg.getAttribute("data-frames") || "").split(";");
    mdX      = (mdSvg.getAttribute("data-tipx")   || "").split(";");
    mdY      = (mdSvg.getAttribute("data-tipy")   || "").split(";");
    mdChain  = mdSvg.querySelector(".md-chain");
    mdTip    = mdSvg.querySelector(".md-tip");
    if (mdFrames.length < 2 || !mdChain) mdSvg = null;
  }

  var MD_MS = 74;                        /* per frame; 46 frames is a 3.4 s loop */

  function mdStep(ts) {
    if (!mdT0) mdT0 = ts;
    var i = Math.floor((ts - mdT0) / MD_MS) % mdFrames.length;
    if (i !== mdAt) {
      mdAt = i;
      mdChain.setAttribute("d", mdFrames[i]);
      if (mdTip) { mdTip.setAttribute("cx", mdX[i]); mdTip.setAttribute("cy", mdY[i]); }
    }
    mdRaf = window.requestAnimationFrame(mdStep);
  }

  function md(run) {
    if (!mdSvg || reduced || mdOn === run) return;
    mdOn = run;
    if (run) {
      mdT0 = 0;
      mdRaf = window.requestAnimationFrame(mdStep);
    } else {
      window.cancelAnimationFrame(mdRaf);
      mdRaf = 0; mdAt = 0;
      mdChain.setAttribute("d", mdFrames[0]);          /* back to the first frame */
      if (mdTip) { mdTip.setAttribute("cx", mdX[0]); mdTip.setAttribute("cy", mdY[0]); }
    }
  }

  /* ---------------------------------------------------------- 1  reveal --- */

  if (!reduced && "IntersectionObserver" in window) {
    spine.classList.add("will-rise");
    new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" }).observe(spine);

    /* Belt and braces. If the observer never fires, because the tab was in the
       background at load or because a browser we have not tested does not run
       it, the figure must still appear. It is never allowed to stay hidden. */
    window.setTimeout(function () { spine.classList.add("in"); }, 1400);
  }

  /* -------------------------------------------------------- 2  emphasis --- */

  function at(el) { return Number(el.getAttribute("data-at") || el.getAttribute("data-node") || 0); }

  function strip() {
    nodes.forEach(function (n) { n.removeAttribute("data-lit"); });
    links.forEach(function (l) { l.removeAttribute("data-flow"); });
    tasks.forEach(function (t) { t.removeAttribute("data-lit"); t.removeAttribute("data-rel"); });
  }

  function clear() {
    md(false);
    spine.removeAttribute("data-focus");
    strip();
  }

  /* the quiet half. A tile names the pieces of work it talks to, usually in
     another part of the team, and pointing at it marks them. Marked, not held,
     so the run down the trunk stays the loud thing. */
  function relate(el) {
    (el.getAttribute("data-with") || "").split(/\s+/).forEach(function (id) {
      if (!id) return;
      var t = document.getElementById(id);
      if (t && !t.hasAttribute("data-lit")) t.setAttribute("data-rel", "");
    });
  }

  function show(el) {
    strip();                             /* swap the held set, never blank first */
    spine.setAttribute("data-focus", "1");

    if (el.classList.contains("node")) {
      el.setAttribute("data-lit", "");
      var here = at(el);
      tasks.forEach(function (t) { if (at(t) === here) t.setAttribute("data-lit", ""); });
      md(false);
      return;
    }

    el.setAttribute("data-lit", "");     /* a tile */
    md(el === mdOwner);
    var from = at(el);
    nodes.forEach(function (n) { if (at(n) >= from) n.setAttribute("data-lit", ""); });
    links.forEach(function (l) {
      if (Number(l.getAttribute("data-seg")) >= from) l.setAttribute("data-flow", "");
    });
    relate(el);                          /* after, so a held step is never marked */
  }

  /* One listener, on the container. pointerover bubbles, so crossing from one
     tile to the next is a single event and a single swap. */
  function resolve(t) {
    if (!t || !t.closest) return null;
    var task = t.closest(".task");
    if (task) return task;
    var core = t.closest(".node__core");
    return core ? core.parentNode : null;
  }

  spine.addEventListener("pointerover", function (e) {
    var el = resolve(e.target);
    if (el) show(el); else clear();
  });
  spine.addEventListener("pointerleave", clear);
  spine.addEventListener("focusin", function (e) {
    var el = resolve(e.target);
    if (el) show(el);
  });
  spine.addEventListener("focusout", function (e) {
    if (!spine.contains(e.relatedTarget)) clear();
  });
})();
