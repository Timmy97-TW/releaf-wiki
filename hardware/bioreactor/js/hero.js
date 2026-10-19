// Bioreactor opening scene (V4 "Follow the culture"), VIDEO MODE (10 Oct 2026).
//
// The scene runs in one of two modes (../../js/hero-mode.js decides which; dev/hero-video/README.md):
//   live3d  the WebGL story itself: js/story.js on js/b2-core.js etc., copied from dev/bioreactor-hero by
//           tools/b2web/sync_v4.py. It draws the picture AND its own DOM (captions, labels, route, closing line).
//   video   this file: the pre-rendered clip of that story, scrubbed by the scroll (../../js/scrub-video.js), with the
//           story's DOM drawn live over it from baked data, so three.js and the model are never fetched.
//
// The data, both generated, never edited by hand:
//   js/hero-clips.js   window.HERO_CLIPS: the house clip data (frames, fps, each clip's reference viewport `css`),
//                      written by the clip renderer (dev/hero-video/tools/capture.py or its V4 equivalent).
//   js/hero-v4dom.js   window.HERO_V4DOM: what V4's own code put on the stage at each frame of each clip, recorded from
//                      the live3d page at the clips' reference viewports by tools/b2web/bake_v4dom.py, kept at adaptive
//                      keyframes (a track is {f: [frames], v: [values]}, linear between them, within 0.4 px):
//                        caps, titleOut                  story-core's captions and title fade (V4's CAPS)
//                        defs                            the labels (V4's initLabels markup)
//                        <clip>.q                        track: the story's own time (V4's warp of the scroll)
//                        <clip>.op.{frame,stats,endline,keynote,scrim}   tracks: the fades (V4's sceneDom)
//                        <clip>.route.{on,prog}, .cur    tracks; runs [[f, code], ...]; <clip>.rtext{code: html}
//                        <clip>.lab: [{i, f0, f1, side, ti?, ki?, f: [keys], v: [[a, ax, ay, lx, ly, ring,
//                                     (ca, cx, cy, cang)], ...]}, ...]   the labels' layout (V4's labelsAt), ref CSS px
// The labels are laid out in the clip's reference viewport and moved with the clip as it is scaled to cover the stage:
// each anchor goes where its point of the picture went, each label keeps its offset from the anchor in screen px (the
// type is not scaled), and is clamped into the real stage as V4 clamps it.
window.HERO = (function () {
  "use strict";

  const D = window.HERO_V4DOM || null;
  const stage = document.querySelector(".story-stage");
  const track = document.querySelector(".story");
  const $ = function (id) { return document.getElementById(id); };
  const EL = { frame: $("frame"), stats: $("stats"), endline: $("endline"), keynote: $("keynote"), scrim: $("scrim") };
  const ss = function (a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function vis(el, a) {
    if (!el) return;
    el.style.opacity = a.toFixed(3);
    el.style.visibility = a > 0.003 ? "visible" : "hidden";
  }

  /* ---------------------------------------------------------------------- the baked tracks */
  let N = (D && D.frames) || 1001;
  function clipData(kind) { return (D && D[kind]) || (D && D.desktop) || null; }
  // runs [[f, v], ...]: the value set at the last change at or before frame f
  function run(tr, f) {
    if (!tr || !tr.length) return 0;
    let lo = 0, hi = tr.length - 1;
    if (f < tr[0][0]) return tr[0][1];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr[m][0] <= f) lo = m; else hi = m; }
    return tr[hi][0] <= f ? tr[hi][1] : tr[lo][1];
  }
  // a keyframed track {f, v} at frame x (fractional allowed): linear between the keys either side
  function trk(T, x) {
    if (!T || !T.f || !T.f.length) return 0;
    const F = T.f, V = T.v, n = F.length;
    if (x <= F[0]) return V[0];
    if (x >= F[n - 1]) return V[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m] <= x) lo = m; else hi = m; }
    return V[lo] + (V[hi] - V[lo]) * (x - F[lo]) / (F[hi] - F[lo]);
  }
  // the story's time q at the scroll's p, through the clip's own warp
  function qAt(kind, p) {
    const C = clipData(kind);
    if (!C || !C.q) return p;
    return trk(C.q, Math.max(0, Math.min(N - 1, p * (N - 1))));
  }

  /* ------------------------------------------------------------------------------ the labels */
  // V4's initLabels markup, rebuilt from the bake: a .lb label in #marks and its leader group in svg#leaders
  const LBL = [];
  const SVGNS = "http://www.w3.org/2000/svg";
  function initLabels() {
    const host = $("marks"), leaders = $("leaders");
    if (!D || !D.defs || !host || !leaders) return;
    D.defs.forEach(function (d) {
      const el = document.createElement("div");
      el.className = d.cls; el.id = "lb-" + d.id; el.innerHTML = d.html;
      host.appendChild(el);
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", d.gcls); g.innerHTML = D.gtpl;
      leaders.appendChild(g);
      LBL.push({ el: el, g: g, h: g.children[0], l: g.children[1], rh: g.children[2], r: g.children[3], dt: g.children[4], cv: g.children[5],
                 k: el.querySelector(".k"), n: el.querySelector(".n"), k0: el.querySelector(".k") ? el.querySelector(".k").innerHTML : "",
                 txt: el.querySelector(".n") ? el.querySelector(".n").innerHTML : "", w: 0, hgt: 0, nMid: 0, rt: false, shown: false });
    });
    const measure = function () {
      LBL.forEach(function (L) { L.w = L.el.offsetWidth; L.hgt = L.el.offsetHeight; L.nMid = L.n ? L.n.offsetTop + L.n.offsetHeight / 2 : 10; });
    };
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("resize", function () { setTimeout(measure, 0); });
  }
  // the labels on screen at frame f: [f, i, a, ax, ay, lx, ly, side, ring, ca, cx, cy, cang, ti, ki] per label
  function labelRows(C, f) {
    const out = [];
    if (!C || !C.lab) return out;
    C.lab.forEach(function (S) {
      if (f < S.f0 || f > S.f1) return;
      const F = S.f, n = F.length;
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m] <= f) lo = m; else hi = m; }
      const u = F[hi] > F[lo] ? Math.max(0, Math.min(1, (f - F[lo]) / (F[hi] - F[lo]))) : 0;
      const a = S.v[lo], b = S.v[hi], v = a.map(function (x, k) { return x + (b[k] - x) * u; });
      const row = [f, S.i, v[0], v[1], v[2], v[3], v[4], S.side, v[5]];
      if (v.length > 6 || S.ti !== undefined) row.push(v[6] || 0, v[7] || 0, v[8] || 0, v[9] || 0);
      if (S.ti !== undefined) row.push(S.ti, S.ki);
      out.push(row);
    });
    return out;
  }
  // reference CSS px -> stage px, from the part of the reference viewport the clip shows on this stage
  function mapper(player) {
    const v = player.visibleRef && player.visibleRef();
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!v) return { k: 1, x0: 0, y0: 0, W: W, H: H };
    return { k: W / Math.max(1e-6, v.x1 - v.x0), x0: v.x0, y0: v.y0, W: W, H: H };
  }
  function applyLabels(kind, f, M) {
    const C = clipData(kind), rows = labelRows(C, f), seen = {};
    const port = stage.clientWidth / Math.max(1, stage.clientHeight) < 0.8;
    rows.forEach(function (r) {
      const L = LBL[r[1]];
      if (!L) return;
      seen[r[1]] = 1;
      const a = r[2], side = r[7], ring = r[8];
      // the text of the "next stop" label changes with the leg
      if (r.length > 13 && C) {
        const txt = C.txt[r[13]], kick = C.kick[r[14]];
        if (L.txt !== txt) { L.n.innerHTML = txt; L.txt = txt; if (L.k) L.k.innerHTML = kick || L.k0; L.w = L.el.offsetWidth; }
      }
      // the anchor moves with the picture; the label keeps its screen offset from it, clamped into the stage
      const ax = (r[3] - M.x0) * M.k, ay = (r[4] - M.y0) * M.k;
      let lx = ax + (r[5] - r[3]), ly = ay + (r[6] - r[4]);
      const w = L.w || 160, x0 = side > 0 ? lx + 8 : lx - 8 - w;
      lx += Math.max(16, Math.min(M.W - 16 - w, x0)) - x0;
      const yTop = ly - (L.nMid || 20);
      // (17 Oct 2026: labels start at 118 px on a desk (was 80) and 152 px in portrait (was 100), below the route line,
      // which now runs beside the Back button on a desk and under the Back and Skip row on a phone, css/record-edit.css;
      // the same in js/story.js)
      ly += Math.max(port ? 152 : 118, Math.min(M.H - (L.hgt || 50) - 16, yTop)) - yTop;
      // V4's applyLabels from here on
      const e = ss(0, 1, a), te = e;     // (V4 round 4b, QA 5 / visual 10: the text and its leader fade on one curve)
      const x = side > 0 ? lx + 8 : lx - 8 - L.w, y = ly - L.nMid + (1 - te) * 5;
      L.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      L.el.style.opacity = te.toFixed(3); L.el.style.visibility = "visible";
      if (L.rt !== (side < 0)) { L.rt = side < 0; L.el.classList.toggle("rt", L.rt); }
      const dy = ly - ay, dxs = lx - ax, sg = dxs === 0 ? side : Math.sign(dxs);
      const kx = ax + sg * Math.min(Math.abs(dy), Math.abs(dxs) * 0.7);
      const d = "M" + ax.toFixed(1) + "," + ay.toFixed(1) + "L" + kx.toFixed(1) + "," + ly.toFixed(1) + "L" + lx.toFixed(1) + "," + ly.toFixed(1);
      const len = Math.hypot(kx - ax, ly - ay) + Math.abs(lx - kx) + 1;
      [L.h, L.l].forEach(function (pa) {
        pa.setAttribute("d", d); pa.style.strokeDasharray = len.toFixed(1) + " " + (len + 10).toFixed(1);
        pa.style.strokeDashoffset = ((1 - e) * len).toFixed(1); pa.style.opacity = ring.toFixed(3);
      });
      [L.rh, L.r, L.dt].forEach(function (ci) { ci.setAttribute("cx", ax.toFixed(1)); ci.setAttribute("cy", ay.toFixed(1)); ci.style.opacity = ring.toFixed(3); });
      // the edge pointer of an off-screen next stop: clamped to the stage's own safe frame
      if (r.length > 9 && r[9] > 0.003) {
        const cx = Math.max(64, Math.min(M.W - 64, (r[10] - M.x0) * M.k)), cy = Math.max(port ? 160 : 112, Math.min(M.H - 170, (r[11] - M.y0) * M.k));
        L.cv.style.opacity = r[9].toFixed(3);
        L.cv.setAttribute("transform", "translate(" + cx.toFixed(1) + "," + cy.toFixed(1) + ") rotate(" + (r[12] * 180 / Math.PI).toFixed(1) + ")");
      } else L.cv.style.opacity = "0";
      L.g.style.opacity = e.toFixed(3); L.g.style.visibility = "visible";
      L.shown = true;
    });
    LBL.forEach(function (L, i) {
      if (seen[i] || !L.shown) return;
      L.shown = false;
      L.el.style.visibility = "hidden"; L.el.style.opacity = "0"; L.g.style.visibility = "hidden"; L.g.style.opacity = "0";
    });
  }

  /* ------------------------------------------------------------------------------- the route */
  const R = { el: $("route"), m: $("route-m"), mt: $("route-m-t"), bar: $("route-m-bar"), dot: $("route-dot"), fill: $("route-fill"),
              line: $("route-line"), li: [], cur: -1, r0: 0, r5: 0 };
  if (R.el) R.li = Array.prototype.slice.call(R.el.querySelectorAll("li"));
  function applyRoute(kind, f) {
    const C = clipData(kind);
    if (!R.el || !R.m) return;
    const on = C && C.route ? trk(C.route.on, f) : 0;
    R.el.style.opacity = on.toFixed(3); R.m.style.opacity = on.toFixed(3);
    R.el.style.visibility = R.m.style.visibility = on > 0.003 ? "visible" : "hidden";
    if (on <= 0.003) return;
    const prog = trk(C.route.prog, f), code = run(C.route.cur, f), cur = code % 10, green = code >= 10;
    if (R.cur !== code) {
      R.cur = code;
      R.li.forEach(function (li, i) { li.className = (i === cur ? "on" : i < cur ? "done" : "") + (i === 5 ? " out" : ""); });
      R.el.classList.toggle("g", green); R.m.classList.toggle("g", green);
      if (C.rtext && C.rtext[code] !== undefined && R.mt) R.mt.innerHTML = C.rtext[code];
    }
    if (!R.r0 && R.li.length > 5) {
      const a = R.li[0], b = R.li[5];
      R.r0 = a.offsetTop + a.offsetHeight / 2; R.r5 = b.offsetTop + b.offsetHeight / 2;
      if (R.line) { R.line.style.top = R.r0 + "px"; R.line.style.height = (R.r5 - R.r0) + "px"; }
    }
    const y = R.r0 + (R.r5 - R.r0) * Math.min(5, prog) / 5;
    if (R.dot) R.dot.style.transform = "translateY(" + y.toFixed(1) + "px)";
    if (R.fill) { R.fill.style.top = R.r0.toFixed(1) + "px"; R.fill.style.height = Math.max(0, y - R.r0).toFixed(1) + "px"; }
    if (R.bar) R.bar.style.width = (Math.min(5, prog) / 5 * 100).toFixed(1) + "%";
  }

  /* ------------------------------------------------------------------------- the stage's DOM */
  function dom(player, kind, p) {
    const C = clipData(kind);
    const f = Math.max(0, Math.min(N - 1, Math.round(p * (N - 1))));
    if (C && C.op) {
      vis(EL.frame, trk(C.op.frame, f)); vis(EL.stats, trk(C.op.stats, f)); vis(EL.endline, trk(C.op.endline, f)); vis(EL.keynote, trk(C.op.keynote, f));
      // the caption scrim follows the captions, the title and the end line (V4 round 4b: sceneDom)
      if (EL.scrim) EL.scrim.style.opacity = (C.op.scrim ? trk(C.op.scrim, f) : 1).toFixed(3);
    }
    else { const a = 1 - ss(0.0, 0.03, p); vis(EL.frame, a); vis(EL.stats, a); vis(EL.keynote, a); vis(EL.endline, ss(0.97, 0.99, p)); }
    // the labels follow the picture: the frame actually on screen when the player knows it
    let fl = f;
    const hv = window.__heroVideo && window.__heroVideo.frame ? window.__heroVideo.frame() : null;
    if (hv && hv.presented >= 0 && hv.presented < N && hv.kind === kind) fl = hv.presented;
    applyLabels(kind, fl, mapper(player));
    applyRoute(kind, f);
  }

  // the topbar's blur is off while the stage covers the top of the screen (b2-core's pinCheck, for the live3d mode)
  function pinCheck() {
    const pin = stage.getBoundingClientRect().bottom > 96;
    if (pin !== pinCheck.on) { document.body.classList.toggle("hero-pinned", pin); pinCheck.on = pin; }
  }

  /* ------------------------------------------------------------------------------ video mode */
  function video() {
    const clips = window.HERO_CLIPS || {};
    if (clips.frames) N = clips.frames;
    if (D && D.frames && clips.frames && D.frames !== clips.frames)
      console.warn("hero: the DOM data has " + D.frames + " frames, the clips " + clips.frames + "; re-bake js/hero-v4dom.js");
    const hasAurora = !!((clips.desktop && clips.desktop.aurora) || (clips.phone && clips.phone.aurora));
    const player = ScrubVideo({
      stage: stage, story: track,
      replace: [$("gl")],
      data: clips,
      overlays: hasAurora ? ["aurora"] : [],
      // b2-core's composite: the page's blue aurora, gamma 1.25, exposure 1.02, vignette 0.38
      aurora: { col: "#3f86e6", gamma: 1.25, exposure: 1.02, vignette: 0.38 },
      breath: 0,                 // V4's camera is a pure function of p: no breath to add back
    });
    const kindNow = function () { return player.frame.dataset.clip || "desktop"; };
    initLabels();
    let pScroll = 0, pShow = 0;
    const story = Story({
      stage: stage, track: track, hud: $("hud"), caps: (D && D.caps) || [], rail: true,
      title: $("title"), cue: $("cue"), loader: $("loader"), pct: $("load-pct"),
      titleOut: D && D.titleOut !== undefined ? D.titleOut : 0.06,
      // story-core-v4 hands the scroll's p to the warp first and draws at the story's time q; the clip is indexed by p
      // 18 Oct 2026: everything drawn over the clip (captions, labels, route, fades) follows the frame on screen
      // (player.follow); only the clip's seek goes to the scroll's p
      warp: function (p) { pScroll = p; pShow = player.follow(p); return qAt(kindNow(), pShow); },
      draw: function (q, clock) {
        player.draw(pScroll, clock);
        dom(player, kindNow(), pShow);
      },
    });
    // the protectant's caption in the green (V4's ready(): CAPS[i].loop)
    if (D && D.caps) Array.prototype.forEach.call(document.querySelectorAll("#hud .cap"), function (el, i) {
      if (D.caps[i] && D.caps[i].loop) el.classList.add(D.caps[i].loop);
    });
    window.addEventListener("scroll", pinCheck, { passive: true }); pinCheck();
    player.onProgress(story.progress);
    player.onReady(story.ready);
    player.preload(window.__story.p);
    window.__v4dom = { data: D, qAt: function (p) { return qAt(kindNow(), p); }, kind: kindNow };
    return story;
  }

  return { video: video, qAt: qAt };
})();
