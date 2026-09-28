/* =============================================================================
   ReLeaf: Wet Lab Notebook
   -----------------------------------------------------------------------------
   One job: a month's PDF is heavy (up to about 6 MB), so the viewer inside a
   <details> gets its src only when that month is opened for the first time.
   Closing it again leaves the document loaded, so reopening is instant.

   Everything else on the page works with JavaScript off: the toggles are real
   <details>, and each one carries "Open PDF" and "Download" links next to the
   viewer, so the file is reachable whether or not the embed ever runs.
   ========================================================================== */
(function () {
  "use strict";

  var panels = document.querySelectorAll("details[data-pdf]");

  Array.prototype.forEach.call(panels, function (d) {
    var frame = d.querySelector("iframe[data-src]");
    if (!frame) return;

    function load() {
      if (frame.getAttribute("src")) return;
      frame.setAttribute("src", frame.getAttribute("data-src"));
    }

    d.addEventListener("toggle", function () {
      if (d.open) load();
    });

    if (d.open) load();
  });
})();
