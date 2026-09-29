/* =============================================================================
   ReLeaf: homepage problem section behaviour
   Two independent pieces, each stops if its element is missing:
     2  the hour  02's day axis: a one-shot entrance, armed only when it can run
     3  sources   citations open the collapsed source list (#pb-sources, at the
                  end of the demands block)
   01 and 03 have no script. With JS off or motion reduced, 02 shows its final
   state. (Piece 1, 01's map toggle, went with the old 01; the numbers are
   kept so the comments elsewhere still match.)
   ========================================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Nothing here is scroll-driven, so nothing here uses window.__homeFrame
  // (home.js creates it for the files that do).

  /* 2  the hour: one spell of heat and drought on one axis. The figure is
        complete in markup and CSS; this only arms a one-shot entrance (the
        axis is wiped in left to right, each mark and its list item arrive as
        the wipe reaches their day, the caption last) and fires it the first
        time the figure is on screen.
        It never arms when the figure could already be in view: a page opened
        on a fragment (#hour, a source), or a reload with the figure on
        screen or above it. It gives up and shows the finished figure if the
        reader jumps (a citation, a chapter link) or passes it without it
        coming into view, before printing, and the moment focus moves into
        the figure, so a keyboard reader never lands on a link that is still
        faded out. No scroll job, nothing on __homeFrame, nothing that can
        throw inside the shared frame. */
  (function () {
    var fig = document.getElementById("hour-fig");
    if (!fig || reduced || !("IntersectionObserver" in window)) return;
    if (location.hash) return;
    if (fig.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    var io, done = false;
    function finish() {
      if (done) return;
      done = true;
      if (io) { io.disconnect(); io = null; }
      window.removeEventListener("hashchange", finish);
      fig.removeEventListener("focusin", finish);
      fig.classList.remove("hr2-armed", "hr2-go");
    }
    function play() {
      if (io) { io.disconnect(); io = null; }
      // one frame between the armed state and the run, so the transitions
      // have a start; once the run is over, the classes come off (the
      // finished run and the resting state are the same picture)
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (done) return;
          fig.classList.add("hr2-go");
          setTimeout(finish, 3000);
        });
      });
    }

    fig.classList.add("hr2-armed");
    io = new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      if (e.isIntersecting) play();
      else if (e.boundingClientRect.top < 0) finish();   // passed without being seen
    }, { rootMargin: "0px 0px -15% 0px" });   // starts as its top edge passes 85% of the screen
    io.observe(fig);
    window.addEventListener("hashchange", finish);
    fig.addEventListener("focusin", finish);   // a keyboard reader never lands on a faded link
    window.addEventListener("beforeprint", finish);
  })();

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
