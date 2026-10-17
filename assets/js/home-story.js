/* =============================================================================
   ReLeaf homepage: THE STORIES. Plays the walkthrough (#solution) and inside
   the cell (#cell) as one continuous drawing each, scrubbed by the scroll.
   18 Oct (owner: "not all the text should change every time, look at
   Lambert's more carefully, it should also be one smooth animation"). The
   model is Lambert-GA's RNAi player (2026): the subject held on one side; on
   the other a card whose heading stays, one scene that never cuts, and one
   short caption under it that changes at each beat. Replaces home-how.js.
   -----------------------------------------------------------------------------
   Markup: the section carries data-story (the scene's name in
   window.__homeScenes, home-scenes.js) and data-story-runway, three lengths
   in screens: the intro card, the scene, the exit. Inside it:
     data-story-run    the runway
     data-story-stage  the screen that holds
     data-story-intro  the card's first face, if any (crossfades to the scene)
     data-story-svg    the scene, one SVG; every moving part is a <g data-k>
     data-cap          the captions, in order
     data-story-play, data-story-next  the two buttons
   data-story-beat adds the opening beat (--st-in, 0 to 1, as the section
   rises into view); --st-intro (0 on the intro, 1 on the scene) and --st-out
   (0 to 1 over the exit) are written on the section for the CSS.

   HOSTED (18 Oct, ReLEAF homepage #how): data-story-host names a pinned
   scene that holds this section in its own screen (#dx, home.js piece 7).
   While that scene runs (.is-live on it), its runway is this one's, read in
   screens from the moment it pins under the nav, and the drawing starts
   data-story-lead screens in; .is-hosted on the section, and the host moves
   and fades the card itself, so there is no opening beat. Otherwise the
   section runs on its own runway as above.

   THE SCENE. A scene is a time line T0..T1 in its own units (about one a
   second when played). Each part has a track of keyframes, [time, {x, y, r,
   s, a, d}, ease], read as offsets from where the markup draws it: x and y
   move it, r turns it (degrees), s scales it, a is its opacity, d draws its
   stroke (paths with pathLength="1"). b > 0 gives it a gentle drift that
   follows T, so nothing moves while the reader is still. The camera is a
   track of {x, y, w}: the point it centres and the width it shows.

   LIVE wherever the screen is tall enough (min-height 560px), script runs
   and the scene's parts are found; the scroll drives T through a short
   exponential ease, so a flick of the wheel glides. With reduced motion T
   jumps from rest to rest and the captions switch without moving. The play
   button runs T at one unit a second by moving the page; any real scroll
   takes over. Everywhere else (no script, short screens) nothing here runs:
   the scene stands still in its overview and the captions are a list.
   ========================================================================== */

(function () {
  "use strict";
  if (!window.matchMedia || !window.requestAnimationFrame) return;

  var EASE = {
    io: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    "in": function (t) { return t * t * t; },
    sine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    lin: function (t) { return t; }
  };
  var BASE = { x: 0, y: 0, r: 0, s: 1, a: 1, d: 1, b: 0 };
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }

  // a track: keyframes carry forward what they do not name
  function track(keys, base) {
    var cur = {}, k;
    for (k in (base || BASE)) cur[k] = (base || BASE)[k];
    return keys.map(function (f) {
      var v = {}, j;
      for (j in cur) v[j] = cur[j];
      for (j in f[1]) v[j] = f[1][j];
      cur = v;
      return { t: f[0], v: v, e: EASE[f[2] || "io"] };
    });
  }
  function at(tr, t) {
    if (t <= tr[0].t) return tr[0].v;
    for (var i = 1; i < tr.length; i++) {
      var b = tr[i];
      if (t <= b.t) {
        var a = tr[i - 1], u = b.e((t - a.t) / Math.max(1e-6, b.t - a.t)), o = {}, k;
        for (k in b.v) o[k] = a.v[k] + (b.v[k] - a.v[k]) * u;
        return o;
      }
    }
    return tr[tr.length - 1].v;
  }
  // the scenes file uses these
  window.__homeScene = { track: track, at: at, ease: EASE, smooth: smooth };

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fits = window.matchMedia("(min-height: 560px)");
  function navH() {
    var v = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
    return v > 0 ? v : 68;
  }

  function boot() {
    var defs = window.__homeScenes || {};
    [].forEach.call(document.querySelectorAll("[data-story]"), function (sec) {
      var def = defs[sec.getAttribute("data-story")];
      if (def) mount(sec, def);
    });
  }

  function mount(sec, def) {
    var ownRun = sec.querySelector("[data-story-run]"), stage = sec.querySelector("[data-story-stage]");
    var run = ownRun;
    var host = sec.getAttribute("data-story-host") ? document.querySelector(sec.getAttribute("data-story-host")) : null;
    var LEAD = parseFloat(sec.getAttribute("data-story-lead")) || 0, hosted = false;
    var svg = sec.querySelector("[data-story-svg]");
    var caps = [].slice.call(sec.querySelectorAll("[data-cap]"));
    var intro = sec.querySelector("[data-story-intro]");
    var play = sec.querySelector("[data-story-play]"), next = sec.querySelector("[data-story-next]");
    if (!run || !stage || !svg || !caps.length) return;
    var len = (sec.getAttribute("data-story-runway") || "0 2.6 0.5").split(/\s+/).map(Number);
    var IN0 = intro ? len[0] : 0, IN = IN0, MECH = len[1], EXIT = len[2] || 0;
    var beat0 = sec.hasAttribute("data-story-beat"), beat = beat0;
    sec.style.setProperty("--st-len", String(IN + MECH + EXIT));

    // the moving parts: each <g data-k> with its markup position as its base
    var parts = {};
    [].forEach.call(svg.querySelectorAll("[data-k]"), function (el, i) {
      var m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(el.getAttribute("transform") || "");
      parts[el.getAttribute("data-k")] = { el: el, x: m ? +m[1] : 0, y: m ? +m[2] : 0, ph: i * 1.7,
        draw: el.hasAttribute("data-draw") ? [].slice.call(el.querySelectorAll("path, line, polyline")).concat(el.matches("path") ? [el] : []) : null,
        label: el.hasAttribute("data-label"), was: "" };
    });
    var tracks = def.parts || {};
    var view0 = svg.getAttribute("viewBox");
    var paths = {};
    [].forEach.call(svg.querySelectorAll("[data-path]"), function (p) {
      paths[p.getAttribute("data-path")] = { el: p, len: p.getTotalLength ? p.getTotalLength() : 0 };
    });
    var ctx = {
      svg: svg, parts: parts, paths: paths,
      along: function (name, f) {
        var p = paths[name];
        if (!p || !p.len) return { x: 0, y: 0 };
        var q = p.el.getPointAtLength(clamp01(f) * p.len);
        return { x: q.x, y: q.y };
      },
      place: place
    };
    if (def.setup) def.setup(ctx);

    var live = false, shown = -1, target = 0, playing = false, last = 0, raf = 0, cur = -1;
    var zoom = 1, boxW = 1, boxH = 1, inWas = -1, introWas = -1, outWas = -1;

    function place(name, v, T) {
      var p = parts[name];
      if (!p) return;
      var x = p.x + (v.x || 0), y = p.y + (v.y || 0), r = v.r || 0, s = v.s === undefined ? 1 : v.s;
      if (v.b) { x += v.b * 2.2 * Math.sin(T * 0.9 + p.ph); y += v.b * 3.4 * Math.sin(T * 1.3 + p.ph * 1.3); r += v.b * 1.6 * Math.sin(T * 0.7 + p.ph * 1.7); }
      if (p.label) s *= Math.max(1, 11 / (15 * zoom));
      var tf = "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")" + (r ? " rotate(" + r.toFixed(2) + ")" : "") + (s !== 1 ? " scale(" + s.toFixed(4) + ")" : "");
      var a = v.a === undefined ? 1 : v.a, key = tf + "|" + a.toFixed(3) + "|" + (v.d === undefined ? "" : v.d.toFixed(4));
      if (key === p.was) return;
      p.was = key;
      p.el.setAttribute("transform", tf);
      p.el.style.opacity = a >= 0.999 ? "" : a.toFixed(3);
      p.el.style.visibility = a <= 0.002 ? "hidden" : "";
      if (p.draw && v.d !== undefined) p.draw.forEach(function (d) { d.style.strokeDashoffset = (1 - v.d).toFixed(4); });
    }

    function measure() {
      var r = svg.getBoundingClientRect();
      boxW = Math.max(1, r.width); boxH = Math.max(1, r.height);
    }
    function beatAt(T) {
      var i = 0;
      while (i < def.beats.length && T >= def.beats[i]) i++;
      return i;
    }
    function scene(T) {
      var still = reduced.matches, idx = beatAt(T);
      if (still) T = def.rests[idx];
      // the camera is framed for a wide box; a squarer one (a phone) moves
      // in a little, so the subject still fills it
      var cam = at(def.cam, T), asp = boxW / boxH, w = cam.w * (asp < 1.35 ? Math.max(0.74, asp / 1.35) : 1), h = w * boxH / boxW;
      zoom = boxW / w;
      svg.setAttribute("viewBox", (cam.x - w / 2).toFixed(2) + " " + (cam.y - h / 2).toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2));
      for (var k in tracks) place(k, at(tracks[k], T), T);
      if (def.frame) def.frame(T, ctx);
      caps.forEach(function (c, i) {
        var o;
        if (still) o = i === idx ? 1 : 0;
        else {
          var fin = i === 0 ? 1 : smooth((T - def.beats[i - 1] + 0.18) / 0.36);
          var fout = i === caps.length - 1 ? 1 : 1 - smooth((T - def.beats[i] + 0.18) / 0.36);
          o = fin * fout;
        }
        c.style.opacity = o.toFixed(3);
        c.style.transform = o >= 0.999 ? "" : "translateY(" + ((1 - o) * 8).toFixed(1) + "px)";
        c.setAttribute("aria-hidden", String(i !== idx));
      });
      if (idx !== cur) {
        cur = idx;
        sec.setAttribute("data-beat", String(idx));
        if (next) {
          var end = idx >= caps.length - 1;
          next.setAttribute("aria-label", end ? "Start again" : "Next step");
          next.classList.toggle("is-again", end);
        }
      }
    }

    // the runway in screens: u = how far its top has gone above the screen's
    function travelU() {
      var top = run.getBoundingClientRect().top;
      return ((hosted ? navH() : 0) - top) / window.innerHeight;
    }
    function runTop() { return window.scrollY + run.getBoundingClientRect().top - (hosted ? navH() : 0); }
    function sceneT(u) { return def.T0 + clamp01((u - IN) / MECH) * (def.T1 - def.T0); }
    function uOfT(T) { return IN + (T - def.T0) / (def.T1 - def.T0) * MECH; }

    function paint(u) {
      shown = u;
      if (intro) {
        var iv = Math.round(smooth((u - (IN - 0.32)) / 0.3) * 1000) / 1000;
        if (iv !== introWas) {
          introWas = iv; sec.style.setProperty("--st-intro", String(iv));
          intro.setAttribute("aria-hidden", String(iv > 0.5)); intro.inert = iv > 0.5;
        }
      }
      if (EXIT) {
        var ov = Math.round(clamp01((u - IN - MECH) / EXIT) * 1000) / 1000;
        if (ov !== outWas) {
          outWas = ov;
          sec.style.setProperty("--st-out", String(ov));
          sec.style.setProperty("--st-oute", EASE.io(ov).toFixed(4));
        }
      }
      if (beat) {
        var top = run.getBoundingClientRect().top, H = window.innerHeight;
        var pre = clamp01(top / Math.max(1, H * 0.9)), t = 1 - pre;
        var iv2 = Math.round((1 - Math.pow(1 - t, 3)) * 1000) / 1000;
        if (iv2 !== inWas) { inWas = iv2; sec.style.setProperty("--st-in", String(iv2)); }
        if ((pre > 0) !== sec.classList.contains("is-approach")) sec.classList.toggle("is-approach", pre > 0);
      }
      scene(sceneT(u));
    }

    function tick(now) {
      raf = 0;
      if (!live) return;
      var dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      if (playing) {
        var u = shown + dt * MECH / (def.T1 - def.T0);
        if (u >= IN + MECH) { u = IN + MECH; stop(); }
        window.scrollTo(0, runTop() + u * window.innerHeight);
        target = u; paint(u);
        if (playing) raf = requestAnimationFrame(tick);
        return;
      }
      target = travelU();
      var v = reduced.matches || shown < -5 ? target : shown + (target - shown) * (1 - Math.exp(-dt * 7));
      if (Math.abs(target - v) < 0.0004) v = target;
      paint(v);
      if (v !== target) raf = requestAnimationFrame(tick);
    }
    function kick() {
      if (!live || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      if (!playing) return;
      playing = false;
      if (play) { play.setAttribute("aria-pressed", "false"); play.setAttribute("aria-label", "Play"); play.classList.remove("is-playing"); }
    }
    function start() {
      if (playing) return;
      var u = travelU();
      if (u >= IN + MECH - 0.01 || u < IN) { window.scrollTo(0, runTop() + IN * window.innerHeight); shown = IN; }
      playing = true;
      if (play) { play.setAttribute("aria-pressed", "true"); play.setAttribute("aria-label", "Pause"); play.classList.add("is-playing"); }
      kick();
    }
    function seek(i) {
      stop();
      var u = uOfT(def.rests[i]);
      window.scrollTo({ top: runTop() + u * window.innerHeight, behavior: reduced.matches ? "auto" : "smooth" });
    }
    if (play) play.addEventListener("click", function () { if (playing) stop(); else start(); });
    if (next) next.addEventListener("click", function () {
      var u = travelU();
      seek(u < IN ? 0 : (cur + 1) % def.rests.length);
    });
    ["wheel", "touchstart", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, stop, { passive: true });
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); });

    // the chapters rail calls the section current once its stage holds
    // (hosted: once the card is most of the way in, a little before LEAD)
    sec.__chapterTop = function () {
      if (live && hosted) return run.getBoundingClientRect().top - navH() + (IN - 0.4 + 0.34) * window.innerHeight;
      return live ? run.getBoundingClientRect().top + window.innerHeight * 0.55 : sec.getBoundingClientRect().top;
    };

    function decide() {
      live = fits.matches;
      hosted = live && !!host && host.classList.contains("is-live");
      run = hosted ? host : ownRun;
      IN = hosted ? LEAD : IN0;
      beat = beat0 && !hosted;
      sec.classList.toggle("is-hosted", hosted);
      sec.classList.toggle("is-live", live);
      if (!live) {
        stop();
        ["--st-in", "--st-out", "--st-oute", "--st-intro"].forEach(function (p) { sec.style.removeProperty(p); });
        sec.classList.remove("is-approach");
        svg.setAttribute("viewBox", view0);
        for (var k in parts) { parts[k].el.removeAttribute("style"); parts[k].was = ""; parts[k].el.setAttribute("transform", "translate(" + parts[k].x + " " + parts[k].y + ")"); }
        caps.forEach(function (c) { c.removeAttribute("style"); c.removeAttribute("aria-hidden"); });
        if (intro) { intro.removeAttribute("aria-hidden"); intro.inert = false; }
        return;
      }
      if (!beat) { sec.style.removeProperty("--st-in"); sec.classList.remove("is-approach"); }
      measure();
      shown = -10; inWas = introWas = outWas = -1;
      kick();
    }
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", function () { if (live) { measure(); shown = -10; } decide(); });
    if (fits.addEventListener) { fits.addEventListener("change", decide); reduced.addEventListener("change", decide); }
    // the host turns its scene on and off as the screen changes (and once
    // fonts and pictures are in): follow it
    if (host && "MutationObserver" in window) {
      var wasHost = host.classList.contains("is-live");
      new MutationObserver(function () {
        var on = host.classList.contains("is-live");
        if (on !== wasHost) { wasHost = on; decide(); }
      }).observe(host, { attributes: true, attributeFilter: ["class"] });
    }
    decide();
  }

  // home-scenes.js (loaded after this file) defines the scenes with the
  // helpers above; both are deferred, so they have run by DOMContentLoaded
  var booted = false;
  function once() { if (!booted) { booted = true; boot(); } }
  if (document.readyState === "complete") once();
  else document.addEventListener("DOMContentLoaded", once);
})();
