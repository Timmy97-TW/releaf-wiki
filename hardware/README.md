# GEMS-Taiwan — Hardware

A single site covering every instrument built for RELEAF. The hub introduces them;
each instrument has its own page with a scroll-driven 3D teardown and a technical
record.

## Run it

```bash
python3 -m http.server 8130 --directory hardware
```

Then open http://localhost:8130/

## Layout

```
hardware/
  index.html          the hub — intro, instrument decks, how they relate
  css/hub.css         hub-only styling
  js/hub.js           reveal-on-scroll
  img/                card renders, captured from each instrument's own scene
  photometer/         V4 Photometer — teardown + technical record
  diopal/             DiOPAL — teardown + technical record
  (bioreactor/)       to come
```

Each instrument folder is self-contained: its own `index.html`, `css`, `js`,
`models` and `photos`. Nothing is shared between them except the hub, so one can
be edited without touching the other.

## Colour

The hub is deliberately **neutral**; each instrument carries its own signature
colour, set once as a CSS variable and used for its deck accent, rule and hover:

| Instrument | Colour |
|---|---|
| V4 Photometer | `--c-photometer: #ffa23d` (amber — the LED it runs on) |
| DiOPAL | `--c-diopal: #3ddc8b` (green — the wavelength that induces) |
| Bioreactor | `--c-reactor: #5aa9ff` (reserved) |

Each instrument page keeps that colour as its own `--amber` accent, so clicking a
deck lands you somewhere that feels like the card you came from.

## Adding the bioreactor

1. Copy either instrument folder as `bioreactor/` and swap the models and part data.
2. In `index.html`, replace the `.deck.soon` placeholder with a real `<a class="deck deck-c" href="bioreactor/index.html">`.
3. Capture a card render (see below) and drop it in `img/`.
4. The relationship map at the bottom already names it.

## Hub card images

`img/card-*.png` are rendered from each instrument's own three.js scene, so they
carry the same materials, environment, lighting and shadows as the page they link
to. Nothing about the look is defined twice.

Each scene exposes what the renderer needs on its QA hook — `__photo.scene` /
`.camera` / `.renderer` on the photometer and DiOPAL, and `__bioHero.scene` on
the bioreactor. With the site served, a tool attaches its own camera to the
scene, frames the assembled model, renders at 2400×1800 with a transparent
background, and posts the PNG out of the browser. The bioreactor's renderer has
no `preserveDrawingBuffer`, so its shot goes through a private renderer that
copies the page's encoding and tone mapping.

All three are shot at the same house angle — azimuth 0.72 rad, elevation 0.30 —
which is what makes them read as one set rather than three screenshots.

They are then composed onto a common 1600×1200 canvas: **4:3, matching
`.deck-media`'s aspect-ratio**, so `object-fit: contain` scales all three
identically. Getting this wrong is what made the old cards look unprofessional —
they were 900×900 and 1100×845 in a 4:3 box, so each letterboxed by a different
amount and none of them sat on the card's floor line.

Sizing is normalised by the geometric mean of bounding-box area and covered
(alpha) area. Bounding box alone leaves the bioreactor looking small, since it is
mostly thin tubing in a large box; covered area alone shrinks DiOPAL, which is a
dense solid block. Models are centred horizontally and stand on a shared baseline
at 87% height, where `.deck-media::after` draws its floor line.

Backgrounds stay transparent so the deck's coloured glow shows through.

## Hardware notebook

`notebook/` is the team's week-by-week hardware notebook, 23 March to 13 August
2026: 31 entries over 62 pages.

**The pages are shown as the team designed them** — cream stock, dark green
header band, gold annotations — rendered straight from their deck. They are
deliberately *not* re-typeset into the site's dark theme. The layout is part of
the record, and rebuilding it would quietly change what the record says.

What the site adds is the reading. A PDF viewer paginates: you click, a page
replaces the one before it, and in 62 pages you lose your place. Here the pages
are stacked as plain `<img>` in document order and scroll continuously, with a
sticky index rail that jumps by week and tracks where you are. With JavaScript
off the whole notebook still scrolls and the index still jumps; the script only
adds the progress bar and the highlight.

The hub carries a band under the three instrument cards with a strip of all 21
weeks, coloured by instrument, so the shape of the project is visible before
anything is clicked. Every cell deep-links to the page that week starts on.

### Regenerating

Source of truth is the deck. To rebuild after the team edits it:

1. Strip the blank template slides (the deck ships with five unfilled layout
   slides that must not be published).
2. Export to PDF, then rasterise: `120 dpi`, palette PNG, 96 colours, into
   `notebook/pages/pNN.png`. That combination was chosen by measurement — the
   pages are flat art, so a palette PNG is both smaller and sharper than JPEG
   or WebP at the same size, and 1020px matches the 1000px display width
   almost exactly.
3. `python3 tools/parse_notebook.py <unpacked-deck>` — reads entry metadata
   (week, dates, instrument mark, title) out of the slide XML by layout
   position, since the shapes carry no semantic names.
4. `python3 tools/build_notebook.py` — writes `notebook/index.html` and
   `tools/_hub-band.html`, which is pasted into `index.html`.

**Watch the artifact size.** iGEM's runner rejects the artifact upload with a
bare `413 Request Entity Too Large`, and the limit is lower than it looks:
**10.59 MB was rejected, 8.77 MB was accepted.** Treat ~9 MB as the working
ceiling until a larger upload is observed to pass. The deploy currently zips to
**8.47 MB**.

Before adding anything large, measure it:

```sh
rm -rf /tmp/art && mkdir -p /tmp/art/public
git ls-files -z hardware | while IFS= read -r -d '' f; do
  d="/tmp/art/public/${f#hardware/}"; mkdir -p "$(dirname "$d")"; cp "$f" "$d"
done
(cd /tmp/art && zip -qr a.zip public && ls -l a.zip)
```

The 98 photo slots in the notebook are still empty. Once real photographs go in,
palette PNG stops being the right format for those pages — switch them to JPEG
or WebP, which handle photographs far better, and re-measure.

## Adding to the iGEM wiki

Images here are served locally for development. Before publishing, re-upload every
photo and card render through the iGEM uploads tool and swap the `src` values —
external and local image sources are not allowed on the wiki. three.js is already
vendored locally, so no CDN is involved.
