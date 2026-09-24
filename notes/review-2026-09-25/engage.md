# Engagement tab: overnight review, 25 September 2026

Branch `night/engage`. Pages: Integrated Human Practices, Education, Entrepreneurship,
Sustainability, Laws and Regulations, Geospatial Analysis, Data Physicalization.
Every page got a review note at the end of every h2 section (and, on Human
Practices, of each long h3 in section 3): **74 notes** in total. No student body
prose was rewritten. `python3 build/audit.py` is unchanged (0 missing, 0 external,
6 anchors, all on model/, not mine). No page scrolls sideways at 390 px.

## 1. What I changed

| Commit | Change |
|---|---|
| f4c05a8 | Human Practices: evolution map squared. Pill chips, pill VISIT badges, round portraits, frosted sticky bar and the 3px green slab on return-visit cards replaced by square chips, square stamps and a 1.5px top rule (the VISIT n OF m field still names the thread). |
| fee0aa0 | Human Practices: LINE tabs lose the decorative 01 to 06 and say "Menu button" / "Linked from the account"; rubric answer 02 pointed at section 3.3 for conflicting advice, which is 3.4. |
| 22b9203 | Sustainability: the four SDG colour tiles (brand-coloured number squares, 3px left slabs, pill badges, hover lift and shadow) become a ruled goal index with square state stamps. Target strips, ledgers, fix boxes, captions and pull quote lose their 3px coloured edges. Page-local override of the shared callouts removed. |
| 18ed096 | Sustainability: eight images with wrong width/height aspect ratios corrected; Figure 7 now loads the WebP; the salt-ladder SVG caption was clipped past the viewBox, now two lines; reference 3 sourced from the AFA page Entrepreneurship already cites (its ref 8). |
| 94a9dd0 | Entrepreneurship: the four big-number sales-objective cards become a table (year, stage, units, what happens). Entrepreneurship and Laws: fix boxes lose the 3px amber slab (1px amber border all round), round counters and radii squared, callout override removed. |
| 9236c81 | Laws: eight JPG figures re-encoded to WebP at the same pixel size, 3.2 MB to 1.1 MB; JPGs removed (referenced nowhere else). |
| fcdf2b7 | Entrepreneurship: canvas, SWOT and VPC graphics re-encoded at q80, 815 KB to 585 KB, text checked legible. |
| acbd8c2 | Geospatial: routing figure frame and button squared. |
| 98b1b6b | Education: disclosure titles, session names and three captions use a colon/comma/full stop instead of em dashes; heading "Two-way, not one-way" (not-X-but-Y) is now "What students and teachers changed" (section id unchanged; nothing links to the heading id); session dates no longer wrap to three lines. |
| 94e3e01 … bc382c5 | Review notes, one commit per page. |
| b3d1225 | Entrepreneurship: Figure 10 alt text was wrong ("Japan's neighbours in Europe"); now reads the chart as drawn and says Taiwan and the Philippines are not on it. |
| b00c60f | Human Practices: evolution-map filter bar is sticky only from 52rem; on a phone it wrapped to four rows and covered a third of the screen. Its review note aligns with the map column. |
| d8d9c29, 969a946 | Geospatial and Education: figure and hero captions without em-dash joins (words unchanged). |

Mechanical fixes logged: Human Practices rubric 02 "section 3.3" -> "3.4" (the section it means is Conflicting advice, 3.4).

Bioreactor Calculations: Human Practices still names it in prose at `human-practices/index.html` 3.1 Modelling row, the Prof. Chen tab ("see Bioreactor calculations") and the 6.1 open item. Prose left as it is; each has a review note pointing the claim at **Model** (salt arm fitted to the dose ladder, Model 3.3; reactors per hectare from the deployment model, Model 5 / 7).

TODO markers left in place, each with a review note: Human Practices rubric 03 hidden TODO (Prof. Chen's quote); Laws "TBD" in the Figure 3 caption and in F7.

## 2. Writing inconsistencies

| Where | Says | Other place says | Suggested resolution |
|---|---|---|---|
| human-practices:64, :963, :187 | "went back to seven stakeholders" / "Six advisors met us more than once" plus CH Biotech and Green Media | evomap: "7 return threads" | Pick one count. |
| human-practices:252, :283 | Prof. Cheng "Adopted in set 8"; "set 8 is the first to grow plants to ten days" | plant:117 "Neither of the two set 8 decks records a run built that way" | Check the set 8 decks; fix one page. |
| human-practices:640 | Prof. Huang made the point "a week later" (28 Jul) | human-practices:774 "Prof. Huang in August" | July. Sustainability agrees with July. |
| human-practices:125, :204 vs :363, evomap | "Prof. Huang (黃介辰)" | "Dean Huang (黃介辰)"; plus a second Prof. Huang (黃姿碧) | One title per person. |
| evomap-data.js:406 | Chang 18 Jun: "valve after the membrane" | human-practices 3.2: foam, flow rate, TMP | Check meeting notes. |
| evomap-data.js:389 | Kyle: "Four-day stratification from July" | human-practices 3.2 "Stratify for two days" | Check notes. |
| evomap-data.js:1008 | "screened peptides proven on ten-day Arabidopsis" | sustainability 3: no protectant rescue shown | "to be proven". |
| entrepreneurship:773, :837+ | "three independent containment layers" incl. kill switch | safety:70 "second containment layer has not been built"; human-practices 3.3 | Say planned. |
| entrepreneurship:637, :686 | 0.22 µm | human-practices, hardware/bioreactor, results: 0.2 µm (plant: 0.22) | Datasheet value everywhere. |
| entrepreneurship:641 | biostimulant for AtLEA14 + ACCD; NaD1 biopesticide later | laws: BoPep4, AtLEA14, ACCD; NaD1 on no other page | Align protectant set. |
| entrepreneurship:652 | AtLEA14 targets salinisation | laws:130 AtLEA14 against drought (laws F4) | Wet lab decides. |
| laws:7, :217, :251 | EU is first international market | entrepreneurship 11: Philippines primary (F9) | Decide once, edit both. |
| entrepreneurship:427 | Ms. Chen "farms organically" | human-practices, sustainability, geospatial: natural farming | "natural". |
| entrepreneurship:176–178 | 135,297.77 USD / 60,000 NTD / 52,578 + 30,450 | sustainability:~293 NT$100,000–150,000 | Settle F2 first. |
| entrepreneurship:232 | SDGs 2, 8, 11, 12, 13, 15 | sustainability: 2, 10, 4, 15; declines 13 and 12 | Use Sustainability's. |
| laws:209 | forum question "shaped" the sustainable-label decision | human-practices:492 decision from World Veg, 22 May | "confirmed". |
| education:104 | "roughly 144 students" | education table: 127 pre-survey + JH n | Exact total. |
| education:114, :130 | Dingxi, 25–26 Jun and 14 Jul | plant:1050 "DingXi", 25 Jun and 2 Jul | One spelling, one set of dates. |
| education:146 | high school "school name to add" | plant:1050 "Fushing … 14 August"; milestone:966 aug14-fushing | Likely Fushing; confirm romanisation. |
| education:40 | "Every slide we showed was bilingual" | education:1227 "why every deck is now bilingual" (after trial 2) | Which is true? |
| education:432, :1083 | ReLeaf "built on a stress-responsive promoter" | Description/Engineering: green-light CcaS–CcaR switch | Reword. |
| education JH results | gains on B. subtilis, synbio foundations, applications | JH instrument lists none of these | Match versions. |
| education HS | instrument: 7 items; item 1 point mutations | pre-survey "six items"; text "what is not synthetic biology"; 16/28 printed as 56% (57%) | Fix. |
| sustainability:366 | lesson "rebuilt four times" | education: 4 trials; milestone:255 "third rewrite" | One count. |
| sustainability:383 | Q6 "reading codons" | education instrument Q6 "the four letters and how they pair" | Education wording. |
| sustainability 10 | farmer age 55–61 (2016) | geospatial:280 average 63.5 | State years. |
| human-practices:979 | "more than fifty members of the public" | data-physicalization:101: 116 visitors, 62 surveys | Use numbers. |
| human-practices 5.2 chart | "Climate change and agriculture" as Knowledge | data-physicalization: A1 attitude, "coffee and crop production" | One label. |
| human-practices:834 | LED map vs "rice yield" | data-physicalization: "crop yield", "agricultural yield by region" | Name the crop. |
| geospatial:655 | tool "fetches Leaflet from a CDN" | notes/overnight-2026-09-23.md: Leaflet bundled | Update clause. |
| entrepreneurship 10 vs 12 | 5–10 pilots 2026, 25–30 in 2027 | phase 2: 20–50 prototypes, 20–70 farmers | Reconcile. |
| entrepreneurship Fig 10 | chart lacks Taiwan and Philippines; Vietnam, Ireland listed twice | section 11 argues about both | Redraw. |

## 3. Strong student writing worth keeping

- **Sustainability, How we chose the goals**: "A goal is claimed only if we can point at something we built, measured or changed." The whole page follows that rule; it is the best SDG argument on the wiki.
- **Sustainability, SDG 2**: "we say so here instead of converting an assay into a harvest." Turns a missing result into a stated position.
- **Sustainability, Long-term impact**: "Three of those four steps are designed and one is unproven, and it is the first one." Quotable, exact.
- **Education, What stuck (junior high)**: 0% to 30% is "a real gain from a zero baseline and still a failure by any standard we care about." Honest evaluation, then a design lesson from it.
- **Human Practices, 3.4 Conflicting advice**: "We followed her, because she had seen our plants." Records whose advice won and why.
- **Human Practices, 3.6**: "A graph goes on a slide only once the person presenting it can explain all of it." A rule other teams can adopt.
- **Geospatial, Who is standing in the field**: the three-week dew clock, "a clock built from decades of reading one specific plot", turns a farmer's method into the page's argument.
- **Geospatial, opening**: "A map that does not change a decision is decoration, so here is the decision."
- **Data Physicalization, The data**: "it inherits them silently, which is the first honest thing to say about it."
- **Entrepreneurship, Overview**: the rule that no page or pitch says "cheap" until one bill of materials exists.

(Page headers name teams, not individuals, so no author names.)

## 4. Needs a person

- The stakeholder count, the set 8 claim, and Prof. Huang's date and title (Human Practices). I did not change prose.
- The Fushing / DingXi school names and dates: I did not fill the Education table's "school name to add" cells, because the evidence is indirect (a file name and a Plants sentence).
- F9 (which market after Taiwan), F4 (which stress each protectant targets), containment layer wording: these cross three pages and are team decisions.
- Human Practices hidden TODO (Prof. Chen quote) and the two Laws "TBD" markers: left in place.
- Education high school slides PDF is 12 MB, over the 10 MiB per-build limit; I did not recompress a teaching PDF.
- Education junior high files are linked from education/website on static.igem.wiki (team folder 5729); mirroring them into education/files needs a download, which I did not do.
- Human Practices photos (250 to 460 KB each at 1600 px) are already near quality 80; re-encoding gained under 10%, so left alone.
- Routing tool still calls openstreetmap.org and OSRM live (Geospatial), unchanged.

## 5. Requests for the shared layer

1. **Callouts** (`page.css` `.callout`): 4px coloured left bar and 5px radius. Every Engagement page now uses square hairline boxes for its own notes; the shared callout is the last coloured slab on these pages. Suggest 1px border in the state colour all round, radius 0 (as DESIGN.md describes).
2. **`.card2` / `.grid`** (`page.css`): rounded cards with a big `.num`; the Education website section still uses them. Square them, or drop `.num` styling.
3. **`.discloses` / `.disclose--solo`, `.dl a`, `.status code`, `.todo`**: rounded radius tokens; square to match.
4. **Figure captions**: DESIGN.md asks every caption to end with a provenance line ("Scaled only."). Human Practices does; Education, Entrepreneurship, Laws, Geospatial and Data Physicalization mostly do not. A shared decision on whether to require it would help.
5. **review-notes.js**: the fixed "Hide review notes" button at bottom-left overlaps the contents rail's lower entries at 1440 px (seen on Laws and Sustainability). Move it to bottom-right or offset above the rule-check button.
6. `.fix` is defined separately in entrepreneurship.css, laws.css and sus.css (now identical). It could move to page.css.
