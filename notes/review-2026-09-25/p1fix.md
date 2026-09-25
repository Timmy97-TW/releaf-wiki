# p1fix, 25 September 2026

Branch `night/p1fix`. This pass took only the items in
`notes/review-2026-09-25/INCONSISTENCIES.md` that the wiki itself settles:
references and addresses, quotations of another page's number that the other
page has since changed, and spelling or naming variants with one authoritative
source. Everything the ledger marks "team to decide" was left alone, including
the run length, the fusion protein mass, the pump floor, the wavelengths, the
containment layers and the first market.

## 1. What I changed

| Commit | What |
|---|---|
| d928cb1 | Castillo-Hair 2019: one reference on every page that cites it |
| d10c538 | Software: the iGEM repository address in its 2026 form |
| d6b4f4a | Math Model M1, Experiments E9, Measurement M6: Plants publishes 1.364 mm |
| bf86ef4 | Results R2: the same stale quotation of Plants |
| cf5c3d1 | Description: hollow-fibre in six places |
| 2a33c38 | Safety, Parts, Plants: three species names italicised in prose |
| 071afa6 | Dry lab notebook: Renee Kuo, the roster spelling |
| d277324 | Geospatial Analysis: Leaflet is vendored, not fetched from a CDN |
| e10f52c | Plants and Notebook: Dingxi, the Education page's romanisation |
| 1ba25fa | Entrepreneurship: the membrane pore is 0.2 um |
| 6f0875c | Results R5: the primer sentence struck |
| 9196383 | Peptide Design: the three controls are D-03, D-06 and D-02 |

Detail, in the order of the ledger.

**Fact 10, the Castillo-Hair citation.** The DOI on the pages,
10.1038/s41467-019-10906-6, was checked through PubMed (PMID 31308373) and
resolves to Castillo-Hair, S. M., Baerman, E. A., Fujita, M., Igoshin, O. A. and
Tabor, J. J., *Optogenetic control of Bacillus subtilis gene expression*,
*Nature Communications* 10, 3099 (2019). Results, Parts and Engineering already
had it right. Peptide Design (reference 13) and Packaging (reference 1) carried
the title *Optimizing 5' mRNA structure for translation initiation* on the same
volume and pages; both now carry the correct title, author list and the DOI
link. Math Model's author list (Baerentsen, Reyes-Osorio, Baumschlager,
Khammash) was replaced with the real one. A check of every DOI in every
reference list on the wiki found no other DOI carrying two different entries.

**Fact 9, the software address.** `software/index.html` now says the mirror goes
to `gitlab.igem.org/2026/software/<team>/`, the address in `notes/publishing.md`
and `notes/overnight-2026-09-23.md`. The mirror itself is still to be made.

**Fact 6, the 150 mM root length.** Four pages quoted Plants for a value Plants
no longer publishes. Math Model M1 and its status strip, Experiments E9 and its
sources line, Measurement M6 and Results R2 now say Plants publishes 1.364 mm
(and 14.713 mm for 100 mM with trehalose) from the per-seedling workbook, and
name `Experiment Set 6 Root Length.docx` as the file out of step. No other
number in those sentences was touched.

**Fact 22, the R5 primer sentence.** Struck, as the ledger asks: Engineering now
prints CcaR F against Csn R for the 661 bp junction, which is what the Results
gel legend says.

**Fact 17, D-01 against D-03.** Peptide Design's own cassette list has D-01 as
BoPep4_9-23_NHis and D-03 as BoPep4_WT_1-23_NHis, so the sentence naming the
three controls had the wrong identifier on its own page as well as against
Packaging.

**Fact 15, the pore rating.** Entrepreneurship's two membrane mentions now read
0.2 um, the rating the vendor part number in the Results reference list carries
and the figure on seven other pages. The 0.22 um syringe filter on Plants,
Safety and Notebook is a different object and was not touched, and the
containment-layer claim in the same sentence (fact 8) is untouched and still
flagged.

**Fact 32, spelling and naming.**
- hollow-fibre: Description's six occurrences. The FiberCell brand name in the
  dry lab notebook is a product and stays.
- Renee Kuo: the notebook's three entries, from the roster and her own profile.
- Dingxi Elementary: Plants (three) and Notebook (one). Dates untouched.
- Species italics: three prose occurrences (Safety, Parts, Plants references).
  Everything else the scan found is alt text, a file name, an SVG label or a
  meta description, where italics do not apply.
- wetlab: nothing left to change in prose. Every occurrence is a file or folder
  name, a Zotero folder name or a member's own bio.
- ReLeaf capitalisation: nothing outside Anton's pages. `window.RELEAF_ROOT` in
  404.html is a variable name.

**Geospatial routing tool.** `routing/index.html` loads
`vendor/leaflet-1.9.4/leaflet.js` and `.css` from the repository, so the "fetches
Leaflet from a CDN" bullet was wrong. The tiles and the OSRM routes are still
external and the bullet still says so.

Where a review note asked for exactly one of these fixes, the note stays and its
Fix paragraph ends with "(Fixed overnight: ...)". That is the case on Peptide
Design, Packaging, Software, Math Model, Experiments, Measurement, Results,
Description, Entrepreneurship, Plants and Geospatial Analysis.

`python3 build/audit.py` is clean: external 0, missing 0, anchor 0, cite 0,
dupid 0, alt 0, parse 0, unchanged from before this pass.

## 2. Deferred: Anton's pages (hardware/)

Not edited, because `hardware/` is Anton's repository.

| File | Exact edit |
|---|---|
| `hardware/bioreactor/index.html` | 27 occurrences of "fiber"/"fibers" to "fibre"/"fibres" (the page already has one "fibre"). The rest of the wiki uses fibre |
| `hardware/bioreactor/js/components.js`, `promo.js`, `promo-parts.js`, `parts.js` | the same 13 occurrences in the visible strings |
| `hardware/photometer/index.html` | 3 occurrences of "fiber" to "fibre" |
| `hardware/bioreactor/index.html`, `hardware/index.html` | "RELEAF" in prose (11 places) to "ReLeaf" |
| `hardware/index.html`, `diopal`, `hydroponics`, `notebook`, `photometer`, `bioreactor` | the outro line "GEMS-Taiwan" to "GEMS Taiwan", one per page |
| `hardware/hydroponics/index.html` | "Prof. Cheng Mei Jun" to "Prof. Cheng Mei-Chun", the spelling on Plants, Human Practices, Notebook, Safety and Gallery, and used once already on the hydroponics page itself |
| `hardware/notebook/` scan sources | lower-case "abby" and "jacquelyn" in the scans. Needs the scan source edited and re-exported, so it is a person's job, not a search and replace |

`software/ui/0906UI.html` carries 36 "fiber" spellings and is hash-pinned, so it
was left alone on purpose. If the hash is ever re-cut, that file should follow.

## 3. What stays for the team

Everything the ledger marks "team to decide", untouched and still flagged:
the long photometer run length (fact 2), the pump floor and flow rate (3), the
membrane fibre count, area and lumen volume (4), the ACC deaminase and fusion
mass (5), the photometer's position in the loop (7), the containment layers and
the kill switch (8), the Dingxi and Fushing session dates (11), the headcount
46 against 47 (12), the first market (13), which stress each protectant is for
(14), the HADDOCK version and campaign count (16), how many Pep sequences were
aligned (18), the codon metrics for the shipped cassette (19), the constitutive
LEA construct (20), the Level 2 verification status on the assembly plate (21),
module I's date (22), and everything in facts 23 to 33.

Two things I decided not to do although the ledger names a fix, because the
change is a claim rather than a citation:

- Fact 21, the Level 2 plate. The ledger says the 19 September check supersedes
  the 1 September node text. Changing a verification status on a diagram is a
  claim about what was measured, so Engineering's owner should make it.
- Fact 32, "farms organically" on Entrepreneurship against "natural farming" on
  three other pages. In Taiwan these are different practices and only the people
  who met Ms. Chen can say which is right.

Two citation questions are open and no page can settle them:

- Packaging's opening paragraph cites reference 1 for the claim that messenger
  RNA structure around the ribosome binding site dominates translation
  initiation. The reference is now the optogenetics paper, which is not that
  result, so either the claim needs its own source or the page meant a second
  Castillo-Hair paper. The whole codon section rests on it.
- Math Model's reference 2, "Ohlendorf et al. 2019", is still unlocated, and
  K = 4.66 and n = 1.88 hang off it (fix M5).

## 4. Requests for the shared layer

- `assets/data/roster.js` line 418, a member bio reads "one of wetlab
  instructors". It is her own writing, so it is the lead's call whether to touch
  it; the rest of the wiki writes "wet lab" in prose.
- `assets/data/site-nav.js` Team blurb still says "The forty-seven of us" against
  46 on the roster (ledger fact 12), and the Hardware caption says "Three
  instruments, taken apart" against four on the hardware hub.
