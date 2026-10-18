#!/usr/bin/env python3
"""Write the hydroponics plate's four printable parts as binary STLs.

The hydroponics page has always shown the four parts in its own 3D viewer and
listed them as "The four STLs", but no mesh file was ever published with it:
the geometry lives only in hardware/hydroponics/product/model.{json,bin}, the
packed form hardware/js/packed-loader.js reads. This writes that same geometry
back out as STL so the parts can actually be downloaded and printed.

The pack stores each part's triangles non-indexed, with every coordinate
quantised to a uint16 across that part's own bounding box. On the largest part,
117.5 mm across, one step is 117.5 / 65535 = 0.0018 mm, roughly two hundred
times finer than a 0.4 mm nozzle lays down, so the rounding is invisible to a
printer. Nothing else is changed: millimetres, Z up, and each part left in the
assembly's coordinates, the way the light plate's meshes are published, so the
four files open in their built positions.

Run from the repository root after any hardware sync that rebuilds the pack
(see the hardware vendoring note in the wiki's own records):

    python3 build/hardware/tools/hydroponics_stl.py

It prints a line per part and refuses to write a mesh that is not closed.
"""

import json
import os
import struct
import sys
from collections import defaultdict

SRC = "hardware/hydroponics/product"
OUT = "hardware/hydroponics/models"

# the part names in model.json, and the file each one is written to
FILES = {
    "Floating Plate": "floating-plate.stl",
    "Left Handle": "left-handle.stl",
    "Right Handle": "right-handle.stl",
    "Seed Holder": "seed-holder.stl",
}


def decode(buf, g):
    """model.json's group -> a flat list of (x, y, z) in millimetres."""
    q = struct.unpack_from("<%dH" % (g["bytes"] // 2), buf, g["off"])
    lo, span = g["lo"], g["span"]
    return [
        (
            lo[0] + q[i] / 65535 * span[0],
            lo[1] + q[i + 1] / 65535 * span[1],
            lo[2] + q[i + 2] / 65535 * span[2],
        )
        for i in range(0, len(q), 3)
    ]


def closed(pts):
    """Every edge used by exactly two triangles, after welding at 0.1 µm."""
    key = lambda p: (round(p[0], 4), round(p[1], 4), round(p[2], 4))
    edges = defaultdict(int)
    degenerate = 0
    for t in range(len(pts) // 3):
        a, b, c = (key(pts[3 * t + k]) for k in range(3))
        if a == b or b == c or a == c:
            degenerate += 1
            continue
        for u, v in ((a, b), (b, c), (c, a)):
            edges[tuple(sorted((u, v)))] += 1
    open_edges = sum(1 for n in edges.values() if n != 2)
    return degenerate, open_edges


def normal(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    length = (nx * nx + ny * ny + nz * nz) ** 0.5
    return (nx / length, ny / length, nz / length) if length else (0.0, 0.0, 0.0)


def write_stl(path, part, pts):
    tris = len(pts) // 3
    header = ("ReLEAF %s - iGEM 2026 GEMS Taiwan - mm, Z up" % part)[:79].ljust(80, " ")
    with open(path, "wb") as f:
        f.write(header.encode("ascii"))
        f.write(struct.pack("<I", tris))
        for t in range(tris):
            a, b, c = pts[3 * t], pts[3 * t + 1], pts[3 * t + 2]
            f.write(struct.pack("<12fH", *normal(a, b, c), *a, *b, *c, 0))


def main():
    if not os.path.isdir(SRC):
        sys.exit("run me from the repository root: %s not found" % SRC)
    man = json.load(open(os.path.join(SRC, "model.json")))
    buf = open(os.path.join(SRC, "model.bin"), "rb").read()
    os.makedirs(OUT, exist_ok=True)

    for g in man["groups"]:
        name = FILES.get(g["part"])
        if not name:
            sys.exit("unknown part in model.json: %s" % g["part"])
        pts = decode(buf, g)
        if len(pts) // 3 != g["tris"]:
            sys.exit("%s: %d triangles, manifest says %d" % (g["part"], len(pts) // 3, g["tris"]))
        degenerate, open_edges = closed(pts)
        if degenerate or open_edges:
            sys.exit("%s is not a closed mesh: %d degenerate, %d open edges"
                     % (g["part"], degenerate, open_edges))
        path = os.path.join(OUT, name)
        write_stl(path, g["part"], pts)
        xs, ys, zs = (sorted(p[i] for p in pts) for i in range(3))
        print("%-16s %6d triangles  %6.2f x %5.2f x %5.2f mm  %6.0f KB  %s"
              % (g["part"], len(pts) // 3, xs[-1] - xs[0], ys[-1] - ys[0], zs[-1] - zs[0],
                 os.path.getsize(path) / 1024, path))

    print("\nThe plate takes one of each part and thirteen seed holders.")


if __name__ == "__main__":
    main()
