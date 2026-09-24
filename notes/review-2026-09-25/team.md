# Overnight review, 25 September 2026: Team cluster

Pages: `team/` (Members), `attributions/`, `gallery/`, `inclusivity/`, plus
`assets/css/team.css`, `assets/js/team.js`, `assets/data/roster.js`,
`assets/img/members/**`. Milestone was not touched (another agent owns it).
Branch `night/team`. `python3 build/audit.py` is unchanged (0 missing, 0 external,
0 dupid, 0 alt; the 6 anchor findings are all on model/).

## 1. What I changed

| Commit | Change |
|---|---|
| `2be77f1` | Team: member photos re-encoded as WebP, 11.5 MB down to 3.4 MB. Portraits stay 720 x 900; working and goofy photos scaled to 1100 px long edge (enough for the profile view at 2x). No crop, no colour change; EXIF orientation applied, metadata stripped. roster.js paths updated; its header now gives the one-line conversion command for the next batch. The .jpg files are removed from the tree (in git history). `elizabeth-wong.jpg` dropped: unused since 799ea92 removed her card. |
| `9e2cada` | Team: ten plain typos fixed in seven bios (list below). |
| `0df2125` | Attribution: iframe `src` team number `0000` changed to `6072`; the medal callout and the grey instruction box removed (iGEM: nav, footer, form, "nothing else"); Status line now says the form is not started. |
| `af5d35c` | Team: redrawn in the wiki's own design (loads page.css; standard page head, prev/next, full footer); decoration removed; native `<dialog>` profile; card names are real buttons; 2-column grid at 390 px; lede counts people and schools from roster.js; section headings in sentence case (ids unchanged). |
| `16929dd` | Gallery: Draft from 19 photographs already on other pages, month by month, each linking back; review note per section. |
| `8202dbc` | Inclusivity: Draft of all six sections from evidence on Education (and education/website/zh), Human Practices, Data Physicalization, Geospatial Analysis, Sustainability, Entrepreneurship and Members; review note per section against the Inclusivity Award question. Gallery status box reworded. |
| `b391c87` | Team: one review note for the page as a whole. |
| (this file) | Notes. |

### Typos fixed in bios (roster.js), from notes/qa-2026-09-23/typos.md 1b

| QA id | Person | Before | After |
|---|---|---|---|
| T1 | Sara Chen | "gain expereicne of" | "gain experience of" |
| T1 | Sara Chen | "joined IGEM aiming" | "joined iGEM aiming" |
| T2 | Ryan Yuan | "extremely passioante in" | "extremely passionate in" |
| T3 | Alex Li | "looking foward to create" | "looking forward to create" |
| T4 | Noah Tau | "specfically FRC" | "specifically FRC" |
| T7 | Olivia Lin | "I joined iGem" | "I joined iGEM" |
| T8 | Olivia Lin | "integrated biology,making" | "integrated biology, making" |
| T10 | Sophie Liu | "I joined igem to" | "I joined iGEM to" |
| T11 | Gina Yu | "I passionate about science" | "I am passionate about science" |
| T12 | Gina Yu | "hand-on experiments" | "hands-on experiments" |

Left alone as voice or grammar rather than misspelling: "passionate in/of", "to create/to solve/to creating", "hardworkers", "freetime", "gyming", "wetlab", "r&b musics", "often times", "at Paris", "delved in", the missing final full stop in Ethan Liu's bio, "one of wetlab instructors" (T5, T6, T9, T13-T19). The team can fix them if the writers agree.

### Team page: what was removed and why

Per-section icons in the jump bar (no meaning), the frosted-glass bar, the hover
lift and green glow ("optogenetic activation"), drop shadows and rounded corners,
colour-per-task pills and the colour legend for them, the "task owner / task member"
key (no roster entry has had an owner since 799ea92, so the key described nothing),
the per-person gradient frame and leaf sprig watermark in the profile, the animated
gold "open seat" card and its CSS (no section uses `openSlots`), the pastel
initials tiles and the camera glyph. Roles, subteams and tasks are now said in
words. A missing photo says "Portrait to come", "Working photo to come" or "Goofy
photo to come". When both profile photos are missing the frames shrink to one
short row.

Accessibility: each card is an `<li>`; the name is a `<button>` inside the `<h3>`
(stretched over the card), so headings survive for screen readers (previously the
whole card was `role=button`, which flattens its heading). The profile is a
`<dialog>` opened with `showModal()`: background inert, Escape closes, Tab cycles
between the focusable controls inside, focus returns to the card. Tested with
dispatched key events in headless Chrome at 1440, 768 and 390 px; no horizontal
scroll at 390.

## 2. Writing inconsistencies

| Where | What it says | Other place | Suggested resolution |
|---|---|---|---|
| team/ (roster.js) | 46 people shown (31 students, 9 advisors, 6 instructors) | milestone/index.html:225 "Forty-seven people, no project"; :303 "forty-seven people"; :532 "The forty-seven people are named on Team"; assets/data/site-nav.js:104 "The forty-seven of us" | Elizabeth Wong was removed on purpose in 799ea92. Either 46 everywhere or bring her card back. (47 may be right for the first meeting in December; then Milestone :532 is the one to change.) |
| roster.js:422 | "Dr. Pak", Project Advisor | drylab-notebook/index.html:984, :1081, :1097, :1105 "Dr. Pak K. Yuet" | One form on both pages. |
| roster.js:220 | "Renee Kuo" | drylab-notebook/index.html:1588, :1599 "Renée Kuo" | Ask Renee. |
| roster.js:379 | "Timmy" (no surname) | every other instructor has a full name | Decide. |
| description/index.html:40, contribution/index.html:30 | "Written by: Project leads" | team/ has no Project Leads section and lists nobody as a lead (799ea92) | Name the writers or the subteam. |
| engineering/index.html:194, :2588 | "Olivia, Sophia" | roster has two Olivias (Du, Lin) and two Sophias (Lin, Yeh); by tasks it is likely Olivia Lin and Sophia Yeh (both on Protectant) | Use surnames or initials, as the same page does for "Sophie C". |
| team/ legend (team.js) | "What a major means ... Wet Lab major" | each card shows a subteam ("Wet Lab"), not whether it is a major | Say whether the subteam on a card is the person's major. |
| roster.js:295 (Student advisors note) | "not just here to help out" + a five-item list | brief's AI-slop list | Rewrite plainly (flagged in the team review note, not edited: it is page prose). |
| roster.js bios | "wetlab", "drylab" (Gina, Timmy, Olivia Lin) | wiki uses "wet lab"/"dry lab" 450+ times | Left as personal voice. |
| gallery/ lede | "Everyone in these photographs has agreed to appear" | no consent record on the wiki | Confirm before publishing (review note). |
| attributions/ comment | "So: nav, iframe, footer" | page still carries the standard page head (title, lede, meta) and prev/next links | I kept them for wayfinding; the team decides if they count as "something else". |

## 3. Strong student writing worth keeping

- **Chloe Wu, bio (team/).** "it is truly building a foundation for how I think, collaborate with others, and contribute towards creating a measurable difference". Says what the year changed in her, not what iGEM is.
- **Abigail Lin, bio.** "the plant world is the ultimate unsolved case". One concrete image that ties a hobby to the project.
- **Timmy, bio.** "we put plants under stress and watch who breaks first, sometimes it's the system, sometimes it's us". Honest about failure, in the project's own terms.
- **Education page (source for Inclusivity).** "the barrier was English rather than biology is why every deck is now bilingual". A finding from students that changed the design; the best single piece of Inclusivity evidence on the wiki.
- **Human Practices, LINE platform.** "many smallholders are not comfortable searching for it. LINE is on almost every phone in Taiwan, so we built there". Barrier named, then the design answer.

## 4. Needs a person

1. **Attributions form not started.** With `6072` the frame loads and says "No Attributions form yet. The Attributions form hasn't been started yet." (checked 25 Sep). Bronze #2 needs it filled on teams.igem.org before the 21 Oct freeze, including the AI-tools disclosure. I only changed the team number in the existing URL format (`https://teams.igem.org/wiki/<id>/attributions`); `0000` was the template placeholder and the service rejected it ("teamID must be a positive number").
   *Judged as Bronze #2 (no review note on the page, since iGEM restricts its
   content):* as of tonight the criterion is not met, because the embedded form
   is empty. When filling it in: (a) separate what students did from what the
   instructors did (the roster names four instructors and a project advisor who
   worked at the bench and on the dry lab, e.g. Timmy appears on 43 Dry Lab
   Notebook entries); (b) credit every outside person the wiki already names as
   having shaped the work, at least Prof. Cheng Mei-Chun (seed and plate
   protocol, Plants), Dr. Kyle (weekly plant advice, Plants), Prof. Chen
   Wen-liang (hydroponics review, Plants and Human Practices), CH Biotech
   (富肽2號, Plants), Dr. Brophy, Dr. Lin, Prof. Huang, Dr. Sattely and Prof.
   Endy (Human Practices), World Vegetable Center, Ms. Chen Hui-wen (Tamsui Happy
   Farm), and the five schools on Education; (c) use roster.js `tasks` as the
   starting list of who worked on what, so the form and the Members page agree;
   (d) declare AI tool use (including Claude) in the form's AI section.
2. **Headcount 46 vs 47** (table above).
3. **School key.** Cards show KCIS, KCISLK, TAS, IBSH, AAIA, WEGO, FPS, FHJH, TES with no full names. Only "Taipei American School" is confirmed anywhere in the repo (education/website/about.html). I did not guess the rest.
4. **Missing content:** portraits for Bruce Tsai and Dr. Pak; bios for all nine student advisors and Dr. Pak; working/goofy photos for most students. The page states each as "to come".
5. **Chars Hsieh's goofy photo** (assets/img/members/goofy/chars-hsieh.webp) shows him teaching a group at a biosafety cabinet, not an obviously goofy shot. Worth confirming it is the one he chose.
6. **Support team section** is empty by design; decide whether to remove it before the freeze.
7. **With JavaScript off** the Members page shows only a noscript line pointing to roster.js. The owner's design keeps all people data out of the HTML; generating a static fallback would change that, so I left it.
8. **Gallery**: consent and credit is still a scaffold (no evidence on the wiki). Photographs of children (Dingxi class on Plants, booth visitor on Data Physicalization) were left out on purpose.
9. **Inclusivity** is drafted but not in the tab menu (NAV_UNLISTED). If it becomes one of the three Gold awards, it needs outcome evidence (see its review notes) and a menu entry.
10. **group.jpg** (assets/img/group.jpg, 2400 x 1361, 635 KB) is the Members page's first large image. It is not in my file list; a 1600 px WebP would be about a third of the weight. Only the team page uses it.

## 5. Requests for the shared layer

1. `assets/data/site-nav.js:104`: Team blurb says "The forty-seven of us"; change to match the roster once the headcount is decided (46 today).
2. `assets/js/review-notes.js`: the fixed "Hide review notes" toggle at left:12px, bottom:56px sits on top of the contents rail's last entries on Gallery and Inclusivity at 1440 px (e.g. "3. The people" / "4. Consent and credit"). Moving it to the right edge, or giving the rail bottom padding, would clear it.
3. `assets/css/page.css`: `.pagenav a` still has `border-radius: var(--radius)` and `.fig img` has `border-radius: var(--radius-sm)`; DESIGN.md wants square corners. Team page cards are square now, so the prev/next boxes under them are the one rounded thing left on that page.
4. `assets/css/page.css` `.pagenav`: when a page has only a "Next" link (Members is the first Team page), it lands in the left column. I fixed it page-locally in team.css (`.pagenav .is-next:only-child { grid-column: 2 }` at >= 640 px); the same rule belongs in page.css for every first page of a tab.
