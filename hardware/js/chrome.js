// Shared chrome: topbar hairline on scroll, and page hand-off so navigating
// between the hub and an instrument reads as one surface instead of a blink.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const topbar = document.querySelector(".topbar");
  if (topbar) {
    let queued = false;
    window.addEventListener("scroll", function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        topbar.classList.toggle("stuck", window.scrollY > 40);
        queued = false;
      });
    }, { passive: true });
  }

  if (reduced) return;

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

  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) document.body.classList.remove("leaving");
  });
})();
