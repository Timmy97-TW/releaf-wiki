# Wet Lab cluster, second pass of 25 September 2026 (design and browsing)

Pages: `experiments/`, `parts/`, `plant/`, `measurement/`, `safety-and-security/`,
`notebook/`. Branch `night/wetlab2`. This pass is about design and the browsing
experience. The first pass (`wetlab.md`) did the prose review and the review notes;
nothing here repeats it, and no review note or student paragraph was changed.

**This branch assumes `night/shared` is merged.** The shared agent moved the callout,
the `.fix` / `.note` boxes, the revision-block table and the figure caption into
`page.css` (1px rule on all four sides, square corners, no tinted slab). My pages
used to carry their own copies of those rules, which would have overridden the shared
ones; I deleted the copies so the shared versions apply. Merged without `night/shared`,
the fix boxes on Experiments, Parts, Plants and Measurement would be unstyled. All
checks were made against a local overlay of `night/shared`'s `tokens.css`, `page.css`
and `nav.js` over this branch.

## 1. What I changed

| Commit | What it did |
|---|---|
| `Measurement: one square state stamp in the key, the index table and every block` | State had been drawn three ways (bold coloured words, coloured table text where "Partly run" wrapped, a rounded pill plus a 3px coloured bar down every block). Now one component: the drawing set's stamp, the word in a 1px box with a filled square before it. The block bar is a 1px graphite rule. Pump table: a unit in every numeric head, figures right-aligned. Loop pressure table: split into flow and pressure columns per run under a two-row head (values unchanged; it used to give the unit only in its first cell). Plate photos: width and height added, and a 3:2 frame matching the photographs instead of a 4:3 frame that cropped their sides. The ordered list in the chlorophyll method no longer runs into the paragraph after it. |
| `Experiments: units keep their case in capitalised labels...` | The sub-heads and column heads are uppercase, which printed "Reaction, 20 µL" as "20 ΜL" (megalitres) and "mM" as "MM". 16 units wrapped in `<span class="u">` that keeps their case. Fix labels split: "To fix · E8" stays a label, the sentence follows in bold sentence case, as Measurement already did (fixes "NaCl", "nm", "mL" in five labels). Protocol 3px green bar is now a 1px graphite rule. |
| `Parts: square status stamps, unclipped unit maps, and readable grey labels` | Status pills become the same square stamp (an empty square for Designed). Unit maps were sized with `max-height: 100%` in an auto-height grid cell, so Figure 3 overflowed and lost its part labels; images now fill and are contained in the frame. "Basic/Composite", "no number yet" and the build-record dash were grey-400 (2.5:1, a rule colour); now grey-500. Fix labels split as above. |
| `Plants: stamps, chips and key figures drawn as the rest of the wet lab pages` | Stamps get the square; filter chips are square boxes, not pills. The key figures had a real glitch: page.css `.sec ul` and `.sec li + li` outranked `.keyfacts`, so the grey grid showed as a slab down the first cell and a bar over the others. Now scoped, ruled cells with the number at subheading size (a tally, not a hero row). Grey-barred notes are boxed; 3px top bars on timing cards, prototypes and the matrix detail are 1.5px. Standalone figures had `width:auto`, which collapsed every lazy image to nothing until it loaded (layout shift down the whole page); now full width, height from attributes, contained within 70vh. One photo declared 1200x900 for a 1200x1600 file. Numbered captions follow the template, `<b>Figure n.</b>` then the caption, instead of bolding the whole title. Chart axis titles keep NaCl and mm in case. "Not run" in the matrix is readable grey. The growth-system tab list gets `aria-label`, focusable panels and `type="button"`; the stage rail answers Home and End as well as the arrows. |
| `Wet Lab: the long contents rails scroll inside the window...` | Experiments' contents rail is 800px tall and sticky; on a laptop its last entries were unreachable while reading. On the four long pages the rail is capped to the window and scrolls on its own, and a short inline script keeps the highlighted entry in view (scrolls the rail only). |
| `Wet Lab: three heavy photographs resized...` | Measurement's two day-6 plate photos 1600 to 1200px wide at high quality (236 to 118 KB, 188 to 82 KB), no crop or tone change, attributes updated. Plants' biosafety-cabinet photo 1200x2131 to 901x1600 (266 to 139 KB). Everything else was already WebP at about twice its displayed size; re-encoding again would have saved a few KB per file at a quality cost, so I left it. |
| `Wet Lab: the numeric column head rule moved into the page stylesheets...` | Fix for my own shell mistake in the previous commit (it wrote three stray files with spaces in their names). Numeric heads (`th.num`) right-aligned on Experiments, Measurement and Parts. |
| `Notes: ...` | This file. |

Checked after the changes: contents rail entries and section numbering identical to
main on all six pages; review note counts identical (6, 10, 6, 5, 8, 12); figure numbers
unchanged; no horizontal scroll at 500px on any page; `build/audit.py` identical to
the baseline (anchor 6 and filename 2 are pre-existing and not on my pages).

## 2. Writing inconsistencies

Only the ones this pass turned up; the first pass's table stands.

| Where | What it says | Other place | Suggested resolution |
|---|---|---|---|
| `plant/index.html` fix labels | "Fix 1" ... "Fix 13" | Experiments, Parts and Measurement use "To fix · E1", "To fix · P1", "To fix · M1" | I kept "Fix N" because other pages cite "Plants, fix 7". If the team wants one form, "To fix · 7" still reads as fix 7. |
| `measurement/index.html` pump table note | "19: 288 ml/min" | Every other flow on the page is "mL/min" | It is a quotation from the docx, so left as is; worth a "[sic]" or silent correction by the team. |
| Unit case, all four long pages | Uppercase labels had turned µL, mM, mm, nm, mL/min, NaCl, bp into ΜL, MM, MM, NM, ML/MIN, NACL, BP | | Fixed with `.u`; new labels with units need the same wrapper, or the shared layer should stop uppercasing labels that carry units. |

## 3. Strong student writing worth keeping

- **Measurement, pressure and flow meter**: "The pressure side of those two days
  failed, and the failure is worth more than the numbers would have been." It then
  proves it with a factor of five at the same dial. The loop table is now split into
  flow and pressure columns so a judge can see that factor without reading the cells twice.
- **Plants, loading a plate**: "Twelve appears nowhere except in the prose." A team
  auditing its own wiki against its own raw files, in eight words.

## 4. Needs a person

- **Provenance lines.** DESIGN.md asks every caption to end with what was done to the
  file ("Scaled only."). No caption on these pages has one. I did not add them, because
  I cannot confirm what was done to files I did not make. The three I resized in this
  pass were scaled and re-encoded only.
- **Cropped evidence in rows.** Plants' two-up rows (`.figs`) crop every photograph to
  4:3 with `object-fit: cover`, including the contaminated plates of 17 June. The full
  image is one click away in the lightbox, but a judge may read a cropped plate as a
  cropped figure. Consider `contain` for rows that show plates.
- **Measurement's tables are held to the 68ch column** and the state table wraps its
  "Anchored to" cells to four lines. `night/shared` adds `.tablewrap--wide`, which lets
  a table grow into the gutter; I did not apply it because it depends on that merge
  and the page's layout was deliberately narrow.
- **Experiments diagrams** carry large empty margins inside the image files (for
  example Figure 4, restriction digestion), so they sit small in their frames. Trimming
  the white margin is a crop; it is harmless on a BioRender diagram, but it is the
  team's call.
- The Safety page still shows an empty risk table (header row only) under "How we
  assessed risk"; it is part of the scaffold the first pass left, and needs the
  safety officer.

## 5. Requests for the shared layer

1. **Contents rail height.** `.toc` is sticky with no max-height, so any page with more
   than about 25 entries loses its last ones below the fold. I added
   `max-height: calc(100vh - var(--nav-h) - 2 * var(--sp-5)); overflow-y: auto` in four
   page stylesheets, and an inline script on four pages that scrolls the rail to keep
   `.is-active` visible. Both belong in `page.css` and in `spy()` in `page.js`; then
   delete the four `CONTENTS` blocks and the four inline scripts.
2. **`table.data th.num { text-align: right; }`** in `page.css`: `td.num` is right-aligned
   but its head is not, so every numeric head sits over the wrong edge. Added in three
   page stylesheets for now.
3. **A `.u` class in `page.css`** (`text-transform: none`) for units inside uppercase
   labels, and a line in DESIGN.md saying so. The same bug will exist on any page with
   a capitalised head that contains µL, mM or mm (Results, Model and Hardware are worth
   a search).
4. **A shared `.stamp`.** Engineering, Plants, Measurement, Parts and Results each draw
   their own. Plants, Measurement and Parts now match Engineering's shape (1px
   currentColor box, 0.5em filled square, square corners, field lettering); one
   definition with state modifiers would let the pages drop theirs.
5. **The `.sec ul` / `.sec li + li` specificity trap.** Any page list styled with one
   class (`.keyfacts` on Plants was the case) is overridden by page.css's indent and
   item margin. Either lower those to `:where(.sec) ul` or document it.
