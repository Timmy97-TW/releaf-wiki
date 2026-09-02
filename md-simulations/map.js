/* =============================================================================
   ReLeaf: the MD Simulations page
   -----------------------------------------------------------------------------
   Two jobs, both of them reading data/runs.js and nothing else.

   1. The map. BoPep4 at the centre, four limbs for the four things that change
      between trajectories, one chip per run. Clicking a chip fills the panel
      beside it; clicking the centre puts the summary back. Every chip is a
      button as far as the keyboard and a screen reader are concerned.

   2. The language switch. Anything with data-en/data-zh gets swapped, the two
      tables and the index are rebuilt in the chosen language, and the choice is
      written to the same localStorage key the nine reports read, so switching
      here and opening a report keeps the language.

   Nothing on the page depends on this file being reached. With scripting off
   the prose, the references and the header are all still there; what is lost is
   the map, the two generated tables and the index, and the page says so.
   ========================================================================== */
(function () {
  "use strict";

  if (typeof MD_SET === "undefined") return;

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---- language ---------------------------------------------------------- */
  /* bp4lang is the key the nine reports already use. Sharing it is the whole
     point: a reader who switches once should not switch nine more times.     */
  const KEY = "bp4lang";
  let LANG = "en";
  try {
    LANG = localStorage.getItem(KEY) ||
           ((navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en");
  } catch (e) { /* private mode: fall back to English */ }
  const zh = () => LANG === "zh";
  const L  = (o) => (o && o[LANG]) || (o && o.en) || "";

  /* Strings the page builds rather than ships. Everything a reader sees in the
     panel, the legend and the two generated tables is in here twice.         */
  const STR = {
    summaryTitle:  { en: "Nine trajectories", zh: "九條軌跡" },
    summaryLead:   { en: "Pick a chip to read what that run changed and how it came out. The four limbs are the four things that vary.",
                     zh: "點一個方塊，就能看到那條軌跡改了什麼、結果如何。四條分支就是四個變動的項目。" },
    totals:        { en: "9 systems &middot; 30 ns each &middot; 25.9 GPU-hours &middot; 13,500 frames",
                     zh: "9 個系統 &middot; 每條 30 奈秒 &middot; 25.9 GPU 小時 &middot; 13,500 個影格" },
    back:          { en: "&larr; All nine", zh: "&larr; 回到九條" },
    open:          { en: "Open the full report &rarr;", zh: "打開完整報告 &rarr;" },
    seqNone:       { en: "no peptide", zh: "無胜肽" },
    residues:      { en: "res", zh: "殘基" },
    legendGood:    { en: "changed a decision", zh: "改變了決定" },
    legendWarn:    { en: "read with care", zh: "需謹慎解讀" },
    legendBad:     { en: "failed, or passed on the wrong atoms", zh: "未通過，或量錯原子而通過" },
    legendNeutral: { en: "control or reference", zh: "對照或參考" },
    clamp:         { en: "Clamp 4/4", zh: "鉗合 4/4" },
    bident:        { en: "Two guanidinium N", zh: "雙胍基氮" },
    contacts:      { en: "Contacts, 15&ndash;23", zh: "15&ndash;23 接觸數" },
    rmsd15:        { en: "Backbone RMSD, 15&ndash;23", zh: "15&ndash;23 主鏈 RMSD" },
    rmsdRec:       { en: "Receptor C&alpha; RMSD", zh: "受體 C&alpha; RMSD" },
    glu12:         { en: "Glu12&ndash;His227 within 4 &Aring;", zh: "Glu12&ndash;His227 於 4 &Aring; 內" },
    groove:        { en: "Groove span", zh: "凹槽跨距" },
    rmsf:          { en: "Median per-residue RMSF", zh: "逐殘基 RMSF 中位數" },
    gate:          { en: "Pre-registered gate", zh: "預先登錄的驗收" },
    ligAt:         { en: "AtPep1", zh: "AtPep1" },
    ligBo:         { en: "BoPep4", zh: "BoPep4" },
    cFree:         { en: "free carboxylate", zh: "自由羧基" },
    cTag:          { en: "fused to 6xHis", zh: "接上 6xHis" },
    ph7:           { en: "pH 7 &middot; histidines neutral", zh: "pH 7 &middot; 組胺酸中性" },
    ph55:          { en: "pH 5.5 &middot; His14/22/227 charged", zh: "pH 5.5 &middot; His14/22/227 帶電" },
    dash:          { en: "&mdash;", zh: "&mdash;" },
    nterm:         { en: "N", zh: "N" },
    cterm:         { en: "C", zh: "C" },
    grooveLab:     { en: "PEPR1 ectodomain &middot; inner LRR groove",
                     zh: "PEPR1 胞外域 &middot; LRR 內側凹槽" },
    absent:        { en: "deleted, not in the system", zh: "已刪去，不在系統中" },
    tagLab:        { en: "6xHis tag", zh: "6xHis 標籤" },
    noPeptide:     { en: "groove occupied by nothing", zh: "凹槽裡沒有東西" },
    glyphCapPep:   { en: "Each bead is one residue, shaded by how much of the 30 ns it spent within 4 &Aring; of the receptor. Hollow rings are residues this construct does not have.",
                     zh: "每一顆珠子是一個殘基，深淺代表它在 30 奈秒中有多少時間位於受體 4 &Aring; 以內。空心圈是這個構築沒有的殘基。" },
    glyphCapApo:   { en: "No peptide. Arg487 has nothing to clamp, so it pairs with Phe510 on the receptor's own surface.",
                     zh: "沒有胜肽。Arg487 沒有東西可以鉗住，於是與受體自己表面上的 Phe510 配對。" },
    bidentLab:     { en: "bidentate", zh: "雙齒" },
    singleLab:     { en: "one contact", zh: "單點接觸" },
    brokenLab:     { en: "mostly open", zh: "多半打開" },
    goneLab:       { en: "no salt bridge", zh: "無鹽橋" },
    banControl:    { en: "Control", zh: "對照" },
    banLadder:     { en: "Truncation", zh: "截短" },
    banTag:        { en: "6xHis tag", zh: "6xHis 標籤" },
    banPh:         { en: "pH 5.5", zh: "pH 5.5" },
    banCentre:     { en: "BoPep4 &times; PEPR1", zh: "BoPep4 &times; PEPR1" },
    heroWT:        { en: "Wild type 1&ndash;23", zh: "野生型 1&ndash;23" },
    heroCHIS:      { en: "+ C-terminal 6xHis", zh: "加 C 端 6xHis" },
    heroWTend:     { en: "Asn23 ends C, O, OXT &mdash; a free carboxylate with two oxygens, and Arg487 holds both in 100% of frames.",
                     zh: "Asn23 以 C、O、OXT 收尾&mdash;&mdash;帶兩個氧的自由羧基，Arg487 在 100% 的影格中同時抓住兩個。" },
    heroCHISend:   { en: "Asn23 ends C, O. The OXT has moved to His29, spent on the amide bond, so there is one oxygen and it cannot be bidentate: 2.4%.",
                     zh: "Asn23 以 C、O 收尾。OXT 已移到 His29，用去形成醯胺鍵，因此只剩一個氧，不可能是雙齒：2.4%。" },
    heroBident:    { en: "bidentate salt bridge", zh: "雙齒鹽橋" },
    heroFrame:     { en: "frame at", zh: "影格位於" },
    heroCap:       { en: "Two frames, not two drawings. Each is the frame closest to its own run's median Asn23&ndash;Arg487 distance, the receptors are superposed, and the same 179 receptor C&alpha; are drawn from the same angle in both panels, so anything that differs here differs in the simulation. Depth is shown by fading.",
                     zh: "這是兩個真實影格，不是兩張示意圖。各自取自最接近該軌跡 Asn23&ndash;Arg487 中位距離的影格，受體已疊合，兩張圖以相同視角畫出相同的 179 個受體 C&alpha;，因此圖上任何差異都來自模擬本身。深淺表示遠近。" },
    heroRec:       { en: "PEPR1 C&alpha; within 15 &Aring;", zh: "15 &Aring; 內的 PEPR1 C&alpha;" },
    heroTag:       { en: "6xHis", zh: "6xHis" },
    figTraceT:     { en: "Asn23&ndash;Arg487, every saved frame of all eight runs",
                     zh: "八條軌跡每一個影格的 Asn23&ndash;Arg487 距離" },
    figTraceC:     { en: "Closest approach between the Asn23 oxygens and the Arg487 side chain, measured off the coordinates in each report. The dashed line is 3.5 &Aring;. Two runs sit on it and never leave; two come off it repeatedly, and an occupancy alone would not tell you which. Note that a close contact is not the same as a salt bridge: the tagged run is inside 3.5 &Aring; almost always and still scores 2.4% bidentate, because it has one oxygen to offer.",
                     zh: "Asn23 的氧與 Arg487 側鏈之間的最近距離，直接量自各報告內的座標。虛線為 3.5 &Aring;。有兩條軌跡貼著它從未離開，也有兩條反覆脫離，而單看佔有率是分不出來的。另外，接觸近並不等於有鹽橋：帶標籤那一條幾乎總是在 3.5 &Aring; 以內，雙齒卻只有 2.4%，因為它只剩一個氧。" },
    figTraceY:     { en: "distance (&Aring;)", zh: "距離（&Aring;）" },
    figTraceX:     { en: "simulation time (ns)", zh: "模擬時間（奈秒）" },
    figOpens:      { en: "reopenings", zh: "重新斷開次數" },
    figHeatT:      { en: "Per-residue contact occupancy, eight constructs",
                     zh: "八個構築的逐殘基接觸佔有率" },
    figHeatC:      { en: "One cell per residue per run: how much of the 30 ns that residue spent within 4 &Aring; of the receptor. Blank cells are residues the construct does not have. Read down a column to see whether a position survives truncation; read across a row to see where a construct actually holds on. The letters underneath are the BoPep4 wild-type sequence; the AtPep1 row is a different peptide at the same numbering, so hover a cell for its own residue.",
                     zh: "每一格是一條軌跡的一個殘基：該殘基在 30 奈秒中位於受體 4 &Aring; 以內的時間比例。空白格是該構築沒有的殘基。直著看可以知道某個位置能不能撐過截短，橫著看可以知道某個構築真正抓在哪裡。下方的字母是 BoPep4 野生型序列；AtPep1 那一列是另一條胜肽，只是編號相同，把游標移到格子上會顯示它自己的殘基。" },
    figScatT:      { en: "Backbone RMSD against the salt bridge, eight runs",
                     zh: "八條軌跡的主鏈 RMSD 對鹽橋" },
    figScatC:      { en: "Right is a more mobile backbone, up is an intact bidentate salt bridge. If steadiness predicted chemistry the points would fall on a line. They do not, and the two lowest-RMSD points in the set are the tagged construct and the run that failed its gate.",
                     zh: "越往右主鏈越會動，越往上雙齒鹽橋越完整。如果穩定度能預測化學，這些點會落在一條線上。它們沒有；而全套 RMSD 最低的兩點，正是帶標籤的構築與未通過驗收的那一條。" },
    figScatX:      { en: "15&ndash;23 backbone RMSD (&Aring;)", zh: "15&ndash;23 主鏈 RMSD（&Aring;）" },
    figScatY:      { en: "bidentate salt bridge (%)", zh: "雙齒鹽橋（%）" },
    figApoT:       { en: "Receptor C&alpha; RMSD, with and without a peptide",
                     zh: "有無胜肽時的受體 C&alpha; RMSD" },
    figApoC:       { en: "The apo run is the leftmost mark. Removing the peptide entirely moves the receptor less than swapping one peptide for another does, which is what puts a floor under every receptor-side comparison on the other eight pages.",
                     zh: "最左邊那一個標記是 apo。把胜肽整個移除，受體的變動比換一條胜肽還小；這就是另外八頁上所有受體端比較的底線。" },
    figApoX:       { en: "receptor C&alpha; RMSD (&Aring;)", zh: "受體 C&alpha; RMSD（&Aring;）" },
    figApoNo:      { en: "no peptide", zh: "無胜肽" },
    figApoSpan:    { en: "across the eight peptide-bearing runs", zh: "橫跨八條帶胜肽的軌跡" },
    stripLab:      { en: "The strip on each chip is that construct's peptide, one mark per residue: filled and shaded by contact occupancy where the residue is present, a hollow ring where it was deleted, rust where it belongs to the 6xHis tag.",
                     zh: "每個方塊上的長條就是該構築的胜肽，一格一個殘基：殘基存在時為實心，深淺代表接觸佔有率；被刪去時為空心圈；屬於 6xHis 標籤的以鏽紅色標示。" }
  };
  const S = (k) => L(STR[k]);

  /* ---- number formatting ------------------------------------------------- */
  const pct  = (v) => (v === null || v === undefined) ? S("dash") : v.toFixed(1) + "%";
  /* &plusmn; and the unit are glued on with non-breaking spaces: a value that
     wraps mid-number in a table cell is unreadable. */
  const bare = (v, sem) => (v === null || v === undefined) ? S("dash")
                : v.toFixed(2) + (sem ? "&nbsp;&plusmn;&nbsp;" + sem.toFixed(2) : "");
  const ang  = (v, sem) => (v === null || v === undefined) ? S("dash")
                : bare(v, sem) + "&nbsp;&Aring;";
  const one  = (v) => (v === null || v === undefined) ? S("dash") : v.toFixed(1);

  const RUN = {};
  MD_SET.runs.forEach((r) => { RUN[r.key] = r; });
  const LIMB = {};
  MD_SET.branches.forEach((b) => { LIMB[b.id] = b; });
  const WT = RUN.WT;

  /* Cells that are technically true and mean something else. Both are argued
     at length on the pages they belong to; here they only need a colour.     */
  const FLAGGED = { CHIS: ["bident", "rmsd15", "gate"], T923L: ["rmsd15", "gate"] };
  const isFlagged = (key, field) => (FLAGGED[key] || []).indexOf(field) !== -1;

  /* ---- the map ----------------------------------------------------------- */

  const CHIP_W = 182, CHIP_H = 56, HUB_W = 158, HUB_H = 40, CORE_R = 74;

  /* A cubic with horizontal handles: limbs leave the centre and arrive at a
     chip flat, which keeps the eye on the chip rather than on the wire.      */
  function wire(x1, y1, x2, y2, limb) {
    const mx = (x1 + x2) / 2;
    return '<path class="mm-link mm-el" data-limb="' + limb + '" d="M' + x1 + ' ' + y1 +
           ' C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2 + '"/>';
  }

  function drawMap() {
    const svg = $("#mdmap-svg");
    if (!svg) return;
    const c = MD_SET.centre;
    const out = [];

    /* wires first so every node paints over them */
    MD_SET.branches.forEach((b) => {
      const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy);
      const sx = c.x + (dx / d) * CORE_R, sy = c.y + (dy / d) * CORE_R;
      const ex = b.x + (b.x < c.x ? HUB_W / 2 : -HUB_W / 2);
      out.push(wire(sx, sy, ex, b.y, b.id));
    });
    MD_SET.runs.forEach((r) => {
      const b = LIMB[r.branch];
      const sx = b.x + (r.x < b.x ? -HUB_W / 2 : HUB_W / 2);
      const ex = r.x + (r.x < b.x ? CHIP_W / 2 : -CHIP_W / 2);
      out.push(wire(sx, b.y, ex, r.y, r.branch));
    });

    /* limb labels */
    MD_SET.branches.forEach((b) => {
      out.push(
        '<g class="mm-hub mm-el" data-limb="' + b.id + '">' +
          '<rect x="' + (b.x - HUB_W / 2) + '" y="' + (b.y - HUB_H / 2) + '" width="' + HUB_W +
            '" height="' + HUB_H + '" rx="20"/>' +
          '<text x="' + b.x + '" y="' + (b.y + 5) + '" text-anchor="middle">' +
            esc(L(b).name) + "</text>" +
        "</g>");
    });

    /* the peptide */
    out.push(
      '<g class="mm-core" role="button" tabindex="0" data-key="" ' +
        'aria-label="' + (zh() ? "回到九條軌跡的摘要" : "Back to the summary of all nine runs") + '">' +
        '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + CORE_R + '"/>' +
        '<text class="mm-core__name" x="' + c.x + '" y="' + (c.y - 2) + '" text-anchor="middle">BoPep4</text>' +
        '<text class="mm-core__sub" x="' + c.x + '" y="' + (c.y + 20) + '" text-anchor="middle">&#215; PEPR1</text>' +
      "</g>");

    /* the runs */
    MD_SET.runs.forEach((r) => {
      const x = r.x - CHIP_W / 2, y = r.y - CHIP_H / 2;
      const sub = r.apo ? "" : r.n + " " + S("residues");
      out.push(
        '<g class="mm-node mm-el is-' + r.state + '" data-limb="' + r.branch + '" data-key="' + r.key +
          '" role="button" tabindex="0" aria-label="' + esc(L(r).name) + '">' +
          '<rect x="' + x + '" y="' + y + '" width="' + CHIP_W + '" height="' + CHIP_H + '" rx="10"/>' +
          '<circle class="mm-node__dot" cx="' + (x + 16) + '" cy="' + (r.y - 12) + '" r="4.5"/>' +
          '<text class="mm-node__name" x="' + (x + 29) + '" y="' + (r.y - 8) + '">' + esc(L(r).short) + "</text>" +
          '<text class="mm-node__sub" x="' + (x + CHIP_W - 14) + '" y="' + (r.y - 8) +
            '" text-anchor="end">' + sub + "</text>" +
          strip(r, x + 16, r.y + 14) +
        "</g>");
    });

    svg.innerHTML = out.join("");
    bindMap(svg);
  }

  function bindMap(svg) {
    $$("[data-key]", svg).forEach((g) => {
      const key = g.getAttribute("data-key");
      const go = () => select(key || null);
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
      if (key) {
        const limb = RUN[key].branch;
        g.addEventListener("mouseenter", () => svg.setAttribute("data-limb", limb));
        g.addEventListener("focus", () => svg.setAttribute("data-limb", limb));
        g.addEventListener("mouseleave", () => svg.removeAttribute("data-limb"));
        g.addEventListener("blur", () => svg.removeAttribute("data-limb"));
      }
    });
    $$(".mm-hub", svg).forEach((g) => {
      const limb = g.getAttribute("data-limb");
      g.addEventListener("mouseenter", () => svg.setAttribute("data-limb", limb));
      g.addEventListener("mouseleave", () => svg.removeAttribute("data-limb"));
    });
  }

  let selected = null;

  function select(key) {
    selected = key;
    $$(".mm-node").forEach((g) => g.classList.toggle("is-on", g.getAttribute("data-key") === key));
    panel();
  }

  /* ---- the panel --------------------------------------------------------- */




  /* ---- the four data figures --------------------------------------------- */
  /* All of them read MD_SET, MD_TRACE and nothing else, and all of them are
     redrawn on a language switch because their axis labels change.           */

  const svgFig = (w, h, inner, label) =>
    '<svg class="dfig__svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' +
    esc(label) + '">' + inner + "</svg>";

  function figCard(id, title, body, cap) {
    const el = $("#" + id);
    if (el) el.innerHTML = '<figure class="dfig"><figcaption class="dfig__t">' + title +
      "</figcaption>" + body + '<p class="dfig__c">' + cap + "</p></figure>";
  }

  /* 1. the Asn23-Arg487 distance, frame by frame, for all eight ------------- */
  function figTrace() {
    if (typeof MD_TRACE === "undefined") return;
    const W = 700, GUT = 104, RIGHT = 108, ROW = 40, PAD = 6, TOP = 10;
    const runs = MD_SET.runs.filter((r) => !r.apo && MD_TRACE[r.key]);
    const H = TOP + runs.length * (ROW + PAD) + 34;
    const PW = W - GUT - RIGHT;
    const LO = 2.2, HI = 6.5;                       /* angstrom, clipped */
    const tmax = 30;
    const o = [];

    runs.forEach((r, i) => {
      const tr = MD_TRACE[r.key];
      const y0 = TOP + i * (ROW + PAD);
      const yv = (d) => y0 + ROW - (Math.min(Math.max(d, LO), HI) - LO) / (HI - LO) * ROW;
      const xv = (t) => GUT + (t / tmax) * PW;

      o.push('<rect class="dfig-band" x="' + GUT + '" y="' + y0 + '" width="' + PW +
             '" height="' + ROW + '"/>');
      o.push('<line class="dfig-cut" x1="' + GUT + '" y1="' + yv(3.5).toFixed(1) +
             '" x2="' + (GUT + PW) + '" y2="' + yv(3.5).toFixed(1) + '"/>');
      o.push('<polyline class="dfig-trace is-' + r.state + '" points="' +
             tr.t.map((t, k) => xv(t).toFixed(1) + "," + yv(tr.d[k]).toFixed(1)).join(" ") +
             '"/>');
      o.push('<text class="dfig-row" x="' + (GUT - 10) + '" y="' + (y0 + ROW / 2 + 4) +
             '" text-anchor="end">' + esc(L(r).short) + "</text>");
      o.push('<text class="dfig-note" x="' + (GUT + PW + 8) + '" y="' + (y0 + ROW / 2 - 1) +
             '">' + tr.occ.toFixed(1) + "%</text>");
      o.push('<text class="dfig-note is-dim" x="' + (GUT + PW + 8) + '" y="' + (y0 + ROW / 2 + 11) +
             '">' + tr.breaks + " " + S("figOpens") + "</text>");
    });

    const base = TOP + runs.length * (ROW + PAD);
    [0, 10, 20, 30].forEach((t) => {
      const x = GUT + (t / tmax) * PW;
      o.push('<line class="dfig-tick" x1="' + x + '" y1="' + base + '" x2="' + x +
             '" y2="' + (base + 4) + '"/>');
      o.push('<text class="dfig-ax" x="' + x + '" y="' + (base + 16) +
             '" text-anchor="middle">' + t + "</text>");
    });
    o.push('<text class="dfig-ax" x="' + (GUT + PW / 2) + '" y="' + (base + 30) +
           '" text-anchor="middle">' + S("figTraceX") + "</text>");
    o.push('<text class="dfig-ax" x="' + (GUT - 10) + '" y="' + (TOP - 1) +
           '" text-anchor="end">' + S("figTraceY") + "</text>");

    figCard("fig-trace", S("figTraceT"), svgFig(W, H, o.join(""), S("figTraceT")),
            S("figTraceC"));
  }

  /* 2. per-residue occupancy, eight constructs by twenty-nine positions ----- */
  function figHeat() {
    const W = 700, GUT = 104, TOP = 26, CH = 20, SLOT = (W - GUT - 12) / SLOTS;
    const runs = MD_SET.runs.filter((r) => !r.apo);
    const H = TOP + runs.length * CH + 30;
    const o = [];

    for (let i = 1; i <= SLOTS; i += 1) {
      if (i % 5 === 0 || i === 1) {
        o.push('<text class="dfig-ax" x="' + (GUT + (i - 0.5) * SLOT).toFixed(1) +
               '" y="' + (TOP - 12) + '" text-anchor="middle">' + i + "</text>");
      }
    }
    runs.forEach((r, k) => {
      const y = TOP + k * CH;
      o.push('<text class="dfig-row" x="' + (GUT - 10) + '" y="' + (y + CH / 2 + 4) +
             '" text-anchor="end">' + esc(L(r).short) + "</text>");
      for (let i = 1; i <= SLOTS; i += 1) {
        const res = r.perRes[i];
        const x = GUT + (i - 1) * SLOT;
        if (!res) continue;
        o.push('<rect class="dfig-cell' + (i > 23 ? " is-tag" : "") + '" x="' + x.toFixed(1) +
               '" y="' + (y + 2) + '" width="' + (SLOT - 1.4).toFixed(1) + '" height="' + (CH - 4) +
               '" style="' + shade(res.o) + '"><title>' + esc(L(r).short) + " &middot; " +
               res.c + i + " &middot; " + res.o.toFixed(1) + "%</title></rect>");
      }
    });
    const seq = RUN.WT.seq;
    const yb = TOP + runs.length * CH + 13;
    for (let i = 1; i <= 23; i += 1) {
      o.push('<text class="dfig-seq" x="' + (GUT + (i - 0.5) * SLOT).toFixed(1) +
             '" y="' + yb + '" text-anchor="middle">' + seq[i - 1] + "</text>");
    }
    for (let i = 24; i <= SLOTS; i += 1) {
      o.push('<text class="dfig-seq is-tag" x="' + (GUT + (i - 0.5) * SLOT).toFixed(1) +
             '" y="' + yb + '" text-anchor="middle">H</text>');
    }

    figCard("fig-heat", S("figHeatT"), svgFig(W, H, o.join(""), S("figHeatT")), S("figHeatC"));
  }

  /* 3. steadiness against chemistry ---------------------------------------- */
  function figScatter() {
    const W = 560, H = 320, ML = 62, MR = 18, T = 16, B = 52;
    const pts = MD_SET.runs.filter((r) => !r.apo);
    const xs = pts.map((r) => r.rmsd15), lo = 0.9, hi = 2.45;
    const xv = (v) => ML + (v - lo) / (hi - lo) * (W - ML - MR);
    const yv = (v) => H - B - (v / 100) * (H - T - B);
    const o = [];

    [0, 25, 50, 75, 100].forEach((v) => {
      o.push('<line class="dfig-grid" x1="' + ML + '" y1="' + yv(v).toFixed(1) +
             '" x2="' + (W - MR) + '" y2="' + yv(v).toFixed(1) + '"/>');
      o.push('<text class="dfig-ax" x="' + (ML - 8) + '" y="' + (yv(v) + 4).toFixed(1) +
             '" text-anchor="end">' + v + "</text>");
    });
    [1.0, 1.4, 1.8, 2.2].forEach((v) => {
      o.push('<text class="dfig-ax" x="' + xv(v).toFixed(1) + '" y="' + (H - B + 16) +
             '" text-anchor="middle">' + v.toFixed(1) + "</text>");
    });
    o.push('<text class="dfig-ax" x="' + ((ML + W - MR) / 2) + '" y="' + (H - 12) +
           '" text-anchor="middle">' + S("figScatX") + "</text>");
    o.push('<text class="dfig-ax" transform="translate(14,' + ((T + H - B) / 2) +
           ') rotate(-90)" text-anchor="middle">' + S("figScatY") + "</text>");

    /* Four of the eight sit on the 100% line within a hair of each other, so the
       labels have to be placed rather than offset: try right, then left, then a
       row down, and take the first slot that is free. */
    const placed = [];
    const clear = (b) => !placed.some((q) => b.x0 < q.x1 && q.x0 < b.x1 &&
                                             b.y0 < q.y1 && q.y0 < b.y1);
    pts.forEach((r) => {
      const x = xv(r.rmsd15), y = yv(r.bident);
      o.push('<circle class="dfig-pt is-' + r.state + '" cx="' + x.toFixed(1) + '" cy="' +
             y.toFixed(1) + '" r="5.5"><title>' + esc(L(r).name) + " &middot; " +
             r.rmsd15.toFixed(2) + " &Aring; &middot; " + r.bident.toFixed(1) + "%</title></circle>");

      const txt = esc(L(r).short);
      const w = txt.length * 5.6 + 4;
      let put = null;
      for (const dy of [0, 14, -14, 28]) {
        for (const side of [1, -1]) {
          const lx = x + side * 9, ly = y + 3.5 + dy;
          const box = { x0: side > 0 ? lx : lx - w, x1: side > 0 ? lx + w : lx,
                        y0: ly - 9, y1: ly + 4 };
          if (box.x0 < ML || box.x1 > W - MR) continue;
          if (clear(box)) { put = { lx: lx, ly: ly, side: side, box: box }; break; }
        }
        if (put) break;
      }
      if (!put) return;
      placed.push(put.box);
      o.push('<text class="dfig-ptlab" x="' + put.lx.toFixed(1) + '" y="' + put.ly.toFixed(1) +
             '" text-anchor="' + (put.side > 0 ? "start" : "end") + '">' + txt + "</text>");
    });

    figCard("fig-scatter", S("figScatT"), svgFig(W, H, o.join(""), S("figScatT")), S("figScatC"));
  }

  /* 4. the apo floor -------------------------------------------------------- */
  function figApo() {
    const W = 660, H = 118, ML = 26, MR = 26, AX = 74;
    const all = MD_SET.runs;
    const lo = 1.45, hi = 2.30;
    const xv = (v) => ML + (v - lo) / (hi - lo) * (W - ML - MR);
    const o = [];

    const holo = all.filter((r) => !r.apo).map((r) => r.rmsdRec);
    o.push('<rect class="dfig-span" x="' + xv(Math.min.apply(null, holo)).toFixed(1) +
           '" y="' + (AX - 15) + '" width="' +
           (xv(Math.max.apply(null, holo)) - xv(Math.min.apply(null, holo))).toFixed(1) +
           '" height="30"/>');
    o.push('<line class="dfig-axis" x1="' + ML + '" y1="' + AX + '" x2="' + (W - MR) +
           '" y2="' + AX + '"/>');
    [1.5, 1.7, 1.9, 2.1, 2.3].forEach((v) => {
      o.push('<line class="dfig-tick" x1="' + xv(v).toFixed(1) + '" y1="' + AX +
             '" x2="' + xv(v).toFixed(1) + '" y2="' + (AX + 5) + '"/>');
      o.push('<text class="dfig-ax" x="' + xv(v).toFixed(1) + '" y="' + (AX + 18) +
             '" text-anchor="middle">' + v.toFixed(1) + "</text>");
    });
    o.push('<text class="dfig-ax" x="' + (W / 2) + '" y="' + (AX + 34) +
           '" text-anchor="middle">' + S("figApoX") + "</text>");
    const spanLo = Math.min.apply(null, holo), spanHi = Math.max.apply(null, holo);
    o.push('<text class="dfig-spanlab" x="' + ((xv(spanLo) + xv(spanHi)) / 2).toFixed(1) +
           '" y="' + (AX - 22) + '" text-anchor="middle">' +
           (spanHi - spanLo).toFixed(2) + "&#8202;&Aring; " + S("figApoSpan") + "</text>");

    all.forEach((r) => {
      const x = xv(r.rmsdRec);
      if (r.apo) {
        o.push('<line class="dfig-apo" x1="' + x.toFixed(1) + '" y1="' + (AX - 30) +
               '" x2="' + x.toFixed(1) + '" y2="' + (AX + 8) + '"/>');
        o.push('<text class="dfig-apolab" x="' + x.toFixed(1) + '" y="' + (AX - 36) +
               '" text-anchor="middle">' + S("figApoNo") + " &middot; " +
               r.rmsdRec.toFixed(2) + "</text>");
      } else {
        o.push('<circle class="dfig-pt is-' + r.state + '" cx="' + x.toFixed(1) + '" cy="' +
               AX + '" r="5"><title>' + esc(L(r).short) + " &middot; " +
               r.rmsdRec.toFixed(2) + " &Aring;</title></circle>");
      }
    });

    figCard("fig-apo", S("figApoT"), svgFig(W, H, o.join(""), S("figApoT")), S("figApoC"));
  }


  /* ---- the banner behind the title --------------------------------------- */
  /* Five real frames on one camera: BoPep4 on PEPR1 in the middle, and the four
     things the set varies at the corners. Drawn bond by bond out of
     data/banner.js, pale on the deep green the wiki uses for a hero, which is
     also how a molecular snapshot is usually shown.                          */

  const BAN_LAB = { control: "banControl", ladder: "banLadder",
                    tag: "banTag", ph: "banPh" };

  /* Where each panel sits in the 1600 x 620 banner. The composition is pushed
     into the upper three quarters because page.css scrims the bottom of a hero
     for the title, and the left panels are carried brighter because the same
     rule darkens the left 44% behind the eyebrow. */
  const BAN_AT = {
    WT:    { x: 812, y: 278, k: 1.00, o: 1.00 },
    REF:   { x: 296, y: 142, k: 0.60, o: 0.86 },
    CHIS:  { x: 1310, y: 142, k: 0.60, o: 0.66 },
    T923:  { x: 296, y: 380, k: 0.60, o: 0.86 },
    LOWPH: { x: 1310, y: 380, k: 0.60, o: 0.66 }
  };

  const ATOM_R = { C: 1.5, N: 1.9, O: 1.9, S: 2.2 };

  function banPanel(p, at) {
    const B = MD_BANNER.box, o = [];
    const pt = (q) => q[0].toFixed(1) + "," + q[1].toFixed(1);

    if (p.key === "WT") {                       /* the pocket, stippled */
      MD_BANNER.surf.forEach((q) => {
        o.push('<circle class="ban-surf" cx="' + q[0] + '" cy="' + q[1] +
               '" r="' + (0.9 + 1.1 * q[2]).toFixed(2) +
               '" style="opacity:' + (0.05 + 0.16 * q[2]).toFixed(3) + '"/>');
      });
    }
    p.rec.forEach((seg) => {
      o.push('<polyline class="ban-rec" points="' + seg.map(pt).join(" ") +
             '" style="opacity:' + (0.14 + 0.4 * seg[0][2]).toFixed(2) + '"/>');
    });
    p.clamp.forEach((b) => {
      o.push('<line class="ban-clamp" x1="' + b[0][0] + '" y1="' + b[0][1] +
             '" x2="' + b[1][0] + '" y2="' + b[1][1] +
             '" style="opacity:' + (0.2 + 0.45 * b[0][2]).toFixed(2) + '"/>');
    });
    p.pep.forEach((b) => {
      o.push('<line class="ban-pep" x1="' + b[0][0] + '" y1="' + b[0][1] +
             '" x2="' + b[1][0] + '" y2="' + b[1][1] +
             '" style="opacity:' + (0.35 + 0.6 * b[0][2]).toFixed(2) + '"/>');
    });
    p.atoms.forEach((a) => {
      const q = a[0];
      o.push('<circle class="ban-atom is-' + a[1] + '" cx="' + q[0] + '" cy="' + q[1] +
             '" r="' + ATOM_R[a[1]] + '" style="opacity:' + (0.4 + 0.55 * q[2]).toFixed(2) +
             '"/>');
    });

    const lab = p.limb === "centre" ? S("banCentre") : S(BAN_LAB[p.limb]);
    o.push('<text class="ban-lab' + (p.limb === "centre" ? " is-centre" : "") +
           '" x="' + (B.w / 2) + '" y="' + (B.h - 30) + '" text-anchor="middle">' + lab + "</text>");

    return '<g transform="translate(' + (at.x - B.w * at.k / 2).toFixed(1) + "," +
           (at.y - B.h * at.k / 2).toFixed(1) + ") scale(" + at.k + ')" opacity="' + at.o +
           '">' + o.join("") + "</g>";
  }

  function banner() {
    const el = $("#mdbanner");
    if (!el || typeof MD_BANNER === "undefined") return;
    const order = ["REF", "T923", "CHIS", "LOWPH", "WT"];   /* centre last, on top */
    const by = {};
    MD_BANNER.panels.forEach((p) => { by[p.key] = p; });
    el.innerHTML =
      '<svg class="ban" viewBox="0 0 1600 620" preserveAspectRatio="xMidYMid meet" ' +
        'aria-hidden="true" focusable="false">' +
        order.filter((k) => by[k]).map((k) => banPanel(by[k], BAN_AT[k])).join("") +
      "</svg>";
  }

  /* ---- the landing pair -------------------------------------------------- */
  /* Two frames out of two trajectories, drawn through one camera. Everything
     here comes from data/hero.js, which build/md_hero_frames.py projects out of
     the coordinate arrays the report players read. Nothing is redrawn by hand. */

  function heroPanel(p, meta) {
    const B = MD_HERO.box, o = [];

    /* receptor first, faded by depth so the site reads as a pocket */
    p.rec.forEach((seg) => {
      o.push('<polyline class="hero-rec" points="' +
             seg.map((q) => q[0] + "," + q[1]).join(" ") +
             '" style="opacity:' + (0.14 + 0.46 * seg[0][2]).toFixed(2) + '"/>');
    });

    /* the peptide backbone, mature part and tag drawn apart, on a white halo
       so it stays legible where it crosses the receptor */
    const cut = p.pepRes.findIndex((r) => r > 22);
    const mature = cut === -1 ? p.pep : p.pep.slice(0, cut);
    const tail = cut === -1 ? [] : p.pep.slice(cut - 1);
    const pts = (a) => a.map((q) => q[0] + "," + q[1]).join(" ");
    o.push('<polyline class="hero-halo" points="' + pts(mature) + '"/>');
    o.push('<polyline class="hero-pep" points="' + pts(mature) + '"/>');
    if (tail.length > 1) {
      o.push('<polyline class="hero-halo" points="' + pts(tail) + '"/>');
      o.push('<polyline class="hero-pep is-tag" points="' + pts(tail) + '"/>');
      const t = tail[Math.min(tail.length - 1, Math.floor(tail.length * 0.7))];
      o.push('<text class="hero-tag" x="' + (t[0] + 9) + '" y="' + (t[1] + 4) + '">' +
             S("heroTag") + "</text>");
    }

    /* the bonds. Two of them where there are two oxygens, one where there is one. */
    p.bonds.forEach((b) => {
      o.push('<line class="hero-bond" x1="' + b.a[0] + '" y1="' + b.a[1] +
             '" x2="' + b.b[0] + '" y2="' + b.b[1] + '"/>');
    });

    /* Arg487 side chain, then the Asn23 oxygens on top of it */
    p.arg.forEach((q) => o.push('<circle class="hero-arg" cx="' + q[0] + '" cy="' + q[1] + '" r="2.6"/>'));
    p.asn.forEach((q, i) => {
      o.push('<circle class="hero-oxy" cx="' + q[0] + '" cy="' + q[1] + '" r="3.6"/>');
      o.push('<text class="hero-atom" x="' + (q[0] - 7) + '" y="' + (q[1] + 4 + i * 11) +
             '" text-anchor="end">' + (p.oxyNames[i] || "") + "</text>");
    });

    if (p.bonds.length) {
      const m = p.bonds[0];
      o.push('<text class="hero-d" x="' + ((m.a[0] + m.b[0]) / 2 + 13).toFixed(1) +
             '" y="' + ((m.a[1] + m.b[1]) / 2 + 4).toFixed(1) + '">' +
             p.d.toFixed(2) + "&#8202;&Aring;</text>");
    }

    const an = p.asn[p.asn.length - 1], ar = p.arg[Math.floor(p.arg.length / 2)];
    o.push('<text class="hero-lab" x="' + an[0] + '" y="' + (an[1] + 30) +
           '" text-anchor="middle">Asn23</text>');
    o.push('<text class="hero-lab" x="' + ar[0] + '" y="' + (ar[1] - 14) +
           '" text-anchor="middle">Arg487</text>');

    return '<figure class="hero__panel">' +
      '<svg viewBox="0 0 ' + B.w + " " + B.h + '" role="img" aria-label="' +
        esc(L(meta.title)) + '">' + o.join("") + "</svg>" +
      "<figcaption>" +
        '<b class="hero__name">' + S(meta.title) + "</b>" +
        '<span class="hero__bident is-' + meta.tone + '">' +
          meta.bident.toFixed(1) + "% " + S("heroBident") + "</span>" +
        '<span class="hero__end">' + S(meta.end) + "</span>" +
        '<span class="hero__frame">' + S("heroFrame") + " " + p.frameNs.toFixed(1) +
          "&#8202;ns &middot; " + p.nPepRes + " " + S("residues") + "</span>" +
      "</figcaption></figure>";
  }

  function hero() {
    const el = $("#mdhero");
    if (!el || typeof MD_HERO === "undefined") return;
    const meta = {
      WT:   { title: "heroWT",   end: "heroWTend",   bident: RUN.WT.bident,   tone: "good" },
      CHIS: { title: "heroCHIS", end: "heroCHISend", bident: RUN.CHIS.bident, tone: "bad" }
    };
    el.innerHTML =
      '<div class="hero__pair">' +
        MD_HERO.panels.map((p) => heroPanel(p, meta[p.key])).join("") +
      "</div>" +
      '<p class="hero__cap">' + S("heroCap") + "</p>";
  }

  /* ---- drawing a run rather than labelling it ---------------------------- */
  /* Two sizes of the same picture. The strip on a map chip is the peptide as a
     row of residues; the schematic in the panel puts that row into the groove
     it binds, with the two contacts the whole set turns on drawn as bonds.

     Nothing here is decorative. A bead's shade is that residue's contact
     occupancy from the trajectory, a hollow ring is a residue the construct
     does not have, and the clamp is drawn with as many bonds as the salt
     bridge actually makes.                                                   */

  const SLOTS = 29;                       /* 1-23 mature, 24-29 the His tag */

  /* Grey letters under the deleted residues come from the wild-type sequence,
     which is in the data. AtPep1 is a different peptide and its missing 1-6 are
     not in this set, so that run gets rings without letters. */
  const wtLetter = (i) => (RUN.WT.seq[i - 1] || "");

  function shade(occ) {                   /* 0-100 -> ink for a residue bead */
    const a = 0.10 + 0.90 * Math.max(0, Math.min(100, occ)) / 100;
    return "opacity:" + a.toFixed(2);
  }

  /* the chip strip: 29 slots, 150 units wide */
  function strip(r, x0, y0) {
    if (r.apo) {
      return '<line class="mm-strip__none" x1="' + x0 + '" y1="' + y0 +
             '" x2="' + (x0 + 150) + '" y2="' + y0 + '"/>';
    }
    const step = 150 / SLOTS, out = [];
    for (let i = 1; i <= SLOTS; i++) {
      const cx = x0 + (i - 0.5) * step;
      const res = r.perRes[i];
      if (res) {
        out.push('<circle class="mm-bead' + (i > 23 ? " is-tag" : "") + '" cx="' +
                 cx.toFixed(1) + '" cy="' + y0 + '" r="2.1" style="' + shade(res.o) + '"/>');
      } else if (i <= 23) {
        out.push('<circle class="mm-gap" cx="' + cx.toFixed(1) + '" cy="' + y0 + '" r="2"/>');
      }
    }
    return out.join("");
  }

  /* the panel schematic ---------------------------------------------------- */
  /* PEPR1's ectodomain is a leucine-rich-repeat solenoid and the peptide lies
     extended along its concave inner face, so that is what is drawn: a curved
     receptor body with repeat divisions, the peptide resting on it, and the two
     receptor residues that matter sitting in the body rather than floating
     above it. Residues the construct does not have drift up and away from the
     groove on a dashed backbone, which is the one thing a sequence string
     cannot show you.                                                          */

  const GW = 460, GH = 176;
  const P0 = [34, 100], CP = [230, 48], P1 = [426, 100];
  const BODY_IN = 12, BODY_OUT = 40;        /* the receptor body, under the peptide */

  const onCurve = (t) => [
    (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * CP[0] + t * t * P1[0],
    (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * CP[1] + t * t * P1[1]
  ];
  const arcPath = (dy) => "M" + P0[0] + " " + (P0[1] + dy) +
                          " Q" + CP[0] + " " + (CP[1] + dy) + "," + P1[0] + " " + (P1[1] + dy);

  /* residue i sits at slot i; a residue the construct lacks lifts off the
     groove, further the deeper into the deletion it is */
  function slotAt(i, r) {
    const p = onCurve((i - 1) / (SLOTS - 1));
    const lift = (r && !r.perRes[i] && r.first) ? Math.max(0, r.first - i) * 2.2 : 0;
    return [p[0], p[1] - lift];
  }

  function bond(from, to, kind) {
    /* 2 = bidentate, drawn as two bonds because that is what it is;
       1 = one contact; 0 = broken. */
    if (kind < 0) return "";
    if (kind === 2) {
      const dx = to[0] - from[0], dy = to[1] - from[1];
      const n = Math.hypot(dx, dy) || 1, ox = (-dy / n) * 1.8, oy = (dx / n) * 1.8;
      return '<line class="mm-bond is-2" x1="' + (from[0] + ox).toFixed(1) + '" y1="' + (from[1] + oy).toFixed(1) +
             '" x2="' + (to[0] + ox).toFixed(1) + '" y2="' + (to[1] + oy).toFixed(1) + '"/>' +
             '<line class="mm-bond is-2" x1="' + (from[0] - ox).toFixed(1) + '" y1="' + (from[1] - oy).toFixed(1) +
             '" x2="' + (to[0] - ox).toFixed(1) + '" y2="' + (to[1] - oy).toFixed(1) + '"/>';
    }
    return '<line class="mm-bond is-' + kind + '" x1="' + from[0].toFixed(1) + '" y1="' + from[1].toFixed(1) +
           '" x2="' + to[0].toFixed(1) + '" y2="' + to[1].toFixed(1) + '"/>';
  }

  function anchor(at, label, sub, kind) {
    return '<g class="mm-anchor is-' + kind + '">' +
             '<circle cx="' + at[0].toFixed(1) + '" cy="' + at[1].toFixed(1) + '" r="4.8"/>' +
             '<text x="' + at[0].toFixed(1) + '" y="' + (at[1] + 30).toFixed(1) +
               '" text-anchor="middle">' + label + "</text>" +
             (sub ? '<text class="mm-anchor__sub" x="' + at[0].toFixed(1) + '" y="' +
                    (at[1] + 42).toFixed(1) + '" text-anchor="middle">' + sub + "</text>" : "") +
           "</g>";
  }

  function glyph(r) {
    const out = [];

    /* the receptor body: a closed crescent, not a fat stroke, so the ends are
       square and the repeats can be ruled across it */
    const outer = arcPath(BODY_OUT).replace("M", "");
    out.push('<path class="mm-body" d="' + arcPath(BODY_IN) +
             " L" + P1[0] + " " + (P1[1] + BODY_OUT) +
             " Q" + CP[0] + " " + (CP[1] + BODY_OUT) + "," + P0[0] + " " + (P0[1] + BODY_OUT) +
             ' Z"/>');
    for (let k = 1; k < 24; k++) {                       /* LRR repeats, faintly */
      const a = onCurve(k / 24);
      out.push('<line class="mm-lrr" x1="' + a[0].toFixed(1) + '" y1="' + (a[1] + BODY_IN + 1).toFixed(1) +
               '" x2="' + a[0].toFixed(1) + '" y2="' + (a[1] + BODY_OUT - 1).toFixed(1) + '"/>');
    }
    out.push('<text class="mm-glyph__lab" x="' + GW / 2 + '" y="' + (GH - 7) +
             '" text-anchor="middle">' + S("grooveLab") + "</text>");

    if (r.apo) {
      const p = slotAt(21), a = [p[0], p[1] + 26], b = [p[0] + 40, p[1] + 26];
      out.push('<text class="mm-glyph__empty" x="' + (GW / 2) + '" y="40" text-anchor="middle">' +
               S("noPeptide") + "</text>");
      out.push(bond(a, b, 1));
      out.push(anchor(a, "Phe510", "", "neutral"));
      out.push(anchor(b, "Arg487", MD_SET.apo.arg487_partner.occ4.toFixed(1) + "%", "neutral"));
      return svgWrap(out.join(""));
    }

    /* the backbone, solid where the chain exists and dashed where it was cut */
    for (let i = 1; i < SLOTS; i++) {
      const a = !!r.perRes[i], b = !!r.perRes[i + 1];
      if (i + 1 > 23 && !b) break;
      out.push('<path class="mm-chain' + (a && b ? "" : " is-cut") + '" d="M' +
               slotAt(i, r).map((v) => v.toFixed(1)).join(" ") + " L" +
               slotAt(i + 1, r).map((v) => v.toFixed(1)).join(" ") + '"/>');
    }

    /* the residues */
    for (let i = 1; i <= SLOTS; i++) {
      const at = slotAt(i, r), res = r.perRes[i];
      if (res) {
        out.push('<g class="mm-res' + (i > 23 ? " is-tag" : "") + '">' +
                   "<title>" + res.c + i + " &middot; " + res.o.toFixed(1) + "%</title>" +
                   '<circle cx="' + at[0].toFixed(1) + '" cy="' + at[1].toFixed(1) +
                     '" r="5" style="' + shade(res.o) + '"/>' +
                   '<text x="' + at[0].toFixed(1) + '" y="' + (at[1] - 9).toFixed(1) +
                     '" text-anchor="middle">' + res.c + "</text>" +
                 "</g>");
        if (r.nHip && (i === 14 || i === 22)) {
          out.push('<text class="mm-plus" x="' + (at[0] + 7).toFixed(1) + '" y="' +
                   (at[1] - 4).toFixed(1) + '">+</text>');
        }
      } else if (i <= 23) {
        out.push('<g class="mm-res is-gap"><title>' + wtLetter(i) + i + " &middot; " +
                   S("absent") + "</title>" +
                   '<circle cx="' + at[0].toFixed(1) + '" cy="' + at[1].toFixed(1) + '" r="4.6"/>' +
                   (r.ligand === "BoPep4"
                     ? '<text x="' + at[0].toFixed(1) + '" y="' + (at[1] - 9).toFixed(1) +
                       '" text-anchor="middle">' + wtLetter(i) + "</text>" : "") +
                 "</g>");
      }
    }

    /* which end is which */
    const fp = slotAt(r.first, r), lp = slotAt(r.perRes[29] ? 29 : r.last, r);
    out.push('<text class="mm-term" x="' + (fp[0] - 13).toFixed(1) + '" y="' + (fp[1] + 4).toFixed(1) +
             '" text-anchor="middle">' + S("nterm") + "</text>");
    out.push('<text class="mm-term" x="' + (lp[0] + 13).toFixed(1) + '" y="' + (lp[1] + 4).toFixed(1) +
             '" text-anchor="middle">' + S("cterm") + "</text>");

    /* Arg487 on Asn23, with as many bonds as the salt bridge actually makes */
    const n23 = slotAt(23, r), arg = [n23[0], n23[1] + 26];
    const bk = r.bident >= 80 ? 2 : r.bident >= 20 ? 1 : 0;
    const bl = r.bident >= 80 ? S("bidentLab") : r.bident >= 20 ? S("singleLab")
             : (r.oxt === false ? S("goneLab") : S("brokenLab"));
    out.push(bond(arg, n23, bk));
    out.push(anchor(arg, "Arg487", bl, bk === 2 ? "good" : bk === 1 ? "warn" : "bad"));

    /* His227 on Glu12, the pair pH 5.5 switches on */
    if (r.perRes[12] && r.glu12 !== null && r.glu12 !== undefined) {
      const e12 = slotAt(12, r), his = [e12[0], e12[1] + 26];
      const hk = r.glu12 >= 50 ? 1 : 0;
      out.push(bond(his, e12, hk));
      out.push(anchor(his, "His227" + (r.nHip ? "\u207a" : ""), r.glu12.toFixed(0) + "%",
                      hk ? "good" : "neutral"));
    }

    /* the tag, named rather than disguised as part of the peptide */
    if (r.perRes[24]) {
      const t = slotAt(26, r);
      out.push('<text class="mm-tag__lab" x="' + t[0].toFixed(1) + '" y="' + (t[1] - 21).toFixed(1) +
               '" text-anchor="middle">' + S("tagLab") + "</text>");
    }

    return svgWrap(out.join(""));
  }

  function svgWrap(inner) {
    return '<svg class="mm-glyph" viewBox="0 0 ' + GW + " " + GH +
           '" role="img" aria-label="' + (zh() ? "此軌跡的示意圖" : "Schematic of this trajectory") +
           '">' + inner + "</svg>";
  }

  function row(label, value, flag) {
    return "<li><b>" + label + '</b><span' + (flag ? ' class="is-flag"' : "") + ">" + value + "</span></li>";
  }

  function panel() {
    const el = $("#mdmap-panel");
    if (!el) return;

    if (!selected) {
      el.className = "map__panel";
      el.innerHTML =
        '<div class="map__full">' +
          '<h3 data-no-toc="true">' + S("summaryTitle") + "</h3>" +
          "<p>" + S("summaryLead") + "</p>" +
          '<p class="map__hint">' + S("totals") + "</p>" +
        "</div>" +
        '<div class="map__full map__limbs">' +
          MD_SET.branches.map((b) =>
            "<div><h4>" + esc(L(b).name) + "</h4><p>" + esc(L(b).blurb) + "</p></div>"
          ).join("") +
        "</div>";
      return;
    }

    const r = RUN[selected];
    const stats = r.apo
      ? [row(S("rmsdRec"), ang(r.rmsdRec)),
         row(S("groove"),  ang(r.groove)),
         row(S("rmsf"),    ang(r.rmsfMed)),
         row(S("gate"),    L(r.gate))]
      : [row(S("clamp"),    pct(r.clamp4)),
         row(S("bident"),   pct(r.bident),  isFlagged(r.key, "bident")),
         row(S("contacts"), one(r.ncon15)),
         row(S("rmsd15"),   ang(r.rmsd15, r.rmsd15sem), isFlagged(r.key, "rmsd15")),
         row(S("rmsdRec"),  ang(r.rmsdRec)),
         row(S("glu12"),    pct(r.glu12)),
         row(S("gate"),     L(r.gate), isFlagged(r.key, "gate"))];

    el.className = "map__panel is-run";
    el.innerHTML =
      '<div class="map__full"><button type="button" class="map__back">' + S("back") + "</button></div>" +
      /* the schematic gets the full width of the panel: at a column's width the
         residue letters stop being letters */
      '<figure class="map__glyph map__full">' + glyph(r) +
        "<figcaption>" + (r.apo ? S("glyphCapApo") : S("glyphCapPep")) + "</figcaption>" +
      "</figure>" +
      "<div>" +
        '<span class="map__role is-' + r.state + '">' + esc(L(r).role) + "</span>" +
        '<h3 data-no-toc="true">' + esc(L(r).name) + "</h3>" +
        '<p class="map__seq">' +
          (r.apo ? S("seqNone") : esc(r.seq) + " &middot; " + r.first + "&ndash;" + r.last) + "</p>" +
        "<p>" + esc(L(r).gist) + "</p>" +
        '<a class="map__open" href="' + r.href + '">' + S("open") + "</a>" +
      "</div>" +
      '<ul class="map__stats">' + stats.join("") + "</ul>";

    const back = $(".map__back", el);
    if (back) back.addEventListener("click", () => select(null));
  }

  function legend() {
    const el = $("#mdmap-legend");
    if (!el) return;
    const dot = (v, label) =>
      '<span><i style="background:' + v + '"></i>' + label + "</span>";
    el.innerHTML =
      '<div class="map__legendrow">' +
        dot("var(--leaf-500)", S("legendGood")) +
        dot("var(--amber-700)", S("legendWarn")) +
        dot("var(--rust-700)", S("legendBad")) +
        dot("var(--gray-400)", S("legendNeutral")) +
      "</div>" +
      '<p class="map__legendnote">' + S("stripLab") + "</p>";
  }

  /* ---- the index of nine ------------------------------------------------- */

  function index() {
    const el = $("#mdmap-index");
    if (!el) return;
    const out = [];
    MD_SET.branches.forEach((b) => {
      out.push('<li class="runs__group">' + esc(L(b).name) + "</li>");
      MD_SET.runs.filter((r) => r.branch === b.id).forEach((r) => {
        out.push(
          '<li class="is-' + r.state + '">' +
            '<h4><a href="' + r.href + '">' + esc(L(r).name) + "</a></h4>" +
            '<p class="runs__role">' + esc(L(r).role) + "</p>" +
            "<p>" + esc(L(r).gist) + "</p>" +
          "</li>");
      });
    });
    el.innerHTML = out.join("");
  }

  /* ---- the two generated tables ------------------------------------------ */

  function matrix() {
    const body = $("#matrix tbody");
    if (!body) return;
    body.innerHTML = MD_SET.runs.map((r) => {
      const lig  = r.apo ? S("dash") : (r.ligand === "AtPep1" ? S("ligAt") : S("ligBo"));
      const res  = r.apo ? S("dash") : r.first + "&ndash;" + r.last;
      const cterm = r.oxt === null ? S("dash") : (r.oxt ? S("cFree") : S("cTag"));
      const prot = r.nHip ? S("ph55") : S("ph7");
      /* muted means "same as the wild type", which is the only way a matrix
         this wide reads at a glance */
      const same = (v, ref) => (v === ref ? ' class="is-same"' : "");
      return "<tr><td>" + esc(L(r).name) + "</td>" +
        "<td" + same(lig, S("ligBo")) + ">" + lig + "</td>" +
        "<td" + same(res, WT.first + "&ndash;" + WT.last) + ">" + res + "</td>" +
        "<td" + same(cterm, S("cFree")) + ">" + cterm + "</td>" +
        "<td" + same(prot, S("ph7")) + ">" + prot + "</td></tr>";
    }).join("");
  }

  function numbers() {
    const body = $("#numbers tbody");
    if (!body) return;
    const cell = (v, key, field) =>
      '<td class="num' + (isFlagged(key, field) ? " is-flag" : "") + '">' + v + "</td>";
    /* short labels here, the same ones the map chips carry: eight columns of
       numbers and a full run name in the first do not both fit */
    body.innerHTML = MD_SET.runs.map((r) =>
      "<tr><td>" + esc(L(r).short) + "</td>" +
      '<td class="num">' + (r.apo ? S("dash") : r.n) + "</td>" +
      cell(pct(r.clamp4), r.key, "clamp4") +
      cell(pct(r.bident), r.key, "bident") +
      cell(one(r.ncon15), r.key, "ncon15") +
      cell(bare(r.rmsd15, r.rmsd15sem), r.key, "rmsd15") +
      cell(bare(r.rmsdRec), r.key, "rmsdRec") +
      cell(L(r.gate), r.key, "gate") +
      "</tr>").join("");
  }

  /* ---- contents rail ----------------------------------------------------- */
  /* page.js builds it from the English headings at load. After a switch the
     numbering is still right and the words are not, so relabel in place.     */
  function toc() {
    $$(".toc__list a").forEach((a) => {
      const h = document.getElementById(a.getAttribute("href").slice(1));
      if (!h) return;
      const src = $("[data-en]", h);
      if (!src) return;
      const no = (a.textContent.match(/^[\d.]+/) || [""])[0];
      a.textContent = (no ? no + " " : "") + src.textContent.trim();
    });
  }

  /* ---- wiring ------------------------------------------------------------ */

  function esc(s) {
    return String(s).replace(/&(?![#\w]+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function paint() {
    document.documentElement.lang = zh() ? "zh-Hant" : "en";
    $$("[data-en]").forEach((e) => {
      if (e.closest("#mdmap")) return;              /* the map redraws itself */
      const v = e.getAttribute(zh() ? "data-zh" : "data-en");
      if (v !== null) e.innerHTML = v;
    });
    banner();
    hero();
    drawMap();
    figTrace();
    figHeat();
    figScatter();
    figApo();
    if (selected) $$(".mm-node").forEach((g) =>
      g.classList.toggle("is-on", g.getAttribute("data-key") === selected));
    panel();
    legend();
    index();
    matrix();
    numbers();
    toc();
    const b = $("#lang");
    if (b) {
      b.textContent = zh() ? "EN" : "中";
      b.setAttribute("aria-label", zh() ? "Switch to English" : "切換為中文");
    }
  }

  const btn = $("#lang");
  if (btn) btn.addEventListener("click", () => {
    LANG = zh() ? "en" : "zh";
    try { localStorage.setItem(KEY, LANG); } catch (e) { /* nothing to do */ }
    paint();
  });

  paint();

  /* page.js builds the contents rail on DOMContentLoaded, which is after this
     file has already run once. Relabel it when it exists.                    */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", toc);
  }
})();
