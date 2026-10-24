/* =============================================================================
   Bioreactor 7.3, Future Plan: the containment figures' behaviour (17 Oct 2026)
   -----------------------------------------------------------------------------
   figure.bvc[data-bvc]       fig-layers, fig-response: light one layer or one path
   figure.bvc[data-bvc-drop]  fig-droplet: let one drop fall a few times, once, when it first comes into view

   Lighting. Inside a figure, anything with data-key="k" lights k; anything whose data-on lists k
   (space-separated) belongs to it and gets .is-on, and the figure gets .is-lit (static/hardware/bioreactor/css/bv-contain.css dims the
   rest). A mouse lights on hover, the keyboard on focus; a click or tap on a button pins it (aria-pressed),
   a second click, Esc, or a click outside the figure lets it go. A layer's row is a link and is simply
   followed. A ring with the mouse follows its row's link; on a touch screen the first tap lights the
   ring and a second tap follows it.

   Dependency-free, no animation loop: only event listeners and one IntersectionObserver that disconnects
   after it has fired. Does nothing when no figure is on the page. window.BVC.init(root) wires figures added
   later (the preview harness inserts them after load); a figure is never wired twice.
   ========================================================================== */
(function () {
  "use strict";
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function holds(el, key) { return (" " + (el.getAttribute("data-on") || "") + " ").indexOf(" " + key + " ") >= 0; }

  function wire(fig) {
    if (fig.bvcWired) return;
    fig.bvcWired = true;
    var targets = fig.querySelectorAll("[data-on]");
    var triggers = fig.querySelectorAll("[data-key]");
    if (!triggers.length) return;
    var pinned = "", hovered = "", focused = "", pointer = "mouse";

    function paint() {
      var key = hovered || focused || pinned;
      fig.classList.toggle("is-lit", !!key);
      each(targets, function (el) { el.classList.toggle("is-on", !!key && holds(el, key)); });
      each(triggers, function (el) {
        if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", el.getAttribute("data-key") === pinned ? "true" : "false");
      });
    }
    function rowLink(key) { return fig.querySelector('a[href][data-key="' + key + '"]'); }

    each(triggers, function (el) {
      var key = el.getAttribute("data-key");
      var isLink = el.tagName.toLowerCase() === "a" && el.hasAttribute("href");
      var isDrawn = !isLink && el.namespaceURI === "http://www.w3.org/2000/svg";
      el.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") { hovered = key; paint(); } });
      el.addEventListener("pointerleave", function (e) { if (e.pointerType !== "touch" && hovered === key) { hovered = ""; paint(); } });
      el.addEventListener("focus", function () { focused = key; paint(); });
      el.addEventListener("blur", function () { if (focused === key) { focused = ""; paint(); } });
      el.addEventListener("click", function () {
        if (isLink) return;                               // a layer's row: the browser follows it
        if (isDrawn) {                                    // a ring: light it first on touch, else follow its row
          var row = rowLink(key);
          if (pointer === "touch" && pinned !== key) { pinned = key; paint(); return; }
          if (row) { pinned = ""; row.click(); return; }
        }
        pinned = pinned === key ? "" : key;
        paint();
      });
    });
    fig.addEventListener("pointerdown", function (e) { pointer = e.pointerType || "mouse"; }, true);
    fig.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && (pinned || hovered || focused)) { pinned = hovered = focused = ""; paint(); }
    });
    document.addEventListener("click", function (e) {
      if (pinned && !fig.contains(e.target)) { pinned = ""; paint(); }
    });
  }

  function drop(fig) {
    if (fig.bvcWired) return;
    fig.bvcWired = true;
    if ((mq && mq.matches) || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || e.intersectionRatio < 0.55) return;
        io.disconnect();
        setTimeout(function () { fig.classList.add("is-play"); }, 400);
      });
    }, { threshold: [0, 0.55] });
    io.observe(fig);
  }

  function init(root) {
    root = root || document;
    each(root.querySelectorAll("figure.bvc[data-bvc]"), wire);
    each(root.querySelectorAll("figure.bvc[data-bvc-drop]"), drop);
  }
  window.BVC = { init: init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();
})();
