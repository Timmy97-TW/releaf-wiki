# Milestone — overnight pass, 25 September 2026

Cluster: `milestone`. Branch `night/milestone`. Files owned: `milestone/index.html`,
`assets/img/milestone/`, this file.

The owner's instruction was to remove the Milestone page content and replace it with the
structure in the team's document *From Failure to Function*, and to write it from the
results already on the other pages. That is what this branch does. The page is a draft.
Nothing on it was measured for it; every number is a quotation from another page of this
wiki and is linked at the point it is used.

---

## 1. What I changed

| Commit | What it does |
|---|---|
| `6c9b4ba` | Milestone: the hydroponic float board photograph, converted to WebP |
| `8017c25` | Milestone: rebuilt to the team's four-part structure, From Failure to Function |
| (this file) | Milestone: the review notes and the record of what came off the old page |

Detail of the rebuild:

- **H1 and lede.** The doc's own title, *From Failure to Function*. The nav name stays
  "Milestone" and the slug is untouched. Header meta now reads Written by "Project team;
  drafted from the wiki's own records on 25 September 2026", Last updated 25 September
  2026, Status Draft.
- **Section 1, What success for the whole system looks like.** The six-stage chain
  (Detect, Activate, Produce, Contain, Deliver, Protect) as a reflowing HTML/CSS figure;
  the 15 April system schematic reused from `assets/img/milestone/apr15-pivot.webp`; the
  team's validation framework redrawn in HTML and CSS rather than embedded as the Word
  image, because it is a diagram and not evidence; a status vocabulary table; and the
  success criteria table with a Current status cell per row, each with a link to the page
  and section that holds the evidence.
- **Section 2, Our first attempts.** Failures by subsystem (plant, bioreactor and
  hardware, genetic circuit and production, measurement and record keeping), each read as
  Failure, Cause, Consequence, Lesson. Where no page records the cause, the page says
  "not recorded" instead of supplying one. Three places do that: the three failed Level-1
  assemblies, the three empty Level-2 Golden Gate rounds, and the threefold pressure
  spread at 405 mL/min.
- **Section 3, Iterating toward success.** Five standardised iteration tables: hydroponic
  boxes, bioreactor, photometer, light array, cloning. The closing subsection counts what
  the iterations produced, in facts rather than adjectives.
- **Section 4, Does ReLeaf work?** The current system in two existing photographs, the
  criteria again with the actual result, and a joint-by-joint statement of which links of
  the chain are demonstrated. The answer given is "not yet, and here is which joint".
- **Review notes** at the end of all four `<h2>` sections, per the brief.
- **Figures.** One new file, `assets/img/milestone/hydroponic-float-board.webp`,
  converted from the structure document's `image2.png` (1690 × 1272 PNG, 2.8 MB) to a
  1400 px WebP at 213 kB. Scaled and re-encoded only. Every other figure links the file
  another page already uses; nothing was duplicated.
- **Page CSS.** Page-scoped `<style>` only: the four state stamps, the chain, the
  validation framework, and column widths for the two wide tables. The old page's folded
  contents-rail CSS and its scroll script were dropped, because the page is now an
  argument rather than a photo essay and the standard rail is the right component.

Verified: `python3 build/audit.py` unchanged against the baseline taken before the edit
(external 0, missing 0, anchor 6 — all six in `model/index.html`, none new — cite 0,
dupid 0, alt 0). All 24 cross-page anchors this page links to were checked to exist.
Checked at 1440 px and at 390 px; `document.documentElement.scrollWidth` is 390 at 390,
so there is no horizontal scroll. Section numbering and the contents rail build correctly
and the review notes do not appear in the rail. With JavaScript off the page reads as
prose, figures and references in order.

### Links into `milestone/` anchors elsewhere in the repo

**None.** `grep -rn 'milestone/#'` over the repository returns nothing, so no link
anywhere breaks from the old section ids going away. The plain `../milestone/` links in
every footer and in `assets/data/site-nav.js` are unaffected.

---

## 2. Removed from the old Milestone page

The old page was a month-by-month photo timeline. It is preserved in git at `c28ea50`
(`git show c28ea50:milestone/index.html`). These are the facts that lived only there, so
that nothing is lost if the team wants them on Gallery, Team or Description.

### The four counts on the old page

- 264 days from the first team meeting to the day the page was written.
- 47 people on the roster.
- 494 photographs filed to the week they were taken in.
- 1 project pivot, in April.

The page used 494 in the counts and in "How this page was assembled", and 489 in the
"Before the season" prose. That disagreement was in the old page and is listed again in
section 3 below.

### The year at a glance

| Date | Milestone | Why it mattered |
|---|---|---|
| 13 Dec 2025 | First team meeting | Forty-seven people, no project |
| 27 Dec 2025 | First project proposal heard by the advisors | Killed, and rightly |
| 1 Feb 2026 | First Human Practices meeting | The pitch met someone outside the room |
| 5 Feb 2026 | Four-track project roadmap drawn | The plan the year departed from |
| 7 Mar 2026 | Lab training starts | Nobody had held a micropipette in December |
| 27 Mar 2026 | *Arabidopsis* seed secured, NTU | An organism |
| 4 Apr 2026 | Verslues lab visit, Academia Sinica | Vertical plates, and how stress is scored |
| 10–15 Apr 2026 | The pivot | Sensor, chambers, membrane, soil |
| 12 Apr 2026 | First *Arabidopsis* on agar | The plant line starts |
| 18–25 Apr 2026 | Hollow-fibre membrane chosen | Fixed what the bioreactor had to be |
| 16 May 2026 | Farmers' market interviews, Taipei | First time the idea was said to a farmer |
| 27–28 May 2026 | Light plate and photometer prototypes | Two instruments we could not buy |
| 6 Jun 2026 | First *B. subtilis* growth test in the reactor | The loop held culture without leaking |
| 16–19 Jun 2026 | The whole system drawn on one whiteboard | Four teams found they were building one thing |
| 17 Jun 2026 | Vertical plates racked the wrong way | Cost a fortnight; changed the protocol |
| 18–20 Jun 2026 | Bioreactor design reviewed by two professors | Prototype 1 did not survive it |
| 24–29 Jun 2026 | First classroom trials | The lesson met students and lost an argument |
| 2 Jul 2026 | The team learns git | The wiki exists because of one afternoon |
| 7 Jul 2026 | Berkeley Historical GIS Project meeting | Turned a hunch about small farms into maps |
| 9 Jul 2026 | CH Biotech (正瀚) visit; commercial protectant secured | A benchmark we did not have to invent |
| 12 Jul 2026 | First live pressure data off the reactor | The hardware became an instrument |
| 17 Jul 2026 | Light plate apparatus fully assembled | Optogenetic induction becomes testable |
| 19 Jul 2026 | Inline photometer reads live culture, four-fold high | A working instrument and a calibration problem |
| 21 Jul 2026 | A day on Farmer Chen's smallholding | Changed who the device is for |
| 23 Jul 2026 | Hydroponic line abandoned | Soil, from here on |
| 30 Jul 2026 | Every failure so far, listed on a board | The retrospective that set the last month's work |
| 3 Aug 2026 | Reactor, photometer and plants in one incubator | First time the system was one system |
| 6 Aug 2026 | *B. subtilis* WB800 secured, NCHU | A protease-deficient chassis for secretion |
| 8–11 Aug 2026 | Promotion video shot and published | The argument, in two minutes |
| 11 Aug 2026 | Commercial vertical farm visit | What controlled environment costs at scale |
| 14 Aug 2026 | High school programme runs | Third age band, third rewrite of the lesson |
| 15 Aug 2026 | The model put on one sheet | Four coupled stages, picture over equation |
| 22 Aug 2026 | Lab safety audit photographed and filed | Evidence, not assertion |
| 23 Aug 2026 | Reactor rebuilt into a computer case | From bench rig to something portable |
| 29 Aug 2026 | Loop plumbed inside its own enclosure | The first build that travels |
| 29 Aug 2026 | Booth and presentation rehearsals begin | Saying it out loud finds the holes |

### Facts from the old prose that are not on any other page

- **Before the season.** GEMS Taiwan is a school team, not a university lab with a rolling
  cohort; the roster empties and refills every year, and what carries across is the
  advisors and instructors. Before December 2025 there was no ReLeaf.
- **The filing habit.** Since December 2025 every photograph has been filed under the
  month, sub-team and week it was taken in, named
  `YYYYMMDD_Subteam_Type_Description`, with the date being the day of the shot and not the
  day of the upload. Naming convention and week table in `_README_命名規則.md`, per-file
  index in `_PHOTO_MANIFEST.csv`. That is 494 images across 38 weeks.
- **The shape of the record.** December has 3 photographs and June has 137, because in
  December there was nothing to photograph. 369 of the year's photographs were taken
  between June and August.
- **The February roadmap.** Four parallel tracks — biosecurity, model establishment,
  stress-response switch, stress protectant — each ending in a field test, with every task
  sorted into *must do*, *must succeed* and *bonus*. The hardware programme appears on it
  only as the words "Collaborate with Drylab" in a blue box.
- **The 30 July retrospective board.** Three columns, agar, hydroponics and soil, with the
  problems down the right in red: 3D print, troubleshooting, contamination, seeds
  disappearing, agar disappearing, plant stress, medium renewal.
- **The autumn plan**, written as commitments rather than results: September,
  characterisation and the open photometer calibration; October, the wiki freeze, with
  every image and the typeface re-hosted on `static.igem.wiki` and the parts submitted to
  the registry, against the checklist in `notes/publishing.md`; 1 to 7 November, the Grand
  Jamboree, Biomanufacturing Village.
- The old page also carried a sentence saying the April volumes are "in Bioreactor
  Calculations", the page the owner deleted. That sentence is gone with the rest of the
  timeline, so nothing on Milestone points at it any more.

If the team wants the timeline back somewhere, Gallery is the natural home: the entries
are photographs with dates, and every one of them already links to the page that argues
the work.

---

## 3. Writing inconsistencies

Within this page, and between it and the pages it draws on.

| Where | What it says | What the other place says | Suggested resolution |
|---|---|---|---|
| `hardware/bioreactor/index.html:451` | OD600 0.304 in-tube against **0.48 in the reservoir**, and the sedimentation diagnosis depends on it being the reservoir | `results/index.html:570` says 0.304 in the loop against **0.480 in a serum-bottle control** | These are different comparisons and only one supports the sedimentation reading. Whoever ran cycle 1 should say which sample the 0.48 came from. Milestone currently writes "the comparison sample" to avoid picking. |
| `engineering/index.html:375,803` | CcaS switches to a red-absorbing state near **672 nm** | `hardware/diopal/index.html:553` gives the CcaS/CcaR literature values as 535 nm and **670 nm** | Two nanometres, one source. Pick one and use it on both pages. The green pair is already reconciled on the DiOPAL page (ours 520 nm, literature 535 nm) and needs no change. |
| `milestone/index.html` success criteria, Activate | Green **525 nm ±30**, red 660 nm ±30, taken from the team's structure document | The array is built at 520 nm and 660 nm (`hardware/diopal/index.html:553`) | No conflict: 520 sits inside the window. Flagged only so nobody reads 525 as a fourth number for the same quantity. |
| Old `milestone/index.html` | "Four hundred and eighty-nine photographs later" | The same page's count block and "How this page was assembled" both say **494** | Resolved by deletion, since both sentences came off the page tonight. If the archive count goes onto Gallery, use one number. |
| `PRODUCT.md` | "twenty-two cycles across four tracks" on the engineering page | `engineering/index.html` now carries **six cloning cycles**; the reactor, photometer and peptide cycles moved out at the 5 September scope change | Milestone counts 21 documented iterations across Engineering, Hardware and Plants and says where each group lives. `PRODUCT.md` should be updated to match the page as it now stands. |
| `hardware/hydroponics/index.html` §3.2 | Reserves **five DBTL cycles** for the Growth Plate and records none of them | `plant/index.html` documents **five hydroponic box prototypes** in full | If these are the same five, cross-link them. If they are different, the Growth Plate cycles need their own record, and Milestone's iteration table should gain a second table beside the box one. |
| `plant/index.html` | "Our own report to Prof. Cheng says six prototypes in three months, and the September write-up adds a seventh" | The same page draws **five** | Already flagged on Plants. Milestone quotes five, because five are documented. |
| Already open elsewhere, not re-opened here | The photometer run is 434 h, 400 h or 336 h (Results R1); the expected ACCD mass is 42, 41, 37.6 or ~36 kDa (Results R3, Engineering F1); pump setting 10 is 100.3, 140, 121.7 or 94 mL/min (Results R4) | | Milestone avoids all three numbers, or quotes them with the disagreement named. No new position taken. |

---

## 4. Strong student writing worth keeping

These are on pages I do not own. They are recorded here so the lead can pass the credit on.

- **Plants**, hydroponics, on prototype 5: "Germination came back to 7 of 10 and so did the
  contamination." A one-sentence control experiment. The whole prototype series is the
  best piece of experimental reasoning on this wiki, because prototype 5 deliberately
  reverses the one change that worked and confirms the diagnosis instead of asserting it.
- **Plants**, the ACC deaminase run: "The pretest was not a failed test of a protectant.
  There was no protectant in it." That distinction is exactly the thing a judge is
  checking for, and the team made it themselves before anybody asked.
- **Results**, light delivery: "No induction curve exists." Four words in bold, in the
  middle of the section that most needs them. Written by wet lab and dry lab together.
- **Results**, culture monitoring: "A curve you cannot put a number on is a hypothesis, not
  a measurement." The whole reason the photometer caveats exist, in one line.
- **Hardware, Bioreactor**, §5.1: "'Identical medium and temperature' is true, and it is
  not the same as a controlled comparison." A team arguing against its own headline result
  is rarer than it should be.
- **Engineering**, cycle 1 learn: "That is worth recording as luck, because a plan that
  depends on luck is not a plan." Written by Chloe.
- **Engineering**, cycle 6 learn, quoting the team's own note on the terminator that went
  back where it started. Keeping a redesign that was undone, and saying why, is more
  convincing than a clean story.

---

## 5. Needs a person

Decisions I did not make, and things I could not check.

1. **The three proposed thresholds.** The ≥50% transfer efficiency target is flagged for
   review in the team's own structure document. I flagged the ≤3 min detection and ≤3 min
   activation targets for the same reason: the published activation half-time for this
   optogenetic system is 105.1 ± 1.5 minutes, so a three-minute detection target sits in
   front of a hundred-minute response. Somebody has to decide whether the targets are
   wrong, or right for a reason nobody has written down.
2. **Which prototype and which date Figure 4 belongs to.** The float board photograph came
   with the structure document and nothing on the wiki identifies the box. Until somebody
   says, the caption says so.
3. **The OD600 0.48 question** in section 3 above, because the sedimentation reading in
   cycle 1 depends on the answer.
4. **Whether a cause was ever discussed** for the three failed Level-1 assemblies, the
   three empty Level-2 Golden Gate rounds, and the threefold pressure spread at about
   405 mL/min. The page says "not recorded" in all three places rather than inventing one.
   Any of the three can be filled in by whoever was at the bench.
5. **A photograph of the reactor as it is now.** Figures 13 and 14 are 29 August and
   3 August. The Hardware record closes on 13 August with three mechanical choices being
   replaced (magnetic pump, rectangular reservoir, probes moved into the vessel), so
   neither photograph shows the machine currently on the bench.
6. **Whether the Growth Plate's five DBTL cycles are the five hydroponic box prototypes.**
   Section 3 above.
7. **I did not add the electroporation voltage sweep** to section 2 as a failure, because
   the record reads as a method development rather than a failure. It is a good candidate
   for a fifth entry under "Genetic circuit and production" if the team wants it, since the
   arcing diagnosis (a time constant of zero voids the run, a parallel resistance fixes it)
   is reusable by other teams.
8. **The page is long.** Four sections, eight tables and fourteen figures. I did not cut
   anything to shorten it, because the brief for this wiki is that length is a judging
   asset and the problem to solve is navigation. If the team disagrees, the criteria table
   in section 1 and the results table in section 4 are the obvious candidates to merge.

---

## 6. Requests for the shared layer

1. **`assets/css/page.css`, table heads.** `table.data thead th` sets
   `white-space: nowrap`. That is right for a two-word head and wrong for a four-word one:
   on a fixed-layout table it pushes the last column out of the horizontal scroller
   instead of wrapping. I worked around it with a page-scoped override. Consider adding a
   `table.data--wrapheads` modifier, or dropping the nowrap and letting the column widths
   do the work.
2. **Nothing else.** This page uses `pagehead--hero`, `toc`, `sec`, `fig`, `figs--2`,
   `tablewrap`/`table.data`, `callout--unproven`, `refs`, `pagenav` and `footer2` exactly
   as they ship, and `page.js` numbering, contents, citations and lightbox all work
   unmodified.
