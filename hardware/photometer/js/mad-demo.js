// The rejection filter, as something you can push on.
//
// Section 4.2 explains why the burst is reduced with a median rather than a
// mean, and why the spread is a MAD rather than a standard deviation. Both are
// the same argument — one outlier cannot drag a median — and it is an argument
// that is much easier to believe when you can put the outlier there yourself.
//
// The numbers are the real ones: 14 readings a burst, cutoff at median ± 3·MAD.
//
// This is the photometer page's own copy of ../../js/mad-demo.js (no other page
// loads the demo). Changes from it, 3 Oct 2026:
//   - the note counts bubbles and clean readings separately, and says that the
//     median stays with the clean readings (it used to say the median "moved
//     with them", and called every rejected reading a bubble);
//   - "Mean" is labelled at the left end of its line and "Median" at the right,
//     so the two labels no longer print over each other;
//   - the canvas is drawn at its displayed size, so its labels are real 11 px
//     on a phone rather than 10 px scaled down to about 4;
//   - it is drawn on white, in the record's colours, rather than as a black panel.
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

  const INK = {
    band: "rgba(79, 156, 111, .13)",   // the accept band, leaf
    med: "#23684a",                     // median, leaf-700
    mean: "#3f5468",                    // mean, slate, dashed
    ok: "#3a434d",                      // a kept reading
    rej: "#c1392a",                     // a rejected reading
    axis: "rgba(15, 19, 25, .14)",
  };

  const BASE = 26.7;                  // lux, about where the reference sat
  // The first burst is a fixed, typical one (its MAD is 0.094 lux), so the demo
  // opens on the case 4.2 describes: the bubble thrown out, every clean reading
  // kept. "New burst" draws fresh noise, where a clean reading can still go.
  const FIRST = [26.658, 26.597, 26.823, 26.674, 26.989, 26.603, 26.64,
                 26.75, 26.785, 26.72, 26.77, 26.784, 26.9, 26.869];
  let clean = FIRST.slice();

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
    const bubble = vals.map(function () { return false; });
    // bubbles land on specific readings, the way one drifting past would
    if (spike > 0) {
      for (let i = 0; i < nSpikes; i++) {
        const j = (i * 5 + 3) % N;
        vals[j] += BASE * spike; bubble[j] = true;
      }
    }

    const med = median(vals);
    const mean = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
    const mad = median(vals.map(function (v) { return Math.abs(v - med); }));
    const cut = Math.max(mad, 1e-6) * k;
    const keep = vals.map(function (v) { return Math.abs(v - med) <= cut; });
    let rejBubbles = 0, rejClean = 0, bubbles = 0;
    for (let i = 0; i < N; i++) {
      if (bubble[i]) { bubbles++; if (!keep[i]) rejBubbles++; }
      else if (!keep[i]) rejClean++;
    }
    return { vals: vals, med: med, mean: mean, mad: mad, cut: cut, keep: keep, k: k,
             cleanMed: median(clean), bubbles: bubbles, rejBubbles: rejBubbles, rejClean: rejClean,
             rejected: rejBubbles + rejClean };
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function kText(k) { return (k % 1 ? k.toFixed(1) : String(k)) + "·MAD"; }

  function noteFor(r) {
    const band = "median ± " + kText(r.k);
    if (r.bubbles === 0) {
      if (r.rejClean === 0) {
        return "No bubbles in this burst: the mean and the median agree to " +
          Math.abs(r.mean - r.med).toFixed(2) + " lux, and every reading is kept.";
      }
      return "No bubbles in this burst, yet " + plural(r.rejClean, "clean reading falls", "clean readings fall") +
        " outside " + band + " and " + (r.rejClean === 1 ? "is" : "are") +
        " thrown out: on fourteen readings the MAD is itself a noisy estimate.";
    }
    const pulled = Math.abs(r.mean - r.cleanMed), moved = Math.abs(r.med - r.cleanMed);
    let s = "The mean has been pulled " + pulled.toFixed(2) + " lux off the clean readings; the median stayed with them" +
      (moved >= 0.005 ? ", within " + moved.toFixed(2) + " lux. " : ". ");
    const kept = r.bubbles - r.rejBubbles;
    if (r.rejBubbles === 0) {
      s += (r.bubbles === 1 ? "The bubble is" : "The bubbles are") + " small enough to stay inside " + band +
        ", so " + (r.bubbles === 1 ? "it is" : "they are") + " kept";
    } else if (kept === 0) {
      s += (r.bubbles === 1 ? "The bubble falls" : "All " + r.bubbles + " bubbles fall") + " outside " + band +
        " and " + (r.bubbles === 1 ? "is" : "are") + " thrown out";
    } else {
      s += plural(r.rejBubbles, "bubble falls", "bubbles fall") + " outside " + band + " and " +
        (r.rejBubbles === 1 ? "is" : "are") + " thrown out; " + plural(kept, "stays", "stay") + " inside it";
    }
    if (r.rejClean > 0) {
      s += ", and " + plural(r.rejClean, "clean reading goes", "clean readings go") +
        " with " + (r.rejBubbles === 1 ? "it" : "them") + ": on fourteen readings the MAD is itself a noisy estimate";
    }
    return s + ".";
  }

  function draw() {
    const r = compute();
    // Draw at the size the canvas is shown, so 11 px is 11 px on any screen.
    const cssW = Math.max(240, Math.round(cv.clientWidth || 720));
    const cssH = Math.round(cssW < 520 ? Math.max(150, cssW * 0.46) : cssW * 0.3);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) {
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW, H = cssH, padX = 18, padT = 26, padB = 16;

    const lo = Math.min.apply(null, r.vals.concat([r.med - r.cut]));
    const hi = Math.max.apply(null, r.vals.concat([r.med + r.cut]));
    const span = Math.max(1e-6, hi - lo);
    const y = function (v) { return H - padB - ((v - lo) / span) * (H - padT - padB); };
    const x = function (i) { return padX + 8 + (i / (N - 1)) * (W - padX * 2 - 16); };

    g.clearRect(0, 0, W, H);

    // the accept band
    g.fillStyle = INK.band;
    g.fillRect(padX, y(r.med + r.cut), W - padX * 2,
      Math.max(1, y(r.med - r.cut) - y(r.med + r.cut)));

    // a rule with its name at one end: the mean on the left, the median on the
    // right, so the two never print over each other when the lines are close
    function rule(v, colour, dash, label, atRight) {
      g.save();
      g.strokeStyle = colour; g.lineWidth = 1.6; g.setLineDash(dash);
      g.beginPath(); g.moveTo(padX, y(v)); g.lineTo(W - padX, y(v)); g.stroke();
      g.restore();
      g.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
      g.textBaseline = "alphabetic";
      const tw = g.measureText(label).width;
      const lx = atRight ? W - padX - tw - 2 : padX + 2;
      const ly = Math.max(12, y(v) - 6);
      // a white backing, so a label stays legible over a dot or the other line
      g.fillStyle = "rgba(255, 255, 255, .9)";
      g.fillRect(lx - 3, ly - 11, tw + 6, 14);
      g.fillStyle = colour;
      g.fillText(label, lx, ly);
    }
    rule(r.mean, INK.mean, [6, 4], "Mean", false);
    rule(r.med, INK.med, [], "Median", true);

    r.vals.forEach(function (v, i) {
      const ok = r.keep[i];
      g.beginPath();
      g.arc(x(i), y(v), ok ? 4 : 5, 0, Math.PI * 2);
      g.fillStyle = ok ? INK.ok : INK.rej;
      g.fill();
      if (!ok) {
        g.strokeStyle = INK.rej; g.lineWidth = 1.3;
        g.beginPath(); g.arc(x(i), y(v), 8.5, 0, Math.PI * 2); g.stroke();
      }
    });

    el.mean.textContent = r.mean.toFixed(2);
    el.median.textContent = r.med.toFixed(2);
    el.mad.textContent = r.mad.toFixed(3);
    el.rej.textContent = r.rejected + " / " + N;
    el.note.textContent = noteFor(r);
  }

  ["spike", "count", "k"].forEach(function (key) {
    el[key].addEventListener("input", draw);
  });
  el.reroll.addEventListener("click", function () { reroll(); draw(); });
  draw();

  // redraw when the canvas changes width (a phone turned, the rail appearing)
  let lastW = cv.clientWidth, t = 0;
  function onResize() {
    if (t) return;
    t = setTimeout(function () {
      t = 0;
      const w = cv.clientWidth;
      if (w && Math.abs(w - lastW) > 1) { lastW = w; draw(); }
    }, 120);
  }
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(cv.parentElement);
  else window.addEventListener("resize", onResize);
})();
