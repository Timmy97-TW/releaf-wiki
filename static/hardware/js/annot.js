// Teardown annotations — the promo video's callouts, on the scroll walkthrough.
//
// While a part is lifted out and turning, small tags name its features and
// track them in 3D: each tag is anchored to a point in the part's own local
// space, so it follows the spin instead of floating beside it. Drawn to a 2D
// overlay canvas rather than as DOM, because there is one per feature and they
// need to redraw every frame without touching layout.
//
// Anchors live in `parts.js` as `notes: [[x, y, z, "label"], …]` in the part's
// own untransformed coordinates. A part with no `notes` simply gets none.
(function () {
  const host = document.querySelector(".stage-wrap") || document.querySelector(".hero-3d")
            || document.querySelector(".viewport") || document.body;
  const gl = document.getElementById("gl");
  if (!gl || typeof THREE === "undefined") return;

  const api = window.__photo;
  if (!api || !api.annotHook) return;      // scene must opt in

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cv = document.createElement("canvas");
  cv.className = "annot-layer";
  cv.setAttribute("aria-hidden", "true");
  gl.parentNode.insertBefore(cv, gl.nextSibling);
  const ctx = cv.getContext("2d");

  let dpr = 1;
  function size() {
    const r = gl.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    cv.style.width = r.width + "px";
    cv.style.height = r.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener("resize", size, { passive: true });

  const v = new THREE.Vector3();

  // Draw one callout: a dot on the feature, a short elbow, and a label.
  // `side` flips the elbow so tags on the left of the part read leftward.
  function callout(x, y, text, alpha, accent) {
    const w = cv.width / dpr, h = cv.height / dpr;
    const side = x > w * 0.5 ? 1 : -1;
    const lead = 34, rise = 16;
    const ex = x + lead * side;
    const ey = y - rise;

    ctx.globalAlpha = alpha;

    // leader
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // anchor dot
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // label
    ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    const metrics = ctx.measureText(text.toUpperCase());
    const padX = 6, boxH = 17;
    const boxW = metrics.width + padX * 2;
    const bx = side > 0 ? ex + 5 : ex - 5 - boxW;
    const by = ey - boxH / 2;

    ctx.fillStyle = "rgba(8,11,16,.82)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.strokeRect(bx + .5, by + .5, boxW - 1, boxH - 1);
    // a tick of accent on the leading edge
    ctx.fillStyle = accent;
    ctx.fillRect(side > 0 ? bx : bx + boxW - 1.5, by, 1.5, boxH);

    ctx.fillStyle = "rgba(238,244,250,.92)";
    ctx.fillText(text.toUpperCase(), bx + padX, by + boxH - 5.5);

    ctx.globalAlpha = 1;
  }

  // The scene calls this at the end of every frame it draws.
  api.annotHook(function (obj, part, t, camera, accent) {
    const w = cv.width / dpr, h = cv.height / dpr;
    ctx.clearRect(0, 0, w, h);
    if (!obj || !part || !part.notes || !part.notes.length) return;

    // fade in behind the lift, out before the dissolve
    const alpha = Math.max(0, Math.min(1, (t - 0.35) / 0.4));
    if (alpha <= 0.01) return;

    obj.updateWorldMatrix(true, false);
    part.notes.forEach(function (n) {
      v.set(n[0], n[1], n[2]);
      obj.localToWorld(v);
      v.project(camera);
      if (v.z > 1) return;                      // behind the camera
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      if (x < 0 || x > w || y < 0 || y > h) return;
      callout(x, y, n[3], alpha, accent || "#ffa23d");
    });
  });

  if (reduced) cv.style.display = "none";
})();
