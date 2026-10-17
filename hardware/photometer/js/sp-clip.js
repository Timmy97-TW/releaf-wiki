// Photometer record: the simplified photometer's clip (section 6), as a scroll animation.
//
// 14 Oct 2026. The optic-fibre unit's Assemble animation, rendered as a normal clip (27 s,
// words baked in; dev/simplified-photometer/anim/clips/README.md) and uploaded to Video
// Universe. 15 Oct, the owner: make it "a scrolling animation too, but I do like how it
// starts integrated and smaller inside the page, so maybe once you scroll there it pops out".
//
//   - At rest it is the card in the column it always was: the poster (the clip's first frame)
//     with the caption under it.
//   - The card and its caption sit in a sticky "pin" inside a tall track. As the card nears
//     the middle of the screen it lifts out of the column (position: fixed, eased from the
//     card's own box to the whole viewport, the corners easing square), stays pinned while
//     the scroll scrubs the clip from its first frame to its last, then settles back into the
//     card on the last frame and the page carries on. Scrolling back up plays it backwards.
//   - The scrub follows the top story's recipe (../../js/scrub-video.js, story-core.js): the
//     clip is fetched whole into a blob, the time is a critically damped spring on the scroll
//     (rAF), and seeks are coalesced, one in flight. fastSeek (keyframe-only) is used where
//     the browser has it, but only while the scroll is moving fast; a precise seek follows.
//     The Video Universe re-encode has a keyframe every 2 s at 60 fps, so a precise seek can
//     decode up to 119 frames: that is measured in window.__spClip.stats.
//   - Fit: the clip's words sit near its edges (captions at ~4% from the left and ~97% down),
//     so the full-screen frame is never cropped more than ~3% a side; what is left over is
//     black above the clip, whose top edge is black.
//   - Phones use the portrait clip (as before: the one nearer the frame's shape) and still
//     pop out.
//   - Reduced motion, or a browser without what this needs: the old behaviour, a card that
//     plays muted and looping while on screen (with controls under reduced motion). Without
//     JS the <video> keeps its poster.
// ../js/scrub-video.js is not reused: it is bound to the page's #story element, its
// story-core spring and window.__story, and its per-frame data; this is a second, smaller
// instance of the same approach that touches none of those.
//
// 17 Oct 2026, the owner: the scroll animations take a while to load "and it looks very behind".
// Measured (dev/night-logs/2026-10-17-overnight/w3/measure_sp.py, wheel input at 1400 px/s): the
// picture showed 16 frames a second and trailed the scroll by 0.32 s (median) to 1.55 s (p95).
// Three changes:
//   - the spring (7 rad/s, ~0.29 s of lag at a steady scroll) is the house lag chain now, as in
//     ../../js/story-core.js (three 28 ms lags: ~0.08 s);
//   - while the scroll runs forward the clip PLAYS along with it, at the rate the scroll asks
//     for (0.25-16x, corrected toward the scroll's time), instead of seeking frame after frame:
//     the Video Universe file has a keyframe only every 2 s, so every seek decodes up to 119
//     frames, while playing decodes each frame once. When the scroll stops or turns back it
//     pauses and makes one exact seek, as before;
//   - a quiet "Skip" in the popped-out card's corner jumps past the pinned stretch.
(function () {
  "use strict";
  var figs = document.querySelectorAll("figure.sp-clip[data-src-desktop]");
  if (!figs.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var portrait = window.matchMedia("(max-width: 760px) and (orientation: portrait)");
  var canScroll = !reduce && "IntersectionObserver" in window && window.requestAnimationFrame &&
    window.CSS && CSS.supports && CSS.supports("position", "sticky");

  Array.prototype.forEach.call(figs, function (fig) {
    var video = fig.querySelector("video");
    if (!video) return;
    if (canScroll && fig.querySelector(".sp-clip__frame")) scrolly(fig, video); else simple(fig, video);
  });

  /* ------------------------------------------------- the old card: play and loop */
  function simple(fig, video) {
    var ds = fig.dataset, which = "", inView = false, started = false;
    function play() {
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
    }
    function pick() {
      var w = portrait.matches ? "phone" : "desktop";
      if (w === which) return;
      which = w;
      fig.classList.toggle("is-portrait", w === "phone");
      video.poster = w === "phone" ? ds.posterPhone : ds.posterDesktop;
      var u = w === "phone" ? ds.srcPhone : ds.srcDesktop;
      if (window.VUEmbed && VUEmbed.is(u)) VUEmbed.bind(video, u, { loop: true, aspect: w === "phone" ? 9 / 16 : 16 / 9 });
      else { video.src = u; video.load(); }
      if (inView && !reduce) play();
    }
    if (reduce) {
      video.controls = true;
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          inView = e.isIntersecting;
          if (inView) play(); else video.pause();
        });
      }, { threshold: 0.35 }).observe(video);
    } else {
      video.autoplay = true;
    }
    /* fetch nothing until the reader is near it */
    function start() { if (!started) { started = true; pick(); } }
    if ("IntersectionObserver" in window) {
      var near = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { near.disconnect(); start(); }
      }, { rootMargin: "600px 0px" });
      near.observe(fig);
    } else start();
    video.poster = ds.posterDesktop;
    if (portrait.addEventListener) portrait.addEventListener("change", function () { if (started) pick(); });
  }

  /* ------------------------------------------------- the scroll animation */
  function scrolly(fig, video) {
    var ds = fig.dataset;
    var SRC = {
      desktop: { src: ds.srcDesktop, poster: ds.posterDesktop, w: 1920, h: 1080 },
      phone: { src: ds.srcPhone, poster: ds.posterPhone, w: 1080, h: 1920 },
    };
    // The pinned length, in viewport heights, and how it is spent: the lift starts a little
    // before the pin (PRE) and is done a little after it (GROW); the same at the end.
    // 7.5 vh pinned leaves 6.8 vh, about 6100 px on a laptop, for the 27 s clip. 15 Oct, the
    // owner, twice: "slow down the scrolling for simplified" (2.5 -> 4.5), then "more" (-> 7.5).
    var PIN = 7.5, PRE = 0.15, GROW = 0.35;
    var RADIUS = 14, MAXCROP_X = 0.03, MAXCROP_Y = 0.025;
    var TAU = 0.028, SUB = 0.002; // the lag chain, as ../../js/story-core.js (17 Oct 2026; was a 7 rad/s spring)

    if (!document.getElementById("sp-scroll-style")) {
      var st = document.createElement("style");
      st.id = "sp-scroll-style";
      st.textContent =
        "html.js figure.sp-clip.sp-scroll.reveal{transform:none}" + /* a transform would trap the fixed card */
        ".sp-scroll .sp-track{position:relative}" +
        ".sp-scroll .sp-pin{position:sticky}" +
        ".sp-scroll .sp-clip__frame{background:#05060a}" +
        ".sp-scroll .sp-card{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;" +
          "border-radius:inherit;background:#000}" +
        ".sp-scroll .sp-card video{position:absolute;display:block;object-fit:fill;max-width:none}" +
        ".sp-scroll .sp-card.sp-band::after{content:'';position:absolute;left:0;right:0;top:var(--sp-vtop,0px);height:72px;z-index:1;pointer-events:none;background:linear-gradient(180deg,#000,rgba(0,0,0,0))}" +
        ".sp-scroll .sp-vp{position:fixed;left:0;top:0;right:0;bottom:0;visibility:hidden;pointer-events:none}" +
        ".sp-scroll .sp-card.is-out{position:fixed;z-index:40;box-shadow:0 30px 90px rgba(4,6,12,.45)}" +
        ".sp-scroll .sp-skip{position:absolute;right:18px;bottom:18px;z-index:2;display:inline-flex;align-items:center;gap:.5rem;" +
          "margin:0;padding:.5rem .8rem .5rem .9rem;border:1px solid rgba(255,255,255,.16);border-radius:999px;" +
          "background:rgba(8,10,14,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:rgba(220,228,236,.82);" +
          "font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:.6rem;line-height:1;letter-spacing:.16em;" +
          "text-transform:uppercase;cursor:pointer;opacity:0;visibility:hidden;transition:opacity .3s ease,border-color .25s ease,color .25s ease}" +
        ".sp-scroll .sp-skip::before{content:'';position:absolute;inset:-8px -6px}" +
        ".sp-scroll .sp-skip svg{width:10px;height:10px;color:var(--amber,#ffa040)}" +
        ".sp-scroll .sp-skip.is-on{opacity:.5;visibility:visible}" +
        ".sp-scroll .sp-skip.is-on:hover,.sp-scroll .sp-skip.is-on:focus-visible{opacity:1;color:#fff;" +
          "border-color:color-mix(in srgb,var(--amber,#ffa040) 55%,transparent)}" +
        ".sp-scroll .sp-skip:focus-visible{outline:2px solid var(--amber,#ffa040);outline-offset:3px}";
      document.head.appendChild(st);
    }

    /* DOM: figure > track > pin > [frame > card > video, figcaption] */
    var frame = fig.querySelector(".sp-clip__frame"), cap = fig.querySelector("figcaption");
    var track = document.createElement("div"), pin = document.createElement("div"), card = document.createElement("div");
    track.className = "sp-track"; pin.className = "sp-pin"; card.className = "sp-card";
    // What the reader sees is the visual viewport. On a phone page that is wider than the
    // screen (the record has one wide table) the layout viewport, which position: fixed and
    // inset: 0 fill, is bigger than the screen, so the card is sized to the visual one, in
    // layout coordinates; this probe is the fallback where visualViewport is missing.
    var vp = document.createElement("div"); vp.className = "sp-vp"; vp.setAttribute("aria-hidden", "true");
    fig.insertBefore(track, frame);
    track.appendChild(pin); pin.appendChild(frame);
    if (cap) pin.appendChild(cap);
    pin.appendChild(vp);
    frame.insertBefore(card, video); card.appendChild(video);
    fig.classList.add("sp-scroll");
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    video.loop = false; video.removeAttribute("loop");
    video.preload = "auto"; video.disablePictureInPicture = true;
    video.setAttribute("disableremoteplayback", "");

    /* ---------------------------------------------------------------- layout */
    var kind = null, clip = SRC.desktop, vh = 0, pinH = 0, T = 0, L = 0;
    var VV = window.visualViewport || null;
    function view() {
      if (VV && VV.width) return { x: VV.offsetLeft, y: VV.offsetTop, w: VV.width, h: VV.height };
      var r = vp.getBoundingClientRect();
      return { x: 0, y: 0, w: r.width || document.documentElement.clientWidth, h: r.height || window.innerHeight };
    }
    function measure() {
      vh = view().h;
      pinH = pin.offsetHeight;
      T = Math.round((vh - pinH) / 2);
      L = Math.round(PIN * vh);
      pin.style.top = T + "px";
      track.style.height = (pinH + L) + "px";
    }
    // the video inside a box of w x h: contained, but allowed to crop a little to fill. Any
    // height left over goes above it: the clip's top edge is black in every frame, its
    // bottom edge is the lit floor.
    function fitVideo(w, h) {
      var s = Math.min(Math.max(w / clip.w, h / clip.h), w / (clip.w * (1 - 2 * MAXCROP_X)), h / (clip.h * (1 - 2 * MAXCROP_Y)));
      var W = clip.w * s, H = clip.h * s;
      video.style.width = W.toFixed(1) + "px"; video.style.height = H.toFixed(1) + "px";
      video.style.left = ((w - W) / 2).toFixed(1) + "px"; video.style.top = (h - H).toFixed(1) + "px";
      // a phone's black band above the clip fades into it (the close-ups' grey reaches the clip's top edge: W6 R2, V15)
      card.style.setProperty("--sp-vtop", (h - H).toFixed(1) + "px"); card.classList.toggle("sp-band", h - H > 1);
    }
    function ease(x) { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

    var lastOut = -1, lastW = -1, lastH = -1;
    // s: px scrolled past the pin point. Returns the target time fraction.
    function geometry() {
      var s = T - track.getBoundingClientRect().top;
      var a = PRE * vh, b = GROW * vh;
      var e = ease(Math.min((s + a) / (a + b), (L + a - s) / (a + b)));
      var out = e > 0.0005 ? e : 0;
      if (out !== lastOut || out > 0) {
        if (out === 0) {
          card.classList.remove("is-out");
          card.style.cssText = "";
        } else {
          var r = frame.getBoundingClientRect(), v = view();
          var l = r.left + (v.x - r.left) * out, t = r.top + (v.y - r.top) * out;
          var w = r.width + (v.w - r.width) * out, h = r.height + (v.h - r.height) * out;
          card.classList.add("is-out");
          card.style.left = l.toFixed(2) + "px"; card.style.top = t.toFixed(2) + "px";
          card.style.width = w.toFixed(2) + "px"; card.style.height = h.toFixed(2) + "px";
          card.style.borderRadius = (RADIUS * (1 - out)).toFixed(2) + "px";
        }
        lastOut = out;
      }
      var cw = out ? parseFloat(card.style.width) : frame.clientWidth;
      var chh = out ? parseFloat(card.style.height) : frame.clientHeight;
      if (Math.abs(cw - lastW) > 0.05 || Math.abs(chh - lastH) > 0.05) { fitVideo(cw, chh); lastW = cw; lastH = chh; }
      return Math.max(0, Math.min(1, (s - b) / Math.max(1, L - 2 * b)));
    }

    /* -------------------------------------------------------------- the clip */
    var objectURL = null, token = 0, ok = false, dur = 0;
    function load(which) {
      if (which === kind) return;
      kind = which; clip = SRC[which];
      var my = ++token;
      ok = false; seeking = false; mode = "seek";
      fig.classList.toggle("is-portrait", which === "phone");
      if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
      video.removeAttribute("src"); video.load();
      video.poster = clip.poster;
      measure(); lastW = -1; kickLoop();
      // Video Universe: iGEM's own player, driven through this <video> (../../js/vu-embed.js;
      // its files answer 403 to any other page since 16 Oct 2026)
      if (window.VUEmbed && VUEmbed.is(clip.src)) { VUEmbed.bind(video, clip.src, { scrub: true, aspect: clip.w / clip.h }); return; }
      var direct = function () { if (my === token) { video.src = clip.src; video.load(); } };
      if (!window.fetch || !window.Blob || !window.URL || !URL.createObjectURL) { direct(); return; }
      fetch(clip.src, { mode: "cors", credentials: "omit" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      }).then(function (blob) {
        if (my !== token) return;
        objectURL = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "video/mp4" }));
        video.src = objectURL; video.load();
      }).catch(function () { direct(); });
    }
    video.addEventListener("loadedmetadata", function () {
      dur = video.duration || 26.77; ok = true;
      // iOS Safari draws nothing for a seek on a video that has never played: a muted
      // play-and-pause wakes the decoder (scrub-video.js does the same).
      var pr = video.play();
      var go = function () { video.pause(); seeking = false; kickLoop(); };
      if (pr && pr.then) pr.then(go, go); else go();
    });
    video.addEventListener("error", function () {
      if (video.getAttribute("src")) console.warn("simplified-photometer clip unavailable; the poster stays");
    });

    /* -------------------------------------------------------------- the scrub */
    var t = 0, vel = 0, want = 0, last = 0, raf = 0, near = false, seeking = false, seekT0 = 0, l1 = 0, l2 = 0;
    var T0 = 0.042;
    var hasFast = typeof video.fastSeek === "function";
    var stats = { seeks: 0, fast: 0, ms: [], maxMs: 0, plays: 0, rates: 0, stops: {} };
    video.addEventListener("seeked", function () {
      if (!seeking) return;
      seeking = false;
      var ms = performance.now() - seekT0;
      stats.seeks++; stats.ms.push(ms); if (stats.ms.length > 400) stats.ms.shift();
      stats.maxMs = Math.max(stats.maxMs, ms);
      kickLoop();
    });
    function seek(now) {
      if (!ok || seeking) return;
      // the first frame is stamped 0.033 s, the last half a frame before the end
      var target = Math.max(T0, Math.min(dur - 1 / 120, t));
      if (!force && Math.abs(video.currentTime - target) < 1 / 120) return;
      force = false;
      seeking = true; seekT0 = now;
      if (hasFast && Math.abs(vel) > 6) { stats.fast++; video.fastSeek(target); }
      else video.currentTime = target;
    }

    // Playing along. In "play" the clip runs at `rate`; where it is comes from the player's own report
    // (every 0.5 s through Video Universe; at once for a plain <video>), carried forward at the rate in force
    // since then: every rate change re-anchors the estimate, and the player is given ~90 ms to start.
    var mode = "seek", rate = 1, anchorPos = 0, anchorAt = 0, repSeen = 0, rateAt = 0, force = false;
    var V_ON = 0.6, V_OFF = 0.25;            // clip seconds per second: start playing along, stop
    function vu() { return video.__vu || null; }
    function position(now) {
      if (mode !== "play") return video.currentTime;
      var S = vu();
      if (!S) return video.currentTime;      // a real <video> knows where it is
      if (S.rep && S.rep.at > repSeen && S.rep.at > anchorAt) { repSeen = S.rep.at; anchorPos = S.rep.pos; anchorAt = S.rep.at; }
      return anchorPos + rate * Math.max(0, now - anchorAt) / 1000;
    }
    function setRate(r, now) {
      if (mode === "play") { anchorPos = position(now); anchorAt = Math.max(anchorAt, now); }
      rate = Math.max(0.25, Math.min(16, r)); rateAt = now;
      try { video.playbackRate = rate; } catch (e) { /* the browser refused the rate: keep the old one */ }
      stats.rates++;
    }
    function startPlay(now) {
      anchorPos = video.currentTime; anchorAt = now + 90; repSeen = now;
      mode = "play"; stats.plays++;
      setRate(vel, now);
      var pr = video.play();
      if (pr && pr.catch) pr.catch(function () { mode = "seek"; force = true; });
    }
    function stopPlay() {
      mode = "seek";
      video.pause();
      seeking = false; force = true;         // then one exact seek to where the scroll is
    }
    function follow(now) {
      if (mode === "seek") {
        if (ok && !seeking && vel > V_ON && t < dur - 0.6 && Math.abs(t - video.currentTime) < 2.5) startPlay(now);
        else seek(now);
        return;
      }
      var x = position(now), e = t - x;
      var why = vel < V_OFF && e < 0.1 ? "still" : e < -0.6 ? "ahead" : e > 3 ? "behind" : t >= dur - 0.3 ? "end" : "";
      if (why) { stats.stops[why] = (stats.stops[why] || 0) + 1; stopPlay(); seek(now); return; }
      // the rate the scroll runs at, plus a pull toward it: behind, a little faster; ahead, a little slower
      var r = vel + e / 0.35;
      if (Math.abs(r - rate) > 0.2 * rate && now - rateAt > 200) setRate(r, now);
    }

    function step(now) {
      raf = 0;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      want = geometry() * (dur || 26.77);
      if (reduce) { t = l1 = l2 = want; vel = 0; }
      else {
        var t0 = t, n = Math.max(1, Math.ceil(dt / SUB)), k = 1 - Math.exp(-(dt / n) / TAU);
        for (var i = 0; i < n; i++) { l1 += (want - l1) * k; l2 += (l1 - l2) * k; t += (l2 - t) * k; }
        vel = dt > 0 ? (t - t0) / dt : 0;
      }
      var settled = Math.abs(t - want) < 1e-3 && Math.abs(l1 - want) < 1e-3 && Math.abs(l2 - want) < 1e-3;
      if (settled) { t = l1 = l2 = want; vel = 0; }
      follow(now);
      skipShow();
      if (near || !settled || seeking || mode === "play") raf = requestAnimationFrame(step);
    }
    function kickLoop() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }

    /* ------------------------------------------------------------ the Skip button */
    // In the card's corner while it is out (left of the page's "Jump to" hint on a desk), quiet until pointed at.
    // It goes straight past the pinned stretch: an instant scroll to where the card has settled back.
    var skip = document.createElement("button");
    skip.type = "button"; skip.className = "sp-skip";
    skip.setAttribute("aria-label", "Skip the animation");
    skip.innerHTML = '<span>Skip</span><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 2.2 6 5.6l3.5-3.4M2.5 6.4 6 9.8l3.5-3.4" ' +
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    card.appendChild(skip);
    skip.addEventListener("click", function () {
      var top = track.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop);
      var y = top - T + L + PRE * vh + 2;
      var html = document.documentElement, hb = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, Math.round(y));
      html.style.scrollBehavior = hb;
      if (cap) { if (!cap.hasAttribute("tabindex")) cap.setAttribute("tabindex", "-1"); try { cap.focus({ preventScroll: true }); } catch (e) { cap.focus(); } }
    });
    var skipOn = false, hintW = -1;
    function skipShow() {
      var on = lastOut > 0.35;
      if (on !== skipOn) { skipOn = on; skip.classList.toggle("is-on", on); }
      if (on && hintW < 0) {
        var hint = document.querySelector(".palette-hint"), hcs = hint && getComputedStyle(hint);
        var hr = hcs && hcs.display !== "none" && hcs.visibility !== "hidden" && +hcs.opacity > 0.05 ? hint.getBoundingClientRect() : null;
        hintW = hr && hr.width ? Math.round(window.innerWidth - hr.left + 10) : 18;
        skip.style.right = hintW + "px";
      }
    }
    window.addEventListener("resize", function () { hintW = -1; });

    /* ------------------------------------------------------------ lifecycle */
    // fetch when the reader is within about two screens; run the loop while the track is near
    var started = false;
    new IntersectionObserver(function (es) {
      near = es[0].isIntersecting;
      if (near && !started) { started = true; load(portrait.matches ? "phone" : "desktop"); }
      if (near) kickLoop();
    }, { rootMargin: "150% 0px" }).observe(track);
    window.addEventListener("scroll", kickLoop, { passive: true });
    var lastVW = 0, lastVH = 0;
    function onResize() {
      // a phone's toolbars sliding in and out change the height by ~100 px on every flick;
      // re-measuring the track then would jump the page, so only a real change counts (the
      // full-screen card follows the visible height every frame regardless)
      var v = view();
      if (Math.abs(v.w - lastVW) > 1 || Math.abs(v.h - lastVH) > 140) { measure(); lastVW = v.w; lastVH = vh; lastW = -1; }
      kickLoop();
    }
    window.addEventListener("resize", onResize);
    if (VV) VV.addEventListener("resize", onResize);
    if (portrait.addEventListener) portrait.addEventListener("change", function () { if (started) load(portrait.matches ? "phone" : "desktop"); });
    fig.classList.toggle("is-portrait", portrait.matches);
    video.poster = (portrait.matches ? SRC.phone : SRC.desktop).poster;
    clip = portrait.matches ? SRC.phone : SRC.desktop;
    measure(); lastVW = view().w; lastVH = vh;
    // the pin's height changes when the poster's box settles or fonts load
    if ("ResizeObserver" in window) new ResizeObserver(function () { var h = pin.offsetHeight; if (h !== pinH) { measure(); lastW = -1; kickLoop(); } }).observe(pin);

    window.__spClip = {
      stats: stats,
      summary: function () {
        var m = stats.ms.slice().sort(function (x, y) { return x - y; }), n = m.length;
        var q = function (f) { return n ? +m[Math.min(n - 1, Math.floor(f * n))].toFixed(1) : null; };
        return { seeks: stats.seeks, fast: stats.fast, plays: stats.plays, rates: stats.rates, stops: stats.stops, mean: n ? +(m.reduce(function (s, x) { return s + x; }, 0) / n).toFixed(1) : null, p50: q(0.5), p90: q(0.9), max: +stats.maxMs.toFixed(1) };
      },
      get state() { return { t: t, want: want, cur: video.currentTime, ok: ok, seeking: seeking, kind: kind, out: lastOut, L: L, T: T, dur: dur, blob: !!objectURL, mode: mode, rate: rate }; },
    };
  }
})();
