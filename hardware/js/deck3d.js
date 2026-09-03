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
      color: new THREE.Color(hex).convertSRGBToLinear(),
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

  const cards = Array.prototype.slice.call(document.querySelectorAll(".deck-media"));
  if (!cards.length || typeof THREE === "undefined") return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ACCENT = { photometer: 0xffa23d, diopal: 0x3ddc8b, bioreactor: 0x5aa9ff };

  // one environment map, shared by all three scenes
  let ENV = null;

  function solid(c, m, r, e) {
    return new THREE.MeshPhysicalMaterial({
      color: c, metalness: m, roughness: r, envMapIntensity: e,
      clearcoat: 1, clearcoatRoughness: 0.09 });
  }
  function glassy(c, r, t, e, em, ei) {
    return new THREE.MeshPhysicalMaterial({
      color: c, metalness: 0, roughness: r, transmission: t, ior: 1.5,
      transparent: true, opacity: 1, envMapIntensity: e,
      clearcoat: 1, clearcoatRoughness: r * 1.4,
      emissive: em, emissiveIntensity: ei,
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
        return new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true,
          opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
      default:                           return solid(0x2a2d33, 0.20, 0.42, 1.0);
    }
  }

  // Only DiOPAL needs it: its CAD is exported Z-up and its page corrects the
  // geometry on load (Z_UP_CAD in diopal/js/scene.js). The photometer's STLs are
  // already Y-up, and the bioreactor's were baked Y-up by the assembly script —
  // rotating those two lays them on their side.
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
    const rim = new THREE.DirectionalLight(ACCENT[inst] || 0xbcd0e6, 0.46); rim.position.set(-1.1, 0.4, -1.3);
    const under = new THREE.DirectionalLight(0x9fb4cc, 0.22); under.position.set(0.2, -1, 0.4);
    scene.add(key, rim, under);

    const rig = new THREE.Group();
    scene.add(rig);
    const camera = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 20000);

    let loaded = 0, framed = false;
    const loader = new THREE.STLLoader();
    entries.forEach(function (e) {
      loader.load("img/deck3d/" + e.file, function (geo) {
        if (ZUP[inst]) geo.rotateX(-Math.PI / 2);
        if (window.RQ) RQ.smoothNormals(geo); else geo.computeVertexNormals();
        rig.add(new THREE.Mesh(geo, materialFor(e.mat)));
        if (++loaded === entries.length) frame();
      });
    });

    function frame() {
      // centre on the model, then let the rig spin about its own axis
      const box = new THREE.Box3().setFromObject(rig);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      rig.children.forEach(function (m) { m.position.sub(c); });
      pulse = addBeams(inst, rig, c);

      // The bioreactor stands on a two-tier dais that promo.js builds rather
      // than loading as geometry, so merging the model set left it with nothing
      // to stand on. This is that stage, at its own dimensions — deck 760x220
      // r42, base 792x248 r50, with the reveal gap and its glow strip between
      // them — not an approximation of it.
      if (inst === "bioreactor") {
        const GROUND = -72;
        const roundedRect = function (w, d, r) {
          const sh = new THREE.Shape(), x = -w / 2, y = -d / 2;
          sh.moveTo(x + r, y);
          sh.lineTo(x + w - r, y);     sh.quadraticCurveTo(x + w, y, x + w, y + r);
          sh.lineTo(x + w, y + d - r); sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
          sh.lineTo(x + r, y + d);     sh.quadraticCurveTo(x, y + d, x, y + d - r);
          sh.lineTo(x, y + r);         sh.quadraticCurveTo(x, y, x + r, y);
          return sh;
        };
        const darkMat = new THREE.MeshStandardMaterial({
          color: 0x0b0d12, metalness: 0.5, roughness: 0.42, envMapIntensity: 0.8 });
        const glowMat = function (o) {
          return new THREE.MeshBasicMaterial({
            color: 0x5aa9ff, transparent: true, opacity: o,
            blending: THREE.AdditiveBlending, depthWrite: false,
            side: THREE.DoubleSide });
        };
        const stage = new THREE.Group();
        const tier = function (w, d, r, depth, y, mat) {
          const m = new THREE.Mesh(
            new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: depth, bevelEnabled: false }),
            mat);
          m.rotation.x = -Math.PI / 2;
          m.position.set(-80, y, -5);
          return m;
        };
        stage.add(tier(760, 220, 42, 12, GROUND - 12, darkMat));       // deck
        stage.add(tier(792, 248, 50, 8, GROUND - 23, darkMat));        // base
        const strip = tier(766, 226, 44, 1.6, GROUND - 14.3, glowMat(0.5));
        strip.renderOrder = 1;
        stage.add(strip);
        // the model was recentred a moment ago; the stage has to follow it
        stage.position.sub(c);
        rig.add(stage);
      }
      framed = true;
      fitFn = fit;
      media.classList.add("gl-ready");
      resize();
      draw();
    }

    function fit() {
      /* Solve the distance instead of deriving it.
         A closed-form fit kept clipping: it ignored that the camera looks down
         from an elevation, that perspective spreads the near corners more than
         the far ones, and that a model spun about Y presents a different
         silhouette at every angle. Measuring what actually lands on the canvas
         and stepping the camera back until it fits is exact, and it costs a few
         projections once per resize. */
      const TARGET = 0.86;                 // of a half-frame; the rest is margin
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
      }
    };

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        if (onScreen) tick();
      }, { rootMargin: "80px" }).observe(media);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });

    const card = media.closest("a.deck") || media;
    if (!reduced) {
      card.addEventListener("pointerenter", function () { hovering = true; last = 0; tick(); });
      card.addEventListener("pointerleave", function () { hovering = false; tick(); });
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
  fetch("img/deck3d/_manifest.json")
    .then(function (r) { return r.json(); })
    .then(function (man) {
      cards.forEach(function (media) {
        const link = media.closest("a.deck");
        const href = link ? link.getAttribute("href") || "" : "";
        const inst = Object.keys(man).filter(function (k) { return href.indexOf(k) === 0; })[0];
        if (!inst) return;
        mount(media, inst, man[inst]);
      });
    })
    .catch(function () { /* the poster stays; nothing else to do */ });
})();
