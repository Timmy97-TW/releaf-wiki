/* =============================================================================
   ReLeaf site navigation renderer
   Reads NAV from assets/data/site-nav.js into <div id="site-nav">.
   No dependencies. Drop the two data files, nav.css and the div into any wiki page.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- icon set ------------------------------------------------------------
     Line art, 24x24, stroked with currentColor. Lighter than the solid glyphs
     most wikis reach for, so the panel stays quiet.                           */
  const ICONS = {
    /* Project */
    description: '<path d="M6.5 3.5h7L18.5 8.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M13.5 3.5v5h5"/><path d="M8.5 13h7M8.5 16.5h4.5"/>',
    engineering: '<path d="M20.2 12a8.2 8.2 0 1 1-2.7-6.1"/><path d="M20.6 3.8v4.4h-4.4"/><circle cx="12" cy="12" r="2.4"/>',
    contribution: '<path d="M12 19.5V8"/><path d="M7.6 12.4 12 8l4.4 4.4"/><path d="M4.5 20.5h15"/>',
    results: '<path d="M4.5 20h15"/><path d="M6.8 17.5v-5M11.4 17.5v-9M16 17.5v-6.5"/><path d="M5.5 8.5 10 5l3.4 2.6L19 3.5"/>',
    /* Wetlab */
    experiments: '<path d="M10 3.5v5.6l-4.6 8.3A2 2 0 0 0 7.2 20.5h9.6a2 2 0 0 0 1.8-3.1L14 9.1V3.5"/><path d="M9 3.5h6"/><path d="M7.4 14.5h9.2"/>',
    parts: '<rect x="3.8" y="4.2" width="7" height="7" rx="1.6"/><rect x="13.2" y="12.8" width="7" height="7" rx="1.6"/><path d="M10.8 7.7h3.6a2 2 0 0 1 2 2v3.1"/>',
    plants: '<path d="M12 21v-7.2"/><path d="M12 13.8C12 10.6 9.4 8 6.2 8c0 3.2 2.6 5.8 5.8 5.8Z"/><path d="M12 13.8c0-3.8 3.1-6.9 6.9-6.9 0 3.8-3.1 6.9-6.9 6.9Z"/>',
    measurement: '<path d="M3.8 13a8.2 8.2 0 0 1 16.4 0"/><path d="M12 13l3.9-3.2"/><circle cx="12" cy="13" r="1.3"/><path d="M3.8 13h2M18.2 13h2M12 4.8v2"/>',
    safety: '<path d="M12 3.2 19 6v6c0 4.3-3 7.4-7 8.7-4-1.3-7-4.4-7-8.7V6l7-2.8Z"/><path d="M9.3 12.1l2 2 3.5-3.8"/>',
    notebook: '<path d="M7 3.5h10a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H7a2.2 2.2 0 0 1 0-4.4h11"/><path d="M10 3.5v12.1"/>',
    /* Drylab */
    model: '<path d="M4.5 20V4M4.5 20h15"/><path d="M5.5 17.2c3.6 0 3.7-9.4 6.9-9.4 2.7 0 3.3 5.2 6.1 5.2"/>',
    bioreactor: '<path d="M7.2 4.5h9.6v10.8a4.8 4.8 0 0 1-9.6 0Z"/><path d="M7.2 11.6c1.6 1.3 3.2 1.3 4.8 0s3.2-1.3 4.8 0"/><path d="M9.6 2.5h4.8"/>',
    hardware: '<rect x="7.2" y="7.2" width="9.6" height="9.6" rx="2"/><path d="M10 4.2v3M14 4.2v3M10 16.8v3M14 16.8v3M4.2 10h3M4.2 14h3M16.8 10h3M16.8 14h3"/>',
    software: '<path d="M9.2 7.4 4.8 12l4.4 4.6"/><path d="M14.8 7.4 19.2 12l-4.4 4.6"/><path d="M13.2 5.2l-2.4 13.6"/>',
    peptide: '<circle cx="5.4" cy="9.2" r="2.1"/><circle cx="11.4" cy="14.2" r="2.1"/><circle cx="17.4" cy="8.4" r="2.1"/><path d="M7 10.6l2.8 2.3M13.2 12.9l2.7-2.9"/><path d="M19.3 9.6l1.9 1.6"/>',
    /* Engagement */
    ihp: '<circle cx="8.4" cy="8.2" r="3"/><path d="M2.8 19c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2"/><path d="M15.4 4.5h5.8v4.8h-2.4l-2.2 2.1V9.3h-1.2z"/>',
    education: '<path d="M12 4.5 21.4 9 12 13.5 2.6 9 12 4.5Z"/><path d="M6.6 11.2v4.4c0 1.4 2.4 2.7 5.4 2.7s5.4-1.3 5.4-2.7v-4.4"/>',
    sustainability: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4"/><path d="M12 3.8c2.2 2.4 3.4 5.2 3.4 8.2s-1.2 5.8-3.4 8.2c-2.2-2.4-3.4-5.2-3.4-8.2s1.2-5.8 3.4-8.2Z"/>',
    legal: '<path d="M12 4.2v15.6M6.5 19.8h11"/><path d="M3.8 8.2h16.4"/><path d="M6.6 8.2 4 13.6h5.2Z"/><path d="M17.4 8.2 14.8 13.6H20Z"/>',
    gis: '<path d="M3.6 6.6 9 4.6l6 2 5.4-2v12.8l-5.4 2-6-2-5.4 2Z"/><path d="M9 4.6v12.8M15 6.6v12.8"/>',
    physical: '<path d="M12 3.4 20 7.7v8.6L12 20.6 4 16.3V7.7l8-4.3Z"/><path d="M4 7.7 12 12l8-4.3M12 12v8.6"/>',
    entrepreneurship: '<path d="M9.4 17.4h5.2M10.2 20.2h3.6"/><path d="M12 3.6a5.6 5.6 0 0 0-3.3 10.1c.5.4.8 1 .9 1.6h4.8c.1-.6.4-1.2.9-1.6A5.6 5.6 0 0 0 12 3.6Z"/>',
    ai: '<rect x="4.6" y="4.6" width="14.8" height="14.8" rx="3"/><path d="M9 15.2 12 8.4l3 6.8"/><path d="M10 13.2h4"/><path d="M9.4 1.8v2.8M14.6 1.8v2.8M9.4 19.4v2.8M14.6 19.4v2.8"/><path d="M1.8 9.4h2.8M1.8 14.6h2.8M19.4 9.4h2.8M19.4 14.6h2.8"/>',
    /* Team */
    members: '<circle cx="9" cy="8.4" r="3.1"/><path d="M3.2 19.4c0-3.1 2.6-5.2 5.8-5.2s5.8 2.1 5.8 5.2"/><circle cx="17.2" cy="9.6" r="2.3"/><path d="M16.2 14.6c2.7 0 4.6 1.9 4.6 4.8"/>',
    attribution: '<circle cx="12" cy="9.4" r="5"/><path d="M8.6 13.5 7.2 20.8 12 18.4l4.8 2.4-1.4-7.3"/>',
    milestone: '<path d="M6 21V3.6"/><path d="M6 4.4h11.4l-2.2 3.6 2.2 3.6H6"/><circle cx="6" cy="18" r="1.1"/>',
    gallery: '<rect x="3.6" y="5" width="16.8" height="14" rx="2"/><circle cx="8.6" cy="10" r="1.5"/><path d="M4.6 17.2 9.3 12.6l3.4 3.2 2.6-2.3 4.1 3.9"/>'
  };

  const svg = (key) =>
    '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[key] || ICONS.description) + "</svg>";

  /* ---- addresses ----------------------------------------------------------
     Every page carries data-base on #site-nav: "" at the wiki root, "../" one
     folder down, "../../" two down. Slugs are written once, in site-nav.js,
     and resolved here, so the same nav file works at any depth and on any host
     prefix (GitHub Pages serves under /repo/, the iGEM wiki under /team/).   */
  let BASE = "";
  const href = (p) => {
    if (p.href) return p.href;                       /* explicit override wins */
    if (!p.slug) return "#";
    return BASE + p.slug + "/";
  };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ---- build --------------------------------------------------------------- */

  function build(root) {
    BASE = root.dataset.base != null ? root.dataset.base : "";
    const brandHref = root.dataset.home || BASE || "./";
    const logo = root.dataset.logo || BASE + "assets/img/logo.png";
    const currentTab = root.dataset.tab || "";
    const currentPage = root.dataset.page || "";

    root.classList.add("sitenav");
    root.innerHTML =
      '<div class="sitenav__bar">' +
        '<div class="sitenav__inner">' +
          '<a class="sitenav__brand" href="' + brandHref + '">' +
            '<img class="sitenav__logo" src="' + logo + '" alt="ReLeaf team logo" />' +
            '<span class="sitenav__word">ReLeaf</span>' +
          "</a>" +
          '<div class="sitenav__tabs" role="menubar"></div>' +
          '<button class="sitenav__burger" aria-expanded="false" aria-label="Open menu">' +
            "<span></span><span></span><span></span></button>" +
        "</div>" +
      "</div>" +
      '<div class="sitenav__panels"></div>' +
      '<div class="sitenav__drawer"></div>';

    const tabs   = root.querySelector(".sitenav__tabs");
    const panels = root.querySelector(".sitenav__panels");
    const drawer = root.querySelector(".sitenav__drawer");

    NAV.forEach((tab) => {
      /* ---- desktop tab button ---- */
      const btn = el("button", "sitenav__tab");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.appendChild(el("span", null, tab.name));
      btn.appendChild(el("i", "sitenav__chev"));
      if (tab.id === currentTab) btn.classList.add("is-section");
      btn.dataset.tab = tab.id;
      tabs.appendChild(btn);

      /* ---- desktop panel ---- */
      const panel = el("div", "sitenav__panel");
      panel.dataset.tab = tab.id;
      const inner = el("div", "sitenav__panelinner");

      const rail = el("div", "sitenav__rail");

      /* student artwork, if it has been dropped into assets/img/tab-icons/ */
      const art = document.createElement("img");
      art.className = "sitenav__railart";
      art.src = tab.art || BASE + "assets/img/tab-icons/" + tab.id + ".png";
      art.alt = "";
      art.onerror = () => art.remove();
      rail.appendChild(art);

      rail.appendChild(el("h2", "sitenav__railtitle", tab.name));
      rail.appendChild(el("p", "sitenav__railblurb", tab.blurb));
      inner.appendChild(rail);

      const list = el("div", "sitenav__list");
      list.dataset.count = tab.pages.length;
      tab.pages.forEach((p) => list.appendChild(entry(p, currentPage)));
      inner.appendChild(list);

      panel.appendChild(inner);
      panels.appendChild(panel);

      /* ---- mobile accordion ---- */
      const group = el("div", "sitenav__group");
      const gbtn = el("button", "sitenav__grouptop");
      gbtn.type = "button";
      gbtn.setAttribute("aria-expanded", "false");
      gbtn.appendChild(el("span", null, tab.name));
      gbtn.appendChild(el("i", "sitenav__chev"));
      const gbody = el("div", "sitenav__groupbody");
      tab.pages.forEach((p) => gbody.appendChild(entry(p, currentPage)));
      gbtn.addEventListener("click", () => {
        const open = group.classList.toggle("is-open");
        gbtn.setAttribute("aria-expanded", String(open));
      });
      group.appendChild(gbtn);
      group.appendChild(gbody);
      drawer.appendChild(group);
    });

    wire(root);
  }

  function entry(p, currentPage) {
    const here = p.current || (currentPage && p.slug === currentPage);
    const a = el("a", "sitenav__entry" + (here ? " is-current" : ""));
    a.href = href(p);
    if (here) a.setAttribute("aria-current", "page");
    const tile = el("span", "sitenav__tile");
    tile.innerHTML = svg(p.icon);
    a.appendChild(tile);
    const text = el("span", "sitenav__entrytext");
    text.appendChild(el("span", "sitenav__entrytitle", p.title));
    text.appendChild(el("span", "sitenav__entrycap", p.caption));
    a.appendChild(text);
    return a;
  }

  /* ---- behaviour ----------------------------------------------------------- */

  function wire(root) {
    const btns   = [...root.querySelectorAll(".sitenav__tab")];
    const panels = [...root.querySelectorAll(".sitenav__panel")];
    let openId = null, closeTimer = null;

    const show = (id) => {
      clearTimeout(closeTimer);
      openId = id;
      btns.forEach((b) => {
        const on = b.dataset.tab === id;
        b.classList.toggle("is-open", on);
        b.setAttribute("aria-expanded", String(on));
      });
      panels.forEach((p) => p.classList.toggle("is-open", p.dataset.tab === id));
      root.classList.toggle("has-panel", !!id);
    };
    const hide = () => show(null);
    const hideSoon = () => { clearTimeout(closeTimer); closeTimer = setTimeout(hide, 160); };

    btns.forEach((b) => {
      b.addEventListener("mouseenter", () => show(b.dataset.tab));
      b.addEventListener("focus", () => show(b.dataset.tab));
      b.addEventListener("click", (e) => {
        e.preventDefault();
        openId === b.dataset.tab ? hide() : show(b.dataset.tab);
      });
    });
    panels.forEach((p) => {
      p.addEventListener("mouseenter", () => clearTimeout(closeTimer));
      p.addEventListener("mouseleave", hideSoon);
    });
    root.querySelector(".sitenav__tabs").addEventListener("mouseleave", hideSoon);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    document.addEventListener("click", (e) => { if (!root.contains(e.target)) hide(); });

    const burger = root.querySelector(".sitenav__burger");
    burger.addEventListener("click", () => {
      const open = root.classList.toggle("drawer-open");
      burger.setAttribute("aria-expanded", String(open));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("site-nav");
    if (root) build(root);
  });
})();
