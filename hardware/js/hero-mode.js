// Hero mode — the live WebGL story or the clip, decided once while the page is parsing; and the Skip button.
//
// The four instrument pages (photometer, LPA, hydroponics, bioreactor) open on a scroll-driven walkthrough. It can
// be drawn two ways, from the same story:
//   live3d  the WebGL story itself (js/story.js on three.js), drawn every frame at the screen's own resolution;
//   video   the pre-rendered clip of that story, scrubbed by the scroll (js/scrub-video.js), since 16 Oct 2026 played
//           inside iGEM's Video Universe player (js/vu-embed.js), because its files answer 403 to any other page.
//
// 17 Oct 2026, the owner: the scroll animations "take quite a while for the videos to load, and it looks very
// behind ... I want good quality and speed". Measured in headless Chrome on the M4 with the page served at 30 Mbit/s
// (dev/night-logs/2026-10-17-overnight/w3/), the clip in the Video Universe player:
//   - moved 2.9-4.3 s after the page opened (the player, its HLS playlists and the first segments come first);
//   - then showed 21 pictures a second while scrolling (one seek in flight, ~47 ms a round trip through the player).
// The live story moved after 1.0-1.4 s on a phone-sized window and 2.8-3.7 s on a retina desk, then drew 58-60
// pictures a second at the screen's own resolution, with the newest content (the clip of the LPA still shows the
// old 520/660 nm column labels). So the live story is the default now, and the clip is the fallback:
//   - no WebGL, or a software rasteriser (SwiftShader, llvmpipe, Microsoft Basic Render Driver);
//   - a weak device: 2 GB of memory or less, two cores or fewer;
//   - a device where the live story was measured too slow on an earlier visit (< 30 frames a second while it was on
//     screen; remembered for 30 days in localStorage, "heroSlow");
//   - or a page that asks for it (data-hero="video" on #story).
// While the live story loads, the clip's own first frame (the poster) stands in for it, so the opening is on screen
// as soon as that one image has arrived; the story takes over when it has drawn, and a thin line along the foot of
// the stage shows the load.
//
// The page's #story element names its clips:
//   data-src-desktop / data-src-phone        the two MP4s (16:9 and portrait)
//   data-poster-desktop / data-poster-phone  their first frames
// and the markup carries two <template>s, #hero-video and #hero-live3d, holding the script tags for each mode.
// load() writes ONE of them into the document right here, so its scripts run in order, before anything after this
// point, and the other mode's scripts are never fetched.
//
// The rule:
//   ?live3d=1                 the WebGL story (re-rendering the clips needs it)
//   ?video=1                  the clip, whatever else is true (testing)
//   otherwise the WebGL story, unless one of the fallback cases above holds and the clip can play here:
//     a clip given as a path next to the page (clips/...) plays on localhost only (those files are local test copies,
//     git-ignored, never deployed); an absolute URL plays anywhere; and the browser must decode H.264.
//
// THE SKIP BUTTON (owner, 17 Oct: "a skip animation button, subtle, for each (somewhere corner) so that if they view
// it for more than once, they can skip"). Injected here into every page's stage, whichever mode runs: a small pill in
// the bottom-right corner on a desk (left of the "Jump to" hint) and in the Back button's row, right, on a phone. It
// jumps straight to the record below the story (an instant scroll, not a smooth one through the whole scrub) and
// moves focus there. It steps aside while anything the story draws would sit under it, and is a little clearer for a
// visitor who has already watched this page's story to the end once (localStorage, "heroSeen:<page>").
window.HeroMode = (function () {
  "use strict";

  var SLOW_KEY = "heroSlow", SLOW_DAYS = 30;
  function sget(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: nothing kept */ } }

  /* ------------------------------------------------------------------ what this device can draw */
  var gl = null;
  function webgl() {
    if (gl) return gl;
    gl = { ok: false, soft: false, renderer: "" };
    try {
      var c = document.createElement("canvas");
      var g = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
      if (g) {
        gl.ok = true;
        var ext = g.getExtension("WEBGL_debug_renderer_info");
        gl.renderer = String((ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) || "");
        gl.soft = /swiftshader|llvmpipe|softpipe|basic render|software/i.test(gl.renderer);
        var lose = g.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();          // the story makes its own; this one must not count against the limit
      }
    } catch (e) { /* no WebGL */ }
    return gl;
  }
  function weak() {
    var n = navigator;
    if (n.deviceMemory && n.deviceMemory <= 2) return "memory";
    if (n.hardwareConcurrency && n.hardwareConcurrency <= 2) return "cores";
    if (webgl().soft) return "software";
    var t = +sget(SLOW_KEY);
    if (t && Date.now() - t < SLOW_DAYS * 864e5) return "slow";
    return "";
  }
  function clipOK(story) {
    var d = story ? story.dataset : {};
    var a = d.srcDesktop, b = d.srcPhone;
    if (!a || !b) return false;
    var h264 = "";
    try { h264 = document.createElement("video").canPlayType('video/mp4; codecs="avc1.640028"'); } catch (e) { /* no video */ }
    if (!h264) return false;
    var local = function (u) { return !/^(https?:)?\/\//i.test(u); };
    var dev = location.protocol === "file:" ||
      /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/.test(location.hostname);
    return !((local(a) || local(b)) && !dev);
  }

  var why = "";
  function decide(story) {
    var q = location.search;
    if (/[?&]live3d=1(?:&|$)/.test(q)) { why = "asked"; return "live3d"; }
    if (/[?&]video=1(?:&|$)/.test(q)) { why = "asked"; return "video"; }
    var clip = clipOK(story);
    if (!webgl().ok) { why = "no webgl"; return clip ? "video" : "live3d"; }
    if (clip && story && story.dataset.hero === "video") { why = "page"; return "video"; }
    var w = weak();
    if (w && clip) { why = w; return "video"; }
    why = "default";
    return "live3d";
  }

  /* ------------------------------------------------------------------ shared styles */
  function style() {
    if (document.getElementById("hm-style")) return;
    var st = document.createElement("style");
    st.id = "hm-style";
    st.textContent =
      // the poster that stands in for the live story while it loads
      ".story-stage>.hm-poster{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%;" +
        "display:block;pointer-events:none;opacity:0;transition:opacity .35s ease}" +
      ".story-stage>.hm-poster.is-phone{object-position:50% 30%}" +
      ".story-stage>.hm-poster.is-in{opacity:1;transition:none}" +
      ".story-stage>.hm-poster.is-in.is-out{opacity:0;transition:opacity .45s ease}" +
      ".story-stage.hm-postered .loader{opacity:0!important;pointer-events:none}" +
      ".story-stage>.hm-load{position:absolute;left:0;bottom:0;height:2px;width:100%;z-index:9;pointer-events:none;" +
        "background:rgba(255,255,255,.08);transition:opacity .5s ease}" +
      ".story-stage>.hm-load>i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--amber,#ffa040);opacity:.7;" +
        "transition:width .3s ease}" +
      ".story-stage>.hm-load.is-done{opacity:0}" +
      // the Skip button: small and quiet until it is pointed at or focused
      ".story-stage>.hm-skip{position:absolute;z-index:9;right:18px;bottom:18px;margin:0;display:inline-flex;align-items:center;" +
        "gap:.5rem;padding:.5rem .8rem .5rem .9rem;border:1px solid rgba(255,255,255,.16);border-radius:999px;" +
        "background:rgba(8,10,14,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:rgba(220,228,236,.82);" +
        "font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:.6rem;line-height:1;letter-spacing:.16em;" +
        "text-transform:uppercase;white-space:nowrap;cursor:pointer;opacity:.46;" +
        "transition:opacity .3s ease,border-color .25s ease,background .25s ease,color .25s ease}" +
      ".story-stage>.hm-skip::before{content:'';position:absolute;inset:-8px -6px}" +     // a finger-sized target
      ".story-stage>.hm-skip svg{width:10px;height:10px;flex:none;color:var(--amber,#ffa040)}" +
      ".story-stage>.hm-skip.is-known{opacity:.68}" +
      ".story-stage>.hm-skip:hover,.story-stage>.hm-skip:focus-visible{opacity:1;color:#fff;" +
        "border-color:color-mix(in srgb,var(--amber,#ffa040) 55%,transparent);background:rgba(8,10,14,.66)}" +
      ".story-stage>.hm-skip:focus-visible{outline:2px solid var(--amber,#ffa040);outline-offset:3px}" +
      ".story-stage>.hm-skip.is-tucked:not(:focus-visible){opacity:0;pointer-events:none}" +
      "@media (max-width:640px){.story-stage>.hm-skip .hm-long{display:none}}" +
      "@media (prefers-reduced-motion:reduce){.story-stage>.hm-poster,.story-stage>.hm-load,.story-stage>.hm-skip{transition:none!important}}" +
      "@media print{.story-stage>.hm-skip,.story-stage>.hm-load{display:none}}";
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ live3d: the poster first */
  function storyReady() {
    var s = window.__story;
    try { return !!(s && typeof s.ready === "function" && s.ready()); } catch (e) { return false; }
  }
  function posterFirst(story) {
    var stage = story.querySelector(".story-stage");
    var d = story.dataset;
    if (!stage || !(d.posterDesktop || d.posterPhone)) return;
    // the clip nearer the stage's aspect, as js/scrub-video.js picks it (the log-distance to 16:9 and 1080:2340)
    var a = (stage.clientWidth || innerWidth) / Math.max(1, stage.clientHeight || innerHeight);
    var phone = Math.abs(Math.log(a / (16 / 9))) > Math.abs(Math.log(a / (1080 / 2340)));
    var src = phone ? (d.posterPhone || d.posterDesktop) : (d.posterDesktop || d.posterPhone);
    var img = document.createElement("img");
    img.className = "hm-poster" + (phone ? " is-phone" : "");
    img.alt = ""; img.setAttribute("aria-hidden", "true"); img.decoding = "async";
    var canvas = stage.querySelector("canvas#gl");
    if (canvas) canvas.parentNode.insertBefore(img, canvas.nextSibling); else stage.insertBefore(img, stage.firstChild);
    var bar = document.createElement("div"); bar.className = "hm-load"; bar.setAttribute("aria-hidden", "true");
    var fill = document.createElement("i"); bar.appendChild(fill);
    var gone = false;
    img.onload = function () {
      if (gone || storyReady()) return;
      img.classList.add("is-in");
      stage.classList.add("hm-postered");
      stage.appendChild(bar);
      // the hydroponics title rises when its loader is hidden: let it rise over the poster now
      var ld = document.getElementById("loader");
      if (ld) ld.classList.add("hide");
    };
    img.onerror = function () { img.remove(); };
    img.src = src;
    var pct = document.getElementById("load-pct");
    function progress() {
      if (!pct) return;
      var m = /(\d+)\s*%/.exec(pct.textContent || "");
      if (m) fill.style.width = Math.min(100, +m[1]) + "%";
    }
    if (pct && "MutationObserver" in window) new MutationObserver(progress).observe(pct, { childList: true, characterData: true, subtree: true });
    var t0 = performance.now();
    (function poll() {
      if (storyReady()) {
        gone = true;
        fill.style.width = "100%";
        bar.classList.add("is-done");
        img.classList.add("is-out");
        stage.classList.remove("hm-postered");
        setTimeout(function () { img.remove(); bar.remove(); }, 600);
        watchPace(stage);
        return;
      }
      if (performance.now() - t0 > 120000) return;      // never ready (a failed load): the poster stays
      requestAnimationFrame(poll);
    })();
  }

  // The live story's pace on this device. If, after it has settled, it runs under 30 frames a second while on screen,
  // the next visit plays the clip instead (when this page has one that can play here).
  function watchPace(stage) {
    if (!("IntersectionObserver" in window)) return;
    var on = false, last = 0, iv = [], skipUntil = performance.now() + 2500, done = false;
    new IntersectionObserver(function (es) { on = es[0].isIntersecting; last = 0; }, { threshold: 0.5 }).observe(stage);
    (function tick(now) {
      if (done) return;
      if (on && !document.hidden && now > skipUntil) {
        if (last) iv.push(now - last);
        last = now;
        if (iv.length >= 150) {
          var s = iv.slice().sort(function (x, y) { return x - y; }), med = s[s.length >> 1];
          if (med > 34) sset(SLOW_KEY, String(Date.now()));
          else if (med < 22 && sget(SLOW_KEY)) { try { window.localStorage.removeItem(SLOW_KEY); } catch (e) { /* */ } }
          window.__heroPace = { median: med, frames: iv.length };
          done = true; return;
        }
      } else last = 0;
      requestAnimationFrame(tick);
    })(performance.now());
  }

  /* ------------------------------------------------------------------ the Skip button */
  function navH() {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nv-h"));
    if (v > 0) return v;
    var n = document.getElementById("site-nav");
    if (n) { var r = n.getBoundingClientRect(); if (r.top <= 1 && r.height > 0 && r.height < 160) return r.height; }
    return 0;
  }
  function skipTo(story) {
    var y = story.getBoundingClientRect().bottom + (window.pageYOffset || document.documentElement.scrollTop) - navH();
    var html = document.documentElement, body = document.body;
    var hb = html.style.scrollBehavior, bb = body.style.scrollBehavior;
    html.style.scrollBehavior = "auto"; body.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.max(0, Math.round(y)));
    html.style.scrollBehavior = hb; body.style.scrollBehavior = bb;
    // keyboard and screen-reader users land where the eye does: the first block after the story
    var next = story.nextElementSibling;
    while (next && (next.offsetParent === null || /^(SCRIPT|TEMPLATE|STYLE|LINK)$/.test(next.tagName))) next = next.nextElementSibling;
    if (next) {
      var target = next.querySelector("h1, h2, h3, section") || next;
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }
  }

  // Elements a page draws over its stage that the button must never sit on: the captions, titles, numbers, labels,
  // the bioreactor's route line, the photometer's readouts, the hydroponics caption panel.
  var AVOID = ".hud .cap, .story-title, .title-stats, .endline, .b2-key, .route-m, .lb, .ro, .readout, #panel, .rail";
  function skipButton(story) {
    var stage = story.querySelector(".story-stage");
    if (!stage || stage.querySelector(".hm-skip")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "hm-skip";
    b.setAttribute("aria-label", "Skip the animation");
    b.innerHTML = '<span>Skip<span class="hm-long"> animation</span></span>' +
      '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 2.2 6 5.6l3.5-3.4M2.5 6.4 6 9.8l3.5-3.4" ' +
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    stage.appendChild(b);
    var page = (document.body && document.body.getAttribute("data-instrument")) || location.pathname.replace(/\/index\.html$/, "").split("/").pop();
    var seenKey = "heroSeen:" + page;
    if (sget(seenKey)) b.classList.add("is-known");
    b.addEventListener("click", function () { skipTo(story); });

    // where it sits: desk, the bottom-right corner, left of the "Jump to" hint when that is shown; phone (no hint),
    // the Back button's row, at its right
    var back = stage.querySelector(".backbtn--stage");
    function place() {
      var phone = window.innerWidth <= 700;
      b.style.top = b.style.bottom = b.style.right = "";
      if (phone) {
        var bt = back ? back.offsetTop : 14, bh = back ? back.offsetHeight : 0, h = b.offsetHeight || 28;
        b.style.top = Math.round(bt + (bh - h) / 2) + "px"; b.style.bottom = "auto";
        b.style.right = Math.round(back ? Math.max(14, back.offsetLeft) : 14) + "px";
      } else {
        var hint = document.querySelector(".palette-hint"), hcs = hint && getComputedStyle(hint);
        var hr = hcs && hcs.display !== "none" && hcs.visibility !== "hidden" && +hcs.opacity > 0.05 ? hint.getBoundingClientRect() : null;
        var sr = stage.getBoundingClientRect();
        if (hr && hr.width) {
          b.style.right = Math.round(sr.right - hr.left + 10) + "px";
          b.style.bottom = Math.round(Math.max(12, sr.bottom - hr.bottom)) + "px";
        }
      }
    }
    place();
    window.addEventListener("resize", place);
    // the "Jump to" hint is appended by polish.js after this script has run: place again the moment it exists
    // (W6 R2, V2: the two pills printed on top of each other for about 1.5 s on every desktop load)
    if (!document.querySelector(".palette-hint") && "MutationObserver" in window) {
      var hintMo = new MutationObserver(function () {
        if (document.querySelector(".palette-hint")) { hintMo.disconnect(); place(); }
      });
      hintMo.observe(document.body, { childList: true });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    // the hint is added by the page's own script, after this one, and a page may show or hide it later: placed
    // again once a second while the stage is on screen (in the loop below)

    // step aside from anything the story puts in that corner; note a visit that reached the end
    var on = true, n = 0, seen = !!sget(seenKey);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; if (on) loop(); }, { threshold: 0 }).observe(stage);
    function overlaps(r, el) {
      if (el === b) return false;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.06) return false;
      var q = el.getBoundingClientRect();
      if (!q.width || !q.height) return false;
      return q.left < r.right + 6 && q.right > r.left - 6 && q.top < r.bottom + 6 && q.bottom > r.top - 6;
    }
    var running = false;
    function loop() {
      if (running) return;
      running = true;
      (function tick() {
        if (!on || document.hidden) { running = false; return; }
        if (n % 60 === 0) place();
        if (++n % 6 === 0) {
          var r = b.getBoundingClientRect(), hit = stage.classList.contains("hm-busy-tr") && window.innerWidth <= 700;
          if (!hit) {
            var els = stage.querySelectorAll(AVOID);
            for (var i = 0; i < els.length && !hit; i++) hit = overlaps(r, els[i]);
          }
          b.classList.toggle("is-tucked", hit);
          if (!seen) {
            var sr = story.getBoundingClientRect(), span = story.offsetHeight - stage.offsetHeight;
            if (span > 0 && -sr.top / span >= 0.97) { seen = true; sset(seenKey, "1"); }
          }
        }
        requestAnimationFrame(tick);
      })();
    }
    loop();
  }

  /* ------------------------------------------------------------------ load */
  var mode = null;
  function load() {
    var story = document.getElementById("story");
    mode = decide(story);
    document.documentElement.classList.add("hero-" + mode);
    document.documentElement.setAttribute("data-hero-why", why);
    style();
    if (story) {
      if (mode === "live3d") posterFirst(story);
      skipButton(story);
    }
    var tpl = document.getElementById("hero-" + mode);
    // document.write while parsing: the template's scripts become ordinary
    // parser-inserted scripts and run in order, right after this one.
    if (tpl) document.write(tpl.innerHTML);
    return mode;
  }

  return { decide: decide, load: load, webgl: webgl, skipTo: skipTo, get mode() { return mode; }, get why() { return why; } };
})();
