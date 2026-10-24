// Section map — the card grid under the record's header.
//
// Two problems, one component. A judge landing on a long technical record can
// see what it contains before committing to a scroll; and below 1100px, where
// the sticky contents rail is hidden, this is the only table of contents the
// page has.
//
// It is generated from the document rather than written by hand, so it cannot
// drift out of step with the headings the way a maintained list would. Every
// top-level part is a `section.part` carrying an id on both instrument pages,
// which is the only structural assumption made here.
(function () {
  const doc = document.querySelector(".doc");
  const head = doc && doc.querySelector(".doc-head");
  if (!doc || !head) return;

  const parts = Array.prototype.slice.call(doc.querySelectorAll("section.part"));
  if (parts.length < 2) return;   // not enough structure to be worth a map

  // Leading numbers belong to the record's own numbering, which the map
  // restates in its own column — repeating them in the label reads as noise.
  function label(el) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return t.replace(/^\d+(\.\d+)*\s*/, "");
  }

  const nav = document.createElement("nav");
  nav.className = "doc-map";
  nav.setAttribute("aria-label", "Sections");

  parts.forEach(function (part, i) {
    const h2 = part.querySelector("h2");
    if (!h2 || !part.id) return;

    // The two records are shaped differently: the photometer's parts are bare
    // headers whose subsections follow as sibling `section.sec` elements, while
    // DiOPAL keeps its subsections inside the part. Collect both, and fall back
    // to h4 where a part has no h3 at all — otherwise DiOPAL's cards come out
    // empty and the map says nothing.
    const scope = [part];
    let el = part.nextElementSibling;
    while (el && !el.classList.contains("part")) { scope.push(el); el = el.nextElementSibling; }

    function collect(sel) {
      const found = [];
      scope.forEach(function (s) {
        s.querySelectorAll(sel).forEach(function (h) {
          const text = label(h);
          if (text && found.indexOf(text) === -1) found.push(text);
        });
      });
      return found;
    }

    let subs = collect("h3");
    if (!subs.length) subs = collect("h4");

    const card = document.createElement("a");
    card.className = "map-card";
    card.href = "#" + part.id;

    const shown = subs.slice(0, 4);
    const rest = subs.length - shown.length;

    card.innerHTML =
      '<span class="map-n">' + (i + 1 < 10 ? "0" : "") + (i + 1) + "</span>" +
      '<span class="map-t">' + label(h2) + "</span>" +
      (shown.length
        ? '<span class="map-sub">' +
            shown.map(function (s) { return "<span>" + s + "</span>"; }).join("") +
            (rest > 0 ? '<span class="map-more">+' + rest + " more</span>" : "") +
          "</span>"
        : "");

    nav.appendChild(card);
  });

  if (!nav.children.length) return;
  head.parentNode.insertBefore(nav, head.nextSibling);
})();
