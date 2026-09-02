#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Turn the MD analysis output into the data file the overview page reads.

    python3 build/md_overview_data.py

Reads  md-simulations/data/report_data_overview.json
       -- written by build_overview_data.py in the MD repo, one code path over
          all nine trajectories, so every number in it comes from the same
          definition.
Writes md-simulations/data/runs.js

Numbers are copied, never retyped. The bilingual labels live here because they
are editorial, not computed: the JSON knows a run's occupancy, not what the run
is for. Everything the page displays as prose has an `en` and a `zh`.
"""

import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "md-simulations", "data", "report_data_overview.json")
OUT = os.path.join(ROOT, "md-simulations", "data", "runs.js")

# key -> everything the JSON cannot know: which limb of the map the run hangs
# off, what it is called, what it was for, and how it came out.
#   branch  control | ladder | tag | ph
#   state   neutral | good | warn | bad   -- drives the colour of the node
LABELS = {
    "REF": dict(
        branch="control", state="neutral", short_en="AtPep1", short_zh="AtPep1",
        name_en="AtPep1 7–23 benchmark", name_zh="AtPep1 7–23 基準",
        role_en="Benchmark", role_zh="基準",
        gist_en="The peptide actually resolved in the 5GR8 crystal structure, run "
                "under settings identical to the other eight. It is the only "
                "system with an experimental structure to check against, so it "
                "sets the scale the rest are read on.",
        gist_zh="5GR8 晶體結構中真正解出的胜肽，以與其餘八條軌跡完全相同的參數執行。"
                "全套之中只有它有實驗結構可以對照，因此它定下了其他頁面被閱讀時的尺度。"),
    "APO": dict(
        branch="control", state="neutral", short_en="No peptide", short_zh="無胜肽",
        name_en="Receptor alone (apo)", name_zh="受體單獨（apo）",
        role_en="Negative control", role_zh="陰性對照",
        gist_en="The peptide removed entirely. The receptor is no looser, the "
                "groove does not collapse, and the per-residue flexibility "
                "profile barely moves. That puts a measured floor under every "
                "receptor-side number on the other eight pages.",
        gist_zh="把胜肽整個移除。受體並沒有變鬆，凹槽沒有塌陷，逐殘基柔性分布幾乎不動。"
                "這替另外八頁所有受體端的數字量出了一條雜訊底線。"),
    "WT": dict(
        branch="ladder", state="neutral", short_en="1–23 (WT)", short_zh="1–23（野生型）",
        name_en="BoPep4 wild type 1–23", name_zh="BoPep4 野生型 1–23",
        role_en="Reference state", role_zh="參考狀態",
        gist_en="The complete mature sequence with a free C-terminus. The other "
                "seven BoPep4 trajectories are all read against this one.",
        gist_zh="完整的成熟序列，C 端為自由羧基。其餘七條 BoPep4 軌跡都是對照這一條來讀的。"),
    "T723": dict(
        branch="ladder", state="good", short_en="7–23", short_zh="7–23",
        name_en="BoPep4 7–23", name_zh="BoPep4 7–23",
        role_en="Hypothesis falsified", role_zh="假設被推翻",
        gist_en="Putting Lys7 and Lys8 back onto 9–23 restores the clamp. Not "
                "because a free-terminus artefact went away: Lys7 grips Asp129, "
                "a salt bridge that is not on Tang's list of eight. This is also "
                "the first construct that is like-for-like with the benchmark.",
        gist_zh="把 Lys7 與 Lys8 加回 9–23 之後，鉗合恢復。原因不是自由 N 端的假影消失，"
                "而是 Lys7 抓住了 Asp129，而這條鹽橋並不在 Tang 的八個熱點名單上。"
                "這也是第一個能與基準逐殘基對比的構築。"),
    "T923": dict(
        branch="ladder", state="warn", short_en="9–23", short_zh="9–23",
        name_en="BoPep4 9–23", name_zh="BoPep4 9–23",
        role_en="The construct that was ordered", role_zh="已下單的構築",
        gist_en="Deleting residues 1–8 loosens the anchor at the far end of the "
                "peptide. The clamp flickers open 94 times in 30 ns, none of the "
                "gaps longer than 0.68 ns.",
        gist_zh="刪掉殘基 1–8 之後，鬆掉的是胜肽另一端的錨。鉗合在 30 奈秒內斷開 94 次，"
                "沒有一次超過 0.68 奈秒。"),
    "T1523": dict(
        branch="ladder", state="warn", short_en="15–23", short_zh="15–23",
        name_en="BoPep4 15–23", name_zh="BoPep4 15–23",
        role_en="Control that did not fail", role_zh="沒有失敗的對照",
        gist_en="Planned as a negative control that would fall off and supply a "
                "leaving time. It did not fall off, and it could not have: "
                "unbinding runs on microseconds to milliseconds, three to six "
                "orders of magnitude past 30 ns.",
        gist_zh="原本設計成會脫落、可以量出離開時間的陰性對照。它沒有脫落，而且本來就不可能："
                "解離發生在微秒到毫秒尺度，比 30 奈秒長三到六個數量級。"),
    "CHIS": dict(
        branch="tag", state="bad", short_en="+C-6xHis", short_zh="C 端 6xHis",
        name_en="BoPep4 + C-terminal 6xHis", name_zh="BoPep4 加 C 端 6xHis",
        role_en="False pass", role_zh="假性通過",
        gist_en="Six histidines fused after Asn23. All four acceptance criteria "
                "pass and the C-terminus scores as steadier than wild type. But "
                "Asn23 is no longer a C-terminus: its carboxylate was spent "
                "forming the amide bond, so the criterion is measuring a neutral "
                "carbonyl rather than a salt bridge.",
        gist_zh="在 Asn23 之後接上六個組胺酸。四項驗收標準全數通過，C 端甚至比野生型更穩。"
                "但 Asn23 已經不是 C 端：它的羧基被用去形成醯胺鍵，"
                "所以這項標準量到的是一個中性羰基，不是鹽橋。"),
    "LOWPH": dict(
        branch="ph", state="good", short_en="1–23 pH 5.5", short_zh="1–23 pH 5.5",
        name_en="BoPep4 1–23 at pH 5.5", name_zh="BoPep4 1–23，pH 5.5",
        role_en="Positive result", role_zh="正面結果",
        gist_en="Three histidines near the interface switched to their protonated "
                "form, with no other atom touched. A Glu12–His227 pair appears at "
                "once, and the AtPep1 benchmark already makes that same pair at "
                "neutral pH.",
        gist_zh="把介面附近的三個組胺酸換成質子化形式，其餘原子一個都沒動。"
                "Glu12–His227 這一對立刻出現，而 AtPep1 基準在中性 pH 下本來就有這一對。"),
    "T923L": dict(
        branch="ph", state="bad", short_en="9–23 pH 5.5", short_zh="9–23 pH 5.5",
        name_en="BoPep4 9–23 at pH 5.5", name_zh="BoPep4 9–23，pH 5.5",
        role_en="Failed the gate", role_zh="未通過驗收",
        gist_en="Truncation crossed with protonation. Every metric except the "
                "anchor improved and the anchor collapsed: the now-positive His22 "
                "folds back onto the peptide's own C-terminal carboxylate and "
                "displaces Arg487.",
        gist_zh="截短與質子化交叉。除了錨以外每一項指標都變好，而錨垮了："
                "帶正電的 His22 折回胜肽自己的 C 端羧基，把 Arg487 擠開。"),
}

BRANCHES = [
    dict(id="control", en="Controls", zh="對照",
         blurb_en="The two runs that can falsify the rest: one with an "
                  "experimental structure to check against, one with no ligand "
                  "at all.",
         blurb_zh="能夠推翻其餘結果的兩條軌跡：一條有實驗結構可以對照，一條完全沒有配體。"),
    dict(id="ladder", en="Truncation ladder", zh="截短梯",
         blurb_en="The same pose with the N-terminus deleted in stages, headed by "
                  "the full-length reference. The ladder is not monotonic.",
         blurb_zh="同一個結合姿態，N 端分階段刪去，最上面是全長的參考狀態。這道梯子不是單調的。"),
    dict(id="tag", en="The tag", zh="標籤",
         blurb_en="Six histidines fused after Asn23, which changes what the "
                  "acceptance criterion is measuring.",
         blurb_zh="在 Asn23 之後接上六個組胺酸，這改變了驗收標準實際量到的東西。"),
    dict(id="ph", en="Protonation", zh="質子化",
         blurb_en="Three histidines switched to their protonated form for the "
                  "apoplast, with no other atom touched.",
         blurb_zh="為了模擬質外體，把三個組胺酸換成質子化形式，其餘原子一個都沒動。"),
]

# Where each node sits in the map. viewBox is 0 0 1000 660; the centre is the
# peptide. Hand-placed rather than computed: four limbs of very different sizes
# laid out by an algorithm end up either crowded or wasteful.
POS = {
    "_centre": (500, 330),
    "control": (286, 138), "ladder": (716, 214),
    "tag": (712, 486), "ph": (282, 512),
    "REF": (104, 74), "APO": (104, 200),
    "WT": (896, 88), "T723": (896, 172), "T923": (896, 256), "T1523": (896, 340),
    "CHIS": (896, 486),
    "LOWPH": (104, 466), "T923L": (104, 570),
}

GATE = {True: ("pass", "通過"), False: ("fail", "未通過")}


def num(v, nd=1):
    return None if v is None else round(v, nd)


def per_res(r):
    """Residue number -> one-letter code and contact occupancy, trimmed.

    This is what lets the map draw a run rather than label it: the peptide as
    the residues that are actually there, each one carrying how much of the
    trajectory it spent within 4 A of the receptor. RMSF is dropped; the glyph
    has no room for a second channel and the reports plot it properly.
    """
    out = {}
    for k, v in (r.get("per_res") or {}).items():
        out[str(k)] = {"c": v["code"], "o": round(v["occ4"], 1)}
    return out


def main():
    d = json.load(io.open(SRC, encoding="utf-8"))
    runs = []
    for key in d["order"]:
        r = d["runs"][key]
        lab = LABELS[key]
        gate_en, gate_zh = GATE[bool(r["passed"])]
        if key == "CHIS":                       # passes on paper, on the wrong atoms
            gate_en, gate_zh = "false pass", "假性通過"
        runs.append(dict(
            key=key, href=r["href"], branch=lab["branch"], state=lab["state"],
            x=POS[key][0], y=POS[key][1],
            seq=r["seq"], n=r["n"], first=r["first"], last=r["last"],
            batch=r["batch"], apo=bool(r["apo"]), oxt=r["oxt"], nHip=r["n_hip"],
            ligand=("AtPep1" if key == "REF" else None if r["apo"] else "BoPep4"),
            clamp4=num(r["clamp4"]), bident=num(r["bident"]),
            ncon15=num(r["ncon15"]), rmsd15=num(r["rmsd15"], 2),
            rmsd15sem=num(r.get("rmsd15_sem"), 2), rmsdRec=num(r["rmsd_rec"], 2),
            glu12=num(r.get("glu12")), glu12d=num(r.get("glu12_d"), 2),
            groove=num(r.get("groove"), 2), rmsfMed=num(r.get("rmsf_med"), 2),
            atoms=r["atoms"], nsPerDay=num(r["ns_per_day"]), wall=num(r["wall"], 2),
            perRes=per_res(r),
            gate=dict(en=gate_en, zh=gate_zh),
            en=dict(short=lab["short_en"], name=lab["name_en"],
                    role=lab["role_en"], gist=lab["gist_en"]),
            zh=dict(short=lab["short_zh"], name=lab["name_zh"],
                    role=lab["role_zh"], gist=lab["gist_zh"]),
        ))

    out = dict(
        totals=dict(runs=d["totals"]["n_runs"], peptide=d["totals"]["n_peptide"],
                    gpuHours=round(d["totals"]["gpu_hours"], 1),
                    ns=d["totals"]["ns"], frames=d["totals"]["frames"]),
        centre=dict(x=POS["_centre"][0], y=POS["_centre"][1]),
        branches=[dict(id=b["id"], x=POS[b["id"]][0], y=POS[b["id"]][1],
                       en=dict(name=b["en"], blurb=b["blurb_en"]),
                       zh=dict(name=b["zh"], blurb=b["blurb_zh"]))
                  for b in BRANCHES],
        runs=runs,
        corr=d["corr"],
        core=d["core"],
        apo=dict({k: v for k, v in d["apo"].items()
                  if k in ("rmsd_rec", "groove", "groove_sd", "rmsf_med", "corr",
                           "corr_lo", "corr_hi", "d_iface", "d_rest", "n_iface")},
                 arg487_partner=d["apo"]["arg487_partner"]),
    )

    body = json.dumps(out, ensure_ascii=False, indent=1, sort_keys=False)
    io.open(OUT, "w", encoding="utf-8").write(
        "/* =============================================================================\n"
        "   ReLeaf: the nine MD trajectories, as data\n"
        "   ---------------------------------------------------------------------------\n"
        "   Written by build/md_overview_data.py. Do not hand-edit: every number here\n"
        "   is copied out of data/report_data_overview.json, which the MD analysis\n"
        "   pipeline produces in one pass over all nine runs, so the columns actually\n"
        "   mean the same thing. Editorial text -- what a run is for, how it came out --\n"
        "   lives in the generator, in English and 繁體中文.\n"
        "   ======================================================================== */\n\n"
        "const MD_SET = " + body + ";\n")
    print("wrote %s (%d runs)" % (OUT, len(runs)))


if __name__ == "__main__":
    main()
