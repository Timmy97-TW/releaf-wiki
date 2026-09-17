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
    video.muted = true;
    const px = window.innerWidth * (window.devicePixelRatio || 1);
    // a file that will not load (the mp4s are not in the repository: hardware/README.md,
    // "The hub film") leaves the poster up and takes the pause control away with it
    video.addEventListener("error", function () { failed = true; wrap.classList.add("no-film"); sync(); }, { once: true });
    video.addEventListener("playing", function () { wrap.classList.add("is-playing"); }, { once: true });
    // preload="none" in the markup keeps the file off the wire until now; it
    // also means a new src alone never fetches, so ask for it explicitly
    video.preload = "auto";
    video.src = px < 1200 && video.dataset.srcSmall ? video.dataset.srcSmall : video.dataset.src;
    video.load();
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
