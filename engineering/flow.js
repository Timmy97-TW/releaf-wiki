/* =============================================================================
   ENGINEERING · the wet lab / dry lab flow web
   -----------------------------------------------------------------------------
   One job: selecting an area lifts its exchange and fades the other two. A
   second press on the same area, or Escape while the focus is inside the
   figure, returns it.

   The arrows are drawn by flow.css inside each row, so there is no geometry
   here and nothing to recompute on resize. The toggle semantics are added here
   rather than in the markup, so with scripts off the cards claim nothing they
   cannot do: they stay plain text beside their links.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.querySelector(".flow");
  var fig  = root && root.querySelector("[data-flow]");
  if (!fig) return;

  var btns  = Array.prototype.slice.call(fig.querySelectorAll(".flow__node"));
  var cells = Array.prototype.slice.call(fig.querySelectorAll(".flow__cell"));
  var rows  = Array.prototype.slice.call(fig.querySelectorAll(".flow__row"));
  var sel   = null;

  root.classList.add("is-live");

  function paint() {
    cells.forEach(function (c) { c.classList.toggle("is-sel", c.dataset.node === sel); });
    rows.forEach(function (r) {
      r.classList.toggle("is-sel", !!sel && !!r.querySelector('.flow__cell[data-node="' + sel + '"]'));
    });
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.node === sel ? "true" : "false");
    });
    if (sel) fig.setAttribute("data-sel", sel);
    else fig.removeAttribute("data-sel");
  }

  btns.forEach(function (b) {
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      sel = (b.dataset.node === sel) ? null : b.dataset.node;
      paint();
    });
  });

  root.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape" || !sel) return;
    sel = null;
    paint();
    ev.stopPropagation();
  });
})();
