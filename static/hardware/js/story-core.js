// Story core — the scroll engine both prototypes share.
//
// The contract: scroll position through the track is the only input, and the
// scene module hands back a draw(p) that is a pure function of it. Everything
// here is about turning a scroll offset into a stable p, putting the right
// caption on screen, and giving the offline frame rig a synchronous way in.
//
// Why a filter: a raw scroll offset lands the frame exactly where the wheel
// left it, which on a trackpad means the animation stutters with the fingers.
// 17 Oct 2026: three first-order lags in a row (28 ms each, integrated in 2 ms
// substeps), the filter the bioreactor's opening (V4, its js/story-core-v4.js)
// has used since 10 Oct, replace the critically damped spring at 7 rad/s. The
// owner on the scroll animations: "it looks very behind". Measured with wheel
// input at 1400 px/s (dev/night-logs/2026-10-17-overnight/w3/): the spring held
// the picture 282 ms (median) behind the scroll and took 0.5 s to settle after
// it; the chain reaches 90 % of a step in 0.15 s, keeps about 84 ms of lag at a
// steady speed, never overshoots and never runs backwards while the scroll
// runs forwards (a chain of first-order lags is monotone), and a step in the
// scroll still reaches the frame with continuous acceleration, so a wheel's
// notches do not show.
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
  // (until 17 Oct 2026: a critically damped spring at 7 rad/s, which had come
  // down from 16 and 10 so that a wheel's stepped deltas would not show; see the
  // note at the top for why the lag chain replaced it)
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

  // 18 Oct 2026: cfg.follow (a clip's player, js/scrub-video.js) maps the scroll's p to the p of the frame actually
  // on screen; the captions, title, cue and rail are drawn there, so they never move on without the clip. cfg.draw
  // still gets the scroll's p (the clip seeks to it); a page draws its own words at cfg.follow(p) too.
  function draw(pp, clock, dt) {
    const q = cfg.follow ? cfg.follow(pp) : pp;
    caption(q); title(q); cue(q); railAt(q);
    cfg.draw(pp, reduced ? 0 : (clock || 0), dt || 0);
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
      // (the frame rig asks for an exact p: the words are drawn there, not where the clip has got to)
      window.__storyExact = true;
      try { draw(p, clock !== undefined ? clock : (cfg.captureClock === undefined ? 12.5 : cfg.captureClock), 0); }
      finally { window.__storyExact = false; }
    },
    resume: function () { start(); },
    caps: caps,
    get p() { return p; },
    ready: function () { return done; },
  };

  return { progress: progress, ready: ready, start: start, stop: stop, reduced: reduced };
};
