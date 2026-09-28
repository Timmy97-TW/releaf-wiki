/* =============================================================================
   The grid shows small thumbnails; page.js's lightbox opens whatever file the
   thumbnail is. This swaps in the large file named in data-full once the
   lightbox is open, and lets the arrow keys step to the previous or next
   photograph on the page. It only reads and writes the lightbox page.js
   built, so page.js stays the single owner of opening and closing.
   (The same file is copied to milestone/ for the milestone page.)
   ========================================================================== */
(function () {
  "use strict";
  var list = [].slice.call(document.querySelectorAll("img[data-full]"));
  if (!list.length) return;
  var current = -1;

  function box() { return document.querySelector(".lightbox"); }

  function show(img) {
    var b = box();
    if (!b) return;
    var big = b.querySelector("img"), cap = b.querySelector("figcaption");
    current = list.indexOf(img);
    big.src = img.getAttribute("data-full");
    big.alt = img.alt;
    var fc = img.closest("figure") && img.closest("figure").querySelector("figcaption");
    if (cap) cap.textContent = fc ? fc.textContent.replace(/¶$/, "").trim() : "";
  }

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
      if (next < 0 || next >= list.length) return;
      show(list[next]);
    }
  });
})();
