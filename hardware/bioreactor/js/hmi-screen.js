// Field-setup screen for the bioreactor's front panel.
//
// WHAT THIS IS: an interface *concept*. Nothing here is running software, and
// none of the values shown are measurements. It exists to answer one question a
// farmer asks — "what do I have to do to set this up?" — with four choices and
// nothing else.
//
// WHY IT IS BUILT THIS WAY: the panel is a body inside a packed, non-indexed
// 223k-triangle mesh, and the vendored three.js r128 has no CSG, so there is no
// cutting a hole in it. There does not need to be. A real panel-mount HMI is not
// a hole with a screen floating in it — it is a bezel whose flange overlaps the
// cutout, with the glass recessed behind the flange's lip. Building that shape
// gives the same read: the flange stands proud, its inner wall goes back into
// the panel, and the glass sits at the bottom of the recess. The UI plane is
// opaque, so it occludes the panel behind it and the aperture reads as a hole
// whether or not one is there.
//
// The screen is one group in the model's own (Onshape) frame, so it moves with
// the panel — including when the panel comes off.
window.HMI = (function () {
  "use strict";

  // --- geometry, in millimetres -------------------------------------------
  // Sized against the measured panel: outer face at x = -113, spanning
  // y -186..170 and z 34..532. A 268 x 178 bezel high on the panel leaves 44mm
  // of panel either side and 15mm above, which is the margin a real bezel needs
  // for its fixings.
  const APERTURE_W = 256, APERTURE_H = 160;      // the glass, 16:10
  const BEZEL_W = 292, BEZEL_H = 196;
  // The flange stands off barely more than a fingernail, and the glass sits
  // almost level with the panel skin. At 5.5mm proud the whole assembly read as
  // a monitor bolted to the front; the recess has to come from the shadow under
  // the lip and the dark gasket, not from the part sticking out.
  const PROUD = 3.6;                              // how far the flange stands off
  const GLASS_INSET = 1.6;                        // glass sits this far behind the lip
  const GASKET = 3.0;                             // dark seating ring inside the flange

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ====================================================================== */
  /* The interface                                                          */
  /* ====================================================================== */
  // Drawn at 4 px/mm so a 240mm-wide screen is 960 CSS px of artwork, then
  // supersampled. The film opens with the camera close enough that this fills a
  // 1080p frame, which is the only shot where the resolution is visible.
  // opts.stress is 0..1 on the gauge. A parameter rather than a constant
  // because the film needs the needle to MOVE: with the dial reading High from
  // the first frame the interface appears, the alarm seven seconds later is not
  // news — the screen has already given the ending away.
  function drawUI(scale, opts) {
    opts = opts || {};
    const W = Math.round(APERTURE_W * scale), H = Math.round(APERTURE_H * scale);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const S = W / 960;                          // everything below authored at 960px

    /* ---- tokens --------------------------------------------------------
       Two families, kept apart on purpose.

       ACC is the INTERFACE accent: what is selected, what is confirmed, what
       the finger is meant to touch. It appears in the header, the chosen crop,
       the batch and the confirm bar.

       ST is the STATUS ramp, and it is reserved. A status colour is only ever
       allowed to mean good / warning / serious / critical, and never to be a
       fourth decorative colour — the moment orange means "protectant" as well
       as "getting worse", neither reading survives. It appears in exactly one
       place, the stress gauge, and always beside a word: colour never carries
       the meaning on its own. These four steps are a validated set against a
       dark surface, not eyeballed.

       The screen used to be green top to bottom, which is the real problem
       underneath "add some red": if everything is the accent, nothing is. */
    const INK = "#e9f1ee", DIM = "#8a9a94", MUTE = "#5b6a65";
    const ACC = "#2ec9a8";                      // interface accent
    const WATER = "#3d8ae0";                    // the one blue, for water only
    // Three severity steps, not four. Four was tried first — green, amber,
    // orange, red — and no set of four clears the floor, because they all sit
    // on one hue arc: every amber/orange and orange/red neighbour measured a
    // perceptual distance of 10-12 where 15 is the threshold at which normal
    // colour vision can separate two adjacent fills. Four bands would have LOOKED
    // more precise while being less readable, which on a machine that tells a
    // farmer whether to treat a field is the wrong trade. Three clears it at 18.6.
    // Green and red are the pair red-green colour blindness cannot separate at
    // all, so they are also separated in LIGHTNESS (deep green, light red) —
    // that is the only channel left, and it takes the pair to 8.4 where 8 is
    // the bar. The accent moved a shade tealer for the same reason.
    const ST = { low: "#0b7a35", moderate: "#e0ad24", high: "#ff6b6b" };
    const SURF = "#0d1614", LINE = "rgba(126,163,150,.20)";
    const mono = function (px, w) { return (w || 500) + " " + px * S + "px ui-monospace, SFMono-Regular, Menlo, monospace"; };
    const sans = function (px, w) { return (w || 600) + " " + px * S + "px ui-sans-serif, -apple-system, 'Segoe UI', sans-serif"; };

    // ground
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#08100e"); bg.addColorStop(1, "#050a09");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    /* ---- header ---------------------------------------------------- */
    const HEAD = 62 * S;
    g.fillStyle = "#0a1312"; g.fillRect(0, 0, W, HEAD);
    g.strokeStyle = LINE; g.lineWidth = 1 * S;
    g.beginPath(); g.moveTo(0, HEAD - 0.5 * S); g.lineTo(W, HEAD - 0.5 * S); g.stroke();

    g.textBaseline = "middle";
    g.fillStyle = ACC; g.font = mono(18, 700);
    g.fillText("RELEAF", 26 * S, HEAD / 2);
    g.fillStyle = MUTE; g.font = mono(15, 400);
    g.fillText("FIELD SETUP", 132 * S, HEAD / 2);

    // Step counter, honest about what this screen is: four choices, then run.
    g.textAlign = "right";
    g.fillStyle = DIM; g.font = mono(13, 500);
    g.fillText("STEP 4 OF 4", W - 116 * S, HEAD / 2);
    g.textAlign = "left";
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ACC;
      const px = W - 94 * S + i * 20 * S;
      roundRectPath(g, px - 7 * S, HEAD / 2 - 2.2 * S, 14 * S, 4.4 * S, 2.2 * S);
      g.fill();
    }

    /* ---- the four cells --------------------------------------------- */
    const PAD = 14 * S, GAP = 12 * S, FOOT = 44 * S;
    const gridY = HEAD + PAD;
    const cellW = (W - PAD * 2 - GAP) / 2;
    const cellH = (H - gridY - PAD - GAP - FOOT) / 2;

    function cell(cx, cy, n, title, sub) {
      g.fillStyle = SURF;
      roundRectPath(g, cx, cy, cellW, cellH, 9 * S); g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1 * S; g.stroke();
      // A one-pixel lit top edge. Panels lit from above is what stops four flat
      // rectangles reading as four holes cut in the background.
      g.strokeStyle = "rgba(190,225,212,.07)";
      g.beginPath();
      g.moveTo(cx + 9 * S, cy + 0.5 * S); g.lineTo(cx + cellW - 9 * S, cy + 0.5 * S);
      g.stroke();

      // index chip
      g.fillStyle = "rgba(46,201,168,.13)";
      roundRectPath(g, cx + 14 * S, cy + 13 * S, 26 * S, 17 * S, 4 * S); g.fill();
      g.fillStyle = ACC; g.font = mono(12, 700);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(n, cx + 27 * S, cy + 22 * S);
      g.textAlign = "left";

      g.fillStyle = INK; g.font = sans(19, 650);
      g.textBaseline = "top";
      g.fillText(title, cx + 49 * S, cy + 12 * S);
      if (sub) {
        g.fillStyle = MUTE; g.font = mono(11.5, 400);
        g.fillText(sub, cx + 49 * S, cy + 33 * S);
      }
      return { x: cx, y: cy + 54 * S, w: cellW, h: cellH - 54 * S };
    }

    /* 01 LOCATION — a field map with the farm's parcel picked out.
       The parcels are land, not data, so they are neutral and unequal; the ONE
       parcel that answers the question wears the accent. Painting every parcel
       green — which is what this did — is the map equivalent of highlighting a
       whole page.
       They are quadrilaterals with no two edges parallel, and each has its own
       tone. Seven axis-aligned rectangles of one colour do not read as farmland;
       they read as seven UI cards, which is exactly how the first version
       looked. Fields are irregular because they follow the ground. */
    (function () {
      const b = cell(PAD, gridY, "01", "Location", "FOR WEATHER FORECAST");
      const mx = b.x + 14 * S, mw = b.w - 28 * S;
      const my = b.y, mh = b.h - 26 * S;
      g.save();
      roundRectPath(g, mx, my, mw, mh, 5 * S); g.clip();
      // Darker than the cell it sits in. At #0c1512 against a #0d1614 cell the
      // map had no edge at all, so the parcels read as boxes floating on the
      // panel rather than as fields on ground.
      g.fillStyle = "#050b09"; g.fillRect(mx, my, mw, mh);

      const P = function (u, v) { return [mx + u * mw, my + v * mh]; };
      function quad(pts) {
        g.beginPath();
        g.moveTo.apply(g, P(pts[0][0], pts[0][1]));
        for (let i = 1; i < pts.length; i++) g.lineTo.apply(g, P(pts[i][0], pts[i][1]));
        g.closePath();
      }
      // Two rows, not three. The map is only 432 x 147 authored units — a 2.9:1
      // letterbox — and a three-row layout put the bottom row under the edge.
      const parcels = [
        { q: [[.03, .06], [.30, .03], [.31, .43], [.04, .46]], t: .115 },
        { q: [[.35, .04], [.62, .07], [.63, .45], [.34, .43]], home: true },
        { q: [[.67, .05], [.97, .03], [.96, .42], [.66, .45]], t: .065 },
        { q: [[.04, .53], [.31, .50], [.29, .93], [.03, .90]], t: .075 },
        { q: [[.35, .51], [.62, .53], [.61, .95], [.33, .92]], t: .135 },
        { q: [[.66, .52], [.96, .49], [.97, .92], [.65, .95]], t: .05 }
      ];
      parcels.forEach(function (p) {
        quad(p.q);
        if (p.home) {
          g.fillStyle = "rgba(46,201,168,.22)"; g.fill();
          g.strokeStyle = "rgba(46,201,168,.85)"; g.lineWidth = 1.6 * S; g.stroke();
        } else {
          g.fillStyle = "rgba(176,199,190," + p.t + ")"; g.fill();
          g.strokeStyle = "rgba(176,199,190,.20)"; g.lineWidth = 1 * S; g.stroke();
        }
      });

      // A track between the blocks and a watercourse across them. The water gets
      // a dark casing: without it a blue line over a light parcel reads as a
      // stray stroke rather than as a channel cut through the field.
      g.strokeStyle = "rgba(176,199,190,.30)"; g.lineWidth = 2.6 * S;
      g.setLineDash([7 * S, 6 * S]);
      g.beginPath();
      g.moveTo.apply(g, P(.325, 0)); g.lineTo.apply(g, P(.335, 1));
      g.stroke();
      g.setLineDash([]);
      const river = function () {
        g.beginPath();
        g.moveTo.apply(g, P(0, .88));
        g.bezierCurveTo(mx + mw * .28, my + mh * .70, mx + mw * .58, my + mh * .82,
                        mx + mw, my + mh * .56);
      };
      river(); g.strokeStyle = "rgba(3,7,6,.85)"; g.lineWidth = 5.5 * S; g.stroke();
      river(); g.strokeStyle = WATER; g.globalAlpha = .60; g.lineWidth = 3 * S;
      g.stroke(); g.globalAlpha = 1;

      // the pin, in the home parcel
      const px = mx + .485 * mw, py = my + .245 * mh;
      g.strokeStyle = ACC; g.lineWidth = 1.5 * S;
      g.globalAlpha = .28;
      g.beginPath(); g.arc(px, py, 21 * S, 0, 7); g.stroke();
      g.globalAlpha = .72;
      g.beginPath(); g.arc(px, py, 12 * S, 0, 7); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = ACC;
      g.beginPath(); g.arc(px, py, 5 * S, 0, 7); g.fill();
      g.restore();

      // a hairline round the map so it reads as a window, not a wash
      roundRectPath(g, mx, my, mw, mh, 5 * S);
      g.strokeStyle = "rgba(176,199,190,.22)"; g.lineWidth = 1 * S; g.stroke();

      g.fillStyle = DIM; g.font = mono(12, 500); g.textBaseline = "middle";
      const cy2 = my + mh + 14 * S;
      g.fillText("23.70\u00b0 N   120.54\u00b0 E", mx + 1 * S, cy2);
      // north arrow lives out here beside the coordinates. Inside the map it
      // either sat on a parcel or fouled the corner radius, whichever corner
      // it was put in.
      const ax = mx + mw - 7 * S;
      g.fillStyle = "rgba(200,222,214,.55)";
      g.beginPath();
      g.moveTo(ax, cy2 - 7 * S); g.lineTo(ax + 4 * S, cy2 + 4 * S);
      g.lineTo(ax, cy2 + 1 * S); g.lineTo(ax - 4 * S, cy2 + 4 * S);
      g.closePath(); g.fill();
      g.font = mono(10, 700); g.textAlign = "right";
      g.fillText("N", ax - 9 * S, cy2);
      g.textAlign = "left";
    })();

    /* 02 CROP — single choice, so a radio list. The selected row carries a
       left bar as well as a filled radio and brighter type: three signals, so
       it survives being looked at from an angle in daylight. */
    (function () {
      const b = cell(PAD + cellW + GAP, gridY, "02", "Crop", "PLANTED THIS SEASON");
      const items = ["Rice", "Maize", "Tomato", "Banana"];
      const sel = 0;
      const x0 = b.x + 14 * S, w = b.w - 28 * S;
      const rowH = 33 * S, gap = 8 * S;
      const top = b.y + (b.h - (items.length * rowH + (items.length - 1) * gap)) / 2 - 4 * S;
      items.forEach(function (name, i) {
        const y = top + i * (rowH + gap), on = i === sel;
        g.fillStyle = on ? "rgba(46,201,168,.12)" : "rgba(255,255,255,.028)";
        roundRectPath(g, x0, y, w, rowH, 5 * S); g.fill();
        if (on) {
          g.strokeStyle = "rgba(46,201,168,.50)"; g.lineWidth = 1 * S; g.stroke();
          g.fillStyle = ACC;
          roundRectPath(g, x0 + 1 * S, y + 6 * S, 3 * S, rowH - 12 * S, 1.5 * S); g.fill();
        }
        g.strokeStyle = on ? ACC : "rgba(160,185,176,.36)"; g.lineWidth = 1.3 * S;
        g.beginPath(); g.arc(x0 + 22 * S, y + rowH / 2, 7 * S, 0, 7); g.stroke();
        if (on) {
          g.fillStyle = ACC;
          g.beginPath(); g.arc(x0 + 22 * S, y + rowH / 2, 3.6 * S, 0, 7); g.fill();
        }
        g.fillStyle = on ? INK : DIM; g.font = sans(16.5, on ? 650 : 500);
        g.textBaseline = "middle";
        g.fillText(name, x0 + 40 * S, y + rowH / 2 + 0.5 * S);
      });
    })();

    /* 03 CROP STRESS — the one place a status colour is allowed.
       Four discrete bands, not a continuous hue sweep: a 145-degree-to-0 sweep
       is a rainbow, it passes through a muddy olive nobody chose, and it gives
       the eye no threshold to read against. Bands give you "which band" at a
       glance, which is the actual question.
       The whole scale is drawn at low alpha and only the part up to the reading
       is lit, so the red end is always visible AS THE SCALE without the machine
       claiming a severe reading. */
    (function () {
      const b = cell(PAD, gridY + cellH + GAP, "03", "Crop stress", "FROM FIELD REPORT");
      const BANDS = [
        { c: ST.low,      label: "Low" },
        { c: ST.moderate, label: "Moderate" },
        { c: ST.high,     label: "High" }
      ];
      const N = BANDS.length;
      const VAL = opts.stress === undefined ? 0.72 : Math.max(0, Math.min(1, opts.stress));
      const band = BANDS[Math.min(N - 1, Math.floor(VAL * N))];

      const r = Math.min(b.w * .30, (b.h - 58 * S) * .94);
      const cx = b.x + b.w / 2, cy = b.y + r + 10 * S;
      // Canvas angles run clockwise from +x with y downward, so the UPPER half
      // is PI to 2PI. Sweeping PI to 0 draws the lower half, which is how this
      // gauge first came out upside down.
      const A0 = Math.PI, SPAN = Math.PI;
      const LW = 17 * S, GAPA = 0.026;           // a real gap between bands
      g.lineCap = "butt";

      // Every band at full strength. The first version lit the arc up to the
      // reading and dimmed the rest, which is a PROGRESS arc's behaviour, not a
      // gauge's — and dimming a hue against black does not read as "the same
      // colour, quieter", it reads as brown. The red band came out the colour of
      // dried mud. On a gauge the arc IS the scale and the needle IS the
      // reading; keeping the two jobs separate is what makes both legible.
      BANDS.forEach(function (bd, i) {
        const a0 = A0 + SPAN * (i / N) + (i ? GAPA : 0);
        const a1 = A0 + SPAN * ((i + 1) / N) - (i < N - 1 ? GAPA : 0);
        g.strokeStyle = bd.c; g.lineWidth = LW;
        g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
      });

      // needle, with a dark backing stroke so it stays visible crossing three
      // saturated bands
      const na = A0 + SPAN * VAL;
      const nx = cx + Math.cos(na) * (r + LW * .60), ny = cy + Math.sin(na) * (r + LW * .60);
      g.lineCap = "round";
      g.strokeStyle = "rgba(4,8,7,.85)"; g.lineWidth = 6 * S;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(nx, ny); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 2.6 * S;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(nx, ny); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(nx, ny, 3.4 * S, 0, 7); g.fill();
      g.fillStyle = SURF; g.beginPath(); g.arc(cx, cy, 8 * S, 0, 7); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2 * S; g.stroke();

      // reading: a glyph and a word, so the colour is never the only signal
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.font = sans(29, 700);
      const tw = g.measureText(band.label).width;
      const gx = cx - tw / 2 - 19 * S, gy = cy + 27 * S;
      g.fillStyle = band.c;
      g.beginPath();
      g.moveTo(gx, gy - 14 * S); g.lineTo(gx + 12.5 * S, gy + 7 * S);
      g.lineTo(gx - 12.5 * S, gy + 7 * S); g.closePath(); g.fill();
      g.fillStyle = "#0a1210"; g.font = sans(15, 800); g.textBaseline = "middle";
      g.fillText("!", gx, gy + 0.5 * S);
      g.fillStyle = band.c; g.font = sans(29, 700); g.textBaseline = "alphabetic";
      g.fillText(band.label, cx + 13 * S, cy + 36 * S);

      g.fillStyle = MUTE; g.font = mono(12, 500);
      g.textAlign = "left";  g.fillText("LOW", cx - r - LW * .5, cy + 16 * S);
      g.textAlign = "right"; g.fillText("HIGH", cx + r + LW * .5, cy + 16 * S);
      g.textAlign = "left";
    })();

    /* 04 PROTECTANT — how much this run makes. The bottle is the accent, not a
       status: more protectant is not "good" or "critical", it is just the
       quantity, and borrowing the status ramp for it would make orange mean two
       different things on one screen. */
    (function () {
      const b = cell(PAD + cellW + GAP, gridY + cellH + GAP, "04", "Protectant",
                     "BATCH TO PRODUCE");
      const bw = 64 * S, bh = b.h - 20 * S;
      const bx = b.x + 28 * S, by = b.y + 6 * S;
      const neckW = 25 * S, neckH = 15 * S, shoulder = 17 * S;
      function bottlePath() {
        g.beginPath();
        g.moveTo(bx + bw / 2 - neckW / 2, by);
        g.lineTo(bx + bw / 2 + neckW / 2, by);
        g.lineTo(bx + bw / 2 + neckW / 2, by + neckH);
        g.quadraticCurveTo(bx + bw, by + neckH + shoulder * .3, bx + bw, by + neckH + shoulder);
        g.lineTo(bx + bw, by + bh - 6 * S);
        g.quadraticCurveTo(bx + bw, by + bh, bx + bw - 6 * S, by + bh);
        g.lineTo(bx + 6 * S, by + bh);
        g.quadraticCurveTo(bx, by + bh, bx, by + bh - 6 * S);
        g.lineTo(bx, by + neckH + shoulder);
        g.quadraticCurveTo(bx, by + neckH + shoulder * .3, bx + bw / 2 - neckW / 2, by + neckH);
        g.closePath();
      }
      const FILL = 0.62;                         // illustrative
      const top = by + bh - bh * FILL;
      g.save(); bottlePath(); g.clip();
      g.fillStyle = "rgba(255,255,255,.03)"; g.fillRect(bx, by, bw, bh);
      const lg = g.createLinearGradient(0, top, 0, by + bh);
      lg.addColorStop(0, "rgba(46,201,168,.58)");
      lg.addColorStop(1, "rgba(46,201,168,.26)");
      g.fillStyle = lg; g.fillRect(bx, top, bw, bh * FILL);
      // a highlight down the left of the liquid: glass, not a filled rectangle
      const hl = g.createLinearGradient(bx, 0, bx + bw * .45, 0);
      hl.addColorStop(0, "rgba(180,252,232,.18)");
      hl.addColorStop(1, "rgba(180,252,232,0)");
      g.fillStyle = hl; g.fillRect(bx, top, bw * .45, bh * FILL);
      g.strokeStyle = "rgba(150,242,214,.9)"; g.lineWidth = 1.6 * S;
      g.beginPath(); g.moveTo(bx, top); g.lineTo(bx + bw, top); g.stroke();
      g.restore();
      bottlePath();
      g.strokeStyle = "rgba(196,222,213,.72)"; g.lineWidth = 1.6 * S; g.stroke();
      // Graduations OUTSIDE the glass. Inside, they sit on top of the liquid and
      // the fill mutes exactly the half of them that matters.
      g.strokeStyle = "rgba(196,222,213,.45)"; g.lineWidth = 1.1 * S;
      for (let i = 1; i < 5; i++) {
        const y = by + bh - (bh * i / 5);
        const len = (i % 2 ? 5 : 9) * S;
        g.beginPath(); g.moveTo(bx + bw + 3 * S, y); g.lineTo(bx + bw + 3 * S + len, y);
        g.stroke();
      }

      // the figure. Ink, not accent — the accent is already carrying the bottle,
      // and a number that wears the series colour is the commonest way a panel
      // ends up looking like a warning light.
      const tx = bx + bw + 26 * S;
      const midY = by + bh * .48;
      g.textBaseline = "alphabetic";
      g.fillStyle = INK; g.font = sans(42, 700);
      g.fillText("2.5", tx, midY);
      const nw = g.measureText("2.5").width;
      g.fillStyle = DIM; g.font = sans(19, 600);
      g.fillText("L", tx + nw + 10 * S, midY);
      g.fillStyle = MUTE; g.font = mono(11.5, 400);
      g.fillText("ESTIMATED 38 H RUN", tx, midY + 24 * S);
      g.fillText("COVERS 1.2 HA", tx, midY + 42 * S);
    })();

    /* ---- footer ------------------------------------------------------ */
    const fy = H - FOOT / 2 - 2 * S;
    g.strokeStyle = LINE; g.lineWidth = 1 * S;
    g.beginPath();
    g.moveTo(PAD, H - FOOT + 2 * S); g.lineTo(W - PAD, H - FOOT + 2 * S); g.stroke();
    g.textBaseline = "middle";
    g.fillStyle = DIM; g.font = mono(13, 500);
    g.fillText("HOLD TO CONFIRM", 26 * S, fy);
    g.fillStyle = MUTE; g.font = mono(11, 400);
    g.fillText("SETUP — NOT RUNNING", 232 * S, fy);
    const cbx = W - 262 * S, cbw = 236 * S, cbh = 18 * S;
    g.fillStyle = "rgba(255,255,255,.07)";
    roundRectPath(g, cbx, fy - cbh / 2, cbw, cbh, cbh / 2); g.fill();
    g.fillStyle = "rgba(46,201,168,.60)";
    roundRectPath(g, cbx, fy - cbh / 2, cbw * .34, cbh, cbh / 2); g.fill();

    return c;
  }

  /* ====================================================================== */
  /* The alert screen                                                       */
  /* ====================================================================== */
  // The whole glass becomes one message. This is the only state that is not a
  // panel of readings — it is the machine interrupting, and an interruption
  // that still has a header and four cells is not an interruption.
  //
  // The red is the SAME red as the gauge's top band. A second, angrier red for
  // "really serious" would break the one rule the palette has: a status colour
  // means one thing. If the gauge says High and the screen says High, they must
  // be the same colour or one of them is lying.
  function drawAlert(scale, headline, sub) {
    const W = Math.round(APERTURE_W * scale), H = Math.round(APERTURE_H * scale);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const S = W / 960;
    headline = headline || "STRESS DETECTED";
    sub = sub === undefined ? "PROTECTANT RUN STARTING" : sub;

    g.fillStyle = "#0a0403"; g.fillRect(0, 0, W, H);
    // a low wash from the middle, so the black is not flat
    const wash = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .62);
    wash.addColorStop(0, "rgba(255,107,107,.13)");
    wash.addColorStop(1, "rgba(255,107,107,0)");
    g.fillStyle = wash; g.fillRect(0, 0, W, H);

    // Letter-spaced type has to be measured and fitted, not guessed — the same
    // trap the nameplate hit, where "RELEAF · BIOREACTOR" ran off the plate and
    // read "ELEAF · BIOREACTO".
    function fit(text, px, track, maxW, weight) {
      let size = px, tr = track, total = 0;
      for (let pass = 0; pass < 26; pass++) {
        g.font = weight + " " + size + "px ui-sans-serif, -apple-system, 'Segoe UI', sans-serif";
        total = 0;
        for (let i = 0; i < text.length; i++) total += g.measureText(text[i]).width + tr;
        total -= tr;
        if (total <= maxW) break;
        size *= 0.94; tr *= 0.94;
      }
      return { total: total, size: size, tr: tr };
    }
    function draw(text, f, y, colour) {
      g.fillStyle = colour;
      let x = W / 2 - f.total / 2;
      for (let i = 0; i < text.length; i++) {
        const w = g.measureText(text[i]).width;
        g.fillText(text[i], x, y);
        x += w + f.tr;
      }
    }

    g.textBaseline = "middle"; g.textAlign = "left";
    const f = fit(headline, 92 * S, 10 * S, W * 0.84, "800");
    const midY = H * 0.47;

    // the warning triangle, on the rule above the headline
    const ty = midY - f.size * 0.92;
    g.fillStyle = "#ff6b6b";
    g.beginPath();
    g.moveTo(W / 2, ty - 17 * S);
    g.lineTo(W / 2 + 19 * S, ty + 15 * S);
    g.lineTo(W / 2 - 19 * S, ty + 15 * S);
    g.closePath(); g.fill();
    g.fillStyle = "#0a0403";
    g.font = "800 " + (22 * S) + "px ui-sans-serif, -apple-system, sans-serif";
    g.textAlign = "center";
    g.fillText("!", W / 2, ty + 4 * S);
    g.textAlign = "left";

    g.font = "800 " + f.size + "px ui-sans-serif, -apple-system, 'Segoe UI', sans-serif";
    draw(headline, f, midY, "#ff6b6b");

    if (sub) {
      const fs = fit(sub, 24 * S, 9 * S, W * 0.70, "500");
      g.font = "500 " + fs.size + "px ui-monospace, SFMono-Regular, Menlo, monospace";
      draw(sub, fs, midY + f.size * 0.78, "rgba(255,190,190,.72)");
    }

    // rules top and bottom, the width of the headline
    g.fillStyle = "rgba(255,107,107,.42)";
    g.fillRect(W / 2 - f.total / 2, midY - f.size * 0.66, f.total, 2 * S);
    g.fillRect(W / 2 - f.total / 2, midY + f.size * 0.52, f.total, 2 * S);
    return c;
  }

  // The screen at power-on: the mark alone, filling the glass. Letter-spaced
  // type has to be measured and fitted rather than guessed — at a fixed size and
  // tracking "RELEAF" runs past the edge on a narrow aperture and reads "ELEA".
  function drawBootLogo(scale) {
    const W = Math.round(APERTURE_W * scale), H = Math.round(APERTURE_H * scale);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const S = W / 960;

    g.fillStyle = "#000000"; g.fillRect(0, 0, W, H);

    function fit(text, px, track, maxW) {
      let size = px, tr = track, total = 0;
      for (let pass = 0; pass < 24; pass++) {
        g.font = "700 " + size + "px ui-sans-serif, -apple-system, 'Segoe UI', sans-serif";
        total = 0;
        for (let i = 0; i < text.length; i++) total += g.measureText(text[i]).width + tr;
        total -= tr;
        if (total <= maxW) break;
        size *= 0.94; tr *= 0.94;
      }
      return { total: total, size: size, tr: tr };
    }
    const f = fit("RELEAF", 150 * S, 26 * S, W * 0.86);
    g.textBaseline = "middle";
    g.fillStyle = "#eafff6";
    let x = W / 2 - f.total / 2;
    const midY = H * 0.46;
    for (let i = 0; i < "RELEAF".length; i++) {
      const ch = "RELEAF"[i], cw = g.measureText(ch).width;
      g.fillText(ch, x + cw / 2 - cw / 2, midY);
      x += cw + f.tr;
    }
    // rules either side of a centred subtitle
    // Bigger and heavier: at 19px on a 1280-wide texture this line is about four
    // screen pixels tall when the screen is 200px wide in frame, which is not
    // small type — it is fragmented glyphs.
    const sub = "BIOREACTOR";
    g.font = "600 " + (27 * S) + "px ui-monospace, SFMono-Regular, Menlo, monospace";
    let subW = 0;
    for (let i = 0; i < sub.length; i++) subW += g.measureText(sub[i]).width + 14 * S;
    subW -= 14 * S;
    const subY = midY + f.size * 0.62;
    g.fillStyle = "#8fd9bd";
    let sx = W / 2 - subW / 2;
    for (let i = 0; i < sub.length; i++) {
      const cw = g.measureText(sub[i]).width;
      g.fillText(sub[i], sx + cw / 2 - cw / 2, subY);
      sx += cw + 11 * S;
    }
    g.strokeStyle = "rgba(53,214,155,.55)"; g.lineWidth = 2 * S;
    const ruleY = subY, gap = subW / 2 + 26 * S;
    g.beginPath();
    g.moveTo(W / 2 - gap - 90 * S, ruleY); g.lineTo(W / 2 - gap, ruleY);
    g.moveTo(W / 2 + gap, ruleY); g.lineTo(W / 2 + gap + 90 * S, ruleY);
    g.stroke();

    // Returns the CANVAS, like drawUI and drawAlert. It used to return a
    // THREE.CanvasTexture, which made it the one function of the three that
    // could not be called on a page without three.js loaded — the flat preview
    // in dev/hmi/ draws the interface happily and threw on the mark.
    return c;
  }

  /* ====================================================================== */
  /* The hardware around it                                                 */
  /* ====================================================================== */
  // A soft dark border, transparent in the middle. Multiplied over the UI it
  // reads as the shadow the bezel's inner wall casts across the glass, which is
  // most of what tells the eye the glass is set back rather than flush.
  function innerShadowTexture() {
    const w = 512, h = Math.round(512 * APERTURE_H / APERTURE_W);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const inset = Math.round(w * 0.085);
    const grad = function (x0, y0, x1, y1) {
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, "rgba(0,0,0,.88)");
      lg.addColorStop(0.35, "rgba(0,0,0,.34)");
      lg.addColorStop(0.7, "rgba(0,0,0,.08)");
      lg.addColorStop(1, "rgba(0,0,0,0)");
      return lg;
    };
    g.fillStyle = grad(0, 0, inset, 0);            g.fillRect(0, 0, inset, h);
    g.fillStyle = grad(w, 0, w - inset, 0);        g.fillRect(w - inset, 0, inset, h);
    g.fillStyle = grad(0, 0, 0, inset);            g.fillRect(0, 0, w, inset);
    g.fillStyle = grad(0, h, 0, h - inset);        g.fillRect(0, h - inset, w, inset);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function bezelGeometry() {
    // A frame with a rectangular hole, extruded along +Z. ExtrudeGeometry gives
    // the front face, the inner wall and the back in one mesh, which is what
    // makes the aperture read as a real opening rather than a decal.
    const hw = BEZEL_W / 2, hh = BEZEL_H / 2;
    const aw = APERTURE_W / 2, ah = APERTURE_H / 2;
    const shape = new THREE.Shape();
    const r = 6;
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh); shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
    shape.lineTo(hw, hh - r);  shape.quadraticCurveTo(hw, hh, hw - r, hh);
    shape.lineTo(-hw + r, hh); shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
    shape.lineTo(-hw, -hh + r); shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    const hole = new THREE.Path();
    const hr = 3;
    hole.moveTo(-aw + hr, -ah);
    hole.lineTo(aw - hr, -ah); hole.quadraticCurveTo(aw, -ah, aw, -ah + hr);
    hole.lineTo(aw, ah - hr);  hole.quadraticCurveTo(aw, ah, aw - hr, ah);
    hole.lineTo(-aw + hr, ah); hole.quadraticCurveTo(-aw, ah, -aw, ah - hr);
    hole.lineTo(-aw, -ah + hr); hole.quadraticCurveTo(-aw, -ah, -aw + hr, -ah);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PROUD, bevelEnabled: true, bevelThickness: 0.5,
      bevelSize: 0.5, bevelSegments: 2, curveSegments: 6
    });
    geo.translate(0, 0, -PROUD);   // front face at local z = 0, body goes back
    return geo;
  }

  /**
   * Build the screen. Returns a THREE.Group in the model's own (Onshape) frame.
   *
   * opts.at        [x, y, z] Onshape, the point on the panel face it mounts to
   * opts.srgb      colour converter (RQ.srgb), so it matches the scene's pipeline
   * opts.scale     UI artwork px per mm (default 4)
   */
  // Every one of these canvases is painted artwork, so every one needs the sRGB
  // encoding — r128 has no ColorManagement and would otherwise consume the
  // pixels as linear and wash the screen out. It was written out four times;
  // once is enough, and it cannot drift.
  function tex1(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  function build(opts) {
    opts = opts || {};
    const at = opts.at || [-113, -8, 428];
    const srgb = opts.srgb || function (h) { return new THREE.Color(h); };
    const group = new THREE.Group();

    // local X = screen width, local Y = screen height, local Z = out of the
    // panel toward the viewer.
    //
    // The obvious move — makeBasis(+y, +z, -x) — is wrong: that triple is
    // LEFT-handed (its determinant is -1), so setRotationFromMatrix produces
    // nonsense and the screen ends up standing perpendicular to the panel like
    // a flag. On a face whose outward normal is -x, a right-handed frame with
    // height on +z must put width on -y. That is the same transform the
    // nameplate uses, and it is not mirrored: the camera looks along +x, where
    // screen-right is decreasing CAD y, so width on -y runs left-to-right on
    // screen exactly as the artwork is drawn.
    //
    // R = Rx(90) . Ry(-90), which three.js writes as this Euler in XYZ order.
    group.rotation.set(Math.PI / 2, -Math.PI / 2, 0);
    group.position.set(at[0], at[1], at[2]);

    // --- bezel: machined dark metal, the one part that catches an edge light
    const bezelMat = new THREE.MeshPhysicalMaterial({
      color: srgb(0x23262a), metalness: 0.78, roughness: 0.34,
      clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 1.0
    });
    const bezel = new THREE.Mesh(bezelGeometry(), bezelMat);
    bezel.position.z = PROUD;
    group.add(bezel);

    // No visible fixings. Four screw heads sat 0.15mm proud of the flange face,
    // which is inside depth-buffer precision at this camera range, so they
    // flickered against the bezel every frame. A flush bezel of this kind is
    // bonded or clipped from behind anyway, and dropping them costs nothing:
    // the groove and the gasket already stop it reading as a decal.

    // A dark seating ring between the flange and the glass. On a real flush
    // bezel this is the gasket the glass beds onto; here it also does the work
    // the shallow lip no longer can, giving the aperture a black edge so the
    // glass reads as sitting down inside the panel rather than on top of it.
    const gasketShape = new THREE.Shape();
    const gw = APERTURE_W / 2 + GASKET, gh = APERTURE_H / 2 + GASKET;
    gasketShape.moveTo(-gw, -gh); gasketShape.lineTo(gw, -gh);
    gasketShape.lineTo(gw, gh);   gasketShape.lineTo(-gw, gh);
    const gasketHole = new THREE.Path();
    const aw2 = APERTURE_W / 2, ah2 = APERTURE_H / 2;
    gasketHole.moveTo(-aw2, -ah2); gasketHole.lineTo(aw2, -ah2);
    gasketHole.lineTo(aw2, ah2);   gasketHole.lineTo(-aw2, ah2);
    gasketShape.holes.push(gasketHole);
    const gasket = new THREE.Mesh(
      new THREE.ShapeGeometry(gasketShape),
      new THREE.MeshPhysicalMaterial({
        color: srgb(0x080a0b), metalness: 0.1, roughness: 0.85,
        envMapIntensity: 0.25,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
      }));
    gasket.position.z = PROUD - GLASS_INSET - 0.15;
    group.add(gasket);

    // A hairline groove around the flange — the parting line of a machined
    // bezel, and the thing that catches an edge light at a glancing angle.
    const grooveShape = new THREE.Shape();
    const rw = BEZEL_W / 2 - 4.5, rh = BEZEL_H / 2 - 4.5;
    grooveShape.moveTo(-rw, -rh); grooveShape.lineTo(rw, -rh);
    grooveShape.lineTo(rw, rh);   grooveShape.lineTo(-rw, rh);
    const grooveHole = new THREE.Path();
    const iw = rw - 0.7, ih = rh - 0.7;
    grooveHole.moveTo(-iw, -ih); grooveHole.lineTo(iw, -ih);
    grooveHole.lineTo(iw, ih);   grooveHole.lineTo(-iw, ih);
    grooveShape.holes.push(grooveHole);
    const groove = new THREE.Mesh(
      new THREE.ShapeGeometry(grooveShape),
      new THREE.MeshPhysicalMaterial({
        color: srgb(0x0d0f11), metalness: 0.6, roughness: 0.5, envMapIntensity: 0.5
      }));
    groove.position.z = PROUD + 0.02;
    group.add(groove);

    // Status LED, bottom-right of the flange. Unlit geometry so it keeps its
    // own colour through the tone curve, the way a real indicator does.
    const ledMat = new THREE.MeshBasicMaterial({ color: srgb(0x3ef0a4), toneMapped: false });
    const led = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), ledMat);
    led.position.set(BEZEL_W / 2 - 22, -BEZEL_H / 2 + 6.5, PROUD + 0.05);
    group.add(led);

    // Three capacitive marks below the aperture — the only controls on the
    // face, and what tells you the glass is meant to be touched.
    const capMat = new THREE.MeshPhysicalMaterial({
      color: srgb(0x14171a), metalness: 0.5, roughness: 0.6, envMapIntensity: 0.6
    });
    [-16, 0, 16].forEach(function (dx) {
      const m = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 24), capMat);
      m.position.set(dx, -BEZEL_H / 2 + 6.5, PROUD + 0.04);
      group.add(m);
    });

    // A dark ring just inside the aperture. The flange's own inner wall is only
    // PROUD deep, which at a distance is too subtle to read as a recess; this
    // is the shadow that wall would cast on the glass.
    const shade = new THREE.Mesh(
      new THREE.PlaneGeometry(APERTURE_W, APERTURE_H),
      new THREE.MeshBasicMaterial({
        map: innerShadowTexture(), transparent: true, depthWrite: false,
        toneMapped: false, opacity: 0.95,
        polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -14
      }));
    shade.position.z = PROUD - GLASS_INSET + 0.05;
    shade.renderOrder = 4;
    group.add(shade);

    // --- the UI itself, self-lit like the nameplate so it keeps its own whites
    // `let`, not `const`: redrawUI below replaces it, and setScreen compares
    // against it every frame. Left as a const, every redraw was reverted on the
    // very next frame — the needle was being redrawn 23 times and put back 23
    // times, and the dial never moved.
    // `let`, not `const`: redrawUI replaces it and setScreen compares against it
    // every frame. As a const, every redraw was reverted on the very next frame
    // and the dial never moved.
    let tex = tex1(drawUI(opts.scale || 4));
    // The panel face is only ~1.9mm behind this, and at the camera distances the
    // film uses the depth buffer cannot separate them — the panel's vent slots
    // came through the artwork. A depth bias resolves it without pushing the
    // whole assembly further off the panel, which is the thing being avoided.
    const uiMat = new THREE.MeshBasicMaterial({
      map: tex, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12
    });
    const ui = new THREE.Mesh(new THREE.PlaneGeometry(APERTURE_W, APERTURE_H), uiMat);
    ui.position.z = PROUD - GLASS_INSET - 0.35;
    group.add(ui);

    // --- cover glass: adds the reflection that stops it looking like a decal
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: srgb(0x0a0e0d), metalness: 0, roughness: 0.045,
      transmission: 0.0, transparent: true, opacity: 0.10,
      clearcoat: 1, clearcoatRoughness: 0.02,
      envMapIntensity: 1.25, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16
    });
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(APERTURE_W + 0.6, APERTURE_H + 0.6), glassMat);
    glass.position.z = PROUD - GLASS_INSET;
    glass.renderOrder = 3;
    group.add(glass);

    const bootTex = tex1(drawBootLogo(opts.scale || 4));
    let alertTex = null;                        // built on first use, not on load

    // Power state. The UI plane is a MeshBasicMaterial, so material.color
    // multiplies the map — setting it to a scalar is a brightness control that
    // costs nothing and reaches true black, which an opacity fade would not
    // (an opacity fade would show the panel behind the glass).
    // modes: "ui" | "boot" | "alert" | "off"
    group.userData.setScreen = function (mode, brightness) {
      if (mode === "alert" && !alertTex) {
        alertTex = tex1(drawAlert(opts.scale || 4));
      }
      const want = mode === "boot" ? bootTex : (mode === "alert" ? alertTex : tex);
      if (uiMat.map !== want) { uiMat.map = want; uiMat.needsUpdate = true; }
      if (mode === "off") brightness = 0;
      const v = Math.max(0, brightness === undefined ? 1 : brightness);
      uiMat.color.setScalar(v);
      // the indicator comes up with the screen
      ledMat.color.copy(srgb(0x3ef0a4)).multiplyScalar(Math.min(1, v * 1.2));
    };
    group.userData.bootTexture = bootTex;
    group.userData.uiTexture = tex;
    group.userData.redrawUI = function (scale, o) {
      const n = tex1(drawUI(scale || opts.scale || 4, o));
      tex.dispose();                      // the old one is now unreferenced
      tex = n;                            // so setScreen keeps showing this one
      if (uiMat.map !== bootTex && uiMat.map !== alertTex) {
        uiMat.map = tex; uiMat.needsUpdate = true;
      }
    };
    return group;
  }

  // Where the four cells sit on the glass, in the screen group's own local mm
  // (+x right, +y up, origin at the aperture centre) — which is exactly the
  // frame the UI plane is built in, so a caller can localToWorld() these and
  // get a point on the artwork.
  //
  // Derived from the SAME constants drawUI lays out with rather than measured
  // off a screenshot: a callout that drifts two cells away after a padding
  // tweak is worse than no callout.
  const CELLS = (function () {
    const AW = 960, AH = 600;                  // drawUI's authoring space
    const HEAD = 62, PAD = 14, GAP = 12, FOOT = 44;
    const gridY = HEAD + PAD;
    const cw = (AW - PAD * 2 - GAP) / 2;
    const ch = (AH - gridY - PAD - GAP - FOOT) / 2;
    const at = function (col, row) {
      const px = PAD + col * (cw + GAP) + cw / 2;
      const py = gridY + row * (ch + GAP) + ch / 2;
      return [(px / AW) * APERTURE_W - APERTURE_W / 2,
              APERTURE_H / 2 - (py / AH) * APERTURE_H,
              (cw / AW) * APERTURE_W, (ch / AH) * APERTURE_H];
    };
    // `title` is the word already printed in the cell. `note` is what the film's
    // callout says instead — a callout that repeats the label it points at
    // tells a viewer nothing they cannot already read.
    return [
      // dx/dy are fractions of the cell, from its centre
      { n: "01", title: "Location",    note: "Where the farm is",       at: at(0, 0) },
      { n: "02", title: "Crop",        note: "What is planted",         at: at(1, 0) },
      { n: "03", title: "Crop stress", note: "How stressed the crop is", at: at(0, 1) },
      { n: "04", title: "Protectant",  note: "How much it makes",       at: at(1, 1) }
    ];
  })();

  return { build: build, drawUI: drawUI, drawBootLogo: drawBootLogo,
           drawAlert: drawAlert, CELLS: CELLS,
           APERTURE: [APERTURE_W, APERTURE_H], BEZEL: [BEZEL_W, BEZEL_H] };
})();
