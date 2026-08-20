// Iteration comparison wipe.
//
// The iteration photos are laid out one per step, so seeing what actually
// changed between two builds means holding one image in your head while you
// scroll to the next. A wipe puts them in the same frame at the same scale,
// which is the whole point of documenting an engineering cycle.
//
// Markup is a single element carrying the shots:
//   <div class="wipe" data-shots='[{"src":"…","cap":"01 — Horizontal"}, …]'></div>
// Everything else is built here, so a page only ever declares the photos.
(function () {
  const hosts = document.querySelectorAll(".wipe[data-shots]");
  if (!hosts.length) return;

  hosts.forEach(function (host) {
    let shots;
    try { shots = JSON.parse(host.getAttribute("data-shots")); }
    catch (e) { return; }
    if (!Array.isArray(shots) || shots.length < 2) return;

    let ai = 0, bi = shots.length - 1;           // opens on first vs last
    let split = 50;

    host.innerHTML =
      '<div class="wipe-stage">' +
        '<img class="wipe-img wipe-a" alt="">' +
        '<div class="wipe-clip"><img class="wipe-img wipe-b" alt=""></div>' +
        '<div class="wipe-line"><span class="wipe-grip"></span></div>' +
        '<span class="wipe-tag wipe-tag-a"></span>' +
        '<span class="wipe-tag wipe-tag-b"></span>' +
      '</div>' +
      '<div class="wipe-bar">' +
        '<div class="wipe-picks" role="group" aria-label="Left image"></div>' +
        '<span class="wipe-vs">vs</span>' +
        '<div class="wipe-picks wipe-picks-b" role="group" aria-label="Right image"></div>' +
      '</div>';

    const stage = host.querySelector(".wipe-stage");
    const imgA = host.querySelector(".wipe-a");
    const imgB = host.querySelector(".wipe-b");
    const clip = host.querySelector(".wipe-clip");
    const line = host.querySelector(".wipe-line");
    const tagA = host.querySelector(".wipe-tag-a");
    const tagB = host.querySelector(".wipe-tag-b");

    function buildPicks(box, which) {
      shots.forEach(function (s, i) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = s.cap.split("—")[0].trim() || String(i + 1);
        b.title = s.cap;
        b.addEventListener("click", function () {
          if (which === "a") { ai = i; if (bi === ai) bi = (i + 1) % shots.length; }
          else { bi = i; if (ai === bi) ai = (i + shots.length - 1) % shots.length; }
          paint();
        });
        box.appendChild(b);
      });
    }
    buildPicks(host.querySelector(".wipe-picks:not(.wipe-picks-b)"), "a");
    buildPicks(host.querySelector(".wipe-picks-b"), "b");

    function paint() {
      imgA.src = shots[ai].src; imgA.alt = shots[ai].cap;
      imgB.src = shots[bi].src; imgB.alt = shots[bi].cap;
      tagA.textContent = shots[ai].cap;
      tagB.textContent = shots[bi].cap;
      // .wipe-picks-b also carries .wipe-picks, so the A group has to exclude it
      host.querySelectorAll(".wipe-picks:not(.wipe-picks-b) button").forEach(function (b, i) {
        b.setAttribute("aria-pressed", String(i === ai));
        b.classList.toggle("on", i === ai);
      });
      host.querySelectorAll(".wipe-picks-b button").forEach(function (b, i) {
        b.setAttribute("aria-pressed", String(i === bi));
        b.classList.toggle("on", i === bi);
      });
      setSplit(split);
    }

    function setSplit(pct) {
      split = Math.max(0, Math.min(100, pct));
      // clip from the right so B is revealed as the handle moves left
      clip.style.clipPath = "inset(0 0 0 " + split + "%)";
      line.style.left = split + "%";
      line.setAttribute("aria-valuenow", Math.round(split));
    }

    // pointer drag anywhere on the stage, so the whole image is the control
    let dragging = false;
    function fromEvent(e) {
      const r = stage.getBoundingClientRect();
      setSplit(((e.clientX - r.left) / r.width) * 100);
    }
    stage.addEventListener("pointerdown", function (e) {
      dragging = true; stage.setPointerCapture(e.pointerId); fromEvent(e);
    });
    stage.addEventListener("pointermove", function (e) { if (dragging) fromEvent(e); });
    stage.addEventListener("pointerup", function () { dragging = false; });
    stage.addEventListener("pointercancel", function () { dragging = false; });

    // keyboard: the divider is the focusable control
    line.tabIndex = 0;
    line.setAttribute("role", "slider");
    line.setAttribute("aria-label", "Reveal");
    line.setAttribute("aria-valuemin", "0");
    line.setAttribute("aria-valuemax", "100");
    line.addEventListener("keydown", function (e) {
      const step = e.shiftKey ? 10 : 2;
      if (e.key === "ArrowLeft") { setSplit(split - step); e.preventDefault(); }
      if (e.key === "ArrowRight") { setSplit(split + step); e.preventDefault(); }
      if (e.key === "Home") { setSplit(0); e.preventDefault(); }
      if (e.key === "End") { setSplit(100); e.preventDefault(); }
    });

    paint();

    // a one-off nudge when it first scrolls into view, so it reads as a
    // control rather than as a photo with a line drawn on it
    if ("IntersectionObserver" in window &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.disconnect();
          let t = 0;
          const id = setInterval(function () {
            t += 0.06;
            setSplit(50 + Math.sin(t * Math.PI) * 16);
            if (t >= 1) { clearInterval(id); setSplit(50); }
          }, 16);
        });
      }, { threshold: 0.45 });
      io.observe(host);
    }
  });
})();
