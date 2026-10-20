/* ReLEAF: the Development page.
   Since 10 October 2026 the shared engage.js drives the two segmented
   controls: the sliding thumb, and taking a reader who switches panel from
   deep inside one back to the top of the next (data-rail-top). What is left
   here is this page's own: the subsystem cards rising in as they reach the
   screen. Until 20 October this watched the eight step timelines (.step);
   those are one card each now, so it watches .jcard.

   A card inside a shut rail panel is shown at once rather than observed: a
   panel that is display:none never intersects, and a card left waiting for
   an intersection that cannot happen would open invisible. This runs on
   DOMContentLoaded, after engage.js has shut the panels it is going to.  */
(function () {
  "use strict";
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function start() {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });

    document.documentElement.classList.add("dev-rise");

    $$(".jcard").forEach(function (c) {
      var panel = c.closest ? c.closest(".rail__panel") : null;
      if (panel && panel.hidden) { c.classList.add("is-in"); return; }
      var r = c.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) c.classList.add("is-in");
      io.observe(c);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
