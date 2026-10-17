// VU embed — iGEM Video Universe's own player, standing in for a <video> element.
//
// 16 Oct 2026. static.igem.org stopped serving Video Universe files to any page but the
// Video Universe player itself: a direct request (a <video src>, or the fetch that loaded a
// clip whole into memory) now gets HTTP 403, "Embed this video with the player from
// https://video.igem.org". Every clip on the hardware pages stood still on its poster.
//
// The player is allowed. So for a Video Universe URL this puts the official embed (an
// iframe from video.igem.org) where the <video> is, drives it through PeerTube's embed API
// (jschannel over postMessage, scope "peertube"), and teaches that one <video> element to
// answer like the player: currentTime (reading and seeking), duration, readyState, paused,
// play(), pause(), and the events loadedmetadata / canplaythrough / seeked / playing /
// pause / error. The scroll scrubbers (js/scrub-video.js, photometer/js/sp-clip.js) and the
// hub film (js/hero-film.js) keep all their own logic; each only calls VUEmbed.bind()
// instead of setting a src.
//
//   - The <video> stays in the page and keeps showing its poster (or the scrubber's poster
//     <img> stays up) until the player has put its first frame on screen; then the iframe,
//     on top of it, fades in. The iframe never takes the pointer (pointer-events: none), so
//     the page scrolls through it.
//   - Placement: "mirror" (the default) copies the <video>'s own inline box onto the iframe
//     and keeps it copied, for the scrubbers that size the video themselves; "cover" sizes
//     the iframe to the clip's aspect so it covers the <video>'s parent, like object-fit:
//     cover (the hub film). The player inside always shows the clip at its own aspect.
//   - A seek reports "seeked" when the player has taken it (its API answers once
//     currentTime is set) and at least SETTLE ms have passed, so a scrubber that keeps one
//     seek in flight asks for one frame per SETTLE at most. 17 Oct 2026: 26 ms, from 45. Measured
//     inside the player (headless Chrome, M4, the hero clips once buffered): a seek takes 12-16 ms
//     (median) and 23-29 ms (p95), so 45 ms left the picture at 21 frames a second while the
//     scroll asked for more; at 26 ms nearly every seek still lands before the next one is sent.
//     The player is not asked whether its seek is done (its API cannot say), so a seek that is
//     slower than that (a segment still on its way) is replaced by the next one, as before.
//   - The handshake is retried every 120 ms (was 400) until the player answers, so a scrubber
//     does not wait up to 0.4 s longer than the player needs.
//   - The player is asked for its highest resolution once it lists them (Auto starts low).
//   - If the player does not answer in TIMEOUT ms the element fires "error", so every
//     caller falls back exactly as it did when a clip failed to load: the poster stays.
//   - 17 Oct 2026 (the owner: the hub film was "speeding up like crazy"; "stop anything from showing until the clips
//     have loaded"). Switching the player to its top resolution makes it drop what it has and reload: the picture went
//     black for ~1.5 s and jumped ~4 s ahead, just after the film had faded in. Now nothing is shown until the clip is
//     really playing at the resolution it will keep:
//       * a film (the hub, fit "cover"): the player warms up out of sight (autoplay, top resolution), and once it has
//         played steadily for about a second it is rewound to its start (its caller's seek: the hub's data-start, the
//         poster's own frame); it fades in only when it is moving again from there. The poster stays up the whole time, and stays for good if the player never gets
//         that far.
//       * a scrubber: it shows on the first seek that lands after the resolution switch (or after WARM_MAX ms if the
//         player lists no resolutions), so the switch's reload never happens on screen.
window.VUEmbed = (function () {
  "use strict";

  var HOST = "https://video.igem.org";
  var SETTLE = 26, PING = 120, TIMEOUT = 20000, SCOPE = "peertube::";
  var WARM_GIVEUP = 6000; // ms after a film is asked to play: shown even if its warm-up has not finished
  var WARM_MAX = 4000;   // ms: proceed without a resolution switch if the player has listed none by then

  function uuidOf(u) {
    var m = /\/hls\/([0-9a-f-]{36})\//i.exec(u) || /\/videos\/(?:watch|embed)\/([0-9a-f-]{36})/i.exec(u) ||
      /\/web-videos\/([0-9a-f-]{36})/i.exec(u);
    return m ? m[1].toLowerCase() : null;
  }
  function is(u) {
    return !!u && /^(https?:)?\/\/(static\.igem\.org\/peertube\/|video\.igem\.org\/)/i.test(u) && !!uuidOf(u);
  }

  function fire(el, type) {
    try { el.dispatchEvent(new Event(type)); } catch (e) { /* very old browsers: no Event constructor */ }
  }

  function setup(video, opt) {
    var frame = document.createElement("iframe");
    frame.className = "vu-embed";
    frame.setAttribute("allow", "autoplay; fullscreen");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("title", "");
    var BASE = "position:absolute;border:0;margin:0;padding:0;display:block;pointer-events:none;" +
      "background:transparent;transition:opacity .25s ease;";
    video.parentNode.insertBefore(frame, video.nextSibling);

    var S = {
      frame: frame, mode: opt.fit === "cover" ? "cover" : "mirror",
      uuid: null, ready: false, dur: NaN, cur: 0, playing: false, wantPlay: false, scrub: !!opt.scrub,
      shown: false, metaFired: false, inflight: false, issued: 0, pendingT: null, ids: 0, seekId: 0,
      aspect: 16 / 9, resSet: false, timer: 0, ping: 0, rate: 1, rep: null,
      resAt: 0, openedAt: 0, warm: 0, steady: 0, prevRep: null, rewindId: 0, startT: 0,
    };
    var opacity = "0";

    /* ------------------------------------------------------------- placement */
    function place() {
      if (S.mode === "mirror") {
        frame.style.cssText = BASE + (video.style.cssText || "") + ";opacity:" + opacity + ";";
        if (!video.style.width && !video.style.height) {
          frame.style.left = "0"; frame.style.top = "0"; frame.style.width = "100%"; frame.style.height = "100%";
        }
      } else {
        var box = video.parentNode, W = box.clientWidth, H = box.clientHeight;
        var s = Math.max(W / S.aspect, H);                 // cover: height of the clip box
        var h = s, w = s * S.aspect;
        if (w < W) { w = W; h = W / S.aspect; }
        frame.style.cssText = BASE + "left:" + ((W - w) / 2).toFixed(1) + "px;top:" + ((H - h) / 2).toFixed(1) +
          "px;width:" + w.toFixed(1) + "px;height:" + h.toFixed(1) + "px;opacity:" + opacity + ";";
      }
    }
    if ("MutationObserver" in window) new MutationObserver(place).observe(video, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", place);
    // A scrubber hides its poster the moment its first seek lands, and the player is then at
    // (or next to) the clip's first frame, which is the poster: show it at once, no fade. The
    // hub film fades in over its poster once it is really playing.
    function show() {
      if (S.shown) return;
      S.shown = true;
      var go = function () { opacity = "1"; place(); video.classList.add("vu-covered"); };
      if (S.scrub) { BASE = BASE.replace("transition:opacity .25s ease;", ""); go(); } else setTimeout(go, 120);
    }

    /* --------------------------------------------------------- the channel */
    // nothing is posted until the player's page has loaded: before that the iframe still holds
    // about:blank, whose origin is ours, and the browser warns about the mismatched target
    var loaded = false;
    frame.addEventListener("load", function () { loaded = !!S.uuid; });
    function send(o) {
      if (!loaded) return;
      try { frame.contentWindow.postMessage(JSON.stringify(o), HOST); } catch (e) { /* navigating */ }
    }
    function call(m, p) { var id = ++S.ids; send({ id: id, method: SCOPE + m, params: p }); return id; }

    window.addEventListener("message", function (ev) {
      if (ev.source !== frame.contentWindow || ev.origin !== HOST) return;
      loaded = true;                           // the player is talking, so its page is there
      var o = ev.data;
      if (typeof o === "string") { try { o = JSON.parse(o); } catch (e) { return; } }
      if (!o || typeof o !== "object") return;
      var m = o.method;
      if (m === SCOPE + "__ready") {
        if (o.params && o.params.type === "publish-request") send({ method: SCOPE + "__ready", params: { type: "publish-reply", publish: [] } });
        return;
      }
      if (m === SCOPE + "ready") { S.ready = true; clearInterval(S.ping); afterReady(); return; }
      if (m === SCOPE + "resolutionUpdate") {
        var list = o.params || [], best = null;
        list.forEach(function (r) {
          if (r && r.id >= 0 && r.height && (!best || r.height > best.height)) best = r;
          if (r && r.width && r.height) S.aspect = r.width / r.height;
        });
        if (best) { S.aspect = best.width / best.height; if (!S.resSet) { S.resSet = true; S.resAt = performance.now(); S.steady = 0; call("setResolution", best.id); } }
        place();
        return;
      }
      if (m === SCOPE + "playbackStatusUpdate") {
        var p = o.params || {};
        if (isFinite(p.duration) && p.duration > 0) { S.dur = p.duration; afterReady(); }
        if (!S.scrub && isFinite(p.position)) S.cur = p.position;
        // the player's own position and when it said so: a scrubber that plays along with the scroll (sp-clip.js)
        // carries it forward at the rate it set
        if (isFinite(p.position)) S.rep = { pos: p.position, at: performance.now(), playing: p.playbackState === "playing" };
        if (!S.scrub && isFinite(p.position)) warmStep(p.position, p.playbackState === "playing");
        return;
      }
      if (m === SCOPE + "playbackStatusChange") {
        if (o.params === "playing") {
          S.playing = true;
          if (S.scrub && !S.wantPlay) { call("pause"); return; }
          if (!S.scrub && S.warm === 2) { S.warm = 3; if (S.wantPlay) show(); }
          fire(video, "play"); fire(video, "playing");
          // autoplay starts the film before its caller has seeked it to its start frame: shown
          // only once the caller itself has asked to play
          if (!S.scrub && S.wantPlay && S.warm >= 3) show();
        } else if (o.params === "paused") {
          S.playing = false; fire(video, "pause");
        }
        return;
      }
      // an answer to one of our calls: the seek has been taken
      if (o.id && o.id === S.rewindId) { S.rewindId = 0; S.warm = 2; S.steady = 0; S.prevRep = null; call("play"); return; }
      if (o.id && o.id === S.seekId) seekLanded();
    });

    // The film's warm-up (see the header). warm: 0 warming out of sight, 1 rewinding to 0, 2 moving again from 0,
    // 3 shown. A status update counts as steady when the position moved 0.6-1.6x the wall time since the last one.
    function warmStep(pos, playing) {
      var now = performance.now(), prev = S.prevRep;
      S.prevRep = { pos: pos, at: now };
      if (!playing || !prev) { S.steady = 0; return; }
      var dt = (now - prev.at) / 1000, r = dt > 0.15 ? (pos - prev.pos) / dt : 0;
      S.steady = r > 0.6 && r < 1.6 ? S.steady + 1 : 0;
      if (S.warm === 0) {
        var resOk = S.resSet ? now - S.resAt > 400 : now - S.openedAt > WARM_MAX;
        if (resOk && S.steady >= 2) { S.warm = 1; call("pause"); S.rewindId = call("seek", S.startT); }
      } else if (S.warm === 2) {
        if (pos > S.startT + 0.02 && pos < S.startT + 3) {   // moving again from its start, by the poster's frame
          S.warm = 3;
          if (S.wantPlay) { fire(video, "playing"); show(); }
        }
      }
    }

    function afterReady() {
      if (!S.ready || !(S.dur > 0) || S.metaFired) return;
      S.metaFired = true;
      clearTimeout(S.timer);
      if (S.scrub) call("pause");
      fire(video, "loadedmetadata"); fire(video, "loadeddata"); fire(video, "canplay"); fire(video, "canplaythrough");
    }

    /* --------------------------------------------------------------- seeks */
    function seekTo(t) {
      if (!S.scrub && S.warm < 3) S.startT = t;       // a film's start point (the hub's data-start: the poster's frame)
      if (!S.ready) { S.cur = t; return; }
      if (S.inflight) { S.pendingT = t; return; }
      S.inflight = true; S.issued = performance.now(); S.cur = t;
      fire(video, "seeking");
      S.seekId = call("seek", t);
    }
    function scrubMayShow() {
      return S.resSet ? S.issued > S.resAt + 150 : performance.now() - S.openedAt > WARM_MAX;
    }
    function seekLanded() {
      var wait = Math.max(0, SETTLE - (performance.now() - S.issued));
      setTimeout(function () {
        S.inflight = false;
        // a scrubber's first frame waits for the resolution switch: until then the seek is asked again, and its
        // caller hears nothing, so its poster stays up (17 Oct 2026)
        if (S.scrub && !S.shown && !scrubMayShow()) {
          var again = S.pendingT !== null ? S.pendingT : S.cur; S.pendingT = null;
          setTimeout(function () { if (!S.inflight) seekTo(again); }, 200);
          return;
        }
        if (S.pendingT !== null) { var t = S.pendingT; S.pendingT = null; seekTo(t); return; }
        if (S.scrub) show();
        fire(video, "timeupdate"); fire(video, "seeked");
      }, wait);
    }

    /* ------------------------------------------- the <video> answers as the player */
    function def(name, d) { try { Object.defineProperty(video, name, Object.assign({ configurable: true }, d)); } catch (e) { /* ignore */ } }
    def("currentTime", { get: function () { return S.cur; }, set: function (v) { seekTo(+v || 0); } });
    def("duration", { get: function () { return S.dur; } });
    def("readyState", { get: function () { return S.ready && S.dur > 0 ? 4 : 0; } });
    def("paused", { get: function () { return !S.playing; } });
    def("seeking", { get: function () { return S.inflight; } });
    def("error", { get: function () { return null; } });
    def("play", { value: function () {
      S.wantPlay = true;
      // a film whose warm-up never completes in this browser (a player that does not report, or pauses out of
      // sight) still shows: after WARM_GIVEUP ms it is played and faded in as before
      if (!S.scrub && S.warm < 3 && !S.giveup) S.giveup = setTimeout(function () {
        S.giveup = 0;
        if (S.warm < 3 && S.wantPlay) { S.warm = 3; call("play"); fire(video, "playing"); show(); }
      }, WARM_GIVEUP);
      if (S.ready) call("play");
      if (S.playing && !S.scrub && S.warm >= 3) { fire(video, "playing"); show(); }
      return Promise.resolve();
    } });
    def("pause", { value: function () { S.wantPlay = false; if (S.ready) call("pause"); } });
    def("playbackRate", { get: function () { return S.rate; }, set: function (v) {
      v = +v; if (!(v > 0) || v === S.rate) return;
      S.rate = v; if (S.ready) call("setPlaybackRate", v);
    } });
    def("load", { value: function () { /* the player loads its own file */ } });
    def("fastSeek", { value: function (t) { seekTo(+t || 0); } });

    S.open = function (uuid, o) {
      if (uuid === S.uuid) return;
      S.uuid = uuid;
      S.ready = false; S.dur = NaN; S.metaFired = false; S.inflight = false; S.pendingT = null; S.resSet = false;
      S.shown = false; opacity = "0"; video.classList.remove("vu-covered");
      S.openedAt = performance.now(); S.resAt = 0; S.warm = 0; S.steady = 0; S.prevRep = null; S.rewindId = 0; S.startT = 0;
      if (o && o.aspect) S.aspect = o.aspect;
      place();
      var q = "?api=1&autoplay=1&muted=1&loop=" + (video.loop || (o && o.loop) ? 1 : 0) +
        "&controls=0&controlBar=0&title=0&warningTitle=0&peertubeLink=0&p2p=0";
      loaded = false;
      frame.src = HOST + "/videos/embed/" + uuid + q;
      clearInterval(S.ping);
      S.ping = setInterval(function () { if (S.ready) { clearInterval(S.ping); return; } send({ method: SCOPE + "__ready", params: { type: "publish-request", publish: [] } }); }, PING);
      clearTimeout(S.timer);
      S.timer = setTimeout(function () { if (!S.metaFired) { console.warn("Video Universe player did not answer; the poster stays"); fire(video, "error"); } }, TIMEOUT);
    };
    return S;
  }

  // Put the player where this <video> is and play <url> in it. Call again with another URL
  // (a phone turned on its side) to switch clips.
  function bind(video, url, opt) {
    opt = opt || {};
    var S = video.__vu || (video.__vu = setup(video, opt));
    S.open(uuidOf(url), opt);
    return S;
  }

  return { is: is, bind: bind, uuidOf: uuidOf };
})();
