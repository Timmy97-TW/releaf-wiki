#!/usr/bin/env python3
"""
Assemble protein-design/molecular-dynamics/index.html.

9 October 2026. Timmy asked for one Molecular Dynamics page that carries the
whole argument: the analysis, the plots, the discussion and the animations that
were only inside the nine reports under /md-simulations/, with the reports left
as optional click-ins. The page is also meant to read as the third chapter of
Protein Design, after Methodology and Sprints and Results, and to say plainly
that molecular dynamics was run on BoPEP4 alone while the design work and the
codon optimisation covered ACC deaminase and LEA14 as well.

Why a script rather than hand-edited HTML: every word a student wrote is lifted
out of the previous build by its card heading and written through untouched, so
restructuring the page cannot quietly reword them. Everything this script adds
carries class="ai". Students edit the HTML afterwards; this file exists so the
one restructuring pass could be audited.

Inputs
  build/_md_src.html                             the 8 October build, for prose
  build/_md_figs/*.svg                           build/md_page_figs.py
  assets/data/md-anim/*.json                     build/md_page_anim.py
"""
import os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(HERE, "protein-design", "molecular-dynamics", "index.html")
FIGS = os.path.join(HERE, "build", "_md_figs")
# the 8 October build, kept so the student prose has one fixed source and a
# re-run of this script cannot compound its own output
SRC  = os.path.join(HERE, "build", "_md_src.html")

OLD = open(SRC).read()


def card(name):
    """The <article class="card"> whose heading is `name`, verbatim."""
    m = re.search(r'<article class="card[^"]*">\s*<h4 class="card__name">'
                  + re.escape(name) + r'</h4>(.*?)</article>', OLD, re.S)
    if not m:
        sys.exit("card not found: " + name)
    return m.group(1).strip()


def key(n):
    """The nth <div class="card__key">, verbatim."""
    ms = re.findall(r'<div class="card__key">(.*?)</div>', OLD, re.S)
    return ms[n].strip()


def intro():
    m = re.search(r'<div class="lede-c">\s*(<p>.*?</p>\s*<p>.*?</p>)\s*</div>', OLD, re.S)
    return m.group(1).strip()


def quote():
    m = re.search(r'<blockquote>(.*?)</blockquote>', OLD, re.S)
    return "<blockquote>" + m.group(1) + "</blockquote>"


def fig(name):
    return open(os.path.join(FIGS, name + ".svg")).read().rstrip()


def figure(name, caption):
    return ('<figure class="figwrap">\n<div class="figwrap__pan">\n' + fig(name) +
            '\n</div>\n<figcaption class="ai">' + caption + '</figcaption>\n</figure>')


FOOT = OLD[OLD.index('  <footer class="footer2">'):]


# ---------------------------------------------------------------------------
HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Molecular Dynamics | Protein Design | ReLeaf &middot; iGEM 2026</title>
  <meta name="description" content="Nine all-atom trajectories of BoPEP4 against the PEPR1 ectodomain, with the analysis, the plots and the animations on the page: a purification tag that passed every check it should have failed, a salt bridge on no published list, the apoplast at pH 5.5, and the receptor on its own." />
  <link rel="icon" href="../../assets/img/logo.png" />
  <link rel="stylesheet" href="../../assets/css/tokens.css" />
  <link rel="stylesheet" href="../../assets/css/nav.css" />
  <link rel="stylesheet" href="../../assets/css/page.css" />
  <link rel="stylesheet" href="../../assets/css/engage.css?v=1007s" />
  <link rel="stylesheet" href="../protein.css?v=202610091" />
</head>
<body class="engage pd">
<!--
  SOURCE. The prose is the students' own, from "3. Molecular Dynamics
  Subpage/MD Writing.docx", carried through from the 8 October build without a
  word changed. The document has two tabs; Tab 2 is the later and fuller draft
  and covers all nine runs, and it is the text here. Tab 1 contributes three
  things Tab 2 has no equivalent of: its Introduction, its framing paragraph on
  the four Asn23 contacts, and the paragraph stating the expectation before the
  tagged run, which is printed as a quotation because the run bore out only
  half of it. Where the two tabs disagree the later one wins: Tab 1 states
  flatly that a tagged peptide "cannot engage PEPR1 as designed", and Tab 2
  withdraws that to "we cannot say that the His tag ablates receptor
  interaction ... our simulations do show that the tag ablates the native
  Asn23-Arg487 salt bridge". The narrower claim is the one on the page.

  Tab 2 carries a "*revise from here" marker before "Reassessing Arg18 Contact
  Network". That is the students' note to themselves, so it is not printed; the
  sections after it are on the page as written and will be replaced when they
  revise them.

  9 OCTOBER 2026. Restructured on Timmy's instruction so the whole argument is
  on this page and the nine reports under /md-simulations/ are optional. Three
  things are new and all of them carry class="ai":

    1. the page now opens by saying where molecular dynamics sits in Protein
       Design, after Methodology and after Sprints and Results, and by stating
       the scope plainly: MD ran on BoPEP4 only, while the design work and the
       codon optimisation covered ACC deaminase and LEA14 as well. That was
       implicit before and a judge could have read it the wrong way;
    2. seven plots, inline SVG, written by build/md_page_figs.py out of the
       same analysis JSON the reports draw, so a reader never has to leave the
       page to see the evidence for a claim;
    3. three trajectory viewers, assets/js/md-viewer.js against the compact
       payloads build/md_page_anim.py writes. They do not load until a reader
       reaches them and they do not animate for a reader who has asked for
       reduced motion.

  The page is assembled by build/md_page.py, which lifts every student card out
  of the previous build by its heading so a restructuring pass cannot reword
  them. Student prose is set plain; anything carrying class="ai" is drafted.
-->

  <div id="site-nav" data-base="../../" data-tab="drylab" data-page="protein-design"></div>
  <div class="sitenav-spacer"></div>

  <header class="pagehead pagehead--hero">
    <div class="pagehead__hero">
      <img src="../../assets/img/protein-design/hero-md.webp"
           alt="Molecular surface of the PEPR1 binding groove with the C-terminal end of the BoPEP4 peptide running along it and the final residue, Asn23, buried in a pocket at the closed end of the groove."
           width="1800" height="787" fetchpriority="high" />
      <div class="pagehead__heroinner">
        <p class="pagehead__eyebrow">
          <a href="../../">ReLeaf</a> <i>/</i> Dry Lab <i>/</i> <a href="../">Protein Design</a> <i>/</i> Molecular Dynamics
        </p>
        <h1 class="pagehead__title">Molecular Dynamics</h1>
      </div>
    </div>

    <div class="pagehead__inner">
      <p class="pagehead__herocap ai"><b>One bond, measured nine ways.</b> Asn23, the last residue of BoPEP4, buried at the closed end of the PEPR1 groove where its free carboxylate reaches Arg487. Seven of the nine runs are, in the end, a question about whether that bond holds.</p>
      <p class="pagehead__lede ai">Docking scores a pose. Molecular dynamics asks whether the pose survives being shaken. Nine all-atom trajectories were run on the PEPR1 ectodomain, eight of them carrying a peptide. Between them they sent one ordered construct back to be redrawn, withdrew the structural case for a second, and turned pH from an assumption into a parameter. Everything the set found is on this page, with the plots and the trajectories beside the paragraph that argues from them; the nine per-run reports are there if you want the tables underneath.</p>
      <ul class="pagehead__meta">
        <li><b>Section</b><span>Dry Lab &middot; Protein Design</span></li>
        <li><b>Written by</b><span>Dry lab, protein design</span></li>
        <li><b>Protectant</b><span>BoPEP4 only</span></li>
        <li><b>Last updated</b><span>9 October 2026</span></li>
        <li><b>Status</b><span>Nine runs complete; ternary complex, ACC deaminase and LEA14 outstanding</span></li>
      </ul>
    </div>
  </header>

  <nav class="stepnav" aria-label="Protein Design section">
    <div class="stepnav__inner">
      <a class="stepnav__home" href="../">Protein Design</a>
      <a class="step" href="../methodology/">Methodology</a>
      <a class="step" href="../sprints/">Sprints and Results</a>
      <a class="step" href="./" aria-current="page">Molecular Dynamics</a>
      <a class="step" href="../../md-simulations/">MD reports</a>
      <a class="step" href="../../peptide-design/">Worked case</a>
    </div>
  </nav>

  <div class="pagewrap">
    <details class="toc" open>
      <summary>Contents</summary>
      <div class="toc__inner"><p class="toc__title">On this page</p></div>
    </details>

    <main class="pagebody">

      <!-- ============================================ 1 · WHERE THIS SITS -->
      <section class="sec" id="where-this-sits">
        <h2>Where this sits, and what it covers</h2>

        <div class="lede-c"><p class="ai">Protein Design runs in three stages. <a href="../methodology/">Methodology</a> is how a protectant was chosen and how a peptide became a docking problem. <a href="../sprints/">Sprints and Results</a> is every design run the section made and what came back as a number. This page is the stage after both: the surviving designs put into explicit water and allowed to move, to find out whether the pose a docking score ranked is a pose that holds.</p></div>

        <p class="ai">The reason that stage exists is the finding the section keeps running into. The score that ranks a docked pose is a weighted sum in arbitrary units, and the project's own audit on 30 July found it is <b>93% explainable by peptide length and net charge alone</b>, with a correlation to measured activities of about zero. <a href="../sprints/#reading-a-docking-score">Sprints and Results says so in the students' words</a>. Once that is true, the load-bearing evidence has to move somewhere, and it moved here: to named atom pairs, held or not held, counted frame by frame.</p>

        <h3 id="scope">Molecular dynamics ran on BoPEP4 only</h3>

        <p class="ai">ReLeaf carries three protectants. <b>BoPEP4</b> is a twenty-three residue elicitor peptide that signals through the PEPR1 receptor; <b>LEA14</b> is a folded protein that stabilises other proteins under osmotic stress; <b>ACC deaminase</b> is an enzyme that lowers stress-induced ethylene. All three were designed, and all three were codon-optimised and packaged for ordering. Only BoPEP4 was simulated, and the reason is structural rather than a matter of priority: it is the only one of the three with a solved receptor complex, PDB&nbsp;5GR8, to build a trajectory on and to check the result against. <b>Nothing on this page speaks for LEA14 or ACC deaminase.</b></p>

        <div class="tablewrap">
          <table class="scope">
            <caption class="visually-hidden">What the section did to each of the three protectants, and where it is written up</caption>
            <thead>
              <tr>
                <th scope="col">Protectant</th>
                <th scope="col">Designs drawn</th>
                <th scope="col">Docked</th>
                <th scope="col">Molecular dynamics</th>
                <th scope="col">Codon optimised and packaged</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">BoPEP4<small>23 residues, PEPR1 ligand</small></th>
                <td class="is-yes ai">Truncations, alanine scan, point substitutions, tandem repeats</td>
                <td class="is-yes ai">HADDOCK against PEPR1, and a threaded ternary with BAK1</td>
                <td class="is-only is-yes ai">Nine trajectories &middot; this page</td>
                <td class="is-yes ai">ViennaRNA, SignalP, ordered</td>
              </tr>
              <tr>
                <th scope="row">LEA14<small>folded, no receptor</small></th>
                <td class="is-yes ai">K-segment graft, three truncations, C58S</td>
                <td class="is-no ai">Not docked &middot; no receptor complex to dock to</td>
                <td class="is-no ai">None</td>
                <td class="is-yes ai">ViennaRNA, SignalP, ordered</td>
              </tr>
              <tr>
                <th scope="row">ACC deaminase<small>enzyme, PLP cofactor</small></th>
                <td class="is-yes ai">Y156C, V293T, six unpaired cysteines removed, PLP binding test</td>
                <td class="ai">No receptor to dock to; the PLP cofactor was modelled in the site, bound and free</td>
                <td class="is-no ai">None</td>
                <td class="is-yes ai">ViennaRNA, SignalP, ordered</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="ai">The empty cells are the point of the table. The design roster for all three is on <a href="../sprints/">Sprints and Results</a>, the codon optimisation and the signal peptide panel for all three are under <a href="../methodology/#packaging">Packaging</a> on Methodology, and <a href="#not-yet-run">Not yet run</a> at the foot of this page is what molecular dynamics still owes the other two.</p>

        <h3 id="introduction">What a trajectory is for</h3>

        <div class="lede-c">
          ''' + intro() + r'''
        </div>
      </section>

      <!-- ======================================== 2 · WHAT THE SET CHANGED -->
      <section class="sec" id="what-the-set-changed">
        <h2>What the nine runs changed</h2>

        <div class="lede-c"><p class="ai">Four results left this page as a decision rather than as an observation. Each is argued in full in the chapter named beside it; this is the ledger.</p></div>

        <div class="findings">
          <li class="ai"><b>The purification tag moved off the C-terminus.</b> Six histidines after Asn23 consume the free carboxylate that salt-bridges Arg487. Under the project's own distance criterion the tagged run passed; under an atom-resolved, angle-aware one the bidentate salt bridge is present in <b>0.0% of frames against 100% of wild-type frames</b>. The design answer is an N-terminal tag or a synthetic untagged peptide. <a href="#the-histidine-tag">The histidine tag</a></li>
          <li class="ai"><b>pH became a parameter instead of an assumption.</b> The peptide works in the apoplast, nearer pH&nbsp;5.5 than 7. Protonating three histidines recovers the Glu12 to His227 contact from 0.8% to <b>99.9% of frames</b> on the full-length peptide, a contact the AtPEP1 benchmark already has at neutral pH. pH&nbsp;5.5 is now the physiologically relevant default and pH&nbsp;7 the control. <a href="#ph-5-5">pH 5.5</a></li>
          <li class="ai"><b>A salt bridge on no published hotspot list explains the construct in hand.</b> Lys7 holds Asp129 at 2.81&nbsp;&Aring; in <b>98.7% of frames</b>, and cutting it is what destabilises 9&ndash;23, not the new terminus the team first blamed. The ladder is not monotonic, and the prediction it makes, a K7A full-length mutant, is testable. <a href="#truncation-ladder">Truncation ladder</a></li>
          <li class="ai"><b>The K18R rationale narrowed and the substitution was not ordered.</b> Lys18 holds Asp348 in 53.7% of frames over a 2.55 to 9.37&nbsp;&Aring; range, which is a transient contact rather than the near-complete one the static pose suggested, and Phe371 is held by Gly20 instead. K18R stays plausible on side-chain chemistry; the structural claim under it is withdrawn. <a href="#wild-type">Wild type</a></li>
        </div>

        <div class="shift">
          <div class="shift__col shift__col--from">
            <h6>Before the nine runs</h6>
            <ul>
              <li class="ai">A C-terminal 6&times;His tag was a purification detail, already written into the ordered constructs.</li>
              <li class="ai">pH&nbsp;7 was the only condition, and a sequence difference at Glu12 looked like a deficiency in BoPEP4.</li>
              <li class="ai">9&ndash;23 looked like a reasonable cut because the score across the ladder was flat.</li>
              <li class="ai">K18R was described as completing a contact that was already nearly there.</li>
              <li class="ai">A construct could be ranked on RMSD and contact counts.</li>
            </ul>
          </div>
          <div class="shift__arrow" aria-hidden="true"></div>
          <div class="shift__col shift__col--to">
            <h6>After them</h6>
            <ul>
              <li class="ai">The tag is a chemistry problem at the end that binds, and it belongs on the end that does not.</li>
              <li class="ai">pH&nbsp;5.5 is the default for full-length BoPEP4, and the Glu12 gap was the protonation state, not the sequence.</li>
              <li class="ai">9&ndash;23 is the least stable untagged construct in the set, and 7&ndash;23 restores it.</li>
              <li class="ai">K18R rests on what an arginine side chain can reach, and nothing else.</li>
              <li class="ai">A construct is ranked on named atom pairs, because RMSD does not track them.</li>
            </ul>
          </div>
        </div>

        <aside class="callout ai">
          <b class="callout__label">One standing limit, before any of it</b>
          <p>Thirty nanoseconds is not a binding measurement, one seed per system is not a distribution, and none of this has met a plant or a plate. Everything below is a statement about a model. <a href="#limits">The limits are set out in full</a> and they apply to every number on the page.</p>
        </aside>
      </section>

      <!-- ================================================== 3 · THE SET-UP -->
      <section class="sec" id="how-the-runs-were-set-up">
        <h2>How the nine runs were set up</h2>

        <p class="ai">Every system was built on the PEPR1 ectodomain, residues 29 to 738, taken from PDB&nbsp;5GR8&nbsp;[3] and solvated in explicit OPC water with AMBER&nbsp;ff19SB&nbsp;[1][2], about 127,600 atoms each. Hydrogen mass repartitioning allows a 4&nbsp;fs time step. Each run is 30&nbsp;ns of production from one random seed, 1,500 saved frames: 270&nbsp;ns and 25.9 GPU-hours over the set, on one A100.</p>

        <p class="ai">Four things change across the nine runs and nothing else does: which ligand is in the groove, which of its residues are present, whether the C-terminus is a free chain end, and whether three histidines are protonated. Every number comes from one analysis codebase applied to all nine trajectories, so a column means the same thing from row to row, which is what makes <a href="#across-the-set">the cross-run reading</a> possible at all.</p>

        <div class="tablewrap">
          <table class="data">
            <caption class="visually-hidden">The nine trajectories and the four variables that change between them</caption>
            <thead>
              <tr>
                <th scope="col">Run</th><th scope="col">Ligand</th><th scope="col">Residues</th>
                <th scope="col">C-terminus</th><th scope="col">Protonated His</th>
                <th scope="col">What it is for</th>
              </tr>
            </thead>
            <tbody class="ai">
              <tr><th scope="row">Wild type</th><td>BoPEP4</td><td>1&ndash;23</td><td>free</td><td>0</td><td>the reference every other run is read against</td></tr>
              <tr><th scope="row">AtPEP1 benchmark</th><td>AtPEP1</td><td>7&ndash;23</td><td>free</td><td>0</td><td>the only system with an experimental structure to check against</td></tr>
              <tr><th scope="row">7&ndash;23</th><td>BoPEP4</td><td>7&ndash;23</td><td>free</td><td>0</td><td>tests the terminal-ammonium hypothesis; matches the crystal's span</td></tr>
              <tr><th scope="row">9&ndash;23</th><td>BoPEP4</td><td>9&ndash;23</td><td>free</td><td>0</td><td>the construct that was ordered</td></tr>
              <tr><th scope="row">15&ndash;23</th><td>BoPEP4</td><td>15&ndash;23</td><td>free</td><td>0</td><td>intended as a negative control</td></tr>
              <tr><th scope="row">6&times;His tag</th><td>BoPEP4</td><td>1&ndash;29</td><td><b>blocked</b></td><td>0</td><td>the assumption nobody had checked</td></tr>
              <tr><th scope="row">pH 5.5</th><td>BoPEP4</td><td>1&ndash;23</td><td>free</td><td><b>3</b></td><td>the apoplast, approximated by fixed protonation</td></tr>
              <tr><th scope="row">9&ndash;23 at pH 5.5</th><td>BoPEP4</td><td>9&ndash;23</td><td>free</td><td><b>3</b></td><td>the two changes crossed</td></tr>
              <tr><th scope="row">Apo receptor</th><td>none</td><td>&mdash;</td><td>&mdash;</td><td>0</td><td>the noise floor for anything said about the receptor</td></tr>
            </tbody>
          </table>
        </div>

        <div class="folds">
          <details class="fold">
            <summary>The acceptance gate, as it was written<span class="fold__sub ai">Four criteria, set before the trajectories ran &mdash; and the chapter that breaks one</span></summary>
            <div class="fold__body">
              <p class="ai">Each run was pre-registered against four criteria: receptor C&alpha; RMSD under 3.0&nbsp;&Aring;, peptide backbone RMSD under 4.0&nbsp;&Aring;, the Asn23 to Arg487 distance inside 4&nbsp;&Aring; in more than 60% of frames, and at least three of the four native Asn23 contacts held in more than 60% of frames. A tolerance of &plusmn;1.5&nbsp;&Aring; on each crystal distance was set before any trajectory started.</p>
              <p class="ai">Eight of the nine runs passed. <a href="#ph-5-5">9&ndash;23 at pH&nbsp;5.5</a> is the one that did not. And <a href="#the-histidine-tag">the tagged run passed on a criterion that was measuring an atom the construct does not have</a>, which is the finding of this page that applies backwards to every number the gate produced. The full protocol, with the equilibration schedule, is on <a href="../../md-simulations/#how">MD Simulations</a>.</p>
            </div>
          </details>
        </div>
      </section>

      <!-- =================================================== 4 · THE RUNS -->
      <section class="sec" id="the-runs">
        <h2>The runs</h2>

        <p class="ai">Six chapters. The first is the reference every other run is read against; the last is the one result that needs all nine to exist.</p>

        <div class="rail rail--seg" data-rail data-rail-top>
          <div class="seg"><div class="rail__strip seg__track" role="tablist" aria-label="Molecular dynamics runs">
            <button class="rail__btn seg__btn pl-2" role="tab" type="button" id="t-wt" aria-controls="wild-type" aria-selected="true"><svg class="seg__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 15c3-7 5 7 8 0s5 7 8 0"/></svg>Wild type</button>
            <button class="rail__btn seg__btn pl-3" role="tab" type="button" id="t-trunc" aria-controls="truncation-ladder" aria-selected="false"><svg class="seg__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 6h16M7 12h13M11 18h9"/></svg>Truncation ladder</button>
            <button class="rail__btn seg__btn pl-4" role="tab" type="button" id="t-tag" aria-controls="the-histidine-tag" aria-selected="false"><svg class="seg__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12.5 3.5H20v7.5l-9 9L3.5 12.5z"/><circle cx="16.5" cy="7.5" r="1.3"/></svg>The histidine tag</button>
            <button class="rail__btn seg__btn pl-5" role="tab" type="button" id="t-ph" aria-controls="ph-5-5" aria-selected="false"><svg class="seg__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5c3.2 3.7 5.5 6.5 5.5 9.3A5.5 5.5 0 0 1 12 18.5a5.5 5.5 0 0 1-5.5-5.7c0-2.8 2.3-5.6 5.5-9.3z"/></svg>pH 5.5</button>
            <button class="rail__btn seg__btn pl-1" role="tab" type="button" id="t-apo" aria-controls="the-apo-receptor" aria-selected="false"><svg class="seg__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 19c0-6 2-11 7-14"/><path d="M19 19c0-6-2-11-7-14"/><path d="M4 19h16"/></svg>The apo receptor</button>
            <button class="rail__btn seg__btn pl-6" role="tab" type="button" id="t-set" aria-controls="across-the-set" aria-selected="false"><svg class="seg__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 19V9M9.3 19V5M14.7 19v-7M20 19v-4"/></svg>Across the set</button>
          </div></div>

          <!-- ------------------------------------------------- 4.1 WILD TYPE -->
          <div class="rail__panel chap pl-2" role="tabpanel" id="wild-type" aria-labelledby="t-wt">
            <header class="chap__hero">
              <p class="chap__eyebrow">Runs 1 and 2 of 9</p>
              <h3 class="chap__title" data-no-toc>Wild type</h3>
              <div class="chap__intro"><p class="ai">Full-length BoPEP4, residues 1 to 23, free C-terminus, docked in the PEPR1 groove, beside the AtPEP1 peptide as the crystal resolved it. Nothing is being tested. This is the run every other number on the page is read against, and it is also where two earlier claims were checked and one of them was withdrawn.</p></div>
            </header>

            <article class="card">
              <h4 class="card__name">Wild-type</h4>
              ''' + card("Wild-type") + r'''
            </article>

            ''' + figure("fig-perres",
      "The reference run, residue by residue. Bars are the share of 1,500 frames within 4&nbsp;&Aring; of the receptor; the line is how far each residue moves. The two ends of this peptide do different jobs: the opening GILIGS segment is loose and barely in contact, and the conserved window from Ser15 to Asn23 is in contact almost always and moves less than an &aring;ngstr&ouml;m. That split is the whole case for cutting from the N-terminus and not the C-terminus, and it is why the ladder in the next chapter exists.") + r'''

            <figure class="mdv" data-mdv="wt"
              data-caption="The reference trajectory, 30&nbsp;ns in 100 frames. The dashed line is the one bond everything else is measured against: Asn23's carboxylate to Arg487, which stays inside 4&nbsp;&Aring; in every frame of this run. Drag to turn it, and switch to Pocket to see how deeply the C-terminus sits in the groove. The receptor is drawn from the trajectory mean, which the apo run licenses."></figure>

            <article class="card">
              <h4 class="card__name">Reassessing Arg18 contact network</h4>
              ''' + card("Reassessing Arg18 contact network") + r'''
            </article>

            <div class="chap__end">
              <p class="chap__eyebrow">Reports</p>
              <ul class="runs">
                <li class="run" data-state="good">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/bopep4-wt-round1.html">BoPEP4 wild type, 1 to 23</a></span><span class="run__role">Reference state</span></div>
                  <p class="ai">The per-residue tables behind the plot above, and the full trajectory viewer.</p>
                </li>
                <li class="run" data-state="good">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/atpep1-benchmark-vs-bopep4.html">AtPEP1 7 to 23 benchmark</a></span><span class="run__seq">KQRGKEKVSSGRPGQHN</span><span class="run__role">Benchmark</span></div>
                  <p class="ai">The peptide as resolved in the 5GR8 crystal, run under identical settings. It is the only system with an experimental structure to check against, so it sets the scale the rest are read on.</p>
                </li>
              </ul>
            </div>
          </div>

          <!-- --------------------------------------- 4.2 TRUNCATION LADDER -->
          <div class="rail__panel chap pl-3" role="tabpanel" id="truncation-ladder" aria-labelledby="t-trunc">
            <header class="chap__hero">
              <p class="chap__eyebrow">Runs 3, 4 and 5</p>
              <h3 class="chap__title" data-no-toc>Truncation ladder</h3>
              <div class="chap__intro"><p class="ai">Three cuts from the docking ladder on <a href="../sprints/#the-truncation-ladder">Sprints and Results</a>, taken into simulation: 7&ndash;23, 9&ndash;23 and 15&ndash;23. The construct that was ordered is the one that came back worst, the control that was meant to fail did not, and the explanation is a salt bridge that was on nobody's list.</p></div>
            </header>

            ''' + figure("fig-ladder",
      "Four rungs, and the dip is in the middle. If shorter simply meant weaker, these bars would fall from left to right. Full length, 7&ndash;23 and 15&ndash;23 all hold the clamp above 98% of frames; only the intermediate 9&ndash;23 construct, the one that was ordered, drops to 77.1%, with the bidentate salt bridge present in fewer than half the frames. Length is not the variable. Which residues are present is.") + r'''

            <article class="card">
              <h4 class="card__name">Unidentified salt bridge</h4>
              ''' + card("Unidentified salt bridge") + r'''
            </article>

            <div class="bridge"><p class="ai">The 7&ndash;23 construct was built to test a hypothesis that failed. What it gave instead was the one peptide in the set that can be compared with the crystal structure residue for residue.</p></div>

            <article class="card">
              <h4 class="card__name">7-23 as a benchmark comparison</h4>
              ''' + card("7-23 as a benchmark comparison") + r'''
            </article>

            <article class="card">
              <h4 class="card__name">Negative control</h4>
              ''' + card("Negative control") + r'''
            </article>

            <div class="card__key ai">
              <p>What the ladder hands the wet lab is not a shorter peptide but a test. If the Lys7 to Asp129 anchor is what 9&ndash;23 is missing, then a full-length K7A mutant should be destabilised in the same way without either terminus moving, and the secretion assay already planned against the truncation plateau has a second arm worth running.</p>
            </div>

            <div class="chap__end">
              <p class="chap__eyebrow">Reports</p>
              <ul class="runs">
                <li class="run" data-state="good">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/bopep4-7-23.html">BoPEP4 7 to 23</a></span><span class="run__role">Hypothesis falsified</span></div>
                  <p class="ai">The run that put Lys7 and Lys8 back and restored the clamp, and the per-residue comparison with the crystal benchmark.</p>
                </li>
                <li class="run" data-state="warn">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/bopep4-9-23-vs-wt.html">BoPEP4 9 to 23</a></span><span class="run__role">The construct that was ordered</span></div>
                  <p class="ai">The 94 break events, with the trace that shows them, against wild type.</p>
                </li>
                <li class="run" data-state="good">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/bopep4-15-23-vs-wt.html">BoPEP4 15 to 23</a></span><span class="run__role">Control that did not fail</span></div>
                  <p class="ai">The conserved core on its own, holding its register for the whole trajectory.</p>
                </li>
              </ul>
            </div>
          </div>

          <!-- ----------------------------------------- 4.3 THE HISTIDINE TAG -->
          <div class="rail__panel chap pl-4" role="tabpanel" id="the-histidine-tag" aria-labelledby="t-tag">
            <header class="chap__hero">
              <p class="chap__eyebrow">Run 6 of 9</p>
              <h3 class="chap__title" data-no-toc>The histidine tag</h3>
              <div class="chap__intro"><p class="ai">The construct that was already ordered, simulated to check an assumption nobody had checked. It passed every acceptance criterion the project had written, and it should not have. This is the chapter that changed a construct and changed how the section measures.</p></div>
            </header>

            <article class="card card--white">
              <h4 class="card__name">Why Asn23</h4>
              ''' + card("Why Asn23") + r'''
            </article>

            <div class="chartbox"><div class="charts charts--1"><figure class="fig fig--chart">
              <img src="../../assets/img/peptide-design/pep-asn23-clamp.webp"
                   alt="Surface rendering showing the peptide C-terminus buried inside a pocket of the receptor, with the terminal asparagine drawn as sticks."
                   width="1150" height="950" loading="lazy" decoding="async" />
              <figcaption class="ai">The clamp the tag sits on. Asn23 is not on the surface of the interface, it is inside a pocket at the closed end of the groove, and the group that holds it there is the free carboxylate at the very end of the chain. Fusing six histidines after it consumes that carboxylate into an amide bond.</figcaption>
            </figure></div></div>

            ''' + figure("fig-tagtrace",
      "This is the trace the acceptance criterion watched, for both runs, at the same scale. Nothing in it separates them. Both sit near 2.8&nbsp;&Aring; for the whole trajectory, neither crosses the 4&nbsp;&Aring; line, and on this evidence the tagged construct is a clean pass. What the tagged trace is recording is a neutral amide carbonyl approaching Arg487, because His24 has already consumed the carboxylate into a peptide bond. Between charge centres the same pair is 20.07&nbsp;&Aring; apart.") + r'''

            <article class="card">
              <h4 class="card__name">Asn23-Arg487 salt bridge</h4>
              ''' + card("Asn23-Arg487 salt bridge") + r'''
            </article>

            ''' + figure("fig-gate",
      "The same pair of trajectories under six measures. Above the dashed line are the three the project wrote before the tagged construct existed, all of them distances between atoms: the tagged run is indistinguishable from wild type and has the lowest conserved-window RMSD in the entire set, 1.12&nbsp;&Aring;, lower even than the crystal benchmark. Below the line are three that name the atoms and the geometry: every one of them reads 0.0%. Nothing about the trajectory changed between the two halves of this figure. Only the question did.") + r'''

            <figure class="mdv" data-mdv="wt" data-runs="wt:Wild type|chis:+ 6&times;His"
              data-caption="The two trajectories side by side in time. Switch between them and watch the dashed measurement: in both runs something stays within a few &aring;ngstr&ouml;ms of Arg487 for the whole 30&nbsp;ns, which is exactly why the gate passed. In the tagged run the six histidines lie down against the receptor surface and add about fifty heavy-atom contacts, holding the geometry while the chemistry that produced it is gone."></figure>

            <div class="card__key">
              ''' + key(0) + r'''
            </div>

            <article class="card">
              <h4 class="card__name">What follows for the construct</h4>
              ''' + card("What follows for the construct") + r'''
            </article>

            <div class="chap__end">
              <p class="chap__eyebrow">Report</p>
              <ul class="runs">
                <li class="run" data-state="bad">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/bopep4-chis-vs-wt.html">BoPEP4 with a C-terminal 6xHis</a></span><span class="run__role">False pass</span></div>
                  <p class="ai">Both analyses side by side: the distance-only criterion that passed, and the atom-resolved, angle-aware one that did not.</p>
                </li>
              </ul>
            </div>
          </div>

          <!-- --------------------------------------------------- 4.4 pH 5.5 -->
          <div class="rail__panel chap pl-5" role="tabpanel" id="ph-5-5" aria-labelledby="t-ph">
            <header class="chap__hero">
              <p class="chap__eyebrow">Runs 7 and 8</p>
              <h3 class="chap__title" data-no-toc>pH 5.5</h3>
              <div class="chap__intro"><p class="ai">The peptide does its work outside the plant cell, where the pH is nearer 5.5 than 7. Two runs test what that changes, and they disagree with each other. On the full-length peptide protonation recovers a contact; on the truncated one it breaks the anchor.</p></div>
            </header>

            <article class="card">
              <h4 class="card__name">pH run</h4>
              ''' + card("pH run") + r'''
            </article>

            <div class="bridge"><p class="ai">Protonation helped the full-length peptide. The obvious next question was whether it could rescue the construct that had come back worst.</p></div>

            <article class="card">
              <h4 class="card__name">Truncation crossed with protonation</h4>
              ''' + card("Truncation crossed with protonation") + r'''
            </article>

            ''' + figure("fig-phgrid",
      "The two changes crossed. Read the top row on its own and protonation looks like an unambiguous improvement: the Glu12 to His227 contact goes from 0.8% of frames to 99.9% and the C-terminal clamp does not loosen. Read the bottom row and the same three protonated histidines take the bidentate salt bridge from 46.9% down to 6.9%, the only run in the set to fail its gate. Note the RMSD in the bottom-right cell: 1.33&nbsp;&Aring;, better than the run above it. The construct improves on the aggregate number while the bond it was built around comes apart.") + r'''

            <figure class="mdv" data-mdv="lowph" data-runs="lowph:1&ndash;23 at pH 5.5|t923l:9&ndash;23 at pH 5.5"
              data-caption="The same protonation applied to two peptides. On the full-length run the measured distance stays green for the whole trajectory. On the truncated one it does not: watch the C-terminus come away from the receptor and fold back on the peptide's own His22, which is the self-contact the cards above put at 96.9% of frames."></figure>

            <div class="card__key">
              ''' + key(1) + r'''
            </div>

            <div class="chap__end">
              <p class="chap__eyebrow">Reports</p>
              <ul class="runs">
                <li class="run" data-state="good">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/bopep4-lowph-vs-wt.html">BoPEP4 1 to 23 at pH 5.5</a></span><span class="run__role">Positive result</span></div>
                  <p class="ai">The Glu12 and His227 pair appearing and holding, against the same peptide at pH&nbsp;7.</p>
                </li>
                <li class="run" data-state="bad">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/bopep4-9-23-lowph.html">BoPEP4 9 to 23 at pH 5.5</a></span><span class="run__role">Failed the gate</span></div>
                  <p class="ai">The only run in the set that failed its pre-registered criteria, and the self-contact that caused it.</p>
                </li>
              </ul>
            </div>
          </div>

          <!-- --------------------------------------------- 4.5 APO RECEPTOR -->
          <div class="rail__panel chap pl-1" role="tabpanel" id="the-apo-receptor" aria-labelledby="t-apo">
            <header class="chap__hero">
              <p class="chap__eyebrow">Run 9 of 9</p>
              <h3 class="chap__title" data-no-toc>The apo receptor</h3>
              <div class="chap__intro"><p class="ai">The receptor with no peptide at all. It is the run that says how much of the motion in the other eight would have happened anyway, and it is why nothing on this page claims the peptide stabilises PEPR1.</p></div>
            </header>

            <article class="card">
              <h4 class="card__name">Apo receptor</h4>
              ''' + card("Apo receptor") + r'''
            </article>

            ''' + figure("fig-apo",
      "Nine rows, one number each. The receptor simulated with no ligand at all is the steadiest trajectory in the set. If binding ordered the receptor, the top row would sit to the right of the others and it sits to the left of all of them. The practical consequence is two-fold: the groove is pre-formed, so a mean receptor structure is a fair way to represent the binding surface, and no receptor-side difference in this set is large enough to interpret.") + r'''

            <div class="chap__end">
              <p class="chap__eyebrow">Report</p>
              <ul class="runs">
                <li class="run" data-state="good">
                  <div class="run__top"><span class="run__name"><a href="../../md-simulations/apo-PEPR1.html">Receptor alone</a></span><span class="run__role">Negative control</span></div>
                  <p class="ai">The groove span, the flexibility profile and the per-residue comparison with the bound runs.</p>
                </li>
              </ul>
            </div>
          </div>

          <!-- -------------------------------------------- 4.6 ACROSS THE SET -->
          <div class="rail__panel chap pl-6" role="tabpanel" id="across-the-set" aria-labelledby="t-set">
            <header class="chap__hero">
              <p class="chap__eyebrow">All nine</p>
              <h3 class="chap__title" data-no-toc>Across the set</h3>
              <div class="chap__intro"><p class="ai">One result needs every run to exist: the number a construct would normally be ranked on does not track the bond the ranking is standing in for. This is the same lesson the docking score taught the section, arriving a second time from a different direction.</p></div>
            </header>

            <article class="card">
              <h4 class="card__name">Aggregate metrics and ranking constructs</h4>
              ''' + card("Aggregate metrics and ranking constructs") + r'''
            </article>

            ''' + figure("fig-decouple",
      "Eight runs, two axes that ought to agree and do not. Left on the horizontal axis means steadier by backbone RMSD, the measure a construct is usually ranked on; high on the vertical axis means the native salt bridge is actually there. If the two tracked each other the points would run from bottom-right to top-left, and instead the two steadiest runs in the set are the tagged construct and the one run that failed its gate. The section's answer is the rule the rest of this page follows: name the atoms, state the geometry, and count the frames.") + r'''

            <div class="card__key ai">
              <p>Both halves of Protein Design now rest on the same correction. <a href="../sprints/#reading-a-docking-score">The docking score</a> turned out to be 93% length and charge; aggregate structural metrics turn out to be uncorrelated with the bond they are standing in for. Neither is useless &mdash; the ladder's scores picked which cuts were worth simulating, which is what a confounded ranking can honestly be used for &mdash; but neither can settle a construct on its own.</p>
            </div>

            <div class="chap__end">
              <p class="chap__eyebrow">The cross-run table</p>
              <p class="ai"><a class="golink" href="../../md-simulations/#reading-the-set">All nine runs in one table on MD Simulations</a></p>
            </div>
          </div>
        </div>
      </section>

      <!-- ====================================================== 5 · LIMITS -->
      <section class="sec" id="limits">
        <h2>Limits</h2>

        <ul class="findings">
          <li class="ai"><b>Thirty nanoseconds is not a binding measurement.</b> It is three to six orders of magnitude short of a dissociation event, so nothing on this page is a binding affinity, a leaving time or a free energy. The 15&ndash;23 control says so in the students' own words: failing to see a peptide leave in 30&nbsp;ns cannot establish that it would stay.</li>
          <li class="ai"><b>One seed per system.</b> A difference between two runs may be a difference between two relaxation paths rather than between two constructs.</li>
          <li class="ai"><b>The acceptance gate was written before the tagged construct existed</b> and, on that construct, measures atoms it does not have. That is the finding of <a href="#the-histidine-tag">the tag chapter</a> and it applies backwards to every number the gate produced.</li>
          <li class="ai"><b>pH 5.5 is a fixed protonation state, not a constant-pH simulation.</b> Three histidines were assigned charges from model pKa values and held there. The histidines of the tag itself were run neutral, so the tagged construct has not been tested in the compartment it would work in.</li>
          <li class="ai"><b>Everything here is BoPEP4.</b> LEA14 and ACC deaminase have designs and codon-optimised sequences and no trajectories, and the three-body complex with BAK1 is a geometric model that has never been simulated.</li>
          <li class="ai"><b>None of it has been checked at the bench.</b> No binding assay, no thermal shift, no plant.</li>
        </ul>
      </section>

      <!-- ================================================= 6 · NOT YET RUN -->
      <section class="sec" id="not-yet-run">
        <h2>Not yet run</h2>

        <p class="ai">Three systems are scoped and have no trajectory. Nothing on this page speaks for them, and the first of them is load-bearing for a claim the section makes elsewhere.</p>

        <ul class="runs">
          <li class="run" data-state="pending">
            <div class="run__top"><span class="run__name">The ternary complex</span><span class="run__role">Future</span></div>
            <p class="ai">PEPR1, BoPEP4 and BAK1 together. The docked ternary model exists and <a href="../methodology/#ternary-docking">Methodology describes how it was threaded</a>, but no trajectory has been run on it, so everything the section says about the three-body complex is a statement about geometry rather than about stability. A co-immunoprecipitation is the experiment that would settle it.</p>
          </li>
          <li class="run" data-state="pending">
            <div class="run__top"><span class="run__name">ACC deaminase</span><span class="run__role">Future</span></div>
            <p class="ai">Four design runs exist on <a href="../sprints/#accd-runs">Sprints and Results</a>, including the PLP cofactor modelled both bound and free, and the sequence is codon-optimised and ordered. None of it has been simulated. The question a trajectory would answer first is whether the lid loop over the active site stays where AlphaFold put it.</p>
          </li>
          <li class="run" data-state="pending">
            <div class="run__top"><span class="run__name">LEA14</span><span class="run__role">Future</span></div>
            <p class="ai">Every LEA14 run is outstanding, docking included, because there is no receptor complex to dock to. The designs are specified under <a href="../methodology/#engineering-axes">Engineering axes</a> and the sequence is codon-optimised and ordered. A trajectory on the K-segment graft is the first one worth having.</p>
          </li>
        </ul>
      </section>

      <!-- ================================================ 7 · WHERE IT GOES -->
      <section class="sec" id="where-this-goes">
        <h2>Where these results go</h2>

        <p class="ai">Three places, and the first of them is the reason the section ran the simulations at all.</p>

        <div class="doors">
          <a class="door" href="../../experiments/">
            <span class="door__shot">
              <img class="is-fit" src="../../assets/img/protein-design/graft-pipeline.webp" alt="The protein design workflow chart." width="1002" height="577" loading="lazy" decoding="async" />
            </span>
            <span class="door__name">Into the wet lab</span>
            <p class="door__what ai">The tag moves to the N-terminus before anything is expressed, and the truncation plateau is a manufacturability claim being tested as a secretion assay against the wild type.</p>
          </a>
          <a class="door" href="../../peptide-design/">
            <span class="door__shot">
              <img class="is-fit" src="../../assets/img/peptide-design/pep-anchor-belt.webp" alt="Molecular render of the peptide lying along the receptor groove with its salt bridges labelled." width="1300" height="950" loading="lazy" decoding="async" />
            </span>
            <span class="door__name">Into the worked case</span>
            <p class="door__what ai">Peptide Design carries BoPEP4 residue by residue, with the per-position interface data and the constructs as they were ordered.</p>
          </a>
          <a class="door" href="../../md-simulations/">
            <span class="door__shot">
              <img src="../../assets/img/protein-design/card-md-asn23.webp" alt="Molecular surface of the receptor groove with the peptide's C-terminal residue buried in a pocket." width="900" height="900" loading="lazy" decoding="async" />
            </span>
            <span class="door__name">Into the full reports</span>
            <p class="door__what ai">Optional. One self-contained report per trajectory, in English and Traditional Chinese, with the viewer, the per-residue tables and every plot the analysis produced.</p>
          </a>
        </div>
      </section>

      <!-- =================================================== 8 · REFERENCES -->
      <section class="refs" id="references">
        <h2 data-no-toc>References</h2>
        <ol>
          <li>Tian, C. et al. ff19SB: amino-acid-specific protein backbone parameters trained against quantum mechanics energy surfaces in solution. <i>Journal of Chemical Theory and Computation</i> 16, 528 to 552 (2020).</li>
          <li>Izadi, S., Anandakrishnan, R. &amp; Onufriev, A. V. Building water models: a different approach. <i>Journal of Physical Chemistry Letters</i> 5, 3863 to 3871 (2014). OPC.</li>
          <li>Tang, J., Han, Z., Sun, Y., Zhang, H., Gong, X. &amp; Chai, J. Structural basis for recognition of an endogenous peptide by the plant receptor kinase PEPR1. <i>Cell Research</i> 25, 110 to 120 (2015). PDB&nbsp;5GR8.</li>
        </ol>
      </section>
    </main>
  </div>

  <nav class="pagenav" aria-label="Neighbouring pages">
    <a class="is-prev" href="../sprints/"><b>Previous</b><span>Sprints and Results</span></a>
    <a class="is-next" href="../../md-simulations/"><b>Next</b><span>MD Simulations</span></a>
  </nav>

''' + FOOT

if '<script src="../../assets/js/md-viewer.js' not in HTML:
    HTML = HTML.replace(
      '  <script src="../../assets/js/engage.js?v=1007s"></script>',
      '  <script src="../../assets/js/engage.js?v=1007s"></script>\n'
      '  <script src="../../assets/js/md-viewer.js?v=20261009" data-base="../../" defer></script>')

if '<script src="../../assets/js/md-viewer.js' not in HTML:
    sys.exit("the viewer script was not wired in: check the footer tail")

open(PAGE, "w").write(HTML)
print("wrote %s  (%.1f KB)" % (PAGE, len(HTML) / 1024))
