# Polish: Milestone, Homepage, Team, Gallery, Inclusivity and 404 on the shared layer, 25 September 2026

Branch `night/polish`, from `d994259` (after the cleanup merge). Scope: bring the
pages finished earlier in the night, before page.css settled, onto the shared
components (`.stamp`, `.filterchip`, `.fig figcaption`), check their figures,
and make captions and labels consistent with the rest of the site.

Method: headless Chrome over the DevTools protocol, waiting for
`readyState == complete` plus 4 to 5 s, at most two browsers at a time. Each
shot also checked that every stylesheet had loaded and no image was broken.
The first few shots came back unstyled. The cause was `python3 -m http.server`,
whose listen backlog of 5 drops connections when two browsers load the
image-heavy homepage together. That was the tool, not the site. I switched to a
threaded server with a larger backlog and shot again. Before and after shots
were taken at 1440 and 500 (Milestone), and at 1440 and 390 (Homepage). All five
other pages were checked for horizontal overflow at 390 and 500; none has any.
`build/audit.py`: external 0, missing 0, anchor 0, cite 0, dupid 0, alt 0,
the same as at the start.

## 1. What I changed

| Commit | What |
|---|---|
| Milestone: status words use page.css's stamp; the framework's three branches meet the stem | 67 local `.st` pills become `.stamp` and the local `.st` CSS is deleted. Mapping: Met = `stamp--closed`, Partly met = `stamp--fail` (page.css's amber "Partial"), Not met = `stamp--open` (rust), Not yet tested = plain grey `.stamp`. Long verdict stamps may wrap inside the two fixed-layout tables, because three iteration tables had been pushed past their scroller at 1440 (one of them was already overflowing before the change). The chain figure's top rule is now 1.5px (DESIGN.md's heavy weight, it was 2px) and its left edge is closed. In Figure 3 the stem now meets a horizontal rule joining all three validation boxes. Before, it touched only the middle box, so "three questions feed one body of evidence" did not show. |
| Homepage: the requirement tags are page.css's stamp and the map switch its filter chip | `.pb-tag` (a private copy of the stamp) deleted, and the 8 tags are `stamp stamp--closed`. The Climate volatility / Farm parcels buttons are `.filterchip`; only the rule that joins them into a segmented pair stays local. The toggle was checked to still switch layers. |
| Homepage: figures are numbered and captioned as on every other page; the map layers load lazily | Figure 1 to 4 on the visible figures. The circuit and timeline captions hang off the shared 1px graphite rule. The iHP timeline is still hidden as pending art, so it is left unnumbered and a comment says how to renumber when it lands. The "Schematic / Artist's impression" labels are the shared open stamp. The module cards' top rule is 1.5px (was 2px). "Module 01" is now "Module 1", as in the BioRender figure. The 8 threat-map layers and the reach atlas base load lazily (their size is declared). |
| Gallery: the nineteen captions open 'Figure n.' | |
| Homepage: the Team door no longer counts forty-seven or promises a timeline | The roster has 46 people. Milestone is no longer "the year in order". |
| Homepage: the chapter rail's comment describes the square box it now draws | comment only |

### Decision on "Not met"

The lead's map was Partly met to amber partial and Not met to fail. page.css's
`stamp--fail` *is* the amber partial stamp, so following it literally would draw
Partly met and Not met identically. I gave Not met rust (`stamp--open`) instead.
That keeps four words in four looks, and rust is the colour the page already
used for Not met. Rust means "still open" in DESIGN.md, which fits a criterion
that is not yet met. If the team wants Not met in amber and Partly met in
something else, it is four class names, and the page's `<style>` comment
records the mapping.

### Checked and left as they are

- **Team.** It was already redrawn on the drawing set: square cards, 1px rules,
  roles in words, and no pills or shadows. It has no private copy of a shared
  component. Every image has width and height, and they lazy-load.
- **Inclusivity.** It uses only shared classes (`callout--medal`, `.status`,
  `.review-note`) and has no figures. I did not touch the medal callout, which
  the ballot agent owns.
- **404.** It is on the shared layer, and its list matches the nav.
- **Homepage, kept on purpose.** The dark-act name-card chips (`.stage__spec`,
  which are stamps on ink, and page.css has no dark stamp). The green and red
  switch panels (the colour is the light, not a state). The ruled figure schedule
  (`.pb-figs`). The "01 The threat" to "03" kickers, because the reach section's
  lede cross-refers to "Section 01" and the chapter rail uses them. The chapter
  rail's round dots, which DESIGN.md allows.
- **Scroll animations.** After scrolling through at 1440 and 390, every `.rise`
  and `.pathway` has `in` and the big-picture spine has `in`. Load CLS at 1440
  is 0.0016 (the hero fields as the font settles).

## 2. Writing inconsistencies

| Where | What it says | Against | Suggested resolution |
|---|---|---|---|
| `assets/data/site-nav.js` Team tab | Milestone caption "The year in order, from the first meeting to the freeze."; Team blurb "the year in order" | `milestone/index.html` is now *From Failure to Function*, the success criteria and iterations | Shared layer: caption such as "What each stage had to do, what failed first and what we changed" |
| `team/index.html:73` (review note) | "Milestone ('The forty-seven people are named on Team')" | the rebuilt Milestone no longer says this; the homepage door no longer says 47 | the only remaining 47 is in site-nav.js if any; the note can be trimmed |
| `index.html` big-picture tile | "Data physicalisation" | page and nav name "Data Physicalization" | Use the page's own name on the tile (left: it is a proper name vs. the homepage's British spelling, the team's call) |
| `milestone/index.html` H1 | "From Failure to Function" | `<title>` and nav: "Milestone" | Left, as the lead allowed |

## 3. Strong student writing worth keeping

- **Milestone, 4.1.** "The parts share a temperature, not a chain." Seven words
  that say exactly what the incubator photograph does and does not show.
- **Milestone, 1.** "a perfect result at stage 4 tells a judge nothing about
  ReLeaf, because containment of an unswitched culture is containment of the
  wrong thing." A precise statement of why the order of the chain matters.
- **Homepage, iHP band.** "An entry with no design change attached is a
  photograph of a meeting". It sets the test the section then holds itself to.

## 4. Needs a person

- **Big-picture layout shift on phones.** At 390, scrolling through the
  big-picture section records layout shifts on the `.task` tiles, from 0.04 to
  0.2 depending on the run. The baseline before my changes showed the same
  (0.11). It is not at load, and it did not come from these edits: tile heights
  do not change as their images load. It looks like the hold/reveal behaviour in
  `big-picture-v2.js` and `.will-rise`. Worth a look with DevTools' Layout Shift
  regions on a real phone.
- **Pending art on the homepage.** `ihp-timeline.png` and the two vision renders
  have no width/height because the files do not exist yet. Add both when they
  land, and renumber the figures (the comment beside the timeline says how).
- **Gallery and Inclusivity** still show their scaffold notes and grey draft
  boxes (the rule checker counts them). This is intentional until a team member
  checks the drafts.

## 5. Requests for the shared layer

- page.css `.stamp` is `white-space: nowrap` above 48rem. A verdict phrase
  ("Apparatus yes, experiment not yet run") in a fixed-layout table cell then
  overflows. Consider `table.data .stamp { white-space: normal }` shared, or a
  `stamp--phrase` modifier. Milestone scopes this locally for now.
- A fourth stamp colour would let a page tell "partial" apart from "a named
  failure". Today both are `stamp--fail`, so Milestone had to put Not met on
  rust.
- A dark-ground stamp variant (for the homepage's dark act, and for Hardware).
- site-nav.js: the Milestone caption and the Team blurb (section 2).
