// Bio viewer: the two rotatable 3D models of the bioreactor page's part 5 (17 Oct 2026).
//
// A copy of the photometer page's explode viewer (static/hardware/photometer/js/explode-viewer.js, W2), extended for the
// bioreactor's two models and left as its own file so the photometer page is never touched by it:
//   - https://static.igem.wiki/teams/6072/wiki/hardware/bioreactor-models/xv-rack-bioreactor-v2.json        the lab bioreactor (rack version A): two toggles light the culture loop amber and
//                                the protectant line green; with a loop lit, its parts carry the numbers of 5.1's key
//                                (culture 1-8, protectant 9-10) and the bar under the model says the loop's path.
//   - https://static.igem.wiki/teams/6072/wiki/hardware/bioreactor-models/xv-commercial-bioreactor.json  the commercial bioreactor (the B2 cabinet): the slider takes the case off as the
//                                page's scroll hero does (dev/bioreactor-hero/v4/scene.js splitCase/flyCase), but
//                                stops short: the handle and the top panel lift, the door and the side and end panels
//                                slide out along their normals, the frame follows, staggered, each piece with a slight
//                                lean; the inside stays put, and its numbers 1-10 (5.3's key) come in as the case goes.
//
//   <figure class="xv" data-xv="https://static.igem.wiki/teams/6072/wiki/hardware/bioreactor-models/xv-rack-bioreactor-v2.json"> ...
//
// What it keeps from the explode viewer: drag turns the model (a finger turns it only sideways: touch-action pan-y,
// so the page still scrolls under a vertical swipe); the wheel is never taken; it draws only when something changed
// (no loop at rest); it wakes when the figure comes near the screen and only then fetches three.js and the model;
// until its first frame the figure shows its poster (a still of that same first frame, dev/bio5/tools/
// capture_posters.py); without WebGL the poster stays and the controls go (.xv--still).
//
// The model: one binary per machine (tools/b2web's pack format v2 without normals, written by dev/bio5/tools/
// pack_web.py): one chunk per (part, piece, material). The config beside it names the parts, the pieces' moves, the
// materials' look (cfg.look: name pattern -> finish, first match wins; every colour an sRGB hex, made linear by
// RQ.srgb, since r128 has no colour management) and the light.
//
// The camera is fitted, not guessed: at load, for every slider position and every turn, the distance and aim that
// put every corner of every part inside the stage's frame with the configured margin (perspective included). The
// framing eases out with the slider no faster than the case needs, so the exploded case is in frame all the way.
//
// Dependencies (shared, in hardware/js): three.min.js r128 and render-quality.js (RQ). They are read from the page's
// <template id="xv-deps">, so their URLs carry the site's cache stamps.
//
// window.__xv lists the viewers for checks and stills: v.ready, v.set({explode, yaw, pitch, select, loops, focus}),
// v.renderNow(), v.discs().
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var DEG = Math.PI / 180;
  var LOOP = { cul: 0xf29d38, pro: 0x2fa36b };

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
      "render-quality.js": function () { return window.RQ; },
    };
    var list = [];
    var tpl = document.getElementById("xv-deps");
    if (tpl && tpl.content) {
      Array.prototype.forEach.call(tpl.content.querySelectorAll("script[src]"), function (s) {
        list.push(s.getAttribute("src"));
      });
    } else {
      var base = new URL("../../js/", SCRIPT ? SCRIPT.src : location.href);
      list = ["vendor/three.min.js", "render-quality.js"].map(function (f) { return new URL(f, base).href; });
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

  /* ------------------------------------------------------------------ math */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function smoother(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------------------------------------------------------------- materials */
  // Glass: a fresnel alpha (nearly clear face-on, denser at the rim) and a rim colour: a cool dark rim reads as glass
  // on the pale studio (the rack), a pale one inside the black cabinet (the commercial bioreactor). The numbers are
  // uniforms, so every glass shares one program.
  function glassMat(hex, o) {
    o = o || {};
    var m = new THREE.MeshPhysicalMaterial({
      color: RQ.srgb(hex || "#dfe8ee"), metalness: 0, roughness: o.rough === undefined ? 0.06 : o.rough, transparent: true,
      opacity: o.op === undefined ? 1 : o.op, envMapIntensity: o.env === undefined ? 1.5 : o.env, clearcoat: 1,
      clearcoatRoughness: 0.05, side: o.side === undefined ? THREE.DoubleSide : o.side, depthWrite: false,
    });
    var rim = o.rimCol ? RQ.srgb(o.rimCol) : new THREE.Color(0.22, 0.30, 0.36);      // (the first viewer's rim, linear)
    m.userData.glass = { face: o.face === undefined ? 0.22 : o.face, rim: o.rim === undefined ? 0.9 : o.rim,
      rimK: o.rimK === undefined ? 0.85 : o.rimK, pow: o.pow || 1.5, rimCol: rim };
    m.onBeforeCompile = function (sh) {
      var g = m.userData.glass;
      sh.uniforms.uGFace = { value: g.face }; sh.uniforms.uGRim = { value: g.rim };
      sh.uniforms.uGRimK = { value: g.rimK }; sh.uniforms.uGPow = { value: g.pow }; sh.uniforms.uGRimCol = { value: g.rimCol };
      sh.fragmentShader = "uniform float uGFace, uGRim, uGRimK, uGPow; uniform vec3 uGRimCol;\n" +
        sh.fragmentShader.replace("#include <alphatest_fragment>",
          "float gNdV = abs(dot(normalize(vNormal), normalize(vViewPosition + vec3(1e-6))));\n" +
          "float gF = pow(clamp(1.0 - gNdV, 0.0, 1.0), uGPow);\n" +
          "diffuseColor.a = opacity * mix(uGFace, uGRim, gF);\n" +
          "diffuseColor.rgb = mix(diffuseColor.rgb, uGRimCol, gF * uGRimK);\n" +
          "#include <alphatest_fragment>");
    };
    m.customProgramCacheKey = function () { return "bxv-glass2"; };
    return m;
  }

  // the config's finish for a material name (cfg.look: [[pattern, finish], ...], first match wins)
  function lookFor(name, look) {
    if (!look) return null;
    for (var i = 0; i < look.length; i++) {
      if (!look[i]._re) look[i]._re = new RegExp(look[i][0], "i");
      if (look[i]._re.test(name)) return look[i][1];
    }
    return null;
  }

  // one material per entry of the pack's list (pack_b2_web.mat_entry: name, color, metal, rough, trans, alpha, emit)
  function matFrom(e, look) {
    var name = (e.name || "");
    var lname = name.toLowerCase();
    if (/hidden/.test(lname)) return null;
    var o = lookFor(name, look) || {};
    if (o.kind === "hide") return null;
    var col = o.color || e.color || "#9a9ea4";
    var m;
    var liquid = o.kind ? o.kind === "liquid" : /liquid|medium|protectant|culture/.test(lname) && !/bottle|glass/.test(lname);
    if (liquid) {
      m = new THREE.MeshPhysicalMaterial({ color: RQ.srgb(col), roughness: o.rough === undefined ? 0.2 : o.rough,
        metalness: 0, transparent: true, opacity: o.op === undefined ? 0.55 : o.op, depthWrite: false,
        envMapIntensity: o.env === undefined ? 0.6 : o.env, side: o.side === "front" ? THREE.FrontSide : THREE.DoubleSide,
        clearcoat: o.coat || 0, clearcoatRoughness: 0.1 });
      if (o.glow) { m.emissive = RQ.srgb(o.glow); m.emissiveIntensity = o.gi === undefined ? 0.1 : o.gi; }
      m.userData.liquid = true;
      return m;
    }
    if (o.kind === "emit") {
      m = new THREE.MeshStandardMaterial({ color: RQ.srgb(o.base || "#0b0c0d"), emissive: RQ.srgb(col),
        emissiveIntensity: o.ei === undefined ? 1 : o.ei, roughness: 0.4, metalness: 0 });
      return m;
    }
    if (o.kind === "frost" || (!o.kind && /frost/.test(lname))) {
      return new THREE.MeshPhysicalMaterial({ color: RQ.srgb(col), roughness: o.rough === undefined ? 0.7 : o.rough,
        transparent: true, opacity: o.op === undefined ? 0.78 : o.op, envMapIntensity: o.env === undefined ? 0.8 : o.env,
        depthWrite: false });
    }
    if (o.kind === "glass" || (!o.kind && ((e.trans || 0) >= 0.5 || (e.alpha !== undefined && e.alpha < 0.9) ||
        /glass|clear|acrylic clear|cuvette/.test(lname)))) {
      return glassMat(col, o);
    }
    m = new THREE.MeshPhysicalMaterial({
      color: RQ.srgb(col),
      metalness: o.metal !== undefined ? o.metal : Math.min(1, e.metal || 0),
      roughness: o.rough !== undefined ? o.rough : Math.max(0.12, e.rough === undefined ? 0.5 : e.rough),
      envMapIntensity: o.env !== undefined ? o.env : 1.0,
      clearcoat: o.coat !== undefined ? o.coat : (e.coat ? Math.min(1, e.coat) : 0.12),
      clearcoatRoughness: o.coatRough !== undefined ? o.coatRough : 0.4,
    });
    if (o.emit) { m.emissive = RQ.srgb(o.emit); m.emissiveIntensity = o.ei === undefined ? 0.5 : o.ei; }
    else if (e.emit && e.estr && !o.color) { m.emissive = RQ.srgb(e.emit); m.emissiveIntensity = Math.min(1, e.estr / 4); }
    return m;
  }

  // The studio the parts reflect: the brochure's warm sweep, a bright top and two long softboxes, painted in sRGB.
  function studio(renderer) {
    var c = document.createElement("canvas"); c.width = 1024; c.height = 512;
    var g = c.getContext("2d");
    var sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0.0, "#e6e1d8"); sky.addColorStop(0.45, "#b9b2a7"); sky.addColorStop(0.5, "#9d978e");
    sky.addColorStop(0.54, "#a8a299"); sky.addColorStop(1.0, "#cfc9bf");
    g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
    function box(x, y, w, h, a, blur) {
      g.save(); g.filter = "blur(" + blur + "px)"; g.globalAlpha = a; g.fillStyle = "#ffffff";
      g.fillRect(x - w / 2, y - h / 2, w, h); g.restore();
    }
    box(250, 130, 330, 120, 1.0, 22);
    box(770, 170, 180, 250, 0.7, 26);
    box(512, 36, 700, 60, 0.6, 30);
    g.save(); g.filter = "blur(36px)"; g.globalAlpha = 0.45; g.fillStyle = "#4d4a45";
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

  // the pack's chunk format v2 (tools/b2web/pack_b2_web.py, decodeChunk2 in the retired b2-core.js)
  function decodeChunk(buf, c) {
    var nv = c.nv, ni = c.ni, n3 = nv * 3, u8 = new Uint8Array(buf), P = c.pos, I = c.idx;
    var pos = new Float32Array(n3), lo = c.lo, sp = c.span, k, i, j, z, q, v;
    for (k = 0; k < 3; k++) {
      q = 0;
      for (i = 0, j = P + k * nv; i < nv; i++, j++) {
        z = u8[j] | (u8[j + n3] << 8);
        q = (q + ((z >>> 1) ^ -(z & 1))) & 0xffff;
        pos[i * 3 + k] = lo[k] + (q / 65535) * sp[k];
      }
    }
    var idx = c.i32 ? new Uint32Array(ni) : new Uint16Array(ni);
    v = 0;
    if (c.i32) {
      for (i = 0, j = I; i < ni; i++, j++) {
        z = (u8[j] | (u8[j + ni] << 8) | (u8[j + 2 * ni] << 16) | (u8[j + 3 * ni] << 24)) >>> 0;
        v = (v + ((z >>> 1) ^ -(z & 1))) | 0; idx[i] = v;
      }
    } else {
      for (i = 0, j = I; i < ni; i++, j++) {
        z = u8[j] | (u8[j + ni] << 8);
        v = (v + ((z >>> 1) ^ -(z & 1))) & 0xffff; idx[i] = v;
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  }

  /* ------------------------------------------------------------------- viewer */
  function Viewer(fig) {
    this.fig = fig;
    this.stage = fig.querySelector(".xv__stage");
    this.range = fig.querySelector(".xv__range");
    this.play = fig.querySelector(".xv__play");
    this.out = fig.querySelector(".xv__sel");
    this.resetBtn = fig.querySelector(".xv__reset");
    this.loopBtns = Array.prototype.slice.call(fig.querySelectorAll("[data-xv-loop]"));
    this.cfgUrl = fig.getAttribute("data-xv");
    this.words = ((this.range && this.range.getAttribute("data-words")) || "assembled|exploded").split("|");
    this.explode = 0; this.target = 0;
    this.selected = null;
    this.loops = {}; this.loopOrder = [];
    this.boost = {}; this.boostTo = {};
    this.dirty = false; this.visible = false;
    var self = this;
    this.ready = new Promise(function (res) { self._resolve = res; });
  }

  Viewer.prototype.fallback = function (why) {
    this.fig.classList.add("xv--still");
    this.loopBtns.forEach(function (b) { b.disabled = true; });
    if (why) console.warn("bio viewer: " + why);
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
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "default" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure || 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer; this.canvas = canvas;

    var scene = new THREE.Scene();
    scene.environment = studio(renderer);
    this.scene = scene;
    var L = cfg.light || {};
    // (a light's colour given in the config is an sRGB hex; the rack's are the first viewer's numbers, kept as they were)
    var hemi = new THREE.HemisphereLight(L.sky ? RQ.srgb(L.sky) : 0xf3efe8, L.ground ? RQ.srgb(L.ground) : 0xbcb3a6, L.hemiI || 0.55);
    var key = new THREE.DirectionalLight(L.keyCol ? RQ.srgb(L.keyCol) : 0xfff2e2, 1.5);
    var rim = new THREE.DirectionalLight(L.rimCol ? RQ.srgb(L.rimCol) : 0xdfe6ee, 0.7);
    var fill = new THREE.DirectionalLight(0xffffff, 0.35);
    scene.add(hemi, key, key.target, rim, fill);
    this.key = key; this.rim = rim; this.fill = fill; this.hemi = hemi;
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = L.bias === undefined ? -0.0006 : L.bias; key.shadow.normalBias = L.normalBias === undefined ? 0.6 : L.normalBias;
    key.shadow.radius = 4;

    // the other parts while one is picked or a loop is lit: a pale, see-through grey that keeps their shape
    this.ghost = new THREE.MeshStandardMaterial({ color: RQ.srgb(0xb9b3aa), roughness: 0.8, metalness: 0,
      transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 0.6 });
    this.litMats = {};

    var root = new THREE.Group();
    var r = cfg.rotation || [0, 0, 0];
    root.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG, cfg.rotationOrder || "XYZ");
    scene.add(root);
    this.root = root;
    // a light inside the machine (model coordinates): the cabinet's own walls shade its inside from the studio
    if (L.inner) {
      var inner = new THREE.PointLight(RQ.srgb(L.inner.col || "#fff1e2"), L.inner.i || 0.4, L.inner.dist || 0, L.inner.decay || 1);
      inner.position.fromArray(L.inner.pos);
      root.add(inner);
      this.inner = inner;
    }

    var camera = new THREE.PerspectiveCamera(cfg.view && cfg.view.fov || 24, 1, 1, 20000);
    this.camera = camera;
    this.yaw0 = (cfg.view && cfg.view.yaw !== undefined ? cfg.view.yaw : 35) * DEG;
    this.pitch0 = (cfg.view && cfg.view.pitch !== undefined ? cfg.view.pitch : 16) * DEG;
    this.yaw = this.yaw0; this.pitch = this.pitch0;

    return this.loadParts().then(function () {
      var sw = self.stage.clientWidth, sh = self.stage.clientHeight;
      if (sw && sh) { self.camera.aspect = sw / sh; self.camera.updateProjectionMatrix(); }
      self.measure();
      self.ground();
      self.ui();
      self.resize();
      self.renderNow();
      self.warm();
    });
  };

  // compile now what a first tap or a lit loop would otherwise compile mid-gesture (the ghost, the outline, a lit
  // part's variant): a few tiny stand-ins carry those materials through one compile, then go
  Viewer.prototype.warm = function () {
    var self = this, g = new THREE.BufferGeometry(), tmp = [];
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    this.outline(null);
    var mats = [this.ghost].concat(this.olMats || []);
    if (this.loopBtns.length) Object.keys(LOOP).forEach(function (k) { mats.push(self.tubeLit(k)); });
    mats.forEach(function (m) { var o = new THREE.Mesh(g, m); o.frustumCulled = false; self.scene.add(o); tmp.push(o); });
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* a compile is only a head start */ }
    tmp.forEach(function (o) { self.scene.remove(o); });
  };

  // ---- the parts: the packed chunks, the tubes from their centrelines, and the few drawn here (the door, a fibre bundle)
  Viewer.prototype.loadParts = function () {
    var self = this, cfg = this.cfg, mesh = cfg.mesh;
    this.parts = []; this.byId = {}; this.pieces = [];
    (cfg.pieces || []).forEach(function (s, i) {
      self.pieces.push({ i: i, k: s.k || "", c: new THREE.Vector3().fromArray(s.c), d: new THREE.Vector3().fromArray(s.d),
        d2: s.d2 ? new THREE.Vector3().fromArray(s.d2) : null, t0: s.t0 || 0, dur: s.dur || 1,
        ax: new THREE.Vector3().fromArray(s.ax || [0, 1, 0]).normalize(), ang: s.ang || 0, groups: [] });
    });
    (cfg.parts || []).forEach(function (p) { self.part(p.id, p); });
    var url = new URL(mesh.bin, this.base).href + (mesh.v ? "?v=" + mesh.v : "");
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(mesh.bin + " " + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      var mats = mesh.mats.map(function (e) { return matFrom(e, cfg.look); });
      mesh.chunks.forEach(function (c) {
        var mat = mats[c.mat];
        if (!mat) return;
        self.addMesh(c.part, decodeChunk(buf, c), mat, { pc: c.pc });
      });
      self.makeTubes();
      (cfg.extras || []).forEach(function (x) { self.extra(x); });
    });
  };

  Viewer.prototype.part = function (id, spec) {
    if (this.byId[id]) return this.byId[id];
    spec = spec || { id: id, name: id };
    var p = { id: id, n: spec.n || 0, name: spec.name || id, role: spec.role || "", loops: spec.loops || [],
      show: spec.show || null, group: new THREE.Group(), meshes: [], picks: [], spec: spec, sub: {} };
    p.group.userData.part = p;
    this.root.add(p.group);
    this.parts.push(p); this.byId[id] = p;
    return p;
  };

  // the group a mesh hangs in: its part's, or the part's own group for one of the case's pieces
  Viewer.prototype.holder = function (part, pc) {
    if (pc === undefined || pc === null || pc < 0 || !this.pieces[pc]) return part.group;
    if (!part.sub[pc]) {
      var g = new THREE.Group();
      part.group.add(g);
      part.sub[pc] = g;
      this.pieces[pc].groups.push(g);
    }
    return part.sub[pc];
  };

  Viewer.prototype.addMesh = function (pid, geo, mat, opt) {
    opt = opt || {};
    var part = this.part(pid);
    var holder = this.holder(part, opt.pc);
    var mesh = new THREE.Mesh(geo, mat);
    var see = mat.transparent;
    var glass = !!mat.userData.glass;
    mesh.castShadow = !see; mesh.receiveShadow = !see;
    mesh.renderOrder = opt.order !== undefined ? opt.order : glass ? 10 : see ? 8 : 0;
    mesh.userData.mat0 = mat; mesh.userData.part = part;
    if (opt.tube) mesh.userData.tube = opt.tube;
    holder.add(mesh);
    part.meshes.push(mesh);
    part.picks.push(mesh);
    // closed glass draws its far side first, then its near side: the order three.js cannot sort inside one mesh
    if (glass && mat.side === THREE.DoubleSide && !opt.single) {
      mat.side = THREE.FrontSide;
      var back = mat.clone();
      back.onBeforeCompile = mat.onBeforeCompile; back.customProgramCacheKey = mat.customProgramCacheKey;
      back.userData = { glass: mat.userData.glass, back: true };
      back.side = THREE.BackSide;
      var tw = new THREE.Mesh(geo, back);
      tw.renderOrder = mesh.renderOrder - 3;
      tw.castShadow = false; tw.receiveShadow = false;
      tw.userData.mat0 = back; tw.userData.part = part; tw.userData.twin = true;
      holder.add(tw);
      part.meshes.push(tw);
    }
    return mesh;
  };

  // Tubes from their centrelines. "flat" (the rack): one translucent tube per loop colour. "glass" (the commercial
  // bioreactor, as its renders): a clear wall with the liquid inside it, amber culture, pale protectant, clear base.
  var TUBE = { cul: ["#d8c48f", 0.82], pro: ["#d9e4dc", 0.72], koh: ["#e3e8ec", 0.62], air: ["#eceeef", 0.6] };
  var TUBE_NAME = { cul: "Culture loop tubing", pro: "Protectant line", koh: "KOH line", air: "Air line" };
  Viewer.prototype.makeTubes = function () {
    var self = this, cfg = this.cfg;
    var style = cfg.tubeLook || null;
    this.tubeMats = {};
    function matFor(key, make) { return self.tubeMats[key] || (self.tubeMats[key] = make()); }
    (cfg.tubes || []).forEach(function (t) {
      var pts = [];
      for (var i = 0; i < t.p.length; i += 3) pts.push(new THREE.Vector3(t.p[i], t.p[i + 1], t.p[i + 2]));
      if (pts.length < 2) return;
      var curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      var segs = Math.max(2, pts.length - 1), R = (t.od || 8) / 2;
      var id = "tubes-" + t.loop;
      var fresh = !self.byId[id];
      var m;
      if (style) {
        var s = style[t.loop] || style.air;
        var wall = matFor("wall", function () { var gm = glassMat(style.wall.color, style.wall); gm.side = THREE.FrontSide; return gm; });
        var gw = new THREE.TubeGeometry(curve, segs, R, 14, false); gw.computeBoundingBox();
        m = self.addMesh(id, gw, wall, { tube: t, single: true, order: 6 });
        m.castShadow = false;
        if (s && s.core) {
          var core = matFor("core:" + t.loop, function () {
            var mm = new THREE.MeshPhysicalMaterial({ color: RQ.srgb(s.core), roughness: s.rough === undefined ? 0.35 : s.rough,
              metalness: 0, envMapIntensity: s.env === undefined ? 0.6 : s.env, transparent: s.op < 1, opacity: s.op,
              depthWrite: s.op >= 1, clearcoat: 0.4, clearcoatRoughness: 0.3 });
            if (s.glow) { mm.emissive = RQ.srgb(s.glow); mm.emissiveIntensity = s.gi || 0.1; }
            mm.userData.liquid = true;
            return mm;
          });
          var gc = new THREE.TubeGeometry(curve, segs, R * (s.r || 0.66), 10, false); gc.computeBoundingBox();
          var mc = self.addMesh(id, gc, core, { tube: t, order: s.op < 1 ? 5 : 0 });
          mc.castShadow = s.op >= 1;
          self.byId[id].picks.pop();                       // the wall is what a tap meets
        }
      } else {
        var geo = new THREE.TubeGeometry(curve, segs, R, 10, false);
        geo.computeBoundingBox();
        var look = TUBE[t.loop] || TUBE.air;
        var mat = matFor(t.loop, function () {
          return new THREE.MeshPhysicalMaterial({ color: RQ.srgb(look[0]), roughness: 0.32,
            metalness: 0, transparent: true, opacity: look[1], envMapIntensity: 1.1, clearcoat: 0.6, clearcoatRoughness: 0.2 });
        });
        m = self.addMesh(id, geo, mat, { tube: t });
        m.castShadow = true;
      }
      if (fresh) {
        var part = self.byId[id];
        part.name = (cfg.tubeNames && cfg.tubeNames[t.loop]) || TUBE_NAME[t.loop] || "Tubing";
        part.role = (cfg.tubeRoles && cfg.tubeRoles[t.loop]) || "";
        part.loops = t.loop === "cul" || t.loop === "pro" ? [t.loop] : [];
        part.tube = true;
      }
    });
  };

  // drawn here: "box" (the door's glass and its frit), "cyl" (the B2's fibre bundle, left out of the pack)
  Viewer.prototype.extra = function (x) {
    var g, mat, opt = { pc: x.pc };
    var look = this.cfg.look;
    if (x.type === "cyl") {
      g = new THREE.CylinderGeometry(x.r, x.r, x.z1 - x.z0, 28, 1, false);
      g.rotateX(Math.PI / 2);
      g.translate(x.c[0], x.c[1], (x.z0 + x.z1) / 2);
      mat = matFrom({ name: x.mat || "fibre bundle", color: x.color || "#e8e4d8", rough: 0.6 }, look);
    } else if (x.type === "box") {
      g = new THREE.BoxGeometry(x.max[0] - x.min[0], x.max[1] - x.min[1], x.max[2] - x.min[2]);
      g.translate((x.min[0] + x.max[0]) / 2, (x.min[1] + x.max[1]) / 2, (x.min[2] + x.max[2]) / 2);
      if (x.glass) {
        mat = this.doorGlass || (this.doorGlass = matFrom({ name: "door glass", color: "#30363c" }, look));
        if (!mat.userData.glass) mat = this.doorGlass = glassMat("#30363c", { face: 0.18, rim: 0.6 });
        opt.order = 14;
      } else {
        mat = this.doorFrit || (this.doorFrit = matFrom({ name: "door frit", color: "#0e0f11", rough: 0.5 }, look));
      }
    } else return;
    g.computeBoundingBox();
    var m = this.addMesh(x.part, g, mat, opt);
    if (x.glass) m.userData.door = true;
  };

  // where things are, for the camera, the ground and the numbers
  Viewer.prototype.measure = function () {
    var self = this;
    this.parts.forEach(function (part) {
      var p = part.spec;
      var box = new THREE.Box3();
      part.meshes.forEach(function (m) { box.union(m.geometry.boundingBox); });
      part.box = box;
      part.anchorObj = part.group;
      part.anchor = p.anchor ? new THREE.Vector3().fromArray(p.anchor) : box.getCenter(new THREE.Vector3());
    });
    this.boxA = this.boundsAt(0);
    this.boxE = this.boundsAt(1);
    this.fits();
    this.pose(this.explode);
  };

  Viewer.prototype.boundsAt = function (e) {
    var self = this;
    this.pose(e);
    this.root.updateMatrixWorld(true);
    var b = new THREE.Box3();
    this.parts.forEach(function (part) {
      part.meshes.forEach(function (m) { b.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); });
    });
    return b;
  };

  // every mesh's box corners in world space at slider position e (what the camera must keep in frame)
  Viewer.prototype.cornersAt = function (e) {
    this.pose(e);
    this.root.updateMatrixWorld(true);
    var out = [], q = new THREE.Vector3();
    this.parts.forEach(function (part) {
      part.meshes.forEach(function (m) {
        if (m.userData.twin) return;
        var bb = m.geometry.boundingBox;
        for (var k = 0; k < 8; k++) {
          q.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld);
          out.push(q.x, q.y, q.z);
        }
      });
    });
    return out;
  };

  function camBasis(yaw, pitch) {
    var back = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    var right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    var up = back.clone().cross(right).normalize();
    return { back: back, right: right, up: up };
  }

  // The tight framing for a set of points seen from (yaw, pitch): the camera that keeps every point inside the stage
  // less its margins (top, bottom, sides: cfg.frame, fractions of the stage), as close as it can be. For a fixed
  // orientation each edge of the frame is a plane through the camera, and "the point is inside" is linear in the
  // camera's position: with f the view direction and n = right - xr*th*f (the right edge; likewise the others), a
  // point p is inside when dot(p, n) <= dot(E, n). So the nearest camera E follows from the four maxima directly:
  // its depth from the tighter pair, its sideways and up position centred in the slack of the looser one.
  // Returned as the aim P (E moved forward to the depth of the points' middle) and the distance D back to E.
  Viewer.prototype.fitPts = function (pts, yaw, pitch) {
    var B = camBasis(yaw, pitch), fr = this.cfg.frame || {};
    var cam = this.camera, tv = Math.tan(cam.fov * DEG / 2), th = tv * cam.aspect;
    var m = fr.margin === undefined ? 0.07 : fr.margin;
    var mt = fr.top === undefined ? m : fr.top, mb = fr.bottom === undefined ? m : fr.bottom;
    var ms = fr.side === undefined ? (fr.marginX === undefined ? m : fr.marginX) : fr.side;
    var xr = 1 - 2 * ms, xl = -xr, yt = 1 - 2 * mt, yb = -1 + 2 * mb;      // the window, in the frame's -1..1
    var f = B.back.clone().negate(), R = B.right, U = B.up;
    var nR = R.clone().addScaledVector(f, -xr * th), nL = R.clone().negate().addScaledVector(f, xl * th);
    var nT = U.clone().addScaledVector(f, -yt * tv), nB = U.clone().negate().addScaledVector(f, yb * tv);
    var M = [-1e18, -1e18, -1e18, -1e18], ns = [nR, nL, nT, nB], n = pts.length / 3, i, k, px, py, pz;
    var lo = [1e18, 1e18, 1e18], hi = [-1e18, -1e18, -1e18];
    for (i = 0; i < n; i++) {
      px = pts[i * 3]; py = pts[i * 3 + 1]; pz = pts[i * 3 + 2];
      for (k = 0; k < 4; k++) { var d = px * ns[k].x + py * ns[k].y + pz * ns[k].z; if (d > M[k]) M[k] = d; }
      if (px < lo[0]) lo[0] = px; if (px > hi[0]) hi[0] = px; if (py < lo[1]) lo[1] = py; if (py > hi[1]) hi[1] = py;
      if (pz < lo[2]) lo[2] = pz; if (pz > hi[2]) hi[2] = pz;
    }
    // E = s R + t U + w f: dot(E, nR) = s - xr th w >= M0; dot(E, nL) = -s + xl th w >= M1; likewise t with yt, yb
    var wx = -(M[0] + M[1]) / ((xr - xl) * th), wy = -(M[2] + M[3]) / ((yt - yb) * tv), w = Math.min(wx, wy);
    var sLo = M[0] + xr * th * w, sHi = -M[1] + xl * th * w, tLo = M[2] + yt * tv * w, tHi = -M[3] + yb * tv * w;
    var s0 = (sLo + sHi) / 2, t0 = (tLo + tHi) / 2;
    var E = R.clone().multiplyScalar(s0).addScaledVector(U, t0).addScaledVector(f, w);
    var C = new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
    var D = Math.max(1, C.clone().sub(E).dot(f));
    return { P: E.clone().addScaledVector(f, D), D: D };
  };

  // The framing tables: assembled (A) and exploded (E) at every 15 degrees of turn, and how fast the framing must ease
  // out with the slider so that no piece ever leaves the frame on the way (w(e) = smootherstep(e / eFull), with eFull
  // the earliest that covers the case's own pace).
  Viewer.prototype.fits = function () {
    var self = this, N = 24;
    this.fitN = N;
    var cA = this.cornersAt(0), cE = this.cornersAt(1);
    this.fitA = []; this.fitE = [];
    for (var i = 0; i < N; i++) {
      var yaw = this.yaw0 + i * 2 * Math.PI / N;
      this.fitA.push(this.fitPts(cA, yaw, this.pitch0));
      this.fitE.push(this.fitPts(cE, yaw, this.pitch0));
    }
    this.eFull = 1;
    var A0 = this.fitA[0], E0 = this.fitE[0];
    if (this.pieces.length && Math.abs(E0.D - A0.D) > 1) {
      var need = [];
      for (var s = 1; s < 20; s++) {
        var e = s / 20, f = this.fitPts(this.cornersAt(e), this.yaw0, this.pitch0);
        need.push([e, clamp((f.D - A0.D) / (E0.D - A0.D), 0, 1)]);
      }
      var lo = 0.2, hi = 1;
      for (var it = 0; it < 24; it++) {
        var mid = (lo + hi) / 2, ok = need.every(function (q) { return smoother(q[0] / mid) >= q[1] - 0.005; });
        if (ok) lo = mid; else hi = mid;
      }
      this.eFull = clamp(lo, 0.25, 1);
    }
    this.pose(this.explode);
    void self;
  };

  Viewer.prototype.fitAt = function (yaw, list) {
    var N = this.fitN, u = ((yaw - this.yaw0) / (2 * Math.PI) * N % N + N) % N;
    var i0 = Math.floor(u), k = u - i0, a = list[i0], b = list[(i0 + 1) % N];
    return { P: a.P.clone().lerp(b.P, k), D: a.D + (b.D - a.D) * k };
  };

  // slider amount e in [0,1] -> every piece's move: out along its line (eased in and out: it comes away, then hangs),
  // a slight lean about its own middle. A piece with a second leg (the door) first comes straight out, then slides
  // aside, the two legs overlapping a little so it never stops on the way.
  var _q = null, _v = null;
  Viewer.prototype.pose = function (e) {
    if (!_q) { _q = new THREE.Quaternion(); _v = new THREE.Vector3(); }
    for (var i = 0; i < this.pieces.length; i++) {
      var pc = this.pieces[i];
      var u = clamp((e - pc.t0) / pc.dur, 0, 1), t = smoother(u);
      var s1 = pc.d2 ? smoother(u / 0.45) : t, s2 = pc.d2 ? smoother((u - 0.3) / 0.7) : 0;
      pc.t = t;
      _q.setFromAxisAngle(pc.ax, pc.ang * t);
      _v.copy(pc.c).applyQuaternion(_q);
      for (var j = 0; j < pc.groups.length; j++) {
        var g = pc.groups[j];
        g.quaternion.copy(_q);
        g.position.copy(pc.c).addScaledVector(pc.d, s1).sub(_v);
        if (pc.d2) g.position.addScaledVector(pc.d2, s2);
      }
    }
  };

  Viewer.prototype.ground = function () {
    var b = this.boxA.clone().union(this.boxE), size = b.getSize(new THREE.Vector3());
    var R = Math.max(size.x, size.z, size.y) * 4;
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(R, R),
      new THREE.ShadowMaterial({ color: 0x2a241d, opacity: (this.cfg.shadow || 0.16) }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set((b.min.x + b.max.x) / 2, this.boxA.min.y - 0.05, (b.min.z + b.max.z) / 2);
    plane.receiveShadow = true;
    plane.renderOrder = -1;
    this.scene.add(plane);
    this.plane = plane;
    var c = b.getCenter(new THREE.Vector3()), r = size.length() * 0.55;
    var L = this.cfg.light || {};
    var kd = new THREE.Vector3().fromArray(L.key || [0.55, 1.0, 0.75]).normalize();
    this.key.position.copy(c).addScaledVector(kd, r * 3);
    this.key.target.position.copy(c);
    var sc = this.key.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = r * 0.5; sc.far = r * 6;
    sc.updateProjectionMatrix();
    this.rim.position.copy(c).add(new THREE.Vector3().fromArray(L.rim || [-0.8, 0.5, -0.7]).normalize().multiplyScalar(r * 3));
    this.fill.position.copy(c).add(new THREE.Vector3().fromArray(L.fill || [-0.6, 0.2, 0.9]).normalize().multiplyScalar(r * 3));
    this.key.intensity = L.keyI || 1.5; this.rim.intensity = L.rimI || 0.7; this.fill.intensity = L.fillI || 0.35;
    this.sceneR = size.length() / 2;
  };

  // how far the framing has eased out at slider position e
  Viewer.prototype.camW = function (e) { return REDUCED ? clamp(e, 0, 1) : smoother(e / this.eFull); };

  Viewer.prototype.placeCamera = function () {
    var w = this.camW(this.explode);
    var A = this.fitAt(this.yaw, this.fitA), E = this.fitAt(this.yaw, this.fitE), fr = this.cfg.frame || {};
    var c = A.P.lerp(E.P, w), dist = A.D + (E.D - A.D) * w;
    var cam = this.camera, tv = Math.tan(cam.fov * DEG / 2), th = tv * cam.aspect;
    var f = this.focusPart ? (REDUCED ? 1 : easeInOut(this.focus || 0)) : 0;
    if (f > 0) {
      var pb = this.focusBox, pc = pb.getCenter(new THREE.Vector3());
      var pr = Math.max(pb.getSize(new THREE.Vector3()).length() / 2, 20);
      var pd = clamp(pr / Math.min(tv, th) * 2.6, dist / (fr.zoom || 2.6), dist);
      c.lerp(pc, f * (fr.follow === undefined ? 0.8 : fr.follow));
      dist = dist + (pd - dist) * f;
    }
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    cam.position.set(c.x + dist * cp * Math.sin(this.yaw), c.y + dist * sp, c.z + dist * cp * Math.cos(this.yaw));
    var reach = (this.sceneR || 1000) * 1.6;
    cam.near = Math.max(1, dist - reach); cam.far = dist + reach * 1.5;
    cam.updateProjectionMatrix();
    cam.lookAt(c);
    if (this.olPxH) this.olPxH.value = 2 * tv / Math.max(1, this.h || 1);
  };

  Viewer.prototype.resize = function () {
    var w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    if (w === this.w && h === this.h) return;
    var aspect0 = this.camera.aspect;
    this.w = w; this.h = h;
    // never under 1.5 device pixels a CSS pixel: thin tubes and edges stay crisp on a 1x screen (drawn only on change)
    this.renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1.5, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (Math.abs(aspect0 - this.camera.aspect) > 0.002) this.fits();
    this.fitOut();
    this.request();
  };

  Viewer.prototype.request = function () {
    var self = this;
    this.dirty = true;
    if (this.raf || !this.visible) return;
    this.raf = requestAnimationFrame(function () { self.raf = 0; self.frame(); });
  };

  Viewer.prototype.frame = function () {
    var moving = false, self = this;
    if (this.explode !== this.target) {
      if (REDUCED) this.explode = this.target;
      else if (this.tween) {
        var k = clamp((performance.now() - this.tween.t0) / this.tween.ms, 0, 1);
        this.explode = this.tween.from + (this.tween.to - this.tween.from) * smooth(k);
        if (k >= 1) { this.explode = this.target = this.tween.to; this.tween = null; }
      } else {
        var d = this.target - this.explode;
        this.explode = Math.abs(d) < 0.002 ? this.target : this.explode + d * 0.2;
      }
      moving = this.explode !== this.target;
    }
    Object.keys(this.boostTo).forEach(function (k) {
      var b = self.boost[k] || 0, to = self.boostTo[k];
      if (b === to) return;
      var db = to - b;
      self.boost[k] = REDUCED || Math.abs(db) < 0.02 ? to : b + db * 0.2;
      moving = moving || self.boost[k] !== to;
    });
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
    this.discLayer = layer;
    this.numbered = this.parts.filter(function (p) { return p.n; }).sort(function (a, b) { return a.n - b.n; });
    this.numbered.forEach(function (part) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "xv__num xv__num--" + (part.show || part.spec.kind || "printed");
      b.textContent = part.n;
      b.setAttribute("aria-label", part.n + ": " + part.name);
      b.setAttribute("aria-pressed", "false");
      b.tabIndex = -1;
      b.addEventListener("click", function (ev) { ev.stopPropagation(); self.select(self.selected === part ? null : part); });
      layer.appendChild(b);
      part.disc = b;
      var ln = document.createElementNS(svgNS, "line"); lines.appendChild(ln); part.leader = ln;
      var dot = document.createElementNS(svgNS, "circle"); dot.setAttribute("r", "2.2"); lines.appendChild(dot); part.dot = dot;
    });
    this.stage.appendChild(layer);

    if (this.range) {
      this.range.disabled = false;
      this.range.addEventListener("input", function () {
        self.tween = null;
        self.target = clamp(+self.range.value / +(self.range.max || 100), 0, 1);
        self.syncRange(); self.syncControls(self.target); self.hideHint(); self.request();
      });
      this.syncRange();
    }
    if (this.play) {
      this.play.disabled = false;
      if (!this.play.getAttribute("data-open")) this.play.setAttribute("data-open", this.play.getAttribute("aria-label") || "Take it apart");
      this.play.addEventListener("click", function () {
        var to = self.target > 0.5 ? 0 : 1;
        self.tween = { from: self.explode, to: to, t0: performance.now(), ms: (self.cfg.playMs || 2400) * Math.abs(to - self.explode) + 200 };
        self.target = to;
        if (self.range) { self.range.value = Math.round(to * (+self.range.max || 100)); self.syncRange(); }
        self.hideHint(); self.syncControls(to); self.request();
      });
    }
    this.loopBtns.forEach(function (b) {
      b.disabled = false;
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-xv-loop");
        self.light(k, !self.loops[k]);
        self.hideHint();
      });
    });
    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", function () {
        self.spin = 0;
        var y0 = self.yaw, p0 = self.pitch, t0 = performance.now();
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

  Viewer.prototype.syncRange = function () {
    if (!this.range) return;
    var v = +this.range.value, max = +(this.range.max || 100), k = v / max;
    this.range.style.setProperty("--pct", (k * 100).toFixed(1) + "%");
    this.range.setAttribute("aria-valuetext", k <= 0 ? this.words[0] : k >= 1 ? this.words[1] : this.words[1] + " " + Math.round(k * 100) + " percent");
  };
  Viewer.prototype.syncControls = function (to) {
    if (!this.play) return;
    var open = to > 0.5;
    this.play.setAttribute("aria-label", open ? (this.play.getAttribute("data-close") || this.cfg.playClose || "Put it back together") : this.play.getAttribute("data-open"));
    this.play.classList.toggle("is-open", open);
  };
  Viewer.prototype.hideHint = function () {
    if (!this.hinted) { this.hinted = true; this.fig.classList.add("xv--used"); }
  };

  // How much of each number shows: on the slider's model, one after another as the case comes off; on the rack, the
  // numbers of the loop that is lit (culture 1-8, protectant 9-10).
  Viewer.prototype.discAlpha = function (part) {
    if (this.forceDiscs) return 1;
    if (part.show) return this.boost[part.show] || 0;
    var from = this.cfg.discFrom === undefined ? 0.5 : this.cfg.discFrom, step = this.cfg.discStep === undefined ? 0.025 : this.cfg.discStep;
    return smooth((this.explode - from - step * (part.n - 1)) / 0.16);
  };

  Viewer.prototype.layoutDiscs = function () {
    if (!this.discLayer || !this.numbered.length) return;
    var self = this, w = this.w, h = this.h, cam = this.camera;
    var shown = [], any = 0;
    this.numbered.forEach(function (p) {
      var a = self.discAlpha(p);
      p.alpha = a;
      if (a > 0.02) shown.push(p);
      any = Math.max(any, a);
      var on = a > 0.5;
      if (on !== p.discOn) { p.discOn = on; p.disc.tabIndex = on ? 0 : -1; p.disc.classList.toggle("is-on", on); }
    });
    var on = shown.length > 0;
    if (on !== this.discsOn) {
      this.discsOn = on;
      this.discLayer.classList.toggle("is-on", on);
    }
    this.numbered.forEach(function (p) {
      if (p.alpha <= 0.02) { p.disc.style.visibility = "hidden"; p.leader.style.display = "none"; p.dot.style.display = "none"; }
    });
    if (!on) { this.layout = []; return; }
    var R = this.discR || (w < 460 ? 11.5 : 13), gap = 4, pad = R + 3;
    if (R !== this.discLayerR) { this.discLayerR = R; this.discLayer.style.setProperty("--xv-r", R + "px"); }
    var v = new THREE.Vector3(), pts = [];
    this.root.updateMatrixWorld(true);
    function toScreen(vec, obj) {
      v.copy(vec); obj.localToWorld(v); v.project(cam);
      return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
    }
    var mx = 0, my = 0;
    shown.forEach(function (part) {
      var a = toScreen(part.anchor, part.anchorObj);
      var b = part.box, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (var k = 0; k < 8; k++) {
        var c = toScreen(new THREE.Vector3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z), part.anchorObj);
        x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
      }
      pts.push({ part: part, ax: a[0], ay: a[1], pw: x1 - x0, ph: y1 - y0 });
      mx += a[0]; my += a[1];
    });
    mx /= pts.length; my /= pts.length;
    var scale = Math.min(1, w / 520);
    pts.forEach(function (p) {
      var dir = p.part.spec.callout;
      var dx = dir ? dir[0] : p.ax - mx, dy = dir ? dir[1] : p.ay - my, d = Math.hypot(dx, dy);
      if (d < 1) { dx = 1; dy = 0; d = 1; }
      var reach = dir && dir[2] !== undefined ? dir[2] * scale + R : Math.min(Math.max(p.pw, p.ph) * 0.35, 60) + R + 14;
      p.x = p.ax + dx / d * reach; p.y = p.ay + dy / d * reach;
    });
    var minD = 2 * R + gap;
    for (var it = 0; it < 40; it++) {
      var moved = false;
      for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          var a = pts[i], b = pts[j];
          var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d < minD) {
            if (d < 0.01) { dx = 1; dy = 0; d = 1; }
            var push = (minD - d) / 2;
            a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push;
            moved = true;
          }
        }
      }
      pts.forEach(function (p) { p.x = clamp(p.x, pad, w - pad); p.y = clamp(p.y, pad, h - pad); });
      if (!moved) break;
    }
    // with a part picked the other numbers step back (and go, while the camera has closed in on it)
    var sel = this.selected, foc = sel && this.focusPart === sel ? (REDUCED ? 1 : easeInOut(this.focus || 0)) : 0;
    this.layout = pts.map(function (p) {
      var off = Math.hypot(p.x - p.ax, p.y - p.ay), al = p.part.alpha;
      if (sel && p.part !== sel) al *= 0.55 * (1 - foc);
      var disc = p.part.disc;
      disc.style.visibility = "";
      disc.style.opacity = al.toFixed(3);
      disc.style.transform = "translate(" + (p.x - R).toFixed(1) + "px," + (p.y - R).toFixed(1) + "px) scale(" + (0.7 + 0.3 * al).toFixed(3) + ")";
      var ln = p.part.leader, lead = off > R * 0.9;
      if (lead) {
        var ux = (p.ax - p.x) / off, uy = (p.ay - p.y) / off;
        ln.setAttribute("x1", (p.x + ux * R).toFixed(1)); ln.setAttribute("y1", (p.y + uy * R).toFixed(1));
        ln.setAttribute("x2", p.ax.toFixed(1)); ln.setAttribute("y2", p.ay.toFixed(1));
        ln.style.display = ""; ln.style.opacity = al.toFixed(3);
        p.part.dot.setAttribute("cx", p.ax.toFixed(1)); p.part.dot.setAttribute("cy", p.ay.toFixed(1));
        p.part.dot.style.display = ""; p.part.dot.style.opacity = al.toFixed(3);
      } else { ln.style.display = "none"; p.part.dot.style.display = "none"; }
      return { n: p.part.n, x: p.x, y: p.y, ax: p.ax, ay: p.ay, leader: lead, a: al };
    });
  };

  /* ------------------------------------------------- materials as they are shown */
  // a part's look follows, in order: the part picked (others ghost), the loops lit (theirs glow, others ghost), plain
  Viewer.prototype.litMat = function (base, loop) {
    var key = loop + ":" + base.uuid;
    if (this.litMats[key]) return this.litMats[key];
    var col = LOOP[loop];
    var m;
    if (base.userData.glass || base.userData.liquid) {
      m = new THREE.MeshPhysicalMaterial({ color: RQ.srgb(col), emissive: RQ.srgb(col), emissiveIntensity: 0.35,
        roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
    } else {
      m = base.clone();
      m.emissive = RQ.srgb(col); m.emissiveIntensity = 0.42;
      if (m.color) m.color.lerp(RQ.srgb(col), 0.35);
    }
    this.litMats[key] = m;
    return m;
  };
  Viewer.prototype.tubeLit = function (loop) {
    var key = "tube:" + loop;
    if (!this.litMats[key]) {
      this.litMats[key] = new THREE.MeshPhysicalMaterial({ color: RQ.srgb(LOOP[loop]), emissive: RQ.srgb(LOOP[loop]),
        emissiveIntensity: 0.55, roughness: 0.3, metalness: 0, clearcoat: 0.6 });
    }
    return this.litMats[key];
  };
  Viewer.prototype.restyle = function () {
    var self = this, sel = this.selected;
    var lit = Object.keys(this.loops).filter(function (k) { return self.loops[k]; });
    var last = this.lastLoop;
    this.parts.forEach(function (part) {
      var loop = null;
      if (!sel && lit.length) {
        var mine = part.loops.filter(function (l) { return lit.indexOf(l) >= 0; });
        loop = mine.length ? (mine.indexOf(last) >= 0 ? last : mine[0]) : "";
      }
      part.meshes.forEach(function (m) {
        var mat = m.userData.mat0;
        var plain = true;
        if (sel) { plain = part === sel; if (!plain) mat = self.ghost; }
        else if (loop === "") { plain = false; mat = self.ghost; }
        else if (loop) { plain = false; mat = part.tube ? self.tubeLit(loop) : self.litMat(m.userData.mat0, loop); }
        // a glass's far side, a ghost's or a lit part's twin, is not drawn twice
        if (m.userData.twin) { m.visible = plain; return; }
        m.material = mat;
        m.castShadow = mat === m.userData.mat0 ? !mat.transparent || (mat.userData.liquid && mat.depthWrite) : false;
      });
    });
  };

  // The part picked is drawn with a thin rim in the accent (an inverted hull: its own back faces pushed out along
  // the normals by a fixed number of screen pixels), so a white or clear part reads against the pale ghosts as
  // clearly as a dark one. A clear part's hull shows through it: drawn faint, it tints the part instead.
  var OUTLINE_VS = "uniform float uW, uPxH;\n" +
    "void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal);\n" +
    "  mv.xyz += n * uW * uPxH * max(-mv.z, 1.0); gl_Position = projectionMatrix * mv; }";
  var OUTLINE_FS = "uniform vec3 uCol; uniform float uA; void main() { gl_FragColor = vec4(uCol, uA); }";
  Viewer.prototype.outline = function (part) {
    var self = this;
    if (!this.olMats) {
      this.olPxH = { value: 0.001 };
      var mk = function (a) {
        return new THREE.ShaderMaterial({ uniforms: { uW: { value: 1.6 }, uPxH: self.olPxH, uCol: { value: RQ.srgb("#23684a") },
          uA: { value: a } }, vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, side: THREE.BackSide, transparent: true,
          depthWrite: false });
      };
      this.olMats = [mk(0.92), mk(0.16)];
    }
    (this.olOn || []).forEach(function (m) { m.visible = false; });
    this.olOn = [];
    if (!part || part.tube) return;
    part.meshes.forEach(function (m) {
      if (m.userData.twin || !m.geometry.attributes.normal) return;
      if (!m.userData.ol) {
        var see = m.userData.mat0.transparent;
        var o = new THREE.Mesh(m.geometry, self.olMats[see ? 1 : 0]);
        o.renderOrder = see ? 7 : 1; o.castShadow = false; o.receiveShadow = false; o.raycast = function () {};
        m.parent.add(o); m.userData.ol = o;
      }
      m.userData.ol.visible = true;
      self.olOn.push(m.userData.ol);
    });
  };

  Viewer.prototype.light = function (loop, on) {
    this.loops[loop] = !!on;
    var i = this.loopOrder.indexOf(loop);
    if (i >= 0) this.loopOrder.splice(i, 1);
    if (on) { this.loopOrder.push(loop); this.lastLoop = loop; }
    this.loopBtns.forEach(function (b) {
      if (b.getAttribute("data-xv-loop") === loop) b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var any = false, self = this;
    Object.keys(this.loops).forEach(function (k) { any = any || self.loops[k]; });
    this.fig.classList.toggle("xv--lit", any);
    if (this.selected) this.select(null, true);
    // the numbers of a loop ride with it
    this.boostTo[loop] = on ? 1 : 0;
    if (this.boost[loop] === undefined) this.boost[loop] = 0;
    this.restyle();
    this.say();
    this.request();
  };

  /* ---------------------------------------------------------------- select */
  Viewer.prototype.select = function (part, quiet) {
    this.selected = part || null;
    this.numbered.forEach(function (p) {
      p.disc.classList.toggle("is-sel", p === part);
      p.disc.setAttribute("aria-pressed", p === part ? "true" : "false");
      p.leader.classList.toggle("is-sel", p === part);
      p.dot.classList.toggle("is-sel", p === part);
    });
    this.fig.classList.toggle("xv--sel", !!part);
    if (part) {
      this.root.updateMatrixWorld(true);
      var box = new THREE.Box3();
      part.meshes.forEach(function (m) { box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); });
      this.focusBox = box;
      this.focusPart = part;
    }
    var to = part && this.cfg.focus !== false && !part.tube && !(part.spec && part.spec.noFocus) ? 1 : 0;
    if (to === 0 && !this.focusPart) this.focus = 0;
    if (REDUCED) { this.focus = to; if (!to) this.focusPart = null; }
    else this.focusTween = { from: this.focus || 0, to: to, t0: performance.now() };
    this.fig.classList.toggle("xv--focus", !!to);
    this.outline(part || null);
    this.restyle();
    if (!quiet) this.say();
    this.request();
  };

  // the bar under the model: the part picked (number, name, role), else the path of the loop lit last, else the hint
  Viewer.prototype.msgFor = function (part) {
    return "<b>" + esc((part.n ? part.n + " · " : "") + part.name) + "</b>" + (part.role ? " " + esc(part.role) : "");
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  Viewer.prototype.say = function () {
    if (!this.out) return;
    var part = this.selected;
    if (part) {
      this.out.innerHTML = this.msgFor(part);
      this.out.classList.add("is-part");
      this.out.classList.remove("is-loop");
    } else {
      var k = this.loopOrder.length ? this.loopOrder[this.loopOrder.length - 1] : null;
      var msg = k && this.cfg.loopSay ? this.cfg.loopSay[k] : "";
      if (msg) this.out.innerHTML = msg;                                // the config's own text (it may italicise)
      else this.out.textContent = this.out.getAttribute("data-idle") || "";
      this.out.classList.remove("is-part");
      this.out.classList.toggle("is-loop", !!msg);
      if (k) this.out.setAttribute("data-loop", k); else this.out.removeAttribute("data-loop");
    }
  };
  // The bar keeps the height of its longest message at this width, so lighting a loop or picking a part never moves
  // the page under it.
  Viewer.prototype.fitOut = function () {
    if (!this.out || !this.out.offsetWidth) return;
    var self = this, probe = this.out.cloneNode(false);
    probe.removeAttribute("id"); probe.removeAttribute("aria-live");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;min-height:0;width:" + this.out.offsetWidth + "px";
    probe.className = this.out.className.replace(/\bis-\w+/g, "");
    this.out.parentNode.appendChild(probe);
    var msgs = [esc(this.out.getAttribute("data-idle") || "")];
    Object.keys(this.cfg.loopSay || {}).forEach(function (k) { msgs.push(self.cfg.loopSay[k]); });
    this.parts.forEach(function (p) { msgs.push(self.msgFor(p)); });
    var hMax = 0;
    msgs.forEach(function (m) { probe.innerHTML = m; hMax = Math.max(hMax, probe.offsetHeight); });
    probe.parentNode.removeChild(probe);
    if (hMax) this.out.style.minHeight = hMax + "px";
  };

  /* ------------------------------------------------------------------ drag */
  Viewer.prototype.drag = function () {
    var self = this, el = this.stage;
    var id = null, y0 = 0, lastX = 0, lastT = 0, moved = 0, type = "mouse";
    el.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest(".xv__num, .xv__reset, button, a")) return;
      id = e.pointerId; type = e.pointerType;
      lastX = e.clientX; y0 = e.clientY; lastT = performance.now(); moved = 0;
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
      if (type !== "touch") {
        self.pitch = clamp(self.pitch + dy * 0.006, 2 * DEG, 52 * DEG);
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
    el.addEventListener("keydown", function (e) {
      if (e.target !== el) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        self.yaw += (e.key === "ArrowLeft" ? 1 : -1) * 15 * DEG; self.fig.classList.add("xv--turned");
        self.request(); e.preventDefault();
      } else if (e.key === "Escape" && self.selected) { self.select(null); }
    });
    this.fig.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && self.selected) self.select(null);
    });
  };

  // A tap on the model names the part under it; a tap on empty space lets go. Ghosts are seen through. The door's
  // glass names the door while the case is on; once it is coming off, a tap goes through it to what is behind.
  Viewer.prototype.pick = function (e) {
    var r = this.stage.getBoundingClientRect();
    var ndc = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    var ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    var meshes = [], self = this;
    this.parts.forEach(function (p) {
      if (self.cfg.pickSkip && self.cfg.pickSkip.indexOf(p.id) >= 0) return;
      p.picks.forEach(function (m) { meshes.push(m); });
    });
    var hits = ray.intersectObjects(meshes, false);
    var hit = null, door = null;
    for (var i = 0; i < hits.length; i++) {
      var m = hits[i].object;
      if (m.material === this.ghost) continue;
      if (m.userData.door && this.explode > 0.25) { door = door || hits[i]; continue; }
      hit = hits[i]; break;
    }
    hit = hit || door;
    var minE = this.cfg.pickFrom || 0;
    if (hit && this.explode >= minE) {
      var part = hit.object.userData.part;
      this.select(this.selected === part ? null : part);
    } else if (this.selected) this.select(null);
  };

  /* -------------------------------------------------------------------- set */
  Viewer.prototype.set = function (o) {
    o = o || {};
    var self = this;
    if (o.explode !== undefined) {
      this.explode = this.target = o.explode; this.tween = null;
      if (this.range) { this.range.value = Math.round(o.explode * (+this.range.max || 100)); this.syncRange(); this.syncControls(o.explode); }
    }
    if (o.yaw !== undefined) this.yaw = o.yaw * DEG;
    if (o.pitch !== undefined) this.pitch = o.pitch * DEG;
    if (o.loops) Object.keys(o.loops).forEach(function (k) { self.light(k, o.loops[k]); self.boost[k] = self.boostTo[k]; });
    if (o.select !== undefined) this.select(o.select ? this.byId[o.select] || null : null);
    if (o.focus !== undefined) { this.focus = o.focus; this.focusTween = null; if (!o.focus && !this.selected) this.focusPart = null; }
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

  function start() {
    var figs = document.querySelectorAll("figure.xv[data-xv]");
    if (!figs.length) return;
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target.__xv;
        if (v && en.isIntersecting) v.boot();
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
        // the bar's height follows its own width too (the stage may keep its size while the column changes)
        if ("ResizeObserver" in window && v.out) {
          var ow = 0;
          new ResizeObserver(function () { var w = v.out.offsetWidth; if (w && w !== ow) { ow = w; v.fitOut(); } }).observe(v.out);
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { v.fitOut(); });
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
