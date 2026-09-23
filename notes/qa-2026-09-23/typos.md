# ReLeaf wiki: spelling and typo candidates

Run 2026-09-23. Nothing in the repo was changed.

**Scope.** 38 pages: every `.html` except the nine `md-simulations/*.html` reports, `education/website/**` and `build/**`. `software/ui/0906UI.html` is included. Each page was rendered in Chrome from a local static server, so text that JS builds is included too: team bios from `assets/data/roster.js`, the hardware stories, the evomap and the nav blurbs. Text inside `script`, `style`, `code`, `pre`, `kbd`, `samp`, `svg` and the dev-only `rulecheck.js` overlay was stripped. The nav and footer are counted once, as "(shared nav + footer)". Reference lists (`.refs`) were left out of the spell check.

**Method.** 3,403 distinct words were left after filtering: words with digits, ALL-CAPS acronyms, internal capitals (camelCase, gene and construct names), any word that appears in italics anywhere, and any word used 3 or more times in the wiki were all dropped. The remaining words went through the macOS system spell checker (NSSpellChecker), and a word counted as correct if either en_US or en_GB accepted it. That flagged 149 words, which I reviewed by hand. About 125 were jargon, product names, place names or author names (for example sparging, retentate, Poiseuille, Kinmen, Syngenta, Seneviratne) and were dropped. I also spell-checked the 3-or-more-times words on their own, and they turned up nothing real.

Other checks: doubled words (none found), unbalanced brackets and quotes in each paragraph (one hit, an emoticon), `[n]` markers without a reference list, placeholder text, species names not in italics, British vs American spelling on each page, and how the same term is spelled across pages.

---

## 1. Typos (highest confidence first)

### 1a. In page prose

None of the long-form wiki prose has a plain misspelling that the checker could find. What is left is formatting and consistency, covered below. Three items belong here:

| # | Page (source) | Context | Suspect | Suggestion |
|---|---|---|---|---|
| P1 | hardware/ (`hardware/index.html:71`) | "`<b>Four instruments</b>and how they fit`" | missing space | The gap is drawn by CSS `margin-right` only, so the DOM text, copy-paste and screen readers get "instrumentsand". Add a space: `</b> and`. |
| P2 | plant/ (`plant/index.html:916`, `:921`) | "We ran it at DingXi Elementary on 25 June and again on 2 July" | DingXi; dates | education/ spells it "Dingxi Elementary School" (`education/index.html:114`, `:130`), with sessions on 25–26 Jun and 14 Jul. The capitalisation and the dates disagree between the two pages. |
| P3 | plant/ (`plant/index.html:916`) | "Fushing, in June and again on 14 August, got the slide version" | Fushing | This school is not in the education/ session table, which has two "school name to add" TODOs. Check the romanisation (Fuxing? Fu Hsing?) and make the two pages match. Low confidence. |

### 1b. Team bios (`assets/data/roster.js`, rendered on team/)

| # | Line | Context (≤15 words) | Suspect | Suggestion |
|---|---|---|---|---|
| T1 | roster.js:232 | "I joined IGEM aiming to gain expereicne of molecular cloning technique" | expereicne; IGEM | experience (in); iGEM |
| T2 | roster.js:225 | "I'm extremely passioante in both biology and chemistry" | passioante in | passionate about |
| T3 | roster.js:85 | "I am looking foward to create a significant project" | foward; to create | forward to creating |
| T4 | roster.js:183 | "my passion lies in robotics, specfically FRC at the moment" | specfically | specifically |
| T5 | roster.js:183 | "working alongside other passionate hardworkers to understand difficult topics" | hardworkers | hard workers |
| T6 | roster.js:197 | "listening to music, gyming or running, and shopping in my freetime!" | freetime | free time (and "gyming" is slang; "going to the gym") |
| T7 | roster.js:197 | "I joined iGem because of my ongoing passion for biology" | iGem | iGEM |
| T8 | roster.js:197 | "research with new friends on integrated biology,making a difference to society!" | biology,making | biology, making |
| T9 | roster.js:197 | "the research and wetlab based experiences that I will derive" | wetlab based | wet-lab-based (the wiki uses "wet lab" 235 times) |
| T10 | roster.js:274 | "I joined igem to collaborate with like-minded peers" | igem | iGEM |
| T11 | roster.js:398 | "one of wetlab instructors. I passionate about science" | missing verb | "one of the wet lab instructors. I am passionate about science" |
| T12 | roster.js:398 | "Also I enjoy guiding students in hand-on experiments." | hand-on | hands-on |
| T13 | roster.js:218 | "I'm passionate of math and biology and I am looking forward to solve problems" | passionate of; to solve | passionate about; to solving |
| T14 | roster.js:232 | "I am also really looking forward to create something on my own" | to create | to creating |
| T15 | roster.js:71 | "I love r&b musics, movies, and traveling" | r&b musics | R&B music |
| T16 | roster.js:370 | "But often times that's how you find the gems." | often times | oftentimes (the same bio also has a comma splice: "watch who breaks first, sometimes it's the system") |
| T17 | roster.js:204 | "Looking forward to having a great time at Paris in October!" | at Paris | in Paris |
| T18 | roster.js:162 | "a field of biology I hadn't delved in before" | delved in | delved into |
| T19 | roster.js:134 | "Excited to turn ideas into real solutions" | no final full stop | add "." |

Bios are in each person's own voice, so T5, T6, T15 and T16 may be left as they are. T1–T4, T7, T8 and T10–T12 are plain errors.

### 1c. Typos inside images (already tracked on the pages)

The spell checker also flagged words that appear in quotation marks inside the visible "To fix" boxes. These quote misspellings in the figure images, not in the page text, and the boxes already list them: laws-and-regulations/ F11 (Figure 8): "Fertilzier", "registraion", "explictly", "regulaotry transition hasbeen", "consdieration"; laws-and-regulations/ (Figure 1/2 box, `:97`, `:112`): "Regultion", "Mangement", "Environemntal", "Biil"; entrepreneurship/ F3 (Figure 7, `:254`): "IBioreactor", "threatsmore"; entrepreneurship/ (`:338`): "Keep Complelety Informed". The images still have to be corrected.

---

## 2. Formatting: species names not in italics

These are text nodes outside `<i>`/`<em>` and outside `.refs`. Everywhere else in the body text the wiki italicises *B. subtilis* and *Arabidopsis*, so these are the exceptions.

| Source | Name | Context |
|---|---|---|
| index.html:1591 | Arabidopsis | "Stress tests with Arabidopsis" (task label) |
| index.html:1701 | B. subtilis | "Cloning into B. subtilis" (task label) |
| index.html:1711 | B. subtilis | "B. subtilis growth tests" (task label) |
| hardware/index.html:258 | Arabidopsis | "Arabidopsis needs steady humidity, temperature and light" |
| hardware/index.html:298 | Arabidopsis | "keeps humidity steady while Arabidopsis germinates" |
| hardware/index.html:328 | B. subtilis | "has published on B. subtilis bioreactor systems" |
| hardware/index.html:343 | Arabidopsis | "Arabidopsis grows hydroponically on a plate" |
| hardware/index.html:348 | B. subtilis | "how much B. subtilis is in the reactor loop" |
| hardware/diopal/index.html:568 | B. subtilis | "engineered **B. subtilis 168**" (bold, not italic) |
| safety-and-security/index.html:73 | B. subtilis | scaffold note "B. subtilis 168, risk group…" |
| plant/index.html:37, 309, 542, 684, 771, 826 | Arabidopsis | plant/ never italicises *Arabidopsis* (0 of 6), while peptide-design/, milestone/ and sustainability/ italicise it throughout |

---

## 3. Consistency of terms across pages (counts per page, not verdicts)

Counts are over body text with the nav, footer and references excluded. For most terms only the pages that use a minority form are listed. For fibre/fiber and *B. subtilis* every page is listed.


**hollow fibre/fiber**: `hollow-fibre` 22, `hollow-fiber` 16 (wiki total)

| Page | `hollow-fibre` | `hollow-fiber` |
|---|---|---|
| bioreactor-calculations/ | 2 |  |
| description/ |  | 5 |
| entrepreneurship/ | 6 |  |
| hardware/bioreactor/ |  | 7 |
| hardware/ | 2 |  |
| hardware/photometer/ |  | 2 |
| human-practices/ | 6 |  |
| (home) |  | 1 |
| milestone/ | 4 |  |
| software/ | 2 |  |
| software/ui/0906UI.html |  | 1 |

**fibre/fiber (any)**: `fibre` 46, `fiber` 40 (wiki total)

| Page | `fibre` | `fiber` |
|---|---|---|
| (shared nav + footer) | 1 |  |
| bioreactor-calculations/ | 17 |  |
| description/ |  | 5 |
| entrepreneurship/ | 7 |  |
| hardware/bioreactor/ |  | 25 |
| hardware/ | 2 |  |
| hardware/photometer/ |  | 2 |
| human-practices/ | 7 |  |
| (home) | 1 | 4 |
| milestone/ | 5 |  |
| results/ | 1 |  |
| software/ | 5 |  |
| software/ui/0906UI.html |  | 4 |

**ReLeaf**: `ReLeaf` 364, `RELEAF` 7 (wiki total)

| Page | `ReLeaf` | `RELEAF` |
|---|---|---|
| hardware/bioreactor/ | 6 | 5 |
| hardware/ | 5 | 2 |
| *35 other pages* | only `ReLeaf` | |

**iGEM**: `iGEM` 67, `IGEM` 1, `iGem` 1 (wiki total)

| Page | `iGEM` | `IGEM` | `iGem` |
|---|---|---|---|
| team/ | 33 | 1 | 1 |
| *18 other pages* | only `iGEM` | | |

**GEMS Taiwan**: `GEMS-Taiwan` 3, `GEMS Taiwan` 3 (wiki total)

| Page | `GEMS-Taiwan` | `GEMS Taiwan` |
|---|---|---|
| (shared nav + footer) | 1 | 1 |
| (home) |  | 1 |
| milestone/ |  | 1 |
| *1 other pages* | only `GEMS-Taiwan` | |

**wet lab**: `wet lab` 235, `wetlab` 5, `wet-lab` 8 (wiki total)

| Page | `wet lab` | `wetlab` | `wet-lab` |
|---|---|---|---|
| drylab-notebook/ | 9 | 1 |  |
| engineering/ | 12 | 2 |  |
| human-practices/ | 5 |  | 4 |
| laws-and-regulations/ | 6 |  | 2 |
| peptide-design/ | 5 |  | 2 |
| team/ | 31 | 2 |  |
| *29 other pages* | only `wet lab` | | |

**dry lab**: `dry lab` 218, `drylab` 2, `dry-lab` 1 (wiki total)

| Page | `dry lab` | `drylab` | `dry-lab` |
|---|---|---|---|
| milestone/ | 8 | 1 |  |
| peptide-design/ | 8 |  | 1 |
| team/ | 16 | 1 |  |
| *33 other pages* | only `dry lab` | | |

**on-farm**: `on-farm` 6, `on farm (adj?)` 1 (wiki total)

| Page | `on-farm` | `on farm (adj?)` |
|---|---|---|
| (home) | 2 | 1 |
| *2 other pages* | only `on-farm` | |

**OD600**: `OD₆₀₀` 4, `OD600` 57 (wiki total)

| Page | `OD₆₀₀` | `OD600` |
|---|---|---|
| bioreactor-calculations/ | 4 |  |
| *10 other pages* | only `OD600` | |

**B. subtilis form**: `B. subtilis` 82, `Bacillus subtilis` 10 (wiki total)

| Page | `B. subtilis` | `Bacillus subtilis` |
|---|---|---|
| (shared nav + footer) | 2 |  |
| bioreactor-calculations/ | 4 |  |
| description/ |  | 2 |
| education/ | 1 |  |
| engineering/ | 13 | 1 |
| entrepreneurship/ | 9 | 1 |
| geospatial-analysis/ |  | 1 |
| hardware/bioreactor/ | 10 |  |
| hardware/diopal/ | 2 | 1 |
| hardware/ | 3 | 1 |
| hardware/photometer/ | 8 |  |
| human-practices/ | 5 |  |
| (home) | 6 |  |
| laws-and-regulations/ | 4 | 1 |
| milestone/ | 5 |  |
| peptide-design/ | 3 | 1 |
| plant/ | 4 |  |
| safety-and-security/ | 1 |  |
| software/ | 2 |  |
| sustainability/ |  | 1 |

**BioDrop**: `Biodrop` 3, `BioDrop` 9 (wiki total)

| Page | `Biodrop` | `BioDrop` |
|---|---|---|
| milestone/ | 3 |  |
| *1 other pages* | only `BioDrop` | |

**Luer**: `Luer` 6, `luer` 3 (wiki total)

| Page | `Luer` | `luer` |
|---|---|---|
| hardware/bioreactor/ | 5 | 1 |
| hardware/photometer/ |  | 2 |
| *1 other pages* | only `Luer` | |

**CcaSR**: `CcaSR` 5, `CcaS-CcaR` 2 (wiki total)

| Page | `CcaSR` | `CcaS-CcaR` |
|---|---|---|
| hardware/ |  | 2 |
| *3 other pages* | only `CcaSR` | |

**DingXi**: `Dingxi` 2, `DingXi` 2 (wiki total)

| Page | `Dingxi` | `DingXi` |
|---|---|---|
| plant/ |  | 2 |
| *1 other pages* | only `Dingxi` | |

**CH Biotech**: `CH Biotech` 35, `CH Bio (short)` 12 (wiki total)

| Page | `CH Biotech` | `CH Bio (short)` |
|---|---|---|
| plant/ | 3 | 12 |
| *6 other pages* | only `CH Biotech` | |

Uniform across the wiki (no action): optogenetic: only `optogenetic` (12x); bioreactor: only `bioreactor` (211x); biostimulant: only `biostimulant` (63x); biocontrol/biopesticide: only `biopesticide` (5x); dataset: only `dataset` (4x); AlphaFold 3: only `AlphaFold3` (16x); E. coli form: only `E. coli` (4x).


**Notes on the table**
- **fibre / fiber** is the biggest split. hardware/bioreactor/ (25 fiber), description/, hardware/photometer/, the home page and 0906UI use *fiber*. bioreactor-calculations/, entrepreneurship/, human-practices/, milestone/, software/ and hardware/ use *fibre*. The home page mixes both (1 fibre, 4 fiber).
- **RELEAF** in capitals appears in running prose on hardware/ ("RELEAF is designed to make plant protectant…", `hardware/index.html:48`) and hardware/bioreactor/ (`:86`, `:114`, `:413`, `:731`, `:799`). Everywhere else it is *ReLeaf*.
- **GEMS-Taiwan** (hyphenated) is used in the hardware section's `<title>`s, meta descriptions and outro lines, and in engineering/'s Zotero path. Every other page uses *GEMS Taiwan*.
- *Bacillus subtilis* written out is normal on first mention. It is listed only for completeness. No page uses "B.subtilis" or "B. Subtilis".
- *wet-lab* and *dry-lab* with hyphens are correct as compound adjectives ("wet-lab data"). The ones to fix are the closed forms *wetlab* and *drylab*: drylab-notebook/ "wetlab handoffs", engineering/ Zotero folder "Wetlab", milestone/ "Collaborate with Drylab" (quoting a box in a figure), and the team bios.
- **CH Bio** is used as the short form on plant/ (12×) and *CH Biotech* everywhere else (35×). This is probably deliberate but worth a look.
- **OD₆₀₀** with a subscript appears only on bioreactor-calculations/. Everywhere else it is *OD600*.

---

## 4. British vs American spelling, per page

These counts are for about 45 word families (‑ise/‑ize, ‑our/‑or, ‑re/‑er, ‑ll‑/‑l‑, grey/gray, fertiliser/fertilizer, programme, licence, ageing, mould, sceptic, orthologue, haem). Three uses of "characterised" from the menu blurb in `site-nav.js` were taken off every page. Most of the wiki is British. The US-dominant pages are the hardware pages, description/ and laws-and-regulations/.

| Page | UK forms | US forms | Dominant | Minority forms on the page |
|---|---|---|---|---|
| (shared nav + footer) | 2 | 4 | US | standardisation (1), fibre (1) |
| attributions/ | 0 | 1 | US |  |
| bioreactor-calculations/ | 26 | 0 | UK |  |
| data-physicalization/ | 11 | 0 | UK |  |
| data-physicalization/listening/ | 0 | 4 | US |  |
| description/ | 9 | 16 | US | modelling (3), colour (2), neighbour (1), labour (1), kilometres (1), defences (1) |
| drylab-notebook/ | 6 | 2 | UK | optimization (2) |
| education/ | 33 | 0 | UK |  |
| engineering/ | 5 | 4 | UK | heme (4) |
| entrepreneurship/ | 37 | 17 | UK | fertilizer (11), labor (2), center (2), aging (1), fertilizers (1) |
| experiments/ | 6 | 0 | UK |  |
| geospatial-analysis/ | 22 | 12 | UK | fertilizer (12) |
| geospatial-analysis/routing/ | 2 | 3 | US | tonne (1), tonnes (1) |
| hardware/bioreactor/ | 2 | 25 | US | characterise (2) |
| hardware/diopal/ | 6 | 5 | UK | organized (2), characterization (2), characterizes (1) |
| hardware/hydroponics/ | 5 | 1 | UK | labor (1) |
| hardware/ | 3 | 0 | UK |  |
| hardware/photometer/ | 4 | 7 | US | behaviour (2), centre (1), labelled (1) |
| human-practices/ | 28 | 5 | UK | center (5) |
| (home) | 8 | 5 | UK | fiber (4), heme (1) |
| laws-and-regulations/ | 39 | 63 | US | fertilising (11), harmonised (7), labelling (5), standardised (3), organisations (2), analysed (2), fertiliser (2), characterised (1), characterise (1), recognises (1), recognise (1), labelled (1), defence (1), licence (1) |
| milestone/ | 16 | 0 | UK |  |
| model/ | 1 | 1 | tie | UK: modelling / US: behavior |
| parts/ | 5 | 0 | UK |  |
| peptide-design/ | 21 | 0 | UK |  |
| plant/ | 20 | 6 | UK | labor (6) |
| results/ | 2 | 0 | UK |  |
| software/ | 14 | 0 | UK |  |
| software/ui/0906UI.html | 2 | 5 | US | vapour (1), labelled (1) |
| sustainability/ | 9 | 0 | UK |  |
| team/ | 1 | 6 | US | favour (1) |

**Notes**
- laws-and-regulations/ uses *fertilizer* 61 times and *fertilising/fertiliser* 13 times. Many of the British ones are inside EU names ("EU fertilising products", Regulation 2019/1009), which should stay as they are. The page's own prose is otherwise mixed: *harmonised*, *labelling* and *organisations* sit next to *fertilizer* and *labor*.
- entrepreneurship/ and geospatial-analysis/ are British apart from *fertilizer* (11 and 12), *labor* and *center*.
- hardware/bioreactor/ is American (*fiber*) apart from *characterise* (2). hardware/photometer/ and hardware/diopal/ are split almost evenly.
- description/ is the most mixed page: *recognize, localized, specialized, centralized, labor, fiber* next to *colour, neighbour, labour, modelling, kilometres, defences*. It uses both *labour* and *labor*.
- team/: the bios use *traveling* (5) and *favorite*, and one uses *favourite*. This is fine for personal voice.
- *heme* (engineering/, home) is the usual spelling in biochemistry even in British text and can stay.

---

## 5. Citation markers

Every page with `[n]` markers in the body has a reference list, and no marker number is higher than the number of references:

| Page | Markers | Highest n | Reference items |
|---|---|---|---|
| bioreactor-calculations/ | 10 | 9 | 13 |
| data-physicalization/ | 3 | 3 | 3 |
| education/ | 1 | 1 | 2 |
| engineering/ | 7 | 5 | 5 (`ol.refs` inside `#refs`) |
| entrepreneurship/ | 5 | 8 | 9 (item 9 is the "Still to be added…" note) |
| geospatial-analysis/ | 2 | 2 | 6 |
| human-practices/ | 17 | 10 | 11 |
| laws-and-regulations/ | 25 | 15 | 15 |
| peptide-design/ | 29 | 17 | 17 |
| plant/ | 6 | 6 | 6 |
| software/ | 9 | 7 | 7 |
| sustainability/ | 6 | 4 | 4 |

bioreactor-calculations/ lists 13 references but cites only [1]–[9] with markers. The rest are probably cited by name in the text. Check this if every reference is meant to be cited. geospatial-analysis/ reference 2 reads "full citation Authors, title, journal and DOI still to be recorded."

---

## 6. Placeholder and unfinished text

I found no "lorem", "[citation needed]" or "TODO" typed into the prose. The unfinished content that is left is all marked up on purpose:

| Page | Visible "To fix" boxes (`aside.fix`) | Scaffold notes (`.scaffold`) | `.todo` spans | Empty pending chips (`.pending`) | Other |
|---|---|---|---|---|---|
| laws-and-regulations/ | 13 (F1–F13) | | 1 | | "TBD" ×2 (Figure 3 cells), "Check this." ×2 in fix boxes |
| entrepreneurship/ | 11 (F1–F11) | | 1 | | refs item "Still to be added: … Bray et al. (2000), Mittler (2002)…" |
| sustainability/ | 6 (S1–S6) | | 4 | | |
| engineering/ | | | 12 | | quotes "Second… [xxx]" from the design text (`:162`, `:1761`) |
| geospatial-analysis/ | | | 15 | | ref 2 "still to be recorded" |
| education/ | | | 4 | | "school name to add" ×2 in the session table; "still to be mirrored here" |
| hardware/diopal/ | | | | 71 | |
| hardware/hydroponics/ | | | | 58 | "…every performance figure are still to be supplied" |
| hardware/photometer/ | | | | 43 | |
| hardware/bioreactor/ | | | | 36 | "confirm" tags ×4; "delivered by a [empty] emitter" (`:349`) |
| bioreactor-calculations/ | | | | | 16 `tag--verify`; "15 h⁻¹ placeholder" kLa (intentional) |
| experiments/, notebook/, safety-and-security/, model/, measurement/, parts/, results/, contribution/, gallery/, inclusivity/ | | 11, 12, 10, 8, 7, 7, 7, 6, 4, 4 | 1 each | | each also has the grey `.status` box |

With `window.RULECHECK = true`, rulecheck.js also shows "TO FINISH … figure placeholders" panels on drylab-notebook/ (2), hardware/bioreactor/ (5), hardware/diopal/ (4), hardware/hydroponics/ (4), hardware/photometer/ (6), measurement/ (2), model/ (1), parts/ (1), results/ (1) and software/ (4). `site-nav.js` has to set `RULECHECK = false` before the wiki is frozen.

---

## 7. Checked and clean

- Doubled words ("the the"): 0 in all prose, including bios and JS-built text.
- Unbalanced ( ) [ ] “ ” within a paragraph: 0 real cases. The one hit is the bio emoticon "Hi :)".
- Missing space after a comma: 1 (T8). Missing space after a full stop: 0.
- "a" before a vowel sound or "an" before a consonant: 0 real cases. "a one-hectare" and "A one-page" are correct.
- Spell-checker hits dismissed as correct or specialist words (sample): sparged, sparging, retentate, foulant, Poiseuille, Runge–Kutta, choropleth, georeferenced, shapefile, isoschizomers, transilluminator, miniprepped, electroporations, orthologues, osmolyte, hyperhydricity, halotropism, cutin, surfactin, sterically, missense, Radioligand, bidentate, ectodomain, oxidoreductase, carryable, culturable, unrescued, unsanitised, retaskable, stallholder, tared, Kelpak's, Hadany, Seneviratne, Folberth, Khabarov, Kinmen, Penghu, Lienchiang, Yunlin, Changhua, Nantou, Alishan, Yushan, Tamsui, Corteva, Syngenta, Koppert, Rovensa, Valent, Andermatt, Marrone, Aquagri, Rhizogen, Qwiic, openpyxl, Zotero, and the Portuguese source titles on the home page ("Fotossíntese", "dezembro").
- Worth checking but not marked as errors: "Biophsep (科百特) mPES Minilab" (`bioreactor-calculations/index.html:57`, `:970`). 科百特 is Cobetter, so confirm the vendor's own spelling of the product line.
