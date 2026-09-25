# Engagement tab, second pass (design and browsing), 25 September 2026

Branch `night/engage2`. Pages: Integrated Human Practices, Education,
Entrepreneurship, Sustainability, Laws and Regulations, Geospatial Analysis,
Data Physicalization. This pass is about design, weight and browsing; the first
pass (`engage.md`) wrote the review notes, and none of them were edited or
duplicated here. No student prose was rewritten. `python3 build/audit.py` is
clean after merging main (0 missing, 0 anchor, 0 dupid, 0 external; the only
file over 5 MB in the repo is now the 9.4 MB slide PDF). No page in the tab
scrolls sideways at 390 or 500 px (measured scrollWidth against clientWidth in
headless Chrome, all seven pages).

## 1. What I changed

| Commit | Change |
|---|---|
| 339c348 | Human Practices: the evolution map's cards showed faces and four photos at about 130 CSS px but loaded the 1400 to 1600 px originals (9.7 MB while scrolling the map). Cards now load scaled-only 480 px copies from `assets/img/human-practices/t/` (101 files, 2.0 MB); the viewer and full record still open the originals, and a missing copy falls back to the original (`evomap.js`, `small()`). Nine photos referenced by no page, script or stylesheet removed (1.9 MB): booth-crafts-b, booth-dataphys-c, booth-intro-b, booth-misc-1, booth-ringtoss-b, exp-0319-lin-b, farm-expo-3, farm-market-2, farm-tamsui-2. kap-fig1 to 3 (the source survey charts) kept although unreferenced. |
| 2a8be7d | Human Practices: the return-visit and LINE panels were `hidden` in the markup, so with scripts off only the first panel of each could be read. `hidden` now comes from ihp.js; without JS the tab strip is dropped and all panels stack. Each return-visit tab shows its state as a stamp from one vocabulary (Adopted / Partly adopted); the old specific wording is kept as a note beside the panel stamp (in set 8, controls in progress, changed a module, one rule missed). The four visit / between / visit panels label their columns They advised / We responded / They checked it, so who, what they said, what we changed and how it was checked reads across one row. Chen and Kyle panels (three advice columns) are left without role labels, because the roles would be false there. Home and End keys added to the tabs. |
| 259ecee | Human Practices: expert-selection rows end on a separate "Shown on" line with the link; the industry cards' "Changed:" now uses the same small-caps label as the Changed line above; conflicting-advice and symposium before/after pairs get column heads at desktop width. The Modelling row still names Bioreactor calculations in plain text (deleted page); the first-pass review note covers it. |
| 37d00d3 | Human Practices: 22 farm, market and booth photos resampled 1600 to 1200 px (carousel slides are at most 544 CSS px), 4.3 MB to 2.6 MB; screenshots with text and the wide forum carousel untouched. Every page image carries real width and height; carousel images get `height: auto` (without it the height attribute stretched them). Meeting-record screenshots are shown whole (`carousel--contain`) instead of cropped to 3:2, which cut slide text off. |
| c32e7f1 | Human Practices: open-item stamps share one column so the items align; the list sits under a heavy rule like the other ledgers. Rubric numbers 01 to 06 reduced from 2rem green numerals to a grey label (kept, since review notes cite "answer 02"). |
| 282fbf8 | Education: high school slides were 11.7 MB, over iGEM's 10 MiB per-build limit. `education/files/releaf-high-school-lesson-slides-web.pdf` is the same 47 pages with twelve oversized photos resampled to 1400 px long side (JPEG q78; one transparency mask resampled with its photo); text, fonts, vector art untouched. 9.4 MB. Every page rendered before and after (pypdf split, sips render) and diffed: largest mean difference 3/255, no visible change. Original removed from the tree (still in git history). Lesson files are now one table, a row per age band and a column per kind of file, junior high row linking to `website/resources.html`. Website parts are a ruled list, not rounded cards. Programme and result panels are no longer `hidden` in the markup (a `<noscript>` style drops the tab buttons). Result figures are numbered E1, J1, H1 instead of three Figure 1s. Table heads: "Students surveyed, pre / post (n)", "Cost (Gene Coins)". |
| e933e29 | Geospatial: the hero image had a slanted white screen-capture strip in its last 20 columns (no map content), visible as a pale bar at the right of the hero. Cropped to 1380 px. |
| 5085928 | Entrepreneurship: the breadcrumb ran 5 px past a 390 px viewport (shared eyebrow is a no-wrap flex row) and the page scrolled sideways; page-local `flex-wrap`. |
| 0eb50c6 | Data Physicalization: practice table heads "Respondents (n)", "Share of 62", right-aligned. |
| f7e3631 | Merge of main (shared layer). One conflict in education/index.html: kept main's new heading ids and my un-hidden panels. |

Headers: Geospatial and Data Physicalization already use the same hero header
as Human Practices and Education (breadcrumb, h1 on photo, caption, lede, meta
row). Entrepreneurship, Sustainability and Laws use the plain header; that is
the same split as the rest of the site (hero only where there is a photo worth
leading with), so I left it.

PDF shrinking, for the record: no Ghostscript, qpdf or mutool here; pypdf 6.19
and Pillow were available. The script is in the scratch dir
(`engage2-scratch/pdfshrink2.py`: resample DCT images over 60 KB to 1400 px,
q78, resample their SMask with them, skip anything else). If the team wants the
file smaller still, the other options are 1200 px / q75 (about 8.8 MB estimated)
or splitting the deck in two.

## 2. Writing inconsistencies (new in this pass)

| Where | Says | Other place says | Suggested resolution |
|---|---|---|---|
| education/index.html, Materials review note | "The high school slide deck is 12 MB ... compress it or split it" | The deck is now 9.4 MB (`-web.pdf`) | Clear that sentence when the team next edits the note. I did not edit review notes. |
| human-practices 3.2, Prof. Cheng tab | stamp now "Adopted, in set 8" (wording kept) | plant: neither set 8 deck records ten-day plants (first-pass note) | Still open; when settled, the stamp may need to be "Partly adopted". |
| human-practices 3.1 picks, Modelling row | "Bioreactor calculations" in plain text | page deleted | Team rewrites to Model (first-pass note). I did not give it a "Shown on" line, since the page does not exist. |
| education table, junior high row | links the website resources page | website resources page links the junior high files on static.igem.wiki team folder 5729 (another team number than 6072 and 5066 seen elsewhere on that page) | Check which team folder the files really live in before mirroring. |

## 3. Strong student writing worth keeping (not already in engage.md)

- **Human Practices, 3.2 Prof. Chang tab**: "a rising pressure is how a caking membrane announces itself." Advice turned into an instrument reading a reader can picture.
- **Education, What we were aiming for**: "An outreach event that ends when we leave the building is not education, it is a visit." One sentence that sets the standard the Materials section then has to meet.

## 4. Needs a person

- Stakeholder state vocabulary on the return-visit tabs (Adopted / Partly adopted) is my reading of each panel. Dr. Kyle and Dr. Sattely are "Partly adopted" because their panels say one rule was missed and controls are in progress; Prof. Chang because the panel lists work not done. Check the team agrees.
- Removed nine unused Human Practices photos; they are in git history if the gallery wants them.
- `releaf-high-school-lesson-slides.pdf` renamed to `-web.pdf` by replacement. If anything outside this repo (the education website, a Google Doc) links the old name, repoint it.
- Education junior high files are still not mirrored (needs a download from static.igem.wiki).
- Evolution map card foot labels vary (What we did next / X changed / N areas changed / What followed) and the Agriweek card has an empty foot; the data file drives both, and filling the foot needs a sentence from the team.

## 5. Requests for the shared layer

1. `page.css .pagehead__eyebrow`: add `flex-wrap: wrap; row-gap: .2rem`. Entrepreneurship overflowed a 390 px phone by 5 px because of it; I fixed it page-locally, but any long trail on another page will do the same.
2. Tabs in `page.js`: panels are safe to leave un-hidden in markup (page.js hides them on load), and pages should do so, so content reads without JS. A shared `.js` class on `<html>` (set by nav.js) would let pages hide `.tabs__strip` without JS in CSS instead of the `<noscript><style>` I used on Education.
3. `page.js` tabs: add Home and End keys, as ihp.js now has.
4. `.dl` download list in page.css is no longer used by any page (git grep finds no `class="dl"`); it can be removed.
