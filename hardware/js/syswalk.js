// Scroll-driven walk through the two-circuit schematic.
//
// The diagram already knew the order it happens in — it was authored with a
// data-step per element, in flow order — so the stages are the system's own
// sequence rather than a layout decision. Scrolling moves a cursor through
// them: the live stage is lit and flowing, everything already passed stays
// dimly on so the system visibly accumulates, and everything ahead waits.
//
// Nothing here hides content on its own. The stylesheet only dims once this
// script has set data-active on the container, so a reader whose scroll
// handler never runs — no JS, a stalled frame loop, an embedded view — sees
// the finished schematic exactly as it was authored.
(function () {
  const walk = document.getElementById("syswalk");
  if (!walk) return;

  const steps = Array.prototype.slice.call(walk.querySelectorAll(".syswalk-step"));
  const marks = Array.prototype.slice.call(walk.querySelectorAll("[data-stage]"));
  const rail  = walk.querySelector(".syswalk-rail");
  const rn    = walk.querySelector(".syswalk-rn");
  const rname = walk.querySelector(".syswalk-rname");
  if (!steps.length || !marks.length) return;

  const LAST = steps.length;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;                     // authored state is the final state

  walk.setAttribute("data-active", "");    // only now may anything be dimmed

  let current = 0;

  function show(stage) {
    if (stage === current) return;
    current = stage;
    marks.forEach(function (el) {
      const s = +el.getAttribute("data-stage");
      el.classList.toggle("sw-live", s === stage);
      // stage 8 is the whole system at once — the loop closing
      el.classList.toggle("sw-past", s < stage || stage >= LAST);
    });
    steps.forEach(function (li) {
      li.classList.toggle("sw-live", +li.getAttribute("data-stage") === stage);
    });
    if (rail) rail.style.setProperty("--sw-progress", (stage / LAST * 100) + "%");
    const live = steps[stage - 1];
    if (rn) rn.textContent = String(stage).padStart(2, "0");
    if (rname && live) {
      const h = live.querySelector("h4");
      rname.textContent = h ? h.textContent : "";
    }
  }

  // Which step is nearest the middle of the viewport. Reading the elements
  // rather than the scroll offset means it stays correct through a resize, a
  // late font reflow, or the contents rail collapsing — none of which move the
  // scroll position but all of which move the steps.
  function pick() {
    const mid = window.innerHeight * 0.5;
    let best = 1, bestD = Infinity;
    steps.forEach(function (li, i) {
      const r = li.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = i + 1; }
    });
    show(best);
  }

  // Time-throttled with a trailing call, not rAF: rAF is starved in background
  // tabs and embedded views, and a trailing edge means the stage the reader
  // actually stopped on is never the one that gets dropped.
  let last = 0, trail = null;
  function onScroll() {
    const now = Date.now();
    if (now - last < 90) {
      if (!trail) trail = setTimeout(function () { trail = null; last = Date.now(); pick(); }, 100);
      return;
    }
    last = now;
    pick();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  pick();
})();
