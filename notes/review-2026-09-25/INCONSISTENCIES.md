# One ledger of the facts that disagree, 25 September 2026

This file merges the inconsistency tables of the eight overnight review notes
(drylab, engage, hardware, home, milestone, project, team, wetlab) into one list
grouped by fact rather than by page, and every entry was checked again against
the live page source tonight. Where a note turned out to be describing a page
that has since changed, the entry says so instead of repeating it.

How to read it. Each fact has a table of every page that states it, with the
section heading and the wording as it stands. Line numbers move as soon as
anybody edits, so the quote and the heading are the address; use them with your
editor's search. "What the wiki supports" says which version the wiki's own
evidence backs, and says "team to decide" when the wiki cannot settle it.
Priority: **P1** a judge would notice, or it weakens a medal or award
criterion; **P2** a visible disagreement between pages; **P3** style, spelling
and naming.

---

## The ten P1 items

1. **Long photometer run length.** 336 h, 434 h, "about 400 h", "3 weeks",
   14 days, 18 days, "nineteen-day", "300+ hours", "a run exceeding seven days".
   One run, nine descriptions, on the pages that carry Best Hardware, Best
   Software and Best Measurement.
2. **Pump floor and flow rate.** A 230 mL/min floor is still quoted from a
   deleted page against 100.3 mL/min measured at the same dial, and both
   reactor runs ran at 94 mL/min.
3. **Membrane module: fibre count, area and lumen volume.** Eight fibres and
   150 cm2 against eleven and 0.02 m2; lumen volume 3.74 mL computed, 7.0 to
   7.2 mL weighed, "roughly 200 mL" hold-up.
4. **ACC deaminase mass.** 36, 37.6, 41 and 42 kDa for what a reader takes to
   be one protein, on the pages that carry the project's only protein result.
5. **The 150 mM root length.** Plants, Results and Milestone publish 1.36 mm;
   Math Model still says the Plants page carries 1.8 mm and 43-fold.
6. **Green and red wavelengths.** 520 and 660 nm (LEDs) against 535 and 670 nm
   (literature) against 672 nm (Engineering) against 525 nm (Milestone).
7. **The deleted Bioreactor Calculations page** is still named in 34 sentences
   of prose across nine pages, and several load-bearing numbers have no
   published source left.
8. **Containment layers.** Entrepreneurship promises three independent layers
   including a kill switch; Safety and Human Practices say the second layer has
   not been built.
9. **The software mirror address.** Software says the mirror goes to
   `gitlab.igem.org/2026/software-tools/`; the 2026 address is
   `gitlab.igem.org/2026/software/<team>/`. Best Software Tool requires it.
10. **The Castillo-Hair citation.** One volume and one page number carry two
    different paper titles across five pages, and one page also gives a
    different author list.

---

## 1. Light wavelengths, green and red

| Page | Section | What it says |
|---|---|---|
| `hardware/diopal/index.html` | Wavelengths | "Our green sits at 520 nm and our red at 660 nm; the CcaS/CcaR literature values are 535 nm and 670 nm" |
| `hardware/diopal/index.html` | LED Matching & Measurement | "Green channel 520 nm · Red channel 660 nm" |
| `hardware/index.html` | Photometer strip and hub key | "520 nm green · 660 nm red" |
| `index.html` (home) | A cell that reads a colour | "Green, 520 nm ... Red, 660 nm" |
| `results/index.html` | Light delivery | "green photons at 520 nm through the CcaS/CcaR two-component system, with red at 660 nm to stop production" |
| `engineering/index.html` | CcaS is blind until ho1 and pcyA ...; The assembly ladder | "absorbs green light near 535 nm", "a red-absorbing state near 672 nm" (both places) |
| `entrepreneurship/index.html` | Prove the circuit and the interface | "under 535 nm green against 670 nm red" |
| `milestone/index.html` | Success criteria for each stage | "Green 525 nm ±30, red 660 nm ±30" |

What the wiki supports: two different quantities are being reported with the
same words. 520 and 660 nm are the LEDs the team built and measured; 535 and
670 nm are the literature absorbance values the DiOPAL page already labels as
literature. Engineering's 672 nm has no source on the wiki and disagrees with
DiOPAL's 670 nm. Milestone's 525 nm ±30 is a specification window, and the page
says so, so it is not a fifth value.

Fix: say "LED emission" or "protein absorbance" wherever a number appears, use
520 / 660 whenever the hardware is meant, and settle 670 against 672 once.
Owners: Hardware (DiOPAL), Engineering (wet lab), Entrepreneurship. **P1**

## 2. The long photometer run

| Page | Section | What it says |
|---|---|---|
| `hardware/photometer/index.html` | hero | "Continuous run 14d" |
| `hardware/photometer/index.html` | 3.5 (heading and body) | "Continuous Growth Curve (B. subtilis 168, 336 h)", "336 hours and 2132 logged points", "Traced from the live dashboard at 14 d 0 h 11 m" |
| `hardware/photometer/index.html` | 1.3 Equipment | "can run for 300+ hours continuously without failure" |
| `hardware/photometer/index.html` | 3.2 | "a run exceeding seven days" |
| `hardware/index.html` | Photometer; notebook reel | "336 h simplified loop"; "WEEK 21 · STARTING THE NINETEEN-DAY RUN" |
| `hardware/bioreactor/index.html` | Not established; Run duration | "the 336 h record was taken on a simplified loop" |
| `software/index.html` | Results to date, R3; DT-5 | "434-hour run 21 July–8 August 2026, 22 °C, 2,671 valid rows"; "one BR-01 batch at 22 °C lasts about 18 days" |
| `measurement/index.html` | Dual light path photometer | "The 434 hour run of 21 July to 8 August logged 2,671 valid rows" |
| `results/index.html` | Continuous run, R1 | "The draft of this page says the run lasted about 400 h, and the photometer development record says it 'passed 400 hours'" |
| `model/index.html` | Growth in the vessel; Parameters | "a 434 hour run at 22 degrees"; "Ours 434 h run" |
| `index.html` (home) | growth tile alt text | "434 hours of B. subtilis 168 at 22 °C ... 2 671 readings" |

What the wiki supports: 434 h with 2,671 rows is the figure with a named log
file (`od600_log_20260721_034533.csv`) behind it, and the home page tile already
uses it. The 336 h / 2,132 point figure is explicitly a dashboard tracing at
14 d 0 h 11 m, so it is a snapshot inside the same run, not a second run.

Fix: report 434 h everywhere, and where 336 h stays, call it a dashboard
snapshot. Retire "300+ hours", "exceeding seven days" and "nineteen-day" or tie
each to a date. Note that Results already says the OD channel is unusable from
243.0 h, so no page should describe the whole run as usable.
Owners: Hardware (photometer), Software (dry lab software sub-team), Measurement
(wet lab), Results. **P1**

## 3. Pump floor and flow rate

| Page | Section | What it says |
|---|---|---|
| `measurement/index.html` | Pressure and flow meter, figure and M11 | "The amber line is the 230 mL/min floor that Bioreactor Calculations is built on"; "Pump Flow Rate.docx measures 100.3 mL/min at dial 10, mean of 103, 100 and 98"; "140 mL/min at the same setting and 260814 records 121.7 and 116.7" |
| `results/index.html` | Pressure and flow, R4 | "The pump's vendor sheet gives a range of 230 to 2,600 mL/min [8]"; "The measured calibration puts setting 10 at 100.3 mL/min" |
| `hardware/bioreactor/index.html` | Culture loop; 2.1; 2.2; BOM; cycle 1; cycle 2 | "Flow rate 94 mL/min" (six places, including the BOM row "94 mL/min at set duty") |
| `index.html` (home) | On site | "300 mL working volume, 94 mL/min" |
| `milestone/index.html` | Perfusion bioreactor | "peristaltic pump at 94 mL/min"; "the pump held 94 mL/min throughout" |
| `safety-and-security/index.html` | Escape | "version 2 then ran a full cycle at 94 mL/min with nothing leaking" |
| `human-practices/index.html` | Prof. Chang Jo-Shu | "Recirculation held 94 mL/min for a full run with no leak" |

What the wiki supports: 94 mL/min is the number the two reactor runs actually
ran at and it is consistent across six pages. 100.3 mL/min at dial 10 is the
bench calibration, three trials. The 230 mL/min "floor" now has no published
source at all, because the only page that derived it was deleted, and it sits
above every measured point below dial 16.

Fix: state the dial setting and the method beside every flow figure, and either
publish the vendor sheet reading of 230 mL/min as a vendor claim or drop it,
including the amber line in Measurement Figure 6 and its caption.
Owners: Measurement (wet lab, with dry lab and reactor), Results, Hardware. **P1**

## 4. Membrane module: fibre count, area, lumen volume

| Page | Section | What it says |
|---|---|---|
| `hardware/bioreactor/index.html` | Protectant harvest; 1.2 | "cartridge of roughly 200 mL total hold-up"; "Pore rating 0.2 µm, 150 cm2 membrane area, eight fibers" |
| `measurement/index.html` | M13 | "inner volume 7.0 to 7.2 mL" weighed; "Bioreactor Calculations computes 3.74 mL of lumen holdup for the eight fibre 150 cm2 module" |
| `measurement/index.html` | M14 | "eight fibres of 1.0 mm bore and 595.7 mm effective length, giving 150 cm2" against "eleven fibres and 0.02 m2, which is 200 cm2"; "the part number now carried on Bioreactor Calculations appears in no document the team holds" |
| `software/index.html` | The software | "Hollow-fibre module HFM-01 (PES, 0.2 µm, 0.02 m2, 11 fibres, 1.0 mm bore, 0.60 m)" |
| `human-practices/index.html` | Prof. Chang Jo-Shu | "0.2 µm pore, eight fibres, 150 cm2" |

What the wiki supports: nothing decides it. Measurement says both counts were
solved backwards from an assumed area and neither came from a datasheet, and the
single gravimetric weighing has no repeat. The Hagen-Poiseuille check in the
16 August analysis lands within 3% of eleven fibres, which is evidence and not a
specification.

Fix: team to decide after measuring the module or finding the invoice. Until
then, one page holds the number, the others link to it, and every per-fibre
figure says which count it assumes.
Owners: Measurement, Hardware (bioreactor), Software. **P1**

## 5. ACC deaminase and the fusion protein mass

| Page | Section | What it says |
|---|---|---|
| `hardware/bioreactor/index.html` | Protectant harvest; 5.2 Containment | "ACC deaminase is roughly 36 kDa" |
| `results/index.html` | Protectant release, R3 | "the expected mass is written as 42 kDa here, 41 kDa for the observed band on Engineering, roughly 36 kDa for bare ACC deaminase on Hardware, and 37.6 kDa on Bioreactor Calculations" |
| `engineering/index.html` | The batch that went onto plants; References F1 | "One band at about 41 kDa in the 18 August lane"; "a faint band near 42 kDa" |
| `measurement/index.html` | Western blot | "The 41 kDa position" of the one resolved band |
| `milestone/index.html` | Success criteria; Plant system | "a band at about 41 kDa in one culture" |
| `parts/index.html` | What has no measurement | "the 24 August blot ... carries a single band" at roughly 41 kDa |
| `notebook/index.html` | August 2026 | "one band at roughly 41 kDa" |

What the wiki supports: 41 kDa is the observed band on the only blot whose
ladder resolves, and five pages agree on it. The expected mass is a separate
quantity and nobody has computed it for the fusion as built (Csn signal peptide,
ACC deaminase, 6xHis).

Fix: compute the mass of the fusion as built once, publish it as the expected
mass, and keep 41 kDa as the observed band. That single calculation closes part
of Engineering F1 and part of Results R3.
Owners: Results (wet lab and dry lab), Engineering, Hardware. **P1**

## 6. The 150 mM root length, 1.8 mm against 1.364 mm

| Page | Section | What it says |
|---|---|---|
| `plant/index.html` | The salt dose ladder | "74.95 mm to 34.77, 11.00 and 1.36 mm across the four salt levels, nine seedlings"; "150 mM NaCl: 1.753 against 1.364 mm ... The docx figure is the mean of the seven that grew" |
| `results/index.html` | R2 | "gives 1.36378 mm as the mean of nine seedlings"; "Averaged over all nine that is 1.364; averaged over the seven that grew it is 1.753" |
| `milestone/index.html` | What the iterations produced; criteria table | "74.95, 34.77, 11.00 and 1.36 mm ... nine seedlings per group" |
| `sustainability/index.html` | salt ladder graphic | "1.36 mm" |
| `model/index.html` | Salinity; M1 | "The Plants page gives the day-6 ladder as 75.0, 34.8, 11.0 and 1.8 mm, and calls the suppression 43-fold"; "1.36 mm here against 1.8 mm there, and the suppression is 55-fold here against 43-fold there" |
| `experiments/index.html` | E9 | "The wiki currently carries 1.8 mm for root length at 150 mM NaCl on day six" |
| `measurement/index.html` | M6 | "Plants carries these as 1.8 and 13.6" |

What the wiki supports: 1.364 mm, the mean of all nine seedlings including the
two that did not grow, and Plants, Results, Milestone and Sustainability already
publish it. The three fix boxes that still say the wiki carries 1.8 mm are the
stale part, not the data.

Fix: update M1 on Math Model (including the 43-fold against 55-fold sentence),
E9 on Experiments and M6 on Measurement to say Plants and the raw workbook now
agree, and that the docx summaries are the files out of step.
Owners: Math Model (dry lab, modelling), Experiments and Measurement (wet lab). **P1**

## 7. The photometer's position in the loop

| Page | Section | What it says |
|---|---|---|
| `hardware/bioreactor/index.html` | 1.2 The Two Circuits; Read without opening the loop | "Medium reservoir → peristaltic pump → in-line photometer → fiber lumens → back to the reservoir"; "drives it at 94 mL/min through the in-line photometer" |
| `hardware/bioreactor/js/components.js` | photometer component note | "The V4 instrument, sitting in the return leg" |
| `index.html` (home) | Sealed loop, read in line | "the photometer reads OD600 in the return leg" |

What the wiki supports: team to decide, because only the builders know what is
fitted. The two statements are on the same page's text and its own component
data, which is the worst place for them to disagree.

Fix: one as-built order, in the 1.2 text, the 2.1 diagram and `components.js`,
with the date the rig was plumbed that way.
Owner: Hardware (bioreactor). **P1 for reproducibility.**

## 8. Containment layers and the kill switch

| Page | Section | What it says |
|---|---|---|
| `entrepreneurship/index.html` | Conclusion | "Three independent containment layers, a genetic kill switch, a hollow-fibre membrane and a physical..." |
| `entrepreneurship/index.html` | The Taiwan pathway | "cells stay behind a 0.22 µm hollow-fibre membrane with genetic kill switches behind that" |
| `entrepreneurship/index.html` | Risks | "bypassing two containment layers at once" |
| `safety-and-security/index.html` | Biological risk; Containment design | "the second containment layer has not been built"; "There is no kill switch, no auxotrophy and no second containment layer" |
| `human-practices/index.html` | Conclusion | "the second containment layer has not been built" |

What the wiki supports: Safety and Human Practices. No page anywhere on the wiki
shows a kill switch built or tested.

Fix: Entrepreneurship writes the layers as planned, in the same sentence as what
exists today. A judge reading Safety and then Entrepreneurship will find this
one, and it is a safety claim.
Owners: Entrepreneurship (entrepreneurship, human practices), Safety officer. **P1**

## 9. The software mirror address

| Page | Section | What it says |
|---|---|---|
| `software/index.html` | Adapting it to another rig | "the mirror to gitlab.igem.org/2026/software-tools/ is outstanding and will be made before the wiki freeze" |
| `notes/publishing.md` | checklist | "Software repository on `gitlab.igem.org/2026/software/<team>/`" |

What the wiki supports: the publishing checklist. `2026/software-tools` does not
exist.

Fix: correct the sentence and do the mirror before 21 October. Best Software
Tool requires the code on iGEM's GitLab, so this is worth marks on its own.
Owner: Software (dry lab, software sub-team). **P1**

## 10. The Castillo-Hair citation

| Page | Section | What it says |
|---|---|---|
| `results/index.html`, `parts/index.html`, `engineering/index.html` | References | Castillo-Hair, Baerman, Fujita, Igoshin & Tabor (2019), "Optogenetic control of *Bacillus subtilis* gene expression", *Nature Communications* 10, 3099, doi:10.1038/s41467-019-10906-6 |
| `model/index.html` | References | Same title, volume and DOI, but the author list is "Castillo-Hair, Baerentsen, Reyes-Osorio, Baumschlager, Khammash, Tabor" |
| `peptide-design/index.html` | References [13] | Castillo-Hair et al., "Optimizing 5′ mRNA structure for translation initiation", *Nature Communications* **10**, 3099 (2019) |
| `protein-design/packaging/index.html` | References | Same as Peptide Design: "Optimizing 5′ mRNA structure for translation initiation", 10, 3099 (2019) |

What the wiki supports: three pages and the DOI agree on the *B. subtilis*
optogenetics paper. So either Peptide Design and Packaging have the wrong title
on the right reference, or they mean a second paper and have copied the wrong
volume and pages. Math Model's author list is a third variant of the same entry.

Fix: open the DOI, write one correct reference, and paste it into all five
pages. Packaging's whole codon argument rests on it.
Owners: Peptide Design and Protein Design (dry lab, protein design), Math Model. **P2
as a fact, P1 as a citation, because five pages carry it.**

## 11. School names and session dates (Dingxi, Fushing)

| Page | Section | What it says |
|---|---|---|
| `education/index.html` | Sessions table | "Dingxi Elementary School", 25–26 Jun 2026 (trial 1) and 14 Jul 2026 (trial 3); one row reads "school name to add" for the junior high |
| `plant/index.html` | Classrooms | "DingXi Elementary on 25 June and again on 2 July"; "Fushing, in June and again on 14 August" |
| `plant/index.html` | figure caption | "25 June, DingXi Elementary" |
| `notebook/index.html` | June 2026 | "A session at DingXi Elementary" on 25 June |
| `milestone/index.html` | photo file name | `aug14-fushing` for the 14 August high school session |

What the wiki supports: Education holds the survey counts per session, so it is
the stronger record for dates; "Dingxi" is the more standard romanisation and is
what Education uses. The second Dingxi date is 14 July on Education and 2 July
on Plants and Notebook, and nothing on the wiki settles which.

Fix: team to decide the dates from the survey sheets, then one spelling and one
set of dates on Education, Plants and Notebook in one commit, and fill
Education's two "school name to add" cells (Fushing is the likely high school,
from the Milestone photo file name; confirm the romanisation with the school).
Owners: Education team, Plants (wet lab, plant sub-team). **P2**

## 12. Headcount, 46 against 47

| Page | Section | What it says |
|---|---|---|
| `assets/data/roster.js` | roster | 46 people (Elizabeth Wong's card was removed on purpose in 799ea92) |
| `index.html` (home) | Team door | "Forty-seven of us." |
| `assets/data/site-nav.js` | Team blurb | "The forty-seven of us, a record of who did which part" |

Note: the Milestone sentences the team notes cited ("The forty-seven people are
named on Team") came off the page with the old timeline, so that part of the
conflict is already resolved. Two places remain.

What the wiki supports: 46 today. 47 may be the December first-meeting count, in
which case say so in words ("forty-seven at the first meeting, forty-six on the
roster").
Owners: shared layer (site-nav blurb), home page. **P2**

## 13. First market after Taiwan

| Page | Section | What it says |
|---|---|---|
| `laws-and-regulations/index.html` | Where ReLeaf sits; meta description | "This led us to the European Union as our first international market" |
| `entrepreneurship/index.html` | Which market comes second | EU is "First-priority market in the regulatory conclusion" and also "long-term horizon only, avoid for immediate entry"; Philippines is "Primary expansion, easiest early adoption" |
| `entrepreneurship/index.html` | Customer discovery | "the expansion sequence after Taiwan was drafted around the Philippines" |

What the wiki supports: team to decide. The disagreement is inside
Entrepreneurship's own table before it reaches Laws, which is the part to fix
first (fix F9 is already open there).

Fix: settle F9, then change Laws' closing paragraph, the Laws table's last row
and the Laws meta description together.
Owners: Entrepreneurship, Laws and Regulations (human practices, legal). **P2**

## 14. Which stress each protectant is for

| Page | Section | What it says |
|---|---|---|
| `laws-and-regulations/index.html` | Product classification; Protectant table | "BoPep4 and ACC deaminase (ACCD) are being investigated against salinity stress, and AtLEA14 against drought"; "AtLEA14 · Drought stress" |
| `laws-and-regulations/index.html` | F4 | "our AtLEA14 reference [11] is a salt-tolerance study" |
| `entrepreneurship/index.html` | Which market comes second | "severe Mekong Delta salinisation that AtLEA14 targets directly" |
| `protein-design/generate/index.html` | The three protectants | "ACC deaminase ... works on the plant's hormonal response to salinity and hypoxia. AtLEA14 is a cytoplasmic stress protein whose protective action is physical" |

What the wiki supports: Generate is the careful version, because it describes
mechanisms rather than assigning one stress per protein. The assignment tables
are what disagree.

Fix: wet lab decides what each protectant is claimed for, once, and Laws' two
tables and Entrepreneurship's market table follow it. Laws' F4 already names the
problem.
Owners: wet lab, with Laws and Entrepreneurship. **P2**

## 15. Membrane pore rating, 0.2 µm against 0.22 µm

| Page | Section | What it says |
|---|---|---|
| `hardware/bioreactor/index.html`, `results/index.html`, `human-practices/index.html`, `safety-and-security/index.html`, `model/index.html`, `software/index.html`, `index.html` | throughout | "0.2 µm" PES hollow fibre |
| `entrepreneurship/index.html` | The Taiwan pathway; Make it legal in Taiwan | "a 0.22 µm hollow-fibre membrane"; "physical containment standards for the 0.22 µm membrane" |

What the wiki supports: 0.2 µm, on seven pages. Note that the 0.22 µm figures on
Plants, Safety, Notebook and Milestone are the **syringe filter** used to prepare
the spray, which is a different object and is correct; only Entrepreneurship
applies 0.22 µm to the membrane.

Fix: 0.2 µm on Entrepreneurship, from the datasheet, in two places.
Owner: Entrepreneurship. **P2**

## 16. HADDOCK version and campaign count

| Page | Section | What it says |
|---|---|---|
| `peptide-design/index.html` | Reproducibility | "HADDOCK 2.5, distribution `haddock2.5-2026-07`, run locally. 121 production runs across seven campaigns." |
| `protein-design/assembly/index.html` | Binary docking | "HADDOCK 2.4 [1, 2]"; settings table "Founding campaign, 8 runs" and "Later campaigns, 113 runs" |
| `protein-design/restraints/index.html` | The founding campaign | "The founding campaign, eight runs"; the later 113 |
| `drylab-notebook/index.html` | week entry | "HADDOCK 2.5 adopted" |

What the wiki supports: 2.5, because Peptide Design and the dated notebook entry
agree and the distribution string is dated; Assembly's reference list cites the
HADDOCK 2.4 web-server paper, which is a citation and not the version run.
8 + 113 = 121 runs, so the run count agrees; "seven campaigns" against one
founding plus five later campaigns is the part that does not.

Fix: one version and one campaign count on Peptide Design, then match Assembly,
Restraints and Triage. Keep the 2.4 paper in the reference list if that is what
was cited, and say so.
Owner: Dry lab, protein design. **P2**

## 17. Which cassettes are the three controls

| Page | Section | What it says |
|---|---|---|
| `peptide-design/index.html` | The order | "D-01, D-06 and D-02 are the point of the order. They are wild type, S15A and G17A" |
| `protein-design/packaging/index.html` | The six cassettes | "D-03, D-06 and D-02 are wild type, S15A and G17A"; its own table lists D-01 as "BoPep4 9–23, N-terminal tag" and D-03 as "BoPep4 wild type 1–23" |

What the wiki supports: Packaging. D-01 is the 9–23 lead, D-03 is the wild type,
so Peptide Design's sentence has the wrong identifier.

Fix: change D-01 to D-03 in that sentence on Peptide Design.
Owner: Dry lab, protein design. **P2**

## 18. How many Pep sequences were aligned

| Page | Section | What it says |
|---|---|---|
| `protein-design/generate/index.html` | Sequence alignment | "BoPep4 was aligned against the *Arabidopsis* Pep series, AtPep1 to AtPep8" |
| `peptide-design/index.html` | The family varies everywhere except four positions | "Seventeen mature Pep sequences, seven from *Arabidopsis* and nine from *Brassica* species" alongside BoPep4 |

What the wiki supports: team to decide, and it is a small decision: either name
the eighth *Arabidopsis* sequence that was dropped, or correct "AtPep1 to
AtPep8" to the seven that were used.
Owner: Dry lab, protein design. **P2**

## 19. Codon metrics for the shipped BoPep4 cassette

| Page | Section | What it says |
|---|---|---|
| `protein-design/packaging/index.html` | Codon optimisation, Figure 1 starred row | selected variant start+15 0.497, SD core 0.634, CAI 0.68 |
| `peptide-design/index.html` | Codon optimisation | bottleneck 0.067 → 0.528 at CAI 0.78 |

What the wiki supports: team to decide. Both pages already box it (P8 and P9),
and one set has to come off the wiki once the objective that produced the shipped
sequences is settled. It matters because these are the sequences that were
ordered.
Owner: Dry lab, protein design. **P2**

## 20. Does the constitutive LEA construct exist

| Page | Section | What it says |
|---|---|---|
| `engineering/index.html` | build record, row H | "Screened at 1,372 bp on 25 July; still in assembly on the parts sheet" |
| `results/index.html` | The build, module H | "No clone and no date on record", counted as a failure |

What the wiki supports: team to decide, from the gel and the clone. The two
pages currently draw opposite conclusions about the whole LEA arm.
Owners: Engineering, Results. **P2**

## 21. The Level 2 circuit's verification status

| Page | Section | What it says |
|---|---|---|
| `engineering/index.html` | assembly plate, Level 2 node | "Junction-checked 1 September. Not sequenced end to end." |
| `engineering/index.html` | sheet 02, cycle 6; `results/index.html` | three independent clones checked at all three junctions on 19 September |
| `parts/index.html` | Level 2 callout | "Nothing on this wiki should describe the Level 2 circuit as verified" |

What the wiki supports: the 19 September check is the later evidence, so the
plate is out of date. Parts' caution is about end-to-end sequencing, which is a
different claim and still stands.

Fix: update the plate to the 19 September result and keep the sequencing caveat.
Owner: Engineering. **P2**

## 22. Module I's date, and the R5 primer sentence

| Page | Section | What it says |
|---|---|---|
| `engineering/index.html` | module 4 prose | "I3 and I6 carried the expected 1,588 bp band on 22 July" |
| `engineering/index.html` build record; `results/index.html` | module I | colony PCR 27 July, sequenced 28 July |
| `results/index.html` | R5, last sentence | "Engineering gives the 661 bp junction as CcaR F against CcaSm3 R" |
| `engineering/index.html` | F11 | prints CcaR F against Csn R, from the gel legend |

Fix: one date for module I; strike the last sentence of R5, which describes a
version of Engineering that no longer exists.
Owners: Engineering, Results. **P2**

## 23. Temperature of the long run

`hardware/photometer/index.html` 2.7 says "approximately 23 °C"; Measurement,
Software and Math Model all say 22 °C for the same run. Fix: 22 °C.
Owner: Hardware (photometer). **P2**

## 24. The 8% agreement figure

`hardware/photometer/index.html` 2.1 and 3.5.1 say "8%" for the paired reading
ReLeaf 0.431 against Bio-Drop 0.467; 2.4.1 on the same page computes the same
pair as "a 7.7% difference relative to the Bio-Drop value". 7.7% is the
arithmetic. The page's own "Not yet validated" box already says the 8% belongs to
iteration 3 and that the final build read 33% low, which is the honest part and
should stay.
Owner: Hardware (photometer). **P2**

## 25. Hydroponics: printed parts, and where the STLs are

`hardware/hydroponics/index.html` 1 says "Four printed parts"; 4.2 and 5.1
describe sixteen pieces and 5.2 lists four STL files. The same page says the STLs
are "in the project repository under `hydroponics-cad/`", and no such folder
exists in this repository. Fix: "four designs, sixteen pieces", and publish the
STLs beside the page. For Best Hardware the files are required, not optional.
Owner: Hardware (hydroponics). **P2**

## 26. Bioreactor version names

The same two builds are "cycle 1 / cycle 2" on `hardware/bioreactor/index.html`,
"prototype I / prototype II" in the hardware notebook and "Version 1 / Version 2"
on `results/index.html` and `measurement/index.html`. Fix: one name, then one
search and replace per page. **P2**

## 27. DiOPAL LEDs, bought against used

`hardware/diopal/index.html` BOM lists 12 green and 12 red; section 4 says forty
were bought and 24 used, and the notebook's week 20 entry records two dead reds
out of the packet, while the page says "All twenty of each colour" were measured.
Fix: say bought, measured and used as three numbers. **P2**

## 28. *B. subtilis* cell dimensions

`results/index.html` calls it "a rod of 1 to 2 µm" in the containment argument
and "0.8 by 3 µm" in the fouling model, neither cited. Fix: one cited dimension,
used in both places and on Safety before the Safety Form goes in on 7 October.
Owner: Results. **P2**

## 29. Chlorophyll extraction volume

`plant/index.html` says "V was 1 mL, 2 mL or 4 mL depending on the set";
`measurement/index.html` has 2 mL and 4 mL only; `experiments/index.html` E13 has
4 mL, 2 mL and one run at 7 or 9 mL. Fix: one page holds the list, the other two
link to it, and somebody checks whether any run really used 1 mL. **P2**

## 30. Electroporation voltages

`experiments/index.html` gives "2.1, 2.2 or 2.3 kV" for strain 168;
`engineering/index.html` records 2.0, 2.1 and 2.2 kV on 22 May and 2.1, 2.3 and
2.5 kV on 23 May; `measurement/index.html` describes the first two pulses at 2.0
and 1.8 kV. Fix: say whether the protocol lists the sweep or the working window,
and make the list match the record. **P2**

## 31. Has ACC deaminase ever been on a plant

`measurement/index.html` says ACC deaminase "has produced no plant number at
all"; `plant/index.html` fix 7 records a soil ACCD trial with five named arms,
23 August to 1 September, with no measurement taken. Fix: "unmeasured" rather
than "never run", or say why the soil arm does not count. **P2**

## 32. Other cross-page items carried over from the seven notes, verified

| Fact | Where it disagrees | Priority |
|---|---|---|
| Stakeholder return visits | `human-practices/index.html` "went back to seven stakeholders" against "Six advisors met us more than once"; the evolution map says 7 return threads | P2 |
| Prof. Huang's title and which Prof. Huang | `human-practices/index.html` uses both "Prof. Huang (黃介辰)" and "Dean Huang (黃介辰)", and there is a second Prof. Huang (黃姿碧); `sustainability/index.html` says "Prof. Huang" without distinguishing them | P2 |
| Prof. Huang's date | Human Practices says the point was made "a week later" (28 July) in one place and "in August" in another; Sustainability says July | P2 |
| Public forum attendance | `human-practices/index.html` "more than fifty members of the public" against `data-physicalization/index.html` "116 visitors, 62 surveys" | P2 |
| Education total | `education/index.html` "roughly 144 students" against its own table (127 pre-survey plus an unrecorded junior-high n) | P2 |
| Bilingual slides | `education/index.html` "Every slide we showed was bilingual" against the later finding that the decks became bilingual after trial 2 | P2 |
| Lesson rebuild count | `sustainability/index.html` "rebuilt the lesson four times" against Education's four trials, which is three rounds of changes. The Milestone "third rewrite" sentence the notes cited came off the page with the old timeline | P3 |
| SDG sets | `entrepreneurship/index.html` claims SDGs 2, 8, 11, 12, 13, 15; `sustainability/index.html` claims 2, 10, 4, 15 and explicitly declines 13 and 12 with reasons | P2 |
| Geospatial routing tool | `geospatial-analysis/index.html` says the tool "fetches Leaflet from a CDN"; Leaflet is bundled locally | P2 |
| Farmer's method | `entrepreneurship/index.html` says Ms. Chen "farms organically"; Human Practices, Sustainability and Geospatial all say natural farming, which is a different thing in Taiwan | P3 |
| ReLeaf's sensing mechanism | `education/index.html` twice says ReLeaf is "built on a stress-responsive promoter"; Description and Engineering describe a green-light CcaS–CcaR switch driven by a forecast | P2 |
| Prof. Cheng's name | `hardware/hydroponics/index.html` "Prof. Cheng Mei Jun" against "Cheng Mei-Chun" on Plants, Human Practices, Notebook, Safety and Gallery (and once on the hydroponics page itself) | P3 |
| Renée Kuo | `assets/data/roster.js` and `team/index.html` have "Renee Kuo"; `drylab-notebook/index.html` and one line of `team/index.html` have "Renée Kuo" | P3 |
| Dr. Pak | `assets/data/roster.js` has "Dr. Pak"; `drylab-notebook/index.html` has "Dr. Pak K. Yuet" seven times | P3 |
| Ambiguous first names | `engineering/index.html` credits "Olivia, Sophia"; the roster holds two Olivias and two Sophias. The same page writes "Sophie C" elsewhere, which is the pattern to copy | P3 |
| Part naming | `description/index.html` says "LEA14"; Engineering and Parts call it "Lea", "Csn:LEA" and "LEA" | P3 |
| fibre against fiber | `hardware/bioreactor/index.html` uses "fiber" 26 times and "fibre" once; `hardware/photometer/index.html` "fiber" 3 times; `description/index.html` "fiber" 7 times; `index.html` uses both 4 times each; everything else on the wiki (Measurement 16, drylab notebook 21, Entrepreneurship 11, Results 7, Software 5, Human Practices 8) uses "fibre" | P3 |
| American against British spelling | `description/index.html` mixes *recognize, localized, specialized, centralized, labor, fiber* with *colour, neighbour, labour, modelling, kilometres, defences*. Already tabulated in `notes/qa-2026-09-23/typos.md` §4 | P3 |
| wetlab against wet lab | In visible prose this is down to two member bios in `assets/data/roster.js` ("one of wetlab instructors") and two data-folder names quoted on Measurement and Results. The `data-tab="wetlab"` attributes and CSS class names are code, not prose, and need no change | P3 |
| RELEAF / GEMS-Taiwan | Hardware prose still spells the project and team that way in places; titles and meta were fixed on 25 September. Rest of the wiki: ReLeaf, GEMS Taiwan | P3 |
| Lower-case first names | The hardware notebook scans read "abby" and "jacquelyn"; the roster has two Abbys (Kao, Tsai) and Jacquelyn Inocencio. Fixing these means editing the scan source and re-exporting | P3 |
| Photometer section numbering | `hardware/photometer/index.html` jumps 2.4 → 2.7, 3.2 → 3.5 and 4.3 → 4.5, and the bioreactor page cites "Photometer 3.5", so both change together | P3 |
| Hub instrument count | `hardware/index.html` says "INSTRUMENTS 4" while its own key lists six kinds of build and notebook page 1 says eight things were made | P3 |
| Written-by lines | `description/index.html` and `contribution/index.html` say "Project leads"; the Team page lists nobody as a lead. Most other pages name a sub-team; Engineering names individuals per cycle, which is the best of the three patterns | P3 |

## 33. Facts the home page states and no sub-page carries

The home page's own rule is that no number originates there. Several do. These
are listed as one group because the fix is the same each time: give the number a
home on the page that owns the evidence, or take it off the home page.

| Home page says | Section | Where it should live |
|---|---|---|
| "97% of mapped farmland lies in parcels under 2 ha, rising to 99.8% of the parcels in the most volatile band" | The problem, threat figures | Geospatial Analysis, which currently says "more than 80% of farmers work small-scale farms, yet those holdings together account for less than 9% of agricultural land". Neither the 97% nor the 99.8% appears there, and the two statements are not obviously the same measurement |
| Map class breaks 0.49, 0.60, 0.71, 0.82, and the "first 15% / a quarter of small-farm land" shares | Map legend and lede | Geospatial Analysis states only the 0.38 to 0.93 range and the 0.71 break; add the band table there |
| "Between 34% and 46% of flash droughts" | The problem | Geospatial says "nearly half now developing inside a single five-day window"; one wording, one source |
| Pivot Bio dates, the EU's four organism groups, registration timelines, "18 inoculants, 44% pathogens" (references 4 to 10) | The problem | Description 2.2 or Entrepreneurship, with the same references |
| "117 reads and 61 clones", the team's own ABIF reader | big-picture tile alt text | Engineering or Software, or cut it from the alt |
| "BAPHIQ has not answered" | big-picture tile alt text | Laws and Regulations, which mentions BAPHIQ only as a risk |
| The permeate transport tile | big picture | Its evidence was on the deleted page. Move it to Math Model or Hardware → Bioreactor, or drop the tile and change "Twenty-nine" in the lede and the spine's aria-label |

Other home page items worth settling, all **P2** unless marked:

- "damages rice at grain filling" against Geospatial's "grain-setting". P3.
- "By the Datun Stream in Tamsui · Chen's farm" against Human Practices'
  "Ms. Chen Hui-wen's (陳惠雯) Happy Farm in Tamsui", and "Farmer Chen" in the
  hero. One romanisation in English text. P3.
- The farm visit card says the visit "moved dosing off a wall clock and onto
  soil-moisture state"; Human Practices records the outcome as acting when
  stress is forecast, at the seedling stage. Two different accounts of the same
  visit, and only the people who were there can say which is right.
- The Yes Health card says the visit "sent the hardware team back to the CAD the
  same afternoon"; Plants says it "sent the dry lab back to the hardware
  drawings the same day". Same event, two teams. P3.
- The agar-boxes tile is dated 5 July 2026; Experiments dates the plant salt and
  heat sets from 25 July. Check the photograph's date.
- The alignment tile says BoPep4 was aligned "against the eight *Arabidopsis*
  Peps"; see fact 18.
- "Every drawing and model ... under CC BY 4.0" against Hardware, which states
  CC BY 4.0 for site content and MIT for JavaScript and no licence for the CAD
  and STL files. A team cannot reuse a design whose licence is unstated, and
  Contribution now says so. **P1 for Best Hardware.**
- The home page gives green 520 nm and red 660 nm plainly; DiOPAL marks those as
  assumed pending measurement. Add the qualifier. See fact 1.
- "a dial rather than a fuse" is design intent, and Results and Math Model say no
  induction curve was measured. Mark it as intent.
- The site-nav Hardware caption says "Three instruments, taken apart"; the
  hardware hub says four were built. The home page's Dry Lab door was corrected
  overnight; the shared nav caption still says three.
- The OD600 comparison (0.8 to 0.9 in two hours against 0.6 to 0.8 in four and a
  half) is one run each, which Results says and the home page does not. Add it.

## 34. Claims from the notes that did not survive checking

Recorded so nobody chases them twice.

- **"Milestone says forty-seven people" (team note).** Those sentences came off
  the page when Milestone was rebuilt. The remaining 47s are the home page and
  the Team blurb in `assets/data/site-nav.js`.
- **"Milestone says third rewrite of the lesson" (engage note).** Also gone with
  the old timeline.
- **"Results, culture monitoring: 'A curve you cannot put a number on is a
  hypothesis, not a measurement'" (milestone note).** That sentence is not on
  Results. The nearest real sentence is on `milestone/index.html`: "A curve with
  the right shape and the wrong scale is a hypothesis, not a measurement."
- **Measurement M6, Experiments E9 and Results R2 describing 1.8 mm as "the
  figure currently on Plants".** Plants publishes 1.36 mm now. See fact 6.
- **"Bioreactor Calculations is cited on md-simulations" (drylab note).** The only
  mention there is inside a review note, not in prose.
- **PRODUCT.md's "twenty-two cycles across four tracks"** describes an Engineering
  page that has since narrowed to six cloning cycles. That is a stale note file,
  not a page inconsistency.
- **"The home page says a 500 mL reservoir and Milestone says a 300 mL medium
  reservoir" (home note).** Milestone reads "a 500 mL reservoir holding 300 mL of
  LB with a 20 mL inoculum" in both places, which is the same thing the home page
  says. No conflict.
- **"notes/structure.md's homepage ledger, 3 weeks of unbroken OD600 logging"**
  (cited by the project and drylab notes as a fourth run length). The home page
  has carried no such ledger since 21 August; its only run length is 434 h in a
  tile's alt text. The stale sentence is in `notes/structure.md`, not on a page.

---

## 35. Sentences that still name the deleted Bioreactor Calculations page

34 mentions in prose, across nine pages, grouped by the claim each one supports.
One more (`engineering/index.html`, top of file) is an HTML comment and invisible
to readers. None of them is a link any more, so nothing is broken; what is
missing is a source for the claim.

### a. "Where the reactor physics lives" pointers (7 sentences)

| Page | Section | What it says | What it needs |
|---|---|---|---|
| `measurement/index.html` | Measurement map | "the reactor physics on Bioreactor Calculations" | A destination, or the clause comes out. This is the page's only pointer to the physics |
| `software/index.html` | Adapting it to another rig | "the transport and membrane calculations on Bioreactor Calculations" | Point at Math Model section 8, or say the file is unpublished |
| `results/index.html` | Whole system | "the hydraulics on Bioreactor Calculations" | Same |
| `description/index.html` | Abstract, How to read this page | "Bioreactor Calculations the transport arithmetic" | Drop the clause from the reading guide |
| `description/index.html` | Containment and delivery, Figure 4 caption | "The membrane sizing, the flux arithmetic and the pump floor are on the Bioreactor Calculations page" | Reword the caption: the pump floor is now unsourced (fact 3) |
| `engineering/index.html` | cycle 5, ACCD in the reactor | "The reactor and its membrane are on Hardware and Bioreactor Calculations" | "on Hardware" is enough |
| `engineering/index.html` | What is next, sheet 08 | "the perfusion reactor and the in-line photometer are on Hardware and Bioreactor Calculations" | Same |
| `experiments/index.html` | Protocols held elsewhere | "with the derived parameters on Bioreactor Calculations" | Name the file, or point at Measurement |

### b. The pump floor of 230 mL/min (4 sentences)

`measurement/index.html` (Figure 6 caption, M11, and the M11 line in the
references summary) and `results/index.html` R4. The 230 figure and the shear
table built on it now have no published source. Either move that derivation onto
Measurement, or present 230 as the vendor sheet range only, and redraw Figure 6's
amber line. See fact 3. **This is the one to fix first**, because the page itself
makes the pump floor the interesting question.

### c. Lumen volume, fibre count and module specification (3 sentences)

`measurement/index.html` M13, M14, and the sources line under the pressure and
flow meter. The 3.74 mL holdup, the eight-fibre 150 cm2 specification, the sensor
specification, the error analysis and the Darcy-Starling treatment all came from
the deleted page. Either the derivations move onto Measurement or the team names
the calculation file and says it is unpublished. See fact 4.

### d. Containment, pore size and the log reduction value (2 sentences)

`measurement/index.html` membrane breach detector ("Containment argument and the
pore size") and `results/index.html` R8. R8 is the most important sentence in
this whole section: the only page that said the log reduction value was never
measured was the deleted one. That statement has to move onto Results or Safety
rather than disappear, or the wiki will read as though a number exists.

### e. Growth fit, promoter parameters and the ACC handoff (10 sentences)

All on `model/index.html`: the vessel physics sentence in The model chain; the
promoter-output paragraph that sources K = 4.66 and n = 1.88; the equation (9)
note with the 37 °C logistic refit, mu_max 1.31 h-1 and X_max 1.54 OD600; the
two-carrying-capacities paragraph; the 105.1 ± 1.5 min activation half-time
sentence; fix M8, the ACC deaminase against ACC oxidase handoff; two rows of the
parameters table; the "Not modelled" row for membrane transport; the "promised to
this page and not delivered" row; and reference [1]'s note. Decision for the
team: bring the transport calculation into Math Model as a fourth short model, or
cite Hardware → Bioreactor. The 105.1 min half-time should cite reference [1]
directly, since the reference is on the page.

### f. Human Practices (3 sentences)

`human-practices/index.html`: the Modelling row of the 3.1 expert table, the
Prof. Chen Wen-liang tab ("see Bioreactor calculations"), and the 6.1 open item
about how many reactors a farm needs. Point the first two at Math Model (the salt
arm fitted to the dose ladder, and the deployment model), and give the open item
a real destination or mark it unanswered. Note the lower-case "calculations"
here, which suggests these were written as prose rather than as links.

### g. Invisible

`engineering/index.html` carries the name inside the HTML comment at the top of
the file, which no reader sees. It can go with the rest of the scope note
whenever that comment is next edited.
