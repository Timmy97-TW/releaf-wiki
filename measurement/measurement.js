/* The measurement chain on the overview.
   Progressive enhancement: the markup ships with every panel readable, and
   this collapses it to one panel at a time once scripting is available. */
(function () {
  "use strict";
  var root = document.querySelector("[data-mchain]");
  if (!root) return;

  var btns = Array.prototype.slice.call(root.querySelectorAll(".mchain__node"));
  var panels = Array.prototype.slice.call(root.querySelectorAll(".mchain__panel"));
  if (btns.length !== panels.length || !btns.length) return;

  function show(i, focus) {
    btns.forEach(function (b, n) {
      b.setAttribute("aria-selected", n === i ? "true" : "false");
      b.tabIndex = n === i ? 0 : -1;
    });
    panels.forEach(function (p, n) { p.hidden = n !== i; });
    if (focus) btns[i].focus();
  }

  btns.forEach(function (b, i) {
    b.addEventListener("click", function () { show(i); });
    b.addEventListener("keydown", function (e) {
      var k = e.key, j = -1;
      if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % btns.length;
      else if (k === "ArrowLeft" || k === "ArrowUp") j = (i - 1 + btns.length) % btns.length;
      else if (k === "Home") j = 0;
      else if (k === "End") j = btns.length - 1;
      if (j >= 0) { e.preventDefault(); show(j, true); }
    });
  });

  /* a link into a section opens nothing here, but a link to a panel's own
     section should leave the chain as the reader found it */
  show(0);
})();
