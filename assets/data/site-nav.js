/* =============================================================================
   ReLeaf: site navigation
   -----------------------------------------------------------------------------
   Five tabs. Each opens a full-width panel: one grid of sub-pages, every one
   with its own icon and a caption of three to five words that sits on a single
   line. The panel carries no section title and no section blurb: the open tab
   already names the section, and a newcomer reads the captions faster than a
   paragraph.

   THE `slug` FIELD IS THE URL AND IS NOT FREE TO CHANGE.
   iGEM fixes the URL of every judged page (2026 Judge Handbook, "Standard Pages
   for Awards", p.29). A team is evaluated for a medal or a special award only if
   the work sits at the standard address. Slugs marked STANDARD below are those
   addresses. Rename one and the award goes unjudged.

   The five tabs are a reading order, not a URL prefix. `/human-practices` lives
   under the Engagement tab but keeps its flat standard address.

   To add a page:  drop an entry into the right tab's `pages` array. `slug` is
                   the folder under the wiki root; nav.js prefixes it with the
                   page's own `data-base`, so the same file works at any depth.
                   Keep `caption` to three to five words: the panel gives each
                   one a single line and clips anything longer.
   To add an icon: add a key to ICONS in nav.js (inner SVG markup, stroked,
                   24x24 viewBox) and reference it with `icon:`.
   ========================================================================== */

const NAV = [
  {
    id: "project",
    name: "Project",
    pages: [
      { title: "Description",  slug: "description",  icon: "description",
        caption: "The problem and our answer" },
      { title: "Biomanufacturing", slug: "biomanufacturing", icon: "biomanufacturing",
        caption: "Protectant made on the farm" },
      { title: "Engineering",  slug: "engineering",  icon: "engineering",
        caption: "Every build and test cycle" },
      { title: "Development",  slug: "development",  icon: "development",
        caption: "Success criteria, stage by stage" },
      { title: "Contribution", slug: "contribution", icon: "contribution",
        caption: "Tools future teams can reuse" },
      { title: "Results",      slug: "results",      icon: "results",
        caption: "What worked on the bench" }
    ]
  },
  {
    id: "wetlab",
    name: "Wet Lab",
    pages: [
      { title: "Experiments",  slug: "experiments",         icon: "experiments",
        caption: "Every protocol we ran" },
      { title: "Parts",        slug: "parts",               icon: "parts",
        caption: "Our BioBricks and constructs" },
      { title: "Plants",       slug: "plant",               icon: "plants",
        caption: "Salt and heat stress trials" },
      { title: "Measurement",  slug: "measurement",         icon: "measurement",
        caption: "Calibrated, repeatable readouts" },
      { title: "Safety",       slug: "safety-and-security", icon: "safety",
        caption: "Containment and lab safety" },
      { title: "Notebook",     slug: "notebook",            icon: "notebook",
        caption: "Wet lab records by month" }
    ]
  },
  {
    id: "drylab",
    name: "Dry Lab",
    pages: [
      { title: "Math Model",              slug: "model",                   icon: "model",
        caption: "From plant stress to light" },
      { title: "Hardware",                slug: "hardware",                icon: "hardware",
        caption: "Photometer, LEDs and bioreactor" },
      { title: "Digital Twin",            slug: "software",                icon: "twin",
        caption: "Software that watches each batch" },
      { title: "Protein Design",          slug: "protein-design",          icon: "peptide",
        caption: "Designing the BoPep4 peptide" },
      { title: "Dry Lab Notebook",        slug: "drylab-notebook",         icon: "notebook",
        caption: "Computational work, week by week" }
    ]
  },
  {
    id: "engagement",
    name: "Engagement",
    pages: [
      { title: "Integrated Human Practices", slug: "human-practices",      icon: "ihp",
        caption: "Voices that reshaped ReLeaf" },
      { title: "Education",                  slug: "education",            icon: "education",
        caption: "Lessons across three school levels" },
      { title: "Entrepreneurship",           slug: "entrepreneurship",     icon: "entrepreneurship",
        caption: "From prototype to farm business" },
      { title: "Sustainability",             slug: "sustainability",       icon: "sustainability",
        caption: "Our impact on the SDGs" },
      { title: "Laws and Regulations",       slug: "laws-and-regulations", icon: "legal",
        caption: "Approval routes, Taiwan and beyond" },
      { title: "Geospatial Analysis",        slug: "geospatial-analysis",  icon: "gis",
        caption: "Mapping stress across Taiwan" },
      { title: "Data Physicalization",       slug: "data-physicalization", icon: "physical",
        caption: "Stress data you can touch" }
    ]
  },
  {
    id: "team",
    name: "Team",
    pages: [
      { title: "Members",     slug: "team",         icon: "members",
        caption: "The people behind ReLeaf" },
      { title: "Attribution", slug: "attributions", icon: "attribution",
        caption: "Who did what" },
      { title: "Milestone",   slug: "milestone",    icon: "milestone",
        caption: "Our season, month by month" }
    ]
  }
];

/* -----------------------------------------------------------------------------
   Standard pages that exist but are deliberately not in the tab panels.
   They keep their iGEM address so the award stays reachable; link to them from
   the page whose argument they belong to, or promote them into a tab later.
   -------------------------------------------------------------------------- */
const NAV_UNLISTED = [
  { title: "Inclusivity", slug: "inclusivity",
    caption: "Who the project serves" },

  /* The two pages below used to be Dry Lab tabs of their own. Since
     23 September 2026 they are steps inside Protein Design, reached from
     /protein-design/. Their addresses have not changed, so every existing
     link and every footer entry still resolves. */
  { title: "MD Simulations", slug: "md-simulations",
    caption: "BoPep4 on its receptor" },
  { title: "Peptide Design", slug: "peptide-design",
    caption: "BoPep4, designed end to end" }
];

/* iGEM rule check (assets/js/rulecheck.js): outlines on every page whatever
   would break an iGEM 2026 wiki rule, with a panel listing them. It is a
   teaching aid for this demo copy. Set to false in the copy that goes to
   gitlab.igem.org, or delete the line and the file.                        */
window.RULECHECK = true;

/* Drafting marks: text an AI assistant drafted to fill a page, not yet
   rewritten by a student, carries class="ai" and shows in orange. Set to false
   (or delete the line) to show everything in the normal ink, e.g. before the
   wiki freeze once every orange passage has been replaced or approved.     */
window.AI_MARK = true;
