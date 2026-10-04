// Hydroponics floating plate — assembled and coloured.
//
// Four printed parts out of one Onshape Part Studio. They export in a shared
// coordinate system, so the handles are already in their slots and the one
// seed holder is already in its bore: there is no assembly transform here.
// What this adds is the other twelve holders, instanced from the manifest
// rather than baked into the binary (see tools/pack_hydroponics.py).
(function () {
  const canvas = document.getElementById("gl");
  if (!canvas) return;
  const loader = document.getElementById("loader");
  const pct = document.getElementById("load-pct");

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 20000);
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;              // Onshape Z-up -> three.js Y-up
  scene.add(root);

  scene.environment = RQ.studioEnv(renderer, { top: "#8f9cab", floor: "#2e333b" });

  const key = new THREE.DirectionalLight(0xfff6ec, 0.52); key.position.set(340, 620, 520);
  const rimC = new THREE.DirectionalLight(0xbcd0e6, 0.30); rimC.position.set(-520, 260, -480);
  const rimW = new THREE.DirectionalLight(0xffd9a8, 0.22); rimW.position.set(480, -120, -420);
  // A backlight that follows the camera. A matte black plate on a near-black
  // page has almost no edge contrast, and a FIXED rim only rescues the angles
  // it happens to face; parked opposite the camera it draws the top edges from
  // every angle the user can orbit to. This is what makes the plate readable —
  // the texture and the ground below only add to it.
  const rimBack = new THREE.DirectionalLight(0xd8e4ff, 0.40);
  scene.add(key, rimC, rimW, rimBack, rimBack.target);
  RQ.enableShadows(renderer, key, 2.2);

  // ---------- ground ----------
  // Not decoration: it gives the lower half of the frame a tone to sit against
  // and catches a contact shadow, so the plate stops floating in a void. The
  // radial alpha keeps it from ending in a hard horizon across the middle of a
  // dark stage.
  const groundFade = (function () {
    const n = 256, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(n / 2, n / 2, n * 0.05, n / 2, n / 2, n * 0.48);
    r.addColorStop(0, "#ffffff"); r.addColorStop(0.55, "#8c8c8c"); r.addColorStop(1, "#000000");
    g.fillStyle = r; g.fillRect(0, 0, n, n);
    return new THREE.CanvasTexture(c);      // alpha mask: stays linear, no sRGB flag
  })();
  const ground = new THREE.Mesh(
    // 420mm, not 900: the fade has to finish INSIDE the frame. At 900 the
    // opaque middle of the plane covered the whole background and the shot
    // came back as a grey studio wall rather than a floor under a dark object.
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({
      color: RQ.srgb(0x0a0d12), metalness: 0.20, roughness: 0.58,
      envMapIntensity: 0.32, transparent: true, alphaMap: groundFade,
      depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- print texture ----------
  // Layer lines. The packed geometry carries position only, so the UVs are
  // generated here: v tracks the print's vertical axis (Onshape z) at the layer
  // pitch, u is a slow diagonal so the stripes never tile into a visible seam.
  // It is a roughness map, not a normal map — varying how the light scatters is
  // enough to read as a printed surface, and costs no extra geometry.
  const LAYER_MM = 0.52;
  const layerTex = (function () {
    const n = 64, c = document.createElement("canvas");
    c.width = 4; c.height = n;
    const g = c.getContext("2d");
    for (let i = 0; i < n; i++) {
      // a soft sawtooth: each layer is slightly proud at its top edge
      // Near white, and only just modulated. roughnessMap MULTIPLIES the
      // material's roughness, so a mid-grey stripe halves it — which is how a
      // matte black print came back looking like polished chrome.
      const t = i / n;
      const v = 232 + 15 * Math.sin(t * Math.PI * 2) + 7 * Math.sin(t * Math.PI * 6);
      g.fillStyle = "rgb(" + [v | 0, v | 0, v | 0].join(",") + ")";
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

  // ---------- materials ----------
  // Every colour goes through RQ.srgb: r128 has no ColorManagement, so a raw
  // hex is consumed as linear and arrives far too bright.
  function std(hex, m, r, e) {
    return new THREE.MeshStandardMaterial({
      color: RQ.srgb(hex), metalness: m, roughness: r, envMapIntensity: e });
  }
  const MAT = [
    // 0 — the plate. Matte black print. Pulled up from 0x15171b: against this
    // page's near-black background a true black plate has no silhouette at all,
    // and the hole pattern — the thing worth looking at — went with it.
    std(0x1c1f25, 0.10, 0.62, 0.62),
    // 1 — the handles, printed in a mid grey
    std(0x6b727b, 0.16, 0.50, 0.85),
    // 2 — the seed holders: brown, and slightly transparent.
    //
    // Transmission is kept low on purpose. Past about 0.5 the material's own
    // colour stops contributing — the same thing that made the bioreactor's
    // tinted vessels come out clear — and this needs to stay visibly brown.
    // 0.34 lets the plate read through the mesh wall without bleaching it.
    // Matte, and only just translucent. Two things had to come down: at
    // roughness 0.24 with clearcoat the flange caught the key square-on and
    // every holder came back a white disc, and at transmission 0.38 the
    // material's own colour stopped contributing and the brown went to tan.
    // r128 has no `thickness`, so there is no attenuation to darken a
    // transmissive volume with — the pigment has to carry it, which means
    // keeping transmission low enough that the pigment is still visible.
    // Roughness is what actually controls this, not the colour. Measured with
    // a pure black albedo the flange still rendered rgb(86,89,95): four lights
    // on one broad flat upward face, and at roughness 0.52 that specular was
    // 78% of its brightness, so no amount of darkening the brown could reach
    // it. At 0.84 — which is what a matte printed part should be anyway — the
    // same flange reads rgb(75,56,49) and the pigment comes back.
    new THREE.MeshPhysicalMaterial({
      color: RQ.srgb(0x4a2a0d), metalness: 0, roughness: 0.84, transmission: 0.20,
      ior: 1.46, transparent: true, opacity: 1, envMapIntensity: 0.55,
      clearcoat: 0.06, clearcoatRoughness: 0.60, side: THREE.DoubleSide }),
  ];

  const parts = [];
  let yaw = -0.72, pitch = 0.52, dist = 340, target = new THREE.Vector3();

  PackedModel.load("product/", function (done, total) {
    if (pct) pct.textContent = Math.round((done / total) * 100) + "%";
  }).then(function (m) {
    const inst = (m.manifest.instances || {})["Seed Holder"] || [[0, 0, 0]];
    m.groups.forEach(function (g) {
      const mat = MAT[g.mat] || MAT[0];
      // The holder is stored once and placed thirteen times. Sharing one
      // BufferGeometry across the copies is the whole reason it is stored
      // once — cloning it back out would cost the 47k triangles again.
      // The plate and the handles are the big flat printed surfaces; the
      // holder is small enough that layer lines on it would only alias.
      if (g.mat !== 2) {
        addPrintUVs(g.geometry);
        mat.roughnessMap = layerTex;
        mat.needsUpdate = true;
      }
      const places = g.part === "Seed Holder" ? inst : [[0, 0, 0]];
      places.forEach(function (d, i) {
        const mesh = new THREE.Mesh(g.geometry, mat);
        mesh.position.set(d[0], d[1], d[2]);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.userData.role = g.part === "Seed Holder" ? "holder" :
                             g.part.indexOf("Handle") >= 0 ? "handle" : "plate";
        mesh.userData.index = i;
        root.add(mesh); parts.push(mesh);
      });
    });

    // ---------- frame it ----------
    const box = new THREE.Box3().setFromObject(root);
    box.getCenter(target);
    const size = box.getSize(new THREE.Vector3());
    // Fit the box, not its bounding sphere: a 118mm plate 33mm tall has a
    // sphere half again as wide as the part and frames it far too loose.
    const fovY = camera.fov * Math.PI / 180;
    const fitH = size.y / 2 / Math.tan(fovY / 2);
    const fitW = size.x / 2 / Math.tan(fovY / 2) / camera.aspect;
    dist = Math.max(fitH, fitW, size.z) * 1.55 + size.z * 0.5;

    ground.position.y = box.min.y - 0.4;
    RQ.fitShadow(key, root);
    RQ.shadowAll(root);
    if (loader) loader.classList.add("hide");
    const badge = document.getElementById("count");
    if (badge) badge.textContent = parts.length + " parts · " +
      m.manifest.triangles.toLocaleString() + " triangles stored";
    render();
  }).catch(function (e) {
    if (loader) loader.textContent = "Could not load the model — " + e.message;
  });

  function place() {
    camera.position.set(
      target.x + dist * Math.sin(yaw) * Math.cos(pitch),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(target);
    // opposite the camera and lifted, so it always grazes the far top edge
    _back.subVectors(target, camera.position).normalize();
    rimBack.position.copy(target).addScaledVector(_back, 620);
    rimBack.position.y = target.y + 300;
    rimBack.target.position.copy(target);
    rimBack.target.updateMatrixWorld();
  }
  const _back = new THREE.Vector3();

  function render() {
    const box = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(2, Math.round(box.width));
    const h = Math.max(2, Math.round(box.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    place();
    renderer.render(scene, camera);
  }

  let drag = null;
  canvas.addEventListener("pointerdown", function (e) {
    drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", function () { drag = null; });
  canvas.addEventListener("pointercancel", function () { drag = null; });
  canvas.addEventListener("pointermove", function (e) {
    if (!drag) return;
    yaw -= (e.clientX - drag.x) * 0.007;
    pitch = Math.max(-1.35, Math.min(1.35, pitch + (e.clientY - drag.y) * 0.005));
    drag = { x: e.clientX, y: e.clientY };
    render();
  });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    dist = Math.max(90, Math.min(1400, dist + e.deltaY * 0.5));
    render();
  }, { passive: false });

  window.addEventListener("resize", render);
  if ("ResizeObserver" in window) new ResizeObserver(render).observe(canvas.parentElement);

  // A handle for driving the view from the console while the page is being cut.
  window.__hydro = {
    view: function (y, p, d) {
      if (y !== undefined) yaw = y;
      if (p !== undefined) pitch = p;
      if (d !== undefined) dist = d;
      render();
      return { yaw: yaw, pitch: pitch, dist: Math.round(dist) };
    },
    only: function (roles) {
      parts.forEach(function (m) {
        m.visible = !roles || roles.indexOf(m.userData.role) >= 0;
      });
      render();
    },
    parts: parts, scene: scene, camera: camera, root: root
  };
})();
