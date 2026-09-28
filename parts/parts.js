/* =============================================================================
   Parts: one job.

   The page is a collection index, so the long record lives inside <details>.
   A link to a heading inside a closed fold, from the contents rail, from a
   citation, or from a URL somebody shared, would otherwise scroll to something
   the reader cannot see. This opens every fold above the target first and then
   lets the browser do the scrolling. page.js does the same thing for tab
   panels; this is the <details> half of it, kept here because Parts is the
   only page that folds this much.
   ========================================================================== */
(function () {
  "use strict";

  function open(hash) {
    if (!hash || hash.length < 2) return null;
    var el;
    try { el = document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch (e) { return null; }
    if (!el) return null;

    if (el.tagName === "DETAILS") el.open = true;
    var d = el.parentElement && el.parentElement.closest("details");
    while (d) {
      d.open = true;
      d = d.parentElement && d.parentElement.closest("details");
    }
    return el;
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) open(a.getAttribute("href"));
  });

  window.addEventListener("hashchange", function () { open(location.hash); });

  /* On first load the fold has to be opened before the browser's own jump is
     any use, so the jump is redone once the layout has settled. */
  var target = open(location.hash);
  if (target) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { target.scrollIntoView(); });
    });
  }
})();
