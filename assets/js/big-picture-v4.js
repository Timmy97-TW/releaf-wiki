/* =============================================================================
   ReLeaf: the big picture, V4
   -----------------------------------------------------------------------------
   One job, and no second one: emphasis.

   Pointing at a component holds it, the step it belongs to, and every joint and
   step downstream of it, so the figure answers "how does this part reach a
   farm" without a line being drawn anywhere. Pointing at a step holds the step
   and everything downstream of it.

   NOTHING OPENS, AND NOTHING IS WRITTEN. Every word of this section is in the
   markup before this file runs, so the page is complete with scripting off. If
   a future edit starts putting content in here, the section has stopped doing
   its job.

   ONE LISTENER, ON THE CONTAINER, using pointerover, which bubbles. V2's note
   applies unchanged: per-item pointerenter and pointerleave fire leave then
   enter when you cross between two neighbours, and the frame in between has
   everything un-held, so dragging across the figure strobes.
   ========================================================================== */

(function () {
  "use strict";

  var chain = document.getElementById("bp4-chain");
  if (!chain) return;

  var steps  = [].slice.call(chain.querySelectorAll(".bp4-step"));
  var joints = [].slice.call(chain.querySelectorAll(".bp4-joint"));

  function clear() {
    chain.removeAttribute("data-hold");
    steps.concat(joints).forEach(function (el) { el.removeAttribute("data-lit"); });
    [].forEach.call(chain.querySelectorAll(".bp4-comp"), function (c) {
      c.removeAttribute("data-held");
    });
  }

  /* Hold everything from this step number to the end of the chain, plus the
     return joint, which belongs to the field and therefore to every run. */
  function holdFrom(from, comp) {
    chain.setAttribute("data-hold", "");
    steps.forEach(function (s) {
      if (+s.getAttribute("data-step") >= from) s.setAttribute("data-lit", "");
      else s.removeAttribute("data-lit");
    });
    joints.forEach(function (j) {
      if (+j.getAttribute("data-after") >= from) j.setAttribute("data-lit", "");
      else j.removeAttribute("data-lit");
    });
    [].forEach.call(chain.querySelectorAll(".bp4-comp"), function (c) {
      if (c === comp) c.setAttribute("data-held", "");
      else c.removeAttribute("data-held");
    });
  }

  function hold(target) {
    if (!target || !target.closest) { clear(); return; }
    var comp = target.closest(".bp4-comp");
    var step = target.closest(".bp4-step");
    if (!step) { clear(); return; }
    holdFrom(+step.getAttribute("data-step"), comp);
  }

  chain.addEventListener("pointerover", function (e) { hold(e.target); });
  chain.addEventListener("pointerleave", clear);
  chain.addEventListener("focusin",  function (e) { hold(e.target); });
  chain.addEventListener("focusout", function (e) {
    if (!chain.contains(e.relatedTarget)) clear();
  });
})();
