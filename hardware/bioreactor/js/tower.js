// Product model — the commercial bioreactor built into a PC tower.
//
// Geometry is product/model.bin: the Onshape composite baked into assembly
// millimetres, decimated from 3.6M triangles to 223k by capping triangle
// DENSITY rather than decimating evenly. The screws were modelled at 7,243
// triangles per cm2 against the front panel's 5, so 83% of the model was
// fasteners covering 1.5% of the surface; panels came through untouched.
//
// What a body IS comes from product/roles.json, which dev/labeller writes.
// Anything unlabelled falls back to the CAD's own material, so the scene is
// never blank and never lies about a part it has not been told about.
//
// DOM contract — every id is optional except the canvas:
//   #tower-gl        canvas                      (required)
//   #tower-load      loading readout
//   #tower-explode   range input, 0..100
//   #tower-play      button, pauses the drift
//   #tower-case      button, shows/hides the PC case around the machine
//   #tower-legend    ul, filled with one row per subsystem
//   #tower-readout   text panel for the hovered/selected subsystem
(function () {
  "use strict";

  const canvas = document.getElementById("tower-gl");
  if (!canvas || typeof THREE === "undefined" || !window.PackedModel) return;

  const DIR = (canvas.getAttribute("data-model") || "product/");
  const R = window.TOWER_ROLES || { ROLES: {}, SUBSYSTEMS: [] };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const elLoad = document.getElementById("tower-load");
  const elExp = document.getElementById("tower-explode");
  const elPlay = document.getElementById("tower-play");
  const elLegend = document.getElementById("tower-legend");
  const elCase = document.getElementById("tower-case");
  const elRead = document.getElementById("tower-readout");

  // ---- renderer / camera / lights: the house values -----------------------
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;      // r128 legacy API, deliberate
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const CAM_DIST = 285, CAM_ELEV = 0.175;
  // 28°, between the photometer's 34 and the bioreactor's 26: a rectilinear
  // chassis keystones badly at 34.
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 6000);
  camera.position.set(0, CAM_DIST * Math.sin(CAM_ELEV), CAM_DIST * Math.cos(CAM_ELEV));
  camera.lookAt(0, 0, 0);

  function frameSize() {                    // visible frame height at the origin
    const vFov = (camera.fov * Math.PI) / 180;
    return 2 * Math.tan(vFov / 2) * CAM_DIST;
  }

  if (window.RQ && RQ.studioEnv) scene.environment = RQ.studioEnv(renderer);
  const key = new THREE.DirectionalLight(0xfff6ec, 0.38);
  key.position.set(80, 130, 150); scene.add(key);
  if (window.RQ && RQ.enableShadows) RQ.enableShadows(renderer, key);
  const rimWarm = new THREE.DirectionalLight(0xff7a5c, 0.32);
  rimWarm.position.set(120, -40, -130); scene.add(rimWarm);
  const rimCool = new THREE.DirectionalLight(0xbcd0e6, 0.30);
  rimCool.position.set(-110, 40, -140); scene.add(rimCool);

  const rig = new THREE.Group();            // scaled + spun
  scene.add(rig);

  // ---- state --------------------------------------------------------------
  const bodies = [];        // { mesh, role, sub, dir, span }
  const bySub = {};
  let explode = 0, explodeTarget = 0;
  let fitAll = null, fitCore = null, fitWant = null;
  function fitFor(size, mid, fill) {
    const s = (frameSize() * fill) / Math.max(size.y, 1e-6);
    return { s: s, p: new THREE.Vector3(-mid.x * s, -mid.y * s, -mid.z * s) };
  }
  let paused = reduced, hoverSub = null;
  const clock = new THREE.Clock();

  // The CAD's own materials are the default, and they are the accurate ones:
  // real Onshape appearances that already know which vessels are translucent,
  // which caps are blue and which board is green. The role palette is an
  // editorial scheme for the published page — switch to it with
  // data-colours="role" once roles.json is filled in by hand. Until then most
  // roles are proposals, and rendering a guess as though it were a fact is a
  // worse error than rendering the CAD plainly.
  const LOOK = canvas.getAttribute("data-colours") === "role" ? "role" : "built";
  let PAL = {};
  function matFor(role, cad, isCase, part) {
    // Measured appearance wins when we have one — see hardware/js/palette.js.
    if (LOOK !== "role" && PAL[part] && window.Palette) {
      return window.Palette.materialFor(PAL[part]);
    }
    return matForRoleOrCad(role, cad, isCase);
  }
  function matForRoleOrCad(role, cad, isCase) {
    const d = R.ROLES[role];
    let m;
    // The case is the one place the CAD is not the truth: Onshape paints its
    // panels #4d4d4d and its rails near-black, and the real tower is the other
    // way round — black panels over a bare aluminium frame. Everything inside
    // keeps the CAD's own materials, which are accurate.
    if ((LOOK === "role" || isCase) && d) {
      m = new THREE.MeshStandardMaterial({
        color: d.color, roughness: d.rough != null ? d.rough : 0.6,
        metalness: d.metal != null ? d.metal : 0.2, emissive: d.emissive || 0x000000
      });
      if (d.env != null) m.envMapIntensity = d.env;
      if (d.opacity != null) { m.transparent = true; m.opacity = d.opacity; }
      return m;
    }
    const c = cad ? cad.rgba : [0.55, 0.58, 0.62, 1];
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c[0], c[1], c[2]), roughness: 0.55, metalness: 0.12
    });
    if (c[3] < 0.99) { m.transparent = true; m.opacity = c[3]; }
    return m;
  }

  // ---- load ---------------------------------------------------------------
  Promise.all([
    fetch(DIR + "roles.json").then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; }),
    fetch(DIR + "cad-materials.json").then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; }),
    window.Palette ? window.Palette.load(DIR) : Promise.resolve({ byPart: {} })
  ]).then(function (res) {
    const roleOf = {};
    res[0].forEach(function (r) { roleOf[r.part] = r.role; });
    const cad = res[1];
    PAL = (res[2] || {}).byPart || {};

    return PackedModel.load(DIR, function (d, t) {
      if (elLoad) elLoad.textContent = Math.round((d / t) * 100) + "%";
    }).then(function (m) {
      const box = new THREE.Box3();      // whole tower
      const boxCore = new THREE.Box3();  // just the machine inside it
      m.groups.forEach(function (g) {
        const role = roleOf[g.part] || null;
        const spec = role ? R.ROLES[role] : null;
        if (spec && spec.hide) return;
        g.geometry.rotateX(-Math.PI / 2);          // CAD is Z up
        const mesh = new THREE.Mesh(g.geometry,
          matFor(role, cad[g.mat], (spec ? spec.sub : null) === "case", g.part));
        mesh.material.userData.baseOpacity = mesh.material.transparent
          ? mesh.material.opacity : 1;
        mesh.userData = { part: g.part, role: role, sub: spec ? spec.sub : null };
        rig.add(mesh);
        g.geometry.computeBoundingBox();
        const c = g.geometry.boundingBox.getCenter(new THREE.Vector3());
        bodies.push({ mesh: mesh, role: role, sub: spec ? spec.sub : null,
                      isCase: (spec ? spec.sub : null) === "case", c: c });
        box.expandByObject(mesh);
        if (spec ? spec.sub !== "case" : true) boxCore.expandByObject(mesh);
        if (spec && spec.sub) (bySub[spec.sub] = bySub[spec.sub] || []).push(mesh);
      });

      // Normalise the MODEL to the house camera, never the other way round:
      // the camera stays where every other instrument page puts it, and the rig
      // is scaled to fill the frame. Two fits are kept — with the case and
      // without — because the machine is a third of the tower's height and
      // would sit tiny in frame if taking the shell off did not re-frame.
      const size = box.getSize(new THREE.Vector3());
      const mid = box.getCenter(new THREE.Vector3());
      fitAll = fitFor(size, mid, 0.58);          // the product, shown whole
      const cs = boxCore.isEmpty() ? size : boxCore.getSize(new THREE.Vector3());
      const cm = boxCore.isEmpty() ? mid : boxCore.getCenter(new THREE.Vector3());
      // With the shell off the point is to inspect, so fill more of the frame.
      // The machine is only 1.46x smaller than the tower, so matching fills
      // would barely look like anything had happened.
      fitCore = fitFor(cs, cm, 0.82);
      fitWant = fitAll;
      rig.scale.setScalar(fitAll.s);
      rig.position.copy(fitAll.p);
      const s = fitAll.s;

      // Explode direction: outward from the model's vertical axis, so parts
      // fan sideways instead of stacking. Purely vertical motion would just
      // slide the internals up through the lid.
      bodies.forEach(function (b) {
        const d = new THREE.Vector3(b.c.x - mid.x, (b.c.y - mid.y) * 0.25, b.c.z - mid.z);
        if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
        b.dir = d.normalize();
        const sub = R.SUBSYSTEMS.filter(function (x) { return x.key === b.sub; })[0];
        b.reach = (sub ? sub.explode : 0.5) * Math.max(size.x, size.z) * 0.9;
      });

      if (window.RQ && RQ.shadowAll) RQ.shadowAll(scene);
      if (elLoad) elLoad.textContent = "";
      buildLegend();
      // Draw one frame unconditionally, outside the gate. The loop below is
      // gated on visibility and intersection, which is right for an animation
      // but means a scene that finishes loading while the tab is hidden — or
      // in any context that reports itself hidden while still compositing —
      // would present an empty canvas until something happened to wake it.
      // The assembled model is content, not animation, so it is never owed to
      // a callback that may not come.
      resize();
      renderer.render(scene, camera);
      schedule();
    });
  }).catch(function (err) {
    if (elLoad) elLoad.textContent = "model unavailable";
    console.error("[tower]", err);
  });

  // ---- legend -------------------------------------------------------------
  function buildLegend() {
    if (!elLegend) return;
    elLegend.innerHTML = "";
    R.SUBSYSTEMS.forEach(function (s) {
      if (!bySub[s.key] || !bySub[s.key].length) return;
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tower-key";
      b.dataset.sub = s.key;
      b.innerHTML = '<span class="tower-sw" style="background:#' +
        ("00000" + swatch(s.key).toString(16)).slice(-6) + '"></span>' +
        "<span>" + s.label + "</span>";
      b.addEventListener("pointerenter", function () { focusSub(s.key); });
      b.addEventListener("pointerleave", function () { focusSub(null); });
      b.addEventListener("focus", function () { focusSub(s.key); });
      b.addEventListener("blur", function () { focusSub(null); });
      b.addEventListener("click", function () {
        focusSub(hoverSub === s.key ? null : s.key);
      });
      li.appendChild(b);
      elLegend.appendChild(li);
    });
  }
  function swatch(sub) {
    const k = Object.keys(R.ROLES).filter(function (r) { return R.ROLES[r].sub === sub; })[0];
    return (k && R.ROLES[k].color) || 0x888888;
  }
  function focusSub(sub) {
    hoverSub = sub;
    bodies.forEach(function (b) {
      const on = !sub || b.sub === sub;
      const m = b.mesh.material;
      const was = m.transparent;
      m.opacity = on ? (m.userData.baseOpacity != null ? m.userData.baseOpacity : 1) : 0.06;
      m.transparent = m.opacity < 1;
      m.depthWrite = m.opacity > 0.5;
      // Toggling `transparent` selects a different shader program, so three.js
      // needs telling; without this the ghosting silently does nothing on any
      // material that started opaque.
      if (m.transparent !== was) m.needsUpdate = true;
    });
    if (elRead) {
      const s = R.SUBSYSTEMS.filter(function (x) { return x.key === sub; })[0];
      elRead.textContent = s ? s.label + " — " + s.blurb : "";
    }
    if (elLegend) {
      Array.prototype.forEach.call(elLegend.querySelectorAll(".tower-key"), function (b) {
        b.classList.toggle("on", b.dataset.sub === sub);
        b.setAttribute("aria-pressed", String(b.dataset.sub === sub));
      });
    }
    schedule();
  }

  // ---- controls -----------------------------------------------------------
  if (elExp) {
    elExp.addEventListener("input", function () {
      explodeTarget = Math.max(0, Math.min(1, elExp.value / 100));
      schedule();
    });
  }
  // Taking the case off is the single most useful thing a reader can do here:
  // the machine is entirely enclosed, so every internal is invisible until the
  // shell comes away. Cheaper and far more legible than exploding to find it.
  let caseOn = true;
  if (elCase) {
    elCase.addEventListener("click", function () {
      caseOn = !caseOn;
      elCase.setAttribute("aria-pressed", String(!caseOn));
      elCase.textContent = caseOn ? "Hide case" : "Show case";
      bodies.forEach(function (b) { if (b.isCase) b.mesh.visible = caseOn; });
      fitWant = caseOn ? fitAll : fitCore;
      schedule();
    });
  }

  // WCAG 2.2.2: motion that runs by itself for more than five seconds beside
  // other content needs a control a reader can actually reach.
  if (elPlay) {
    elPlay.setAttribute("aria-pressed", String(paused));
    elPlay.textContent = paused ? "Play" : "Pause";
    elPlay.addEventListener("click", function () {
      paused = !paused;
      elPlay.setAttribute("aria-pressed", String(paused));
      elPlay.textContent = paused ? "Play" : "Pause";
      if (!paused) { clock.getDelta(); schedule(); }
    });
  }

  // ---- render loop --------------------------------------------------------
  // Gated exactly like the photometer and DiOPAL scenes. A WebGL loop that
  // never parks is the lag bug this wiki already shipped once.
  let raf = null, onScreen = true, vw = 0, vh = 0;
  const OSC_AMP = 42 * Math.PI / 180, OSC_PERIOD = 11;
  let t = 0;

  function schedule() {
    // Intersection is the gate that matters: it stops the loop for a scene
    // scrolled off the page. Browsers already suspend rAF in a hidden tab, so
    // testing document.hidden here as well buys no CPU back — and it would
    // stall the offline card renderer, which drives this scene from a hidden
    // context on purpose (the reason preserveDrawingBuffer is on above).
    if (raf == null && onScreen) raf = requestAnimationFrame(tick);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === vw && h === vh)) return;
    vw = w; vh = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function tick() {
    raf = null;
    const dt = Math.min(clock.getDelta(), 0.05);
    resize();
    if (!paused) t += dt;
    // Oscillate rather than revolve: a chassis is flat plates, and a full turn
    // sweeps every face edge-on twice a lap.
    rig.rotation.y = Math.sin((t / OSC_PERIOD) * Math.PI * 2) * OSC_AMP;

    const k = 1 - Math.exp(-dt * 8);          // frame-rate independent damping
    explode += (explodeTarget - explode) * k;
    if (Math.abs(explodeTarget - explode) < 0.0005) explode = explodeTarget;

    let refitting = false;
    if (fitWant) {
      const ds = fitWant.s - rig.scale.x;
      if (Math.abs(ds) > fitWant.s * 0.001 || rig.position.distanceTo(fitWant.p) > 0.05) {
        rig.scale.setScalar(rig.scale.x + ds * k);
        rig.position.lerp(fitWant.p, k);
        refitting = true;
      } else {
        rig.scale.setScalar(fitWant.s);
        rig.position.copy(fitWant.p);
      }
    }
    bodies.forEach(function (b) {
      b.mesh.position.copy(b.dir).multiplyScalar(b.reach * explode);
    });

    renderer.render(scene, camera);
    // Keep animating only while something is actually moving.
    if (!paused || refitting || Math.abs(explodeTarget - explode) > 0.0005) schedule();
  }

  // A handle for tooling and debugging, in the spirit of window.__photo on the
  // photometer page. Read-only as far as the scene is concerned.
  window.__tower = {
    rig: rig, bodies: bodies,
    state: function () {
      return { onScreen: onScreen, paused: paused, ticking: raf != null,
               scale: rig.scale.x, explode: explode,
               fitAll: fitAll && fitAll.s, fitCore: fitCore && fitCore.s,
               want: fitWant && fitWant.s, caseBodies: bodies.filter(function (b) {
                 return b.isCase; }).length };
    }
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
      if (onScreen) { clock.getDelta(); schedule(); }
    }, { rootMargin: "120px" }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { clock.getDelta(); schedule(); }
  });
  window.addEventListener("resize", function () { vw = 0; schedule(); });
})();
