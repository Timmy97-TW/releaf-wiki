/* v10: the notebook (pdfnb.html, pn.css). Round 28, revised after the judges' rounds 1 and 2 (coordinator's D1-D4,
   R2-1-R2-4).

   The pages. The notebook's 62 pages in a scroll box of their own, as wide as the box (up to 1.4 times their size).
   Vector pages (pages-svg/pNN.svg, from the same PDF; the folder is v10/pages-url) wherever a page is drawn larger than
   its PNG (hardware/notebook/pages/pNN.png, 935 px), at any screen density; the PNG elsewhere and if an SVG fails.
   Pages load as they come near, never all at once. The contents mark the entry on screen; a pick glides the box to
   its page. The one PDF action, "Open the PDF · p. N", follows the page on screen.

   The wheel (R2-1). The box takes the wheel once the reader has arrived; then the pointer in the box turns the pages,
   no click needed:
     1. coming down onto the notebook and coming to rest (QUIET, 0.35 s) with the section's top up to a fifth of a
        screen (at least 180 px) short of its place, the pointer on the pages (or nowhere known): it glides in, and the box has the wheel the
        moment it lands. Never when the section's top is past its place; any input during the glide abandons it;
     2. at the hub's end (the footer), where the box's top is cut: a wheel-down over the pages that starts a gesture of
        its own, or a click in them, hands it the wheel where it is (the hub cannot move down: nothing is trapped).
        Not the notches or the momentum that carried the hub there, and not a pointer move alone;
     3. otherwise (stopped past its place, or coming up from the footer: never a glide, never a hand-over at rest) it
        takes the wheel when the pointer moves 8 px in the box once the hub is still, on a click or touch in it, on a
        pick in the contents, or on focus;
     4. it lets go once the hub has moved 24 px from where the box took the wheel, or the section has left the screen;
        at its first or last page the browser's own scroll chaining carries the wheel on to the hub.
   The contents never take the wheel: they fit their column (pn.css 4), and scroll their own list only on a screen too
   short even for the week chips, and only while the box has the wheel.

   ?viewer=native shows the PDF in the browser's own viewer instead (round 27's way: a pick opens the PDF afresh at its
   page in a second frame under the first), under the same rules. That viewer tells the page nothing, so there the
   contents mark only the entry picked.

   Narrower than 900 px the pages would be too small to read: the cover, the button, and the contents as links that
   open the PDF at their page (pn-noview), which is also what every link does without this script. */
(function () {
  "use strict";
  var sec = document.querySelector(".pn");
  if (!sec) return;
  var pdf = sec.getAttribute("data-pdf"), png = sec.getAttribute("data-pages") || "", svg = sec.getAttribute("data-svg") || "";
  var N = +sec.getAttribute("data-n") || 0;
  var svgSkip = (sec.getAttribute("data-svg-skip") || "").split(",").filter(Boolean).map(Number);
  var frame = sec.querySelector(".pn-frame"), view = sec.querySelector(".pn-view"), rail = sec.querySelector(".pn-rail");
  var toc = sec.querySelector(".pn-toc"), det = sec.querySelector(".pn-det");
  var links = Array.prototype.slice.call(sec.querySelectorAll(".pn-list .pn-e[data-page]"));
  var wlinks = Array.prototype.slice.call(sec.querySelectorAll(".pn-weeks .pn-wa[data-page]"));
  // full titles on hover, for the packed one-line form (pn-one)
  wlinks.forEach(function (x) { var t = x.getAttribute("data-titles"); if (t && !x.title) x.title = t.split("|").join(" \u00b7 "); });
  var openA = sec.querySelector(".pn-open"), openP = sec.querySelector(".pn-open-p");
  var nowW = sec.querySelector(".pn-now-w"), nowT = sec.querySelector(".pn-now-t");
  if (!pdf || !frame || !N || !links.length) return;
  var firsts = links.map(function (a) { return +a.getAttribute("data-page"); });
  var titles = links.map(function (a) { var t = a.querySelector(".pn-t"); return t ? t.textContent : ""; });
  var colours = links.map(function (a) { return a.parentNode.style.getPropertyValue("--mk") || ""; });
  var weekNo = links.map(function (a) { var w = a.querySelector(".pn-wk"); return w ? w.textContent.replace(/\D/g, "") : ""; });
  var weekOf = {};                                         // an entry's first page -> its week's row
  wlinks.forEach(function (w) {
    (w.getAttribute("data-pages") || w.getAttribute("data-page")).split(",").forEach(function (p) { weekOf[+p] = w; });
  });

  // reader mode (data-reader; promote.py PDF_LIVE = "reader", 9 Oct 2026): the PDF is not deployed, so the one action
  // opens the notebook's reader page (notebook/) at the entry on screen, and there is no native PDF viewer
  var reader = sec.hasAttribute("data-reader");
  function readerHref(n) {
    var best = null;
    links.forEach(function (a) { if (+a.getAttribute("data-page") <= n) best = a; });
    return best ? best.getAttribute("href") : pdf;
  }
  var native = !reader && /[?&]viewer=native(&|$)/.test(location.search);
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: null }; };
  var mid = mq("(min-width: 900px)"), touchOnly = mq("(hover: none) and (pointer: coarse)");
  var reduce = mq("(prefers-reduced-motion: reduce)");
  function inline() {
    if (!mid.matches) return false;
    return !native || (!touchOnly.matches && navigator.pdfViewerEnabled !== false);
  }
  sec.classList.toggle("pn-native", native);
  sec.__pn = { jumps: 0, native: native };                // for v10/check.py and the notebook's tests

  // ---- the layout (R2-2): under 1180 px wide, the strip (the pages full width under the week chips); wider, the
  // column, unless it would draw the pages under 0.88 of their size on a window 760 px tall or more ----------------------
  var STRIP_BELOW = 0.88, STRIP_MIN_H = 760;
  var listShown = false;
  function pageScale() {                                   // what the box draws a page at, as laid out now
    var ol = frame.firstChild, pad = ol && ol.nodeType === 1 ? parseFloat(getComputedStyle(ol).paddingLeft) || 0 : 18;
    return Math.min(1.4, (frame.clientWidth - 2 * pad) / 935);
  }
  function mode() {
    var inl = inline();
    sec.classList.toggle("pn-noview", !inl);
    sec.classList.remove("pn-strip", "pn-slim");
    // the column's wider contents (from 1400 px) only where the pages still get 0.88 of their size
    if (inl && pageScale() < STRIP_BELOW) sec.classList.add("pn-slim");
    // under 1180 px wide the strip always (round 1, QA #5); wider, by the scale the column would give
    if (inl && (window.innerWidth < 1180 || (!native && window.innerHeight >= STRIP_MIN_H && pageScale() < STRIP_BELOW))) sec.classList.add("pn-strip");
    if (det) {
      if (inl) det.open = true;                            // the column and the strip show the contents, always
      else if (!listShown) det.open = false;               // the list layout: closed, until the reader opens it
    }
    listShown = !inl;
    fit();
    sources();
  }

  // ---- the contents: always whole, no word cut (R2-1.4, R2-4) ----------------------------------------------------
  // The first of these that fits the column with every title whole: every entry, its title on up to two lines; every
  // entry, a line each; a row per week (its entries as dots), the title of the entry on screen on up to two lines;
  // the week chips, with the title of the entry on screen under them. Under ~560 px tall even the chips may not fit:
  // they scroll in their column, only while the box has the wheel (pn.css).
  var FORMS = [["pn-full", "pn-two"], ["pn-full"], ["pn-two"], [], ["pn-one"]];  // owner, 8 Oct: always a vertical list, never chips
  function whole() {
    if (toc.scrollHeight > toc.clientHeight + 1) return false;
    var rows = toc.querySelectorAll(toc.classList.contains("pn-full") ? ".pn-list .pn-t" : ".pn-weeks .pn-t");
    for (var k = 0; k < rows.length; k++) {
      var t = rows[k];
      if (!t.offsetWidth) continue;
      var lh = parseFloat(getComputedStyle(t).lineHeight) || 17;
      var lines = Math.round(t.getBoundingClientRect().height / lh);
      if (lines > (toc.classList.contains("pn-two") ? 2 : 1) || t.scrollWidth > t.clientWidth + 1) return false;
    }
    return true;
  }
  function fit() {
    if (!toc) return;
    toc.classList.remove("pn-full", "pn-two", "pn-chips", "pn-one", "pn-tight");
    if (!inline() || sec.classList.contains("pn-strip")) return;
    // the forms that take a week's title on one line are measured with the longest title in each row
    var saved = wlinks.map(function (x) { var t = x.querySelector(".pn-t"); return t ? t.textContent : ""; });
    wlinks.forEach(function (x) {
      var t = x.querySelector(".pn-t"), all = (x.getAttribute("data-titles") || "").split("|");
      if (t && all.length > 1) t.textContent = all.reduce(function (a, b) { return b.length > a.length ? b : a; });
    });
    var k;
    for (k = 0; k < FORMS.length; k++) {
      toc.classList.remove("pn-full", "pn-two", "pn-chips", "pn-one");
      FORMS[k].forEach(function (c) { toc.classList.add(c); });
      if (k === FORMS.length - 1 || whole()) break;
    }
    wlinks.forEach(function (x, j) { var t = x.querySelector(".pn-t"); if (t) t.textContent = saved[j]; });
    if (toc.scrollHeight > toc.clientHeight + 1) toc.classList.add("pn-tight");
    if (cur >= 0) keep(cur);
  }

  // ---- the entry on screen ------------------------------------------------------------------------------------------
  var cur = -1;
  function entryAt(n) {                                    // the last entry starting at or before page n
    var i = 0;
    while (i + 1 < firsts.length && firsts[i + 1] <= n) i++;
    return i;
  }
  function mark(i) {
    if (i === cur) return;
    cur = i;
    var p = firsts[i], w = weekOf[p];
    links.forEach(function (x, k) { if (k === i) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
    wlinks.forEach(function (x) {
      var t = x.querySelector(".pn-t"), first = (x.getAttribute("data-titles") || "").split("|")[0];
      if (x === w) {
        x.setAttribute("aria-current", "true");
        if (t && x.getAttribute("data-titles")) t.textContent = titles[i];    // the week's row shows the entry on screen
      } else {
        x.removeAttribute("aria-current");
        if (t && first) t.textContent = first;
      }
      Array.prototype.forEach.call(x.querySelectorAll(".pn-dots i"), function (d) { d.classList.toggle("on", x === w && +d.getAttribute("data-page") === p); });
    });
    if (nowW) nowW.textContent = weekNo[i] ? "Week " + weekNo[i] : "";
    if (nowT) nowT.textContent = titles[i];
    if (colours[i]) sec.style.setProperty("--pn-cur", colours[i]); else sec.style.removeProperty("--pn-cur");
    keep(i);
  }
  // in a column that scrolls (pn-tight only), keep the marked row in view: the column's own scroll, never the page's
  function keep(i) {
    if (!toc || !toc.classList.contains("pn-tight")) return;
    var a = weekOf[firsts[i]] || links[i];
    var t = a.offsetTop, b = t + a.offsetHeight, top = toc.scrollTop, h = toc.clientHeight;
    if (t >= top && b <= top + h) return;
    toc.scrollTop = Math.max(0, t - h * 0.3);
  }
  // the PDF action follows the page on screen
  var openN = 0;
  function here(n) {
    if (!openA || n === openN) return;
    openN = n;
    openA.href = reader ? readerHref(n) : pdf + "#page=" + n;
    if (openP) openP.textContent = "· p. " + n;
    openA.setAttribute("aria-label", (reader ? "Open the notebook at page " : "Open the PDF at page ") + n + " (a new tab)");
  }

  // ---- the wheel (R2-1) -----------------------------------------------------------------------------------------------
  var QUIET = 350, REACH = 0.2, REACH_MIN = 180, LET_GO = 24;
  var held = false, placed = false, live = false, rest = false, sure = false, engageY = 0, placing = false, placeT = 0;
  var restT = 0, lastY = window.scrollY, dir = 0, moved = 0, lastPt = null, ptIn = null, gliding = false, glideT = 0, endT = 0;
  function atEnd() { return window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1; }
  // on screen: no more than 8 % of a screen of the box cut off at either edge (the wiki's navbar may cover the top
  // 56 px); a box taller than the screen, once it covers it
  function inPlace() {
    var r = frame.getBoundingClientRect(), vh = window.innerHeight;
    if (!r.height) return false;
    var tol = Math.max(24, vh * 0.08);
    return r.height > vh ? (r.top <= tol && r.bottom >= vh - tol)
                         : (Math.max(0, -r.top) <= tol && Math.max(0, r.bottom - vh) <= tol);
  }
  // at the hub's end, with at least half the box on screen
  function endHeld() {
    if (!atEnd()) return false;
    var r = frame.getBoundingClientRect();
    return r.height > 0 && Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0) >= r.height * 0.5;
  }
  function measure() {
    placed = inline() && inPlace();
    var on = placed || (inline() && endHeld());
    if (on !== held) { held = on; sec.classList.toggle("pn-held", on); }
    if (!held && !placing) sure = false;                   // gone from the screen: the next arrival starts afresh
    apply();
  }
  function apply() {
    var l = held && sure;
    if (l === live) return;
    live = l;
    sec.classList.toggle("pn-in", l);
    railAt();
  }
  function engage(y) { sure = true; engageY = y; measure(); }
  function secTop() { return sec.getBoundingClientRect().top; }
  // the pointer on the pages? (true, false, or null: no pointer seen, as on touch or the keyboard)
  function pointerOnPages() {
    if (!lastPt) return ptIn;
    var r = frame.getBoundingClientRect();
    return lastPt[2] >= r.left && lastPt[2] <= r.right && lastPt[3] >= r.top && lastPt[3] <= r.bottom;
  }
  function reachable(t) { return dir > 0 && t > -1 && t <= Math.max(REACH * window.innerHeight, REACH_MIN); }
  function atRest() {
    rest = true;
    measure();
    if (sure || !inline()) return;
    var t = secTop();
    if (reachable(t) && pointerOnPages() !== false) {     // 1. came down onto it, stopped short of (or at) its place
      if (t > 1 && !reduce.matches) glideIn(t); else engage(window.scrollY);
    } else if (dir === 0 && Math.abs(t) < 2) engage(window.scrollY);   // opened at #notebook
  }
  // The glide in: drawn here, frame by frame (0.16-0.26 s, easing out), not the browser's smooth scroll, so it is short
  // enough to land before a reader's next flick, and an input stops it before its next frame: the input then counts in
  // full (a programmatic smooth scroll made Chromium drop the notch that met it). "instant": the hub's html has
  // scroll-behavior: smooth.
  var glideRaf = 0;
  function glideIn(t) {
    var y0 = window.scrollY, y1 = Math.round(y0 + t), d = y1 - y0, t0 = performance.now();
    var dur = Math.max(160, Math.min(260, 140 + Math.abs(d) * 0.6));
    gliding = true; clearTimeout(glideT); cancelAnimationFrame(glideRaf);
    glideT = setTimeout(landed, dur + 400);                 // an engine that holds back frames still lands
    (function step(now) {
      if (!gliding) return;
      // a frame's time can be a little before t0 (it is the frame's start): never a step back
      var k = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
      window.scrollTo({ top: Math.round(y0 + d * e), behavior: "instant" });
      if (k < 1) glideRaf = requestAnimationFrame(step); else landed();
    })(t0);
  }
  function landed() {
    if (!gliding) return;
    gliding = false; clearTimeout(glideT); cancelAnimationFrame(glideRaf);
    var t = secTop();
    if (Math.abs(t) >= 0.5 && Math.abs(t) < 40) window.scrollTo({ top: Math.round(window.scrollY + t), behavior: "instant" });
    lastY = window.scrollY;
    engage(window.scrollY);                                // the glide and the hand-over are one moment
  }
  function abandon() {
    if (!gliding) return;
    gliding = false; clearTimeout(glideT); cancelAnimationFrame(glideRaf);
  }
  ["wheel", "touchstart"].forEach(function (k) { window.addEventListener(k, abandon, { capture: true, passive: true }); });
  ["keydown", "pointerdown"].forEach(function (t) { window.addEventListener(t, abandon, { capture: true, passive: true }); });

  var idle = 0;
  function onScroll() {
    var y = window.scrollY;
    if (Math.abs(y - lastY) > 0.5) { if (!gliding) dir = y > lastY ? 1 : -1; lastY = y; }
    if (!gliding) { rest = false; moved = 0; clearTimeout(restT); restT = setTimeout(atRest, QUIET); }
    if (atEnd()) { if (!endT) endT = performance.now(); } else endT = 0;
    // 4. let go once the hub has moved away from where the box took the wheel
    if (sure && !placing && !gliding && Math.abs(y - engageY) > LET_GO) sure = false;
    measure();
    backCheck();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  if ("onscrollend" in window) window.addEventListener("scrollend", function () {
    if (placing) { placing = false; clearTimeout(placeT); engageY = window.scrollY; }
  });
  window.addEventListener("resize", function () {
    clearTimeout(idle);
    idle = setTimeout(function () { mode(); measure(); railAt(); maybeLoad(); backCheck(); }, 60);
  });
  [mid, touchOnly].forEach(function (m) { if (m.addEventListener) m.addEventListener("change", function () { mode(); measure(); maybeLoad(); }); });
  restT = setTimeout(atRest, QUIET);

  // where the pointer is (client coordinates for "on the pages"; screen coordinates for "moved": a scroll under a
  // still pointer moves nothing there)
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var pt = [e.screenX, e.screenY, e.clientX, e.clientY];
    var inBox = frame.contains(e.target) || view === e.target;
    // 3. the pointer moving in the box once the hub is still
    if (inBox && lastPt && rest && !sure && inline()) {
      moved += Math.abs(pt[0] - lastPt[0]) + Math.abs(pt[1] - lastPt[1]);
      if (moved >= 8) {
        var t = secTop();
        if (placed && !(atEnd() && t < -2)) engage(window.scrollY);   // not at the footer (2.)
        else if (reachable(t) && !reduce.matches) glideIn(t);          // short of its place, coming down: 1.
      }
    }
    if (!inBox) moved = 0;
    lastPt = pt;
  }, { passive: true });
  // a click or touch in the box: 3., and 2. at the footer
  view.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "touch") ptIn = true;
    if (!inline() || sure) return;
    if ((placed && rest) || endHeld()) engage(window.scrollY);
  }, { passive: true });
  // 2. at the footer, a wheel-down over the pages that starts a gesture of its own (the wheel quiet for 400 ms before
  // it: not the rest of the notches or the momentum that carried the hub there): the box takes it (the hub cannot
  // move down), this notch included
  var wheelT = 0;
  window.addEventListener("wheel", function (e) {
    var t = performance.now(), fresh = t - wheelT > 400;
    wheelT = t;
    // the hub at its end for 400 ms already: not the notch that took it there (the browser may have applied that one
    // before this listener runs)
    if (!fresh || !endT || t - endT < 400) return;
    if (live || !inline() || native || e.deltaY <= 0 || e.ctrlKey || !view.contains(e.target) || !endHeld()) return;
    engage(window.scrollY);
    frame.scrollTop += e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1);
  }, { capture: true, passive: true });

  // bring the section to its place on screen (a pick in the contents, the skip link, focus in the box)
  function place(instant) {
    var s = secTop(), target = Math.round(window.scrollY + s);
    engageY = target;
    if (Math.abs(s) < 2) return;
    if (instant || reduce.matches) { window.scrollTo({ top: target, behavior: "instant" }); return; }
    placing = true; clearTimeout(placeT);
    placeT = setTimeout(function () { placing = false; engageY = window.scrollY; }, 1000);
    window.scrollTo({ top: target, behavior: "smooth" });
  }

  // ---- the rail: the box has the wheel, and where the notebook is in it ------------------------------------------
  function railAt() {
    if (!rail || native) return;
    var h = frame.clientHeight, sh = frame.scrollHeight, inset = 12, avail = h - 2 * inset;
    if (!h || !sh) return;
    var th = Math.max(28, avail * h / sh), f = frame.scrollTop / Math.max(1, sh - h);
    rail.style.height = Math.round(th) + "px";
    rail.style.transform = "translateY(" + Math.round(inset + (avail - th) * f) + "px)";
  }

  // ---- the pages ------------------------------------------------------------------------------------------------------
  var pages = [], near = false, gl = 0, glT = 0, gap = 0, glideTo = 0, glideN = 0, vec = null;
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  // vector wherever a page is drawn larger than its PNG (R2-2): its width in device pixels over 935
  function wantVector() {
    var w = pages.length ? pages[0].li.getBoundingClientRect().width : 0;
    return !!svg && w * (window.devicePixelRatio || 1) > 936;
  }
  function srcOf(n) {
    return vec && svgSkip.indexOf(n) < 0 ? svg + "p" + pad2(n) + ".svg" : png + "p" + pad2(n) + ".png";
  }
  function sources() {
    if (native || !pages.length) return;
    var v = wantVector();
    if (v === vec) return;
    vec = v;
    pages.forEach(function (p, k) { if (p.img.getAttribute("src")) p.img.src = srcOf(k + 1); });
  }
  function build() {
    var ol = document.createElement("ol");
    ol.className = "pn-pages";
    for (var n = 1; n <= N; n++) {
      var li = document.createElement("li"), img = document.createElement("img");
      li.className = "pn-pg";
      img.alt = "Page " + n + " of " + N; img.width = 935; img.height = 1210; img.decoding = "async"; img.draggable = false;
      img.addEventListener("error", function () {          // an SVG that fails: its PNG
        var s = this.getAttribute("src") || "";
        if (/\.svg$/.test(s)) this.src = png + s.slice(s.lastIndexOf("/") + 1).replace(/\.svg$/, ".png");
      });
      li.appendChild(img); ol.appendChild(li);
      pages.push({ li: li, img: img });
    }
    frame.appendChild(ol);
    gap = parseFloat(getComputedStyle(ol).rowGap) || 0;
  }
  function load(n) {
    var p = pages[n - 1];
    if (vec === null) sources();
    if (p && !p.img.getAttribute("src")) p.img.src = srcOf(n);
  }
  function around(n) { for (var k = n - 2; k <= n + 3; k++) load(k); }
  // a page's (or a spread's) top a little under the box's top edge: less than the gap, so no sliver of the one before
  function topOf(n) { return pages[n - 1].li.offsetTop - Math.round(gap * 0.6); }
  // the page across the box's upper third (in a spread, the right-hand one)
  function pageAt() {
    var y = frame.scrollTop + frame.clientHeight * 0.33, lo = 0, hi = pages.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (pages[m].li.offsetTop <= y) lo = m; else hi = m - 1; }
    return lo + 1;
  }
  // in a spread, the left-hand page of the row
  function rowStart(n) {
    while (n > 1 && pages[n - 2].li.offsetTop === pages[n - 1].li.offsetTop) n--;
    return n;
  }
  // the page on screen: in a spread, the row's left-hand page, unless a pick put its own page there (QA #4, r2)
  function onScreen() {
    var n = rowStart(pageAt());
    if (glideN && pages[glideN - 1] && pages[glideN - 1].li.offsetTop === pages[n - 1].li.offsetTop) return glideN;
    return n;
  }
  function onFrameScroll() {
    var n = onScreen();
    around(n);
    here(n);
    railAt();
    if (!gl) mark(entryAt(n));
  }
  // The glide's end. One that did not arrive (an engine that cut a smooth scroll short) lands at once; one the reader
  // took over (wheel, touch, keys, a click in the box) is left where it is.
  function glided() {
    if (gl && Math.abs(frame.scrollTop - glideTo) > 2) frame.scrollTop = glideTo;
    gl = 0; clearTimeout(glT);
    var n = onScreen(); here(n); mark(entryAt(n)); railAt();
  }
  function takeover() { if (gl) { gl = 0; clearTimeout(glT); } glideN = 0; }
  function goTo(n) {
    around(n);
    glideN = n;
    var target = Math.min(topOf(n), frame.scrollHeight - frame.clientHeight), from = frame.scrollTop, h = frame.clientHeight;
    sec.__pn.jumps++;
    if (Math.abs(target - from) < 2) { here(n); mark(entryAt(n)); return; }
    gl = 1; clearTimeout(glT); glideTo = target;
    if (reduce.matches) { frame.scrollTop = target; glided(); return; }
    // a long way: most of it at once, then the glide (the pages in between are not loaded for nothing)
    if (Math.abs(target - from) > 2.5 * h) frame.scrollTop = target - (target > from ? 1 : -1) * 1.1 * h;
    frame.scrollTo({ top: target, behavior: "smooth" });
    glT = setTimeout(glided, 1200);
  }

  // ---- ?viewer=native: the browser's own viewer -----------------------------------------------------------------------
  var iframe = null, page = 0, pending = null, want = 0;
  function src(n) { return pdf + "#page=" + n + "&navpanes=0"; }
  function openNative(n) {
    want = n;
    if (!iframe.getAttribute("src")) {
      page = n; sec.__pn.jumps++; pending = iframe;
      iframe.addEventListener("load", function first() {
        iframe.removeEventListener("load", first);
        setTimeout(function () { pending = null; if (want !== page) goNative(want); }, 200);
      });
      iframe.src = src(n);
      return;
    }
    if (!pending && n !== page) goNative(n);
  }
  function goNative(n) {
    page = n; sec.__pn.jumps++;
    // the new frame goes UNDER the one on screen and is never hidden itself (WebKit's viewer, loaded at opacity 0,
    // did not paint once shown); when it has loaded, the old one fades out over it
    var next = document.createElement("iframe");
    next.className = "pn-pdf"; next.title = iframe.title; next.src = src(n);
    frame.insertBefore(next, iframe);
    pending = next;
    var done = false;
    function swap() {
      if (done) return;
      done = true; pending = null;
      var old = iframe; iframe = next;
      if (reduce.matches) old.parentNode && old.parentNode.removeChild(old);
      else { old.classList.add("pn-out"); setTimeout(function () { old.parentNode && old.parentNode.removeChild(old); }, 240); }
      if (want !== page) goNative(want);
    }
    next.addEventListener("load", function () { setTimeout(swap, 200); });
    setTimeout(swap, 4000);
  }

  sec.__pn.page = function () { return native ? page : onScreen(); };
  sec.__pn.entry = function () { return cur >= 0 ? firsts[cur] : 0; };
  sec.__pn.live = function () { return live; };
  sec.__pn.vector = function () { return vec; };
  if (native) {
    iframe = document.createElement("iframe");
    iframe.className = "pn-pdf"; iframe.title = "The hardware notebook, " + N + " pages (PDF)";
    frame.appendChild(iframe);
    frame.removeAttribute("tabindex");
  } else {
    build();
    frame.addEventListener("scroll", onFrameScroll, { passive: true });
    if ("onscrollend" in frame) frame.addEventListener("scrollend", function () { if (gl) glided(); });
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (t) { frame.addEventListener(t, takeover, { passive: true }); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        gap = parseFloat(getComputedStyle(frame.firstChild).rowGap) || 0; railAt(); fit(); sources();
      }).observe(frame);
      // the layout is chosen again whenever the section's column changes width: the hub's scale (--hub-k, own.js)
      // arrives after this script, and with it the column's width
      var wrapW = 0;
      new ResizeObserver(function (es) {
        var w = Math.round(es[es.length - 1].contentRect.width);
        if (w !== wrapW) { wrapW = w; mode(); }
      }).observe(sec.querySelector(".pn-wrap"));
    }
    // a window moved to a screen of another density: the pages on it
    var dpr = mq("(min-resolution: 1.5dppx)");
    if (dpr.addEventListener) dpr.addEventListener("change", sources);
  }

  // load once the section is less than half a screen below the window (not on the way off the landing: QA #12, r2),
  // where it is shown
  function maybeLoad() {
    if (!near || !inline()) return;
    if (native) { if (!iframe.getAttribute("src")) openNative(page || 1); }
    else around(onScreen());
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { near = es[es.length - 1].isIntersecting; maybeLoad(); },
                             { rootMargin: "0px 0px 40% 0px" }).observe(sec);
  } else { near = true; maybeLoad(); }

  // Back to Hardware steps aside while it would sit on the notebook in the list layout (round 1, QA #7; pn.css)
  var back = document.querySelector(".hw-back"), wrap = sec.querySelector(".pn-wrap");
  function backCheck() {
    if (!back || !wrap) return;
    var on = false;
    if (sec.classList.contains("pn-noview")) {
      var t = wrap.getBoundingClientRect(), b = back.getBoundingClientRect();
      on = t.height > 0 && t.bottom > b.top - 20 && t.top < b.bottom + 8 && t.right > b.left - 8 && t.left < b.right + 8;
    }
    document.documentElement.classList.toggle("pn-list-back", on);
  }

  mode();
  mark(0);
  here(1);
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { mode(); });

  // ---- the contents: a pick turns the notebook to the entry (a modified click, or no notebook shown: the link's own
  // new tab, the PDF at that page). In a week's row each dot is its own pick (QA #9, r2), and picking the row of the
  // week on screen again steps to the week's next entry. -------------------------------------------------------------------
  function pick(n) {
    mark(entryAt(n));
    near = true; sure = true;
    if (native) { openNative(n); here(n); } else goTo(n);
    place();
    measure();
  }
  links.concat(wlinks).forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (!inline() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var n = +a.getAttribute("data-page");
      var dot = e.target && e.target.closest ? e.target.closest(".pn-dots i[data-page]") : null;
      if (dot) n = +dot.getAttribute("data-page");
      else if (a.classList.contains("pn-wa") && a.getAttribute("aria-current") === "true") {
        var ps = (a.getAttribute("data-pages") || "").split(",").filter(Boolean).map(Number);
        if (ps.length > 1) n = ps[(ps.indexOf(firsts[cur]) + 1) % ps.length];
      }
      pick(n);
    });
  });

  // the skip link goes to the pages themselves
  var skipA = sec.querySelector(".pn-skip");
  if (skipA) skipA.addEventListener("click", function (e) {
    if (!inline()) return;
    e.preventDefault();
    sure = true;
    place(true);
    try { (native ? iframe : frame).focus({ preventScroll: true }); } catch (err) { /* older browsers */ }
    measure();
  });
  // focus in the box (Tab, the skip link) brings the section on screen, so the keys turn the pages
  frame.addEventListener("focus", function () { sure = true; place(); measure(); });
})();
