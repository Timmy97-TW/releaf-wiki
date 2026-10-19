// Tab strips inside a section, in the look of the record's cycle tabs (../css/hwdoc.css, 4b).
//
// 17 Oct 2026. The owner: the calibration part had "far too many graphs stacked vertically", and the two materials
// lists should not be two tables stacked either. So 5.2 and 5.3 show one graph at a time, each with the paragraphs
// that discuss it, and 10.1 shows the Pro's list or the Slim's. The bar reuses the cycles' classes (.cyc-tabs,
// .cyc-tab) so it is the same pill. Markup:
//
//   <div class="pm-tabs" data-pm-tabs [data-numbered] [data-sticky] aria-label="...">
//     <div class="pm-tab" data-tab="Short name"> ...one panel... </div> ...
//   </div>
//
// With JavaScript off, and in print, every panel is on the page, in order. A link (a cross-reference, the rail, a
// URL) that points into a panel that is not showing opens its tab first: this listens in the capture phase and is
// loaded before ../js/hwdoc.js, so by the time hwdoc.js and doc.js measure and scroll, the target is on the page.
//
// 17 Oct 2026, evening, the owner: the calibration bars (data-sticky) follow the screen until the reader is out of
// their box, like the cycle stepper (hwdoc.js, part 4). The CSS pins the bar inside its own set, so it stays until the
// box has gone and two bars can never overlap; this marks it pinned (its deeper shadow), and on a tab chosen while
// pinned takes the reader back to the top of the set, so the new panel starts under the bar.
(function () {
  "use strict";
  var sets = [], uid = 0;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function target(hash) {
    if (!hash || hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
  }

  function build(root) {
    var panels = Array.prototype.filter.call(root.children, function (c) { return c.hasAttribute("data-tab"); });
    if (panels.length < 2) return;
    var k = ++uid, numbered = root.hasAttribute("data-numbered");
    var bar = mk("div", "cyc-tabs pm-tabs__bar");
    var list = mk("div", "cyc-tabs__list");
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-label", root.getAttribute("aria-label") || "Views");
    bar.appendChild(list);
    var set = { root: root, bar: bar, list: list, items: [], cur: -1, numbered: numbered,
                sticky: root.hasAttribute("data-sticky") };
    panels.forEach(function (p, i) {
      var name = p.getAttribute("data-tab");
      var b = mk("button", "cyc-tab");
      b.type = "button";
      b.id = "pm-tab-" + k + "-" + (i + 1);
      if (!p.id) p.id = "pm-panel-" + k + "-" + (i + 1);
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", p.id);
      if (numbered) {
        var n = mk("b", "cyc-tab__n", String(i + 1));
        n.setAttribute("aria-hidden", "true");
        b.appendChild(n);
      }
      b.appendChild(mk("span", "cyc-tab__t", name));
      list.appendChild(b);
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", b.id);
      set.items.push({ el: p, btn: b });
      b.addEventListener("click", function () { select(set, i, true); });
      b.addEventListener("keydown", function (e) { keys(set, i, e); });
    });
    root.insertBefore(bar, panels[0]);
    root.classList.add("is-tabbed");
    // data-start="<tab name>" on the set picks the tab shown first (18 Oct 2026: the soldered boards open on "Component side")
    var start = 0, t = target(location.hash), ds = root.getAttribute("data-start");
    if (ds) panels.forEach(function (p, i) { if (p.getAttribute("data-tab") === ds) start = i; });
    set.items.forEach(function (it, i) { if (t && it.el.contains(t)) start = i; });
    sets.push(set);
    select(set, start, false);
    fit(set);
  }

  function select(set, i, user) {
    if (i === set.cur) return false;
    set.cur = i;
    set.items.forEach(function (it, j) {
      var on = j === i;
      it.btn.setAttribute("aria-selected", on ? "true" : "false");
      it.btn.tabIndex = on ? 0 : -1;
      it.el.hidden = !on;
      if (on && user && !reduce) {
        it.el.classList.remove("is-entering");
        void it.el.offsetWidth;
        it.el.classList.add("is-entering");
      }
    });
    if (set.bar.classList.contains("is-compact")) fit(set);
    if (user && set.sticky) settle(set);
    paint();
    return true;
  }

  // the bar's pinned top (the CSS), and the reader's place against it
  function stickTop(set) { return parseFloat(getComputedStyle(set.bar).top) || 76; }
  // back to the top of the set, the bar in its own place, so the panel just opened starts under it
  function settle(set) {
    var d = set.root.getBoundingClientRect().top - stickTop(set);
    if (d < -1) window.scrollTo({ top: Math.max(0, window.scrollY + d), behavior: "instant" });
  }
  var painting = false;
  function paint() {
    if (painting) return;
    painting = true;
    requestAnimationFrame(function () {
      painting = false;
      sets.forEach(function (s) {
        if (!s.sticky) return;
        var r = s.root.getBoundingClientRect(), top = stickTop(s);
        s.bar.classList.toggle("is-pinned", r.top < top - 1 && r.bottom > top + s.bar.offsetHeight);
      });
    });
  }

  function keys(set, i, e) {
    var n = set.items.length, j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % n;
    else if (e.key === "ArrowLeft") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    select(set, j, true);
    set.items[j].btn.focus({ preventScroll: true });
  }

  // Every name when they all fit; on a phone, a numbered set shows the numbers and the open tab's name, and a bar
  // still too wide scrolls inside itself (the cycles' own rules: .is-compact, .is-scroll).
  function fit(set) {
    var bar = set.bar, tl = set.list;
    bar.classList.remove("is-compact", "is-scroll");
    var over = tl.scrollWidth > tl.clientWidth + 1;
    if (over && set.numbered) bar.classList.add("is-compact");
    set.items.forEach(function (it) {
      if (bar.classList.contains("is-compact")) it.btn.title = it.el.getAttribute("data-tab"); else it.btn.removeAttribute("title");
    });
    bar.classList.toggle("is-scroll", tl.scrollWidth > tl.clientWidth + 1);
    if (set.sticky && bar.offsetHeight) set.root.style.setProperty("--pmt-bar-h", bar.offsetHeight + "px");
  }

  // open the tab that holds t, if it is shut
  function reveal(t) {
    var opened = false;
    sets.forEach(function (set) {
      set.items.forEach(function (it, i) {
        if (it.el.hidden && it.el.contains(t) && select(set, i, false)) opened = true;
      });
    });
    return opened;
  }
  window.pmTabsReveal = reveal;

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-pm-tabs]"), build);
    if (!sets.length) return;
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var t = target(a.getAttribute("href"));
      if (t) reveal(t);
    }, true);
    window.addEventListener("hashchange", function () { var t = target(location.hash); if (t) reveal(t); }, true);
    var refit = function () { sets.forEach(fit); paint(); };
    if (sets.some(function (s) { return s.sticky; })) window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", refit, { passive: true });
    window.addEventListener("load", refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
