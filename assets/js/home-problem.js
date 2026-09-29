/* =============================================================================
   ReLeaf: homepage problem section behaviour
   One piece, which stops if its element is missing:
     3  sources   citations open the collapsed source list (#pb-sources, in
                  #sources at the end of the page)
   01 the threat, 02 the hour and 03 the gap have no script: the hour's line
   and the gap's pentagons draw themselves with CSS scroll-driven animations
   (home-hour.css, home-gap.css), and are simply there anywhere else. (Pieces
   1 and 2 went with the old 01 and 02; the number is kept so the comments
   elsewhere still match.)
   ========================================================================== */

(function () {
  "use strict";

  /* 3  a citation opens the collapsed source list before jumping to it */
  (function () {
    var box = document.getElementById("pb-sources");
    if (!box) return;
    document.addEventListener("click", function (e) {
      var ref = e.target.closest && e.target.closest(".pb-ref");
      if (ref) box.open = true;
    });
  })();

})();
