# Overnight QA pass, 23 September 2026

What changed on the demo wiki overnight, why, and what still needs a person.
Nothing here wrote or changed the team's prose, data or figures. Every change
was tested in headless Chrome (and the Safari fixes in WebKit) before it was
committed, one commit per fix, so any one of them can be reverted on its own
with `git revert <hash>`.

Live demo: <https://timmy97-tw.github.io/releaf-wiki/>. If a page still looks
like the old version, press Cmd+Shift+R once: GitHub Pages lets browsers keep
scripts for 10 minutes.

---

## 1. Tools the team can use from now on

**`python3 build/audit.py`** reads every page and lists what would break or be
blocked on the iGEM wiki: files loaded from outside iGEM, links to files or
anchors that do not exist, paths that only work on a Mac's case-insensitive
disk, standard iGEM addresses without a page, duplicate ids, citations past the
end of a reference list, images with no alt text, and every scaffold / status /
pending / placeholder marker still on a page. It changes nothing. Run it after
every batch of edits; it exits non-zero while anything blocking remains. It is
clean tonight.

**The iGEM rule check** is the small button in the bottom-left corner of every
page of the demo wiki. It counts what on that page breaks an iGEM 2026 rule:

- **Blocked**: something loaded from a server outside iGEM (iGEM allows only
  igem.wiki / igem.org).
- **To finish**: scaffold notes, status boxes, figure placeholders, pending
  values and open items still on the page.

Click it for the list; click an item to jump to it. "Show outlines on the page"
draws dashed boxes around each one (off by default). Links out to other sites
are not flagged. It is switched off with `window.RULECHECK = false` at the end
of `assets/data/site-nav.js`, which is how Releaf-Actual ships.

---

## 2. What changed (49 commits)

**Navigation and every page**
- `b2c11a0` The five-tab menu: hover-then-click closed the panel, a tap on a
  touch laptop opened nothing, and the keyboard could reach only Team's links.
  All three fixed; Escape, arrow keys and focus-out behave.
- `ac818a1` A "Skip to content" link on every page (keyboard users).
- `452917c` Five 404 errors on every page's console from nav artwork that does
  not exist yet are gone (`art: true` in site-nav.js turns a drawing on).
- `0c83bb8`, `79f07a3` Contents rail: links to repeated headings went to the
  first copy (Sustainability), links on Plants and Software landed up to
  5,400 px from their heading while images loaded, and the highlighted entry
  went stale after jumps. All fixed, in Chrome and WebKit.
- `65ce8c7` Figures open full-window from the keyboard too.
- `6e79b31`, `5688697` Contrast: label text that measured 2.5:1 now 5.1:1, and
  the nav, rails, Engineering's green wavelength words and the team page raised
  to at least 4.5:1. The look is unchanged apart from slightly darker greys.
- `732d4bd` The Inter typeface is served as woff2 (349 KB instead of 875 KB):
  every page's first load is about half a megabyte lighter.
- `50e5bf2`, `5c479e7` Safari: a black box that covered the homepage wordmark,
  and the frosted-glass blur missing in Safari 16/17, both fixed.

**Pages**
- Homepage (`8bf1824`, `01da0f3`, `7e3cba0`): a `<main>` landmark; scrolling does
  about 40% fewer layouts and 60% less script work on a slow phone with
  identical visuals; a part picked before the 3D model loads now lights up.
- Education (`0f31d92`, `8b8f2bc`, `fa6744a`): the education website is on the
  wiki at `education/website/` (all 8 pages, the Chinese versions, the 3 games),
  so judges can count it. Its own design and words are unchanged; photos were
  scaled down (57 MB to 11 MB) and Google Fonts self-hosted. The 2023 wiki link
  there was dead and is fixed.
- Data Physicalization (`5607151`): the listening player is on the wiki at
  `data-physicalization/listening/`.
- Hardware (`1973312`, `54d95e0`, `99ec82e`, `2945826`): a stray `</main>` that
  pulled a caption out of its figure; the hub no longer widens on phones;
  reading labels floored at 11px (some were 7-9px); a Safari console error on
  Bioreactor; the "Jump to /" pill no longer covers the Team tab; stale `?v=`
  cache tags refreshed.
- Dry Lab Notebook (`3a699df`): the pinned card survives a window resize, the
  board no longer rebuilds while a phone scrolls, contrast, `<main>`.
- MD reports (`739b736`): the required licence and repository footer.
- Geospatial routing tool (`b470e96`, `cfe3ee6`): Leaflet is bundled instead of
  loaded from a CDN; failed routes are counted honestly instead of reported as
  done; requests paced to OSRM's one-per-second policy; keyboard route list.
- Peptide Design, Team, Human Practices: small fixes (`b813f05`, `d68953e`,
  `a8b39dd`, `c648cd0`, `d2424ce`).
- `9744690` The notes now match the 2026 rules (see section 4).

**Accessibility scan (axe-core, 56 pages at two widths, plus menus and the
lightbox open)**: failing checks went from 1,811 to about 1,050, and
critical ones from 50 to 2. The site nav is a proper navigation landmark,
sideways-scrolling tables can be scrolled from the keyboard, unnamed
buttons, selects and links have names, `--gray-500` is a shade darker so
grey text passes on tinted panels, and the footer links are underlined
(`004252f` to `e611b11`, `b1f6c20`, `127b6da`). Most of what remains is in
the ported education website's own design, which was left alone.
- `238fb9c` Engineering: the intro and hint on the dark assembly-ladder plate
  were drawn in dark ink (1.7:1, practically invisible). A CSS ordering slip;
  they are readable again in the colours the design specified.

---

## 3. Releaf-Actual: the iGEM-deployable draft

<https://github.com/Timmy97-TW/Releaf-Actual> (preview:
<https://timmy97-tw.github.io/Releaf-Actual/>, images blank until uploaded).

iGEM's GitLab accepts at most **11 MiB per push** and **10 MiB per Pages
build** (checked on gitlab.igem.org, 23 Sep). This wiki is about 150 MB,
almost all of it images, video, PDFs and 3D models. Releaf-Actual is the same
site with every one of those files taken out and pointed at the address it
will have on `static.igem.wiki`, which brings the code to about 9 MiB. Its
README explains the upload list (`UPLOAD_MANIFEST.csv`), the GitLab CI file,
and how to rebuild it from this repository with one command after any change
here.

---

## 4. Needs a person, most urgent first

1. **Dates** (competition.igem.org/calendar, Taipei time): the final Project
   Safety Form is due **7 October, 23:00**, submitted by a PI. The wiki,
   Attributions Form, Judging Form, Registry and Software all freeze
   **21 October, 23:00**. No Judging Form means no medals or awards.
2. **Moving to iGEM's GitLab.** The team repository there is still the empty
   template (last commit 2 July). All media has to be uploaded to
   static.igem.wiki first. Start with Releaf-Actual's README.
3. **There is no Plant award in 2026.** Best Plant Synthetic Biology became
   Best Alternative Platform, judged only at `/alternative-platform`, and it
   excludes *B. subtilis* (Judge Handbook p.48, p.83). `/plant` stays on the
   wiki, but no ballot will link to it. If the team wants that award, the
   case goes on a new `/alternative-platform` page.
4. **Attributions**: the form iframe still says team `0000`; GEMS Taiwan is
   **6072**. Disclose AI tool use (including Claude) in the form's AI section.
5. **Routing map**: it still loads map tiles from openstreetmap.org and routes
   from router.project-osrm.org. The fix is to precompute the routes and host
   a basemap image on static.igem.wiki, or turn the tool into a static figure.
   The Geospatial page's own limitations list still says it "fetches Leaflet
   from a CDN"; that part is now fixed.
6. **Software**: the Software page records `0906UI.html` by its SHA-256
   (`4f3a9733...`), so that file was deliberately left untouched even though
   it scrolls sideways on a phone. A phone fix belongs in a new build with the
   hash and line count updated together. The 2026 software repository goes in
   `gitlab.igem.org/2026/software/<team>/` (`2026/software-tools` does not
   exist).
7. **Hardware upstream**: the hardware section is synced from its own
   repository. Carry these fixes there or the next sync undoes them:
   `1973312`, `54d95e0`, `99ec82e`, `50e5bf2` (hardware CSS lines),
   `2945826`.
8. **Unfinished content** (`python3 build/audit.py` lists it per page):
   scaffold notes on 10 pages, a status box on 19, 208 pending values, 62 open
   items and 19 empty photo frames across the four instrument pages.
9. **Proofreading lists** for students in `notes/qa-2026-09-23/`:
   `typos.md` (mostly the team bios in `assets/data/roster.js`, plus the
   DingXi/Dingxi school name and dates that disagree between Plants and
   Education, and species names not in italics) and `links.md` (no dead
   links; three references on Plants to open by hand once).
10. **Accessibility left for the page owners**: some pages skip a heading
    level (h2 to h4: Dry Lab Notebook, Entrepreneurship, Plants, Software,
    Peptide Design), and the four instrument pages have two `<h1>`s each.
    Changing these moves the contents numbering, so they are not automatic.
    Colours a designer should decide: white on the mid-green segment in
    Human Practices (3.3:1), the SDG colours on Sustainability, the module
    colours on the homepage, the task chips on Team. Empty corner `<th>`
    cells in Laws and Peptide Design tables. The listening page and the
    education website keep their own low-contrast greys.
11. **Not tested**: Firefox would not start on this Mac, so the pages were
    checked in Chrome and WebKit only. Open the homepage once in real Safari
    to confirm the black box is gone.
12. **Homepage art still to draw**: `ihp-timeline.png`, `vision-hydroponics`
    and `vision-field` (the page hides those figures until the files exist).
