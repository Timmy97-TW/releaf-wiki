/* =============================================================================
   ReLeaf: the team page renderer
   Reads LABELS, LABEL_GRADIENTS and SECTIONS from assets/data/roster.js.

   What the page does with the roster:
   · one card per person; the card's frame lights up in that person's own task
     colours on hover, and the profile it opens wears the same frame
   · the task row in the legend is a filter: pick a task and the roster shows
     the people who worked on it (also from a link, team/#task-cloning)
   · a profile has its own address (team/#member-abby-kao), steps to its
     neighbours with the arrow keys, and closes on Escape or the Back button

   Everything on this page is black. The rest of the wiki paints drafted text
   orange through class="ai"; from 2 October this page does not, because it
   introduces forty-six people and two colours of text read as a page half
   finished rather than as a team. roster.js keeps its bioAI and noteAI flags
   as the record of which words still want a student's own.
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

  const people = (n) => n + (n === 1 ? " person" : " people");

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* An empty frame for a profile photo not sent yet: a pale 4:3 tile with a
     faint camera, so two of them fill the row the way two photos would. */
  const EMPTY_SHOT = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect width="400" height="300" fill="#f1f5f2"/>' +
    '<g fill="none" stroke="#b9cfc1" stroke-width="5" stroke-linejoin="round">' +
    '<path d="M162 126h14l9-14h30l9 14h14a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8h-76a8 8 0 0 1-8-8v-52a8 8 0 0 1 8-8z"/>' +
    '<circle cx="200" cy="159" r="18"/></g></svg>');

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

  /* Every task pill is a member pill. Nobody is drawn as the owner of a task:
     the roster says who worked on what, not who outranks whom. `own` and `mem`
     are still read so an older roster keeps rendering, but both land in the
     same place. */
  const tasksOf = (m) => {
    const all = (m.tasks || []).concat(m.own || [], m.mem || []);
    return all.filter((t, i) => all.indexOf(t) === i);
  };

  /* A bio can run to several paragraphs, separated in roster.js by a blank
     line ("\n\n"). The card shows them as one clamped run of text; the
     profile gives each its own paragraph. */
  const parasOf = (m) => (m.bio || "").split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);

  const metaOf = (m) => [m.grade, m.school].filter(Boolean).join(" · ");

  /* The subteam, and only the subteam. Major and minor used to ride along
     here; they are a training record rather than an introduction, so the card
     no longer carries them. */
  const trackOf = (m) => m.track || "";

  /* colour maths so member pills read as a quiet wash of the owner colour */
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const tint = (hex, a) => "rgba(" + rgb(hex).join(",") + "," + a + ")";
  const shade = (hex, k) =>
    "rgb(" + rgb(hex).map((v) => Math.min(255, Math.round(v * k))).join(",") + ")";
  /* the pill's text: the same hue at 0.72, darkened further only where that
     reads below 4.5:1 (WCAG AA) on its own wash over the card (--card-bg,
     the darkest surface a pill sits on) */
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const inkOn = (hex, a) => {
    const c = rgb(hex), card = [244, 244, 242];
    const bg = lum(c.map((v, i) => v * a + card[i] * (1 - a)));
    let k = .72;
    while (k > .2 && (bg + .05) / (lum(c.map((v) => Math.round(v * k))) + .05) < 4.6) k -= .02;
    return shade(hex, k);
  };
  const WASH = 0.16;
  const colorOf = (task) => LABELS[task] || "#737373";

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

  /* Which flavour of role badge: advisor / instructor. Students have none. */
  function roleKind(role) {
    if (!role) return "";
    if (/instructor/i.test(role)) return "instructor";
    if (/advisor/i.test(role))    return "advisor";
    if (/vice/i.test(role))       return "vice";
    if (/lead/i.test(role))       return "lead";
    return "vice";
  }

  /* ---- a person's own colours ----------------------------------------------
     Each person is framed with the colours of the tasks they worked on, and
     their profile is watermarked with a sprig carrying one leaf per task, so
     no two members look alike and the frame is an honest record: it can only
     show a colour the roster gives that person a task for. */
  const LEAF_FALLBACK = ["#23684a", "#4f9c6f", "#9ec9b0"];

  const paletteOf = (m) => {
    const c = tasksOf(m).map((t) => LABELS[t]).filter(Boolean);
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

  /* ------------------------------------------------------------ state ---- */

  /* Everyone on the page, in the order the page shows them: one flat list, so
     a profile can step to its neighbour and the task filter can count. */
  const PEOPLE = [];     /* { m, id, card, tasks } */
  const SECS = [];       /* { node, link, count, people, grids, seats } */
  const CHIPS = {};      /* task name -> its button in the legend */
  let activeTask = null;

  const visiblePeople = () => PEOPLE.filter((p) => !p.card.hidden);

  /* ------------------------------------------------------------- pills --- */

  /* On a card the pills are plain text: the whole card is already one button.
     In the profile each pill is a button that shows everybody on that task. */
  function tagRow(m, cls, asButtons) {
    const tasks = tasksOf(m);
    if (!tasks.length) return null;
    const wrap = el("ul", cls || "card__tags");
    wrap.setAttribute("aria-label", "Tasks");
    tasks.forEach((task) => {
      /* the task's own hue, washed back to a tint so a card full of pills
         still reads as one person rather than a scoreboard */
      const color = colorOf(task);
      const item = el("li");
      const pill = el(asButtons ? "button" : "span", "tag tag--mem", task);
      pill.style.backgroundColor = tint(color, WASH);
      pill.style.color = inkOn(color, WASH);
      pill.style.setProperty("--c", color);
      pill.dataset.task = task;
      if (asButtons) {
        pill.type = "button";
        pill.title = "Everyone on " + task;
        pill.addEventListener("click", () => showTask(task));
      }
      item.appendChild(pill);
      wrap.appendChild(item);
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
    const person = { m: m, id: "member-" + slug(m.name), card: card, tasks: tasksOf(m) };
    card.id = person.id;
    card.dataset.labels = person.tasks.join("|");
    /* the same frame the profile wears; team.css switches it on under the
       pointer, so at rest the roster stays one team in one green */
    card.style.setProperty("--frame", frameGradient(paletteOf(m)));

    /* the official portrait only: every card is shot the same way, and the
       working and goofy photos wait inside the profile */
    const media = el("div", "card__media");
    const img = el("img");
    /* lazy before src: an image not yet in the page starts loading the
       moment it has a src, so the order matters */
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 720; img.height = 900;
    img.src = photo(m);
    /* the name is the heading right below, so the portrait stays silent */
    img.alt = "";
    media.appendChild(img);
    card.appendChild(media);

    /* body */
    const body = el("div", "card__body");

    /* role first, then the subteam track. The track is deliberately quieter:
       it says what someone trained in, not what they run. */
    const track = trackOf(m);
    if (m.role || track) {
      const badges = el("div", "card__badges");
      if (m.role) badges.appendChild(el("span", "card__role card__role--" + kind, m.role));
      if (track) badges.appendChild(el("span", "card__track card__track--sub", track));
      body.appendChild(badges);
    }

    /* The name is a real button inside a real heading, and team.css stretches
       it over the whole card. So a click anywhere opens the profile, while a
       screen reader still gets a heading per person and can read the tasks
       and the bio, which one big role="button" used to swallow. */
    const name = el("h3", "card__name");
    const open = el("button", "card__open", m.name);
    open.type = "button";
    open.setAttribute("aria-haspopup", "dialog");
    name.appendChild(open);
    body.appendChild(name);

    const meta = metaOf(m);
    if (meta) body.appendChild(el("p", "card__meta", meta));

    const tags = tagRow(m);
    if (tags) body.appendChild(tags);

    if (m.bio) {
      body.appendChild(el("p", "card__bio", parasOf(m).join(" ")));
      const more = el("span", "card__more", "Read more");
      more.setAttribute("aria-hidden", "true");
      body.appendChild(more);
    }

    card.appendChild(body);

    open.addEventListener("click", () => openModal(person, true));
    /* fetch the profile photos as soon as a visit looks likely, so the
       profile opens with them already in place */
    const ready = () => warm(person);
    card.addEventListener("pointerenter", ready);
    card.addEventListener("touchstart", ready, { passive: true });
    open.addEventListener("focus", ready);

    PEOPLE.push(person);
    return person;
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
    const holder = document.createDocumentFragment();

    SECTIONS.forEach((sec) => {
      const s = el("section", "section");
      const rec = { node: s, link: null, count: null, people: [], grids: [], seats: null };

      const h = el("h2", "section__title", sec.title);
      h.id = sec.id;
      rec.count = el("span", "section__count");
      h.appendChild(rec.count);
      s.appendChild(h);
      if (sec.note) sec.note.split("\n").forEach((line) =>
        s.appendChild(el("p", "section__note", line)));

      let count = 0;

      /* seats nobody holds yet, drawn as open slots rather than an empty box */
      if (sec.openSlots) {
        const grid = el("div", "grid");
        for (let i = 0; i < sec.openSlots; i++) grid.appendChild(openSeat());
        s.appendChild(grid);
        rec.seats = grid;
        count += sec.openSlots;
      }

      (sec.groups || []).forEach((g) => {
        const shown = (g.members || []).filter((m) => !m.hidden);
        if (!shown.length) return;
        count += shown.length;
        if (g.title) s.appendChild(el("h3", "group__title", g.title));
        const grid = el("div", "grid");
        shown.forEach((m) => {
          const p = buildCard(m);
          rec.people.push(p);
          grid.appendChild(p.card);
        });
        s.appendChild(grid);
        rec.grids.push(grid);
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

      holder.appendChild(s);

      const a = el("a", null, sec.title);
      a.href = "#" + sec.id;
      const ico = el("i", "jump__icon");
      ico.style.setProperty("--icon", iconURL(sec.id));
      a.insertBefore(ico, a.firstChild);
      /* a section the filter has emptied comes back before the page jumps */
      a.addEventListener("click", () => { if (s.hidden) setFilter(null); });
      jump.appendChild(a);
      rec.link = a;
      SECS.push(rec);
    });

    /* the legend counts people per task, so it is built once they are known */
    main.appendChild(legend());
    main.appendChild(holder);
    paintCounts();
  }

  /* the small number beside a section title: how many people are showing */
  function paintCounts() {
    SECS.forEach((s) => {
      const n = s.people.filter((p) => !p.card.hidden).length;
      s.count.textContent = n ? String(n) : "";
    });
  }

  /* ------------------------------------------------------------ legend --- */

  function legend() {
    const wrap = el("div", "legend");

    /* On a phone the three definitions fold away behind their title, so the
       roster starts on the first screen; on a wide screen they stay open. */
    const majors = el("details", "legend__majors");
    const title = el("summary", "legend__title", "What a major means");
    majors.appendChild(title);

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
    majors.appendChild(tracks);
    wrap.appendChild(majors);

    const wide = window.matchMedia("(min-width: 880px)");
    const fold = () => {
      majors.open = wide.matches;
      if (wide.matches) title.tabIndex = -1; else title.removeAttribute("tabindex");
    };
    fold();
    if (wide.addEventListener) wide.addEventListener("change", fold);

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
       reader can match a colour on a card to a name. Each one is also a
       switch: press it and the roster shows the people on that task, with the
       number on the pill saying how many that is. Built from LABELS, so a
       task added to the roster appears here on its own. */
    const all = el("div", "legend__all");
    all.id = "tasks";
    const head = el("p", "legend__all-title", "The tasks");
    head.appendChild(el("span", "legend__hint", "Select one to see who worked on it"));
    all.appendChild(head);

    const row = el("div", "legend__row");
    row.id = "task-row";
    Object.keys(LABELS).forEach((name) => {
      const n = PEOPLE.filter((p) => p.tasks.indexOf(name) > -1).length;
      const chip = el("button", "tag tag--own legend__chip");
      chip.type = "button";
      chip.dataset.task = name;
      chip.setAttribute("aria-pressed", "false");
      chip.setAttribute("aria-label", name + ", " + people(n));
      chip.disabled = !n;
      const grad = (typeof LABEL_GRADIENTS !== "undefined") && LABEL_GRADIENTS[name];
      chip.style.setProperty("--fill", grad || LABELS[name]);
      chip.style.setProperty("--c", LABELS[name]);
      chip.style.setProperty("--wash", tint(LABELS[name], WASH));
      chip.style.setProperty("--ink", inkOn(LABELS[name], WASH));
      chip.appendChild(el("i", "tag__dot"));
      chip.appendChild(document.createTextNode(name));
      chip.appendChild(el("span", "legend__count", String(n)));
      chip.addEventListener("click", () => setFilter(activeTask === name ? null : name));
      row.appendChild(chip);
      CHIPS[name] = chip;
    });
    all.appendChild(row);

    /* what the filter is showing, and the way back to everyone */
    const status = el("p", "legend__status");
    status.id = "task-status";
    status.hidden = true;
    status.setAttribute("role", "status");
    status.appendChild(el("span", "legend__status-dot"));
    status.appendChild(el("b", "legend__status-task"));
    status.appendChild(el("span", "legend__status-n"));
    const reset = el("button", "legend__reset", "Show everyone");
    reset.type = "button";
    reset.addEventListener("click", () => setFilter(null));
    status.appendChild(reset);
    all.appendChild(status);

    wrap.appendChild(all);
    return wrap;
  }

  /* ------------------------------------------------------- task filter --- */

  const taskHash = (task) => "#task-" + slug(task);
  const taskFromHash = (id) => Object.keys(LABELS).filter((n) => "task-" + slug(n) === id)[0] || null;

  /* The address follows the filter, so a filtered roster can be linked to
     from anywhere on the wiki ("who built the hardware?" -> team/#task-hardware).
     replaceState, not a new history entry: Back should leave the page, not
     replay every task somebody tried. */
  function writeHash(hash) {
    try {
      history.replaceState(history.state, "", location.pathname + location.search + (hash || ""));
    } catch (e) { /* a sandboxed frame may refuse; the filter works without it */ }
  }

  let swapTimer = 0;

  function setFilter(task, opts) {
    const quiet = opts && opts.quiet;      /* leave the address alone */
    const still = opts && opts.still;      /* no entrance: at load, or behind a profile */
    if (task && !(task in LABELS)) task = null;
    if (task === activeTask) return;
    activeTask = task;

    let shown = 0;
    PEOPLE.forEach((p) => {
      p.card.hidden = !!task && p.tasks.indexOf(task) < 0;
      if (!p.card.hidden) p.card.style.setProperty("--i", shown++);
      p.card.querySelectorAll(".tag").forEach((t) =>
        t.classList.toggle("is-hit", !!task && t.dataset.task === task));
    });
    SECS.forEach((s) => {
      const n = s.people.filter((p) => !p.card.hidden).length;
      s.grids.forEach((g) => { g.hidden = !g.querySelector(".card:not([hidden])"); });
      if (s.seats) s.seats.hidden = !!task;
      s.node.hidden = !!task && !n;
      s.link.classList.toggle("is-off", s.node.hidden);
    });
    paintCounts();

    Object.keys(CHIPS).forEach((name) => {
      const on = name === task;
      CHIPS[name].classList.toggle("is-on", on);
      CHIPS[name].setAttribute("aria-pressed", String(on));
    });
    document.getElementById("task-row").classList.toggle("is-filtering", !!task);

    const status = document.getElementById("task-status");
    status.hidden = !task;
    if (task) {
      status.style.setProperty("--c", LABELS[task]);
      status.querySelector(".legend__status-task").textContent = task;
      status.querySelector(".legend__status-n").textContent = people(shown);
    }

    /* the cards that stay rise into their new places, a beat apart (team.css,
       .is-swapping). The class comes off afterwards so the hover lift, which
       an animation would outrank, works again. */
    const main = document.getElementById("team-main");
    window.clearTimeout(swapTimer);
    main.classList.remove("is-swapping");
    if (!still && !calm.matches) {
      void main.offsetWidth;
      main.classList.add("is-swapping");
      swapTimer = window.setTimeout(() => main.classList.remove("is-swapping"), 800);
    }

    if (!quiet) writeHash(task ? taskHash(task) : "");
  }

  /* bring the task row under the sticky bars, with its results right below */
  function revealTasks(jump) {
    const row = document.getElementById("tasks");
    const bar = document.querySelector(".toolbar");
    const nav = document.querySelector(".sitenav__bar");
    /* where the sticky bars end once the page has scrolled under them */
    const bars = (nav ? nav.offsetHeight : 68) + (bar ? bar.offsetHeight : 0);
    const top = row.getBoundingClientRect().top + window.scrollY - bars - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: jump || calm.matches ? "instant" : "smooth" });
  }

  /* from a pill in a profile: close it, then show everybody on that task */
  function showTask(task) {
    closeModal(() => {
      setFilter(task);
      if (CHIPS[task]) CHIPS[task].focus({ preventScroll: true });
      revealTasks();
    });
  }

  /* --------------------------------------------------------- jump bar ---- */

  /* highlight the section you are currently reading */
  function scrollSpy() {
    const jump = document.getElementById("jump-links");
    const links = [...jump.querySelectorAll("a")];
    const targets = links.map((a) => document.getElementById(a.hash.slice(1)));
    let last = -1;
    const mark = () => {
      const nav = document.querySelector(".sitenav__bar");
      const line = window.scrollY + ((nav ? nav.offsetHeight : 68) + 90);
      let i = 0;
      /* a section the filter has hidden has no place on the page to compare */
      targets.forEach((t, n) => { if (t && t.offsetParent && t.offsetTop <= line) i = n; });
      if (i === last) return;
      last = i;
      links.forEach((a, n) => a.classList.toggle("is-current", n === i));
      /* on a phone the bar scrolls sideways: keep the current section in it */
      if (jump.scrollWidth > jump.clientWidth) {
        const a = links[i];
        jump.scrollTo({
          left: a.offsetLeft - (jump.clientWidth - a.offsetWidth) / 2,
          behavior: calm.matches ? "auto" : "smooth"
        });
      }
    };
    mark();
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => { queued = false; mark(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* ------------------------------------------------------------- modal --- */

  const modal = document.getElementById("bio-modal");
  let current = null;      /* the person whose profile is open */
  let lastFocus = null;
  let pushed = false;      /* did opening this profile add a history entry? */
  let afterClose = null;   /* work that waits for the Back step to land */
  let leaving = false;     /* a Back step is on its way; nothing may open until it lands */

  const isOpen = () => modal.classList.contains("is-open");

  /* Closing a profile steps Back, and on a Back step the browser returns the
     page to where it was when the profile opened. That fights the two places
     this page moves on purpose (to the card last read, to the task row), so
     the browser is asked to hold off while a profile is open. */
  const holdScroll = (on) => {
    try { history.scrollRestoration = on ? "manual" : "auto"; } catch (e) { /* older browsers */ }
  };

  /* Profile photos are fetched when a card is first pointed at, touched or
     focused, and for the two neighbours of an open profile. Skipped when the
     reader has asked the browser to save data. */
  function warm(p) {
    if (!p || p.warm) return;
    p.warm = true;
    const c = navigator.connection;
    if (c && c.saveData) return;
    [p.m.workPhoto, p.m.goofyPhoto].filter(Boolean).forEach((src) => {
      const i = new Image();
      i.decoding = "async";
      i.src = BASE + src;
    });
  }

  /* While a profile is open the page behind it is out of reach: no focus, no
     clicks, no screen reader wandering off into the roster. */
  function setBackground(off) {
    [...document.body.children].forEach((n) => {
      if (n === modal || n.tagName === "SCRIPT") return;
      if (off) n.setAttribute("inert", ""); else n.removeAttribute("inert");
    });
    document.body.style.overflow = off ? "hidden" : "";
  }

  function neighbours(p) {
    const list = visiblePeople();
    const i = list.indexOf(p);
    if (i < 0 || list.length < 2) return [null, null];
    return [list[(i - 1 + list.length) % list.length], list[(i + 1) % list.length]];
  }

  function fill(p) {
    const m = p.m;
    const kind = roleKind(m.role);

    const palette = paletteOf(m);
    document.getElementById("modal-frame").style.setProperty("--frame", frameGradient(palette));
    document.getElementById("modal-sprig").innerHTML = sprigSVG(palette);

    /* Working photo left, goofy right, the bio in a box underneath. Everyone
       gets the pair; a photo not sent yet is an empty frame. */
    const pair = modal.querySelector(".modal__pair");
    const shots = [...pair.querySelectorAll(".modal__shot-img")];
    /* A solo profile shows one photo alone across the full width: the work
       photo, or the goofy one when there is no work photo. */
    pair.classList.toggle("modal__pair--solo", !!m.solo);
    shots[1].hidden = !!m.solo;
    const shown = m.solo ? shots.slice(0, 1) : shots;
    /* Nothing is cropped. Both photos share one height and keep their own
       shape, so the row's height is the width divided by the sum of the two
       aspect ratios. The CSS does the division; this supplies the sum once
       both photos know their size, and the larger of the two for the phone
       layout, where the pair becomes a strip to swipe along. */
    const fit = () => {
      if (!shown.every((i) => i.complete && i.naturalWidth)) return;
      const ratios = shown.map((i) => i.naturalWidth / i.naturalHeight);
      pair.style.setProperty("--ratio-sum", ratios.reduce((s, r) => s + r, 0).toFixed(4));
      pair.style.setProperty("--ratio-max", Math.max.apply(null, ratios).toFixed(4));
      shown.forEach((i) => i.classList.add("is-ready"));
    };
    pair.style.setProperty("--ratio-sum", "1.6");
    pair.style.setProperty("--ratio-max", "1.5");
    pair.scrollLeft = 0;
    const pics = m.solo
      ? [[m.workPhoto || m.goofyPhoto, ""], ["", ""]]
      : [[m.workPhoto, " at work"], [m.goofyPhoto, ", being goofy"]];
    pics.forEach(([src, alt], n) => {
      const img = shots[n];
      /* empty the frame first, so the last person's photo never shows under
         this person's name while the new one is on its way */
      img.onload = img.onerror = null;
      img.classList.remove("is-ready");
      img.removeAttribute("src");
      img.alt = "";
      if (img.hidden) return;
      img.onload = fit;
      /* a file that is missing falls back to the empty frame */
      img.onerror = () => { img.onerror = null; img.alt = ""; img.src = EMPTY_SHOT; };
      img.alt = src ? m.name + alt : "";
      img.src = src ? BASE + src : EMPTY_SHOT;
    });
    fit();

    const role = modal.querySelector(".modal__role");
    role.textContent = m.role || "";
    role.style.display = m.role ? "" : "none";
    role.className = "modal__role modal__role--" + kind;
    modal.querySelector(".modal__name").textContent = m.name;
    const meta = modal.querySelector(".modal__meta");
    meta.textContent = [metaOf(m), trackOf(m)].filter(Boolean).join(" · ");
    meta.hidden = !meta.textContent;

    /* the pills sit right under the name, where they name the colours the
       frame is made of */
    const holder = modal.querySelector(".modal__tags");
    holder.innerHTML = "";
    const tags = tagRow(m, "x", true);
    if (tags) { while (tags.firstChild) holder.appendChild(tags.firstChild); }
    holder.hidden = !tags;

    const text = modal.querySelector(".modal__text");
    text.innerHTML = "";
    const paras = parasOf(m);
    if (paras.length) paras.forEach((t) => text.appendChild(el("p", null, t)));
    else text.appendChild(el("p", "modal__soon", "Bio coming soon."));

    /* the way to the next person: arrows beside the frame on a wide screen,
       two names under the bio on a narrow one */
    const [prev, next] = neighbours(p);
    const wire = (sel, to, label) => modal.querySelectorAll(sel).forEach((b) => {
      b.hidden = !to;
      if (!to) return;
      b.setAttribute("aria-label", label + ": " + to.m.name);
      const name = b.querySelector(".modal__step-name");
      if (name) name.textContent = to.m.name;
    });
    wire("[data-step='-1']", prev, "Previous profile");
    wire("[data-step='1']", next, "Next profile");
    modal.querySelector(".modal__foot").hidden = !prev;
    warm(prev); warm(next);

    modal.querySelector(".modal__panel").scrollTop = 0;
  }

  /* `push` is true when a click opened the profile: it gets a history entry,
     so Back closes it. A profile reached by its address, or by stepping from
     another profile, rewrites the entry it is already on. */
  function openModal(p, push) {
    if (leaving) {
      /* a profile was closed a moment ago and its Back step has not landed:
         opening now would have that step close this one, so wait for it */
      const first = afterClose;
      afterClose = () => { if (first) first(); openModal(p, push); };
      return;
    }
    const was = isOpen();
    if (p.card.hidden) setFilter(null, { quiet: true, still: true });
    if (!was) lastFocus = document.activeElement;
    current = p;
    warm(p);
    fill(p);

    const hash = "#" + p.id;
    if (location.hash !== hash) {
      try {
        if (push && !was) {
          holdScroll(true);
          history.pushState({ member: p.id }, "", hash);
          pushed = true;
        }
        else history.replaceState(history.state, "", hash);
      } catch (e) { /* the profile still opens */ }
    }

    if (!was) {
      modal.classList.add("is-open");
      setBackground(true);
      modal.querySelector(".modal__close").focus();
    }
  }

  /* take the profile off the screen; the address is somebody else's job */
  function hideModal() {
    if (!isOpen()) return;
    modal.classList.remove("is-open");
    setBackground(false);
    /* back to the card of whoever was last on screen, which after a few
       steps is not the card that was clicked */
    const back = current && !current.card.hidden
      ? current.card.querySelector(".card__open") : lastFocus;
    if (back && back.focus) back.focus();
    current = null;
    lastFocus = null;
  }

  function closeModal(then) {
    if (!isOpen()) { if (typeof then === "function") then(); return; }
    hideModal();
    if (pushed) {
      /* undo the entry the profile added; route() runs `then` once the
         address has settled */
      pushed = false;
      leaving = true;
      afterClose = typeof then === "function" ? then : null;
      history.back();
      /* the step normally lands within a frame; if a browser swallows it,
         carry on rather than leave the page waiting */
      window.setTimeout(() => {
        if (!leaving) return;
        writeHash(activeTask ? taskHash(activeTask) : "");
        route();
      }, 500);
    } else {
      writeHash(activeTask ? taskHash(activeTask) : "");
      if (typeof then === "function") then();
    }
  }

  function step(d) {
    if (!current) return;
    const to = neighbours(current)[d < 0 ? 0 : 1];
    if (to) openModal(to, false);
  }

  function wireModal() {
    modal.querySelector(".modal__close").addEventListener("click", () => closeModal());
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modal.querySelectorAll("[data-step]").forEach((b) =>
      b.addEventListener("click", () => step(Number(b.dataset.step))));
    /* only when a profile is open: Escape also closes the nav, and must not
       pull focus back to a card that was opened minutes ago */
    document.addEventListener("keydown", (e) => {
      if (!isOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") closeModal();
      else if (e.key === "ArrowLeft")  { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    });
  }

  /* --------------------------------------------------------------- boot -- */

  /* The address decides what is open:
       #member-<name>   that person's profile, so one can be shared or checked
       #task-<name>     the roster filtered to that task
     It runs at load and whenever Back, Forward or a link changes the hash. */
  function route() {
    leaving = false;
    const id = decodeURIComponent(location.hash.slice(1));
    const p = /^member-/.test(id) ? PEOPLE.filter((x) => x.id === id)[0] : null;
    if (p) {
      if (current !== p) {
        if (!isOpen()) p.card.scrollIntoView({ block: "center", behavior: "instant" });
        openModal(p, false);
      }
    } else {
      pushed = false;
      hideModal();
      holdScroll(false);
      const task = /^task-/.test(id) ? taskFromHash(id) : null;
      if (task) {
        const fresh = task !== activeTask;
        setFilter(task, { quiet: true, still: true });
        /* arriving by a task link: start at the task row, results below it */
        if (fresh) revealTasks(true);
      }
    }
    if (afterClose) { const f = afterClose; afterClose = null; f(); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    render();
    scrollSpy();
    wireModal();
    route();
    window.addEventListener("hashchange", route);
    window.addEventListener("popstate", route);
    /* a profile opened by its address: the browser's own jump to the hash can
       take focus back after the page loads, so hand it to the profile again */
    window.addEventListener("load", () => {
      if (isOpen() && !modal.contains(document.activeElement)) modal.querySelector(".modal__close").focus();
    });
  });
})();
