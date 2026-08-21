/* =============================================================================
   The homepage reactor.
   -----------------------------------------------------------------------------
   The same assembly as hardware/bioreactor/, rendered into the homepage's dark
   act. Everything it knows comes from files that section already owns:

     BIO_PARTS       hardware/bioreactor/js/parts.js
     FLOW_PATHS      hardware/bioreactor/js/flow-paths.js
     BIO_COMPONENTS  hardware/bioreactor/js/components.js
     the meshes      hardware/bioreactor/models/*.stl

   Nothing about the device is described twice, so the homepage cannot end up
   claiming a part the technical record has dropped.

   Three things make this different from the record page's scene.js:

     · IT DOES NOT LOAD UNTIL ASKED. 55 STL files is 6 MB, and a reader who
       never scrolls past the problem section should never pay for it. home.js
       calls start() when the dark act is one screen away.
     · IT DEGRADES TO A PHOTOGRAPH. No WebGL context, or a load that fails,
       adds .no-gl to #rx and the poster underneath takes over.
     · IT EXPOSES highlight(), so the parts list beside the stage can light a
       component up without a second copy of the picker.

   The materials, lighting and flow colours are copied from scene.js on purpose
   rather than imported: that file is an IIFE with no exports, and the two
   scenes are framed differently. If you retune one, retune both.
   ========================================================================== */

window.__homeRx = (function () {
  "use strict";

  var MODEL_BASE = "hardware/bioreactor/models/";
  var api = {
    start: function () {},
    isReady: function () { return false; },
    redraw: function () {},
    highlight: function () {},
    failed: true,
  };

  var canvas = document.getElementById("rx-gl");
  var host = document.getElementById("rx");
  if (!canvas || !host) return api;

  function giveUp() { host.classList.add("no-gl"); }

  if (typeof THREE === "undefined" || typeof BIO_PARTS === "undefined") {
    giveUp();
    return api;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    giveUp();
    return api;
  }
  if (!renderer || !renderer.getContext()) { giveUp(); return api; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 8000);
  var TARGET = new THREE.Vector3(-80, 128, 0);
  var yaw = -0.62, pitch = 0.14, dist = 1780;

  function place() {
    camera.position.set(
      TARGET.x + dist * Math.sin(yaw) * Math.cos(pitch),
      TARGET.y + dist * Math.sin(pitch),
      TARGET.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(TARGET);
  }

  /* ---------- lighting ---------- */
  scene.environment = RQ.studioEnv(renderer);
  var key = new THREE.DirectionalLight(0xfff6ec, 0.38);
  key.position.set(300, 500, 600);
  scene.add(key);
  RQ.enableShadows(renderer, key);
  var rimW = new THREE.DirectionalLight(0xffd9a8, 0.22); rimW.position.set(500, -100, -500); scene.add(rimW);
  var rimC = new THREE.DirectionalLight(0xbcd0e6, 0.30); rimC.position.set(-500, 200, -550); scene.add(rimC);
  // the 520 nm the circuit actually runs on, thrown from the reader's left so
  // the reveal's green light and the scene's green light are the same light
  var sig = new THREE.DirectionalLight(0x3ddc8b, 0.30); sig.position.set(-620, 240, 380); scene.add(sig);

  /* ---------- materials ---------- */
  var std = function (c, m, r, e) {
    return new THREE.MeshPhysicalMaterial({
      color: c, metalness: m,
      roughness: Math.max(0.18, r * 0.72), envMapIntensity: e * 1.35,
      clearcoat: 1, clearcoatRoughness: 0.09 });
  };
  var glassy = function (c, r, t, e, em, ei) {
    return new THREE.MeshPhysicalMaterial({
      color: c, metalness: 0, roughness: r, transmission: t, ior: 1.5,
      transparent: true, opacity: 1, envMapIntensity: e,
      clearcoat: 1, clearcoatRoughness: r * 1.4,
      emissive: em, emissiveIntensity: ei,
      side: THREE.DoubleSide, depthWrite: false });
  };
  var MATERIALS = {
    blackPrint: function () { return std(0x1d2025, .16, .58, .8); },
    charcoal:   function () { return std(0x2a2d33, .22, .55, .75); },
    probeBlack: function () { return std(0x121417, .20, .50, .85); },
    cable:      function () { return std(0x17181a, .05, .72, .6); },
    navy:       function () { return std(0x1f3f74, .12, .45, .95); },
    skyBlue:    function () { return std(0x7fb2d9, .10, .42, 1); },
    rotorBlue:  function () { return std(0x2f6fbb, .14, .40, 1); },
    knobBlue:   function () { return std(0x2e5fa3, .14, .42, 1); },
    white:      function () { return std(0xe4e6e8, .04, .62, .8); },
    greyLight:  function () { return std(0x9aa2ab, .30, .48, .9); },
    steel:      function () { return std(0xb8bcc2, .88, .34, 1.1); },
    pcb:        function () { return std(0x14306b, .18, .52, .85); },
    glass:       function () { return glassy(0xeaf4ff, .02, .86, 3.4, 0x93bce4, .30); },
    bottleGlass: function () { return glassy(0xe4eef8, .06, .90, 3.0, 0x9dc0e2, .12); },
    frostBottle: function () { return glassy(0xeef2f4, .30, .62, 2.2, 0xaebfd0, .10); },
    tube:        function () { return glassy(0xf0f4f6, .26, .70, 2.4, 0xa9c2d8, .10); },
    beam: function () {
      return new THREE.MeshBasicMaterial({
        color: 0xff8a1e, transparent: true, opacity: .22,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    },
    amber: function () {
      return new THREE.MeshPhysicalMaterial({
        color: 0xffab34, metalness: 0, roughness: .10, transmission: .62, ior: 1.55,
        transparent: true, opacity: 1, envMapIntensity: 1.5,
        clearcoat: 1, clearcoatRoughness: .04,
        emissive: 0xff8a00, emissiveIntensity: .42,
        side: THREE.DoubleSide, depthWrite: false });
    },
  };

  /* ---------- flow ---------- */
  var FLOW_SPEED = 70, DASH_MM = 44, flowMats = [];
  var LOOP_COLORS = {
    lumen: { edge: "rgba(255,110,10,0)", core: "rgba(255,126,20,1)" },
    shell: { edge: "rgba(20,225,120,0)", core: "rgba(24,235,132,1)" },
  };
  function pulseTexture(loop) {
    var cl = LOOP_COLORS[loop] || LOOP_COLORS.lumen;
    var c = document.createElement("canvas");
    c.width = 128; c.height = 4;
    var g = c.getContext("2d");
    var grad = g.createLinearGradient(0, 0, 52, 0);
    grad.addColorStop(0, cl.edge); grad.addColorStop(.5, cl.core); grad.addColorStop(1, cl.edge);
    g.fillStyle = grad; g.fillRect(0, 0, 52, 4);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
  function buildFlow() {
    if (typeof FLOW_PATHS === "undefined") return;
    FLOW_PATHS.forEach(function (fp) {
      var pts = fp.points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
      if (pts.length < 2) return;
      var curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      var geo = new THREE.TubeGeometry(
        curve, Math.min(400, Math.max(24, Math.round(fp.length / 3))), 2.55, 10, false);
      var tex = pulseTexture(fp.loop);
      tex.repeat.x = fp.length / DASH_MM;
      var mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      flowMats.push(mat);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      scene.add(mesh);
    });
    var core = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 200, 14),
      new THREE.MeshBasicMaterial({ color: 0xff8a2e, transparent: true, opacity: .5,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.set(-405.3, 195.4, 0); core.renderOrder = 2; scene.add(core);
    var halo = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 285, 16),
      new THREE.MeshBasicMaterial({ color: 0x3ddc8b, transparent: true, opacity: .22,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(-405.3, 195.4, 0); halo.renderOrder = 2; scene.add(halo);
  }

  /* ---------- the plinth ---------- */
  // The record page's stage carries a wordmark. This one does not: the name
  // card beside the reactor is already saying it, and saying it twice in the
  // same frame reads as a placeholder nobody removed.
  var GROUND = -72;
  function roundedRect(w, d, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function buildStage() {
    var dark = std(0x080d0a, .5, .42, .8);
    var glow = function (o) {
      return new THREE.MeshBasicMaterial({ color: 0x3ddc8b, transparent: true,
        opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    };

    var slab = new THREE.Mesh(new THREE.ExtrudeGeometry(
      roundedRect(760, 220, 42), { depth: 12, bevelEnabled: false }), dark);
    slab.rotation.x = -Math.PI / 2; slab.position.set(-80, GROUND - 12, -5); scene.add(slab);

    var base = new THREE.Mesh(new THREE.ExtrudeGeometry(
      roundedRect(792, 248, 50), { depth: 8, bevelEnabled: false }), dark);
    base.rotation.x = -Math.PI / 2; base.position.set(-80, GROUND - 23, -5); scene.add(base);

    var strip = new THREE.Mesh(new THREE.ExtrudeGeometry(
      roundedRect(766, 226, 44), { depth: 1.6, bevelEnabled: false }), glow(.42));
    strip.rotation.x = -Math.PI / 2; strip.position.set(-80, GROUND - 14.3, -5);
    strip.renderOrder = 1; scene.add(strip);

    var rimShape = roundedRect(752, 212, 40);
    rimShape.holes.push(new THREE.Path(roundedRect(740, 200, 34).getPoints(24)));
    var rim = new THREE.Mesh(new THREE.ShapeGeometry(rimShape, 24), glow(.6));
    rim.rotation.x = -Math.PI / 2; rim.position.set(-80, GROUND + .45, -5);
    rim.renderOrder = 1; scene.add(rim);

    var poolC = document.createElement("canvas");
    poolC.width = poolC.height = 256;
    var pg = poolC.getContext("2d");
    var rad = pg.createRadialGradient(128, 128, 0, 128, 128, 128);
    rad.addColorStop(0, "rgba(70,225,150,0.50)");
    rad.addColorStop(.55, "rgba(60,190,130,0.14)");
    rad.addColorStop(1, "rgba(60,190,130,0)");
    pg.fillStyle = rad; pg.fillRect(0, 0, 256, 256);
    var poolTex = new THREE.CanvasTexture(poolC);
    poolTex.encoding = THREE.sRGBEncoding;
    [[-300, 175], [-165, 140], [0, 165], [190, 185]].forEach(function (st) {
      var pool = new THREE.Mesh(new THREE.PlaneGeometry(st[1], st[1]),
        new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: .40,
          blending: THREE.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(st[0], GROUND + .6, 0);
      pool.renderOrder = 1; scene.add(pool);
    });

    var ped = new THREE.Mesh(new THREE.BoxGeometry(104, 29.5, 40), dark);
    ped.position.set(0, GROUND + 14.75, -23); scene.add(ped);
    var mast = new THREE.Mesh(new THREE.BoxGeometry(12, 462, 7), dark);
    mast.position.set(-398, GROUND + 231, -12); scene.add(mast);
  }

  /* ---------- highlight, for the parts list ---------- */
  var comps = {};          // id -> [{ mat, hex, ei }]
  var ACCENT = { lumen: 0xff8a2e, shell: 0x3ddc8b, both: 0x5aa9ff };
  var litId = null;

  function indexComponents() {
    if (typeof BIO_COMPONENTS === "undefined") return;
    BIO_COMPONENTS.forEach(function (def) {
      var found = [];
      def.meshes.forEach(function (n) {
        var o = scene.getObjectByName(n);
        if (!o || !o.material || !o.material.emissive) return;
        found.push({ mat: o.material, hex: o.material.emissive.getHex(), ei: o.material.emissiveIntensity || 0 });
      });
      if (found.length) comps[def.id] = { flow: def.flow, meshes: found };
    });
  }

  function paint(id, strength) {
    var c = comps[id];
    if (!c) return;
    var col = ACCENT[c.flow] || ACCENT.both;
    c.meshes.forEach(function (m) {
      if (strength > 0) {
        m.mat.emissive.setHex(col);
        m.mat.emissiveIntensity = m.ei + strength;
      } else {
        m.mat.emissive.setHex(m.hex);
        m.mat.emissiveIntensity = m.ei;
      }
    });
  }

  /* ---------- drive ---------- */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dragging = false, userHeld = false, px = 0, py = 0;
  var ready = false, booted = false;

  // The stage is one screen in a page that is roughly fifteen. A render loop
  // that keeps drawing while the reader is down in the vision section costs a
  // GPU for nothing and makes scrolling stutter, so the loop parks itself
  // whenever the stage leaves the viewport and picks the clock back up where
  // it left it.
  var visible = true, paused = false, clock = 0, lastNow = 0;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && paused && ready && !reduced) { paused = false; lastNow = performance.now(); run(); }
    }, { rootMargin: "10% 0px" }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (paused && visible && ready && !reduced) { paused = false; lastNow = performance.now(); run(); }
  });

  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; userHeld = true; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    yaw -= (e.clientX - px) * .005;
    pitch = Math.max(-.35, Math.min(.9, pitch + (e.clientY - py) * .004));
    px = e.clientX; py = e.clientY;
    if (reduced) render();
  });
  canvas.addEventListener("pointerup", function () { dragging = false; });
  canvas.addEventListener("pointercancel", function () { dragging = false; });

  function size() {
    var w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) ||
        canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  function render() { size(); place(); renderer.render(scene, camera); }

  function run() {
    if (reduced) { render(); return; }
    lastNow = performance.now();
    (function tick(now) {
      if (!visible || document.hidden) { paused = true; return; }
      clock += Math.min(0.05, (now - lastNow) / 1000);   // cap the step so a
      lastNow = now;                                     // long park does not
      var t = clock;                                     // spin the reactor
      if (!dragging && !userHeld) yaw = -0.62 + t * 0.055;
      flowMats.forEach(function (m) { m.map.offset.x = -(t * FLOW_SPEED) / DASH_MM; });
      rotors.forEach(function (r) { r.rotation.z = t * 1.7; });
      render();
      requestAnimationFrame(tick);
    })(performance.now());
  }

  /* ---------- load ---------- */
  var ROTOR = { x: -16.7, y: 0 };
  var rotors = [];
  var done = 0, failedParts = 0;
  var loadEl = document.getElementById("rx-load");
  var loadPct = loadEl ? loadEl.querySelector("span") : null;

  function tally() {
    done++;
    if (loadPct) loadPct.textContent = Math.round((done / BIO_PARTS.length) * 100) + "%";
    if (done < BIO_PARTS.length) return;
    if (failedParts > BIO_PARTS.length / 3) { giveUp(); if (loadEl) loadEl.hidden = true; return; }
    buildFlow();
    buildStage();
    RQ.shadowAll(scene);
    RQ.fitShadow(key, scene);
    indexComponents();
    if (loadEl) loadEl.hidden = true;
    ready = true;
    run();
  }

  function boot() {
    if (booted) return;
    booted = true;
    if (loadEl) loadEl.hidden = false;
    var stl = new THREE.STLLoader();
    BIO_PARTS.forEach(function (p) {
      stl.load(MODEL_BASE + p.file + ".stl", function (geo) {
        RQ.smoothNormals(geo);
        var mesh = new THREE.Mesh(geo, (MATERIALS[p.mat] || MATERIALS.blackPrint)());
        mesh.name = p.file;
        if (p.mat === "beam") mesh.renderOrder = 3;
        if (p.file === "pump-rotor-back" || p.file === "pump-rotor-front") {
          geo.translate(-ROTOR.x, -ROTOR.y, 0);
          mesh.position.set(ROTOR.x, ROTOR.y, 0);
          rotors.push(mesh);
        }
        scene.add(mesh);
        tally();
      }, undefined, function () { failedParts++; tally(); });
    });
  }

  return {
    start: boot,
    isReady: function () { return ready; },
    redraw: function () { if (ready) render(); },
    failed: false,
    highlight: function (id) {
      if (!ready || id === litId) return;
      if (litId) paint(litId, 0);
      litId = id || null;
      if (litId) paint(litId, 0.45);
      if (reduced) render();
    },
  };
})();
