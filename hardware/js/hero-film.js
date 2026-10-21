// Hub hero — the background film.
//
// A muted loop rendered from the CAD in Blender: the commercial bioreactor,
// then the photometer that sits in its loop. The file is only requested when
// it will actually play (never for readers who prefer reduced motion or ask to
// save data), and it pauses whenever the hero is off-screen or the tab is
// hidden. The clips begin on the poster's own frame, so the video takes over
// from its poster with no visible change, and playback starts only once the
// browser expects to play through, so the opening move never stops to buffer.
// If the file cannot load, the poster drifts slowly instead of standing still.
(function () {
  const wrap = document.querySelector(".hero-film");
  if (!wrap) return;
  const video = wrap.querySelector("video");
  if (!video || !video.dataset.src) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const conn = navigator.connection;
  // The hub's clips begin on the poster's frame (dev/film/rotate_start.py), so it sets no data-start: a seek needs a
  // server that answers Range requests, and without one the film opened on the render's fast loop point instead.
  const START = parseFloat(wrap.dataset.start) || 0;
  // the observer always delivers a first entry, so nothing is fetched before the hero is known to be on screen
  let onScreen = !("IntersectionObserver" in window), requested = false, ready = false, failed = false;
  const btn = document.querySelector(".hero > .film-toggle");
  let userPaused = false;
  try { userPaused = localStorage.getItem("hubFilmPaused") === "1"; } catch (e) {}

  function allowed() {
    if (failed || reduced.matches) return false;
    return !(conn && (conn.saveData || /2g$/.test(conn.effectiveType || "")));
  }

  function request() {
    if (requested) return;
    requested = true;
    // (20 Oct 2026) the loading walk (js/hw-loader.js) waits for the film's first moving frame, up to its own limit,
    // so the hero opens on the film already playing rather than on the poster with the film arriving late
    const release = window.HWLoader ? HWLoader.hold() : function () {};
    // through iGEM's player, "playing" also fires while it warms up out of sight; its first frame on screen is vuProgress 1
    video.addEventListener("vuprogress", function () { if (video.vuProgress >= 1) release(); });
    if (!(window.VUEmbed && VUEmbed.is(video.dataset.src))) video.addEventListener("playing", release, { once: true });
    video.addEventListener("error", release, { once: true });
    video.muted = true;
    const px = window.innerWidth * (window.devicePixelRatio || 1);
    // a file that will not load (the mp4s are not in the repository: hardware/README.md,
    // "The hub film") leaves the poster up and takes the pause control away with it
    video.addEventListener("error", function () { failed = true; wrap.classList.add("no-film"); sync(); }, { once: true });
    video.addEventListener("playing", function () { wrap.classList.add("is-playing"); }, { once: true });
    // preload="none" in the markup keeps the file off the wire until now; it
    // also means a new src alone never fetches, so ask for it explicitly
    video.preload = "auto";
    const src = px < 1200 && video.dataset.srcSmall ? video.dataset.srcSmall : video.dataset.src;
    // A Video Universe film plays in iGEM's own player (js/vu-embed.js): its files answer 403
    // to any other page since 16 Oct 2026. The player answers through this <video>.
    // (20 Oct 2026) under the loading walk the warm-up need not rewind: the walk's lift puts the film back at START
    const rewind = function () { return !(window.HWLoader && START > 0) || HWLoader.lifted(); };
    if (window.VUEmbed && VUEmbed.is(src)) VUEmbed.bind(video, src, { fit: "cover", loop: true, rewind: rewind });
    else { video.src = src; video.load(); }
    // (set once the player stands in for the <video>)
    // (20 Oct 2026, the owner: "is there a way to speed up the clip") data-rate on .hero-film plays the film faster
    const RATE = parseFloat(wrap.dataset.rate) || 1;
    if (RATE !== 1) { video.defaultPlaybackRate = RATE; video.playbackRate = RATE; }
    // (20 Oct 2026, the owner: "slow down seconds 3-4 and gradually speed up", "0.9") data-slow="from to rate ramp":
    // between from and to (film seconds) it plays at rate, then eases back to data-rate over ramp seconds
    const SLOW = (wrap.dataset.slow || "").split(/\s+/).map(parseFloat);
    if (SLOW.length === 4 && SLOW.every(isFinite)) {
      const [A, B, R, RAMP] = SLOW;
      const want = function (t) {
        if (t >= A && t < B) return R;
        if (t >= B && t < B + RAMP) { const k = (t - B) / RAMP; return R + (RATE - R) * (k * k * (3 - 2 * k)); }
        return RATE;
      };
      // where the film is now: the player reports every 0.5 s, so carry its last report forward
      const now = function () {
        const S = video.__vu;
        if (S && S.rep) return S.rep.pos + (S.rep.playing ? (performance.now() - S.rep.at) / 1000 * S.rate : 0);
        return video.currentTime;
      };
      const first = want(START);
      if (first !== RATE) { video.defaultPlaybackRate = first; video.playbackRate = first; }
      setInterval(function () {
        if (video.paused === true && !video.__vu) return;
        const r = Math.round(want(now()) * 100) / 100;
        if (Math.abs(r - video.playbackRate) >= 0.01) video.playbackRate = r;
      }, 200);
    }
    // the film plays on under the loading walk; as the walk lifts it goes back to its first frame, so the reader
    // sees it begin where the owner asked (the bottle), not a second or two further on (20 Oct 2026)
    if (window.HWLoader && START > 0) HWLoader.onLift(function () {
      if (video.__vu ? video.__vu.shown : ready) video.currentTime = START;
    });
    // Play only once the browser expects to play through without stopping to buffer (HAVE_ENOUGH_DATA). Starting on
    // the first metadata let the opening move run, stall and catch up while the rest of the file was still arriving.
    function whenBuffered() {
      if (video.readyState >= 4) { ready = true; sync(); return; }
      video.addEventListener("canplaythrough", function () { ready = true; sync(); }, { once: true });
    }
    video.addEventListener("loadedmetadata", function () {
      if (START > 0 && START < video.duration) {
        video.addEventListener("seeked", whenBuffered, { once: true });
        video.currentTime = START;
      } else {
        whenBuffered();
      }
    }, { once: true });
  }

  function sync() {
    if (btn) btn.hidden = !allowed();
    if (onScreen && !document.hidden && allowed() && !userPaused) {
      request();
      if (!ready) return;
      const p = video.play();
      if (p && p.catch) p.catch(function () {});   // blocked autoplay just leaves the poster up
    } else if (ready) {
      video.pause();
    }
  }

  // a stored pause is honoured before anything downloads
  function label() {
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(userPaused));
    btn.setAttribute("aria-label", userPaused ? "Play background film" : "Pause background film");
    btn.textContent = userPaused ? "Play film" : "Pause film";
  }
  if (btn) btn.addEventListener("click", function () {
    userPaused = !userPaused; label();
    try { localStorage.setItem("hubFilmPaused", userPaused ? "1" : "0"); } catch (e) {}
    sync();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.01 }).observe(wrap);
  }
  document.addEventListener("visibilitychange", sync);
  if (reduced.addEventListener) reduced.addEventListener("change", sync);
  label();
  sync();
})();
