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
