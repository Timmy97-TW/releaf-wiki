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
