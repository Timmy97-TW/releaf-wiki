// Shared interaction layer — reveals, marker sweeps, scanline scrollspy,
// and the sortable/filterable bill of materials.
//
// No dependencies, no CDN. Every observer is guarded so a page that lacks a
// given element simply skips that block rather than throwing.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- reveal on scroll ---------- */
  // Two details worth keeping: the asymmetric rootMargin fires slightly early
  // at the top and slightly late at the bottom, and images are decoded before
  // being revealed so they never appear half-painted.
  const revealables = document.querySelectorAll(
    ".sec > p, .sec > .frames, .sec > figure, .sec > .table-scroll," +
    " .sec > .specgrid, .sec > .circuits, .sec > .headline-stats," +
    " .sec > .params, .sec > .rel-strip, .sec > ul, .sec > ol," +
    " .sec > .callout, .sec > .keynote, .sec > .openitem, .map-card"
  );
  if (revealables.length && !reduced && "IntersectionObserver" in window) {
    revealables.forEach(function (el) { el.classList.add("reveal"); });
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        const el = e.target;
        const img = el.tagName === "IMG" ? el : el.querySelector("img");
        if (img && img.decode) {
          img.decode().catch(function () {}).finally(function () { el.classList.add("in"); });
        } else {
          el.classList.add("in");
        }
        io.unobserve(el);
      });
    }, { rootMargin: "10% 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });

    // Safety net. This pattern hides content and depends on the observer, the
    // class and the transition all behaving. After a beat, show everything
    // regardless — a missed animation is far cheaper than missing content.
    setTimeout(function () {
      revealables.forEach(function (el) { el.classList.add("in"); });
    }, 1800);
  } else {
    revealables.forEach(function (el) { el.classList.add("reveal", "in"); });
  }

  /* ---------- part header scan line ---------- */
  // A separate observer from the reveals: a part header is a structural
  // landmark and must never be hidden waiting for an animation. This only
  // adds a class that draws a rule — the header itself is always visible.
  const partHeads = document.querySelectorAll(".doc .part");
  if (partHeads.length && "IntersectionObserver" in window && !reduced) {
    const po = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("scan");
        po.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -20% 0px", threshold: 0.4 });
    partHeads.forEach(function (el) { po.observe(el); });
  } else {
    partHeads.forEach(function (el) { el.classList.add("scan"); });
  }

  /* ---------- marker-pen sweeps ---------- */
  const marks = document.querySelectorAll(".mark");
  if (marks.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      marks.forEach(function (m) { m.classList.add("in"); });
    } else {
      const mo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          mo.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -18% 0px", threshold: 0.9 });
      marks.forEach(function (m) { mo.observe(m); });
      setTimeout(function () { marks.forEach(function (m) { m.classList.add("in"); }); }, 2600);
    }
  }

  /* ---------- scanline scrollspy ---------- */
  // A thin band across the middle of the viewport marks exactly one section
  // active, which is steadier than "whichever heading passed last".
  const nav = document.getElementById("doc-nav");
  if (nav && "IntersectionObserver" in window) {
    const links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    links.forEach(function (a) {
      if (a.querySelector(".rail-fill")) return;
      const f = document.createElement("span");
      f.className = "rail-fill";
      a.appendChild(f);
    });
    const targets = links
      .map(function (a) {
        const el = document.querySelector(a.getAttribute("href"));
        return el ? { a: a, el: el } : null;
      })
      .filter(Boolean);

    if (targets.length) {
      // each part runs from its own header to the next one
      const spans = targets.map(function (t, i) {
        return { a: t.a, top: t.el, next: targets[i + 1] ? targets[i + 1].el : null };
      });
      let ticking = false;
      function update() {
        ticking = false;
        const line = window.innerHeight * 0.42;
        let active = null;
        spans.forEach(function (s) {
          const top = s.top.getBoundingClientRect().top;
          const bot = s.next ? s.next.getBoundingClientRect().top : Infinity;
          if (top <= line && bot > line) active = s.a;
        });
        // before the first part, keep the first entry lit rather than none
        if (!active && spans.length && spans[0].top.getBoundingClientRect().top > line) {
          active = null;
        }
        links.forEach(function (a) { a.classList.toggle("on", a === active); });
      }
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      }, { passive: true });
      window.addEventListener("resize", update, { passive: true });
      update();
    }
  }

  /* ---------- sortable, filterable bill of materials ---------- */
  // None of the surveyed hardware wikis lets a reader sort or search a BOM;
  // several ship it as a PDF. Progressive enhancement: without JS the table
  // is still a perfectly good table.
  document.querySelectorAll("table.bom").forEach(function (table, ti) {
    const tbody = table.tBodies[0];
    if (!tbody || tbody.rows.length < 3) return;
    const wrap = table.closest(".table-scroll");
    if (!wrap) return;

    const rows = Array.prototype.slice.call(tbody.rows);

    const tools = document.createElement("div");
    tools.className = "bom-tools";
    const id = "bom-search-" + ti;
    tools.innerHTML =
      '<label class="sr-only" for="' + id + '">Filter parts</label>' +
      '<input id="' + id + '" class="bom-search" type="search" placeholder="Filter parts…" autocomplete="off">' +
      '<span class="bom-count"></span>';
    wrap.parentNode.insertBefore(tools, wrap);

    const search = tools.querySelector(".bom-search");
    const count = tools.querySelector(".bom-count");
    const empty = document.createElement("div");
    empty.className = "bom-empty";
    empty.hidden = true;
    empty.textContent = "No parts match that filter.";
    wrap.parentNode.insertBefore(empty, wrap.nextSibling);

    function refresh() {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      rows.forEach(function (r) {
        const hit = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        r.classList.toggle("hidden-row", !hit);
        if (hit) shown++;
      });
      count.textContent = shown + " / " + rows.length + " parts";
      empty.hidden = shown !== 0;
      wrap.style.display = shown === 0 ? "none" : "";
    }
    search.addEventListener("input", refresh);

    // sortable headers
    const heads = Array.prototype.slice.call(table.tHead ? table.tHead.rows[0].cells : []);
    heads.forEach(function (th, ci) {
      th.setAttribute("data-sort", "");
      th.setAttribute("tabindex", "0");
      th.setAttribute("role", "button");
      function keyFor(row) {
        const cell = row.cells[ci];
        const txt = cell ? cell.textContent.trim() : "";
        // a pending marker has no value yet — always sort those last
        if (!txt || cell.querySelector(".pending")) return null;
        const n = parseFloat(txt.replace(/[^0-9.\-]/g, ""));
        return isNaN(n) ? txt.toLowerCase() : n;
      }
      function sort() {
        const asc = th.getAttribute("aria-sort") !== "ascending";
        heads.forEach(function (h) { h.removeAttribute("aria-sort"); });
        th.setAttribute("aria-sort", asc ? "ascending" : "descending");
        rows.slice().sort(function (a, b) {
          const ka = keyFor(a), kb = keyFor(b);
          if (ka === null && kb === null) return 0;
          if (ka === null) return 1;          // blanks sink, either direction
          if (kb === null) return -1;
          if (ka < kb) return asc ? -1 : 1;
          if (ka > kb) return asc ? 1 : -1;
          return 0;
        }).forEach(function (r) { tbody.appendChild(r); });
      }
      th.addEventListener("click", sort);
      th.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort(); }
      });
    });

    refresh();
  });
})();

/* ---------- count-up figures ---------- */
// Headline numbers tick up the first time they scroll into view. Only pure
// numerics animate — "All", "0.8–0.9" and similar are left exactly as written.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(".hero-stats dd, .headline-stats b");
  if (!targets.length || !("IntersectionObserver" in window)) return;

  const jobs = [];
  targets.forEach(function (el) {
    // the unit lives in a trailing <em>; keep it out of the parse and the write
    const em = el.querySelector("em");
    const unit = em ? em.outerHTML : "";
    const raw = (em ? el.childNodes[0] && el.childNodes[0].nodeValue : el.textContent) || "";
    const txt = raw.trim();
    if (!/^\d+(\.\d+)?$/.test(txt)) return;
    jobs.push({ el: el, to: parseFloat(txt), dp: (txt.split(".")[1] || "").length, unit: unit });
  });
  if (!jobs.length) return;

  if (reduced) return;   // leave the final values in place

  function settle(job) {
    job.el.innerHTML = job.to.toFixed(job.dp) + job.unit;
  }

  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      const job = jobs.find(function (j) { return j.el === e.target; });
      io.unobserve(e.target);
      if (!job || job.done) return;
      job.done = true;
      // Zero it only once the animation is actually about to run. Setting it
      // to 0 upfront would leave the reader looking at 0 forever if rAF never
      // fires — a background tab, a stalled frame loop, anything.
      const dur = 1100, t0 = performance.now();
      (function tick(now) {
        const u = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - u, 3);
        job.el.innerHTML = (job.to * eased).toFixed(job.dp) + job.unit;
        if (u < 1) requestAnimationFrame(tick);
        else settle(job);
      })(t0);
    });
  }, { threshold: 0.6 });

  jobs.forEach(function (j) { io.observe(j.el); });

  // Failsafe: whatever happened above, the true values are on screen shortly.
  setTimeout(function () { jobs.forEach(settle); }, 3000);
})();

/* ---------- jump palette ---------- */
// Press / or Cmd/Ctrl-K to search every section and instrument on the site and
// jump straight to it. Long technical records are hard to navigate by scrolling;
// this makes the whole thing addressable from the keyboard, which matters most
// to the exact audience that reads a hardware record end to end.
(function () {
  if (!document.querySelector(".doc") && !document.querySelector(".decks")) return;

  const here = location.pathname;
  const rel = /\/(photometer|diopal|bioreactor)\//.test(here) ? "../" : "";
  const PAGES = [
    { label: "Hardware hub", sub: "All three instruments", href: rel + "index.html" },
    { label: "V4 Photometer", sub: "In-line OD600", href: rel + "photometer/index.html" },
    { label: "DiOPAL", sub: "Dual-wavelength LED array", href: rel + "diopal/index.html" },
    { label: "Bioreactor", sub: "Perfusion loop", href: rel + "bioreactor/index.html" },
  ];

  const items = [];
  PAGES.forEach(function (p) {
    items.push({ label: p.label, sub: p.sub, kind: "Page", href: p.href });
  });
  document.querySelectorAll(".doc .part h2, .doc .sec h3").forEach(function (h) {
    const sec = h.closest("section");
    let id = sec && sec.id;
    if (!id) {
      id = "j-" + h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      if (sec && !document.getElementById(id)) sec.id = id;
    }
    const num = h.querySelector("i");
    const label = h.textContent.replace(/\s+/g, " ").trim();
    if (!label) return;
    items.push({
      label: label,
      sub: h.tagName === "H2" ? "Part" : "Section",
      kind: num ? num.textContent.trim() : "§",
      href: "#" + id,
    });
  });
  if (items.length < 3) return;

  const wrap = document.createElement("div");
  wrap.className = "palette";
  wrap.hidden = true;
  wrap.innerHTML =
    '<div class="palette-scrim"></div>' +
    '<div class="palette-box" role="dialog" aria-modal="true" aria-label="Jump to">' +
      '<input class="palette-input" type="text" placeholder="Jump to a section or instrument…" ' +
        'aria-label="Jump to a section or instrument" autocomplete="off" spellcheck="false">' +
      '<ul class="palette-list" role="listbox"></ul>' +
      '<div class="palette-foot"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>↵</kbd> go <kbd>esc</kbd> close</div>' +
    "</div>";
  document.body.appendChild(wrap);

  const input = wrap.querySelector(".palette-input");
  const list = wrap.querySelector(".palette-list");
  let shown = [], cursor = 0, lastFocus = null;

  function score(it, q) {
    const hay = (it.label + " " + it.sub + " " + it.kind).toLowerCase();
    if (!q) return 1;
    const i = hay.indexOf(q);
    if (i === -1) return 0;
    return 100 - i;                       // earlier match ranks higher
  }
  function draw() {
    const q = input.value.trim().toLowerCase();
    shown = items
      .map(function (it) { return { it: it, s: score(it, q) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 9)
      .map(function (r) { return r.it; });
    cursor = 0;
    list.innerHTML = shown.length
      ? shown.map(function (it, i) {
          return '<li role="option" aria-selected="' + (i === 0) + '" class="' + (i === 0 ? "on" : "") + '">' +
            '<span class="p-kind">' + it.kind + "</span>" +
            '<span class="p-label">' + it.label + "</span>" +
            '<span class="p-sub">' + it.sub + "</span></li>";
        }).join("")
      : '<li class="p-none">Nothing matches that.</li>';
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.addEventListener("click", function () { go(i); });
      li.addEventListener("mousemove", function () { move(i - cursor); });
    });
  }
  function move(d) {
    if (!shown.length) return;
    cursor = (cursor + d + shown.length) % shown.length;
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.classList.toggle("on", i === cursor);
      li.setAttribute("aria-selected", String(i === cursor));
    });
    const active = list.children[cursor];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }
  function go(i) {
    const it = shown[typeof i === "number" ? i : cursor];
    if (!it) return;
    close();
    if (it.href.charAt(0) === "#") {
      const el = document.querySelector(it.href);
      if (el) {
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        // move focus too, or a keyboard user is left where they were
        el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      }
    } else {
      location.href = it.href;
    }
  }
  function open() {
    lastFocus = document.activeElement;
    wrap.hidden = false;
    input.value = "";
    draw();
    input.focus();
    document.body.style.overflow = "hidden";
  }
  function close() {
    wrap.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  input.addEventListener("input", draw);
  wrap.querySelector(".palette-scrim").addEventListener("click", close);
  wrap.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); go(); }
    else if (e.key === "Tab") {
      // a modal must not leak focus to the page behind it
      e.preventDefault();
      move(e.shiftKey ? -1 : 1);
    }
  });
  document.addEventListener("keydown", function (e) {
    const t = e.target;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      wrap.hidden ? open() : close();
    }
  });

  // a visible affordance, because a shortcut nobody knows about does not exist
  const hint = document.createElement("button");
  hint.type = "button";
  hint.className = "palette-hint";
  hint.innerHTML = 'Jump to <kbd>/</kbd>';
  hint.addEventListener("click", open);
  document.body.appendChild(hint);
})();

/* ---------- cursor follow-light ---------- */
// A soft pool that tracks the pointer across the record. One rAF, two custom
// properties, no layout. Skipped on touch and under reduced motion.
(function () {
  const wrap = document.querySelector(".doc-wrap");
  if (!wrap) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover)").matches) return;

  let x = 0, y = 0, queued = false;
  function apply() {
    queued = false;
    wrap.style.setProperty("--mx", x + "px");
    wrap.style.setProperty("--my", y + "px");
  }
  wrap.addEventListener("pointermove", function (e) {
    const r = wrap.getBoundingClientRect();
    x = Math.round(e.clientX - r.left);
    y = Math.round(e.clientY - r.top);
    if (!queued) { queued = true; requestAnimationFrame(apply); }
  }, { passive: true });
  wrap.addEventListener("pointerenter", function () { wrap.classList.add("lit"); });
  wrap.addEventListener("pointerleave", function () { wrap.classList.remove("lit"); });
})();

/* ==== light record ======================================================
   Flip the page to its light theme once the reader leaves the 3D walkthrough
   and reaches the record — the iteration timeline, the parameters, the
   tables. The CSS does the work; this only decides when.

   The trigger is the top of `.doc-wrap` crossing the upper third of the
   viewport rather than a plain intersection: `.doc-wrap` is taller than the
   screen, so it is "intersecting" from the moment its first pixel appears,
   which would flip the theme while the machine is still on screen.
   ==================================================================== */
(function () {
  const wrap = document.querySelector(".doc-wrap");
  if (!wrap) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) document.body.style.transition = "none";

  let on = false;
  function update() {
    // Some embedded/headless contexts report innerHeight as 0, which collapses
    // both thresholds onto the same point and makes the switch meaningless.
    const vh = document.documentElement.clientHeight || window.innerHeight || 800;
    // hysteresis: switching at a single threshold makes the whole page strobe
    // when a scroll lands the boundary exactly on it
    const top = wrap.getBoundingClientRect().top;
    const enter = vh * 0.34;
    const exit = vh * 0.52;
    const next = on ? top < exit : top < enter;
    if (next === on) return;
    on = next;
    document.body.classList.toggle("doc-light", on);
  }

  // Wait for layout. Running immediately can read a rect measured before the
  // sticky stage has been sized, which latches the theme on at the top of the
  // page and then never clears.
  requestAnimationFrame(function () { requestAnimationFrame(update); });
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update, { passive: true });
})();
