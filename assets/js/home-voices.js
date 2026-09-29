/* =============================================================================
   HOMEPAGE 5, THE VOICES (#ihp). One scroll job, transform only.

   Each of the four photographs arrives inset (scale .86 on a wide screen,
   .92 on a phone) and grows to the full width of the window as its top
   climbs most of the screen. Inside it, the picture
   drifts: a little larger and a little lower when the scene comes in, a
   little smaller and higher as it leaves, so the moment feels alive rather
   than pasted in. The text under each photograph comes in with home.js's
   .rise (piece 1), so this file only moves the photographs.

   It measures and writes on window.__homeFrame (home.js), in the page's one
   read phase and one write phase, and only while the section is near the
   screen. With reduced motion, or without __homeFrame, it does nothing and
   the section is its finished layout: full-width photographs, standing still.
   A failure in write() puts that finished layout back.
   ========================================================================== */

(function () {
  "use strict";

  var sec = document.getElementById("ihp");
  var frame = window.__homeFrame;
  if (!sec || !frame || !("IntersectionObserver" in window)) return;
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq.matches) return;

  var scenes = [].slice.call(sec.querySelectorAll(".vx-scene")).map(function (li) {
    var box = li.querySelector(".vx-scene__frame");
    return { box: box, img: box && box.querySelector("img"), last: "" };
  }).filter(function (s) { return s.box && s.img; });
  if (!scenes.length) return;

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };   // ease-out cubic
  var near = false;

  function reset() {
    sec.classList.remove("is-live");
    scenes.forEach(function (s) { s.box.style.transform = ""; s.img.style.transform = ""; s.last = ""; });
  }

  function read() {
    if (!near) return undefined;
    var vh = window.innerHeight;
    var phone = window.innerWidth < 700;
    return scenes.map(function (s) {
      var r = s.box.getBoundingClientRect();
      return { top: r.top, h: r.height, vh: vh, phone: phone };
    });
  }

  function write(m) {
    m.forEach(function (d, i) {
      var s = scenes[i];
      if (d.top > d.vh * 1.1 || d.top + d.h < -d.vh * 0.1) return;   // off screen: leave as is
      // grow: top from the bottom of the screen to a tenth of the way down
      var g = ease(clamp01((d.vh - d.top) / (d.vh * 0.9)));
      var s0 = d.phone ? 0.92 : 0.86;
      var k = s0 + (1 - s0) * g;
      // drift: across the whole pass of the photograph through the screen
      var u = clamp01((d.vh - d.top) / (d.vh + d.h));
      var zoom = 1.09 - 0.06 * u;
      var ty = (0.5 - u) * 3;   // percent of the picture's height, at most 1.5
      var key = k.toFixed(4) + "|" + zoom.toFixed(4) + "|" + ty.toFixed(3);
      if (key === s.last) return;
      s.last = key;
      s.box.style.transform = "scale(" + k.toFixed(4) + ")";
      s.img.style.transform = "translate3d(0," + ty.toFixed(3) + "%,0) scale(" + zoom.toFixed(4) + ")";
    });
  }

  new IntersectionObserver(function (entries) {
    near = entries[0].isIntersecting;
    if (near) frame.request();
  }, { rootMargin: "25% 0px 25% 0px" }).observe(sec);

  sec.classList.add("is-live");
  frame.add(read, write, reset);
  window.addEventListener("scroll", frame.request, { passive: true });
  window.addEventListener("resize", frame.request);
  if (mq.addEventListener) mq.addEventListener("change", function (e) { if (e.matches) { near = false; reset(); } });
  frame.request();
})();
