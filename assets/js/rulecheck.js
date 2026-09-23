/* =============================================================================
   ReLeaf: iGEM rule check  (demo wiki only)
   -----------------------------------------------------------------------------
   Marks, on the page itself, everything that would break an iGEM 2026 wiki
   rule, so whoever is editing a page can see what to fix without running
   anything. nav.js and nav-rail.js load this file on every page unless
   window.RULECHECK === false (set in assets/data/site-nav.js). The copy that
   goes to gitlab.igem.org must ship with it switched off.

   Two kinds of finding:

     BLOCKED     the page loads something from a server outside iGEM (image,
                 script, stylesheet, font, iframe, video). iGEM requires every
                 file to come from igem.wiki / igem.org; hosting elsewhere "may
                 result in no medal" (Rules & Policies, Communication).
     TO FINISH   scaffold notes, status boxes, placeholders, pending values
                 and open items still on the page.

   Links out to other sites are deliberately not flagged: the team will point
   them at its official iGEM pages itself.

   Plus page notes from PAGE_NOTES below, for what a scan cannot see.
   Nothing here changes content; it only draws outlines and a panel.
   ========================================================================== */
(function () {
  "use strict";
  if (window.RULECHECK === false || window.__rulecheck) return;
  window.__rulecheck = true;

  const IGEM = /(^|\.)igem\.(wiki|org)$/i;

  /* Things a scan cannot see, keyed by the page's folder. Keep each one
     short, factual and tied to a rule; delete the entry once it is fixed. */
  const PAGE_NOTES = {
    "geospatial-analysis": [
      ["BLOCKED", "The interactive routing map (loaded below on click) draws its basemap from tile.openstreetmap.org and asks router.project-osrm.org for every route. Both are outside iGEM. Precompute the routes into a data file and use a basemap image hosted on static.igem.wiki."]
    ],
    "attributions": [
      ["TO FINISH", "The form iframe still points at team 0000. Team GEMS Taiwan is 6072. The 2026 template also shows attributions on the team page itself; check the current template before keeping this page."]
    ]
  };

  const COLORS = {
    "BLOCKED":    "#b3261e",
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

    /* 2. unfinished markers */
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

    /* 3. notes for this page */
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
.rulecheck { position: fixed; left: 16px; bottom: 16px; z-index: 900; max-width: min(420px, calc(100vw - 32px));
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d1d1f; }
.rulecheck__btn { display: flex; align-items: center; gap: 8px; margin-right: auto; border: 0; cursor: pointer;
  background: #b3261e; color: #fff; font: inherit; font-weight: 700; padding: 7px 12px; min-width: 38px; justify-content: center; border-radius: 999px; opacity: .92;
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
.rc-hidden .rc-mark.rc-flash { outline: 3px dashed var(--rc) !important; }
/* bottom-left: bottom-right is where the pages keep their own controls (the
   hardware film's pause button); clear the Bioreactor Calculations rail */
body:has(aside.rail) .rulecheck { left: 64px; }
@media print { .rulecheck, .rc-tag { display: none !important; } .rc-mark { outline: none !important; } }`;
    document.head.appendChild(s);
  }

  function draw() {
    css();
    /* Outlines are off unless the viewer turns them on: the page should read
       as the page, and the button in the corner already says how many issues
       there are. The choice is remembered per browser. */
    const hidden = (() => { try { return localStorage.getItem("rulecheck-outlines") !== "on"; } catch (e) { return true; } })();
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
        '<div class="rulecheck__foot">Rule: every file must load from iGEM servers (Rules &amp; Policies). ' +
          '<button type="button" class="rc-toggle"></button></div>' +
      "</div>" +
      '<button type="button" class="rulecheck__btn" aria-expanded="false" aria-controls="rulecheck-panel"></button>';
    const btn = box.querySelector(".rulecheck__btn");
    const panel = box.querySelector(".rulecheck__panel");
    /* compact, so it hides as little of the page as possible; the words are
       in its label and tooltip, and in the panel it opens */
    btn.textContent = n ? "⚠ " + n : "✓";
    btn.title = n ? "iGEM rule check: " + n + " issue" + (n > 1 ? "s" : "") + " on this page" : "iGEM rule check: clear";
    btn.setAttribute("aria-label", btn.title);
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
        /* jump to it, and outline it for a moment even when outlines are off */
        const go = () => {
          f.target.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          f.target.classList.add("rc-flash");
          setTimeout(() => f.target.classList.remove("rc-flash"), 2500);
        };
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
      try { localStorage.setItem("rulecheck-outlines", off ? "off" : "on"); } catch (e) { /* private mode */ }
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
