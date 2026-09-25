# Ballot maps in the medal and award boxes — 25 September 2026

Every page that carries a medal criterion or a special award now has, in the
box near the top of the page, the questions a judge is actually given for that
award, each one followed by a link to the section of the same page that answers
it. Where the page does not answer a question, the box says so in the same
list. Nothing was claimed that the page did not already say, and no result was
summarised: the map names sections, it does not repeat them.

Source of the question wording: the 2026 Judge Handbook
(`Past drafts/2026-judge-handbook-digital.md`), the pages listed per award in
section 4 of `JUDGE-SIM.md`. The handbook and the awards page carry the same
questions; the handbook is quotable offline, so it is what the wording follows.
The live awards page renders its list from JavaScript and could not be fetched
as text tonight.

Styling: shared classes only. Each map is an ordinary `<ol>` inside the existing
`.callout.callout--medal`, so it inherits the callout's rule, ground and type
scale, matches the Silver #1 box on Engineering, needs no page stylesheet and
reads in order with JavaScript off (checked on Contribution at 500 px with
scripting disabled). A two-column `table.data` was tried first and rejected: at
the callout's width the second column falls into a horizontal scroller, which is
the opposite of wayfinding.

## 1. What I changed

One page per commit, on branch `night/ballot`:

- `Measurement: the award box now maps each ballot question to a section`
- `Human Practices: the medal box maps the silver criterion and the six award questions to sections`
- `Education: the award box maps the four ballot questions to sections`
- `Model: the award box maps the four ballot questions to sections`
- `Entrepreneurship: the award box maps the five ballot questions to sections`
- `Sustainability: the award box maps the five ballot questions to sections`
- `Software: the page now carries a judge's map of the six ballot questions` (the page had no medal box at all; one was added)
- `Inclusivity: the award box maps the four ballot questions to sections`
- `Safety and Security: the award box maps the five ballot questions to sections`
- `Contribution: the medal box maps each part of the criterion to a section`
- `Parts: the medal box maps the part collection questions to sections`
- `Engineering: the Silver #1 box says where the Registry documentation stands`

Checks after each page: `python3 build/audit.py` stayed at 0 for missing links,
0 for anchors, 0 for duplicate ids, 0 for alt and 0 for parse. Screenshots at
1440 px and 500 px on every page, taken two at a time in headless Chrome.

## 2. Per page: which question is answered where, and which is not yet

### Measurement — Best Measurement (4 questions)
| Question | Answered at |
|---|---|
| Repeated by other iGEM teams | each block's protocol and data file (#agar-plate-stress-test, #dual-light-path-photometer). **Gap named in the box:** no per-measurement equipment, blank and expected-range list |
| Protocol well described | #plant, #protectant, #bioreactor |
| Useful to other projects | #chlorophyll-extraction, #dual-light-path-photometer |
| Controls and calibration | #state-of-each-measurement, #dual-light-path-photometer, #pressure-and-flow-meter |

### Human Practices — Silver #2 and Best Integrated Human Practices (1 + 6)
| Question | Answered at |
|---|---|
| Silver #2, responsible and good for the world | #conclusion answer 03, #kill-switch-and-containment |
| Integrated throughout | #project-evolution-map, #conclusion answer 01 |
| Thoughtful, context, rationale, prior work | #expert-selection, #return-visits, #conclusion answer 02 |
| Different stakeholder views | #expert-engagement, #farmer-engagement, #public-engagement, #conflicting-advice |
| Documented so others can build on it | #農友助手-line-platform, #public-forum. **Gap named:** no downloadable interview guides or survey instruments |
| Inspiring example | #return-visits, #public-forum, #open-items |

### Education — Best Education (4)
| Question | Answered at |
|---|---|
| Mutual learning or dialogue | #what-students-and-teachers-changed |
| Documented so others can build upon | #lesson-files, #games-we-designed, #the-education-website. **Gap named:** junior high plan, deck and game not mirrored here |
| Thoughtfully implemented | #how-we-built-the-lessons, #the-programmes |
| Enables more people to participate | #what-stuck, #who-we-worked-with, #what-we-would-change |

### Model — Best Model (4)
| Question | Answered at |
|---|---|
| How impressive | #the-model-chain, #stress-index, #optogenetics-kinetics, #gis-economic-impact |
| Helped understand a part, device or system | #what-the-model-changed |
| Used measurements to develop the model | #fit-to-the-salt-ladder, #parameters. **Gap named:** no measurement of the light-responsive part, #the-missing-induction-curve |
| Good example for others | #assumptions, #parameters, #not-modelled |

### Entrepreneurship — Best Entrepreneurship (5)
| Question | Answered at |
|---|---|
| First customers and unmet needs | #customer-discovery, #who-we-sell-to-first, #competitors |
| Possible, scalable, inventive | #the-product, #growth-and-exit. **Gap named:** no built unit with one settled cost, #what-it-costs carries three figures |
| Plans, milestones, timelines, resources, risks | #development-plan, #cost-and-break-even, #funding, #risks |
| Skills, capabilities, stakeholders needed | #stakeholders, #development-plan. **Gap named:** the roles the company would hire are not on the page |
| Positive and negative long-term impacts | #risks, #regulation, #conclusion |

### Sustainability — Best Sustainable Development Impact (5)
| Question | Answered at |
|---|---|
| Feedback from SDG stakeholders | #stakeholder-consultation |
| Long-term social, environmental, economic impacts | #long-term-impact, #long-term-impact-2, #who-we-actually-have-to-reach |
| Interactions with other SDGs | #where-the-project-does-not-help, #dependency, #goals-we-do-not-claim |
| Documented so other teams can build on it | #how-we-chose-the-goals, #what-would-have-to-be-measured. **Gap named:** no collaborations with other iGEM teams around the goals |
| Measurably and significantly addressed a goal | #what-the-evidence-supports-2 (SDG 4); the other three states are in #overview |

### Software — Best Software Tool (6). The page had no medal box; one was added.
| Question | Answered at |
|---|---|
| Synthetic biology standards | **Not yet on this page.** The formats it defines for itself are in #evidence |
| Validated by experimental work | #results, #programme, #definition (two models calibrated, none validated) |
| Useful to other projects | #adapting |
| Integration with external tools | #software (serial protocol, XLSX and CSV exports). **Gap named:** no API or package interface |
| User-friendly | #software, #running-the-software. **Gap named:** no session with an operator outside the build team |
| Written and documented for future groups | #running-the-software, #reproduce, #defects |

Not in the box, because it is not a ballot question and the page already states
it in §10: the eligibility requirement that the source sits in the team's
repository on iGEM's GitLab under an OSI licence. See "Needs a person" below.

### Inclusivity — Inclusivity Award (4)
| Question | Answered at |
|---|---|
| Investigate barriers | #barriers-we-found. **Gap named:** no study, with sources, of why these groups are under-represented |
| Expand access | #what-we-changed, #language-and-access |
| Dialogue with the target group | #what-we-learned, #barriers-we-found |
| Documented so others can build upon | **Not answered by this page.** The material sits on Education and Human Practices; this page carries no artefact of its own |

### Safety and Security — Safety and Security Award (5)
| Question | Answered at |
|---|---|
| Contribution to biosafety or biosecurity | **Not yet on this page.** The page records our own containment |
| Contribution well characterised or validated | **Not yet on this page.** Nearest is the single plating in #escape, with its own limits stated |
| Built on existing knowledge, tools, approaches | #how-we-assessed-risk, which is still a scaffold with an empty table |
| Managed risks from their own project | #biological-risk, #chemical-and-physical-risk, #containment-design, #lab-practice-training-and-supervision, #shipping-disposal-and-incidents |
| Addressed use of synthetic biology in the real world | #security-and-dual-use, #containment-design |

### Contribution — Bronze criterion 3
| What the criterion asks | Answered at |
|---|---|
| Make a useful contribution | #what-we-are-contributing |
| Document it | #hardware-other-teams-can-rebuild, #protocols-and-methods, #parts |
| Explain why it is a contribution to fellow iGEMers | #how-to-reuse-this, #the-limits-of-what-we-are-handing-over |
| Part or non-part documentation, or both | ours is methods and hardware; #parts says how far the Registry documentation goes |

### Parts — Part Collection (4)
| Question | Answered at |
|---|---|
| A coherent collection or just a list | #overview |
| How the documentation compares | #registry-contributions; **gap named:** the eight protectant entries are open and empty, #registry-stubs |
| Finished a functional system with the collection | #build-record, #level-2-junction-check, #assemblies-that-failed. **Gap named:** no light-responsive function shown, #what-has-no-measurement |
| Useful to the community | #our-own-parts, #status-vocabulary |

The box also says that part awards are scored on the Registry entries, so this
page is the map to them and not the submission itself.

### Engineering — Silver criterion 1
The existing box already named cycle 3 and jumped to Design, Build, Test and
Learn, so it was left as it was and one sentence was added: the criterion's
guidance puts the documentation of a part used for the cycle on that part's
Registry page, ours is empty, and the link goes to `parts/#registry-stubs`.

## 3. Hardware hub map, for Anton (not applied; `hardware/` is his)

`hardware/` was not touched. The hub's own ids are `#instruments` and
`#notebook`, and the instrument pages are `photometer/`, `bioreactor/`,
`diopal/` and `hydroponics/`. Dropped into the hub's own dark styling, the
Best Hardware ballot maps like this. Two of the four are currently not
answerable from the hardware section, and the honest version says so:

```html
<!-- Best Hardware. Four questions, and where this section answers each one. -->
<ol>
  <li><b>Does the hardware address a need or problem in synthetic biology?</b>
      <a href="#instruments">Choose an instrument</a>, four instruments with
      the measurement each one exists to make.</li>
  <li><b>Did the team conduct user testing and learn from user feedback?</b>
      Not yet in this section. No session where somebody outside the build team
      used an instrument is recorded here.</li>
  <li><b>Did the team demonstrate utility and functionality in their hardware
      proof of concept?</b> <a href="photometer/">Photometer</a> for the four
      build iterations and what each one fixed. The functional claim is not
      settled: V4 reads low against its target and the calibration is
      outstanding.</li>
  <li><b>Is the documentation of the hardware system sufficient to enable
      reproduction by other teams?</b> <a href="photometer/">Photometer</a> and
      <a href="bioreactor/">Bioreactor</a> for the bill of materials, the print
      settings and the STL downloads, and
      <a href="#notebook">the build notebook</a> for the record as it
      happened.</li>
</ol>
```

Anton should check the wording of question 3 against what the photometer page
says tonight, and question 2 against whether a user session has since been
written up. If a session exists, question 2 becomes a link and stops being a
gap; that is the single cheapest move available on this award.

## 4. Writing inconsistencies found while mapping

| Where | What it says | What the other place says | Suggested resolution |
|---|---|---|---|
| `parts/index.html` overview | "four things to happen in order, and the collection is organised as those four things plus a fifth" | The page then carries five module sections of equal weight | Say five modules once, or keep four plus one and make the fifth's diagnostic role explicit in the module heading |
| `software/index.html` §10 | the GitLab path for the 2026 software repository | The page's own review note says `2026/software/<team>/`, `notes/overnight-2026-09-23.md` says `2026/software-tools/` | One of the two is wrong; check the team's own GitLab before the mirror is made, then fix both places |
| `measurement/index.html` §1, `model/index.html` §1 | "the reactor physics on Bioreactor Calculations" | That page was deleted on 25 September | Already in JUDGE-SIM's priority list; not fixed here because it is prose, not the callout |

## 5. Strong student writing worth keeping

- **Measurement, State of each measurement.** The column headed "What it is
  entitled to say" is the best single idea in this cluster. It puts the limit of
  a claim in the same row as the claim, so a judge checking question 4 never has
  to leave the table.
- **Contribution, The limits of what we are handing over.** "Three of our
  written protocols carry errors we have found and not yet corrected", with the
  three named. Very few teams publish that at any level, and it is what makes
  the rest of the page believable.
- **Safety and Security, Escape.** "A plate with no colonies on it gives no
  bound on escape, because the detection limit of that plate was never stated."
  One sentence that refuses a result the team could easily have claimed.
- **Software, Definition and target.** The tier table that fixes which wording
  is permitted at which stage of evidence. It made the map easy to write, because
  the page had already decided what it was allowed to say.

## 6. Needs a person

- **Software eligibility.** The award cannot be scored until the source is in
  the team's repository on iGEM's GitLab under an OSI-approved licence, and the
  page says the mirror is outstanding. The map deliberately does not treat this
  as a ballot question, but if Software is one of the three elected awards it
  outranks everything else on that page.
- **Safety and Security, section 1.** Three of the five questions in that map
  point at work that has to be done by the safety officer, not by an editor. The
  risk table has headings and no rows.
- **Inclusivity question 4.** Leaving the answer as "the material sits on other
  pages" is honest but thin. If the page stays, one downloadable artefact of its
  own would close it; if the award is not elected, leave it.
- **Which three awards get elected.** Every map above is written to be true
  whether or not its award is elected. The elections themselves are the
  decision in `JUDGE-SIM.md` §6 and they freeze with the Judging Form.
- **Hardware.** The snippet in section 3 is not applied. It needs Anton, and it
  needs checking against whatever the photometer page says by the time it lands.

## 7. Requests for the shared layer

None. Every map uses `.callout`, `.callout__label` and a plain `<ol>`, all of
which already exist in `assets/css/page.css`. No page stylesheet was touched and
no inline style was used.

If the shared agent is looking for one small thing: an `.callout ol { margin-top:
var(--sp-2) }` style would tighten the gap between the lead sentence and the
first question by a few pixels on every one of these boxes. It is a nicety, not
a defect; the boxes read correctly without it at 1440 px and at 500 px.
