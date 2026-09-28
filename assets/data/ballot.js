/* ===========================================================================
   ballot.js  ·  the judge's ballot, page by page
   ---------------------------------------------------------------------------
   WHAT THIS IS
   iGEM judges score each medal criterion and each special award from a fixed
   list of questions. This file holds, for every judged page on this wiki, the
   award that page is submitted for and the questions a judge is actually given,
   each one paired with the section of that same page which answers it. Where
   the page does not answer a question the entry says so instead of pretending.

   WHERE THE WORDING COMES FROM
   The 2026 Judge Handbook, the "judged according to the following aspects"
   list for each award and the medal criteria table in chapter 3. The wording
   here is the handbook's own, condensed to one readable line. It is not a
   paraphrase invented for this wiki.

   HOW IT REACHES THE PAGE  (read this before editing a page by hand)
   It is NOT rendered by the browser. build/ballot.py reads this file, renders
   an ordinary <ol class="ai"> and writes it into each page between

       <!-- ballot:start SLUG -->   and   <!-- ballot:end -->

   inside that page's existing .callout--medal box. The list therefore sits in
   the page markup: it is there with JavaScript off, it prints, and it is in
   the HTML a judge saves. Edit THIS file, then re-run

       python3 build/ballot.py            # writes every page
       python3 build/ballot.py --check    # fails if a page is out of date
       python3 build/ballot.py model      # one page

   and commit both this file and the regenerated markup. Anything you type
   between the markers by hand is overwritten on the next run.

   RULES THE ENTRIES FOLLOW
   · The map names sections. It never repeats or summarises a result.
   · Nothing is claimed that the page does not already say.
   · A question the page does not answer says so plainly, in the item.
   · Every href must resolve: build/audit.py has to stay at 0 anchors.
   · The whole list is AI-drafted, so it carries class="ai" and shows orange.

   Two slugs below, "engineering" and "parts", are prepared but NOT written to
   their pages: those two pages were being edited by other people on the night
   this was built. Their markers are absent, ballot.py skips them, and whoever
   owns those pages can drop the markers in and re-run.
   ======================================================================== */

window.RELEAF_BALLOT = {

  "measurement": {
    "award": "Best Measurement",
    "criterion": "The Best Measurement award is scored on four aspects.",
    "lead": "The four questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "Could the measurement(s) be repeated by other iGEM teams?",
        "a": "<a href=\"#state-of-each-measurement\">State of each measurement</a> says which of the fourteen have been run, and every block carries its own Material and methods. <a href=\"#troubleshooting-and-failed-measurements\">Troubleshooting and failed measurements</a> gathers what went wrong.",
        "gap": false
      },
      {
        "q": "Is the protocol well described?",
        "a": "The Material and methods paragraph inside each block: <a href=\"#plant\">Plant</a>, <a href=\"#optogenetic-control\">Optogenetic control</a>, <a href=\"#protectant\">Protectant</a>, <a href=\"#bioreactor\">Bioreactor</a>. Only one protocol is offered here as a file to download, the SiO<sub>2</sub> OD600 SOP in <a href=\"#turbidity-meter-for-escape\">Turbidity meter for escape</a>; the rest are named in each block's Sources and not attached.",
        "gap": true
      },
      {
        "q": "Is it useful to other projects?",
        "a": "The Contribution paragraph inside each block, for example <a href=\"#agar-plate-stress-test\">Agar plate stress test</a>, <a href=\"#chlorophyll-extraction\">Chlorophyll extraction</a> and <a href=\"#dual-light-path-photometer\">Dual light path photometer</a>.",
        "gap": false
      },
      {
        "q": "Did the team use controls to validate the measurement process and calibrate units?",
        "a": "<a href=\"#state-of-each-measurement\">State of each measurement</a>, where the Anchored to column names the control or blank for every one of the fourteen and the next column says what it is entitled to say.",
        "gap": false
      }
    ]
  },

  "model": {
    "award": "Best Model",
    "criterion": "The Best Model award is scored on four aspects.",
    "lead": "The four questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "How impressive is the modelling?",
        "a": "<a href=\"#what-the-model-does\">What the model does</a> sets out the chain, and it runs from <a href=\"#stress-index\">Stress index</a> through <a href=\"#stress-index-to-light\">Stress index to light intensity</a>, <a href=\"#gene-circuit\">Gene circuit</a>, <a href=\"#growth\">Growth in the vessel</a>, <a href=\"#accumulation-and-delivery\">Accumulation and delivery</a> and <a href=\"#soil-transport\">Soil transport</a> to <a href=\"#gis-economic-impact\">GIS economic impact</a>.",
        "gap": false
      },
      {
        "q": "Did the model help the team understand a part, device or system?",
        "a": "<a href=\"#what-the-model-changed\">What the model changed</a>, one entry per decision that went back into the build.",
        "gap": false
      },
      {
        "q": "Did the team use measurements of a part, device or system to develop the model?",
        "a": "<a href=\"#salt-ladder\">The salt ladder behind the salinity arm</a> is the measurement of our own the index rests on, and <a href=\"#symbols-and-parameters\">Symbols and parameters</a> tags where every other constant came from. The light-responsive part is not one of them: the numbers behind it are listed as unsettled in <a href=\"#open-questions\">Open questions</a>.",
        "gap": true
      },
      {
        "q": "Does the modelling approach provide a good example for others?",
        "a": "<a href=\"#model-assumptions\">Model assumptions</a>, <a href=\"#symbols-and-parameters\">Symbols and parameters</a>, <a href=\"#not-modelled\">Not modelled</a> and <a href=\"#open-questions\">Open questions</a>.",
        "gap": false
      }
    ]
  },

  "software": {
    "award": "Best Software Tool",
    "criterion": "The Best Software award is scored on six aspects.",
    "lead": "The six questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "How well is the software compatible with, and does it leverage, existing synthetic biology standards (SBOL, RFCs, data formats)?",
        "a": "Not on this page yet. No synthetic biology standard is used. What the page does define for itself is the batch record row in <a href=\"#t-data\">The batch record row</a>, and the process vocabulary it borrows is ICH&nbsp;Q8 and PAT in <a href=\"#cpp-cqa\">Critical process parameters and quality attributes</a>.",
        "gap": true
      },
      {
        "q": "Was this software validated by experimental work?",
        "a": "<a href=\"#measured\">Measured so far</a> for the four measured results, <a href=\"#run434\">The 434-hour batch</a> and <a href=\"#calibration-gp\">Calibration with interval coverage</a> for what they rest on, and <a href=\"#loop\">Closing the loop</a> for the experiment that would test the twin. The endpoint table in <a href=\"#skeleton\">Endpoints still to be filled</a> is not filled.",
        "gap": true
      },
      {
        "q": "Can the software be useful to other projects?",
        "a": "<a href=\"#contribution\">Contribution</a>, four things another team can lift without our reactor, with the repository they sit in.",
        "gap": false
      },
      {
        "q": "How well can the software be integrated with external tools and applications, including APIs and packages?",
        "a": "Not on this page yet. No package or documented API for outside use is offered. The nearest is <a href=\"#t-edge\">One board, two computers</a>, which describes the three programs and the requests that pass between them.",
        "gap": true
      },
      {
        "q": "Is the software user-friendly?",
        "a": "<a href=\"#t-edge\">One board, two computers</a> for the dashboard and what its buttons do, and <a href=\"#ladder\">The decision ladder</a> for what the operator is asked to approve. No session with an operator outside the build team is recorded on this page.",
        "gap": true
      },
      {
        "q": "How well is the software written and documented for future groups to extend and improve?",
        "a": "<a href=\"#t-edge\">One board, two computers</a> takes the three programs one at a time, <a href=\"#t-cut\">The cut list</a> says what is deliberately left out, <a href=\"#limits\">Limits</a> says where it should not be trusted, and <a href=\"#contribution\">Contribution</a> gives the pin map and the repository.",
        "gap": false
      }
    ]
  },

  "hardware": {
    "award": "Best Hardware",
    "criterion": "The Best Hardware award is scored on four aspects.",
    "lead": "The four questions a judge is given for this award, and where this section answers each one. Links on this page are the orange arrows.",
    "questions": [
      {
        "q": "Does the hardware address a need or problem in synthetic biology?",
        "a": "Four instruments, each with the measurement or the job it exists for, and how they hand over to each other. <a href=\"#instruments\">Choose an instrument &rarr;</a>",
        "gap": false
      },
      {
        "q": "Did the team conduct user testing and learn from user feedback?",
        "a": "One test is recorded, in week&nbsp;13 of the notebook: the DiOPAL assembly guide was tested by handing it to somebody else. Nothing else in this section records a session with a user outside the build team. <a href=\"notebook/index.html#w13-10\">Notebook, week&nbsp;13 &rarr;</a>",
        "gap": true
      },
      {
        "q": "Did the team demonstrate utility and functionality in their hardware proof of concept?",
        "a": "Each instrument page carries its own results and its own open items. <a href=\"photometer/\">Photometer &rarr;</a> <a href=\"bioreactor/\">Bioreactor &rarr;</a> <a href=\"diopal/\">DiOPAL &rarr;</a>",
        "gap": false
      },
      {
        "q": "Is the documentation of the hardware system sufficient to enable reproduction by other teams?",
        "a": "The bill of materials, the STL files, the assembly guides and the record as it happened. The bioreactor's own assembly guide is marked in progress on its page. <a href=\"photometer/\">Photometer &rarr;</a> <a href=\"diopal/\">DiOPAL &rarr;</a> <a href=\"hydroponics/\">Hydroponics &rarr;</a> <a href=\"#notebook\">Notebook &rarr;</a>",
        "gap": true
      }
    ]
  },

  "safety-and-security": {
    "award": "Safety and Security Award",
    "criterion": "The Safety and Security award is scored on five aspects.",
    "lead": "The five questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "Did the team make a contribution to biosafety and/or biosecurity?",
        "a": "Not on this page yet. The page records how we keep our own work safe, not a tool or a method offered to others. The containment design is in <a href=\"#primary-containment\">Primary containment</a> and <a href=\"#secondary-containment\">Secondary containment</a>.",
        "gap": true
      },
      {
        "q": "Is their contribution well-characterised and/or well-validated?",
        "a": "Not on this page yet. No test of the containment is reported here.",
        "gap": true
      },
      {
        "q": "Did the team build upon existing knowledge, understanding, tools or approaches?",
        "a": "<a href=\"#research-framework-and-biological-systems\">Research framework and biological systems</a>, on using peer-reviewed literature to choose organisms, tools and containment.",
        "gap": false
      },
      {
        "q": "In addition to broader safety work, has the team managed risks from its own project appropriately?",
        "a": "<a href=\"#biosafety-training\">Biosafety training</a> and <a href=\"#basic-laboratory-training\">Basic laboratory training</a>, <a href=\"#bioreactor-safety\">Bioreactor safety</a>, <a href=\"#laboratory-facilities-and-safety-infrastructure\">Laboratory facilities</a> and <a href=\"#risk-assessment\">Risk assessment</a>, which covers chemical, physical, spill, waste and emergency response.",
        "gap": false
      },
      {
        "q": "Has the team addressed the use of synthetic biology in the real world?",
        "a": "<a href=\"#dual-use\">Dual use research of concern</a>, and the containment the field unit depends on in <a href=\"#primary-containment\">Primary containment</a>.",
        "gap": false
      }
    ]
  },

  "education": {
    "award": "Best Education",
    "criterion": "The Education award is scored on four aspects.",
    "lead": "The four questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "How well did their work promote mutual learning and/or a dialogue?",
        "a": "The Suggestions and Changes table inside each band, <a href=\"#lesson-elementary\">Elementary</a>, <a href=\"#lesson-junior-high\">Junior High</a> and <a href=\"#lesson-high-school\">High School</a>, which sets what a student said beside what we changed, and <a href=\"#impact-of-our-lessons\">Impact of our lessons</a> for the students' own feedback forms.",
        "gap": false
      },
      {
        "q": "Is it documented in a way that others can build upon?",
        "a": "<a href=\"#lesson-elementary\">Elementary</a> and <a href=\"#lesson-high-school\">High School</a> carry the lesson plan and the slides as files, and <a href=\"#education-website\">Education website</a> and <a href=\"#tools-and-resources\">Tools and resources</a> hold the rest. The junior high lesson plan and its printable card game are not here; <a href=\"#lesson-junior-high\">Junior High</a> says so and carries only the slides.",
        "gap": true
      },
      {
        "q": "Was it thoughtfully implemented?",
        "a": "<a href=\"#preparation\">Preparation</a> and <a href=\"#designing-the-lesson\">Designing the lesson</a> for how the lessons were built and trialled, <a href=\"#execution\">Execution</a> for what was taught to whom.",
        "gap": false
      },
      {
        "q": "Did the team convince you that their activities would enable more people to shape, contribute to or participate in synthetic biology?",
        "a": "<a href=\"#impact-of-our-lessons\">Impact of our lessons</a>, the pre and post surveys across five schools, and <a href=\"#long-term-impacts\">Long term impacts</a>.",
        "gap": false
      }
    ]
  },

  "entrepreneurship": {
    "award": "Best Entrepreneurship",
    "criterion": "The Entrepreneurship award is scored on five aspects.",
    "lead": "The five questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "Has the team discovered their first potential customers and identified unmet needs not covered by existing solutions?",
        "a": "<a href=\"#market-analysis\">Market analysis</a> with <a href=\"#stakeholder-analysis\">Stakeholder analysis</a> and <a href=\"#competitor-analysis\">Competitor analysis</a>, and <a href=\"#initial-sales-strategy\">Initial sales strategy</a> for who is sold to first.",
        "gap": false
      },
      {
        "q": "Has the team shown that their solution is possible, scalable and inventive?",
        "a": "<a href=\"#product-description\">Product description</a>, <a href=\"#business-model\">Business model</a> with the <a href=\"#social-business-model-canvas\">canvas</a> and the <a href=\"#swot-analysis\">SWOT</a>, and <a href=\"#barriers-to-entry\">Barriers to entry</a>.",
        "gap": false
      },
      {
        "q": "Has the team presented logical product development plans with realistic milestones, timelines, resources and risks?",
        "a": "<a href=\"#product-development-plan\">Product development plan</a>, year by year from <a href=\"#year-1\">year&nbsp;1</a> to <a href=\"#year-4\">year&nbsp;4</a>, with <a href=\"#financial-projection\">Financial projection</a>, <a href=\"#marketing-timeline\">Marketing timeline</a> and <a href=\"#potential-risks\">Potential risks</a>.",
        "gap": false
      },
      {
        "q": "Has the team outlined the skills, capabilities and stakeholders required to develop their solution further?",
        "a": "<a href=\"#key-stakeholders\">Key stakeholders</a> says what each conversation changed, and the Key resources panel of the <a href=\"#social-business-model-canvas\">social business model canvas</a> names the expertise the company would need. The roles it would have to recruit are not named on this page yet.",
        "gap": true
      },
      {
        "q": "Has the team considered the positive and negative long-term impacts of their fully developed solution?",
        "a": "<a href=\"#potential-risks\">Potential risks</a>, <a href=\"#regulations\">Regulations</a> and <a href=\"#conclusion\">Conclusion</a>.",
        "gap": false
      }
    ]
  },

  "sustainability": {
    "award": "Best Sustainable Development Impact",
    "criterion": "The Sustainable Development Impact award is scored on five aspects.",
    "lead": "The five questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "Did the team incorporate feedback from relevant SDG stakeholders into their work?",
        "a": "<a href=\"#stakeholder-consultation\">Stakeholder consultation</a>, which names each person, when they spoke to us, and which section on this page changed.",
        "gap": false
      },
      {
        "q": "Did the team address potential long-term social, environmental and economic impacts of their work?",
        "a": "The Problem and Solution pair inside <a href=\"#sdg-2-zero-hunger\">SDG&nbsp;2</a>, <a href=\"#sdg-10-reduced-inequalities\">SDG&nbsp;10</a>, <a href=\"#sdg-4-quality-education\">SDG&nbsp;4</a> and <a href=\"#sdg-15-life-on-land\">SDG&nbsp;15</a>. <a href=\"#long-term-impact\">Long-term impact</a> is the section for this and says it is still to be written.",
        "gap": true
      },
      {
        "q": "How well has the team considered the positive and/or negative interactions of their work with other SDGs?",
        "a": "<a href=\"#potential-negatives\">Potential negatives</a>, and <a href=\"#why-we-chose-these-sdgs\">Why we chose these SDGs</a> for the goals not claimed.",
        "gap": false
      },
      {
        "q": "Has the team documented their work against their chosen SDGs so that other teams can build upon it?",
        "a": "<a href=\"#why-we-chose-these-sdgs\">Why we chose these SDGs</a> gives the method, and each goal section states its targets before its claim. No collaboration with another iGEM team around these goals is recorded on this page.",
        "gap": true
      },
      {
        "q": "Has their work measurably and significantly addressed one or more SDGs?",
        "a": "<a href=\"#sdg-4-quality-education\">SDG&nbsp;4</a> is the one with numbers behind it, and they are on <a href=\"../education/#impact-of-our-lessons\">Education</a>. The other three are stated as what the project would do, not as something measured.",
        "gap": true
      }
    ]
  },

  "inclusivity": {
    "award": "Inclusivity Award",
    "criterion": "The Inclusivity award is scored on four aspects.",
    "lead": "The four questions a judge is given for this award, and the section of this page that is meant to answer each one. This page is still a scaffold: the sections exist and the writing does not.",
    "questions": [
      {
        "q": "How well did the work investigate barriers to participation in synthetic biology and/or science more broadly?",
        "a": "<a href=\"#barriers-we-found\">Barriers we found</a>. Not written yet.",
        "gap": true
      },
      {
        "q": "How well did the work expand access to synthetic biology and/or science more broadly?",
        "a": "<a href=\"#what-we-changed\">What we changed</a> and <a href=\"#language-and-access\">Language and access</a>. Not written yet.",
        "gap": true
      },
      {
        "q": "Was there a dialogue with members of the target group, and were their needs, opinions and values considered?",
        "a": "<a href=\"#who-this-project-is-for\">Who this project is for</a> and <a href=\"#what-we-learned\">What we learned</a>. Not written yet.",
        "gap": true
      },
      {
        "q": "Is the work documented in a way that other teams or external entities can build upon?",
        "a": "Nothing on this page yet. This page carries no artefact of its own.",
        "gap": true
      }
    ]
  },

  "human-practices": {
    "award": "Silver Medal Criterion #2 and Best Integrated Human Practices",
    "criterion": "Silver criterion 2 asks one thing. The Integrated Human Practices award is scored on six aspects.",
    "lead": "The medal criterion first, then the six award questions, each with the section of this page that answers it.",
    "questions": [
      {
        "q": "Silver #2. Explain how you have determined that your work is responsible and good for the world.",
        "a": "<a href=\"#conclusion-03\">Conclusion, answer 03</a>, with the conversations it rests on in <a href=\"#experts\">Expert engagement</a> and <a href=\"#farmers\">Farmer engagement</a>.",
        "gap": false
      },
      {
        "q": "How well was their Human Practices work integrated throughout the project?",
        "a": "<a href=\"#evolution\">Project evolution map</a>, every conversation from March to September with what changed, and <a href=\"#conclusion-01\">Conclusion, answer 01</a>.",
        "gap": false
      },
      {
        "q": "How thoughtfully was it implemented, and how well did they explain the context, rationale and prior work?",
        "a": "<a href=\"#pipelines\">Pipelines</a>, where each interview carries its key suggestion and what we changed, and <a href=\"#conclusion-02\">Conclusion, answer 02</a>.",
        "gap": false
      },
      {
        "q": "To what extent did they convince you that the work helped create a project that is responsible and good for the world?",
        "a": "<a href=\"#conclusion-03\">Conclusion, answer 03</a>, and <a href=\"#open-items\">Open items</a> for what is still unanswered.",
        "gap": false
      },
      {
        "q": "How well did it incorporate different stakeholder views?",
        "a": "<a href=\"#experts\">Expert engagement</a>, <a href=\"#farmers\">Farmer engagement</a> and <a href=\"#public\">Public engagement</a>, and <a href=\"#conclusion-04\">Conclusion, answer 04</a>.",
        "gap": false
      },
      {
        "q": "To what extent is the Human Practices work documented so that others can build upon it?",
        "a": "<a href=\"#evolution\">Project evolution map</a> and the folded interview notes under each card in <a href=\"#pipelines\">Pipelines</a>, and <a href=\"#conclusion-05\">Conclusion, answer 05</a>. The interview guides and the forum survey instrument are not offered here as files.",
        "gap": true
      },
      {
        "q": "How inspiring an example is it to others?",
        "a": "<a href=\"#line\">The 農友助手 LINE platform</a> and <a href=\"#forum\">the public forum</a>, and <a href=\"#conclusion-06\">Conclusion, answer 06</a>.",
        "gap": false
      }
    ]
  },

  "contribution": {
    "award": "Bronze Medal Criterion #3",
    "criterion": "Make a useful contribution for future iGEM teams. Teams must document it and explain why it is a contribution to fellow iGEMers.",
    "lead": "The criterion has three parts. Each one, and where this page answers it.",
    "questions": [
      {
        "q": "Make a useful contribution for future iGEM teams.",
        "a": "<a href=\"#our-contributions-at-a-glance\">Our contributions at a glance</a>, seven items with what each one is and who it is for.",
        "gap": false
      },
      {
        "q": "Document the contribution.",
        "a": "One section each: <a href=\"#parts\">Parts</a>, <a href=\"#hydroponics\">Hydroponics platform</a>, <a href=\"#plant-protocol\">Plant experiment protocol</a>, <a href=\"#containment\">Membrane-based containment</a>, <a href=\"#photometer\">Inline photometer</a>, <a href=\"#gis\">Geographic information systems</a> and <a href=\"#education\">Education</a>, with <a href=\"#open-resources\">Open resources</a> as the index of where each file lives.",
        "gap": false
      },
      {
        "q": "Explain why the effort is a contribution to fellow iGEMers.",
        "a": "The Why it matters paragraph in each section above, and <a href=\"#recommendations-for-future-teams\">Recommendations for future teams</a> for what worked, what did not and what we would change.",
        "gap": false
      },
      {
        "q": "Where part documentation has to live, if a part is used for this criterion.",
        "a": "On the part's own entry in the Registry, not here. <a href=\"#parts\">Parts</a> says so and points at the entries.",
        "gap": false
      }
    ]
  },

  "engineering": {
    "award": "Silver Medal Criterion #1",
    "criterion": "Demonstrate engineering success in a technical aspect of your project by going through at least one iteration of the engineering design cycle.",
    "lead": "The criterion and its guidance, and where this page answers each part.",
    "questions": [
      {
        "q": "Document the effort to follow the design cycle: Design, Build, Test, Learn.",
        "a": "<a href=\"#how\">How we engineered</a> for the map of the cycles, then <a href=\"#circuit\">the six cloning cycles</a>, <a href=\"#modules\">the four modules as built</a>, <a href=\"#reactor\">Bioreactor</a>, <a href=\"#photometer\">In-line photometer</a>, <a href=\"#lpa\">Light plate apparatus</a> and <a href=\"#plants\">Plants and delivery</a>.",
        "gap": false
      },
      {
        "q": "Document what changes in design you would make for the next iteration.",
        "a": "<a href=\"#learned\">What we learned across cycles</a>, and the boxed notes inside each cycle where a record disagrees with another.",
        "gap": false
      },
      {
        "q": "Measure the performance of the part and document whether it worked.",
        "a": "<a href=\"#mrec\">The Level 1 assembly record</a> for what was built, and the box at the top of <a href=\"#how\">How we engineered</a> for the one cycle that has not run: no record anywhere shows P<sub>cpcG2</sub> output changing with green light.",
        "gap": true
      },
      {
        "q": "Documentation of a part used for this criterion must be on that part's Registry page.",
        "a": "Not here. <a href=\"../parts/#registry-stubs\">Parts, Registry stubs</a> says how far our Registry entries go.",
        "gap": true
      }
    ]
  },

  "parts": {
    "award": "Part Collection",
    "criterion": "The Part Collection award is scored on four aspects. Part awards are scored on the Registry entries themselves, so this page is the map to them and not the submission.",
    "lead": "The four questions a judge is given for this award, and where this page answers each one.",
    "questions": [
      {
        "q": "Is this a coherent group of parts meant to be used as a collection, or just a list of all the parts the team made?",
        "a": "<a href=\"#overview\">Overview</a>, which sets out the five modules and why the collection is split that way.",
        "gap": false
      },
      {
        "q": "How does the documentation compare to the NRPieceS and PHOENICS collections?",
        "a": "<a href=\"#registry-contributions\">Registry contributions</a>, with <a href=\"#our-own-parts\">our own parts</a> and <a href=\"#reused-parts\">the parts we reused</a>. <a href=\"#registry-stubs\">Registry stubs</a> names the entries that are still open and empty.",
        "gap": true
      },
      {
        "q": "Did the team finish building a functional system using this collection?",
        "a": "<a href=\"#build-record\">Build record</a>, with <a href=\"#level-2-junction-check\">the Level 2 junction check</a> and <a href=\"#assemblies-that-failed\">the assemblies that failed</a>. <a href=\"#what-has-no-measurement\">What has no measurement</a> says which parts carry no functional data.",
        "gap": true
      },
      {
        "q": "Can it be useful to the community?",
        "a": "<a href=\"#status-vocabulary\">Status vocabulary</a>, which fixes what each entry is entitled to claim, and <a href=\"#our-own-parts\">Our own parts</a>.",
        "gap": false
      }
    ]
  }

};
