// Final-product bundle loader.
//
// Loads every STL in final/_manifest.json at the coordinates the file carries,
// so it shows the assembly exactly as exported — including anything that came
// through unplaced. Onshape is Z-up; the whole scene is rotated into the
// Y-up frame three.js expects rather than rotating each part.
(function () {
  const canvas = document.getElementById("gl");
  const hud = document.getElementById("hud");

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 1, 20000);
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;          // Onshape Z-up -> three.js Y-up
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
  const key = new THREE.DirectionalLight(0xfff6ec, 0.42); key.position.set(400, 700, 800); scene.add(key);
  const rimC = new THREE.DirectionalLight(0xbcd0e6, 0.30); rimC.position.set(-600, 300, -600); scene.add(rimC);
  const rimW = new THREE.DirectionalLight(0xffd9a8, 0.20); rimW.position.set(600, -150, -500); scene.add(rimW);

  const parts = [];                        // {name, mesh, centre, size, placed}
  const loader = new THREE.STLLoader();

  function niceName(f) {
    return f.replace(/^Assembly 4 - /, "").replace(/\.stl$/i, "");
  }

  // A part is "unplaced" when it sits on its own Part Studio origin: centred
  // in x and y within a couple of millimetres AND resting on the z = 0 plane.
  // The tolerance has to be absolute — a relative one flags the box lid, which
  // is genuinely centred in the assembly, as unplaced.
  function looksUnplaced(c, s) {
    const zmin = c.z - s.z / 2;
    return Math.abs(c.x) < 4 && Math.abs(c.y) < 4 && Math.abs(zmin) < 6;
  }

  let mode = "diag";
  const MAT = {
    placed:   new THREE.MeshStandardMaterial({ color: 0x39424f, metalness: 0.25, roughness: 0.62, envMapIntensity: 0.9 }),
    unplaced: new THREE.MeshStandardMaterial({ color: 0xff3b30, metalness: 0.10, roughness: 0.55, envMapIntensity: 0.9 }),
  };

  fetch("final/_manifest.json", { cache: "reload" })
    .then(function (r) { return r.json(); })
    .then(function (files) {
      const stls = files.filter(function (f) { return /\.stl$/i.test(f); });
      let done = 0;
      stls.forEach(function (f) {
        loader.load("final/" + encodeURIComponent(f), function (geo) {
          geo.computeBoundingBox();
          geo.computeVertexNormals();
          const b = geo.boundingBox;
          const c = new THREE.Vector3(), s = new THREE.Vector3();
          b.getCenter(c); b.getSize(s);
          const placed = !looksUnplaced(c, s);
          const mesh = new THREE.Mesh(geo, placed ? MAT.placed : MAT.unplaced);
          mesh.name = niceName(f);
          root.add(mesh);
          parts.push({ name: mesh.name, mesh: mesh, centre: c, size: s, placed: placed });
          if (++done === stls.length) finish();
        }, undefined, function () { if (++done === stls.length) finish(); });
      });

      function finish() {
        const nUn = parts.filter(function (p) { return !p.placed; }).length;
        hud.innerHTML = parts.length + " parts loaded<br>" +
          "<span style='color:#ff6b60'>" + nUn + " unplaced (red)</span><br>" +
          (parts.length - nUn) + " placed (grey)";
        fitAll();
        render();
      }
    });

  // ---------- camera ----------
  let yaw = 0.9, pitch = 0.34, dist = 900;
  const TARGET = new THREE.Vector3();
  function fitAll() {
    const b = new THREE.Box3().setFromObject(root);
    b.getCenter(TARGET);
    const s = new THREE.Vector3(); b.getSize(s);
    dist = Math.max(s.x, s.y, s.z) * 1.9;
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
    place();
    renderer.render(scene, camera);
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
    dist = Math.max(40, Math.min(6000, dist + e.deltaY * 1.2));
    render();
  }, { passive: false });
  window.addEventListener("resize", render);

  function shot(w, h, bg) {
    const c2 = window.__fin._c2 || (window.__fin._c2 = document.createElement("canvas"));
    c2.width = w; c2.height = h;
    const g = c2.getContext("2d");
    g.fillStyle = bg || "#06070a"; g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0);
    return c2.toDataURL("image/png");
  }

  // The fused single-mesh export, loaded on demand as a placement reference.
  // One mesh means one material, so it can never carry the per-part colour
  // scheme — it is here to check the bundle against, not to render from.
  let refMesh = null;
  function loadRef(cb) {
    if (refMesh) { cb(true); return; }
    loader.load("final/_ref.stl", function (geo) {
      geo.computeVertexNormals();
      refMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x4a5462, metalness: 0.25, roughness: 0.6, envMapIntensity: 0.9,
      }));
      refMesh.name = "__ref";
      root.add(refMesh);
      cb(true);
    }, undefined, function () { cb(false); });
  }

  window.__fin = {
    scene: scene, root: root, camera: camera, parts: parts,
    loadRef: loadRef,
    showRef: function (on) {
      if (refMesh) refMesh.visible = on;
      parts.forEach(function (p) { p.mesh.visible = !on; });
    },
    showBundle: function () {
      if (refMesh) refMesh.visible = false;
      parts.forEach(function (p) { p.mesh.visible = true; });
    },
    refBounds: function () {
      if (!refMesh) return null;
      const b = new THREE.Box3().setFromObject(refMesh);
      return { min: b.min.toArray().map(function (v) { return +v.toFixed(1); }),
               max: b.max.toArray().map(function (v) { return +v.toFixed(1); }) };
    },
    ready: function () { return parts.length > 0; },
    list: function () {
      return parts.map(function (p) {
        return { name: p.name, placed: p.placed,
                 c: [+p.centre.x.toFixed(1), +p.centre.y.toFixed(1), +p.centre.z.toFixed(1)],
                 s: [+p.size.x.toFixed(1), +p.size.y.toFixed(1), +p.size.z.toFixed(1)] };
      });
    },
    // whole-assembly frame at a fixed resolution
    frame: function (y, p, d, w, h, bg) {
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      yaw = y; pitch = p;
      if (d) dist = d; else fitAll();
      place();
      renderer.render(scene, camera);
      return shot(w, h, bg);
    },
    // one part alone, fitted — used to identify the generically-named files
    thumb: function (name, w, h, bg) {
      const hit = parts.filter(function (p) { return p.name === name; })[0];
      if (!hit) return null;
      parts.forEach(function (p) { p.mesh.visible = (p === hit); });
      const saveT = TARGET.clone(), saveD = dist, saveY = yaw, saveP = pitch;
      const b = new THREE.Box3().setFromObject(hit.mesh);
      b.getCenter(TARGET);
      const s = new THREE.Vector3(); b.getSize(s);
      dist = Math.max(s.x, s.y, s.z) * 2.3 + 12;
      yaw = 0.85; pitch = 0.42;
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      place();
      renderer.render(scene, camera);
      const url = shot(w, h, bg);
      parts.forEach(function (p) { p.mesh.visible = true; });
      TARGET.copy(saveT); dist = saveD; yaw = saveY; pitch = saveP;
      return url;
    },
  };
})();
