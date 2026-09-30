/* =============================================================================
   The homepage reactor.
   -----------------------------------------------------------------------------
   The same assembly as hardware/bioreactor/, rendered into the homepage's
   reactor section (#solution). Everything it knows comes from files that
   section already owns:

     BIO_PARTS       hardware/bioreactor/js/parts.js
     FLOW_PATHS      hardware/bioreactor/js/flow-paths.js
     BIO_COMPONENTS  hardware/bioreactor/js/components.js
     the meshes      hardware/bioreactor/models/_pack.json + _pack.bin

   Nothing about the device is described twice, so the homepage cannot end up
   claiming a part the technical record has dropped.

   Three things make this different from the record page's scene.js:

     · IT DOES NOT LOAD UNTIL ASKED. three.js (about 0.6 MB), the device files
       above and the packed assembly (2.4 MB) are all fetched by start(), and
       the WebGL renderer is only created then, so a reader who never scrolls
       past the problem section pays for none of it. home.js calls start()
       when #rx is 1.6 screens away. The page has no <script> tag for any of
       them; DEPS below is the list, in the order they must run.
     · IT STARTS AS A PHOTOGRAPH. The photograph of the rig under the canvas
       is what #rx shows until the model is built: tally() then adds
       .is-ready (the canvas fades in over it) and takes aria-hidden off the
       canvas, so until then the photograph's alt text speaks for it. No
       WebGL context, or a load that fails, adds .no-gl and the photograph
       simply stays. With scripting off neither is added, and the box is
       never empty.
     · IT EXPOSES highlight(), so the five demand cards around the model can
       light components up without a second copy of the picker. A lit set is
       painted in the signal green of the cards and everything else, the
       plinth's glow included, goes dark, because a glow on its own is too
       faint to find in a rotating assembly. Besides the ids in
       components.js it knows two of its own: "light", the induction light
       just outside the culture vessel's wall, which is only on while it is
       asked for, and "unit", every part of the machine (not the plinth).
       On this page "harvest" also takes the shell-side line: the tubes and
       the green flow that carry the harvest from outside the fibre to the
       harvest bottle.

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
    park: function () {},
    failed: true,
  };

  var canvas = document.getElementById("rx-gl");
  var host = document.getElementById("rx");
  if (!canvas || !host) return api;

  // Anything that goes wrong, at any stage, including a WebGL context lost
  // after the model was built: the photograph stays or comes back, the
  // loading pill goes, and #rx says so ("rx-giveup"), so home.js can turn the
  // demand cards back into plain text. (loadEl is declared with the loader,
  // and self is the object this returns, both further down.)
  var gaveUp = false;
  function giveUp() {
    if (gaveUp) return;
    gaveUp = true;
    ready = false;
    host.classList.add("no-gl");
    canvas.setAttribute("aria-hidden", "true");
    if (loadEl) loadEl.hidden = true;
    if (self) self.failed = true;
    try { host.dispatchEvent(new CustomEvent("rx-giveup")); } catch (e) { /* old browser: the class is enough */ }
  }

  /* ---------- the files it needs, fetched by start() ----------
     The same vendor bundle, part list, flow centerlines and component
     definitions as hardware/bioreactor/, in the order they must run. Classic
     scripts inserted with async = false run in insertion order. */
  var DEPS = [
    "hardware/js/vendor/three.min.js",
    "hardware/js/packed-loader.js",
    "hardware/js/render-quality.js",
    "hardware/bioreactor/js/parts.js",
    "hardware/bioreactor/js/flow-paths.js",
    "hardware/bioreactor/js/components.js"
  ];
  function haveDeps() {
    return typeof THREE !== "undefined" && typeof BIO_PARTS !== "undefined" &&
      typeof PackedModel !== "undefined" && typeof RQ !== "undefined";
  }
  function loadDeps(done) {
    if (haveDeps()) { done(true); return; }
    var left = DEPS.length, over = false;
    function end(ok) { if (!over) { over = true; done(ok); } }
    DEPS.forEach(function (src) {
      var el = document.createElement("script");
      el.src = src;
      el.async = false;
      el.onload = function () { if (--left === 0) end(haveDeps()); };
      el.onerror = function () { end(false); };
      document.head.appendChild(el);
    });
  }

  var renderer, scene, camera, TARGET, key, sig, cultureLight;
  // dist is 1550 here, not the record page's 1780: the model sits between
  // two columns of cards, and at this distance it is about 1.1 × the canvas
  // height wide (the field of view is vertical), which home-reactor.css
  // counts on when it sizes the canvas.
  var HOME = -0.62;        // the three-quarter view every part is visible from
  var yaw = HOME, pitch = 0.14, dist = 1550;

  function place() {
    camera.position.set(
      TARGET.x + dist * Math.sin(yaw) * Math.cos(pitch),
      TARGET.y + dist * Math.sin(pitch),
      TARGET.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(TARGET);
  }

  /* ---------- renderer, scene and lighting, once the files are in ----------
     Returns false when there is no WebGL context. */
  function init() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      return false;
    }
    if (!renderer || !renderer.getContext()) return false;
    // A phone reclaiming GPU memory, a GPU reset or switch: the canvas would
    // go blank over a hidden photograph. Give up instead, so it comes back.
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      giveUp();
    }, false);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 8000);
    TARGET = new THREE.Vector3(-80, 128, 0);

    scene.environment = RQ.studioEnv(renderer);
    key = new THREE.DirectionalLight(0xfff6ec, 0.38);
    key.position.set(300, 500, 600);
    scene.add(key);
    RQ.enableShadows(renderer, key);
    var rimW = new THREE.DirectionalLight(0xffd9a8, 0.22); rimW.position.set(500, -100, -500); scene.add(rimW);
    var rimC = new THREE.DirectionalLight(0xbcd0e6, 0.30); rimC.position.set(-500, 200, -550); scene.add(rimC);
    // the 520 nm the circuit actually runs on, thrown from the reader's left so
    // the reveal's green light and the scene's green light are the same light
    sig = new THREE.DirectionalLight(0x3ddc8b, SIG_I); sig.position.set(-620, 240, 380); scene.add(sig);
    // the induction light itself, just outside the culture vessel's wall:
    // off until a card asks for "light"; placed by the bottle once the
    // model is in
    cultureLight = new THREE.PointLight(0x3ddc8b, 0, 360, 1.4);
    scene.add(cultureLight);
    SIG_COL = new THREE.Color(SIGNAL);
    return true;
  }

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
      // the green shell-side flow is the harvest leaving the fibre from
      // outside it: it stays up while the harvest is lit
      if (fp.loop === "shell") glowOf.set(mat, "harvest");
      var mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      scene.add(mesh);
    });
    var core = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 200, 14),
      new THREE.MeshBasicMaterial({ color: 0xff8a2e, transparent: true, opacity: .5,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.set(-405.3, 195.4, 0); core.renderOrder = 2; scene.add(core);
    glowOf.set(core.material, "membrane");
    var halo = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 285, 16),
      new THREE.MeshBasicMaterial({ color: 0x3ddc8b, transparent: true, opacity: .22,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(-405.3, 195.4, 0); halo.renderOrder = 2; scene.add(halo);
    glowOf.set(halo.material, "membrane");
  }

  /* ---------- the plinth ---------- */
  // The record page's stage carries a wordmark. This one does not: the
  // heading above the reactor is already saying it, and saying it twice in
  // the same frame reads as a placeholder nobody removed.
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

  /* ---------- highlight, for the demand cards ---------- */
  // A card lights the components it names and dims everything else, the one
  // highlight primitive the homepage uses elsewhere (the big picture dims;
  // nothing moves). Tinting alone was too faint to find on a turning model;
  // taking the rest down, the plinth's green rim and the flow pulses
  // included, is what makes the lit part findable at a glance. Every lit
  // part takes the same green as the cards' border, so a card and its parts
  // read as one thing. The dim eases in and out on the render loop; with
  // reduced motion it is applied in one step.
  var SIGNAL = 0x3ddc8b;   // the circuit's 520 nm, and the cards' green
  var SIG_COL = null;      // THREE is not loaded yet; made in init()
  var SIG_I = 0.30;        // the scene's green fill light
  var LIT = 0.5;           // emissive added to a lit part
  var TINT = 0.4;          // how far a lit part's own colour moves to the green
  var DIM = 0.84;          // how far everything else goes down at full dim
  // "unit" lights the whole machine: every part at once in full green reads
  // as one flat shape, so each keeps more of its own colour
  var UNIT_LIT = 0.22, UNIT_TINT = 0.16;
  var GLOW_L = 2.3;        // the induction light at full strength
  // Clear glass (the membrane shell, the harvest bottle, the tubes) is
  // mostly transmission, and the renderer draws a transmissive surface
  // nearly see-through over this transparent canvas, so a green glow on it
  // barely shows. While it is lit it is made less clear (GLASS_TR, GLASS_LIT
  // in paint()). Lit glass, the frosted culture bottle included, also takes
  // the green further into its own colour (GLASS_TINT in shade()), so it
  // reads as green glass rather than white.
  var GLASS_TR = 0.4, GLASS_TINT = 0.8, GLASS_LIT = 0.45, GLASS_ENV = 0.55;
  var comps = {};          // id -> [{ mat, hex, ei, tr }]
  var litIds = [];
  // What the cards last asked for. A card can be pointed at while the model
  // is still loading; the request is kept and applied once it is ready.
  var wantIds = [];
  var shades = [];         // every material in the scene, with its own values
  var litMats = null;      // the lit materials (a Set), or null
  var glowOf = new Map();  // an additive glow that belongs to a component
  var unitMats = new Set();// every material of the machine itself
  var dimNow = 0, dimWant = 0, lightNow = 0, lightWant = 0;

  function has(id) { return litIds.indexOf(id) >= 0; }

  function applyHighlight() {
    if (!ready) return;
    if (wantIds.join(" ") === litIds.join(" ")) return;
    litIds.forEach(function (x) { paint(x, 0); });
    litIds = wantIds.slice();
    litIds.forEach(function (x) { paint(x, x === "unit" ? UNIT_LIT : LIT); });
    litMats = null;
    if (litIds.length) {
      litMats = new Set();
      litIds.forEach(function (x) {
        (comps[x] || []).forEach(function (m) { litMats.add(m.mat); });
      });
    }
    dimWant = litIds.length ? 1 : 0;
    lightWant = has("light") ? 1 : 0;
    if (reduced) { dimNow = dimWant; lightNow = lightWant; }
    shade();              // at once for the parts that changed sides
    if (reduced) render();
  }

  // Additive glows (the flow pulses, the plinth light) fade; surfaces darken,
  // so depth sorting is left alone and nothing turns see-through. A lit part
  // also takes some of the green into its own colour, so a white fibre or a
  // clear bottle reads as lit rather than just brighter. A glow that belongs
  // to a lit component (the beam in the photometer, the glow inside the
  // membrane) stays up with it, and with "unit" every glow of the machine
  // does. The scene's green fill goes down with the rest, or the dimmed
  // glass picks it up and reads as tinted.
  function shade() {
    var k = 1 - DIM * dimNow, unit = has("unit");
    var tint = unit ? UNIT_TINT : TINT;
    shades.forEach(function (s) {
      var m = s.mat, lit = !!(litMats && litMats.has(m)), f = lit ? 1 : k;
      if (s.additive) {
        if ((s.comp && has(s.comp)) || (unit && s.unit)) f = 1;
        m.opacity = s.op * f;
        return;
      }
      if (s.color) {
        m.color.copy(s.color);
        if (lit) m.color.lerp(SIG_COL, !unit && s.glass ? GLASS_TINT : tint);
        else m.color.multiplyScalar(f);
      }
      // lit glass also reflects less of the studio, whose white would wash
      // its green out
      if (s.env !== undefined) m.envMapIntensity = s.env * (lit && !unit && s.glass ? GLASS_ENV : f);
      if (s.ei !== undefined && !lit) m.emissiveIntensity = s.ei * f;
    });
    if (sig) sig.intensity = SIG_I * (1 - 0.8 * dimNow);
    if (cultureLight) cultureLight.intensity = GLOW_L * lightNow;
  }

  function entry(o) {
    return { mat: o.material, hex: o.material.emissive.getHex(), ei: o.material.emissiveIntensity || 0,
             tr: o.material.transmission || 0 };
  }
  function indexComponents() {
    if (typeof BIO_COMPONENTS === "undefined") return;
    BIO_COMPONENTS.forEach(function (def) {
      var found = [];
      def.meshes.forEach(function (n) {
        var o = scene.getObjectByName(n);
        if (!o || !o.material) return;
        // a glow with no surface of its own (the photometer's beam) is
        // kept up while its component is lit
        if (o.material.blending === THREE.AdditiveBlending) { glowOf.set(o.material, def.id); return; }
        if (o.material.emissive) found.push(entry(o));
      });
      if (found.length) comps[def.id] = found;
    });
    // the harvest line: the shell-side tubes named in FLOW_PATHS
    if (typeof FLOW_PATHS !== "undefined") {
      FLOW_PATHS.forEach(function (fp) {
        var o = fp.loop === "shell" && scene.getObjectByName(fp.name);
        if (!o || !o.material || !o.material.emissive) return;
        (comps.harvest = comps.harvest || []).push(entry(o));
      });
    }
    // the whole machine: every part in the part list
    var unit = [];
    BIO_PARTS.forEach(function (p) {
      var o = scene.getObjectByName(p.file);
      if (!o || !o.material) return;
      unitMats.add(o.material);
      if (o.material.emissive) unit.push(entry(o));
    });
    comps.unit = unit;
    // every material in the scene, plinth and flow included, with the values
    // shade() scales from
    var seen = new Set();
    scene.traverse(function (o) {
      var m = o.isMesh && o.material;
      if (!m || seen.has(m)) return;
      seen.add(m);
      shades.push({
        mat: m,
        additive: m.blending === THREE.AdditiveBlending,
        comp: glowOf.get(m) || null,
        unit: unitMats.has(m) || flowMats.indexOf(m) >= 0 || glowOf.has(m),
        color: m.color ? m.color.clone() : null,
        glass: (m.transmission || 0) >= 0.6,   // clear and frosted glass
        env: m.envMapIntensity,
        op: m.opacity,
        ei: m.emissiveIntensity
      });
    });
  }

  // an opaque part has no emissive of its own (black at intensity 1), so its
  // lit strength is the whole intensity; glass already glows a little, so
  // its strength goes on top. Glass (the membrane shell, the harvest
  // bottle, the tubes, the frosted culture bottle) is made less clear while
  // it is lit (GLASS_TR), or the Biosafe card lights little more than a
  // cap, and it gets a gentler glow of its own (GLASS_LIT), because a bright
  // one tone-maps to white. With "unit" the glass keeps its clearness, so
  // the whole machine does not turn milky.
  function paint(id, strength) {
    (comps[id] || []).forEach(function (m) {
      var clear = m.tr >= 0.6 && id !== "unit";
      if (strength > 0) {
        m.mat.emissive.setHex(SIGNAL);
        m.mat.emissiveIntensity = m.hex === 0 ? strength
          : m.ei + (clear ? GLASS_LIT : strength);
        if (clear) m.mat.transmission = GLASS_TR;
      } else {
        m.mat.emissive.setHex(m.hex);
        m.mat.emissiveIntensity = m.ei;
        if (m.tr) m.mat.transmission = m.tr;
      }
    });
  }

  // The induction light sits just outside the culture vessel's wall, on the
  // side the reader looks from, a third of the way up: it lights the culture
  // through the wall and throws green onto the plinth round it.
  function placeCultureLight() {
    var o = scene.getObjectByName("media-bottle");
    if (!o || !cultureLight) return;
    o.geometry.computeBoundingBox();
    var b = o.geometry.boundingBox;
    var cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    var r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + 45;
    cultureLight.position.set(cx + r * Math.sin(HOME), b.min.y + (b.max.y - b.min.y) * 0.32,
                              cz + r * Math.cos(HOME));
  }

  /* ---------- drive ---------- */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var dragging = false, userHeld = false, px = 0, py = 0;
  var ready = false, booted = false;

  // The model is one screen in a page that is roughly fifteen. A render loop
  // that keeps drawing while the reader is down in the vision section costs a
  // GPU for nothing and makes scrolling stutter, so the loop parks itself
  // whenever the stage leaves the viewport and picks the clock back up where
  // it left it.
  // parked: home.js (piece 7) holds the loop while the model is hidden in
  // the scene before it pops in, so the scroll-scrubbed scene has the
  // frame to itself
  var visible = true, paused = false, parked = false, clock = 0, lastNow = 0;
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

  // The reader takes the turn over only by actually dragging. A tap leaves
  // the idle turn running, and so does a swipe the browser takes for
  // scrolling (touch-action: pan-y): that gesture ends in pointercancel,
  // sometimes after a first move, so a cancel puts back whatever the reader
  // had before it began.
  var sx = 0, sy = 0, heldBefore = false;
  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; heldBefore = userHeld; px = sx = e.clientX; py = sy = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    if (!userHeld) {
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) <= 3) return;
      userHeld = true;
    }
    yaw -= (e.clientX - px) * .005;
    pitch = Math.max(-.35, Math.min(.9, pitch + (e.clientY - py) * .004));
    px = e.clientX; py = e.clientY;
    if (reduced) render();
  });
  canvas.addEventListener("pointerup", function () { dragging = false; });
  // the loop picks up a new box size on its next frame; a reduced-motion page
  // has no loop, so it redraws here instead of waiting for a drag
  window.addEventListener("resize", function () { if (ready && reduced) render(); });
  canvas.addEventListener("pointercancel", function () { dragging = false; userHeld = heldBefore; });

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

  // The idle turn. While a card has parts lit, the model comes round to the
  // three-quarter view it opens on, where every part can be seen, and holds
  // there; the swing is capped at a gentle speed so a far turn never whips.
  // When the light goes out the turn picks up again from wherever it
  // stopped, easing back to speed. A reader who has dragged the model keeps
  // the view they chose (the caller skips this).
  // 1 Oct: half the old idle speed (0.055) and a slower swing, on the
  // students' note that the model spun too much
  var TAU = Math.PI * 2, SPIN = 0.025, spin = 1;
  function turn(dt) {
    if (litIds.length) {
      var goal = HOME + Math.round((yaw - HOME) / TAU) * TAU;
      var step = (goal - yaw) * Math.min(1, dt * 3);
      var cap = dt * 0.45;
      yaw += Math.max(-cap, Math.min(cap, step));
      spin = 0;
    } else {
      spin += (1 - spin) * Math.min(1, dt * 1.2);
      yaw += dt * SPIN * spin;
    }
  }

  function run() {
    if (reduced) { render(); return; }
    lastNow = performance.now();
    (function tick(now) {
      if (!ready) return;
      if (!visible || parked || document.hidden) { paused = true; return; }
      var real = Math.max(0, (now - lastNow) / 1000);
      var dt = Math.min(0.05, real);                     // cap the step so a
      clock += dt;                                       // long park does not
      lastNow = now;                                     // spin the reactor
      var t = clock;
      if (!dragging && !userHeld) turn(dt);
      flowMats.forEach(function (m) { m.map.offset.x = -(t * FLOW_SPEED) / DASH_MM; });
      rotors.forEach(function (r) { r.rotation.z = t * 1.7; });
      if (dimNow !== dimWant || lightNow !== lightWant) {
        // the fades run on real time, not the capped step, so a slow frame
        // rate does not leave the last card's light up for seconds
        var e = Math.min(real, 0.5);
        dimNow += (dimWant - dimNow) * (1 - Math.exp(-e * 9));
        if (Math.abs(dimWant - dimNow) < 0.004) dimNow = dimWant;
        lightNow += (lightWant - lightNow) * (1 - Math.exp(-e * 7));
        if (Math.abs(lightWant - lightNow) < 0.004) lightNow = lightWant;
        shade();
      }
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
    if (failedParts > BIO_PARTS.length / 3) { giveUp(); return; }
    // this runs inside the loader's promise, where nothing would catch a
    // throw: any failure in the build leaves the photograph, not a stuck pill
    try {
      buildFlow();
      buildStage();
      RQ.shadowAll(scene);
      RQ.fitShadow(key, scene);
      indexComponents();
      placeCultureLight();
    } catch (e) {
      giveUp();
      return;
    }
    if (loadEl) loadEl.hidden = true;
    ready = true;
    // the photograph underneath gives way only now, so the box is never
    // empty; until now the canvas was hidden from assistive tech and the
    // photograph's alt stood for it
    host.classList.add("is-ready");
    canvas.removeAttribute("aria-hidden");
    applyHighlight();
    run();
  }

  function boot() {
    if (booted) return;
    booted = true;
    if (loadEl) loadEl.hidden = false;
    loadDeps(function (ok) {
      if (!ok) { giveUp(); return; }
      try {
        if (!init()) { giveUp(); return; }
        loadModel();
      } catch (e) {
        giveUp();
      }
    });
  }

  function loadModel() {
    // The geometry is one packed bundle, models/_pack.json + _pack.bin (the
    // 55 separate .stl files no longer exist). PackedModel.bundle() is a
    // drop-in for THREE.STLLoader: same load(url, ok, progress, fail) shape,
    // resolved by basename, one 2.4 MB fetch for the whole assembly.
    var stl = PackedModel.bundle(MODEL_BASE);
    BIO_PARTS.forEach(function (p) {
      stl.load(MODEL_BASE + p.file + ".stl", function (geo) {
        // a part that cannot be built counts as a failed part, never as a
        // throw inside the loader's promise (which would leave the pill up)
        try {
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
        } catch (e) {
          failedParts++;
        }
        tally();
      }, undefined, function () { failedParts++; tally(); });
    });
  }

  var self = {
    start: boot,
    isReady: function () { return ready; },
    redraw: function () { if (ready) render(); },
    park: function (on) {
      on = !!on;
      if (on === parked) return;
      parked = on;
      if (!on && paused && visible && ready && !reduced) { paused = false; lastNow = performance.now(); run(); }
    },
    failed: false,
    // One card on the homepage can name several components at once — the
    // Monitored card points at the photometer and the vent together — so
    // this takes an id, a space-separated list of ids, or an array, and
    // lights the whole set.
    highlight: function (id) {
      wantIds = (id == null ? [] : (Array.isArray(id) ? id : String(id).split(/\s+/)))
                  .filter(Boolean);
      applyHighlight();
    },
  };
  return self;
})();
