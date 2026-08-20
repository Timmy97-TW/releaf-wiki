// Figure and table numbering, cross-references, and a lightbox.
//
// Numbering is derived from document order at load rather than written into the
// markup, so inserting a figure halfway up the record cannot leave the ones
// below it mislabelled. Anything that wants to refer to a figure writes
// <a class="xref" href="#fig-cuvette"></a> and gets "Figure 4" filled in here.
//
// Empty slots (.frame.empty) are deliberately numbered too. They are real
// figures that simply have no photograph yet, and skipping them would renumber
// the whole record the day someone drops the image in.
(function () {
  const doc = document.querySelector(".doc");
  if (!doc) return;

  /* ---------- number the figures ---------- */
  const figs = Array.prototype.slice.call(doc.querySelectorAll("figure"));
  figs.forEach(function (fig, i) {
    const n = i + 1;
    if (!fig.id) fig.id = "fig-" + n;
    fig.setAttribute("data-fignum", n);

    const cap = fig.querySelector("figcaption");
    if (!cap || cap.querySelector(".fignum")) return;

    const label = document.createElement("span");
    label.className = "fignum";
    label.textContent = "Figure " + n;
    cap.insertBefore(document.createTextNode(" "), cap.firstChild);
    cap.insertBefore(label, cap.firstChild);
  });

  /* ---------- number the tables ---------- */
  const tables = Array.prototype.slice.call(doc.querySelectorAll("table"));
  tables.forEach(function (t, i) {
    const n = i + 1;
    if (!t.id) t.id = "tbl-" + n;
    const cap = t.querySelector("caption");
    if (!cap || cap.querySelector(".fignum")) return;
    const label = document.createElement("span");
    label.className = "fignum";
    label.textContent = "Table " + n;
    cap.insertBefore(document.createTextNode(" "), cap.firstChild);
    cap.insertBefore(label, cap.firstChild);
  });

  /* ---------- resolve cross-references ---------- */
  // <a class="xref" href="#fig-foo"></a> -> "Figure 4". Written this way so the
  // prose never hard-codes a number that a later edit would falsify.
  doc.querySelectorAll("a.xref").forEach(function (a) {
    const target = document.querySelector(a.getAttribute("href") || "");
    if (!target) { a.classList.add("xref-broken"); return; }
    const num = target.getAttribute("data-fignum");
    const kind = target.tagName === "TABLE" ? "Table" : "Figure";
    if (num) a.textContent = kind + " " + num;
    else if (target.id.indexOf("tbl-") === 0) a.textContent = "Table " + target.id.slice(4);
  });

  /* ---------- lightbox ---------- */
  // Several figures are dense — a 25-row dashboard, a calibration ladder — and
  // at column width they are unreadable. Click to see them at full size.
  const shots = Array.prototype.filter.call(
    doc.querySelectorAll(".frame:not(.empty) .frame-img img"),
    function (img) { return img.getAttribute("src"); }
  );
  if (!shots.length) return;

  let box = null;

  function close() {
    if (!box) return;
    box.classList.remove("open");
    document.body.style.overflow = "";
    const b = box;
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 220);
    box = null;
  }

  function open(img) {
    close();
    const fig = img.closest("figure");
    const cap = fig ? fig.querySelector("figcaption") : null;

    box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", img.alt || "Figure");
    box.innerHTML =
      '<button class="lb-close" aria-label="Close">&times;</button>' +
      '<figure class="lb-fig">' +
        '<img src="' + img.getAttribute("src") + '" alt="' + (img.alt || "").replace(/"/g, "&quot;") + '">' +
        (cap ? '<figcaption>' + cap.innerHTML + "</figcaption>" : "") +
      "</figure>";
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    // next frame, so the opening transition has a state to move from
    requestAnimationFrame(function () { box.classList.add("open"); });
    const btn = box.querySelector(".lb-close");
    btn.focus();
    box.addEventListener("click", function (e) {
      // only the backdrop and the close button dismiss; clicking the photo
      // itself should not, or careful inspection keeps closing the view
      if (e.target === box || e.target === btn) close();
    });
  }

  shots.forEach(function (img) {
    const wrap = img.parentElement;
    wrap.classList.add("zoomable");
    wrap.setAttribute("role", "button");
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("aria-label", "Enlarge: " + (img.alt || "figure"));
    wrap.addEventListener("click", function () { open(img); });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img); }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();
