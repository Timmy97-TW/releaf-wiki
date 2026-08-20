// Shared rendering quality: shading, lighting, shadows, surface finish.
//
// The instrument scenes were all built the same way — STL in, face normals,
// a painted 512x256 environment, no shadows. That reads as "CAD viewport"
// rather than "photograph of a printed part". This module holds the four
// fixes so all three pages get them from one place.
//
// Loaded after three.min.js and before each page's scene.js.
window.RQ = (function () {
  "use strict";

  // ---------------------------------------------------------------- shading
  // STL stores every triangle with its own three corners, so nothing is
  // shared and computeVertexNormals() can only hand each face a single flat
  // normal — every curve renders as flat panels. Welding coincident vertices
  // lets a normal average across a surface, but welding blindly would round
  // off real edges too, so two corners only contribute to each other when
  // their face normals agree within `angle`.
  function smoothNormals(geo, angle) {
    const pos = geo.attributes.position;
    if (!pos || geo.index) { geo.computeVertexNormals(); return geo; }
    const p = pos.array;
    const tris = p.length / 9;
    if (tris < 1) { geo.computeVertexNormals(); return geo; }
    const cosLimit = Math.cos((angle === undefined ? 38 : angle) * Math.PI / 180);

    const fn = new Float32Array(tris * 3);
    for (let i = 0; i < tris; i++) {
      const o = i * 9;
      const ax = p[o + 3] - p[o],     ay = p[o + 4] - p[o + 1], az = p[o + 5] - p[o + 2];
      const bx = p[o + 6] - p[o],     by = p[o + 7] - p[o + 1], bz = p[o + 8] - p[o + 2];
      let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx;
      const l = Math.hypot(x, y, z) || 1;
      fn[i * 3] = x / l; fn[i * 3 + 1] = y / l; fn[i * 3 + 2] = z / l;
    }

    // bucket corners by quantised position; 1e4 is well under STL's float
    // precision so coincident corners land together without welding distinct
    // features that merely sit close
    const buckets = new Map();
    for (let v = 0; v < tris * 3; v++) {
      const k = Math.round(p[v * 3] * 1e4) + "," +
                Math.round(p[v * 3 + 1] * 1e4) + "," +
                Math.round(p[v * 3 + 2] * 1e4);
      const b = buckets.get(k);
      if (b) b.push(v); else buckets.set(k, [v]);
    }

    const out = new Float32Array(tris * 9);
    buckets.forEach(function (verts) {
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i], f = (v / 3) | 0;
        let x = 0, y = 0, z = 0;
        for (let j = 0; j < verts.length; j++) {
          const g = (verts[j] / 3) | 0;
          const d = fn[f * 3] * fn[g * 3] + fn[f * 3 + 1] * fn[g * 3 + 1] +
                    fn[f * 3 + 2] * fn[g * 3 + 2];
          if (d >= cosLimit) { x += fn[g * 3]; y += fn[g * 3 + 1]; z += fn[g * 3 + 2]; }
        }
        const l = Math.hypot(x, y, z) || 1;
        out[v * 3] = x / l; out[v * 3 + 1] = y / l; out[v * 3 + 2] = z / l;
      }
    });
    geo.setAttribute("normal", new THREE.BufferAttribute(out, 3));
    return geo;
  }

  // ------------------------------------------------------------ environment
  // The old environment was three blurred blobs. Reflections need structure
  // to read as a room: rectangular softboxes give the long, straight
  // highlights that say "studio" on a curved surface, and a floor with a
  // horizon gives every part something to sit in.
  function studioEnv(renderer, opt) {
    opt = opt || {};
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const g = c.getContext("2d");

    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0.00, opt.top || "#8d99a8");
    sky.addColorStop(0.42, "#495260");
    sky.addColorStop(0.50, "#2b313a");            // horizon
    sky.addColorStop(0.52, "#20252c");
    sky.addColorStop(1.00, opt.floor || "#31363e");
    g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);

    // soft-edged rectangle: the shape a real softbox reflects
    function box(x, y, w, h, a, blur) {
      g.save();
      g.filter = "blur(" + (blur || 22) + "px)";
      g.globalAlpha = a;
      g.fillStyle = "#ffffff";
      g.fillRect(x - w / 2, y - h / 2, w, h);
      g.restore();
    }
    box(250, 120, 300, 130, 0.95, 26);            // key, high left
    box(760, 165, 200, 240, 0.55, 30);            // fill, right
    box(512, 40, 620, 70, 0.40, 34);              // top strip
    box(150, 300, 120, 90, 0.22, 30);             // low kick

    // a couple of dark blockers stop the reflections reading as a uniform dome
    g.save(); g.filter = "blur(30px)"; g.globalAlpha = 0.55;
    g.fillStyle = "#0d1015";
    g.fillRect(540, 60, 150, 200);
    g.fillRect(0, 150, 90, 260);
    g.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    const env = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
    return env;
  }

  // ---------------------------------------------------------------- shadows
  // Self-shadowing only: parts shadow each other, and nothing is added to the
  // scene. A ground plane would light the models better still, but it would
  // change every composition that has already been framed.
  function enableShadows(renderer, light, radius) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (!light) return;
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    const r = radius || 400;
    const cam = light.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = r * 6;
    light.shadow.bias = -0.0012;
    light.shadow.normalBias = 0.6;
    cam.updateProjectionMatrix();
  }

  // fit the shadow camera around whatever is in the scene
  function fitShadow(light, object) {
    if (!light || !light.shadow) return;
    const b = new THREE.Box3().setFromObject(object);
    if (b.isEmpty()) return;
    const s = new THREE.Vector3(); b.getSize(s);
    const c = new THREE.Vector3(); b.getCenter(c);
    const r = Math.max(s.x, s.y, s.z) * 0.75 + 20;
    const cam = light.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = r * 8;
    cam.updateProjectionMatrix();
    if (light.target) { light.target.position.copy(c); light.target.updateMatrixWorld(); }
  }

  function shadowAll(root) {
    root.traverse(function (o) {
      if (!o.isMesh) return;
      const m = o.material;
      // transmissive and additive things should not block light
      if (m && (m.transmission > 0 || m.blending === THREE.AdditiveBlending)) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
  }

  // A layer-line finish was written here and removed. At 0.2mm layers on a
  // part rendered a few hundred pixels tall the banding is sub-pixel: it adds
  // nothing visible and risks moire on high-DPI screens. Exaggerating the
  // pitch until it read would be inventing a surface the parts do not have.

  // A post-hoc glossify() pass lived here: it walked the scene rebuilding
  // opaque Standard materials as Physical ones with a clearcoat. It was
  // removed because replacing o.material silently detaches every reference the
  // scene already holds — DiOPAL kept a handle per layer to drive the
  // enclosure's ghosting, and after the swap it was animating a material that
  // was no longer attached to anything. Each scene now builds its materials
  // with the clearcoat from the start, which cannot come apart.

  return {
    smoothNormals: smoothNormals,
    studioEnv: studioEnv,
    enableShadows: enableShadows,
    fitShadow: fitShadow,
    shadowAll: shadowAll,
  };
})();
