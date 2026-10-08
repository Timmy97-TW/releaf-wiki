/* =============================================================================
   ReLeaf: fit the banner and its abstract into one window
   -----------------------------------------------------------------------------
   bannerhead.css sizes the drawing from the window's height and an assumed
   abstract height (--abs-h). Abstracts differ in length from page to page, so
   this measures the real one and gives the drawing whatever height is left.
   The abstract's own height does not depend on the drawing (the sheet is the
   full frame wide), so one measurement is enough.

   The sheet's top tucks under the drawing by 7% of its width, so lowering the
   drawing by dH raises the abstract's bottom by dH * (1 - 0.07 * aspect).
   Below 900 px the columns stack and the page scrolls anyway: no fitting.
   ========================================================================== */
(function () {
  "use strict";
  var head = document.querySelector("header.bannerhead");
  var sheet = document.querySelector(".abstract--sheet");
  if (!head || !sheet) return;
  var img = head.querySelector(".bannerhead__art img");
  var inner = sheet.querySelector(".abstract__inner");
  var MIN_W = 32 * 16, GAP = 12;

  function fit() {
    head.style.removeProperty("--bw");
    sheet.style.removeProperty("--bw");
    if (window.innerWidth < 900) return;
    var ar = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight
           : parseFloat(getComputedStyle(head).getPropertyValue("--ar")) || 3.012;
    var over = inner.getBoundingClientRect().bottom + window.scrollY - (window.innerHeight - GAP);
    if (over <= 0) return;
    var h = img.getBoundingClientRect().height;
    var w = Math.max(MIN_W, (h - over / (1 - 0.07 * ar)) * ar);
    head.style.setProperty("--bw", w + "px");
    sheet.style.setProperty("--bw", w + "px");
  }

  var t;
  function soon() { clearTimeout(t); t = setTimeout(fit, 120); }
  if (img.complete) fit(); else img.addEventListener("load", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener("resize", soon);
})();
