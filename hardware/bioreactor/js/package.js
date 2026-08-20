// Three-channel packaged bioreactor — massing study.
//
// Primitives only, no STLs: this exists to test whether the cassette layout
// reads on camera before anyone commits it to CAD. Everything is in
// millimetres, matching packaging-concept.svg, so measurements taken here
// transfer straight to Onshape.
//
// Origin: centre of the box footprint, y = 0 at the bench, +z toward the
// viewer (the front window).
(function () {
  const canvas = document.getElementById("gl");

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 8000);

  // ---------- envelope (mm), from packaging-concept.svg ----------
  const BOX_W = 280, BOX_D = 220, BOX_H = 285;
  const X0 = -BOX_W / 2, ZF = BOX_D / 2;          // left edge, front face
  const BAY_Y0 = 42, CASS_W = 70, CASS_H = 220, CASS_D = 130;
  const CASS_LEFT = [X0 + 20, X0 + 95, X0 + 170]; // 75mm pitch
  const CASS_ZF = ZF - 8;                         // cassette front plane
  const MOTOR_X = X0 + 260;

  // local cassette space -> world
  function P(i, lx, ly, d) {
    return new THREE.Vector3(CASS_LEFT[i] + lx, BAY_Y0 + ly, CASS_ZF - d);
  }

  // ---------- image-based lighting (same recipe as the promo scene) ----------
  function studioEnvironment() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0.00, "#6e7987");
    sky.addColorStop(0.45, "#3d444f");
    sky.addColorStop(1.00, "#1b1f26");
    g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
    function blob(x, y, r, color, alpha) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = alpha; g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
    }
    blob(150, 60, 130, "#ffffff", 0.85);
    blob(400, 90, 100, "#dfe8f4", 0.5);
    blob(256, 230, 220, "#2c3038", 0.8);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    const env = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
    return env;
  }
  scene.environment = studioEnvironment();

  const key = new THREE.DirectionalLight(0xfff6ec, 0.40); key.position.set(220, 480, 620); scene.add(key);
  const rimW = new THREE.DirectionalLight(0xffd9a8, 0.20); rimW.position.set(480, -80, -420); scene.add(rimW);
  const rimC = new THREE.DirectionalLight(0xbcd0e6, 0.30); rimC.position.set(-460, 220, -480); scene.add(rimC);

  // ---------- materials ----------
  function std(col, m, r, e) {
    return new THREE.MeshStandardMaterial({ color: col, metalness: m, roughness: r, envMapIntensity: e });
  }
  function glassy(col, rough, trans, envI, em, emI) {
    return new THREE.MeshPhysicalMaterial({
      color: col, metalness: 0, roughness: rough, transmission: trans, ior: 1.5,
      transparent: true, opacity: 1, envMapIntensity: envI, clearcoat: 1,
      clearcoatRoughness: rough * 1.4, emissive: em, emissiveIntensity: emI,
      side: THREE.DoubleSide, depthWrite: false,
    });
  }

  const M = {
    shell:  () => std(0x090b0f, 0.24, 0.66, 0.20),
    shellL: () => std(0x171c23, 0.28, 0.55, 0.38),
    plate:  () => std(0x0b0e13, 0.18, 0.68, 0.18),
    steel:  () => std(0xb8bcc2, 0.88, 0.34, 1.1),
    dark:   () => std(0x0f1216, 0.10, 0.70, 0.6),
    white:  () => std(0xdfe3e7, 0.05, 0.55, 0.9),
    glass:  () => glassy(0xe6f0fa, 0.05, 0.92, 3.0, 0x9dc0e2, 0.10),
    tube:   () => glassy(0xdde5eb, 0.34, 0.74, 0.85, 0x7d97ac, 0.05),
  };

  // Three protectants, three products. Hues chosen to stay clear of the amber
  // and green already used for the lumen and shell CIRCUITS on the wiki —
  // these read as liquid, not as a legend.
  const CHANNELS = [
    { id: "CH1", culture: 0xa8781a, product: 0xf0a020, turb: 0.62 },
    { id: "CH2", culture: 0x5c8a34, product: 0x14c47c, turb: 0.50 },
    { id: "CH3", culture: 0x74549e, product: 0x8a54d6, turb: 0.71 },
  ];

  function liquid(col, turbidity) {
    // Turbidity scales how much light gets through — a denser culture is a
    // lower transmission, not a lower alpha (alpha would kill the specular).
    // The emissive is what actually carries the hue: seen through vial glass
    // under ACES, transmitted colour alone desaturates to grey.
    return new THREE.MeshPhysicalMaterial({
      color: col, metalness: 0, roughness: 0.32,
      transmission: 0.48 - turbidity * 0.34, ior: 1.34,
      transparent: true, opacity: 1, envMapIntensity: 0.45,
      emissive: col, emissiveIntensity: 0.58,
      side: THREE.DoubleSide, depthWrite: false,
    });
  }

  // ---------- geometry helpers ----------
  function box(w, h, d, mat, x, y, z, name) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.name = name || "";
    scene.add(m); return m;
  }
  function cyl(r, h, mat, pos, axis, name) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), mat);
    if (axis === "z") m.rotation.x = Math.PI / 2;
    if (axis === "x") m.rotation.z = Math.PI / 2;
    m.position.copy(pos); m.name = name || "";
    scene.add(m); return m;
  }

  // ---------- enclosure ----------
  // Built as a frame, not a solid: the bay has to be open to camera.
  const T = 6;                                    // wall thickness
  box(BOX_W, T, BOX_D, M.shell(), 0, T / 2, 0);                       // floor
  box(BOX_W, T, BOX_D, M.shellL(), 0, BOX_H - T / 2, 0);              // lid
  box(T, BOX_H, BOX_D, M.shell(), X0 + T / 2, BOX_H / 2, 0);          // left wall
  box(T, BOX_H, BOX_D, M.shell(), -X0 - T / 2, BOX_H / 2, 0);         // right wall
  box(BOX_W, BOX_H, T, M.shell(), 0, BOX_H / 2, -ZF + T / 2);         // back wall

  // front frame around the window opening
  box(BOX_W, BAY_Y0 - 6, T, M.shellL(), 0, (BAY_Y0 - 6) / 2 + 6, ZF - T / 2);
  box(BOX_W, BOX_H - (BAY_Y0 + CASS_H) - 4, T, M.shellL(),
      0, (BAY_Y0 + CASS_H) + (BOX_H - (BAY_Y0 + CASS_H) - 4) / 2, ZF - T / 2);
  box(40, CASS_H, T, M.shellL(), MOTOR_X - 5, BAY_Y0 + CASS_H / 2, ZF - T / 2);

  // shared drive spine — one shaft, three heads, one motor
  cyl(4, 210, M.steel(), new THREE.Vector3(X0 + 130, 212, -45), "x", "shaft");
  CASS_LEFT.forEach(function (cl) {
    box(30, 44, 44, M.plate(), cl + CASS_W / 2, 212, -45);
  });
  box(34, 36, 60, M.dark(), MOTOR_X - 4, 212, -45, "motor");

  // heater / fan hint, low and behind
  box(150, 26, 40, M.dark(), X0 + 120, 30, -60);

  // ---------- backdrop ----------
  const backdrop = new THREE.MeshStandardMaterial({
    color: 0x06080b, metalness: 0, roughness: 0.95, envMapIntensity: 0.12,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), backdrop);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2200), backdrop);
  wall.position.z = -520;
  scene.add(wall);

  // ---------- cassettes ----------
  const glowMats = [];
  const glowHalos = [];
  const flowMats = [];

  function pulseTexture(hex) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 4;
    const g = c.getContext("2d");
    const col = new THREE.Color(hex);
    const rgb = [Math.round(col.r * 255), Math.round(col.g * 255), Math.round(col.b * 255)].join(",");
    const grad = g.createLinearGradient(0, 0, 46, 0);
    grad.addColorStop(0.0, "rgba(" + rgb + ",0)");
    grad.addColorStop(0.5, "rgba(" + rgb + ",1)");
    grad.addColorStop(1.0, "rgba(" + rgb + ",0)");
    g.fillStyle = grad; g.fillRect(0, 0, 46, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;            // without this it washes to white
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function routeTube(pts, radius) {
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 12), radius, 14, false);
    const m = new THREE.Mesh(geo, M.tube());
    scene.add(m);
    return curve;
  }

  function routeFlow(curve, hex, radius) {
    const geo = new THREE.TubeGeometry(curve, 160, radius, 12, false);
    const tex = pulseTexture(hex);
    tex.repeat.set(Math.max(2, curve.getLength() / 40), 1);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.95,
    });
    scene.add(new THREE.Mesh(geo, mat));
    flowMats.push({ mat: mat, len: curve.getLength() });
  }

  function buildCassette(i) {
    const ch = CHANNELS[i];
    const cultureMat = liquid(ch.culture, ch.turb);
    const productMat = liquid(ch.product, 0.12);

    // backplate + handle
    box(CASS_W, CASS_H, 5, M.plate(), CASS_LEFT[i] + CASS_W / 2, BAY_Y0 + CASS_H / 2, CASS_ZF - CASS_D + 3);
    box(54, 9, 16, M.shellL(), CASS_LEFT[i] + 35, BAY_Y0 + 211, CASS_ZF - 12);

    // --- L1, hard against the window: the two vials ---
    // Culture left, harvest right, on the SAME centreline. Everything the pan
    // has to read lives in one horizontal row — spread it vertically and no
    // single framing catches all of it.
    [[15, cultureMat, 0.86], [55, productMat, 0.90]].forEach(function (v) {
      const lx = v[0];
      cyl(13, 62, M.glass(), P(i, lx, 76, 16), "y");
      cyl(11.4, v[2] * 58, v[1], P(i, lx, 76 - (62 - v[2] * 58) / 2 + 1, 16), "y");
    });
    // sterile vent on the culture vial
    cyl(7, 9, M.white(), P(i, 15, 111, 16), "y");
    // probes down into the harvest vial
    cyl(1.8, 46, M.steel(), P(i, 51, 78, 16), "y");
    cyl(1.8, 46, M.steel(), P(i, 59, 78, 16), "y");

    // --- L2: the flow cell, the only self-lit part, between the two vials ---
    // A lit box reads as a pale card. A dark housing with a narrow lit slit
    // reads as an instrument looking at something.
    box(15, 32, 15, M.dark(), CASS_LEFT[i] + 35, BAY_Y0 + 78, CASS_ZF - 44);
    const fcMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a08, metalness: 0.1, roughness: 0.4,
      emissive: 0xff9024, emissiveIntensity: 1.5,
    });
    glowMats.push(fcMat);
    box(3.5, 22, 2, fcMat, CASS_LEFT[i] + 35, BAY_Y0 + 78, CASS_ZF - 36.2);
    // additive halo — emissive alone reads as a pale panel, not a lamp
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(13, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff9430, transparent: true, opacity: 0.11,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    halo.position.copy(P(i, 35, 78, 38));
    scene.add(halo);
    glowHalos.push(halo.material);

    // --- L3: membrane, back plane, above the row, in silhouette ---
    cyl(6, 100, M.white(), P(i, 30, 160, 70), "y", "membrane" + i);
    cyl(7.5, 8, M.plate(), P(i, 30, 112, 70), "y");
    cyl(7.5, 8, M.plate(), P(i, 30, 208, 70), "y");
    cyl(7, 26, M.glass(), P(i, 58, 132, 50), "y");        // bubble trap, out of the row

    // --- L4: pump loop reaching back to its head ---
    const loop = [
      P(i, 44, 176, 108), P(i, 46, 196, 112), P(i, 52, 203, 113),
      P(i, 58, 196, 112), P(i, 60, 176, 108),
    ];
    routeFlow(routeTube(loop, 2.6), ch.culture, 1.9);

    // --- tubing: diagonals, never verticals ---
    const lumen = [
      [P(i, 15, 110, 16), P(i, 18, 138, 42), P(i, 36, 166, 96), P(i, 44, 176, 108)],
      [P(i, 60, 176, 108), P(i, 52, 152, 96), P(i, 36, 122, 76), P(i, 30, 112, 70)],
      [P(i, 30, 210, 70), P(i, 26, 186, 62), P(i, 34, 120, 48), P(i, 35, 94, 44)],
      [P(i, 35, 62, 44), P(i, 26, 74, 32), P(i, 17, 106, 18)],
    ];
    lumen.forEach(function (pts) { routeFlow(routeTube(pts, 2.6), ch.culture, 1.9); });

    const shell = [P(i, 34, 172, 70), P(i, 48, 150, 58), P(i, 56, 110, 18)];
    routeFlow(routeTube(shell, 2.6), ch.product, 1.9);
  }
  CHANNELS.forEach(function (_, i) { buildCassette(i); });

  // ---------- render ----------
  const FLOW_SPEED = 46, DASH_MM = 40;
  function setTime(t) {
    flowMats.forEach(function (f) { f.mat.map.offset.x = -(t * FLOW_SPEED) / DASH_MM; });
    glowMats.forEach(function (m, i) {
      m.emissiveIntensity = 1.4 + 0.35 * Math.sin(t * 2.2 + i * 2.1);
    });
    glowHalos.forEach(function (m, i) {
      m.opacity = 0.10 + 0.035 * Math.sin(t * 2.2 + i * 2.1);
    });
  }

  // interactive orbit, for eyeballing the massing
  let yaw = 0, pitch = 0.10, dist = 620;
  const TARGET = new THREE.Vector3(X0 + 140, 150, 20);
  function place() {
    camera.position.set(
      TARGET.x + dist * Math.sin(yaw) * Math.cos(pitch),
      TARGET.y + dist * Math.sin(pitch),
      TARGET.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(TARGET);
  }
  function render() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    place();
    renderer.render(scene, camera);
  }
  let drag = null;
  canvas.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointerup", function () { drag = null; });
  window.addEventListener("pointermove", function (e) {
    if (!drag) return;
    yaw -= (e.clientX - drag.x) * 0.006;
    pitch = Math.max(-0.5, Math.min(0.8, pitch + (e.clientY - drag.y) * 0.004));
    drag = { x: e.clientX, y: e.clientY };
    render();
  });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    dist = Math.max(160, Math.min(1400, dist + e.deltaY * 0.7));
    render();
  }, { passive: false });
  window.addEventListener("resize", render);

  let t0 = performance.now();
  let live = true;
  (function tick(now) {
    if (live) { setTime((now - t0) / 1000); render(); }
    requestAnimationFrame(tick);
  })(t0);

  // ---------- the pan ----------
  // A true lateral dolly: camera and target translate together, so the frame
  // never rotates. Rotating would flatten the parallax the depth stack exists
  // to create.
  const PAN = { hold: 1.2, move: 3.0, tail: 1.4 };
  const STOPS = CASS_LEFT.map(function (cl) { return cl + CASS_W / 2; });
  // The row spans world y 84..155. Framing is solved against the VIAL plane
  // (z = CASS_ZF - 16), not the target plane — at this range the difference is
  // 30% of the visible height.
  const PAN_Y = 120, PAN_Z = 58;
  const VIAL_Z = CASS_ZF - 16;
  const PAN_DIST = (54 / Math.tan(THREE.MathUtils.degToRad(26) * 0.5))
                   + (VIAL_Z - PAN_Z);

  function panLength() {
    return PAN.hold * 2 + PAN.move * 2 + PAN.tail;
  }
  function smooth(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }

  function panX(t) {
    const seg = PAN.hold + PAN.move;
    if (t < PAN.hold) return STOPS[0];
    for (let i = 0; i < 2; i++) {
      const a = PAN.hold + i * seg;
      if (t < a + PAN.move) return STOPS[i] + (STOPS[i + 1] - STOPS[i]) * smooth((t - a) / PAN.move);
      if (t < a + PAN.move + PAN.hold) return STOPS[i + 1];
    }
    return STOPS[2];
  }

  function panFrame(t, w, h, bg) {
    live = false;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    setTime(t);
    const x = panX(t);
    camera.position.set(x, PAN_Y + 8, PAN_Z + PAN_DIST);
    camera.lookAt(new THREE.Vector3(x, PAN_Y, PAN_Z));
    renderer.render(scene, camera);

    const c2 = window.__pkg._c2 || (window.__pkg._c2 = document.createElement("canvas"));
    c2.width = w; c2.height = h;
    const g = c2.getContext("2d");
    g.fillStyle = bg || "#06070a";
    g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0);

    // channel tag, brightest when that channel is centred in frame
    const S = h / 1080;
    STOPS.forEach(function (sx, i) {
      const a = Math.max(0, 1 - Math.abs(x - sx) / 46);
      if (a < 0.02) return;
      g.save();
      g.globalAlpha = a;
      g.font = "700 " + Math.round(34 * S) + "px ui-monospace, Menlo, monospace";
      g.fillStyle = "rgba(238,244,255,0.96)";
      g.shadowColor = "rgba(0,0,0,0.9)"; g.shadowBlur = 14 * S;
      g.fillText(CHANNELS[i].id, 64 * S, h - 62 * S);
      g.font = "400 " + Math.round(19 * S) + "px ui-sans-serif, -apple-system, Helvetica, sans-serif";
      g.fillStyle = "rgba(186,200,222,0.9)";
      g.fillText("protectant " + (i + 1) + " of 3", 64 * S, h - 36 * S);
      g.restore();
    });
    return c2.toDataURL("image/png");
  }

  window.__pkg = {
    scene: scene, camera: camera, renderer: renderer,
    ready: function () { return true; },
    panFrame: panFrame, panLength: panLength,
    look: function (y, p, d) { yaw = y; pitch = p; if (d) dist = d; render(); },
    frame: function (yawA, pitchA, distA, w, h, bg, t) {
      live = false;
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      setTime(t || 0);
      yaw = yawA; pitch = pitchA; dist = distA;
      place();
      renderer.render(scene, camera);
      const c2 = window.__pkg._c2 || (window.__pkg._c2 = document.createElement("canvas"));
      c2.width = w; c2.height = h;
      const g = c2.getContext("2d");
      g.fillStyle = bg || "#06070a"; g.fillRect(0, 0, w, h);
      g.drawImage(canvas, 0, 0);
      return c2.toDataURL("image/png");
    },
  };
})();
