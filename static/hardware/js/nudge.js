/* nudge.js: a one-time hint that something can be clicked (19 Oct 2026).

   The owner: "our website is too much and readers might not know what to do".
   The first time a group of controls comes properly into view (a DBTL tab
   bar, a figure's tabs, a model's buttons, a viewer's Play), its controls
   light one after another: a soft ring that opens out and fades, 110 ms
   apart. Once per group per page load. A group the reader has already
   pointed at or clicked never nudges, and a reader who prefers less motion
   gets nothing. The controls themselves are untouched: the ring is an
   animation on box-shadow alone, so no layout moves.

   A group is the controls that share a parent. Which controls count is the
   list below; anything else on the page is left alone. */
(function () {
  "use strict";
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var ITEMS = [
    ".cyc-tabs .cyc-tab",          // DBTL bars (static/hardware/js/hwdoc.js) and figure tabs (pm-tabs.js)
    ".xp button",                  // the "Try this" models
    ".xv__play",                   // exploded viewers
    ".sy-dot",                     // the system walk
    ".bvc-case",                   // the bioreactor's control cases
    ".hp-lvl-play"
  ].join(",");

  var css = document.createElement("style");
  css.textContent =
    "@keyframes nz-ring{0%{box-shadow:0 0 0 0 var(--nz-c)}35%{box-shadow:0 0 0 4px var(--nz-c)}" +
    "100%{box-shadow:0 0 0 10px transparent}}" +
    ".nz-on{animation:nz-ring .95s cubic-bezier(.2,.7,.2,1) both;--nz-c:color-mix(in srgb,var(--w-tab,#3f5a66) 30%,transparent)}" +
    ".cyc-tab[aria-selected=\"true\"].nz-on{--nz-c:color-mix(in srgb,var(--w-tab,#3f5a66) 45%,transparent)}";
  document.head.appendChild(css);

  var done = typeof WeakSet === "function" ? new WeakSet() : null;
  if (!done) return;

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && !el.closest("[hidden]"); }

  function play(group) {
    if (done.has(group)) return;
    done.add(group);
    var items = Array.prototype.filter.call(group.querySelectorAll(":scope > " + "*"), function (c) {
      return c.matches(ITEMS) && visible(c);
    });
    if (!items.length) items = Array.prototype.filter.call(group.querySelectorAll(ITEMS), visible);
    items.slice(0, 8).forEach(function (el, i) {
      setTimeout(function () {
        el.classList.remove("nz-on"); void el.offsetWidth; el.classList.add("nz-on");
        el.addEventListener("animationend", function f() { el.classList.remove("nz-on"); el.removeEventListener("animationend", f); });
      }, 250 + i * 110);
    });
  }

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio >= 0.9) { io.unobserve(e.target); play(e.target); }
    });
  }, { threshold: [0, 0.9], rootMargin: "-12% 0px -18% 0px" });

  function scan() {
    var seen = [];
    Array.prototype.forEach.call(document.querySelectorAll(ITEMS), function (el) {
      var g = el.parentNode;
      if (!g || seen.indexOf(g) >= 0 || done.has(g)) return;
      seen.push(g);
      // a reader who reaches for the controls first needs no hint
      ["pointerover", "focusin"].forEach(function (t) {
        g.addEventListener(t, function () { done.add(g); io.unobserve(g); }, { once: true, passive: true });
      });
      io.observe(g);
    });
  }

  // the bars and the models are built by other scripts: scan once they have run, and again a little later
  if (document.readyState === "complete") scan(); else window.addEventListener("load", scan);
  setTimeout(scan, 2500);
})();
