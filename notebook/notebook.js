/* =============================================================================
   ReLeaf: Wet Lab Notebook
   -----------------------------------------------------------------------------
   Three jobs, and the page works without any of them: with JavaScript off
   every month is on the page in order, each with its Open PDF and Download
   links and its full entry index, and the page links in the index open the
   PDF at that page.

   1. Month tabs. One month at a time under a segmented control. A month's
      viewer gets its src only when it is on screen, since a file is up to
      6 MB. The open month is kept in the URL hash (#july).
   2. Page links. A link to "pdf/…#page=N" anywhere on the page turns the
      month's viewer to that page instead of leaving, and marks its row.
   3. Finder. Searches every entry of every month by title, names or date.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  document.body.classList.add("js");

  var root = $("[data-mtabs]");
  if (!root) return;
  var bar = $(".mtabs__bar", root);
  var ink = $(".mtabs__ink", bar);
  var tabs = $$("[role=tab]", bar);
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });

  /* ---- viewer loading -------------------------------------------------- */
  var seen = typeof IntersectionObserver === "function" ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { load(e.target); seen.unobserve(e.target); }
    });
  }, { rootMargin: "300px 0px" }) : null;

  function load(frame, page) {
    var base = frame.getAttribute("data-src");
    /* page width, no thumbnail rail: the viewer is narrow beside its index */
    var want = base + "#" + (page ? "page=" + page + "&" : "") + "view=FitH&navpanes=0";
    if (frame.getAttribute("src") !== want) frame.setAttribute("src", want);
  }
  $$(".pdfbox iframe[data-src]").forEach(function (f) { if (seen) seen.observe(f); else load(f); });

  /* ---- tabs ------------------------------------------------------------ */
  function place() {
    var t = tabs.filter(function (x) { return x.getAttribute("aria-selected") === "true"; })[0];
    if (!t || !ink) return;
    ink.style.width = t.offsetWidth + "px";
    ink.style.transform = "translateX(" + t.offsetLeft + "px)";
  }

  function select(i, opts) {
    opts = opts || {};
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (panels[k]) panels[k].hidden = !on;
    });
    place();
    if (opts.focus) tabs[i].focus();
    if (opts.hash !== false && panels[i] && history.replaceState) {
      history.replaceState(null, "", "#" + panels[i].id);
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(i); });
    t.addEventListener("keydown", function (e) {
      var k = null;
      if (e.key === "ArrowRight") k = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") k = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") k = 0;
      else if (e.key === "End") k = tabs.length - 1;
      if (k !== null) { e.preventDefault(); select(k, { focus: true }); }
    });
  });

  function fromHash() {
    var id = location.hash.slice(1);
    var i = panels.map(function (p) { return p && p.id; }).indexOf(id);
    return i;
  }

  var start = fromHash();
  root.classList.add("is-ready");
  select(start < 0 ? 0 : start, { hash: false });
  if (start >= 0) requestAnimationFrame(function () { root.scrollIntoView({ block: "start" }); });
  window.addEventListener("resize", place);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  window.addEventListener("hashchange", function () { var i = fromHash(); if (i >= 0) select(i, { hash: false }); });

  /* ---- page links ------------------------------------------------------ */
  function panelFor(file) {
    for (var k = 0; k < panels.length; k++) {
      var f = panels[k] && $("iframe[data-src]", panels[k]);
      if (f && f.getAttribute("data-src") === file) return k;
    }
    return -1;
  }

  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href*="pdf/wetlab-notebook-"][href*="#page="]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var href = a.getAttribute("href");
    var file = href.split("#")[0];
    var page = (href.match(/#page=(\d+)/) || [])[1];
    var k = panelFor(file);
    if (k < 0) return;
    var frame = $("iframe[data-src]", panels[k]);
    var pdf = frame.closest(".pdfbox");
    if (!pdf || getComputedStyle(pdf).display === "none") return;   /* phone: let the link open the file */
    e.preventDefault();
    select(k);
    if (seen) seen.unobserve(frame);
    load(frame, page);

    $$("tr.is-current").forEach(function (r) { r.classList.remove("is-current"); });
    var row = a.closest("tr");
    if (row) row.classList.add("is-current");
    /* the same entry in the month's own index, if the link came from elsewhere */
    var own = $('.ix a[href="' + href + '"]', panels[k]);
    if (own) {
      var r2 = own.closest("tr");
      r2.classList.add("is-current");
      var box = r2.closest(".ix");
      if (box && box !== (row && row.closest(".ix"))) box.scrollTop = r2.offsetTop - box.clientHeight / 3;
    }
    if (!inView(pdf)) pdf.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ---- finder ---------------------------------------------------------- */
  var q = $("#finder-q");
  var out = $("#finder-out");
  var count = $("#finder-n");
  if (!q || !out) return;
  var body = $("tbody", out);

  var rows = [];
  panels.forEach(function (p) {
    if (!p) return;
    $$(".ix tr", p).forEach(function (tr) {
      rows.push({ tr: tr, text: tr.textContent.replace(/\s+/g, " ").toLowerCase() });
    });
  });
  var total = rows.length;

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function mark(node, rx) {
    $$(".ix__t span, .ix__t small", node).forEach(function (el) {
      el.innerHTML = el.textContent.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; })
        .replace(rx, function (m) { return "<mark>" + m + "</mark>"; });
    });
  }

  var timer;
  function run() {
    var s = q.value.trim().toLowerCase();
    body.textContent = "";
    if (s.length < 2) { out.hidden = true; count.textContent = ""; return; }
    var words = s.split(/\s+/);
    var hits = rows.filter(function (r) { return words.every(function (w) { return r.text.indexOf(w) >= 0; }); });
    var rx = new RegExp("(" + words.map(esc).join("|") + ")", "gi");
    var frag = document.createDocumentFragment();
    hits.slice(0, 200).forEach(function (r) {
      var c = r.tr.cloneNode(true);
      c.classList.remove("is-current");
      mark(c, rx);
      frag.appendChild(c);
    });
    body.appendChild(frag);
    out.hidden = hits.length === 0;
    out.scrollTop = 0;
    count.textContent = hits.length + " of " + total + " entries" + (hits.length > 200 ? ", the first 200 shown" : "");
  }
  q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 90); });
  q.addEventListener("keydown", function (e) { if (e.key === "Escape") { q.value = ""; run(); } });
})();
