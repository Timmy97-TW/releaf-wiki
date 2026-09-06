/* =============================================================================
   ReLeaf: the Software page
   -----------------------------------------------------------------------------
   The same three behaviours as the Plants page, over the same markup, because
   this page is built on that template. With JavaScript off the layer rail still
   shows the field layer, the twin matrix still shows every verdict and its
   first cell's detail, and the measurement register still lists all eighteen
   rows (the chips just do nothing). Clicking changes which one you are looking
   at; it never reveals a fact that is otherwise unreachable.

   The embedded operator interface is an <iframe> and needs nothing from here.
   It is its own single-file application and this script does not touch it.
   ========================================================================== */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- 1. layer rail ----------------------------------------------------- */

  function rail(root) {
    var btns   = $$(".rail__btn", root);
    var panels = $$(".rail__panel", root);
    if (!btns.length) return;

    function show(i) {
      btns.forEach(function (b, n) {
        b.setAttribute("aria-selected", n === i ? "true" : "false");
        b.tabIndex = n === i ? 0 : -1;
      });
      panels.forEach(function (p, n) { p.hidden = n !== i; });
    }

    btns.forEach(function (b, i) {
      b.addEventListener("click", function () { show(i); });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + btns.length) % btns.length;
        btns[n].focus();
        show(n);
      });
    });

    show(0);
  }

  /* ---- 2. measurement register ------------------------------------------- */

  function ledger(root) {
    var chips = $$(".chip", root);
    var rows  = $$("tbody tr", root);
    var empty = $(".ledger__none", root);
    if (!chips.length || !rows.length) return;

    function apply(key) {
      var shown = 0;
      rows.forEach(function (r) {
        var hit = key === "all" || (r.dataset.tags || "").split(" ").indexOf(key) > -1;
        r.hidden = !hit;
        if (hit) shown += 1;
      });
      if (empty) empty.hidden = shown > 0;
      chips.forEach(function (c) { c.setAttribute("aria-pressed", c.dataset.filter === key ? "true" : "false"); });
    }

    chips.forEach(function (c) {
      c.addEventListener("click", function () { apply(c.dataset.filter); });
    });

    apply("all");
  }

  /* ---- 3. digital twin matrix -------------------------------------------- */

  function matrix(root) {
    var cells = $$(".cell", root).filter(function (c) { return !c.classList.contains("cell--none"); });
    var out   = $(".matrix__out", root);
    if (!cells.length || !out) return;

    var head = $("h4", out);
    var meta = $(".microlabel", out);
    var body = $(".matrix__out-body", out);

    function show(cell) {
      cells.forEach(function (c) { c.setAttribute("aria-pressed", c === cell ? "true" : "false"); });
      head.textContent = cell.dataset.title || "";
      meta.textContent = cell.dataset.meta || "";
      body.innerHTML   = cell.dataset.body || "";
    }

    cells.forEach(function (c) {
      c.addEventListener("click", function () { show(c); });
    });

    show(cells[0]);
  }

  function boot() {
    $$("[data-rail]").forEach(rail);
    $$("[data-ledger]").forEach(ledger);
    $$("[data-matrix]").forEach(matrix);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
