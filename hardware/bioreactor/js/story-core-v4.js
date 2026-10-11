// Story core — the scroll engine both prototypes share.
//
// V4-LOCAL COPY (polish pass, 9-10 Oct 2026) of hardware/js/story-core.js, which V4 must not edit. Two changes:
//  1. The scroll filter (see "scroll" below): three first-order lags in a row (tau 28 ms each), integrated in 2 ms
//     substeps, instead of the house spring. It reaches 90 % of a step in 0.15 s (the spring: 0.56 s, which read as
//     rubber-banding once the camera itself was calm), never overshoots and never moves backwards while the scroll moves
//     forwards (a chain of first-order lags is monotone), and a step in the scroll reaches the frame with continuous
//     acceleration. Measured: tools/v4_polish.py scroll + scrollsim, shots/v4-polish-scroll-filter-desk.png.
//  2. cfg.warp: the story's own time, a monotone warp of p (STORYBOARD rule 7); see draw().
// If the wiki adopts them, they belong in hardware/js/story-core.js.
//
// The contract: scroll position through the track is the only input, and the
// scene module hands back a draw(p) that is a pure function of it. Everything
// here is about turning a scroll offset into a stable p, putting the right
// caption on screen, and giving the offline frame rig a synchronous way in.
//
// Why a spring: a raw scroll offset lands the frame exactly where the wheel
// left it, which on a trackpad means the animation stutters with the fingers.
// A critically damped spring keeps a constant small lag at a steady speed and
// settles without overshoot, so the motion reads as weight rather than lag.
window.Story = function (cfg) {
  "use strict";

  const stage = cfg.stage, track = cfg.track;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------------------------------------------------- captions */
  const hud = cfg.hud;
  const caps = cfg.caps || [];
  const panels = caps.map(function (c, i) {
    const el = document.createElement("div");
    el.className = "cap";
    el.innerHTML =
      '<div class="cap-tag">' + (c.n || ("0" + (i + 1)).slice(-2)) +
      '<i></i>' + (c.role || "") + '</div>' +
      '<div class="cap-name">' + (c.name || "") + '</div>' +
      '<div class="cap-rule"></div>' +
      '<p>' + (c.body || "") + '</p>';
    hud.appendChild(el);
    return el;
  });

  // A caption fades in and out INSIDE its own window. The first cut let the fade
  // run past both ends, so neighbouring captions overlapped for about 7% of the
  // track and one act's words were read over the next act's picture.
  function caption(p) {
    for (let i = 0; i < caps.length; i++) {
      const c = caps[i], w = c.win;
      const inA = c.show === undefined ? w[0] : c.show;
      const span = Math.max(w[1] - inA, 1e-4);
      const fadeIn = Math.min(0.030, span * 0.26);
      const fadeOut = Math.min(0.030, span * 0.26);
      let a = 0;
      if (p > inA && p < w[1]) {
        a = Math.min((p - inA) / fadeIn, (w[1] - p) / fadeOut, 1);
        a = Math.max(0, Math.min(1, a));
        a = a * a * (3 - 2 * a);
      }
      const el = panels[i];
      if (a <= 0.002) {
        if (el.style.opacity !== "0") { el.style.opacity = "0"; el.style.visibility = "hidden"; }
        continue;
      }
      el.style.visibility = "visible";
      el.style.opacity = a.toFixed(3);
      el.style.transform = "translateY(" + ((1 - a) * 14).toFixed(2) + "px)";
    }
  }

  /* ------------------------------------------------------------- act rail */
  let rail = null, railDots = [];
  if (cfg.rail && caps.length) {
    rail = document.createElement("div");
    rail.className = "rail";
    caps.forEach(function (c) {
      const d = document.createElement("i");
      d.title = c.name || "";
      rail.appendChild(d); railDots.push(d);
    });
    stage.appendChild(rail);
  }
  function railAt(p) {
    if (!rail) return;
    for (let i = 0; i < caps.length; i++) {
      const w = caps[i].win;
      const on = p >= w[0] - 0.02 && p <= w[1] + 0.02;
      railDots[i].className = on ? "on" : "";
    }
  }

  /* ---------------------------------------------------------------- title */
  const titleEl = cfg.title || null;
  function title(p) {
    if (!titleEl) return;
    const out = cfg.titleOut === undefined ? 0.062 : cfg.titleOut;
    let a = 1 - Math.max(0, Math.min(1, (p - out * 0.35) / (out * 0.65)));
    a = a * a;
    titleEl.style.opacity = a.toFixed(3);
    titleEl.style.visibility = a < 0.003 ? "hidden" : "visible";
    titleEl.style.transform = "translateY(" + (-(1 - a) * 26).toFixed(1) + "px)";
  }

  const cueEl = cfg.cue || null;
  function cue(p) {
    if (!cueEl) return;
    const a = Math.max(0, 1 - p / 0.05);
    cueEl.style.opacity = a.toFixed(3);
  }

  /* ---------------------------------------------------------------- scroll */
  function targetP() {
    const r = track.getBoundingClientRect();
    const span = track.offsetHeight - stage.offsetHeight;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(1, -r.top / span));
  }

  let p = targetP(), vel = 0, last = performance.now(), running = false, visible = true, raf = 0, l1 = p, l2 = p;
  // (the house file's spring, omega 7, settles in about 0.6 s: with V4's calm camera that read as lag)
  // V4: three first-order lags (TAU each): 90 % of a step in 5.3 TAU = 0.15 s, no overshoot, monotone
  const TAU = 0.028, SUB = 0.002;

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = targetP();
    if (reduced) { p = t; l1 = t; l2 = t; vel = 0; }
    else {
      const p0 = p, n = Math.max(1, Math.ceil(dt / SUB)), k = 1 - Math.exp(-(dt / n) / TAU);
      for (let i = 0; i < n; i++) { l1 += (t - l1) * k; l2 += (l1 - l2) * k; p += (l2 - p) * k; }
      vel = dt > 0 ? (p - p0) / dt : 0;
      if (Math.abs(p - t) < 1e-6 && Math.abs(l1 - t) < 1e-6 && Math.abs(l2 - t) < 1e-6) { p = t; l1 = t; l2 = t; vel = 0; }
    }
    draw(p, now / 1000, dt);
    raf = (running && visible) ? requestAnimationFrame(step) : 0;
  }

  // V4: the scene's own time. A monotone warp of the scroll's p (cfg.warp) re-times the story so the camera's motion
  // gets an even share of the scroll (STORYBOARD rule 7); captions, title and everything drawn ride the warped p.
  function draw(pp, clock, dt) {
    const q = cfg.warp ? cfg.warp(pp) : pp;
    caption(q); title(q); cue(q); railAt(q);
    cfg.draw(q, reduced ? 0 : (clock || 0), dt || 0);
  }

  function start() {
    if (running) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(step);
  }
  // Cancelling matters: clearing the flag alone leaves one frame already queued,
  // and that frame runs AFTER renderAt and redraws at the spring's position. It
  // cost a whole review round of frames that were one act behind their caption.
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  // Off screen, nothing is drawn: this page is one of two on a dev server and
  // the reader scrolls past the stage into the notes below it.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0 }).observe(stage);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else if (visible) start();
  });

  /* ---------------------------------------------------------------- loader */
  const loader = cfg.loader || null, pct = cfg.pct || null;
  let done = false;
  function progress(f) {
    if (pct) pct.textContent = Math.round(Math.max(0, Math.min(1, f)) * 100) + "%";
  }
  function ready() {
    if (done) return; done = true;
    if (loader) { loader.classList.add("gone"); }
    start();
  }

  /* ------------------------------------------------------- the offline hook */
  // A backgrounded tab never runs requestAnimationFrame, so the frame rig gets
  // a synchronous way to put the story at an exact p and draw it.
  window.__story = {
    // Stops the loop first. Without that, the spring carries on pulling p back
    // toward the real scroll position and the screenshot taken a moment later
    // catches a frame on the way home, not the frame that was asked for.
    // An optional clock: the frame rig's flicker probe renders the same p at
    // two clocks, which moves the camera by exactly the breath a live frame
    // gets, and diffs the two.
    renderAt: function (pp, clock) {
      stop();
      p = Math.max(0, Math.min(1, pp)); vel = 0; l1 = p; l2 = p;
      // (V4 round 4b: the scene draws an exact frame here, e.g. its shadow map every time, so renderAt is pure in p)
      window.__storyExact = true;
      try { draw(p, clock !== undefined ? clock : (cfg.captureClock === undefined ? 12.5 : cfg.captureClock), 0); }
      finally { window.__storyExact = false; }
    },
    resume: function () { start(); },
    // V4 round 4b: the story-core part of the overlay at the story's own time q (captions, title, cue, rail)
    dom: function (q) { caption(q); title(q); cue(q); railAt(q); },
    caps: caps,
    get p() { return p; },
    ready: function () { return done; },
  };

  return { progress: progress, ready: ready, start: start, stop: stop, reduced: reduced };
};
