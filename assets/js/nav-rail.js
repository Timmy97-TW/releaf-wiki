/* =============================================================================
   ReLeaf: the hovering left rail
   -----------------------------------------------------------------------------
   Builds #nav-rail from two sources: the page's own <section class="sec" id>
   headings, and the NAV array in assets/data/site-nav.js. Page addresses stay
   in one file; this renderer only reads them.

   Attributes on the mount point, same contract as nav.js:
     data-base   "" at the wiki root, "../" one folder down
     data-tab    the NAV tab this page belongs to
     data-page   this page's slug, so its entry can be marked current
   ========================================================================== */
(function () {
  "use strict";

  var IDLE_MS = 3000;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build(mount) {
    var base = mount.dataset.base != null ? mount.dataset.base : "";
    var tabId = mount.dataset.tab || "";
    var pageSlug = mount.dataset.page || "";

    var rail = el("aside", "rail");
    rail.setAttribute("aria-label", "Section and site navigation");

    var spine = el("div", "rail__spine");
    var panel = el("nav", "rail__panel");

    /* ---- home mark ---- */
    var home = el("a", "rail__home");
    home.href = base || "./";
    home.title = "ReLeaf home";
    var logo = document.createElement("img");
    logo.src = base + "assets/img/logo.png";
    logo.alt = "ReLeaf";
    home.appendChild(logo);
    spine.appendChild(home);

    /* ---- ticks, one per section on this page ---- */
    var secs = [].slice.call(document.querySelectorAll("main .sec[id]"));
    var ticks = el("div", "rail__ticks");
    var contents = el("ol", "rail__contents");
    var tickFor = {};
    var linkFor = {};

    secs.forEach(function (sec, i) {
      var h = sec.querySelector("h2");
      var title = (h ? h.textContent : sec.id)
        .replace(/\u00b6/g, "")
        .replace(/^\s*\d+[.\s]*/, "")
        .trim();
      var n = String(i + 1).padStart(2, "0");

      var t = el("button", "rail__tick");
      t.type = "button";
      t.title = n + "  " + title;
      t.setAttribute("aria-label", title);
      t.addEventListener("click", function () {
        sec.scrollIntoView({ behavior: prefersMotion() ? "smooth" : "auto", block: "start" });
      });
      ticks.appendChild(t);
      tickFor[sec.id] = t;

      var li = document.createElement("li");
      var a = el("a");
      a.href = "#" + sec.id;
      a.appendChild(el("i", null, n));
      a.appendChild(el("span", null, title));
      li.appendChild(a);
      contents.appendChild(li);
      linkFor[sec.id] = a;
    });

    spine.appendChild(ticks);

    var menu = el("button", "rail__menu");
    menu.type = "button";
    menu.setAttribute("aria-label", "Open navigation");
    menu.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    spine.appendChild(menu);

    /* ---- panel: this page, then the wiki ---- */
    if (secs.length) {
      panel.appendChild(el("p", "rail__label", "On this page"));
      panel.appendChild(contents);
    }
    panel.appendChild(el("p", "rail__label", "The wiki"));

    var nav = (typeof NAV !== "undefined" && NAV) || window.NAV || [];
    nav.forEach(function (tab) {
      var group = el("div", "rail__group");
      var top = el("button", "rail__grouptop");
      top.type = "button";
      top.appendChild(el("span", null, tab.name));
      top.appendChild(el("i", "rail__chev"));
      var body = el("div", "rail__groupbody");

      tab.pages.forEach(function (p) {
        var a = el("a", p.slug === pageSlug ? "is-current" : null, p.title);
        a.href = p.href || base + p.slug + "/";
        if (p.slug === pageSlug) a.setAttribute("aria-current", "page");
        body.appendChild(a);
      });

      if (tab.id === tabId) {
        group.classList.add("is-here", "is-open");
        top.setAttribute("aria-expanded", "true");
      } else {
        top.setAttribute("aria-expanded", "false");
      }

      top.addEventListener("click", function () {
        var open = group.classList.toggle("is-open");
        top.setAttribute("aria-expanded", String(open));
      });

      group.appendChild(top);
      group.appendChild(body);
      panel.appendChild(group);
    });

    rail.appendChild(spine);
    rail.appendChild(panel);

    var edge = el("div", "rail__edge");
    edge.setAttribute("aria-hidden", "true");

    mount.replaceWith(rail);
    rail.after(edge);
    document.body.classList.add("has-rail");

    wire(rail, edge, menu, tickFor, linkFor, secs);
  }

  function prefersMotion() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function wire(rail, edge, menu, tickFor, linkFor, secs) {
    var idleTimer = null;
    var pinned = false;

    function wake() {
      rail.classList.remove("is-idle");
      clearTimeout(idleTimer);
      if (pinned || rail.classList.contains("is-open")) return;
      idleTimer = setTimeout(function () {
        if (!pinned && !rail.classList.contains("is-open")) rail.classList.add("is-idle");
      }, IDLE_MS);
    }

    function open() { rail.classList.add("is-open"); wake(); }
    function close() { if (!pinned) { rail.classList.remove("is-open"); wake(); } }

    edge.addEventListener("pointerenter", wake);
    edge.addEventListener("pointermove", wake);
    rail.addEventListener("pointerenter", function () { wake(); open(); });
    rail.addEventListener("pointerleave", close);
    rail.addEventListener("focusin", function () { wake(); open(); });
    rail.addEventListener("focusout", function (e) {
      if (!rail.contains(e.relatedTarget)) close();
    });

    menu.addEventListener("click", function (e) {
      e.stopPropagation();
      pinned = !pinned;
      menu.setAttribute("aria-expanded", String(pinned));
      pinned ? open() : close();
    });

    document.addEventListener("click", function (e) {
      if (pinned && !rail.contains(e.target)) { pinned = false; close(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { pinned = false; close(); }
    });

    var scrollTick = false;
    window.addEventListener("scroll", function () {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(function () { scrollTick = false; wake(); });
    }, { passive: true });

    /* clicking a contents entry should not leave the panel hanging open */
    rail.querySelectorAll(".rail__contents a").forEach(function (a) {
      a.addEventListener("click", function () { pinned = false; setTimeout(close, 120); });
    });

    /* ---- scrollspy ---- */
    if (secs.length && "IntersectionObserver" in window) {
      var seen = new Map();
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { seen.set(en.target.id, en); });
        var best = null;
        seen.forEach(function (en) {
          if (!en.isIntersecting) return;
          if (!best || en.intersectionRatio > best.intersectionRatio ||
              (en.intersectionRatio === best.intersectionRatio &&
               en.boundingClientRect.top < best.boundingClientRect.top)) best = en;
        });
        if (!best) return;
        var id = best.target.id;
        Object.keys(tickFor).forEach(function (k) {
          tickFor[k].classList.toggle("is-active", k === id);
          if (linkFor[k]) linkFor[k].classList.toggle("is-active", k === id);
        });
      }, { rootMargin: "-12% 0px -60% 0px", threshold: [0, .25, .5, 1] });
      secs.forEach(function (s) { obs.observe(s); });
    }

    wake();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var mount = document.getElementById("nav-rail");
    if (mount) build(mount);
  });
})();
