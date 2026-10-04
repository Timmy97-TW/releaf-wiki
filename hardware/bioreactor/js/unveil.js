// Commercial bioreactor — the unveil.
//
// One continuous camera move, twenty seconds: a macro on the lit nameplate, a
// pull back to the whole tower while it turns to three-quarters and holds
// there, the front panel coming away, a push inside, a right-to-left pan that
// names each part and leaves the name up, and a pull back out to the wide.
//
// Rendering: RQ.studioEnv painted through PMREM, ACES tone mapping, real
// transmission for glass rather than alpha, and a hard key against a quiet
// environment — see the note on the light rig for why that ordering is what
// makes a black case read as black. Geometry and colour come from product/, so
// what turns here is the measured model, not a stand-in.
//
// The camera runs on a spline through keyframes rather than eased segments
// between them. Segment easing decelerates into every key and accelerates out,
// which reads as a series of moves; a spline holds velocity through the keys,
// so the zoom, the turn and the pan are one gesture. A hold is expressed by
// repeating a key, not by stopping the clock — and even a hold keeps a slow
// creep, because a truly static frame reads as a stall.
//
// `data-cut` on the canvas picks which version plays. Three of them are windows
// onto this same timeline, so there is one film to keep right and the shorter
// pieces cannot drift out of sync with it; `orbit` is the one that needs its own
// path, because a loop has to end where it started and this one does not.
//
//   full      20.0s  the whole piece (default)
//   sting      3.3s  the macro logo strike, black to a lit plate
//   reveal     5.2s  dim to the hero three-quarter, ends on the card
//   interior  11.2s  panel away, the labelled pan, pull out
//   orbit     14.0s  a closed-tower turntable, the only one that loops
(function () {
  "use strict";

  const canvas = document.getElementById("unveil-gl");
  if (!canvas || typeof THREE === "undefined" || !window.PackedModel) return;

  const DIR = canvas.getAttribute("data-model") || "../../hardware/bioreactor/product/";
  const stage = canvas.parentElement;
  const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = reducedMQ.matches;

  const CUT = canvas.getAttribute("data-cut") || "full";
  // [start, end] in master-timeline seconds. `orbit` has no window; it runs its
  // own analytic path instead.
  const WINDOWS = {
    full:     [0.0, 20.0],
    // Each of these used to end mid-move or mid-fade: `reveal` froze on a hero
    // card at 42% opacity, and `sting` cut away while the camera was still
    // pulling. They now land on states the master timeline actually holds.
    sting:    [0.0, 3.35],   // black to a lit plate, and a beat on it
    reveal:   [3.2,  8.4],   // dim to the hero, ending on the built card
    interior: [8.8, 20.0]    // panel away through the labelled pan and out
  };
  const WIN = WINDOWS[CUT] || WINDOWS.full;
  const IS_ORBIT = CUT === "orbit";
  // The power-on scene. Its own path rather than a window onto the master
  // timeline: it is a macro on the screen from a standing start, and none of
  // the film's camera passes anywhere near that.
  const IS_BOOT = CUT === "boot";
  // The long scripted piece. Its own clock and its own keys — see "The story
  // cut" below for why it is not a window onto the master timeline.
  const IS_STORY = CUT === "story";
  // The field-setup screen is opt-in per page: it replaces the nameplate on the
  // front panel, which is what the film's first three seconds are pointed at.
  // The boot scene IS the screen, so it implies it.
  const SCREEN = canvas.hasAttribute("data-screen") || CUT === "boot" || CUT === "story";
  // Only the turntable loops. The others end somewhere the camera did not
  // start, so looping them would be a cut, not a loop.
  const LOOPS = IS_ORBIT;

  /* ---------- the parts the pan names ----------
     Body keys and names both come from product/palette.json, not invented
     here: six are marked `seen` (read off the team's own render) and "Pump
     enclosure" is `shape`. Swapping one is a single line and nothing else in
     the file needs to know. Screen-right on this face is decreasing CAD y, so
     the column sits right and the pump sits left. */
  // Seven parts, in the order the camera passes them (right to left across the
  // frame). `off` is where the tag sits relative to the part, in pixels at a
  // 1280-wide frame; `anchor` says which edge of the tag that point is. The tag
  // rides with the part rather than parking at the side of frame, and once it
  // is up it stays up — the reference clip builds a labelled diagram as it
  // travels, which reads far better than one label at a time.
  const BEATS = [
    { key: "Part 1|19",  n: "01", title: "Membrane column", off: [ 62, -40], anchor: "l" },
    { key: "Part 1|66",  n: "02", title: "Reservoir bottle", off: [ 66,  40], anchor: "l" },
    { key: "Part 1|47",  n: "03", title: "Wash bottle",     off: [ 56, -56], anchor: "l" },
    { key: "Part 2|62",  n: "04", title: "Vessel cap",      off: [-78, -44], anchor: "r" },
    { key: "Part 1|113", n: "05", title: "Culture vessel",  off: [ 62, 110], anchor: "l" },
    { key: "Part 1|3",   n: "06", title: "Vessel stand",    off: [-104, 30], anchor: "r" },
    { key: "Box|100",    n: "07", title: "Pump enclosure",  off: [-126, -12], anchor: "r" },
  ];

  /* ---------- renderer ---------- */
  // preserveDrawingBuffer costs a full framebuffer copy per frame on some
  // drivers and the only consumer is the still-capture workflow, which reads
  // pixels back out of the canvas. Off unless asked for.
  const CAPTURE = /[?&]capture=1/.test(location.search) || canvas.hasAttribute("data-capture");
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: false, preserveDrawingBuffer: CAPTURE
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 12000);

  // Onshape is Z-up; the root turns so an Onshape (x,y,z) lands at (x, z, -y)
  // and the tower's front panel faces +Z. Every coordinate below is written in
  // Onshape space and passed through S().
  // The camera looks along +X, not -Y. The body called "FRONT PANEL" faces -Y,
  // but that is the narrow 215mm end: side-on, the machine reads as a slab. The
  // face that shows the build — pump left, vessels and column right — is the
  // 378mm X face, which is exactly the view the team's own render uses and the
  // panel their render takes off. Naming in the CAD is not a camera direction.
  const YAW0 = -Math.PI / 2;               // camera sits at -X looking toward +X
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  scene.add(root);
  // The turn is done by the camera, not the model — a turning model swings its
  // own shadow and reflections with it, which reads as the room moving. This
  // group is kept as the single parent for every body so the panel, the plate
  // and the machine all share one frame.
  const spin = new THREE.Group();
  root.add(spin);
  // S() converts an Onshape point to WORLD space, for the camera to aim at.
  // Anything parented under root is already inside that rotation, so its own
  // position stays in Onshape coordinates — passing S() there applies the
  // rotation twice, which is how the nameplate ended up 452mm behind the tower.
  function S(x, y, z) { return new THREE.Vector3(x, z, -y); }

  if (window.RQ && RQ.studioEnv) scene.environment = RQ.studioEnv(renderer);
  // Three-point rig referred to the CAMERA, not to the model's own axes. The
  // camera looks along +X for the whole film, so the face it sees has normal
  // (-1,0,0) in world space. The key used to sit at (180,420,320): normalised
  // that is (0.32,0.75,0.57), which dots to -0.32 against that face — three.js
  // clamps it to zero, so the 1.2 key was a pure backlight at every camera in
  // the film and the only direct light on the principal face was a 0.24 rim.
  // Every brightness measurement taken to justify that key was really measuring
  // the floor. The key now sits on the camera side, high and to frame-right
  // (world +Z is screen right on this view), where it dots +0.52 against the
  // front face and +0.74 against the top. It is far out along that direction
  // rather than near the model, because a DirectionalLight's shadow camera sits
  // AT light.position and the old radius put it inside the machine.
  const key = new THREE.DirectionalLight(0xfff4e8, 0.85);
  key.position.set(-1280, 1840, 1040); scene.add(key);
  // A genuine back-left rim: behind the subject, so it draws the silhouette
  // edge rather than adding another wash to the front.
  const rimA = new THREE.DirectionalLight(0xbdd2ec, 0.30);
  rimA.position.set(760, 420, -1100); scene.add(rimA);
  // and a low back-right kicker
  const rimB = new THREE.DirectionalLight(0xf3dccb, 0.16);
  rimB.position.set(820, 180, 1150); scene.add(rimB);

  // Inside the case nothing reaches the parts: the shell blocks the key and the
  // rims, and the environment only lights what can see the room. A fill that
  // rides in with the camera is what makes the interior readable instead of a
  // grey aquarium.
  // Nearly neutral and modest: at 1.15 and #bfd8ff it was reading a measured
  // #363636 shroud out at rgb(125,140,155) — brighter than the vessels and
  // visibly blue, so the nearest surface to the lens became the subject.
  const fill = new THREE.PointLight(0xd6dee8, 0.0, 2600, 1.5);
  scene.add(fill);

  /* ---------- materials from the measured palette ---------- */
  // The vendored r128 has no ColorManagement, so a THREE.Color is consumed as
  // LINEAR while outputEncoding re-encodes to sRGB on the way out. Handing it
  // an sRGB hex directly makes every surface far too bright: #171717 is 0.0902
  // as sRGB against a true linear 0.0086, so a black case was being fed an
  // albedo 10x too light — which is exactly why it kept photographing grey and
  // why the environment had to be suppressed to compensate. The repo already
  // has the idiom in js/deck3d.js.
  function hexColor(h) { return new THREE.Color(h).convertSRGBToLinear(); }

  // The case does not take its colour from the palette. Half of it is
  // "inferred-cad" — including the very panel this film opens on, which had no
  // pixels to measure precisely because the team's render is the one with that
  // panel taken off — and the CAD paints those #4d4d4d. The real tower is black
  // with grey trim, which is what roles.json already records, so the role picks
  // the colour and nothing here depends on a guess the CAD made.
  // Neutral, not cool — the tint belongs in the light, not the paint. These are
  // sRGB and are converted on the way in, so they are readable as what a
  // camera would see: black anodised panels sit around #3a3a3a, which is the
  // ~5% reflectance real black paint has. They were set as low as #171717 while
  // the colour pipeline was feeding sRGB values in as linear; at 0.86%
  // reflectance that is darker than any paint that exists, and with the
  // encoding fixed the case went to silhouette. The measured palette had it
  // right all along (#424242 / #414142 for the shell) — the pipeline was wrong,
  // not the measurement.
  const CASE_COLOUR = {
    caseShell: 0x3a3a3a,   // panels
    caseFrame: 0x313131,   // brackets
    caseRail:  0x272727,   // extrusion
    caseTrim:  0x9ea0a2,   // handle, panel pins, drive bay
    caseSteel: 0xa2a6a9,   // fasteners
    box:       0x333333,
    boxLid:    0x333333,
    boxFront:  0x3a3a3a
  };
  function makeMaterial(entry) {
    const glass = !!(entry && (entry.transparent || entry.opacity < 0.99));
    const col = hexColor((entry && (entry.shaded || entry.colour)) || "#8a8f96");
    if (glass) {
      // Transmission, not alpha: alpha-blended glass has no refraction, sorts
      // badly against everything behind it, and goes muddy the moment two
      // sheets overlap — which in a vessel with a probe in it is constantly.
      //
      // In r128 transmission is a Fresnel-driven alpha multiply, not refraction,
      // so the diffuse lobe is composited straight over whatever is behind the
      // vessel. Four of these bodies measure #e6e6e6; at full albedo that put a
      // white haze over the machine and the vessels read as lit grey solids.
      // The albedo is crushed to a tint and the measured opacity — which until
      // now only selected this branch and was then thrown away — sets how
      // transmissive each body actually is.
      const op = (entry && entry.opacity !== undefined) ? entry.opacity : 0.08;
      return new THREE.MeshPhysicalMaterial({
        color: col.clone().multiplyScalar(0.45),
        metalness: 0, roughness: 0.10,
        transmission: Math.min(0.95, Math.max(0, 1 - op)),
        // No `thickness`: the vendored r128 has transmission and ior but volume
        // only landed in r129, so setting it did nothing except warn.
        ior: 1.46,
        // clearcoat's indirect specular feeds the same term transmission adds
        // to alpha, and at 1.0 it saturated into opaque white rims at grazing
        // incidence — the opposite of glass
        clearcoat: 0.55, clearcoatRoughness: 0.06,
        envMapIntensity: 0.7
      });
    }

    // The case is black, and the measured palette says so (#1e1e1e, #363636).
    // What makes it read grey is the studio environment: a near-black albedo
    // under a bright IBL is mostly showing you the room. The shell gets a
    // fraction of the environment so it keeps its sheen and its colour; the
    // machine inside keeps the full amount, which is what separates them.
    const isCase = !!entry && entry.group === "case";
    const caseHex = isCase ? CASE_COLOUR[entry.role] : undefined;
    const trim = entry && (entry.role === "caseTrim" || entry.role === "caseSteel");
    const sat = entry && entry.sat > 0.25;
    return new THREE.MeshPhysicalMaterial({
      color: caseHex !== undefined ? hexColor(caseHex) : col,
      metalness: trim ? 0.72 : (isCase ? 0.06 : (sat ? 0.22 : 0.12)),
      // Tighter than it was (0.28 / 0.58): a broad highlight on a near-black
      // panel is just a slightly-less-black panel. Narrowing it is what turns
      // the light into an edge you can see.
      roughness: trim ? 0.18 : (isCase ? 0.42 : 0.52),
      clearcoat: isCase && !trim ? 0.3 : 0.6,
      clearcoatRoughness: isCase && !trim ? 0.10 : 0.2,
      // Black paint still has a sheen; it just must not be handed the whole
      // room. Trim is metal and keeps the environment it needs to read as metal.
      // Glass returned above and keeps the full environment. 0.9 on an opaque
      // core part turned a measured #363636 shroud into a near-white slab that
      // pulled the eye off the vessels — it was showing you the studio, not
      // the part. Trim is the exception in the other direction: the handle and
      // the fasteners are the only bright things on a black machine, and they
      // have to earn the frame's top end on their own.
      envMapIntensity: trim ? 1.7 : (isCase ? 0.20 : 0.46)
    });
  }

  /* ---------- the ground ----------
     The reference frame has a floor, and it is doing more than decoration: it
     gives the tower somewhere to stand, catches a little of the key light so
     the silhouette has a base, and its grid gives the eye a sense of scale and
     of the camera moving. It fades to nothing well before the frame edge, so
     the background stays black rather than becoming a visible plane. */
  function groundTexture() {
    const n = 1024, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    g.clearRect(0, 0, n, n);
    g.strokeStyle = "rgba(150,180,210,0.5)";
    g.lineWidth = 1.15;
    const step = n / 16;
    g.beginPath();
    for (let i = 0; i <= 16; i++) {
      const v = Math.round(i * step) + 0.5;
      g.moveTo(v, 0); g.lineTo(v, n);
      g.moveTo(0, v); g.lineTo(n, v);
    }
    g.stroke();
    // fade the grid out towards the edges so the plane has no visible border
    const fade = g.createRadialGradient(n / 2, n / 2, n * 0.06, n / 2, n / 2, n * 0.48);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(0.55, "rgba(0,0,0,0.55)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = fade;
    g.fillRect(0, 0, n, n);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;     // painted artwork, not data
    t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  function buildGround() {
    const size = 3400;
    // The floor fades out with the same falloff as the grid. Without it the
    // plane has a visible edge, and a hard horizon in the middle of a black
    // frame reads as a mistake rather than as space.
    const falloff = (function () {
      const n = 512, c = document.createElement("canvas");
      c.width = c.height = n;
      const g = c.getContext("2d");
      const r = g.createRadialGradient(n / 2, n / 2, n * 0.04, n / 2, n / 2, n * 0.46);
      r.addColorStop(0, "#ffffff");
      r.addColorStop(0.5, "#8a8a8a");
      r.addColorStop(1, "#000000");
      g.fillStyle = r; g.fillRect(0, 0, n, n);
      return new THREE.CanvasTexture(c);
    })();
    const mat = new THREE.MeshPhysicalMaterial({
      color: hexColor(0x05070a), metalness: 0.30, roughness: 0.34,
      envMapIntensity: 0.35,
      transparent: true, alphaMap: falloff, depthWrite: false
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    floor.position.set(0, 0, -13.5);      // Onshape: the feet sit at z = -13
    floor.receiveShadow = true;
    root.add(floor);

    // Tone-mapped, unlike the nameplate: the plate is a light source and should
    // keep its own whites through the exposure ramp, but the grid is a lit
    // plane, and holding it at constant brightness while the room came up made
    // it read as an overlay pasted onto the render.
    const gm = new THREE.MeshBasicMaterial({
      map: groundTexture(), transparent: true, opacity: 0.30,
      depthWrite: false, toneMapped: true
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(size, size), gm);
    grid.position.set(0, 0, -13.2);
    grid.renderOrder = 1;
    root.add(grid);
    return { mat: mat, gm: gm, floor: floor, grid: grid };
  }
  const ground = buildGround();

  /* ---------- the nameplate ----------
     The tower has no logo in the CAD, so one is drawn here and stood a
     fraction of a millimetre off the front panel. It is emissive, so it can be
     dark, flicker, and come up to full without touching the lighting rig. */
  function nameplateTexture() {
    // The film opens on a 200mm plate filling the frame, which is the one shot
    // in the whole piece that is nothing but letters — at 1024 they were
    // visibly soft. But 4096 costs about 15 MB of GPU memory once mipmapped,
    // which is a lot to spend on a phone that will never resolve it, so the
    // plate is sized to the display: it wants roughly two texels per device
    // pixel across the frame at the moment it fills it.
    const across = (window.innerWidth || 1280) * Math.min(window.devicePixelRatio || 1, 2);
    const w = across > 1700 ? 4096 : 2048;
    const S = w / 4096;                       // everything below is authored at 4096
    const h = Math.round(672 * S), c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    // Letter-spaced text has to be measured and fitted, not guessed: at 58px
    // with 26px of tracking "RELEAF · BIOREACTOR" runs past 1024 and the plate
    // reads "ELEAF · BIOREACTO".
    const fit = function (text, px, track, maxW) {
      let size = px, tr = track, total = 0;
      for (let pass = 0; pass < 24; pass++) {
        g.font = "600 " + size + "px ui-sans-serif, -apple-system, Segoe UI, sans-serif";
        total = 0;
        for (let i = 0; i < text.length; i++) total += g.measureText(text[i]).width + tr;
        total -= tr;
        if (total <= maxW) break;
        size *= 0.94; tr *= 0.94;
      }
      let x = w / 2 - total / 2;
      for (let i = 0; i < text.length; i++) {
        const cw = g.measureText(text[i]).width;
        g.fillText(text[i], x + cw / 2, h / 2 - 24 * S);
        x += cw + tr;
      }
      return total;
    };
    const span = fit("RELEAF \u00b7 BIOREACTOR", 248 * S, 120 * S, w - 384 * S);
    g.fillRect(w / 2 - span / 2, h / 2 + 160 * S, span * 0.40, 12 * S);
    g.fillRect(w / 2 + span / 2 - span * 0.40, h / 2 + 160 * S, span * 0.40, 12 * S);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;     // painted artwork, not data
    t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  /* ---------- load ---------- */
  const bodies = [];         // { key, group, mats, isCase, box }
  const byKey = {};
  let frontPanel = null, plate = null, allBox = new THREE.Box3(), ready = false;
  let screenGroup = null, sidePlate = null;
  // Colours in this file go through RQ.srgb where it exists; hexColor() is the
  // local equivalent, so hand the screen module the same converter.
  const srgbFn = function (h) { return hexColor(h); };

  let CAD_MATS = [];
  Promise.all([
    fetch(DIR + "palette.json").then(function (r) { return r.json(); }),
    PackedModel.load(DIR, function (d, t) {
      const el = document.getElementById("unveil-load");
      if (el) el.textContent = Math.round((d / t) * 100) + "%";
    }),
    // The CAD's own per-material table. palette.json is measured per PART, so
    // wherever one part is several shells with different appearances it
    // averages them into one colour — see the membrane column in storyBuild().
    // Nothing reads this unless a cut asks for it.
    fetch(DIR + "cad-materials.json").then(function (r) { return r.json(); })
                                     .catch(function () { return []; })
  ]).then(function (res) {
    const pal = {};
    res[0].forEach(function (p) { pal[p.part] = p; });
    CAD_MATS = res[2] || [];
    res[1].groups.forEach(function (g) {
      const e = pal[g.part];
      let b = byKey[g.part];
      if (!b) {
        b = { key: g.part, group: new THREE.Group(), mats: [],
              isCase: !!e && e.group === "case", label: (e && e.label) || g.part };
        spin.add(b.group);
        bodies.push(b); byKey[g.part] = b;
      }
      const m = makeMaterial(e);
      m.userData.base = m.color.clone();   // the recede multiplies this, not alpha
      b.mats.push(m);
      const mesh = new THREE.Mesh(g.geometry, m);
      mesh.userData.mat = g.mat;          // which CAD material this shell wears
      (b.meshes || (b.meshes = [])).push(mesh);
      b.group.add(mesh);
    });

    bodies.forEach(function (b) {
      b.box = new THREE.Box3().setFromObject(b.group);
      allBox.union(b.box);
      // the near panel on the camera side, the one the team's render removes
      if (b.key.indexOf("LEFT_PANEL_4-SLOT") === 0) frontPanel = b;
    });

    // nameplate, standing just proud of the front panel
    const tex = nameplateTexture();
    // Face the plate at -X and roll it so its width runs along Onshape y (across
    // that face) and its height along z (up). rotateY(-90) puts the normal on
    // -X with the width on z; the extra rotateX(+90) swaps width and height
    // into the axes the panel actually uses.
    const geo = new THREE.PlaneGeometry(196, 32);
    geo.rotateY(-Math.PI / 2);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 1,
      color: 0xffffff, depthWrite: false, toneMapped: false
    });
    plate = new THREE.Mesh(geo, mat);
    plate.position.set(-114.6, -8, 455);   // Onshape coordinates: inside root
    plate.renderOrder = 5;
    // It is printed on the panel, so it leaves with the panel. Parented to spin
    // it stayed hanging in mid-air over the open machine for the whole pan.
    (frontPanel ? frontPanel.group : spin).add(plate);
    plateMat = mat;

    /* ---------- the field-setup screen (opt-in) ----------
       Off unless the page asks for it. The film's opening beat is a macro on
       the nameplate above, and the screen occupies the same face — so turning
       this on is a decision about the film, not a detail. With it on, the
       nameplate moves to the side of the case and the front panel is the
       screen. See hmi-screen.js for why it is a bezel rather than a cut hole. */
    if (SCREEN && window.HMI) {
      const hmi = HMI.build({ at: [-113, -8, 428], srgb: srgbFn, scale: 5 });
      (frontPanel ? frontPanel.group : spin).add(hmi);
      screenGroup = hmi;

      // The mark moves to the -y side of the case. That face's outward normal
      // is -y, and a plane rotated +90 about x lands width on +x and height on
      // +z with the normal on -y — a right-handed basis, so the type is not
      // mirrored. (+y would need the artwork flipped.)
      const sideGeo = new THREE.PlaneGeometry(150, 24);
      sideGeo.rotateX(Math.PI / 2);
      const sideMat = new THREE.MeshBasicMaterial({
        map: nameplateTexture(), transparent: true, opacity: 1,
        color: 0xffffff, depthWrite: false, toneMapped: false
      });
      sidePlate = new THREE.Mesh(sideGeo, sideMat);
      sidePlate.position.set(0, -187.2, 470);
      sidePlate.renderOrder = 5;
      (frontPanel ? frontPanel.group : spin).add(sidePlate);
      // and the front nameplate goes away, because the screen is there now
      plate.visible = false;
    }

    // Link each beat to its body. This has to happen here, not where BEATS is
    // declared: byKey is empty until this callback runs, so the association
    // made up there silently bound nothing and every named part stayed dimmed
    // exactly as far as the plumbing at the moment it was named.
    BEATS.forEach(function (b) {
      const body = byKey[b.key];
      if (body) body.beat = b;
      else console.warn("[unveil] no body for beat", b.key);
    });

    // shadowAll only marks the meshes; without enableShadows the renderer's
    // shadow map is off and none of it renders. The film ran that way, which is
    // why the tower sat on the floor without touching it — the dark patch under
    // it was the floor's own falloff, not a shadow. With the key now doing the
    // shaping, a real contact shadow is what grounds the object.
    if (window.RQ && RQ.shadowAll) RQ.shadowAll(scene);
    if (window.RQ && RQ.enableShadows) {
      // The floor already sets receiveShadow where it is built; shadowAll only
      // walks meshes and skips transmissive ones, so the glass does not block.
      RQ.enableShadows(renderer, key, 620);
      if (RQ.fitShadow) RQ.fitShadow(key, spin);
      // shadowAll walks the whole scene, so it also flagged the two 3400mm
      // ground planes and the nameplate. The grid sits 0.3mm above the floor
      // and would drop a full-size slab across the frame; the plate would cast
      // a hard 196x32mm block onto the panel it is printed on.
      ground.floor.castShadow = false;
      ground.grid.castShadow = false;
      plate.castShadow = false;
      // Nothing in this scene moves except the front panel and the case's own
      // ghosting, so the shadow map does not need rebuilding 60 times a second
      // against 113 casters. It is rendered on demand instead — see
      // shadowState() in render().
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
    }

    // After the shadow pass on purpose. shadowAll() walks every mesh and turns
    // casting on; the circuit and the fill set castShadow false for themselves,
    // and built before this they would simply have been overruled.
    if (IS_STORY) { storyBuild(); storyCallouts(); buildOutro(); buildDetail(); }

    ready = true;
    if (btn) { btn.disabled = false; setBtn(); }
    reducedMQ.addEventListener("change", function (e) {
      if (e.matches) pause();
      else if (!playing) play();
    });
    const el = document.getElementById("unveil-load");
    if (el) el.textContent = "";
    resize();
    render(0);
    if (!reduced) play();
  }).catch(function (e) {
    const el = document.getElementById("unveil-load");
    if (el) el.textContent = "model unavailable";
    console.error("[unveil]", e);
  });
  let plateMat = null;

  /* ---------- camera spline ----------
     Catmull-Rom in (target, distance, yaw, pitch, fov). Repeat a key to hold. */
  // A 601mm tower at 26 degrees needs about 1450mm to sit in frame with air
  // around it; the width never binds, the height always does.
  //
  // The turn is held, not returned. Rotating out to 45 and straight back made
  // the move read as a flourish that undid itself; holding the three-quarter
  // through the hero, the label and the panel coming away means the angle is
  // the shot, and squaring up only as the camera goes inside gives the pan a
  // reason to straighten. Interior distances are deliberately long — close
  // enough to read a part, far enough to keep its neighbours in frame so you
  // can see where it sits.
  const K_MAIN = [
    // t     target (Onshape)          dist  yaw            pitch  fov
    [0.0,  S(-114, -8, 452),             88, YAW0 + 0.00,   0.02,  20],   // black
    [1.2,  S(-114, -8, 452),            102, YAW0 + 0.02,   0.03,  20],   // logo struck
    [2.1,  S(-113, -8, 450),            152, YAW0 - 0.02,   0.04,  21],   // drifting back
    [3.0,  S(-110, -8, 446),            300, YAW0 - 0.08,   0.05,  23],   // whole plate reads
    // A beat on the full plate for the `sting` cut to land on. Not a true
    // hold: a near-static key followed by the pull-back made the camera go from
    // 60mm/s to 346mm/s across one knot, which measured 1,924mm/s^2 — the
    // biggest tick in the film. It eases instead.
    [3.35, S(-110, -8, 444),           355, YAW0 - 0.10,   0.05,  23],
    [4.0,  S(-80, 0, 400),              560, YAW0 - 0.26,   0.08,  25],   // tower emerging
    [5.2,  S(0, 0, 312),                980, YAW0 - 0.56,   0.11,  26],
    [6.3,  S(0, 0, 300),               1330, YAW0 - 0.79,   0.13,  26],   // 45 degrees
    // The wides were all too tight: measured at 1465 the near foot sits ~16px
    // off the bottom of a 1080p frame and the tower is clipped top and bottom,
    // so "zoom out until the whole bioreactor is in view" never actually
    // happened. +13% puts the whole machine inside the frame with floor under
    // it at every wide in the film.
    [7.6,  S(0, 0, 296),               1600, YAW0 - 0.79,   0.12,  26],   // hero, card in
    [9.0,  S(0, 0, 294),               1650, YAW0 - 0.79,   0.11,  26],   // hero hold
    [10.2, S(-40, -14, 300),           1470, YAW0 - 0.76,   0.10,  26],   // panel away
    // The interior sits closer than the wides but still holds the whole core:
    // at 700mm and fov 27 the frame is 598mm wide by 336 tall, and the parts
    // span 378 x 331, so nothing is cropped and the machine fills two thirds of
    // frame instead of half. The target sweep is monotonic from the push-in
    // onward — it used to drift right for 1.4s before reversing, which put a
    // velocity reversal under the first two labels.
    [11.5, S(-16, -70, 300),            820, YAW0 - 0.30,   0.07,  27],   // squaring up
    [12.9, S(-10, -62, 302),            716, YAW0 - 0.12,   0.05,  27],   // right
    [14.8, S(-8, -6, 300),              700, YAW0 - 0.01,   0.05,  27],   // centre
    [16.7, S(-12, 58, 302),             712, YAW0 + 0.08,   0.05,  27],   // left
    // The close lands on the hero's own three-quarter angle and stops there:
    // the last key repeats the one before it, which drives the terminal tangent
    // to zero so the film settles rather than being cut off mid-gesture.
    [18.0, S(-6, 16, 292),             1120, YAW0 - 0.24,   0.08,  26],   // pull out
    [18.9, S(-2, 6, 292),              1420, YAW0 - 0.52,   0.10,  26],
    [19.5, S(0, 0, 294),               1580, YAW0 - 0.70,   0.11,  26],
    [20.0, S(0, 0, 294),               1650, YAW0 - 0.79,   0.11,  26],   // held
  ];

  // A turntable of the closed tower. Not a keyframe table: a constant-rate turn
  // is exactly what it should be, and expressing it analytically makes the loop
  // seam mathematically identical rather than merely close. The breathe on
  // distance and pitch completes exactly one cycle over the loop, so it is
  // seamless too.
  const ORBIT_DUR = 14.0;
  function orbitPose(time) {
    const u = (time % ORBIT_DUR) / ORBIT_DUR, a = u * Math.PI * 2;
    return {
      target: S(0, 0, 294 + 6 * Math.sin(a)),
      dist: 1650 + 46 * Math.sin(a),   // matches the wides in `full`
      yaw: YAW0 - 0.79 - a,
      pitch: 0.11 + 0.028 * Math.sin(a),
      fov: 26
    };
  }

  // Power-on. Opens so close on the dark glass that there is nothing to see,
  // holds while the logo strikes, then pulls back until the screen sits in its
  // bezel on the panel. Distances are to the screen centre, not the machine's.
  const SCREEN_AT = S(-113, -8, 428);
  const K_BOOT = [
    // Framed so the mark is readable the moment it strikes. The first pass sat
    // at 150mm, where the frame is 69mm tall against a 160mm screen — the logo
    // filled the glass but the camera was inside it and you read "LEAF". The
    // pull-back now clears the whole screen by 2s and ends with it seated in
    // the panel. Rates are 58, 82, 73, 80, 81 mm/s, so it accelerates once and
    // then holds pace.
    // t     target      dist  yaw            pitch  fov
    [0.0,  SCREEN_AT,     250, YAW0 + 0.000,  0.000, 26],
    [1.0,  SCREEN_AT,     300, YAW0 + 0.004,  0.002, 26],
    [2.0,  SCREEN_AT,     372, YAW0 + 0.012,  0.006, 26],
    [3.4,  SCREEN_AT,     462, YAW0 + 0.024,  0.012, 26],
    [5.2,  SCREEN_AT,     600, YAW0 + 0.040,  0.020, 26],
    [7.0,  SCREEN_AT,     742, YAW0 + 0.054,  0.028, 26],
  ];


  /* ====================================================================== */
  /* The story cut                                                          */
  /* ====================================================================== */
  // A longer, scripted piece: power on -> the machine -> the farmer's four
  // choices -> the alarm -> the panel off -> the circuit running -> protectant
  // collecting. It is NOT a window onto the master timeline. The master film is
  // twenty seconds of one continuous pull-back, and this needs to go in, out and
  // in again with the screen changing state three times, so it carries its own
  // clock and its own keys. Everything the two share — model, materials, lights,
  // ground, screen — is shared; only the timeline is separate.
  const STORY_DUR = 37.0;

  const HERO_AT = S(0, 0, 296);
  const K_STORY = [
    // t     target                     dist  yaw            pitch  fov
    //
    // Every MOVE in this table is roughly a third shorter than it was; the
    // holds are untouched. A transition is time the viewer spends waiting for
    // the next thing, and at the first pacing the pull-out took 4.8 s, the push
    // back in 3.4, and the close 5.4 — nearly a quarter of the film was travel.
    // The beats that carry content (the four callouts, the alarm, the fill)
    // still get exactly as long as they did.
    [0.0,  SCREEN_AT,                    272, YAW0 + 0.000,  0.000, 26],  // black glass
    [1.15,  SCREEN_AT,                    296, YAW0 + 0.004,  0.002, 26],  // mark struck
    [1.95,  S(-102, -8, 424),             400, YAW0 - 0.12,   0.024, 26],
    [2.75,  S(-64, -4, 382),              790, YAW0 - 0.30,   0.058, 26],
    [3.55,  S(-10, 0, 318),              1210, YAW0 - 0.42,   0.092, 26],
    // The two keys either side of the hold stay — they are what stopped the
    // camera stopping and starting on one knot.
    [4.25,  S(-6, 0, 300),               1470, YAW0 - 0.47,   0.102, 26],  // easing in
    // A hold, not a freeze: 1600 -> 1662 and a degree of yaw over 1.2s is
    // imperceptible as a move and the difference between a live frame and a
    // still.
    [4.75,  HERO_AT,                     1600, YAW0 - 0.505,  0.105, 26],  // hero
    [5.95,  S(2, 0, 292),                1662, YAW0 - 0.487,  0.099, 26],  // hero hold
    [6.55,  S(-14, -4, 330),             1490, YAW0 - 0.46,   0.094, 26],  // easing out
    [7.45,  S(-52, -10, 372),             960, YAW0 - 0.32,   0.072, 26],
    [8.05,  S(-96, -8, 420),              700, YAW0 - 0.12,   0.030, 26],
    [8.55,  SCREEN_AT,                    632, YAW0 - 0.03,   0.012, 26],  // interface up
    [9.45, SCREEN_AT,                    618, YAW0 - 0.01,   0.010, 26],
    [14.85, SCREEN_AT,                    576, YAW0 + 0.00,   0.008, 26],  // creep through
    [16.05, SCREEN_AT,                    556, YAW0 + 0.00,   0.010, 26],  // alarm
    // The alarm held static for three full seconds. The camera leaves 0.6s
    // earlier and the interior gets the time instead.
    [17.05, SCREEN_AT,                    600, YAW0 - 0.02,   0.014, 26],
    // No intermediate key here, and that is deliberate. One was tried, to ease
    // the launch out of the alarm hold the way the hero hold needed — and it
    // made the tick nearly three times worse (2,992 mm/s^2 against 1,203),
    // because easing a HOLD is not the same problem as easing a TARGET MOVE.
    // The camera's aim swings 115 mm here, and splitting that into two shorter
    // legs raises the peak instead of lowering it. One long leg is smoother.
    [18.05, S(-40, -20, 340),             980, YAW0 - 0.26,   0.065, 26],  // pulling out
    [19.45, S(-14, -30, 302),            1210, YAW0 - 0.16,   0.055, 27],  // WIDE
    [21.65, S(-14, -42, 298),            1150, YAW0 - 0.10,   0.050, 27],  // circuit running
    [23.45, S(-22, -72, 262),             820, YAW0 - 0.05,   0.040, 27],  // starting in
    [25.45, S(-26, -95, 208),             545, YAW0 - 0.02,   0.022, 27],  // on the reservoir
    [26.85, S(-26, -95, 206),             536, YAW0 - 0.02,   0.020, 27],  // hold on the fill
    [28.25, S(-22, -70, 250),             760, YAW0 - 0.10,   0.040, 27],  // easing out
    // Pitched up to 0.16, where the close used to run nearly level at 0.094,
    // and aimed 130mm lower. The ending happens on the FLOOR: at the old pitch
    // the drop and the wet were both below frame. The pull also reaches its
    // width EARLY — 1740 by 31.3 — and then barely moves, so the crop comes up
    // in a held wide rather than under a travelling camera.
    [29.35, S(-12, -34, 250),            1360, YAW0 - 0.28,   0.116, 26],
    [30.55, S(-4, -12, 212),             1740, YAW0 - 0.38,   0.142, 26],
    [31.95, S(0, 0, 188),                1970, YAW0 - 0.44,   0.153, 26],
    // Decelerating across the last 1.5s rather than stopping dead against the
    // repeated final key. The close used to do 640 mm in 1.2 s and then stop —
    // 1,686 mm/s^2, the worst tick in the piece and right on the last shot.
    [33.45, S(0, 0, 174),                2110, YAW0 - 0.48,   0.160, 26],
    [34.45, S(0, 0, 169),                2165, YAW0 - 0.497,  0.161, 26],
    // The camera is done by 35.4 and the last 1.6s is a hold on the mark: it
    // creeps 6mm to 36.4 and is then genuinely still, because the final two
    // keys are identical. A frozen CAMERA is right under a title card — but a
    // frozen FRAME would look like the video buffered, and it isn't one: the
    // crop is still swaying, the dust is still drifting, and the exposure is
    // still easing down until 36.4.
    [35.40, S(0, 0, 168),                2180, YAW0 - 0.503,  0.161, 26],
    [36.40, S(0, 0, 167),                2186, YAW0 - 0.505,  0.161, 26],
    // Last key repeated so the terminal tangent is zero and the film settles
    // instead of being cut off mid-move.
    [37.00, S(0, 0, 167),                2186, YAW0 - 0.505,  0.161, 26]
  ];

  // ---- the schedule, all in story seconds --------------------------------
  const ST = {
    // Was 0.95, which left the first second of the film as an entirely black
    // frame. The camera also starts further back so the mark is whole by 1.2s
    // instead of running off both edges until 2.4.
    strike:    0.35,   // the mark catches
    uiSwitch:   8.25,  // logo -> the farmer's interface
    label0:     9.45,  // first callout
    labelGap:   1.45,  // and the cadence after it
    alarm:     15.45,  // interface -> STRESS DETECTED
    panel:  [18.25, 19.85],
    // The tubing is up and full BEFORE the panel starts to move. It is behind
    // the panel, so nobody watches it arrive — and when the panel clears, the
    // circuit is simply there, the way plumbing that was always inside the
    // machine would be.
    tubes:  [16.85, 18.05],
    aura:   [18.85, 20.55],
    // What runs THROUGH the tubing is the thing that starts, and it starts
    // after the reveal has been allowed to land.
    flow:   [21.15, 22.55],
    fill:   [22.45, 27.05],
    bottleTag: 24.25,   // "protectant produced", once the camera is on it
    out:      28.25,    // the camera lets go
    mark:     33.05,    // and the closing mark comes up
    // Seven seconds from the camera letting go to the last frame. Nothing
    // starts before 30.05, because nothing before that is on screen: the
    // camera is still on the reservoir at 29 and only clears the floor into
    // frame around 30.1.
    outro: {
      drop:   [29.30, 29.70],
      pool:   [29.67, 32.45],   // the hit, then the wet spreading out from it
      // Only [0] is read: each clump adds its own radius-staggered delay and
      // takes 1.15s to come up, so the last one is standing at 33.5.
      plants: [30.25, 32.80]
    }
  };

  function storyExposure(t) {
    // Lowest at the top, exactly as the boot scene opens — the screen is drawn
    // toneMapped:false so it keeps its own whites while the room is still at 3%,
    // which is what makes the strike read as a light coming on in the dark.
    if (t < 0.3) return 0.03;
    if (t < 1.05) return 0.03 + 0.27 * ramp(t, 0.3, 1.05);
    if (t < 4.25) return 0.30 + 0.70 * ramp(t, 1.05, 4.25);
    // Down for the alarm so the red screen is the brightest thing in frame, and
    // it stays down for the interior, where the aura has to read as light in the
    // air rather than as a green tint on an already-bright machine.
    if (t < ST.alarm) return 1.0;
    if (t < ST.panel[0]) return 1.0 - 0.42 * ramp(t, ST.alarm, ST.alarm + 0.9);
    // and back up once the panel is off — the alarm's level left the opened
    // machine as a black rectangle for a second and a half before the aura
    // arrived, which is a hole in the middle of the reveal.
    const open = 0.58 + 0.24 * ramp(t, ST.panel[0], ST.panel[0] + 1.7);
    // then down again over the close, so the last thing lit is the mark
    return open * (1 - 0.42 * ramp(t, ST.mark + 0.4, STORY_DUR - 0.6));
  }

  // Same frustum slide as the master film, on this cut's own hero beat.
  // 0.16, not the master film's 0.26. The shift exists to clear the right of
  // frame for the card, but at 0.26 — with this cut's squarer hero angle — it
  // shoved the machine into the left edge and left a band of empty black
  // between subject and type. Less shift and less rotation put the two of them
  // in the same picture instead of at opposite ends of it.
  function storyShift(t) {
    // 0.10 for the hero, down from 0.16: less shift leaves the machine further
    // right, which closes the band of empty black between it and the card.
    // 0.24 for the close, up from 0.19: there the opposite was true — the mark
    // was sitting almost against the machine's edge and needed air.
    return 0.10 * ramp(t, 2.85, 4.45) * (1 - ramp(t, 6.15, 7.25))
         + 0.24 * ramp(t, ST.mark - 1.4, ST.mark + 0.4);
  }

  // The screen's own clock. Four states, and the two transitions between them
  // are cuts, not fades: a display that cross-dissolves between pages is a
  // slideshow, and this one is meant to be a machine changing its mind.
  function storyScreen(t) {
    if (t < ST.strike) return ["off", 0];
    if (t < ST.strike + 0.85) {
      // the nameplate's flicker, which is this film's established language for
      // something switching on
      const u = t - ST.strike;
      if (u < 0.10) return ["boot", 0.75];
      if (u < 0.19) return ["boot", 0.04];
      if (u < 0.31) return ["boot", 1.0];
      if (u < 0.38) return ["boot", 0.18];
      if (u < 0.49) return ["boot", 0.9];
      // Settles by u=0.75 (t=1.10), where it used to take until u=1.25
      // (t=1.60) and then sit there for another third of a second before the
      // camera moved. The flicker itself is untouched — it is the dead air
      // AFTER it that made the opening feel slow.
      return ["boot", 0.55 + 0.45 * ramp(u, 0.44, 0.75)];
    }
    if (t < ST.uiSwitch) return ["boot", 1];
    if (t < ST.uiSwitch + 0.13) return ["off", 0];        // the blink between pages
    if (t < ST.alarm) return ["ui", 1];
    if (t < ST.alarm + 0.16) return ["off", 0];
    // the alarm strikes twice before it holds
    const u = t - ST.alarm - 0.16;
    if (u < 0.09) return ["alert", 1];
    if (u < 0.16) return ["alert", 0.1];
    if (u < 0.30) return ["alert", 1];
    // It goes dark before the panel leaves rather than riding away still lit —
    // a screen travelling out of frame showing an alarm reads as the alarm
    // leaving with it.
    return ["alert", 1 - ramp(t, ST.panel[0] - 0.5, ST.panel[0] + 0.2)];
  }

  /* ---------- the circuit ----------
     Same technique as the first version's deck scene: a tube along the
     centreline, wearing a repeating dash texture that is scrolled by offsetting
     the map. Additive, so it adds light to the machine rather than painting
     over it, and depthWrite off so overlapping runs do not punch holes in one
     another. Orange is the culture loop, green the protectant crossing to the
     shell — the same two colours the deck scene uses, so the two films agree
     about which line is which. */
  const FLOW_SPEED = 74, DASH_MM = 46;
  const LOOP_COLOURS = {
    lumen: { edge: "rgba(255,110,10,0)", core: "rgba(255,126,20,1)" },
    shell: { edge: "rgba(20,225,120,0)", core: "rgba(24,235,132,1)" }
  };
  const flowMats = [], tubeMats = [];
  function dashTexture(loop) {
    const cl = LOOP_COLOURS[loop] || LOOP_COLOURS.lumen;
    const c = document.createElement("canvas");
    c.width = 128; c.height = 4;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 52, 0);
    grad.addColorStop(0, cl.edge); grad.addColorStop(0.5, cl.core); grad.addColorStop(1, cl.edge);
    g.fillStyle = grad; g.fillRect(0, 0, 52, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;     // painted artwork, not data
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  let auraA = null, auraB = null, auraGlow = null, liquid = null, liquidBase = null;
  let alarmLight = null, warmLight = null, rotors = [];
  let heroKick = null, heroTop = null;
  let liquidTop = null, bubbles = [];
  let sweep = null;

  function storyBuild() {
    /* ---- vignette ----
       There isn't one here, deliberately. A GL vignette was built first — a
       quad parented to the camera, MultiplyBlending — and it was wrong twice
       over. It stacked on top of the one unveil.css has had all along
       (.unv-stage::after), multiplying the corners down to about 0.22 of their
       true value; and because render() calls setViewOffset to slide the frustum
       for the hero card, the quad projects through that same shifted matrix and
       slid 16% of frame width across the middle of the reveal.
       The CSS one costs no draw call, cannot slide with the frustum, and
       composites in true display space by construction. It is driven from the
       timeline instead — see render(). */

    /* ---- the display's initialising sweep ----
       A band that runs down the glass once, as the interface comes up. Real
       panels do it, it is over in half a second, and it is the difference
       between the screen changing page and the screen coming to life. */
    const sn = 8, sh = 256, sc2 = document.createElement("canvas");
    sc2.width = sn; sc2.height = sh;
    const sg = sc2.getContext("2d");
    const sgr = sg.createLinearGradient(0, 0, 0, sh);
    sgr.addColorStop(0.00, "rgba(120,255,214,0)");
    sgr.addColorStop(0.42, "rgba(120,255,214,0.10)");
    sgr.addColorStop(0.50, "rgba(190,255,236,0.55)");
    sgr.addColorStop(0.58, "rgba(120,255,214,0.10)");
    sgr.addColorStop(1.00, "rgba(120,255,214,0)");
    sg.fillStyle = sgr; sg.fillRect(0, 0, sn, sh);
    const stex = new THREE.CanvasTexture(sc2);
    stex.encoding = THREE.sRGBEncoding;
    if (screenGroup && window.HMI) {
      sweep = new THREE.Mesh(
        new THREE.PlaneGeometry(HMI.APERTURE[0], HMI.APERTURE[1]),
        new THREE.MeshBasicMaterial({
          map: stex, transparent: true, opacity: 0, toneMapped: false, fog: false,
          depthWrite: false, blending: THREE.AdditiveBlending,
          polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -20
        }));
      sweep.position.set(0, 0, 1.95);
      sweep.renderOrder = 7;
      screenGroup.add(sweep);
    }

    /* ---- atmosphere ----
       Exponential, and nearly black. Fog is composited AFTER ACES and after the
       linear-to-sRGB encode, so its colour is a display-space value and must not
       go through hexColor() — and it does not scale with toneMappingExposure,
       which means a grey fog would be the brightest thing in frame during the
       opening, where the exposure floor is 0.03.
       At this density it is 0.6% at the opening macro and about a third at the
       closing wide: the depth cue without the haze. */
    scene.fog = new THREE.FogExp2(0x05070a, 3.2e-4);

    /* ---- flow ---- */
    if (typeof TOWER_FLOW !== "undefined") {
      TOWER_FLOW.forEach(function (fp) {
        const pts = fp.points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
        // "centripetal", not the default. These routes have near-duplicate
        // consecutive points where they were fitted around hardware, and
        // uniform Catmull-Rom overshoots hard on those — which is the same
        // between-the-knots bulge that first drove lumen-3 through the
        // reservoir bottle.
        const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
        const len = curve.getLength();
        const segs = Math.min(400, Math.max(24, Math.round(len / 3)));

        // The tube itself, and the dash INSIDE it at a smaller radius. In the
        // reference the travelling light is inside a length of clear tubing —
        // that is what makes it read as plumbing carrying something. Additive
        // dashes alone, with no tube around them, are just light in mid-air.
        const tubeMat = new THREE.MeshPhysicalMaterial({
          color: hexColor(0xdde5eb), metalness: 0, roughness: 0.30,
          transmission: 0.74, ior: 1.5, transparent: true, opacity: 0,
          clearcoat: 1, clearcoatRoughness: 0.14,
          envMapIntensity: 0.9, depthWrite: false, side: THREE.DoubleSide
        });
        tubeMats.push(tubeMat);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, segs, 3.0, 12, false), tubeMat);
        tube.renderOrder = 3;
        tube.castShadow = false; tube.receiveShadow = false;
        spin.add(tube);

        const geo = new THREE.TubeGeometry(curve, segs, 2.1, 10, false);
        const tex = dashTexture(fp.loop);
        tex.repeat.x = len / DASH_MM;
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        flowMats.push(mat);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 4;
        mesh.castShadow = false; mesh.receiveShadow = false;
        spin.add(mesh);                    // Onshape coords, inside root's rotation
      });
    } else {
      console.warn("[unveil] TOWER_FLOW missing — the story cut has no circuit");
    }

    /* ---- the green aura ----
       Two point lights inside the case rather than one: a single source in the
       middle of a machine this deep lights the near faces and leaves the back
       flat, and the thing being asked for is an interior that GLOWS, which
       means light arriving from more than one direction. Plus one additive
       sprite, which is what actually reads as light in the air — lights alone
       only ever show up on surfaces. */
    auraA = new THREE.PointLight(0x2bff9e, 0, 720, 2.0);
    auraA.position.set(-24, -46, 262);
    auraB = new THREE.PointLight(0x1fe89a, 0, 640, 2.0);
    auraB.position.set(-16, 62, 214);
    spin.add(auraA, auraB);

    // A warm accent from the pump side, low, riding with the aura. Every source
    // in the interior beats was green, and a scene lit by one hue reads flat
    // however bright it is — the eye needs two temperatures to see form. It is
    // also motivated: the orange running through the culture loop is right
    // there. This is the difference between "green lighting" and a grade.
    warmLight = new THREE.PointLight(0xffab5e, 0, 520, 2.0);
    warmLight.position.set(-58, 104, 226);
    spin.add(warmLight);

    /* ---- two things that were louder than the subject ----
       The bottom-right corner of the FLOOR ran to a local peak of 120 while the
       whole frame averaged 12 — an empty patch of ground was the brightest large
       area in the composition, and it peaked on the beat where nothing else
       moves. It is the key's specular streak; a rougher floor spreads it and
       takes it down without losing the sheen that grounds the tower.
       And the trim — the handle and the top bracket — sat so far above the
       chassis in value that it separated and read as a pale block floating at
       the top of frame rather than as part of the same object. */
    ground.mat.roughness = 0.55;
    ground.mat.envMapIntensity = 0.22;
    bodies.forEach(function (b) {
      if (!b.isCase) return;
      b.mats.forEach(function (m) {
        if (!m.userData.base) return;
        if (m.userData.base.r > 0.25) {          // trim is the only light case material
          m.color.multiplyScalar(0.62);
          m.userData.base.multiplyScalar(0.62);
          m.envMapIntensity *= 0.65;
        }
      });
    });

    /* ---- the exterior needs an edge ----
       The first eight seconds were a black rectangle with a lit screen on it:
       correct exposure, correct albedo — the case really is 5% reflectance —
       and no FORM. A black object against black is only a shape if something
       draws its edges, and the film's three-point rig is aimed at the face the
       camera sees, which on a black box is the part with nothing to show.
       These two do nothing but separate the tower from the background: a kick
       from behind and above to catch the far vertical edge and the top lip, and
       a soft top light so the upper face reads as a surface. They fade out when
       the camera goes inside, where the aura takes over. */
    heroKick = new THREE.DirectionalLight(0xc8dcf0, 0);
    heroKick.position.set(1500, 1150, -1250);
    heroTop = new THREE.DirectionalLight(0xdfe9f2, 0);
    heroTop.position.set(-300, 2200, 260);
    scene.add(heroKick, heroKick.target, heroTop, heroTop.target);

    // The alarm has to happen to the MACHINE, not just on the glass. A display
    // that turns red lights its own bezel red; without the spill the panel goes
    // on being a neutral grey rectangle with a red picture inside it, and the
    // moment stays behind the glass instead of arriving in the room.
    alarmLight = new THREE.PointLight(0xff4436, 0, 620, 2.0);
    alarmLight.position.set(-186, -8, 424);
    spin.add(alarmLight);

    const n = 256, gc = document.createElement("canvas");
    gc.width = gc.height = n;
    const gg = gc.getContext("2d");
    const rad = gg.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    rad.addColorStop(0, "rgba(90,255,190,0.55)");
    rad.addColorStop(0.42, "rgba(50,220,150,0.16)");
    rad.addColorStop(1, "rgba(40,200,140,0)");
    gg.fillStyle = rad; gg.fillRect(0, 0, n, n);
    const gtex = new THREE.CanvasTexture(gc);
    gtex.encoding = THREE.sRGBEncoding;
    auraGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: gtex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false }));
    auraGlow.scale.set(430, 430, 1);
    auraGlow.position.set(-30, -20, 250);
    auraGlow.renderOrder = 3;
    spin.add(auraGlow);

    /* ---- the membrane column ----
       It was rendering as a black tube, and it should be a clear housing with a
       red core running its length. The cause is a real limitation of the
       measured palette rather than a bug: palette.json samples one colour per
       PART, and this part is three shells with three different CAD appearances —
       an outer housing at #e6e6e6 alpha 0.247, an inner core the full length of
       the column at #982d0d, and a more solid white ring at the top end. Averaged
       into a single grey at 25% opacity, the housing stops being see-through and
       the red core disappears entirely.
       So this one body is shaded from the CAD's own material table instead. The
       hues and the alphas are the file's, not invented; the only liberty is
       making the housing MORE transmissive and the core LESS than their shared
       0.247, because at equal transmission neither reads — the whole point is
       that you see one through the other. */
    (function () {
      const mc = byKey["Part 1|19"];
      if (!mc || !mc.meshes || !CAD_MATS.length) {
        console.warn("[unveil] membrane column not re-shaded"); return;
      }
      mc.meshes.forEach(function (mesh) {
        const cad = CAD_MATS[mesh.userData.mat];
        if (!cad) return;
        const isCore = cad.hex.toLowerCase() === "#982d0d";
        // The core is OPAQUE, and for the same reason the protectant fill had to
        // be: r128 renders transmission by sampling a backbuffer containing the
        // OPAQUE pass only. A transmissive core inside a transmissive housing is
        // simply not in the buffer the housing reads, so it cannot be seen
        // through it — the first attempt gave a bright white rod with the red
        // hidden and only its top cap poking out.
        //
        // The housing is also pulled back from the CAD's near-white: at #e6e6e6
        // with a full share of the environment it photographed as a solid white
        // rod, which is the opposite of the see-through it is meant to be. Less
        // albedo and less environment is what makes glass read as glass.
        const m = new THREE.MeshPhysicalMaterial({
          // Darker and less reflective than the CAD's near-white: across the
          // interior beats it was a glowing tube, the brightest thing in every
          // frame, pulling the eye off the pump and the bottle the shot is
          // actually about.
          color: isCore ? hexColor(0xc2400f) : hexColor(0x63736f),
          metalness: 0, roughness: isCore ? 0.44 : 0.13,
          transmission: isCore ? 0 : (cad.alpha < 0.5 ? 0.90 : 0.58),
          ior: 1.46,
          clearcoat: isCore ? 0.15 : 1.0, clearcoatRoughness: isCore ? 0.35 : 0.04,
          // Carries its own light. Measured with the housing hidden, the CAD's
          // #982d0d rendered at rgb(10,38,29) — a dark object in a scene lit
          // entirely green is very nearly black, the same thing that made the
          // protectant photograph as an empty bottle.
          emissive: isCore ? hexColor(0x8f2606) : hexColor(0x000000),
          emissiveIntensity: isCore ? 1.15 : 0,
          envMapIntensity: isCore ? 0.4 : 0.28
        });
        // Glass does not write depth. That single change is what lets everything
        // INSIDE the column be drawn normally — the bore, both exchange bands —
        // with their depth tests left ON, so the front panel and the screen
        // still occlude them for the first half of the film. They were briefly
        // given depthTest:false instead, which worked against the housing and
        // was catastrophic against everything else: a bar of orange and green
        // drew straight through the closed machine and across the interface,
        // in every frame before the panel came off.
        if (!isCore) m.depthWrite = false;
        mesh.material = m;
        if (isCore) {
          // ADDITIVE, and this is the third distinct dodge r128's transmission
          // has forced in this file. Everything else was tried and measured at
          // the column's centre, all against a housing-only reading of
          // rgb(123,164,150):
          //   opaque core, default order      -> rgb(123,164,150)  (identical)
          //   opaque core, depthTest off, ro 4 -> rgb(123,164,150)  (identical)
          // Not dimmed — absent, bit for bit. An opaque body behind a
          // transmissive one cannot win, because the housing does not blend
          // over the framebuffer, it REPLACES it with its own sample of the
          // transmission backbuffer.
          //
          // Additive escapes the argument entirely: it lands in the transparent
          // queue, which runs after the transmissive one, and adds light rather
          // than competing for the pixel. It is also exactly what the first
          // version's deck scene does for this same part — see the `core`
          // cylinder in js/scene.js — so the two films describe the membrane
          // the same way.
          mesh.material = new THREE.MeshBasicMaterial({
            color: hexColor(0xc4491a),
            transparent: true, opacity: 0.26,
            blending: THREE.AdditiveBlending,
            // depthTest OFF as well as depthWrite: the housing is drawn in the
            // transmissive pass, which runs BEFORE the transparent one, and it
            // writes depth — so the core reached the blend stage already
            // discarded.
            //
            // And DoubleSide, which is what was actually wrong for three
            // attempts. This shell is the membrane's BORE, not a solid rod:
            // its normals face inward, so from outside every triangle is a
            // backface and the default FrontSide culled all of them. Scanning
            // the whole frame for a magenta test material found 92 lit pixels
            // in an 11,000-pixel footprint — the silhouette edges, and nothing
            // else. Every "it renders as nothing" measurement before that was
            // true and none of them pointed here.
            side: THREE.DoubleSide,
            depthWrite: false, toneMapped: false, fog: false
          });
          mesh.renderOrder = 5;
        }
        m.userData.base = m.color.clone();   // the recede multiplies this
      });
    })();

    /* ---- what is happening inside the membrane ----
       The bore shell above only reads where you can see INTO it, which is at
       the ends — geometrically honest, and not the full-length band the first
       version showed. That band is not CAD geometry in either film: the deck
       scene draws it, as an additive cylinder inside the column (see `core` and
       `halo` in js/scene.js). This is the same thing in the same two colours,
       so the two films say the same thing about the same part: orange is the
       culture running through the lumen, green is the protectant crossing to
       the shell. It is a flow visualisation, not a claim about a part.
       Both ignore depth, because the housing in front of them writes it. */
    (function () {
      const AX = 58.2, AY = -121.0, AZ = 345.0;     // the column's own axis
      function band(radius, length, hex, opacity, order) {
        const geo = new THREE.CylinderGeometry(radius, radius, length, 20, 1, true);
        geo.rotateX(Math.PI / 2);                   // cylinder axis Y -> Onshape z
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: hexColor(hex), transparent: true, opacity: opacity,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          depthWrite: false, toneMapped: false, fog: false
        }));
        m.position.set(AX, AY, AZ);
        m.renderOrder = order;
        spin.add(m);
        return m;
      }
      // Quiet. At 0.30 and 0.13 these two read as a fluorescent tube standing
      // in the machine — additive, toneMapped:false and stacked on top of the
      // bore shell, they saturated and became the brightest thing in a frame
      // whose subject is elsewhere. It is a flow cue inside a component, not a
      // light fitting.
      // the lumen, running the length between the two end fittings
      band(11.0, 196, 0xff7e14, 0.085, 5);
      // and the shell around it, wider and quieter
      band(19.0, 168, 0x18e884, 0.038, 5);
    })();

    /* ---- the pump turns ----
       Nothing in this machine moved. A 40-second film of a bioreactor running,
       in which no part of the bioreactor rotates, is a still life with a camera
       move over it — and the pump is the one thing a viewer already expects to
       see going round.

       Which bodies, and about which axis, came out of the geometry rather than
       the names: both rotors measure 10 x 40 x 43 mm, so they are discs whose
       short dimension is x, and x is therefore the shaft. (The pinion is a
       24 x 5 x 5 shaft on the same axis but it is geared to the rotor at a
       ratio the CAD does not state, so it is left alone — a made-up gear ratio
       is a made-up number.)

       The geometry is in absolute Onshape coordinates, so the body has to be
       re-centred on its own axis first: spinning the group as loaded would
       swing the rotor in a 130mm arc around the model origin instead of
       turning it on its shaft. */
    // THE AXIS IS NOT THE BOUNDING-BOX CENTRE. The rotor is a three-lobe part
    // frozen at about 3.7 degrees, so its box is not centred on its own shaft:
    // measured, the box centre sits at y = 115.165 while the shaft is at
    // y = 111.170 — 4.00 mm out. Pivoting on the box makes the rotor orbit a
    // 4 mm crank instead of turning on its shaft, and at the distances this
    // film gets to that wobble is visible.
    //
    // The real axis came from fitting the pump casing's bore ring
    // (r = 32.9001 +/- 0.0004 mm) and was confirmed six other ways — the pinion
    // end caps, the roller pitch circle, the NEMA 17's 42 mm body, and a
    // three-fold symmetry search on each rotor which beats two-, four-, five-
    // and six-fold by more than 4x. All seven agree to within 0.02 mm.
    const AXIS_Y = 111.170, AXIS_Z = 210.442;
    [
      "Front Rotor|107",   // the two rotor discs, in phase
      "Back Rotor|108",
      // Three peristaltic rollers on a 20.003 mm pitch circle at 3.74, 123.73
      // and 243.76 degrees. They are one group, which is exactly what is wanted:
      // a rigid rotation about the shaft carries all three round together, the
      // way a rotor head actually works.
      "Bearing|103",
      // The motor shaft. Named "pinion" but geometrically a plain 12-gon
      // cylinder, 4.94 x 24.0 mm, with no teeth on it — so there is no gear
      // ratio to invent and it simply turns with everything else.
      "Pinion|111"
    ].forEach(function (key) {
      const b = byKey[key];
      if (!b || !b.meshes) { console.warn("[unveil] no rotating body", key); return; }
      // Only y and z move: the axis runs along x, so each body keeps its own x
      // and the group carries just the offset to the shaft.
      b.meshes.forEach(function (m) { m.geometry.translate(0, -AXIS_Y, -AXIS_Z); });
      b.group.position.set(0, AXIS_Y, AXIS_Z);
      rotors.push({ mesh: b.group, axis: "x", dir: 1 });
    });

    /* ---- protectant collecting in the reservoir ----
       The CAD has no liquid body in any bottle, so the fill is a cylinder built
       to the bottle's measured bore and grown from its floor. Measured, not
       eyeballed: the reservoir bottle's box is 81 x 81 x 119 centred
       (-28.1, -99.0) spanning z 134..253, so the bore is 40.5 less a wall and
       the straight section is what the fill stays inside.

       It grows by SCALING, not by a clipping plane. r128 supports local clipping
       but every clipped material needs the plane wired into it and the bottle in
       front of the liquid is itself transmissive — the clip would have had to
       apply to one and not the other, at which point scaling a cylinder is the
       honest, cheap answer. */
    // 34, not the full 37 bore: at 37 the fill touched the glass and the
    // bottle lost its wall on both sides of frame.
    const R = 34.0, Z0 = 141.0, Z1 = 240.0;
    liquidBase = { z0: Z0, h: Z1 - Z0 };
    const lgeo = new THREE.CylinderGeometry(R, R, 1, 40, 1, false);
    lgeo.translate(0, 0.5, 0);            // grow upward from the base, not the middle
    lgeo.rotateX(Math.PI / 2);            // cylinder axis Y -> Onshape z (up)
    // It carries its own light. Every source in this beat is green, and green
    // light on an amber body is close to black — the first version was
    // physically right and photographed as an empty bottle. A modest emissive
    // makes the protectant read as itself rather than as whatever is lighting
    // it, which is also the truer thing to show: the point of the shot is that
    // there is now something in the bottle.
    // OPAQUE, and that is not a style choice. r128 renders transmission by
    // sampling a backbuffer that contains the OPAQUE pass only, so a transparent
    // object standing behind transmissive glass is never in the buffer the glass
    // samples — it is composited afterwards and simply does not exist as far as
    // the bottle is concerned. Measured: with the bottle hidden the fill reads
    // rgb(132,99,44); with the bottle shown, rgb(26,26,26). Not dim. Absent.
    // An opaque fill renders in the opaque pass, lands in that buffer, and shows
    // through the glass the way it should. It also loses nothing — a column of
    // protectant does not need to be see-through, it needs to be seen.
    liquid = new THREE.Mesh(lgeo, new THREE.MeshPhysicalMaterial({
      // Toned right down from the first attempt. At emissive 0.42 it stopped
      // being a liquid and became a bright orange drum: it blew past everything
      // around it, and the bottle's own glass — which is 75% transmissive over a
      // near-black albedo — simply vanished against it, so the shot read as a
      // plastic barrel standing on the shelf with no bottle at all. It needs
      // just enough of its own light to survive a room lit entirely green.
      color: hexColor(0x9a6330), metalness: 0, roughness: 0.28,
      clearcoat: 0.25, clearcoatRoughness: 0.22,
      emissive: hexColor(0x7d3f10), emissiveIntensity: 0.12,
      envMapIntensity: 0.5
    }));
    liquid.position.set(-28.1, -99.0, Z0);
    liquid.scale.z = 0.0001;
    liquid.visible = false;
    liquid.castShadow = false;
    // The bottle's front wall writes depth at a nearer z than the liquid behind
    // it, so every fragment of the fill was discarded before it was ever shaded:
    // measured at the fill line, rgb(26,26,26) with the bottle shown against
    // rgb(185,113,42) with it hidden. Not dimmed — gone.
    //
    // The obvious fix, stopping the GLASS writing depth, was tried and is worse.
    // It does reveal the fill, but the bottle then contributes almost nothing
    // over it — 75% transmissive over a near-black albedo — so the shot became
    // an orange drum standing on the shelf with no bottle around it at all.
    // Rendered side by side, that read as a plastic barrel; this reads as a
    // bottle with something in it, which is the entire point of the beat.
    //
    // So the liquid ignores depth and draws last instead. The cost is that
    // anything passing in front of the bottle would not occlude it — acceptable
    // here because the panel is already off and the camera spends these last
    // seconds square on the shelf with nothing between.
    liquid.material.depthTest = false;
    liquid.renderOrder = 4;
    spin.add(liquid);

    /* ---- the surface, and what is rising through it ----
       The column alone was a solid amber drum with a flat lid. Three things
       make it read as liquid instead, and none of them is expensive.

       The SURFACE is its own disc rather than the top of the scaled cylinder:
       scaling a cylinder in z stretches whatever is on its end cap, so a
       meniscus modelled into the body would flatten out as the bottle filled.
       Kept separate it holds its shape at every level, and it gets its own
       material — wetter, glossier, and a shade lighter than the body, which is
       what a liquid surface actually does under a light. */
    const topGeo = new THREE.CircleGeometry(R, 44);
    liquidTop = new THREE.Mesh(topGeo, new THREE.MeshPhysicalMaterial({
      color: hexColor(0xb87a44), metalness: 0, roughness: 0.06,
      clearcoat: 1.0, clearcoatRoughness: 0.04,
      emissive: hexColor(0x7d3f10), emissiveIntensity: 0.10,
      envMapIntensity: 1.5
    }));
    liquidTop.material.depthTest = false;
    liquidTop.renderOrder = 5;
    liquidTop.visible = false;
    spin.add(liquidTop);

    /* The MENISCUS: a narrow ring standing just proud of the surface where the
       liquid climbs the glass. It is the single detail that stops a fill
       reading as a flat plane cutting through a bottle. */
    const rimGeo = new THREE.RingGeometry(R - 2.6, R + 0.4, 44);
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({
      color: hexColor(0xffcf92), transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      toneMapped: false, fog: false, side: THREE.DoubleSide
    }));
    rim.renderOrder = 6;
    liquidTop.add(rim);
    rim.position.z = 0.3;

    /* And BUBBLES. A bioreactor's product coming off a membrane is not still,
       and a rising bubble is the cheapest possible cue that something is
       happening rather than that a shape is getting taller. Additive sprites,
       recycled: each one climbs, fades as it nears the surface, and restarts
       near the floor. */
    const bn = 64, bc = document.createElement("canvas");
    bc.width = bc.height = bn;
    const bg2 = bc.getContext("2d");
    const brad = bg2.createRadialGradient(bn / 2, bn / 2, 1, bn / 2, bn / 2, bn / 2);
    brad.addColorStop(0.0, "rgba(255,236,205,0.85)");
    brad.addColorStop(0.45, "rgba(255,206,145,0.28)");
    brad.addColorStop(1.0, "rgba(255,190,120,0)");
    bg2.fillStyle = brad; bg2.fillRect(0, 0, bn, bn);
    const btex = new THREE.CanvasTexture(bc);
    btex.encoding = THREE.sRGBEncoding;
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: btex, transparent: true, opacity: 0, depthWrite: false,
        depthTest: false, blending: THREE.AdditiveBlending,
        toneMapped: false, fog: false
      }));
      const size = 1.5 + Math.random() * 2.6;
      sp.scale.set(size, size, 1);
      sp.renderOrder = 7;
      // spread across the bore, but kept off the wall so none clips the glass
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (R - 6);
      spin.add(sp);
      bubbles.push({
        sp: sp,
        x: -28.1 + Math.cos(a) * rr,
        y: -99.0 + Math.sin(a) * rr,
        phase: Math.random(),
        speed: 0.22 + Math.random() * 0.30
      });
    }

    // Anything that is its own light source opts out of the fog. These are drawn
    // toneMapped:false precisely so they keep their whites through the exposure
    // ramp, and fog would take those whites straight back. On the additive
    // materials it is worse: fog mixes in BEFORE the additive blend, so a
    // non-black fog would be ADDED to the frame wherever they draw.
    // The floor and its grid stay fogged on purpose — the ground is the one
    // surface where distance haze earns its keep.
    scene.traverse(function (o) {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (m) {
        if (m.toneMapped === false || m.blending === THREE.AdditiveBlending) m.fog = false;
      });
    });
  }


  /* ====================================================================== */
  /* The outro: where the protectant goes                                   */
  /* ====================================================================== */
  // The bottle used to fill and then simply sit there, which ended the film on
  // an inventory rather than on a point. A drop leaves the machine, the floor
  // goes wet, and a crop comes up in it — growing OUTWARD, each clump timed to
  // the moment the spreading protectant reaches it, so the sequence reads as
  // cause and effect rather than as two effects that happen to overlap.
  //
  // NOTHING HERE IS A SOLID. Every element is a painted, soft-edged canvas
  // texture on a plane or a sprite, moved by scale, rotation and opacity. A
  // hard edge would read as a graphic pasted over the render, and the one
  // thing a liquid must not look like is a shape. The amber is kept well down
  // too — at the bottle's saturation a floor of it is a traffic cone, and this
  // is a thin translucent film seen at night.
  const OUTRO_FLOOR_Z = -13.0;      // the floor is at -13.5, its grid at -13.2
  const SHOOT_RAD = [430, 1000];    // the band the crop comes up in
  let plants = [], pool = null, wet = null, drop = null, splash = null;
  let crown = null, jet = null, beads = [];

  // Erase back to nothing before the canvas rim. Every texture here is scaled
  // to two or three metres across, so anything still opaque where the canvas
  // ends becomes a straight edge lying on the floor.
  function feather(g, n, inner, outer) {
    const f = g.createRadialGradient(n / 2, n / 2, n * inner, n / 2, n / 2, n * outer);
    f.addColorStop(0.00, "rgba(0,0,0,0)");
    f.addColorStop(0.65, "rgba(0,0,0,0.45)");
    f.addColorStop(1.00, "rgba(0,0,0,1)");
    const prev = g.globalCompositeOperation;
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = f; g.fillRect(0, 0, n, n);
    g.globalCompositeOperation = prev;
  }

  function texFrom(c) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // A 32-bit LCG on INTEGER state. The textbook
  //     s = (s * 9301 + 49297) % 233280 / 233280
  // needs an integer: fed its own fractional output it lands on a fixed point
  // within two steps and returns the same number forever. Every "random" blade
  // in a clump then draws in the same place, and clumps of nine render as
  // single leaves.
  function outroRnd(seed) {
    let s = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // a soft highlight — the falling drop, and the glow at a shoot's root
  function blobTexture(rgb) {
    const n = 128, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0.00, "rgba(" + rgb + ",0.95)");
    r.addColorStop(0.28, "rgba(" + rgb + ",0.46)");
    r.addColorStop(0.62, "rgba(" + rgb + ",0.11)");
    r.addColorStop(1.00, "rgba(" + rgb + ",0)");
    g.fillStyle = r; g.fillRect(0, 0, n, n);
    return texFrom(c);
  }

  // The crown — the ring of liquid an impact throws up and outward. Drawn as
  // three wobbly closed strokes at slightly different radii and phases: a clean
  // annulus reads as a HUD graphic, and what makes it liquid is that the crest
  // is a different distance out on every bearing.
  function crownTexture() {
    const n = 512, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const cx = n / 2, cy = n / 2;
    g.filter = "blur(9px)";
    [[1.00, 0.60, 0.030], [0.92, 0.26, 0.058], [1.08, 0.20, 0.046]]
      .forEach(function (L, li) {
        g.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 1e-3; a += Math.PI / 84) {
          const w = 1
                  + 0.075 * Math.sin(a * 3 + li * 1.7)
                  + 0.040 * Math.sin(a * 5 + li * 0.9 + 1.2)
                  + 0.022 * Math.sin(a * 9 + li * 2.3 + 0.4);
          const r = n * 0.5 * 0.62 * L[0] * w;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.99;
          if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.closePath();
        g.strokeStyle = "rgba(240,172,96," + L[1] + ")";
        g.lineWidth = n * L[2];
        g.stroke();
      });
    g.filter = "none";
    return texFrom(c);
  }

  // An irregular pool, from a couple of dozen blurred blobs rather than from
  // one circle: a circle of liquid on a floor is a coaster, and what reads as
  // spilled is the lobed, uneven edge. Every blob is kept inside 0.40n so the
  // canvas never clips one — a clipped blob is a straight line.
  function spillTexture(seed, rgb) {
    const n = 768, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const rnd = outroRnd(seed * 977 + 13);
    g.filter = "blur(30px)";
    for (let i = 0; i < 30; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = n * (0.075 + rnd() * 0.105);
      const rad = Math.pow(rnd(), 0.55) * (n * 0.40 - rr);   // stays off the rim
      g.beginPath();
      g.ellipse(n / 2 + Math.cos(a) * rad, n / 2 + Math.sin(a) * rad,
                rr, rr * (0.6 + rnd() * 0.7), a, 0, Math.PI * 2);
      g.fillStyle = "rgba(" + rgb + "," + (0.045 + rnd() * 0.05).toFixed(3) + ")";
      g.fill();
    }
    // a brighter film where it is deepest, so it has a body and not just an edge
    g.filter = "blur(52px)";
    g.beginPath(); g.arc(n / 2, n / 2, n * 0.17, 0, Math.PI * 2);
    g.fillStyle = "rgba(" + rgb + ",0.15)"; g.fill();
    g.filter = "none";
    feather(g, n, 0.34, 0.50);
    return texFrom(c);
  }

  // Painted shoots. Billboards rather than modelled stems: at this scale,
  // against a measured CAD model, crude procedural geometry reads as crude
  // procedural geometry and a painted silhouette does not.
  //
  // Painted DARK, and warm rather than sea-green. These are unlit sprites on a
  // floor at 60% exposure with one green source a few feet away: at the values
  // a daylit plant wants they come out as neon, and equal green and blue reads
  // as more of the machine's own cyan light rather than as something growing
  // in it.
  function shootTexture(seed, broad) {
    const w = 512, h = 512, c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const rnd = outroRnd(seed * 1597 + 101);
    const blades = (broad ? 5 : 8) + Math.floor(rnd() * 4);
    for (let b = 0; b < blades; b++) {
      const near = rnd();                       // depth within the clump
      const x0 = w * (0.30 + rnd() * 0.40);
      const lean = (rnd() - 0.5) * w * (broad ? 0.86 : 0.58);
      const top = h * ((broad ? 0.30 : 0.10) + rnd() * 0.40);
      const wid = w * ((broad ? 0.028 : 0.019) + rnd() * 0.026);
      const dim = 0.45 + near * 0.55;
      const grd = g.createLinearGradient(0, h, 0, top);
      grd.addColorStop(0.00, "rgba(10,30,14," + (0.94 * dim).toFixed(3) + ")");
      grd.addColorStop(0.55, "rgba(30,78,34," + (0.72 * dim).toFixed(3) + ")");
      grd.addColorStop(1.00, "rgba(72,124,58," + (0.44 * dim).toFixed(3) + ")");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x0 - wid, h);
      g.quadraticCurveTo(x0 - wid * 0.4 + lean * 0.45, (h + top) * 0.5, x0 + lean, top);
      g.quadraticCurveTo(x0 + wid * 0.8 + lean * 0.45, (h + top) * 0.5, x0 + wid, h);
      g.closePath(); g.fill();
      // A leaf off the stem — blades alone read as grass and this is a crop.
      // Drawn as a tapered blade that starts at the stem's own width and comes
      // to a point: closing the shape back on its origin makes a lozenge, and
      // a lozenge reads as floating rather than attached.
      if (rnd() < (broad ? 0.85 : 0.62)) {
        const ly = top + (h - top) * (0.28 + rnd() * 0.38);
        const lx = x0 + lean * (1 - (ly - top) / (h - top));
        const dir = rnd() < 0.5 ? -1 : 1;
        const ll = w * ((broad ? 0.10 : 0.065) + rnd() * 0.095);
        const droop = ll * (0.16 + rnd() * 0.30);
        g.beginPath();
        g.moveTo(lx - wid * 0.55, ly - wid * 0.7);
        g.quadraticCurveTo(lx + dir * ll * 0.55, ly - ll * 0.34,
                           lx + dir * ll, ly + droop);
        g.quadraticCurveTo(lx + dir * ll * 0.45, ly + ll * 0.10,
                           lx + wid * 0.55, ly + wid * 0.7);
        g.closePath();
        g.fillStyle = "rgba(30,80,36," + (0.62 * dim).toFixed(3) + ")";
        g.fill();
      }
    }
    return texFrom(c);
  }

  function addFloorPlane(size, tex, opts) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
        side: THREE.DoubleSide
      }));
    // A plane added to root lies flat: root is rotated -90 about x to take
    // Onshape's z-up into three's y-up, so root's local xy IS the floor.
    m.position.set(opts.x || 0, opts.y || 0, opts.z);
    m.renderOrder = opts.order;
    root.add(m);
    return m;
  }

  function buildOutro() {
    /* ---- the drop, and the mark it makes ---- */
    drop = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTexture("240,178,102"), transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      toneMapped: false, fog: false
    }));
    drop.scale.set(16, 22, 1);
    drop.renderOrder = 9;
    root.add(drop);

    /* ---- the impact ----
       A drop hitting a hard floor does four things, and the first pass did one
       of them: it grew a soft blob. What actually reads as a splash is the
       CROWN thrown up and out, the BEADS it throws off, the little rebound JET
       at the centre, and only then the wet mark left behind. */
    splash = addFloorPlane(1, spillTexture(23, "236,158,80"),
      { x: -28, y: -99, z: OUTRO_FLOOR_Z + 0.4, order: 7 });
    crown = addFloorPlane(1, crownTexture(),
      { x: -28, y: -99, z: OUTRO_FLOOR_Z + 0.6, order: 8 });

    jet = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTexture("242,178,104"), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
      toneMapped: false, fog: false
    }));
    jet.center.set(0.5, 0);                 // rises out of the floor
    jet.renderOrder = 9;
    root.add(jet);

    // thrown beads, on ballistic arcs, each leaving a mark where it lands
    const brnd = outroRnd(4127);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + (brnd() - 0.5) * 0.5;
      const big = brnd() < 0.28;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: blobTexture("246,186,112"), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
        toneMapped: false, fog: false
      }));
      sp.renderOrder = 9;
      root.add(sp);
      const mark = addFloorPlane(1, spillTexture(40 + i, "214,132,58"),
        { x: 0, y: 0, z: OUTRO_FLOOR_Z + 0.3, order: 7 });
      beads.push({
        sp: sp, mark: mark, a: a,
        r: (big ? 500 : 250) + brnd() * (big ? 580 : 430),   // how far it is thrown
        // Flatter arcs than the first pass. Lobbed 300mm up they hang in
        // open air well clear of the machine and read as fireflies; kept low
        // they read as spray thrown off the impact.
        h: (big ? 95 : 45) + brnd() * (big ? 95 : 65),       // and how high
        t0: brnd() * 0.05,
        dur: 0.40 + brnd() * 0.34,
        size: (big ? 8 : 4.2) + brnd() * (big ? 6 : 3.4)
      });
    }

    /* ---- the floor going wet ----
       Two layers turning against each other at different rates. One is a
       texture sitting on the ground; two, sliding, is a film with something
       moving in it. */
    pool = addFloorPlane(1, spillTexture(7, "198,116,44"),
      { x: -20, y: -60, z: OUTRO_FLOOR_Z, order: 5 });
    wet = addFloorPlane(1, spillTexture(31, "168,96,40"),
      { x: 40, y: -120, z: OUTRO_FLOOR_Z + 0.2, order: 6 });

    /* ---- the crop ---- */
    // Nine painted clumps, reused with a flip and a colour tint rather than
    // thirty canvases: 30 x 512^2 is 30 MB of texture for variety that a
    // mirrored copy and a warm/cool multiply give for nothing.
    const arts = [];
    for (let k = 0; k < 9; k++) arts.push(shootTexture(k + 1, k % 3 === 0));
    const rnd = outroRnd(9001);
    for (let i = 0; i < 30; i++) {
      // One jittered band, not two clean rings — concentric rings read as a
      // fence around the machine rather than as ground that has come alive.
      const a = (i / 30) * Math.PI * 2 + (rnd() - 0.5) * 0.36;
      const q = rnd();
      const rad = SHOOT_RAD[0] + q * (SHOOT_RAD[1] - SHOOT_RAD[0]);
      // Shorter the further out it is. Sprites scale correctly with distance,
      // but the closing camera looks DOWN: a full-height clump on the far arc
      // still projects into the upper third of frame, and two of them came up
      // through the letters of the closing mark.
      const h = (92 + rnd() * 170) * (1 - 0.45 * q);
      const tex = arts[i % 9].clone();
      tex.needsUpdate = true;
      if (rnd() < 0.5) { tex.repeat.x = -1; tex.offset.x = 1; }   // mirrored
      const warm = 0.86 + rnd() * 0.28;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false,
        toneMapped: false, fog: false
      }));
      sp.material.color.setRGB(warm, 1.0, 0.84 + rnd() * 0.3).convertSRGBToLinear();
      sp.center.set(0.5, 0);       // grows UP off the floor, and sways from its root
      sp.position.set(Math.cos(a) * rad * 0.86, Math.sin(a) * rad, OUTRO_FLOOR_Z);
      sp.scale.set(h * 1.05, 0.01, 1);
      sp.renderOrder = 8;
      root.add(sp);

      // the protectant being taken up, right where the shoot breaks ground
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: blobTexture("214,138,62"), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
        toneMapped: false, fog: false
      }));
      glow.scale.set(h * 0.55, h * 0.22, 1);
      glow.position.set(sp.position.x, sp.position.y, OUTRO_FLOOR_Z + 1);
      glow.renderOrder = 7;
      root.add(glow);

      // Where it meets the ground. Over the wet — which is additive amber —
      // a dark ellipse reads as the plant sitting IN the liquid; without it
      // the clumps hover a few millimetres above their own reflection.
      const sh = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softTexture("0,0,0", 0.30), color: hexColor(0x1a0f06),
        transparent: true, opacity: 0, depthWrite: false,
        toneMapped: false, fog: false
      }));
      sh.scale.set(h * 0.95, h * 0.34, 1);
      sh.position.set(sp.position.x, sp.position.y, OUTRO_FLOOR_Z + 0.5);
      sh.renderOrder = 7;
      root.add(sh);

      plants.push({
        sp: sp, glow: glow, shadow: sh, h: h,
        // distance along the wind's bearing, so a gust arrives at each clump
        // in turn instead of the whole field nodding at once
        gx: sp.position.x * 0.94 + sp.position.y * 0.34,
        // Staggered by RADIUS, not at random: the wet spreads outward, so the
        // crop has to come up outward too or the two effects are unrelated.
        t0: q * 1.15 + rnd() * 0.22,
        sway: 0.42 + rnd() * 0.5, phase: rnd() * 6.28,
        lean: (rnd() - 0.5) * 0.05,
        dim: 1.0 - 0.30 * q                     // the far ones sit back
      });
    }
  }

  function outroFrame(t) {
    const O = ST.outro;
    // settles with the frame as the mark comes up, rather than staying at full
    // strength while everything toneMapped around it dims
    const close = 1 - 0.30 * ramp(t, ST.mark + 0.4, STORY_DUR - 0.5);

    /* the drop leaves the machine */
    if (drop) {
      // It used to appear at the outlet already at full size and already
      // falling. A drop gathers, hangs, necks, and only then lets go — a third
      // of a second that costs nothing and is the whole reason it reads as
      // liquid leaving a machine rather than as a sprite being switched on.
      const f = ramp(t, O.drop[0] - 0.34, O.drop[0]);
      const d = ramp(t, O.drop[0], O.drop[1]);
      if (d < 0.002 && f > 0.002) {
        drop.material.opacity = 0.92 * f;
        drop.position.set(-28, -99, 258);
        const neck = ramp(t, O.drop[0] - 0.11, O.drop[0]);
        drop.scale.set(16 * (0.34 + 0.66 * f) * (1 - 0.18 * neck),
                       22 * (0.30 + 0.70 * f) * (1 + 0.55 * neck), 1);
      } else if (d > 0.002 && d < 0.998) {
        drop.material.opacity = 1.0;
        drop.position.set(-28, -99, 258 - (258 - OUTRO_FLOOR_Z) * d);
        drop.scale.set(16, 22 * (1 + 2.4 * d), 1);     // stretches as it falls
      } else {
        drop.material.opacity = 0;
      }
    }
    const hit = O.drop[1];
    if (crown) {
      // out fast and thinning as it goes, the way a sheet of liquid does
      const u = ramp(t, hit, hit + 0.50);
      // Fades to a residue rather than to nothing: a crown collapses onto the
      // floor, it does not evaporate, and the ring it leaves is what the pool
      // then creeps out to meet.
      crown.material.opacity = (0.90 * Math.sin(Math.min(1, u) * Math.PI)
                              + 0.16 * u * (1 - ramp(t, hit + 1.1, hit + 2.6))) * close;
      const s = 80 + u * 1240;
      crown.scale.set(s * (1 + 0.05 * Math.sin(t * 7)), s * 0.93, 1);
      crown.rotation.z = 0.22 * u;
    }
    if (jet) {
      // the rebound: the column that comes back up out of the centre
      const u = ramp(t, hit + 0.05, hit + 0.40);
      const rise = 4 * u * (1 - u);                  // up and back down
      jet.material.opacity = 0.80 * rise * close;
      jet.position.set(-28, -99, OUTRO_FLOOR_Z);
      jet.scale.set(16 + 10 * (1 - rise), 26 + 120 * rise, 1);
    }
    beads.forEach(function (b) {
      const a0 = hit + b.t0, u = ramp(t, a0, a0 + b.dur);
      const flying = u > 0.001 && u < 0.999;
      if (flying) {
        const x = -28 + Math.cos(b.a) * b.r * u, y = -99 + Math.sin(b.a) * b.r * u;
        const z = OUTRO_FLOOR_Z + 4 * b.h * u * (1 - u);      // a parabola, not a fade
        b.sp.position.set(x, y, z);
        // stretched along its travel while it is moving fastest, round at the top
        const stretch = 1 + 1.5 * Math.abs(0.5 - u) * 2;
        b.sp.scale.set(b.size, b.size * stretch, 1);
        b.sp.material.opacity = 0.9 * Math.min(1, u * 8) * close;
      } else {
        b.sp.material.opacity = 0;
      }
      // and the mark it leaves once it is down
      const m = ramp(t, a0 + b.dur, a0 + b.dur + 0.5);
      b.mark.position.set(-28 + Math.cos(b.a) * b.r, -99 + Math.sin(b.a) * b.r,
                          OUTRO_FLOOR_Z + 0.3);
      // Wide and faint, so the marks overlap into a wet field. Small and
      // bright they read as embers scattered on the floor, not as liquid.
      const ms = b.size * (9 + 16 * m);
      b.mark.scale.set(ms, ms * 0.88, 1);
      b.mark.material.opacity = 0.22 * m * (1 - 0.5 * ramp(t, a0 + 1.6, a0 + 3.2)) * close;
    });
    if (splash) {
      // the wet mark at the point of impact, which becomes the pool
      const u = ramp(t, hit, hit + 0.70);
      splash.material.opacity = 0.55 * Math.min(1, u * 2.2)
                              * (1 - 0.45 * ramp(t, hit + 0.8, hit + 2.0)) * close;
      const s = 70 + u * 860;
      splash.scale.set(s, s * 0.9, 1);
    }

    /* the floor goes wet */
    const pu = ramp(t, O.pool[0], O.pool[1]);
    // Thinning as it spreads. Held at full strength across two and a half
    // metres the wash stopped reading as a film on the floor and became a
    // light source — a soft bright haze behind the machine, which is what a
    // large additive sprite with no structure left in it looks like.
    const thin = 1 - 0.42 * pu;
    if (pool) {
      pool.material.opacity = 0.44 * pu * thin * close;
      const s = 180 + pu * 2600;
      pool.scale.set(s, s * 0.88, 1);
      pool.rotation.z = 0.14 * pu;
    }
    if (wet) {
      wet.material.opacity = 0.26 * ramp(t, O.pool[0] + 0.35, O.pool[1]) * thin * close;
      const s = 140 + pu * 2200;
      wet.scale.set(s * 0.94, s, 1);
      wet.rotation.z = -0.21 * pu + 0.02 * Math.sin(t * 0.5);
    }

    /* and the crop comes up in it */
    // One gust crossing the field at about half a metre a second, roughly one
    // wavelength wide. Every plant also has its own small idle motion, but the
    // gust is what makes it read as air moving rather than as thirty separate
    // objects that happen to be animated.
    const gustPhase = t * 1.6;
    plants.forEach(function (p) {
      const a = O.plants[0] + p.t0, b = a + 1.15;
      const raw = ramp(t, a, b);
      // Fast out of the ground, then settling. A plain smoothstep is slow at
      // BOTH ends, and a shoot that starts slowly does not look like it is
      // being pushed up by anything.
      const u = Math.pow(raw, 0.62);
      const gust = Math.sin(gustPhase - p.gx * 0.0030) * (0.62 + 0.38 * Math.sin(t * 0.41));
      const sway = 0.45 * Math.sin(t * p.sway + p.phase) + 0.95 * gust;
      // a little overshoot as it reaches height, then a slow sway from the root
      const over = 1 + 0.075 * ramp(t, a + 0.55, a + 0.85) * (1 - ramp(t, a + 0.80, a + 1.45));
      p.sp.material.opacity = 0.74 * p.dim * u * close;
      p.sp.material.rotation = (p.lean + 0.021 * sway) * u;
      p.sp.scale.set(p.h * 1.05 * (1 + 0.016 * sway), Math.max(0.01, p.h * u * over), 1);
      // the shadow leans with it, and only exists where there is wet to darken
      p.shadow.material.opacity = 0.42 * u * Math.min(1, pu * 2.4) * close;
      p.shadow.scale.set(p.h * 0.95 * (1 + 0.05 * sway), p.h * 0.34, 1);
      p.shadow.material.rotation = 0.10 * sway * u;
      // the root glow peaks as it breaks ground and is gone by the time it is up
      p.glow.material.opacity =
        0.40 * p.dim * close * Math.sin(Math.min(1, ramp(t, a - 0.12, a + 0.75)) * Math.PI);
    });
  }


  /* ====================================================================== */
  /* The small stuff                                                        */
  /* ====================================================================== */
  // None of this carries a beat. It is the difference between a CAD model
  // rendered against black and a machine standing in a room at night: air with
  // something in it, light that lands on the floor instead of stopping at the
  // glass, and a crop that moves the way a crop moves.
  let motes = [], halo = null, spill = null;

  // A soft round falloff, opaque at the centre and gone at the rim.
  function softTexture(rgb, core) {
    const n = 128, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0.00, "rgba(" + rgb + ",1)");
    r.addColorStop(core, "rgba(" + rgb + ",0.42)");
    r.addColorStop(0.62, "rgba(" + rgb + ",0.10)");
    r.addColorStop(1.00, "rgba(" + rgb + ",0)");
    g.fillStyle = r; g.fillRect(0, 0, n, n);
    return texFrom(c);
  }

  // Light escaping AROUND the panel, not a lamp shining through it. The first
  // pass used a plain radial falloff centred on the glass, and while the screen
  // had content on it nobody noticed — but the moment the content cut to black
  // (the page blink at 8.25, the beat before the alarm) what was left was a
  // round green smear sitting in the middle of a dark display.
  //
  // Built by blurring a rectangle the size of the aperture and then punching
  // the aperture back out of it, so all that survives is the outward bleed.
  function bezelGlowTexture(fx, fy) {
    const n = 256, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const w = n * fx, h = n * fy, x = (n - w) / 2, y = (n - h) / 2;
    g.filter = "blur(17px)";
    g.fillStyle = "#ffffff";
    g.fillRect(x, y, w, h);
    g.filter = "none";
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "#000000";
    g.fillRect(x, y, w, h);
    g.globalCompositeOperation = "source-over";
    return texFrom(c);
  }

  function buildDetail() {
    /* ---- dust in the air ----
       Sixty specks drifting through the volume the machine stands in. They do
       nothing except prove there is air between the camera and the subject,
       which is most of what separates a render from a photograph. Biased
       toward the machine because that is where the light is. */
    const tex = softTexture("236,238,232", 0.20);
    const mr = outroRnd(20260901);
    for (let i = 0; i < 60; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, fog: false
      }));
      const s = 1.6 + mr() * 3.2;
      sp.scale.set(s, s, 1);
      sp.renderOrder = 6;
      root.add(sp);
      motes.push({
        sp: sp,
        // cube-rooted radius packs them toward the middle instead of the shell
        x: -120 + (Math.pow(mr(), 0.6) * 2 - 1) * 780,
        y: (Math.pow(mr(), 0.6) * 2 - 1) * 760,
        z: mr() * 880,
        vx: (mr() - 0.5) * 12, vy: (mr() - 0.5) * 12, vz: 5 + mr() * 16,
        amp: 0.05 + mr() * 0.16, tw: 0.5 + mr() * 1.6, ph: mr() * 6.28
      });
    }

    /* ---- the display as a light source ----
       It was a bright rectangle that lit nothing. A halo in front of the glass
       and a pool of its colour on the floor is what makes it read as switching
       on rather than as a texture being swapped. */
    if (screenGroup && window.HMI) {
      const HX = 1.9, HY = 2.2;
      halo = new THREE.Mesh(
        new THREE.PlaneGeometry(HMI.APERTURE[0] * HX, HMI.APERTURE[1] * HY),
        new THREE.MeshBasicMaterial({
          map: bezelGlowTexture(1 / HX, 1 / HY), transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
          toneMapped: false, fog: false
        }));
      halo.position.set(0, 0, 3.2);
      halo.renderOrder = 6;
      screenGroup.add(halo);
    }
    // The machine's front is -x in Onshape, so the spill goes out that way —
    // but not far. Thrown 430mm out it projected below the bottom of frame at
    // the hero and was never seen; kept tight to the feet, where the brightest
    // part of a real spill is anyway, it lands on floor the camera can see.
    spill = addFloorPlane(1, softTexture("255,255,255", 0.30),
      { x: -235, y: -8, z: OUTRO_FLOOR_Z + 0.1, order: 4 });
    spill.scale.set(600, 820, 1);
  }

  const _screenTint = { boot: 0x9fe8cf, ui: 0x46c9a8, alert: 0xd8412e, off: 0x000000 };

  // The glow in the air in front of the glass, which is NOT the same signal as
  // the pixels. Driven straight off the screen state it snapped to black for
  // the four frames of the page blink at 8.25 and again on each of the alarm's
  // dark beats: the content cutting reads as a screen changing page, but a
  // half-metre of glow cutting with it reads as the whole machine glitching.
  //
  // Fast attack, ~0.12s release, which is what a backlight actually does — and
  // stateless, because the capture rig seeks out of order and a running filter
  // would give a different answer depending on how it got to this frame.
  function screenGlow(t) {
    let best = 0, tint = "off";
    for (let k = 0; k <= 9; k++) {
      const st = storyScreen(t - k * 0.030);
      const v = (st[0] === "off" ? 0 : st[1]) * Math.exp(-k * 0.030 / 0.12);
      if (v > best) { best = v; tint = st[0]; }
    }
    return [tint, best];
  }
  function detailFrame(t) {
    /* dust: only on the wides. Up close the camera is inside the volume they
       occupy and they read as specks on the lens. */
    const near = camera.position.length();
    const amt = clamp01((near - 700) / 600);
    motes.forEach(function (m) {
      const span = 1760;
      // drift, and wrap rather than respawn so nothing ever pops in
      const x = m.x + m.vx * t, y = m.y + m.vy * t, z = m.z + m.vz * t;
      m.sp.position.set(-120 + (((x + 120) % span) + span) % span - span / 2,
                        ((y % span) + span) % span - span / 2,
                        ((z % 900) + 900) % 900);
      m.sp.material.opacity = amt * m.amp * (0.55 + 0.45 * Math.sin(t * m.tw + m.ph));
    });

    /* the display's own light */
    const gs = screenGlow(t);
    const lit = gs[1];
    const tint = hexColor(_screenTint[gs[0]] || 0x000000);
    if (halo) {
      halo.material.opacity = 0.42 * lit;
      halo.material.color.copy(tint);
    }
    if (spill) {
      // gone by the time the panel carrying the screen leaves
      const alive = 1 - ramp(t, ST.panel[0] - 0.6, ST.panel[0]);
      spill.material.opacity = 0.19 * lit * alive;
      spill.material.color.copy(tint);
    }
  }

  /* ---------- the four callouts on the glass ----------
     Their own elements rather than the film's BEATS, which are bound to bodies
     and to the master timeline. These point at regions of an image on a screen,
     which is a different kind of anchor: the position comes from HMI.CELLS in
     the screen's own local millimetres and is pushed through the screen group's
     world matrix, so it stays correct however the panel is framed — and it
     leaves with the panel, because it is drawn on the panel. */
  const CALLS = [], cellFx = [], cellPop = [];
  let endMark = null;

  // Styled inline rather than in unveil.css. The stylesheet is shared with the
  // master film and with the wiki page's embeds; a closing card that only one
  // cut uses has no business becoming a class everything else has to carry.
  function buildEndMark() {
    const el = document.createElement("div");
    // Right of centre, not centred. Centred it lands on top of the machine at
    // every distance worth ending on, and pulling back far enough to clear it
    // made the tower small and the shot weak. Placed here it lands where the
    // hero card was, so the film closes on the composition it opened with.
    el.style.cssText = "position:absolute;left:70%;top:50%;transform:translate(-50%,-50%);" +
      "text-align:center;opacity:0;pointer-events:none;white-space:nowrap;";
    el.innerHTML =
      '<div style="font:650 3.4em/1 ui-sans-serif,-apple-system,\'Segoe UI\',sans-serif;' +
      'letter-spacing:.34em;text-indent:.34em;color:#eafff6">RELEAF</div>' +
      // Rules FLANKING the word, which is exactly what the boot logo wears on
      // the glass — so the film closes on the mark it opened with instead of a
      // near-miss of it. Set below the word instead they read as a dashed line.
      '<div style="margin-top:.9em;display:flex;align-items:center;' +
      'justify-content:center;gap:.9em">' +
      '<i style="display:block;height:.05em;width:1.9em;background:#2ec9a8;' +
      'opacity:.55;transform:scaleX(0);transform-origin:100% 50%"></i>' +
      '<div style="font:500 .82em/1 ui-monospace,SFMono-Regular,Menlo,monospace;' +
      'letter-spacing:.42em;text-indent:.42em;color:#8fd9bd">BIOREACTOR</div>' +
      '<i style="display:block;height:.05em;width:1.9em;background:#2ec9a8;' +
      'opacity:.55;transform:scaleX(0);transform-origin:0% 50%"></i></div>';
    layer.appendChild(el);
    el.__rules = el.querySelectorAll("i");
    return el;
  }

  // The bracket that lands on a cell as its callout arrives. Drawn once and
  // reused for all four: corner marks and a hairline frame, transparent in the
  // middle so the artwork underneath is untouched. Additive, so it adds light
  // to the glass rather than painting a box on top of it.
  function bracketTexture() {
    const W = 512, H = 256, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const m = 6, L = 46;
    g.strokeStyle = "rgba(120,246,208,0.5)"; g.lineWidth = 3;
    g.strokeRect(m, m, W - m * 2, H - m * 2);
    g.strokeStyle = "#a9ffe4"; g.lineWidth = 9; g.lineCap = "square";
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]
      .forEach(function (k) {
        g.beginPath();
        g.moveTo(k[0] + k[2] * L, k[1]); g.lineTo(k[0], k[1]);
        g.lineTo(k[0], k[1] + k[3] * L);
        g.stroke();
      });
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 16;
    return t;
  }

  function storyCallouts() {
    if (!window.HMI || !HMI.CELLS) return;
    const btex = bracketTexture();
    HMI.CELLS.forEach(function (c, i) {
      const el = document.createElement("div");
      el.className = "unv-call";
      // The cell already prints "Crop stress" in the corner it is pointing at;
      // repeating it tells a viewer nothing they cannot read. HMI.CELLS carries
      // a `note` that says what the choice is FOR.
      el.innerHTML = '<span class="unv-i">' + c.n + '</span>' +
                     '<span class="unv-t">' + (c.note || c.title) + '</span>';
      layer.appendChild(el);
      // and the bracket, in the screen's own frame so it rides the panel
      if (screenGroup) {
        const fx = new THREE.Mesh(
          new THREE.PlaneGeometry(c.at[2] + 3, c.at[3] + 3),
          new THREE.MeshBasicMaterial({
            map: btex, transparent: true, opacity: 0, toneMapped: false,
            depthWrite: false, blending: THREE.AdditiveBlending,
            polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -18
          }));
        fx.position.set(c.at[0], c.at[1], 1.9);   // between the artwork and the glass
        fx.renderOrder = 6;
        screenGroup.add(fx);
        cellFx.push(fx);

        // and a soft fill that flashes under the bracket, so the cell reads as
        // lighting up rather than as a frame being drawn around it. Soft-edged
        // on purpose — a hard rectangle over the artwork looks like a selection
        // box, not like the panel responding.
        const pn = 128, pc = document.createElement("canvas");
        pc.width = pc.height = pn;
        const pg = pc.getContext("2d");
        const pr = pg.createRadialGradient(pn / 2, pn / 2, 4, pn / 2, pn / 2, pn * 0.62);
        pr.addColorStop(0.0, "rgba(150,255,222,0.55)");
        pr.addColorStop(0.55, "rgba(90,225,190,0.20)");
        pr.addColorStop(1.0, "rgba(60,200,170,0)");
        pg.fillStyle = pr; pg.fillRect(0, 0, pn, pn);
        const ptex = new THREE.CanvasTexture(pc);
        ptex.encoding = THREE.sRGBEncoding;
        const pop = new THREE.Mesh(
          new THREE.PlaneGeometry(c.at[2] + 1, c.at[3] + 1),
          new THREE.MeshBasicMaterial({
            map: ptex, transparent: true, opacity: 0, toneMapped: false, fog: false,
            depthWrite: false, blending: THREE.AdditiveBlending,
            polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16
          }));
        pop.position.set(c.at[0], c.at[1], 1.86);
        pop.renderOrder = 5;
        screenGroup.add(pop);
        cellPop.push(pop);
      }
      const dot = document.createElement("i");
      dot.className = "unv-dot";
      layer.appendChild(dot);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "unv-line");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      svg.appendChild(path);
      layer.appendChild(svg);
      CALLS.push({
        space: "screen", at: [c.at[0], c.at[1], 8],
        el: el, dot: dot, svg: svg, path: path,
        t0: ST.label0 + i * ST.labelGap,
        // out to the nearer side, and clear of the glass vertically
        sx: c.at[0] < 0 ? -1 : 1,
        sy: c.at[1] < 0 ? -1 : 1
      });
    });

    // and one more, on the bottle, for the last beat. Same chip, different
    // frame: this one is anchored in the MODEL, not on the screen, because the
    // screen has left with the panel by the time it appears.
    const el = document.createElement("div");
    el.className = "unv-call";
    // The volume counts up to the figure the interface promised. The screen
    // says the run will make 2.5 L; twenty seconds later the bottle fills and
    // the number arrives at 2.5.
    el.innerHTML = '<span class="unv-i" id="unv-vol">0.0 L</span>' +
                   '<span class="unv-t">Protectant produced</span>';
    layer.appendChild(el);
    const dot = document.createElement("i");
    dot.className = "unv-dot";
    layer.appendChild(dot);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "unv-line");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(path);
    layer.appendChild(svg);
    CALLS.push({
      space: "model", at: [-28.1, -99.0, 222],
      el: el, dot: dot, svg: svg, path: path,
      t0: ST.bottleTag, keep: true, sx: 1, sy: 1
    });

    /* ---- the parts are NOT named ----
       There were three model-space callouts here on the wide — "Peristaltic
       pump", "Membrane column", "Culture vessel" — from 20.5 to 24.9s. They are
       gone at the team's request. The four interface callouts and the bottle's
       running total stay: those are the film's argument, and the part names
       were a diagram laid over the top of it. The part list still exists as
       text for screen readers (.unv-sr) and the master film's labelled pan is
       untouched — this removal is scoped to the story cut's own callouts. */

    volEl = document.getElementById("unv-vol");
    endMark = buildEndMark();
  }

  let volEl = null, lastStress = -1;
  const _cell = new THREE.Vector3();
  function placeCallouts(time, w, h) {
    if (!CALLS.length) return;
    // They live on the screen, so they leave when the screen does.
    // The screen callouts leave when the screen does; the bottle tag is on the
    // machine and rides to the last frame.
    const goneScreen = 1 - ramp(time, ST.alarm - 0.35, ST.alarm);
    CALLS.forEach(function (q, qi) {
      // Nothing survives into the closing. The bottle tag has said its piece by
      // the time the camera lets go, and a callout still hanging on beside the
      // end mark reads as a caption someone forgot to remove.
      // They used to vanish together in one frame, which reads as a bug rather
      // than an edit. They leave in the order they arrived.
      const stagger = 1 - ramp(time, ST.alarm - 0.75 + qi * 0.11,
                                     ST.alarm - 0.35 + qi * 0.11);
      const gone = q.until ? (1 - ramp(time, q.until[0], q.until[1]))
                 : q.keep  ? (1 - ramp(time, ST.out + 0.6, ST.out + 1.8))
                 : Math.min(goneScreen, stagger);
      const oDot  = ramp(time, q.t0, q.t0 + 0.12) * gone;
      const oLine = ramp(time, q.t0 + 0.09, q.t0 + 0.30) * gone;
      const oChip = ramp(time, q.t0 + 0.22, q.t0 + 0.48) * gone;
      if ((q.space === "screen" && !screenGroup) || oDot < 0.002) {
        q.el.style.opacity = 0; q.dot.style.opacity = 0; q.svg.style.opacity = 0;
        return;
      }
      // 8mm proud of the glass so the dot sits on the artwork, not in it
      _cell.set(q.at[0], q.at[1], q.at[2]);
      if (q.space === "screen") screenGroup.localToWorld(_cell);
      else spin.localToWorld(_cell);          // Onshape coords, inside root
      _cell.project(camera);
      const ax = (_cell.x * 0.5 + 0.5) * w, ay = (-_cell.y * 0.5 + 0.5) * h;
      const k = overlayEm / 16;
      // The bottle tag sits closer in than the screen callouts. Those have to
      // clear a screen that fills most of the frame; this one points at one
      // object with room around it, and at the cells' offset the leader
      // stretched most of the way across frame to reach a chip on the edge.
      const reach = q.space === "model" ? 132 : 196;
      const ox = q.sx * reach * k, oy = q.sy * (q.space === "model" ? -96 : -58) * k;
      // Bigger than the film's part tags. Those sit beside a part they must not
      // cover; these are the four things the whole middle of the piece is about,
      // and at the film's size they read as footnotes.
      //
      // Set BEFORE the width is measured. Measured first, offsetWidth returns
      // the size the chip had on the previous frame — one frame stale, and on a
      // seek (which renders exactly one frame) permanently stale. The left-hand
      // chips are positioned by their right edge, so an under-measured width put
      // their left edge off the frame.
      q.el.style.fontSize = (overlayEm * 1.3) + "px";
      // Clamp against the CHIP's own width, not against its anchor point. A
      // right-hand chip is positioned by its left edge, so clamping the anchor
      // to w-12 puts the left edge just inside the frame and the whole label
      // outside it — "02 CROP" and "04 PROTECTANT" were both running off.
      const cw = q.el.offsetWidth || 96;
      // A margin proportional to the frame, not 12 flat pixels — at 1080p that
      // put the plates 1.6% from the edge, which reads as type falling off the
      // picture rather than as a layout.
      const M = Math.max(14, w * 0.055);
      const tx = q.sx < 0 ? Math.max(M + cw, ax + ox)
                          : Math.min(w - M - cw, ax + ox);
      const ty = Math.min(h - M * 0.5, Math.max(M * 0.5, ay + oy));

      q.dot.style.opacity = oDot;
      q.dot.style.transform = "translate(" + ax + "px," + ay + "px)";
      q.el.style.opacity = oChip;
      // it arrives from the anchor rather than fading in place
      const slide = 1 - oChip;
      q.el.style.transform = "translate(" + (tx - ox * 0.22 * slide) + "px," +
                             (ty) + "px) translate(" +
                             (q.sx < 0 ? "-100%" : "0") + ",-50%)";
      q.svg.style.opacity = oLine;
      // an elbow, drawn out of the dot
      const ex = ax + ox * 0.62 * oLine, ey = ay + oy * oLine;
      q.path.setAttribute("d", "M" + ax + "," + ay + " L" + ex + "," + ay +
                               " L" + ex + "," + ey + " L" +
                               (ax + ox * oLine) + "," + ey);
      q.path.setAttribute("stroke-width", Math.max(1, k).toFixed(2));
    });
  }

  function storyFrame(t) {
    // the cell brackets: a flash as the callout lands, then they hold at a low
    // level so the named cell stays marked while the next one arrives
    cellFx.forEach(function (fx, i) {
      const t0 = ST.label0 + i * ST.labelGap;
      const land = ramp(t, t0 - 0.10, t0 + 0.18);
      const flash = ramp(t, t0 - 0.08, t0 + 0.06) * (1 - ramp(t, t0 + 0.08, t0 + 0.72));
      const gone = 1 - ramp(t, ST.alarm - 0.35, ST.alarm);
      fx.material.opacity = (0.34 * land + 0.72 * flash) * gone;

      // The pop. It comes in oversized, settles THROUGH its resting size to
      // about 2% under, and comes back — a spring, not a fade. A pure ease-in
      // reads as something being placed; the small overshoot is what makes it
      // read as the panel reacting.
      const over = ramp(t, t0 + 0.10, t0 + 0.32) * (1 - ramp(t, t0 + 0.30, t0 + 0.58));
      const k = 1 + 0.095 * (1 - land) - 0.021 * over;
      fx.scale.set(k, k, 1);

      const p = cellPop[i];
      if (p) {
        const rise = ramp(t, t0 - 0.06, t0 + 0.09);
        const fall = 1 - ramp(t, t0 + 0.11, t0 + 0.62);
        p.material.opacity = 0.34 * rise * fall * gone;
        const pk = 1 + 0.055 * (1 - land);
        p.scale.set(pk, pk, 1);
      }
    });
    /* ---- the dial moves ----
       The gauge used to read High from the moment the interface appeared, which
       gave the ending away seven seconds before it happened. It now sits low
       until the film points at it, then sweeps up into the red across the
       "how stressed the crop is" beat — so STRESS DETECTED arrives as the
       consequence of something the viewer just watched.
       The texture is only rebuilt when the value moves a perceptible step: a
       1280x800 canvas re-uploaded every frame is about 4 MB a frame for no
       visible gain. */
    if (screenGroup && screenGroup.userData.redrawUI) {
      const b3 = ST.label0 + 2 * ST.labelGap;
      const stress = 0.16 + 0.56 * ramp(t, b3 - 0.05, b3 + 1.05);
      const q = Math.round(stress * 40) / 40;
      if (q !== lastStress) {
        lastStress = q;
        screenGroup.userData.redrawUI(5, { stress: q });
      }
    }

    // screen
    if (screenGroup && screenGroup.userData.setScreen) {
      const s = storyScreen(t);
      screenGroup.userData.setScreen(s[0], s[1]);
    }
    // aura, and the warm side that keeps it from being one flat hue
    const a = ramp(t, ST.aura[0], ST.aura[1]);
    if (auraA) auraA.intensity = 1.35 * a;
    if (auraB) auraB.intensity = 0.95 * a;
    if (auraGlow) auraGlow.material.opacity = 0.22 * a;
    if (warmLight) warmLight.intensity = 0.42 * a;

    // the exterior rim: up as the machine appears, down as we go inside
    const ext = ramp(t, 2.0, 3.6) * (1 - ramp(t, ST.panel[0] - 0.6, ST.panel[1]));
    if (heroKick) heroKick.intensity = 0.62 * ext;
    if (heroTop) heroTop.intensity = 0.30 * ext;

    // the alarm spilling out of the glass onto the panel. It follows the
    // screen's own stutter rather than a smooth ramp, so the light on the bezel
    // flickers with the display that is casting it.
    if (alarmLight) {
      const sc = storyScreen(t);
      alarmLight.intensity = sc[0] === "alert" ? 1.5 * sc[1] : 0;
    }

    // the pump turning. Rate follows the dash speed, so what the tubes show
    // moving and what is moving it agree.
    // rampInt, not ramp. `angle = t * RATE * ramp(t)` ramps the ANGLE, and its
    // derivative is RATE*s + RATE*t*s' — with t around 21 seconds the second
    // term dominates completely. Measured, the rotor peaked at 92.7 rad/s
    // against an intended 5, a 19x overspeed that then braked back down: at
    // 60fps that is 0.246 rev/frame on a three-lobe rotor whose symmetry period
    // is 0.333, so it aliased into a slow BACKWARDS crawl and then a
    // deceleration — the exact opposite of a pump starting up.
    const spun = rampInt(t, ST.flow[0] - 1.2, ST.flow[0] + 0.6);
    rotors.forEach(function (r) {
      r.mesh.rotation[r.axis] = r.dir * 5.0 * spun;
    });

    // the display's sweep, once, as the interface arrives
    if (sweep) {
      const u = ramp(t, ST.uiSwitch + 0.10, ST.uiSwitch + 0.62);
      const on = u > 0 && u < 1;
      sweep.material.opacity = on ? 0.85 * Math.sin(u * Math.PI) : 0;
      sweep.material.map.offset.y = 0.5 - u * 1.4;
    }

    // the closing mark
    if (endMark) {
      const up = ramp(t, ST.mark, ST.mark + 1.3);
      endMark.style.opacity = up;
      // overlayEm * (16 / overlayEm * 1.35) is just 16 * 1.35 — the overlayEm
      // cancels, so this was pinned at 21.6px at every embed width, which is the
      // one thing the em-based overlay exists to avoid.
      endMark.style.fontSize = (overlayEm * 1.35) + "px";
      // it settles up into place rather than appearing
      endMark.style.transform = "translate(-50%,-50%) translateY(" + (10 * (1 - up)) + "px)";
      // the rules draw outward from the centre, after the type has landed
      const rw = ramp(t, ST.mark + 0.45, ST.mark + 1.35);
      if (endMark.__rules) endMark.__rules.forEach(function (i2) {
        i2.style.transform = "scaleX(" + rw.toFixed(4) + ")";
      });
    }
    // circuit
    const f = ramp(t, ST.flow[0], ST.flow[1]);
    const off = -(t * FLOW_SPEED) / DASH_MM;
    flowMats.forEach(function (m) {
      m.opacity = 0.92 * f;
      m.map.offset.x = off;
    });
    const ft = ramp(t, ST.tubes[0], ST.tubes[1]);
    tubeMats.forEach(function (m) { m.opacity = 0.80 * ft; });
    // the counter is driven off the same ramp as the liquid, so the number and
    // the level can never disagree
    if (volEl) {
      volEl.textContent = (2.5 * ramp(t, ST.fill[0], ST.fill[1])).toFixed(1) + " L";
    }

    // protectant collecting
    if (liquid) {
      const u = ramp(t, ST.fill[0], ST.fill[1]) * 0.72;
      const on = u > 0.002;
      const level = liquidBase.z0 + u * liquidBase.h;
      liquid.visible = on;
      liquid.scale.z = Math.max(0.0001, u * liquidBase.h);
      if (liquidTop) {
        liquidTop.visible = on;
        // A shallow ripple while it is actually rising, settling to flat once
        // it stops. Sub-millimetre — it is the difference between a surface and
        // a lid, not a wave.
        const rising = 1 - ramp(t, ST.fill[1] - 1.2, ST.fill[1]);
        liquidTop.position.set(-28.1, -99.0,
          level + Math.sin(t * 5.2) * 0.35 * rising);
      }
      bubbles.forEach(function (b) {
        // climb from the floor to just under the surface, then restart
        const span = Math.max(6, level - liquidBase.z0 - 3);
        const k = (b.phase + t * b.speed) % 1;
        const z = liquidBase.z0 + 2 + k * span;
        b.sp.position.set(b.x, b.y, z);
        // fade in off the floor, out as it reaches the surface, and away
        // entirely once the run has finished filling
        b.sp.material.opacity =
          0.55 * on * Math.min(1, k * 6) * (1 - ramp(k, 0.82, 1.0)) *
          (1 - ramp(t, ST.fill[1] - 0.6, ST.fill[1] + 0.8));
      });
    }
  }

  const K = K_MAIN;
  const DURATION = IS_ORBIT ? ORBIT_DUR : IS_BOOT ? 7.0
                 : IS_STORY ? STORY_DUR : (WIN[1] - WIN[0]);
  // master-timeline time for a given playhead position
  // Where on the master timeline the scripted properties (exposure, the plate,
  // the panel, the labels) should be read from. The orbit is pinned to 7.8s —
  // the hero moment: fully lit, panel on, card up, nothing named yet.
  function scriptTime(local) {
    if (IS_ORBIT) return 7.8;
    if (IS_BOOT) return 7.8;      // machine fully lit; the screen has its own clock
    if (IS_STORY) return local;   // its own timeline start to finish
    return WIN[0] + local;
  }

  // A screen does not fade up, it strikes: the backlight catches, drops, catches
  // again, then holds. Same shape as the nameplate's flicker, which is the
  // film's established language for something switching on.
  //
  // The strike waits for the camera. The mark spans 86% of the glass, so until
  // about 1.05s the frame is still inside it and the first flash would read
  // "ELEAF" with the R off the edge.
  function bootGlow(t) {
    if (t < 1.05) return 0;
    if (t < 1.15) return 0.75;
    if (t < 1.24) return 0.04;
    if (t < 1.36) return 1.0;
    if (t < 1.43) return 0.18;
    if (t < 1.54) return 0.9;
    return 0.55 + 0.45 * ramp(t, 1.54, 2.3);
  }

  // Non-uniform Hermite, not plain Catmull-Rom. Plain Catmull-Rom assumes every
  // segment takes the same time; these do not (0.3s at the close, 1.9s across
  // the middle of the pan), and the mismatch makes the derivative jump at every
  // knot. Measured at 60fps that was 16,200 mm/s^2 of acceleration landing
  // exactly on the keyframe times — a visible tick in the move. Scaling each
  // tangent by its own neighbouring time spacing makes it C1 in *time*, which
  // is the continuity the eye is actually judging.
  // Fritsch-Carlson limiting on top of the finite-difference tangents. Without
  // it the spline overshoots between keys: measured, yaw ran past the 45-degree
  // hold to 46.32 and came back — a visible rotation reversal during the beat
  // the brief says must hold, and no retune of the three hold keys removes it,
  // because the tangent at the last hold key reaches across to the straighten
  // that follows. Zeroing the tangent on a sign flip and capping it at three
  // times the smaller neighbouring secant makes each segment monotone, so the
  // curve can never leave the interval its own keys define — which also stops
  // fov and distance dipping below their keyed values.
  function hermite(p0, p1, p2, p3, t0, t1, t2, t3, u) {
    const h = t2 - t1;
    const d1 = (p1 - p0) / Math.max(1e-6, t1 - t0);
    const d2 = (p2 - p1) / Math.max(1e-6, h);
    const d3 = (p3 - p2) / Math.max(1e-6, t3 - t2);
    let m1 = (p2 - p0) / Math.max(1e-6, t2 - t0);
    let m2 = (p3 - p1) / Math.max(1e-6, t3 - t1);
    if (d1 * d2 <= 0) m1 = 0;
    else m1 = Math.sign(d2) * Math.min(Math.abs(m1), 3 * Math.min(Math.abs(d1), Math.abs(d2)));
    if (d2 * d3 <= 0) m2 = 0;
    else m2 = Math.sign(d2) * Math.min(Math.abs(m2), 3 * Math.min(Math.abs(d2), Math.abs(d3)));
    m1 *= h; m2 *= h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1 +
           (u3 - 2 * u2 + u) * m1 +
           (-2 * u3 + 3 * u2) * p2 +
           (u3 - u2) * m2;
  }
  const _t = new THREE.Vector3();
  function sample(time) {
    if (IS_ORBIT) return orbitPose(time);
    const K = IS_BOOT ? K_BOOT : IS_STORY ? K_STORY : K_MAIN;
    const n = K.length;
    let i = 0;
    while (i < n - 2 && time >= K[i + 1][0]) i++;
    const a = K[Math.max(0, i - 1)], b = K[i], c = K[Math.min(n - 1, i + 1)],
          d = K[Math.min(n - 1, i + 2)];
    // Endpoint knots get a mirrored time so the first and last segments do not
    // inherit a zero-length span and blow the tangent up.
    const t0 = a === b ? b[0] - (c[0] - b[0]) : a[0];
    const t3 = d === c ? c[0] + (c[0] - b[0]) : d[0];
    const span = Math.max(1e-6, c[0] - b[0]);
    const u = Math.min(1, Math.max(0, (time - b[0]) / span));
    const H = function (pa, pb, pc, pd) {
      return hermite(pa, pb, pc, pd, t0, b[0], c[0], t3, u);
    };
    _t.set(H(a[1].x, b[1].x, c[1].x, d[1].x),
           H(a[1].y, b[1].y, c[1].y, d[1].y),
           H(a[1].z, b[1].z, c[1].z, d[1].z));
    return {
      target: _t,
      dist: H(a[2], b[2], c[2], d[2]),
      yaw: H(a[3], b[3], c[3], d[3]),
      pitch: H(a[4], b[4], c[4], d[4]),
      fov: H(a[5], b[5], c[5], d[5])
    };
  }

  /* ---------- scripted properties ---------- */
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  // Push the subject left while the hero card is up, by sliding the whole
  // frustum rather than moving the camera: moving the camera would swing the
  // three-quarter angle, and the angle is the shot.
  function frameShift(time) {
    return 0.26 * ramp(time, 4.9, 6.5) * (1 - ramp(time, 9.5, 10.7));
  }
  function ramp(t, a, b) { const u = clamp01((t - a) / Math.max(1e-6, b - a)); return u * u * (3 - 2 * u); }
  // The integral of that ramp, in seconds of "full rate". Needed wherever a
  // ramp is a RATE rather than a level: multiplying an accumulated quantity by
  // the ramp scales the quantity, not its derivative, which is a different and
  // much wilder function. See the rotors in storyFrame().
  // Integral of u^2(3-2u) du is u^3 - u^4/2, which reaches 0.5 at u = 1 — so a
  // completed ramp is worth half its own width, and full rate thereafter.
  function rampInt(t, a, b) {
    const w = Math.max(1e-6, b - a);
    if (t <= a) return 0;
    if (t >= b) return w * 0.5 + (t - b);
    const u = (t - a) / w;
    return w * (u * u * u - u * u * u * u / 2);
  }

  // The room comes up, not just the subject. The plate is drawn with
  // toneMapped:false so it keeps its own whites while everything around it is
  // still at 3% exposure — which is what makes the strike read as a light
  // coming on in the dark rather than a texture fading in. Without this the
  // opening frame was a mid-grey panel with a logo already on it.
  function exposure(t) {
    if (t < 1.5) return 0.03;
    if (t < 3.4) return 0.03 + 0.32 * ramp(t, 1.5, 3.4);
    return 0.35 + 0.65 * ramp(t, 3.4, 5.8);
  }

  // A nameplate does not fade up, it strikes: two stutters and then it holds.
  function plateGlow(t) {
    if (t < 0.35) return 0;
    if (t < 0.44) return 0.85;
    if (t < 0.52) return 0.05;
    if (t < 0.60) return 1.0;
    if (t < 0.66) return 0.25;
    return 0.55 + 0.45 * ramp(t, 0.66, 1.5);
  }
  const PANEL_OFF = [9.1, 10.7];      // front panel travels away
  const INSIDE = [10.8, 19.4];        // internals are the subject
  const LABELS_IN = 12.0;             // first callout
  const LABEL_GAP = 0.66;             // and the flyby cadence after it
  // The brief is explicit that the labels accumulate and do not disappear, and
  // they used to clear at 18.3 — so the finished diagram, which is the payoff,
  // existed for 1.6s of a 20s film and the closing wide had nothing on it. They
  // now ride to the last frame; the ramp is past DURATION on purpose.
  const LABELS_OUT = 19.9;

  /* ---------- labels ----------
     DOM, not geometry in the scene. Text drawn into the 3D scene has to fight
     the tone mapping curve for its whites and resamples every time the camera
     moves; an overlay stays crisp at any distance and can use the site's own
     type. Anchors are projected each frame. */
  const layer = document.createElement("div");
  layer.className = "unv-layer";
  // opacity:0 does not prune the accessibility tree, so without this every
  // embed reads out "GEMS-TAIWAN HARDWARE Bioreactor 01 MEMBRANE COLUMN 02
  // RESERVOIR BOTTLE ..." as loose text. The same names are exposed once, in
  // order, as a real list below.
  layer.setAttribute("aria-hidden", "true");
  stage.appendChild(layer);

  const heroEl = document.createElement("div");
  heroEl.className = "unv-hero";
  heroEl.innerHTML = '<span class="unv-hero-k">GEMS-TAIWAN · HARDWARE</span>' +
                     '<span class="unv-hero-t">Bioreactor</span>' +
                     '<span class="unv-hero-s">Benchtop unit · PC-tower chassis</span>';
  layer.appendChild(heroEl);

  BEATS.forEach(function (b, i) {
    // The story names the four choices on the screen, not the seven bodies —
    // pushing these past the end is how they stay out of its way.
    b.t0 = IS_STORY ? 1e9 : LABELS_IN + i * LABEL_GAP;
    const el = document.createElement("div");
    el.className = "unv-call";
    el.innerHTML = '<span class="unv-i">' + b.n + '</span>' +
                   '<span class="unv-t">' + b.title + '</span>';
    layer.appendChild(el);
    b.el = el;
    b.dot = document.createElement("i");
    b.dot.className = "unv-dot";
    layer.appendChild(b.dot);
    b.line = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    b.line.setAttribute("class", "unv-line");
    b.path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    b.line.appendChild(b.path);
    layer.appendChild(b.line);
  });

  /* ---------- frame ---------- */
  let t = 0, playing = false, raf = null, last = 0, onScreen = true;
  let overlayEm = 16;
  let lastShadowState = -1;
  let t0abs = 0;
  let lastDist = 800;
  const _v = new THREE.Vector3();
  const _camRight = new THREE.Vector3();

  function render(local) {
    const time = scriptTime(local);
    const camTime = (IS_ORBIT || IS_BOOT || IS_STORY) ? local : time;
    const s = sample(camTime);
    lastDist = s.dist;
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
    camera.position.set(
      s.target.x + s.dist * Math.sin(s.yaw) * Math.cos(s.pitch),
      s.target.y + s.dist * Math.sin(s.pitch),
      s.target.z + s.dist * Math.cos(s.yaw) * Math.cos(s.pitch));
    camera.lookAt(s.target);
    // The frustum shift exists to clear the right third of frame for the hero
    // card. The power-on scene has no card and is framed on the screen itself,
    // so applying it just pushed the screen half a frame to the left — which is
    // why the mark read "ELEAF" with the R off the edge.
    const sh = IS_BOOT ? 0 : (IS_STORY ? storyShift(time) : frameShift(time));
    // 1e-6, not 1e-3: the offset is sh * w pixels, so gating at 0.001 snapped
    // the frame by ~1.6px on a 1600px canvas, twice, both times inside a move
    // the brief asks to be continuous.
    if (sh > 1e-6) {
      const w = canvas.clientWidth || 1600, h = canvas.clientHeight || 900;
      // Positive offsetX slides the camera's window right across the full
      // image, which moves the subject LEFT in frame — which is the way round
      // that leaves the right third clean for the card.
      camera.setViewOffset(w, h, sh * w, 0, w, h);
    } else {
      camera.clearViewOffset();
    }

    // The power-on scene is lit down so the screen is the brightest thing in
    // frame — which is the whole point of it.
    renderer.toneMappingExposure = IS_BOOT ? 0.42
                                 : (IS_STORY ? storyExposure(time) : exposure(time));
    // The frame closes down as the room comes up, which is what a real lens
    // does. Defaults to 1 in the stylesheet, so every other cut is untouched.
    if (IS_STORY) {
      stage.style.setProperty("--vig",
        (0.62 + 0.38 * (1 - renderer.toneMappingExposure)).toFixed(3));
    }

    if (IS_STORY) { storyFrame(time); outroFrame(time); detailFrame(time); }
    else if (screenGroup && screenGroup.userData.setScreen) {
      if (IS_BOOT) screenGroup.userData.setScreen("boot", bootGlow(local));
      else screenGroup.userData.setScreen("ui", 1);
    }

    // front panel away
    const PW = IS_STORY ? ST.panel : PANEL_OFF;
    const panelU = frontPanel ? ramp(time, PW[0], PW[1]) : 0;
    if (plateMat) plateMat.opacity = plateGlow(time) * (1 - panelU);

    if (frontPanel) {
      const u = panelU;
      frontPanel.group.position.x = -u * 1040;  // far enough to actually clear frame
      // The story sends it out to the side as well. Straight at the lens it
      // passes through the middle of frame as a black slab covering half the
      // reveal — the one second where the machine is finally open is the one
      // second you cannot see it. Screen-right is decreasing CAD y on this
      // camera, so a negative y takes it out of shot instead of across it.
      // Further to the side than it used to go: the moment it passes the lens
      // was a black slab across half of the reveal it is uncovering. More
      // lateral travel gets it out of shot sooner without making it dissolve,
      // which would read as the panel dematerialising rather than lifting off.
      frontPanel.group.position.y = IS_STORY ? -u * 940 : 0;
      frontPanel.group.position.z = u * 45;     // and drifting up as it goes
      frontPanel.group.rotation.z = u * 0.055;  // and canting, the way a lifted
      frontPanel.group.rotation.y = -u * 0.03;  // plate does rather than gliding
      // It travels solid and only fades once it is most of the way out — a
      // panel that dissolves at the halfway mark, half-transparent across the
      // middle of frame, reads as dematerialising rather than as coming off.
      const pOp = 1 - ramp(u, 0.55, 1.0);
      frontPanel.mats.forEach(function (m) {
        m.transparent = pOp < 0.999;
        m.opacity = pOp;
        m.depthWrite = pOp > 0.98;
      });
      if (frontPanel.meshes) frontPanel.meshes.forEach(function (mesh) {
        mesh.castShadow = pOp > 0.5;      // r128's depth material ignores opacity
      });
    }

    // inside: the case quietens so the machine reads
    // The story holds the interior to the end rather than closing on a wide,
    // so it never fades the fill back out.
    const IW = IS_STORY ? [ST.panel[0] + 0.6, STORY_DUR + 2] : INSIDE;
    const inside = ramp(time, IW[0], IW[0] + 1.1) *
                   (1 - ramp(time, IW[1] - 1.0, IW[1]));
    fill.intensity = 0.34 * inside;
    // Off the lens axis, not just above it. On-axis it produced no terminator
    // across parts 130-390mm wide — everything it lit was lit flat — and it was
    // the strongest source on the interior. The right vector comes from the
    // quaternion, not matrixWorld: lookAt() writes only the quaternion and
    // matrixWorld is stale until renderer.render(), so reading the matrix here
    // would smear the fill laterally by one frame during the pan.
    _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    fill.position.copy(camera.position).addScaledVector(_camRight, -340);
    fill.position.y += 260;

    // The chassis stays solid. It used to dissolve to 8% for eight seconds —
    // 40% of the runtime — and what the brief actually asks for is one panel
    // coming off a box that reads black. Ghosting the whole shell turned the
    // hero object into an exploded CAD view with the far vent slots showing
    // through, and inverted the reading: the case was more transparent than
    // the plumbing it framed. With the front open and the key now coming from
    // the camera side, the light goes in through the opening the way it would
    // if you took the panel off in a room — which is also why the shell must
    // keep casting.

    // Rebuild the shadow map only while something that casts is actually
    // moving, rather than 60 times a second against 113 casters.
    const moving = panelU > 0.001 && panelU < 0.999;
    if (moving || lastShadowState !== 1) renderer.shadowMap.needsUpdate = true;
    lastShadowState = moving ? 0 : 1;

    // Each part lifts as it is named and stays lifted; the unnamed plumbing
    // sits back for the interior. Pushed through colour, not alpha: half the
    // interior is glass, and adding a second transparent pass over it sorts
    // badly at every camera angle and forces depthWrite to flip mid-move. A
    // darkened opaque part recedes just as well and never sorts wrong.
    const labelsOut = 1 - ramp(time, LABELS_OUT, LABELS_OUT + 0.7);
    BEATS.forEach(function (b) {
      b.on = ramp(time, b.t0, b.t0 + 0.34) * labelsOut;
      // A flare as it lands, and then nothing. It used to settle to 28% and
      // hold, which left every named part carrying a green tint for the rest of
      // the film — measured, the interior's dark cast ran (37,47,47). The part
      // staying lifted is the colour multiplier's job, below; this is only the
      // moment of being named, and it is near-white so it reads as light rather
      // than as the part changing colour.
      const pulse = ramp(time, b.t0, b.t0 + 0.10) *
                    (1 - ramp(time, b.t0 + 0.16, b.t0 + 0.85));
      const body = byKey[b.key];
      if (body) body.mats.forEach(function (m) {
        m.emissive = m.emissive || new THREE.Color();
        const k = pulse * labelsOut;
        m.emissive.setRGB(0.10 * k, 0.13 * k, 0.11 * k);
      });
    });

    bodies.forEach(function (b) {
      if (b.isCase) return;
      const named = b.beat ? b.beat.on : 0;
      // The recede exists so that a part being NAMED lifts out of a quietened
      // interior. The story names no parts — its callouts are on the screen, and
      // BEATS are pushed past the end — so `named` is 0 for every body forever,
      // and `inside` never fades because its window runs past the duration. The
      // result was every non-case body held at 60% of its measured albedo for
      // the whole back half of the film, including the bottle around the fill,
      // which is what made the protectant read as a bright column in a too-dark
      // bottle. Half a mechanism is worse than none.
      const dim = IS_STORY ? 1 : (1 - 0.40 * inside * (1 - named));
      b.mats.forEach(function (m) {
        if (!m.userData.base) return;
        m.color.copy(m.userData.base).multiplyScalar(dim);
      });
    });

    renderer.render(scene, camera);
    placeLabels(time);
  }

  const _anchor = new THREE.Vector3();

  function placeLabels(time) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // A zero-sized stage projects every anchor to the origin and the clamp then
    // pushes the tags to negative coordinates. Invisible either way, but it is
    // the same hidden-container case the ResizeObserver exists for, and there
    // is no point computing a layout for a frame nobody can see.
    if (!w || !h) return;

    // hero card: staged build rather than a fade — the brief asked for a label
    // that comes out, not one that appears
    // Out by 7.4, not 7.9: the push-in closed the gap while the headline was
    // still half up, so the type sat on top of the product for a beat.
    const HC = IS_STORY ? [3.45, 4.65, 5.75, 6.65] : [5.9, 6.9, 8.4, 9.6];
    const heroIn = ramp(time, HC[0], HC[1]), heroOut = 1 - ramp(time, HC[2], HC[3]);
    heroEl.style.opacity = heroOut;
    heroEl.style.transform = "translate(" + (18 * (1 - heroIn)) + "px,-50%)";
    heroEl.style.setProperty("--rule", ramp(time, HC[0], HC[0] + 0.48));
    heroEl.style.setProperty("--k",    ramp(time, HC[0] + 0.25, HC[0] + 0.62));
    heroEl.style.setProperty("--tw",   ramp(time, HC[0] + 0.40, HC[0] + 1.08));
    heroEl.style.setProperty("--s",    ramp(time, HC[0] + 0.82, HC[0] + 1.20));
    // Its own scale, not the callouts'. The callout floor exists so tags stay
    // legible on a small embed; applying that floor to the hero made the title
    // 11.7% of frame height on a phone and 4.7% everywhere else — it never got
    // big, which is the one thing the brief asked of it.
    heroEl.style.fontSize = (16 * Math.min(Math.max(w / 1280, 0.5), 2.0)) + "px";
    // Pulled in from the stylesheet's 6%. With the machine at this cut's squarer
    // hero angle the two sat a fifth of the frame apart, which reads as two
    // things sharing a frame rather than one composition.
    if (IS_STORY) heroEl.style.right = "15%";

    camera.updateMatrixWorld(true);
    if (IS_STORY) placeCallouts(time, w, h);
    // Offsets follow the type scale, not the raw width: below ~1040px the em
    // stops shrinking, and if the offsets kept shrinking the tags would start
    // overlapping the parts they point at.
    const k = overlayEm / 16;
    // Offsets are authored against the interior framing, where the machine is
    // 700-800mm away. At the closing wide it is 1650 away and half the size,
    // and a fixed pixel offset then flings each tag a long way from the part it
    // names, with a leader stretched across the frame to reach back. Scaling
    // with distance keeps every tag the same distance from its part *as the
    // viewer sees it*, at every framing in the film.
    const distK = Math.min(1.15, Math.max(0.45, 760 / lastDist));
    const ok = k * distK;
    const stroke = Math.max(1, k).toFixed(2);
    const live = [];

    BEATS.forEach(function (b) {
      const body = byKey[b.key];
      // Three staggered ramps rather than one: the dot lands first, the leader
      // draws out of it, the chip arrives last. One shared fade made all three
      // elements dissolve together, which reads as a dialog box appearing —
      // against an opening that establishes a hard electrical strike as this
      // film's language for something switching on.
      const oDot  = ramp(time, b.t0, b.t0 + 0.10);
      const oLine = ramp(time, b.t0 + 0.07, b.t0 + 0.24);
      const oChip = ramp(time, b.t0 + 0.18, b.t0 + 0.40);
      const gone  = 1 - ramp(time, LABELS_OUT, LABELS_OUT + 0.7);
      // the newest tag is the current one; the rest settle back a step
      b.cur = ramp(time, b.t0, b.t0 + 0.15) * (1 - ramp(time, b.t0 + 0.55, b.t0 + 0.95));
      if (!body || oDot * gone < 0.002) {
        b.el.style.opacity = 0; b.dot.style.opacity = 0; b.line.style.opacity = 0;
        return;
      }
      // `at` overrides the body centroid for parts whose bounding box centre is
      // not where a reader would point — a tall shroud's centroid sits in its
      // own shadow at the bottom of the case.
      if (b.at) _anchor.set(b.at[0], b.at[1], b.at[2]);
      else body.box.getCenter(_anchor);
      body.group.localToWorld(_anchor);
      const p = _anchor.project(camera);
      const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;

      if (!b.w && b.el.offsetWidth) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
      const tw = b.w || 96, th = b.h || 24, pad = 10;
      const half = b.anchor === "r" ? tw : 0;
      // it slides the last few pixels into place as it arrives
      const slide = (1 - oChip) * 10 * k * (b.anchor === "l" ? -1 : 1);
      let ax = x + b.off[0] * ok + slide;
      let ay = y + b.off[1] * ok;
      ax = Math.min(Math.max(ax, pad + half), w - pad - (tw - half));
      ay = Math.min(Math.max(ay, pad + th / 2), h - pad - th / 2);
      live.push({ b: b, x: x, y: y, ax: ax, ay: ay, tw: tw, th: th,
                  oDot: oDot * gone, oLine: oLine * gone, oChip: oChip * gone });
    });

    // De-overlap. The offsets are authored against one framing, and the camera
    // moves — on a narrow embed, and again during the closing pull-out as the
    // machine shrinks, tags that were clear at the wide start colliding. Sort by
    // vertical position and push each one clear of the last.
    live.sort(function (a, c) { return a.ay - c.ay; });
    for (let i = 1; i < live.length; i++) {
      const a = live[i - 1], c = live[i];
      const overlapX = Math.min(a.ax + (a.b.anchor === "r" ? 0 : a.tw), c.ax + (c.b.anchor === "r" ? 0 : c.tw)) -
                       Math.max(a.ax - (a.b.anchor === "r" ? a.tw : 0), c.ax - (c.b.anchor === "r" ? c.tw : 0));
      const gap = (c.ay - c.th / 2) - (a.ay + a.th / 2);
      if (overlapX > 0 && gap < 3) c.ay = a.ay + a.th + 3;
    }

    live.forEach(function (L) {
      const b = L.b, x = L.x, y = L.y, ax = L.ax, ay = L.ay;
      b.dot.style.opacity = L.oDot;
      b.dot.style.transform = "translate(" + x + "px," + y + "px)";

      // A settled tag steps back so the newest one reads as the current one.
      b.el.style.opacity = L.oChip * (0.72 + 0.28 * b.cur);
      b.el.style.setProperty("--cur", b.cur.toFixed(3));
      b.el.style.transform = "translate(" + ax + "px," + ay + "px) translateY(-50%)" +
                             (b.anchor === "r" ? " translateX(-100%)" : "");

      // Which side the leader leaves from is geometry, not the authored anchor
      // letter: the frame clamp can put the chip on the far side of its own dot,
      // and then the line was drawn straight through the chip's numerals.
      const chipL = b.anchor === "r" ? ax - L.tw : ax;
      const chipR = chipL + L.tw;
      const dir = x < chipL ? -1 : 1;
      const edge = dir < 0 ? chipL - 2 : chipR + 2;
      // 45 degrees, always. Measured off the authored offsets the seven
      // diagonals ran between 6 and 75 degrees, which reads as seven unrelated
      // graphics rather than one device used seven times.
      const dy = y - ay;
      const kx = x - (dir < 0 ? -1 : 1) * Math.abs(dy);
      const straight = dir * (kx - edge) < 0;
      b.line.style.opacity = L.oLine * (0.45 + 0.40 * b.cur);
      b.path.setAttribute("stroke-width", stroke);
      b.path.setAttribute("d", straight
        ? "M" + edge + " " + ay + " L" + x + " " + y
        : "M" + edge + " " + ay + " L" + kx + " " + ay + " L" + x + " " + y);
    });
  }

  /* ---------- transport ---------- */
  // Absolute elapsed time, not accumulated deltas. Accumulating a per-frame
  // delta with a 0.05 clamp means a device that cannot hold 20fps stretches the
  // film instead of dropping frames: at 12fps the 20-second piece ran 33
  // seconds, at 10fps 40 — outside the brief on a judge's laptop. Every place
  // that assigns `t` re-bases the clock, so a scrub or a resume does not jump.
  function rebase(now) { t0abs = (now === undefined ? performance.now() : now) - t * 1000; }

  function step(now) {
    raf = null;
    last = now;
    if (playing) {
      t = (now - t0abs) / 1000;
      if (t >= DURATION) {
        if (LOOPS) { t -= DURATION; rebase(now); }
        else { t = DURATION; playing = false; onEnd(); }
      }
    }
    resize();
    render(t);
    if (playing && onScreen) schedule();
  }
  function schedule() { if (raf == null) raf = requestAnimationFrame(step); }
  function play() {
    if (!ready) return;
    if (t >= DURATION) t = 0;
    playing = true; last = 0; rebase(); schedule(); setBtn();
  }
  function pause() { playing = false; setBtn(); }
  function onEnd() { setBtn(); }

  let vw = 0, vh = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === vw && h === vh)) return;
    vw = w; vh = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    BEATS.forEach(function (b) {
      b.line.setAttribute("viewBox", "0 0 " + w + " " + h);
      b.w = 0;                              // tag size changes with the em below
    });
    // The overlay is sized in em off this. Proportional would be 16 * w/1280,
    // which is right for fidelity; the floor exists because below it the type
    // stops being readable at all. At 11 the index numerals measured 5.9px and
    // the titles 7.5px — the floor was in the wrong place, not the ratios.
    overlayEm = Math.max(13, Math.min(28, 16 * w / 1280));
    layer.style.fontSize = overlayEm + "px";
  }
  // A window resize listener only catches the window changing. Embedded in a
  // wiki the stage can change size for reasons the window never hears about —
  // it starts inside a collapsed accordion or a hidden tab panel at zero width,
  // resize() bails on the zero, and the overlay is then stuck at its default
  // scale for the life of the page. Observe the element itself.
  // Always redraw after a resize, playing or not: setSize clears the drawing
  // buffer, so resizing without rendering leaves the frame blank until the next
  // animation frame — which never comes if the tab is hidden or the film is
  // paused. Caught by an embed that resized while hidden and stayed black.
  function onBoxChange() { vw = 0; resize(); render(t); }
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(onBoxChange).observe(stage);
  }
  window.addEventListener("resize", onBoxChange);

  // The film autoplays and runs for 20 seconds, which under WCAG 2.2.2 means
  // there must be a way to stop it. A page that embeds this and forgets the
  // transport would ship without one, so if the page did not provide a button
  // the film builds its own into the frame rather than trusting the embed.
  let btn = document.getElementById("unveil-play");
  const scrub = document.getElementById("unveil-scrub");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "unv-pause";
    stage.appendChild(btn);
  }
  // A canvas is opaque to a screen reader; say what is on it.
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label",
    "Animation of the RELEAF benchtop bioreactor: the lit nameplate, the whole " +
    "PC-tower chassis, the front panel coming away, and a pan across the " +
    "interior naming " + BEATS.length + " parts \u2014 " +
    BEATS.map(function (b) { return b.title.toLowerCase(); }).join(", ") + ".");
  if (scrub && !scrub.getAttribute("aria-label")) {
    scrub.setAttribute("aria-label", "Scrub the animation");
  }
  // The parts the film names, once, as text — the overlay itself is hidden.
  const parts = document.createElement("ul");
  parts.className = "unv-sr";
  parts.innerHTML = BEATS.map(function (b) {
    return "<li>" + b.n + " " + b.title + "</li>";
  }).join("");
  stage.appendChild(parts);
  // A click before the model lands used to hit the `if (!ready) return` guard
  // and do nothing, with the button still reading "Play".
  btn.disabled = !ready;
  function setBtn() { if (btn) btn.textContent = playing ? "Pause" : (t >= DURATION ? "Replay" : "Play"); }
  if (btn) btn.addEventListener("click", function () { playing ? pause() : play(); });
  if (scrub) {
    scrub.max = String(Math.round(DURATION * 100));
    scrub.addEventListener("input", function () {
      pause(); t = scrub.value / 100; rebase(); resize(); render(t);
    });
  }
  let tickTimer = 0;
  (function tick() {
    if (scrub && playing) scrub.value = String(Math.round(t * 100));
    tickTimer = setTimeout(tick, 100);
  })();

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
      // re-base rather than resume: the film pauses off-screen, and without
      // this the clock would have kept running while nothing was drawn
      if (onScreen && playing) { last = 0; rebase(); schedule(); }
    }, { threshold: 0 }).observe(canvas);
  }

  // The tick loop, the rAF and about 20MB of GPU allocations used to outlive
  // the page: on a wiki with client-side navigation nothing here was ever freed.
  function destroy() {
    clearTimeout(tickTimer);
    if (raf != null) { cancelAnimationFrame(raf); raf = null; }
    playing = false;
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(function (m) {
        Object.keys(m).forEach(function (kk) {
          const v = m[kk];
          if (v && v.isTexture) v.dispose();
        });
        m.dispose();
      });
    });
    if (scene.environment) scene.environment.dispose();
    renderer.dispose();
    const ext = renderer.getContext().getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
  }
  window.addEventListener("pagehide", destroy, { once: true });

  // Product stills out of the same scene. Not a second renderer: the whole
  // point is that a still and a frame of the film are lit, coloured and shaded
  // identically, so a poster and the animation cannot drift apart. It sets the
  // scene to a neutral "photograph this" state — nothing dimmed, nothing
  // flaring, no callouts — and then places the camera on a spherical rig.
  function still(o) {
    o = o || {};
    pause();
    layer.style.display = "none";
    parts.style.display = "none";
    renderer.toneMappingExposure = o.exposure === undefined ? 1.0 : o.exposure;

    // With the panel off it is removed, not slid aside and left in shot.
    const off = !!o.open;
    if (frontPanel) {
      frontPanel.group.visible = !off;
      frontPanel.group.position.set(0, 0, 0);
      frontPanel.group.rotation.set(0, 0, 0);
      frontPanel.mats.forEach(function (m) {
        m.transparent = false; m.opacity = 1; m.depthWrite = true;
      });
      if (frontPanel.meshes) frontPanel.meshes.forEach(function (m) { m.castShadow = !off; });
    }
    if (plateMat) plateMat.opacity = off ? 0 : 1;

    bodies.forEach(function (b) {
      b.mats.forEach(function (m) {
        if (m.userData.base) m.color.copy(m.userData.base);
        if (m.emissive) m.emissive.setRGB(0, 0, 0);
        if (b.isCase) { m.transparent = false; m.opacity = 1; m.depthWrite = true; }
      });
      if (b.meshes && b.isCase) b.meshes.forEach(function (m) { m.castShadow = true; });
    });

    // A still is a photograph and gets lit like one. The film wants the case
    // near-silhouette for drama; a photograph has to show the product, so the
    // shell gets more environment — the equivalent of a fill card — and the
    // floor is pulled down so it stops competing with the subject. At 0.20 the
    // panel is a black shape; at 0.62 the vent depth, the bolt heads and the
    // top face all read and it is still unmistakably black. Above ~0.8 the top
    // face starts to go grey.
    const cEnv = o.caseEnv === undefined ? 0.62 : o.caseEnv;
    const fl = o.floor === undefined ? 0.45 : o.floor;
    bodies.forEach(function (b) {
      if (!b.isCase) return;
      b.mats.forEach(function (m) {
        if (m.userData.env0 === undefined) m.userData.env0 = m.envMapIntensity;
        if (m.metalness < 0.5) m.envMapIntensity = cEnv;
      });
    });
    [ground.mat, ground.gm].forEach(function (m) {
      if (m.userData.op0 === undefined) m.userData.op0 = m.opacity;
      m.opacity = m.userData.op0 * fl;
      m.transparent = true;
    });

    // pick up any aspect change before the camera is set from it
    resize();

    const tg = o.target ? S(o.target[0], o.target[1], o.target[2]) : S(0, 0, 294);
    const yaw = YAW0 + (o.yaw || 0);
    const pitch = o.pitch === undefined ? 0.10 : o.pitch;
    const dist = o.dist || 1650;
    camera.fov = o.fov || 26;
    camera.clearViewOffset();
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    camera.position.set(
      tg.x + dist * Math.sin(yaw) * Math.cos(pitch),
      tg.y + dist * Math.sin(pitch),
      tg.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(tg);
    // the interior needs a little help when it is open to the lens
    fill.intensity = o.fill === undefined ? (off ? 0.30 : 0) : o.fill;
    _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    fill.position.copy(camera.position).addScaledVector(_camRight, -340);
    fill.position.y += 260;

    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    return canvas.toDataURL("image/png");
  }
  // put the film back together after a still
  function unstill() {
    layer.style.display = "";
    parts.style.display = "";
    if (frontPanel) frontPanel.group.visible = true;
    bodies.forEach(function (b) {
      b.mats.forEach(function (m) {
        if (m.userData.env0 !== undefined) m.envMapIntensity = m.userData.env0;
      });
    });
    [ground.mat, ground.gm].forEach(function (m) {
      if (m.userData.op0 !== undefined) m.opacity = m.userData.op0;
    });
    lastShadowState = -1;
  }

  // A handle for driving and inspecting the shot while it is being cut.
  window.__unveil = {
    play: play, pause: pause,
    seek: function (v) { unstill(); pause(); t = v; rebase(); resize(); render(t); },
    still: still,
    unstill: unstill,
    destroy: destroy,
    duration: function () { return DURATION; },
    scene: scene, camera: camera, root: root, bodies: bodies, byKey: byKey,
    worldBox: function () {
      const b = new THREE.Box3().setFromObject(root);
      return { min: b.min.toArray().map(Math.round), max: b.max.toArray().map(Math.round),
               size: b.getSize(new THREE.Vector3()).toArray().map(Math.round) };
    },
    shot: function () {
      const s = sample(t);
      return { t: +t.toFixed(2), dist: Math.round(s.dist), fov: +s.fov.toFixed(1),
               target: s.target.toArray().map(Math.round),
               camera: camera.position.toArray().map(Math.round) };
    },
    state: function () { return { t: t, playing: playing, ready: ready, bodies: bodies.length }; }
  };
})();
