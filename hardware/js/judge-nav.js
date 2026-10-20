/* The judging rail's scroll spy (20 Oct 2026). css/judge-nav.css has the why.

   Each criterion (li.jn) names its sections in data-scope (ids, space separated). A part's scope runs from the part
   to the next part; any other section's scope is the section itself. The criterion whose scope holds the reading
   line (a third of the way down the window) is marked .is-here, which unfolds its question and links. Links into a
   DBTL cycle that is not showing are opened by hwdoc.js's own link handling, as every link on the page is. */
(function () {
  "use strict";
  var nav = document.querySelector(".judge-nav");
  if (!nav) return;
  nav.classList.add("js-on");

  /* Put the rail in the record's own grid row. The record (.doc) is auto-placed, so its row is found from the
     wrap's resolved row tracks; the rail is out of the flow (display none) while this is measured. */
  var wrap = nav.parentElement, doc = wrap && wrap.querySelector(":scope > .doc");
  function place() {
    if (!doc) return;
    nav.classList.remove("is-placed"); nav.style.gridRow = "";
    var rows = getComputedStyle(wrap).gridTemplateRows.split(" ").map(parseFloat);
    var top = doc.getBoundingClientRect().top - wrap.getBoundingClientRect().top - (parseFloat(getComputedStyle(wrap).paddingTop) || 0);
    var y = 0, row = 1;
    for (var i = 0; i < rows.length; i++) { if (Math.abs(y - top) < 2 || y > top) { row = i + 1; break; } y += rows[i] + (parseFloat(getComputedStyle(wrap).rowGap) || 0); row = i + 2; }
    nav.style.gridRow = String(row);
    nav.classList.add("is-placed");
  }
  place();
  window.addEventListener("load", place);
  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(place, 150); });
  var items = [].slice.call(nav.querySelectorAll("li.jn"));

  function scopeOf(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    var out = [el];
    if (el.classList.contains("part")) {
      for (var n = el.nextElementSibling; n && !(n.classList && n.classList.contains("part")); n = n.nextElementSibling) out.push(n);
    }
    return out;
  }
  function contains(els, y) {
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (!r.height) continue;
      if (r.top <= y && r.bottom > y) return true;
    }
    return false;
  }
  var cur = null, raf = 0;
  function spy() {
    raf = 0;
    var y = window.innerHeight / 3, hit = null;
    items.forEach(function (li) {
      if (hit) return;
      var ids = (li.getAttribute("data-scope") || "").split(/\s+/).filter(Boolean), els = [];
      ids.forEach(function (id) { els = els.concat(scopeOf(id)); });
      if (contains(els, y)) hit = li;
    });
    if (hit === cur) return;
    if (cur) cur.classList.remove("is-here");
    if (hit) hit.classList.add("is-here");
    cur = hit;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(spy); }
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  window.addEventListener("load", kick);
  spy();
})();
