/* =============================================================================
   ReLeaf homepage: THE SCENES. The two drawings home-story.js plays: the
   reactor (#solution) and the cell (#cell). 18 Oct.
   -----------------------------------------------------------------------------
   Each scene names its time line (T0..T1), the beats where its caption
   changes, the rests (one per caption: where the play stops for reduced
   motion and where the next button goes), the camera, and a track for every
   moving part (the <g data-k> of the same name in index.html). Tracks are
   offsets from where the markup draws the part. frame() does what keyframes
   cannot: things that flow along a path, the cells' green.

   THE REACTOR (18 Oct: a painting after the design team's valley, 1200 x
   680, written by build/how-art.py; the crop on the left, the controller
   in the middle, the machine standing on the near field at the right, the
   permeate line running back through the soil). It stands whole from the
   first frame and plays:
     0     the leaf sensor reads; its reading and the forecast run to the model
     6     the index crosses the threshold; the call runs to the strip, which
           lights one LED after another; the culture goes green
     11    the cells make the protectants; the photometer reads them
     16    the pump runs the loop; the cells go round, the protectant crosses
     21    the permeate runs back along the ground and drips at the roots
     26.6  the whole machine; red light switches the cells off
   THE CELL (1200 x 760, the membrane across the top, the DNA low down):
     0     ho1 and pcyA make the pigment from heme
     5     the pigment docks in CcaS; green light switches it on
     10    a phosphate passes to CcaR; two CcaR pair
     14.4  the pair sits on the promoter; the output gene is read
     18    the ribosome makes the protectant; it leaves through the membrane
     22.6  red light; CcaS off, the pair lets go
   Every caption is in index.html; their words are the Description,
   Bioreactor and cell pages' own.
   ========================================================================== */

(function () {
  "use strict";
  var S = window.__homeScene;
  if (!S) return;
  var tr = S.track, sm = S.smooth;
  var scenes = window.__homeScenes = window.__homeScenes || {};

  // a label: fades in at tin, out at tout
  function lab(tin, tout) {
    return tr([[0, { a: 0, y: 6 }], [tin, { a: 0, y: 6 }], [tin + 0.5, { a: 1, y: 0 }, "out"], [tout - 0.4, { a: 1, y: 0 }], [tout, { a: 0, y: -4 }]]);
  }
  function frac(v) { return v - Math.floor(v); }
  // a window's fade: 0 before t0, 1 inside, 0 after t1
  function win(T, t0, t1, f) { f = f || 0.5; return sm((T - t0) / f) * (1 - sm((T - t1 + f) / f)); }
  // things that ride a path: n of them, evenly spaced, at speed (laps per unit)
  function ride(ctx, T, key, n, path, t0, t1, speed, turn, endFade) {
    var A = win(T, t0, t1, 0.6);
    for (var i = 1; i <= n; i++) {
      var f = frac((T - t0) * speed + (i - 1) / n), p = ctx.along(path, f), r = 0;
      if (turn) { var q = ctx.along(path, Math.min(1, f + 0.004)); r = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI; }
      var a = A;
      if (endFade) a *= 1 - sm((f - 0.9) / 0.1);
      a *= sm(f / 0.05);
      ctx.place(key + i, { x: p.x, y: p.y, r: r, a: T < t0 || T > t1 ? 0 : a }, T);
    }
  }

  /* ------------------------------------------------------- THE REACTOR --- */
  // One drawing, 1200 x 680, whole from the first frame, played:
  //   0     the leaf sensor reads; its reading and the forecast run to the model
  //   6     the index crosses the threshold; the call runs to the strip; green
  //   11    the cells make the protectants; the photometer reads them
  //   16    the pump runs the loop; the cells go round, the protectant crosses
  //   21    the permeate runs back along the ground to the roots
  //   26.6  the whole machine; red light switches the cells off
  // the brush-clip paint-on (build/how-art.py WIPES_ON) is off: the film
  // opens on the whole scene. Name a group here, [t0, t1], to wipe it on.
  var WIPES = {};
  function draw(t0, t1) {
    var m = t0 + (t1 - t0) * 0.6;
    return tr([[0, { a: 0, d: 0 }], [t0, { a: 0, d: 0 }], [m, { a: 1, d: 0.6 }, "out"], [t1, { a: 1, d: 1 }, "out"]]);
  }
  var R = {
    T0: 0, T1: 30,
    beats: [6, 11, 16, 21, 26.6],
    rests: [3.8, 9.2, 13.8, 18.8, 24.4, 29],
    cam: tr([
      [0, { x: 600, y: 360, w: 1240 }],
      [2.6, { x: 600, y: 360, w: 1240 }],
      [4.2, { x: 270, y: 358, w: 720 }],
      [5.6, { x: 330, y: 350, w: 740 }],
      [7.4, { x: 450, y: 320, w: 640 }],
      [9.6, { x: 700, y: 360, w: 680 }],
      [12.2, { x: 775, y: 400, w: 460 }],
      [15.4, { x: 790, y: 420, w: 480 }],
      [17.6, { x: 950, y: 362, w: 600 }],
      [20.4, { x: 990, y: 380, w: 580 }],
      [22.4, { x: 1000, y: 500, w: 640 }],
      [24.2, { x: 560, y: 540, w: 980 }, "sine"],
      [25.8, { x: 250, y: 500, w: 600 }],
      [27.4, { x: 600, y: 360, w: 1240 }],
      [30, { x: 600, y: 360, w: 1240 }]
    ], { x: 0, y: 0, w: 1 }),
    parts: {
      // 1  sense
      blink: tr([[0, { a: 0 }], [2.8, { a: 0 }], [3, { a: 1 }], [3.4, { a: 0.15 }], [3.8, { a: 1 }], [4.2, { a: 0.15 }], [4.6, { a: 1 }], [5, { a: 0.15 }], [5.4, { a: 1 }], [6.4, { a: 1 }], [7, { a: 0 }]]),
      "wire-sn": tr([[0, { d: 0, a: 1 }], [3.2, { d: 0 }], [4.4, { d: 1 }], [8.2, { d: 1, a: 1 }], [9, { a: 0.35 }]]),
      "wire-fc": tr([[0, { d: 0, a: 1 }], [3.8, { d: 0 }], [5, { d: 1 }], [8.2, { d: 1, a: 1 }], [9, { a: 0.35 }]]),
      // 2  predict, switch on
      idx: tr([[0, { d: 0 }], [6.2, { d: 0 }], [8.2, { d: 1 }, "io"]]),
      thrdot: tr([[0, { a: 0, s: 0.4 }], [7.7, { a: 0, s: 0.4 }], [8.1, { a: 1, s: 1 }, "out"], [26.8, { a: 1 }], [27.6, { a: 0 }]]),
      thr: tr([[0, { a: 0 }], [1.6, { a: 0 }], [2.1, { a: 1 }]]),
      "wire-lamp": tr([[0, { d: 0 }], [8.2, { d: 0 }], [9, { d: 1 }]]),
      beam: tr([[0, { a: 0 }], [9.6, { a: 0 }], [10.6, { a: 1 }], [26.9, { a: 1 }], [27.5, { a: 0 }]]),
      "beam-red": tr([[0, { a: 0 }], [27.2, { a: 0 }], [28, { a: 1 }]]),
      "broth-on": tr([[0, { a: 0 }], [10.2, { a: 0 }], [12, { a: 1 }], [27.4, { a: 1 }], [29, { a: 0.3 }]]),
      // 3  make
      stir: tr([[0, { r: 0 }], [9.8, { r: 0 }], [30, { r: 6400 }, "lin"]]),
      pbeam: tr([[0, { a: 0 }], [13.6, { a: 0 }], [13.9, { a: 1 }], [14.3, { a: 0.25 }], [14.7, { a: 1 }], [15.1, { a: 0.25 }], [15.5, { a: 1 }], [16.2, { a: 0 }]]),
      // 4  separate
      rotor: tr([[0, { r: 0 }], [15.8, { r: 0 }], [30, { r: 2400 }, "lin"]]),
      "flow-loop": tr([[0, { a: 0 }], [16, { a: 0 }], [16.8, { a: 1 }], [21.4, { a: 1 }], [22.2, { a: 0 }]]),
      pores: tr([[0, { a: 0 }], [17.6, { a: 0 }], [18.4, { a: 1 }], [26.6, { a: 1 }], [27.6, { a: 0.35 }]]),
      // 5  deliver
      "flow-perm": tr([[0, { a: 0 }], [21, { a: 0 }], [21.8, { a: 1 }], [26.4, { a: 1 }], [27.2, { a: 0 }]]),
      halo: tr([[0, { a: 0, s: 0.92 }], [24.6, { a: 0, s: 0.92 }], [26, { a: 1, s: 1 }, "out"]]),
      // the labels
      "lab-forecast": lab(3.4, 6.2),
      "lab-sensor": lab(2.9, 6.2),
      "lab-index": lab(6.4, 10.2),
      "lab-thr": lab(7.4, 10.2),
      "lab-strip": lab(9.4, 12.6),
      "lab-cells": lab(11.4, 16),
      "lab-prot": lab(12.6, 16),
      "lab-photo": lab(13.6, 16),
      "lab-pump": lab(16.2, 21),
      "lab-stay": lab(17.4, 21),
      "lab-membrane": lab(16.8, 21.2),
      "lab-pores": lab(17.6, 21.2),
      "lab-perm": lab(21.2, 24.4),
      "lab-roots": lab(23.6, 26.6),
      "lab-off": tr([[0, { a: 0, y: 6, s: 1.3 }], [27.3, { a: 0, y: 6 }], [27.8, { a: 1, y: 0 }, "out"]])
    },
    setup: function (ctx) {
      // the brush-shaped clips the painted groups wipe on under: the clip
      // stands off its group by its own extent (data-w) and slides home
      ctx.wipes = [];
      [].forEach.call(ctx.svg.querySelectorAll("clipPath [data-k]"), function (p) {
        var k = p.getAttribute("data-k").slice(3), t = WIPES[k];
        if (t) ctx.wipes.push({ key: "wp-" + k, axis: p.getAttribute("data-axis") || "x", w: +p.getAttribute("data-w") || 1000, t0: t[0], t1: t[1] });
      });
      ctx.leds = {
        on: [].slice.call(ctx.svg.querySelectorAll(".rw-leds--on")),
        red: [].slice.call(ctx.svg.querySelectorAll(".rw-leds--red"))
      };
      ctx.flows = {};
      [].forEach.call(ctx.svg.querySelectorAll("[data-flowel]"), function (p) {
        ctx.flows[p.getAttribute("data-flowel")] = p;
      });
    },
    frame: function (T, ctx) {
      // the paint-on
      for (var w = 0; w < ctx.wipes.length; w++) {
        var wp = ctx.wipes[w], f = 1 - Math.pow(1 - sm((T - wp.t0) / (wp.t1 - wp.t0)), 2), o = {};
        o[wp.axis] = wp.axis === "y" ? wp.w * (1 - f) : -wp.w * (1 - f);
        ctx.place(wp.key, o, T);
      }
      // the green: on from 9.4, off from 27
      var on = sm((T - 9.4) / 1.2) * (1 - sm((T - 26.9) / 0.7));
      ctx.svg.style.setProperty("--on", on.toFixed(3));
      // the strip lights one LED after another, top to bottom; red the same
      var i, g, k, c;
      for (g = 0; g < ctx.leds.on.length; g++) {
        c = ctx.leds.on[g].children;
        for (k = 0; k < c.length; k++) {
          var v = sm((T - 9.2 - k * 0.09) / 0.35) * (1 - sm((T - 26.9 - k * 0.04) / 0.4));
          c[k].style.opacity = v.toFixed(3);
        }
      }
      for (g = 0; g < ctx.leds.red.length; g++) {
        c = ctx.leds.red[g].children;
        for (k = 0; k < c.length; k++) c[k].style.opacity = sm((T - 27.2 - k * 0.07) / 0.35).toFixed(3);
      }
      // the readings run to the model, the call runs to the strip
      ride(ctx, T, "pulse", 1, "wire-sn", 3.6, 8.4, 0.5, false, true);
      ride(ctx, T, "pulseB", 1, "wire-lamp", 8.4, 9.9, 0.8, false, true);
      // what flows: dashes along the tubes, the cells round the loop, the
      // protectant across the membrane and on to the roots
      for (k in ctx.flows) ctx.flows[k].style.strokeDashoffset = (-(T * 46) % 400).toFixed(1);
      ride(ctx, T, "frod", 5, "loop", 16.2, 22, 0.1, true, true);
      ride(ctx, T, "fdot", 6, "toout", 16.6, 22.4, 0.15, false, true);
      ride(ctx, T, "pdot", 6, "perm", 21.2, 27, 0.16, false, true);
      var A = win(T, 23.4, 27, 0.5);
      for (i = 1; i <= 3; i++) {
        var f = frac((T - 23.4) * 0.9 + (i - 1) / 3);
        ctx.place("drop" + i, { x: -2 * f, y: 40 * f * f, a: A * (1 - sm((f - 0.8) / 0.2)) * sm(f / 0.1) }, T);
      }
    }
  };
  // the cells drift once the light is on; three more come as the culture
  // grows; the protectant appears among them
  for (var i = 1; i <= 6; i++) R.parts["rod" + i] = tr([[0, { b: 0 }], [10, { b: 0 }], [11.2, { b: 1 }]]);
  for (i = 7; i <= 9; i++) R.parts["rod" + i] = tr([[0, { a: 0, s: 0.3, b: 1 }], [11.6 + (i - 7) * 0.5, { a: 0, s: 0.3 }], [12.6 + (i - 7) * 0.5, { a: 1, s: 1 }, "out"]]);
  for (i = 1; i <= 7; i++) R.parts["dot" + i] = tr([[0, { a: 0, s: 0, b: 1 }], [12.2 + i * 0.36, { a: 0, s: 0 }], [13 + i * 0.36, { a: 1, s: 1 }, "out"]]);

  /* THE FILM (hosted in #dx beside the real reactor, home-reactor.js). The
     same drawing plays in the HUD; this also hands the 3D model a part to
     frame and light at each beat, so the machine itself performs:
       0     the whole machine, held square on, its strips dark: waiting
       9.2   the strips, lit green, and the culture light
       11.2  the culture vessel and the photometer beside it
       16.2  the pump and the hollow-fibre cartridge
       21.2  the product line and bottle
       26.9  the whole machine; the strips go red, then dark
     Above the film (T at its start) the model is given back to its idle
     turn and to the demand cards. */
  var SHOTS = [
    [0,    { groups: null, yaw: 0, pitch: 0.16 }],
    [9.0,  { groups: ["light", "reservoir"], fit: 1.32, yaw: 0.3, pitch: 0.1, lift: 0.08 }],
    [11.2, { groups: ["reservoir", "photometer"], fit: 1.22, yaw: -0.22, pitch: 0.12 }],
    [16.2, { groups: ["pump", "membrane"], fit: 1.42, yaw: -0.3, pitch: 0.18 }],
    [21.2, { groups: ["harvest", "line-product"], fit: 1.28, yaw: 0.28, pitch: 0.06 }],
    [26.9, { groups: null, yaw: 0, pitch: 0.16 }]
  ];
  var LIGHTS = [
    [0, "", 0], [9.2, "light", 0], [11.2, "reservoir photometer", 0], [16.2, "pump membrane", 0],
    [21.2, "harvest", 0], [26.9, "light", 0xe0533d], [29.0, "", 0]
  ];
  function pick(list, T) { var v = list[0]; for (var i = 0; i < list.length; i++) if (T >= list[i][0]) v = list[i]; return v; }
  var filmWas = { shot: null, lit: null, strips: -1, on: false };
  function film(T, ctx) {
    var rx = window.__homeRx;
    if (!rx || !rx.look) return;
    if (T <= R.T0 + 0.02) {
      if (filmWas.on) { filmWas.on = false; filmWas.shot = filmWas.lit = null; filmWas.strips = -1; rx.release(); rx.highlight([]); rx.strips(1); }
      return;
    }
    filmWas.on = true;
    var shot = pick(SHOTS, T);
    if (shot !== filmWas.shot) { filmWas.shot = shot; rx.look(shot[1]); }
    var lit = pick(LIGHTS, T);
    if (lit !== filmWas.lit) { filmWas.lit = lit; rx.highlight(lit[1], lit[2]); }
    var st = T < 9.2 ? 0.08 : T >= 29.4 ? 0.08 : 1;
    if (st !== filmWas.strips) { filmWas.strips = st; rx.strips(st); }
  }
  R.hosted = {
    T0: R.T0, T1: R.T1, beats: R.beats, rests: R.rests, cam: R.cam, parts: R.parts, setup: R.setup,
    frame: function (T, ctx) { R.frame(T, ctx); film(T, ctx); }
  };
  scenes.reactor = R;

  /* ---------------------------------------------------------- THE CELL --- */
  var C = {
    T0: 0.3, T1: 26,
    beats: [5, 10, 14.4, 18, 22.6],
    rests: [3.6, 8.8, 12.6, 16.8, 21.4, 25.4],
    cam: tr([
      [0, { x: 300, y: 390, w: 560 }],
      [2.4, { x: 330, y: 385, w: 580 }],
      [4.4, { x: 430, y: 330, w: 640 }],
      [6.6, { x: 600, y: 250, w: 560 }],
      [9.2, { x: 600, y: 220, w: 620 }],
      [11.6, { x: 610, y: 330, w: 620 }],
      [14.6, { x: 680, y: 500, w: 700 }],
      [17.4, { x: 800, y: 540, w: 640 }],
      [19.4, { x: 920, y: 390, w: 600 }],
      [22, { x: 930, y: 300, w: 640 }],
      [24.2, { x: 600, y: 390, w: 1280 }],
      [26, { x: 600, y: 390, w: 1280 }]
    ], { x: 0, y: 0, w: 1 }),
    parts: {
      heme1: tr([[0, { b: 1 }], [1.2, { b: 1 }], [2.4, { x: 182, y: 76, b: 0, s: 1 }], [2.8, { a: 0, s: 0.6 }]]),
      heme2: tr([[0, { b: 1 }]]),
      heme3: tr([[0, { b: 1 }]]),
      bv: tr([[0, { a: 0 }], [2.6, { a: 0 }], [3, { a: 1 }], [3.8, { x: 144 }], [4.2, { a: 0 }]]),
      pcb: tr([[0, { a: 0, s: 0.5 }], [4, { a: 0, s: 0.5 }], [4.4, { a: 1, s: 1 }], [6.2, { x: 52, y: -162, r: -20 }, "io"], [26, { x: 52, y: -162, r: -20 }]]),
      "beam-g": tr([[0, { a: 0 }], [7, { a: 0 }], [8, { a: 1 }], [22.6, { a: 1 }], [23.2, { a: 0 }]]),
      "ccas-on": tr([[0, { a: 0 }], [7.6, { a: 0 }], [8.6, { a: 1 }], [23.4, { a: 1 }], [24.2, { a: 0 }]]),
      phos: tr([[0, { a: 0, s: 0.4 }], [9.4, { a: 0, s: 0.4 }], [9.8, { a: 1, s: 1 }, "out"], [11, { x: -40, y: 172 }], [12.8, { x: -40, y: 172 }], [14.6, { x: 12, y: 298 }], [23.8, { x: 12, y: 298, a: 1 }], [24.4, { a: 0 }]]),
      ccar1: tr([[0, { b: 1 }], [10.6, { b: 1 }], [11.2, { b: 0 }], [12.8, { x: 0, y: 0 }], [14.6, { x: 52, y: 126 }], [23.6, { x: 52, y: 126, b: 0 }], [25, { x: -60, y: 40, b: 1 }]]),
      ccar2: tr([[0, { b: 1 }], [11.2, { b: 1 }], [12.4, { x: -130, y: -24, b: 0 }], [12.8, { x: -130, y: -24 }], [14.6, { x: -78, y: 102 }], [23.6, { x: -78, y: 102, b: 0 }], [25, { x: 40, y: 20, b: 1 }]]),
      rnap: tr([[0, { a: 0 }], [14.6, { a: 0 }], [15.2, { a: 1 }], [17.4, { x: 200 }], [17.6, { a: 1 }], [18, { a: 0 }]]),
      mrna: tr([[0, { d: 0 }], [15.2, { d: 0 }], [17.4, { d: 1 }], [17.6, { x: 0, y: 0 }], [18.6, { x: 20, y: -110 }], [22.8, { x: 20, y: -110, a: 1 }], [23.6, { a: 0 }]]),
      ribo: tr([[0, { a: 0, s: 0.6 }], [17.8, { a: 0, s: 0.6 }], [18.4, { a: 1, s: 1 }, "out"], [23.6, { a: 1 }], [24.2, { a: 0 }]]),
      chain: tr([[0, { d: 0 }], [18.6, { d: 0 }], [19.8, { d: 1 }], [20, { a: 1 }], [20.4, { a: 0 }]]),
      "beam-r": tr([[0, { a: 0 }], [22.8, { a: 0 }], [23.6, { a: 1 }]]),
      "lab-heme": lab(0.4, 2.8),
      "lab-pcb": lab(4.2, 6.8),
      "lab-ccas": lab(5.8, 12.4),
      "lab-green": lab(7.6, 11.6),
      "lab-phos": lab(9.8, 12),
      "lab-ccar": lab(10.6, 13),
      "lab-prom": lab(14.2, 16.8),
      "lab-mrna": lab(16, 18),
      "lab-ribo": lab(18.2, 21),
      "lab-prot": lab(20.6, 23.6),
      "lab-red": tr([[0, { a: 0, y: 6 }], [23.4, { a: 0, y: 6 }], [23.9, { a: 1, y: 0 }, "out"]])
    }
  };
  // three protectants, one after another: made at the ribosome, out through
  // the pore, away into the medium
  for (i = 1; i <= 3; i++) {
    var d = (i - 1) * 0.8;
    C.parts["prot" + i] = tr([[0, { a: 0, s: 0.4 }], [19.8 + d, { a: 0, s: 0.4 }], [20.3 + d, { a: 1, s: 1 }, "out"], [21.1 + d, { x: 23, y: -158 }], [21.9 + d, { x: 23 + (i - 2) * 46, y: -250, b: 0 }], [22.6 + d, { b: 1 }]]);
  }
  scenes.cell = C;
})();
