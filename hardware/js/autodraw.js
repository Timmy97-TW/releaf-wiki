// Self-drawing schematics.
//
// The mechanisms that matter most on these pages — how the beam is split, how
// the two circuits stay separate — are currently prose. A reader has to hold
// four things in their head and assemble them. A diagram that draws itself in
// the order the mechanism happens does that assembly for them.
//
// Any inline <svg> inside a .autodraw element is handled: strokes are drawn
// with dash-offset, and anything marked .lbl or .fade appears after the
// stroke it belongs to. Ordering comes from an optional data-step, otherwise
// document order — so a diagram is authored, not configured.
(function () {
  const hosts = document.querySelectorAll(".autodraw");
  if (!hosts.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  hosts.forEach(function (host) {
    const svg = host.querySelector("svg");
    if (!svg) return;

    // The "swipe" hint used to be tied to a viewport breakpoint, so between the
    // breakpoint and the width where the diagram actually stops fitting it told
    // readers to swipe something that was already fully visible. Ask the
    // element instead. Runs regardless of reduced motion — this is layout.
    function flagOverflow() {
      host.classList.toggle("scrolls", host.scrollWidth > host.clientWidth + 1);
    }
    flagOverflow();
    // Watch the element, not the window: the figure also changes width when the
    // contents rail collapses or a late font reflows the column, neither of
    // which is a window resize.
    if ("ResizeObserver" in window) new ResizeObserver(flagOverflow).observe(host);
    else window.addEventListener("resize", flagOverflow);

    const strokes = Array.prototype.slice.call(
      svg.querySelectorAll("path, line, polyline, circle, rect, ellipse"))
      .filter(function (el) { return !el.classList.contains("static"); });
    const fades = Array.prototype.slice.call(svg.querySelectorAll(".lbl, .fade"));

    function step(el) { return parseFloat(el.getAttribute("data-step") || "0"); }
    strokes.sort(function (a, b) { return step(a) - step(b); });
    fades.sort(function (a, b) { return step(a) - step(b); });

    // Measure before hiding. getTotalLength only exists on geometry elements;
    // shapes fall back to an approximation from their bounding box.
    const lens = strokes.map(function (el) {
      if (typeof el.getTotalLength === "function") {
        try { return el.getTotalLength() || 0; } catch (e) { /* fall through */ }
      }
      const b = el.getBBox();
      return (b.width + b.height) * 2;
    });

    function arm() {
      strokes.forEach(function (el, i) {
        const L = lens[i] || 1;
        el.style.strokeDasharray = L + " " + L;
        el.style.strokeDashoffset = String(L);
        el.style.transition = "none";
      });
      fades.forEach(function (el) {
        el.style.opacity = "0";
        el.style.transition = "none";
      });
    }

    function play() {
      let t = 0;
      strokes.forEach(function (el, i) {
        const L = lens[i] || 1;
        // longer runs take proportionally longer, so the pace reads as one
        // continuous hand rather than each segment taking a fixed slot
        const dur = Math.min(1.5, Math.max(0.28, L / 620));
        el.style.transition = "stroke-dashoffset " + dur + "s cubic-bezier(.22,1,.32,1) " + t + "s";
        el.style.strokeDashoffset = "0";
        t += dur * 0.55;                      // overlap, or it feels like a queue
      });
      fades.forEach(function (el, i) {
        // An authored data-step already says when a label belongs, so the index
        // only breaks ties between labels sharing a step. Letting it contribute
        // a full 0.15s each made a label lag its own stroke by seconds once a
        // diagram had more than a handful, which is the case for the flow loop
        // and the condition map.
        const d = el.hasAttribute("data-step")
          ? step(el) * 0.34 + 0.02 * i
          : t * 0.7 + 0.15 * i;
        el.style.transition = "opacity .5s ease " + d + "s";
        el.style.opacity = "1";
      });
    }

    if (reduced) return;                      // authored state is the final state
    arm();

    if (!("IntersectionObserver" in window)) { play(); return; }

    let played = false;
    function once() {
      if (played) return;
      played = true;
      // rAF gives the armed styles a frame to commit before the transition is
      // attached — but it never fires in a background tab, which would leave
      // the failsafe unable to rescue a hidden diagram. arm() ran at init, so
      // by then there is nothing left to wait for.
      if (document.hidden) play();
      else requestAnimationFrame(play);
    }

    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        once();
      });
    }, { threshold: 0.35 });
    io.observe(host);

    // Arming hides the whole diagram, so if the observer never fires the
    // content is gone rather than merely un-animated. Anything taller than the
    // viewport also never reaches a 0.35 threshold. Draw unconditionally after
    // a beat — a diagram that animates early is a far smaller failure than one
    // that is invisible.
    setTimeout(function () { io.disconnect(); once(); }, 2600);
  });
})();
