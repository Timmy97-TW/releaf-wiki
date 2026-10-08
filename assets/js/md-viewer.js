/* =============================================================================
   ReLeaf: the trajectory viewer, on the Molecular Dynamics page itself
   -----------------------------------------------------------------------------
   The nine per-run reports under /md-simulations/ each carry a viewer of their
   own. Timmy asked for the key animations to play on the Protein Design
   Molecular Dynamics page, so this is the same renderer against the compact
   payloads build/md_page_anim.py writes: the receptor stored once as the
   trajectory mean (the apo run is what licenses that), the peptide and the
   four clamp partners animated over 100 frames.

   MARKUP
     <figure class="mdv" data-mdv="wt"
             data-runs="wt:Wild type|chis:+ 6&times;His"
             data-caption="..."></figure>

   `data-mdv` is the run shown first; `data-runs` is optional and adds a toggle.
   Nothing loads until the figure is near the viewport, and nothing animates
   while it is off screen or while the reader has asked for reduced motion.

   Atom order inside a payload is the order the reports use:
     [0, nCa)                receptor C-alpha, static
     [nCa, nCa + nPep)       peptide heavy atoms, animated
     [nCa + nPep, natoms)    the four Asn23 clamp partners, animated
   ========================================================================== */
(function () {
  "use strict";

  var BASE = (document.currentScript && document.currentScript.dataset.base) || "../../";
  var CAL  = { rec: "#7e93a8", pep: "#23684a", amb: "#9a3d22",
               basic: "#4a6f9c", acid: "#a9502f", polar: "#7b8795", apolar: "#aab0b8" };
  var LESS = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cache = {};
  function load(key) {
    if (cache[key]) return cache[key];
    cache[key] = fetch(BASE + "assets/data/md-anim/" + key + ".json")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(decode);
    return cache[key];
  }

  function u16(s) {
    var raw = atob(s), n = raw.length, b = new Uint8Array(n), i;
    for (i = 0; i < n; i++) b[i] = raw.charCodeAt(i);
    return new Uint16Array(b.buffer);
  }
  function u8(s) {
    var raw = atob(s), n = raw.length, b = new Uint8Array(n), i;
    for (i = 0; i < n; i++) b[i] = raw.charCodeAt(i);
    return b;
  }

  function decode(D) {
    var o = D.origin, s = D.scale, i;
    var qr = u16(D.rec), qm = u16(D.mob), qs = u16(D.surf.xyz);
    D.recXYZ = new Float32Array(qr.length);
    for (i = 0; i < qr.length; i++) D.recXYZ[i] = qr[i] * s + o[i % 3];
    D.mobXYZ = new Float32Array(qm.length);
    for (i = 0; i < qm.length; i++) D.mobXYZ[i] = qm[i] * s + o[i % 3];
    D.sXYZ = new Float32Array(qs.length);
    for (i = 0; i < qs.length; i++) D.sXYZ[i] = qs[i] * s + o[i % 3];
    D.sChem = u8(D.surf.chem);
    D.nMob = D.nPep + D.nClamp;
    /* the centre the view turns about: the peptide, not the whole receptor */
    var cx = 0, cy = 0, cz = 0, k;
    for (k = 0; k < D.nPep; k++) { cx += D.mobXYZ[k * 3]; cy += D.mobXYZ[k * 3 + 1]; cz += D.mobXYZ[k * 3 + 2]; }
    D.centre = [cx / D.nPep, cy / D.nPep, cz / D.nPep];
    /* the distance the readout shows, measured once per frame */
    D.dist = new Float32Array(D.nframes);
    for (var f = 0; f < D.nframes; f++) {
      var best = 1e9;
      for (var a = 0; a < D.asn23.length; a++) for (var bI = 0; bI < D.arg487.length; bI++) {
        var p = pos(D, f, D.asn23[a]), q = pos(D, f, D.arg487[bI]);
        var d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        if (d < best) best = d;
      }
      D.dist[f] = best;
    }
    return D;
  }

  function pos(D, f, i) {
    if (i < D.nCa) return [D.recXYZ[i * 3], D.recXYZ[i * 3 + 1], D.recXYZ[i * 3 + 2]];
    var o = (f * D.nMob + (i - D.nCa)) * 3;
    return [D.mobXYZ[o], D.mobXYZ[o + 1], D.mobXYZ[o + 2]];
  }

  /* ------------------------------------------------------------- one viewer */
  function build(fig) {
    var runs = (fig.dataset.runs || "").split("|").filter(Boolean).map(function (r) {
      var p = r.split(":"); return { key: p[0], name: p.slice(1).join(":") };
    });
    var first = fig.dataset.mdv;
    if (!runs.length) runs = [{ key: first, name: "" }];

    fig.classList.add("mdv");
    fig.innerHTML =
      '<div class="mdv__box">' +
        '<div class="mdv__stage"><canvas class="mdv__cv"></canvas>' +
          '<p class="mdv__badge"></p>' +
          '<p class="mdv__hint">drag to turn &#183; scroll to zoom</p>' +
          '<button class="mdv__start" type="button">Play the trajectory</button>' +
          '<p class="mdv__wait" hidden>loading&#8230;</p></div>' +
        '<aside class="mdv__rail">' +
          (runs.length > 1
            ? '<div class="mdv__runs" role="group" aria-label="Which run">' +
              runs.map(function (r, i) {
                return '<button type="button" class="mdv__run" data-key="' + r.key + '"' +
                       (i === 0 ? ' aria-pressed="true"' : ' aria-pressed="false"') +
                       '>' + r.name + '</button>';
              }).join("") + "</div>"
            : '<p class="mdv__only"></p>') +
          '<dl class="mdv__read">' +
            '<div><dt>time</dt><dd class="mdv__t">0.00<small> ns</small></dd></div>' +
            '<div><dt>Asn23 to Arg487</dt><dd class="mdv__d">&#8212;</dd></div>' +
            '<div><dt>clamp, 4 contacts</dt><dd class="mdv__c">&#8212;</dd></div>' +
          "</dl>" +
          '<p class="mdv__say"></p>' +
        "</aside>" +
      "</div>" +
      '<div class="mdv__bar">' +
        '<button class="mdv__play" type="button" aria-label="Play or pause">Pause</button>' +
        '<input class="mdv__scrub" type="range" min="0" max="99" value="0" aria-label="Frame">' +
        '<span class="mdv__fr"></span>' +
        '<span class="mdv__modes">' +
          '<button type="button" data-m="ribbon" aria-pressed="true">Ribbon</button>' +
          '<button type="button" data-m="surface" aria-pressed="false">Pocket</button>' +
        "</span>" +
        '<button class="mdv__spin" type="button" aria-pressed="true">Spin</button>' +
      "</div>" +
      (fig.dataset.caption ? '<figcaption class="ai">' + fig.dataset.caption + "</figcaption>" : "");

    var q    = function (s) { return fig.querySelector(s); },
        cv   = q(".mdv__cv"), ctx = cv.getContext("2d"), stage = q(".mdv__stage"),
        D    = null, mode = "ribbon", frame = 0,
        playing = !LESS, spinning = !LESS, started = false, visible = false,
        rx = -0.32, ry = 0.55, zoom = 1, W = 0, H = 0,
        DPR = Math.min(2, window.devicePixelRatio || 1), raf = 0, cache2 = {};

    function resize() {
      W = stage.clientWidth; H = stage.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      draw();
    }
    window.addEventListener("resize", resize);

    function rot() { return [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry)]; }
    function turn(x, y, z, r) {
      var x1 = x * r[2] + z * r[3], z1 = -x * r[3] + z * r[2];
      return [x1, y * r[0] - z1 * r[1], y * r[1] + z1 * r[0]];
    }

    function project() {
      var r = rot(), c = D.centre, i, p, P = new Float32Array(D.natoms * 3);
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      var key = rx.toFixed(3) + "|" + ry.toFixed(3) + "|" + mode + "|" + zoom + "|" + W + "|" + H;
      var RS = null;
      if (mode === "surface") {
        if (cache2.key === key) RS = cache2.RS;
        else {
          RS = new Float32Array(D.surf.n * 3);
          for (i = 0; i < D.surf.n; i++) {
            p = turn(D.sXYZ[i * 3] - c[0], D.sXYZ[i * 3 + 1] - c[1], D.sXYZ[i * 3 + 2] - c[2], r);
            RS[i * 3] = p[0]; RS[i * 3 + 1] = p[1]; RS[i * 3 + 2] = p[2];
          }
          cache2 = { key: key, RS: RS };
        }
      }
      var R = new Float32Array(D.natoms * 3);
      for (i = 0; i < D.natoms; i++) {
        var a = pos(D, frame, i);
        p = turn(a[0] - c[0], a[1] - c[1], a[2] - c[2], r);
        R[i * 3] = p[0]; R[i * 3 + 1] = p[1]; R[i * 3 + 2] = p[2];
      }
      var scan = function (X, Y) { if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; };
      if (RS) { for (i = 0; i < D.surf.n; i++) scan(RS[i * 3], RS[i * 3 + 1]);
                for (i = D.nCa; i < D.natoms; i++) scan(R[i * 3], R[i * 3 + 1]); }
      else { for (i = 0; i < D.natoms; i++) scan(R[i * 3], R[i * 3 + 1]); }
      var pad = 3,
          s = Math.min(W / (x1 - x0 + 2 * pad), H / (y1 - y0 + 2 * pad)) * 0.92 * zoom,
          mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      for (i = 0; i < D.natoms; i++) {
        P[i * 3] = W / 2 + (R[i * 3] - mx) * s;
        P[i * 3 + 1] = H / 2 - (R[i * 3 + 1] - my) * s;
        P[i * 3 + 2] = R[i * 3 + 2];
      }
      /* two 1-2-1 passes turn the raw C-alpha zigzag into something ribbon-like */
      var n = D.nCa, T, pass, k;
      for (pass = 0; pass < 2; pass++) {
        T = P.slice(0, n * 3);
        for (i = 1; i < n - 1; i++) for (k = 0; k < 3; k++)
          P[i * 3 + k] = 0.25 * T[(i - 1) * 3 + k] + 0.5 * T[i * 3 + k] + 0.25 * T[(i + 1) * 3 + k];
      }
      var SP = null;
      if (RS) {
        SP = new Float32Array(D.surf.n * 3);
        for (i = 0; i < D.surf.n; i++) {
          SP[i * 3] = W / 2 + (RS[i * 3] - mx) * s;
          SP[i * 3 + 1] = H / 2 - (RS[i * 3 + 1] - my) * s;
          SP[i * 3 + 2] = RS[i * 3 + 2];
        }
      }
      return { P: P, SP: SP };
    }

    var RGB = function (h) { return h.match(/\w\w/g).map(function (x) { return parseInt(x, 16); }); };
    function shade(rgb, t) {
      var k = 0.55 + 0.45 * (t + 1) / 2;
      return "rgb(" + rgb.map(function (v) {
        return Math.round(Math.min(255, v * k + (1 - k) * 118));
      }).join(",") + ")";
    }

    function draw() {
      if (!W || !D) return;
      var v = project(), P = v.P, SP = v.SP, i;
      ctx.clearRect(0, 0, W, H);
      var zmin = 1e9, zmax = -1e9, z;
      for (i = 0; i < D.natoms; i++) { z = P[i * 3 + 2]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
      if (SP) for (i = 0; i < D.surf.n; i++) { z = SP[i * 3 + 2]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
      var nz = function (zz) { return (zz - zmin) / (zmax - zmin || 1) * 2 - 1; };
      var cRec = RGB(CAL.rec), cPep = RGB(CAL.pep), cAmb = RGB(CAL.amb),
          CH = [RGB(CAL.basic), RGB(CAL.acid), RGB(CAL.polar), RGB(CAL.apolar)];

      if (SP) {
        var pz = 0, k;
        for (k = 0; k < D.nPep; k++) pz += P[(D.nCa + k) * 3 + 2];
        pz /= D.nPep;
        var ord = [];
        for (i = 0; i < D.surf.n; i++) ord.push(i);
        ord.sort(function (a, b) { return SP[a * 3 + 2] - SP[b * 3 + 2]; });
        for (var oi = 0; oi < ord.length; oi++) {
          i = ord[oi];
          var zz = SP[i * 3 + 2], t = nz(zz), front = zz > pz + 1.5;
          ctx.fillStyle = shade(CH[D.sChem[i]], t);
          ctx.globalAlpha = front ? 0.07 : 0.34 + 0.5 * (t + 1) / 2;
          var rr = (front ? 1 : 1.5) + 1.6 * (t + 1) / 2;
          ctx.fillRect(SP[i * 3] - rr / 2, SP[i * 3 + 1] - rr / 2, rr, rr);
        }
        ctx.globalAlpha = 1;
      }

      var segs = [], tA = SP ? 0.16 : 0.42;
      D.trace.forEach(function (s) { segs.push([s[0], s[1], cRec, 1.4, tA]); });
      D.bonds.forEach(function (s) {
        var isPep = s[0] < D.nCa + D.nPep;
        segs.push([s[0], s[1], isPep ? cPep : cAmb, isPep ? 4.2 : 3, 1]);
      });
      segs.sort(function (u, w) {
        return (P[u[0] * 3 + 2] + P[u[1] * 3 + 2]) - (P[w[0] * 3 + 2] + P[w[1] * 3 + 2]);
      });
      ctx.lineCap = "round";
      segs.forEach(function (s) {
        var t = nz((P[s[0] * 3 + 2] + P[s[1] * 3 + 2]) / 2);
        ctx.strokeStyle = shade(s[2], t);
        ctx.globalAlpha = s[4] * (0.5 + 0.5 * (t + 1) / 2);
        ctx.lineWidth = s[3] * (0.72 + 0.28 * (t + 1) / 2);
        ctx.beginPath();
        ctx.moveTo(P[s[0] * 3], P[s[0] * 3 + 1]);
        ctx.lineTo(P[s[1] * 3], P[s[1] * 3 + 1]);
        ctx.stroke();
      });
      for (var kk = 0; kk < D.nPep; kk++) {
        var ii = D.nCa + kk, tt = nz(P[ii * 3 + 2]);
        ctx.globalAlpha = 0.55 + 0.45 * (tt + 1) / 2;
        ctx.fillStyle = shade(cPep, tt);
        ctx.beginPath();
        ctx.arc(P[ii * 3], P[ii * 3 + 1], 1.9 * (0.7 + 0.3 * (tt + 1) / 2), 0, 6.3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* the one measured distance, drawn where it is measured */
      var best = 1e9, ba = D.asn23[0], bb = D.arg487[0];
      D.asn23.forEach(function (a) {
        D.arg487.forEach(function (b2) {
          var p1 = pos(D, frame, a), p2 = pos(D, frame, b2);
          var d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]);
          if (d < best) { best = d; ba = a; bb = b2; }
        });
      });
      var ok = best <= 4;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = ok ? "#23684a" : "#9a3d22";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(P[ba * 3], P[ba * 3 + 1]);
      ctx.lineTo(P[bb * 3], P[bb * 3 + 1]);
      ctx.stroke();
      ctx.setLineDash([]);
      var mx2 = (P[ba * 3] + P[bb * 3]) / 2, my2 = (P[ba * 3 + 1] + P[bb * 3 + 1]) / 2,
          lbl = best.toFixed(2) + " Å";
      ctx.font = "600 12px ui-monospace,Menlo,monospace";
      var tw = ctx.measureText(lbl).width;
      ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.9;
      ctx.fillRect(mx2 + 8, my2 - 19, tw + 10, 17);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ok ? "#23684a" : "#9a3d22";
      ctx.fillText(lbl, mx2 + 13, my2 - 6);
    }

    function readout() {
      var d = D.dist[frame], ok = d <= 4;
      q(".mdv__t").innerHTML = D.frameNs[frame].toFixed(2) + "<small> ns</small>";
      var dd = q(".mdv__d");
      dd.textContent = d.toFixed(2) + " Å";
      dd.className = "mdv__d " + (ok ? "is-on" : "is-off");
      var c = D.clamp && D.clamp.length > frame ? Math.round(D.clamp[frame]) : null;
      q(".mdv__c").textContent = c === null ? "—" : c + " / 4";
      q(".mdv__fr").textContent = "frame " + (frame + 1) + " / " + D.nframes;
    }

    var last = 0;
    function tick(ts) {
      raf = requestAnimationFrame(tick);
      if (!D || !visible) return;
      if (playing && ts - last > 90) {
        frame = (frame + 1) % D.nframes; last = ts;
        q(".mdv__scrub").value = frame; readout();
      }
      if (spinning) { ry += 0.0016; cache2 = {}; }
      draw();
    }

    function show(key) {
      q(".mdv__wait").hidden = false;
      q(".mdv__start").hidden = true;
      load(key).then(function (data) {
        D = data; frame = 0; cache2 = {};
        q(".mdv__wait").hidden = true;
        q(".mdv__scrub").max = D.nframes - 1;
        q(".mdv__badge").textContent = D.label;
        q(".mdv__say").textContent = D.reading;
        var only = q(".mdv__only"); if (only) only.textContent = D.label;
        resize(); readout();
        if (!raf) raf = requestAnimationFrame(tick);
      }).catch(function () {
        q(".mdv__wait").hidden = true;
        q(".mdv__start").hidden = false;
        q(".mdv__start").textContent = "The trajectory did not load";
      });
    }

    q(".mdv__start").addEventListener("click", function () { started = true; show(first); });
    q(".mdv__play").addEventListener("click", function () {
      playing = !playing; this.textContent = playing ? "Pause" : "Play";
    });
    q(".mdv__scrub").addEventListener("input", function () {
      if (!D) return;
      frame = +this.value; playing = false;
      q(".mdv__play").textContent = "Play"; readout(); draw();
    });
    q(".mdv__spin").addEventListener("click", function () {
      spinning = !spinning; this.setAttribute("aria-pressed", String(spinning));
    });
    fig.querySelectorAll(".mdv__modes button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        mode = btn.dataset.m; cache2 = {};
        fig.querySelectorAll(".mdv__modes button").forEach(function (o) {
          o.setAttribute("aria-pressed", String(o === btn));
        });
        q(".mdv__hint").textContent = mode === "surface"
          ? "the pocket surface is the mean receptor, so it does not move"
          : "drag to turn · scroll to zoom";
        draw();
      });
    });
    fig.querySelectorAll(".mdv__run").forEach(function (btn) {
      btn.addEventListener("click", function () {
        fig.querySelectorAll(".mdv__run").forEach(function (o) {
          o.setAttribute("aria-pressed", String(o === btn));
        });
        show(btn.dataset.key);
      });
    });

    var drag = false, px = 0, py = 0;
    stage.addEventListener("pointerdown", function (e) {
      if (!D) return;
      drag = true; px = e.clientX; py = e.clientY;
      stage.classList.add("is-drag"); stage.setPointerCapture(e.pointerId);
      spinning = false; q(".mdv__spin").setAttribute("aria-pressed", "false");
    });
    stage.addEventListener("pointermove", function (e) {
      if (!drag) return;
      ry += (e.clientX - px) * 0.008;
      rx = Math.max(-1.5, Math.min(1.5, rx + (e.clientY - py) * 0.008));
      px = e.clientX; py = e.clientY; cache2 = {}; draw();
    });
    window.addEventListener("pointerup", function () { drag = false; stage.classList.remove("is-drag"); });
    stage.addEventListener("wheel", function (e) {
      if (!D) return;
      e.preventDefault();
      zoom = Math.max(0.45, Math.min(6, zoom * (e.deltaY > 0 ? 0.92 : 1.09)));
      cache2 = {}; draw();
    }, { passive: false });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          visible = en.isIntersecting;
          if (en.isIntersecting && !started && !LESS) { started = true; show(first); }
        });
      }, { rootMargin: "200px" }).observe(fig);
    } else {
      visible = true;
    }
  }

  function start() {
    var figs = document.querySelectorAll("[data-mdv]");
    if (!figs.length) return;
    figs.forEach(build);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
