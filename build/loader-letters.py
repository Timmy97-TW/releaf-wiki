#!/usr/bin/env python3
"""Cut the student-designed ReLEAF wordmark (20 July 2026) into the homepage
loading screen's two pictures.

    python3 build/loader-letters.py <source.png> [--preview out.png]

The source is the team's drawing on a white ground, 2732 x 2048:
iGEM2026_Images/2026-07/General/W33  7_19-7_26/
    20260720_General_Design_StudentDesignedReleafSpecialLogo.png

Writes assets/img/home/loader/:
  word.webp    the six letters on a transparent ground, the mascot lifted off
               the F. The F's top is repainted black where the mascot's vines
               lay across it (the letter is flat black there, so nothing of
               the drawing is invented).
  mascot.webp  the mascot alone, which flies to the nav badge at the end.
and prints the numbers index.html needs: each letter's left and right edge
and the mascot's box, as fractions of word.webp.

Only the ground is changed: white becomes transparent, with the anti-aliased
rim un-blended from white so the letters keep soft edges on any colour.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img", "home", "loader")
WIDTH = 1000          # word.webp width; the word shows at most 560 css px wide
F_COLS = (2208, 2592)  # the F's columns in the source
FACE = (2400, 760)    # a point on the mascot's face (x, y) in the source


def main():
    src = sys.argv[1]
    preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    H, W, _ = rgb.shape

    # the ground: near-white pixels connected to the border
    # the ground: white connected to the border, and the white pockets the
    # letters close round (the R's counter, the gap under the F's arm);
    # small whites (eye shines, the A's sparkle) stay drawing
    white = rgb.min(2) > 236
    lab, n = ndi.label(white)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    size = ndi.sum(white, lab, index=np.arange(n + 1))
    keep = np.zeros(n + 1, bool)
    keep[edge] = True
    keep[size > 6000] = True
    keep[0] = False
    ground = keep[lab]
    ink = ~ground

    # alpha: 1 inside, un-blended from white on a 3 px rim next to the ground
    alpha = ink.astype(np.float32)
    rim = ink & ndi.binary_dilation(ground, iterations=3)
    a_rim = ((255 - rgb[rim]) / 255).max(1).clip(0, 1)
    alpha[rim] = a_rim
    col = rgb.copy()
    safe = np.maximum(a_rim, 1e-3)[:, None]
    col[rim] = ((rgb[rim] - 255 * (1 - safe)) / safe).clip(0, 255)

    # the F is the largest black shape in its columns, with the gaps the
    # mascot's vines cut across it closed; the mascot is whatever else is
    # drawn there (its hood, face, sprout, and the vine hanging off the arm).
    # The vines lying ON the F stay with the letter.
    x0, x1 = F_COLS
    zone = np.zeros_like(ink)
    zone[:, x0:x1] = True
    black = (rgb.max(2) < 70) & ink & zone
    lab, n = ndi.label(black)
    big = np.argmax(ndi.sum(black, lab, index=np.arange(1, n + 1))) + 1
    fsil = ndi.binary_fill_holes(ndi.binary_closing(lab == big, iterations=6)) & zone
    fsil = ndi.binary_dilation(fsil, iterations=4) & zone   # with its soft rim
    # a white pocket closed between the F and the hanging vine is ground too
    lab, n = ndi.label(white & zone & ink)
    touch = np.unique(lab[ndi.binary_dilation(fsil, iterations=6) & (lab > 0)])
    pocket = np.isin(lab, touch[touch > 0])
    alpha[pocket] = 0
    ink = ink & ~pocket
    rest = ink & zone & ~fsil & (alpha > .35)
    lab, n = ndi.label(rest)
    size = ndi.sum(rest, lab, index=np.arange(n + 1))
    body = lab == np.argmax(size[1:]) + 1          # hood, face and sprout
    mascot = rest & ndi.binary_fill_holes(ndi.binary_closing(body, iterations=6))
    assert mascot[FACE[1], FACE[0]], "FACE is not on the mascot"

    box_all = Image.fromarray((alpha > 0).astype(np.uint8) * 255).getbbox()
    word_a = np.where(zone & ~fsil, 0, alpha)        # the F alone in its columns
    word_c = col
    # the hood ran on behind the F: a 3 px soft edge where it meets the letter
    dist = ndi.distance_transform_edt(~fsil)
    m_a = np.where(mascot, alpha, 0) * np.clip(dist / 3, 0, 1)

    def rgba(c, a):
        return Image.fromarray(np.dstack([c, a[..., None] * 255]).astype(np.uint8), "RGBA")

    word = rgba(word_c, word_a)
    box = box_all
    pad = 8
    box = (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)
    word = word.crop(box)
    s = WIDTH / word.width
    word = word.resize((WIDTH, round(word.height * s)), Image.LANCZOS)

    mas = rgba(col, m_a)
    mbox = mas.getbbox()
    mas = mas.crop(mbox)
    mas = mas.resize((round(mas.width * s), round(mas.height * s)), Image.LANCZOS)

    os.makedirs(OUT, exist_ok=True)
    word.save(os.path.join(OUT, "word.webp"), quality=60, alpha_quality=70, method=6)
    mas.save(os.path.join(OUT, "mascot.webp"), quality=86, method=6)

    # letter columns from the ground mask (gaps of pure ground between them)
    cols = (word_a > .1)[:, :].any(0)
    runs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None:
            start = x
        if not v and start is not None:
            runs.append((start, x)); start = None
    if start is not None:
        runs.append((start, len(cols)))
    bw = box[2] - box[0]
    bh = box[3] - box[1]
    letters = [[round((a - box[0]) / bw, 4), round((b - box[0]) / bw, 4)] for a, b in runs if b - a > 40]
    assert len(letters) == 6, letters
    numbers = {
        "aspect": round(bw / bh, 4),
        "letters": letters,
        "mascot": [round((mbox[0] - box[0]) / bw, 4), round((mbox[1] - box[1]) / bh, 4),
                   round((mbox[2] - mbox[0]) / bw, 4), round((mbox[3] - mbox[1]) / bh, 4)],
    }
    print(json.dumps(numbers))
    for f in ("word.webp", "mascot.webp"):
        print(f, os.path.getsize(os.path.join(OUT, f)), "bytes")

    if preview:
        ground_c = Image.new("RGBA", word.size, (255, 255, 255, 255))
        ground_c.alpha_composite(word)
        both = Image.new("RGBA", (word.width, word.height * 2), (40, 40, 40, 255))
        both.alpha_composite(word, (0, 0))
        mx = round(numbers["mascot"][0] * word.width)
        my = round(numbers["mascot"][1] * word.height)
        both.alpha_composite(word, (0, word.height))
        both.alpha_composite(mas, (mx, word.height + my))
        out = Image.new("RGB", (word.width, word.height * 3), "white")
        out.paste(ground_c.convert("RGB"), (0, 0))
        out.paste(both.convert("RGB"), (0, word.height))
        out.save(preview)


if __name__ == "__main__":
    main()
