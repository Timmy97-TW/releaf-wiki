/* ==========================================================================
   home-3d-loader.js · the homepage's 3D, fetched when it is wanted

   three.js and the reactor and deck scripts are about 700 kB. Loaded with the
   page they shared the first seconds with the hero photograph and the text,
   and on a slow line the first screen waited for a model nobody had scrolled
   to yet. They now load on the first of:

     · home.js asking the reactor to start (it does so a screen and a half
       before the stage arrives, so the fade-in is still not a spinner),
     · the reader's first scroll, key or touch,
     · the page going idle after load.

   window.__homeRx is a stand-in until home-reactor.js replaces it. home.js
   keeps the stand-in it read at startup, so every call is passed through to
   the real reactor once it exists; a start or highlight asked for before
   then is replayed. If the scripts fail, the stand-in reports failed and the
   poster stays, as it always has without WebGL.
   ========================================================================== */

(function () {
  "use strict";

  window.DECK3D_BASE = "hardware/";

  var SCRIPTS = [
    "hardware/js/vendor/three.min.js",
    "hardware/js/packed-loader.js",
    "hardware/js/render-quality.js",
    "hardware/bioreactor/js/parts.js",
    "hardware/bioreactor/js/flow-paths.js",
    "hardware/bioreactor/js/components.js",
    "assets/js/home-reactor.js",
    "hardware/js/deck3d.js"
  ];

  var real = null, broken = false, wantStart = false, wantHighlight;

  var stub = {
    start: function () {
      if (real) { real.start(); return; }
      wantStart = true;
      load();
    },
    isReady: function () { return !!real && real.isReady(); },
    redraw: function () { if (real) real.redraw(); },
    highlight: function (id) {
      if (real) real.highlight(id); else wantHighlight = id;
    }
  };
  Object.defineProperty(stub, "failed", {
    get: function () { return broken || (!!real && real.failed); }
  });
  window.__homeRx = stub;

  var loading = false;
  function load() {
    if (loading) return;
    loading = true;
    SCRIPTS.forEach(function (src) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;              // run in list order, as the defer tags did
      s.onerror = function () { broken = true; };
      if (src === "assets/js/home-reactor.js") {
        s.onload = function () {
          if (window.__homeRx === stub) return;
          real = window.__homeRx;
          window.__homeRx = stub;
          if (real.failed) return;
          if (wantHighlight !== undefined) real.highlight(wantHighlight);
          if (wantStart) real.start();
        };
      }
      document.body.appendChild(s);
    });
    ["scroll", "keydown", "pointerdown", "touchstart"].forEach(function (t) {
      window.removeEventListener(t, load);
    });
  }

  ["scroll", "keydown", "pointerdown", "touchstart"].forEach(function (t) {
    window.addEventListener(t, load, { once: true, passive: true });
  });
  function idle() {
    if (window.requestIdleCallback) window.requestIdleCallback(load, { timeout: 4000 });
    else setTimeout(load, 2000);
  }
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
})();
