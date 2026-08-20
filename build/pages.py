# -*- coding: utf-8 -*-
"""
ReLeaf wiki: the page specification.

One entry per sub-page. generate.py turns each into <slug>/index.html.

Editing rules
-------------
slug      The URL, and for most pages not free to change. See site-nav.js.
tab       Which nav tab the page reads under. Sets the breadcrumb and the
          highlighted tab. Not part of the URL.
lede      One sentence. What a judge gets if they read nothing else.
award     The medal criterion or special award this page is judged against,
          quoted from the 2026 Judge Handbook. Leave None for pages iGEM does
          not judge directly.
sections  The skeleton of the argument. Each becomes a numbered <h2>; `subs`
          become numbered <h3>. `note` is the instruction to whoever writes it
          and is meant to be deleted, not published.
figs      Pending figure slots. Each is a caption; the image goes in later.
table     (headers, rows) rendered as a data table. Rows may be empty.
tabs      Turns the section into a tab group, one panel per name.

The section outlines follow iGEM Brno 2025's corresponding sub-pages, with the
iGEM page brief folded in where Brno was following it. Where Brno has no
corresponding page (bioreactor calculations, peptide design, laws and
regulations, geospatial analysis, data physicalization, AI responsibility,
milestone, gallery) the outline keeps Brno's shape: state the question, give
the method, give the result, then state the limit.
"""

MONTHS = [
    ("2025-12", "December 2025"), ("2026-01", "January 2026"),
    ("2026-02", "February 2026"), ("2026-03", "March 2026"),
    ("2026-04", "April 2026"),    ("2026-05", "May 2026"),
    ("2026-06", "June 2026"),     ("2026-07", "July 2026"),
    ("2026-08", "August 2026"),   ("2026-09", "September 2026"),
    ("2026-10", "October 2026"),  ("2026-11", "November 2026"),
]


def notebook_sections(kind):
    """Twelve months, in order, each waiting for its entries."""
    return [
        {"h": label,
         "note": "Dated entries for %s. Each entry: what it was for, what was "
                 "done, what came out, who was there. Photographs from "
                 "iGEM2026_Images/%s belong here." % (label, folder)}
        for folder, label in MONTHS
    ] if kind else []


PAGES = [

# ============================================================ PROJECT ========

{
 "slug": "description", "tab": "project", "title": "Description",
 "lede": "Biomanufacturing is gated, and the gate is not made of science. "
         "ReLeaf is an attempt to hand the means of production to the person "
         "standing in the field.",
 "owner": "Project leads",
 "award": None,
 "sections": [
   {"h": "The problem we picked",
    "note": "Open on who is structurally not served and why the arithmetic, "
            "not anyone's malice, puts them there. Use the sourced context "
            "figures from the project brief. Do not let this drift into "
            "climate, margins or hunger."},
   {"h": "Why we did not pick the obvious problem",
    "note": "State plainly what ReLeaf is not about: not climate change, not "
            "farmer margins, not hunger. Name what is at stake instead, which "
            "is who is permitted to manufacture."},
   {"h": "What ReLeaf is",
    "note": "One paragraph a non-specialist can repeat back. Then the system "
            "in four moving parts.",
    "subs": [
      {"h": "The chassis", "note": "Engineered B. subtilis 168, growing "
       "continuously in the extracapillary chamber. Use the compartment "
       "vocabulary exactly: chamber outside the fibres, lumen is the bore."},
      {"h": "The light switch", "note": "520 nm, CcaS/CcaR driving P_cpcG2. "
       "Brightness is intended to set transcription rate. Mark it as design "
       "intent, in the same sentence, at the same size."},
      {"h": "The membrane", "note": "What it is intended to retain and what it "
       "is intended to pass. Cutoff is unchosen; say so here rather than "
       "leaving it to the calculations page."},
      {"h": "The controller", "note": "Local sensor plus forecast, and what it "
       "is meant to call before the plant shows it."},
    ],
    "figs": ["System overview. The reactor, the light, the membrane and the "
             "line into the root zone, drawn once so every other page can "
             "point back at it."]},
   {"h": "Why it had to be alive",
    "note": "Answer the sachet. A dried spore sachet is ambient-stable, cheap "
            "and real, and shelf life alone argues for it. The refusal is dose "
            "and retasking, not shelf life."},
   {"h": "What is true today",
    "note": "Only the measured facts, in the team's own hands. Three weeks of "
            "unbroken OD600 logging, fifteen design cycles, three instruments "
            "built, one failure caught by our own photometer.",
    "table": (["Claim", "Evidence", "Where it is documented"],
              [["", "", ""], ["", "", ""], ["", "", ""]])},
   {"h": "What is not true yet",
    "note": "Put the limits on the page before a judge finds them. This list "
            "is not exhaustive and absence from it proves nothing.",
    "callout": ("unproven", "Not yet demonstrated",
                "No biological output has been measured: no induction curve, "
                "no titre, no activity assay, and no plant has received "
                "anything. Every statement about dose on this page is design "
                "intent.")},
   {"h": "Where this goes next",
    "note": "The next design decision, not a wish list. The membrane cutoff is "
            "the central unmade decision; say what would settle it."},
 ]},

{
 "slug": "engineering", "tab": "project", "title": "Engineering Success",
 "lede": "Fifteen design, build, test and learn cycles across a perfusion "
         "reactor, an in-line photometer and an LED array, and what each one "
         "changed about the next.",
 "owner": "Dry lab and hardware",
 "award": ("medal", "Silver Medal Criterion #1",
           "Demonstrate engineering success in a technical aspect of your "
           "project by going through at least one iteration of the engineering "
           "design cycle.",
           "https://competition.igem.org/judging/medals"),
 "sections": [
   {"h": "How we ran the cycle",
    "note": "Design, build, test, learn, and how a cycle was declared finished. "
            "A judge should be able to tell a cycle from a repair."},
   {"h": "The fifteen cycles at a glance",
    "note": "One row per cycle. This table is the page's spine; every section "
            "below expands one or more rows.",
    "table": (["#", "Subsystem", "Design question", "What we built",
               "What the test said", "What changed next"],
              [[str(i), "", "", "", "", ""] for i in range(1, 16)])},
   {"h": "Perfusion reactor",
    "note": "The reactor cycles in order. Each: the question, the build, the "
            "measurement, the change.",
    "figs": ["Reactor, revision by revision."]},
   {"h": "In-line photometer",
    "note": "Including the cycle where the photometer caught the cross-flow "
            "pump dying before anyone noticed. That is the strongest evidence "
            "on this page; give it room."},
   {"h": "Dual-wavelength LED array",
    "note": "Second wavelength is not on record in the brief. Confirm it "
            "before writing this section."},
   {"h": "What the cycles changed about the design",
    "note": "Not a summary. The specific design decisions that exist only "
            "because a test failed."},
   {"h": "The next iteration",
    "note": "What cycle sixteen would be, and what result would end it."},
 ]},

{
 "slug": "contribution", "tab": "project", "title": "Contribution",
 "lede": "What a team starting a perfusion reactor next year can take from us "
         "and not have to rebuild.",
 "owner": "Project leads",
 "award": ("medal", "Bronze Medal Criterion #3",
           "Make a useful contribution for future iGEM teams and document it "
           "on this page.",
           "https://competition.igem.org/judging/medals"),
 "sections": [
   {"h": "What we are contributing",
    "note": "Lead with the single most useful thing, then list the rest. Say "
            "who it is for and what it saves them."},
   {"h": "Hardware other teams can rebuild",
    "note": "The reactor, the photometer and the LED array as buildable "
            "objects: drawings, bill of materials, firmware, and the mistakes "
            "worth skipping. Link to the Hardware page rather than repeating "
            "it."},
   {"h": "Protocols and methods",
    "note": "Only protocols we actually ran and changed. A protocol copied out "
            "of a paper is not a contribution."},
   {"h": "Parts",
    "note": "If a part carries this criterion, the documentation must live on "
            "the Registry part page, not here. Link out and say what is there.",
    "callout": ("medal", "Where the documentation must live",
                "If a part is used to fulfil this criterion, its documentation "
                "has to be on the part's entry in the Registry. This page "
                "points at it; it cannot stand in for it.")},
   {"h": "How to reuse this",
    "note": "Concrete: clone this, print that, start here. Assume the reader "
            "has three weeks and no budget."},
   {"h": "The limits of what we are handing over",
    "note": "State what has not been validated, so nobody builds on a result "
            "we do not have."},
 ]},

{
 "slug": "results", "tab": "project", "title": "Results",
 "lede": "What the system actually did on the bench, including the runs that "
         "did not work.",
 "owner": "Wet lab and dry lab",
 "award": None,
 "sections": [
   {"h": "Summary of findings",
    "note": "Three to five sentences a judge can quote. Numbers with units, "
            "and a pointer to the section each comes from."},
   {"h": "Reactor performance",
    "note": "The three weeks of unbroken OD600 logging. Unbroken describes the "
            "log, not the culture; do not let the sentence blur.",
    "figs": ["OD600 over the full logging run, with the pump failure marked."]},
   {"h": "Optogenetic induction",
    "note": "Whatever exists. If no induction curve exists in our hands, this "
            "section says so and stops."},
   {"h": "Protein output",
    "note": "Titre, activity assay, permeate composition. None of this is on "
            "record yet."},
   {"h": "Plant response",
    "note": "No plant has received anything. If that is still true at freeze, "
            "this section is one honest paragraph."},
   {"h": "What did not work",
    "note": "Cells do not grow in the fibre lumen, and there is no root cause. "
            "Write the failures at the same length as the successes."},
   {"h": "Analysis and what follows",
    "note": "What the results mean for the design, and the single experiment "
            "that would move the project furthest."},
 ]},

# ============================================================= WET LAB =======

{
 "slug": "experiments", "tab": "wetlab", "title": "Experiments",
 "lede": "Every protocol, condition and run, in enough detail that somebody "
         "else could repeat it.",
 "owner": "Wet lab",
 "award": None,
 "sections": [
   {"h": "The experimental programme",
    "note": "What we set out to answer, in what order, and why that order."},
   {"h": "Materials, reagents and equipment",
    "note": "Concentrations, volumes, incubation times, temperatures, "
            "supplier and catalogue number where it matters.",
    "table": (["Item", "Supplier / catalogue", "Working concentration", "Notes"],
              [["", "", "", ""] for _ in range(4)])},
   {"h": "Strains and media",
    "note": "Which strain each run used, and the medium recipe. The brief "
            "records that the strain behind the three-week OD600 run is not "
            "on record. Settle it before writing."},
   {"h": "Cloning and assembly",
    "note": "Design, assembly standard, verification. Sequencing results "
            "belong here or on Parts, in one place, linked from the other.",
    "subs": [
      {"h": "Design", "note": ""},
      {"h": "Assembly", "note": ""},
      {"h": "Verification", "note": "Colony PCR, restriction digest, "
       "sequencing of positive clones."},
    ]},
   {"h": "Culture and perfusion runs",
    "note": "Set-up, seeding, flow rates, sampling schedule, and what a run "
            "being ended meant."},
   {"h": "Induction experiments",
    "note": "Light conditions, exposure, controls. Dark controls are not "
            "optional here."},
   {"h": "Plant assays",
    "note": "Cross-link to Plants rather than duplicating the growth systems."},
   {"h": "Modifications, optimisation and troubleshooting",
    "note": "Where we departed from a published protocol and why. This is the "
            "section other teams will actually read."},
 ]},

{
 "slug": "parts", "tab": "wetlab", "title": "Parts",
 "lede": "What we built, what we characterised, and what is now in the "
         "Registry for anyone to use.",
 "owner": "Wet lab",
 "award": None,
 "sections": [
   {"h": "The collection",
    "note": "A one-paragraph tour, then the table. Every part number links to "
            "its Registry page.",
    "table": (["Part", "Type", "Name", "Function", "Characterised", "Registry"],
              [["", "", "", "", "", ""] for _ in range(6)])},
   {"h": "Basic parts", "note": "One sub-section per part: what it is, where "
    "the sequence came from, what it is for."},
   {"h": "Composite parts", "note": "The assemblies, and what each was meant "
    "to demonstrate."},
   {"h": "Characterisation",
    "note": "Only data we took. Say which instrument, how many replicates, and "
            "what the controls were.",
    "figs": ["Characterisation data for the induction cassette."]},
   {"h": "Improving an existing part",
    "note": "If we improved a part, name the original, say what was wrong with "
            "it, and show the comparison."},
   {"h": "Design and assembly standard",
    "note": "Which standard, why, and any illegal sites we had to remove."},
   {"h": "Documentation on the Registry",
    "note": "Point at the part pages. Do not paste them here.",
    "callout": ("medal", "Registry, not wiki",
                "Part documentation is judged on the Registry entry. This page "
                "is a map to those entries.")},
 ]},

{
 "slug": "plant", "tab": "wetlab", "title": "Plants",
 "lede": "Three growth systems, one species, and the stress treatments we put "
         "it through.",
 "owner": "Wet lab, plant sub-team",
 "award": ("special", "Best Plant Synthetic Biology",
           "This award is designed to celebrate exemplary work done in plant "
           "synthetic biology. Did you build a project in a plant chassis? Did "
           "you submit plant parts to the Registry?",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "Why a plant chassis, and why three systems",
    "note": "Each growth system answers a different question. Say which "
            "question each one answers before describing any of them."},
   {"h": "Species, cultivar and seed source",
    "note": "Arabidopsis for the controlled work. Name the accession, the "
            "seed source, and the sterilisation protocol."},
   {"h": "Growth systems",
    "note": "Same species, three environments. Each tab carries its own "
            "protocol, its own conditions and its own record.",
    "tabs": [
      ("agar", "Agar", "Vertical plates for salinity and stress scoring. "
       "Medium, plate orientation, day length, temperature, scoring method, "
       "and the runs from 2026-05 onward."),
      ("hydroponics", "Hydroponics", "The hydroponic system: vessel, nutrient "
       "solution, aeration, replacement schedule, and what it lets you see "
       "that agar does not."),
      ("soil", "Soil", "Pot trials: substrate, watering regime, the daily "
       "logs, and the trial-by-trial record."),
    ]},
   {"h": "Stress treatments and scoring",
    "note": "Salinity, drought, heat. Define the score before showing any "
            "scores, and state who scored blind."},
   {"h": "Results across the three systems",
    "note": "Compare like with like, or say plainly why they cannot be "
            "compared.",
    "figs": ["Stress response across agar, hydroponics and soil."]},
   {"h": "Containment for plant work",
    "note": "Where the plants were grown, who had access, and how material was "
            "disposed of. Cross-link to Safety."},
 ]},

{
 "slug": "measurement", "tab": "wetlab", "title": "Measurement",
 "lede": "We could not buy the instrument this project needed, so we built it, "
         "and then had to prove it told the truth.",
 "owner": "Dry lab and wet lab",
 "award": ("special", "Best Measurement",
           "Well-reported measurements are the only way to show whether "
           "hardware is functioning correctly, whether data are reliable and "
           "whether a result is actually important.",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "What we chose to measure, and why",
    "note": "Name the quantity, the unit and the decision it feeds. A "
            "measurement that changes no decision does not belong on this "
            "page."},
   {"h": "The in-line photometer",
    "note": "Optical path, detector, sampling rate, and why in-line rather "
            "than pulling samples.",
    "figs": ["The photometer in the flow path."]},
   {"h": "Calibration",
    "note": "Against what, over what range, how often, and what the residuals "
            "looked like.",
    "figs": ["Calibration curve with residuals."]},
   {"h": "Uncertainty, replicates and controls",
    "note": "State the uncertainty as a number. Say how many replicates and "
            "whether they are technical or biological."},
   {"h": "Three weeks of continuous logging",
    "note": "What continuous logging bought us that endpoint sampling could "
            "not, including the pump failure."},
   {"h": "Comparison with a benchtop instrument",
    "note": "Agreement, bias, and where the two diverge. Without this the "
            "photometer is an assertion."},
   {"h": "How we report",
    "note": "Units, significant figures, and the raw data. Say where the raw "
            "files are."},
 ]},

{
 "slug": "safety-and-security", "tab": "wetlab", "title": "Safety and Security",
 "lede": "What could go wrong with a live culture in a field, and what we did "
         "about each one.",
 "owner": "Safety officer",
 "award": ("special", "Safety and Security Award",
           "Can you take the next step in progress towards knowledge, "
           "understanding, and tools that will make the use of synthetic "
           "biology safer and more secure?",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "How we assessed risk",
    "note": "The method, before any findings. Who did it, against what "
            "framework, and how often it was revisited.",
    "table": (["Risk", "Where it arises", "Likelihood", "Consequence",
               "Control", "Residual"],
              [["", "", "", "", "", ""] for _ in range(5)])},
   {"h": "Biological risk",
    "subs": [
      {"h": "Chassis", "note": "B. subtilis 168, risk group, and why it was "
       "chosen. Note that it sporulates, which cuts both ways."},
      {"h": "Payload", "note": "ACC deaminase, in the open literature since "
       "the 1990s. Say what it does and does not do in a non-target organism."},
      {"h": "Escape", "note": "The membrane is intended to retain every cell. "
       "Intended, not demonstrated. The second containment layer does not "
       "exist yet."},
    ],
    "callout": ("unproven", "Containment is a design intent",
                "Retention has not been demonstrated in our hands, and the "
                "second containment layer has not been built. Contained use is "
                "a classification we are pursuing, not one we hold.")},
   {"h": "Chemical and physical risk",
    "note": "Reagents, high-intensity LEDs, pressure in the flow path, mains "
            "power near water."},
   {"h": "Security and dual use",
    "note": "A retaskable expression slot is the project's best feature and "
            "its security question. Answer it directly."},
   {"h": "Containment design",
    "note": "What is engineered in rather than administered: membrane, "
            "enclosure, interlocks, kill conditions."},
   {"h": "Lab practice, training and supervision",
    "note": "Who was trained, on what, by whom, and who was allowed to work "
            "alone. This is a high-school team; say what the supervision "
            "actually was."},
   {"h": "Shipping, disposal and incidents",
    "note": "Autoclave and waste route, and what happened the one time "
            "something went wrong."},
   {"h": "The iGEM safety forms",
    "note": "Which forms were filed and when. Link to the Safety Hub."},
 ]},

{
 "slug": "notebook", "tab": "wetlab", "title": "Wet Lab Notebook",
 "lede": "The bench record in order, month by month.",
 "owner": "Wet lab",
 "award": None,
 "intro": "Entries are dated and chronological. Each one carries what it was "
          "for, what was done, what came out, and who was there. The "
          "photographs are the team's own, filed by date.",
 "sections": notebook_sections(True),
},

# ============================================================= DRY LAB =======

{
 "slug": "model", "tab": "drylab", "title": "Math Model",
 "lede": "The equations behind sensing, expression and release, and the design "
         "decisions they changed.",
 "owner": "Dry lab, modelling",
 "award": ("special", "Best Model",
           "This award is for teams who build a model of their system and use "
           "it to inform system design or simulate expected behavior before, "
           "or in conjunction with, experiments in the wet lab.",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "What the model is for",
    "note": "Name the decision the model exists to make. A model that informs "
            "nothing wins nothing."},
   {"h": "Scope and assumptions",
    "note": "List every assumption as a numbered item, so the sensitivity "
            "section can refer to them by number."},
   {"h": "Sensing and the light switch",
    "note": "CcaS/CcaR to P_cpcG2. State the transfer function you assume from "
            "photon flux to transcription rate, and mark it as assumed.",
    "callout": ("borrowed", "Borrowed parameter",
                "Roughly 105 minutes to half-maximum is a published value from "
                "a different organism at a different wavelength. It is not "
                "ours, and the brief records that what it is 105 minutes to "
                "half-maximum of is not yet on record.")},
   {"h": "Expression and translation", "note": ""},
   {"h": "Transport across the membrane",
    "note": "This is where the cutoff decision shows up as a number. Run it "
            "for both candidate devices."},
   {"h": "Parameters",
    "note": "Every parameter, its value, its unit, and its source. Mark ours, "
            "borrowed and guessed differently.",
    "table": (["Symbol", "Meaning", "Value", "Unit", "Source", "Ours?"],
              [["", "", "", "", "", ""] for _ in range(6)])},
   {"h": "Sensitivity analysis",
    "note": "Which assumptions the answer actually depends on.",
    "figs": ["Sensitivity of the predicted output to each parameter."]},
   {"h": "What the model changed about the design",
    "note": "The point of the page. Be specific and short."},
   {"h": "Validation status",
    "note": "The model has not been checked against our own data. Say so "
            "here, not in a footnote."},
 ]},

{
 "slug": "bioreactor-calculations", "tab": "drylab",
 "title": "Bioreactor Calculations",
 "lede": "Sizing, flow and mass transfer for a hollow-fibre vessel small "
         "enough to sit where the crop is.",
 "owner": "Dry lab, reactor",
 "award": None,
 "sections": [
   {"h": "Design brief and constraints",
    "note": "Volume, footprint, power, and what is fixed versus what is "
            "chosen. Reactor dimensions are not on record; settle them first."},
   {"h": "Geometry and volumes",
    "note": "Fibre count, length, inner diameter, packing fraction, "
            "extracapillary volume. Use the compartment vocabulary exactly."},
   {"h": "Flow, shear and residence time",
    "note": "Cross-flow rate, wall shear at the fibre surface, and the "
            "residence time distribution."},
   {"h": "Mass transfer and oxygen",
    "note": "Oxygen is usually what limits a dense culture. Show the "
            "calculation and the margin."},
   {"h": "Membrane selection",
    "note": "0.2 micron and 50 kDa are not two candidate values, they are two "
            "different devices with opposite consequences. Work both and say "
            "which one makes 'passes only protein' true.",
    "callout": ("unproven", "The unmade decision",
                "Membrane cutoff is unchosen. This is the central open design "
                "decision in the project, not a discrepancy in the notes.")},
   {"h": "Scale-up rules",
    "note": "Scale on wall shear and flux below critical, not geometric "
            "similarity, and declare which similarity group is being "
            "sacrificed. Credit the advice on the Human Practices page."},
   {"h": "Worked example",
    "note": "One vessel, all the way through, with units at every line."},
   {"h": "Assumption register",
    "note": "Every number used above that is not measured.",
    "table": (["Assumption", "Value used", "Basis", "Effect if wrong"],
              [["", "", "", ""] for _ in range(5)])},
 ]},

# NOT GENERATED: hardware.
#
# /hardware is the students' own build — a hub, three scroll-driven 3D teardowns
# assembled from the real STLs, and the 62-page scanned notebook. It arrived as
# a standalone site and now lives at wiki/hardware/, keeping the standard URL
# that Best Hardware is judged from.
#
# generate.py would skip it anyway, because the page carries no generated
# marker, but leaving a scaffold spec here would invite somebody to run
# `generate.py hardware --force` and destroy it. The section's own
# documentation is hardware/README.md and notes/hardware-handoff.md.

{
 "slug": "software", "tab": "drylab", "title": "Software",
 "lede": "The control code, the logging, and the analysis that turns a serial "
         "stream into a figure.",
 "owner": "Dry lab, software",
 "award": ("special", "Best Software Tool",
           "To be eligible, your software has to be documented and made "
           "available under an OSI-approved open-source license.",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "What it does",
    "note": "In non-technical language first. A reader who does not code "
            "should still learn what problem this solves."},
   {"h": "Getting started",
    "note": "Install, run, and a first result. Screenshots.",
    "figs": ["The tool running."]},
   {"h": "Control firmware", "note": "What runs on the instrument: loop rate, "
    "safety interlocks, what happens when a sensor stops answering."},
   {"h": "Logging and analysis", "note": "File format, how a run becomes a "
    "figure, and how somebody re-runs our analysis on our data."},
   {"h": "Design choices", "note": "The decisions that were not obvious, and "
    "what was given up for each."},
   {"h": "Testing", "note": "What is tested, what is not, and how you would "
    "know if it were wrong."},
   {"h": "Repository and licence",
    "note": "Software judged for this award has to be on iGEM's GitLab, under "
            "an OSI-approved licence. Link it here.",
    "callout": ("medal", "Where the code must live",
                "Teams applying for the Software award must host the source on "
                "iGEM's GitLab at gitlab.igem.org/2026/software-tools/. Code "
                "on any other host cannot be judged.")},
   {"h": "Limits", "note": ""},
 ]},

{
 "slug": "peptide-design", "tab": "drylab", "title": "Peptide Design",
 "lede": "Choosing the protectant, and letting its size decide the membrane.",
 "owner": "Dry lab, design",
 "award": None,
 "sections": [
   {"h": "Why ACC deaminase",
    "note": "In the open literature since the 1990s. Nothing about the biology "
            "is proprietary, which is the argument, not a weakness."},
   {"h": "Sequence selection",
    "note": "Which source organism, which variant, and what ruled the others "
            "out.",
    "table": (["Candidate", "Source organism", "Length", "Why kept or dropped"],
              [["", "", "", ""] for _ in range(4)])},
   {"h": "Structure and oligomeric state",
    "note": "Molecular weight and oligomeric state are what decide the "
            "membrane cutoff. Look them up and cite them; do not supply them "
            "from memory."},
   {"h": "In silico work",
    "note": "Whatever was actually run: alignment, structure prediction, "
            "signal peptide prediction. Name the tool and the version.",
    "figs": ["Predicted structure, with the feature that matters marked."]},
   {"h": "Expression and secretion design",
    "note": "Codon usage for B. subtilis, signal peptide, tags, and what each "
            "costs."},
   {"h": "What this sets for the membrane",
    "note": "Carry the size straight into the cutoff decision and link to the "
            "Bioreactor Calculations page."},
   {"h": "Validation status",
    "note": "Nothing here has been confirmed at the bench. Say it plainly."},
 ]},

{
 "slug": "drylab-notebook", "tab": "drylab", "title": "Dry Lab Notebook",
 "lede": "The computational and hardware record in order, month by month.",
 "owner": "Dry lab",
 "award": None,
 "intro": "Entries are dated and chronological: model versions, firmware "
          "revisions, board bring-ups, and the analyses that produced each "
          "figure elsewhere on this wiki.",
 "sections": notebook_sections(True),
},

# ========================================================== ENGAGEMENT =======

{
 "slug": "human-practices", "tab": "engagement",
 "title": "Integrated Human Practices",
 "lede": "A change log, not an attendance record. Every entry names a person "
         "and the thing about the project that is different because of them.",
 "owner": "Human practices",
 "award": ("medal", "Silver Medal Criterion #2 · Best Integrated Human Practices",
           "Explain how you have determined your work is responsible and good "
           "for the world. How does your project affect society, and how does "
           "society influence the direction of your project?",
           "https://competition.igem.org/judging/medals"),
 "sections": [
   {"h": "How we work with people",
    "note": "The rule first: an entry without a design change is a photograph "
            "of a meeting and does not go on this page. Then how conversations "
            "were recorded and consented to."},
   {"h": "Who we spoke to",
    "note": "Everyone, including the conversations that changed nothing. The "
            "change column is what a judge reads.",
    "table": (["Date", "Who", "Their expertise", "What changed in the project"],
              [["", "", "", ""] for _ in range(8)])},
   {"h": "The change log",
    "note": "One sub-section per entry that produced a design change. Do not "
            "merge two separate conversations into one entry.",
    "subs": [
      {"h": "陳惠雯, dew-mulch farmer", "note": "21 July 2026, on her farm. "
       "Moved dosing off a wall clock and onto soil-moisture state. The "
       "verbatim sentence was not transcribed; do not invent one."},
      {"h": "Dr. Pak K. Yuet, on adapting rather than inventing",
       "note": "18 April 2026. Adapt existing reactor designs rather than "
       "chase novelty."},
      {"h": "Dr. Pak K. Yuet, on how to scale",
       "note": "16 July 2026. Scale on wall shear and flux below critical, not "
       "geometric similarity, and declare which similarity group is being "
       "sacrificed. We owe him a written justification for hollow-fibre over "
       "the packed-bed he recommended; that document belongs here."},
    ]},
   {"h": "Conversations not yet publishable",
    "note": "Dr. Paul Verslues, Prof. Cheng, Prof. Huang, CH Biotech, 源鮮 "
            "YesHealth, the 農民市集 growers and the public forum. Notes are "
            "untranscribed and no design change is on record. Either transcribe "
            "them or leave them off, and never merge two people into one entry."},
   {"h": "What we chose not to change",
    "note": "Advice taken and refused, with the reason. This is usually the "
            "most convincing section on an IHP page."},
   {"h": "Values, framing and who carries the risk",
    "note": "Who benefits, who is exposed, and who was not in the room."},
   {"h": "What is still open", "note": ""},
 ]},

{
 "slug": "education", "tab": "engagement", "title": "Education",
 "lede": "What we taught, who we taught it to, and what we can show actually "
         "stuck.",
 "owner": "Education",
 "award": ("special", "Best Education",
           "Education activities must promote scientific learning and avoid "
           "simply proselytizing or marketing synthetic biology and/or iGEM. "
           "Document your approach, and what was learned by everyone involved.",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "What we set out to do",
    "note": "A learning aim, not an audience count. Say who was not already "
            "being reached."},
   {"h": "Who we worked with",
    "note": "",
    "table": (["Date", "Audience", "Format", "Reach", "What we measured"],
              [["", "", "", "", ""] for _ in range(6)])},
   {"h": "The programmes",
    "note": "One sub-section each: what happened, what the materials were, and "
            "what the room actually did."},
   {"h": "Materials we made",
    "note": "Downloadable, reusable, and stated licence. Files must be hosted "
            "on iGEM servers to be judged."},
   {"h": "What stuck",
    "note": "Evidence, not enthusiasm. Pre and post, or work the participants "
            "produced."},
   {"h": "Two-way, not one-way",
    "note": "What we learned from the people we taught, and what it changed."},
   {"h": "What we would change", "note": ""},
 ]},

{
 "slug": "entrepreneurship", "tab": "engagement", "title": "Entrepreneurship",
 "lede": "Who would own one of these, what it would cost them, and how it "
         "would reach a field.",
 "owner": "Entrepreneurship",
 "award": ("special", "Best Entrepreneurship",
           "Successful teams will construct a business plan based on customer "
           "needs and expert knowledge on feasibility, and create a minimum "
           "viable product.",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "The business case in one page",
    "note": "The economic unit is the irrigation line and the owner is the "
            "cooperative, not the individual farmer. Say this early or the "
            "numbers will not reconcile with the headline."},
   {"h": "Customer discovery",
    "note": "Who we asked, what they said, and which assumption each answer "
            "killed."},
   {"h": "Market and jurisdiction",
    "note": "Taiwan first. Size it with sourced figures and do not borrow the "
            "global context numbers to stand in for a market."},
   {"h": "Cost structure",
    "note": "Capital cost has no total yet, so no affordability claim is "
            "available. Recurring cost is the other half and is unaddressed: "
            "feed medium, replacement fibre modules, power, network, water "
            "quality, and who stops a weeks-long culture contaminating.",
    "callout": ("unproven", "No bill of materials total",
                "Cost is a design target, not a result. Until a total exists, "
                "no page, headline or spoken pitch may use cheap, low-cost or "
                "affordable.")},
   {"h": "Ownership and route to market",
    "note": "Cooperative ownership, 產銷班, service model, or licence. Pick one "
            "and defend it."},
   {"h": "Minimum viable product",
    "note": "What the smallest sellable version is, and what it does not do."},
   {"h": "Risks and what would kill it", "note": ""},
 ]},

{
 "slug": "sustainability", "tab": "engagement", "title": "Sustainability",
 "lede": "Measuring ReLeaf against the Sustainable Development Goals, "
         "including the goals it does not touch.",
 "owner": "Sustainability",
 "award": ("special", "Best Sustainable Development Impact",
           "Demonstrate how you have evaluated your project ideas against one "
           "or more of the SDGs, how you've consulted with SDG stakeholders, "
           "and how you've begun to form collaborations around the SDGs.",
           "https://competition.igem.org/judging/awards/special"),
 "sections": [
   {"h": "How we evaluated the project",
    "note": "The method before the findings: which goals were considered, "
            "against what targets, and who assessed."},
   {"h": "SDG 2 · Zero hunger",
    "note": "Target-level, not goal-level. Name the target number."},
   {"h": "SDG 6 · Clean water and sanitation", "note": ""},
   {"h": "SDG 9 · Industry, innovation and infrastructure",
    "note": "This is the goal the project's actual argument sits under: access "
            "to the means of production. Give it the most room."},
   {"h": "SDG 12 · Responsible consumption and production", "note": ""},
   {"h": "SDG 13 · Climate action",
    "note": "Careful. The brief rules out climate as the project's thesis. "
            "Claim only what a working deployment would actually change."},
   {"h": "Stakeholder consultation",
    "note": "Who from outside the team assessed these claims."},
   {"h": "Where the project does not help",
    "note": "The section that makes the rest credible."},
 ]},

{
 "slug": "laws-and-regulations", "tab": "engagement",
 "title": "Laws and Regulations",
 "lede": "The gate is regulatory, not scientific. This page is what the gate "
         "is actually made of in Taiwan.",
 "owner": "Human practices, legal",
 "award": None,
 "sections": [
   {"h": "Why regulation is the real barrier",
    "note": "Registration cost and time are the reason a smallholder cannot be "
            "served. Use the sourced figures and flag that they have not been "
            "re-checked against 2026."},
   {"h": "Taiwan: the rules that apply",
    "note": "Name the statute and the agency. Do not write 'in most "
            "jurisdictions', which is an unsourced claim about law."},
   {"h": "Contained use, and what we would have to show",
    "note": "Contained use is a classification we are pursuing, not one we "
            "hold. Set out what the regulator would require.",
    "callout": ("unproven", "Not confirmed",
                "No Taiwan regulator has confirmed a contained-use "
                "classification for this device.")},
   {"h": "Comparison: the EU and US routes",
    "note": "For orientation only, and clearly marked as such.",
    "table": (["Jurisdiction", "Route", "Typical time", "Typical cost",
               "Source"], [["", "", "", "", ""] for _ in range(3)])},
   {"h": "Who we asked",
    "note": "Regulators, lawyers, industry. Cross-link to Human Practices "
            "rather than repeating the entry."},
   {"h": "What is still unconfirmed", "note": ""},
 ]},

{
 "slug": "geospatial-analysis", "tab": "engagement",
 "title": "Geospatial Analysis",
 "lede": "Where plant stress actually bites, and whether it overlaps with the "
         "farms this device could reach.",
 "owner": "Dry lab, GIS",
 "award": None,
 "sections": [
   {"h": "The question the map answers",
    "note": "A map that does not change a decision is decoration. Name the "
            "decision."},
   {"h": "Data sources",
    "note": "Every layer: what it is, who publishes it, resolution, year, "
            "licence.",
    "table": (["Layer", "Publisher", "Resolution", "Year", "Licence"],
              [["", "", "", "", ""] for _ in range(4)])},
   {"h": "Method",
    "note": "Projection, resampling, how layers were combined, and the "
            "software. Enough that somebody could redo it."},
   {"h": "Results",
    "note": "",
    "figs": ["Salinity and drought stress, mapped against farm size."]},
   {"h": "Taiwan at farm scale",
    "note": "Zoom to the jurisdiction the project is actually for."},
   {"h": "Limits",
    "note": "Resolution, currency of the data, and the ecological fallacy of "
            "reading a farm off a raster cell."},
   {"h": "Reproducing this",
    "note": "Scripts and data on an iGEM-hosted repository, or it cannot be "
            "judged."},
 ]},

{
 "slug": "data-physicalization", "tab": "engagement",
 "title": "Data Physicalization",
 "lede": "Our data, rebuilt as objects people can pick up, for the readers a "
         "figure was never going to reach.",
 "owner": "Engagement",
 "award": None,
 "sections": [
   {"h": "Why make the data physical",
    "note": "Who was not reached by the chart, and what a physical object does "
            "that the chart does not."},
   {"h": "What we built",
    "note": "",
    "figs": ["The physicalization, and the dataset behind it."]},
   {"h": "From dataset to object",
    "note": "The encoding: which variable became which physical property, and "
            "at what scale. Show the mapping honestly, including what was "
            "distorted to make it hold together."},
   {"h": "Fabrication",
    "note": "Materials, process, files. Somebody else should be able to make "
            "one."},
   {"h": "Where it was shown",
    "note": "Venue, audience, and what people did with it."},
   {"h": "What people understood that they had not before",
    "note": "Evidence. What people said or did, not how it felt."},
   {"h": "Files and instructions", "note": ""},
 ]},

{
 "slug": "ai-responsibility", "tab": "engagement",
 "title": "AI Responsibility",
 "lede": "Where we used AI, where we refused to, and how a reader can tell "
         "which is which.",
 "owner": "Whole team",
 "award": None,
 "intro": "The 2026 Judge Handbook is explicit that feeding a team's wiki or "
          "project description into an AI system and submitting the output as "
          "the team's own work is not acceptable. This page is our account of "
          "where the line was, and how we held it.",
 "sections": [
   {"h": "Our position",
    "note": "One paragraph, written by a person, saying what the team decided "
            "and why."},
   {"h": "Where we used it",
    "note": "Task by task. Be specific: which tool, for what, and who checked "
            "the output.",
    "table": (["Task", "Tool", "What it produced", "Who verified it", "How"],
              [["", "", "", "", ""] for _ in range(6)])},
   {"h": "Where we refused to use it",
    "note": "Results, numbers, quotes, human practices entries, and anything "
            "presented as the team's own reasoning. Say so, and say why."},
   {"h": "How we checked",
    "note": "The verification procedure. An unverified generated number is a "
            "fabricated number."},
   {"h": "Data, consent and privacy",
    "note": "Whether any interview, photograph or personal data went into a "
            "third-party system, and on whose consent."},
   {"h": "Bias, and who the tools do not serve",
    "note": "Language, agricultural context, and what the models did badly on "
            "繁體中文 material."},
   {"h": "What we would tell another team", "note": ""},
 ]},

{
 "slug": "inclusivity", "tab": "engagement", "title": "Inclusivity",
 "lede": "Who the project is built for, who it would leave out, and what we "
         "changed once we could name them.",
 "owner": "Engagement",
 "award": ("special", "Inclusivity Award",
           "Who is allowed to have a voice in iGEM, synthetic biology and "
           "science more broadly? How have you developed new opportunities to "
           "eliminate barriers?",
           "https://competition.igem.org/judging/awards/special"),
 "unlisted": True,
 "sections": [
   {"h": "Who this project is for", "note": ""},
   {"h": "Barriers we found",
    "note": "Language, cost, land tenure, literacy, connectivity, gender. "
            "Name them from evidence, not from assumption."},
   {"h": "What we changed", "note": "Design changes, not intentions."},
   {"h": "Language and access",
    "note": "English-first pages with 繁體中文 where a name, a quote or a term "
            "is Chinese, and a farmer-facing artefact that inverts that. Say "
            "what exists in which language."},
   {"h": "Inside the team",
    "note": "Who got to do what, and how that was decided."},
   {"h": "What we learned", "note": ""},
 ]},

# =============================================================== TEAM ========

{
 "slug": "milestone", "tab": "team", "title": "Milestone",
 "lede": "The year in order, from the first meeting to the freeze.",
 "owner": "Whole team",
 "award": None,
 "intro": "A timeline, not a notebook. Each entry is something that changed "
          "the shape of the project: a decision, a first result, a deadline "
          "met. The day-by-day record lives in the wet lab and dry lab "
          "notebooks.",
 "sections": [
   {"h": "The year at a glance",
    "note": "One row per milestone. Keep it short enough to read standing up.",
    "table": (["Date", "Milestone", "Why it mattered", "Where it is documented"],
              [["", "", "", ""] for _ in range(12)])},
   {"h": "Before the season",
    "note": "How the team formed and how the project was chosen."},
   {"h": "Winter: choosing the problem",
    "note": "December 2025 to February 2026."},
   {"h": "Spring: first builds",
    "note": "March to May 2026."},
   {"h": "Summer: the long runs",
    "note": "June to August 2026."},
   {"h": "Autumn: the argument",
    "note": "September to the wiki freeze."},
 ]},

{
 "slug": "gallery", "tab": "team", "title": "Gallery",
 "lede": "Photographs from the bench, the field and the road to Paris.",
 "owner": "Whole team",
 "award": None,
 "intro": "Everyone in these photographs has agreed to appear. The wiki is "
          "archived and stays public, so nothing here carries a face, a name "
          "or a location that its subject has not cleared.",
 "sections": [
   {"h": "How this page is filled",
    "note": "Photographs come from iGEM2026_Images, filed by month. The naming "
            "convention is in that folder's README. Before the freeze they "
            "have to be re-hosted on static.igem.wiki, because the wiki blocks "
            "images served from anywhere else."},
   {"h": "The year in photographs",
    "note": "A month-by-month grid. Add each month as its own block once the "
            "photographs for it are chosen and cleared."},
   {"h": "The people",
    "note": "Portraits and working shots. Cross-link to Members."},
   {"h": "Consent and credit",
    "note": "Who took each photograph, and where consent is recorded."},
 ]},

]
