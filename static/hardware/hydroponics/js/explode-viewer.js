// Explode viewer: a rotatable 3D model of a photometer that comes apart on a slider.
//
// Hydroponics copy (17 Oct 2026): this file is ../../diopal/js/explode-viewer.js (itself the photometer's),
// copied so the pages can change apart. Two things are added for the floating plate (https://static.igem.wiki/teams/6072/wiki/hardware/hydroponics-models/explode-plate-hydroponics.json):
// - its three finishes, the hero story's (static/hardware/hydroponics/js/story.js): plate (black PLA), handle (grey) and holder (brown);
// - "models" in the config: a folder in the format PackedModel.load reads (model.json + model.bin, one group
//   per part), so the viewer draws the plate from product/, the pack the hero already ships, and adds no bytes.
//   A mesh names its group as "product/<group name>".
// Nothing else differs.
//
// One module for both photometers (the Pro and the Slim), each driven by a small JSON config
// (models/explode-pro.json, models/explode-slim.json): its parts, their files and finishes, where
// each one moves to when the model opens, and the number, name and role the key gives it.
//
//   <figure class="xv" data-xv="models/explode-pro.json" data-xv-static="#fig-pro-exploded"> ...
//
// What it does
// - Starts assembled at a three-quarter view. Drag turns it (a finger turns it only sideways, so
//   the page still scrolls under a vertical swipe: touch-action pan-y). The wheel is never taken.
// - The slider (a real <input type=range>) takes it from assembled to exploded; the button beside
//   it plays the whole move. The part numbers fade in as it opens. A number, or the part itself,
//   can be tapped: the others turn to glass and the bar names the part and what it does.
// - Draws only when something changed (a drag, the slider, a resize): no loop runs at rest.
// - Wakes up only when the figure comes near the viewport, and only then fetches three.js and the
//   models. Until the first frame is drawn the figure shows its poster, a still of this same
//   first frame, so the hand-over cannot be seen.
// - Without WebGL the figure shows the static exploded view with its numbers instead (the figure
//   named by data-xv-static, cloned), which is also what prints. A figure with no such view on the
//   page (17 Oct: the owner removed the static exploded views, the model explodes itself) keeps its
//   poster instead, and only the controls go (.xv--still).
//
// Dependencies (all shared, all already in hardware/js): three.min.js r128, STLLoader.js,
// render-quality.js (RQ: sRGB colours, normal smoothing) and packed-loader.js (the Slim's model
// ships packed). They are read from the page's <template id="xv-deps"> when it has one, so their
// URLs carry the site's cache stamps; otherwise they are found next to this file.
//
// window.__xv lists the viewers for checks and stills: v.ready, v.set({explode, yaw, pitch,
// select}), v.renderNow(), v.discs() (the numbers' laid-out positions in stage pixels).
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DEG = Math.PI / 180;

  /* ------------------------------------------------------------- dependencies */
  var depsOnce = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
  }
  function deps() {
    if (depsOnce) return depsOnce;
    var have = {
      "three.min.js": function () { return window.THREE; },
      "STLLoader.js": function () { return window.THREE && THREE.STLLoader; },
      "render-quality.js": function () { return window.RQ; },
      "packed-loader.js": function () { return window.PackedModel; },
    };
    var list = [];
    var tpl = document.getElementById("xv-deps");
    if (tpl && tpl.content) {
      Array.prototype.forEach.call(tpl.content.querySelectorAll("script[src]"), function (s) {
        list.push(s.getAttribute("src"));
      });
    } else {
      var base = new URL("../../js/", SCRIPT ? SCRIPT.src : location.href);
      list = ["vendor/three.min.js", "vendor/STLLoader.js", "render-quality.js", "packed-loader.js"]
        .map(function (f) { return new URL(f, base).href; });
    }
    depsOnce = list.reduce(function (p, src) {
      var file = src.split(/[?#]/)[0].split("/").pop();
      return p.then(function () {
        if (have[file] && have[file]()) return null;
        return loadScript(src);
      });
    }, Promise.resolve());
    return depsOnce;
  }

  function webglOK() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------------------- materials */
  // The finishes are the photometer story's (static/hardware/hydroponics/js/story.js), moved onto a pale studio: the same
  // black PLA, blue GY-302 boards and amber LED, so the record and the stage show one object.
  // Every colour goes through RQ.srgb (r128 has no colour management).
  function makeMaterials() {
    var S = RQ.srgb;
    function phys(o) { return new THREE.MeshPhysicalMaterial(o); }
    var glass = phys({
      color: S(0xdfe8ee), metalness: 0, roughness: 0.06, transparent: true, opacity: 1,
      envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.04,
      side: THREE.DoubleSide, depthWrite: false,
    });
    // Glass on a pale ground: nearly clear face-on, a cool darker rim at grazing angles, so its
    // edges draw the shape the way they do in a photograph (alpha from the view angle, as in
    // story.js, with the rim darkened instead of lightened for a light background).
    glass.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace("#include <alphatest_fragment>",
        "float gNdV = abs(dot(normalize(vNormal), normalize(vViewPosition)));\n" +
        "float gF = pow(1.0 - gNdV, 1.5);\n" +
        "diffuseColor.a = opacity * mix(0.40, 0.96, gF);\n" +
        "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.30, 0.38), gF * 0.9);\n" +
        "#include <alphatest_fragment>");
    };
    glass.customProgramCacheKey = function () { return "xv-glass"; };
    return {
      pla: phys({ color: S(0x2c2e33), metalness: 0.02, roughness: 0.58, envMapIntensity: 0.95,
        clearcoat: 0.18, clearcoatRoughness: 0.45 }),
      plaClip: phys({ color: S(0x26282d), metalness: 0.02, roughness: 0.52, envMapIntensity: 0.95,
        clearcoat: 0.2, clearcoatRoughness: 0.42 }),
      black: phys({ color: S(0x17191d), metalness: 0.1, roughness: 0.5, envMapIntensity: 0.9,
        clearcoat: 0.3, clearcoatRoughness: 0.3 }),
      pcb: phys({ color: S(0x14306b), metalness: 0.18, roughness: 0.46, envMapIntensity: 1.0,
        clearcoat: 0.45, clearcoatRoughness: 0.26 }),
      chipGrey: phys({ color: S(0x9ba1a9), metalness: 0.72, roughness: 0.4, envMapIntensity: 1.05,
        clearcoat: 0.6, clearcoatRoughness: 0.22 }),
      chipBlack: phys({ color: S(0x141619), metalness: 0.25, roughness: 0.48, envMapIntensity: 0.9,
        clearcoat: 0.5, clearcoatRoughness: 0.24 }),
      glass: glass,
      amber: phys({ color: S(0xffa04a), metalness: 0, roughness: 0.18, envMapIntensity: 0.8,
        emissive: S(0xff7a14), emissiveIntensity: 0.85, clearcoat: 1, clearcoatRoughness: 0.08 }),
      leg: phys({ color: S(0xc9ced4), metalness: 0.9, roughness: 0.3, envMapIntensity: 1.1 }),
      steel: phys({ color: S(0xcfd1d3), metalness: 1, roughness: 0.28, envMapIntensity: 1.15 }),
      alu: phys({ color: S(0xd6d8db), metalness: 1, roughness: 0.24, envMapIntensity: 1.2 }),
      jacket: phys({ color: S(0x141518), metalness: 0, roughness: 0.34, envMapIntensity: 0.9,
        clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      shrink: phys({ color: S(0x1a1b1e), metalness: 0, roughness: 0.62, envMapIntensity: 0.8 }),
      core: new THREE.MeshBasicMaterial({ color: S(0xffb257) }),
      dupont: phys({ color: S(0x15161a), metalness: 0, roughness: 0.45, envMapIntensity: 0.9 }),
      latch: phys({ color: S(0x3a3c40), metalness: 0.6, roughness: 0.35, envMapIntensity: 1 }),
      pin: phys({ color: S(0xd8c27a), metalness: 1, roughness: 0.3, envMapIntensity: 1.1 }),
      // Hydroponics: the hero story's three finishes (static/hardware/hydroponics/js/story.js), so the record and the stage show one object
      plate: phys({ color: S(0x1b1f26), metalness: 0.06, roughness: 0.6, envMapIntensity: 0.85,
        clearcoat: 0.14, clearcoatRoughness: 0.5 }),
      handle: phys({ color: S(0x6b727b), metalness: 0.08, roughness: 0.52, envMapIntensity: 0.9,
        clearcoat: 0.16, clearcoatRoughness: 0.45 }),
      holder: phys({ color: S(0x5c3410), metalness: 0, roughness: 0.82, envMapIntensity: 0.8 }),
      // LPA: grey PLA (base plate, sliders) and the green perf board, as in photos/cad-parts.webp
      plaGrey: phys({ color: S(0x5d6268), metalness: 0.02, roughness: 0.6, envMapIntensity: 0.9,
        clearcoat: 0.16, clearcoatRoughness: 0.45 }),
      pcbGreen: phys({ color: S(0x2d6a45), metalness: 0.15, roughness: 0.5, envMapIntensity: 0.9,
        clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    };
  }

  // The studio the parts reflect: a bright top, two long softboxes, a pale floor. Painted in sRGB
  // and marked so (RQ.studioEnv's lesson), then prefiltered.
  function studio(renderer) {
    var c = document.createElement("canvas"); c.width = 1024; c.height = 512;
    var g = c.getContext("2d");
    var sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0.0, "#d9e0e6"); sky.addColorStop(0.45, "#a9b2bb"); sky.addColorStop(0.5, "#8e969f");
    sky.addColorStop(0.54, "#9aa2aa"); sky.addColorStop(1.0, "#c3c8cd");
    g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
    function box(x, y, w, h, a, blur) {
      g.save(); g.filter = "blur(" + blur + "px)"; g.globalAlpha = a; g.fillStyle = "#ffffff";
      g.fillRect(x - w / 2, y - h / 2, w, h); g.restore();
    }
    box(250, 130, 330, 120, 1.0, 22);     // key softbox, high and to one side
    box(770, 170, 180, 250, 0.7, 26);     // fill strip on the other side
    box(512, 36, 700, 60, 0.6, 30);       // overhead
    g.save(); g.filter = "blur(36px)"; g.globalAlpha = 0.5; g.fillStyle = "#4b535c";
    g.fillRect(560, 70, 140, 190); g.fillRect(0, 170, 100, 220); g.restore();
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    var pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    var env = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
    return env;
  }

  /* --------------------------------------------------------------------- math */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function nextFrame() { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }

  /* ------------------------------------------------------------------- viewer */
  function Viewer(fig) {
    this.fig = fig;
    this.stage = fig.querySelector(".xv__stage");
    this.range = fig.querySelector(".xv__range");
    this.play = fig.querySelector(".xv__play");
    this.out = fig.querySelector(".xv__sel");
    this.resetBtn = fig.querySelector(".xv__reset");
    this.cfgUrl = fig.getAttribute("data-xv");
    this.explode = 0;              // shown
    this.target = 0;               // wanted
    this.selected = 0;
    this.dirty = false;
    this.visible = false;
    var self = this;
    this.ready = new Promise(function (res, rej) { self._resolve = res; self._reject = rej; });
  }

  Viewer.prototype.fallback = function (why) {
    var fig = this.fig;
    var src = document.querySelector(fig.getAttribute("data-xv-static") || "#none");
    var media = src && src.querySelector(".xs__media");
    if (!media) { fig.classList.add("xv--still"); }     // no static view on the page: the poster stays
    else {
      fig.classList.add("xv--static");
      if (!this.stage.querySelector(".xs__media")) {
        var clone = media.cloneNode(true);
        Array.prototype.forEach.call(clone.querySelectorAll("[id]"), function (e) { e.removeAttribute("id"); });
        this.stage.appendChild(clone);
      }
    }
    if (why) console.warn("explode viewer: " + why);
    this._resolve(this);
  };

  Viewer.prototype.boot = function () {
    var self = this;
    if (this.booted) return this.ready;
    this.booted = true;
    if (!webglOK()) { this.fallback("no WebGL"); return this.ready; }
    var t0 = performance.now();
    var cfgBase = new URL(this.cfgUrl, location.href);
    Promise.all([
      deps(),
      fetch(cfgBase.href, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(self.cfgUrl + " " + r.status);
        return r.json();
      }),
    ]).then(function (res) {
      self.cfg = res[1];
      self.base = new URL(self.cfg.base || "./", cfgBase).href;
      return self.build();
    }).then(function () {
      self.loadMs = Math.round(performance.now() - t0);
      self.fig.classList.add("xv--live");
      self.fig.setAttribute("data-load-ms", self.loadMs);
      self._resolve(self);
    }).catch(function (e) {
      self.fallback(e && e.message);
    });
    return this.ready;
  };

  // ---- the scene
  Viewer.prototype.build = function () {
    var self = this, cfg = this.cfg;
    var canvas = document.createElement("canvas");
    canvas.className = "xv__gl";
    canvas.setAttribute("aria-hidden", "true");
    this.stage.appendChild(canvas);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true,
      preserveDrawingBuffer: false, powerPreference: "default" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure || 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.sortObjects = true;
    this.renderer = renderer; this.canvas = canvas;

    var scene = new THREE.Scene();
    scene.environment = studio(renderer);
    this.scene = scene;
    var S = RQ.srgb;
    var hemi = new THREE.HemisphereLight(0xeef3f8, 0xb9b3aa, 0.55);
    var key = new THREE.DirectionalLight(0xfff4e8, 1.55);
    var rim = new THREE.DirectionalLight(0xd4e2f2, 0.75);
    var fill = new THREE.DirectionalLight(0xffffff, 0.35);
    scene.add(hemi, key, key.target, rim, fill);
    this.key = key; this.rim = rim; this.fill = fill;
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.5;
    key.shadow.radius = 4;

    this.mats = makeMaterials();
    this.edgeMat = new THREE.LineBasicMaterial({ color: S(0x3e5260), transparent: true, opacity: 0.55, depthWrite: false });
    // the other parts while one is picked: a pale, see-through grey that still shows their shape
    this.ghost = new THREE.MeshStandardMaterial({ color: S(0xaeb8c1), roughness: 0.8, metalness: 0,
      transparent: true, opacity: 0.34, depthWrite: false, envMapIntensity: 0.7 });

    // model root: the CAD frame turned so +y is up, then the stand (the Pro leans on its wedge)
    var root = new THREE.Group();
    var r = cfg.rotation || [0, 0, 0];
    root.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG, cfg.rotationOrder || "XYZ");
    scene.add(root);
    this.root = root;

    var camera = new THREE.PerspectiveCamera(cfg.view && cfg.view.fov || 24, 1, 1, 6000);
    this.camera = camera;
    this.yaw0 = (cfg.view && cfg.view.yaw || 35) * DEG;
    this.pitch0 = (cfg.view && cfg.view.pitch || 16) * DEG;
    this.yaw = this.yaw0; this.pitch = this.pitch0;

    return this.loadParts().then(function () {
      self.measure();
      self.makeBeams();
      self.ground();
      self.ui();
      self.resize();
      self.renderNow();
    });
  };

  // ---- geometry: STLs straight from models/, or groups out of a packed folder
  Viewer.prototype.loadParts = function () {
    var self = this, cfg = this.cfg;
    var stl = new THREE.STLLoader();
    var packs = {};
    var models = {};
    // a folder in PackedModel.load's format (model.json + model.bin): one load for the folder, then each
    // mesh takes its group by name ("product/Floating Plate" -> the group whose part is "Floating Plate")
    function modelPack(dir) {
      var all = PackedModel.load(new URL(dir, self.base).href);
      return {
        load: function (url, onLoad, onProgress, onError) {
          var name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop());
          all.then(function (m) {
            for (var i = 0; i < m.groups.length; i++) {
              if (m.groups[i].part === name) { onLoad(m.groups[i].geometry); return; }
            }
            onError(new Error(dir + name + " is not in the model"));
          }, onError);
        }
      };
    }
    function loaderFor(file) {
      var dir = file.indexOf("/") >= 0 ? file.slice(0, file.lastIndexOf("/") + 1) : "";
      if (dir && (cfg.models || []).indexOf(dir) >= 0) {
        if (!models[dir]) models[dir] = modelPack(dir);
        return models[dir];
      }
      if (dir && (cfg.packs || []).indexOf(dir) >= 0) {
        if (!packs[dir]) packs[dir] = PackedModel.bundle(new URL(dir, self.base).href);
        return packs[dir];
      }
      return stl;
    }
    var cache = {};
    function geometry(file) {
      if (!cache[file]) {
        cache[file] = new Promise(function (res, rej) {
          loaderFor(file).load(new URL(file, self.base).href, res, undefined, rej);
        }).then(function (geo) {
          return nextFrame().then(function () {           // one part per frame: no long task
            RQ.dropDegenerate(geo);
            var sm = cfg.smooth || {};
            if (sm.relax && /^part\d/.test(file.split("/").pop())) RQ.relaxSurfaces(geo);
            RQ.smoothNormals(geo, sm.angle || 40, sm.snap || 0);
            geo.computeBoundingBox();
            return geo;
          });
        });
      }
      return cache[file];
    }
    this.parts = [];
    var jobs = [];
    cfg.parts.forEach(function (p) {
      var part = { n: p.n, name: p.name, role: p.role, kind: p.kind || "printed",
        group: new THREE.Group(), meshes: [], spec: p };
      part.group.userData.part = part;
      self.root.add(part.group);
      self.parts.push(part);
      (p.meshes || []).forEach(function (m) {
        var list = m.matrices || (m.matrix ? [m.matrix] : [null]);
        list.forEach(function (mx, k) {
          jobs.push(geometry(m.file).then(function (geo) {
            var mat = self.mats[m.mat] || self.mats.pla;
            var mesh = new THREE.Mesh(geo, mat);
            if (mx) {
              var M = new THREE.Matrix4();
              if (mx.length === 16) M.fromArray(mx).transpose();          // row-major in the config
              else M.set(mx[0][0], mx[0][1], mx[0][2], mx[0][3], mx[1][0], mx[1][1], mx[1][2], mx[1][3],
                mx[2][0], mx[2][1], mx[2][2], mx[2][3], 0, 0, 0, 1);
              mesh.matrixAutoUpdate = false; mesh.matrix.copy(M);
            }
            var holder = new THREE.Group();          // its own explode (screws go their own ways)
            holder.add(mesh);
            var ex = (m.explodeEach && m.explodeEach[k]) || m.explode || null;
            holder.userData.explode = ex ? new THREE.Vector3().fromArray(ex) : null;
            part.group.add(holder);
            var isGlass = mat === self.mats.glass;
            if (isGlass) {
              // glass on a pale ground is read by its edges, as in a drawing
              if (!geo.userData.edges) geo.userData.edges = new THREE.EdgesGeometry(geo, 28);
              var edges = new THREE.LineSegments(geo.userData.edges, self.edgeMat);
              edges.renderOrder = 11;
              mesh.add(edges);
              mesh.userData.edges = edges;
            }
            mesh.castShadow = !isGlass && m.mat !== "core";
            mesh.receiveShadow = !isGlass;
            mesh.renderOrder = isGlass ? 10 : 0;
            mesh.userData.mat0 = mat;
            mesh.userData.part = part;
            part.meshes.push(mesh);
          }));
        });
      });
    });
    return Promise.all(jobs);
  };

  // where things are, assembled and exploded, for the camera, the ground and the numbers
  Viewer.prototype.measure = function () {
    var self = this, cfg = this.cfg;
    var n = this.parts.length;
    this.parts.forEach(function (part, i) {
      var p = part.spec;
      part.offset = new THREE.Vector3().fromArray(p.explode || [0, 0, 0]);
      // staggered: the outer parts leave first, the core last (config order unless delay is given)
      part.delay = p.delay !== undefined ? p.delay : 0;
      // the anchor its number sits on: given in the CAD frame, or the middle of the part
      var box = new THREE.Box3();
      part.meshes.forEach(function (m) {
        if (m.matrixAutoUpdate) m.updateMatrix();
        box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix));
      });
      part.box = box;
      // anchorOf: the number rides on one copy (the screws), in that copy's own frame
      if (p.anchorOf !== undefined && part.meshes[p.anchorOf]) {
        var m0 = part.meshes[p.anchorOf];
        part.anchorObj = m0.parent;
        part.anchorBox = m0.geometry.boundingBox.clone().applyMatrix4(m0.matrix);
        part.anchor = p.anchor ? new THREE.Vector3().fromArray(p.anchor) : part.anchorBox.getCenter(new THREE.Vector3());
      } else {
        part.anchorObj = part.group;
        part.anchor = p.anchor ? new THREE.Vector3().fromArray(p.anchor) : box.getCenter(new THREE.Vector3());
      }
    });
    var spanMax = 0;
    this.parts.forEach(function (p) { spanMax = Math.max(spanMax, p.delay); });
    this.window = 1 - spanMax;
    // bounds in world space at both ends
    function boundsAt(e) {
      self.pose(e);
      self.root.updateMatrixWorld(true);
      var b = new THREE.Box3();
      self.parts.forEach(function (part) {
        part.meshes.forEach(function (m) {
          b.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
        });
      });
      return b;
    }
    this.boxA = boundsAt(0);
    this.boxE = boundsAt(1);
    // the framing: every mesh's box corners seen along the starting view, at both ends of the slider
    var yaw = this.yaw0, pitch = this.pitch0;
    var back = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    var right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    var up = back.clone().cross(right).normalize();
    function fitAt(e) {
      self.pose(e);
      self.root.updateMatrixWorld(true);
      var u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9, w0 = 1e9, w1 = -1e9, q = new THREE.Vector3();
      self.parts.forEach(function (part) {
        part.meshes.forEach(function (m) {
          var bb = m.geometry.boundingBox;
          for (var k = 0; k < 8; k++) {
            q.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld);
            var u = q.dot(right), v = q.dot(up), w = q.dot(back);
            if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; if (w < w0) w0 = w; if (w > w1) w1 = w;
          }
        });
      });
      var c = right.clone().multiplyScalar((u0 + u1) / 2).addScaledVector(up, (v0 + v1) / 2).addScaledVector(back, (w0 + w1) / 2);
      return { c: c, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2, hw: (w1 - w0) / 2 };
    }
    this.fitA = fitAt(0);
    this.fitE = fitAt(1);
    this.pose(0);
  };

  // explode amount e in [0,1] -> every part's offset
  Viewer.prototype.pose = function (e) {
    var w = this.window || 1;
    this.parts.forEach(function (part) {
      var t = REDUCED ? clamp(e, 0, 1) : easeInOut((e - part.delay) / w);
      part.t = t;
      part.group.position.copy(part.offset || new THREE.Vector3()).multiplyScalar(t);
      part.group.children.forEach(function (h) {
        if (h.userData.explode) h.position.copy(h.userData.explode).multiplyScalar(t);
      });
    });
  };

  // The light path, drawn between the optics once they are out: amber from the LED to the splitter,
  // green on through the culture to the sample sensor, blue across to the reference sensor (the
  // optical-layout diagrams' colours). Each beam runs between two parts' middles, so it follows
  // them as they move, and it only shows near the end of the slider.
  var BEAM = { amber: 0xf29d38, green: 0x2fa36b, blue: 0x3b82c4 };
  Viewer.prototype.makeBeams = function () {
    var self = this, list = this.cfg.beams;
    if (!list || !list.length) return;
    var byN = {};
    this.parts.forEach(function (p) { byN[p.n] = p; });
    var geo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
    this.beams = list.map(function (b) {
      var mat = new THREE.MeshBasicMaterial({ color: RQ.srgb(BEAM[b.color] || BEAM.amber), transparent: true,
        opacity: 0, depthWrite: false, toneMapped: false });
      var m = new THREE.Mesh(geo, mat);
      m.renderOrder = 5;
      self.root.add(m);
      function mid(p) { return p.box.getCenter(new THREE.Vector3()); }
      return { mesh: m, a: byN[b.from], b: byN[b.to], ca: b.fromAt ? new THREE.Vector3().fromArray(b.fromAt) : mid(byN[b.from]),
        cb: b.toAt ? new THREE.Vector3().fromArray(b.toAt) : mid(byN[b.to]), r: b.r || self.cfg.beamRadius || 0.9 };
    });
  };
  Viewer.prototype.placeBeams = function () {
    var show = smooth((this.explode - 0.72) / 0.28), self = this;
    var Y = new THREE.Vector3(0, 1, 0);
    this.beams.forEach(function (b) {
      var p0 = b.ca.clone().add(b.a.group.position), p1 = b.cb.clone().add(b.b.group.position);
      var d = p1.clone().sub(p0), len = d.length();
      b.mesh.visible = show > 0.01 && len > 0.5 && !self.selected;
      if (!b.mesh.visible) return;
      b.mesh.position.copy(p0).addScaledVector(d, 0.5);
      b.mesh.quaternion.setFromUnitVectors(Y, d.normalize());
      b.mesh.scale.set(b.r, len, b.r);
      b.mesh.material.opacity = 0.85 * show;
    });
  };

  Viewer.prototype.ground = function () {
    var b = this.boxA, size = b.getSize(new THREE.Vector3());
    var R = Math.max(size.x, size.z, this.boxE.getSize(new THREE.Vector3()).length()) * 2.5;
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(R, R),
      new THREE.ShadowMaterial({ color: 0x1d2730, opacity: (this.cfg.shadow || 0.16) }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set((b.min.x + b.max.x) / 2, b.min.y - 0.05, (b.min.z + b.max.z) / 2);
    plane.receiveShadow = true;
    this.scene.add(plane);
    this.plane = plane;
    // the key's shadow camera: around both states
    var all = this.boxA.clone().union(this.boxE);
    var c = all.getCenter(new THREE.Vector3()), r = all.getSize(new THREE.Vector3()).length() * 0.6;
    var L = this.cfg.light || {};
    var kd = new THREE.Vector3().fromArray(L.key || [0.55, 1.0, 0.75]).normalize();
    this.key.position.copy(c).addScaledVector(kd, r * 3);
    this.key.target.position.copy(c);
    var sc = this.key.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = r * 0.5; sc.far = r * 6;
    sc.updateProjectionMatrix();
    this.rim.position.copy(c).add(new THREE.Vector3().fromArray(L.rim || [-0.8, 0.5, -0.7]).normalize().multiplyScalar(r * 3));
    this.fill.position.copy(c).add(new THREE.Vector3().fromArray(L.fill || [-0.6, 0.2, 0.9]).normalize().multiplyScalar(r * 3));
    this.key.intensity = L.keyI || 1.55; this.rim.intensity = L.rimI || 0.75; this.fill.intensity = L.fillI || 0.35;
  };

  // camera: orbit the framing's middle at the distance that fits the model along the starting
  // view (projected box corners, so a tall model fills a tall frame); when a part is picked the
  // camera eases in on it (focus 0..1) so the small optics can be seen
  Viewer.prototype.placeCamera = function () {
    var e = REDUCED ? this.explode : smooth(this.explode);
    var A = this.fitA, E = this.fitE, fr = this.cfg.frame || {};
    var c = new THREE.Vector3().lerpVectors(A.c, E.c, e);
    var hu = A.hu + (E.hu - A.hu) * e, hv = A.hv + (E.hv - A.hv) * e, hw = A.hw + (E.hw - A.hw) * e;
    var cam = this.camera, aspect = cam.aspect;
    var tv = Math.tan(cam.fov * DEG / 2), th = tv * aspect;
    var margin = fr.margin || 0.12;
    var dist = Math.max(hv / tv, hu / th) / (1 - margin) + hw * 0.6;
    var f = this.focusPart ? (REDUCED ? 1 : easeInOut(this.focus || 0)) : 0;
    if (f > 0) {
      var pb = this.focusBox, pc = pb.getCenter(new THREE.Vector3());
      // the part takes about a third of the frame, and the view never comes in more than 3x
      var pr = Math.max(pb.getSize(new THREE.Vector3()).length() / 2, 8);
      var pd = clamp(pr / Math.min(tv, th) * 3.2, dist / 3, dist);
      c.lerp(pc, f);
      dist = dist + (pd - dist) * f;
    }
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    cam.position.set(c.x + dist * cp * Math.sin(this.yaw), c.y + dist * sp, c.z + dist * cp * Math.cos(this.yaw));
    var reach = Math.max(hu, hv, hw) * 2.2;
    cam.near = Math.max(1, dist - reach); cam.far = dist + reach * 2;
    cam.updateProjectionMatrix();
    cam.lookAt(c);
  };

  Viewer.prototype.resize = function () {
    var w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  };

  Viewer.prototype.request = function () {
    var self = this;
    this.dirty = true;
    if (this.raf || !this.visible) return;
    this.raf = requestAnimationFrame(function () { self.raf = 0; self.frame(); });
  };

  // one frame: step whatever is moving, draw, and ask for another only if something still is
  Viewer.prototype.frame = function () {
    var moving = false;
    if (this.explode !== this.target) {
      if (REDUCED) this.explode = this.target;
      else if (this.tween) {
        var k = clamp((performance.now() - this.tween.t0) / this.tween.ms, 0, 1);
        this.explode = this.tween.from + (this.tween.to - this.tween.from) * easeInOut(k);
        if (k >= 1) { this.explode = this.target = this.tween.to; this.tween = null; }
      } else {
        var d = this.target - this.explode;
        this.explode = Math.abs(d) < 0.002 ? this.target : this.explode + d * 0.22;
      }
      moving = this.explode !== this.target;
    }
    if (this.focusTween) {
      var fk = clamp((performance.now() - this.focusTween.t0) / 650, 0, 1);
      this.focus = this.focusTween.from + (this.focusTween.to - this.focusTween.from) * fk;
      if (fk >= 1) {
        this.focusTween = null;
        if (this.focus === 0) this.focusPart = null;
      } else moving = true;
    }
    if (this.spin && !this.dragging) {
      this.yaw += this.spin;
      this.spin *= 0.88;
      if (Math.abs(this.spin) < 0.0004) this.spin = 0; else moving = true;
    }
    this.renderNow();
    if (moving) this.request();
  };

  Viewer.prototype.renderNow = function () {
    this.dirty = false;
    this.pose(this.explode);
    if (this.beams) this.placeBeams();
    if (this.plane) this.plane.material.opacity = (this.cfg.shadow || 0.16) * (1 - 0.6 * smooth(this.explode));
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
    this.layoutDiscs();
  };

  /* --------------------------------------------------------------- numbers */
  Viewer.prototype.ui = function () {
    var self = this;
    var layer = document.createElement("div");
    layer.className = "xv__discs";
    var svgNS = "http://www.w3.org/2000/svg";
    var lines = document.createElementNS(svgNS, "svg");
    lines.setAttribute("class", "xv__leaders"); lines.setAttribute("aria-hidden", "true");
    layer.appendChild(lines);
    this.discLayer = layer; this.leaderSvg = lines;
    this.parts.forEach(function (part) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "xv__num xv__num--" + part.kind;
      b.textContent = part.n;
      b.setAttribute("aria-label", part.n + ": " + part.name);
      b.setAttribute("aria-pressed", "false");
      b.tabIndex = -1;
      b.addEventListener("click", function (ev) { ev.stopPropagation(); self.select(self.selected === part.n ? 0 : part.n); });
      layer.appendChild(b);
      part.disc = b;
      var ln = document.createElementNS(svgNS, "line");
      lines.appendChild(ln);
      part.leader = ln;
      var dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("r", "2.2");
      lines.appendChild(dot);
      part.dot = dot;
    });
    this.stage.appendChild(layer);

    // the slider and the play button
    if (this.range) {
      this.range.disabled = false;
      this.range.addEventListener("input", function () {
        self.tween = null;
        self.target = clamp(+self.range.value / +(self.range.max || 100), 0, 1);
        self.syncRange();
        self.syncControls(self.target);
        self.hideHint();
        self.request();
      });
    }
    if (this.play) {
      this.play.disabled = false;
      this.play.addEventListener("click", function () {
        var to = self.target > 0.5 ? 0 : 1;
        self.tween = { from: self.explode, to: to, t0: performance.now(), ms: 1500 * Math.abs(to - self.explode) + 200 };
        self.target = to;
        if (self.range) { self.range.value = Math.round(to * (+self.range.max || 100)); self.syncRange(); }
        self.hideHint();
        self.syncControls(to);
        self.request();
      });
    }
    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", function () {
        self.spin = 0;
        var y0 = self.yaw, p0 = self.pitch, t0 = performance.now();
        // shortest way home
        var dy = ((self.yaw0 - y0) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        (function step() {
          var k = REDUCED ? 1 : clamp((performance.now() - t0) / 600, 0, 1), e = easeInOut(k);
          self.yaw = y0 + dy * e; self.pitch = p0 + (self.pitch0 - p0) * e;
          self.renderNow();
          if (k < 1) requestAnimationFrame(step); else self.fig.classList.remove("xv--turned");
        })();
      });
    }
    this.drag();
    this.say();
  };

  // the filled part of the track, and what a screen reader hears
  Viewer.prototype.syncRange = function () {
    if (!this.range) return;
    var v = +this.range.value, max = +(this.range.max || 100), k = v / max;
    this.range.style.setProperty("--pct", (k * 100).toFixed(1) + "%");
    this.range.setAttribute("aria-valuetext", k <= 0 ? "assembled" : k >= 1 ? "fully exploded" : "exploded " + Math.round(k * 100) + " percent");
  };

  Viewer.prototype.syncControls = function (to) {
    if (this.play) {
      var open = to > 0.5;
      this.play.setAttribute("aria-label", open ? "Put it back together" : "Take it apart");
      this.play.classList.toggle("is-open", open);
    }
  };

  Viewer.prototype.hideHint = function () {
    if (!this.hinted) { this.hinted = true; this.fig.classList.add("xv--used"); }
  };

  // Where each number goes. A big part carries its number on itself; a small one (the LED, the lens,
  // a sensor board) would vanish under a 26 px disc, so its number stands off it, outward from the
  // model's middle, with a hairline and a dot back to the part. Overlapping numbers are then pushed
  // apart (a few relaxation passes, from scratch every frame, so the layout is a pure function of
  // the view and never drifts) and kept inside the stage.
  Viewer.prototype.layoutDiscs = function () {
    if (!this.discLayer) return;
    var w = this.w, h = this.h, cam = this.camera;
    var show = smooth((this.explode - 0.32) / 0.4);
    this.fig.style.setProperty("--xv-discs", show.toFixed(3));
    var on = show > 0.02;
    if (on !== this.discsOn) {
      this.discsOn = on;
      this.discLayer.classList.toggle("is-on", on);
      this.parts.forEach(function (p) { p.disc.tabIndex = on ? 0 : -1; });
    }
    if (!on && !this.forceDiscs) return;
    var R = this.discR || 13, gap = 4, pad = R + 3;
    var v = new THREE.Vector3(), pts = [], self = this;
    this.root.updateMatrixWorld(true);
    function toScreen(vec, obj) {
      v.copy(vec); obj.localToWorld(v); v.project(cam);
      return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
    }
    var mx = 0, my = 0;
    this.parts.forEach(function (part) {
      var a = toScreen(part.anchor, part.anchorObj);
      // the part's size on screen: its box's eight corners, projected
      var b = part.anchorObj === part.group ? part.box : part.anchorBox;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (var k = 0; k < 8; k++) {
        var c = toScreen(new THREE.Vector3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z), part.anchorObj);
        x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
      }
      var pw = x1 - x0, ph = y1 - y0;
      // a part given a callout in its config always stands its number off; others carry it on themselves when they
      // are big enough on screen (a long thin part, the cuvette, can pass a size test and still be all glass)
      pts.push({ part: part, ax: a[0], ay: a[1], pw: pw, ph: ph, big: !part.spec.callout && Math.min(pw, ph) > 3.2 * R });
      mx += a[0]; my += a[1];
    });
    mx /= pts.length; my /= pts.length;
    pts.forEach(function (p) {
      if (p.big) { p.x = p.ax; p.y = p.ay; return; }
      var dx = p.ax - mx, dy = p.ay - my, d = Math.hypot(dx, dy);
      var dir = p.part.spec.callout && p.part.spec.callout.length === 2 ? p.part.spec.callout : null;
      if (dir) { dx = dir[0]; dy = dir[1]; d = Math.hypot(dx, dy); }
      if (d < 1) { dx = 1; dy = 0; d = 1; }
      var reach = Math.max(p.pw, p.ph) * 0.5 * 0.7 + R + 12;
      p.x = p.ax + dx / d * reach; p.y = p.ay + dy / d * reach;
    });
    var minD = 2 * R + gap;
    for (var it = 0; it < 30; it++) {
      var moved = false;
      for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          var a = pts[i], b = pts[j];
          var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d < minD) {
            if (d < 0.01) { dx = 1; dy = 0; d = 1; }
            var push = (minD - d) / 2;
            // a number sitting on a big part gives way less, so it stays on its part
            var wa = a.big && !b.big ? 0.25 : !a.big && b.big ? 1.75 : 1;
            a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
            b.x += dx / d * push * (2 - wa); b.y += dy / d * push * (2 - wa);
            moved = true;
          }
        }
      }
      pts.forEach(function (p) {
        p.x = clamp(p.x, pad, w - pad); p.y = clamp(p.y, pad, h - pad);
      });
      if (!moved) break;
    }
    this.layout = pts.map(function (p) {
      var off = Math.hypot(p.x - p.ax, p.y - p.ay);
      p.part.disc.style.transform = "translate(" + (p.x - R).toFixed(1) + "px," + (p.y - R).toFixed(1) + "px)";
      var ln = p.part.leader, lead = off > R * 0.9;
      if (lead) {
        var ux = (p.ax - p.x) / off, uy = (p.ay - p.y) / off;
        ln.setAttribute("x1", (p.x + ux * R).toFixed(1)); ln.setAttribute("y1", (p.y + uy * R).toFixed(1));
        ln.setAttribute("x2", p.ax.toFixed(1)); ln.setAttribute("y2", p.ay.toFixed(1));
        ln.style.display = "";
        p.part.dot.setAttribute("cx", p.ax.toFixed(1)); p.part.dot.setAttribute("cy", p.ay.toFixed(1));
        p.part.dot.style.display = "";
      } else { ln.style.display = "none"; p.part.dot.style.display = "none"; }
      return { n: p.part.n, kind: p.part.kind, x: p.x, y: p.y, ax: p.ax, ay: p.ay, leader: lead };
    });
    void self;
  };

  /* ---------------------------------------------------------------- select */
  Viewer.prototype.select = function (n) {
    var self = this;
    this.selected = n;
    this.parts.forEach(function (part) {
      var on = !n || part.n === n;
      part.meshes.forEach(function (m) {
        m.material = on ? m.userData.mat0 : self.ghost;
        m.castShadow = on && m.userData.mat0 !== self.mats.glass;
        if (m.userData.edges) m.userData.edges.visible = on;
      });
      part.disc.classList.toggle("is-sel", part.n === n);
      part.disc.setAttribute("aria-pressed", part.n === n ? "true" : "false");
      part.leader.classList.toggle("is-sel", part.n === n);
      part.dot.classList.toggle("is-sel", part.n === n);
    });
    this.fig.classList.toggle("xv--sel", !!n);
    // ease in on the picked part; out again when let go
    var part = null;
    this.parts.forEach(function (p) { if (p.n === n) part = p; });
    if (part) {
      this.root.updateMatrixWorld(true);
      var box = new THREE.Box3();
      part.meshes.forEach(function (m) { box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); });
      this.focusBox = box;
      this.focusPart = part;
    }
    var to = part && this.cfg.focus !== false ? 1 : 0;
    if (REDUCED) { this.focus = to; if (!to) this.focusPart = null; }
    else this.focusTween = { from: this.focus || 0, to: to, t0: performance.now() };
    this.fig.classList.toggle("xv--focus", !!to);
    this.say();
    this.request();
  };

  Viewer.prototype.say = function () {
    if (!this.out) return;
    var n = this.selected, part = null;
    this.parts.forEach(function (p) { if (p.n === n) part = p; });
    if (part) {
      this.out.innerHTML = "";
      var b = document.createElement("b"); b.textContent = part.n + " · " + part.name;
      this.out.appendChild(b);
      if (part.role) { this.out.appendChild(document.createTextNode(" " + part.role)); }
      this.out.classList.add("is-part");
    } else {
      this.out.textContent = this.out.getAttribute("data-idle") || "";
      this.out.classList.remove("is-part");
    }
  };

  /* ------------------------------------------------------------------ drag */
  Viewer.prototype.drag = function () {
    var self = this, el = this.stage;
    var id = null, x0 = 0, y0 = 0, lastX = 0, lastT = 0, moved = 0, type = "mouse";
    el.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest(".xv__num, .xv__reset, button, a")) return;
      id = e.pointerId; type = e.pointerType;
      x0 = lastX = e.clientX; y0 = e.clientY; lastT = performance.now(); moved = 0;
      self.dragging = true; self.spin = 0;
      if (type !== "touch") { try { el.setPointerCapture(id); } catch (err) { /* ignore */ } }
      el.classList.add("is-grab");
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId !== id) return;
      var dx = e.clientX - lastX, dy = e.clientY - y0;
      moved += Math.abs(dx);
      var k = 0.0085 * (self.cfg.view && self.cfg.view.speed || 1);
      self.yaw -= dx * k;
      var now = performance.now();
      self.vel = -dx * k / Math.max(8, now - lastT) * 16;
      lastX = e.clientX; lastT = now;
      if (type !== "touch") {                     // a finger only turns it; the page keeps vertical
        self.pitch = clamp(self.pitch + (e.clientY - y0) * 0.006, 2 * DEG, 52 * DEG);
        moved += Math.abs(dy);
        y0 = e.clientY;
      }
      if (moved > 3) { self.hideHint(); self.fig.classList.add("xv--turned"); }
      self.request();
    });
    function end(e) {
      if (e.pointerId !== id) return;
      id = null; self.dragging = false;
      el.classList.remove("is-grab");
      if (moved <= 3 && e.type === "pointerup") self.pick(e);
      else if (!REDUCED && Math.abs(self.vel || 0) > 0.002 && performance.now() - lastT < 80) {
        self.spin = clamp(self.vel, -0.06, 0.06);
        self.request();
      }
      self.vel = 0;
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    // keys on the stage: arrows turn it, Escape lets go of a selection
    el.addEventListener("keydown", function (e) {
      if (e.target !== el) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        self.yaw += (e.key === "ArrowLeft" ? 1 : -1) * 15 * DEG; self.fig.classList.add("xv--turned");
        self.request(); e.preventDefault();
      } else if (e.key === "Escape" && self.selected) { self.select(0); }
    });
    this.fig.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && self.selected) self.select(0);
    });
  };

  // a tap on the model picks the part under it; a tap on empty space lets go
  Viewer.prototype.pick = function (e) {
    var r = this.stage.getBoundingClientRect();
    var ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    var ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    var meshes = [];
    this.parts.forEach(function (p) { p.meshes.forEach(function (m) { meshes.push(m); }); });
    var hit = ray.intersectObjects(meshes, false)[0];
    if (hit && this.explode > 0.3) {
      var n = hit.object.userData.part.n;
      this.select(this.selected === n ? 0 : n);
    } else if (this.selected) this.select(0);
  };

  /* -------------------------------------------------------------------- set */
  // for checks and for rendering the stills: everything at once, drawn now
  Viewer.prototype.set = function (o) {
    o = o || {};
    if (o.explode !== undefined) { this.explode = this.target = o.explode; this.tween = null;
      if (this.range) { this.range.value = Math.round(o.explode * (+this.range.max || 100)); this.syncRange(); this.syncControls(o.explode); } }
    if (o.yaw !== undefined) this.yaw = o.yaw * DEG;
    if (o.pitch !== undefined) this.pitch = o.pitch * DEG;
    if (o.select !== undefined) this.select(o.select);
    if (o.discR) this.discR = o.discR;
    this.spin = 0;
    this.renderNow();
    return this.discs();
  };
  Viewer.prototype.discs = function () {
    return { w: this.w, h: this.h, R: this.discR || 13, discs: this.layout || [] };
  };

  /* ------------------------------------------------------------------ start */
  var viewers = [];
  window.__xv = viewers;

  // the still exploded views: pointing at a line of the key lights its number on the picture, and back
  function wireStatics() {
    Array.prototype.forEach.call(document.querySelectorAll("figure.xs"), function (fig) {
      function hot(n, on) {
        Array.prototype.forEach.call(fig.querySelectorAll('[data-n="' + n + '"]'), function (e) {
          e.classList.toggle("is-hot", on);
        });
      }
      Array.prototype.forEach.call(fig.querySelectorAll(".xs__key li[data-n]"), function (li) {
        var n = li.getAttribute("data-n");
        li.addEventListener("pointerenter", function () { hot(n, true); });
        li.addEventListener("pointerleave", function () { hot(n, false); });
      });
    });
  }

  function start() {
    wireStatics();
    var figs = document.querySelectorAll("figure.xv[data-xv]");
    if (!figs.length) return;
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target.__xv;
        if (!v) return;
        // wake one screen ahead; draw only while on screen
        if (en.isIntersecting) v.boot();
      });
    }, { rootMargin: "100% 0px 100% 0px" }) : null;
    var seen = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target.__xv;
        if (!v) return;
        v.visible = en.isIntersecting;
        if (v.visible && v.dirty && v.renderer) v.request();
      });
    }, { rootMargin: "64px 0px 64px 0px" }) : null;
    Array.prototype.forEach.call(figs, function (fig) {
      var v = new Viewer(fig);
      fig.__xv = v;
      viewers.push(v);
      if (v.out && !v.out.getAttribute("data-idle")) v.out.setAttribute("data-idle", v.out.textContent);
      if (io) { io.observe(fig); seen.observe(fig); } else { v.visible = true; v.boot(); }
      v.ready.then(function () {
        if (!v.renderer) return;
        if ("ResizeObserver" in window) new ResizeObserver(function () { v.resize(); }).observe(v.stage);
        else window.addEventListener("resize", function () { v.resize(); });
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
