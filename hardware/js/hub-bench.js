// Lab bench, V1 · Drawing — round 4 (3 Oct 2026): the commercial bioreactor, drawn as a product illustration.
//
// The four instruments on one cream bench: the PC-tower bioreactor in the middle with its in-line photometer inside
// it, the LPA on the left, the hydroponics plate in its tub on the right. Owner, 3 Oct: "replace the bioreactor with
// the commercial version, with the photometer inside ... I want everything to look polished and intentional".
//
// The look: matte "clay" surfaces in three soft tones per part (instrument-tinted, desaturated), ambient occlusion,
// soft contact shadows on the bench, and one thin silhouette line per object. No hatching and no crease lines.
//
// How it draws. The picture is static apart from the culture loop's flow, the photometer's light and the hover, so it
// is BAKED once per size: colour, normals/depth/id, ambient occlusion and outlines are rendered supersampled into
// throw-away targets and resolved to three textures at the canvas's own resolution — the plate (colour), the coverage
// of each instrument (for the hover's fade and halo) and the nearest depth (so the moving flow can hide behind parts).
// Each frame then costs one full-screen pass plus a few hundred triangles of flow. DETAIL A (the photometer, cut open
// on its beam plane and enlarged) is baked the same way into its own circle.
//
// Frames. Everything is placed in the BENCH frame (mm, Z up, origin at the centre of the bench top, -Y toward the
// viewer) as children of `world`, which turns Z-up into three's Y-up. Each instrument keeps its own CAD frame inside
// its group: the tower's measurements (tower.json) are in the tower's CAD frame.
//
// Colour. The output stays linear and every colour is an sRGB hex used as-is, so a hex is what lands on screen: right
// for an illustration, and it sidesteps r128's sRGB-as-linear trap (memory: wiki-render-pipeline).
(function () {
  "use strict";
  const V3 = THREE.Vector3;
  const DEG = Math.PI / 180;
  const $ = function (id) { return document.getElementById(id); };
  // The widget's root carries its mode and where its models are (see bench.css for the two modes):
  //   data-mode     "page" (the standalone sheet) or "section" (a section of a longer page, hub v8)
  //   data-models / data-hyd   asset locations, defaulting to the bench server's
  //   data-avoid    what DETAIL A must keep clear of;  data-keepout  what the tags must keep clear of (selectors)
  const ROOT = document.querySelector(".bw");
  const CFG = {
    mode: ROOT.dataset.mode === "section" ? "section" : "page",
    models: ROOT.dataset.models || "img/bench/",
    hyd: ROOT.dataset.hyd || "/hardware/hydroponics/product/",
    avoid: ROOT.dataset.avoid || "", keepout: ROOT.dataset.keepout || "",
  };
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = function (hex) { return new THREE.Color(hex); };
  const CAM_DIST = 6000;                                           // every camera sits this far from what it looks at
  const QS = {}; location.search.replace(/[?&]([a-z]+)=([^&]*)/g, function (_, k, v) { QS[k] = parseFloat(v); });

  /* ================================================================ the bench */
  // The bench and where each instrument stands on it (bench frame, mm). The tower turns 90 degrees so its open side
  // (CAD -X) faces the viewer; it stands on its own feet (CAD z -13). The LPA's STLs start at z -41.4.
  // data-variant="v8" (hub v8 only; owner, 3 Oct, round 5): a deeper bench, the LPA and the plate drawn larger, and a
  // smaller DETAIL A with no part labels, placed where it overlaps nothing. Without it (the standalone page), round 4.
  const V8 = ROOT.dataset.variant === "v8";
  // the bench top runs from y = cy - depth/2 (its front edge) to cy + depth/2
  const BENCH = V8 ? { width: 1460, depth: 820, cy: -70, top: 26, legs: 860 } : { width: 1560, depth: 680, cy: 0, top: 26, legs: 860 };
  // scale: the LPA and the plate are drawn larger than true scale in v8 (said so in the key and the READMEs)
  const POS = V8 ? {
    bioreactor: { rotZ: 90, t: [0, 60, 13.0] },
    lpa: { rotZ: -20, t: [470, 200, 41.4 * 1.3], s: 1.3 },
    hydroponics: { rotZ: 12, t: [-450, -10, 0], s: 1.3 },
  } : {
    bioreactor: { rotZ: 90, t: [0, 60, 13.0] },
    lpa: { rotZ: -20, t: [470, 70, 41.4] },
    hydroponics: { rotZ: 12, t: [-440, 30, 0] },
  };
  // On a phone the screen is narrow, so the LPA and the plate come forward and in, either side of the tower's front,
  // and the tower can be drawn larger.
  const POS_PHONE = V8 ? {
    lpa: { rotZ: -24, t: [335, -385, 41.4 * 1.2], s: 1.2 },
    hydroponics: { rotZ: 14, t: [-300, -330, 0], s: 1.25 },
  } : {
    lpa: { rotZ: -24, t: [255, -150, 41.4] },
    hydroponics: { rotZ: 14, t: [-250, -170, 0] },
  };

  /* ================================================================ palette */
  const ID = { bg: 0, bioreactor: 1, photometer: 2, lpa: 3, hydroponics: 4, bench: 5 };
  const KEY_OF_ID = { 1: "bioreactor", 2: "photometer", 3: "lpa", 4: "hydroponics" };
  const HUB = { bioreactor: "#5aa9ff", photometer: "#ffa23d", lpa: "#3ddc8b", hydroponics: "#b18cff" };
  // Three tones per surface, [shadow, mid, lit]. The tower's black case is a deep slate in the bioreactor's blue, its
  // inside a lighter blue-grey; the photometer is the one warm object in it; the LPA and the plate are pale, secondary.
  const TONE = {
    // the tower
    case:     ["#1e232b", "#29303a", "#3f4856"],
    liner:    ["#15191f", "#1b2027", "#232a33"],
    frame:    ["#191d24", "#242a33", "#38414e"],
    handle:   ["#1f242c", "#2b323c", "#444e5c"],
    shelf:    ["#7f93ab", "#9db0c5", "#c3d1e0"],
    stand:    ["#8fa3ba", "#adbfd2", "#d0dce9"],
    pumpBody: ["#b6c3d3", "#d6dfe9", "#f3f6fa"],
    pumpLid:  ["#9fb0c4", "#bccadb", "#dbe4ee"],
    pumpBlue: ["#3a6496", "#4d7bb0", "#6f99c9"],
    rotor:    ["#7f9fc2", "#9db8d6", "#c3d5e8"],
    steel:    ["#8a97a6", "#a8b4c1", "#ccd5de"],
    motor:    ["#2a3442", "#384454", "#536173"],
    screen:   ["#163a3a", "#1d4c4a", "#2c6a64"],
    cap:      ["#3a6496", "#4d7bb0", "#6f99c9"],
    port:     ["#b6c3d3", "#d6dfe9", "#f3f6fa"],
    probe:    ["#2a3442", "#384454", "#536173"],
    fibre:    ["#cfd9e4", "#e5ecf3", "#f8fbfd"],
    ring:     ["#c4d0dd", "#dde5ee", "#f5f8fb"],
    tube:     ["#c9d6e3", "#dde6ef", "#f2f6fa"],
    // the photometer
    pho:      ["#d26f12", "#ee8a26", "#ffad57"],
    phoRail:  ["#bf6413", "#da7a22", "#f19744"],
    phoBoard: ["#1c3f73", "#25538f", "#3a6fb0"],
    phoBoardDark: ["#1d232c", "#29313c", "#3b4552"],
    phoChip:  ["#9aa4b0", "#b4bdc7", "#d3dae1"],
    led:      ["#ffd28a", "#ffe2b0", "#fff3dc"],
    cuvette:  ["#d8e6f2", "#e8f1f8", "#f9fcfe"],
    optic:    ["#d8e6f2", "#e8f1f8", "#f9fcfe"],
    // the LPA (its final build is black; drawn pale green so it stays secondary)
    lpaBody:  ["#76b997", "#9dd3b6", "#cbecda"],
    lpaDark:  ["#4f9a76", "#73b893", "#a3d6ba"],
    lpaRack:  ["#82c2a1", "#a8dbbf", "#d3f0e0"],
    lpaCap:   ["#c9e8d8", "#e0f3e9", "#f6fcf9"],
    // the hydroponics plate in its tub
    plate:    ["#8f6fe0", "#a88af0", "#c7b2fb"],
    hhandle:  ["#a995e3", "#c1b1f0", "#ddd3fb"],
    holder:   ["#7a5bcf", "#9273e2", "#ae94f0"],
    water:    ["#e1dbf3", "#ebe7f8", "#f6f4fd"],
    rim:      ["#b3a0ea", "#c9bbf3", "#e2d9fb"],
    // the bench
    benchTop: ["#e2dac8", "#ece5d5", "#f5f0e5"],
    benchSide:["#dcd3bf", "#e5dece", "#efe9dd"],
    benchLeg: ["#d7cfbd", "#e2dbcc", "#ece7dc"],
  };
  // the line each object is outlined with (its instrument's ink), and the loop's
  const INK = { bioreactor: "#141b26", photometer: "#7a3b00", lpa: "#2f6f50", hydroponics: "#4b3a8c", bench: "#b9ae97",
                loop: "#0c4d9c", liner: "#141b26" };
  const LOOP = { body: ["#1d6fd8", "#2f86f0", "#5ba7ff"], hi: "#e3f1ff", hid: "#2f86f0" };
  const CAP = "#ffe4c4";                                         // the photometer's section, where DETAIL A cuts it

  /* ============================================================== renderer */
  const canvas = $("bw-gl"), stage = $("bw-stage");
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  const GL2 = renderer.capabilities.isWebGL2;
  const scene = new THREE.Scene();
  const world = new THREE.Group(); world.rotation.x = -Math.PI / 2; scene.add(world);   // bench frame, Z up

  // shared uniforms
  const U = {
    key: { value: new V3(-0.50, 0.80, 0.34).normalize() },        // toward the key light (world: Y up, +Z to the viewer)
    fill: { value: new V3(0.45, 0.30, 0.84).normalize() },        // a soft fill from the viewer's right
    contact: { value: null }, contactRect: { value: new THREE.Vector4(-BENCH.width / 2, BENCH.cy - BENCH.depth / 2, BENCH.width, BENCH.depth) },
    cutOn: { value: 0 }, cut: { value: new THREE.Vector4(0, 0, 1, 1e9) }, cutV: { value: new THREE.Vector4(0, 0, 1, 0) },
    z0: { value: CAM_DIST },
    time: { value: 0 },
    clip: { value: new THREE.Vector4(0, 0, 1, 0) },
  };
  const CLIP = `
    uniform vec4 uClip;
    void clipCircle() { if (uClip.w > 0.5 && length(gl_FragCoord.xy - uClip.xy) > uClip.z) discard; }`;

  /* ============================================================= materials */
  const VERT = `
    varying vec3 vN; varying vec3 vW; varying vec3 vNv; varying float vZ; varying vec3 vVp;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      vNv = normalize(normalMatrix * normal);
      vec4 mv = viewMatrix * w; vZ = -mv.z; vVp = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`;
  const CUT = `
    uniform float uCutOn, uCuttable; uniform vec4 uCut;
    bool cutting() { return uCutOn > 0.5 && uCuttable > 0.5; }`;
  // Clay: three soft tones from one key light (a wide terminator, so it reads as a soft ramp, not a toon step), a soft
  // fill lifting the shadow side, a touch of sky from above. Back faces shade as front faces (some CAD faces arrive
  // wound backwards); through a cut they are the section, drawn flat. The bench reads its contact shadows here.
  const CLAY_FRAG = `
    uniform vec3 uC0, uC1, uC2, uKey, uFill, uCap;
    uniform float uBench; uniform sampler2D tContact; uniform vec4 uContactRect;
    varying vec3 vN; varying vec3 vW;
    ${CUT}
    void main() {
      if (cutting() && dot(uCut.xyz, vW) > uCut.w) discard;
      if (!gl_FrontFacing && cutting()) { gl_FragColor = vec4(uCap, 1.0); return; }
      vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
      float d = dot(N, uKey);
      float t = smoothstep(-0.32, 0.78, d);
      vec3 c = t < 0.5 ? mix(uC0, uC1, t * 2.0) : mix(uC1, uC2, t * 2.0 - 1.0);
      float f = max(dot(N, uFill), 0.0);
      c = mix(c, uC1, f * 0.22 * (1.0 - t));
      c *= 0.95 + 0.05 * N.y;
      if (uBench > 0.5) {
        vec2 uv = (vec2(vW.x, -vW.z) - uContactRect.xy) / uContactRect.zw;
        vec4 s = texture2D(tContact, uv);
        float occ = clamp(0.62 * s.r + 0.30 * s.g, 0.0, 0.8);
        c *= 1.0 - occ * smoothstep(-0.2, 0.6, N.y);
      }
      gl_FragColor = vec4(c, 1.0);
    }`;
  const matsByKey = {};
  function clay(tone, opt) {
    opt = opt || {};
    const key = (opt.key || "") + tone + (opt.cuttable ? "c" : "") + (opt.bench ? "b" : "");
    if (matsByKey[key]) return matsByKey[key];
    const T = TONE[tone] || opt.ramp;
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uC0: { value: C(T[0]) }, uC1: { value: C(T[1]) }, uC2: { value: C(T[2]) }, uKey: U.key, uFill: U.fill,
        uCap: { value: C(opt.cap || "#ffe3c2") }, uBench: { value: opt.bench ? 1 : 0 }, tContact: U.contact, uContactRect: U.contactRect,
        uCutOn: U.cutOn, uCut: U.cut, uCuttable: { value: opt.cuttable ? 1 : 0 },
      },
      vertexShader: VERT, fragmentShader: CLAY_FRAG, side: THREE.DoubleSide,
    });
    matsByKey[key] = m;
    return m;
  }
  // Normals, depth and id, for the ambient occlusion and the outlines: view normal (xy), view depth (relative to the
  // camera distance, for half floats), and id = instrument * 64 + part. Through a cut, a part's inside is recorded as a
  // flat cap on the cut plane (its depth solved from the plane in view space), so a section is one face with an outline.
  const ND_FRAG = `
    uniform float uId, uZ0; uniform vec4 uCutV;
    varying vec3 vNv; varying float vZ; varying vec3 vW; varying vec3 vVp;
    ${CUT}
    void main() {
      if (cutting() && dot(uCut.xyz, vW) > uCut.w) discard;
      vec3 n = normalize(vNv) * (gl_FrontFacing ? 1.0 : -1.0);
      float z = vZ;
      if (!gl_FrontFacing && cutting()) {
        n = vec3(0.0, 0.0, 1.0);
        z = -(uCutV.w - uCutV.x * vVp.x - uCutV.y * vVp.y) / uCutV.z;
      }
      if (n.z < 0.0) n = normalize(vec3(n.xy, 0.02));
      gl_FragColor = vec4(n.xy, z - uZ0, uId);
    }`;
  const ndMats = {};
  function ndMat(id, cuttable) {
    const k = id + (cuttable ? "c" : "");
    if (!ndMats[k]) ndMats[k] = new THREE.ShaderMaterial({
      uniforms: { uId: { value: id }, uZ0: U.z0, uCutOn: U.cutOn, uCut: U.cut, uCutV: U.cutV, uCuttable: { value: cuttable ? 1 : 0 } },
      vertexShader: VERT, fragmentShader: ND_FRAG, side: THREE.DoubleSide,
    });
    return ndMats[k];
  }
  // Glass: a pale tint, a soft darker rim from the Fresnel term (the camera is orthographic, so the view normal's z is
  // the cosine to the eye), and one soft vertical highlight on the lit side. Back walls first, fainter, then the front.
  const GLASS_FRAG = `
    uniform vec3 uTint, uRim, uKey; uniform float uA, uRimA, uHi;
    varying vec3 vNv; varying vec3 vN; varying vec3 vW;
    ${CUT}
    void main() {
      if (cutting() && dot(uCut.xyz, vW) > uCut.w) discard;
      vec3 n = normalize(vNv);
      float f = 1.0 - abs(n.z);
      float rim = smoothstep(0.55, 0.97, f);
      vec3 c = mix(uTint, uRim, rim);
      float a = mix(uA, uRimA, rim);
      // a highlight band where the surface turns toward the key light
      float h = smoothstep(0.55, 0.75, f) * (1.0 - smoothstep(0.78, 0.92, f)) * smoothstep(0.1, 0.5, dot(normalize(vN), uKey));
      c = mix(c, vec3(1.0), h * uHi); a = max(a, h * uHi * 0.85);
      if (!gl_FrontFacing) a *= 0.45;
      gl_FragColor = vec4(c * a, a);
    }`;
  function glass(tint, rim, opt) {
    opt = opt || {};
    return new THREE.ShaderMaterial({
      uniforms: { uTint: { value: C(tint) }, uRim: { value: C(rim) }, uKey: U.key, uA: { value: opt.a === undefined ? 0.16 : opt.a },
                  uRimA: { value: opt.rimA === undefined ? 0.62 : opt.rimA }, uHi: { value: opt.hi === undefined ? 0.7 : opt.hi },
                  uCutOn: U.cutOn, uCut: U.cut, uCuttable: { value: opt.cuttable ? 1 : 0 } },
      vertexShader: VERT, fragmentShader: GLASS_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  }

  /* --------------------------------------------------------- layers + lists */
  // MAIN / DET: the colour pass of the drawing and of DETAIL A; *_ND: their normal/depth/id pass; GLASS / DGLASS: the
  // transparent pass after the solids; FLOW / DFLOW: what moves, drawn over the baked plate every frame; CAST: what
  // casts a contact shadow on the bench.
  const L_MAIN = 1, L_ND = 2, L_GLASS = 3, L_DET = 4, L_DND = 5, L_DGLASS = 6, L_FLOW = 7, L_DFLOW = 8, L_CAST = 9;
  const solids = [];               // { mesh, col, nd } — swapped for the normal/depth pass
  function layers(o, list) { o.layers.disableAll(); list.forEach(function (l) { o.layers.enable(l); }); }
  let partSeq = 0;
  // A solid part: filled in the colour pass, in the normal/depth/id pass, and (optionally) casting a contact shadow.
  // opt.main / opt.detail: which drawings it is in; opt.part: its part code (outlines are drawn between parts).
  function solid(geo, mat, inst, parent, opt) {
    opt = opt || {};
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    const L = [];
    if (opt.main !== false) L.push(L_MAIN, L_ND);
    if (opt.detail) L.push(L_DET, L_DND);
    if (opt.cast) L.push(L_CAST);
    layers(m, L);
    const part = opt.part !== undefined ? opt.part : (partSeq = (partSeq % 60) + 1);
    solids.push({ mesh: m, col: mat, nd: ndMat(inst * 64 + part, !!opt.detail) });
    return m;
  }
  function setND(on) { for (let i = 0; i < solids.length; i++) solids[i].mesh.material = on ? solids[i].nd : solids[i].col; }
  const PART_LINER = 63, PART_LOOP = 62, PART_TUBE = 61;

  /* ========================================================= full-screen passes */
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const FS_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  function fsPass(frag, uniforms, opt) {
    opt = opt || {};
    const mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: FS_VERT, fragmentShader: frag,
      depthTest: false, depthWrite: false, blending: opt.blending || THREE.NoBlending, transparent: !!opt.blending });
    if (opt.premul) { mat.blending = THREE.CustomBlending; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcAlphaFactor;
      mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; mat.transparent = true; }
    const s = new THREE.Scene(), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    q.frustumCulled = false; s.add(q);
    return { scene: s, mat: mat, u: uniforms };
  }
  function run(pass, target) { renderer.setRenderTarget(target); renderer.render(pass.scene, fsCam); }
  const ndClear = fsPass("void main() { gl_FragColor = vec4(0.0, 0.0, 3.0e4, 0.0); }", {});

  // Ambient occlusion, from the normal/depth buffer (orthographic, so a pixel's view position is linear in its
  // coordinates). 20 samples on a golden-angle spiral in a disc of uR mm, turned per pixel; blurred after.
  const AO = fsPass(`
    uniform sampler2D tN; uniform vec2 uTx; uniform float uMmPx, uR, uStr;
    varying vec2 vUv;
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      vec4 c = texture2D(tN, vUv);
      if (c.w < 0.5) { gl_FragColor = vec4(1.0); return; }
      vec3 n = vec3(c.xy, sqrt(max(0.0, 1.0 - dot(c.xy, c.xy))));
      float rpx = uR / uMmPx, occ = 0.0, rot = ign(gl_FragCoord.xy) * 6.2831853;
      for (int i = 0; i < 20; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / 20.0) * rpx;
        float a = fi * 2.3999632 + rot;
        vec2 o = vec2(cos(a), sin(a)) * r;
        vec4 s = texture2D(tN, vUv + o * uTx);
        if (s.w < 0.5) continue;
        vec3 v = vec3(o * uMmPx, c.z - s.z);
        float L = length(v);
        occ += max(0.0, dot(n, v) / max(L, 1e-3) - 0.12) * (1.0 - smoothstep(uR * 0.45, uR, L));
      }
      float ao = 1.0 - uStr * occ / 20.0;
      gl_FragColor = vec4(clamp(ao, 0.0, 1.0), 0.0, 0.0, 1.0);
    }`, { tN: { value: null }, uTx: { value: new THREE.Vector2() }, uMmPx: { value: 1 }, uR: { value: 30 }, uStr: { value: 1.6 } });
  // a depth-aware blur, one axis at a time
  const BLUR = fsPass(`
    uniform sampler2D tA, tN; uniform vec2 uTx, uDir; uniform vec2 uNTx;
    varying vec2 vUv;
    void main() {
      float z0 = texture2D(tN, vUv).z, s = 0.0, w = 0.0;
      for (int i = -4; i <= 4; i++) {
        vec2 uv = vUv + uDir * uTx * float(i) * 1.5;
        float z = texture2D(tN, uv).z;
        float k = exp(-float(i * i) / 10.0) * exp(-abs(z - z0) / 6.0);
        s += texture2D(tA, uv).r * k; w += k;
      }
      gl_FragColor = vec4(s / max(w, 1e-4), 0.0, 0.0, 1.0);
    }`, { tA: { value: null }, tN: { value: null }, uTx: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) }, uNTx: { value: new THREE.Vector2() } });

  // Outlines. Only silhouettes: a pixel takes its object's line where, within the line's width, the depth falls away
  // by more than uFar (the object stands in front of something well behind it, or of nothing), or where it meets a
  // different instrument or part in front of it by more than uNear. No crease lines, so the inside of a part is clean.
  // The line sits on the near object, and it is anti-aliased by the resolve.
  const EDGE = fsPass(`
    uniform sampler2D tN; uniform vec2 uTx; uniform float uW, uFar, uNear, uParts, uInkA;
    uniform vec3 uInk[8];
    varying vec2 vUv;
    float inst(float id) { return floor(id / 64.0 + 0.001); }
    float part(float id) { return id - 64.0 * inst(id); }
    void main() {
      vec4 c = texture2D(tN, vUv);
      if (c.w < 0.5) { gl_FragColor = vec4(0.0); return; }
      float ci = inst(c.w), cp = part(c.w);
      float e = 0.0;
      for (int k = 0; k < 8; k++) {
        vec2 dir = vec2(cos(float(k) * 0.7853982), sin(float(k) * 0.7853982));
        // a depth step only counts as a silhouette if what lies behind it is wider than the line: a hairline crack
        // between two triangles of a coarse STL (the LPA's) is not one, so it gets no line
        vec4 sc = texture2D(tN, vUv + dir * uW * 1.9 * uTx);
        bool farBeyond = sc.w < 0.5 || sc.z - c.z > uFar || (inst(sc.w) != ci && sc.z - c.z > 1.0);
        for (int j = 1; j <= 2; j++) {
          vec2 o = dir * uW * float(j) * 0.5;
          vec4 s = texture2D(tN, vUv + o * uTx);
          float dz = s.z - c.z;
          float wgt = j == 1 ? 1.0 : 0.6;
          if (s.w < 0.5) { if (farBeyond) e = max(e, wgt); continue; }
          float si = inst(s.w), sp = part(s.w);
          if (dz > uFar) { if (farBeyond) e = max(e, wgt); }
          else if (si != ci && dz > 1.0) e = max(e, wgt);
          else if (sp != cp && dz > uNear && cp < 61.5 && sp < 61.5) e = max(e, wgt * 0.8);
          else if (uParts > 0.5 && sp != cp && dz > -0.5) e = max(e, wgt * 0.7);
          else if ((cp > 61.5 && cp < 62.5) && sp != cp && dz > 1.0) e = max(e, wgt);
        }
      }
      int ii = int(ci);
      vec3 ink = uInk[0];
      for (int i = 1; i < 8; i++) if (i == ii) ink = uInk[i];
      if (cp > 61.5 && cp < 62.5) ink = uInk[6];
      e *= uInkA;
      gl_FragColor = vec4(ink * e, e);
    }`, { tN: { value: null }, uTx: { value: new THREE.Vector2() }, uW: { value: 2 }, uFar: { value: 40 }, uNear: { value: 14 }, uParts: { value: 0 }, uInkA: { value: 1 },
          uInk: { value: [INK.bioreactor, INK.bioreactor, INK.photometer, INK.lpa, INK.hydroponics, INK.bench, INK.loop, INK.bioreactor].map(C) } });

  // The resolve: the supersampled colour, times its ambient occlusion, under its outlines, box-filtered down to the
  // canvas's pixels (4 x 4 taps across each pixel's footprint).
  const RESOLVE = fsPass(`
    uniform sampler2D tC, tA, tE; uniform vec2 uSrcTx, uFoot; uniform float uAoK;
    varying vec2 vUv;
    void main() {
      vec4 sum = vec4(0.0);
      for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
        vec2 uv = vUv + ((vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5) * uFoot * uSrcTx;
        vec4 c = texture2D(tC, uv);
        float a = texture2D(tA, uv).r;
        c.rgb *= mix(1.0, a, uAoK);
        vec4 e = texture2D(tE, uv);
        sum += e + c * (1.0 - e.a);
      }
      gl_FragColor = sum / 16.0;
    }`, { tC: { value: null }, tA: { value: null }, tE: { value: null }, uSrcTx: { value: new THREE.Vector2() }, uFoot: { value: new THREE.Vector2() }, uAoK: { value: 1 } });
  // how much of each canvas pixel each instrument covers (r tower, g photometer, b LPA, a plate), and the nearest depth
  const COVER = fsPass(`
    uniform sampler2D tN; uniform vec2 uSrcTx, uFoot; uniform float uMode;
    varying vec2 vUv;
    void main() {
      vec4 k = vec4(0.0); float zmin = 3.0e4;
      for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
        vec2 uv = vUv + ((vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5) * uFoot * uSrcTx;
        vec4 s = texture2D(tN, uv);
        float id = floor(s.w / 64.0 + 0.001);
        if (s.w > 125.5 && s.w < 126.5) id = 2.0;     // the culture loop goes with the photometer (it stays lit when either is chosen)
        k += vec4(id == 1.0 ? 1.0 : 0.0, id == 2.0 ? 1.0 : 0.0, id == 3.0 ? 1.0 : 0.0, id == 4.0 ? 1.0 : 0.0);
        if (s.w > 0.5) zmin = min(zmin, s.z);
      }
      gl_FragColor = uMode < 0.5 ? k / 16.0 : vec4(zmin, 0.0, 0.0, 1.0);
    }`, { tN: { value: null }, uSrcTx: { value: new THREE.Vector2() }, uFoot: { value: new THREE.Vector2() }, uMode: { value: 0 } });

  // Every frame: the plate, with the hover (the others fade toward the paper, the chosen one gets a soft halo in its
  // colour), and the load-in (a soft wipe from the left). The detail is masked to its circle.
  const BLIT = fsPass(`
    uniform sampler2D tP, tK; uniform vec2 uTx; uniform vec4 uFade, uHot; uniform vec3 uHotCol; uniform float uHotA, uHaloR, uHaloA, uReveal, uCircle, uEdge, uBenchFade, uExp;
    varying vec2 vUv;
    void main() {
      vec2 uv = uCircle > 0.5 ? (vUv - 0.5) * uExp + 0.5 : vUv;
      vec4 c = texture2D(tP, uv);
      vec4 k = texture2D(tK, uv);
      float cov = k.r + k.g + k.b + k.a;
      float fade = dot(k, uFade) + max(0.0, 1.0 - cov) * uBenchFade;
      c.rgb = mix(c.rgb, vec3(c.a), clamp(fade, 0.0, 1.0));
      if (uHotA > 0.001) {
        float here = dot(k, uHot), h = 0.0;
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 0.3926991;
          vec2 o = vec2(cos(a), sin(a)) * uHaloR * uTx;
          h = max(h, dot(texture2D(tK, uv + o), uHot) * 0.85);
          h = max(h, dot(texture2D(tK, uv + o * 0.5), uHot));
        }
        float halo = clamp(h - here * 1.5, 0.0, 1.0) * uHotA * uHaloA;
        c = vec4(uHotCol, 1.0) * halo + c * (1.0 - halo);
      }
      float sweep = uv.x * 0.8 + (1.0 - uv.y) * 0.2;
      float rv = smoothstep(sweep - 0.08, sweep, uReveal * 1.1);
      c *= rv;
      if (uCircle > 0.5) {
        // inside the circle: the detail on its own white; outside it, a soft shadow on the drawing below
        float r = length(uv - 0.5) * 2.0;
        float m = 1.0 - smoothstep(1.0 - uEdge, 1.0, r);
        float rs = length(uv - 0.5 - vec2(0.0, -0.012)) * 2.0;
        float sh = (1.0 - smoothstep(0.96, 1.0 + (uExp - 1.0) * 0.9, rs)) * 0.085 * clamp(uReveal, 0.0, 1.0);
        c = (c + vec4(1.0) * (1.0 - c.a)) * m * clamp(uReveal * 1.6, 0.0, 1.0) + vec4(0.0, 0.0, 0.02, 1.0) * sh * (1.0 - m);
      }
      gl_FragColor = c;
    }`, { tP: { value: null }, tK: { value: null }, uTx: { value: new THREE.Vector2() }, uFade: { value: new THREE.Vector4() }, uHot: { value: new THREE.Vector4() },
          uHotCol: { value: C("#ffffff") }, uHotA: { value: 0 }, uHaloR: { value: 6 }, uHaloA: { value: V8 ? 0.72 : 0.5 }, uReveal: { value: REDUCED ? 1 : 0 }, uCircle: { value: 0 }, uEdge: { value: 0.01 },
          uBenchFade: { value: 0 }, uExp: { value: 1 } }, { premul: true });

  /* ============================================================== the loop */
  // The culture loop's centreline (tower.json loops.culture, CAD mm): from the vessel's floor up its dip tube, over and
  // down into the photometer's flow cell, out over the pump onto its inlet barb, round the rotor, up the open side to
  // the membrane, down its fibres and back along the open side to the vessel's cap. Drawn as a tube in the bake; its
  // flow is drawn over it every frame, solid where it can be seen and as a fine dashed line where a part hides it (the
  // drafting convention for hidden lines) — through the photometer's cell and round the pump.
  const FLOW_VERT = `
    varying vec2 vUv; varying vec3 vNv; varying float vZ; varying vec3 vW;
    void main() {
      vUv = uv;
      vNv = normalize(normalMatrix * normal);
      vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
      vec4 mv = viewMatrix * w; vZ = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const FLOW_FRAG = `
    uniform sampler2D tZ; uniform vec4 uZview; uniform float uZ0;
    uniform float uT, uLen, uSpeed, uOn, uFade, uGain, uHidOn;
    uniform vec4 uHid0, uHid1;
    uniform vec3 uHi, uHid; uniform float uCutOn; uniform vec4 uCut;
    varying vec2 vUv; varying vec3 vNv; varying float vZ; varying vec3 vW;
    ${CLIP}
    void main() {
      clipCircle();
      if (uCutOn > 0.5 && dot(uCut.xyz, vW) > uCut.w) discard;
      vec2 zuv = (gl_FragCoord.xy - uZview.xy) / uZview.zw;
      float zr = texture2D(tZ, zuv).r;
      if (zr > 2.0e4) discard;                    // nothing was drawn here
      float zs = zr + uZ0;
      bool vis = vZ <= zs + 2.5;
      float s = vUv.x * uLen;
      float x = s - uT * uSpeed;
      vec3 n = normalize(vNv) * (gl_FrontFacing ? 1.0 : -1.0);
      if (uCutOn > 0.5) n.z = abs(n.z);
      if (vis) {
        float ph = fract(x / 46.0);
        float dash = smoothstep(0.50, 0.84, ph) * (1.0 - smoothstep(0.86, 0.92, ph));
        float core = smoothstep(0.35, 0.8, n.z);
        float a = dash * core * 0.95 * uGain * uOn * (1.0 - uFade);
        gl_FragColor = vec4(uHi * a, a);
      } else {
        bool hid = (s > uHid0.x && s < uHid0.y) || (s > uHid0.z && s < uHid0.w) || (s > uHid1.x && s < uHid1.y);
        if (!hid || uHidOn < 0.5 || n.z < 0.82) discard;
        if (fract(x / 10.0) > 0.55) discard;
        float a = 0.9 * uOn * (1.0 - 0.8 * uFade);
        gl_FragColor = vec4(uHid * a, a);
      }
    }`;

  /* ============================================================== beams */
  // DETAIL A's beam: a line drawn in screen space from the LED's side of the circle down through the flow cell to the
  // sample sensor: a white-hot core, an amber body, a soft glow, and light travelling down it. Width in CSS px.
  const BEAM_VERT = `
    attribute float aT; attribute float aSide;
    uniform vec3 uP0, uP1; uniform float uW, uPx; uniform vec2 uRes;
    varying float vT; varying float vS;
    void main() {
      vec4 a = projectionMatrix * viewMatrix * vec4(uP0, 1.0), b = projectionMatrix * viewMatrix * vec4(uP1, 1.0);
      vec2 sa = a.xy / a.w * uRes * 0.5, sb = b.xy / b.w * uRes * 0.5;
      vec2 dir = normalize(sb - sa), nr = vec2(-dir.y, dir.x);
      vec4 p = mix(a, b, aT);
      vec2 sp = p.xy / p.w * uRes * 0.5 + nr * aSide * uW * uPx * 0.5;
      gl_Position = vec4(sp / (uRes * 0.5) * p.w, -p.w * 0.999, p.w);
      vT = aT; vS = aSide;
    }`;
  const BEAM_FRAG = `
    uniform float uT, uOn, uFade; uniform vec3 uCore, uBody, uGlow;
    varying float vT; varying float vS;
    ${CLIP}
    void main() {
      clipCircle();
      float x = abs(vS);
      float g = vS * 1.7;
      float glow = exp(-g * g) * 0.55;
      float ends = smoothstep(0.0, 0.05, vT) * (1.0 - smoothstep(0.985, 1.0, vT));
      float ph = fract(vT * 3.0 - uT * 0.9);
      float pulse = smoothstep(0.55, 0.95, ph) * (1.0 - smoothstep(0.95, 1.0, ph));
      float core = 1.0 - smoothstep(0.10 + 0.08 * pulse, 0.17 + 0.1 * pulse, x);
      float body = 1.0 - smoothstep(0.32, 0.40, x);
      vec3 c = mix(uGlow, uBody, body);
      c = mix(c, uCore, core);
      float a = max(body * 0.95, glow * (0.8 + 0.4 * pulse)) * ends * uOn * (1.0 - 0.85 * uFade);
      gl_FragColor = vec4(c * a, a);
    }`;
  function beamLine(p0, p1, wCss, on) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute([0, 0, 1, 1], 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute([-1, 1, -1, 1], 1));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    const m = new THREE.ShaderMaterial({
      uniforms: { uP0: { value: p0 }, uP1: { value: p1 }, uW: { value: wCss }, uPx: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uT: U.time,
                  uOn: on, uFade: FADE.photometer, uCore: { value: C("#fffaf0") }, uBody: { value: C("#ff7a0a") }, uGlow: { value: C("#ffb04a") }, uClip: U.clip },
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 20;
    return mesh;
  }
  // a soft point of light (the LED, and the reading point on the sample sensor): a warm glow and, for the reading
  // point, a ring that leaves it each time a pulse arrives
  const GLOW_FRAG = `
    uniform float uT, uOn, uFade, uRing, uPeriod; uniform vec3 uCol;
    varying vec2 vUv;
    ${CLIP}
    void main() {
      clipCircle();
      vec2 q = vUv * 2.0 - 1.0; float r = length(q);
      float core = exp(-r * r * 26.0);
      float glow = exp(-r * r * 5.0) * 0.45;
      float ph = fract(uT / uPeriod);
      float e = (r - ph) * 9.0;
      float ring = uRing * exp(-e * e) * (1.0 - ph) * 0.8;
      float a = clamp((core + glow + ring) * uOn * (1.0 - 0.8 * uFade), 0.0, 1.0);
      vec3 c = mix(uCol, vec3(1.0, 0.98, 0.93), core / max(core + glow + ring, 1e-3));
      gl_FragColor = vec4(c * a, a);
    }`;
  function glowPoint(at, rCss, on, opt) {
    opt = opt || {};
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 1, 2, 2, 1, 3]);
    const m = new THREE.ShaderMaterial({
      uniforms: { uP: { value: at }, uR: { value: rCss }, uPx: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uT: U.time, uOn: on,
                  uFade: FADE.photometer, uCol: { value: C(opt.col || "#ff9a2e") }, uRing: { value: opt.ring ? 1 : 0 }, uPeriod: { value: opt.period || 3.33 }, uClip: U.clip },
      vertexShader: `
        uniform vec3 uP; uniform float uR, uPx; uniform vec2 uRes; varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 c = projectionMatrix * viewMatrix * vec4(uP, 1.0);
          vec2 o = (uv * 2.0 - 1.0) * uR * uPx / (uRes * 0.5);
          gl_Position = vec4(c.xy + o * c.w, -c.w * 0.999, c.w);
        }`,
      fragmentShader: GLOW_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 21;
    return mesh;
  }
  const FADE = { bioreactor: { value: 0 }, photometer: { value: 0 }, lpa: { value: 0 }, hydroponics: { value: 0 }, loop: { value: 0 } };

  /* ================================================================ loading */
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); }
  function getBin(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.arrayBuffer(); }); }
  let loaded = 0; const toLoad = 5;
  function tick(x) { loaded++; const p = $("bw-load-pct"); if (p) p.textContent = " · " + Math.min(100, Math.round(loaded / toLoad * 100)) + "%"; return x; }
  const S = { groups: {}, anchors: {}, ready: false };
  // A section of a long page loads its models only as it comes near the screen, so it never competes with the page
  // above it (the hub's film); the standalone page loads at once.
  function boot() {
    Promise.all([
      getJSON(CFG.models + "bench.json").then(tick),
      getJSON(CFG.models + "_pack.json").then(function (man) { tick(); return getBin(CFG.models + "_pack.bin?v=" + man.v).then(function (b) { tick(); return { man: man, buf: b }; }); }),
      getJSON(CFG.hyd + "model.json").then(function (man) { tick(); return getBin(CFG.hyd + "model.bin").then(function (b) { tick(); return { man: man, buf: b }; }); }),
    ]).then(function (r) {
      build(r[0], r[1], r[2]);
    }).catch(function (e) {
      console.error(e);
      const l = $("bw-loading"); l.classList.add("err"); l.textContent = "Could not draw the bench: " + e.message;
    });
  }
  if (CFG.mode === "section" && "IntersectionObserver" in window) {
    const near = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { near.disconnect(); boot(); }
    }, { rootMargin: "120% 0px 120% 0px" });
    near.observe(stage);
  } else boot();

  /* ================================================================== build */
  function place(g, L) {
    g.rotation.z = (L.rotZ || 0) * DEG;
    g.position.set(L.t[0], L.t[1], L.t[2]);
    world.add(g);
    return g;
  }
  // the tower's pack: indexed, quantised meshes (tools/build_tower.py), expanded to triangles for the normal smoothing.
  // Encoding 2: positions as zigzag deltas (mod 2^16) and indices as high-water codes, both in byte planes.
  function decodeIndexed(buf, g, enc) {
    let q, idx;
    if (enc === 2) {
      const n3 = g.verts * 3, ni = g.tris * 3;
      const vb = new Uint8Array(buf, g.voff, n3 * 2), ib = new Uint8Array(buf, g.ioff, ni * 2);
      q = new Uint16Array(n3); idx = new Uint32Array(ni);
      const acc = [0, 0, 0];
      for (let k = 0; k < n3; k++) {
        const z = vb[k] | (vb[n3 + k] << 8), d = (z >>> 1) ^ -(z & 1), c = k % 3;
        acc[c] = (acc[c] + d) & 0xffff; q[k] = acc[c];
      }
      let hw = -1;
      for (let k = 0; k < ni; k++) {
        const v = hw + 1 - (ib[k] | (ib[ni + k] << 8));
        idx[k] = v; if (v > hw) hw = v;
      }
    } else {
      q = new Uint16Array(buf, g.voff, g.verts * 3);
      idx = g.i32 ? new Uint32Array(buf, g.ioff, g.tris * 3) : new Uint16Array(buf, g.ioff, g.tris * 3);
    }
    const pos = new Float32Array(g.tris * 9), lo = g.lo, sp = g.span;
    for (let i = 0; i < idx.length; i++) {
      const v = idx[i] * 3;
      pos[i * 3] = lo[0] + q[v] / 65535 * sp[0];
      pos[i * 3 + 1] = lo[1] + q[v + 1] / 65535 * sp[1];
      pos[i * 3 + 2] = lo[2] + q[v + 2] / 65535 * sp[2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }
  function prep(geo, angle, relax) {
    if (RQ.dropDegenerate) geo = RQ.dropDegenerate(geo, 1e-6, 0.002);
    if (relax && RQ.relaxSurfaces) RQ.relaxSurfaces(geo, { iters: 4, leash: 0.3 });
    RQ.smoothNormals(geo, angle || 34);
    return geo;
  }
  function centripetal(pts, closed) { return new THREE.CatmullRomCurve3(pts, !!closed, "centripetal"); }

  function build(tw, pack, hyd) {
    S.tw = tw;
    let tris = 0;

    /* ---------------------------------------------------------------- bench */
    const B = BENCH, bench = new THREE.Group(); world.add(bench); S.groups.bench = bench;
    bench.position.y = B.cy;
    // the top: a slab with softly rounded edges, so its front edge catches a line of light
    const r = 4;
    const sh = new THREE.Shape();
    sh.moveTo(-B.width / 2 + r, -B.depth / 2); sh.lineTo(B.width / 2 - r, -B.depth / 2); sh.quadraticCurveTo(B.width / 2, -B.depth / 2, B.width / 2, -B.depth / 2 + r);
    sh.lineTo(B.width / 2, B.depth / 2 - r); sh.quadraticCurveTo(B.width / 2, B.depth / 2, B.width / 2 - r, B.depth / 2);
    sh.lineTo(-B.width / 2 + r, B.depth / 2); sh.quadraticCurveTo(-B.width / 2, B.depth / 2, -B.width / 2, B.depth / 2 - r);
    sh.lineTo(-B.width / 2, -B.depth / 2 + r); sh.quadraticCurveTo(-B.width / 2, -B.depth / 2, -B.width / 2 + r, -B.depth / 2);
    const topG = new THREE.ExtrudeGeometry(sh, { depth: B.top - 6, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 4, curveSegments: 6 });
    topG.translate(0, 0, -B.top + 3);
    const topM = solid(prep(nonIdx(topG), 40), clay("benchTop", { bench: true }), ID.bench, bench, { part: 1 });
    // a recessed apron and four legs, which fade out toward the floor (bench.css)
    const legMat = clay("benchLeg");
    const apron = new THREE.BoxGeometry(B.width - 140, B.depth - 140, 60); apron.translate(0, 0, -B.top - 30);
    solid(apron.toNonIndexed(), legMat, ID.bench, bench, { part: 2 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s, i) {
      const g = new THREE.BoxGeometry(46, 46, B.legs); g.translate(s[0] * (B.width / 2 - 80), s[1] * (B.depth / 2 - 80), -B.top - B.legs / 2);
      solid(g.toNonIndexed(), legMat, ID.bench, bench, { part: 3 + i });
    });

    /* ------------------------------------------------------------ the tower */
    const towG = place(new THREE.Group(), POS.bioreactor); S.groups.bioreactor = towG;
    const glassM = glass("#e6f0fa", "#5d7fa6", { a: 0.10, rimA: 0.55, hi: 0.65 });
    const glassMd = glass("#fff1e0", "#c06a12", { a: 0.18, rimA: 0.7, hi: 0.5, cuttable: true });
    const PARTS = {};
    const lpaGroups = [];
    pack.man.groups.forEach(function (g, gi) {
      if (g.inst === "lpa") { lpaGroups.push(g); return; }
      const geo0 = decodeIndexed(pack.buf, g, pack.man.enc);
      const isPh = g.inst === "photometer";
      const inst = isPh ? ID.photometer : ID.bioreactor;
      const pc = PARTS[g.part] || (PARTS[g.part] = (Object.keys(PARTS).length % 58) + 1);
      const part = g.tone === "liner" ? PART_LINER : pc;
      if (g.tone === "glass") {
        const geo = prep(geo0, 50);
        tris += geo.attributes.position.count / 3;
        const m = new THREE.Mesh(geo, glassM); m.renderOrder = 5; layers(m, [L_GLASS]); towG.add(m);
        return;
      }
      if (g.tone === "cuvette" || g.tone === "optic") {
        const geo = prep(geo0, 40);
        const m = new THREE.Mesh(geo, glassMd); m.renderOrder = 5; layers(m, [L_DGLASS]); towG.add(m);
        return;
      }
      const geo = prep(geo0, isPh ? 30 : 34, isPh);
      tris += geo.attributes.position.count / 3;
      solid(geo, clay(g.tone, { cuttable: isPh, cap: CAP }), inst, towG,
            { part: part, main: !g.detail, detail: isPh && g.part !== "V4 part5", cast: !isPh && g.tone !== "liner" });
    });

    // liquids (illustrative fill levels): the culture in the vessel, the protectant in the reservoir
    // drawn as tinted volumes, so what stands behind them (a line, a probe) still shows through
    function liquid(cx, cy, r, z0, z1, mat) {
      const g = new THREE.CylinderGeometry(r, r, z1 - z0, 64, 1, false); g.rotateX(Math.PI / 2); g.translate(cx, cy, (z0 + z1) / 2);
      RQ.smoothNormals(g, 50);
      const m = new THREE.Mesh(g, mat); m.renderOrder = 4; layers(m, [L_GLASS]); towG.add(m);
    }
    liquid(0, 0, 46.5, 152.5, 238, glass("#b9d8f6", "#6b9dd6", { a: 0.8, rimA: 0.9, hi: 0.35 }));     // culture vessel (Part 1|113: r 50.8, z 147..297)
    liquid(-28.6, -99, 37.5, 139, 205, glass("#eef3f8", "#a5b7ca", { a: 0.74, rimA: 0.85, hi: 0.3 }));  // reservoir bottle (Part 1|66: r 40.6, z 134..253)

    // the culture loop and the protectant line
    const CL = tw.loops.culture.map(function (p) { return new V3().fromArray(p); });
    const curve = centripetal(CL, false);
    const len = curve.getLength();
    const loopGeo = new THREE.TubeGeometry(curve, Math.round(len / 2.0), 3.4, 14, false);
    solid(loopGeo.toNonIndexed(), clay("loop", { ramp: LOOP.body, key: "loop" }), ID.bioreactor, towG, { part: PART_LOOP });
    // in DETAIL A the line is drawn at the tubing's own size (3.2 mm across), so it fits the flow cell it runs through
    const dLoopGeo = new THREE.TubeGeometry(curve, Math.round(len / 1.0), 1.7, 12, false);
    solid(dLoopGeo.toNonIndexed(), clay("loop", { ramp: LOOP.body, key: "loopd", cuttable: true, cap: "#8ec3fa" }), ID.bioreactor, towG, { part: PART_LOOP, main: false, detail: true });
    const shellCurve = centripetal(tw.loops.protectant.map(function (p) { return new V3().fromArray(p); }), false);
    solid(new THREE.TubeGeometry(shellCurve, 80, 2.4, 10, false).toNonIndexed(), clay("tube"), ID.bioreactor, towG, { part: PART_TUBE });
    // arc length along the loop of a point (nearest sample)
    const tmp = new V3();
    function sOf(v) {
      let best = 0, bd = 1e9;
      for (let i = 0; i <= 4000; i++) { curve.getPointAt(i / 4000, tmp); const d = tmp.distanceTo(v); if (d < bd) { bd = d; best = i / 4000 * len; } }
      return best;
    }
    const ph = tw.photometer;
    const cA = new V3().fromArray(ph.cellA), cB = new V3().fromArray(ph.cellB), ax = new V3().fromArray(ph.axis);
    // hidden stretches drawn dashed: into, through and out of the photometer's head; round the pump's rotor
    const sA = sOf(cA.clone().addScaledVector(ax, 18)), sB = sOf(cB.clone().addScaledVector(ax, -14));
    const sP0 = sOf(new V3(-53.8, 93.2, 262)), sP1 = sOf(new V3(-53.8, 129.2, 262));
    const flowU = {
      tZ: { value: null }, uZview: { value: new THREE.Vector4(0, 0, 1, 1) }, uZ0: U.z0,
      uT: U.time, uLen: { value: len }, uSpeed: { value: REDUCED ? 0 : 46 }, uOn: { value: 0 }, uFade: FADE.loop, uGain: { value: 1 }, uHidOn: { value: 0 },
      uCutOn: { value: 0 }, uCut: U.cut, uClip: U.clip,
      uHid0: { value: new THREE.Vector4(sA, sB, sP0, sP1) }, uHid1: { value: new THREE.Vector4(-1, -1, 0, 0) },
      uHi: { value: C(LOOP.hi) }, uHid: { value: C(LOOP.hid) },
    };
    const flowMat = new THREE.ShaderMaterial({ uniforms: flowU, vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    const flowMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.round(len / 2.0), 3.5, 10, false), flowMat);
    layers(flowMesh, [L_FLOW]); towG.add(flowMesh);
    // in DETAIL A: the same flow, through the cut flow cell (the cell's inside is drawn as culture)
    const dflowU = Object.assign({}, flowU, { tZ: { value: null }, uZview: { value: new THREE.Vector4(0, 0, 1, 1) }, uHidOn: { value: 0 }, uCutOn: { value: 1 } });
    const dflowMat = flowMat.clone(); dflowMat.uniforms = dflowU;
    const dflowMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.round(len / 1.0), 1.8, 10, false), dflowMat); layers(dflowMesh, [L_DFLOW]); towG.add(dflowMesh);

    // the photometer's light: the LED glows (the main drawing), and in DETAIL A the beam runs from the LED down through
    // the flow cell to the sample sensor
    scene.updateMatrixWorld(true);
    const W = function (p) { return towG.localToWorld(new V3().fromArray(p)); };
    const led = W(ph.led), cellP = W(ph.cell), sample = W(ph.sample);
    const beamOn = { value: 0 };
    const ledGlow = glowPoint(led, 13, beamOn, { col: "#ffb347" }); layers(ledGlow, [L_FLOW]); scene.add(ledGlow);
    const beamDet = beamLine(led, sample, 13, beamOn); layers(beamDet, [L_DFLOW]); scene.add(beamDet);
    const pingDet = glowPoint(sample, 22, beamOn, { col: "#ff7a14", ring: true }); layers(pingDet, [L_DFLOW]); scene.add(pingDet);
    S.overlays = [ledGlow, beamDet, pingDet];

    /* --------------------------------------------------------------- LPA */
    const lpaG = place(new THREE.Group(), POS.lpa); S.groups.lpa = lpaG;
    lpaGroups.forEach(function (g, i) {
      const geo = prep(decodeIndexed(pack.buf, g, pack.man.enc), 28);
      tris += geo.attributes.position.count / 3;
      solid(geo, clay(g.tone), ID.lpa, lpaG, { part: 1 + i, cast: true });
    });
    // 24 screw caps on the rack (illustrative: the culture tubes' rims sit at the rack's top face, 146.5)
    const capGeo = new THREE.CylinderGeometry(7.2, 7.2, 7.0, 32).rotateX(Math.PI / 2);
    const capMat = clay("lpaCap");
    const caps = [];
    [-45, -27, -9, 9, 27, 45].forEach(function (x) {
      [-27, -9, 9, 27].forEach(function (y) { const g = capGeo.clone(); g.translate(x, y, 146.5 + 3.5); caps.push(g.toNonIndexed()); });
    });
    solid(mergeGeos(caps), capMat, ID.lpa, lpaG, { part: 20, cast: true });

    /* ------------------------------------------------------- hydroponics */
    const hydG = place(new THREE.Group(), POS.hydroponics); S.groups.hydroponics = hydG;
    const TUB = { x: 170, y: 140, z: 95, wall: 3, water: 72 };            // illustrative container
    const tub = new THREE.Mesh(roundedTub(TUB.x, TUB.y, TUB.z, 8), glass("#f3efff", "#7a63c4", { a: 0.12, rimA: 0.5, hi: 0.6 }));
    tub.renderOrder = 5; layers(tub, [L_GLASS]); hydG.add(tub);
    // the tub's rim and floor, solid, so the container reads as an object and sits on the bench
    const rimG = roundedRing(TUB.x, TUB.y, 8, TUB.wall, 4); rimG.translate(0, 0, TUB.z - 4);
    solid(rimG, clay("rim"), ID.hydroponics, hydG, { part: 1, cast: true });
    const floorG = roundedSlab(TUB.x, TUB.y, 8, 3);
    solid(floorG, clay("rim"), ID.hydroponics, hydG, { part: 2, cast: true });
    // the medium
    const waterG = roundedSlab(TUB.x - 2 * TUB.wall, TUB.y - 2 * TUB.wall, 6, TUB.water - TUB.wall); waterG.translate(0, 0, TUB.wall);
    solid(waterG, clay("water"), ID.hydroponics, hydG, { part: 9, cast: true });
    // the plate, floating: the waterline 6.0 mm under the slab top (hydroponics page, Figure 2)
    const plateG = new THREE.Group(); hydG.add(plateG);
    plateG.position.z = TUB.water - (3.175 - 6.0);
    const hm = { 0: clay("plate"), 1: clay("hhandle"), 2: clay("holder") };
    const inst = (hyd.man.instances || {})["Seed Holder"] || [[0, 0, 0]];
    hyd.man.groups.forEach(function (g, gi) {
      const geo = prep(PackedModel.decodeGroup(hyd.buf, g), 30);
      tris += geo.attributes.position.count / 3 * (g.part === "Seed Holder" ? inst.length : 1);
      if (g.part === "Seed Holder") {
        inst.forEach(function (d) { const m = solid(geo, hm[g.mat], ID.hydroponics, plateG, { part: 10 }); m.position.set(d[0], d[1], d[2]); });
      } else solid(geo, hm[g.mat] || hm[0], ID.hydroponics, plateG, { part: 3 + gi });
    });

    /* ------------------------------------------------------ bounds, anchors */
    world.updateMatrixWorld(true);
    function corners(g, min, max) {
      const out = [];
      for (let i = 0; i < 8; i++) out.push(g.localToWorld(new V3(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2])));
      return out;
    }
    const tb = tw.bounds, pb = tw.photometerBounds;
    S.corners = {
      bioreactor: corners(towG, tb.min, tb.max),
      photometer: corners(towG, pb.min, pb.max),
    };
    S.anchors = {
      bioreactor: towG.localToWorld(new V3(-100, -150, 520)),
      photometer: W([62, 100, 250]),
      led: led, cell: cellP, sample: sample,
      beamIn: led.clone().lerp(cellP, 0.88),
    };
    // the LPA and the plate are placed per layout (arrange)
    S.local = {
      lpa: { g: lpaG, box: [[-108.7, -81.8, -41.4], [108.7, 81.8, 156]], anchor: new V3(-44, -46, 128) },
      hydroponics: { g: hydG, box: [[-TUB.x / 2, -TUB.y / 2, 0], [TUB.x / 2, TUB.y / 2, TUB.z]], anchor: new V3(-20, 0, TUB.water + 6) },
    };
    S.cornersOf = corners;
    // DETAIL A looks at the flow cell, square to the beam plane (the plane holds the beam and the cell's length), and
    // cuts the photometer there, keeping the half away from the viewer
    const cn = new V3().fromArray(ph.cutNormal).transformDirection(towG.matrixWorld).normalize();
    U.cut.value.set(cn.x, cn.y, cn.z, cn.dot(cellP) - 0.4);
    S.detAt = W(ph.cell).addScaledVector(W(ph.led).sub(W(ph.cell)).normalize(), 14);
    S.detN = cn;

    S.model = { flowU: flowU, dflowU: dflowU, beamOn: beamOn, len: len, tris: Math.round(tris), towG: towG };
    S.ready = true;
    buildOverlay();
    resize();
    $("bw-loading").classList.add("gone");
    ROOT.classList.add("bw-ready");
    S.t0 = performance.now();
    start();
  }

  function nonIdx(g) { return g.index ? g.toNonIndexed() : g; }
  function mergeGeos(list) {
    let n = 0; list.forEach(function (g) { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3); let o = 0;
    list.forEach(function (g) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    RQ.smoothNormals(geo, 40);
    return geo;
  }
  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  }
  function roundedSlab(w, h, r, d) {
    const g = nonIdx(new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), { depth: d, bevelEnabled: false, curveSegments: 8 }));
    RQ.smoothNormals(g, 40); return g;
  }
  function roundedRing(w, h, r, wall, d) {
    const s = roundedRectShape(w, h, r);
    const hole = roundedRectShape(w - 2 * wall, h - 2 * wall, Math.max(1, r - wall));
    s.holes.push(new THREE.Path(hole.getPoints(8).reverse()));
    const g = nonIdx(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 }));
    RQ.smoothNormals(g, 40); return g;
  }
  // the tub's glass: an open-topped rounded box (its walls and floor)
  function roundedTub(w, h, d, r) {
    const pts = roundedRectShape(w, h, r).getPoints(8);
    const pos = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      pos.push(a.x, a.y, 0, b.x, b.y, 0, b.x, b.y, d, a.x, a.y, 0, b.x, b.y, d, a.x, a.y, d);
    }
    const floor = nonIdx(new THREE.ShapeGeometry(roundedRectShape(w, h, r), 8));
    const fp = floor.attributes.position.array;
    for (let i = 0; i < fp.length; i += 3) pos.push(fp[i], fp[i + 1], 0.5);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    RQ.smoothNormals(g, 40);
    return g;
  }

  // where the LPA and the plate stand, for this layout; their contact shadows follow them
  function arrange(onPhone) {
    if (S.arranged === onPhone) return;
    S.arranged = onPhone;
    ["lpa", "hydroponics"].forEach(function (k) {
      const L = (onPhone ? POS_PHONE : POS)[k], o = S.local[k];
      o.g.rotation.z = L.rotZ * DEG; o.g.position.set(L.t[0], L.t[1], L.t[2]); o.g.scale.setScalar(L.s || 1);
      o.g.updateMatrixWorld(true);
      S.corners[k] = S.cornersOf(o.g, o.box[0], o.box[1]);
      S.anchors[k] = o.g.localToWorld(o.anchor.clone());
    });
    world.updateMatrixWorld(true);
    bakeContact();
  }

  /* ========================================================= contact shadows */
  // Once, after loading: everything that stands on the bench, seen from above, as its lowest height over each patch of
  // bench (min blending), turned into two soft shadow terms — a tight one where a part touches the bench and a wide
  // one under whatever hangs low over it — and blurred. The bench's material reads them.
  function bakeContact() {
    const w = 1024, h = Math.round(1024 * BENCH.depth / BENCH.width);
    const cam = new THREE.OrthographicCamera(-BENCH.width / 2, BENCH.width / 2, BENCH.cy + BENCH.depth / 2, BENCH.cy - BENCH.depth / 2, 10, 5000);
    cam.position.set(0, 3000, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    cam.layers.mask = 1 << L_CAST;
    const hMat = S.cH || (S.cH = new THREE.ShaderMaterial({
      vertexShader: "varying float vH; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vH = w.y; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "varying float vH; void main() { gl_FragColor = vec4(clamp(vH / 400.0, 0.0, 1.0)); }",
      side: THREE.DoubleSide, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MinEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    }));
    if (S.contactRT) S.contactRT.dispose();
    const mk = function () { return new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }); };
    const a = mk(), b = mk();
    scene.overrideMaterial = hMat;
    renderer.setRenderTarget(a); renderer.setClearColor(0xffffff, 1); renderer.clear(true, false, false);
    renderer.render(scene, cam);
    scene.overrideMaterial = null;
    renderer.setClearColor(0x000000, 0);
    const SH = S.cSH || (S.cSH = fsPass(`
      uniform sampler2D tH; varying vec2 vUv;
      void main() { float h = texture2D(tH, vUv).r * 400.0;
        gl_FragColor = vec4(1.0 - smoothstep(0.0, 22.0, h), 1.0 - smoothstep(0.0, 260.0, h), 0.0, 1.0); }`, { tH: { value: null } }));
    SH.u.tH.value = a.texture;
    run(SH, b);
    const GB = S.cGB || (S.cGB = fsPass(`
      uniform sampler2D tS; uniform vec2 uD; varying vec2 vUv;
      void main() { vec2 s = vec2(0.0); float w = 0.0;
        for (int i = -8; i <= 8; i++) { float k = exp(-float(i * i) / 24.0);
          vec4 t = texture2D(tS, vUv + uD * float(i)); vec4 u = texture2D(tS, vUv + uD * float(i) * 4.0);
          s += vec2(t.r, u.g) * k; w += k; }
        gl_FragColor = vec4(s / w, 0.0, 1.0); }`, { tS: { value: null }, uD: { value: new THREE.Vector2() } }));
    // two passes per axis: the tight term with a 3 mm step, the wide one with a 4x step
    GB.u.tS.value = b.texture; GB.u.uD.value.set(1.6 / w, 0); run(GB, a);
    GB.u.tS.value = a.texture; GB.u.uD.value.set(0, 1.6 / h); run(GB, b);
    GB.u.tS.value = b.texture; GB.u.uD.value.set(1.6 / w, 0); run(GB, a);
    GB.u.tS.value = a.texture; GB.u.uD.value.set(0, 1.6 / h); run(GB, b);
    a.dispose();
    U.contact.value = b.texture;
    S.contactRT = b;
  }

  /* ================================================================ views */
  // Per layout: the main camera (yaw from the front toward the right, elevation), the rectangle the bench's contents
  // are fitted into (fractions of the stage), DETAIL A (radius as a fraction of the stage height; its centre is the
  // photometer's place in the drawing plus (dx, dy) radii), and where each tag sits relative to its anchor (CSS px).
  const PHONE = {
    yaw: 10, el: 22,
    fit: { x0: 0.05, x1: 0.95, y0: 0.385, y1: 0.93 },
    detail: { cx: 0.255, cy: 0.195, r: 0.172 },
    tags: { bioreactor: [24, -22], lpa: [30, -16], hydroponics: [-18, -30] },
    dyaw: 8, del: 8,
  };
  const DESK = {
    yaw: 8, el: 23,
    fit: { x0: 0.08, x1: 0.92, y0: 0.03, y1: 0.9 },
    detail: { rel: [-1.7, -0.25], r: 0.24, rmin: 118, rmax: 165 },
    tags: { bioreactor: [80, -40], lpa: [70, -70], hydroponics: [-74, -20] },
    dyaw: 8, del: 8,
  };
  // hub v8 (round 5): the bench's front edge is in the frame (front), and DETAIL A is smaller and goes wherever it
  // overlaps nothing, as near the photometer as it can (auto)
  const DESK_V8 = {
    yaw: 8, el: 20,
    fit: { x0: 0.04, x1: 0.94, y0: 0.015, y1: 0.985 }, front: true,
    detail: { auto: true, r: 0.19, rmin: 92, rmax: 124 },
    tags: { bioreactor: [80, -40], lpa: [74, -60], hydroponics: [-74, -24] },
    dyaw: 8, del: 8,
  };
  const PHONE_V8 = {
    yaw: 10, el: 22,
    fit: { x0: 0.04, x1: 0.96, y0: 0.34, y1: 0.98 }, front: true,
    detail: { auto: true, r: 0.15, rmin: 60, rmax: 82 },
    tags: { bioreactor: [24, -22], lpa: [26, -20], hydroponics: [-18, -28] },
    dyaw: 8, del: 8,
  };
  // one layout for both pages (the standalone page wraps the widget in the hub's section shell); v8 has its own
  const LAY = V8 ? { section: { desktop: DESK_V8, phone: PHONE_V8 }, page: { desktop: DESK_V8, phone: PHONE_V8 } }
                 : { section: { desktop: DESK, phone: PHONE }, page: { desktop: DESK, phone: PHONE } };
  // DETAIL A's crop: a circle of DET_R mm round the flow cell
  const DET_R = V8 ? 60 : 64;
  const main = { cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 30000), lc: L_MAIN, ln: L_ND, lg: L_GLASS, lf: L_FLOW, far: 40, near: 14, parts: 0, ao: 34, lineW: 1.15 };
  const det = { cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 30000), lc: L_DET, ln: L_DND, lg: L_DGLASS, lf: L_DFLOW, far: 9, near: 5, parts: 1, ao: 9, lineW: 1.0, inkA: 0.72, circle: true };
  let W = 1, H = 1, DPR = 1, lay = LAY[CFG.mode].desktop, phone = false;

  function aim(cam, target, yaw, el, dist) {
    cam.position.set(target.x + dist * Math.sin(yaw * DEG) * Math.cos(el * DEG), target.y + dist * Math.sin(el * DEG),
                     target.z + dist * Math.cos(yaw * DEG) * Math.cos(el * DEG));
    cam.up.set(0, 1, 0); cam.lookAt(target); cam.updateMatrixWorld(true);
  }
  // Fit points into a rectangle of the view (fractions of w x h), keeping the projection orthographic and unscaled.
  function fitOrtho(cam, pts, w, h, rect) {
    const inv = cam.matrixWorldInverse;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const v = new V3();
    pts.forEach(function (p) { v.copy(p).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); });
    const rw = (rect.x1 - rect.x0) * w, rh = (rect.y1 - rect.y0) * h;
    const k = Math.min(rw / (x1 - x0), rh / (y1 - y0));                 // px per mm
    const cxPx = (rect.x0 + rect.x1) / 2 * w, cyPx = (rect.y0 + rect.y1) / 2 * h;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    cam.left = cx - cxPx / k; cam.right = cam.left + w / k;
    cam.top = cy + cyPx / k; cam.bottom = cam.top - h / k;
    cam.updateProjectionMatrix();
    return k;
  }

  // v8 lays the section's heading over the drawing's top-left corner: what must stay clear of it is measured on the
  // text itself (a Range's box), since the heading's elements are blocks as wide as the column
  function tightRects(sel, pad) {
    if (!sel) return [];
    const sr = stage.getBoundingClientRect(), out = [];
    document.querySelectorAll(sel).forEach(function (e) {
      const rg = document.createRange(); rg.selectNodeContents(e);
      const b = rg.getBoundingClientRect();
      if (b.width && b.height) out.push({ x0: b.left - sr.left - pad, x1: b.right - sr.left + pad, y0: b.top - sr.top - pad, y1: b.bottom - sr.top + pad });
    });
    return out;
  }
  function boxOf(k) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    S.corners[k].forEach(function (v) { const p = project(main.cam, v, W, H); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    return { x0: x0, x1: x1, y0: y0, y1: y1 };
  }
  function rectsMeet(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }

  // v8: the place for DETAIL A that overlaps no instrument (their drawn boxes, with a margin), nor the key, nor the
  // stage's top edge (its caption sits above it), as close as possible to the photometer, on its left if it can be
  function freeSpot(r) {
    const sr = stage.getBoundingClientRect();
    const boxes = ["bioreactor", "lpa", "hydroponics"].map(function (k) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      S.corners[k].forEach(function (v) { const p = project(main.cam, v, W, H); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      // the plate's and the LPA's boxes reach well above them in a 3/4 view; their tags sit beside them
      const pad = phone ? 8 : (k === "bioreactor" ? 28 : 16);
      return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad - (k === "bioreactor" ? 0 : (phone ? 6 : 12)), y1: y1 + pad };
    });
    if (!phone) tightRects(CFG.avoid, 18).forEach(function (b) { boxes.push(b); });
    const pp = project(main.cam, S.anchors.cell.clone().lerp(S.anchors.led, 0.25), W, H);
    const top = r + (phone ? 10 : 26), mx = r + (phone ? 8 : 20);
    let best = null, bs = 1e18;
    for (let y = top; y <= H - r - 8; y += 4) {
      for (let x = mx; x <= W - mx; x += 4) {
        const cc = { x: x, y: y };
        if (boxes.some(function (b) { return circleHitsRect(cc, r + 6, b); })) continue;
        // and its caption, a line above it on a desktop
        if (!phone) { const cap = { x0: x - 95, x1: x + 95, y0: y - r - 28, y1: y - r - 4 };
          if (cap.y0 < 0 || boxes.some(function (b) { return rectsMeet(b, cap); })) continue; }
        const d = Math.hypot(x - pp.x, y - pp.y) + (x > pp.x ? 400 : 0);
        if (d < bs) { bs = d; best = cc; }
      }
    }
    return best;
  }
  // the largest DETAIL A (rmax down to rmin) that has a free spot, or null
  function placeDetail(D) {
    const hi = Math.round(Math.max(D.rmin, Math.min(D.rmax, D.r * H)));
    for (let r = hi; r >= D.rmin; r -= 4) { const c = freeSpot(r); if (c) return { c: c, r: r }; }
    return null;
  }

  function resize() {
    if (!S.ready) return;
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    phone = W < 761;
    lay = LAY[CFG.mode][phone ? "phone" : "desktop"];
    arrange(phone);
    DPR = Math.min(window.devicePixelRatio || 1, QS.dpr || 3);
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    // main camera: everything on the bench, framed into the drawing area
    const tgt = new V3(0, 200, 0);
    aim(main.cam, tgt, lay.yaw, lay.el, CAM_DIST);
    const pts = [].concat(S.corners.bioreactor, S.corners.lpa, S.corners.hydroponics);
    // v8: the bench's front edge in the frame too, so there is cream in front of the instruments
    if (lay.front) [-380, 380].forEach(function (x) { pts.push(world.localToWorld(new V3(x, BENCH.cy - BENCH.depth / 2, 0))); });
    // v8 desktop: both front corners of the bench in the frame, so it never runs off the screen's edge
    if (lay.front && V8 && !phone) [-1, 1].forEach(function (sx) { pts.push(world.localToWorld(new V3(sx * BENCH.width / 2, BENCH.cy - BENCH.depth / 2, 0))); });
    main.k = fitOrtho(main.cam, pts, W, H, lay.fit);
    const rect = Object.assign({}, lay.fit);
    if (V8 && !phone && CFG.avoid) {
      // the heading sits over the drawing's top-left corner: if an instrument would run under it, the drawing first
      // moves right (up to 6% of the width), then gives up a little of its top, step by step, until none does
      const av = tightRects(CFG.avoid, 20);
      for (let i = 0; i < 60; i++) {
        const meet = ["bioreactor", "lpa", "hydroponics"].some(function (k) { const b = boxOf(k); return av.some(function (a) { return rectsMeet(a, b); }); });
        if (!meet) break;
        if (rect.x1 < 0.995) { rect.x0 += 0.01; rect.x1 += 0.01; } else rect.y0 += 0.01;
        main.k = fitOrtho(main.cam, pts, W, H, rect);
      }
    }
    // DETAIL A: where the circle goes (CSS px)
    const D = lay.detail;
    let c;
    if (D.auto) {
      // the largest DETAIL A that fits somewhere clear; if none does, the drawing gives up a little more of its top
      let pl = placeDetail(D);
      for (let i = 0; i < 30 && !pl; i++) {
        rect.y0 += 0.012; if (rect.x0 > lay.fit.x0) { rect.x0 -= 0.004; rect.x1 -= 0.004; }
        main.k = fitOrtho(main.cam, pts, W, H, rect);
        pl = placeDetail(D);
      }
      if (!pl) pl = { c: { x: D.rmin + 20, y: D.rmin + 30 }, r: D.rmin };
      S.dr = pl.r; c = pl.c;
    } else if (D.rel) {
      S.dr = Math.round(Math.max(D.rmin || 0, Math.min(D.rmax || 1e9, D.r * H)));
      const pp = project(main.cam, S.anchors.photometer, W, H);
      c = { x: pp.x + D.rel[0] * S.dr, y: pp.y + D.rel[1] * S.dr };
      c.y = Math.max(S.dr + 30, Math.min(H - S.dr - 8, c.y));
    } else {
      S.dr = Math.round(Math.min(D.r * H, 0.26 * W));
      c = { x: D.cx * W, y: D.cy * H };
    }
    const m = phone ? 12 : 30;
    if (!D.auto) { c.y = Math.max(S.dr + m, c.y); c.x = Math.max(S.dr + m, c.x); }
    if (!D.auto) {
      const av = CFG.avoid && document.querySelector(CFG.avoid);
      if (av && !phone) {
        const hr = av.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        const head = { x0: hr.left - sr.left - 8, x1: hr.right - sr.left + 18, y0: hr.top - sr.top - 8, y1: hr.bottom - sr.top + 14 };
        for (let i = 0; i < 400 && circleHitsRect(c, S.dr, head); i++) c.x += 3;
      }
    }
    S.dc = { x: Math.round(c.x), y: Math.round(c.y) };
    // nearly square to the beam plane: along its normal from the viewer's side, turned a little (dyaw, del) so the
    // section reads as a solid
    const dir = S.detN.clone().applyAxisAngle(new V3(0, 1, 0), lay.dyaw * DEG);
    dir.y += Math.sin(lay.del * DEG); dir.normalize();
    det.cam.position.copy(S.detAt).addScaledVector(dir, CAM_DIST); det.cam.up.set(0, 1, 0); det.cam.lookAt(S.detAt);
    det.cam.updateMatrixWorld(true);
    det.cam.left = -DET_R; det.cam.right = DET_R; det.cam.top = DET_R; det.cam.bottom = -DET_R; det.cam.updateProjectionMatrix();
    det.k = S.dr / DET_R;
    S.dirty = true;
    layoutOverlay();
  }

  /* =============================================================== bake */
  // GPU memory: the supersampled targets live only for the bake; the three per-view textures stay.
  function rtOf(w, h, opt) {
    return new THREE.WebGLRenderTarget(w, h, Object.assign({ type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false }, opt || {}));
  }
  function bake(V, cssW, cssH) {
    // device pixels, and the supersampling over them (about 2x2, capped at ~9 megapixels)
    const dw = Math.max(1, Math.round(cssW * DPR)), dh = Math.max(1, Math.round(cssH * DPR));
    const f = QS.ss || Math.max(1, Math.min(2.25, Math.sqrt(9e6 / (dw * dh))));
    const sw = Math.round(dw * f), sh = Math.round(dh * f);
    const mmPx = (V.cam.right - V.cam.left) / sw;                  // mm per supersampled pixel
    const tC = rtOf(sw, sh, { depthBuffer: true });
    const tN = rtOf(sw, sh, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    const aw = Math.round(sw / 2), ah = Math.round(sh / 2);
    const tA = rtOf(aw, ah), tB = rtOf(aw, ah), tE = rtOf(sw, sh);
    // colour: the solids, then the glass over them
    V.cam.layers.mask = 1 << V.lc;
    renderer.setRenderTarget(tC); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
    renderer.render(scene, V.cam);
    V.cam.layers.mask = 1 << V.lg;
    renderer.render(scene, V.cam);
    // normals, depth, id
    setND(true);
    renderer.setRenderTarget(tN); renderer.clear(false, true, false);
    renderer.render(ndClear.scene, fsCam);
    V.cam.layers.mask = 1 << V.ln;
    renderer.render(scene, V.cam);
    setND(false);
    // ambient occlusion (half resolution), blurred
    AO.u.tN.value = tN.texture; AO.u.uTx.value.set(1 / sw, 1 / sh); AO.u.uMmPx.value = mmPx * 1; AO.u.uR.value = V.ao;
    run(AO, tA);
    BLUR.u.tN.value = tN.texture;
    BLUR.u.tA.value = tA.texture; BLUR.u.uTx.value.set(1 / aw, 1 / ah); BLUR.u.uDir.value.set(1, 0); run(BLUR, tB);
    BLUR.u.tA.value = tB.texture; BLUR.u.uDir.value.set(0, 1); run(BLUR, tA);
    // outlines, the line width in supersampled pixels
    EDGE.u.tN.value = tN.texture; EDGE.u.uTx.value.set(1 / sw, 1 / sh); EDGE.u.uW.value = V.lineW * DPR * f;
    EDGE.u.uFar.value = V.far; EDGE.u.uNear.value = V.near; EDGE.u.uParts.value = V.parts; EDGE.u.uInkA.value = V.inkA || 1;
    run(EDGE, tE);
    // resolve to the canvas's pixels: the plate, the instruments' coverage, the nearest depth
    if (!V.tP) { V.tP = rtOf(dw, dh); V.tK = rtOf(dw, dh); V.tZ = rtOf(dw, dh, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); }
    else { V.tP.setSize(dw, dh); V.tK.setSize(dw, dh); V.tZ.setSize(dw, dh); }
    RESOLVE.u.tC.value = tC.texture; RESOLVE.u.tA.value = tA.texture; RESOLVE.u.tE.value = tE.texture;
    RESOLVE.u.uSrcTx.value.set(1 / sw, 1 / sh); RESOLVE.u.uFoot.value.set(f, f);
    run(RESOLVE, V.tP);
    COVER.u.tN.value = tN.texture; COVER.u.uSrcTx.value.set(1 / sw, 1 / sh); COVER.u.uFoot.value.set(f, f);
    COVER.u.uMode.value = 0; run(COVER, V.tK);
    COVER.u.uMode.value = 1; run(COVER, V.tZ);
    [tC, tN, tA, tB, tE].forEach(function (t) { t.dispose(); });
    V.dw = dw; V.dh = dh; V.f = f;
    renderer.setRenderTarget(null);
  }
  function bakeAll() {
    const t0 = performance.now();
    bake(main, W, H);
    U.cutOn.value = 1;
    const n = S.detN;
    // the cut plane in the detail camera's view space, for the section caps' depth
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n.clone(), n.clone().multiplyScalar(U.cut.value.w));
    pl.applyMatrix4(det.cam.matrixWorldInverse);
    U.cutV.value.set(pl.normal.x, pl.normal.y, pl.normal.z, -pl.constant);
    bake(det, 2 * S.dr, 2 * S.dr);
    U.cutOn.value = 0;
    S.dirty = false;
    S.bakeMs = Math.round(performance.now() - t0);
  }

  /* =============================================================== frame */
  function blit(V, x, y, w, h) {
    renderer.setRenderTarget(null);
    const dx = Math.round(x * DPR), dy = Math.round((H - y - h) * DPR), dw = V.dw, dh = V.dh;
    const M = V.circle ? Math.round(w * 0.12) : 0;
    renderer.setViewport(x - M, H - y - h - M, w + 2 * M, h + 2 * M);
    renderer.setScissor(x - M, H - y - h - M, w + 2 * M, h + 2 * M); renderer.setScissorTest(true);
    const u = BLIT.u;
    u.uExp.value = (w + 2 * M) / w;
    u.tP.value = V.tP.texture; u.tK.value = V.tK.texture; u.uTx.value.set(1 / dw, 1 / dh);
    u.uCircle.value = V.circle ? 1 : 0; u.uEdge.value = 2.5 / Math.max(10, dw);
    if (V.circle) {
      const p = st.f.photometer;
      u.uFade.value.set(0, p.fade, 0, 0); u.uHotA.value = 0; u.uBenchFade.value = 0;
      u.uReveal.value = Math.max(0, Math.min(1, (st.reveal - 0.35) / 0.4)) * 1.2;
    } else {
      u.uFade.value.set(st.f.bioreactor.fade, st.f.photometer.fade, st.f.lpa.fade, st.f.hydroponics.fade);
      u.uBenchFade.value = st.benchFade;
      const hk = st.hot || st.lastHot;
      u.uHot.value.set(hk === "bioreactor" ? 1 : 0, hk === "photometer" || hk === "bioreactor" ? 1 : 0, hk === "lpa" ? 1 : 0, hk === "hydroponics" ? 1 : 0);
      u.uHotA.value = hk ? st.f[hk].hot : 0;
      u.uHotCol.value.set(hk ? HUB[hk] : "#ffffff");
      u.uHaloR.value = (V8 ? 6 : 5) * DPR;
      u.uReveal.value = easeInOut(st.reveal);
    }
    renderer.render(BLIT.scene, fsCam);
    renderer.setViewport(x, H - y - h, w, h);
    renderer.setScissor(x, H - y - h, w, h);
    // what moves: the culture's flow, the photometer's light
    V.cam.layers.mask = 1 << V.lf;
    const fu = V.circle ? S.model.dflowU : S.model.flowU;
    U.clip.value.set(dx + dw / 2, dy + dh / 2, dw / 2 - 1, V.circle ? 1 : 0);
    fu.tZ.value = V.tZ.texture; fu.uZview.value.set(dx, dy, dw, dh);
    S.overlays.forEach(function (o) { o.material.uniforms.uPx.value = DPR; o.material.uniforms.uRes.value.set(dw, dh); });
    renderer.render(scene, V.cam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
  }

  /* ============================================================ the state */
  const st = { hot: null, src: null, pinned: null, ptr: null, ptrDirty: false, reveal: REDUCED ? 1 : 0, revealGo: CFG.mode === "page", f: {}, benchFade: 0 };
  ["bioreactor", "photometer", "lpa", "hydroponics", "loop"].forEach(function (k) { st.f[k] = { fade: 0, hot: 0 }; });

  function setHot(k, src) {
    if (k === st.hot) { st.src = src; return; }
    st.hot = k; st.src = src;
    document.querySelectorAll(".bw-parts a").forEach(function (a) { a.classList.toggle("on", a.dataset.inst === k); });
    TAGS.forEach(function (t) { t.el.classList.toggle("on", t.key === k); t.el.classList.toggle("dim", !!k && t.key !== k); });
    ROOT.classList.toggle("bw-has-hot", !!k);
    ROOT.dataset.hot = k || "";
    canvas.classList.toggle("hot", !!k);
    // phone: the card goes to a sheet at the bottom of the screen
    const pick = $("bw-pick");
    if (phone && k) {
      const a = document.querySelector('.bw-parts a[data-inst="' + k + '"]');
      const q = function (sel) { return a.querySelector(sel).innerHTML; };
      const pa = $("bw-pick-a");
      pa.href = a.getAttribute("href"); pick.style.cssText = a.getAttribute("style");
      pa.innerHTML = '<span class="bw-no">' + q(".bw-no") + '</span><span class="bw-nm">' + q(".bw-nm") + '</span><span class="bw-rl">' + q(".bw-rl") + '</span>' +
        '<span class="bw-st">' + q(".bw-st") + '</span><span class="bw-say">' + q(".bw-say") + '</span><span class="bw-go">Open its page &rarr;</span>';
      pick.classList.add("show");
    } else pick.classList.remove("show");
  }
  $("bw-pick-x").addEventListener("click", function () { st.pinned = null; setHot(null, null); });

  let last = 0;
  function frame(now) {
    if (!S.ready) return;
    const t = (now - S.t0) / 1000;
    const dt = Math.min(0.05, Math.max(0, (now - (last || now)) / 1000)); last = now;
    step(t, dt);
    draw();
  }
  function step(t, dt) {
    U.time.value = REDUCED ? 0 : t;
    if (!REDUCED && st.revealGo) st.reveal = Math.min(1, st.reveal + dt / 1.3);
    // the labels, leaders and DETAIL A's furniture come in with the drawing, not before it
    const ovA = Math.max(0, Math.min(1, (st.reveal - 0.5) / 0.4));
    if (ovA !== st.ovA) { st.ovA = ovA; OVL.forEach(function (e) { e.style.opacity = ovA < 1 ? ovA.toFixed(3) : ""; }); }
    const k = 1 - Math.exp(-dt * 10);
    const hot = st.hot;
    ["bioreactor", "photometer", "lpa", "hydroponics", "loop"].forEach(function (key) {
      const f = st.f[key];
      // the photometer is part of the bioreactor, and the loop belongs to both
      const mine = key === "loop" ? (hot === "bioreactor" || hot === "photometer") :
                   key === "photometer" ? (hot === "photometer" || hot === "bioreactor") : hot === key;
      const other = !!hot && !mine;
      const amount = key === "bioreactor" && hot === "photometer" ? 0.5 : key === "loop" ? 0.5 : 0.7;
      f.fade += ((other ? amount : 0) - f.fade) * k;
      f.hot += ((hot === key ? 1 : 0) - f.hot) * k;
      FADE[key].value = f.fade;
    });
    st.benchFade += ((hot ? 0.35 : 0) - st.benchFade) * k;
    const M = S.model, ph = st.f.photometer.hot;
    const on = Math.max(0, Math.min(1, (st.reveal - 0.6) / 0.3));
    M.flowU.uOn.value = on; M.dflowU.uOn.value = on;
    M.flowU.uGain.value = 1 + 0.2 * ph;
    M.beamOn.value = (0.85 + 0.15 * ph) * on;
  }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function draw() {
    if (S.dirty) bakeAll();
    if (st.ptrDirty) readPointer();
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
    blit(main, 0, 0, W, H);
    blit(det, S.dc.x - S.dr, S.dc.y - S.dr, 2 * S.dr, 2 * S.dr);
    positionOverlay();
  }

  let raf = 0, running = false;
  function loop(now) { raf = requestAnimationFrame(loop); frame(now); }
  function start() { if (running || S.onScreen === false) return; running = true; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else if (S.ready) { last = 0; start(); } });
  if ("IntersectionObserver" in window) {
    // Render only while the drawing is on screen. In a section, the load-in waits until a third of it is in view, and a
    // picked instrument's card (the phone sheet) goes when the drawing leaves.
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          S.onScreen = true;
          if (e.intersectionRatio >= 0.3) st.revealGo = true;
          if (S.ready && !document.hidden) { last = 0; start(); }
        } else {
          S.onScreen = false; stop();
          if (st.hot || st.pinned) { st.pinned = null; setHot(null, null); }
        }
      });
    }, { threshold: [0, 0.3] }).observe(stage);
  }
  // The stage's own size, not the window's: a scrollbar appearing (phone layout) narrows the stage without any window
  // resize, and a stale size stretches the canvas under the overlay.
  let rzT = 0;
  function onResize() { clearTimeout(rzT); rzT = setTimeout(function () { if (S.ready) { resize(); draw(); } }, 90); }
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(stage);
  window.addEventListener("resize", onResize);

  /* ============================================================== overlay */
  const TAGS = [], TAG_ORDER = ["photometer", "bioreactor", "lpa", "hydroponics"];
  const OVL = [".bw-ov", ".bw-tags", ".bw-detail"].map(function (q) { return ROOT.querySelector(q); }).filter(Boolean);
  const SVGNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function buildOverlay() {
    const tags = $("bw-tags"), led = $("bw-ov-leaders");
    document.querySelectorAll(".bw-parts a").forEach(function (a) {
      const key = a.dataset.inst;
      const t = document.createElement("a");
      t.className = "bw-tag"; t.href = a.getAttribute("href"); t.tabIndex = -1; t.setAttribute("aria-hidden", "true");
      t.dataset.inst = key; t.style.cssText = a.getAttribute("style");
      const q = function (s) { return a.querySelector(s).innerHTML; };
      t.innerHTML = '<span class="bw-row"><span class="bw-no">' + q(".bw-no") + '</span><span class="bw-nm">' + q(".bw-nm") + '</span></span>' +
        '<span class="bw-more"><span class="bw-in"><span class="bw-rl">' + q(".bw-rl") + '</span><span class="bw-st">' + q(".bw-st") + '</span>' +
        '<span class="bw-say">' + q(".bw-say") + '</span><span class="bw-go">Open its page &rarr;</span></span></span>';
      tags.appendChild(t);
      const ci = getComputedStyle(a).getPropertyValue("--ci").trim();
      const line = el("polyline", { class: "bw-ld", stroke: ci }, led);
      const dot = el("circle", { class: "bw-ad", r: 2.5, fill: "#fff", stroke: ci }, led);
      TAGS.push({ key: key, el: t, no: t.querySelector(".bw-no"), line: line, dot: dot, list: a });
      t.addEventListener("mouseenter", function () { setHot(key, "tag"); });
      t.addEventListener("click", firstTapSelects(key));
      t.addEventListener("mouseleave", function () { if (st.src === "tag") setHot(st.pinned, null); });
      a.addEventListener("mouseenter", function () { setHot(key, "list"); });
      a.addEventListener("mouseleave", function () { if (st.src === "list") setHot(st.pinned, null); });
      a.addEventListener("focus", function () { setHot(key, "focus"); });
      a.addEventListener("blur", function () { if (st.src === "focus") setHot(null, null); });
    });
    // DETAIL A furniture: the circle's ring, the small ring round the photometer in the drawing, two tangents
    const g = $("bw-ov-detail");
    S.ov = {
      big: el("circle", { class: "bw-dc-big" }, g), small: el("circle", { class: "bw-dc-small" }, g),
      t1: el("line", { class: "bw-dc-tan" }, g), t2: el("line", { class: "bw-dc-tan" }, g), notes: [],
    };
    const d = $("bw-detail");
    d.addEventListener("mouseenter", function () { setHot("photometer", "detail"); });
    d.addEventListener("click", firstTapSelects("photometer"));
    d.addEventListener("mouseleave", function () { if (st.src === "detail") setHot(st.pinned, null); });
    // notes beside the detail: where the light comes from, what it crosses
    const notes = $("bw-detail-notes");
    [{ k: "beam", t: "600 nm LED beam", p: "LED beam" }, { k: "cell", t: "Flow cell, 0.2 mm path", p: "Flow cell" }].forEach(function (n) {
      const s = document.createElement("span"); s.className = "bw-dnote"; s.textContent = n.t; notes.appendChild(s);
      S.ov.notes.push({ k: n.k, t: n.t, p: n.p || n.t, el: s, line: el("polyline", { class: "bw-dn" }, g), dot: el("circle", { class: "bw-dn-dot", r: 2.25 }, g) });
    });
  }
  function project(cam, v, w, h) {
    const p = v.clone().project(cam);
    return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h };
  }
  function layoutOverlay() {
    const sr = stage.getBoundingClientRect();
    S.keepOut = phone || !CFG.keepout ? [] : V8 ? tightRects(CFG.keepout, 8) : CFG.keepout.split(",").map(function (q) { return document.querySelector(q.trim()); }).filter(Boolean).map(function (e) {
      const r = e.getBoundingClientRect();
      return { x0: r.left - sr.left - 6, x1: r.right - sr.left + 6, y0: r.top - sr.top - 6, y1: r.bottom - sr.top + 6 };
    });
    const d = $("bw-detail");
    d.style.left = (S.dc.x - S.dr) + "px"; d.style.top = (S.dc.y - S.dr) + "px";
    d.style.width = d.style.height = (2 * S.dr) + "px";
    const mag = det.k / main.k;
    $("bw-detail-x").textContent = "×" + mag.toFixed(1);
  }
  function positionOverlay() {
    const o = S.ov;
    // DETAIL A: the circle, a small ring round the photometer in the drawing, and the two tangents between them
    const pc = project(main.cam, S.anchors.cell.clone().lerp(S.anchors.led, 0.25), W, H);
    const rs = Math.max(16, main.k * 62);
    const big = { x: S.dc.x, y: S.dc.y, r: S.dr + 0.5 }, sm = { x: pc.x, y: pc.y, r: rs };
    setC(o.big, big.x, big.y, big.r); setC(o.small, sm.x, sm.y, sm.r);
    const ph = st.f.photometer.hot;
    o.big.style.strokeWidth = (1.25 + 0.5 * ph).toFixed(2);
    const tg = tangents(big, sm);
    [o.t1, o.t2].forEach(function (l, i) {
      const T = tg[i];
      if (!T) { l.setAttribute("visibility", "hidden"); return; }
      l.setAttribute("visibility", "visible");
      l.setAttribute("x1", T[0].x.toFixed(1)); l.setAttribute("y1", T[0].y.toFixed(1)); l.setAttribute("x2", T[1].x.toFixed(1)); l.setAttribute("y2", T[1].y.toFixed(1));
    });
    // notes beside the detail (the detail camera's projection, into the circle's box)
    const box = 2 * S.dr, ox = S.dc.x - S.dr, oy = S.dc.y - S.dr;
    const P = function (v) { const p = project(det.cam, v, box, box); return { x: p.x + ox, y: p.y + oy }; };
    const at = { beam: P(S.anchors.beamIn), cell: P(S.anchors.cell) };
    const off = V8 ? {} : DNOTE[phone ? "phone" : "desktop"];
    o.notes.forEach(function (n) {
      const a = at[n.k], f = off[n.k];
      n.el.hidden = !f; n.line.style.display = n.dot.style.display = f ? "" : "none";
      if (!f) return;
      const txt = phone ? n.p : n.t; if (n.el.textContent !== txt) n.el.textContent = txt;
      const tx = S.dc.x + f[0] * S.dr, ty = S.dc.y + f[1] * S.dr;
      const right = f[2] === "r";
      const bw = n.el.offsetWidth, bh = n.el.offsetHeight;
      n.el.style.transform = "translate(" + (tx - ox - (right ? 0 : bw)).toFixed(1) + "px," + (ty - oy - bh / 2).toFixed(1) + "px)";
      const ex = right ? tx - 4 : tx + 4;
      n.line.setAttribute("points", a.x.toFixed(1) + "," + a.y.toFixed(1) + " " + ex.toFixed(1) + "," + ty.toFixed(1));
      n.dot.setAttribute("cx", a.x.toFixed(1)); n.dot.setAttribute("cy", a.y.toFixed(1));
    });
    // tags with leaders (all reads before any write, so the layout is computed once a frame)
    TAGS.forEach(function (T) {
      T.bw = T.el.offsetWidth; T.bh = T.el.offsetHeight; T.nx = T.no.offsetLeft + T.no.offsetWidth / 2; T.ny = T.no.offsetTop + T.no.offsetHeight / 2;
      T.on = T.el.classList.contains("on");
      if (!T.on) { T.bh0 = T.bh; T.bw0 = T.bw; }
    });
    const placed = [];
    TAG_ORDER.forEach(function (key) {
      const T = TAGS.find(function (x) { return x.key === key; });
      let ax, ay, tx, ty, right;
      if (T.key === "photometer") {
        // the photometer's tag hangs off DETAIL A's circle, upper left
        // upper left of the circle; or upper right, when the left has no room for the tag (or on a phone)
        const leftRoom = S.dc.x - S.dr * 0.75 - 24 > (T.bw0 || T.bw) + 16;
        const onLeft = !phone && leftRoom;
        const a = (onLeft ? -138 : (phone ? -60 : -42)) * DEG;
        ax = S.dc.x + Math.cos(a) * S.dr; ay = S.dc.y + Math.sin(a) * S.dr;
        right = onLeft;
        tx = ax + (onLeft ? -16 : (phone ? 6 : 26)); ty = ay - (phone ? 10 : 22);
        T.dot.setAttribute("r", 0);
      } else {
        const p = project(main.cam, S.anchors[T.key], W, H);
        const off = lay.tags[T.key];
        ax = p.x; ay = p.y; tx = p.x + off[0]; ty = p.y + off[1]; right = off[0] < 0;
        T.dot.setAttribute("r", st.hot === T.key ? 3.25 : 2.5);
      }
      const bw = T.bw, bh = T.bh;
      // laid out at its collapsed size; an open card grows from there, upward when its instrument is below it
      const bh0 = T.bh0 || bh, bw0 = T.bw0 || bw;
      let left = right ? tx - bw0 : tx, top = ty - bh0 / 2;
      if (T.on && right) left -= bw - bw0;
      if (T.on && ay > ty) {
        top -= bh - bh0;
        // unless that would put it on DETAIL A, or on the heading's text: then it grows downward after all
        const R0 = { x0: left, x1: left + bw, y0: top, y1: top + bh };
        if ((T.key !== "photometer" && circleHitsRect({ x: S.dc.x, y: S.dc.y }, S.dr + 6, R0)) ||
            (V8 && S.keepOut.some(function (k) { return rectsMeet(k, R0); }))) top += bh - bh0;
      }
      if (T.on && V8) {
        // an open card never sits on the heading's text: it moves down below it
        for (let i = 0; i < 80 && S.keepOut.some(function (k) { return rectsMeet(k, { x0: left, x1: left + bw, y0: top, y1: top + bh }); }); i++) top += 6;
      }
      left = Math.max(phone ? 8 : 24, Math.min(W - bw - (phone ? 8 : 24), left));
      top = Math.max(phone ? 6 : 8, Math.min(H - bh - 10, top));
      const hits = function (R) { return left < R.x1 && left + bw > R.x0 && top < R.y1 && top + bh > R.y0; };
      const circ = { x: S.dc.x, y: S.dc.y };
      const onCircle = function () { return circleHitsRect(circ, S.dr + 8, { x0: left, x1: left + bw, y0: top, y1: top + bh }); };
      if (T.key === "photometer" && !T.on) {
        // beside the circle, never on it
        for (let i = 0; i < 60 && onCircle(); i++) { if (right) left -= 4; else top -= 4; }
      } else if (!T.on) {
        // the nearest free place above or below where it wants to be
        const t0 = top;
        for (let i = 0; i < 80; i++) {
          top = Math.max(phone ? 6 : 8, Math.min(H - bh - 10, t0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 6));
          if (!(S.keepOut.some(hits) || placed.some(hits) || onCircle())) break;
        }
      }
      left = Math.max(phone ? 8 : 16, Math.min(W - bw - (phone ? 8 : 16), left));
      top = Math.max(phone ? 6 : 6, Math.min(H - bh - 8, top));
      placed.push({ x0: left - 6, x1: left + bw + 6, y0: top - 4, y1: top + bh + 4 });
      T.el.style.transform = "translate(" + left.toFixed(1) + "px," + top.toFixed(1) + "px)";
      T.el.classList.toggle("anchor-r", right);
      // the leader: from the anchor, a straight run, then level into the balloon
      const bx = left + T.nx, by = top + T.ny;
      const nr = T.no.offsetWidth / 2 + 1;
      const ex = right ? bx + nr : bx - nr;
      const sx = right ? ex + 14 : ex - 14;
      const pts = T.key === "photometer" ? [ax, ay, ex, by] : [ax, ay, sx, by, ex, by];
      T.line.setAttribute("points", pts.map(function (v) { return v.toFixed(1); }).join(" "));
      T.dot.setAttribute("cx", ax.toFixed(1)); T.dot.setAttribute("cy", ay.toFixed(1));
      T.line.style.opacity = st.hot && st.hot !== T.key ? 0.3 : 1;
    });
  }
  // where DETAIL A's notes sit: [x, y] as fractions of its radius from its centre, and which way the text runs from
  // there ("l": it ends at the point, "r": it starts there)
  const DNOTE = {
    desktop: { beam: [-1.16, -0.46, "l"], cell: [-1.16, 0.12, "l"] },
    phone: { beam: [1.16, 0.12, "r"], cell: [1.16, 0.5, "r"] },
  };
  function circleHitsRect(c, r, R) {
    const nx = Math.max(R.x0, Math.min(c.x, R.x1)), ny = Math.max(R.y0, Math.min(c.y, R.y1));
    return Math.hypot(c.x - nx, c.y - ny) < r;
  }
  // On a phone a balloon (or DETAIL A) is a link like everything else, but the first tap picks the instrument and opens
  // its card; the second opens the page — the same as tapping the drawing.
  function firstTapSelects(key) {
    return function (e) {
      if (!phone || st.pinned === key) return;
      e.preventDefault(); st.pinned = key; setHot(key, "touch");
    };
  }
  function setC(c, x, y, r) { c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1)); c.setAttribute("r", r.toFixed(1)); }
  // the two outer tangents of two circles (each as its two touch points)
  function tangents(A, Bc) {
    const dx = Bc.x - A.x, dy = Bc.y - A.y, d = Math.hypot(dx, dy);
    if (d <= Math.abs(A.r - Bc.r) + 1) return [null, null];
    const base = Math.atan2(dy, dx), off = Math.acos((A.r - Bc.r) / d);
    return [1, -1].map(function (s) {
      const a = base + s * off;
      return [{ x: A.x + A.r * Math.cos(a), y: A.y + A.r * Math.sin(a) }, { x: Bc.x + Bc.r * Math.cos(a), y: Bc.y + Bc.r * Math.sin(a) }];
    });
  }

  /* =========================================================== pointer */
  // Picking: the id under the pointer, from a one-pixel render of the normal/depth/id pass (the main camera narrowed
  // to that pixel, into a 1x1 float target). Only on pointer moves.
  const buf = new Float32Array(4), pickRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const pickCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 30000);
  function pickId(x, y) {
    const c = main.cam, sx = (c.right - c.left) / W, sy = (c.top - c.bottom) / H;
    pickCam.position.copy(c.position); pickCam.quaternion.copy(c.quaternion);
    pickCam.left = c.left + x * sx; pickCam.right = pickCam.left + sx;
    pickCam.top = c.top - y * sy; pickCam.bottom = pickCam.top - sy;
    pickCam.updateProjectionMatrix(); pickCam.updateMatrixWorld(true);
    pickCam.layers.mask = 1 << L_ND;
    setND(true);
    renderer.setRenderTarget(pickRT); renderer.clear(false, true, false);
    renderer.render(ndClear.scene, fsCam);
    renderer.render(scene, pickCam);
    setND(false);
    renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, buf);
    renderer.setRenderTarget(null);
    return Math.floor(buf[3] / 64 + 0.001);
  }
  function readPointer() {
    st.ptrDirty = false;
    if (!st.ptr) return;
    if (st.ptr.x < 0 || st.ptr.y < 0 || st.ptr.x >= W || st.ptr.y >= H) return;
    const id = pickId(st.ptr.x, st.ptr.y);
    let key = KEY_OF_ID[id] || null;
    if (!key) key = rectHit(st.ptr.x, st.ptr.y);
    st.ptrKey = key;
    if (st.ptr.touch) return;
    if (key) setHot(key, "canvas");
    else if (st.src === "canvas") setHot(st.pinned, null);
  }
  // off the parts themselves: the instrument whose footprint the pointer is over (the gaps inside the tower are the tower)
  function rectHit(x, y) {
    const order = ["lpa", "hydroponics", "bioreactor"];
    for (let i = 0; i < order.length; i++) {
      const k = order[i];
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      S.corners[k].forEach(function (v) { const p = project(main.cam, v, W, H); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      const ix = (x1 - x0) * 0.06, iy = (y1 - y0) * 0.06;
      if (x > x0 + ix && x < x1 - ix && y > y0 + iy && y < y1 - iy) return k;
    }
    return null;
  }
  canvas.addEventListener("pointermove", function (e) {
    const r = canvas.getBoundingClientRect();
    st.ptr = { x: e.clientX - r.left, y: e.clientY - r.top, touch: e.pointerType === "touch" };
    st.ptrDirty = true;
    if (!running && S.ready) draw();
  });
  canvas.addEventListener("pointerleave", function () { st.ptr = null; if (st.src === "canvas") setHot(st.pinned, null); });
  canvas.addEventListener("click", function (e) {
    const r = canvas.getBoundingClientRect();
    st.ptr = { x: e.clientX - r.left, y: e.clientY - r.top, touch: st.lastTouch };
    readPointer();
    const k = st.ptrKey;
    if (st.lastTouch) {
      // touch: the first tap opens the instrument's card (its link is in it); a second tap on the same one opens the page
      if (k && st.pinned === k) { location.href = INSTPAGE(k); return; }
      st.pinned = k || null; setHot(st.pinned, k ? "touch" : null);
      return;
    }
    if (k) location.href = INSTPAGE(k);
  });
  canvas.addEventListener("pointerdown", function (e) { st.lastTouch = e.pointerType === "touch" || e.pointerType === "pen"; });
  function INSTPAGE(k) { return document.querySelector('.bw-parts a[data-inst="' + k + '"]').getAttribute("href"); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { st.pinned = null; setHot(null, null); } });

  /* ================================================================ debug */
  window.__bench = {
    get ready() { return S.ready; },
    renderAt: function (t, reveal) { if (reveal !== undefined) st.reveal = reveal; step(t, 0.016); draw(); },
    setHot: function (k) { setHot(k, "debug"); for (let i = 0; i < 60; i++) step(U.time.value, 0.05); draw(); },
    stop: stop, start: start, state: st, S: S, main: main, det: det, U: U, renderer: renderer, LAY: LAY, POS: POS, TONE: TONE, scene: scene,
    relayout: function () { resize(); draw(); }, rebake: function () { S.dirty = true; draw(); },
    // time the bake and a frame, forced to finish on the GPU (ms)
    profile: function (n) {
      stop(); const gl = renderer.getContext(); const T = [];
      let t0 = performance.now(); bakeAll(); gl.finish(); const bk = performance.now() - t0;
      for (let i = 0; i < (n || 60); i++) { t0 = performance.now(); step(10 + i / 60, 1 / 60); draw(); gl.finish(); T.push(performance.now() - t0); }
      start();
      T.sort(function (a, b) { return a - b; });
      return { bake: +bk.toFixed(1), frame: { med: +T[T.length >> 1].toFixed(2), p90: +T[Math.floor(T.length * 0.9)].toFixed(2), max: +T[T.length - 1].toFixed(2) } };
    },
    stats: function () { return { tris: S.model && S.model.tris, W: W, H: H, DPR: DPR, ss: main.f, plate: [main.dw, main.dh], detail: det.dw, k: main.k, mag: det.k / main.k, bakeMs: S.bakeMs, webgl2: GL2 }; },
  };
})();
