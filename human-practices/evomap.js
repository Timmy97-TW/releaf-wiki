/* =============================================================================
   ReLeaf: Project Evolution Map
   -----------------------------------------------------------------------------
   Renders window.EVOMAP into [data-evomap]:

     the arc          where the project started and where it ended, stated once
     the controls     filter by project area, by return visit, or jump to a month
     the cards        one per engagement, in date order, two to a row: the face
                      of the person we met, what they told us, thumbnails of the
                      evidence, and the decision that followed
     the record       opens from a card: visit comparison for anyone we went
                      back to, what they said, before and after, and the
                      photographs of what changed

   Progressive: with scripts off the section says so and the same engagements
   are described in sections 3 to 5. The only thing it touches outside its own
   container is the html.evo-open class, which hides the contents rail while
   the section is on screen.
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

  var byLane  = index(D.lanes, "id");
  var byEng   = index(D.engagements, "id");
  var byBuild = index(D.builds, "id");
  var loopOf  = {};
  D.loops.forEach(function (lp) {
    lp.visits.forEach(function (id, i) { loopOf[id] = { loop: lp, n: i + 1 }; });
  });

  var state = { area: "all", threads: false };
  var lastFocus = null;
  var wrap, controls, tally, arcStart, arcEnd, grid, sheet, sheetCard;

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
  function date(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + SHORT[parseInt(p[1], 10) - 1];
  }
  function longDate(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthName(k) {
    var p = k.split("-");
    return MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function gap(a, b) {
    var d = Math.round((new Date(b) - new Date(a)) / 86400000);
    if (d < 21) return d + " days";
    var w = Math.round(d / 7);
    return w < 14 ? w + " weeks" : Math.round(d / 30.4) + " months";
  }
  function initials(name) {
    return name.replace(/^(Dr|Prof|Ms|Mr)\.?\s+/, "").split(/\s+/)
      .slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }
  function decisions(e) {
    return D.laneStates.filter(function (s) { return s.by === e.id; });
  }
  function changedLine(e) {
    var ds = decisions(e);
    if (ds.length) {
      return { label: ds.length > 1 ? ds.length + " areas changed" : byLane[ds[0].lane].name + " changed",
               text: ds.map(function (s) { return s.label; }).join(" · ") };
    }
    var chain = D.chains.filter(function (c) { return c.from.type === "engagement" && c.from.id === e.id; });
    if (chain.length) {
      var t = chain[0].to.type === "build" ? byBuild[chain[0].to.id] : byEng[chain[0].to.id];
      return { label: "What followed", text: t ? (t.label || t.name) : chain[0].label };
    }
    if (e.after && e.after.length) return { label: "What we did next", text: e.after[0] };
    return null;
  }
  function visible(e) {
    if (state.threads && !loopOf[e.id]) return false;
    if (state.area !== "all" && e.lanes.indexOf(state.area) < 0) return false;
    return true;
  }
  function face(e, cls) {
    if (e.face) {
      var img = document.createElement("img");
      img.className = "evo__face" + (cls || "");
      img.src = IMG + e.face + ".webp";
      img.alt = "From our meeting with " + e.name + ", " + longDate(e.date) + ".";
      img.loading = "lazy";
      img.width = 360; img.height = 360;
      return img;
    }
    return el("span", "evo__face evo__face--none" + (cls || ""), initials(e.name));
  }

  /* ---- build -------------------------------------------------------------- */

  function build() {
    wrap = el("div", "evo");

    /* the arc */
    var arcBox = el("div", "evo__arc");
    arcStart = el("div"); arcEnd = el("div", "is-end");
    arcBox.appendChild(arcStart); arcBox.appendChild(arcEnd);
    wrap.appendChild(arcBox);

    /* controls */
    controls = el("div", "evo__controls");
    var r1 = el("div", "evo__row1");
    r1.appendChild(el("span", "evo__flabel", "Read"));
    chip(r1, "all", "The whole project");
    D.lanes.forEach(function (l) { chip(r1, l.id, l.name, l.blurb); });
    var th = el("button", "evo__chip evo__chip--thread");
    th.type = "button";
    th.textContent = "Return visits only";
    th.setAttribute("aria-pressed", "false");
    th.addEventListener("click", function () {
      state.threads = !state.threads;
      th.setAttribute("aria-pressed", state.threads ? "true" : "false");
      apply();
    });
    r1.appendChild(th);
    controls.appendChild(r1);

    var r2 = el("div", "evo__row2");
    r2.appendChild(el("span", "evo__flabel", "Jump to"));
    months().forEach(function (k) {
      var b = el("button", "evo__jump", monthName(k).replace(" 2026", ""));
      b.type = "button";
      b.addEventListener("click", function () {
        var h = grid.querySelector('[data-month="' + k + '"]');
        if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      r2.appendChild(b);
    });
    tally = el("span", "evo__count");
    r2.appendChild(tally);
    controls.appendChild(r2);
    wrap.appendChild(controls);

    /* the cards, grouped by month */
    grid = el("div");
    var last = null, row = null;
    D.engagements.forEach(function (e, i) {
      var k = monthKey(e.date);
      if (k !== last) {
        var h = el("div", "evo__month");
        h.dataset.month = k;
        h.appendChild(el("b", null, monthName(k)));
        h.appendChild(el("span", null, ""));
        grid.appendChild(h);
        row = el("div", "evo__grid");
        row.dataset.month = k;
        grid.appendChild(row);
        last = k;
      }
      row.appendChild(card(e, i));
    });
    var empty = el("p", "evo__empty", "No engagement in this area. Try another chip.");
    empty.hidden = true;
    grid.appendChild(empty);
    wrap.appendChild(grid);

    /* the record */
    sheet = el("div", "evo__sheet");
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "The record of this engagement");
    sheetCard = el("div", "evo__sheetcard");
    var close = el("button", "evo__close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", closeSheet);
    sheet.appendChild(sheetCard);
    sheetCard.appendChild(close);
    sheet.addEventListener("click", function (ev) { if (ev.target === sheet) closeSheet(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !sheet.hidden) closeSheet();
    });

    root.textContent = "";
    root.appendChild(wrap);
    root.appendChild(sheet);
  }

  function months() {
    var out = [];
    D.engagements.forEach(function (e) {
      var k = monthKey(e.date);
      if (out.indexOf(k) < 0) out.push(k);
    });
    return out;
  }

  function chip(into, id, label, title) {
    var b = el("button", "evo__chip");
    b.type = "button";
    b.textContent = label;
    if (title) b.title = title;
    b.dataset.area = id;
    b.setAttribute("aria-pressed", id === state.area ? "true" : "false");
    b.addEventListener("click", function () {
      state.area = id;
      [].forEach.call(into.querySelectorAll("[data-area]"), function (o) {
        o.setAttribute("aria-pressed", o.dataset.area === id ? "true" : "false");
      });
      apply();
    });
    into.appendChild(b);
  }

  /* ---- one card ----------------------------------------------------------- */

  function card(e, i) {
    var lp = loopOf[e.id];
    var c = el("button", "evo__card");
    c.type = "button";
    c.dataset.id = e.id;
    if (lp) c.classList.add("evo__card--thread");
    if (e.pending) c.classList.add("evo__card--pending");
    c.addEventListener("click", function () { openSheet(e.id); });

    var head = el("div", "evo__head");
    head.appendChild(face(e));
    var who = el("div");
    var h3 = el("h3", "evo__who");
    h3.appendChild(document.createTextNode(e.name + " "));
    if (e.zh) h3.appendChild(el("i", null, e.zh));
    who.appendChild(h3);
    var sub = el("div", "evo__sub");
    sub.appendChild(el("span", "evo__date", date(e.date)));
    if (lp) sub.appendChild(el("span", "evo__visit", "Visit " + lp.n + " of " + lp.loop.count));
    if (e.role) sub.appendChild(el("span", null, e.role));
    who.appendChild(sub);
    head.appendChild(who);
    c.appendChild(head);

    var said = el("p", "evo__said");
    if (e.suggestion || e.quote) {
      said.appendChild(el("b", null, e.quote ? "In their words " : "They told us "));
      said.appendChild(document.createTextNode(e.quote ? "“" + e.quote + "”" : e.suggestion));
    } else if (e.pending) {
      said.appendChild(el("b", null, "Write-up owed "));
      said.appendChild(document.createTextNode("It is on the map because it happened, not because we can report it yet."));
    } else if (e.summary) {
      said.appendChild(document.createTextNode(e.summary));
    }
    if (said.childNodes.length) c.appendChild(said);

    if (e.evidence && e.evidence.length) {
      var th = el("div", "evo__thumbs");
      e.evidence.slice(0, 3).forEach(function (ev) {
        var img = document.createElement("img");
        img.src = IMG + ev.src + ".webp";
        img.alt = ev.cap;
        img.loading = "lazy";
        th.appendChild(img);
      });
      if (e.evidence.length > 3) th.appendChild(el("span", null, "+" + (e.evidence.length - 3)));
      c.appendChild(th);
    }

    var ch = changedLine(e);
    var foot = el("div", "evo__foot");
    if (ch) {
      var d = el("div", "evo__changed");
      d.appendChild(el("b", null, ch.label));
      d.appendChild(document.createTextNode(ch.text));
      foot.appendChild(d);
    } else {
      foot.appendChild(el("div", "evo__changed", ""));
    }
    foot.appendChild(el("span", "evo__open", "Record →"));
    c.appendChild(foot);
    return c;
  }

  /* ---- the record --------------------------------------------------------- */

  function openSheet(id) {
    var e = byEng[id];
    if (!e) return;
    lastFocus = document.activeElement;
    var lp = loopOf[id];

    [].slice.call(sheetCard.children).forEach(function (n) {
      if (!n.classList.contains("evo__close")) sheetCard.removeChild(n);
    });

    var head = el("div", "evo__sheethead");
    head.appendChild(face(e));
    var col = el("div");
    col.appendChild(el("h3", null, e.name + (e.zh ? " " + e.zh : "")));
    var meta = el("p", "evo__meta");
    meta.appendChild(el("b", null, longDate(e.date)));
    meta.appendChild(document.createTextNode(
      (e.role ? "  ·  " + e.role : "") + (e.where ? "  ·  " + e.where : "")));
    col.appendChild(meta);
    if (e.dateNote) col.appendChild(el("p", "evo__meta", e.dateNote));
    head.appendChild(col);
    sheetCard.appendChild(head);

    if (lp) {
      sheetCard.appendChild(el("h4", null, "The thread: " + lp.loop.count + " meetings with " + lp.loop.person));
      sheetCard.appendChild(visits(lp.loop, e));
      if (lp.loop.depth) {
        var deep = el("div", "evo__deep");
        deep.appendChild(el("b", null, "What went deeper. "));
        deep.appendChild(document.createTextNode(lp.loop.depth));
        sheetCard.appendChild(deep);
      }
    }

    if (e.summary) {
      sheetCard.appendChild(el("h4", null, "The meeting"));
      sheetCard.appendChild(el("p", null, e.summary));
    }
    if (e.quote) {
      sheetCard.appendChild(el("h4", null, "In their words"));
      sheetCard.appendChild(el("p", null, "“" + e.quote + "”"));
    }
    if (e.suggestion) {
      sheetCard.appendChild(el("h4", null, "What they told us"));
      sheetCard.appendChild(el("p", null, e.suggestion));
    }
    if (e.takeaways && e.takeaways.length) {
      sheetCard.appendChild(el("h4", null, "Key feedback"));
      var ul = el("ul");
      e.takeaways.forEach(function (t) { ul.appendChild(el("li", null, t)); });
      sheetCard.appendChild(ul);
    }
    if ((e.before && e.before.length) || (e.after && e.after.length)) {
      sheetCard.appendChild(el("h4", null, "Before this, and after it"));
      var ba = el("div", "evo__ba");
      ba.appendChild(col2("from", "What we were doing", e.before));
      ba.appendChild(col2("to", "What we changed", e.after));
      sheetCard.appendChild(ba);
    }
    var ds = decisions(e);
    if (ds.length) {
      sheetCard.appendChild(el("h4", null, ds.length > 1 ? "The areas this moved" : "The area this moved"));
      var dl = el("ul");
      ds.forEach(function (s) {
        var li = el("li");
        li.appendChild(el("b", null, byLane[s.lane].name + ": "));
        li.appendChild(document.createTextNode(s.label + ". " + (s.note || "")));
        dl.appendChild(li);
      });
      sheetCard.appendChild(dl);
    }
    if (e.evidence && e.evidence.length) {
      sheetCard.appendChild(el("h4", null, "What changed, in photographs"));
      var ev = el("div", "evo__ev");
      e.evidence.forEach(function (p) {
        var f = el("figure");
        var img = document.createElement("img");
        img.src = IMG + p.src + ".webp";
        img.alt = p.cap;
        img.loading = "lazy";
        f.appendChild(img);
        f.appendChild(el("figcaption", null, p.cap + " Scaled only."));
        ev.appendChild(f);
      });
      sheetCard.appendChild(ev);
    }
    if (e.links && e.links.length) {
      var ls = el("div", "evo__links");
      e.links.forEach(function (l) {
        var a = el("a", null, l.label);
        a.href = l.href;
        ls.appendChild(a);
      });
      sheetCard.appendChild(ls);
    }
    if (e.source) sheetCard.appendChild(el("p", "evo__src", "Source: " + e.source + "."));

    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    sheetCard.scrollTop = 0;
    sheetCard.querySelector(".evo__close").focus();
  }

  function col2(cls, title, items) {
    var d = el("div", cls);
    d.appendChild(el("h5", null, title));
    var ul = el("ul");
    (items || []).forEach(function (t) { ul.appendChild(el("li", null, t)); });
    d.appendChild(ul);
    return d;
  }

  function visits(loop, here) {
    var box = el("div", "evo__visits");
    box.style.setProperty("--n", loop.count);
    loop.visits.forEach(function (id, i) {
      var v = byEng[id];
      var d = el("div", id === here.id ? "is-here" : null);
      var head = "Visit " + (i + 1) + " · " + longDate(v.date);
      if (i > 0) head += " · " + gap(byEng[loop.visits[i - 1]].date, v.date) + " later";
      d.appendChild(el("h5", null, head));
      d.appendChild(el("p", null, (id === here.id ? "You are reading this one. " : "") +
        (v.suggestion || v.summary || "")));
      if (id !== here.id) {
        var go = el("button", null, "Read this visit");
        go.type = "button";
        go.addEventListener("click", function () { openSheet(id); });
        d.appendChild(go);
      }
      box.appendChild(d);
    });
    return box;
  }

  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---- filtering ---------------------------------------------------------- */

  function apply() {
    var shown = 0, threads = {};
    [].forEach.call(grid.querySelectorAll(".evo__card"), function (c) {
      var e = byEng[c.dataset.id];
      var on = visible(e);
      c.hidden = !on;
      if (on) {
        shown += 1;
        if (loopOf[e.id]) threads[loopOf[e.id].loop.id] = 1;
      }
    });
    [].forEach.call(grid.querySelectorAll(".evo__grid"), function (row) {
      var n = row.querySelectorAll(".evo__card:not([hidden])").length;
      row.hidden = n === 0;
      var head = grid.querySelector('.evo__month[data-month="' + row.dataset.month + '"]');
      if (head) {
        head.hidden = n === 0;
        head.querySelector("span").textContent = n + (n === 1 ? " conversation" : " conversations");
      }
    });
    var empty = grid.querySelector(".evo__empty");
    if (empty) empty.hidden = shown > 0;
    tally.textContent = shown + " of " + D.engagements.length + " engagements · "
      + Object.keys(threads).length + " return threads";
    setArc();
  }

  function setArc() {
    var s, t;
    if (state.area === "all") {
      s = { tag: "Where we started", title: "Bacteria in the soil", text: D.meta.startState };
      t = { tag: "Where it ended", title: "Bacteria in a box", text: D.meta.endState };
    } else {
      var ls = D.laneStates.filter(function (x) { return x.lane === state.area; });
      var a = ls[0], b = ls[ls.length - 1];
      s = { tag: "Where we started", title: a ? a.label : "", text: a ? (a.note || "") : "" };
      t = { tag: byLane[state.area].name + " now", title: b ? b.label : "", text: b ? (b.note || "") : "" };
    }
    fill(arcStart, s); fill(arcEnd, t);
  }

  function fill(box, o) {
    box.textContent = "";
    box.appendChild(el("span", "evo__label", o.tag));
    box.appendChild(el("h3", null, o.title));
    box.appendChild(el("p", null, o.text));
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
  apply();
  watch();

  /* A record is addressable: #record-e21 opens Prof. Chang's second visit. */
  function fromHash() {
    var m = /^#record-(e\d+)$/.exec(window.location.hash || "");
    if (m && byEng[m[1]]) openSheet(m[1]);
  }
  fromHash();
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("resize", measure);
})();
