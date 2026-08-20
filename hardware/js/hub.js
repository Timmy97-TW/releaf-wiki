// Hardware hub — reveal on scroll, pointer-reactive decks, and page hand-off.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- reveal on scroll ---------- */
  const items = Array.prototype.slice.call(
    document.querySelectorAll(".deck, .relate-inner > *, .rel-map, .rel-aside")
  );
  if (items.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("reveal", "in"); });
    } else {
      items.forEach(function (el, i) {
        el.classList.add("reveal");
        el.style.transitionDelay = (i % 3) * 0.08 + "s";
      });
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
      items.forEach(function (el) { io.observe(el); });

      // Safety net. This pattern hides content and depends on the observer, the
      // class and the transition all behaving; if any of them does not, the page
      // is blank below the fold. After a beat, show everything regardless — a
      // missed animation is a far cheaper failure than missing content.
      setTimeout(function () {
        items.forEach(function (el) { el.classList.add("in"); });
      }, 1600);
    }
  }

  /* ---------- topbar hairline once you leave the hero ---------- */
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    let t = false;
    window.addEventListener("scroll", function () {
      if (t) return;
      t = true;
      requestAnimationFrame(function () {
        topbar.classList.toggle("stuck", window.scrollY > 40);
        t = false;
      });
    }, { passive: true });
  }

  /* ---------- pointer-reactive decks ----------
     The card leans very slightly toward the cursor and lights from that side.
     Kept small on purpose — past about 6° it stops reading as a lit object and
     starts reading as a gimmick. Driven off one rAF so many cards stay cheap. */
  const decks = Array.prototype.slice.call(document.querySelectorAll("a.deck"));
  if (decks.length && !reduced && window.matchMedia("(hover: hover)").matches) {
    const MAX = 5.5;            // degrees
    let queued = false;
    let pending = null;

    function apply() {
      queued = false;
      if (!pending) return;
      const { el, px, py } = pending;
      el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      el.style.transform =
        "perspective(1400px) rotateX(" + ((0.5 - py) * MAX).toFixed(2) + "deg)" +
        " rotateY(" + ((px - 0.5) * MAX).toFixed(2) + "deg)" +
        " translateY(-4px)";
    }

    decks.forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        const r = el.getBoundingClientRect();
        pending = {
          el: el,
          px: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          py: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
        };
        if (!queued) { queued = true; requestAnimationFrame(apply); }
      });
      el.addEventListener("pointerleave", function () {
        pending = null;
        el.style.transform = "";
        el.style.setProperty("--mx", "50%");
        el.style.setProperty("--my", "40%");
      });
    });
  }

  /* ---------- page hand-off ----------
     Fade out before navigating so the jump between hub and instrument reads as
     one continuous surface rather than a blink. */
  if (!reduced) {
    document.addEventListener("click", function (e) {
      const a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || a.target === "_blank") return;
      if (a.hostname && a.hostname !== location.hostname) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(function () { location.href = href; }, 300);
    });
    // coming back via the browser's cache should not leave the page faded out
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted) document.body.classList.remove("leaving");
    });
  }
})();
