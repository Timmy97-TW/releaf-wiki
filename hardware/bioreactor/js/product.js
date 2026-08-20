// Final product — assembled and coloured.
//
// Geometry comes from placed/, which is the Onshape glTF with every instance's
// world transform already baked in (see scratchpad/bake_gltf.py). One STL per
// instance, so the three pumps can each take a different accent.
//
// Parts are keyed by (name, mesh index). The names collide across Part Studios
// — "Part 1" is six different geometries — so the name alone is not an id.
(function () {
  const canvas = document.getElementById("gl");
  const hud = document.getElementById("hud");

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.80;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 1, 20000);
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;                 // Onshape Z-up -> three.js Y-up
  scene.add(root);

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
  const key = new THREE.DirectionalLight(0xfff6ec, 0.32); key.position.set(400, 700, 800); scene.add(key);
  const rimC = new THREE.DirectionalLight(0xbcd0e6, 0.24); rimC.position.set(-600, 300, -600); scene.add(rimC);
  const rimW = new THREE.DirectionalLight(0xffd9a8, 0.20); rimW.position.set(600, -150, -500); scene.add(rimW);

  // ---------- palette (carried over from the wiki's photometer scene) ----------
  function std(col, m, r, e) {
    return new THREE.MeshStandardMaterial({ color: col, metalness: m, roughness: r, envMapIntensity: e });
  }
  const P = {
    boxBlack:  function () { return std(0x0a0c10, 0.22, 0.62, 0.30); },  // enclosure, "black for now"
    blackPrint:function () { return std(0x1d2025, 0.16, 0.58, 0.80); },
    charcoal:  function () { return std(0x2a2d33, 0.22, 0.55, 0.75); },
    probeBlack:function () { return std(0x121417, 0.20, 0.50, 0.85); },
    greyLight: function () { return std(0x9aa2ab, 0.30, 0.48, 0.90); },
    white:     function () { return std(0xe4e6e8, 0.04, 0.62, 0.80); },
    steel:     function () { return std(0xb8bcc2, 0.88, 0.34, 1.10); },
    pcb:       function () { return std(0x14306b, 0.18, 0.52, 0.85); },
    navy:      function () { return std(0x1f3f74, 0.12, 0.45, 0.95); },
    cable:     function () { return std(0x17181a, 0.05, 0.72, 0.60); },
    glass:     function () {
      return new THREE.MeshPhysicalMaterial({
        color: 0xeaf4ff, metalness: 0, roughness: 0.02, transmission: 0.86, ior: 1.5,
        transparent: true, opacity: 1, envMapIntensity: 3.4, clearcoat: 1,
        emissive: 0x93bce4, emissiveIntensity: 0.30, side: THREE.DoubleSide, depthWrite: false });
    },
    vessel:    function () {
      return new THREE.MeshPhysicalMaterial({
        color: 0xbfd0e0, metalness: 0, roughness: 0.06, transmission: 0.92, ior: 1.5,
        transparent: true, opacity: 1, envMapIntensity: 1.3, clearcoat: 1,
        clearcoatRoughness: 0.08, emissive: 0x6d8ba8, emissiveIntensity: 0.04,
        side: THREE.FrontSide, depthWrite: false });
    },
    // The protectant reservoir carries its channel's accent: a light tint in
    // the glass plus a low emissive, so it reads as a glow rather than as
    // coloured plastic.
    vesselTinted: function (hex) {
      // At 0.92 transmission the material's own colour contributes almost
      // nothing — the tint was applied and simply invisible. The glow has to
      // come from emissive, which transmission does not wash out, with the
      // transmission pulled back far enough for the hue to hold.
      const base = new THREE.Color(0xbfd0e0).lerp(new THREE.Color(hex), 0.6);
      return new THREE.MeshPhysicalMaterial({
        color: base, metalness: 0, roughness: 0.06, transmission: 0.80, ior: 1.5,
        transparent: true, opacity: 1, envMapIntensity: 1.2, clearcoat: 1,
        clearcoatRoughness: 0.08, emissive: hex, emissiveIntensity: 0.55,
        side: THREE.FrontSide, depthWrite: false });
    },
    pumpBlack: function () { return std(0x121519, 0.20, 0.48, 0.55); },
    // The window uses plain alpha, not transmission. A transmissive panel
    // samples a buffer that excludes other transmissive objects, so the
    // reservoirs behind it would vanish.
    window:    function () {
      return new THREE.MeshPhysicalMaterial({
        color: 0x5d6a79, metalness: 0, roughness: 0.07,
        transparent: true, opacity: 0.10, envMapIntensity: 1.3,
        // depthWrite stays off so the panel can sit opaque over everything at
        // the start of the reveal and then clear without a depth pop
        clearcoat: 1, clearcoatRoughness: 0.05,
        // the wall interpenetrates the chamber sides in CAD; without the
        // offset those coincident faces stripe
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        side: THREE.DoubleSide, depthWrite: false });
    },
    led:       function () {
      return new THREE.MeshStandardMaterial({
        color: 0x2a1a08, metalness: 0.1, roughness: 0.35,
        emissive: 0xff9024, emissiveIntensity: 1.6 });
    },
  };

  // One accent per pump, a different one per channel. Same treatment as the
  // original blue pump — light grey body, saturated accent on the moving parts.
  // Blue / green / red, kept dark. The env has to stay low: at full intensity
  // the studio dome plus ACES lifts these straight back to pastel.
  const PUMP_ACCENT = [0x1b4a75, 0x1d6b45, 0x8a2f2a];   // ch0 blue, ch1 green, ch2 red
  const accentMat = PUMP_ACCENT.map(function (c) { return std(c, 0.12, 0.48, 0.34); });
  const protectantMat = PUMP_ACCENT.map(function (c) { return P.vesselTinted(c); });

  // ---------- part -> role map, keyed "name|mesh" ----------
  // Anything not listed falls through to `charcoal`, so an unmapped part shows
  // up as neutral rather than disappearing.
  const ROLE = {
    // enclosure — black
    "Part 1|47": "box",        // the three chambers
    "Part 11|50": "box",       // right wall
    "Part 2|58": "boxFront",   // front face — the window
    "Part 12|48": "boxLid",    // cover, hidden by default

    // photometer
    "Part 7|34": "photoBody",
    "Part 3|18": "photoBody",
    // The two tall boxes under each pump are the reservoirs. Seen from the
    // front (the wall sits at -Y, so +X is screen right) the higher-x one is
    // the protectant side.
    "Part 3|16": "reservoirCulture",
    "Part 4|37": "reservoirProtectant",
    "LED Bulb|53": "led",

    // membrane + probes
    "Part 1|19": "probe",      // sensor — tapered tip + collar, one of the pair
    "Part 1|27": "probe",      // sensor — the second of the pair
    "Part 14|42": "probe",
    "Part 11|12": "probe",

    // pump
    "Casing|33": "pumpBody",
    "Cover|36": "pumpBody",
    "Box|21": "pumpBody",
    "Cut Box Lid|11": "pumpBody",
    "Front Rotor|26": "pumpAccent",
    "Back Rotor|46": "pumpAccent",
    "Knob|55": "pumpAccent",
    "Bearing|29": "steel",
    "Pinion|59": "steel",
    "NEMA 17|57": "motor",

    // electronics + air
    "Board|10": "pcb",
    "OLED Display|14": "screen",
    "Air Grill|40": "charcoal",
    "Fan Fastener|56": "charcoal",
      };

  function roleFor(name, mesh) {
    const k = name + "|" + mesh;
    if (ROLE[k]) return ROLE[k];
    if (/^Hex |^Prevailing/.test(name)) return "steel";
    if (/^(0805|CHIPLED|SOD-|SOT2|SOT3|RESPACK|INDUCTOR|JST_|OLED_1)/.test(name)) return "smd";
    return "charcoal";
  }

  const shared = {
    box: P.boxBlack(), boxLid: P.boxBlack(), boxFront: P.window(),
    photoBody: P.blackPrint(),
    reservoirCulture: P.vessel(), reservoirProtectant: P.vessel(),
    membrane: P.white(), membraneHousing: P.greyLight(), probe: P.probeBlack(),
    pumpBody: P.pumpBlack(), steel: P.steel(), motor: P.blackPrint(),
    pcb: P.pcb(), screen: P.navy(), charcoal: P.charcoal(), smd: P.cable(),
    led: P.led(), glass: P.glass(),
  };

  function materialFor(role, ch) {
    if (role === "pumpAccent") return accentMat[Math.max(0, ch)];
    if (role === "reservoirProtectant") return protectantMat[Math.max(0, ch)];
    return shared[role] || shared.charcoal;
  }

  // ---------- load ----------
  // Parts that turn with the pump. The knob is a manual adjuster and stays put.
  const SPINS = { "Front Rotor|26": 1, "Back Rotor|46": 1, "Pinion|59": 1 };
  const spinners = [];
  const dimReg = [];
  const parts = [];
  const loader = new THREE.STLLoader();
  let showFasteners = false;

  fetch("placed/_manifest.json", { cache: "reload" })
    .then(function (r) { return r.json(); })
    .then(function (man) {
      const wanted = man.filter(function (e) {
        return showFasteners || !/^Hex |^Prevailing/.test(e.name);
      });
      let done = 0;
      hud.textContent = "loading 0/" + wanted.length;
      wanted.forEach(function (e) {
        loader.load("placed/" + encodeURIComponent(e.file), function (geo) {
          geo.computeVertexNormals();
          const role = roleFor(e.name, e.mesh);
          const mesh = new THREE.Mesh(geo, materialFor(role, e.ch));
          if (role === "boxFront") mesh.renderOrder = 10;
          if (role === "boxLid") mesh.visible = false;      // off by default
          mesh.name = e.name + "|" + e.mesh + "|ch" + e.ch;
          mesh.userData = { name: e.name, mesh: e.mesh, ch: e.ch, role: role };
          // Roles share one material instance, so dimming one channel would
          // dim all three. Channel parts get their own copy.
          if (e.ch >= 0) {
            mesh.material = mesh.material.clone();
            const m = mesh.material;
            dimReg.push({ mesh: mesh, col: m.color.clone(), env: m.envMapIntensity,
                          emc: m.emissive ? m.emissive.clone() : null,
                          emI: m.emissiveIntensity || 0 });
          }
          // must come after userData is assigned, or the flag gets wiped
          if (SPINS[e.name + "|" + e.mesh]) {
            geo.computeBoundingBox();
            const c = new THREE.Vector3();
            geo.boundingBox.getCenter(c);
            geo.translate(-c.x, -c.y, -c.z);   // recentre on the rotor's own axis
            mesh.position.copy(c);
            mesh.userData.spin = true;
            spinners.push(mesh);
          }
          root.add(mesh);
          parts.push(mesh);
          if (++done % 20 === 0) hud.textContent = "loading " + done + "/" + wanted.length;
          if (done === wanted.length) finish(wanted.length);
        }, undefined, function () { if (++done === wanted.length) finish(wanted.length); });
      });
      function finish(n) {
        const roles = {};
        parts.forEach(function (p) { roles[p.userData.role] = (roles[p.userData.role] || 0) + 1; });
        hud.innerHTML = n + " instances<br>" +
          Object.keys(roles).sort().map(function (k) { return k + " " + roles[k]; }).join(" · ");
        fitAll(); render();
      }
    });

  // ---------- camera ----------
  let yaw = 0.75, pitch = 0.30, dist = 1200;
  const TARGET = new THREE.Vector3();
  function fitAll() {
    const b = new THREE.Box3().setFromObject(root);
    b.getCenter(TARGET);
    const s = new THREE.Vector3(); b.getSize(s);
    dist = Math.max(s.x, s.y, s.z) * 1.7;
  }
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
    place(); renderer.render(scene, camera);
  }
  let drag = null;
  canvas.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointerup", function () { drag = null; });
  window.addEventListener("pointermove", function (e) {
    if (!drag) return;
    yaw -= (e.clientX - drag.x) * 0.006;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - drag.y) * 0.004));
    drag = { x: e.clientX, y: e.clientY };
    render();
  });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    dist = Math.max(60, Math.min(6000, dist + e.deltaY * 1.4));
    render();
  }, { passive: false });
  window.addEventListener("resize", render);

  // 40 RPM puts exactly 4 revolutions in 6 seconds, and a 3-roller head repeats
  // every 120 degrees, so a 6s capture loops seamlessly.
  // ---------- label card ----------
  // Same design as the bioreactor tour: lower-left caption with a leader up
  // the empty margin, over a scrim. Drawn in 2D at capture resolution so it
  // stays sharp however close the camera gets.
  let scrimCache = null;
  function scrim(w, h) {
    if (scrimCache && scrimCache.width === w && scrimCache.height === h) return scrimCache;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const v = g.createLinearGradient(0, h, 0, h * 0.52);
    v.addColorStop(0, "rgba(3,4,6,0.86)");
    v.addColorStop(1, "rgba(3,4,6,0)");
    g.fillStyle = v; g.fillRect(0, h * 0.52, w, h * 0.48);
    const x = g.createLinearGradient(0, 0, w * 0.70, 0);
    x.addColorStop(0, "rgba(0,0,0,1)");
    x.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = x; g.fillRect(0, 0, w, h);
    scrimCache = c;
    return c;
  }

  function drawCard(g, w, h, idx, a, box) {
    const P3 = PROTECTANTS[idx];
    const acc = new THREE.Color(PUMP_ACCENT[idx]);
    const rgb = [Math.round(acc.r * 255), Math.round(acc.g * 255), Math.round(acc.b * 255)];
    // the pump hues are deliberately dark; lift them for type and rules
    const bright = acc.clone().offsetHSL(0, 0.12, 0.30);
    const brgb = [Math.round(bright.r * 255), Math.round(bright.g * 255), Math.round(bright.b * 255)].join(",");
    const S = h / 1080;

    g.save(); g.globalAlpha = a * 0.94;
    g.drawImage(scrim(w, h), 0, 0);
    g.restore();

    const bx = w * 0.068, by = h * 0.875;
    const c = new THREE.Vector3(); box.getCenter(c);
    camera.updateMatrixWorld(true);
    const p = c.clone().project(camera);
    const ax = Math.min(Math.max((p.x * 0.5 + 0.5) * w, w * 0.12), w * 0.88);
    const ay = Math.min(Math.max((-p.y * 0.5 + 0.5) * h, h * 0.14), h * 0.70);

    g.save();
    g.globalAlpha = a;
    g.strokeStyle = "rgba(" + brgb + ",0.85)";
    g.lineWidth = Math.max(1, 1.6 * S);
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, ay + (by - ay) * 0.55);
    g.lineTo(bx, by);
    g.lineTo(bx + w * 0.30 * a, by);
    g.stroke();

    const halo = g.createRadialGradient(ax, ay, 0, ax, ay, 28 * S);
    halo.addColorStop(0, "rgba(" + brgb + ",0.5)");
    halo.addColorStop(1, "rgba(" + brgb + ",0)");
    g.fillStyle = halo;
    g.beginPath(); g.arc(ax, ay, 28 * S, 0, 6.283); g.fill();
    g.fillStyle = "rgba(" + brgb + ",1)";
    g.beginPath(); g.arc(ax, ay, 4.5 * S, 0, 6.283); g.fill();
    g.strokeStyle = "rgba(" + brgb + ",0.45)";
    g.lineWidth = Math.max(1, 1.2 * S);
    g.beginPath(); g.arc(ax, ay, 14 * S, 0, 6.283); g.stroke();

    // one inset for both edges, measured to the descender
    const pad = 24 * S, tx = bx + pad, roleSize = 25 * S;
    const yRole = by - pad - roleSize * 0.22;
    const yName = yRole - 46 * S;
    const yTag = yName - 58 * S;   // 40 let the title's ascenders hit the tag
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.shadowColor = "rgba(0,0,0,0.92)"; g.shadowBlur = 16 * S;

    g.font = "600 " + Math.round(20 * S) + "px ui-monospace, Menlo, monospace";
    g.fillStyle = "rgba(" + brgb + ",0.96)";
    g.fillText("0" + (idx + 1) + " / 03   PROTECTANT", tx, yTag);

    g.font = "700 " + Math.round(52 * S) + "px ui-sans-serif, -apple-system, Helvetica, Arial, sans-serif";
    g.fillStyle = "rgba(242,247,255,0.99)";
    g.fillText(P3.name, tx, yName);

    g.font = "400 " + Math.round(roleSize) + "px ui-sans-serif, -apple-system, Helvetica, Arial, sans-serif";
    g.fillStyle = "rgba(192,206,226,0.9)";
    g.fillText(P3.sub, tx, yRole);
    g.restore();

    g.save();
    g.globalAlpha = Math.min(1, a * 1.2);
    const tw = 26 * S, gap = 10 * S;
    let px = w - w * 0.068 - (3 * tw + 2 * gap);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i === idx ? "rgba(" + brgb + ",0.95)"
                  : i < idx ? "rgba(210,224,244,0.32)" : "rgba(210,224,244,0.12)";
      g.fillRect(px, by - 3 * S, tw, 3 * S);
      px += tw + gap;
    }
    g.restore();
  }

  // ---------- reveal + chamber tour ----------
  // Closed box, lid lifts away, front wall clears, then a push into chamber 1
  // and a track across all three. Camera works in scene space: root is rotated
  // -90 about X, so an Onshape point (x,y,z) lands at (x, z, -y) and the box
  // front faces +Z.
  const PROTECTANTS = [
    { name: "ACC deaminase", sub: "chamber 1 \u00b7 own culture and harvest" },
    { name: "LEA peptide",   sub: "chamber 2 \u00b7 own culture and harvest" },
    { name: "BoPep4",        sub: "chamber 3 \u00b7 own culture and harvest" },
  ];
  // The push overlaps the reveal — waiting for the lid to finish before moving
// put a dead beat in the middle of the clip.
  // Short holds, longer travel. The complaint was static screen time, not
  // that the moves were slow, and a slow creep while held keeps even the
  // hold from reading as a freeze.
  const AN = { intro: 0.7, open: 1.2, push: 1.2, hold: 0.5, move: 1.0, tail: 0.45,
               overlap: 0.5, creep: 0.035 };

  const FRAME_ROLES = {
    pumpBody: 1, pumpAccent: 1, reservoirCulture: 1, reservoirProtectant: 1,
    probe: 1, screen: 1,
  };
  let chBox = null, allBox = null, lidMesh = null, frontMat = null;
  function measure() {
    if (chBox) return;
    chBox = [new THREE.Box3(), new THREE.Box3(), new THREE.Box3()];
    allBox = new THREE.Box3();
    parts.forEach(function (p) {
      const b = new THREE.Box3().setFromObject(p);
      allBox.union(b);
      if (p.userData.role === "boxLid") { lidMesh = p; return; }
      if (p.userData.role === "boxFront") { frontMat = p.material; return; }
      // Frame on what the shot is about, not the full extent. The vertical
      // rails run the whole 251mm chamber height, and fitting those in 16:9
      // leaves the chamber filling barely a third of the frame width.
      const c = p.userData.ch;
      if (c >= 0 && c < 3 && FRAME_ROLES[p.userData.role]) chBox[c].union(b);
    });
  }

  function pushStart() { return AN.intro + AN.open * AN.overlap; }
  function animLength() {
    return pushStart() + AN.push + 3 * AN.hold + 2 * AN.move + AN.tail;
  }
  function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }

  function lookFrom(target, dist, yaw, pitch) {
    camera.position.set(
      target.x + dist * Math.sin(yaw) * Math.cos(pitch),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(target);
  }

  // fit a box with headroom, solving against its NEAR face
  function fitDist(b, margin) {
    const s = new THREE.Vector3(); b.getSize(s);
    const vH = THREE.MathUtils.degToRad(camera.fov) * 0.5;
    const hH = Math.atan(Math.tan(vH) * camera.aspect);
    return margin * Math.max(s.y * 0.5 / Math.tan(vH), s.x * 0.5 / Math.tan(hH)) + s.z * 0.5;
  }

  function ndcCentre(b) {
    // project() reads matrixWorldInverse, which three.js only refreshes during
    // render — without this the measurement is a frame behind the camera.
    camera.updateMatrixWorld(true);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x,
                                  i & 2 ? b.max.y : b.min.y,
                                  i & 4 ? b.max.z : b.min.z).project(camera);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return { x: (x0 + x1) * 0.5, y: (y0 + y1) * 0.5 };
  }

  // All three chambers are the same geometry at the same height, differing
  // only in x, so the centring offset is identical for all of them. Solve it
  // once and apply it to every chamber target — correcting per frame instead
  // makes the offset jump when the active chamber switches mid-move.
  let corr = null, corrAspect = 0;
  function centringOffset(box, dist, yaw, pitch) {
    if (corr && corrAspect === camera.aspect) return corr;
    const t = new THREE.Vector3(); box.getCenter(t);
    lookFrom(t, dist, yaw, pitch);
    const c = ndcCentre(box);
    const vH = THREE.MathUtils.degToRad(camera.fov) * 0.5;
    const hH = Math.atan(Math.tan(vH) * camera.aspect);
    corr = new THREE.Vector3(c.x * dist * Math.tan(hH), c.y * dist * Math.tan(vH), 0);
    corrAspect = camera.aspect;
    return corr;
  }

  function animFrame(t, w, h, bg) {
    live = false;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    measure();
    setTime(t);

    // --- lid and front wall ---
    const openU = ease((t - AN.intro) / AN.open);
    if (lidMesh) {
      // A long lift just throws the lid out of frame. Short rise, then a
      // dissolve, so the opening reads as an opening.
      lidMesh.visible = openU < 0.995;
      lidMesh.position.z = ease(openU / 0.8) * 175;   // local +Z is world up
      lidMesh.material.transparent = true;
      lidMesh.material.opacity = 1 - ease((openU - 0.45) / 0.5);
      lidMesh.material.depthWrite = lidMesh.material.opacity > 0.85;
    }
    if (frontMat) {
      frontMat.opacity = 1 - 0.90 * openU;
      frontMat.color.copy(new THREE.Color(0x0a0c10)).lerp(new THREE.Color(0x5d6a79), openU);
      frontMat.roughness = 0.62 + (0.07 - 0.62) * openU;
      frontMat.metalness = 0.22 * (1 - openU);
      frontMat.clearcoat = openU;
      frontMat.envMapIntensity = 0.30 + (1.3 - 0.30) * openU;
    }

    // --- camera ---
    const wideC = new THREE.Vector3(); allBox.getCenter(wideC);
    const wideD = fitDist(allBox, 1.32);
    const tPush = pushStart();
    const tFirst = tPush + AN.push;
    const cycle = AN.hold + AN.move;

    const chD = chBox.map(function (b) { return fitDist(b, 0.86); });
    const off = centringOffset(chBox[1], chD[1], 0, 0.09);
    const chC = chBox.map(function (b) {
      const v = new THREE.Vector3(); b.getCenter(v); return v.add(off);
    });

    let tgt = new THREE.Vector3(), dist, yaw, pitch, idx = -1, cap = 0;
    if (t < tPush) {
      tgt.copy(wideC); dist = wideD; yaw = 0; pitch = 0.34;
    } else if (t < tFirst) {
      const u = ease((t - tPush) / AN.push);
      tgt.lerpVectors(wideC, chC[0], u);
      dist = wideD + (chD[0] - wideD) * u;
      yaw = 0; pitch = 0.34 - 0.25 * u;
      idx = 0; cap = Math.max(0, (u - 0.65) / 0.35);
    } else {
      const local = t - tFirst;
      let i = Math.min(2, Math.floor(local / cycle));
      const p = local - i * cycle;
      yaw = 0; pitch = 0.09;
      if (p < AN.hold || i === 2) {
        tgt.copy(chC[i]); idx = i; cap = 1;
        const hp = Math.min(1, p / AN.hold);
        dist = chD[i] * (1 - AN.creep * hp);       // never fully static
        if (i === 2 && p > AN.hold) cap = 1 - ease((p - AN.hold) / AN.tail);
      } else {
        const q = ease((p - AN.hold) / AN.move);
        tgt.lerpVectors(chC[i], chC[i + 1], q);
        dist = chD[i] * (1 - AN.creep) + (chD[i + 1] - chD[i] * (1 - AN.creep)) * q;
        if (q < 0.5) { idx = i; cap = 1 - ease(q / 0.45); }
        else { idx = i + 1; cap = ease(Math.max(0, (q - 0.55) / 0.45)); }
      }
    }
    setChannelFocus(idx, cap * 0.9);
    lookFrom(tgt, dist, yaw, pitch);
    renderer.render(scene, camera);

    const c2 = window.__prod._c2 || (window.__prod._c2 = document.createElement("canvas"));
    c2.width = w; c2.height = h;
    const g = c2.getContext("2d");
    g.fillStyle = bg || "#06070a"; g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0);
    if (idx >= 0 && cap > 0.01) drawCard(g, w, h, idx, cap, chBox[idx]);
    return c2.toDataURL("image/png");
  }

  // Drive the other channels toward black in colour and env — never alpha,
  // which would scale their specular and make them look like ghosts.
  function setChannelFocus(ch, d) {
    dimReg.forEach(function (e) {
      const on = ch < 0 || e.mesh.userData.ch === ch;
      const k = on ? 1 : 1 + (0.16 - 1) * d;
      e.mesh.material.color.copy(e.col).multiplyScalar(k);
      e.mesh.material.envMapIntensity = e.env * (on ? 1 : 1 + (0.22 - 1) * d);
      if (e.emc) {
        e.mesh.material.emissive.copy(e.emc);
        e.mesh.material.emissiveIntensity = e.emI * (on ? 1 : k);
      }
    });
  }

  const RPM = 40;
  function setTime(t) {
    const a = t * (RPM / 60) * Math.PI * 2;
    spinners.forEach(function (m) { m.rotation.y = a; });
  }

  let live = true, t0 = performance.now();
  (function tick(now) {
    if (live && parts.length) { setTime((now - t0) / 1000); render(); }
    requestAnimationFrame(tick);
  })(t0);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) t0 = performance.now();
  });

  function shot(w, h, bg) {
    const c2 = window.__prod._c2 || (window.__prod._c2 = document.createElement("canvas"));
    c2.width = w; c2.height = h;
    const g = c2.getContext("2d");
    g.fillStyle = bg || "#06070a"; g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0);
    return c2.toDataURL("image/png");
  }

  window.__prod = {
    scene: scene, root: root, camera: camera, parts: parts, ROLE: ROLE,
    ready: function () { return parts.length > 0; },
    // hide the outer shell so the internals are visible
    setShell: function (on) {
      parts.forEach(function (p) {
        if (/^box/.test(p.userData.role)) p.visible = on && p.userData.role !== "boxLid";
      });
    },
    setLid: function (on) {
      parts.forEach(function (p) {
        if (p.userData.role === "boxLid") p.visible = on;
      });
    },
    only: function (roles) {
      parts.forEach(function (p) { p.visible = !roles || roles.indexOf(p.userData.role) >= 0; });
    },
    all: function () { parts.forEach(function (p) { p.visible = true; }); },
    roles: function () {
      const o = {};
      parts.forEach(function (p) {
        const k = p.userData.role;
        (o[k] = o[k] || []).push(p.userData.name + "|" + p.userData.mesh);
      });
      Object.keys(o).forEach(function (k) { o[k] = Array.from(new Set(o[k])); });
      return o;
    },
    setTime: setTime,
    setLive: function (v) { live = v; },
    animFrame: animFrame, animLength: animLength,
    frame: function (y, p, d, w, h, bg, t) {
      live = false;
      if (t !== undefined) setTime(t);
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      yaw = y; pitch = p;
      if (d) dist = d; else fitAll();
      place(); renderer.render(scene, camera);
      return shot(w, h, bg);
    },
  };
})();
