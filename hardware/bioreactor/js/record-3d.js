// The record's 3D figure — 7.4, the packaged design (js/product.js) — and the libraries it needs, loaded when the
// figure nears the screen rather than with the page (10 Oct 2026, when V4 became the page's opening scene).
//
// Why: the opening scene comes first. In video mode it is a clip, and three.js would otherwise be fetched only for a
// figure some forty screens further down; in live3d mode the scene is the heavy WebGL story, and product.js used to
// open a second WebGL context beside it at load. The script tags live in the page's <template id="record-3d">, so
// tools/stamp_assets.py stamps them like every other tag; any of them the page has already loaded (three.js and
// render-quality.js in live3d mode) is skipped.
(function () {
  "use strict";
  const tpl = document.getElementById("record-3d");
  const canvas = document.getElementById("pkg-gl");
  if (!tpl || !canvas) return;

  function loaded(src) {
    const path = src.split("?")[0];
    return Array.prototype.some.call(document.scripts, function (s) {
      const a = s.getAttribute("src");
      return !!a && a.split("?")[0] === path;
    });
  }

  let started = false;
  function load() {
    if (started) return;
    started = true;
    const srcs = Array.prototype.map.call(tpl.content.querySelectorAll("script[src]"), function (s) {
      return s.getAttribute("src");
    }).filter(function (s) { return !loaded(s); });
    // in order, one after another: each needs the one before it
    (function next(i) {
      if (i >= srcs.length) return;
      const el = document.createElement("script");
      el.src = srcs[i];
      el.async = false;
      el.onload = function () { next(i + 1); };
      el.onerror = function () { console.warn("record figure 7.4: could not load " + srcs[i]); };
      document.body.appendChild(el);
    })(0);
  }

  const host = canvas.closest("figure") || canvas;
  if (!("IntersectionObserver" in window)) { load(); return; }
  // a screen and a half ahead: the libraries and the package model are in by the time the figure scrolls in
  const io = new IntersectionObserver(function (es) {
    for (let i = 0; i < es.length; i++) {
      if (es[i].isIntersecting) { io.disconnect(); load(); return; }
    }
  }, { rootMargin: "150% 0px 150% 0px" });
  io.observe(host);
})();
