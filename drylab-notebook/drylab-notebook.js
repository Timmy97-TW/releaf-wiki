/* =============================================================================
   ReLeaf: Dry Lab Notebook
   The notebook is plain markup; this adds four things on top of it:
     1. a link into a closed month (index, milestone, #hash) opens that month
     2. "Open all" / "Close all"
     3. "+N more" under an entry's photos
     4. a photo viewer that steps through one entry's photos
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---- 1. open the month a link points into ---------------------------- */
  function reveal(id) {
    const t = id && document.getElementById(id);
    if (!t) return;
    const fold = t.matches("details") ? t : (t.querySelector(".nbmonth__fold") || t.closest("details.nbmonth__fold"));
    if (fold && !fold.open) fold.open = true;
    requestAnimationFrame(() => t.scrollIntoView({ block: "start" }));
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute("href").length < 2) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    const t = document.getElementById(id);
    if (!t || !t.closest(".nbmonths")) return;
    e.preventDefault();
    history.replaceState(null, "", "#" + id);
    reveal(id);
  });
  if (location.hash) reveal(decodeURIComponent(location.hash.slice(1)));

  /* ---- 2. open all / close all ------------------------------------------ */
  const allBtn = $("#nb-all");
  const folds = $$(".nbmonth__fold");
  const sync = () => {
    const allOpen = folds.every((f) => f.open);
    allBtn.textContent = allOpen ? "Close all" : "Open all";
    allBtn.setAttribute("aria-pressed", String(allOpen));
  };
  if (allBtn) {
    allBtn.addEventListener("click", () => {
      const open = !folds.every((f) => f.open);
      folds.forEach((f) => { f.open = open; });
      sync();
    });
    folds.forEach((f) => f.addEventListener("toggle", sync));
    sync();
  }

  /* the month you are reading, marked in the index */
  const idx = new Map($$(".mindex__list a").map((a) => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window) {
    const seen = new Map();
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => seen.set(en.target.id, en.isIntersecting));
      let cur = null;
      for (const s of $$(".nbmonth")) if (seen.get(s.id)) { cur = s.id; break; }
      idx.forEach((a, id) => a.classList.toggle("is-here", id === cur));
    }, { rootMargin: "-140px 0px -45% 0px" });
    $$(".nbmonth").forEach((s) => io.observe(s));
  }

  /* ---- 3. more photos ---------------------------------------------------- */
  $$(".ph-more").forEach((b) => {
    b.addEventListener("click", () => {
      const row = b.closest(".photos");
      const open = row.classList.toggle("is-collapsed") === false;
      b.setAttribute("aria-expanded", String(open));
      b.textContent = open ? "Show fewer" : "+" + row.querySelectorAll(".is-extra").length + " more";
    });
  });

  /* ---- 4. photo viewer --------------------------------------------------- */
  const box = $("#nblb");
  if (!box) return;
  const img = $("img", box), cap = $(".nblb__cap", box), meta = $(".nblb__meta", box);
  let list = [], at = 0, opener = null;

  const show = (k) => {
    at = (k + list.length) % list.length;
    const a = list[at];
    img.src = a.getAttribute("href");
    img.alt = a.querySelector("img").alt;
    cap.textContent = a.dataset.cap || "";
    const day = a.dataset.date || "";
    meta.textContent = day + (list.length > 1 ? "  ·  " + (at + 1) + " of " + list.length : "");
    const multi = list.length > 1;
    $(".nblb__prev", box).hidden = !multi;
    $(".nblb__next", box).hidden = !multi;
  };
  const open = (a) => {
    opener = a;
    list = $$(".ph", a.closest(".photos"));
    box.hidden = false;
    document.body.style.overflow = "hidden";
    show(list.indexOf(a));
    $(".nblb__close", box).focus();
  };
  const close = () => {
    box.hidden = true;
    img.removeAttribute("src");
    document.body.style.overflow = "";
    if (opener) opener.focus();
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest(".ph");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open(a);
  });
  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.closest(".nblb__close")) close();
    else if (e.target.closest(".nblb__prev")) show(at - 1);
    else if (e.target.closest(".nblb__next")) show(at + 1);
  });
  document.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(at - 1);
    else if (e.key === "ArrowRight") show(at + 1);
    else if (e.key === "Tab") {
      const f = $$("button:not([hidden])", box);
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
})();
