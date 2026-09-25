# Contrast pass, 25 September 2026

Branch `night/contrast`. Started after `0788cb4` (the Engineering cover subtitle,
where `.eng .sheet p` outranked `.eng .cover__sub` and printed body grey on the
dark photograph). The question: did tonight's move from page-local CSS to the
shared layer leave more text coloured for one ground while it sits on the other?

Short answer: not many. The scan found no second cascade slip of the Engineering
kind in tonight's shared-layer work. It found two links coloured for white paper
on dark grounds, one layout bug that put text on top of text, and three places where
a grey that `tokens.css` keeps for rules only ("never words") was used for words.
All of these are fixed. Everything else below 4.5:1 is either a deliberate dimmed
or moving state, or a colour choice that is already on the designer list.

## 1. Method

A scanner drives headless Chrome over the DevTools protocol (Python,
`websocket-client`, Pillow; scripts in the session scratch folder,
`contrast-scratch/scan.py` + `collect.js`). The HTTP cache is off, so every run
reads the files as they are on disk.

- **Pages:** all 41 `index.html` except `md-simulations/*` and `education/website/**`,
  plus `404.html`. The hardware hub and its five subpages are included. Each page
  was scanned at **1440 and 500 px** wide (900 px tall viewport).
- **Loading:** the page loads, then it is scrolled top to bottom once so that
  lazy images load and scroll-reveal effects fire. After that it is read one viewport at a time, in steps of 640 px.
- **Text:** in each viewport, every non-empty text node (SVG `<text>` included)
  is grouped by its parent element. An element is skipped when it:
  - is hidden, or has an effective opacity under 0.15;
  - is visually hidden (clipped to nothing, or 1 px);
  - is clipped away by an `overflow` ancestor;
  - is covered by an unrelated opaque or fixed layer at the centre of its line box;
  - sits under the fixed nav bars plus 72 px (the hardware pages draw a dark fade under their bars).

  `.review-note` and the `.demo-tools` tray are excluded.
- **Colour:** computed `color`, or `fill` for SVG text. The alpha is multiplied by
  every ancestor's opacity and then composited on the ground.
- **Ground: measured, not inferred.** The same viewport is screenshotted a second time
  with a style that makes all text transparent: colour, text fill, shadows and
  decoration lines, with transitions frozen. The pixels inside each text run's line
  boxes are then sampled. The median is the ground; the 10th and 90th luminance
  percentiles give a worst case over photographs. So photographs, gradients,
  pseudo-element scrims and WebGL canvases count as they are drawn. The
  ancestor-walk background colour is recorded next to it, for diagnosis.
- **Threshold:** WCAG ratio below 4.5:1, or below 3:1 for large text
  (24 px and up, or 18.66 px and up at weight 700). Results are grouped by page,
  selector and colour.
- **Check on the known case:** with the pre-`0788cb4` `engineering.css` put back,
  the scanner reports `div.cover__body > p.cover__sub` at **1.84:1** (text
  #3a4841 on a measured ground of #0a1c14). With the fix in place it passes.
- **Second pass, every `<details>` open**, on all pages: no new failures.
  **Open menus** (the desktop dropdown and the mobile burger, on Plants, DiOPAL
  and the homepage): no failures.
- **Totals:** 88,601 text runs measured; 595 below threshold, which group into
  103 page/selector groups.

Limits:

- Tab panels hidden by JS, the lightbox, and hover and focus states were not scanned.
- `::marker` and `::before`/`::after` generated text are not text nodes, so they
  are invisible to the scan. A grep for the rules-only greys used as a text colour
  covered that gap and found the Experiments markers.
- Firefox and Safari were not run.
- One run of the homepage came back with `home-problem.css` unapplied. That happened
  with two Chromes on one Python server. Its findings (black SVG text, a 105,802 px
  tall page) did not reproduce in three later runs and are left out.

## 2. What I fixed

Each fix was checked twice: by measuring again with the same scanner (the
before and after numbers are in the table) and by a headless screenshot at both widths.
`build/audit.py`'s summary is unchanged.

| Commit | Page | What was wrong | Before | After |
|---|---|---|---:|---:|
| `82be6c3` | Homepage, `#system` | "read the full technical record" in the lede took the page-wide link colour (leaf-700) on the near-black stage. The section already had three dark-ground overrides (heading, kicker, lede); the link had none. `.beat--parts .beat__copy .lede a { color: white }` (white rather than leaf-200 so it stays distinct from the lede) | 2.95 | 19.8 |
| `5723c6e` | Bioreactor hero | The (5.2) link inside `.intro .lede` matched no hardware link rule: browser-default blue (#0000ee) on #05060a. Added `.intro .lede a` to the prose-link rule in `hardware/css/polish.css` (light ink with an amber underline, like every other link in the prose) | 2.11 | 17.7 |
| `e094e7d` | Hydroponics, 390 to 1100 px | The page never got the `@media (max-width: 1100px)` block the other three instrument pages have. The sticky contents rail was squeezed into a 34 px grid column and lettered over the header, the status line and the body text. Same three lines as DiOPAL, Photometer and Bioreactor | 1.36 (text on text) | rail hidden, section map is the contents |
| `6069e1a` | Math Model | Equation numbers (1)-(6) in `--gray-400` | 2.52 | 5.33 |
| `3c71e58` | Protein Design (6 pages) and Peptide Design | The PROTEIN DESIGN link at the head of the pipeline strip in `--gray-400` | 2.52 | 5.33 |
| `7c5d39f` | Experiments | Protocol index list markers in `--gray-400` (not visible to the scan; found by grep) | 2.52 | 5.33 |

`tokens.css` says `--gray-400` is "rules and strokes only, never words". The three
grey fixes move to `--gray-500`, the label grey, and leave the brand colours alone.
Cache tags were bumped on every page whose stylesheet changed.

**Hardware (for Anton):** `notes/hardware-upstream-2026-09-25-contrast.patch`,
with paths relative to `hardware/`. It was checked with `git apply --check`
against `hardware/` as it stood before this pass, so it applies on top of the
fixes-only patch. `notes/hardware-handoff.md` now points to it.

## 3. Findings not fixed

### 3a. States that are dim or moving on purpose (JS-driven; not a cascade slip)

These are real low readings, but they come from a scroll position or an animation
state. The fix would be in the JavaScript or the design, not a selector.

| Page | Where | Reading | Why it happens | Suggestion |
|---|---|---:|---|---|
| Engineering (1440) | contents rail, "01 · Gaps", "02 · Claims" | 1.5-2.4 | The rail shows as soon as the cover leaves the observer band, while the cover's dark strip is still under the top items. The rail is in light-ground ink (`on-plate` is off). Also "08"/"09" at 2.7 on the top edge of the assembly plate | Widen the `QUIET` window in `engineering.js` until the cover is fully past the rail, or test `on-plate` per item |
| Homepage (1440) | chapter rail label while scrolling ("On a farm", "The people") | 2.0 | `onInk()` reads the ground at the rail's centre, but the label rides out to its left over a photograph or the other ground. The white or dark text-shadow halo keeps it legible in practice | Test the label's own box, or give `.is-moving [aria-current] span` its own ground |
| Homepage | stage slogan, gloss, "Designed for the eight needs", `.turn--2` | 1.3-3.4 | Mid-fade at a scroll-driven opacity (0.15-0.45). They settle at full contrast | none |
| Homepage | journey timeline, inactive year posts `.jr-post` | 1.6 | Deliberate 0.45 opacity for years not yet reached | Designer: 0.6 would clear 3:1 on that green |
| Bioreactor (1440) | system walk steps not current (`.syswalk-step`, 0.3 opacity) and Fig 1 labels (0.42) | 1.0-2.0 | The scrollytelling dims every step but the current one | Designer: dimmed steps near 1.6:1 are unreadable if the reader wants to scan ahead; 0.55 would give about 3:1 |
| Hardware pages | "Jump to /" pill at rest over the dark hero (0.55 opacity) | 2.3 | Idle state; it brightens on hover and focus | Designer |
| Drylab Notebook | empty week label "W01" (0.5 opacity) | 2.0 | Deliberately faded: nobody photographed that week | Designer; the hatch already says "empty" |

### 3b. Long-standing low contrast (report only; brand or designer colours)

Most of these are already on the designer list in `notes/overnight-2026-09-23.md`,
item 10. Nothing here was recoloured.

| Page | Text | Reading | Note |
|---|---|---:|---|
| Homepage | module chips "Module 4" amber, "Module 2" teal, "Module 3" blue on white | 2.98 / 3.25 / 4.45 | Item 10: module colours |
| Human Practices | white on the mid-green `kap__seg--2` ("33.9%") | 3.32 | Item 10 |
| Measurement | chart key "14 Aug run 1" in leaf-500 | 3.32 | Series colour used as legend text |
| Protein Design (6 pages), Peptide Design | pipeline letters G R A F T in leaf-500; the Packaging middot in `--gray-300` | 3.32 / 1.48 | The letter is a mnemonic next to the word, which carries the meaning. The middot is a placeholder glyph |
| Data Physicalization, listening page | its own greys (#a8a69c, #888780) and card colours | 2.2-3.9 | Item 10: "keeps its own low-contrast greys" |
| Pages with a photo hero (Plants, Milestone, Description, Education, HP, Geospatial, Peptide, Drylab) | eyebrow "/" separator at 0.45 white; eyebrow text on the Plants and Milestone photos | 2.4-4.1; 4.2-4.4 | The separator is decoration. The eyebrow text is a near-miss over bright patches of those two photographs. A slightly heavier scrim on `.pagehead__hero` would clear it |
| Engineering | assembly ladder overhang pairs "AGAG - ACAT" (`lad-col--syn`, 8.5 px) | 4.49 | Near-miss, and very small type |
| Drylab Notebook (500) | week-jump numbers and months on the grey rail | 4.1-4.35 | Near-miss |
| Hardware hub | section strip (PHOTOMETER, DIOPAL, ...) over the background film | 2.97 (worst 2.2) | The strip has no ground of its own over the video. Anton's call |
| Photometer, Bioreactor | "Open" / "confirm" state tags on their tinted fields | 2.9-4.2 | Tag ink #556070 at 0.95 on a tint |
| Hardware instrument pages | onward-card arrows "→" at 0.7 opacity in the instrument colours | 1.2-1.8 | A glyph, not words; the card title carries the link |
| Hardware instrument pages | credits line, loader text, the "Pump failure" event label, the amber `ann` in the notebook lede | 3.7-4.4 | Near-misses |
| Geospatial routing tool | Leaflet attribution link; disabled panel button (0.5) | 3.38 / 4.46 | Leaflet default; disabled state |

### 3c. Scanner false alarms, noted so nobody chases them

- Text that scrolls under the hardware pages' dark fade below the sticky bars read as
  dark on dark until the scanner learned to ignore the band under fixed bars.
- Photo-count badges in the Drylab Notebook strip read as white on white while they
  were scrolled out of their `overflow` box. Once clipping was modelled they pass
  (6.3-9.4:1).

## 4. Needs a person

- The Engineering rail and the homepage chapter rail (3a) need a small JS change to
  their ground test. That is outside this pass, which was limited to stylesheets.
- Designer decisions on the dimmed scrollytelling states on Bioreactor and the
  homepage journey. They are intentional, but at 1.6:1 they are not readable, and a
  judge scanning ahead will try to read them.
- The hardware hub strip over the film, and everything else in 3b.

## 5. Requests for the shared layer

None needed: the one shared-file change (`assets/css/home.css`, a homepage-only
sheet) is a single selector next to the three overrides that already existed.
