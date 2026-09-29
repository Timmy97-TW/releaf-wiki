/* =============================================================================
   Gallery behaviour, on top of page.js.

   1. Lightbox. page.js opens whatever file a photograph shows. This swaps in
      the large file named in data-full once the lightbox is open, and lets the
      left and right arrow keys step through the other photographs of the same
      story (or the same archive month). It only reads and writes the lightbox
      page.js built, so page.js stays the single owner of opening and closing.
   2. Index bar. Marks the story the reader is in.
   (An older copy of part 1 lives in milestone/ for the milestone page.)
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. lightbox --------------------------------------------------------- */
  var all = [].slice.call(document.querySelectorAll("img[data-full]"));
  var group = [], current = -1;

  function box() { return document.querySelector(".lightbox"); }
  function setOf(img) {
    var home = img.closest(".story, .gx-month");
    return home ? [].slice.call(home.querySelectorAll("img[data-full]")) : all;
  }

  function show(img) {
    var b = box();
    if (!b) return;
    var big = b.querySelector("img"), cap = b.querySelector("figcaption");
    group = setOf(img);
    current = group.indexOf(img);
    big.src = img.getAttribute("data-full");
    big.alt = img.alt;
    var fig = img.closest("figure");
    var fc = fig && fig.querySelector("figcaption");
    if (cap) cap.textContent = fc ? fc.textContent.replace(/¶$/, "").replace(/\s+/g, " ").trim() : "";
  }

  if (all.length) {
    /* page.js listens on the image itself; these listen on the document, so
       they run after it and find the lightbox already open */
    document.addEventListener("click", function (e) {
      var img = e.target.closest && e.target.closest("img[data-full]");
      if (img && !img.closest(".lightbox")) show(img);
    });
    document.addEventListener("keydown", function (e) {
      var b = box();
      var open = b && b.classList.contains("is-open");
      if (!open && (e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("img[data-full]")) {
        show(e.target);
        return;
      }
      if (!open || current < 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        var next = current + (e.key === "ArrowRight" ? 1 : -1);
        if (next < 0 || next >= group.length) return;
        show(group[next]);
      }
    });
  }

  /* ---- 2. index bar -------------------------------------------------------- */
  var bar = document.querySelector(".gx-index");
  if (!bar) return;
  var links = [].slice.call(bar.querySelectorAll("a[href^='#']"));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  var lit = null, queued = false;

  function update() {
    queued = false;
    var line = window.innerHeight * 0.35, hit = -1;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].getBoundingClientRect().top <= line) hit = i;
    }
    var a = hit >= 0 ? links[hit] : null;
    if (a === lit) return;
    if (lit) { lit.classList.remove("is-active"); lit.removeAttribute("aria-current"); }
    lit = a;
    if (!a) return;
    a.classList.add("is-active");
    a.setAttribute("aria-current", "true");
    /* keep the lit entry in view on a phone, where the bar scrolls sideways */
    var ol = a.closest("ol");
    if (ol && ol.scrollWidth > ol.clientWidth) {
      var l = a.parentNode.offsetLeft - 16;
      ol.scrollLeft = Math.max(0, l);
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
  update();
})();
