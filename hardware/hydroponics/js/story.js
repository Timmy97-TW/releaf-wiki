// Hydroponics growth plate — scroll-driven walkthrough.
//
// Scroll position through the track is the ONLY input. Everything below is a
// pure function of p in [0,1]: the same offset always draws the same frame,
// forwards or backwards, and there is no accumulated state to drift. That is
// also why nothing here uses a running clock for anything the reader can
// scrub — only the water and the idle spin, which are allowed to be live.
(function () {
  const canvas = document.getElementById("gl");
  const story  = document.getElementById("story");
  if (!canvas || !story) return;
  const hud    = document.getElementById("hud");
  const titleEl = document.getElementById("title");
  const cueEl  = document.getElementById("cue");
  const loader = document.getElementById("loader");
  const pctEl  = document.getElementById("load-pct");

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  // 1.6, not 2. At devicePixelRatio 2 this canvas is 3.9M pixels and the water
  // act is fill-bound; 1.6 costs 36% fewer pixels for a difference you cannot
  // see on a matte model.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 30000);
  const root = new THREE.Group();          // the model; tumbles in act 4
  root.rotation.x = -Math.PI / 2;          // Onshape Z-up -> three.js Y-up
  scene.add(root);
  const BASE_TILT = -Math.PI / 2;

  scene.environment = RQ.studioEnv(renderer, { top: "#8f9cab", floor: "#2e333b" });

  const key   = new THREE.DirectionalLight(0xfff6ec, 0.52); key.position.set(340, 620, 520);
  const rimC  = new THREE.DirectionalLight(0xbcd0e6, 0.30); rimC.position.set(-520, 260, -480);
  const rimW  = new THREE.DirectionalLight(0xffd9a8, 0.22); rimW.position.set(480, -120, -420);
  // Follows the camera, opposite it: a matte black plate on a near-black page
  // has no edge contrast, and a fixed rim only rescues the angles it faces.
  // 0.19, not 0.40. This light is what was making the plate read as light
  // silver: measured by ablation, it supplies about four fifths of the TOP
  // face's value and exactly nothing to the vertical rails, because those face
  // the camera and it sits behind the subject. Pulling it down darkens the part
  // without touching the lower half — top face 137 -> 93 at the holder act,
  // rail steady at 42.
  const rimBack = new THREE.DirectionalLight(0xd8e4ff, 0.19);
  // Act 7's daylight. Starts off; it is the only light that changes.
  const sun = new THREE.DirectionalLight(0xffeccc, 0.0); sun.position.set(-260, 900, 380);
  sun.visible = false;
  // Bounce off the reservoir. On the water the plate is backlit and read as a
  // black slab with no edge at all; this puts light back into its front face.
  const bounce = new THREE.DirectionalLight(0xa8cbe8, 0.0); bounce.position.set(-120, -520, 900);
  bounce.visible = false;
  // A near-level kicker on the CAMERA side. Every other light in this rig sits
  // above the horizon, and the two float rails — the whole lower half of the
  // part — are vertical faces, so they were getting almost no diffuse: an A/B
  // with the plate hidden measured the rail band at mean R 74 falling to 54
  // against a background of 95 falling to 78. The bottom half of the model was
  // rendering DARKER than the page behind it. This light is aimed along the
  // view axis from just above eye level, so it lands on vertical faces and
  // barely touches the horizontal top slab.
  const face = new THREE.DirectionalLight(0xd6e4f7, 0.95);
  // Every light in this rig is a DIRECTIONAL light, so it lights a fixed set of
  // world directions — and act 4 turns the part through all of them. Measured
  // plate mean across the turn: 99 before it, 41 at 45 deg, 28 at 250 deg, 36
  // at 300 deg, 98 after. The part spent the whole act at a third of its normal
  // brightness, which is why the air-chamber reveal read as murky. A hemisphere
  // term is orientation-independent by construction: it lifts whatever face
  // happens to be pointing anywhere, so the floor of the exposure stops moving.
  const turnFill = new THREE.HemisphereLight(0x9fb0c6, 0x2b3138, 0.0);
  turnFill.visible = false;
  scene.add(turnFill);
  // And a key that RAKES with the turn. A uniform lift — hemisphere or
  // environment — only scales the whole exposure: measured at 3x the
  // hemisphere the dark points went 28 -> 49 but the bright ones went 98 ->
  // 113, so the ratio barely moved. The dark phases are dark because the faces
  // presented have swung away from every fixed direction in the rig, and the
  // only cure is a direction that moves too. This one turns about the same
  // world axis as the part but at 0.6 of its rate, so it sweeps ACROSS the part
  // instead of locking to it — which keeps the turn reading as the part
  // turning, not as the world turning with it.
  const turnKey = new THREE.DirectionalLight(0xeaf2ff, 0.0);
  turnKey.visible = false;
  scene.add(turnKey, turnKey.target);
  scene.add(key, rimC, rimW, rimBack, rimBack.target, sun, sun.target,
            bounce, bounce.target, face, face.target);
  const FOG_WET = RQ.srgb(0x0b1220), FOG_DIVE = RQ.srgb(0x0a2b3c);
  scene.fog = new THREE.FogExp2(FOG_WET.clone(), 0);
  // No shadow pass. RQ.enableShadows' third argument is the shadow camera's
  // ORTHOGRAPHIC HALF-EXTENT, not the PCF blur radius it was being passed as:
  // at 2.2 the shadow camera framed a 4.4 mm box in front of a 117.5 mm plate,
  // so the pass rendered zero draw calls and only ever bound and cleared a
  // 2048x2048 depth target — 0.24-0.47 ms of nothing, in every frame of the
  // story. The floor's own falloff is doing the grounding.


  /* ---------- textures ---------- */
  function fadeTex(inner, outer) {
    const n = 256, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(n / 2, n / 2, n * inner, n / 2, n / 2, n * outer);
    r.addColorStop(0, "#ffffff"); r.addColorStop(0.55, "#8c8c8c"); r.addColorStop(1, "#000000");
    g.fillStyle = r; g.fillRect(0, 0, n, n);
    return new THREE.CanvasTexture(c);      // alpha mask — stays linear
  }
  // Layer lines, as a roughness map. roughnessMap MULTIPLIES, so this stays
  // near white: a mid-grey stripe halves the roughness and turns a matte
  // printed part into chrome.
  const LAYER_MM = 0.52;
  const layerTex = (function () {
    const n = 64, c = document.createElement("canvas");
    c.width = 4; c.height = n;
    const g = c.getContext("2d");
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const v = 232 + 15 * Math.sin(t * Math.PI * 2) + 7 * Math.sin(t * Math.PI * 6) | 0;
      g.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
      g.fillRect(0, i, 4, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  })();
  function addPrintUVs(geo) {
    const pos = geo.getAttribute("position");
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2]     = (pos.getX(i) * 0.31 + pos.getY(i) * 0.21) / LAYER_MM;
      uv[i * 2 + 1] = pos.getZ(i) / LAYER_MM;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }

  /* ---------- materials ---------- */
  function std(hex, m, r, e) {
    return new THREE.MeshStandardMaterial({
      color: RQ.srgb(hex), metalness: m, roughness: r, envMapIntensity: e });
  }
  const MAT = [
    std(0x1b1f26, 0.10, 0.60, 0.58),                                  // 0 plate
    std(0x6b727b, 0.16, 0.50, 0.85),                                  // 1 handles
    // Roughness, not colour, is what keeps this brown: at 0.52 the specular on
    // the flange was 78% of its brightness and no darkening could reach it.
    // Slightly translucent, by plain ALPHA. Not by transmission: transmission
    // > 0 on any material makes three.js render the whole scene a second time
    // into a transmission target every frame, and thirteen holders were once
    // buying that whole extra pass for an effect that measured as almost
    // nothing on a dark matte brown. Alpha costs one blend and no extra pass.
    // 0.90, not 0.82: the holders carry the layer-line roughness map like every
    // other printed part, and that map averages 0.908, so 0.90 keeps the mean
    // roughness at the 0.82 this brown was tuned at (0.76-0.87 across a band).
    new THREE.MeshStandardMaterial({
      color: RQ.srgb(0x5c3410), metalness: 0, roughness: 0.90,
      envMapIntensity: 0.60, side: THREE.DoubleSide,
      transparent: true, opacity: 0.92 }),                                   // 2 holder
  ];
  const MAT_C = MAT.map(function (m) { return m.color.clone(); });   // authored albedos
  let addRim = null;                    // defined below, applied after MAT exists

  /* ---------- ground ---------- */
  /* ---------- the accent rim ---------- */
  // "Highlighting parts", done as a Fresnel rim spliced into the stock standard
  // shader rather than as a duplicated outline shell. A shell costs a second
  // draw of the same geometry — 46k triangles for the plate — and on a packed,
  // non-indexed buffer it cannot be normal-extruded cleanly anyway. This is a
  // handful of ALU ops in a fragment shader that is already running: no extra
  // draw call, no render target, no extra pass.
  //
  // `normal` and `vViewPosition` are both live at <emissivemap_fragment> in
  // r128's meshphysical_frag (normal_fragment_begin runs earlier in the same
  // scope), and totalEmissiveRadiance starts at the material's emissive, which
  // is black here. customProgramCacheKey keeps the rim variant from being
  // handed a cached program compiled without it.
  const RIM_COLOR = RQ.srgb(0x9a7bff);
  const HOLDER_RIM_POW = 8.0, HOLDER_RIM_PEAK = 1.00;
  addRim = function (mat) {
    mat.userData.rim = { value: 0 };
    // Per-part falloff, 4 unless a part overrides it (see the holders below).
    mat.userData.rimPow = { value: 4.0 };
    // 0 = every face takes the rim; 1 = faces pointing along the part's own
    // z axis (flat tops and undersides) take none of it (see the holders).
    mat.userData.rimFlat = { value: 0 };
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uRim = mat.userData.rim;
      shader.uniforms.uRimPow = mat.userData.rimPow;
      shader.uniforms.uRimColor = { value: RIM_COLOR };
      shader.uniforms.uRimFlat = mat.userData.rimFlat;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vRimNz;")
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvRimNz = objectNormal.z;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>",
                 "#include <common>\nuniform float uRim, uRimPow;\nuniform vec3 uRimColor;\nuniform float uRimFlat;\nvarying float vRimNz;")
        .replace("#include <emissivemap_fragment>",
                 "#include <emissivemap_fragment>\n" +
                 "float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n" +
                 "rimF *= mix(1.0, sqrt(max(0.0, 1.0 - vRimNz * vRimNz)), uRimFlat);\n" +
                 "totalEmissiveRadiance += uRimColor * (pow(rimF, uRimPow) * uRim);");
      // Wetting (act 6): below the local wave height the skin is tinted and
      // de-specularised, with a meniscus hairline at the contact. See submerge().
      submerge(shader);
    };
    mat.customProgramCacheKey = function () { return "rim"; };
    return mat;
  };
  MAT.forEach(addRim);
  // The plate's rim is ALSO what lights the rails in act 03, and a Fresnel
  // term knows nothing about which part it is on: at the 122 deg hold every
  // bore boss on the underside is a grazing silhouette too, so all thirteen
  // bores in the MIDDLE of the plate wore a violet crescent under a caption
  // that says nothing hangs there. uRimMask keeps the term to the rails -
  // the long runs (|y| past the 36 mm inner wall) and the legs that hook in
  // at the short ends (|x| past 42.25 mm, |y| past the 18.4 mm leg tip), the
  // chamber footprint in LEG, in the plate's own coordinates. 0 for the
  // bores act, which wants the bore walls. Its own cache key ("rim-plate"):
  // the plate is drawn from the first frame, so warmUp's p = 0 render
  // compiles it. The two fragment strings below must stay verbatim with
  // addRim's, or the replace misses silently.
  MAT[0].userData.rimMask = { value: 0 };
  (function () {
    const base = MAT[0].onBeforeCompile;
    MAT[0].onBeforeCompile = function (shader) {
      base(shader);
      shader.uniforms.uRimMask = MAT[0].userData.rimMask;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vRimXY;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRimXY = position.xy;");
      shader.fragmentShader = shader.fragmentShader
        .replace("uniform float uRim, uRimPow;", "uniform float uRim, uRimPow;\nuniform float uRimMask;\nvarying vec2 vRimXY;")
        .replace("totalEmissiveRadiance += uRimColor * (pow(rimF, uRimPow) * uRim);",
                 "float rimRail = max(smoothstep(33.5, 35.5, abs(vRimXY.y)),\n" +
                 "                    smoothstep(41.0, 43.0, abs(vRimXY.x)) * smoothstep(15.5, 18.0, abs(vRimXY.y)));\n" +
                 "totalEmissiveRadiance += uRimColor * (pow(rimF, uRimPow) * uRim * mix(1.0, rimRail, uRimMask));");
    };
    MAT[0].customProgramCacheKey = function () { return "rim-plate"; };
  })();
  // The handles also carry a SWEEP: a band of the accent that runs up the
  // part from its slot at the instant it lets go, so the release reads as
  // travelling out of the plate and along the handle. The handle geometry is
  // baked in plate coordinates, so position.z IS height above the slab
  // (-3.2 to 29.7 mm). Its own cache key: every rim material shares "rim".
  MAT[1].userData.sweep = { value: 0 };
  MAT[1].userData.sweepZ = { value: -4 };
  // CHARGE: the whole handle glows the accent for the moment it lets go. It is
  // paired in frame() with a dip in the handle's own grey albedo: lilac added
  // on top of a light grey part only drives it toward white, so the purple
  // reads as purple by taking some grey away while the glow is on.
  MAT[1].userData.charge = { value: 0 };
  (function () {
    const base = MAT[1].onBeforeCompile;
    MAT[1].onBeforeCompile = function (shader) {
      base(shader);
      shader.uniforms.uSweep = MAT[1].userData.sweep;
      shader.uniforms.uSweepZ = MAT[1].userData.sweepZ;
      shader.uniforms.uCharge = MAT[1].userData.charge;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vHz;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHz = position.z;");
      shader.fragmentShader = shader.fragmentShader
        .replace("uniform float uRim, uRimPow;", "uniform float uRim, uRimPow;\nuniform float uSweep, uSweepZ, uCharge;\nvarying float vHz;")
        .replace("totalEmissiveRadiance += uRimColor * (pow(rimF, uRimPow) * uRim);",
                 "totalEmissiveRadiance += uRimColor * (pow(rimF, uRimPow) * uRim);\n" +
                 "float sb = (vHz - uSweepZ) / 3.2;\n" +
                 "totalEmissiveRadiance += uRimColor * (exp(-sb * sb) * uSweep * (0.30 + 0.9 * rimF * rimF)\n" +
                 "                                      + uCharge * (0.22 + 0.78 * rimF * rimF));");
    };
    MAT[1].customProgramCacheKey = function () { return "rim-sweep"; };
  })();
  // The holders' flange tops are flat rings seen ~27 deg off edge-on in the
  // front view (rimF ~0.55). At pow 4 that face still took 9% of the rim, and
  // on a dark brown albedo that small violet emissive swung the whole face
  // plum (median blue +26/255): a colour change, not a highlight. At pow 8 the
  // face takes under 1% (+6), while true silhouettes (cone walls, flange lip,
  // the outline of a falling holder) keep most of it, so the peak is raised
  // 0.40 -> 1.00 to keep the edge strong. Tried 6 and 7 (tops still mauve),
  // 9 and 10 (thinner edge, no visible gain on the faces).
  MAT[2].userData.rimPow.value = HOLDER_RIM_POW;
  // That held for SEATED holders only. A holder high in the frame shows its
  // flat flange top at a far more grazing angle (rimF 0.8-0.9), and pow 8
  // still turned 15-20% of each falling holder lavender. Faces pointing along
  // the holder's own axis (object z) now take no rim; the cone walls (~0.97)
  // and the flange lip and bore wall (1.0) keep the edge light.
  MAT[2].userData.rimFlat.value = 1;

  /* ---------- ground ---------- */
  // The floor was a 420 x 420 alpha-blended PBR plane carrying the PMREM
  // environment, an alphaMap and all six directional lights, over 37-100% of
  // the frame — measured at 1.12-1.62 ms, the largest single line item in most
  // acts. What it bought was a featureless haze that got BRIGHTER under the
  // part, so the one place that needed a shadow had a highlight instead.
  //
  // This draws more for less: a cove gradient, a brushed grain for the light to
  // travel across, one slow rake, and an analytic rounded-box contact shadow
  // that tracks the part's height. Unlit on purpose — it is a backdrop, not a
  // surface in the scene — and it carries its own dissolve at the rim so the
  // plane never shows an edge.
  const FLOOR_R = 620;
  const floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {
      uPool: { value: RQ.srgb(0x4b5563) },
      uEdge: { value: RQ.srgb(0x05070b) },
      uC:    { value: new THREE.Vector2(0, 0) },
      uR:    { value: new THREE.Vector2(58.75, 46.25) },
      uSoft: { value: 12.0 },
      uStr:  { value: 0.0 },
      uRake: { value: 0.0 },
      uFade: { value: 1.0 }
    },
    vertexShader: [
      "varying vec2 vP;",
      "void main() { vP = position.xy;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
    ].join("\n"),
    fragmentShader: [
      "varying vec2 vP;",
      "uniform vec3 uPool, uEdge;",
      "uniform vec2 uC, uR;",
      "uniform float uSoft, uStr, uRake, uFade;",
      "void main() {",
      "  float R = " + FLOOR_R.toFixed(1) + ";",
      "  float r = length(vP) / R;",
      "  float a = 1.0 - smoothstep(0.16, 0.98, r);",
      "  vec3 col = mix(uPool, uEdge, smoothstep(0.015, 0.62, r));",
      // one slow bar of light crossing the floor
      "  float rk = vP.x / R - uRake;",
      "  col *= 0.86 + 0.26 * exp(-rk * rk * 2.6);",
      // brushed grain, along x only, so the rake has something to travel over
      "  col *= 1.0 + 0.022 * sin(vP.y * 0.055 + sin(vP.x * 0.004) * 2.2);",
      // contact shadow: a rounded box the size of the part's footprint
      "  vec2 q = abs(vP - uC) - uR;",
      "  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);",
      "  float sh = 1.0 - smoothstep(-uSoft, uSoft * 1.7, d);",
      "  col *= 1.0 - 0.86 * uStr * sh;",
      "  a *= 1.0 - 0.30 * uStr * sh;",
      "  gl_FragColor = vec4(col, a * uFade);",
      "  #include <tonemapping_fragment>",
      "  #include <encodings_fragment>",
      "}"
    ].join("\n")
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1240, 1240, 1, 1), floorMat);
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = -4;
  scene.add(ground);

  /* ---------- the handles' release ---------- */
  // A shockwave that runs ACROSS THE PLATE'S TOP FACE from each handle slot,
  // not a screen-facing halo. The old pair of additive sprites were soft
  // radial blurs 94 mm wide drawn with depthTest off: they read as a smudge
  // over the handles, glowed over empty air past the plate's ends, and
  // bleached the handle to near-white. This is one quad the size of the plate
  // top, in model space, depth-tested (holders occlude it), with a hard
  // leading edge, a short trailing wake and a thinner echo ring, clipped to
  // the plate so it never hangs in air. One draw call, a few ALU ops a
  // fragment, visible only for the release and the re-seat.
  const shockMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, fog: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      uColor: { value: RQ.srgb(0xb69cff) },
      uR:     { value: 0 },   // leading-edge radius, mm
      uA:     { value: 0 },   // strength
      uW:     { value: 3.2 }, // wake length, mm
      uCore:  { value: 0 },   // flash at the slot itself
      uX:     { value: 52.58 },
      uRows:  { value: new THREE.Vector3() }   // bore rows A, B, C; set once BORES exists
    },
    vertexShader: [
      "varying vec2 vP;",
      "void main() { vP = position.xy;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
    ].join("\n"),
    fragmentShader: [
      "varying vec2 vP;",
      "uniform vec3 uColor;",
      "uniform float uR, uA, uW, uCore, uX;",
      "uniform vec3 uRows;",
      "float ring(float d, float R, float w) {",
      "  float front = 1.0 - smoothstep(R - 0.25, R + 0.35, d);",
      "  float wake = exp(-max(0.0, R - d) / w);",
      "  return front * wake;",
      "}",
      // distance to the nearest of the 13 bores, on their 21.59 mm stagger
      // (5 in the middle row, 4 half a pitch off in each outer row)
      "float boreD(vec2 p) {",
      "  float xb = clamp(floor(p.x / 21.59 + 0.5), -2.0, 2.0) * 21.59;",
      "  float xa = (clamp(floor(p.x / 21.59), -2.0, 1.0) + 0.5) * 21.59;",
      "  float db = length(vec2(p.x - xb, p.y - uRows.y));",
      "  float da = length(vec2(p.x - xa, min(abs(p.y - uRows.x), abs(p.y - uRows.z))));",
      "  return min(da, db);",
      "}",
      "void main() {",
      "  float dl = length(vP - vec2(-uX, 0.0)), dr = length(vP - vec2(uX, 0.0));",
      "  float d = min(dl, dr);",
      "  float v = ring(d, uR, uW) + 0.45 * ring(d, uR * 0.64, uW * 0.55);",
      "  v += uCore * exp(-d * d / 60.0);",
      // clipped to the top face, with a 2 mm feather at its edge
      "  vec2 q = abs(vP) - vec2(56.75, 44.25);",
      "  v *= 1.0 - smoothstep(-2.0, 0.0, max(q.x, q.y));",
      // and not across the bores: there is no face there, and the quad showed
      // as a pink disc hanging inside each holder's cup
      "  v *= smoothstep(5.5, 6.1, boreD(vP));",
      "  gl_FragColor = vec4(uColor * v * uA, 1.0);",
      "}"
    ].join("\n")
  });
  const shock = new THREE.Mesh(new THREE.PlaneGeometry(117.5, 92.5, 1, 1), shockMat);
  shock.position.set(0, 0, 3.175 + 0.05);   // PLATE_TOP, declared further down
  shock.renderOrder = 5;
  shock.visible = false;
  root.add(shock);

  /* ---------- dust in the light ---------- */
  // A studio shot has particulate in the beam; a render does not, and its
  // absence is a large part of why a matte grey part reads as a mesh floating
  // in a void. 600 additive motes in a volume around the part, drifting on the
  // live clock. They are OFF for the straight-down technical view — a diagram
  // does not want atmosphere — and off once the camera is at the water.
  const dustTex = (function () {
    const n = 64, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.35, "rgba(255,255,255,0.42)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, n, n);
    return new THREE.CanvasTexture(c);
  })();
  const dust = (function () {
    const N = 600, pos = new Float32Array(N * 3);
    // integer LCG: the textbook (s*9301+49297)%233280 on fractional state
    // collapses to a fixed point and every mote lands in the same place
    let sd = 0x9e3779b9 >>> 0;
    const rr = function () { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
    for (let i = 0; i < N; i++) {
      // clustered around the lit pool rather than spread to the frame edges:
      // uniformly scattered they read as a starfield, not as particulate
      const rad = Math.pow(rr(), 0.62);
      const th = rr() * 6.28318;
      pos[i * 3]     = Math.cos(th) * rad * 330;
      pos[i * 3 + 1] = -20 + Math.pow(rr(), 0.8) * 190;
      pos[i * 3 + 2] = Math.sin(th) * rad * 300;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 5.6, map: dustTex, color: RQ.srgb(0x9fb4cc),
      transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
      toneMapped: false, fog: false });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    pts.renderOrder = 2;
    scene.add(pts);
    return pts;
  })();

  /* ---------- the model ---------- */
  // Bore centres in model space, and the plate's own numbers, both measured
  // off the geometry rather than quoted (see tools/pack_hydroponics.py).
  const ROW_A = -23.549, ROW_B = 0.689, ROW_C = 23.549;
  const BORES = ([[-32.385, ROW_A], [-10.795, ROW_A], [10.795, ROW_A], [32.385, ROW_A]]
    .concat([[-43.180, ROW_B], [-21.590, ROW_B], [0, ROW_B], [21.590, ROW_B], [43.180, ROW_B]])
    .concat([[-32.385, ROW_C], [-10.795, ROW_C], [10.795, ROW_C], [32.385, ROW_C]]));
  shockMat.uniforms.uRows.value.set(ROW_A, ROW_B, ROW_C);
  const HOME = [32.385, ROW_A];
  const PLATE_TOP = 3.175;
  // the sealed void inside ONE long-side rail, measured off the STL
  const VOID_LEN = 113.80, VOID_W = 6.90, VOID_H = 20.32;
  const VOID_Y = 41.15, VOID_Z = -10.16;

  let plate = null, handles = [], holders = [], airBoxes = [];
  let ready = false;
  // The chambers FILL rather than fade up: a bright slice runs the length of
  // each rail as it lights, so the reader watches the void's own cross-section
  // travel through the part — the hooked leg, the long run, the far leg. The
  // geometry is untouched; this only decides how much of the measured volume
  // is lit yet. Behind the front the volume has its normal act-4 opacity,
  // ahead of it nothing. -57 / 114 are the chamber's x extent from
  // chamberShape(), not new numbers. SCAN is one shared uniform written once
  // per frame; the glow amount is a per-material uniform, not a literal,
  // because the fill and the edges share the "basic" shader and the same
  // onBeforeCompile source, so r128 may hand both one program. The envelope
  // makes the added term exactly zero at scan 0 and 1: the frames before the
  // scan and the whole hold after it are unchanged.
  // uAhead is what is left ahead of the front: nothing of the fill, a faint
  // ghost of the edges, so the measured bracket outline is already there and
  // the slice fills it.
  const SCAN = { value: 1.0 };
  function scanify(mat, glow, ahead) {
    const uGlow = { value: glow }, uAhead = { value: ahead };
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uScan = SCAN;
      shader.uniforms.uGlow = uGlow;
      shader.uniforms.uAhead = uAhead;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vScanX;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvScanX = position.x;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vScanX;\nuniform float uScan;\nuniform float uGlow;\nuniform float uAhead;")
        .replace("#include <tonemapping_fragment>",
          "float scS = (vScanX + 57.0) / 114.0 - (uScan * 1.3 - 0.15);\n" +
          "float scEnv = smoothstep(0.0, 0.08, uScan) * smoothstep(0.0, 0.08, 1.0 - uScan);\n" +
          "float scE = (0.65 * exp(-scS * scS * 2600.0) + 0.35 * exp(-scS * scS * 260.0)) * scEnv;\n" +
          "gl_FragColor.a = gl_FragColor.a * mix(uAhead, 1.0, 1.0 - smoothstep(-0.012, 0.012, scS)) + scE * uGlow;\n" +
          "gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.86, 0.80, 1.0), clamp(scE, 0.0, 1.0) * 0.70);\n" +
          "#include <tonemapping_fragment>");
    };
  }

  /* ---------- where each holder meets the plate ---------- */
  // Without this a seated flange sat on the face like a sticker, a falling
  // holder cast nothing to say how high it was, and nothing marked the moment
  // it seated. Thirteen quads on the top face, one per bore, one draw call.
  // While a holder falls its quad is the shadow it throws on its own bore:
  // wide and faint while it is high, tightening under it as it arrives. At
  // touchdown a thin accent ring runs out from the flange and is gone within
  // SEAT_RING of scroll; what stays is a soft contact lip round the 13.2 mm
  // flange for the rest of the story.
  // Depth-tested, so the holder bodies (which write depth, and draw first at
  // renderOrder 0) occlude it; FrontSide, so it cannot show from under the
  // plate in the turn or from underwater. Premultiplied: rgb adds the ring,
  // alpha darkens the plate.
  // Per-vertex phase (approach, ring) lives in seatK; it is written every frame
  // from p and re-uploaded only when a value actually changed, so the GPU copy
  // is always exactly the function of the current p, whichever way one scrubs.
  const SEAT_RING = 0.013;
  const seatK = new Float32Array(13 * 4 * 2).fill(-1);
  const seat = (function () {
    const pos = new Float32Array(13 * 4 * 3), cor = new Float32Array(13 * 4 * 2);
    const idx = [];
    const C = [-1, -1, 1, -1, 1, 1, -1, 1];
    BORES.forEach(function (b, i) {
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        pos[v * 3] = b[0]; pos[v * 3 + 1] = b[1]; pos[v * 3 + 2] = PLATE_TOP + 0.03;
        cor[v * 2] = C[k * 2]; cor[v * 2 + 1] = C[k * 2 + 1];
      }
      const o = i * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aC", new THREE.BufferAttribute(cor, 2));
    geo.setAttribute("aK", new THREE.BufferAttribute(seatK, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uRing: { value: RQ.srgb(0xa98bff) } },
      vertexShader: [
        "attribute vec2 aC; attribute vec2 aK;",
        "varying vec2 vC; varying vec2 vK;",
        "void main() {",
        // aK.x < 0: not falling yet, the quad collapses to nothing
        "  float live = step(0.0, aK.x);",
        // 14 mm while there is a wide shadow or a ring to draw, 9.5 once seated
        "  float R = live * mix(14.0, 9.5, step(0.999, aK.y));",
        "  vC = aC * R; vK = aK;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(vC, 0.0), 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uRing;",
        "varying vec2 vC; varying vec2 vK;",
        "void main() {",
        "  float r = length(vC);",
        "  float a = clamp(vK.x, 0.0, 1.0), c = vK.y;",
        "  float down = step(0.001, c);",
        // the falling holder's shadow on its bore
        "  float sr = mix(13.5, 8.6, a);",
        "  float sh = (0.08 + 0.34 * a * a) * (1.0 - smoothstep(sr * 0.45, sr, r));",
        // seated: a contact lip just outside the 13.2 mm flange
        "  float ao = 0.30 * down * (1.0 - smoothstep(6.4, 8.9, r));",
        "  float al = max(sh * (1.0 - down), ao);",
        // the touchdown ring, 6.9 mm out to 11.5 mm (inside half the 21.59 mm
        // pitch, so it never reaches a neighbour), thinning as it fades
        "  float rr = mix(6.9, 11.5, sqrt(c));",
        "  float w = mix(0.30, 0.70, c);",
        "  float ring = down * (1.0 - step(0.999, c)) * exp(-(r - rr) * (r - rr) / (w * w)) * pow(1.0 - c, 2.0) * 0.72;",
        "  gl_FragColor = vec4(uRing * ring, al);",
        "  #include <encodings_fragment>",
        "}"
      ].join("\n")
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1;
    m.frustumCulled = false;
    m.visible = false;
    root.add(m);
    return m;
  })();

  PackedModel.load("product/", function (d, t) {
    if (pctEl) pctEl.textContent = Math.round((d / t) * 100) + "%";
  }).then(function (m) {
    const inst = (m.manifest.instances || {})["Seed Holder"] || [[0, 0, 0]];
    m.groups.forEach(function (g) {
      const mat = MAT[g.mat] || MAT[0];
      // Every part is printed, the holders too: the same layer-line roughness.
      // The map only multiplies (x0.85-0.97; 0.76-0.87 on the holders), so the
      // brown stays matte. The 13 holders share one geometry, so this runs once.
      addPrintUVs(g.geometry); mat.roughnessMap = layerTex; mat.needsUpdate = true;
      if (g.part === "Seed Holder") {
        inst.forEach(function (d, i) {
          const mesh = new THREE.Mesh(g.geometry, mat);
          mesh.userData.rest = new THREE.Vector3(d[0], d[1], d[2]);
          mesh.userData.bore = BORES[i];
          mesh.position.copy(mesh.userData.rest);
          root.add(mesh); holders.push(mesh);
        });
      } else {
        const mesh = new THREE.Mesh(g.geometry, mat);
        root.add(mesh);
        if (g.part === "Floating Plate") plate = mesh; else handles.push(mesh);
      }
    });
    // Each handle gets its own pivot at its own centroid. The mesh geometry is
    // baked at the handle's place on the plate, so rotating the MESH turns it
    // about the plate centre — a 0.42 rad "tilt" swung it 22 mm up and 5 mm in
    // on top of the translation, which is why they flew off the part.
    handles = handles.map(function (h) {
      h.geometry.computeBoundingBox();
      const bb = h.geometry.boundingBox;
      const c = new THREE.Vector3(
        (bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);
      const piv = new THREE.Group();
      piv.position.copy(c);
      h.position.copy(c).negate();
      root.remove(h); piv.add(h); root.add(piv);
      piv.userData.dir = c.x > 0 ? 1 : -1;
      piv.userData.rest = c.clone();
      return piv;
    });

    /* The air chambers, act 4. These are NOT a reading aid — each box is the
       measured internal void of one of the two closed rails, so what the reader
       sees is the actual sealed volume.

       Ray-cast against the STL on a 0.1 mm grid: the plate has no structure
       under the middle at all, just the 3.175 mm slab. All of the float volume
       is in two box sections running the length of the two LONG sides. One
       void: x -56.9..56.9, y -44.6..-37.7, z -20.32..0, closed underneath by a
       1.7 mm skin. Mirrored at +y. 14,367 mm^3 each, 28.7 cm^3 the pair. */
    // The chamber is NOT a straight bar. Ray-cast on a 0.25 mm grid, each one is
    // a BRACKET: a run the full length of its long side, then a leg that hooks
    // inward at each short end and tapers as it goes — from x -42.25 at
    // y = -34 to x -50.25 at y = -18.4, where it stops short of the handle
    // pocket. The footprint below is those measured points; the whole shape is
    // extruded to the bar's 20.32 mm depth, which overstates the legs by
    // 0.75 mm and nothing else.
    const LEG = [[41.50, -37.50], [42.25, -34.00], [44.00, -30.00],
                 [46.00, -26.00], [48.00, -22.00], [50.25, -18.40]];
    function chamberShape(sy) {
      const sh = new THREE.Shape();
      sh.moveTo(-57.00, sy * 44.50);
      sh.lineTo( 57.00, sy * 44.50);
      sh.lineTo( 57.00, sy * 18.40);
      for (let i = LEG.length - 1; i >= 0; i--) sh.lineTo( LEG[i][0], sy * -LEG[i][1]);
      for (let i = 0; i < LEG.length; i++)      sh.lineTo(-LEG[i][0], sy * -LEG[i][1]);
      sh.lineTo(-57.00, sy * 18.40);
      sh.closePath();
      return sh;
    }
    [-1, 1].forEach(function (sy) {
      const geo = new THREE.ExtrudeGeometry(chamberShape(sy),
        { depth: VOID_H, bevelEnabled: false, curveSegments: 1 });
      geo.translate(0, 0, -VOID_H);      // extrudes +z from 0; the void is below
      const box = new THREE.Mesh(geo,
        new THREE.MeshBasicMaterial({
          color: RQ.srgb(0x9a7bff), transparent: true, opacity: 0,
          depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      box.position.set(0, 0, 0);
      // Drawn BEFORE the plate, which then blends over it and keeps writing
      // depth. The void sits inside the rail, so the shell really is in front
      // of it. Drawn after the plate, the volume needed the plate's depth write
      // switched off at a = 0.5, and it jumped from hidden to fully drawn in one
      // step (p 0.517 -> 0.518 in, 0.587 -> 0.588 out).
      box.renderOrder = -1;
      root.add(box);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(box.geometry, 8),
        new THREE.LineBasicMaterial({ color: RQ.srgb(0xc4aaff), transparent: true,
                                      opacity: 0, toneMapped: false }));
      edge.position.copy(box.position);
      edge.renderOrder = -1;
      root.add(edge); box.userData.edge = edge;
      scanify(box.material, 0.85, 0.0); scanify(edge.material, 1.00, 0.3);
      airBoxes.push(box);
    });

    buildWater(); buildGrowth();
    ready = true;
    measure();
    warmUp();
    if (loader) loader.classList.add("hide");
    onScroll(true); draw();
  }).catch(function (e) {
    if (loader) loader.textContent = "Could not load the model — " + e.message;
  });

  /* ---------- water ---------- */
  // A displaced plane, not a shader: r128 here has no post-processing stack and
  // the wave sum is cheap enough on the CPU at this density. The plate reads
  // its own bob and roll from the SAME wave function, so it rides the surface
  // it is actually sitting on rather than an animation that merely looks close.
  // The studio floor is at world y = 0 and the model's origin is the underside
  // of its top slab, so at rootY = 0 BOTH float rails — the entire lower half
  // of the part — sat below the floor plane and the near, opaque part of that
  // plane painted straight over them. A red-silhouette test made it plain: the
  // slab rendered flat red, the rails at about half that through the floor.
  // The part now stands clear of its own floor.
  const STUDIO_Y = 30;

  // Amplitudes cut to about 60% of what they were. The raft reads its own bob
  // and roll from this same sum, so calming the sea calms the boat with it —
  // peak surface displacement is now +/-2.3 mm against 13 mm of freeboard, and
  // the raft's roll about its 117 mm beam falls to roughly +/-1.6 degrees.
  // Every component is longer than the plate's 117.5 mm beam, because a raft
  // BRIDGES waves shorter than itself instead of following them — the old
  // 82 mm component was generating roll the real part could not have, since
  // waveAt() samples the surface as a point height. Lengthening also buys the
  // calm cheaply: slope = amp * 2*PI/len, so height on a long component costs
  // a third as much slope as height on a short one. Summed amplitude falls
  // 6.2 -> 4.13 mm (-33%) but summed slope 13.3 -> 7.7 deg (-42%), and slope
  // is what the specular cares about. Speeds are scaled with the wavelengths
  // so the sea does not read as a faster, smaller version of itself.
  const WAVE = [
    { amp: 2.30, len: 300, spd: 0.86, dir: [0.98, 0.20] },
    { amp: 1.25, len: 168, spd: 1.18, dir: [-0.42, 0.91] },
    { amp: 0.58, len: 92,  spd: 1.66, dir: [0.63, -0.78] },
  ];
  WAVE.forEach(function (w) { w.k = 6.28318 / w.len; });
  const WATER_Y = -140;           // world height of the still surface
  let water = null, waterFar = null, waterBase = null;
  const waterReveal = { value: 0 };   // 1 / reveal radius (mm); 0 = whole surface

  /* ---- the waterline ---- */
  // Without one the raft hovered: the submerged rail was lit exactly like the
  // dry rail and the surface blended the sky over it, so under the dark hull
  // sat a slab BRIGHTER than both the hull and the water (full-res, p 0.87:
  // dry rail 49,56,66 / submerged 64,80,93 / open water 44,58,69).
  //
  // The surface, once more, on the GPU. The part needs to know per pixel where
  // the waterline is (to wet what is below it), and the CPU sum only runs on
  // the 28 mm vertex grid. Generated from the SAME WAVE array and driven by the
  // same clock and energy, so the line on the rail is the line the raft rides.
  const WET_U = {
    uWet: { value: 0 }, uWT: { value: 0 }, uWE: { value: 0 }, uWY: { value: WATER_Y },
    uRaft: { value: new THREE.Vector3(0, -1e4, 0) },    // x, top-face height, z
    uRip: { value: 0 }                                  // touchdown ring, 0 -> 1 (water only)
  };
  /* ---- touchdown ---- */
  // The scroll position at which the rails' underside first meets the surface
  // on the drop. Analytic from the drop curve: hull bottom = rootY - 22.02 mm
  // crosses WATER_Y at p 0.8575-0.8585 over every clock phase (A6 measured the
  // plate's world Box3: -136.9 mm at 0.856, -142.9 at 0.859). Re-measure if
  // A.drop, STUDIO_Y, WATER_Y or the float height ever change.
  // Three things hang off this one instant, so cause comes before effect: the
  // swell starts here (it used to finish while the raft was still ~30 mm up),
  // the raft's sink-and-rebound starts here, and the ring leaves the hull here.
  const RIP_P = 0.8575;
  const RIP_LEN = 0.045;           // scroll over which the ring spreads and dies
  // The ring is mostly SLOPE, not light: it tilts the surface normal, so what
  // shows is the reflection bending over a crest (a dark trough and a lit
  // face), the way a real ripple reads at a grazing camera. A painted glow
  // (A6.5's first form, 0.03-0.05 linear added) read as a halo pasted on the
  // water. RIP_GLOW keeps a third of that light so the crest still registers
  // at 1x; RIP_ALPHA closes the surface a little on the crest.
  const RIP_SLOPE = 2.4, RIP_GLOW = 0.35, RIP_ALPHA = 0.15;
  // Two sin^2 lobes over RIP_P .. A.settle[1] (set once A exists): under by
  // SINK mm, back over by REBOUND mm, then it rides. Zero slope at every seam.
  const SINK = 3.4, REBOUND = 0.9;
  function sin2(x) { const v = Math.sin(Math.PI * x); return v * v; }
  // Measured hull, in root-local mm: the top face is PLATE_TOP above the
  // origin, the rails' skin closes 1.7 mm under the 20.32 mm void, and the
  // near face is the 46.25 mm half-beam. |x| 57.5, not 58.75, so the mirror
  // tucks inside the rounded ends instead of squaring them off.
  const HULL_DEPTH = PLATE_TOP + VOID_H + 1.7, HULL_HALF_Z = 46.25, HULL_HALF_X = 57.5;
  // The mirror: facet tilt gain on the reflected ray (2 = a true mirror), the
  // horizontal travel over which it fades (mm), and how far it darkens.
  const WL_TILT = 2.0, WL_FADE = [60, 220], WL_DARK = 0.55;
  function waveGLSL() {
    let s = "float wlWaveH(vec2 q) {\n  float h = 0.0;\n";
    WAVE.forEach(function (w) {
      s += "  h += " + w.amp.toFixed(4) + " * sin(dot(q, vec2(" + w.dir[0].toFixed(4) + ", " +
           w.dir[1].toFixed(4) + ")) * " + w.k.toFixed(7) + " - uWT * " + w.spd.toFixed(4) + ");\n";
    });
    return s + "  return h * uWE;\n}\n";
  }
  // Shared uniforms plus a world position and world normal varying. The part
  // materials also get the GPU wave; the water already has its own geometry.
  function wetUniforms(shader, withWave) {
    shader.uniforms.uWet = WET_U.uWet; shader.uniforms.uWT = WET_U.uWT;
    shader.uniforms.uWE = WET_U.uWE;   shader.uniforms.uWY = WET_U.uWY;
    shader.uniforms.uRaft = WET_U.uRaft;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWlW;\nvarying vec3 vWlN;")
      .replace("#include <project_vertex>",
               "#include <project_vertex>\nvWlW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n" +
               "vWlN = mat3(modelMatrix) * objectNormal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>",
               "#include <common>\nvarying vec3 vWlW;\nvarying vec3 vWlN;\n" +
               "uniform float uWet, uWT, uWE, uWY;\nuniform vec3 uRaft;\n" + (withWave ? waveGLSL() : ""));
  }
  // The printed part, below the line: seen through the surface it loses light
  // and turns teal, red first, a little more with depth; its specular goes (a
  // wetted matte skin under water has none to speak of); and the meniscus
  // leaves a hairline of sky along the contact. Kept gentle on purpose: the
  // rail is only ~9 mm under, and a stronger absorption (0.30/0.52/0.58 with
  // 3x the depth term) turned the rail near-black at the dive and from below.
  // Behind a uniform branch, so acts 1-5 pay one compare.
  // Spliced into addRim's single onBeforeCompile (plate, handles, holders).
  function submerge(shader) {
    wetUniforms(shader, true);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <aomap_fragment>",
               "#include <aomap_fragment>\n" +
               "if (uWet > 0.5) {\n" +
               "  float wlDep = uWY + wlWaveH(vWlW.xz) - vWlW.y;\n" +
               "  float wlSub = smoothstep(-0.15, 0.45, wlDep);\n" +
               "  vec3 wlAb = mix(vec3(1.0), vec3(0.60, 0.76, 0.80) * exp(-vec3(0.05, 0.02, 0.015) * max(wlDep, 0.0)), wlSub);\n" +
               "  reflectedLight.directDiffuse *= wlAb; reflectedLight.indirectDiffuse *= wlAb;\n" +
               "  reflectedLight.directSpecular *= 1.0 - 0.9 * wlSub;\n" +
               "  reflectedLight.indirectSpecular *= 1.0 - 0.8 * wlSub;\n" +
               "  totalEmissiveRadiance += vec3(0.042, 0.060, 0.070) * exp(-wlDep * wlDep / 0.06);\n" +
               "}");
  }
  function waveAt(x, z, t, energy) {
    let h = 0;
    for (let i = 0; i < WAVE.length; i++) {
      const w = WAVE[i];
      h += w.amp * energy * Math.sin((x * w.dir[0] + z * w.dir[1]) * w.k - t * w.spd);
    }
    return h;
  }
  // Height AND normal in one pass, from the wave derivatives. The normal was
  // coming from geometry.computeVertexNormals() every frame, which measured
  // 6.25 ms on its own at 130 segments — over a third of the frame budget for
  // something the wave function already knows analytically.
  function updateWater(t, energy) {
    const pos = water.geometry.getAttribute("position");
    const nrm = water.geometry.getAttribute("normal");
    const pa = pos.array, na = nrm.array;
    for (let i = 0; i < pa.length; i += 3) {
      const x = waterBase[i], z = waterBase[i + 2];
      let h = 0, dx = 0, dz = 0;
      for (let k = 0; k < WAVE.length; k++) {
        const w = WAVE[k];
        const ph = (x * w.dir[0] + z * w.dir[1]) * w.k - t * w.spd;
        const a = w.amp * energy;
        h += a * Math.sin(ph);
        const c = a * w.k * Math.cos(ph);
        dx += c * w.dir[0]; dz += c * w.dir[1];
      }
      pa[i + 1] = h;
      const inv = 1 / Math.sqrt(dx * dx + dz * dz + 1);
      na[i] = -dx * inv; na[i + 1] = inv; na[i + 2] = -dz * inv;
    }
    pos.needsUpdate = true; nrm.needsUpdate = true;
  }
  function buildWater() {
    const geo = new THREE.PlaneGeometry(2600, 2600, 92, 92);
    geo.rotateX(-Math.PI / 2);
    waterBase = geo.getAttribute("position").array.slice();
    // Standard, not Physical: clearcoat is a second BRDF lobe evaluated per
    // pixel over the largest surface in the shot, and on water that already has
    // a low roughness it changes almost nothing.
    // Clear solution, not black lacquer. At roughness 0.15 with envMapIntensity
    // 1.6 the key light put a small, hard, near-white specular on the surface
    // that read as a searchlight; spreading the lobe and cutting the sky
    // reflection removes it without flattening the surface.
    water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: RQ.srgb(0x27505f), metalness: 0.0, roughness: 0.34,
      transparent: true, opacity: 0, envMapIntensity: 0.55,
      side: THREE.DoubleSide }));
    // Clearer where the reader looks down into the reservoir, closing up only
    // towards the horizon: opacity follows Fresnel. Direct specular is trimmed
    // so the camera-following rimBack is not mirrored as a hot pool; the
    // environment still carries the wave texture. Both water meshes share this
    // material, so one hook covers the near grid and the far ring.
    //
    // The raft in the mirror. At the reservoir camera's few degrees a real
    // surface is mostly reflection, and directly in front of the raft what it
    // reflects is the raft's own dark side, not the sky. Analytic, no second
    // render: the view ray is mirrored and run to the hull's near face, and the
    // height it reaches there is tested against the top face. The wave normal
    // tilts that ray in HEIGHT only, so ripples break the reflection's lower
    // edge but never push it past the hull's ends. It darkens toward near-black
    // (it adds no light), fades with distance, and is off from below.
    water.material.onBeforeCompile = function (shader) {
      wetUniforms(shader, false);
      shader.uniforms.uRip = WET_U.uRip;
      shader.uniforms.uRevInv = waterReveal;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uRip;\nuniform float uRevInv;")
        // The touchdown ring, before the lights so it bends the reflection.
        // Distance from the hull's footprint (a box of the part's 58.75 x
        // 46.25 mm half-extents, so the crests follow the rails and round off
        // at the corners); a leading crest and a weaker trailing one, fading as
        // (1-u)^2 over RIP_LEN of scroll and easing in over the first 12% so
        // contact is not a step. wlRs is the profile's radial derivative; the
        // world-space tilt goes to view space through viewMatrix. Skipped
        // entirely outside the 0.045 of scroll after RIP_P.
        .replace("#include <normal_fragment_maps>",
          "#include <normal_fragment_maps>\n" +
          "float wlRip = 0.0;\n" +
          "if (uRip > 0.0 && uRip < 1.0) {\n" +
          "  vec2 wlRo = vWlW.xz - uRaft.xz;\n" +
          "  vec2 wlRq = abs(wlRo) - vec2(58.75, 46.25);\n" +
          "  vec2 wlRm = max(wlRq, 0.0);\n" +
          "  float wlRd = length(wlRm) + min(max(wlRq.x, wlRq.y), 0.0);\n" +
          "  float wlRr = 3.0 + 140.0 * uRip;\n" +
          "  float wlRa = (wlRd - wlRr) / 5.0, wlRb = (wlRd - 0.6 * wlRr) / 4.0;\n" +
          "  float wlGa = exp(-wlRa * wlRa), wlGb = 0.55 * exp(-wlRb * wlRb);\n" +
          "  float wlRf = step(0.0, wlRd) * (1.0 - uRip) * (1.0 - uRip) * smoothstep(0.0, 0.12, uRip);\n" +
          "  wlRip = (wlGa + wlGb) * wlRf;\n" +
          "  float wlRs = " + RIP_SLOPE.toFixed(2) + " * wlRf * (-0.4 * wlRa * wlGa - 0.5 * wlRb * wlGb);\n" +
          "  vec2 wlRg = sign(wlRo) * wlRm / max(length(wlRm), 1e-3);\n" +
          "  normal = normalize(normal - (viewMatrix * vec4(wlRg.x * wlRs, 0.0, wlRg.y * wlRs, 0.0)).xyz);\n" +
          "}")
        .replace("#include <aomap_fragment>",
          "#include <aomap_fragment>\n" +
          "reflectedLight.directSpecular *= 0.40;\n" +
          "float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 5.0);\n" +
          "diffuseColor.a *= mix(0.58, 1.0, fres);\n" +
          // Reveal front (horizon-band): the surface comes up from the raft outward;
          // uRevInv is 1/radius, so 0 is exactly no fade.
          "diffuseColor.a *= 1.0 - smoothstep(1.0, 2.2, length(vViewPosition) * uRevInv);\n" +
          "float wlHull = 0.0;\n" +
          "if (uWet > 0.5 && cameraPosition.y > vWlW.y + 0.5) {\n" +
          "  vec3 wlV = vWlW - cameraPosition;\n" +
          "  float wlHd = max(length(wlV.xz), 1e-3);\n" +
          "  vec2 wlD = wlV.xz / wlHd;\n" +
          "  vec3 wlN = normalize(vWlN);\n" +
          // rise per mm of horizontal travel: the view ray's fall, tilted by the facet
          "  float wlRise = -wlV.y / wlHd - " + WL_TILT.toFixed(2) + " * dot(wlD, wlN.xz);\n" +
          "  float wlT = (uRaft.z + " + HULL_HALF_Z.toFixed(2) + " - vWlW.z) / min(wlD.y, -1e-3);\n" +
          "  float wlX = abs(vWlW.x + wlD.x * wlT - uRaft.x);\n" +
          "  float wlY = vWlW.y + wlRise * wlT;\n" +
          "  float wlFe = 0.4 + 0.012 * wlT;\n" +
          "  wlHull = step(0.0, wlT)\n" +
          "    * (1.0 - smoothstep(" + HULL_HALF_X.toFixed(2) + " - wlFe, " + HULL_HALF_X.toFixed(2) + " + wlFe, wlX))\n" +
          "    * (1.0 - smoothstep(uRaft.y - wlFe, uRaft.y + wlFe, wlY))\n" +
          "    * smoothstep(uRaft.y - " + HULL_DEPTH.toFixed(2) + " - 1.0, uRaft.y - " + HULL_DEPTH.toFixed(2) + " + 1.0, wlY)\n" +
          "    * (1.0 - smoothstep(" + WL_FADE[0] + ".0, " + WL_FADE[1] + ".0, wlT)) * clamp(0.35 + fres, 0.0, 1.0);\n" +
          "}\n" +
          // the ring's crest closes the surface a touch (wlRip is 0 outside it)
          "diffuseColor.a = min(1.0, diffuseColor.a + " + RIP_ALPHA.toFixed(2) + " * wlRip);\n")
        .replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
          "gl_FragColor = vec4( mix(outgoingLight, vec3(0.006, 0.008, 0.011), " + WL_DARK.toFixed(2) + " * wlHull)" +
          " + " + RIP_GLOW.toFixed(2) + " * vec3(0.030, 0.044, 0.052) * wlRip, diffuseColor.a );");
    };
    water.material.customProgramCacheKey = function () { return "water"; };
    water.position.y = WATER_Y;
    water.visible = false;
    scene.add(water);
    // The displaced grid is only 2.6 m across, and at the water camera its FAR
    // EDGE — not the horizon — was the line across the frame, which put the
    // waterline near the middle however the frustum was offset. This ring
    // carries the surface out to a real horizon; it starts just inside the
    // square so there is no seam, and sits 0.8 mm lower so the corners where
    // the two overlap stay hidden behind the animated one.
    waterFar = new THREE.Mesh(new THREE.RingGeometry(1290, 42000, 96, 1), water.material);
    waterFar.rotation.x = -Math.PI / 2;
    waterFar.position.y = WATER_Y - 0.8;
    waterFar.renderOrder = -1;
    waterFar.visible = false;
    scene.add(waterFar);
  }

  /* ---------- under the surface ---------- */
  // The canvas is transparent, so once the camera went under there was no
  // water at all: the reservoir was the PAGE, and the last image of the story
  // read as a raft hanging in empty black. This is the water body itself — a
  // sphere around the camera, unlit, drawn behind everything and writing no
  // depth. Rays pointing below the horizon see the depth, which is EXACTLY what
  // the dive fog resolves fogged geometry to (fog is mixed after the output
  // encoding, so its colour is decoded here and re-encoded), so the roots and
  // the raft dissolve into it rather than against it. Rays pointing up see the
  // underside of the surface: lighter, with a slow caustic network overhead
  // and soft shafts falling from it. Everything is authored in display colour
  // (toneMapped false) so the palette is the page's, not ACES's. The volume
  // fades to transparent across the bottom of the frame, into the page's own
  // near-black, so the canvas edge never shows as the sticky stage releases.
  // Above the surface only the rays below the horizon get it, which gives the
  // crossing a clean analytic waterline.
  const under = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.BackSide,
    uniforms: {
      uDeep: { value: new THREE.Color() },                 // = the dive fog as displayed
      uBody: { value: RQ.srgb(0x071a28) },                 // just under the surface
      uCeil: { value: RQ.srgb(0x0e3148) },                 // the underside, overhead
      // the grow light above the tank, up and behind the raft from this camera
      uSun: { value: new THREE.Vector3(0, 0.77, -0.64).normalize() },
      uGlow: { value: 0.70 }, uCaus: { value: 0.22 }, uShaft: { value: 0.22 },
      uSub: { value: 0 }, uUp: { value: 0 }, uLit: { value: 0 }, uSurf: { value: WATER_Y }, uT: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      // 1 and 0 on the water body; the surface plane below sets its own
      uVeil: { value: 1 }, uVeilE: { value: 0 }, uFootK: { value: 1 }
    },
    vertexShader: [
      "varying vec3 vW;",
      "void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;",
      "  gl_Position = projectionMatrix * viewMatrix * w; }"
    ].join("\n"),
    fragmentShader: [
      "varying vec3 vW;",
      "uniform vec3 uDeep, uBody, uCeil, uSun;",
      "uniform float uGlow, uCaus, uShaft, uSub, uUp, uLit, uSurf, uT, uVeil, uVeilE, uFootK;",
      "uniform vec2 uRes;",
      "void main() {",
      "  vec3 d = normalize(vW - cameraPosition);",
      "  float e = d.y;",
      // everything once the camera is under; only below the horizon while above
      // The waterline is sharp from above; from below there is no waterline, so
      // the edge widens into a soft gradient as the sky side fills in, instead
      // of leaving a hard rule across the first frames under.
      "  float ew = 0.004 + 0.40 * uUp;",
      "  float m = 1.0 - (1.0 - uUp) * smoothstep(-ew, ew, e);",
      // depth: the body just under the horizon, falling to the fog colour below
      "  vec3 col = mix(uBody, uDeep, smoothstep(-0.02, 0.30, -e));",
      // the underside of the surface, hazed with the ray's distance to it
      "  float D = max(uSurf - cameraPosition.y, 0.0);",
      "  float up = smoothstep(0.0, 0.42, e) * uLit;",
      "  float rd = D / max(e, 0.03);",
      "  float att = exp(-rd * 0.0024);",
      "  col = mix(col, uCeil, up * (0.35 + 0.65 * att));",
      // the light pool: broad falloff around the light, a tighter core
      "  float g = max(dot(d, uSun), 0.0);",
      "  float g4 = g * g; g4 *= g4;",
      "  float g16 = g4 * g4; g16 *= g16;",
      "  float pool = uLit * (0.55 * g4 + 0.45 * g16);",
      "  col += uCeil * (uGlow * pool);",
      // caustics: two warped sine ridges on the underside, overhead only (at
      // grazing angles the pattern compresses into streaks)
      "  vec2 hp = cameraPosition.xz + d.xz * rd;",
      "  float wv = sin(hp.x * 0.019 + uT * 0.21) + sin(hp.y * 0.016 - uT * 0.17);",
      "  float c1 = 1.0 - abs(sin(hp.x * 0.083 + uT * 0.40 + 1.9 * wv));",
      "  float c2 = 1.0 - abs(sin(hp.y * 0.071 - uT * 0.33 + 1.7 * sin(hp.x * 0.037 - wv)));",
      "  c1 *= c1; c2 *= c2;",
      "  float caus = 0.5 * (c1 * c1 + c2 * c2);",
      "  col += uCeil * (uCaus * up * smoothstep(0.08, 0.40, e) * att * caus * (0.4 + g4));",
      // shafts: a fan of soft rays around the light's axis, drifting slowly,
      // strongest near the light and gone before the deep
      // azimuth about the light's axis (uSun is unit and has no x, so this
      // basis is (1,0,0) and (0, uSun.z, -uSun.y))
      "  float az = atan(d.x, d.y * uSun.z - d.z * uSun.y);",
      "  float s1 = 0.5 + 0.5 * sin(az * 26.0 + 1.5 * sin(az * 9.0 - uT * 0.07) + uT * 0.05);",
      "  float s2 = 0.5 + 0.5 * sin(az * 47.0 - 1.1 * sin(az * 13.0 + uT * 0.05) - uT * 0.04);",
      "  s1 *= s1; s1 *= s1; s2 *= s2; s2 *= s2;",
      // a slow swell across the fan, so the rays do not read as evenly spaced
      "  float sw = 0.55 + 0.45 * sin(az * 5.0 + 0.8 + uT * 0.03);",
      "  float sh = (0.65 * s1 + 0.35 * s2) * sw * smoothstep(0.35, 0.92, g) * uLit;",
      "  col += uCeil * (uShaft * sh);",
      "  float fy = gl_FragCoord.y / uRes.y;",
      // settles under the fixed topbar's scrim instead of meeting it as a band
      "  col *= 1.0 - 0.45 * smoothstep(0.72, 1.0, fy);",
      // uVeil: the surface plane's own opacity; uVeilE fades it toward the
      // horizon from below, where it would otherwise double the foot fade;
      // uFootK: how much of the canvas-foot fade applies (1 on the water body)
      "  gl_FragColor = vec4(col, uSub * m * mix(1.0, smoothstep(0.0, 0.36, fy), uFootK) * uVeil * mix(1.0, smoothstep(0.0, 0.10, e), uVeilE));",
      "  #include <encodings_fragment>",
      // one code value of noise: dark blue gradients band visibly at 8 bits
      "  gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;",
      "}"
    ].join("\n")
  }));
  under.renderOrder = -10;
  under.frustumCulled = false;
  under.visible = false;
  scene.add(under);
  // The surface itself, for the crossing and the shot below it. The water body
  // is a backdrop that writes no depth, so from p 0.958 nothing in the frame
  // said where the water was: the submerged hull and the roots hung in open
  // air in front of a distant horizon band, and underwater the raft had no
  // waterline and its handles stood in the water. This is a FLAT plane at the
  // still surface, with the SAME shader source and the SAME uniform objects as
  // the water body: one program (no new compile), and wherever nothing is
  // behind it, exactly the backdrop's colour. It veils what is on the far side
  // of it. Flat, so none of the displaced grid's rows at grazing incidence.
  // 0.35, not 0.50: at p 1.0 the hull above the waterline read blue-grey under
  // 0.50 (RGB 25,44,59 vs 35,40,46 before); 0.35 keeps it nearer the black
  // plate (28,43,56) and the handles brighter (37,60,77), still veiled.
  const VEIL_UNDER = 0.35;
  const surfUnder = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.BackSide,
    uniforms: Object.assign({}, under.material.uniforms, { uVeil: { value: 1 }, uVeilE: { value: 0 }, uFootK: { value: 1 } }),
    vertexShader: under.material.vertexShader, fragmentShader: under.material.fragmentShader
  }));
  surfUnder.frustumCulled = false;
  surfUnder.visible = false;
  scene.add(surfUnder);

  /* ---------- aeration ---------- */
  // Caption 06 says the roots grow into aerated water, and under the surface
  // the air is the one thing a reader expects to see moving. Air-stone plumes
  // and a haze of fine bubbles, as one Points draw whose height is computed ON
  // THE GPU from the live clock: no buffer rewrite, no accumulated state.
  // Placement is for the dive camera (z ~ +300, level with the hull bottom):
  // every bubble is BEHIND the raft's front face (z < +40), so none passes
  // between the lens and the hull, and the nearest is ~270 mm away, so none
  // swells into a soap bubble in the foreground. Two plumes rise beside the
  // raft, clear of the root mass, to the surface; one rises behind the roots
  // and stops under the hull; one passes behind the hull.
  const bubbles = (function () {
    // x, z, count, top (mm): the surface, or just under the hull bottom
    // (rootY - 24 mm, lowest with the swell and the roll at ~ -154)
    const SURF = WATER_Y - 2.5, HULL = WATER_Y - 20;
    const PLUMES = [[-100, -30, 80, SURF], [110, -58, 70, SURF],
                    [16, -30, 50, HULL], [-46, -84, 36, SURF]];
    const HAZE = 100;
    let N = HAZE;
    PLUMES.forEach(function (s) { N += s[2]; });
    const pos = new Float32Array(N * 3), sd = new Float32Array(N * 3);
    const r = rnd(9151);
    let i = 0;
    PLUMES.forEach(function (s) {
      for (let k = 0; k < s[2]; k++, i++) {
        // a plume widens a little as it rises; the spread is in the sway below
        pos[i * 3] = s[0] + (r() - 0.5) * 7;
        pos[i * 3 + 1] = 1.25 + r() * r() * 1.75;                 // diameter, mm: mostly small
        pos[i * 3 + 2] = s[1] + (r() - 0.5) * 7;
        sd[i * 3] = 56 + pos[i * 3 + 1] * 14 + r() * 14;           // rise, mm/s
        sd[i * 3 + 1] = r();                                       // phase
        sd[i * 3 + 2] = s[3];
      }
    });
    for (; i < N; i++) {
      let x = (r() - 0.5) * 520, z = -300 + r() * 250;
      if (r() < 0.25) { z = -50 + r() * 88; x = (x < 0 ? -1 : 1) * (78 + r() * 150); }
      pos[i * 3] = x; pos[i * 3 + 1] = 0.6 + r() * 0.5; pos[i * 3 + 2] = z;
      sd[i * 3] = 22 + r() * 22; sd[i * 3 + 1] = r();
      // behind or beside the hull footprint either way, so the surface is the top
      sd[i * 3 + 2] = SURF;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(sd, 3));
    const b = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, toneMapped: false,
      uniforms: {
        uT: { value: 0 }, uOp: { value: 0 }, uScale: { value: 800 }, uFog: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) }, uCol: { value: RQ.srgb(0xd6ecf3) }
      },
      vertexShader: [
        "attribute vec3 aSeed;",
        "uniform float uT, uScale;",
        // 150 mm of column: born below the frame foot, gone at the top
        "const float DEPTH = 150.0;",
        "varying float vA, vPx, vD, vLit;",
        "void main() {",
        "  float y = mod(aSeed.y * DEPTH + uT * aSeed.x, DEPTH);",
        "  float k = y / DEPTH;",
        // plume bubbles (>= 1.25 mm) against the fine haze (<= 1.1 mm)
        "  float big = step(1.2, position.y);",
        // bubbles over ~1.5 mm zig-zag as they rise; the plume opens with height
        "  float wob = (0.5 + 0.9 * k) * min(position.y, 1.6);",
        "  vec3 q = vec3(position.x + sin(uT * 3.1 + aSeed.y * 61.0) * wob + (fract(aSeed.y * 7.13) - 0.5) * 14.0 * k * big,",
        "                aSeed.z - DEPTH + y,",
        "                position.z + cos(uT * 2.6 + aSeed.y * 37.0) * wob * 0.8);",
        "  vec4 mv = modelViewMatrix * vec4(q, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        "  vD = -mv.z;",
        "  vPx = clamp(position.y * uScale / vD, 1.0, 40.0);",
        "  gl_PointSize = vPx;",
        "  vA = smoothstep(0.0, 0.18, k) * (1.0 - smoothstep(0.94, 1.0, k));",
        // lit from above: brighter as it nears the surface; the haze stays quiet
        // so it never reads as the page's starfield coming back
        "  vLit = (0.55 + 0.45 * k) * mix(0.55, 1.0, big);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uOp, uFog;",
        "uniform vec3 uCol;",
        "uniform vec2 uRes;",
        "varying float vA, vPx, vD, vLit;",
        "void main() {",
        "  vec2 q = gl_PointCoord * 2.0 - 1.0;",
        "  float r = length(q);",
        "  if (r > 1.0) discard;",
        // one device pixel in point units, for the edges
        "  float px = 2.0 / vPx;",
        "  float disc = 1.0 - smoothstep(1.0 - px, 1.0, r);",
        // a thin bright rim (total internal reflection at the edge), an almost
        // clear body, a highlight up-left and a faint caustic spot low-right
        "  float rim = smoothstep(0.62 - px, 0.90, r) * disc;",
        "  vec2 s = q - vec2(-0.32, -0.36);",
        "  float spec = exp(-dot(s, s) * 30.0);",
        "  vec2 s2 = q - vec2(0.26, 0.42);",
        "  float spot = exp(-dot(s2, s2) * 34.0);",
        "  float ring = 0.08 * disc + 0.78 * rim + 0.95 * spec + 0.25 * spot;",
        // under ~6 px a ring aliases into noise; there it is a soft dot instead
        "  float dot0 = (1.0 - smoothstep(0.0, 1.0, r)) * 0.60;",
        "  float shape = mix(dot0, ring, smoothstep(4.0, 9.0, vPx));",
        // the dive fog's own transmittance, so far bubbles fall into the haze,
        // and the canvas foot fade the water body uses, so they rise out of the dark
        // (at 0.65 of the fog's rate: a bright rim carries further than a
        // dark hull, and at full rate the nearest plume was already half gone)
        "  float fog = exp(-0.65 * uFog * uFog * vD * vD);",
        "  float fy = gl_FragCoord.y / uRes.y;",
        "  float a = shape * vA * vLit * fog * uOp * smoothstep(0.03, 0.34, fy);",
        "  gl_FragColor = vec4(uCol * (0.80 + 0.35 * spec), a);",
        "  #include <encodings_fragment>",
        "}"
      ].join("\n")
    }));
    // behind the roots (-2) and the surface (-1, 0), over the water body (-10)
    b.renderOrder = -3;
    b.frustumCulled = false;
    b.visible = false;
    scene.add(b);
    return b;
  })();

  /* ---------- shoots and roots ---------- */
  const shoots = [], roots = [];
  function rnd(seed) {
    let s = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  // Lettuce, not a houseplant. A DWC seedling a few weeks after transplant is a
  // loose rosette of six to nine SPOON-shaped leaves: a pale petiole widening
  // into a broad rounded blade with a pale midrib, cupped upward; the oldest
  // leaves are longest and bend outward under their own weight, the youngest
  // are short, upright and a lighter yellow-green, and two small oval seed
  // leaves still sit low at the base. The old heads were pointed dark-green
  // blades painted on two crossed cards — a tropical houseplant, and two
  // intersecting stickers whenever a card turned edge-on.
  //
  // The atlas holds four leaf shapes, one per cell. Colour and silhouette are
  // SEPARATE canvases: a canvas stores premultiplied alpha, so a colour map
  // with its own alpha uploads black under every transparent texel, and
  // filtering pulled that black into the edge of every leaf — the dark outline
  // round the old heads. Here the colour runs past the silhouette and the
  // alpha map alone cuts the shape.
  const LEAF_T = { value: 0 };
  function leafAtlas() {
    const N = 256, col = document.createElement("canvas"), msk = document.createElement("canvas");
    col.width = msk.width = N * 2; col.height = msk.height = N * 2;
    const g = col.getContext("2d"), m = msk.getContext("2d");
    const r = rnd(9001);
    m.fillStyle = "#000"; m.fillRect(0, 0, N * 2, N * 2);
    // blade half-width, petiole fraction, margin ruffle, tip roundness
    const KIND = [
      [0.45, 0.12, 0.012, 0.66],   // 0 butterhead: broad, round, smooth
      [0.38, 0.10, 0.050, 0.78],   // 1 loose-leaf: oblong, ruffled margin
      [0.32, 0.08, 0.012, 0.74],   // 2 young inner leaf: narrower, upright
      [0.40, 0.30, 0.000, 0.55],   // 3 seed leaf: small oval on a long stalk
    ];
    KIND.forEach(function (K, k) {
      const cx = (k % 2) * N, cy = (k >> 1) * N;
      const OX = cx + N * 0.5, BASE = cy + N * 0.985, LEN = N * 0.96;
      function half(t) {
        if (t < K[1]) return N * (0.018 + 0.020 * t / K[1]);
        const b = (t - K[1]) / (1 - K[1]);
        // exponent 0.5, not 0.72: a round spoon tip. Pointed tips read as spikes
        // wherever a cupped leaf turned edge-on to the camera
        let w = N * K[0] * Math.pow(Math.sin(Math.PI * Math.pow(b, K[3])), 0.50);
        w *= 1 + K[2] * (0.6 * Math.sin(b * 41 + k) + 0.4 * Math.sin(b * 23 + 2 * k)) * Math.min(1, b * 4);
        return Math.max(N * 0.018 * (1 - b), w);
      }
      m.fillStyle = "#fff";
      m.beginPath();
      for (let i = 0; i <= 48; i++) m.lineTo(OX - half(i / 48), BASE - LEN * i / 48);
      for (let i = 48; i >= 0; i--) m.lineTo(OX + half(i / 48), BASE - LEN * i / 48);
      m.closePath(); m.fill();
      g.save(); g.beginPath(); g.rect(cx, cy, N, N); g.clip();
      const gr = g.createLinearGradient(0, BASE, 0, BASE - LEN);
      gr.addColorStop(0.00, "rgb(162,188,124)");                // petiole, pale
      gr.addColorStop(K[1], "rgb(124,160,80)");
      gr.addColorStop(K[1] + 0.25, "rgb(84,128,52)");
      gr.addColorStop(1.00, "rgb(60,100,40)");
      g.fillStyle = gr; g.fillRect(cx, cy, N, N);
      // lighter along the midrib, deeper toward the margin
      const side = g.createLinearGradient(OX - N * 0.45, 0, OX + N * 0.45, 0);
      side.addColorStop(0.0, "rgba(22,50,18,0.36)"); side.addColorStop(0.5, "rgba(22,50,18,0)");
      side.addColorStop(1.0, "rgba(22,50,18,0.36)");
      g.fillStyle = side; g.fillRect(cx, cy, N, N);
      // a faint mottle of blistered tissue, so a blade is not a flat gradient
      for (let i = 0; i < 90; i++) {
        const t = K[1] + r() * (1 - K[1]), s = (r() - 0.5) * 1.8;
        const x = OX + s * half(t), y = BASE - LEN * t, rr = 6 + r() * 11;
        const bl = g.createRadialGradient(x, y, 0, x, y, rr);
        bl.addColorStop(0, r() < 0.5 ? "rgba(200,228,140,0.10)" : "rgba(18,44,14,0.12)");
        bl.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = bl; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      // midrib: wide and pale at the base, gone well before the tip (at full
      // strength to the tip it read as a painted stripe down every leaf)
      g.lineCap = "round";
      for (let i = 0; i < 20; i++) {
        const t0 = i / 20 * 0.78, f = 1 - i / 20;
        g.strokeStyle = "rgba(204,222,166," + (0.46 * f * f).toFixed(3) + ")";
        g.lineWidth = Math.max(0.8, N * 0.026 * (0.25 + 0.75 * f));
        g.beginPath(); g.moveTo(OX, BASE - LEN * t0); g.lineTo(OX, BASE - LEN * (t0 + 0.04)); g.stroke();
      }
      // laterals arching from the midrib out to the margin
      // (irregular spacing and reach: evenly spaced they read as a printed pattern)
      if (k !== 3) for (let i = 0; i < 7; i++) {
        const t = K[1] + (0.06 + i * 0.12 + (r() - 0.5) * 0.05) * (1 - K[1]);
        if (t > 0.90) break;
        g.lineWidth = 1.2 + r() * 0.6;
        for (let sg = -1; sg <= 1; sg += 2) {
          const w = half(Math.min(1, t + 0.10)) * (0.70 + r() * 0.24), rise = 0.09 + r() * 0.06;
          g.strokeStyle = "rgba(206,226,164," + (0.07 + r() * 0.07).toFixed(3) + ")";
          g.beginPath(); g.moveTo(OX, BASE - LEN * t);
          g.quadraticCurveTo(OX + sg * w * 0.45, BASE - LEN * (t + 0.03), OX + sg * w, BASE - LEN * (t + rise));
          g.stroke();
        }
      }
      g.restore();
    });
    const map = new THREE.CanvasTexture(col);
    map.encoding = THREE.sRGBEncoding;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const alpha = new THREE.CanvasTexture(msk);                 // a mask: stays linear
    alpha.anisotropy = map.anisotropy;
    return { map: map, alpha: alpha };
  }

  // One head as real geometry. Each leaf is a 7 x 8 vertex strip that rises
  // from the crown, arches over, cups across its width, twists a little along
  // its length and, for the ruffled kind, waves at the margin; it is mapped to
  // one atlas cell. A head is about 1k triangles and all its leaves share one
  // geometry, so it is one draw call, exactly like the two crossed cards it
  // replaces. Built at unit height: the plant's size is still its mesh scale.
  function plantGeometry(seed) {
    const r = rnd(seed * 2654 + 17);
    const P = [], UV = [], C = [], TIP = [], PH = [], I = [];
    const NU = 7, NV = 8;
    function leaf(cell, az, elev, droop, len, cup, tint, ruffle, twist) {
      const cu = (cell % 2) * 0.5, cv = 0.5 - (cell >> 1) * 0.5;   // canvas y runs down, v runs up
      const dx = Math.cos(az), dy = Math.sin(az);
      const o = P.length / 3, ph = r() * 6.28, wid = len * 0.98;
      let px = dx * 0.015, py = dy * 0.015, pz = 0;
      for (let j = 0; j < NV; j++) {
        const v = j / (NV - 1);
        const a = elev - droop * Math.pow(v, 1.6);                // angle above horizontal
        const ca = Math.cos(a), sa = Math.sin(a);
        // the blade's own frame: across (sx,sy,0) and up out of the blade (nx,ny,nz),
        // turned about the spine by the twist
        const tw = twist * v, ct = Math.cos(tw), st = Math.sin(tw);
        const ux = -sa * dx, uy = -sa * dy, uz = ca;
        const sx = -dy * ct + ux * st, sy = dx * ct + uy * st, sz = uz * st;
        const nx = ux * ct + dy * st, ny = uy * ct - dx * st, nz = uz * ct;
        const ao = 0.34 + 0.66 * Math.min(1, v * 1.8);             // the crown is in shade
        for (let i = 0; i < NU; i++) {
          const s = i / (NU - 1) * 2 - 1;
          const grow = Math.min(1, v * 3);
          let lift = cup * wid * 0.5 * s * s * grow;
          lift += ruffle * wid * 0.07 * Math.sin(v * 17 + ph + s * 2.3) * s * s * Math.min(1, v * 2);
          const w = s * wid * 0.5;
          P.push(px + sx * w + nx * lift, py + sy * w + ny * lift, pz + sz * w + nz * lift);
          UV.push(cu + (0.5 + 0.5 * s) * 0.5, cv + v * 0.5);
          C.push(tint[0] * ao, tint[1] * ao, tint[2] * ao);
          TIP.push(v * v * len); PH.push(ph);
        }
        const aa = elev - droop * Math.pow((j + 0.5) / (NV - 1), 1.6), stp = len / (NV - 1);
        px += Math.cos(aa) * dx * stp; py += Math.cos(aa) * dy * stp; pz += Math.sin(aa) * stp;
      }
      for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) {
        const q = o + j * NU + i;
        I.push(q, q + 1, q + NU, q + 1, q + NU + 1, q + NU);
      }
    }
    // hue: where this head sits between a cool blue-green butterhead and a warm
    // yellow-green one, so a raft is not thirteen copies of one colour
    const variety = r() < 0.75 ? 0 : 1, hue = r(), coty = r() * 6.28;
    leaf(3, coty, 0.30 + r() * 0.15, 0.30, 0.22, 0.25, [1.02, 0.98, 0.60], 0, 0);
    leaf(3, coty + Math.PI, 0.30 + r() * 0.15, 0.30, 0.21, 0.25, [1.02, 0.98, 0.60], 0, 0);
    const n = 6 + Math.floor(r() * 3);
    let az = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const age = 1 - i / (n - 1);                                // 1 = oldest, outermost
      az += 2.39996 + (r() - 0.5) * 0.3;                          // golden angle
      // outer leaves deeper and darker, inner ones brighter; each leaf jittered
      const k = 0.66 + 0.38 * (1 - age) + (r() - 0.5) * 0.14;
      const warm = 0.55 * (1 - age) + 0.40 * hue - 0.12;          // young leaves yellower
      const kind = i >= n - 2 ? 2 : variety;
      // An open rosette, not a vase: the oldest leaves leave the crown low and
      // arch out past horizontal, and only the young ones stand up in the middle.
      leaf(kind, az,
           1.36 - 0.70 * age + (r() - 0.5) * 0.14,                // elevation
           0.12 + 0.95 * age * age,                               // droop
           (0.44 + 0.36 * age) * (0.90 + r() * 0.20),             // length
           0.36 + 0.26 * r(),                                     // cup
           [k * (0.90 + 0.16 * warm), k, k * (0.98 - 0.26 * warm)],
           kind === 1 ? 1 : 0.35,                                 // margin ruffle
           (r() - 0.5) * 0.5 * age);                              // twist
    }
    let top = 0;
    for (let i = 2; i < P.length; i += 3) top = Math.max(top, P[i]);
    for (let i = 0; i < P.length; i++) P[i] /= top;
    for (let i = 0; i < TIP.length; i++) TIP[i] /= top;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute("aTip", new THREE.Float32BufferAttribute(TIP, 1));
    geo.setAttribute("aPh", new THREE.Float32BufferAttribute(PH, 1));
    geo.setIndex(I);
    geo.computeVertexNormals();                                   // once, at build
    return geo;
  }
  // Two cheap additions to the stock shader. A leaf is thin: lit from behind it
  // glows yellow-green, and without that a back-lit head reads as dark card.
  // For every directional light, whatever reaches the FAR side of the blade is
  // passed through, filtered by the leaf's own colour (not material.transmission,
  // which renders the scene twice). And each leaf tip flutters on the live
  // clock, weighted by distance from the crown, which a whole-plant tilt could
  // not do.
  //
  // It stays in the TRANSPARENT queue at opacity 1, as the cards were. The
  // water surface is transparent too and writes depth, and drawing the canopy
  // after it is what keeps the shoots hidden from under the surface in the dive
  // (every ray from there to the canopy is past the critical angle). Opaque, the
  // leaves would be drawn first and show through the surface from below.
  function leafMaterial(atlas) {
    const mat = new THREE.MeshStandardMaterial({
      map: atlas.map, alphaMap: atlas.alpha, alphaTest: 0.5, vertexColors: true,
      transparent: true, opacity: 1, alphaToCoverage: true,
      side: THREE.DoubleSide, metalness: 0, roughness: 0.52, envMapIntensity: 0.45 });
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = LEAF_T;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>",
                 "#include <common>\nattribute float aTip;\nattribute float aPh;\nuniform float uTime;\nvarying float vLeafH;")
        .replace("#include <begin_vertex>",
                 "#include <begin_vertex>\nvLeafH = position.z;\n" +
                 "transformed += aTip * vec3(0.016 * sin(uTime * 1.9 + aPh), " +
                 "0.014 * sin(uTime * 1.5 + aPh * 1.7), 0.010 * sin(uTime * 2.3 + aPh * 0.6));");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vLeafH;")
        .replace("#include <lights_fragment_end>",
                 "#include <lights_fragment_end>\n" +
                 "float leafAO = mix(0.55, 1.0, smoothstep(0.02, 0.80, vLeafH));\n" +
                 "reflectedLight.directDiffuse *= leafAO; reflectedLight.indirectDiffuse *= leafAO;\n" +
                 "reflectedLight.indirectSpecular *= leafAO;\n" +
                 "#if NUM_DIR_LIGHTS > 0\n" +
                 "vec3 leafTr = vec3(0.0);\n" +
                 "for (int i = 0; i < NUM_DIR_LIGHTS; i++) leafTr += directionalLights[i].color *" +
                 " max(0.0, -dot(geometry.normal, directionalLights[i].direction));\n" +
                 "reflectedLight.directDiffuse += leafTr * diffuseColor.rgb * vec3(0.75, 1.0, 0.45) * 0.32;\n" +
                 "#endif");
    };
    mat.customProgramCacheKey = function () { return "leaf"; };
    return mat;
  }

  // A root system, not a painted curtain. Healthy DWC roots are cream ropes
  // about a millimetre thick that leave the basket as a dense tangle, flare
  // out, then hang; each is furred with laterals and root hairs, the ropes fray
  // apart toward their tips, and aerated water keeps the mass drifting. The old
  // strand cards were straight parallel strokes on flat quads: a hair curtain,
  // and a comb wherever two overlapped.
  //
  // Each strand is a camera-facing ribbon along its own 3D curve. The fur is a
  // small painted tile — a bright core with hairs raking off it — used as an
  // ALPHA map, so the colour comes from rgba vertex colours and there is no
  // premultiplied-black fringe. A plant's strands share one geometry: 13 draw
  // calls, as before. Growth is a front moving down each strand by ARC LENGTH
  // in the vertex shader (one uniform per plant), with the tip tapering at the
  // front, so a root extends rather than being uncovered by a horizontal wipe.
  const ROOT_T = { value: 0 }, ROOT_L = { value: 1 };
  // The water column. From above the surface (ROOT_SEEN, 1 through the hold,
  // 0 at the plane) a strand is absorbed by the depth of water over it; from
  // under it (ROOT_X) by its distance behind the raft, measured from the
  // raft's own distance so it is the same at every viewport pull-back (fog
  // is off on the roots for that reason). Both sink toward ROOT_DEEP, the
  // dive fog as displayed.
  const ROOT_SEEN = { value: 0 }, ROOT_X = { value: 0 }, ROOT_REF = { value: 300 },
        ROOT_DEEP = { value: new THREE.Color() };
  // x: 1 / drawing-buffer height; y: how much of the canvas-foot fade applies
  const ROOT_FOOT = { value: new THREE.Vector2(1, 0) };
  const ROOT_CREAM = RQ.srgb(0xdcd5bd), ROOT_DUN = RQ.srgb(0x8c8a7a), ROOT_TIP = RQ.srgb(0x3e4c4e);
  function rootFurTex() {
    const W = 32, H = 128, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const r = rnd(515);
    g.lineCap = "round";
    for (let i = 0; i < 70; i++) {                        // hairs, wrapped so the tile repeats
      const y = r() * H, sg = r() < 0.5 ? -1 : 1, L = 4 + r() * 10, a = 0.35 + r() * 0.7;
      const v = (70 + r() * 110) | 0;
      g.strokeStyle = "rgb(" + v + "," + v + "," + v + ")";
      g.lineWidth = 0.6 + r() * 0.5;
      for (let o = -H; o <= H; o += H) {
        g.beginPath(); g.moveTo(W / 2 + sg * 1.0, y + o);
        g.quadraticCurveTo(W / 2 + sg * L * 0.6, y + o + L * a * 0.3,
                           W / 2 + sg * L * Math.cos(a * 0.6), y + o + L * Math.sin(a));
        g.stroke();
      }
    }
    const core = g.createLinearGradient(0, 0, W, 0);        // the root itself
    core.addColorStop(0.00, "rgba(255,255,255,0)");
    core.addColorStop(0.38, "rgba(255,255,255,0.08)");
    core.addColorStop(0.46, "rgba(255,255,255,0.95)");
    core.addColorStop(0.54, "rgba(255,255,255,0.95)");
    core.addColorStop(0.62, "rgba(255,255,255,0.08)");
    core.addColorStop(1.00, "rgba(255,255,255,0)");
    g.globalCompositeOperation = "lighter";
    g.fillStyle = core; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    const t = new THREE.CanvasTexture(c);                   // a mask: stays linear
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // depth: longest strand (mm). spread scales the flare; lean biases the drift.
  function rootGeometry(seed, depth, spread, lean) {
    const r = rnd(seed * 811 + 5);
    const P = [], SD = [], UV = [], C = [], TG = [], PH = [], I = [];
    let gMax = 1;
    // pts: centre line (x, y, z; z down is negative). g0: arc length (mm) at
    // which this strand starts, so a lateral only appears once its parent has
    // grown past it. Returns the arc length at every point.
    function ribbon(pts, g0, w0, w1, a0, a1, bright, vs) {
      const n = pts.length / 3, o = P.length / 3, ph = r() * 6.28, G = [];
      let arc = 0;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(n - 1, i + 1) * 3;
        const tx = pts[i1] - pts[i0], tz = pts[i1 + 2] - pts[i0 + 2];
        const tl = Math.hypot(tx, tz);
        // across the strand, in the picture plane (model x/z faces the camera)
        const sx = tl > 1e-4 ? -tz / tl : 1, sz = tl > 1e-4 ? tx / tl : 0;
        const x = pts[j], y = pts[j + 1], z = pts[j + 2];
        if (i) arc += Math.hypot(x - pts[j - 3], y - pts[j - 2], z - pts[j - 1]);
        const u = i / (n - 1), hw = (w0 + (w1 - w0) * u) * 0.5;
        const gg = g0 + arc; G.push(gg); if (gg > gMax) gMax = gg;
        const d = Math.min(1, Math.max(0, -z / depth));
        // cream at the basket, dun, then a cool dark tip where the light runs out
        const A = d < 0.45 ? ROOT_CREAM : ROOT_DUN, B = d < 0.45 ? ROOT_DUN : ROOT_TIP;
        const f = d < 0.45 ? d / 0.45 : (d - 0.45) / 0.55;
        // The first 20 mm sit in the raft's shadow, and are thinned: the dive
        // looks UP under the slab, which stacks all three rows of crowns into
        // one narrow band — at full alpha it read as a lit bar under the raft.
        const sh = Math.min(1, Math.max(0, -z / 20));
        const k = bright * (0.62 + 0.38 * sh) * (1.06 - 0.12 * Math.max(-1, Math.min(1, y / 14)));
        const al = (a0 + (a1 - a0) * u) * (0.22 + 0.78 * sh * sh);
        const cr = (A.r + (B.r - A.r) * f) * k, cg = (A.g + (B.g - A.g) * f) * k, cb = (A.b + (B.b - A.b) * f) * k;
        for (let s = -1; s <= 1; s += 2) {
          P.push(x, y, z); SD.push(sx * hw * s, sz * hw * s);
          UV.push(s < 0 ? 0 : 1, arc / vs);
          C.push(cr, cg, cb, al);
          TG.push(d, gg); PH.push(ph);
        }
      }
      for (let i = 0; i < n - 1; i++) { const q = o + i * 2; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      return G;
    }
    const nB = 5 + Math.floor(r() * 3);
    for (let b = 0; b < nB; b++) {
      const a0 = r() * 6.2832, rad = 1.2 + r() * 3.4;
      const bx = Math.cos(a0) * rad, by = Math.sin(a0) * rad;
      const flare = (3 + r() * 8) * spread, fa = a0 + (r() - 0.5) * 0.8;
      const fdx = Math.cos(fa), fdy = Math.sin(fa);
      const L = depth * (0.62 + r() * 0.38);
      const wA = r() * 6.28, wB = r() * 6.28, kA = 0.045 + r() * 0.03, kB = 0.11 + r() * 0.06;
      const ampA = 1.5 + r() * 3.0, ampB = 0.5 + r() * 0.7, drift = (r() - 0.5) * 0.06 + lean * 0.05;
      const nS = 8 + Math.floor(r() * 5);
      for (let s = 0; s < nS; s++) {
        const phi0 = r() * 6.28, twist = (r() - 0.5) * 3, fray = 0.6 + r() * 2.2;
        const Ls = L * (s === 0 ? 1 : 0.45 + r() * 0.55);
        const pts = [], SEG = 16;
        // a random walk on top of the smooth wander: roots kink where they
        // meet each other and the flow, they do not wave like combed hair
        let kx = 0, ky = 0;
        for (let i = 0; i <= SEG; i++) {
          if (i > 1) { kx += (r() - 0.5) * 1.6; ky += (r() - 0.5) * 1.2; }
          const d = Ls * i / SEG, u = d / L;
          const fl = flare * (1 - Math.exp(-d / 11));
          const phi = phi0 + twist * u, rho = fray * (0.3 + 2.4 * u * u);   // ropes fray toward the tip
          pts.push(bx + fdx * fl + drift * d + ampA * Math.sin(d * kA + wA) * u +
                     ampB * Math.sin(d * kB + wB) * Math.min(1, d / 6) + Math.cos(phi) * rho + kx,
                   by + fdy * fl * 0.8 + ampA * 0.6 * Math.cos(d * kA * 0.8 + wB) * u + Math.sin(phi) * rho + ky,
                   -d);
        }
        const bright = 0.78 + r() * 0.32;
        const G = ribbon(pts, r() * 4, s === 0 ? 2.2 : 1.3 + r() * 0.5, 0.55,
                         s === 0 ? 0.75 : 0.55, 0.16, bright, 9);
        // Laterals are what separate a root from a hair: short, fine, leaving
        // at a wide angle and bending down, crowded toward the top of each
        // strand where it is oldest. They are what makes the mass read fuzzy
        // rather than silky.
        const nL = 2 + Math.floor(r() * 4);
        for (let l = 0; l < nL; l++) {
          const kq = 1 + Math.floor(Math.pow(r(), 1.5) * (SEG - 4)), kk = kq * 3;
          const la = r() * 6.28, ll = 3 + r() * 10, lp = [];
          for (let i = 0; i <= 6; i++) {
            const q = i / 6;
            lp.push(pts[kk] + Math.cos(la) * ll * q * (1 - 0.30 * q),
                    pts[kk + 1] + Math.sin(la) * ll * q * 0.8,
                    pts[kk + 2] - ll * (0.10 * q + 0.60 * q * q));
          }
          ribbon(lp, G[kq], 0.75, 0.28, 0.40, 0.08, bright * 0.95, 9);
        }
      }
    }
    // growth order: arc length over the plant's longest path, 0..1
    for (let i = 1; i < TG.length; i += 2) TG[i] /= gMax;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute("aSide", new THREE.Float32BufferAttribute(SD, 2));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(C, 4));   // rgba: vertexAlphas
    geo.setAttribute("aTG", new THREE.Float32BufferAttribute(TG, 2));
    geo.setAttribute("aPh", new THREE.Float32BufferAttribute(PH, 1));
    geo.setIndex(I);
    return geo;
  }
  function rootMaterial(fur, grow) {
    const mat = new THREE.MeshBasicMaterial({
      alphaMap: fur, vertexColors: true, transparent: true, depthWrite: false,
      // fog off, as the old cards had it: a portrait phone pulls the camera
      // back 3.5x, and at that distance the dive fog swallowed the roots whole
      side: THREE.DoubleSide, fog: false });
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = ROOT_T; sh.uniforms.uGrow = grow; sh.uniforms.uLum = ROOT_L;
      sh.uniforms.uSeen = ROOT_SEEN; sh.uniforms.uExt = ROOT_X; sh.uniforms.uRef = ROOT_REF;
      sh.uniforms.uDeepC = ROOT_DEEP; sh.uniforms.uFoot = ROOT_FOOT;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 aSide;\nattribute vec2 aTG;\n" +
                 "attribute float aPh;\nuniform float uTime;\nuniform float uGrow;\nvarying float vGrow;\n" +
                 "uniform float uExt, uRef;\nvarying float vRy;\nvarying float vExt;")
        .replace("#include <project_vertex>",
                 "#include <project_vertex>\n" +
                 "vRy = (modelMatrix * vec4(transformed, 1.0)).y;\n" +
                 "vExt = uExt * (1.0 - exp(-max(0.0, -mvPosition.z - uRef + 20.0) * 0.034));")
        .replace("#include <begin_vertex>",
                 "#include <begin_vertex>\n" +
                 // the tip narrows over the last ~10 mm behind the growth front
                 "float gk = 1.0 - smoothstep(uGrow - 0.08, uGrow, aTG.y);\n" +
                 "transformed.xz += aSide * (0.2 + 0.8 * gk);\n" +
                 "vGrow = 1.0 - smoothstep(uGrow - 0.015, uGrow, aTG.y);\n" +
                 "transformed.x += aTG.x * aTG.x * 2.4 * sin(uTime * 0.50 + aPh + aTG.x * 2.2);\n" +
                 "transformed.y += aTG.x * aTG.x * 1.8 * sin(uTime * 0.37 + aPh * 1.6);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vGrow;\nuniform float uLum;\n" +
                 "varying float vRy;\nvarying float vExt;\nuniform float uSeen;\nuniform vec3 uDeepC;\nuniform vec2 uFoot;")
        .replace("#include <alphamap_fragment>",
                 "#include <alphamap_fragment>\n" +
                 // above: Beer-Lambert over the depth under the surface (55% at 20 mm, 9% at 80 mm)
                 "float rAtt = mix(1.0, exp(-0.030 * max(" + WATER_Y.toFixed(1) + " - vRy, 0.0)), uSeen);\n" +
                 // below: the back bundles sink into the water, the front ones stay cream
                 // into the dark at the canvas foot with the water body and the bubbles (dive only)
                 "diffuseColor.a *= vGrow * rAtt * (1.0 - 0.55 * vExt) * mix(1.0, smoothstep(0.0, 0.26, gl_FragCoord.y * uFoot.x), uFoot.y);\n" +
                 "diffuseColor.rgb = mix(uDeepC, diffuseColor.rgb * uLum, rAtt);\n" +
                 "diffuseColor.rgb = mix(diffuseColor.rgb, uDeepC, 0.85 * vExt);");
    };
    mat.customProgramCacheKey = function () { return "root"; };
    return mat;
  }

  function buildGrowth() {
    const fur = rootFurTex();
    // one atlas and one material for all thirteen heads: one program, 13 draws
    const leafMat = leafMaterial(leafAtlas());
    const r = rnd(4242);
    BORES.forEach(function (b, i) {
      // This draw was the old cards' per-head tint. The shoots' growth timing
      // (t0) depends on stream position, so it is still drawn.
      r();
      const sp = new THREE.Mesh(plantGeometry(i + 1), leafMat);
      // 16-25 mm tall: the leaves now fill the height they are given, where the
      // painted blades filled about two thirds of a 31-57 mm card
      sp.userData = { h: 16 + r() * 9, sway: 0.45 + r() * 0.5, ph: r() * 6.28,
                      w: 0.70 + r() * 0.18, base: r() * 6.28, t0: r() };
      sp.position.set(b[0], b[1], PLATE_TOP + 0.6);
      sp.renderOrder = 3;
      sp.scale.set(0.01, 0.01, 0.01);
      sp.visible = false;
      root.add(sp); shoots.push(sp);

      // FOUR draws per root, in the old order (length, width, yaw, start), so
      // every later shoot keeps its stream position and root timing t0 is
      // exactly what it was.
      const rh = r(), rw = r(), rb = r(), t0 = r();
      const grow = { value: 0 };
      const rt = new THREE.Mesh(rootGeometry(i + 1, 92 + rh * 46, 0.8 + rw * 0.4, rb - 0.5),
                                rootMaterial(fur, grow));
      rt.userData = { grow: grow, t0: t0 };
      rt.position.set(b[0], b[1], -7.6);
      // -2, ahead of waterFar (-1) and water (0). Transparent objects sort by
      // renderOrder ascending, so a root has to be drawn BEFORE the surface for
      // the surface to blend over it; drawn after, it paints on top and reads
      // as floating in front of the water instead of under it.
      rt.renderOrder = -2;
      rt.visible = false;
      root.add(rt); roots.push(rt);
    });
  }

  /* ---------- the schedule ---------- */
  // Every act is a scroll window. Overlaps are deliberate: a label fades out
  // while the next thing is already arriving, which is what stops the piece
  // reading as a slide deck.
  const A = {
    title:   [0.000, 0.070],
    toTop:   [0.065, 0.175],
    marks:   [0.156, 0.256],
    // The camera move from the top view to the front used to end 0.068 of
    // scroll before anything happened in it — a stretch with no caption, no
    // event and an awkward three-quarter framing. The fall now starts as the
    // camera arrives: the first holder is in frame at 0.300, the last seats at
    // 0.3856 (see FALL_RANK).
    toFront: [0.244, 0.312],
    fall:    [0.300, 0.390],
    // The hold is at 122 degrees, so 34% of the turn happens before it and 66%
    // after. The windows are sized in the same ratio, or the return reads as a
    // snap: at the old [0.500,0.646] the second half turned 2.2x faster than
    // the first.
    // The turn's two halves are deliberately NOT rate-matched any more: 122 deg
    // in 0.062 of scroll before the hold, 238 deg in 0.060 after it. The return
    // is meant to snap.
    tumble:  [0.462, 0.640],
    airHold: [0.524, 0.580],
    // The handles act now runs up to the studio exit. It used to end at 0.742,
    // followed by 0.058 of scroll (376 px at 810 tall) with no caption and a
    // model that barely moved until the floor gave way at 0.780. The fully out
    // pose (handles framing the type) now holds while the caption is read; the
    // type leaves first, then the handles seat, finishing just as the studio
    // hands over to the water.
    hOut:    [0.654, 0.700],
    hBack:   [0.746, 0.778],
    drop:    [0.800, 0.868],
    settle:  [0.856, 0.912],
    grow:    [0.878, 0.950],
  };
  function ramp(t, a, b) { const u = Math.min(1, Math.max(0, (t - a) / Math.max(1e-6, b - a))); return u * u * (3 - 2 * u); }

  // The holders' run. Ranked across the 4-5-4 stagger, left to right, and front
  // before back where a column has two; one FALL_BEAT apart, each fall FALL_DUR
  // of scroll with touchdown at FALL_LAND of it. Indexed by instance (rows A,
  // B, C in the manifest's order). The last one seats at 0.300 + 12 * 0.0048 +
  // 0.028 = 0.3856, and never more than five are falling at once.
  const FALL_RANK = [1, 4, 7, 10, 0, 3, 6, 9, 12, 2, 5, 8, 11];
  const FALL_BEAT = 0.0048, FALL_DUR = 0.028, FALL_LAND = 0.80;
  const FALL_NDC = 1.06;                        // where each one starts: just above the frame
  const _hM = new THREE.Matrix4(), _hC = new THREE.Vector4(), _hU = new THREE.Vector4();
  // Height above the seat as a fraction of the start height, s = 0..1 through
  // one holder's fall.
  function fallHeight(s) {
    if (s >= 1) return 0;
    if (s < FALL_LAND) {
      // Fast in, braking to a third of its entry speed: it arrives with speed,
      // so contact is a tap and not a hover. A smoothstep landed every holder at
      // zero velocity, which read as parts lowered on a string.
      const q = s / FALL_LAND;
      return (1 - q) * (1 - 0.5 * q);
    }
    // one small rebound (restitution ~0.5), sized to the frame like the fall
    const q = (s - FALL_LAND) / (1 - FALL_LAND);
    return 0.020 * Math.sin(Math.PI * q) * (1 - q);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // camera keys: p, target(model space), dist, yaw, pitch
  // Yaw is 0 from the top view onward: square to the plate, never angled left
  // or right, with pitch carrying the shot between the top and front planes.
  // Pitch also stays low enough that the SKIRT is in frame — the air chamber is
  // the whole point of act 4 and a high camera hides it behind the top face.
  const CAM = [
    // The hero shows the WHOLE part, rails and near corner included, between
    // the title card and the scroll cue; it holds while the title lifts away,
    // then pushes in until the part fills the frame with a margin on every
    // side. The old 272 -> 230 cropped the near corner 35-60 px off the bottom
    // of a 1440x810 frame for the entire first 11% of the story.
    [0.000, [0, 0, -7], 345, -0.785, 0.600],   // isometric, whole part under the title
    [0.012, [0, 0, -7], 345, -0.785, 0.600],   // held while the title lifts away
    [0.070, [0, 0, -8], 272, -0.785, 0.600],   // pushed in, the whole part filling the frame
    [0.175, [0, 0, -6], 306,  0.000, 1.500],   // straight down
    [0.256, [0, 0, -6], 306,  0.000, 1.500],   // held while the bores are marked
    [0.312, [0, 0, -6], 248,  0.000, 0.470],   // square on, between top and front
    [0.444, [0, 0, -6], 248,  0.000, 0.470],
    // 0.478, not 0.462: the step back for the turn was crammed into 0.018 of
    // scroll (117 px) - the fastest camera move in the story, about 1.3 px of
    // model motion per px of scroll - and it ended exactly as the turn began,
    // so the part backed away, stopped, then started to turn. It now overlaps
    // the turn's slow first degrees and the start of the 40 mm lift, so the
    // two read as one gesture. The target stays at -6, so the tumble pin
    // (tw = rootY - 6 from A.tumble[0]) is still a no-op inside this segment.
    [0.478, [0, 0, -6], 300,  0.000, 0.360],   // lower, and back, for the tumble
    [0.640, [0, 0, -6], 300,  0.000, 0.360],
    [0.670, [0, 0, -6], 250,  0.000, 0.385],
    [0.736, [0, 0, -6], 250,  0.000, 0.385],
    [0.868, [0, 0, -4], 330,  0.000, 0.030],   // level with the water
    // One eased push-in from the landing to the canopy. camAt smoothsteps each
    // segment, so every key is a full stop: a key at 0.912 ([0,0,6], 300,
    // 0.020, within 3 mm of this straight line) braked the camera to zero
    // while the plants were sprouting and set it off again, a scroll stutter.
    [0.950, [0, 0,  8], 274,  0.000, 0.020],   // the canopy, still above water
    [1.000, [0, 0,-22], 330,  0.000,-0.215],   // and down through the surface
  ];
  // Writes into a hoisted scratch. Returning a fresh object and a fresh array
  // every frame measured 669-909 bytes/frame, which is a young-generation
  // collection every couple of minutes — one 1-3 ms hitch, invisible in an
  // average and exactly what a reader notices once during a slow scroll.
  const _cam = { target: [0, 0, 0], dist: 0, yaw: 0, pitch: 0 };
  const OPEN_ORBIT = [0.032, 0.150];      // orbit start, yaw landing (pitch lands on CAM[3])
  function camAt(p) {
    let i = 0;
    while (i < CAM.length - 2 && p > CAM[i + 1][0]) i++;
    const a = CAM[i], b = CAM[i + 1];
    const u = ramp(p, a[0], b[0]);
    _cam.target[0] = lerp(a[1][0], b[1][0], u);
    _cam.target[1] = lerp(a[1][1], b[1][1], u);
    _cam.target[2] = lerp(a[1][2], b[1][2], u);
    _cam.dist = lerp(a[2], b[2], u) * aspectPull;
    _cam.yaw = lerp(a[3], b[3], u);
    _cam.pitch = lerp(a[4], b[4], u);
    // The opening is ONE gesture. Every key is a full stop, and the push-in
    // (0.012-0.070) and the rise (0.070-0.175) shared the key at 0.070, so the
    // camera braked to zero between them: at 1440x810 the part moved 2.1 px per
    // 0.005 of scroll at 0.074 against 50 px at 0.050 and 57 at 0.145 - a dead
    // stop in the first screenful. The orbit now starts under the tail of the
    // push-in, so the two moves overlap, and YAW lands first (0.150): the plate
    // is square before caption 01's type starts (0.156) instead of still
    // turning its last 4 deg under it. dist and target keep their keys.
    if (p > OPEN_ORBIT[0] && p < CAM[3][0]) {
      _cam.yaw = lerp(CAM[2][3], CAM[3][3], ramp(p, OPEN_ORBIT[0], OPEN_ORBIT[1]));
      _cam.pitch = lerp(CAM[2][4], CAM[3][4], ramp(p, OPEN_ORBIT[0], CAM[3][0]));
    }
    return _cam;
  }

  /* ---------- captions ---------- */
  // One panel, its content swapped per act: a centred block of type across the
  // top of the frame, with the model dropped down out from under it. The
  // pop-out boxes with leader lines were fighting the model for attention.
  //
  // THE CAPTION LAYOUT SYSTEM — this table, measureCaps, seatCaption, capDrop
  // and placeCaption are all of it. Fields per caption:
  //   win: [a, b]       the act. Anchors the model's drop, and is also the type
  //                     window unless show/out say otherwise.
  //   show / out        optional. When the TYPE starts to fade in / has faded
  //                     out, independently of the drop (which stays on win).
  //                     Type windows must not overlap: the content swaps at the
  //                     crossing, so an overlap would switch the words mid-fade.
  //   bot               where the type block's BOTTOM edge sits, as a fraction
  //                     of the stage height. The block grows UP from there into
  //                     the empty top of the frame, never down into the part.
  //                     Measured from the 1440x810 seats, so that size is
  //                     unchanged.
  //   drop              how far the model moves down for the act (fraction of h).
  //   handoff: true     the drop crossfades straight into the next caption's
  //   handoff: "water"  the drop crossfades into the water shot's horizon offset
  //   dIn / dOut        explicit drop windows for an act with its own timing
  //   align: "next"     seat the block's TOP on the next caption's top, for a
  //                     caption that hands straight to the next one
  const CAPS = [
    { win: [0.156, 0.262], drop: 0.145, bot: 0.242, handoff: true, n: "01", name: "Thirteen seats", role: "Bore pattern",
      body: "&empty;11.26&nbsp;mm bores on a 21.59&nbsp;mm pitch, staggered <span class='nw'>4&ndash;5&ndash;4</span> so the outer rows sit half a pitch off the middle one." },
    // The holders fall through the type band (0.300-0.3856, left to right), and
    // with the type on win it was solid from 0.334 while cones crossed the
    // headline and the body copy until 0.369 at every viewport. The TYPE now
    // waits for the run (show 0.372): the last holder is below the type before
    // the words reach 2% opacity, and they fade in as the last ones tap down.
    // The drop keeps win, so the plate is already seated before the fall.
    { win: [0.314, 0.448], show: 0.372, drop: 0.150, bot: 0.335, dOut: [0.482, 0.526], n: "02", name: "One per bore", role: "Seed holders",
      body: "Thirteen holders seat on their flanges. Each basket carries the seed and its medium; roots pass through it into the reservoir below." },
    // The drop lands WITH the turn's deceleration, so the part is dead still for
    // the whole 0.526-0.580 hold. On the generic windows it slid 111 px down the
    // frame through the first half of the hold and began rising back into solid
    // type.
    // Through the turn the part does not move for the type. 02 used to let go
    // of its drop over 0.443-0.488 and 03 to take it back over 0.482-0.526,
    // and 03 let go over 0.590-0.632 before 04 took it over 0.614-0.662: with
    // no caption on screen the plate rose 187 px up the frame and sank 151 px
    // back on the way in, and rose ~110 px on the return (1440x810). 02 now
    // hands its drop straight to 03 (02's dOut = 03's dIn) and 03 straight to
    // 04 (03's dOut = 04's default in), so the drop only crossfades
    // 0.175 -> 0.190 -> 0.145 of h. The hold is untouched.
    { win: [0.526, 0.602], drop: 0.190, bot: 0.270, dIn: [0.482, 0.526], dOut: [0.614, 0.662],
      n: "03", name: "Two sealed rails", role: "Why it floats",
      body: "Each long side is a closed box section, 113.8&nbsp;mm long and 20.3&nbsp;mm deep, capped underneath by a 1.7&nbsp;mm skin. The pair encloses 28.7&nbsp;cm&sup3; the water cannot get into. Nothing hangs below the middle of the plate." },
    { win: [0.654, 0.758], drop: 0.145, bot: 0.382, handoff: "water", n: "04", name: "Handles", role: "Lifting out",
      body: "They clip into slots moulded into the plate, so the whole raft lifts clear of the reservoir without touching a plant." },
    // The raft is still coming down (0.800-0.868) as 05 arrives, and its handle
    // tops are the part nearest the type. At 0.806/0.453 the fading-in type
    // sat level with them (0.7 px at a quarter opacity, 20 px solid at
    // 1440x810) and the settled gap was 46 px. The type now appears 0.010
    // later, once the raft is nearly down, and sits 35 px higher in the sky:
    // 51 / 67 / 81 px at 1440x810, and still 42 / 57 / 68 at 1512x680.
    // The raft does not move for it (drop 0). The out at 0.890 still clears
    // 06's 0.902.
    { win: [0.816, 0.890], drop: 0.000, bot: 0.410, align: "next", n: "05", name: "Deep water culture", role: "On the reservoir",
      body: "The raft floats on the nutrient solution and rides its surface." },
    // The dive (0.952-1.000) lifts the raft into the top of the frame: its
    // handle tops reach the type at p 0.958 on every desktop window, and the
    // copy used to stay up to 0.981, printed across the leaves and the plate.
    // The TYPE now leaves on its own window (out 0.962), fully gone before the
    // handles arrive, while the drop keeps win/dOut so the dive and the final
    // frame are framed exactly as before. show 0.894 keeps the solid read at
    // 0.038, like 05's. Seated at 05's bot, so the 05 -> 06 swap never jumps.
    { win: [0.902, 1.001], show: 0.894, out: 0.962, drop: 0.040, bot: 0.410, dOut: [0.976, 1.021], n: "06", name: "Roots reach the solution", role: "Growth",
      body: "Shoots rise from the baskets while the roots grow down through them into the aerated water." },
  ];
  const CAP_FADE = 0.020;             // type fade length, in p
  // How much of its authored gap over the part a caption clamped under the
  // topbar may give up before the part is moved (fraction of h). The smallest
  // authored gap at 1440x810 is act 3's, ~0.097 h of clear air under the ink.
  const CAP_SLACK = 0.040;
  const panel = document.getElementById("panel");
  // wiki: the fixed chrome here is the nav bar plus the .hwnav strip under it
  const topbar = document.querySelector(".topbar, .hwnav");
  const pEls = panel ? {
    tag: panel.querySelector(".tag"), name: panel.querySelector(".pname"),
    role: panel.querySelector(".prole"), body: panel.querySelector("p")
  } : null;
  let capShown = -1;
  // Per caption, once per layout (measureCaps): the type block's height in px,
  // and capX, the extra drop (fraction of h) it needs ONLY where its seat
  // would reach the topbar and is clamped below it.
  const capH = new Float32Array(CAPS.length), capX = new Float32Array(CAPS.length);
  // SHORT WINDOWS (a phone on its side, ~390 px tall). The topbar and the
  // 12 px body floor are fixed px, so the type is 43-48% of the height there
  // and the part, 56-61% of the height, cannot fit under it at any drop: the
  // drop alone cut 46 px off the lower air chamber at 844x390 and ran both
  // handles through the act-04 copy. Below FIT_H the act's camera also backs
  // off (capS, a distance factor) just enough to seat the part between the
  // type and the frame foot. CAP_FIT: the part's highest and lowest point
  // about the look target over each act's type window, fraction of h at
  // pull 1, measured at 1440x810 (vertical fov, so the same on any aspect).
  // Windows taller than FIT_H are untouched (fitK 0, capS exactly 1).
  const capS = new Float32Array(CAPS.length).fill(1);
  const CAP_FIT = [[0.300, 0.298], [0.270, 0.294], [0.354, 0.259], [0.331, 0.269]];
  const FIT_H = 600, FIT_RAMP = 80, FIT_GAP = 0.045, FIT_FOOT = 0.040;
  let capPull = 1;
  function fillCaption(i) {
    const c = CAPS[i];
    pEls.tag.textContent = c.n;
    pEls.name.textContent = c.name;
    pEls.role.textContent = c.role;
    pEls.body.innerHTML = c.body;
  }
  // The fixed topbar is painted over the stage; type stays 14 px under it.
  function capBar() { return (topbar ? topbar.getBoundingClientRect().bottom : 52) + 14; }
  // The block's unclamped top: its own bot, or (align "next") the next
  // caption's top. 05 hands straight to 06 (out 0.890, show 0.894); seated by
  // its own bottom the one-line 05 sat a body line lower, and the eyebrow and
  // name hopped 22 px up across the swap (1440x810).
  function capTop(i) {
    const k = CAPS[i].align === "next" && CAPS[i + 1] ? i + 1 : i;
    return CAPS[k].bot * cssH - capH[k];
  }
  function seatCaption(i, bar) {
    panel.style.top = Math.max(bar, capTop(i)).toFixed(1) + "px";
  }
  // The model's size on screen is a fixed fraction of the stage HEIGHT (the fov
  // is vertical) while the type was fixed px, so a short window gave the same
  // block a bigger bite of the frame and a smaller gap over the part. --ck
  // scales the caption type (and the title card) with the height, clamped to
  // [0.78, 1]: the block keeps its 1440x810 proportion down to ~630 px tall and
  // never grows past it. Heights are then MEASURED, per caption, never per
  // frame: the drop used to be scaled by whichever caption was LOADED,
  // re-measured only on a content swap, so it changed mid-ramp (a 19 px model
  // pop at p = 0.531 on 1280x720).
  function measureCaps() {
    if (!panel || !pEls) return;
    story.style.setProperty("--ck", Math.min(1, Math.max(0.78, cssH / 810)).toFixed(3));
    // Above 810 tall the part keeps growing with h but the caption type stopped
    // at 1: at 1920x1080 the block was 9.9% of the height against 13.2% at 810,
    // at 2560x1440 7.4% (a 27 px name over a 1528 px plate). The CAPTION only
    // (the title card's gap to the hero part is already tight, so #story keeps
    // the clamp above) follows at 0.6 of the height ratio, capped at 1.30:
    // 1080 tall 1.20, 1440 tall 1.30. It is seated by its bottom edge, so it
    // grows up into the empty sky and the gap over the part is kept. Desktop
    // widths only (ramp 900-1200 px): a portrait tablet or phone is width-bound,
    // and a bigger block there only wraps to an extra line.
    const ckUp = Math.min(1.30, 1 + 0.6 * Math.max(0, cssH / 810 - 1) * Math.min(1, Math.max(0, (cssW - 900) / 300)));
    panel.style.setProperty("--ck", (cssH < 810 ? Math.max(0.78, cssH / 810) : ckUp).toFixed(3));
    const bar = capBar();
    // Every height first: an align "next" caption is seated on the next one's.
    for (let i = 0; i < CAPS.length; i++) { fillCaption(i); capH[i] = panel.offsetHeight; }
    for (let i = 0; i < CAPS.length; i++) {
      // The plate does not move because of the type: a block clamped under
      // the topbar first spends up to CAP_SLACK of its own authored gap, and
      // only a block that would eat more than that (a phone's wrapped copy)
      // hands the rest to the model as extra drop. The topbar is fixed px,
      // so on a 680-720 px window 01 and 03 overflow by 12-16 px; letting
      // capX take all of it sat the rails 16 px nearer the frame foot.
      capX[i] = Math.max(0, bar - capTop(i) - CAP_SLACK * cssH) / Math.max(1, cssH);
      capS[i] = 1;
      const fitK = Math.min(1, Math.max(0, (FIT_H - cssH) / FIT_RAMP)), F = CAP_FIT[i];
      if (fitK > 0 && F) {
        const top = (Math.max(bar, capTop(i)) + capH[i]) / cssH + FIT_GAP;
        const foot = 1 - FIT_FOOT;
        const s = Math.max(1, (F[0] + F[1]) / Math.max(0.2, foot - top));
        const d0 = CAPS[i].drop + capX[i];
        const d = s > 1 ? top + F[0] / s - 0.5 : Math.min(Math.max(d0, top + F[0] - 0.5), foot - F[1] - 0.5);
        capS[i] = 1 + (s - 1) * fitK;
        capX[i] += (d - d0) * fitK;
      }
    }
    // Put back and re-seat what is showing in this same task, so a resize
    // mid-caption never paints the last-measured caption or a stale seat
    // (a ResizeObserver callback runs after this frame's rAF).
    if (capShown >= 0) { fillCaption(capShown); seatCaption(capShown, bar); }
  }
  // The title card sits over the top of the frame and the scroll cue under it;
  // the part is seated in the band between them. That band is fixed px type
  // against a part that scales with h, so it is MEASURED (on resize, never per
  // frame): where it is shorter than the part, the camera backs off by exactly
  // the missing fraction, and the part is centred in what is left.
  // HERO_T/B: the part's top and bottom at the hero key with no offset, as
  // fractions of h (measured at 1440x810; they scale about the centre with
  // distance, and aspectPull is a distance).
  const HERO_T = 0.215, HERO_B = 0.827;
  let heroLo = 0.275, heroHi = 0.880;
  function heroK(p) { return 1 - ramp(p, 0.012, A.title[1]); }
  function heroS() {
    return Math.max(0.85, (HERO_B - HERO_T) / (aspectPull * Math.max(0.2, heroHi - heroLo)));
  }
  function heroDrop(p) {
    const k = heroK(p);
    if (k <= 0) return 0;
    const s = heroS() * aspectPull;
    const mid = 0.5 + ((HERO_T + HERO_B) / 2 - 0.5) / s;
    return Math.max(0, (heroLo + heroHi) / 2 - mid) * k;
  }
  // How far the model drops for the act that is up. The captions are a centred
  // band across the TOP of the frame now, so the subject moves DOWN out from
  // under them and never sideways — the sideways push is what used to carry a
  // handle off the right edge at full extension (measured: 104.1% of frame
  // width). The water acts pass 0: their horizon offset already sits the raft
  // low in the frame.
  // One release scheme. By default the drop LEADS the type in and TRAILS it
  // out, so the part never moves toward visible type. Released to zero between
  // acts and re-taken, it made the model bob with nothing driving it: 91 px up
  // into the empty band and 137 px back down across the top-to-front roll, and
  // 101 up / 146 down from the handles to the water (1440x810). A `handoff`
  // crossfades instead: into the next caption's drop, or into the water shot's
  // horizon offset on the very ramp that brings it in (see oy), so the model
  // travels down once, continuously.
  // capX rides the same ramps as the caption's own drop, so it can never pop.
  function capDrop(p) {
    let d = 0, sp = 0;
    for (let i = 0; i < CAPS.length; i++) {
      const c = CAPS[i], prev = CAPS[i - 1], next = CAPS[i + 1];
      const dr = c.drop + capX[i];
      if (!dr && capS[i] === 1) continue;
      const inU = c.dIn ? ramp(p, c.dIn[0], c.dIn[1])
        : prev && prev.handoff === true ? ramp(p, prev.win[1] - 0.025, c.win[0] + 0.020)
        : ramp(p, c.win[0] - 0.040, c.win[0] + 0.008);
      const outU = c.dOut ? ramp(p, c.dOut[0], c.dOut[1])
        : c.handoff === "water" ? ramp(p, A.drop[0] - 0.03, A.drop[0] + 0.05)
        : c.handoff && next ? ramp(p, c.win[1] - 0.025, next.win[0] + 0.020)
        : ramp(p, c.win[1] - 0.005, c.win[1] + 0.040);
      if (inU <= 0 || outU >= 1) continue;
      d += dr * inU * (1 - outU);
      sp += (capS[i] - 1) * inU * (1 - outU);
    }
    capPull = 1 + sp;   // read by the camera block, same ramps as the drop
    return d;
  }
  function placeCaption(p) {
    if (!panel) return;
    let best = -1, o = 0;
    for (let i = 0; i < CAPS.length; i++) {
      const c = CAPS[i];
      const s = c.show !== undefined ? c.show : c.win[0];
      const e = c.out !== undefined ? c.out : c.win[1];
      const v = ramp(p, s, s + CAP_FADE) * (1 - ramp(p, e - CAP_FADE, e));
      if (v > o) { o = v; best = i; }
    }
    if (best >= 0 && best !== capShown) {
      // Each act seats its type where that act has room (bot, see CAPS). The
      // swap happens while the type is faded out, so the move is never seen.
      fillCaption(best);
      seatCaption(best, capBar());
      capShown = best;
    }
    panel.style.opacity = o;
    panel.style.transform = "translateX(-50%) translateY(" + (12 * (1 - o)) + "px)";
  }

  // the thirteen bore rings for act 2
  const RINGS = BORES.map(function (b) {
    const el = document.createElement("i");
    el.className = "mark-ring";
    hud.appendChild(el);
    // Each ring waits by its distance from the centre bore, so the rings ripple
    // out 1 -> 2 -> 4 -> 4 -> 2 and the arrival itself draws the 4-5-4. The old
    // stagger was by array index: row A left to right, then B, then C.
    return { el: el, at: [b[0], b[1], PLATE_TOP],
             delay: 0.028 * Math.hypot(b[0], b[1] - ROW_B) / 43.18 };
  });

  /* ---------- scroll ---------- */
  // p is what the story is showing; pTarget is where the scroll bar is. They
  // are separate because a wheel notch moves the page 100-200 px, and on a
  // 6480 px track that is 1.5-3% of the entire story delivered in ONE frame.
  // No frame rate hides a jump that size — it reads as a lurch. p follows the
  // target on a critically damped spring instead (see step), which turns each
  // notch into a glide, and it is integrated against real dt so it behaves the
  // same at 60 Hz and 120 Hz.
  let p = 0, pTarget = 0, pVel = 0, pLast = 0;
  const SPRING_W = 44;        // rad/s; 2 / SPRING_W = 45 ms of tracking lag
  const SPRING_CUT = 0.20;    // a target move this big in ONE frame is navigation
  // Geometry cached, not measured per scroll event: getBoundingClientRect and
  // offsetHeight both force a style flush, and this fires on every wheel tick
  // right after the HUD has written thirteen ring positions.
  let cssW = 0, cssH = 0, storyTop = 0, storySpan = 1;
  function measure() {
    cssW = canvas.clientWidth || window.innerWidth;
    cssH = canvas.clientHeight || window.innerHeight;
    storyTop = story.offsetTop;
    storySpan = Math.max(1, story.offsetHeight - window.innerHeight);
    measureCaps();
    // The hero band: the part's top sits 14 px under the title block (the handle stands beside the rule's end), and
    // the part stops 20 px above the cue.
    if (titleEl && cueEl && cssH > 0) {
      heroLo = (titleEl.offsetTop + titleEl.offsetHeight + 14) / cssH;
      heroHi = (cueEl.offsetTop - 20) / cssH;
    }
  }
  function onScroll(snap) {
    pTarget = Math.min(1, Math.max(0, (window.pageYOffset - storyTop) / storySpan));
    if (snap === true) { p = pLast = pTarget; pVel = 0; }
  }

  const _v = new THREE.Vector3(), _tw = new THREE.Vector3(), _hz = new THREE.Vector3();
  function project(x, y, z, w, h) {
    _v.set(x, y, z); root.localToWorld(_v); _v.project(camera);
    return [(_v.x * 0.5 + 0.5) * w, (-_v.y * 0.5 + 0.5) * h, _v.z];
  }

  /* ---------- frame ---------- */
  const clock = new THREE.Clock();
  let elapsed = 0, aspectPull = 1;
  let slowRun = 0, fastRun = 0, qScale = 1;
  let warmPrograms = 0;                 // programs warmUp compiled (see warmUp)
  // One frame, synchronously. Split out of the loop because rAF does not tick
  // in a hidden or background tab, so a capture rig driving this by scroll
  // position would otherwise read the same stale frame every time.
  function step(advance) {
    const dt = Math.min(0.05, clock.getDelta());
    if (advance !== false) {
      elapsed += dt;
      // Chase the scroll bar. The capture rig passes advance === false and so
      // keeps setting p directly.
      //
      // The lag has to smooth a wheel notch without the reader feeling towed:
      // 90 ms trailed the wheel the whole way, so it is 45 ms. The filter used
      // to be first-order with a 0.045 leash. A first-order chase starts every
      // step at its PEAK speed, so each wheel notch landed as a tick; and the
      // leash did nothing below a whole story per second (lag = speed x 45 ms)
      // while turning Space, Page Down or a scrollbar click (0.109 of the story
      // at any height) into a one-frame cut of 0.064, ~420 px, then a glide.
      // A critically damped spring keeps the same 45 ms lag at a steady speed
      // (2 / SPRING_W), eases into each step from the speed it already has,
      // never overshoots a step, and settles sooner. It is integrated in closed
      // form, so it is exact at any dt up to the 50 ms clamp (explicit Euler at
      // SPRING_W * dt = 2.2 would diverge). No leash: at any speed the lag is
      // 45 ms of TIME. Only a target that moves more than SPRING_CUT in one
      // frame is cut outright — that is Home, End, a link or a stale restart,
      // and gliding through five acts in a tenth of a second is worse than a cut.
      const jump = pTarget - pLast;
      pLast = pTarget;
      if (jump > SPRING_CUT || jump < -SPRING_CUT) { p = pTarget; pVel = 0; }
      else {
        const k = Math.exp(-SPRING_W * dt);
        let e = p - pTarget;
        const c = (pVel + SPRING_W * e) * dt;
        pVel = (pVel - SPRING_W * c) * k;
        e = (e + c) * k;
        if (Math.abs(e) < 2e-5 && Math.abs(pVel) < 2e-4) { e = 0; pVel = 0; }
        p = Math.min(1, Math.max(0, pTarget + e));
      }
    }
    const w = cssW, h = cssH;
    // A pixel budget, not just a ratio cap. On a 5K display 1.6 x a 2560 px
    // stage is 9.4 M pixels of transparent water; this holds the drawing
    // buffer near 4 M however large the window is. Quantised so it cannot
    // oscillate and reallocate the buffer every frame.
    // Adaptive resolution. A pixel budget alone assumes every machine renders
    // at the same rate; this measures whether the browser is actually holding
    // 60 Hz and spends fewer pixels when it is not, rather than dropping
    // frames. Hysteresis both ways: about a second of consistently slow frames
    // steps it down, about ten seconds of clean ones steps it back up, and it
    // is quantised so the drawing buffer is not reallocated repeatedly.
    if (advance !== false) {
      if (dt > 0.022) { slowRun++; fastRun = 0; }
      else { fastRun++; if (slowRun > 0) slowRun--; }
      if (slowRun > 45 && qScale > 0.60) { qScale -= 0.12; slowRun = 0; }
      else if (fastRun > 600 && qScale < 1) { qScale = Math.min(1, qScale + 0.06); fastRun = 0; }
    }
    const want = Math.min(1.6, window.devicePixelRatio,
                          Math.sqrt(4.2e6 / Math.max(1, w * h))) * qScale;
    const pr = Math.max(0.60, Math.round(want * 20) / 20);
    if (Math.abs(pr - renderer.getPixelRatio()) > 0.001) renderer.setPixelRatio(pr);
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) ||
        canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    // fov is VERTICAL, so a portrait phone loses horizontal coverage — the
    // 117 mm plate was being cropped at both ends and the closing shot put the
    // camera inside the root curtain. Pull back until the horizontal field
    // matches the 16:9 framing everything here was staged for.
    // The 1.60 target makes a portrait screen show exactly the 16:9 width,
    // which left the plate at 46% of a phone's width with a void around it.
    // Portrait screens target 1.40 (plate +14%), easing back to 1.60 by 4:3,
    // so every landscape window is unchanged and a resize crosses no step.
    const aspect = w / Math.max(1, h);
    const pullTo = 1.40 + 0.20 * Math.min(1, Math.max(0, (aspect - 1) / 0.3333));
    aspectPull = Math.max(1, pullTo / Math.max(0.25, aspect));
    if (ready) frame(p, elapsed, w, h);
    renderer.render(scene, camera);
    // A program linking after warmUp is a first-visit stall the reader feels.
    // Reported once per new program, with its p, where the capture rig's
    // console-error check sees it. One integer compare on the normal path.
    if (warmPrograms && renderer.info.programs.length > warmPrograms) {
      warmPrograms = renderer.info.programs.length;
      console.error("hydroponics story: shader program compiled after warmUp at p = " + p.toFixed(4) +
                    " (first-visit stall); make warmUp() render this state");
    }
  }
  // Every act, rendered once while the loader still covers the canvas. Measured
  // on a cold load, the FIRST time the scroll reaches an act cost 12-61 ms
  // while that act's shader variants compiled and its textures uploaded —
  // 14.0 ms at the bore rings, 28.6 at the holders, 12.2 at the air chambers,
  // 43.2 at the water, 60.9 at the plants — against 0.2-2.4 ms on every later
  // visit. That is one to four dropped frames every time the reader enters a
  // new act, which is precisely what "choppy whenever I scroll" is. Paying it
  // up front costs a fraction of a second that the loader is already covering.
  function warmUp() {
    const keep = p;
    for (let i = 0; i <= 40; i++) { p = i / 40; step(false); }
    p = keep;
    // A grid of p cannot see a state narrower than its 0.025 step: a light
    // gated 0.0004 of scroll apart from its partner was missed exactly that
    // way. What was compiled here is the baseline step() checks against.
    warmPrograms = renderer.info.programs ? renderer.info.programs.length : 0;
  }

  // Off-screen the loop is pointless: it was animating and rendering a 2M-pixel
  // water surface while the reader was down in the written record.
  let onScreen = true, looping = false;
  function draw() {
    if (looping && !onScreen) { looping = false; return; }
    looping = true; step(); requestAnimationFrame(draw);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
      // The canvas is alpha:true, so the page's decorative graticule sits
      // BEHIND the render: through 0.7-alpha water it showed as a set of fixed
      // horizontal rules across the reservoir that did not move with the waves.
      document.body.classList.toggle("story-on", onScreen);
      // A restarted loop must not carry the spring speed it had when it stopped.
      if (onScreen && !looping) { pVel = 0; draw(); }
    }, { threshold: 0 }).observe(story);
  }

  function frame(p, T, w, h) {
    // w/h are needed by the frustum offset below as well as by the captions
    /* ---- act 4: the model tumbles, the camera holds ---- */
    // A full turn about the model's own horizontal axis: front, under, back,
    // front. It pauses with the underside up so the air chamber can be read.
    // The turn PAUSES at 122 degrees, not at 180. Held flat on its back the two
    // rails sit one behind the other and their outlines merge into a single box
    // the size of the whole part; tipped 122 degrees the underside faces the
    // camera and the two channels — and the two air volumes inside them — read
    // as two separate things, which is the entire point of the act.
    const AIR_ANGLE = Math.PI * 0.68;
    let tum = 0;
    if (p > A.tumble[0]) {
      const t0 = A.tumble[0], t1 = A.tumble[1];
      const hold0 = A.airHold[0], hold1 = A.airHold[1];
      if (p < hold0)      tum = ramp(p, t0, hold0) * AIR_ANGLE;
      else if (p < hold1) tum = AIR_ANGLE;
      else                tum = AIR_ANGLE + ramp(p, hold1, t1) * (2 * Math.PI - AIR_ANGLE);
    }
    root.rotation.x = BASE_TILT - tum;

    /* ---- act 6: the drop, and floating ---- */
    const dropU = ramp(p, A.drop[0], A.drop[1]);
    const wet = p > A.drop[0] - 0.02;
    const wetU = ramp(p, A.drop[0] - 0.02, A.drop[1]);
    if (water) {
      water.visible = wet;
      waterFar.visible = wet;
      // Clears as the roots arrive. At 0.90 the surface was effectively opaque
      // and the roots — the whole point of act 7 — were behind it.
      water.material.opacity = (0.70 - 0.26 * ramp(p, A.grow[0], A.grow[1]))
                             * ramp(p, A.drop[0] - 0.02, A.drop[0] + 0.05);
    }
    // energy: churned by the entry, then settling
    // Peak entry churn was putting 9 mm of wave against 13 mm of freeboard, so
    // the raft kept washing over. The plate is only 117 mm across; the sea has
    // to be scaled to it.
    // Peak 0.92, not 1.22. The bright patch on the surface was never a light —
    // it is studioEnv's key softbox seen in the mirror. The water camera sits
    // 3.3 deg above the surface, so a facet tilted t sends its reflected ray to
    // 3.3 + 2t; at the old peak slope that reached 35.9 deg, into the middle of
    // the softbox. At 0.92 the steepest facet reaches 17.5 deg, just past the
    // blurred lower edge of it.
    // The swell starts when the rails meet the water (RIP_P), not 0.035 of
    // scroll before: the sea used to churn while the raft was still ~30 mm in
    // the air, so the effect came before its cause. Same peak level.
    const energy = 0.30 + 0.62 * ramp(p, RIP_P - 0.004, RIP_P + 0.024)
                        * (1 - 0.63 * ramp(p, A.drop[1], A.settle[1]));
    // (updateWater runs in act 7, once the dive has decided whether the surface
    // is drawn at all; nothing between here and there reads the displaced grid.)
    // the GPU copy of the surface: same flag, clock and energy as the CPU grid
    WET_U.uWet.value = wet ? 1 : 0;
    WET_U.uWT.value = T;
    WET_U.uWE.value = energy;
    WET_U.uRip.value = Math.min(1, Math.max(0, (p - RIP_P) / RIP_LEN));
    // The raft rides the surface it is actually on: its height and tilt are
    // sampled from the same wave sum, at three points on its own footprint.
    //
    // It descends from the height it was ALREADY at. Starting the fall from a
    // fixed WATER_Y + 520 meant that the instant this branch took over, the
    // model teleported 380 mm upward — measured as a 380 mm single-step camera
    // jump at p = 0.782 against a 4.4 mm mean, i.e. a hard cut mid-scroll.
    // and a lift through the tumble, because a part turning about its own centre
    // sweeps 51 mm below its origin and would otherwise scythe through the floor
    let rootY = STUDIO_Y + 40 * ramp(p, A.tumble[0] - 0.020, A.tumble[0] + 0.030)
                              * (1 - ramp(p, A.tumble[1] - 0.030, A.tumble[1] + 0.020));
    let rollX = 0, rollZ = 0;
    if (p > A.drop[0] - 0.02) {
      const hC = waveAt(0, 0, T, energy);
      const hX = waveAt(52, 0, T, energy), hZ = waveAt(0, 40, T, energy);
      const floatY = WATER_Y + 13.0 + hC;
      const inAir = lerp(STUDIO_Y, floatY, dropU);
      // It sinks past its float line and bobs back: SINK mm under, REBOUND mm
      // over, then it rides. Without it the raft reached the float line at zero
      // velocity and stopped dead, like a part set down on a table, and the
      // settle window moved only the sea. The lobes start at contact, while the
      // descent is still moving, so the two velocities add instead of stalling.
      const sq = Math.min(1, Math.max(0, (p - RIP_P) / (A.settle[1] - RIP_P)));
      const plunge = sq < 0.45 ? -SINK * sin2(sq / 0.45)
                   : (sq < 0.80 ? REBOUND * sin2((sq - 0.45) / 0.35) : 0);
      rootY = inAir + plunge;
      const land = ramp(p, A.drop[1] - 0.03, A.settle[0] + 0.02);
      rollZ = Math.atan2(hX - hC, 52) * land;
      rollX = -Math.atan2(hZ - hC, 40) * land;
    }
    root.position.y = rootY;
    WET_U.uRaft.value.set(root.position.x, rootY + PLATE_TOP, root.position.z);
    root.rotation.z = rollZ;
    root.rotation.y = rollX;
    // The straight-down technical view is both the one shot that does not want a
    // floor and the most expensive frame in the story (9.0 ms measured, of
    // which the floor is 2.1). It fades out for the duration of that act.
    // The studio DISSOLVES into the reservoir. The floor and its motes used to
    // be switched off in one frame at the wet threshold (drop - 0.02): the
    // floor bands beside the raft fell 34 grey levels in a single 0.005 step,
    // between two continuous moves. They now fade out while the handles seat,
    // and are fully gone exactly at drop[0], so every frame from the drop on
    // is unchanged.
    const studioOut = ramp(p, A.drop[0] - 0.050, A.drop[0]);
    // Back in at only 45% for act 02: at full strength the pool rose behind the
    // part while the holders fell, and its brightest ring sat right behind the
    // plate's far top edge (floor 65 vs plate 74 at p 0.41, 1440x810), so the
    // back edge melted into the haze. The rest returns with the pull-back for
    // the turn, where the lift and its shadow need the floor.
    const floorOut = Math.max(ramp(p, 0.120, 0.180) * (1 - 0.45 * ramp(p, 0.300, 0.356)
                                                     - 0.55 * ramp(p, 0.440, 0.480)), studioOut);
    const fu = floorMat.uniforms;
    fu.uFade.value = 1 - floorOut;
    ground.visible = floorOut < 0.995;
    // the shadow spreads, softens and fades as the part rises off the floor
    const lift = Math.max(0, rootY);
    // Thrown by the key at (340, 620, 520): a point at height h lands at
    // -h * (L.x/L.y, L.z/L.y). Plane-local y is world -z. Without the throw the
    // shadow sits exactly under the part and the part hides all of it.
    // Tucked under the part for the hero, then pulled fully under it as the
    // camera climbs. At the full throw the three-quarter camera saw the shadow
    // slide out to screen-left, right behind the part's darkest face: the rail
    // end and underside (luma 7-15) sat on a 24-luma lobe and the left of the
    // silhouette dissolved. And because the part hovers 30 mm up, the higher
    // the camera, the further an offset shadow parallaxes out: from p 0.10 it
    // read as a second, dark plate up and left of the real one until the floor
    // faded (0.12-0.18). With no offset it stays a soft halo round the plate,
    // which keeps the black top face's edge (fading the shadow instead took
    // that edge from 23 to 8 levels at 0.155). pitch <= 0.66 (front, turn,
    // handles) gives factor 1 once past the rise, so those acts are unchanged.
    // camAt() only writes the hoisted _cam, which the camera block below
    // rewrites in full with the same p.
    const throwK = (0.40 + 0.60 * ramp(p, A.toTop[0], A.toTop[1])) * (1 - ramp(camAt(p).pitch, 0.66, 1.10));
    fu.uC.value.set(-lift * (340 / 620) * throwK, lift * (520 / 620) * throwK);
    fu.uR.value.set(58.75 + lift * 0.30, 46.25 + lift * 0.30);
    fu.uSoft.value = 9 + lift * 0.62;
    fu.uStr.value = Math.max(0, 1 - lift / 240);
    // one bar of light crossing the floor across the whole studio sequence
    fu.uRake.value = -1.20 + 2.40 * Math.min(1, Math.max(0, (p - 0.02) / 0.74));

    // Drift by rotating the whole cloud rather than rewriting 1800 floats a
    // frame: no buffer re-upload, and at this density the rotation reads as
    // Brownian motion anyway.
    dust.material.opacity = 0.085 * (1 - floorOut);
    dust.visible = dust.material.opacity > 0.004;
    if (dust.visible) {
      dust.rotation.y = T * 0.021;
      dust.position.y = Math.sin(T * 0.13) * 7;
    }
    // orientation-independent fill, on only for the turn
    // ONE envelope and ONE visibility gate for both turn lights (turnKey below
    // reads turnEnv too). The count of visible lights is part of every lit
    // program's key. With the fill gated on 2.05 x env > 0.002 and the key on
    // env > 0.002, the fill came on ~0.0004 of scroll before the key: a
    // 5-directional + 1-hemisphere state that warmUp's 0.025 grid never lands
    // on, so the plate, handle and holder programs compiled on the reader's
    // first frame into the turn (p 0.4429), or at the handle release (0.6587)
    // on a jump into act 04. Below env 0.002 the fill is under 0.3 of a code value.
    const turnEnv = ramp(p, A.tumble[0] - 0.020, A.tumble[0] + 0.030)
                  * (1 - ramp(p, A.tumble[1] - 0.030, A.tumble[1] + 0.020));
    turnFill.intensity = 2.05 * turnEnv;
    turnFill.visible = turnEnv > 0.002;
    // The fill was sized for a plate whose albedo is 0x1b1f26. The handles
    // (0x6b727b) and holders (0x5c3410) have 10-20x its linear albedo, so the
    // same 2.05 hemisphere lifted them to near-white and to saturated orange
    // (holder mean sRGB 92,54,36 before the turn -> 132,83,49 at the hold).
    // Their albedo is pulled down by the same envelope so only the plate is lifted.
    const tf = turnFill.intensity / 2.05;
    // The same holds on the water: bounce + sun were sized for the black
    // plate and took the handles from 127 (studio) to 150-168, brighter than
    // the plants. Pulled down over the drop and again as the sun comes up
    // (same envelope as sun.intensity), so they stay mid-grey. The sun itself
    // is untouched, so the plants are not.
    const sunU = ramp(p, A.grow[0] - 0.02, A.grow[1] - 0.02);
    // Act 02 is about the holders, but the light-grey handles were the brightest
    // thing in that frame (bright-pixel mean 140 vs the holders' 56). They step
    // back to a gunmetal grey while it runs: in during the camera's arrival at
    // the front view, before the first holder enters; back out as caption 02
    // leaves, where the turn fill's own albedo pull (tf) takes over. The
    // environment alone could not do it (140 -> 135): the face light on the
    // albedo is what lights them, so the albedo carries most of the duck.
    const duck02 = ramp(p, 0.270, 0.310) * (1 - ramp(p, 0.430, 0.462));
    // Turn pull 0.70, not 0.45: at 0.45 the handles were the brightest thing in
    // the rails hold (median 150/164 against 65-68 for the violet volumes).
    // The act-02 albedo duck is held (duckA) until the turn pull exceeds it and
    // the two are combined with max, not summed: duck02 ramps out 0.430-0.462
    // while tf ramps in 0.442-0.492, and the gap let the handles flare up to
    // albedo 0.87 between the acts. With max the pull never lets go. duckA's
    // own ramp-out sits where tf is already 1, so it is never visible.
    const duckA = ramp(p, 0.270, 0.310) * (1 - ramp(p, 0.500, 0.540));
    MAT[1].color.copy(MAT_C[1]).multiplyScalar(1 - Math.max(0.42 * duckA, 0.70 * tf) - 0.20 * dropU - 0.15 * sunU);
    // The holders get the same compensation on the water: bounce + sun took
    // the printed brown flange from (82,49,37) in the studio to (113,76,53)
    // at 0.95, the warmest thing in the growth shot. tf and dropU are never
    // both non-zero (the turn ends before the drop), so this stays >= 0.5.
    MAT[2].color.copy(MAT_C[2]).multiplyScalar(1 - 0.50 * tf - 0.26 * dropU - 0.24 * sunU);

    // The model's transform must be final BEFORE the camera reads it. This
    // block used to sit after the camera, so localToWorld returned the
    // PREVIOUS step's position: during the drop the camera aimed where the
    // plate had been and the shot was nothing but water.
    root.updateMatrixWorld(true);

    /* ---- camera ---- */
    const c = camAt(p);
    const hk = heroK(p);
    if (hk > 0) c.dist *= 1 + (heroS() - 1) * hk;
    const capD = capDrop(p);    // also writes capPull
    c.dist *= capPull;
    const tw = _tw.set(c.target[0], c.target[1], c.target[2]);
    root.localToWorld(tw);
    // During the tumble the target must not tumble with the model, or the
    // camera swings around and the turn reads as a camera move instead.
    // Bound to the tumble WINDOW, not to tum>0: the tumble ends on a full
    // turn, so tum stays at 2*PI for the rest of the story, and this pinned
    // the camera to the origin while the plate dropped away into the water.
    // Pinned to the model's CURRENT height, not to the world origin: the part
    // is lifted 40 mm through the turn so it clears the studio floor, and a
    // fixed target left it climbing out of the top of the frame.
    // -6, not -4, because that is what the CAM keys either side of the window
    // target. At tum = 0 and tum = 2*PI the model matrix is identical, so
    // localToWorld([0,0,-6]) is exactly (0, rootY - 6, 0) at both boundaries
    // and the switch becomes a no-op. At -4 the pin and the key disagreed by
    // 2 mm and the whole model teleported as p crossed each end: measured at
    // 1440x810, a 12.95 px single-step jump at p = 0.5002 and 11.51 px at
    // p = 0.6802, where the neighbouring steps are near zero. Two hard cuts
    // bracketing the centrepiece act.
    if (p >= A.tumble[0] && p <= A.tumble[1]) tw.set(0, rootY - 6, 0);
    camera.position.set(
      tw.x + c.dist * Math.sin(c.yaw) * Math.cos(c.pitch),
      tw.y + c.dist * Math.sin(c.pitch),
      tw.z + c.dist * Math.cos(c.yaw) * Math.cos(c.pitch));
    camera.lookAt(tw);
    // The brief asks for a square-on water shot with the waterline a third of
    // the way up. Tilting the camera down to do that stops the axis being
    // parallel to the surface, so the frustum is OFFSET instead: the axis stays
    // level and the horizon slides down the frame.
    const wl = ramp(p, A.drop[0] - 0.03, A.drop[0] + 0.05) * (1 - ramp(p, 0.928, 0.980));
    // Everything is vertical now: the title card and every caption are centred
    // at the top and the model is pushed down under them. The water shot's
    // horizon offset is the same fraction on every window. Below 720 px wide it
    // was 0.085 (a side-panel-era value): on a 390x844 phone the horizon sat 44%
    // up at 0.85 and 40% at 0.93, halving the frame, against 1/3 on desktop and
    // on a 768x1024 tablet, and a resize across 720 px jumped it 0.118 h.
    // No multiplier on the caption drop: the caption type scales with h (--ck)
    // and is seated by its bottom edge, so the same drop fraction clears it on
    // every window; capX (measureCaps) covers a block clamped under the topbar.
    // Mid-roll the three-quarter silhouette (top face AND front rail) is taller
    // than either the plan or the front view, so with the drop held through the
    // handoff its near edge overshot the frame foot on short windows. Ease the
    // offset up by a sine over the camera's own move: zero, with zero slope, at
    // both keys.
    const rollDip = 0.032 * Math.sin(Math.PI * ramp(p, A.toFront[0] + 0.012, A.toFront[1]));
    // max(), not +. The title card's drop reaches 0 at p = 0.080 and the first
    // caption's starts at p = 0.120, so adding them made the model rise 124 px
    // and sink again across that gap — a bob with nothing driving it. They are
    // two claims on the same rectangle at the top of the frame, so the larger
    // one wins.
    const oy = -h * (0.203 * wl
                     + Math.max(heroDrop(p), capD - rollDip));
    const ox = 0;
    if (Math.abs(oy) > 0.5) camera.setViewOffset(w, h, ox, oy, w, h);
    else camera.clearViewOffset();
    // The HUD projects through this camera in the SAME frame, and matrixWorld
    // is otherwise not recomputed until render(): without this the rings were
    // placed with the previous act's camera, which on a jump put them tens of
    // thousands of pixels off screen.
    camera.updateMatrixWorld(true);
    _v.subVectors(tw, camera.position).normalize();
    rimBack.position.copy(tw).addScaledVector(_v, 700);
    // Lifted out of the top slab's mirror angle as the camera comes down. At a
    // fixed +340 this light sat ~28 deg above the horizon behind the part while
    // the front cameras sit 21-27 deg above it in front: the mirror geometry for
    // a horizontal face, so this "rim" was the top slab's key (52-63% of its
    // value by ablation) and the black plate read brushed aluminium from act 02
    // on (top-face median 89 holders, 114 handles, 127 water). The same lobe on
    // the water was the bright pool under the raft. Pitch >= 0.60 (hero, top
    // view) keeps +340 exactly; vertical faces get nothing from it either way.
    rimBack.position.y = tw.y + 340 + 560 * (1 - Math.min(1, Math.max(0, (c.pitch - 0.36) / 0.24)));
    rimBack.target.position.copy(tw); rimBack.target.updateMatrixWorld();
    // In the plan view "behind the subject" is below the plate, so the y above
    // parked this light straight overhead and its specular came back up the
    // camera axis: top face 50, flat. Raked 31.5 deg toward the far edge, the
    // lobe falls off across the face in perspective: 40 far -> 35 near, the one
    // depth cue a straight-down shot has. Intensity unchanged.
    {
      const topK = ramp(c.pitch, 1.05, 1.45);
      rimBack.position.x = lerp(rimBack.position.x, tw.x, topK);
      rimBack.position.y = lerp(rimBack.position.y, tw.y + 700 * Math.cos(0.55), topK);
      rimBack.position.z = lerp(rimBack.position.z, tw.z - 700 * Math.sin(0.55), topK);
    }
    // camera side, barely above the axis, offset sideways so the rail still has
    // a light end and a dark end rather than reading as one flat bar
    // BELOW the axis, not above it. At tw.y + 90 the light's world direction had
    // a +0.128 y component: it spilled onto the horizontal top slab and could
    // not reach any face that tilts downward. A 0.5 mm vertical scan of the
    // near rail measured a flat 40-45 down the wall and then 38/26/22/15 across
    // the last 1.5 mm — the bottom edge died into the page before the lip
    // caught it. Below the axis the dot on the top slab clamps to zero, so this
    // becomes a pure vertical-face control with no spill, and the bottom
    // chamfer comes into its cone. Blended back up for the top-down act, where
    // there is no rail in shot and the top face is all there is.
    const lowK = 1 - Math.min(1, Math.max(0, (c.pitch - 0.45) / 0.75));
    face.position.copy(tw).addScaledVector(_v, -640);
    face.position.y = tw.y + 90 - 300 * lowK;
    // Sideways in CAMERA space, swung with the yaw. As a world -x offset, the
    // hero's three-quarter camera (yaw -0.785) put this light on the short end
    // and grazed the long face: the float rail the reader is meant to see
    // rendered at median luma 15, black on the page. -cos(4*yaw) is -1 at yaw
    // 0, so every act from the top view on is identical to the old world -x
    // offset. Assumes yaw stays in [-0.785, 0], which the CAM keys do.
    const fSide = -300 * Math.cos(4 * c.yaw);
    face.position.x += fSide * Math.cos(c.yaw);
    face.position.z -= fSide * Math.sin(c.yaw);
    face.target.position.copy(tw); face.target.updateMatrixWorld();

    const turnOn = turnEnv;
    turnKey.visible = turnOn > 0.002;
    if (turnKey.visible) {
      turnKey.intensity = 1.00 * turnOn;
      const a = tum * 0.6, ca = Math.cos(a), sa = Math.sin(a);
      const dy = 0.74, dz = 0.50;                     // base elevation / front
      turnKey.position.set(tw.x + 320,
                           tw.y + (dy * ca - dz * sa) * 760,
                           tw.z + (dy * sa + dz * ca) * 760);
      turnKey.target.position.copy(tw); turnKey.target.updateMatrixWorld();
    }

    /* ---- act 1: title and cue ---- */
    // Gone before the part rises into it. Faded over the whole push-in, the
    // headline hung as a 26%-opacity ghost across the part at p = 0.05 (93 px
    // of overlap at 1440x810). The camera holds until 0.012, so by the time
    // the part reaches the type the type is under 20%.
    const titleOut = ramp(p, A.title[0] + 0.004, A.title[0] + 0.040);
    if (titleEl) {
      titleEl.style.opacity = 1 - titleOut;
      titleEl.style.transform = "translateX(-50%) translateY(" + (-20 * titleOut) + "px)";
    }
    if (cueEl) cueEl.style.opacity = 1 - ramp(p, 0.003, 0.028);

    /* ---- act 2/3: the holders fall in ---- */
    // One run on an even beat, left to right. The old (i % 5) stagger was keyed
    // to the manifest's row-by-row instance order, so the landings came out in
    // no spatial order and up to nine holders were in the air at once.
    //
    // Each one enters from JUST above the top of the frame, at every viewport.
    // A fixed 205 mm start sat ~1600 px above a 1440x810 frame, so two thirds of
    // every fall happened off screen and nothing visible occurred from 0.308 to
    // 0.345; at 390x844 the same 205 mm was ON screen and they appeared out of
    // thin air under the topbar. Clip coordinates are linear in height, so the
    // height that puts the cone's lowest point on the frame edge is solved
    // exactly from this frame's projection (view offset included). Needs the
    // camera.updateMatrixWorld above. Before the run there are simply none.
    // Only while one is in flight; outside the run every holder is either
    // hidden or seated and nothing below reads the solve. The 1e-6 keeps the
    // gate a strict superset of s < 1 at the floating-point boundary, so a
    // landing frame never reads the previous frame's projection.
    if (p >= A.fall[0] && p < A.fall[0] + 12 * FALL_BEAT + FALL_DUR + 1e-6) {
      _hM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(root.matrixWorld);
      _hU.set(0, 0, 1, 0).applyMatrix4(_hM);
    }
    // The contact quads ride the same beat: approach = how far down the fall
    // the holder is (1 - its height fraction), ring = scroll since touchdown
    // over SEAT_RING. -1 before the holder starts.
    let seatDirty = false;
    seat.visible = holders.length > 0 && p >= A.fall[0];
    holders.forEach(function (m, i) {
      const s = (p - (A.fall[0] + FALL_RANK[i] * FALL_BEAT)) / FALL_DUR;
      if (seat.visible) {
        const ax = s < 0 ? -1 : (s < FALL_LAND ? 1 - fallHeight(s) : 1);
        const cy = s < FALL_LAND ? (s < 0 ? -1 : 0)
                 : Math.min(1, (s - FALL_LAND) * FALL_DUR / SEAT_RING);
        const o = i * 8;
        if (seatK[o] !== ax || seatK[o + 1] !== cy) {
          for (let k = 0; k < 8; k += 2) { seatK[o + k] = ax; seatK[o + k + 1] = cy; }
          seatDirty = true;
        }
      }
      m.visible = s >= 0;
      if (!m.visible) return;
      const r = m.userData.rest, b = m.userData.bore;
      let z = 0;
      if (s < 1) {
        // the bottom of the basket, 7.62 mm under the flange's seat
        _hC.set(b[0], b[1], -7.62, 1).applyMatrix4(_hM);
        const top = Math.min(420, Math.max(30, (FALL_NDC * _hC.w - _hC.y) / (_hU.y - FALL_NDC * _hU.w)));
        z = top * fallHeight(s);
      }
      // They cross the caption on the way down; the HUD draws over them, so
      // they pass behind the type and it reads as depth, not as a collision.
      m.position.set(r.x, r.y, r.z + z);
    });
    if (seatDirty) seat.geometry.attributes.aK.needsUpdate = true;

    /* ---- act 4: air chamber ---- */
    if (airBoxes.length) {
      const a = ramp(p, A.airHold[0] - 0.026, A.airHold[0] + 0.014) *
                (1 - ramp(p, A.airHold[1] - 0.010, A.airHold[1] + 0.024));
      // Faint fill, strong edges: the volume is legible from its wireframe and
      // the fill only has to tint it. The volumes are drawn before the plate
      // (renderOrder -1) and seen THROUGH its translucent shell, so the numbers
      // are higher than the on-screen tint: 0.24 fill under a 0.62 shell reads
      // like 0.07 did when the volume was painted over the shell.
      // Below 0.002 they cannot change a bit in a 24-bit framebuffer, and they
      // were being submitted — four draw calls, half of acts 1 and 2's total —
      // through every frame of the story at opacity 0.
      // The fill front, keyed to the hold so it follows any retiming of it. It
      // runs while the shell is already see-through (sh below): started with
      // `a`, the slice crossed the first leg behind a shell still 85% opaque.
      SCAN.value = ramp(p, A.airHold[0] - 0.016, A.airHold[0] + 0.022);
      const sh = ramp(p, A.airHold[0] - 0.026, A.airHold[0] - 0.002) *
                 (1 - ramp(p, A.airHold[1] - 0.010, A.airHold[1] + 0.024));
      const on = a > 0.002;
      airBoxes.forEach(function (b) {
        b.visible = on;
        b.userData.edge.visible = on;
        b.material.opacity = 0.24 * a;
        b.userData.edge.material.opacity = 1.0 * a;
      });
      // The plate keeps writing depth throughout: visibility follows `a`
      // continuously both ways, and the holders and the shell occlude each
      // other correctly instead of the baskets painting over the slab.
      // sh >= a everywhere (same start and exit, shorter entry), so the
      // shell is transparent whenever a volume is drawn.
      MAT[0].transparent = sh > 0.002;
      MAT[0].opacity = 1 - 0.62 * sh;
    }

    /* ---- the accent rim: whatever the caption is talking about ---- */
    // Ramped in and out well inside each caption's own window, so the rim is
    // already there when the sentence arrives and gone before the next one.
    function rimAt(a, b, peak) {
      return peak * ramp(p, a - 0.022, a + 0.020) * (1 - ramp(p, b - 0.026, b + 0.016));
    }
    // Peaks are per-part because the rim is a function of grazing angle, not of
    // size: a small, strongly curved part like a holder presents most of its
    // surface at a grazing angle and floods, while a big flat plate barely
    // catches it at all.
    // The bores are marked by the DOM rings; at 1.05 the rim drew a second,
    // offset crescent on each bore wall inside the ring, and while the camera
    // was still tilting it lit the edge-on front face as a purple bar along the
    // plate's bottom edge (p 0.13-0.16 and 0.26-0.28). Gated on the camera being
    // at the top, and kept to a sheen on the wall.
    // The rails cannot use rimAt's generic tail. It would run to 0.618, and the
    // turn resumes at the end of the hold: the rim lit the top edge as a purple
    // band at p 0.600 and flooded the grazing face at 0.605, on the fastest
    // part of the spin, with the caption already gone. The rim holds full
    // through the hold and fades in step with caption 03's type (0.582-0.602),
    // so the return turn runs as a clean black part.
    const railRim = 0.80 * ramp(p, 0.508, 0.550) *
                    (1 - ramp(p, A.airHold[1] + 0.002, A.airHold[1] + 0.020));
    MAT[0].userData.rim.value = Math.max(rimAt(0.150, 0.262, 0.20) * ramp(c.pitch, 1.40, 1.49),   // the bores
                                         railRim);                     // the rails
    // both terms are 0 at 0.40, so the switch is never seen
    MAT[0].userData.rimMask.value = p > 0.40 ? 1 : 0;
    MAT[2].userData.rim.value = rimAt(0.314, 0.448, HOLDER_RIM_PEAK); // the holders (edge light)
    // the handles, plus a kick as they let go. The old +1.25 spike on top of
    // 0.85 took the handle to near-white: the release is carried by the sweep
    // and the shockwave now, and the rim only kicks by a third.
    // It outlasts the caption on purpose: the handles are what is moving.
    // The re-seat is the release's bookend: the lilac rim rides the handle all
    // the way home and lets go ON the click (h1-0.002 .. h1+0.012, gone by
    // 0.790, before the water is up), with a short discharge flash through the
    // whole part at about half the release's strength.
    const h0 = A.hOut[0], h1 = A.hBack[1];
    const kick = Math.exp(-Math.pow((p - h0 - 0.002) / 0.006, 2));
    const click = Math.exp(-Math.pow((p - h1 - 0.001) / 0.0035, 2));
    MAT[1].userData.rim.value = 0.85 * ramp(p, 0.632, 0.674) * (1 - ramp(p, h1 - 0.002, h1 + 0.012))
                              + 0.30 * kick + 0.45 * click;
    // The charge: on just before the release, full while the handle starts to
    // rise, and handed back to the plain rim as the handle reaches full
    // extension. MAT[1].color was re-copied from MAT_C above this frame, so the
    // multiply does not accumulate.
    const charge = ramp(p, h0 - 0.006, h0 + 0.004) * (1 - ramp(p, h0 + 0.014, h0 + 0.044))
                 + 0.60 * click;   // the seat's discharge
    MAT[1].userData.charge.value = 0.55 * charge;
    MAT[1].color.multiplyScalar(1 - 0.42 * charge);

    /* ---- act 5: handles ---- */
    // A snap-fit lets go all at once and seats all at once, so neither move is
    // a symmetric smoothstep (which eased them out of the slot from rest, 2% of
    // the travel at 0.658 while the shockwave was already half way out).
    // Out: a short press into the slot while the charge builds, then an
    // ease-OUT pop, at full speed on the instant of release and settling at
    // full extension. The lean rides the same curve plus a u^2(1-u)^2 swing
    // that peaks about 11% past the resting 0.30 rad (at 0.684) and comes back
    // with zero slope by 0.700; the LIFT never overshoots, because the lift is
    // what reaches the caption band. In: an ease-IN, so the handle arrives
    // moving and stops dead in the slot on the re-seat glint at hBack[1].
    const uo = clamp01((p - h0) / (A.hOut[1] - h0));
    const ub = clamp01((p - A.hBack[0]) / (h1 - A.hBack[0]));
    const popO = 1 - (1 - uo) * (1 - uo) * (1 - uo);
    const seatB = ub * ub;
    const outH = popO * (1 - seatB);
    const lean = (popO + 3.0 * uo * uo * (1 - uo) * (1 - uo)) * (1 - seatB);
    // (1 - popO) hands the press over to the pop continuously, and keeps it
    // at 0 through the hold and the seat.
    // After the seat, a 0.6 mm give into the slot and back (0 at h1 and h1+0.010),
    // so the stop-dead ease-in lands with a felt click.
    const press = -0.7 * ramp(p, h0 - 0.010, h0) * (1 - popO)
                - 0.6 * Math.sin(Math.PI * clamp01((p - h1) / 0.010));
    // Shockwave: out across the top face on release, and a smaller one on the
    // re-seat. Both are pure functions of p.
    const eo = clamp01((p - h0) / 0.034), es = clamp01((p - h1) / 0.022);
    let sA = 0, sR = 0;
    if (eo > 0 && eo < 1) {
      sR = 3 + 36 * (1 - Math.pow(1 - eo, 2.4));
      // a short attack: at full strength on frame one the ring and the flash
      // stacked past 1.0 at the slot and clipped to a white blob
      sA = 1.7 * Math.pow(1 - eo, 1.7) * ramp(eo, 0.0, 0.12);
    } else if (es > 0 && es < 1) {
      // big enough to clear the handle foot and reach the nearest holders, still
      // smaller than the release's 39 mm / 1.7; a short attack like the release
      sR = 3 + 24 * (1 - Math.pow(1 - es, 2.0));
      sA = 1.35 * Math.pow(1 - es, 1.6) * ramp(es, 0.0, 0.10);
    }
    const sCore = 0.38 * Math.exp(-Math.pow((p - h0 - 0.002) / 0.004, 2))
                + 0.28 * Math.exp(-Math.pow((p - h1 - 0.002) / 0.004, 2));
    shockMat.uniforms.uR.value = sR;
    shockMat.uniforms.uA.value = sA;
    shockMat.uniforms.uCore.value = sCore;
    shock.visible = sA > 0.004 || sCore > 0.004;
    // Sweep: charges at the slot just before the release, then runs the
    // height of the handle in 0.030 of scroll, the first two thirds of the
    // handle's own rise, and fades as it leaves the top.
    const sw = clamp01((p - h0) / 0.030);
    MAT[1].userData.sweepZ.value = p < h0 ? -3 : -3 + 38 * (1 - Math.pow(1 - sw, 1.6));
    MAT[1].userData.sweep.value = p < h0
      ? 1.2 * ramp(p, h0 - 0.010, h0)
      : 1.9 * Math.pow(1 - sw, 1.5);
    handles.forEach(function (m) {
      const r = m.userData.rest, d = m.userData.dir;
      // A short diagonal — out and up — and a lean onto that same diagonal.
      // The LIFT is what decides whether the handle reaches the caption band:
      // measured at 1512x620, the top corner clears #panel by -13.5 px at a
      // 13 mm lift and +5.5 px at 9 mm, while the horizontal extent barely
      // moves across that whole sweep (max ndc x 0.435 -> 0.440). Lowering the
      // lift is free sideways, so the lift is where the reduction is spent.
      m.position.set(r.x + d * 10 * outH, r.y, r.z + 9 * outH + press);
      // POSITIVE d: verified on the running page — for the +x pivot,
      // Vector3(0,0,1).applyQuaternion(piv.quaternion).x = +0.3335, i.e. the
      // top leans away from the plate centre, along the travel.
      m.rotation.y = d * 0.30 * lean;
    });

    /* ---- act 7: light, shoots, roots ---- */
    const growU = ramp(p, A.grow[0], A.grow[1]);
    sun.intensity = 0.55 * ramp(p, A.grow[0] - 0.02, A.grow[1] - 0.02);
    // three.js still uploads and evaluates a zero-intensity light in every
    // shader; an invisible one is skipped when the lights state is built.
    sun.visible = sun.intensity > 0.001;
    // 0.40, not 0.62. At 0.62 it re-lit the matte plate's front face on the
    // water (studio 42-48 -> 53-64) and, with the sun, made the grey handles
    // the brightest thing in the shot. 0.40 still separates the rail from the
    // water behind it.
    bounce.intensity = 0.40 * dropU;
    bounce.visible = bounce.intensity > 0.001;
    // On the reservoir the camera is nearly level with the top face, and at
    // grazing incidence the studio environment reflected off it clipped to
    // white — a mirror lid on a matte printed part. The studio box is not the
    // right environment out here anyway.
    MAT[0].envMapIntensity = 0.58 - 0.30 * wetU;
    MAT[0].roughness = 0.60 + 0.20 * wetU;
    MAT[1].envMapIntensity = 0.85 - 0.30 * wetU - 0.40 * duck02;   // act 02 duck, see duck02
    // The last beat sinks through the surface. Roots under a raft cannot be
    // seen from a camera above the water at any framing — the plate is in the
    // way — so this is the only shot in which they exist.
    const dive = ramp(p, 0.952, 1.000);
    // Atmospheric perspective on the reservoir. The far water used to arrive as
    // a hard horizontal rule across the top of the frame the instant its opacity
    // came off zero; with a little fog the surface dissolves into the page
    // instead, which is also the only thing in the shot giving the reservoir a
    // sense of distance. Density is tiny — at the raft's 330 mm it is a 5%
    // wash, at 5 m it is half, at 20 m it is gone.
    // ramped in AHEAD of the water's own opacity, so the far surface is already
    // hazed the moment it becomes visible — otherwise it arrives as a hard
    // horizontal rule across the top of the frame and only softens later
    const haze = 0.00019 * ramp(p, A.drop[0] - 0.045, A.drop[0] + 0.020) * (1 - dive);
    // The reservoir comes up from under the raft OUTWARD. With both water
    // meshes fading in uniformly, the far ring (grazing, so Fresnel-opaque)
    // and the thin crescent where it overlaps the square grid out-drew the
    // near surface for ~0.02 of scroll: a hazy floating band with a curved
    // lower edge, black above and below, while the camera was still high.
    // Now a soft front (fade from r to 2.2 r of camera distance) runs out
    // from 350 mm at the wet threshold and reaches infinity exactly at
    // drop[0] + 0.02, the end of the haze ramp: the grid's far edge
    // (~1590 mm) is crossed only around p 0.807, once the near water has
    // body. Written as 1/r so the last frames converge to exactly 0 (no
    // fade, and no huge float in the shader); p >= 0.820 is untouched.
    waterReveal.value = Math.max(0, 1 - Math.max(0, p - (A.drop[0] - 0.020)) / 0.040) / 350;
    scene.fog.color.copy(FOG_WET).lerp(FOG_DIVE, dive);
    scene.fog.density = haze + 0.0021 * dive;
    // A surface is a polygon and looks like one when you graze it: crossing it
    // resolved the 92-row displaced grid into a stack of horizontal lines
    // across the frame (verified by ablation — hiding the two water meshes
    // removes them and nothing else does). Fade it out through the crossing,
    // keyed to the camera's actual height above the plane.
    //
    // Gated on a window, not multiplied by dive: the camera meets the plane at
    // p = 0.968, where dive is still 0.23, so the old product left the surface
    // at ~75% on the crossing frame and its grid streaked across the frame. The
    // gate is 0 for p <= 0.948, so every above-water act is untouched.
    //
    // One-sided: the fade is complete AT the plane and stays complete below
    // it. Seen from under, every ray in this shot leaves the camera at under
    // 30 deg of elevation, past the 41.4 deg edge of Snell's window (critical
    // angle 48.6 deg from the normal), so the surface is a mirror of the dark
    // water and never the lit sheet the plane drew — that sheet framed between
    // the rails was the pale slab hanging across the roots.
    // sunk: 0 at the surface, 1 at 45 mm under. The one depth variable for
    // anything that takes over from the surface below it.
    const sunk = Math.min(1, Math.max(0, (WATER_Y - camera.position.y) / 45));
    const above = camera.position.y > WATER_Y;
    // Complete by 6 mm above the plane, eased from 26 mm (the height the water
    // hold ends at). A linear 40 mm fade still left 10-15% of the grid 5 mm
    // up, and at that height its rows read as thin lines across the frame.
    const graze = ramp(p, 0.948, 0.958)
                * (1 - ramp(camera.position.y - WATER_Y, 6, 26));
    if (water) {
      water.material.opacity *= (1 - 0.42 * dive) * (1 - graze);
      // Not drawn once it has faded out: at opacity 0 the plane was still a
      // full-frame lit PBR draw, blended, for the whole underwater shot. The
      // wave update is skipped with it (CPU, 93x93 vertices + upload).
      water.visible = waterFar.visible = wet && graze < 0.999;
      if (water.visible) updateWater(T, energy);
    }
    // The water body takes over from the surface on the SAME ramp the surface
    // fades out on, so no frame of the crossing has neither. While the camera
    // is above the plane it fills only the rays below the horizon; the sky
    // side fills in over the first 14 mm under, and the lit underside and its
    // shafts over the first 50 mm (sunk runs 0..45 mm).
    const uu = under.material.uniforms;
    uu.uSub.value = graze;
    under.visible = graze > 0.002;
    if (under.visible) {
      const below = WATER_Y - camera.position.y;
      uu.uUp.value = Math.min(1, Math.max(0, below / 14));
      uu.uLit.value = ramp(sunk, 0, 1);
      uu.uT.value = T;
      uu.uRes.value.set(canvas.width, canvas.height);
      // fog is mixed after the output encoding; decode, so re-encoding lands on it
      uu.uDeep.value.copy(scene.fog.color).convertSRGBToLinear();
      under.position.copy(camera.position);
    }
    // The surface plane (see its build). From above, at a grazing angle, a real
    // surface is nearly all reflection: 0.85 sinks the submerged hull into the
    // water under a crisp waterline and leaves the roots a dim shape below
    // it, so they are revealed as the camera goes under. Its alpha takes the
    // canvas-foot fade only over the last 8 mm above the plane: higher up, the
    // submerged hull and the roots sit in exactly the bottom third that fade
    // empties, and the veil did nothing there. From below (VEIL_UNDER, so the black
    // plate and the grey handles stay legible through it) it writes depth and is drawn
    // before the roots and the bubbles, so the handles and the canopy above
    // the waterline are seen through the underside of the surface instead of
    // standing in open water. Just under the plane uUp is 0 and it is clear, so
    // nothing pops at the crossing: it thickens over the same 14 mm the sky
    // side fills in on. Side, draw slot and depth write follow the camera's
    // side of the plane, a pure function of p.
    surfUnder.visible = under.visible;
    if (surfUnder.visible) {
      const su = surfUnder.material.uniforms;
      surfUnder.rotation.x = above ? Math.PI / 2 : -Math.PI / 2;
      surfUnder.position.set(camera.position.x, WATER_Y, camera.position.z);
      surfUnder.renderOrder = above ? -1.5 : -5;
      surfUnder.material.depthWrite = !above;
      su.uVeil.value = above ? 0.85 : VEIL_UNDER;
      su.uVeilE.value = above ? 0 : 1;
      su.uFootK.value = above ? 1 - Math.min(1, (camera.position.y - WATER_Y) / 8) : 1;
    }
    // Bubbles come in with the lit underside, once the camera is under: from
    // ~2 mm to ~40 mm below the plane. Above it the dive is still a cutaway
    // waterline, and air rising in it would read as an effect, not as water.
    const bu = bubbles.material.uniforms;
    bu.uOp.value = ramp(sunk, 0.04, 0.90);
    bubbles.visible = bu.uOp.value > 0.004;
    if (bubbles.visible) {
      bu.uT.value = T;
      bu.uFog.value = scene.fog.density;
      bu.uRes.value.set(canvas.width, canvas.height);
      // device px per mm at unit depth: buffer height / (2 tan(fov/2))
      bu.uScale.value = canvas.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    }
    renderer.toneMappingExposure = 0.96 + 0.14 * ramp(p, A.grow[0], A.grow[1]) - 0.12 * dive;
    LEAF_T.value = T;
    shoots.forEach(function (s) {
      const d = s.userData;
      const u = ramp(growU, d.t0 * 0.42, d.t0 * 0.42 + 0.55);
      // Under the surface the canopy is seen through the surface plane: drawn
      // before it there, so it is veiled with the handles instead of blinking
      // out in a single step at the crossing (p 0.967 -> 0.968).
      s.visible = u > 0.002;
      s.renderOrder = above ? 3 : -6;
      if (!s.visible) return;
      // Growth is carried by SCALE, never by fading against alphaTest (that
      // clips a plant into a hard cut-out). The head also OPENS as it grows: a
      // sprout is a narrow upright tuft, and its spread catches up with its height.
      const sway = Math.sin(T * d.sway + d.ph);
      const H = d.h * Math.pow(u, 0.7);
      const S = H * d.w * (0.55 + 0.45 * u);
      s.scale.set(S, S, H);
      s.rotation.z = d.base;                // any yaw: a head is round now, not a card
      s.rotation.y = 0.035 * sway * u;      // and the sway tilts it across the frame
    });
    // Roots run on their OWN window, carried into the dive. Driven off growU
    // the last-started root's window ran to 1.16 of a parameter that saturates
    // at 1.0, so it froze at ramp(0.733) = 0.825 and stayed there: measured at
    // p = 1.000, seven of thirteen were short — 0.829, 0.835, 0.923, 0.960,
    // 0.966, 0.984, 0.998 — permanently, in the one shot the roots exist for.
    // The last one now finishes exactly at 1.000, and growth still happening
    // as the camera sinks past is the better read anyway: the roots should be
    // reaching for the water the reader is descending into.
    ROOT_T.value = T;
    // Seen from above, the roots are behind the surface and a water column:
    // at full value they glowed white under the raft. They brighten as the
    // camera goes under.
    ROOT_L.value = 0.30 + 0.52 * dive;
    // the water column (see ROOT_SEEN): lifted as the lens comes down its last
    // 26 mm to the plane, and handed to the in-water extinction as it crosses
    ROOT_SEEN.value = Math.min(1, Math.max(0, (camera.position.y - WATER_Y) / 26));
    ROOT_X.value = ramp(p, 0.962, 0.985);
    // Into the dark at the canvas foot with the water body and the bubbles, so
    // the stage releases onto the record with no strand cut by its bottom edge.
    ROOT_FOOT.value.set(1 / canvas.height, dive);
    ROOT_DEEP.value.copy(scene.fog.color).convertSRGBToLinear();
    if (ROOT_X.value > 0) {
      // camera to raft centre, scalars only
      const rdx = camera.position.x - root.position.x, rdy = camera.position.y - root.position.y,
            rdz = camera.position.z - root.position.z;
      ROOT_REF.value = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);
    }
    const rootU = ramp(p, A.grow[0], 0.994);
    roots.forEach(function (r) {
      const d = r.userData;
      const st = 0.22 + d.t0 * 0.30;                 // last start 0.520
      const u = ramp(rootU, st, st + 0.480);         // last end 1.000 exactly
      r.visible = u > 0.002;
      if (!r.visible) return;
      // The front runs down every strand by arc length (1.09 clears the
      // longest strand plus its taper at u = 1), with a little stretch as well
      // so the mass does not read as being uncovered. No yaw: every ribbon is
      // built facing the camera.
      d.grow.value = u * 1.09;
      r.scale.set(1, 1, 0.70 + 0.30 * u);
    });

    // Sky mask for the page starfield behind this transparent canvas (read by
    // js/atmos.js): the screen height of the reservoir's horizon, how far the
    // water is in, and how far the camera has gone under. Three numbers, no DOM.
    // `wet`, not water.visible: the surface stops drawing 6 mm above the plane,
    // and gating on it held a stale horizon across those frames.
    if (water && wet && camera.position.y > WATER_Y + 1) {
      _hz.set(camera.position.x, WATER_Y, camera.position.z - 40000).project(camera);
      window.__atmosSky = 0.5 - 0.5 * _hz.y;
    }
    // Keyed to `wet`, not to water.visible: the surface now stops drawing at the
    // crossing, and reading visibility here dropped the star mask to 0 there,
    // popping stars back into the lower frame until __atmosDeep caught up.
    window.__atmosWet = water && wet ? ramp(p, A.drop[0] - 0.02, A.drop[0] + 0.03) : 0;
    window.__atmosDeep = Math.min(1, Math.max(0, (WATER_Y + 2 - camera.position.y) / 24));

    placeCaption(p);
    placeRings(p, w, h);
  }

  function placeRings(p, w, h) {
    const rv = ramp(p, A.marks[0], A.marks[0] + 0.028) * (1 - ramp(p, A.marks[1] - 0.030, A.marks[1]));
    RINGS.forEach(function (r) {
      const stag = ramp(p, A.marks[0] + r.delay, A.marks[0] + r.delay + 0.02);
      const o = rv * stag;
      if (o < 0.004) { r.el.style.opacity = 0; return; }
      const a = project(r.at[0], r.at[1], r.at[2], w, h);
      const b = project(r.at[0] + 5.63, r.at[1], r.at[2], w, h);
      // arrives 1.6x wide and closes onto the bore lip as it fades up; stag is
      // exactly 1 once seated, so the hold's registration is untouched
      const px = Math.max(6, Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) * (1 + 0.6 * (1 - stag));
      r.el.style.opacity = o;
      r.el.style.left = a[0] + "px"; r.el.style.top = a[1] + "px";
      r.el.style.width = px + "px"; r.el.style.height = px + "px";
    });
  }

  // Set from the first frame rather than waiting on the observer: in a hidden
  // or backgrounded tab IntersectionObserver delivery is deferred, and the
  // story is this page's primary content anyway.
  document.body.classList.add("story-on");
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { measure(); onScroll(true); });
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(canvas);
  measure();
  onScroll(true);
  draw();

  window.__story = {
    to: function (v) {
      window.scrollTo(0, story.offsetTop + v * (story.offsetHeight - window.innerHeight));
      measure(); onScroll(true); step(false); return p;
    },
    at: function (v, t) {
      // The live loop still ticks between capture calls; zero the spring so it
      // has nothing to carry and p stays exactly v.
      p = pTarget = pLast = Math.min(1, Math.max(0, v)); pVel = 0;
      if (t !== undefined) elapsed = t;
      step(false); return p;
    },
    step: step, p: function () { return p; },
    scene: scene, camera: camera, root: root
  };
})();
