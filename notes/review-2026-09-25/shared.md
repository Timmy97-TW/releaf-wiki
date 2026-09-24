# Shared layer: design system and site chrome, 25 September 2026

Branch `night/shared`. Owner files: `assets/css/tokens.css`, `page.css`,
`nav.css`, `nav-dark.css`, `assets/js/nav.js`, `page.js`, `rulecheck.js`,
`review-notes.js`, `assets/data/site-nav.js`, `404.html`, `build/audit.py`,
`build/ids.py`. No page's `index.html` or page stylesheet was edited.

Method: every standard page screenshotted at 1440 and 390 (headless Chrome,
driven over the DevTools protocol so the checks could run page JS), a
horizontal-overflow check on every page at 390 (none found), nav panels opened
and shot one by one, print emulated, and each shared change re-shot on
Description, Engineering, Plants, Human Practices, Team, Protein Design,
Measurement, Results, Attribution, Gallery and the hardware hub.

## 1. What I changed

| Commit | What |
|---|---|
| Tokens: radius and shadow tokens resolve to square corners and no shadow | `--radius`, `--radius-sm` are 0 and `--shadow-*` are empty, so every page that named them is square and flat, as DESIGN.md asks |
| Page layer: callouts, tables, figures and page links drawn as the drawing set | callout = 1px rule all round in its colour on white, no 4px slab, no tint; `table.data` = revision block (no box, no filled head, graphite head and closing rules); caption hangs off a 1px graphite rule; header band flat white; prev/next in fixed columns so a lone Next sits right |
| Page layer: shared .fix, .note and .gap boxes; plain card numbers | one definition of the three editorial boxes ten pages had drawn separately; `.card2 .num` no longer a 2rem hero figure |
| Tables: wide tables say they scroll | graphite edge on the right while columns are hidden (CSS only) and a "More columns to the right" line under the table (nav.js) only while it overflows; `.tablewrap--wide` grows into the gutter at 1240px+ |
| Demo tools: one tray, bottom right | rule check and review-notes switch side by side bottom right, clear of the contents rail; lifted above hardware's palette hint; labelled in words; hidden while the phone menu is open |
| Hardware nav: the section strip sits above the bar's scrim | `.hwnav` z-index 49 to 51 |
| Review notes: styled from nav.css at first paint | no flash of unstyled note; `:root:root` selectors beat page rules like `.sec p b`; dark variant for the hardware section; links in the note's brown |
| Navigation: a ruled register of pages instead of icon tiles; captions rewritten | see section 2 of this file's chrome notes below |
| Notes: the run-length table no longer cites the homepage ledger | notes/structure.md |
| Build: ids.py | writes page.js's heading ids into the HTML (not run; see requests) |
| Page behaviour: review notes never numbered, never in the rail, never cite-linked | page.js excludes `.review-note` from the outline and the `[n]` linker |
| 404 | new `404.html`: the site's nav, "There is no page at this address", every page by tab from site-nav.js, works at any depth and under any host prefix; also a 5 KB WebP nav logo instead of the 64 KB PNG |
| Print | real print sheet in page.css; page.js opens every `<details>` before printing |
| Audit | review notes per page against its h2 count (informational) |
| Page layer: one square state stamp and one filter chip | `.stamp` (+ `--closed`, `--fail`, `--open`) and `.filterchip` for pages to adopt |
| Contents rail scrolls inside itself | long rails (Entrepreneurship: 40 entries) were unreachable past the window; page.js keeps the lit entry in view |
| Numeric heads align right, units keep their case, list defaults yield | `th.num`, `.u`, `:where(.sec)` lists |

### The nav panels (task 2)

The icons were slop and are gone. Each of 26 pages had a stroked line icon in a
pale rounded tile: a dog-eared document for Description, an upload arrow for
Contribution, a lightbulb for Entrepreneurship, a shield with a tick for
Safety, a globe for Sustainability. None showed what is on its page, and
Notebook and Dry Lab Notebook used the same one. Making 26 precise drawings
that each depict a subject would be a design job for the team, not a night's
guess, so the panel became typographic: each entry is a ruled row with the
title, a one-line caption, and, where the address is judged, the medal
criterion or award in field lettering (Silver #1, Best Measurement, and so on,
from notes/structure.md). The current page says "This page" in a stamp. The
panel lost its gradient thread and drop shadow and ends on a heavy rule.

Captions were rewritten to say what is on the page (from each page's own lede)
rather than what it hopes to do. Examples: Engineering "Every design, build,
test and learn cycle we went through" became "Six cloning cycles that moved a
four-module light circuit into the production strain"; Parts "What we built,
what we characterised, what we registered" (rule of three) became "Five
modules, each part marked against its sequencing record"; Notebook said "week
by week" but the page is "month by month". Blurbs: Dry Lab no longer names
reactor sizing (Bioreactor Calculations is deleted); Team no longer
hard-codes forty-seven.

## 2. Writing and consistency issues found (not in my files)

| Where | What it says | Against | Suggested resolution |
|---|---|---|---|
| `hardware/index.html` lede | "four instruments ... a perfusion bioreactor, an in-line photometer, a dual-wavelength LED array and a hydroponics growth plate" | nav caption said "Three instruments" (fixed); notes/structure.md "three scroll-driven 3D teardowns" | structure.md should list the hydroponics page too |
| `engineering/index.html` `<title>` | "Engineering Success" | nav, eyebrow and every link say "Engineering" | "Engineering \| ReLeaf · iGEM 2026" |
| `notebook/index.html` `<title>` | "Wet Lab Notebook" | nav says "Notebook" | either is fine; make the nav entry "Wet Lab Notebook" to match Dry Lab Notebook, or the title "Notebook" |
| `data-physicalization/listening/index.html` `<title>` | "Can you hear a plant scream?" | every other page: "Name \| ReLeaf · iGEM 2026"; a rhetorical question | "Listening to drought \| Data Physicalization · ReLeaf · iGEM 2026"; also add a meta description (it has none) |
| `geospatial-analysis/routing/index.html` `<title>` | "Taiwan: Fertilizer Corps → Farmland (all counties)" | same pattern | "Fertilizer routing \| Geospatial Analysis · ReLeaf · iGEM 2026" |
| `protein-design/index.html` page links | no Next link | nav order puts Dry Lab Notebook after Protein Design | add Next: Dry Lab Notebook |
| `drylab-notebook/index.html` page links | Previous: Peptide Design | nav order: Protein Design | Previous: Protein Design |
| `team/index.html` page links | no Previous | nav order: Data Physicalization | add Previous, or leave (Team starts its own tab) |
| Measurement, Math Model, Description prose | name "Bioreactor Calculations" | the page is deleted | page agents have left review notes; nothing for the shared layer |

## 3. Strong student writing worth keeping

- **Parts, lede.** "Five modules, and one honest word against every part in
  them." It promises a specific, checkable standard in eleven words, and the
  page then keeps it row by row.
- **Math Model, lede.** "Each parameter on this page says where it came from,
  and the ones we guessed say so in the table." A judge reading for honesty
  finds the rule stated before the equations start.
- **Measurement, section 1.** "Nothing here restates a result that belongs to
  another page." One sentence that tells a judge where the evidence lives and
  why this page is short.

## 4. Needs a person

- **Awards in the nav.** The panel now names the award judged at each address
  (from notes/structure.md, checked against the 2026 handbook there). If the
  team decides not to go for one of them, delete that entry's `award:` in
  `assets/data/site-nav.js`.
- **Page icons.** If the team wants pictures back in the panel, they should be
  drawn from the project (the reactor, the photometer, the plate), one grid and
  one stroke, and would go next to the title. The tab-rail artwork slot
  (`assets/img/tab-icons/`, `art: true`) is unchanged and still empty.
- **Callout ground.** DESIGN.md allows callouts "vellum or a very pale tinted
  ground"; seven pages had already chosen white, so white it is.
- **Reading ground.** The drawing set's stock is `#f6f6f2`; the wiki is on
  white. Not changed (palette identity).
- **Favicon.** Every page links the 64 KB 200px `logo.png` as its icon; a 32px
  PNG would do. It needs every page's `<head>` edited, so it is left.

## 5. Requests (for the lead to relay; the shared layer cannot do these)

### Run after the merges

1. `python3 build/ids.py` writes 368 heading ids into 28 pages so cross-page
   `#section` links work without JavaScript. Idempotent (second run adds 0),
   checked against page.js's own ids on all 32 pages with no mismatch.
   `python3 build/ids.py --check` lists them first.

### Delete page-local copies of what page.css now does

Each of these still wins over page.css until deleted, which is why some pages
still show a 3px coloured left edge or rounded pill:

- **Callout overrides** (`background: var(--white); border-left-width: 3px`):
  description.css, experiments.css, measurement.css, model.css, parts.css,
  results.css, protein-design/protein.css. Delete the block; page.css gives
  the white ground and a 1px rule all round.
- **`.fix` copies**: engineering.css, entrepreneurship.css, experiments.css,
  laws.css, measurement.css, model.css, parts.css, plant.css, protein.css,
  results.css, sus.css. **`.note`**: experiments.css. **`.gap`**: protein.css.
  Delete them; keep any page-specific extra (for example plant's `.fix code`).
- **`table.data` copies**: experiments, measurement, model, parts, protein,
  results, sus. Keep only genuinely page-specific column widths.
- **Rounded pills to `.stamp`**: measurement `.state`, results `.goal__state`
  and `.state`, model `.link__state` and `.prov`, parts `.st`, protein
  `.stepcard__state`. Add `stamp stamp--closed|fail|open` to the markup and
  delete the pill rule.
- **Rounded chips to `.filterchip`**: plant `.chip`, software `.chip`.
- **Contents-rail copies** (wetlab2 says four pages have one): delete; page.css
  now caps the rail and page.js follows it.

### Per-page design requests

- **Plants**: the four-cell tally (8 / 3 / 4 / 3) above "One run, end to end" is
  the hero-metric pattern the brief lists (big numbers over tiny labels); a
  sentence carries it. (Milestone's row of four has already gone.)
- **Dry Lab Notebook**: the stat row (23 weeks, 13 pipelines, 109 notebook
  pages ...) is the same; the coloured group pills are rounded.
- **Math Model, Results**: numbered squares on cards (1, 2, 3 / 2 to 8) are
  decorative numbering; the section numbers already do this job. Results'
  numbering also starts at 2.
- **Plants, Software, Human Practices**: `--max: 1440px` on the page also moves
  the hero's title block to the window edge (x = 14px at 1440) instead of the
  column everyone else's sits in. Scope it to `.pagewrap` (for example
  `.plant .pagewrap { max-width: 1440px }`) and leave the header on 1280px.
- **Engineering**: the "01" plus a small icon before "Gaps in this record" is
  an eyebrow with a meaningless number; the sheet has a numbered title block
  already.
- **Experiments**: each protocol card has a 3px green left bar (`.proto`);
  DESIGN.md's No Coloured Bar Rule. A 1px rule or the heavy top rule would do.
- **Human Practices, homepage**: 43 and 45 images without width/height, so the
  page jumps as they load (all other pages give dimensions).
- **Titles**: see section 2.

### For whoever finishes the site

- The copy for gitlab.igem.org must set `window.RULECHECK = false` and
  `window.REVIEW_NOTES = false` in `assets/data/site-nav.js` (or delete the
  notes); the demo tray then never appears.
- `404.html` works on GitHub Pages as is. On the iGEM wiki, check whether the
  host serves a custom 404; if not, the file is harmless.
