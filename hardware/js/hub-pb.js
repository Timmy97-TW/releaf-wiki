// The photograph bench (V3) as a component: the bench render as a chooser. Used by dev/bench/v3-tower/index.html (its
// own page) and by the hub's v10 (dev/hub-variants: build.py copies this file), so everything is scoped to the .pb element.
// This is V3-tower's copy (dev/bench/v3-tower: the commercial tower as the centrepiece). It still reads V3's data.
//
// Round 28 (hub v10, 8 Oct 2026: the owner, "it should blend nicer from landing screen and fill the entire screen, also
// add a bubble or zoom in for photometer"):
//   - the photo COVERS its stage, edge to edge, cropped to the window while the band the instruments occupy stays in
//     view; the render is 3840 x 1600 (the 2560 frame with more room at both sides). It slides sideways (never cutting
//     the band) until no instrument, pin or bubble is under the heading's words;
//   - the photometer has a persistent bubble: a sharp close-up of its head (the same camera and light), ringed in its
//     colour over the room beside the tower, joined by a leader to a ring round what it shows; chosen, it pulls back to
//     the photometer opened along its light path and the ring widens with it;
//   - in a section, the photo comes out of the page's dark as it scrolls into place: its top dissolves into the dark
//     above and the room's light comes up (--pb-in, 0..1); the pins and the bubble arrive once it is nearly in place;
//   - a window too narrow for the band at full height (a phone upright, a tablet upright) stacks: heading, the photo
//     fitted to the band, the list.
// Round 28, round 1 (two judges): no half-transparent states (a class, pb-ui-on, with a timed fade); the bioreactor's pin
// on the roof beside the cap; the band kept clear of the navbar's room and of the list and note; the photo kept inside
// the part of the set with no end of it in view (data `clean`), faded into the page beyond where a window is wider;
// the photo's own edges feathered only where they are inside the stage; the heading and the list step left together;
// the ring and leader as two states; a compact touch card beside its pin; a phone on its side not stacked; the texture
// taken from the <img> (not fetched twice) and uploaded in strips across frames; Tab into the list brings the bench on.
//   <div class="pb" data-mode="page|section" data-base="" data-head=".hd" [data-keepout=".versions"]>
//     page     the photo fills the screen
//     section  the photo fills the host section, which sizes it; the WebGL runs only while it is on screen, and
//              nothing loads until it is near
//     base     where img/ and data/ are (the hub: /dev/bench/v3-tower/)
//     head     the heading that sits over the photo: no instrument, pin, card or bubble goes under its words
//
// Everything placed on the photo is computed from the Blender camera that made it (blender/render.py, post.py):
//   img/masks.png  R bioreactor (photometer included), G photometer, B LPA (left half) / floating plate (right half)
//   img/glow.png   the same three, blurred: the outer glow of a highlighted instrument
//   img/loop.png   R the culture reservoir, G the culture loop's tubes (as seen 1.0, hidden behind parts 0.4), B their halo
//   img/flow.png   R/G: s, the position round the culture loop in its flow direction (16 bit), spread round the tubes
//   img/hit.png    which instrument a point belongs to, generous, for the pointer (and for keeping words off them)
//   data/bench.json  image sizes, the crops' boxes, anchors (flow cell, LED, roof...), each instrument's bounds, `clean`
// One WebGL2 pass composites the photo with them: the rest of the bench dims, the chosen instrument lifts and glows,
// and parcels of culture run round the loop through the photometer's flow cell. Without WebGL2 the photo, the pins,
// the bubble and the list still work.
(function () {
  "use strict";
  const root = document.querySelector(".pb");
  if (!root) return;

  const INST = {
    lpa:         { n: "01", label: "LPA", role: "LED array", stat: "24", statL: "cultures at once", c: "#3ddc8b" },
    bioreactor:  { n: "02", label: "Bioreactor", role: "Perfusion", stat: "300", statL: "mL working volume", c: "#5aa9ff" },
    photometer:  { n: "03", label: "Photometer", role: "In-line OD600", stat: "0.2", statL: "mm light path", c: "#ffa23d", loop: true },
    hydroponics: { n: "04", label: "Hydroponics", role: "Growth plate", stat: "13", statL: "seed positions", c: "#b18cff" },
  };
  const SLOT = { bioreactor: 0, photometer: 1, lpa: 2, hydroponics: 3 };   // uH = (bioreactor, photometer, lpa, plate)
  const HIT = [null, "bioreactor", "photometer", "lpa", "hydroponics"];

  const $ = (s, r) => (r || root).querySelector(s);
  const SECTION = root.dataset.mode === "section";
  const BASE = root.dataset.base || "";
  const headEl = root.dataset.head ? document.querySelector(root.dataset.head) : null;
  const keepEls = root.dataset.keepout ? Array.from(document.querySelectorAll(root.dataset.keepout)) : [];
  const stage = $(".pb-stage"), photo = $(".pb-photo"), canvas = $(".pb-fx"), pinsEl = $(".pb-pins"), card = $(".pb-card");
  const loupe = $(".pb-loupe"), lensCut = $(".pb-lens.pb-cut"), lensOut = $(".pb-lens:not(.pb-cut)");
  const lines = $(".pb-lines"), lead = $(".pb-lines line"), ring = $(".pb-lines circle"), note = $(".pb-note");
  const bubble = $(".pb-bubble"), bOut = $(".pb-b-out"), bCut = $(".pb-b-cut");
  const list = $(".pb-list"), listLinks = Array.from(root.querySelectorAll(".pb-list a[data-k]"));
  listLinks.forEach(function (a) { INST[a.dataset.k].page = a.getAttribute("href"); });   // the host's own links
  if (bubble) INST.photometer.page = INST.photometer.page || bubble.getAttribute("href");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phoneMQ = window.matchMedia("(max-width: 760px)");
  const shortLandMQ = window.matchMedia("(max-height: 500px) and (orientation: landscape)");   // a phone on its side
  if (reduced) root.classList.add("pb-rm");

  let D = null;                      // data/bench.json
  let view = { ox: 0, oy: 0, iw: 1, ih: 1, s: 1, vw: 1, vh: 1 };
  let hit = null;                    // { w, h, data }
  let active = null, activeSrc = null, pointerUV = null, touchArmed = null;
  let G = null;                      // WebGL state
  const H = [0, 0, 0, 0], tH = [0, 0, 0, 0];
  let loopV = 0, loopT = 0, clock = 0, intro = null, introDone = false, raf = 0, lastT = 0, onScreen = !SECTION, seen = !SECTION;
  let cropImg = null, cardBox = null, bubbleBox = null, stacked = false;
  const url = (p) => /^(\/|https?:)/.test(p) ? p : BASE + p;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const BUBBLE = () => !!(bubble && D && D.bubble);
  // the bubble's side: the room right of the tower unless only the left has space (a review can force one: ?bubble=left)
  const SIDE_BIAS = 600, FORCE_SIDE = /[?&]bubble=left/.test(location.search) ? 1 : /[?&]bubble=right/.test(location.search) ? 0 : -1;
  const pk = () => parseFloat(getComputedStyle(root).getPropertyValue("--pb-k")) || 1;     // the hub's scale (--hub-k)

  /* ------------------------------------------------------------------ the view: where the image sits */
  function rel(r, st) { return [r.left - st.left, r.top - st.top, r.right - st.left, r.bottom - st.top]; }
  function ov(p, q) { return Math.max(0, Math.min(p[2], q[2]) - Math.max(p[0], q[0])) * Math.max(0, Math.min(p[3], q[3]) - Math.max(p[1], q[1])); }
  // the heading's ink, not its box: the lines of text it actually covers
  function textBox(el, st) {
    if (!el) return null;
    const b = [1e9, 1e9, -1e9, -1e9];
    el.querySelectorAll("h1, h2, p").forEach(function (n) {
      const rg = document.createRange(); rg.selectNodeContents(n);
      Array.from(rg.getClientRects()).forEach(function (r) {
        if (!r.width) return;
        b[0] = Math.min(b[0], r.left - st.left); b[1] = Math.min(b[1], r.top - st.top);
        b[2] = Math.max(b[2], r.right - st.left); b[3] = Math.max(b[3], r.bottom - st.top);
      });
    });
    return b[0] < 1e9 ? [b[0] - 10, b[1] - 8, b[2] + 10, b[3] + 8] : null;
  }
  function noteAbs() { return note && getComputedStyle(note).position === "absolute" && getComputedStyle(note).display !== "none"; }
  function keepouts(st) {
    const k = [];
    const h = textBox(headEl, st); if (h && h[3] > 0) k.push(h);
    keepEls.concat(noteAbs() ? [note] : []).forEach(function (e) {
      const r = e.getBoundingClientRect(); if (r.width) { const q = rel(r, st); k.push([q[0] - 8, q[1] - 6, q[2] + 8, q[3] + 6]); }
    });
    return k;
  }
  // which instrument is at image point (u, v): the hit map once it is in, the bounds before
  function instAt(u, v) {
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
    if (hit) return Math.round(hit.data[(Math.floor(v * hit.h) * hit.w + Math.floor(u * hit.w)) * 4] / 60);
    if (!D) return 0;
    for (const k in D.bounds) { const b = D.bounds[k]; if (u >= b[0] && u <= b[2] && v >= b[1] && v <= b[3]) return HIT.indexOf(k); }
    return 0;
  }
  // how much of a screen box (or circle) lies on an instrument, under a candidate view: sampled every `step` px
  function onInst(box, V, step, circle) {
    let n = 0;
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, r2 = Math.pow((box[2] - box[0]) / 2, 2);
    for (let y = box[1] + step / 2; y < box[3]; y += step) for (let x = box[0] + step / 2; x < box[2]; x += step) {
      if (circle && (x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue;
      if (instAt((x - V.ox) / V.iw, (y - V.oy) / V.ih)) n++;
    }
    return n;
  }

  /* ------------------------------------------------------------------ pins: where they stand */
  function anchorOf(k) {
    const b = D.bounds[k];
    if (k === "photometer") return [D.anchors.led[0], Math.min(D.anchors.led[1], b[1] + 0.004)];
    // on the tower's roof beside its cap (round 1: above the cap it ran up under the wiki's navbar)
    if (k === "bioreactor") return D.anchors.roof ? D.anchors.roof.slice() : [(b[0] + b[2]) / 2 + 0.02, b[1]];
    // on the tub's top right corner, its label running right, clear of the wall socket behind the tub (round 1, design
    // judge #8: centred over the tub it sat on the socket's plate)
    // (a phone: over the tub's left corner, clear of the socket's plate and of the bubble's chip above; round 2, D9)
    // (stacked and wider: over the tub's middle; its label would run off the screen's edge from the corner)
    if (k === "hydroponics") return stacked ? (view.vw < 600 ? [b[0] + 0.05 * (b[2] - b[0]), b[1]] : [(b[0] + b[2]) / 2, b[1]]) : [b[2] - 0.006, b[1] + 0.004];
    return [(b[0] + b[2]) / 2, b[1]];
  }
  const PIN_R = 14;                  // a pin whose label runs right of its hairline: the hairline this far into the label
  function leadOf(k) { return stacked ? 8 : k === "hydroponics" ? 8 : k === "bioreactor" ? 8 : 14; }
  function pinH() { return stacked ? 22 : 26 * pk(); }
  // the pins' boxes under a candidate view (each sits on its instrument, its label above its hairline)
  function pinBoxes(V) {
    if (!D) return [];
    return Object.keys(INST).filter(function (k) { return !(k === "photometer" && BUBBLE()); }).map(function (k) {
      const a = anchorOf(k), x = V.ox + a[0] * V.iw, y = V.oy + a[1] * V.ih;
      const p = pinsEl.querySelector('.pb-pin[data-k="' + k + '"] b'), w = p && p.offsetWidth ? p.offsetWidth : 130 * pk();
      const l = k === "hydroponics" && !stacked ? x - PIN_R : x - w / 2;           // (its label runs right)
      return [l - 6, y - 4 - leadOf(k) - pinH() - 4, l + w + 6, y - 2];
    });
  }

  function decideStack(st) {
    // a window too narrow for the band at full height stacks (a phone upright; a tablet upright; a tall narrow window)
    if (phoneMQ.matches && !shortLandMQ.matches) return true;
    if (!D) return false;
    // (the height it would have unstacked, one screen, not the stage's now: stacked, the stage is shorter, and a test
    // against that would flip it back and forth)
    const F = D.frame, full = shortLandMQ.matches ? (window.innerHeight || st.height) : Math.max(window.innerHeight || st.height, 560);
    const need = (F.x1 - F.x0) * D.image.w * full / D.image.h;
    return st.width < need + 40;
  }

  function layout() {
    root.style.setProperty("--pb-shift", "0px");             // measured where the host puts it (see the slide's end)
    root.style.removeProperty("--pb-list-bot");                  // (the host's; lowered below only when it must be)
    let st = stage.getBoundingClientRect();
    const W = D ? D.image.w : 3840, Hh = D ? D.image.h : 1600;
    const want = decideStack(st);
    if (want !== stacked) { stacked = want; root.classList.toggle("pb-stack", stacked); st = stage.getBoundingClientRect(); }
    const vw = st.width;
    let vh = st.height;
    // every instrument in view: the band data/bench.json `frame` names; its top is the tower's cap (the pins sit on
    // the roof beside it now, not above it)
    const F = D && D.frame ? D.frame : null;
    const X0 = F ? F.x0 : 0.03, X1 = F ? F.x1 : 0.97, Y1 = F ? F.y1 : 0.835;
    const Y0 = D && D.anchors.cap_top ? D.anchors.cap_top[1] - 0.006 : (F ? F.y0 : 0.30);
    const C = D && D.clean ? D.clean : [0, 1];
    let s, ox, oy;
    if (stacked) {
      // the photo across the whole width, the band filling it (edge to edge: the room beyond the band is cropped), but
      // never taller than three quarters of the screen (QA judge #1: on tall wide windows it outgrew its stage)
      const stageMax = Math.min(0.75 * (window.innerHeight || 800), 760);
      s = Math.min(vw / (W * (X1 - X0 + 0.012)), (stageMax - 48) / (Hh * (Y1 - Y0)));
      const sh = Math.round(clamp(Hh * s * Math.min(1, Y1 - Y0 + 0.17), 220, stageMax));
      if (Math.abs(sh - vh) > 1) { root.style.setProperty("--pb-stage-h", sh + "px"); vh = sh; }
      const iw0 = W * s, ih0 = Hh * s;
      ox = vw / 2 - (X0 + X1) / 2 * iw0;
      oy = vh * 0.5 - ((Y0 + Y1) / 2 + 0.008) * ih0;
      oy = ih0 >= vh ? Math.min(0, Math.max(vh - ih0, oy)) : (vh - ih0) / 2;
      view = { ox, oy, iw: iw0, ih: ih0, s, vw, vh };
    } else {
      // The photo covers the stage. The band must stay in view: its top (the cap) below the navbar's room (more on short
      // screens, so a wheel stop a notch past the top still shows the pins and heading), its foot above the list and the
      // disclaimer, inside the width.
      const lt = list.getBoundingClientRect().top - st.top;
      root.style.setProperty("--pb-bar", Math.max(0, vh - lt) + "px");   // (the note sits on it: set first, then read)
      const short = shortLandMQ.matches;
      root.classList.toggle("pb-dock", short);
      // The disclaimer: above the list's right end; on a phone on its side under the heading (round 2, QA judge #5: it
      // must stay); under the list's right end, still in the column, when the instruments need the height (design judge
      // #8, QA judge #6). It is part of the band's room: the band's foot stays clear of it.
      root.classList.remove("pb-note-under");
      if (note && SECTION) {
        root.classList.toggle("pb-note-head", short);
        if (short && headEl) {
          const hb = textBox(headEl, st);
          if (hb) { root.style.setProperty("--pb-note-x", (hb[0] + 10) + "px"); root.style.setProperty("--pb-note-y", (hb[3] - 2) + "px"); }
        }
      }
      const topMin = !SECTION ? 16 : vh < 560 ? 60 : vh <= 768 ? 92 : 66;
      const roomFoot = function () {                                     // where the band's foot must stay above
        const l = list.getBoundingClientRect().top - st.top;
        const n = noteAbs() && !short && !root.classList.contains("pb-note-under") ? note.getBoundingClientRect().top - st.top : vh;
        return Math.min(vh, l - 8, n - 12);
      };
      let botMax = roomFoot();
      const s0 = Math.max(vw / W, vh / Hh);                              // cover
      s = Math.min(s0, (vw - 24) / (W * (X1 - X0)));
      let ih = Hh * s;
      const fits = function (ihh) {                                      // the oy range that keeps the band in its room
        const lo = Math.max(ihh >= vh - 0.5 ? vh - ihh : -1e9, topMin - Y0 * ihh), hi = Math.min(ihh >= vh - 0.5 ? 0 : 1e9, botMax - Y1 * ihh);
        return lo <= hi + 0.5 ? [lo, hi] : null;
      };
      const shrinkOK = function () { const s1 = (botMax - topMin) / ((Y1 - Y0) * Hh); return s1 >= 0.86 * s && W * s1 >= vw ? s1 : 0; };
      let R = fits(ih), s1 = R ? 0 : shrinkOK();
      if (!R && !s1 && note && SECTION && !short) {
        // the band does not fit at cover nor a little smaller: the disclaimer goes under the list to give it the height
        root.classList.add("pb-note-under"); botMax = roomFoot(); R = fits(ih); s1 = R ? 0 : shrinkOK();
      }
      if (!R && !s1 && W * s >= vw && (vw / vh) > 2.2) {
        // a very wide window: the list gives back some of its lift (down to 16 px off the foot) before the band's top
        // has to go under the navbar's room
        // (with the disclaimer under the list, the list keeps room for it below)
        const floor = root.classList.contains("pb-note-under") && note ? note.offsetHeight + 10 : 16;
        const lb = parseFloat(getComputedStyle(list).bottom) || 0, need = (topMin - Y0 * ih) - (botMax - Y1 * ih);
        const give = Math.min(Math.max(0, lb - floor), Math.max(0, need));
        if (give > 0) {
          root.style.setProperty("--pb-list-bot", (lb - give) + "px");
          root.style.setProperty("--pb-bar", Math.max(0, vh - (list.getBoundingClientRect().top - st.top)) + "px");
          botMax = roomFoot(); R = fits(ih); s1 = R ? 0 : shrinkOK();
        }
      }
      if (!R) {
        // the band is taller than its room at cover: shrink to fit if that costs little (a gap at the top goes under
        // the veil, at the foot under the scrim); otherwise keep cover and let the top go under the veil (QA judge #2)
        if (s1) { s = s1; ih = Hh * s; oy = topMin - Y0 * ih; }
        else { oy = ih >= vh ? clamp(botMax - Y1 * ih, vh - ih, 0) : botMax - Y1 * ih; }
      } else {
        const want_ = (topMin + botMax) / 2 - (Y0 + Y1) / 2 * ih;        // the band in the middle of its room
        oy = clamp(want_, R[0], R[1]);
        if (ih >= vh - 0.5) oy = clamp(oy, vh - ih, 0);
      }
      const iw = W * s;
      // sideways: the band in view, the photo's own edges 40 px off screen, and the window inside the part of the set
      // with no end of it in view (`clean`) where it can; then slid (never cutting the band) until no instrument, pin or
      // bubble is under the heading's words or the note
      const bandLo = 12 - X0 * iw, bandHi = vw - 12 - X1 * iw;        // (ox: the photo's left edge on screen)
      let lo2 = Math.max(bandLo, vw - Math.min(C[1] * iw, iw - 40)), hi2 = Math.min(bandHi, -Math.max(C[0] * iw, 40));
      if (lo2 > hi2) { lo2 = Math.max(bandLo, vw - iw); hi2 = Math.min(bandHi, 0); }
      if (lo2 > hi2) { lo2 = hi2 = (vw - iw) / 2; }
      const c0 = clamp(vw / 2 - (X0 + X1) / 2 * iw, lo2, hi2);
      const ko = D ? keepouts(st) : [];
      let best = null, bestScore = 1e12;
      const steps = [0]; for (let d = 8; d <= vw * 0.22; d += 8) steps.push(d, -d);
      const tried = {};
      for (let i = 0; i < steps.length; i++) {
        const x = clamp(c0 + steps[i], lo2, hi2);
        if (tried[Math.round(x)]) continue;                       // (a photo with little room to slide clamps most steps)
        tried[Math.round(x)] = 1;
        const V = { ox: x, oy, iw, ih, s, vw, vh };
        let bad = 0;
        if (D) {
          const pb = pinBoxes(V);
          ko.forEach(function (q) { bad += onInst(q, V, 6) * 50; pb.forEach(function (p) { bad += ov(q, p); }); });
          if (BUBBLE() && bad === 0) bad += bubbleBest(V, ko, lt).bad;   // the bubble only where the words are clear
        }
        const sc = bad * 10 + Math.abs(x - c0);
        if (sc < bestScore - 1e-6) { bestScore = sc; best = x; }
        if (!D || bad === 0) break;                                       // nothing in the way: the nearest wins
      }
      ox = best;
      view = { ox, oy, iw, ih, s, vw, vh };
      // a window so wide that the photo cannot slide far enough (wider than about 2.2:1): the heading steps left instead,
      // as far as it must and no further than the screen's edge, and the list and note step with it (design judge #6b)
      if (D && headEl && SECTION && ko.length) {
        const h0 = ko[0], clash = function (dx) {
          const q = [h0[0] - dx, h0[1], h0[2] - dx, h0[3]];
          return onInst(q, view, 6) + pinBoxes(view).reduce(function (a, p) { return a + (ov(q, p) > 0 ? 1 : 0); }, 0);
        };
        if (clash(0)) {
          let dx = 0; const most = Math.max(0, h0[0] - 16);
          while (dx < most && clash(dx)) dx += 12;
          root.style.setProperty("--pb-shift", (-Math.min(dx, most)) + "px");
        }
      }
    }
    Object.assign(photo.style, { left: view.ox + "px", top: view.oy + "px", width: view.iw + "px", height: view.ih + "px" });
    root.__pbView = view;
    if (G) sizeCanvas();
    placePins();
    placeBubble();
    if (active) { placeCard(active); placeLoupe(); }
    lightUp();
    draw();
  }
  const toScreen = (u, v) => [view.ox + u * view.iw, view.oy + v * view.ih];
  const toUV = (x, y) => [(x - view.ox) / view.iw, (y - view.oy) / view.ih];

  function placePins() {
    if (!D) return;
    if (!pinsEl.childElementCount) {
      Object.keys(INST).forEach(function (k) {
        if (k === "photometer" && BUBBLE()) return;               // the bubble names it
        const p = document.createElement("div"); p.className = "pb-pin" + (k === "hydroponics" ? " pb-pin-r" : ""); p.dataset.k = k; p.style.setProperty("--c", INST[k].c);
        p.innerHTML = "<b>" + INST[k].n + "<span>" + INST[k].label + "</span><i class=\"pb-go\" aria-hidden=\"true\">&rarr;</i></b><i></i>";
        pinsEl.appendChild(p);
        // a pin is part of its instrument: pointing at it chooses it, a click opens its page
        const b = p.querySelector("b");
        b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" || e.pointerType === "pen") setActive(k, "pointer"); });
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          if (e.pointerType === "mouse" || !("ontouchstart" in window) || touchArmed === k) { go(k); return; }
          setActive(k, "touch"); touchArmed = k;
        });
      });
    }
    pinsEl.querySelectorAll(".pb-pin").forEach(function (p) {
      const a = anchorOf(p.dataset.k), xy = toScreen(a[0], a[1]);
      p.style.setProperty("--lead", leadOf(p.dataset.k) + "px");
      p.style.left = xy[0] + "px"; p.style.top = (xy[1] - 4) + "px";
    });
  }

  /* ------------------------------------------------------------------ the photometer's bubble */
  // its size, where the close-up's middle is on the photo and the square it shows, for a view
  function bubbleGeom(V) {
    const B = D.bubble;
    const d = stacked ? Math.round(clamp(V.vh * 0.29, 84, 128))
      : Math.round(clamp(Math.min(V.vh * 0.22, 210 * pk(), V.vw * 0.17), V.vh < 560 ? 84 : 140, 300));   // (design judge #5: capped)
    const P = [V.ox + (B.lo[0] + B.hi[0]) / 2 * V.iw, V.oy + (B.lo[1] + B.hi[1]) / 2 * V.ih];
    const side = (B.hi[0] - B.lo[0]) * V.iw;                     // the close-up's square on the photo, in px
    return { d, P, side };
  }
  // the best place for it under a view: over the room either side of the tower, clear of every instrument, the
  // heading, the note, the pins and the list, near the photometer, its leader at the quietest angle across the tower
  // (data `leader_deg`: rising to the bubble through the dark under the tower's top rail; design judge #16)
  function bubbleBest(V, ko, lt) {
    const g = bubbleGeom(V), d = g.d, P = g.P;
    const tb = D.bounds.bioreactor, tl = V.ox + tb[0] * V.iw, tr = V.ox + tb[2] * V.iw;
    const pref = (D.leader_deg != null ? D.leader_deg : 0) * Math.PI / 180;
    const cands = [];
    const gaps = stacked ? [10, 22] : [30, 60, 100];
    gaps.forEach(function (gp) {
      [pref, pref + 0.07, pref - 0.07, 0, pref + 0.16].forEach(function (a) {
        const xr = tr + gp + d / 2, xl = tl - gp - d / 2;
        cands.push([xr, P[1] - Math.tan(a) * (xr - P[0]), 0, a]);
        cands.push([xl, P[1] - Math.tan(a) * (P[0] - xl), 1, a]);
      });
    });
    if (stacked) { cands.push([V.vw - d / 2 - 10, d / 2 + 16, 0, null]); cands.push([d / 2 + 10, d / 2 + 16, 1, null]); }
    const pins = pinBoxes(V);
    // the photo's top inside the stage (a phone: the bubble at least 12 px inside it; design judge #10)
    const top = stacked ? Math.max(0, V.oy) + 12 : (SECTION ? (V.vh <= 768 ? 92 : 66) : 16);
    const bot = (stacked ? V.vh : Math.min(V.vh, lt)) - 10;
    const nm = bubble.querySelector(".pb-b-name"), lw = (nm && nm.offsetWidth) || 140 * pk(), lh = (nm && nm.offsetHeight) || 26 * pk();
    let best = null;
    cands.forEach(function (c) {
      const m = stacked ? 6 : 10, x = clamp(c[0], d / 2 + m, V.vw - d / 2 - m), y = clamp(c[1], top + d / 2, bot - d / 2 - lh / 2);
      const circ = [x - d / 2 - 6, y - d / 2 - 6, x + d / 2 + 6, y + d / 2 + 6];
      // its name sits on the rim, half over the glass: at the foot, or at the top if only there it is clear (slid
      // along the rim to stay on screen). The hit map is generous: a sample or two at the label's edge is a near miss.
      const ldx = Math.min(0, V.vw - 8 - (x + lw / 2)) + Math.max(0, 8 - (x - lw / 2));
      const labAt = function (yc) { return [x + ldx - lw / 2, yc - lh / 2, x + ldx + lw / 2, yc + lh / 2]; };
      const labB = labAt(y + d / 2), labT = labAt(y - d / 2);
      const hb = Math.max(0, onInst(labB, V, 8) - 2) + (labB[3] > bot + 10 ? 50 : 0);
      const ht = Math.max(0, onInst(labT, V, 8) - 2) + (pins.some(function (q) { return ov(labT, q) > 0; }) ? 50 : 0) + (labT[1] < top - 6 ? 50 : 0) + 1;
      const top_ = ht < hb, lab = top_ ? labT : labB;
      const all = [Math.min(x - d / 2, lab[0]) - 6, Math.min(y - d / 2, lab[1]) - 6, Math.max(x + d / 2, lab[2]) + 6, Math.max(y + d / 2, lab[3]) + 4];
      let bad = (onInst(circ, V, 10, true) + Math.min(hb, ht)) * 400;
      ko.forEach(function (q) { bad += ov(all, q) * 4; });
      pins.forEach(function (q) { bad += ov(all, q) * 4; });
      const L = Math.hypot(x - P[0], y - P[1]);
      const ang = Math.atan2(P[1] - y, Math.abs(x - P[0]));
      let sc = bad + L * 0.8 + Math.hypot(x - c[0], y - c[1]) * 2 + c[2] * SIDE_BIAS + (stacked ? 0 : Math.abs(ang - pref) * 900);
      if (FORCE_SIDE >= 0 && c[2] !== FORCE_SIDE) sc += 1e7;
      if (!best || sc < best.score) best = { x, y, score: sc, bad, d, g, top: top_, lh };
    });
    return best;
  }
  function placeBubble() {
    if (!BUBBLE()) { if (bubble) bubble.hidden = true; return; }
    bubble.hidden = false;
    // a phone: its number only, like the other pins there (design judge #10)
    bubble.classList.toggle("pb-b-short", stacked && view.vw < 600);
    const st = stage.getBoundingClientRect(), ko = stacked ? [] : keepouts(st);
    const lt = list.getBoundingClientRect().top - st.top;
    const b = bubbleBest(view, ko, lt), g = b.g, d = b.d;
    bubbleBox = [b.x - d / 2 - 8, b.y - d / 2 - 8 - (b.top ? b.lh / 2 : 0), b.x + d / 2 + 8, b.y + d / 2 + (b.top ? 8 : b.lh / 2 + 4)];
    bubble.classList.toggle("pb-b-top", !!b.top);
    bubble.style.setProperty("--d", d + "px");
    const nm = bubble.querySelector(".pb-b-name"), lw = (nm && nm.offsetWidth) || 0;
    bubble.style.setProperty("--lab-dx", (Math.min(0, view.vw - 8 - (b.x + lw / 2)) + Math.max(0, 8 - (b.x - lw / 2))).toFixed(1) + "px");
    bubble.style.left = (b.x - d / 2) + "px"; bubble.style.top = (b.y - d / 2) + "px";
    // the pull-back to the light path: the cut's square registered on the close-up's, then filling the bubble
    const Bq = D.bubble, Cq = Bq.cut, W = D.image.w, Hh = D.image.h;
    if (Cq && bCut) {
      const k = d / ((Bq.hi[0] - Bq.lo[0]) * W), dc = (Cq.hi[0] - Cq.lo[0]) * W * k, z = d / dc;
      const Lx = (Cq.lo[0] - Bq.lo[0]) * W * k, Ly = (Cq.lo[1] - Bq.lo[1]) * Hh * k;     // the cut's square, registered
      bubble.style.setProperty("--cut-from", "translate(" + Lx.toFixed(2) + "px," + Ly.toFixed(2) + "px) scale(" + (1 / z).toFixed(4) + ")");
      bubble.style.setProperty("--out-to", "translate(" + (-Lx * z).toFixed(2) + "px," + (-Ly * z).toFixed(2) + "px) scale(" + z.toFixed(4) + ")");
    }
    // the ring on the photo round what the bubble shows, and the leader from it to the bubble; rest (the close-up's
    // square) and chosen (the cut-away's square), so the ring follows the pull-back (design judge #4, QA judge #11)
    const P0 = g.P, r0 = g.side / 2;
    const P1 = Cq ? [view.ox + (Cq.lo[0] + Cq.hi[0]) / 2 * view.iw, view.oy + (Cq.lo[1] + Cq.hi[1]) / 2 * view.ih] : P0;
    const r1 = Cq ? (Cq.hi[0] - Cq.lo[0]) * view.iw / 2 : r0;
    const leaderOf = function (P, r) {
      const vx = b.x - P[0], vy = b.y - P[1], L = Math.hypot(vx, vy) || 1;
      const x1 = P[0] + vx / L * (r + 2), y1 = P[1] + vy / L * (r + 2), len = Math.max(0, L - r - 2 - d / 2 - 3);
      return [x1, y1, len, Math.atan2(vy, vx) * 180 / Math.PI];
    };
    const l0 = leaderOf(P0, r0), l1 = leaderOf(P1, r1);
    const S = stage.style;
    [["--rx0", P0[0]], ["--ry0", P0[1]], ["--rd0", 2 * r0], ["--rx1", P1[0]], ["--ry1", P1[1]], ["--rd1", 2 * r1],
     ["--lx0", l0[0]], ["--ly0", l0[1]], ["--lw0", l0[2]], ["--lx1", l1[0]], ["--ly1", l1[1]], ["--lw1", l1[2]]].forEach(function (p) { S.setProperty(p[0], p[1].toFixed(1) + "px"); });
    S.setProperty("--la0", l0[3].toFixed(2) + "deg"); S.setProperty("--la1", l1[3].toFixed(2) + "deg");
    root.classList.add("pb-bubbled");
    root.__pbBubble = { x: b.x, y: b.y, d, ring: [P0[0], P0[1], r0], ring1: [P1[0], P1[1], r1] };
  }

  /* ------------------------------------------------------------------ the card (a touch: what a first tap chose) */
  // name and "Open", in one pill beside its pin (round 1: it repeated the list and covered its own pin and the tower)
  function placeCard(k) {
    if (!D) return;                   // not loaded yet: the list still lights, the card follows once it is
    const I = INST[k];
    card.style.setProperty("--c", I.c);
    $(".pb-c-name", card).textContent = I.label;
    $(".pb-c-role", card).textContent = I.role;
    $(".pb-c-stat b", card).textContent = I.stat;
    $(".pb-c-stat span", card).textContent = I.statL;
    $(".pb-c-loop", card).hidden = !I.loop;
    if (stacked || shortLandMQ.matches) {   // docked by CSS: over the list's top edge (stacked), or over the list's row (a
      card.style.left = ""; card.style.top = ""; cardBox = null; return;     // phone on its side: no room beside the pins)
    }
    const st = stage.getBoundingClientRect(), ko = keepouts(st), ls = rel(list.getBoundingClientRect(), st);
    const cw = card.offsetWidth || 220, chh = card.offsetHeight || 40;
    const pe = pinsEl.querySelector('.pb-pin[data-k="' + k + '"] b');
    const a = anchorOf(k), A = toScreen(a[0], a[1]);
    const pr = pe ? rel(pe.getBoundingClientRect(), st) : [A[0] - 40, A[1] - 30, A[0] + 40, A[1] - 4];
    const pcx = (pr[0] + pr[2]) / 2, pcy = (pr[1] + pr[3]) / 2;
    const cands = [
      [pr[2] + 16, pcy - chh / 2], [pr[0] - 16 - cw, pcy - chh / 2], [pcx - cw / 2, pr[1] - 16 - chh],
      [pr[2] + 16, pr[1] - chh - 8], [pr[0] - 16 - cw, pr[1] - chh - 8], [pr[2] + 16, pr[3] + 10], [pr[0] - 16 - cw, pr[3] + 10],
    ];
    const pins = pinBoxes(view);
    let best = null, bs = 1e12;
    cands.forEach(function (c, i) {
      const x = clamp(c[0], 10, view.vw - cw - 10), y = clamp(c[1], 64, view.vh - chh - 10);
      const box = [x, y, x + cw, y + chh];
      let s = onInst(box, view, 6) * 240 + ov(box, ls) * 6 + (bubbleBox && ov(box, bubbleBox) > 0 ? 1e7 : 0);   // (never over the bubble: QA #8)
      ko.forEach(function (q) { s += ov(box, q) * 6; });
      pins.forEach(function (q) { s += ov(box, q) * 6; });
      s += Math.hypot(x + cw / 2 - pcx, y + chh / 2 - pcy) * 2 + i * 20;
      if (s < bs) { bs = s; best = box; }
    });
    cardBox = best;
    card.style.setProperty("--ox", (pcx - best[0]) + "px"); card.style.setProperty("--oy", (pcy - best[1]) + "px");
    card.style.left = best[0] + "px"; card.style.top = best[1] + "px";
  }

  /* ------------------------------------------------------------------ the old hover lens (data without a bubble) */
  function placeLoupe() {
    if (!loupe || BUBBLE()) return;
    const on = active === "photometer" && D && cropImg;
    loupe.classList.toggle("pb-on", !!on); lines.classList.toggle("pb-on", !!on);
    if (!on) return;
    const d = Math.round(Math.max(stacked ? 116 : 160, Math.min(stacked ? 150 : 250, view.vw * (stacked ? 0.34 : 0.17), view.vh * 0.36)));
    loupe.style.setProperty("--d", d + "px");
    const cell = D.anchors.cell, led = D.anchors.led, lo = D.crop.lo, hi = D.crop.hi;
    let P = [cell[0], cell[1] - 0.25 * (cell[1] - led[1])];
    if (pointerUV && activeSrc === "pointer") P = pointerUV.slice();
    P[0] = clamp(P[0], lo[0], hi[0]); P[1] = clamp(P[1], lo[1], hi[1]);
    const M = 2.3, px = view.s * M, W = D.image.w, Hh = D.image.h;
    const cw = (hi[0] - lo[0]) * W * px, ch = (hi[1] - lo[1]) * Hh * px;
    [lensCut, lensOut].forEach(function (el) { el.style.width = cw + "px"; el.style.height = ch + "px"; el.style.backgroundSize = cw + "px " + ch + "px"; });
    const left = d / 2 - (P[0] - lo[0]) * W * px, top = d / 2 - (P[1] - lo[1]) * Hh * px;
    lensCut.style.transform = lensOut.style.transform = "translate(" + left.toFixed(1) + "px," + top.toFixed(1) + "px)";
    const pScr = toScreen(P[0], P[1]), tb = D.bounds.bioreactor, tr = toScreen(tb[2], tb[3]);
    const x = clamp(tr[0] + 26 + d / 2, d / 2 + 10, view.vw - d / 2 - 10), y = clamp(pScr[1], d / 2 + 10, view.vh - d / 2 - 34);
    loupe.style.left = (x - d / 2) + "px"; loupe.style.top = (y - d / 2) + "px";
    const rr = d / 2 / M;
    ring.setAttribute("cx", pScr[0]); ring.setAttribute("cy", pScr[1]); ring.setAttribute("r", rr);
    const vx = x - pScr[0], vy = y - pScr[1], L = Math.hypot(vx, vy) || 1;
    lead.setAttribute("x1", pScr[0] + vx / L * rr); lead.setAttribute("y1", pScr[1] + vy / L * rr);
    lead.setAttribute("x2", x - vx / L * (d / 2 + 3)); lead.setAttribute("y2", y - vy / L * (d / 2 + 3));
  }

  /* ------------------------------------------------------------------ the light coming up (a section) */
  // 0 while the section's top is at the foot of the screen, 1 once it has reached the top (stacked: once the photo is
  // wholly on screen). Its top dissolves into the dark above and the room is darker, then the light comes up as it
  // settles. Tied to the scroll position, not to time; a reader who prefers less motion gets the settled state. The
  // pins, the bubble and its leader arrive by a class once it is nearly in place, never half there (round 1, D4).
  let lq = false, lastIn = "", uiOn = false;
  function setUI(on) { if (on !== uiOn) { uiOn = on; root.classList.toggle("pb-ui-on", on); } }
  function lightUp() {
    lq = false;
    if (!SECTION || reduced) { if (SECTION) root.style.setProperty("--pb-in", "1"); setUI(true); return; }
    const vh = window.innerHeight || 1;
    let p;
    if (stacked) { const r = stage.getBoundingClientRect(); p = clamp((vh - r.top) / Math.max(1, r.height), 0, 1); }
    else p = clamp(1 - root.getBoundingClientRect().top / vh, 0, 1);
    const t = clamp((p - 0.15) / 0.7, 0, 1), e = t * t * (3 - 2 * t);
    const v = e.toFixed(3);
    if (v !== lastIn) { lastIn = v; root.style.setProperty("--pb-in", v); }
    if (e >= 0.8) setUI(true); else if (e < 0.6) setUI(false);
  }
  if (SECTION) window.addEventListener("scroll", function () { if (!lq) { lq = true; requestAnimationFrame(lightUp); } }, { passive: true });

  /* ------------------------------------------------------------------ choosing */
  function setActive(k, src) {
    if (k === active) { activeSrc = src || activeSrc; if (k === "photometer") placeLoupe(); return; }
    active = k; activeSrc = src || null;
    stage.classList.toggle("pb-active", !!k);
    stage.classList.toggle("pb-ph", k === "photometer");
    pinsEl.querySelectorAll(".pb-pin").forEach(function (p) { p.classList.toggle("pb-on", p.dataset.k === k); });
    listLinks.forEach(function (a) { a.classList.toggle("pb-on", a.dataset.k === k); });
    if (bubble) bubble.classList.toggle("pb-on", k === "photometer");
    for (let i = 0; i < 4; i++) tH[i] = 0;
    if (k) tH[SLOT[k]] = 1;
    loopT = k === "photometer" ? 1 : k === "bioreactor" ? 0.75 : 0;
    // the card only for a touch: there it is the "tap again to open" step (not for the photometer when it has its
    // bubble: the bubble names it, shows it, and a tap on it opens its page). With a pointer, the pin, the bubble, the
    // glow and the lit list say it; the cursor says it opens.
    if (k && src === "touch" && !(k === "photometer" && BUBBLE())) { placeCard(k); if (D) card.classList.add("pb-on"); }
    else { card.classList.remove("pb-on"); if (!k) touchArmed = null; }
    placeLoupe();
    kick();
  }
  function go(k) { if (k && INST[k].page) window.location.href = INST[k].page; }

  function hitAt(x, y) {
    if (!hit) return null;
    const uv = toUV(x, y);
    if (uv[0] < 0 || uv[1] < 0 || uv[0] >= 1 || uv[1] >= 1) return null;
    return HIT[instAt(uv[0], uv[1])] || null;
  }
  function local(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  stage.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    if (e.target.closest(".pb-bubble, .pb-pin b")) return;      // they choose for themselves
    const [x, y] = local(e), k = hitAt(x, y);
    pointerUV = toUV(x, y);
    stage.classList.toggle("pb-pointing", !!k);
    if (k || activeSrc === "pointer") setActive(k, "pointer");
    if (k === "photometer") placeLoupe();
  });
  stage.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse" && (activeSrc === "pointer" || activeSrc === "bubble")) setActive(null);
  });
  stage.addEventListener("click", function (e) {
    if (e.target.closest(".pb-card")) { go(active); return; }
    if (e.target.closest(".pb-bubble, .pb-pin b")) return;
    const [x, y] = local(e), k = hitAt(x, y);
    if (e.pointerType === "mouse" || (!e.pointerType && !("ontouchstart" in window))) { if (k) go(k); return; }
    // touch: the first tap shows what it is, a second tap on the same instrument (or on its card) opens it
    if (!k) { setActive(null); return; }
    if (touchArmed === k) { go(k); return; }
    pointerUV = null; setActive(k, "touch"); touchArmed = k;
  });
  card.addEventListener("click", function (e) { e.stopPropagation(); go(active); });
  if (bubble) {
    // the bubble is the photometer's: pointing at it lights it (and the photometer in the photo), a click or a tap
    // opens its page (it names itself, so a tap needs no second step)
    bubble.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" || e.pointerType === "pen") setActive("photometer", "bubble"); });
    bubble.addEventListener("pointerleave", function (e) { if (activeSrc === "bubble" && (e.pointerType === "mouse" || e.pointerType === "pen")) setActive(null); });
    bubble.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  listLinks.forEach(function (a) {
    const k = a.dataset.k;
    a.addEventListener("mouseenter", function () { setActive(k, "list"); });
    a.addEventListener("mouseleave", function () { if (activeSrc === "list" && document.activeElement !== a) setActive(null); });
    a.addEventListener("focus", function () { setActive(k, "list"); });
    a.addEventListener("blur", function () { if (activeSrc === "list") setActive(null); });
  });
  // Tab into the list: the browser scrolls the card into view, which can leave the instrument it lights off screen
  // (QA judge #4); a section that is not wholly on screen is brought up to the top
  if (SECTION) list.addEventListener("focusin", function () {
    if (stacked) return;
    requestAnimationFrame(function () {
      const sec = root.closest("section") || root, r = sec.getBoundingClientRect();
      if (r.top < -2 || r.bottom > (window.innerHeight || 0) + 2) sec.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  });
  // Escape clears a choice; it leaves the rest of the page (and focus outside the bench) alone
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !active) return;
    setActive(null);
    if (root.contains(document.activeElement)) document.activeElement.blur();
  });
  // a tap elsewhere on the page puts a touch choice down (the sheet-like pill must not linger as the page scrolls on)
  document.addEventListener("pointerdown", function (e) {
    if (activeSrc === "touch" && !e.target.closest(".pb-stage")) setActive(null);
  }, { passive: true });

  /* ------------------------------------------------------------------ WebGL */
  const VS = "#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }";
  const FS = `#version 300 es
precision highp float;
uniform sampler2D uPhoto, uMask, uGlow, uLoopT, uFlow;
uniform vec2 uRes; uniform vec4 uView; uniform vec4 uH; uniform vec4 uEdge; uniform vec3 uClean;
uniform float uLoop, uT, uRM, uAspect;
uniform vec2 uCellS, uCell; uniform vec3 uCol[4]; uniform vec3 uBg;
out vec4 outC;
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = (p - uView.xy) / uView.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) { outC = vec4(uBg, 1.); return; }
  vec3 c = texture(uPhoto, uv).rgb;
  vec3 m = texture(uMask, uv).rgb, g = texture(uGlow, uv).rgb;
  float left = step(uv.x, .5);
  float br = m.r, ph = m.g, lp = m.b * left, hy = m.b * (1. - left);
  float rigOnly = clamp(br - ph, 0., 1.);
  float sel = clamp(uH.x * br + uH.y * ph + uH.z * lp + uH.w * hy, 0., 1.);
  float act = max(max(uH.x, uH.y), max(uH.z, uH.w));
  float keep = max(sel, uH.y * rigOnly * .42);
  float dim = act * (1. - keep);
  c = mix(c, mix(c, vec3(luma(c)), .6) * .4, dim * .9);
  c *= 1. + .10 * sel;
  float o0 = clamp(g.r - br, 0., 1.) * uH.x, o1 = clamp(g.g - ph, 0., 1.) * uH.y;
  float o2 = clamp(g.b * left - lp, 0., 1.) * uH.z, o3 = clamp(g.b * (1. - left) - hy, 0., 1.) * uH.w;
  c += uCol[0] * o0 * .55 + uCol[1] * o1 * .85 + uCol[2] * o2 * .6 + uCol[3] * o3 * .6;
  if (uLoop > .001) {
    vec3 lt = texture(uLoopT, uv).rgb;
    ivec2 sz = textureSize(uFlow, 0);
    ivec2 ip = clamp(ivec2(uv * vec2(sz)), ivec2(0), sz - 1);
    vec2 f = texelFetch(uFlow, ip, 0).rg;
    float s = (floor(f.r * 255. + .5) * 256. + floor(f.g * 255. + .5)) / 65535.;
    float k = fract(s * 12. - uT * .35);
    float pk = uRM > .5 ? .45 : exp(-pow((k - .5) / .07, 2.));
    vec3 amber = vec3(1., .64, .24);
    c += uLoop * amber * (lt.g * (.20 + 1.25 * pk) + lt.b * (.05 + .45 * pk));
    c += uLoop * vec3(1., .72, .36) * lt.r * (.09 + .04 * sin(uT * 2.));
    float sc = .5 * (uCellS.x + uCellS.y);
    float pc = uRM > .5 ? .5 : exp(-pow((fract(sc * 12. - uT * .35) - .5) / .09, 2.));
    vec2 d = (uv - uCell) * vec2(uAspect, 1.); float r2 = dot(d, d);
    c += uH.y * uLoop * vec3(1., .7, .32) * (exp(-r2 / .00002) * (.5 + 1.7 * pc) + exp(-r2 / .0005) * .08 * (.5 + pc));
  }
  // the photo's own edges melt into the page only where they are inside the stage (round 1, QA judge #2: they darkened
  // the window's own edges); and beyond the part of the set with no end of it in view (uClean), it fades into the page
  float fe = mix(1., smoothstep(0., .035, uv.x), uEdge.x) * mix(1., smoothstep(1., .965, uv.x), uEdge.y)
           * mix(1., smoothstep(0., .07, uv.y), uEdge.z) * mix(1., smoothstep(1., .93, uv.y), uEdge.w);
  float fc = smoothstep(uClean.x, uClean.x + uClean.z, uv.x) * smoothstep(uClean.y, uClean.y - uClean.z, uv.x);
  c = mix(uBg, c, fe * fc);
  outC = vec4(c, 1.);
}`;

  // The program compiles without holding the page up (round 2, QA judge #14: a ~50 ms frame at the first wheel notch):
  // with KHR_parallel_shader_compile the link finishes in the background and is waited for a frame at a time.
  function initGL() {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const ext = gl.getExtension("KHR_parallel_shader_compile");
    function sh(t, src) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs);
    gl.bindAttribLocation(pr, 0, "p"); gl.linkProgram(pr);
    return { gl, pr, ext, vs, fs, U: {}, tex: {} };
  }
  function linked(g) {
    return new Promise(function (res) {
      const done = function () { return !g.ext || g.gl.getProgramParameter(g.pr, g.ext.COMPLETION_STATUS_KHR); };
      (function wait() { if (done()) res(); else requestAnimationFrame(wait); })();
    });
  }
  function finishGL(g) {
    const gl = g.gl, pr = g.pr;
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      throw new Error((gl.getShaderInfoLog(g.vs) || "") + (gl.getShaderInfoLog(g.fs) || "") + (gl.getProgramInfoLog(pr) || ""));
    }
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    ["uPhoto", "uMask", "uGlow", "uLoopT", "uFlow", "uRes", "uView", "uH", "uEdge", "uClean", "uLoop", "uT", "uRM", "uAspect", "uCellS", "uCell", "uCol", "uBg"]
      .forEach(function (n) { g.U[n] = gl.getUniformLocation(pr, n); });
  }
  function texture(unit, bmp, nearest) {
    const gl = G.gl, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    const f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function sizeCanvas() {
    // device pixels, at most 2x and at most ~6.5 million of them (a 2000 x 1000 section on a 2x screen is 8 million)
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6.5e6 / Math.max(1, view.vw * view.vh)));
    const w = Math.round(view.vw * dpr), h = Math.round(view.vh * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    G.dpr = dpr;
  }
  function hexRGB(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); }
  function bgRGB() {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(getComputedStyle(stage).backgroundColor);
    return m ? [m[1] / 255, m[2] / 255, m[3] / 255] : [5 / 255, 6 / 255, 10 / 255];
  }
  function draw() {
    if (!G || !G.ready) return;
    const gl = G.gl, U = G.U, dpr = G.dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform4f(U.uView, view.ox * dpr, view.oy * dpr, view.iw * dpr, view.ih * dpr);
    gl.uniform4f(U.uH, H[0], H[1], H[2], H[3]);
    // feather only the photo's edges that lie inside the stage (a section; the page's photo always covers)
    const fe = SECTION ? 1 : 0;
    gl.uniform4f(U.uEdge, fe * (view.ox > 0.5 ? 1 : 0), fe * (view.ox + view.iw < view.vw - 0.5 ? 1 : 0), fe * (view.oy > 0.5 ? 1 : 0), fe * (view.oy + view.ih < view.vh - 0.5 ? 1 : 0));
    const C = D && D.clean ? D.clean : [0, 1];
    gl.uniform3f(U.uClean, C[0] > 0 ? C[0] : -1, C[1] < 1 ? C[1] : 2, 0.03);
    gl.uniform1f(U.uLoop, loopV); gl.uniform1f(U.uT, clock); gl.uniform1f(U.uRM, reduced ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    root.__pbFrames = (root.__pbFrames || 0) + 1;     // for the checks: frames drawn so far
  }
  // frames run only while something moves AND the bench is on screen; off screen the loop simply waits
  function kick() { if (!raf && onScreen) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
    if (!onScreen) return;
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
    let moving = false;
    for (let i = 0; i < 4; i++) { H[i] += (tH[i] - H[i]) * k; if (Math.abs(tH[i] - H[i]) > 0.002) moving = true; else H[i] = tH[i]; }
    let target = loopT;
    if (intro !== null) {
      intro += dt;
      const t = intro, env = t < 0.9 ? t / 0.9 : t < 4.6 ? 1 : Math.max(0, 1 - (t - 4.6) / 1.2);
      target = Math.max(target, 0.85 * env);
      if (t > 5.8) intro = null;
      moving = true;
    }
    loopV += (target - loopV) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
    if (Math.abs(target - loopV) > 0.002) moving = true; else loopV = target;
    if (loopV > 0.001 && !reduced) { clock += dt; moving = true; }
    draw();
    if (moving) raf = requestAnimationFrame(tick);
  }
  // once, the first time the bench is properly in view: the culture runs round the loop and through the photometer
  function maybeIntro() {
    if (introDone || !seen || !G || !G.ready || reduced) return;
    introDone = true; intro = 0; kick();
  }

  /* ------------------------------------------------------------------ loading */
  const BMP = { premultiplyAlpha: "none", colorSpaceConversion: "none" };
  function bitmap(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.blob(); })
      .then(function (b) { return createImageBitmap(b, BMP); });
  }
  // the photo the <img> already has (QA judge #9: fetching it again for the texture downloaded it twice): made eager,
  // decoded, then cut into strips so it can be uploaded across several frames (QA judge #16: one 3840 px upload took a
  // 50 ms frame); fetched only when there is no usable <img>
  function photoStrips(n) {
    const fromImg = function () {
      if (photo.loading === "lazy") photo.loading = "eager";
      // (from a bitmap of the whole photo: an <img> chosen from a srcset reports its size in CSS px, not the file's)
      return (photo.decode ? photo.decode() : Promise.resolve()).then(function () { return createImageBitmap(photo, BMP); }).then(function (full) {
        const w = full.width, h = full.height;
        if (!w || !h) throw new Error("no photo");
        const sh = Math.ceil(h / n), out = [];
        for (let i = 0; i < n; i++) out.push(createImageBitmap(full, 0, i * sh, w, Math.min(sh, h - i * sh)));
        return Promise.all(out).then(function (b) { if (full.close) full.close(); return { w, h, sh, strips: b }; });
      });
    };
    return fromImg().catch(function () {
      const small = (phoneMQ.matches ? 1.4 * window.innerWidth : 2.4 * window.innerHeight) * (window.devicePixelRatio || 1) <= (D.image.w / 2);
      return bitmap(url(small ? D.image.small : D.image.src)).then(function (b) { return { w: b.width, h: b.height, sh: b.height, strips: [b] }; });
    });
  }
  function loadHit(u) {
    return bitmap(u).then(function (bmp) {
      const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
      hit = { w: bmp.width, h: bmp.height, data: x.getImageData(0, 0, bmp.width, bmp.height).data };
      layout();                       // the exact shapes now: words and the bubble kept off them
    });
  }
  function phoneThumb() {
    const li = $(".pb-inloop .pb-thumb"); if (!li || !D) return;
    const lo = D.crop.lo, hi = D.crop.hi, c = D.anchors.cell, size = 104, M = 3.2;
    const W = D.image.w, Hh = D.image.h, k = (size / 104) * M * 0.5 * 2560 / W;
    const cw = (hi[0] - lo[0]) * W * k, ch = (hi[1] - lo[1]) * Hh * k;
    const P = [c[0], c[1] - 0.03];
    li.style.setProperty("--thumb", "url(" + url(D.crop.cut) + ")");
    li.style.setProperty("--thumb-size", cw + "px " + ch + "px");
    li.style.setProperty("--thumb-pos", (size / 2 - (P[0] - lo[0]) * W * k) + "px " + (size / 2 - (P[1] - lo[1]) * Hh * k) + "px");
  }
  const nextFrame = () => new Promise(function (r) { requestAnimationFrame(function () { r(); }); });
  const idle = () => new Promise(function (r) { if (window.requestIdleCallback) requestIdleCallback(function () { r(); }, { timeout: 500 }); else setTimeout(r, 60); });

  let loading = false;
  function load() {
    if (loading) return; loading = true;
    fetch(url("data/bench.json")).then(function (r) { return r.json(); }).then(function (d) {
      D = d;
      if (BUBBLE()) {
        bOut.style.backgroundImage = "url(" + url(d.bubble.src) + ")";
        if (d.bubble.cut && bCut) { const im = new Image(); im.src = url(d.bubble.cut.src); im.onload = function () { bCut.style.backgroundImage = "url(" + url(d.bubble.cut.src) + ")"; }; }
        root.classList.add("pb-bubbled");
      }
      layout();
      if (active) { const k = active; active = null; setActive(k, activeSrc); }   // a choice made while loading
      const T = d.textures;
      if (!BUBBLE()) {
        // the photometer's lens (outside, then cut open), and its thumbnail in the phone list
        cropImg = new Image(); cropImg.decoding = "async"; cropImg.src = url(d.crop.cut);
        cropImg.onload = function () { lensCut.style.backgroundImage = "url(" + url(d.crop.cut) + ")"; phoneThumb(); if (active === "photometer") placeLoupe(); };
        const outImg = new Image(); outImg.src = url(d.crop.src);
        outImg.onload = function () { lensOut.style.backgroundImage = "url(" + url(d.crop.src) + ")"; };
      }
      loadHit(url(T.hit)).catch(function (e) { console.warn(e); });
      // the WebGL work starts when the page is idle (round 2, QA judge #14), the program links in the background
      return idle().then(function () {
        let g = null;
        try { g = initGL(); } catch (e) { console.warn("WebGL2 unavailable:", e); }
        if (!g) return;
        return Promise.all([linked(g), photoStrips(4), bitmap(url(T.masks)), bitmap(url(T.glow)), bitmap(url(T.loop)), bitmap(url(T.flow))])
          .then(async function (b0) {
          try { finishGL(g); } catch (e) { console.warn("WebGL2 unavailable:", e); return; }
          G = g; sizeCanvas();
          const b = b0.slice(1);
          const gl = G.gl, U = G.U, P = b[0];
          // the photo: storage once, then a strip a frame
          const tp = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tp);
          gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, P.w, P.h);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          for (let i = 0; i < P.strips.length; i++) {
            await nextFrame();
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tp);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, i * P.sh, P.strips[i].width, P.strips[i].height, gl.RGBA, gl.UNSIGNED_BYTE, P.strips[i]);
            if (P.strips[i].close) P.strips[i].close();
          }
          G.tex = { photo: tp };
          const rest = [["masks", 1, b[1]], ["glow", 2, b[2]], ["loop", 3, b[3]], ["flow", 4, b[4], true]];
          for (let i = 0; i < rest.length; i++) { await nextFrame(); G.tex[rest[i][0]] = texture(rest[i][1], rest[i][2], rest[i][3]); }
          gl.uniform1i(U.uPhoto, 0); gl.uniform1i(U.uMask, 1); gl.uniform1i(U.uGlow, 2); gl.uniform1i(U.uLoopT, 3); gl.uniform1i(U.uFlow, 4);
          gl.uniform2f(U.uCellS, d.cell_s[0], d.cell_s[1]); gl.uniform2f(U.uCell, d.anchors.cell[0], d.anchors.cell[1]);
          gl.uniform1f(U.uAspect, d.image.w / d.image.h);
          gl.uniform3fv(U.uCol, [].concat(hexRGB(INST.bioreactor.c), hexRGB(INST.photometer.c), hexRGB(INST.lpa.c), hexRGB(INST.hydroponics.c)));
          const bg = bgRGB(); gl.uniform3f(U.uBg, bg[0], bg[1], bg[2]);
          G.ready = true; root.classList.add("pb-gl");
          draw();
          maybeIntro();
        });
      });
    }).catch(function (e) { console.warn("bench:", e); });
  }

  // a section loads when it is near the screen, runs frames only while on it, and plays its intro once, in view
  if (SECTION && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) load(); }, { rootMargin: "150% 0px" }).observe(root);
    new IntersectionObserver(function (es) {
      const e = es[es.length - 1];
      onScreen = e.isIntersecting;
      if (onScreen) { draw(); kick(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (e.intersectionRatio >= 0.4) { seen = true; maybeIntro(); }
    }, { threshold: [0, 0.4] }).observe(stage);
  } else {
    onScreen = seen = true; load();
  }

  let rs = 0;
  const relayout = function () { cancelAnimationFrame(rs); rs = requestAnimationFrame(layout); };
  window.addEventListener("resize", relayout);
  phoneMQ.addEventListener("change", relayout);
  shortLandMQ.addEventListener("change", relayout);
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(stage);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);      // the heading's words, measured in their font
  layout();
})();
