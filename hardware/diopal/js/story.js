// DiOPAL — "One question, six answers".
//
// A function story: light is the variable, so everything in the box exists to
// make light a number you can state. See ../STORYBOARD.md for the acts and the
// honesty ledger.
//
// The CAD is Z-up, so every geometry is rolled a quarter turn about X and CAD
// (x, y, z) becomes (x, z, -y). Measured boxes, in CAD millimetres:
//   base plate   x +-105.4  y +-81.8   z -41.3 .. 0
//   perf board   x +-80     y +-50     z 0 .. 1.5
//   housing      x +-105.4  y +-81.8   z -35 .. 66.5
//   LED holder   x +-66.2   y -53.9 .. 55.3   z 46.5 .. 66.5
//   tube holder  x -68 .. 66  y +-54   z 66.5 .. 146.5
(function () {
  "use strict";

  const canvas = document.getElementById("gl");
  const stage = document.querySelector(".story-stage");
  const track = document.querySelector(".story");
  const hud = document.getElementById("hud");
  const MODELS = "models/";

  /* ------------------------------------------------------- measured grid */
  // Straight from the instrument page: six columns, four rows, 18 mm pitch, and
  // the lux each channel measured at 5 V.
  const GRID = { cols: [-45, -27, -9, 9, 27, 45], rows: [27, 9, -9, -27], pitch: 18 };
  const CHANNELS = [
    { x: -45, hue: "green", tier: "Low", nm: 520, lux: 2.33, unit: "klx" },
    { x: -27, hue: "red", tier: "Low", nm: 660, lux: 390, unit: "lx" },
    { x: -9, hue: "green", tier: "Mid", nm: 520, lux: 2.36, unit: "klx" },
    { x: 9, hue: "red", tier: "Mid", nm: 660, lux: 410, unit: "lx" },
    { x: 27, hue: "green", tier: "High", nm: 520, lux: 2.40, unit: "klx" },
    { x: 45, hue: "red", tier: "High", nm: 660, lux: 428, unit: "lx" },
  ];
  // Tier is a PWM duty cycle in the instrument, not a different LED: the six
  // channels are matched to within a few percent at full drive. js/hero.js holds it
  // (the duty-cycle traces, live in both modes, draw it too).
  const HP = window.HERO;
  const DUTY = HP.DUTY;
  // Everything procedural is built in CAD millimetres, where +z is up: the roll
  // to Y-up happens once, on the parent. Placing tubes as if the roll had
  // already happened is what had them leaning in a heap beside the instrument.
  const LED_Z = 63;                      // emitters, domes proud of the holder
  const TUBE_Z = 76;                     // the tube's centre line at the bottom: the glass sits 0.8 mm clear of the dome top (69)
  const HUE = { green: "#3fe07f", red: "#ff2f22" };
  // A culture in a glass tube is a liquid you can see into. 0.66 read as a
  // solid column of cream with a glow painted on it; the material is drawn
  // double-sided, so the near and far walls compound and 0.32 still reads as
  // about half-opaque — enough that the back of the tube shows through it,
  // which is what makes it read as something poured rather than moulded.
  // The emitted term below is raised to match, so the lit tubes in the dose
  // act sit where they did: alpha scales the emissive too.
  const CULTURE_OPACITY = 0.32;

  // The tube rack is BLACK: the final build reprinted it in black PLA with four
  // wall loops after the white cycle-3 holder leaked light between bores
  // (record 5.4, and the owner's settled answer). Every printed part of the
  // final instrument is black or grey.
  const PARTS = [
    { file: "base-plate.stl", mat: "grey", tag: "base", key: "plate" },
    { file: "perf-board.stl", mat: "pcb", tag: "board", key: "board" },
    { file: "housing.stl", mat: "black", tag: "case", key: "housing" },
    { file: "led-holder.stl", mat: "black", tag: "case", key: "holder" },
    { file: "tube-holder.stl", mat: "rack", tag: "rack", key: "rack" },
    { file: "left-c.stl", mat: "grey", tag: "slider" },
    { file: "right-c.stl", mat: "grey", tag: "slider" },
  ];

  const srgb = RQ.srgb;
  // Printed parts: the original satin gloss with about 10% taken off it, at
  // the owner's call ("not matte is better, just add 10% matte"). Roughness
  // is the original x1.1 and clearcoat x0.9; colour, metalness, environment
  // and clearcoat roughness are as they were. A fully matte pass (0.74 rough,
  // 0.06 coat) killed the streaks but read as chalk.
  function MAT(name) {
    switch (name) {
      case "rack":
        // The same black filament as the housing, its own instance: the bore
        // liner clones it and darkens its own copy down the shaft.
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x121418), metalness: 0.12, roughness: 0.506,
          envMapIntensity: 0.8, clearcoat: 0.45, clearcoatRoughness: 0.2 });
      case "grey":
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x2a2e34), metalness: 0.1, roughness: 0.572,
          envMapIntensity: 0.85, clearcoat: 0.36, clearcoatRoughness: 0.3 });
      case "pcb":
        // Satin, not a mirror. Seen low across its face in the drive act the
        // board took the environment at a grazing angle and came out pale mint
        // edge to edge: the lit traces on it had little to stand out from, and
        // it was the brightest thing behind the act's caption (p90 146).
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x123a24), metalness: 0.1, roughness: 0.6,
          envMapIntensity: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.4 });
      default:   // black printed case
        return new THREE.MeshPhysicalMaterial({ color: srgb(0x121418), metalness: 0.12, roughness: 0.506,
          envMapIntensity: 0.8, clearcoat: 0.45, clearcoatRoughness: 0.2 });
    }
  }

  /* --------------------------------------------------------------- renderer */
  const renderer = LOOK.renderer(canvas);
  const composer = LOOK.Composer(renderer, {
    threshold: 1.05, knee: 0.45, strength: 0.62, exposure: 1.02, vignette: 0.38, grain: 0.011,
  });
  const scene = new THREE.Scene();
  scene.environment = LOOK.env(renderer, { top: "#4a5461", floor: "#0e1115" });
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 9000);

  // 1.8. It was 1.55 while the rack was near-white, which needs far less key
  // than black plastic does (the render notes measured 0.90 against the
  // photometer's 2.40 for exactly that reason). With the rack reprinted in
  // black the whole instrument is dark filament. A fully matte pass needed
  // 2.0 to keep any form; with the satin finish back the clearcoat carries
  // part of that, and 2.0 put a hot sheen on the rack top in the overhead.
  const key = new THREE.DirectionalLight(0xfff4e8, 1.8); key.position.set(180, 260, 200);
  const rimCool = new THREE.DirectionalLight(0xbcd2ee, 0.55); rimCool.position.set(-240, 120, -190);
  const rimWarm = new THREE.DirectionalLight(0xffd9ae, 0.26); rimWarm.position.set(210, -80, -200);
  const fill = new THREE.DirectionalLight(0x93a6bc, 0.16); fill.position.set(-80, -160, 240);
  scene.add(key, rimCool, rimWarm, fill, key.target);
  RQ.enableShadows(renderer, key, 320);

  const rig = new THREE.Group();          // model, in CAD millimetres
  const world = new THREE.Group();        // rolled Z-up -> Y-up
  world.add(rig); scene.add(world);
  world.rotation.x = -Math.PI / 2;

  /* ------------------------------------------------------------------ load */
  const loader = new THREE.STLLoader();
  const byKey = {}, byTag = {};
  let loaded = 0, ready = false, story = null;
  const ui = { loader: document.getElementById("loader"), pct: document.getElementById("load-pct") };

  // The rack's raw bore walls are thrown away and rebuilt (see the liner in
  // buildArray). They have to GO, not just be covered: measured round three
  // bores, the wall wanders between 8.28 and 9.42 mm, so wherever it comes in
  // tighter than the liner it stands inside it as a spike — two of those were
  // visible as slivers hanging in the mouths of the opening act. Only the wall
  // between the two faces is removed — right up to them, because a first pass
  // that stopped at 68 left the bottom rim's chamfer behind and it showed as a
  // ring of white shards inside every mouth seen from underneath. The two flat
  // faces (146.5 and 66.5) and everything more than 9.6 mm from a bore axis are
  // untouched, and both faces are re-laid as punched plates anyway.
  // The raised top block is a rectangle and the mesh does not know it. Raycast
  // inward along each edge: the RIGHT edge is dead straight at 55.25 for every
  // sample, and the bottom at -45.23 for the whole middle, but the LEFT edge
  // wanders between -55.5 and -57.3 — it bows in across the middle and bulges
  // out at both corners. That is the curve, and the sawtooth on top of it is
  // the same mesh a quarter of a millimetre at a time.
  //
  // So the outline is snapped to the rectangle the other three edges already
  // describe. Only vertices ON the outline move — within 2.5 mm of it, on the
  // top plane, and clear of every bore rim, which sits 1.9 mm inside the edge
  // at the outer columns and must not be dragged out with it. These vertices
  // are shared with the top of the side wall, so the silhouette straightens
  // with the face; the wall below leans by up to 2 mm, which no act sees.
  const TOP_HX = 55.3, TOP_HY = 45.23, TOP_CR = 4;
  function squareTopOutline(geo) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) < 146.4) continue;
      const x = pos.getX(i), y = pos.getY(i);
      const a = Math.abs(x), b = Math.abs(y);
      const qx = a - (TOP_HX - TOP_CR), qy = b - (TOP_HY - TOP_CR);
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
                + Math.min(Math.max(qx, qy), 0) - TOP_CR;
      if (Math.abs(out) > 2.5) continue;
      let near = false;
      for (let c = 0; c < GRID.cols.length && !near; c++) {
        for (let r = 0; r < GRID.rows.length && !near; r++) {
          if (Math.hypot(x - GRID.cols[c], y - GRID.rows[r]) < 9.5) near = true;
        }
      }
      if (near) continue;
      let px, py;
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy) || 1e-9;
        px = (TOP_HX - TOP_CR) + qx / l * TOP_CR;
        py = (TOP_HY - TOP_CR) + qy / l * TOP_CR;
      } else if (qx > qy) { px = TOP_HX; py = b; }
      else { px = a; py = TOP_HY; }
      pos.setX(i, x < 0 ? -px : px);
      pos.setY(i, y < 0 ? -py : py);
    }
    pos.needsUpdate = true;
    return geo;
  }

  function cullBoreWalls(geo) {
    const pos = geo.attributes.position, n = pos.count, keep = [];
    for (let i = 0; i < n; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      // Everything the plate covers is removed by ALL THREE vertices, not by
      // centroid. A centroid test throws away whole triangles that reach well
      // past the boundary, which left notches outside the plate with nothing
      // behind them — the sawtooth along the block's left edge.
      // The top face under the punched plate goes too. The plate replaces it,
      // and leaving it 0.02 mm below meant two surfaces the shadow map cannot
      // tell apart: at a 2048 map over a 320 mm radius a texel is 0.31 mm and
      // normalBias is 0.6, so 0.02 mm is nothing, and the rack's own face was
      // casting onto the plate. That was the dark band down the left of the
      // grid act. The cull stops 0.5 mm inside the plate's own edge, so what it
      // removes is covered and the block's outline is still the rack's.
      if (cz > 146.4) {
        let all = true;
        for (let k = 0; k < 3 && all; k++) {
          const vx = Math.abs(pos.getX(i + k)), vy = Math.abs(pos.getY(i + k));
          const rx = vx - (TOP_HX - TOP_CR - 0.6), ry = vy - (TOP_HY - TOP_CR - 0.6);
          all = (rx <= 0 || ry <= 0)
            ? (vx <= TOP_HX - 0.6 && vy <= TOP_HY - 0.6)
            : (rx * rx + ry * ry <= TOP_CR * TOP_CR);
        }
        if (all) continue;
      }
      let inBore = false;
      if (cz > 66.55 && cz < 146.45) {
        for (let c = 0; c < GRID.cols.length && !inBore; c++) {
          for (let r = 0; r < GRID.rows.length && !inBore; r++) {
            if (Math.hypot(cx - GRID.cols[c], cy - GRID.rows[r]) < 9.6) inBore = true;
          }
        }
      }
      if (!inBore) keep.push(i);
    }
    if (keep.length * 3 === n) return geo;
    const out = new Float32Array(keep.length * 9);
    let o = 0;
    keep.forEach(function (i) {
      for (let k = 0; k < 3; k++) { out[o++] = pos.getX(i + k); out[o++] = pos.getY(i + k); out[o++] = pos.getZ(i + k); }
    });
    geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
    geo.deleteAttribute("normal");
    return geo;
  }

  PARTS.forEach(function (spec) {
    loader.load(MODELS + spec.file, function (geo) {
      if (spec.file === "tube-holder.stl") { squareTopOutline(geo); cullBoreWalls(geo); }
      RQ.dropDegenerate(geo);
      // The same denoise the photometer gets. DiOPAL's prints carry the same
      // coarse-export noise; its worst walls are already covered by the
      // procedural plates, and the cull that removes the raw bore walls leaves
      // open edges, whose vertices this freezes along with every feature edge.
      RQ.relaxSurfaces(geo);
      // 6 degrees of axis snap: every part here is an axis-aligned print, and
      // without it the flat sides of the LED holder shaded as a field of
      // triangles under the clearcoat.
      RQ.smoothNormals(geo, 24, 6);
      if (spec.file === "housing.stl") {
        // Each of the four outer walls carries a vertical channel cut into it,
        // 10 mm wide and 9 mm deep (front and back run the full height, the
        // sides stop at z 23). It is in the print and it stays in the print --
        // the STL is a download and this is the part the team made.
        //
        // What was wrong was the light in it. A groove that deep can only see a
        // sliver of sky, and nothing here models that: the channel got the full
        // environment, so its far wall took the key head-on and rendered as a
        // bright cream slit that read as a light leak. An earlier pass bent that
        // one wall's normals flat, on the front wall only, which traded the
        // leak for a black crack and left the groove half-shaded, half-not --
        // that asymmetry is what made the part look split.
        //
        // The occlusion the groove is missing is written in per vertex instead,
        // ramped from the mouth to the floor, and multiplied into the shaded
        // colour. Diffuse, specular and environment all come down together, so
        // it holds at any camera angle rather than being tuned against one.
        // Normals are left true and no vertex moves.
        const pos = geo.attributes.position;
        const occ = new Float32Array(pos.count).fill(1);
        const HALF = 5.6;
        // The lip keeps a quarter of its light and the floor an eighth. Tuned
        // against the wall beside it: below these the groove stopped reading as
        // a groove, above them its far wall came back out brighter than the
        // face around it, which is the look that started all this.
        const MOUTHLIT = 0.26, FLOORLIT = 0.12;
        //     cut axis, side, lateral axis, z ceiling
        const CHAN = [[1, -1, 0, 1e4], [1, 1, 0, 1e4], [0, 1, 1, 24], [0, -1, 1, 24]];
        const v = [0, 0, 0], fc = [0, 0, 0];
        function vert(i) { v[0] = pos.getX(i); v[1] = pos.getY(i); v[2] = pos.getZ(i); }
        function face(i) {
          fc[0] = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
          fc[1] = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
          fc[2] = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        }
        const nrm = geo.attributes.normal;
        CHAN.forEach(function (ch) {
          const cut = ch[0], sgn = ch[1], lat = ch[2], zc = ch[3];
          // The channel's own side walls locate it: they are the faces near the
          // wall's mid-line whose normal runs across the wall rather than out of
          // it. Their vertices give the mouth, the floor and the z span, so
          // nothing about the channel is hard-coded from a measurement.
          let mouth = -1e9, floorD = 1e9, z0 = 1e9, z1 = -1e9, found = 0;
          for (let i = 0; i < pos.count; i += 3) {
            face(i);
            if (Math.abs(fc[lat]) > HALF || sgn * fc[cut] < 60 || fc[2] > zc) continue;
            const n = lat === 0 ? nrm.getX(i) : nrm.getY(i);
            if (Math.abs(n) < 0.8) continue;
            found++;
            for (let k = 0; k < 3; k++) {
              vert(i + k);
              const d = sgn * v[cut];
              if (d > mouth) mouth = d;
              if (d < floorD) floorD = d;
              if (v[2] < z0) z0 = v[2];
              if (v[2] > z1) z1 = v[2];
            }
          }
          if (found < 8 || mouth - floorD < 1) return;
          const depth = mouth - floorD;
          for (let i = 0; i < pos.count; i += 3) {
            face(i);
            if (Math.abs(fc[lat]) > HALF + 0.4) continue;
            if (sgn * fc[cut] < floorD - 0.5 || sgn * fc[cut] > mouth + 0.5) continue;
            if (fc[2] < z0 - 0.5 || fc[2] > z1 + 0.5) continue;
            for (let k = 0; k < 3; k++) {
              vert(i + k);
              // 0 at the mouth, 1 on the floor, eased so the lip does not step
              let t = (mouth - sgn * v[cut]) / depth;
              t = Math.max(0, Math.min(1, t));
              t = t * t * (3 - 2 * t);
              occ[i + k] = Math.min(occ[i + k], MOUTHLIT + (FLOORLIT - MOUTHLIT) * t);
            }
          }
        });
        geo.setAttribute("aOcc", new THREE.BufferAttribute(occ, 1));
      }
      geo.computeBoundingBox();
      const mat = MAT(spec.mat);
      if (geo.getAttribute("aOcc")) {
        // MAT() hands back a fresh material per part, so this touches the
        // housing alone. The multiply sits on the shaded colour, after the
        // lighting and before tone mapping, which is the one place that brings
        // the environment and the clearcoat down with the diffuse.
        mat.onBeforeCompile = function (sh) {
          sh.vertexShader = "attribute float aOcc;\nvarying float vOcc;\n" +
            sh.vertexShader.replace("#include <begin_vertex>",
              "#include <begin_vertex>\n\tvOcc = aOcc;");
          sh.fragmentShader = "varying float vOcc;\n" +
            sh.fragmentShader.replace("#include <tonemapping_fragment>",
              "gl_FragColor.rgb *= vOcc;\n#include <tonemapping_fragment>");
        };
        mat.customProgramCacheKey = function () { return "diopal-channel-occ"; };
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.spec = spec;
      mesh.userData.env0 = mat.envMapIntensity;
      rig.add(mesh);
      if (spec.key) byKey[spec.key] = mesh;
      (byTag[spec.tag] = byTag[spec.tag] || []).push(mesh);
      loaded++;
      if (story) story.progress(loaded / PARTS.length);
      if (loaded === PARTS.length) assemble();
    }, undefined, function (e) { console.error("STL failed", spec.file, e); });
  });

  /* ------------------------------------------------------------- the array */
  const A = {};
  let leds = [], tubes = [], cones = [], wellGlow = [], air = null;
  let traceGlow = null, meter = null, scatterCells = null;
  let carrier = null;    // the tube rack and the 24 tubes that ride in it
  let bench = null;      // the floor under the instrument

  // A soft radial falloff. A flat disc of additive colour at the mouth of a
  // bore reads as a sticker; light coming out of a hole has an edge that dies.
  function glowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 2, 64, 64, 63);
    grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.45, "#9a9a9a");
    grd.addColorStop(0.78, "#2a2a2a"); grd.addColorStop(1, "#000000");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const GLOW_TEX = glowTexture();

  function buildArray() {
    // The rack and its tubes move as one: lifting the rack off the LED plate is
    // how you actually get at the emitters, and the tubes come up with it.
    carrier = new THREE.Group();
    rig.add(carrier);
    if (byKey.rack) carrier.add(byKey.rack);

    // The LED holder's front and back walls are broken in the STL. Casting rays
    // straight in at a 3 mm grid, the wall that should stand at y = -44.5 is
    // there for about two thirds of the samples and missing for the rest, and
    // through the gaps the ray lands on interior surfaces at y = -37.8 — so
    // the flat side of the print rendered as a patchwork of two planes 7 mm
    // apart with hard triangle edges between them. That is what the shattered
    // look in the shielding act was: not shading, and not smoothing. Neither
    // the smoothing angle, the clearcoat nor the shadow map moved it, because
    // none of them was the cause. Two plates in the part's own material stand
    // at the plane the surviving wall sits on (its samples run -43.8 to -44.9,
    // so the face goes at 45.05) and close it. The measured faces — left,
    // right, top and bottom — are untouched, as is every bore.
    if (byKey.holder) {
      // 45.4, not 45.05: the surviving rail reaches -45.2 in places, and a
      // plate at 45.05 let 0.15 mm of it through — which at the shielding
      // act's grazing angle read as a row of torn flaps along the top edge.
      const skinGeo = new THREE.BoxGeometry(132.4, 1.8, 20.1);
      [-44.5, 44.5].forEach(function (y) {
        const m = new THREE.Mesh(skinGeo, byKey.holder.material);
        m.position.set(0, y, 56.45);
        m.castShadow = m.receiveShadow = true;
        byKey.holder.add(m);
      });
      // The two END walls are broken the same way. Raycast in along x at a
      // 4 x 2 mm grid, the wall at |x| 65.1-66.2 is there for about two thirds
      // of the rays and the rest land on the cavity behind it at 55.2, so the
      // drive act, which looks at the lifted holder from the front-left, showed
      // its left end as a row of torn flaps. The surviving wall reaches 66.24,
      // so the plate's face stands at 66.45, proud of it by 0.2 mm as the
      // front and back plates are; it runs the full 90.8 mm between their
      // outer faces so the corners close.
      const endGeo = new THREE.BoxGeometry(1.8, 90.8, 20.1);
      [-65.55, 65.55].forEach(function (x) {
        const m = new THREE.Mesh(endGeo, byKey.holder.material);
        m.position.set(x, 0, 56.45);
        m.castShadow = m.receiveShadow = true;
        byKey.holder.add(m);
      });
    }
    // No liner here any more. Four solid blocks used to fill the cavities
    // behind the rack's outer walls, because tubes were showing through them —
    // but that was the 16-bit depth buffer, not the geometry, and with a real
    // depth buffer nothing bleeds through. The blocks were hiding the part:
    // its mounting feet, its rim and the bore structure at the top edge, which
    // is everything that makes it read as a printed rack rather than a white
    // brick.

    // rotateX(+90) turns a cylinder's +y axis into +z, which is up in this CAD
    const barrel = new THREE.CylinderGeometry(2.5, 2.5, 7, 20).rotateX(Math.PI / 2);
    const dome = new THREE.SphereGeometry(2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
    // 70 tall: the tube's rim sits at the rack's top face (146.5), not 3.5 mm
    // proud of it. Standing proud, the tops of every column were visible over
    // the rim from above and stacked on screen into coloured 'teardrops' down
    // the outer walls — correct geometry, but it read as light leaking through.
    // 70 tall: the tube's rim sits at the rack's top face (146.5), not 3.5 mm
    // proud of it. Standing proud, the tops of every column were visible over
    // the rim from above and stacked on screen into coloured 'teardrops' down
    // the outer walls — correct geometry, but it read as light leaking through.
    const tubeGeo = new THREE.CylinderGeometry(6.2, 6.2, 70, 28, 1, true).rotateX(Math.PI / 2);
    const tubeBottom = new THREE.SphereGeometry(6.2, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).rotateX(Math.PI / 2);
    // The liquid, built in the tube's own coordinates so the shader can read
    // its height straight off position.z. A cylinder left the tube's rounded
    // bottom — the 6.2 mm dome the glass closes with — empty, and a dark
    // crescent under every column is exactly what a part-filled tube does NOT
    // look like. This is a lathe: a quarter-circle bottom that sits inside the
    // glass dome, then straight up to the meniscus.
    const BROTH_R = 5.7, BROTH_TOP = 60;
    const brothPts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI / 2;
      brothPts.push(new THREE.Vector2(BROTH_R * Math.sin(a), -BROTH_R * Math.cos(a)));
    }
    brothPts.push(new THREE.Vector2(BROTH_R, BROTH_TOP));
    const fillGeo = new THREE.LatheGeometry(brothPts, 40).rotateX(Math.PI / 2);
    // The meniscus is baked into place rather than positioned and scaled,
    // because the gradient below reads position.z: left at the origin it was
    // being shaded as if it sat at the bottom of the column, so the top of the
    // liquid glowed like the part nearest the LED.
    // 28 height segments, not 10. Flattened to 0.35 the dome is shallow, so ten
    // rings put a visible shading band every few pixels across the top of the
    // liquid at 2x device pixels — concentric arcs on what should be a smooth
    // meniscus.
    const menGeo = new THREE.SphereGeometry(BROTH_R, 48, 28, 0, Math.PI * 2, 0, Math.PI / 2)
      .rotateX(Math.PI / 2).scale(1, 1, 0.35).translate(0, 0, BROTH_TOP);
    // A screw cap, the way a culture tube is actually closed. Without one the
    // tubes read as open glass and the dark empty headspace above the broth
    // looked like a rendering fault.
    const capGeo = new THREE.CylinderGeometry(6.9, 6.9, 6.2, 28).rotateX(Math.PI / 2);
    // A sleeve of light standing inside each bore. A disc at the bottom of a
    // 12 mm hole is a dot you can barely see down a raking angle; what a lit
    // well actually shows is its WALL carrying colour, brightest at the bottom
    // and dying out toward the rim. Drawn on the inside of a cylinder (BackSide,
    // additive), so it is the far wall of the bore that glows.
    const sleeveGeo = new THREE.CylinderGeometry(5.72, 5.72, 76, 24, 1, true).rotateX(Math.PI / 2);
    // A smooth wall and a smooth mouth for each bore. The rack's own bores are
    // polygons: measured at the top face, one bore's rim runs between 8.40 and
    // 8.56 mm with about 12 degrees between facets, so the opening reads as a
    // many-sided hole and the wall inside it as a set of vertical strips, each
    // catching the light at its own angle. This is a 64-sided lathe that stands
    // just inside the hole (8.30, under the polygon's 8.40 inradius, so it
    // hides the facets without poking through them) and flares to 8.62 at the
    // rim, which covers the widest point of the polygon by 0.06 mm and leaves
    // 0.76 mm of the rack's own wall between neighbouring bores at 18 mm pitch.
    const BORE_TOP = 146.5;
    // Its own material, because a 12 mm hole is not lit like the face around
    // it: almost no environment reaches down it, and what you should read is a
    // shaft going away from you. Without the falloff the smooth wall came out
    // as bright as the top face and every bore looked like a shallow cup.
    let linerMat = null;
    if (byKey.rack) {
      linerMat = byKey.rack.material.clone();
      linerMat.envMapIntensity = 0.10;
      linerMat.onBeforeCompile = function (sh) {
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying float vBoreZ;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBoreZ = position.z;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vBoreZ;")
          .replace("#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "float bAO = clamp(1.0 + vBoreZ / 17.0, 0.0, 1.0);\n" +
            "diffuseColor.rgb *= mix(0.14, 1.0, bAO * bAO);");
      };
      linerMat.customProgramCacheKey = function () { return "bore-ao"; };
    }
    // The rack's bore rims are ragged in the same way the LED holder's walls
    // are. Raycast straight down at 10-degree steps around three bores, the rim
    // sits at 8.36-8.56 mm for most of the circle and then blows out to 9.0,
    // 9.14, 9.42 — and at a few angles there is no top face at all within
    // 11 mm, so two bores have run into each other. No lip can cover 9.42 at an
    // 18 mm pitch, so the top face itself is re-laid: one plate over the raised
    // block, with the 24 mouths punched in it as 64-sided circles at the bore's
    // own 8.42 radius. Everything ragged is under it. The block's outline was
    // measured the same way — a rounded rectangle 110 x 90 with about a 5 mm
    // corner — and the plate is held 0.3 mm inside it.
    // ShapeGeometry builds in the XY plane facing +z, which is this model's own
    // up, so a punched plate needs no rotation.
    function facePlate(hx, hy, cr, holeR, mat, z) {
      const sh = new THREE.Shape();
      sh.moveTo(-hx + cr, -hy);
      sh.lineTo(hx - cr, -hy); sh.quadraticCurveTo(hx, -hy, hx, -hy + cr);
      sh.lineTo(hx, hy - cr);  sh.quadraticCurveTo(hx, hy, hx - cr, hy);
      sh.lineTo(-hx + cr, hy); sh.quadraticCurveTo(-hx, hy, -hx, hy - cr);
      sh.lineTo(-hx, -hy + cr); sh.quadraticCurveTo(-hx, -hy, -hx + cr, -hy);
      GRID.cols.forEach(function (cx) {
        GRID.rows.forEach(function (ry) {
          const h = new THREE.Path();
          h.absarc(cx, ry, holeR, 0, Math.PI * 2, true);
          sh.holes.push(h);
        });
      });
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 64), mat);
      m.position.z = z;
      m.castShadow = false; m.receiveShadow = true;
      return m;
    }
    const rackMat = byKey.rack ? byKey.rack.material : MAT("rack");
    // The plate IS the block's top now, edge for edge: at 54.7 it was smaller
    // than the block and left a ragged rim of the original showing all round it.
    carrier.add(facePlate(TOP_HX, TOP_HY, TOP_CR, 8.42, rackMat, BORE_TOP + 0.02));
    // And the underside: the shielding act looks straight up at it from inside
    // the gap, and with the raw bore walls culled the bottom face's own rims
    // are what you see — torn into stars. Rolled a half turn so it faces down;
    // the outline and the 24 mouths are both symmetric about y, so the roll
    // maps the plate onto itself.
    const under = facePlate(TOP_HX, TOP_HY, TOP_CR, 8.42, rackMat, 0);
    under.rotation.x = Math.PI;
    under.position.z = BORE_TOP - 80.02;
    carrier.add(under);

    // The LED holder's top face is torn in the same way its side walls are:
    // 14.1% of downward rays over the block land inside it instead of on it,
    // which on screen was a set of black gashes and one raised flap in the
    // shielding act. Its own bore rims run 7.50 to 8.56, so the plate is
    // punched at 7.55 — inside the tightest of them, so the mouth you see is
    // the plate's own circle and no raw rim shows through it anywhere.
    if (byKey.holder) {
      byKey.holder.add(facePlate(65.8, 45.4, 6, 7.55, byKey.holder.material, 66.52));
    }
    const linerGeo = new THREE.LatheGeometry([
      new THREE.Vector2(8.40, 0.06),      // meets the top plate's hole from below
      new THREE.Vector2(8.30, -0.70),     // a chamfer, as the print has
      new THREE.Vector2(8.30, -80.1),     // straight down, past the bottom face
    ], 64).rotateX(Math.PI / 2);
    function sleeveMaterial(hue) {
      return new THREE.ShaderMaterial({
        uniforms: { uHue: { value: srgb(hue) }, uLit: { value: 0 }, uT: { value: 0 } },
        vertexShader: `varying vec2 vUvS; varying vec3 vNS; varying vec3 vVS;
          void main(){ vUvS = uv; vNS = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0); vVS = -mv.xyz;
            gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uHue; uniform float uLit, uT;
          varying vec2 vUvS; varying vec3 vNS; varying vec3 vVS;
          void main(){
            float up = clamp(vUvS.y, 0.0, 1.0);
            // a floor: the part of a bore you can see down a raking angle is the
            // TOP of it, and a pure falloff put almost nothing there
            float fall = 0.30 + 0.70 * pow(1.0 - up, 1.3);
            // two slow curtains travelling around the bore and up it, which is
            // what makes it read as an aurora rather than a lamp
            float a = 0.60 + 0.40 * sin(vUvS.x * 12.566 + uT * 0.55 + sin(up * 5.0 - uT * 0.33) * 1.7);
            float b = 0.72 + 0.28 * sin(vUvS.x * 6.2831 - uT * 0.40 + up * 3.0);
            float graze = 1.0 - abs(dot(normalize(vNS), normalize(vVS)));
            // pow, not linear: act 1 holds every column but the hero one at a
            // tenth, and a linear response made 'red off' glow as clearly as
            // 'green on'
            float g = fall * a * b * (0.55 + 0.45 * graze) * pow(uLit, 1.45);
            // alpha 1, not g: additive blending multiplies rgb BY the alpha, so
            // writing g into both squared the brightness and the sleeve came out
            // at a third of what it should be. rgb carries the intensity.
            gl_FragColor = vec4(uHue * g * 6.0, 1.0);
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.BackSide, toneMapped: false,
      });
    }
    const capLip = new THREE.CylinderGeometry(7.1, 7.1, 1.4, 28).rotateX(Math.PI / 2);
    // Translucent polypropylene, not black: a capped tube seen from directly
    // above is the whole of act 4, and opaque caps turned that act into 24
    // black discs. A lit culture glows up through a cap like this, so the cap
    // carries the LED's colour exactly as the broth does.
    function capMaterial(hue) {
      // A mid grey, not 0xc6cbd0. Seen from straight above in the grid act a
      // near-white cap took the key head-on, and 24 of them came out as the
      // same blown white disc: low, mid and high were one brightness and the
      // two colours were pastel. Darker and less glossy, the light coming up
      // through the cap is most of what it shows, so the six conditions read.
      const m = new THREE.MeshPhysicalMaterial({
        color: srgb(0x6a7076), metalness: 0, roughness: 0.6,
        envMapIntensity: 0.8, clearcoat: 0.1, clearcoatRoughness: 0.4,
      });
      m.onBeforeCompile = function (sh) {
        sh.uniforms.uSeat = { value: 0 };
        sh.uniforms.uLit = { value: 0 };
        sh.uniforms.uHue = { value: srgb(hue) };
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform float uSeat, uLit; uniform vec3 uHue;")
          .replace("#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            // same idea as the broth: light coming up through the cap, most of
            // it where the cap faces the eye, so it reads as a lit cap rather
            // than a disc of paint
            "float cndv = abs(dot(normalize(normal), normalize(vViewPosition)));\n" +
            "float cg = uSeat * uLit * (0.30 + 0.70 * pow(cndv, 0.7));\n" +
            "totalEmissiveRadiance += uHue * cg * 1.7;\n" +
            "diffuseColor.rgb = mix(diffuseColor.rgb, uHue, 0.22 * cg);");
        m.userData.shader = sh;
      };
      m.customProgramCacheKey = function () { return "cap-glow"; };
      return m;
    }

    // The culture: B. subtilis in broth is a pale, slightly turbid cream, and
    // it is NOT self-lit — it takes the colour of the LED under it, and only
    // once the tube is down in its bore. The glow enters from the bottom and
    // dies out before the meniscus, which is what a column of turbid liquid
    // lit from below actually looks like. uSeat carries how far into the bore
    // the tube has come; uLit is the emitter's own output.
    function cultureMaterial(hue) {
      // Transparent: a culture in a glass tube is a liquid you can see into,
      // and an opaque column is the other half of why this read as a solid bar.
      // depthWrite off with a fixed render order, because 24 of these sorted
      // per frame is what made the tubes flicker the first time round.
      const m = new THREE.MeshPhysicalMaterial({
        color: srgb(0xd3ccb6), roughness: 0.30, metalness: 0,
        transparent: true, opacity: CULTURE_OPACITY, depthWrite: false,
        envMapIntensity: 0.34, side: THREE.DoubleSide,
      });
      m.userData.col0 = m.color.clone();
      m.userData.env0 = m.envMapIntensity;
      m.onBeforeCompile = function (sh) {
        sh.uniforms.uSeat = { value: 0 };
        sh.uniforms.uLit = { value: 0 };
        sh.uniforms.uHue = { value: srgb(hue) };
        sh.uniforms.uT = { value: 0 };
        // how much of the liquid is being shown at all: the shielding act
        // takes the tubes down to near-clear so the emitters under them read
        sh.uniforms.uThin = { value: 1 };
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying float vBz;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBz = position.z;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>",
            "#include <common>\nuniform float uSeat, uLit, uT, uThin; uniform vec3 uHue; varying float vBz;")
          .replace("#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            // Down the column: the light enters at the bottom and is absorbed
            // on its way up, so the glow dies before the meniscus.
            "float gz = clamp(1.0 - (vBz + 5.7) / 65.7, 0.0, 1.0);\n" +
            // A floor under the gradient: the whole column is lit, the bottom
            // most. At a pure power the only part of a LIFTED tube you can see
            // is the dim top, so the act about three brightnesses had three
            // pale tubes in it.
            "float colz = 0.28 + 0.72 * pow(gz, 1.35);\n" +
            // ACROSS the column: what a fragment shows is the light gathered
            // along the view ray THROUGH the broth, and that path is longest
            // where the surface faces the camera and vanishes at the
            // silhouette. Without this every fragment emitted the same amount
            // and the tube came out as a flat slab of colour — a block, not a
            // glow. 0.18 is the little that still scatters out sideways.
            "float ndv = abs(dot(normalize(normal), normalize(vViewPosition)));\n" +
            "float thick = 0.18 + 0.82 * pow(ndv, 0.85);\n" +
            // Convection: the broth is being lit from below and it moves, so
            // the brightness travels up the column in slow bands. Two
            // frequencies, so it drifts rather than pulses.
            "float w1 = sin(vBz * 0.20 - uT * 0.85);\n" +
            "float w2 = sin(vBz * 0.07 + uT * 0.38 + 1.7);\n" +
            "float stir = 0.78 + 0.30 * (0.6 * w1 + 0.4 * w2);\n" +
            "float g = colz * thick * uSeat * uLit * stir * uThin;\n" +
            // the liquid drifts a little even when it is not lit
            "diffuseColor.rgb *= 0.94 + 0.08 * w2;\n" +
            // well above 1 at the core, so the bloom pass has something to
            // find and the tube carries a halo instead of a hard edge
            // 7.5, not 3.6: the composite blooms above 1.05, and at 3.6 the lit
            // part of a tube peaked at 0.6 — under the threshold, so it never
            // grew a halo and read as a flat painted cylinder.
            "totalEmissiveRadiance += uHue * g * 9.9;\n" +
            // the broth itself stays cream: it is lit, not dyed
            "diffuseColor.rgb = mix(diffuseColor.rgb, uHue, 0.20 * g);");
        m.userData.shader = sh;
      };
      m.customProgramCacheKey = function () { return "culture-grad"; };
      return m;
    }

    CHANNELS.forEach(function (ch, ci) {
      GRID.rows.forEach(function (ry, ri) {

        // ---- the emitter
        const ledMat = new THREE.MeshStandardMaterial({
          color: srgb(HUE[ch.hue]), emissive: srgb(HUE[ch.hue]),
          emissiveIntensity: 0, roughness: 0.3, metalness: 0,
        });
        const led = new THREE.Group();
        led.add(new THREE.Mesh(barrel, ledMat));
        const d = new THREE.Mesh(dome, ledMat); d.position.z = 3.5; led.add(d);
        led.children[0].position.z = -1.2;   // barrel top below the holder's top face, not on it
        led.position.set(ch.x, ry, LED_Z);
        rig.add(led);

        // ---- the cone of light it throws up into the bore
        // taller and softer than a beam: standing in a 12 mm bore it has to
        // read as the well being full of light, not as a laser
        const cone = LOOK.beam({
          length: 62, radius: 5.6, color: HUE[ch.hue], intensity: 0, edge: 2.2, core: 0.75, taper: 0.52,
        });
        LOOK.aim(cone, new THREE.Vector3(ch.x, ry, LED_Z + 4), new THREE.Vector3(ch.x, ry, LED_Z + 66));
        cone.renderOrder = 40;
        rig.add(cone);

        // ---- the culture tube standing in its bore
        // A Fresnel wall, not a milky cylinder. Flat 26% opacity made 24 tubes
        // look like drinking straws; this is clear where you look through it and
        // bright at the edge, which is what a glass tube actually does.
        const glassMat = LOOK.thinGlass({ tint: "#cfe2f2", min: 0.03, max: 0.72, power: 2.4, spec: 1.0 });
        const tube = new THREE.Group();
        const body = new THREE.Mesh(tubeGeo, glassMat); body.position.z = 35;
        const bot = new THREE.Mesh(tubeBottom, glassMat);
        tube.add(body, bot);

        // what is in it: a broth that takes the colour of the light below it
        // The broth: a shorter column so the tube reads as part full, and a
        // body that takes the colour of the light under it.
        const cultureMat = cultureMaterial(HUE[ch.hue]);
        const broth = new THREE.Mesh(fillGeo, cultureMat);
        // a meniscus, so the liquid has a surface instead of a flat cut
        const men = new THREE.Mesh(menGeo, cultureMat);
        tube.add(men);
        tube.add(broth);
        broth.renderOrder = 8 + ri; men.renderOrder = 8 + ri;
        const capMat = capMaterial(HUE[ch.hue]);
        const cap = new THREE.Mesh(capGeo, capMat); cap.position.z = 69.5;
        const lip = new THREE.Mesh(capLip, capMat); lip.position.z = 66.2;
        cap.castShadow = lip.castShadow = true;
        tube.add(cap, lip);
        tube.position.set(ch.x, ry, TUBE_Z);
        body.renderOrder = 10 + ri; bot.renderOrder = 10 + ri;   // fixed, not depth-sorted per frame
        tube.userData = { ch: ch, ci: ci, ri: ri, glass: glassMat, culture: cultureMat, capMat: capMat };
        carrier.add(tube);

        // Two discs, both with a radial falloff. The deep one is the source
        // sitting just above the emitter at the bottom of the bore — looking
        // into a lit hole, that is what you actually see. The shallow one is
        // the light escaping at the mouth, and it is the weaker of the two.
        // One flat-edged disc at the mouth was what made every well read as a
        // sticker of green or red paint.
        const gmat = function (op, size) {
          return new THREE.MeshBasicMaterial({
            color: srgb(HUE[ch.hue]), transparent: true, opacity: 0, alphaMap: GLOW_TEX,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
          });
        };
        const gDeep = new THREE.Mesh(new THREE.CircleGeometry(5.9, 28), gmat());
        gDeep.position.set(ch.x, ry, 72);
        gDeep.renderOrder = 28;
        const sleeveMat = sleeveMaterial(HUE[ch.hue]);
        const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
        sleeve.position.set(ch.x, ry, 106);
        sleeve.renderOrder = 6;
        carrier.add(sleeve);
        // the round wall and mouth, in the rack's own material so it is the
        // same surface; it rides the rack because it is part of it
        if (linerMat) {
          const liner = new THREE.Mesh(linerGeo, linerMat);
          liner.position.set(ch.x, ry, BORE_TOP);
          liner.castShadow = false; liner.receiveShadow = true;
          carrier.add(liner);
        }
        gDeep.userData.sleeve = sleeveMat;
        const gMouth = new THREE.Mesh(new THREE.CircleGeometry(7.6, 28), gmat());
        gMouth.position.set(ch.x, ry, 146.62);
        gMouth.renderOrder = 30;
        carrier.add(gDeep, gMouth);
        const g = gMouth;
        g.userData.deep = gDeep;

        leds.push({ mesh: led, mat: ledMat, ch: ch, ci: ci, ri: ri });
        cones.push({ mesh: cone, ch: ch, ci: ci, ri: ri });
        tubes.push(tube);
        wellGlow.push({ mesh: g, ch: ch, ci: ci, ri: ri });
      });
    });

    // Cells drifting inside ONE tube, for act 2. Illustrative — see the ledger.
    const n = 120;
    const cg = new THREE.SphereGeometry(0.26, 6, 5); cg.scale(1, 1, 2.2);
    const cm = new THREE.MeshStandardMaterial({
      color: srgb(0xe8e4d2), roughness: 0.5, metalness: 0,
      emissive: srgb(HUE.green), emissiveIntensity: 0.1, transparent: true, opacity: 0.85,
    });
    scatterCells = new THREE.InstancedMesh(cg, cm, n);
    scatterCells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scatterCells.userData.seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) scatterCells.userData.seed[i * 4 + k] = Math.random();
    }
    const hero = tubes[11];              // green Mid column, front row
    scatterCells.position.copy(hero.position);
    scatterCells.visible = false;
    carrier.add(scatterCells);
    A.heroTube = hero.position.clone();
    A.hero = hero;
    A.heroCh = hero.userData.ch;
    A.heroCi = hero.userData.ci;
  }

  // The drive chain: a glow that runs along the board under each column.
  // 96 long, not 108: the board is 100 mm deep, and at 108 every strip hung
  // 4 mm off both edges of it as a little coloured tab in the air. And soft
  // across its width and at its ends, the way the well glows are: a flat
  // additive rectangle read as a stripe of paint on the board, not as current.
  function stripTexture() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const g = c.getContext("2d");
    const img = g.createImageData(64, 64);
    for (let y = 0; y < 64; y++) {
      const v = (y + 0.5) / 64;
      const along = Math.min(1, Math.min(v, 1 - v) / 0.07);
      for (let x = 0; x < 64; x++) {
        const u = Math.abs((x + 0.5) / 64 - 0.5) * 2;
        const across = Math.pow(Math.max(0, 1 - u * u), 1.6);
        const a = Math.round(255 * across * along * along * (3 - 2 * along));
        const o = (y * 64 + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = a; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }
  function buildTraces() {
    traceGlow = new THREE.Group();
    const strip = stripTexture();
    CHANNELS.forEach(function (ch, ci) {
      const g = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 96),
        new THREE.MeshBasicMaterial({
          color: srgb(HUE[ch.hue]), transparent: true, opacity: 0, alphaMap: strip,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        })
      );
      g.position.set(ch.x, 0, 2.4);
      g.userData.ci = ci;
      traceGlow.add(g);
    });
    rig.add(traceGlow);
  }

  // The lux meter head used in act 7 — a dark disc on a stem, the shape of the
  // instrument in the team's own photograph.
  function buildMeter() {
    meter = new THREE.Group();
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11, 4.5, 36).rotateX(Math.PI / 2),
      LOOK.printed("#16181c", 0.45, { clearcoat: 0.5 })
    );
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(11, 1.2, 12, 40),
      LOOK.printed("#23262b", 0.5)
    );
    lip.position.z = -2;                 // a torus is already in the xy plane
    const eye = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 32),
      new THREE.MeshPhysicalMaterial({
        color: srgb(0x0c0e11), roughness: 0.06, metalness: 0.1,
        emissive: srgb(0x000000), emissiveIntensity: 0,
        clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6,
      })
    );
    eye.position.z = -2.35; eye.rotation.y = Math.PI;   // facing down at the LED
    meter.add(head, lip, eye);
    meter.visible = false;
    rig.add(meter);
  }

  function assemble() {
    const box = new THREE.Box3().setFromObject(rig);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    rig.position.sub(c);
    rig.updateMatrixWorld(true);

    A.center = c.clone();
    A.size = size.clone();
    A.radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    A.fit = A.radius / Math.tan((30 * Math.PI / 180) / 2);
    // What each act has to make legible, as a radius in CAD millimetres.
    A.r = {
      all: A.radius,
      wells: 34,     // a 2x2 patch of wells: you can see they are tubes in bores
      tube: 11,      // one tube, inside the opened case
      pair: 30,      // two neighbouring bores with their LEDs under them
      rack: 86,      // the whole 6x4 grid with its frame
      tiers: 52,     // three LEDs of one colour, side by side
      board: 104,    // the perf board across the instrument
      meter: 92,     // the meter walking the array
    };
    A.top = new THREE.Vector3(0, 0, 146.5);
    A.board = new THREE.Vector3(0, 0, 1);

    // Air. The photometer has had a mote field since its beam act and this
    // story had nothing: every frame outside the instrument was clean black,
    // which is why the wide acts read as a render on a page rather than a
    // thing standing in a room. Cool and very sparse -- the array throws its
    // own green and red about, and warm motes on top of that read as dirt.
    air = LOOK.motes(190, { x: 420, y: 380, z: 330 },
                     { color: "#bfe6d4", size: 2.4, opacity: 0.26, drift: 3.0 });
    air.position.copy(A.center);
    air.renderOrder = 40;
    rig.add(air);

    buildArray();
    buildTraces();

    // the plane that opens the case for act 3, along the row the hero tube is in
    // Clipping planes are world space. CAD +y maps to world -z, so a cut along
    // the hero row is a world plane with normal (0, 0, -1).


    // a table under it
    const R = Math.max(size.x, size.z) * 4.5;
    const cnv = document.createElement("canvas"); cnv.width = cnv.height = 256;
    const g2 = cnv.getContext("2d");
    const grd = g2.createRadialGradient(128, 128, 12, 128, 128, 126);
    grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.5, "#9a9a9a"); grd.addColorStop(1, "#000000");
    g2.fillStyle = grd; g2.fillRect(0, 0, 256, 256);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(R, 64),
      new THREE.MeshStandardMaterial({
        // 0.75, not 0.5. At 0.5 the key laid a broad white specular pool on
        // the bench whenever the camera came round to the key's side, and at
        // the close that pool sat directly under the end line: pale type on a
        // pale floor. Measured behind the end line (p90 luma, type hidden):
        // 0.55 -> 87, 0.65 -> 71, 0.75 -> 55, 0.85 -> 42. 0.75 is the least
        // roughness that takes the pool out from under the type; what is left
        // is a soft falloff that still reads as a lit bench.
        color: srgb(0x0b0d11), roughness: 0.75, metalness: 0.05,
        alphaMap: new THREE.CanvasTexture(cnv), transparent: true, envMapIntensity: 0.5,
        // The bench gets a grid -- see the photometer's floor for why. Cooler
        // and a touch dimmer here: the array throws green and red across this
        // floor already, and a warm grid under it read as a third colour.
        emissiveMap: LOOK.benchGrid({ cells: 14, sub: 4 }),
        emissive: srgb(0x354a52),
        emissiveIntensity: 0.30,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    const wb = new THREE.Box3().setFromObject(world);
    floor.position.y = wb.min.y + 0.4;
    floor.receiveShadow = true;
    scene.add(floor);
    bench = floor;

    // compile() only walks VISIBLE objects, and the two things that appear late
    // in the story — the cells inside a tube and the lux meter — were each
    // costing a 66 ms frame the first time they were shown. Show them for the
    // compile, then put them away again.
    const hidden = [scatterCells].filter(Boolean);
    hidden.forEach(function (o) { o.visible = true; });
    renderer.compile(scene, camera);
    hidden.forEach(function (o) { o.visible = false; });

    RQ.fitShadow(key, rig);
    // The frustum stays as RQ fits it. It was widened 1.9x at one point to chase
    // a black square across the grid; that square turned out to be a multisample
    // resolve artefact, and the wider frustum only made each shadow texel 1.9x
    // bigger — measured, the rack's top face dropped from 219 to 156 in acne.
    key.shadow.bias = -0.0007; key.shadow.normalBias = 0.7;
    ready = true;
    // A compile is not enough: the first frame that actually draws a
    // transmissive material builds the renderer's transmission target, and on
    // this story that landed mid-scroll as a 67 ms hitch. Draw the expensive
    // beats once, behind the loader, before anyone can scroll.
    [0.22, 0.50, 0.75, 0.86].forEach(function (q) { draw(q, 12.5); });
    draw(0, 12.5);
    story.ready();
    resize();
  }

  /* ------------------------------------------------------------------ acts */
  // The acts and their captions live in js/hero.js, shared with the video mode.
  const B0 = HP.B0, B1 = HP.B1, B2 = HP.B2, B3 = HP.B3, B4 = HP.B4, B5 = HP.B5, B6 = HP.B6, B7 = HP.B7;

  function smoothp(p, a, b) { const x = (p - a) / (b - a); return x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10); }
  function ramp(p, a, b) { const t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  const _up = new THREE.Vector3(), _upTop = new THREE.Vector3(0, 0, -1);
  let curD = 400;
  // CAD space: +z is up, so the elevation goes into z and the azimuth into x/y.
  function shotAt(out, target, dist, yaw, pitch) {
    const cy = Math.cos(pitch), sy = Math.sin(pitch);
    out.set(target.x + dist * cy * Math.sin(yaw),
            target.y - dist * cy * Math.cos(yaw),
            target.z + dist * sy);
  }

  function shots() {
    const hero = A.heroTube, row = hero.y;
    // The rack carries the tubes up off the LED plate, so the acts that are
    // about a tube have to follow it; the acts that are about the emitters stay
    // down at the plate and let the rack leave the top of the frame.
    const lift = A.lift || 0, liftX = A.slide || 0;
    return [
      // 0 wake — the whole instrument, centred, with a margin
      // low and on a long lens, the block heavy on its base, the lit columns
      // showing through the side wells as they wake
      { at: new THREE.Vector3(0, 0, 66), r: A.r.all, fill: 0.90, yaw: -0.75, pit: 0.28, fov: 26, ox: 55, oy: 6 },
      // 1 the question — a patch of wells, close enough to see they are tubes
      // Far enough back to see the rack as an object, high enough to look into
      // the bores. At r 30 it was a patch of wells filling the frame with the
      // rack running off both edges — no sense of what the thing is — and the
      // low rake turned the top face into a slab. This shows all six columns,
      // so the three lit greens read low to high across the frame.
      { at: new THREE.Vector3(0, 0, 147), r: 58, fill: 0.80, yaw: -0.25, pit: 0.72, fov: 27, ox: 30, oy: 10 },
      // 2 inside the tube — the case is open along the hero row
      // level with the rack top, wide enough to see the tubes come down into
      // their bores from above the frame
      { at: new THREE.Vector3(0, 0, 150), r: 78, fill: 0.82, yaw: -0.28, pit: 0.10, fov: 28, ox: 55, oy: 0 },
      // 3 shielding — two bores and the LEDs under them
      // level, tight and frontal, in the gap under the lifted rack: two emitters
      // in front, their beams rising into two bores overhead, the wall between
      { at: new THREE.Vector3(hero.x + 8, row, 76), r: 24, fill: 0.85, yaw: -0.15, pit: 0.0, fov: 28, ox: 50, oy: -20 },
      // 4 the grid, overhead
      // straight down. The act is the 6 x 4 pattern and its labels line up
      // with the columns only from directly overhead
      // ox 70: centred, the rack's left edge ran under the end of the caption's
      // title ("…four tubes each") at 1440.
      { at: new THREE.Vector3(0, 6, 140), r: A.r.rack, fill: 0.86, yaw: 0.0, pit: 1.45, fov: 26, ox: 70, oy: 0 },
      // 5 the dose — three tiers of one colour
      // along the emitter row on a long lens: domes in the foreground, beams
      // rising like pipes, the three duty-cycle traces stacked behind them.
      // The first cut was the shielding act's framing again.
      // three green tubes — low, mid, high — lifted out of the front row and
      // seen level from the front, glowing at three brightnesses, the duty
      // traces beside them. Not the gap under the rack: that is act 3's shot.
      { at: new THREE.Vector3(-9, -27, 162), r: 56, fill: 0.84, yaw: 0.0, pit: 0.06, fov: 26, ox: -150, oy: -6 },
      // 6 the drive chain — the instrument apart, the board lit underneath it
      // Exploded, but CLOSE: the emitter row large with the board's lit traces
      // under it. The whole stack from a distance made the act about the
      // instrument coming apart; it is about the board.
      // The parts come off the way they actually come off — straight up, in
      // removal order, the shell going furthest because it has to clear the
      // holder inside it. That also leaves the board-to-emitter axis clear,
      // which is what this close-up needs.
      // ox 130, not 20: the board runs from the bottom left of this frame to
      // the upper right, and its near corner sat under the caption's title.
      { at: new THREE.Vector3(0, -6, 92), r: 88, fill: 0.88, yaw: -0.48, pit: 0.08, fov: 26, ox: 130, oy: -6 },
      // 7 assembly — the same stack coming back together, from the other side
      // and lower, so the two acts are not one shot played twice
      { at: new THREE.Vector3(0, 0, 205), r: 256, fill: 0.90, yaw: 0.42, pit: 0.16, fov: 28, ox: 30, oy: -4 },
      // 8 close
      // from the other side of the opening, lower: the base heavy, every
      // column alight through the side wells
      { at: new THREE.Vector3(0, 0, 64), r: A.r.all, fill: 0.88, yaw: 0.55, pit: 0.14, fov: 26, ox: 45, oy: 6 },
    ];
  }

  // Distance at which a sphere of radius r fills `fill` of the frame's tighter
  // axis — the same rule the photometer uses, so no act can crop its subject.
  function fitDist(r, fovDeg, fill) {
    const vfov = fovDeg * Math.PI / 180;
    const aspect = Math.max(0.35, stage.clientWidth / Math.max(1, stage.clientHeight));
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const f = Math.max(0.15, Math.min(0.95, fill));
    return Math.max(r / Math.tan(vfov / 2 * f), r / Math.tan(hfov / 2 * f));
  }

  // A development hook: window.__dp.tune = { 4: {yaw, pit, fill, r} } overrides a
  // shot's framing without an edit-reload cycle. Nothing reads it in normal use.
  const TUNE = {};
  // The same slow curtain the photometer carries, in this instrument's own
  // colour. Added to linear radiance before tone mapping and masked to the dark
  // parts of the frame, so it never sits over the array: base 0.10 with a
  // gentle gamma is the setting that reads without taking the frame over.
  const AURORA = { base: 0.10, dip: 0.22, gamma: 1.25, col: "#33d98a" };
  const CUTS = [0, B0, B1, B2, B3, B4, B5, B6, B7, 1];
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

  function camera_(p, clock) {
    const S = shots();
    for (const k in TUNE) { if (S[k]) Object.assign(S[k], TUNE[k]); }
    let i = 0;
    for (; i < CUTS.length - 2; i++) if (p < CUTS[i + 1]) break;
    const a = S[Math.min(i, S.length - 1)], b = S[Math.min(i + 1, S.length - 1)];
    const c0 = CUTS[i], c1 = CUTS[i + 1], span = Math.max(c1 - c0, 1e-4);
    const t = smoother((p - (c0 + span * HOLD_IN)) / Math.max(1e-4, span * (1 - HOLD_IN - HOLD_OUT)));

    const dA = a.d !== undefined ? a.d : fitDist(a.r, a.fov, a.fill);
    const dB = b.d !== undefined ? b.d : fitDist(b.r, b.fov, b.fill);
    const at = tmp.copy(a.at).lerp(b.at, t);
    // The arc is a bounded bulge proportional to how far the camera actually
    // travels, not a fraction of the distance itself: as a fraction, the far
    // record shot swung the camera most of a metre out and back inside one act.
    const asw = Math.sin(Math.PI * t);
    const bulge = Math.min(110, 0.34 * Math.abs(dB - dA)) * asw * asw;
    const d = lerp(dA, dB, t) + bulge, pit = lerp(a.pit, b.pit, t);
    let yaw = lerp(a.yaw, b.yaw, t);
    // act 7 walks the meter along the row, so the camera drifts with it
    // see the photometer's note: a one-way ramp inside one act is a cut at the
    // act boundary. This swings out and back instead.
    const ox = lerp(a.ox, b.ox, t), oy = lerp(a.oy, b.oy, t);
    shotAt(camPos, at, d, yaw, pit);
    camTgt.copy(at);
    curD = d;
    A.pitch = pit;

    camPos.x += Math.sin(clock * 0.19) * d * 0.004;
    camPos.y += Math.cos(clock * 0.15) * d * 0.003;

    // ox/oy are quoted for a 1280-wide landscape frame. On a phone, +150 px is
    // most of the width, so the subject went off the side; and in portrait the
    // room is vertical, not horizontal — the subject rides up and the type sits
    // under it instead.
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const sx = Math.min(1, vw / 1280);
    const portrait = vh > vw * 1.05;
    const oxS = ox * sx * (portrait ? 0.22 : 1);
    const oyS = oy * sx + (portrait ? -vh * 0.13 : 0);

    camera.fov = lerp(a.fov, b.fov, t) * (portrait ? 1.12 : 1);
    // A near plane that follows the shot, as the photometer's does. Fixed at
    // 0.5 mm it threw away almost all of the depth buffer's precision on the
    // wide shots — objects 30 mm apart in depth were drawing through each
    // other — and nothing in this story is ever closer than 8% of the shot
    // distance.
    camera.near = Math.max(1, Math.min(40, d * 0.08));
    camera.setViewOffset(vw, vh, -oxS, -oyS, vw, vh);
    world.updateMatrixWorld(true);
    const wp = camPos.clone(); rig.localToWorld(wp);
    const wt = camTgt.clone(); rig.localToWorld(wt);
    camera.position.copy(wp);
    // Straight down, the default up vector (world +y) is the axis the camera is
    // looking ALONG, so lookAt has nothing to resolve the roll against and
    // picks one arbitrarily — which is why the overhead act came out with the
    // array tilted in the frame instead of square to it. Approaching vertical,
    // the up vector swings to the array's own row axis (CAD +y, which the
    // quarter-turn on the world group maps to world -z), so the six columns
    // run across the frame and the four rows down it.
    const polar = clamp01((pit - 1.02) / 0.40);
    _up.set(0, 1, 0).lerp(_upTop, polar);
    if (_up.lengthSq() < 1e-6) _up.copy(_upTop);
    camera.up.copy(_up.normalize());
    camera.lookAt(wt);
    camera.updateProjectionMatrix();
    // Anything placed from a projection this frame (labels, readouts) needs
    // THIS frame's view matrix. The renderer updates it at render time, which
    // is after they are placed: without this they trailed the camera by one
    // frame — a wobble while moving, and flatly wrong on the first frame of
    // any jump.
    camera.updateMatrixWorld(true);
  }

  /* --------------------------------------------------------------- overlays */
  const labelWrap = document.getElementById("labels");
  const colLabels = CHANNELS.map(function (ch) {
    const el = document.createElement("div");
    el.className = "collab " + ch.hue;
    el.innerHTML = '<b>' + ch.nm + '<span>nm</span></b><i>' + ch.tier.toUpperCase() + '</i>';
    labelWrap.appendChild(el);
    return el;
  });
  // The duty-cycle traces (#duty) are drawn by js/hero.js, live in both modes.

  const _v = new THREE.Vector3();
  function place(el, point, dx, dy, alpha) {
    if (alpha <= 0.002) { el.style.opacity = "0"; el.style.visibility = "hidden"; return; }
    _v.copy(point); rig.localToWorld(_v); _v.project(camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    const bw = el.offsetWidth || 90, bh = el.offsetHeight || 30;
    let x = (_v.x * 0.5 + 0.5) * w + (dx || 0) - bw / 2;
    let y = (-_v.y * 0.5 + 0.5) * h + (dy || 0);
    x = Math.max(12, Math.min(w - bw - 12, x));
    y = Math.max(12, Math.min(h - bh - 12, y));
    el.style.visibility = "visible";
    el.style.opacity = alpha.toFixed(3);
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
  }


  /* -------------------------------------------------------------- the frame */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  const _p = new THREE.Vector3();

  /* ----------------------------------------------------------- the callouts */
  // Each act is about one piece of the array, and the caption in the corner was
  // the only thing naming it. Now the piece itself is ringed and named. Act 07
  // gets one per part: its caption lists base plate, perf board, LED holder,
  // housing and tube rack, and that list is worth far more attached to the five
  // things coming together than sitting in a paragraph beside them.
  const CO = window.Callouts
    ? Callouts(stage, { canvas: canvas, accent: "#46e08f", sans: '"Oxanium Title", system-ui, sans-serif' })
    : null;

  const RIM_HEX = "#7df0b5";
  const RIMMED = [];

  function calloutsAt(p) {
    if (!CO) return [];
    const out = [];
    function add(a, b, mesh, label, sub, side) {
      if (!mesh) return;
      // The rim is made once, the first time a part is ever named, and lives on
      // the part from then on. Creating it here keeps the list of things worth
      // highlighting in one place instead of two that can drift apart.
      if (!mesh.userData._rim && LOOK.rimGlow) LOOK.rimGlow(mesh, RIM_HEX);
      const v = Math.max(0, Math.min(1, Math.min((p - a) / 0.018, (b - p) / 0.018)));
      if (mesh.userData._rim && RIMMED.indexOf(mesh) < 0) RIMMED.push(mesh);
      if (v > 0.004) out.push({ mesh: mesh, label: label, sub: sub, a: v, side: side });
    }
    // Rim only, no tag, on all three. Each was wrong in its own way:
    //
    //  - act 02's tag named the tube rack, the largest and plainest object in
    //    the frame, when the act is about the tube and the emitter under it.
    //  - act 03's ring landed in empty black BELOW the instrument: at that
    //    camera the holder's centre is occluded, and a 2D ring has no way to
    //    know that, so it pointed at nothing.
    //  - act 06's read "three MOSFETs" over a board that does not have them.
    //    The MOSFET row is not in the CAD -- it is in this file's own honesty
    //    note -- so the label sent the reader looking for parts that are not
    //    modelled.
    //
    // The rim has none of those problems: it lights the part wherever the part
    // actually is, and it makes no claim.
    //
    // Act 02 no longer rims the rack at all. On the white rack the rim barely
    // showed; on the black one the fresnel term lit the whole shaded side and
    // the flange mint, which read as green light leaking out of the case,
    // in the act about light reaching nothing but the tube. The tubes coming
    // down are the subject and need no help.
    add(B2 + 0.028, B3 - 0.004, byKey.holder, null);
    add(B5 + 0.028, B6 - 0.004, byKey.board, null);
    // The assembly act, named while the five are still apart. Measured across
    // the act, their centres span 695 px at p 0.79 and only 192 px by 0.86 --
    // the first cut ran 0.82 to 0.92, so four of the five labels arrived after
    // the stack had closed and piled into one column of tags on top of each
    // other. They now open early and are gone by the time the parts seat.
    const asm = B6 + 0.002, aEnd = B6 + 0.070;
    add(asm + 0.000, aEnd, byKey.plate, "Base plate");
    add(asm + 0.005, aEnd, byKey.board, "Perf board");
    add(asm + 0.010, aEnd, byKey.holder, "LED holder");
    add(asm + 0.015, aEnd, byKey.housing, "Housing");
    add(asm + 0.020, aEnd, byKey.rack, "Tube rack");
    return out;
  }


  function draw(p, clock) {
    if (!ready) return;
    // Act 6 takes the instrument apart and act 7 puts it back together. The
    // first cut ghosted the case for act 6 and slid one part sideways, which
    // read as a glitch — half a transparent instrument with a board floating
    // through it — and then exploded and reassembled inside act 7 alone, so
    // the assembly went past in half an act.
    // Everything that travels along the stack's own axis goes out together and
    // comes back together — and lands BEFORE the two side slides do. You cannot
    // slide a retainer in past a shell that is not down yet, so the assembly
    // reads wrong if they arrive at once: verticals home by B7 - 0.055, slides
    // from B7 - 0.050 to B7 - 0.004.
    const boom = smoothp(p, B5 - 0.012, B5 + 0.030) * (1 - smoothp(p, B6 + 0.020, B7 - 0.055));
    const slideOut = smoothp(p, B5 - 0.012, B5 + 0.030) * (1 - smoothp(p, B7 - 0.050, B7 - 0.004));
    A.boom = boom;
    /* --- the covers come off ---
       The housing lifts away and the rack carries its tubes up off the LED
       plate; for the drive-chain act the LED holder comes off too. The story
       used a section cut here, which reads as a drawing rather than as an
       instrument being opened.  */
    // The rack is lifted to a different height for each act that needs it:
    //   act 2  high, so one tube hangs clear and can be looked at
    //   act 3  a 32 mm gap, which is where each emitter's cone crosses into
    //          its own bore — the shielding the caption is about
    //   act 5  the same gap, with the emitters in view from the side
    //   act 6  high and aside, with the LED holder off, to reach the board
    const hi1 = 0;   // act 2 pulls the tube, it does not lift the rack
    // the gap under the rack opens at the START of act 3, not during act 2 —
    // act 2 is the tubes coming down into a seated rack
    const lo1 = smoothp(p, B2 - 0.040, B2 + 0.015) - smoothp(p, B3 - 0.070, B3 - 0.010);
    const lo2 = 0;   // act 5 no longer opens the gap: it lifts three tubes instead
    const hi2 = 0;   // act 6 explodes now; nothing slides sideways
    const high = Math.max(0, hi1) + Math.max(0, hi2);
    const gap = Math.max(0, lo1) + Math.max(0, lo2);
    const open = Math.min(1, high + gap);          // is the instrument open at all
    const deep = Math.max(0, hi2);                 // the board act
    // A tube sits inside its bore for its whole length, so lifting the rack
    // lifts the tube with it and shows nothing. What a person actually does is
    // pull the tube out — so that is what act 2 does, and the rack only opens a
    // gap under it for act 3.
    // The tubes are not in the rack when the page opens. They come down into
    // their bores across act 2, one after another — what loading the instrument
    // actually looks like — and in act 5 the three green tubes of the front row
    // rise out again so the three doses can be seen side by side.
    // The act used to open on a bare rack: the tubes started at B1 + 0.010 and
    // fell from 190 mm up, so for the first third of the act — with the caption
    // already on screen — the frame was a white box with nothing happening.
    // They start a touch before the act and fall from 120, which puts them in
    // frame from the first moment the caption is up.
    const seatT = B1 - 0.006;
    const tierUp = smoothp(p, B4 - 0.012, B4 + 0.026) * (1 - smoothp(p, B5 - 0.060, B5 - 0.012));
    tubes.forEach(function (tb, i) {
      const ci = tb.userData.ci, ri = tb.userData.ri;
      const order = ((ci * 7 + ri * 5) % 24);                 // scattered, not a scan
      const t0 = seatT + order * 0.0026;
      const drop = clamp01((p - t0) / 0.042);
      const fall = 1 - Math.pow(drop, 1.9);                    // a fall: slow to start, fast to land
      let z = TUBE_Z + fall * 150;
      // act 5: the front-row green tubes come up, low then mid then high
      if (ri === 3 && ci % 2 === 0) {
        // they start rising during the travel in from act 4 and are all up by
        // B4 + 0.03, well before the caption is fully in
        const lag = ci * 0.002;
        const up = smoothp(p, B4 - 0.012 + lag, B4 + 0.026 + lag) * (1 - smoothp(p, B5 - 0.060, B5 - 0.012));
        z += up * 46;   // clear of the rack, still close enough to the hole to be lit
      }
      tb.position.set(tb.userData.ch.x, GRID.rows[ri], z);
      // Each tube appears when ITS OWN drop starts, not when the first one
      // does. Parking all 24 at the top of the fall put a curtain of tubes
      // across the frame at the head of the act; now they arrive in the
      // scattered order they land in, which is a shower rather than a wall.
      tb.visible = p >= t0 - 0.002;
    });
    A.tierUp = tierUp;
    const lift = high * 98 + gap * 32 + boom * 320;
    const slide = deep * 56;
    if (carrier) {
      carrier.position.set(slide, deep * -10, lift);
      carrier.rotation.set(deep * 0.05, deep * 0.10, 0);
    }
    if (byKey.housing) {
      const m = byKey.housing;
      // 215, not 96. The shell is 190 mm across, so sliding it 96 mm aside puts
      // its FAR wall at x = -2 — straight through the middle of the array. In
      // the shielding act that wall stood up out of the LED plate as a solid
      // grey flap with a specular edge on it, and its shadow crossed the half
      // of the array the act is looking at. 215 clears the widest part of the
      // instrument by 65 mm, so the shell and its shadow are both out of the
      // shot the act actually wants.
      // 300, not 215, and no longer ghosted. At 215 the far end of the shell
      // still stood in the right edge of the shielding act's wide lens, and the
      // ghost (down to 15% when the camera was close) turned it into a pale
      // glassy wedge there for the whole act, and into a see-through case on
      // the way in and out. At 300 it is out of the frame for the act, so it
      // stays a solid black part everywhere it is seen.
      m.position.set(open * 300, open * 34, open * 30 + boom * 230);
      m.rotation.set(0, open * 0.16, open * 0.05);
    }
    if (byKey.holder) {
      const m = byKey.holder;
      m.position.set(deep * -88, deep * 26, deep * 26 + gap * 3 + boom * 78);
      m.rotation.set(0, deep * -0.2, deep * 0.06);
    }
    // the emitters and their cones ride the LED holder; the board and its
    // traces lift a little; the two slides go out sideways
    leds.forEach(function (L) { L.mesh.position.z = LED_Z + boom * 78; });
    cones.forEach(function (c) {
      if (c.mesh.userData.z0 === undefined) c.mesh.userData.z0 = c.mesh.position.z;
      c.mesh.position.z = c.mesh.userData.z0 + boom * 78;
    });
    // the board comes out furthest relative to its neighbours: the drive act
    // is about the board, and buried in the housing its traces read as nothing
    (byTag.board || []).forEach(function (m) { m.position.z = boom * 40; });
    if (traceGlow) traceGlow.position.z = boom * 40;
    (byTag.slider || []).forEach(function (m) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const side = m.geometry.boundingBox.getCenter(new THREE.Vector3()).x < 0 ? -1 : 1;
      m.position.x = side * slideOut * 70;
    });
    A.lift = lift; A.slide = slide; A.high = high;

    camera_(p, clock);

    // The bench goes as the camera goes over the top. Looking straight down it
    // fills the frame, and the instrument's own cast shadow lies across it as a
    // large hard-edged polygon — physically right, and unreadable as a shadow
    // because there is nothing else in frame to place it against. Driven by the
    // camera's pitch rather than by an act number, because the pitch is the
    // thing that causes it: gone by the grid act's 1.45 radians, back for every
    // act that looks at the instrument from the side, where the cast shadow is
    // what grounds it. Opacity, not receiveShadow — toggling that recompiles
    // the material, which is a hitch in the middle of a scroll.
    if (bench) {
      const over = clamp01(((A.pitch || 0) - 1.00) / 0.32);
      bench.material.opacity = 1 - over;
      bench.visible = over < 0.995;
    }

    /* --- which columns are alight, and how hard --- */
    // The cones were switched off whenever the rack was seated — which is every
    // act that looks INTO a well, so the only light in a bore was a flat disc at
    // the bottom of it. Seated, the cone is a soft column of light standing in
    // the bore, which is what a lit well actually looks like; lifted, it is the
    // beam crossing the gap that act 3 is about.
    // The shielding act is about a beam crossing the gap into its own bore, and
    // 24 tubes of cream liquid stand in front of it. They go to near-clear for
    // that act only. The ramp is back to solid by B3 + 0.030, which is a tenth
    // of the track before act 5 starts lifting the three green tubes — the act
    // that needs them reading as solid columns of light.
    const seeThru = smoothp(p, B2 - 0.025, B2 + 0.020) * (1 - smoothp(p, B3 - 0.010, B3 + 0.030));
    A.seeThru = seeThru;
    const gapShow = 0.22 + 0.78 * Math.min(1, 1.6 * Math.max(0, (A.lift || 0) / 32));
    // act 0 wakes them left to right; from act 4 on they are all lit
    const wake = ramp(p, 0.004, 0.058);
    const allOn = ramp(p, B2 - 0.030, B2 + 0.020);
    const heroOnly = ramp(p, B0 - 0.02, B0 + 0.02) * (1 - allOn);
    const dutyAct = ramp(p, B4 - 0.02, B4 + 0.03) * (1 - ramp(p, B5 - 0.02, B5 + 0.02));
    const driveAct = ramp(p, B5 + 0.010, B5 + 0.040) * (1 - ramp(p, B6 - 0.02, B6 + 0.02));

    // Act 6 runs an INTENSITY at a time, left to right — not a column. There is
    // one MOSFET per intensity tier, three in all, and the green and the red
    // column at a tier hang off the same gate: they switch together. CHANNELS
    // is ordered green/red per tier, so the tier of column ci is ci >> 1.
    // The sweep runs across the act's held framing, not after it.
    const sweep = driveAct > 0.01 ? clamp01((p - (B5 + 0.030)) / ((B6 - 0.030) - (B5 + 0.030))) * 3.2 : -1;

    leds.forEach(function (L, i) {
      const ch = L.ch;
      const colWake = clamp01((wake * 6.4) - L.ci);          // act 0's left-to-right wave
      let on = Math.max(colWake * (1 - allOn * 0.0), allOn);
      if (heroOnly > 0.02 && allOn < 0.5) {
        // "Green on, red off": all three GREEN columns are lit, each at its own
        // tier, and the reds are held down. Lighting one hero column instead
        // put the MID green at full and made it the brightest thing in the act,
        // which reads as the intensities being out of order — the tiers are
        // low, mid, high left to right and the picture has to say so.
        const green = (L.ci % 2) === 0;
        on = Math.max(on * 0.10, (green ? 1 : 0.14) * heroOnly);
      }
      if (driveAct > 0.5) {
        const lead = clamp01(sweep - (L.ci >> 1));   // by tier: green and red together
        on = Math.max(0.05, lead);
      }

      // the tier is a duty cycle; at act 5 it is shown pulsing in real time
      let d = DUTY[ch.tier];
      // Act 5 shows the duty cycle on the three lifted tubes only. Pulsing all
      // 24 emitters in lockstep strobed the whole frame — every well, cone and
      // bloom halo blinking together — which read as a rendering fault, not as
      // a demonstration.
      // The three lifted tubes used to carry the PWM itself: d was set to the
      // INSTANTANEOUS gate state, 1 or 0.06. That is why no amount of tuning
      // would separate mid from high — at any given frame both are simply "on",
      // and their difference is in time, not in brightness. Blinking tubes are
      // also the hardest thing to compare by eye.
      //
      // The traces on the right carry the timing now, and carry it better since
      // they are filled: the tubes carry the RESULT, which is the average, and
      // 16 / 52 / 100 percent is a six-to-one range you can read at a glance.
      // The act still moves, because the traces scroll.
      const em = on * (0.25 + 3.4 * d);
      L.mat.emissiveIntensity = em;
      const ci2 = cones[i];
      ci2.mesh.material.uniforms.uIntensity.value = 1.35 * on * (0.4 + 0.6 * d) * gapShow;
      // A beam quad has to be turned to face the camera every frame. This was
      // never called here, so all 24 emitter cones have been drawing edge-on —
      // which is to say, not at all — in every DiOPAL frame so far.
      ci2.mesh.visible = ci2.mesh.material.uniforms.uIntensity.value > 0.01;
      if (ci2.mesh.visible) LOOK.face(ci2.mesh, camera);
      // the source at the bottom of the bore is always there; the spill at the
      // mouth only reads when the camera is looking down into the hole
      const fromAbove = 0.12 + 0.88 * clamp01(((A.pitch || 0) - 0.25) / 0.5);
      const wg = wellGlow[i].mesh;
      wg.material.opacity = 1.30 * on * (0.35 + 0.65 * d) * fromAbove;
      wg.userData.deep.material.opacity = 2.20 * on * (0.35 + 0.65 * d);
      const sl = wg.userData.deep.userData.sleeve;
      if (sl) {
        sl.uniforms.uLit.value = on * (0.35 + 0.65 * d);
        sl.uniforms.uT.value = clock + L.ci * 0.8 + L.ri * 1.6;
      }

      const tb = tubes[i];
      // seated = in the bore over its LED. A tube in the air above the rack is
      // just cream broth; the colour arrives as it comes down toward the hole,
      // over the last 120 mm of the drop.
      const seat = clamp01(1 - (tb.position.z - TUBE_Z) / 120);
      // 0.10 + 0.90d, not 0.3 + 0.7d. At the old mapping the three duty tiers
      // landed at 0.41 / 0.66 / 1.00 before tone mapping, and ACES pulled the
      // top two close enough together that low, mid and high read as one
      // brightness with noise on it. This is 0.24 / 0.57 / 1.00 — the same
      // brightest tube, a genuinely dimmer low one.
      const lit = on * (0.10 + 0.90 * d);
      [tb.userData.culture, tb.userData.capMat].forEach(function (mt) {
        const sh = mt && mt.userData.shader;
        if (!sh) return;
        sh.uniforms.uSeat.value = seat;
        sh.uniforms.uLit.value = lit;
        if (sh.uniforms.uThin) sh.uniforms.uThin.value = 1 - 0.88 * seeThru;
        if (sh.uniforms.uT) sh.uniforms.uT.value = clock + tb.userData.ci * 0.7 + tb.userData.ri * 1.3;
      });
      // Alpha is the only lever here that cannot saturate. Brightness inside
      // the culture does: the emissive was swept 9.9 -> 4.2 and the three tiers
      // moved by two counts, because everything the culture adds at mid is
      // already past the tone curve's knee and high lands in the same place.
      // How MUCH culture there is to see is a multiply on the finished
      // fragment, so it scales the diffuse and the emissive together and holds
      // all the way down.
      const alphaLit = 1 - dutyAct * (1 - (0.34 + 0.66 * lit));
      tb.userData.culture.opacity = CULTURE_OPACITY * (1 - 0.86 * seeThru) * alphaLit;
      // The dose act is three brightnesses side by side, and it was not reading
      // as three: measured on the liquid column alone, low/mid/high came out
      // 132 / 215 / 213 — the top two identical. The reason is that a cream
      // culture lit by the room is the same cream whatever its LED is doing,
      // and the room was most of it; dropping the culture's emissive from 9.9
      // to 4.2 moved the measurement by two counts. So for this act the room's
      // share is taken down and the emitter's share is what is left.
      const cm = tb.userData.culture;
      const roomOff = 1 - 0.74 * dutyAct;
      cm.color.copy(cm.userData.col0).multiplyScalar(roomOff);
      cm.envMapIntensity = cm.userData.env0 * roomOff;
      // The wall is what you actually see the glow through: its Fresnel rim
      // takes the culture's colour, which is the bright outline a lit tube has
      // and the thing that stops the broth reading as a painted cylinder.
      if (tb.userData.glass) {
        // The wall's BRIGHTNESS has to follow the emitter too, not just its
        // hue. `c = uTint * (0.35 + 0.9f)` in the glass shader is the same for
        // every tube however hard its LED is driven, so the three lifted tubes
        // in the dose act had identical bright walls and only differed inside —
        // which is why low/mid/high measured 1 : 1.78 : 1.77 and the top two
        // were indistinguishable however the culture was lit. Scoped to that
        // act, so no other act's glass changes.
        const tintLit = 1 - dutyAct * (1 - (0.26 + 0.74 * lit));
        tb.userData.glass.uniforms.uTint.value
          .copy(srgb(0xcfe2f2)).lerp(srgb(HUE[ch.hue]), 0.75 * seat * lit)
          .multiplyScalar(tintLit);
        tb.userData.glass.uniforms.uSpec.value = (1.0 + 1.1 * seat * lit) * (1 - 0.72 * seeThru);
        tb.userData.glass.uniforms.uMin.value = 0.030 * (1 - 0.78 * seeThru);
        tb.userData.glass.uniforms.uMax.value = 0.720 * (1 - 0.82 * seeThru);
      }
    });

    /* --- act 2: inside the tube --- */
    const inside = 0;   // the pull-out is gone; the tubes come down instead
    scatterCells.visible = inside > 0.02;
    if (scatterCells.visible) {
      const sd = scatterCells.userData.seed, n = scatterCells.count;
      for (let i = 0; i < n; i++) {
        const s0 = sd[i * 4], s1 = sd[i * 4 + 1], s2 = sd[i * 4 + 2], s3 = sd[i * 4 + 3];
        const a2 = s0 * 6.2831, r = 5.2 * Math.sqrt(s1);
        const rise = ((clock * 0.03 + s2) % 1);
        _p.set(Math.cos(a2 + clock * 0.05) * r, Math.sin(a2 + clock * 0.05) * r, 4 + rise * 40);
        _q.setFromAxisAngle(new THREE.Vector3(0.3, 1, 0.2).normalize(), s3 * 6.283 + clock * 0.3 * s0);
        _m.compose(_p, _q, _s.set(1, 1, 1));
        scatterCells.setMatrixAt(i, _m);
      }
      scatterCells.instanceMatrix.needsUpdate = true;
      scatterCells.material.opacity = 0.85 * inside;
      // the switch: green for most of the act, then red at the end of it
      const toRed = ramp(p, B2 - 0.055, B2 - 0.015);
      scatterCells.material.emissive.copy(srgb(HUE.green)).lerp(srgb(HUE.red), toRed);
      scatterCells.material.emissiveIntensity = 0.15 + 0.55 * inside;
    }


    /* --- the opening's numbers, the duty-cycle traces, the closing line --- */
    // p-only (and clock-driven) DOM, shared with the video mode: js/hero.js.
    HP.dom(p, clock);

    /* --- act 4: the grid, with a label under each column --- */
    const gridAct = ramp(p, B3 - 0.02, B3 + 0.03) * (1 - ramp(p, B4 - 0.03, B4 + 0.01));
    // Each label sits just beyond the back row of its own column. The act is
    // shot straight down now, so the six columns project to six distinct x
    // positions and the labels line up over them — which is the point of the
    // overhead. (An earlier three-quarter framing bunched projected labels
    // against one edge, which is why this was a fixed legend row for a while.)
    CHANNELS.forEach(function (ch, ci) {
      const a2 = gridAct * clamp01((gridAct * 7.5) - ci);
      // y 62, not 44. The block's top face reaches 45.23, so the labels were
      // landing ON the white and pale grey type on a cream plate is the one
      // place in either story where text has nothing behind it. Past the block
      // they sit on the dark housing and the background instead.
      _p.set(ch.x, 62, 146.5);
      place(colLabels[ci], _p, 0, -14, a2);
    });


    /* --- nothing is ghosted for the drive act any more: it is exploded --- */

    /* --- act 6: the current path along the board --- */
    traceGlow.visible = driveAct > 0.02;
    if (traceGlow.visible) {
      traceGlow.children.forEach(function (g) {
        const lead = clamp01(sweep - (g.userData.ci >> 1));
        g.material.opacity = 0.85 * lead * driveAct;
      });
    }


    // A green curtain behind the instrument, all the way through. It eases off
    // a little for the acts shot from inside the array, where at full strength
    // it only adds haze at the frame edges.
    composer.uniforms.uAurCol.value.copy(srgb(AURORA.col));
    composer.uniforms.uAurGamma.value = AURORA.gamma;
    composer.uniforms.uAurora.value = AURORA.base *
      (1 - AURORA.dip * ramp(p, B1 - 0.02, B1 + 0.09) * (1 - ramp(p, B6 + 0.02, B7 - 0.02)));

    if (air) {
      air.material.uniforms.uT.value = clock * 0.5;
      // Up on the wide acts, down to almost nothing once the camera is inside
      // the array, where motes in front of a lit tube read as noise.
      const wide = Math.max(1 - ramp(p, B1 - 0.02, B1 + 0.05), ramp(p, B5, B5 + 0.06));
      air.material.uniforms.uOpacity.value = 0.26 * (0.16 + 0.84 * wide);
    }
    // The callout list is built before the render because the rim it drives is
    // part of the 3D frame; the 2D tags go on afterwards, over the top.
    const coItems = calloutsAt(p);
    for (let i = 0; i < RIMMED.length; i++) RIMMED[i].userData._rim.uniforms.uAmt.value = 0;
    for (let i = 0; i < coItems.length; i++) {
      const r = coItems[i].mesh.userData._rim;
      // 0.62, not 0.78: on black filament the rim is the brightest thing on
      // a part, and at 0.78 the assembly act's housing went mint along every
      // upper face rather than along its edges.
      if (r) r.uniforms.uAmt.value = 0.62 * coItems[i].a;
    }
    composer.render(scene, camera, p * 151.0);
    // After the render: the camera matrices are settled, and the layer is its
    // own 2D canvas over the top, so nothing here touches the 3D pass.
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

  window.__dp = {
    tune: TUNE, composer: composer, renderer: renderer, key: key, aurora: AURORA,
    parts: function () { return { leds: leds, tubes: tubes, cones: cones, traceGlow: traceGlow, air: air }; },
    scene: scene, camera: camera, anchors: A,
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
    rig: rig,
  };

  story = Story(HP.storyConfig(draw));
  resize();
})();
