// Live instruments on the hub cards.
//
// The cards used flat renders, and a picture cannot be spun — turn it and it
// goes edge-on and disappears. These are the real models, merged by material
// and decimated to a few thousand triangles each, because the card is about
// 350px wide and past that nothing more would show.
//
// The PNG stays underneath as the poster: it is what shows before the geometry
// arrives, and what stays if WebGL is unavailable. Nothing here is required to
// understand the page.
(function () {

  // Every colour goes through RQ.srgb (js/render-quality.js). A render-quality.js
  // from before it existed made each call throw inside the model loader, and
  // every card stayed a flat poster; the same conversion stands in for it.
  const srgb = window.RQ && RQ.srgb ? RQ.srgb : function (hex) {
    return (hex && hex.isColor ? hex.clone() : new THREE.Color(hex)).convertSRGBToLinear();
  };

  /* ---------- optical paths ----------
     The beam belongs to the instrument, not to the card, so it is built as
     geometry inside the rig: it turns with the model on hover instead of
     sitting over it, and it is placed in the model's own coordinates instead
     of being eyeballed against one fixed view.

     Those coordinates are measured off the part geometry itself, by clustering
     each merged STL back into components:

       photometer  amber        LED            (  0.2, -13.9,  0.0)
                   clear        lens           (  0.1, -18.1,  0.0)
                   pcb (vertical, x-normal)    (-19.9, -171.9, 2.2)  reference
                   glass                       (  0.0, -187.1, 0.0)  cuvette
                   pcb (horizontal, y-normal)  (  0.1, -194.7, 2.2)  sample

     The reference sensor is a board standing on the -X side, 20 units out of a
     model that is 76 wide. The first version of this sent the branch the other
     way and ran it well past the instrument.

       diopal      pcb          LED board at y 0.75
                   white        rack plate y 68, tubes y 66.5 to 146.5

     Beams draw with depthTest off. They are an annotation, not light: inside
     an opaque housing and opaque tubes the honest depth-sorted version is
     invisible almost everywhere, which is no use on a card. */
  const BEAMS = {
    photometer: {
      radius: 1.6, dot: 3.6, period: 3.6, phase: 0.42, spread: 0,
      lineAlpha: 0.2, dotAlpha: 0.7,
      routes: [
        { color: 0xffa23d, pts: [[0, -13.9, 0], [0, -171.9, 0], [-19.9, -171.9, 0]] },
        { color: 0xffa23d, pts: [[0, -13.9, 0], [0, -194.7, 0]] }
      ]
    },
    diopal: {
      radius: 1.1, dot: 2.6, period: 2.8, phase: 0.17, spread: 2.4,
      lineAlpha: 0.34, dotAlpha: 0.85,
      // The whole array, not a sample of it. A column is one condition — four
      // resistance-matched LEDs of one wavelength at one tier — and the six
      // columns alternate green and red, which is the thing worth showing.
      //
      // The rack's top face spans 112.8 by 90.5. Six columns along x is 18.8
      // apart and four rows along z is 22.6; the other way round gives 15.1
      // against 28.2, which no tube rack is built like.
      routes: (function () {
        const out = [];
        for (let col = 0; col < 6; col++) {
          const x = -47 + col * 18.8;
          const color = col % 2 ? 0xff5f4a : 0x3ddc8b;
          for (let row = 0; row < 4; row++) {
            const z = -33.9 + row * 22.6;
            // phase by column, so a condition lights as one column
            out.push({ color: color, phase: col, pts: [[x, 80, z], [x, 142, z]] });
          }
        }
        return out;
      })()
    }
  };

  // The renderer runs ACES tone mapping into an sRGB buffer, which is right for
  // lit geometry and wrong for an annotation: it dragged #ffa23d out as
  // rgb(93,93,88), a grey line. toneMapped:false skips the curve, and the
  // colour is supplied linear so the output encoding lands on the intended hue.
  function beamMaterial(hex, opacity) {
    return new THREE.MeshBasicMaterial({
      color: srgb(hex),
      transparent: true, opacity: opacity,
      toneMapped: false, depthTest: false, depthWrite: false
    });
  }

  function addBeams(inst, rig, centre) {
    const spec = BEAMS[inst];
    if (!spec) return null;
    const group = new THREE.Group();
    group.position.copy(centre).multiplyScalar(-1);   // match the rig centring
    const runs = [];
    spec.routes.forEach(function (r) {
      const pts = r.pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
      const line = beamMaterial(r.color, spec.lineAlpha);
      const segs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], len = a.distanceTo(b);
        // spread > 0 splays the tube along the direction of travel: light
        // leaving an LED opens out up the tube, and the taper is most of what
        // makes it read as a wisp rather than a drawn line. The photometer's
        // beam is collimated and keeps a constant section.
        const rTop = spec.radius * (spec.spread || 1);
        const rBot = spec.radius * (spec.spread ? 0.42 : 1);
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(rTop, rBot, len, 7, 1, true), line);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        m.renderOrder = 10;
        group.add(m);
        segs.push({ a: a, b: b, len: len, at: total });
        total += len;
      }
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(spec.dot, 7, 5),
        beamMaterial(r.color, spec.dotAlpha));
      dot.renderOrder = 11;
      dot.position.copy(pts[0]);
      group.add(dot);
      runs.push({ dot: dot, segs: segs, total: total, phase: r.phase });
    });
    rig.add(group);
    return function (now) {
      const t = now / 1000 / spec.period;
      runs.forEach(function (run, i) {
        const ph = run.phase == null ? i : run.phase;
        let s = ((t + ph * spec.phase) % 1) * run.total, k = 0;
        while (k < run.segs.length - 1 && s > run.segs[k].at + run.segs[k].len) k++;
        const seg = run.segs[k];
        const f = Math.min(1, Math.max(0, (s - seg.at) / seg.len));
        run.dot.position.copy(seg.a).lerp(seg.b, f);
      });
    };
  }

  // a card's picture frame, or an instrument's in the hub orbit (tools/build_orbit.py)
  const cards = Array.prototype.slice.call(document.querySelectorAll(".deck-media, .orb-media"));
  if (!cards.length || typeof THREE === "undefined") return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Rim lights: each instrument's colour mixed 60% into the film's neutral (#dfe6ee). Enough that a model reads as its
  // card's instrument, short of the full-strength cast the rims first had (css/hub.css, "hub: decks look").
  const ACCENT = { photometer: 0xf2bd84, diopal: 0x7ee0b3, bioreactor: 0xdfe6ee, hydroponics: 0xc3b0f8 };

  // one environment map, shared by all three scenes
  let ENV = null;

  // sRGB in, converted here. beamMaterial() below already did this; the lit
  // materials did not, so every card was rendering its palette far too bright.
  function solid(c, m, r, e) {
    return new THREE.MeshPhysicalMaterial({
      color: srgb(c), metalness: m, roughness: r, envMapIntensity: e,
      clearcoat: 1, clearcoatRoughness: 0.09 });
  }
  function glassy(c, r, t, e, em, ei) {
    return new THREE.MeshPhysicalMaterial({
      color: srgb(c), metalness: 0, roughness: r, transmission: t, ior: 1.5,
      transparent: true, opacity: 1, envMapIntensity: e,
      clearcoat: 1, clearcoatRoughness: r * 1.4,
      emissive: srgb(em), emissiveIntensity: ei,
      side: THREE.DoubleSide, depthWrite: false });
  }

  // the same palette the instrument pages use, so a card matches its page
  function materialFor(mat) {
    switch (mat) {
      case "printed": case "blackPrint": return solid(0x101317, 0.08, 0.32, 0.57);
      case "black": case "probeBlack":   return solid(0x0f1114, 0.18, 0.45, 1.01);
      case "charcoal":                   return solid(0x2a2d33, 0.22, 0.40, 1.01);
      case "cable":                      return solid(0x17181a, 0.05, 0.52, 0.81);
      case "grey": case "greyLight":     return solid(0x9aa2ab, 0.30, 0.35, 1.21);
      case "white":                      return solid(0xe4e6e8, 0.04, 0.45, 1.08);
      // the hydroponics seed holders: brown printed PLA
      case "brownPrint":                 return solid(0x6b3d14, 0.02, 0.55, 0.75);
      case "steel":                      return solid(0xb8bcc2, 0.88, 0.25, 1.48);
      case "chipGrey":                   return solid(0x9ba1a9, 0.72, 0.25, 1.35);
      case "chipBlack":                  return solid(0x141619, 0.25, 0.42, 0.95);
      case "pcb":                        return solid(0x14306b, 0.18, 0.37, 1.15);
      case "navy":                       return solid(0x1f3f74, 0.12, 0.32, 1.28);
      case "skyBlue":                    return solid(0x7fb2d9, 0.10, 0.30, 1.35);
      case "rotorBlue":                  return solid(0x2f6fbb, 0.14, 0.29, 1.35);
      case "knobBlue":                   return solid(0x2e5fa3, 0.14, 0.30, 1.35);
      case "glass":                      return glassy(0xeaf4ff, 0.02, 0.86, 3.4, 0x93bce4, 0.30);
      case "bottleGlass":                return glassy(0xe4eef8, 0.06, 0.90, 3.0, 0x9dc0e2, 0.12);
      case "frostBottle":                return glassy(0xeef2f4, 0.30, 0.62, 2.2, 0xaebfd0, 0.10);
      case "tube":                       return glassy(0xf0f4f6, 0.26, 0.70, 2.4, 0xa9c2d8, 0.10);
      case "clear":                      return glassy(0xf0f6ff, 0.05, 0.92, 3.0, 0x9dc0e2, 0.13);
      case "amber":                      return glassy(0xffab34, 0.10, 0.62, 1.5, 0xff8a00, 0.42);
      case "beam":
        return new THREE.MeshBasicMaterial({ color: srgb(0xff8a1e), transparent: true,
          opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
      default:                           return solid(0x2a2d33, 0.20, 0.42, 1.0);
    }
  }

  /* The bioreactor keeps its own palette: the hub film's (dev/film/build_scene.py),
     which took it from the bioreactor page's own film and product/palette.json —
     a near-black case, the pump navy with a grey-blue rotor and dark rollers in a
     white enclosure, slate-blue bottle caps, a pale yellow culture, an almost
     clear protectant, a clear membrane column with separate white fibres inside
     it, and a little teal-green light.
     r128 has no refraction. transmission there only lowers alpha wherever the
     surface is not reflecting, so a clear body is its reflections and a faint
     veil of its own colour; drawn front faces only, after what is inside it. */
  const BIO_ORDER = { culture: 1, protectant: 1, tubeClear: 2, bottleGlass: 3, glass: 3 };
  function bioMaterial(mat) {
    function opaque(c, m, r, e, cc) {
      return new THREE.MeshPhysicalMaterial({
        color: srgb(c), metalness: m, roughness: r, envMapIntensity: e,
        clearcoat: cc, clearcoatRoughness: 0.25,
        // the CAD's winding is not consistent everywhere; lit from both sides
        // a face that arrived back to front still shades the right way
        side: THREE.DoubleSide });
    }
    function clear(c, t, r, e) {
      return new THREE.MeshPhysicalMaterial({
        color: srgb(c), metalness: 0, roughness: r, transmission: t, ior: 1.5,
        transparent: true, opacity: 1, envMapIntensity: e, depthWrite: false });
    }
    function liquid(c, o) {
      return new THREE.MeshPhysicalMaterial({
        color: srgb(c), metalness: 0, roughness: 0.9, envMapIntensity: 0.35,
        transparent: true, opacity: o, depthWrite: false });
    }
    function glow(c, base, i) {
      const m = opaque(base, 0, 0.35, 0.6, 0);
      m.emissive = srgb(c); m.emissiveIntensity = i;
      return m;
    }
    switch (mat) {
      case "charcoal":    return opaque(0x1d1e21, 0.00, 0.80, 0.70, 0.00);
      // Matte. At roughness 0.75 the rim light glanced off the shelf's top and
      // lifted it to mid-grey (a shelf pixel read 110; with the rim off, 22),
      // where the film's shelf is dark grey.
      case "blackPrint":  return opaque(0x1c1d1f, 0.00, 0.92, 0.35, 0.00);
      case "greyLight":   return opaque(0x4d4f52, 0.00, 0.50, 1.00, 0.20);
      // also the pump's rollers: dark against the grey-blue rotor, as in the film
      case "steel":       return opaque(0x8a8d91, 0.72, 0.26, 1.20, 0.00);
      case "navy":        return opaque(0x213560, 0.00, 0.40, 1.10, 0.30);
      // the pump's side lid, and the bottle caps: on the pump's navy they read
      // royal blue, where the film's caps are a muted slate blue
      case "slate":       return opaque(0x3e5068, 0.00, 0.50, 1.00, 0.20);
      case "rotorBlue":   return opaque(0x6f92a7, 0.05, 0.40, 1.10, 0.25);
      case "white":       return opaque(0xeaeaea, 0.00, 0.50, 0.85, 0.15);
      case "pcb":         return opaque(0x0b3767, 0.10, 0.40, 1.00, 0.30);
      case "fibre":       return opaque(0xf3f2ec, 0.00, 0.65, 0.80, 0.00);
      case "tube":        return opaque(0xe0c46e, 0.00, 0.30, 1.00, 0.40);
      case "glass":       return clear(0xe4ecf1, 0.90, 0.05, 1.40);
      case "bottleGlass": return clear(0xf2f5f7, 0.92, 0.06, 1.20);
      case "culture":     return liquid(0xf7d46a, 0.62);
      case "protectant":  return liquid(0xfffcf0, 0.22);
      case "tubeClear":   return clear(0xf4f6f6, 0.60, 0.20, 1.00);
      case "amber":       return glow(0xff8a1e, 0xffb35a, 0.9);
      case "screen":      return glow(0x46c9a8, 0x171f23, 0.6);
      case "led":
        return new THREE.MeshBasicMaterial({ color: srgb(0x1fa878), toneMapped: false });
      default:            return opaque(0x2a2d33, 0.00, 0.45, 1.00, 0.20);
    }
  }

  // Only DiOPAL needs it: its CAD is exported Z-up and its page corrects the
  // geometry on load (Z_UP_CAD in diopal/js/scene.js). The photometer's STLs are
  // already Y-up, and the bioreactor's were baked Y-up by the assembly script —
  // rotating those two lays them on their side. The bioreactor's are also baked
  // turned so that at rest its open side, with the pump, the culture vessel and
  // the membrane column, faces the card, as the hub film shows it.
  const ZUP = { diopal: true };

  function mount(media, inst, entries) {
    const canvas = document.createElement("canvas");
    canvas.className = "deck-gl";
    canvas.setAttribute("aria-hidden", "true");
    media.insertBefore(canvas, media.firstChild);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;

    const scene = new THREE.Scene();
    if (!ENV && window.RQ) ENV = RQ.studioEnv(renderer);
    if (ENV) scene.environment = ENV;
    const key = new THREE.DirectionalLight(0xfff6ec, 0.52); key.position.set(0.8, 1.3, 1.5);
    // The bioreactor's rim is the film's neutral (#dfe6ee), not its card accent: a blue rim came back
    // off the case's black floor plates as a pale blue sheet, and the film keeps its colour in the lights.
    const rim = new THREE.DirectionalLight(inst === "bioreactor" ? 0xdfe6ee : (ACCENT[inst] || 0xbcd0e6), 0.46);
    rim.position.set(-1.1, 0.4, -1.3);
    const under = new THREE.DirectionalLight(0x9fb4cc, 0.22); under.position.set(0.2, -1, 0.4);
    scene.add(key, rim, under);

    const rig = new THREE.Group();
    scene.add(rig);
    const camera = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 20000);

    let loaded = 0, framed = false;
    // served from img/deck3d/_pack.bin (tools/pack_models.py), under the manifest's STL names
    const loader = PackedModel.bundle("img/deck3d/");
    entries.forEach(function (e) {
      loader.load("img/deck3d/" + e.file + (e.v ? "?v=" + e.v : ""), function (geo) {
        if (ZUP[inst]) geo.rotateX(-Math.PI / 2);
        if (window.RQ) RQ.smoothNormals(geo); else geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, inst === "bioreactor" ? bioMaterial(e.mat) : materialFor(e.mat));
        if (inst === "bioreactor") mesh.renderOrder = BIO_ORDER[e.mat] || 0;
        mesh.name = e.mat;
        rig.add(mesh);
        if (++loaded === entries.length) frame();
      });
    });

    function frame() {
      // centre on the model, then let the rig spin about its own axis
      const box = new THREE.Box3().setFromObject(rig);
      const c = box.getCenter(new THREE.Vector3());
      rig.children.forEach(function (m) { m.position.sub(c); });
      pulse = addBeams(inst, rig, c);

      // The bioreactor used to stand on a two-tier dais, built here from shapes
      // because merging the model set had left it nothing to stand on. It is
      // gone: the tower stands on its own feet, and the room the stage took out
      // of the fit — it was wider and deeper than the tower in plan — goes to
      // the tower instead. The card's floor line (css/hub.css) grounds it.
      framed = true;
      fitFn = fit;
      media.classList.add("gl-ready");
      resize();
      draw();
    }

    /* The tower is fitted to its own outline, not to its bounding box.
       Box corners overstate anything that turns: the box of a box turned 45
       degrees is far bigger than the box, and a tall tower in a short strip paid
       for that margin in size. So for the tower the fit measures the geometry
       itself — in each of 32 height slices, the vertices furthest out in 24
       directions round the spin axis, plus the slice's highest and lowest. A few
       hundred points, and they bound the model at every angle it can turn to.
       The other cards keep the corner fit they were framed with. */
    const OUTLINE = inst === "bioreactor";
    let outline = null;
    const aim = new THREE.Vector3();
    function outlinePoints() {
      const SL = 32, DIRS = 24, v = new THREE.Vector3();
      const xs = [], ys = [], zs = [];
      rig.children.forEach(function (m) {
        const pos = m.geometry && m.geometry.attributes.position;
        if (!pos) return;
        m.updateMatrix();                 // rig-local; the spin is applied in the fit
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrix);
          xs.push(v.x); ys.push(v.y); zs.push(v.z);
        }
      });
      let y0 = Infinity, y1 = -Infinity;
      ys.forEach(function (y) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      const cs = [], sn = [], slices = [];
      for (let j = 0; j < DIRS; j++) {
        cs.push(Math.cos(j * 2 * Math.PI / DIRS)); sn.push(Math.sin(j * 2 * Math.PI / DIRS));
      }
      for (let k = 0; k < SL; k++) {
        slices.push({ far: new Array(DIRS).fill(-Infinity), at: new Array(DIRS).fill(-1), hi: -1, lo: -1 });
      }
      for (let i = 0; i < xs.length; i++) {
        const b = slices[Math.min(SL - 1, Math.floor((ys[i] - y0) / ((y1 - y0) || 1) * SL))];
        for (let j = 0; j < DIRS; j++) {
          const t = xs[i] * cs[j] + zs[i] * sn[j];
          if (t > b.far[j]) { b.far[j] = t; b.at[j] = i; }
        }
        if (b.hi < 0 || ys[i] > ys[b.hi]) b.hi = i;
        if (b.lo < 0 || ys[i] < ys[b.lo]) b.lo = i;
      }
      const keep = new Set();
      slices.forEach(function (b) {
        b.at.concat([b.hi, b.lo]).forEach(function (i) { if (i >= 0) keep.add(i); });
      });
      const out = [];
      keep.forEach(function (i) { out.push(xs[i], ys[i], zs[i]); });
      return out;
    }

    function fitOutline() {
      // Of a half-frame, over every angle of the spin. The tower is tall and
      // narrow in a short strip, and with no stage it is the whole silhouette,
      // so it takes most of the strip's height — but not all of it: at 0.98 the
      // handle and feet met the card's edges at the tallest angle. 0.92 leaves
      // about 9 to 12px either end on a 279px strip, more at rest.
      const TARGET = 0.92;
      const AZ = 0.72, EL = 0.30;
      const dir = new THREE.Vector3(
        Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
      if (!outline) outline = outlinePoints();
      const tan = Math.tan(camera.fov * Math.PI / 360), p = new THREE.Vector3();
      let d = 0;
      for (let i = 0; i < outline.length; i += 3) {
        d = Math.max(d, Math.hypot(outline[i], outline[i + 2]), Math.abs(outline[i + 1]));
      }
      d *= 4.4;                                   // a starting guess
      aim.set(0, 0, 0);
      for (let pass = 0; pass < 8; pass++) {
        camera.position.copy(dir).multiplyScalar(d).add(aim);
        camera.lookAt(aim);
        camera.updateMatrixWorld(true);
        let wx = 0, lo = Infinity, hi = -Infinity;
        for (let a = 0; a < 360; a += 10) {
          const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
          for (let i = 0; i < outline.length; i += 3) {
            p.set(outline[i] * ca + outline[i + 2] * sa, outline[i + 1],
                  -outline[i] * sa + outline[i + 2] * ca).project(camera);
            wx = Math.max(wx, Math.abs(p.x));
            lo = Math.min(lo, p.y); hi = Math.max(hi, p.y);
          }
        }
        const worst = Math.max(wx, (hi - lo) / 2), cy = (hi + lo) / 2;
        if (Math.abs(worst - TARGET) < 0.004 && Math.abs(cy) < 0.004) break;
        // Seen from above, the tower's outline sits low in the frame, and fitting
        // it about the box centre wasted the headroom over it. Aim at the middle
        // of what is actually drawn.
        aim.y += cy * d * tan / Math.cos(EL);
        d *= worst / TARGET;
      }
      camera.position.copy(dir).multiplyScalar(d).add(aim);
      camera.lookAt(aim);
      // Depth range to suit the distance. At near 0.1 a camera 1.6m out resolves
      // depth to about 1.5mm, and the pump's display, which sits less than that
      // off its housing, broke through it in teeth. The tower never comes within
      // a quarter of the distance of the camera, nor reaches past four times it.
      camera.near = d * 0.25; camera.far = d * 4;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    }

    function fit() {
      if (OUTLINE) return fitOutline();
      /* Solve the distance instead of deriving it.
         A closed-form fit kept clipping: it ignored that the camera looks down
         from an elevation, that perspective spreads the near corners more than
         the far ones, and that a model spun about Y presents a different
         silhouette at every angle. Measuring what actually lands on the canvas
         and stepping the camera back until it fits is exact, and it costs a few
         projections once per resize. */
      const TARGET = 0.86;               // of a half-frame; the rest is margin
      const box = new THREE.Box3().setFromObject(rig);
      const s = box.getSize(new THREE.Vector3());
      const AZ = 0.72, EL = 0.30;
      const dir = new THREE.Vector3(
        Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
      let d = Math.max(Math.hypot(s.x, s.z), s.y) * 2.2;   // a starting guess

      const was = rig.rotation.y;
      for (let pass = 0; pass < 5; pass++) {
        camera.position.copy(dir).multiplyScalar(d);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
        let worst = 0;
        for (let a = 0; a < 360; a += 20) {
          rig.rotation.y = a * Math.PI / 180;
          rig.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(rig);
          for (let i = 0; i < 8; i++) {
            const p = new THREE.Vector3(
              i & 1 ? b.max.x : b.min.x,
              i & 2 ? b.max.y : b.min.y,
              i & 4 ? b.max.z : b.min.z).project(camera);
            worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
          }
        }
        if (Math.abs(worst - TARGET) < 0.01) break;
        d *= worst / TARGET;               // linear enough to converge fast
      }
      rig.rotation.y = was;
      rig.updateMatrixWorld(true);
      camera.position.copy(dir).multiplyScalar(d);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
    }

    let fitFn = null;
    function resize() {
      const r = media.getBoundingClientRect();
      if (r.width < 2) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      if (fitFn) fitFn();          // the horizontal fit depends on the aspect
    }

    // hover spins it; letting go unwinds to where it started
    let angle = 0, vel = 0, hovering = false, raf = null, last = 0;
    // The beam animates on its own, so the loop can no longer stop the moment
    // the card is at rest. It runs only while the card is actually on screen
    // and the tab is in front — a WebGL redraw per frame for a card nobody is
    // looking at is the one cost this effect could easily have hidden.
    let pulse = null, onScreen = true, last2 = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The travelling pulse runs on hover only. Left on whenever the card was
    // merely on screen, three WebGL canvases re-rendered forever at ~25fps to
    // move a dot — the largest standing cost on the hub. The light path itself
    // is drawn either way; idle, it simply holds still.
    function beamRunning() {
      return pulse && hovering && onScreen && !reduced && !document.hidden;
    }
    const SPEED = Math.PI * 2 / 7.5;        // one turn every 7.5s, all three alike

    function draw(now) {
      raf = null;
      if (!framed) return;
      // Off screen nothing is drawn and no next frame is asked for. Keyboard
      // focus outlasts the card being in view (tab to it, then scroll away), and
      // a model nobody could see went on turning at 60fps. The observer below
      // calls tick() again when the card comes back.
      if (!onScreen) { last = 0; return; }
      const dt = last && now ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now || 0;
      const want = hovering ? SPEED : 0;
      vel += (want - vel) * Math.min(1, dt * 4);
      if (hovering) angle += vel * dt;
      else if (Math.abs(angle % (Math.PI * 2)) > 0.001) {
        // unwind by the shortest way round rather than reversing the whole turn
        let a = angle % (Math.PI * 2);
        if (a > Math.PI) a -= Math.PI * 2;
        if (a < -Math.PI) a += Math.PI * 2;
        angle = a * Math.max(0, 1 - dt * 3.2);
      }
      rig.rotation.y = angle;
      const moving = hovering || Math.abs(angle) > 0.001 || Math.abs(vel) > 0.001;
      if (beamRunning()) pulse(now || 0);
      // A turning model wants every frame. A drifting pulse does not, and two
      // cards redrawing a WebGL canvas at 60fps for the sake of a moving dot is
      // a cost worth not paying: idle, it redraws at about 25fps instead.
      if (moving || !last2 || (now || 0) - last2 > 40) {
        last2 = now || 0;
        renderer.render(scene, camera);
      }
      if (moving || beamRunning()) tick();
    }
    function tick() { if (raf == null) raf = requestAnimationFrame(draw); }

    (window.__decks = window.__decks || {})[inst] = {
      rig: rig, camera: camera, renderer: renderer,
      // project the model's corners at a given spin angle and report how far
      // outside the canvas, in fractions of a half-frame, anything lands
      overflowAt: function (angle) {
        const was = rig.rotation.y;
        rig.rotation.y = angle;
        rig.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(rig);
        let mx = 0, my = 0;
        for (let i = 0; i < 8; i++) {
          const p = new THREE.Vector3(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z).project(camera);
          mx = Math.max(mx, Math.abs(p.x));
          my = Math.max(my, Math.abs(p.y));
        }
        rig.rotation.y = was;
        return { x: +mx.toFixed(3), y: +my.toFixed(3) };
      },
      // Every vertex at a given spin angle, in fractions of a half-frame: the
      // check on the outline fit, since it projects the whole geometry rather
      // than the outline the fit used. top/bottom are signed, x is the widest.
      extentAt: function (angle) {
        const was = rig.rotation.y;
        rig.rotation.y = angle;
        rig.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        const p = new THREE.Vector3();
        let mx = 0, lo = Infinity, hi = -Infinity;
        rig.traverse(function (m) {
          const pos = m.isMesh && m.geometry.attributes.position;
          if (!pos) return;
          for (let i = 0; i < pos.count; i++) {
            p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(camera);
            mx = Math.max(mx, Math.abs(p.x)); lo = Math.min(lo, p.y); hi = Math.max(hi, p.y);
          }
        });
        rig.rotation.y = was;
        rig.updateMatrixWorld(true);
        return { x: +mx.toFixed(3), top: +hi.toFixed(3), bottom: +lo.toFixed(3) };
      }
    };

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        if (onScreen) tick();
      }, { rootMargin: "80px" }).observe(media);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

    const card = media.closest("a.deck, a.orb-body") || media;
    // in the hub orbit only the model's disc answers the pointer; the words beside it are just the link
    const target = media.closest(".orb-core") || card;
    if (!reduced) {
      target.addEventListener("pointerenter", function () { hovering = true; last = 0; tick(); });
      target.addEventListener("pointerleave", function () { hovering = false; tick(); });
      card.addEventListener("focusin", function () { hovering = true; last = 0; tick(); });
      card.addEventListener("focusout", function () { hovering = false; tick(); });
    }
    let rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt); rt = setTimeout(function () { resize(); tick(); }, 150);
    });
  }

  // Mounted directly rather than behind an IntersectionObserver. The decks sit
  // near the top of the hub, the geometry is about half a megabyte for all
  // three, and gating on the observer means that anywhere it is throttled or
  // never delivers the cards silently stay flat pictures.
  // Revalidated on every load, and every model URL carries its content hash: the
  // model files keep their names when they are rebuilt, and a browser that had
  // cached the old ones kept showing the old instrument (and no card at all for
  // one the old manifest did not list).
  // Not while the hero film plays its opening move, though (13 Sep). Compiling the shaders and building the scenes holds
  // the main thread for 100-200 ms and costs the film a frame, which reads as a stutter: at load it hit the first
  // quarter-second, and a fixed 1.5 s delay only moved the hitch to 1.8 s. The models are below the first screen, so they
  // start on the first scroll (a dropped frame while the page moves is invisible), when one is already in the window
  // (a page restored part-way down), or after 12 s as the guarantee the observer alone was not.
  let started = false;
  function start() {
    if (started) return;
    started = true;
    fetch("img/deck3d/_manifest.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (man) {
        cards.forEach(function (media) {
          const link = media.closest("a.deck, a.orb-body");
          const href = link ? link.getAttribute("href") || "" : "";
          const inst = Object.keys(man).filter(function (k) { return href.indexOf(k) === 0; })[0];
          if (!inst) return;
          mount(media, inst, man[inst]);
        });
      })
      .catch(function () { /* the poster stays; nothing else to do */ });
  }
  window.addEventListener("scroll", start, { once: true, passive: true });
  if ("IntersectionObserver" in window) {
    const inView = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { inView.disconnect(); start(); }
    });
    cards.forEach(function (c) { inView.observe(c); });
  }
  function fallback() { setTimeout(start, 12000); }
  if (document.readyState === "complete") fallback(); else window.addEventListener("load", fallback, { once: true });
})();
