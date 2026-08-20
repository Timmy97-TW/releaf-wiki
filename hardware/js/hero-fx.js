// Hub hero — a live constellation of the three instruments.
//
// Nodes drift, links breathe, and a faint pulse travels each link in the
// direction data actually flows: DiOPAL informs the bioreactor, the bioreactor
// is read by the photometer, the photometer feeds back to the bioreactor.
// One 2D canvas, no library, and it stops entirely when off-screen or when the
// reader prefers reduced motion.
(function () {
  const canvas = document.getElementById("hero-fx");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const C = {
    photometer: "255,162,61",
    diopal: "61,220,139",
    reactor: "90,169,255",
  };

  // positions are fractions of the canvas box, so it reflows with the hero
  // Positions keep the whole figure below the headline: the leader lines used
  // to run straight through the type, which read as scratches on it.
  // The hero's type occupies the centre column top to bottom, so the figure
  // lives in the outer margins. Centred positions put nodes on the headline
  // first and then on the stats row.
  const NODES = [
    { id: "reactor",    x: .09, y: .30, r: 5.5, c: C.reactor,    label: "Bioreactor" },
    { id: "photometer", x: .06, y: .72, r: 4.5, c: C.photometer, label: "Photometer" },
    { id: "diopal",     x: .93, y: .52, r: 4.5, c: C.diopal,     label: "DiOPAL" },
  ];
  // from -> to, i.e. the direction the pulse travels
  const LINKS = [
    { a: "diopal",     b: "reactor",    c: C.diopal },
    { a: "reactor",    b: "photometer", c: C.reactor },
    { a: "photometer", b: "reactor",    c: C.photometer },
  ];

  let W = 0, H = 0, dpr = 1, t0 = performance.now(), raf = 0, running = false;

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function pos(n, t) {
    // a slow lissajous drift, unique per node, small enough to read as float
    const seed = n.id.length * 1.7;
    return {
      x: n.x * W + Math.sin(t * .00021 + seed) * (W * .012),
      y: n.y * H + Math.cos(t * .00017 + seed * 1.3) * (H * .018),
    };
  }

  function frame(now) {
    const t = reduced ? 0 : now - t0;
    ctx.clearRect(0, 0, W, H);

    const P = {};
    NODES.forEach(function (n) { P[n.id] = pos(n, t); });

    // links
    LINKS.forEach(function (l, i) {
      const a = P[l.a], b = P[l.b];
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, "rgba(" + l.c + ",.10)");
      grad.addColorStop(1, "rgba(" + l.c + ",.015)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      if (reduced) return;
      // a pulse running a -> b
      const u = ((t * .00016) + i * .33) % 1;
      const px = a.x + (b.x - a.x) * u;
      const py = a.y + (b.y - a.y) * u;
      const fade = Math.sin(u * Math.PI);           // dim at both ends
      const g2 = ctx.createRadialGradient(px, py, 0, px, py, 26);
      g2.addColorStop(0, "rgba(" + l.c + "," + (.5 * fade).toFixed(3) + ")");
      g2.addColorStop(1, "rgba(" + l.c + ",0)");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI * 2);
      ctx.fill();
    });

    // nodes
    NODES.forEach(function (n) {
      const p = P[n.id];
      const breathe = reduced ? 1 : 1 + Math.sin(t * .0012 + n.r) * .12;
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, n.r * 9);
      halo.addColorStop(0, "rgba(" + n.c + ",.30)");
      halo.addColorStop(1, "rgba(" + n.c + ",0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, n.r * 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(" + n.c + ",.95)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, n.r * breathe, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(" + n.c + ",.34)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, n.r * 3.4 * breathe, 0, Math.PI * 2);
      ctx.stroke();
    });

    if (running && !reduced) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    t0 = performance.now() - 1;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  size();
  frame(performance.now());

  window.addEventListener("resize", function () { size(); frame(performance.now()); }, { passive: true });

  // never burn a frame on an off-screen canvas
  if ("IntersectionObserver" in window && !reduced) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.01 }).observe(canvas);
  } else if (!reduced) {
    start();
  }
  document.addEventListener("visibilitychange", function () {
    document.hidden ? stop() : start();
  });
})();
