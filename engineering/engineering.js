/* =============================================================================
   ENGINEERING · page script
   -----------------------------------------------------------------------------
   Almost nothing happens here, and that is the point. The tabs, the contents
   rail, the [n] citations and the figure lightbox all come from
   assets/js/page.js. Native <details> carries every "Show details" toggle.

   This file adds two things that page.js has no reason to know about:

     1. The at-a-glance map links to a subsystem. Following one should also put
        that subsystem's FIRST cycle on screen, which it already does, and move
        focus to the first tab so the keyboard lands where the eye does.
     2. A cycle can be linked to directly (…/engineering/#r5). page.js opens the
        panel; this moves focus into it so a screen reader announces the cycle
        rather than leaving the caret at the top of the page.

   With scripts off nothing here is needed: every panel is visible, every
   toggle opens, and the page reads top to bottom.
   ========================================================================== */

(function () {
  "use strict";

  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* Move focus to the tab strip of the section a map card points at, so the
     next Tab press lands on the cycles rather than back at the top. */
  function mapFocus() {
    $$(".map__card").forEach(function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("href");
        if (!id || id.charAt(0) !== "#") return;
        var sec = document.getElementById(id.slice(1));
        if (!sec) return;
        var first = sec.querySelector(".tabs__btn[aria-selected='true']") ||
                    sec.querySelector(".tabs__btn");
        if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 0);
      });
    });
  }

  /* A link straight to a cycle panel: give the panel focus once page.js has
     opened it. The panel already carries tabindex="0" in the markup. */
  function focusLinkedPanel() {
    var hash = location.hash;
    if (!hash || hash.length < 2) return;
    var el;
    try { el = document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch (e) { return; }
    if (el && el.classList.contains("tabs__panel") && !el.hidden) {
      window.setTimeout(function () { el.focus({ preventScroll: true }); }, 0);
    }
  }

  function init() {
    mapFocus();
    focusLinkedPanel();
    window.addEventListener("hashchange", focusLinkedPanel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
