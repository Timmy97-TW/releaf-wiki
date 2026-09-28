/* Experiments: open the protocol a link points at.
   page.js already opens the tab that holds a #target. The protocols are
   closed <details> inside those tabs, so a link to #colony-pcr (from the
   contents rail, another page or a shared URL) would land on a closed toggle.
   This opens every <details> around the target, and the target itself, then
   scrolls to it. Opening a protocol by hand writes its id into the URL so the
   address can be shared. */
(function () {
  "use strict";

  function reveal(hash, scroll) {
    if (!hash || hash.length < 2) return;
    var el;
    try { el = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return; }
    if (!el) return;
    var panel = el.closest(".tabs__panel");
    if (panel && panel.openPanel) panel.openPanel();
    if (el.tagName === "DETAILS") el.open = true;
    for (var d = el.parentElement && el.parentElement.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) {
      if (!d.classList.contains("toc")) d.open = true;
    }
    if (scroll) requestAnimationFrame(function () { el.scrollIntoView({ block: "start" }); });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) reveal(a.getAttribute("href"), false);
  });
  window.addEventListener("hashchange", function () { reveal(location.hash, true); });
  if (location.hash) reveal(location.hash, true);

  document.querySelectorAll("details.xp").forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open && history.replaceState) history.replaceState(null, "", "#" + d.id);
    });
  });
})();
