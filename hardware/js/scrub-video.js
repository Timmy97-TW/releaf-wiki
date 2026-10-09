// Scrub video — a pre-rendered clip that plays with the scroll, for the component heroes.
//
// Since 7 Oct 2026 the photometer, LPA and hydroponics walkthroughs are clips rendered
// from their own WebGL stories (dev/hero-video/), and this module plays them. The page's
// story engine still turns the scroll into p and still owns every caption; it calls
// draw(p, clock) every frame and this puts the matching frame of the clip on screen.
//
//   - Two clips per page, a 16:9 one and a portrait one, rendered at reference viewports
//     (1440x810 and 390x845 CSS px). The one nearer the stage's aspect is used, scaled to
//     cover the stage like the WebGL canvas it replaces.
//   - The clip URLs are the page's #story data attributes (one obvious place to swap in
//     the Video Universe URLs); the per-frame data the live layers need is the page's
//     js/hero-clips.js, written by the renderer next to the clips.
//   - Seeking is coalesced: one seek in flight at a time, and when it lands the next one
//     goes straight to wherever the scroll has got to. Queuing every intermediate seek is
//     what makes scrubbed video stall; this way the picture is never more than one
//     decode behind the scroll. The clips are cut with a keyframe every few frames.
//   - The clip is fetched whole into a blob first when the host allows it, so every seek
//     is served from memory and does not depend on the server answering range requests.
//   - The poster (the clip's first frame) is shown while the clip loads, and stays if it
//     cannot be played.
//   - The things that kept moving in the WebGL frame without a scroll are drawn live on
//     top: the aurora curtain, the dust motes, the starfield's twinkle, a slow breath.
//     The video holds the rest, frozen at the clock it was rendered with.
//   - Reduced motion: story-core already hands p straight from the scroll (no spring) and
//     a clock of 0, so the scrub is frame-accurate and every live layer stands still.
window.ScrubVideo = function (opt) {
  "use strict";

  const stage = opt.stage, story = opt.story;
  const DATA = opt.data || {};
  const N = DATA.frames || 1, FPS = DATA.fps || 30;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ds = story.dataset;
  const SRC = {
    desktop: { src: ds.srcDesktop, poster: ds.posterDesktop },
    phone: { src: ds.srcPhone, poster: ds.posterPhone },
  };

  /* ------------------------------------------------------------------- DOM */
  if (!document.getElementById("hv-style")) {
    const st = document.createElement("style");
    st.id = "hv-style";
    st.textContent =
      ".hv-frame{position:absolute;left:0;top:0;overflow:hidden;pointer-events:none;transform-origin:50% 50%;will-change:transform}" +
      ".hv-frame>.hv-video,.hv-frame>.hv-poster,.hv-frame>.hv-layer{position:absolute;left:0;top:0;width:100%;height:100%;display:block}" +
      ".hv-frame>.hv-video{object-fit:fill;opacity:0;background:transparent}" +
      ".hv-frame.hv-shown>.hv-video{opacity:1}" +
      ".hv-frame>.hv-poster{object-fit:fill;opacity:0}" +
      ".hv-frame.hv-has-poster>.hv-poster{opacity:1}" +
      ".hv-frame.hv-shown>.hv-poster{visibility:hidden}" +
      ".hv-frame>.hv-aurora{mix-blend-mode:lighten;image-rendering:auto}" +
      ".hv-frame>.hv-motes{mix-blend-mode:screen}" +
      ".hv-frame>.hv-ref{position:absolute;left:0;top:0;transform-origin:0 0;inset:auto}";
    document.head.appendChild(st);
  }
  const frame = document.createElement("div");
  frame.className = "hv-frame";
  const poster = document.createElement("img");
  poster.className = "hv-poster"; poster.alt = ""; poster.decoding = "async";
  const video = document.createElement("video");
  video.className = "hv-video";
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  video.setAttribute("muted", ""); video.setAttribute("playsinline", ""); video.setAttribute("webkit-playsinline", "");
  video.preload = "auto"; video.disablePictureInPicture = true; video.setAttribute("disableremoteplayback", "");
  video.setAttribute("aria-hidden", "true"); video.tabIndex = -1;
  frame.appendChild(poster); frame.appendChild(video);

  // The WebGL canvas (and anything drawn over it in 2D that the clip now carries) is
  // taken out; the frame goes where the canvas was, so the stacking order of the
  // captions, the scrim and the rest of the stage is exactly what it was.
  const replace = (opt.replace || []).filter(Boolean);
  if (replace[0]) {
    const label = replace[0].getAttribute("aria-label");
    if (label) { frame.setAttribute("role", "img"); frame.setAttribute("aria-label", label); }
    replace[0].parentNode.insertBefore(frame, replace[0]);
  } else stage.insertBefore(frame, stage.firstChild);
  replace.forEach(function (el) { el.style.display = "none"; el.setAttribute("aria-hidden", "true"); });

  // Layers laid out in the REFERENCE viewport's own CSS pixels and scaled with the clip,
  // so they stay registered with what the clip shows at any window size (LPA: the
  // duty-cycle traces beside the three lifted tubes).
  const refLayers = (opt.refLayers || []).filter(Boolean);
  const layers = [];

  /* ------------------------------------------------------------- the clip */
  let kind = null, clip = null;          // "desktop" / "phone", and its data
  let objectURL = null, loadToken = 0;
  let ok = false, failed = false, shown = false;
  let fW = 1, fH = 1, fX = 0, fY = 0;     // the frame's box on the stage, CSS px
  const readyFns = [], progFns = [];
  let isReady = false;
  function fireReady() {
    if (isReady) return; isReady = true;
    readyFns.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  }
  function progress(f) { progFns.forEach(function (fn) { fn(f); }); }

  // The clip nearer the stage's own aspect, measured on a log scale: the crossover is
  // the geometric mean of 16:9 and 1080:2340, an aspect of about 0.91.
  function pick() {
    const a = stage.clientWidth / Math.max(1, stage.clientHeight);
    const d = DATA.desktop, ph = DATA.phone;
    const ad = d ? d.w / d.h : 16 / 9, ap = ph ? ph.w / ph.h : 1080 / 2340;
    return Math.abs(Math.log(a / ad)) <= Math.abs(Math.log(a / ap)) ? "desktop" : "phone";
  }

  // Cover the stage. Where the portrait clip is taller than the stage (a phone browser
  // with its toolbars out: Safari's smallest iPhone viewport is about 390 x 664 against the
  // clip's 390 x 845) 70% of the excess comes off the BOTTOM: every portrait act holds
  // its subject in the upper part of the frame (the record's chart sits at 9-42% of the
  // height) and keeps the lower part for the captions, which are live and laid out for the
  // real stage anyway. Centred, the chart's labels went under the top bar; cut from the
  // bottom alone, the instrument under the chart sank onto the caption. Checked at
  // 390 x 664 on all three pages.
  const KEEP_TOP = 0.3;
  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const cw = clip ? clip.w : 16, ch = clip ? clip.h : 9;
    const s = Math.max(W / cw, H / ch);
    fW = cw * s; fH = ch * s; fX = (W - fW) / 2;
    fY = (H - fH) * (kind === "phone" ? KEEP_TOP : 0.5);
    frame.style.width = fW.toFixed(2) + "px"; frame.style.height = fH.toFixed(2) + "px";
    frame.style.left = fX.toFixed(2) + "px"; frame.style.top = fY.toFixed(2) + "px";
    if (clip && clip.css) {
      const k = fW / clip.css[0];
      refLayers.forEach(function (el) {
        el.style.width = clip.css[0] + "px"; el.style.height = clip.css[1] + "px";
        el.style.transform = "scale(" + k.toFixed(5) + ")";
      });
    }
    layers.forEach(function (L) { if (L.resize) L.resize(); });
  }

  function load(which) {
    if (which === kind) return;
    kind = which; clip = DATA[which] || null;
    const token = ++loadToken;
    ok = false; shown = false; failed = false; seeking = false; presented = -1;
    if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
    // a switch (a phone turned on its side): the new clip's poster until its first frame
    frame.classList.remove("hv-shown", "hv-has-poster", "hv-failed");
    const s = SRC[which];
    frame.dataset.clip = which;
    layout();
    if (s.poster) {
      poster.onload = function () { if (token === loadToken) { frame.classList.add("hv-has-poster"); maybeReady(); } };
      poster.onerror = function () { if (token === loadToken) maybeReady(); };
      poster.src = s.poster;
    }
    if (!s.src || !clip) { fail("no clip"); return; }
    // Whole file into memory when the host allows it (CORS). A host that does not
    // gets the URL directly; the browser streams it and seeks with range requests.
    const direct = function () { if (token === loadToken) { video.src = s.src; video.load(); } };
    if (!window.fetch || !window.ReadableStream || /^blob:|^data:/.test(s.src)) { direct(); return; }
    fetch(s.src, { mode: "cors", credentials: "omit" }).then(function (r) {
      // A real HTTP answer that is not the clip: no point asking again. (A CORS refusal
      // never gets here; it rejects, and falls to the direct URL below.)
      if (!r.ok) { const e = new Error("HTTP " + r.status); e.http = true; throw e; }
      const total = +r.headers.get("content-length") || 0;
      if (!r.body || !r.body.getReader) return r.blob();
      const rd = r.body.getReader(), parts = [];
      let got = 0;
      const pump = function () {
        return rd.read().then(function (x) {
          if (token !== loadToken) { rd.cancel(); throw new Error("superseded"); }
          if (x.done) return new Blob(parts, { type: "video/mp4" });
          parts.push(x.value); got += x.value.length;
          if (total) progress(0.95 * got / total);
          return pump();
        });
      };
      return pump();
    }).then(function (blob) {
      if (token !== loadToken) return;
      objectURL = URL.createObjectURL(blob);
      video.src = objectURL; video.load();
    }).catch(function (e) {
      if (token !== loadToken || String(e && e.message) === "superseded") return;
      if (e && e.http) fail(e.message); else direct();
    });
  }

  function fail(why) {
    if (failed) return;
    failed = true;
    frame.classList.add("hv-failed");
    console.warn("hero clip unavailable (" + why + "); showing the poster");
    maybeReady(true);
  }

  // The loader goes when there is something true to show: the clip's first frame, or
  // the poster while the story is still at its opening (the poster IS p = 0).
  function maybeReady(force) {
    if (isReady) return;
    if (shown || force || (frame.classList.contains("hv-has-poster") && curP < 0.02)) fireReady();
  }

  video.addEventListener("loadedmetadata", function () {
    ok = true;
    // iOS Safari draws nothing for a seek on a video that has never played. A muted
    // inline play-and-pause is allowed without a gesture and wakes the decoder; where it
    // is refused (Low Power Mode) recent iOS shows seeked frames regardless.
    const pr = video.play();
    if (pr && pr.then) pr.then(function () { video.pause(); kick(true); }, function () { kick(true); });
    else { video.pause(); kick(true); }
  });
  video.addEventListener("error", function () { fail("decode/network error " + (video.error ? video.error.code : "")); });
  video.addEventListener("seeked", function () {
    seeking = false; seekedAt = performance.now();
    stats.seeks++; const ms = performance.now() - seekT0; stats.seekMs += ms; stats.seekMax = Math.max(stats.seekMax, ms);
    if (!shown) { shown = true; frame.classList.add("hv-shown"); progress(1); maybeReady(); }
    if (!hasRVFC) presented = Math.round(video.currentTime * FPS - 0.5);
    kick();
  });
  const hasRVFC = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
  let presented = -1;
  if (hasRVFC) {
    const onFrame = function (now, meta) {
      presented = Math.round(meta.mediaTime * FPS);
      stats.frames++;
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  }

  /* --------------------------------------------------------------- the scrub */
  let curP = 0, want = 0, seeking = false, seekT0 = 0, seekedAt = 0;
  const stats = { seeks: 0, seekMs: 0, seekMax: 0, frames: 0 };
  function frameOf(p) { return Math.max(0, Math.min(N - 1, Math.round(p * (N - 1)))); }
  // Middle of the frame's display interval: a seek to the exact boundary can land on
  // the frame before it after the container's timebase rounding.
  function timeOf(i) { return (i + 0.5) / FPS; }
  function kick(first) {
    if (!ok || failed) return;
    if (seeking && !first) return;
    const cur = Math.round(video.currentTime * FPS - 0.5);
    if (!first && cur === want && shown) return;
    seeking = true; seekT0 = performance.now();
    video.currentTime = timeOf(want);
  }

  /* -------------------------------------------------------------- live layers */

  // A per-frame track, kept at keyframes (track.f: frame numbers, ascending): the two
  // keys either side of this p's frame, and how far between them it is.
  function sample(track, p) {
    const F = track.f, n = F.length;
    const f = Math.max(0, Math.min(N - 1, p * (N - 1)));
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (F[mid] <= f) lo = mid; else hi = mid; }
    const span = F[hi] - F[lo];
    return { i: lo, u: span > 0 ? Math.max(0, Math.min(1, (f - F[lo]) / span)) : 0 };
  }
  function lerpScalar(track, p) {
    if (!track || !track.v || !track.v.length) return 0;
    if (track.v.length === 1) return track.v[0];
    const s = sample(track, p);
    return track.v[s.i] + (track.v[s.i + 1] - track.v[s.i]) * s.u;
  }
  // A camera track: per sample [P0, P5, P8, P9, qx, qy, qz, qw, tx, ty, tz], the
  // projection's four live terms and the rigid model-view transform. Interpolated
  // term by term (the quaternion renormalised), then expanded to a 3x4 matrix in out:
  // [P0, P5, P8, P9, r00, r01, r02, r10, r11, r12, r20, r21, r22, tx, ty, tz].
  function camAt(track, p, out) {
    const s = sample(track, p), v = track.v, a = s.i * 11, b = a + 11 < v.length ? a + 11 : a, u = s.u;
    const L = function (k) { return v[a + k] + (v[b + k] - v[a + k]) * u; };
    let qx = L(4), qy = L(5), qz = L(6), qw = L(7);
    const n = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw) || 1;
    qx /= n; qy /= n; qz /= n; qw /= n;
    out[0] = L(0); out[1] = L(1); out[2] = L(2); out[3] = L(3);
    out[4] = 1 - 2 * (qy * qy + qz * qz); out[5] = 2 * (qx * qy - qz * qw); out[6] = 2 * (qx * qz + qy * qw);
    out[7] = 2 * (qx * qy + qz * qw); out[8] = 1 - 2 * (qx * qx + qz * qz); out[9] = 2 * (qy * qz - qx * qw);
    out[10] = 2 * (qx * qz - qy * qw); out[11] = 2 * (qy * qz + qx * qw); out[12] = 1 - 2 * (qx * qx + qy * qy);
    out[13] = L(8); out[14] = L(9); out[15] = L(10);
    return out;
  }

  // sRGB <-> linear, and the composite pass's tone curve (look.js COMPOSITE_FRAG)
  function lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toSRGB(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055; }
  function aces(x) { const v = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); return v < 0 ? 0 : v > 1 ? 1 : v; }
  function hexLin(h) {
    h = h.replace("#", "");
    return [lin(parseInt(h.slice(0, 2), 16) / 255), lin(parseInt(h.slice(2, 4), 16) / 255), lin(parseInt(h.slice(4, 6), 16) / 255)];
  }
  function smooth(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

  function canvasLayer(cls) {
    const c = document.createElement("canvas");
    c.className = "hv-layer " + cls;
    c.setAttribute("aria-hidden", "true");
    frame.appendChild(c);
    return c;
  }

  const LAYERS = {
    /* The aurora curtain (photometer; the LPA's never moves, so its clip keeps it). In
       the WebGL frame it is added in the composite pass, before tone mapping, only where
       the frame is dark. The clip is
       rendered without it; here the same function is drawn at a tenth of the clip's
       resolution (it is all soft bands) through the same tone curve and vignette, and
       laid over the clip with `lighten`: on the black of the stage that is exactly the
       sum the composite makes, and over the lit instrument the instrument wins, which
       is what the composite's dark mask does. */
    aurora: function () {
      const cfgA = opt.aurora || {};
      const col = hexLin(cfgA.col || "#ff9a3c");
      const gamma = cfgA.gamma || 1, expo = cfgA.exposure || 1, vig = cfgA.vignette || 0;
      const c = canvasLayer("hv-aurora");
      const g = c.getContext("2d");
      let img = null, lastT = -1e9, lastS = -1, lastKind = null;
      function size() {
        const w = Math.max(16, Math.round((clip ? clip.w : 1920) / 10)), h = Math.max(16, Math.round((clip ? clip.h : 1080) / 10));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; img = g.createImageData(w, h); lastT = -1e9; }
      }
      function aur(x, y, t) {
        let a = 0;
        let d = (y - 0.30 - 0.10 * Math.sin(x * 2.1 + t * 0.21)) * 3.1; a += 0.55 * Math.exp(-d * d);
        d = (y - 0.52 - 0.13 * Math.sin(x * 1.4 - t * 0.17 + 1.7)) * 2.4; a += 0.35 * Math.exp(-d * d);
        d = (y - 0.72 - 0.08 * Math.sin(x * 3.0 + t * 0.13 + 3.1)) * 4.0; a += 0.22 * Math.exp(-d * d);
        a *= 0.45 + 0.55 * Math.sin(x * 1.9 + t * 0.11);
        const side = smooth(0.08, 0.42, Math.abs(x - 0.52));
        const edge = smooth(0, 0.18, x) * smooth(1, 0.82, x) * smooth(0, 0.22, y) * smooth(1, 0.78, y);
        return Math.max(a, 0) * (0.25 + 0.75 * side) * edge;
      }
      return {
        resize: size,
        draw: function (p, t) {
          if (!clip) return;
          size();
          const S = lerpScalar(clip.aurora, p);
          // The bands move at a few hundredths of the frame a second: 12 updates a
          // second is already finer than one pixel of the low-res layer.
          if (Math.abs(t - lastT) < 0.083 && Math.abs(S - lastS) < 0.0005 && lastKind === kind) return;
          lastT = t; lastS = S; lastKind = kind;
          const w = c.width, h = c.height, D = img.data;
          if (S <= 0.001) { g.clearRect(0, 0, w, h); c.style.opacity = "0"; return; }
          c.style.opacity = "1";
          for (let j = 0; j < h; j++) {
            const y = 1 - (j + 0.5) / h;               // GL uv: y up
            for (let i = 0; i < w; i++) {
              const x = (i + 0.5) / w;
              const a = Math.pow(Math.min(1, aur(x, y, t)), gamma) * S;
              const qx = x - 0.5, qy = y - 0.5, v = 1 - vig * (qx * qx + qy * qy) * 1.4;
              const o = (j * w + i) * 4;
              D[o] = 255 * toSRGB(aces(col[0] * a * expo)) * v;
              D[o + 1] = 255 * toSRGB(aces(col[1] * a * expo)) * v;
              D[o + 2] = 255 * toSRGB(aces(col[2] * a * expo)) * v;
              D[o + 3] = 255;
            }
          }
          g.putImageData(img, 0, 0);
        },
      };
    },

    /* Dust motes (all three pages). Rendered in 3D they are points in the scene
       drifting on the clock; the clip is rendered without them, and the renderer
       records each frame's camera (projection x view x the motes' own transform) so
       they can be projected here, onto the clip, with the drift and twinkle running
       live. Positions are seeded rather than the scene's own: they were random on
       every load there too. Drawn over the frame rather than depth-tested against it:
       at the size and brightness these are, a mote in front of a part and a mote
       behind it read the same. */
    motes: function () {
      if (!DATA.motes) return null;
      const c = canvasLayer("hv-motes");
      const g = c.getContext("2d");
      const LEVELS = 24;
      // The page can tune each system's brightness (gain) over what the renderer recorded.
      const systems = DATA.motes.map(function (M0, mi) {
        const M = Object.assign({}, M0, (opt.motes || [])[mi] || {});
        let s = (M.seed || 1) >>> 0;
        const rnd = function () {
          s = s + 0x6D2B79F5 | 0;
          let t = Math.imul(s ^ s >>> 15, 1 | s);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
        const P = new Float32Array(M.count * 4);
        for (let i = 0; i < M.count; i++) {
          if (M.layout === "pool") {
            // hydroponics: clustered round the lit pool (story.js `dust`)
            const rad = Math.pow(rnd(), 0.62), th = rnd() * 6.28318;
            P[i * 4] = Math.cos(th) * rad * M.box[0];
            P[i * 4 + 1] = M.box[3] + Math.pow(rnd(), 0.8) * M.box[1];
            P[i * 4 + 2] = Math.sin(th) * rad * M.box[2];
          } else {
            P[i * 4] = (rnd() - 0.5) * M.box[0];
            P[i * 4 + 1] = (rnd() - 0.5) * M.box[1];
            P[i * 4 + 2] = (rnd() - 0.5) * M.box[2];
          }
          P[i * 4 + 3] = rnd();
        }
        const lc = M.colorLin || hexLin(M.color);
        // Sprites, one per brightness level. Story pages: a mote is light added to the
        // linear frame before the composite's exposure and ACES, so its colour on black
        // is that curve applied to its intensity, which is NOT linear in it: the level
        // picks the tint. Hydroponics: the renderer only encodes (toneMapped: false) and
        // blends in display space, so one tint and plain alpha.
        const sprites = [];
        const levels = M.tone === "aces" ? LEVELS : 1;
        for (let L = 0; L < levels; L++) {
          const I = M.tone === "aces" ? Math.pow((L + 1) / LEVELS, 2) * (M.imax || 0.5) : 1;
          const e = M.exposure || 1;
          const rgb = [0, 1, 2].map(function (j) {
            return Math.round(255 * (M.tone === "aces" ? toSRGB(aces(lc[j] * I * e)) : toSRGB(Math.min(1, lc[j]))));
          }).join(",");
          const sp = document.createElement("canvas");
          sp.width = sp.height = 16;
          const sg = sp.getContext("2d"), rg = sg.createRadialGradient(8, 8, 0, 8, 8, 8);
          if (M.profile === "tex") {           // story.js dustTex
            rg.addColorStop(0, "rgba(" + rgb + ",1)"); rg.addColorStop(0.35, "rgba(" + rgb + ",0.42)"); rg.addColorStop(1, "rgba(" + rgb + ",0)");
          } else {                              // look.js: smoothstep(0.5, 0, r)
            for (let q = 0; q <= 8; q++) { const r = q / 8; rg.addColorStop(r, "rgba(" + rgb + "," + (1 - smooth(0, 1, r)).toFixed(3) + ")"); }
          }
          sg.fillStyle = rg; sg.fillRect(0, 0, 16, 16);
          sprites.push(sp);
        }
        return { M: M, P: P, sprites: sprites, mvp: new Float32Array(16) };
      });
      window.__hvMotes = systems.map(function (S) { return S.M; });   // calibration rig
      let dpr = 1, drawn = true;
      function size() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(2, Math.round(fW * dpr)), h = Math.max(2, Math.round(fH * dpr));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      }
      return {
        resize: size,
        draw: function (p, t) {
          if (!clip || !clip.motes) return;
          // Nothing lit at this p (most of the story on the photometer and the LPA,
          // and the water acts here): leave the layer empty and out of the compositor.
          let any = false;
          for (let si = 0; si < clip.motes.length; si++) if (lerpScalar(clip.motes[si].op, p) > 0.003) any = true;
          if (!any) { if (drawn) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); c.style.visibility = "hidden"; drawn = false; } return; }
          if (!drawn) { c.style.visibility = ""; drawn = true; }
          size();
          const W = c.width, H = c.height;
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.clearRect(0, 0, W, H);
          g.globalCompositeOperation = "lighter";
          const k = W / clip.w;                // clip pixels -> canvas pixels
          const ss = clip.ss || 1;
          systems.forEach(function (S, si) {
            const tr = clip.motes[si];
            if (!tr) return;
            const op = lerpScalar(tr.op, p);
            if (op <= 0.003) return;
            const m = camAt(tr.cam, p, S.mvp), M = S.M, P = S.P;
            const T = t * (M.tscale || 1);
            const gain = M.gain || 1, imax = M.imax || 0.5, cull = M.cull;
            // hydroponics turns and lifts the whole cloud on the clock
            let cr = 1, sr = 0, ly = 0;
            if (M.spin) { cr = Math.cos(t * M.spin); sr = Math.sin(t * M.spin); ly = Math.sin(t * M.bobF) * M.bob; }
            for (let i = 0; i < M.count; i++) {
              let x = P[i * 4], y = P[i * 4 + 1], z = P[i * 4 + 2];
              const sd = P[i * 4 + 3];
              let fade = 1;
              if (M.drift) {
                y += Math.sin(T * 0.35 + sd * 6.2831) * M.drift;
                x += Math.cos(T * 0.27 + sd * 12.566) * M.drift * 0.6;
                fade = 0.35 + 0.65 * Math.abs(Math.sin(sd * 9.0 + T * 0.5));
              }
              if (M.spin) { const x2 = x * cr + z * sr, z2 = -x * sr + z * cr; x = x2; z = z2; y += ly; }
              // under the bench: hidden by it in the WebGL frame
              if (cull && cull[0] * x + cull[1] * y + cull[2] * z + cull[3] < 0) continue;
              // camera space, then the projection (three.js perspective: w = -z)
              const ex = m[4] * x + m[5] * y + m[6] * z + m[13];
              const ey = m[7] * x + m[8] * y + m[9] * z + m[14];
              const ez = m[10] * x + m[11] * y + m[12] * z + m[15];
              const cw = -ez;
              if (cw <= 1) continue;
              const cx = (m[0] * ex + m[2] * ez) / cw;
              const cy = (m[1] * ey + m[3] * ez) / cw;
              if (cx < -1.05 || cx > 1.05 || cy < -1.05 || cy > 1.05) continue;
              const px = (cx * 0.5 + 0.5) * W, py = (0.5 - cy * 0.5) * H;
              if (M.tone === "aces") {
                // look.js: the point's size in the supersampled scene buffer (never under
                // one of its pixels), then what is left of it per clip pixel once that
                // buffer is filtered down to the frame
                const ps = Math.max(1, Math.min(M.size * (300 / Math.max(cw, 1)), M.size * 4) * (0.6 + sd * 0.8));
                const dClip = ps / ss;
                const cover = Math.min(1, dClip * dClip);
                const I = gain * op * fade * cover;
                const L = Math.min(LEVELS - 1, Math.max(0, Math.round(Math.sqrt(Math.min(1, I / imax)) * LEVELS) - 1));
                if (I < imax / (LEVELS * LEVELS) * 0.5) continue;
                const dd = Math.max(1.25, dClip * k);
                g.globalAlpha = 1;
                g.drawImage(S.sprites[L], px - dd / 2, py - dd / 2, dd, dd);
              } else {
                // PointsMaterial with size attenuation: size x (buffer height / 2) / depth
                const d = M.size * (clip.h * 0.5) / cw, dd = Math.max(1.5, d * k);
                g.globalAlpha = Math.min(1, gain * op * Math.min(1, (d * k) / 1.5));
                g.drawImage(S.sprites[0], px - dd / 2, py - dd / 2, dd, dd);
              }
            }
          });
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
        },
      };
    },

    /* The starfield (hydroponics). The page's star layer (js/atmos.js) sits behind a
       transparent WebGL canvas there, parallaxing with the scroll and twinkling on the
       clock. The clip carries the rest of that backdrop; the stars are drawn here with
       atmos.js's own seeded layout and twinkle, placed for the reference viewport's
       scroll position at this p, and dimmed by the visibility the renderer measured
       for each star in each frame (hidden behind the plate, under the horizon). */
    stars: function () {
      if (!((DATA.desktop && DATA.desktop.stars) || (DATA.phone && DATA.phone.stars))) return null;
      const c = canvasLayer("hv-stars");
      const g = c.getContext("2d");
      // js/atmos.js build(): mulberry32(20260808), three depth layers
      let seed = 20260808;
      const r = function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
      const stars = [];
      [{ n: 90, s: 0.6, a: 0.30, p: 0.02 }, { n: 55, s: 0.9, a: 0.48, p: 0.05 }, { n: 26, s: 1.4, a: 0.72, p: 0.10 }]
        .forEach(function (L) {
          for (let i = 0; i < L.n; i++) stars.push({ x: r(), y: r() * 2, s: L.s, a: L.a * (0.5 + r() * 0.5), p: L.p, tw: r() * 6.283 });
        });
      // visibility runs: per star, [frame, level, frame, level, ...]; level 0..3
      function level(runs, f) {
        let v = 0;
        for (let i = 0; i < runs.length; i += 2) { if (runs[i] <= f) v = runs[i + 1]; else break; }
        return v / 3;
      }
      let dpr = 1, drawn = true;
      function size() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(2, Math.round(fW * dpr)), h = Math.max(2, Math.round(fH * dpr));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      }
      return {
        resize: size,
        draw: function (p, t) {
          if (!clip || !clip.stars) return;
          size();
          const V = clip.stars.vis, cs = clip.stars;
          const W = c.width, H = c.height;
          g.setTransform(1, 0, 0, 1, 0, 0);
          if (drawn) g.clearRect(0, 0, W, H);
          drawn = false;
          // the reference viewport, in its own CSS pixels
          const RW = clip.css[0], RH = clip.css[1];
          const k = W / RW;                    // reference CSS px -> canvas px
          const sy = cs.top + p * cs.span;     // the page's scrollY at this p
          const f = Math.max(0, Math.min(N - 1, Math.round(p * (N - 1))));
          g.fillStyle = "rgb(226,236,248)";
          for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const vv = level(V[i], f);
            if (vv <= 0) continue;
            const y = (s.y * RH - sy * s.p) % (RH * 2);
            const py = y < 0 ? y + RH * 2 : y;
            if (py > RH + 4) continue;
            const tw = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 1.6 + s.tw);
            g.globalAlpha = s.a * tw * vv;
            drawn = true;
            g.beginPath();
            g.arc(s.x * RW * k, py * k, s.s * k, 0, 6.283);
            g.fill();
          }
          g.globalAlpha = 1;
          c.style.visibility = drawn ? "" : "hidden";
        },
      };
    },
  };

  (opt.overlays || []).forEach(function (name) {
    const make = LAYERS[name];
    if (make) { const L = make(); if (L) layers.push(L); }
  });
  refLayers.forEach(function (el) { frame.appendChild(el); el.classList.add("hv-ref"); });

  /* ------------------------------------------------------------------ breath */
  // The WebGL camera breathed: a drift of a few tenths of a percent on periods of
  // about 30 and 37 s, so a held shot was never dead still. The clip has that breath
  // baked in at the clock it was rendered with (DATA.clock); this adds back only the
  // difference, as a sub-pixel drift of the whole frame, so at the render clock the
  // clip is exactly the WebGL frame. No zoom to hide the edges: the drift is under
  // 0.25% of the frame, and every frame edge is the stage's own near-black.
  const BREATH = opt.breath === undefined ? 0.0012 : opt.breath;
  const T0 = DATA.clock === undefined ? 12.5 : DATA.clock;
  function breathe(t) {
    if (!BREATH || reduced) { if (frame.style.transform) frame.style.transform = ""; return; }
    const bx = -(Math.sin(t * 0.21) - Math.sin(T0 * 0.21)) * BREATH * fW;
    const by = (Math.cos(t * 0.17) - Math.cos(T0 * 0.17)) * BREATH * 0.75 * fH;
    frame.style.transform = "translate3d(" + bx.toFixed(2) + "px," + by.toFixed(2) + "px,0)";
  }

  /* ---------------------------------------------------------------- the draw */
  function draw(p, clock) {
    curP = p;
    const t = clock || 0;
    const which = pick();
    if (which !== kind) load(which);
    if (stage.clientWidth !== lastW || stage.clientHeight !== lastH) { lastW = stage.clientWidth; lastH = stage.clientHeight; layout(); }
    want = frameOf(p);
    kick();
    for (let i = 0; i < layers.length; i++) layers[i].draw(p, t);
    breathe(t);
  }
  let lastW = -1, lastH = -1;
  window.addEventListener("resize", function () { lastW = -1; });

  // For the verification rig (dev/hero-video/tools): is the frame on screen the one
  // the story asked for?
  window.__heroVideo = {
    ready: function () { return isReady; },
    settled: function () {
      if (failed) return true;
      if (!ok || seeking || !shown) return false;
      const cur = Math.round(video.currentTime * FPS - 0.5);
      // rVFC reports the frame actually handed to the compositor; without it (or if
      // it has not fired a quarter second after the seek) the seek itself is trusted
      return cur === want && (!hasRVFC || presented === want || performance.now() - seekedAt > 250);
    },
    frame: function () { return { want: want, current: Math.round(video.currentTime * FPS - 0.5), presented: presented, kind: kind }; },
    stats: stats, video: video, failed: function () { return failed; },
  };

  // The part of the stage the clip covers, in the clip's reference CSS pixels: what a
  // reference-space layer can see once the clip is scaled to cover a window of another
  // shape (at 1440x900 the 16:9 clip loses 72 of its 1440 px at each side).
  function visibleRef() {
    if (!clip || !clip.css) return null;
    const k = fW / clip.css[0], W = stage.clientWidth, H = stage.clientHeight;
    return { x0: -fX / k, x1: (W - fX) / k, y0: -fY / k, y1: (H - fY) / k };
  }

  return {
    draw: draw, visibleRef: visibleRef,
    // Pick the clip for this stage and start fetching it, before the story's first frame.
    preload: function (p) { curP = p || 0; const w = pick(); if (w !== kind) load(w); },
    onReady: function (f) { readyFns.push(f); if (isReady) f(); },
    onProgress: function (f) { progFns.push(f); },
    video: video, frame: frame,
  };
};
