# Cleanup: page stylesheets onto the shared layer, 25 September 2026

Branch `night/cleanup`. Scope: section 5 of `shared.md` ("Delete page-local
copies", "Per-page design requests"), the titles in its section 2, and QA's
items 1 to 4 in `qa.md`. Edits to page HTML are limited to class attributes,
`<title>`/meta, one pagenav link, img width/height, and four duplicate inline
rail scripts.

Method: every change was checked before and after at 1440 and 500 px in
headless Chrome over the DevTools protocol. For each component the script
recorded the computed border, radius, background, padding, margin and font of
the first matches and saved a clipped screenshot of each (scratch
`cleanup-scratch/b/` and `a/`). Homepage images were compared box by box at
390, 500, 1000 and 1440. Final pass: no horizontal overflow at 390 or 1440 on
the 18 pages touched; `build/audit.py` 0 missing, 0 anchor, 0 dupid, 0 alt,
0 external.

## 1. What I changed

| Commit | What |
|---|---|
| Description: the callout is drawn by page.css | local 3px-edge callout override deleted |
| Description: the nine page cards lose their pale green left bar | hub cards 1px graphite, leaf on hover |
| Wet lab pages: the contents rail is page.css's | rail CSS copies and the inline rail-follow script deleted on Experiments, Measurement, Parts, Plants (page.css/page.js do both) |
| Wet lab pages: units in capitals and numeric heads come from page.css | `.u` and `th.num` copies deleted on the same four |
| Measurement: the state words use page.css's stamp | 29 `.state` spans become `.stamp` |
| Results: stamps, flat cards and page.css's boxes | 35 pills become stamps; 3px bars off cards, ask strips, ledger, captions; `.fix`, callout, `table.data` copies deleted; number squares hidden |
| Math Model: provenance and model states are stamps | 43 pills become stamps; the old rules and the later "drawing-set alignment" override block collapsed into one set; number squares hidden |
| Parts: status words use page.css's stamp | 88 `.st` become `.stamp`; status column 11.5 to 13.5rem and the stamp wraps (QA item 1) |
| Protein Design: one set of box rules for the section | `.gap`, `.fix`, callouts, captions, `table.data` are page.css's; step states are stamps; alignment block collapsed |
| Engineering: boxes, captions and quotes drop their 3px coloured bars | QA item 2; `.fix` copy deleted |
| Entrepreneurship, Laws, Sustainability: the .fix box and tables are page.css's | three identical `.fix` copies, Sustainability's `table.data` copy |
| Sustainability: the four goal states use page.css's stamp | |
| Results, Math Model: the claims ledger is drawn as Sustainability draws it | one ledger look on three pages (hairline box, 1.5px coloured top edge) |
| Software: page.css's stamp, outlined provenance tags, square code, no dead chips | QA items 3-4; the page-wide `.stamp` redefinition deleted; `.pv` tags outlined, not tinted; dead `.chip`, `.aside`, `.story` rules removed |
| Software: Pending stays apart from 'not before' | corrected the first mapping to keep the page's own split |
| Plants: page.css's stamp and filter chip | page-wide `.stamp` and `.chip` deleted; buttons get `filterchip` (`chip` kept as the JS hook); fixed an invisible stamp in the selected matrix cell (white on page.css's white stamp ground) |
| Human Practices: the stamps are page.css's | page-wide `.stamp` redefinition deleted |
| MD Simulations: callouts are page.css's | inline vellum callout override deleted |
| Homepage: 42 images declare their size | width/height from the files; four home.css rules get `height: auto`; all 72 boxes identical before and after |
| Plants: the four counts are a ruled schedule | the tally is drawn exactly as Software's (DESIGN.md ruled tally) |
| Titles | Engineering, Listening (plus a meta description), Routing |
| Members: a Previous link to Data Physicalization | |
| Engineering: each module opens on a 1.5px rule | was a 3px coloured top slab |

### How state words were mapped to stamps

page.css has three coloured stamps (closed leaf, fail amber, open rust) plus
the plain grey stamp. I kept each page's words and, where possible, its
colours, and used one rule across pages so the same kind of state looks the
same everywhere:

| Kind of state | Stamp | Pages and words |
|---|---|---|
| done, measured, read back | `stamp--closed` | Run, Measured, Closed, Adopted, Calibrated, Permitted now, Sequence-confirmed, Written, Ours / Fitted |
| partial, observed but short of the claim, a named failure | `stamp--fail` (amber) | Partly run, Partial, Partly adopted, 4 trials, Inconclusive, Retrospective, Unsuccessful |
| still open, only designed, ruled out for now | `stamp--open` (rust) | Design only, Designed (Results), Open, Framework, Assembled (under way), Unmeasured, Void twice, Not before DT-7 |
| not started, queued | plain `.stamp` (grey) | Queued, Pending, After DT-n, Planned |
| states the shared stamp has no colour for | page-scoped modifier of the same shape | Math Model `stamp--lit` (slate, from a paper) and `stamp--assumed` (amber); Parts `stamp--designed`, `--cloned`, `--pcr` |

The lead's rule of thumb put "partly" under open. I put partial states under
`fail` instead, because that is page.css's own documented example
(`stamp--fail` = Partial, `stamp--open` = Design only), it keeps the amber
those pages already used, and it keeps "partly run" and "design only" apart
on Measurement and Results. Colours that did change: Parts Unsuccessful (rust
to amber) and Assembled (amber to rust), to match DESIGN.md (amber = a named
failure, rust = still open) and Engineering; Protein Design Framework (amber
to rust); slate "not started" words to grey; Engineering's `.fix` (rust to
page.css's amber).

## 2. Writing inconsistencies

| Where | What it says | Against | Suggested resolution |
|---|---|---|---|
| `description/index.html`, "How to read this page" callout | "Bioreactor Calculations the transport arithmetic" | the page was deleted tonight | reword or relocate; flag for p1fix / page owner |
| `human-practices/index.html` open items | "(Bioreactor calculations)" | same | same |
| `engineering/index.html:116` title block | "Drawing: Engineering Success · wet lab" | `<title>` and nav now say "Engineering" | fine as the rubric name; change only if the team wants one name |
| `plant/index.html` result matrix | stamp "n = 1 per arm" renders "N = 1 PER ARM" | Software keeps `<i>n</i>` lowercase inside its stamp | wrap the n in `<i>` (needs a text edit, left) |

## 3. Strong student writing worth keeping

- **Parts, status ladder.** "This is the only word on the page that means
  somebody read the DNA back." One sentence defines the page's strongest
  word and rules out every weaker reading of it.
- **Results, overview.** "One stage out of seven is fully closed by
  measurement." It leads with the unflattering count, which is what makes the
  rest of the page credible.
- **Plants, pipeline.** "The dates change and the treatment changes; the
  shape does not." A plain promise that the eight sets are comparable.

## 4. Needs a person

- **Wide pages' header (not done).** The request was to scope Plants',
  Software's and Human Practices' `--max: 1440px` to `.pagewrap` so the title
  sits where other pages' titles sit. Measured at 1440: on those pages the H1
  and the contents rail both start at x = 32, on other pages at x = 112.
  Scoping would move the H1 to 112 while that page's own rail and body stay
  at 32, an 80px mismatch inside the page. I left it; if the team prefers
  site-wide title position over in-page alignment, it is one line per
  stylesheet.
- **Protein Design and Dry Lab Notebook prev/next (left as is).** The chain is
  already consistent and reciprocal as a walk through the section: Software,
  Protein Design, Generate, Restraints, Assembly, MD Simulations (Flex),
  Triage, Packaging, Peptide Design, Dry Lab Notebook, Integrated Human
  Practices. Protein Design's Next is Generate (the section's first step), not
  missing. Pointing it at Dry Lab Notebook would skip the eight section pages;
  changing Dry Lab Notebook's Previous to Protein Design would break
  Peptide Design's Next. Decide if the nav order should list the steps.
- **Engineering sheet marks.** The review asked to drop the "01" and icon
  before "Gaps in this record". Every one of the nine sheets carries the same
  mark (01 to 09, each with its own icon), and DESIGN.md defines a sheet
  number component, so removing only the first would be inconsistent and
  removing all is a design decision on the page DESIGN.md is built from. Left.
- **Milestone H1** stays "From Failure to Function" as the lead allowed.
- **Number squares.** Results (2 to 8) and Math Model (1 to 3) card numbers
  are hidden with `display: none`; the `goal__no` / `link__no` spans are still
  in the markup and can be deleted when nobody else is editing those lines.
- **Listening page H1** is still the rhetorical question "Can you hear a
  plant scream?". It is a ported page left unchanged on purpose (its own
  comment); only the `<title>` and meta description changed.
- **Parts `stamp--pcr` is slate**, which DESIGN.md reserves for borrowed
  work. Kept because it was the page's colour for "checked but not read";
  a darker graphite would free slate.
- **Dead CSS left in place**: Software `.rail`, `.ledger`, `.matrix__out`,
  `.window` code styles for features not on the page (software.js still has
  handlers for them), and Human Practices' `.keyfacts` rules (no keyfacts on
  that page). Safe to delete if those features are not coming back.
- **Homepage** was not otherwise touched (its circles and glows are part of its
  own illustrative design), apart from `height: auto` on four image rules.

## 5. Requests for the shared layer

- page.css `.stamp` could accept an inline `<i>` for a symbol (Software sets
  `.sw .stamp i { text-transform: none }`); a shared `.stamp i` rule would let
  Plants' "n = 1 per arm" and any "n = 2" read correctly everywhere.
- A shared ledger component (`.ledger` with `__yes` / `__no`): Results, Math
  Model and Sustainability now draw it identically from three copies.
- A shared ruled tally (`.keyfacts`): Plants and Software now draw it
  identically from two copies.
