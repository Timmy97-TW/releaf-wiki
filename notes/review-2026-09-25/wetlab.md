# Wet Lab cluster, overnight pass of 25 September 2026

Pages: `experiments/`, `parts/`, `plant/`, `measurement/`, `safety-and-security/`,
`notebook/`, and their page stylesheets. Branch `night/wetlab`.

Two passes were made. Nothing in any student paragraph was rewritten. The
mechanical fixes are listed below one by one, everything else is a review note
left at the end of the section it is about.

## 1. What I changed

| Commit | What it did |
|---|---|
| `Wet Lab: species names italicised, and Measurement figures renumbered in reading order` | Five occurrences of *Arabidopsis* on Plants, the two species headings on Measurement and two protocol-index labels on Experiments are now italic. Measurement's figure captions ran 4, 5, 3, 1, 2, 6 down the page and now run 1 to 6; nothing else on the wiki cites them by number. |
| `Safety and Notebook: drafted overnight from evidence already on the wiki` | Six of Safety's eight sections and seven of Notebook's twelve months drafted, both marked Draft, both status boxes rewritten to say what a person still has to do. |
| `Wet Lab: a review note at the end of every section on all six pages` | Forty-seven notes. |
| `Parts: the module tables stop collapsing into a column of single characters on a phone` | Real mobile defect, described below. Also the Safety lede, which claimed a control for every risk. |
| `Wet Lab: three more cross-page number disagreements added to the review notes` | Chlorophyll extraction volume and electroporation voltages. |
| `Experiments: the fix and note boxes take the same spacing as the other wet lab pages` | `--sp-4` to `--sp-5`, so the identical box on four pages is identical. |

### Mechanical fixes, logged individually

- `plant/index.html` lede, stress-protocol stand-first, the 22 August photo caption,
  the Prof. Cheng paragraph and the contamination paragraph: *Arabidopsis* italicised
  (QA item in `notes/qa-2026-09-23/typos.md` §2, which found 0 of 6 italicised on this page).
- `plant/index.html` heat figure caption: "the normal response of *Arabidopsis* to 37 °C".
- `measurement/index.html`: `<h3>Physical measurements of *Arabidopsis*</h3>` and
  `<h3>*Bacillus subtilis* electroporation</h3>`. Both heading `id`s left unchanged.
- `experiments/index.html` protocol index: "*E. coli* transformation", "*Arabidopsis* in soil",
  so the index matches the headings it links to.
- `measurement/index.html`: figure numbers put in reading order.
- `safety-and-security/index.html`: meta description and lede changed from "what we did about
  each one", which the page cannot support, to "what is engineered against it, and what is still
  only procedure".
- `parts/parts.css`: `.parts table.parts-tbl` had `table-layout: fixed` with the first three
  columns set at 9.5, 8.5 and 11.5 rem. Below about 46 rem those add up to more than the
  viewport, the function column was left with almost no width, and every sentence in it wrapped
  one character per line: a three-row table became two screens tall with a blank area beside it.
  Under 46 rem the table now uses automatic layout with a 40 rem floor and scrolls inside
  `.tablewrap`, which is what the wider tables on the wiki already do.

### Drafted scaffolds

**Safety and Security.** Biological risk (chassis, payload, escape), chemical and physical
risk, security and dual use, containment design, lab practice, and shipping, disposal and
incidents. Every sentence is built from a page already on this wiki and links to it. No risk
group is asserted, no regulatory status, no containment rating, no form. "How we assessed risk"
and "The iGEM safety forms" were left as scaffolds because the wiki holds no evidence for them,
and each carries a note saying so.

**Notebook.** March to September are a dated index assembled from Plants, Parts, Measurement,
Experiments, Engineering and Results, so whoever writes the bench entries has the skeleton of
dates in front of them. December 2025 to February 2026 have no wet lab event anywhere on the
wiki and October and November are in the future; all five are left as scaffolds. A callout at
the top says in plain words that these are not bench entries yet and what is missing from
every month.

## 2. Writing inconsistencies

| Where | What it says | What the other place says | Suggested resolution |
|---|---|---|---|
| `measurement/index.html:571` (M6) | "Experiment Set 6 Root Length.docx gives 150 mM as 1.753 mm ... Plants carries these as 1.8 and 13.6" | `plant/index.html:277, 379` publishes 1.36 and 14.71, and its fix 1 says "The old 1.8 mm is gone from the chart and the prose" | Update M6: Plants and the raw workbook now agree; the docx is the file still out of step. |
| `results/index.html:446` | "that is the source of the **1.8 mm** figure currently on Plants" | Plants no longer carries 1.8 | Not my file. Results needs the same correction as M6. |
| `experiments/index.html:1499` (E9) | "The wiki currently carries 1.8 mm for root length at 150 mM NaCl on day six ... against the figure currently on Plants and Sustainability" | Plants carries 1.36 | E9 should now name only Sustainability and Results. |
| `plant/index.html:197` | "V was 1 mL, 2 mL or 4 mL depending on the set" | `measurement/index.html:218` has 2 mL and 4 mL only; `experiments/index.html:1726` (E13) has 4 mL, 2 mL, and one run at 7 or 9 mL | Three different lists of the same quantity. One page should hold it and the other two link to it. Check whether any run used 1 mL. |
| `experiments/index.html:577` | Strain 168 electroporation at "2.1, 2.2 or 2.3 kV" | `engineering/index.html` records fields of 2.0, 2.1 and 2.2 kV on 22 May and 2.1, 2.3 and 2.5 kV on 23 May; `measurement/index.html:626` describes the first two pulses at 2.0 and 1.8 kV | Say whether the protocol lists the sweep or the working window, and make the list match. |
| `plant/index.html:1065, 1070` | "DingXi Elementary on 25 June and again on 2 July" | `education/index.html:114, 130` has "Dingxi Elementary School", sessions 25 to 26 June and 14 July | Open since the 23 September QA run. One romanisation, one set of dates, both pages changed together. I did not pick a side. |
| `plant/index.html:1065` | "Fushing, in June and again on 14 August" | Not in the Education session table at all, which has two "school name to add" gaps | Check the romanisation and add the school to Education. |
| `plant/index.html` throughout | "CH Bio" 17 times | Every other page uses "CH Biotech" (35 times wiki-wide) | Probably deliberate shorthand. Say once on Plants that CH Bio is the short form, or use the long one. |
| `measurement/index.html:171, 384` | "a CH bio peptide", lower-case b | "CH Bio" / "CH Biotech" everywhere else | Capitalise. |
| `measurement/index.html:140` | ACC deaminase "has produced no plant number at all" | `plant/index.html` fix 7 records a soil ACCD trial with five named arms, 23 August to 1 September, with no measurement taken | "Unmeasured" rather than "never run", or say why the soil arm does not count. |
| `measurement/index.html:102, 879, 907, 917, 922, 929, 967, 992, 1026`; `experiments/index.html:1887` | Sentences still naming "Bioreactor Calculations" | That page was deleted on 25 September | Prose left alone as instructed; review notes on both pages ask for a reword or a relocation, and say what the claim needs as its source. Detail below. |

### The deleted Bioreactor Calculations page

The links were already unwrapped; the sentences remain. What each one now needs:

- **Measurement, section 1** — "the reactor physics on Bioreactor Calculations" is the page's
  only pointer to where the reactor physics lives. It needs a destination or the clause has to go.
- **Measurement, M11, the pump floor** — the 230 mL/min floor and the shear table built on it
  came from that page. The measured values are 100.3 mL/min on the bench and 140, 121.7 and
  116.7 in the loop, so the floor is the outlier and it now has no published source at all.
  This is the one to fix first: Figure 6 draws the 230 line and its caption attributes it to the
  deleted page.
- **Measurement, M13 and M14** — the 3.74 mL lumen holdup and the eight-fibre, 150 cm² module
  specification are both from that page, and the fibre count question cannot be stated without them.
- **Measurement, sources lines under the pressure meter and the breach detector** — the sensor
  specification, the error analysis and the Darcy-Starling treatment.
- **Experiments, section 6** — "with the derived parameters on Bioreactor Calculations".

Either the derivations move onto Measurement, or the team names the calculation file and says
it is unpublished. A judge reading Best Measurement will follow the pump floor, because the page
itself makes it the interesting question.

## 3. Strong student writing worth keeping

Page headers name teams rather than individuals, so no author is named below.

- **Measurement, chlorophyll extraction** (written by "Wet lab, with dry lab and reactor"):
  "Normalising chlorophyll to fresh weight can invert the ranking of your own experiment."
  It is a warning aimed at another team, it is proved two paragraphs later with the team's own
  numbers, and the remedy given costs nothing. This is the best measurement writing on the wiki.
- **Measurement, section 1**: "A plant result means nothing without the protectant result,
  because a spray that contains no protein is a spray of medium." Twenty words that explain why
  the page reports protein measurements next to plant ones.
- **Measurement, physical measurements**: "A dead seedling has to be a decision, and the decision
  has to be written down." The paragraph then shows a published mean of 54.98 mm that is seven
  measured values divided by nine.
- **Plants, overview**: "Too little salt and there is no gap. Too much and the plant is dead
  before the protectant matters, which is the same result as a protectant that does not work."
- **Plants, run ledger, set 8**: the entry that says the blot found nothing in the culture, "so
  there had been nothing to test". A team that publishes that in a results table is a team a
  judge trusts elsewhere.
- **Plants, verification**: "A protectant assay that cannot tell you the protectant was absent
  is not an assay."
- **Parts, build record**: "a parts page that lists only the ones that worked is not a record of
  anything", and the Level 2 callout, "Nothing on this wiki should describe the Level 2 circuit
  as verified."
- **Parts, Level 0 point mutants**: "A His tag on the front is a purification handle, so these
  were built to make protein in a tube, not to be secreted." The section refuses to let its own
  newest result upgrade a claim.
- **Experiments, colony PCR note**: "A band on a gel is worthless if the colony it came from has
  been thrown away."
- **Experiments, E14**: identifies a second chlorophyll method that was used once and never
  written down, and then says it is the one internally coherent dataset in the archive, "which
  makes writing it up worth the hour it would take".

## 4. Needs a person

- **The Safety page is a draft by a machine.** Every drafted section carries a review note
  naming what has to be verified. The three that block the award: the risk group assessment,
  the iGEM Safety Form record, and PI sign-off on the payload paragraph, which currently says
  none of the three cargoes is a toxin, a resistance determinant or a virulence factor. That is
  a safety claim and it needs a name behind it.
- **The waste route** is documented nowhere on this wiki. It is the largest hole on the Safety page.
- **Who was trained, by whom, and who worked unsupervised** exists only in people's heads.
- **The Notebook needs bench entries**, not an index. The 6 June containment plate is the entry
  to write first: Results, Measurement and Safety all rest on it and none of them can state its
  detection limit.
- **Decisions I did not make**: the DingXi spelling and the school session dates; which
  chlorophyll workbook is the record; which root length file is the record; the BoPep4 truncation
  boundary; the Pveg accession; whether the AmilCP reporter cassettes go back into the Parts
  tables. Every one of them changes what a page may claim, and each is already in a fix box.
- **Risky changes I skipped**: I did not renumber figures on Plants, Parts or Experiments,
  because they are already in order. I did not restructure the wide build-record tables on Parts
  beyond the layout fix, because a stacked mobile view changes how the evidence reads and that is
  the team's call. I did not touch the prose that names Bioreactor Calculations.

## 5. Requests for the shared layer

1. **`.fix` and `.fix__label` should live in `page.css`.** The same rule is duplicated, almost
   character for character, in `measurement.css`, `parts.css`, `experiments.css` and `plant.css`,
   and they had already drifted apart by a spacing step. One definition in the shared layer would
   keep the four pages identical and let a future page get the box for free. `.note` /
   `.note__label` (currently only in `experiments.css`) belongs with it.
2. **A shared narrow-table rule.** Three of my pages solve the same problem three ways
   (`min-width` on the table, `.scroller` around it, fixed column widths). A single
   `.tablewrap--wide` pattern in `page.css`, with the floor and the scroll hint in one place,
   would stop the next page inventing a fourth.
3. **Headless screenshots cannot be taken below about 490 CSS px** in this Chrome build: a
   `--window-size=390` render lays out at roughly 490 and crops, on every page of the wiki, not
   only mine. Mobile checks in this pass were therefore made at 490 px and by reading the CSS.
   Worth someone checking 390 px in a real browser before the freeze.
4. **`window.RULECHECK`** still paints its warning chip on these pages; `site-nav.js` has to set
   it false before the wiki is frozen. Already noted in the 23 September QA run, repeated here
   because it is visible in every screenshot.
