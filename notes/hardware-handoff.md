# Handoff — GEMS-Taiwan Hardware

Everything you need to pick this up cold, and to fold it into the iGEM wiki.

---

## 1. What this is

A standalone static site documenting the hardware built for RELEAF. It is
**not yet part of the wiki** — it is a self-contained site that needs
integrating.

```
hardware/
  index.html      hub — intro, three instrument cards, how they relate
  css/polish.css  shared finish layer, loaded by all four pages
  js/polish.js    shared interaction layer, loaded by all four pages
  js/hero-fx.js   the hub's constellation canvas
  photometer/     V4 in-line photometer: 3D teardown + technical record
  diopal/         DiOPAL dual-wavelength LED array: same
  bioreactor/     perfusion bioreactor: 3D hero + record + part picker
```

Each instrument page is a scroll-driven 3D teardown built from the **real STL
files**, followed by a long-form technical record.

## 2. Run it

No build step, no dependencies. It is plain HTML/CSS/JS.

```bash
cd "iGEM Hardware Wiki Page"
python3 -m http.server 8130 --directory hardware
```

Open <http://localhost:8130/>. It **must** be served over HTTP — opening
`index.html` from the filesystem fails, because the STL loader is blocked by
CORS on `file://`.

## 3. How the 3D works

`three.js r128` is **vendored** in each instrument's `js/vendor/` — no CDN, which
is what iGEM requires.

The important idea: **the assembly on screen is built from the individual part
STLs**, not from a separate merged model. The parts share one coordinate system,
so stacking them reproduces the instrument exactly. Take a part away and the
assembly is genuinely one part lighter.

| File | What it holds |
|---|---|
| `js/parts.js` | all the part data — names, roles, copy, specs, order, materials |
| `js/scene.js` | the scroll engine and renderer |
| `js/doc.js` | technical-record scrollspy (and DiOPAL's I² chart) |
| `bioreactor/js/picker.js` | raycast part picker, wired to the BOM |

Anything shared lives once, at `hardware/js/` or `hardware/css/`, and every page
loads it from there. Do not copy these back into an instrument folder — they
were duplicated before and drifted:

| Shared file | What it holds |
|---|---|
| `js/vendor/three.min.js`, `STLLoader.js` | the only copies; all four 3D pages use them |
| `js/toc.js` | builds the section map under each record header |
| `js/figures.js` | figure/table numbering, cross-references, lightbox |
| `js/chrome.js` | topbar behaviour and page hand-off |
| `js/polish.js` | reveals, marker sweeps, scrollspy, sortable BOM, counters, jump palette |
| `js/hero-fx.js` | the hub's constellation canvas |
| `css/polish.css` | selection/focus/scrollbar, grain, print styles, palette |
| `js/chrome.js` | topbar behaviour and page hand-off |

To change wording, part order, or which parts appear, you almost always only
need `parts.js`. `ORDER` controls the sequence and the numbering follows it.

## 4. What is unfinished

Both technical records use three conventions so a draft still looks deliberate:

| Element | Meaning |
|---|---|
| `<span class="pending">` | a value awaiting measurement — dashed chip |
| `.openitem` | a `Needs` / `Confirm` note to resolve before publishing |
| `.blank-slot` | a section not yet written |
| `.frame.empty` | a photo slot, labelled with what it should show |

**There are 150 pending chips across the three records** — 51 photometer,
73 DiOPAL, 26 bioreactor. Filling one in is just replacing the
`<span class="pending"></span>` with the value. Grep for `pending` to find them.

There are also **16 empty photo slots** (6 photometer, 4 DiOPAL, 6 bioreactor),
each labelled with what it should show. Grep for `frame empty`.

Known gaps, largest first:

- **Photometer**: fouling has never been measured — a 0.2 mm channel over a
  seven-day run is the biggest hole in the validation. Also no thermal
  characterisation, and the calibration equation and R²/RMSE are unfilled.
- **DiOPAL**: measured peak wavelength and FWHM for both channels, exact LED
  part numbers, MOSFET part, PWM duty cycles per tier.
- **Photometer §3.1 and §3.6** are empty sections.

### Inconsistencies in the source documents — decide before publishing

These are contradictions in the write-ups, left as-is rather than silently
"fixed":

- Accuracy: **8%** (§2.1, §3.5.1) vs **7.7%** (§2.4.1) for the same 0.431/0.467 pair.
- Tilt: the doc says **10°**, but the CAD's ground-contact face measures **8.1°**
  (the 3D model stands on the measured value).

The point-count and run-length figures are **not** contradictions, though they look
like it. The dashboard photos are snapshots of one continuous run at different
moments — 291 points at 1 d 6 h, 1244 at 7 d 21 h, 1401 at 8 d 23 h, 1442 at
9 d 6 h, 1574 at 10 d 4 h, 2132 at 14 d 0 h. So §4.5's "1244 across roughly eight
days" and §3.5's "2500 points over 400 hours" are both true, just taken at
different times. Each divides out to roughly the stated 10-minute interval.

One number *was* changed on instruction: DiOPAL's Green High group read
`2.50, 2.50`, which appear nowhere in the raw 20-LED measurements. They are now
`2.40, 2.40`, which do appear and make the three groups a clean ascending
partition. The I² chart reconciles: 12 matched + 8 rejected per wavelength, zero
values unaccounted for.

## 5. Getting it onto the iGEM wiki

The wiki lives at **<https://gitlab.igem.org/neo-su/practice-wiki>** — a Flask +
Frozen-Flask app deployed by GitLab CI. `.gitlab-ci.yml` runs
`flask freeze`, which writes static output to `public/` and publishes it.

Structure there:

```
app.py              routes; renders wiki/pages/<name>.html
wiki/layout.html    the shared shell every page extends
wiki/pages/*.html   one file per wiki page
static/             CSS, JS, images
```

**`wiki/pages/hardware.html` already exists** as the stock iGEM stub. That is
where this belongs.

### The integration decision

These pages are full-viewport, sticky-canvas experiences with their own CSS
reset and chrome. They do **not** sit comfortably inside `layout.html`, which
wraps content in the wiki's nav and container.

Two workable routes:

1. **Full-bleed pages** (recommended). Give the hardware pages a layout block
   that suppresses the wiki container, or a second minimal layout. Keeps one
   navigation and one URL space.
2. **Iframe** the hub from `hardware.html`. Fastest, but you lose shared
   navigation and deep links, and it complicates the judges' experience.

Either way:

- Move `hardware/`'s CSS/JS/models/photos under `static/` and update the paths.
- Keep three.js vendored. **Do not** switch to a CDN — external scripts are not
  allowed.
- Do not change `LICENSE` or the footer's license notice and repository link.
  Both are required on every page for judging.

### Images

Everything under `photos/` and `img/` is served locally for development.
**Before publishing, re-upload every image through the iGEM uploads tool and
swap the `src` values.** Local and external image sources are not permitted on
the wiki.

Photos are JPEG, long edge 1400px — already sized for upload.

## 5b. What these pages do that the strong wikis don't

Worth knowing so nobody strips it out as decoration. Each of these was chosen
against a survey of Cambridge 2024, both Heidelberg years, Thessaloniki 2023,
JU Krakow 2024, UBC-Vancouver 2024, TUDarmstadt 2025, Cornell 2025 and
Rochester 2023:

- **Downloadable CAD per part.** Not one of those pages publishes the CAD for
  the parts it shows, even where the text says the design is open-source. Every
  printed part here offers its STL from the walkthrough. Bought-in and
  procedural components deliberately do not — a stand-in mesh for an LED or a
  PCB is not something anyone should fabricate.
- **A working 3D teardown.** UBC shipped an 842 KB three.js viewer pointed at a
  PNG; nobody else has one at all.
- **Numbered figures and tables** with cross-references resolved at load, so
  the prose never hard-codes a number an edit could falsify. Cambridge's
  hardware page has 86 images and no figure numbers.
- **A lightbox.** No 2024 page surveyed had any way to enlarge a dense figure.
- **A section map** under each header, which is also the only table of contents
  below 1100px. Heidelberg 2024 dropped the mobile TOC its 2023 site had, and
  it was the most-noted regression.
- **Skip link, `<main>` landmark, clean heading outline, reduced-motion
  support.** None of the surveyed wikis has these.

Still open as differentiators nobody has taken: R² and fit equations on the
calibration curve, error bars, a single zipped documentation bundle (BOM +
STLs + firmware + manual), and a downloadable BOM as CSV.

## 6. Things that will bite you

Each of these was found the hard way; they are all commented in the source.

- **Reveal-on-scroll specificity.** `html.js .reveal` (0,2,1) outweighs
  `.reveal.in` (0,2,0). Both rules must carry the guard or everything below the
  hero is invisible. There is also a 1.6s failsafe that shows content
  regardless — do not remove it.
- **Never hide `<body>` behind an animation.** Only the *exit* is animated. If
  an entry animation is interrupted the whole page stays blank.
- **Consecutive parts must not overlap.** A part is fully gone by beat `0.22`
  and the next starts at `0.25`. Widening either window puts two parts on screen.
- **The finale must not start early** or every removed part returns as a faint
  ghost.
- **Standing.** The photometer's base pads sit on a face whose normal is
  `(0.131, -0.991, 0)` — the model is drawn leaning. The correction is applied
  *inside* the spin (Euler `YZX`) so the feet stay flat. Tilting after the spin
  swings the base 3°–18° off vertical and reads as a wobble. The 3/4 view comes
  from raising the **camera**.
- **Part sizing** uses a rotation-invariant silhouette bound, not bounding-box
  max (2.6× spread) and not a bounding sphere (chunky parts render ~25% small).
- **Glass uses `transmission`, not alpha.** Alpha scales specular and kills the
  highlights that make glass legible on a dark background.
- **Lighting exposure.** Total light energy must stay under ~1 or the grey
  washes out to white. Sanity check by sampling the canvas: a good result
  averages around RGB 117/120/125 with nothing near 255.
- **DiOPAL is Z-up**, the photometer is Y-up. `Z_UP_CAD` rolls the geometry at
  load so one engine serves both.
- **Never hide content behind an animation that might not run.** This has now
  bitten twice: once with the reveal classes, once with the count-up figures
  zeroing their own text before `requestAnimationFrame` was known to fire. Both
  now write the real value on a timer regardless. Any new effect that hides or
  blanks something needs the same failsafe.
- **The bioreactor's part picker restores the *recorded* resting emissive**, not
  black — the glass and LED materials already carry one, so assuming black
  would quietly brighten them after the first hover.
- **Highlight pulses must be reset every frame, not added.** `setPower()` in the
  promo scene always rewrites `emissiveIntensity` from its base for this reason;
  an early version only reset non-zero materials and accumulated to white.

## 7. Open decisions

- **The bioreactor** is a placeholder card. `hardware/README.md` documents how
  to add it.
- **Photometer §3.6 was retitled.** It and §3.5 both read "Continuous Growth
  Curve (B. subtilis 168, …)" despite being different experiments — §3.5 is the
  completed ~400 h record, §3.6 a planned 11-point calibration series. §3.6 is
  now "Growth-Curve Calibration Series", taken from its own prose. Change it
  back if the team prefers their original wording.
- **Photometer §3.1 has an empty heading** as well as an empty body. The section
  map skips empty headings rather than showing a blank bullet, but it still
  needs writing.

### Closed since the first draft

- DiOPAL now **rocks ±42°** rather than revolving, so its flat plates never
  present edge-on. Every part holds 73–100% of its best silhouette across the
  whole range.
- **Iteration heading levels are aligned.** Both records now place their
  iteration entries exactly one level below their parent section.

## 8. Source material

Working files, not needed to run the site but useful for rebuilding:

- `V4-photometer/` — original STLs, my renders, `PARTS.md` (part identification
  with confidence levels, confirmed with the team)
- `LPA/` — original DiOPAL export

Original write-ups came from `Photometer (1).pdf`, `Hardware Wiki Writing.pdf`,
`LPA (1).pdf` and `Hardware Wiki Writing (1).pdf`.
