/* =============================================================================
   ReLeaf: iGEM rule check  (demo wiki only)
   -----------------------------------------------------------------------------
   Marks, on the page itself, everything that would break an iGEM 2026 wiki
   rule, so whoever is editing a page can see what to fix without running
   anything. nav.js and nav-rail.js load this file on every page unless
   window.RULECHECK === false (set in assets/data/site-nav.js). The copy that
   goes to gitlab.igem.org must ship with it switched off.

   Three kinds of finding:

     BLOCKED     the page loads something from a server outside iGEM (image,
                 script, stylesheet, font, iframe, video). iGEM requires every
                 file to come from igem.wiki / igem.org; hosting elsewhere "may
                 result in no medal" (Rules & Policies, Communication).
     NOT JUDGED  a link to evidence kept on another site: GitHub, Google Drive,
                 Docs, Forms, Canva, YouTube... "Content on external sites
                 cannot be judged" (2026 Judge Handbook p.29). Citations to
                 papers, laws and databases are fine and are not flagged.
     TO FINISH   scaffold notes and status boxes still on the page.

   Plus page notes from PAGE_NOTES below, for what a scan cannot see.
   Nothing here changes content; it only draws outlines and a panel.
   ========================================================================== */
(function () {
  "use strict";
  if (window.RULECHECK === false || window.__rulecheck) return;
  window.__rulecheck = true;

  const IGEM = /(^|\.)igem\.(wiki|org)$/i;
  /* hosts where evidence lives but cannot be judged */
  const EVIDENCE = /(^|\.)(github\.io|github\.com|gitlab\.com|drive\.google\.com|docs\.google\.com|forms\.gle|sites\.google\.com|canva\.com|youtube\.com|youtu\.be|vimeo\.com|notion\.so|notion\.site|figma\.com|dropbox\.com|onedrive\.live\.com|sharepoint\.com|1drv\.ms|padlet\.com|bit\.ly)$/i;

  /* Things a scan cannot see, keyed by the page's folder. Keep each one
     short, factual and tied to a rule; delete the entry once it is fixed. */
  const PAGE_NOTES = {
    "plant": [
      ["NOT JUDGED", "In 2026 there is no Best Plant Synthetic Biology award. It became Best Alternative Platform, judged only at /alternative-platform, and that award excludes E. coli, S. cerevisiae and B. subtilis (Judge Handbook p.48, p.83). Keep this page, but do not count on it for an award."]
    ],
    "geospatial-analysis": [
      ["BLOCKED", "The interactive routing map (loaded below on click) draws its basemap from tile.openstreetmap.org and asks router.project-osrm.org for every route. Both are outside iGEM. Precompute the routes into a data file and use a basemap image hosted on static.igem.wiki."]
    ],
    "attributions": [
      ["TO FINISH", "The form iframe still points at team 0000. Team GEMS Taiwan is 6072. The 2026 template also shows attributions on the team page itself; check the current template before keeping this page."]
    ],
    "software": [
      ["NOT JUDGED", "Best Software is judged from the team's repository on gitlab.igem.org (2026/software/<team>), with an OSI licence and a README. Code kept only on GitHub is not judged."]
    ],
    "md-simulations": [
      ["NOT JUDGED", "The MD pipeline lives on github.com. If it is software the team wants credit for, it has to be on gitlab.igem.org."]
    ]
  };

  const COLORS = {
    "BLOCKED":    "#b3261e",
    "NOT JUDGED": "#9a5b00",
    "TO FINISH":  "#5b4bb3"
  };

  const findings = [];   /* {kind, text, el} */

  const hostOf = (url) => {
    try { return new URL(url, location.href).hostname; } catch (e) { return ""; }
  };
  const external = (url) => {
    if (!url || /^(data|blob|javascript|mailto|tel):/i.test(url)) return false;
    const h = hostOf(url);
    return !!h && h !== location.hostname && !IGEM.test(h);
  };
  const short = (url) => {
    try { const u = new URL(url, location.href); return u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 28) + (u.pathname.length > 28 ? "…" : "") : ""); }
    catch (e) { return url.slice(0, 40); }
  };
  const visible = (el) => !!(el && (el.offsetParent || el.getClientRects().length));
  const add = (kind, text, el) => findings.push({ kind, text, el: el || null });

  function scan() {
    /* 1. resources from outside iGEM */
    const seen = new Set();
    document.querySelectorAll("img[src], script[src], iframe[src], video[src], video[poster], audio[src], source[src], source[srcset], embed[src], object[data], link[href]").forEach((el) => {
      if (el.closest(".rulecheck")) return;
      if (el.tagName === "LINK" && !/stylesheet|preload|icon|modulepreload/i.test(el.rel)) return;
      const url = el.getAttribute("src") || el.getAttribute("poster") || el.getAttribute("data") ||
                  (el.getAttribute("srcset") || "").split(/[\s,]+/)[0] || el.getAttribute("href");
      if (!external(url) || seen.has(url)) return;
      seen.add(url);
      const what = { IMG: "image", SCRIPT: "script", IFRAME: "embedded page", LINK: "stylesheet or font", VIDEO: "video", SOURCE: "media", AUDIO: "audio" }[el.tagName] || "file";
      const target = el.tagName === "SOURCE" ? el.parentElement : el;
      add("BLOCKED", "Loads a " + what + " from " + short(url) + ". Host it on static.igem.wiki (video: video.igem.org).", visible(target) ? target : null);
    });
    /* fonts pulled in through a stylesheet that was itself local */
    try {
      [...document.styleSheets].forEach((ss) => {
        let rules; try { rules = ss.cssRules; } catch (e) { return; }
        [...rules].forEach((r) => {
          if (r.type === CSSRule.IMPORT_RULE && external(r.href)) add("BLOCKED", "A stylesheet imports " + short(r.href) + ".", null);
          if (r.type === CSSRule.FONT_FACE_RULE) {
            const m = (r.style.getPropertyValue("src") || "").match(/url\(["']?([^"')]+)/);
            if (m && external(m[1])) add("BLOCKED", "A font is downloaded from " + short(m[1]) + ".", null);
          }
        });
      });
    } catch (e) { /* cross-origin sheets are already reported above */ }

    /* 2. evidence links to sites that cannot be judged */
    const linked = new Map();
    document.querySelectorAll("a[href]").forEach((a) => {
      if (a.closest(".rulecheck, .refs, footer, .footer2, .legal")) return;
      const h = hostOf(a.getAttribute("href"));
      if (!h || !EVIDENCE.test(h)) return;
      if (/(^|\.)gitlab\.igem\.org$/i.test(h)) return;
      const key = a.href;
      if (linked.has(key)) return;
      linked.set(key, a);
      add("NOT JUDGED", "Links to " + short(a.href) + ". Judges only score what is on the wiki itself: bring this content onto a wiki page (and its files onto static.igem.wiki or video.igem.org).", visible(a) ? a : null);
    });

    /* 3. unfinished markers */
    const sc = [...document.querySelectorAll("p.scaffold, .scaffold")].filter(visible);
    if (sc.length) add("TO FINISH", sc.length + " scaffold note" + (sc.length > 1 ? "s" : "") + " still on the page. Replace each with real prose or delete it.", sc[0]);
    const st = [...document.querySelectorAll(".status")].filter(visible);
    if (st.length) add("TO FINISH", "The grey status box is still on the page. Delete it when the page is final.", st[0]);
    const pend = [...document.querySelectorAll(".fig--pending, .frame.empty")].filter(visible);
    if (pend.length) add("TO FINISH", pend.length + " figure placeholder" + (pend.length > 1 ? "s" : "") + " with no figure yet.", pend[0]);
    const chips = [...document.querySelectorAll(".pending")].filter(visible);
    if (chips.length) add("TO FINISH", chips.length + " pending value" + (chips.length > 1 ? "s" : "") + " (the marked chips) still waiting for a measured number or a decision.", chips[0]);
    const open = [...document.querySelectorAll(".openitem")].filter(visible);
    if (open.length) add("TO FINISH", open.length + " open item" + (open.length > 1 ? "s" : "") + " still listed as unresolved.", open[0]);

    /* 4. notes for this page */
    const slug = (document.querySelector("#site-nav, #nav-rail") || {}).dataset
      ? (document.querySelector("#site-nav, #nav-rail").dataset.page || "") : "";
    (PAGE_NOTES[slug] || []).forEach(([kind, text]) => add(kind, text, null));
  }

  /* ---- drawing ------------------------------------------------------------ */

  function css() {
    const s = document.createElement("style");
    s.textContent = `
.rc-mark { outline: 3px dashed var(--rc) !important; outline-offset: 3px; position: relative; }
.rc-tag { position: absolute; z-index: 60; transform: translateY(-100%); margin-top: -6px;
  font: 700 11px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .04em;
  color: #fff; background: var(--rc); padding: 3px 7px; border-radius: 4px; pointer-events: none;
  white-space: nowrap; box-shadow: 0 2px 6px rgb(0 0 0 / .2); }
.rulecheck { position: fixed; right: 16px; bottom: 16px; z-index: 900; max-width: min(420px, calc(100vw - 32px));
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d1d1f; }
.rulecheck__btn { display: flex; align-items: center; gap: 8px; margin-left: auto; border: 0; cursor: pointer;
  background: #b3261e; color: #fff; font: inherit; font-weight: 700; padding: 10px 14px; border-radius: 999px;
  box-shadow: 0 6px 20px rgb(0 0 0 / .25); }
.rulecheck__btn[data-ok] { background: #23684a; }
.rulecheck__btn:focus-visible { outline: 3px solid #1d1d1f; outline-offset: 2px; }
.rulecheck__panel { margin-bottom: 10px; background: #fff; border: 1px solid #e3e3e3; border-radius: 12px;
  box-shadow: 0 12px 40px rgb(0 0 0 / .22); max-height: min(60vh, 520px); overflow: auto; }
.rulecheck__panel[hidden] { display: none; }
.rulecheck__head { padding: 14px 16px 10px; border-bottom: 1px solid #eee; }
.rulecheck__head b { display: block; font-size: 15px; }
.rulecheck__head span { color: #555; font-size: 12.5px; }
.rulecheck__list { list-style: none; margin: 0; padding: 6px 0; }
.rulecheck__list li { padding: 8px 16px; border-left: 4px solid var(--rc); margin: 4px 0; }
.rulecheck__list li[data-go] { cursor: pointer; }
.rulecheck__list li[data-go]:hover, .rulecheck__list li[data-go]:focus-visible { background: #f6f6f6; outline: none; }
.rulecheck__kind { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .06em; color: var(--rc); margin-right: 6px; }
.rulecheck__foot { padding: 10px 16px 14px; border-top: 1px solid #eee; font-size: 12px; color: #555; }
.rulecheck__foot button { font: inherit; color: #23684a; background: none; border: 0; padding: 0; text-decoration: underline; cursor: pointer; }
.rc-hidden .rc-mark { outline: none !important; }
.rc-hidden .rc-tag { display: none; }
@media print { .rulecheck, .rc-tag { display: none !important; } .rc-mark { outline: none !important; } }`;
    document.head.appendChild(s);
  }

  function draw() {
    css();
    const hidden = (() => { try { return localStorage.getItem("rulecheck-marks") === "off"; } catch (e) { return false; } })();
    if (hidden) document.documentElement.classList.add("rc-hidden");

    /* outline each element and pin a label above it */
    findings.forEach((f) => {
      if (!f.el) return;
      const el = /^(IMG|IFRAME|VIDEO|EMBED|OBJECT)$/.test(f.el.tagName) && f.el.parentElement ? f.el.parentElement : f.el;
      el.classList.add("rc-mark");
      el.style.setProperty("--rc", COLORS[f.kind]);
      if (!el.querySelector(":scope > .rc-tag")) {
        const tag = document.createElement("span");
        tag.className = "rc-tag";
        tag.style.setProperty("--rc", COLORS[f.kind]);
        tag.textContent = "iGEM rule: " + f.kind.toLowerCase();
        tag.setAttribute("aria-hidden", "true");
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
        el.prepend(tag);
      }
      f.target = el;
    });

    const box = document.createElement("div");
    box.className = "rulecheck";
    const n = findings.length;
    const counts = Object.keys(COLORS).map((k) => [k, findings.filter((f) => f.kind === k).length]).filter(([, c]) => c);
    box.innerHTML =
      '<div class="rulecheck__panel" id="rulecheck-panel" hidden role="region" aria-label="iGEM rule check">' +
        '<div class="rulecheck__head"><b></b><span>Demo wiki only: shows what would break the iGEM 2026 wiki rules on this page. Click an item to jump to it.</span></div>' +
        '<ul class="rulecheck__list"></ul>' +
        '<div class="rulecheck__foot">Rules: 2026 Judge Handbook p.29 (standard pages, external content), Rules &amp; Policies (iGEM servers only). ' +
          '<button type="button" class="rc-toggle"></button></div>' +
      "</div>" +
      '<button type="button" class="rulecheck__btn" aria-expanded="false" aria-controls="rulecheck-panel"></button>';
    const btn = box.querySelector(".rulecheck__btn");
    const panel = box.querySelector(".rulecheck__panel");
    btn.textContent = n ? "⚠ iGEM rule check · " + n : "✓ iGEM rule check · clear";
    if (!n) btn.dataset.ok = "";
    box.querySelector(".rulecheck__head b").textContent = n
      ? n + " issue" + (n > 1 ? "s" : "") + " on this page: " + counts.map(([k, c]) => c + " " + k.toLowerCase()).join(", ")
      : "Nothing on this page breaks the checked rules.";
    const list = box.querySelector(".rulecheck__list");
    findings.forEach((f) => {
      const li = document.createElement("li");
      li.style.setProperty("--rc", COLORS[f.kind]);
      const k = document.createElement("span");
      k.className = "rulecheck__kind";
      k.textContent = f.kind;
      li.append(k, document.createTextNode(f.text));
      if (f.target) {
        li.dataset.go = "";
        li.tabIndex = 0;
        const go = () => { f.target.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
        li.addEventListener("click", go);
        li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      }
      list.appendChild(li);
    });
    const tog = box.querySelector(".rc-toggle");
    const label = () => { tog.textContent = document.documentElement.classList.contains("rc-hidden") ? "Show outlines on the page" : "Hide outlines on the page"; };
    label();
    tog.addEventListener("click", () => {
      const off = document.documentElement.classList.toggle("rc-hidden");
      try { localStorage.setItem("rulecheck-marks", off ? "off" : "on"); } catch (e) { /* private mode */ }
      label();
    });
    btn.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); }
    });
    document.body.appendChild(box);
  }

  const run = () => { scan(); draw(); };
  /* after load, so images and iframes the page adds itself are in the DOM */
  if (document.readyState === "complete") setTimeout(run, 0);
  else window.addEventListener("load", () => setTimeout(run, 0));
})();
