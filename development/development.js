/* ReLeaf: the Development page.
   page.js already switches the tabs. This file adds three things on top:
   1. the white thumb that slides to the open segment,
   2. bringing the journey back to the top of its tabs when the reader
      switches subsystem from far down a long panel,
   3. the steps rising in as they reach the screen.                         */
(function () {
  "use strict";
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---- 1. segmented controls -------------------------------------------- */
  $$(".seg").forEach((seg) => {
    const thumb = seg.querySelector(".seg__thumb");
    const btns = $$(".seg__btn", seg);
    if (!thumb || !btns.length) return;

    const place = () => {
      const on = btns.find((b) => b.getAttribute("aria-selected") === "true");
      if (!on) return;
      thumb.style.width = on.offsetWidth + "px";
      thumb.style.height = on.offsetHeight + "px";
      thumb.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)";
      /* a scrolled strip keeps the open segment in view */
      if (seg.scrollWidth > seg.clientWidth) {
        const l = on.offsetLeft - (seg.clientWidth - on.offsetWidth) / 2;
        seg.scrollTo({ left: l, behavior: seg.classList.contains("is-ready") ? "smooth" : "auto" });
      }
    };

    /* the first placement happens without animation */
    thumb.style.transition = "none";
    place();
    requestAnimationFrame(() => { thumb.style.transition = ""; seg.classList.add("is-ready"); });

    new MutationObserver(place).observe(seg, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    window.addEventListener("resize", place, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  });

  /* ---- 2. journey: back to the top of the tabs -------------------------- */
  const journey = document.querySelector(".journey");
  if (journey) {
    const strip = journey.querySelector(".seg--journey");
    journey.addEventListener("click", (e) => {
      if (!e.target.closest(".seg__btn")) return;
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 68;
      const top = journey.getBoundingClientRect().top;
      if (top < navH) {
        const y = window.scrollY + top - navH - 12;
        window.scrollTo({ top: y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      if (strip) strip.blur && strip.blur();
    });
  }

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
