// Bioreactor hero — the assembled loop, slowly orbiting, with live flow.
//
// This is the promo scene reused as a page hero: same models, same materials,
// same two-colour flow, but framed for the top of the record rather than for
// video. It idles at a slow constant orbit and responds to drag.
(function () {
  const canvas = document.getElementById("gl");
  if (!canvas || typeof BIO_PARTS === "undefined") return;
  const loader = document.getElementById("loader");
  const loadPct = document.getElementById("load-pct");

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 8000);
  const TARGET = new THREE.Vector3(-80, 128, 0);
  let yaw = -0.5, pitch = 0.13, dist = 1720;

  function place() {
    camera.position.set(
      TARGET.x + dist * Math.sin(yaw) * Math.cos(pitch),
      TARGET.y + dist * Math.sin(pitch),
      TARGET.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(TARGET);
  }

  /* ---------- lighting (photometer recipe) ---------- */
  function studioEnvironment() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#0a0c10"; g.fillRect(0, 0, 512, 256);
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#6e7987"); sky.addColorStop(.45, "#3d444f"); sky.addColorStop(1, "#1b1f26");
    g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
    function blob(x, y, r, color, alpha) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = alpha; g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
    }
    blob(150, 60, 130, "#ffffff", .85);
    blob(400, 90, 100, "#dfe8f4", .5);
    blob(256, 230, 220, "#2c3038", .8);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose(); tex.dispose();
    return env;
  }
  scene.environment = RQ.studioEnv(renderer);
  const key = new THREE.DirectionalLight(0xfff6ec, .38); key.position.set(300, 500, 600); scene.add(key);
  // Self-shadowing: parts shadow each other so crevices and overhangs read as
  // depth. No ground plane — that would light them better still but would
  // change compositions that are already framed.
  RQ.enableShadows(renderer, key);
  const rimW = new THREE.DirectionalLight(0xffd9a8, .22); rimW.position.set(500, -100, -500); scene.add(rimW);
  const rimC = new THREE.DirectionalLight(0xbcd0e6, .30); rimC.position.set(-500, 200, -550); scene.add(rimC);

  /* ---------- materials ---------- */
  // Clearcoat at construction, not as a later pass. Swapping materials after
  // the fact detaches every reference the scene already holds — which is how
  // the enclosure's ghosting stopped working on DiOPAL.
  const std = (c, m, r, e) => new THREE.MeshPhysicalMaterial({
    color: c, metalness: m,
    roughness: Math.max(0.18, r * 0.72), envMapIntensity: e * 1.35,
    clearcoat: 1, clearcoatRoughness: 0.09 });
  const glassy = (c, r, t, e, em, ei) => new THREE.MeshPhysicalMaterial({
    color: c, metalness: 0, roughness: r, transmission: t, ior: 1.5,
    transparent: true, opacity: 1, envMapIntensity: e,
    clearcoat: 1, clearcoatRoughness: r * 1.4,
    emissive: em, emissiveIntensity: ei,
    side: THREE.DoubleSide, depthWrite: false });
  const MATERIALS = {
    blackPrint: () => std(0x1d2025, .16, .58, .8),
    charcoal:   () => std(0x2a2d33, .22, .55, .75),
    probeBlack: () => std(0x121417, .20, .50, .85),
    cable:      () => std(0x17181a, .05, .72, .6),
    navy:       () => std(0x1f3f74, .12, .45, .95),
    skyBlue:    () => std(0x7fb2d9, .10, .42, 1),
    rotorBlue:  () => std(0x2f6fbb, .14, .40, 1),
    knobBlue:   () => std(0x2e5fa3, .14, .42, 1),
    white:      () => std(0xe4e6e8, .04, .62, .8),
    greyLight:  () => std(0x9aa2ab, .30, .48, .9),
    steel:      () => std(0xb8bcc2, .88, .34, 1.1),
    pcb:        () => std(0x14306b, .18, .52, .85),
    glass:      () => glassy(0xeaf4ff, .02, .86, 3.4, 0x93bce4, .30),
    bottleGlass:() => glassy(0xe4eef8, .06, .90, 3.0, 0x9dc0e2, .12),
    frostBottle:() => glassy(0xeef2f4, .30, .62, 2.2, 0xaebfd0, .10),
    tube:       () => glassy(0xf0f4f6, .26, .70, 2.4, 0xa9c2d8, .10),
    beam: () => new THREE.MeshBasicMaterial({
      color: 0xff8a1e, transparent: true, opacity: .22,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
    amber: () => new THREE.MeshPhysicalMaterial({
      color: 0xffab34, metalness: 0, roughness: .10, transmission: .62, ior: 1.55,
      transparent: true, opacity: 1, envMapIntensity: 1.5,
      clearcoat: 1, clearcoatRoughness: .04,
      emissive: 0xff8a00, emissiveIntensity: .42,
      side: THREE.DoubleSide, depthWrite: false }),
  };

  /* ---------- flow ---------- */
  const FLOW_SPEED = 70, DASH_MM = 44, flowMats = [];
  const LOOP_COLORS = {
    lumen: { edge: "rgba(255,110,10,0)", core: "rgba(255,126,20,1)" },
    shell: { edge: "rgba(20,225,120,0)", core: "rgba(24,235,132,1)" },
  };
  function pulseTexture(loop) {
    const cl = LOOP_COLORS[loop] || LOOP_COLORS.lumen;
    const c = document.createElement("canvas");
    c.width = 128; c.height = 4;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 52, 0);
    grad.addColorStop(0, cl.edge); grad.addColorStop(.5, cl.core); grad.addColorStop(1, cl.edge);
    g.fillStyle = grad; g.fillRect(0, 0, 52, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
  function buildFlow() {
    if (typeof FLOW_PATHS === "undefined") return;
    FLOW_PATHS.forEach(function (fp) {
      const pts = fp.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      if (pts.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      const geo = new THREE.TubeGeometry(
        curve, Math.min(400, Math.max(24, Math.round(fp.length / 3))), 2.55, 10, false);
      const tex = pulseTexture(fp.loop);
      tex.repeat.x = fp.length / DASH_MM;
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      flowMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      scene.add(mesh);
    });
    // membrane exchange: culture in the lumen, protectant crossing to the shell
    const core = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 200, 14),
      new THREE.MeshBasicMaterial({ color: 0xff8a2e, transparent: true, opacity: .5,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.set(-405.3, 195.4, 0); core.renderOrder = 2; scene.add(core);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 285, 16),
      new THREE.MeshBasicMaterial({ color: 0x3ddc8b, transparent: true, opacity: .22,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(-405.3, 195.4, 0); halo.renderOrder = 2; scene.add(halo);
  }

  /* ---------- stage ---------- */
  const GROUND = -72;
  function roundedRect(w, d, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function buildStage() {
    const dark = std(0x0b0d12, .5, .42, .8);
    const glow = (o) => new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true,
      opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

    const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(
      roundedRect(760, 220, 42), { depth: 12, bevelEnabled: false }), dark);
    slab.rotation.x = -Math.PI / 2; slab.position.set(-80, GROUND - 12, -5); scene.add(slab);

    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(
      roundedRect(792, 248, 50), { depth: 8, bevelEnabled: false }), dark);
    base.rotation.x = -Math.PI / 2; base.position.set(-80, GROUND - 23, -5); scene.add(base);

    const strip = new THREE.Mesh(new THREE.ExtrudeGeometry(
      roundedRect(766, 226, 44), { depth: 1.6, bevelEnabled: false }), glow(.5));
    strip.rotation.x = -Math.PI / 2; strip.position.set(-80, GROUND - 14.3, -5);
    strip.renderOrder = 1; scene.add(strip);

    const rimShape = roundedRect(752, 212, 40);
    rimShape.holes.push(new THREE.Path(roundedRect(740, 200, 34).getPoints(24)));
    const rim = new THREE.Mesh(new THREE.ShapeGeometry(rimShape, 24), glow(.7));
    rim.rotation.x = -Math.PI / 2; rim.position.set(-80, GROUND + .45, -5);
    rim.renderOrder = 1; scene.add(rim);

    const poolC = document.createElement("canvas");
    poolC.width = poolC.height = 256;
    const pg = poolC.getContext("2d");
    const rad = pg.createRadialGradient(128, 128, 0, 128, 128, 128);
    rad.addColorStop(0, "rgba(110,175,255,0.55)");
    rad.addColorStop(.55, "rgba(90,160,255,0.16)");
    rad.addColorStop(1, "rgba(90,160,255,0)");
    pg.fillStyle = rad; pg.fillRect(0, 0, 256, 256);
    const poolTex = new THREE.CanvasTexture(poolC);
    poolTex.encoding = THREE.sRGBEncoding;
    [[-300, 175], [-165, 140], [0, 165], [190, 185]].forEach(function (st) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(st[1], st[1]),
        new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: .42,
          blending: THREE.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(st[0], GROUND + .6, 0);
      pool.renderOrder = 1; scene.add(pool);
    });

    for (let k = 0; k < 5; k++) {
      [[-408 + k * 34], [248 - k * 34]].forEach(function (p) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(22, 2.4, 2.4), glow(.55));
        d.position.set(p[0], GROUND - 4.5, 107); scene.add(d);
      });
    }

    const wm = document.createElement("canvas");
    wm.width = 4096; wm.height = 144;
    const wg = wm.getContext("2d");
    wg.fillStyle = "#bfe0ff";
    wg.font = "600 78px ui-monospace, Menlo, monospace";
    wg.textAlign = "center";
    wg.fillText("R E L E A F   ·   B I O R E A C T O R", 2048, 94);
    wg.strokeStyle = "rgba(143,208,255,0.8)"; wg.lineWidth = 5;
    wg.beginPath(); wg.moveTo(700, 120); wg.lineTo(1660, 120); wg.stroke();
    wg.beginPath(); wg.moveTo(2436, 120); wg.lineTo(3396, 120); wg.stroke();
    const wmTex = new THREE.CanvasTexture(wm);
    wmTex.encoding = THREE.sRGBEncoding;
    wmTex.generateMipmaps = false;
    wmTex.minFilter = THREE.LinearFilter;
    wmTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const wordmark = new THREE.Mesh(new THREE.PlaneGeometry(330, 11.6),
      new THREE.MeshBasicMaterial({ map: wmTex, transparent: true, opacity: .92,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    wordmark.position.set(-80, -78, 105.8); wordmark.renderOrder = 1; scene.add(wordmark);

    const ped = new THREE.Mesh(new THREE.BoxGeometry(104, 29.5, 40), dark);
    ped.position.set(0, GROUND + 14.75, -23); scene.add(ped);
    const pedGlow = new THREE.Mesh(new THREE.BoxGeometry(106, 1.6, 42), glow(.5));
    pedGlow.position.set(0, GROUND + 1.2, -23); scene.add(pedGlow);

    const mast = new THREE.Mesh(new THREE.BoxGeometry(12, 462, 7), dark);
    mast.position.set(-398, GROUND + 231, -12); scene.add(mast);
  }

  /* ---------- load ---------- */
  const stlLoader = new THREE.STLLoader();
  const ROTOR = { x: -16.7, y: 0 };
  const rotors = [];
  let done = 0, ready = false;

  BIO_PARTS.forEach(function (p) {
    stlLoader.load("models/" + p.file + ".stl", function (geo) {
      RQ.smoothNormals(geo);
      const mesh = new THREE.Mesh(geo, (MATERIALS[p.mat] || MATERIALS.blackPrint)());
      mesh.name = p.file;
      if (p.mat === "beam") mesh.renderOrder = 3;
      if (p.file === "pump-rotor-back" || p.file === "pump-rotor-front") {
        geo.translate(-ROTOR.x, -ROTOR.y, 0);
        mesh.position.set(ROTOR.x, ROTOR.y, 0);
        rotors.push(mesh);
      }
      scene.add(mesh);
      done++;
      if (loadPct) loadPct.textContent = Math.round((done / BIO_PARTS.length) * 100) + "%";
      if (done === BIO_PARTS.length) {
        buildFlow(); buildStage();
        RQ.shadowAll(scene); RQ.fitShadow(key, scene);
        if (loader) loader.classList.add("hide");
        ready = true;
        start();
      }
    });
  });

  /* ---------- drive ---------- */
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dragging = false, px = 0, py = 0, userHeld = false;

  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; userHeld = true; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    yaw -= (e.clientX - px) * .005;
    pitch = Math.max(-.35, Math.min(.9, pitch + (e.clientY - py) * .004));
    px = e.clientX; py = e.clientY;
  });
  canvas.addEventListener("pointerup", function () { dragging = false; });

  function size() {
    const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  function render() { size(); place(); renderer.render(scene, camera); }

  let t0 = 0;
  function start() {
    t0 = performance.now();
    if (reduced) { render(); return; }
    (function tick(now) {
      const t = (now - t0) / 1000;
      // idle orbit, released back to auto once the reader lets go
      if (!dragging && !userHeld) yaw = -0.5 + t * 0.06;
      flowMats.forEach(function (m) { m.map.offset.x = -(t * FLOW_SPEED) / DASH_MM; });
      rotors.forEach(function (r) { r.rotation.z = t * 1.7; });
      render();
      requestAnimationFrame(tick);
    })(performance.now());
  }

  window.__bioHero = {
    isReady: function () { return ready; },
    // exposed for js/picker.js: it raycasts against this scene through this
    // camera, and needs a way to force a frame when the idle loop is paused
    // (the reduced-motion path renders once and stops).
    get scene() { return scene; },
    get camera() { return camera; },
    redraw: render,
    look: function (y, p, d) { yaw = y; pitch = p; if (d) dist = d; userHeld = true; render(); },
  };
})();
