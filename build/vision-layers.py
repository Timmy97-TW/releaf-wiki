#!/usr/bin/env python3
"""Packs the vision section's picture layers for the page.

    python3 build/vision-layers.py <folder with the master PNGs>

The folder holds one PNG per layer, named as below, each covering its own
rectangle of the 1600 x 1800 artboard (see assets/img/home/vision/README.md).
The masters can be any resolution as long as the shape matches; this script
resizes each to the size the page uses and writes
assets/img/home/vision/<layer>.webp.

    sky.png      opaque           artboard x 0..1600,  y 0..1270      -> 2000 x 1588
    ridges.png   transparent sky  artboard x 0..1600,  y 1070..1270   -> 4000 x 500
    valley.png   transparent sky  artboard x 0..1600,  y 1015..1800   -> 4000 x 1962
    farm.png     opaque           artboard x 540..1000, y 1390..1730  -> 2760 x 2040
    lights.png   transparent      artboard x 640..780, y 1470..1590   -> 840 x 720

farm.png gets a soft transparent border here (FEATHER of its width and
height), so it melts into valley.png under it; the artist draws it edge to
edge. Nothing else is changed: no grading, no sharpening.

Where the masters come from: the design team's artwork, or, for the
placeholder, build/vision/render.html (it paints Neo's generated valley,
build/vision/valley.json, as these five layers).
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img" / "home" / "vision"

# name: (size on the page, has transparency, webp quality)
LAYERS = {
    "sky": ((2000, 1588), False, 84),
    "ridges": ((4000, 500), True, 84),
    "valley": ((4000, 1962), True, 80),
    "farm": ((2760, 2040), True, 82),
    "lights": ((840, 720), True, 84),
}
FEATHER = 0.10     # farm.png fades out over this share of each side


def feather(im):
    """A soft edge: alpha ramps (smoothstep) from 0 at the border to full at
    FEATHER inside, on all four sides."""
    w, h = im.size

    def ramp(n):
        f = max(1, int(n * FEATHER))
        out = []
        for i in range(n):
            t = min(1.0, i / f, (n - 1 - i) / f)
            out.append(int(round(255 * t * t * (3 - 2 * t))))
        return out

    cols = Image.new("L", (w, 1)); cols.putdata(ramp(w))
    rows = Image.new("L", (1, h)); rows.putdata(ramp(h))
    mask = ImageChops.multiply(cols.resize((w, h), Image.NEAREST), rows.resize((w, h), Image.NEAREST))
    im.putalpha(ImageChops.multiply(im.getchannel("A"), mask))
    return im


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (size, alpha, q) in LAYERS.items():
        f = src / f"{name}.png"
        if not f.exists():
            print(f"skip {name}: {f} not found (the page keeps the current {name}.webp)")
            continue
        im = Image.open(f).convert("RGBA")
        want = size[0] / size[1]
        have = im.size[0] / im.size[1]
        if abs(have - want) / want > 0.01:
            print(f"WARNING {name}: {im.size[0]} x {im.size[1]} is not the shape of {size[0]} x {size[1]}; it is stretched to fit")
        im = im.resize(size, Image.LANCZOS)
        if name == "farm":
            im = feather(im)
        if not alpha:
            im = im.convert("RGB")
        out = OUT / f"{name}.webp"
        im.save(out, "WEBP", quality=q, method=6)
        print(f"{out.relative_to(ROOT)}  {size[0]} x {size[1]}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
