# Project tab, second overnight pass, 25 September 2026

Pages: `description/`, `engineering/`, `contribution/`, `results/`.
Branch `night/project2`. This pass is design and wayfinding, not prose. No
student paragraph was rewritten and no review note left by the first pass was
changed, moved or deleted. `python3 build/audit.py` is unchanged: 0 missing
links, 0 broken anchors on these four pages, 0 duplicate ids, 0 images without
alt. The six anchor findings in the audit are all on `model/`, which is not
mine.

Measured after every change, with a headless Chrome harness: at 390, 900 and
1440 px all four pages now have `scrollWidth == clientWidth`, that is, no
horizontal scroll at any of the three widths.

---

## 1. What I changed

| Commit | What |
|---|---|
| `c71e88e` | Engineering: the Silver criterion 1 callout at the top of sheet 01, naming cycle 3 and linking to its four steps. |
| `81362d2` | Results: the state of every stage in one component and one vocabulary, and the evidence page on every ask strip. |
| `9d1c535` | All four pages: a wide table shows which way it scrolls, and takes the keyboard. |
| `a7b3d5e` | Three throwaway measuring pages taken back out of the tree (committed by accident in the commit above). |
| `f587bf2` | Description: the nine hub cards come out three across instead of leaving an orphan. |
| `c5adb6b` | Contribution: one medal box on the page, and a warning label that names the finding instead of giving an order. |
| `6dd4bde` | Engineering: the review note on the blueprint plate gets its own ink back. |
| `e540ca1` | Engineering: the page stops scrolling sideways at every window width. |
| `59d845d` | Engineering: the cover title block keeps each field on one line. |
| `7c7ec0e` | Engineering: the six cycle chips on a phone say what they are. |
| `77d6e34` | All four pages: the shared table scroll cue replaces the four page copies (see below). |
| after merge | Engineering: the local review-note link colour removed, now that nav.css carries one. |

### Silver criterion 1 (the first thing the task asked for)

The page never used the words *Silver criterion 1* and never pointed a judge at
one complete design-build-test-learn cycle. It now carries a `.callout--medal`
as the first thing on sheet 01, which is the first reading sheet after the
cover, so a judge meets it before the list of gaps:

- it names the criterion in the label, "Silver Medal Criterion #1 · Engineering
  Success";
- it offers **cycle 3, the pGEM-T Easy intermediate**, and links to `#d3`;
- it summarises design, build, test and learn in one sentence each, taken only
  from what cycle 3 already says. No new claim, no new number;
- it carries four jump links, `#d3-d`, `#d3-b`, `#d3-t`, `#d3-l`, so a judge
  lands on the step itself. `engineering.js` already opens the owning `<details>`
  from the hash, and `page.css` sets `scroll-padding-top`, so each link lands
  clear of the fixed navigation;
- cycle 3's own step headings read Design, Build, Test and Learn in that order,
  in words, in field lettering. Nothing had to change there.

Why cycle 3 rather than another: it is the only cycle with all four steps
written, a table of expected sizes, three gels, and a learn step that states
the cost of the change ("the cost was a day") and what that day bought. Cycles
1, 2 and 4 close on a named failure, cycle 2's test and learn are unwritten,
and cycle 6 is the strongest result but its learn is about the recombination
premise rather than the loop.

The wording is deliberately flat: no "demonstrates", no "successfully". It
reports what the cycle reports.

### Results as the chain

Two things were inconsistent and both are now fixed.

1. The overview defines three states in a table, **Measured**, **Partial**,
   **Designed**, and then the seven stage cards spelled a fourth vocabulary in
   the same pill shape: "Never reached a culture", "Linearity only", "One
   plating". A judge scanning the cards read those as state names. Each card
   now shows the state word in the same `.state` chip the rest of the page
   uses, with the gap phrase beside it in plain small caps. Same component,
   same word, everywhere.
2. The ask strip under each stage heading carried the question only, although
   the stylesheet comment said it carried "the state of the answer" too. Every
   ask strip now carries **State** (the shared chip) and **Evidence**, which
   links to the page that holds the evidence for that stage. The links were
   taken from that section's own prose, nothing new:
   stress signal → Math Model, Software, Geospatial Analysis; construct
   assembly → Parts, Engineering; light delivery → Hardware · DiOPAL; culture
   monitoring → Hardware · photometer, Software; protectant function → Plants;
   whole system → Hardware · bioreactor; containment → Hardware · bioreactor,
   Safety.

A reader landing mid-page now gets the stage's claim and the route to its
evidence without scrolling back to the overview.

### Tables that are wider than the page, and what happened to that change

Every table on these four pages was already inside a scrolling wrap, so the
page never widened, but nothing said the table continued. On a phone a table
simply looked cut off. I gave all 20 wraps an edge bar and a focus stop, in the
four page stylesheets, because `.tablewrap` is shared and not mine.

Then the shared layer landed the same idea in `page.css` and `nav.js` tonight,
and its version is better: `nav.js` adds the focus stop, a role, an accessible
name and a line of words under the table ("More columns to the right. Scroll
the table sideways.") only while the table actually overflows, and takes them
off again when it does not. My hardcoded `tabindex="0"` was in its way, because
the script skips a wrap that already carries one, so those twenty wraps would
have kept a tab stop and never got a name.

So after merging `main` I took my whole change back out: the four local
background rules, the twenty `tabindex` attributes, and
`contribution/contribution.css`, which held nothing else.
`contribution/index.html` is back to the three shared stylesheets and a plain
`<body>`. Verified afterwards on Engineering at 390 px: the shared edge and the
shared line of words both appear, and the page still has no horizontal scroll.

### The sideways scroll on Engineering

The first pass reported Engineering as 9 px wider than a 390 px frame and put
it down to the scrollbar. It was three separate faults and they showed at every
width, not only on a phone:

1. every breakout is sized against `100vw`, which includes a classic scrollbar.
   `engineering.js` now measures the scrollbar once and on resize into `--sbw`,
   and the three breakout widths and the cover scrim subtract it. With scripts
   off the fallback is `0px`, which is what an overlay scrollbar is worth;
2. a `.wide` block nested inside a cycle body came out as wide as the sheet but
   started at the cycle's indent, so it hung past the right edge by the indent.
   Nested breakouts are now full width of what holds them;
3. `.record` was a grid with an auto track, and an auto track grows to the
   widest unbreakable string inside it, which took the whole cycles column past
   the sheet at tablet widths. It is `minmax(0, 1fr)` now.

At 900 px the page was 41 px wider than the viewport before this. It is 0 now.

### Mechanical fixes logged

- `contribution/index.html`: `body` gains `class="contrib"` so the page's own
  stylesheet can be scoped; one callout demoted from `--medal` to the plain
  callout; one callout label reworded from an instruction to a finding.
- `engineering/index.html`: the four cover title-block fields each wrapped in a
  `div` inside the `dl` (valid HTML) so a field name cannot be separated from
  its value.
- `tabindex="0"` added to 20 `.tablewrap` divs across the four pages.
- Stylesheet and script version query strings bumped so a cached page does not
  show old CSS.

Nothing in anyone's prose was touched on this pass.

---

## 2. Writing inconsistencies

The first pass tabulated these thoroughly in `project.md` and I found nothing
it had missed. Two of its entries are now partly addressed and should not be
double-counted:

| Where | What it says | What the other place says | Suggested resolution |
|---|---|---|---|
| `engineering/index.html` sheet 02 review note | "Name the medal criterion here." | The criterion is now named on sheet 01 with a link to cycle 3. | Keep the note until a person confirms cycle 3 is the cycle the team wants to offer, then delete the sentence. |
| `engineering/index.html` sheet 01 review note | "put one line at the top of this sheet pointing at cycle 3" | Done as a medal callout rather than a line of prose. | Same: a person confirms, then the sentence goes. |
| `results/index.html:116` | "One stage out of seven is fully closed by measurement" | Seven cards follow, numbered 2 to 8, in a page whose rail numbers nine sections. | Still open. It is prose, so I left it; the first pass already flagged it. |
| `contribution/index.html:232` | label was "Do not copy these without reading the fix boxes" | Every other callout label on the wiki is a noun phrase. | Fixed: the label now reads "Three protocols carry an uncorrected error" and the instruction stays in the sentence. |

---

## 3. Strong student writing worth keeping

The first pass listed the best of it and I agree with all of it. Three more,
all noticed while reading for layout rather than for content:

- **Engineering, sheet 03, the chromophore paragraph.** The explanation of why
  CcaS is blind until `ho1` and `pcyA` have built its chromophore is the
  clearest piece of mechanism writing on the wiki. It is written as cause and
  effect, one clause at a time, and it never reaches for an adjective.
- **Engineering, cycle 3 learn.** "The cost was a day." Four words that make an
  engineering trade-off legible to somebody who has never held a pipette. This
  is the sentence that makes cycle 3 the right one to offer for Silver 1.
- **Results, Light delivery.** "The array has never run a CcaS/CcaR experiment
  on a live culture." The project's central premise is left unproven in the
  plainest sentence available, in the middle of the page rather than at the
  end of it.

---

## 4. Needs a person

1. **Confirm cycle 3 as the Silver 1 cycle.** I chose it on the evidence on the
   page. Cycle 6 has the stronger result; cycle 3 has the complete loop. If the
   team prefers cycle 6, change the four jump links and the sentence in the
   callout on `engineering/index.html`, nothing else.
2. **The three heavy photographs stay as they are.** `farm-visit.webp` is 306 KB
   and re-encoding it at quality 82 saved nothing at all, so the file is already
   near its floor for that amount of foliage detail. `bioreactor-running.webp`
   saved 10 per cent and `light-plate-assembled.webp` 11 per cent, which is not
   worth re-encoding a photograph for. If somebody wants them smaller, the
   honest route is a smaller pixel size, and that is a judgement about what the
   photograph has to show.
3. **The assembly ladder on Engineering sheet 04 has no figure number and no
   caption**, while the other 47 figures on the page have both. Numbering it
   would renumber every figure after it, which is a change a person should
   decide to make. Its own review note already asks for a provenance line.
4. Everything the first pass left in its own "Needs a person" list is still
   open. In particular the eight empty Registry entries, which are the one
   thing standing between this wiki and Bronze criterion 3.

---

## 5. Requests for the shared layer

Merged `main` at `fb220b8` before these final checks. Three of the four things
I was going to ask for are already there, so only one request is left.

1. **A scrollbar-width custom property in the shared layer.** I added `--sbw` in
   `engineering.js`, measured once and on resize, because that page's breakouts
   are sized against `100vw` and `100vw` includes a classic scrollbar. Any page
   that breaks out of its column has the same bug: `page.css` itself does it at
   line 496 (`.tablewrap--wide`) and line 856 (`.fig--wide`), both
   `calc(100vw - 24rem)`. Two lines in `nav.js` setting `--sbw` on the root, and
   `- var(--sbw, 0px)` in those two rules, would cover the whole wiki.

Already delivered tonight by the shared pass, and my local versions removed:
the table scroll cue and its focus stop in `page.css` and `nav.js`; the review
note's own link colour in `nav.css`. The one review-note override I kept is
Engineering sheet 04, where the blueprint plate's paragraph colour outranks
`:root:root .review-note p` and the note would otherwise be pale on pale; that
is a page fact, not a shared one.
