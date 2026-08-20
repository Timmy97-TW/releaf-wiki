// Interactive OD600 run chart.
//
// Draws the traced continuous record: a min/max envelope for the raw scatter,
// a median line through it, and the phases the culture moved through. Hovering
// (or dragging, on touch) scrubs the run and updates the readout.
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

  const W = 1000, H = 380;
  const M = { t: 26, r: 20, b: 46, l: 46 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;

  const x = (t) => M.l + (t / T_MAX) * iw;
  const y = (v) => M.t + (1 - v / OD_MAX) * ih;

  function path(sel) {
    return S.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(sel(p)).toFixed(1)).join("");
  }
  // envelope: up the highs, back along the lows
  const band =
    S.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[3]).toFixed(1)).join("") +
    S.slice().reverse().map((p) => "L" + x(p[0]).toFixed(1) + " " + y(p[2]).toFixed(1)).join("") + "Z";
  // The fill under the median line: start on the baseline, follow the line,
  // drop back to the baseline, close.
  //
  // `path()` starts with "M", and this shape has already moved. Dropping that
  // "M" is not enough — it leaves the first pair with no command in front of
  // it, so it runs straight into the baseline coordinate and the browser reads
  // "M46 334" + "46.0 327.3" as "M46 33446.0 327.3" and rejects the whole
  // attribute. The leading command has to be replaced, not removed. Everything
  // here is toFixed(1) for the same reason the rest of the file is: an
  // unrounded float can print in exponential form and break the parse.
  const area = "M" + x(0).toFixed(1) + " " + y(0).toFixed(1) +
               "L" + path((p) => p[1]).slice(1) +
               "L" + x(T_MAX).toFixed(1) + " " + y(0).toFixed(1) + "Z";

  const xTicks = [0, 50, 100, 150, 200, 250, 300];
  const yTicks = [0, 0.5, 1.0, 1.5];

  host.innerHTML =
    '<div class="od-head">' +
      '<div class="od-read">' +
        '<div><span>Elapsed</span><b id="od-t">336.0</b><em>h</em></div>' +
        '<div><span>OD600</span><b id="od-v" class="hi">1.385</b></div>' +
        '<div><span>Phase</span><b id="od-p" class="ph">Plateau</b></div>' +
      "</div>" +
      '<div class="od-hint">Hover to scrub the run</div>' +
    "</div>" +
    '<svg class="odc" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
      'aria-label="Continuous OD600 record over ' + Math.round(T_MAX) + ' hours">' +
      "<defs>" +
        '<linearGradient id="odFill" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="var(--amber)" stop-opacity=".28"/>' +
          '<stop offset="100%" stop-color="var(--amber)" stop-opacity="0"/>' +
        "</linearGradient>" +
      "</defs>" +
      PHASES.map((p, i) =>
        '<g class="od-phase p' + i + '">' +
        '<rect x="' + x(p.a) + '" y="' + M.t + '" width="' + (x(p.b) - x(p.a)) +
          '" height="' + ih + '"/>' +
        '<text x="' + ((x(p.a) + x(p.b)) / 2) + '" y="' + (M.t - 9) + '">' + p.name + "</text>" +
        "</g>").join("") +
      yTicks.map((v) =>
        '<g class="od-grid"><line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text x="' + (M.l - 10) + '" y="' + (y(v) + 4) + '">' + v.toFixed(1) + "</text></g>").join("") +
      xTicks.map((t) =>
        '<text class="od-xt" x="' + x(t) + '" y="' + (H - M.b + 22) + '">' + t + "</text>").join("") +
      '<text class="od-ax" x="' + (M.l + iw / 2) + '" y="' + (H - 6) + '">Elapsed time (hours)</text>' +
      '<path class="od-area" d="' + area + '"/>' +
      '<path class="od-band" d="' + band + '"/>' +
      '<path class="od-line" d="' + path((p) => p[1]) + '"/>' +
      '<g class="od-cursor" opacity="0">' +
        '<line y1="' + M.t + '" y2="' + (M.t + ih) + '"/>' +
        '<circle r="4.5"/>' +
      "</g>" +
      '<rect class="od-hit" x="' + M.l + '" y="' + M.t + '" width="' + iw + '" height="' + ih + '"/>' +
    "</svg>";

  const svg = host.querySelector("svg");
  const cur = host.querySelector(".od-cursor");
  const line = cur.querySelector("line");
  const dot = cur.querySelector("circle");
  const elT = host.querySelector("#od-t");
  const elV = host.querySelector("#od-v");
  const elP = host.querySelector("#od-p");

  function phaseAt(t) {
    for (const p of PHASES) if (t >= p.a && t <= p.b) return p;
    return PHASES[PHASES.length - 1];
  }

  function scrub(clientX) {
    const r = svg.getBoundingClientRect();
    // client space -> viewBox space, so it stays correct at any rendered size
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

  svg.addEventListener("pointermove", (e) => scrub(e.clientX));
  svg.addEventListener("pointerdown", (e) => scrub(e.clientX));
  svg.addEventListener("pointerleave", () => {
    cur.setAttribute("opacity", "0");
    const last = S[S.length - 1];
    elT.textContent = last[0].toFixed(1);
    elV.textContent = last[1].toFixed(3);
    elP.textContent = "Plateau";
  });
})();
