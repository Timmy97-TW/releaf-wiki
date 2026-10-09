/* =============================================================================
   ENGINEERING · page script
   -----------------------------------------------------------------------------
   Since 10 October 2026 the shared assets/js/engage.js drives the five tracks:
   the segmented control, the sliding thumb, a link opening the cycle it points
   into, and the short contents-rail labels. This page's own copies of all four
   are gone.

   What is left is the one thing only this page has: the four DBTL cards and
   the two ledger panels of a cycle easing in the first time a reader reaches
   them. engage.js eases in .node, .bridge and .chap__end, which this page does
   not use.

   The contents rail, the [n] citations and the figure lightbox come from
   assets/js/page.js. Native <details> carries every "Show details" fold.

   With scripts off every cycle of every track is visible, nothing is reachable
   only by clicking, and the record reads top to bottom.
   ========================================================================== */

(function () {
  "use strict";

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function reveal() {
    if (reduce || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-seen"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".track[data-rail]").forEach(function (root) {
      root.classList.add("cyc-anim");
      $$(".dbtl__step, .ledger > div", root).forEach(function (n) { io.observe(n); });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reveal);
  } else {
    reveal();
  }
})();
