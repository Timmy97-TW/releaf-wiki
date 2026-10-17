/* =============================================================================
   ReLeaf: Wet Lab Notebook
   -----------------------------------------------------------------------------
   The page works without it: with JavaScript off every month is on the
   page in order, each with its Open PDF and Download links, and the
   plant notebook follows them.

   One job. Month tabs: one month at a time under a segmented control. A
   month's viewer gets its src only when it is on screen, since a file is
   up to 4 MB. The open month is kept in the URL hash (#july).
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  document.body.classList.add("js");

  var root = $("[data-mtabs]");
  if (!root) return;
  var bar = $(".mtabs__bar", root);
  var ink = $(".mtabs__ink", bar);
  var tabs = $$("[role=tab]", bar);
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });

  /* ---- viewer loading -------------------------------------------------- */
  var seen = typeof IntersectionObserver === "function" ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { load(e.target); seen.unobserve(e.target); }
    });
  }, { rootMargin: "300px 0px" }) : null;

  function load(frame, page) {
    var base = frame.getAttribute("data-src");
    /* page width, no thumbnail rail: the viewer is narrow beside its index */
    var want = base + "#" + (page ? "page=" + page + "&" : "") + "view=FitH&navpanes=0";
    if (frame.getAttribute("src") !== want) frame.setAttribute("src", want);
  }
  $$(".pdfbox iframe[data-src]").forEach(function (f) { if (seen) seen.observe(f); else load(f); });

  /* ---- tabs ------------------------------------------------------------ */
  function place() {
    var t = tabs.filter(function (x) { return x.getAttribute("aria-selected") === "true"; })[0];
    if (!t || !ink) return;
    ink.style.width = t.offsetWidth + "px";
    ink.style.transform = "translateX(" + t.offsetLeft + "px)";
  }

  function select(i, opts) {
    opts = opts || {};
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (panels[k]) panels[k].hidden = !on;
    });
    place();
    if (opts.focus) tabs[i].focus();
    if (opts.hash !== false && panels[i] && history.replaceState) {
      history.replaceState(null, "", "#" + panels[i].id);
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(i); });
    t.addEventListener("keydown", function (e) {
      var k = null;
      if (e.key === "ArrowRight") k = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") k = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") k = 0;
      else if (e.key === "End") k = tabs.length - 1;
      if (k !== null) { e.preventDefault(); select(k, { focus: true }); }
    });
  });

  function fromHash() {
    var id = location.hash.slice(1);
    var i = panels.map(function (p) { return p && p.id; }).indexOf(id);
    return i;
  }

  var start = fromHash();
  root.classList.add("is-ready");
  select(start < 0 ? 0 : start, { hash: false });
  if (start >= 0) requestAnimationFrame(function () { root.scrollIntoView({ block: "start" }); });
  window.addEventListener("resize", place);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  window.addEventListener("hashchange", function () { var i = fromHash(); if (i >= 0) select(i, { hash: false }); });

})();
