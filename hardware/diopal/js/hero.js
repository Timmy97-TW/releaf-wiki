// LPA hero — the acts, the captions, the duty-cycle traces, and everything else on
// the stage that is a pure function of p (and the clock) and is NOT the 3D frame
// (7 Oct 2026, for the video pass).
//
// The hero runs in one of two modes (../../js/hero-mode.js decides which):
//   video   the 3D walkthrough is a pre-rendered clip scrubbed by the scroll
//           (../../js/scrub-video.js); three.js and the models are never loaded;
//   live3d  the WebGL story in js/story.js, as before. ?live3d=1 forces it, and it is
//           what the clips are rendered from (dev/hero-video/).
// Both modes read the acts and captions from here and call dom(p, clock) every frame.
// Edit a caption here and it changes in both; edit the 3D in story.js and re-render
// the clips (dev/hero-video/README.md).
window.HERO = (function () {
  "use strict";

  // Tier is a PWM duty cycle in the instrument, not a different LED: the six
  // channels are matched to within a few percent at full drive.
  const DUTY = { Low: 0.16, Mid: 0.52, High: 1.0 };

  /* ------------------------------------------------------------------ acts */
  // B0 is a little later than the photometer's: act 0 has the longest move in
  // the story (whole instrument to a close-up of the wells) and needs the room.
  const B0 = 0.098, B1 = 0.180, B2 = 0.300, B3 = 0.420, B4 = 0.560, B5 = 0.680, B6 = 0.790, B7 = 0.920;

  // 14 Oct 2026, the teammate's edit doc: no act numbers on the captions (story-core
  // prints `n` when it is set, and a lone space prints nothing), the doc's own
  // subcaptions, act 05's caption ("Intensity is a duty cycle") removed as repetitive
  // of act 06, whose caption now carries PWM. The acts' windows are unchanged.
  const CAPS = [
    { win: [B0, B1], n: " ", role: "The switch", name: "Green on, red off",
      body: "Green light activates the <b>CcaS/CcaR</b> signaling system, while red light switches the response off." },
    { win: [B1, B2], n: " ", role: "The tube", name: "Lit from underneath",
      body: "Each culture tube sits directly above an LED emitter, delivering light from below while keeping the culture closed and undisturbed throughout the run." },
    { win: [B2, B3], n: " ", role: "Shielding", name: "One tube &ndash; One LED",
      body: "Each culture tube is positioned above a single LED, while the housing isolates the light paths between columns to prevent cross-illumination from neighboring LEDs." },
    { win: [B3, B4], n: " ", role: "Dose", name: "Six conditions, four tubes each",
      body: "Red and green light are tested across six conditions in parallel, with four replicate cultures assigned to each condition." },
    { win: [B5, B6], n: " ", role: "Drive", name: "One MOSFET per intensity",
      body: "PWM controls how long each LED is on during a cycle, creating the low, mid, and high intensity levels. Each intensity level is driven through its own MOSFET control channel across the array." },
    { win: [B6, B7], n: " ", role: "Assembly", name: "Consistent alignment, every build",
      body: "The printed geometry fixes the position of the LEDs, tube rack, and housing, so the array can be reassembled with the same alignment each time." },
  ];

  function ramp(p, a, b) { const t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* --------------------------------------------------------- the stage's DOM */
  const stage = document.querySelector(".story-stage");
  const statsEl = document.getElementById("stats");
  const heroFrame = document.querySelector(".hero-frame");
  const titleEl = document.getElementById("title");
  const duty = document.getElementById("duty");
  const dctx = duty.getContext("2d");

  // The three duty cycles, drawn as the square waves they are. Screen space, and
  // live in both modes: the trains scroll on the clock. In video mode the canvas
  // is laid out in the clip's reference viewport and scaled with the clip
  // (scrub-video.js refLayers), so it stays beside the three tubes at any size.
  // vis (video mode only): the part of this canvas the stage shows, when the canvas is
  // the clip's reference viewport scaled to cover a window of another shape. The traces
  // keep their margin inside it; in live mode the canvas IS the stage and vis is unset.
  function drawDuty(alpha, clock, vis) {
    const w = duty.clientWidth, h = duty.clientHeight;
    // window.__heroDpr: see js/callouts.js. Unset in normal use.
    const dpr = window.__heroDpr || Math.min(window.devicePixelRatio || 1, 2);
    if (duty.width !== w * dpr || duty.height !== h * dpr) { duty.width = w * dpr; duty.height = h * dpr; }
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, w, h);
    duty.style.opacity = alpha.toFixed(3);
    if (alpha <= 0.004) return;

    const tiers = [["Low", DUTY.Low], ["Mid", DUTY.Mid], ["High", DUTY.High]];
    // 0.68, not 0.66: at 1440 the HIGH and MID labels ended on the right wall
    // of the high tube, with no gap between the type and the glass.
    // In portrait the three tubes fill the width, and a column of traces down
    // the right ran straight across them: MID's label sat on the mid tube and
    // two of the trains crossed the high one. There the traces go in the band
    // between the header and the caps instead, shorter and wider. Same rule
    // for portrait as the camera's.
    // And on a squarer landscape screen the tubes sit further right in the
    // frame (at 1024 x 768 the HIGH label landed on the high tube), so the
    // left edge moves right as the frame narrows: 0.68 at 16:10, 0.75 at 4:3.
    const portrait = h > w * 1.05;
    const aspect = w / Math.max(1, h);
    const L = portrait ? w * 0.42 : w * Math.max(0.68, Math.min(0.80, 0.68 + (1.6 - aspect) * 0.26));
    let R = portrait ? w * 0.93 : w * 0.96;
    let dy = 0;
    if (vis) {
      const vw = vis.x1 - vis.x0;
      R = Math.min(R, vis.x1 - vw * (portrait ? 0.07 : 0.04));
      // portrait: the first train must clear the top of what is shown
      if (portrait) dy = Math.max(0, vis.y0 + 14 - (h * 0.088 - 18));
    }
    dctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    tiers.forEach(function (tr, i) {
      const y = (portrait ? h * (0.088 + i * 0.056) : h * (0.18 + i * 0.16)) + dy;
      const amp = portrait ? 18 : 30;
      dctx.strokeStyle = "rgba(255,255,255,.18)"; dctx.lineWidth = 1;
      dctx.beginPath(); dctx.moveTo(L, y); dctx.lineTo(R, y); dctx.stroke();

      // The filled area under each train IS the duty cycle — the proportion of
      // the strip that is green is the proportion of the time the LED is on.
      // The outline alone made the three tiers a set of similar-looking square
      // waves you had to count; filled, the difference is the first thing you
      // see and it does not depend on lining up with the tubes.
      dctx.fillStyle = "rgba(63,224,127,.20)";
      (function () {
        const cyc = 5, sp = (R - L) / cyc;
        const sh2 = ((clock * 0.22) % 1) * sp;
        for (let xx = L - sh2; xx < R + sp; xx += sp) {
          const a = Math.max(L, xx), b2 = Math.min(R, xx + sp * tr[1]);
          if (b2 > a) dctx.fillRect(a, y - amp, b2 - a, amp);
        }
      })();

      dctx.strokeStyle = "rgba(90,240,150,1)"; dctx.lineWidth = 2.4;
      dctx.beginPath();
      const cycles = 5, span = (R - L) / cycles;
      const shift = ((clock * 0.22) % 1) * span;
      // Clamped at BOTH ends. Only the right end was, so with the scroll offset
      // the first pulse was drawn up to a whole span to the left of L and ran
      // back over the tier labels sitting there.
      const cl = function (v) { return Math.max(L, Math.min(v, R)); };
      let x = L - shift;
      dctx.moveTo(L, y);
      while (x < R + span) {
        const on = span * tr[1];
        dctx.lineTo(cl(x), y);
        dctx.lineTo(cl(x), y - amp);
        dctx.lineTo(cl(x + on), y - amp);
        dctx.lineTo(cl(x + on), y);
        x += span;
      }
      dctx.lineTo(R, y); dctx.stroke();

      dctx.textAlign = "right";
      dctx.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
      dctx.fillStyle = "rgba(214,224,236,.95)";
      // 15 Oct 2026: tier name only. The duty percentages these traces used to carry
      // (16/52/100%) are not on record, so the drawn widths are illustrative.
      dctx.fillText(tr[0].toUpperCase(), L - 20, y + 3);
      dctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    });
  }

  // Everything on the stage that is not the 3D frame and not story-core's own
  // caption/title/cue/rail. Called once per frame, after story-core has placed
  // the title (the stats column is levelled on the title's measured rect).
  function dom(p, clock, vis) {
    /* --- the opening's right-hand numbers --- */
    // The same treatment the photometer's column gets: it rides the title's own
    // fade, and it is levelled on the title's measured rect rather than on the
    // 37% line both are nominally centred on — story-core's title fade writes a
    // pixel translateY over the title's transform every frame, which drops the
    // -50% and leaves the two a block-height apart if you trust the stylesheet.
    if (heroFrame) {
      const out = B0 - 0.012;
      let a = 1 - clamp01((p - out * 0.35) / (out * 0.65));
      heroFrame.style.opacity = (a * a).toFixed(3);
      heroFrame.style.visibility = a < 0.05 ? "hidden" : "visible";
    }
    if (statsEl && titleEl) {
      const out = B0 - 0.012;
      let a = 1 - clamp01((p - out * 0.35) / (out * 0.65));
      a = a * a;
      statsEl.style.opacity = a.toFixed(3);
      statsEl.style.visibility = a < 0.003 ? "hidden" : "visible";
      const tr = titleEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      statsEl.style.top = (tr.top - sr.top + tr.height / 2).toFixed(1) + "px";
      statsEl.style.transform = "translateY(-50%)";
    }

    /* --- act 5: the duty cycles --- */
    // The traces leave with the three tubes, not with the act. Tied to the
    // act, "HIGH 100%" was still on screen over the lifted housing of the
    // next shot after the tubes had gone back into the rack.
    const dutyLines = ramp(p, B4 - 0.02, B4 + 0.03) * (1 - ramp(p, B5 - 0.055, B5 - 0.022));
    drawDuty(dutyLines, clock, vis);
    // (17 Oct 2026) in portrait the traces run across the top band, where a phone's Skip button sits
    // (../../js/hero-mode.js): it steps aside while they are up
    const busy = dutyLines > 0.01 && duty.clientHeight > duty.clientWidth * 1.05;
    if (busy !== stage.classList.contains("hm-busy-tr")) stage.classList.toggle("hm-busy-tr", busy);

    /* --- the closing line --- */
    const endEl = document.getElementById("endline");
    if (endEl) {
      const a2 = ramp(p, B7 + 0.02, B7 + 0.055);
      endEl.style.opacity = a2.toFixed(3);
      endEl.style.visibility = a2 < 0.004 ? "hidden" : "visible";
      endEl.style.transform = "translateY(" + ((1 - a2) * 16).toFixed(1) + "px)";
    }
  }

  // story-core's configuration, shared by both modes.
  function storyConfig(draw) {
    return {
      stage: stage, track: document.querySelector(".story"), hud: document.getElementById("hud"),
      caps: CAPS, rail: true,
      title: titleEl, cue: document.getElementById("cue"),
      loader: document.getElementById("loader"), pct: document.getElementById("load-pct"),
      titleOut: B0 - 0.012,
      draw: draw,
    };
  }

  /* ------------------------------------------------------------- video mode */
  // The clip replaces the WebGL canvas. Baked into it: the 3D frame, the column
  // labels over the grid (act 04) and the part callouts of the assembly (act 07),
  // all of which follow the 3D camera, and the green curtain behind the array (its
  // composite never sets a clock, so it only changes with p). Live on top: the room
  // air, the duty-cycle traces, a slow breath; and everything in dom(p) and story-core.
  function video() {
    const player = ScrubVideo({
      stage: stage, story: document.querySelector(".story"),
      replace: [document.getElementById("gl"), document.getElementById("labels")],
      refLayers: [duty],
      data: window.HERO_CLIPS,
      overlays: ["motes"],
      // the room air's brightness, fitted to the WebGL frame (dev/hero-video)
      motes: [{ gain: 0.10 }],
    });
    const story = Story(storyConfig(function (p, clock) {
      player.draw(p, clock);
      dom(p, clock, player.visibleRef());
    }));
    player.onProgress(story.progress);
    player.onReady(story.ready);
    player.preload(window.__story.p);
    return story;
  }

  return {
    B0: B0, B1: B1, B2: B2, B3: B3, B4: B4, B5: B5, B6: B6, B7: B7,
    CAPS: CAPS, DUTY: DUTY, dom: dom, storyConfig: storyConfig, video: video,
  };
})();
