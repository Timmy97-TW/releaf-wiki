// Notebook reader: scroll progress and index highlighting.
//
// The pages are plain <img> in document order, so with JavaScript off the whole
// notebook still scrolls and the index still jumps — this only adds the reading
// position. Nothing here is required to read the record.
(function () {
  const pages = Array.prototype.slice.call(document.querySelectorAll(".nbr-page"));
  if (!pages.length) return;

  const bar = document.getElementById("nbr-bar");
  const rail = document.getElementById("nbr-rail");
  const links = rail ? Array.prototype.slice.call(rail.querySelectorAll("a[data-page]")) : [];
  const items = links.map(function (a) {
    return { li: a.parentElement, page: parseInt(a.getAttribute("data-page"), 10) };
  });

  let ticking = false;
  function update() {
    ticking = false;
    if (bar) {
      // progress through the document, not through the viewport
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) * 100 : 0) + "%";
    }
    if (!items.length) return;
    // the page whose top is nearest just above the middle of the screen
    const mid = window.innerHeight * 0.42;
    let current = 1;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].getBoundingClientRect().top <= mid) {
        current = parseInt(pages[i].getAttribute("data-page"), 10);
      } else break;
    }
    // an entry owns every page from its own up to the next entry's
    let active = items[0];
    for (let i = 0; i < items.length; i++) {
      if (items[i].page <= current) active = items[i]; else break;
    }
    items.forEach(function (it) { it.li.classList.toggle("on", it === active); });
    if (active && rail && rail.scrollHeight > rail.clientHeight) {
      const r = active.li.getBoundingClientRect(), rr = rail.getBoundingClientRect();
      if (r.top < rr.top || r.bottom > rr.bottom) {
        active.li.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

/* ---------- search ----------
   The notebook ships as page images, so none of its text is findable — not by
   the browser's own find, not by a search engine, not by a judge looking for
   the week something went wrong. The entry text was already parsed to build the
   index rail, so it is served alongside as a small JSON and searched here.
   Matching is on whole words with a prefix allowance, ranked by where the term
   appears: a hit in the title of an entry beats one buried in its body. */
(function () {
  const box = document.getElementById("nbr-q");
  const hits = document.getElementById("nbr-hits");
  if (!box || !hits) return;

  const MARKS = { BR: "Bioreactor", PH: "Photometer", LP: "DiOPAL", HB: "Humidity box",
                  IS: "Imaging station", FP: "Floating plate", "--": "Pre-pivot" };
  let index = null, loading = false;

  function load() {
    if (index || loading) return Promise.resolve();
    loading = true;
    return fetch("search.json")
      .then(function (r) { return r.json(); })
      .then(function (j) { index = j; })
      .catch(function () { index = []; });
  }

  function score(entry, terms) {
    const title = entry.t.toLowerCase();
    const body = entry.s.toLowerCase();
    let total = 0;
    for (const t of terms) {
      let s = 0;
      if (title.indexOf(t) >= 0) s += 12;
      if (entry.week.toLowerCase().indexOf(t) >= 0) s += 6;
      const n = body.split(t).length - 1;
      if (n) s += Math.min(6, 2 + n);
      if (!s) return 0;                   // every term has to appear somewhere
      total += s;
    }
    return total;
  }

  function snippet(entry, term) {
    const at = entry.s.toLowerCase().indexOf(term);
    if (at < 0) return entry.s.slice(0, 120) + "…";
    const from = Math.max(0, at - 55);
    const raw = (from ? "…" : "") + entry.s.slice(from, at + 90) + "…";
    // highlight without letting the source text inject markup
    const esc = raw.replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
    return esc.replace(new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"),
                       "<mark>$1</mark>");
  }

  function run() {
    const q = box.value.trim().toLowerCase();
    if (q.length < 2) { hits.hidden = true; hits.innerHTML = ""; return; }
    load().then(function () {
      const terms = q.split(/\s+/).filter(Boolean);
      const found = index
        .map(function (e) { return { e: e, s: score(e, terms) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s || a.e.w - b.e.w; })
        .slice(0, 8);

      if (!found.length) {
        hits.innerHTML = '<p class="nbr-none">Nothing in the notebook matches that.</p>';
        hits.hidden = false;
        return;
      }
      hits.innerHTML = found.map(function (r) {
        return '<a class="nbr-hit" data-mark="' + r.e.m + '" href="#' + r.e.a + '">' +
          '<span class="nbr-hit-w">' + r.e.week + ' &middot; ' +
          (MARKS[r.e.m] || r.e.m) + ' &middot; p' + r.e.p + '</span>' +
          '<b>' + r.e.t + '</b>' +
          '<span class="nbr-hit-s">' + snippet(r.e, terms[0]) + '</span></a>';
      }).join("");
      hits.hidden = false;
    });
  }

  let t = null;
  box.addEventListener("input", function () { clearTimeout(t); t = setTimeout(run, 110); });
  box.addEventListener("focus", load);
  box.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { box.value = ""; hits.hidden = true; box.blur(); }
  });
  hits.addEventListener("click", function (e) {
    if (e.target.closest("a")) { hits.hidden = true; box.value = ""; }
  });
  document.addEventListener("click", function (e) {
    if (!hits.contains(e.target) && e.target !== box) hits.hidden = true;
  });
})();

/* ---------- annotation marks ----------
   This page does not load polish.js, so the sweep that fills .mark and .ann
   lives here too. Both default to zero width in CSS, so without this they
   would never paint at all. */
(function () {
  var marks = document.querySelectorAll(".mark, .ann");
  if (!marks.length) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(marks, function (m) { m.classList.add("in"); });
    return;
  }
  var mo = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      mo.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.55 });
  Array.prototype.forEach.call(marks, function (m) { mo.observe(m); });
  // Same backstop polish.js uses, and the same rule: only fill what the reader
  // has already reached, or the sweep is over before it is ever on screen.
  setTimeout(function () {
    Array.prototype.forEach.call(marks, function (m) {
      if (m.classList.contains("in")) return;
      if (m.getBoundingClientRect().top < window.innerHeight) {
        m.classList.add("in");
        mo.unobserve(m);
      }
    });
  }, 2600);
})();
