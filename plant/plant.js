/* =============================================================================
   ReLeaf: the Plants page
   -----------------------------------------------------------------------------
   Four small behaviours. With JavaScript off every tab panel is on the page
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

  /* ---- 4. tab sets ------------------------------------------------------- */
  /* Every [data-tabset]: its own bar of role="tab" buttons, each pointing at a
     panel by aria-controls. A sliding ink marks the open tab. Sets that share
     a data-sync name (the Agar / Hydroponics / Soil tabs in sections 1 and 2)
     move together. A link to anything inside a closed panel opens the panels
     around it first, so the contents rail still lands where it says.       */

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var groups = {};
  var all = [];

  function navH() {
    var s = $(".sitenav-spacer");
    return s ? s.offsetHeight : 68;
  }

  /* how far down the window the content starts under this set: the site nav,
     plus the pinned system bar when the set lives inside one              */
  function topLine(root) {
    var line = navH();
    var sys = root.parentElement && root.parentElement.closest(".tabset--sys");
    if (sys) line += $(".tabset__bar", sys).offsetHeight + 16;
    return line;
  }

  function tabset(root) {
    var bar = $(".tabset__bar", root);
    if (!bar) return;
    var tabs = $$('[role="tab"]', bar);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    var ink = $(".tabset__ink", bar);
    var sync = root.getAttribute("data-sync");
    var current = -1;

    function place() {
      /* the system bar publishes its height so the strips below can pin under it */
      if (root.hasAttribute("data-sticky")) root.style.setProperty("--sys-h", bar.offsetHeight + "px");
      if (!ink || current < 0) return;
      var t = tabs[current];
      ink.style.width = t.offsetWidth + "px";
      ink.style.transform = "translateX(" + t.offsetLeft + "px)";
      if (t.offsetHeight && root.classList.contains("tabset--sub")) ink.style.height = "";
    }

    function bringIntoView(t) {
      if (bar.scrollWidth <= bar.clientWidth + 1) return;
      var left = t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2;
      bar.scrollTo({ left: left, behavior: reduce ? "auto" : "smooth" });
    }

    function scrollToSet() {
      var y = root.getBoundingClientRect().top - topLine(root) - 12;
      if (Math.abs(y) > 2) window.scrollTo({ top: window.scrollY + y, behavior: reduce ? "auto" : "smooth" });
    }

    function select(i, opts) {
      opts = opts || {};
      if (i < 0 || i >= tabs.length) return;
      if (i !== current || opts.force) {
        current = i;
        tabs.forEach(function (t, n) {
          var on = n === i;
          t.setAttribute("aria-selected", on ? "true" : "false");
          t.tabIndex = on ? 0 : -1;
        });
        panels.forEach(function (p, n) { if (p) p.hidden = n !== i; });
        place();
        bringIntoView(tabs[i]);
        /* sets nested in the panel that just opened measure their ink now */
        if (panels[i]) $$("[data-tabset]", panels[i]).forEach(function (r) { if (r._place) r._place(); });
        if (sync && !opts.quiet) {
          (groups[sync] || []).forEach(function (api) { if (api.root !== root) api.selectKey(tabs[i].getAttribute("data-key")); });
        }
      }
      /* switching while the bar is pinned would leave the reader halfway down
         a panel they have not read: bring the top of the set back into view */
      if (opts.scroll === "always" || (opts.scroll && root.getBoundingClientRect().top < topLine(root) - 4)) scrollToSet();
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, { scroll: true }); });
      t.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 :
                e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (n === null) return;
        e.preventDefault();
        n = (n + tabs.length) % tabs.length;
        tabs[n].focus();
        select(n);
      });
    });

    var api = {
      root: root,
      selectKey: function (key) {
        for (var n = 0; n < tabs.length; n++) if (tabs[n].getAttribute("data-key") === key) { select(n, { quiet: true }); return; }
      },
      selectTab: function (tab, opts) { select(tabs.indexOf(tab), opts); }
    };
    root._api = api;
    root._place = place;
    if (sync) (groups[sync] = groups[sync] || []).push(api);
    all.push(root);

    var start = 0;
    tabs.forEach(function (t, n) { if (t.getAttribute("aria-selected") === "true") start = n; });
    select(start, { force: true, quiet: true });
    root.classList.add("is-ready");
  }

  /* open every closed panel that holds el, outermost first */
  function reveal(el) {
    var chain = [];
    for (var p = el; p && p !== document.body; p = p.parentElement) {
      if (p.getAttribute && p.getAttribute("role") === "tabpanel") chain.unshift(p);
    }
    chain.forEach(function (panel) {
      var tab = $('[aria-controls="' + panel.id + '"]');
      var root = tab && tab.closest("[data-tabset]");
      if (root && root._api) root._api.selectTab(tab);
    });
  }

  function targetOf(hash) {
    if (!hash || hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
  }

  function wireTabsets() {
    $$("[data-tabset]").forEach(tabset);

    /* contents rail, citations, any in-page link */
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a) { var el = targetOf(a.getAttribute("href")); if (el) reveal(el); }
      var go = e.target.closest && e.target.closest("[data-goto]");
      if (go) {
        var tab = document.getElementById(go.getAttribute("data-goto"));
        var root = tab && tab.closest("[data-tabset]");
        if (root && root._api) root._api.selectTab(tab, { scroll: "always" });
      }
    }, true);

    window.addEventListener("hashchange", function () { var el = targetOf(location.hash); if (el) reveal(el); });
    var first = targetOf(location.hash);
    if (first) { reveal(first); requestAnimationFrame(function () { first.scrollIntoView(); }); }

    var queued = false;
    window.addEventListener("resize", function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; all.forEach(function (r) { r._place(); }); });
    });
    /* fonts change tab widths after first paint */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { all.forEach(function (r) { r._place(); }); });
  }

  function boot() {
    $$("[data-rail]").forEach(rail);
    $$("[data-ledger]").forEach(ledger);
    $$("[data-matrix]").forEach(matrix);
    wireTabsets();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
