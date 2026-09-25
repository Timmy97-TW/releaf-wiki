/* =============================================================================
   ReLeaf site navigation renderer
   Reads NAV from assets/data/site-nav.js into <div id="site-nav">.
   No dependencies. Drop the two data files, nav.css and the div into any wiki page.
   ========================================================================== */
(function () {
  "use strict";

  /* Scripts are running: say so on <html>, as early as this file runs, so a
     stylesheet can keep script-only controls (tab strips, filter chips,
     "open all" buttons) out of the page when they would do nothing. Pages
     use html.js / html:not(.js); [data-needs-js] elements are shown here too. */
  document.documentElement.classList.add("js");
  const reveal = () => document.querySelectorAll("[data-needs-js][hidden]").forEach((el) => { el.hidden = false; });

  /* No icon per page. The panel used to give each entry a stroked line icon
     in a pale rounded tile (a document for Description, an upload arrow for
     Contribution, a lightbulb for Entrepreneurship); none of them showed the
     page's actual subject and two pages shared one. An entry is now what a
     drawing register lists: the title, a one-line caption of what is on the
     page, and, where the address is judged, the award in field lettering.  */

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
    /* the bar shows the logo at 50px: a 100px WebP (5 KB) for two-times
       screens, not the 200px PNG (64 KB) the favicon uses */
    const logo = root.dataset.logo || BASE + "assets/img/logo-100.webp";
    const currentTab = root.dataset.tab || "";
    const currentPage = root.dataset.page || "";

    root.classList.add("sitenav");
    /* a landmark, so screen readers can jump to it and nothing in it sits
       outside every landmark. The tabs are disclosure buttons (aria-expanded),
       not a menubar: a menubar promises menuitems and arrow-key menus. */
    root.setAttribute("role", "navigation");
    root.setAttribute("aria-label", "Site");
    root.innerHTML =
      '<div class="sitenav__bar">' +
        '<div class="sitenav__inner">' +
          '<a class="sitenav__brand" href="' + brandHref + '">' +
            '<img class="sitenav__logo" src="' + logo + '" alt="ReLeaf team logo" width="50" height="50" />' +
            '<span class="sitenav__word">ReLeaf</span>' +
          "</a>" +
          '<div class="sitenav__tabs"></div>' +
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

      /* student artwork, only for tabs that name it in site-nav.js: `art: true`
         means assets/img/tab-icons/<id>.png, a string is a path from the wiki
         root. Probing for files that are not there would put five 404s in the
         console of every page. */
      if (tab.art) {
        const art = document.createElement("img");
        art.className = "sitenav__railart";
        art.src = BASE + (tab.art === true ? "assets/img/tab-icons/" + tab.id + ".png" : tab.art);
        art.alt = "";
        art.onerror = () => art.remove();
        rail.appendChild(art);
      }

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
    const head = el("span", "sitenav__entrytitle", p.title);
    /* the state is named in words, not only drawn */
    if (here) head.appendChild(el("span", "sitenav__here", "This page"));
    a.appendChild(head);
    a.appendChild(el("span", "sitenav__entrycap", p.caption));
    if (p.award) a.appendChild(el("span", "sitenav__award", p.award));
    return a;
  }

  /* ---- behaviour ----------------------------------------------------------- */

  function wire(root) {
    const btns   = [...root.querySelectorAll(".sitenav__tab")];
    const panels = [...root.querySelectorAll(".sitenav__panel")];
    const burger = root.querySelector(".sitenav__burger");
    let openId = null, closeTimer = null, shownAt = 0;

    const show = (id) => {
      clearTimeout(closeTimer);
      if (id !== openId) shownAt = performance.now();
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

    /* Hover opens a panel, and so does the click that usually follows the
       hover, or the tap on a touch screen (which fires mouseenter first). A
       click only closes a panel that has been open for a moment. Focus alone
       does not open anything: the panels sit after the whole tab bar, so
       opening on focus swapped the panel under every Tab press and left only
       Team's links reachable. Enter, Space or ArrowDown opens a panel and Tab
       then walks into it; tabbing out of its last link moves to the next tab. */
    const entries = (id) => {
      const p = panels.find((x) => x.dataset.tab === id);
      return p ? [...p.querySelectorAll("a[href]")] : [];
    };
    btns.forEach((b, i) => {
      b.addEventListener("mouseenter", () => show(b.dataset.tab));
      b.addEventListener("click", (e) => {
        e.preventDefault();
        openId === b.dataset.tab && performance.now() - shownAt > 400 ? hide() : show(b.dataset.tab);
      });
      b.addEventListener("keydown", (e) => {
        const id = b.dataset.tab;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          show(id);
          const first = entries(id)[0];
          if (first) first.focus();
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const next = btns[(i + (e.key === "ArrowRight" ? 1 : btns.length - 1)) % btns.length];
          if (openId) show(next.dataset.tab);
          next.focus();
        } else if (e.key === "Tab" && !e.shiftKey && openId === id) {
          const first = entries(id)[0];
          if (first) { e.preventDefault(); first.focus(); }
        }
      });
    });
    panels.forEach((p) => {
      p.addEventListener("mouseenter", () => clearTimeout(closeTimer));
      p.addEventListener("mouseleave", hideSoon);
      p.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const list = entries(p.dataset.tab);
        const i = btns.findIndex((b) => b.dataset.tab === p.dataset.tab);
        if (!e.shiftKey && document.activeElement === list[list.length - 1] && btns[i + 1]) {
          /* past the last link: on to the next tab. After Team the browser's own
             order already leads into the page, and focusout closes the panel. */
          e.preventDefault();
          hide();
          btns[i + 1].focus();
        } else if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          btns[i].focus();
        }
      });
    });
    root.querySelector(".sitenav__tabs").addEventListener("mouseleave", hideSoon);
    /* focus leaving the navigation closes whatever it left open */
    root.addEventListener("focusout", (e) => {
      if (e.relatedTarget && !root.contains(e.relatedTarget)) hide();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const inPanel = openId && root.contains(document.activeElement) &&
        !document.activeElement.classList.contains("sitenav__tab");
      const back = inPanel ? btns.find((b) => b.dataset.tab === openId) : null;
      hide();
      if (back) back.focus();
      if (root.classList.contains("drawer-open")) {
        root.classList.remove("drawer-open");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
        burger.focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (root.contains(e.target)) return;
      hide();
      if (root.classList.contains("drawer-open")) {
        root.classList.remove("drawer-open");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
      }
    });

    /* The dark bar over a hero is transparent until the page moves, so it needs
       to know. Cheap enough to run everywhere; only nav-dark.css styles it. */
    let ticking = false;
    const mark = () => {
      root.classList.toggle("is-scrolled", window.scrollY > 40);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(mark);
    }, { passive: true });
    mark();

    burger.addEventListener("click", () => {
      const open = root.classList.toggle("drawer-open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }


  /* A keyboard user's first Tab lands here, not on the links of the
     navigation. It points at the page's <main>, giving it an id if it has
     none; pages with their own skip link (hardware) or no <main> are left
     alone. Styled in nav.css, off-screen until focused. */
  function skipLink() {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".skip-link, .sitenav-skip")) return;
    if (!main.id) main.id = "main";
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    const a = document.createElement("a");
    a.className = "sitenav-skip";
    a.href = "#" + main.id;
    a.textContent = "Skip to content";
    document.body.prepend(a);
  }

  /* A box that scrolls on its own (a wide table on a phone, a wide figure)
     has to be reachable from the keyboard, or whatever sits past its edge can
     only be seen with a mouse or a finger. While, and only while, such a box
     overflows and holds nothing focusable, it gets a tab stop and a name
     (role="group", not "region", so thirty tables do not become thirty
     landmarks). */
  function scrollRegions() {
    const FOCUSABLE = 'a[href], button, input, select, textarea, summary, iframe, ' +
                      '[contenteditable], [tabindex]:not([tabindex="-1"])';
    const scrolls = (v) => v === "auto" || v === "scroll";
    const name = (el, sideways) => {
      const cap = el.querySelector("caption, figcaption");
      let t = cap ? cap.textContent.replace(/¶/g, "").replace(/\s+/g, " ").trim() : "";
      if (t.length > 90) t = t.slice(0, 88).replace(/\s\S*$/, "") + "…";
      return (t || (el.querySelector("table") ? "Table" : el.querySelector("svg, canvas, img") ? "Figure" : "Content")) +
             (sideways ? ", scrolls sideways" : ", scrolls");
    };
    const unmark = (el) => {
      (el.dataset.scrollstop || "").split(" ").forEach((a) => a && el.removeAttribute(a));
      delete el.dataset.scrollstop;
    };
    const check = () => {
      const keep = new Set();
      document.querySelectorAll("body *").forEach((el) => {
        const wide = el.scrollWidth > el.clientWidth + 1;
        const tall = el.scrollHeight > el.clientHeight + 1;
        if (!wide && !tall) return;
        const cs = getComputedStyle(el);
        const sideways = wide && scrolls(cs.overflowX);
        if (!sideways && !(tall && scrolls(cs.overflowY))) return;
        if (el.dataset.scrollstop != null) { keep.add(el); return; }   /* already ours */
        if (el.hasAttribute("tabindex")) return;       /* someone already chose */
        if (el.querySelector(FOCUSABLE) || el.closest('[aria-hidden="true"], [inert]')) return;
        const added = ["tabindex"];
        el.tabIndex = 0;
        if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
          if (!el.hasAttribute("role")) { el.setAttribute("role", "group"); added.push("role"); }
          el.setAttribute("aria-label", name(el, sideways)); added.push("aria-label");
        }
        el.dataset.scrollstop = added.join(" ");
        keep.add(el);
      });
      document.querySelectorAll("[data-scrollstop]").forEach((el) => { if (!keep.has(el)) unmark(el); });
      cues();
    };
    /* A table wider than its column says so in words underneath, and only
       while it is: "More columns to the right, scroll sideways". The line is
       aria-hidden because the wrapper's own name (above) already says it
       scrolls sideways. Styled as .scrollcue in page.css. */
    const cues = () => {
      document.querySelectorAll(".tablewrap").forEach((w) => {
        const over = w.scrollWidth > w.clientWidth + 1;
        let cue = w.nextElementSibling;
        if (!cue || !cue.classList.contains("scrollcue")) {
          if (!over) return;
          cue = document.createElement("p");
          cue.className = "scrollcue";
          cue.setAttribute("aria-hidden", "true");
          cue.textContent = "More columns to the right. Scroll the table sideways.";
          w.after(cue);
        }
        cue.hidden = !over;
      });
    };
    let timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(check, 250); };
    if (document.readyState === "complete") soon();
    else window.addEventListener("load", soon);
    window.addEventListener("resize", soon);
    /* tabs, <details> and accordions change what overflows */
    document.addEventListener("click", soon);
    document.addEventListener("toggle", soon, true);
  }

  /* Demo wiki only: outline what breaks an iGEM rule (assets/js/rulecheck.js).
     Switched off with window.RULECHECK = false in assets/data/site-nav.js. */
  function ruleCheck(base) {
    if (window.RULECHECK === false) return;
    const s = document.createElement("script");
    s.src = base + "assets/js/rulecheck.js?v=6";   /* bump when rulecheck.js changes: Pages lets browsers cache it for 10 minutes */
    s.defer = true;
    document.body.appendChild(s);
  }

  /* Demo wiki only: the writing review left at the end of each section
     (assets/js/review-notes.js). Switched off with window.REVIEW_NOTES = false. */
  function reviewNotes(base) {
    if (window.REVIEW_NOTES === false && !document.querySelector(".review-note")) return;
    const s = document.createElement("script");
    s.src = base + "assets/js/review-notes.js?v=3";
    s.defer = true;
    document.body.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", () => {
    reveal();
    const root = document.getElementById("site-nav");
    if (root) build(root);
    skipLink();
    scrollRegions();
    ruleCheck(root && root.dataset.base != null ? root.dataset.base : "");
    reviewNotes(root && root.dataset.base != null ? root.dataset.base : "");
  });
})();
