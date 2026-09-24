/* =============================================================================
   ReLeaf: the Members page renderer
   Reads SECTIONS (and LABELS, for the task names) from assets/data/roster.js.

   Each card is a list item. The person's name is a real <button> inside the
   card's heading, stretched over the card by CSS, so the whole card is one
   click target and the heading still shows up in a screen reader's headings
   list. The profile is a native <dialog> opened with showModal(): the page
   behind it is inert, Tab stays inside, Escape closes it, and focus goes back
   to the card that opened it.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------- helpers ---- */

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const initials = (name) =>
    name.replace(/^(Dr|Prof)\.?\s+/i, "").trim().split(/\s+/).slice(0, 2)
      .map((w) => w[0]).join("").toUpperCase();

  /* The roster once split tasks into owned (`own`) and joined (`mem`). Both
     are still read so an older roster keeps rendering; all land in one list. */
  const tasksOf = (m) => {
    const all = (m.tasks || []).concat(m.own || [], m.mem || []);
    return all.filter((t, i) => all.indexOf(t) === i);
  };

  const metaOf = (m) => [m.grade, m.school, m.track].filter(Boolean).join(" · ");

  /* roster.js stores paths relative to the wiki root; the page sits one folder
     down, so read the same data-base the nav uses and put it in front. */
  const BASE = (function () {
    const nav = document.getElementById("site-nav");
    return nav && nav.dataset.base != null ? nav.dataset.base : "";
  })();

  const shownMembers = (sec) =>
    (sec.groups || []).reduce((a, g) => a.concat((g.members || []).filter((m) => !m.hidden)), []);

  /* "Tasks  Lab, Plant, Education" as one plain line */
  function taskLine(m, cls) {
    const t = tasksOf(m);
    if (!t.length) return null;
    const p = el("p", cls);
    p.appendChild(el("b", null, "Tasks "));
    p.appendChild(document.createTextNode(t.join(", ")));
    return p;
  }

  /* ------------------------------------------------------------- card ---- */

  function buildCard(m) {
    const card = el("li", "card");
    card.id = "member-" + slug(m.name);

    const media = el("div", "card__media");
    if (m.photo) {
      const img = el("img");
      img.src = BASE + m.photo;
      img.alt = "Portrait of " + m.name;
      img.width = 720; img.height = 900;
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
    } else {
      media.classList.add("card__media--empty");
      media.appendChild(el("span", "card__initials", initials(m.name)));
      media.appendChild(el("span", "card__pending", "Portrait to come"));
    }
    card.appendChild(media);

    const body = el("div", "card__body");

    const h = el("h3", "card__name");
    const btn = el("button", "card__open", m.name);
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.addEventListener("click", () => openModal(m, btn));
    h.appendChild(btn);
    body.appendChild(h);

    /* the role reads above the name (CSS order) but follows it in the DOM,
       so a screen reader hears the name first */
    if (m.role) body.appendChild(el("p", "card__role", m.role));

    const meta = metaOf(m);
    if (meta) body.appendChild(el("p", "card__meta", meta));

    const tasks = taskLine(m, "card__tasks");
    if (tasks) body.appendChild(tasks);

    if (m.bio) body.appendChild(el("p", "card__bio", m.bio));
    body.appendChild(el("span", "card__more", "Open profile"));
    card.appendChild(body);

    return card;
  }

  /* ---------------------------------------------------------- sections --- */

  function render() {
    const root = document.getElementById("roster");
    const jump = document.getElementById("jump-links");

    root.appendChild(legend());

    SECTIONS.forEach((sec) => {
      const s = el("section", "section");
      s.setAttribute("aria-labelledby", sec.id);

      const h = el("h2", "section__title", sec.title);
      h.id = sec.id;
      s.appendChild(h);
      if (sec.note) sec.note.split("\n").forEach((line) =>
        s.appendChild(el("p", "section__note", line)));

      const people = shownMembers(sec);
      if (people.length) {
        const grid = el("ul", "roster-grid");
        people.forEach((m) => grid.appendChild(buildCard(m)));
        s.appendChild(grid);
      } else if (!sec.note) {
        s.appendChild(el("p", "section__note", "Nobody is listed in this section yet."));
      }

      root.appendChild(s);

      const a = el("a", null, sec.title);
      a.href = "#" + sec.id;
      jump.appendChild(a);
    });

    count();
  }

  /* "31 student members, 9 student advisors and 6 instructors, from 9
     schools", counted from the roster so it can never drift from it */
  function count() {
    const out = document.getElementById("roster-count");
    if (!out) return;
    const parts = SECTIONS.map((s) => [shownMembers(s).length, s.title.toLowerCase()])
      .filter(([n]) => n > 0).map(([n, t]) => n + " " + (n === 1 ? t.replace(/s$/, "") : t));
    if (!parts.length) return;
    const list = parts.length > 1
      ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
      : parts[0];
    const schools = new Set();
    SECTIONS.forEach((s) => shownMembers(s).forEach((m) => { if (m.school) schools.add(m.school); }));
    out.textContent = ": " + list + (schools.size > 1 ? ", from " + schools.size + " schools" : "");
  }

  /* what the subteam named on a card stands for */
  function legend() {
    const wrap = el("div", "legend");
    const inner = el("div", "legend__inner");
    inner.appendChild(el("p", "legend__title", "What a major means"));
    const dl = el("dl", "legend__tracks");
    [
      ["Wet Lab major",
       "Passed wet lab training and the molecular cloning exam, on paper and at " +
       "the bench. Sixteen lab hours a month in term and forty-eight in the " +
       "intensive weeks, on top of the required session hours. " +
       "Handles wet lab work without supervision."],
      ["Dry Lab major",
       "Worked through research method, data analysis, R, wiki coding and " +
       "molecular docking, and takes a dry lab task from brief to result."],
      ["Human Practices major",
       "Worked through outreach writing, education material planning, " +
       "entrepreneurship case studies and event hosting, and can run an event " +
       "start to finish."]
    ].forEach(([label, text]) => {
      const col = el("div", "legend__track");
      col.appendChild(el("dt", null, label));
      col.appendChild(el("dd", null, text));
      dl.appendChild(col);
    });
    inner.appendChild(dl);
    wrap.appendChild(inner);
    return wrap;
  }

  /* underline the section you are reading in the jump bar */
  function scrollSpy() {
    const links = [...document.querySelectorAll("#jump-links a")];
    const targets = links.map((a) => document.getElementById(a.hash.slice(1)));
    const mark = () => {
      const bar = document.querySelector(".toolbar");
      const line = (bar ? bar.getBoundingClientRect().bottom : 120) + 40;
      let i = -1;
      targets.forEach((t, n) => { if (t && t.getBoundingClientRect().top <= line) i = n; });
      links.forEach((a, n) => {
        a.classList.toggle("is-current", n === i);
        if (n === i) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    };
    let queued = false;
    const soon = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; mark(); }); } };
    mark();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
  }

  /* ----------------------------------------------------------- profile --- */

  let opener = null;

  /* one slot of the photo pair: the photo in its own shape, or an empty
     frame that says which photo is still to come */
  function shot(src, alt, missing) {
    const fig = el("figure", "profile__shot");
    if (src) {
      const img = el("img");
      img.alt = alt;
      img.decoding = "async";
      img.src = BASE + src;
      fig.appendChild(img);
    } else {
      fig.classList.add("profile__shot--empty");
      fig.appendChild(el("span", null, missing));
    }
    return fig;
  }

  function openModal(m, from) {
    opener = from || document.activeElement;
    const dlg = document.getElementById("bio-modal");

    const pair = dlg.querySelector(".profile__pair");
    pair.innerHTML = "";
    const shots = [
      shot(m.workPhoto, m.name + " at work", "Working photo to come"),
      shot(m.goofyPhoto, m.name + ", being goofy", "Goofy photo to come")
    ];
    shots.forEach((s) => pair.appendChild(s));
    /* neither photo in yet: two short ruled frames, not two tall blanks */
    pair.classList.toggle("profile__pair--none", !m.workPhoto && !m.goofyPhoto);

    /* both slots share one height; each keeps its own aspect ratio, so the
       row height is the width divided by the sum of the two */
    const ratio = (fig) => {
      const img = fig.querySelector("img");
      return img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 4 / 3;
    };
    const fit = () => {
      const r = shots.map(ratio);
      shots.forEach((s, i) => s.style.setProperty("--r", r[i].toFixed(4)));
      pair.style.setProperty("--ratio-sum", (r[0] + r[1]).toFixed(4));
    };
    shots.forEach((s) => { const img = s.querySelector("img"); if (img) img.addEventListener("load", fit); });
    fit();

    const role = dlg.querySelector(".profile__role");
    role.textContent = m.role || "";
    role.hidden = !m.role;
    dlg.querySelector(".profile__name").textContent = m.name;
    const meta = metaOf(m);
    const metaEl = dlg.querySelector(".profile__meta");
    metaEl.textContent = meta;
    metaEl.hidden = !meta;
    dlg.querySelector(".profile__text").textContent = m.bio || "Bio to come.";

    const tasks = dlg.querySelector(".profile__tasks");
    tasks.innerHTML = "";
    const t = taskLine(m, "x");
    if (t) while (t.firstChild) tasks.appendChild(t.firstChild);

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    dlg.scrollTop = 0;
    dlg.querySelector(".profile__close").focus();
  }

  function wireModal() {
    const dlg = document.getElementById("bio-modal");
    const close = () => { if (dlg.open) dlg.close(); };
    dlg.querySelector(".profile__close").addEventListener("click", close);
    /* a click on the backdrop lands on the dialog element itself */
    dlg.addEventListener("click", (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) close();
    });
    /* showModal() makes the page behind inert, but Tab can still leave for
       the browser's own toolbar; keep it cycling inside the profile */
    dlg.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = [...dlg.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")]
        .filter((x) => !x.hidden && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    dlg.addEventListener("close", () => {
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    });
  }

  /* --------------------------------------------------------------- boot -- */

  document.addEventListener("DOMContentLoaded", () => {
    render();
    scrollSpy();
    wireModal();
  });
})();
