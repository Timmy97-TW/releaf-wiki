/* =============================================================================
   ReLeaf: Project Evolution Map: data
   -----------------------------------------------------------------------------
   One object, window.EVOMAP, read by evomap.js. Nothing here is rendered
   directly; every string below is content, and every claim in it is traceable
   to one of four sources, named in the `source` field of the record that
   carries it:

     LOG    the team's written interview log (IHP Wiki.docx, "Expert
            Engagement / Roadmap Content"), authoritative for dates, key
            suggestions and the Action(Previously) / Action(New Adapt) pairs.
     ROAD   the long-form draft of the same records (IHP-complete information
            for the evolution roadmap.html), used where it phrases a takeaway
            more completely than the log.
     PLANT  wiki/plant/index.html, the plant screening page, which writes up
            the advisory threads for Prof. Cheng, Dr. Kyle, Dr. Verslues and
            CH Biotech with dates.
     HW     wiki/hardware/ notebook, which dates the pivot document, the
            bioreactor prototypes and Prof. Chang's consultation.

   Where a source is silent the field is left empty and the map says so on the
   node. Nothing is filled in by inference. Four specifics that appear in the
   earlier roadmap draft (a 0.22 um membrane pore, a 14-day acclimation, an
   "uncontained open-release spray" starting point, and several role titles)
   are not carried here, because no source above supports them; the hardware
   notebook records the pore we actually bought as 0.2 um.

   ---------------------------------------------------------------------------
   SCHEMA

   meta        { start, end, title, standfirst, startState, endState, note }
               start/end are ISO dates and set the time axis domain.

   lanes       [{ id, name, gutter, blurb }]
               id        used by laneStates[].lane, engagements[].lanes, builds[].lane
               gutter    short label drawn in the plate's left margin
               blurb     one line for the key and the filter chip title

   laneStates  [{ lane, from, label, note, by, source }]
               One lane's state line changes label at each entry. The entry
               whose `from` equals meta.start is the state we began with.
               by        engagement id that caused the change (null for the
                         starting state)

   engagements [{ id, date, dateNote, name, zh, kind, role, where, lanes,
                  quote, suggestion, summary, before[], after[], takeaways[],
                  photos[{src,alt,prov}], links[{label,href}], source,
                  recurring, pending }]
               lanes     the project areas this engagement changed. The map
                         draws one decision mark per lane, stitched together.
               quote     only present where a source records the words.
               pending   true where the log entry is empty and the write-up is
                         still owed. The node is drawn open and says so.
               recurring true for a standing advisory relationship; the node
                         carries the one dated entry our sources fix.

   builds      [{ id, date, dateNote, lane, label, note, source, approx, links[] }]
               What we made between visits. Drawn as a small open mark on the
               lane. approx:true means the sources do not date it and the
               position is a placeholder, drawn dashed and labelled as such.

   loops       [{ id, person, zh, count, visits[], headline, between[],
                  buildIds[], depth, source }]
               A person or organisation we went back to. visits are engagement
               ids in date order; between[] is what we built in the gap, in
               prose, and buildIds[] names the build records to list with it;
               depth
               is the one sentence on how the second reading went deeper than
               the first.

   stations    [{ id, glyph, glyphNote, name, dates, lede, ids[] }]
               glyph is the shape the station is drawn as (box, flask, leaf,
               drop, bubble; the drawings are in evomap.js) and glyphNote the
               one line under the map that says why.
               The map is drawn as five stations in date order, one per phase
               of the project: a path of faces on the left, one engagement's
               card on the right, and its four photographs underneath. ids[]
               lists the engagements in each station, in date order.

   LENGTH STANDARD (trimmed 25 September so every card reads the same)
               headline    12 words or fewer, what the meeting settled
               summary     30 words or fewer, why we went and what happened
               suggestion  25 words or fewer
               takeaways   3 at most, 20 words or fewer each
               after       3 at most, 14 words or fewer each
               before      3 at most
               evidence    exactly 4 photographs, captions 14 words or fewer

   chains      [{ id, from{type,id}, to{type,id}, label, note, source }]
               A referral: one engagement sent us to the next thing. type is
               "engagement" or "build". Drawn in amber, per the design set's
               rule that amber means a crossing and green means a thread.
   ========================================================================== */

window.EVOMAP = (function () {
  "use strict";

  var lanes = [
    { id: "plant",   name: "Plant model",            gutter: "PLANT / MODEL",      blurb: "The species, the growth system and the stress dose the screen runs at." },
    { id: "protect", name: "Protectant",             gutter: "PROTECTANT",         blurb: "What the bacteria are asked to make, and what has to be proven about it." },
    { id: "circuit", name: "Circuit and cloning",    gutter: "CIRCUIT / CLONING",  blurb: "The gene circuit in B. subtilis and the cloning route into it." },
    { id: "reactor", name: "Bioreactor and biosafety", gutter: "REACTOR / SAFETY", blurb: "The vessel, the membrane, and which layer carries containment." },
    { id: "model",   name: "Modelling and AIoT",     gutter: "MODEL / AND AIOT",   blurb: "The maths model, the sensors, and how the two meet the bench." },
    { id: "deploy",  name: "Deployment and farmers", gutter: "FARMERS / AND FIELD",blurb: "Who uses this, what it costs them, and what they asked us for." }
  ];

  /* ------------------------------------------------------------ LANE STATES */

  var laneStates = [
    /* plant */
    { lane: "plant", from: "2026-03-10", by: null, label: "Medicago, whole plant",
      note: "The plan we brought to our first interview: Medicago truncatula as the target, bacteria evaluated on the whole plant.",
      source: "LOG, Dr. Lin 19 March, Action(Previously)" },
    { lane: "plant", from: "2026-03-27", by: "e02", label: "Arabidopsis, agar then soil",
      note: "Arabidopsis thaliana as the model, grown on agar plates for early control and transferred to soil afterwards. Hydroponics stops being the main system.",
      source: "LOG + ROAD, Prof. Cheng 27 March" },
    { lane: "plant", from: "2026-06-20", by: "e10", label: "Salt dose and timing series",
      note: "The screen stops testing one condition and starts testing a dose ladder against treatment timing, so the model has a dose-response relationship to work from.",
      source: "LOG, Prof. Chen 20 June, Action(New Adapt)" },
    { lane: "plant", from: "2026-08-28", by: "e20", label: "10 to 20 day seedlings, transfer",
      note: "Plants are old enough to have true leaves before stress starts, salt is capped at 200 mM for that age, and treatment is applied by moving plants to fresh plates instead of spraying them.",
      source: "PLANT, Prof. Cheng's rulings written up 2 September" },

    /* protectant */
    { lane: "protect", from: "2026-03-10", by: null, label: "Supply trehalose and ACC deaminase",
      note: "The first design had the bacteria supplying protective compounds directly, with signal molecules keeping the bacteria alive under stress.",
      source: "LOG, Dr. Verslues 3 April, Action(Previously)" },
    { lane: "protect", from: "2026-04-03", by: "e03", label: "Prime the plant's own response",
      note: "Work with the plant's own drought response using bacterial signals and precursors, and prioritise early detection over rescue after the fact.",
      source: "LOG, Dr. Verslues" },
    { lane: "protect", from: "2026-06-27", by: "e11", label: "Prove the protectant first",
      note: "Purified protectant goes on plants on its own before anything is integrated into the bioreactor. One stress, done well.",
      source: "LOG, Dr. Sattely 27 June" },
    { lane: "protect", from: "2026-07-09", by: "e13", label: "Peptides, screened and truncated",
      note: "Computational screening, protective motifs and truncated peptide constructs enter the candidate list next to trehalose and ACC deaminase.",
      source: "LOG, CH Biotech 9 July; Prof. Huang 6 August" },
    { lane: "protect", from: "2026-09-12", by: "e25", label: "Show ACCD is made and secreted",
      note: "The claim to defend is no longer that a protectant helps a plant. It is that our bacteria produce and secrete ACCD, with controls that rule out the alternatives.",
      source: "LOG, Dr. Sattely and Prof. Endy 12 September" },

    /* circuit */
    { lane: "circuit", from: "2026-03-10", by: null, label: "Bacteria sense the soil themselves",
      note: "The bacteria were to sense stress in the soil and respond on their own, with a kill switch to stop them surviving outside the incubator.",
      source: "LOG, Dr. Lin 19 March, Action(Previously)" },
    { lane: "circuit", from: "2026-04-10", by: "e04", label: "Sensor and light gate the cells",
      note: "Electronics do the sensing and light carries the instruction into a closed chamber. The pivot document went up five days after this meeting.",
      source: "LOG, Prof. Chen 10 April; HW, pivot document 15 April" },
    { lane: "circuit", from: "2026-07-28", by: "e16", label: "Dense pellets, reporter verified",
      note: "Electroporation moves to dense cell pellets and larger DNA, with vector-control and no-plasmid groups, and the green reporter checked in B. subtilis before anything is claimed.",
      source: "LOG, Prof. Huang 28 July" },
    { lane: "circuit", from: "2026-08-06", by: "e17", label: "Identity and activity, not secretion",
      note: "Secretion on its own proves nothing if the protein is inactive. Quantity, identity, solubility and function are evaluated together.",
      source: "LOG + ROAD, Prof. Huang 6 August" },

    /* reactor */
    { lane: "reactor", from: "2026-03-10", by: null, label: "Soil release, kill switch as guard",
      note: "Engineered bacteria were to go into the soil and release protectant there, with a genetic kill switch as the safeguard.",
      source: "LOG, Dr. Lin and Dr. Brophy, Action(Previously); HW week 04" },
    { lane: "reactor", from: "2026-04-10", by: "e04", label: "Contained vessel, cartridge refill",
      note: "Soil sensing is dropped, the bacteria move into a contained vessel, and the business model moves to the consumable: sell the cartridge, not the box.",
      source: "LOG, Prof. Chen 10 April; HW week 04" },
    { lane: "reactor", from: "2026-04-18", by: "e05", label: "Containment is the primary layer",
      note: "Physical containment becomes the biosafety mechanism we rely on, with a semi-permeable membrane that holds bacteria in and lets protectant out. Whether a kill switch is still needed on top becomes a separate question.",
      source: "LOG, Dr. Brophy 18 April" },
    { lane: "reactor", from: "2026-06-18", by: "e09", label: "Valve after membrane, foam broken",
      note: "There was no mechanism at all for getting protectant out of the membrane. A valve after the membrane builds pressure and pushes permeate through, and foaming is handled by breaking bubbles mechanically.",
      source: "LOG, Prof. Chang 18 June; HW weeks 16 and 23" },
    { lane: "reactor", from: "2026-09-04", by: "e21", label: "Leak at rest, capsule and AIoT",
      note: "Protectant and bacteria cross the hollow fibre with no driving force applied, which is an open problem. Usability joins performance as a design target: a replaceable bacterial capsule and AIoT control.",
      source: "LOG, Prof. Chang 4 September" },

    /* model */
    { lane: "model", from: "2026-03-10", by: null, label: "Model and bench run apart",
      note: "The mathematical model and the experimental system were developed as separate components.",
      source: "LOG, Prof. Chen 20 June, Action(Previously)" },
    { lane: "model", from: "2026-04-10", by: "e04", label: "Input to output defined",
      note: "A clear input to output mapping for the hardware, and dry-lab modelling and calibration strengthened behind it.",
      source: "LOG, Prof. Chen 10 April" },
    { lane: "model", from: "2026-06-20", by: "e10", label: "One loop: model, bench, database",
      note: "Every model is refined by experimental validation, and the ReLeaf database holds the experimental data that feeds it.",
      source: "LOG, Prof. Chen 20 June" },
    { lane: "model", from: "2026-07-28", by: "e16", label: "Forecast and sensors, run periodically",
      note: "pH and moisture sensing joins weather forecasting so stress is predicted early, and the reactor runs when stress hits, not around the clock.",
      source: "LOG, Prof. Huang 28 July" },
    { lane: "model", from: "2026-08-11", by: "e19", label: "Oxygen measured, not assumed",
      note: "Dissolved oxygen, and possibly OD, enter the parameter set, and the question of whether sensor data can tell one stress from another is written down as a task.",
      source: "LOG, BIO Asia 18 July and Yes Health iFarm 11 August" },

    /* deploy */
    { lane: "deploy", from: "2026-03-10", by: null, label: "Local market, abiotic stress",
      note: "The plan addressed abiotic stress for a local market, with the device as the product.",
      source: "LOG, Prof. Chen 10 April and Farmer Expo 16 May, Action(Previously)" },
    { lane: "deploy", from: "2026-04-10", by: "e04", label: "Global market, printer and ink",
      note: "The local market is too small to carry the revenue. The hardware is the printer and the biofertilizer is the ink, and a competitive analysis follows.",
      source: "LOG, Prof. Chen 10 April" },
    { lane: "deploy", from: "2026-05-16", by: "e06", label: "Affordable, and biotic stress too",
      note: "Smallholders need something affordable, accessible and practical. Pests and pathogens matter to them as much as heat and drought, so biotic stress enters the scope.",
      source: "LOG, Farmer Expo 16 May" },
    { lane: "deploy", from: "2026-07-21", by: "e15", label: "Farmer tools first, seed exchange",
      note: "Before the reactor reaches a field, the practice work is the LINE assistant and the seed exchange platform that farmers asked for.",
      source: "LOG, Ms. Chen 21 July; PLANT, seed platform prototyped two days later" },
    { lane: "deploy", from: "2026-09-05", by: "e22", label: "Answering farmers in the room",
      note: "Fifty people in one room, and two questions we had not prepared for: does using the bioreactor affect organic certification, and how many units does one farm need.",
      source: "LOG, Public Forum" }
  ];

  /* ------------------------------------------------------------ ENGAGEMENTS */

  var W = function (label, href) { return { label: label, href: href }; };

  var engagements = [
    {
      id: "e01", date: "2026-03-19",
      face: "face-lin",
      evidence: [
        { src: "exp-0319-lin", cap: "19 March. The online interview with Dr. Lin (first tile)." },
        { src: "ev-first-agar", cap: "12 April. Our first Arabidopsis on agar, after her question about Medicago." },
        { src: "ev-hydro-boxes", cap: "13 June. The hydroponic boxes she suggested." },
        { src: "ev-hollow-fibre", cap: "25 April. The membrane sketch that replaced the kill switch." }
      ],
      name: "Dr. Lin", zh: "林維怡", kind: "expert",
      headline: "The first interview put Medicago and the kill switch in doubt",
      role: "Plant and stress biology",
      lanes: ["plant", "circuit", "reactor"],
      suggestion: "Assess the real-world applicability and value of the system, and research more suitable plants for the project.",
      summary: "Our first interview, while the plant model and the stress method were still open. We went in with Medicago and a kill switch; both came out in doubt.",
      takeaways: [
        "Measure what PGPR does to germination speed and early growth, treated against untreated seedlings.",
        "Simulate drought with particles that block water uptake, and salinity by watering every few days."
      ],
      before: ["Design a kill switch so cells cannot survive outside the incubator", "Medicago truncatula as the target plant"],
      after: ["Reconsider whether a kill switch is needed at all", "Reconsider the target plant", "Consider hydroponics and seedling-stage testing"],
      photos: [{ src: "exp-0319-lin.webp", alt: "The team in an online meeting with Dr. Lin, March 2026." }],
      links: [W("Plant screening record", "../plant/"), W("Safety and security", "../safety-and-security/")],
      source: "LOG + ROAD"
    },
    {
      id: "e02", date: "2026-03-27",
      face: "face-cheng",
      evidence: [
        { src: "ev-cheng-plates", cap: "27 March. Prof. Cheng showing Arabidopsis on agar at NTU." },
        { src: "ev-cheng-seeds", cap: "The seed she gave us, on its way to our lab." },
        { src: "ev-cheng-boxes", cap: "Her hydroponic boxes. We copied the design in June." },
        { src: "ev-first-agar", cap: "12 April. Our first plates, sown on her protocol." }
      ],
      name: "Prof. Cheng", zh: "鄭梅君", kind: "expert",
      headline: "Arabidopsis on agar first, soil after, and seed to start",
      role: "Plant and stress biology, NTU", where: "Her laboratory at NTU",
      lanes: ["plant"],
      suggestion: "Move the plant model to Arabidopsis thaliana, grown on agar plates first for control, then transferred to soil.",
      summary: "We arrived with no plants and no protocol. She confirmed heat, salinity and drought as the stresses, warned that hydroponics alone was unstable, and gave us seed.",
      takeaways: [
        "Our own procedure can interfere with the stress response we are measuring.",
        "Control environmental transitions and stress timing, and use ROS staining to see stress.",
        "Osmotic stress leaves the target list."
      ],
      before: ["Heat, salinity, drought and osmotic stress as targets", "Hydroponics as the proof-of-concept system"],
      after: ["Moderate stress, so plants survive the test", "Hydroponics no longer the main system", "A plate-to-soil transition model"],
      links: [W("Plant screening record", "../plant/")],
      source: "LOG + ROAD + PLANT"
    },
    {
      id: "e03", date: "2026-04-03", dateNote: "The interview log dates this 3 April; the plant page dates the same visit to Academia Sinica 4 April. Both are ours and they disagree.",
      evidence: [
        { src: "ev-verslues-rack", cap: "4 April, Academia Sinica. His vertical plate rack." },
        { src: "ev-vertical-start", cap: "16 June. Our own vertical plates, set up the same way." },
        { src: "ev-vertical-wrong", cap: "17 June. A rack loaded the wrong way round." },
        { src: "ev-float-plate", cap: "The float plate we built from what we saw there." }
      ],
      name: "Dr. Paul Verslues", zh: "", kind: "expert",
      headline: "Work with the plant's own drought response",
      role: "Plant stress biology and protectant design", where: "Academia Sinica",
      lanes: ["plant", "protect"],
      suggestion: "Work with the plant's natural response instead of supplying more proline.",
      summary: "A session on drought mechanics and proline delivery. It moved the protectant from supplying compounds to regulating the plant's own response.",
      takeaways: [
        "Optimise the proline dose, and check that bacterial products leave the plant's proline cycle alone.",
        "Try stress priming, measure root growth and biomass, and detect stress early.",
        "His vertical plate rack became ours, and the August soil salt ramp was his proposal."
      ],
      before: ["Bacteria sense four stresses and respond with trehalose and ACC deaminase", "Signal molecules keep the bacteria alive under stress"],
      after: ["Move from proline delivery to plant regulation with bacterial signals", "Test stress priming, tracking root growth and biomass"],
      links: [W("Plant screening record", "../plant/")],
      source: "LOG + ROAD + PLANT"
    },
    {
      id: "e04", date: "2026-04-10",
      face: "face-chen",
      evidence: [
        { src: "exp-0410-chen", cap: "10 April. The online meeting with Prof. Chen (top left)." },
        { src: "ev-averra-poster", cap: "His example: hardware as the printer, the product as the ink." },
        { src: "ev-pivot-doc", cap: "15 April. The pivot: bacteria in a vessel, light switching them on." },
        { src: "ev-hollow-fibre", cap: "25 April. The hollow fibre design that followed." }
      ],
      name: "Prof. Chen", zh: "陳文亮", kind: "expert",
      headline: "Leave the soil, contain the bacteria, sell the consumable",
      role: "AIoT and smart agriculture, founder of Agritalk", where: "Online",
      lanes: ["circuit", "reactor", "model", "deploy"],
      keyPoint: "Design the hardware as the printer and the biofertilizer as the ink.",
      suggestion: "Define a clear input to output mapping, and move to a bioreactor-based system instead of soil release.",
      summary: "The meeting that changed the project's shape. He sells into the smart-agriculture market we aimed at, and told us to leave the part we could not win.",
      takeaways: [
        "Drop soil moisture sensing: cheap sensors own that market, and calibration takes months per soil type.",
        "Bacteria released into open soil are a far harder biosafety case than bacteria in a vessel.",
        "The local market is too small; adoption, fertiliser, market size and regulation are the obstacles."
      ],
      before: ["B. subtilis detects plant stress in soil and produces stress-priming protectants there"],
      after: ["A controlled bioreactor that activates B. subtilis on stress signals", "A clear input-to-output mapping, and stronger dry-lab modelling", "Sell the consumable, not the device, after a competitive analysis"],
      photos: [{ src: "exp-0410-chen.webp", alt: "Online meeting with Prof. Chen, 10 April 2026." }],
      links: [W("Hardware notebook", "../hardware/"), W("Modelling", "../model/"), W("Entrepreneurship", "../entrepreneurship/")],
      source: "LOG + ROAD + HW"
    },
    {
      id: "e05", date: "2026-04-18",
      face: "face-brophy",
      evidence: [
        { src: "exp-0418-brophy", cap: "18 April. Dr. Brophy (first tile) reviewing our interface options." },
        { src: "ev-first-hardware", cap: "The first hardware drawing, the same week." },
        { src: "ev-hollow-fibre", cap: "25 April. Cells on one side of a membrane." },
        { src: "ev-reactor-run", cap: "20 July. The reactor running with that membrane fitted." }
      ],
      name: "Dr. Jennifer Brophy", zh: "", kind: "expert",
      headline: "Containment becomes the primary safety layer",
      role: "Gene circuit design, protectant design, bioreactor hardware",
      lanes: ["protect", "circuit", "reactor"],
      keyPoint: "Physical containment should be the primary safety mechanism, rather than relying only on a kill switch.",
      suggestion: "Treat physical containment as the primary biosafety mechanism and design a membrane that retains bacteria while letting protectant through.",
      summary: "The second expert in a month to question the kill switch. Dr. Lin had asked whether it was needed; Dr. Brophy named why it could not be what we relied on.",
      takeaways: [
        "A biological kill switch alone is not a reliable guard against environmental harm.",
        "A semi-permeable membrane can hold the organism and still deliver the product."
      ],
      before: ["A kill switch to prevent B. subtilis leaking into the environment", "Bioreactor v1 designed"],
      after: ["Physical containment first, with a kill switch evaluated as an addition", "A semi-permeable membrane that keeps bacteria in and lets protectant out"],
      photos: [{ src: "exp-0418-brophy.webp", alt: "Online meeting with Dr. Jennifer Brophy, 18 April 2026." }],
      links: [W("Safety and security", "../safety-and-security/"), W("Hardware notebook", "../hardware/")],
      source: "LOG + ROAD"
    },
    {
      id: "e06", date: "2026-05-16",
      face: "farm-expo-2",
      evidence: [
        { src: "ev-expo-interview", cap: "16 May. Asking stallholders what goes wrong." },
        { src: "ev-market-may", cap: "Weather, water and price came up before salt." },
        { src: "farm-expo-1", cap: "Growers explaining their losses at the stall." },
        { src: "ev-line-prototype", cap: "11 July. The first LINE screens, built for these farmers." }
      ],
      name: "Farmer Expo, Taipei", zh: "花博農民市集", kind: "farm",
      headline: "Farmers named weather, water and price before salt",
      role: "Smallholder and organic farmers", where: "Taipei",
      lanes: ["deploy"],
      quote: "Small-scale farmers need solutions that are affordable, accessible and practical for their farms.",
      suggestion: "Build for the farm that exists, at a price it can carry.",
      summary: "We asked stallholders what goes wrong in their fields. Nobody started with salt: weather came first, then water, then the price of every fix.",
      takeaways: [
        "Pests, pathogens, water shortage and unpredictable weather are the named problems.",
        "Farmers told us how they feel about technology in the field, which the business plan had to answer.",
        "Useful information sits on government pages and never reaches them. The LINE assistant starts here."
      ],
      before: ["Abiotic stress only"],
      after: ["Cover biotic as well as abiotic stress"],
      photos: [{ src: "farm-expo-group.webp", alt: "The team with farmers at the Taipei farmers' expo, 16 May 2026." }],
      links: [W("Farmer engagement and the LINE platform", "../human-practices/"), W("Entrepreneurship", "../entrepreneurship/")],
      source: "LOG + ROAD + PLANT"
    },
    {
      id: "e07", date: "2026-05-22",
      face: "face-worldveg",
      evidence: [
        { src: "exp-0522-worldveg", cap: "22 May. The online meeting with the World Vegetable Center." },
        { src: "ev-heat-panel", cap: "Heat stress stayed in the plant screen, as they advised." },
        { src: "ev-reactor-run", cap: "Environmental safety as a requirement: the bacteria stay inside." },
        { src: "ev-lab-safety", cap: "The biosafety cabinet all culture work now goes through." }
      ],
      name: "World Vegetable Center", zh: "", kind: "company",
      headline: "Acceptance depends on showing environmental safety and benefit",
      role: "Smallholder farming and climate resilience",
      lanes: ["deploy"],
      suggestion: "",
      summary: "What smallholder farming is up against: climate resilience, and biotic and abiotic stress together. The log records no single quoted suggestion.",
      takeaways: [
        "Traditional and natural farmers accept what is shown to be safe, beneficial and sustainable.",
        "GMO regulation needs research of its own before we claim no environmental harm."
      ],
      before: [],
      after: ["Lean toward a sustainable farming label", "Stay on heat stress; the others are harder to combat well", "For pathogens, consider sensing root pressure"],
      photos: [{ src: "exp-0522-worldveg.webp", alt: "Meeting with the World Vegetable Center, 22 May 2026." }],
      links: [W("Entrepreneurship", "../entrepreneurship/"), W("Safety and security", "../safety-and-security/")],
      source: "LOG + ROAD"
    },
    {
      id: "e08", date: "2026-06-17", recurring: true,
      face: "face-kyle",
      evidence: [
        { src: "ev-kyle-bench", cap: "Dr. Kyle at our bench, where the plate rules were set." },
        { src: "ev-kyle-inspect", cap: "31 May. His lab inspection." },
        { src: "ev-contamination", cap: "17 June. A contaminated plate: excluded whole." },
        { src: "ev-hydro-dead", cap: "23 July. A failed hydroponic run, taken apart." }
      ],
      dateNote: "A standing thread, not a single meeting. The plant page records advice weekly from June; 17 June is the dated entry, and the July ruling on the salt ceiling is in the same thread.",
      name: "Dr. Kyle", zh: "", kind: "expert",
      headline: "The rules the plant screen still runs on",
      role: "Plant screening advisor, weekly from June",
      lanes: ["plant"],
      suggestion: "Never top up evaporated medium: the water leaves, the salt stays, and the concentration rises.",
      summary: "A weekly advisor from June. Almost every correction on the plant page traces back to this thread.",
      takeaways: [
        "A contaminated plate is excluded whole, not seedling by seedling.",
        "Plot chlorophyll with and without fresh-weight normalisation; that is how the artefact became visible.",
        "Chlorine-gas seed sterilisation, advised in June and not applied consistently. It cost us a trial."
      ],
      before: ["Two-day stratification, 1% agar, medium topped up when it evaporated"],
      after: ["Four-day stratification from July", "Exclusion rules written down and applied", "Salt screened at 75 and 100 mM, below the 200 mM ceiling"],
      links: [W("Plant screening record", "../plant/")],
      source: "PLANT. This thread is not in the interview log; it is written up on the plant page."
    },
    {
      id: "e09", date: "2026-06-18",
      face: "face-chang",
      evidence: [
        { src: "ev-chang-visit", cap: "18 June. Prof. Chang on flow, foaming and pressure." },
        { src: "ev-chang-visit2", cap: "The same afternoon, through the reactor design." },
        { src: "ev-pressure-live", cap: "12 July. Pressure on a screen for the first time." },
        { src: "ev-pinch-valve", cap: "7 August. The pinch valve, printed and tested." }
      ],
      name: "Prof. Chang", zh: "張嘉修", kind: "expert",
      headline: "No way to get protectant out of the membrane",
      role: "Biomanufacturing and bioreactor engineering, chair professor of chemical engineering",
      where: "He visited the team",
      lanes: ["reactor"],
      suggestion: "Put a valve after the membrane to build pressure and push the permeate through.",
      summary: "He has published on B. subtilis bioreactors and spent longer on containment than on the biology. He found a hole none of us had seen.",
      takeaways: [
        "We could not yet explain to a judge why hollow fibre specifically.",
        "Foaming from B. subtilis surfactant needs a mechanical bubble breaker.",
        "Flow rate and transmembrane pressure show when the membrane is caking."
      ],
      before: ["No mechanism for moving protectant out of the membrane", "No valve on any plan"],
      after: ["A stepper pinch valve posted the next day, with a 27 June target", "Monitor flow rate and transmembrane pressure", "Break foam mechanically"],
      links: [W("Hardware notebook", "../hardware/")],
      source: "LOG + ROAD + HW week 16"
    },
    {
      id: "e10", date: "2026-06-20",
      face: "face-chen",
      evidence: [
        { src: "ev-chen-reactor", cap: "20 June. The reactor, gone through with the team." },
        { src: "ev-chen-model", cap: "The modelling session: connect the model to the bench." },
        { src: "ev-chen-autofill", cap: "The auto-filling reservoir he took apart. Never built." },
        { src: "ev-math-sketch", cap: "15 August. The model, built to take wet-lab data back." }
      ],
      name: "Prof. Chen", zh: "陳文亮", kind: "expert",
      headline: "Model and bench have to feed each other",
      role: "AIoT and smart agriculture, founder of Agritalk", where: "He visited the team",
      lanes: ["plant", "reactor", "model", "deploy"],
      suggestion: "Connect the experimental data to the model, identify the inputs and outputs, and refine every model through experimental validation.",
      summary: "His second visit, across the model, plants, protectant, hydroponics, circuit and reactor at once. He took apart the auto-filling reservoir we had drawn.",
      takeaways: [
        "Modelling and wet lab need a real feedback loop, not a one-way handoff.",
        "The ReLeaf database can hold the experimental data for later optimisation.",
        "Visit Yes Health iFarm to understand hydroponic deployment."
      ],
      before: ["Model and experimental system developed separately", "Plant responses tested under a limited set of conditions", "Bioreactor judged only on whether it made protectant"],
      after: ["A feedback loop between model and bench", "Salt concentration tested against treatment duration", "Longer reactor runs, with dissolved oxygen monitored"],
      photos: [{ src: "exp-0410-chen-b.webp", alt: "Prof. Chen reviewing the team's slides." }],
      links: [W("Modelling", "../model/"), W("Plant screening record", "../plant/"), W("Hardware notebook", "../hardware/")],
      source: "LOG + ROAD + PLANT"
    },
    {
      id: "e11", date: "2026-06-27",
      face: "face-sattely",
      evidence: [
        { src: "exp-0627-sattely", cap: "27 June. The online interview on our bioreactor concept." },
        { src: "ev-chbio-bottle", cap: "The protectant we then tested on plants directly." },
        { src: "ev-plant-transplant", cap: "4 August. Transplanting seedlings for the protectant trials." },
        { src: "ev-plate-inspect", cap: "22 August. Reading the plates from those trials." }
      ],
      name: "Dr. Elizabeth Sattely", zh: "", kind: "expert",
      headline: "Prove the protectant on plants before building it in",
      role: "Protectant design, Stanford",
      lanes: ["protect"],
      keyPoint: "Validation of the protectant itself before integrating it into the full system.",
      suggestion: "Test the purified protectant directly on plants, and pick one stress and do it well.",
      summary: "She was direct that our proof of concept might not hold, and that goals and milestones had to be written down before building further.",
      takeaways: [
        "Define the goals, the milestones and why the solution matters, before building further.",
        "One stress done well beats several done at surface level.",
        "Other molecule types are worth exploring, peptides among them."
      ],
      before: ["Protectant production integrated into the bioreactor before the protectant itself was validated"],
      after: ["Test purified protectant directly on plants", "Set clearer goals, milestones and measurable outcomes", "Let the plant assay decide whether a protectant enters the reactor"],
      photos: [{ src: "exp-0627-sattely.webp", alt: "Online meeting with Dr. Elizabeth Sattely, 27 June 2026." }],
      links: [W("Plant screening record", "../plant/"), W("Engineering record", "../engineering/")],
      source: "LOG + ROAD"
    },
    {
      id: "e12", date: "2026-07-07",
      face: "logo-greenmedia",
      evidence: [
        { src: "ev-forum-prep", cap: "29 August. Forum preparation, a week out." },
        { src: "forum-dsc-75", cap: "5 September. The discussion format they advised." },
        { src: "forum-dsc08502", cap: "A grower taking the microphone." },
        { src: "booth-coffee", cap: "The coffee and cocoa event we joined with Green Media." }
      ],
      name: "Green Media", zh: "", kind: "company",
      headline: "Farmers need room to raise problems we did not expect",
      role: "Agricultural media",
      lanes: ["deploy"],
      suggestion: "",
      summary: "The agricultural and the media view together: people from different backgrounds see farming differently, and an event has to run with that in mind.",
      takeaways: [
        "Outreach is how the science reaches smallholder farmers at all.",
        "Farmers may bring problems we have not anticipated; the event needs room for them."
      ],
      before: ["A public forum where participants share experiences, challenges and research"],
      after: ["A discussion session where every participant talks, not only listens"],
      photos: [{ src: "logo-greenmedia.webp", alt: "Green Media's logo." }],
      links: [W("Public engagement", "../human-practices/")],
      source: "LOG + ROAD"
    },
    {
      id: "e13", date: "2026-07-09",
      face: "ev-chbio-wall",
      evidence: [
        { src: "ev-chbio-wall", cap: "9 July. Their research wall and finished bottles." },
        { src: "ev-chbio-group", cap: "With the CH Biotech researchers." },
        { src: "ev-chbio-rules", cap: "Their regulatory specialist on registering a biostimulant." },
        { src: "ev-chbio-bottle", cap: "富肽2號 on its way to our lab. It became set 7." }
      ],
      name: "CH Biotech", zh: "正瀚生技", kind: "company",
      headline: "Delivery method and cost per area decide what is usable",
      role: "Biostimulant development and regulation", where: "Their site, with Prof. Chen present",
      lanes: ["plant", "protect", "deploy"],
      keyPoint: "Different crops and protectants require different application methods.",
      suggestion: "Show better plant performance under heat or drought, measured several ways, and confirm Taiwanese regulation first.",
      summary: "Their researchers walked us past their published work and finished products, and their regulatory specialist explained registering a biostimulant. We left with a peptide to test.",
      takeaways: [
        "Root irrigation, foliar spray and drone spray are not interchangeable; crop and protectant decide.",
        "Production cost per area covered decides whether a method is usable.",
        "Computational screening and truncated peptides are a route to better candidates."
      ],
      before: ["A bioreactor that produces and delivers protectants under different stress conditions, in general"],
      after: ["Compare delivery methods and cost per area", "Screen protectant candidates computationally", "Research Taiwan's biostimulant regulation"],
      links: [W("Plant screening record", "../plant/"), W("Entrepreneurship", "../entrepreneurship/")],
      source: "LOG + ROAD + PLANT"
    },
    {
      id: "e14", date: "2026-07-18",
      face: "ev-bioasia-booth",
      evidence: [
        { src: "ev-bioasia-booth", cap: "18 July. A hollow fibre setup at the exhibition." },
        { src: "ev-bioasia-reactor", cap: "A commercial reactor with oxygen control." },
        { src: "ev-do-sensors", cap: "5 August. Dissolved oxygen and pH sensors on our bench." },
        { src: "ev-hay-infusion", cap: "3 August. Hay infusion, the agricultural waste idea." }
      ],
      name: "BIO Asia-Taiwan Exhibition", zh: "", kind: "event",
      headline: "Oxygen matters as much as containment",
      role: "Companies, experts and researchers across biotechnology",
      lanes: ["protect", "reactor", "deploy"],
      suggestion: "",
      summary: "Stress tolerance depends on how protective molecules are regulated and used, as well as whether they are present. Oxygen came home as the main question.",
      takeaways: [
        "B. subtilis needs dissolved oxygen monitoring and active aeration; passive containment is not enough.",
        "An oxygen sensor with a feedback loop moves up the priority list.",
        "Some validation must move from agar and hydroponics into soil, with larger samples."
      ],
      before: ["Sensor to microcontroller to production, delivered by pipeline and spray", "Farmers buy the reactor once and replace the bacteria yearly", "Protectant candidates: ACCD, LEA14, BoPep4"],
      after: ["Prioritise an oxygen sensor and its feedback loop", "Consider delivery through the irrigation system", "Research GMO rules in Taiwan, the Philippines, Malaysia and the EU"],
      links: [W("Hardware notebook", "../hardware/"), W("Entrepreneurship", "../entrepreneurship/")],
      source: "LOG + ROAD"
    },
    {
      id: "e15", date: "2026-07-21",
      face: "face-mschen",
      evidence: [
        { src: "ev-mschen-soil", cap: "21 July. Ms. Chen at ground level, where she explains." },
        { src: "farm-tamsui-okra", cap: "Harvesting okra with her." },
        { src: "farm-tamsui-cook", cap: "Lunch from what we picked, and the talk about seed." },
        { src: "ev-seed-platform", cap: "23 July. The seed exchange prototype she asked for." }
      ],
      name: "Ms. Chen", zh: "陳惠雯", kind: "farm",
      headline: "Too much help can take away a plant's own resilience",
      role: "Natural farming, Happy Farm", where: "Tamsui",
      lanes: ["deploy"],
      quote: "Sometimes, giving too much is not necessarily beneficial for a living organism; instead, it can take away its ability to survive and thrive on its own.",
      suggestion: "Ask whether external support stops a plant building its own resilience, and answer that concern in the design.",
      summary: "We harvested okra and luffa, knelt in her beds while she read the soil, and ate what we picked. Her objection is the hardest the project has faced.",
      takeaways: [
        "Traditional and natural farmers may doubt that a technological solution helps at all.",
        "Over-intervention can interfere with natural farming processes.",
        "What she wanted was not a device. It was a way to exchange seed."
      ],
      before: [],
      after: ["Build an online seed exchange platform", "Answer the resilience objection directly"],
      photos: [{ src: "farm-tamsui-group.webp", alt: "The team with Ms. Chen at Happy Farm, Tamsui, 21 July 2026." }],
      links: [W("Farmer engagement and the LINE platform", "../human-practices/"), W("Software", "../software/")],
      source: "LOG + ROAD + PLANT"
    },
    {
      id: "e16", date: "2026-07-28",
      face: "face-huang",
      evidence: [
        { src: "exp-0728-huang", cap: "28 July. The online meeting with Dean Huang (top left)." },
        { src: "ev-electroporation", cap: "Electroporation, the step his cloning advice was about." },
        { src: "ev-gel-lea", cap: "25 July. Level 1 assemblies, three days before." },
        { src: "ev-wb800-plate", cap: "The WB800 strain he gave us at the second meeting." }
      ],
      name: "Dean Huang", zh: "黃介辰", kind: "expert",
      headline: "Act at the seedling stage, and only when stress hits",
      role: "Dean at NCHU; plant stress biology and gene circuits", where: "Online",
      lanes: ["plant", "circuit", "model"],
      suggestion: "Apply biostimulants at the seedling stage, set thresholds, and validate the dose before trusting it.",
      summary: "A consultation on timing, dose, sensing and application that changed when we think the reactor should act at all.",
      takeaways: [
        "Biostimulants applied at the seedling stage last longer, as regulation signals carry through cell division.",
        "Too much stress or protectant harms the plant, so validate thresholds and doses.",
        "Some protectants prime before stress; others work better once stress arrives."
      ],
      before: ["A reactor that runs continuously", "Cloning troubleshooting without controls for native resistance"],
      after: ["Forecasts plus pH and moisture sensors to release protectant early", "Run the reactor periodically, when stress hits", "Electroporation with dense pellets, larger DNA and control groups"],
      photos: [{ src: "exp-0728-huang.webp", alt: "The online consultation with Prof. Huang, 28 July 2026." }],
      links: [W("Engineering record", "../engineering/"), W("Modelling", "../model/")],
      source: "LOG + ROAD"
    },
    {
      id: "e17", date: "2026-08-06",
      face: "face-huang",
      evidence: [
        { src: "ev-nchu-office", cap: "6 August. In Dean Huang's office at NCHU." },
        { src: "ev-nchu-visit", cap: "The department museum, on the same visit." },
        { src: "ev-nchu-gate", cap: "The team at the department gate." },
        { src: "ev-wb800-plate", cap: "The WB800 plate we came home with." }
      ],
      name: "Dean Huang", zh: "黃介辰", kind: "expert",
      headline: "Secretion proves nothing if the protein is inactive",
      role: "Dean at NCHU; plant stress biology and gene circuits", where: "In person at NCHU",
      lanes: ["plant", "protect", "circuit"],
      suggestion: "Evaluate protein quantity, identity, solubility and function together. Improving secretion alone proves nothing.",
      summary: "Nine days later we went to NCHU in person, with the wet lab, the plant model and the dry lab each bringing one question.",
      takeaways: [
        "Activity decides whether expression and secretion matter at all.",
        "Salinity and heat each need a stated rationale on agar, hydroponics and soil.",
        "For the dry lab: shorter or modified peptides that keep activity, guided by receptor interactions."
      ],
      before: ["Secretion treated as the measure of success"],
      after: ["Evaluate quantity, identity, solubility and function together", "State the rationale for each stress on each growth system", "Truncated or modified peptides, guided by receptor interactions"],
      links: [W("Engineering record", "../engineering/"), W("Plant screening record", "../plant/")],
      source: "LOG + ROAD"
    },
    {
      id: "e18", date: "2026-08-06",
      face: "ev-huangzb-group",
      evidence: [
        { src: "ev-huangzb-group", cap: "6 August. With Prof. Huang 黃姿碧 at NCHU." },
        { src: "ev-nchu-gate", cap: "The same visit." },
        { src: "ev-od600-live", cap: "Culture density read live: the production side." },
        { src: "ev-soil-pots", cap: "Delivery to soil: the other side." }
      ],
      name: "Prof. Huang", zh: "黃姿碧", kind: "expert",
      headline: "Dose, timing and frequency at the plant decide the effect",
      role: "Plant and stress biology, protectant delivery, NCHU", where: "In person at NCHU",
      lanes: ["plant", "protect", "circuit"],
      suggestion: "What matters is how much protectant reaches the plant, when it is delivered, and how often.",
      summary: "A second NCHU consultation the same day. With the bacteria kept inside the reactor, delivery is the step that decides the plant response.",
      takeaways: [
        "Producing protectant settles nothing; dose, timing and frequency at the plant do.",
        "Irrigation, spraying and seed coating are the delivery methods to compare.",
        "A better culture medium may ease the trade-off between growth and protein output."
      ],
      before: [],
      after: ["Compare irrigation, spraying and seed coating", "Treat delivered dose and timing as the measured quantity", "Optimise the medium for growth and protein output together"],
      links: [W("Engineering record", "../engineering/")],
      source: "LOG + ROAD"
    },
    {
      id: "e19", date: "2026-08-11",
      face: "face-yeshealth",
      evidence: [
        { src: "ev-yuanxian-wall", cap: "11 August. A wall of hydroponic channels." },
        { src: "ev-yuanxian-plate", cap: "The underside of their float plate." },
        { src: "ev-yuanxian-cad", cap: "The same afternoon, back on the CAD drawings." },
        { src: "ev-cad-redesign", cap: "The redesign that came out of it." }
      ],
      name: "Yes Health iFarm", zh: "", kind: "farm",
      headline: "A working hydroponic farm changed what our chamber had to do",
      role: "Controlled-environment hydroponic farm",
      lanes: ["plant", "reactor", "model", "deploy"],
      suggestion: "",
      summary: "Prof. Chen sent us. Seeing a fully controlled hydroponic farm changed our growth chamber plans. Some technical data we asked for was not available to us.",
      takeaways: [
        "ReLeaf could grow from detecting stress to detecting nutrient deficiency.",
        "Treat plants as organisms with individual needs.",
        "Transplanting is itself a stress, so keep transfers to a minimum."
      ],
      before: ["An 8/16 light cycle", "Pure oxygen into the growth chamber", "Dissolved oxygen aerated but not measured"],
      after: ["Reconsider the 8/16 light cycle against 12/12", "Circulation and gentle aeration instead of pure oxygen", "Measure dissolved oxygen, and possibly OD"],
      links: [W("Hardware notebook", "../hardware/"), W("Modelling", "../model/")],
      source: "LOG + ROAD"
    },
    {
      id: "e20", date: "2026-08-28",
      face: "face-cheng",
      evidence: [
        { src: "ev-soil-pots", cap: "22 August. The soil run she reviewed." },
        { src: "ev-scoring-bench", cap: "Scoring plates regrown at ten days." },
        { src: "ev-growth-chamber", cap: "29 August. The growth chamber after her rulings." },
        { src: "ev-hydro-dead", cap: "What we showed her: failed sets as well as working ones." }
      ],
      name: "Prof. Cheng", zh: "鄭梅君", kind: "expert",
      headline: "Ten-day plants, a 200 mM ceiling, treatment by transfer",
      role: "Plant and stress biology, NTU",
      lanes: ["plant"],
      suggestion: "Use ten- to twenty-day-old plants, cap salt at 200 mM, and treat by transfer instead of spray.",
      summary: "Five months after the seed, we took the whole screen back to her. The log entry is empty; her rulings, written up on 2 September, are the record.",
      takeaways: [
        "Start stress at ten to twenty days, once the first true leaves are out.",
        "Do not spray salt or protectant; move plants onto plates that already contain it.",
        "The gradual soil salt ramp is too mild, and watering between doses washes it out."
      ],
      before: ["Seedlings transferred at four days old", "Treatment applied by pipette, then by spray", "Soil salt built up 25 mM per day toward 100 mM, with watering in between"],
      after: ["Ten-day-old plants in experiment set 8", "Treatment by transfer onto prepared plates", "Soil doses of 100, 200 and 300 mM, no watering between"],
      links: [W("Plant screening record", "../plant/")],
      source: "PLANT, rulings written up 2 September. The interview log entry for 28 August is blank."
    },
    {
      id: "e21", date: "2026-09-04",
      face: "face-chang",
      evidence: [
        { src: "ev-reactor-case", cap: "23 August. The reactor he saw, going into a case." },
        { src: "ev-reactor-case2", cap: "The case build, from the side." },
        { src: "ev-reactor-assembly", cap: "29 August. The assembled unit." },
        { src: "ev-od600-live", cap: "Live density from the loop, the data we could not yet read." }
      ],
      name: "Prof. Chang", zh: "張嘉修", kind: "expert",
      headline: "The membrane leaks at rest, and a farmer must run it",
      role: "Biomanufacturing and bioreactor engineering", where: "Second visit to the team",
      lanes: ["reactor", "model", "deploy"],
      suggestion: "Improve the membrane delivery and the experimental reliability, and make the reactor something a farmer can understand and operate.",
      summary: "Eleven weeks on, we showed him the built reactor and two problems: material crossing the membrane with no driving force, and data we could not interpret.",
      takeaways: [
        "Technical performance and usability are both design targets; we had treated only the first as one.",
        "A replaceable bacterial capsule and AIoT control would make the system practical on a farm.",
        "The membrane leak at rest is an open problem, recorded here as open."
      ],
      before: ["Membrane treated as a solved containment layer", "Usability treated as a later problem"],
      after: ["Investigate the leak at rest before claiming containment", "Design toward a replaceable bacterial capsule", "Integrate AIoT so a farmer can operate it"],
      links: [W("Hardware notebook", "../hardware/"), W("Safety and security", "../safety-and-security/")],
      source: "LOG. The log's Project Impact and Action fields for this visit are blank; the summary and feedback fields are not."
    },
    {
      id: "e22", date: "2026-09-05",
      face: "forum-dsc-57",
      evidence: [
        { src: "forum-dsc-57", cap: "5 September. Prof. Chen speaking at our forum." },
        { src: "forum-dsc08227", cap: "Our reactor, explained to the room." },
        { src: "forum-dsc08502", cap: "A grower with the microphone." },
        { src: "forum-dsc09107", cap: "The certification question, continuing after the session." }
      ],
      dateNote: "The interview log's table dates the forum 4 September; the written narrative of the event dates it 5 September, and so does the booth write-up for the same day. We use 5 September.",
      name: "Public Forum and market day", zh: "", kind: "forum",
      headline: "Three speakers, one boundary: balance growth and defence",
      role: "Experts, farmers and the public, more than 50 participants",
      where: "Taipei Water Garden Organic Farmers' Market, with Green Media",
      lanes: ["protect", "deploy"],
      suggestion: "Protect on the basis of whether the plant can keep growing under the stress it is in.",
      summary: "Three speakers, then the farmers, with more than 50 people in the room. Natural farming, smart agriculture and plant metabolism reached the same limit: balance growth and defence.",
      takeaways: [
        "Dr. Li: build an environment where plants develop their own resilience, and intervene second.",
        "Prof. Chen, now a speaker: apply protection by whether plants can keep growing under the stress.",
        "Farmers asked two questions we had not prepared: organic certification, and units per farm."
      ],
      before: ["A forum where experts present and the audience listens"],
      after: ["A discussion session where every participant speaks", "Two farmer questions taken into the entrepreneurship and safety work", "KAP surveys written separately for speakers, farmers and the public"],
      photos: [
        { src: "forum-dsc-75.webp", alt: "The forum auditorium during the expert session, 5 September 2026." },
        { src: "forum-dsc08227.webp", alt: "The team presenting the bioreactor prototype to forum participants." }
      ],
      links: [W("Public engagement", "../human-practices/"), W("Entrepreneurship", "../entrepreneurship/"), W("Safety and security", "../safety-and-security/")],
      source: "LOG, forum narrative and survey sections"
    },
    {
      id: "e23", date: "2026-09-09",
      face: "booth-intro",
      evidence: [
        { src: "booth-intro", cap: "The device explained to the public." },
        { src: "ev-reactor-case", cap: "One device doing several jobs: the price case." },
        { src: "line-menu", cap: "Tools for younger farmers who already use their phones." },
        { src: "farm-market-4", cap: "Talking to growers about what they would pay for." }
      ],
      name: "Taiwan SMART Agriweek", zh: "", kind: "event",
      headline: "Young farmers adopt first; older farmers and regulation are harder",
      role: "Agricultural technology exhibition",
      lanes: ["deploy"],
      suggestion: "",
      summary: "We took the business case to an exhibition floor to see where it broke.",
      takeaways: [
        "Young farmers are the likely early adopters; older farmers still need convincing.",
        "Regulation will be difficult for a product that uses GMOs.",
        "One system replaces several products, and government sectors signalled they may subsidise it."
      ],
      before: [],
      after: [],
      links: [W("Entrepreneurship", "../entrepreneurship/")],
      source: "LOG. Action fields blank."
    },
    {
      id: "e24", date: "2026-09-11",
      face: "face-huang",
      logo: "logo-islsdr",
      evidence: [
        { src: "ev-symp-rehearsal", cap: "Rehearsing the poster in the lab." },
        { src: "ev-symp-poster", cap: "11 September, NCHU. Presenting the poster." },
        { src: "ev-symp-explain", cap: "Walking a visitor through the results." },
        { src: "ev-symp-award", cap: "With Dean Huang, who invited us." }
      ],
      name: "2nd ISLSDR symposium", zh: "中興大學研討會", kind: "event",
      headline: "Put the finding in every slide title",
      role: "2nd International Symposium on Living Systems Design Research, NCHU and JSLSDR",
      where: "National Chung Hsing University, Taichung, 10 to 13 September",
      lanes: ["protect", "deploy"],
      suggestion: "Put the finding in the title of every slide, and keep the evidence under it simple enough to prove it.",
      summary: "Dean Huang invited us after our NCHU visit. We presented a poster on host, microbe and molecule communication to researchers who study exactly that.",
      takeaways: [
        "Title each slide with its finding: '0.5 mM ACCD increases growth by 5 mm at 12 mM NaCl'.",
        "Know ACC deaminase's mechanism in full. Visitors asked about it most.",
        "State the farmers' problem first and win the first 30 seconds."
      ],
      before: [
        "Slide titles named the experiment",
        "Presentations opened with the reactor",
        "ACC deaminase explained as a name, not a mechanism"
      ],
      after: ["Rewrite every results slide title as its finding", "Open with the farmers' problem, then the reactor", "A step-by-step ACC deaminase explanation for booth and pitch"],
      links: [W("Results", "../results/"), W("Entrepreneurship", "../entrepreneurship/")],
      source: "Team notes from the symposium, 11 to 12 September"
    },
    {
      id: "e25", date: "2026-09-12",
      face: "face-endy",
      evidence: [
        { src: "exp-0912-sattely-endy", cap: "12 September. The second Stanford review (Prof. Endy, right)." },
        { src: "ev-gel-accd", cap: "22 July. The ACC deaminase construct they asked us to prove." },
        { src: "ev-gel-acdi", cap: "1 September. The Level 2 ACDI assembly under review." },
        { src: "ev-plate-inspect", cap: "The plant assays that need their controls." }
      ],
      name: "Dr. Sattely and Prof. Endy", zh: "", kind: "expert",
      headline: "Show the bacteria make and secrete ACCD, with controls",
      role: "Protectant design and synthetic biology, Stanford",
      lanes: ["protect", "circuit"],
      suggestion: "Distinguish clearly between the engineered bacteria and the protectant delivered to plants, and show that the bacteria produce and secrete ACCD.",
      summary: "Dr. Sattely's second reading, now with Prof. Endy. June asked whether the protectant works; September asked whether our results say what we claim.",
      takeaways: [
        "Explain the design, controls, mechanism and ACCD's role clearly.",
        "Verify ACCD production at protein and RNA level.",
        "Add controls that rule out alternatives, and say what each result shows."
      ],
      before: ["Results presented without controls that rule out the alternatives", "Bacteria and protectant described together"],
      after: ["Verify ACCD at protein and RNA level", "Add controls that rule out alternative explanations", "Separate the organism from the delivered protectant in every explanation"],
      photos: [{ src: "exp-0912-sattely-endy.webp", alt: "Online meeting with Dr. Sattely and Prof. Endy, 12 September 2026." }],
      links: [W("Engineering record", "../engineering/"), W("Safety and security", "../safety-and-security/")],
      source: "LOG + ROAD"
    }
  ];

  /* ----------------------------------------------------------------- BUILDS */

  var builds = [
    { id: "b01", date: "2026-04-15", lane: "reactor",
      label: "Pivot document",
      note: "Instead of sensing soil and releasing into it, engineered B. subtilis live inside a sealed vessel and light tells them when to produce protectant. Posted five days after Prof. Chen's meeting. Every instrument in the hardware notebook follows from it.",
      source: "HW week 07", links: [W("Hardware notebook", "../hardware/")] },
    { id: "b02", date: "2026-06-06", lane: "reactor",
      label: "Bioreactor prototype I",
      note: "PES hollow fibre membrane, 0.2 um pore, eight fibres, with a 500 mL reservoir and a peristaltic pump. No stirring, no aeration, no pH control, because we did not know which of those we needed. The shell-side plate from this run is our evidence that the membrane holds whole B. subtilis.",
      source: "HW weeks 14 and 18", links: [W("Hardware notebook", "../hardware/")] },
    { id: "b03", date: "2026-06-13", lane: "plant",
      label: "Hydroponic boxes on the rack",
      note: "Five boxes copied from Prof. Cheng's design. Four were sown with seed and contaminated. Prototype 4 took seedlings across from an agar plate, and it is the design still running.",
      source: "PLANT", links: [W("Plant screening record", "../plant/")] },
    { id: "b04", date: "2026-06-19", lane: "reactor",
      label: "Stepper pinch valve posted",
      note: "Posted to the build channel the day after Prof. Chang's visit, with a 27 June target. Replaced by a servo in week 23, on criteria written before anything was scored.",
      source: "HW weeks 16 and 23", links: [W("Hardware notebook", "../hardware/")] },
    { id: "b05", date: "2026-07-01", approx: true, lane: "deploy",
      dateNote: "Our sources do not date the build. The mark sits between the two engagements that caused it and is drawn open.",
      label: "LINE platform 農友助手",
      note: "Six functions in one LINE official account: latest news, product introduction, crop stress alerts, crop assistant, farmer's diary and feedback. Built because information exists on government pages and social media and does not reach the farmers who need it.",
      source: "LOG, LINE platform section", links: [W("Software", "../software/")] },
    { id: "b06", date: "2026-07-23", lane: "deploy",
      label: "Seed exchange platform",
      note: "Prototyped two days after the Tamsui visit. Users post seed supply and demand with variety, harvest year and location, the platform matches them, and the two parties arrange the exchange themselves.",
      source: "LOG + PLANT", links: [W("Software", "../software/")] },
    { id: "b07", date: "2026-07-27", lane: "protect",
      label: "Experiment set 7, 富肽2號",
      note: "CH Biotech's peptide at 1:500, run on three treatment timings across 75 and 100 mM salt. Four trials: one contaminated and redone, one with photographs and no result, and two that rank pre-treatment against co-treatment in opposite orders.",
      source: "PLANT", links: [W("Plant screening record", "../plant/")] },
    { id: "b08", date: "2026-08-18", lane: "plant",
      label: "Set 8, ten-day plants by transfer",
      note: "The first set built to Prof. Cheng's rulings: ten-day-old plants, treatment applied by moving plants onto fresh plates, running on an in-house ACC deaminase preparation.",
      source: "PLANT", links: [W("Plant screening record", "../plant/")] }
  ];

  /* ------------------------------------------------------------------ LOOPS */

  var loops = [
    {
      id: "l-cheng", person: "Prof. Cheng", zh: "鄭梅君", count: 2, visits: ["e02", "e20"],
      headline: "She gave us the seed in March and audited the whole screen in August.",
      between: [
        { label: "Eight numbered experiment sets, three closed with numbers we would defend", source: "PLANT" }
      ],
      buildIds: ["b03", "b08"],
      depth: "In March the advice was what to grow and how: Arabidopsis, agar first, soil after, and do not trust hydroponics on its own. In August we brought back a working box and eight sets of data, and the advice turned specific and procedural: plants ten to twenty days old, a 200 mM ceiling, treatment by transfer instead of spray, and a soil ramp that does not wash itself out. The second reading corrected the experiment we had actually run, which the first could not have done.",
      source: "LOG + PLANT"
    },
    {
      id: "l-chen", person: "Prof. Chen", zh: "陳文亮", count: 3, visits: ["e04", "e10", "e22"],
      headline: "He redirected the project in April, audited the loop between model and bench in June, and spoke at our forum in September.",
      between: [
        { label: "The first stress-to-light demonstration on a bench, two months after the pivot", source: "HW" },
        { label: "Yes Health iFarm visit on 11 August, which he told us to make", source: "LOG" }
      ],
      buildIds: ["b01", "b02"],
      depth: "The April meeting was strategic: leave the soil sensor market, contain the organism, sell the consumable. The June visit was methodological: connect the model to the bench, extend the test period, measure dissolved oxygen, and go and see a real hydroponic farm. By September he was on our stage, arguing that protection should be applied according to whether a plant can keep growing under the stress it is in. Three visits, each one a step further inside the project.",
      source: "LOG + HW"
    },
    {
      id: "l-chang", person: "Prof. Chang", zh: "張嘉修", count: 2, visits: ["e09", "e21"],
      headline: "He found the design had no way to get protectant out. Eleven weeks later he saw it come out where it should not.",
      between: [
        { label: "Transmembrane pressure put on a screen, so fouling is visible while a run happens", source: "HW" },
        { label: "Full rig assembled: valve, sensors and photometer as one machine", source: "HW" }
      ],
      buildIds: ["b04"],
      depth: "The first visit found a hole in the design: there was no mechanism at all for pushing permeate through the membrane, and no valve on any plan. We built one the next day. The second visit met a built machine and a harder problem, protectant and bacteria crossing the membrane with no driving force applied, and it added a requirement the first visit had not raised: a farmer has to be able to operate this, which is where the replaceable capsule and the AIoT control come from.",
      source: "LOG + HW"
    },
    {
      id: "l-sattely", person: "Dr. Sattely", zh: "", count: 2, visits: ["e11", "e25"],
      headline: "In June she doubted the proof of concept. In September, with Prof. Endy, she went after the evidence.",
      between: [
        { label: "A constitutive construct series built so a negative protectant result has one explanation fewer", source: "ENGINEERING" }
      ],
      buildIds: ["b07", "b08"],
      depth: "June was about scope: prove one protectant on one stress properly, write down the milestones, and consider peptides. September was about proof: separate the engineered organism from the delivered protectant, verify ACCD at protein and RNA level, and add the controls that rule out the alternatives. The first reading told us what to build; the second told us what our results were allowed to claim.",
      source: "LOG"
    },
    {
      id: "l-chbio", person: "CH Biotech", zh: "正瀚生技", count: 2, visits: ["e13", "e22"],
      headline: "We consulted them in July about delivery and regulation, and in September their expert spoke at our forum.",
      between: [
        { label: "Their peptide 富肽2號 went onto our bench at 1:500", source: "PLANT" },
        { label: "Regulatory research on biostimulants and GMOs in Taiwan", source: "LOG" }
      ],
      buildIds: ["b07"],
      depth: "In July the conversation was ours to ask: which delivery method, what cost per area, what the regulator wants. In September their expert made the same argument to a room of farmers, and framed it as metabolism and homeostasis: the goal is balance between growth and defence. The advice arrived once as a company consultation and once as public teaching, and the second form is the one the farmers could use.",
      source: "LOG + PLANT"
    },
    {
      id: "l-greenmedia", person: "Green Media", zh: "", count: 2, visits: ["e12", "e22"],
      headline: "A July meeting about how stakeholders see farming, and a September event co-hosted with them.",
      between: [
        { label: "The forum was restructured so every participant speaks, not only the invited experts", source: "LOG" },
        { label: "Six booths designed for the market crowd, with a KAP survey behind each", source: "LOG" }
      ],
      buildIds: [],
      depth: "The July meeting changed the format before the event existed: different backgrounds hold different views of farming, so a panel of experts talking at an audience would have missed the farmers. In September the event ran at the market alongside their own coffee and cocoa programme, and the discussion session they argued for is where the two farmer questions came from.",
      source: "LOG"
    },
    {
      id: "l-huang", person: "Dean Huang", zh: "黃介辰", count: 2, visits: ["e16", "e17"],
      headline: "An online consultation on timing and dose, then nine days later the same questions at his bench.",
      between: [
        { label: "Electroporation reworked around dense pellets and larger DNA, with control groups added", source: "LOG" }
      ],
      buildIds: [],
      depth: "The July call was about when to act: seedling stage, thresholds, periodic operation instead of continuous. The August visit was about what counts as success: protein quantity, identity, solubility and function evaluated together, because secretion on its own proves nothing if the protein is inactive. The second meeting moved the standard of evidence, not the plan.",
      source: "LOG"
    }
  ];

  /* ----------------------------------------------------------------- CHAINS */

  var chains = [
    { id: "c01", from: { type: "engagement", id: "e04" }, to: { type: "build", id: "b01" },
      label: "led to the pivot",
      note: "Five days after the meeting the pivot document went up, and every instrument in the hardware notebook follows from it.",
      source: "HW week 07" },
    { id: "c02", from: { type: "engagement", id: "e09" }, to: { type: "build", id: "b04" },
      label: "valve built next day",
      note: "There was no valve on any plan before we spoke to him. The design was posted to the build channel the following day.",
      source: "HW week 16" },
    { id: "c03", from: { type: "engagement", id: "e10" }, to: { type: "engagement", id: "e19" },
      label: "sent us to Yes Health",
      note: "He suggested the visit in June to help us understand hydroponic deployment. We went on 11 August.",
      source: "LOG" },
    { id: "c04", from: { type: "engagement", id: "e13" }, to: { type: "build", id: "b07" },
      label: "peptide onto the bench",
      note: "富肽2號 came back from CH Biotech and became experiment set 7 at 1:500 in the plate.",
      source: "PLANT" },
            { id: "c07", from: { type: "engagement", id: "e15" }, to: { type: "build", id: "b06" },
      label: "asked for seed exchange",
      note: "She suggested a way for growers to exchange seed. The platform was prototyped two days later.",
      source: "LOG + PLANT" },
    { id: "c08", from: { type: "engagement", id: "e06" }, to: { type: "build", id: "b05" },
      label: "led to the LINE assistant",
      note: "The expo interviews and Ms. Chen's visit together are why the LINE assistant exists.",
      source: "LOG" },
    { id: "c09", from: { type: "engagement", id: "e20" }, to: { type: "build", id: "b08" },
      label: "rulings into set 8",
      note: "Set 8 is the first set built to her August rulings: ten-day plants, treatment by transfer.",
      source: "PLANT" },
    { id: "c11", from: { type: "engagement", id: "e17" }, to: { type: "engagement", id: "e24" },
      label: "invited us to the symposium",
      note: "After the visit to his office, Dean Huang invited us to present at the 2nd ISLSDR at NCHU.",
      source: "Team notes" },
    { id: "c10", from: { type: "engagement", id: "e02" }, to: { type: "build", id: "b03" },
      label: "her box, copied",
      note: "Plain plastic boxes and separate foam float boards. Until that afternoon we had assumed a hydroponic rig was something you buy.",
      source: "PLANT" }
  ];

  /* --------------------------------------------------------------- STATIONS */

  var stations = [
    { id: "redesign", glyph: "box",
      glyphNote: "Drawn as the box the project ended in. The line starts in the soil, where the bacteria were first meant to live, and closes the vessel at the last meeting.",
      name: "Redesign", dates: "19 March to 18 April",
      lede: "Five conversations took the project from bacteria in the soil to bacteria in a sealed vessel.",
      ids: ["e01", "e02", "e03", "e04", "e05"] },
    { id: "first-builds", glyph: "flask",
      glyphNote: "Drawn as a flask: the first reactor and the plant screen were both built in this phase.",
      name: "First builds", dates: "16 May to 27 June",
      lede: "Farmers at the market, and the advisors who set the rules for the first reactor and the plant screen.",
      ids: ["e06", "e07", "e08", "e09", "e10", "e11"] },
    { id: "industry-farms", glyph: "leaf",
      glyphNote: "Drawn as a leaf: this phase took the project to the people who grow, sell and regulate plants.",
      name: "Industry and farms", dates: "7 to 28 July",
      lede: "Media, a biostimulant company, an exhibition floor, a natural farm and a dean's first call.",
      ids: ["e12", "e13", "e14", "e15", "e16"] },
    { id: "dose-delivery", glyph: "drop",
      glyphNote: "Drawn as a drop: every conversation here was about how much reaches the plant, and when.",
      name: "Dose and delivery", dates: "6 to 28 August",
      lede: "How much protectant reaches the plant, when, and in what kind of growing system.",
      ids: ["e17", "e18", "e19", "e20"] },
    { id: "forum-reviews", glyph: "bubble",
      glyphNote: "Drawn as a speech bubble: the project was presented, questioned and reviewed in public. The forum sits on the tail.",
      name: "Forum and reviews", dates: "4 to 12 September",
      lede: "Two advisors came back to judge what we had built, and we took the project to a forum, an exhibition and a symposium.",
      ids: ["e21", "e22", "e23", "e24", "e25"] }
  ];

  return {
    stations: stations,
    meta: {
      start: "2026-03-10",
      end: "2026-09-20",
      title: "Project Evolution Map",
      standfirst: "Six project areas, six months, and every place an outside voice changed one of them.",
      startState: "Engineered bacteria released into soil, with a kill switch as the safeguard, sensing stress themselves and supplying trehalose on a Medicago model.",
      endState: "Bacteria held inside a hollow fibre bioreactor while the protectant crosses the membrane, light-gated production, screened peptides proven on ten-day Arabidopsis before integration, and a farmer-operable capsule.",
      note: "Node positions follow the date axis and are nudged apart where dates fall within a few days of each other."
    },
    lanes: lanes,
    laneStates: laneStates,
    engagements: engagements,
    builds: builds,
    loops: loops,
    chains: chains
  };
}());
