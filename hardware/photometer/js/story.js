// Photometer — "It never opens the loop".
//
// A function story, not a teardown: one beam becomes two, one path crosses the
// culture, and the difference between them is the measurement. See
// ../STORYBOARD.md for the act list and the honesty ledger.
//
// Everything drawn is a pure function of p in [0,1]. The only clock-driven
// things are dust, flow and the LED's flicker, none of which carry state.
(function () {
  "use strict";

  const canvas = document.getElementById("gl");
  const stage = document.querySelector(".story-stage");
  const track = document.querySelector(".story");
  const hud = document.getElementById("hud");

  const MODELS = "models/";

  /* ------------------------------------------------------------------ parts */
  // Materials are the ones measured for the instrument page: the black printed
  // body, the blue GY-302 boards, the amber LED. Reusing them means a frame
  // from this story and a frame from the wiki show the same object.
  const PARTS = [
    { file: "part1.stl", mat: "printed", tag: "ledmount" },   // the LED holder print: never ghosted
    { file: "part2.stl", mat: "printed", tag: "mast" },
    { file: "part3.stl", mat: "printed", tag: "head" },     // the cuvette holder: seated and opaque throughout
    { file: "part5.stl", mat: "printed", tag: "rail" },
    { file: "part6.stl", mat: "printed", tag: "base" },
    { file: "part7.stl", mat: "printed", tag: "shell" },
    { file: "part8.stl", mat: "printed", tag: "shell" },
    { file: "part9.stl", mat: "printed", tag: "shell" },
    { file: "led-holder.stl", mat: "black", tag: "collar" },
    { file: "led-bulb-body.stl", mat: "amber", tag: "led", key: "bulb" },
    { file: "lens.stl", mat: "glass", tag: "optic", key: "lens" },
    { file: "beamsplitter.stl", mat: "glass", tag: "optic", key: "splitter" },
    { file: "cuvette.stl", mat: "glass", tag: "optic", key: "cuvette" },
    { file: "sensor-sample-pcb.stl", mat: "pcb", tag: "sensor" },
    { file: "sensor-sample-grey.stl", mat: "chipGrey", tag: "sensor" },
    { file: "sensor-sample-black.stl", mat: "chipBlack", tag: "sensor", key: "sampleChip" },
    { file: "sensor-reference-pcb.stl", mat: "pcb", tag: "sensor" },
    { file: "sensor-reference-grey.stl", mat: "chipGrey", tag: "sensor" },
    { file: "sensor-reference-black.stl", mat: "chipBlack", tag: "sensor", key: "refChip" },
  ];

  const srgb = RQ.srgb;
  // The cell, the lens and the splitter. Alpha is SHAPED by the shader below —
  // this is only the overall multiplier the macro act dials down.
  const GLASS_ALPHA = 1.0;

  // What sells glass on a dark stage is not transmission (r128 answers that
  // with a full re-render of the opaque scene every frame — measured at 50 ms
  // frames before it was taken out) but Fresnel: a face seen square-on is
  // nearly invisible, and the same surface at a grazing angle is a bright rim.
  // A flat opacity cannot do that — at 0.26 every fragment was the same milky
  // 26%, which is frosted acrylic, not glass. So the physical material keeps
  // its lighting, its clearcoat highlight and its environment reflection, and
  // one line of its fragment shader is replaced: alpha becomes a function of
  // the angle between the surface and the eye.
  // And the body is BLACK. Glass has no diffuse albedo — nothing inside it
  // scatters light back — so everything you see of it is reflection at the
  // surface plus whatever the rim picks up. The first cut of this shader kept a
  // near-white body, and every face at a half-grazing angle lit up like frosted
  // acrylic no matter how the Fresnel was tuned; measured across four settings
  // of face/rim/power, the lens did not change. With the albedo gone the face
  // is genuinely clear, the key leaves one sharp highlight, and the rim carries
  // the colour.
  const GLASS_TUNE = { face: 0.05, rim: 0.92, pow: 2.8, edge: 0.75 };
  function glassMat() {
    const m = new THREE.MeshPhysicalMaterial({
      color: srgb(0x000000), metalness: 0, roughness: 0.05,
      transparent: true, opacity: GLASS_ALPHA, envMapIntensity: 1.9,
      clearcoat: 1, clearcoatRoughness: 0.03,
      side: THREE.DoubleSide, depthWrite: false,
    });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uGlassFace = { value: GLASS_TUNE.face };
      sh.uniforms.uGlassRim = { value: GLASS_TUNE.rim };
      sh.uniforms.uGlassPow = { value: GLASS_TUNE.pow };
      sh.uniforms.uGlassEdge = { value: GLASS_TUNE.edge };
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>",
          "#include <common>\nuniform float uGlassFace, uGlassRim, uGlassPow, uGlassEdge;")
        .replace("#include <alphatest_fragment>",
          "float gNdV = abs(dot(normalize(vNormal), normalize(vViewPosition)));\n" +
          "float gF = pow(1.0 - gNdV, uGlassPow);\n" +
          "diffuseColor.a = opacity * mix(uGlassFace, uGlassRim, gF);\n" +
          // the rim of real glass is where its body colour shows: a little
          // cooler and darker than the face, so the edge reads as thickness
          "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.84, 0.88), gF * uGlassEdge);\n" +
          "#include <alphatest_fragment>");
      m.userData.shader = sh;
    };
    m.customProgramCacheKey = function () { return "glass-fresnel"; };
    return m;
  }

  function MAT(name) {
    switch (name) {
      case "black":
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x0f1114), metalness: 0.14, roughness: 0.50,
          envMapIntensity: 0.72, clearcoat: 0.40, clearcoatRoughness: 0.26 });
      case "pcb":
        // A full mirror clearcoat on a flat board is a mirror: measured, the
        // sample board threw the key straight down the lens mid-pan.
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x14306b), metalness: 0.18, roughness: 0.46,
          envMapIntensity: 0.95, clearcoat: 0.45, clearcoatRoughness: 0.26 });
      case "chipGrey":
        // Roughness 0.245 with a full mirror clearcoat made these cans a mirror:
        // measured, the camera passing yaw 0.2 on the way from act 4 to act 5
        // put 5.5% of the frame over white for about 1% of the track — a flash
        // in the middle of a pan. Broadening the lobe kills the flare and still
        // reads as a metal can.
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x9ba1a9), metalness: 0.72, roughness: 0.40,
          envMapIntensity: 1.05, clearcoat: 1, clearcoatRoughness: 0.22 });
      case "chipBlack":
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x141619), metalness: 0.25, roughness: 0.48,
          envMapIntensity: 0.84, clearcoat: 0.50, clearcoatRoughness: 0.24 });
      case "glass":
        return glassMat();
      case "clear":
        return new THREE.MeshPhysicalMaterial({ color: srgb(0xe8f0f9), metalness: 0, roughness: 0.07,
          transparent: true, opacity: 0.30, envMapIntensity: 0.9,
          clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide });
      case "amber":
        return new THREE.MeshPhysicalMaterial({ color: srgb(0xff7a14), metalness: 0, roughness: 0.10,
          transparent: true, opacity: 0.40, envMapIntensity: 0.9,
          emissive: srgb(0xff5f00), emissiveIntensity: 0.42,
          clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
      default:
        // The printed body. A 0.2 mm FDM surface scatters a highlight; the first
        // cut had it near lacquered, which is where the white sheen on every flat
        // face came from.
        // 0x090b0e at env 0.16, not 0x101317 at 0.38. Measured with a clean
        // silhouette of the printed parts — the earlier masks were contaminated
        // by the backdrop and by the metal in front, which is why several
        // rounds of "darker" moved nothing — 68.5% of the body was rendering
        // between luma 40 and 120, which is grey, not a black print. The albedo
        // and the environment response are both the material's own claim about
        // what it is; the light was not the thing that was wrong.
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x090b0e), metalness: 0.06, roughness: 0.54,
          envMapIntensity: 0.16, clearcoat: 0.30, clearcoatRoughness: 0.38 });
    }
  }

  /* --------------------------------------------------------------- renderer */
  const renderer = LOOK.renderer(canvas);
  const composer = LOOK.Composer(renderer, {
    threshold: 1.18, knee: 0.45, strength: 0.52, exposure: 1.04, vignette: 0.40, grain: 0.011,
  });
  const scene = new THREE.Scene();
  scene.environment = LOOK.env(renderer, { top: "#5d6975", floor: "#12151a" });

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 8000);

  // The body is near-black printed plastic. Per the render-pipeline notes the
  // environment cannot light that — it only lifts the shadow side into grey —
  // so the key does the work and the rims draw the edges.
  // 1.5, not 1.95. With the print reading as the black it is, the old key was
  // lighting it back to grey from the camera side.
  const key = new THREE.DirectionalLight(0xfff3e4, 1.5); key.position.set(150, 210, 240);
  const rimCool = new THREE.DirectionalLight(0xbfd4ef, 0.85); rimCool.position.set(-220, 90, -160);
  // The warm rim is what puts the orange highlight down the mast. The shine
  // pass took the printed finish near-matte and the highlight went with it;
  // the rim carries it instead of the key, so the flat faces stay calm.
  const rimWarm = new THREE.DirectionalLight(0xffd7a8, 0.62); rimWarm.position.set(190, -120, -180);
  const fill = new THREE.DirectionalLight(0x9fb2c8, 0.30); fill.position.set(-90, -180, 220);
  // A kicker that exists for the opening and nothing else. The body is a
  // near-black print, so under the key alone the instrument is a silhouette:
  // measured against DiOPAL's opening frame, the subject region came out at
  // mean luma 27 with a standard deviation of 24, against 56 and 61 — half the
  // brightness and less than half the form. This rakes the mast's long left
  // edge and the head's shoulder from behind, which is the one thing that
  // draws a dark object out of a dark field, and it is gone by act 1 so the
  // acts that were lit for the optics are untouched.
  const hero = new THREE.DirectionalLight(0xd6e6ff, 0); hero.position.set(-250, 175, -130);
  scene.add(key, rimCool, rimWarm, fill, hero, key.target, hero.target);
  RQ.enableShadows(renderer, key, 260);

  const rig = new THREE.Group();          // holds the model in CAD coordinates
  const world = new THREE.Group();        // the rig, rolled onto its stand
  world.add(rig); scene.add(world);
  const STAND = -Math.atan2(0.131, 0.991);   // the wedge base's roll, from the CAD
  world.rotation.z = STAND;

  /* ------------------------------------------------------------------ load */
  const loader = new THREE.STLLoader();
  const byKey = {}, byTag = {};
  const allMats = [];
  let loaded = 0;

  const ui = {
    loader: document.getElementById("loader"),
    pct: document.getElementById("load-pct"),
  };

  PARTS.forEach(function (spec) {
    loader.load(MODELS + spec.file, function (geo) {
      RQ.dropDegenerate(geo);
      // 22 degrees, not 36. These prints have 30-degree chamfers, and at 36 the
      // smoothing ran straight across them: the optical head's front wall came
      // out as a smeared blotch with no edges instead of a flat panel with a
      // crease. Measured against 36, 22 and 14: 22 keeps the chamfers crisp and
      // still smooths the bores.
      // The surfaces are put back onto the plane or the cylinder they are meant
      // to be on before anything is shaded — see trueSurfaces. Without it no
      // smoothing angle is right: low leaves facets, high turns the same defect
      // into a crumpled sheet.
      RQ.relaxSurfaces(geo);
      // 42, not 22. Measured the dihedral angle across every shared edge of the
      // optical head (part3): 2509 of its 5844 edges fall between 5 and 45
      // degrees, which is curvature — coarsely tessellated fillets and bosses —
      // and at 22 about 900 of those were left as hard creases, which is the
      // faceting on the rounded corner and the cylindrical boss. The real
      // creases are elsewhere: the histogram has a clear valley between 50 and
      // 80 degrees (200 edges across 30 degrees) and then 570 edges at 80-90.
      // 42 takes the curvature and leaves every true corner sharp.
      //
      // 36 was tried once before and smeared the head's front wall, which is
      // why this had been sitting at 22. That was the old averaging: vertex
      // normals are area-weighted now and clamped so one cannot end up further
      // from its own face than the smoothing angle, and the flat faces hold.
      RQ.smoothNormals(geo, 42);
      geo.computeBoundingBox();
      const mat = MAT(spec.mat);
      // The two flat plates lie face up under the key and their whole top
      // surface sits in its specular lobe: at the opening framing that clipped
      // to two hard white wedges on the plate. A printed plate is the roughest
      // thing in the assembly anyway — it is the part with the visible layer
      // lines — so it gets its own finish rather than the body's.
      if (spec.tag === "rail" || spec.tag === "base") {
        mat.roughness = 0.76; mat.clearcoat = 0.05; mat.clearcoatRoughness = 0.75;
        mat.envMapIntensity = 0.30;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = spec.mat === "glass" || spec.mat === "clear" || spec.mat === "amber" ? 20 : 0;
      mesh.castShadow = mesh.receiveShadow = !(spec.mat === "glass" || spec.mat === "clear");
      mesh.userData.spec = spec;
      mesh.userData.env0 = mat.envMapIntensity;
      mesh.userData.col0 = mat.color.clone();
      mesh.userData.cc0 = mat.clearcoat || 0;
      mesh.userData.rough0 = mat.roughness;
      mesh.userData.home = mesh.position.clone();
      rig.add(mesh);
      if (spec.key) byKey[spec.key] = mesh;
      (byTag[spec.tag] = byTag[spec.tag] || []).push(mesh);
      allMats.push({ m: mat, opacity0: 1, env0: mat.envMapIntensity, transparent0: !!mat.transparent });
      loaded++;
      if (story) story.progress(loaded / PARTS.length);
      if (loaded === PARTS.length) assemble();
    }, undefined, function (e) { console.error("STL failed", spec.file, e); });
  });

  /* ----------------------------------------------------- anchors and extras */
  // Covers come OFF rather than turning to glass: a light-tight shell that
  // fades is a rendering trick, a shell lying beside the instrument is what
  // actually happens on the bench. Each one travels along the axis it would
  // really be drawn off, parks in frame, and goes back on at the end.
  // `fade` is how much of it is allowed to remain once the camera is inside the
  // machine, where a parked part is just clutter in front of the lens.
  // One cover per act, each travelling a little further than the one before:
  //   act 1  the short baffle over the LED, as the instrument turns
  //   act 3  the long baffle, at the focus lens
  //   act 4  the optical-head shell, at the splitter
  const COVERS = [
    // Straight out sideways, no lift, and spaced so no two parked covers ever
    // share the same air: their heights on the mast differ, and the distances
    // are staggered so their shadows do not stack either.
    // A staircase. Every cover leaves along the SAME outward heading — 40 degrees
    // off +x in the x-z plane, straight away from the mast it wraps — and the
    // three stops are evenly spaced along it: 45, 66 and 87 mm out, so 21 mm per
    // step, with the fan +26, 0, -26 so the steps are equal vertically too.
    // An earlier cut gave each cover its own heading, one leaning +z and the
    // next -z, and the parts read as having slid sideways past each other
    // instead of coming off the instrument.
    // Clearance is measured, not eyeballed: each cover's own vertices are
    // sampled and ray crossings counted through the instrument. An axis-aligned
    // box test is useless here — these are shells that wrap the mast, so their
    // boxes overlap it even when the part is well clear. At these stops every
    // cover is outside the instrument with 16 mm of air between any two.
    { file: "part9.stl", when: "early", to: [34, 26, 29], fade: 0.30 },
    { file: "part8.stl", when: "lens", to: [50, 0, 43], fade: 0.10 },
    { file: "part7.stl", when: "head", to: [67, -26, 56], fade: 0.0 },
  ];
  // Neither the LED holder print (part1) nor its bezel is here: the emitter has
  // to sit ON a solid print, not float where one used to be. The optical head
  // is not here either — it is driven by its own ramp so it can start an act
  // opaque and clear a moment later.
  const GHOST_TAGS = ["mast", "rail", "base"];
  const GHOST_COL = RQ.srgb(0x05070b);
  const A = {};                            // anchor points, in rig space
  let beamSrc, beamCone, beamSample, beamRef, coreSrc, ledGlow, motes, air, leaks, glowRun;
  let culture, cells, bubble, scatter, tube, tubeFlow, covers = [];
  let ready = false, story = null;

  // Anchors are kept in RIG-LOCAL space — raw CAD millimetres — because every
  // extra (beams, glow, culture, tube) is a child of the rig and is positioned
  // in those same coordinates. Box3.setFromObject would return world space and
  // then localToWorld would apply the rig transform a second time, which is
  // exactly the bug that put the LED's glow halfway down the mast.
  function centerOf(mesh) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
  }
  function boxOf(mesh) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox.clone();
  }

  function assemble() {
    // centre the whole instrument on the origin so camera moves are about it
    const box = new THREE.Box3().setFromObject(rig);
    const c = box.getCenter(new THREE.Vector3());
    rig.position.sub(c);
    rig.updateMatrixWorld(true);

    A.led = centerOf(byKey.bulb);
    A.lens = byKey.lens ? centerOf(byKey.lens) : A.led.clone();
    A.split = centerOf(byKey.splitter);
    A.cuv = centerOf(byKey.cuvette);
    A.sample = centerOf(byKey.sampleChip);
    A.ref = centerOf(byKey.refChip);
    A.center = c.clone();                       // the assembly centre, in CAD mm
    A.cadOrigin = new THREE.Vector3(0, 0, 0);   // anchors are raw CAD mm already
    A.cuvBox = boxOf(byKey.cuvette);
    // How far back a shot has to sit to hold the whole instrument. Derived from
    // the model rather than typed in, so a re-exported STL cannot silently
    // reframe every act.
    const size = box.getSize(new THREE.Vector3());
    A.height = size.y; A.span = Math.max(size.x, size.z);
    // Bounding-sphere radius of the whole instrument, and of each thing an act
    // has to make legible. Distances are then computed per shot from these, so
    // no act can crop its own subject.
    A.radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    A.deckY = box.min.y;      // the bench the instrument stands on
    function rad(mesh, pad) {
      if (!mesh) return 10;
      const bb = boxOf(mesh), sp = bb.getBoundingSphere(new THREE.Sphere());
      return sp.radius + (pad || 0);
    }
    // These are the radii the acts are framed from. They were set by measuring
    // the subject's box on screen and adjusting until it reads: the first cut
    // framed the LED at 5% of the frame and the sensors at 8%, which is the
    // "I can't tell what I'm looking at" the owner saw.
    A.r = {
      led: 13,        // emitter + bezel, big enough to be recognisably an LED
      lens: 17,       // the focusing lens in its fin
      split: 14,      // the splitter plate with both arms leaving it
      cuvMacro: 15,   // about 30 mm of the flow cell: walls, channel, beam
      bubble: 19,     // a little wider, so the bubble travels across something
      optics: 23,     // the splitter, the cell and both sensor boards
    };

    covers = COVERS.map(function (c) {
      const m = rig.children.filter(function (o) {
        return o.userData.spec && o.userData.spec.file === c.file;
      })[0];
      if (!m) return null;
      const to = new THREE.Vector3().fromArray(c.to);
      return { mesh: m, to: to, via: new THREE.Vector3(to.x, 0, to.z), when: c.when, fade: c.fade };
    }).filter(Boolean);

    buildOptics();
    buildTube();
    buildCulture();
    buildFloor(box);
    // Everything that appears late in the story gets its shader compiled now:
    // a first-visit compile mid-scroll is a visible hitch.
    const late = [cells, bubble, scatter, culture, motes, air].filter(Boolean);
    const was = late.map(function (o) { return o.visible; });
    late.forEach(function (o) { o.visible = true; });
    renderer.compile(scene, camera);
    late.forEach(function (o, i) { o.visible = was[i]; });

    RQ.fitShadow(key, rig);

    ready = true;
    // A compile is not enough: the first frame that actually draws a
    // transmissive material builds the renderer's transmission target, and on
    // this story that landed mid-scroll as a 67 ms hitch. Draw the expensive
    // beats once, behind the loader, before anyone can scroll.
    [0.22, 0.48, 0.60, 0.86].forEach(function (q) { draw(q, 12.5); });
    draw(0, 12.5);
    story.ready();
    resize();
  }

  // The surface it stands on. A near-black matte plane, faded out radially so
  // there is never a horizon line — it exists for the contact shadow and for
  // the amber spill, both of which are what stop the instrument floating.
  const FLOOR_DROP = 53.4;   // mm below the instrument's own lowest corner
  function buildFloor(box) {
    const size = box.getSize(new THREE.Vector3());
    const R = Math.max(size.x, size.z) * 7;
    const cnv = document.createElement("canvas");
    cnv.width = cnv.height = 256;
    const g2 = cnv.getContext("2d");
    const grd = g2.createRadialGradient(128, 128, 10, 128, 128, 126);
    grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.45, "#a0a0a0");
    grd.addColorStop(1, "#000000");
    g2.fillStyle = grd; g2.fillRect(0, 0, 256, 256);
    const alpha = new THREE.CanvasTexture(cnv);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(R, 64),
      new THREE.MeshStandardMaterial({
        color: srgb(0x0a0c11), roughness: 0.52, metalness: 0.05,
        alphaMap: alpha, transparent: true, envMapIntensity: 0.55,
        // The bench gets a grid. Every act before this stood the instrument on
        // an unmarked black disc, and with no marking on it the floor gave the
        // eye nothing to measure the instrument against -- the frames read as
        // empty rather than as a bench in a dark room.
        emissiveMap: LOOK.benchGrid({ cells: 14, sub: 4 }),
        emissive: srgb(0x6b5238),
        emissiveIntensity: 0.34,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    // The bench is placed from the INSTRUMENT's own box, not from the whole
    // world group. It used to be the world box, which quietly included the
    // tubing — so the far end of a silicone line set the height of the floor,
    // and re-routing a tube changed the exposure of every wide shot. The drop
    // is the offset that height had settled at, kept so the look does not move.
    world.updateMatrixWorld(true);
    const wb = box.clone().applyMatrix4(rig.matrixWorld);
    floor.position.set(0, wb.min.y - FLOOR_DROP, 0);
    scene.add(floor);
    A.floorY = floor.position.y;
  }

  // A beam from a to b. LOOK.aim parks it at the source end pointing down the
  // run; LOOK.face turns it edge-on to the camera every frame.
  function shaft(a, b, opt) {
    const len = a.distanceTo(b);
    const m = LOOK.beam(Object.assign({ length: len }, opt || {}));
    LOOK.aim(m, a, b);
    return m;
  }

  function buildOptics() {
    // LED -> splitter, then the two arms. Radii taper the way the real path
    // does: wide out of the bezel, tightened by the lens, then split.
    // What leaves a 5 mm LED is a cone, and it is wider than the cuvette below:
    // the lens is what turns it into a column. Drawn as two beams so the change
    // happens at the lens, which is the point of that act.
    // The opening's glow: no edge, no core, just a warm haze along the run the
    // light will take. It is on before the beam exists and fades as the cone
    // takes over, so the axis is hinted at rather than drawn.
    glowRun = shaft(A.led, A.split, { color: "#ff9c42", radius: 15, intensity: 0, edge: 3.6, core: 0, taper: 0.75 });
    rig.add(glowRun);

    // the emitter end is a fifth of the lens end: an unmistakable cone
    // Wider than the lens it lands on, by instruction: the point of this act is
    // that the emitter throws MORE cone than the optics can use.
    beamCone = shaft(A.led, A.lens, { color: "#ffa64a", radius: 13.5, intensity: 0, edge: 1.35, core: 0.45, taper: 0.12 });
    rig.add(beamCone);
    beamSrc = shaft(A.lens, A.split, { color: "#ffb257", radius: 5.4, intensity: 0.62, edge: 1.6, core: 0.9, taper: 0.94 });
    beamSample = shaft(A.split, A.sample, { color: "#ffc489", radius: 5.4, intensity: 0.62, edge: 1.6, core: 0.95, taper: 0.85 });
    beamRef = shaft(A.split, A.ref, { color: "#ffd0a0", radius: 3.4, intensity: 0.78, edge: 1.5, core: 1.05, taper: 0.9 });
    rig.add(beamSrc, beamSample, beamRef);
    coreSrc = null;

    // The emitter itself: a small sphere that is brighter than anything else in
    // the frame, so the bloom pass has a real source to spread.
    // Small and hot, not big and bright: the bloom pass is what makes a 3 mm
    // emitter read as a lamp, so the geometry stays the size of the real die.
    ledGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 18, 12),
      new THREE.MeshBasicMaterial({ color: srgb(0xffa04a), transparent: true, opacity: 1, toneMapped: false })
    );
    ledGlow.position.copy(A.led);
    ledGlow.renderOrder = 30;
    rig.add(ledGlow);

    // Light leaks. Where two printed parts meet, a little of the beam escapes —
    // a bright hairline at the seam and two slits where the LED's legs pass
    // through. Measured seams: the bezel meets the short baffle at y -18.2, the
    // baffle meets the lens fin at y -54.9.
    leaks = new THREE.Group();
    function leak(w, h, d, x, y, z, hue, i) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color: srgb(hue || 0xffb763), transparent: true,
          opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      m.position.set(x, y, z);
      m.userData.gain = i === undefined ? 1 : i;
      leaks.add(m);
      return m;
    }
    // Hairlines, not fins: sitting in the surface. `seam` marks the ones that
    // only exist while their cover is still on.
    // A printed joint does not leak evenly along its length — the gap opens and
    // closes with the layer lines, and the escaping light is a run of bright
    // and dim patches, not a machined slot. Each seam is therefore a handful of
    // short segments at different gains. Same additive strip and same bloom as
    // everywhere else in the scene; only the shape of the gap changes.
    function seam(name, y, hue, gain, segs) {
      segs.forEach(function (g) {
        leak(g[1], g[2], 0.25, g[0], y, 9.35, hue, gain * g[3]).userData.seam = name;
      });
    }
    //     centre   length  height  gain
    seam("early", -18.25, 0xffb763, 1.00, [
      [-7.2, 3.4, 0.34, 1.00], [-3.0, 2.0, 0.22, 0.42], [0.6, 4.6, 0.36, 0.86],
      [4.9, 1.6, 0.20, 0.30], [7.3, 2.8, 0.30, 0.66],
    ]);
    // No seam at the lens fin. There is no cover there for light to escape
    // past once the baffle is off, and a run of bright dashes hanging in the
    // air beside the fin read as a sticker rather than as light.
    leak(0.5, 3.4, 0.5, -1.95, -6.4, 2.6, 0xffd9a0, 0.70);
    leak(0.5, 3.4, 0.5, 1.95, -6.4, 2.6, 0xffd9a0, 0.70);
    leak(4.4, 0.24, 0.5, 0, -11.1, 3.2, 0xffcf8c, 0.55);
    rig.add(leaks);

    motes = LOOK.motes(300, { x: 46, y: 190, z: 46 }, { color: "#ffd9ab", size: 2.0, opacity: 0.32, drift: 5 });
    motes.position.copy(A.led.clone().lerp(A.sample, 0.5));
    rig.add(motes);

    // Air around the whole instrument. The beam motes above only ramp in at
    // act 1, so the opening had nothing in it at all — a dark object on a dark
    // field with no particulate to give the space depth, which is a good part
    // of why it read flatter than DiOPAL's. This field is wide, sparse and
    // cool rather than amber, so it never reads as the beam's own dust: it is
    // the room, not the light path. Strongest while the title holds, then down
    // to a trace for the rest of the story.
    air = LOOK.motes(200, { x: 330, y: 430, z: 300 }, { color: "#cfe0f5", size: 2.6, opacity: 0.3, drift: 3.4 });
    air.position.copy(A.led.clone().lerp(A.sample, 0.5));
    rig.add(air);
  }

  // Silicone line in and out of the cuvette. The ports are the two ends of the
  // 76 mm cell. Both lines run down to the bench and enter a printed insert —
  // a boss with a hole in it — so the tubing has somewhere to go instead of
  // stopping in mid air; at the opening framing they leave the frame first.
  function buildTube() {
    const b = A.cuvBox;
    const inlet = new THREE.Vector3(b.min.x + 1.5, A.cuv.y, A.cuv.z);
    const outlet = new THREE.Vector3(b.max.x - 1.5, A.cuv.y, A.cuv.z);
    const deck = A.deckY;                       // where the bench is, in CAD mm

    // A hanging line that turns TOWARD the viewer. Two things were wrong with
    // the first cut: every control point sat above the port it came from, so the
    // pair read as an arch, which is the one shape silicone cannot make; and the
    // whole run stayed in the x-y plane, so in every act it crossed the frame as
    // a horizontal pipe. Now each line leaves its port going outward and down,
    // then swings round to run in +z — the camera sits on the +z side in every
    // act, so that is straight out of the screen — and leaves the frame there.
    const inCurve = new THREE.CatmullRomCurve3([
      inlet.clone(),
      inlet.clone().add(new THREE.Vector3(-38, -20, 18)),
      new THREE.Vector3(-70, deck + 16, 66),
      new THREE.Vector3(-80, deck + 4, 140),
      new THREE.Vector3(-86, deck + 1, 212),
    ]);
    const outCurve = new THREE.CatmullRomCurve3([
      outlet.clone(),
      outlet.clone().add(new THREE.Vector3(40, -20, 19)),
      new THREE.Vector3(74, deck + 16, 70),
      new THREE.Vector3(88, deck + 4, 150),
      new THREE.Vector3(94, deck + 1, 226),
    ]);

    // depthWrite false, and the wall draws AFTER the fluid. With the default the
    // wall wrote depth first and the culture inside it was depth-tested away:
    // the line rendered as an empty length of silicone for the whole story.
    // The line is meant to read as culture moving through silicone, and it did
    // not: forced off one at a time, the fluid alone is a warm amber tube with
    // the flow banding visible along it, the wall alone is a pale blue-grey
    // one, and together the wall wins and the line reads as a plain grey cable.
    // Two reasons, both here. DoubleSide with depthWrite off draws the near AND
    // far wall, so a 0.26 alpha lands twice for an effective 0.45; and a 0.5
    // clearcoat at 0.26 roughness puts a hard specular stripe down the length,
    // which is the cable. Front face only, and a soft sheen instead of a
    // stripe — the amber comes through and the silicone still reads as silicone.
    const wall = new THREE.MeshPhysicalMaterial({
      color: srgb(0x6e7883), roughness: 0.52, metalness: 0,
      transparent: true, opacity: 0.20, envMapIntensity: 0.30, side: THREE.FrontSide,
      clearcoat: 0.22, clearcoatRoughness: 0.5, depthWrite: false,
    });
    tube = new THREE.Group();
    [inCurve, outCurve].forEach(function (cv) {
      const m = new THREE.Mesh(new THREE.TubeGeometry(cv, 96, 1.65, 20, false), wall);
      m.renderOrder = 9;
      m.userData.op0 = 0.26;       // the wall is glass; the dimming scales it
      tube.add(m);
    });

    // the inserts: a printed boss with a bore for the line
    const bossMat = LOOK.printed("#14171b", 0.55, { clearcoat: 0.3, env: 0.5 });
    [[-86, 212], [94, 226]].forEach(function (q) {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 9.5, 5.5, 32), bossMat);
      boss.position.set(q[0], deck + 2.4, q[1]);
      boss.castShadow = boss.receiveShadow = true;
      boss.userData.op0 = 1;
      tube.add(boss);
      const bore = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.3, 6.2, 24),
        new THREE.MeshBasicMaterial({ color: srgb(0x05070a) })
      );
      bore.position.set(q[0], deck + 3.0, q[1]);
      bore.userData.op0 = 1;
      tube.add(bore);
    });
    rig.add(tube);

    // what is inside the line. uDir runs the flow toward the cell on the inlet
    // and away from it on the outlet, so the culture reads left to right.
    const fluidMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: srgb(0xcaa96a) },
        uT: { value: 0 }, uFill: { value: 0 }, uDens: { value: 0.25 }, uSpeed: { value: 1.55 }, uAlpha: { value: 1 },
        uDir: { value: 1 },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position,1.); vV = -mv.xyz;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uT, uFill, uDens, uSpeed, uDir, uAlpha;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          if (vUv.x > uFill) discard;
          // 9 radians was 1.4 cycles across the WHOLE line — one slow bright band,
          // not moving culture. 46 puts about seven bands in it, and a second,
          // much slower term keeps them from reading as a barber pole.
          float ph = vUv.x * 46.0 - uDir * uT * uSpeed * 6.0;
          float streak = 0.5 + 0.5 * sin(ph + sin(vUv.y * 6.2831) * 0.35);
          streak = streak * 0.66 + 0.34 * (0.5 + 0.5 * sin(ph * 0.37 + 1.7));
          float fres = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.0);
          vec3 c = uColor * mix(0.62, 1.0, uDens) * (0.50 + 0.50 * streak);
          c += vec3(0.10, 0.09, 0.07) * fres;
          gl_FragColor = vec4(c, 0.86 * uAlpha);
        }`,
      transparent: true, side: THREE.DoubleSide, toneMapped: true, depthWrite: false,
    });
    const fluidIn = fluidMat.clone();
    fluidIn.uniforms.uDir.value = -1;           // toward the cell
    tubeFlow = new THREE.Group();
    [[inCurve, fluidIn], [outCurve, fluidMat]].forEach(function (q) {
      const m = new THREE.Mesh(new THREE.TubeGeometry(q[0], 96, 1.25, 18, false), q[1]);
      m.renderOrder = 8;           // inside the wall, so it is drawn first
      tubeFlow.add(m);
    });
    tubeFlow.userData.mats = [fluidIn, fluidMat];
    rig.add(tubeFlow);
  }

  // The culture inside the cuvette: a thin slab in the light path whose tint
  // and scatter rise with density, plus a sparse drift of cells and one bubble.
  function buildCulture() {
    const b = A.cuvBox, size = b.getSize(new THREE.Vector3());
    // The cell is 76 mm long and 4 mm tall, and the fluid inside it is a thin
    // horizontal layer — the 0.2 mm the page quotes is the depth the light
    // crosses, not the size of the body. Drawn at 0.9 mm so it survives being
    // looked at from 15 mm away; the storyboard's ledger says so.
    const CHAN_H = 0.9;
    // Not a box. A box has six flat normals, so nothing about its shading
    // changes across a face — it reads as a painted plank whatever the
    // material does. The liquid is a rounded-rectangle profile extruded along
    // the cell and smoothed, so the long edges curve: the Fresnel term below
    // has something to work on, a key highlight can streak along the top, and
    // the corners read as a meniscus where the liquid meets the wall.
    const W = size.x * 0.94, D = size.z * 0.62, R = Math.min(CHAN_H, D) * 0.42;
    const prof = new THREE.Shape();
    prof.moveTo(-D / 2 + R, -CHAN_H / 2);
    prof.lineTo(D / 2 - R, -CHAN_H / 2);  prof.absarc(D / 2 - R, -CHAN_H / 2 + R, R, -Math.PI / 2, 0, false);
    prof.lineTo(D / 2, CHAN_H / 2 - R);   prof.absarc(D / 2 - R, CHAN_H / 2 - R, R, 0, Math.PI / 2, false);
    // a meniscus: the free surface climbs the walls and dips in the middle, so
    // the top is a shallow curve, not a plane — which is most of what the eye
    // uses to tell a liquid from a solid bar
    prof.quadraticCurveTo(0, CHAN_H / 2 - CHAN_H * 0.34, -D / 2 + R, CHAN_H / 2);
    prof.absarc(-D / 2 + R, CHAN_H / 2 - R, R, Math.PI / 2, Math.PI, false);
    prof.lineTo(-D / 2, -CHAN_H / 2 + R); prof.absarc(-D / 2 + R, -CHAN_H / 2 + R, R, Math.PI, Math.PI * 1.5, false);
    const slab = new THREE.ExtrudeGeometry(prof, { depth: W, bevelEnabled: false, curveSegments: 6, steps: 1 });
    // the extrusion runs along +z; the cell runs along x
    slab.rotateY(Math.PI / 2); slab.translate(-W / 2, 0, 0);
    RQ.smoothNormals(slab, 70);

    // Culture is a turbid liquid, not a surface: its colour deepens with the
    // path length through it, so it is palest where the eye looks straight
    // through the thin layer and densest at the edges, where the path is long.
    // The same slow drift along the flow as the tubing's streak keeps it from
    // reading as a still — nothing new, the tube's own trick.
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPale: { value: srgb(0xd9cfb4) }, uDeep: { value: srgb(0x8a7443) },
        uDens: { value: 0 }, uAlpha: { value: 1 }, uT: { value: 0 },
        uKey: { value: new THREE.Vector3(150, 210, 240).normalize() },
      },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vN = normalize(normalMatrix * normal); vP = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uPale, uDeep, uKey; uniform float uDens, uAlpha, uT;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          vec3 N = normalize(vN), V = normalize(vV);
          // a slow ripple travelling with the flow tilts the surface a few
          // degrees, so the highlight shimmers instead of sitting still
          N = normalize(N + vec3(0.06 * sin(vP.x * 0.9 - uT * 1.4), 0.0, 0.05 * sin(vP.x * 1.7 + uT * 0.8)));
          float ndv = abs(dot(N, V));
          float thick = pow(1.0 - ndv, 1.6);                 // long path through the liquid
          float drift = 0.5 + 0.5 * sin(vP.x * 0.42 - uT * 0.9) * sin(vP.x * 0.17 + uT * 0.35 + 1.3);
          vec3 c = mix(uPale, uDeep, clamp(0.22 + 0.55 * thick + 0.45 * uDens, 0.0, 1.0));
          c *= 0.90 + 0.14 * drift;
          // one key highlight, sliding along the top as the surface curves away
          vec3 L = normalize((viewMatrix * vec4(uKey, 0.0)).xyz);
          float spec = pow(max(dot(reflect(-V, N), L), 0.0), 60.0);
          c += vec3(1.0, 0.96, 0.88) * spec * 0.55;
          float a = uAlpha * mix(0.26 + 0.42 * uDens, 0.96, thick);
          gl_FragColor = vec4(c, clamp(a + spec * 0.3, 0.0, 1.0));
        }`,
      transparent: true, depthWrite: false, side: THREE.FrontSide, toneMapped: true,
    });
    culture = new THREE.Mesh(slab, mat);
    culture.position.copy(A.cuv);
    culture.renderOrder = 22;
    A.chanH = CHAN_H;
    rig.add(culture);

    // cells: illustrative, and named as such in the storyboard's ledger
    const n = 180;
    const geo = new THREE.SphereGeometry(0.075, 7, 5);
    geo.scale(2.6, 1, 1);   // rods, lying along the flow
    const cm = new THREE.MeshStandardMaterial({
      color: srgb(0xf0e6cf), roughness: 0.5, metalness: 0,
      emissive: srgb(0x7a6440), emissiveIntensity: 0.25, transparent: true, opacity: 0.9,
    });
    cells = new THREE.InstancedMesh(geo, cm, n);
    cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cells.userData.seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      cells.userData.seed[i * 4] = Math.random();
      cells.userData.seed[i * 4 + 1] = Math.random();
      cells.userData.seed[i * 4 + 2] = Math.random();
      cells.userData.seed[i * 4 + 3] = Math.random() * 6.283;
    }
    cells.position.copy(A.cuv);
    cells.renderOrder = 23;
    rig.add(cells);

    bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 20, 14),
      new THREE.MeshPhysicalMaterial({
        color: srgb(0xffffff), roughness: 0.03, metalness: 0, transmission: 0.98,
        ior: 1.05, transparent: true, envMapIntensity: 2.6, side: THREE.DoubleSide,
      })
    );
    bubble.visible = false; bubble.renderOrder = 24;
    bubble.material.depthWrite = false;
    rig.add(bubble);

    // scatter: the glow inside the liquid where the beam crosses it
    scatter = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({
        color: srgb(0xffd39a), transparent: true, opacity: 0, toneMapped: false,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    scatter.scale.set(2.6, A.chanH * 0.55, 2.6);
    scatter.position.copy(A.cuv);
    scatter.renderOrder = 25;
    rig.add(scatter);
  }

  /* -------------------------------------------------------------- overlays */
  const readouts = {
    sample: document.getElementById("ro-sample"),
    ref: document.getElementById("ro-ref"),
    ratio: document.getElementById("ro-ratio"),
  };
  const endLine = document.getElementById("endline");
  const curveCanvas = document.getElementById("curve");
  const cctx = curveCanvas.getContext("2d");

  const _v = new THREE.Vector3();
  // Anchored to the part it belongs to, then clamped into the frame: a readout
  // that projects off the right edge is worse than one that has drifted a
  // little from its sensor.
  function place(el, point, dx, dy, alpha) {
    if (alpha <= 0.002) { el.style.opacity = "0"; el.style.visibility = "hidden"; return; }
    _v.copy(point); rig.localToWorld(_v); _v.project(camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    const bw = el.offsetWidth || 120, bh = el.offsetHeight || 40;
    let x = (_v.x * 0.5 + 0.5) * w + (dx || 0);
    let y = (-_v.y * 0.5 + 0.5) * h + (dy || 0);
    const padL = 24, padR = 24, padT = 20, padB = 24;
    x = Math.max(padL, Math.min(w - bw - padR, x));
    y = Math.max(padT, Math.min(h - bh - padB, y));
    el.style.visibility = "visible";
    el.style.opacity = alpha.toFixed(3);
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
  }

  /* ------------------------------------------------------------------- acts */
  // Eight acts. A focus-lens beat was added between the LED and the splitter —
  // the cone leaving the emitter is wider than the cuvette, and the lens is what
  // makes it a beam — and the culture, the ratio and the bubble are one act now:
  // an opening film does not need the rejection filter.
  const A0 = 0.085,   // title
        A1 = 0.215,   // in the line
        A2 = 0.345,   // one source
        A3 = 0.470,   // the focus lens
        A4 = 0.605,   // two paths
        A5 = 0.775,   // through the culture, and the ratio
        A6 = 0.905;   // the record, then the close

  const CAPS = [
    { win: [A0, A1], n: "01", role: "Sampling", name: "In the line",
      body: "The culture never leaves the loop: it flows through a cuvette <b>0.2&nbsp;mm</b> thick and straight back to the reactor. Every reading is taken through the glass, on culture that is still moving." },
    { win: [A1, A2], n: "02", role: "Amber LED", name: "One source",
      body: "A single amber LED at <b>600&nbsp;nm</b>, the wavelength optical density is defined at, fires down the optical axis. Everything below is what happens to that one beam." },
    { win: [A2, A3], n: "03", role: "Beam conditioning", name: "Gathered into a column",
      body: "The cone leaving the emitter is wider than the cuvette it has to cross. A focusing lens gathers it, and from here down the light is one tight column." },
    { win: [A3, A4], n: "04", role: "Beamsplitter", name: "Two paths",
      body: "A 45° beamsplitter turns one beam into two. One crosses the culture. The other never meets it — it goes straight to a second sensor as a <em>reference</em>." },
    { win: [A4, A5], n: "05", role: "The measurement", name: "The ratio, not the reading",
      body: "The sample beam crosses <b>0.2&nbsp;mm</b> of flowing culture and lands on one sensor; the reference has already gone straight to the other. The instrument records the <em>ratio</em>, so anything that changes the lamp divides out of it." },
    { win: [A5, A6], n: "06", role: "The record", name: "400 hours, unattended",
      body: "<b>2,132</b> points across the run, no samples withdrawn. The dip is a recirculation pump that failed overnight — the instrument caught it because it was still reading when nobody was watching." },
  ];

  /* ------------------------------------------------------------ camera work */
  function smoothp(p, a, b) { const x = (p - a) / (b - a); return x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10); }
  function ramp(p, a, b) { const t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  let curD = 300;   // the current shot's distance, in CAD mm
  // A shot is a target point plus a spherical offset, in the rig's own space.
  function shotAt(out, target, dist, yaw, pitch, offX, offY) {
    const cy = Math.cos(pitch), sy = Math.sin(pitch);
    out.set(target.x + dist * cy * Math.sin(yaw) + (offX || 0),
            target.y + dist * sy + (offY || 0),
            target.z + dist * cy * Math.cos(yaw));
  }

  // Every act names the thing it has to make legible and how much of the frame
  // that thing should fill; the distance follows from the subject's own size.
  function shots() {
    const lensView = A.lens.clone().add(new THREE.Vector3(0, 6, 0));
    const splitView = new THREE.Vector3(-8, -174, 0);
    const ratioView = new THREE.Vector3(-9, -182, 0);
    const ledView = A.led.clone().add(new THREE.Vector3(0, -14, 0));
    return [
      // holdIn 0.22: the camera leaves the title framing as soon as the page is
      // scrolled, which is the same window the first cover comes away in.
      { at: A.center, r: A.radius,   fill: 0.88, yaw: -0.52, pit: 0.15, fov: 30, ox: 40, oy: 16, holdIn: 0.22 },  // 0 hero
      // A small step back, not a retreat: far enough that the two bench inserts
      // come into frame, which is the whole point of this act, and no further.
      { at: A.center.clone().add(new THREE.Vector3(6, -26, 0)), r: 195, fill: 0.86, yaw: -0.70, pit: 0.12, fov: 30, ox: 10, oy: 0 }, // 1 in the line
      { at: ledView,  r: A.r.led,    fill: 0.52, yaw: -0.92, pit: 0.06, fov: 30, ox: 60, oy: -10 }, // 2 one source
      { at: lensView, r: A.r.lens,   fill: 0.60, yaw: -0.88, pit: 0.04, fov: 29, ox: 60, oy: -4 },  // 3 the focus lens
      // The act starts on the LEFT and pans round to the right, and act 5 opens
      // where the pan arrives. What made the first cut unreadable from here was
      // the PITCH, not the side: at 0.38 the camera looked down onto the roof of
      // the optical head, which is a featureless slab, and the split happened
      // underneath it. Near level, the same left-hand angle looks straight into
      // the head's open side — the column down, the arm out to the reference
      // board — and the cuvette holder stays opaque, as instructed.
      // holdIn 0.30: held while the caption lands, then panning for the rest.
      { at: splitView, r: A.r.split, fill: 0.44, yaw: -0.40, pit: 0.12, fov: 28, ox: 140, oy: -26, holdIn: 0.30, pitArc: 0.38 },  // 4 two paths
      { at: ratioView, r: A.r.optics, fill: 0.72, yaw: 0.94, pit: 0.21, fov: 28, ox: -70, oy: -22 },  // 5 the measurement, from the right
      { at: A.center, r: A.radius,   fill: 0.46, yaw: -0.74, pit: 0.17, fov: 30, ox: -300, oy: 20 },// 6 the record
      // The close: low, on a long lens, the instrument tall in the frame with
      // its seams lit and the line sweeping toward the camera — then a slow
      // glide (holdIn 0.25) toward the ninth entry, which is not an act but
      // where the last act's move ends. The first cut was the opening's framing
      // again, a small instrument in a dark room; measured against three
      // alternatives at p 0.97, this one is the only one that reads as an end.
      { at: A.center, r: A.radius,   fill: 0.94, yaw: -0.38, pit: 0.05, fov: 24, ox: 120, oy: -14, holdIn: 0.25 },  // 7 close
      { at: A.center, r: A.radius,   fill: 0.98, yaw: -0.30, pit: 0.02, fov: 23, ox: 140, oy: -22 },  // 8 where the close glides to
    ];
  }

  // Act boundaries. A shot is HELD for most of its act and only travels in the
  // last third of it, which is the difference between a story and a camera that
  // never stops moving: the first cut of this ran a single interpolation across
  // each act, so every caption was read over the next act's framing.
  // A development hook: window.__ph.tune = { 4: {yaw, pit, fill, r} } overrides a
  // shot's framing without an edit-reload cycle. Nothing reads it in normal use.
  const TUNE = {};
  // base × gamma, swept together at the opening and the close, measuring how
  // much of the background is lifted off black: the old broad wash at 0.20
  // lit 55% of it; 0.045 (the original) 18% and invisible. gamma 6 pulls the
  // glow into its bands — the frame between them stays black (31% lifted) —
  // and base 1.2 makes the bands themselves unmistakable.
  // The original drifting bands, at a strength you can see. Swept and shown:
  // 0.045 (the first cut) could not be seen; 0.20 lit more than half the
  // background and took the frame over; pulled into two hard spots with a
  // steep gamma it was ugly; and a halo centred on the instrument rendered as
  // an orange wall behind it. 0.10 with a gentle gamma is the band the
  // opening always had, visible, with the frame around it still black.
  const AURORA = { base: 0.10, dip: 0.25, gamma: 1.25 };   // tunable from the frame rig
  // 1.8 / 0.26. The body is a near-black print and it has to read as one: at
  // 4.4 the raking side came out as lit grey plastic, which is brighter but is
  // not what the instrument is. Swept against the subject region's mean and
  // spread — off 27/24, 1.4 gives 33/27, 1.8 gives 36/27, 2.6 gives 40/29, 4.4
  // gives 45/34. This keeps the edge separation that the flat original was
  // missing without lifting the body off black. Frame-over-white moves only
  // 1.11% to 1.13% here, so nothing is clipping.
  const HERO = { rim: 1.8, key: 0.26 };                    // the opening kicker
  const CUTS = [0, A0, A1, A2, A3, A4, A5, A6, 1];
  // The first cut held each shot for two thirds of its act and then moved in a
  // hurry — a stop-start rhythm that reads as jerky however smooth the frame
  // rate is. Now the move runs across the middle of the act on a quintic ease,
  // which has zero velocity AND zero acceleration at both ends, so the camera
  // arrives and leaves without a visible kick.
  // 10% held on the way in, 16% on the way out, so three quarters of every act
  // is travel. The long moves — the bubble macro retreating to the whole
  // instrument — were covering their distance in a third of an act and reading
  // as a rush even with a smooth curve.
  // The act's own framing is HELD for the first 55% — which is the whole time
  // its caption is legible — and the move to the next act runs across the last
  // 45% on a quintic ease. An earlier cut moved almost continuously: it was
  // smooth, but every caption was read over a frame already halfway to the next
  // act, which is why acts looked like they were pointed at nothing.
  const HOLD_IN = 0.55, HOLD_OUT = 0.0;
  function smoother(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10); }


  // Distance at which a sphere of `r` fills `fill` of the frame's tighter axis.
  // Both axes are checked: a tall instrument in a wide frame is limited by
  // height, the same instrument on a phone by width.
  function fitDist(r, fovDeg, fill) {
    const vfov = fovDeg * Math.PI / 180;
    const aspect = Math.max(0.35, stage.clientWidth / Math.max(1, stage.clientHeight));
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const f = Math.max(0.15, Math.min(0.95, fill));
    return Math.max(r / Math.tan(vfov / 2 * f), r / Math.tan(hfov / 2 * f));
  }

  function camera_(p, clock) {
    const S = shots();
    for (const k in TUNE) { if (S[k]) Object.assign(S[k], TUNE[k]); }
    let i = 0;
    for (; i < CUTS.length - 2; i++) if (p < CUTS[i + 1]) break;
    const a = S[Math.min(i, S.length - 1)], b = S[Math.min(i + 1, S.length - 1)];
    const c0 = CUTS[i], c1 = CUTS[i + 1], span = Math.max(c1 - c0, 1e-4);
    const hin = a.holdIn === undefined ? HOLD_IN : a.holdIn;
    const t = smoother((p - (c0 + span * hin)) / Math.max(1e-4, span * (1 - hin - HOLD_OUT)));

    // act 3 turns around the splitter while it is being explained, so both arms
    // of the split are seen from two sides without a cut
    // sin^2 swings out and back inside the act: it is zero, with zero slope, at
    // both boundaries. As a one-way ramp it left 35 degrees of yaw to unwind at
    // the cut, which was the single largest jump in the whole camera path.
    const u = (p - c0) / span;
    const orbit = 0;   // act 4 pans by travelling to act 5's yaw, not by swinging

    const fovA = a.fov, fovB = b.fov;
    const dA = a.d !== undefined ? a.d : fitDist(a.r, fovA, a.fill);
    const dB = b.d !== undefined ? b.d : fitDist(b.r, fovB, b.fill);
    const at = tmp.copy(a.at).lerp(b.at, t);
    // The move between two acts arcs OUTWARD instead of dollying straight
    // through the instrument: a camera that travels from the LED at the top of
    // the mast to the splitter at the bottom would otherwise spend the middle of
    // the move inside the mast, and those frames came out black.
    // The arc is a bounded bulge proportional to how far the camera actually
    // travels, not a fraction of the distance itself: as a fraction, the far
    // record shot swung the camera most of a metre out and back inside one act.
    const asw = Math.sin(Math.PI * t);
    const bulge = Math.min(130, 0.34 * Math.abs(dB - dA)) * asw * asw;
    // The camera also RISES across the middle of a long move. Measured: the pan
    // from act 4 to act 5 passed a yaw where the sample board and the cell throw
    // the key straight down the lens, and 5.5% of the frame went over white for
    // about 1% of the track. Lifting over the middle steps around it, and like
    // the distance bulge it is sin^2, so it is zero with zero slope at both cuts.
    const lift = (a.pitArc || 0) * asw * asw;
    const d = lerp(dA, dB, t) + bulge, yaw = lerp(a.yaw, b.yaw, t) + orbit,
          pit = lerp(a.pit, b.pit, t) + lift;
    const ox = lerp(a.ox, b.ox, t), oy = lerp(a.oy, b.oy, t);
    shotAt(camPos, at, d, yaw, pit);
    camTgt.copy(at);
    curD = d;

    // a slow breath so a held shot is never dead still
    // Driven by the clock, not by p. On p it was a wobble whose frequency rose
    // with scroll speed, which is exactly what "jerky" feels like.
    camPos.x += Math.sin(clock * 0.21) * d * 0.004;
    camPos.y += Math.cos(clock * 0.17) * d * 0.003;

    // ox/oy are quoted for a 1280-wide landscape frame. On a phone, +150 px is
    // most of the width, so the subject went off the side; and in portrait the
    // room is vertical, not horizontal — the subject rides up and the type sits
    // under it instead.
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const sx = Math.min(1, vw / 1280);
    const portrait = vh > vw * 1.05;
    const oxS = ox * sx * (portrait ? 0.22 : 1);
    const oyS = oy * sx + (portrait ? -vh * 0.13 : 0);

    // A real lens has a minimum focus distance; here it also stops the camera
    // drawing the inside of whatever it is passing through on its way between
    // acts, which was turning the travel frames black.
    camera.near = Math.max(0.6, Math.min(26, d * 0.10));
    camera.fov = lerp(a.fov, b.fov, t) * (portrait ? 1.12 : 1);
    camera.setViewOffset(vw, vh, -oxS, -oyS, vw, vh);

    world.updateMatrixWorld(true);
    const wp = camPos.clone(); rig.localToWorld(wp);
    const wt = camTgt.clone(); rig.localToWorld(wt);
    camera.position.copy(wp);
    camera.lookAt(wt);
    camera.updateProjectionMatrix();
    // Anything placed from a projection this frame (labels, readouts) needs
    // THIS frame's view matrix. The renderer updates it at render time, which
    // is after they are placed: without this they trailed the camera by one
    // frame — a wobble while moving, and flatly wrong on the first frame of
    // any jump.
    camera.updateMatrixWorld(true);
  }

  /* -------------------------------------------------------------- the curve */
  // The traced record already on the wiki: 336 h, 2,132 points, thinned here.
  let SERIES = null;
  function series() {
    // Only a NON-EMPTY result is cached. `if (SERIES) return SERIES` cached the
    // empty array too, so a single call made before od600-run.js had defined
    // OD_RUN poisoned it for the life of the page and the record act drew
    // nothing — intermittently, because whether that call lands first is a
    // load race. Measured over six loads: one came up with 0 ink and the other
    // five with 112,117, on a page where OD_RUN was present and complete in
    // all six.
    if (SERIES && SERIES.length) return SERIES;
    if (typeof OD_RUN === "undefined" || !OD_RUN.series) return [];
    // Each row is [hour, median, rawMin, rawMax]. The band was being dropped
    // on the way in and the act drew a bare line; the wiki's own figure shows
    // the scatter with the median through it, so the story shows it too.
    const s = OD_RUN.series, out = [];
    const step = Math.max(1, Math.floor(s.length / 420));
    for (let i = 0; i < s.length; i += step) out.push([s[i][0], s[i][1], s[i][2], s[i][3]]);
    SERIES = out; return out;
  }

  function drawCurve(p, alpha, furn) {
    const w = curveCanvas.clientWidth, h = curveCanvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (curveCanvas.width !== w * dpr || curveCanvas.height !== h * dpr) {
      curveCanvas.width = w * dpr; curveCanvas.height = h * dpr;
    }
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.clearRect(0, 0, w, h);
    if (alpha <= 0.004) { curveCanvas.style.opacity = "0"; return; }
    curveCanvas.style.opacity = alpha.toFixed(3);

    const S = series();
    if (!S.length) return;
    const narrow = w < 760;
    const L = Math.round(w * (narrow ? 0.14 : 0.40)), R = Math.round(w * (narrow ? 0.92 : 0.93));
    const T = Math.round(h * (narrow ? 0.14 : 0.26)), B = Math.round(h * (narrow ? 0.42 : 0.70));
    const tMax = S[S.length - 1][0], odMax = 1.62;
    const x = function (t) { return L + (R - L) * (t / tMax); };
    const y = function (od) { return B - (B - T) * (od / odMax); };
    const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

    const grow = ramp(p, A5 + 0.012, A6 - 0.030);
    const upto = Math.max(2, Math.floor(S.length * grow));
    const head = S[upto - 1], hx = x(head[0]), hy = y(head[1]);

    /* --- the grid, so the record has a scale instead of floating ---------- */
    // Drawn whole from the start and very faint: it is the paper, and paper is
    // already there before anything is written on it.
    cctx.lineWidth = 1;
    cctx.font = "500 9px " + MONO;
    cctx.globalAlpha = furn;
    [0.5, 1.0, 1.5].forEach(function (od) {
      const gy = Math.round(y(od)) + 0.5;
      cctx.strokeStyle = "rgba(255,255,255,.055)";
      cctx.beginPath(); cctx.moveTo(L, gy); cctx.lineTo(R, gy); cctx.stroke();
      cctx.textAlign = "right"; cctx.fillStyle = "rgba(150,160,174,.55)";
      cctx.fillText(od.toFixed(1), R, gy - 5);
    });
    cctx.strokeStyle = "rgba(255,255,255,.14)";
    cctx.beginPath(); cctx.moveTo(L, B + 0.5); cctx.lineTo(R, B + 0.5); cctx.stroke();
    // hour ticks. 336 is where the trace ends, so that is the last one marked:
    // the act is titled for the run, the axis is labelled for the record.
    cctx.textAlign = "center";
    [0, 100, 200, 300].forEach(function (t) {
      const gx = Math.round(x(t)) + 0.5;
      cctx.strokeStyle = "rgba(255,255,255,.14)";
      cctx.beginPath(); cctx.moveTo(gx, B + 1); cctx.lineTo(gx, B + 5); cctx.stroke();
      cctx.fillStyle = "rgba(150,160,174,.55)";
      cctx.fillText(t === 0 ? "0 H" : String(t), gx, B + 16);
    });
    cctx.textAlign = "left";
    cctx.fillStyle = "rgba(150,160,174,.7)";
    cctx.fillText("OD600", L, T - 8);
    cctx.globalAlpha = 1;

    /* --- the raw scatter, then the median through it ---------------------- */
    cctx.beginPath();
    for (let i = 0; i < upto; i++) cctx.lineTo(x(S[i][0]), y(S[i][3]));
    for (let i = upto - 1; i >= 0; i--) cctx.lineTo(x(S[i][0]), y(S[i][2]));
    cctx.closePath();
    cctx.fillStyle = "rgba(255,170,80,.20)";
    cctx.fill();

    // area under the median, so the curve has weight against the dark
    cctx.beginPath();
    cctx.moveTo(L, B);
    for (let i = 0; i < upto; i++) cctx.lineTo(x(S[i][0]), y(S[i][1]));
    cctx.lineTo(hx, B); cctx.closePath();
    const gf = cctx.createLinearGradient(0, T, 0, B);
    gf.addColorStop(0, "rgba(255,150,54,.20)"); gf.addColorStop(1, "rgba(255,150,54,0)");
    cctx.fillStyle = gf; cctx.fill();

    // The line goes down twice: a wide soft pass for the halo, a tight bright
    // one over it. Two strokes cost less than shadowBlur over 400 points and
    // the glow matches the beam the rest of the story is lit by.
    cctx.lineJoin = "round"; cctx.lineCap = "round";
    const trace = function () {
      cctx.beginPath();
      for (let i = 0; i < upto; i++) {
        const px = x(S[i][0]), py = y(S[i][1]);
        if (i === 0) cctx.moveTo(px, py); else cctx.lineTo(px, py);
      }
      cctx.stroke();
    };
    cctx.strokeStyle = "rgba(255,150,54,.22)"; cctx.lineWidth = 6; trace();
    const g = cctx.createLinearGradient(L, 0, R, 0);
    g.addColorStop(0, "rgba(255,170,80,.62)"); g.addColorStop(1, "rgba(255,205,145,1)");
    cctx.strokeStyle = g; cctx.lineWidth = 1.9; trace();

    /* --- the writing head ------------------------------------------------- */
    // The record is being made, not replayed: a lit tip, the last stretch of
    // line brighter behind it, and a drop to the axis so the reading has a
    // place on both scales.
    cctx.strokeStyle = "rgba(255,225,190,.95)"; cctx.lineWidth = 2.4;
    cctx.beginPath();
    for (let i = Math.max(0, upto - 10); i < upto; i++) cctx.lineTo(x(S[i][0]), y(S[i][1]));
    cctx.stroke();

    cctx.strokeStyle = "rgba(255,180,110,.30)"; cctx.lineWidth = 1;
    cctx.setLineDash([2, 4]);
    cctx.beginPath(); cctx.moveTo(hx, hy + 4); cctx.lineTo(hx, B); cctx.stroke();
    cctx.setLineDash([]);

    const gh = cctx.createRadialGradient(hx, hy, 0, hx, hy, 13);
    gh.addColorStop(0, "rgba(255,214,160,.55)"); gh.addColorStop(1, "rgba(255,180,110,0)");
    cctx.fillStyle = gh;
    cctx.beginPath(); cctx.arc(hx, hy, 13, 0, 6.2832); cctx.fill();
    cctx.fillStyle = "rgba(255,238,215,1)";
    cctx.beginPath(); cctx.arc(hx, hy, 2.6, 0, 6.2832); cctx.fill();

    // the readout, above the plot and out of the curve's way at every width
    cctx.globalAlpha = furn;
    cctx.textAlign = "right";
    cctx.fillStyle = "rgba(255,214,170,.95)";
    cctx.font = "600 15px " + MONO;
    cctx.fillText(head[1].toFixed(3), R - 34, T - 8);
    cctx.fillStyle = "rgba(150,160,174,.75)";
    cctx.font = "500 9px " + MONO;
    cctx.fillText("OD", R - 6, T - 8);
    cctx.fillText(Math.round(head[0]) + " H ELAPSED", R, T - 24);

    /* --- what the curve does, named where it does it ---------------------- */
    // "Dip" is gone from this list. The caption calls the marked event at hour
    // 280 the dip, and having a phase label of the same name 140 h earlier put
    // two different features under one word on the same screen. These names
    // only describe the shape of the line; nothing here claims a cause.
    const phases = [[2, "Lag"], [52, "Growth"], [142, "Decline"], [196, "Recovery"], [258, "Plateau"]];
    cctx.font = "600 " + (narrow ? 9 : 10) + "px " + MONO;
    cctx.textAlign = "center";
    phases.forEach(function (ph, i) {
      if (head[0] < ph[0]) return;
      const a = Math.min(1, (head[0] - ph[0]) / 18);
      cctx.fillStyle = "rgba(160,172,186," + (a * 0.85).toFixed(3) + ")";
      // Under 760 px the five names are 46 to 56 px apart and DECLINE ran into
      // RECOVERY. Staggering two rows keeps all five rather than dropping the
      // two that name the most interesting part of the curve.
      cctx.fillText(ph[1].toUpperCase(), x(ph[0] + 16), B + 34 + (narrow && (i % 2) ? 13 : 0));
    });

    /* --- the one event the caption explains ------------------------------- */
    if (head[0] > 280) {
      const a = Math.min(1, (head[0] - 280) / 20);
      const ex = Math.round(x(282)) + 0.5;
      cctx.strokeStyle = "rgba(255,90,80," + (0.7 * a).toFixed(3) + ")";
      cctx.setLineDash([3, 3]); cctx.lineWidth = 1;
      cctx.beginPath(); cctx.moveTo(ex, T + 2); cctx.lineTo(ex, B); cctx.stroke();
      cctx.setLineDash([]);
      cctx.fillStyle = "rgba(255,120,105," + a.toFixed(3) + ")";
      cctx.font = "600 10px " + MONO;
      // On a phone the plateau reaches the top of the plot right where this
      // label wants to sit, so there it moves to the empty left shoulder and
      // lets the red rule alone point at the hour.
      if (narrow) { cctx.textAlign = "left"; cctx.fillText("PUMP FAILURE, H 282", L, T + 12); }
      else { cctx.textAlign = "right"; cctx.fillText("PUMP FAILURE, H 282", ex - 7, T + 12); }
    }
    cctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------- the callouts */
  // Every act is about one piece of this instrument, and the only thing naming
  // that piece was the caption in the corner: the reader had to work out which
  // of the things on screen the words were about. Each act now rings its own
  // part and names it on the part itself.
  const CO = window.Callouts
    ? Callouts(stage, { canvas: canvas, accent: "#ffa23d", sans: '"Oxanium Title", system-ui, sans-serif' })
    : null;

  const RIM_HEX = "#ffc073";
  const RIMMED = [];

  function calloutsAt(p) {
    if (!CO) return [];
    const out = [];
    // Each one opens a beat after its act does, so the caption lands first and
    // the label arrives on a frame the reader is already looking at.
    function add(a, b, mesh, label, sub, side) {
      if (!mesh) return;
      // The rim is made once, the first time a part is ever named, and lives on
      // the part from then on. Creating it here keeps the list of things worth
      // highlighting in one place instead of two that can drift apart.
      if (!mesh.userData._rim && LOOK.rimGlow) LOOK.rimGlow(mesh, RIM_HEX);
      const v = Math.max(0, Math.min(1, Math.min((p - a) / 0.028, (b - p) / 0.028)));
      if (mesh.userData._rim && RIMMED.indexOf(mesh) < 0) RIMMED.push(mesh);
      if (v > 0.004) out.push({ mesh: mesh, label: label, sub: sub, a: v, side: side });
    }
    // Rim only, no tag. Each of these acts names its part in the caption
    // already -- "a cuvette 0.2 mm thick", "a single amber LED at
    // 600 nm", "a focusing lens gathers it", "a 45 degree beamsplitter" -- and
    // the tag was repeating those words back three lines away. The rim is the
    // half that was doing work: it says which of the things on screen the
    // sentence is about, without saying anything.
    add(A0 + 0.030, A1 - 0.004, byKey.cuvette, null);
    add(A1 + 0.030, A2 - 0.004, byKey.bulb, null);
    add(A2 + 0.030, A3 - 0.004, byKey.lens, null);
    add(A3 + 0.030, A4 - 0.004, byKey.splitter, null);
    // These two keep their names. The sensors are the one place in this story
    // where a label carries something the picture cannot: two identical blue
    // boards, and which is which is the whole point of the act.
    add(A4 + 0.030, A5 - 0.004, byKey.sampleChip, "Sample sensor");
    add(A4 + 0.030, A5 - 0.004, byKey.refChip, "Reference sensor");
    return out;
  }

  /* -------------------------------------------------------------- the frame */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  const statsEl = document.getElementById("stats");
  const heroFrame = document.querySelector(".hero-frame");
  const titleEl = document.getElementById("title");
  const _p = new THREE.Vector3();

  function draw(p, clock) {
    if (!ready) return;

    // The warm rim is the bench the instrument stands on. It carries the orange
    // highlight down the mast in the opening, and it is turned down once the
    // camera is inside the optical head, where at full strength it washed the
    // head's big flat face to brass.
    rimWarm.intensity = 1.05 - 0.58 * ramp(p, A1 + 0.02, A2);
    // the opening kicker, and a little extra key with it
    const heroLit = 1 - ramp(p, 0.012, A0 + 0.030);
    hero.intensity = HERO.rim * heroLit;
    key.intensity = 1.5 + HERO.key * heroLit;

    // The instrument turns as the first cover comes away — one gesture, not two,
    // and both on the FIRST part of the scroll, in the same window as the
    // camera's move off the title framing. Earlier this sat inside act 1 with
    // the camera holding still, so the pop read as a separate beat after the
    // opening rather than as the thing the opening scroll does.
    const turn = smoothp(p, 0.020, 0.082);
    world.rotation.y = turn * 0.62;

    // The right-hand stats column rides the title's own fade. Same curve as
    // story-core's title(), written once here rather than threading a second
    // element through the shared engine.
    if (heroFrame) {
      const out = A0 - 0.012;
      let a = 1 - Math.max(0, Math.min(1, (p - out * 0.35) / (out * 0.65)));
      heroFrame.style.opacity = (a * a).toFixed(3);
      heroFrame.style.visibility = a < 0.05 ? "hidden" : "visible";
    }
    if (statsEl) {
      const out = A0 - 0.012;
      let a = 1 - Math.max(0, Math.min(1, (p - out * 0.35) / (out * 0.65)));
      a = a * a;
      statsEl.style.opacity = a.toFixed(3);
      statsEl.style.visibility = a < 0.003 ? "hidden" : "visible";
      // Level with the title, measured, not assumed. The stylesheet centres
      // both blocks on the same 37% line, but story-core's title fade writes a
      // pixel translateY over the title's transform each frame — which drops
      // the -50% shift, so the title hangs from that line while the stats sat
      // centred on it, a full block-height apart. The title's rect already
      // includes its fade shift by the time draw() runs, so centring on the
      // rect keeps the two level through the fade as well.
      const tr = titleEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      statsEl.style.top = (tr.top - sr.top + tr.height / 2).toFixed(1) + "px";
      statsEl.style.transform = "translateY(-50%)";
    }

    camera_(p, clock);

    /* --- density of the culture: clear at the start, milky by the record --- */
    const dens = ramp(p, A4 + 0.01, A5 - 0.02) * 0.92 + ramp(p, A5, A6) * 0.08;

    // the covers go back on between the record and the close
    const backOn = smoothp(p, A5 + 0.030, A6 - 0.010);

    /* --- the lamp, and the staged disturbance in act 5 --- */
    // The instrument is already running when the page opens: the seams are lit
    // in the title frame, not after a scroll. There is nothing to 'switch on'
    // in this story — it has been reading a culture for 400 hours.
    const lit = 1;
    // one dip, entirely inside act 5, ~1.4% of the track wide
    const dipC = A4 + (A5 - A4) * 0.62, dipW = 0.017;
    const dip = Math.exp(-Math.pow((p - dipC) / dipW, 2)) * ramp(p, A4 + 0.03, A4 + 0.08);
    const lamp = lit * (1 - 0.38 * dip);

    // The emitter arrives with the scroll rather than being there from the
    // start: it fades up through act 2, sitting on top of its bezel.
    // Across most of act 2, not in the first tenth of it: at 0.07 of track the
    // emitter simply appeared between two frames of a slow scroll.
    const ledIn = ramp(p, A1 - 0.075, A1 + 0.115);
    ledGlow.material.opacity = lamp * ledIn;
    ledGlow.scale.setScalar(0.8 + 0.3 * lamp * ledIn);
    byKey.bulb.material.emissiveIntensity = 0.42 * lamp * 2.3 * ledIn;
    // From zero, not from a floor: a 0.14 base meant the emitter was already
    // a seventh of the way in before the fade started.
    byKey.bulb.material.opacity = 0.50 * ledIn;          // glass, not a lump of resin
    byKey.bulb.visible = ledIn > 0.004;
    byKey.bulb.material.transparent = true;
    // The holder print stays solid now, and the emitter sits down inside its
    // square hole where no camera outside the part can see it. While the LED is
    // the subject it is drawn over the print instead of the print being taken
    // away — which is what "on top of the print, for now" asks for.
    // The flip to drawing-over-the-print happens at the START of the fade, not
    // in the middle of it. Driving it off ledIn crossing 0.5 is what made the
    // emitter appear all at once: it faded up hidden behind the holder print,
    // then jumped in front of it at one scroll position.
    const onTop = (ledIn > 0.004 ? 1 : 0) * (1 - ramp(p, A2 - 0.02, A2 + 0.04));
    byKey.bulb.material.depthTest = onTop < 0.5;
    byKey.bulb.renderOrder = onTop > 0.5 ? 60 : 20;
    ledGlow.material.depthTest = onTop < 0.5;
    ledGlow.renderOrder = onTop > 0.5 ? 61 : 30;

    // The seams glow once the lamp is on. They stay lit for the rest of the
    // story, which is where the reference frame came from.
    if (leaks) {
      // A seam only leaks while the cover that forms it is seated — and the
      // covers go back on for the closing acts, so the seam lights again there.
      const LEAK_OFF = { early: smoothp(p, 0.020, 0.082) * (1 - backOn) };
      leaks.children.forEach(function (m) {
        // A seam only leaks while the cover that forms it is still on; the leg
        // slits are in the emitter holder, which never moves.
        const on = m.userData.seam ? (1 - (LEAK_OFF[m.userData.seam] || 0)) : 1;
        // a little brighter once the covers are back on for the close, where
        // the lit seams are most of what there is to look at
        m.material.opacity = 5.4 * lamp * m.userData.gain * on * (1 + 0.35 * backOn);
        m.visible = m.material.opacity > 0.004;
      });
    }

    /* --- beams --- */
    LOOK.face(beamCone, camera); LOOK.face(beamSrc, camera);
    LOOK.face(beamSample, camera); LOOK.face(beamRef, camera);
    // uGrow, not uTail: the quad's t = 0 is at the SOURCE, so growing uGrow runs
    // the head of the beam away from the LED. Driving uTail instead filled the
    // beam in from the far end, which is why the light appeared to arrive from
    // the bottom of the mast.
    const coneGrow = ramp(p, A1 + 0.020, A1 + 0.085);         // the cone leaves the LED
    const srcGrow = ramp(p, A2 + 0.010, A2 + 0.075);          // the lens gathers it into a column
    // Both arms leave the splitter at the START of act 4, not across the
    // middle of it: the act is HELD from A3 to A3+0.03, and the first cut
    // finished growing them at 0.550 — so the whole time the caption about
    // the split was legible, there was no split on screen to look at.
    const splitGrow = ramp(p, A3 - 0.018, A3 + 0.010);        // both arms leave the splitter
    if (glowRun) {
      LOOK.face(glowRun, camera);
      glowRun.material.uniforms.uIntensity.value =
        0.075 * lamp * (1 - ramp(p, A1 + 0.010, A1 + 0.080));
      glowRun.visible = glowRun.material.uniforms.uIntensity.value > 0.002;
    }

    beamCone.material.uniforms.uGrow.value = coneGrow;
    beamCone.material.uniforms.uTail.value = 0;
    beamCone.material.uniforms.uIntensity.value = 0.78 * lamp * coneGrow;

    beamSrc.material.uniforms.uGrow.value = srcGrow;
    beamSrc.material.uniforms.uTail.value = 0;
    beamSrc.material.uniforms.uIntensity.value = 0.62 * lamp * srcGrow;


    // the sample arm dims as the culture thickens: this is the measurement
    const through = 1 - 0.72 * dens;
    // both arms leave the splitter, so they grow from their own source end too
    beamSample.material.uniforms.uGrow.value = splitGrow;
    beamRef.material.uniforms.uGrow.value = splitGrow;
    beamSample.material.uniforms.uTail.value = 0;
    beamRef.material.uniforms.uTail.value = 0;
    // the split is the subject of act 4, so both arms are given more weight
    // while that act is on screen
    const splitAct = ramp(p, A3 - 0.02, A3 + 0.04) * (1 - ramp(p, A5 - 0.02, A5 + 0.02));
    const armGain = 1 + 0.55 * splitAct;
    beamSample.material.uniforms.uIntensity.value = 0.62 * lamp * splitGrow * through * armGain;
    beamRef.material.uniforms.uIntensity.value = 0.78 * lamp * splitGrow * armGain;

    if (air) {
      air.material.uniforms.uT.value = clock * 0.55;
      // 0.14 outside the opening, not 0.22: the air is there to give the
      // landing depth, and past it the frame should go back to being dark.
      air.material.uniforms.uOpacity.value = 0.30 * (0.14 + 0.86 * heroLit);
    }
    motes.material.uniforms.uT.value = clock;
    motes.material.uniforms.uOpacity.value = 0.26 * lamp * ramp(p, A1, A1 + 0.06)
      * (1 - ramp(p, A5, A6)) * (1 - 0.9 * ramp(p, A4 - 0.03, A4 + 0.02) * (1 - ramp(p, A5, A5 + 0.04)));

    /* --- the chassis becomes a phantom while the light path is the subject ---
       Ghosting only the outer shells was not enough: the beamsplitter sits
       inside the optical head, so acts 3 to 6 were being played inside a solid
       black box. Everything structural drops to a rim, and only the optics,
       the sensors and the LED stay solid. */
    // Structure is no longer ghosted for the whole middle of the story — the
    // covers come off instead. What is left is a mild, distance-driven fade so
    // the mast and the head do not black out the frame when the camera is
    // inside them: at arm's length they are solid, at 90 mm they are a hint.
    // Measured: acts 4 and 5 sit at about 130 mm, and on the old window that
    // was FULL ghosting — the chassis under the head came out a milky grey
    // smear across the bottom of the frame rather than the hint this is
    // meant to be. The covers come off now, so the ghost only has to keep
    // the mast from blacking out the frame when the camera is inside it.
    const near = 1 - ramp(curD, 55, 185);
    const ghost = near * 0.60 * Math.max(ramp(p, A1 - 0.02, A1 + 0.05) - ramp(p, A5 + 0.03, A6 - 0.02), 0);
    // In the macro acts the camera is INSIDE the chassis — measured: part7 sits
    // 5 mm in front of the lens at act 6 — and a ghosted surface that close is a
    // white smear across the frame, not a hint of structure. Below about 40 mm
    // the chassis leaves altogether.
    /* --- the covers come off --- */
    // Act 2 needs the baffle over the LED off; act 3 needs the head shell and
    // the long baffle off. They go back on between the record and the close.
    // Both sets come away DURING the wide shot and the LED shot, before the
    // camera travels down the mast — a cover that is still seated while the
    // camera passes it just fills the frame with the inside of a shell.
    // All three come away on the first scroll, in the same gesture as the turn.
    // Ten thousandths of a track apart, so they cascade rather than move as one
    // rigid object — near enough to read as a single opening.
    const OFF = {
      early: smoothp(p, 0.020, 0.082),
      lens:  smoothp(p, 0.030, 0.092),
      head:  smoothp(p, 0.040, 0.102),
    };
    const back = backOn;                                           // on the way out
    covers.forEach(function (c) {
      const t = OFF[c.when] * (1 - back);
      // A quadratic Bezier through a purely HORIZONTAL waypoint: the cover comes
      // straight out of the stack first and only then rises or drops to where it
      // parks. Sliding along the straight line from home to the park position
      // drove every cover diagonally through the mast on its way. Written out,
      // the Bezier is home + 2(1-t)t*via + t^2*to, which is smooth in t, and t
      // is itself a quintic smoothstep — so there is no kick at either end.
      const b1 = 2 * (1 - t) * t;
      c.mesh.position.copy(c.mesh.userData.home)
        .addScaledVector(c.via, b1)
        .addScaledVector(c.to, t * t);
      // a small tumble as it comes away, so it reads as a part and not a slide
      // rotation is about the rig's origin, not the part's own centre, so a
      // large angle swings the cover right across the frame
      c.mesh.rotation.set(t * 0.03, t * -0.05, t * 0.02);
      // A parked cover in front of the lens is clutter, and a HALF-transparent
      // one is worse than either: at the measurement act all three spanned the
      // whole frame at 14%, 22% and 39% opacity and veiled the entire picture
      // in a brown haze. `fade` used to be the floor they stopped at — the top
      // cover never went below 30% — so they never actually went away. It is
      // now only a bias on WHEN each one goes, and all three reach zero.
      // Measured distances: the wide acts sit at 695-1347 mm and keep their
      // covers; every act inside the instrument is at 95-130 mm and has none.
      const close = 1 - ramp(curD, 150 + 40 * c.fade, 420 + 80 * c.fade);
      const a2 = 1 - t * close;
      c.mesh.material.transparent = a2 < 0.995;
      c.mesh.material.opacity = a2;
      c.mesh.material.depthWrite = a2 > 0.5;
      c.mesh.visible = a2 > 0.02;
    });

    const inside = 1 - ramp(curD, 26, 46);
    GHOST_TAGS.forEach(function (tag) {
      (byTag[tag] || []).forEach(function (m) {
        const g = ghost * (tag === "base" ? 0.55 : 1);
        m.visible = inside < 0.92;
        m.material.transparent = g > 0.01;
        m.material.opacity = (1 - 0.86 * g) * (1 - inside);
        m.material.depthWrite = g < 0.35;
        // A phantom has to go DARK, not pale. Holding the albedo and lifting the
        // environment turned the chassis into big grey translucent slabs — the
        // "bunch of random material" that made these acts unreadable. Now it
        // darkens to near-black and keeps only its specular edge.
        m.material.color.copy(m.userData.col0).lerp(GHOST_COL, 0.85 * g);
        m.material.envMapIntensity = m.userData.env0 * (1 - 0.72 * g);
        // A transparent panel with a full clearcoat still throws a hard
        // highlight, which is the distracting shine on the splitter act: the
        // finish goes with the colour.
        // Never all the way to zero: clearcoat crossing 0 flips a shader define
        // and three.js rebuilds the program, which cost a measured 1.3 s frame
        // the first time each phantom faded in.
        m.material.clearcoat = Math.max(0.02, m.userData.cc0 * (1 - 0.92 * g));
        m.material.roughness = Math.min(1, m.userData.rough0 + 0.30 * g);
      });
    });

    // The optical head stays opaque for the whole story, by instruction: what
    // opens the act is its cover coming off, not the print turning to glass.

    /* --- the cell's wall gets out of the way for the two macro acts --- */
    const macro = ramp(p, A4 - 0.015, A4 + 0.03) * (1 - ramp(p, A5 - 0.02, A5 + 0.02));
    // relative to the glass base opacity, not to 1: this line was quietly
    // making the cell fully opaque for most of the story
    byKey.cuvette.material.opacity = GLASS_ALPHA * (1 - 0.55 * macro);
    byKey.cuvette.material.transparent = true;
    byKey.cuvette.material.depthWrite = macro < 0.4;

    /* --- the culture in the cuvette --- */
    culture.material.uniforms.uDens.value = dens;
    culture.material.uniforms.uAlpha.value = 0.55 + 0.45 * dens;
    culture.material.uniforms.uT.value = clock;
    culture.visible = dens > 0.02;

    const cellShow = ramp(p, A4 - 0.02, A4 + 0.04) * (1 - ramp(p, A5 - 0.01, A5 + 0.05));
    cells.visible = cellShow > 0.01;
    if (cells.visible) {
      const sz = A.cuvBox.getSize(new THREE.Vector3());
      const sd = cells.userData.seed, n = cells.count;
      const shown = Math.max(1, Math.floor(n * (0.25 + 0.75 * dens) * cellShow));
      for (let i = 0; i < n; i++) {
        const s0 = sd[i * 4], s1 = sd[i * 4 + 1], s2 = sd[i * 4 + 2], ph = sd[i * 4 + 3];
        // the culture flows along the cell, so the cells travel in +x
        const run = ((clock * 0.10 + s0) % 1);
        _p.set((run - 0.5) * sz.x * 0.92,
               (s1 - 0.5) * A.chanH * 0.8,
               (s2 - 0.5) * sz.z * 0.55);
        _q.setFromAxisAngle(new THREE.Vector3(0.2, 1, 0.3).normalize(), ph + clock * 0.2 * s0);
        const on = i < shown ? 1 : 0.0001;
        _m.compose(_p, _q, _s.set(on, on, on));
        cells.setMatrixAt(i, _m);
      }
      cells.instanceMatrix.needsUpdate = true;
      cells.material.opacity = 0.9 * cellShow;
    }

    /* --- the line is background once the camera is inside the optics --- */
    const lineDim = ramp(p, A3 + 0.02, A3 + 0.07) * (1 - ramp(p, A5 + 0.02, A6));
    tube.visible = lineDim < 0.985;
    // Scale each mesh's OWN opacity. Writing a flat `1 - 0.9 * lineDim` drove
    // the silicone wall to fully opaque for the whole opening — which is why
    // the line read as a solid white rod with nothing inside it, and why the
    // culture in the tube had never once been visible.
    tube.traverse(function (o) {
      if (!o.isMesh) return;
      const op0 = o.userData.op0 === undefined ? 1 : o.userData.op0;
      o.material.opacity = op0 * (1 - 0.9 * lineDim);
      o.material.transparent = o.material.opacity < 0.995;
    });
    tubeFlow.visible = lineDim < 0.985;

    /* --- flow in the line --- */
    if (tubeFlow) {
      tubeFlow.userData.mats.forEach(function (fm) {
        fm.uniforms.uT.value = clock;
        fm.uniforms.uAlpha.value = 1 - 0.9 * lineDim;
        // Full from the first frame: the loop is running when the page opens,
        // the same reason the lamp is. What moves is the streak, not the fill.
        fm.uniforms.uFill.value = 1;
        fm.uniforms.uDens.value = dens;
      });
    }

    /* --- scatter in the liquid: brighter as the culture thickens --- */
    if (scatter) {
      const near = ramp(p, A4 - 0.02, A4 + 0.03) * (1 - ramp(p, A5 - 0.01, A5 + 0.03));
      scatter.material.opacity = (0.10 + 0.55 * dens) * lamp * near;
      scatter.visible = scatter.material.opacity > 0.004;
    }

    bubble.visible = false;   // the rejection filter is not part of the opening

    const inBeam = 0;

    /* --- readouts --- */
    // Anchored on the dashboard's own numbers at hour 30: sample 195.54 lx,
    // reference 26.67 lx, ratio 7.33x.
    // The readouts belong to act 5 (the ratio) and act 6 (the rejection).
    const roA = ramp(p, A4 + 0.020, A4 + 0.075) * (1 - ramp(p, A5 - 0.025, A5 + 0.010));
    const refLux = 26.67 * lamp / Math.max(lit, 1e-3);
    // a bubble in the path is a clear window: the sample channel jumps
    const sampLux = 195.54 * through * lamp / Math.max(lit, 1e-3) * (1 + 1.05 * inBeam);
    if (roA > 0.002) {
      readouts.sample.querySelector("b").textContent = sampLux.toFixed(2);
      readouts.ref.querySelector("b").textContent = refLux.toFixed(2);
      readouts.ratio.querySelector("b").textContent = (sampLux / Math.max(refLux, 1e-3)).toFixed(2) + "×";
      const ratioA = roA * Math.max(ramp(p, dipC - 0.030, dipC - 0.008), ramp(p, A5, A5 + 0.02));
      readouts.ratio.classList.toggle("hot", dip > 0.25);
      readouts.ratio.classList.toggle("reject", inBeam > 0.35);
      readouts.ratio.querySelector(".k").textContent =
        inBeam > 0.35 ? "Rejected · not logged" : "Sample ÷ reference";
      readouts.sample.classList.toggle("reject", inBeam > 0.35);
      const w = stage.clientWidth, h = stage.clientHeight, narrow = w < 760;
      function park(el, x, y, a2) {
        if (a2 <= 0.002) { el.style.opacity = "0"; el.style.visibility = "hidden"; return; }
        el.style.visibility = "visible";
        el.style.opacity = a2.toFixed(3);
        el.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
      }
      // reference top right, sample under it, the ratio on its own below —
      // projecting all three put them on top of each other at every framing
      park(readouts.ref, w - (narrow ? 140 : 250), narrow ? 26 : 96, roA);
      park(readouts.sample, w - (narrow ? 140 : 250), narrow ? 92 : 168, roA);
      park(readouts.ratio, w - (narrow ? 165 : 292), narrow ? 168 : 262, ratioA);
    } else {
      [readouts.sample, readouts.ref, readouts.ratio].forEach(function (el) {
        el.style.opacity = "0"; el.style.visibility = "hidden";
        el.classList.remove("reject", "hot");
      });
    }

    /* --- the closing line --- */
    if (endLine) {
      const a2 = ramp(p, A6 + 0.020, A6 + 0.055);
      endLine.style.opacity = a2.toFixed(3);
      endLine.style.visibility = a2 < 0.004 ? "hidden" : "visible";
      endLine.style.transform = "translateY(" + ((1 - a2) * 16).toFixed(1) + "px)";
    }

    /* --- the record --- */
    // Two fades, not one. The camera starts back toward the hero at about 0.847
    // while the record is still drawing, and by 0.88 the instrument is standing
    // over the left third of the plot -- the hour ticks were landing on its base
    // plate. The grid, the labels and the readout are gone before it gets there;
    // the trace itself stays a little longer and dims behind the instrument,
    // which is what the act was always meant to hand over to the close.
    drawCurve(p,
      ramp(p, A5 + 0.005, A5 + 0.045) * (1 - 0.92 * ramp(p, A6 - 0.030, A6 + 0.020)),
      1 - ramp(p, A6 - 0.053, A6 - 0.023));

    // Orange aurora behind the opening. It fades out as the story goes inside
    // the instrument, where it would only be noise.
    // 0.045, not 0.30: this is added to linear radiance before tone mapping, so
    // against a near-black stage a tenth of that is already a wash.
    // The orange aurora stays up for the whole story now, by instruction — it
    // used to fade out as the camera went inside the instrument and come back
    // for the close, and at 0.045 it was barely there even in the opening. It
    // is added to linear radiance before tone mapping and masked to the dark
    // parts of the frame, so inside the optical head it only shows at the
    // edges anyway; the small dip there keeps the close-ups from going warm.
    composer.uniforms.uAurora.value = AURORA.base *
      (1 - AURORA.dip * ramp(p, A1 - 0.02, A1 + 0.09) * (1 - ramp(p, A5 + 0.02, A6)));
    composer.uniforms.uAurGamma.value = AURORA.gamma;
    composer.uniforms.uTime.value = clock;
    // The callout list is built before the render because the rim it drives is
    // part of the 3D frame; the 2D tags go on afterwards, over the top.
    const coItems = calloutsAt(p);
    for (let i = 0; i < RIMMED.length; i++) RIMMED[i].userData._rim.uniforms.uAmt.value = 0;
    for (let i = 0; i < coItems.length; i++) {
      const r = coItems[i].mesh.userData._rim;
      if (r) r.uniforms.uAmt.value = 0.78 * coItems[i].a;
    }
    composer.render(scene, camera, p * 137.0);
    // After the render: the camera matrices are settled by now, and the layer
    // is its own 2D canvas over the top, so nothing here touches the 3D pass.
    if (CO) CO.draw(camera, coItems);
  }

  /* ------------------------------------------------------------------ boot */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    // A big frame on a 2x display asks for 4 M pixels before any supersampling,
    // and the acts where the camera is inside the instrument are pure overdraw:
    // transparent chassis, beams and bloom over the whole frame. Large viewports
    // get a lower device ratio; a phone keeps the full one, where it is cheap
    // and where the difference is visible.
    const big = stage.clientWidth * stage.clientHeight > 700000;
    const pr = Math.min(window.devicePixelRatio || 1, big ? 1.3 : 1.75);
    renderer.setSize(w, h, false);
    composer.setSize(w, h, pr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // A handle for the frame rig: toggling a single object off and re-rendering is
  // the quickest way to find out which one is making a highlight.
  window.__ph = {
    parts: function () { return { beamSrc: beamSrc, beamSample: beamSample, beamRef: beamRef,
      motes: motes, air: air, tube: tube, tubeFlow: tubeFlow, culture: culture, cells: cells,
      scatter: scatter, bubble: bubble, ledGlow: ledGlow }; },
    scene: scene, camera: camera, anchors: A, tune: TUNE, aurora: AURORA, hero: HERO,
    composer: composer, renderer: renderer,
    glass: function (t) {
      Object.assign(GLASS_TUNE, t || {});
      ["lens", "splitter", "cuvette"].forEach(function (k) {
        const sh = byKey[k] && byKey[k].material.userData.shader; if (!sh) return;
        sh.uniforms.uGlassFace.value = GLASS_TUNE.face; sh.uniforms.uGlassRim.value = GLASS_TUNE.rim;
        sh.uniforms.uGlassPow.value = GLASS_TUNE.pow; sh.uniforms.uGlassEdge.value = GLASS_TUNE.edge;
        if (t && t.env !== undefined) byKey[k].material.envMapIntensity = t.env;
        if (t && t.rough !== undefined) byKey[k].material.roughness = t.rough;
      });
    },
    // Screen-space box of an object (or of the whole model), in fractions of the
    // frame. Framing is judged from these numbers, not by eye.
    box: function (obj) {
      const o = obj || rig;
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty()) return null;
      const v = new THREE.Vector3();
      let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
        v.project(camera);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      return { l: (x0 + 1) / 2, r: (x1 + 1) / 2, b: (1 - y1) / 2, t: (1 - y0) / 2,
               w: (x1 - x0) / 2, h: (y1 - y0) / 2 };
    },
    rig: rig, keys: byKey, tags: byTag,
  };

  story = Story({
    canvas: canvas, stage: stage, track: track, hud: hud, caps: CAPS, rail: true,
    title: document.getElementById("title"),
    cue: document.getElementById("cue"),
    loader: ui.loader, pct: ui.pct,
    titleOut: A0 - 0.012,
    draw: draw,
  });
  resize();
})();
