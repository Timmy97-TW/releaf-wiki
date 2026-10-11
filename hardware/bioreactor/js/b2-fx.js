// B2 FX: the effects the three heroes share, on top of b2-core.js.
//   FX.groups          which parts belong to which function (the B2's floors, the membrane spine, the loops)
//   FX.run(ctx, s)     everything that keeps moving once the machine is on: flow in the lines (in each route's a -> b
//                      direction, i.e. the assumed flow), the culture pump's rotor, the culture's glow, the LED strips
//   FX.ring(...)       a thin level ring round the case (the "floor" marker), lit in the accent
//   FX.isolate(...)    full colour for a set of parts, x-ray rims for the rest
//   FX.path(...)       a polyline through several tubes and the parts between them (for a parcel)
// Illustrative, and said so on the page: the liquids' glow, the flow packets, the parcel, the rings.
(function () {
  "use strict";
  const V3 = THREE.Vector3;
  const { sat, ss, lerp, srgb } = { sat: B2.sat, ss: B2.ss, lerp: B2.lerp, srgb: RQ.srgb };

  // ---- what is what (part ids from tools/pack_b2.py)
  const G = {
    bottles: ["vessel", "culture", "stand", "protectant", "protectant liquid", "koh", "koh liquid", "drip tray"],
    photometer: ["v4", "photometer step"],
    pumps: ["pumpbox", "rotor", "pump_p", "pump_k", "deck 2", "KOH pump bracket", "KOH pump saddle", "protectant pump saddle"],
    membrane: ["membrane", "fibres", "valve5", "valve7", "sc1", "sc2", "sc4", "column backplate", "membrane clamp", "stopcock"],
    sensing: ["pt_pt1", "pt_pt2", "pt_pt3", "pt_pt4", "deck 3", "PT cradle"],
    sampler: ["sampler"],
    output: ["output"],
    filter: ["air_filter", "filter strap"],
  };
  const LOOPTUBES = {
    cul: ["c1", "c2", "c3", "c4", "c5", "c6"],
    pro: ["p1", "p2", "p3", "p4", "p5", "o1"],
    koh: ["k1", "k2"],
    sense: ["l1", "l2", "l3", "l4"],
    sample: ["s1"],
    air: ["f1"],
  };

  function partsOf(ctx, names) {
    const P = ctx.model.parts, out = [];
    names.forEach((n) => { if (P[n]) out.push(P[n]); });
    return out;
  }
  function isCase(id) { return id.indexOf("case:") === 0; }

  // ---- state reset each frame: every part home, opaque, no ghost; every tube visible, drawn, idle
  function reset(ctx) {
    const m = ctx.model;
    closeMembrane(ctx);
    if (cutU) { cutU.uCutK.value = 0; cutU.uWhite.value = 1; }
    Object.values(m.parts).forEach((P) => { P.offset.set(0, 0, 0); P.rot.set(0, 0, 0); P.fade = 1; P.ghost = 0; P.slotAmt = 0; P.ghostMat.uniforms.uScanW.value = 0; });
    Object.values(m.tubes).forEach((T) => {
      T.group.visible = true; T.wall.visible = true; T.wu.uDraw.value = 1; T.wu.uA.value = 1;
      if (T.u) { T.u.uDraw.value = 1; T.u.uFlow.value = 0; T.u.uGlow.value = 0; T.u.uParcel.value = -1e5; T.u.uBase.value = 1; T.u.uAlpha.value = 1; }
    });
  }

  // ---- the machine running. on: 0..1 (pumps and flow), glow: 0..1 per loop {cul, pro, koh}
  function run(ctx, clock, on, glow) {
    glow = glow || {};
    const m = ctx.model;
    Object.values(m.tubes).forEach((T) => {
      if (!T.u) return;
      T.u.uTime.value = clock;
      T.u.uSpeed.value = T.loop === "cul" ? 70 : 45;
      T.u.uFlow.value = T.flows ? on * 0.55 : 0;
      const g = glow[T.loop] || 0;
      T.u.uGlow.value = Math.max(T.u.uGlow.value, g * 0.35);
      if (g > 0 && T.flows) T.u.uFlow.value = Math.max(T.u.uFlow.value, g * 1.1);
    });
    // the culture pump's rotor: spun about its own axis (the box faces the open side, -x)
    const R = m.parts.rotor;
    if (R) {
      // integrated, so a scroll that changes `on` changes the speed, never jumps the angle
      if (R._ang === undefined) { R._ang = 0; R._last = clock; }
      const dt = Math.max(0, Math.min(0.1, clock - R._last)); R._last = clock;
      R._ang = (R._ang + dt * 2.6 * on) % (Math.PI * 2);
      R.rot.set(-R._ang, 0, 0);
    }
    // the culture's glow (illustrative) and the film's LED strips
    const cu = m.parts.culture;
    if (cu) cu.meshes.forEach((me) => { me.material.emissiveIntensity = (me.material.userData.emitBase || 0.1) * (0.6 + 1.6 * on); });
  }

  function strips(ctx, k) {
    Object.values(ctx.model.parts).forEach((P) => {
      if (!/led strip/i.test(P.id)) return;
      P.meshes.forEach((me) => { if (me.material.userData.emitBase !== undefined) me.material.emissiveIntensity = me.material.userData.emitBase * k; });
    });
  }

  // ---- isolate: the named parts stay in full colour; the others become x-ray rims (amount k). The case can be
  // kept (caseK = 0) or ghosted with the rest.
  function isolate(ctx, keep, k, caseK) {
    if (k <= 0.001) return;
    const set = {};
    keep.forEach((n) => { set[n] = 1; });
    Object.values(ctx.model.parts).forEach((P) => {
      if (set[P.id]) return;
      const kk = isCase(P.id) ? k * (caseK === undefined ? 0 : caseK) : k;
      if (kk <= 0) return;
      P.fade = Math.min(P.fade, 1 - kk * 0.94);
      P.ghost = Math.max(P.ghost, kk * 0.85);
    });
  }

  // ---- tubes: dim the lines that are not the subject
  function dimTubes(ctx, keepIds, k) {
    if (k <= 0.001) return;
    const set = {}; keepIds.forEach((t) => { set[t] = 1; });
    Object.values(ctx.model.tubes).forEach((T) => {
      if (set[T.id]) return;
      if (T.u) { T.u.uBase.value = lerp(1, 0.22, k); T.u.uFlow.value *= (1 - k); }
      T.wu.uA.value = lerp(1, 0.45, k);
    });
  }

  // ---- a level ring: a hairline outline just inside the case's posts, with a faint fill (round 1: the old ring was
  // an edge-lit slab outside the case that cut through the posts and the transducers)
  function ring(ctx, hex) {
    const b = ctx.model.box;
    const x0 = b.min.x + 20, x1 = b.max.x - 20, y0 = b.min.y + 34, y1 = b.max.y - 34;
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: srgb(hex || "#5aa9ff"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 4; i++) {
      const a = pts[i], c = pts[i + 1];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(L, 0.8, 0.8), mat);
      bar.position.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0);
      bar.rotation.z = Math.atan2(c[1] - a[1], c[0] - a[0]);
      g.add(bar);
    }
    const sheetMat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: srgb(hex || "#5aa9ff") }, uA: { value: 0 }, uSize: { value: new THREE.Vector2(x1 - x0, y1 - y0) } },
      vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 uCol; uniform float uA; uniform vec2 uSize; varying vec2 vU; void main(){ vec2 d = min(vU, 1.0 - vU) * uSize; float e = min(d.x, d.y); float a = 0.05 + 0.25 * exp(-e / 6.0); gl_FragColor = vec4(uCol * a * uA, 1.0); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), sheetMat);
    sheet.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    g.add(sheet);
    g.renderOrder = 9;
    ctx.scene.add(g);
    return {
      group: g,
      set: function (z, a, sheet) {
        g.position.z = z; g.visible = a > 0.003;
        mat.opacity = a * 0.9; sheetMat.uniforms.uA.value = a * 0.6 * (sheet === undefined ? 1 : sheet);
      },
    };
  }

  // ---- nothing between the camera and the subject (round 1). Every part whose box a sight line from the camera to
  // the subject passes through is hidden (fade to 0, no x-ray), weighted by k; so is every tube that passes within
  // its own radius of a sight line. targets: points on the subject (its box centre and inset corners).
  const _ray = new THREE.Ray(), _v = new V3(), _hit = new V3(), _bx = new THREE.Box3(), _rc = new THREE.Raycaster();
  function sightPoints(box, inset) {
    const c = box.getCenter(new V3()), h = box.getSize(new V3()).multiplyScalar(0.5 * (inset || 0.6));
    const out = [c];
    [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => [-1, 1].forEach((sz) => out.push(new V3(c.x + sx * h.x, c.y + sy * h.y, c.z + sz * h.z)))));
    return out;
  }
  function clearLine(ctx, targets, k, keepParts, keepTubes) {
    if (k <= 0.001) return;
    const C = ctx.cam.position;
    const kp = {}; (keepParts || []).forEach((id) => { kp[id] = 1; });
    const kt = {}; (keepTubes || []).forEach((id) => { kt[id] = 1; });
    Object.values(ctx.model.parts).forEach((P) => {
      if (kp[P.id]) return;
      _bx.copy(P.box).translate(P.offset).expandByScalar(1);
      for (let i = 0; i < targets.length; i++) {
        const T = targets[i];
        const L = C.distanceTo(T);
        _ray.origin.copy(C); _ray.direction.copy(T).sub(C).normalize();
        if (_bx.containsPoint(T)) {
          // the subject sits inside this part's box: one CAD object that wraps it (the four corner posts are one
          // mesh, so are the case's pipes). Only the first three sight lines are tested against the mesh itself.
          if (i > 2) continue;
          _rc.set(C, _ray.direction); _rc.far = L - 4;
          if (_rc.intersectObjects(P.meshes, false).length) { P.fade = Math.min(P.fade, 1 - k); P.ghost = 0; break; }
          continue;
        }
        if (_ray.intersectBox(_bx, _hit) && C.distanceTo(_hit) < L - 4) { P.fade = Math.min(P.fade, 1 - k); P.ghost = 0; break; }
      }
    });
    Object.values(ctx.model.tubes).forEach((T) => {
      if (kt[T.id]) return;
      const pts = T.curve.p, r = 6;
      let hit = false;
      for (let i = 0; i < targets.length && !hit; i++) {
        const Tg = targets[i], L = C.distanceTo(Tg);
        _v.copy(Tg).sub(C).normalize();
        for (let j = 0; j < pts.length; j += 3) {
          const q = pts[j];
          const s = (q.x - C.x) * _v.x + (q.y - C.y) * _v.y + (q.z - C.z) * _v.z;
          if (s <= 0 || s >= L - 6) continue;
          const dx = q.x - C.x - _v.x * s, dy = q.y - C.y - _v.y * s, dz = q.z - C.z - _v.z * s;
          if (dx * dx + dy * dy + dz * dz < r * r) { hit = true; break; }
        }
      }
      if (hit) hideTube(T, k);
    });
  }
  function hideTube(T, k) {
    T.wu.uA.value = Math.min(T.wu.uA.value, 1 - k);
    if (T.u) T.u.uAlpha.value = Math.min(T.u.uAlpha.value, 1 - k);
    if (k > 0.995) T.group.visible = false;
  }

  // ---- the subject alone: everything else drops to a dark trace (fade), with only a hairline of x-ray. The fade
  // and the rim are staggered so the two never add up to a milky body mid-handover (round 1).
  function only(ctx, keep, g, keepTubes) {
    if (g <= 0.001) return;
    const set = {}; keep.forEach((id) => { set[id] = 1; });
    const kt = {}; (keepTubes || []).forEach((id) => { kt[id] = 1; });
    const tg = ss(0, 0.6, g);
    Object.values(ctx.model.tubes).forEach((T) => {
      if (kt[T.id]) return;
      T.wu.uA.value = Math.min(T.wu.uA.value, 1 - 0.97 * tg);
      if (T.u) T.u.uAlpha.value = Math.min(T.u.uAlpha.value, 1 - 0.97 * tg);
      if (tg > 0.995) T.group.visible = false;
    });
    Object.values(ctx.model.parts).forEach((P) => {
      if (set[P.id] || isCase(P.id)) return;
      // all the way out: at 8 % a part with dozens of overlapping sub-meshes still read as a milky block
      P.fade = Math.min(P.fade, 1 - ss(0, 0.6, g));       // no rim at all (round 2: the 5 % rim drew blue smoke)
    });
  }

  // ---- a path for a parcel: tubes in order, joined by straight runs through the parts between them
  function path(ctx, ids) {
    const segs = [];
    let s = 0;
    const pts = [];
    ids.forEach((id, i) => {
      const T = ctx.model.tubes[id];
      const P = T.curve.p;
      if (pts.length) {
        const last = pts[pts.length - 1].p, first = P[0];
        const d = last.distanceTo(first);
        segs.push({ kind: "bridge", from: s, to: s + d, after: ids[i - 1], before: id });
        s += d;
      }
      const s0 = s;
      P.forEach((q, k) => {
        if (k > 0) s += q.distanceTo(P[k - 1]);
        pts.push({ p: q, s: s });
      });
      segs.push({ kind: "tube", id: id, from: s0, to: s });
    });
    const L = s;
    return {
      L: L, segs: segs,
      at: function (d, out) {
        out = out || new V3();
        d = Math.max(0, Math.min(L, d));
        let lo = 0, hi = pts.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= d) lo = m; else hi = m; }
        const k = (d - pts[lo].s) / Math.max(1e-9, pts[hi].s - pts[lo].s);
        return out.copy(pts[lo].p).lerp(pts[hi].p, k);
      },
      // light the parcel inside whichever tube it is in
      light: function (d, tail) {
        segs.forEach((g) => {
          if (g.kind !== "tube") return;
          const T = ctx.model.tubes[g.id];
          if (!T.u) return;
          if (d >= g.from - 40 && d <= g.to + (tail || 80)) { T.u.uParcel.value = d - g.from; T.u.uTail.value = tail || 60; }
        });
      },
      segOf: function (id) { return segs.find((g) => g.id === id); },
    };
  }

  // the membrane, opened: its shell turns to an x-ray rim and the fibre bundle inside lights in the culture's
  // colour (illustrative: the culture runs inside the fibres)
  function openMembrane(ctx, k) {
    if (k <= 0.001) return;
    const P = ctx.model.parts;
    if (P.membrane) { P.membrane.fade = Math.min(P.membrane.fade, 1 - 0.93 * k); P.membrane.ghost = Math.max(P.membrane.ghost, 0.5 * k); }
    if (P.fibres) P.fibres.meshes.forEach((m) => {
      if (!m.material.emissive) return;
      m.material.emissive.copy(RQ.srgb("#ff8a24")); m.material.emissiveIntensity = 0.55 * k;
    });
  }
  function closeMembrane(ctx) {
    const P = ctx.model.parts;
    if (P.fibres) P.fibres.meshes.forEach((m) => { if (m.material.emissive) m.material.emissiveIntensity = 0; });
  }

  // ---- the V4's beam (illustrative): from its amber LED (CAD, the mast's top) down to the flow cell (the gap between
  // c2 and c3). 171 mm with a 20 mm offset: the lab photometer's measured 8 degree lean. Drawn through the housing.
  const V4_LED = [-15, 112, 506.5], V4_CELL = [-36, 112, 335];
  function v4Beam(ctx) {
    const a = new V3(...V4_LED), b = new V3(...V4_CELL), L = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(2.4, 2.4, L, 16, 1, true); g.translate(0, L / 2, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: srgb("#ffa640").multiplyScalar(3.9) }, uA: { value: 0 }, uHead: { value: 1 } },
      vertexShader: "varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 uCol; uniform float uA, uHead; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ if (vU.y > uHead) discard; float f = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uCol * pow(f, 1.5) * uA, 1.0); }",
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
    mesh.renderOrder = 10; ctx.scene.add(mesh);
    const spot = ctx.glowSprite("#ffb050", 23); spot.material.depthTest = false; spot.material.color.multiplyScalar(2.2); spot.position.copy(b); ctx.scene.add(spot);
    // the LED itself, lit, where the beam starts (round 3: the beam began in mid-air)
    const led = ctx.glowSprite("#ffb050", 14); led.material.depthTest = false; led.material.color.multiplyScalar(3); led.position.copy(a); ctx.scene.add(led);
    return {
      cell: b, led: a,
      set: function (k, head, depth) {
        m.depthTest = !!depth; spot.material.depthTest = !!depth; led.material.depthTest = !!depth;
        m.uniforms.uA.value = k; m.uniforms.uHead.value = head === undefined ? 1 : head;
        mesh.visible = k > 0.003; spot.material.opacity = k * 0.8 * (head === undefined ? 1 : ss(0.85, 1, head));
        led.material.opacity = Math.min(1, k * 1.5);
        // the housing stays opaque; the light path inside it is drawn through it, as in the photometer's own hero
      },
    };
  }

  // ---- one subject across a handover (round 2): the union of the keep lists of every act on screen stays at full
  // strength, and the rest leaves by the summed weight of the acts that isolate. The incoming subject is never
  // half-faded while the outgoing act lets go.
  // (round 4) by weight, with no threshold: a part kept by an act on its way out leaves as that act's weight goes,
  // so nothing vanishes in one step when a weight crosses a cut-off
  function onlyActs(ctx, acts, w) {
    const keep = {}, tubes = {};
    let g = 0;
    acts.forEach((a, i) => {
      if (!(w[i] > 0) || !a.keep) return;
      g += w[i];
      a.keep.forEach((id) => { keep[id] = Math.max(keep[id] || 0, w[i]); });
      (a.tubes || []).forEach((id) => { tubes[id] = Math.max(tubes[id] || 0, w[i]); });
    });
    if (g <= 0.001) return;
    g = Math.min(1, g);
    const out = ss(0, 0.6, g);
    Object.values(ctx.model.parts).forEach((P) => {
      if (isCase(P.id)) return;
      const kw = keep[P.id] ? ss(0, 0.35, keep[P.id]) : 0;
      P.fade = Math.min(P.fade, Math.max(1 - out, kw));
    });
    Object.values(ctx.model.tubes).forEach((T) => {
      const kw = tubes[T.id] ? ss(0, 0.35, tubes[T.id]) : 0;
      const a = Math.max(1 - 0.97 * out, kw);
      T.wu.uA.value = Math.min(T.wu.uA.value, a);
      if (T.u) T.u.uAlpha.value = Math.min(T.u.uAlpha.value, a);
      if (a < 0.005) T.group.visible = false;
    });
  }

  // ---- sight lines, precomputed (round 2: raycasting CAD meshes every frame cost 35-40 ms frames in the handovers).
  // For an act, the parts and tubes in front of its subject are found once per size, from the camera at the act's
  // hold shot(s), with every sight line tested against the meshes; each frame only applies the set, weighted.
  const _tc = new THREE.PerspectiveCamera(30, 1, 5, 20000);
  function camAt(ctx, shot) { _tc.aspect = ctx.aspect; ctx.placeCamera(_tc, ctx.shotFor(shot, ctx.aspect)); return _tc.position.clone(); }
  const _cache = {};
  function hiddenSet(ctx, key, cams, targets, keepParts, keepTubes) {
    const ck = key + "|" + (ctx.sizeKey || 0) + "|" + (ctx.aspect < 0.8 ? "p" : "l");
    if (_cache[ck]) return _cache[ck];
    const kp = {}; (keepParts || []).forEach((id) => { kp[id] = 1; });
    const kt = {}; (keepTubes || []).forEach((id) => { kt[id] = 1; });
    const parts = {}, tubes = {};
    cams.forEach((C) => {
      Object.values(ctx.model.parts).forEach((P) => {
        if (kp[P.id] || parts[P.id]) return;
        _bx.copy(P.box).expandByScalar(1);
        for (let i = 0; i < targets.length; i++) {
          const T = targets[i], L = C.distanceTo(T);
          _ray.origin.copy(C); _ray.direction.copy(T).sub(C).normalize();
          if (!_ray.intersectBox(_bx, _hit)) continue;
          if (_bx.containsPoint(T) || C.distanceTo(_hit) < L - 4) {
            _rc.set(C, _ray.direction); _rc.far = L - 4;
            P.pivot.updateMatrixWorld(true);
            if (_rc.intersectObjects(P.meshes, false).length) { parts[P.id] = 1; break; }
          }
        }
      });
      Object.values(ctx.model.tubes).forEach((T) => {
        if (kt[T.id] || tubes[T.id]) return;
        const pts = T.curve.p, r = 6;
        for (let i = 0; i < targets.length; i++) {
          const Tg = targets[i], L = C.distanceTo(Tg);
          _v.copy(Tg).sub(C).normalize();
          for (let j = 0; j < pts.length; j += 2) {
            const q = pts[j];
            const s = (q.x - C.x) * _v.x + (q.y - C.y) * _v.y + (q.z - C.z) * _v.z;
            if (s <= 0 || s >= L - 6) continue;
            const dx = q.x - C.x - _v.x * s, dy = q.y - C.y - _v.y * s, dz = q.z - C.z - _v.z * s;
            if (dx * dx + dy * dy + dz * dz < r * r) { tubes[T.id] = 1; return; }
          }
        }
      });
    });
    return (_cache[ck] = { parts: Object.keys(parts), tubes: Object.keys(tubes) });
  }
  function applyHidden(ctx, set, k) {
    if (!set || k <= 0.001) return;
    set.parts.forEach((id) => { const P = ctx.model.parts[id]; if (P) { P.fade = Math.min(P.fade, 1 - k); P.ghost = 0; } });
    set.tubes.forEach((id) => { const T = ctx.model.tubes[id]; if (T) hideTube(T, k); });
  }

  // ---- the membrane opened by a level (round 2): below z the shell is cut away and the fibres glow in the culture's
  // colour; above it the column is closed. A shader clip in world z on the shell and the fibre bundle.
  let cutU = null;
  function membraneCut(ctx) {
    if (cutU) return cutU;
    // (uFeather, V4 round 4b: the shell's cut edge feathered over this many mm; 0 = the hard edge V1-V3 use)
    cutU = { uCut: { value: -1e4 }, uCutK: { value: 0 }, uDk: { value: 1 }, uAmb: { value: srgb("#9a7232") }, uWhite: { value: 1 }, uFeather: { value: 0 } };
    const patch = (mesh, kind) => {
      const m = mesh.material;
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = function (sh, r) {
        if (prev) prev.call(this, sh, r);
        sh.uniforms.uCut = cutU.uCut; sh.uniforms.uCutK = cutU.uCutK; sh.uniforms.uAmb = cutU.uAmb; sh.uniforms.uDk = cutU.uDk; sh.uniforms.uWhite = cutU.uWhite; sh.uniforms.uFeather = cutU.uFeather;
        sh.vertexShader = "varying float vWZ;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vWZ = (modelMatrix * vec4(transformed, 1.0)).z;");
        let fs = "uniform float uCut, uCutK, uDk, uWhite, uFeather; uniform vec3 uAmb; varying float vWZ;\n" + sh.fragmentShader;
        // below the cut the shell stays as a faint sleeve (12 %), so there is an inside and an outside, and its ports
        // stay connected (round 3: a discard made the shell and its four ports vanish in one frame)
        if (kind === "shell") fs = fs.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor.rgb *= uWhite;\n if (uCutK > 0.0) gl_FragColor.a *= mix(1.0, 0.12, uCutK * (1.0 - smoothstep(uCut - uFeather - 1e-3, uCut, vWZ)));");
        else fs = fs.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n float below = uCutK * (1.0 - smoothstep(uCut - 6.0, uCut + 2.0, vWZ));\n diffuseColor.rgb = mix(diffuseColor.rgb * uWhite, uAmb * uDk, below);\n totalEmissiveRadiance += uAmb * below * 0.35 * uDk;");
        sh.fragmentShader = fs;
      };
      const k0 = m.customProgramCacheKey ? m.customProgramCacheKey() : "";
      m.customProgramCacheKey = () => k0 + "|cut-" + kind;
      m.needsUpdate = true;
      if (kind === "fibre") { m.roughness = 0.85; m.envMapIntensity = 0.15; m.userData.baseEnv = 0.15; }
      // the shell's glass caught the studio's softboxes as white D-shaped spots on the column (round 3)
      if (kind === "shell") { m.envMapIntensity = 0.25; m.userData.baseEnv = 0.25; m.clearcoat = 0.2; }
    };
    const P = ctx.model.parts;
    if (P.membrane) P.membrane.meshes.forEach((me) => { if (!/end ring/.test(me.userData.matName)) patch(me, "shell"); });
    if (P.fibres) { P.fibres.meshes.forEach((me) => patch(me, "fibre")); P.fibres.onApply = (dk) => { cutU.uDk.value = dk; }; }
    // evenly spaced white D's on the column were shadow banding from the clamps: the column takes no shadows
    [P.membrane, P.fibres].forEach((q) => q && q.meshes.forEach((me) => { me.receiveShadow = false; }));
    return cutU;
  }
  function setCut(ctx, z, k) { const u = membraneCut(ctx); u.uCut.value = z; u.uCutK.value = k; }
  // round 6: the white shell and fibres above the cut are scaled down (1 = as lit) so the column does not flare
  function setWhite(ctx, k) { membraneCut(ctx).uWhite.value = k; }

  // ---- the far wall (far side panel + backplate) held at black for close acts (round 3: a lit grey wall with
  // 45-degree slots stood behind every subject)
  function darkWall(ctx, k) {
    if (k <= 0.001) return;
    Object.values(ctx.model.parts).forEach((P) => {
      if (/^case:(RIGHT PANEL|RIGHT_PANEL_4-SLOT|BACK PANEL)$/.test(P.id)) P.fade = Math.min(P.fade, 1 - 0.55 * k);   // 0.45: opaque black
    });
  }

  // ---- protectant leaving the fibres (illustrative): motes drift out of the bundle into the gap under the shell
  // sleeve, below a level z, then rise toward the upper shell port. Returns {set(z, k, clock)}.
  // opt (V4 round 4b): {r0, r1, rp}: the radii out of the bundle, up the gap, and at the port (defaults: V1-V3's)
  function membraneMotes(ctx, axis, hiPort, opt) {
    opt = opt || {}; const R0 = opt.r0 || 17, R1 = opt.r1 || 24.5, RP = opt.rp || 30;
    const N = 340, pos = new Float32Array(N * 3), m = [];
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) m.push({ a: rnd() * Math.PI * 2, z: 232 + rnd() * 215, ph: rnd(), sp: 0.12 + rnd() * 0.1 });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({ color: srgb("#2ef09a").multiplyScalar(3), size: 11, sizeAttenuation: true, map: new THREE.CanvasTexture(c),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    // (opt.fade, V4 round 4b: each mote fades in at the bundle and out at the port, so its wrap back to the start is
    // invisible; additive, so a vertex colour of 0 is no light at all)
    const fcol = opt.fade ? new Float32Array(N * 3) : null;
    if (fcol) { g.setAttribute("color", new THREE.BufferAttribute(fcol, 3)); mat.vertexColors = true; }
    const pts = new THREE.Points(g, mat); pts.renderOrder = 11; pts.frustumCulled = false; ctx.scene.add(pts);
    return {
      set: function (zc, k, clock) {
        pts.visible = k > 0.003; mat.opacity = k;
        if (!pts.visible) return;
        m.forEach((q, i) => {
          const t = (q.ph + clock * q.sp) % 1;
          let r, z = q.z, a = q.a;
          if (q.z > zc) { pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = -1e4; return; }   // only where the shell is open
          r = lerp(R0, R1, ss(0, 0.35, t));                                                      // out of the bundle
          z = q.z + t * 60;                                                                        // and up the gap
          if (t > 0.7) {                                                                           // gathering to the port
            const u = ss(0.7, 1, t);
            a = lerp(a, Math.PI / 2, u); z = lerp(z, hiPort[2], u * 0.8); r = lerp(r, RP, u);
          }
          pos[i * 3] = axis[0] + Math.cos(a) * r; pos[i * 3 + 1] = axis[1] + Math.sin(a) * r; pos[i * 3 + 2] = Math.min(z, 452);
          if (fcol) { const f = ss(0, 0.1, t) * (1 - ss(0.88, 0.995, t)); fcol[i * 3] = fcol[i * 3 + 1] = fcol[i * 3 + 2] = f; }
        });
        g.attributes.position.needsUpdate = true; if (fcol) g.attributes.color.needsUpdate = true;
      },
    };
  }

  // the p values to pre-draw under the loader: every act's entry, both sides of it, and the middle of each travel
  function warmList(A, hold0) {
    const out = [];
    A.forEach((a, i) => {
      const w0 = a.win[0], w1 = i < A.length - 1 ? A[i + 1].win[0] : 1, h = a.hold === undefined ? (hold0 || 0.55) : a.hold;
      [w0 - 0.012, w0 - 0.004, w0 + 0.004, w0 + 0.012, w0 + (w1 - w0) * (h + (1 - h) * 0.5)].forEach((q) => { if (q > 0 && q < 1) out.push(+q.toFixed(4)); });
    });
    return out;
  }

  window.FX = { warmList: warmList, darkWall: darkWall, membraneMotes: membraneMotes, onlyActs: onlyActs, camAt: camAt, hiddenSet: hiddenSet, applyHidden: applyHidden, membraneCut: membraneCut, setCut: setCut, setWhite: setWhite, v4Beam: v4Beam, clearLine: clearLine, sightPoints: sightPoints, hideTube: hideTube, only: only, openMembrane: openMembrane, closeMembrane: closeMembrane, G: G, LOOPTUBES: LOOPTUBES, partsOf: partsOf, isCase: isCase, reset: reset, run: run, strips: strips,
                isolate: isolate, dimTubes: dimTubes, ring: ring, path: path };
})();
