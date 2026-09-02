/* =============================================================================
   ReLeaf: the nine MD trajectories, as data
   ---------------------------------------------------------------------------
   Written by build/md_overview_data.py. Do not hand-edit: every number here
   is copied out of data/report_data_overview.json, which the MD analysis
   pipeline produces in one pass over all nine runs, so the columns actually
   mean the same thing. Editorial text -- what a run is for, how it came out --
   lives in the generator, in English and 繁體中文.
   ======================================================================== */

const MD_SET = {
 "totals": {
  "runs": 9,
  "peptide": 8,
  "gpuHours": 25.9,
  "ns": 270,
  "frames": 13500
 },
 "centre": {
  "x": 500,
  "y": 330
 },
 "branches": [
  {
   "id": "control",
   "x": 286,
   "y": 138,
   "en": {
    "name": "Controls",
    "blurb": "The two runs that can falsify the rest: one with an experimental structure to check against, one with no ligand at all."
   },
   "zh": {
    "name": "對照",
    "blurb": "能夠推翻其餘結果的兩條軌跡：一條有實驗結構可以對照，一條完全沒有配體。"
   }
  },
  {
   "id": "ladder",
   "x": 716,
   "y": 214,
   "en": {
    "name": "Truncation ladder",
    "blurb": "The same pose with the N-terminus deleted in stages, headed by the full-length reference. The ladder is not monotonic."
   },
   "zh": {
    "name": "截短梯",
    "blurb": "同一個結合姿態，N 端分階段刪去，最上面是全長的參考狀態。這道梯子不是單調的。"
   }
  },
  {
   "id": "tag",
   "x": 712,
   "y": 486,
   "en": {
    "name": "The tag",
    "blurb": "Six histidines fused after Asn23, which changes what the acceptance criterion is measuring."
   },
   "zh": {
    "name": "標籤",
    "blurb": "在 Asn23 之後接上六個組胺酸，這改變了驗收標準實際量到的東西。"
   }
  },
  {
   "id": "ph",
   "x": 282,
   "y": 512,
   "en": {
    "name": "Protonation",
    "blurb": "Three histidines switched to their protonated form for the apoplast, with no other atom touched."
   },
   "zh": {
    "name": "質子化",
    "blurb": "為了模擬質外體，把三個組胺酸換成質子化形式，其餘原子一個都沒動。"
   }
  }
 ],
 "runs": [
  {
   "key": "REF",
   "href": "atpep1-benchmark-vs-bopep4.html",
   "branch": "control",
   "state": "neutral",
   "x": 104,
   "y": 74,
   "seq": "KQRGKEKVSSGRPGQHN",
   "n": 17,
   "first": 7,
   "last": 23,
   "batch": "2026-08-20",
   "apo": false,
   "oxt": true,
   "nHip": 0,
   "ligand": "AtPep1",
   "clamp4": 99.9,
   "bident": 99.9,
   "ncon15": 107.4,
   "rmsd15": 1.17,
   "rmsd15sem": 0.06,
   "rmsdRec": 1.7,
   "glu12": 76.9,
   "glu12d": 3.36,
   "groove": null,
   "rmsfMed": null,
   "atoms": 127514,
   "nsPerDay": 246.3,
   "wall": 2.92,
   "perRes": {
    "7": {
     "c": "K",
     "o": 23.5
    },
    "8": {
     "c": "Q",
     "o": 99.4
    },
    "9": {
     "c": "R",
     "o": 100.0
    },
    "10": {
     "c": "G",
     "o": 0.2
    },
    "11": {
     "c": "K",
     "o": 52.6
    },
    "12": {
     "c": "E",
     "o": 100.0
    },
    "13": {
     "c": "K",
     "o": 70.7
    },
    "14": {
     "c": "V",
     "o": 100.0
    },
    "15": {
     "c": "S",
     "o": 100.0
    },
    "16": {
     "c": "S",
     "o": 100.0
    },
    "17": {
     "c": "G",
     "o": 99.6
    },
    "18": {
     "c": "R",
     "o": 100.0
    },
    "19": {
     "c": "P",
     "o": 32.9
    },
    "20": {
     "c": "G",
     "o": 99.7
    },
    "21": {
     "c": "Q",
     "o": 99.9
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    }
   },
   "gate": {
    "en": "pass",
    "zh": "通過"
   },
   "en": {
    "short": "AtPep1",
    "name": "AtPep1 7–23 benchmark",
    "role": "Benchmark",
    "gist": "The peptide actually resolved in the 5GR8 crystal structure, run under settings identical to the other eight. It is the only system with an experimental structure to check against, so it sets the scale the rest are read on."
   },
   "zh": {
    "short": "AtPep1",
    "name": "AtPep1 7–23 基準",
    "role": "基準",
    "gist": "5GR8 晶體結構中真正解出的胜肽，以與其餘八條軌跡完全相同的參數執行。全套之中只有它有實驗結構可以對照，因此它定下了其他頁面被閱讀時的尺度。"
   }
  },
  {
   "key": "APO",
   "href": "apo-PEPR1.html",
   "branch": "control",
   "state": "neutral",
   "x": 104,
   "y": 200,
   "seq": "",
   "n": 0,
   "first": null,
   "last": null,
   "batch": "2026-08-30",
   "apo": true,
   "oxt": null,
   "nHip": 0,
   "ligand": null,
   "clamp4": null,
   "bident": null,
   "ncon15": null,
   "rmsd15": null,
   "rmsd15sem": null,
   "rmsdRec": 1.57,
   "glu12": null,
   "glu12d": null,
   "groove": 35.91,
   "rmsfMed": 1.1,
   "atoms": 127798,
   "nsPerDay": 251.0,
   "wall": 2.87,
   "perRes": {},
   "gate": {
    "en": "pass",
    "zh": "通過"
   },
   "en": {
    "short": "No peptide",
    "name": "Receptor alone (apo)",
    "role": "Negative control",
    "gist": "The peptide removed entirely. The receptor is no looser, the groove does not collapse, and the per-residue flexibility profile barely moves. That puts a measured floor under every receptor-side number on the other eight pages."
   },
   "zh": {
    "short": "無胜肽",
    "name": "受體單獨（apo）",
    "role": "陰性對照",
    "gist": "把胜肽整個移除。受體並沒有變鬆，凹槽沒有塌陷，逐殘基柔性分布幾乎不動。這替另外八頁所有受體端的數字量出了一條雜訊底線。"
   }
  },
  {
   "key": "WT",
   "href": "bopep4-wt-round1.html",
   "branch": "ladder",
   "state": "neutral",
   "x": 896,
   "y": 88,
   "seq": "GILIGSKKRPREPHSSGKPGGHN",
   "n": 23,
   "first": 1,
   "last": 23,
   "batch": "2026-08-18",
   "apo": false,
   "oxt": true,
   "nHip": 0,
   "ligand": "BoPep4",
   "clamp4": 100.0,
   "bident": 100.0,
   "ncon15": 96.5,
   "rmsd15": 1.67,
   "rmsd15sem": 0.07,
   "rmsdRec": 1.58,
   "glu12": 0.8,
   "glu12d": 5.33,
   "groove": null,
   "rmsfMed": null,
   "atoms": 127589,
   "nsPerDay": 248.7,
   "wall": 2.9,
   "perRes": {
    "1": {
     "c": "G",
     "o": 52.1
    },
    "2": {
     "c": "I",
     "o": 99.2
    },
    "3": {
     "c": "L",
     "o": 41.8
    },
    "4": {
     "c": "I",
     "o": 92.0
    },
    "5": {
     "c": "G",
     "o": 16.4
    },
    "6": {
     "c": "S",
     "o": 18.7
    },
    "7": {
     "c": "K",
     "o": 99.8
    },
    "8": {
     "c": "K",
     "o": 50.8
    },
    "9": {
     "c": "R",
     "o": 100.0
    },
    "10": {
     "c": "P",
     "o": 9.2
    },
    "11": {
     "c": "R",
     "o": 97.9
    },
    "12": {
     "c": "E",
     "o": 99.9
    },
    "13": {
     "c": "P",
     "o": 81.7
    },
    "14": {
     "c": "H",
     "o": 100.0
    },
    "15": {
     "c": "S",
     "o": 100.0
    },
    "16": {
     "c": "S",
     "o": 100.0
    },
    "17": {
     "c": "G",
     "o": 99.1
    },
    "18": {
     "c": "K",
     "o": 100.0
    },
    "19": {
     "c": "P",
     "o": 52.3
    },
    "20": {
     "c": "G",
     "o": 99.9
    },
    "21": {
     "c": "G",
     "o": 99.9
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    }
   },
   "gate": {
    "en": "pass",
    "zh": "通過"
   },
   "en": {
    "short": "1–23 (WT)",
    "name": "BoPep4 wild type 1–23",
    "role": "Reference state",
    "gist": "The complete mature sequence with a free C-terminus. The other seven BoPep4 trajectories are all read against this one."
   },
   "zh": {
    "short": "1–23（野生型）",
    "name": "BoPep4 野生型 1–23",
    "role": "參考狀態",
    "gist": "完整的成熟序列，C 端為自由羧基。其餘七條 BoPep4 軌跡都是對照這一條來讀的。"
   }
  },
  {
   "key": "T723",
   "href": "bopep4-7-23.html",
   "branch": "ladder",
   "state": "good",
   "x": 896,
   "y": 172,
   "seq": "KKRPREPHSSGKPGGHN",
   "n": 17,
   "first": 7,
   "last": 23,
   "batch": "2026-08-30",
   "apo": false,
   "oxt": true,
   "nHip": 0,
   "ligand": "BoPep4",
   "clamp4": 98.5,
   "bident": 87.7,
   "ncon15": 94.6,
   "rmsd15": 1.38,
   "rmsd15sem": 0.06,
   "rmsdRec": 1.63,
   "glu12": 43.1,
   "glu12d": 4.05,
   "groove": null,
   "rmsfMed": null,
   "atoms": 127643,
   "nsPerDay": 251.4,
   "wall": 2.86,
   "perRes": {
    "7": {
     "c": "K",
     "o": 99.9
    },
    "8": {
     "c": "K",
     "o": 4.8
    },
    "9": {
     "c": "R",
     "o": 100.0
    },
    "10": {
     "c": "P",
     "o": 2.9
    },
    "11": {
     "c": "R",
     "o": 60.5
    },
    "12": {
     "c": "E",
     "o": 100.0
    },
    "13": {
     "c": "P",
     "o": 67.7
    },
    "14": {
     "c": "H",
     "o": 100.0
    },
    "15": {
     "c": "S",
     "o": 100.0
    },
    "16": {
     "c": "S",
     "o": 98.2
    },
    "17": {
     "c": "G",
     "o": 97.9
    },
    "18": {
     "c": "K",
     "o": 96.4
    },
    "19": {
     "c": "P",
     "o": 55.2
    },
    "20": {
     "c": "G",
     "o": 99.3
    },
    "21": {
     "c": "G",
     "o": 100.0
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    }
   },
   "gate": {
    "en": "pass",
    "zh": "通過"
   },
   "en": {
    "short": "7–23",
    "name": "BoPep4 7–23",
    "role": "Hypothesis falsified",
    "gist": "Putting Lys7 and Lys8 back onto 9–23 restores the clamp. Not because a free-terminus artefact went away: Lys7 grips Asp129, a salt bridge that is not on Tang's list of eight. This is also the first construct that is like-for-like with the benchmark."
   },
   "zh": {
    "short": "7–23",
    "name": "BoPep4 7–23",
    "role": "假設被推翻",
    "gist": "把 Lys7 與 Lys8 加回 9–23 之後，鉗合恢復。原因不是自由 N 端的假影消失，而是 Lys7 抓住了 Asp129，而這條鹽橋並不在 Tang 的八個熱點名單上。這也是第一個能與基準逐殘基對比的構築。"
   }
  },
  {
   "key": "T923",
   "href": "bopep4-9-23-vs-wt.html",
   "branch": "ladder",
   "state": "warn",
   "x": 896,
   "y": 256,
   "seq": "RPREPHSSGKPGGHN",
   "n": 15,
   "first": 9,
   "last": 23,
   "batch": "2026-08-20",
   "apo": false,
   "oxt": true,
   "nHip": 0,
   "ligand": "BoPep4",
   "clamp4": 77.1,
   "bident": 46.9,
   "ncon15": 68.5,
   "rmsd15": 2.28,
   "rmsd15sem": 0.16,
   "rmsdRec": 1.72,
   "glu12": 3.0,
   "glu12d": 5.91,
   "groove": null,
   "rmsfMed": null,
   "atoms": 127701,
   "nsPerDay": 250.8,
   "wall": 2.87,
   "perRes": {
    "9": {
     "c": "R",
     "o": 100.0
    },
    "10": {
     "c": "P",
     "o": 4.7
    },
    "11": {
     "c": "R",
     "o": 99.6
    },
    "12": {
     "c": "E",
     "o": 100.0
    },
    "13": {
     "c": "P",
     "o": 63.9
    },
    "14": {
     "c": "H",
     "o": 99.9
    },
    "15": {
     "c": "S",
     "o": 100.0
    },
    "16": {
     "c": "S",
     "o": 29.4
    },
    "17": {
     "c": "G",
     "o": 70.0
    },
    "18": {
     "c": "K",
     "o": 60.9
    },
    "19": {
     "c": "P",
     "o": 37.7
    },
    "20": {
     "c": "G",
     "o": 55.4
    },
    "21": {
     "c": "G",
     "o": 97.6
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    }
   },
   "gate": {
    "en": "pass",
    "zh": "通過"
   },
   "en": {
    "short": "9–23",
    "name": "BoPep4 9–23",
    "role": "The construct that was ordered",
    "gist": "Deleting residues 1–8 loosens the anchor at the far end of the peptide. The clamp flickers open 94 times in 30 ns, none of the gaps longer than 0.68 ns."
   },
   "zh": {
    "short": "9–23",
    "name": "BoPep4 9–23",
    "role": "已下單的構築",
    "gist": "刪掉殘基 1–8 之後，鬆掉的是胜肽另一端的錨。鉗合在 30 奈秒內斷開 94 次，沒有一次超過 0.68 奈秒。"
   }
  },
  {
   "key": "T1523",
   "href": "bopep4-15-23-vs-wt.html",
   "branch": "ladder",
   "state": "warn",
   "x": 896,
   "y": 340,
   "seq": "SSGKPGGHN",
   "n": 9,
   "first": 15,
   "last": 23,
   "batch": "2026-08-20",
   "apo": false,
   "oxt": true,
   "nHip": 0,
   "ligand": "BoPep4",
   "clamp4": 99.9,
   "bident": 97.2,
   "ncon15": 89.6,
   "rmsd15": 1.81,
   "rmsd15sem": 0.14,
   "rmsdRec": 2.16,
   "glu12": null,
   "glu12d": null,
   "groove": null,
   "rmsfMed": null,
   "atoms": 127818,
   "nsPerDay": 251.6,
   "wall": 2.86,
   "perRes": {
    "15": {
     "c": "S",
     "o": 97.8
    },
    "16": {
     "c": "S",
     "o": 99.9
    },
    "17": {
     "c": "G",
     "o": 90.5
    },
    "18": {
     "c": "K",
     "o": 100.0
    },
    "19": {
     "c": "P",
     "o": 36.7
    },
    "20": {
     "c": "G",
     "o": 99.4
    },
    "21": {
     "c": "G",
     "o": 100.0
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    }
   },
   "gate": {
    "en": "pass",
    "zh": "通過"
   },
   "en": {
    "short": "15–23",
    "name": "BoPep4 15–23",
    "role": "Control that did not fail",
    "gist": "Planned as a negative control that would fall off and supply a leaving time. It did not fall off, and it could not have: unbinding runs on microseconds to milliseconds, three to six orders of magnitude past 30 ns."
   },
   "zh": {
    "short": "15–23",
    "name": "BoPep4 15–23",
    "role": "沒有失敗的對照",
    "gist": "原本設計成會脫落、可以量出離開時間的陰性對照。它沒有脫落，而且本來就不可能：解離發生在微秒到毫秒尺度，比 30 奈秒長三到六個數量級。"
   }
  },
  {
   "key": "CHIS",
   "href": "bopep4-chis-vs-wt.html",
   "branch": "tag",
   "state": "bad",
   "x": 896,
   "y": 486,
   "seq": "GILIGSKKRPREPHSSGKPGGHNHHHHHH",
   "n": 29,
   "first": 1,
   "last": 29,
   "batch": "2026-08-20",
   "apo": false,
   "oxt": false,
   "nHip": 0,
   "ligand": "BoPep4",
   "clamp4": 99.7,
   "bident": 2.4,
   "ncon15": 97.2,
   "rmsd15": 1.12,
   "rmsd15sem": 0.1,
   "rmsdRec": 1.59,
   "glu12": 0.5,
   "glu12d": 5.92,
   "groove": null,
   "rmsfMed": null,
   "atoms": 126997,
   "nsPerDay": 250.0,
   "wall": 2.88,
   "perRes": {
    "1": {
     "c": "G",
     "o": 57.5
    },
    "2": {
     "c": "I",
     "o": 97.9
    },
    "3": {
     "c": "L",
     "o": 43.0
    },
    "4": {
     "c": "I",
     "o": 32.3
    },
    "5": {
     "c": "G",
     "o": 4.2
    },
    "6": {
     "c": "S",
     "o": 1.7
    },
    "7": {
     "c": "K",
     "o": 99.6
    },
    "8": {
     "c": "K",
     "o": 11.5
    },
    "9": {
     "c": "R",
     "o": 100.0
    },
    "10": {
     "c": "P",
     "o": 3.3
    },
    "11": {
     "c": "R",
     "o": 99.9
    },
    "12": {
     "c": "E",
     "o": 100.0
    },
    "13": {
     "c": "P",
     "o": 67.5
    },
    "14": {
     "c": "H",
     "o": 100.0
    },
    "15": {
     "c": "S",
     "o": 100.0
    },
    "16": {
     "c": "S",
     "o": 99.7
    },
    "17": {
     "c": "G",
     "o": 98.0
    },
    "18": {
     "c": "K",
     "o": 100.0
    },
    "19": {
     "c": "P",
     "o": 40.2
    },
    "20": {
     "c": "G",
     "o": 99.6
    },
    "21": {
     "c": "G",
     "o": 99.9
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    },
    "24": {
     "c": "H",
     "o": 100.0
    },
    "25": {
     "c": "H",
     "o": 83.7
    },
    "26": {
     "c": "H",
     "o": 99.1
    },
    "27": {
     "c": "H",
     "o": 61.3
    },
    "28": {
     "c": "H",
     "o": 85.2
    },
    "29": {
     "c": "H",
     "o": 49.1
    }
   },
   "gate": {
    "en": "false pass",
    "zh": "假性通過"
   },
   "en": {
    "short": "+C-6xHis",
    "name": "BoPep4 + C-terminal 6xHis",
    "role": "False pass",
    "gist": "Six histidines fused after Asn23. All four acceptance criteria pass and the C-terminus scores as steadier than wild type. But Asn23 is no longer a C-terminus: its carboxylate was spent forming the amide bond, so the criterion is measuring a neutral carbonyl rather than a salt bridge."
   },
   "zh": {
    "short": "C 端 6xHis",
    "name": "BoPep4 加 C 端 6xHis",
    "role": "假性通過",
    "gist": "在 Asn23 之後接上六個組胺酸。四項驗收標準全數通過，C 端甚至比野生型更穩。但 Asn23 已經不是 C 端：它的羧基被用去形成醯胺鍵，所以這項標準量到的是一個中性羰基，不是鹽橋。"
   }
  },
  {
   "key": "LOWPH",
   "href": "bopep4-lowph-vs-wt.html",
   "branch": "ph",
   "state": "good",
   "x": 104,
   "y": 466,
   "seq": "GILIGSKKRPREPHSSGKPGGHN",
   "n": 23,
   "first": 1,
   "last": 23,
   "batch": "2026-08-20",
   "apo": false,
   "oxt": true,
   "nHip": 3,
   "ligand": "BoPep4",
   "clamp4": 100.0,
   "bident": 99.9,
   "ncon15": 95.7,
   "rmsd15": 1.34,
   "rmsd15sem": 0.07,
   "rmsdRec": 1.87,
   "glu12": 99.9,
   "glu12d": 2.75,
   "groove": null,
   "rmsfMed": null,
   "atoms": 127601,
   "nsPerDay": 251.6,
   "wall": 2.86,
   "perRes": {
    "1": {
     "c": "G",
     "o": 14.1
    },
    "2": {
     "c": "I",
     "o": 81.1
    },
    "3": {
     "c": "L",
     "o": 95.7
    },
    "4": {
     "c": "I",
     "o": 100.0
    },
    "5": {
     "c": "G",
     "o": 99.1
    },
    "6": {
     "c": "S",
     "o": 95.1
    },
    "7": {
     "c": "K",
     "o": 100.0
    },
    "8": {
     "c": "K",
     "o": 10.0
    },
    "9": {
     "c": "R",
     "o": 100.0
    },
    "10": {
     "c": "P",
     "o": 1.0
    },
    "11": {
     "c": "R",
     "o": 88.9
    },
    "12": {
     "c": "E",
     "o": 100.0
    },
    "13": {
     "c": "P",
     "o": 70.7
    },
    "14": {
     "c": "H",
     "o": 99.9
    },
    "15": {
     "c": "S",
     "o": 100.0
    },
    "16": {
     "c": "S",
     "o": 100.0
    },
    "17": {
     "c": "G",
     "o": 98.3
    },
    "18": {
     "c": "K",
     "o": 100.0
    },
    "19": {
     "c": "P",
     "o": 33.7
    },
    "20": {
     "c": "G",
     "o": 98.5
    },
    "21": {
     "c": "G",
     "o": 100.0
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    }
   },
   "gate": {
    "en": "pass",
    "zh": "通過"
   },
   "en": {
    "short": "1–23 pH 5.5",
    "name": "BoPep4 1–23 at pH 5.5",
    "role": "Positive result",
    "gist": "Three histidines near the interface switched to their protonated form, with no other atom touched. A Glu12–His227 pair appears at once, and the AtPep1 benchmark already makes that same pair at neutral pH."
   },
   "zh": {
    "short": "1–23 pH 5.5",
    "name": "BoPep4 1–23，pH 5.5",
    "role": "正面結果",
    "gist": "把介面附近的三個組胺酸換成質子化形式，其餘原子一個都沒動。Glu12–His227 這一對立刻出現，而 AtPep1 基準在中性 pH 下本來就有這一對。"
   }
  },
  {
   "key": "T923L",
   "href": "bopep4-9-23-lowph.html",
   "branch": "ph",
   "state": "bad",
   "x": 104,
   "y": 570,
   "seq": "RPREPHSSGKPGGHN",
   "n": 15,
   "first": 9,
   "last": 23,
   "batch": "2026-08-30",
   "apo": false,
   "oxt": true,
   "nHip": 3,
   "ligand": "BoPep4",
   "clamp4": 19.3,
   "bident": 6.9,
   "ncon15": 92.2,
   "rmsd15": 1.33,
   "rmsd15sem": 0.05,
   "rmsdRec": 2.14,
   "glu12": 26.4,
   "glu12d": 5.57,
   "groove": null,
   "rmsfMed": null,
   "atoms": 127713,
   "nsPerDay": 250.8,
   "wall": 2.87,
   "perRes": {
    "9": {
     "c": "R",
     "o": 99.9
    },
    "10": {
     "c": "P",
     "o": 0.3
    },
    "11": {
     "c": "R",
     "o": 91.7
    },
    "12": {
     "c": "E",
     "o": 96.5
    },
    "13": {
     "c": "P",
     "o": 72.6
    },
    "14": {
     "c": "H",
     "o": 100.0
    },
    "15": {
     "c": "S",
     "o": 99.9
    },
    "16": {
     "c": "S",
     "o": 100.0
    },
    "17": {
     "c": "G",
     "o": 99.3
    },
    "18": {
     "c": "K",
     "o": 100.0
    },
    "19": {
     "c": "P",
     "o": 34.1
    },
    "20": {
     "c": "G",
     "o": 99.7
    },
    "21": {
     "c": "G",
     "o": 99.7
    },
    "22": {
     "c": "H",
     "o": 100.0
    },
    "23": {
     "c": "N",
     "o": 100.0
    }
   },
   "gate": {
    "en": "fail",
    "zh": "未通過"
   },
   "en": {
    "short": "9–23 pH 5.5",
    "name": "BoPep4 9–23 at pH 5.5",
    "role": "Failed the gate",
    "gist": "Truncation crossed with protonation. Every metric except the anchor improved and the anchor collapsed: the now-positive His22 folds back onto the peptide's own C-terminal carboxylate and displaces Arg487."
   },
   "zh": {
    "short": "9–23 pH 5.5",
    "name": "BoPep4 9–23，pH 5.5",
    "role": "未通過驗收",
    "gist": "截短與質子化交叉。除了錨以外每一項指標都變好，而錨垮了：帶正電的 His22 折回胜肽自己的 C 端羧基，把 Arg487 擠開。"
   }
  }
 ],
 "corr": {
  "all": {
   "n": 8,
   "rmsd_bident": {
    "r": 0.13481533547622682,
    "rho": 0.28571428571428575
   },
   "rmsd_clamp": {
    "r": -0.033110878295596835,
    "rho": -0.07142857142857144
   },
   "ncon_bident": {
    "r": 0.2648148013096108,
    "rho": 0.261904761904762
   },
   "ncon_clamp": {
    "r": 0.2683702330878081,
    "rho": 0.5476190476190477
   }
  },
  "untagged": {
   "n": 7,
   "rmsd_bident": {
    "r": -0.1656249297070716,
    "rho": -0.07142857142857144
   },
   "rmsd_clamp": {
    "r": 0.04710945243153303,
    "rho": -0.14285714285714288
   },
   "ncon_bident": {
    "r": 0.47163506707857705,
    "rho": 0.7142857142857144
   },
   "ncon_clamp": {
    "r": 0.2457011732241873,
    "rho": 0.6785714285714287
   }
  }
 },
 "core": {
  "cut50": [
   {
    "num": 273,
    "aa": "ASP",
    "tang": true,
    "lo": 81.1,
    "hi": 100.0
   },
   {
    "num": 275,
    "aa": "SER",
    "tang": false,
    "lo": 81.2,
    "hi": 99.8
   },
   {
    "num": 297,
    "aa": "VAL",
    "tang": true,
    "lo": 82.1,
    "hi": 99.8
   },
   {
    "num": 345,
    "aa": "LYS",
    "tang": false,
    "lo": 75.5,
    "hi": 100.0
   },
   {
    "num": 395,
    "aa": "TYR",
    "tang": false,
    "lo": 97.2,
    "hi": 100.0
   },
   {
    "num": 419,
    "aa": "PHE",
    "tang": false,
    "lo": 99.9,
    "hi": 100.0
   },
   {
    "num": 441,
    "aa": "ASP",
    "tang": true,
    "lo": 100.0,
    "hi": 100.0
   },
   {
    "num": 443,
    "aa": "ILE",
    "tang": true,
    "lo": 90.6,
    "hi": 97.7
   },
   {
    "num": 463,
    "aa": "ILE",
    "tang": false,
    "lo": 84.2,
    "hi": 94.9
   },
   {
    "num": 465,
    "aa": "ASN",
    "tang": true,
    "lo": 82.6,
    "hi": 100.0
   }
  ],
  "cut25_only": [
   {
    "num": 276,
    "aa": "TYR",
    "tang": false,
    "lo": 35.9
   },
   {
    "num": 321,
    "aa": "ASN",
    "tang": false,
    "lo": 28.7
   },
   {
    "num": 371,
    "aa": "PHE",
    "tang": true,
    "lo": 35.5
   },
   {
    "num": 393,
    "aa": "LEU",
    "tang": false,
    "lo": 26.5
   },
   {
    "num": 487,
    "aa": "ARG",
    "tang": true,
    "lo": 36.1
   }
  ],
  "tang": [
   {
    "num": 273,
    "aa": "ASP",
    "in50": true,
    "in25": true,
    "occ": {
     "REF": 100.0,
     "WT": 100.0,
     "T723": 100.0,
     "T923": 100.0,
     "T1523": 81.1,
     "CHIS": 100.0,
     "LOWPH": 100.0,
     "T923L": 100.0
    }
   },
   {
    "num": 297,
    "aa": "VAL",
    "in50": true,
    "in25": true,
    "occ": {
     "REF": 99.0,
     "WT": 99.5,
     "T723": 99.8,
     "T923": 95.9,
     "T1523": 82.1,
     "CHIS": 99.7,
     "LOWPH": 98.7,
     "T923L": 98.4
    }
   },
   {
    "num": 348,
    "aa": "ASP",
    "in50": false,
    "in25": false,
    "occ": {
     "REF": 100.0,
     "WT": 53.7,
     "T723": 70.0,
     "T923": 0.0,
     "T1523": 90.1,
     "CHIS": 89.5,
     "LOWPH": 80.5,
     "T923L": 95.5
    }
   },
   {
    "num": 371,
    "aa": "PHE",
    "in50": false,
    "in25": true,
    "occ": {
     "REF": 99.3,
     "WT": 94.7,
     "T723": 88.5,
     "T923": 35.5,
     "T1523": 79.7,
     "CHIS": 83.1,
     "LOWPH": 86.5,
     "T923L": 94.7
    }
   },
   {
    "num": 441,
    "aa": "ASP",
    "in50": true,
    "in25": true,
    "occ": {
     "REF": 100.0,
     "WT": 100.0,
     "T723": 100.0,
     "T923": 100.0,
     "T1523": 100.0,
     "CHIS": 100.0,
     "LOWPH": 100.0,
     "T923L": 100.0
    }
   },
   {
    "num": 443,
    "aa": "ILE",
    "in50": true,
    "in25": true,
    "occ": {
     "REF": 94.6,
     "WT": 96.1,
     "T723": 96.7,
     "T923": 93.6,
     "T1523": 92.9,
     "CHIS": 96.7,
     "LOWPH": 97.7,
     "T923L": 90.6
    }
   },
   {
    "num": 465,
    "aa": "ASN",
    "in50": true,
    "in25": true,
    "occ": {
     "REF": 100.0,
     "WT": 99.9,
     "T723": 88.0,
     "T923": 82.6,
     "T1523": 98.7,
     "CHIS": 100.0,
     "LOWPH": 100.0,
     "T923L": 94.9
    }
   },
   {
    "num": 487,
    "aa": "ARG",
    "in50": false,
    "in25": true,
    "occ": {
     "REF": 100.0,
     "WT": 100.0,
     "T723": 99.9,
     "T923": 82.3,
     "T1523": 99.9,
     "CHIS": 100.0,
     "LOWPH": 100.0,
     "T923L": 36.1
    }
   }
  ],
  "n_tang_in50": 5,
  "n_new": 5
 },
 "apo": {
  "rmsd_rec": 1.5718526666666666,
  "groove": 35.906340666666665,
  "groove_sd": 0.5499964563651585,
  "rmsf_med": 1.097453598668578,
  "d_iface": 0.12470370370370369,
  "d_rest": 0.1556875,
  "corr": 0.9510202150823399,
  "n_iface": 54,
  "corr_lo": 0.9433582858525662,
  "corr_hi": 0.9711853503147373,
  "arg487_partner": {
   "res": "Phe510",
   "d": 3.69,
   "occ4": 84.4
  }
 }
};
