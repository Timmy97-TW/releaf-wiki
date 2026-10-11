#!/usr/bin/env python3
"""Put the students' moonwalking mascot on a white ground, on his own.

    python3 build/loader-mascot.py [--preview out.png]

Reads the shipped animation, assets/img/home/loader/moonwalk.webp (the
students' MJ.gif of 10 October 2026, already cleaned: 28 colours, lossless,
its ground one flat tone), and writes the same frames

  · WITHOUT the yellow sun that stood to his left, by cropping to the mascot
    alone — the sun never moves, so dropping its columns drops it whole, and
    the file loses a quarter of its width with it;
  · ON WHITE, so the opening can be a white screen (11 Oct, owner).

The ground is not simply painted over. Every pixel along the drawing's edge
is a blend of the drawing's colour and the old ground, so painting the flat
tone alone would leave a pale green rim round the hat, the shoes and the
white outline. Each edge pixel is unmixed instead: the nearest pixel that is
certainly drawing gives its colour C, the blend P = a*C + (1-a)*GROUND is
solved for a, and the pixel is laid down again as a*C + (1-a)*white. Flat
ground comes out white, the drawing comes out untouched, and the edge keeps
its softness against the new ground.

Writes assets/img/home/loader/:
  moonwalk.webp        the walk, white ground, lossless
  moonwalk-still.webp  its first frame, which is fetched alone first
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "img", "home", "loader")
SRC = os.path.join(OUT, "moonwalk.webp")

GROUND = np.array([239.0, 249.0, 184.0])   # the animation's own flat ground
WHITE = np.array([255.0, 255.0, 255.0])
FLAT = 12      # L1 distance within which a pixel is nothing but ground
SOLID = 150    # L1 distance beyond which a pixel is nothing but drawing
PAD = 4        # columns of white kept to the left of the mascot


def on_white(rgb):
    """One frame, its ground turned to white and its edges unmixed."""
    d = np.abs(rgb - GROUND).sum(2)
    ground, core = d <= FLAT, d >= SOLID
    rim = ~ground & ~core
    out = rgb.copy()
    out[ground] = WHITE
    if rim.any() and core.any():
        # the colour each edge pixel is a blend OF: its nearest certain drawing
        _, idx = ndi.distance_transform_edt(~core, return_indices=True)
        c = rgb[idx[0], idx[1]]                      # C, per pixel
        cg = c - GROUND
        den = (cg * cg).sum(2)
        a = np.where(den > 1e-6, ((rgb - GROUND) * cg).sum(2) / np.maximum(den, 1e-6), 1.0)
        a = np.clip(a, 0.0, 1.0)[..., None]
        out[rim] = (a * c + (1 - a) * WHITE)[rim]
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    src = Image.open(SRC)
    n = getattr(src, "n_frames", 1)

    frames, inked = [], None
    for i in range(n):
        src.seek(i)
        rgb = np.asarray(src.convert("RGB")).astype(np.float32)
        ink = np.abs(rgb - GROUND).sum(2) > 40
        inked = ink if inked is None else (inked | ink)
        frames.append(on_white(rgb))

    # the mascot is the one drawing that moves and the one that reaches the
    # right edge; the sun is a handful of small still blobs to its left. Take
    # the largest piece of everything that is ever drawn, and keep its columns.
    lab, k = ndi.label(inked)
    size = ndi.sum(inked, lab, index=np.arange(1, k + 1))
    him = lab == (int(np.argmax(size)) + 1)
    cols = np.nonzero(him.any(0))[0]
    x0 = max(0, int(cols.min()) - PAD)
    x1 = min(frames[0].shape[1], int(cols.max()) + 1 + PAD)
    print("mascot columns %d-%d of %d" % (x0, x1, frames[0].shape[1]))

    cut = [Image.fromarray(f[:, x0:x1]) for f in frames]
    # Unmixing the edges invents a colour for every blend, and lossless WebP
    # pays for each of them: the drawing is flat, so one palette shared by
    # every frame costs nothing to look at and about a sixth of the file.
    # (Lossy is not an option here — on flat colour it comes out twice the
    # size of lossless and smears the outlines.)
    w, h = cut[0].size
    strip = Image.new("RGB", (w, h * len(cut)))
    for i, f in enumerate(cut):
        strip.paste(f, (0, i * h))
    pal = strip.quantize(colors=32, method=Image.MEDIANCUT, dither=Image.NONE)
    cut = [f.quantize(palette=pal, dither=Image.NONE).convert("RGB") for f in cut]
    cut[0].save(os.path.join(OUT, "moonwalk.webp"), save_all=True,
                append_images=cut[1:], duration=67, loop=0, lossless=True, method=6)
    cut[0].save(os.path.join(OUT, "moonwalk-still.webp"), lossless=True, method=6)
    for f in ("moonwalk.webp", "moonwalk-still.webp"):
        p = os.path.join(OUT, f)
        print(f, Image.open(p).size, os.path.getsize(p), "bytes")

    if preview:
        pick = [0, n // 4, n // 2, 3 * n // 4]
        w, h = cut[0].size
        sheet = Image.new("RGB", (w * len(pick), h), "white")
        for i, f in enumerate(pick):
            sheet.paste(cut[f], (i * w, 0))
        sheet.save(preview)


if __name__ == "__main__":
    main()
