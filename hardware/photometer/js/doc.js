// Technical record — contents rail highlighting and smooth anchor scrolling.
(function () {
  const nav = document.getElementById("doc-nav");
  if (!nav) return;

  const links = Array.prototype.slice.call(nav.querySelectorAll("a"));
  const targets = links
    .map(function (a) {
      const el = document.querySelector(a.getAttribute("href"));
      return el ? { a: a, el: el } : null;
    })
    .filter(Boolean);
  if (!targets.length) return;

  // Highlight the part whose heading last passed the upper third of the screen.
  function update() {
    const line = window.innerHeight * 0.34;
    let active = null;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].el.getBoundingClientRect().top <= line) active = targets[i];
    }
    links.forEach(function (a) { a.classList.toggle("on", !!active && a === active.a); });
  }

  let ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { update(); ticking = false; });
  }, { passive: true });
  window.addEventListener("resize", update);
  update();

  // Smooth scrolling for in-document links, unless the reader prefers otherwise.
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.addEventListener("click", function (e) {
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const el = document.querySelector(a.getAttribute("href"));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  });
})();
