# Vision section artwork ("Every farmer a biomanufacturer.")

This folder holds the pictures for the homepage's vision section (`#vision` in `index.html`).
The section opens close on one farm at night. As the reader scrolls, the camera pulls back while
dawn comes up, until the frame shows the whole valley with a reactor glowing at the end of almost
every field.

The pictures here now are **placeholders** made from Neo's generated drawing. The design team's
hand-drawn landscape replaces them. You do not have to change any code, as long as you keep the
canvas, the layer rectangles and the file names below.

## The canvas (the "artboard")

- **1600 x 1800 units**, with (0, 0) at the top left. One unit is not one pixel. Each layer is
  exported at its own resolution (see the table below).
- **The horizon is at y = 1204.** On a laptop the headline sits on the sky above it. The script
  keeps the horizon about 70 px below the end of the words.
- On a wide screen the last frame shows the full width (x 0 to 1600), from roughly y 800 down to
  1800. On a phone it shows about a third of the width, centred on x = 800. The tall sky above
  y 800 is there for phones. **Keep the left half of the sky between y 800 and 1150 calm** (no bright
  cloud, sun or peak), because the headline and the sentence under it sit there.
- **The focal farm** (the first farm, where the camera starts) must sit with its reactor at
  **x = 723, y = 1553** (the centre of the reactor's glowing vessel). Draw its farmhouse up and to
  the left of the reactor (around x 600 to 700, y 1480 to 1540) and its field running up and to the
  right. At the start the reactor fills about a tenth of the screen's height, so the farm needs real
  detail in the `farm` layer.
- Draw everything **at first light**, the finished state: dawn sky, every reactor's vessel lit
  green, and the green line from each reactor into its own field. The page adds the night on top
  (a dark tint that lifts) and the glows (drawn by code, see below).
- The only saturated colour should be the reactor green, **#35e08a**. It only ever means "this
  farm's reactor is on". Warm window light is **#f6cf94**.

## The layers

Each layer is one picture covering its own rectangle of the artboard (x, y, width, height in
units). They are stacked in this order, back to front:

| File | Covers (x, y, w, h) | Page size (px) | Transparency | What goes in it |
|---|---|---|---|---|
| `sky.webp` | 0, 0, 1600, 1270 | 2000 x 1588 | none (opaque) | the whole sky: gradient, sunrise glow, clouds. It runs down behind the mountains to y 1270 |
| `ridges.webp` | 0, 1070, 1600, 200 | 4000 x 500 | yes, sky clear | the far mountain ranges and the haze between them |
| `valley.webp` | 0, 1015, 1600, 785 | 4000 x 1962 | yes, above the hills | the valley: fields, paddies, river, net houses, orchards, farmhouses, the two hills, every reactor and its green line |
| `farm.webp` | 540, 1390, 460, 340 | 2760 x 2040 | soft edge (added by the script) | the focal farm and its surroundings again, **the same drawing as the valley there** but at 6 px per unit, for the close-up |
| `lights.webp` | 640, 1470, 140, 120 | 840 x 720 | yes, all but the lights | only what shines at night on the focal farm: its lit windows, its reactor's vessel and its green line. It sits above the night tint |

In `farm`, draw right up to the edges. The packing script fades its outer 10 % so it melts into
`valley` underneath. Where the two overlap they must line up exactly, because `farm` stays on
screen in the last frame too.

### File formats

- Deliver **PNG** masters (8-bit RGBA) in exactly the shapes above. Any resolution works if the
  shape (aspect ratio) matches, but the page sizes above are the minimum for a sharp close-up.
- Put them in one folder with these exact names (`sky.png`, `ridges.png`, `valley.png`,
  `farm.png`, `lights.png`), then run from the repository root:

      python3 build/vision-layers.py path/to/that/folder

  This writes the five `.webp` files here at the right sizes and adds the soft edge to `farm`.
  Any layer you leave out keeps its current picture. Keep each file under about 300 KB. The
  placeholders total about 420 KB.
- Text never goes in the pictures. The headline, the label "This farm's reactor" and the
  "Illustration." tag are real text on the page.

## The glowing reactors (update when the art changes)

The green glows are drawn by code, not painted, so each one can switch on in turn as the camera
pulls back. Their positions are the `REACTORS` list at the top of `assets/js/home-vision.js`:

    [x, y, size]     x in % of the artboard's width (1600)
                     y in % of the artboard's height (1800)
                     size = the reactor's height in % of the width (1600)
    [x, y, size, 1]  the focal farm's reactor (exactly one entry; the camera starts on it)

Take the point at the **centre of each reactor's vessel**. For example, a reactor whose vessel
centre is at (723, 1553) on the artboard and which stands 22 units tall is
`[45.19, 86.28, 1.375, 1]` (723 / 1600, 1553 / 1800, 22 / 1600). A rough list is enough: a glow
a few units off still reads right. If you move the focal farm, also move `lights.webp`'s
rectangle (`LIGHTS_RECT` in the same file) and update this README.

If you change a layer's **rectangle**, change it in `index.html` too. Each `<img class="vl-layer">`
carries it twice: `data-rect="x y w h"` in units (the script reads this) and the inline `style`
in % (the page uses this when scripts are off). Then bump the `?v=` on the section's css and js
links.

## Previewing

1. From the repository root: `python3 -m http.server 8000`, then open
   <http://localhost:8000/#vision> and scroll through the section. Opening `index.html`
   directly as a file works too.
2. To check the last frame on its own, turn on reduced motion (macOS: System Settings,
   Accessibility, Display, Reduce motion) and reload. The section then shows the finished valley,
   headline landed, without the scroll animation.
3. Check a phone width as well (browser dev tools, 390 x 844). Phones see only the middle third
   of the valley and much more sky.

## How the placeholder was made

- `build/vision-valley.py` generates Neo's valley (a seeded drawing, the same every run) as
  `build/vision/valley.json` and `build/vision/valley.svg`. The SVG is a vector reference of the
  whole scene if you want to trace it.
- `build/vision/render.html` (open it through the local server, at `/build/vision/render.html`)
  paints that drawing as the five PNG layers at first light, graded brighter, and prints the
  `REACTORS` list as `window.__reactors`.
- `build/vision-layers.py` packs them into this folder.
