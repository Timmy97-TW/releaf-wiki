/* =============================================================================
   Parts: the table, and the folds under it.

   TWO JOBS.

   1. THE TABLE. One table of thirty-two rows in five module groups, and three
      ways of cutting it down: a search field, a row of chips, and six sortable
      columns. All of it is progressive. The HTML ships every row written out,
      in module order, with the function sentence in a row of its own marked
      hidden; without this script a reader still gets the whole collection as
      a plain table, which is what a printout and a text browser get too.

      Sorting hides the five module group headers, because a header that says
      "Module 01, 3 parts" over a column sorted by evidence is a lie. The
      Module column exists for exactly that moment. Clicking the sorted
      column a third time drops back to module order and brings the headers
      back.

   2. THE FOLDS. A link to a heading inside a closed <details>, from the
      contents rail, from a citation or from a URL somebody shared, would
      otherwise scroll to something the reader cannot see. This opens every
      fold above the target first and then lets the browser do the scrolling.
      page.js does the same for tab panels; this is the <details> half of it.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ the table -- */

  var table = document.querySelector("[data-ptable]");
  var tools = document.querySelector("[data-ptools]");

  if (table && tools) {
    var rows   = [].slice.call(table.querySelectorAll(".ptable__row"));
    var groups = [].slice.call(table.querySelectorAll(".ptable__grp"));
    var count  = document.querySelector("[data-pcount]");
    var none   = document.querySelector("[data-pnone]");
    var q      = tools.querySelector("[data-pq]");
    var chips  = [].slice.call(tools.querySelectorAll(".pchip"));
    var total  = rows.length;

    var filter = "all";
    var term   = "";
    var sortBy = null;
    var sortDir = 1;

    function fnRow(row) {
      return table.querySelector('.ptable__fn[data-for="' + row.getAttribute("data-r") + '"]');
    }

    /* A row matches when it clears the chip and the search box both. The chip
       is one of three kinds, so the test is read off the chip's own value
       rather than kept in three separate flags. */
    function matches(row) {
      if (filter !== "all") {
        var bit = filter.split(":");
        if (row.getAttribute("data-" + (bit[0] === "mod" ? "mod" : bit[0])) !== bit[1]) return false;
      }
      if (term && row.getAttribute("data-q").indexOf(term) === -1) return false;
      return true;
    }

    function apply() {
      var shown = 0;

      rows.forEach(function (row) {
        var ok = matches(row);
        row.hidden = !ok;
        var fn = fnRow(row);
        /* a filtered-out row takes its function row with it; whether that row
           is open is carried by .is-open and survives the round trip */
        if (fn) fn.hidden = !ok;
        if (ok) shown++;
      });

      /* a group with nothing left in it goes, header and all */
      groups.forEach(function (g) {
        var live = [].slice.call(g.querySelectorAll(".ptable__row")).some(function (r) { return !r.hidden; });
        g.hidden = !live;
      });

      if (none) none.hidden = shown !== 0;
      if (count) {
        count.textContent = shown === total
          ? total + " parts"
          : shown + " of " + total + " parts";
      }
    }

    /* -- the chips -- */
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var want = chip.getAttribute("data-f");
        filter = (filter === want) ? "all" : want;   /* pressing the live chip clears it */
        chips.forEach(function (c) {
          var on = c.getAttribute("data-f") === filter;
          c.classList.toggle("is-on", on);
          c.setAttribute("aria-pressed", on ? "true" : "false");
        });
        apply();
      });
    });

    /* -- the search field -- */
    if (q) {
      q.addEventListener("input", function () {
        term = q.value.trim().toLowerCase();
        apply();
      });
      /* Escape clears it, which is what the field's own clear button does */
      q.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && q.value) { q.value = ""; term = ""; apply(); }
      });
    }

    /* -- one row's function sentence -- */
    function toggle(row, want) {
      var fn = fnRow(row);
      if (!fn) return;
      var btn = row.querySelector(".pfx");
      var open = (want === undefined) ? row.getAttribute("data-open") !== "1" : want;
      row.setAttribute("data-open", open ? "1" : "0");
      row.classList.toggle("is-open", open);
      fn.classList.toggle("is-open", open);
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    /* The whole row is the target, because a 28px chevron is a small thing to
       hit; a click that lands on the Registry link is left alone so the link
       still works. The chevron is a real <button>, so Enter and Space already
       reach this same handler as a click and there is no keydown handler to
       write: one here would have to cancel the native activation to avoid
       toggling the row twice. */
    table.addEventListener("click", function (e) {
      var row = e.target.closest && e.target.closest(".ptable__row");
      if (!row) return;
      if (e.target.closest("a")) return;
      toggle(row);
    });
    /* -- sorting -- */
    var heads = [].slice.call(table.querySelectorAll("thead th[data-sort]"));
    var ORDER = { seq: 0, designed: 1 };   /* evidence sorts strongest first */

    function keyOf(row, by) {
      if (by === "st")   return String(ORDER[row.getAttribute("data-st")] != null
                                        ? ORDER[row.getAttribute("data-st")] : 9);
      if (by === "type") return row.getAttribute("data-type");
      if (by === "mod")  return row.getAttribute("data-mod");
      if (by === "cat")  return row.getAttribute("data-cat");
      if (by === "reg")  return row.getAttribute("data-reg");
      return row.getAttribute("data-name");
    }

    /* One sorted body replaces the five grouped ones, and module order puts
       the five back exactly as the HTML shipped them. */
    var flat = document.createElement("tbody");
    flat.className = "ptable__grp ptable__grp--flat";
    flat.hidden = true;
    table.appendChild(flat);

    function sort(by) {
      if (sortBy === by) { sortDir = -sortDir; }
      else { sortBy = by; sortDir = 1; }
      heads.forEach(function (h) {
        if (h.getAttribute("data-sort") === sortBy) {
          h.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
        } else { h.removeAttribute("aria-sort"); }
      });

      var ordered = rows.slice().sort(function (a, b) {
        var ka = keyOf(a, sortBy), kb = keyOf(b, sortBy);
        if (ka === kb) return rows.indexOf(a) - rows.indexOf(b);   /* stable: module order breaks ties */
        return ka > kb ? sortDir : -sortDir;
      });

      ordered.forEach(function (row) {
        flat.appendChild(row);
        var fn = fnRow(row);
        if (fn) flat.appendChild(fn);
      });
      groups.forEach(function (g) { if (g !== flat) g.hidden = true; });
      flat.hidden = false;
      apply();
    }

    function unsort() {
      sortBy = null; sortDir = 1;
      heads.forEach(function (h) { h.removeAttribute("aria-sort"); });
      /* every row carries the module it came from, so putting them back is a
         matter of appending in the original order */
      rows.forEach(function (row) {
        var home = document.querySelector('.ptable__grp[data-grp="' + row.getAttribute("data-mod") + '"]');
        if (!home) return;
        home.appendChild(row);
        var fn = fnRow(row);
        if (fn) home.appendChild(fn);
      });
      flat.hidden = true;
      apply();
    }

    heads.forEach(function (h) {
      var by = h.getAttribute("data-sort");
      var btn = h.querySelector("button");
      if (!btn) return;
      btn.addEventListener("click", function () {
        /* ascending, descending, then off */
        var now = h.getAttribute("aria-sort");
        if (now === "descending") { unsort(); return; }
        sort(by);
      });
    });

    /* -- where the header row parks -- */
    /* The toolbar is sticky and its height changes as the chips wrap, so the
       offset the table header sticks at cannot be a constant in the sheet.
       It is measured here and written as a custom property; the sheet keeps a
       calc() fallback for the no-script case, where nothing is sticky anyway. */
    function park() {
      var top = parseFloat(getComputedStyle(tools).top) || 0;
      table.style.setProperty("--pthead", (top + tools.offsetHeight) + "px");
    }
    park();
    if (window.ResizeObserver) new ResizeObserver(park).observe(tools);
    else window.addEventListener("resize", park);

    apply();
  }

  /* ------------------------------------------------------------ the folds -- */

  function open(hash) {
    if (!hash || hash.length < 2) return null;
    var el;
    try { el = document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch (e) { return null; }
    if (!el) return null;

    if (el.tagName === "DETAILS") el.open = true;
    var d = el.parentElement && el.parentElement.closest("details");
    while (d) {
      d.open = true;
      d = d.parentElement && d.parentElement.closest("details");
    }
    return el;
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) open(a.getAttribute("href"));
  });

  window.addEventListener("hashchange", function () { open(location.hash); });

  /* On first load the fold has to be opened before the browser's own jump is
     any use, so the jump is redone once the layout has settled. */
  var target = open(location.hash);
  if (target) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { target.scrollIntoView(); });
    });
  }
})();
