# V4 Photometer — interactive scroll showcase

A scroll-driven 3D disassembly of the V4 photometer. The complete instrument sits
at the bottom of the stage. Each scroll beat lifts one part out of it, floats it to
upper-center where it enlarges and spins beside its description, then dissolves it —
leaving the assembly one part lighter. After the last part, everything returns for a
final look at the whole instrument.

The assembly is built from the eight part STLs themselves (they share one coordinate
system), so what comes apart on screen is the real model, not a separate copy.

## Run it

```bash
python3 -m http.server 8123 --directory site
```

Then open http://localhost:8123/

## Layout

```
site/
  index.html        intro → sticky 3D stage → technical record
  css/style.css     dark lab theme, HUD, document typography, responsive
  js/parts.js       PART DATA — names, roles, descriptions, specs, poses
  js/scene.js       scroll engine + three.js renderer
  js/doc.js         contents-rail scrollspy + smooth anchors
  js/vendor/        three.js r128 + STLLoader (vendored, no CDN)
  models/           printed parts, bought-in components, light path
```

## The technical record

Everything after the 3D walkthrough is the write-up: Parts 1–4 (Materials, Methods,
Results, Discussion) in a 760px measure with a sticky contents rail.

Three conventions carry the unfinished parts, so a draft still looks deliberate:

| Element | Meaning |
|---|---|
| `<span class="pending">` | a value awaiting measurement — renders as a dashed amber chip |
| `.openitem` | an editorial note (`Needs` / `Confirm`) that must be resolved before publishing |
| `.blank-slot` | a section not yet written, labelled with its number |

Fill one in by replacing the `<span class="pending"></span>` with the value. The
author's original section numbering is preserved verbatim, including its gaps
(2.4 → 2.7, 3.2 → 3.5, 4.3 → 4.5).

## Parts and materials

Fifteen components: eight printed (grey) plus seven bought-in. A part is either a
single `file`, or a list of `layers` each with its own material — used where one
component needs more than one colour. **Layers share an origin and are centred
together**; centring them individually pulls them apart.

| Material | Used for |
|---|---|
| `printed` | the eight printed parts |
| `black` | LED bezel |
| `amber` / `clear` | LED body / its pin |
| `glass` | lens, beamsplitter, flow cuvette |
| `pcb` / `chipGrey` / `chipBlack` | sensor board and its components |

The sensor boards and LED arrive as single STLs, so `scratchpad/split_parts.py`
splits them offline — sensors by connected component (largest = board, the rest
sorted by size), the LED by radius about its axis (fat body vs thin pin).

**Glass uses `transmission`, not alpha.** Against a dark background a half-opaque
object just reads as dim grey, and because `opacity` scales specular too, it kills
the very highlights that make glass legible. Transmission keeps opacity at 1 so
the rim stays crisp; `envMapIntensity` is pushed well past the solids' and a little
emissive keeps edges visible, since a dark studio gives glass little to reflect.

## The beam

`light-path.stl` belongs to the instrument rather than to any one part, so it lives
in the rig — present in the hero, in the small assembly during the walkthrough, and
in the finale, but never lifted out on its own. It renders with `depthTest: false`
so it reads *through* the housing that encloses it.

## Order of disassembly

Set by `ORDER` in `js/parts.js`. It follows the light path, which is also roughly
top-to-bottom on the real instrument, so the assembly comes apart from the top down:

```
LED holder → focus lens → shield (short) → shield (long)
  → head shell → optical head → rail → wedge base
```

Tags (`01`…`08`) are numbered from this order automatically, so reordering the list
renumbers the walkthrough. Scroll length, handoff, HUD swapping and the progress
rail all scale from `PARTS.length`.

## Timeline

```
0 ─── HERO(1.0) ─── PART_START(1.75) ─── one beat per part ─── FINALE_START ─── end
 large assembly      shrinks & settles     lift / hold / dissolve   reassembles
```

`BEAT` (0.62) converts beats to scroll distance, so the whole piece is ~7.4
viewport-heights. All the marks derive from `PARTS.length` — nothing is hard-coded.

## Tuning

In `js/scene.js`:
- `BEAT` — viewport-heights of scroll per beat (lower = shorter scroll)
- `HERO` — how long the opening assembly holds before shrinking
- `rigScaleBase = (H * 0.35) / asmSize.y` — assembly size in its small state
- `rigY` lerp `-H * 0.235 → -H * 0.07`, scale `1 → 1.70` — small state vs large state
- `featScale = (H * 0.40) / it.span` / `featY = H * 0.23` — size and height of the
  featured part
- `TILT` / `SPIN_RATE` — shared by the assembly and every part
- beat windows in `frame()`: lift out `[-0.75, -0.30]`, on show `[-0.30, 0.08]`,
  dissolve `[0.08, 0.22]` (quick), gone after `0.22`
- spin speed: `spin += dt * 0.45` — the assembly and the featured part share this
  same rate, so nothing appears to change speed as it lifts out

**Don't let consecutive parts overlap.** A part must be fully gone by `0.22` before
the next enters at `1 - 0.75 = 0.25`. Widening the dissolve or the lift-out past
that point puts two parts on screen at once. The ~0.03-beat gap between them is
deliberate: it leaves a beat where only the assembly is visible.

Per-part orientation lives in `parts.js` as `initRot` (radians) and `spin` (axes).

**Careful with the finale window.** `finaleT` must not start before the last part
has finished dissolving (`FINALE - 0.05`), or every removed part is resurrected as
a faint ghost behind the final one.

## How the instrument stands

The base's four contact pads lie on a face whose normal is `(0.131, -0.991, 0)` —
the model is drawn leaning. `STAND` rolls it back by that angle so the pads sit
flat, and it is applied **inside** the spin (Euler order `YZX`), so the feet stay
parallel to the ground through every rotation.

Getting this wrong is very visible. Applying a tilt *after* the spin swings the
base normal between **3° and 18°** off vertical as it turns, which reads as the
whole instrument wobbling. With the correction inside the spin it measures
**0.000° at every angle**.

The 3/4 view therefore comes from raising the **camera**, never from tilting the
object — tilting the object would drag the feet back off the ground plane.

## How parts are sized and spun

**One spin.** A featured part keeps the rig's *exact* orientation, so nothing can
drift out of step. Any per-part rotation offset means the slerp has to travel that
extra angle during the lift-out, which reads as the part briefly spinning at its
own speed — the offsets that remain (`pose`, `flip`) are eased in only while a
part is lifting out, and are constant once it is on show.

**Poses.** `pose` in `parts.js` is a presentation tilt, chosen by measurement:
for each part the renderer swept candidate tilts, and for each tilt measured the
*smallest* silhouette across a full revolution. The winner is the tilt whose worst
case is largest, so a flat part never turns fully edge-on. Biggest wins were the
sample sensor (2.3× its worst-case silhouette) and the beamsplitter (2.0×).

**One size.** Parts are *not* scaled by bounding-box max — that is measured in the
unrotated pose, so projected size swings wildly once a part spins (it gave a 2.6×
spread in on-screen height). Instead `span` is the rotation-invariant silhouette
bound: since everything spins about Y, the widest a part can ever appear is either
its diameter about that axis (2 × farthest vertex in XZ) or its projected height,
both unchanged by the spin. A bounding sphere also fails here — it is set by the 3D
diagonal, which chunky parts never fully project, rendering them ~25% small.

Measured result: mean on-screen extent 39.9% of viewport height against a 40%
target, six of eight within 0.5%.

## Rendering

Lit by **image-based lighting**, not just directional lamps: a softbox studio is
painted into a canvas at runtime, prefiltered with `PMREMGenerator`, and set as
`scene.environment`. That is what gives the parts real gradients and reflections
across their surfaces. Three low-intensity lights sit on top for shape definition.

`ACESFilmicToneMapping` rolls highlights off instead of clipping them — the reason
the grey survives without washing out. Measured: mean luminance ~95 with a 16–235
range, under 1% crushed and 0% blown.

The environment's floor is deliberately **not black**. It is the only fill the
underside of a part receives; with a black floor every shadow side crushes solid.

A soft additive **pedestal glow** sits under the assembly. On a dark stage that
reads as weight far better than a cast shadow, which would need a visible floor.

## Two things that are easy to break

**Lighting exposure.** The grey washes out to white if the combined light energy on
a face exceeds ~1. Ambient is deliberately low (0.46); raising it is what turned the
parts white twice during development. Sanity check by sampling the canvas — a good
result averages around RGB 117/120/125 with no pixels near 255.

**The transparent flag.** Materials are opaque by default and only switch to
`transparent` while actually dissolving. Leaving every part permanently transparent
puts the whole assembly through the sorted transparent pass, where its overlapping
surfaces shimmer against each other — that was the "buggy" look.

## Notes

- No external requests — three.js is vendored, so this drops onto the iGEM wiki cleanly.
- Respects `prefers-reduced-motion` (disables the auto-rotation).
- `window.__photo.renderAt(p)` forces a synchronous render at any progress value,
  independent of scroll — used for automated visual checks.
- The renderer uses `preserveDrawingBuffer: true` so frames can be exported to PNG.

## Photo frames

`.frame` wraps every photo slot. Two states:

- **filled** — `<figure class="frame"><div class="frame-img"><img …></div><figcaption>…`
- **empty** — add `empty` and put the brief on the container:
  `<div class="frame-img" data-label="What this photo should show"></div>`

An empty frame renders as a labelled dashed slot, so a missing photo reads as a
deliberate placeholder rather than a hole. Drop a photo in by replacing the empty
`.frame-img` with one containing an `<img>` and removing `empty`.

Aspect is **portrait (3/4) by default**, because every real photo here is a portrait
phone shot — cropping those into a landscape box throws most of the device away.
`land` (4/3), `wide` (16/9) and `square` are available for slots expecting other
shapes, and `hero` caps a single feature photo so it does not run a screen tall.
Frames in a `.frames` grid are capped at 330px wide for the same reason.

**iGEM note:** these images are served locally for development. Before publishing,
re-upload them through the iGEM uploads tool and swap the `src` values — external
and local image sources are not allowed on the wiki.
