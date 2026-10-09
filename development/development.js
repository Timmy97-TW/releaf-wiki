/* ReLeaf: the Development page.
   Since 10 October 2026 the shared engage.js drives the three segmented
   controls: the sliding thumb, and taking a reader who switches subsystem
   from deep inside a panel back to the top of the new one (data-rail-top).
   What is left here is this page's own: the journey steps rising in as they
   reach the screen.                                                        */
(function () {
  "use strict";
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---- 3. steps rise in --------------------------------------------------- */
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const steps = $$(".step");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    /* anything already on screen at load is shown at once */
    steps.forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) s.classList.add("is-in");
      io.observe(s);
    });
    document.documentElement.classList.add("dev-rise");
  }
})();
