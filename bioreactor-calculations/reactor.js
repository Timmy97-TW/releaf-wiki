/* =============================================================================
   Bioreactor Calculations: the instruments
   -----------------------------------------------------------------------------
   Five panels, one state object, one recompute. Every panel subscribes to the
   same store, so moving the cross-flow slider in the envelope panel also moves
   the operating dot on the shear chart four sections further down.

   Three things the earlier internal explorer got wrong, fixed here:

   1. It rebuilt the whole schematic with innerHTML on every input event, which
      tore down and restarted the SMIL animations. Flow appeared to stutter and
      jump backwards. Here the SVG is static markup in the page; JavaScript
      only writes attributes, and the dashed flow is advanced by one rAF loop
      holding a continuous phase, so changing the rate never restarts anything.

   2. Canvases were sized off clientWidth on every render and redrawn on every
      window resize event. Here a ResizeObserver resizes once per actual size
      change, drawing is scheduled through rAF, and axis domains are pinned so
      a slider drag does not make the axes breathe.

   3. Critical flux was tuned by a free "wall-to-bulk concentration ratio"
      slider, which let anyone dial the fouling margin to whatever they liked.
      Here the wall value is pinned at random close packing and the bulk volume
      fraction is computed from cell density, so J_crit is predicted rather
      than chosen.

   Nothing here is fitted to our own data yet. The secretion bracket comes from
   the Level-1 modelling handoff of 2 September 2026 and is superseded the
   moment real densitometry exists.
   ========================================================================== */
(function () {
  "use strict";

  var PI = Math.PI;

  /* ---- locked geometry and fluid properties ------------------------------- */
  var G = {
    N: 8,                 /* fibres                                    [fixed] */
    di: 1.0e-3,           /* lumen inner diameter, m                   [fixed] */
    L: 0.5957,            /* effective fibre length, m                 [fixed] */
    Am: 150e-4,           /* membrane area per module, m2              [fixed] */
    rho: 1000,            /* broth density, kg/m3                        [lit] */
    mu: 1.0e-3,           /* broth viscosity at 37 C, Pa s               [lit] */
    aCell: 0.7117e-6,     /* equivalent-sphere radius of a 0.8x3 um rod [calc] */
    vCell: 1.51e-18,      /* cell volume, m3                            [calc] */
    phiWall: 0.60,        /* random close packing at the wall            [lit] */
    cellsPerODmL: 8e8,    /* cells per mL per OD600 unit              [verify] */
    dcwPerOD: 0.4,        /* g DCW per L per OD600 unit               [verify] */
    Cstar: 0.20,          /* dissolved O2 at saturation, mmol/L          [lit] */
    TMPrating: 250,       /* module rating, kPa                        [fixed] */
    Vw: 100               /* lumen-loop working volume, mL            [verify] */
  };

  /* ---- the store ---------------------------------------------------------- */
  var S = {
    Qxf: 230,     /* cross-flow, mL/min           */
    lmh: 5,       /* permeate flux, LMH           */
    od: 1.54,     /* culture density, OD600       */
    mods: 1,      /* modules in parallel          */
    qo2: 3,       /* specific O2 uptake, mmol/g/h */
    klaDel: 15,   /* deliverable kLa, 1/h         */
    doPct: 30,    /* dissolved O2 target, % sat   */
    psys: 5,      /* continuous draw, W           */
    panel: 45,    /* panel rating, W              */
    psh: 3        /* peak sun hours, h/day        */
  };
  var subs = [];
  function on(fn) { subs.push(fn); }
  function set(k, v) { S[k] = v; publish(); }
  var pending = false;
  function flush() {
    if (!pending) return;
    pending = false;
    var r = compute();
    subs.forEach(function (fn) { fn(r, S); });
  }
  /* rAF coalesces a slider drag into one recompute per frame. The timeout is
     the fallback: a background or hidden tab never gets a frame, and the page
     has to be correct the moment it becomes visible rather than blank. */
  function publish() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(flush);
    setTimeout(flush, 60);
  }

  /* ---- the model ---------------------------------------------------------- */
  function compute() {
    var Q1 = S.Qxf * 1e-6 / 60 / G.N;                       /* m3/s per fibre */
    var u = Q1 / (PI * Math.pow(G.di / 2, 2));              /* m/s            */
    var Re = 4 * G.rho * Q1 / (PI * G.mu * G.di);
    var gw = 32 * Q1 / (PI * Math.pow(G.di, 3));            /* 1/s            */
    var tw = G.mu * gw;                                     /* Pa             */
    var dP = 128 * G.mu * G.L * Q1 / (PI * Math.pow(G.di, 4)) / 1000; /* kPa   */
    var passS = G.L / u;
    var passPerH = 3600 / (G.Vw / (S.Qxf / 60));            /* loop turnovers */

    var area = G.Am * S.mods;                               /* m2             */
    var Qp = S.lmh * area * 1000 / 60;                      /* mL/min total   */
    var phib = S.od * G.cellsPerODmL * 1e6 * G.vCell;       /* volume fraction */
    var Jcrit = 0.072 * Math.pow(Math.pow(G.aCell, 4) / G.L, 1 / 3) * gw *
                Math.log(G.phiWall / Math.max(phib, 1e-9));
    var JcritLMH = Jcrit * 3.6e6;
    var margin = S.lmh / JcritLMH;

    var vvd = Qp * 1440 / G.Vw;
    var cells = S.od * G.cellsPerODmL * G.Vw;
    var cspr = cells > 0 ? Qp * 1440 / cells * 1e6 : 0;     /* nL/cell/day    */
    var mediumLday = Qp * 1440 / 1000;

    var dcw = G.dcwPerOD * S.od;                            /* g/L            */
    var ourVol = S.qo2 * dcw;                               /* mmol/L/h       */
    var drive = G.Cstar * (1 - S.doPct / 100);
    var klaReq = drive > 0 ? ourVol / drive : Infinity;
    var pool = G.Cstar * S.doPct / 100;                     /* mmol/L         */
    var poolMin = ourVol > 0 ? pool / ourVol * 60 : Infinity;
    var o2ratio = klaReq / S.klaDel;

    var eDay = S.psys * 24;
    var eSol = S.panel * S.psh * 0.75;
    var powerRatio = eSol / eDay;
    var panelNeeded = eDay / (S.psh * 0.75);

    var tauSys = Qp > 0 ? G.Vw / Qp : Infinity;             /* min            */
    var thetaRatio = 105 / tauSys;

    return {
      Q1: Q1, u: u, Re: Re, gw: gw, tw: tw, dP: dP, passS: passS, passPerH: passPerH,
      area: area, Qp: Qp, phib: phib, JcritLMH: JcritLMH, margin: margin,
      vvd: vvd, cspr: cspr, mediumLday: mediumLday,
      dcw: dcw, ourVol: ourVol, klaReq: klaReq, poolMin: poolMin, o2ratio: o2ratio,
      eDay: eDay, eSol: eSol, powerRatio: powerRatio, panelNeeded: panelNeeded,
      tauSys: tauSys, thetaRatio: thetaRatio
    };
  }

  /* ---- formatting --------------------------------------------------------- */
  function num(v, d) {
    if (!isFinite(v)) return "∞";
    return v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function band(v, gLo, gHi, yLo, yHi) {
    if (v >= gLo && v <= gHi) return "ok";
    if (v >= yLo && v <= yHi) return "watch";
    return "fail";
  }

  /* ---- canvas helper ------------------------------------------------------- */
  function mkCanvas(canvas, draw) {
    var ctx = canvas.getContext("2d");
    var w = 0, h = 0, queued = false, last = null;

    /* Resizing a canvas clears it, so only touch it when the box really moved. */
    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var nw = Math.max(1, Math.round(rect.width));
      var nh = Math.max(1, Math.round(rect.height));
      if (nw === w && nh === h && canvas.width === Math.round(nw * dpr)) return;
      w = nw; h = nh;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function paint() {
      if (!queued) return;
      queued = false;
      resize();
      ctx.clearRect(0, 0, w, h);
      if (last) draw(ctx, w, h, last);
    }
    function render(state) {
      last = state;
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
      setTimeout(paint, 60);
    }
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { if (last) render(last); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { if (last) render(last); });
    }
    resize();
    return render;
  }

  var css = getComputedStyle(document.documentElement);
  function tok(name, fallback) {
    var v = css.getPropertyValue(name).trim();
    return v || fallback;
  }
  var C = {
    leaf: tok("--leaf-700", "#23684a"),
    leafLight: tok("--leaf-500", "#4f9c6f"),
    leafFaint: tok("--leaf-100", "#e3f0e8"),
    amber: tok("--amber-700", "#92610c"),
    rust: tok("--rust-700", "#9a3d22"),
    slate: tok("--slate-700", "#3f5468"),
    grid: tok("--gray-200", "#e5e5e5"),
    axis: tok("--gray-400", "#a3a3a3"),
    ink: tok("--gray-600", "#525252"),
    black: tok("--black", "#171717")
  };

  function axes(ctx, w, h, pad, xlab, ylab) {
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.lineTo(w - pad.r, h - pad.b);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = "10px " + tok("--font-body", "sans-serif");
    ctx.textAlign = "center";
    ctx.fillText(xlab, (pad.l + w - pad.r) / 2, h - 4);
    ctx.save();
    ctx.translate(10, (pad.t + h - pad.b) / 2);
    ctx.rotate(-PI / 2);
    ctx.fillText(ylab, 0, 0);
    ctx.restore();
  }

  /* =========================================================================
     PANEL 1  the operating envelope
     ====================================================================== */
  var SLIDERS = [
    { id: "Qxf", name: "Cross-flow", unit: "mL/min", min: 230, max: 2600, step: 10,
      note: "ZP4000-N79H rated range. 230 is the pump floor, not a choice." },
    { id: "lmh", name: "Permeate flux", unit: "LMH", min: 0.5, max: 50, step: 0.5, dec: 1,
      note: "Set by the delivery pump. Everything downstream of the membrane follows this." },
    { id: "od", name: "Culture density", unit: "OD₆₀₀", min: 0.1, max: 3, step: 0.02, dec: 2,
      note: "Our own 37 °C carrying capacity is 1.54." },
    { id: "mods", name: "Modules in parallel", unit: "×", min: 1, max: 24, step: 1,
      note: "The only scale-up lever. Area rises, shear and flux hold." }
  ];

  var CELLS = [
    { name: "Reynolds", sym: "Re", get: function (r) { return num(r.Re, 0); },
      band: "500–2000 laminar", st: function (r) { return band(r.Re, 500, 2000, 150, 2100); } },
    { name: "Wall shear rate", sym: "γ̇w", get: function (r) { return num(r.gw, 0); }, u: "s⁻¹",
      band: "2000–8000 in HF practice", st: function (r) { return band(r.gw, 2000, 8000, 1200, 12000); } },
    { name: "Wall shear stress", sym: "τw", get: function (r) { return num(r.tw, 1); }, u: "Pa",
      band: "lysis reported above 2770", st: function (r) { return band(r.gw, 2000, 8000, 1200, 12000); } },
    { name: "Lumen velocity", sym: "ū", get: function (r) { return num(r.u * 100, 0); }, u: "cm/s",
      band: "reported, not banded", st: function () { return "info"; } },
    { name: "Axial pressure drop", sym: "ΔP", get: function (r) { return num(r.dP, 1); }, u: "kPa",
      band: "module rated to 250 kPa", st: function (r) { return band(r.dP, 0, 150, 0, 250); } },
    { name: "Single-pass time", sym: "L/ū", get: function (r) { return num(r.passS, 2); }, u: "s",
      band: "reported, not banded", st: function () { return "info"; } },
    { name: "Loop turnovers", sym: "", get: function (r) { return num(r.passPerH, 0); }, u: "h⁻¹",
      band: "cumulative shear exposure", st: function (r) { return band(r.passPerH, 0, 200, 0, 600); } },
    { name: "Operating flux", sym: "J", get: function (r) { return num(S.lmh, 1); }, u: "LMH",
      band: "must sit under J_crit", st: function (r) { return r.margin < 0.7 ? "ok" : r.margin < 1 ? "watch" : "fail"; } },
    { name: "Critical flux", sym: "J_crit", get: function (r) { return num(r.JcritLMH, 0); }, u: "LMH",
      band: "predicted, not tuned", st: function () { return "info"; } },
    { name: "Fouling margin", sym: "J/J_crit", get: function (r) { return num(r.margin, 2); },
      band: "under 0.7 with room to spare", st: function (r) { return r.margin < 0.7 ? "ok" : r.margin < 1 ? "watch" : "fail"; } },
    { name: "Permeate rate", sym: "Q_p", get: function (r) { return num(r.Qp, 2); }, u: "mL/min",
      band: "reported, not banded", st: function () { return "info"; } },
    { name: "Vessel volumes", sym: "VVD", get: function (r) { return num(r.vvd, 1); }, u: "day⁻¹",
      band: "medium turnover of the loop", st: function () { return "info"; } },
    { name: "Cell-specific perfusion", sym: "CSPR", get: function (r) { return num(r.cspr, 3); }, u: "nL/cell/d",
      band: "0.02–0.5 in practice", st: function (r) { return band(r.cspr, 0.02, 0.5, 0.008, 1.2); } },
    { name: "Medium draw", sym: "", get: function (r) { return num(r.mediumLday, 2); }, u: "L/day",
      band: "against a 2 L/day field budget", st: function (r) { return band(r.mediumLday, 0, 2, 0, 5); } }
  ];

  var PRESETS = [
    { label: "Bench run, 3 Sep 2026", set: { Qxf: 230, lmh: 5, od: 1.54, mods: 1 } },
    { label: "Pump at mid-range", set: { Qxf: 1000, lmh: 5, od: 1.54, mods: 1 } },
    { label: "Pump wide open", set: { Qxf: 2600, lmh: 5, od: 1.54, mods: 1 } },
    { label: "Flux to reach CSPR 0.05", set: { Qxf: 230, lmh: 17, od: 1.54, mods: 1 } },
    { label: "Eight modules in parallel", set: { Qxf: 230, lmh: 5, od: 1.54, mods: 8 } }
  ];

  function panelEnvelope() {
    var host = document.getElementById("rig-envelope");
    if (!host) return;
    var ctrlHost = host.querySelector("[data-ctrls]");
    var boardHost = host.querySelector("[data-board]");
    var presetHost = host.querySelector("[data-presets]");
    var verdict = host.querySelector("[data-verdict]");

    var inputs = {};
    SLIDERS.forEach(function (s) {
      var wrap = document.createElement("div");
      wrap.className = "ctrl";
      wrap.innerHTML =
        '<div class="ctrl__head"><span class="ctrl__name">' + s.name + '</span>' +
        '<span class="ctrl__val"><span data-out></span> <small>' + s.unit + "</small></span></div>" +
        '<input type="range" min="' + s.min + '" max="' + s.max + '" step="' + s.step +
        '" value="' + S[s.id] + '" aria-label="' + s.name + '" />' +
        '<p class="ctrl__note">' + s.note + "</p>";
      var input = wrap.querySelector("input");
      var out = wrap.querySelector("[data-out]");
      inputs[s.id] = { input: input, out: out, dec: s.dec || 0 };
      input.addEventListener("input", function () {
        set(s.id, parseFloat(input.value));
        clearPresets();
      });
      ctrlHost.appendChild(wrap);
    });

    var presetBtns = [];
    PRESETS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "preset";
      b.textContent = p.label;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        Object.keys(p.set).forEach(function (k) { S[k] = p.set[k]; });
        publish();
        presetBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      });
      presetBtns.push(b);
      presetHost.appendChild(b);
    });
    function clearPresets() { presetBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); }
    presetBtns[0].setAttribute("aria-pressed", "true");

    var cellNodes = CELLS.map(function (c) {
      var d = document.createElement("div");
      d.className = "cell";
      d.innerHTML =
        '<div class="cell__top"><span class="cell__name">' + c.name + "</span>" +
        '<span class="cell__sym">' + (c.sym || "") + "</span></div>" +
        '<div class="cell__val"><span data-v></span>' + (c.u ? "<u>" + c.u + "</u>" : "") + "</div>" +
        '<div class="cell__band">' + c.band + "</div>";
      boardHost.appendChild(d);
      return { node: d, v: d.querySelector("[data-v]") };
    });

    on(function (r) {
      SLIDERS.forEach(function (s) {
        var i = inputs[s.id];
        if (parseFloat(i.input.value) !== S[s.id]) i.input.value = S[s.id];
        i.out.textContent = num(S[s.id], i.dec);
      });

      var fails = [], watches = [];
      CELLS.forEach(function (c, k) {
        var st = c.st(r);
        var n = cellNodes[k];
        if (n.node.dataset.state !== st) n.node.dataset.state = st;
        var txt = c.get(r);
        if (n.v.textContent !== txt) n.v.textContent = txt;
        if (st === "fail") fails.push(c.name);
        if (st === "watch") watches.push(c.name);
      });

      if (fails.length) {
        verdict.dataset.state = "fail";
        verdict.innerHTML = "<b>Outside the band: " + fails.join(", ") + ".</b> " +
          "At this setting the design does not hold. The board is not a scoreboard; " +
          "a red cell is a constraint on a headline claim.";
      } else if (watches.length) {
        verdict.dataset.state = "watch";
        verdict.innerHTML = "<b>Outside the preferred band: " + watches.join(", ") + ".</b> " +
          "Inside the outer bound, so the design holds. Everything else is in band.";
      } else {
        verdict.dataset.state = "ok";
        verdict.innerHTML = "<b>Every invariant inside its band.</b> " +
          "Reaching this on the slider is easy. Reaching it on the bench needs the four " +
          "unrecorded parameters in section 12.";
      }
    });
  }

  /* =========================================================================
     PANEL 2  the flow schematic
     ====================================================================== */
  function panelSchematic() {
    var svg = document.getElementById("schematic");
    if (!svg) return;
    var flows = [].slice.call(svg.querySelectorAll(".flow"));
    var fibres = [].slice.call(svg.querySelectorAll(".fibre"));
    var polar = [].slice.call(svg.querySelectorAll(".polar"));
    var out = {};
    [].slice.call(svg.querySelectorAll("[data-out]")).forEach(function (n) {
      out[n.dataset.out] = n;
    });

    var rate = 40, permRate = 8, phase = 0, permPhase = 0, prev = 0;
    var running = false, onScreen = true;

    /* The loop only turns while the schematic is on screen and the tab is
       visible. An always-on rAF keeps the compositor busy for no reason and
       stops the browser ever reaching an idle frame. */
    function frame(ts) {
      if (!running) return;
      var dt = prev ? Math.min(0.05, (ts - prev) / 1000) : 0;
      prev = ts;
      phase = (phase + rate * dt) % 1000;
      permPhase = (permPhase + permRate * dt) % 1000;
      flows.forEach(function (p) {
        p.setAttribute("stroke-dashoffset", String(-(p.dataset.kind === "perm" ? permPhase : phase)));
      });
      requestAnimationFrame(frame);
    }
    function sync() {
      var want = onScreen && !document.hidden &&
                 !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (want === running) return;
      running = want;
      prev = 0;
      if (running) requestAnimationFrame(frame);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        sync();
      }, { rootMargin: "120px" }).observe(svg);
    }
    document.addEventListener("visibilitychange", sync);
    sync();

    on(function (r) {
      rate = 14 + r.u * 34;                 /* px/s, tied to lumen velocity   */
      permRate = 3 + S.lmh * 0.9;
      var col = r.margin < 0.7 ? C.leafLight : r.margin < 1 ? C.amber : C.rust;
      fibres.forEach(function (f) { f.setAttribute("stroke", col); });
      var th = Math.min(9, 1.6 + r.margin * 7);
      polar.forEach(function (p) {
        p.setAttribute("height", th.toFixed(1));
        p.setAttribute("fill", col);
        if (p.dataset.base) p.setAttribute("y", (parseFloat(p.dataset.base) - th).toFixed(1));
      });
      var feedW = Math.max(3, Math.min(11, 3 + S.Qxf / 300));
      [].slice.call(svg.querySelectorAll(".feedline")).forEach(function (p) {
        p.setAttribute("stroke-width", feedW.toFixed(1));
      });
      var permW = Math.max(1.6, Math.min(8, 1.4 + S.lmh * 0.22));
      [].slice.call(svg.querySelectorAll(".permline")).forEach(function (p) {
        p.setAttribute("stroke-width", permW.toFixed(1));
      });

      set0(out.qxf, num(S.Qxf, 0) + " mL/min");
      set0(out.gw, num(r.gw, 0) + " s⁻¹");
      set0(out.re, "Re " + num(r.Re, 0));
      set0(out.dp, num(r.dP, 1) + " kPa");
      set0(out.j, num(S.lmh, 1) + " LMH");
      set0(out.qp, num(r.Qp, 2) + " mL/min");
      set0(out.od, "OD " + num(S.od, 2));
      set0(out.area, num(r.area * 1e4, 0) + " cm²");
      set0(out.margin, "J/J_crit " + num(r.margin, 2));
    });

    function set0(node, txt) { if (node && node.textContent !== txt) node.textContent = txt; }
  }

  /* =========================================================================
     PANEL 3  the shear window
     ====================================================================== */
  function panelShear() {
    var canvas = document.getElementById("chart-shear");
    if (!canvas) return;
    var cap = document.getElementById("cap-shear");

    var render = mkCanvas(canvas, function (ctx, w, h, r) {
      var pad = { l: 46, r: 14, t: 12, b: 36 };
      var xMin = 0, xMax = 2600, yMax = 58000;
      var X = function (q) { return pad.l + (q - xMin) / (xMax - xMin) * (w - pad.l - pad.r); };
      var Y = function (g) { return h - pad.b - Math.min(g, yMax) / yMax * (h - pad.t - pad.b); };

      /* the band conventional hollow-fibre microfiltration runs in */
      ctx.fillStyle = C.leafFaint;
      ctx.fillRect(pad.l, Y(8000), w - pad.l - pad.r, Y(2000) - Y(8000));
      ctx.fillStyle = C.ink;
      ctx.font = "9.5px " + tok("--font-body", "sans-serif");
      ctx.textAlign = "left";
      ctx.fillText("2000–8000 s⁻¹, conventional HF microfiltration", pad.l + 6, Y(8000) - 5);

      /* the pump cannot go below 230 mL/min */
      ctx.fillStyle = "rgba(154,61,34,.07)";
      ctx.fillRect(pad.l, pad.t, X(230) - pad.l, h - pad.t - pad.b);
      ctx.strokeStyle = C.rust;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(230), pad.t); ctx.lineTo(X(230), h - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.rust;
      ctx.save();
      ctx.translate(X(230) - 5, pad.t + 4);
      ctx.rotate(-PI / 2);
      ctx.textAlign = "right";
      ctx.fillText("pump floor 230", 0, 0);
      ctx.restore();

      /* laminar to transitional, Re = 2100 at 792 mL/min */
      ctx.strokeStyle = C.slate;
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(X(792), pad.t); ctx.lineTo(X(792), h - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.slate;
      ctx.textAlign = "left";
      ctx.fillText("Re 2100", X(792) + 4, pad.t + 10);

      axes(ctx, w, h, pad, "cross-flow pump setting  (mL/min)", "wall shear rate  (s⁻¹)");

      ctx.fillStyle = C.axis;
      ctx.font = "9px " + tok("--font-body", "sans-serif");
      ctx.textAlign = "right";
      [0, 20000, 40000].forEach(function (g) {
        ctx.fillText(g === 0 ? "0" : (g / 1000) + "k", pad.l - 5, Y(g) + 3);
        ctx.strokeStyle = C.grid;
        ctx.beginPath(); ctx.moveTo(pad.l, Y(g)); ctx.lineTo(w - pad.r, Y(g)); ctx.stroke();
      });
      ctx.textAlign = "center";
      [500, 1000, 1500, 2000, 2500].forEach(function (q) {
        ctx.fillText(String(q), X(q), h - pad.b + 14);
      });

      /* shear is linear in pump setting for fixed geometry */
      ctx.strokeStyle = C.leaf;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var q = 0; q <= xMax; q += 20) {
        var Q1 = q * 1e-6 / 60 / G.N;
        var g = 32 * Q1 / (PI * Math.pow(G.di, 3));
        q === 0 ? ctx.moveTo(X(q), Y(g)) : ctx.lineTo(X(q), Y(g));
      }
      ctx.stroke();

      /* the operating point */
      var st = r.gw >= 2000 && r.gw <= 8000 ? C.leafLight : r.gw <= 12000 ? C.amber : C.rust;
      ctx.beginPath();
      ctx.arc(X(S.Qxf), Y(r.gw), 6, 0, 2 * PI);
      ctx.fillStyle = st;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    on(function (r) {
      render(r);
      if (!cap) return;
      var over = r.gw / 8000;
      cap.innerHTML = "At <b>" + num(S.Qxf, 0) + " mL/min</b> the wall shear is <b>" +
        num(r.gw, 0) + " s⁻¹</b>, " +
        (over > 1 ? num(over, 1) + "× the top of the 2,000–8,000 s⁻¹ practice window"
                  : r.gw < 2000 ? "below the practice window"
                  : "inside the practice window, " + num(r.gw / 3000, 1) +
                    "× Maiorella's balance point") +
        ". Flow stays laminar to 792 mL/min; above that the Hagen–Poiseuille " +
        "expressions on this page no longer hold.";
    });
  }

  /* =========================================================================
     PANEL 4  starting the loop
     ====================================================================== */
  var SCEN = {
    low:  { qP: 0.0124, label: "Low",  anchor: "0.05 µg/mL at 8 h" },
    mid:  { qP: 0.247,  label: "Mid",  anchor: "1.0 µg/mL at 8 h" },
    high: { qP: 4.94,   label: "High", anchor: "20 µg/mL at 8 h" }
  };
  var D = {
    scen: "mid", mode: "A", lmh: 5, kdeg: 0.03, VL: 100, VS: 100,
    muMax: 1.31, Xmax: 1.54, X0: 0.08, tEnd: 24
  };

  function derivs(t, y, p) {
    var X = y[0], PL = y[1], MS = y[2];
    var mu = p.muMax * (1 - X / p.Xmax);
    var dX = mu * X;
    var prod = p.qP * X;                                   /* ug/(mL h)       */
    var Qh = p.Qp * 60;                                    /* mL/h            */
    var dPL, dMS;
    if (p.mode === "A") {
      var PS = MS / p.VS;
      var exch = Qh * (PL - PS);
      dPL = prod - p.kdeg * PL - exch / p.VL;
      dMS = exch - p.kdeg * MS;
    } else {
      dPL = prod - p.kdeg * PL - Qh * PL / p.VL;
      dMS = Qh * PL - p.kdeg * MS;
    }
    return [dX, dPL, dMS];
  }

  function integrate(p) {
    var dt = 0.01, n = Math.round(p.tEnd / dt);
    var t = new Float64Array(n + 1), X = new Float64Array(n + 1),
        PL = new Float64Array(n + 1), PS = new Float64Array(n + 1);
    var y = [p.X0, 0, 0];
    for (var i = 0; i <= n; i++) {
      var tt = i * dt;
      t[i] = tt;
      X[i] = y[0];
      PL[i] = y[1];
      PS[i] = shell(y[2], tt, p);
      if (i === n) break;
      var k1 = derivs(tt, y, p);
      var y2 = [y[0] + dt / 2 * k1[0], y[1] + dt / 2 * k1[1], y[2] + dt / 2 * k1[2]];
      var k2 = derivs(tt + dt / 2, y2, p);
      var y3 = [y[0] + dt / 2 * k2[0], y[1] + dt / 2 * k2[1], y[2] + dt / 2 * k2[2]];
      var k3 = derivs(tt + dt / 2, y3, p);
      var y4 = [y[0] + dt * k3[0], y[1] + dt * k3[1], y[2] + dt * k3[2]];
      var k4 = derivs(tt + dt, y4, p);
      for (var j = 0; j < 3; j++) {
        y[j] += dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
      }
    }
    var pmax = 0;
    for (var m = 0; m <= n; m++) pmax = Math.max(pmax, PL[m], PS[m]);
    return { t: t, X: X, PL: PL, PS: PS, n: n, dt: dt, pmax: pmax };
  }

  function shell(MS, t, p) {
    if (p.mode === "A") return MS / p.VS;
    if (p.mode === "B") {
      var v = p.Qp * 60 * t;
      return v > 1e-6 ? MS / v : 0;
    }
    return MS / (p.VS0 + p.Qp * 60 * t);
  }

  function panelStartup() {
    var host = document.getElementById("rig-startup");
    if (!host) return;
    var canvas = document.getElementById("chart-startup");
    var scrub = host.querySelector("[data-scrub]");
    var play = host.querySelector("[data-play]");
    var clock = host.querySelector("[data-clock]");
    var read = {};
    [].slice.call(host.querySelectorAll("[data-read]")).forEach(function (n) { read[n.dataset.read] = n; });
    var note = host.querySelector("[data-modenote]");

    var traj = null, tNow = 8, playing = false, lastTs = 0;

    var MODE_NOTE = {
      A: "Mode A, closed recirculating. Permeate crosses to the shell and shell fluid " +
         "returns. Mass is conserved and shell concentration climbs towards lumen " +
         "concentration with time constant V_S/Q_p, never past it.",
      B: "Mode B, permeate harvested with feed replacement. The lumen carries a real " +
         "removal term. Steady state is q_P·X / (k_deg + Q_p/V_L). The shell figure " +
         "is the mean concentration of everything collected so far.",
      C: "Mode C, dead-end shell fill. The shell starts empty and its volume grows at " +
         "Q_p, so early concentration is high on a tiny volume and falls as the vessel " +
         "fills. This is the mode most likely to have run and least likely to be recorded."
    };

    function params() {
      var p = {
        qP: SCEN[D.scen].qP, mode: D.mode, kdeg: D.kdeg, VL: D.VL, VS: D.VS, VS0: 5,
        Qp: D.lmh * G.Am * 1000 / 60, muMax: D.muMax, Xmax: D.Xmax, X0: D.X0, tEnd: D.tEnd
      };
      return p;
    }

    function rebuild() {
      traj = integrate(params());
      render();
      paint();
    }

    var paintChart = mkCanvas(canvas, function (ctx, w, h, st) {
      var tr = st.traj;
      if (!tr) return;
      var pad = { l: 50, r: 44, t: 14, b: 36 };
      var yMax = Math.max(tr.pmax * 1.12, 1e-4);
      var dec = yMax >= 10 ? 1 : yMax >= 1 ? 2 : 3;   /* one precision per axis */
      var X = function (t) { return pad.l + t / D.tEnd * (w - pad.l - pad.r); };
      var Y = function (v) { return h - pad.b - v / yMax * (h - pad.t - pad.b); };
      var Yod = function (v) { return h - pad.b - v / 2 * (h - pad.t - pad.b); };

      /* the band a 20 uL neat lane can see: 1-10 ng is 0.05-0.5 ug/mL */
      var yb = Y(0.5), yt = Y(0.05);
      if (yb > pad.t) {
        ctx.fillStyle = "rgba(63,84,104,.08)";
        ctx.fillRect(pad.l, Math.max(pad.t, yb), w - pad.l - pad.r, Math.min(h - pad.b, yt) - Math.max(pad.t, yb));
        ctx.fillStyle = C.slate;
        ctx.font = "9px " + tok("--font-body", "sans-serif");
        ctx.textAlign = "right";
        if (yt - yb > 13) ctx.fillText("1–10 ng in a neat 20 µL lane", w - pad.r - 6, Math.max(pad.t + 10, yb + 11));
      }

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.fillStyle = C.axis;
      ctx.font = "9px " + tok("--font-body", "sans-serif");
      ctx.textAlign = "right";
      for (var k = 0; k <= 4; k++) {
        var v = yMax * k / 4;
        ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke();
        ctx.fillText(v.toFixed(dec), pad.l - 5, Y(v) + 3);
      }
      ctx.textAlign = "left";
      [0, 1, 2].forEach(function (o) { ctx.fillText(o.toFixed(1), w - pad.r + 5, Yod(o) + 3); });

      axes(ctx, w, h, pad, "hours after the pumps start", "ACCD  (µg/mL)");
      ctx.textAlign = "center";
      ctx.fillStyle = C.axis;
      [0, 4, 8, 12, 16, 20, 24].forEach(function (t) { ctx.fillText(String(t), X(t), h - pad.b + 14); });

      function trace(arr, colour, dash, yfn) {
        ctx.save();
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        for (var i = 0; i <= tr.n; i += 2) {
          var x = X(tr.t[i]), y = yfn(arr[i]);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
      trace(tr.X, C.slate, [4, 3], Yod);
      trace(tr.PL, C.leaf, null, Y);
      trace(tr.PS, C.leafLight, null, Y);

      /* the playhead */
      var i0 = Math.min(tr.n, Math.round(st.t / tr.dt));
      var px = X(tr.t[i0]);
      ctx.strokeStyle = C.black;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, h - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      [[tr.PL[i0], C.leaf, Y], [tr.PS[i0], C.leafLight, Y], [tr.X[i0], C.slate, Yod]].forEach(function (d) {
        ctx.beginPath();
        ctx.arc(px, d[2](d[0]), 4, 0, 2 * PI);
        ctx.fillStyle = d[1];
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });
    });

    function paint() { paintChart({ traj: traj, t: tNow }); }

    function render() {
      if (!traj) return;
      var i = Math.min(traj.n, Math.max(0, Math.round(tNow / traj.dt)));
      var od = traj.X[i], pl = traj.PL[i], ps = traj.PS[i];
      var ng = ps * 20;
      set1(read.od, num(od, 2));
      set1(read.lumen, num(pl, pl < 1 ? 3 : 2));
      set1(read.shell, num(ps, ps < 1 ? 3 : 2));
      set1(read.lane, num(ng, ng < 10 ? 2 : 0));
      set1(read.verdictLane, ng >= 200 ? "risks saturation" : ng >= 1 ? "detectable" : "below ECL");
      var Qp = D.lmh * G.Am * 1000 / 60;
      set1(read.tau, num(D.VS / Qp, 0));
      if (clock) clock.textContent = "t + " + tNow.toFixed(2).padStart(5, "0") + " h";
      if (scrub && Math.abs(parseFloat(scrub.value) - tNow) > 1e-6) scrub.value = String(tNow);
    }
    function set1(n, v) { if (n && n.textContent !== v) n.textContent = v; }

    /* controls */
    host.querySelectorAll("[data-pick]").forEach(function (group) {
      var key = group.dataset.pick;
      group.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          D[key] = key === "scen" || key === "mode" ? b.dataset.v : parseFloat(b.dataset.v);
          group.querySelectorAll("button").forEach(function (x) {
            x.setAttribute("aria-pressed", String(x === b));
          });
          if (key === "mode" && note) note.textContent = MODE_NOTE[D.mode];
          rebuild();
        });
      });
    });

    host.querySelectorAll("[data-dslider]").forEach(function (input) {
      var key = input.dataset.dslider;
      var out = host.querySelector('[data-dout="' + key + '"]');
      var dec = parseInt(input.dataset.dec || "0", 10);
      input.addEventListener("input", function () {
        D[key] = parseFloat(input.value);
        if (out) out.textContent = num(D[key], dec);
        rebuild();
      });
      if (out) out.textContent = num(D[key], dec);
    });

    scrub.addEventListener("input", function () {
      tNow = parseFloat(scrub.value);
      stop();
      render();
      paint();
    });

    function stop() {
      playing = false;
      play.textContent = "Run";
      play.classList.remove("btn--go");
    }
    function start() {
      if (tNow >= D.tEnd - 1e-6) tNow = 0;
      playing = true;
      lastTs = 0;
      play.textContent = "Pause";
      play.classList.add("btn--go");
      requestAnimationFrame(step);
    }
    function step(ts) {
      if (!playing) return;
      var dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;
      tNow = Math.min(D.tEnd, tNow + dt * (D.tEnd / 14));   /* 24 h in 14 s */
      render();
      paint();
      if (tNow >= D.tEnd - 1e-6) { stop(); return; }
      requestAnimationFrame(step);
    }
    play.addEventListener("click", function () { playing ? stop() : start(); });

    if (note) note.textContent = MODE_NOTE[D.mode];
    rebuild();
  }

  /* =========================================================================
     PANEL 5  oxygen
     ====================================================================== */
  function panelOxygen() {
    var host = document.getElementById("rig-oxygen");
    if (!host) return;
    var barReq = host.querySelector("[data-bar=req]");
    var barDel = host.querySelector("[data-bar=del]");
    var read = {};
    [].slice.call(host.querySelectorAll("[data-o2]")).forEach(function (n) { read[n.dataset.o2] = n; });
    var verdict = host.querySelector("[data-o2verdict]");

    host.querySelectorAll("[data-oslider]").forEach(function (input) {
      var key = input.dataset.oslider;
      var out = host.querySelector('[data-oout="' + key + '"]');
      var dec = parseInt(input.dataset.dec || "0", 10);
      input.addEventListener("input", function () {
        set(key, parseFloat(input.value));
        if (out) out.textContent = num(S[key], dec);
      });
      if (out) out.textContent = num(S[key], dec);
    });

    on(function (r) {
      var scale = Math.max(r.klaReq, S.klaDel) * 1.15;
      barReq.style.width = (r.klaReq / scale * 100).toFixed(1) + "%";
      barDel.style.width = (S.klaDel / scale * 100).toFixed(1) + "%";
      barReq.dataset.state = r.o2ratio < 0.7 ? "ok" : r.o2ratio < 1 ? "watch" : "fail";
      set2(read.req, num(r.klaReq, 1));
      set2(read.our, num(r.ourVol, 2));
      set2(read.pool, num(r.poolMin, 1));
      set2(read.dcw, num(r.dcw, 2));
      verdict.dataset.state = r.o2ratio < 0.7 ? "ok" : r.o2ratio < 1 ? "watch" : "fail";
      verdict.innerHTML = r.o2ratio < 1
        ? "<b>Required " + num(r.klaReq, 1) + " h⁻¹ against a deliverable " +
          num(S.klaDel, 0) + " h⁻¹.</b> Oxygen supports this density, on an " +
          "unmeasured deliverable kʟa. The number to measure is the deliverable one."
        : "<b>Required " + num(r.klaReq, 1) + " h⁻¹ exceeds the deliverable " +
          num(S.klaDel, 0) + " h⁻¹ by " + num(r.o2ratio, 2) + "×.</b> " +
          "The defensible move is to cap density at what the oxygen supply sustains and " +
          "publish the cap, rather than quote a density the reactor cannot hold.";
    });
    function set2(n, v) { if (n && n.textContent !== v) n.textContent = v; }
  }

  /* =========================================================================
     PANEL 6  power
     ====================================================================== */
  function panelPower() {
    var host = document.getElementById("rig-power");
    if (!host) return;
    var barDraw = host.querySelector("[data-pbar=draw]");
    var barSol = host.querySelector("[data-pbar=sol]");
    var read = {};
    [].slice.call(host.querySelectorAll("[data-pw]")).forEach(function (n) { read[n.dataset.pw] = n; });
    var verdict = host.querySelector("[data-pwverdict]");

    host.querySelectorAll("[data-pslider]").forEach(function (input) {
      var key = input.dataset.pslider;
      var out = host.querySelector('[data-pout="' + key + '"]');
      var dec = parseInt(input.dataset.dec || "0", 10);
      input.addEventListener("input", function () {
        set(key, parseFloat(input.value));
        if (out) out.textContent = num(S[key], dec);
      });
      if (out) out.textContent = num(S[key], dec);
    });

    on(function (r) {
      var scale = Math.max(r.eDay, r.eSol) * 1.15;
      barDraw.style.width = (r.eDay / scale * 100).toFixed(1) + "%";
      barSol.style.width = (r.eSol / scale * 100).toFixed(1) + "%";
      barSol.dataset.state = r.powerRatio > 1.3 ? "ok" : r.powerRatio > 1 ? "watch" : "fail";
      set3(read.eday, num(r.eDay, 0));
      set3(read.esol, num(r.eSol, 0));
      set3(read.ratio, num(r.powerRatio, 2));
      set3(read.need, num(r.panelNeeded, 0));
      verdict.dataset.state = r.powerRatio > 1.3 ? "ok" : r.powerRatio > 1 ? "watch" : "fail";
      verdict.innerHTML = r.powerRatio >= 1
        ? "<b>Harvest covers draw " + num(r.powerRatio, 2) + "× at winter sun.</b> " +
          "A cloudy-day battery still has to be sized on top of this."
        : "<b>Harvest falls " + num((1 - r.powerRatio) * 100, 0) + "% short at winter sun.</b> " +
          "Closing the balance needs a panel of " + num(r.panelNeeded, 0) + " W, or a duty " +
          "cycle that stops the recirculation pump between deliveries.";
    });
    function set3(n, v) { if (n && n.textContent !== v) n.textContent = v; }
  }

  /* =========================================================================
     boot
     ====================================================================== */
  function boot() {
    panelEnvelope();
    panelSchematic();
    panelShear();
    panelOxygen();
    panelPower();
    panelStartup();
    pending = true;
    flush();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
