#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Write peptide-design/index.html.

    python3 build/peptide_design.py

The page carries four things that are the same data drawn four ways — the
per-residue interface map, the seventeen-sequence Pep alignment, the truncation
ladder and the Pearce benchmark — and every one of them is a grid or a chart
with more cells than anyone should type by hand. So the markup is generated
here, from the numbers as they came off the analyses, and the result is a
plain static file: the sequence strip, the alignment, both charts and every
table exist in the HTML with JavaScript switched off. The page script only
adds cross-highlighting, the ladder slider and the two chart toggles.

Sources, all under 00_Deliverable_Reports/ in the dry-lab tree:

  per-residue burial + partners   01_DryLab .../2026-07-21_BoPep4-receptor-interface_EN.pdf
  Pep-family alignment            03_Sequences/peptides/AtPep_BoPep4_alignment.fasta
  truncation ladder, 34 rows      00_Docking .../11_Truncation_Series/MASTER_MATRIX_34complexes.csv
  Pearce benchmark, pooled        00_Docking .../15_Methodology_Audit/ (Table 15)
  claim triage                    the same audit, section 17, plus the 2026-08-16 order decision
  constructs as ordered           0823_Order_Report_Gabriel/2026-08-23_BoPep4_DNA_Parts_EN.pdf
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "peptide-design", "index.html")

# ---------------------------------------------------------------------------
# 1. the peptide, residue by residue
# ---------------------------------------------------------------------------
# sasa   PEPR1 buried surface, A^2, native-mode complex
# hb/sb  hydrogen bonds / salt bridges to the receptor
# cls    anchor | core | buried | partial | none
# p2     conserved | partial | degraded | unmapped | none
# cons   fraction of the 17 aligned Pep sequences carrying the modal residue
RES = [
    # i  aa  sasa  hb sb  cls        p1 partner                    p2           cons   note
    (1,  "G",   0, 0, 0, "none",    "—",                     "none",      0.353, "Disordered in 5GR8. Deleted in the 9–23 constructs."),
    (2,  "I",   0, 0, 0, "none",    "—",                     "none",      0.294, "Disordered in 5GR8."),
    (3,  "L",   0, 0, 0, "none",    "—",                     "none",      0.353, "Disordered in 5GR8."),
    (4,  "I",   0, 0, 0, "none",    "—",                     "none",      0.353, "The one residue separating BoPep4 from <i>B.&nbsp;rapa</i> Pep4, which carries Val here."),
    (5,  "G",   0, 0, 0, "none",    "—",                     "none",      0.294, "Disordered in 5GR8."),
    (6,  "S",   0, 0, 0, "none",    "—",                     "none",      0.294, "Last residue before the interface starts."),
    (7,  "K",  70, 1, 1, "anchor",  "Glu199",                     "conserved", 0.647, "First rung of the basic belt. Lost at truncation 8–23."),
    (8,  "K",  14, 0, 0, "none",    "—",                     "unmapped",  0.353, "Inside the bound stretch and still solvent-facing: nothing within 4.5&nbsp;&Aring; on PEPR1 in any model. This is the position K8Q was meant to exploit."),
    (9,  "R", 123, 3, 3, "anchor",  "Asp179",                     "conserved", 0.529, "The strongest single anchor in the peptide, and the residue the truncation ladder was built around."),
    (10, "P",   0, 0, 0, "none",    "—",                     "unmapped",  0.412, "Solvent-exposed proline."),
    (11, "R",  78, 2, 1, "anchor",  "Asp294",                     "degraded",  0.588, "PEPR2 has no acidic partner here — one of the two mid-belt losses that narrow its selectivity."),
    (12, "E",  86, 1, 0, "buried",  "His227",                     "degraded",  0.412, "PEPR2 has no basic partner here."),
    (13, "P",  12, 0, 0, "none",    "—",                     "unmapped",  0.412, "Solvent-exposed proline."),
    (14, "H",  80, 0, 0, "buried",  "packing",                    "unmapped",  0.235, "Buried by packing, with no polar partner. AtPep1 carries Val at this position."),
    (15, "S",  96, 2, 0, "core",    "Asp273",                     "conserved", 1.000, "Invariant across all seventeen aligned Peps. Pearce measured a hundredfold activity loss for S15A."),
    (16, "S",  40, 1, 0, "core",    "Asn321",                     "conserved", 1.000, "Invariant across all seventeen aligned Peps."),
    (17, "G",  25, 0, 0, "partial", "—",                     "unmapped",  1.000, "Invariant, and the most expensive residue in the peptide to touch: G17A costs more than four thousandfold."),
    (18, "K",  85, 2, 2, "anchor",  "Glu324, Asp348",             "partial",   0.471, "Salt-bridges Asp348 and sits over Phe371. AtPep1 has Arg here, which is why K18R was proposed and then withdrawn."),
    (19, "P",   0, 0, 0, "none",    "—",                     "unmapped",  0.765, "Solvent-exposed proline."),
    (20, "G",  45, 0, 0, "buried",  "packing",                    "unmapped",  1.000, "Invariant across all seventeen aligned Peps."),
    (21, "G",  37, 2, 0, "partial", "—",                     "unmapped",  0.471, "AtPep1 carries Gln here and inserts it into a BAK1 cavity. A glycine cannot fill that cavity."),
    (22, "H", 104, 1, 3, "anchor",  "Glu439",                     "conserved", 0.471, "Second-most-buried residue in the peptide."),
    (23, "N", 170, 4, 0, "anchor",  "Asp441, Asn465, Arg487",     "conserved", 0.706, "The master clamp. Its free α-carboxylate salt-bridges Arg487 at 2.40&nbsp;&Aring; in the crystal. Anything fused after it removes that bond."),
]

CLS_LABEL = {
    "anchor":  "salt-bridge anchor",
    "core":    "conserved core contact",
    "buried":  "buried contact",
    "partial": "partial contact",
    "none":    "no receptor contact",
}
P2_LABEL = {
    "conserved": "conserved on PEPR2",
    "partial":   "partial on PEPR2",
    "degraded":  "degraded on PEPR2",
    "unmapped":  "not mapped on PEPR2",
    "none":      "no contact on PEPR2",
}

# ---------------------------------------------------------------------------
# 2. the Pep-family alignment, 17 sequences x 24 columns
# ---------------------------------------------------------------------------
ALN = [
    ("AtPep1",       "ATKVKAKQRGK-EKVSSGRPGQHN", "Arabidopsis"),
    ("AtPep2",       "DNKAKSKKRDK-EKPSSGRPGQTN", "Arabidopsis"),
    ("AtPep3",       "EIKARGKNKTK-PTPSSGKGGKHN", "Arabidopsis"),
    ("AtPep4",       "GLPGKKNVLKK-SRESSGKPGGTN", "Arabidopsis"),
    ("AtPep5",       "SLNVMRKGIRK-QPVSSGKRGGVN", "Arabidopsis"),
    ("AtPep6",       "-ITAVLRRRPRPPPYSSGRPGQNN", "Arabidopsis"),
    ("AtPep7",       "VSGNVAARKGK-QQTSSGKGGGTN", "Arabidopsis"),
    ("BoPep4",       "GILIGSKKRPR-EPHSSGKPGGHN", "B. oleracea — our design"),
    ("BnPep1 B6E2",  "SRGVKAKTKKK-EQKSSGRPGQHH", "B. napus"),
    ("BnPep4 E5L6",  "GILVGSKKRPR-EPHSSGKPGGHS", "B. napus"),
    ("BnPep4 UY23",  "PRKPPKKLQQK-PRDSSGKPGRIN", "B. napus"),
    ("BnPep6 DM88",  "MVTRLVRRRPR-PAYSSGRPGQID", "B. napus"),
    ("BnPep6 UR14",  "MVARLTRRRPR-PPYSSGQPGQIN", "B. napus"),
    ("BrPep1 APQ1",  "GTKLKAKTKKK-EQKSSGRSGQHH", "B. rapa"),
    ("BrPep1 E6D1",  "GTKVNAKRKEK-AKVSSGRPGKHH", "B. rapa"),
    ("BrPep4 A5G1",  "GILVGSKKRPR-EPHSSGKPGGHN", "B. rapa"),
    ("BrPep6 ER01",  "MVARLTRRRPR-PPYSSGQPGQNN", "B. rapa"),
]
# alignment column -> BoPep4 position (column 12 is the gap BoPep4 does not fill)
COL2POS = {}
_p = 0
for _c, _a in enumerate(ALN[7][1], start=1):
    if _a != "-":
        _p += 1
        COL2POS[_c] = _p
COLCONS = []
for _c in range(24):
    col = [s[1][_c] for s in ALN if s[1][_c] != "-"]
    top = max(set(col), key=col.count)
    COLCONS.append(col.count(top) / len(ALN))

CHEM = {  # crude side-chain class, for the second colouring of the alignment
    "K": "bas", "R": "bas", "H": "bas",
    "D": "aci", "E": "aci",
    "S": "pol", "T": "pol", "N": "pol", "Q": "pol", "Y": "pol",
    "G": "sml", "A": "sml", "P": "sml",
    "V": "hyd", "L": "hyd", "I": "hyd", "M": "hyd", "F": "hyd", "W": "hyd", "C": "hyd",
}

# ---------------------------------------------------------------------------
# 3. the truncation ladder, both receptors
# ---------------------------------------------------------------------------
# start: (score1, bsa1, iptm1, pae1, score2, bsa2, iptm2, pae2, verdict)
LAD = {
    1:  (-197.81, 2754, 0.82, 1.83, -211.87, 2862, 0.79, 2.11, "binder"),
    2:  (-201.43, 2698, None, None, -221.47, 2760, None, None, "binder"),
    3:  (-195.47, 2606, 0.89, 1.86, -211.58, 2639, 0.80, 2.40, "binder"),
    4:  (-196.81, 2436, 0.86, 2.02, -207.38, 2755, 0.82, 2.50, "binder"),
    5:  (-200.12, 2371, 0.92, 1.59, -206.62, 2546, 0.83, 2.48, "binder"),
    6:  (-198.94, 2419, 0.89, 1.85, -213.91, 2616, 0.89, 1.78, "binder"),
    7:  (-190.38, 2298, 0.92, 1.55, -207.56, 2514, 0.88, 2.18, "binder"),
    8:  (-165.51, 2050, 0.92, 1.74, -183.41, 2354, 0.88, 2.27, "binder"),
    9:  (-165.48, 2080, 0.94, 1.41, -168.54, 2231, 0.89, 2.20, "binder"),
    10: (-148.39, 1806, 0.93, 1.59, -143.32, 1969, 0.83, 2.72, "weak"),
    11: (-148.28, 1746, 0.90, 2.05, -149.94, 1977, 0.85, 2.80, "weak"),
    12: (-138.99, 1605, 0.87, 2.49, -128.88, 1765, 0.83, 2.76, "weak"),
    13: (-120.89, 1426, 0.87, 2.49, -112.95, 1502, 0.62, 3.17, "weak"),
    14: (-115.24, 1346, 0.54, 8.85, -106.67, 1398, 0.53, 7.90, "non-binder"),
    15: (-97.76, 1194, 0.63, 5.09, -85.04, 1241, 0.68, 4.22, "non-binder"),
    16: (-84.73,  999, 0.62, 5.56, -76.37, 1060, 0.66, 4.74, "non-binder"),
    17: (-85.08,  989, 0.73, 4.13, -68.93,  945, 0.57, 8.04, "non-binder"),
}
SEQ = "GILIGSKKRPREPHSSGKPGGHN"
CHARGE = {"K": 1, "R": 1, "E": -1, "D": -1}


def net_charge(s):
    return sum(CHARGE.get(a, 0) for a in s)


ANCHOR_POS = [7, 8, 9, 11, 18, 23]

# ---------------------------------------------------------------------------
# 4. the Pearce benchmark: sixteen equal-length analogues
# ---------------------------------------------------------------------------
# name, pooled HADDOCK score, Pearce half-maximal concentration (nM)
PEARCE = [
    ("H14A", -144.1, 2.5,  False),
    ("K18A", -148.3, 2.5,  False),
    ("E12A", -152.9, 2.5,  False),
    ("R9A",  -153.5, 2.5,  False),
    ("R11A", -154.6, 2.5,  False),
    ("H22A", -157.0, 2.5,  False),
    ("G17P", -158.1, 3000, True),
    ("S15A", -162.6, 25,   True),
    ("G17A", -164.1, 4000, True),
    ("S16A", -164.3, 2.5,  False),
    ("N23A", -164.3, 2.5,  False),
    ("P19A", -164.8, 2.5,  False),
    ("G21A", -165.4, 2.5,  False),
    ("P13A", -165.6, 2.5,  False),
    ("P10A", -166.5, 2.5,  False),
    ("G20A", -167.5, 2.5,  False),
]

# ---------------------------------------------------------------------------
# 5. claim ledger
# ---------------------------------------------------------------------------
# status: holds | qualified | retracted | open
LEDGER = [
    ("holds", "BoPep4 threads the PEPR1 groove in the AtPep1 register",
     "PDB&nbsp;5GR8 supplies the mode; re-docking AtPep1 returns it at 0.77&nbsp;&Aring; l-RMSD, top-ranked, with a 35-unit gap to the first non-native pose.",
     "Independent of our scoring function."),
    ("holds", "The C-terminal Asn23 carboxylate is the master anchor",
     "2.40&nbsp;&Aring; to Arg487&nbsp;NH1 and 2.80&nbsp;&Aring; to NE in the crystal; the most buried residue of the peptide at 170&nbsp;&Aring;&sup2;; removing it costs AtPep1 more than four hundredfold.",
     "Crystallographic and measured, not modelled."),
    ("holds", "Residues 1–6 make no receptor contact; 7–23 carries the interface",
     "Zero buried surface on both receptors in every model, and unresolved in the 2.59&nbsp;&Aring; crystal density.",
     "Three methods and one crystal agree."),
    ("holds", "Truncation to about 9–23 is tolerated",
     "AlphaFold3 confidence, our docking, Pearce&nbsp;2008 and Cui&nbsp;2024 all agree the N-terminal third is dispensable.",
     "Four independent lines."),
    ("qualified", "The binding cliff sits at Arg9",
     "Our docking places it at 9–23 and AlphaFold3 places it at 14–23 — five residues apart. The docking component of that verdict is a length threshold (see&nbsp;§6).",
     "State it as a range, 9 to 14, with both methods named."),
    ("qualified", "PEPR2 conserves the anchors and degrades the mid-belt",
     "The PEPR2 ectodomain has no experimental structure. Every PEPR2 number rests on an AlphaFold model, and no per-residue confidence filter was applied before docking it.",
     "Valid as a hypothesis, labelled as model-based."),
    ("qualified", "Receptor bridging by a tandem construct is feasible",
     "Restrained two-body docking cannot fail to make contact, so the informative measurement is the clash count, which is zero.",
     "Report as not sterically excluded, never as bridges."),
    ("retracted", "K18R is an affinity lead over wild type",
     "Withdrawn 2026-07-30 as a score-ranking claim, then withdrawn a second time on 2026-08-16: BoPep4&rsquo;s own Lys18 already makes both contacts Tang assigns to AtPep1&rsquo;s Arg18, at 2.62 and 4.17&nbsp;&Aring; against the crystal&rsquo;s 2.50 and 4.09&nbsp;&Aring;.",
     "Removed from the order the morning it was due to ship."),
    ("retracted", "K8Q is a receptor-neutral secretion handle",
     "Two methods, months apart, measure zero contacting atoms at position&nbsp;8 on PEPR1. A substitution at a position that touches nothing is not a binding claim either way.",
     "Retired with the whole point-mutation axis."),
    ("retracted", "K8Q+K18R collapses on PEPR1",
     "One AlphaFold3 confidence value (0.49) against a normal docking score (−194.7). The audit had already shown that a normal score is what a broken design also produces.",
     "One informative method and one uninformative one is not a disagreement."),
    ("retracted", "Docking independently confirms the AlphaFold3 poses",
     "Those runs start from the AlphaFold3 pose and derive their restraints from it, so they cannot reject it. That is restrained refinement.",
     "Re-described as force-field relaxation."),
    ("retracted", "Our docking reproduces the Pearce&nbsp;2008 activity trend",
     "&rho;&nbsp;&asymp;&nbsp;+0.05, p&nbsp;&gt;&nbsp;0.8 over the sixteen equal-length analogues. The published &rho;&nbsp;=&nbsp;+0.237 included the wild-type reference point in its own correlation.",
     "Corrected in the source report."),
    ("open", "The peptide is active in planta",
     "No assay has run. The six cassettes were placed on 2026-08-20 and the synthetic peptide reference alongside them.",
     "Nothing on this page settles it."),
    ("open", "The chassis secretes it at a measurable titre",
     "SamyQ has one sequence-verified precedent in our hands, the AmilCP construct, and it has not been read out.",
     "The single cheapest experiment still outstanding."),
]

# ---------------------------------------------------------------------------
# 6. what was ordered
# ---------------------------------------------------------------------------
CASSETTES = [
    ("D-01", "BoPep4_9-23_NHis", 691, "HHHHHH", "RPREPHSSGKPGGHN", "H",
     "Activity lead, and the only lead that a western blot can see."),
    ("D-02", "BoPep4_G17A_1-23_NHis", 715, "HHHHHH", "GILIGSKKRPREPHSSAKPGGHN", "H",
     "Dead control. Pearce measured G17A at more than four thousandfold down."),
    ("D-03", "BoPep4_WT_1-23_NHis", 715, "HHHHHH", "GILIGSKKRPREPHSSGKPGGHN", "H",
     "Full-length positive reference."),
    ("D-04", "BoPep4_9-23_native", 673, "", "RPREPHSSGKPGGHN", "R",
     "The same lead with no tag. Arg at +1 is the least favourable cleavage context in the batch."),
    ("D-05", "BoPep4_WT_1-23_native", 697, "", "GILIGSKKRPREPHSSGKPGGHN", "G",
     "Exactly the natural molecule, and the internal control for the +1 question."),
    ("D-06", "BoPep4_S15A_1-23_NHis", 715, "HHHHHH", "GILIGSKKRPREPHASGKPGGHN", "H",
     "Graded control, the middle rung. Pearce measured S15A at about a hundredfold down."),
]

# ---------------------------------------------------------------------------
# markup builders
# ---------------------------------------------------------------------------


def residue_strip():
    """The sequence explorer: 23 buttons, each with its own burial bar."""
    mx = max(r[2] for r in RES) or 1
    out = ['<div class="pd-ruler" id="ruler">',
           '  <div class="pd-ruler__strip" role="group" aria-label="BoPep4 sequence, residue by residue">']
    for i, aa, sasa, hb, sb, cls, p1, p2, cons, note in RES:
        h = round(4 + 34 * (sasa / mx), 1)
        out.append(
            '    <button type="button" class="pd-res is-%s" data-pos="%d" aria-pressed="false">'
            '<span class="pd-res__aa">%s</span>'
            '<span class="pd-res__bar" style="height:%spx"></span>'
            '<span class="pd-res__n">%d</span></button>' % (cls, i, aa, h, i)
        )
    out.append("  </div>")
    out.append('  <p class="pd-ruler__axis"><span>N-terminus</span><span>buried surface on PEPR1, per residue</span><span>C-terminus</span></p>')
    # detail panel, pre-filled with Asn23 so the page says something with JS off
    i, aa, sasa, hb, sb, cls, p1, p2, cons, note = RES[22]
    out.append(
        '  <div class="pd-ruler__panel" id="ruler-panel" aria-live="polite">\n'
        '    <p class="pd-ruler__head"><b id="rp-name">Asn23</b>'
        '<span class="pd-tag is-%s" id="rp-cls">%s</span>'
        '<span class="pd-tag is-p2-%s" id="rp-p2">%s</span></p>\n'
        '    <ul class="pd-stats">\n'
        '      <li><b>Buried on PEPR1</b><span id="rp-sasa">170&nbsp;&Aring;&sup2;</span></li>\n'
        '      <li><b>H-bonds / salt bridges</b><span id="rp-bonds">4 / 0</span></li>\n'
        '      <li><b>PEPR1 partner</b><span id="rp-p1">Asp441, Asn465, Arg487</span></li>\n'
        '      <li><b>Conserved across 17 Peps</b><span id="rp-cons">71%%</span></li>\n'
        '    </ul>\n'
        '    <p class="pd-ruler__note" id="rp-note">%s</p>\n'
        '  </div>' % (cls, CLS_LABEL[cls], p2, P2_LABEL[p2], note)
    )
    out.append('  <p class="pd-ruler__hint">Pick a residue. The matching column of the alignment below lights up with it.</p>')
    out.append("</div>")
    return "\n".join(out)


def residue_table():
    rows = []
    for i, aa, sasa, hb, sb, cls, p1, p2, cons, note in RES:
        rows.append(
            "<tr><td>%s%d</td><td>%d</td><td>%d / %d</td><td>%s</td><td>%s</td><td>%s</td><td>%d%%</td></tr>"
            % (aa, i, sasa, hb, sb, p1, CLS_LABEL[cls], P2_LABEL[p2].replace(" on PEPR2", ""), round(cons * 100))
        )
    return (
        '<div class="tablewrap"><table class="data">\n'
        "<thead><tr><th>Residue</th><th>&Delta;SASA (&Aring;&sup2;)</th><th>H-b / s-b</th>"
        "<th>PEPR1 partner</th><th>Class</th><th>PEPR2</th><th>Conservation</th></tr></thead>\n"
        "<tbody>%s</tbody></table></div>" % "\n".join(rows)
    )


def alignment():
    # data-mode ships in the markup so the conservation shading is there with
    # JavaScript off; the script only ever changes it.
    out = ['<div class="pd-aln" id="aln" data-mode="cons">',
           '  <div class="pd-aln__bar">',
           '    <span class="pd-aln__legend">Shading:</span>',
           '    <button type="button" class="pd-chip is-on" data-mode="cons" aria-pressed="true">column conservation</button>',
           '    <button type="button" class="pd-chip" data-mode="chem" aria-pressed="false">side-chain chemistry</button>',
           '  </div>',
           '  <div class="pd-aln__scroll">',
           '  <table class="pd-aln__grid">',
           '    <caption class="visually-hidden">Seventeen mature Pep peptides aligned over twenty-four columns.</caption>',
           '    <thead><tr><th scope="col" class="pd-aln__nm">Peptide</th>']
    for c in range(1, 25):
        pos = COL2POS.get(c)
        lbl = str(pos) if pos else "&middot;"
        out.append('<th scope="col" class="pd-aln__num" data-col="%d">%s</th>' % (c, lbl))
    out.append("</tr></thead>\n    <tbody>")
    for nm, seq, org in ALN:
        is_us = nm == "BoPep4"
        out.append('      <tr%s><th scope="row" class="pd-aln__nm"><b>%s</b><i>%s</i></th>'
                   % (' class="is-us"' if is_us else "", nm, org))
        for c, a in enumerate(seq, start=1):
            if a == "-":
                out.append('<td class="pd-cell is-gap" data-col="%d">&middot;</td>' % c)
            else:
                lvl = "hi" if COLCONS[c - 1] >= 0.99 else ("mid" if COLCONS[c - 1] >= 0.6 else "lo")
                out.append('<td class="pd-cell is-c-%s is-x-%s" data-col="%d">%s</td>'
                           % (lvl, CHEM.get(a, "sml"), c, a))
        out.append("</tr>")
    out.append("    </tbody>\n  </table>\n  </div>")
    out.append('  <p class="pd-aln__foot">Four columns are the same residue in all seventeen sequences: '
               'Ser15, Ser16, Gly17 and Gly20. Three of the four bury surface on PEPR1, and the fourth, '
               'Gly17, is the residue Pearce measured at more than four thousandfold. '
               'BoPep4 and <i>B.&nbsp;rapa</i> Pep4 differ at one position, Ile4.</p>')
    out.append("</div>")
    return "\n".join(out)


# ---- the ladder chart -----------------------------------------------------
LX0, LX1 = 78.0, 852.0
LY0, LY1 = 26.0, 214.0


def lx(start):
    return LX0 + (start - 1) * (LX1 - LX0) / 16.0


def ly_raw(score):
    return LY0 + (score + 60.0) / (-230.0 + 60.0) * (LY1 - LY0)


def ly_norm(v):  # score per 1000 A^2, range -70 .. -90
    return LY0 + (v + 70.0) / (-90.0 + 70.0) * (LY1 - LY0)


def ly_iptm(v):
    return LY0 + (1.0 - v) / 0.5 * (LY1 - LY0)


def poly(points):
    return " ".join("%.1f,%.1f" % p for p in points)


def ladder_chart():
    p1raw = [(lx(s), ly_raw(LAD[s][0])) for s in range(1, 18)]
    p2raw = [(lx(s), ly_raw(LAD[s][4])) for s in range(1, 18)]
    p1nrm = [(lx(s), ly_norm(LAD[s][0] / LAD[s][1] * 1000)) for s in range(1, 18)]
    p2nrm = [(lx(s), ly_norm(LAD[s][4] / LAD[s][5] * 1000)) for s in range(1, 18)]
    p1ip = [(lx(s), ly_iptm(LAD[s][2])) for s in range(1, 18) if LAD[s][2]]
    p2ip = [(lx(s), ly_iptm(LAD[s][6])) for s in range(1, 18) if LAD[s][6]]

    g = ['<svg class="pd-chart" viewBox="0 0 880 268" role="img" '
         'aria-label="Docking score and AlphaFold3 confidence against N-terminal truncation depth, seventeen rungs, two receptors.">']
    # x ticks
    for s in range(1, 18):
        x = lx(s)
        g.append('<line class="pd-tick" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (x, LY1, x, LY1 + 4))
        g.append('<text class="pd-ax" x="%.1f" y="%.1f" text-anchor="middle">%d</text>' % (x, LY1 + 16, s))
    g.append('<text class="pd-ax pd-ax--t" x="465" y="252" text-anchor="middle">first residue kept (peptide runs from here to Asn23)</text>')
    g.append('<line class="pd-axis" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (LX0 - 10, LY1, LX1 + 10, LY1))

    # the two AlphaFold3 cliff rungs, shaded
    g.append('<rect class="pd-band" x="%.1f" y="%.1f" width="%.1f" height="%.1f" />'
             % (lx(13), LY0 - 4, lx(14) - lx(13), LY1 - LY0 + 4))


    # --- group A: raw score
    g.append('<g id="lad-raw">')
    for v in (-80, -110, -140, -170, -200, -230):
        y = ly_raw(v)
        g.append('<line class="pd-grid" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (LX0 - 10, y, LX1 + 10, y))
        g.append('<text class="pd-ax" x="%.1f" y="%.1f" text-anchor="end">%d</text>' % (LX0 - 18, y + 3, v))
    g.append('<text class="pd-ax pd-ax--t" transform="translate(20,120) rotate(-90)" text-anchor="middle">HADDOCK score</text>')
    g.append('<polyline class="pd-trace" points="%s" />' % poly(p1raw))
    g.append('<polyline class="pd-trace is-b" points="%s" />' % poly(p2raw))
    for x, y in p1raw:
        g.append('<circle class="pd-pt" cx="%.1f" cy="%.1f" r="3" />' % (x, y))
    for x, y in p2raw:
        g.append('<circle class="pd-pt is-b" cx="%.1f" cy="%.1f" r="3" />' % (x, y))
    g.append("</g>")

    # --- group B: score per 1000 A^2
    g.append('<g id="lad-norm" hidden>')
    for v in (-70, -75, -80, -85, -90):
        y = ly_norm(v)
        g.append('<line class="pd-grid" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (LX0 - 10, y, LX1 + 10, y))
        g.append('<text class="pd-ax" x="%.1f" y="%.1f" text-anchor="end">%d</text>' % (LX0 - 18, y + 3, v))
    g.append('<text class="pd-ax pd-ax--t" transform="translate(20,120) rotate(-90)" text-anchor="middle">score per 1000 &#8491;&#178; buried</text>')
    g.append('<polyline class="pd-trace" points="%s" />' % poly(p1nrm))
    g.append('<polyline class="pd-trace is-b" points="%s" />' % poly(p2nrm))
    for x, y in p1nrm:
        g.append('<circle class="pd-pt" cx="%.1f" cy="%.1f" r="3" />' % (x, y))
    for x, y in p2nrm:
        g.append('<circle class="pd-pt is-b" cx="%.1f" cy="%.1f" r="3" />' % (x, y))
    g.append("</g>")

    # --- group C: AlphaFold3 ipTM
    g.append('<g id="lad-iptm" hidden>')
    for v in (1.0, 0.9, 0.8, 0.7, 0.6, 0.5):
        y = ly_iptm(v)
        g.append('<line class="pd-grid" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (LX0 - 10, y, LX1 + 10, y))
        g.append('<text class="pd-ax" x="%.1f" y="%.1f" text-anchor="end">%.1f</text>' % (LX0 - 18, y + 3, v))
    g.append('<text class="pd-ax pd-ax--t" transform="translate(20,120) rotate(-90)" text-anchor="middle">AlphaFold3 ipTM</text>')
    g.append('<text class="pd-note" x="%.1f" y="%.1f" text-anchor="end">confidence collapses across this step</text>'
             % (lx(13) - 8, LY0 + 6))
    g.append('<polyline class="pd-trace" points="%s" />' % poly(p1ip))
    g.append('<polyline class="pd-trace is-b" points="%s" />' % poly(p2ip))
    for x, y in p1ip:
        g.append('<circle class="pd-pt" cx="%.1f" cy="%.1f" r="3" />' % (x, y))
    for x, y in p2ip:
        g.append('<circle class="pd-pt is-b" cx="%.1f" cy="%.1f" r="3" />' % (x, y))
    g.append("</g>")

    # marker, moved by the slider
    g.append('<line id="lad-mark" class="pd-mark" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />'
             % (lx(9), LY0 - 6, lx(9), LY1))
    g.append("</svg>")
    return "\n".join(g)


def ladder_block():
    rows = []
    for s in range(1, 18):
        sc1, b1, ip1, pae1, sc2, b2, ip2, pae2, verdict = LAD[s]
        frag = SEQ[s - 1:]
        kept = [p for p in ANCHOR_POS if p >= s]
        rows.append(
            "<tr><td>%d&ndash;23</td><td class=\"mono\">%s</td><td>%d</td><td>%+d</td>"
            "<td>%.1f</td><td>%s</td><td>%.1f</td><td>%s</td><td>%s</td><td>%s</td></tr>"
            % (s, frag, len(frag), net_charge(frag), sc1,
               ("%.2f" % ip1) if ip1 else "&mdash;", sc1 / b1 * 1000,
               ("%.2f" % ip2) if ip2 else "&mdash;",
               ", ".join(SEQ[p - 1] + str(p) for p in kept), verdict)
        )
    table = ('<div class="tablewrap tablewrap--wide"><table class="data">\n'
             "<thead><tr><th>Fragment</th><th>Sequence</th><th>Length</th><th>Net charge</th>"
             "<th>Score, PEPR1</th><th>ipTM, PEPR1</th><th>Score / 1000&nbsp;&Aring;&sup2;</th>"
             "<th>ipTM, PEPR2</th><th>Anchors kept</th><th>Verdict</th></tr></thead>\n"
             "<tbody>%s</tbody></table></div>" % "\n".join(rows))

    sc1, b1, ip1, pae1, sc2, b2, ip2, pae2, verdict = LAD[9]
    read = (
        '  <div class="pd-ladder__read" id="lad-read" aria-live="polite">\n'
        '    <p class="pd-ladder__frag"><b id="lr-name">BoPep4 9&ndash;23</b>'
        '<span class="pd-tag is-anchor" id="lr-verdict">binder</span></p>\n'
        '    <p class="pd-seq" id="lr-seq">RPREPHSSGKPGGHN</p>\n'
        '    <ul class="pd-stats">\n'
        '      <li><b>Length / net charge</b><span id="lr-len">15 aa / +2</span></li>\n'
        '      <li><b>HADDOCK, PEPR1</b><span id="lr-s1">&minus;165.5</span></li>\n'
        '      <li><b>Score per 1000&nbsp;&Aring;&sup2;</b><span id="lr-n1">&minus;79.6</span></li>\n'
        '      <li><b>AlphaFold3 ipTM</b><span id="lr-ip">0.94 &middot; PEPR2 0.89</span></li>\n'
        '      <li><b>Anchors still present</b><span id="lr-anch">R9, R11, K18, N23</span></li>\n'
        '    </ul>\n'
        '  </div>')

    return "\n".join([
        '<div class="pd-ladder" id="ladder">',
        '  <div class="pd-aln__bar">',
        '    <span class="pd-aln__legend">Y axis:</span>',
        '    <button type="button" class="pd-chip is-on" data-lad="raw" aria-pressed="true">docking score</button>',
        '    <button type="button" class="pd-chip" data-lad="norm" aria-pressed="false">score per buried &Aring;&sup2;</button>',
        '    <button type="button" class="pd-chip" data-lad="iptm" aria-pressed="false">AlphaFold3 confidence</button>',
        '  </div>',
        '  <div class="pd-ladder__stage">',
        ladder_chart(),
        '  </div>',
        '  <p class="pd-ladder__key"><span class="pd-key pd-key--a">PEPR1</span>'
        '<span class="pd-key pd-key--b">PEPR2</span></p>',
        '  <div class="pd-ladder__ctl">',
        '    <label for="lad-slider">Truncation depth</label>',
        '    <input type="range" id="lad-slider" min="1" max="17" step="1" value="9" '
        'aria-describedby="lad-read" />',
        '  </div>',
        read,
        '</div>',
        '<div class="disclose disclose--solo"><details class="disclose"><summary>'
        '<span class="disclose__title">All seventeen rungs, both receptors</span>'
        '<span class="disclose__hint">The table the chart is drawn from.</span></summary>'
        '<div class="disclose__body">' + table + '</div></details></div>',
    ])


# ---- the Pearce benchmark chart -------------------------------------------
def bench_chart():
    import math
    x0, x1 = 92.0, 848.0
    y0, y1 = 40.0, 214.0

    def bx(score):
        return x0 + (-score - 142.0) / 26.0 * (x1 - x0)

    def by(nm):
        return y1 - math.log10(nm) / 3.8 * (y1 - y0)

    g = ['<svg class="pd-chart" viewBox="0 0 880 262" role="img" '
         'aria-label="Docking score against measured half-maximal activity for sixteen equal-length AtPep1 analogues. The three analogues known to be inactive sit in the middle of the docking ranking.">']
    for lab, nm in (("2.5", 2.5), ("25", 25), ("250", 250), ("4000", 4000)):
        y = by(nm)
        g.append('<line class="pd-grid" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (x0 - 14, y, x1 + 14, y))
        g.append('<text class="pd-ax" x="%.1f" y="%.1f" text-anchor="end">%s</text>' % (x0 - 22, y + 3, lab))
    g.append('<text class="pd-ax pd-ax--t" transform="translate(24,128) rotate(-90)" text-anchor="middle">measured half-max, nM (log)</text>')
    g.append('<line class="pd-axis" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" />' % (x0 - 14, y1 + 12, x1 + 14, y1 + 12))
    for s in (-144, -150, -156, -162, -168):
        g.append('<text class="pd-ax" x="%.1f" y="%.1f" text-anchor="middle">%d</text>' % (bx(s), y1 + 28, s))
    g.append('<text class="pd-ax pd-ax--t" x="470" y="252" text-anchor="middle">HADDOCK score, pooled over both receptors &mdash; the model predicts stronger binding to the right</text>')
    g.append('<text class="pd-ax" x="%.1f" y="30" text-anchor="start">less active</text>' % (x0 - 14))
    # fourteen of the sixteen sit on the same activity value, so their labels
    # collide. Stagger them in a fixed cycle instead of moving any point.
    rows = {}
    for lab, score, nm, crit in PEARCE:
        rows.setdefault(round(nm, 3), []).append((bx(score), lab, crit, by(nm)))
    for _nm, pts in rows.items():
        pts.sort()
        cycle = (-11.0, -23.0)
        for k, (x, lab, crit, y) in enumerate(pts):
            dy = -13.0 if (crit or len(pts) == 1) else cycle[k % 2]
            g.append('<g class="pd-bpt%s">' % (" is-crit" if crit else ""))
            g.append('<circle cx="%.1f" cy="%.1f" r="%s" />' % (x, y, "6" if crit else "4.5"))
            g.append('<text class="pd-blab" x="%.1f" y="%.1f" text-anchor="middle">%s</text>'
                     % (x, y + dy, lab))
            g.append("</g>")
    g.append("</svg>")
    return "\n".join(g)


def bench_block():
    return "\n".join([
        '<div class="pd-bench" id="bench" data-view="all">',
        '  <div class="pd-aln__bar">',
        '    <span class="pd-aln__legend">View:</span>',
        '    <button type="button" class="pd-chip is-on" data-bench="all" aria-pressed="true">all sixteen analogues</button>',
        '    <button type="button" class="pd-chip" data-bench="crit" aria-pressed="false">the three Pearce measured as dead</button>',
        '  </div>',
        '  <div class="pd-ladder__stage">',
        bench_chart(),
        '  </div>',
        '  <p class="pd-bench__foot">Spearman &rho; between the two axes, over these sixteen: '
        '<b>+0.05</b>, p&nbsp;&gt;&nbsp;0.8. A perfect predictor would put every point on a rising diagonal.</p>',
        '</div>',
    ])


def ledger_block():
    counts = {}
    for st, *_ in LEDGER:
        counts[st] = counts.get(st, 0) + 1
    chips = [('<button type="button" class="pd-chip is-on" data-st="all" aria-pressed="true">all %d</button>' % len(LEDGER))]
    for st, lab in (("holds", "holds"), ("qualified", "qualified"), ("retracted", "retracted"), ("open", "open")):
        chips.append('<button type="button" class="pd-chip is-%s" data-st="%s" aria-pressed="false">%s &middot; %d</button>'
                     % (st, st, lab, counts.get(st, 0)))
    rows = []
    for st, claim, why, action in LEDGER:
        rows.append(
            '<li class="pd-claim is-%s" data-st="%s"><p class="pd-claim__h">'
            '<span class="pd-tag is-%s">%s</span>%s</p>'
            '<p class="pd-claim__w">%s</p><p class="pd-claim__a">%s</p></li>'
            % (st, st, st, st, claim, why, action)
        )
    return "\n".join([
        '<div class="pd-ledger" id="ledger">',
        '  <div class="pd-aln__bar">' + '<span class="pd-aln__legend">Show:</span>' + "".join(chips) + "</div>",
        '  <ul class="pd-claims">' + "\n".join(rows) + "</ul>",
        "</div>",
    ])


def cassette_block():
    rows = []
    for cid, name, bp, tag, mature, plus1, why in CASSETTES:
        tag_html = ('<span class="pd-part is-tag">%s</span>' % tag) if tag else ""
        pep = mature
        marks = []
        for k, a in enumerate(pep, start=1):
            pos = k if len(pep) == 23 else k + 8
            if a != SEQ[pos - 1]:
                cl = "is-mut"          # a deliberate substitution, i.e. a control
            elif pos in (9, 15, 16, 17, 18, 22, 23):
                cl = "is-anchor"
            else:
                cl = ""
            marks.append('<span class="pd-aa %s">%s</span>' % (cl, a))
        rows.append(
            '<li class="pd-cass">'
            '<p class="pd-cass__h"><b>%s</b><span>%s</span><i>%d bp</i></p>'
            '<p class="pd-cass__seq"><span class="pd-part is-sp">SamyQ<sub>31</sub></span>'
            '<span class="pd-cut" title="signal peptidase I cuts here">&#9662;</span>%s%s</p>'
            '<p class="pd-cass__why">%s <span class="pd-cass__p1">Cleavage +1 residue: <b>%s</b>.</span></p>'
            "</li>" % (cid, name, bp, tag_html, "".join(marks), why, plus1)
        )
    return ('<ul class="pd-casslist">%s</ul>'
            '<p class="pd-casskey"><span class="pd-aa is-anchor">N</span> interface anchor'
            ' &middot; <span class="pd-aa is-mut">A</span> substitution against wild type'
            ' &middot; <span class="pd-cut">&#9662;</span> signal peptidase I cleaves here</p>'
            % "\n".join(rows))


# ---------------------------------------------------------------------------
# the page
# ---------------------------------------------------------------------------

CSS = r"""
    /* -----------------------------------------------------------------------
       Page-local. page.css knows about prose, figures and tables; it has no
       reason to know about a sequence viewer, a seventeen-row alignment, a
       truncation slider or a claim ledger. All of it is built on the tokens
       and none of it is required for the page to read: with JavaScript off
       every grid, chart and table below is already in the markup, and the
       script only adds highlighting, the slider and the axis toggles.
       -------------------------------------------------------------------- */

    /* ---- the banner behind the title ---- */
    .pagehead__bg { position: absolute; inset: 0; }
    .pagehead__bg svg { display: block; width: 100%; height: 100%; }
    .ban-lrr   { fill: none; stroke: var(--leaf-200); stroke-width: 1.4; stroke-linecap: round; opacity: .55; }
    .ban-groove{ fill: none; stroke: var(--leaf-200); stroke-width: 2.2; opacity: .32; }
    .ban-pep   { fill: none; stroke: #eafaf1; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
    .ban-anch  { fill: #eafaf1; }
    .ban-anch.is-clamp { fill: #f2a189; }
    .ban-link  { stroke: #cfe4d8; stroke-width: 1.1; stroke-dasharray: 2.5 2.5; }
    .ban-lab   { fill: #cfe4d8; font-size: 15px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; opacity: .62; }

    /* engineering.css scopes .prov to its own page, and the figure-integrity
       note has to read as a separate line wherever it appears. */
    .fig figcaption .prov {
      display: block; margin-top: var(--sp-2);
      font-size: var(--text-xs); color: var(--gray-500);
    }
    /* two structural renders side by side need more than the 68ch column */
    @media (min-width: 1180px) {
      .figs--2 { width: min(54rem, calc(100vw - 24rem)); max-width: none; }
    }

    /* ---- wide blocks get the gutter, same bargain page.css strikes ---- */
    @media (min-width: 1240px) {
      .pd-ruler, .pd-aln, .pd-ladder, .pd-bench, .pd-ledger, .pd-casslist,
      .tablewrap--wide, .fig--wider {
        width: min(64rem, calc(100vw - 30rem)); max-width: none;
      }
    }

    /* ---- shared furniture ---- */
    .pd-chip {
      font: inherit; font-size: var(--text-xs); font-weight: 650; line-height: 1;
      padding: .5em 1em; cursor: pointer; border-radius: 999px;
      color: var(--gray-600); background: var(--white);
      border: 1px solid var(--gray-200);
    }
    .pd-chip:hover { border-color: var(--leaf-500); color: var(--leaf-900); }
    .pd-chip:focus-visible { outline: 2px solid var(--leaf-700); outline-offset: 2px; }
    .pd-chip.is-on { color: var(--leaf-900); background: var(--leaf-100); border-color: var(--leaf-200); }

    .pd-tag {
      display: inline-block; font-size: var(--text-xs); font-weight: 700;
      letter-spacing: .04em; padding: .25em .7em; border-radius: 999px;
      background: var(--gray-100); color: var(--gray-700); white-space: nowrap;
    }
    .pd-tag.is-anchor    { background: var(--leaf-900); color: #eafaf1; }
    .pd-tag.is-core      { background: var(--leaf-700); color: #eafaf1; }
    .pd-tag.is-buried    { background: var(--leaf-200); color: var(--leaf-900); }
    .pd-tag.is-partial   { background: var(--amber-100); color: var(--amber-700); }
    .pd-tag.is-none      { background: var(--gray-100); color: var(--gray-500); }
    .pd-tag.is-p2-conserved { background: var(--leaf-100); color: var(--leaf-900); }
    .pd-tag.is-p2-partial   { background: var(--amber-100); color: var(--amber-700); }
    .pd-tag.is-p2-degraded  { background: var(--rust-100);  color: var(--rust-700); }
    .pd-tag.is-p2-unmapped,
    .pd-tag.is-p2-none      { background: var(--gray-100); color: var(--gray-500); }
    .pd-tag.is-holds     { background: var(--leaf-100); color: var(--leaf-900); }
    .pd-tag.is-qualified { background: var(--amber-100); color: var(--amber-700); }
    .pd-tag.is-retracted { background: var(--rust-100);  color: var(--rust-700); }
    .pd-tag.is-open      { background: var(--slate-100); color: var(--slate-700); }

    .pd-stats { list-style: none; margin: 0; padding: 0; }
    .pd-stats li {
      display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-3);
      padding: .42em 0; border-bottom: 1px solid var(--gray-200);
    }
    .pd-stats li:last-child { border-bottom: 0; }
    .pd-stats b { font-weight: 500; color: var(--gray-600); font-size: var(--text-xs); }
    .pd-stats span { font-family: var(--font-mono); font-weight: 650; font-size: var(--text-sm); color: var(--black); text-align: right; }

    .pd-seq, .mono {
      font-family: var(--font-mono); font-size: var(--text-sm); letter-spacing: .04em;
      word-break: break-all; color: var(--gray-700);
    }

    /* ---- 1. the sequence explorer ---- */
    .pd-ruler {
      margin: var(--sp-6) 0; border: 1px solid var(--gray-200);
      border-radius: var(--radius); background: var(--leaf-50); overflow: hidden;
    }
    .pd-ruler__strip {
      display: flex; align-items: flex-end; gap: 2px;
      padding: var(--sp-5) var(--sp-4) var(--sp-2);
      overflow-x: auto;
    }
    .pd-res {
      flex: 1 1 0; min-width: 1.75rem; appearance: none; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 0 0 .35rem; background: none; border: 0; border-radius: var(--radius-sm);
      font: inherit;
    }
    .pd-res:hover { background: var(--white); }
    .pd-res:focus-visible { outline: 2px solid var(--leaf-700); outline-offset: 1px; }
    .pd-res[aria-pressed="true"] { background: var(--white); box-shadow: var(--shadow-sm); }
    .pd-res__aa {
      font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700;
      color: var(--gray-500); line-height: 1;
    }
    .pd-res__n { font-size: 10px; color: var(--gray-400); font-variant-numeric: tabular-nums; }
    .pd-res__bar { display: block; width: 60%; border-radius: 2px 2px 0 0; background: var(--gray-300); }
    .pd-res.is-anchor  .pd-res__bar { background: var(--leaf-900); }
    .pd-res.is-core    .pd-res__bar { background: var(--leaf-700); }
    .pd-res.is-buried  .pd-res__bar { background: var(--leaf-500); }
    .pd-res.is-partial .pd-res__bar { background: var(--amber-700); }
    .pd-res.is-none    .pd-res__bar { background: var(--gray-300); }
    .pd-res.is-anchor .pd-res__aa,
    .pd-res.is-core   .pd-res__aa { color: var(--leaf-900); }
    .pd-res[aria-pressed="true"] .pd-res__aa { color: var(--black); }

    .pd-ruler__axis {
      display: flex; justify-content: space-between; gap: var(--sp-3);
      margin: 0; padding: 0 var(--sp-5) var(--sp-4);
      font-size: var(--text-xs); color: var(--gray-500);
    }
    .pd-ruler__axis span:nth-child(2) { color: var(--gray-400); }
    .pd-ruler__panel {
      border-top: 1px solid var(--gray-200); background: var(--white);
      padding: var(--sp-5);
    }
    .pd-ruler__head {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3);
      margin: 0 0 var(--sp-4);
    }
    .pd-ruler__head b { font-size: var(--text-h3); color: var(--leaf-900); line-height: 1; }
    .pd-ruler__note { margin: var(--sp-4) 0 0; font-size: var(--text-sm); color: var(--gray-700); line-height: 1.6; }
    .pd-ruler__hint {
      margin: 0; padding: var(--sp-3) var(--sp-5); background: var(--white);
      border-top: 1px solid var(--gray-200);
      font-size: var(--text-xs); color: var(--gray-500);
    }

    /* ---- 2. the alignment ---- */
    .pd-aln {
      margin: var(--sp-6) 0; border: 1px solid var(--gray-200);
      border-radius: var(--radius); background: var(--white); overflow: hidden;
    }
    .pd-aln__bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4); background: var(--leaf-50);
      border-bottom: 1px solid var(--gray-200);
    }
    .pd-aln__legend { font-size: var(--text-xs); color: var(--gray-500); margin-right: var(--sp-1); }
    .pd-aln__scroll { overflow-x: auto; }
    .pd-aln__grid { border-collapse: collapse; width: 100%; min-width: 40rem; }
    .pd-aln__grid th, .pd-aln__grid td { padding: 0; }
    .pd-aln__nm {
      width: 9.5rem; text-align: left;
      padding: .18rem var(--sp-3) .18rem var(--sp-4) !important;
      white-space: nowrap; font-weight: 400;
    }
    .pd-aln__nm b { display: block; font-size: var(--text-xs); font-weight: 650; color: var(--gray-700); }
    .pd-aln__nm i { display: block; font-size: 10px; font-style: normal; color: var(--gray-400); }
    .is-us .pd-aln__nm b { color: var(--leaf-900); }
    .is-us .pd-aln__nm { background: var(--leaf-50); }
    .pd-aln__num {
      font-size: 10px; font-weight: 600; color: var(--gray-400);
      text-align: center; padding: var(--sp-2) 0 .3rem !important;
      font-variant-numeric: tabular-nums;
    }
    .pd-cell {
      text-align: center; font-family: var(--font-mono); font-size: 12px; font-weight: 650;
      line-height: 1.65; color: var(--gray-600); border: 1px solid var(--white);
    }
    /* conservation shading, the default */
    .pd-aln[data-mode="cons"] .pd-cell.is-c-hi  { background: var(--leaf-900); color: #eafaf1; }
    .pd-aln[data-mode="cons"] .pd-cell.is-c-mid { background: var(--leaf-200); color: var(--leaf-900); }
    .pd-aln[data-mode="cons"] .pd-cell.is-c-lo  { background: var(--leaf-50); }
    /* chemistry shading */
    .pd-aln[data-mode="chem"] .pd-cell.is-x-bas { background: #dfe9f4; color: var(--slate-700); }
    .pd-aln[data-mode="chem"] .pd-cell.is-x-aci { background: var(--rust-100); color: var(--rust-700); }
    .pd-aln[data-mode="chem"] .pd-cell.is-x-pol { background: var(--leaf-100); color: var(--leaf-900); }
    .pd-aln[data-mode="chem"] .pd-cell.is-x-sml { background: var(--gray-100); color: var(--gray-600); }
    .pd-aln[data-mode="chem"] .pd-cell.is-x-hyd { background: var(--amber-100); color: var(--amber-700); }
    .pd-cell.is-gap { background: var(--white); color: var(--gray-300); }
    .pd-cell.is-lit, .pd-aln__num.is-lit {
      outline: 2px solid var(--leaf-700); outline-offset: -2px; position: relative;
    }
    .pd-aln__num.is-lit { color: var(--leaf-900); }
    .pd-aln__foot {
      margin: 0; padding: var(--sp-4) var(--sp-4) var(--sp-5);
      border-top: 1px solid var(--gray-200);
      font-size: var(--text-xs); color: var(--gray-500); line-height: 1.65;
    }

    /* ---- 3 + 4. charts ---- */
    .pd-ladder, .pd-bench {
      margin: var(--sp-6) 0; border: 1px solid var(--gray-200);
      border-radius: var(--radius); background: var(--white); overflow: hidden;
    }
    .pd-ladder__stage { overflow-x: auto; }
    .pd-chart {
      display: block; width: 100%; min-width: 34rem; height: auto;
      font-family: var(--font-body); padding: var(--sp-4) 0 0;
    }
    .pd-ax   { fill: var(--gray-500); font-size: 10px; }
    .pd-ax--t{ fill: var(--gray-400); font-size: 10.5px; }
    .pd-grid { stroke: var(--gray-200); stroke-width: 1; }
    .pd-axis, .pd-tick { stroke: var(--gray-400); stroke-width: 1; }
    .pd-band { fill: var(--rust-100); }
    .pd-note { fill: var(--rust-700); font-size: 10px; font-weight: 650; }
    .pd-trace{ fill: none; stroke: var(--leaf-700); stroke-width: 1.8; stroke-linejoin: round; }
    .pd-trace.is-b { stroke: var(--slate-700); stroke-dasharray: 5 3; }
    .pd-pt   { fill: var(--leaf-700); }
    .pd-pt.is-b { fill: var(--slate-700); }
    .pd-mark { stroke: var(--leaf-900); stroke-width: 1.6; }
    .pd-chart g[hidden] { display: none; }
    .pd-bpt circle { fill: var(--gray-400); }
    .pd-bpt .pd-blab { fill: var(--gray-500); font-size: 9.5px; font-weight: 600; }
    .pd-bpt.is-crit circle { fill: var(--rust-700); }
    .pd-bpt.is-crit .pd-blab { fill: var(--rust-700); font-weight: 700; }
    .pd-bench[data-view="crit"] .pd-bpt:not(.is-crit) { opacity: .18; }

    .pd-ladder__key {
      display: flex; gap: var(--sp-4); margin: 0; padding: 0 var(--sp-5) var(--sp-3);
      font-size: var(--text-xs); color: var(--gray-500);
    }
    .pd-key::before {
      content: ""; display: inline-block; width: 1.4rem; height: 2px;
      margin-right: .45rem; vertical-align: .2em; background: var(--leaf-700);
    }
    .pd-key--b::before {
      background: repeating-linear-gradient(to right,
        var(--slate-700) 0 5px, transparent 5px 8px);
    }
    .pd-ladder__ctl {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--gray-200);
      background: var(--leaf-50);
    }
    .pd-ladder__ctl label { font-size: var(--text-xs); font-weight: 650; color: var(--gray-600); white-space: nowrap; }
    .pd-ladder__ctl input { flex: 1 1 auto; accent-color: var(--leaf-700); }
    .pd-ladder__read { padding: var(--sp-5); border-top: 1px solid var(--gray-200); }
    .pd-ladder__frag { display: flex; align-items: center; gap: var(--sp-3); margin: 0 0 var(--sp-3); }
    .pd-ladder__frag b { font-size: var(--text-base); color: var(--leaf-900); }
    .pd-ladder__read .pd-seq { margin: 0 0 var(--sp-4); }
    .pd-bench__foot {
      margin: 0; padding: var(--sp-4) var(--sp-5) var(--sp-5);
      border-top: 1px solid var(--gray-200);
      font-size: var(--text-sm); color: var(--gray-600); line-height: 1.6;
    }
    .pd-bench__foot b { color: var(--rust-700); }

    /* ---- 5. the claim ledger ---- */
    .pd-ledger { margin: var(--sp-6) 0; border: 1px solid var(--gray-200); border-radius: var(--radius); overflow: hidden; }
    .pd-claims { list-style: none; margin: 0; padding: 0; }
    .pd-claim { padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--gray-200); }
    .pd-claim:first-child { border-top: 0; }
    .pd-claim[hidden] { display: none; }
    .pd-claim__h { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-3); margin: 0 0 var(--sp-2); font-weight: 650; color: var(--leaf-900); }
    .pd-claim__w { margin: 0 0 var(--sp-2); font-size: var(--text-sm); color: var(--gray-700); line-height: 1.6; }
    .pd-claim__a { margin: 0; font-size: var(--text-xs); color: var(--gray-500); }
    .pd-claim.is-retracted { background: #fefaf8; }
    .pd-claim.is-retracted .pd-claim__h { color: var(--rust-700); }

    /* ---- 6. the cassettes ---- */
    .pd-casslist { list-style: none; margin: var(--sp-6) 0; padding: 0; display: grid; gap: var(--sp-3); }
    .pd-cass { margin: 0; padding: var(--sp-4); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); background: var(--white); }
    .pd-cass__h { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-3); margin: 0 0 var(--sp-3); }
    .pd-cass__h b { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--leaf-900); }
    .pd-cass__h span { font-size: var(--text-sm); font-weight: 650; color: var(--gray-700); }
    .pd-cass__h i { margin-left: auto; font-style: normal; font-size: var(--text-xs); color: var(--gray-400); font-variant-numeric: tabular-nums; }
    .pd-cass__seq { margin: 0 0 var(--sp-3); line-height: 2; }
    .pd-part {
      display: inline-block; font-size: var(--text-xs); font-weight: 650;
      padding: .2em .55em; border-radius: 3px; margin-right: .25rem;
      font-family: var(--font-mono);
    }
    .pd-part.is-sp  { background: var(--slate-100); color: var(--slate-700); }
    .pd-part.is-tag { background: var(--amber-100); color: var(--amber-700); }
    .pd-cut { color: var(--rust-700); margin: 0 .3rem 0 .05rem; }
    .pd-aa {
      display: inline-block; font-family: var(--font-mono); font-size: 12.5px;
      width: 1.05em; text-align: center; color: var(--gray-500);
    }
    .pd-aa.is-anchor { color: var(--leaf-900); font-weight: 700; background: var(--leaf-100); border-radius: 2px; }
    .pd-aa.is-mut { color: var(--rust-700); font-weight: 700; background: var(--rust-100); border-radius: 2px; }
    .pd-cass__why { margin: 0; font-size: var(--text-sm); color: var(--gray-600); line-height: 1.6; }
    .pd-cass__p1 { color: var(--gray-400); }
    .pd-casskey { margin: calc(var(--sp-4) * -1) 0 var(--sp-6); font-size: var(--text-xs); color: var(--gray-500); }

    /* ---- a two-column card row for the design rules ---- */
    .pd-rules { display: grid; gap: var(--sp-4); grid-template-columns: minmax(0,1fr); margin: var(--sp-5) 0; }
    @media (min-width: 620px) { .pd-rules { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    .pd-rule { margin: 0; padding: var(--sp-4) var(--sp-5); border-radius: var(--radius-sm); border: 1px solid var(--gray-200); }
    .pd-rule h4 { margin: 0 0 var(--sp-2); font-size: var(--text-sm); letter-spacing: .04em; text-transform: uppercase; }
    .pd-rule p { margin: 0; font-size: var(--text-sm); line-height: 1.6; color: var(--gray-700); }
    .pd-rule--keep { background: var(--leaf-50); border-color: var(--leaf-200); }
    .pd-rule--keep h4 { color: var(--leaf-900); }
    .pd-rule--free { background: var(--amber-100); border-color: #f0e2c0; }
    .pd-rule--free h4 { color: var(--amber-700); }
    .pd-rule code { font-family: var(--font-mono); font-size: .92em; }

    @media print {
      .pd-chip, .pd-ladder__ctl, .pd-ruler__hint { display: none !important; }
      .pd-claim[hidden] { display: block !important; }
    }
"""

JS = r"""
(function () {
  "use strict";
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- 1. sequence explorer, wired to the alignment ---------------------- */
  var RES = __RES__;
  var COL2POS = __COL2POS__;

  function paintAlignment(pos) {
    $$(".pd-cell.is-lit, .pd-aln__num.is-lit").forEach(function (el) { el.classList.remove("is-lit"); });
    if (!pos) return;
    var col = null, k;
    for (k in COL2POS) { if (COL2POS[k] === pos) { col = k; break; } }
    if (!col) return;
    $$('[data-col="' + col + '"]').forEach(function (el) { el.classList.add("is-lit"); });
  }

  function selectResidue(pos) {
    var d = RES[pos - 1];
    if (!d) return;
    $$(".pd-res").forEach(function (b) {
      b.setAttribute("aria-pressed", String(Number(b.dataset.pos) === pos));
    });
    $("#rp-name").textContent = d.name;
    var c = $("#rp-cls");  c.className = "pd-tag is-" + d.cls; c.textContent = d.clsLabel;
    var p = $("#rp-p2");   p.className = "pd-tag is-p2-" + d.p2; p.textContent = d.p2Label;
    $("#rp-sasa").innerHTML = d.sasa + "&nbsp;Å²";
    $("#rp-bonds").textContent = d.hb + " / " + d.sb;
    $("#rp-p1").textContent = d.p1;
    $("#rp-cons").textContent = d.cons + "%";
    $("#rp-note").innerHTML = d.note;
    paintAlignment(pos);
  }

  var ruler = $("#ruler");
  if (ruler) {
    $$(".pd-res", ruler).forEach(function (b) {
      b.addEventListener("click", function () { selectResidue(Number(b.dataset.pos)); });
      b.addEventListener("mouseenter", function () { paintAlignment(Number(b.dataset.pos)); });
    });
    ruler.addEventListener("mouseleave", function () {
      var on = $('.pd-res[aria-pressed="true"]');
      paintAlignment(on ? Number(on.dataset.pos) : null);
    });
    selectResidue(23);
  }

  /* ---- 2. alignment shading toggle -------------------------------------- */
  var aln = $("#aln");
  if (aln) {
    aln.dataset.mode = "cons";
    $$(".pd-chip[data-mode]", aln).forEach(function (b) {
      b.addEventListener("click", function () {
        aln.dataset.mode = b.dataset.mode;
        $$(".pd-chip[data-mode]", aln).forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", String(on));
        });
      });
    });
  }

  /* ---- 3. truncation ladder --------------------------------------------- */
  var LAD = __LAD__;
  var ladder = $("#ladder");
  if (ladder) {
    var slider = $("#lad-slider", ladder);
    var mark = $("#lad-mark", ladder);
    var X0 = 78, X1 = 852;

    function readRung(s) {
      var d = LAD[s - 1];
      mark.setAttribute("x1", (X0 + (s - 1) * (X1 - X0) / 16).toFixed(1));
      mark.setAttribute("x2", (X0 + (s - 1) * (X1 - X0) / 16).toFixed(1));
      $("#lr-name").innerHTML = "BoPep4 " + s + "–23";
      var v = $("#lr-verdict");
      v.textContent = d.verdict;
      v.className = "pd-tag is-" + (d.verdict === "binder" ? "anchor" : d.verdict === "weak" ? "partial" : "none");
      $("#lr-seq").textContent = d.seq;
      $("#lr-len").textContent = d.seq.length + " aa / " + (d.q >= 0 ? "+" : "") + d.q;
      $("#lr-s1").innerHTML = "−" + Math.abs(d.s1).toFixed(1);
      $("#lr-n1").innerHTML = "−" + Math.abs(d.n1).toFixed(1);
      $("#lr-ip").innerHTML = (d.ip1 ? d.ip1.toFixed(2) : "—") +
        " · PEPR2 " + (d.ip2 ? d.ip2.toFixed(2) : "—");
      $("#lr-anch").textContent = d.anchors;
    }
    slider.addEventListener("input", function () { readRung(Number(slider.value)); });

    $$(".pd-chip[data-lad]", ladder).forEach(function (b) {
      b.addEventListener("click", function () {
        /* these are SVG groups, and SVGElement has no .hidden IDL property,
           so the attribute has to be set by hand. */
        ["raw", "norm", "iptm"].forEach(function (k) {
          var g = document.getElementById("lad-" + k);
          if (k === b.dataset.lad) { g.removeAttribute("hidden"); }
          else { g.setAttribute("hidden", "hidden"); }
        });
        $$(".pd-chip[data-lad]", ladder).forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", String(on));
        });
      });
    });
    readRung(9);
  }

  /* ---- 4. the benchmark view -------------------------------------------- */
  var bench = $("#bench");
  if (bench) {
    bench.dataset.view = "all";
    $$(".pd-chip[data-bench]", bench).forEach(function (b) {
      b.addEventListener("click", function () {
        bench.dataset.view = b.dataset.bench;
        $$(".pd-chip[data-bench]", bench).forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", String(on));
        });
      });
    });
  }

  /* ---- 5. the claim ledger ---------------------------------------------- */
  var ledger = $("#ledger");
  if (ledger) {
    $$(".pd-chip[data-st]", ledger).forEach(function (b) {
      b.addEventListener("click", function () {
        var want = b.dataset.st;
        $$(".pd-claim", ledger).forEach(function (li) {
          li.hidden = !(want === "all" || li.dataset.st === want);
        });
        $$(".pd-chip[data-st]", ledger).forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", String(on));
        });
      });
    });
  }
})();
"""


def js_payload():
    import json
    res = []
    for i, aa, sasa, hb, sb, cls, p1, p2, cons, note in RES:
        three = {"G": "Gly", "I": "Ile", "L": "Leu", "S": "Ser", "K": "Lys", "R": "Arg",
                 "P": "Pro", "E": "Glu", "H": "His", "N": "Asn"}[aa]
        res.append({
            "name": three + str(i), "sasa": sasa, "hb": hb, "sb": sb,
            "cls": cls, "clsLabel": CLS_LABEL[cls], "p2": p2, "p2Label": P2_LABEL[p2],
            "p1": p1, "cons": round(cons * 100), "note": note,
        })
    lad = []
    for s in range(1, 18):
        sc1, b1, ip1, pae1, sc2, b2, ip2, pae2, verdict = LAD[s]
        frag = SEQ[s - 1:]
        lad.append({
            "seq": frag, "q": net_charge(frag), "s1": sc1, "n1": sc1 / b1 * 1000,
            "ip1": ip1, "ip2": ip2, "verdict": verdict,
            "anchors": ", ".join(SEQ[p - 1] + str(p) for p in ANCHOR_POS if p >= s),
        })
    return (JS.replace("__RES__", json.dumps(res, ensure_ascii=False))
              .replace("__COL2POS__", json.dumps({str(k): v for k, v in COL2POS.items()}))
              .replace("__LAD__", json.dumps(lad)))


BANNER = """
      <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <!-- the concave face of an LRR solenoid, drawn as stacked arcs, with the
             peptide threaded along it and the six anchors marked. Schematic. -->
        <g>
          <path class="ban-groove" d="M110 250 C 300 96, 900 96, 1090 250" />
          <path class="ban-lrr" d="M96 262 C 292 84, 908 84, 1104 262" />
          <path class="ban-lrr" d="M84 276 C 286 70, 914 70, 1116 276" />
          <path class="ban-lrr" d="M126 238 C 308 110, 892 110, 1074 238" />
          <path class="ban-lrr" d="M142 226 C 316 124, 884 124, 1058 226" />
        </g>
        <path class="ban-pep" d="M150 214 C 260 176, 330 200, 400 184
                                 C 470 168, 520 196, 590 180
                                 C 660 164, 720 190, 790 172
                                 C 860 154, 920 176, 980 158" />
        <g>
          <line class="ban-link" x1="400" y1="184" x2="392" y2="140" />
          <line class="ban-link" x1="590" y1="180" x2="582" y2="136" />
          <line class="ban-link" x1="790" y1="172" x2="782" y2="128" />
          <line class="ban-link" x1="980" y1="158" x2="1006" y2="196" />
        </g>
        <circle class="ban-anch" cx="400" cy="184" r="5.5" />
        <circle class="ban-anch" cx="590" cy="180" r="5.5" />
        <circle class="ban-anch" cx="790" cy="172" r="5.5" />
        <circle class="ban-anch is-clamp" cx="980" cy="158" r="7.5" />
      </svg>
"""


def build():
    page = []
    A = page.append
    A('<!DOCTYPE html>')
    A('<html lang="en">')
    A('<head>')
    A('  <meta charset="utf-8" />')
    A('  <meta name="viewport" content="width=device-width, initial-scale=1" />')
    A('  <title>Peptide Design | ReLeaf &middot; iGEM 2026</title>')
    A('  <meta name="description" content="How the twenty-three residues of BoPep4 were divided into a protected core and two editable ends, which of our own results survived their controls, and what was ordered." />')
    A('  <link rel="icon" href="../assets/img/logo.png" />')
    A('  <link rel="stylesheet" href="../assets/css/tokens.css" />')
    A('  <link rel="stylesheet" href="../assets/css/nav.css" />')
    A('  <link rel="stylesheet" href="../assets/css/page.css" />')
    A('  <style>' + CSS + '  </style>')
    A('</head>')
    A('<body>')
    A('')
    A('  <div id="site-nav" data-base="../" data-tab="drylab" data-page="peptide-design"></div>')
    A('  <div class="sitenav-spacer"></div>')
    A('')
    A('  <header class="pagehead pagehead--hero">')
    A('    <div class="pagehead__hero">')
    A('      <div class="pagehead__bg">' + BANNER + '</div>')
    A('      <div class="pagehead__heroinner">')
    A('        <p class="pagehead__eyebrow"><a href="../">ReLeaf</a> <i>/</i> Dry Lab <i>/</i> Peptide Design</p>')
    A('        <h1 class="pagehead__title">Peptide Design</h1>')
    A('      </div>')
    A('    </div>')
    A('    <div class="pagehead__inner">')
    A('      <p class="pagehead__lede">BoPep4 is twenty-three residues long. This page is the record of which of them we were allowed to change, how we worked that out, and which of our own answers we later took back.</p>')
    A('      <ul class="pagehead__meta">')
    A('        <li><b>Section</b><span>Dry Lab</span></li>')
    A('        <li><b>Written by</b><span>Dry lab, protein design</span></li>')
    A('        <li><b>Last updated</b><span>4 September 2026</span></li>')
    A('        <li><b>Status</b><span>Draft</span></li>')
    A('      </ul>')
    A('    </div>')
    A('  </header>')
    A('')
    A('  <div class="pagewrap">')
    A('    <details class="toc" open>')
    A('      <summary>Contents</summary>')
    A('      <div class="toc__inner"><p class="toc__title">On this page</p></div>')
    A('    </details>')
    A('')
    A('    <main class="pagebody">')
    A(BODY)
    A('    </main>')
    A('  </div>')
    A('')
    A('  <nav class="pagenav" aria-label="Neighbouring pages">')
    A('    <a class="is-prev" href="../software/"><b>Previous</b><span>Software</span></a>')
    A('    <a class="is-next" href="../md-simulations/"><b>Next</b><span>MD Simulations</span></a>')
    A('  </nav>')
    A(FOOTER)
    A('  <script src="../assets/data/site-nav.js"></script>')
    A('  <script src="../assets/js/nav.js"></script>')
    A('  <script src="../assets/js/page.js"></script>')
    A('  <script>' + js_payload() + '  </script>')
    A('</body>')
    A('</html>')
    return "\n".join(page)


FOOTER = """
  <footer class="footer2">
    <div class="footer2__inner">
        <div>
          <h3>Project</h3>
          <ul>
          <li><a href="../description/">Description</a></li>
          <li><a href="../engineering/">Engineering</a></li>
          <li><a href="../contribution/">Contribution</a></li>
          <li><a href="../results/">Results</a></li>
          </ul>
        </div>
        <div>
          <h3>Wet Lab</h3>
          <ul>
          <li><a href="../experiments/">Experiments</a></li>
          <li><a href="../parts/">Parts</a></li>
          <li><a href="../plant/">Plants</a></li>
          <li><a href="../measurement/">Measurement</a></li>
          <li><a href="../safety-and-security/">Safety</a></li>
          <li><a href="../notebook/">Notebook</a></li>
          </ul>
        </div>
        <div>
          <h3>Dry Lab</h3>
          <ul>
          <li><a href="../model/">Math Model</a></li>
          <li><a href="../bioreactor-calculations/">Bioreactor Calculations</a></li>
          <li><a href="../hardware/">Hardware</a></li>
          <li><a href="../software/">Software</a></li>
          <li><a href="../peptide-design/">Peptide Design</a></li>
          <li><a href="../md-simulations/">MD Simulations</a></li>
          <li><a href="../drylab-notebook/">Dry Lab Notebook</a></li>
          </ul>
        </div>
        <div>
          <h3>Engagement</h3>
          <ul>
          <li><a href="../human-practices/">Integrated Human Practices</a></li>
          <li><a href="../education/">Education</a></li>
          <li><a href="../entrepreneurship/">Entrepreneurship</a></li>
          <li><a href="../sustainability/">Sustainability</a></li>
          <li><a href="../laws-and-regulations/">Laws and Regulations</a></li>
          <li><a href="../geospatial-analysis/">Geospatial Analysis</a></li>
          <li><a href="../data-physicalization/">Data Physicalization</a></li>
          </ul>
        </div>
        <div>
          <h3>Team</h3>
          <ul>
          <li><a href="../team/">Members</a></li>
          <li><a href="../attributions/">Attribution</a></li>
          <li><a href="../milestone/">Milestone</a></li>
          <li><a href="../gallery/">Gallery</a></li>
          </ul>
        </div>
      <div class="footer2__legal">
        <p><b>ReLeaf</b> &middot; GEMS Taiwan &middot; iGEM 2026 &middot; Biomanufacturing Village</p>
        <p>&copy; 2026 &middot; Content on this wiki is licensed under a <a href="https://creativecommons.org/licenses/by/4.0/" rel="license">Creative Commons Attribution 4.0 International license</a>.</p>
        <p>The repository used to create this website is available at <a href="https://gitlab.igem.org/2026/gems-taiwan">gitlab.igem.org/2026/gems-taiwan</a>.</p>
        <p>Nothing on this wiki is fetched from a server outside iGEM. Before the wiki freeze, every image and font has to be re-hosted on <code>static.igem.wiki</code>.</p>
      </div>
    </div>
  </footer>
"""



# ---------------------------------------------------------------------------
# the prose
# ---------------------------------------------------------------------------
BODY = """
      <section class="sec" id="the-target">
        <h2>The design target is a 23-mer that has to clear two receptors and a secretion pore</h2>

        <p class="lede">
          BoPep4 is a plant elicitor peptide from <i>Brassica&nbsp;oleracea</i>, mature
          sequence <code>GILIGSKKRPREPHSSGKPGGHN</code>. Plants release peptides of this
          family when they are wounded or stressed; the receptor kinases PEPR1 and PEPR2
          read them, recruit the co-receptor BAK1, and switch on defence and
          stress-tolerance responses&nbsp;[1,&nbsp;3]. ReLeaf asks <i>Bacillus subtilis</i>
          to secrete one of these peptides into the root zone, so the molecule has to
          satisfy two judges at once: the receptor at the far end, and the secretion
          machinery it has to leave the cell through.
        </p>

        <p>
          Those two judges disagree. The receptor wants the C-terminal two thirds intact
          and untouched. The secretion pathway wants a short, uncharged mature N-terminus
          at the signal-peptidase junction, and it does not care what happens downstream.
          Nearly every design decision on this page comes out of that disagreement, and
          the design space is small enough to enumerate: twenty-three positions, a handful
          of substitutions worth making, and seventeen possible N-terminal truncations.
        </p>

        <div class="callout">
          <p class="callout__label">What this page is for</p>
          <p>
            The <a href="../engineering/">Engineering page</a> tells this work as four
            design&ndash;build&ndash;test&ndash;learn cycles, in the order they happened.
            This page is the technical record underneath them: the inputs, the residue-level
            map, the two structural methods, the controls they were put through, and the
            places where they failed. The all-atom trajectory work sits on its own page,
            <a href="../md-simulations/">MD&nbsp;Simulations</a>.
          </p>
        </div>

        <h3>The modelling question, stated so it can be answered wrongly</h3>
        <p>
          Two questions run through everything below, and keeping them apart is the single
          most useful thing this project did.
        </p>
        <ul>
          <li>
            <b>Question A, structural.</b> Does a given edit prevent the peptide from
            making the interface the crystal shows? This has a defined answer at the level
            of named, mutagenesis-validated contacts.
          </li>
          <li>
            <b>Question B, affinity.</b> Which variant binds most tightly? Our pipeline
            cannot answer this, and section&nbsp;7 is the experiment that proves it cannot.
          </li>
        </ul>
        <p>
          Every claim on this page is a Question&nbsp;A claim. Where the project made
          Question&nbsp;B claims, they have been withdrawn, and they are listed as withdrawn
          in section&nbsp;8.
        </p>
      </section>

      <section class="sec" id="ground-truth">
        <h2>Three published results carry more weight than anything we computed</h2>

        <p>
          The modelling is anchored to experiments other people did, and it is worth being
          precise about which parts of the story we own and which parts we borrowed.
        </p>

        <div class="tablewrap">
          <table class="data">
            <thead><tr><th>What it establishes</th><th>Evidence</th><th>How the design uses it</th></tr></thead>
            <tbody>
              <tr>
                <td>The binding mode</td>
                <td>PDB&nbsp;5GR8, the PEPR1&ndash;AtPep1 co-crystal at 2.59&nbsp;&Aring;&nbsp;[1]</td>
                <td>Supplies the pose, the receptor partners, and the fact that AtPep1 residues 1&ndash;6 are not resolved at all.</td>
              </tr>
              <tr>
                <td>Which residues carry activity</td>
                <td>Alanine scan and deletion series on AtPep1&nbsp;[2]</td>
                <td>Gly17 costs more than 4,000-fold, Ser15 about 100-fold, removing the C-terminal Asn about 400-fold. All three positions are conserved in BoPep4.</td>
              </tr>
              <tr>
                <td>That the two receptors are not interchangeable</td>
                <td>Radioligand binding&nbsp;[3]: PEPR1 binds AtPep1&ndash;6; PEPR2 binds only AtPep1 and AtPep2</td>
                <td>Makes AtPep5 and AtPep6 the controls any method claiming to read PEPR2 recognition has to reject.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          BoPep4 is not a designed sequence in the <i>de novo</i> sense. It is a natural
          <i>Brassica</i> peptide chosen because it aligns onto AtPep1 with every
          activity-critical position conserved, and the design work is the decision about
          what to change from there.
        </p>
      </section>

      <section class="sec" id="alignment">
        <h2>The family varies everywhere except four positions</h2>

        <p>
          Seventeen mature Pep sequences, seven from <i>Arabidopsis</i> and nine from
          <i>Brassica</i> species alongside BoPep4, aligned over twenty-four columns.
          The N-terminal third is close to unreadable as a family: at most six of
          seventeen sequences agree on any residue in columns 1&ndash;6. The C-terminal
          third is the opposite. <b>Ser15, Ser16, Gly17 and Gly20 are the same residue in
          all seventeen.</b>
        </p>

        __ALIGNMENT__

        <p>
          Two things in that grid mattered to the design. The first is that the invariant
          block sits exactly where the crystal puts the interface, which is the subject of
          the next section. The second is Asn23: it is the last residue in twelve of the
          seventeen, and the others end in His, Ser, Asp or Thr. So the family does not
          conserve the asparagine side chain as strictly as it conserves Gly17 &mdash; and
          Pearce measured the same thing directly, since replacing Asn23 with alanine is
          tolerated while <i>removing</i> it costs about 400-fold&nbsp;[2]. What is
          conserved is the free carboxylate at the end of the chain, not the side chain
          hanging off it. That distinction decides section&nbsp;9.
        </p>
      </section>

      <section class="sec" id="interface">
        <h2>Residues 7&ndash;23 make the interface and 1&ndash;6 touch nothing</h2>

        <p>
          BoPep4 was docked onto the PEPR1 ectodomain taken from the 5GR8 crystal, in
          HADDOCK&nbsp;2.5, with restraints transferred from the crystallographic
          interface&nbsp;[4]. Before trusting the result, the same protocol was run on
          AtPep1 itself: it returned the crystal pose at <b>0.77&nbsp;&Aring; ligand
          RMSD</b>, top-ranked, with a 35-unit score gap to the first non-native pose. The
          PEPR2 interface has no crystal to stand on and was predicted twice, by
          AlphaFold3 co-folding and by docking, with the disagreements between them
          reported rather than averaged.
        </p>

        <p>
          Below is the interface, residue by residue, as buried surface area on PEPR1 with
          the receptor partner and the PEPR2 status attached. Pick a residue to read it,
          and the matching column of the alignment above lights up with it.
        </p>

        __RULER__

        <p>
          The shape of that strip is the whole design brief. Nothing is buried until
          Lys7. From there the peptide runs a belt of basic residues along a row of
          receptor carboxylates &mdash; Lys7 to Glu199, Arg9 to Asp179, Arg11 to Asp294,
          Lys18 to Glu324 and Asp348, His22 to Glu439 &mdash; and finishes with Asn23
          buried in a pocket at 170&nbsp;&Aring;&sup2;, more than any other residue, held
          by three receptor side chains at once.
        </p>

        <div class="figs figs--2">
          <figure class="fig">
            <img src="../assets/img/peptide-design/pep-anchor-belt.webp"
                 alt="Ribbon rendering of the peptide lying along the concave face of the receptor solenoid, with three basic side chains reaching down to receptor carboxylates and the distances labelled."
                 width="1300" height="950" loading="lazy" decoding="async" />
            <figcaption>
              <b>Figure 1.</b> The electrostatic belt. The peptide (orange) runs the concave
              face of the leucine-rich-repeat solenoid, and the basic side chains at
              positions 7, 9 and 18 reach down onto fixed receptor carboxylates at 2.6 to
              3.0&nbsp;&Aring;. Rendered from a docked model that carries Arg at position 18;
              the belt architecture is the same in every complex in the panel, including
              wild-type Lys18.
            </figcaption>
          </figure>
          <figure class="fig">
            <img src="../assets/img/peptide-design/pep-asn23-clamp.webp"
                 alt="Surface rendering showing the peptide C-terminus buried inside a pocket of the receptor, with the terminal asparagine drawn as sticks."
                 width="1150" height="950" loading="lazy" decoding="async" />
            <figcaption>
              <b>Figure 2.</b> The C-terminal clamp. Asn23 is not on the surface of the
              interface, it is inside a pocket, and its free &alpha;-carboxylate
              salt-bridges Arg487 at 2.40&nbsp;&Aring; in the crystal&nbsp;[1]. There is no
              room for a residue 24 without the peptide leaving the pocket.
            </figcaption>
          </figure>
        </div>

        <div class="disclose disclose--solo"><details class="disclose"><summary><span class="disclose__title">The per-residue table in full</span><span class="disclose__hint">Buried surface, bond counts, receptor partners and family conservation for all twenty-three positions.</span></summary><div class="disclose__body">
        __RESTABLE__
        <p>Burial and bond counts are measured on the native-mode PEPR1 complex; PEPR2 status is read off the AlphaFold3 pocket map. Positions marked <i>not mapped</i> are inside the bound stretch but were not assigned a PEPR2 partner by either method.</p>
        </div></details></div>

        <h3>PEPR2 reads the same footprint with two fewer grips</h3>
        <p>
          PEPR2 is 64% identical to PEPR1 and its groove superimposes to within about
          2&nbsp;&Aring; at every anchor position. It keeps the C-terminal clamp and the
          Lys7, Arg9, Ser15, Ser16 and His22 partners. It loses the acidic partner of
          Arg11 and the basic partner of Glu12, and position 18 faces a hydrophobic patch
          instead of a carboxylate. A receptor that keeps the anchors and loses the middle
          of the belt is a plausible structural account of why PEPR2 binds two members of
          the family where PEPR1 binds six&nbsp;[3]. It is an account, not a measurement:
          there is no PEPR2 structure, and everything in this paragraph inherits the
          uncertainty of an AlphaFold model.
        </p>
      </section>

      <section class="sec" id="rules">
        <h2>The interface map splits the peptide into a protected core and two editable ends</h2>

        <p>
          Reading the strip as a design rule gives the constraint every later decision was
          checked against.
        </p>

        <div class="pd-rules">
          <div class="pd-rule pd-rule--keep">
            <h4>Do not touch</h4>
            <p>
              The invariant core <code>Ser15, Ser16, Gly17, Gly20</code> and the C-terminal
              <code>Asn23</code>, plus the belt anchors <code>Lys7, Arg9, Arg11, Lys18,
              His22</code>. Every one of these is either invariant across the family, buried
              at the interface, or measured as costly by Pearce &mdash; and most are all three.
            </p>
          </div>
          <div class="pd-rule pd-rule--free">
            <h4>Free to edit</h4>
            <p>
              The N-terminus <code>1&ndash;6</code>, which buries nothing on either receptor
              and is invisible in the crystal, and the solvent-facing
              <code>Lys8, Pro10, Pro13, Pro19</code>. This is where truncations and any
              purification tag have to go.
            </p>
          </div>
        </div>

        <p>
          The rule is stronger than a docking score because none of it depends on one: it
          is burial, plus family conservation, plus published mutagenesis. All three agree
          on the same block of the sequence.
        </p>
      </section>

      <section class="sec" id="ladder">
        <h2>The truncation ladder has a cliff, and the two methods put it five residues apart</h2>

        <p>
          If residues 1&ndash;6 do nothing at the receptor, how much further can the
          peptide be cut? Cutting is worth something: a shorter payload is cheaper to
          synthesise, and moving the mature N-terminus changes the charge the signal
          peptidase sees. So the whole ladder was built rather than one guess &mdash;
          every N-terminal truncation from 1&ndash;23 down to 17&ndash;23, docked against
          both receptors and co-folded in AlphaFold3. Seventeen fragments, two receptors,
          thirty-four complexes.
        </p>

        __LADDER__

        <p>
          Read on the docking score, the curve is a ramp with no edge in it. Read on
          AlphaFold3 confidence, it is flat from 1&ndash;23 all the way to 13&ndash;23 and
          then falls off between 13&ndash;23 and 14&ndash;23, where interface confidence
          drops from 0.87 to 0.54 and the interface error jumps from 2.5 to
          8.9&nbsp;&Aring;. The two methods are answering different questions: one is
          asking how much interface there is, the other is asking whether it can place the
          peptide at all.
        </p>

        <h3>Switch the axis to score per buried &Aring;&sup2; and the cliff disappears</h3>
        <p>
          The third setting on that chart is the one that mattered. Across the seventeen
          rungs, the docking score correlates with peptide length at r&nbsp;=&nbsp;&minus;0.96
          and with buried surface area at r&nbsp;=&nbsp;&minus;0.98; a regression on length
          and net charge alone explains <b>93% of its variance</b>. Divide the score by the
          area it buries and the whole series lies between &minus;72 and &minus;87 with no
          step at any position, Arg9 included. The shortest fragment in the set, a
          documented non-binder, has the most favourable score per residue of any rung.
        </p>
        <p>
          The verdict column in the source table was assigned by hard score cut-offs. Given
          that score runs at about &minus;7.4 per residue, the cut-off at &minus;160 is a
          length threshold at fifteen residues, and fifteen residues is 9&ndash;23. The
          cliff was reported at Arg9 because the threshold was set where Arg9 is.
        </p>
        <p>
          None of this is surprising once it is looked for. Docking scores have been
          benchmarked against measured affinities on forty-six complexes and carry no
          useful correlation with them&nbsp;[8], and interface energy terms scale with
          interface size, which is why contact counts predict affinity where raw energies
          do not&nbsp;[9]. The project had been reading a size measurement as a strength
          measurement.
        </p>

        <div class="callout callout--unproven">
          <p class="callout__label">What survives</p>
          <p>
            The claim that the C-terminal fifteen or so residues carry the activity, and the
            N-terminal six to eight are dispensable, holds: AlphaFold3, our docking, Pearce's
            deletion series&nbsp;[2] and Cui&nbsp;2024&nbsp;[15] all agree on it. The precise
            position of the cliff does not hold. It is stated on this wiki as
            <b>somewhere between residues 9 and 14</b>, with both methods' answers given,
            and the wet-lab fragment set was chosen to span that range instead of
            committing to either answer.
          </p>
        </div>
      </section>

      <section class="sec" id="benchmark">
        <h2>The docking failed the one benchmark that had measured activity attached</h2>

        <p>
          Everything above is a Question&nbsp;A claim about geometry. The project also
          wanted to rank designs, which is Question&nbsp;B, so it ran the test that decides
          whether it can. Pearce&nbsp;2008 measured half-maximal activity for an alanine
          scan across the 9&ndash;23 scaffold&nbsp;[2]. Sixteen of those analogues sit on the
          same 9&ndash;23 scaffold, so length and buried surface are essentially constant
          and the substitution is the only large variable. Docking all sixteen against measured
          activity is as clean a test of a scoring function as this project could build.
        </p>

        __BENCH__

        <p>
          The three analogues Pearce measured as catastrophic rank 7th, 8th and 9th out of
          sixteen. G17A, which is more than 1,600-fold less active than any analogue the
          docking ranked in its top six, scores as a <i>better</i> binder than all of them.
          Spearman &rho; is <b>+0.05</b> with p&nbsp;&gt;&nbsp;0.8. The correlation the
          source report originally quoted, +0.237, included the wild-type reference point
          in its own correlation; removing that one self-referential point takes it to
          +0.05, and it is not significant either way.
        </p>

        <p>
          The co-folding arm fails the same control from the other direction. [A17]Pep1 is
          the Gly17&rarr;Ala analogue Pearce measured at more than 4,000-fold down, and it
          was included in the AlphaFold3 panel as a designed negative. It scored interface
          confidence 0.73 against wild-type BoPep4's 0.74. This is the documented behaviour
          of AlphaFold-family models on single missense substitutions&nbsp;[11], and our
          own control reproduced it.
        </p>

        <div class="callout">
          <p class="callout__label">The rule this set</p>
          <p>
            Neither method has substitution-level resolution, so neither is used to rank
            designs anywhere on this wiki. Both are used for what the benchmark shows they
            can do: decide whether a given edit still permits the native interface. Affinity
            ranking is what the plant assay is for.
          </p>
        </div>
      </section>

      <section class="sec" id="audit">
        <h2>An audit of our own pipeline retracted five claims, one of them after the DNA had shipped</h2>

        <p>
          The audit started as a complaint. A team member pointed out that the docking had
          been run without an inspectable statement of its restraints and search space.
          That objection is partly a category error &mdash; HADDOCK has no search box to
          report, because its search space <i>is</i> the list of residues declared active
          at the interface&nbsp;[4] &mdash; and partly correct, because that list had never
          been written down anywhere a reader could find it. Reconstructing it from the run
          trees turned up four problems, and the one that mattered was not the missing
          documentation.
        </p>

        <div class="tablewrap tablewrap--wide">
          <table class="data">
            <thead><tr><th></th><th>Founding campaign, 8 runs</th><th>The five later campaigns, 113 runs</th><th>Recommended for peptides</th></tr></thead>
            <tbody>
              <tr><td>Restraints derived from</td><td>The 5GR8 crystal interface</td><td class="open">The pose being tested</td><td>Independent evidence&nbsp;[4]</td></tr>
              <tr><td>Peptide starting coordinates</td><td>Threaded on the crystal backbone</td><td class="open">The bound pose</td><td>Three unbound conformers&nbsp;[6]</td></tr>
              <tr><td>Rigid-body sampling</td><td>800</td><td class="open">40</td><td>1000&nbsp;[5]</td></tr>
              <tr><td>Clustering</td><td>RMSD at 5.0&nbsp;&Aring;</td><td class="open">FCC at 0.60</td><td>5.0&nbsp;&Aring; for peptides&nbsp;[17]</td></tr>
              <tr><td>Unit of analysis</td><td>Clusters, with a size and a spread</td><td class="open">One top-scoring structure</td><td>Mean of the top four in a cluster&nbsp;[7]</td></tr>
              <tr><td>Positive control</td><td>AtPep1 re-docked, 0.77&nbsp;&Aring;</td><td class="open">None</td><td>Required&nbsp;[4,&nbsp;12]</td></tr>
            </tbody>
          </table>
        </div>

        <p>
          The later campaigns start from the pose they are meant to be testing and derive
          their restraints by measuring which residues touch in that same pose. A run built
          that way cannot reject its own input. It is a legitimate operation, restrained
          refinement, and it was described in the downstream reports as independent
          physics-based confirmation of the AlphaFold3 models, which it is not. The runs
          also produced a single cluster containing every structure, so clustering carried
          no information, and no run was repeated at a second random seed, so no reported
          score difference had an error bar on it.
        </p>

        <p>
          Two further findings came out of the project's own data with no new computation.
          The founding campaign's mutant table shows every point mutant scoring
          <i>better</i> than wild type, with the two mutants the literature calls most
          damaging scoring best of all. And the wild-type run's top-ranked cluster is a
          non-native pose at 5.80&nbsp;&Aring;; the complex carried forward as canonical is
          cluster three of four, chosen because it matches the crystal. That choice is
          defensible and it is now stated: the canonical wild-type pose is homology-guided,
          not blindly predicted.
        </p>

        <h3>The ledger</h3>
        <p>
          Every claim the docking programme produced, with what it now rests on. Five were
          withdrawn. The one that hurt was K18R, which had already gone into a DNA order
          and was pulled out of it on the morning of 16&nbsp;August.
        </p>

        __LEDGER__

        <p>
          K18R is worth one more sentence, because it was withdrawn twice for different
          reasons. The audit killed the docking-score argument in July. What survived into
          August was a structural argument from the literature: Tang reports AtPep1's
          Arg18 both salt-bridging Asp348 and packing against Phe371, and BoPep4 has a
          lysine there, which can make the salt bridge but not the stack&nbsp;[1]. Then the
          August panel measured the distances. BoPep4's own Lys18 sits 2.62&nbsp;&Aring;
          from Asp348 and 4.17&nbsp;&Aring; from Phe371, against 2.50 and 4.09&nbsp;&Aring;
          in the crystal, and in three of four constructs it approaches the aromatic ring
          more closely than a re-docked arginine does. A lysine amine over an aromatic ring
          is a cation&ndash;&pi; contact. The gap the substitution existed to close was not
          visible in our own models, so it lost its last rationale and its cloning slot.
        </p>
      </section>

      <section class="sec" id="tag">
        <h2>A C-terminal tag deletes the bond the peptide binds with</h2>

        <p>
          Every BoPep4 construct the project ordered before August fused six histidines
          directly onto Asn23, with no linker. The reason this is fatal needs no docking at
          all, and stating it without one is the point: peptide-bond geometry puts the
          backbone nitrogen of any residue 24 essentially where Asn23's terminal oxygen
          sits, which in the crystal is 2.40&nbsp;&Aring; from Arg487&nbsp;NH1 and
          2.80&nbsp;&Aring; from NE, one half of a bidentate salt bridge&nbsp;[1].
          Substituting an amide nitrogen there does not weaken that bond, it removes it.
        </p>

        <p>
          The literature has already run the experiment. AtPep2, AtPep4 and AtPep5 all
          carry natural C-terminal extensions past the conserved asparagine. Two of the
          three fail to bind PEPR1 at all, the third binds and cannot recruit the
          co-receptor, and truncating the extension restores activity in all three&nbsp;[1].
          That is the base rate our seven tagged cassettes were drawing from.
        </p>

        <h3>The two ends of the peptide are not the same engineering site</h3>
        <p>
          The geometric question was asked with a flood fill over the receptor structure
          using a 2.4&nbsp;&Aring; backbone-clearance probe: if a chain leaves the bound
          peptide at either terminus, can it reach bulk solvent without the peptide moving?
          No force field, no scoring function, nothing the audit had criticised.
        </p>

        <div class="tablewrap">
          <table class="data">
            <thead><tr><th>Terminus</th><th>State</th><th>Free grid points</th><th>Path to solvent</th><th>In residues</th></tr></thead>
            <tbody>
              <tr><td>N-terminus</td><td>PEPR1 alone</td><td>111</td><td>6.5&nbsp;&Aring;</td><td>1.9</td></tr>
              <tr><td>N-terminus</td><td>PEPR1 + BAK1</td><td>111</td><td>6.5&nbsp;&Aring;</td><td>1.9</td></tr>
              <tr><td>C-terminus</td><td>PEPR1 alone</td><td>45</td><td>10.4&nbsp;&Aring;</td><td>3.0</td></tr>
              <tr><td>C-terminus</td><td class="open">PEPR1 + BAK1</td><td class="open">2</td><td class="open">20.9&nbsp;&Aring;</td><td class="open">6.2</td></tr>
            </tbody>
          </table>
        </div>

        <p>
          The co-receptor position comes from a ternary model built on SERK-family
          templates&nbsp;[16] and AlphaFold3, because no PEPR1&ndash;BAK1 crystal exists.
          Co-receptor binding does not touch the N-terminal side by a single grid point,
          and it closes the C-terminal side almost completely: the escape path becomes
          longer than the six-residue tag that has to fit through it. An N-terminal tag
          goes into space the peptide's own disordered N-terminus already occupies. A
          C-terminal tag goes into the receptor&ndash;co-receptor interface.
        </p>

        <figure class="fig fig--wide">
          <img src="../assets/img/engineering/pep-terminus-asymmetry.webp"
               alt="Bar chart of free space at each peptide terminus with and without the co-receptor bound. The N-terminal bars are identical; the C-terminal free space collapses from 45 points to 2."
               width="1400" height="526" loading="lazy" decoding="async" />
          <figcaption>
            <b>Figure 3.</b> Free space at each terminus, with and without the co-receptor.
            The two N-terminal bars are identical because the co-receptor does not touch
            that side.
            <span class="prov">Generated from our own flood-fill output. Scaled only.</span>
          </figcaption>
        </figure>

        <h3>The docking agreed, under a test permissive enough to rescue a known non-binder</h3>
        <p>
          A thirty-pose panel was then run on the eight constructs with one shared
          wild-type-derived restraint set per receptor, sampling raised to 100/30/30,
          clustering restored to 5.0&nbsp;&Aring;, and every engineering addition left
          <i>unrestrained</i>, so where the tag ended up was an output rather than an
          assumption. The result is categorical. Every construct reaches at least three of
          the four crystallographic clamp contacts except the C-terminally tagged one,
          which reaches <b>none of them, in none of its thirty poses</b>, with Asn23 sitting
          47 to 57&nbsp;&Aring; from all four of its partners.
        </p>
        <p>
          The panel's own negative control shows how permissive that test was: the
          documented non-binder 15&ndash;23 also reaches three of four clamp contacts,
          because it contains Asn23 and Lys18 and can therefore form them. A test generous
          enough to rescue a peptide known to be inactive could not rescue the tagged one.
        </p>

        <figure class="fig fig--wide">
          <img src="../assets/img/engineering/pep-clamp-vs-score.webp"
               alt="Two panels: how much of the crystallographic interface each construct reproduces, and the same data plotted against docking score. The already-ordered construct scores best and makes none of the contacts."
               width="1400" height="545" loading="lazy" decoding="async" />
          <figcaption>
            <b>Figure 4.</b> Clamp integrity against docking score. The construct already in
            flight buries 2,261&nbsp;&Aring;&sup2; and scores &minus;155.7, better than
            untagged wild-type BoPep4 at &minus;125.9, while making none of the four contacts
            that carry function. It binds the receptor extensively, in the wrong register.
            <span class="prov">Generated from our own docking output. Scaled only.</span>
          </figcaption>
        </figure>

        <p>
          A reproducibility check then made the same point a third time. Three constructs
          were re-run at two further random seeds. Clamp integrity was identical across all
          three seeds for all three constructs, including the failure, which repeated at
          0&nbsp;of&nbsp;4 every time. The docking score moved by 13 to 36 units. At one
          seed the tagged construct scored &minus;181.9, the best score in the entire study
          and better than the crystallographic positive control, while still making none of
          the four contacts. Every score difference this project had ever reported is
          smaller than that seed spread.
        </p>

        <div class="callout callout--medal">
          <p class="callout__label">Decision</p>
          <p>
            Every affinity tag moved to the N terminus, and every construct ordered after
            16&nbsp;August ends in a free <code>&hellip;G-G-H-N-COO&minus;</code>. The seven
            cassettes already at synthesis stay in the project as secretion and yield
            reporters, which they are good at, and they are not used for bioactivity. If a
            synthetic peptide is ordered it has to specify a C-terminal free acid, because
            peptide houses ship a C-terminal amide by default and that re-creates the same
            lesion.
          </p>
        </div>
      </section>

      <section class="sec" id="codon">
        <h2>Codon choice is scored on the worse of two accessibilities, never on their sum</h2>

        <p>
          A sequence the receptor accepts is worth nothing if the chassis will not initiate
          translation on its messenger RNA. The expression cassette is fixed &mdash; a
          green-light-inducible promoter, the MF001 ribosome binding site with its
          <code>AAGGAGG</code> core, the SamyQ secretion signal, the payload, the tag, the
          terminator &mdash; so the only free variable is synonymous codon choice, and the
          objective is the unpaired probability of two regions computed from the ViennaRNA
          base-pair matrix at 37&nbsp;&deg;C: the fifteen bases from the start codon, and
          the Shine&ndash;Dalgarno core. The reference is a gene that works in this chassis,
          <i>ho1</i>, at 0.681.
        </p>

        <p>
          The first optimiser ranked roughly 50,000 synonymous draws per payload by the
          <i>sum</i> of those two scores, and the design it returned had start accessibility
          at 0.911 and a Shine&ndash;Dalgarno core at 0.050, more occluded than the wild-type
          sequence it replaced. A sum lets the search buy a large gain in one term with a
          total loss in the other. Ranking moved to the bottleneck,
          <b>J&nbsp;=&nbsp;min(start&nbsp;+15, SD&nbsp;core)</b>, and the random draw was
          replaced with a deterministic descent over the codons that actually base-pair with
          the initiation region. On BoPep4 the bottleneck went from 0.067 to 0.528 at a
          codon adaptation index of 0.78.
        </p>

        <figure class="fig fig--wide">
          <img src="../assets/img/engineering/pep-initiation-bottleneck.webp"
               alt="Grouped bars of the translation-initiation bottleneck for each payload at three optimisation stages, with the reference gene marked as a dotted line."
               width="1360" height="545" loading="lazy" decoding="async" />
          <figcaption>
            <b>Figure 5.</b> The initiation bottleneck by payload and stage. Optimising for
            codon usage alone gives an adaptation index of 0.87 to 0.89 and a bottleneck
            near 0.054 &mdash; the Shine&ndash;Dalgarno core essentially fully occluded in
            every case.
            <span class="prov">Generated from our own ViennaRNA output. Scaled only.</span>
          </figcaption>
        </figure>

        <p>
          Two results here contradict standard practice and are worth stating plainly.
          Maximising codon adaptation alone produces designs whose ribosome binding site is
          buried, which is the opposite of the intended effect. And the published low-GC
          heuristic we ran as a literature control&nbsp;[13] made one payload <i>worse</i>
          than its own wild type. The wild-type sequence separately fails a manufacturing
          rule outright, with a run of seven adenines.
        </p>
        <p>
          What this model ranks is precursor supply. It says nothing about signal-recognition
          targeting, translocase throughput, or the quality-control proteases waiting on the
          far side of the membrane, and it is not a yield prediction.
        </p>

        <h3>The signal peptide was screened and then left alone</h3>
        <p>
          A panel of <i>B.&nbsp;subtilis</i> Sec signal peptides was ranked on the
          determinants known to matter &mdash; n-region charge, h-region hydrophobicity and
          length, and the &minus;3/&minus;1 cleavage rule &mdash; from verified UniProt
          sequences. SamyQ, the signal peptide already in our cassette, lands in the
          favourable zone with an n-region charge of +4, a hydrophobic core mean of 1.65
          and a clean A-X-A cleavage site; AprE is the best-matched alternative and AmyE
          the weakest. That ranking is worth what such rankings are worth: signal-peptide
          performance is strongly cargo-specific, and empirical screens of more than a
          hundred signal peptides routinely find that the winner is
          protein-dependent&nbsp;[14]. The screen chose which three to put in a wet-lab
          panel, and it does not replace one.
        </p>
      </section>

      <section class="sec" id="order">
        <h2>Six cassettes went to synthesis, and three of them are controls with published effect sizes</h2>

        <p>
          The order placed on 20&nbsp;August is the design endpoint. Every mature product is
          either the natural sequence exactly or the natural sequence with an N-terminal
          tag; nothing is fused after Asn23; no spacer was inserted, so each tagged
          construct has an untagged twin and the tag comparison is single-variable.
        </p>

        __CASSETTES__

        <p>
          D-01, D-06 and D-02 are the point of the order. They are wild type, S15A and
          G17A on one backbone: about 1&times;, about 100&times; and more than
          4,000&times; down in Pearce's measurements&nbsp;[2], four orders of magnitude of
          expected effect. Drop D-06 and the set collapses into a binary switch that can
          show the peptide works but cannot show the platform ranks variants. That
          distinction is the difference between a positive result and a measurement.
        </p>

        <p>
          The residual risk in this design sits at the cleavage junction. Signal peptidase&nbsp;I
          prefers small residues immediately after the cut, and four of the six constructs
          present a histidine there, D-04 presents an arginine followed by a proline, and
          only D-05 presents the ideal glycine. D-05 is therefore the internal control: if
          it secretes and the tagged constructs do not, the +1 residue is the cause and the
          peptide is exonerated. A cheaper answer already exists in the freezer, since the
          sequence-verified AmilCP construct uses the same signal peptide and is a
          chromoprotein, so its secretion can be read by eye off the supernatant.
        </p>

        <figure class="fig fig--wide">
          <img src="../assets/img/engineering/pep-cassette-map.webp"
               alt="Every BoPep4 expression cassette drawn to scale on a common axis, showing where the affinity tag sits in each one."
               width="1400" height="443" loading="lazy" decoding="async" />
          <figcaption>
            <b>Figure 6.</b> Every cassette drawn to scale. The ones already at synthesis put
            the tag where the receptor reads the peptide; the new ones put it at the end the
            crystal cannot resolve.
            <span class="prov">Generated from our own construct files. Scaled only.</span>
          </figcaption>
        </figure>

        <h3>Three design axes were retired in writing</h3>
        <p>
          Retiring an idea on evidence is worth more than dropping it quietly, so all three
          are recorded here. The <b>point-mutation axis</b> went, because position 8 makes
          no receptor contact and position 18 already makes the contacts the substitution
          was meant to add. <b>Tandem repetition</b> went: a sweep of
          (SSGKPGGHN)<sub>n</sub> for n&nbsp;=&nbsp;1&hellip;8 found buried area per residue
          falling monotonically with every added copy, from 127 to 32&nbsp;&Aring;&sup2; on
          PEPR1, and the number of copies actually touching the receptor saturating at three
          regardless of n. Repetition does not rescue a motif that does not bind alone. The
          shallow truncations <b>&Delta;1&ndash;2 and &Delta;1&ndash;3</b> went because
          their pre-registered predictions sat between two constructs we already had, which
          is close to no information for a cloning slot.
        </p>
        <p>
          One tandem idea survives in a different frame. The sweep asked whether repetition
          rescues binding, and it does not. It never asked whether repetition raises yield,
          and a cleavable-linker polypeptide giving n peptides per translation event is a
          real proposal. It needs a protease with clean specificity in <i>B.&nbsp;subtilis</i>,
          which is not a two-week problem, so it is filed as future work.
        </p>
      </section>

      <section class="sec" id="predictions">
        <h2>Five predictions, written down before the assay exists</h2>

        <p>
          These were recorded on 16&nbsp;August, before any construct had arrived, so they
          can be wrong in public.
        </p>

        <div class="tablewrap tablewrap--wide">
          <table class="data">
            <thead><tr><th></th><th>Prediction</th><th>What it costs us if it fails</th></tr></thead>
            <tbody>
              <tr><td class="num">E1</td><td>The N-tagged and untagged constructs show activity at concentrations where the C-terminally tagged ones show none.</td><td>If the C-His constructs are equally active, the structural model on this page is wrong and section&nbsp;9 is retracted.</td></tr>
              <tr><td class="num">E2</td><td>D-01 and D-04 are indistinguishable from each other.</td><td>If the tagged one is clearly worse, the N-terminal tag is not as inert as the flood fill says and the strategy needs re-examining.</td></tr>
              <tr><td class="num">E3</td><td>BoPep4 needs a higher dose than AtPep1 for the same response, because Gly21 cannot fill the co-receptor cavity AtPep1's Gln21 occupies.</td><td>Published AtPep1 assays work at 1 to 100&nbsp;nM; the BoPep4 series has to reach at least 1&nbsp;&micro;M or a null result means nothing.</td></tr>
              <tr><td class="num">E4</td><td>Activity is pH-sensitive, strong near pH&nbsp;6.0 and nearly abolished at pH&nbsp;4.0, because Arg487's protonation state governs the clamp.</td><td>Buffering the assay below pH&nbsp;5 suppresses every construct at once. This is a protocol trap, not a result.</td></tr>
              <tr><td class="num">E5</td><td>The 15&ndash;23 fragment is inactive.</td><td>If it is active, the assay is reading something other than receptor signalling and every other number in it is suspect.</td></tr>
            </tbody>
          </table>
        </div>

        <p>
          The assay also has to carry four controls or it cannot be interpreted: vehicle and
          empty-vector supernatant, because <i>B.&nbsp;subtilis</i> supernatant contains
          proteases and surfactin; a chemically synthesised reference peptide at a known
          concentration, which is the only thing that separates &ldquo;the peptide does not
          work&rdquo; from &ldquo;we secreted almost none of it&rdquo;; the dead fragment at
          the same molar load; and quantification before activity, because activity per unit
          peptide is the number that means something and activity per millilitre of
          supernatant is not.
        </p>
      </section>

      <section class="sec" id="limits">
        <h2>What this modelling cannot decide</h2>

        <ul>
          <li>
            <b>None of it is a measurement.</b> Two structural methods agreeing is agreement,
            and the decisive next step is experimental.
          </li>
          <li>
            <b>Neither method resolves single substitutions.</b> Section&nbsp;7 is the
            evidence, and it is our own. No design on this wiki is ranked by a docking score
            or by a co-folding confidence value.
          </li>
          <li>
            <b>PEPR2 has no experimental structure.</b> Every PEPR2 number rests on an
            AlphaFold model with no per-residue confidence filter applied before docking.
            More docking rigour cannot fix this; a structure or a binding assay can.
          </li>
          <li>
            <b>The receptors are the wrong species.</b> BoPep4 is a <i>Brassica</i> peptide
            and we model it against <i>Arabidopsis</i> PEPR1 and PEPR2, because that is
            where the structural and mutagenesis evidence is. The <i>Brassica</i>
            orthologues will differ.
          </li>
          <li>
            <b>The most informative published result is outside the pipeline.</b> Pearce
            showed that Gly17&rarr;D-Ala and Gly17&rarr;2-methyl-Ala restore activity while
            L-Pro and D-Pro abolish it, which proves the requirement is backbone
            conformational freedom&nbsp;[2]. D-amino acids and Aib are not representable in
            stock CNS topology, so three rows of our own panel are marked as not modellable.
          </li>
          <li>
            <b>The canonical wild-type pose was chosen, not predicted.</b> The docking's own
            top cluster was non-native at 5.80&nbsp;&Aring;; the pose carried forward is
            cluster three of four, selected because it matches the crystal.
          </li>
        </ul>

        <p>
          The remaining computational item is a narrow, pre-registered re-run: the sixteen
          equal-length analogues against PEPR1 only, from unbound conformer ensembles, with
          crystal-derived restraints, full sampling, three seeds, and cluster-mean scoring.
          The pass criterion is committed before the runs start &mdash; Spearman &rho;
          above +0.5 at p&nbsp;&lt;&nbsp;0.05, with at least two of G17A, G17P and S15A in
          the four worst-scoring analogues. Anything less means the protocol has no
          substitution-level resolution and every remaining score-difference claim comes
          out, whatever the numbers look like.
        </p>
      </section>

      <section class="sec" id="reproducibility">
        <h2>Every parameter, and where the runs live</h2>

        <div class="tablewrap">
          <table class="data">
            <thead><tr><th>Component</th><th>Version and configuration</th></tr></thead>
            <tbody>
              <tr><td>Docking</td><td>HADDOCK&nbsp;2.5, distribution <code>haddock2.5-2026-07</code>, run locally. 121 production runs across seven campaigns.</td></tr>
              <tr><td>Energy engine</td><td>CNS&nbsp;1.3, HADDOCK-patched, rebuilt from source for arm64 Darwin. OPLS non-bonded parameters, TIP3P explicit water in final refinement.</td></tr>
              <tr><td>Restraints</td><td>Ambiguous interaction restraints, <code>2.0&nbsp;2.0&nbsp;0.0</code> throughout, with cross-validation on (<code>noecv</code>, two partitions). Active and passive residue lists are on disk for every run and reproduced in the audit.</td></tr>
              <tr><td>Co-folding</td><td>AlphaFold3, 5 seeds per job, 44 jobs. Gates set before running: ipTM&nbsp;&ge;&nbsp;0.60, interface minimum PAE&nbsp;&le;&nbsp;5&nbsp;&Aring;, zero clashes.</td></tr>
              <tr><td>RNA folding</td><td>ViennaRNA&nbsp;2.7.2, partition function at 37&nbsp;&deg;C over a 236&nbsp;nt window.</td></tr>
              <tr><td>Structures</td><td>PEPR1 from PDB&nbsp;5GR8 chain&nbsp;A, cleaned to polymer heavy atoms. PEPR2 an AlphaFold monomer trimmed to residues 24&ndash;710. Peptides threaded on 5GR8 chain&nbsp;J or taken from co-folded complexes; provenance recorded per residue.</td></tr>
              <tr><td>Structure handling</td><td>PyMOL&nbsp;2.x for splitting, interface detection and rendering; Biopython for superposition and RMSD.</td></tr>
            </tbody>
          </table>
        </div>

        <p>
          Three numbering conventions coexist in the source data and cross-study comparisons
          are only valid inside one of them: mature 1&ndash;23 as used by the truncation and
          Pearce panels, renumber-from-one as used by the co-folding truncation jobs, and
          construct-local numbering in the tandem study. Everything on this page is in
          mature numbering.
        </p>

        <p>
          The methodology audit reproduces the complete parameter and restraint record for
          all 121 runs and all 44 co-folding jobs, lists twelve references split into five
          that support the protocol and seven that challenge it, and triages every
          downstream claim. The page you are reading is the summary; the audit is the
          document to check it against, and both are in the dry-lab record alongside the
          run trees, the restraint tables and the analysis scripts.
        </p>
      </section>

      <section class="refs" id="references">
        <h2 data-no-toc>References</h2>
        <ol>
          <li>Tang, J., Han, Z., Sun, Y., Zhang, H., Gong, X. &amp; Chai, J. Structural basis for recognition of an endogenous peptide by the plant receptor kinase PEPR1. <i>Cell Research</i> <b>25</b>, 110&ndash;120 (2015). PDB&nbsp;5GR8.</li>
          <li>Pearce, G., Yamaguchi, Y., Munske, G. &amp; Ryan, C. A. Structure&ndash;activity studies of AtPep1, a plant peptide signal involved in the innate immune response. <i>Peptides</i> <b>29</b>, 2083&ndash;2089 (2008).</li>
          <li>Yamaguchi, Y., Huffaker, A., Bryan, A. C., Tax, F. E. &amp; Ryan, C. A. PEPR2 is a second receptor for the Pep1 and Pep2 peptides and contributes to defense responses in Arabidopsis. <i>Plant Cell</i> <b>22</b>, 508&ndash;522 (2010).</li>
          <li>Dominguez, C., Boelens, R. &amp; Bonvin, A. M. J. J. HADDOCK: a protein&ndash;protein docking approach based on biochemical or biophysical information. <i>J. Am. Chem. Soc.</i> <b>125</b>, 1731&ndash;1737 (2003).</li>
          <li>Honorato, R. V. <i>et al.</i> The HADDOCK2.4 web server for integrative modeling of biomolecular complexes. <i>Nature Protocols</i> (2024).</li>
          <li>Trellet, M., Melquiond, A. S. J. &amp; Bonvin, A. M. J. J. A unified conformational selection and induced fit approach to protein&ndash;peptide docking. <i>PLoS ONE</i> <b>8</b>, e58769 (2013).</li>
          <li>Rodrigues, J. P. G. L. M. <i>et al.</i> Clustering biomolecular complexes by residue contacts similarity. <i>Proteins</i> <b>80</b>, 1810&ndash;1817 (2012).</li>
          <li>Kastritis, P. L. &amp; Bonvin, A. M. J. J. Are scoring functions in protein&ndash;protein docking ready to predict interactomes? <i>J. Proteome Research</i> <b>9</b>, 2216&ndash;2225 (2010).</li>
          <li>Vangone, A. &amp; Bonvin, A. M. J. J. Contacts-based prediction of binding affinity in protein&ndash;protein complexes. <i>eLife</i> <b>4</b>, e07454 (2015).</li>
          <li>Abramson, J. <i>et al.</i> Accurate structure prediction of biomolecular interactions with AlphaFold&nbsp;3. <i>Nature</i> <b>630</b>, 493&ndash;500 (2024).</li>
          <li>Buel, G. R. &amp; Walters, K. J. Can AlphaFold2 predict the impact of missense mutations on structure? <i>Nature Structural &amp; Molecular Biology</i> <b>29</b>, 1&ndash;2 (2022).</li>
          <li>Ciemny, M. <i>et al.</i> Protein&ndash;peptide docking: opportunities and challenges. <i>Drug Discovery Today</i> <b>23</b>, 1530&ndash;1537 (2018).</li>
          <li>Castillo-Hair, S. M. <i>et al.</i> Optimizing 5&prime; mRNA structure for translation initiation. <i>Nature Communications</i> <b>10</b>, 3099 (2019).</li>
          <li>Brockmeier, U. <i>et al.</i> Systematic screening of all signal peptides from <i>Bacillus subtilis</i>. <i>J. Molecular Biology</i> <b>362</b>, 393&ndash;402 (2006).</li>
          <li>Cui, J. <i>et al.</i> Plant elicitor peptides and abiotic stress tolerance. <i>Antioxidants</i> <b>13</b>, 549 (2024).</li>
          <li>Sun, Y. <i>et al.</i> Structural basis for flg22-induced activation of the Arabidopsis FLS2&ndash;BAK1 immune complex. <i>Science</i> <b>342</b>, 624&ndash;628 (2013). PDB&nbsp;4MN8.</li>
          <li>Bonvin Lab. HADDOCK best practice guide &mdash; peptide docking. <a href="https://www.bonvinlab.org/software/bpg/peptides/">bonvinlab.org/software/bpg/peptides</a>.</li>
        </ol>
      </section>
"""

BODY = (BODY
        .replace("__ALIGNMENT__", alignment())
        .replace("__RULER__", residue_strip())
        .replace("__RESTABLE__", residue_table())
        .replace("__LADDER__", ladder_block())
        .replace("__BENCH__", bench_block())
        .replace("__LEDGER__", ledger_block())
        .replace("__CASSETTES__", cassette_block()))


if __name__ == "__main__":
    html = build()
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)
    print("wrote %s  (%.1f kB)" % (OUT, len(html) / 1024))
