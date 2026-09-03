// The rejection filter, as something you can push on.
//
// §2.2.1 explains why the burst is reduced with a median rather than a mean,
// and why the spread is a MAD rather than a standard deviation. Both are the
// same argument — one outlier cannot drag a median — and it is an argument that
// is much easier to believe when you can put the outlier there yourself.
//
// The numbers are the real ones: 14 readings a burst, cutoff at median ± 3·MAD.
(function () {
  const cv = document.getElementById("mad-canvas");
  if (!cv) return;
  const g = cv.getContext("2d");
  const N = 14;                       // readings per burst, as built

  const el = {
    spike: document.getElementById("mad-spike"),
    count: document.getElementById("mad-count"),
    k: document.getElementById("mad-k"),
    reroll: document.getElementById("mad-reroll"),
    mean: document.getElementById("mad-mean"),
    median: document.getElementById("mad-median"),
    mad: document.getElementById("mad-mad"),
    rej: document.getElementById("mad-rej"),
    note: document.getElementById("mad-note"),
  };

  const BASE = 26.7;                  // lux, about where the reference sat
  let clean = [];

  function reroll() {
    // Normal-ish noise, not uniform. Under a uniform spread the cutoff at
    // 3·MAD falls inside the range, so a burst with no bubbles in it still
    // rejects its own extremes — which reads as the filter not working. Summing
    // three uniforms approximates a normal, where 3·MAD sits at about 2σ and a
    // clean burst usually loses nothing.
    clean = [];
    for (let i = 0; i < N; i++) {
      const n = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      clean.push(BASE + n * 0.42);
    }
  }
  reroll();

  function median(a) {
    const b = a.slice().sort(function (x, y) { return x - y; });
    const m = b.length >> 1;
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }

  function compute() {
    const spike = +el.spike.value / 100;
    const nSpikes = +el.count.value;
    const k = +el.k.value;
    const vals = clean.slice();
    // bubbles land on specific readings, the way one drifting past would
    for (let i = 0; i < nSpikes; i++) vals[(i * 5 + 3) % N] += BASE * spike;

    const med = median(vals);
    const mean = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
    const mad = median(vals.map(function (v) { return Math.abs(v - med); }));
    const cut = Math.max(mad, 1e-6) * k;
    const keep = vals.map(function (v) { return Math.abs(v - med) <= cut; });
    return { vals: vals, med: med, mean: mean, mad: mad, cut: cut, keep: keep,
             rejected: keep.filter(function (x) { return !x; }).length };
  }

  function draw() {
    const r = compute();
    const W = cv.width, H = cv.height, pad = 26;
    const lo = Math.min.apply(null, r.vals.concat([r.med - r.cut]));
    const hi = Math.max.apply(null, r.vals.concat([r.med + r.cut]));
    const span = Math.max(1e-6, hi - lo);
    const y = function (v) { return H - pad - ((v - lo) / span) * (H - pad * 2); };
    const x = function (i) { return pad + (i / (N - 1)) * (W - pad * 2); };

    g.clearRect(0, 0, W, H);

    // the accept band
    g.fillStyle = "rgba(61, 220, 139, .10)";
    g.fillRect(pad, y(r.med + r.cut), W - pad * 2, Math.max(1, y(r.med - r.cut) - y(r.med + r.cut)));

    function rule(v, colour, dash, label) {
      g.save();
      g.strokeStyle = colour; g.lineWidth = 1.4; g.setLineDash(dash);
      g.beginPath(); g.moveTo(pad, y(v)); g.lineTo(W - pad, y(v)); g.stroke();
      g.restore();
      g.fillStyle = colour;
      g.font = "600 10px ui-monospace, Menlo, monospace";
      g.fillText(label, W - pad + 4 - 74, y(v) - 5);
    }
    rule(r.med, "#3ddc8b", [], "MEDIAN");
    rule(r.mean, "#ffa23d", [5, 4], "MEAN");

    r.vals.forEach(function (v, i) {
      const ok = r.keep[i];
      g.beginPath();
      g.arc(x(i), y(v), ok ? 4.5 : 5.5, 0, Math.PI * 2);
      g.fillStyle = ok ? "#dfe6ee" : "#ff5f4a";
      g.fill();
      if (!ok) {
        g.strokeStyle = "#ff5f4a"; g.lineWidth = 1.2;
        g.beginPath(); g.arc(x(i), y(v), 9, 0, Math.PI * 2); g.stroke();
      }
    });

    el.mean.textContent = r.mean.toFixed(2);
    el.median.textContent = r.med.toFixed(2);
    el.mad.textContent = r.mad.toFixed(3);
    el.rej.textContent = r.rejected + " / " + N;

    const drift = Math.abs(r.mean - r.med);
    el.note.textContent = r.rejected === 0
      ? "No bubbles to throw out — mean and median agree to " + drift.toFixed(2) + " lux."
      : "The mean has been pulled " + drift.toFixed(2) + " lux off the clean readings. The median moved with them, so the "
        + r.rejected + " bubble" + (r.rejected > 1 ? "s are" : " is") + " outside the band and get thrown out.";
  }

  ["spike", "count", "k"].forEach(function (key) {
    el[key].addEventListener("input", draw);
  });
  el.reroll.addEventListener("click", function () { reroll(); draw(); });
  draw();
})();
