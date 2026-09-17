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
  index.html          the hub — intro, the instrument orbit, the notebook band
  css/hub.css         hub-only styling
  js/hub.js           page hand-off and the notebook reel
  js/orbit.js         the orbit's intro (tools/build_orbit.py writes its markup)
  js/deck3d.js        the live instrument models on the hub
  img/                card renders, captured from each instrument's own scene
  photometer/         Photometer — teardown + technical record
  diopal/             DiOPAL — teardown + technical record
  bioreactor/         Bioreactor — teardown + technical record
```

Each instrument folder is self-contained: its own `index.html`, `css`, `js`,
`models` and `photos`. Nothing is shared between them except the hub, so one can
be edited without touching the other.

## Colour

The hub is deliberately **neutral**; each instrument carries its own signature
colour, set once as a CSS variable and used for its deck accent, rule and hover:

| Instrument | Colour |
|---|---|
| Photometer | `--c-photometer: #ffa23d` (amber — the LED it runs on) |
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

`img/card-*` are rendered from each instrument's own three.js scene, so they
carry the same materials, environment, lighting and shadows as the page they link
to. Nothing about the look is defined twice. The bioreactor and hydroponics
posters are stored as WebP (q88, about a fifth of the PNG); the DiOPAL and
photometer PNGs are already smaller than WebP would make them. On the hub they
are posters only: each instrument in the orbit switches to its live model once
that has loaded.

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

Backgrounds stay transparent so the card's own light shows through.

## Hub orbit

"Choose an instrument" and "How they fit together" are one drawing. The
bioreactor sits at the core. The photometer rides its culture loop, which
carries the loop's stations in the order bioreactor section 2.1 draws them.
DiOPAL (upstream) and the hydroponics plate (downstream) sit on the ring outside
the loop, joined to it by the two hand-offs between instruments, drawn dashed.

`tools/build_orbit.py` writes the section's markup, and every word in it comes
from the instrument pages. Its title and the instrument names are set in
Oxanium SemiBold (`fonts/oxanium-600-latin.woff`, SIL Open Font License,
`fonts/OFL-oxanium.txt`); HARDWARE keeps Unbounded. The drawing is static SVG and pointing is CSS, so the
orbit is complete with JavaScript off. `js/orbit.js` only plays the intro and
holds the loop's flow while the orbit is off screen.

Everything on the stage is placed in its own 1440 × 800 units, so the drawing,
the models and the words stay together at every width. Pointing at an
instrument's model (not its words) lights its ring and opens its readout under
the stage, in place of the key. Below 980px the same markup stacks into one column, in the order the
culture moves, with the photometer hanging off the loop.

To change it, edit the tables at the top of the generator, then paste its output
over the section in `index.html` and restamp:

```sh
python3 tools/build_orbit.py > orbit.html && python3 tools/stamp_assets.py
```

## Packed models

Three STL sets are drawn but never offered for download: the bioreactor
walkthrough (`bioreactor/models/`), its three-channel package
(`bioreactor/package/`) and the hub cards (`img/deck3d/`). Each of those folders
ships as `_pack.json` + `_pack.bin` instead: every part's vertices quantised to
uint16 across its own bounding box (under 0.005 mm), 18 bytes a triangle against
STL's 50, in the container the hydroponics page already used.
`PackedModel.bundle(folder)` in `js/packed-loader.js` answers the scenes' existing
STL URLs from the pack, one download per folder. Zipped, the three sets went from
3.12 MiB to 1.02 MiB.

The STLs stay on disk as the source and are git-ignored. After changing any of
them, rebuild the packs, then the stamps:

```sh
python3 tools/pack_models.py && python3 tools/stamp_assets.py
```

Not packed: the photometer and DiOPAL models. Their pages offer every part as an
STL download, so those files have to ship as they are.

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

The hub carries a band under the instruments with a strip of all 21
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
4. `python3 tools/build_notebook.py` — writes `notebook/index.html`,
   `tools/_hub-band.html` and `tools/_lanes.html`, which are pasted into
   `index.html`.
5. `python3 tools/stamp_assets.py` — **run this last, and before every commit
   that touches CSS or JS.** See below.

**Watch the artifact size.** iGEM's runner rejects the artifact upload with a
bare `413 Request Entity Too Large`, and the limit is lower than it looks:
**10.59 MiB was rejected, 8.77 MiB was accepted.** Treat ~9 MiB as the working
ceiling until a larger upload is observed to pass, and compare in bytes:
8.77 MiB is about 9,196,000 B.

gitlab.igem.org publishes its limits at `https://gitlab.igem.org/help/instance_configuration` (read 15 September
2026):
- **job artifact 10 MiB**: both observations above fit this figure
- push 11 MiB
- Pages site 100 MiB

The film test (see *The hub film*) zips to 9,494,322 B (9.05 MiB), above the largest upload known to pass. If its
pipeline passes, record that as the new figure.

These are binary megabytes (1 MiB = 1,048,576 B), though they were first
written as "MB". The commit that wrote them (`2eca34d`) also recorded "8.47 MB"
for its own deploy, and re-zipping that commit with the command below gives
8,885,116 B: 8.47 MiB, where decimal would have been 8.89 MB. The two limit
figures were recorded the same way in the same commit, but no CI log has been
checked to confirm them. The size of the next accepted `artifacts.zip`, in
bytes, is the number to write here.

Measured on 13 September 2026 from the working tree: the tracked files zip to
9,107,127 B (8.69 MiB). With the uncommitted files the bioreactor card needs,
the total is 9,128,080 B (8.71 MiB). With every file the hub page references,
it is 9,382,472 B (8.95 MiB), which is above the largest upload known to pass.

Later that day the three render-only STL sets were packed (see *Packed models*)
and the twelve instrument photos and the two heavy card posters went to WebP (q80
and q88). The commit prepared for the push then zips to 6,181,286 B (5.90 MiB),
179 files.

Before adding anything large, measure it (`ls -l` prints bytes):

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

## Cache busting

Pages serves HTML and its stylesheets with the same ten-minute lifetime and no
version in the URL. For the length of that window a browser can hold new HTML
beside a stylesheet it cached before the deploy, and the page half-works: new
markup with no rules for it. It looks like a broken deploy and is not one — it
cost us an hour once already, with "Back to hardware" rendering as a bare blue
link because the cached CSS had never heard of `.backbtn`.

`tools/stamp_assets.py` appends a content hash to every local CSS and JS
reference, so updated HTML points at a URL the browser has never seen and the
two cannot be out of step. The hash is of the file's bytes, so re-running it
changes nothing unless an asset actually changed. It also stamps the hub film's
`data-src`, `data-src-small` and `poster`: a clip keeps its name when it is
re-cut, and a browser that had cached the old one went on playing it.

**Run it last**, after `build_notebook.py` — that regenerates `notebook/index.html`
and would otherwise drop its stamps:

```sh
python3 tools/build_notebook.py && python3 tools/stamp_assets.py
```

It is deliberately not wired into `.gitlab-ci.yml`; that file is left alone.

## What is not published

`dev/` sits outside `hardware/` and never reaches the artifact. The CI copies
`hardware/` wholesale, so a scratch page left inside it would be deployed
without the licence notice and repository link that judging requires on every
page. Build harnesses belong in `dev/`. See `dev/README.md`.

The STLs behind the packed model sets stay on disk but out of Git (see *Packed
models*). `dev/backups/` is git-ignored as well; `dev/backups/compress-20260913/`
holds the JPEG and PNG originals of the photos and posters that are now WebP.

## Adding to the iGEM wiki

Images here are served locally for development. Before publishing, re-upload every
photo and card render through the iGEM uploads tool and swap the `src` values —
external and local image sources are not allowed on the wiki. three.js is already
vendored locally, so no CDN is involved.

### The hub film

The hero of `index.html` plays a muted background loop rendered in Blender
(Cycles) from the CAD: the commercial bioreactor with its front panel off, then
the photometer. `js/hero-film.js` loads it lazily, pauses it off-screen, and
never loads it for reduced-motion or save-data readers. The poster is a layer
under the video, and the video fades in over it once it is actually playing.
If the file cannot load, the poster drifts slowly instead of standing still.
Both clips begin on the poster's frame, 5.5 s into the render, so nothing has to
seek: the render's own loop point falls in the middle of a fast camera move, and
starting there jolted (`dev/film/rotate_start.py`).

- `img/film/hub-film.mp4` (1280×720) and `img/film/hub-film-480.mp4` (small
  screens) are **git-ignored**: together they are far past the 10 MiB artifact
  limit, and iGEM requires video to come from
  [Video Universe](https://video.igem.org).
- **For testing only (15 Sep 2026), the page plays `img/film/hub-film-lite.mp4`.**
  - It is committed through an exception in `.gitignore` and deploys with the site.
  - It is 960×540 at about 620 kbps (3,300,755 B), cut from `hub-film.mp4` with a
    two-pass x264 encode: Lanczos scale, `-preset veryslow -b:v 622k -x264-params aq-mode=3`, `+faststart`.
  - It serves every screen, so the markup has no `data-src-small`.
  - Upscaled to 720p it measures SSIM 0.991 against `hub-film.mp4`. The 480p clip it stands in for measures 0.993.
  - With it, the artifact zips to 9,494,322 B (9.05 MiB).
  - It breaks iGEM's video rule. Before the wiki is judged, delete the file and its `.gitignore` exception, and
    point `data-src` at the Video Universe files as described below.
- To publish the film, upload `hub-film.mp4` to Video Universe. It makes the
  smaller sizes itself, and a video plays on a wiki only after its reviewers
  accept it. Once it is accepted, its public API
  (`https://video.igem.org/api/v1/videos/<id>`) lists the files under
  `streamingPlaylists[0].files`. Each `fileUrl` there is a fragmented MP4 on
  `static.igem.org` that a plain `<video>` can play. Point `data-src` at the
  largest file and `data-src-small` at the 480p one.
- `img/film/hub-film-poster.jpg` is an image: upload it with the other images.
- The Blender scripts that build and render the film live in `dev/film/`.
- The film on the page is v1 (42.5 s). A v2 cut (44 s, 13 Sep 2026) is kept, git-ignored, in
  `dev/film/work/v2-2026-09-13/clip/`; copy its three files over `img/film/` to use it instead.
