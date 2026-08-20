# Structure

## Why the URLs are flat

The five tabs are a reading order. They are not part of any address.

The 2026 Judge Handbook fixes the URL of every judged page ("Standard Pages for
Awards", p.28): a team is evaluated for a medal or a special award only if the
work sits at the standard address. So `human-practices` reads under the
Engagement tab but lives at `/human-practices`, not `/engagement/human-practices`.

Nesting the URLs under the tabs would be tidier to look at and would cost the
team three awards.

| Page | Address | Judged for |
|---|---|---|
| Description | `/description` | — |
| Engineering | `/engineering` | Silver #1 |
| Contribution | `/contribution` | Bronze #3 |
| Results | `/results` | — |
| Experiments | `/experiments` | — |
| Parts | `/parts` | — |
| Plants | `/plant` | Best Plant Synthetic Biology |
| Measurement | `/measurement` | Best Measurement |
| Safety | `/safety-and-security` | Safety and Security Award |
| Notebook | `/notebook` | — |
| Math Model | `/model` | Best Model |
| Bioreactor Calculations | `/bioreactor-calculations` | — |
| Hardware | `/hardware` | Best Hardware |
| Software | `/software` | Best Software Tool |
| Peptide Design | `/peptide-design` | — |
| Dry Lab Notebook | `/drylab-notebook` | — |
| Integrated Human Practices | `/human-practices` | Silver #2, Best IHP |
| Education | `/education` | Best Education |
| Entrepreneurship | `/entrepreneurship` | Best Entrepreneurship |
| Sustainability | `/sustainability` | Best Sustainable Development Impact |
| Laws and Regulations | `/laws-and-regulations` | — |
| Geospatial Analysis | `/geospatial-analysis` | — |
| Data Physicalization | `/data-physicalization` | — |
| AI Responsibility | `/ai-responsibility` | — |
| Inclusivity | `/inclusivity` | Inclusivity Award |
| Members | `/team` | Bronze #1 (wiki) |
| Attribution | `/attributions` | Bronze #2 |
| Milestone | `/milestone` | — |
| Gallery | `/gallery` | — |

`/inclusivity` exists but is deliberately not in the tab panels. Gold requires
three special awards; if Inclusivity becomes one of the three, add it to the
Engagement tab in `assets/data/site-nav.js`. If it does not, the page can be
deleted, but leaving it costs nothing.

## How a page knows where it is

Every page carries one attribute:

```html
<div id="site-nav" data-base="../" data-tab="wetlab" data-page="plant"></div>
```

- `data-base` is the path back to the wiki root: `""` at the root, `"../"` one
  folder down. `nav.js` and `team.js` put it in front of every address and every
  image path, so the same data files work at any depth and under any host
  prefix. GitHub Pages serves this under `/releaf-wiki/`; the iGEM wiki serves
  it under `/gems-taiwan/`. Neither needs an edit.
- `data-tab` underlines the tab this page reads under.
- `data-page` is the slug, and marks the page as current inside its panel.

## The hardware section

`/hardware` is not a generated page. It is the students' own site: a hub, three
scroll-driven 3D teardowns assembled from the real STL exports, and the 62-page
scanned build notebook. It kept the standard `/hardware` address, which is the
one Best Hardware is judged from, so nothing about the integration costs an
award.

```
hardware/
  index.html        the hub
  photometer/       V4 in-line photometer: teardown + technical record
  diopal/           DiOPAL dual-wavelength LED array: the same
  bioreactor/       perfusion bioreactor: teardown, record, part picker
                    plus four standalone full-viewport viewers used while
                    building it (promo, product, package, final)
  notebook/         62 scanned pages, one continuous scroll
  css/ js/ img/     shared by all of the above; three.js is vendored in js/vendor
```

**It stays dark.** The three.js lighting and the glass materials are tuned
against a near-black background, and the handoff records the exposure budget
that keeps the grey from washing out. Re-theming those pages to the wiki's
paper white would break the renders, not just the mood. So the pages stay as
they are and the navigation comes to them: `assets/css/nav-dark.css` is a dark
variant of the same nav, built almost entirely by redefining the `--nv-*`
variables that `nav.css` already draws from.

Two things differ from the light bar. The dark bar paints a **scrim** rather
than a solid fill when the page scrolls, because the instrument pages are a
sticky full-height 3D stage and a solid bar would cut 112px off the top of it.
And it sits at `z-index: 50`, above the section's `.grain` and `.vignette`
overlays at 45 and 44.

Under the bar, on those five pages only, is a **section strip** (`.hwnav`)
listing Overview, the three instruments and the Notebook. The wiki nav carries
one Hardware entry for the whole section, so without the strip switching
instruments meant going back to the hub. It is plain markup in each page rather
than generated: a student adds an instrument by copying a line.

`build/hardware/` holds the notebook build pipeline (`tools/`) and the CAD
scratch scripts (`scratchpad/`). Neither is needed to serve the site.

## Numbers that do not agree across the wiki

Not typos. Four different figures for what may be the same run, from four
sources, and a judge reading straight through will hit all four:

| Page | What it says |
|---|---|
| Homepage ledger | 3 weeks of unbroken OD600 logging |
| `/hardware` hub | Longest run 400 h, which is 16.7 days |
| `/hardware/photometer` | Continuous run 14 d |
| `/hardware/notebook`, week 21 | starting the nineteen-day run |

The handoff explains part of it: the dashboard photographs are snapshots of one
continuous run at different moments, so several point-counts and durations are
all true and simply taken at different times. That reconciles the hardware
pages with each other. It does not tell us which figure the homepage should
carry. Decide on one number, say what it is a duration *of*, and make every
page use it.

The handoff also lists two flat contradictions inside the photometer record
that are still open: accuracy quoted as **8%** in §2.1 and §3.5.1 but **7.7%**
in §2.4.1 for the same pair, and tilt given as **10°** in the prose against
**8.1°** measured off the CAD, which is what the 3D model stands on.

## The two design systems

The team page was drawn in Inter with a leaf-green accent, and the whole wiki
now follows it. The homepage brief argues for the Source superfamily instead
(Source Serif 4 with Source Han Serif TC for 繁體中文, so a Chinese name inside
an English sentence sits on one baseline) and argues against Inter specifically.

That disagreement is not settled here. It is parked behind two variables in
`assets/css/tokens.css`:

```css
--font-display: "Inter", ...;
--font-body:    "Inter", ...;
```

Changing the site over means editing those two lines and dropping the new font
files into `assets/fonts`. Nothing else refers to a family by name. Whatever is
chosen has to be self-hosted and subset: the wiki blocks fonts from another
host, and a full CJK face is 10 to 20 MB.

## What is not built yet

- **Tab artwork.** Each nav tab looks for `assets/img/tab-icons/<tab-id>.png`
  and skips it silently if the file is missing, so the panels are clean until
  the drawings arrive. Five files: `project`, `wetlab`, `drylab`, `engagement`,
  `team`.
- **Photographs.** `assets/img/home/` holds eight frames from the homepage
  draft. Everything else is still being sorted in `iGEM2026_Images/`. Figures
  across the wiki are hatched placeholder boxes until then.
- **Gallery and Milestone bodies.** Both need the photograph set chosen and
  cleared first.
- **The attributions team number.** `attributions/index.html` has `0000` in the
  iframe `src`.
