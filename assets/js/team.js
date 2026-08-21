/* =============================================================================
   ReLeaf: the team page renderer
   Reads LABELS, LABEL_GRADIENTS and SECTIONS from assets/data/roster.js.
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
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  /* Generated placeholder portrait, keeps the page whole until a photo lands. */
  const placeholder = (name) => {
    const hues = ["#e3f0e8", "#e8eef3", "#f2ece2", "#eee7f2", "#e6f1f2"];
    const bg = hues[name.length % hues.length];
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">' +
      '<rect width="400" height="500" fill="' + bg + '"/>' +
      '<circle cx="200" cy="250" r="96" fill="#ffffff" opacity=".7"/>' +
      '<text x="200" y="250" dy=".35em" font-family="Inter,Helvetica,Arial,sans-serif" ' +
      'font-size="84" font-weight="700" fill="#23684a" text-anchor="middle">' +
      initials(name) + "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };

  const tagsOf = (m) =>
    (m.own || []).map((t) => ({ label: t, own: true }))
      .concat((m.mem || []).map((t) => ({ label: t, own: false })));

  const metaOf = (m) => [m.grade, m.school].filter(Boolean).join(" · ");
  const trackOf = (m) => (m.track && m.level) ? m.track + " · " + m.level : "";

  /* On a card the role badge usually names the subteam already, so the track
     badge drops it and shows the level alone. It only spells the subteam out
     when the two differ, which is where it carries real information. */
  const trackShort = (m) => {
    if (!m.track || !m.level) return "";
    return (m.role && m.role.indexOf(m.track) === 0) ? m.level : trackOf(m);
  };

  /* colour maths so member pills read as a quiet wash of the owner colour */
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const tint = (hex, a) => "rgba(" + rgb(hex).join(",") + "," + a + ")";
  const shade = (hex, k) =>
    "rgb(" + rgb(hex).map((v) => Math.round(v * k)).join(",") + ")";

  /* one glyph per section, as an SVG mask so it inherits the link colour */
  const ICONS = {
    "project-leads":   "M5.4 2.5a1.05 1.05 0 0 1 1.05 1.05V21.4a1.05 1.05 0 0 1-2.1 0V3.55A1.05 1.05 0 0 1 5.4 2.5Zm1.05 1.6h11.9l-3 4.75 3 4.75H6.45Z",
    "student-leaders": "M12 2 14.6 8.2 21 8.9l-4.8 4.3 1.4 6.4L12 16.3 6.4 19.6l1.4-6.4L3 8.9l6.4-.7L12 2Z",
    "student-members": "M9 11.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8 .5a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM2.5 19.4c0-3 2.9-5.4 6.5-5.4s6.5 2.4 6.5 5.4v.6h-13v-.6Zm14.6-4.3c2.5.2 4.4 2 4.4 4.3v.6h-4.2v-.6c0-1.6-.6-3-1.6-4.1.4-.1.9-.2 1.4-.2Z",
    "advisors":        "M12 2.6 20.5 6v6.2c0 4.5-3.4 7.9-8.5 9.2-5.1-1.3-8.5-4.7-8.5-9.2V6L12 2.6Zm0 2.2L5.5 7.4v4.8c0 3.4 2.5 6 6.5 7.1 4-1.1 6.5-3.7 6.5-7.1V7.4L12 4.8Zm3.6 3.9-4.9 4.9-2.3-2.3-1.4 1.4 3.7 3.7 6.3-6.3-1.4-1.4Z",
    "support-team":    "M12 20.5S3.8 15.4 3.8 9.8A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.2 2.9c0 5.6-8.2 10.7-8.2 10.7Zm0-2.6c2-1.4 6.2-4.7 6.2-8.1a2.6 2.6 0 0 0-4.9-1.3L12 10.3l-1.3-1.8a2.6 2.6 0 0 0-4.9 1.3c0 3.4 4.2 6.7 6.2 8.1Z",
    "instructors":     "M9.5 2.8h5v2h-1v4.1l4.7 8.4a2.4 2.4 0 0 1-2.1 3.6H7.9a2.4 2.4 0 0 1-2.1-3.6l4.7-8.4V4.8h-1v-2Zm1.1 7.1L9 12.9h6l-1.6-3h-2.8Zm-2.7 5-.9 1.6c-.2.3 0 .7.4.7h8.2c.4 0 .6-.4.4-.7l-.9-1.6H7.9Z"
  };
  const iconURL = (id) =>
    'url("data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="' +
      (ICONS[id] || ICONS["student-members"]) + '"/></svg>') + '")';

  /* Which flavour of role badge: lead / vice / advisor / instructor */
  /* ---- where the photographs are -------------------------------------------
     roster.js stores paths relative to the wiki root ("assets/img/members/..").
     The page itself sits one folder down, so read the same data-base the nav
     uses and put it in front. One place, so roster.js never has to know how
     deep the page rendering it happens to be.                                 */
  const BASE = (function () {
    const nav = document.getElementById("site-nav");
    return nav && nav.dataset.base != null ? nav.dataset.base : "";
  })();
  const photo = (m) => (m.photo ? BASE + m.photo : placeholder(m.name));

  function roleKind(role) {
    if (!role) return "";
    if (/instructor/i.test(role)) return "instructor";
    if (/advisor/i.test(role))    return "advisor";
    if (/vice/i.test(role))       return "vice";
    if (/lead/i.test(role))       return "lead";
    return "vice";
  }

  function tagRow(member, cls) {
    const tags = tagsOf(member);
    if (!tags.length) return null;
    const wrap = el("div", cls || "card__tags");
    tags.forEach((t) => {
      const color = LABELS[t.label] || "#737373";
      const pill = el("span", "tag " + (t.own ? "tag--own" : "tag--mem"));
      if (t.own) {
        /* owner: saturated, filled, with a lead dot */
        pill.style.backgroundColor = color;
        const grad = (typeof LABEL_GRADIENTS !== "undefined") && LABEL_GRADIENTS[t.label];
        if (grad) pill.style.backgroundImage = grad;
        pill.appendChild(el("i", "tag__dot"));
        pill.appendChild(document.createTextNode(t.label));
      } else {
        /* member: the same hue washed back to a tint */
        pill.style.backgroundColor = tint(color, 0.16);
        pill.style.color = shade(color, 0.72);
        pill.textContent = t.label;
      }
      pill.title = t.label + (t.own ? ": task owner" : ": task member");
      wrap.appendChild(pill);
    });
    return wrap;
  }

  /* ------------------------------------------------------------- card ---- */

  function buildCard(m) {
    const kind = roleKind(m.role);
    /* the frame usually follows the role, but `frame:` can lift someone who
       carries a lead's weight without a lead's title */
    const frame = m.frame || kind;
    const card = el("article", "card" + (frame === "lead" || frame === "vice" ? " card--" + frame : ""));
    card.id = "member-" + slug(m.name);
    card.dataset.labels = tagsOf(m).map((t) => t.label).join("|");

    /* photo (+ optional hover photo, Marburg-style) */
    const media = el("div", "card__media");
    const img = el("img");
    img.src = photo(m);
    img.alt = m.name;
    img.loading = "lazy";
    media.appendChild(img);
    if (m.funPhoto) {
      const fun = el("img", "card__fun");
      fun.src = BASE + m.funPhoto;
      fun.alt = "";
      fun.setAttribute("aria-hidden", "true");
      fun.loading = "lazy";
      media.appendChild(fun);
    }
    card.appendChild(media);

    /* body */
    const body = el("div", "card__body");

    /* role first, then the subteam track. The track is deliberately quieter:
       it says what someone trained in, not what they run. */
    const track = trackOf(m);
    if (m.role || track) {
      const badges = el("div", "card__badges");
      if (m.role) badges.appendChild(el("span", "card__role card__role--" + kind, m.role));
      if (track) badges.appendChild(
        el("span", "card__track card__track--" + m.level.toLowerCase(), trackShort(m)));
      body.appendChild(badges);
    }

    body.appendChild(el("h3", "card__name", m.name));

    const meta = metaOf(m);
    if (meta) body.appendChild(el("p", "card__meta", meta));

    const tags = tagRow(m);
    if (tags) body.appendChild(tags);

    if (m.bio) {
      body.appendChild(el("p", "card__bio", m.bio));
      body.appendChild(el("span", "card__more", "Read more"));
    }

    card.appendChild(body);

    /* whole card opens the detail view */
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "More about " + m.name);
    const open = () => openModal(m);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    return card;
  }

  /* An unclaimed seat. The frame runs hotter than a lead's so it reads as
     something still to be won rather than something already held. */
  function openSeat() {
    const card = el("article", "card card--open");
    const media = el("div", "card__media card__media--open");
    media.appendChild(el("span", "open__mark", "?"));
    card.appendChild(media);
    const body = el("div", "card__body");
    const badges = el("div", "card__badges");
    badges.appendChild(el("span", "card__role card__role--open", "Project Lead"));
    body.appendChild(badges);
    card.appendChild(body);
    return card;
  }

  /* ---------------------------------------------------------- sections --- */

  function render() {
    const main = document.getElementById("team-main");
    const jump = document.getElementById("jump-links");

    main.appendChild(legend());

    SECTIONS.forEach((sec) => {
      const s = el("section", "section");

      const h = el("h2", "section__title", sec.title);
      h.id = sec.id;
      s.appendChild(h);
      if (sec.note) sec.note.split("\n").forEach((line) =>
        s.appendChild(el("p", "section__note", line)));

      let count = 0;

      /* seats nobody holds yet, drawn as open slots rather than an empty box */
      if (sec.openSlots) {
        const grid = el("div", "grid");
        for (let i = 0; i < sec.openSlots; i++) grid.appendChild(openSeat());
        s.appendChild(grid);
        count += sec.openSlots;
      }

      (sec.groups || []).forEach((g) => {
        const shown = (g.members || []).filter((m) => !m.hidden);
        if (!shown.length) return;
        count += shown.length;
        if (g.title) s.appendChild(el("h3", "group__title", g.title));
        const grid = el("div", "grid");
        shown.forEach((m) => grid.appendChild(buildCard(m)));
        s.appendChild(grid);
      });

      /* a thank-you for people who are named but not carded */
      if (sec.afterword) {
        const a = el("p", "section__after");
        a.appendChild(document.createTextNode(sec.afterword.text + " "));
        a.appendChild(el("span", "section__afternames", sec.afterword.names));
        s.appendChild(a);
      }

      /* a section with an explanatory note does not also need an empty box */
      if (!count && !sec.note) {
        s.appendChild(el("div", "empty", "Coming soon. This section fills in as roles are confirmed."));
      }

      main.appendChild(s);

      const a = el("a", null, sec.title);
      a.href = "#" + sec.id;
      const ico = el("i", "jump__icon");
      ico.style.setProperty("--icon", iconURL(sec.id));
      a.insertBefore(ico, a.firstChild);
      jump.appendChild(a);
    });
  }

  function legend() {
    const wrap = el("div", "legend");
    wrap.appendChild(el("p", "legend__title", "What a major means"));

    const tracks = el("div", "legend__tracks");
    [
      ["Wet Lab · Major",
       "Passed wet lab training and the molecular cloning exam, on paper and at " +
       "the bench. Sixteen lab hours a month in term and forty-eight in the " +
       "intensive weeks, on top of the required session hours. " +
       "Handles wet lab work without supervision."],
      ["Dry Lab · Major",
       "Worked through research method, data analysis, R, wiki coding and " +
       "molecular docking, and takes a dry lab task from brief to result."],
      ["Human Practices · Major",
       "Worked through outreach writing, education material planning, " +
       "entrepreneurship case studies and event hosting, and can run an event " +
       "start to finish."]
    ].forEach(([label, text]) => {
      const col = el("div", "legend__track");
      col.appendChild(el("span", "card__track card__track--major", label));
      col.appendChild(el("p", "legend__def", text));
      tracks.appendChild(col);
    });
    wrap.appendChild(tracks);

    const tasks = el("div", "legend__tasks");
    const task = (own, term, def) => {
      const item = el("p", "legend__task");
      const pill = el("span", "tag " + (own ? "tag--own key__own" : "tag--mem key__mem"));
      if (own) pill.appendChild(el("i", "tag__dot"));
      pill.appendChild(document.createTextNode("Task"));
      item.appendChild(pill);
      item.appendChild(el("b", "legend__term", term));
      item.appendChild(el("span", "legend__def", def));
      return item;
    };
    tasks.appendChild(task(true, "Task owner",
      "keeps the task moving, does it well, and is our main line to the instructors."));
    tasks.appendChild(task(false, "Task member",
      "contributed to this task."));
    wrap.appendChild(tasks);

    /* Every task on the board, in its own colour. The two pills above explain
       what owning and being on a task mean; this says what the tasks ARE, so a
       reader can match a colour on a card to a name without hunting for
       somebody who happens to own it. Built from LABELS, so a task added to
       the roster appears here on its own. */
    const all = el("div", "legend__all");
    all.appendChild(el("p", "legend__all-title", "The tasks"));
    const row = el("div", "legend__row");
    Object.keys(LABELS).forEach((name) => {
      const pill = el("span", "tag tag--own legend__chip");
      const grad = (typeof LABEL_GRADIENTS !== "undefined") && LABEL_GRADIENTS[name];
      if (grad) pill.style.backgroundImage = grad;
      else pill.style.background = LABELS[name];
      pill.appendChild(el("i", "tag__dot"));
      pill.appendChild(document.createTextNode(name));
      row.appendChild(pill);
    });
    all.appendChild(row);
    wrap.appendChild(all);

    return wrap;
  }

  /* highlight the section you are currently reading */
  function scrollSpy() {
    const links = [...document.querySelectorAll("#jump-links a")];
    const targets = links.map((a) => document.getElementById(a.hash.slice(1)));
    const mark = () => {
      const nav = document.querySelector(".sitenav__bar");
      const line = window.scrollY + ((nav ? nav.offsetHeight : 68) + 90);
      let i = 0;
      targets.forEach((t, n) => { if (t && t.offsetTop <= line) i = n; });
      links.forEach((a, n) => a.classList.toggle("is-current", n === i));
    };
    mark();
    window.addEventListener("scroll", () => window.requestAnimationFrame(mark), { passive: true });
  }

  /* ------------------------------------------------------------- modal --- */

  let lastFocus = null;

  /* Each profile is framed with its own task colours, and watermarked with a
     sprig carrying one leaf per task, so no two members look alike. */
  const LEAF_FALLBACK = ["#23684a", "#4f9c6f", "#9ec9b0"];

  const paletteOf = (m) => {
    const c = tagsOf(m).map((t) => LABELS[t.label]).filter(Boolean);
    return c.length ? c : LEAF_FALLBACK;
  };

  function frameGradient(colors) {
    const c = colors.length === 1 ? [colors[0], shade(colors[0], 1.45), colors[0]] : colors;
    const stops = c.concat(c.length > 2 ? [c[0]] : []);
    return "linear-gradient(135deg," +
      stops.map((x, i) => x + " " + Math.round((i / (stops.length - 1)) * 100) + "%").join(",") + ")";
  }

  function sprigSVG(colors) {
    /* leaves alternate up the stem; each takes the next task colour */
    const pos = [[31, 20, -42], [27, 46, 40], [23, 70, -34], [18, 93, 36],
                 [14, 114, -28], [11, 132, 34]];
    const n = Math.min(Math.max(colors.length, 3), pos.length);
    let leaves = "";
    for (let i = 0; i < n; i++) {
      const [x, y, r] = pos[i];
      leaves +=
        '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')">' +
        '<path d="M0 0C9-11 25-11 33 0 25 11 9 11 0 0Z" fill="' + colors[i % colors.length] + '"/>' +
        '<path d="M2 0H31" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>' +
        "</g>";
    }
    return '<svg viewBox="0 0 70 160" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M6 158C26 122 36 74 33 6" fill="none" stroke="#14402b" ' +
      'stroke-width="3" stroke-linecap="round"/>' + leaves + "</svg>";
  }

  function openModal(m) {
    lastFocus = document.activeElement;
    const modal = document.getElementById("bio-modal");
    const kind = roleKind(m.role);

    const palette = paletteOf(m);
    document.getElementById("modal-frame").style.setProperty("--frame", frameGradient(palette));
    document.getElementById("modal-sprig").innerHTML = sprigSVG(palette);

    modal.querySelector(".modal__media").src = photo(m);
    modal.querySelector(".modal__media").alt = m.name;
    modal.querySelector(".modal__role").textContent = m.role || "";
    modal.querySelector(".modal__role").style.display = m.role ? "" : "none";
    modal.querySelector(".modal__name").textContent = m.name;
    modal.querySelector(".modal__meta").textContent =
      [metaOf(m), trackOf(m)].filter(Boolean).join(" · ");
    modal.querySelector(".modal__text").textContent = m.bio || "Bio coming soon.";
    modal.querySelector(".modal__role").className = "modal__role modal__role--" + kind;

    const holder = modal.querySelector(".modal__tags");
    holder.innerHTML = "";
    const tags = tagRow(m, "x");
    if (tags) { while (tags.firstChild) holder.appendChild(tags.firstChild); }
    holder.style.display = tags ? "" : "none";

    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    modal.querySelector(".modal__close").focus();
  }

  function closeModal() {
    document.getElementById("bio-modal").classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  function wireModal() {
    const modal = document.getElementById("bio-modal");
    modal.querySelector(".modal__close").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  /* ---------------------------------------------------------- mobile nav - */


  /* --------------------------------------------------------------- boot -- */

  document.addEventListener("DOMContentLoaded", () => {
    render();
    scrollSpy();
    wireModal();
  });
})();
