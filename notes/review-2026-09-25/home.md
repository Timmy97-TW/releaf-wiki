# Homepage review, 25 September 2026 (overnight, cluster "home")

Files touched: `index.html`, `assets/css/home.css`, `assets/css/home-problem.css`,
`assets/css/big-picture-v2.css`, `assets/js/home.js`, and new WebP copies in
`assets/img/home/` and `assets/img/bigpicture/`. Nothing outside those.

Checked at 1440x900, 1280x800 and 390x844 in headless Chrome, with and
without JavaScript, and by tabbing through the page. `python3 build/audit.py`
is no worse than before on any count, and `index.html` has left the
"Leftovers to clear" table (its two TODO comments were the only entries).

## 1. What I changed

| Commit | What |
|---|---|
| `3a0a1c4` | Images: a 1920px WebP of the hero (471 KB; a 1440px laptop was fetching the 784 KB 2400px file), WebP copies of the closing photograph (641 KB to 387 KB) and the hand-drawn wordmark (96 KB to 29 KB), and the farmers tile re-encoded (158 KB to 42 KB). Scaled and re-encoded only. |
| `c60d72d` | One drawing-set language for the whole page: square corners (scoped `--radius: 0` on `<main>`), hairline boxes, no drop shadows, no frosted glass, no hover lift. Requirement pills become stamps; the numbered pills before 01/02/03 become the ordinary kicker with the number in front; the Brazil badge is plain text; the pass/fail discs become words ("Speed · fails"); one kicker style and one h2/lede size in every section; module cards lose the monospace eyebrow; the green/red switch panels are bordered callouts; product properties lose their 01-05 counters; the doors lose per-tab colours (one was purple), photo masks, hover zoom and the stroked icon in front of every page name. The Dry Lab door now lists the nav's pages (Protein Design, not Peptide Design + MD Simulations) and the Human Practices door is called Engagement, as in the nav. The invisible chapters rail no longer takes Tab focus. The iHP photographs fill their cards (a `<figure>`'s default 40px margins were shrinking them). **Title block under the hero:** one sentence saying what ReLeaf is (from the Description abstract), team, village, and links to Description, Results and Engineering. Also "fiber" is "fibre" throughout the homepage (it had four of each; the page is otherwise British). |
| `b42821b` | Headings and captions: "ReLEAF" to "ReLeaf"; "What a farm would actually receive" loses "actually"; the vision, map and contents headings say what the section claims; tile labels and alt text corrected against the sub-pages (see section 2); species names in tile labels italic; the two TODO comments renamed PENDING ART (the art is still tracked by `data-art`, which audit.py reports separately). |
| `fd4a6b3` | Phone: vision schematic labels no longer collide at 390px; the bioreactor heading no longer has the fading name card reading through it. |
| `a37d86f` | A "Skip the two animations, to the bioreactor" link at the head of section 03 (the journey plus the dark act are about eight screens of scroll with little text). |
| `cbdf8cb` | Fourteen review notes, one at the end of each section. The big-picture note sits at the end of the map section because the trunk runs on into the map. |
| `431f184` | Big-picture tile frames square. |
| `b3d91ea` | Focus ring in signal green on the dark grounds (leaf-700 on ink was under 3:1). |
| `16482de` | The four threat figures as a ruled schedule rather than a hero-metric row. Same numbers and words. |
| `866ae0e` | The 14px glyph in front of each big-picture tile name is hidden (one CSS line brings it back). |

Kept on purpose: the photographs, the team's BioRender figure, the QGIS map
and its layers, the big-picture cut-outs, the journey illustration, the nine
pathway pictograms in the dark act (they carry the chain on a phone where the
labels are hidden), the drawn ring around the product model (the soft blue glow
disc behind it is gone), and all student body prose.

## 2. Writing inconsistencies

Checked every number and dated fact on the homepage against the page it
summarises. "Fixed" means I changed a caption or alt text (allowed); everything
else is flagged here and in the review note of that section.

| Homepage | What it says | Other page | What that says | Suggested resolution |
|---|---|---|---|---|
| `index.html:153` | 97% of mapped farmland in parcels under 2 ha; 99.8% in the most volatile band | `geospatial-analysis/index.html:253-255` | "more than 80% of farmers work small-scale farms… less than 9% of agricultural land"; no 97% or 99.8% anywhere | Put the 97%/99.8% calculation and method on Geospatial, or use Geospatial's figures |
| `index.html:1948` (legend) | Class breaks 0.49, 0.60, 0.71, 0.82 | `geospatial-analysis/index.html:501, 317` | Only the 0.38 to 0.93 range and the 0.71 break are stated | Add the five bands as a table on Geospatial |
| `index.html:1906` | Two most volatile bands = "first 15%"; a quarter of small-farm land reaches every farm at 0.71 or harder | none | Not on any sub-page | Add the band-by-band share table to Geospatial |
| `index.html:158` | "damages rice at grain filling" | `geospatial-analysis/index.html:241` | "grain-setting" | One term |
| `index.html:319` | "Between 34% and 46% of flash droughts" | `geospatial-analysis/index.html:288-290` | "nearly half now developing inside a single five-day window" | One wording, same source |
| `index.html:319-326` | Pivot Bio 2008/2011/2019; EU admits four organism groups; registration 1-3 / 2-3 / 7-9 years; 18 inoculants, 44% pathogens | none | Only on the homepage (refs 4-10) | Carry them on Description 2.2 or Entrepreneurship with the same refs |
| `index.html:72` | "By the Datun Stream in Tamsui · Chen's farm" | `human-practices/index.html:593` | "Ms. Chen Hui-wen's (陳惠雯) Happy Farm in Tamsui" | One place name |
| `index.html:1105` | Farm visit "moved dosing off a wall clock and onto soil-moisture state" | `human-practices/index.html:593-598` | The recorded outcome is "act when stress is forecast, at the seedling stage, and then stop", plus a seed exchange | Make the card match the HP page |
| `index.html:1129` | Yes Health visit "sent the hardware team back to the CAD the same afternoon" | `plant/index.html:1028` | "sent the dry lab back to the hardware drawings the same day" | One wording |
| `index.html:2303` and `assets/data/site-nav.js:104` | "Forty-seven of us" | `assets/data/roster.js` | 46 people | Count and fix whichever is wrong |
| `index.html:1782` (tile alt) | 434 h, 2 671 readings | `hardware/index.html:108`, `hardware/photometer/index.html:888`; `hardware/index.html:387` | 336 h / 2132 points; "nineteen-day run" | Results itself flags this (`results/index.html:725`); the homepage agrees with Software and Results. Settle one figure |
| `index.html:1777` (tile alt) | "117 reads and 61 clones", own ABIF reader | none | Not on any sub-page | Add to Engineering or Software, or cut from the alt |
| `index.html:1840` (tile alt) | "BAPHIQ has not answered" | `laws-and-regulations/`, `entrepreneurship/index.html:745` | BAPHIQ appears only as a risk | Record the request on Laws, or cut |
| `index.html:1662` (tile alt) | Agar boxes, salt and heat, 5 July 2026 | `experiments/index.html:1616` | Plant salt/heat sets dated from 25 July | Check the photo date |
| `index.html:1705` (tile alt) | BoPep4 aligned "against the eight Arabidopsis Peps" | `peptide-design/index.html:16` | "a seventeen-row alignment" | One description |
| `index.html:1846` (tile) | Permeate transport model | `model/index.html:610-611` | "Membrane transport: On Bioreactor Calculations" (deleted page) | Move the evidence or drop the tile and change "Twenty-nine" |
| `index.html:937` | 500 mL reservoir | `milestone/index.html:617` | "a 300 mL medium reservoir" | Correct Milestone (Hardware says 500 mL vessel, 300 mL working) |
| `index.html:914-918` | OD600 0.8-0.9 in 2 h vs 0.6-0.8 in 4.5 h | `results/index.html:658` | "one run each" | Add "one run each" on the homepage |
| `index.html:961, 1232` | "Every drawing and model… under CC BY 4.0" | `hardware/index.html:441-448` | CC BY 4.0 for site content, MIT for JS; no licence stated for STL/CAD | State the CAD licence where files are offered |
| `index.html:1045` | Green 520 nm, red 660 nm | `hardware/diopal/index.html:409` | "assumed pending measurement" (literature 535/670) | Add the qualifier |
| `index.html:1027` | "a dial rather than a fuse" | `model/index.html:378-380`, `results/index.html:340` | No induction curve measured | Flag as design intent |
| **Fixed** `index.html` rigs tile alt | "germinated 100%" | `plant/index.html:559` | Prototype 4's 5 of 5 are seedlings moved from agar, not germination | Alt now says so |
| **Fixed** codon tile alt | SD accessibility 0.067 to 0.641 | `peptide-design/index.html:1840`, `protein-design/packaging/index.html:130-132` | 0.528 (and 0.497); 0.641 is on no page | Number removed from the alt; the two sub-pages still disagree with each other |
| **Fixed** photometer tile alt | four-fold overestimate on 4 July | `milestone/index.html:1041`, `hardware/notebook/index.html:240` | "the four-fold error from 19 July" (week 20) | Alt keeps the photo date and the later finding apart |
| **Fixed** light-array tile | "first assembled 17 July", "31, 63 and 100 per cent duty" | `results/index.html:333, 338`, `hardware/diopal/index.html:619` | "Third iteration"; duty cycles "still unrecorded" | Alt corrected; tile named DiOPAL as on Hardware |
| **Fixed** tile label "Industry pitch" | Photo of Prof. 陳文亮 | `human-practices/index.html:146` | Academic adviser (smart agriculture, Agritalk) | Now "Expert review of the reactor" |
| **Fixed** tile label "Entrepreneurship pitch with industry" | CH Biotech, 9 July | `plant/index.html:1026`, `laws-and-regulations/index.html:61` | A design session / regulatory briefing, no pitch | Now "Design session at CH Biotech" |
| **Fixed** Dry Lab door | "three instruments built from nothing" | `hardware/index.html:48` | "We built four instruments" | Now "the four instruments we built" (the nav caption in `site-nav.js` still says three: shared-layer request) |

Spelling: the homepage now uses "fibre" throughout (British, like the rest of
the page); Description and Hardware: Bioreactor use "fiber". Name: "ReLeaf"
everywhere on the homepage; the hardware pages still use "RELEAF" in running
prose.

## 3. Strong student writing worth keeping

The homepage has no "Written by" line, so no author is named.

- **iHP lede** (`#ihp`): "Human practices here is a change log, not an attendance record." It sets a standard a judge can test on every card below it, which is exactly what the iHP rubric asks.
- **Synbio lede** (`#synbio`): "light is the only signal that crosses into a sealed vessel without opening it." A design reason in one clause, stated as physics rather than as preference.
- **Bioreactor open items** (`#system`): "Fouling over a multi-day run, protectant transfer rate, and growth at field temperature are still open". Naming the open problems next to the claims is what makes the claims believable.
- **Big-picture alt text**, reactor-and-plants tile: "The two have never been connected." Four words that stop a reader over-reading the photograph; most tiles do this.
- **The dial foot** (`#reach`): "A share of land, not a count of machines." Scale shown without inventing a number.
- **The journey's end card**: "It goes on sale after 730 five-day windows. A flash drought needs one." Checkable arithmetic that lands as an argument.

## 4. Needs a person

- **Image consent for 陳惠雯.** The source comment above the outro says her image consent is not on record. Her photograph and her quote open the page and her plot closes it. Get written consent before the freeze or change both photographs.
- **The hero claim versus the status.** "Every farmer a biomanufacturer" is a promise; Results marks the whole system "Growth, not release". I added a factual title block but did not add a status line, because the wording of "where it stands" should come from whoever owns Results.
- **Permeate transport tile.** Its evidence was on Bioreactor Calculations. Move it (Math Model or Hardware: Bioreactor) or delete the tile and change "Twenty-nine" in the lede and the spine's aria-label. I did not delete work from the figure.
- **The farm-visit card** ("dosing off a wall clock onto soil-moisture state"): I did not rewrite it because I do not know which account is right.
- **46 or 47 people.**
- **Numbers that originate on the homepage** (97%/99.8%, 15%/25%, the band breaks, refs 4-10, 117 reads/61 clones, BAPHIQ): the page's own rule says nothing may originate here. Each needs a home on a sub-page or has to go.
- **Unused images, 3.6 MB in the repository**, referenced nowhere: `assets/img/home/firmware-1400.jpg`, `firmware-1400.webp`, `firmware-2400.webp`, `reactor-1400.jpg`, `reactor-1400.webp`, `reactor-2400.webp`, `system-schematic-1600.png`, `system-schematic-1600.webp`, `hero-farm-2400.jpg`, `hero-reactor-2400.jpg`. Not deleted; delete them if nobody wants them.
- **three.min.js (589 KB) loads on every homepage visit**, including for readers who never reach the reactor, because it is a `defer` script tag. `home-reactor.js` already waits before fetching STLs; injecting three.js at the same moment would cut the first load by about a fifth. `home-reactor.js` and `hardware/js/deck3d.js` were not mine to change.
- **Three 404s per visit**: `home.js` probes for `ihp-timeline.png` and the two vision renders so the page can swap them in when they land. Harmless, but they show in the console. Deliver the art or remove the probes.
- **With JavaScript off**, the dark act shows the same final frame (reactor, name card) for three screens of scroll, because the scroll beats keep their height. Collapsing them without JS needs a change to how home.js drives the stage; not attempted overnight.
- **`hero-reactor` srcset** declares its files as 980w and 1680w, but they are 1400 and 2400 px wide. That may be deliberate (it biases the browser to the smaller file); left as it is.
- **Chen's name**: "Farmer Chen" in the hero, 陳惠雯 on the cards, "Ms. Chen Hui-wen" on Human Practices. Fine, but pick one romanisation for any English text.

## 5. Requests for the shared layer

1. `assets/data/site-nav.js`: the Hardware caption says "Three instruments, taken apart." The hardware hub says "We built four instruments" (Photometer, DiOPAL, Bioreactor, Hydroponics). The Team blurb says "forty-seven of us"; `roster.js` has 46.
2. `assets/css/tokens.css`: `--radius: .5rem` and `--radius-sm: .3125rem` contradict DESIGN.md ("zero radius except focus"). The homepage now overrides them inside `<main>`; setting them to 0 site-wide would do the same for every page.
3. The two fixed demo buttons at bottom-left (`rulecheck.js` and the review-notes toggle) sit on top of page text at 1280x800 (the hero title block) and at 390px. Stack them on the right, or make them smaller.
4. `review-notes.js` injects its CSS from JavaScript, so with scripting off the notes render as unstyled paragraphs inside the page. Fine for a demo; if the notes stay for a while, put the rule in `page.css`.
5. `notes/structure.md`, "Numbers that do not agree across the wiki": the first row cites a homepage ledger ("3 weeks of unbroken OD600 logging"). The homepage has had no ledger since 21 August; the only run length it now carries is 434 h (a tile alt), matching Software and Results but not Hardware (336 h).
