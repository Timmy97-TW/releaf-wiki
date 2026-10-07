/* =============================================================================
   VISION: "Every farmer a biomanufacturer."  One farm becomes a valley of them.

   THE PICTURE is the design team's hand-drawn valley, in daylight, as one
   sharp layer (assets/img/home/vision/, built by build/vision-art.py, which
   also writes home-vision-data.js, read here as window.__visionData). This
   file is the light and the camera.

   IN ONE SCROLL. It opens close on one field at night: her bioreactor stands
   in it, and the light it throws shows that field in her own colours while
   everything around it stays dark. As the reader scrolls a single screen, the
   camera pulls back, every other farm's reactor comes on as it enters the
   frame, and at the same time first light comes up and her sun rises from
   behind her ridge. The line lands on the sky last, its full stop lit like one
   more reactor.

   HOW IT IS LIT. One canvas lies over the picture and is multiplied into it:
   it is filled with the colour of night, each reactor that is on lets its own
   field through (brightest at the reactor, down to a fifth of the way at the
   field's far corner), and the whole fill warms from night to first light, the
   sun's side first. It is cut to the land's outline, so the sky and the sun
   are never darkened. Nothing in the picture is ever swapped for another
   picture: her night is her daylight paint, dimmed.

   HOW IT STAYS SMOOTH
   - It is one job on window.__homeFrame (home.js): the whole page measures in
     one phase and writes in the next, so a frame lays out once however many
     sections are moving.
   - Nothing is measured in the write phase, and nothing is written in the
     read phase. Sizes are taken once per resize, not per frame.
   - The camera is one transform on one element. The layers never move
     against each other, so the picture is a single composited layer.
   - At the closest zoom the opening field's own picture covers the screen, so
     the big land layer is taken out of the frame entirely rather than being
     rasterised at four times its size.
   - The scroll sets a target; each frame eases towards it, so a wheel's steps
     and a flick's jumps arrive as one glide.

   THE RESTING STATE IS THE FINISHED STATE. Without JavaScript, home-vision.css
   shows the valley at first light. With reduced motion this file draws that
   last frame, lit, and never moves it. If anything throws, its additions come
   out and that same finished frame stays.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.__visionData;
  var sec = document.getElementById("vision");
  if (!sec || !D || !window.requestAnimationFrame) return;

  var DIR = "assets/img/home/vision/";
  var AW = D.aw, AH = D.ah, FOCAL = D.focal, SUN = D.sunC;
  var GREEN = "53,224,138";                          // --sig-green
  var SUN_DROP = 185;                                // how far under her ridge the sun starts
  var HORIZON = 770;                                 // the far ridges' crest on the artboard
  var FLOOR = 0.2;                                   // the light that reaches a field's far corner
  var NIGHT = [24, 33, 48], DAWN_L = [122, 140, 160], DAWN_R = [186, 170, 140];
  var TAU = 170;                                     // how fast the camera answers the scroll, ms

  var run = sec.querySelector(".vl-run");
  var stage = sec.querySelector(".vl-stage");
  var art = sec.querySelector(".vl-art");
  var words = sec.querySelector(".vl-sky");
  var line = sec.querySelector(".vl-line"), gloss = sec.querySelector(".vl-gloss");
  var intro = sec.querySelector(".vl-intro");
  if (!run || !stage || !art || !words || !line || !gloss) return;
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  var RECT = { "sky-night": D.sky, "sky-dawn": D.sky, sun: D.sun, land: D.land, close: D.close, reactor: D.reactor };
  var imgs = [].slice.call(sec.querySelectorAll(".vl-layer"));
  var L = {};
  imgs.forEach(function (el) { L[el.getAttribute("data-layer")] = el; });
  if (!L.land || !L.close || !L.reactor || !L.sun || !L["sky-dawn"]) return;

  /* ---- the farms: her dots, and the field each one lights ---- */
  var maxD = 0;
  var farms = D.dots.map(function (d, i) {
    var dx = d[0] - FOCAL[0], dy = (d[1] - FOCAL[1]) * 1.6, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxD) maxD = dist;
    return { x: d[0], y: d[1], ax: d[3], ay: d[4], w: d[5], h: d[6], px: d[7], py: d[8], reach: d[9], rh: d[10],
             dist: dist, hero: i === D.hero, ph: Math.random() * 6.283, sp: 0.7 + Math.random() * 0.6, a: 0 };
  });
  // each comes on a moment after the camera has pulled back far enough to
  // bring it in: the nearer to the first field, the sooner
  farms.forEach(function (f) { f.at = f.hero ? -1 : 0.05 + 0.72 * Math.pow(f.dist / maxD, 0.85); });

  /* ---- what this file adds to the markup ---- */
  function make(tag, cls) {
    var e = document.createElement(tag);
    e.className = cls;
    if (tag === "canvas") e.setAttribute("aria-hidden", "true");
    return e;
  }
  var lm = make("canvas", "vl-light"), lg = lm.getContext("2d");     // multiplied into the picture
  var cv = make("canvas", "vl-glows"), g = cv.getContext("2d");      // added on top of it
  var halo = make("div", "vl-halo"), vig = make("div", "vl-vig"), grain = make("div", "vl-grain");
  if (!lg || !g) return;

  function radial(stops) {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var s = c.getContext("2d"), gr = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(function (st) { gr.addColorStop(st[0], st[1]); });
    s.fillStyle = gr;
    s.fillRect(0, 0, 128, 128);
    return c;
  }
  var sprite = radial([[0, "rgba(255,255,255,1)"], [0.12, "rgba(235,255,240,1)"], [0.26, "rgba(" + GREEN + ",.9)"],
                       [0.55, "rgba(" + GREEN + ",.3)"], [1, "rgba(" + GREEN + ",0)"]]);
  var flare = radial([[0, "rgba(255,244,214,.9)"], [0.18, "rgba(255,226,170,.5)"], [0.5, "rgba(255,206,140,.16)"], [1, "rgba(255,200,130,0)"]]);
  var lamp = radial([[0, "rgba(255,214,150,.85)"], [0.35, "rgba(250,190,120,.32)"], [1, "rgba(246,180,110,0)"]]);

  (function tooth() {        // paper grain, so her brushwork keeps its tooth on a sharp screen
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var x = c.getContext("2d");
    if (!x) return;
    var im = x.createImageData(128, 128), d = im.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = Math.random();
      d[i] = d[i + 1] = d[i + 2] = v > 0.5 ? 255 : 0;
      d[i + 3] = Math.abs(v - 0.5) * 40;
    }
    x.putImageData(im, 0, 0);
    grain.style.backgroundImage = "url(" + c.toDataURL() + ")";
  })();

  /* ---- the pools of light ----
     masks.webp holds the shape of each field. The fall-off of its reactor's
     light is put on here, once, when the sheet arrives: a field is nearly all
     there at the reactor and FLOOR of the way at its far corner, and a little
     green near the machine. k is the picture's scale within the sheet. */
  function lightUp(x, cx, cy, reach, k, rx, ry, rw, rh) {
    var R = 0.62 * reach * 2.3 * k, t, gr;
    x.save();
    x.beginPath();
    x.rect(rx, ry, rw, rh);
    x.clip();
    x.translate(cx, cy);
    x.scale(1, 0.5);                                   // the ground is foreshortened
    x.globalCompositeOperation = "source-atop";        // colour: brighter by the reactor
    gr = x.createRadialGradient(0, 0, 0, 0, 0, R);
    for (t = 0; t <= 1.0001; t += 0.125) {
      var b = 0.66 + 0.34 * Math.exp(-5.29 * t * t);
      gr.addColorStop(Math.min(t, 1), "rgb(" + Math.round(196 * b) + "," + Math.round(255 * b) + "," + Math.round(218 * b) + ")");
    }
    x.fillStyle = gr;
    x.fillRect(-6000, -6000, 12000, 12000);
    x.globalCompositeOperation = "destination-in";     // and how far it reaches
    gr = x.createRadialGradient(0, 0, 0, 0, 0, R);
    for (t = 0; t <= 1.0001; t += 0.125) gr.addColorStop(Math.min(t, 1), "rgba(0,0,0," + (FLOOR + (1 - FLOOR) * Math.exp(-5.29 * t * t)).toFixed(3) + ")");
    x.fillStyle = gr;
    x.fillRect(-6000, -6000, 12000, 12000);
    x.restore();
  }

  var atlas = null, heroPool = null, landMask = null, ready = false, dead = false;
  function fetchImg(name, done) {
    var im = new Image();
    im.decoding = "async";
    im.onload = function () {
      var go = function () {
        try { done(im); } catch (err) { fail(); return; }
        if (atlas && heroPool && landMask && !ready && !dead) {
          ready = true;
          shown = -1;                                   // the light draws from this frame on
          sec.classList.add("is-ready");
        }
        frame.request();
      };
      if (im.decode) im.decode().then(go, go); else go();
    };
    im.onerror = fail;
    im.src = DIR + name;
  }
  function loadAll() {
    imgs.forEach(function (el) { el.loading = "eager"; });
    fetchImg("masks.webp", function (im) {
      var c = document.createElement("canvas");
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      var x = c.getContext("2d");
      x.drawImage(im, 0, 0);
      farms.forEach(function (f) { lightUp(x, f.ax + Math.min(f.x, AW - 1) - f.px, f.ay + f.y - f.py, f.reach, 1, f.ax, f.ay, f.w, f.h); });
      atlas = c;
    });
    fetchImg("hero-mask.webp", function (im) {        // the first field again, to the close-up's scale
      var c = document.createElement("canvas");
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      var x = c.getContext("2d"), k = c.width / D.close[2], f = farms[D.hero];
      x.drawImage(im, 0, 0);
      lightUp(x, (f.x - D.close[0]) * k, (f.y - D.close[1]) * k, f.reach, k, 0, 0, c.width, c.height);
      heroPool = c;
    });
    fetchImg("land-mask.webp", function (im) { landMask = im; });
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function mix(a, b, t) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," + Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }
  function place(e, r) { e.style.left = r[0] + "px"; e.style.top = r[1] + "px"; e.style.width = r[2] + "px"; e.style.height = r[3] + "px"; }

  /* ---- the frame: one job on the page's shared loop ---- */
  var frame = window.__homeFrame || (function () {     // on its own if home.js is not here
    var jobs = [], queued = false;
    function run() {
      queued = false;
      jobs.forEach(function (j) {
        if (j.dead) return;
        var v;
        try { v = j.read(); } catch (e) { j.dead = true; if (j.fail) j.fail(); return; }
        if (v === undefined) return;
        try { j.write(v); } catch (e) { j.dead = true; if (j.fail) j.fail(); }
      });
    }
    return {
      add: function (read, write, fail) { jobs.push({ read: read, write: write, fail: fail || null, dead: false }); },
      request: function () { if (!queued) { queued = true; requestAnimationFrame(run); } }
    };
  })();

  /* ---- sizes: taken once, and again only when something changes ---- */
  var M = {}, still = false, dirty = true, navTop = 0;
  function measure() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh) return false;
    M.sw = sw; M.sh = sh; M.phone = sw < sh;
    navTop = parseFloat(getComputedStyle(stage).top) || 0;
    // the last frame: the valley covers the stage. A tall screen sees part of
    // its width: centred, or moved right until her sun is in the frame.
    var s1 = Math.max(sw / AW, sh / AH), win = sw / s1;
    var x0 = (AW - win) / 2, sunRight = SUN[0] + SUN[2] + 44;
    if (x0 + win < sunRight) x0 = sunRight - win;
    x0 = Math.max(Math.min(x0, FOCAL[0] - 60, AW - win), 0);
    // its foot on the stage's foot, unless that would put the ridges behind the words
    var wordsEnd = words.offsetTop + words.offsetHeight;
    var ty = Math.min(0, Math.max(sh - AH * s1, wordsEnd + 20 - HORIZON * s1));
    M.s1 = s1; M.f1x = (FOCAL[0] - x0) * s1; M.f1y = ty + FOCAL[1] * s1;
    // the first frame: about 330 px of her drawing across a wide screen, 170 on a phone
    M.s0 = Math.max(sw / (M.phone ? 170 : 330), s1 * 3);
    M.f0x = sw * 0.5; M.f0y = sh * (M.phone ? 0.52 : 0.56);
    // soft light needs no more than this, and a smaller canvas is a cheaper frame
    var dpr = window.devicePixelRatio || 1;
    M.ld = Math.min(dpr, 1.25); M.gd = Math.min(dpr, 1.5);
    M.travel = run.offsetHeight - sh;
    return true;
  }
  function applySize() {
    lm.width = Math.round(M.sw * M.ld); lm.height = Math.round(M.sh * M.ld);
    cv.width = Math.round(M.sw * M.gd); cv.height = Math.round(M.sh * M.gd);
    art.style.width = AW + "px"; art.style.height = AH + "px";
    imgs.forEach(function (e) { place(e, RECT[e.getAttribute("data-layer")]); });
    place(halo, [FOCAL[0] - 34, FOCAL[1] - 26, 68, 52]);
  }

  /* ---- read: measure, and work out where the camera should be ---- */
  var p = -1, last = 0, onScreen = false;
  function read() {
    if (dead) return undefined;
    if (dirty && !measure()) return undefined;
    var r = run.getBoundingClientRect(), vh = window.innerHeight, now = performance.now();
    onScreen = r.bottom > -40 && r.top < vh + 40;
    var target = still || M.travel <= 0 ? 1 : clamp01((navTop - r.top) / M.travel);
    if (!onScreen || p < 0 || still) p = target;
    else {
      var dt = last ? Math.min(64, now - last) : 16;
      p += (target - p) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target - p) < 0.0004) p = target;
    }
    last = now;
    if (!onScreen && p === target && !dirty) return undefined;     // nothing to draw
    return { p: p, now: now, moving: p !== target };
  }

  /* ---- write: the camera, the light, the glows ---- */
  var shown = -1;
  function write(s) {
    if (dirty) { applySize(); dirty = false; shown = -1; }
    var p = s.p, now = s.now;
    if (p !== shown) {
      var e = smooth((p - 0.02) / 0.86);                    // the camera answers the first touch
      var k = M.s0 * Math.pow(M.s1 / M.s0, e);
      var fx = M.f0x + (M.f1x - M.f0x) * e, fy = M.f0y + (M.f1y - M.f0y) * e;
      var tx = fx - FOCAL[0] * k, ty = fy - FOCAL[1] * k;
      art.style.transform = "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0) scale(" + k.toFixed(5) + ")";

      // first light comes up while the camera pulls back
      var dawn = smooth((p - 0.12) / 0.7), sun = smooth((p - 0.2) / 0.72);
      L["sky-dawn"].style.opacity = dawn.toFixed(3);
      L.sun.style.transform = "translate3d(0," + ((1 - sun) * SUN_DROP).toFixed(2) + "px,0)";

      // the opening field's own picture, while it is sharper than the land
      var closeA = clamp01((k / M.s1 - 2) / 2);
      L.close.style.opacity = closeA.toFixed(3);
      // once it covers the screen, the land layer is only a four-times
      // enlargement behind it: take it out of the frame rather than raster it
      L.land.style.visibility = closeA > 0.995 ? "hidden" : "visible";
      var rxA = clamp01((D.reactor[3] * k - 34) / 30);      // her reactor is big enough to read
      halo.style.opacity = (rxA * (1 - 0.6 * dawn)).toFixed(3);

      var va = 1 - smooth(e / 0.3);                         // the dark around the first field
      vig.style.opacity = va.toFixed(3);
      if (va > 0) {
        vig.style.background = "radial-gradient(circle at " + fx.toFixed(0) + "px " + fy.toFixed(0) + "px, rgb(4 8 10 / 0) " +
          (0.09 * M.sw).toFixed(0) + "px, rgb(4 8 10 / .5) " + (0.22 * M.sw + 40).toFixed(0) + "px, rgb(4 8 10 / .88) " +
          (0.44 * M.sw + 120).toFixed(0) + "px)";
      }

      for (var i = 0; i < farms.length; i++) farms[i].a = farms[i].hero ? 1 : clamp01((e - farms[i].at) / 0.07);

      // the line that opened the section holds the top of the screen while
      // the camera is still close, and leaves as the pull-back starts
      if (intro) {
        var ia = 1 - smooth((p - 0.14) / 0.22);
        intro.style.opacity = ia.toFixed(3);
        intro.style.transform = "translateY(" + ((1 - ia) * -12).toFixed(1) + "px)";
      }

      var a1 = smooth((p - 0.72) / 0.14), a2 = smooth((p - 0.8) / 0.14);
      line.style.opacity = a1.toFixed(3);
      line.style.transform = "translateY(" + ((1 - a1) * 14).toFixed(1) + "px)";
      gloss.style.opacity = a2.toFixed(3);
      gloss.style.transform = "translateY(" + ((1 - a2) * 10).toFixed(1) + "px)";
      sec.classList.toggle("is-lit", p > 0.94);

      G[0] = k; G[1] = tx; G[2] = ty; G[3] = rxA; G[4] = dawn; G[5] = sun; G[6] = closeA;
      if (ready) light(k, tx, ty, dawn, sun, closeA);
      shown = p;
    }
    if (onScreen && (!still || G[0])) glows(now);
    // keep the loop while it glides, and while it is on screen (the glows breathe)
    if (s.moving || (onScreen && !still && !document.hidden)) frame.request();
  }

  /* the light: night, the fields that are lit, first light; cut to the land */
  function light(k, tx, ty, dawn, sun, closeA) {
    lg.setTransform(M.ld, 0, 0, M.ld, 0, 0);
    lg.globalCompositeOperation = "source-over";
    lg.globalAlpha = 1;
    lg.clearRect(0, 0, M.sw, M.sh);
    // first light reaches the sun's side of the valley first
    var gr = lg.createLinearGradient(tx, 0, tx + AW * k, 0);
    gr.addColorStop(0, mix(NIGHT, DAWN_L, dawn * (0.7 + 0.3 * sun)));
    gr.addColorStop(0.55, mix(NIGHT, DAWN_L, dawn));
    gr.addColorStop(1, mix(NIGHT, DAWN_R, Math.min(1, dawn * (1 + 0.25 * sun))));
    lg.fillStyle = gr;
    lg.fillRect(0, 0, M.sw, M.sh);
    var strength = 1 - 0.22 * dawn;
    for (var i = 0; i < farms.length; i++) {
      var f = farms[i], a = smooth(f.a) * strength;
      if (a <= 0.004) continue;
      if (f.hero && closeA > 0) {                            // sharp while the camera is close
        lg.globalAlpha = a * closeA;
        lg.drawImage(heroPool, tx + D.close[0] * k, ty + D.close[1] * k, D.close[2] * k, D.close[3] * k);
        a *= 1 - closeA;
        if (a <= 0.004) continue;
      }
      var x = tx + f.px * k, y = ty + f.py * k, w = f.w * k, h = f.h * k;
      if (x > M.sw || y > M.sh || x + w < 0 || y + h < 0) continue;
      lg.globalAlpha = a;
      lg.drawImage(atlas, f.ax, f.ay, f.w, f.h, x, y, w, h);
    }
    lg.globalAlpha = 1;
    lg.globalCompositeOperation = "destination-in";
    lg.drawImage(landMask, tx + D.land[0] * k, ty + D.land[1] * k, D.land[2] * k, D.land[3] * k);
    lg.globalCompositeOperation = "source-over";
  }

  /* the glows: the reactors, the lit windows, the sun's flare, and the egrets.
     Only this canvas is redrawn between scrolls, so a still frame is cheap. */
  var G = [0, 0, 0, 0, 0, 0, 0];
  var BIRDS = [[0, 0], [-34, 9], [-30, -12], [-66, 4], [-70, 22], [-104, -6]];
  function glows(now) {
    var k = G[0], tx = G[1], ty = G[2], rxA = G[3], dawn = G[4], sun = G[5];
    var t = now / 1000, i;
    g.setTransform(M.gd, 0, 0, M.gd, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, M.sw, M.sh);
    g.globalCompositeOperation = "lighter";
    if (sun > 0.01) {
      var fr = 330 * k, sx = tx + SUN[0] * k, sy = ty + (SUN[1] + (1 - sun) * SUN_DROP * 0.6) * k;
      g.globalAlpha = 0.42 * sun * sun;
      g.drawImage(flare, sx - fr, sy - fr, 2 * fr, 2 * fr);
      g.globalAlpha = 0.2 * dawn;                            // warm haze along the far fields
      g.drawImage(flare, tx + 300 * k, ty + 802 * k, (AW - 300) * k * 1.3, 300 * k);
    }
    var wa = ready ? 1 - 0.9 * dawn : 0;                     // the houses' windows, until day
    if (wa > 0.02) {
      g.fillStyle = "rgb(246,207,148)";
      for (i = 0; i < D.windows.length; i++) {
        var w = D.windows[i], wx = tx + w[0] * k, wy = ty + w[1] * k, ww = w[2] * k, wh = w[3] * k;
        if (wx > M.sw || wy > M.sh || wx + ww < 0 || wy + wh < 0) continue;
        g.globalAlpha = wa;
        g.fillRect(wx, wy, ww, wh);
        var lr = Math.max(ww, wh) * 2.6;
        g.globalAlpha = wa * 0.6;
        g.drawImage(lamp, wx + ww / 2 - lr, wy + wh / 2 - lr, 2 * lr, 2 * lr);
      }
    }
    for (i = 0; i < farms.length; i++) {
      var f = farms[i];
      if (f.a <= 0) continue;
      var big = f.hero ? rxA : 0;                            // her large drawing glows by itself
      if (big >= 1) continue;
      var x = tx + f.x * k, y = ty + f.y * k;
      var R = Math.max(0.62 * f.rh * k, 4.2) * (still ? 1 : 1 + 0.09 * Math.sin(t * f.sp + f.ph));
      if (f.a < 1) R *= 1 + 0.9 * Math.sin(Math.PI * f.a);   // it comes on with a flare
      if (x + R < 0 || x - R > M.sw || y + R < 0 || y - R > M.sh) continue;
      g.globalAlpha = (1 - big) * f.a * (1 - 0.1 * dawn);
      g.drawImage(sprite, x - R, y - R, 2 * R, 2 * R);
    }
    if (!still && dawn > 0.55) {                             // egrets leave the paddies at dawn
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = (dawn - 0.55) / 0.45 * 0.9;
      g.strokeStyle = "rgb(244,246,240)";
      g.lineCap = "round";
      g.lineWidth = Math.max(1.1, 1.6 * k);
      var bx = 150 + ((t * 22) % 1750), by = 905 - 34 * Math.sin(bx / 420);
      for (i = 0; i < BIRDS.length; i++) {
        var px = tx + (bx + BIRDS[i][0]) * k, py = ty + (by + BIRDS[i][1]) * k;
        var flap = Math.sin(t * 5.2 + i * 1.3) * 3.4 * k, span = 7.5 * k;
        g.beginPath();
        g.moveTo(px - span, py - flap);
        g.quadraticCurveTo(px - span * 0.4, py - flap * 0.2 - 1.2 * k, px, py);
        g.quadraticCurveTo(px + span * 0.4, py - flap * 0.2 - 1.2 * k, px + span, py - flap);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // anything wrong: take the additions out, and the CSS's finished frame stays
  function fail() {
    if (dead) return;
    dead = true;
    sec.classList.remove("is-live", "is-lit", "is-still", "is-ready");
    if (intro) { intro.style.removeProperty("opacity"); intro.style.removeProperty("transform"); }
    [lm, halo, cv, grain, vig].forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
    art.removeAttribute("style");
    imgs.forEach(function (e) { e.style.cssText = e.getAttribute("data-static") || ""; });
    [line, gloss].forEach(function (e) { e.removeAttribute("style"); });
  }

  function setMode() {
    still = mq.matches;
    sec.classList.add("is-live");
    sec.classList.toggle("is-still", still);
    dirty = true; p = -1; last = 0;
    frame.request();
  }

  try {
    if (!("mixBlendMode" in lm.style)) return;        // no multiply: leave the finished frame
    imgs.forEach(function (e) { e.setAttribute("data-static", e.style.cssText); });
    L.close.insertAdjacentElement("afterend", halo);  // under her reactor
    art.insertAdjacentElement("afterend", lm);
    lm.insertAdjacentElement("afterend", vig);
    vig.insertAdjacentElement("afterend", cv);
    cv.insertAdjacentElement("afterend", grain);
    frame.add(read, write, fail);
    setMode();
  } catch (err) { fail(); return; }

  window.addEventListener("scroll", frame.request, { passive: true });
  window.addEventListener("resize", function () { dirty = true; frame.request(); });
  if (window.ResizeObserver) new ResizeObserver(function () { dirty = true; frame.request(); }).observe(stage);
  document.addEventListener("visibilitychange", frame.request);
  if (mq.addEventListener) mq.addEventListener("change", setMode);
  else if (mq.addListener) mq.addListener(setMode);

  // the pictures are lazy for the page's first load; fetch them properly once
  // the section is within two screens
  if ("IntersectionObserver" in window) {
    var near = new IntersectionObserver(function (es) {
      if (es.some(function (x) { return x.isIntersecting; })) { near.disconnect(); loadAll(); }
    }, { rootMargin: "200% 0px" });
    near.observe(sec);
  } else loadAll();
})();
