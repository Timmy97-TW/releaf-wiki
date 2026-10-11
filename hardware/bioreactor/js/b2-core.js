// B2 core: the compact B2 bioreactor as a live three.js scene, shared by the three hero prototypes.
//
// Loads model/b2.json + b2.bin (tools/pack_b2.py: the Blender scene b2.blend, r5 "compact", decimated) and
// model/tubes.json (the 20 hand-placed tube routes, the same centrelines the Blender tubes were swept along).
// World = the tower CAD frame in mm, Z up: -x is the open side (no panel), -y the I/O end, +y the back end.
//
// What it gives a scene module:
//   B2.boot(cfg)          renderer + LOOK composer (bloom, ACES, grain) + studio lights + floor + story-core hookup
//   model.parts[id]       every part as a pivot group at its own centre: .offset (Vector3), .spin, fade/ghost
//   model.tubes[id]       wall + liquid core; the core's shader draws the flow (packets along the route, in the
//                         route's own a -> b direction), a draw-on head, a parcel and a glow level
//   Dir                   camera shots framed from a subject's bounding sphere; hold 55 %, then a quintic travel
// Every frame is a function of p (scroll) plus the clock for the things that keep moving (flow, rotor, breath).
(function () {
  "use strict";
  const srgb = RQ.srgb;
  const V3 = THREE.Vector3;

  /* ---------------------------------------------------------------------------------------------- maths */
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sat = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const quint = (t) => { t = sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const easeOut = (t) => 1 - Math.pow(1 - sat(t), 3);
  const easeIn = (t) => Math.pow(sat(t), 3);
  const win = (p, a, b) => sat((p - a) / (b - a));
  // a bump that is 0 outside [a, d], 1 inside [b, c], smooth between
  const band = (p, a, b, c, d) => ss(a, b, p) * (1 - ss(c, d, p));

  /* ------------------------------------------------------------------------------------------ loading */
  function fetchBin(url) { return fetch(url).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.arrayBuffer(); }); }
  function fetchJson(url) { return fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }); }

  // port only (tools/b2web/sync_v4.py): the light web model's pack format v2 (tools/b2web/pack_b2_web.py --enc 2). The
  // same numbers as v1, re-ordered for deflate: positions per axis as zigzag deltas (16-bit wrap), low bytes then high
  // bytes; normals per axis (or none: "nrm": -1, computed here); indices as zigzag deltas, byte-planed.
  function decodeChunk2(buf, c) {
    const nv = c.nv, ni = c.ni, n3 = nv * 3, u8 = new Uint8Array(buf), P = c.pos, I = c.idx;
    const pos = new Float32Array(n3), lo = c.lo, sp = c.span;
    for (let k = 0; k < 3; k++) {
      let q = 0;
      for (let i = 0, j = P + k * nv; i < nv; i++, j++) {
        const z = u8[j] | (u8[j + n3] << 8);
        q = (q + ((z >>> 1) ^ -(z & 1))) & 0xffff;
        pos[i * 3 + k] = lo[k] + (q / 65535) * sp[k];
      }
    }
    let nrm = null;
    if (c.nrm >= 0) {
      nrm = new Int8Array(n3); const N8 = new Int8Array(buf, c.nrm, n3);
      for (let k = 0; k < 3; k++) for (let i = 0; i < nv; i++) nrm[i * 3 + k] = N8[k * nv + i];
    }
    const idx = c.i32 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0;
    if (c.i32) {
      for (let i = 0, j = I; i < ni; i++, j++) {
        const z = (u8[j] | (u8[j + ni] << 8) | (u8[j + 2 * ni] << 16) | (u8[j + 3 * ni] << 24)) >>> 0;
        v = (v + ((z >>> 1) ^ -(z & 1))) | 0; idx[i] = v;
      }
    } else {
      for (let i = 0, j = I; i < ni; i++, j++) {
        const z = u8[j] | (u8[j + ni] << 8);
        v = (v + ((z >>> 1) ^ -(z & 1))) & 0xffff; idx[i] = v;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    // no normals in the pack (pack_b2_web.py --no-normals): the vertices are already split at the 35-degree creases,
    // so each one averages the faces of its own smooth group
    if (nrm) g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3, true)); else g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  function decodeChunk(buf, c) {
    if (c.enc === 2) return decodeChunk2(buf, c);
    const nv = c.nv, q = new Uint16Array(buf, c.pos, nv * 3), pos = new Float32Array(nv * 3);
    const lo = c.lo, sp = c.span;
    for (let i = 0; i < nv * 3; i += 3) {
      pos[i] = lo[0] + (q[i] / 65535) * sp[0];
      pos[i + 1] = lo[1] + (q[i + 1] / 65535) * sp[1];
      pos[i + 2] = lo[2] + (q[i + 2] / 65535) * sp[2];
    }
    const nrm = new Int8Array(nv * 3); nrm.set(new Int8Array(buf, c.nrm, nv * 3));
    const idx = c.i32 ? new Uint32Array(buf, c.idx, c.ni).slice() : new Uint16Array(buf, c.idx, c.ni).slice();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3, true));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }

  /* ---------------------------------------------------------------------------------------- materials */
  // The Blender materials are read from the pack (Principled BSDF inputs) and mapped onto four looks. The film's
  // and the r5 renders' palette is the reference: matte black case, satin aluminium, blue pump box, amber culture,
  // nearly clear bottles and silicone. Names drive the special cases; everything else follows its numbers.
  function classify(e) {
    const n = (e.name || "").toLowerCase();
    if (/led strip|strip core|emiss/.test(n) || (e.estr || 0) > 2) return "emit";
    if (/liquid|medium|culture/.test(n) && !/tube/.test(n)) return "liquid";
    if ((e.trans || 0) > 0.5 || /glass|clear|frosted/.test(n)) return "glass";
    return "solid";
  }

  const GLASS_FRAG_HOOK = [
    "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
    // round V4-2: when the camera passes through a glass surface vViewPosition can be ~0, and the fresnel went NaN;
    // bloom then spread one NaN pixel into a black block. Guarded, clamped, and NaN zeroed.
    "float frB2 = pow(clamp(1.0 - abs(dot(normalize(vViewPosition + vec3(1e-6)), normalize(normal))), 0.0, 1.0), uGPow);\n" +
    "vec3 oB2 = outgoingLight + uGTint * frB2 * uGRimLight; float aB2 = clamp(mix(uGFace, uGRim, frB2), 0.0, 1.0) * diffuseColor.a;\n" +
    "if (!(oB2.r == oB2.r && oB2.g == oB2.g && oB2.b == oB2.b && aB2 == aB2)) { oB2 = vec3(0.0); aB2 = 0.0; }\n" +
    "gl_FragColor = vec4( min(oB2, vec3(64.0)), aB2 );",
  ];
  function glassMat(tint, opt) {
    opt = opt || {};
    const m = new THREE.MeshPhysicalMaterial({
      color: srgb(tint || "#dfe8ee"), metalness: 0, roughness: opt.rough === undefined ? 0.06 : opt.rough,
      transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: opt.env === undefined ? 1.0 : opt.env,
    });
    m.userData.glass = { face: opt.face === undefined ? 0.03 : opt.face, rim: opt.rim === undefined ? 0.45 : opt.rim,
                         pow: opt.pow || 2.6, rimLight: opt.rimLight === undefined ? 0.05 : opt.rimLight };
    m.onBeforeCompile = function (sh) {
      const g = m.userData.glass;
      sh.uniforms.uGFace = { value: g.face }; sh.uniforms.uGRim = { value: g.rim }; sh.uniforms.uGPow = { value: g.pow };
      sh.uniforms.uGRimLight = { value: g.rimLight }; sh.uniforms.uGTint = { value: m.color };
      sh.fragmentShader = "uniform float uGFace, uGRim, uGPow, uGRimLight; uniform vec3 uGTint;\n" +
        sh.fragmentShader.replace(GLASS_FRAG_HOOK[0], GLASS_FRAG_HOOK[1]);
      m.userData.shader = sh;
    };
    m.customProgramCacheKey = () => "b2glass";
    return m;
  }

  function solidMat(e, over) {
    over = over || {};
    const metal = over.metal !== undefined ? over.metal : (e.metal || 0);
    return new THREE.MeshPhysicalMaterial({
      color: srgb(over.color || e.color || "#808080"),
      metalness: metal,
      roughness: over.rough !== undefined ? over.rough : clamp(e.rough === undefined ? 0.5 : e.rough, 0.12, 1),
      clearcoat: over.coat !== undefined ? over.coat : Math.min(0.6, e.coat || 0),
      clearcoatRoughness: 0.25,
      envMapIntensity: over.env !== undefined ? over.env : (metal > 0.5 ? 1.15 : 0.9),
    });
  }

  // name -> look overrides, tuned against dev/lab-bioreactor/b2-model/renders/*.jpg
  const OVERRIDES = [];
  function override(re, o) { OVERRIDES.push([re, o]); }

  function makeMaterial(e) {
    for (const [re, o] of OVERRIDES) if (re.test(e.name || "")) {
      if (o.kind === "glass") return glassMat(o.tint || e.color, o);
      if (o.kind === "emit") return emitMat(o.color || e.emit || e.color, o.i || 3);
      if (o.kind === "liquid") return liquidMat(o.color || e.color, o);
      if (o.kind === "hide") { const m = new THREE.MeshBasicMaterial(); m.visible = false; return m; }
      return solidMat(e, o);
    }
    const k = classify(e);
    if (k === "emit") return emitMat(e.emit || e.color, Math.min(4, 1 + (e.estr || 1) * 0.3));
    if (k === "liquid") return liquidMat(e.color, {});
    if (k === "glass") return glassMat(mixHex(e.color || "#ffffff", "#ffffff", 0.35), {});
    return solidMat(e);
  }

  function emitMat(hex, i) {
    const m = new THREE.MeshStandardMaterial({ color: srgb("#000000"), emissive: srgb(hex), emissiveIntensity: i, roughness: 0.4 });
    m.userData.emitBase = i;
    return m;
  }

  // Liquid in a bottle: a coloured body that is lit, a little see-through, and carries its own faint glow (the
  // glow is illustrative: the reference renders light the culture from behind with the film's backlight).
  function liquidMat(hex, o) {
    const m = new THREE.MeshPhysicalMaterial({
      color: srgb(hex || "#f7d46a"), roughness: 0.18, metalness: 0, transparent: true,
      opacity: o.opacity === undefined ? 0.82 : o.opacity, depthWrite: false, side: THREE.DoubleSide,
      emissive: srgb(o.glow || hex || "#f7d46a"), emissiveIntensity: o.gi === undefined ? 0.12 : o.gi, envMapIntensity: 0.8,
      clearcoat: 0.6, clearcoatRoughness: 0.1,
    });
    m.userData.emitBase = m.emissiveIntensity;
    return m;
  }

  function mixHex(a, b, t) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return "#" + pa.map((x, i) => Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, "0")).join("");
  }

  /* ------------------------------------------------------------------------------------- ghost (x-ray) */
  // A part being "seen through": its own surface fades out and a fresnel rim in the accent takes its place.
  // Additive on the dark stage, depth-tested, never writing depth.
  const GHOST_VERT = `
    varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = -mv.xyz; vW = (modelMatrix * vec4(position,1.0)).xyz;
      gl_Position = projectionMatrix * mv;
    }`;
  const GHOST_FRAG = `
    uniform vec3 uCol; uniform float uAmt, uScanZ, uScanW;
    varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main() {
      float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      float a = uAmt * (0.006 + 0.42 * pow(f, 3.0));
      float sc = uScanW > 0.0 ? exp(-pow((vW.z - uScanZ) / uScanW, 2.0)) : 0.0;
      gl_FragColor = vec4(uCol * (a + sc * uAmt * 0.9), 1.0);
    }`;
  function ghostMat(hex) {
    return new THREE.ShaderMaterial({
      uniforms: { uCol: { value: srgb(hex || "#4f95e6") }, uAmt: { value: 0 }, uScanZ: { value: -1e4 }, uScanW: { value: 0 } },
      vertexShader: GHOST_VERT, fragmentShader: GHOST_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  }

  /* -------------------------------------------------------------------------------------------- tubes */
  class Poly extends THREE.Curve {
    constructor(pts) {
      super();
      this.p = pts.map((q) => new V3(q[0], q[1], q[2]));
      this.s = [0];
      for (let i = 1; i < this.p.length; i++) this.s.push(this.s[i - 1] + this.p[i].distanceTo(this.p[i - 1]));
      this.L = this.s[this.s.length - 1];
    }
    getPoint(t, out) {
      out = out || new V3();
      const d = sat(t) * this.L, s = this.s;
      let lo = 0, hi = s.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= d) lo = m; else hi = m; }
      const k = (d - s[lo]) / Math.max(1e-9, s[hi] - s[lo]);
      return out.copy(this.p[lo]).lerp(this.p[hi], k);
    }
    at(mm, out) { return this.getPoint(mm / this.L, out); }
  }

  const FLOW_VERT = `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
    }`;
  // The liquid core. Base: the liquid's own colour, shaded as a lit cylinder (view-facing term) so it reads round.
  // Flow: soft packets every uPer mm moving at uSpeed mm/s along the route (a -> b). Draw-on: nothing past the
  // head (uDraw, as a fraction of the length), with a bright head. Parcel: a bright bead at uParcel mm with a tail.
  const FLOW_FRAG = `
    uniform vec3 uCol, uHot; uniform float uLen, uTime, uSpeed, uPer, uDraw, uFlow, uBase, uGlow, uParcel, uTail, uAlpha;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      float s = vUv.x * uLen;
      float head = uDraw * uLen;
      if (s > head + 0.5 || uAlpha < 0.004) discard;
      float facing = abs(dot(normalize(vN), normalize(vV)));
      vec3 c = uCol * (uBase * (0.35 + 0.65 * facing));
      float ph = fract((s - uTime * uSpeed) / uPer);
      float pk = smoothstep(0.0, 0.18, ph) * (1.0 - smoothstep(0.32, 0.62, ph));
      c += uHot * pk * uFlow * (0.55 + 0.45 * facing);
      c += uHot * uGlow * (0.4 + 0.6 * facing);
      float hd = exp(-pow((head - s) / 6.0, 2.0)) * step(uDraw, 0.999);
      c += uHot * hd * 2.6;
      // the parcel: a lit slug of culture, uTail mm long behind a bright head (round 1: a 5 mm bead could not be read)
      float dp = uParcel - s;
      float bead = exp(-pow(dp / 7.0, 2.0)) * 4.0 + (dp > 0.0 ? smoothstep(uTail, uTail * 0.55, dp) * 1.8 : 0.0);
      c += uHot * bead;
      gl_FragColor = vec4(c, uAlpha);
    }`;

  function flowMat(col, hot) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: srgb(col) }, uHot: { value: srgb(hot || col) }, uLen: { value: 1 }, uTime: { value: 0 },
        uSpeed: { value: 60 }, uPer: { value: 34 }, uDraw: { value: 1 }, uFlow: { value: 0.0 }, uBase: { value: 1.0 },
        uGlow: { value: 0 }, uParcel: { value: -1e5 }, uTail: { value: 60 }, uAlpha: { value: 1 },
      },
      vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG,
      // transparent (with depth writes) only so a core can fade out when it is in front of the subject
      transparent: true, depthWrite: true,
    });
  }

  // loop colours: the liquid's own colour (the renders) and the colour its flow glows in (the page's loop colours)
  const LOOPS = {
    cul: { col: "#c28a34", hot: "#ff9a2e", name: "culture" },
    pro: { col: "#aab3b6", hot: "#2ef09a", name: "protectant" },
    koh: { col: "#aab0ba", hot: "#8fb6ff", name: "KOH" },
    air: { col: "#000000", hot: "#ffffff", name: "air" },
  };
  // dead-end lines (pressure sensing, the sampler line) hold liquid but do not flow
  const STATIC = { l1: 1, l2: 1, l3: 1, l4: 1, s1: 1 };

  // The silicone wall: water-clear, so all it shows is a rim and one soft highlight (a shader, not a transmissive
  // physical material: 20 of those cost a re-render each). Discards past the draw-on head with its core.
  const WALL_FRAG = `
    uniform vec3 uCol; uniform float uLen, uDraw, uA; uniform vec3 uL;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      if (vUv.x * uLen > uDraw * uLen + 0.5) discard;
      vec3 n = normalize(vN), v = normalize(vV);
      float f = 1.0 - abs(dot(n, v));
      vec3 h = normalize(normalize(uL) + v);
      float sp = pow(max(dot(n, h), 0.0), 60.0);
      float a = (0.035 + 0.55 * pow(f, 2.2)) * uA;
      gl_FragColor = vec4(uCol * (0.25 + 0.75 * f) + vec3(1.0) * sp * 1.4 * uA, a + sp * 0.5 * uA);
    }`;
  function wallMatFor(L) {
    return new THREE.ShaderMaterial({
      uniforms: { uCol: { value: srgb("#e8f0f6") }, uLen: { value: L }, uDraw: { value: 1 }, uA: { value: 1 }, uL: { value: new V3(-0.3, -0.2, 0.9) } },
      vertexShader: FLOW_VERT, fragmentShader: WALL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
  }

  function buildTube(t, wallMat) {
    const curve = new Poly(t.pts);
    const segs = Math.max(8, t.pts.length - 1);
    const wallG = new THREE.TubeGeometry(curve, segs, t.od / 2, 14, false);
    const wm = wallMatFor(curve.L);
    const wall = new THREE.Mesh(wallG, wm);
    wall.renderOrder = 3;
    const lp = LOOPS[t.loop] || LOOPS.cul;
    let core = null, mat = null;
    if (t.loop !== "air") {
      const coreG = new THREE.TubeGeometry(curve, segs, t.idd / 2 * 0.92, 10, false);
      mat = flowMat(lp.col, lp.hot);
      mat.uniforms.uLen.value = curve.L;
      core = new THREE.Mesh(coreG, mat);
      core.renderOrder = 1;
    }
    const g = new THREE.Group(); g.add(wall); if (core) g.add(core);
    return { id: t.id, loop: t.loop, what: t.what, a: t.a, b: t.b, curve: curve, L: curve.L, group: g, wall: wall,
             core: core, u: mat ? mat.uniforms : null, wu: wm.uniforms, flows: !STATIC[t.id] };
  }

  /* --------------------------------------------------------------------------------------------- model */
  function loadModel(base, onProgress) {
    base = base.replace(/\/?$/, "/");
    return fetchJson(base + "b2.json").then((man) => Promise.all([
      fetchBin(base + "b2.bin?v=" + man.v).then((b) => { onProgress && onProgress(0.7); return b; }),
      fetchJson(base + "tubes.json"),
    ]).then(([buf, tj]) => build(man, buf, tj)));
  }

  function build(man, buf, tj) {
    const root = new THREE.Group();
    const mats = man.mats.map(makeMaterial);
    const parts = {};
    const box = new THREE.Box3();
    man.chunks.forEach((c) => {
      const geo = decodeChunk(buf, c);
      const id = c.part;
      if (!parts[id]) parts[id] = { id: id, chunks: [], box: new THREE.Box3() };
      parts[id].chunks.push({ geo: geo, mat: mats[c.mat], matName: man.mats[c.mat].name, objs: c.objs });
      parts[id].box.union(geo.boundingBox);
    });
    Object.values(parts).forEach((P) => {
      const ctr = P.box.getCenter(new V3());
      P.center = ctr; P.size = P.box.getSize(new V3()); P.radius = P.size.length() / 2;
      P.pivot = new THREE.Group(); P.pivot.position.copy(ctr); P.pivot.name = P.id;
      P.inner = new THREE.Group(); P.inner.position.copy(ctr).multiplyScalar(-1); P.pivot.add(P.inner);
      P.meshes = []; P.ghosts = [];
      P.ghostMat = ghostMat();
      P.chunks.forEach((ch) => {
        const m = ch.mat.clone();
        if (ch.mat.onBeforeCompile) { m.onBeforeCompile = ch.mat.onBeforeCompile.bind(m); m.userData = Object.assign({}, ch.mat.userData); m.customProgramCacheKey = ch.mat.customProgramCacheKey; }
        m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; m.userData.baseDepthWrite = m.depthWrite;
        const mesh = new THREE.Mesh(ch.geo, m);
        mesh.castShadow = !m.transparent; mesh.receiveShadow = true;
        mesh.userData.matName = ch.matName;
        P.inner.add(mesh); P.meshes.push(mesh);
        const gh = new THREE.Mesh(ch.geo, P.ghostMat); gh.visible = false; gh.renderOrder = 6; P.inner.add(gh); P.ghosts.push(gh);
      });
      P.offset = new V3(); P.rot = new THREE.Euler(); P.fade = 1; P.ghost = 0;
      // a blueprint of the part that stays at home while the part itself is away (the build story)
      P.slotMat = ghostMat("#5aa9ff"); P.slot = new THREE.Group(); P.slotAmt = 0; P.slot.visible = false;
      P.chunks.forEach((ch) => { const sm = new THREE.Mesh(ch.geo, P.slotMat); sm.renderOrder = 6; P.slot.add(sm); });
      root.add(P.slot);
      root.add(P.pivot);
      box.union(P.box);
    });
    // tubes
    const wallMat = glassMat("#eef3f6", { face: 0.05, rim: 0.5, pow: 2.2, rimLight: 0.02, env: 1.3 });
    const tubes = {};
    const tubeRoot = new THREE.Group();
    tj.tubes.forEach((t) => { const T = buildTube(t, wallMat); tubes[t.id] = T; tubeRoot.add(T.group); });
    root.add(tubeRoot);
    return { root: root, parts: parts, tubes: tubes, tubeRoot: tubeRoot, wallMat: wallMat, box: box, man: man, mats: mats };
  }

  // per-part state, applied once per frame
  function applyPart(P) {
    P.pivot.position.copy(P.center).add(P.offset);
    P.pivot.rotation.copy(P.rot);
    const f = P.fade, g = P.ghost;
    const vis = f > 0.302;          // below 0.3 a part is fully transparent (op = 0): do not draw it at all
    // Out through black (round 2): from fade 1 to 0.45 a part keeps full opacity and depth and darkens to black; only
    // below 0.45 does it turn transparent. A part with dozens of overlapping see-through sub-meshes then never
    // stacks into a milky block while it leaves (or arrives).
    // (round 3) the see-through part of the fade is short, so a part arriving never reads as a glassy ghost
    const dk = ss(0.45, 1, f), op = ss(0.3, 0.45, f);
    P.meshes.forEach((m) => {
      const mt = m.material, u = mt.userData;
      m.visible = vis;
      if (!vis) return;
      if (!u.baseColor) { u.baseColor = mt.color.clone(); u.baseEnv = mt.envMapIntensity; u.baseEmI = mt.emissiveIntensity; }
      if (u.dk !== dk) {
        mt.color.copy(u.baseColor).multiplyScalar(dk);
        if (u.baseEnv !== undefined) mt.envMapIntensity = u.baseEnv * dk;
        u.dk = dk;
      }
      if (mt.emissiveIntensity !== undefined) {
        // scale whatever this frame set (or the last value set) by dk, without compounding across frames
        if (mt.emissiveIntensity !== u.emOut) u.emIn = mt.emissiveIntensity;
        mt.emissiveIntensity = u.emIn * dk; u.emOut = mt.emissiveIntensity;
      }
      const wantT = op < 0.999 || u.baseTransparent;
      // no needsUpdate: in r128 `transparent` only picks the render list, it is not part of the program key
      mt.transparent = wantT;
      mt.opacity = u.baseOpacity * op;
      mt.depthWrite = op >= 0.999 ? u.baseDepthWrite : false;
      m.castShadow = f > 0.6 && !u.baseTransparent;
    });
    if (P.onApply) P.onApply(dk);
    P.slotMat.uniforms.uAmt.value = P.slotAmt; P.slot.visible = P.slotAmt > 0.003;
    P.ghostMat.uniforms.uAmt.value = g;
    P.ghosts.forEach((m) => { m.visible = g > 0.003; });
  }

  /* -------------------------------------------------------------------------------------------- stage */
  function floorTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d");
    // alphaMap reads the GREEN channel, not alpha: paint grey on black
    x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256);
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, "#a0a0a0"); gr.addColorStop(0.7, "#202020"); gr.addColorStop(1, "#000000");
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); return t;     // alpha data: stays linear
  }
  function glowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d");
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,255,255,.55)");
    gr.addColorStop(0.5, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  let _glowTex = null;
  function glowSprite(hex, size) {
    _glowTex = _glowTex || glowTexture();
    const m = new THREE.SpriteMaterial({ map: _glowTex, color: srgb(hex), transparent: true, depthWrite: false,
                                         blending: THREE.AdditiveBlending, opacity: 0 });
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.renderOrder = 8;
    return s;
  }

  /* ----------------------------------------------------------------------------------------- director */
  // A shot: {t: [x,y,z] target, yaw, pitch (deg), d (mm) OR fit: radius (mm) with fill (fraction of the tighter
  // side), fov (deg, vertical), ox/oy (subject offset on screen, in NDC: +ox moves the subject right)}.
  // Portrait overrides go in shot.p = {...}.
  function shotFor(s, aspect) {
    const o = Object.assign({}, s, aspect < 0.8 && s.p ? s.p : {});
    o.fov = o.fov || 30;
    if (o.fit) {
      const vf = THREE.MathUtils.degToRad(o.fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
      const m = Math.min(vf, hf);
      o.d = o.fit / Math.tan(m / 2 * (o.fill || 0.7));
    }
    return o;
  }
  function lerpShot(a, b, t) {
    const r = {};
    r.t = [lerp(a.t[0], b.t[0], t), lerp(a.t[1], b.t[1], t), lerp(a.t[2], b.t[2], t)];
    let dy = b.yaw - a.yaw; while (dy > 180) dy -= 360; while (dy < -180) dy += 360;
    r.yaw = a.yaw + dy * t; r.pitch = lerp(a.pitch, b.pitch, t);
    r.d = Math.exp(lerp(Math.log(a.d), Math.log(b.d), t));
    r.fov = lerp(a.fov, b.fov, t); r.ox = lerp(a.ox || 0, b.ox || 0, t); r.oy = lerp(a.oy || 0, b.oy || 0, t);
    r.roll = lerp(a.roll || 0, b.roll || 0, t);
    return r;
  }
  function placeCamera(cam, s) {
    const y = THREE.MathUtils.degToRad(s.yaw), pz = THREE.MathUtils.degToRad(s.pitch);
    cam.position.set(s.t[0] + s.d * Math.cos(pz) * Math.cos(y), s.t[1] + s.d * Math.cos(pz) * Math.sin(y), s.t[2] + s.d * Math.sin(pz));
    cam.up.set(0, 0, 1);
    cam.lookAt(s.t[0], s.t[1], s.t[2]);
    if (s.roll) cam.rotateZ(THREE.MathUtils.degToRad(s.roll));
    if (Math.abs(cam.fov - s.fov) > 1e-4) cam.fov = s.fov;
    cam.near = Math.max(2, s.d * 0.02); cam.far = s.d * 8 + 4000;
    cam.updateProjectionMatrix();
    // screen-space offset (a lens shift: the perspective does not change)
    cam.projectionMatrix.elements[8] -= (s.ox || 0);
    cam.projectionMatrix.elements[9] -= (s.oy || 0);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  // The house director: each act holds its own framing for `hold` of its window, then travels on a quintic ease
  // to the next act's shot. acts: [{win:[a,b], shot}], the last shot holds to the end.
  function direct(acts, p, aspect, hold) {
    hold = hold === undefined ? 0.55 : hold;
    let i = 0;
    while (i < acts.length - 1 && p >= acts[i + 1].win[0]) i++;
    const A = acts[i], B = acts[Math.min(i + 1, acts.length - 1)];
    const sa = A.shotFn ? A.shotFn(p, aspect) : shotFor(A.shot, aspect);
    if (A === B) return sa;
    const w0 = A.win[0], w1 = B.win[0];
    const t = (p - w0) / Math.max(1e-6, w1 - w0);
    const h = A.hold === undefined ? hold : A.hold;
    const k = quint((t - h) / (1 - h));
    if (k <= 0) return sa;
    const sb = B.shotFn ? B.shotFn(B.win[0], aspect) : shotFor(B.shot, aspect);
    return lerpShot(sa, sb, k);
  }

  /* -------------------------------------------------------------------------------------------- boot */
  // cfg: { model: url, accent, story caps [...], onReady(ctx), draw(p, clock, ctx) }
  function boot(cfg) {
    const canvas = document.getElementById("gl");
    const stage = document.querySelector(".story-stage");
    const track = document.querySelector(".story");
    const rend = LOOK.renderer(canvas);
    rend.shadowMap.type = THREE.PCFSoftShadowMap;
    const comp = LOOK.Composer(rend, Object.assign({ strength: 0.45, threshold: 1.4, knee: 0.45, exposure: 1.02, vignette: 0.38, grain: 0.010 }, cfg.look || {}));
    const scene = new THREE.Scene();
    scene.background = null;
    // the house aurora (look.js composite), in the page's blue: masked to the dark of the frame, so never over the model
    comp.uniforms.uAurCol.value = srgb("#3f86e6"); comp.uniforms.uAurora.value = 0.075; comp.uniforms.uAurGamma.value = 1.25;
    const envTex = LOOK.env(rend, { top: "#6f7a8a", floor: "#14171c" });
    scene.environment = envTex;
    const cam = new THREE.PerspectiveCamera(30, 1, 5, 20000);
    cam.up.set(0, 0, 1);

    // studio: warm key from the open side and above (the renders' 60 W key), a cool rim from the back, a soft top
    const key = new THREE.DirectionalLight(srgb("#fff1e0"), 2.25);
    key.position.set(-900, -520, 1250); key.target.position.set(0, 0, 330);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -480; sc.right = 480; sc.top = 480; sc.bottom = -480; sc.near = 200; sc.far = 3200;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.6; key.shadow.radius = 3;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(srgb("#cfdcf0"), 0.55); fill.position.set(-700, 900, 420); scene.add(fill);
    const rim = new THREE.DirectionalLight(srgb("#a9c8ff"), 1.25); rim.position.set(900, 300, 1100); scene.add(rim);
    const top = new THREE.DirectionalLight(srgb("#ffffff"), 0.45); top.position.set(-100, 0, 1600); scene.add(top);
    const hemi = new THREE.HemisphereLight(srgb("#8a8f96"), srgb("#0b0c0f"), 0.35); hemi.up = new V3(0, 0, 1); hemi.position.set(0, 0, 1); scene.add(hemi);
    // inside the case the key is cut by the frame: a low warm fill from the open side keeps the interior readable
    // round 2: weaker and further out, so it lights the parts, not the far wall (it washed the far panel khaki)
    const inner = new THREE.PointLight(srgb("#ffe2c0"), 0.38, 900, 2); inner.position.set(-330, -20, 420); scene.add(inner);

    const ctx = { THREE: THREE, rend: rend, comp: comp, scene: scene, cam: cam, key: key, fill: fill, rim: rim, top: top, hemi: hemi, base: { key: 2.25, fill: 0.55, rim: 1.25, top: 0.45, hemi: 0.35, inner: 0.38 },
                  inner: inner, canvas: canvas, stage: stage, track: track, W: 1, H: 1, aspect: 1, model: null,
                  clamp: clamp, sat: sat, lerp: lerp, ss: ss, quint: quint, easeOut: easeOut, easeIn: easeIn, win: win, band: band,
                  glowSprite: glowSprite, direct: direct, shotFor: shotFor, lerpShot: lerpShot, placeCamera: placeCamera, srgb: srgb,
                  applyPart: applyPart, LOOPS: LOOPS, exposure0: comp.uniforms.uExposure.value };

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      ctx.W = w; ctx.H = h; ctx.aspect = w / Math.max(1, h);
      rend.setSize(w, h, false);
      comp.setSize(w, h, rend.getPixelRatio());
      cam.aspect = ctx.aspect;
    }
    window.addEventListener("resize", () => { resize(); ctx.sizeKey = (ctx.sizeKey || 0) + 1; if (story) story.start(); });
    // the topbar's blur is off while the stage covers the top of the screen (round 2: it is the stage's own position
    // that counts; tying it to p brought the blur back over the handle on the last frame)
    function pinCheck() {
      const pin = stage.getBoundingClientRect().bottom > 96;
      if (pin !== ctx._pin) { document.body.classList.toggle("hero-pinned", pin); ctx._pin = pin; }
    }
    window.addEventListener("scroll", pinCheck, { passive: true }); pinCheck();
    resize();

    const story = Story({
      stage: stage, track: track, hud: document.getElementById("hud"), caps: cfg.caps, rail: true,
      title: document.getElementById("title"), cue: document.getElementById("cue"),
      loader: document.getElementById("loader"), pct: document.getElementById("load-pct"),
      titleOut: cfg.titleOut, captureClock: cfg.captureClock, warp: cfg.warp,   // warp: V4's re-timing of p (optional)
      draw: function (p, clock) { frame(p, clock); },
    });
    function frame(p, clock) {
      if (!ctx.model) return;
      ctx.p = p; ctx.clock = clock;
      ctx.renderScene = null; ctx.renderCam = null;
      comp.uniforms.uExposure.value = ctx.exposure0;
      const B = ctx.base;
      key.intensity = B.key; fill.intensity = B.fill; rim.intensity = B.rim; top.intensity = B.top; hemi.intensity = B.hemi; inner.intensity = B.inner;
      cfg.draw(p, clock, ctx);
      Object.values(ctx.model.parts).forEach(applyPart);
      comp.uniforms.uTime.value = clock;
      comp.render(ctx.renderScene || scene, ctx.renderCam || cam, (clock * 60) % 997);
      if (cfg.after) cfg.after(p, clock, ctx);
    }
    ctx.frame = frame;
    ctx.story = story;

    loadModel(cfg.model, (f) => story.progress(f)).then((model) => {
      ctx.model = model;
      scene.add(model.root);
      // floor: the renders' dark glossy studio floor, at the feet
      const z0 = model.box.min.z;
      ctx.floorZ = z0;
      const fl = new THREE.Mesh(new THREE.CircleGeometry(1100, 64), new THREE.MeshStandardMaterial({
        color: srgb("#0a0c11"), roughness: 0.62, metalness: 0.05, envMapIntensity: 0.45, transparent: true, alphaMap: floorTexture(), depthWrite: false,
        // the house bench: the photometer's and LPA's grid, in the bioreactor's blue
        emissiveMap: LOOK.benchGrid({ cells: 14, sub: 4 }), emissive: srgb("#3c4a5c"), emissiveIntensity: 0.3 }));
      fl.position.set(0, 0, z0 - 0.4); fl.receiveShadow = true; fl.renderOrder = -1;
      scene.add(fl); ctx.floor = fl;
      // a dark plate just outside the far side panel and the back end: the panels' slots and cut-outs showed the
      // empty stage through them as black holes (round 1)
      // sized from the far side panel itself (round 3: from the model box it rose past the top rail, behind the handle)
      let fb = null;
      Object.values(model.parts).forEach((q) => { if (/^case:RIGHT PANEL$/.test(q.id)) fb = q.box; });
      const bb = fb || model.box;
      const plateM = new THREE.MeshBasicMaterial({ color: srgb("#040507") });      // unlit: it is the black behind the slots
      const pf = new THREE.Mesh(new THREE.PlaneGeometry(bb.max.z - bb.min.z - 24, bb.max.y - bb.min.y - 24), plateM);
      pf.rotation.set(0, -Math.PI / 2, 0);    // normal +z -> -x (toward the open side); width along z
      pf.position.set(bb.max.x + 1.5, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);
      scene.add(pf); ctx.backplate = pf;
      if (cfg.ready) cfg.ready(ctx);
      // compile every program now, with every ghost, blueprint and transparent variant switched on, so the first
      // scroll into an x-ray act or a fade does not stall on a shader compile (measured: 150 ms hitches)
      try {
        const parts = Object.values(model.parts);
        parts.forEach((P) => { P.ghosts.forEach((g) => { g.visible = true; }); P.slot.visible = true; });
        rend.compile(scene, cam);
        parts.forEach((P) => P.meshes.forEach((m) => { m.material.transparent = true; m.material.needsUpdate = true; }));
        rend.compile(scene, cam);
        parts.forEach((P) => { P.ghosts.forEach((g) => { g.visible = false; }); P.slot.visible = false;
          P.meshes.forEach((m) => { m.material.transparent = !!m.material.userData.baseTransparent; m.material.needsUpdate = true; }); });
        rend.compile(scene, cam);
        (ctx.extraScenes || []).forEach((s) => rend.compile(s[0], s[1]));
        // and draw every key frame once, under the loader, so the first real visit to an act does not pay for its
        // shadow map and transparent lists (round 2: a 67-133 ms hitch at each act's first frame)
        (ctx.keyframes || []).concat(ctx.warmPs || []).forEach((kp) => { frame(kp, 12.5); });
        if (cfg.warm) cfg.warm(ctx);
      } catch (e) { console.warn(e); }
      story.progress(1);
      story.ready();
    }).catch((e) => { console.error(e); const l = document.getElementById("load-pct"); if (l) l.textContent = "failed: " + e.message; });

    window.__b2 = ctx;
    return ctx;
  }

  /* ----------------------------------------------------------------------- DOM marks from 3D anchors */
  const _v = new V3();
  function project(ctx, p) {
    _v.set(p[0], p[1], p[2]).project(ctx.cam);
    return { x: (_v.x * 0.5 + 0.5) * ctx.W, y: (-_v.y * 0.5 + 0.5) * ctx.H, z: _v.z };
  }
  function mark(ctx, el, p, a, side) {
    if (a <= 0.003) { if (el.style.visibility !== "hidden") { el.style.visibility = "hidden"; el.style.opacity = "0"; } return; }
    const q = project(ctx, p);
    el.style.visibility = "visible"; el.style.opacity = a.toFixed(3);
    const w = side === "r" ? el.offsetWidth : 0;
    el.style.transform = "translate(" + (q.x - w + (side === "r" ? -34 : 34)).toFixed(1) + "px," + (q.y - el.offsetHeight / 2).toFixed(1) + "px)";
  }

  window.B2 = { boot: boot, override: override, glassMat: glassMat, emitMat: emitMat, liquidMat: liquidMat, solidMat: solidMat,
                ghostMat: ghostMat, flowMat: flowMat, Poly: Poly, project: project, mark: mark, LOOPS: LOOPS,
                clamp: clamp, sat: sat, lerp: lerp, ss: ss, quint: quint, win: win, band: band, easeOut: easeOut, easeIn: easeIn };
})();
