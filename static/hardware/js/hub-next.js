/* The hub's "more below" line at the foot of the instruments (21 Oct 2026, owner: "remind them there is still stuff
   below without diverting their focus"). Once the instruments fill the screen and the reader has lingered there
   4 s without scrolling, the arrow nudges twice, once per visit. It fades as soon as the guides come into view. */
(function () {
  "use strict";
  var a = document.querySelector(".pb-next"), sec = document.getElementById("instruments"), next = document.getElementById("guides");
  if (!a || !sec || !next || !("IntersectionObserver" in window)) return;
  var timer = 0, nudged = false;
  new IntersectionObserver(function (es) {
    var e = es[0];
    clearTimeout(timer);
    if (!nudged && e.intersectionRatio > .85) timer = setTimeout(function () { nudged = true; a.classList.add("is-nudge"); }, 4000);
  }, { threshold: [0, .85] }).observe(sec);
  new IntersectionObserver(function (es) {
    a.classList.toggle("is-gone", es[0].isIntersecting);
  }, { rootMargin: "0px 0px -15% 0px" }).observe(next);
})();
