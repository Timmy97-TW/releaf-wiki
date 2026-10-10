/* =============================================================================
   The homepage reactor.
   -----------------------------------------------------------------------------
   Anton's final design, the B2 carry case, turning slowly in the homepage's
   reactor section (#solution). The model is one file,

     assets/models/b2-reactor.glb     1.8 MB, 176k triangles

   cut from his 201 MB CAD export by build/reactor-glb/build.mjs: every part
   decimated to a 0.4 mm error, the case screws more roughly, the path-tracer
   glass and liquids turned into plain blended glass and tinted liquid, and
   the parts gathered under named groups (the scene's children):

     case fasteners fixtures light reservoir pump dosing membrane harvest koh
     photometer vent sensors valves sampler line-culture line-koh line-product

   The demand cards name components (data-comp); CARD below says which groups
   each one lights. Until 10 Oct this file built the bench assembly from
   hardware/bioreactor/ (parts.js, flow-paths.js, components.js, _pack.bin);
   the technical record still does, this page no longer loads any of it.

     · IT DOES NOT LOAD UNTIL ASKED. three.js (0.6 MB), the glTF loader and
       the model are fetched by start(), and the WebGL renderer is only
       created then, so a reader who never scrolls past the problem section
       pays for none of it. home.js calls start() when #rx is 1.6 screens
       away. DEPS below is the list, in the order they must run.
     · IT STARTS AS A PHOTOGRAPH. The photograph of the rig under the canvas
       is what #rx shows until the model is built: built() then adds
       .is-ready (the canvas fades in over it) and takes aria-hidden off the
       canvas, so until then the photograph's alt text speaks for it. No
       WebGL context, or a load that fails, adds .no-gl and the photograph
       simply stays. With scripting off neither is added, and the box is
       never empty.
     · IT EXPOSES highlight(), so the five demand cards around the model can
       light components up without a second copy of the picker. A lit set is
       painted in the signal green of the cards and everything else, the
       plinth's glow included, goes dark, because a glow on its own is too
       faint to find in a turning machine. Besides the groups it knows "unit",
       every part of the machine (not the plinth). While anything is lit the
       model comes round to its open side, where the parts can be seen.

   Lengths are metres, as in the CAD.
   ========================================================================== */

window.__homeRx = (function () {
  "use strict";

  var MODEL = "assets/models/b2-reactor.glb";
  // what each card id lights: groups of the model. "light" is the case's own
  // green LED strips, with the induction light inside switched on.
  var CARD = {
    light: ["light"],
    reservoir: ["reservoir"],
    pump: ["pump", "dosing"],
    membrane: ["membrane"],
    harvest: ["harvest", "line-product"],
    photometer: ["photometer"],
    vent: ["vent"]
  };
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
     Classic scripts inserted with async = false run in insertion order.
     three.min.js and render-quality.js are the technical record's own copies;
     the glTF loader and the meshopt decoder are three r128's, to match. */
  var DEPS = [
    "hardware/js/vendor/three.min.js",
    "assets/js/vendor/GLTFLoader.js",
    "assets/js/vendor/meshopt_decoder.js",
    "hardware/js/render-quality.js"
  ];
  function haveDeps() {
    return typeof THREE !== "undefined" && !!THREE.GLTFLoader &&
      typeof MeshoptDecoder !== "undefined" && typeof RQ !== "undefined";
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
  // HOME is the three-quarter view onto the case's open side, the one every
  // part can be seen from. dist is set from the model's height once it is in.
  var HOME = -0.72;
  var yaw = HOME, pitch = 0.16, dist = 3;

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
    camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.05, 40);
    TARGET = new THREE.Vector3(0, 0.36, 0);

    scene.environment = RQ.studioEnv(renderer);
    key = new THREE.DirectionalLight(0xfff6ec, 0.55);
    key.position.set(-0.5, 0.9, 0.7);
    scene.add(key);
    // the case is black on an ink band: two rims draw its edges out of it
    var rimW = new THREE.DirectionalLight(0xffd9a8, 0.45); rimW.position.set(0.6, 0.2, -0.5); scene.add(rimW);
    var rimC = new THREE.DirectionalLight(0xbcd0e6, 0.60); rimC.position.set(-0.6, 0.5, -0.55); scene.add(rimC);
    // the 520 nm the circuit actually runs on, thrown from the reader's left so
    // the reveal's green light and the scene's green light are the same light
    sig = new THREE.DirectionalLight(0x3ddc8b, SIG_I); sig.position.set(-0.62, 0.24, 0.38); scene.add(sig);
    // a lamp inside the case, so what stands in it is not lost in its shadow
    var inner = new THREE.PointLight(0xf2f6ff, 0.9, 0.9, 1.6); inner.position.set(-0.02, 0.42, 0.02); scene.add(inner);
    // the induction light itself, beside the culture vessel: off until a card
    // asks for "light"; placed by the vessel once the model is in
    cultureLight = new THREE.PointLight(0x3ddc8b, 0, 0.5, 1.4);
    scene.add(cultureLight);
    SIG_COL = new THREE.Color(SIGNAL);
    return true;
  }

  /* ---------- the plinth ---------- */
  // A dark slab with a rim of the signal green under the case: it stands the
  // machine on something, and its light is what separates a black case from
  // the ink of the band.
  var glowOf = new Map();  // kept for shade(): an additive glow that belongs to a component
  function roundedRect(w, d, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function buildStage(box) {
    var cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, ground = box.min.y;
    var w = box.max.x - box.min.x + 0.08, dp = box.max.z - box.min.z + 0.08;
    // no specular at all: the rim lamps graze a flat slab and any gloss on it
    // turns the whole top into one pale glare
    var dark = new THREE.MeshLambertMaterial({ color: 0x070d09 });
    var glow = function (o) {
      return new THREE.MeshBasicMaterial({ color: 0x3ddc8b, transparent: true,
        opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    };
    var flat = function (mesh, y) { mesh.rotation.x = -Math.PI / 2; mesh.position.set(cx, y, cz); scene.add(mesh); return mesh; };

    flat(new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(w, dp, .03), { depth: .012, bevelEnabled: false }), dark), ground - .012);
    flat(new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(w + .03, dp + .03, .038), { depth: .008, bevelEnabled: false }), dark), ground - .022);
    flat(new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(w + .006, dp + .006, .032), { depth: .0016, bevelEnabled: false }), glow(.5)), ground - .0143).renderOrder = 1;
    var rimShape = roundedRect(w - .008, dp - .008, .028);
    rimShape.holes.push(new THREE.Path(roundedRect(w - .02, dp - .02, .023).getPoints(24)));
    flat(new THREE.Mesh(new THREE.ShapeGeometry(rimShape, 24), glow(.7)), ground + .0005).renderOrder = 1;
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
  // Clear glass (the membrane shell, the bottles, the tubes) is drawn nearly
  // see-through, so a green glow on it barely shows. While it is lit it is
  // made more solid (GLASS_OP, GLASS_LIT in paint()). Lit glass also takes
  // the green further into its own colour (GLASS_TINT in shade()), so it
  // reads as green glass rather than white.
  var GLASS_OP = 0.72, GLASS_TINT = 0.8, GLASS_LIT = 0.45, GLASS_ENV = 0.55;
  var comps = {};          // id -> [{ mat, hex, ei, op, glass }]
  var litIds = [];
  // What the cards last asked for. A card can be pointed at while the model
  // is still loading; the request is kept and applied once it is ready.
  var wantIds = [];
  var shades = [];         // every material in the scene, with its own values
  var litMats = null;      // the lit materials (a Set), or null
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

  function entry(m) {
    return { mat: m, hex: m.emissive.getHex(), ei: m.emissiveIntensity || 0, op: m.opacity,
             glass: m.transparent && m.opacity < 0.6 };
  }
  // Every mesh takes its own copy of its material (the file shares one "lab
  // grey" between a pump and a valve, and a card must be able to light one
  // without the other), then the groups are indexed for the cards.
  function indexComponents(root) {
    var byGroup = {}, unit = [];
    root.children.forEach(function (g) {
      var list = byGroup[g.name] = [];
      g.traverse(function (o) {
        if (!o.isMesh) return;
        var m = o.material = o.material.clone();
        // more of the studio on the case and its fittings, or black on ink is a hole
        if (g.name === "case" || g.name === "fasteners" || g.name === "fixtures") m.envMapIntensity = 1.9;
        if (g.name === "light") m.emissiveIntensity = 2.2;
        if (m.transparent) { m.depthWrite = false; o.renderOrder = m.opacity > 0.45 ? 1 : 2; }
        unitMats.add(m);
        var e = entry(m);
        list.push(e); unit.push(e);
      });
    });
    Object.keys(CARD).forEach(function (id) {
      var found = [];
      CARD[id].forEach(function (g) { found = found.concat(byGroup[g] || []); });
      if (found.length) comps[id] = found;
    });
    comps.unit = unit;
    // every material in the scene, the plinth included, with the values
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
        unit: unitMats.has(m),
        color: m.color ? m.color.clone() : null,
        glass: !!m.transparent && m.blending !== THREE.AdditiveBlending && m.opacity < 0.6,
        env: m.envMapIntensity,
        op: m.opacity,
        ei: m.emissiveIntensity
      });
    });
  }

  // an opaque part has no emissive of its own (black at intensity 1), so its
  // lit strength is the whole intensity; a liquid or an LED already glows a
  // little, so its strength goes on top. Glass is made more solid while it is
  // lit (GLASS_OP), or the Biosafe card lights little more than a cap, and it
  // gets a gentler glow of its own (GLASS_LIT), because a bright one
  // tone-maps to white. With "unit" the glass keeps its clearness, so the
  // whole machine does not turn milky.
  function paint(id, strength) {
    (comps[id] || []).forEach(function (m) {
      var clear = m.glass && id !== "unit";
      if (strength > 0) {
        m.mat.emissive.setHex(SIGNAL);
        m.mat.emissiveIntensity = m.hex === 0 ? (clear ? GLASS_LIT : strength) : m.ei + strength;
        if (clear) m.mat.opacity = GLASS_OP;
      } else {
        m.mat.emissive.setHex(m.hex);
        m.mat.emissiveIntensity = m.ei;
        m.mat.opacity = m.op;
      }
    });
  }

  // The induction light sits beside the culture vessel, on the open side, a
  // third of the way up: it lights the culture and the deck round it.
  function placeCultureLight(root) {
    var o = root.getObjectByName("reservoir");
    if (!o || !cultureLight) return;
    var b = new THREE.Box3().setFromObject(o);
    cultureLight.position.set(b.min.x - 0.03, b.min.y + (b.max.y - b.min.y) * 0.4, (b.min.z + b.max.z) / 2 + 0.05);
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
      if (!dragging && !userHeld) turn(dt);
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
  var loadEl = document.getElementById("rx-load");
  var loadPct = loadEl ? loadEl.querySelector("span") : null;

  function built(gltf) {
    // this runs inside the loader's callback, where nothing would catch a
    // throw: any failure in the build leaves the photograph, not a stuck pill
    try {
      var root = gltf.scene;
      scene.add(root);
      var box = new THREE.Box3().setFromObject(root);
      TARGET.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2 - 0.02, (box.min.z + box.max.z) / 2);
      // the whole case, handle and plinth, inside the canvas's height with air
      // above and below; the field of view is vertical, so this holds at any width
      dist = (box.max.y - box.min.y) / 2 / Math.tan(camera.fov * Math.PI / 360) * 1.3;
      buildStage(box);
      indexComponents(root);
      placeCultureLight(root);
      // upload everything now, while the photograph still covers the canvas,
      // so the first visible frames do not hitch on shader compiles
      size(); place();
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
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
        new THREE.GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(MODEL, built, function (e) {
          if (loadPct && e.total) loadPct.textContent = Math.round(e.loaded / e.total * 100) + "%";
        }, giveUp);
      } catch (e) {
        giveUp();
      }
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
