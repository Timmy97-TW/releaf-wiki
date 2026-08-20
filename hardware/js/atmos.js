// Depth starfield and circuit traces.
//
// Two drawings on one fixed canvas behind everything: a three-layer point
// field that parallaxes with scroll, and a routed circuit path along the
// margins with pulses running it. Both are generated, not image assets, so
// they cost one canvas and no requests.
//
// Deterministic: a seeded PRNG, so the layout is identical on every load and
// between reloads. Nothing here animates unless the tab is visible.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cv = document.createElement("canvas");
  cv.className = "atmos-layer";
  cv.setAttribute("aria-hidden", "true");
  document.body.insertBefore(cv, document.body.firstChild);
  const ctx = cv.getContext("2d");

  // accent, read from the page so each instrument keeps its own colour
  const css = getComputedStyle(document.documentElement);
  const ACC = (css.getPropertyValue("--amber") || "#ffa23d").trim();
  function rgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  // mulberry32 — small, fast, and repeatable
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  let W = 0, H = 0, dpr = 1;
  let stars = [], traces = [];

  function build() {
    const r = rng(20260808);
    // three depth layers: far ones are dimmer, smaller and move least
    stars = [];
    const LAYERS = [
      { n: 90, s: 0.6, a: 0.30, p: 0.02 },
      { n: 55, s: 0.9, a: 0.48, p: 0.05 },
      { n: 26, s: 1.4, a: 0.72, p: 0.10 },
    ];
    LAYERS.forEach(function (L) {
      for (let i = 0; i < L.n; i++) {
        stars.push({ x: r(), y: r() * 2, s: L.s, a: L.a * (0.5 + r() * 0.5), p: L.p,
                     tw: r() * 6.283 });
      }
    });

    // circuit traces: start at a margin, run in right-angle steps, drop a via
    traces = [];
    for (let k = 0; k < 5; k++) {
      const leftSide = k % 2 === 0;
      let x = leftSide ? 0.045 + r() * 0.03 : 0.955 - r() * 0.03;
      let y = 0.08 + r() * 0.8;
      const pts = [{ x: x, y: y }];
      const steps = 3 + Math.floor(r() * 3);
      for (let i = 0; i < steps; i++) {
        // alternate: run along, then step down
        const dx = (leftSide ? 1 : -1) * (0.03 + r() * 0.07);
        x = Math.max(0.02, Math.min(0.98, x + dx));
        pts.push({ x: x, y: y });
        y = Math.min(1.9, y + 0.05 + r() * 0.12);
        pts.push({ x: x, y: y });
      }
      traces.push({ pts: pts, phase: r(), speed: 0.05 + r() * 0.05 });
    }
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    // A zero-height viewport (some embedded/headless contexts report one)
    // makes the wrap-around arithmetic below NaN, which throws out of the
    // gradient calls and kills the rAF loop for good. Nothing to draw anyway.
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    const sy = window.scrollY || 0;

    // --- circuit traces, drawn first so stars sit on top ---
    traces.forEach(function (tr) {
      const off = (sy * 0.06) % H;
      ctx.strokeStyle = rgba(ACC, 0.10);
      ctx.lineWidth = 1;
      ctx.beginPath();
      tr.pts.forEach(function (p, i) {
        const px = p.x * W, py = (p.y * H - off + H) % (H * 2) - H * 0.1;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
      // vias
      ctx.fillStyle = rgba(ACC, 0.16);
      tr.pts.forEach(function (p, i) {
        if (i % 2) return;
        const px = p.x * W, py = (p.y * H - off + H) % (H * 2) - H * 0.1;
        ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 6.283); ctx.fill();
      });
      if (reduced) return;
      // a pulse travelling the route
      const u = (t * tr.speed + tr.phase) % 1;
      const idx = Math.min(tr.pts.length - 2, Math.floor(u * (tr.pts.length - 1)));
      const f = u * (tr.pts.length - 1) - idx;
      const a = tr.pts[idx], b = tr.pts[idx + 1];
      const px = (a.x + (b.x - a.x) * f) * W;
      const py = ((a.y + (b.y - a.y) * f) * H - off + H) % (H * 2) - H * 0.1;
      const g = ctx.createRadialGradient(px, py, 0, px, py, 16);
      g.addColorStop(0, rgba(ACC, 0.5));
      g.addColorStop(1, rgba(ACC, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, 16, 0, 6.283); ctx.fill();
    });

    // --- starfield, parallaxed by depth ---
    stars.forEach(function (s) {
      const y = (s.y * H - sy * s.p) % (H * 2);
      const py = y < 0 ? y + H * 2 : y;
      if (py > H + 4) return;
      const tw = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 1.6 + s.tw);
      ctx.fillStyle = "rgba(226,236,248," + (s.a * tw).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(s.x * W, py, s.s, 0, 6.283);
      ctx.fill();
    });
  }

  let raf = 0, running = false, t0 = performance.now();
  function tick(now) {
    draw((now - t0) / 1000);
    if (running) raf = requestAnimationFrame(tick);
  }
  function start() { if (!running) { running = true; raf = requestAnimationFrame(tick); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

  size(); build(); draw(0);
  window.addEventListener("resize", function () { size(); build(); draw(0); }, { passive: true });
  window.addEventListener("scroll", function () { if (!running) draw(0); }, { passive: true });
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  if (!reduced) start();
})();
