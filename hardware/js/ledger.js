// The fore-edge of the hardware notebook.
//
// Sixty-two leaves seen edge-on. The whole record is legible as a pattern
// before a word of it is read: a coloured edge opens an entry, a plain one is
// that week still running. Running a thumb along it fans the pages under the
// cursor and lifts the page you are on.
//
// The block is authored complete in the markup — every leaf is present and at
// full height before this runs. Nothing here can leave it empty: the deal-in
// is an animation added on top of the finished state, so a trigger that never
// fires costs the deal, not the block. Same contract as the lane chart.
(function () {
  const block = document.getElementById("nb-block");
  if (!block) return;

  const leaves = Array.prototype.slice.call(block.querySelectorAll(".nb-leaf"));
  if (!leaves.length) return;

  const edge  = block.closest(".nb-edge");
  const peek  = document.getElementById("nb-peek");
  const pimg  = document.getElementById("nb-peek-img");
  const read  = document.getElementById("nb-edge-r");
  const idle  = read ? read.textContent : "";
  const N     = leaves.length;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- the pages deal in when the block is reached ----
     The sheet itself is never hidden: it is simply there, always. Only the
     fore-edge tabs animate, once, as the block comes into view — an animation
     on top of the finished state, so a trigger that never fires costs the deal
     and nothing else. The scroll-driven roll that used to gate the whole sheet
     is gone: it was the one effect that could leave content invisible. */
  const frame = block.closest(".nb-frame") || block;
  if (!reduced) {
    let dealt = false;
    const deal = function () {
      if (dealt) return;
      dealt = true;
      block.classList.add("dealt");
      leaves.forEach(function (a, i) {
        a.querySelector("i").style.animationDelay = (i * 9) + "ms";
      });
    };
    if (!("IntersectionObserver" in window)) {
      deal();
    } else {
      const io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { deal(); io.disconnect(); stop(); }
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
      io.observe(block);
      let last = 0;
      const sweep = function () {
        const now = Date.now();
        if (now - last < 90) return;
        last = now;
        if (block.getBoundingClientRect().top < window.innerHeight * 0.94) {
          deal(); io.disconnect(); stop();
        }
      };
      const stop = function () { window.removeEventListener("scroll", sweep); };
      window.addEventListener("scroll", sweep, { passive: true });
      setTimeout(sweep, 900);
    }
  }

  /* ---- the fan ----
     Leaves near the cursor rise and lean away from it, falling off on a cosine
     so there is no edge to the effect. Written to the elements on a frame,
     never on the event, so a fast pointer cannot outrun it. */
  let raf = null, mx = null, cur = null;

  function fan() {
    raf = null;
    const w = block.getBoundingClientRect().width;
    leaves.forEach(function (a, k) {
      const i = a.querySelector("i");
      if (mx === null) {
        i.style.transform = "";
        a.classList.remove("near", "on");
        return;
      }
      const d = (mx - (k + 0.5) / N * w) / w * N;   // distance in leaves
      const ad = Math.abs(d);
      a.classList.toggle("on", ad < 0.6);
      a.classList.toggle("near", ad < 3.6);
      if (ad > 5) { i.style.transform = ""; return; }
      const f = Math.cos(Math.min(1, ad / 5) * Math.PI / 2);
      i.style.transform =
        "translateY(" + (-9 * f) + "px) rotate(" +
        ((d > 0 ? 1 : -1) * 2.6 * f * (1 - ad / 5)) + "deg)";
    });
  }

  function at(x) {
    const p = Math.min(N, Math.max(1, Math.ceil(x / block.clientWidth * N)));
    if (p === cur) return;
    cur = p;
    const leaf = leaves[p - 1];
    if (pimg) {
      pimg.src = "notebook/pages/p" + (p < 10 ? "0" + p : p) + ".png";
      pimg.alt = "Notebook page " + p;
    }
    if (peek) peek.classList.add("show");
    if (read) {
      // A leaf with no entry is not blank — it is the entry before it, still
      // running. Saying so is the difference between a gap and a long week.
      const t = leaf && leaf.getAttribute("data-t");
      read.textContent = "PAGE " + (p < 10 ? "0" + p : p) + " / " + N + " · " +
                         (t ? t : "NO NEW ENTRY OPENS HERE");
    }
    if (edge) edge.classList.add("reading");
  }

  function clear() {
    mx = null; cur = null; fan();
    if (peek) peek.classList.remove("show");
    if (read) read.textContent = idle;
    if (edge) edge.classList.remove("reading");
  }

  block.addEventListener("pointermove", function (ev) {
    mx = ev.clientX - block.getBoundingClientRect().left;
    if (!raf) raf = requestAnimationFrame(fan);
    if (peek) peek.style.left = mx + "px";
    at(mx);
  });
  block.addEventListener("pointerleave", clear);

  // keyboard: the marked leaves are real links, so tabbing through them should
  // say what it is on and show the page, the same as the pointer does
  leaves.forEach(function (a, k) {
    if (a.tagName !== "A") return;
    a.addEventListener("focus", function () {
      mx = (k + 0.5) / N * block.clientWidth;
      if (peek) peek.style.left = mx + "px";
      if (!raf) raf = requestAnimationFrame(fan);
      at(mx);
    });
    a.addEventListener("blur", function () {
      if (!block.contains(document.activeElement)) clear();
    });
  });
})();
