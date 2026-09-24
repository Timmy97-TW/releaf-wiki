# Dry Lab, second pass, 25 September 2026

Branch `night/drylab2`. This follows the first Dry Lab pass
(`notes/review-2026-09-25/drylab.md`) and does not repeat its review notes or
its tables. No review note was removed. No student body prose was rewritten.

Scope: page weight on the Dry Lab Notebook, the Protein Design section as one
sequence, image weight on Model and Software, remaining slop.

## 1. What I changed

| Commit | What |
|---|---|
| `30ee46b` | Dry Lab Notebook: the 160 board photographs move out of the HTML into 318 WebP files in `assets/img/drylab-notebook/board/`. `index.html` goes from 10,144,838 bytes to about 212 KB |
| `786bb4d` | Protein Design: all eight pages of the section (hub, five steps, MD Simulations, Peptide Design) carry `Section: Dry Lab · Protein Design` and a `Step` line; MD Simulations gets the Protein Design breadcrumb; the two drawn banners take a 440 px band; `protein-design/stepnav.js` scrolls the current step into view in the section strip on a phone |
| `6537fa6` | Software: header photograph served as WebP (900 px 91 KB, 1600 px 184 KB) instead of a 465 KB JPEG for every screen. Math Model: salt ladder figure height attribute 1013 corrected to 1014 |
| `7f968d8` | MD Simulations: map, landing pair and wide tables capped at 55rem so they stop 8 px inside the page edge instead of 70 px past it at 1440; map chips and limb labels squared (CSS `rx: 0`, map.js untouched) |
| `0062d4d` | Dry Lab Notebook: the nine season counts become one sentence of body text instead of a KPI row; the entries list says "Sent to the Wet Lab" instead of "WetLab handoff" |
| (this file) | Notes |

### Dry Lab Notebook weight, in detail

- The `PHOTOS` array held two base64 WebP strings per record (`t` 240 px thumb,
  `l` 880 px view). Each was decoded byte for byte and written as
  `wNN-III-thumb.webp` / `wNN-III-view.webp` (week, then the record's index in
  the array). Nothing was re-encoded: the files are the exact bytes that were in
  the page, so the pixels are identical.
- The fields now hold file names. The only consumer, `const src = ...`, used to
  prepend `data:image/webp;base64,`; it now prepends
  `../assets/img/drylab-notebook/board/`. All `loading="lazy"` attributes stay;
  the handoff thumbnails on the board also got `loading="lazy" decoding="async"`.
- Records 84 and 86 (0-based; week 17, "Close up on the concave lens") were
  byte-identical. Both records stay (removing one would change the "160
  photographs" count on the page), but they point at one pair of files, so 318
  files, not 320. Deleting the duplicate record is a content decision; it is in
  the page's review note and in section 4 below.
- Checked: every file name in the data exists on disk (318 of 318), every file
  opens as a valid WebP, the board at 1440, the pinned card at `#photo-w17`, and
  the Photos view were compared against the old page in screenshots and are
  identical. The lightbox opens a `-view.webp` at 880 px. The first review
  note's sentence about 9.7 MB was updated to say what was done.
- The media now adds 7.7 MB under `assets/img/` instead of 9.7 MB inside one
  HTML file. For the iGEM push this means the HTML is small and the images go
  with the other media to static.igem.wiki (see section 4).

### Protein Design, how the sequence reads now

Order (unchanged, verified): Software → Protein Design hub → G Generate →
R Restraints → A Assembly → F Flex (MD Simulations) → T Triage → Packaging →
Peptide Design (worked case) → Dry Lab Notebook. Every page's prev/next pair
agrees with its neighbours and with the section strip.

Step line on each header: hub "Overview of the five"; Generate "G, the first
of five" … Triage "T, the fifth of five"; MD Simulations "F, the fourth of
five" (new, with a Chinese version); Packaging "Packaging, after the five";
Peptide Design "Worked case, all five run on BoPep4" (new). I kept "of five"
instead of the "step x of 6" the task suggested, because the pages already
say GRAFT is five steps and draw Packaging as outside the acronym on purpose
(hub section 4). Changing that is the team's call, not a label fix.

## 2. Writing inconsistencies

New ones only; the first pass's table still stands.

| Where | What it says | Other place | Suggested resolution |
|---|---|---|---|
| `drylab-notebook/index.html` PHOTOS records 85 and 87 (1-based) | the same photograph entered twice, so the page says "160 photographs" | the actual count is 159 unique | delete one record; the counts on the page are computed and will follow |
| `drylab-notebook/index.html` entry text (lines ~978, 988, 990, 1093, 1764, and photo captions) | "WetLab", "WetLab Plant", "the WetLab girls" | the site nav, the board and the rest of the wiki say "Wet Lab" | student prose, left alone; change to "Wet Lab" when someone edits those entries. "the WetLab girls" also names people by gender rather than name; the caption would be better with names |
| `protein-design/protein.css` header comment | "the six pages of the GRAFT section" | the strip now joins eight pages | comment only; update when next edited |
| `build/peptide_design.py` | generates `peptide-design/index.html` | the HTML now carries 14 review notes and the first pass's squared styles that the generator does not have | do not re-run the generator before the freeze without porting those in, or it will silently drop them. The header and stepnav changes from tonight are mirrored in the generator |

## 3. Strong student writing worth keeping

Two not in the first pass's list:

- **`/protein-design/` §3, Focus on BoPep4.** "Those three are conditions for
  doing the work at all. None of them is a reason to prefer BoPep4 over the LEA
  family on the biology." It separates why a choice was convenient from why it
  would be right, and says which one the team actually has.
- **`/software` hero standfirst.** "A digital twin is a claim about evidence,
  not about software." One sentence that tells a Best Software Tool judge what
  standard the page holds itself to, before any feature is listed.

## 4. Needs a person

1. **Releaf-Actual and the notebook images.** The upload build rewrites media
   paths it can see in markup. The notebook's 318 board images are named in a
   script, and built as `'../assets/img/drylab-notebook/board/' + name` in one
   line (`const src = f => ...` in `drylab-notebook/index.html`). When the media
   goes to static.igem.wiki, that one prefix has to become the upload address,
   and the 318 files have to be in the upload manifest. Nothing else changes.
2. **Twelve orphaned Software images, 3.9 MB.** In `assets/img/software/`:
   `first-live-pressure-20260712.jpg`, `lpa-assembled-20260717.jpg`,
   `lpa-dose-response-protocol.png`, `od600-live-monitor-20260803.jpg`,
   `photometer-4fold-20260719.png`, `reactor-running-20260720.jpg`,
   `tio2-calibration-20260823.jpg`, `ui-flow-path.png`, `ui-flow-path-zh.png`,
   `ui-model-register.png`, `ui-nine-steps.png`, `ui-twin-connectivity.png`.
   No page references them since the Software rewrite (`b28369f`). I did not
   delete them because they are dated evidence photographs the team may want
   back; if not, deleting them saves 3.9 MB of upload.
3. **`fig-r3-run434.svg` is 272 KB** because it plots every sample. A
   decimated version would be a tenth of that, but it is a data figure and
   thinning it is a decision about the evidence, so I left it.
4. **The duplicate photograph** (section 2).
5. **MD Simulations map labels in Chinese.** With the page in Chinese, the
   chip "1–23（野生型）" runs into its "23 殘基" count at 1440. The fix is in
   `md-simulations/map.js` (chip width or label position), which is not in my
   file list.
6. **No-JavaScript reading** of the notebook, the MD map and the Peptide Design
   ledger is unchanged from the first pass's item 8.

## 5. Requests for the shared layer

1. **Rounded corners in `page.css`.** `.toc` on a phone (the collapsed
   Contents box) and `.tablewrap` are drawn with `--radius` / `--radius-sm`
   (0.5rem / 0.3125rem). The design system says zero radius except focus. Model,
   Software, MD Simulations and Protein Design each carry page-level overrides
   to undo it for their own components, and the phone Contents box is still
   rounded on all of them. Setting both tokens to 0, or removing the radius
   from those two rules, fixes it once and lets the overrides go.
2. **A section-strip scroller.** `protein-design/stepnav.js` (twelve lines)
   brings the current step into view on a narrow screen. Hardware's `.hwnav`
   has the same problem; if the shared agent wants one helper in `page.js`
   for any horizontally scrolling local nav, this file can go.
3. The first pass's three requests (Hardware pager, review-note toggle
   position, static heading ids) still stand.
