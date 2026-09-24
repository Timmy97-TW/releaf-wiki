# Hardware: overnight review, 25 September 2026

Scope: `hardware/**` (hub, photometer, DiOPAL, bioreactor, hydroponics, notebook).
Branch `night/hardware`. The section is synced from Anton's own repository, so every
change is also in a patch (see "Upstream" at the end, and notes/hardware-handoff.md §9).

The main job was the owner's request: a writing review from an iGEM judge's seat, left
as a note at the end of every section. There are **63 review notes**: photometer 20,
bioreactor 15, hydroponics 13, DiOPAL 11, hub 2, notebook 2. They are read against the
Best Hardware rubric (real need and user input, reproducibility: BOM, CAD, assembly,
firmware; validation with data; safety and practicality), and they cross-check every
number against Results, Measurement, Software, Model, Plants, Human Practices and the
scanned notebook (`hardware/notebook/search.json`).

None of the hardware pages cites the deleted Bioreactor Calculations page (checked:
no link, no mention in HTML or JS), so no note was needed for that. Two notes do cite
Measurement and Results fixes (M11, M14, R4) that themselves mention it.

## 1. What I changed

| Commit | What |
|---|---|
| `721323b` | polish.css: review notes legible on the dark ground (dark amber panel, light text) and cream on the white record; the section strip (`.hwnav`) was unreadable over the white record (current page ~1.3:1, text showing through), now a solid band there and on the notebook; jump pill gets the light fill hydroponics already had; notebook footer side padding (licence text started at x = 0). Cache tags bumped. |
| `c6717b3` | Hub: missing space "Four instruments</b>and" (typos.md P1); *Arabidopsis* and *B. subtilis* italic in the notebook reel; DiOPAL *B. subtilis* 168 italic; bioreactor's two empty `xref` anchors now carry "the plate figure" (read "see ." with JS off); notebook: 31 continuation pages' alt text names the week and entry, page 2 says it is the contents. |
| `d52f1e3` | Photometer: 20 review notes. |
| `edf553a` | DiOPAL: 11 review notes. |
| `4cabddf` | Bioreactor: 15 review notes. |
| `bb07298` | Hydroponics: 13 review notes. |
| `6869e25` | Hub: 2 review notes. |
| `bbc10f5` | Notebook: 2 review notes. |
| `9cdb441` | `<title>` in the wiki's form ("Photometer — Anatomy" became "In-line Photometer, Hardware \| ReLeaf · iGEM 2026"); meta descriptions spell GEMS Taiwan / ReLeaf. |
| `b65f30e` | polish.css carries the whole note box, so a note looks the same before review-notes.js injects its style, and with JS off. |
| `f543f37` | Second-pass corrections to note text (teardown's "600 nm absorbance peak", part picker's return leg and air filter, walkthrough captions on hydroponics). |
| `0bf23d3` | Hub: previous / next pager at the end (Math Model, Software), requested by the lead for the Dry Lab reading chain, in the section's dark style with the generated pages' `nav.pagenav` markup; the section strip also gets the solid band on the hub once scrolled (it ran over the cream notebook sheet unreadably). |
| last | This file, the two patches, the handoff section. |

Verified: headless Chrome at 1440 and 390 px on all six pages, no horizontal scroll;
contents rails and figure numbering unchanged (notes are `<aside>`s with no heading, and
figures.js numbers only `<figure>`s); `build/audit.py` identical before and after.

## 2. Writing inconsistencies

Line numbers are on this branch.

| Where | What it says | The other place | Suggested resolution |
|---|---|---|---|
| photometer:53 (hero), :947 (3.5 heading), hub:108 | Continuous run 14 d, 336 h, 2,132 points | Software R3, Measurement M10, Results R1: 434 h, 21 Jul to 8 Aug, 2,671 valid rows, 22 °C; notebook week 21 "nineteen-day run"; homepage "3 weeks" (structure.md) | 336 h is a dashboard snapshot at 14 d 0 h. Report 434 h as the length everywhere and call 336 h a snapshot if it stays. |
| photometer:385 (1.3) | "can run for 300+ hours continuously without failure" | Results R3 / Measurement: sensor alarm at 216.3 h, OD channel unusable from 243 h | Reword to what was observed. |
| photometer:465 (2.1), :997 (3.5.1) | 8% | photometer:813 (2.4.1): 7.7% for the same 0.431 / 0.467 pair | (0.467−0.431)/0.467 = 7.7%. Use 7.7%. (Open since the handoff.) |
| photometer 2.1 "Tilted 10°" | 10° | CAD ground face 8.1° (handoff) | State the measured angle. |
| photometer:256 (BOM) | beamsplitter "nominal split ratio 90:10" (9:1) | photometer:311-ish score card "specified at 10×" | One specification. |
| photometer js/parts.js:179 | LED "roughly 590 nm, close enough to the 600 nm absorbance peak" | Cells have no absorbance peak at 600 nm (OD600 is scattering) | Reword the panel; measure the LED peak. |
| photometer 2.7 | ~23 °C | Measurement, Software, Model: 22 °C | Settle one. |
| photometer 4.1 (:1052) | reads "from the lumen loop of a running bioreactor" | photometer 2.7 and bioreactor 5.3: the run was on a simplified loop, no membrane | "is built to read". |
| photometer 4.1 | "no exponential phase and no plateau" | Model: K ≈ 1.456 reached at about 250 h off the same run | One reading of the curve. |
| photometer 3.2 / score card | Linearity open, "no dilution series run" | Measurement / Software: TiO2 ladder 23 Aug, ours = 1.018 × Bio-Drop − 0.031, R² 0.995, n = 20 | Bring the ladder onto the photometer page. |
| photometer 2.4 | 11-point ladder described as done | photometer 3.6: the same 11 points as a planned series, blank | Say which. |
| photometer Prior work Needs box | "the 16 hour comparison in 3.5" | nothing of the kind in 3.5 | Remove or restore. |
| photometer 2.2.1 | rejection rule written out (14 readings, ±3·MAD) | photometer score card: rule "not written down anywhere" | Say this is reconstructed from firmware, link the code. |
| photometer 3.2 | "a run exceeding seven days" (:897) | 3.5: 14 d or 18 d | Same figure. |
| bioreactor:149 (1.1), 1.2 lumen path | photometer in the feed leg, pump → photometer → lumens | notebook week 23 (p. 58), homepage, and bioreactor js/components.js:22: return leg | Give the as-built position. |
| bioreactor:151 | photometer and membrane "have not yet been run together" | notebook week 20 (fitted in line on the TFF loop), week 23 (full rig with photometer) | "fitted together, not logged together over a run". |
| bioreactor:198, :407 | cartridge hold-up ~200 mL, eight fibres, 150 cm² (:200) | Measurement M13: 7.0–7.2 mL weighed, 3.74 mL computed; Software HFM-01: 11 fibres, 0.02 m², 0.60 m; Measurement M14: neither count from a datasheet | Measured figure with source; others marked unconfirmed. |
| bioreactor:193 | ACC deaminase "roughly 36 kDa" | Results / Engineering: only resolved band ~41 kDa (24 Aug blot); drafts say ~42 kDa | Name which form crosses the membrane. |
| bioreactor:182 | 94 mL/min | Results R4 / Measurement M11: vendor floor 230 mL/min; bench 100.3 mL/min at dial 10; loop 140 / 121.7 / 116.7 | State dial setting and method. |
| bioreactor:372 (2.2) | one pressure transducer on the feed leg; lumen-outlet and shell transducers not fitted | notebook week 19: BP8G-AGA, 0–1 MPa, retentate side; Software: PT-01/03 lumen in/out, PT-04/05 shell, 0–30 psi, "built and reporting" | Date each configuration. |
| bioreactor:729 (5.3) | "No transmembrane pressure logged" | notebook week 19 (TMP on screen 12 Jul); Measurement 16 Aug sweep; Software 102 h run bounds drift at 12 mbar | Update. |
| bioreactor:708 (5.3) | "No shell-side protectant assay has been run" | Results: blot with lumen lysate / lumen medium / shell medium strips | Say what it showed. |
| bioreactor:771 (5.4), status line | membrane run "hours, not days"; cycle 3 in progress; record closed 13 Aug | Software / Measurement: 102-hour perfusion run, 2–6 Sept, 12,259 rows | If the module was fitted, this is cycle 3. |
| bioreactor:601 (5.1) | "no aeration path described" | bioreactor js/components.js:46: "A membrane air filter: the culture breathes without the vessel being opened" | Say whether it was fitted in cycle 2. |
| bioreactor | cycle 1 / 2 | notebook: prototype I / II; Results: Version 1 / 2 | One name. |
| diopal:430 | 520 / 660 nm "are the classic CcaS/CcaR values" | diopal:444: literature values are 535 / 670 nm | Call 520/660 nominal LED values. |
| diopal:47 (hero) | "Green light switches protectant production on. Red switches it off." | diopal score card: never run a CcaS/CcaR experiment; Results: no experiment shows PcpcG2 output changing with green | "is designed to". |
| diopal:326 | iteration 2 "Three calibrated tiers" | diopal score card: green channels span 2.33–2.40 kLux (3%), duty cycles unrecorded | Retitle. |
| diopal BOM | 12 green, 12 red | diopal §4: forty bought, 24 used; notebook week 20: two reds dead | Bought and used. |
| diopal:641 | "All twenty of each colour" measured | notebook week 20: two reds dead out of the packet | Mention. |
| hydroponics:138 | Prof. Cheng Mei Jun | Plants (throughout): Prof. Cheng Mei-Chun, NTU | Check with her. |
| hydroponics:176 | "Four printed parts" | hydroponics 4.2 / 5.1: sixteen pieces; 5.2: four STLs | "four designs, sixteen pieces". |
| hydroponics:456 | STLs "in the project repository under hydroponics-cad/" | no such folder in this repository | Publish the STLs with the page. |
| hydroponics story.js | "The raft floats on the nutrient solution"; "aerated water" | hydroponics 4.2: floating untested; no aeration described | Caption as intended. |
| hub:98 | bioreactor "Designed for field use" | bioreactor: all kinetics at 37 °C, field-temperature cycle not run | Say what it was tested at. |
| hub:169, notebook p. 1 | notebook "written the week it happened, not reconstructed afterwards"; "every one written up" | scanned pages 3, 8, 10, 11, 19, 21, 29, 33 carry unanswered template prompts ("how many trays?", "NT$ ?", "what factor did you use, and where from?", "when?"); week 09 is prompts and two empty photo boxes | Answer or delete prompts and re-export; or soften the claim. |
| hub:165 | "INSTRUMENTS 4" | key counts six kinds of build; notebook p. 1 says eight things were made | "4 instruments, 8 builds". |
| hub, bioreactor, meta | RELEAF, GEMS-Taiwan | rest of the wiki: ReLeaf, GEMS Taiwan | Meta and titles fixed tonight; prose left to the team (typos.md already lists it). |
| notebook scans | "abby", "jacquelyn" in lower case | team roster: two Abbys (Kao, Tsai), Jacquelyn Inocencio | Full first names. |
| all four records | fiber (bioreactor 25×), fibre elsewhere; section numbering gaps on photometer (2.4 → 2.7, 3.2 → 3.5, 4.3 → 4.5) | typos.md | Renumber; bioreactor cites "Photometer 3.5" so update both. |

## 3. Strong student writing worth keeping

The hardware records carry no "Written by" line; the notebook names the builders
(Anton, Noah, Joshua, Chars, Timmy, Gabriel, Jacquelyn, Abby). Quotes are short.

- **Bioreactor 1.1.** "The protectant has to get into the soil; the bacteria that make it must not." The whole design constraint in one sentence, followed by "the biology cannot solve it alone": the best statement of need in the section.
- **Bioreactor 5.1, "How far this comparison actually goes".** Ends "a promising difference, not a measured one". States the result, then exactly why it is not yet a controlled comparison. Model scientific writing.
- **Bioreactor 6.2.** "the honest version of the specification is that three of its mechanical choices are being replaced". Few teams tell a judge the machine described is not the one on the bench.
- **Bioreactor 5.2 / notebook week 18.** Withdrawing the 50 kDa cut-off claim in public, with the week it happened.
- **Photometer 4.1.** "The instrument's claim is the record it kept, not the biology it happened to capture." Separates evidence from interpretation in plain sentences.
- **Photometer 2.1 "Not yet validated" box.** Says the 8% belongs to an earlier build and the final build read 33% low and did not pass. The most honest paragraph on the page.
- **Photometer 2.2.1, rejection filter.** Median and MAD explained in plain words with a demo, and "What this surfaced" turns the demo into a finding about the team's own rule.
- **Photometer 3.5.** The pump-failure story, with the wrong contamination guess kept in the record.
- **DiOPAL "A note on the units".** Finds the team's own mistake, explains in two sentences why lux is wrong for cells, and says what it costs.
- **DiOPAL score card.** "That the tiers are intensity tiers" listed as not established, with the 3% spread as the reason.
- **Notebook page 1.** "Bench hours are blank because we never logged them, and we would rather leave the field empty than fill it in after the fact."
- **Notebook week 09.** "Nothing much happened", kept in "because a notebook containing only the productive weeks misrepresents how the summer actually went".

## 4. Needs a person

1. **The hardware section froze on 13 August; the rest of the wiki did not.** The TiO2 ladder (23 Aug), the jumper-controlled pressure sweep (16 Aug), the 24 Aug blot, the 102-hour perfusion run (2–6 Sept) and the Software controller with interlocks are all on other pages and absent here, while the hardware pages still list those things as "not established". This is the single biggest improvement available for Best Hardware, and it needs Anton (or whoever holds the upstream repo) to bring the records up to date.
2. **One run length** for the long photometer run (336 / 434 h, 14 / 18 / 19 days, "3 weeks"). Owner decision; several pages.
3. **Photometer position and pressure sensing on the reactor** (feed leg vs return leg; one transducer vs BP8G-AGA vs PT-01..05). Only the builders know what is fitted.
4. **Cartridge**: fibre count, area, lumen volume and part number (Measurement M13, M14). Needs the invoice or a bench measurement.
5. **Notebook scans with unanswered prompts** (pages 3, 8, 10, 11, 19, 21, 29, 33 at least). The scans are generated by the pipeline in `build/hardware/tools/`; answering them means editing the source and re-exporting. I did not touch the images.
6. **Hydroponics page** is mostly an empty template. I did not draft prose into it: it is Anton's upstream content and would be overwritten, and the evidence (Plants 1.2, notebook week 17, Human Practices) needs a team member to decide what the plate's role now is. The review notes point to each source.
7. **Prof. Cheng's name**: Mei Jun (hydroponics) or Mei-Chun (Plants).
8. **Firmware and CAD publication**: no page links the photometer or DiOPAL firmware; the bioreactor has no downloadable CAD; hydroponics STLs are not in the repository. For Best Hardware this is required, not optional.
9. **Decorative slop left alone** because it is Anton's design and a sync would restore it: numbered labels "01"–"04" in the hub hero rail and "01 Overview" style contents; giant outline section numerals on hydroponics; hero-metric rows of big numbers with small labels on each instrument page ("0 colonies", "336 h"). The hub note suggests dropping the hero numbers; the rest is recorded here.
10. **Review notes must come off before the freeze**: `window.REVIEW_NOTES = false` in `assets/data/site-nav.js`, or delete the `<aside class="review-note">` blocks. For the upstream repo, the fixes-only patch has no notes in it.

## 5. Requests for the shared layer

- `assets/css/nav-dark.css`: the `.hwnav` strip sits under the bar's scrim (z-index 49 against 50), so on any light ground the scrim hides or greys it. I fixed it page-side for the white record and the notebook (`hardware/css/polish.css`, `body.doc-light` and `body[data-instrument="notebook"]`); a shared fix would be to lift `.hwnav` over the scrim and let the scrim extend under it.
- `assets/js/review-notes.js`: its injected rules have (0,1,1) specificity, so any page rule like `.sec p b` (0,1,2) wins. Consider higher specificity (for example `html body .review-note b`), so the notes look the same everywhere. Also the injected style arrives late: a note can render unstyled for a moment.
- `assets/js/rulecheck.js` red "⚠ 4" badge sits at the bottom left right under the review-notes toggle on the hardware pages; fine for the demo wiki, but both must be off for the freeze.

## Upstream

Both patches are made against main's `hardware/` folder, which already contains the
23 September fixes: apply `hardware-upstream-2026-09-23.patch` first if the upstream
repository has not taken it yet.

- `notes/hardware-upstream-2026-09-25.patch`: everything tonight, including the review notes. Paths relative to `hardware/`. Tested with `git apply --check` against main's `hardware/` folder, and applying it reproduces this branch's `hardware/` exactly.
- `notes/hardware-upstream-2026-09-25-fixes-only.patch`: the same without the 63 review notes (CSS, titles, typo and italics, xref fallback, notebook alt text). Also tested. This is the one Anton most likely wants.
