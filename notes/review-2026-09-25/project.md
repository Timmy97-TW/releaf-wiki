# Project tab, overnight pass, 25 September 2026

Pages: `description/`, `engineering/`, `contribution/`, `results/`.
Branch `night/project`. `python3 build/audit.py` is unchanged: 0 missing links,
0 broken anchors on these four pages, 0 duplicate ids, 0 images without alt.

No student paragraph was rewritten. Everything judged is in a review note at the
end of the section it is about. The one page that was written is `contribution/`,
which was a pure scaffold, and every sentence of it comes from another page of
this wiki, linked.

---

## 1. What I changed

| Commit | What |
|---|---|
| `6538831` | Description: a review note at the end of every section (six notes). |
| `e773daa` | Results: closed the R4 fix box, which had no `</aside>`, so Protectant release, Containment and the rest of section 7 were rendering inside an amber editorial box. Also "looks like on this page, The one stage" to "page. The one stage". |
| `9b5bde3` | Results: a review note at the end of every section (nine notes). |
| `9d14923` | Engineering: a review note at the end of every sheet (nine notes), plus three lines in `engineering.css` so a note's links stay readable on the blueprint plate of sheet 04. |
| `9b66452` | Contribution: the page drafted from the wiki's own pages. Status Draft, "Written by" says it was drafted on 25 September and needs a team check, and each section carries a note saying what to verify. |
| `e0d7748` | Engineering: the cycle 5 note also names the deleted Bioreactor Calculations page. |
| `c91aa70` | Engineering: previous and next links at the foot of the page. It was the only page in the Project tab without them. |
| `45f5304` | Results: `<i>B. subtilis</i>` to `<i>B.&nbsp;subtilis</i>` in four places, matching the rest of the wiki. |

Mechanical fixes logged, in full: the unclosed `</aside>` (R4), one comma splice,
four non-breaking spaces. Nothing else in anyone's prose was touched.

### The deleted Bioreactor Calculations page

The owner deleted it on the night of 25 September and the links were already
unwrapped. The sentences that still name it are left exactly as they are, and each
one now has a review note asking the team to reword or move the claim:

- `description/index.html:85` (Abstract, "How to read this page") and `:272`
  (Figure 4 caption, "The membrane sizing, the flux arithmetic and the pump floor
  are on the Bioreactor Calculations page").
- `results/index.html:593` (Whole system, "the hydraulics on Bioreactor
  Calculations"), `:618` (R4), `:648` (R3, which also takes a fourth expected
  mass from it), `:679` (R8, the log reduction value).
- `engineering/index.html:1659` (cycle 5) and `:2976` (sheet 08).
- `engineering/index.html:18` is an HTML comment, not visible on the page; it can
  stay or go with the rest of the scope note.

R8 on Results is the one that matters most: the only page that said the log
reduction value was never measured was the deleted one, so that statement should
be moved onto Results or Safety rather than lost.

---

## 2. Writing inconsistencies

Within these four pages, and against the rest of the wiki.

| Where | What it says | What the other place says | Suggested resolution |
|---|---|---|---|
| `engineering/index.html:386-389` | "green light near 535&nbsp;nm", "red-absorbing state near 672&nbsp;nm" | `results/index.html:343`: "green photons at 520&nbsp;nm ... with red at 660&nbsp;nm to stop production"; `hardware/index.html:88`: "520 nm green · 660 nm red" | One pair is the protein's absorbance maximum and the other the LED emission. Say which is which on both pages, and use the LED numbers whenever the hardware is meant. |
| `engineering/index.html:2077` (build record row H) | H "Screened at 1,372&nbsp;bp on 25&nbsp;July; still in assembly on the parts sheet" | `results/index.html:274`: H "No clone and no date on record", counted as one of the failures | Settle whether the constitutive LEA construct exists. The two pages currently draw opposite conclusions about the LEA arm. |
| `engineering/index.html:2488` (module 4 prose) | "I3 and I6 carried the expected 1,588&nbsp;bp band on 22&nbsp;July" | Engineering's own build record and `results/index.html:275` and its Figure 4 caption: colony PCR 27&nbsp;July, sequenced 28&nbsp;July | One date for module I. |
| `engineering/index.html:522` (the Level 2 node on the assembly plate) | "Junction-checked 1 September. Not sequenced end to end." | Engineering sheet 02, Engineering cycle 6 and `results/index.html:290`: three independent clones checked at all three junctions on 19&nbsp;September | Update the plate. The drawing is currently the weakest statement of the strongest result. |
| `results/index.html:317` (R5, last sentence) | "Engineering gives the 661&nbsp;bp junction as CcaR&nbsp;F against CcaSm3&nbsp;R" | `engineering/index.html:1885` and its F11 box now print CcaR&nbsp;F against Csn&nbsp;R, taken from the gel legend | Strike that sentence from R5. It is already fixed on Engineering. |
| `description/index.html:246` (protectant table) | ACC deaminase, LEA14 and BoPep4 presented as the three outputs | `results/index.html:494`: "LEA14 and BoPep4 have never been applied to a plant"; module G failed and module H has no clone | Keep the table, add one sentence saying which cargo is built and tested and which are designed. |
| `description/index.html:216, :246` | "LEA14" | Engineering and Parts call the same part "Lea", "Csn:LEA", "LEA" | One name for the part across the wiki. |
| `description/index.html` throughout | "hollow-fiber" | `results/index.html:97` and Engineering: "hollow-fibre" | Pick one spelling for the project pages. `notes/qa-2026-09-23/typos.md` section 3 has the full fibre/fiber split. |
| `results/index.html:406` (R1) | the long photometer run is 434&nbsp;h, or 336&nbsp;h, or "about 400" | the homepage ledger says "3 weeks of unbroken OD600 logging", and this page says the archive holds no OD600 time series at all | Add the homepage to R1. Four figures are in circulation, not three. |
| `results/index.html:675` | <i>B. subtilis</i> as "a rod of 1 to 2&nbsp;&micro;m" in the containment argument, "0.8 by 3&nbsp;&micro;m" in the fouling model, neither cited | | One cited dimension, used in both places and on Safety before the Safety Form on 7&nbsp;October. |
| `engineering/index.html:2851` and `results/index.html:552` | the 24&nbsp;August blot, the 26&nbsp;August team minute, and Plants dating the finding 26&nbsp;August | | Give the blot date and the minute date separately in the sentence, on both pages. |
| Engineering sheet 07, `results/index.html:648` (R3) | expected mass of the ACCD fusion given as 41, 42, about 36 and 37.6&nbsp;kDa | | Compute the mass of the Csn-ACCD-6xHis fusion as built. One calculation closes part of F1, part of R3 and one paragraph of Engineering sheet 07. |
| `description/index.html:41` | Last updated 20 September 2026 | Results 23 September, Engineering 23 September | Not an error, but the Description is the oldest page in the tab and reads that way in the light of what Results now says. |
| `description/index.html` | "Written by: Project leads" | Other pages name people | The project description is a deliverable; name its author. |

American and British spelling inside `description/` is already tabulated in
`notes/qa-2026-09-23/typos.md` section 4, and it has not changed: the page uses
*recognize, localized, specialized, centralized, labor, fiber* beside *colour,
neighbour, labour, modelling, kilometres, defences*.

---

## 3. Strong student writing worth keeping

- **Description, The challenge.** "A farmer does not experience a national
  average. They experience the week their own field crossed a damaging
  threshold." Two short sentences turn a map into the reason for the design.
- **Description, Project inspiration.** "It was a tidy idea, and it did not
  survive contact with the people who build these systems for a living." Honest
  about the first design without apologising for it, and it sets up the three
  expert objections that follow.
- **Description, Integrated Human Practices.** "A device that needs a laptop and
  a trained operator is a device that sits in a shed." The farmers' requirement,
  in the register the farmers used.
- **Results, Protectant function.** "A three and a half fold effect with a broken
  control is a reason to run the experiment again." The largest effect in the
  plant data is reported and then dismantled in the same breath by its own failed
  control. This is the paragraph a judge will remember.
- **Results, Culture monitoring.** "We had expected that comparison to run the
  other way." One clause, and it buys the whole calibration section credibility.
- **Results, Containment.** "A safety claim should not rest on an n of one."
- **Results, What the chain does not close.** "The parts that are open are the
  couplings between them, and they are open for the same reason, which is that a
  coupling needs both halves working before it can be tested at all." That is an
  insight about the project, not a summary of it.
- **Engineering, cycle 1 learn.** "That is worth recording as luck, because a plan
  that depends on luck is not a plan." Written by Chloe, per the cycle header.
- **Engineering, F10.** "None of this touches the finding." A limitation that
  says exactly how far it reaches, which is rarer than a limitation.
- **Engineering, sheet 06.** The note that clone identifiers do not track
  construct letters "because the letters were assigned to gel lanes on the day"
  saves a reader from a wrong conclusion. Sophie C and Chloe own those modules.

---

## 4. Needs a person

1. **The eight Registry part pages are empty.** Bronze criterion 3 cannot be
   carried by a part whose Registry entry is blank, and the new Contribution page
   says so rather than papering over it. Somebody has to choose the part, write
   its Registry documentation, and then put its number on `contribution/`.
2. **Check the drafted Contribution page.** Nothing on it is invented, but every
   number is quoted from another page and none was checked against a file. The
   review notes on it list what to verify per section. In particular: whether the
   six "methods we changed" really were changed by the team rather than taken as
   written, and whether the photometer and DiOPAL models, bills of materials and
   firmware are actually downloadable. The photometer page already carries an
   editorial note saying its release paragraph is not earned until they are, and
   there is no firmware file anywhere in this repository.
3. **The deleted page's claims.** Seven sentences across three of my pages still
   name Bioreactor Calculations. I did not reword them, as instructed. R8's log
   reduction statement is the one that must not be lost.
4. **Licence.** The repository licence is CC BY 4.0 including source and CAD; the
   Software page calls the interface file MIT. A team cannot reuse a design whose
   licence is ambiguous, and Contribution now says that out loud.
5. **Photograph weight.** `assets/img/description/farm-visit.webp` is 313 KB and
   `assets/img/results/bioreactor-running.webp` is 198 KB, which are the two
   heaviest images on my pages. They can be re-encoded smaller without touching
   content, but re-encoding a photograph is a judgement call about quality, so I
   left them.
6. **Not changed, on purpose.** I did not renumber, reorder or delete any of the
   R1 to R10 or F1 to F12 boxes, and I did not resolve any contradiction between
   two team sources. Every one of those is a decision for whoever was at the
   bench.

---

## 5. Requests for the shared layer

1. `assets/js/review-notes.js` gives a note no link colour, so a note inside a
   dark section inherits that section's link colour. I worked around it in
   `engineering/engineering.css` for the blueprint plate. A rule in the shared
   file, `.review-note a { color: #6b4708; text-decoration: underline; }`, would
   cover every page and let me drop the local override.
2. Engineering measures 9 px wider than the viewport in a 390 px test frame. The
   cause is `width: calc(100vw - ...)` on the breakout class meeting a classic
   scrollbar, so on a phone, where scrollbars are overlays, there is no real
   sideways scroll. If the shared layer ever adopts a `--vw` custom property or
   `100dvw`, the breakout rule in `engineering.css` should move with it.
3. The review-note toggle sits at `left: 12px; bottom: 56px`, directly above the
   iGEM rule-check button in the same corner. On a 390 px screen the two stack
   tightly. Worth a look before the freeze, though neither overlaps today.
