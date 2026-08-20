/* =============================================================================
   ReLeaf: standard sub-page behaviour
   -----------------------------------------------------------------------------
   Everything here reads the markup that is already on the page and adds to it.
   Nothing is required for the page to make sense: with JavaScript off you get
   the same prose, the same figures and the same references, just without the
   contents rail, the numbering and the lightbox. That is deliberate. A judge
   on a locked-down machine still has to be able to read the argument.

   Five jobs:
     1. number every section and sub-section
     2. build the contents rail from those headings and follow the scroll
     3. turn [n] in the prose into a link to reference n, and back again
     4. run any tab groups
     5. open figures full-window on click
   ========================================================================== */
(function () {
  "use strict";

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const slug = (t) =>
    t.toLowerCase().trim()
      .replace(/[^\w一-鿿\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  /* ---- 1 + 2. numbering and contents ------------------------------------ */

  function outline() {
    const body = $(".pagebody");
    const toc  = $(".toc");
    if (!body) return;

    const heads = $$("h2, h3", body).filter((h) => !h.closest(".refs") && !h.dataset.noToc);
    if (!heads.length) { if (toc) toc.remove(); return; }

    const list = document.createElement("ol");
    list.className = "toc__list";

    let major = 0, minor = 0;

    heads.forEach((h) => {
      const isSub = h.tagName === "H3";
      if (isSub) { minor += 1; } else { major += 1; minor = 0; }
      /* an h3 before any h2 has nothing to hang off, so it stays unnumbered */
      const no = isSub ? (major ? major + "." + minor : "") : major + ".";

      if (!h.id) h.id = slug(h.textContent);

      if (no) {
        const tag = document.createElement("span");
        tag.className = "sec__no";
        tag.textContent = no;
        tag.setAttribute("aria-hidden", "true");   /* screen readers read the words */
        h.prepend(tag);
      }

      const a = document.createElement("a");
      a.className = "anchor";
      a.href = "#" + h.id;
      a.textContent = "¶";
      a.setAttribute("aria-label", "Link to this section");
      h.append(a);

      const li = document.createElement("li");
      if (isSub) li.className = "is-sub";
      const link = document.createElement("a");
      link.href = "#" + h.id;
      link.textContent = (no ? no + " " : "") + h.textContent.replace(/¶$/, "").replace(/^[\d.]+\s*/, "").trim();
      li.appendChild(link);
      list.appendChild(li);
    });

    if (!toc) return;
    const inner = $(".toc__inner", toc) || toc;
    inner.appendChild(list);

    /* The markup ships the contents open, so a reader with JavaScript off
       still gets it. On a narrow screen it is a wall between the header and
       the first paragraph, so fold it away once we know we can.             */
    if (window.matchMedia && window.matchMedia("(max-width: 1039px)").matches) {
      toc.open = false;
    }

    spy(heads, list);
  }

  /* highlight the heading the reader is actually looking at. rootMargin pins
     the trigger line a third of the way down, so a heading counts as current
     once it has settled rather than the instant it clips the top edge.       */
  function spy(heads, list) {
    if (!("IntersectionObserver" in window)) return;
    const links = new Map($$("a", list).map((a) => [a.getAttribute("href").slice(1), a]));
    let current = null;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) current = e.target.id; });
        links.forEach((a, id) => a.classList.toggle("is-active", id === current));
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    heads.forEach((h) => io.observe(h));
  }

  /* ---- 3. citations ------------------------------------------------------ */
  /* Write [3] in the prose. This finds it, links it to the third <li> in
     .refs ol, and gives that <li> a back-link to the first mention.          */

  function citations() {
    const refs = $(".refs ol");
    if (!refs) return;
    const items = $$("li", refs);
    items.forEach((li, i) => { if (!li.id) li.id = "ref-" + (i + 1); });

    const firstMention = {};
    const walker = document.createTreeWalker($(".pagebody"), NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement.closest(".refs, a, code, pre, .toc")
          ? NodeFilter.FILTER_REJECT
          : /\[\d+(\s*,\s*\d+)*\]/.test(n.nodeValue)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT
    });

    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);

    texts.forEach((node) => {
      const frag = document.createDocumentFragment();
      let last = 0;
      node.nodeValue.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, nums, at) => {
        frag.append(node.nodeValue.slice(last, at));
        frag.append("[");
        nums.split(",").map((n) => n.trim()).forEach((n, i, arr) => {
          const idx = parseInt(n, 10);
          if (items[idx - 1]) {
            const a = document.createElement("a");
            a.className = "cite";
            a.href = "#ref-" + idx;
            /* only the first mention gets an id; the reference links back
               to it, and a second [1] must not steal the anchor */
            if (!firstMention[idx]) a.id = firstMention[idx] = "cite-" + idx;
            a.textContent = n;
            frag.append(a);
          } else {
            frag.append(n);   /* a number with no reference behind it stays plain */
          }
          if (i < arr.length - 1) frag.append(", ");
        });
        frag.append("]");
        last = at + match.length;
        return match;
      });
      frag.append(node.nodeValue.slice(last));
      node.replaceWith(frag);
    });

    items.forEach((li, i) => {
      const back = firstMention[i + 1];
      if (!back) return;
      const a = document.createElement("a");
      a.href = "#" + back;
      a.textContent = " ↩";
      a.setAttribute("aria-label", "Back to where this was cited");
      li.append(a);
    });
  }

  /* ---- 4. tabs ----------------------------------------------------------- */
  /* <div class="tabs"> with .tabs__btn[data-panel] and .tabs__panel[id].
     The open panel is written into the URL hash so a link can point at one.   */

  function tabs() {
    $$(".tabs").forEach((group) => {
      const btns   = $$(".tabs__btn", group);
      const panels = $$(".tabs__panel", group);
      if (!btns.length) return;

      const show = (id, push) => {
        btns.forEach((b) => {
          const on = b.dataset.panel === id;
          b.setAttribute("aria-selected", String(on));
          b.tabIndex = on ? 0 : -1;
        });
        panels.forEach((p) => { p.hidden = p.id !== id; });
        if (push && history.replaceState) history.replaceState(null, "", "#" + id);
      };

      btns.forEach((b) => b.addEventListener("click", () => show(b.dataset.panel, true)));

      /* A contents link, or a shared URL, can point at a heading that lives
         inside a closed panel. Hang the opener on the panel so the handler
         below can reach it without knowing anything about this group.        */
      panels.forEach((p) => { p.openPanel = () => show(p.id, false); });

      /* left/right arrows move between tabs, which is what a screen reader
         user will try first */
      group.querySelector(".tabs__strip").addEventListener("keydown", (e) => {
        const i = btns.findIndex((b) => b.getAttribute("aria-selected") === "true");
        let n = null;
        if (e.key === "ArrowRight") n = (i + 1) % btns.length;
        if (e.key === "ArrowLeft")  n = (i - 1 + btns.length) % btns.length;
        if (n === null) return;
        e.preventDefault();
        show(btns[n].dataset.panel, true);
        btns[n].focus();
      });

      const fromHash = panels.find((p) => "#" + p.id === location.hash);
      show(fromHash ? fromHash.id : btns[0].dataset.panel, false);
    });

    /* Open whichever panel holds the thing being linked to, then let the
       browser do the scrolling. Without this, "3.2 Hydroponics" in the
       contents jumps to a hidden element and looks broken.                   */
    const reveal = (hash) => {
      if (!hash || hash.length < 2) return;
      let target;
      try { target = document.getElementById(decodeURIComponent(hash.slice(1))); }
      catch (e) { return; }
      const panel = target && target.closest(".tabs__panel");
      if (panel && panel.openPanel) panel.openPanel();
    };

    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a) reveal(a.getAttribute("href"));
    });
    window.addEventListener("hashchange", () => reveal(location.hash));
    reveal(location.hash);
  }

  /* ---- 5. lightbox ------------------------------------------------------- */

  function lightbox() {
    const imgs = $$(".fig:not(.fig--pending) img");
    if (!imgs.length) return;

    const box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML =
      '<button class="lightbox__close" aria-label="Close">×</button>' +
      '<figure style="margin:0;text-align:center"><img alt="" /><figcaption></figcaption></figure>';
    document.body.appendChild(box);

    const big = $("img", box);
    const cap = $("figcaption", box);
    let opener = null;

    const close = () => {
      box.classList.remove("is-open");
      document.body.style.overflow = "";
      if (opener) opener.focus();
    };

    imgs.forEach((img) => {
      img.addEventListener("click", () => {
        opener = img;
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        const c = img.closest("figure") && img.closest("figure").querySelector("figcaption");
        cap.textContent = c ? c.textContent.replace(/¶$/, "") : "";
        box.classList.add("is-open");
        document.body.style.overflow = "hidden";
        $(".lightbox__close", box).focus();
      });
    });

    box.addEventListener("click", (e) => { if (e.target === box || e.target.closest(".lightbox__close")) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("is-open")) close(); });
  }

  const start = () => { outline(); citations(); tabs(); lightbox(); };

  /* The script is loaded at the foot of the page, so the document is usually
     still parsing when this runs. If it is not, because the file was added
     late or cached oddly, run straight away rather than waiting for an event
     that has already fired.                                                  */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
