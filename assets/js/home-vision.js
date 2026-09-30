/* =============================================================================
   VISION: "Every farmer a biomanufacturer." One becomes many.

   The picture is a stack of image layers on one artboard, 1600 x 1800 units
   (assets/img/home/vision/, README there): sky, ridges, valley, and the focal
   farm again at higher detail, plus that farm's lit windows. This script is
   the camera. It starts close on the focal farm at night and, as the reader
   scrolls through a pinned stage, pulls back to the whole valley while first
   light comes up; each farm's reactor lights a moment after it comes into
   the frame; the line lands on the sky and its full stop lights last.

   HOW IT MOVES, AND WHY IT IS SMOOTH
   - One transform per layer (translate + scale, GPU composited); nothing is
     repainted when the camera moves. The pictures are never redrawn.
   - The glows are the only drawing: one small canvas the size of the stage,
     about 160 soft sprites (REACTORS below), at one pixel per CSS pixel.
   - The scroll only sets a target. Each animation frame moves the shown
     progress a fraction of the way towards it (an exponential ease, TAU),
     so a wheel's steps and a flick's jumps turn into one glide.
   - Per frame it reads one rectangle and writes transforms and opacities.

   WHAT IT NEEDS: nothing but this file and the pictures. No fetch (so it
   works from file:// and on any host), no other script, no library.

   THE RESTING STATE IS THE FINISHED STATE. Without script, home-vision.css
   shows the last frame. With reduced motion this script draws that same
   last frame (glows on, line landed) and never moves it. If anything throws,
   it takes its additions out and leaves the CSS's last frame.
   ========================================================================== */

(function () {
  "use strict";

  /* ---- the reactors ----
     One entry per reactor: [x, y, size] in % of the artboard (x of its
     1600-unit width, y of its 1800-unit height, size of its width), at the
     centre of the reactor's vessel. The entry marked 1 is the focal farm's:
     the camera starts on it. New artwork only needs a new list here. */
  var REACTORS = [
    [97.81, 58.47, 0.161], [92.95, 59.62, 0.107], [96.55, 60.28, 0.146], [88.49, 60.42, 0.128], [90.81, 61.69, 0.186], [90.81, 62.76, 0.192],
    [86.16, 63.43, 0.146], [13.3, 63.78, 0.138], [93.15, 63.86, 0.149], [11.69, 64.16, 0.163], [98.87, 64.28, 0.212], [88.28, 64.33, 0.152],
    [7.22, 64.41, 0.158], [80.65, 64.51, 0.133], [10.58, 65.09, 0.146], [80.43, 65.12, 0.139], [13.76, 65.53, 0.187], [76.83, 65.56, 0.148],
    [80.42, 65.7, 0.203], [75.14, 65.73, 0.157], [98.65, 65.74, 0.244], [10.41, 65.94, 0.189], [83.18, 66.27, 0.233], [4.5, 66.67, 0.184],
    [75.98, 66.79, 0.154], [15.21, 66.94, 0.12], [9.62, 67.02, 0.142], [76.4, 67.03, 0.207], [98.87, 67.17, 0.207], [82.13, 67.41, 0.182],
    [69.59, 67.47, 0.041], [64.92, 67.48, 0.043], [60.88, 67.49, 0.044], [58.31, 67.5, 0.044], [18.24, 67.48, 0.159], [51.84, 67.53, 0.046],
    [46.14, 67.54, 0.047], [44.18, 67.55, 0.048], [36.59, 67.57, 0.049], [32.42, 67.59, 0.05], [67.95, 67.6, 0.051], [63.64, 67.61, 0.052],
    [21.52, 67.62, 0.052], [52.02, 67.66, 0.055], [14.89, 67.63, 0.137], [24.78, 67.76, 0.063], [78.73, 67.73, 0.231], [66.54, 67.81, 0.066],
    [63.95, 67.82, 0.067], [59.06, 67.84, 0.069], [55.4, 67.86, 0.07], [51.91, 67.88, 0.071], [70.22, 67.99, 0.079], [30.22, 67.99, 0.079],
    [65.87, 68.01, 0.081], [12.17, 67.97, 0.184], [61.72, 68.03, 0.083], [9.14, 68.02, 0.146], [47.31, 68.13, 0.089], [41.57, 68.16, 0.091],
    [39.19, 68.17, 0.092], [29.57, 68.23, 0.096], [25.21, 68.26, 0.098], [65.76, 68.29, 0.1], [61.86, 68.31, 0.102], [59.51, 68.34, 0.104],
    [80.85, 68.36, 0.198], [74.06, 68.36, 0.247], [44.24, 68.45, 0.112], [77.88, 68.51, 0.225], [25.79, 68.59, 0.122], [69.52, 68.62, 0.124],
    [21.92, 68.62, 0.124], [65.15, 68.65, 0.127], [62.17, 68.68, 0.129], [2.74, 68.75, 0.224], [49.75, 68.8, 0.138], [42.68, 68.87, 0.142],
    [39.6, 68.9, 0.144], [32.11, 68.97, 0.149], [67.54, 69.02, 0.152], [23.05, 69.05, 0.156], [61.61, 69.09, 0.158], [18.25, 69.11, 0.133],
    [35.57, 69.39, 0.179], [65.54, 69.6, 0.194], [98.81, 69.72, 0.203], [55.52, 69.75, 0.205], [92.33, 69.84, 0.212], [17.11, 69.89, 0.226],
    [44.83, 69.9, 0.216], [0.82, 69.95, 0.24], [40.51, 69.97, 0.221], [10.57, 69.99, 0.214], [82.48, 70.03, 0.225], [6.26, 70.09, 0.199],
    [76.79, 70.13, 0.233], [28.04, 70.15, 0.234], [21.28, 70.22, 0.157], [72.97, 70.2, 0.237], [21.13, 70.3, 0.113], [67.3, 70.31, 0.245],
    [19.52, 70.36, 0.176], [63.13, 70.38, 0.251], [51.38, 70.6, 0.266], [21.44, 70.77, 0.169], [88.27, 70.74, 0.276], [85.88, 70.8, 0.281],
    [31.45, 70.97, 0.293], [75.27, 71.05, 0.298], [25.78, 71.08, 0.301], [9.92, 71.14, 0.253], [2.9, 71.18, 0.193], [19.99, 71.39, 0.224],
    [57.25, 71.47, 0.329], [98.06, 71.48, 0.33], [18.56, 71.62, 0.161], [92.75, 71.65, 0.341], [48.58, 71.68, 0.344], [32.45, 72.06, 0.371],
    [27.9, 72.17, 0.379], [71.09, 72.29, 0.388], [62.54, 72.55, 0.406], [51.58, 72.88, 0.43], [92.54, 72.96, 0.436], [47.47, 73, 0.439],
    [83.01, 73.33, 0.462], [36.49, 73.33, 0.463], [27.92, 73.59, 0.481], [75.21, 73.62, 0.483], [96.66, 74.06, 0.514], [9.18, 74.15, 0.521],
    [60.02, 74.21, 0.525], [92.55, 74.26, 0.528], [53.85, 74.44, 0.542], [43.06, 74.85, 0.571], [30.64, 75.33, 0.606], [60.89, 75.72, 0.634],
    [48.47, 76.3, 0.675], [92.27, 76.37, 0.68], [42.64, 76.57, 0.694], [81.78, 76.99, 0.725], [33.17, 77.01, 0.726], [69.2, 77.74, 0.779],
    [16.09, 77.8, 0.783], [4.09, 78.35, 0.823], [53.31, 78.69, 0.847], [91.54, 79.05, 0.873], [84.13, 79.61, 0.913], [29.05, 80.14, 0.951],
    [69.66, 80.71, 0.992], [6.29, 81.5, 1.048], [83.8, 82.65, 1.131], [76, 83.39, 1.184], [87.36, 85.46, 1.333], [45.15, 86.29, 1.393, 1],
    [91.68, 88.91, 1.581], [5.22, 90.05, 1.662], [8.3, 94.42, 1.975], [68.36, 98.44, 2.264]
  ];

  var AB_W = 1600, AB_H = 1800;     // the artboard, in units
  var HORIZON = 1204;               // where the valley's horizon is, units from the top
  var LIGHTS_RECT = "640 1470 140 120";   // the focal farm's lit windows (lights.webp)

  // the schedule, as fractions of the pinned scroll
  var Z_FROM = 0.05, Z_TO = 0.68;   // the camera pulls back between these
  var Z_TO_PHONE = 0.62;            // a little sooner on a phone (flicks, not a wheel)
  var FIRST_LIGHT = 0.08;           // the neighbours wait this long
  var LAST_LIGHT = 0.70;            // every farm is lit by here
  var FADE = 0.04;                  // how long one farm takes to light
  var HERO_ON = 0.045;              // 1 Oct: this farm's reactor comes on first, over this much scroll
  var LABEL_OUT = [0.02, 0.09];     // the focal reactor's label leaves as the pull-back starts
  var NIGHT = 0.64;                 // how dark the night tint is before first light
  var OPEN = 0.105, OPEN_TALL = 0.08;   // at the start the focal reactor is this share of the frame tall
  var TAU = 95;                     // ms: how quickly the shown progress follows the scroll

  // the fireflies: every 6 to 14 s, at its own time, each lit reactor's glow
  // flashes, up in RISE s and down over FALL s, from GLOW_REST of full
  var RISE = 0.3, FALL = 1.1, GLOW_REST = 0.74, GROW = 0.38;

  var sec = document.getElementById("vision");
  var run = document.getElementById("vl-run");
  var stage = document.getElementById("vl-stage");
  var art = document.getElementById("vl-art");
  if (!sec || !run || !stage || !art || !window.requestAnimationFrame) return;
  var line = stage.querySelector(".vl-line");
  var gloss = stage.querySelector(".vl-gloss");
  var label = stage.querySelector(".vl-rx");
  var imgs = Array.prototype.slice.call(art.querySelectorAll("img.vl-layer"));
  if (!line || !gloss || !imgs.length) return;
  var cv = document.createElement("canvas");
  var gtx = cv.getContext && cv.getContext("2d");
  if (!gtx) return;

  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var still = mq.matches;

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var span = function (v, a, b) { return clamp01((v - a) / (b - a)); };
  var ease = function (t) { return t * t * (3 - 2 * t); };

  /* ---- the pieces this script adds ---- */
  var night = document.createElement("div");
  night.className = "vl-night"; night.setAttribute("aria-hidden", "true");
  var lit = document.createElement("img");
  lit.className = "vl-lit"; lit.alt = ""; lit.decoding = "async";
  lit.setAttribute("aria-hidden", "true");
  lit.setAttribute("data-rect", LIGHTS_RECT);
  var farmImg = art.querySelector('img[data-layer="farm"]') || imgs[imgs.length - 1];
  lit.src = farmImg.getAttribute("src").replace(/farm\.(\w+)(\?.*)?$/, "lights.$1$2");
  cv.className = "vl-glows"; cv.setAttribute("aria-hidden", "true");

  // the reactors, in units
  var farms = [], hero = null;
  REACTORS.forEach(function (r, i) {
    var f = { x: r[0] / 100 * AB_W, y: r[1] / 100 * AB_H, s: r[2] / 100 * AB_W, hero: !!r[3], t: 0, a: 1,
              per: 6 + ((i * 7919) % 1000) / 1000 * 8, ph: ((i * 104729) % 1000) / 1000, jit: ((i * 2654435761) % 1000) / 1000 };
    if (f.hero) hero = f;
    farms.push(f);
  });
  if (!hero) return;

  // every moving layer: its element and its rectangle on the artboard
  var layers = imgs.concat([lit]).map(function (el) {
    var r = (el.getAttribute("data-rect") || "0 0 1600 1800").split(/\s+/).map(Number);
    return { el: el, x: r[0], y: r[1], w: r[2], h: r[3], L: null };
  });

  // a round glow, drawn once and stamped for every reactor
  var sprite = document.createElement("canvas");
  sprite.width = sprite.height = 128;
  (function () {
    var s = sprite.getContext("2d"), g = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(53,224,138,.9)"); g.addColorStop(0.2, "rgba(53,224,138,.38)");
    g.addColorStop(0.55, "rgba(53,224,138,.09)"); g.addColorStop(1, "rgba(53,224,138,0)");
    s.fillStyle = g; s.fillRect(0, 0, 128, 128);
  })();

  /* ---- the frame: where the artboard sits at the end, and the camera ---- */
  var M = null;                     // measured: stage size, the last frame, the opening
  function measure() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh) return null;
    // where the words end, inside the stage (by layout; their fade does not count)
    var tb = 0, e = gloss;
    while (e && e !== stage) { tb += e.offsetTop; e = e.offsetParent; }
    tb += gloss.offsetHeight;
    // The last frame. A wide screen holds the whole valley; a tall one (a
    // phone) about a third of its width, so the valley still fills the lower
    // half of the frame. The horizon sits well below the words, and the
    // artboard's foot never above the stage's foot.
    var wu = AB_W * Math.pow(Math.min(1, (sw / sh) / 1.2), 1.2);
    var k = sw / wu;
    var hz = Math.min(0.72 * sh, Math.max(0.4 * sh, tb + 72));
    var yTop = HORIZON - hz / k;
    yTop = Math.max(0, Math.min(yTop, AB_H - sh / k));
    var xLeft = (AB_W - wu) / 2;
    var m = { sw: sw, sh: sh, k: k, ax: -xLeft * k, ay: -yTop * k, phone: sw < 640, tall: sw < sh };
    m.hx = m.ax + hero.x * k; m.hy = m.ay + hero.y * k;
    // the opening: close enough that the focal reactor is about a tenth of
    // the frame tall, with its house up to the left and its field to the right
    m.z0 = Math.max(1.5, (m.tall ? OPEN_TALL : OPEN) * sh / (hero.s * k));
    m.sx0 = (m.tall ? 0.62 : 0.44) * sw;
    m.sy0 = (m.tall ? 0.5 : 0.46 + 0.04 * clamp01((sh - 730) / 100)) * sh;
    m.navTop = parseFloat(getComputedStyle(stage).top) || 0;
    return m;
  }
  function camera(p) {
    var e = ease(span(p, Z_FROM, M.phone ? Z_TO_PHONE : Z_TO));
    return { e: e, z: Math.pow(M.z0, 1 - e), sx: M.sx0 + (M.hx - M.sx0) * e, sy: M.sy0 + (M.hy - M.sy0) * e };
  }
  // a farm lights a moment after it comes into the frame; the ones that
  // never do (hidden at the edges) light near the end
  var lastT = LAST_LIGHT;
  function thresholds() {
    var samples = [];
    for (var p = 0; p <= 1.0001; p += 0.004) samples.push({ p: p, c: camera(p) });
    var mx = 0.03 * M.sw, my = 0.03 * M.sh;
    lastT = 0;
    farms.forEach(function (f) {
      if (f.hero) { f.t = -1; return; }
      var fx = M.ax + f.x * M.k, fy = M.ay + f.y * M.k, pe = -1;
      for (var s = 0; s < samples.length; s++) {
        var c = samples[s].c, x = c.sx + (fx - M.hx) * c.z, y = c.sy + (fy - M.hy) * c.z;
        if (x > mx && x < M.sw - mx && y > my && y < M.sh - my) { pe = samples[s].p; break; }
      }
      var t = pe < 0 ? LAST_LIGHT - 0.1 + f.jit * 0.08 : pe + 0.03 + f.jit * 0.05;
      f.t = Math.min(LAST_LIGHT - FADE, Math.max(FIRST_LIGHT + f.jit * 0.04, t));
      if (f.t + FADE > lastT) lastT = f.t + FADE;
    });
  }

  function layout() {
    M = measure();
    if (!M) return false;
    art.style.left = M.ax + "px"; art.style.top = M.ay + "px";
    art.style.width = AB_W * M.k + "px"; art.style.height = AB_H * M.k + "px";
    art.style.bottom = "auto";
    layers.forEach(function (l) {
      // each layer's box at the last frame, relative to the stage
      l.L = { x: M.ax + l.x * M.k, y: M.ay + l.y * M.k };
      var st = l.el.style;
      if (l.el === lit) {                 // outside the artboard, so it can sit over the night
        st.left = l.L.x + "px"; st.top = l.L.y + "px";
      } else {
        st.left = (l.x / AB_W * 100) + "%"; st.top = (l.y / AB_H * 100) + "%";
      }
      st.width = l.w * M.k + "px"; st.height = l.h * M.k + "px";
    });
    var gd = Math.min(window.devicePixelRatio || 1, M.sw > 1600 ? 1 : 1.5);
    cv.width = Math.round(M.sw * gd); cv.height = Math.round(M.sh * gd);
    M.gd = gd;
    M.lw = label ? label.offsetWidth : 0;     // so the label never runs off the stage
    thresholds();
    return true;
  }

  /* ---- drawing one frame ---- */
  var shownP = -1, shownKey = "";
  function frame(p, now) {
    var c = camera(p), z = c.z, i, f, share = 0;
    // the pictures: one transform each
    var key = p.toFixed(5);
    if (key !== shownKey) {
      shownKey = key;
      for (i = 0; i < layers.length; i++) {
        var l = layers[i], L = l.L;
        if (l.el === lit) {
          // the lit windows sit outside the artboard, so their origin is the stage
          l.el.style.transform = "translate3d(" + (c.sx + (L.x - M.hx) * z - L.x).toFixed(2) + "px," +
            (c.sy + (L.y - M.hy) * z - L.y).toFixed(2) + "px,0) scale(" + z.toFixed(5) + ")";
          continue;
        }
        l.el.style.transform = "translate3d(" + (c.sx + (L.x - M.hx) * z - L.x).toFixed(2) + "px," +
          (c.sy + (L.y - M.hy) * z - L.y).toFixed(2) + "px,0) scale(" + z.toFixed(5) + ")";
      }
      for (i = 0; i < farms.length; i++) {
        f = farms[i];
        f.a = still ? 1 : f.hero ? clamp01(p / HERO_ON) : clamp01((p - f.t) / FADE);
        share += f.a;
      }
      share /= farms.length;
      night.style.opacity = still ? "0" : (NIGHT * (1 - ease(share)) * (1 - 0.5 * c.e)).toFixed(3);
      // the words land as the last farms light; the full stop after them
      var land = still ? 1 : ease(span(p, lastT - 0.03, lastT + 0.05));
      var o = land.toFixed(3), ty = "translate3d(0," + ((1 - land) * 16).toFixed(2) + "px,0)";
      line.style.opacity = o; gloss.style.opacity = o;
      line.style.transform = ty; gloss.style.transform = ty;
      sec.classList.toggle("is-lit", still || p >= lastT + 0.06);
      if (label) {
        var la = still ? 0 : 1 - span(p, LABEL_OUT[0], LABEL_OUT[1]);
        label.style.opacity = la.toFixed(3);
        if (la > 0) {
          // under the reactor's plinth, with a leader line up to it
          var hk = hero.s * M.k * z, lead = Math.round(Math.max(12, hk * 0.16));
          label.style.setProperty("--vl-lead", lead + "px");
          label.style.transform = "translate3d(" + Math.round(Math.min(c.sx, M.sw - M.lw - 12)) + "px," + Math.round(c.sy + 0.45 * hk + lead) + "px,0)";
        }
      }
    }
    glows(c, now);
  }

  /* ---- the glows, and the fireflies ----
     A lit reactor's glow rests a little below full and flashes to full, and
     wider, once a period, at its own time: quickly up, slowly down. As a
     farm first comes on, its glow swells once with the scroll, so the light
     spreads across the valley as a scatter of small flares. */
  function flash(f, s) {
    var x = ((s / f.per + f.ph) % 1) * f.per;
    if (x < RISE) { x /= RISE; return x * x * (3 - 2 * x); }
    x = 1 - (x - RISE) / FALL;
    return x > 0 ? x * x : 0;
  }
  var glowAt = 0;
  function glows(c, now) {
    glowAt = now;
    var g = M.gd, K = M.k * c.z, s = now / 1000, W = M.sw, H = M.sh;
    gtx.setTransform(1, 0, 0, 1, 0, 0);
    gtx.clearRect(0, 0, cv.width, cv.height);
    gtx.setTransform(g, 0, 0, g, 0, 0);
    for (var i = 0; i < farms.length; i++) {
      var f = farms[i];
      if (f.a <= 0) continue;
      // a far farm is at least a small point of light
      var R = f.hero ? f.s * (2.9 - 0.6 * c.e) * K : Math.max(5.5 * K, f.s * 1.9 * K, 4.2);
      var x = c.sx + (M.ax + f.x * M.k - M.hx) * c.z, y = c.sy + (M.ay + f.y * M.k - M.hy) * c.z;
      var b = still ? 0 : flash(f, s) * (f.hero ? 0.5 : 1);
      var on = f.a < 1 ? Math.sin(Math.PI * f.a) : 0;
      var q = Math.max(b, on);
      R *= 1 + GROW * q;
      if (x + R < 0 || x - R > W || y + R < 0 || y - R > H) continue;
      // the focal farm's glow is the whole light of the opening frame
      gtx.globalAlpha = f.hero ? f.a * (1 - 0.25 * c.e * (1 - q)) : f.a * (GLOW_REST + (1 - GLOW_REST) * q);
      gtx.drawImage(sprite, x - R, y - R, 2 * R, 2 * R);
    }
    gtx.globalAlpha = 1;
  }

  /* ---- the loop ---- */
  var p = 0, target = 0, last = 0, queued = false, dead = false, dirty = true;
  function readTarget() {
    var r = run.getBoundingClientRect(), vh = window.innerHeight;
    var travel = r.height - M.sh;
    target = still ? 1 : travel > 0 ? clamp01((M.navTop - r.top) / travel) : 1;
    return r.bottom > -40 && r.top < vh + 40;      // on screen
  }
  function tick(now) {
    queued = false;
    if (dead) return;
    try {
      if (dirty) { if (!layout()) return; dirty = false; shownKey = ""; }
      var onScreen = readTarget();
      var dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (!onScreen || p < 0 || still) p = target;       // off screen: jump, nobody sees it
      else {
        p += (target - p) * (1 - Math.exp(-dt / TAU));
        if (Math.abs(target - p) < 0.0004) p = target;
      }
      var moving = p !== target;
      if (onScreen && (shownKey !== p.toFixed(5) || (!still && now - glowAt > (M.phone ? 45 : 30)))) frame(p, now);
      else if (!onScreen && shownKey !== p.toFixed(5)) frame(p, now);
      // keep going while it glides, and while it is on screen (the fireflies)
      if (moving || (onScreen && !still && !document.hidden)) request();
      else last = 0;
    } catch (err) { fail(); }
  }
  function request() { if (!queued && !dead) { queued = true; requestAnimationFrame(tick); } }

  // anything wrong: take the additions out, and the CSS's last frame stays
  function fail() {
    dead = true;
    sec.classList.remove("is-live", "is-lit", "is-still");
    [night, lit, cv].forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    art.removeAttribute("style");
    imgs.forEach(function (el, i) { el.style.transform = ""; el.style.width = ""; el.style.height = ""; });
    [line, gloss, label].forEach(function (el) { if (el) { el.style.opacity = ""; el.style.transform = ""; } });
    // the inline % positions of each layer are the markup's own; put them back
    layers.forEach(function (l) {
      if (l.el === lit) return;
      l.el.style.left = (l.x / AB_W * 100) + "%"; l.el.style.top = (l.y / AB_H * 100) + "%";
      l.el.style.width = (l.w / AB_W * 100) + "%"; l.el.style.height = (l.h / AB_H * 100) + "%";
    });
  }

  function setMode() {
    still = mq.matches;
    sec.classList.toggle("is-live", !still);
    sec.classList.toggle("is-still", still);
    dirty = true; p = -1; last = 0;
    request();
  }

  try {
    art.insertAdjacentElement("afterend", night);
    night.insertAdjacentElement("afterend", lit);
    lit.insertAdjacentElement("afterend", cv);
    setMode();
  } catch (err) { fail(); return; }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", function () { dirty = true; request(); });
  if (window.ResizeObserver) new ResizeObserver(function () { dirty = true; request(); }).observe(stage);
  document.addEventListener("visibilitychange", request);
  if (mq.addEventListener) mq.addEventListener("change", setMode);
  else if (mq.addListener) mq.addListener(setMode);

  // the pictures are lazy for the page's first load; fetch them properly
  // once the section is within two screens
  function eager() {
    imgs.forEach(function (el) { el.loading = "eager"; });
    lit.loading = "eager";
  }
  if ("IntersectionObserver" in window) {
    var near = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { near.disconnect(); eager(); }
    }, { rootMargin: "200% 0px" });
    near.observe(sec);
  } else eager();
})();
