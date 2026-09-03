// The build timeline — one lane per build across the whole span.
//
// Lives on the notebook reader, above the pages it indexes. It used to sit
// inside hub.js, but the chart moved to the notebook page and the script did
// not follow, so the readout, the pointer cursor, the row dimming and the
// draw-in were all inert. It is its own file now, self-guarding on
// .lanes-panel, so it can be loaded by whichever page carries the chart.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- build timeline ----------
   The chart is a readout, so it behaves like one: the column under the
   pointer is marked, its week number lights in the scale, the row being
   pointed at holds full strength while the others quieten, and the line
   underneath names whatever mark the pointer is actually on.

   It also draws itself in when reached, as an animation rather than a
   transition, so the chart is never hidden waiting for a trigger. */
(function () {
  const panel = document.querySelector(".lanes-panel");
  if (!panel) return;
  const lanes = panel.querySelector(".lanes");
  const scale = Array.prototype.slice.call(panel.querySelectorAll(".lanes-scale span"));
  const rows = Array.prototype.slice.call(panel.querySelectorAll(".lane"));
  const rw = panel.querySelector(".lanes-readout-w");
  const rt = panel.querySelector(".lanes-readout-t");
  const n = scale.length;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- draw in when reached ---- */
  // No arming step: the bars are drawn in CSS and `in` only adds the
  // animation, so a trigger that never fires costs the animation, not the
  // chart.
  if (lanes && n) {
    // one row at a time, so each animation starts when its element is told
    // to run rather than sitting on a delay
    const show = function () {
      rows.forEach(function (row, i) {
        setTimeout(function () { row.classList.add("in"); }, i * 80);
      });
    };
    if (reduced || !("IntersectionObserver" in window)) {
      show();
    } else {
      const io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { show(); io.disconnect(); cleanup(); }
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
      io.observe(lanes);
      // the observer is not delivered everywhere, and a bar left at zero
      // width is content that never arrives, so back it with position
      let t = 0;
      const sweep = function () {
        const now = Date.now();
        if (now - t < 90) return;
        t = now;
        if (lanes.getBoundingClientRect().top < window.innerHeight * 0.95) {
          show(); io.disconnect(); cleanup();
        }
      };
      const cleanup = function () { window.removeEventListener("scroll", sweep); };
      window.addEventListener("scroll", sweep, { passive: true });
      setTimeout(sweep, 900);
    }
  }

  /* ---- pointer tracking ---- */
  const track = function (e) {
    const first = rows[0] && rows[0].querySelector(".lane-track");
    if (!first) return;
    const r = first.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    if (f < 0 || f > 1) { clear(); return; }
    const i = Math.min(n - 1, Math.max(0, Math.floor(f * n)));
    panel.classList.add("tracking");
    panel.style.setProperty("--i", i);
    scale.forEach(function (s, k) { s.classList.toggle("on", k === i); });
    const over = e.target.closest ? e.target.closest(".lane") : null;
    rows.forEach(function (row) { row.classList.toggle("on", row === over); });
  };
  const clear = function () {
    panel.classList.remove("tracking", "reading");
    scale.forEach(function (s) { s.classList.remove("on"); });
    rows.forEach(function (row) { row.classList.remove("on"); });
    if (rw) rw.textContent = "\u2014\u2014";
    if (rt) rt.textContent = "Point at a mark to read its week";
    panel.style.removeProperty("--c");
  };
  panel.addEventListener("pointermove", track);
  panel.addEventListener("pointerleave", clear);

  /* ---- the readout ---- */
  const say = function (dot) {
    if (!rw || !rt) return;
    const lane = dot.closest(".lane");
    rw.textContent = "WEEK " + (dot.getAttribute("data-w") || "");
    rt.textContent = dot.getAttribute("data-t") || "";
    panel.classList.add("reading");
    if (lane) panel.style.setProperty("--c", window.getComputedStyle(lane).getPropertyValue("--c"));
  };
  panel.querySelectorAll(".lane-dot").forEach(function (dot) {
    dot.addEventListener("pointerenter", function () { say(dot); });
    dot.addEventListener("focus", function () { say(dot); });
    // the native tooltip duplicates the readout and arrives a second late
    dot.removeAttribute("title");
  });
})();
})();
