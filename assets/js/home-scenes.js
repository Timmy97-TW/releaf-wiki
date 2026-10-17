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

   THE REACTOR (one world, 1200 x 720, the field on the left, the machine on
   the right, the permeate line running back along the ground):
     0     the field in the heat; the leaf sensor and the forecast report
     5.6   the stress index rises; the green lamp comes on over the culture
     10.2  the cells make the protectant; the photometer reads them
     14.6  the loop: the pump runs the culture through the membrane; the
           cells go round, the protectant passes
     19.6  the permeate runs back to the field and drips at the roots
     24.8  the whole machine; red light switches the cells off
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
  var R = {
    T0: 0.3, T1: 28,
    beats: [5.6, 10.2, 14.6, 19.6, 24.8],
    rests: [3.8, 9, 13.2, 18, 23.4, 27.4],
    cam: tr([
      [0, { x: 230, y: 430, w: 600 }],
      [3, { x: 250, y: 420, w: 640 }],
      [5.8, { x: 390, y: 400, w: 760 }],
      [7.6, { x: 640, y: 370, w: 860 }],
      [10, { x: 735, y: 390, w: 560 }],
      [12.6, { x: 745, y: 450, w: 430 }],
      [14.8, { x: 880, y: 420, w: 640 }],
      [18.4, { x: 940, y: 420, w: 620 }],
      [20.8, { x: 760, y: 500, w: 960 }],
      [23, { x: 300, y: 480, w: 640 }],
      [25.6, { x: 590, y: 390, w: 1280 }],
      [28, { x: 590, y: 390, w: 1280 }]
    ], { x: 0, y: 0, w: 1 }),
    parts: {
      sun: tr([[0, { s: 1 }], [1.2, { s: 1.08 }], [2.4, { s: 1 }], [3.6, { s: 1.08 }], [4.8, { s: 1 }], [6, { s: 1.06 }], [7.2, { s: 1 }]]),
      heat: tr([[0, { a: 0, y: 10 }], [0.6, { a: 1, y: 0 }], [4.6, { a: 1, y: -16 }], [5.6, { a: 0, y: -22 }]]),
      cloud: tr([[0, { x: 0 }], [6, { x: 14 }, "sine"], [28, { x: 14 }]]),
      blink: tr([[0, { a: 0 }], [0.8, { a: 0 }], [1, { a: 1 }], [1.4, { a: 0.2 }], [1.8, { a: 1 }], [2.2, { a: 0.2 }], [2.6, { a: 1 }], [3, { a: 0.25 }], [3.4, { a: 1 }], [5.8, { a: 1 }], [6.2, { a: 0 }]]),
      sig1: tr([[0, { d: 0 }], [2.4, { d: 0 }], [4.4, { d: 1 }], [7.2, { d: 1, a: 1 }], [8, { a: 0 }]]),
      sig2: tr([[0, { d: 0 }], [3, { d: 0 }], [4.8, { d: 1 }], [7.2, { d: 1, a: 1 }], [8, { a: 0 }]]),
      needle: tr([[0, { r: -78 }], [4.4, { r: -78 }], [6.2, { r: 58 }, "out"], [25, { r: 58 }], [26.6, { r: -78 }]]),
      "leds-on": tr([[0, { a: 0 }], [7.2, { a: 0 }], [7.8, { a: 1 }], [25, { a: 1 }], [25.5, { a: 0 }]]),
      rays: tr([[0, { a: 0 }], [7.4, { a: 0 }], [8.4, { a: 1 }], [25, { a: 1 }], [25.6, { a: 0 }]]),
      "leds-red": tr([[0, { a: 0 }], [25, { a: 0 }], [25.5, { a: 1 }]]),
      "rays-red": tr([[0, { a: 0 }], [25.2, { a: 0 }], [26, { a: 1 }]]),
      "broth-on": tr([[0, { a: 0 }], [8.4, { a: 0 }], [10.4, { a: 1 }], [25.6, { a: 1 }], [27, { a: 0.25 }]]),
      stir: tr([[0, { r: 0 }], [8.6, { r: 0 }], [28, { r: 7000 }, "lin"]]),
      rotor: tr([[0, { r: 0 }], [14.2, { r: 0 }], [28, { r: 2600 }, "lin"]]),
      beam: tr([[0, { a: 0 }], [12, { a: 0 }], [12.3, { a: 1 }], [12.7, { a: 0.3 }], [13.1, { a: 1 }], [13.5, { a: 0.3 }], [13.9, { a: 1 }], [14.6, { a: 0 }]]),
      halo: tr([[0, { a: 0, s: 0.9 }], [22.4, { a: 0, s: 0.9 }], [23.8, { a: 1, s: 1 }, "out"]]),
      "lab-forecast": lab(1, 5.8),
      "lab-sensor": lab(0.5, 5.8),
      "lab-index": lab(4.4, 9.4),
      "lab-lamp": lab(7.2, 11.6),
      "lab-cells": lab(10.6, 14.6),
      "lab-prot": lab(11.8, 14.6),
      "lab-photo": lab(12, 14.6),
      "lab-pump": lab(14.8, 19.4),
      "lab-membrane": lab(15.2, 19.6),
      "lab-pores": lab(16, 19.6),
      "lab-stay": lab(16.4, 19.6),
      "lab-perm": lab(19.8, 23.6),
      "lab-roots": lab(21.2, 24.6),
      "lab-off": tr([[0, { a: 0, y: 6 }], [25.2, { a: 0, y: 6 }], [25.7, { a: 1, y: 0 }, "out"]])
    },
    frame: function (T, ctx) {
      var on = sm((T - 8.3) / 1.4) * (1 - 0.7 * sm((T - 25.4) / 1.2));
      ctx.svg.style.setProperty("--on", on.toFixed(3));
      ride(ctx, T, "frod", 5, "loop", 14.4, 20, 0.11, true, false);
      ride(ctx, T, "fdot", 6, "toout", 14.6, 20.2, 0.17, false, true);
      ride(ctx, T, "pdot", 6, "perm", 19.4, 24.8, 0.2, false, true);
      var A = win(T, 21, 25.2, 0.5);
      for (var i = 1; i <= 3; i++) {
        var f = frac((T - 21) * 0.9 + (i - 1) / 3);
        ctx.place("drop" + i, { x: -3 * f, y: 38 * f * f, a: A * (1 - sm((f - 0.8) / 0.2)) * sm(f / 0.1) }, T);
      }
    }
  };
  // the cells drift once the culture runs; three more come as it grows; the
  // protectant appears among them
  for (var i = 1; i <= 6; i++) R.parts["rod" + i] = tr([[0, { b: 0 }], [8.6, { b: 0 }], [9.6, { b: 1 }]]);
  for (i = 7; i <= 9; i++) R.parts["rod" + i] = tr([[0, { a: 0, s: 0.3, b: 1 }], [11 + (i - 7) * 0.45, { a: 0, s: 0.3 }], [12 + (i - 7) * 0.45, { a: 1, s: 1 }, "out"]]);
  for (i = 1; i <= 7; i++) R.parts["dot" + i] = tr([[0, { a: 0, s: 0, b: 1 }], [10.8 + i * 0.36, { a: 0, s: 0 }], [11.6 + i * 0.36, { a: 1, s: 1 }, "out"]]);
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
