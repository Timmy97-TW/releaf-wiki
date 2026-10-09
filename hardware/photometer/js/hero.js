// Photometer hero — the acts, the captions, and everything on the stage that is a
// pure function of p and is NOT the 3D frame (7 Oct 2026, for the video pass).
//
// The hero runs in one of two modes (../../js/hero-mode.js decides which):
//   video   the 3D walkthrough is a pre-rendered clip scrubbed by the scroll
//           (../../js/scrub-video.js); three.js and the models are never loaded;
//   live3d  the WebGL story in js/story.js, as before. ?live3d=1 forces it, and it is
//           what the clips are rendered from (dev/hero-video/).
// Both modes read the acts and captions from here and call dom(p) every frame, so the
// type, the readouts and the closing line are the same code whichever mode draws the
// picture. Edit a caption here and it changes in both; edit the 3D in story.js and
// re-render the clips (dev/hero-video/README.md).
window.HERO = (function () {
  "use strict";

  /* ------------------------------------------------------------------- acts */
  // Eight acts. A focus-lens beat was added between the LED and the splitter —
  // the cone leaving the emitter is wider than the cuvette, and the lens is what
  // makes it a beam — and the culture, the ratio and the bubble are one act now:
  // an opening film does not need the rejection filter.
  const A0 = 0.085,   // title
        A1 = 0.215,   // in the line
        A2 = 0.345,   // one source
        A3 = 0.470,   // the focus lens
        A4 = 0.605,   // two paths
        A5 = 0.775,   // through the culture, and the ratio
        A6 = 0.905;   // the record, then the close

  const CAPS = [
    { win: [A0, A1], n: "01", role: "Sampling", name: "In the line",
      body: "The culture never leaves the loop: it flows through a cuvette <b>0.2&nbsp;mm</b> thick and straight back to the reactor. Every reading is taken through the glass, on culture that is still moving." },
    { win: [A1, A2], n: "02", role: "Amber LED", name: "One source",
      body: "A single amber LED at <b>600&nbsp;nm</b>, the wavelength optical density is defined at, fires down the optical axis. Everything below is what happens to that one beam." },
    { win: [A2, A3], n: "03", role: "Beam conditioning", name: "Gathered into a column",
      body: "The cone leaving the emitter is wider than the cuvette it has to cross. A focusing lens gathers it, and from here down the light is one tight column." },
    { win: [A3, A4], n: "04", role: "Beamsplitter", name: "Two paths",
      body: "A 45° beamsplitter turns one beam into two. One crosses the culture. The other never meets it — it goes straight to a second sensor as a <em>reference</em>." },
    { win: [A4, A5], n: "05", role: "The measurement", name: "The ratio, not the reading",
      body: "The sample beam crosses <b>0.2&nbsp;mm</b> of flowing culture and lands on one sensor; the reference has already gone straight to the other. The instrument records the <em>ratio</em>, so anything that changes the lamp divides out of it." },
    { win: [A5, A6], n: "06", role: "The record", name: "400 hours, unattended",
      body: "<b>2,132</b> points across the run, no samples withdrawn. The dip is a recirculation pump that failed overnight — the instrument caught it because it was still reading when nobody was watching." },
  ];

  function ramp(p, a, b) { const t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }

  /* ------------------------------------------------- the culture and the lamp */
  // What the measurement act is about, as numbers: the culture's density, the lamp
  // and its one staged dip. The 3D frame (story.js) draws them and the readouts
  // below print them, so they are worked out once, here.
  function state(p) {
    /* --- density of the culture: clear at the start, milky by the record --- */
    const dens = ramp(p, A4 + 0.01, A5 - 0.02) * 0.92 + ramp(p, A5, A6) * 0.08;
    // The instrument is already running when the page opens: the seams are lit
    // in the title frame, not after a scroll. There is nothing to 'switch on'
    // in this story — it has been reading a culture for 400 hours.
    const lit = 1;
    // one dip, entirely inside act 5, ~1.4% of the track wide
    const dipC = A4 + (A5 - A4) * 0.62, dipW = 0.017;
    const dip = Math.exp(-Math.pow((p - dipC) / dipW, 2)) * ramp(p, A4 + 0.03, A4 + 0.08);
    const lamp = lit * (1 - 0.38 * dip);
    // the sample arm dims as the culture thickens: this is the measurement
    const through = 1 - 0.72 * dens;
    return { dens: dens, lit: lit, dipC: dipC, dip: dip, lamp: lamp, through: through, inBeam: 0 };
  }

  /* --------------------------------------------------------- the stage's DOM */
  const stage = document.querySelector(".story-stage");
  const statsEl = document.getElementById("stats");
  const heroFrame = document.querySelector(".hero-frame");
  const titleEl = document.getElementById("title");
  const readouts = {
    sample: document.getElementById("ro-sample"),
    ref: document.getElementById("ro-ref"),
    ratio: document.getElementById("ro-ratio"),
  };
  const endLine = document.getElementById("endline");

  // Everything on the stage that is not the 3D frame and not story-core's own
  // caption/title/cue/rail. Called once per frame, after story-core has placed
  // the title (the stats column is levelled on the title's measured rect).
  function dom(p) {
    // The right-hand stats column rides the title's own fade. Same curve as
    // story-core's title(), written once here rather than threading a second
    // element through the shared engine.
    if (heroFrame) {
      const out = A0 - 0.012;
      let a = 1 - Math.max(0, Math.min(1, (p - out * 0.35) / (out * 0.65)));
      heroFrame.style.opacity = (a * a).toFixed(3);
      heroFrame.style.visibility = a < 0.05 ? "hidden" : "visible";
    }
    if (statsEl) {
      const out = A0 - 0.012;
      let a = 1 - Math.max(0, Math.min(1, (p - out * 0.35) / (out * 0.65)));
      a = a * a;
      statsEl.style.opacity = a.toFixed(3);
      statsEl.style.visibility = a < 0.003 ? "hidden" : "visible";
      // Level with the title, measured, not assumed. The stylesheet centres
      // both blocks on the same 37% line, but story-core's title fade writes a
      // pixel translateY over the title's transform each frame — which drops
      // the -50% shift, so the title hangs from that line while the stats sat
      // centred on it, a full block-height apart. The title's rect already
      // includes its fade shift by the time draw() runs, so centring on the
      // rect keeps the two level through the fade as well.
      const tr = titleEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      statsEl.style.top = (tr.top - sr.top + tr.height / 2).toFixed(1) + "px";
      statsEl.style.transform = "translateY(-50%)";
    }

    /* --- readouts --- */
    // Anchored on the dashboard's own numbers at hour 30: sample 195.54 lx,
    // reference 26.67 lx, ratio 7.33x.
    // The readouts belong to act 5 (the ratio) and act 6 (the rejection).
    const S = state(p), lamp = S.lamp, lit = S.lit, inBeam = S.inBeam;
    const roA = ramp(p, A4 + 0.020, A4 + 0.075) * (1 - ramp(p, A5 - 0.025, A5 + 0.010));
    const refLux = 26.67 * lamp / Math.max(lit, 1e-3);
    // a bubble in the path is a clear window: the sample channel jumps
    const sampLux = 195.54 * S.through * lamp / Math.max(lit, 1e-3) * (1 + 1.05 * inBeam);
    if (roA > 0.002) {
      readouts.sample.querySelector("b").textContent = sampLux.toFixed(2);
      readouts.ref.querySelector("b").textContent = refLux.toFixed(2);
      readouts.ratio.querySelector("b").textContent = (sampLux / Math.max(refLux, 1e-3)).toFixed(2) + "×";
      const ratioA = roA * Math.max(ramp(p, S.dipC - 0.030, S.dipC - 0.008), ramp(p, A5, A5 + 0.02));
      readouts.ratio.classList.toggle("hot", S.dip > 0.25);
      readouts.ratio.classList.toggle("reject", inBeam > 0.35);
      readouts.ratio.querySelector(".k").textContent =
        inBeam > 0.35 ? "Rejected · not logged" : "Sample ÷ reference";
      readouts.sample.classList.toggle("reject", inBeam > 0.35);
      const w = stage.clientWidth, narrow = w < 760;
      function park(el, x, y, a2) {
        if (a2 <= 0.002) { el.style.opacity = "0"; el.style.visibility = "hidden"; return; }
        el.style.visibility = "visible";
        el.style.opacity = a2.toFixed(3);
        // Clamped to the frame by the box's own width. On a 390 px phone the
        // ratio box is 180 px wide and was parked at w - 165, so its right
        // third — the "÷ reference" and the border — ran off the screen.
        x = Math.min(x, w - (el.offsetWidth || 0) - (narrow ? 12 : 24));
        el.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
      }
      // reference top right, sample under it, the ratio on its own below —
      // projecting all three put them on top of each other at every framing
      park(readouts.ref, w - (narrow ? 140 : 250), narrow ? 26 : 96, roA);
      park(readouts.sample, w - (narrow ? 140 : 250), narrow ? 92 : 168, roA);
      park(readouts.ratio, w - (narrow ? 165 : 292), narrow ? 168 : 262, ratioA);
    } else {
      [readouts.sample, readouts.ref, readouts.ratio].forEach(function (el) {
        el.style.opacity = "0"; el.style.visibility = "hidden";
        el.classList.remove("reject", "hot");
      });
    }

    /* --- the closing line --- */
    if (endLine) {
      const a2 = ramp(p, A6 + 0.020, A6 + 0.055);
      endLine.style.opacity = a2.toFixed(3);
      endLine.style.visibility = a2 < 0.004 ? "hidden" : "visible";
      endLine.style.transform = "translateY(" + ((1 - a2) * 16).toFixed(1) + "px)";
    }
  }

  // story-core's configuration, shared by both modes.
  function storyConfig(draw) {
    return {
      stage: stage, track: document.querySelector(".story"), hud: document.getElementById("hud"),
      caps: CAPS, rail: true,
      title: titleEl, cue: document.getElementById("cue"),
      loader: document.getElementById("loader"), pct: document.getElementById("load-pct"),
      titleOut: A0 - 0.012,
      draw: draw,
    };
  }

  /* ------------------------------------------------------------- video mode */
  // The clip replaces the WebGL canvas. Baked into it: the 3D frame, the part
  // callouts and the record's trace (both follow the 3D camera). Live on top:
  // the aurora (canvas 2D, the same curtain the composite pass draws), the room
  // air and the beam dust (canvas 2D, projected through the clip's own camera),
  // and a slow breath. Everything in dom(p) and story-core stays as it was.
  function video() {
    const player = ScrubVideo({
      stage: stage, story: document.querySelector(".story"),
      replace: [document.getElementById("gl"), document.getElementById("curve")],
      data: window.HERO_CLIPS,
      overlays: ["aurora", "motes"],
      // the composite pass's own constants (story.js: LOOK.Composer options, AURORA)
      aurora: { col: "#ff9a3c", gamma: 1.25, exposure: 1.04, vignette: 0.40 },
      // the room air's brightness, fitted to the WebGL frame at the opening (dev/hero-video)
      motes: [{ gain: 0.10 }],
    });
    const story = Story(storyConfig(function (p, clock) {
      dom(p);
      player.draw(p, clock);
    }));
    player.onProgress(story.progress);
    player.onReady(story.ready);
    player.preload(window.__story.p);
    return story;
  }

  return {
    A0: A0, A1: A1, A2: A2, A3: A3, A4: A4, A5: A5, A6: A6,
    CAPS: CAPS, state: state, dom: dom, storyConfig: storyConfig, video: video,
  };
})();
