# Dry Lab cluster, overnight review, 25 September 2026

Pages covered: `/model`, `/software`, `/protein-design` (hub plus Generate,
Restraints, Assembly, Triage, Packaging), `/peptide-design`, `/md-simulations`,
`/drylab-notebook`. Hardware is a separate cluster and was not touched.
`software/ui/0906UI.html` is hash-pinned and was not touched. The nine
`md-simulations/*.html` reports are generated and were not touched.

`python3 build/audit.py` is clean: missing 0, anchor 0 (it was 6 before
tonight), dupid 0, alt 0, external 0.

## 1. What I changed

| Commit | What |
|---|---|
| `077d522` | Math Model: fixed ids on the four subsections other sections link to, so the six broken anchors audit.py reported now resolve with JavaScript off |
| `c18a0d7` | Math Model: chain cards, equation blocks, fix boxes, ledgers and figures follow the drawing-set rules (square corners, hairline rules, no hover lift, no 3px state bars, stamp dots on the state tags) |
| `8cec38f` | Math Model: a review note at the end of all eight sections, read against the Best Model rubric |
| `f1ec7e1` | Software: the four counts under section 1 become a ruled quantity schedule instead of a hero-metric row; chips, stamps, embed frame and callouts square off |
| `6570e43` | Software: a review note at the end of all seven sections, read against Best Software Tool |
| `ce520b1` | Protein Design: step cards, gap boxes, fix boxes, callouts and figure frames aligned across the six pages |
| `17d9069` | Protein Design: a review note at the end of every section on the hub and the five step pages (31 notes) |
| `f3a77a7` | Peptide Design: page-local pills and rounded panels squared off, callout bar reduced to a hairline |
| `b001e0c` | Peptide Design: a review note at the end of all fourteen sections |
| `bcbedd0` | MD Simulations: a review note per section, and the run cards move their state colour from a left bar to the top rule |
| `9486240` | Dry Lab Notebook: one review note in the week strip (the page has no other static h2) |
| `52723fd` | Software: Next now points at Protein Design, which is the page that follows it in the tab |
| `356f7d1` | Dry Lab Notebook: Previous now points at Peptide Design, which already pointed here as its Next |
| `ee8e313` | Dry Lab Notebook: meta description says twenty-three weeks, matching the 23-entry WEEKS array |

66 review notes in total. No student body prose was rewritten anywhere in this
cluster. Two mechanical fixes only: the meta description week count, and the
two pager links above.

### The deleted Bioreactor Calculations page

The page is gone and no link in this cluster points at it, but eight sentences
on `/model` and one on `/software` still name it in prose, and the Math Model
page leaned on it for membrane transport. I left the prose alone and wrote the
consequence into the review note of every section that depends on it:

- `model/index.html:111` the vessel physics sentence (section 1 note).
- `model/index.html:356` the equation (9) note, which sources the 37 °C
  logistic refit, mu_max 1.31 h^-1 and X_max 1.54 OD600 (section 4 note).
- `model/index.html:375` fix M6's second carrying capacity (section 4 note).
- `model/index.html:388` the 105.1 ± 1.5 min activation half-time, which should
  now cite reference [1] directly (section 4 note).
- `model/index.html:504` fix M8, the ACC deaminase against ACC oxidase handoff
  (section 5 note).
- `model/index.html:553`, `:560` two parameter-table rows citing the page
  (section 6 note).
- `model/index.html:611` the "Not modelled" row for membrane transport
  (section 8 note).
- `software/index.html:578` the closing sentence of "Running the software"
  (section 7 note).

The decision the team has to make is the same in each case: either bring the
calculation into `/model` as a fourth short model, or cite
`Hardware: Bioreactor`. I did not make it for them.

### Hardware pager

Nothing to fix on the Hardware side: the five hardware pages carry no
prev/next pager at all and no links back into `/model` or `/software`. Math
Model's Next and Software's Previous both point at `/hardware`, so the chain
enters Hardware and stops there. See "Requests" below.

## 2. Writing inconsistencies

Inside my cluster, and against pages outside it. All are flagged in the review
note of the section they sit in; none was silently corrected.

| Where | What it says | What the other place says | Suggested resolution |
|---|---|---|---|
| `peptide-design/index.html:1905` | "D-01, D-06 and D-02 are the point of the order. They are wild type, S15A and G17A" | `protein-design/packaging/index.html:216` "D-03, D-06 and D-02 are wild type, S15A and G17A"; the same page's own table has D-01 as BoPep4 9–23 and D-03 as wild type | D-01 is wrong on Peptide Design. Change it to D-03 there. |
| `peptide-design/index.html` §14 reproducibility | "HADDOCK 2.5, distribution haddock2.5-2026-07 … 121 production runs across seven campaigns" | `protein-design/assembly/index.html:70` "run in HADDOCK 2.4 [1, 2]"; Restraints and Triage describe one founding campaign of 8 runs plus five later campaigns, which is six | Settle the version and the campaign count once, on Peptide Design, and make Assembly, Restraints and Triage match. |
| `protein-design/packaging/index.html` ref [1] and `peptide-design/index.html` ref [13] | Castillo-Hair et al., "Optimizing 5′ mRNA structure for translation initiation", *Nature Communications* 10, 3099 (2019) | `model/index.html` ref [1]: Castillo-Hair et al. (2019) "Optogenetic control of *Bacillus subtilis* gene expression", *Nature Communications* 10:3099 | Same volume and pages, two different titles. One citation is wrong and three pages depend on it. Check the DOI. |
| `protein-design/packaging/index.html` Figure 1 starred row | selected BoPep4 variant: start+15 0.497, SD core 0.634, CAI 0.68 | `peptide-design/index.html` §10: bottleneck 0.067 → 0.528 at CAI 0.78 | This is fix P9 and is already boxed. One set has to come off the wiki once P8 (sum against bottleneck) is settled. |
| `protein-design/generate/index.html` §2 | BoPep4 aligned against "the *Arabidopsis* Pep series, AtPep1 to AtPep8" | `peptide-design/index.html` §3: seventeen sequences, "seven from *Arabidopsis* and nine from *Brassica* species alongside BoPep4" | Seven against eight. Say which sequence was dropped, or correct the count. |
| `model/index.html:220` (fix M1) | day-6 150 mM root length 1.364 mm, suppression 55-fold | `/plant`: 1.8 mm, suppression 43-fold | Already boxed as M1. Settle before the freeze and change both pages in one commit. |
| `model/index.html:374` (fix M6) | carrying capacity 1.456 OD600 read at about 250 h | `software/index.html` R3: OD channel unusable from 243.0 h | Already boxed as M6. The plateau is read after the sensor alarm. |
| `software/index.html:578` | software repository to be mirrored to `gitlab.igem.org/2026/software-tools/` | `notes/overnight-2026-09-23.md` §4.6: the 2026 address is `gitlab.igem.org/2026/software/<team>/`; `2026/software-tools` does not exist | Correct the address on the page and do the mirror. This one can cost the award. |
| `peptide-design/index.html` §9 | "The seven cassettes already at synthesis" | §11 and Packaging describe the six-cassette order of 20 August | Two different batches. Say so explicitly in §9. |
| `drylab-notebook/index.html` meta | was "twenty weeks" | WEEKS array has 23 entries, record runs 28 Mar to 4 Sep | Fixed tonight. |

## 3. Strong student writing worth keeping

Written by "Dry lab, modelling" (`/model`), "Dry lab, software sub-team"
(`/software`) and "Dry lab, protein design" (the Protein Design section); no
individual author is named in the page headers.

- **`/peptide-design` §7, the benchmark.** "The three analogues Pearce measured
  as catastrophic rank 7th, 8th and 9th out of sixteen." The team designed the
  test that could show its own method does not work, ran it, and published the
  failure with the corrected statistic and the reason the earlier internal
  number was inflated. This is the strongest passage in the Dry Lab tab.
- **`/peptide-design` §8, the ledger.** "Removed from the order the morning it
  was due to ship." Fourteen claims with their standing, five withdrawn, one
  withdrawn twice for two different reasons, each with the measurement that
  killed it.
- **`/model` §3.3.** "A dose response that is internally consistent to two
  decimal places across three independent pairs is telling us something about
  the plant." The fit is defended on the right grounds and the weak grounds are
  named first.
- **`/model` §4.4.** "This is the sentence the section exists to make plainly.
  There is no induction curve." Then three consequences, separated because they
  have different fixes, and the one experiment that closes most of them.
- **`/software` §4, defects.** "Two fabricated measurements on screen and in
  every export." A team publishing a defect list of its own software, with the
  experiments each defect blocks, is unusual and credible.
- **`/software` §5, conventions.** "The commit time is the proof." Freezing a
  model in a committed JSON file before collecting the data it will be scored
  on is a reusable practice and belongs on the Contribution page.
- **`/md-simulations` §3.** "So 2.4% is not a weak salt bridge. There is no
  salt bridge there to be weak." A careful correction of the team's own metric
  on the one construct where it measures an atom that does not exist.
- **`/protein-design/triage` §6.** "A pipeline that cannot recover a known
  answer is not ready to produce an unknown one." The most transferable
  sentence in the section.
- **`/protein-design/restraints` §4.** "A run built that way cannot reject its
  own input." Eight founding runs against 113 later ones, stated without
  blaming anyone.

## 4. Needs a person

1. **Which pages absorb the deleted Bioreactor Calculations material.** Eight
   claims on `/model` and one on `/software` depend on it. I left the prose and
   wrote the choice into the notes; somebody has to choose.
2. **Fix M2 on `/model`.** The nine constants of equations (1) to (3) are not
   written down anywhere on this wiki or in the source document. Until they are
   in the section 6 table the stress index cannot be reproduced by a judge, and
   that is the single largest risk to Best Model.
3. **Fix M5 and reference [2] on `/model`.** No 2019 CcaSR paper by Ohlendorf
   has been located, and K = 4.66 and n = 1.88 carry two equations.
4. **The Castillo-Hair citation** (see table above) needs the DOI checked; it
   affects `/model`, `/protein-design/packaging` and `/peptide-design`.
5. **Fix P10 on `/protein-design/packaging`.** Somebody has to open the six
   sequences that shipped on 20 August and confirm the 6xHis tag is N-terminal
   in all of them. This is a check on DNA that has already been ordered.
6. **The software mirror to iGEM GitLab**, at the correct 2026 address, before
   21 October. Best Software Tool requires it.
7. **`/drylab-notebook` weighs 9.7 MB in one HTML file.** iGEM Pages builds are
   capped at 10 MiB. The entry data should move into
   `drylab-notebook/data/*.js` before the upload. I did not split it tonight
   because it changes how the page loads and needs testing.
8. **No-JavaScript fallbacks.** The Dry Lab Notebook board, the MD Simulations
   map, design matrix and cross-run table, and the Peptide Design ledger filter
   are all script-built. The brief asks every page to read as prose, figures and
   references with scripts off. Shipping the rows as markup and letting the
   script enhance them is the fix; it is a bigger change than an overnight pass
   should make unattended.
9. **`/md-simulations` is the only bilingual page in the tab.** My review notes
   there are English only. Either translate them or accept that the notes are an
   internal English layer, and delete them before the freeze along with all the
   others (`grep -rl 'class="review-note"' --include=*.html .`).
10. **Figure 1 on Generate and Figure 1 on Packaging are photographs of
    tables.** Their numbers cannot be selected, searched or read on a phone.
    Transcribing at least the load-bearing columns into HTML is worth doing and
    needs someone who can read the source tables.

## 5. Requests for the shared layer

1. **Hardware has no prev/next pager.** `/model` points Next at `/hardware` and
   `/software` points Previous at `/hardware`, and the hardware pages carry no
   pager markup at all, so the Dry Lab reading chain dead-ends there. Either the
   hardware cluster adds a pager (Previous: Math Model, Next: Software) in its
   own dark styling, or the lead decides the chain skips Hardware and the two
   dry-lab pages point at each other. I did not change my side, because
   guessing would break the pair a second time.
2. **`assets/js/review-notes.js` toggle position.** On pages that also show the
   iGEM rule-check button the two controls stack in the bottom-left corner and
   the review toggle sits directly above it. It reads fine at 1440 px and is
   tight at 390 px. If the shared agent is touching that file, a small
   horizontal offset when both are present would help.
3. **`page.js` heading ids.** Ids for h2 and h3 are generated at runtime, so
   any cross-page link to a subsection breaks with JavaScript off and
   `audit.py` counts it as a broken anchor. Tonight I added static ids to five
   h3s on `/model`. A shared decision to write ids into the markup, or a build
   step that does it, would stop this recurring.
