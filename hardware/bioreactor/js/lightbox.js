// Click a photograph to see it at full size.
//
// This is the lightbox out of ../js/figures.js, on its own. That file also
// stamped "Figure N" into every caption and resolved every cross-reference to
// "Figure 4", and this record no longer numbers its figures: captions carry a
// short bolded lead, and the prose names the thing it is pointing at. Loading
// figures.js here would put the numbers back, so only the part worth keeping
// is kept. If the rest of the hardware pages drop their figure numbers too,
// this belongs back in the shared file.
//
// Several figures are dense — a 25-row dashboard, a blot — and at column width
// they are unreadable.
(function () {
  const doc = document.querySelector(".doc");
  if (!doc) return;

  const shots = Array.prototype.filter.call(
    doc.querySelectorAll(".frame:not(.empty) .frame-img img"),
    function (img) { return img.getAttribute("src"); }
  );
  if (!shots.length) return;

  let box = null;
  let opener = null;

  function close() {
    if (!box) return;
    box.classList.remove("open");
    document.body.style.overflow = "";
    const b = box;
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 220);
    box = null;
    // Closing used to drop focus on <body>, so the next Tab started the page
    // again. Put it back where the reader opened the view from.
    if (opener) { opener.focus(); opener = null; }
  }

  function open(img, from) {
    close();
    opener = from || null;
    const fig = img.closest("figure");
    const cap = fig ? fig.querySelector("figcaption") : null;

    box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", img.alt || "Photograph");
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
    wrap.setAttribute("aria-label", "Enlarge: " + (img.alt || "photograph"));
    wrap.addEventListener("click", function () { open(img, wrap); });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img, wrap); }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();
