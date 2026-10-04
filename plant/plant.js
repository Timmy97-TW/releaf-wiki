/* =============================================================================
   ReLeaf: the Plants page
   -----------------------------------------------------------------------------
   Four small behaviours. With JavaScript off the run browser shows every panel
   (the chips just do nothing), the matrix still shows every verdict and its
   first cell's detail, and every stage of the rail is on the page, stacked,
   because the panels ship without the hidden attribute and this script is what
   puts it on. The four platform panels further down work the same way, through
   the tab group in assets/js/page.js. Clicking changes which one you are
   looking at; it never reveals a fact that is otherwise unreachable, and with
   the script off nothing is hidden either.
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

  /* ---- 4. run browser ---------------------------------------------------- */
  /* A vertical tablist of experimental runs beside one panel, plus chips that
     narrow the list by protectant or by stress. The chips hide index entries,
     never panel content: if the selected run is filtered out, the first run
     still showing is opened so the panel is never blank.                    */

  function runs(root) {
    var btns   = $$(".run", root);
    var panels = $$(".runs__panel", root);
    var phases = $$(".runs__phase", root);
    var chips  = $$(".chip", root);
    var count  = $(".runs__count", root);
    var none   = $(".runs__none", root);
    if (!btns.length || !panels.length) return;

    function show(btn) {
      btns.forEach(function (b) {
        var on = b === btn;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p) { p.hidden = p.id !== btn.getAttribute("aria-controls"); });
    }

    function visible() { return btns.filter(function (b) { return !b.hidden; }); }

    function filter(key) {
      btns.forEach(function (b) {
        b.hidden = !(key === "all" || (b.dataset.tags || "").split(" ").indexOf(key) > -1);
      });
      phases.forEach(function (h) {
        h.hidden = !btns.some(function (b) { return b.dataset.phase === h.dataset.phase && !b.hidden; });
      });
      chips.forEach(function (c) {
        c.setAttribute("aria-pressed", c.dataset.filter === key ? "true" : "false");
      });

      var vis = visible();
      if (count) count.textContent = vis.length + " of " + btns.length + (btns.length === 1 ? " run" : " runs");
      if (none) none.hidden = vis.length > 0;
      if (vis.length && !vis.some(function (b) { return b.getAttribute("aria-selected") === "true"; })) show(vis[0]);
    }

    btns.forEach(function (b) {
      b.addEventListener("click", function () { show(b); });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var vis = visible();
        var next = vis[(vis.indexOf(b) + d + vis.length) % vis.length];
        next.focus();
        show(next);
      });
    });

    chips.forEach(function (c) {
      c.addEventListener("click", function () { filter(c.dataset.filter); });
    });

    show(btns[0]);
    filter("all");
  }

  function boot() {
    $$("[data-rail]").forEach(rail);
    $$("[data-ledger]").forEach(ledger);
    $$("[data-matrix]").forEach(matrix);
    $$("[data-runs]").forEach(runs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
