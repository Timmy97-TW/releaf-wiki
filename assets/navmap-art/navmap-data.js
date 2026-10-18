/* ReLEAF navigation map: the data.
   SECTIONS: the five menus, with the banner colours page.css gives the contents rail (ink, line, pill).
   PAGES: slug (the URL, fixed by iGEM), name, section, icon (from nav.js), the menu's one-line caption.
   LINKS: for each page, the related pages Jacquelyn chose (prototype 16, Oct 2026), each with
     lane  'in'  = this page builds on it,  'out' = this page leads to it ('out*' = the one to read next)
     a phrase saying what the connection is, read under the linked page's name.
   Edit the phrases freely; keep slugs as they are. */
window.NAVMAP_DATA = {
 "sections": [
  {
   "id": "project",
   "name": "Project",
   "ink": "#a3375f",
   "line": "#d65a86",
   "pill": "#fce4ea"
  },
  {
   "id": "wetlab",
   "name": "Wet Lab",
   "ink": "#3d6a4b",
   "line": "#4a7c59",
   "pill": "#e4eedc"
  },
  {
   "id": "drylab",
   "name": "Dry Lab",
   "ink": "#3f5a66",
   "line": "#6f8f9c",
   "pill": "#e3eef2"
  },
  {
   "id": "engagement",
   "name": "Engagement",
   "ink": "#85502f",
   "line": "#c08a68",
   "pill": "#f9ecdd"
  },
  {
   "id": "team",
   "name": "Team",
   "ink": "#845c0f",
   "line": "#d99a1e",
   "pill": "#fdf1c9"
  }
 ],
 "pages": [
  {
   "slug": "description",
   "name": "Description",
   "section": "project",
   "icon": "description",
   "caption": "The problem and our answer"
  },
  {
   "slug": "biomanufacturing",
   "name": "Biomanufacturing",
   "section": "project",
   "icon": "biomanufacturing",
   "caption": "Protectant made on the farm"
  },
  {
   "slug": "engineering",
   "name": "Engineering",
   "section": "project",
   "icon": "engineering",
   "caption": "Every build and test cycle"
  },
  {
   "slug": "development",
   "name": "Development",
   "section": "project",
   "icon": "development",
   "caption": "Success criteria, stage by stage"
  },
  {
   "slug": "contribution",
   "name": "Contribution",
   "section": "project",
   "icon": "contribution",
   "caption": "Tools future teams can reuse"
  },
  {
   "slug": "results",
   "name": "Results",
   "section": "project",
   "icon": "results",
   "caption": "What worked on the bench"
  },
  {
   "slug": "experiments",
   "name": "Experiments",
   "section": "wetlab",
   "icon": "experiments",
   "caption": "Every protocol we ran"
  },
  {
   "slug": "parts",
   "name": "Parts",
   "section": "wetlab",
   "icon": "parts",
   "caption": "Our BioBricks and constructs"
  },
  {
   "slug": "plant",
   "name": "Plants",
   "section": "wetlab",
   "icon": "plants",
   "caption": "Salt and heat stress trials"
  },
  {
   "slug": "measurement",
   "name": "Measurement",
   "section": "wetlab",
   "icon": "measurement",
   "caption": "Calibrated, repeatable readouts"
  },
  {
   "slug": "safety-and-security",
   "name": "Safety",
   "section": "wetlab",
   "icon": "safety",
   "caption": "Containment and lab safety"
  },
  {
   "slug": "notebook",
   "name": "Notebook",
   "section": "wetlab",
   "icon": "notebook",
   "caption": "Wet lab records by month"
  },
  {
   "slug": "model",
   "name": "Math Model",
   "section": "drylab",
   "icon": "model",
   "caption": "From plant stress to light"
  },
  {
   "slug": "hardware",
   "name": "Hardware",
   "section": "drylab",
   "icon": "hardware",
   "caption": "Photometer, LEDs and bioreactor"
  },
  {
   "slug": "software",
   "name": "Digital Twin",
   "section": "drylab",
   "icon": "twin",
   "caption": "Software that watches each batch"
  },
  {
   "slug": "protein-design",
   "name": "Protein Design",
   "section": "drylab",
   "icon": "peptide",
   "caption": "Designing the BoPep4 peptide"
  },
  {
   "slug": "drylab-notebook",
   "name": "Dry Lab Notebook",
   "section": "drylab",
   "icon": "notebook",
   "caption": "Computational work, week by week"
  },
  {
   "slug": "human-practices",
   "name": "Integrated Human Practices",
   "section": "engagement",
   "icon": "ihp",
   "caption": "Voices that reshaped ReLEAF"
  },
  {
   "slug": "education",
   "name": "Education",
   "section": "engagement",
   "icon": "education",
   "caption": "Lessons across three school levels"
  },
  {
   "slug": "entrepreneurship",
   "name": "Entrepreneurship",
   "section": "engagement",
   "icon": "entrepreneurship",
   "caption": "From prototype to farm business"
  },
  {
   "slug": "sustainability",
   "name": "Sustainability",
   "section": "engagement",
   "icon": "sustainability",
   "caption": "Our impact on the SDGs"
  },
  {
   "slug": "laws-and-regulations",
   "name": "Laws and Regulations",
   "section": "engagement",
   "icon": "legal",
   "caption": "Approval routes, Taiwan and beyond"
  },
  {
   "slug": "geospatial-analysis",
   "name": "Geospatial Analysis",
   "section": "engagement",
   "icon": "gis",
   "caption": "Mapping stress across Taiwan"
  },
  {
   "slug": "data-physicalization",
   "name": "Data Physicalization",
   "section": "engagement",
   "icon": "physical",
   "caption": "Stress data you can touch"
  },
  {
   "slug": "team",
   "name": "Members",
   "section": "team",
   "icon": "members",
   "caption": "The people behind ReLEAF"
  },
  {
   "slug": "attributions",
   "name": "Attribution",
   "section": "team",
   "icon": "attribution",
   "caption": "Who did what"
  },
  {
   "slug": "milestones",
   "name": "Milestones",
   "section": "team",
   "icon": "milestone",
   "caption": "Our season, month by month"
  }
 ],
 "links": {
  "description": [
   {
    "to": "human-practices",
    "lane": "in",
    "next": false,
    "why": "the voices that shaped this framing"
   },
   {
    "to": "team",
    "lane": "in",
    "next": false,
    "why": "who wrote and built it"
   },
   {
    "to": "plant",
    "lane": "out",
    "next": false,
    "why": "where the stressed plants are tested",
    "key": true
   },
   {
    "to": "hardware",
    "lane": "out",
    "next": false,
    "why": "the bioreactor the design calls for",
    "key": true
   },
   {
    "to": "software",
    "lane": "out",
    "next": false,
    "why": "the Digital Twin that watches each batch"
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "what the design did on the bench",
    "key": true
   }
  ],
  "biomanufacturing": [
   {
    "to": "protein-design",
    "lane": "in",
    "next": false,
    "why": "where the BoPep4 peptide comes from"
   },
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the reactor that would make it on the farm",
    "key": true
   },
   {
    "to": "software",
    "lane": "in",
    "next": false,
    "why": "the control layer for each batch"
   },
   {
    "to": "laws-and-regulations",
    "lane": "out",
    "next": false,
    "why": "the approval route a farm product needs",
    "key": true
   },
   {
    "to": "entrepreneurship",
    "lane": "out",
    "next": true,
    "why": "the business case built on this",
    "key": true
   }
  ],
  "engineering": [
   {
    "to": "experiments",
    "lane": "in",
    "next": false,
    "why": "the protocols behind each cycle",
    "key": true
   },
   {
    "to": "measurement",
    "lane": "in",
    "next": false,
    "why": "how every test was read out"
   },
   {
    "to": "protein-design",
    "lane": "in",
    "next": false,
    "why": "the design loop for the peptide"
   },
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the three hardware tracks in detail",
    "key": true
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "the final numbers from the cycles",
    "key": true
   },
   {
    "to": "biomanufacturing",
    "lane": "out",
    "next": false,
    "why": "what the cycles add up to"
   }
  ],
  "development": [
   {
    "to": "engineering",
    "lane": "in",
    "next": false,
    "why": "the cycles each stage was judged on",
    "key": true
   },
   {
    "to": "human-practices",
    "lane": "in",
    "next": false,
    "why": "where the success criteria came from"
   },
   {
    "to": "milestones",
    "lane": "in",
    "next": false,
    "why": "the same season, dated",
    "key": true
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "evidence for each stage’s criteria",
    "key": true
   },
   {
    "to": "contribution",
    "lane": "out",
    "next": false,
    "why": "what stays usable after the last stage"
   }
  ],
  "contribution": [
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the open reactor designs we hand on",
    "key": true
   },
   {
    "to": "plant",
    "lane": "in",
    "next": false,
    "why": "the stress protocols others can reuse"
   },
   {
    "to": "results",
    "lane": "in",
    "next": false,
    "why": "the data behind every tool here",
    "key": true
   },
   {
    "to": "education",
    "lane": "out",
    "next": true,
    "why": "the lessons we leave with schools",
    "key": true
   },
   {
    "to": "team",
    "lane": "out",
    "next": false,
    "why": "the people to ask about reuse"
   }
  ],
  "results": [
   {
    "to": "experiments",
    "lane": "in",
    "next": false,
    "why": "the runs these numbers come from",
    "key": true
   },
   {
    "to": "measurement",
    "lane": "in",
    "next": false,
    "why": "how each reading was calibrated"
   },
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the instruments that took the readings",
    "key": true
   },
   {
    "to": "software",
    "lane": "in",
    "next": false,
    "why": "the batch logs the Digital Twin kept"
   },
   {
    "to": "team",
    "lane": "in",
    "next": false,
    "why": "who ran each experiment"
   },
   {
    "to": "plant",
    "lane": "out",
    "next": true,
    "why": "what the protectant did on stressed plants",
    "key": true
   }
  ],
  "experiments": [
   {
    "to": "parts",
    "lane": "in",
    "next": false,
    "why": "the constructs each run used",
    "key": true
   },
   {
    "to": "safety-and-security",
    "lane": "in",
    "next": false,
    "why": "the containment every run followed"
   },
   {
    "to": "notebook",
    "lane": "in",
    "next": false,
    "why": "the day-by-day record of the runs"
   },
   {
    "to": "measurement",
    "lane": "out",
    "next": false,
    "why": "how each run was read out"
   },
   {
    "to": "plant",
    "lane": "out",
    "next": false,
    "why": "the plant trials the runs fed",
    "key": true
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "what the runs showed",
    "key": true
   }
  ],
  "parts": [
   {
    "to": "protein-design",
    "lane": "in",
    "next": false,
    "why": "the peptide the constructs express",
    "key": true
   },
   {
    "to": "engineering",
    "lane": "in",
    "next": false,
    "why": "the cycles that changed the designs"
   },
   {
    "to": "notebook",
    "lane": "in",
    "next": false,
    "why": "when each part was built"
   },
   {
    "to": "experiments",
    "lane": "out",
    "next": false,
    "why": "the runs each construct went into",
    "key": true
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "how each part performed",
    "key": true
   },
   {
    "to": "biomanufacturing",
    "lane": "out",
    "next": false,
    "why": "what the parts are for at scale"
   }
  ],
  "plant": [
   {
    "to": "experiments",
    "lane": "in",
    "next": false,
    "why": "the bench runs before the plants",
    "key": true
   },
   {
    "to": "measurement",
    "lane": "in",
    "next": false,
    "why": "how stress and recovery were scored"
   },
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the growth and reading rigs"
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "the trial outcomes",
    "key": true
   },
   {
    "to": "geospatial-analysis",
    "lane": "out",
    "next": false,
    "why": "where this stress bites across Taiwan"
   },
   {
    "to": "human-practices",
    "lane": "out",
    "next": false,
    "why": "the farmers the trials were designed with",
    "key": true
   }
  ],
  "measurement": [
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the photometer and LED rig behind the readings",
    "key": true
   },
   {
    "to": "software",
    "lane": "in",
    "next": false,
    "why": "the logging that records each reading"
   },
   {
    "to": "experiments",
    "lane": "in",
    "next": false,
    "why": "the runs the readouts belong to"
   },
   {
    "to": "model",
    "lane": "out",
    "next": false,
    "why": "the equations fitted to the readings",
    "key": true
   },
   {
    "to": "plant",
    "lane": "out",
    "next": false,
    "why": "plant scores built on the same method"
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "the calibrated numbers in use",
    "key": true
   }
  ],
  "safety-and-security": [
   {
    "to": "notebook",
    "lane": "in",
    "next": false,
    "why": "the training and checks, dated"
   },
   {
    "to": "experiments",
    "lane": "out",
    "next": false,
    "why": "the runs the rules apply to",
    "key": true
   },
   {
    "to": "parts",
    "lane": "out",
    "next": false,
    "why": "the constructs under containment"
   },
   {
    "to": "hardware",
    "lane": "out",
    "next": false,
    "why": "the reactor’s safety fittings",
    "key": true
   },
   {
    "to": "laws-and-regulations",
    "lane": "out",
    "next": true,
    "why": "the law behind the lab rules",
    "key": true
   },
   {
    "to": "sustainability",
    "lane": "out",
    "next": false,
    "why": "containment as a sustainability claim"
   }
  ],
  "notebook": [
   {
    "to": "experiments",
    "lane": "in",
    "next": false,
    "why": "the protocols the entries follow",
    "key": true
   },
   {
    "to": "parts",
    "lane": "in",
    "next": false,
    "why": "the constructs built in these entries"
   },
   {
    "to": "measurement",
    "lane": "in",
    "next": false,
    "why": "the readouts taken in these entries"
   },
   {
    "to": "engineering",
    "lane": "out",
    "next": false,
    "why": "the cycles the entries add up to",
    "key": true
   },
   {
    "to": "development",
    "lane": "out",
    "next": false,
    "why": "the stage each month belongs to"
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "what the record produced",
    "key": true
   }
  ],
  "model": [
   {
    "to": "measurement",
    "lane": "in",
    "next": false,
    "why": "the readings the equations are fitted to",
    "key": true
   },
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the light rig the model drives"
   },
   {
    "to": "drylab-notebook",
    "lane": "in",
    "next": false,
    "why": "the fitting work, week by week"
   },
   {
    "to": "software",
    "lane": "out",
    "next": true,
    "why": "the Digital Twin that runs the model",
    "key": true
   },
   {
    "to": "results",
    "lane": "out",
    "next": false,
    "why": "the model against the bench",
    "key": true
   },
   {
    "to": "geospatial-analysis",
    "lane": "out",
    "next": false,
    "why": "the model applied across the map"
   }
  ],
  "hardware": [
   {
    "to": "engineering",
    "lane": "in",
    "next": false,
    "why": "the build cycles behind each device",
    "key": true
   },
   {
    "to": "safety-and-security",
    "lane": "in",
    "next": false,
    "why": "the safety fittings the reactor carries"
   },
   {
    "to": "measurement",
    "lane": "out",
    "next": false,
    "why": "what the instruments measure",
    "key": true
   },
   {
    "to": "plant",
    "lane": "out",
    "next": false,
    "why": "the rigs in the plant trials"
   },
   {
    "to": "software",
    "lane": "out",
    "next": true,
    "why": "the Digital Twin that runs the reactor",
    "key": true
   },
   {
    "to": "biomanufacturing",
    "lane": "out",
    "next": false,
    "why": "the reactor at farm scale"
   }
  ],
  "software": [
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the reactor the Digital Twin controls",
    "key": true
   },
   {
    "to": "model",
    "lane": "in",
    "next": false,
    "why": "the equations behind the forecast",
    "key": true
   },
   {
    "to": "measurement",
    "lane": "in",
    "next": false,
    "why": "the sensors it reads"
   },
   {
    "to": "drylab-notebook",
    "lane": "in",
    "next": false,
    "why": "the development log"
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "the 434-hour run and its data",
    "key": true
   },
   {
    "to": "plant",
    "lane": "out",
    "next": false,
    "why": "the field side the forecast serves"
   }
  ],
  "protein-design": [
   {
    "to": "model",
    "lane": "in",
    "next": false,
    "why": "the numbers the peptide dose came from",
    "key": true
   },
   {
    "to": "drylab-notebook",
    "lane": "in",
    "next": false,
    "why": "the pipeline runs, week by week"
   },
   {
    "to": "parts",
    "lane": "out",
    "next": true,
    "why": "the constructs that express BoPep4",
    "key": true
   },
   {
    "to": "engineering",
    "lane": "out",
    "next": false,
    "why": "the design loop the pipeline fed"
   },
   {
    "to": "results",
    "lane": "out",
    "next": false,
    "why": "what the peptide did on the bench"
   },
   {
    "to": "biomanufacturing",
    "lane": "out",
    "next": false,
    "why": "the product the peptide becomes",
    "key": true
   }
  ],
  "drylab-notebook": [
   {
    "to": "protein-design",
    "lane": "in",
    "next": false,
    "why": "the pipeline these entries ran"
   },
   {
    "to": "model",
    "lane": "in",
    "next": false,
    "why": "the fits these entries record",
    "key": true
   },
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the firmware and builds logged here"
   },
   {
    "to": "software",
    "lane": "in",
    "next": false,
    "why": "the Digital Twin’s development log",
    "key": true
   },
   {
    "to": "results",
    "lane": "out",
    "next": true,
    "why": "what the computational work produced",
    "key": true
   }
  ],
  "human-practices": [
   {
    "to": "team",
    "lane": "in",
    "next": false,
    "why": "who met the stakeholders"
   },
   {
    "to": "plant",
    "lane": "out",
    "next": true,
    "why": "the trials farmers asked for",
    "key": true
   },
   {
    "to": "laws-and-regulations",
    "lane": "out",
    "next": false,
    "why": "the regulators we spoke to, in detail",
    "key": true
   },
   {
    "to": "entrepreneurship",
    "lane": "out",
    "next": false,
    "why": "the farm economics stakeholders raised",
    "key": true
   },
   {
    "to": "education",
    "lane": "out",
    "next": false,
    "why": "the schools we went back to"
   },
   {
    "to": "sustainability",
    "lane": "out",
    "next": false,
    "why": "the impact the stakeholders care about"
   }
  ],
  "education": [
   {
    "to": "description",
    "lane": "in",
    "next": false,
    "why": "the project the lessons explain",
    "key": true
   },
   {
    "to": "human-practices",
    "lane": "in",
    "next": false,
    "why": "the stakeholder work the lessons grew from",
    "key": true
   },
   {
    "to": "team",
    "lane": "in",
    "next": false,
    "why": "who taught"
   },
   {
    "to": "contribution",
    "lane": "out",
    "next": true,
    "why": "the lesson kits future teams can reuse",
    "key": true
   },
   {
    "to": "data-physicalization",
    "lane": "out",
    "next": false,
    "why": "the objects students could handle"
   },
   {
    "to": "sustainability",
    "lane": "out",
    "next": false,
    "why": "the SDG the lessons serve"
   }
  ],
  "entrepreneurship": [
   {
    "to": "biomanufacturing",
    "lane": "in",
    "next": false,
    "why": "the product the business makes",
    "key": true
   },
   {
    "to": "hardware",
    "lane": "in",
    "next": false,
    "why": "the reactor’s cost basis"
   },
   {
    "to": "plant",
    "lane": "in",
    "next": false,
    "why": "the evidence farmers would buy on"
   },
   {
    "to": "human-practices",
    "lane": "in",
    "next": false,
    "why": "the farmers who priced it with us",
    "key": true
   },
   {
    "to": "laws-and-regulations",
    "lane": "out",
    "next": true,
    "why": "the approvals before any sale",
    "key": true
   },
   {
    "to": "sustainability",
    "lane": "out",
    "next": false,
    "why": "the impact case beside the profit case"
   }
  ],
  "sustainability": [
   {
    "to": "laws-and-regulations",
    "lane": "in",
    "next": false,
    "why": "the rules the impact assumes"
   },
   {
    "to": "entrepreneurship",
    "lane": "in",
    "next": false,
    "why": "the business the impact depends on",
    "key": true
   },
   {
    "to": "safety-and-security",
    "lane": "in",
    "next": false,
    "why": "containment the SDG claims rely on"
   },
   {
    "to": "human-practices",
    "lane": "in",
    "next": false,
    "why": "the people the impact is measured for",
    "key": true
   },
   {
    "to": "contribution",
    "lane": "out",
    "next": true,
    "why": "what others can build on",
    "key": true
   }
  ],
  "laws-and-regulations": [
   {
    "to": "biomanufacturing",
    "lane": "in",
    "next": false,
    "why": "the product the rules apply to",
    "key": true
   },
   {
    "to": "safety-and-security",
    "lane": "in",
    "next": false,
    "why": "the lab practice the rules start from"
   },
   {
    "to": "human-practices",
    "lane": "in",
    "next": false,
    "why": "the regulators who explained the route",
    "key": true
   },
   {
    "to": "entrepreneurship",
    "lane": "out",
    "next": true,
    "why": "the business the approvals gate",
    "key": true
   },
   {
    "to": "sustainability",
    "lane": "out",
    "next": false,
    "why": "compliance as part of the impact"
   }
  ],
  "geospatial-analysis": [
   {
    "to": "model",
    "lane": "in",
    "next": false,
    "why": "the stress model mapped here",
    "key": true
   },
   {
    "to": "plant",
    "lane": "in",
    "next": false,
    "why": "the trial data behind the map",
    "key": true
   },
   {
    "to": "data-physicalization",
    "lane": "out",
    "next": false,
    "why": "the map rebuilt as an object"
   },
   {
    "to": "sustainability",
    "lane": "out",
    "next": false,
    "why": "where the impact would land"
   },
   {
    "to": "human-practices",
    "lane": "out",
    "next": true,
    "why": "the regions’ farmers we spoke to",
    "key": true
   }
  ],
  "data-physicalization": [
   {
    "to": "results",
    "lane": "in",
    "next": false,
    "why": "the data the objects are built from",
    "key": true
   },
   {
    "to": "plant",
    "lane": "in",
    "next": false,
    "why": "the stress scores made tangible"
   },
   {
    "to": "model",
    "lane": "in",
    "next": false,
    "why": "the curves cast as shapes"
   },
   {
    "to": "geospatial-analysis",
    "lane": "in",
    "next": false,
    "why": "the map made touchable",
    "key": true
   },
   {
    "to": "education",
    "lane": "out",
    "next": true,
    "why": "where the objects were used",
    "key": true
   },
   {
    "to": "human-practices",
    "lane": "out",
    "next": false,
    "why": "the conversations the objects started"
   }
  ],
  "team": [
   {
    "to": "attributions",
    "lane": "in",
    "next": false,
    "why": "who did what, by name",
    "key": true
   },
   {
    "to": "milestones",
    "lane": "in",
    "next": false,
    "why": "when it all happened",
    "key": true
   },
   {
    "to": "description",
    "lane": "out",
    "next": true,
    "why": "the project we built",
    "key": true
   },
   {
    "to": "contribution",
    "lane": "out",
    "next": false,
    "why": "what we leave behind"
   },
   {
    "to": "education",
    "lane": "out",
    "next": false,
    "why": "where we taught"
   },
   {
    "to": "results",
    "lane": "out",
    "next": false,
    "why": "what we achieved"
   }
  ],
  "attributions": [
   {
    "to": "team",
    "lane": "in",
    "next": false,
    "why": "the people being credited",
    "key": true
   },
   {
    "to": "milestones",
    "lane": "in",
    "next": false,
    "why": "when each contribution happened"
   },
   {
    "to": "experiments",
    "lane": "out",
    "next": false,
    "why": "the bench work credited here",
    "key": true
   },
   {
    "to": "contribution",
    "lane": "out",
    "next": true,
    "why": "the tools credited here",
    "key": true
   },
   {
    "to": "human-practices",
    "lane": "out",
    "next": false,
    "why": "the stakeholder work credited here"
   }
  ],
  "milestones": [
   {
    "to": "team",
    "lane": "in",
    "next": false,
    "why": "who was there each month",
    "key": true
   },
   {
    "to": "description",
    "lane": "in",
    "next": false,
    "why": "the project the season built"
   },
   {
    "to": "engineering",
    "lane": "out",
    "next": false,
    "why": "the cycles behind each month",
    "key": true
   },
   {
    "to": "development",
    "lane": "out",
    "next": true,
    "why": "the stage each milestone marks",
    "key": true
   },
   {
    "to": "contribution",
    "lane": "out",
    "next": false,
    "why": "what the season left behind"
   },
   {
    "to": "results",
    "lane": "out",
    "next": false,
    "why": "the numbers at the end of it"
   }
  ]
 },
 "icons": {
  "attribution": "<path d=\"M11 6H14L17.29 2.7A1 1 0 0 1 18.71 2.7L21.29 5.29A1 1 0 0 1 21.29 6.7L19 9H11V11A1 1 0 0 1 10 12A1 1 0 0 1 9 11V8A2 2 0 0 1 11 6M5 11V15L2.71 17.29A1 1 0 0 0 2.71 18.7L5.29 21.29A1 1 0 0 0 6.71 21.29L11 17H15A1 1 0 0 0 16 16V15H17A1 1 0 0 0 18 14V13H19A1 1 0 0 0 20 12V11H13V12A2 2 0 0 1 11 14H9A2 2 0 0 1 7 12V9Z\"/>",
  "biomanufacturing": "<path d=\"M4,18V20H8V18H4M4,14V16H14V14H4M10,18V20H14V18H10M16,14V16H20V14H16M16,18V20H20V18H16M2,22V8L7,12V8L12,12V8L17,12L18,2H21L22,12V22H2Z\"/>",
  "contribution": "<path d=\"M18 16H16V15H8V16H6V15H2V20H22V15H18V16M20 8H17V6C17 4.9 16.1 4 15 4H9C7.9 4 7 4.9 7 6V8H4C2.9 8 2 8.9 2 10V14H6V12H8V14H16V12H18V14H22V10C22 8.9 21.1 8 20 8M15 8H9V6H15V8Z\"/>",
  "description": "<path d=\"M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z\"/>",
  "development": "<path d=\"M15 6H22V9H18V13H14V17H10V21H3V18H7V14H11V10H15V6M10.17 6.66L4.66 12.17L2.83 10.34L8.34 4.83L6.5 3H12V8.5L10.17 6.66Z\"/>",
  "education": "<path d=\"M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z\"/>",
  "engineering": "<path d=\"M12,6V9L16,5L12,1V4A8,8 0 0,0 4,12C4,13.57 4.46,15.03 5.24,16.26L6.7,14.8C6.25,13.97 6,13 6,12A6,6 0 0,1 12,6M18.76,7.74L17.3,9.2C17.74,10.04 18,11 18,12A6,6 0 0,1 12,18V15L8,19L12,23V20A8,8 0 0,0 20,12C20,10.43 19.54,8.97 18.76,7.74Z\"/>",
  "entrepreneurship": "<path d=\"M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V19A1,1 0 0,1 14,20H10A1,1 0 0,1 9,19V17.2C7.21,16.16 6,14.22 6,12A6,6 0 0,1 12,6M14,21V22A1,1 0 0,1 13,23H11A1,1 0 0,1 10,22V21H14M20,11H23V13H20V11M1,11H4V13H1V11M13,1V4H11V1H13M4.92,3.5L7.05,5.64L5.63,7.05L3.5,4.93L4.92,3.5M16.95,5.63L19.07,3.5L20.5,4.93L18.37,7.05L16.95,5.63Z\"/>",
  "experiments": "<path d=\"M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L16.53,14.47L14,17L8.93,11.93L5.18,18.43C5.07,18.59 5,18.79 5,19M13,10A1,1 0 0,0 12,11A1,1 0 0,0 13,12A1,1 0 0,0 14,11A1,1 0 0,0 13,10Z\"/>",
  "gis": "<path d=\"M15,19L9,16.89V5L15,7.11M20.5,3C20.44,3 20.39,3 20.34,3L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21C3.55,21 3.61,21 3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3Z\"/>",
  "hardware": "<path d=\"M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z\"/>",
  "ihp": "<path d=\"M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z\"/>",
  "legal": "<path d=\"M12,3C10.73,3 9.6,3.8 9.18,5H3V7H4.95L2,14C1.53,16 3,17 5.5,17C8,17 9.56,16 9,14L6.05,7H9.17C9.5,7.85 10.15,8.5 11,8.83V20H2V22H22V20H13V8.82C13.85,8.5 14.5,7.85 14.82,7H17.95L15,14C14.53,16 16,17 18.5,17C21,17 22.56,16 22,14L19.05,7H21V5H14.83C14.4,3.8 13.27,3 12,3M12,5A1,1 0 0,1 13,6A1,1 0 0,1 12,7A1,1 0 0,1 11,6A1,1 0 0,1 12,5M5.5,10.25L7,14H4L5.5,10.25M18.5,10.25L20,14H17L18.5,10.25Z\"/>",
  "measurement": "<path d=\"M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 19,16.5 17.3,18C15.9,16.7 14,16 12,16C10,16 8.2,16.7 6.7,18C5,16.5 4,14.4 4,12A8,8 0 0,1 12,4M14,5.89C13.62,5.9 13.26,6.15 13.1,6.54L11.81,9.77L11.71,10C11,10.13 10.41,10.6 10.14,11.26C9.73,12.29 10.23,13.45 11.26,13.86C12.29,14.27 13.45,13.77 13.86,12.74C14.12,12.08 14,11.32 13.57,10.76L13.67,10.5L14.96,7.29L14.97,7.26C15.17,6.75 14.92,6.17 14.41,5.96C14.28,5.91 14.15,5.89 14,5.89M10,6A1,1 0 0,0 9,7A1,1 0 0,0 10,8A1,1 0 0,0 11,7A1,1 0 0,0 10,6M7,9A1,1 0 0,0 6,10A1,1 0 0,0 7,11A1,1 0 0,0 8,10A1,1 0 0,0 7,9M17,9A1,1 0 0,0 16,10A1,1 0 0,0 17,11A1,1 0 0,0 18,10A1,1 0 0,0 17,9Z\"/>",
  "members": "<path d=\"M16 17V19H2V17S2 13 9 13 16 17 16 17M12.5 7.5A3.5 3.5 0 1 0 9 11A3.5 3.5 0 0 0 12.5 7.5M15.94 13A5.32 5.32 0 0 1 18 17V19H22V17S22 13.37 15.94 13M15 4A3.39 3.39 0 0 0 13.07 4.59A5 5 0 0 1 13.07 10.41A3.39 3.39 0 0 0 15 11A3.5 3.5 0 0 0 15 4Z\"/>",
  "milestone": "<path d=\"M14.4,6L14,4H5V21H7V14H12.6L13,16H20V6H14.4Z\"/>",
  "model": "<path d=\"M9.96,11.31C10.82,8.1 11.5,6 13,6C14.5,6 15.18,8.1 16.04,11.31C17,14.92 18.1,19 22,19V17C19.8,17 19,14.54 17.97,10.8C17.08,7.46 16.15,4 13,4C9.85,4 8.92,7.46 8.03,10.8C7.03,14.54 6.2,17 4,17V2H2V22H22V20H4V19C7.9,19 9,14.92 9.96,11.31Z\"/>",
  "notebook": "<path d=\"M3,7V5H5V4C5,2.89 5.9,2 7,2H13V9L15.5,7.5L18,9V2H19C20.05,2 21,2.95 21,4V20C21,21.05 20.05,22 19,22H7C5.95,22 5,21.05 5,20V19H3V17H5V13H3V11H5V7H3M7,11H5V13H7V11M7,7V5H5V7H7M7,19V17H5V19H7Z\"/>",
  "parts": "<path d=\"M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5,16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z\"/>",
  "peptide": "<path d=\"M7.27,10L9,7H14.42L15.58,5L15.5,4.5A1.5,1.5 0 0,1 17,3A1.5,1.5 0 0,1 18.5,4.5C18.5,5.21 18,5.81 17.33,5.96L16.37,7.63L17.73,10L18.59,8.5L18.5,8A1.5,1.5 0 0,1 20,6.5A1.5,1.5 0 0,1 21.5,8C21.5,8.71 21,9.3 20.35,9.46L18.89,12L20.62,15C21.39,15.07 22,15.71 22,16.5A1.5,1.5 0 0,1 20.5,18A1.5,1.5 0 0,1 19,16.5V16.24L17.73,14L16.37,16.37L17.33,18.04C18,18.19 18.5,18.79 18.5,19.5A1.5,1.5 0 0,1 17,21A1.5,1.5 0 0,1 15.5,19.5L15.58,19L14.42,17H10.58L9.42,19L9.5,19.5A1.5,1.5 0 0,1 8,21A1.5,1.5 0 0,1 6.5,19.5C6.5,18.79 7,18.19 7.67,18.04L8.63,16.37L4.38,9C3.61,8.93 3,8.29 3,7.5A1.5,1.5 0 0,1 4.5,6A1.5,1.5 0 0,1 6,7.5C6,7.59 6,7.68 6,7.76L7.27,10M10.15,9L8.42,12L10.15,15H14.85L16.58,12L14.85,9H10.15Z\"/>",
  "physical": "<path d=\"M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L6.04,7.5L12,10.85L17.96,7.5L12,4.15Z\"/>",
  "plants": "<path d=\"M2,22V20C2,20 7,18 12,18C17,18 22,20 22,20V22H2M11.3,9.1C10.1,5.2 4,6.1 4,6.1C4,6.1 4.2,13.9 9.9,12.7C9.5,9.8 8,9 8,9C10.8,9 11,12.4 11,12.4V17C11.3,17 11.7,17 12,17C12.3,17 12.7,17 13,17V12.8C13,12.8 13,8.9 16,7.9C16,7.9 14,10.9 14,12.9C21,13.6 21,4 21,4C21,4 12.1,3 11.3,9.1Z\"/>",
  "results": "<path d=\"M3,22V8H7V22H3M10,22V2H14V22H10M17,22V14H21V22H17Z\"/>",
  "safety": "<path d=\"M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z\"/>",
  "sustainability": "<path d=\"M17.9,17.39C17.64,16.59 16.89,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A2,2 0 0,0 11,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z\"/>",
  "twin": "<path d=\"M21,16V4H3V16H21M21,2A2,2 0 0,1 23,4V16A2,2 0 0,1 21,18H14V20H16V22H8V20H10V18H3C1.89,18 1,17.1 1,16V4C1,2.89 1.89,2 3,2H21M5,6H14V11H5V6M15,6H19V8H15V6M19,9V14H15V9H19M5,12H9V14H5V12M10,12H14V14H10V12Z\"/>"
 }
};
