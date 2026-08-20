#!/usr/bin/env python3
"""Shrink the published STL models so GitLab Pages can actually deploy.

iGEM's artifact cap sits just under 11.5MB and the site's `public/` zipped to
exactly that, with the 83 STL models accounting for 7.7MB of it. Binary STL is
50 bytes per triangle with no vertex sharing, so the only way to make it
smaller is fewer triangles — zip has already squeezed the encoding (22.8MB of
STL compresses to 7.7MB, so gzipping them ourselves would gain nothing).

Method is vertex clustering: quantise vertices onto a grid, collapse each cell
to one representative, drop triangles that degenerate. Crude next to quadric
edge collapse, but these are mechanical parts displayed a few hundred pixels
wide, and it has no failure mode worse than softening a fillet.

Only files above CAP are touched, so most of the site's geometry is untouched.
"""
import os, struct, sys
import numpy as np

CAP = 4000            # triangles; files at or below this are left alone

def read_stl(p):
    with open(p, "rb") as f:
        head = f.read(84)
        n = struct.unpack("<I", head[80:84])[0]
        data = f.read()
    a = np.frombuffer(data[:n * 50], dtype=np.uint8).reshape(n, 50)
    return a[:, 12:48].copy().view("<f4").reshape(n, 3, 3).astype(np.float64)

def write_stl(p, tris):
    n = len(tris)
    nrm = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ln = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(ln == 0, 1, ln))
    rec = np.zeros((n, 50), dtype=np.uint8)
    rec[:, :48] = np.concatenate([nrm, tris.reshape(n, 9)],
                                 axis=1).astype("<f4").view(np.uint8).reshape(n, 48)
    with open(p, "wb") as f:
        f.write(b"\0" * 80)
        f.write(struct.pack("<I", n))
        f.write(rec.tobytes())

def cluster(tris, res):
    """Collapse vertices onto a res^3 grid over the model's bounding box."""
    v = tris.reshape(-1, 3)
    lo, hi = v.min(0), v.max(0)
    span = np.where(hi - lo == 0, 1.0, hi - lo)
    cell = span.max() / res
    key = np.floor((v - lo) / cell).astype(np.int64)
    # one integer id per occupied cell
    mul = np.array([1, 1 << 21, 1 << 42], dtype=np.int64)
    ids = (key * mul).sum(1)
    uniq, inv = np.unique(ids, return_inverse=True)
    # representative = centroid of the vertices that fell in the cell, which
    # tracks the surface better than snapping to the cell centre
    rep = np.zeros((len(uniq), 3))
    cnt = np.zeros(len(uniq))
    np.add.at(rep, inv, v)
    np.add.at(cnt, inv, 1)
    rep /= cnt[:, None]
    idx = inv.reshape(-1, 3)
    # drop degenerates (two or more corners in the same cell)
    ok = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 0] != idx[:, 2])
    idx = idx[ok]
    # drop duplicate faces
    srt = np.sort(idx, axis=1)
    _, keep = np.unique(srt, axis=0, return_index=True)
    idx = idx[np.sort(keep)]
    return rep[idx]

def decimate(tris, target):
    """Binary search the grid resolution that lands nearest the target."""
    lo, hi = 8, 512
    best = None
    for _ in range(12):
        mid = (lo + hi) // 2
        out = cluster(tris, mid)
        if best is None or abs(len(out) - target) < abs(len(best) - target):
            best = out
        if len(out) > target:
            hi = mid - 1
        else:
            lo = mid + 1
        if lo > hi:
            break
    return best

if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "hardware"
    dry = "--apply" not in sys.argv
    before = after = 0
    touched = 0
    for dp, _, fns in os.walk(root):
        if os.sep + "placed" in dp or os.sep + "final" in dp:
            continue
        for fn in sorted(fns):
            if not fn.endswith(".stl"):
                continue
            p = os.path.join(dp, fn)
            t = read_stl(p)
            before += len(t)
            if len(t) <= CAP:
                after += len(t)
                continue
            out = decimate(t, CAP)
            after += len(out)
            touched += 1
            print(f"  {len(t):7d} -> {len(out):6d}  ({len(out)/len(t)*100:4.1f}%)  {p}")
            if not dry:
                write_stl(p, out)
    print(f"\n{touched} files rewritten")
    print(f"triangles {before} -> {after}  ({after/before*100:.1f}%)")
    print(f"raw STL   {before*50/1048576:.2f} MB -> {after*50/1048576:.2f} MB")
    if dry:
        print("\n(dry run — pass --apply to write)")
