/* =============================================================================
   RESULTS · the rail map under the navigation
   -----------------------------------------------------------------------------
   The figure at the top of the page draws the wet lab and the dry lab as two
   columns with the six stages running down them. The rail repeats that graph at
   a glance, and this lights the stage whose section the reader has reached.

   One observer over the six sections, with the stage nearest the top of the
   viewport winning. Nothing else: the rail is already a list of links without
   it, and the figure does not depend on it at all.
   ========================================================================== */

(function () {
  "use strict";

  var items = Array.prototype.slice.call(document.querySelectorAll(".rmap__stage[data-sec]"));
  if (!items.length || !("IntersectionObserver" in window)) return;

  var byId = {}, seen = {};
  items.forEach(function (li) {
    var sec = document.getElementById(li.dataset.sec);
    if (sec) { byId[li.dataset.sec] = li; seen[li.dataset.sec] = false; }
  });

  function paint() {
    var here = null;
    items.forEach(function (li) { if (seen[li.dataset.sec]) here = here || li; });
    if (!here) {
      /* past the last one, or above the first: keep the last section reached */
      for (var i = items.length - 1; i >= 0; i--) {
        var sec = document.getElementById(items[i].dataset.sec);
        if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.4) { here = items[i]; break; }
      }
    }
    items.forEach(function (li) { li.classList.toggle("is-here", li === here); });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
    paint();
  }, { rootMargin: "-12% 0px -55% 0px", threshold: 0 });

  Object.keys(byId).forEach(function (id) { io.observe(document.getElementById(id)); });
  paint();
})();
