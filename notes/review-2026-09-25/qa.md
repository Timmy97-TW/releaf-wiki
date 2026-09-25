# QA: post-merge regression hunt, 25 September 2026

Branch `night/qa`. Merged main twice during the pass (fb220b8, then 43fa3e5), so
the final checks ran on the combined site.

## What I checked

For all 43 pages (every `index.html` except the md-simulations reports and
education/website, the six hardware pages, and `404.html`) I loaded the page in
headless Chrome over the DevTools protocol, waited for load plus 4 s, and ran
one script that reports:

- horizontal overflow (any element past the viewport that is not inside a
  scrolling or clipping box), at 1440, 500 and 390 px
- `#site-nav` built, contents rail entries, review-note count
- duplicate ids at runtime
- every `<img>` src checked against disk, and broken images
- review notes inside `figure`, `table`, `p`, `summary`, `li`, hidden panels or the rail
- any element with a corner radius, a box shadow, or a 3px+ left border with no
  other border (the drawing set forbids all three)
- every fixed element and its box; separately, a scroll through the whole page
  at 1440 and 390 checking whether the demo tray covers any other fixed or
  sticky control
- classes used in markup that no stylesheet mentions, and (from git) every
  class whose CSS rule was deleted since 24 September that the markup still uses

Plus 1440x7000 and 500x6000 screenshots of every page, viewed as contact
sheets, with anything suspicious cropped and re-shot at 900 px tall.

Results after the final merge:

| Check | Result |
|---|---|
| Overflow at 390 / 500 / 1440 | none on any page |
| Nav built | every page except the two standalone ports (below) |
| Duplicate ids at runtime | none (there were 150+ before fb220b8, heading id = its section id; fixed by the shared layer) |
| Review notes misplaced | none |
| Missing images | only the homepage's three `data-art` slots (intentional: home.js shows the drawn fallback until the art exists) and the routing tool's OpenStreetMap tiles (known, flagged by the rule check) |
| Classes that lost their CSS tonight but are still in markup | only name-only hooks: `door--*` (homepage), `sec--g2/4/10/15` (Sustainability), `lr` (Laws). Nothing lost its styling. |
| `build/audit.py` | 0 missing, 0 anchor, 0 dupid, 0 alt, 0 external |

## What I changed

| Commit | What |
|---|---|
| Dry Lab Notebook: week labels no longer run into the next row; the card and badges drawn flat and square | In the compact board (every laptop width) each month line spilled into the next week's label and "30 May" wrapped onto two lines. The compact rail drops the month line (the date names it) and keeps the date on one line. The pinned card lost its drop shadow and 4px coloured left slab (now a graphite rule with a 2px pipeline-colour top); the stuck rail, count badges, legend bars and key caps lost shadows and radii. Before `qa-scratch/z1.png`, after `qa-scratch/shots/after-drylab-notebook.png`. |
| Hardware: the film's Pause button sits above the demo tray instead of under it | On the hardware hub the rule-check button covered the top half of the hero's Pause button at every width (tray 805-836, Pause 820-864 at 900 px tall). While the tray exists Pause moves up to 7rem; the gitlab copy has no tray and is unchanged. Before `qa-scratch/z2.png`, after `qa-scratch/z3.png`. |
| Peptide Design: the cassette part chips, filter chips and tags square off | Inline stylesheet still rounded `.pd-part`, `.pd-chip`, `.pd-tag`, `.pd-res__bar`. |

## For other owners

Page stylesheets are now the cleanup agent's; the shared files are the shared agent's.

1. **Parts, status column (parts.css, cleanup agent).** In `table.parts-tbl` the
   stamp "Sequence-confirmed L1" is wider than the fixed 11.5rem third column,
   so it runs into the Function text with no gap (`qa-scratch/z4.png`, every
   module table). Fix: `.parts table.parts-tbl td:nth-child(3), th:nth-child(3) { width: 13.5rem; }`
   or let `.parts table.parts-tbl .st` wrap (`white-space: normal`).
2. **Engineering (engineering.css, cleanup agent).** Coloured 3px left bars still
   drawn on `figcaption` and `blockquote` (computed `3px rgb(79,156,111)`),
   from engineering.css lines 312, 372, 638, 724, 807, 850, 877. The No Coloured
   Bar Rule wants a 1px graphite rule.
3. **Results (results.css, cleanup agent).** `span.state` and `span.goal__state`
   are 100px-radius pills (results.css:291); `figcaption` has a 3px amber left
   bar (results.css:63, 110, 147). Should be `.stamp` and a 1px rule.
4. **Software (software.css, cleanup agent).** Inline `code` has a 3px radius.
   Also note the page runs at `--max: 1440px` and 88ch on purpose (comment in
   software.css), so it is wider than every other white page; that is a
   decision, not a bug, but it is the one page that does not line up with the rest.
5. **Demo tray (nav.css, shared agent).** At 390 px on the hardware hub the tray
   sits over the hero's "SCROLL" cue (centre bottom). Harmless, but the cue is
   unreadable while the tray is there. The tray could sit at `bottom: 12px` on
   the hub at phone widths, since the palette hint it lifts clear of is hidden
   below 500 px.
6. **Site logo (nav.css, shared agent).** `img.sitenav__logo` is the only rounded
   (50%) and shadowed (1px ring via box-shadow) element on every white page. It
   is a round badge image, so this may be deliberate; if not, drop the radius
   and use `outline` for the ring.
7. **Standalone ports (lead to decide).** `data-physicalization/listening/` and
   `geospatial-analysis/routing/` have no site nav, no tray, and their own
   rounded, shadowed UI (listening: `.hero-stats` 14px, `.featured` 12px, pills,
   a 42px glow on `#sim-track`). They are ported tools, so I left them; if they
   are meant to feel like the wiki they need their own pass.
8. **Hardware pages.** Radii (3-12px) and glows across the hardware sub-pages
   are the separate dark design system and were left alone.

## Needs a person

- Whether the two standalone ports above should get the wiki chrome.
- `software/` width decision (item 4).
