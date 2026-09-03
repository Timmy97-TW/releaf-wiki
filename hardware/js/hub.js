// Hardware hub — reveal on scroll, pointer-reactive decks, and page hand-off.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- reveal on scroll ---------- */
  const items = Array.prototype.slice.call(
    document.querySelectorAll(".deck, .relate-inner > *, .rel-map, .rel-aside")
  );
  if (items.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("reveal", "in"); });
    } else {
      items.forEach(function (el, i) {
        el.classList.add("reveal");
        el.style.transitionDelay = (i % 3) * 0.08 + "s";
      });
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
      items.forEach(function (el) { io.observe(el); });

      // Safety net. This pattern hides content and depends on the observer, the
      // class and the transition all behaving; if any of them does not, the page
      // is blank below the fold. After a beat, show everything regardless — a
      // missed animation is a far cheaper failure than missing content.
      setTimeout(function () {
        items.forEach(function (el) { el.classList.add("in"); });
      }, 1600);
    }
  }

  /* ---------- topbar hairline once you leave the hero ---------- */
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    let t = false;
    window.addEventListener("scroll", function () {
      if (t) return;
      t = true;
      requestAnimationFrame(function () {
        topbar.classList.toggle("stuck", window.scrollY > 40);
        t = false;
      });
    }, { passive: true });
  }

  /* ---------- pointer-reactive decks ----------
     The card leans very slightly toward the cursor and lights from that side.
     Kept small on purpose — past about 6° it stops reading as a lit object and
     starts reading as a gimmick. Driven off one rAF so many cards stay cheap. */
  const decks = Array.prototype.slice.call(document.querySelectorAll("a.deck"));
  if (decks.length && !reduced && window.matchMedia("(hover: hover)").matches) {
    const MAX = 5.5;            // degrees, the card
    let queued = false;
    let pending = null;

    function apply() {
      queued = false;
      if (!pending) return;
      const { el, px, py } = pending;
      el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      el.style.transform =
        "perspective(1400px) rotateX(" + ((0.5 - py) * MAX).toFixed(2) + "deg)" +
        " rotateY(" + ((px - 0.5) * MAX).toFixed(2) + "deg)" +
        " translateY(-4px)";
    }

    decks.forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        const r = el.getBoundingClientRect();
        pending = {
          el: el,
          px: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          py: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
        };
        if (!queued) { queued = true; requestAnimationFrame(apply); }
      });
      el.addEventListener("pointerleave", function () {
        pending = null;
        el.style.transform = "";
        el.style.setProperty("--mx", "50%");
        el.style.setProperty("--my", "40%");
      });
    });
  }

  /* ---------- page hand-off ----------
     Fade out before navigating so the jump between hub and instrument reads as
     one continuous surface rather than a blink. */
  if (!reduced) {
    document.addEventListener("click", function (e) {
      const a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || a.target === "_blank") return;
      if (a.hostname && a.hostname !== location.hostname) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(function () { location.href = href; }, 300);
    });
    // coming back via the browser's cache should not leave the page faded out
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted) document.body.classList.remove("leaving");
    });
  }


  /* ---------- notebook reel ----------
     Three entry cards on screen, paging through all 31 rather than showing the
     same three forever. Auto-advance stops the moment anyone interacts, because
     a card that slides away mid-read is worse than one that never moved. */
  (function () {
    const reel = document.getElementById("nb-reel");
    const track = document.getElementById("nb-reel-track");
    const dots = document.getElementById("nb-reel-dots");
    if (!reel || !track || !dots) return;

    const cards = Array.prototype.slice.call(track.children);
    if (!cards.length) return;

    let page = 0, pages = 1, timer = null;

    function perPage() {
      // derived from what actually fits, so it follows the CSS breakpoints
      const w = track.getBoundingClientRect().width;
      const cw = cards[0].getBoundingClientRect().width;
      return Math.max(1, Math.round(w / (cw + 17.6)));
    }

    function layout() {
      pages = Math.ceil(cards.length / perPage());
      page = Math.min(page, pages - 1);
      dots.innerHTML = "";
      for (let i = 0; i < pages; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-label", "Entries " + (i * perPage() + 1) +
                       " to " + Math.min(cards.length, (i + 1) * perPage()));
        b.addEventListener("click", function () { go(i); });
        dots.appendChild(b);
      }
      go(page);
    }

    function go(p) {
      page = (p + pages) % pages;
      const step = cards[0].getBoundingClientRect().width + 17.6;
      // clamp the last (partial) page so it right-aligns instead of leaving
      // empty slots — 31 cards over 3-up does not divide evenly
      const maxShift = Math.max(0, cards.length * step - 17.6 -
                                   reel.getBoundingClientRect().width);
      const shift = Math.min(page * perPage() * step, maxShift);
      track.style.transform = "translateX(" + (-shift) + "px)";
      Array.prototype.forEach.call(dots.children, function (d, i) {
        d.classList.toggle("on", i === page);
        d.setAttribute("aria-selected", String(i === page));
      });
      // Only the visible cards should be reachable by keyboard. Visibility is
      // derived from the shift actually applied, not from page * perPage():
      // the last page is clamped so it right-aligns, which slides cards into
      // view that the page arithmetic still considered off-screen — and they
      // were being marked aria-hidden while plainly readable.
      const per = perPage();
      const first = Math.round(shift / step);
      cards.forEach(function (c, i) {
        const vis = i >= first && i < first + per;
        c.setAttribute("tabindex", vis ? "0" : "-1");
        c.setAttribute("aria-hidden", vis ? "false" : "true");
      });
    }

    // advance backwards so the cards slide left-to-right as they cycle
    function tick() { go(page - 1); }
    function start() {
      if (!timer && !reduced && !stopped) timer = setInterval(tick, 5200);
    }
    function halt() { if (timer) { clearInterval(timer); timer = null; } }

    // WCAG 2.2.2 Pause, Stop, Hide: content that moves on its own for longer
    // than five seconds beside other content needs a control a reader can
    // actually reach. Hover and focus already paused it, which does nothing for
    // someone who is neither hovering nor tabbing.
    let stopped = false;
    const play = document.getElementById("nb-reel-play");
    if (play) {
      play.addEventListener("click", function () {
        stopped = !stopped;
        play.setAttribute("aria-pressed", String(stopped));
        play.classList.toggle("paused", stopped);
        play.querySelector(".nb-reel-txt").textContent = stopped ? "Play" : "Pause";
        if (stopped) halt(); else start();
      });
    }

    // Hovering pauses so a card cannot slide out from under someone reading it,
    // and it resumes on leave. Nothing here stops the cycle permanently — it is
    // meant to run on its own.
    reel.addEventListener("pointerenter", function () {
      if (timer) { clearInterval(timer); timer = null; }
    });
    reel.addEventListener("pointerleave", start);
    reel.addEventListener("focusin", function () {
      if (timer) { clearInterval(timer); timer = null; }
    });
    reel.addEventListener("focusout", function () {
      if (!reel.contains(document.activeElement)) start();
    });

    let rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt); rt = setTimeout(layout, 160);
    });

    layout();
    // Start it outright. Gating the start on IntersectionObserver meant that if
    // the observer was slow, throttled or never delivered, the reel simply sat
    // on the first three entries forever — which is what it did. The observer
    // now only pauses it while it is scrolled away, and its absence costs
    // nothing worse than a carousel ticking off screen.
    start();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) start();
          else if (timer) { clearInterval(timer); timer = null; }
        });
      }, { threshold: 0 }).observe(reel);
    }
  })();

})();
