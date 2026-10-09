// Part callouts for the function stories.
//
// Each act is about one piece of the instrument, and until now the only thing
// naming that piece was the caption in the corner — the reader had to work out
// for themselves which of the things on screen the words were about. A callout
// closes that gap: a ring on the part itself, a leader out to clear space, and
// the part's name at the end of it.
//
// Anchored to the MESH, not to a fixed point. Every act in both stories moves
// its parts — lifted, exploded, dropped back — and a world-space anchor
// computed once at load drifts off the part the moment it moves. The anchor is
// a point in the mesh's own local space, resolved through its matrixWorld every
// frame, so it rides whatever the act does to it.
//
// Drawn to a 2D overlay canvas rather than DOM: there are up to five at once,
// they move every frame, and none of them should be able to touch layout.
window.Callouts = function (host, cfg) {
  "use strict";
  cfg = cfg || {};
  const gl = cfg.canvas || host.querySelector("canvas");
  const accent = cfg.accent || "#ffa23d";
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

  const cv = document.createElement("canvas");
  cv.className = "callout-layer";
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;" +
                     "z-index:5;pointer-events:none;";
  gl.parentNode.insertBefore(cv, gl.nextSibling);
  const ctx = cv.getContext("2d");

  const _v = new THREE.Vector3();
  let W = 0, H = 0, dpr = 1;

  function size() {
    const r = gl.getBoundingClientRect();
    // window.__heroDpr: the hero-video renderer (dev/hero-video) draws this layer at the
    // clip's own pixel density, which on the phone clip is above the cap. Unset in normal use.
    const d = window.__heroDpr || Math.min(window.devicePixelRatio || 1, 2);
    if (r.width === W && r.height === H && d === dpr) return;
    W = r.width; H = r.height; dpr = d;
    cv.width = Math.max(2, Math.round(W * d));
    cv.height = Math.max(2, Math.round(H * d));
  }

  // Screen position of a point in a mesh's local space, or null when the mesh
  // is gone, hidden, or behind the camera.
  function project(camera, it) {
    const m = it.mesh;
    if (!m || !m.visible) return null;
    let o = m;
    while (o) { if (o.visible === false) return null; o = o.parent; }
    // Default anchor is the geometry's own centre, not its origin. These are
    // STLs exported from CAD, so a part's local origin is wherever the modeller
    // put the sketch plane — often nowhere near the part — and a ring drawn
    // there lands in empty space beside the thing it is naming.
    let off = it.off;
    if (!off) {
      if (!m.userData._coAnchor) {
        m.geometry.computeBoundingBox();
        const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
        m.userData._coAnchor = [c.x, c.y, c.z];
      }
      off = m.userData._coAnchor;
    }
    _v.set(off[0], off[1], off[2]);
    m.updateWorldMatrix(true, false);
    _v.applyMatrix4(m.matrixWorld);
    _v.project(camera);
    if (_v.z > 1) return null;
    return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H };
  }

  function draw(camera, items) {
    size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!items || !items.length) return;

    const narrow = W < 760;
    // Under 760px the frame is not wide enough to put a label beside a part
    // without it landing on the part next to it, and the caption already fills
    // the bottom third. The ring stays — it still says *this* piece — and the
    // name goes with it.
    const LEAD = narrow ? 0 : (W < 1100 ? 78 : 118);
    const RISE = 16;

    const placed = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const a = it.a === undefined ? 1 : it.a;
      if (a <= 0.004) continue;
      // An item with no label is a rim only. Most acts do not need a tag: the
      // caption has already said the part's name, and a second voice repeating
      // it a hundred pixels away is noise. Those parts still light up -- the
      // highlight is the useful half -- they just do it without talking.
      if (!it.label) continue;
      const p = project(camera, it);
      if (!p) continue;
      if (p.x < -80 || p.x > W + 80 || p.y < -60 || p.y > H + 60) continue;

      // Which way the leader runs. Left of centre it would cross the caption,
      // so anything on that side reaches right instead; `side` overrides.
      let dir = it.side === "left" ? -1 : it.side === "right" ? 1 : (p.x < W * 0.46 ? 1 : -1);
      let tx = p.x + dir * LEAD, ty = p.y - RISE;
      if (tx < 150) { dir = 1; tx = p.x + LEAD; }
      if (tx > W - 150) { dir = -1; tx = p.x - LEAD; }

      // Two labels on the same part of the frame overlap into one grey smear.
      // Later items step down until they clear the ones already placed.
      for (let g = 0; g < 14; g++) {
        let hit = false;
        for (let k = 0; k < placed.length; k++) {
          if (Math.abs(placed[k].y - ty) < 38 && Math.abs(placed[k].x - tx) < 230) { hit = true; break; }
        }
        if (!hit) break;
        ty += 40;
      }
      placed.push({ x: tx, y: ty });

      ctx.globalAlpha = a;

      // the ring on the part
      ctx.strokeStyle = accent; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.6, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, 6.2832); ctx.fill();

      if (LEAD) {
        // elbow: out and up from the ring, then level to the label
        ctx.strokeStyle = "rgba(255,255,255,.34)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x + dir * 6.4, p.y - 2.2);
        ctx.lineTo(tx - dir * 12, ty);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }

      // The tag gets a plate behind it. Plain text was unreadable the moment a
      // label crossed anything bright — the beamsplitter's name sat directly on
      // the beam and disappeared into it — and a drop shadow only smears on a
      // light background. A plate works over both, and it reads as a tag on an
      // instrument rather than type floating in the scene.
      const NAME = "600 " + (narrow ? 10.5 : 12.5) + "px " + (cfg.sans || MONO);
      const SUB = "500 9px " + MONO;
      const hasSub = !!it.sub && !narrow;
      ctx.font = NAME; const wName = ctx.measureText(it.label).width;
      ctx.font = SUB; const wSub = hasSub ? ctx.measureText(it.sub.toUpperCase()).width : 0;
      const wTxt = Math.max(wName, wSub);
      const padX = 8, padY = hasSub ? 7 : 6;
      const boxH = (hasSub ? 27 : 15) + padY * 2 - 6;
      const boxW = wTxt + padX * 2 + 3;
      const bx = LEAD ? (dir > 0 ? tx : tx - boxW) : p.x - boxW / 2;
      const by = (LEAD ? ty : p.y - 22) - boxH / 2;

      ctx.fillStyle = "rgba(6,8,12,.72)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 3);
      else ctx.rect(bx, by, boxW, boxH);
      ctx.fill();
      // an accent rule on the edge the leader arrives at
      ctx.fillStyle = accent;
      ctx.fillRect(dir > 0 || !LEAD ? bx : bx + boxW - 1.6, by + 1, 1.6, boxH - 2);

      ctx.textAlign = "left";
      const lx = bx + padX + (dir > 0 || !LEAD ? 3 : 0);
      ctx.fillStyle = "rgba(242,246,251,.98)";
      ctx.font = NAME;
      ctx.fillText(it.label, lx, by + padY + (narrow ? 8 : 9.5));
      if (hasSub) {
        ctx.fillStyle = accent;
        ctx.font = SUB;
        ctx.fillText(it.sub.toUpperCase(), lx, by + padY + 22);
      }
      ctx.globalAlpha = 1;
    }
  }

  return { draw: draw, canvas: cv };
};
