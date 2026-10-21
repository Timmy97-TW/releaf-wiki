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
//   - 18 Oct 2026, the owner: "remove the video loading spinning circle thing". The circle is the player's own
//     (video.js .vjs-loading-spinner, inside the cross-origin iframe, so no style of ours reaches it; its
//     foregroundColor parameter does not hide it either, measured). It appears when a seek or the playback has
//     waited 1.1 s for data, and fades in over 0.3 s. Before the first frame the iframe is already invisible (the
//     poster shows). After it, a stall is seen from out here: a seek still unanswered after HUSH_SEEK ms, or a
//     playing clip whose reported position has not moved for HUSH_PLAY ms. For as long as it lasts, a "hush" lies over
//     the player: the frozen frame is softened a little (backdrop blur 3 px) and its centre, where the circle
//     turns, strongly (a soft disc, blur 26 px), so the circle is gone and the frame reads as a held, defocused
//     still. It lifts the moment the player moves again. Nothing of ours spins anywhere.
//   - 18 Oct 2026, the same pass: the player also flashes its own play/pause "bezel" (a dark disc with a II or a
//     triangle, growing and fading at the centre for 0.5 s) on every play() and pause() its API is sent, and a
//     scrubber that plays along with the scroll sends them each time the scroll starts and stops. A scrubber's clip
//     is therefore never paused once it is playing: "pause" holds it at playback rate 0 and "play" restores the rate
//     (measured in the player: at rate 0 it stays put, seeks land and show their frame, nothing waits, no bezel). The
//     autoplay that starts it happens while the player is still invisible. If the player ever moves while held (a
//     reload after the resolution switch could reset its rate), the hold is sent again and it is put back.
//   - 18 Oct 2026, and the first frame: the player answers a seek before it has the frame, so on a slow line a
//     scrubber's iframe used to appear on a black, still-loading picture with the circle turning in it. Now a
//     scrubber's clip first plays (out of sight, autoplay, after the resolution switch) until the player reports it
//     really moving (warmed: its position advancing between two reports, i.e. data is flowing); only then is it held
//     and sent to the scrubber's frame, and the iframe shows when that seek lands. Seeks asked for meanwhile are
//     kept, not sent (the last one is sent at the end of the warm-up). If it never moves (autoplay refused) it goes
//     on after WARM_GIVEUP ms, as before.
window.VUEmbed = (function () {
  "use strict";

  var HOST = "https://video.igem.org";
  var SETTLE = 26, PING = 120, TIMEOUT = 20000, SCOPE = "peertube::";
  var WARM_GIVEUP = 6000; // ms after a film is asked to play: shown even if its warm-up has not finished
  var WARM_MAX = 4000;   // ms: proceed without a resolution switch if the player has listed none by then
  var HUSH_SEEK = 750, HUSH_PLAY = 650;  // ms: a stall this long gets the hush (the player's circle shows at 1100 ms)
  function hushStyle() {
    if (document.getElementById("vu-hush-style")) return;
    var st = document.createElement("style");
    st.id = "vu-hush-style";
    st.textContent =
      ".vu-hush{position:absolute;pointer-events:none;opacity:0;transition:opacity .18s ease;" +
        "-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}" +
      ".vu-hush.is-disc{-webkit-backdrop-filter:blur(26px);backdrop-filter:blur(26px);" +
        "-webkit-mask:radial-gradient(closest-side,#000 52%,transparent);mask:radial-gradient(closest-side,#000 52%,transparent)}" +
      ".vu-hush.is-on{opacity:1}" +
      "@media (prefers-reduced-motion:reduce){.vu-hush{transition:none}}";
    document.head.appendChild(st);
  }

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
  // 18 Oct 2026 (the owner: "if the animation isn't fully loaded yet then leave the screen on loading"): how far the
  // player has got towards its first true frame, 0-1, by stage (S.t keeps when each stage was reached, page ms):
  //   open .05, the player's page loaded .2, its API ready .4, the top resolution asked for .55, moving at it .75,
  //   warmed (a scrubber held at its frame) .9, the first frame on screen 1. The <video> hears "vuprogress" with
  //   video.vuProgress set; ../js/scrub-video.js turns it into the hero's loading bar.
  function stage(S, video, name, f) {
    if (!S.t[name]) S.t[name] = Math.round(performance.now());
    if (f > S.prog) { S.prog = f; video.vuProgress = f; fire(video, "vuprogress"); }
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
    // the hush (see the header): two siblings over the player, so each backdrop filter sees the player itself
    hushStyle();
    var hush = document.createElement("div"), disc = document.createElement("div");
    hush.className = "vu-hush"; disc.className = "vu-hush is-disc";
    hush.setAttribute("aria-hidden", "true"); disc.setAttribute("aria-hidden", "true");
    frame.parentNode.insertBefore(disc, frame.nextSibling);
    frame.parentNode.insertBefore(hush, frame.nextSibling);

    var S = {
      frame: frame, mode: opt.fit === "cover" ? "cover" : "mirror",
      uuid: null, ready: false, dur: NaN, cur: 0, playing: false, wantPlay: false, scrub: !!opt.scrub,
      shown: false, metaFired: false, inflight: false, issued: 0, pendingT: null, ids: 0, seekId: 0,
      aspect: 16 / 9, resSet: false, timer: 0, ping: 0, rate: 1, rep: null, advAt: 0, advPos: -1, hushed: false, hushes: 0,
      warmed: false, wantHold: false, held: false, heldAt: 0, swarm: 0, swarmT: 0, swarmAt: 0,
      resAt: 0, openedAt: 0, warm: 0, steady: 0, prevRep: null, rewindId: 0, startT: 0, prog: 0, t: {},
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
      placeHush();
    }
    // the hush covers the player's box; the disc is a fifth of its width (at least 150 px) round its centre
    function placeHush() {
      var fs = frame.style, l = fs.left || "0", t = fs.top || "0", w = fs.width || "100%", h = fs.height || "100%";
      hush.style.left = l; hush.style.top = t; hush.style.width = w; hush.style.height = h;
      var W = frame.offsetWidth || video.parentNode.clientWidth, H = frame.offsetHeight || video.parentNode.clientHeight;
      var d = Math.max(150, Math.min(W, H) * 0.42);
      disc.style.width = disc.style.height = d.toFixed(0) + "px";
      disc.style.left = "calc(" + l + " + " + ((W - d) / 2).toFixed(1) + "px)";
      disc.style.top = "calc(" + t + " + " + ((H - d) / 2).toFixed(1) + "px)";
    }
    function stalled(now) {
      if (!S.shown) return false;
      if (S.inflight && now - S.issued > HUSH_SEEK) return true;
      return S.playing && S.wantPlay && S.advAt > 0 && now - S.advAt > HUSH_PLAY;
    }
    setInterval(function () {
      if (!S.shown && !S.hushed) return;
      var on = stalled(performance.now());
      if (on === S.hushed) return;
      S.hushed = on; if (on) S.hushes++;
      if (on) placeHush();
      hush.classList.toggle("is-on", on); disc.classList.toggle("is-on", on);
    }, 100);
    if ("MutationObserver" in window) new MutationObserver(place).observe(video, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", place);
    // A scrubber hides its poster the moment its first seek lands, and the player is then at
    // (or next to) the clip's first frame, which is the poster: show it at once, no fade. The
    // hub film fades in over its poster once it is really playing.
    function show() {
      if (S.shown) return;
      S.shown = true; stage(S, video, "shown", 1);
      var go = function () { opacity = "1"; place(); video.classList.add("vu-covered"); };
      if (S.scrub) { BASE = BASE.replace("transition:opacity .25s ease;", ""); go(); } else setTimeout(go, 120);
    }

    /* --------------------------------------------------------- the channel */
    // nothing is posted until the player's page has loaded: before that the iframe still holds
    // about:blank, whose origin is ours, and the browser warns about the mismatched target
    var loaded = false;
    frame.addEventListener("load", function () { loaded = !!S.uuid; if (loaded) stage(S, video, "loaded", 0.2); });
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
      if (m === SCOPE + "ready") { S.ready = true; clearInterval(S.ping); stage(S, video, "ready", 0.4); afterReady(); return; }
      if (m === SCOPE + "resolutionUpdate") {
        var list = o.params || [], best = null;
        list.forEach(function (r) {
          if (r && r.id >= 0 && r.height && (!best || r.height > best.height)) best = r;
          if (r && r.width && r.height) S.aspect = r.width / r.height;
        });
        // (18 Oct 2026: a clip with ONE resolution, as every hardware clip has (1080p; the rest is "Auto"), is not
        // switched: Auto already plays it, and the switch only cost the reload the warm-up waits out)
        var real = list.filter(function (r) { return r && r.id >= 0 && r.height; }).length;
        if (best) { S.aspect = best.width / best.height; if (!S.resSet) { S.resSet = true; S.resAt = performance.now(); S.steady = 0; S.oneRes = real === 1; stage(S, video, "res", 0.55); if (!S.oneRes) call("setResolution", best.id); } }
        place();
        return;
      }
      if (m === SCOPE + "playbackStatusUpdate") {
        var p = o.params || {};
        if (isFinite(p.duration) && p.duration > 0) { S.dur = p.duration; afterReady(); }
        if (!S.scrub && isFinite(p.position)) S.cur = p.position;
        // the player's own position and when it said so: a scrubber that plays along with the scroll (sp-clip.js)
        // carries it forward at the rate it set
        // r: how fast the position really moved since the report before (0 while buffering), so a caller that carries
        // the position forward between reports never carries it past what the player is actually doing
        if (isFinite(p.position)) {
          var nowR = performance.now(), prevR = S.rep;
          var rr = prevR && nowR - prevR.at > 50 ? Math.max(0, (p.position - prevR.pos) / ((nowR - prevR.at) / 1000)) : 0;
          S.rep = { pos: p.position, at: nowR, playing: p.playbackState === "playing", r: rr, prevAt: prevR ? prevR.at : 0 };
        }
        // (18 Oct 2026) the player keeps its last playback rate in video.igem.org's localStorage and applies it when the
        // clip loads, so a scrubber's hold (rate 0) carried over to every later player on the site: on a second visit
        // the clip "played" at rate 0, never moved, and the poster stayed ~12 s. Not held, playing, yet not moving:
        // the rate is sent again (harmless while it is only buffering).
        // (From its first report, and on every "playing" below: a first visit's player starts at its saved rate too.)
        if (!S.held && S.rep && S.rep.playing && S.rep.r === 0) call("setPlaybackRate", S.rate);
        // when the position last moved: a playing clip that stops moving is buffering (the hush)
        if (isFinite(p.position) && Math.abs(p.position - S.advPos) > 0.01) { S.advPos = p.position; S.advAt = performance.now(); }
        if (S.scrub && !S.warmed && S.metaFired) scrubWarm(performance.now(), p.playbackState === "playing");
        // held, yet moving (its rate reset under us): hold it again and put it back where it was asked to be. (18 Oct 2026:
        // only from two reports both after the hold; the first one's speed is the play before it, and S.cur, the last
        // seek, can be far behind a clip that played along, so that re-seek was a jump back.)
        if (S.scrub && S.held && S.playing && S.rep && S.rep.r > 0.05 && S.rep.prevAt > S.heldAt + 60 && !S.inflight) {
          call("setPlaybackRate", 0); seekTo(S.cur);
        }
        if (!S.scrub && isFinite(p.position)) warmStep(p.position, p.playbackState === "playing");
        return;
      }
      if (m === SCOPE + "playbackStatusChange") {
        if (o.params === "playing") {
          S.playing = true; S.advAt = performance.now();
          if (!S.held) call("setPlaybackRate", S.rate);
          if (S.scrub && !S.wantPlay) { hold(); return; }
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
      r = r / (S.rate || 1);                         // (20 Oct 2026) a film may play faster than 1x (the hub's data-rate)
      S.steady = r > 0.6 && r < 1.6 ? S.steady + 1 : 0;
      if (S.warm === 0) {
        var resOk = S.resSet ? now - S.resAt > 400 : now - S.openedAt > WARM_MAX;
        var noRewind = typeof opt.rewind === "function" && !opt.rewind();
        if (resOk && S.steady >= (noRewind ? 1 : 2)) {
          // (20 Oct 2026) a caller that puts the film back at its start itself (the hub, as the loading walk lifts)
          // passes rewind: a function answering false, and the film shows as soon as it plays steadily
          if (noRewind) { S.warm = 3; if (S.wantPlay) { fire(video, "playing"); show(); } return; }
          S.warm = 1; call("pause"); S.rewindId = call("seek", S.startT);
        }
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
      if (S.scrub) hold();
      fire(video, "loadedmetadata"); fire(video, "loadeddata"); fire(video, "canplay"); fire(video, "canplaythrough");
    }

    /* --------------------------------------------------------------- seeks */
    function seekTo(t) {
      if (!S.scrub && S.warm < 3) S.startT = t;       // a film's start point (the hub's data-start: the poster's frame)
      if (!S.ready) { S.cur = t; return; }
      if (S.scrub && !S.warmed) { S.cur = t; fire(video, "seeking"); return; }   // kept until the warm-up ends
      if (S.inflight) { S.pendingT = t; return; }
      S.inflight = true; S.issued = performance.now(); S.cur = t;
      fire(video, "seeking");
      S.seekId = call("seek", t);
    }
    // a scrubber's warm-up (see the header): over once the player is seen moving after the resolution switch
    // Two steps: once it plays at the resolution it keeps, it is sent (still playing) to the frame the scrubber
    // wants, since the switch drops what was buffered; once it is seen moving on from there, that frame's data is in.
    function scrubWarm(now, playing) {
      var moving = playing && S.rep && S.rep.r > 0.3;
      // one resolution, so no switch and nothing dropped (18 Oct 2026): the first report that has it past its opening
      // frames means data is flowing; held and sent to the scrubber's frame at once (was ~1.5 s more: two reports to
      // see it moving after the switch, a seek, and a third report to see it moving from there)
      if (S.oneRes && !S.swarm) {
        if (!(playing && S.rep && S.rep.pos > 0.04) && now - S.openedAt < WARM_GIVEUP) return;
        S.swarm = 2; stage(S, video, "moving", 0.75);
        S.warmed = true; stage(S, video, "warmed", 0.9);
        if (S.wantHold || !S.wantPlay) { S.wantHold = false; S.held = false; hold(); }
        seekTo(S.cur);
        return;
      }
      if (!S.swarm) {
        var resOk = S.resSet ? now - S.resAt > 400 : now - S.openedAt > WARM_MAX;
        if (!(resOk && moving && S.rep.prevAt > S.resAt) && now - S.openedAt < WARM_GIVEUP) return;
        S.swarm = 1; S.swarmT = S.cur; S.swarmAt = now; stage(S, video, "moving", 0.75);
        call("seek", S.cur);
        return;
      }
      // (one report after the seek is enough: a position past the frame asked for means its data has arrived)
      var there = playing && S.rep && S.rep.at > S.swarmAt + 50 && S.rep.pos > S.swarmT + 0.05 && S.rep.pos < S.swarmT + 4;
      if (!there && now - S.swarmAt < WARM_GIVEUP) return;
      S.warmed = true; stage(S, video, "warmed", 0.9);
      if (S.wantHold || !S.wantPlay) { S.wantHold = false; S.held = false; hold(); }
      seekTo(S.cur);
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
    // a scrubber's hold: rate 0 instead of a pause (see the header: no bezel)
    function hold() {
      if (S.scrub && !S.warmed) { S.wantHold = true; return; }   // warming up: held when it ends
      if (!S.held) { S.held = true; S.heldAt = performance.now(); call("setPlaybackRate", 0); }
    }
    function unhold() { S.wantHold = false; if (S.held) { S.held = false; call("setPlaybackRate", S.rate); } }
    def("paused", { get: function () { return !S.playing || (S.scrub && S.held); } });
    def("seeking", { get: function () { return S.inflight; } });
    def("error", { get: function () { return null; } });
    def("play", { value: function () {
      S.wantPlay = true; S.advAt = performance.now();
      // a film whose warm-up never completes in this browser (a player that does not report, or pauses out of
      // sight) still shows: after WARM_GIVEUP ms it is played and faded in as before
      if (!S.scrub && S.warm < 3 && !S.giveup) S.giveup = setTimeout(function () {
        S.giveup = 0;
        if (S.warm < 3 && S.wantPlay) { S.warm = 3; call("play"); fire(video, "playing"); show(); }
      }, WARM_GIVEUP);
      if (S.scrub && S.ready) {
        unhold();
        if (S.playing) { fire(video, "play"); fire(video, "playing"); } else call("play");
        return Promise.resolve();
      }
      if (S.ready) call("play");
      if (S.playing && !S.scrub && S.warm >= 3) { fire(video, "playing"); show(); }
      return Promise.resolve();
    } });
    def("pause", { value: function () {
      S.wantPlay = false;
      if (!S.ready) return;
      if (S.scrub && S.playing) { hold(); fire(video, "pause"); } else call("pause");
    } });
    def("playbackRate", { get: function () { return S.rate; }, set: function (v) {
      v = +v; if (!(v > 0) || v === S.rate) return;
      S.rate = v; if (S.ready && !S.held) call("setPlaybackRate", v);
    } });
    def("load", { value: function () { /* the player loads its own file */ } });
    def("fastSeek", { value: function (t) { seekTo(+t || 0); } });

    S.open = function (uuid, o) {
      if (uuid === S.uuid) return;
      S.uuid = uuid;
      S.ready = false; S.dur = NaN; S.metaFired = false; S.inflight = false; S.pendingT = null; S.resSet = false; S.held = false; S.oneRes = false;
      S.warmed = false; S.wantHold = false; S.swarm = 0;
      S.shown = false; opacity = "0"; video.classList.remove("vu-covered");
      S.openedAt = performance.now(); S.resAt = 0; S.warm = 0; S.steady = 0; S.prevRep = null; S.rewindId = 0; S.startT = 0;
      S.prog = 0; S.t = {}; stage(S, video, "open", 0.05);
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

// Scroll gate — the scroll may not run ahead of a scroll-driven clip (18 Oct 2026).
//
// The owner: "sometimes the video cant keep up with the scrolling, and the labels move on without the clip, so I want
// you to hardstop the scrolling with the progress of the video". A scrubber registers its clip here; while the frame
// actually on screen is more than its lead behind the scroll, further downward input is not let through:
//   - wheel and trackpad (their momentum included): the event is cancelled once the scroll has reached the wall, so
//     the page simply stops there and moves on as the picture catches up. A notch already on its way may carry one
//     delta past it; nothing is ever pulled back.
//   - touch: a drag that starts at the wall does not scroll (where the browser lets it be cancelled: always on iOS;
//     on Android Chrome only before the drag has begun to scroll), and a fling past the wall stops, the way a tap
//     stops a fling: on the wall if it crosses it, or at once if the finger had already dragged past it.
//   - upward scrolling, the keyboard, links, the Skip buttons and every other programmatic scroll are never touched;
//     after a jump past the wall the next downward input waits for the one seek that follows the jump.
//   - the wall is the shown frame plus `lead` (~0.5 s of clip), so ordinary reading never meets it: only a clip that
//     has really fallen behind (the player buffering, a slow seek, the clip still loading) holds the scroll.
//   - it never traps a reader: when the picture has not moved for STALL ms while the reader pushes against it (a
//     stalled network), the gate opens until the picture moves again; a clip that fails stops gating.
//   - reduced motion: no gate (those readers get the exact frame-for-scroll scrub with no lag to wait for).
// The listeners that can cancel (wheel, touchmove) are only attached while a gated stage is on screen.
window.ScrollGate = (function () {
  "use strict";
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STALL = 4000;
  var gates = [], live = 0, attached = false;
  var aim = 0, aimAt = 0, touching = false, touchY = 0, flingUntil = 0, lastY = 0, blockStart = 0, lastWall = NaN;

  function Y() { return window.pageYOffset || document.documentElement.scrollTop || 0; }
  // the tightest wall of the gates on screen: {wall, end} in document px, or null
  function check() {
    var best = null;
    for (var i = 0; i < gates.length; i++) {
      var g = gates[i];
      if (!g.on) continue;
      var r = null;
      try { r = g.wall(); } catch (e) { r = null; }
      if (r && isFinite(r.wall) && r.wall < r.end && (!best || r.wall < best.wall)) best = r;
    }
    if (best && !(Math.abs(best.wall - lastWall) <= 1)) { lastWall = best.wall; blockStart = 0; }
    return best;
  }
  // true while the gate holds (it opens after STALL ms of pushing against a wall that does not move)
  function hold(now) {
    if (!blockStart) blockStart = now;
    return now - blockStart < STALL;
  }
  function scrollsItself(el) {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1) {
        var o = getComputedStyle(el).overflowY;
        if (o === "auto" || o === "scroll") return true;
      }
    }
    return false;
  }
  function onWheel(e) {
    if (e.ctrlKey || e.defaultPrevented) return;
    var now = performance.now(), y = Y();
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (now - aimAt > 220 || aim < y) aim = y;
    if (dy <= 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { aim = Math.min(aim, y) + dy; aimAt = now; return; }
    if (scrollsItself(e.target)) return;
    var g = check();
    if (g && aim >= g.wall && y < g.end && hold(now)) { e.preventDefault(); return; }
    aim += dy; aimAt = now;
  }
  function onTouchStart(e) { touching = true; touchY = e.touches && e.touches[0] ? e.touches[0].clientY : 0; }
  function onTouchMove(e) {
    if (!e.touches || e.touches.length !== 1) return;
    var cy = e.touches[0].clientY, dy = touchY - cy;
    touchY = cy;
    if (dy <= 0 || !e.cancelable || scrollsItself(e.target)) return;
    var g = check(), y = Y();
    if (g && y >= g.wall - 1 && y < g.end && hold(performance.now())) e.preventDefault();
  }
  function onTouchEnd(e) { if (!e.touches || !e.touches.length) { touching = false; flingUntil = performance.now() + 3000; } }
  function onScroll() {
    var y = Y(), prev = lastY;
    lastY = y;
    if (touching || performance.now() > flingUntil || y <= prev || y - prev > window.innerHeight * 0.6) return;
    var g = check();
    // a fling past the wall stops: on the wall if it crossed it in this frame, or where it was a frame ago if the
    // finger had already dragged past it (a drag the browser would not let us cancel), so nothing jumps back further
    if (g && y > g.wall + 2 && y < g.end && hold(performance.now())) {
      flingUntil = 0;
      var to = Math.round(prev > g.wall ? prev : g.wall);
      try { window.scrollTo({ top: to, left: 0, behavior: "instant" }); } catch (err) { window.scrollTo(0, to); }
      lastY = Y();
    }
  }
  function attach(on) {
    if (on === attached) return;
    attached = on;
    var f = on ? "addEventListener" : "removeEventListener";
    window[f]("wheel", onWheel, { passive: false });
    window[f]("touchmove", onTouchMove, { passive: false });
    window[f]("touchstart", onTouchStart, { passive: true });
    window[f]("touchend", onTouchEnd, { passive: true });
    window[f]("touchcancel", onTouchEnd, { passive: true });
    window[f]("scroll", onScroll, { passive: true });
    lastY = Y(); blockStart = 0;
  }

  // el: the gated stage (the gate works while it is on screen). wall(): {wall, end} in document px, or null for no
  // wall now: `wall` the furthest scroll the shown frame allows, `end` where the gated stretch ends.
  function add(el, wall) {
    var g = { el: el, wall: wall, on: !("IntersectionObserver" in window) };
    if (reduced || !el) return g;
    gates.push(g);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        var was = g.on; g.on = es[es.length - 1].isIntersecting;
        if (g.on !== was) { live += g.on ? 1 : -1; attach(live > 0); }
      }, { threshold: 0 }).observe(el);
    } else { live++; attach(true); }
    return g;
  }
  // a wall from a gated stretch [y0, y1) of the document and the shown fraction f (0-1) of the clip, plus lead
  function at(y0, y1, f, lead) {
    if (f === null || f === undefined || !(y1 > y0)) return null;
    var fw = f + lead;
    if (fw >= 1) return null;
    return { wall: y0 + Math.max(0, fw) * (y1 - y0), end: y1 };
  }
  return { add: add, at: at, reduced: reduced, get state() { return { attached: attached, live: live, blockStart: blockStart, wall: lastWall }; } };
})();
