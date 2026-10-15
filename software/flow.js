/* Digital Twin decision flow: draws the wires between .flow__node boxes.
   Edges come from data-edges on the figure, "a>b". A leading "+" marks a link
   that is live on the bioreactor today, "~" one that is designed but not yet
   connected; no prefix means it runs on recorded data. Pointing at a node
   brings its own wires forward. Below 900px the columns stack and no wires
   are drawn. */
(function () {
  var fig = document.getElementById("flow");
  if (!fig) return;
  var svg = fig.querySelector(".flow__wires");
  var NS = "http://www.w3.org/2000/svg";
  var edges = (fig.getAttribute("data-edges") || "").trim().split(/\s+/).map(function (e) {
    var c = e.charAt(0);
    var kind = c === "+" ? "live" : c === "~" ? "off" : "on";
    var ab = e.replace(/^[+~]/, "").split(">");
    return { a: ab[0], b: ab[1], kind: kind };
  });
  function node(id) { return fig.querySelector('[data-node="' + id + '"]'); }
  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (window.innerWidth < 900) return;
    var box = fig.getBoundingClientRect();
    svg.setAttribute("width", box.width);
    svg.setAttribute("height", box.height);
    svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
    var defs = el("defs", {});
    ["live", "on", "off"].forEach(function (k) {
      var m = el("marker", { id: "flow-ah-" + k, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M1 1.5L9 5L1 8.5", "class": "flow__ah flow__ah--" + k }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    edges.forEach(function (e) {
      var A = node(e.a), B = node(e.b);
      if (!A || !B) return;
      var a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
      var x1, y1, x2, y2, d;
      if (Math.abs(a.left - b.left) < 4) {
        /* same column: from one box straight into its neighbour */
        var down = b.top > a.top;
        x1 = a.left + a.width / 2 - box.left; y1 = (down ? a.bottom : a.top) - box.top;
        x2 = x1; y2 = (down ? b.top - 2 : b.bottom + 2) - box.top;
        d = "M" + x1 + " " + y1 + " L" + x2 + " " + y2;
      } else {
        x1 = a.right - box.left; y1 = a.top + a.height / 2 - box.top;
        x2 = b.left - box.left - 3; y2 = b.top + b.height / 2 - box.top;
        var c = Math.max(24, (x2 - x1) * 0.5);
        d = "M" + x1 + " " + y1 + " C" + (x1 + c) + " " + y1 + " " + (x2 - c) + " " + y2 + " " + x2 + " " + y2;
      }
      svg.appendChild(el("path", { d: d, "class": "flow__wire flow__wire--" + e.kind, "marker-end": "url(#flow-ah-" + e.kind + ")", "data-a": e.a, "data-b": e.b }));
    });
    /* the return: from under the actions, along the floor, back into the bioreactor sensors */
    var cols = fig.querySelectorAll(".flow__body");
    var last = cols[cols.length - 1], I = node("in-br");
    if (last && I) {
      var v = last.getBoundingClientRect(), i = I.getBoundingClientRect();
      var grid = fig.querySelector(".flow__grid").getBoundingClientRect();
      var yb = grid.bottom - box.top - 16;
      var xv = v.left + v.width / 2 - box.left, xi = i.left - box.left - 16;
      var yi = i.top + i.height / 2 - box.top;
      var r = 12;
      var d2 = "M" + xv + " " + (v.bottom - box.top) + " L" + xv + " " + (yb - r) +
        " Q" + xv + " " + yb + " " + (xv - r) + " " + yb +
        " L" + (xi + r) + " " + yb + " Q" + xi + " " + yb + " " + xi + " " + (yb - r) +
        " L" + xi + " " + (yi + r) + " Q" + xi + " " + yi + " " + (xi + r) + " " + yi +
        " L" + (i.left - box.left - 3) + " " + yi;
      svg.appendChild(el("path", { d: d2, "class": "flow__wire flow__wire--off", "marker-end": "url(#flow-ah-off)", "data-a": "a-valve", "data-b": "in-br" }));
    }
  }
  /* focus: a node and everything wired to it */
  function focus(id) {
    if (!id) {
      fig.classList.remove("is-focus");
      fig.querySelectorAll(".is-on").forEach(function (n) { n.classList.remove("is-on"); });
      return;
    }
    fig.classList.add("is-focus");
    node(id).classList.add("is-on");
    svg.querySelectorAll(".flow__wire").forEach(function (w) {
      var a = w.getAttribute("data-a"), b = w.getAttribute("data-b");
      if (a === id || b === id) {
        w.classList.add("is-on");
        var other = node(a === id ? b : a);
        if (other) other.classList.add("is-on");
      }
    });
  }
  fig.querySelectorAll("[data-node]").forEach(function (n) {
    n.addEventListener("mouseenter", function () { focus(null); focus(n.getAttribute("data-node")); });
    n.addEventListener("mouseleave", function () { focus(null); });
  });
  var t;
  function soon() { clearTimeout(t); t = setTimeout(draw, 60); }
  window.addEventListener("resize", soon);
  if ("ResizeObserver" in window) new ResizeObserver(soon).observe(fig);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  draw();
})();
