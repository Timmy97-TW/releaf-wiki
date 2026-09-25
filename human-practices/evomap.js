/* =============================================================================
   ReLeaf: Project Evolution Map
   -----------------------------------------------------------------------------
   Renders window.EVOMAP into [data-evomap], laid out the way iGEM Heidelberg
   2025 laid out their Human Practices page (stations of interviews, one per
   project phase), rebuilt for our data:

     the arc        where the project started and where it ended, stated once
     the stations   five, in date order, each sized to be read in one window.
                    On the left the phase is drawn as a shape that says what it
                    was about (a sealed box, a flask, a leaf, a drop, a speech
                    bubble) with the faces placed along its line in date order;
                    the line inks in up to the person being read, and the shape
                    fills once the last one is reached. On the right, that
                    person's card and its four photographs. Select a face, or
                    step with the arrows, to change both.
     the card       what the meeting settled, who it was, why we went, what
                    they told us, what we changed, and where it led. The full
                    record (the suggestion, what we had before, the areas that
                    changed, sources) is folded under it.

   Every card is built up front, so print shows them all. With scripts off the
   section says so, and sections 3 to 5 carry the same engagements in prose.
   The only thing it touches outside its own container is the html.evo-open
   class, which hides the contents rail while the section is on screen.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.EVOMAP;
  var root = document.querySelector("[data-evomap]");
  if (!D || !root) return;

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];
  var SHORT  = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var IMG    = "../assets/img/human-practices/";

  /* Each station is drawn as a shape that says what the phase was about, in a
     100 x 100 box. d is the line the faces sit on, in date order; t places
     each face along it (0 = start, 1 = end); place puts each name tag to the
     right, left, top or bottom of its face, away from the line. */
  var SHAPES = {
    /* Redesign: the path starts in the soil and closes the sealed vessel at
       the fifth meeting, which is where the project ended up */
    box: {
      d: "M 38 92 C 33 88, 42 84, 36 80 S 30 72, 30 66 L 30 16 L 70 16 L 70 66 L 30 66",
      t: [0, .27, .47, .64, 1],
      place: ["r", "l", "t", "r", "l"],
      fill: ["M 30 16 H 70 V 66 H 30 Z"],
      dash: ["M 6 76 H 94"],
      words: [[8, 83, "soil"], [50, 43, "sealed vessel"]]
    },
    /* First builds: a flask, for the first reactor and the plant screen */
    flask: {
      d: "M 43 8 L 43 34 L 28 80 Q 26 88 34 88 L 66 88 Q 74 88 72 80 L 57 34 L 57 8",
      t: [0, .25, .44, .56, .75, 1],
      place: ["l", "l", "l", "r", "r", "r"],
      fill: ["M 33.5 64 L 66.5 64 L 72 80 Q 74 88 66 88 L 34 88 Q 26 88 28 80 Z"],
      deco: ["M 38 8 H 62"],
      words: [[50, 79, "first reactor"]]
    },
    /* Industry and farms: a leaf, for the people who grow and sell plants */
    leaf: {
      d: "M 50 94 L 50 80 C 26 72, 22 38, 50 10 C 78 38, 74 72, 50 80",
      t: [0, .3, .52, .74, 1],
      place: ["r", "l", "r", "r", "l"],
      fill: ["M 50 80 C 26 72, 22 38, 50 10 C 78 38, 74 72, 50 80 Z"],
      deco: ["M 50 80 L 50 18", "M 50 64 L 39 55", "M 50 64 L 61 55", "M 50 47 L 41 39", "M 50 47 L 59 39", "M 50 31 L 44 25", "M 50 31 L 56 25"]
    },
    /* Dose and delivery: a drop, for how much reaches the plant, and when */
    drop: {
      d: "M 50 8 C 43 21, 26 42, 26 62 A 24 24 0 0 0 74 62 C 74 42, 57 21, 50 8",
      t: [0, .3, .55, .8],
      place: ["r", "l", "b", "r"],
      fill: ["M 50 8 C 43 21, 26 42, 26 62 A 24 24 0 0 0 74 62 C 74 42, 57 21, 50 8 Z"],
      deco: ["M 36 60 Q 36 72 46 76"],
      dash: ["M 22 95 Q 50 99 78 95"]
    },
    /* Forum and reviews: a speech bubble, for the project said out loud and
       questioned in public. The path starts at the tail, so the forum sits
       on its tip. */
    bubble: {
      d: "M 50 64 L 38 84 L 41 64 L 34 64 Q 24 64 24 54 L 24 24 Q 24 14 34 14 L 66 14 Q 76 14 76 24 L 76 54 Q 76 64 66 64 L 50 64",
      t: [0, .1, .32, .6, .75],
      place: ["r", "l", "r", "t", "l"],
      fill: ["M 34 14 L 66 14 Q 76 14 76 24 L 76 54 Q 76 64 66 64 L 50 64 L 38 84 L 41 64 L 34 64 Q 24 64 24 54 L 24 24 Q 24 14 34 14 Z"],
      deco: ["M 42 39 h .01", "M 50 39 h .01", "M 58 39 h .01"]
    }
  };

  var byLane  = index(D.lanes, "id");
  var byEng   = index(D.engagements, "id");
  var byBuild = index(D.builds, "id");
  /* loopOf holds the visit number only where an engagement belongs to one
     return thread; the forum belongs to three, so it gets returnOf instead */
  var loopOf  = {}, returnOf = {};
  D.loops.forEach(function (lp) {
    lp.visits.forEach(function (id, i) {
      if (returnOf[id]) { if (i > 0) returnOf[id].push(lp.person); delete loopOf[id]; return; }
      returnOf[id] = i > 0 ? [lp.person] : [];
      loopOf[id] = { loop: lp, n: i + 1 };
    });
  });
  function visitNote(id) {
    if (loopOf[id]) return "visit " + loopOf[id].n + " of " + loopOf[id].loop.count;
    var r = returnOf[id];
    if (r && r.length > 1) return "return visit for " + r.slice(0, -1).join(", ") + " and " + r[r.length - 1];
    return "";
  }

  var stations = [];      /* { box, ids, show(i) } */
  var stationOf = {};     /* engagement id -> { st, i } */
  var arcStart, arcEnd;

  /* ---- helpers ------------------------------------------------------------ */

  function index(list, key) {
    var out = {};
    list.forEach(function (o) { out[o[key]] = o; });
    return out;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    /* page.js numbers every heading it finds and lists it in the contents
       rail; none of the map's own headings belong there, and an empty
       data-no-toc is falsy to page.js, so the value has to be there. */
    if (/^H[1-6]$/.test(n.tagName)) n.setAttribute("data-no-toc", "true");
    return n;
  }
  function button(cls, text) {
    var b = el("button", cls, text);
    b.type = "button";
    return b;
  }
  function date(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + SHORT[parseInt(p[1], 10) - 1];
  }
  function longDate(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1];
  }
  function initials(name) {
    return name.replace(/^(Dr|Prof|Ms|Mr|Dean)\.?\s+/, "").split(/\s+/)
      .slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }
  function face(e, cls) {
    if (e.face) {
      var img = document.createElement("img");
      img.className = "evo__face" + (/^logo-/.test(e.face) ? " evo__face--logo" : "") + (cls ? " " + cls : "");
      img.src = IMG + e.face + ".webp";
      img.alt = "";
      img.loading = "lazy";
      img.width = 360; img.height = 360;
      return img;
    }
    return el("span", "evo__face evo__face--none" + (cls ? " " + cls : ""), initials(e.name));
  }
  function list(items) {
    var ul = el("ul");
    items.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    return ul;
  }
  function reduced() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }

  /* ---- build -------------------------------------------------------------- */

  function build() {
    var wrap = el("div", "evo");

    var arcBox = el("div", "evo__arc");
    arcStart = el("div"); arcEnd = el("div", "is-end");
    arcBox.appendChild(arcStart); arcBox.appendChild(arcEnd);
    wrap.appendChild(arcBox);
    fill(arcStart, { tag: "Where we started", title: "Bacteria in the soil", text: D.meta.startState });
    fill(arcEnd, { tag: "Where it ended", title: "Bacteria in a box", text: D.meta.endState });

    D.stations.forEach(function (s, k) { wrap.appendChild(station(s, k)); });
    root.appendChild(wrap);
    stations.forEach(function (st) { st.place(); });
  }

  function fill(box, o) {
    box.appendChild(el("span", "evo__label", o.tag));
    box.appendChild(el("h3", null, o.title));
    box.appendChild(el("p", null, o.text));
  }

  /* ---- a station ---------------------------------------------------------- */

  function station(s, k) {
    var es = s.ids.map(function (id) { return byEng[id]; }).filter(Boolean);
    var shape = SHAPES[s.glyph] || SHAPES.box;
    var box = el("div", "evo-st evo-st--" + (s.glyph || "box"));
    box.id = "evo-" + s.id;

    var head = el("div", "evo-st__head");
    head.appendChild(el("h3", null, s.name));
    head.appendChild(el("p", "evo-st__dates", s.dates + " · " + es.length + " engagements"));
    head.appendChild(el("p", "evo-st__lede", s.lede));
    box.appendChild(head);

    /* the map: the phase drawn as a shape, the faces placed along its line in
       date order, and the line inked in up to the person being read */
    var map = el("figure", "evo-st__map");
    var canvas = el("div", "evo-st__canvas");
    var svg = svgEl("svg", { "class": "evo-st__glyph", viewBox: "0 0 100 100", "aria-hidden": "true" });
    (shape.fill || []).forEach(function (d) { svg.appendChild(svgEl("path", { d: d, "class": "evo-g__fill" })); });
    (shape.deco || []).forEach(function (d) { svg.appendChild(svgEl("path", { d: d, "class": "evo-g__deco" })); });
    (shape.dash || []).forEach(function (d) { svg.appendChild(svgEl("path", { d: d, "class": "evo-g__dash" })); });
    (shape.words || []).forEach(function (w) {
      var t = svgEl("text", { x: w[0], y: w[1], "class": "evo-g__word" });
      t.textContent = w[2];
      svg.appendChild(t);
    });
    var track = svgEl("path", { d: shape.d, "class": "evo-g__track", pathLength: "1000" });
    var ink = svgEl("path", { d: shape.d, "class": "evo-g__ink", pathLength: "1000" });
    svg.appendChild(track);
    svg.appendChild(ink);
    canvas.appendChild(svg);

    var nodes = el("ol", "evo-st__nodes");
    nodes.setAttribute("aria-label", s.name + ": who we met, in date order");
    var nodeBtns = [], lis = [];
    es.forEach(function (e, i) {
      var li = el("li", "at-" + ((shape.place || [])[i] || "r"));
      var b = button("evo-node");
      b.setAttribute("aria-controls", "evo-" + e.id);
      b.appendChild(face(e, "evo-node__face"));
      var tag = el("span", "evo-node__tag");
      tag.appendChild(el("b", null, e.name));
      tag.appendChild(el("span", null, date(e.date) + (loopOf[e.id] ? " · visit " + loopOf[e.id].n + "/" + loopOf[e.id].loop.count : "")));
      b.appendChild(tag);
      b.addEventListener("click", function () { show(i); });
      li.appendChild(b);
      nodes.appendChild(li);
      nodeBtns.push(b);
      lis.push(li);
    });
    canvas.appendChild(nodes);
    map.appendChild(canvas);
    if (s.glyphNote) map.appendChild(el("figcaption", null, s.glyphNote));
    box.appendChild(map);

    /* the cards, one visible at a time, with the stepper above them */
    var side = el("div", "evo-st__side");
    var nav = el("div", "evo-st__nav");
    var count = el("span", "evo-st__count");
    count.setAttribute("aria-live", "polite");
    var prev = button("evo-st__step", "←");
    var next = button("evo-st__step", "→");
    prev.setAttribute("aria-label", "Previous engagement");
    next.setAttribute("aria-label", "Next engagement");
    nav.appendChild(count); nav.appendChild(prev); nav.appendChild(next);
    side.appendChild(nav);
    var cards = es.map(function (e) { var c = card(e); side.appendChild(c); return c; });
    box.appendChild(side);

    /* the four photographs of whichever card is showing, in the same window */
    var shelf = el("div", "evo-st__photos");
    var strips = es.map(function (e) { var p = photos(e); shelf.appendChild(p); return p; });
    box.appendChild(shelf);

    var ts = shape.t || es.map(function (e, i) { return es.length > 1 ? i / (es.length - 1) : 0; });
    var cur = 0;
    function show(i) {
      cur = Math.max(0, Math.min(es.length - 1, i));
      cards.forEach(function (c, j) { c.classList.toggle("is-current", j === cur); });
      strips.forEach(function (p, j) { p.classList.toggle("is-current", j === cur); });
      nodeBtns.forEach(function (b, j) {
        b.setAttribute("aria-current", j === cur ? "true" : "false");
        b.classList.toggle("is-past", j < cur);
      });
      ink.style.strokeDasharray = Math.max(1, ts[cur] * 1000) + " 1000";
      box.classList.toggle("is-complete", cur === es.length - 1);
      prev.disabled = cur === 0;
      next.disabled = cur === es.length - 1;
      count.textContent = (cur + 1) + " of " + es.length;
    }
    prev.addEventListener("click", function () { show(cur - 1); });
    next.addEventListener("click", function () { show(cur + 1); });

    /* faces are placed on the line once the drawing is in the document,
       where the browser can measure it */
    function place() {
      var len = track.getTotalLength();
      lis.forEach(function (li, j) {
        var p = track.getPointAtLength(ts[j] * len);
        li.style.left = p.x + "%";
        li.style.top = p.y + "%";
      });
    }

    var st = { box: box, show: show, place: place };
    es.forEach(function (e, i) { stationOf[e.id] = { st: st, i: i }; });
    stations.push(st);
    show(0);
    return box;
  }

  function svgEl(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /* ---- a card ------------------------------------------------------------- */

  function card(e) {
    var c = el("article", "evo-cd");
    c.id = "evo-" + e.id;
    c.setAttribute("aria-labelledby", "evo-" + e.id + "-h");

    var meta = el("p", "evo-cd__meta");
    meta.appendChild(el("b", null, longDate(e.date)));
    var bits = [];
    if (e.where) bits.push(e.where);
    if (visitNote(e.id)) bits.push(visitNote(e.id));
    if (bits.length) meta.appendChild(document.createTextNode(" · " + bits.join(" · ")));
    c.appendChild(meta);

    var h = el("h4", "evo-cd__head", e.headline || e.name);
    h.id = "evo-" + e.id + "-h";
    h.tabIndex = -1;
    c.appendChild(h);

    var who = el("div", "evo-cd__who");
    who.appendChild(face(e));
    var wp = el("p");
    wp.appendChild(el("b", null, e.name + (e.zh ? " " + e.zh : "")));
    wp.appendChild(el("span", null, e.role || ""));
    who.appendChild(wp);
    c.appendChild(who);

    if (e.summary) c.appendChild(el("p", "evo-cd__sum", e.summary));

    var cols = el("div", "evo-cd__cols");
    var told = el("div");
    told.appendChild(el("h5", null, e.kind === "expert" || e.kind === "company" ? "What they told us" : "What we heard"));
    told.appendChild(list(e.takeaways || []));
    cols.appendChild(told);
    var did = el("div", "is-to");
    did.appendChild(el("h5", null, "What we changed"));
    if (e.after && e.after.length) did.appendChild(list(e.after));
    else did.appendChild(el("p", "evo-cd__none", "No change recorded in our log."));
    cols.appendChild(did);
    c.appendChild(cols);

    var led = leadsTo(e);
    if (led) c.appendChild(led);

    c.appendChild(record(e));
    return c;
  }

  /* where it led: referrals out of this engagement, and the next visit */
  function leadsTo(e) {
    var out = el("p", "evo-cd__led");
    var any = false;
    D.chains.filter(function (ch) { return ch.from.type === "engagement" && ch.from.id === e.id; })
      .forEach(function (ch) {
        if (any) out.appendChild(document.createTextNode(" · "));
        if (ch.to.type === "engagement" && byEng[ch.to.id]) {
          var t = byEng[ch.to.id];
          out.appendChild(jump(t.id, t.name + ", " + date(t.date)));
        } else if (byBuild[ch.to.id]) {
          var b = byBuild[ch.to.id];
          out.appendChild(el("span", null, b.approx ? b.label : b.label + ", " + date(b.date)));
        }
        any = true;
      });
    var lp = loopOf[e.id];
    if (lp && lp.n < lp.loop.visits.length) {
      var nx = byEng[lp.loop.visits[lp.n]];
      if (any) out.appendChild(document.createTextNode(" · "));
      out.appendChild(jump(nx.id, "Next visit, " + date(nx.date)));
      any = true;
    }
    if (!any) return null;
    out.insertBefore(el("b", null, "Led to"), out.firstChild);
    return out;
  }
  function jump(id, text) {
    var a = el("a", null, text);
    a.href = "#record-" + id;
    a.addEventListener("click", function (ev) { ev.preventDefault(); open(id, true); history.replaceState(null, "", "#record-" + id); });
    return a;
  }

  /* the full record, folded */
  function record(e) {
    var d = el("details", "evo-cd__full");
    d.appendChild(el("summary", null, "Full record"));
    if (e.quote) {
      d.appendChild(el("h5", null, "In their words"));
      d.appendChild(el("p", null, "“" + e.quote + "”"));
    }
    if (e.suggestion || e.keyPoint) {
      d.appendChild(el("h5", null, "Key suggestion"));
      d.appendChild(el("p", null, e.keyPoint || e.suggestion));
      if (e.keyPoint && e.suggestion) d.appendChild(el("p", null, e.suggestion));
    }
    if (e.before && e.before.length) {
      d.appendChild(el("h5", null, "What we had before"));
      d.appendChild(list(e.before));
    }
    var ds = D.laneStates.filter(function (s) { return s.by === e.id; });
    if (ds.length) {
      d.appendChild(el("h5", null, ds.length > 1 ? "Areas that changed" : "Area that changed"));
      d.appendChild(list(ds.map(function (s) { return byLane[s.lane].name + ": " + s.label; })));
    }
    if (e.dateNote) d.appendChild(el("p", "evo-cd__note", e.dateNote));
    if (e.links && e.links.length) {
      var links = el("p", "evo__links");
      e.links.forEach(function (l) {
        var a = el("a", null, l.label);
        a.href = l.href;
        links.appendChild(a);
      });
      d.appendChild(links);
    }
    if (e.source) d.appendChild(el("p", "evo__src", "Source: " + e.source));
    return d;
  }

  /* ---- the photographs ---------------------------------------------------- */

  function photos(e) {
    var row = el("div", "evo-ph");
    row.setAttribute("aria-label", "Photographs: " + e.name + ", " + longDate(e.date));
    (e.evidence || []).slice(0, 4).forEach(function (p, n) {
      var fig = el("figure");
      var b = button("evo-ph__btn");
      b.setAttribute("aria-label", "Open photograph: " + p.cap);
      var img = document.createElement("img");
      img.src = IMG + p.src + ".webp";
      img.alt = p.cap;
      img.loading = "lazy";
      b.appendChild(img);
      b.addEventListener("click", function () { viewer(e.evidence, n, b); });
      fig.appendChild(b);
      fig.appendChild(el("figcaption", null, p.cap));
      row.appendChild(fig);
    });
    return row;
  }

  /* ---- the viewer --------------------------------------------------------- */

  var lb, lbImg, lbCap, lbCount, lbSet, lbAt, lbFrom;

  function viewer(list, n, from) {
    if (!lb) {
      lb = el("div", "evo-lb");
      lb.setAttribute("role", "dialog");
      lb.setAttribute("aria-modal", "true");
      lb.setAttribute("aria-label", "Photograph");
      var fig = el("figure", "evo-lb__fig");
      lbImg = document.createElement("img");
      lbCap = el("figcaption");
      lbCount = el("span", "evo-lb__count");
      fig.appendChild(lbImg);
      fig.appendChild(lbCap);
      var prev = button("evo-lb__nav evo-lb__nav--prev");
      var next = button("evo-lb__nav evo-lb__nav--next");
      var close = button("evo-lb__close", "✕");
      prev.setAttribute("aria-label", "Previous photograph");
      next.setAttribute("aria-label", "Next photograph");
      close.setAttribute("aria-label", "Close");
      prev.addEventListener("click", function (ev) { ev.stopPropagation(); step(-1); });
      next.addEventListener("click", function (ev) { ev.stopPropagation(); step(1); });
      close.addEventListener("click", shut);
      lb.addEventListener("click", function (ev) { if (ev.target === lb || ev.target === fig) shut(); });
      document.addEventListener("keydown", function (ev) {
        if (!lb || lb.hidden) return;
        if (ev.key === "Escape") { ev.stopPropagation(); shut(); }
        if (ev.key === "ArrowRight") step(1);
        if (ev.key === "ArrowLeft") step(-1);
        if (ev.key === "Tab") { ev.preventDefault(); close.focus(); }
      }, true);
      lb.appendChild(fig);
      lb.appendChild(prev);
      lb.appendChild(next);
      lb.appendChild(close);
      lb.appendChild(lbCount);
      lb.hidden = true;
      document.body.appendChild(lb);
    }
    lbSet = list; lbAt = n; lbFrom = from;
    paint();
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    lb.querySelector(".evo-lb__close").focus();
  }
  function paint() {
    var p = lbSet[lbAt];
    lbImg.src = IMG + p.src + ".webp";
    lbImg.alt = p.cap;
    lbCap.textContent = p.cap;
    lbCount.textContent = (lbAt + 1) + " / " + lbSet.length;
  }
  function step(d) {
    lbAt = (lbAt + d + lbSet.length) % lbSet.length;
    paint();
  }
  function shut() {
    lb.hidden = true;
    document.body.style.overflow = "";
    if (lbFrom && lbFrom.focus) lbFrom.focus();
  }

  /* ---- open a card from anywhere ------------------------------------------ */

  function open(id, scroll) {
    var at = stationOf[id];
    if (!at) return;
    at.st.show(at.i);
    if (scroll) at.st.box.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    var h = document.getElementById("evo-" + id + "-h");
    if (h) h.focus({ preventScroll: true });
  }

  /* ---- the band ----------------------------------------------------------- */

  function measure() {
    var css = document.documentElement.style;
    css.setProperty("--evo-vw", document.documentElement.clientWidth + "px");
    var band = root.closest(".sec--evo");
    if (!band || !band.parentElement) return;
    var prev = band.style.marginLeft;
    band.style.marginLeft = "0px";
    css.setProperty("--evo-left", Math.round(band.getBoundingClientRect().left) + "px");
    band.style.marginLeft = prev;
  }

  /* The rail hides while the band holds the middle of the window. A scroll
     handler rather than an observer, because this has to be right during
     printing, inside an iframe and in a background tab as well. */
  function watch() {
    var band = root.closest(".sec--evo");
    if (!band) return;
    function check() {
      var r = band.getBoundingClientRect();
      var mid = window.innerHeight / 2;
      document.documentElement.classList.toggle("evo-open", r.top < mid && r.bottom > mid);
    }
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    window.addEventListener("load", check);
    window.addEventListener("hashchange", check);
    setTimeout(check, 400);
    check();
  }

  /* ---- go ----------------------------------------------------------------- */

  measure();
  build();
  watch();

  /* A card is addressable: #record-e21 opens Prof. Chang's second visit. */
  function fromHash() {
    var m = /^#(?:record|evo)-(e\d+)$/.exec(window.location.hash || "");
    if (m && byEng[m[1]]) open(m[1], true);
  }
  fromHash();
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("resize", measure);
})();
