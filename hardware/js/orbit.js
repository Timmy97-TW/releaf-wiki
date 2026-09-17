// The hub's orbit (tools/build_orbit.py, css/hub.css "hub: orbit").
//
// Two things only, both optional: the intro, played once as the orbit comes into view, and the loop's
// flow held still while the orbit is off screen. Pointing at an instrument, the lit rings and the details
// are all CSS, so without this file the orbit is simply static and complete.
(function () {
  const sec = document.querySelector(".orbit");
  if (!sec || !("IntersectionObserver" in window)) return;

  // The flow along the culture loop costs a repaint a frame, and nobody needs it until the orbit is actually on screen:
  // with a margin it ran from the first moment the hub loaded, under the hero film.
  // (A section whose top only touches the bottom of the window counts as intersecting, which kept it running at the
  // very top of the hub: it waits for 1% of the section instead.)
  new IntersectionObserver(function (es) {
    sec.classList.toggle("is-away", es[0].intersectionRatio < 0.01);
  }, { threshold: [0, 0.01] }).observe(sec);

  // The intro: the rings open out of the core, the instruments arrive on them, then the words. Not under
  // reduced motion, not in the stacked phone layout, and not if the orbit is already in view on load.
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = sec.querySelector(".orbit-stage");
  if (reduced || !stage || window.innerWidth < 980 || stage.getBoundingClientRect().top < window.innerHeight * 0.7) return;
  sec.classList.add("is-armed");
  let started = false;
  function go() {
    if (started) return;
    started = true;
    sec.classList.add("is-in");
    // css/hub.css "hub: orbit" plays it in under a second (the owner asked for it faster, 13 Sep; it took 2.1 s)
    setTimeout(function () {
      sec.classList.add("is-done");
      sec.classList.remove("is-armed", "is-in");
    }, 1000);
  }
  let heard = false;
  const io = new IntersectionObserver(function (es) {
    heard = true;
    // as soon as the drawing starts to come into view, so it has finished by the time it is all on screen
    if (es[0].intersectionRatio >= 0.08) { io.disconnect(); go(); }
  }, { threshold: [0, 0.08] });
  io.observe(stage);
  // An observer always reports once as soon as it starts. If this one never does, the intro cannot run, and it must
  // not leave the orbit hidden. (Not a plain timer: anyone still watching the film when it fired would miss the intro.)
  setTimeout(function () { if (!heard) go(); }, 3000);
})();
