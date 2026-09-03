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
  const rail = document.getElementById("rail");
  const counter = document.getElementById("counter");
  const bar = document.getElementById("bar");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Shared spin. The assembly and every featured part use the same axis and
  // rate, so nothing appears to turn at its own pace.
  const SPIN_RATE = 0.45;

  // The base's four contact pads lie on a face whose normal is (0.131, -0.991, 0),
  // i.e. the model is drawn leaning. Rolling it back by that angle puts the pads
  // flat on the ground. This is a *model-space* correction applied inside the
  // spin (Euler order YZX), so the feet stay parallel to the ground through every
  // rotation — tilting after the spin instead makes the whole thing wobble.
  const STAND = -Math.atan2(0.131, 0.991);

  // The 3/4 view comes from raising the camera, not from tilting the object,
  // which would drag the feet off the ground plane as it turns.
  const CAM_DIST = 285;
  const CAM_ELEV = 0.175;

  const BEAT = 0.38;          // viewport-heights of scroll per beat
  const HERO = 0.9;
  const PART_START = HERO + 0.7;
  const N = PARTS.length;
  const LAST_GONE = PART_START + (N - 1) + 0.22;
  const FINALE_START = LAST_GONE + 0.05;
  const FINALE_SPAN = 0.8;
  const TOTAL = FINALE_START + FINALE_SPAN + 0.4;

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
    blob(300, 190, 120, "#ff9d2e", 0.30);  // warm bounce, echoes the LED
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
  // The old painted environment was three blurred blobs; RQ.studioEnv paints
  // rectangular softboxes and a floor, which is what gives curved surfaces
  // the long straight highlights that read as a studio shot.
  scene.environment = RQ.studioEnv(renderer);

  // Light kit sits on top of the environment for shape definition only.
  const key = new THREE.DirectionalLight(0xfff6ec, 0.38);
  key.position.set(80, 130, 150);
  scene.add(key);
  // Self-shadowing: parts shadow each other so crevices and overhangs read as
  // depth. No ground plane — that would light them better still but would
  // change compositions that are already framed.
  RQ.enableShadows(renderer, key);
  const rimWarm = new THREE.DirectionalLight(0xff9d2e, 0.35);
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
    rg.addColorStop(0.00, "rgba(255,206,158,0.26)");
    rg.addColorStop(0.35, "rgba(255,180,120,0.09)");
    rg.addColorStop(1.00, "rgba(255,165,90,0)");
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
  const MATERIALS = {
    printed: function () {
      // The real parts are printed in black. They were grey here only because
      // a matte black object on a black background has no edges — but with a
      // clearcoat and a structured environment the specular carries the form,
      // which is exactly how the reference renders read black on black. Not
      // pure black: a little lift gives the reflections something to sit on.
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        // metalness stays low: plastic is a dielectric, and metalness draws
        // colour from reflections, which is the other way a black part turns grey
        color: 0x101317, metalness: 0.08, roughness: 0.317, envMapIntensity: 0.567 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    black: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x0f1114, metalness: 0.18, roughness: 0.446, envMapIntensity: 1.013 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    pcb: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x14306b, metalness: 0.18, roughness: 0.374, envMapIntensity: 1.147 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    chipGrey: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x9ba1a9, metalness: 0.72, roughness: 0.245, envMapIntensity: 1.350 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
    },
    chipBlack: function () {
      return { base: 1, glass: false, mat: new THREE.MeshPhysicalMaterial({
        color: 0x141619, metalness: 0.25, roughness: 0.418, envMapIntensity: 0.945 , clearcoat: 1, clearcoatRoughness: 0.09 }) };
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
    return s + (p.layers ? p.layers.length : 1);
  }, 0);
  let layersDone = 0;

  PARTS.forEach(function (part, index) {
    const layers = part.layers || [{ file: part.file, mat: "printed" }];
    const geos = new Array(layers.length);
    let got = 0;

    layers.forEach(function (layer, li) {
      stlLoader.load(layer.file, function (geo) {
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

  // ---------- the beam ----------
  // The light path belongs to the instrument, not to any one part, so it lives
  // in the rig: present in the hero, in the small assembly during the
  // walkthrough, and in the finale — but never lifted out on its own.
  let beam = null;
  stlLoader.load("models/light-path.stl", function (geo) {
    RQ.smoothNormals(geo);
    // depthTest off so the beam reads through the housing that encloses it —
    // otherwise it is only visible once the shells have been taken off.
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffa63f, transparent: true, opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false,
      side: THREE.DoubleSide,
    });
    beam = new THREE.Mesh(geo, mat);
    beam.renderOrder = 2000;
    rig.add(beam);
    if (ready) placeBeam();
  });

  // Pulses along the same path the model traces. The route is read off
  // light-path.stl itself rather than written twice: it runs y -19.3 (the LED)
  // down to the splitter at y -171.9, where the reference branch leaves to
  // x -19.1, and on to the sample sensor at y -193.8.
  const pulses = new THREE.Group();
  const pulseRuns = [];
  (function buildPulses() {
    const routes = [
      [[0, -19.3, 0], [0, -171.9, 0], [-19.1, -171.9, 0]],
      [[0, -19.3, 0], [0, -193.8, 0]]
    ];
    routes.forEach(function (pts, i) {
      const v = pts.map(function (a) { return new THREE.Vector3(a[0], a[1], a[2]); });
      const segs = [];
      let total = 0;
      for (let k = 1; k < v.length; k++) {
        const len = v[k - 1].distanceTo(v[k]);
        segs.push({ a: v[k - 1], b: v[k], len: len, at: total });
        total += len;
      }
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 8, 6),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xffa63f).convertSRGBToLinear(),
          transparent: true, opacity: 0.85, toneMapped: false,
          // additive for the same reason the beam itself is: light adds, and
          // alpha-blending a colour over a pale surface darkens it
          blending: THREE.AdditiveBlending,
          depthTest: false, depthWrite: false }));
      dot.renderOrder = 2001;
      dot.position.copy(v[0]);
      pulses.add(dot);
      pulseRuns.push({ dot: dot, segs: segs, total: total, phase: i * 0.42 });
    });
    rig.add(pulses);
  })();

  function placeBeam() {
    if (beam) beam.position.set(-asmCenter.x, -asmCenter.y, -asmCenter.z);
    // same rig-local frame as every part anchor
    pulses.position.set(-asmCenter.x, -asmCenter.y, -asmCenter.z);
  }

  // The path belongs to the assembled instrument. Left at full strength it hung
  // in the air while the parts flew apart around it.
  function runBeam(t, visible) {
    if (beam) beam.material.opacity = 0.17 * visible;
    pulses.visible = visible > 0.02;
    if (!pulses.visible) return;
    pulseRuns.forEach(function (run) {
      run.dot.material.opacity = 0.85 * visible;
      if (reduced) return;
      let d = ((t / 3.6) + run.phase) % 1 * run.total, k = 0;
      while (k < run.segs.length - 1 && d > run.segs[k].at + run.segs[k].len) k++;
      const sg = run.segs[k];
      run.dot.position.copy(sg.a).lerp(sg.b, Math.min(1, Math.max(0, (d - sg.at) / sg.len)));
    });
  }

  // ---------- framing ----------
  const asmCenter = new THREE.Vector3();
  const asmSize = new THREE.Vector3();
  let rigScaleBase = 1;

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
    panelR.innerHTML = specRows(p.specs) + (p.cad
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

  const wPos = new THREE.Vector3();
  const wQuat = new THREE.Quaternion();
  const flipQuat = new THREE.Quaternion();
  const poseQuat = new THREE.Quaternion();
  const YAXIS = new THREE.Vector3(0, 1, 0);
  const XAXIS = new THREE.Vector3(1, 0, 0);

  function frame(dt) {
    if (!ready) return;
    const H = frameSize();
    if (!reduced) spin += dt * SPIN_RATE;

    const heroT = 1 - ease(clamp01(progress / (HERO * 0.9)));
    const finaleT = ease(clamp01((progress - FINALE_START) / FINALE_SPAN));
    const big = Math.max(heroT, finaleT);
    runBeam(clock.getElapsedTime(), big);

    // Large state sits slightly low and stops short of full height, leaving
    // clear space at the top for the hero / finale caption.
    const rigY = lerp(-H * 0.235, -H * 0.11, big);
    const rigS = rigScaleBase * lerp(1, 1.70, big);
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

      if (finaleT > 0) {
        t = Math.min(t, 1 - finaleT);
        opacity = Math.max(opacity, finaleT);
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
      it.obj.scale.setScalar(lerp(rigS, featScale, t));

      // A featured part keeps the rig's exact orientation. Any per-part offset
      // here means the slerp has to travel that extra angle during the lift-out,
      // which reads as the part briefly spinning at a different speed.
      it.obj.quaternion.copy(wQuat);
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
      }
    }

    glow.material.opacity = lerp(0.9, 0.55, big);

    // hand the featured part to the annotation overlay, if one is attached
    if (annotFn) {
      const it = featured >= 0 ? items[featured] : null;
      annotFn(it ? it.obj : null, it ? it.part : null,
              it ? lastT : 0, camera, "#ffa23d");
    }

    const showPart = featured >= 0 && big < 0.25;
    if (showPart) setHud(featured);
    panelL.classList.toggle("show", showPart);
    panelR.classList.toggle("show", showPart);
    rail.classList.toggle("show", showPart);
    counter.classList.toggle("show", showPart);
    heroEl.classList.toggle("show", heroT > 0.55);
    finaleEl.classList.toggle("show", finaleT > 0.55);

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
    spinTo: function (p, a) {
      progress = p; target = p; spin = a; frame(0); renderer.render(scene, camera);
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
        return { i: i, id: it.part.id, vis: it.obj.visible,
                 op: +(it.fade == null ? 0 : it.fade).toFixed(3), lifted: +t.toFixed(3) };
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
