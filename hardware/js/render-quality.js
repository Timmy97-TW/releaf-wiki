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
  // Drop zero-area triangles from a non-indexed geometry. An exported STL can
  // carry a handful of these (two or three vertices coincident), and on Apple's
  // tile-based GPU a zero-length edge in the rasterizer's setup can poison a
  // whole tile bin: the DiOPAL rack had 23 of them and rendered an intermittent
  // solid black rectangle — measured at 4–6 frames in every 100, gone with the
  // rack hidden and gone again with these removed.
  // `slivers` (optional): also drop triangles that have area but no shape —
  // needles whose area over their longest edge squared falls below this. An
  // equilateral triangle scores 0.43; a needle a thousandth as wide as it is
  // long scores about 0.0005. These carry a numerically meaningless normal, and
  // they are most of what a coarse or decimated export is made of: measured on
  // the photometer's own parts, 59% of part6's triangles, 44% of part9's and
  // 34% of part5's score under 0.02. On screen they are the thin shards that
  // no amount of smoothing removes, because there is no surface there to
  // smooth. Removing one leaves a hole of its own area, which is to say none.
  function dropDegenerate(geo, minArea, slivers) {
    if (geo.index) return geo;
    const pos = geo.attributes.position, n = pos.count;
    const eps = minArea === undefined ? 1e-5 : minArea;
    const thin = slivers === undefined ? 0 : slivers;
    const keep = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      ab.subVectors(b, a); ac.subVectors(c, a);
      const area = ab.clone().cross(ac).length() * 0.5;
      if (!(area > eps)) continue;
      if (thin > 0) {
        const e = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
        if (e > 0 && area / (e * e) < thin) continue;
      }
      keep.push(i);
    }
    if (keep.length * 3 === n) return geo;
    const out = new Float32Array(keep.length * 9);
    let o = 0;
    keep.forEach(function (i) {
      for (let k = 0; k < 3; k++) { out[o++] = pos.getX(i + k); out[o++] = pos.getY(i + k); out[o++] = pos.getZ(i + k); }
    });
    geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
    geo.deleteAttribute("normal");
    geo.userData.droppedTriangles = n / 3 - keep.length;
    return geo;
  }


  // Take the noise out of a coarse print mesh without rounding its edges.
  //
  // These STLs are exported coarsely and a face that is meant to be flat is
  // not: measured on the photometer's optical head, its two largest smooth
  // regions sit 1.1 and 1.3 mm RMS off their own best-fit plane across a 30 mm
  // span. No shading setting fixes that. A low smoothing angle leaves the
  // facets; a high one turns the same defect into a crumpled sheet. They are
  // one defect seen from two sides, and it is in the geometry.
  //
  // This is Taubin's lambda|mu filter. A plain Laplacian pass pulls every
  // vertex toward the average of its neighbours, which removes the noise and
  // also shrinks the part; Taubin follows each shrinking pass with a smaller
  // inflating one, so the noise goes and the volume stays. Vertices on a
  // feature edge — any edge whose two faces meet at more than `feature`
  // degrees — are frozen, so every real corner, chamfer and silhouette stays
  // exactly where the CAD put it and only the surface between them relaxes.
  //
  // Tried first and discarded: fitting each region to a plane or a cylinder and
  // projecting onto it. Growing regions face-to-neighbour leaks around corners
  // (one region took 2638 of the head's 3972 faces), and growing them against a
  // running plane fitted the walls but put a new crease where two patches met.
  // Relaxing the whole surface at once has no seams to get wrong.
  //
  // The STL files on disk are never written to: they are downloads on the wiki
  // and have to stay what the team printed. This runs on loaded geometry only.
  function relaxSurfaces(geo, opt) {
    opt = opt || {};
    const pos = geo.attributes.position;
    if (!pos || geo.index) return geo;
    const p = pos.array, tris = p.length / 9;
    if (tris < 8) return geo;
    const featureCos = Math.cos((opt.feature === undefined ? 34 : opt.feature) * Math.PI / 180);
    const iters = opt.iters === undefined ? 6 : opt.iters;
    const lam = opt.lambda === undefined ? 0.33 : opt.lambda;
    const mu = opt.mu === undefined ? -0.34 : opt.mu;
    // A hard leash, and the most important number here. This filter exists to
    // take sub-millimetre noise out of a coarse export, nothing more. Left to
    // run free on a mesh with long thin triangles it does not denoise, it
    // collapses: measured without the leash, vertices on three of the
    // photometer's parts travelled 9, 17 and 19 mm. No vertex may end up
    // further than this from where the CAD put it.
    const leash = opt.leash === undefined ? 0.40 : opt.leash;

    // face normals
    const fn = new Float32Array(tris * 3);
    for (let i = 0; i < tris; i++) {
      const o = i * 9;
      const ax = p[o + 3] - p[o], ay = p[o + 4] - p[o + 1], az = p[o + 5] - p[o + 2];
      const bx = p[o + 6] - p[o], by = p[o + 7] - p[o + 1], bz = p[o + 8] - p[o + 2];
      let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx;
      const L = Math.hypot(x, y, z) || 1e-9;
      fn[i * 3] = x / L; fn[i * 3 + 1] = y / L; fn[i * 3 + 2] = z / L;
    }

    // weld corners into unique vertices
    const idOf = new Int32Array(tris * 3);
    const map = new Map();
    const VX = [], VY = [], VZ = [], copies = [];
    for (let v = 0; v < tris * 3; v++) {
      const k = Math.round(p[v * 3] * 1e3) + "," + Math.round(p[v * 3 + 1] * 1e3) + "," +
                Math.round(p[v * 3 + 2] * 1e3);
      let id = map.get(k);
      if (id === undefined) {
        id = VX.length; map.set(k, id);
        VX.push(p[v * 3]); VY.push(p[v * 3 + 1]); VZ.push(p[v * 3 + 2]); copies.push([]);
      }
      idOf[v] = id; copies[id].push(v);
    }
    const n = VX.length;

    // neighbour lists and feature marking, both from the welded edges
    const nbr = new Array(n); for (let i = 0; i < n; i++) nbr[i] = [];
    const seen = new Set();
    const edgeFaces = new Map();
    for (let i = 0; i < tris; i++) {
      for (let e = 0; e < 3; e++) {
        const a1 = idOf[i * 3 + e], b1 = idOf[i * 3 + (e + 1) % 3];
        const lo = a1 < b1 ? a1 : b1, hi = a1 < b1 ? b1 : a1;
        const k = lo * 1e7 + hi;
        if (!seen.has(k)) { seen.add(k); nbr[lo].push(hi); nbr[hi].push(lo); }
        const l = edgeFaces.get(k); if (l) l.push(i); else edgeFaces.set(k, [i]);
      }
    }
    const frozen = new Uint8Array(n);
    edgeFaces.forEach(function (l, k) {
      const hi = k % 1e7, lo = (k - hi) / 1e7;
      if (l.length !== 2) { frozen[lo] = 1; frozen[hi] = 1; return; }   // open or non-manifold
      const a1 = l[0], b1 = l[1];
      const d = fn[a1 * 3] * fn[b1 * 3] + fn[a1 * 3 + 1] * fn[b1 * 3 + 1] + fn[a1 * 3 + 2] * fn[b1 * 3 + 2];
      if (d < featureCos) { frozen[lo] = 1; frozen[hi] = 1; }
    });

    const OX = Float64Array.from(VX), OY = Float64Array.from(VY), OZ = Float64Array.from(VZ);
    const AX = new Float64Array(n), AY = new Float64Array(n), AZ = new Float64Array(n);
    function pass(w) {
      for (let i = 0; i < n; i++) {
        const nb = nbr[i];
        if (frozen[i] || nb.length < 3) { AX[i] = VX[i]; AY[i] = VY[i]; AZ[i] = VZ[i]; continue; }
        let sx = 0, sy = 0, sz = 0;
        for (let j = 0; j < nb.length; j++) { sx += VX[nb[j]]; sy += VY[nb[j]]; sz += VZ[nb[j]]; }
        const inv = 1 / nb.length;
        AX[i] = VX[i] + w * (sx * inv - VX[i]);
        AY[i] = VY[i] + w * (sy * inv - VY[i]);
        AZ[i] = VZ[i] + w * (sz * inv - VZ[i]);
      }
      for (let i = 0; i < n; i++) {
        let x = AX[i], y = AY[i], z = AZ[i];
        const dx = x - OX[i], dy = y - OY[i], dz = z - OZ[i];
        const d = Math.hypot(dx, dy, dz);
        if (d > leash) { const s2 = leash / d; x = OX[i] + dx * s2; y = OY[i] + dy * s2; z = OZ[i] + dz * s2; }
        VX[i] = x; VY[i] = y; VZ[i] = z;
      }
    }
    for (let it = 0; it < iters; it++) { pass(lam); pass(mu); }

    let moved = 0, maxMove = 0;
    for (let i = 0; i < n; i++) {
      const c = copies[i], v0 = c[0] * 3;
      const d = Math.hypot(VX[i] - p[v0], VY[i] - p[v0 + 1], VZ[i] - p[v0 + 2]);
      if (d > 1e-4) { moved++; if (d > maxMove) maxMove = d; }
      for (let j = 0; j < c.length; j++) {
        const w = c[j] * 3; p[w] = VX[i]; p[w + 1] = VY[i]; p[w + 2] = VZ[i];
      }
    }
    pos.needsUpdate = true;
    geo.userData.relaxed = { vertices: n, frozen: Array.prototype.reduce.call(frozen, function (a1, b1) { return a1 + b1; }, 0),
      moved: moved, maxMoveMM: +maxMove.toFixed(3) };
    return geo;
  }

  // `snapDeg` (optional): pull any face normal that lands within this many
  // degrees of a principal axis exactly onto it, BEFORE anything is merged.
  // These prints are axis-aligned boxes with round bores, and their STLs are
  // coarse: a wall that is meant to be flat comes out with its triangles a few
  // degrees apart. A few degrees is nothing on a matt surface and everything
  // under a clearcoat at a grazing angle, which is what put visible triangles
  // on the LED holder's sides — measured face-on, the wall's normals spanned
  // about 6 degrees and the clearcoat turned that into a shattered look.
  // Snapping leaves the bores alone: their facets are ~20 degrees apart, so
  // only the four that are already axis-aligned qualify, and those do not move.
  function smoothNormals(geo, angle, snapDeg) {
    const pos = geo.attributes.position;
    if (!pos || geo.index) { geo.computeVertexNormals(); return geo; }
    const p = pos.array;
    const tris = p.length / 9;
    if (tris < 1) { geo.computeVertexNormals(); return geo; }
    const cosLimit = Math.cos((angle === undefined ? 38 : angle) * Math.PI / 180);
    const cosSnap = snapDeg ? Math.cos(snapDeg * Math.PI / 180) : 2;

    const fn = new Float32Array(tris * 3);
    // |a x b| is twice the triangle's area, and it is the weight each face gets
    // in the average. Unweighted, every face at a corner counted the same, so a
    // vertex shared by one huge wall triangle and six tiny facets of the
    // rounded corner beside it came out pulled 18 degrees off the wall — and
    // that bent normal was then interpolated across the whole wall. That is
    // what put visible triangles on the flat sides of the LED holder and the
    // rack: measured on led-holder.stl, 703 of 2157 vertical-wall triangles
    // carried a vertex normal more than 8 degrees off their own plane.
    const fw = new Float32Array(tris);
    for (let i = 0; i < tris; i++) {
      const o = i * 9;
      const ax = p[o + 3] - p[o],     ay = p[o + 4] - p[o + 1], az = p[o + 5] - p[o + 2];
      const bx = p[o + 6] - p[o],     by = p[o + 7] - p[o + 1], bz = p[o + 8] - p[o + 2];
      let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx;
      const l = Math.hypot(x, y, z) || 1;
      x /= l; y /= l; z /= l;
      if (cosSnap <= 1) {
        const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
        if (ax >= ay && ax >= az) { if (ax >= cosSnap) { x = x < 0 ? -1 : 1; y = 0; z = 0; } }
        else if (ay >= az) { if (ay >= cosSnap) { x = 0; y = y < 0 ? -1 : 1; z = 0; } }
        else if (az >= cosSnap) { x = 0; y = 0; z = z < 0 ? -1 : 1; }
      }
      fn[i * 3] = x; fn[i * 3 + 1] = y; fn[i * 3 + 2] = z;
      fw[i] = l;
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
          if (d >= cosLimit) {
            const w = fw[g];
            x += fn[g * 3] * w; y += fn[g * 3 + 1] * w; z += fn[g * 3 + 2] * w;
          }
        }
        const l = Math.hypot(x, y, z) || 1;
        x /= l; y /= l; z /= l;
        // The invariant the angle argument implies: if two faces more than
        // `angle` apart are not merged, the answer must not end up more than
        // `angle` off the face it belongs to either. Slivers, whose face normal
        // is numerically unstable, are the ones that break it.
        const dev = x * fn[f * 3] + y * fn[f * 3 + 1] + z * fn[f * 3 + 2];
        if (dev < cosLimit) { x = fn[f * 3]; y = fn[f * 3 + 1]; z = fn[f * 3 + 2]; }
        out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z;
      }
    });
    geo.setAttribute("normal", new THREE.BufferAttribute(out, 3));
    return geo;
  }

  // ------------------------------------------------------------------ colour
  // Every colour written in this codebase is an sRGB hex, because that is what
  // a colour picker, a screenshot and a palette measurement all give you. r128
  // has no ColorManagement: it treats a THREE.Color as linear and re-encodes on
  // output, so handing it an sRGB hex directly is an albedo far too bright —
  // #101317 is 0.0902 as sRGB against a true linear 0.0086. Route every
  // material colour through here.
  function srgb(hex) {
    return (hex && hex.isColor ? hex.clone() : new THREE.Color(hex)).convertSRGBToLinear();
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
    // The canvas above is painted in sRGB — #495260, #8d99a8, white softboxes.
    // r128 has no ColorManagement, so without this the PMREM consumes those
    // values as if they were already linear and the whole environment comes out
    // several times too bright. Every scene that uses this was then hand-tuned
    // against the wrong number: envMapIntensity values were pulled down to
    // compensate, and dark albedos still photographed grey. This is the single
    // change that makes a measured dark colour render as that colour.
    tex.encoding = THREE.sRGBEncoding;
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
    dropDegenerate: dropDegenerate,
    relaxSurfaces: relaxSurfaces,
    srgb: srgb,
    studioEnv: studioEnv,
    enableShadows: enableShadows,
    fitShadow: fitShadow,
    shadowAll: shadowAll,
  };
})();
