/* =============================================================================
   ReLeaf: site navigation
   -----------------------------------------------------------------------------
   Five tabs. Each opens a full-width panel: a title rail on the left, the
   sub-pages on the right, each with a one-line caption and, where the page
   is the one judged for a medal criterion or an award, that award named.

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
   Captions:       say what is on the page, concretely, in under fifteen
                   words: a count, a subject, a scope. Not what the page
                   hopes to achieve.
   `award`:        the iGEM medal criterion or special award judged at this
                   address (2026 Judge Handbook, p.29). Shown under the
                   caption in field lettering. Leave it off pages that are
                   not judged. Keep `title` and `slug` first in each entry:
                   build/generate.py and build/audit.py read them by pattern.
   Tab artwork:    drop the drawing into assets/img/tab-icons/<id>.png and set
                   `art: true` on that tab, or `art: "assets/img/tab-icons/x.svg"`
                   (a path from the wiki root) for another name. Tabs without
                   `art` request nothing, so the console stays clean until the
                   drawings arrive.
   ========================================================================== */

const NAV = [
  {
    id: "project",
    name: "Project",
    blurb: "What ReLeaf is and why, the cycles that built it, what it leaves for other teams, and how far the evidence for each link goes.",
    pages: [
      { title: "Description",  slug: "description",
        caption: "Heat and salt stress, and a contained bioreactor that makes the protectant at the edge of the field." },
      { title: "Engineering",  slug: "engineering",  award: "Silver #1",
        caption: "Six cloning cycles that moved a four-module light circuit into the production strain." },
      { title: "Contribution", slug: "contribution", award: "Bronze #3",
        caption: "What a team starting a perfusion reactor next year can take from us." },
      { title: "Results",      slug: "results",
        caption: "The chain from forecast to containment, link by link, with what each link has shown." }
    ]
  },
  {
    id: "wetlab",
    name: "Wet Lab",
    blurb: "The bench: protocols, the parts and how they were read back, the plant assays, the measurements, and how the culture is contained.",
    pages: [
      { title: "Experiments",  slug: "experiments",
        caption: "Twenty-one protocols in four families, with reagents, volumes and timings." },
      { title: "Parts",        slug: "parts",
        caption: "Five modules, each part marked against its sequencing record." },
      { title: "Plants",       slug: "plant",
        caption: "Seedlings on agar, in hydroponics and in soil, under salt and heat." },
      { title: "Measurement",  slug: "measurement",         award: "Best Measurement",
        caption: "Thirteen measurements, each with its method, unit, control and state." },
      { title: "Safety",       slug: "safety-and-security", award: "Safety and Security",
        caption: "Containment, risk assessment and lab practice." },
      { title: "Wet Lab Notebook", slug: "notebook",
        caption: "The bench record, month by month." }
    ]
  },
  {
    id: "drylab",
    name: "Dry Lab",
    blurb: "The model behind the light switch, the instruments we built, the reactor software, and the peptide designed for the system.",
    pages: [
      { title: "Math Model",              slug: "model",                   award: "Best Model",
        caption: "A stress index, the light-switch kinetics, and reactors per hectare." },
      { title: "Hardware",                slug: "hardware",                award: "Best Hardware",
        caption: "The bioreactor, photometer, LED array and hydroponics plate, and the build notebook." },
      { title: "Software",                slug: "software",                award: "Best Software Tool",
        caption: "The operator interface for the BR-01 reactor, and the test for calling it a digital twin." },
      { title: "Protein Design",          slug: "protein-design",
        caption: "Five steps from a peptide family alignment to a DNA order." },
      { title: "Dry Lab Notebook",        slug: "drylab-notebook",
        caption: "The computational record, week by week." }
    ]
  },
  {
    id: "engagement",
    name: "Engagement",
    blurb: "Who we talked to and what changed because of it, what we taught, the rules a product would have to meet, and where in Taiwan the need is.",
    pages: [
      { title: "Integrated Human Practices", slug: "human-practices",      award: "Silver #2 · Best IHP",
        caption: "The people who changed the project, and what they changed about it." },
      { title: "Education",                  slug: "education",            award: "Best Education",
        caption: "Five schools, three age groups, one lesson rebuilt four times." },
      { title: "Entrepreneurship",           slug: "entrepreneurship",     award: "Best Entrepreneurship",
        caption: "Who would own a ReLeaf unit, who pays for it, and what it costs." },
      { title: "Sustainability",             slug: "sustainability",       award: "Best Sustainable Development",
        caption: "Four SDGs argued at target level, and where ReLeaf works against them." },
      { title: "Laws and Regulations",       slug: "laws-and-regulations",
        caption: "How the protectant would be classified in Taiwan, the EU and the US." },
      { title: "Geospatial Analysis",        slug: "geospatial-analysis",
        caption: "Nineteen counties and 2.79 million farm parcels, mapped against climate stress." },
      { title: "Data Physicalization",       slug: "data-physicalization",
        caption: "A stress map of Taiwan wired with LEDs, and a drought-stressed plant you can hear." }
    ]
  },
  {
    id: "team",
    name: "Team",
    blurb: "The students, advisors and instructors, who did which part, the year in order, and the photographs.",
    pages: [
      { title: "Members",     slug: "team",
        caption: "The students, advisors and instructors who built ReLeaf." },
      { title: "Attribution", slug: "attributions", award: "Bronze #2",
        caption: "Who did what, and who helped us do it." },
      { title: "Milestone",   slug: "milestone",
        caption: "The year in order, from the first meeting to the freeze." },
      { title: "Gallery",     slug: "gallery",
        caption: "The year in photographs, each linked to the page it comes from." }
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
    caption: "Who the project is built for, and who it would leave out." },

  /* The two pages below used to be Dry Lab tabs of their own. Since
     23 September 2026 they are steps inside Protein Design, reached from
     /protein-design/. Their addresses have not changed, so every existing
     link and every footer entry still resolves. */
  { title: "MD Simulations", slug: "md-simulations",
    caption: "Step F of the pipeline. Nine trajectories of BoPep4 on its receptor." },
  { title: "Peptide Design", slug: "peptide-design",
    caption: "The worked case. BoPep4 run end to end, including what we retracted." }
];

/* iGEM rule check (assets/js/rulecheck.js): outlines on every page whatever
   would break an iGEM 2026 wiki rule, with a panel listing them. It is a
   teaching aid for this demo copy. Set to false in the copy that goes to
   gitlab.igem.org, or delete the line and the file.                        */
window.RULECHECK = true;

/* Review notes (assets/js/review-notes.js): the writing review left at the
   end of each section on 25 September 2026. Set to false, or delete the
   <aside class="review-note"> blocks, in the copy that goes to gitlab.igem.org. */
window.REVIEW_NOTES = true;
