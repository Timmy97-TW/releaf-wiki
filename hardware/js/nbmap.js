// Sticky pipeline map — the timeline as an instrument for reading the notebook.
//
// The page already carries the link: every marked scan has an anchor id
// (`w14-11`) and exactly one lane dot points at it (`href="#w14-11"`), 31 for
// 31. So the map needs no new data, only a scroll position.
//
// Beyond highlighting the current entry it does four things that turn a legend
// into a control:
//
//   * a playhead on the week axis, interpolated between entries rather than
//     snapped to them, so the map moves continuously with the scroll;
//   * read / unread marks, so the chart doubles as a record of how far through
//     62 scans you are;
//   * the week scale and the marks are both jump targets, and [ and ] step
//     entry to entry, so you can drive the book from the map;
//   * a one-line readout that survives the compact state, because a pinned map
//     that cannot tell you what you are looking at is just decoration.
//
// Half the scans carry no mark — they are the facing page of a spread. Those
// hold the previous highlight rather than clearing it: a mark that blinks off
// every second page reads as a fault, not as information.
//
// Both layouts use this file unchanged. Everything about position is CSS; this
// only ever answers "where am I in the book".
(function () {
  "use strict";

  const panel = document.querySelector(".lanes-panel");
  const pagesEl = document.getElementById("nbr-pages");
  if (!panel || !pagesEl) return;

  const shell = document.querySelector("[data-nbmap]");
  const pinnedTop = shell && shell.getAttribute("data-nbmap") === "top";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DIR_THUMBS = "thumbs/";

  // The site's .topbar is position:fixed at z-index 50, so anything sticking to
  // top:0 slides underneath it. Measure it rather than hard-coding 78px, which
  // is only true at the default root font size.
  // wiki: the fixed chrome is the nav bar plus the .hwnav strip under it, so
  // what matters is where the strip ends, not how tall it is
  const topbar = document.querySelector(".topbar, .hwnav");
  function publishTopbar() {
    const h = topbar ? Math.round(topbar.getBoundingClientRect().bottom) : 0;
    document.documentElement.style.setProperty("--topbar-h", h + "px");
  }
  publishTopbar();

  /* ---------- index ---------- */
  const dots = Array.prototype.slice.call(panel.querySelectorAll(".lane-dot"));
  const dotFor = {};
  dots.forEach(function (d) {
    const href = d.getAttribute("href") || "";
    if (href.charAt(0) === "#") dotFor[href.slice(1)] = d;
  });

  const num = function (el, prop) { return parseFloat(el.style.getPropertyValue(prop)) || 0; };
  const marked = [];
  Array.prototype.forEach.call(pagesEl.querySelectorAll(".nbr-page"), function (fig) {
    const a = fig.querySelector(".nbr-anchor[id]");
    if (!a) return;
    const dot = dotFor[a.id];
    if (!dot) return;
    marked.push({
      fig: fig, id: a.id, dot: dot,
      lane: dot.closest(".lane"),
      week: dot.getAttribute("data-w") || "",
      title: dot.getAttribute("data-t") || "",
      a: num(dot, "--a"), n: num(dot, "--n") || 21
    });
  });
  if (!marked.length) return;

  /* ---------- two entries in one week ----------
     The chart positions a mark from its week alone, so two entries in the same
     week of the same build land on identical coordinates. Ten of the thirty-one
     marks are in such a pair: the one underneath is invisible and cannot be
     clicked, which is a third of the notebook unreachable from its own index.
     (The horizontal chart on the live page has this too.)

     The fix is to divide the week cell rather than to nudge the dots apart: a
     week with two entries puts them at the quarter and three-quarter points of
     that week's row, so they stay inside the week they belong to, keep their
     order, and stay on the lane's centre line. --slot / --slots are read by the
     positioning rule in CSS; a lone entry keeps the default 0 of 1 and sits
     dead centre exactly as before. */
  (function spreadWithinWeek() {
    const byLane = {};
    dots.forEach(function (d) {
      const lane = d.closest(".lane");
      if (!lane) return;
      const key = (lane.getAttribute("data-mark") || "?") + "|" + num(d, "--a");
      (byLane[key] = byLane[key] || []).push(d);
    });
    Object.keys(byLane).forEach(function (k) {
      const group = byLane[k];
      if (group.length < 2) return;
      // document order is chronological within a week, so keep it
      group.forEach(function (d, i) {
        d.style.setProperty("--slot", i);
        d.style.setProperty("--slots", group.length);
      });
    });
  })();

  /* ---------- which build owns which scan ----------
     Half the scans are the facing page of a spread and carry no mark of their
     own, and the notebook's rule is that an entry owns every page from its own
     up to the next entry's. Stamping that ownership onto the scans and onto the
     rail rows is what lets a build be followed as a thread through the record
     rather than as 31 unrelated marks. */
  const allPages = Array.prototype.slice.call(pagesEl.querySelectorAll(".nbr-page"));
  const railRows = Array.prototype.slice.call(
    document.querySelectorAll(".nbr-rail a[data-page]"));
  (function assignOwners() {
    let owner = null;
    allPages.forEach(function (fig) {
      const anchor = fig.querySelector(".nbr-anchor[id]");
      const entry = anchor ? marked.filter(function (m) { return m.id === anchor.id; })[0] : null;
      if (entry) owner = entry;
      if (owner) {
        fig.setAttribute("data-owner", owner.lane.getAttribute("data-mark") || "");
        fig.setAttribute("data-entry", owner.id);
      }
    });
    railRows.forEach(function (a) {
      const href = a.getAttribute("href") || "";
      const e = marked.filter(function (m) { return "#" + m.id === href; })[0];
      if (e) a.parentElement.setAttribute("data-owner", e.lane.getAttribute("data-mark") || "");
    });
  })();

  const scale = Array.prototype.slice.call(panel.querySelectorAll(".lanes-scale span"));
  const rw = panel.querySelector(".lanes-readout-w");
  const rt = panel.querySelector(".lanes-readout-t");
  const idleW = rw ? rw.textContent : "";
  const idleT = rt ? rt.textContent : "";

  // A playhead the chart did not have. Its own element rather than reusing
  // .lanes-cursor, which lanes.js owns for pointer hover — two writers on one
  // element is how you get a cursor that fights itself.
  const lanesEl = panel.querySelector(".lanes");
  const play = document.createElement("div");
  play.className = "nbmap-play";
  play.setAttribute("aria-hidden", "true");
  if (lanesEl) lanesEl.appendChild(play);

  // Screen readers get told where you are; the visual readout is not enough.
  const live = document.createElement("p");
  live.className = "nbmap-live";
  live.setAttribute("aria-live", "polite");
  panel.appendChild(live);

  let current = null;

  // A thin progress bar says how far down the document you are, which is not
  // the same as how far through the record. This says which entry of how many.
  const count = document.createElement("p");
  count.className = "nbmap-count";
  panel.appendChild(count);
  function invalidateEntryCount() {
    if (!current) { count.textContent = ""; return; }
    const list = focused
      ? marked.filter(function (m) { return m.lane.getAttribute("data-mark") === focused; })
      : marked;
    const i = list.indexOf(current);
    count.textContent = i < 0
      ? list.length + (list.length === 1 ? " entry" : " entries")
      : "entry " + (i + 1) + " of " + list.length;
  }

  function light(entry) {
    if (entry === current) return;
    current = entry;
    dots.forEach(function (d) {
      const on = d === entry.dot;
      d.classList.toggle("here", on);
      if (on) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
    Array.prototype.forEach.call(panel.querySelectorAll(".lane"), function (l) {
      l.classList.toggle("here", l === entry.lane);
    });
    scale.forEach(function (s) {
      s.classList.toggle("here", s.textContent.trim() === entry.week);
    });
    if (!panel.classList.contains("hovering")) {
      if (rw) rw.textContent = "W" + entry.week;
      if (rt) rt.textContent = entry.title;
    }
    panel.setAttribute("data-here", entry.id);
    live.textContent = "Week " + entry.week + ", " + entry.title;
    invalidateEntryCount();
    if (cad) cad.show(entry);
  }

  /* ---------- where am I ----------
     This reuses notebook.js's rule rather than inventing a better one: a line
     at 0.42 of the viewport and "the last page whose top has passed it". Two
     components with different opinions about the same scroll read as a broken
     page, and it is inherently stable — it only changes when you cross a page
     top, so it cannot flicker.

     Positions are MEASURED ONCE and cached in document coordinates, not read
     per frame. Reading them live cost 84 getBoundingClientRect calls a scroll
     frame, each forcing a synchronous layout of an 81,000px document holding 62
     full-page images: 32ms an update, against a 16.7ms budget. Cached, the
     scroll path is arithmetic on scrollY and touches the DOM only where
     something actually changed. */
  let tops = [];        // document-space top of every marked entry
  let measured = false;

  function measure() {
    const y = window.scrollY;
    tops = marked.map(function (m) { return m.fig.getBoundingClientRect().top + y; });
    measured = true;
  }

  /* ---------- where am I ----------
     An IntersectionObserver with a zero-height root band at 0.42 of the
     viewport: exactly the scan crossing that line intersects, so the browser
     tells us which entry is current without anything on the main thread
     reading layout at all.

     This replaces a scroll handler that measured positions live. That version
     forced 84 layouts a frame; caching the positions helped, but with
     content-visibility the scans resolve their real heights continuously as you
     scroll, which fired a ResizeObserver, which re-measured all 93 elements —
     a full layout every frame again, and worse than where it started.

     The observer also hands us each entry's rect for free in the callback, so
     the cached offsets self-correct for every entry you actually pass without
     a single forced read. */
  let currentIndex = 0;

  function line() { return window.scrollY + window.innerHeight * 0.42; }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(function (entries) {
      const y = window.scrollY;
      let changed = false;
      entries.forEach(function (e) {
        const i = marked.indexOf(marked.filter(function (m) { return m.fig === e.target; })[0]);
        if (i < 0) return;
        tops[i] = e.boundingClientRect.top + y;   // free: no forced layout
        if (e.isIntersecting) { currentIndex = i; changed = true; }
      });
      if (changed) update();
    }, { rootMargin: "-42% 0px -58% 0px", threshold: 0 });
    marked.forEach(function (m) { io.observe(m.fig); });
  }

  function pickIndex() {
    // Between observer callbacks, fall back to the cached offsets. Pure
    // arithmetic on scrollY; no DOM reads.
    if (!measured) return currentIndex;
    const L = line();
    let best = 0;
    for (let i = 0; i < tops.length; i++) { if (tops[i] <= L) best = i; else break; }
    return best;
  }

  function playFraction(i) {
    const L = line();
    const span = function (e) {
      return (e.a + (num(e.dot, "--slot") + 0.5) / (num(e.dot, "--slots") || 1)) / e.n;
    };
    if (i >= marked.length - 1) return span(marked[marked.length - 1]);
    const a = tops[i], b = tops[i + 1];
    if (a == null || b == null || b <= a) return span(marked[i]);
    const k = Math.min(1, Math.max(0, (L - a) / (b - a)));
    return span(marked[i]) + (span(marked[i + 1]) - span(marked[i])) * k;
  }

  let lastRead = -1, lastCurrentId = null;

  function update() {
    const i = pickIndex();
    const entry = marked[i];
    light(entry);

    // Only the dots that actually crossed are touched; toggling 31 classes a
    // frame is a DOM write whether or not the value changed.
    if (i + 1 !== lastRead) {
      for (let k = 0; k < marked.length; k++) marked[k].dot.classList.toggle("read", k < i);
      lastRead = i + 1;
    }

    panel.style.setProperty("--play", playFraction(i).toFixed(5));

    if (entry.id !== lastCurrentId) {
      allPages.forEach(function (f) {
        const on = f.getAttribute("data-entry") === entry.id;
        if (on !== f.classList.contains("nbmap-current")) f.classList.toggle("nbmap-current", on);
      });
      lastCurrentId = entry.id;
    }

    if (pinnedTop && tops.length) {
      const top = tops[0] - window.scrollY;
      const on = shell.classList.contains("compact");
      const h = window.innerHeight;
      shell.classList.toggle("compact", on ? top < h * 0.62 : top < h * 0.46);
    }
  }

  // Layout reads happen on resize, never on scroll.
  //
  // The side column's height used to be measured here and published as
  // --nbmap-vh, on the theory that before it pins it should only claim the
  // space below its own flow position. Removed: that is one measurement taken
  // at one moment, and if layout had not settled it stuck at a wrong value —
  // it froze at 367px, which made the panel taller than its own parent and
  // dumped the week scale and the readout on top of each other. The column is
  // sticky and is pinned for all but the first screen of reading, so CSS can
  // work its height out from the viewport and there is nothing to go stale.
  function measureShell() {
    if (!shell || !pinnedTop) return;
    document.documentElement.style.setProperty(
      "--nbmap-h", Math.round(shell.getBoundingClientRect().height) + "px");
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }

  /* ---------- driving the book from the map ---------- */
  function goTo(id, focus) {
    const el = document.getElementById(id);
    if (!el) return;
    const pad = (pinnedTop ? shell.getBoundingClientRect().height : 0) +
                (parseFloat(getComputedStyle(document.documentElement)
                  .getPropertyValue("--topbar-h")) || 0) + 18;
    const y = window.scrollY + el.getBoundingClientRect().top - pad;
    window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    if (history.replaceState) history.replaceState(null, "", "#" + id);
    if (focus) {
      const fig = el.closest(".nbr-page");
      if (fig) { fig.setAttribute("tabindex", "-1"); fig.focus({ preventScroll: true }); }
    }
  }

  dots.forEach(function (d) {
    d.addEventListener("click", function (e) {
      e.preventDefault();
      goTo((d.getAttribute("href") || "").slice(1));
    });
    // An 11px dot is a poor target (WCAG 2.5.5/2.5.8 asks for 24). The dot is
    // the right SIZE to look at and the wrong size to hit, so the target is
    // grown with a transparent ::after in CSS and the dot is left alone.
    d.classList.add("hitpad");
  });

  // The week numbers were inert. They are the coarsest thing to aim at, so
  // they should be the easiest — click one to land on its first entry.
  scale.forEach(function (s) {
    const w = s.textContent.trim();
    const first = marked.filter(function (m) { return m.week === w; })[0];
    if (!first) { s.classList.add("empty"); return; }
    s.setAttribute("role", "button");
    s.setAttribute("tabindex", "0");
    s.setAttribute("title", "Week " + w + " — " + first.title);
    s.addEventListener("click", function () { goTo(first.id, true); });
    s.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(first.id, true); }
    });
  });

  // [ and ] step entry to entry without taking your hands off the keyboard.
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.key !== "[" && e.key !== "]") return;
    const i = marked.indexOf(current);
    const j = e.key === "]" ? Math.min(marked.length - 1, i + 1) : Math.max(0, i - 1);
    if (j === i || !marked[j]) return;
    e.preventDefault();
    goTo(marked[j].id, true);
    // Light it now rather than waiting for the scroll handler. A smooth scroll
    // takes a few hundred ms, and holding ] would otherwise keep stepping from
    // the same stale entry and go nowhere after the first press.
    light(marked[j]);
  });

  /* ---------- decoding the marks ----------
     The column heads are two letters because that is all that fits, but "LP"
     is undecodable unless you already know the notebook. Rather than spend
     permanent column width on a legend, hovering or focusing a lane says what
     it is in the readout that is already there, with its span and how many
     entries it holds. */
  Array.prototype.forEach.call(panel.querySelectorAll(".lane"), function (laneEl) {
    const nameEl = laneEl.querySelector(".lane-name");
    const name = nameEl ? nameEl.textContent.trim() : (laneEl.getAttribute("data-mark") || "");
    const spanEl = laneEl.querySelector(".lane-span");
    const span = spanEl ? spanEl.textContent.replace(/\s+/g, " ").trim() : "";
    const n = laneEl.querySelectorAll(".lane-dot").length;
    if (nameEl) nameEl.setAttribute("title", name + (span ? " · " + span : ""));
    function show() {
      panel.classList.add("hovering");
      laneEl.classList.add("peek");
      if (rw) rw.textContent = span || "";
      if (rt) rt.textContent = name + " — " + n + (n === 1 ? " entry" : " entries");
    }
    function hide() {
      laneEl.classList.remove("peek");
      panel.classList.remove("hovering");
      if (current) { if (rw) rw.textContent = "W" + current.week; if (rt) rt.textContent = current.title; }
    }
    laneEl.addEventListener("pointerenter", show);
    laneEl.addEventListener("pointerleave", hide);
    laneEl.addEventListener("focusin", show);
    laneEl.addEventListener("focusout", hide);

    // The column head is the biggest thing in the lane and did nothing. Make
    // it jump to where that build starts — the question you ask of a build
    // timeline is usually "when did this one begin".
    //
    // Three of the seven lanes wrap their name in a link to that instrument's
    // own page. Those heads were dead here: the name is font-size:0 so the
    // anchor has no box to click, and the visible mark is a ::before on the
    // parent. Rather than have three heads navigate away and four jump within
    // the notebook, all seven do the same thing — this map indexes the
    // notebook, and the instrument pages are linked from the hub and from the
    // entries themselves.
    const first = laneEl.querySelector(".lane-dot");
    if (nameEl && first) {
      const inner = nameEl.querySelector("a");
      if (inner) inner.style.pointerEvents = "none";
      nameEl.setAttribute("role", "button");
      nameEl.setAttribute("tabindex", "0");
      nameEl.setAttribute("title", name + (span ? " · " + span : "") + " — jump to the first entry");
      nameEl.style.cursor = "pointer";
      const jump = function (e) {
        if (e) e.preventDefault();
        const mark = laneEl.getAttribute("data-mark");
        const wasFocused = focused === mark;
        setFocus(mark, name);
        // Focusing and going to the start are one gesture: you ask for a build
        // because you want to read it, not to admire it highlighted.
        if (!wasFocused) goTo((first.getAttribute("href") || "").slice(1), true);
      };
      nameEl.addEventListener("click", jump);
      nameEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(); }
      });
    }
  });

  /* ---------- following one build ----------
     Seven builds are interleaved across 62 scans, so the question the record
     cannot currently answer is "show me just the bioreactor". Focusing a build
     dims — never hides — everything outside its thread: the notebook stays a
     continuous record, but the one you asked for is the one you can see. */
  let focused = null;
  const status = document.createElement("p");
  status.className = "nbmap-status";
  status.hidden = true;
  panel.appendChild(status);

  function setFocus(mark, name) {
    focused = focused === mark ? null : mark;
    document.body.classList.toggle("nbmap-focusing", !!focused);
    allPages.forEach(function (f) {
      f.classList.toggle("nbmap-off", !!focused && f.getAttribute("data-owner") !== focused);
    });
    railRows.forEach(function (a) {
      a.parentElement.classList.toggle("nbmap-off",
        !!focused && a.parentElement.getAttribute("data-owner") !== focused);
    });
    Array.prototype.forEach.call(panel.querySelectorAll(".lane"), function (l) {
      l.classList.toggle("nbmap-off", !!focused && l.getAttribute("data-mark") !== focused);
      l.setAttribute("aria-pressed", String(l.getAttribute("data-mark") === focused));
    });
    Array.prototype.forEach.call(panel.querySelectorAll(".nbmap-key-b"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-mark") === focused));
    });
    if (focused) {
      const n = allPages.filter(function (f) {
        return f.getAttribute("data-owner") === focused; }).length;
      status.hidden = false;
      status.innerHTML = "Following <b>" + name + "</b> · " + n +
        " pages <button type='button' class='nbmap-clear'>show all</button>";
      status.querySelector(".nbmap-clear").addEventListener("click", function () {
        setFocus(focused, name);
      });
    } else {
      status.hidden = true;
      status.textContent = "";
    }
    invalidateEntryCount();
  }

  /* ---------- the key ----------
     The column heads have to be two letters to fit, and the only place "LP"
     was ever spelled out is inside a photograph of a notebook page — not text,
     not searchable, not readable by anything. A key under the chart names all
     seven, and since naming them and following them are the same question, the
     key is also the control: click a build to follow it.

     Built from the lanes rather than hard-coded, so adding a build to the
     notebook adds it here with no second list to keep in step. */
  (function buildKey() {
    const wrap = document.createElement("ul");
    wrap.className = "nbmap-key";
    Array.prototype.forEach.call(panel.querySelectorAll(".lane"), function (laneEl) {
      const mark = laneEl.getAttribute("data-mark") || "";
      const nm = laneEl.querySelector(".lane-name");
      const label = nm ? nm.textContent.trim() : mark;
      const n = laneEl.querySelectorAll(".lane-dot").length;
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nbmap-key-b";
      b.setAttribute("data-mark", mark);
      b.setAttribute("aria-pressed", "false");
      b.title = label + " — " + n + (n === 1 ? " entry" : " entries");
      b.innerHTML = '<i aria-hidden="true"></i><span>' + label + "</span>";
      b.addEventListener("click", function () {
        const head = laneEl.querySelector(".lane-name");
        if (head) head.click();      // one control, two places to press it
      });
      li.appendChild(b);
      wrap.appendChild(li);
    });
    // Above the record, not inside the map. The key decodes the whole page —
    // the spines on the scans, the coloured weeks in the index and the marks
    // in the chart are all the same seven colours — and in a 216px column it
    // cost 93px of height and squeezed the chart to nine pixels a week. Full
    // width it is one line, and it reads before you start scrolling.
    const search = document.querySelector(".nbr-search");
    const head = document.querySelector(".nbr-head");
    const legend = document.createElement("div");
    legend.className = "nbmap-key-bar";
    legend.appendChild(wrap);
    if (search && search.parentNode) search.parentNode.insertBefore(legend, search);
    else if (head && head.parentNode) head.parentNode.insertBefore(legend, head.nextSibling);
    else panel.appendChild(legend);
  })();

  /* ---------- the thing itself ----------
     A timeline tells you when; it does not tell you what. When the entry you
     are reading belongs to a build we have CAD for, that build appears at the
     foot of the map — a still, at a three-quarter angle, like the instrument
     icons on the hub.

     It used to turn. That is gone: perpetual motion beside a page of text is a
     distraction, it would need a pause control under WCAG 2.2.2, and animating
     a sprite was one more thing running on a page that was already dropping
     frames. Swapping an <img> src costs nothing and says the same thing.

     Builds with no CAD say so rather than showing an empty frame.
     See tools/build_map_thumbs.py. */
  const cad = (function () {
    const box = document.createElement("figure");
    box.className = "nbmap-cad";
    box.innerHTML = '<img alt="" width="132" height="132" decoding="async">' +
                    '<figcaption class="nbmap-cad-cap"></figcaption>';
    (shell || panel).appendChild(box);
    const img = box.querySelector("img");
    const cap = box.querySelector(".nbmap-cad-cap");
    let sheets = {}, mark = null;

    fetch(DIR_THUMBS + "thumbs.json")
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (m) { sheets = m || {}; mark = null; if (current) show(current); });

    function show(entry) {
      const m = entry.lane.getAttribute("data-mark");
      if (m === mark) return;
      mark = m;
      const name = ((entry.lane.querySelector(".lane-name") || {}).textContent || m).trim();
      const sheet = sheets[m];
      box.setAttribute("data-mark", m);
      box.classList.toggle("has-cad", !!sheet);
      if (sheet) {
        img.src = DIR_THUMBS + sheet.file;
        img.alt = name + ", CAD model";
        cap.textContent = name;
      } else {
        img.removeAttribute("src");
        img.alt = "";
        cap.textContent = name + " \u2014 no CAD yet";
      }
    }
    return { show: show };
  })();

  panel.addEventListener("pointerenter", function () { panel.classList.add("hovering"); });
  panel.addEventListener("pointerleave", function () {
    panel.classList.remove("hovering");
    if (current) { if (rw) rw.textContent = "W" + current.week; if (rt) rt.textContent = current.title; }
    else { if (rw) rw.textContent = idleW; if (rt) rt.textContent = idleT; }
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    publishTopbar(); measure(); measureShell(); update();
  });

  // Synchronously, not through onScroll: the right mark should be lit on the
  // first paint. Deferring the initial state into a rAF means anything that
  // does not deliver frames — a hidden tab, a prerender, a headless capture —
  // shows a map with nothing marked on it.
  measure();
  measureShell();
  update();
})();
