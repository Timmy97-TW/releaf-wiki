// Hydroponics hero — the schedule, the captions, the title card and everything else
// on the stage that is a pure function of p and is NOT the 3D frame (7 Oct 2026, for
// the video pass).
//
// The hero runs in one of two modes (../../js/hero-mode.js decides which):
//   video   the 3D walkthrough is a pre-rendered clip scrubbed by the scroll
//           (../../js/scrub-video.js); three.js and the model are never loaded;
//   live3d  the WebGL story in js/story.js, as before. ?live3d=1 forces it, and it is
//           what the clips are rendered from (dev/hero-video/).
// The caption layout system below moved here from story.js unchanged: both modes seat
// and fade the type with it, and the 3D story still reads capDrop() for how far the
// model drops under the type. Edit a caption here and it changes in both; edit the 3D
// in story.js and re-render the clips (dev/hero-video/README.md).
window.HERO = (function () {
  const story = document.getElementById("story");
  const stage = story.querySelector(".story-stage");
  const titleEl = document.getElementById("title");
  const cueEl = document.getElementById("cue");
  // The stage's size in CSS px, as the 3D story measures it (story.js measure()).
  let cssW = 0, cssH = 0;

  /* ---------- the schedule ---------- */
  // Every act is a scroll window. Overlaps are deliberate: a label fades out
  // while the next thing is already arriving, which is what stops the piece
  // reading as a slide deck.
  const A = {
    title:   [0.000, 0.070],
    toTop:   [0.065, 0.175],
    marks:   [0.156, 0.256],
    // The camera move from the top view to the front used to end 0.068 of
    // scroll before anything happened in it — a stretch with no caption, no
    // event and an awkward three-quarter framing. The fall now starts as the
    // camera arrives: the first holder is in frame at 0.300, the last seats at
    // 0.3856 (see FALL_RANK).
    toFront: [0.244, 0.312],
    fall:    [0.300, 0.390],
    // The hold is at 122 degrees, so 34% of the turn happens before it and 66%
    // after. The windows are sized in the same ratio, or the return reads as a
    // snap: at the old [0.500,0.646] the second half turned 2.2x faster than
    // the first.
    // The turn's two halves are deliberately NOT rate-matched any more: 122 deg
    // in 0.062 of scroll before the hold, 238 deg in 0.060 after it. The return
    // is meant to snap.
    tumble:  [0.462, 0.640],
    airHold: [0.524, 0.580],
    // The handles act now runs up to the studio exit. It used to end at 0.742,
    // followed by 0.058 of scroll (376 px at 810 tall) with no caption and a
    // model that barely moved until the floor gave way at 0.780. The fully out
    // pose (handles framing the type) now holds while the caption is read; the
    // type leaves first, then the handles seat, finishing just as the studio
    // hands over to the water.
    hOut:    [0.654, 0.700],
    hBack:   [0.746, 0.778],
    drop:    [0.800, 0.868],
    settle:  [0.856, 0.912],
    grow:    [0.878, 0.950],
  };
  function ramp(t, a, b) { const u = Math.min(1, Math.max(0, (t - a) / Math.max(1e-6, b - a))); return u * u * (3 - 2 * u); }

  /* ---------- captions ---------- */
  // One panel, its content swapped per act: a centred block of type across the
  // top of the frame, with the model dropped down out from under it. The
  // pop-out boxes with leader lines were fighting the model for attention.
  //
  // THE CAPTION LAYOUT SYSTEM — this table, measureCaps, seatCaption, capDrop
  // and placeCaption are all of it. Fields per caption:
  //   win: [a, b]       the act. Anchors the model's drop, and is also the type
  //                     window unless show/out say otherwise.
  //   show / out        optional. When the TYPE starts to fade in / has faded
  //                     out, independently of the drop (which stays on win).
  //                     Type windows must not overlap: the content swaps at the
  //                     crossing, so an overlap would switch the words mid-fade.
  //   bot               where the type block's BOTTOM edge sits, as a fraction
  //                     of the stage height. The block grows UP from there into
  //                     the empty top of the frame, never down into the part.
  //                     Measured from the 1440x810 seats, so that size is
  //                     unchanged.
  //   drop              how far the model moves down for the act (fraction of h).
  //   handoff: true     the drop crossfades straight into the next caption's
  //   handoff: "water"  the drop crossfades into the water shot's horizon offset
  //   dIn / dOut        explicit drop windows for an act with its own timing
  //   align: "next"     seat the block's TOP on the next caption's top, for a
  //                     caption that hands straight to the next one
  const CAPS = [
    { win: [0.156, 0.262], drop: 0.145, bot: 0.242, handoff: true, n: "01", name: "Thirteen seats", role: "Bore pattern",
      body: "Teardrop bores, a &empty;10.39&nbsp;mm circle drawn out to a point 11.69&nbsp;mm long, on a 21.59&nbsp;mm pitch, staggered <span class='nw'>4&ndash;5&ndash;4</span> so the outer rows sit half a pitch off the middle one." },
    // The holders fall through the type band (0.300-0.3856, left to right), and
    // with the type on win it was solid from 0.334 while cones crossed the
    // headline and the body copy until 0.369 at every viewport. The TYPE now
    // waits for the run (show 0.372): the last holder is below the type before
    // the words reach 2% opacity, and they fade in as the last ones tap down.
    // The drop keeps win, so the plate is already seated before the fall.
    { win: [0.314, 0.448], show: 0.372, drop: 0.150, bot: 0.335, dOut: [0.482, 0.526], n: "02", name: "One per bore", role: "Seed holders",
      body: "Thirteen holders seat on their flanges. Each basket carries the seed and its medium; roots pass through it into the reservoir below." },
    // The drop lands WITH the turn's deceleration, so the part is dead still for
    // the whole 0.526-0.580 hold. On the generic windows it slid 111 px down the
    // frame through the first half of the hold and began rising back into solid
    // type.
    // Through the turn the part does not move for the type. 02 used to let go
    // of its drop over 0.443-0.488 and 03 to take it back over 0.482-0.526,
    // and 03 let go over 0.590-0.632 before 04 took it over 0.614-0.662: with
    // no caption on screen the plate rose 187 px up the frame and sank 151 px
    // back on the way in, and rose ~110 px on the return (1440x810). 02 now
    // hands its drop straight to 03 (02's dOut = 03's dIn) and 03 straight to
    // 04 (03's dOut = 04's default in), so the drop only crossfades
    // 0.175 -> 0.190 -> 0.145 of h. The hold is untouched.
    { win: [0.526, 0.602], drop: 0.190, bot: 0.270, dIn: [0.482, 0.526], dOut: [0.614, 0.662],
      n: "03", name: "Two sealed rails", role: "Why it floats",
      body: "Each long side hides a sealed chamber 114.3&nbsp;mm long: a box section chamfered to a point underneath, a teardrop-like pentagon 20.3&nbsp;mm deep in 1.59&nbsp;mm walls. The pair holds 42.3&nbsp;cm&sup3; the water cannot get into. Nothing hangs below the middle of the plate." },
    { win: [0.654, 0.758], drop: 0.145, bot: 0.382, handoff: "water", n: "04", name: "Handles", role: "Lifting out",
      body: "They clip into slots moulded into the plate, so the whole raft lifts clear of the reservoir without touching a plant." },
    // The raft is still coming down (0.800-0.868) as 05 arrives, and its handle
    // tops are the part nearest the type. At 0.806/0.453 the fading-in type
    // sat level with them (0.7 px at a quarter opacity, 20 px solid at
    // 1440x810) and the settled gap was 46 px. The type now appears 0.010
    // later, once the raft is nearly down, and sits 35 px higher in the sky:
    // 51 / 67 / 81 px at 1440x810, and still 42 / 57 / 68 at 1512x680.
    // The raft does not move for it (drop 0). The out at 0.890 still clears
    // 06's 0.902.
    { win: [0.816, 0.890], drop: 0.000, bot: 0.410, align: "next", n: "05", name: "Deep water culture", role: "On the reservoir",
      body: "The raft floats on the nutrient solution and rides its surface." },
    // The dive (0.952-1.000) lifts the raft into the top of the frame: its
    // handle tops reach the type at p 0.958 on every desktop window, and the
    // copy used to stay up to 0.981, printed across the leaves and the plate.
    // The TYPE now leaves on its own window (out 0.962), fully gone before the
    // handles arrive, while the drop keeps win/dOut so the dive and the final
    // frame are framed exactly as before. show 0.894 keeps the solid read at
    // 0.038, like 05's. Seated at 05's bot, so the 05 -> 06 swap never jumps.
    { win: [0.902, 1.001], show: 0.894, out: 0.962, drop: 0.040, bot: 0.410, dOut: [0.976, 1.021], n: "06", name: "Roots reach the solution", role: "Growth",
      body: "Shoots rise from the baskets while the roots grow down through them into the aerated water." },
  ];
  const CAP_FADE = 0.020;             // type fade length, in p
  // How much of its authored gap over the part a caption clamped under the
  // topbar may give up before the part is moved (fraction of h). The smallest
  // authored gap at 1440x810 is act 3's, ~0.097 h of clear air under the ink.
  const CAP_SLACK = 0.040;
  const panel = document.getElementById("panel");
  const topbar = document.querySelector(".topbar, .hwnav");
  const pEls = panel ? {
    tag: panel.querySelector(".tag"), name: panel.querySelector(".pname"),
    role: panel.querySelector(".prole"), body: panel.querySelector("p")
  } : null;
  let capShown = -1;
  // Per caption, once per layout (measureCaps): the type block's height in px,
  // and capX, the extra drop (fraction of h) it needs ONLY where its seat
  // would reach the topbar and is clamped below it.
  const capH = new Float32Array(CAPS.length), capX = new Float32Array(CAPS.length);
  // SHORT WINDOWS (a phone on its side, ~390 px tall). The topbar and the
  // 12 px body floor are fixed px, so the type is 43-48% of the height there
  // and the part, 56-61% of the height, cannot fit under it at any drop: the
  // drop alone cut 46 px off the lower air chamber at 844x390 and ran both
  // handles through the act-04 copy. Below FIT_H the act's camera also backs
  // off (capS, a distance factor) just enough to seat the part between the
  // type and the frame foot. CAP_FIT: the part's highest and lowest point
  // about the look target over each act's type window, fraction of h at
  // pull 1, measured at 1440x810 (vertical fov, so the same on any aspect).
  // Windows taller than FIT_H are untouched (fitK 0, capS exactly 1).
  const capS = new Float32Array(CAPS.length).fill(1);
  const CAP_FIT = [[0.300, 0.298], [0.270, 0.294], [0.354, 0.259], [0.331, 0.269]];
  const FIT_H = 600, FIT_RAMP = 80, FIT_GAP = 0.045, FIT_FOOT = 0.040;
  let capPull = 1;
  function fillCaption(i) {
    const c = CAPS[i];
    pEls.tag.textContent = c.n;
    pEls.name.textContent = c.name;
    pEls.role.textContent = c.role;
    pEls.body.innerHTML = c.body;
  }
  // The fixed topbar is painted over the stage; type stays 14 px under it.
  function capBar() { return (topbar ? topbar.getBoundingClientRect().bottom : 52) + 14; }
  // The block's unclamped top: its own bot, or (align "next") the next
  // caption's top. 05 hands straight to 06 (out 0.890, show 0.894); seated by
  // its own bottom the one-line 05 sat a body line lower, and the eyebrow and
  // name hopped 22 px up across the swap (1440x810).
  function capTop(i) {
    const k = CAPS[i].align === "next" && CAPS[i + 1] ? i + 1 : i;
    return CAPS[k].bot * cssH - capH[k];
  }
  function seatCaption(i, bar) {
    panel.style.top = Math.max(bar, capTop(i)).toFixed(1) + "px";
  }
  // The model's size on screen is a fixed fraction of the stage HEIGHT (the fov
  // is vertical) while the type was fixed px, so a short window gave the same
  // block a bigger bite of the frame and a smaller gap over the part. --ck
  // scales the caption type (and the title card) with the height, clamped to
  // [0.78, 1]: the block keeps its 1440x810 proportion down to ~630 px tall and
  // never grows past it. Heights are then MEASURED, per caption, never per
  // frame: the drop used to be scaled by whichever caption was LOADED,
  // re-measured only on a content swap, so it changed mid-ramp (a 19 px model
  // pop at p = 0.531 on 1280x720).
  function measureCaps(w, h) {
    if (w) { cssW = w; cssH = h; }
    if (!panel || !pEls) return;
    story.style.setProperty("--ck", Math.min(1, Math.max(0.78, cssH / 810)).toFixed(3));
    // Above 810 tall the part keeps growing with h but the caption type stopped
    // at 1: at 1920x1080 the block was 9.9% of the height against 13.2% at 810,
    // at 2560x1440 7.4% (a 27 px name over a 1528 px plate). The CAPTION only
    // (the title card's gap to the hero part is already tight, so #story keeps
    // the clamp above) follows at 0.6 of the height ratio, capped at 1.30:
    // 1080 tall 1.20, 1440 tall 1.30. It is seated by its bottom edge, so it
    // grows up into the empty sky and the gap over the part is kept. Desktop
    // widths only (ramp 900-1200 px): a portrait tablet or phone is width-bound,
    // and a bigger block there only wraps to an extra line.
    const ckUp = Math.min(1.30, 1 + 0.6 * Math.max(0, cssH / 810 - 1) * Math.min(1, Math.max(0, (cssW - 900) / 300)));
    panel.style.setProperty("--ck", (cssH < 810 ? Math.max(0.78, cssH / 810) : ckUp).toFixed(3));
    const bar = capBar();
    // Every height first: an align "next" caption is seated on the next one's.
    for (let i = 0; i < CAPS.length; i++) { fillCaption(i); capH[i] = panel.offsetHeight; }
    for (let i = 0; i < CAPS.length; i++) {
      // The plate does not move because of the type: a block clamped under
      // the topbar first spends up to CAP_SLACK of its own authored gap, and
      // only a block that would eat more than that (a phone's wrapped copy)
      // hands the rest to the model as extra drop. The topbar is fixed px,
      // so on a 680-720 px window 01 and 03 overflow by 12-16 px; letting
      // capX take all of it sat the rails 16 px nearer the frame foot.
      capX[i] = Math.max(0, bar - capTop(i) - CAP_SLACK * cssH) / Math.max(1, cssH);
      capS[i] = 1;
      const fitK = Math.min(1, Math.max(0, (FIT_H - cssH) / FIT_RAMP)), F = CAP_FIT[i];
      if (fitK > 0 && F) {
        const top = (Math.max(bar, capTop(i)) + capH[i]) / cssH + FIT_GAP;
        const foot = 1 - FIT_FOOT;
        const s = Math.max(1, (F[0] + F[1]) / Math.max(0.2, foot - top));
        const d0 = CAPS[i].drop + capX[i];
        const d = s > 1 ? top + F[0] / s - 0.5 : Math.min(Math.max(d0, top + F[0] - 0.5), foot - F[1] - 0.5);
        capS[i] = 1 + (s - 1) * fitK;
        capX[i] += (d - d0) * fitK;
      }
    }
    // Put back and re-seat what is showing in this same task, so a resize
    // mid-caption never paints the last-measured caption or a stale seat
    // (a ResizeObserver callback runs after this frame's rAF).
    if (capShown >= 0) { fillCaption(capShown); seatCaption(capShown, bar); }
  }
  // How far the model drops for the act that is up. The captions are a centred
  // band across the TOP of the frame now, so the subject moves DOWN out from
  // under them and never sideways — the sideways push is what used to carry a
  // handle off the right edge at full extension (measured: 104.1% of frame
  // width). The water acts pass 0: their horizon offset already sits the raft
  // low in the frame.
  // One release scheme. By default the drop LEADS the type in and TRAILS it
  // out, so the part never moves toward visible type. Released to zero between
  // acts and re-taken, it made the model bob with nothing driving it: 91 px up
  // into the empty band and 137 px back down across the top-to-front roll, and
  // 101 up / 146 down from the handles to the water (1440x810). A `handoff`
  // crossfades instead: into the next caption's drop, or into the water shot's
  // horizon offset on the very ramp that brings it in (see oy), so the model
  // travels down once, continuously.
  // capX rides the same ramps as the caption's own drop, so it can never pop.
  function capDrop(p) {
    let d = 0, sp = 0;
    for (let i = 0; i < CAPS.length; i++) {
      const c = CAPS[i], prev = CAPS[i - 1], next = CAPS[i + 1];
      const dr = c.drop + capX[i];
      if (!dr && capS[i] === 1) continue;
      const inU = c.dIn ? ramp(p, c.dIn[0], c.dIn[1])
        : prev && prev.handoff === true ? ramp(p, prev.win[1] - 0.025, c.win[0] + 0.020)
        : ramp(p, c.win[0] - 0.040, c.win[0] + 0.008);
      const outU = c.dOut ? ramp(p, c.dOut[0], c.dOut[1])
        : c.handoff === "water" ? ramp(p, A.drop[0] - 0.03, A.drop[0] + 0.05)
        : c.handoff && next ? ramp(p, c.win[1] - 0.025, next.win[0] + 0.020)
        : ramp(p, c.win[1] - 0.005, c.win[1] + 0.040);
      if (inU <= 0 || outU >= 1) continue;
      d += dr * inU * (1 - outU);
      sp += (capS[i] - 1) * inU * (1 - outU);
    }
    capPull = 1 + sp;   // read by the camera block, same ramps as the drop
    return d;
  }
  function placeCaption(p) {
    if (!panel) return;
    let best = -1, o = 0;
    for (let i = 0; i < CAPS.length; i++) {
      const c = CAPS[i];
      const s = c.show !== undefined ? c.show : c.win[0];
      const e = c.out !== undefined ? c.out : c.win[1];
      const v = ramp(p, s, s + CAP_FADE) * (1 - ramp(p, e - CAP_FADE, e));
      if (v > o) { o = v; best = i; }
    }
    if (best >= 0 && best !== capShown) {
      // Each act seats its type where that act has room (bot, see CAPS). The
      // swap happens while the type is faded out, so the move is never seen.
      fillCaption(best);
      seatCaption(best, capBar());
      capShown = best;
    }
    panel.style.opacity = o;
    panel.style.transform = "translateX(-50%) translateY(" + (12 * (1 - o)) + "px)";
  }


  /* ---- act 1: title and cue ---- */
  function titleCue(p) {
    // Gone before the part rises into it. Faded over the whole push-in, the
    // headline hung as a 26%-opacity ghost across the part at p = 0.05 (93 px
    // of overlap at 1440x810). The camera holds until 0.012, so by the time
    // the part reaches the type the type is under 20%.
    const titleOut = ramp(p, A.title[0] + 0.004, A.title[0] + 0.040);
    if (titleEl) {
      titleEl.style.opacity = 1 - titleOut;
      titleEl.style.transform = "translateX(-50%) translateY(" + (-20 * titleOut) + "px)";
    }
    if (cueEl) cueEl.style.opacity = 1 - ramp(p, 0.003, 0.028);
  }

  /* ------------------------------------------------------------- video mode */
  // The clip replaces the WebGL canvas. Baked into it: the 3D frame, the page's
  // backdrop behind that (transparent) canvas — the aurora, the glow and the horizon
  // grid — and the thirteen bore rings of act 01, which follow the 3D camera. Live on
  // top: the starfield (with its twinkle and the measured sky mask), the dust motes,
  // and everything above: the captions, the title card, the cue.
  //
  // The scroll engine is story.js's own: a critically damped spring at 44 rad/s,
  // integrated in closed form, and a target that moves more than 0.2 of the story in
  // one frame is a cut (Home, End, a link). Reduced motion: p is the scroll position
  // itself and the clock stands still, the same rule as the other two heroes.
  function video() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loader = document.getElementById("loader"), pctEl = document.getElementById("load-pct");
    const player = ScrubVideo({
      stage: stage, story: story,
      replace: [document.getElementById("gl")],
      data: window.HERO_CLIPS,
      overlays: ["stars", "motes"],
      // the dust's brightness, fitted to the WebGL frame (dev/hero-video)
      motes: [{ gain: 1.15 }],
      breath: 0,          // this camera never breathed: it rides the raft
    });
    const SPRING_W = 44, SPRING_CUT = 0.20;
    let p = 0, pTarget = 0, pVel = 0, pLast = 0, storyTop = 0, storySpan = 1;
    let last = performance.now(), looping = false, onScreen = true, held = false, isReady = false;

    function measure() {
      cssW = stage.clientWidth || window.innerWidth;
      cssH = stage.clientHeight || window.innerHeight;
      storyTop = story.offsetTop;
      storySpan = Math.max(1, story.offsetHeight - window.innerHeight);
      measureCaps(cssW, cssH);
    }
    function onScroll(snap) {
      pTarget = Math.min(1, Math.max(0, (window.pageYOffset - storyTop) / storySpan));
      if (snap === true || reduced) { p = pLast = pTarget; pVel = 0; }
    }
    function draw(pp, t) {
      titleCue(pp);
      placeCaption(pp);
      player.draw(pp, reduced ? 0 : t);
    }
    function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (reduced) { p = pLast = pTarget; pVel = 0; }
      else {
        const jump = pTarget - pLast;
        pLast = pTarget;
        if (jump > SPRING_CUT || jump < -SPRING_CUT) { p = pTarget; pVel = 0; }
        else {
          const k = Math.exp(-SPRING_W * dt);
          let e = p - pTarget;
          const c = (pVel + SPRING_W * e) * dt;
          pVel = (pVel - SPRING_W * c) * k;
          e = (e + c) * k;
          if (Math.abs(e) < 2e-5 && Math.abs(pVel) < 2e-4) { e = 0; pVel = 0; }
          p = Math.min(1, Math.max(0, pTarget + e));
        }
      }
      draw(p, now / 1000);
    }
    function loop(now) {
      if (held || !onScreen || document.hidden) { looping = false; return; }
      step(now);
      requestAnimationFrame(loop);
    }
    function start() {
      if (looping || held || !isReady) return;
      looping = true; last = performance.now(); pVel = 0;
      requestAnimationFrame(loop);
    }

    document.body.classList.add("story-on");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        // the page's own CSS keys off this: the graticule and the grain sit out
        // while the story is on screen, as they do over the WebGL canvas
        document.body.classList.toggle("story-on", onScreen);
        if (onScreen) start();
      }, { threshold: 0 }).observe(story);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { measure(); onScroll(true); });
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(stage);
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    onScroll(true);

    player.onProgress(function (f) { if (pctEl) pctEl.textContent = Math.round(f * 100) + "%"; });
    player.onReady(function () {
      isReady = true;
      measure(); onScroll(true);
      draw(p, performance.now() / 1000);
      if (loader) loader.classList.add("hide");
      start();
    });
    player.preload(p);

    // The same handle the 3D story exposes, for the capture and verification rigs.
    window.__story = {
      renderAt: function (pp, clock) {
        held = true;
        p = pTarget = pLast = Math.min(1, Math.max(0, pp)); pVel = 0;
        draw(p, clock === undefined ? 12.5 : clock);
        return p;
      },
      resume: function () { if (!held) return; held = false; onScroll(); start(); },
      p: function () { return p; },
    };
  }

  return {
    A: A, CAPS: CAPS, ramp: ramp,
    measureCaps: measureCaps, capDrop: capDrop, capPull: function () { return capPull; },
    placeCaption: placeCaption, titleCue: titleCue, video: video,
  };
})();
