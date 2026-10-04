// Interactive OD600 run chart.
//
// Draws the traced continuous record: a min/max envelope for the raw scatter,
// a median line through it, and the phases the culture moved through. Hovering
// (or dragging, on touch) scrubs the run and updates the readout.
//
// The chart is drawn at the plot's own pixel width and redrawn when that width
// changes, so its type is set in real pixels. It used to be drawn into a fixed
// 1000-unit box and scaled to fit, which put its labels at 6.5-8 px on a
// desktop and about 3 px on a phone.
(function () {
  const host = document.getElementById("od-chart");
  if (!host || typeof OD_RUN === "undefined") return;

  const S = OD_RUN.series;                 // [t, median, lo, hi]
  const T_MAX = S[S.length - 1][0];
  const OD_MAX = 1.8;

  // Phases read off the record itself, not assumed from a textbook curve.
  const PHASES = [
    { a: 0,   b: 6,     name: "Lag",       note: "no measurable growth" },
    { a: 6,   b: 115,   name: "Growth",    note: "steady rise to OD 0.95" },
    { a: 115, b: 155,   name: "Dip",       note: "falls to 0.68" },
    { a: 155, b: 210,   name: "Recovery",  note: "climbs past the earlier peak" },
    { a: 210, b: T_MAX, name: "Plateau",   note: "holds near 1.5" },
  ];

  // Events, marked where the data actually shows them rather than where the
  // story would like them. Hour 282 carries a scatter of 1.28 OD against 0.60
  // for the next worst hour in the run, and the largest one-hour fall in the
  // median — it is the disturbance, unambiguously. Week 22 records what caused
  // it: the recirculation pump had failed, confirmed on inspection.
  const EVENTS = [
    { a: 280, b: 283, name: "Pump failure" },
  ];

  host.innerHTML =
    '<div class="od-head">' +
      '<div class="od-read">' +
        // the resting readout is the record's last point, read from the data
        '<div><span>Elapsed</span><b id="od-t">' + T_MAX.toFixed(1) + '</b><em>h</em></div>' +
        '<div><span>OD600</span><b id="od-v" class="hi">' + S[S.length - 1][1].toFixed(3) + '</b></div>' +
        '<div><span>Phase</span><b id="od-p" class="ph">' + PHASES[PHASES.length - 1].name + '</b></div>' +
      "</div>" +
      '<div class="od-hint">Hover to scrub the run</div>' +
    "</div>" +
    '<div class="od-plot"></div>';

  const plot = host.querySelector(".od-plot");
  const elT = host.querySelector("#od-t");
  const elV = host.querySelector("#od-v");
  const elP = host.querySelector("#od-p");

  // geometry of the current drawing; rebuilt with it
  let W = 0, H = 0, M = null, iw = 0, ih = 0;
  let svg = null, cur = null, line = null, dot = null;
  const x = (t) => M.l + (t / T_MAX) * iw;
  const y = (v) => M.t + (1 - v / OD_MAX) * ih;
  const f = (n) => n.toFixed(1);

  function build(width) {
    const avail = width || plot.clientWidth || 760;
    W = Math.round(Math.max(300, Math.min(1000, avail)));
    const narrow = W < 500;
    H = narrow ? 260 : Math.round(Math.max(260, W * 0.4));
    M = { t: narrow ? 14 : 30, r: 12, b: 42, l: 38 };
    iw = W - M.l - M.r; ih = H - M.t - M.b;

    const path = (sel) =>
      S.map((p, i) => (i ? "L" : "M") + f(x(p[0])) + " " + f(y(sel(p)))).join("");
    // envelope: up the highs, back along the lows
    const band =
      S.map((p, i) => (i ? "L" : "M") + f(x(p[0])) + " " + f(y(p[3]))).join("") +
      S.slice().reverse().map((p) => "L" + f(x(p[0])) + " " + f(y(p[2]))).join("") + "Z";
    // Start on the baseline, then draw to the first sample. slice(1) drops the
    // leading "M" from path(), so the "L" has to be put back — without it y(0)
    // ran straight into the next x and the fill was an invalid path.
    const area = "M" + f(x(0)) + " " + f(y(0)) + "L" + path((p) => p[1]).slice(1) +
                 "L" + f(x(T_MAX)) + " " + f(y(0)) + "Z";

    // a phone gets a tick every 100 h, and no phase names: the readout above
    // names the phase under the cursor, and five names do not fit in 260 px
    const xTicks = narrow ? [0, 100, 200, 300] : [0, 50, 100, 150, 200, 250, 300];
    const yTicks = [0, 0.5, 1.0, 1.5];

    plot.innerHTML =
      '<svg class="odc" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
        'aria-label="Continuous OD600 record over ' + Math.round(T_MAX) + ' hours">' +
        "<defs>" +
          '<linearGradient id="odFill" x1="0" y1="0" x2="0" y2="1">' +
            // a page may set --od-fill; otherwise the chart keeps its instrument colour
            '<stop offset="0%" style="stop-color: var(--od-fill, var(--amber))" stop-opacity=".28"/>' +
            '<stop offset="100%" style="stop-color: var(--od-fill, var(--amber))" stop-opacity="0"/>' +
          "</linearGradient>" +
        "</defs>" +
        PHASES.map((p, i) =>
          '<g class="od-phase p' + i + '">' +
          '<rect x="' + f(x(p.a)) + '" y="' + M.t + '" width="' + f(x(p.b) - x(p.a)) +
            '" height="' + ih + '"/>' +
          (narrow ? "" :
            '<text x="' + f((x(p.a) + x(p.b)) / 2) + '" y="' + (M.t - 10) + '">' + p.name + "</text>") +
          "</g>").join("") +
        yTicks.map((v) =>
          '<g class="od-grid"><line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + f(y(v)) + '" y2="' + f(y(v)) + '"/>' +
          '<text x="' + (M.l - 8) + '" y="' + f(y(v) + 4) + '">' + v.toFixed(1) + "</text></g>").join("") +
        xTicks.map((t) =>
          '<text class="od-xt" x="' + f(x(t)) + '" y="' + (H - M.b + 18) + '">' + t + "</text>").join("") +
        '<text class="od-ax" x="' + f(M.l + iw / 2) + '" y="' + (H - 6) + '">Elapsed time (hours)</text>' +
        '<path class="od-area" d="' + area + '"/>' +
        '<path class="od-band" d="' + band + '"/>' +
        '<path class="od-line" d="' + path((p) => p[1]) + '"/>' +
        EVENTS.map((e, i) => {
          const ex = x(e.a);
          // the label sits right of the marker unless that runs off the plot
          const flip = ex + 7 + 96 > W - M.r;
          return '<g class="od-event">' +
            '<rect x="' + f(ex) + '" y="' + M.t + '" width="' + f(Math.max(2, x(e.b) - ex)) +
              '" height="' + ih + '"/>' +
            '<line x1="' + f(ex) + '" x2="' + f(ex) + '" y1="' + M.t + '" y2="' + (M.t + ih) + '"/>' +
            '<text x="' + f(flip ? ex - 7 : ex + 7) + '" y="' + (M.t + 16 + i * 15) + '"' +
              (flip ? ' text-anchor="end"' : "") + ">" + e.name + "</text>" +
            "</g>";
        }).join("") +
        '<g class="od-cursor" opacity="0">' +
          '<line y1="' + M.t + '" y2="' + (M.t + ih) + '"/>' +
          '<circle r="4.5"/>' +
        "</g>" +
        '<rect class="od-hit" x="' + M.l + '" y="' + M.t + '" width="' + iw + '" height="' + ih + '"/>' +
      "</svg>";

    plot.classList.toggle("narrow", narrow);
    svg = plot.querySelector("svg");
    cur = svg.querySelector(".od-cursor");
    line = cur.querySelector("line");
    dot = cur.querySelector("circle");

    // An event label that would run past the plot's right edge at the page's
    // own type size reads leftward from its marker instead.
    svg.querySelectorAll(".od-event text").forEach(function (t) {
      try {
        const b = t.getBBox();
        if (b.width && b.x + b.width > W - M.r && !t.hasAttribute("text-anchor")) {
          t.setAttribute("text-anchor", "end");
          t.setAttribute("x", f(+t.getAttribute("x") - 14));
        }
      } catch (e) { /* not rendered yet: keep the default side */ }
    });
  }

  // Draw, then check the width the page actually gave the drawing. A page may
  // set its own width on the chart (the bioreactor page keeps it 720 px wide in
  // a sideways scroller on phones); redraw once at that width so its type is
  // still drawn at its own size rather than scaled.
  function draw() {
    build();
    const shown = Math.round(svg.getBoundingClientRect().width);
    if (shown && Math.abs(shown - W) > 1 && shown >= 300 && shown <= 1000) build(shown);
  }

  function phaseAt(t) {
    for (const p of PHASES) if (t >= p.a && t <= p.b) return p;
    return PHASES[PHASES.length - 1];
  }

  function scrub(clientX) {
    const r = svg.getBoundingClientRect();
    // client space -> drawing space, so it stays right if the box is scaled
    const vx = ((clientX - r.left) / r.width) * W;
    const t = Math.max(0, Math.min(T_MAX, ((vx - M.l) / iw) * T_MAX));
    const p = S[Math.round((t / T_MAX) * (S.length - 1))];
    if (!p) return;
    line.setAttribute("x1", x(p[0])); line.setAttribute("x2", x(p[0]));
    dot.setAttribute("cx", x(p[0])); dot.setAttribute("cy", y(p[1]));
    cur.setAttribute("opacity", "1");
    elT.textContent = p[0].toFixed(1);
    elV.textContent = p[1].toFixed(3);
    const ph = phaseAt(p[0]);
    elP.textContent = ph.name;
    elP.title = ph.note;
  }

  function rest() {
    cur.setAttribute("opacity", "0");
    const last = S[S.length - 1];
    elT.textContent = last[0].toFixed(1);
    elV.textContent = last[1].toFixed(3);
    elP.textContent = PHASES[PHASES.length - 1].name;
  }

  draw();

  // the listeners sit on the plot, which outlives each redraw of the svg
  plot.addEventListener("pointermove", (e) => { if (svg) scrub(e.clientX); });
  plot.addEventListener("pointerdown", (e) => { if (svg) scrub(e.clientX); });
  plot.addEventListener("pointerleave", () => { if (svg) rest(); });

  // Redraw only when the plot's width actually changes (a phone turned
  // sideways, the contents rail appearing), and not more than once a frame.
  let lastW = plot.clientWidth, pending = 0;
  function onResize() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = 0;
      const w = plot.clientWidth;
      if (w && Math.abs(w - lastW) > 1) { lastW = w; draw(); rest(); }
    }, 120);
  }
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(plot);
  else window.addEventListener("resize", onResize);
})();
