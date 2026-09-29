/* =============================================================================
   VISION: "Every farmer a biomanufacturer." One becomes many.

   Replaces home.js piece 7 ("the dose runs"), which drove the two old vision
   schematics. It only needs window.__homeFrame, which only home.js creates,
   so it loads after home.js; without it this returns at once and the section
   stays the finished <img>.

   What it does, in order:
     1. When the section is within a screen and a half, fetches the drawing's
        layers (the JSON made by build/vision-valley.py from the same geometry
        as the <img>) and builds them. Until then, and if anything fails, the
        reader sees the <img>: the finished frame, complete on its own.
     2. Only then, and only while the section is still below the screen, it
        arms the section (.is-live): the stage becomes sticky inside a runway
        one screen longer than the stage. Arming changes the page's height, so
        it never happens where the reader can see it; a reader who arrives
        in the middle of the section (a link, the chapters rail) gets the
        finished frame, and the drawing arms the next time the section is
        below them.
     3. Draws the right frame on a canvas over the <img>, then shows it
        (.is-ready). On every scroll frame while the run is on screen (read()
        checks, from the one rectangle it reads anyway): the
        camera goes from the first farm to the whole valley; each farm lights
        a moment after it comes into the frame, with one brighter swell as it
        comes on; first light comes up as more of them are lit; the dose runs
        down the first farm's rows with the scroll; the line lands as the last
        farms light, and its full stop lights last (.is-lit). Once the frame
        has stopped changing, scrolling redraws nothing.
     4. FIREFLIES. The reactors' glows are drawn on a second canvas, over the
        first. While the section is on screen and the tab is visible, a slow
        loop (about 30 frames a second, 20 on a phone; glows only: a hundred
        and sixty small images) lets each lit reactor's glow flash now and then, out of step
        with its neighbours, quickly up and slowly down. The reactor itself
        stays lit: only the light around it moves. The loop stops when the
        section leaves the screen or the tab is hidden.

   WHY A CANVAS. The drawing is about three thousand shapes. As SVG, moving
   the camera re-rasterises all of them every frame; drawn from cached Path2D
   objects on one canvas it is a few hundred fill calls.

   THE RESTING STATE IS THE FINISHED STATE. With reduced motion this returns
   before touching anything, so the <img> stays (and if reduced motion is
   switched on later, the fireflies stop). read() never throws (a throw
   there would stop every other scroll job on the page), and neither does
   write(): a failure in the drawing puts the <img> back and stops.
   ========================================================================== */

(function () {
  "use strict";

  var sec = document.getElementById("vision");
  var run = document.getElementById("vl-run");
  var stage = document.getElementById("vl-stage");
  var frame = window.__homeFrame;
  if (!sec || !run || !stage || !frame) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var img = stage.querySelector(".vl-img");
  var sky = stage.querySelector(".vl-sky");
  var line = stage.querySelector(".vl-line");
  var gloss = stage.querySelector(".vl-gloss");
  var label = stage.querySelector(".vl-rx");
  var src = stage.getAttribute("data-live");
  if (!img || !sky || !line || !gloss || !src || !window.fetch || !window.Path2D || !("IntersectionObserver" in window)) return;
  var cv = document.createElement("canvas");
  var ctx = cv.getContext && cv.getContext("2d");
  if (!ctx) return;
  cv.className = "vl-canvas";
  cv.setAttribute("aria-hidden", "true");
  // the glows, on their own canvas so the fireflies never redraw the valley
  var cg = document.createElement("canvas");
  var gtx = cg.getContext("2d");
  if (!gtx) return;
  cg.className = "vl-canvas vl-glows";
  cg.setAttribute("aria-hidden", "true");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var span = function (v, a, b) { return clamp01((v - a) / (b - a)); };
  var ease = function (t) { return t * t * (3 - 2 * t); };

  // the camera's schedule, as fractions of the runway
  var ZOOM_FROM = 0.02, ZOOM_TO = 0.6;    // pull back between these
  var FIRST_LIGHT = 0.07;                 // the neighbours wait this long
  var LAST_LIGHT = 0.61;                  // every farm is lit by here, and the
                                          // line has landed by 0.65, so it holds
                                          // for the last 35 % of the runway
  var FADE = 0.04;                        // how long one farm takes to light
  var LAND = 0.07;                        // the line takes this long to land,
  var LAND_LEAD = 0.03;                   // starting this far before the last
                                          // farm is lit; then it holds
  var DARK = 0.18;                        // how much first light there is
                                          // before any farm but the first is lit
  var LABEL_OUT = [0.02, 0.1];            // the reactor's label leaves as the
                                          // pull-back starts
  var OPEN = 0.105, OPEN_TALL = 0.075;   // at the start the first reactor
                                          // stands about this share of the frame
                                          // tall, so its farm is round it: its
                                          // house, its palms and its field
  // A phone is scrolled by flicks, not a wheel: the same schedule would keep
  // the line dark for most of the runway and hold it for barely a flick.
  // Below 640px the pull-back and the last farm come a little sooner still,
  // so the line has landed by 0.6 and holds for the last two fifths.
  var ZOOM_TO_PHONE = 0.52, LAST_LIGHT_PHONE = 0.56;

  // the fireflies: once every 6 to 14 seconds, at its own time, each lit
  // reactor's glow flashes: up in RISE seconds, back down over FALL. GLOW_REST
  // is how bright a glow is between flashes, as a share of full; a flash takes
  // it to full and makes it GROW wider. The first farm flashes the same way,
  // at half the depth, since in the opening frame its glow is large.
  var RISE = 0.3, FALL = 1.1, GLOW_REST = 0.66, GROW = 0.38;
  function zoomTo(v) { return v.sw < 640 ? ZOOM_TO_PHONE : ZOOM_TO; }
  function lastLight(v) { return v.sw < 640 ? LAST_LIGHT_PHONE : LAST_LIGHT; }

  var V = null, farms = [], props = [], clouds = [], hero = null, lastT = LAST_LIGHT, pStill = 1;
  var size = null, sizeDirty = true, navTop = 0, lastKey = "";
  var armed = false, ready = false, dead = false, lit = false;
  var grads = {}, sprite = null, dpr = 1, gdpr = 1, dawnRGB = {};
  var G = null, glowAt = 0, onScreen = false, looping = false;

  /* ---- the camera ----
     The finished frame. The width follows the screen's shape: a wide screen
     holds the whole valley; a tall one (a phone) holds half of it, and gives
     the extra height to the sky instead of cropping the valley to its middle
     third. The horizon always sits well below the words, so the sentence
     under the line reads on open sky, not on the hills.
     No lit cloud runs behind the words: if a streak would, the camera pulls
     back a little further (on a tall screen that lowers the whole drawing,
     cloud and all) until the streak sits CLEAR px under the sentence. The
     static <img> follows the same rule in home-vision.css. Only a window
     close to square can run out of drawing first; there, that streak is left
     out. */
  var CLEAR = 36, CLEAR_UP = 8;
  function frameAt(wu, sw, sh, textBottom) {
    var W = V.vb[0], foot = V.vb[1];
    var k = sw / wu, hu = sh / k;
    var hz = Math.min(0.72 * sh, Math.max(0.4 * sh, textBottom + 72));
    var y = V.hy - hz / k;
    if (y > foot - hu) y = foot - hu;              // never below the drawing's foot
    if (y < V.view.top) y = V.view.top;            // never above its sky
    return { k: k, x: (W - wu) / 2, y: y, w: wu, h: hu, sw: sw, sh: sh, skip: null };
  }
  // the streaks of lit cloud that would sit behind the words (t: their box)
  function behindWords(v, t) {
    return clouds.filter(function (e) {
      var l = (e.x0 - v.x) * v.k, r = (e.x1 - v.x) * v.k, top = (e.y0 - v.y) * v.k, bot = (e.y1 - v.y) * v.k;
      return r > t.l - CLEAR_UP && l < t.r + CLEAR_UP && bot > t.t - CLEAR_UP && top < t.b + CLEAR;
    });
  }
  function view(sw, sh, t) {
    var W = V.vb[0];
    var wu = W * Math.pow(Math.min(1, (sw / sh) / 1.2), 0.95);
    var v = frameAt(wu, sw, sh, t.b), hit = behindWords(v, t);
    while (hit.length && wu < W) {
      wu = Math.min(W, wu * 1.01);
      v = frameAt(wu, sw, sh, t.b); hit = behindWords(v, t);
    }
    if (hit.length) v.skip = hit;
    return v;
  }
  function camera(p, v) {
    var e = ease(span(p, ZOOM_FROM, zoomTo(v)));
    // close enough that the first reactor stands about a tenth of the frame
    // tall (an upright frame, a phone's or a tablet's, is narrow, so a little
    // less there), with its house, its palms and its field around it
    var tall = v.sw < v.sh;
    var z0 = Math.max(1.5, (tall ? OPEN_TALL : OPEN) * v.sh / (hero.s * v.k));
    var z = Math.pow(z0, 1 - e);
    // where that reactor sits at the start: a little below the middle, with
    // its farmhouse up to the left and its field to the right. Left of centre
    // on a wide screen; right of it in an upright frame, whose narrow width
    // would otherwise lose the house. High enough that it is on screen, whole,
    // while the words above the drawing are still being read.
    var ay = tall ? 0.5 : 0.46 + 0.04 * clamp01((v.sh - 730) / 100);   // a little higher on a short laptop
    var ax0 = v.x + (tall ? 0.55 : 0.44) * v.w, ay0 = v.y + ay * v.h;
    return { z: z, ax: ax0 + (hero.x - ax0) * e, ay: ay0 + (hero.y - ay0) * e };
  }
  // a farm lights a moment after it comes into the frame; the ones that
  // never do light near the end
  function thresholds(v) {
    var m = 0.03, lo = v.x + m * v.w, hi = v.x + (1 - m) * v.w, top = v.y + m * v.h, bot = v.y + (1 - m) * v.h;
    var samples = [], LL = lastLight(v);
    for (var p = 0; p <= 1.0001; p += 0.004) samples.push({ p: p, c: camera(p, v) });
    lastT = 0;
    farms.forEach(function (f, i) {
      if (f.hero) { f.t = -1; return; }
      var jit = ((i * 2654435761) % 1000) / 1000;         // steady per farm
      var pe = -1;
      for (var s = 0; s < samples.length; s++) {
        var c = samples[s].c;
        var x = c.ax + (f.x - hero.x) * c.z, y = c.ay + (f.y - hero.y) * c.z;
        if (x > lo && x < hi && y > top && y < bot) { pe = samples[s].p; break; }
      }
      var t = pe < 0 ? LL - 0.1 + jit * 0.08 : pe + 0.03 + jit * 0.05;
      f.t = Math.min(LL - FADE, Math.max(FIRST_LIGHT + jit * 0.04, t));
      if (f.t + FADE > lastT) lastT = f.t + FADE;
      // each farm's own firefly: its period, and where in it the farm starts
      f.per = 6 + ((i * 7919) % 1000) / 1000 * 8;
      f.ph = ((i * 104729) % 1000) / 1000;
    });
    // past this the frame no longer changes: the camera has stopped, every
    // farm is lit, the line has landed and its full stop is lit
    pStill = Math.min(1, Math.max(zoomTo(v), lastT, lastT - LAND_LEAD + LAND + 0.02));
  }
  function landAt(p) { return ease(span(p, lastT - LAND_LEAD, lastT - LAND_LEAD + LAND)); }

  /* ---- colour ---- */
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mixed(a, b, t) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," +
      Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }
  var VON, VOFF;
  function stops(g, list) {
    list.forEach(function (s) {
      var c = rgb(s[1]);
      g.addColorStop(s[0], "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + s[2] + ")");
    });
    return g;
  }
  // a fill that changes with first light (the far ranges, the hills, the floor)
  function fillAt(key, dawn) {
    var d = dawnRGB[key];
    return d ? mixed(d[0], d[1], dawn) : (V.c[key] || key);
  }

  /* ---- taking the data ---- */
  function build(data) {
    V = data;
    if (!V.view) V.view = { top: 0, h: 1000 };
    V.layers.forEach(function (l) {
      if (l.d) l.path = new Path2D(l.d);
      if (l.k === "grad" || l.k === "light") l.grad = stops(ctx.createLinearGradient(0, l.y, 0, l.y + l.h), V.g[l.g]);
      if (l.k === "lightfill") {
        // a streak is a few flat ellipses, each written "Mx y a rx ry 0 1 0 ..."
        // from its left end (build/vision-valley.py, cloud())
        l.ells = [];
        var re = /M(-?[\d.]+) (-?[\d.]+)a([\d.]+) ([\d.]+) /g, m;
        while ((m = re.exec(l.d))) {
          var x = +m[1], y = +m[2], rx = +m[3], ry = +m[4];
          var e = { cx: x + rx, cy: y, rx: rx, ry: ry, x0: x, x1: x + 2 * rx, y0: y - ry, y1: y + ry };
          l.ells.push(e); clouds.push(e);
        }
      }
    });
    Object.keys(V.glyphs).forEach(function (k) {
      V.glyphs[k].forEach(function (part) { part.path = new Path2D(part.d); });
    });
    V.farms.forEach(function (r) {
      var f = { x: r[0], y: r[1], s: r[2], typ: r[3], hero: !!r[4], hdr: r[5] ? new Path2D(r[5]) : null, t: 0, a: 1 };
      if (f.hero) hero = f;
      farms.push(f);
    });
    if (!hero) return false;
    V.props.forEach(function (r) {
      props.push(r[0] === "r" ? { farm: farms[r[1]] }
        : { g: V.glyphs[r[0]], x: r[1], y: r[2], s: r[3], flip: !!r[4], col: r[5] });
    });
    VON = rgb(V.c.vessel); VOFF = rgb(V.c.vesselOff);
    Object.keys(V.cD || {}).forEach(function (k) {
      if (V.c[k]) dawnRGB[k] = [rgb(V.c[k]), rgb(V.cD[k])];
    });
    var skyTop = V.sky.y, skyBot = V.hy + 2;
    grads.sky = stops(ctx.createLinearGradient(0, skyTop, 0, skyBot), V.g.sky);
    grads.dawn = stops(ctx.createLinearGradient(0, skyTop, 0, skyBot), V.g.dawn);
    // the sunrise glow is an ellipse: a round gradient drawn in squashed space
    grads.sun = stops(ctx.createRadialGradient(0, 0, 0, 0, 0, V.sun.rx), V.g.sun);
    // and the water mirrors all three, flipped about the horizon
    grads.wn = stops(ctx.createLinearGradient(0, V.water.y0, 0, V.water.y1), V.g.wnight);
    grads.wd = stops(ctx.createLinearGradient(0, V.water.y0, 0, V.water.y1), V.g.wdawn);
    // (the sun's reflection is an ellipse too; a pattern can carry the
    // squash where a gradient cannot, so it is painted once and reused)
    grads.ws = sunPattern();
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = 128;
    var sc = sprite.getContext("2d");
    sc.fillStyle = stops(sc.createRadialGradient(64, 64, 0, 64, 64, 64), V.g.glow);
    sc.fillRect(0, 0, 128, 128);
    return true;
  }

  function sunPattern() {
    if (!window.DOMMatrix) return null;
    var n = 256, pc = document.createElement("canvas");
    pc.width = pc.height = n;
    var g = pc.getContext("2d");
    g.fillStyle = stops(g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2), V.g.wsun);
    g.fillRect(0, 0, n, n);
    var pat = ctx.createPattern(pc, "no-repeat");
    if (!pat || !pat.setTransform) return null;
    // the n-pixel square onto the ellipse's box, in drawing units
    var sx = 2 * V.sun.rx / n, sy = 2 * V.sun.ry / n;
    pat.setTransform(new DOMMatrix([sx, 0, 0, sy, V.sun.cx - V.sun.rx, V.water.cy - V.sun.ry]));
    return pat;
  }

  // m: what read() measured (stage size, where the words end, the sticky top)
  function resize(m) {
    dpr = Math.min(window.devicePixelRatio || 1, m.sw < 640 ? 1.5 : 2);
    cv.width = Math.round(m.sw * dpr); cv.height = Math.round(m.sh * dpr);
    // the glows are soft, so their canvas needs no more than one pixel per
    // CSS pixel: a quarter of the work, and of the memory, on a 2x screen
    gdpr = Math.min(dpr, 1);
    cg.width = Math.round(m.sw * gdpr); cg.height = Math.round(m.sh * gdpr);
    size = view(m.sw, m.sh, m.t);
    thresholds(size);
    navTop = m.navTop;
  }

  /* ---- drawing ---- */
  function draw(p) {
    var v = size, c = camera(p, v), S = v.k * c.z;
    var ox = v.k * (c.ax - hero.x * c.z - v.x), oy = v.k * (c.ay - hero.y * c.z - v.y);
    var u = 1 / S;                                   // one screen pixel, in drawing units
    var x0 = -ox / S, y0 = -oy / S, x1 = (v.sw - ox) / S, y1 = (v.sh - oy) / S;
    var near = clamp01((c.z - 1.6) / 3);
    var i, f, q, share = 0;
    for (i = 0; i < farms.length; i++) {
      f = farms[i];
      f.a = f.hero ? 1 : clamp01((p - f.t) / FADE);
      share += f.a;
    }
    share /= farms.length;
    var dawn = DARK + (1 - DARK) * ease(share);
    var D = dpr * S, DX = dpr * ox, DY = dpr * oy;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#070b09";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(D, 0, 0, D, DX, DY);
    ctx.lineCap = "butt"; ctx.lineJoin = "round";

    function glyph(parts, x, y, sx, sy, fillOwn, vessel) {
      ctx.setTransform(D * sx, 0, 0, D * sy, D * x + DX, D * y + DY);
      var lw = u / Math.abs(sy);
      for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (part.v) { ctx.fillStyle = vessel; ctx.fill(part.path); continue; }
        if (part.w) { ctx.fillStyle = V.c.window; ctx.fill(part.path); continue; }
        if (part.fill) { ctx.fillStyle = part.fill === "$" ? fillOwn : V.c[part.fill]; ctx.fill(part.path); }
        if (part.stroke) { ctx.strokeStyle = V.c[part.stroke]; ctx.lineWidth = lw; ctx.stroke(part.path); }
      }
    }

    V.layers.forEach(function (l) {
      if (l.k !== "sun") ctx.setTransform(D, 0, 0, D, DX, DY);
      switch (l.k) {
        case "sky":
          ctx.fillStyle = grads.sky; ctx.fillRect(V.sky.x, V.sky.y, V.sky.w, V.sky.h); break;
        case "stars":
          ctx.globalAlpha = l.a * (1 - V.starFade * dawn); ctx.fillStyle = "#ffffff"; ctx.fill(l.path);
          ctx.globalAlpha = 1; break;
        case "dawn":
          ctx.globalAlpha = dawn; ctx.fillStyle = grads.dawn; ctx.fillRect(V.sky.x, V.sky.y, V.sky.w, V.sky.h);
          ctx.globalAlpha = 1; break;
        case "sun":
          ctx.save(); ctx.globalAlpha = dawn;
          ctx.translate(V.sun.cx, V.sun.cy); ctx.scale(1, V.sun.ry / V.sun.rx);
          ctx.fillStyle = grads.sun; ctx.fillRect(-V.sun.rx, -V.sun.rx, 2 * V.sun.rx, 2 * V.sun.rx);
          ctx.restore(); break;
        case "grad":
          ctx.fillStyle = l.grad; ctx.fillRect(l.x, l.y, l.w, l.h); break;
        case "light":
          // warm air that only first light brings
          if (dawn < 0.01) break;
          ctx.globalAlpha = dawn; ctx.fillStyle = l.grad; ctx.fillRect(l.x, l.y, l.w, l.h);
          ctx.globalAlpha = 1; break;
        case "lightfill":
          // lit cloud: only once there is light enough to catch
          var ca = ease(span(dawn, 0.4, 1));
          if (ca < 0.01) break;
          ctx.globalAlpha = ca; ctx.fillStyle = V.c[l.fill];
          if (!v.skip) ctx.fill(l.path);
          else {
            ctx.beginPath();
            l.ells.forEach(function (e) {
              if (v.skip.indexOf(e) >= 0) return;
              ctx.moveTo(e.cx + e.rx, e.cy); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2);
            });
            ctx.fill();
          }
          ctx.globalAlpha = 1; break;
        case "fill":
          ctx.fillStyle = fillAt(l.fill, dawn); ctx.fill(l.path);
          if (l.stroke) { ctx.strokeStyle = V.c[l.stroke]; ctx.lineWidth = l.w * u; ctx.stroke(l.path); }
          break;
        case "water":
          // standing water mirrors the sky, so it warms with it
          ctx.fillStyle = grads.wn; ctx.fill(l.path);
          ctx.globalAlpha = dawn; ctx.fillStyle = grads.wd; ctx.fill(l.path);
          if (grads.ws) { ctx.fillStyle = grads.ws; ctx.fill(l.path); }
          ctx.globalAlpha = 1; break;
        case "stroke":
          ctx.strokeStyle = V.c[l.stroke]; ctx.lineWidth = l.w * u; ctx.stroke(l.path); break;
        case "plants":
          ctx.globalAlpha = 0.32 + 0.68 * near; ctx.strokeStyle = V.c.plants; ctx.lineWidth = u;
          ctx.lineCap = "round"; ctx.stroke(l.path); ctx.lineCap = "butt"; ctx.globalAlpha = 1; break;
        case "dose":
          // the protectant running out along the first farm's rows; it moves
          // with the scroll, so it only moves while someone is reading it
          if (near < 0.02) break;
          ctx.globalAlpha = 0.8 * near; ctx.strokeStyle = V.c.dose; ctx.lineWidth = 1.8 * u; ctx.lineCap = "round";
          ctx.setLineDash([0.1 * u, 8 * u]); ctx.lineDashOffset = -p * 900 * u;
          ctx.stroke(l.path); ctx.setLineDash([]); ctx.lineCap = "butt"; ctx.globalAlpha = 1; break;
        case "headers":
          for (i = 0; i < farms.length; i++) {
            f = farms[i];
            if (!f.hdr || f.x > x1 + 10 || f.x + 700 < x0 || f.y < y0 - 200 || f.y > y1 + 200) continue;
            ctx.lineWidth = (f.hero ? 2 : 1.2) * u;
            if (f.a < 1) { ctx.globalAlpha = 1 - f.a; ctx.strokeStyle = V.c.hdrOff; ctx.stroke(f.hdr); }
            if (f.a > 0) { ctx.globalAlpha = f.a; ctx.strokeStyle = f.hero ? V.c.hdrHero : V.c.hdr; ctx.stroke(f.hdr); }
          }
          ctx.globalAlpha = 1; break;
        case "props":
          // reactors, houses, trees, palms and bananas, back to front
          for (i = 0; i < props.length; i++) {
            q = props[i];
            if (q.farm) {
              f = q.farm;
              if (f.x < x0 - 30 || f.x > x1 + 30 || f.y < y0 - 5 || f.y - f.s > y1 + 5) continue;
              if (!f.typ || f.s * S < 2.2) {
                ctx.setTransform(D, 0, 0, D, DX, DY);
                ctx.fillStyle = mixed(VOFF, VON, f.a);
                ctx.beginPath(); ctx.arc(f.x, f.y - f.s * 0.5, Math.max(0.85, f.s * 0.4, 0.6 * u), 0, Math.PI * 2); ctx.fill();
                continue;
              }
              ctx.globalAlpha = 0.5 + 0.5 * f.a;
              glyph(V.glyphs["r" + f.typ], f.x, f.y, f.s / 100, f.s / 100, null, mixed(VOFF, VON, f.a));
              ctx.globalAlpha = 1;
              continue;
            }
            if (q.x + q.s < x0 || q.x - q.s > x1 || q.y < y0 || q.y - 1.1 * q.s > y1) continue;
            if (q.s * S < 1.2) continue;
            glyph(q.g, q.x, q.y, (q.flip ? -1 : 1) * q.s / 100, q.s / 100, q.col, null);
          }
          ctx.setTransform(D, 0, 0, D, DX, DY);
          break;
      }
    });

    // the glows, on their own canvas: remember where they go, so the
    // fireflies can redraw them without the valley
    var q = gdpr / dpr;
    G = { D: D * q, DX: DX * q, DY: DY * q, u: u, x0: x0, y0: y0, x1: x1, y1: y1 };
    glows(performance.now());

    // the words: the line and its sentence land together as the last farms
    // light; the full stop lights after them
    var land = landAt(p);
    stage.style.setProperty("--vl-land", land.toFixed(3));
    var nowLit = p >= lastT - LAND_LEAD + LAND + 0.012;
    if (nowLit !== lit) { lit = nowLit; sec.classList.toggle("is-lit", lit); }

    // the first reactor's label, beside it in the close-up only
    if (label) {
      var la = 1 - span(p, LABEL_OUT[0], LABEL_OUT[1]);
      label.style.opacity = la.toFixed(3);
      if (la > 0) {
        // its leader line drops from the middle of the reactor's plinth, below
        // the brightest of its glow
        var hx = v.k * (c.ax - v.x), hy = v.k * (c.ay - v.y), lead = Math.round(Math.max(12, hero.s * S * 0.16));
        label.style.setProperty("--vl-lead", lead + "px");
        label.style.transform = "translate(" + Math.round(hx) + "px," + Math.round(hy + lead) + "px)";
      }
    }
  }

  /* ---- the glows, and the fireflies ----
     A lit reactor's glow rests a little below full and flashes to full, and
     wider, once a period, at its own time: quickly up and slowly down, the
     way a firefly does. As a farm first comes on, its glow swells once with
     the scroll, so the light spreads across the valley as a scatter of small
     flares rather than a fade. */
  function flash(f, sec) {
    var x = ((sec / f.per + f.ph) % 1) * f.per;  // seconds into its period
    if (x < RISE) { x /= RISE; return x * x * (3 - 2 * x); }
    x = 1 - (x - RISE) / FALL;
    return x > 0 ? x * x : 0;
  }
  function glows(now) {
    if (!G) return;
    glowAt = now;
    var g = G, sec = now / 1000, i, f;
    gtx.setTransform(1, 0, 0, 1, 0, 0);
    gtx.clearRect(0, 0, cg.width, cg.height);
    gtx.setTransform(g.D, 0, 0, g.D, g.DX, g.DY);
    for (i = 0; i < farms.length; i++) {
      f = farms[i];
      if (f.a <= 0) continue;
      // a far farm is at least a small point of light, so a phone's
      // wide last frame still reads as many farms, each lit
      var r = f.hero ? f.s * 2.3 : Math.max(5.5, f.s * 1.9, 3.4 * g.u);
      var b = flash(f, sec) * (f.hero ? 0.5 : 1);
      var on = f.a < 1 ? Math.sin(Math.PI * f.a) : 0;   // the swell as it comes on
      var k = 1 + GROW * Math.max(b, on);
      var gx = f.x - f.s * 0.16, gy = f.y - f.s * 0.45, R = r * k;
      if (gx + R < g.x0 || gx - R > g.x1 || gy + R < g.y0 || gy - R > g.y1) continue;
      gtx.globalAlpha = f.a * (GLOW_REST + (1 - GLOW_REST) * Math.max(b, on));
      gtx.drawImage(sprite, gx - R, gy - R, 2 * R, 2 * R);
    }
    gtx.globalAlpha = 1;
  }
  // the loop: only while the section is on screen, the tab is visible and
  // motion is welcome; a scroll frame that already drew the glows counts.
  // About 30 redraws a second, and 20 on a phone: a glow changes slowly, so
  // the steps do not show, and a phone's battery is spared.
  function tick(now) {
    try {
      if (!onScreen || dead || !ready || still.matches || document.hidden) { looping = false; if (!dead) glows(now); return; }
      if (now - glowAt > (size && size.sw < 640 ? 45 : 30)) glows(now);
    } catch (e) { looping = false; fail(); return; }
    requestAnimationFrame(tick);
  }
  function wake() {
    if (looping || !onScreen || dead || !ready || still.matches || document.hidden) return;
    looping = true;
    requestAnimationFrame(tick);
  }

  /* ---- the frame job ---- */
  // an element's box in the stage, by layout (the landing transform does
  // not count)
  function box(el) {
    var x = 0, y = 0, e = el;
    while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight };
  }
  function measure() {
    var a = box(line), b = box(gloss);
    return {
      sw: stage.clientWidth, sh: stage.clientHeight,
      tb: b.b,
      t: { l: Math.min(a.l, b.l), r: Math.max(a.r, b.r), t: a.t, b: b.b },
      navTop: parseFloat(getComputedStyle(stage).top) || 0
    };
  }
  function read(force) {
    if (!V || dead) return undefined;
    var r = run.getBoundingClientRect(), vh = window.innerHeight;
    // arm only while the whole section is still below the screen
    if (!armed) return r.top > vh ? { arm: true } : undefined;
    // off screen, nothing to draw; except the first frame, drawn at once
    // (still below the screen) so the canvas takes over from the <img> unseen
    if ((r.bottom < -60 || r.top > vh + 60) && !force && ready) return undefined;
    var m = null;
    if (sizeDirty || !size) {
      m = measure();
      if (size && m.sw === size.sw && m.sh === size.sh && Math.abs(m.tb - size.tb) < 1) m = null;
      else r = run.getBoundingClientRect();
      sizeDirty = false;
    }
    var sh = m ? m.sh : size.sh;
    var travel = r.height - sh;
    var p = travel > 0 ? clamp01(((m ? m.navTop : navTop) - r.top) / travel) : 1;
    if (!m && size) p = Math.min(p, pStill);    // past it, every frame is the same
    var key = p.toFixed(4);
    if (!m && !force && key === lastKey) return undefined;
    lastKey = key;
    return { p: p, m: m };
  }
  function write(s) {
    if (dead) return;
    try {
      if (s.arm) {
        armed = true;
        sec.classList.add("is-live");
        sizeDirty = true;
        frame.request();                 // the next frame measures the new layout
        return;
      }
      if (s.m) { resize(s.m); size.tb = s.m.tb; }
      draw(s.p);
      if (!ready) {
        img.insertAdjacentElement("afterend", cv);
        cv.insertAdjacentElement("afterend", cg);
        ready = true;
        sec.classList.add("is-ready");
        wake();
      }
    } catch (e) { fail(); }
  }
  // anything wrong in the drawing: back to the <img>, and stop
  function fail() {
    dead = true;
    sec.classList.remove("is-ready", "is-lit");
    if (cv.parentNode) cv.parentNode.removeChild(cv);
    if (cg.parentNode) cg.parentNode.removeChild(cg);
    if (run.getBoundingClientRect().top > window.innerHeight) sec.classList.remove("is-live");
  }

  function load() {
    fetch(src, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (data) {
      if (!build(data)) throw new Error("no first farm");
      frame.request();                 // the next frame arms it, if it may
    }).catch(function () { V = null; /* the <img> stays: the finished frame */ });
  }

  // fail is also the frame's fallback: if this job is ever dropped, the
  // section goes back to the finished <img> rather than freezing mid-run
  frame.add(function () { try { return read(false); } catch (e) { return undefined; } }, write, fail);
  window.addEventListener("scroll", frame.request, { passive: true });
  window.addEventListener("resize", function () { sizeDirty = true; lastKey = ""; frame.request(); });

  // the fireflies run only while a fair part of the drawing is on screen
  // (not for the sliver left above the notes)
  new IntersectionObserver(function (entries) {
    var e = entries[entries.length - 1];
    onScreen = e.isIntersecting && e.intersectionRatio >= 0.15;
    wake();
  }, { threshold: [0, 0.15] }).observe(stage);
  document.addEventListener("visibilitychange", wake);

  // fetch the drawing when the section is a screen and a half away
  var nearIO = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; })) { nearIO.disconnect(); load(); }
  }, { rootMargin: "150% 0px" });
  nearIO.observe(sec);
})();
