// Packed geometry loader.
//
// Binary STL costs 50 bytes a triangle and repeats every shared vertex, which
// this model cannot afford: 227k triangles would be 11 MB against an iGEM
// artifact cap of 11.5 MB for the whole site. Here each group's vertices are
// quantised to uint16 across that group's own bounding box — 0.006 mm on a
// 370 mm panel, far below anything the screen resolves — for 18 bytes a
// triangle, and the whole assembly is one file instead of 105 requests.
//
// Geometry is left non-indexed on purpose. three.js computeVertexNormals()
// then yields one normal per face, which is the correct faceted read for
// machined parts; welding vertices would round off every milled edge.
(function (global) {
  "use strict";

  function decodeGroup(buf, g) {
    const q = new Uint16Array(buf, g.off, g.bytes / 2);
    const n = q.length;
    const pos = new Float32Array(n);
    const lo = g.lo, span = g.span;
    for (let i = 0; i < n; i += 3) {
      pos[i]     = lo[0] + (q[i]     / 65535) * span[0];
      pos[i + 1] = lo[1] + (q[i + 1] / 65535) * span[1];
      pos[i + 2] = lo[2] + (q[i + 2] / 65535) * span[2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();          // non-indexed -> flat, per-face normals
    return geo;
  }

  // Returns a promise for { manifest, groups: [{ part, mat, tris, geometry }] }.
  // onProgress(done, total) fires as groups are decoded, so a caller can show
  // real progress rather than a spinner that means nothing.
  function load(dir, onProgress) {
    const base = dir.charAt(dir.length - 1) === "/" ? dir : dir + "/";
    return fetch(base + "model.json")
      .then(function (r) {
        if (!r.ok) throw new Error("model.json " + r.status);
        return r.json();
      })
      .then(function (man) {
        return fetch(base + "model.bin")
          .then(function (r) {
            if (!r.ok) throw new Error("model.bin " + r.status);
            return r.arrayBuffer();
          })
          .then(function (buf) {
            const groups = [];
            const total = man.groups.length;
            man.groups.forEach(function (g, i) {
              groups.push({
                part: g.part, mat: g.mat, tris: g.tris,
                geometry: decodeGroup(buf, g)
              });
              if (onProgress) onProgress(i + 1, total);
            });
            return { manifest: man, groups: groups };
          });
      });
  }

  // A folder of STLs packed by tools/pack_models.py into _pack.json + _pack.bin,
  // behind the call the scenes already made on THREE.STLLoader:
  // bundle("models/").load("models/pump-lid.stl", onLoad, onProgress, onError).
  // The folder downloads once, for whichever part asks first; each part then
  // decodes on its own, so a scene still gets one callback per part. The
  // manifest is revalidated on every load and names the binary by its hash, so
  // a rebuilt pack is never read from a stale cache.
  const bundles = {};
  function bundle(dir) {
    const base = dir.charAt(dir.length - 1) === "/" ? dir : dir + "/";
    if (!bundles[base]) {
      bundles[base] = fetch(base + "_pack.json", { cache: "no-cache" })
        .then(function (r) {
          if (!r.ok) throw new Error(base + "_pack.json " + r.status);
          return r.json();
        })
        .then(function (man) {
          return fetch(base + "_pack.bin?v=" + man.v)
            .then(function (r) {
              if (!r.ok) throw new Error(base + "_pack.bin " + r.status);
              return r.arrayBuffer();
            })
            .then(function (buf) { return { man: man, buf: buf }; });
        });
    }
    return {
      load: function (url, onLoad, onProgress, onError) {
        const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop());
        const fail = function (e) { if (onError) onError(e); else console.error(e); };
        bundles[base].then(function (pack) {
          const g = pack.man.groups[name];
          if (!g) { fail(new Error(base + name + " is not in the pack")); return; }
          onLoad(decodeGroup(pack.buf, g));
        }, fail);
      }
    };
  }

  global.PackedModel = { load: load, decodeGroup: decodeGroup, bundle: bundle };
})(window);
