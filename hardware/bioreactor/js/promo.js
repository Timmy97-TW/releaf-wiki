// Promo bioreactor — assembled full-system view.
//
// Rendering pipeline is the one proven on the photometer page: painted-canvas
// studio environment through PMREM, ACES tone mapping, total light energy held
// under ~1 so the darks stay dark, transmission (never alpha) for glass.
(function () {
  const canvas = document.getElementById("gl");
  const loader = document.getElementById("loader");
  const loadPct = document.getElementById("load-pct");

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 8000);

  // The scene spans x -413..254, y -72..400. Frame it like the team's promo:
  // nearly straight on, slightly above.
  const TARGET = new THREE.Vector3(-80, 125, 0);
  let orbitYaw = 0.0, orbitPitch = 0.12, orbitDist = 1150;

  function placeCamera() {
    camera.position.set(
      TARGET.x + orbitDist * Math.sin(orbitYaw) * Math.cos(orbitPitch),
      TARGET.y + orbitDist * Math.sin(orbitPitch),
      TARGET.z + orbitDist * Math.cos(orbitYaw) * Math.cos(orbitPitch)
    );
    camera.lookAt(TARGET);
  }

  // ---------- image-based lighting (photometer recipe) ----------
  function studioEnvironment() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#0a0c10";
    g.fillRect(0, 0, 512, 256);
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
    blob(150, 60, 130, "#ffffff", 0.85);   // key softbox
    blob(400, 90, 100, "#dfe8f4", 0.5);    // fill
    blob(256, 230, 220, "#2c3038", 0.8);   // floor bounce, never black
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }
  scene.environment = studioEnvironment();

  const key = new THREE.DirectionalLight(0xfff6ec, 0.38);
  key.position.set(300, 500, 600);
  scene.add(key);
  const rimWarm = new THREE.DirectionalLight(0xffd9a8, 0.22);
  rimWarm.position.set(500, -100, -500);
  scene.add(rimWarm);
  const rimCool = new THREE.DirectionalLight(0xbcd0e6, 0.30);
  rimCool.position.set(-500, 200, -550);
  scene.add(rimCool);

  // ---------- materials ----------
  function std(color, metal, rough, envI) {
    return new THREE.MeshStandardMaterial({
      color: color, metalness: metal, roughness: rough, envMapIntensity: envI,
    });
  }
  function glassy(color, rough, trans, envI, emissive, emI) {
    return new THREE.MeshPhysicalMaterial({
      color: color, metalness: 0, roughness: rough,
      transmission: trans, ior: 1.5,
      transparent: true, opacity: 1, envMapIntensity: envI,
      clearcoat: 1, clearcoatRoughness: rough * 1.4,
      emissive: emissive, emissiveIntensity: emI,
      side: THREE.DoubleSide, depthWrite: false,
    });
  }
  const MATERIALS = {
    blackPrint: () => std(0x1d2025, 0.16, 0.58, 0.8),
    charcoal:   () => std(0x2a2d33, 0.22, 0.55, 0.75),
    probeBlack: () => std(0x121417, 0.20, 0.50, 0.85),
    cable:      () => std(0x17181a, 0.05, 0.72, 0.6),
    navy:       () => std(0x1f3f74, 0.12, 0.45, 0.95),
    skyBlue:    () => std(0x7fb2d9, 0.10, 0.42, 1.0),
    rotorBlue:  () => std(0x2f6fbb, 0.14, 0.40, 1.0),
    knobBlue:   () => std(0x2e5fa3, 0.14, 0.42, 1.0),
    white:      () => std(0xe4e6e8, 0.04, 0.62, 0.8),
    greyLight:  () => std(0x9aa2ab, 0.30, 0.48, 0.9),
    steel:      () => std(0xb8bcc2, 0.88, 0.34, 1.1),
    pcb:        () => std(0x14306b, 0.18, 0.52, 0.85),
    // optics: crisp lab glass
    glass:      () => glassy(0xeaf4ff, 0.02, 0.86, 3.4, 0x93bce4, 0.30),
    // vessels: clear borosilicate with the promo's blue cast
    bottleGlass:() => glassy(0xe4eef8, 0.06, 0.90, 3.0, 0x9dc0e2, 0.12),
    // media bottle reads milkier in the promo
    frostBottle:() => glassy(0xeef2f4, 0.30, 0.62, 2.2, 0xaebfd0, 0.10),
    // silicone tubing: soft, frosted
    tube:       () => glassy(0xf0f4f6, 0.26, 0.70, 2.4, 0xa9c2d8, 0.10),
    // The photometer's measuring beam, x-ray style: additive and drawn with
    // depthTest off so it stays visible through the black shell from outside.
    beam: () => new THREE.MeshBasicMaterial({
      color: 0xff8a1e, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }),
    amber: () => new THREE.MeshPhysicalMaterial({
      color: 0xffab34, metalness: 0, roughness: 0.10,
      transmission: 0.62, ior: 1.55,
      transparent: true, opacity: 1, envMapIntensity: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.04,
      emissive: 0xff8a00, emissiveIntensity: 0.42,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  };

  // ---------- flow animation ----------
  // Glowing pulses travel inside the tubing along centerlines extracted from
  // the tube meshes (js/flow-paths.js), ordered in true flow direction:
  // media -> pump -> membrane -> photometer -> media, plus the harvest lines.
  // Additive blending over the dark stage reads as liquid in motion; depthTest
  // stays on so pulses never glow through the opaque instruments.
  const FLOW_SPEED = 70;      // mm/s along the tube
  const DASH_MM = 44;         // one pulse + gap
  const flowMats = [];

  // Two circuits, two colors: the bacteria culture loop (lumen side) runs
  // amber-orange, the protectant harvest side (shell) runs green — matching
  // the photometer's and DiOPAL's accent colors on the wiki.
  const LOOP_COLORS = {
    lumen: { edge: "rgba(255,110,10,0)",  core: "rgba(255,126,20,1)" },
    shell: { edge: "rgba(20,225,120,0)",  core: "rgba(24,235,132,1)" },
  };

  function pulseTexture(loop) {
    const cl = LOOP_COLORS[loop] || LOOP_COLORS.lumen;
    const c = document.createElement("canvas");
    c.width = 128; c.height = 4;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 128, 4);
    const grad = g.createLinearGradient(0, 0, 52, 0);
    grad.addColorStop(0.0, cl.edge);
    grad.addColorStop(0.5, cl.core);
    grad.addColorStop(1.0, cl.edge);
    g.fillStyle = grad;
    g.fillRect(0, 0, 52, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;   // without this the colors wash to white
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function buildFlow() {
    if (typeof FLOW_PATHS === "undefined") return;
    FLOW_PATHS.forEach(function (fp) {
      const pts = fp.points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
      if (pts.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      const geo = new THREE.TubeGeometry(
        curve, Math.min(400, Math.max(24, Math.round(fp.length / 3))), 2.55, 10, false);
      const tex = pulseTexture(fp.loop);
      tex.repeat.x = fp.length / DASH_MM;
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      mat.userData.len = fp.length;
      flowMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = "flow-" + fp.name;
      mesh.renderOrder = 2;
      scene.add(mesh);
    });

    // Inside the membrane cartridge the two circuits meet: the culture runs
    // down the fiber lumen (orange core) while protectant crosses into the
    // shell space (green halo). Simple additive cylinders read perfectly
    // through the frosted shell.
    const coreGeo = new THREE.CylinderGeometry(4.4, 4.4, 200, 14);
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
      color: 0xff8a2e, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    core.position.set(-405.3, 195.4, 0);
    core.renderOrder = 2;
    scene.add(core);
    membraneGlowMats.push({ mat: core.material, base: 0.5 });
    const haloGeo = new THREE.CylinderGeometry(6.6, 6.6, 285, 16);
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
      color: 0x3ddc8b, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.set(-405.3, 195.4, 0);
    halo.renderOrder = 2;
    scene.add(halo);
    membraneGlowMats.push({ mat: halo.material, base: 0.22 });
  }

  // ---------- stage set ----------
  // A platform grounds the whole rig; the pump's pedestal turns the export's
  // floating pump position into a deliberate riser; a mast carries the
  // membrane cartridge that is wall-mounted in reality.
  const GROUND = -72;
  function roundedRect(w, d, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);  s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d);  s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r);      s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function buildStage() {
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0b0d12, metalness: 0.5, roughness: 0.42, envMapIntensity: 0.8,
    });
    const glowMat = function (opacity) {
      return new THREE.MeshBasicMaterial({
        color: 0x5aa9ff, transparent: true, opacity: opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
    };

    // Two-tier dais: main deck plus a wider, thinner base with a reveal gap —
    // the gap line carries a glow strip, so the deck reads as floating.
    // NOTE: ExtrudeGeometry rotated -90° about X extrudes UPWARD from its
    // position plane, so each tier is placed one thickness below its top.
    // deck: -84..-72, top flush with the equipment feet
    const slab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRect(760, 220, 42), { depth: 12, bevelEnabled: false }),
      darkMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(-80, GROUND - 12, -5);
    scene.add(slab);

    // base: -95..-87, leaving a 3-unit reveal under the deck
    const base = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRect(792, 248, 50), { depth: 8, bevelEnabled: false }),
      darkMat);
    base.rotation.x = -Math.PI / 2;
    base.position.set(-80, GROUND - 23, -5);
    scene.add(base);

    // glow strip inside the reveal gap
    const strip = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRect(766, 226, 44), { depth: 1.6, bevelEnabled: false }),
      glowMat(0.5));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(-80, GROUND - 14.3, -5);
    strip.renderOrder = 1;
    scene.add(strip);
    bootGlows.push({ mat: strip.material, base: 0.5, t0: 0.72 });

    // deck surface: hairline grid, low contrast
    const gridC = document.createElement("canvas");
    gridC.width = 1024; gridC.height = 512;
    const gg = gridC.getContext("2d");
    gg.clearRect(0, 0, 1024, 512);
    gg.strokeStyle = "rgba(122,178,236,0.16)";
    gg.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 32) { gg.beginPath(); gg.moveTo(x, 0); gg.lineTo(x, 512); gg.stroke(); }
    for (let y = 0; y <= 512; y += 32)  { gg.beginPath(); gg.moveTo(0, y); gg.lineTo(1024, y); gg.stroke(); }
    gg.strokeStyle = "rgba(122,178,236,0.34)";
    for (let x = 0; x <= 1024; x += 160) { gg.beginPath(); gg.moveTo(x, 0); gg.lineTo(x, 512); gg.stroke(); }
    const gridTex = new THREE.CanvasTexture(gridC);
    gridTex.encoding = THREE.sRGBEncoding;
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(744, 206),
      new THREE.MeshBasicMaterial({
        map: gridTex, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(-80, GROUND + 0.3, -5);
    grid.renderOrder = 1;
    scene.add(grid);
    bootGlows.push({ mat: grid.material, base: 0.5, t0: 1.5 });

    // rim inset on the deck top
    const rimShape = roundedRect(752, 212, 40);
    rimShape.holes.push(new THREE.Path(roundedRect(740, 200, 34).getPoints(24)));
    const rim = new THREE.Mesh(new THREE.ShapeGeometry(rimShape, 24), glowMat(0.7));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(-80, GROUND + 0.45, -5);
    rim.renderOrder = 1;
    scene.add(rim);
    bootGlows.push({ mat: rim.material, base: 0.7, t0: 0.95 });

    // soft light pools under each station — these read at a shallow camera
    // pitch where flat rings collapse to invisible lines
    const poolC = document.createElement("canvas");
    poolC.width = poolC.height = 256;
    const pg = poolC.getContext("2d");
    const rad = pg.createRadialGradient(128, 128, 0, 128, 128, 128);
    rad.addColorStop(0, "rgba(110,175,255,0.55)");
    rad.addColorStop(0.55, "rgba(90,160,255,0.16)");
    rad.addColorStop(1, "rgba(90,160,255,0)");
    pg.fillStyle = rad;
    pg.fillRect(0, 0, 256, 256);
    const poolTex = new THREE.CanvasTexture(poolC);
    poolTex.encoding = THREE.sRGBEncoding;
    [[-300, 175], [-165, 140], [0, 165], [190, 185]].forEach(function (st) {
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(st[1], st[1]),
        new THREE.MeshBasicMaterial({
          map: poolTex, transparent: true, opacity: 0.42,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(st[0], GROUND + 0.6, 0);
      pool.renderOrder = 1;
      scene.add(pool);
      bootGlows.push({ mat: pool.material, base: 0.42, t0: 1.7 + 0.22 * ((st[0] + 300) / 163) });
    });

    // front-edge trim: short glowing dashes, tech detailing
    for (let k = 0; k < 5; k++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(22, 2.4, 2.4), glowMat(0.55));
      dash.position.set(-408 + k * 34, GROUND - 4.5, 107);
      scene.add(dash);
      bootGlows.push({ mat: dash.material, base: 0.55, t0: 0.42 + (4 - k) * 0.07 });
      const dash2 = new THREE.Mesh(new THREE.BoxGeometry(22, 2.4, 2.4), glowMat(0.55));
      dash2.position.set(248 - k * 34, GROUND - 4.5, 107);
      scene.add(dash2);
      bootGlows.push({ mat: dash2.material, base: 0.55, t0: 0.5 + k * 0.06 });
    }

    // wordmark on the deck's front face — the first thing to strike on in
    // the unveil, and quiet branding in every other shot
    const wm = document.createElement("canvas");
    wm.width = 4096; wm.height = 144;
    const wg = wm.getContext("2d");
    wg.clearRect(0, 0, 4096, 144);
    wg.fillStyle = "#bfe0ff";
    wg.font = "600 78px ui-monospace, Menlo, monospace";
    wg.textAlign = "center";
    const wtext = "R E L E A F   ·   B I O R E A C T O R";
    wg.fillText(wtext, 2048, 94);
    wg.strokeStyle = "rgba(143,208,255,0.8)"; wg.lineWidth = 5;
    wg.beginPath(); wg.moveTo(700, 120); wg.lineTo(1660, 120); wg.stroke();
    wg.beginPath(); wg.moveTo(2436, 120); wg.lineTo(3396, 120); wg.stroke();
    const wmTex = new THREE.CanvasTexture(wm);
    wmTex.encoding = THREE.sRGBEncoding;
    wmTex.generateMipmaps = false;
    wmTex.minFilter = THREE.LinearFilter;
    wmTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const wordmark = new THREE.Mesh(
      new THREE.PlaneGeometry(330, 11.6),
      new THREE.MeshBasicMaterial({
        map: wmTex, transparent: true, opacity: 0.92,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    wordmark.position.set(-80, -78, 105.8);
    wordmark.renderOrder = 1;
    scene.add(wordmark);
    bootGlows.push({ mat: wordmark.material, base: 0.92, t0: 0.4 });

    // pump pedestal: from the platform up to the pump's underside
    const ped = new THREE.Mesh(new THREE.BoxGeometry(104, 29.5, 40), darkMat);
    ped.position.set(0, GROUND + 29.5 / 2, -23);
    scene.add(ped);
    const pedGlow = new THREE.Mesh(new THREE.BoxGeometry(106, 1.6, 42), glowMat(0.5));
    pedGlow.position.set(0, GROUND + 1.2, -23);
    scene.add(pedGlow);
    bootGlows.push({ mat: pedGlow.material, base: 0.5, t0: 1.35 });

    // membrane mast
    const mast = new THREE.Mesh(new THREE.BoxGeometry(12, 462, 7), darkMat);
    mast.position.set(-398, GROUND + 231, -12);
    scene.add(mast);
  }

  // ---------- HUD labels ----------
  // Futuristic callouts: mono uppercase tag with corner ticks, a leader line
  // to the part, staggered pop-in over the first six seconds. Drawn with
  // depthTest off — they are interface, not geometry.
  const LABELS = [
    { text: "HOLLOW-FIBER MEMBRANE", sub: "protectant exchange",  anchor: [-398, 355, 0],  tag: [-300, 408], t0: 1.0,
      parts: ["membrane-shell", "membrane-fiber"] },
    { text: "IN-LINE PHOTOMETER",    sub: "OD600 · no sampling",  anchor: [-286, 160, 0],  tag: [-218, 292], t0: 1.8,
      parts: ["head-shell", "optical-head", "rail", "wedge-base", "shield-a", "shield-b", "led-emitter-holder", "lens-fin"] },
    { text: "MEDIA RESERVOIR",       sub: "culture feed",         anchor: [-150, 40, 0],   tag: [-105, 178], t0: 2.4,
      parts: ["media-bottle", "media-cap"] },
    { text: "STERILE O2 VENT",       sub: "membrane air filter",  anchor: [-165, 132, 0],  tag: [-268, 218], t0: 3.0,
      parts: ["media-vent"] },
    { text: "PERISTALTIC PUMP",      sub: "closed-loop drive",    anchor: [0, 44, 20],     tag: [66, 96],    t0: 3.6,
      parts: ["pump-box", "pump-lid", "pump-casing", "pump-panel", "pump-knob", "pump-rotor-back", "pump-rotor-front"] },
    { text: "HARVEST VESSEL",        sub: "protectant collection", anchor: [190, 128, 0],  tag: [123, 305],  t0: 4.4,
      parts: ["main-bottle", "main-cap", "main-cap-plate"] },
    { text: "SENSOR PROBES",         sub: "monitoring",           anchor: [214, 30, -17],  tag: [268, 180],  t0: 5.2,
      parts: ["probe-a", "probe-b"] },
  ];
  const labelObjs = [];

  function tagTexture(text, sub) {
    // Drawn at 2x the displayed density and shown without mipmaps, so the
    // type stays crisp instead of smearing when the sprite is minified.
    const c = document.createElement("canvas");
    const W = 1240, H = 256;
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(8,12,18,0.78)";
    g.fillRect(12, 12, W - 24, H - 24);
    g.strokeStyle = "rgba(122,178,236,0.6)";
    g.lineWidth = 4;
    g.strokeRect(12, 12, W - 24, H - 24);
    // corner ticks
    g.strokeStyle = "#8fd0ff"; g.lineWidth = 8;
    [[12,12,1,1],[W-12,12,-1,1],[12,H-12,1,-1],[W-12,H-12,-1,-1]].forEach(function (k) {
      g.beginPath();
      g.moveTo(k[0] + 36 * k[2], k[1]);
      g.lineTo(k[0], k[1]);
      g.lineTo(k[0], k[1] + 36 * k[3]);
      g.stroke();
    });
    g.fillStyle = "#f2f8ff";
    g.font = "600 76px ui-monospace, Menlo, monospace";
    g.fillText(text, 56, 116);
    g.fillStyle = "#8fc3e8";
    g.font = "400 50px ui-monospace, Menlo, monospace";
    g.fillText("— " + sub, 56, 196);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function buildLabels() {
    LABELS.forEach(function (L) {
      const tex = tagTexture(L.text, L.sub);
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0, depthTest: false,
      });
      const spr = new THREE.Sprite(mat);
      const Hw = 32;                                   // world height of the tag
      spr.scale.set(Hw * 1240 / 256, Hw, 1);
      spr.position.set(L.tag[0], L.tag[1] + Hw / 2, L.anchor[2]);
      spr.renderOrder = 10;
      scene.add(spr);

      const pts = [
        new THREE.Vector3(L.anchor[0], L.anchor[1], L.anchor[2]),
        new THREE.Vector3(L.tag[0], L.tag[1] - 6, L.anchor[2]),
      ];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: 0x8fd0ff, transparent: true, opacity: 0, depthTest: false,
        }));
      line.renderOrder = 9;
      scene.add(line);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 10, 10),
        new THREE.MeshBasicMaterial({
          color: 0x8fd0ff, transparent: true, opacity: 0, depthTest: false,
        }));
      dot.position.copy(pts[0]);
      dot.renderOrder = 9;
      scene.add(dot);

      // materials this label illuminates when it lands
      const glowMats = [];
      (L.parts || []).forEach(function (name) {
        const obj = scene.getObjectByName(name);
        if (!obj || !obj.material) return;
        const m = obj.material;
        if (m.emissive && m.emissive.getHex() === 0x000000) {
          m.emissive.setHex(0x7fb8ff);
          // standard materials default emissiveIntensity to 1.0 — with a color
          // set that would leave the part permanently glowing
          m.emissiveIntensity = 0;
        }
        glowMats.push(m);
      });

      labelObjs.push({
        spr: spr, line: line, dot: dot, t0: L.t0,
        baseScale: spr.scale.clone(), baseY: spr.position.y,
        glowMats: glowMats,
      });
    });
  }

  function easeOutBack(t) {
    const c1 = 0.9, c3 = c1 + 1;   // gentle overshoot — a settle, not a bounce
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // One label pass shared by the pan clips, the live page and the unveils.
  // The pop runs 0.95s; the labelled object glows up with it and keeps a
  // faint sustained rim so the eye pairs tag and part.
  function applyLabels(lt) {
    labelObjs.forEach(function (L) {
      const u = Math.max(0, Math.min(1, (lt - L.t0) / 0.95));
      const sc = u === 0 ? 0.0001 : easeOutBack(u);
      L.spr.scale.set(L.baseScale.x * sc, L.baseScale.y * sc, 1);
      L.spr.position.y = L.baseY - 9 * (1 - u) * (1 - u);
      L.spr.material.opacity = Math.min(1, u * 1.6);
      L.line.material.opacity = Math.min(0.85, u * 1.3);
      L.dot.material.opacity = Math.min(1, u * 1.6);
      const pulse = 0.18 * Math.exp(-Math.pow((u - 0.32) / 0.3, 2));
      if (u > 0) L.glowMats.forEach(function (m) {
        m.emissiveIntensity = (m.emissiveIntensity || 0) + pulse;
      });
    });
  }

  // ---------- boot-sequence state ----------
  // Everything that can "power on" registers here: additive stage glows with
  // their ignition times, the photometer beam, the membrane exchange glows,
  // and (for the darkness ramp) every lit material plus the light kit.
  const bootGlows = [];      // { mat, base, t0 } — additive stage dressing
  const litMats = [];        // { mat, env, em } — standard/physical materials
  const lightsKit = [];      // { light, base }
  let beamMat = null;
  const membraneGlowMats = [];

  function bootCurve(t, t0) {
    if (t === null) return 1;
    if (t < t0) return 0;
    const u = Math.min(1, (t - t0) / 0.45);
    if (u >= 1) return 1;
    // deterministic hard blink while striking, like a discharge lamp
    return Math.sin(u * 43) > 0 ? 0.92 : 0.15;
  }

  // rotor meshes get re-pivoted at load so they can spin about the pump axis
  const ROTOR_AXIS = { x: -16.7, y: 0 };
  const rotors = [];
  let flowTime = 0;

  function setTime(t) {
    flowTime = t;
    flowMats.forEach(function (m) {
      m.map.offset.x = -(t * FLOW_SPEED) / DASH_MM;
    });
    rotors.forEach(function (r) { r.rotation.z = t * 1.7; });
    applyLabels(t);
  }

  // ---------- load everything ----------
  const stlLoader = new THREE.STLLoader();
  let done = 0;
  BIO_PARTS.forEach(function (p) {
    stlLoader.load("models/" + p.file + ".stl", function (geo) {
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, (MATERIALS[p.mat] || MATERIALS.blackPrint)());
      mesh.name = p.file;
      if (p.mat === "beam") { mesh.renderOrder = 3; beamMat = mesh.material; }
      if (p.file === "pump-rotor-back" || p.file === "pump-rotor-front") {
        geo.translate(-ROTOR_AXIS.x, -ROTOR_AXIS.y, 0);
        mesh.position.set(ROTOR_AXIS.x, ROTOR_AXIS.y, 0);
        rotors.push(mesh);
      }
      scene.add(mesh);
      done++;
      loadPct.textContent = Math.round((done / BIO_PARTS.length) * 100) + "%";
      if (done === BIO_PARTS.length) {
        buildFlow();
        buildStage();
        buildLabels();
        loader.classList.add("hide");
        // ambient motion on the interactive page
        const clock = { t0: performance.now() };
        (function tick() {
          // reset the powered state each frame — label glow pulses are added
          // on top of it and would otherwise accumulate without bound
          setPower(1); setStage(null); setFlowVis(1);
          setTime((performance.now() - clock.t0) / 1000);
          render();
          requestAnimationFrame(tick);
        })();
      }
    });
  });

  // ---------- orbit ----------
  let dragging = false, px = 0, py = 0;
  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    orbitYaw -= (e.clientX - px) * 0.005;
    orbitPitch = Math.max(-0.5, Math.min(1.2, orbitPitch + (e.clientY - py) * 0.005));
    px = e.clientX; py = e.clientY;
    render();
  });
  canvas.addEventListener("pointerup", function () { dragging = false; });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    orbitDist = Math.max(350, Math.min(2400, orbitDist * (1 + e.deltaY * 0.001)));
    render();
  }, { passive: false });

  function size() {
    // The embedded pane can report zero layout while hidden; a 0×0 canvas
    // renders nothing and screenshots come back empty. Fall back to a fixed
    // promo resolution so headless captures always work.
    const w = canvas.clientWidth || 1600;
    const h = canvas.clientHeight || 900;
    if (canvas.width !== w * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  function render() {
    size();
    placeCamera();
    renderer.render(scene, camera);
  }
  window.addEventListener("resize", render);
  render();

  // ---------- unveil sequences ----------
  // Two openers, both ending on the standard front framing so they cut
  // cleanly into the pan clips.
  function collectLit() {
    if (litMats.length) return;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
        litMats.push({ mat: m, env: m.envMapIntensity, em: m.emissiveIntensity || 0 });
      }
    });
    [key, rimWarm, rimCool].forEach(function (l) {
      lightsKit.push({ light: l, base: l.intensity });
    });
  }

  // scale the whole light kit: 1 = full studio, ~0 = silhouettes in the dark
  function setPower(sc) {
    collectLit();
    litMats.forEach(function (e) {
      e.mat.envMapIntensity = e.env * sc;
      // ALWAYS reset — label pulses add on top each frame, and a zero-base
      // material that is never reset accumulates its pulse without bound
      e.mat.emissiveIntensity = e.em * sc;
    });
    lightsKit.forEach(function (e) { e.light.intensity = e.base * sc; });
  }
  function setStage(t) {          // t in unveil-time, null = fully on
    bootGlows.forEach(function (g) { g.mat.opacity = g.base * bootCurve(t, g.t0); });
    membraneGlowMats.forEach(function (g) {
      g.mat.opacity = g.base * (t === null ? 1 : Math.max(0, Math.min(1, (t - 2.1) / 0.5)));
    });
    if (beamMat) {
      if (t === null) beamMat.opacity = 0.22;
      else {
        const u = Math.max(0, (t - 2.05) / 0.3);
        const flash = Math.exp(-Math.pow((t - 2.35) * 5, 2)) * 0.2;   // ignition pop
        beamMat.opacity = 0.22 * Math.min(1, u) + flash;
      }
    }
  }
  function setFlowVis(f) {
    flowMats.forEach(function (m) { m.opacity = f; });
  }
  function smooth(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }

  const UNVEILS = {
    // A: from below the platform edge, crane up as the stage boots
    // straight-on vertical crane: the wordmark opens centered and level,
    // and the camera simply rises into the standard framing
    rise: function (t) {
      const u = smooth((t - 1.1) / 2.5);
      return {
        yaw: 0, pitch: lerp(-0.22, 0.12, u),
        dist: lerp(600, 1500, u), tx: -80, ty: lerp(-70, 135, u),
        power: 0.05 + 0.95 * smooth((t - 1.0) / 2.2),
        lt: (t - 2.8) * 1.45,
      };
    },
    // B: macro on the running rotor, one continuous pull-back
    macro: function (t) {
      const u = smooth((t - 1.2) / 2.2);
      return {
        yaw: lerp(0.55, 0, u), pitch: lerp(0.04, 0.12, u),
        dist: lerp(320, 1500, u), tx: lerp(-10, -80, u), ty: lerp(-4, 135, u),
        power: 0.12 + 0.88 * smooth((t - 1.5) / 1.9),
        lt: (t - 2.8) * 1.45,
      };
    },
    // C: the combined shot — logo strike dead center, crane up and out to the
    // left corner while the stage boots, then the full pan runs right
    cine: function (t) {
      // The yaw direction reversal at the corner necessarily passes through
      // zero velocity — what sells continuity is that the zoom-out is still
      // settling while the pan is already running, so the frame never rests.
      const A = 48 * Math.PI / 180;
      const uYaw = smooth((t - 1.1) / 2.0);       // yaw reaches the corner early
      const uCam = smooth((t - 1.1) / 3.3);       // zoom/tilt settle late
      const v = smooth((t - 2.9) / 5.9);          // pan
      return {
        yaw: -A * uYaw + (A + 45 * Math.PI / 180) * v,
        pitch: lerp(-0.22, 0.12, uCam),
        dist: lerp(600, 1500, uCam), tx: -80, ty: lerp(-70, 135, uCam),
        power: 0.05 + 0.95 * smooth((t - 1.0) / 2.2),
        lt: (t - 3.2) * 1.5,
      };
    },
  };

  function unveilFrame(variant, t, w, h, bg) {
    const P = (UNVEILS[variant] || UNVEILS.rise)(t);
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    orbitYaw = P.yaw; orbitPitch = P.pitch; orbitDist = P.dist;
    TARGET.set(P.tx, P.ty, 0);
    setPower(P.power);
    setStage(t);
    // flow starts once the loop has "power"; labels ride a compressed clock
    const flowT = Math.max(0, t - 2.1);
    setFlowVis(Math.min(1, flowT / 0.5));
    flowMats.forEach(function (m) { m.map.offset.x = -(flowT * FLOW_SPEED) / DASH_MM; });
    rotors.forEach(function (r) { r.rotation.z = t * 1.7; });
    applyLabels(P.lt !== undefined ? P.lt : (t - 2.8) * 1.45);
    placeCamera();
    renderer.render(scene, camera);
    const c2 = window.__bio._c2 || (window.__bio._c2 = document.createElement("canvas"));
    c2.width = w; c2.height = h;
    const g = c2.getContext("2d");
    g.fillStyle = bg || "#06070a";
    g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0);
    return c2.toDataURL("image/png");
  }

  // ---------- guided tour ----------
  // One continuous move that visits each component in turn: pull in, hold with
  // its label, pull back out, move on. Framing comes from each component's own
  // world bounding box, so the camera distance suits the part rather than being
  // a guessed constant — the membrane column and a sensor probe need very
  // different pull-backs.
  let tourStops = null;
  function buildTour() {
    if (tourStops || typeof BIO_COMPONENTS === "undefined") return;
    tourStops = [];
    BIO_COMPONENTS.forEach(function (def, i) {
      // A component's framing box is the union of its meshes, minus anything
      // listed in `frameSkip`. That escape hatch exists for parts that belong
      // to a component electrically but sprawl across the rig — the
      // photometer's 321mm sensor harness would otherwise centre the shot on
      // empty bench. Tried inferring these as statistical outliers first; on
      // 3-mesh components it threw away the harvest bottle and kept the cap.
      const skip = def.frameSkip || [];
      const keep = [];
      def.meshes.forEach(function (n) {
        if (skip.indexOf(n) >= 0) return;
        const o = scene.getObjectByName(n);
        if (!o || !o.geometry) return;
        o.updateWorldMatrix(true, false);
        keep.push({ obj: o, box: new THREE.Box3().expandByObject(o) });
      });
      if (!keep.length) return;
      const box = new THREE.Box3();
      keep.forEach(function (m) { box.union(m.box); });
      const c = new THREE.Vector3(), sz = new THREE.Vector3();
      box.getCenter(c); box.getSize(sz);
      // The camera orbits in yaw, so the silhouette width has to be the
      // worst case over any yaw: the part's radius in the XZ plane, not its
      // x-extent. Height is fixed. Store the half-extents and solve the fit
      // per frame, once the real aspect ratio is known.
      let rxz = 0;
      keep.forEach(function (m) {
        const o = m.obj;
        const g = o.geometry, pos = g.attributes.position, v = new THREE.Vector3();
        for (let k = 0; k < pos.count; k += 3) {   // every 3rd vertex is plenty
          v.fromBufferAttribute(pos, k);
          o.localToWorld(v);
          rxz = Math.max(rxz, Math.hypot(v.x - c.x, v.z - c.z));
        }
      });
      tourStops.push({
        def: def, labelIndex: i, target: c,
        // halfW is the worst-case silhouette over any yaw, used to solve the
        // framing distance; `box` is the true bounds, used to place the leader
        // anchor on the part itself rather than on a padded rectangle.
        halfW: Math.max(rxz, sz.x * 0.5),
        halfH: sz.y * 0.5,
        halfD: sz.z * 0.5,
        box: box.clone(),
      });
    });
  }

  const TOUR_WIDE = { yaw: -0.34, pitch: 0.15, dist: 1700,
                      target: new THREE.Vector3(-80, 145, 0) };
  const TOUR_BEAT = 2.6;          // seconds per component
  const TOUR_LEAD = 1.1;          // opening wide shot before the first stop

  function tourLength() {
    buildTour();
    return TOUR_LEAD + (tourStops ? tourStops.length : 0) * TOUR_BEAT + 1.4;
  }

  // ---------- focus dimming ----------
  // Highlighting by adding emissive does nothing for a part that is already
  // white — the hollow-fiber membrane stayed invisible against the rig. So the
  // separation comes from the other direction: everything that is not the
  // subject is driven down toward black (colour and env, never alpha, which
  // would scale specular), and the subject keeps full brightness plus a faint
  // tint in its circuit's colour.
  const FOCUS_ACCENT = { lumen: 0xff7e14, shell: 0x18eb84, both: 0x5aa9ff };
  let focusReg = null;

  function collectFocus() {
    if (focusReg) return;
    focusReg = [];
    scene.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      if (!(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
      focusReg.push({
        name: o.name, mat: m,
        col: m.color.clone(),
        env: m.envMapIntensity,
        em: m.emissiveIntensity || 0,
        emc: m.emissive ? m.emissive.clone() : null,
      });
    });
  }

  // Runs after setPower/setFlowVis, both of which rewrite from their own
  // bases each frame. d = 0 leaves the scene untouched.
  function setFocus(def, d) {
    collectFocus();
    const names = def ? def.meshes : null;
    const acc = def ? new THREE.Color(FOCUS_ACCENT[def.flow] || FOCUS_ACCENT.both) : null;
    focusReg.forEach(function (e) {
      const on = names && names.indexOf(e.name) >= 0;
      const k = on ? 1 : lerp(1, 0.17, d);
      e.mat.color.copy(e.col).multiplyScalar(k);
      e.mat.envMapIntensity = e.env * (on ? 1 : lerp(1, 0.22, d));
      if (!e.emc) return;
      if (on) {
        e.mat.emissive.copy(e.emc).lerp(acc, 0.5 * d);
        e.mat.emissiveIntensity = e.em + 0.16 * d;
      } else {
        e.mat.emissive.copy(e.emc);
        e.mat.emissiveIntensity = e.em * k;
      }
    });
    // the loop keeps running, just quieter, so motion still reads
    flowMats.forEach(function (m) { m.opacity = lerp(1, 0.45, d); });
  }

  // ---------- tracking tour ----------
  // The alternative shape: settle wide, push in once, then dolly sideways from
  // part to part without ever pulling back out. Holds are long enough to read
  // the caption and watch the flow move.
  const TRK = { intro: 1.2, push: 1.1, hold: 2.8, move: 1.5, outro: 1.0 };

  // Close framing is clamped into a narrow band. Fitting each part exactly
  // spans 430-1124mm across this rig, and swinging through that range while
  // tracking sideways reads as zooming out again — the thing this variant
  // exists to avoid. The band still adapts, just not enough to notice.
  const TRK_NEAR = 240, TRK_FAR = 980;
  const TRK_FIT = 1.20;    // 1.0 would touch the frame edge; this leaves ~8% air
  const TRK_RISE = 0.08;   // how far the subject sits above centre

  function trackPose(stop, vHalf, hHalf) {
    // Fit the NEAR face, not the centre. A deep part like the reservoir bottle
    // magnifies its front by dist/(dist - halfD); fitting the centre plane let
    // the bottle overrun the frame by a percent or two.
    const d = Math.min(TRK_FAR, Math.max(TRK_NEAR,
      TRK_FIT * Math.max(stop.halfH / Math.tan(vHalf), stop.halfW / Math.tan(hHalf))
      + stop.halfD));
    const t = stop.target.clone();
    // Ride the part above centre so the caption sits under it. The rise has to
    // stay inside the fit margin or a height-limited part clips its own top:
    // at TRK_FIT the visible half-height is TRK_FIT x the part's, so the rise
    // must be under (TRK_FIT - 1).
    t.y -= TRK_RISE * d * Math.tan(vHalf);
    return { dist: d, target: t };
  }

  function trackLength() {
    buildTour();
    const n = tourStops ? tourStops.length : 0;
    if (!n) return 0;
    return TRK.intro + TRK.push + n * TRK.hold + (n - 1) * TRK.move + TRK.outro;
  }

  function trackFrame(t, w, h, bg) {
    buildTour();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    setPower(1); setStage(null); setFlowVis(1);
    flowMats.forEach(function (m) { m.map.offset.x = -(t * FLOW_SPEED) / DASH_MM; });
    rotors.forEach(function (r) { r.rotation.z = t * 1.7; });

    const vHalf = THREE.MathUtils.degToRad(camera.fov) * 0.5;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const n = tourStops.length;
    const poses = tourStops.map(function (s) { return trackPose(s, vHalf, hHalf); });

    const wideT = TOUR_WIDE.target, wideD = TOUR_WIDE.dist;
    let dist, tgt = new THREE.Vector3(), stop = null, cap = 0, idx = -1;

    const tPush = TRK.intro;
    const tFirst = tPush + TRK.push;              // first hold begins
    const cycle = TRK.hold + TRK.move;

    if (t < tPush) {
      // establishing: centred and wide
      dist = wideD; tgt.copy(wideT);
    } else if (t < tFirst) {
      const p = smooth((t - tPush) / TRK.push);
      dist = lerp(wideD, poses[0].dist, p);
      tgt.lerpVectors(wideT, poses[0].target, p);
      stop = tourStops[0]; idx = 0;
      cap = Math.max(0, (p - 0.6) / 0.4);         // caption arrives with the part
    } else {
      const local = t - tFirst;
      let i = Math.min(n - 1, Math.floor(local / cycle));
      const p = local - i * cycle;
      if (p < TRK.hold || i === n - 1) {
        // parked on a part
        dist = poses[i].dist; tgt.copy(poses[i].target);
        stop = tourStops[i]; idx = i;
        cap = 1;
        if (i === n - 1 && p > TRK.hold) {
          cap = 1 - smooth(Math.min(1, (p - TRK.hold) / TRK.outro));
        }
      } else {
        // travelling to the next part, staying in close
        const q = smooth((p - TRK.hold) / TRK.move);
        dist = lerp(poses[i].dist, poses[i + 1].dist, q);
        tgt.lerpVectors(poses[i].target, poses[i + 1].target, q);
        if (q < 0.5) { stop = tourStops[i]; idx = i; cap = 1 - smooth(q / 0.45); }
        else { stop = tourStops[i + 1]; idx = i + 1; cap = smooth(Math.max(0, (q - 0.55) / 0.45)); }
      }
    }

    // Dead straight on. The sway and the -0.34 yaw of the other variants read
    // as the whole rig sitting at an angle once the camera is in close.
    orbitYaw = 0;
    orbitPitch = 0.07;
    orbitDist = dist;
    TARGET.copy(tgt);

    labelObjs.forEach(function (L) {
      L.spr.material.opacity = 0;
      L.line.material.opacity = 0;
      L.dot.material.opacity = 0;
    });
    // dim the rest of the rig in step with the caption
    setFocus(stop ? stop.def : null, cap * 0.88);

    placeCamera();
    renderer.render(scene, camera);
    const c2 = window.__bio._c2 || (window.__bio._c2 = document.createElement("canvas"));
    c2.width = w; c2.height = h;
    const g = c2.getContext("2d");
    g.fillStyle = bg || "#06070a";
    g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0);
    if (stop && cap > 0.01) drawTourCard(g, w, h, stop, cap, idx, n);
    return c2.toDataURL("image/png");
  }

  function tourFrame(t, w, h, bg) {
    buildTour();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    setPower(1); setStage(null); setFlowVis(1);

    // the machine keeps running underneath the tour
    flowMats.forEach(function (m) { m.map.offset.x = -(t * FLOW_SPEED) / DASH_MM; });
    rotors.forEach(function (r) { r.rotation.z = t * 1.7; });

    const local = t - TOUR_LEAD;
    const idx = Math.floor(local / TOUR_BEAT);
    const stop = (idx >= 0 && tourStops && idx < tourStops.length) ? tourStops[idx] : null;

    // u: 0 wide -> 1 close -> 0 wide, held in the middle third
    let u = 0, active = -1;
    if (stop) {
      const p = (local - idx * TOUR_BEAT) / TOUR_BEAT;
      if (p < 0.30) u = smooth(p / 0.30);
      else if (p < 0.72) { u = 1; active = stop.labelIndex; }
      else u = 1 - smooth((p - 0.72) / 0.28);
      if (p >= 0.30 && p < 0.72) active = stop.labelIndex;
    }

    // Solve the close-up distance against the real frustum: whichever of the
    // part's half-height or half-width needs more room wins, then a margin so
    // the label and a little air fit around it. Never closer than 210mm.
    const vHalf = THREE.MathUtils.degToRad(camera.fov) * 0.5;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    let closeDist = 0;
    const tgt = new THREE.Vector3();
    if (stop) {
      // The floor is not about the near plane — it is about context. A 50mm
      // vent filter fitted to the frame fills it edge to edge and the reader
      // loses all sense of where it sits, so small parts stop at a distance
      // that keeps their neighbours in shot.
      closeDist = Math.max(430,
        1.50 * Math.max(stop.halfH / Math.tan(vHalf), stop.halfW / Math.tan(hHalf)));
      // Aim below the part so it rides high in frame, clearing the lower strip
      // for the caption. The camera looks at TARGET, so lowering TARGET raises
      // the subject.
      tgt.copy(stop.target);
      tgt.y -= 0.15 * closeDist * Math.tan(vHalf);
    } else {
      tgt.copy(TOUR_WIDE.target);
    }
    const dist = stop ? lerp(TOUR_WIDE.dist, closeDist, u) : TOUR_WIDE.dist;
    // drift the yaw a little across the whole tour so it never feels static
    const yaw = TOUR_WIDE.yaw + Math.sin(t * 0.16) * 0.30;
    const pitch = lerp(TOUR_WIDE.pitch, 0.10, u);
    TARGET.set(
      lerp(TOUR_WIDE.target.x, tgt.x, u),
      lerp(TOUR_WIDE.target.y, tgt.y, u),
      lerp(TOUR_WIDE.target.z, tgt.z, u));
    orbitYaw = yaw; orbitPitch = pitch; orbitDist = dist;

    // The in-scene sprite labels are sized and anchored for the wide shot, so
    // at tour range they sit outside the frame. Hide them and draw the tour's
    // own label in 2D over the finished render instead: it is rasterised at
    // capture resolution, so it stays sharp at 1080p however close we get.
    const on = Math.min(1, Math.max(0, (u - 0.55) / 0.3));
    labelObjs.forEach(function (L, i) {
      L.spr.material.opacity = 0;
      L.line.material.opacity = 0;
      L.dot.material.opacity = 0;
      if (i === active) {
        L.glowMats.forEach(function (m) {
          m.emissiveIntensity = (m.emissiveIntensity || 0) + on * 0.12;
        });
      }
    });

    placeCamera();
    renderer.render(scene, camera);
    const c2 = window.__bio._c2 || (window.__bio._c2 = document.createElement("canvas"));
    c2.width = w; c2.height = h;
    const g = c2.getContext("2d");
    g.fillStyle = bg || "#06070a";
    g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0);
    if (stop && on > 0.01) drawTourCard(g, w, h, stop, on, idx, tourStops.length);
    return c2.toDataURL("image/png");
  }

  let scrimCache = null;
  function tourScrim(w, h) {
    if (scrimCache && scrimCache.width === w && scrimCache.height === h) return scrimCache;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const v = g.createLinearGradient(0, h, 0, h * 0.52);
    v.addColorStop(0, "rgba(4,5,8,0.80)");
    v.addColorStop(1, "rgba(4,5,8,0)");
    g.fillStyle = v;
    g.fillRect(0, h * 0.52, w, h * 0.48);
    const x = g.createLinearGradient(0, 0, w * 0.68, 0);
    x.addColorStop(0.0, "rgba(0,0,0,1)");
    x.addColorStop(1.0, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = x;
    g.fillRect(0, 0, w, h);
    scrimCache = c;
    return c;
  }

  const FLOW_ACCENT = { lumen: "255,126,20", shell: "24,235,132", both: "90,169,255" };

  // The caption sits in the lower-left strip rather than floating beside the
  // part. At tour range the subject fills most of the frame, so there is no
  // clean column next to it — an earlier version put the card above the anchor
  // and it landed on top of the photometer. A fixed corner block with a leader
  // running up the empty left margin keeps the type off the hardware and gives
  // it the full frame width. Drawn in 2D at capture resolution, so it stays
  // sharp however close the camera gets.
  function drawTourCard(g, w, h, stop, a, idx, total) {
    const def = stop.def;
    const acc = FLOW_ACCENT[def.flow] || FLOW_ACCENT.both;
    const S = h / 1080;

    // the part's silhouette on screen, from its world bounding box
    const bx = w * 0.068;                 // caption left edge
    const by = h * 0.875;                 // caption rule

    // Lower-left scrim. The platform's lit edge runs right through where the
    // caption sits, and a text shadow alone left the subtitle fighting it.
    // Vertical fade for the lift, horizontal fade so the right side of the
    // frame — where the subject usually is — stays untouched.
    g.save();
    g.globalAlpha = a * 0.92;
    g.drawImage(tourScrim(w, h), 0, 0);
    g.restore();
    // Anchor on the part's centroid. Anchoring on the bounding box's left edge
    // put the dot in empty space beside thin parts like the membrane column.
    const p = stop.target.clone().project(camera);
    const ax = Math.min(Math.max((p.x * 0.5 + 0.5) * w, w * 0.12), w * 0.88);
    const ay = Math.min(Math.max((-p.y * 0.5 + 0.5) * h, h * 0.14), h * 0.72);

    g.save();
    g.globalAlpha = a;

    // leader: up the left margin, elbow into the caption rule
    g.strokeStyle = "rgba(" + acc + ",0.8)";
    g.lineWidth = Math.max(1, 1.6 * S);
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, ay + (by - ay) * 0.55);
    g.lineTo(bx, by);
    g.lineTo(bx + w * 0.30 * a, by);      // rule draws itself in
    g.stroke();

    // anchor dot with a halo
    const halo = g.createRadialGradient(ax, ay, 0, ax, ay, 28 * S);
    halo.addColorStop(0, "rgba(" + acc + ",0.5)");
    halo.addColorStop(1, "rgba(" + acc + ",0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(ax, ay, 28 * S, 0, 6.283); g.fill();
    g.fillStyle = "rgba(" + acc + ",1)";
    g.beginPath(); g.arc(ax, ay, 4.5 * S, 0, 6.283); g.fill();
    g.strokeStyle = "rgba(" + acc + ",0.45)";
    g.lineWidth = Math.max(1, 1.2 * S);
    g.beginPath(); g.arc(ax, ay, 14 * S, 0, 6.283); g.stroke();

    // caption
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.shadowColor = "rgba(0,0,0,0.92)";
    g.shadowBlur = 16 * S;

    // One inset used for both edges, so the block sits the same distance from
    // the vertical leader as it does from the rule beneath it. The bottom line
    // is measured to its descender, not its baseline, or the gap reads smaller.
    const pad = 24 * S;
    const tx = bx + pad;
    const roleSize = 25 * S;
    const yRole = by - pad - roleSize * 0.22;      // descender, not baseline
    const yName = yRole - 40 * S;
    const yTag  = yName - 40 * S;

    g.font = "600 " + Math.round(20 * S) + "px ui-monospace, Menlo, monospace";
    g.fillStyle = "rgba(" + acc + ",0.95)";
    g.fillText(String(idx + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0") +
               "   " + (def.flow === "shell" ? "SHELL SIDE"
                      : def.flow === "lumen" ? "LUMEN SIDE" : "BOTH CIRCUITS"),
               tx, yTag);

    g.font = "700 " + Math.round(52 * S) + "px ui-sans-serif, -apple-system, Helvetica, Arial, sans-serif";
    g.fillStyle = "rgba(242,247,255,0.99)";
    g.fillText(def.label, tx, yName);

    g.font = "400 " + Math.round(roleSize) + "px ui-sans-serif, -apple-system, Helvetica, Arial, sans-serif";
    g.fillStyle = "rgba(192,206,226,0.9)";
    g.fillText(def.role, tx, yRole);
    g.restore();

    // progress ticks, bottom right — one mark per component
    g.save();
    g.globalAlpha = Math.min(1, a * 1.2);
    const tw = 26 * S, gap = 10 * S;
    let px = w - w * 0.068 - (total * tw + (total - 1) * gap);
    for (let i = 0; i < total; i++) {
      g.fillStyle = i === idx ? "rgba(" + acc + ",0.95)"
                  : i < idx ? "rgba(210,224,244,0.32)" : "rgba(210,224,244,0.12)";
      g.fillRect(px, by - 3 * S, tw, 3 * S);
      px += tw + gap;
    }
    g.restore();
  }

  // verification hooks (same idea as the photometer's __photo)
  window.__bio = {
    unveilFrame: unveilFrame,
    tourFrame: tourFrame,
    tourLength: tourLength,
    trackFrame: trackFrame,
    trackLength: trackLength,
    // phase hooks for seamless-loop renders: set rotor angle and flow phase
    // directly so a full orbit can close on exact integer cycles
    setRotor: function (a) { rotors.forEach(function (r) { r.rotation.z = a; }); },
    setFlowT: function (ft) {
      flowMats.forEach(function (m) { m.map.offset.x = -(ft * FLOW_SPEED) / DASH_MM; });
    },
    render: render,
    canvas: canvas,
    scene: scene,
    camera: camera,
    tourStops: function () { buildTour(); return tourStops; },
    ready: function () { return done === BIO_PARTS.length; },
    look: function (yaw, pitch, dist, tx, ty) {
      orbitYaw = yaw; orbitPitch = pitch;
      if (dist) orbitDist = dist;
      if (tx !== undefined) TARGET.set(tx, ty, 0);
      render();
    },
    setTime: setTime,
    // Fixed-resolution frame for video capture: exact pixel dimensions
    // (pixelRatio 1), composited over an opaque background because the
    // delivery codecs have no alpha. `t` drives flow pulses and rotor spin.
    frame: function (yaw, pitch, w, h, bg, t) {
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      orbitYaw = yaw; orbitPitch = pitch;
      setPower(1); setStage(null); setFlowVis(1);
      if (t !== undefined) setTime(t);
      placeCamera();
      renderer.render(scene, camera);
      const c2 = window.__bio._c2 || (window.__bio._c2 = document.createElement("canvas"));
      c2.width = w; c2.height = h;
      const g = c2.getContext("2d");
      g.fillStyle = bg || "#06070a";
      g.fillRect(0, 0, w, h);
      g.drawImage(canvas, 0, 0);
      return c2.toDataURL("image/png");
    },
  };
})();
