/* ===========================================================================
   6.1 · What gets through the membrane wall (15 Oct 2026; proposal 2,
   "Containment you can watch"). Markup: figure#fig-pore in index.html.
   ---------------------------------------------------------------------------
   A to-scale window onto the hollow-fiber wall. Rod-shaped B. subtilis drift
   in the lumen's crossflow and come to rest against the wall; ACC deaminase
   slips through the pores to the shell side. A pore-size slider shows what a
   coarser membrane would let through.

   On record, and drawn to one shared scale with the 1 µm bar:
     - the pore: 0.2 µm, PES hollow fiber (6.1 and 3.4 of this page);
     - the cells: 0.25–1.0 µm in diameter, the reported range (6.1).
     Every cell in the window has a width from that range, from the thinnest
     (0.25) to the widest (1.0); a cell crosses only if its width is smaller
     than the pore, end first.
   ACC deaminase runs at ~42 kDa on the team's western blot (4.3). A globular
   protein of that mass is a few nanometers across (from its mass, not a
   measurement); here it is drawn as a dot several times too large to see.
   Illustrative, as the card's note says: all motion and rates, the rod
   lengths, the pore spacing and the wall's thickness (a real fiber wall is far
   thicker than this window).

   Uses window.XP (../js/xp-kit.js): XP.loop pauses off screen and in hidden tabs;
   with reduced motion the scene starts still (30 s of flow, simulated) and the
   slider still works. The figure gets .is-live once this runs; without script
   the old still drawing shows instead (css/xp-pore.css).
   =========================================================================== */
(function () {
  "use strict";
  var XP = window.XP;
  var fig = document.getElementById("fig-pore");
  if (!XP || !fig) return;
  var stage = fig.querySelector(".xp-stage");
  var cv = fig.querySelector(".xpp-canvas");
  var range = fig.querySelector(".xpp-size input");
  if (!stage || !cv || !cv.getContext || !range) return;
  var out = fig.querySelector(".xpp-size output");
  var refBtn = fig.querySelector(".xpp-ref");
  var playBtn = fig.querySelector(".xpp-play");
  var status = fig.querySelector(".xpp-status");
  var cellsChip = fig.querySelector(".xpp-count.cells");
  var cellsN = fig.querySelector(".xpp-count.cells b");
  var protN = fig.querySelector(".xpp-count.prot b");
  var when = fig.querySelector(".xpp-when");

  /* ---- record values (this page) ---- */
  var PORE = 0.2;                 // µm, the membrane's rating (6.1, 3.4)
  var CELL_MIN = 0.25, CELL_MAX = 1.0;   // µm, the reported cell diameter range (6.1)

  /* ---- colours: the record's two sides (../css/explore.css) ---- */
  var C = {
    lumenBg: "#f3f7fc", shellBg: "#f1f8f4",
    lumen: "#1d5a9e", lumenInk: "#1d5a9e", shellInk: "#23684a",
    cellFill: "#dde9f7", cellHi: "rgba(255,255,255,.75)",
    gone: "#b3261e", goneFill: "#fbe9e8",
    prot: "#2f8f5b",
    wall: "#d9dfe5", wallEdge: "#a3aeb9",
    ink: "#1f2933", ink2: "#556070", halo: "rgba(255,255,255,.88)"
  };
  var FONT = (getComputedStyle(fig).getPropertyValue("--sans") || "").trim() || "-apple-system, system-ui, sans-serif";

  /* the slider is logarithmic: 0..200 maps 0.05..2 µm, and 0.2 µm sits at 75.2 */
  var DMIN = 0.05, DMAX = 2;
  function dOf(v) { return DMIN * Math.pow(DMAX / DMIN, v / 200); }
  function vOf(d) { return 200 * Math.log(d / DMIN) / Math.log(DMAX / DMIN); }
  function snap(d) { return Math.abs(vOf(d) - vOf(PORE)) < 1.2 ? PORE : d; }
  function fmtD(d) { return d < 0.1 ? d.toFixed(3) : d < 1 ? d.toFixed(2) : d.toFixed(1); }

  /* ---- seeded randomness, so the still frame is the same on every load ---- */
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var R = rng(20261015);
  function gauss() { var u = 1 - R(), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ---- the scene, in micrometers (x right, y down from the top of the window) ---- */
  var S = { d: PORE, cells: [], prots: [], nCell: 0, nProt: 0 };
  var ctx = null, W = 0, H = 0;

  function geometry() {
    W = Math.max(280, Math.round(stage.clientWidth));
    var phone = W < 560;
    H = phone ? 292 : Math.round(XP.clamp(W * 0.42, 296, 330));
    S.s = XP.clamp(W / 9.5, 58, 82);                // px per µm
    S.wallY = Math.round(H * (phone ? 0.6 : 0.62)); // px: top of the wall
    S.wallH = phone ? 20 : 24;                      // px: the wall is drawn thin (not to scale)
    S.wu = W / S.s; S.hu = H / S.s;
    S.top = S.wallY / S.s; S.bot = (S.wallY + S.wallH) / S.s;
    S.rp = phone ? 1.8 : 2;                         // px: the protein's drawn radius, about ten times its scale
    S.maxP = phone ? 30 : 46;
    ctx = XP.dpr(cv, W, H);
  }

  function layPores() {
    S.pitch = S.d + Math.max(0.8, 0.6 * S.d);       // illustrative spacing: wider pores sit farther apart
    var c0 = S.wu * 0.42;                           // the labelled pore
    S.pores = [];
    for (var x = c0 - Math.ceil(c0 / S.pitch) * S.pitch; x < S.wu + S.pitch; x += S.pitch) S.pores.push(x);
    S.label = c0;
  }
  function poreNear(x) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < S.pores.length; i++) { var dd = Math.abs(x - S.pores[i]); if (dd < bd) { bd = dd; best = i; } }
    return S.pores[best];
  }

  function makeCell(w, x, y) {
    return { w: w, L: XP.clamp(w * (2 + R() * 0.8), 0.6, 2.3), x: x, y: y,
             th: (R() - 0.5) * 0.5, om: 0, vy: 0, st: 0, px: 0, k: 0, emit: R() };
  }
  function seed() {
    R = rng(20261015);
    S.cells = []; S.prots = []; S.nCell = 0; S.nProt = 0; S.t = 0;
    var n = Math.round(XP.clamp(S.wu * S.top / 3.4, 4, 8));
    var ws = [];
    for (var i = 0; i < n; i++) ws.push(CELL_MIN + (CELL_MAX - CELL_MIN) * i / (n - 1));
    // shuffle the widths across the window so thin and wide cells mix
    for (i = ws.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = ws[i]; ws[i] = ws[j]; ws[j] = t; }
    ws.forEach(function (w, k) {
      var x = (k + 0.5) * S.wu / n + (R() - 0.5) * 0.4;
      S.cells.push(makeCell(w, x, 0.45 + R() * (S.top - 1.1)));
    });
    layPores();
  }

  /* half of a rod's vertical extent at angle th */
  function extY(c) { return (c.L - c.w) / 2 * Math.abs(Math.sin(c.th)) + c.w / 2; }
  function extX(c) { return (c.L - c.w) / 2 * Math.abs(Math.cos(c.th)) + c.w / 2; }
  /* the crossflow: fastest far from the wall, still at it */
  function flow(y) { return 0.55 * Math.pow(XP.clamp((S.top - y) / S.top, 0, 1), 0.5); }

  function respawn(c) {
    var n = makeCell(c.w, -extX(c) - R() * 0.5, 0.45 + R() * (S.top - 1.1));
    n.L = c.L;
    return n;
  }

  /* rods as segments, for keeping cells from overlapping */
  function segDist(a, b) {
    var ha = (a.L - a.w) / 2, hb = (b.L - b.w) / 2;
    var ax = Math.cos(a.th) * ha, ay = Math.sin(a.th) * ha, bx = Math.cos(b.th) * hb, by = Math.sin(b.th) * hb;
    // closest points between segments a.x±(ax,ay) and b.x±(bx,by), sampled (cheap and smooth enough here)
    var best = 1e9, pa = null, pb = null;
    for (var i = -2; i <= 2; i++) for (var j = -2; j <= 2; j++) {
      var x1 = a.x + ax * i / 2, y1 = a.y + ay * i / 2, x2 = b.x + bx * j / 2, y2 = b.y + by * j / 2;
      var dd = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
      if (dd < best) { best = dd; pa = [x1, y1]; pb = [x2, y2]; }
    }
    return { d: Math.sqrt(best), nx: pa[0] - pb[0], ny: pa[1] - pb[1] };
  }

  function step(dt) {
    if (dt <= 0) return;
    S.t += dt;
    var sq = Math.sqrt(dt), i, c, q;
    var cells = S.cells;

    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      if (c.st === 0) {                                   // in the lumen, carried by the crossflow
        c.vy += (0.16 - c.vy) * 1.4 * dt + gauss() * 0.16 * sq;
        c.om += (-c.th * 0.8 - c.om * 1.6) * dt + gauss() * 0.22 * sq;
        c.th = XP.clamp(c.th + c.om * dt, -0.6, 0.6);
        c.x += (flow(c.y) + gauss() * 0.05) * dt;
        c.y += c.vy * dt;
        var ey = extY(c);
        if (c.y - ey < 0.05) { c.y = 0.05 + ey; c.vy = Math.abs(c.vy) * 0.5; }
        if (c.y + ey >= S.top) {
          var px = poreNear(c.x);
          if (c.w < S.d && Math.abs(c.x - px) < S.d / 2 + extX(c) * 0.8) { c.st = 1; c.px = px; c.k = 0; }
          else {
            c.y = S.top - ey;                               // it bumps the wall and stays on the lumen side
            if (c.vy > 0) c.vy = 0;
            if (R() < dt * 0.07) c.vy = -0.24;              // now and then the crossflow lifts it off again
          }
        }
        // cells shed ACC deaminase as they go (illustrative rate)
        c.emit += dt * 0.6;
        if (c.emit >= 1 && S.prots.length < S.maxP) {
          c.emit -= 1;
          var a = (R() - 0.5) * (c.L - c.w), side = R() < 0.5 ? -1 : 1;
          S.prots.push({ x: c.x + Math.cos(c.th) * a - Math.sin(c.th) * side * c.w / 2,
                         y: c.y + Math.sin(c.th) * a + Math.cos(c.th) * side * c.w / 2,
                         vx: 0, vy: 0, st: 0, px: 0 });
        } else if (c.emit >= 1) c.emit = 0;
        if (c.x - extX(c) > S.wu + 0.2) cells[i] = respawn(c);
      } else if (c.st === 1) {                            // it fits: line up over the pore and turn end-first
        var tgt = c.th >= 0 ? Math.PI / 2 : -Math.PI / 2;
        c.k += dt;
        c.x += (c.px - c.x) * Math.min(1, dt * 3.2);
        c.th += (tgt - c.th) * Math.min(1, dt * 3.2);
        c.y = S.top - extY(c) + Math.min(0.03, c.k * 0.03);
        if (c.k > 0.55 && Math.abs(tgt - c.th) < 0.06) { c.th = tgt; c.st = 2; }
      } else if (c.st === 2) {                            // through the pore
        c.x = c.px;
        c.y += 0.42 * dt;
        if (c.y - c.L / 2 > S.bot) { c.st = 3; S.nCell++; c.vy = 0; }
      } else {                                            // on the shell side: carried off to the harvest
        c.th += ((c.th > 0 ? 0.35 : -0.35) - c.th) * Math.min(1, dt * 0.9);
        c.x += 0.24 * dt;
        c.y += 0.12 * dt;
        if (c.y - extY(c) < S.bot + 0.02) c.y = S.bot + 0.02 + extY(c);
        if (c.x - extX(c) > S.wu || c.y - extY(c) > S.hu) cells[i] = respawn(c);
      }
    }

    // keep resting cells from overlapping one another
    for (i = 0; i < cells.length; i++) for (var j = i + 1; j < cells.length; j++) {
      var a = cells[i], b = cells[j];
      if (a.st !== 0 || b.st !== 0) continue;
      if (Math.abs(a.x - b.x) > (a.L + b.L) / 2 || Math.abs(a.y - b.y) > (a.L + b.L) / 2) continue;
      var sd = segDist(a, b), need = (a.w + b.w) / 2 + 0.02;
      if (sd.d < need) {
        var push = (need - sd.d) / 2, len = sd.d || 1e-6, nx = sd.nx / len, ny = sd.ny / len;
        if (!sd.d) { nx = 0; ny = -1; }
        a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push;
        // the wall still wins
        if (a.y + extY(a) > S.top) a.y = S.top - extY(a);
        if (b.y + extY(b) > S.top) b.y = S.top - extY(b);
      }
    }

    // ACC deaminase: a random walk, carried along, drawn toward the wall
    var P = S.prots, keep = [];
    for (i = 0; i < P.length; i++) {
      q = P[i];
      q.vx += -q.vx * 2 * dt + gauss() * 0.9 * sq;
      q.vy += -q.vy * 2 * dt + gauss() * 0.9 * sq;
      if (q.st === 0) {
        q.x += (flow(q.y) + q.vx) * dt;
        q.y += (0.2 + q.vy) * dt;
        if (q.y < 0.03) { q.y = 0.03; q.vy = Math.abs(q.vy); }
        if (q.y >= S.top) {
          var pp = poreNear(q.x);
          if (Math.abs(q.x - pp) < S.d / 2) { q.st = 1; q.px = pp; }
          else { q.y = S.top - 0.004; q.vy = -Math.abs(q.vy) * 0.6; }
        }
        if (q.x > S.wu + 0.05) continue;
      } else if (q.st === 1) {
        var room = Math.max(0, S.d / 2 - S.rp / S.s);
        q.x = XP.clamp(q.x + q.vx * dt * 0.3, q.px - room, q.px + room);
        q.y += 0.5 * dt;
        if (q.y > S.bot) { q.st = 2; S.nProt++; }
      } else {
        q.x += (0.34 + q.vx) * dt;
        q.y += (0.05 + q.vy * 0.6) * dt;
        if (q.y < S.bot + 0.01) { q.y = S.bot + 0.01; q.vy = Math.abs(q.vy); }
        if (q.x > S.wu + 0.05 || q.y > S.hu + 0.05) continue;
      }
      keep.push(q);
    }
    S.prots = keep;
  }

  /* ---- drawing ---- */
  function capsule(x, y, th, L, w) {
    var r = w / 2, h = Math.max(0, L / 2 - r), c = Math.cos(th), s = Math.sin(th);
    ctx.beginPath();
    ctx.moveTo(x + c * -h - s * -r, y + s * -h + c * -r);
    ctx.lineTo(x + c * h - s * -r, y + s * h + c * -r);
    ctx.arc(x + c * h, y + s * h, r, th - Math.PI / 2, th + Math.PI / 2);
    ctx.lineTo(x + c * -h - s * r, y + s * -h + c * r);
    ctx.arc(x + c * -h, y + s * -h, r, th + Math.PI / 2, th + Math.PI * 1.5);
    ctx.closePath();
  }
  function drawCell(c) {
    var s = S.s, gone = c.st === 3 || (c.st === 2 && c.y - c.L / 2 > S.top);
    var x = c.x * s, y = c.y * s, L = c.L * s, w = c.w * s;
    capsule(x, y, c.th, L, w);
    ctx.fillStyle = gone ? C.goneFill : C.cellFill;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = gone ? C.gone : C.lumen;
    ctx.stroke();
    // a soft highlight along the rod, so it reads as a body rather than a ring
    var h = Math.max(0, (L - w) / 2) * 0.8, off = -w * 0.2, cs = Math.cos(c.th), sn = Math.sin(c.th);
    if (h > 1) {
      ctx.beginPath();
      ctx.moveTo(x - cs * h - sn * off, y - sn * h + cs * off);
      ctx.lineTo(x + cs * h - sn * off, y + sn * h + cs * off);
      ctx.lineWidth = Math.max(1, w * 0.16); ctx.lineCap = "round";
      ctx.strokeStyle = C.cellHi; ctx.stroke();
    }
  }
  function text(str, x, y, opt) {
    ctx.font = (opt.weight || 600) + " " + (opt.size || 11) + "px " + FONT;
    ctx.textAlign = opt.align || "left";
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = opt.track || "0px";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5; ctx.strokeStyle = C.halo; ctx.strokeText(str, x, y);
    ctx.fillStyle = opt.color || C.ink; ctx.fillText(str, x, y);
    var wd = ctx.measureText(str).width;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    return wd;
  }

  function draw() {
    if (!ctx) return;
    var s = S.s, wy = S.wallY, wh = S.wallH, i, q, c;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.lumenBg; ctx.fillRect(0, 0, W, wy);
    ctx.fillStyle = C.shellBg; ctx.fillRect(0, wy + wh, W, H - wy - wh);

    // the pore channels, open from one side to the other
    var g = ctx.createLinearGradient(0, wy, 0, wy + wh);
    g.addColorStop(0, C.lumenBg); g.addColorStop(1, C.shellBg);
    ctx.fillStyle = g; ctx.fillRect(0, wy, W, wh);

    for (i = 0; i < S.prots.length; i++) {
      q = S.prots[i]; if (q.st !== 0) continue;
      ctx.beginPath(); ctx.arc(q.x * s, q.y * s, S.rp, 0, 6.2832); ctx.fillStyle = C.prot; ctx.fill();
    }
    for (i = 0; i < S.cells.length; i++) { c = S.cells[i]; if (c.st <= 1) drawCell(c); }

    // the wall, between the pores
    var half = S.d / 2 * s, rr = Math.min(3, wh / 4);
    ctx.fillStyle = C.wall; ctx.strokeStyle = C.wallEdge; ctx.lineWidth = 1;
    var edges = [-1e4];
    S.pores.forEach(function (p) { edges.push(p * s - half, p * s + half); });
    edges.push(W + 1e4);
    for (i = 0; i < edges.length; i += 2) {
      var x0 = Math.max(-4, edges[i]), x1 = Math.min(W + 4, edges[i + 1]);
      if (x1 - x0 < 0.5) continue;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, wy, x1 - x0, wh, rr); else ctx.rect(x0, wy, x1 - x0, wh);
      ctx.fill(); ctx.stroke();
    }

    for (i = 0; i < S.cells.length; i++) { c = S.cells[i]; if (c.st >= 2) drawCell(c); }
    for (i = 0; i < S.prots.length; i++) {
      q = S.prots[i]; if (q.st === 0) continue;
      ctx.beginPath(); ctx.arc(q.x * s, q.y * s, S.rp, 0, 6.2832); ctx.fillStyle = C.prot; ctx.fill();
    }

    // direct labels: the two sides, the pore's width, the scale
    var x = 12;
    x += text("LUMEN SIDE", x, 21, { size: 11, weight: 700, color: C.lumenInk, track: "1.3px" });
    text("  culture, flowing →", x, 21, { size: 11.5, weight: 500, color: C.ink2 });
    x = 12;
    x += text("SHELL SIDE", x, H - 12, { size: 11, weight: 700, color: C.shellInk, track: "1.3px" });
    text("  to harvest", x, H - 12, { size: 11.5, weight: 500, color: C.ink2 });

    var lx = S.label * s, ly = wy + wh + 9;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx - half, ly - 4); ctx.lineTo(lx - half, ly + 4);
    ctx.moveTo(lx + half, ly - 4); ctx.lineTo(lx + half, ly + 4);
    ctx.moveTo(lx - half, ly); ctx.lineTo(lx + half, ly);
    ctx.stroke();
    text(fmtD(S.d) + " µm pore", lx, ly + 17, { size: 12, weight: 650, color: C.ink, align: "center" });

    var bx1 = W - 14, bx0 = bx1 - s, by = H - 13;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx0, by); ctx.lineTo(bx1, by);
    ctx.moveTo(bx0, by - 4); ctx.lineTo(bx0, by + 4);
    ctx.moveTo(bx1, by - 4); ctx.lineTo(bx1, by + 4);
    ctx.stroke();
    text("1 µm", (bx0 + bx1) / 2, by - 7, { size: 11.5, weight: 600, color: C.ink, align: "center" });
  }

  /* ---- the readouts ---- */
  var shownC = -1, shownP = -1;
  function tally(force) {
    if (!force && S.nCell === shownC && S.nProt === shownP) return;
    shownC = S.nCell; shownP = S.nProt;
    cellsN.textContent = S.nCell;
    protN.textContent = S.nProt;
    cellsChip.classList.toggle("is-crossed", S.nCell > 0);
  }
  function say(d) {
    var D = "<b>" + fmtD(d) + "&nbsp;µm</b>";
    if (d === PORE) return "At " + D + ", this membrane’s rating, no cell fits: even the thinnest reported cell is 0.25&nbsp;µm across. ACC deaminase, a few nanometers across, passes.";
    if (d <= CELL_MIN) return "At " + D + " no cell fits: the thinnest reported cell is 0.25&nbsp;µm across. ACC deaminase still passes.";
    if (d <= CELL_MAX) return "At " + D + " the thinnest cells fit end‑first and cross; wider ones are still held. The wall now lets culture through.";
    return "At " + D + " every reported cell width fits. The wall no longer holds the culture back.";
  }
  function setPore(d, announce) {
    S.d = d;
    layPores();
    S.nCell = 0; S.nProt = 0;
    // anything part-way through a pore follows its pore as the spacing changes; a cell that no longer fits goes
    // back to the lumen side
    S.cells.forEach(function (c) {
      if (c.st !== 1 && c.st !== 2) return;
      if (c.w >= d && c.y - c.L / 2 <= S.bot) { c.st = 0; c.th = 0; c.y = S.top - extY(c); }
      else c.px = poreNear(c.px);
    });
    S.prots.forEach(function (q) { if (q.st === 1) { q.px = poreNear(q.px); } });
    out.textContent = fmtD(d) + " µm";
    range.setAttribute("aria-valuetext", fmtD(d) + " micrometers");
    if (refBtn) refBtn.hidden = d === PORE;
    // the visible sentence follows the drag; the live region speaks only when the hand stops (change, or a key)
    status.setAttribute("aria-live", announce ? "polite" : "off");
    status.innerHTML = say(d);
    if (still) runStill(); else { tally(true); draw(); }
  }

  /* ---- a warm start: the first frame already shows cells at the wall and protein in flight;
          with reduced motion, a still frame after 30 s of simulated flow ---- */
  var still = XP.reduced;
  function warm(sec) { for (var k = 0; k < sec * 30; k++) step(1 / 30); }
  function runStill() {
    var d = S.d;
    seed(); S.d = d; layPores();
    warm(30);
    tally(true); draw();
    if (when) when.hidden = false;
  }
  function runLive() { seed(); warm(8); S.nCell = 0; S.nProt = 0; tally(true); draw(); }

  /* ---- wiring ---- */
  var loop = null;
  function setPlaying(on) {
    if (on) {
      still = false;
      if (when) when.hidden = true;
      if (!loop) loop = XP.loop(stage, frame);
      loop.start();
    } else if (loop) loop.stop();
    playBtn.querySelector("span").textContent = on ? "Pause" : "Play";
    playBtn.classList.toggle("is-paused", !on);
  }
  var acc = 0;
  function frame(dt) {
    acc += dt;
    step(dt);
    draw();
    if (acc > 0.12) { acc = 0; tally(false); }
  }

  geometry();
  seed();
  if (!still) warm(8);
  fig.classList.add("is-live");
  range.value = String(vOf(PORE));
  setPore(PORE, false);            // with reduced motion this also simulates the still frame
  setPlaying(!still);

  range.addEventListener("input", function () { setPore(snap(dOf(+range.value)), false); });
  range.addEventListener("change", function () { setPore(snap(dOf(+range.value)), true); });
  if (refBtn) refBtn.addEventListener("click", function () { range.value = String(vOf(PORE)); setPore(PORE, true); range.focus(); });
  playBtn.addEventListener("click", function () { setPlaying(!(loop && loop.running)); });

  var lastW = W;
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      var w = Math.round(stage.clientWidth);
      if (Math.abs(w - lastW) < 2) return;
      lastW = w;
      geometry();
      if (still) runStill(); else runLive();
    }).observe(stage);
  }
})();
