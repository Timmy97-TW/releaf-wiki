// The hardware records' interactive pieces: the shared helpers (15 Oct 2026). Loaded in <head>, without
// defer, before every css/xp-*.css / js/xp-*.js component, so each component can use window.XP. Kept tiny on
// purpose. Shared by the bioreactor and photometer pages (it was bioreactor/js/xp-kit.js until 15 Oct), with
// ../css/explore.css.
//
//   XP.reduced                 true when the reader prefers reduced motion (animations should show a still state)
//   XP.watch(el, fn)           fn(visible) when el enters or leaves the viewport (IntersectionObserver)
//   XP.loop(el, step)          runs step(dt, t) on requestAnimationFrame only while el is on screen and the tab is
//                              visible; returns { start, stop, running }. dt in seconds, clamped to 0.05.
//   XP.dpr(canvas, w, h)       sizes a canvas for the device pixel ratio; returns the 2D context, scaled to CSS px
//   XP.fmt(v, dp)              fixed decimals, with a real minus sign
//   XP.clamp, XP.lerp, XP.ease small maths
(function () {
  "use strict";
  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const XP = {
    get reduced() { return !!(mq && mq.matches); },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    ease: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    fmt: function (v, dp) { const s = Math.abs(v).toFixed(dp == null ? 1 : dp); return (v < 0 && +s !== 0 ? "−" : "") + s; },
    watch: function (el, fn) {
      if (!("IntersectionObserver" in window)) { fn(true); return; }
      new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.isIntersecting); }); },
        { rootMargin: "120px 0px" }).observe(el);
    },
    loop: function (el, step) {
      let raf = 0, last = 0, onScreen = false, wanted = true;
      function frame(t) {
        raf = 0;
        if (!(onScreen && wanted && !document.hidden)) { last = 0; return; }
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
        last = t;
        step(dt, t / 1000);
        raf = requestAnimationFrame(frame);
      }
      function kick() { if (!raf && onScreen && wanted && !document.hidden) raf = requestAnimationFrame(frame); }
      XP.watch(el, function (v) { onScreen = v; kick(); });
      document.addEventListener("visibilitychange", kick);
      return {
        start: function () { wanted = true; kick(); },
        stop: function () { wanted = false; },
        get running() { return wanted; }
      };
    },
    dpr: function (canvas, w, h) {
      const r = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(r, 0, 0, r, 0, 0);
      return ctx;
    }
  };
  window.XP = XP;
})();
