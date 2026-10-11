// Technical record — the contents rail and smooth anchor scrolling.
//
// The rail has two levels. Every main section is always listed; the subsections of one
// main section are shown only while the reader is inside it, and the rest stay collapsed.
// This replaced the flat ten-item rail and the horizontal section-card grid on 12 Oct 2026.
//
// The collapse is applied here rather than in the stylesheet's base rules, and the markup
// lists every subsection: with scripting off the reader gets the whole contents expanded,
// which is the only table of contents the page now has.
(function () {
  // The rail keeps the doc-nav class for styling, but not the id: ../js/polish.js
  // spies #doc-nav one level deep and would toggle .on across the subsection links
  // too, fighting this spy on every scroll.
  const nav = document.getElementById("doc-rail");
  if (!nav) return;

  nav.classList.add("two-level");

  // One entry per main section: its link, its target, and the <li> that owns its sublist.
  const mains = Array.prototype.slice.call(nav.querySelectorAll(":scope > ol > li"))
    .map(function (li) {
      const a = li.querySelector(":scope > a");
      const el = a && document.querySelector(a.getAttribute("href"));
      return el ? { li: li, a: a, el: el, subs: subsOf(li) } : null;
    })
    .filter(Boolean);
  if (!mains.length) return;

  function subsOf(li) {
    return Array.prototype.slice.call(li.querySelectorAll(":scope > ul > li > a"))
      .map(function (a) {
        const el = document.querySelector(a.getAttribute("href"));
        return el ? { a: a, el: el } : null;
      })
      .filter(Boolean);
  }

  // A sublist animates between 0 and its own height, so it needs a measured height rather
  // than `auto`. Remeasure on resize: the rail reflows and the labels wrap differently.
  function measure() {
    mains.forEach(function (m) {
      const ul = m.li.querySelector(":scope > ul");
      if (ul) ul.style.setProperty("--h", ul.scrollHeight + "px");
    });
  }

  // The section whose heading last crossed the upper third of the viewport is the one
  // being read. Subsections are resolved the same way, within the open section only.
  function update() {
    const line = window.innerHeight * 0.34;
    let active = null;
    for (let i = 0; i < mains.length; i++) {
      if (mains[i].el.getBoundingClientRect().top <= line) active = mains[i];
    }
    // Before the first heading reaches the line, keep the first section open rather than
    // showing a rail with nothing expanded.
    if (!active) active = mains[0];

    mains.forEach(function (m) {
      const on = m === active;
      m.li.classList.toggle("open", on);
      m.a.classList.toggle("on", on);
      if (on) m.a.setAttribute("aria-current", "true");
      else m.a.removeAttribute("aria-current");

      let sub = null;
      if (on) {
        for (let i = 0; i < m.subs.length; i++) {
          if (m.subs[i].el.getBoundingClientRect().top <= line) sub = m.subs[i];
        }
      }
      m.subs.forEach(function (s) { s.a.classList.toggle("on", s === sub); });
    });
  }

  let ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { update(); ticking = false; });
  }, { passive: true });
  // A background tab suspends requestAnimationFrame, so a scroll that happens while the
  // page is hidden can leave `ticking` true and the rail frozen once it comes back.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { ticking = false; update(); }
  });
  window.addEventListener("resize", function () { measure(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
  update();

  // Narrow screens hide the rail, so the same contents are offered as a disclosure at the
  // top of the record. It is built from the rail rather than written out a second time.
  const host = document.getElementById("doc-toc-compact");
  if (host) {
    const d = document.createElement("details");
    d.className = "toc-compact";
    const s = document.createElement("summary");
    s.textContent = "Contents";
    d.appendChild(s);
    d.appendChild(nav.querySelector("ol").cloneNode(true));
    host.appendChild(d);
  }

  // Smooth scrolling for in-document links, unless the reader prefers otherwise.
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener("click", function (e) {
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const el = document.querySelector(a.getAttribute("href"));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    // A smooth scroll that never moves focus leaves the skip link pointing at nothing: the
    // next Tab lands back in the header. Give the target focus without scrolling it again.
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, "", a.getAttribute("href"));
  });
})();
