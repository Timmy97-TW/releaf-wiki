/* =============================================================================
   ReLeaf: site navigation
   -----------------------------------------------------------------------------
   Five tabs. Each opens a full-width panel: a title rail on the left, the
   sub-pages on the right, every one with its own icon and a one-line caption.

   THE `slug` FIELD IS THE URL AND IS NOT FREE TO CHANGE.
   iGEM fixes the URL of every judged page (2026 Judge Handbook, "Standard Pages
   for Awards", p.28). A team is evaluated for a medal or a special award only if
   the work sits at the standard address. Slugs marked STANDARD below are those
   addresses. Rename one and the award goes unjudged.

   The five tabs are a reading order, not a URL prefix. `/human-practices` lives
   under the Engagement tab but keeps its flat standard address.

   To add a page:  drop an entry into the right tab's `pages` array. `slug` is
                   the folder under the wiki root; nav.js prefixes it with the
                   page's own `data-base`, so the same file works at any depth.
   To add an icon: add a key to ICONS in nav.js (inner SVG markup, stroked,
                   24x24 viewBox) and reference it with `icon:`.
   Tab artwork:    each tab looks for assets/img/tab-icons/<id>.png (or .svg, set
                   `art:` to override). Missing files are skipped silently, so
                   the nav stays clean until the drawings arrive.
   ========================================================================== */

const NAV = [
  {
    id: "project",
    name: "Project",
    blurb: "The whole arc of the work, from the first sketch of the problem through the build cycles to the numbers we finished with.",
    pages: [
      { title: "Description",  slug: "description",  icon: "description",
        caption: "The problem we picked, the system we designed, and why it had to be alive." },
      { title: "Engineering",  slug: "engineering",  icon: "engineering",
        caption: "Every design, build, test and learn cycle we went through." },
      { title: "Contribution", slug: "contribution", icon: "contribution",
        caption: "What we are leaving behind for the teams that come after us." },
      { title: "Results",      slug: "results",      icon: "results",
        caption: "What the system actually did on the bench." }
    ]
  },
  {
    id: "wetlab",
    name: "Wet Lab",
    blurb: "Everything that happened at the bench: the runs and protocols, the parts we built and characterised, the plants we stressed, and how we measured and contained it all.",
    pages: [
      { title: "Experiments",  slug: "experiments",         icon: "experiments",
        caption: "Protocols, conditions and every run we made." },
      { title: "Parts",        slug: "parts",               icon: "parts",
        caption: "What we built, what we characterised, what we registered." },
      { title: "Plants",       slug: "plant",               icon: "plants",
        caption: "Agar, hydroponics and soil, from seedling to stress." },
      { title: "Measurement",  slug: "measurement",         icon: "measurement",
        caption: "How we quantified expression and output." },
      { title: "Safety",       slug: "safety-and-security", icon: "safety",
        caption: "Containment, risk assessment and lab practice." },
      { title: "Notebook",     slug: "notebook",            icon: "notebook",
        caption: "The wet lab record, week by week." }
    ]
  },
  {
    id: "drylab",
    name: "Dry Lab",
    blurb: "The maths, the machine and the code. Reactor sizing, the model behind the light switch, our hardware and software, and the peptide designed to go with them.",
    pages: [
      { title: "Math Model",              slug: "model",                   icon: "model",
        caption: "The equations behind sensing, expression and release." },
      { title: "Bioreactor Calculations", slug: "bioreactor-calculations", icon: "bioreactor",
        caption: "Sizing, flow and mass transfer for the vessel." },
      { title: "Hardware",                slug: "hardware",                icon: "hardware",
        caption: "Enclosure, optics and electronics." },
      { title: "Software",                slug: "software",                icon: "software",
        caption: "Control code, analysis and tooling." },
      { title: "Peptide Design",          slug: "peptide-design",          icon: "peptide",
        caption: "Choosing and refining the protectant sequence." },
      { title: "Dry Lab Notebook",        slug: "drylab-notebook",         icon: "notebook",
        caption: "The computational record, week by week." }
    ]
  },
  {
    id: "engagement",
    name: "Engagement",
    blurb: "The world the project has to survive in. Who we talked to, what we taught, the rules we would have to meet, and where the need for this actually sits.",
    pages: [
      { title: "Integrated Human Practices", slug: "human-practices",      icon: "ihp",
        caption: "The people who changed the project, and what they changed about it." },
      { title: "Education",                  slug: "education",            icon: "education",
        caption: "What we taught, who we taught it to, and what stuck." },
      { title: "Entrepreneurship",           slug: "entrepreneurship",     icon: "entrepreneurship",
        caption: "The business case, what it costs, and how it would reach a field." },
      { title: "Sustainability",             slug: "sustainability",       icon: "sustainability",
        caption: "Measuring ReLeaf against the SDGs." },
      { title: "Laws and Regulations",       slug: "laws-and-regulations", icon: "legal",
        caption: "Regulation, approval routes and compliance in Taiwan." },
      { title: "Geospatial Analysis",        slug: "geospatial-analysis",  icon: "gis",
        caption: "Mapping where plant stress actually bites." },
      { title: "Data Physicalization",       slug: "data-physicalization", icon: "physical",
        caption: "Our data, rebuilt as objects you can pick up." },
      { title: "AI Responsibility",          slug: "ai-responsibility",    icon: "ai",
        caption: "Where we used AI, where we refused to, and how we checked it." }
    ]
  },
  {
    id: "team",
    name: "Team",
    blurb: "The forty-seven of us, a record of who did which part, the year in order, and the photographs from all of it.",
    pages: [
      { title: "Members",     slug: "team",         icon: "members",
        caption: "The students, advisors and instructors who built ReLeaf." },
      { title: "Attribution", slug: "attributions", icon: "attribution",
        caption: "Who did what, and who helped us do it." },
      { title: "Milestone",   slug: "milestone",    icon: "milestone",
        caption: "The year in order, from the first meeting to the freeze." },
      { title: "Gallery",     slug: "gallery",      icon: "gallery",
        caption: "Photographs from the bench, the field and the road to Paris." }
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
    caption: "Who the project is built for, and who it would leave out." }
];
