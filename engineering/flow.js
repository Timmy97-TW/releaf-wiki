/* =============================================================================
   ENGINEERING · the wet lab / dry lab flow web
   -----------------------------------------------------------------------------
   Written 18 October 2026. Two jobs, and neither of them puts content on the
   page: the markup in engineering/index.html already carries every node name,
   every summary, every edge label and every measurement.

     1. draw the edge layer. The sixteen hand-offs are read off the list in
        the panel (each row carries data-from and data-to), so the list and
        the drawing cannot disagree. Geometry comes from the live node
        rectangles, so it survives any reflow: a resize, a font swapping in,
        the contents rail opening. Below 52rem the two columns stack and the
        edges would be meaningless, so the layer is marked stacked and the
        stylesheet hides it.

     2. run the selection. A node button toggles: the chosen area is tinted,
        the areas it is wired to are ringed, its own edges come forward, the
        rest fade back but stay legible, and the hand-off list is filtered to
        that area with each row marked Sends or Receives. A second press, or
        Escape, clears it.

   The toggle semantics (aria-pressed, aria-controls) are added here rather
   than written into the markup: with scripts off the buttons claim nothing
   they cannot do, and the record reads top to bottom anyway.

   Nothing is fetched. No timers run when the page is idle.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.getElementById("flow");
  if (!root) return;

  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };

  var web    = root.querySelector("[data-flow-web]");
  var svg    = root.querySelector("[data-flow-edges]");
  var layer  = svg && svg.querySelector("[data-flow-links]");
  var list   = document.getElementById("flow-handoffs");
  var status = root.querySelector("[data-flow-status]");

  var cells = $$(".flow__cell[data-node]");
  var btns  = $$("button.flow__node[data-node]");
  var rows  = $$(".flow__ho[data-from][data-to]");
  if (!web || !svg || !layer || !cells.length || !rows.length) return;

  /* from here the block can draw and can be selected, which is what the
     stylesheet's .is-live state means. Until it is set, and if this script
     never runs at all, the static fallback stands. */
  root.classList.add("is-live");

  var SVGNS = "http://www.w3.org/2000/svg";
  var GAP   = 4;      /* clear of the card edge, px */
  var BOW   = 34;     /* how far a same-column edge bows out, px */

  /* ---- index ----------------------------------------------------------- */

  var cellOf = {}, btnOf = {}, sideOf = {}, nameOf = {};
  cells.forEach(function (cell) {
    var id = cell.dataset.node;
    cellOf[id] = cell;
    sideOf[id] = cell.closest(".flow__side--dry") ? "dry" : "wet";
    var n = cell.querySelector(".flow__name");
    nameOf[id] = n ? n.textContent.trim() : id;
  });
  btns.forEach(function (b) { btnOf[b.dataset.node] = b; });

  /* every hand-off becomes one edge, in the order the list reads */
  var edges = [];
  rows.forEach(function (row) {
    var a = row.dataset.from, b = row.dataset.to;
    if (!cellOf[a] || !cellOf[b]) return;
    var g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "flow__link");
    g.setAttribute("data-side", sideOf[a]);
    var line = document.createElementNS(SVGNS, "path");
    line.setAttribute("class", "flow__line");
    var head = document.createElementNS(SVGNS, "path");
    head.setAttribute("class", "flow__head");
    g.appendChild(line);
    g.appendChild(head);
    layer.appendChild(g);
    edges.push({ from: a, to: b, row: row, g: g, line: line, head: head });
  });

  /* ---- 1. the edge layer ---------------------------------------------- */

  var r1 = function (n) { return Math.round(n * 10) / 10; };

  function draw() {
    var box = web.getBoundingClientRect();
    if (!box.width || !box.height) return;

    /* stacked? the two columns then start at the same x */
    var wet = root.querySelector(".flow__side--wet .flow__cell");
    var dry = root.querySelector(".flow__side--dry .flow__cell");
    var stacked = !wet || !dry ||
      Math.abs(wet.getBoundingClientRect().left - dry.getBoundingClientRect().left) < 8;
    root.classList.toggle("is-stacked", stacked);
    if (stacked) return;

    svg.setAttribute("viewBox", "0 0 " + r1(box.width) + " " + r1(box.height));

    var box_of = {};
    cells.forEach(function (cell) {
      var r = cell.getBoundingClientRect();
      box_of[cell.dataset.node] = {
        l: r.left - box.left, r: r.right - box.left,
        t: r.top - box.top,   b: r.bottom - box.top,
        cy: (r.top + r.bottom) / 2 - box.top
      };
    });

    /* Which face of a card each end of an edge leaves from. A hand-off that
       crosses the page leaves the inner face of its own column and lands on
       the inner face of the other; one that stays inside a column leaves and
       lands on that column's outer face and bows around. */
    var groups = {};
    edges.forEach(function (e) {
      var sa = sideOf[e.from], sb = sideOf[e.to];
      if (sa !== sb) {
        e.fa = (sa === "wet") ? "r" : "l";
        e.fb = (sb === "wet") ? "r" : "l";
        e.bow = false;
      } else {
        e.fa = e.fb = (sa === "wet") ? "l" : "r";
        e.bow = true;
      }
      (groups[e.from + "|" + e.fa] = groups[e.from + "|" + e.fa] || [])
        .push({ e: e, end: "a", other: e.to });
      (groups[e.to + "|" + e.fb] = groups[e.to + "|" + e.fb] || [])
        .push({ e: e, end: "b", other: e.from });
    });

    /* spread the anchors down the face, in the order of the far ends, so two
       edges off one card never land on each other */
    Object.keys(groups).forEach(function (key) {
      var parts = key.split("|"), rb = box_of[parts[0]], face = parts[1];
      var set = groups[key];
      set.sort(function (p, q) { return box_of[p.other].cy - box_of[q.other].cy; });
      set.forEach(function (p, i) {
        var out = (face === "r") ? 1 : -1;
        p.e[p.end + "x"] = (face === "r") ? rb.r : rb.l;
        p.e[p.end + "y"] = rb.t + (rb.b - rb.t) * (i + 1) / (set.length + 1);
        p.e[p.end + "o"] = out;
      });
    });

    edges.forEach(function (e) {
      var oa = e.ao, ob = e.bo;
      var x1 = e.ax + oa * GAP, y1 = e.ay;
      var x2 = e.bx + ob * GAP, y2 = e.by;
      var k  = e.bow ? BOW : Math.max(30, Math.abs(x2 - x1) * .42);
      e.line.setAttribute("d",
        "M" + r1(x1) + " " + r1(y1) +
        "C" + r1(x1 + oa * k) + " " + r1(y1) + "," +
              r1(x2 + ob * k) + " " + r1(y2) + "," +
              r1(x2) + " " + r1(y2));
      var d = -ob;    /* the head points into the card it lands on */
      e.head.setAttribute("d",
        "M" + r1(x2 - d * 7) + " " + r1(y2 - 4.5) +
        "L" + r1(x2) + " " + r1(y2) +
        "L" + r1(x2 - d * 7) + " " + r1(y2 + 4.5));
    });
  }

  var queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () { queued = false; draw(); });
  }

  /* ---- 2. selection ---------------------------------------------------- */

  var sel = null;

  function paint() {
    var touching = {};
    if (sel) {
      edges.forEach(function (e) {
        var on = (e.from === sel || e.to === sel);
        e.g.classList.toggle("is-on", on);
        if (on) { touching[e.from] = true; touching[e.to] = true; }
      });
    } else {
      edges.forEach(function (e) { e.g.classList.remove("is-on"); });
    }

    cells.forEach(function (cell) {
      var id = cell.dataset.node;
      cell.classList.toggle("is-sel", id === sel);
      cell.classList.toggle("is-on", !!sel && id !== sel && !!touching[id]);
    });
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.node === sel ? "true" : "false");
    });

    var sends = 0, recvs = 0;
    rows.forEach(function (row) {
      var chip = row.querySelector("[data-flow-dir]");
      var mine = !sel || row.dataset.from === sel || row.dataset.to === sel;
      row.hidden = !mine;
      row.classList.remove("is-send", "is-recv");
      if (chip) chip.textContent = "";
      if (!sel || !mine) return;
      if (row.dataset.from === sel) {
        sends += 1;
        row.classList.add("is-send");
        if (chip) chip.textContent = "Sends";
      } else {
        recvs += 1;
        row.classList.add("is-recv");
        if (chip) chip.textContent = "Receives";
      }
    });

    if (status) {
      status.textContent = sel
        ? nameOf[sel] + ": " + sends + " sent, " + recvs + " received"
        : "";
    }

    if (sel) root.setAttribute("data-sel", sel);
    else root.removeAttribute("data-sel");
  }

  function select(id) {
    sel = (id && id !== sel) ? id : null;
    paint();
  }

  btns.forEach(function (b) {
    b.setAttribute("aria-pressed", "false");
    if (list) b.setAttribute("aria-controls", "flow-handoffs");
    b.addEventListener("click", function () { select(b.dataset.node); });
  });

  root.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape" || !sel) return;
    var was = btnOf[sel];
    var here = document.activeElement;
    select(null);
    /* reading the panel when the selection goes: put the reader back on the
       control that held it. Already on a node: leave the focus alone. */
    if (was && here && root.contains(here) && !here.classList.contains("flow__node")) was.focus();
    ev.stopPropagation();
  });

  /* ---- start ----------------------------------------------------------- */

  paint();
  redraw();

  window.addEventListener("resize", redraw);
  window.addEventListener("load", redraw);
  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(redraw);
    ro.observe(web);
    cells.forEach(function (cell) { ro.observe(cell); });
  }
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(redraw);
  }
})();
