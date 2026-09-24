/* =============================================================================
   ReLeaf: the Plants page
   -----------------------------------------------------------------------------
   Three small behaviours. With JavaScript off the ledger still lists every run
   (the chips just do nothing), the matrix still shows every verdict and its
   first cell's detail, and every stage of the rail is on the page, stacked,
   because the panels ship without the hidden attribute and this script is what
   puts it on. Clicking changes which one you are looking at; it never reveals
   a fact that is otherwise unreachable, and with the script off nothing is
   hidden either.
   ========================================================================== */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- 1. stage rail ----------------------------------------------------- */

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
        var last = btns.length - 1, n;
        if (e.key === "ArrowRight") n = i === last ? 0 : i + 1;
        else if (e.key === "ArrowLeft") n = i === 0 ? last : i - 1;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = last;
        else return;
        e.preventDefault();
        btns[n].focus();
        show(n);
      });
    });

    show(0);
  }

  /* ---- 2. run ledger ----------------------------------------------------- */

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

  /* ---- 3. protectant matrix ---------------------------------------------- */

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
