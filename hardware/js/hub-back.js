/* v6: the way back to the top of the page, in place of the topbar (see v.css).
   Past the landing it shows when the reader heads back up or reaches the end,
   and steps aside while they read on down and while the timeline plays. */
(function () {
  "use strict";
  var btn = document.querySelector(".hw-back");
  var hero = document.querySelector(".hero");
  var vtl = document.querySelector(".vtl");
  if (!btn) return;
  btn.hidden = false;
  var queued = false, lastY = window.scrollY, wanted = false;
  function update() {
    queued = false;
    var y = window.scrollY, dy = y - lastY; lastY = y;
    if (dy > 6) wanted = false;                      // reading on down
    else if (dy < -6) wanted = true;                 // heading back up
    var past = hero ? hero.getBoundingClientRect().bottom < window.innerHeight * .25 : y > 600;
    var playing = vtl && vtl.classList.contains("vtl-go") && !vtl.classList.contains("vtl-done");
    var atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 160;
    btn.classList.toggle("on", past && !playing && (wanted || atEnd) && !onText());
  }
  // Never over the footer's words (round 15): near the end, a reader 100px short
  // of the bottom had the three.js credit under the button. Checked against the
  // button's resting box, with 8px to spare.
  var foot = Array.prototype.slice.call(document.querySelectorAll(".hub-foot .outro-meta, .hub-foot .legal p"));
  function onText() {
    var b = btn.getBoundingClientRect(), top = b.top - (btn.classList.contains("on") ? 0 : 12) - 8, left = b.left - 8;
    for (var i = 0; i < foot.length; i++) {
      var r = foot[i].getBoundingClientRect();
      if (r.bottom > top && r.top < b.bottom && r.right > left && r.left < b.right + 8) {
        // the box of a centred paragraph is wider than its words: test the words themselves
        var range = document.createRange(); range.selectNodeContents(foot[i]);
        var rs = range.getClientRects();
        for (var k = 0; k < rs.length; k++) if (rs[k].bottom > top && rs[k].top < b.bottom && rs[k].right > left && rs[k].left < b.right + 8) return true;
      }
    }
    return false;
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", soon, { passive: true });
  window.addEventListener("resize", soon);
  if (vtl && "MutationObserver" in window) new MutationObserver(soon).observe(vtl, { attributes: true, attributeFilter: ["class"] });
  update();
  // back to the top, smoothly where motion is welcome
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    var main = document.getElementById("main");
    if (main) main.focus({ preventScroll: true });
  });
})();

/* v9: the bench's list of four sits along the foot of the screen, where v6's Back to Hardware button lives. While
   the list is on screen the button steps aside (it would cover the fourth instrument); the landing is just above. */
(function () {
  "use strict";
  var list = document.querySelector(".pb-sec .pb-list");
  if (!list || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(function (es) {
    document.documentElement.classList.toggle("pb-list-on", es[es.length - 1].isIntersecting);
  }).observe(list);
})();

/* v10: v6's Back to Hardware button sits in the bottom-right corner, which on this page can be the corner of the PDF
   viewer. While the viewer is under the button's spot the button steps aside (own.css); it is back as soon as the
   viewer has scrolled past it, over the footer or the bench. */
(function () {
  "use strict";
  var btn = document.querySelector(".hw-back"), frame = document.querySelector(".pn-frame");
  if (!btn || !frame) return;
  var queued = false;
  function update() {
    queued = false;
    var f = frame.getBoundingClientRect(), b = btn.getBoundingClientRect();
    var shown = f.width > 0 && f.height > 0;
    // the button's resting box (it rises 12px when it shows), with 8px to spare
    var hit = shown && f.bottom > b.top - 20 && f.top < b.bottom + 8 && f.right > b.left - 8 && f.left < b.right + 8;
    document.documentElement.classList.toggle("pn-on-back", hit);
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", soon, { passive: true });
  window.addEventListener("resize", soon);
  update();
})();

/* Round 28, round 1. The page's shared scale (coordinator's D1; own.css defines the tokens that use it): --hub-k on
   <html>, clamp(1, innerHeight / 900, 1.4), set on load and on resize. */
(function () {
  "use strict";
  var root = document.documentElement, last = "";
  function k() {
    var v = Math.min(1.4, Math.max(1, (window.innerHeight || 900) / 900)).toFixed(4);
    if (v !== last) { last = v; root.style.setProperty("--hub-k", v); }
  }
  k();
  window.addEventListener("resize", k);
})();

/* Round 28, round 1 (QA judge #5): Back to Hardware also steps aside while any of the bench's photograph is on screen
   (scrolling back up it sat on the tub, the disclaimer, the bubble's name). */
(function () {
  "use strict";
  var stage = document.querySelector(".pb-sec .pb-stage");
  if (!stage || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(function (es) {
    document.documentElement.classList.toggle("pb-stage-on", es[es.length - 1].isIntersecting);
  }).observe(stage);
})();
