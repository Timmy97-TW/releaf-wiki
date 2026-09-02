# ReLeaf wiki

https://timmy97-tw.github.io/releaf-wiki/

The full wiki for **ReLeaf**, a stress-responsive optogenetic bioreactor for
precision plant protection. GEMS Taiwan, iGEM 2026, Biomanufacturing Village.

Thirty pages of plain HTML. No build step for reading or editing, no framework,
nothing fetched from a server outside iGEM. Open any `index.html` in a browser
and it works.

## What is here

```
index.html                the homepage
<slug>/index.html         one folder per page, so the URL is /<slug>
hardware/                 the hardware section: hub, three 3D teardowns,
                          the build notebook, and its own css/ js/ models/
md-simulations/           the MD section: the overview with the map of the nine
                          runs, plus the nine self-contained report files
assets/
  css/   tokens.css       colours, type and spacing, read by everything else
         nav.css          the five-tab navigation
         page.css         the standard sub-page
         team.css         the members page
         home.css         the homepage
         big-picture-v2.css  the big-picture figure and map on the homepage
  js/    nav.js           builds the navigation from the data file
         page.js          numbering, contents rail, citations, tabs, lightbox
         team.js          builds the member cards and profiles
         big-picture-v2.js   the figure's highlighting, the map legend, the dial
  data/  site-nav.js      every page address, in one place
         roster.js        the forty-seven people
  img/   logo, group shot, members/, home/, tab-icons/, bigpicture/
  fonts/ inter-variable.ttf
build/
  pages.py                the section outline of every standard page
  generate.py             turns pages.py into HTML
  md_overview_data.py     the MD analysis output -> md-simulations/data/runs.js
  md_banner.py            five real frames -> md-simulations/data/banner.js
  md_hero_frames.py       two real frames -> md-simulations/data/hero.js
  md_traces.py            the Asn23-Arg487 distance -> md-simulations/data/traces.js
  md_reskin_reports.py    pins the nine MD reports to light and the ReLeaf palette
  md_relink_once.py       the one-off that threaded MD Simulations into the footers
  hardware/               the notebook build pipeline and CAD scratch scripts
notes/                    structure.md, publishing.md, hardware-handoff.md
```

Four kinds of file, four folders: content in `assets/data`, appearance in
`assets/css`, behaviour in `assets/js`, and everything the browser downloads as
a file in `assets/img` and `assets/fonts`.

## Three kinds of page

**Standard pages** (24 of them: Description through Gallery) share one template.
They are generated from `build/pages.py`, which holds each page's section
outline and the note telling whoever writes it what belongs in each section.

**Special pages** are written by hand because their job is not to argue:

| Page | Why it is different |
|---|---|
| `index.html` | The homepage. Claim, refusals, system, ledger, doors. |
| `team/` | Forty-seven people, built from `assets/data/roster.js`. |
| `attributions/` | iGEM allows the nav, the footer and the embedded form on this page and nothing else. |

**The MD Simulations section** is the third exception. `md-simulations/index.html`
is a hand-written overview: a map of the nine trajectories with BoPep4 at the
centre, the design matrix, and the cross-run findings, all built at page load
from `md-simulations/data/runs.js`. That file is generated, never edited:

```bash
python3 build/md_overview_data.py
```

It reads `md-simulations/data/report_data_overview.json`, which the MD analysis
pipeline writes in one pass over all nine runs, and carries the bilingual labels
that the JSON has no opinion about.

Two more builders read the trajectories themselves rather than the summary. Each
report file embeds its own coordinates as a uint16 array for its 3D player, and
those are the same coordinates the figures on the overview are drawn from:

```bash
python3 build/md_banner.py         # -> data/banner.js
python3 build/md_hero_frames.py    # -> data/hero.js
python3 build/md_traces.py         # -> data/traces.js
```

`md_banner.py` builds the art behind the page title. It uses the wiki's standard
dark hero, which is the right ground for a molecular snapshot: BoPep4 on PEPR1
in the middle and one frame from each of the four things the set varies at the
corners, all five superposed and drawn through one camera, bond by bond out of
`anim.bonds` and coloured by element, with the pocket surface stippled in behind
the centre.

`md_hero_frames.py` builds the landing figure. It takes the wild type and the
6xHis construct, picks the frame in each that is closest to that run's own median
Asn23-Arg487 distance, superposes the receptors with Kabsch, and projects both
through one camera aimed at the contact, so the two panels differ only where the
simulations do. It also reads the Asn23 oxygens off the atom list, which is the
whole argument: the wild type ends `C, O, OXT` and the tagged construct ends
`C, O`, its OXT having moved to His29.

`md_traces.py` measures the Asn23-Arg487 closest approach in all 300 saved frames
of each of the eight peptide-bearing runs, and counts how many separate times
that contact reopens. All three builders need numpy and are safe to re-run. The nine report files beside it come from
<https://github.com/Timmy97-TW/igem2026-bopep4-md> and are pinned to light and to
the ReLeaf palette by `build/md_reskin_reports.py`, which is safe to re-run.
This is the only bilingual page on the wiki: the 中 button swaps every string and
writes the choice to the `bp4lang` key the nine reports already read, so the
language follows you into them.

Those nine files are large, about 27 MB together, because each one embeds its own
trajectory for the 3D player. Check that against the iGEM upload limit before the
freeze.

**The hardware section** is its own thing again: `hardware/` is a hub plus three
scroll-driven 3D teardowns built from the real STL files, plus the 62-page
scanned build notebook. It is dark where the rest of the wiki is light, on
purpose, and it has its own CSS, its own JavaScript and its own README. See
[notes/hardware-handoff.md](notes/hardware-handoff.md) before changing anything
in it. It carries the wiki navigation in a dark variant
(`assets/css/nav-dark.css`) and a section strip of its own.

## Writing a page

1. Open `<slug>/index.html`.
2. Delete the `<!-- generated by build/generate.py -->` comment at the top. That
   is the flag that says a human owns this file now, and the generator will
   never overwrite it again.
3. Replace each `<p class="scaffold">` with real prose. Delete the ones you do
   not need.
4. Update the header rail: **Last updated**, and **Status** from `Scaffold` to
   `Draft` to `Final`.
5. Delete the grey `.status` box at the foot when the page is written.

Things the template gives you for free:

- `<h2>` and `<h3>` are numbered automatically and appear in the contents rail
- writing `[3]` anywhere in the prose links it to the third `<li>` in the
  References list, and gives that reference a link back
- `<figure class="fig">` gets a caption and opens full-window on click
- `.callout--medal`, `.callout--unproven` and `.callout--borrowed` are the three
  boxes this project needs most often

## Changing the structure

Page addresses live in **one** place: `assets/data/site-nav.js`. Add a page
there, add its outline to `build/pages.py`, then:

```bash
python3 build/generate.py
```

The generator refuses to overwrite any page whose generated marker has been
removed, so running it after the team has started writing is safe. Add
`--force` only if you mean to throw prose away.

## Rules this wiki has to keep

- **The slugs are the addresses iGEM judges from.** `contribution`,
  `engineering`, `human-practices`, `education`, `entrepreneurship`, `hardware`,
  `inclusivity`, `measurement`, `model`, `safety-and-security`, `software`,
  `sustainability`. Rename one and that medal or award goes unjudged.
- **Nothing may load from a server outside iGEM.** Fonts, images, scripts and
  stylesheets all have to be local or on `static.igem.wiki` before the freeze.
- **Content on external sites cannot be judged.** Supplementary material goes on
  another wiki page, not on Google Drive.
- **Software judged for Best Software must be on iGEM's GitLab.**

## Local preview

```bash
python3 -m http.server 8791
```

Then open <http://localhost:8791>. A plain file:// open works too, but folder
URLs like `/plant/` will not resolve without a server.

## Before the wiki freeze

See `notes/publishing.md`. The short version: re-host every image and the
typeface on `static.igem.wiki`, put the real team number into the attributions
iframe, and delete every remaining scaffold note.
