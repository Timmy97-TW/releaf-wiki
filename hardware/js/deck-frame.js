// The bioreactor and the photometer that runs in its loop share one outline.
//
// Traced from the live layout rather than drawn in CSS: a T on a wide screen
// (the bar round the bioreactor, the stem round the photometer, concave
// shoulders where they meet) and one rounded box once the cards stack. Offsets,
// not getBoundingClientRect: the cards lean toward the pointer and slide in on
// reveal, and the outline must follow the layout, not the tilt.
(function () {
  const decks = document.querySelector(".decks");
  const svg = decks && decks.querySelector(".sys-frame");
  const bar = decks && decks.querySelector(".deck-c");
  const stem = decks && decks.querySelector(".deck-a");
  if (!svg || !bar || !stem) return;
  const fill = svg.querySelector(".sys-fill"), line = svg.querySelector(".sys-line");
  const PB = 12, PS = 16, R = 26, J = 22;   // bar padding, stem padding, corner, shoulder
  const tag = document.createElement("span");
  tag.className = "sys-tag";
  tag.setAttribute("aria-hidden", "true");
  tag.textContent = "In the bioreactor loop";
  decks.appendChild(tag);

  function box(el, P) {
    return { l: el.offsetLeft - P, t: el.offsetTop - P,
             r: el.offsetLeft + el.offsetWidth + P, b: el.offsetTop + el.offsetHeight + P };
  }
  function trace() {
    const a = box(bar, PB), s = box(stem, PS);
    const f = function (n) { return Math.round(n * 10) / 10; };
    const L = function () { return Array.prototype.join.call(arguments, " "); };
    const shoulderR = a.r - s.r > R + J, shoulderL = s.l - a.l > R + J;
    let d = L("M", f(a.l + R), f(a.t), "H", f(a.r - R), "Q", f(a.r), f(a.t), f(a.r), f(a.t + R));
    if (shoulderR) {
      d += L("", "V", f(a.b - R), "Q", f(a.r), f(a.b), f(a.r - R), f(a.b),
                 "H", f(s.r + J), "Q", f(s.r), f(a.b), f(s.r), f(a.b + J));
    }
    d += L("", "V", f(s.b - R), "Q", f(s.r), f(s.b), f(s.r - R), f(s.b),
               "H", f(s.l + R), "Q", f(s.l), f(s.b), f(s.l), f(s.b - R));
    if (shoulderL) {
      d += L("", "V", f(a.b + J), "Q", f(s.l), f(a.b), f(s.l - J), f(a.b),
                 "H", f(a.l + R), "Q", f(a.l), f(a.b), f(a.l), f(a.b - R));
    }
    d += L("", "V", f(a.t + R), "Q", f(a.l), f(a.t), f(a.l + R), f(a.t), "Z");
    fill.setAttribute("d", d); line.setAttribute("d", d);
    svg.setAttribute("viewBox", "0 0 " + decks.offsetWidth + " " + decks.offsetHeight);
    tag.style.left = f((s.l + s.r) / 2) + "px";
    tag.style.top = f(s.b) + "px";
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; trace(); });
  }
  trace();
  if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(decks);
  window.addEventListener("resize", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);

  // Drawn in once, the first time the cards come into view.
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced && "IntersectionObserver" in window && line.getTotalLength) {
    svg.classList.add("sys-frame-armed");
    const io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      trace();
      const len = Math.ceil(line.getTotalLength());
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      void line.getBoundingClientRect();
      svg.classList.remove("sys-frame-armed");
      line.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1)";
      line.style.strokeDashoffset = 0;
      line.addEventListener("transitionend", function () {
        line.style.strokeDasharray = ""; line.style.strokeDashoffset = ""; line.style.transition = "";
      }, { once: true });
    }, { threshold: 0.15 });
    io.observe(bar);
  }
})();
