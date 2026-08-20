#!/usr/bin/env python3
"""Bake the Onshape glTF into placed, per-part STLs.

The glTF carries what the STL bundle lost: every instance of every part, in
assembly coordinates. We can't load glTF in the browser here (no GLTFLoader
vendored, and CDNs are off-limits for iGEM), so instead we walk the node tree,
apply each node's world transform to its vertices, and write one binary STL
per part NAME with all of that part's instances already in position.

One file per name, not per instance, so the viewer still gets one material
per part — which is what the colour scheme needs.
"""
import base64, json, os, struct, sys, re
import numpy as np
from collections import defaultdict

SRC = "/Users/antonlin/Desktop/iGEM Modeling/Bioreactor/Bioreactor GLTF.gltf"
OUT = "/Users/antonlin/Desktop/iGEM Hardware Wiki Page/hardware/bioreactor/placed"

g = json.load(open(SRC))

# ---- buffers ----
bufs = []
for b in g["buffers"]:
    uri = b["uri"]
    assert uri.startswith("data:"), "expected an embedded buffer"
    bufs.append(base64.b64decode(uri.split(",", 1)[1]))

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
        5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

def accessor(i):
    a = g["accessors"][i]
    bv = g["bufferViews"][a["bufferView"]]
    fmt, size = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or (size * n)
    raw = bufs[bv.get("buffer", 0)]
    dt = np.dtype({"b": "<i1", "B": "<u1", "h": "<i2",
                   "H": "<u2", "I": "<u4", "f": "<f4"}[fmt])
    if stride == size * n:
        arr = np.frombuffer(raw, dtype=dt, count=a["count"] * n, offset=start)
        return arr.reshape(a["count"], n) if n > 1 else arr
    # interleaved
    out = np.empty((a["count"], n), dtype=dt)
    for k in range(a["count"]):
        off = start + k * stride
        out[k] = np.frombuffer(raw, dtype=dt, count=n, offset=off)
    return out if n > 1 else out.ravel()

def node_matrix(nd):
    if "matrix" in nd:
        return np.array(nd["matrix"], dtype=np.float64).reshape(4, 4).T  # column-major
    M = np.eye(4)
    if "scale" in nd:
        M = M @ np.diag(list(nd["scale"]) + [1.0])
    if "rotation" in nd:
        x, y, z, w = nd["rotation"]
        R = np.array([
            [1-2*(y*y+z*z), 2*(x*y-z*w),   2*(x*z+y*w),   0],
            [2*(x*y+z*w),   1-2*(x*x+z*z), 2*(y*z-x*w),   0],
            [2*(x*z-y*w),   2*(y*z+x*w),   1-2*(x*x+y*y), 0],
            [0, 0, 0, 1]], dtype=np.float64)
        M = R @ M
    if "translation" in nd:
        T = np.eye(4); T[:3, 3] = nd["translation"]
        M = T @ M
    return M

def clean(name):
    if not name:
        return None
    name = re.sub(r"^occurrence of ", "", name).strip()
    # Onshape appends " <2>" style instance suffixes
    name = re.sub(r"\s*<\d+>$", "", name)
    return name or None

# One entry per INSTANCE. Merging instances would make the three pumps share a
# material, and they need different accents. Names collide across Part Studios
# ("Part 1" is six different geometries), so the mesh index is part of the key.
# parts removed from the model by request
DROP = {("Part 6", 54)}

# a part swapped out for a re-exported STL. The replacement arrives in its own
# origin, so it is translated to sit on the centroid of the part it replaces.
REPLACE = {("Part 2", 58): "/Users/antonlin/Desktop/iGEM Modeling/Bioreactor/Front Wall.stl"}

insts = []                           # {key, name, mesh, tris}

def walk(idx, M, label):
    nd = g["nodes"][idx]
    M = M @ node_matrix(nd)
    lbl = clean(nd.get("name")) or label
    if "mesh" in nd:
        tris = []
        for prim in g["meshes"][nd["mesh"]].get("primitives", []):
            if prim.get("mode", 4) != 4:
                continue
            pos = np.asarray(accessor(prim["attributes"]["POSITION"]), dtype=np.float64)
            if "indices" in prim:
                idxs = np.asarray(accessor(prim["indices"])).astype(np.int64)
            else:
                idxs = np.arange(len(pos), dtype=np.int64)
            v = np.c_[pos, np.ones(len(pos))] @ M.T
            tris.append(v[idxs, :3].reshape(-1, 3, 3))
        if tris and (lbl, nd["mesh"]) not in DROP:
            insts.append({"name": lbl, "mesh": nd["mesh"], "tris": np.vstack(tris)})
    for c in nd.get("children", []):
        walk(c, M, lbl)

sys.setrecursionlimit(10000)
for r in g["scenes"][g.get("scene", 0)]["nodes"]:
    walk(r, np.eye(4), "unnamed")

allv = np.vstack([i["tris"].reshape(-1, 3) for i in insts])
lo, hi = allv.min(0), allv.max(0)
size = hi - lo
print("raw bounds", np.round(lo, 3), np.round(hi, 3), "size", np.round(size, 3))

# Onshape exports glTF in metres; the STL bundle was millimetres.
SCALE = 1000.0 if size.max() < 20 else 1.0
print("scale ->", SCALE)

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".stl") or f == "_manifest.json":
        os.remove(os.path.join(OUT, f))

def safe(n):
    return re.sub(r"[^A-Za-z0-9._ +-]", "_", n)[:70]

# Assign each instance to a channel from its centroid along the long axis.
for i in insts:
    i["tris"] = i["tris"] * SCALE
    c = i["tris"].reshape(-1, 3)
    i["c"] = c.mean(0)
    i["lo"] = c.min(0); i["hi"] = c.max(0)

xs = np.array([i["c"][0] for i in insts])
CH_X = [-179.0, 0.0, 179.0]          # channel centres, checked against the pumps
for i in insts:
    d = [abs(i["c"][0] - x) for x in CH_X]
    span = i["hi"][0] - i["lo"][0]
    # a part wider than a channel pitch spans the whole box, so it has no channel
    i["ch"] = -1 if span > 200 else int(np.argmin(d))

def read_stl(p):
    with open(p, "rb") as fh:
        n = struct.unpack("<I", fh.read(84)[80:84])[0]
        raw = fh.read()
    a = np.frombuffer(raw[:n * 50], dtype=np.uint8).reshape(n, 50)
    return a[:, 12:48].copy().view("<f4").reshape(n, 3, 3).astype(np.float64)

for i in insts:
    key = (i["name"], i["mesh"])
    if key not in REPLACE:
        continue
    rep = read_stl(REPLACE[key])
    rep += (i["c"] - rep.reshape(-1, 3).mean(0))     # align centroids
    i["tris"] = rep
    c = rep.reshape(-1, 3)
    i["c"] = c.mean(0); i["lo"] = c.min(0); i["hi"] = c.max(0)
    i["replaced"] = True
    print("replaced %s|m%d from %s" % (i["name"], i["mesh"], os.path.basename(REPLACE[key])))

grp = defaultdict(int)
manifest = []
for i in insts:
    key = "%s__m%d__ch%d" % (i["name"], i["mesh"], i["ch"])
    grp[key] += 1
    T = i["tris"]
    n = len(T)
    normals = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    ln = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = np.divide(normals, np.where(ln == 0, 1, ln))
    rec = np.zeros((n, 50), dtype=np.uint8)
    payload = np.concatenate([normals, T.reshape(n, 9)], axis=1).astype("<f4")
    rec[:, :48] = payload.view(np.uint8).reshape(n, 48)
    fn = safe("%s__m%d__ch%d__%d" % (i["name"], i["mesh"], i["ch"], grp[key])) + ".stl"
    with open(os.path.join(OUT, fn), "wb") as fh:
        fh.write(b"\0" * 80)
        fh.write(struct.pack("<I", n))
        fh.write(rec.tobytes())
    manifest.append({"file": fn, "name": i["name"], "mesh": i["mesh"], "ch": i["ch"],
                     "tris": int(n),
                     "c": [round(float(x), 1) for x in i["c"]],
                     "min": [round(float(x), 1) for x in i["lo"]],
                     "max": [round(float(x), 1) for x in i["hi"]]})

json.dump(manifest, open(os.path.join(OUT, "_manifest.json"), "w"), indent=0)
print(f"\nwrote {len(manifest)} placed STLs to {OUT}")
tot = sum(m["tris"] for m in manifest)
print("total tris", tot)
byk = defaultdict(list)
for m in manifest:
    byk["%s__m%d" % (m["name"], m["mesh"])].append(m)
print(f"\n{'part__mesh':<30}{'inst':>5}{'tris ea':>9}  ch split          extent (mm)")
for k, v in sorted(byk.items(), key=lambda kv: -sum(m["tris"] for m in kv[1]))[:30]:
    chs = sorted(set(m["ch"] for m in v))
    ext = [round(v[0]["max"][i] - v[0]["min"][i], 1) for i in range(3)]
    print(f"{k[:30]:<30}{len(v):>5}{v[0]['tris']:>9}  ch={chs!s:<16} {ext}")
