# Overnight pass, 25 September 2026

What changed on the wiki overnight, where the writing review is, and what needs
a person. Everything is on `main` and live at
<https://timmy97-tw.github.io/releaf-wiki/> (press Cmd+Shift+R once if a page
looks old: GitHub Pages lets browsers keep scripts for 10 minutes).

Work was split across parallel agents, one per tab plus a shared design layer,
each on its own branch, and merged here one branch at a time with
`python3 build/audit.py` run after every merge. It ends clean: 0 missing
files, 0 broken anchors, 0 duplicate ids, 0 images without alt text, 0
resources loaded from outside iGEM.

---

## 1. Start here

| File | What it is |
|---|---|
| **The pages themselves** | About 310 review notes, one at the end of every section, in a dashed amber box. Each says what a judge will credit ("Works.") and what to change ("Fix."). The switch in the bottom-right corner hides and shows them. |
| [`review-2026-09-25/INCONSISTENCIES.md`](review-2026-09-25/INCONSISTENCIES.md) | Every place two pages disagree, grouped by fact, each re-checked against the live page, with a priority and a likely owner. The ten P1 items are at the top. |
| [`review-2026-09-25/STRONG-WRITING.md`](review-2026-09-25/STRONG-WRITING.md) | The best student writing on the wiki, page by page, with the author where the page names one, and why each passage works. Worth reading to the team. |
| [`review-2026-09-25/JUDGE-SIM.md`](review-2026-09-25/JUDGE-SIM.md) | A simulated judging against the 2026 criteria (checked live on competition.igem.org): a verdict and the three highest-leverage actions for every medal criterion and targeted award, which three awards to elect, and a day-by-day priority list to the 21 October freeze. **Read section 1.1 first.** |
| `review-2026-09-25/<tab>.md` | Each agent's full report: every commit, every flag, what it left for a person. |

**Before the freeze** the review notes must go: set `window.REVIEW_NOTES = false`
at the end of `assets/data/site-nav.js` (it removes every note from every page),
or delete the `<aside class="review-note">` blocks. Same for the rule check
(`window.RULECHECK = false`).

---

## 2. The owner's two content requests

**Bioreactor Calculations is removed**, as asked: the page, its Dry Lab tab
entry, its footer entries, its homepage entry, the left rail only it used, and
its README and generator entries. Nothing links to it. But **34 sentences on
nine pages still name it in their prose**, because they are the students'
words: Math Model, Measurement and Results lean on it most (the pump floor, the
fibre count, the lumen holdup, the log reduction value that was "never
measured"). Each one has a review note saying what the claim now needs, and
section 35 of INCONSISTENCIES.md lists them all.

**Milestone is rebuilt** to the "From Failure to Function" structure: success
definition with the six-stage chain and the validation framework, the team's
success criteria with a sourced current status on every row, first attempts by
subsystem (failure, cause, consequence, lesson), five iteration tables, and
"Does ReLeaf work?" answered honestly joint by joint. Every number links to the
page it came from; nothing was invented. Where a cause was never recorded it
says "not recorded". Three thresholds are marked as proposals (the doc's own
≥50% transfer efficiency, and the two ≤3 min targets, which sit against a
published 105 min activation half-time). The old monthly timeline's facts are
kept in `review-2026-09-25/milestone.md`.

---

## 3. What changed, by goal

**Design cohesion.** One shared drawing-set layer now carries the whole site:
square corners, no drop shadows, callouts outlined all round instead of the
thick coloured left bar, one shared `.fix`/`.note`/`.gap` box, one state label
(`.stamp`, the word in a thin box) used on Plants, Measurement, Parts,
Engineering and Results, one wide-table pattern with a visible "more columns"
cue, captions in one "Figure n." format. Pages dropped their private copies of
these rules. The Team page now uses the shared page template.

**AI slop removed.** The nav panel's generic line icons became ruled text
entries; hero-metric rows of big numbers became ruled tables on the homepage,
Software, Plants, Entrepreneurship and the Dry Lab Notebook; pill badges,
glass, gradients, hover lifts, coloured SDG tiles and decorative numbered
eyebrows are gone; a few slogan headings now state what their section claims.
Student body prose was not rewritten.

**Browsing.**
- The homepage's first screen now says what ReLeaf is, with links to
  Description, Results and Engineering.
- The Dry Lab Notebook went from 10.1 MB to 212 KB (its 160 photos were base64
  inside the HTML; they are now files, byte for byte).
- Member photos 11.5 MB to 3.4 MB; Laws photos 3.2 MB to 1.1 MB; the homepage's
  first load about 0.5 MB lighter. Only resizing and re-encoding; no picture
  edited.
- 171 heading ids written into the markup, so links into sections work without
  JavaScript; no duplicate ids anywhere, at load or at runtime.
- Prev/next links fixed through the Dry Lab tab (Hardware now has a pager) and
  the Protein Design pipeline; Engineering got its pager.
- The contents rail fits the window and follows the reader on long pages.
- A 404 page, a print sheet, the team profile as a real dialog (Escape, focus).
- Pages that hid content without JavaScript (Plants' run stages, the homepage's
  reactor photo and circuit figure) now show it.
- Results had an unclosed box that pulled half of section 7 into an amber
  editor's box; fixed.

**A judge's map on every award page.** The award box at the top of
Measurement, Human Practices, Education, Math Model, Entrepreneurship,
Sustainability, Software (which had none), Inclusivity, Safety and Security,
Contribution, Parts and Engineering now lists the official 2026 judging
questions for that award, each linked to the section that answers it. Where
the page does not answer one yet, the map says "not yet on this page" instead
of hiding it: those gaps are the fastest points left on the table
(`review-2026-09-25/ballot.md` lists them per page, plus a ready map for
Anton's hardware hub). Engineering's Silver #1 box names cycle 3 as the
complete DBTL cycle with jump links to its four steps.

**Clear-cut inconsistencies fixed** (only where the wiki itself settles the
answer; everything needing judgement stays flagged): the Castillo-Hair 2019
citation made identical on all six pages and checked against PubMed; the iGEM
software address; the 150 mM root length quoted from Plants (1.364 mm) on
Math Model, Experiments, Measurement and Results; Peptide Design's control
ids; hollow-fibre, Dingxi, Renee Kuo, species italics. Each is marked
"Resolved 25 Sep" in INCONSISTENCIES.md and "(Fixed overnight: ...)" in the
review note that asked for it.

**A regression check on the merged site** at 1440, 500 and 390 px on all 43
pages found no horizontal overflow, no unstyled boxes, no duplicate ids at
runtime, and fixed the three it found (Dry Lab Notebook week labels, the
Hardware film's pause button under the tray, Peptide Design's rounded chips).

**Drafted from the wiki's own pages** (Status: Draft, each section with a note
saying what to check): Contribution, Safety and Security (six of eight
sections), Notebook (March to September index), Gallery, Inclusivity.

---

## 4. Needs a person, most urgent first

0. **Pick three special awards.** The judge simulation found the wiki targets
   nine, but 2026 allows exactly three elections on the Judging Form, and Gold
   needs all three to come back yes. Its recommendation: Measurement,
   Integrated Human Practices, Education (reasons in JUDGE-SIM.md §6). Bronze
   has three criteria in 2026 and #1 includes the Safety Forms: the Project
   Safety Form is due 7 October 23:00, submitted by a PI.

1. **The P1 inconsistencies still open** at the top of INCONSISTENCIES.md,
   each needing the team to say which record is right: the long photometer
   run (336 / 434 / 400 h), the pump floor (230 mL/min quoted, 100.3 measured,
   94 run), the membrane fibre count and lumen volume, the ACC deaminase mass
   (36 / 37.6 / 41 / 42 kDa), the light wavelengths, the sentences naming the
   deleted page, and the containment layers. (The root length, the software
   address and the Castillo-Hair citation were fixed overnight.)
2. **Farmer Chen's image consent** is not on record (a comment in the homepage
   source says so). Her photograph and words open the site.
3. **Attributions**: the form frame now uses team 6072 instead of the 0000
   placeholder, and that shows the form has not been started on teams.igem.org.
   No Attributions Form, no Bronze.
4. **Bronze #3** cannot be met by the Contribution page until the Registry part
   pages have content (all eight are empty).
5. **Silver #1**: Engineering never names the criterion or points at one whole
   cycle; cycle 3 is the one to offer (see its review note).
6. **Hardware** (Anton's repository): the hardware pages stop on 13 August while
   other pages carry later hardware evidence (the 23 Aug calibration ladder, the
   102 h perfusion run, the controller's safety cut-offs). Bringing that across
   is the most useful Best Hardware edit left. Tonight's hardware fixes are in
   `hardware-upstream-2026-09-25-fixes-only.patch`; see `hardware-handoff.md` §9.
7. The 11.7 MB high-school slides PDF is over iGEM's 10 MiB per-build limit.
8. Headless Chrome here cannot lay out narrower than about 490 px, so 390 px
   was checked in a real browser pane only on some pages. Check a few pages on
   a phone.
