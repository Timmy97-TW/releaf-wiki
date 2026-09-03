// Photometer — scroll-driven disassembly.
//
// Timeline (in beats):
//   [0 .. HERO]          the complete instrument, large and centered
//   [HERO .. ]           it shrinks and settles into the lower half
//   then one beat each:  lift out → hold and spin → dissolve
//   [FINALE_START .. ]   everything returns, large and centered again
//
// The eight part STLs share one coordinate system, so the assembly is built
// from the parts themselves — what comes apart on screen is the real model.

(function () {
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("gl");
  const track = document.getElementById("track");
  const loader = document.getElementById("loader");
  const loadPct = document.getElementById("load-pct");
  const panelL = document.getElementById("panel-l");
  const panelR = document.getElementById("panel-r");
  const heroEl = document.getElementById("hero-card");
  const finaleEl = document.getElementById("finale");
  const buildEl = document.getElementById("build-step");
  let buildIndex = -1;
  const rail = document.getElementById("rail");
  const counter = document.getElementById("counter");
  const bar = document.getElementById("bar");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Shared spin. The assembly and every featured part use the same axis and
  // rate, so nothing appears to turn at its own pace.
  // DiOPAL is almost entirely flat plates. A full revolution sweeps every one of
  // them edge-on twice a turn, which hides the part at the moment you are being
  // asked to look at it. Rocking instead keeps the motion and the sense of depth
  // but never presents an edge. The rig and every featured part read the same
  // `spin`, so they stay locked together whichever way it is driven.
  const OSC_AMP = 42 * Math.PI / 180;   // radians either side of centre
  const OSC_PERIOD = 11;                // seconds for a full there-and-back

  // This CAD is Z-up, unlike the photometer's Y-up. Every geometry is rolled a
  // quarter turn about X at load so +Z becomes +Y, and the rest of the engine —
  // the size calculation, the spin axis, the layout — works unchanged.
  const Z_UP_CAD = true;

  // The base plate is drawn flat, so no standing correction is needed here.
  // (Applied inside the spin, Euler order YZX, if it ever is.)
  const STAND = 0;

  // The 3/4 view comes from raising the camera, not from tilting the object,
  // which would drag the feet off the ground plane as it turns.
  const CAM_DIST = 285;
  const CAM_ELEV = 0.175;

  const BEAT = 0.38;          // viewport-heights of scroll per beat
  const HERO = 0.9;
  const PART_START = HERO + 0.7;
  const N = PARTS.length;
  const LAST_GONE = PART_START + (N - 1) + 0.22;

  // After the walkthrough the instrument is built back up in the order it really
  // goes together: board and LED holder up from underneath, then the base closes
  // the bottom, then the sliders in from the sides, then the tube holder on top.
  const FINALE_START = LAST_GONE + 0.05;
  const ASM_STEPS = 5;
  const ASM_STEP = 0.85;                       // beats per step
  const FINALE_SPAN = ASM_STEPS * ASM_STEP;
  const TOTAL = FINALE_START + FINALE_SPAN + 0.7;

  const BUILD_CAPTIONS = [
    ["Housing", "The frame it all goes into"],
    ["Board &amp; LED holder", "Slide up from underneath"],
    ["Base plate", "Closes the bottom"],
    ["Sliders", "In from both sides — no tools"],
    ["Tube holder", "Drops in on top"],
  ];

  track.style.height = (TOTAL * BEAT + 1) * 100 + "vh";

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  // Filmic response: highlights roll off instead of clipping to white, which is
  // most of the difference between a viewer and a product shot.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 6000);
  camera.position.set(0, CAM_DIST * Math.sin(CAM_ELEV), CAM_DIST * Math.cos(CAM_ELEV));
  camera.lookAt(0, 0, 0);

  // ---------- image-based lighting ----------
  // A softbox studio painted into a canvas and prefiltered, so the parts pick up
  // real gradients across their surfaces rather than flat directional shading.
  function studioEnvironment() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d");

    g.fillStyle = "#0a0c10";
    g.fillRect(0, 0, 512, 256);

    // overall sky-to-floor falloff
    // The floor is deliberately not black — it is the only fill the underside of
    // a part receives, and without it shadow sides crush to solid black.
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0.00, "#6e7987");
    sky.addColorStop(0.45, "#3d444f");
    sky.addColorStop(1.00, "#1b1f26");
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 256);

    function blob(x, y, r, color, alpha) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = alpha;
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.globalAlpha = 1;
    }
    blob(150, 55, 130, "#ffffff", 0.95);   // key softbox
    blob(390, 95, 105, "#cddcf0", 0.55);   // cool fill
    blob(300, 190, 120, "#46e08f", 0.26);  // warm bounce, echoes the LED
    blob(40, 150, 90, "#8fa2bb", 0.30);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }
  scene.environment = RQ.studioEnv(renderer);

  // Light kit sits on top of the environment for shape definition only.
  const key = new THREE.DirectionalLight(0xfff6ec, 0.38);
  key.position.set(80, 130, 150);
  scene.add(key);
  // Self-shadowing: parts shadow each other so crevices and overhangs read as
  // depth. No ground plane — that would light them better still but would
  // change compositions that are already framed.
  RQ.enableShadows(renderer, key);
  const rimWarm = new THREE.DirectionalLight(0x46e08f, 0.30);
  rimWarm.position.set(120, -40, -130);
  scene.add(rimWarm);
  const rimCool = new THREE.DirectionalLight(0xbcd0e6, 0.30);
  rimCool.position.set(-110, 40, -140);
  scene.add(rimCool);

  // ---------- pedestal glow ----------
  // A soft pool of light under the assembly. On a dark stage this reads as
  // weight far better than a cast shadow, which would need a visible floor.
  function glowSprite() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0.00, "rgba(150,240,190,0.22)");
    rg.addColorStop(0.35, "rgba(110,220,165,0.08)");
    rg.addColorStop(1.00, "rgba(90,210,150,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, opacity: 0.9,
    });
    const s = new THREE.Sprite(mat);
    s.renderOrder = -1;
    return s;
  }
  const glow = glowSprite();
  scene.add(glow);

  // ---------- materials ----------
  // `base` is the material's own opacity. Anything below 1 is glass-like and
  // always goes through the transparent pass; the rest only do so while a part
  // is dissolving.
  // Printed-part colours are the actual filaments: black box and LED holder,
  // grey base and sliders, white tube holder.
  const MATERIALS = {
    printed: function () { return MATERIALS.grey(); },
    black: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x121417, metalness: 0.10, roughness: 0.504, envMapIntensity: 0.810 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    grey: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x6a6f77, metalness: 0.12, roughness: 0.475, envMapIntensity: 0.972 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    white: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0xd9dbdd, metalness: 0.05, roughness: 0.533, envMapIntensity: 0.945 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    pcb: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x1d5c3a, metalness: 0.16, roughness: 0.396, envMapIntensity: 1.080 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    ledGreen: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x2f7a45, emissive: 0x38ff6a, emissiveIntensity: 0.7,
        metalness: 0.0, roughness: 0.216, envMapIntensity: 0.675 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    ledRed: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x8a3b32, emissive: 0xff5a4a, emissiveIntensity: 0.7,
        metalness: 0.0, roughness: 0.216, envMapIntensity: 0.675 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    // Real refraction rather than alpha blending. Against a dark background a
    // half-opaque object just reads as dim grey — and because `opacity` scales
    // specular too, it also kills the highlights that make glass legible.
    // Transmission keeps opacity at 1, so the rim and reflections stay crisp.
    // envMapIntensity is pushed well past the solids', and a little emissive
    // keeps the edges legible — the studio is dark, so there is not much for
    // glass to reflect on its own.
    glass: function () {
      return { base: 1, glass: true, mat: new THREE.MeshPhysicalMaterial({
        color: 0xeaf4ff, metalness: 0, roughness: 0.02,
        transmission: 0.86, ior: 1.5,
        transparent: true, opacity: 1, envMapIntensity: 3.4,
        clearcoat: 1, clearcoatRoughness: 0.02,
        emissive: 0x93bce4, emissiveIntensity: 0.30,
        side: THREE.DoubleSide, depthWrite: false }) };
    },
    clear: function () {
      return { base: 1, glass: true, mat: new THREE.MeshPhysicalMaterial({
        color: 0xf0f6ff, metalness: 0, roughness: 0.05,
        transmission: 0.92, ior: 1.46,
        transparent: true, opacity: 1, envMapIntensity: 3.0,
        clearcoat: 1, clearcoatRoughness: 0.03,
        emissive: 0x9dc0e2, emissiveIntensity: 0.13,
        side: THREE.DoubleSide, depthWrite: false }) };
    },
    amber: function () {
      return { base: 1, glass: true, mat: new THREE.MeshPhysicalMaterial({
        color: 0xffab34, metalness: 0, roughness: 0.10,
        transmission: 0.62, ior: 1.55,
        transparent: true, opacity: 1, envMapIntensity: 1.5,
        clearcoat: 1, clearcoatRoughness: 0.04,
        emissive: 0xff8a00, emissiveIntensity: 0.42,
        side: THREE.DoubleSide, depthWrite: false }) };
    },
  };

  // ---------- the array ----------
  // The 24 LEDs are not in the CAD yet, so they are built here from the grid
  // measured off the LED holder. Tier brightness is set by PWM in the real
  // instrument, not by the LEDs themselves — the matched groups all emit within
  // a few percent — so the three tiers are shown as three brightness levels.
  // Wide separation on purpose: the three tiers are the point of the instrument,
  // so they have to be unmistakable at a glance.
  const TIER_GLOW = { Low: 0.16, Mid: 0.62, High: 1.55 };
  const TIER_HALO = { Low: 0.16, Mid: 0.42, High: 0.85 };

  // soft round sprite, reused by every LED halo
  function haloTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0.00, "rgba(255,255,255,1)");
    rg.addColorStop(0.25, "rgba(255,255,255,0.35)");
    rg.addColorStop(1.00, "rgba(255,255,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const HALO_TEX = haloTexture();

  function buildLedArray() {
    const group = new THREE.Group();
    const mats = [];
    // A 5 mm LED: short barrel with a domed top, pointing up (+Y once rolled).
    const barrel = new THREE.CylinderGeometry(2.5, 2.5, 7, 20);
    const dome = new THREE.SphereGeometry(2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(0, 3.5, 0);

    CHANNELS.forEach(function (ch) {
      GRID.rows.forEach(function (ry) {
        const preset = (ch.hue === "green" ? MATERIALS.ledGreen : MATERIALS.ledRed)();
        preset.mat.emissiveIntensity = TIER_GLOW[ch.tier];
        const led = new THREE.Group();
        led.add(new THREE.Mesh(barrel, preset.mat));
        led.add(new THREE.Mesh(dome, preset.mat));

        // a halo above each LED — this is what actually sells the tier difference
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: HALO_TEX,
          color: ch.hue === "green" ? 0x4dff7a : 0xff5f4a,
          transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: TIER_HALO[ch.tier],
        }));
        halo.scale.setScalar(15);
        halo.position.y = 5;
        halo.renderOrder = 900;
        led.add(halo);
        // CAD (x, y, z) → rolled (x, z, -y); LEDs sit in the holder bores
        led.position.set(ch.x, 58, -ry);
        group.add(led);
        mats.push({
          mat: preset.mat, base: 1, glass: false,
          c0: preset.mat.color.clone(),
          e0: preset.mat.emissive.clone(),
          env0: preset.mat.envMapIntensity,
          emi0: preset.mat.emissiveIntensity,
        });
      });
    });
    return { group: group, mats: mats };
  }

  // Registers a code-built part the same way a loaded one is: centred on its own
  // bounds, with its assembled home remembered so it still sits in the stack.
  function buildProcedural(part, index) {
    const built = part.procedural === "ledArray" ? buildLedArray() : null;
    if (!built) return;

    const box = new THREE.Box3().setFromObject(built.group);
    const home = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(home);
    box.getSize(size);

    // shift children so the group turns about its own middle
    built.group.children.forEach(function (c) { c.position.sub(home); });

    const dia = Math.hypot(size.x, size.z);
    const vert = size.y * Math.cos(STAND) + dia * Math.abs(Math.sin(STAND));
    const span = Math.max(dia, vert);

    scene.add(built.group);
    const anchor = new THREE.Object3D();
    rig.add(anchor);

    items[index] = {
      part: part, obj: built.group, mats: built.mats, anchor: anchor,
      home: home, span: span, box: box,
    };
    if (layersDone === layerTotal) { layout(); ready = true; loader.classList.add("hide"); }
  }

  // ---------- rig ----------
  const rig = new THREE.Group();
  scene.add(rig);

  const stlLoader = new THREE.STLLoader();
  const items = [];
  let loadCount = 0;
  let ready = false;

  function frameSize() {
    const vFov = (camera.fov * Math.PI) / 180;
    return 2 * Math.tan(vFov / 2) * CAM_DIST;   // distance to origin, not z
  }

  // Every part is a list of layers — usually one, more where a component needs
  // several materials. Layers share an origin and must be centred *together*,
  // or they come apart.
  const layerTotal = PARTS.reduce(function (s, p) {
    return p.procedural ? s : s + (p.layers ? p.layers.length : 1);
  }, 0);
  let layersDone = 0;

  PARTS.forEach(function (part, index) {
    if (part.procedural) { buildProcedural(part, index); return; }
    const layers = part.layers || [{ file: part.file, mat: "printed" }];
    const geos = new Array(layers.length);
    let got = 0;

    layers.forEach(function (layer, li) {
      stlLoader.load(layer.file, function (geo) {
        // roll the whole model out of Z-up into the engine's Y-up frame
        if (Z_UP_CAD) geo.rotateX(-Math.PI / 2);
        RQ.smoothNormals(geo);
        geos[li] = geo;
        got++;
        layersDone++;
        loadPct.textContent = Math.round((layersDone / layerTotal) * 100) + "%";
        if (got === layers.length) {
          build();
          RQ.shadowAll(scene); RQ.fitShadow(key, scene);
        }
        if (layersDone === layerTotal) {
          layout();
          ready = true;
          loader.classList.add("hide");
        }
      });
    });

    function build() {
      // union box across every layer, so they stay registered to each other
      const box = new THREE.Box3();
      geos.forEach(function (g) {
        g.computeBoundingBox();
        box.union(g.boundingBox);
      });
      const home = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(home);
      box.getSize(size);

      const group = new THREE.Group();
      const mats = [];

      let maxR2 = 0;
      geos.forEach(function (g, li) {
        g.translate(-home.x, -home.y, -home.z);   // shared centre, not per-layer

        // Rotation-invariant silhouette size. Everything spins about Y, so the
        // widest a part can ever appear is either its diameter about that axis
        // or its projected height — both unchanged by the spin. A bounding
        // sphere is set by the 3D diagonal, which chunky parts never fully
        // project, and renders them noticeably small.
        const pos = g.attributes.position.array;
        for (let v = 0; v < pos.length; v += 3) {
          const r2 = pos[v] * pos[v] + pos[v + 2] * pos[v + 2];
          if (r2 > maxR2) maxR2 = r2;
        }

        const preset = (MATERIALS[layers[li].mat] || MATERIALS.printed)();
        const mesh = new THREE.Mesh(g, preset.mat);
        // glass draws after the solids it sits inside
        mesh.renderOrder = preset.glass ? 1000 + index : index;
        group.add(mesh);
        // remember the lit values so the fade can drive them to black and back
        mats.push({
          mat: preset.mat, base: preset.base, glass: preset.glass,
          c0: preset.mat.color.clone(),
          e0: preset.mat.emissive ? preset.mat.emissive.clone() : null,
          env0: preset.mat.envMapIntensity,
        });
      });

      const dia = 2 * Math.sqrt(maxR2);
      // the stand roll swings some depth into the vertical, so fold it in or
      // tall parts render oversized relative to the rest
      const vert = size.y * Math.cos(STAND) + dia * Math.abs(Math.sin(STAND));
      const span = Math.max(dia, vert);

      scene.add(group);
      const anchor = new THREE.Object3D();
      rig.add(anchor);

      items[index] = {
        part: part, obj: group, mats: mats, anchor: anchor,
        home: home, span: span, box: box,
      };
    }
  });

  // ---------- framing ----------
  const asmCenter = new THREE.Vector3();
  const asmSize = new THREE.Vector3();
  let rigScaleBase = 1;


  // ---------- the light path ----------
  // What the instrument does is shine two wavelengths up through 24 tubes, and
  // none of it is in the geometry: the LEDs sit under an opaque holder and the
  // tubes are opaque white. So it is drawn — but faintly. This is a hint that
  // the thing is lit, not a diagram drawn over the model.
  //
  // A column is one condition — four resistance-matched LEDs of one wavelength
  // at one tier — and the six columns alternate green and red. Coordinates come
  // from tube-holder.stl in the rotated frame the parts end up in: the tubes
  // run y 66.5 to 146.5 inside a holder spanning x -68..66, z -55..54.
  const beamGroup = new THREE.Group();
  const glowGroup = new THREE.Group();
  const beamCols = [], glowSprites = [];
  const TUBE_TOP = 146.5;

  // A plume, not a disc. Light leaving a tube keeps going and spreads as it
  // goes, so the texture is brightest at the mouth, widens as it rises, and is
  // gone before the top edge — nothing in it has a hard boundary, so it has no
  // edge to read against the background.
  //
  // Built per pixel rather than from canvas gradients: the widening needs the
  // horizontal falloff to depend on height, which a linear or radial gradient
  // cannot express.
  function glowTexture() {
    // Anchored at the tube mouth, not above it. Chasing the step where the
    // plume crossed the print's silhouette, I had moved the bright part a
    // third of the way up the sprite — which lifted the light clean off the
    // instrument and left a row of blobs hanging in the air above it. The
    // glow has to sit on the openings; that is the whole point of it.
    //
    // So: brightest at the mouth, falling away fast downward onto the print
    // and gently upward into the dark. A teardrop, not a column.
    const W = 192, H = 256;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(W, H);
    const ANCHOR = 0.28;      // where the mouth sits up the sprite
    const DOWN = 0.15;        // reach onto the print
    const UP = 0.46;          // reach into the air above
    // ~12 output levels over a few hundred pixels contours about every 30 of
    // them, and a contour reads as an edge. Noise of about one level breaks
    // them into grain.
    const DITHER = 0.13;
    for (let y = 0; y < H; y++) {
      const u = 1 - y / (H - 1);
      const dy = u - ANCHOR;
      const vs = dy < 0 ? DOWN : UP;
      const vert = Math.exp(-(dy / vs) * (dy / vs) * 1.6);
      const spread = 0.34 + 0.9 * Math.max(0, dy);   // opens out as it rises
      for (let x = 0; x < W; x++) {
        const dx = (x / (W - 1) - 0.5) * 2 / spread;
        let a = Math.exp(-dx * dx * 1.5) * vert;
        a += (Math.random() - 0.5) * DITHER * Math.min(1, a / 0.012);
        const i = (y * W + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  (function buildLight() {
    const Y0 = 80, Y1 = TUBE_TOP - 3;
    const tex = glowTexture();
    for (let col = 0; col < 6; col++) {
      const x = -48 + col * 19.2;
      const hex = col % 2 ? 0xff5f4a : 0x3ddc8b;
      const lin = new THREE.Color(hex).convertSRGBToLinear();
      // one material per column, so opacity is set six times a frame not 48
      // Additive, not alpha. Alpha-blending a colour over the white tube rack
      // darkens it — measured 118 down to 77 — which is the opposite of what a
      // light does. Additive can only brighten, so the shaft lifts the dark
      // tube openings and leaves the white print alone.
      const shaft = new THREE.MeshBasicMaterial({
        color: lin, transparent: true, opacity: 0, toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthTest: false, depthWrite: false
      });
      const halo = new THREE.SpriteMaterial({
        map: tex, color: lin, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
        toneMapped: false
      });
      beamCols.push(shaft);
      glowSprites.push(halo);
      for (let row = 0; row < 4; row++) {
        const z = -34 + row * 22.7;
        // splayed along the direction of travel: light leaving an LED opens
        // out up the tube
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2, 0.9, Y1 - Y0, 7, 1, true), shaft);
        m.position.set(x, (Y0 + Y1) / 2, z);
        m.renderOrder = 2000;
        beamGroup.add(m);
        // The foot sits exactly at the mouth, where the texture is zero. Sinking
        // it into the print did not help: additive light over a near-white
        // surface does nothing anyway, so all that did was put the plume at
        // half strength by the time it cleared the silhouette — which is the
        // step that read as an edge. Starting at zero on that line means there
        // is no row where the glow arrives.
        // the sprite's anchor is the point the texture is brightest at, and it
        // is placed on the mouth of the tube
        const sp = new THREE.Sprite(halo);
        sp.center.set(0.5, 0.28);
        sp.scale.set(30, 62, 1);
        sp.position.set(x, TUBE_TOP, z);
        sp.renderOrder = 2002;
        glowGroup.add(sp);
      }
    }
    rig.add(beamGroup);
    rig.add(glowGroup);
  })();

  function placeBeam() {
    // the same rig-local frame as every part anchor
    beamGroup.position.set(-asmCenter.x, -asmCenter.y, -asmCenter.z);
    glowGroup.position.copy(beamGroup.position);
  }

  // `shaft` is the light inside the tubes and `glow` is what escapes the top.
  // They are separate because they become true at different moments in the
  // build: the shafts once the LEDs are seated, the glow only once there is a
  // tube holder for the light to come out of.
  function runBeam(shaft, glow) {
    beamGroup.visible = shaft > 0.01;
    glowGroup.visible = glow > 0.01;
    for (let i = 0; i < beamCols.length; i++) {
      // 0.16 pushed the lit face of the print to a flat 255 and took its
      // shading with it; this lifts the dark tube openings and leaves the
      // white surface still reading as a surface
      beamCols[i].opacity = 0.11 * shaft;
      // four tubes to a column overlap on screen and additive light stacks,
      // so the per-glow figure has to leave room for that: 0.115 clipped a
      // plateau to white where they piled up
      glowSprites[i].opacity = 0.085 * glow;
    }
  }

  function layout() {
    const union = new THREE.Box3();
    items.forEach(function (it) { union.union(it.box); });
    union.getCenter(asmCenter);
    union.getSize(asmSize);
    items.forEach(function (it) {
      it.anchor.position.copy(it.home).sub(asmCenter);
    });
    placeBeam();
    rigScaleBase = (frameSize() * 0.35) / asmSize.y;
  }

  // ---------- HUD ----------
  function specRows(specs) {
    return specs.map(function (s) {
      return '<div class="spec"><span class="spec-k">' + s[0] +
             '</span><span class="spec-v">' + s[1] + "</span></div>";
    }).join("");
  }

  // The six conditions, with the measured output of each matched group. The bar
  // width is the tier, so low / mid / high read without having to parse numbers.
  function channelLegend() {
    const w = { Low: 30, Mid: 62, High: 100 };
    return '<div class="legend"><div class="legend-h">Six conditions</div>' +
      CHANNELS.map(function (c) {
        const mean = c.lux.reduce(function (s, v) { return s + v; }, 0) / c.lux.length;
        return '<div class="ch ' + c.hue + '">' +
          '<span class="ch-dot"></span>' +
          '<span class="ch-name">' + c.tier + "</span>" +
          '<span class="ch-bar"><i style="width:' + w[c.tier] + '%"></i></span>' +
          '<span class="ch-val">' + mean.toFixed(c.unit === "kLux" ? 2 : 0) +
          "<em>" + c.unit + "</em></span></div>";
      }).join("") +
      '<div class="legend-f">Green ~535 nm induces · red ~670 nm halts</div></div>';
  }

  // annotation overlay (js/annot.js attaches through annotHook)
  let annotFn = null, lastT = 0;

  let hudIndex = -1;
  function setHud(i) {
    if (i === hudIndex) return;
    hudIndex = i;
    const p = PARTS[i];
    if (!p) return;
    panelL.innerHTML =
      '<div class="tag">' + p.tag + "</div>" +
      '<h2 class="pname">' + p.name + "</h2>" +
      '<div class="prole">' + p.role + "</div>" +
      '<p class="pdesc">' + p.desc + "</p>";
    // A printed part offers its own STL. Almost no wiki publishes the CAD it
    // claims to open-source, and the file is already loaded on the page — the
    // link costs nothing and makes the part genuinely reproducible.
    panelR.innerHTML = specRows(p.specs) +
      (p.legend ? channelLegend() : "") +
      (p.cad
        ? '<a class="cad-dl" href="' + p.cad + '" download>' +
            '<span class="cad-dl-i" aria-hidden="true"></span>' +
            "Download STL</a>"
        : "");
    counter.innerHTML = '<b>' + p.tag + "</b><i>/</i>" +
      (N < 10 ? "0" : "") + N;
    Array.prototype.forEach.call(rail.children, function (d, k) {
      d.classList.toggle("on", k === i);
      d.classList.toggle("done", k < i);
    });
    // restart the stagger for the new part
    panelL.classList.remove("in"); panelR.classList.remove("in");
    void panelL.offsetWidth;
    panelL.classList.add("in"); panelR.classList.add("in");
  }

  PARTS.forEach(function () {
    const d = document.createElement("span");
    d.className = "dot";
    rail.appendChild(d);
  });

  // ---------- scroll ----------
  // Read scrollY in the frame loop and cache the track metrics, so no layout is
  // forced while scrolling; then damp it, which is what makes the motion feel
  // solid rather than tracking every jitter of trackpad momentum.
  let trackTop = 0, trackRange = 1;
  function measure() {
    trackTop = track.offsetTop;
    trackRange = Math.max(1, track.offsetHeight - window.innerHeight);
  }

  let target = 0;
  let progress = 0;
  const clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  const ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  const lerp = THREE.MathUtils.lerp;

  const clock = new THREE.Clock();
  let spin = 0;
  let spinClock = 0;

  const wPos = new THREE.Vector3();
  const wQuat = new THREE.Quaternion();
  const flipQuat = new THREE.Quaternion();
  const poseQuat = new THREE.Quaternion();
  const holdQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const slideVec = new THREE.Vector3();
  const YAXIS = new THREE.Vector3(0, 1, 0);
  const XAXIS = new THREE.Vector3(1, 0, 0);

  function frame(dt) {
    if (!ready) return;
    const H = frameSize();
    if (!reduced) {
      spinClock += dt;
      spin = OSC_AMP * Math.sin((spinClock / OSC_PERIOD) * Math.PI * 2);
    }

    const heroT = 1 - ease(clamp01(progress / (HERO * 0.9)));
    // Assembly phase: `asmStep` runs 0 → ASM_STEPS as the build proceeds, and
    // each part slides home on its own step from its own direction.
    const inAsm = progress >= FINALE_START;
    const asmStep = inAsm ? (progress - FINALE_START) / ASM_STEP : -1;
    // scale up over the first step so the build happens at full size
    const finaleT = ease(clamp01((progress - FINALE_START) / (ASM_STEP * 0.8)));
    const big = Math.max(heroT, finaleT);
    // The light is tied to the build, not to a single "assembled" flag. The
    // shafts come up once the LED holder and the array are home — build step 1,
    // the second move — and the glow only once the tube holder is on at step 4,
    // because before that there is no top for light to leave through.
    const shaftT = inAsm ? ease(clamp01((asmStep - 1) / 0.9)) : heroT;
    const glowT  = inAsm ? ease(clamp01((asmStep - (ASM_STEPS - 1)) / 0.9)) : heroT;
    runBeam(shaftT, glowT);

    // Large state sits slightly low and stops short of full height, leaving
    // clear space at the top for the hero / finale caption.
    // DiOPAL's hero was clipping at the bottom edge. The union box that
    // rigScaleBase normalises on covers the loaded meshes only — the
    // procedural LED array and its glow sprites render past it, so the
    // assembly comes out taller than the box predicts. Measured: 1005px
    // rendered against 857px expected. The hero multiplier is trimmed to
    // suit, and the vertical bias eased, which restores the margin.
    const rigY = lerp(-H * 0.185, -H * 0.085, big);
    const rigS = rigScaleBase * lerp(1, 1.42, big);
    rig.position.set(0, rigY, 0);
    rig.scale.setScalar(rigS);
    // YZX: the stand correction sits inside the spin, so the base pads stay
    // flat on the ground no matter which way the instrument is facing.
    rig.rotation.order = "YZX";
    rig.rotation.set(0, reduced ? 0.6 : spin, STAND);
    rig.updateMatrixWorld(true);

    // pedestal glow tracks the assembly's base
    const asmH = asmSize.y * rigS;
    const glowW = Math.max(asmSize.x, asmSize.z) * rigS * 3.4;
    glow.position.set(0, rigY - asmH * 0.46, -20);
    glow.scale.set(glowW, glowW * 0.42, 1);

    let featured = -1;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it) continue;

      // Beat windows. A part is fully gone by 0.22 and the next does not begin
      // lifting until 0.25, so no two are ever on screen together.
      const local = progress - PART_START - i;

      let t, opacity;
      if (local <= -0.75) {
        t = 0; opacity = 1;
      } else if (local < -0.30) {
        t = ease(clamp01((local + 0.75) / 0.45));
        opacity = 1;
      } else if (local <= 0.08) {
        t = 1; opacity = 1;
      } else if (local < 0.22) {
        t = 1;
        opacity = 1 - ease(clamp01((local - 0.08) / 0.14));
      } else {
        t = 1; opacity = 0;
      }

      if (local >= -0.30 && local <= 0.20) featured = i;

      // During the build a part is either not placed yet, sliding in, or home.
      // The enclosure turns to glass while the internals go in — otherwise the
      // whole point of the sequence, watching them slide up from underneath,
      // happens behind an opaque wall.
      let slide = 0;
      it.ghostA = 1;
      if (inAsm && it.part.ghost) {
        const closing = ease(clamp01((asmStep - (ASM_STEPS - 1)) / 0.9));
        it.ghostA = lerp(0.34, 1, closing);
      }
      if (inAsm) {
        const b = it.part.build || { step: 0, from: [0, 0, 0] };
        const local2 = asmStep - b.step;
        const st = ease(clamp01(local2 / 0.9));
        t = 0;                       // assembled orientation, not the featured pose
        opacity = st;
        slide = 1 - st;
        it.slideDir = b.from;
      }

      it.fade = opacity;
      if (opacity <= 0.002) { it.obj.visible = false; continue; }
      it.obj.visible = true;

      it.anchor.getWorldPosition(wPos);
      it.anchor.getWorldQuaternion(wQuat);

      // every part presents the same widest extent, so all read at one size
      const featScale = (H * 0.40) / it.span;
      const featY = H * 0.21;

      it.obj.position.set(
        lerp(wPos.x, 0, t),
        lerp(wPos.y, featY, t),
        lerp(wPos.z, 0, t)
      );

      // travel in along the rig's own axes, so the entry direction stays true to
      // the instrument however it happens to be turned
      if (slide > 0.001 && it.slideDir) {
        const dist = asmSize.y * rigS * 1.35 * slide;
        slideVec.set(it.slideDir[0], it.slideDir[1], it.slideDir[2])
          .applyQuaternion(wQuat).multiplyScalar(dist);
        it.obj.position.add(slideVec);
      }
      it.obj.scale.setScalar(lerp(rigS, featScale, t));

      // A featured part keeps the rig's exact orientation. Any per-part offset
      // here means the slerp has to travel that extra angle during the lift-out,
      // which reads as the part briefly spinning at a different speed.
      if (it.part.hold) {
        // Turn to face the camera and stay there. Used only for the array,
        // whose meaning is a flat 6 × 4 pattern — letting it spin would swing it
        // edge-on twice a revolution and hide the thing it exists to show.
        tmpEuler.set(Math.PI / 2 - CAM_ELEV, 0, 0);
        holdQuat.setFromEuler(tmpEuler);
        it.obj.quaternion.copy(wQuat).slerp(holdQuat, t);
      } else {
        it.obj.quaternion.copy(wQuat);
      }
      // Deliberate presentation offsets, eased in only as the part lifts out, so
      // the assembled pose is untouched. Because they are constant once on show,
      // the part still turns at exactly the rig's rate.
      if (i === featured) lastT = t;
      if (it.part.flip) {
        flipQuat.setFromAxisAngle(YAXIS, Math.PI * t);
        it.obj.quaternion.multiply(flipQuat);
      }
      if (it.part.pose) {
        poseQuat.setFromAxisAngle(XAXIS, it.part.pose * t);
        it.obj.quaternion.multiply(poseQuat);
      }

      // Parts fade by going dark, not by going see-through. Dropping alpha
      // turns a solid into a ghost you can read the background through, which
      // looks like a rendering fault; driving colour, emissive and reflections
      // to zero simply extinguishes it against the dark stage. Each material
      // keeps its own opacity throughout, so glass stays glass to the last frame.
      for (let k = 0; k < it.mats.length; k++) {
        const L = it.mats[k];
        L.mat.color.copy(L.c0).multiplyScalar(opacity);
        if (L.e0) L.mat.emissive.copy(L.e0).multiplyScalar(opacity);
        L.mat.envMapIntensity = L.env0 * opacity;

        // ghosting is real alpha, unlike the fade — toggled only on change so
        // the shader is not recompiled every frame
        const g = it.ghostA;
        const wantsAlpha = g < 0.995;
        if (wantsAlpha !== L.ghosting) {
          L.ghosting = wantsAlpha;
          L.mat.transparent = wantsAlpha;
          L.mat.depthWrite = !wantsAlpha;
          L.mat.needsUpdate = true;
        }
        L.mat.opacity = wantsAlpha ? g : 1;
      }
    }

    glow.material.opacity = lerp(0.9, 0.55, big);

    // hand the featured part to the annotation overlay, if one is attached
    if (annotFn) {
      const it = featured >= 0 ? items[featured] : null;
      annotFn(it ? it.obj : null, it ? it.part : null,
              it ? lastT : 0, camera, "#3ddc8b");
    }

    const showPart = featured >= 0 && big < 0.25;
    if (showPart) setHud(featured);
    panelL.classList.toggle("show", showPart);
    panelR.classList.toggle("show", showPart);
    rail.classList.toggle("show", showPart);
    counter.classList.toggle("show", showPart);
    heroEl.classList.toggle("show", heroT > 0.55);
    // build caption tracks the current step; the closing card waits until done
    const done = asmStep >= ASM_STEPS - 1 + 0.9;
    if (inAsm && !done) {
      const si = Math.max(0, Math.min(ASM_STEPS - 1, Math.floor(asmStep)));
      if (si !== buildIndex) {
        buildIndex = si;
        buildEl.innerHTML =
          '<div class="build-n">Step ' + (si + 1) + " / " + ASM_STEPS + "</div>" +
          "<h4>" + BUILD_CAPTIONS[si][0] + "</h4>" +
          "<p>" + BUILD_CAPTIONS[si][1] + "</p>";
      }
    }
    buildEl.classList.toggle("show", inAsm && !done);
    finaleEl.classList.toggle("show", done);

    bar.style.transform = "scaleX(" + (progress / TOTAL).toFixed(4) + ")";
  }

  // The loop is gated. It used to schedule itself unconditionally, so a full
  // WebGL render ran every frame for the life of the page — including while the
  // stage was scrolled far off-screen (this track is several viewport-heights
  // tall) and while the tab was in the background. It now parks whenever the
  // canvas is off-screen or the document is hidden, and is woken by scroll,
  // by the observer, and by visibilitychange. Same contract as
  // hardware/js/deck3d.js.
  let raf = null, onScreen = true;

  function schedule() {
    if (raf == null && onScreen && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function tick() {
    raf = null;
    const dt = Math.min(clock.getDelta(), 0.05);
    target = clamp01((window.scrollY - trackTop) / trackRange) * TOTAL;
    const k = 1 - Math.exp(-dt * 11);   // frame-rate independent damping
    progress += (target - progress) * k;
    if (Math.abs(target - progress) < 0.0004) progress = target;

    frame(dt);
    renderer.render(scene, camera);
    schedule();
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
      if (onScreen) { clock.getDelta(); schedule(); }   // drop the idle gap
    }, { rootMargin: "120px" }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { clock.getDelta(); schedule(); }
  });
  window.addEventListener("scroll", schedule, { passive: true });

  // ---------- QA hooks ----------
  window.__photo = {
    // Exposed so the hub card images can be rendered from this scene rather
    // than from a second pipeline that would drift from it: a tool attaches its
    // own camera here and reuses these materials, environment and lights
    // as-is. See "Hub card images" in README.md.
    get scene() { return scene; },
    get camera() { return camera; },
    get renderer() { return renderer; },
    get rig() { return rig; },
    // js/annot.js registers a per-frame callback here
    annotHook: function (fn) { annotFn = fn; },
    renderAt: function (p) {
      progress = p; target = p; frame(0.016); renderer.render(scene, camera); return p;
    },
    // Drive the oscillator's clock rather than `spin` directly — frame() derives
    // spin from spinClock every tick, so assigning spin here would be discarded.
    spinTo: function (p, a) {
      progress = p; target = p;
      const clamped = Math.max(-OSC_AMP, Math.min(OSC_AMP, a));
      spinClock = (Math.asin(clamped / OSC_AMP) / (Math.PI * 2)) * OSC_PERIOD;
      frame(0);
      renderer.render(scene, camera);
    },
    // QA: temporarily override a part's presentation tilt while tuning poses
    setPose: function (i, v) { PARTS[i].pose = v; },
    get progress() { return progress; },
    count: function () { return items.length; },
    marks: function () {
      return { HERO: HERO, PART_START: PART_START, FINALE_START: FINALE_START, TOTAL: TOTAL };
    },
    probeSpin: function (p, i) {
      const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
      const ma = new THREE.Quaternion(), mb = new THREE.Quaternion();
      progress = p; target = p;
      frame(0); rig.getWorldQuaternion(qa); items[i].obj.getWorldQuaternion(ma);
      frame(1.0); rig.getWorldQuaternion(qb); items[i].obj.getWorldQuaternion(mb);
      return {
        rig: +(2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb))))).toFixed(4),
        part: +(2 * Math.acos(Math.min(1, Math.abs(ma.dot(mb))))).toFixed(4),
      };
    },
    states: function () {
      return items.map(function (it, i) {
        const local = progress - PART_START - i;
        const t = local <= -0.75 ? 0
                : local < -0.30 ? ease(clamp01((local + 0.75) / 0.45)) : 1;
        // the fade drives colour rather than alpha, so report the tracked value
        // ghost is reported too: the enclosure turning to glass during assembly
        // is the point of the sequence, and it broke once already without
        // anything here showing it
        return { i: i, id: it.part.id, vis: it.obj.visible,
                 op: +(it.fade == null ? 0 : it.fade).toFixed(3), lifted: +t.toFixed(3),
                 ghost: +(it.ghostA == null ? 1 : it.ghostA).toFixed(3),
                 isGhost: !!it.part.ghost,
                 matOp: +(it.mats && it.mats[0] ? it.mats[0].mat.opacity : 1).toFixed(3) };
      });
    },
  };

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    measure();
    if (ready) layout();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("load", measure);
  resize();
  tick();
})();
