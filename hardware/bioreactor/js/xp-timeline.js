// The bioreactor record, part 4: the build timeline (15 Oct 2026, the owner's suggestion 4).
//
// Lays out nav#dbtl-map, the build timeline, as a June → October timeline of its tracks: since 15 Oct the right half of
// the team's cycle diagram, Hollow fiber membrane, Pumps & valve control and Integrative bioreactor (three lanes, the
// most the narrow layout's rails, RX below, are spaced for), after the culture track (6 and 14 June) moved to the
// photometer page with its prototypes. The cycle map above it (#cyc-map, no script) is where "Back to the cycle map"
// lands since then. The markup stays the
// list it always was (one <li> per prototype: its link, name, date, outcome), so this script only arranges it:
//   wide (≥ 700 px)  one lane per track on a 1 June → 31 October 2026 axis. A prototype with a date on record stands at
//                    that date; one without stands under "No date", in its track's order. Point at a prototype or
//                    tap it and the panel under the lanes shows its photo or sketch and its outcome; a click (or a
//                    second tap) goes to it.
//   narrow (phone)   a vertical timeline: the tracks are rails at the left, one row per prototype in date order,
//                    the undated last; tap a row for its photo and the way to it.
// Honesty: positions come only from data-date, which carries only dates on record (see the note in index.html);
// every outcome is the page's own text. Nothing here computes a number. No animation, so nothing to pause.
(function () {
  "use strict";
  var nav = document.getElementById("dbtl-map");
  if (!nav || !nav.classList.contains("xp-tl")) return;
  var stage = nav.querySelector(".tl-stage");
  var tracks = stage ? [].slice.call(stage.querySelectorAll(":scope > .track")) : [];
  if (!tracks.length) return;

  var MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
    "November", "December"];
  // The axis runs over the months that have a dated prototype, no wider (the reviewer, 15 Oct: with one date on
  // record, a June to October axis was mostly empty). Set once the dates are read, below; June to October 2026 if none.
  var Y = 2026, M0 = 5, M1 = 9;
  var T0 = Date.UTC(Y, M0, 1), SPAN = (Date.UTC(Y, M1 + 1, 1) - T0) / 864e5;
  var WIDE = 640;                                                 // lanes below this width would crowd June
  var WIDE_TOUCH = 720;                                           // a touch screen keeps the list a little longer
  var touchOnly = !!(window.matchMedia && window.matchMedia("(hover: none)").matches);
  var STEP = 34;                                                  // spacing of the undated, in order

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function inner(li, sel) { var e = li.querySelector(sel); return e ? e.innerHTML.trim() : ""; }

  /* ---- the prototypes, in page order ---- */
  var items = [];
  tracks.forEach(function (tr, lane) {
    var head = tr.querySelector(".track-h");
    var num = head && head.querySelector("i") ? head.querySelector("i").textContent.trim() : "";
    var name = head ? head.textContent.replace(num, "").trim() : "";
    var short = tr.getAttribute("data-lane") || name;
    var undated = 0;
    [].slice.call(tr.querySelectorAll(":scope > ol > li")).forEach(function (li, j) {
      var a = li.querySelector("a");
      if (!a) return;
      var ds = li.getAttribute("data-date"), date = null, t = null;
      if (ds) {
        var p = ds.split("-");
        date = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
        t = 0;                                                    // placed once the axis is known
      }
      items.push({
        li: li, a: a, lane: lane, n: j + 1, track: tr, laneNum: num, laneName: name, laneShort: short,
        date: date, t: t, u: t == null ? undated++ : -1,
        todo: li.classList.contains("tk-todo"), gap: li.getAttribute("data-gap") || "",
        img: li.getAttribute("data-img"), alt: li.getAttribute("data-alt") || "",
        fit: li.getAttribute("data-fit") || "cover", pos: li.getAttribute("data-pos") || "50% 50%",
        name: inner(li, ".tl-name") || inner(a, "span"), when: inner(li, ".tl-when"),
        out: inner(li, ".tl-out"), story: inner(li, ".tl-story"),
        target: (a.getAttribute("href") || "").slice(1)
      });
    });
    tr._undated = undated;
  });
  if (!items.length) return;
  items.forEach(function (it, i) { it.idx = i; });
  var dated = items.filter(function (it) { return it.date; });
  if (dated.length) {
    var ms = dated.map(function (it) { return it.date.getUTCFullYear() * 12 + it.date.getUTCMonth(); });
    var lo = Math.min.apply(null, ms), hi = Math.max.apply(null, ms);
    Y = Math.floor(lo / 12); M0 = lo % 12; M1 = M0 + (hi - lo);
    T0 = Date.UTC(Y, M0, 1); SPAN = (Date.UTC(Y, M1 + 1, 1) - T0) / 864e5;
  }
  dated.forEach(function (it) { it.t = (it.date - T0) / 864e5 + 0.5; });   // the middle of that day

  /* ---- each node: the record's D/B/T/L ring, orange where a stage is not written ---- */
  function pt(r, deg) {
    var a = deg * Math.PI / 180;
    return (r * Math.sin(a)).toFixed(2) + " " + (-r * Math.cos(a)).toFixed(2);
  }
  function ring(it) {
    var s = '<svg class="tl-ring" viewBox="-16 -16 32 32" aria-hidden="true" focusable="false"><circle class="tl-core" r="10.6"/>';
    ["d", "b", "t", "l"].forEach(function (k, i) {
      var miss = it.todo || it.gap.indexOf(k) >= 0;
      s += '<path class="tl-q ' + k + (miss ? " miss" : "") + '" d="M' + pt(13.2, i * 90 - 40) + " A13.2 13.2 0 0 1 " +
        pt(13.2, i * 90 + 40) + '"/>';
    });
    return s + "</svg>";
  }
  var byA = new Map(), byLi = new Map();
  items.forEach(function (it) {
    it.a.classList.add("tl-node");
    it.a.insertAdjacentHTML("afterbegin", ring(it));
    var b = it.a.querySelector("b");
    if (b) b.setAttribute("aria-hidden", "true");
    // the narrow layout's line above the name: the date, if there is one (the rail and the key give the track,
    // which stays in the words for a screen reader)
    var k = el("span", "tl-k");
    var sr = el("span", "tl-sr");
    sr.textContent = it.laneNum + " " + it.laneName + (it.date ? ", " : ": ");
    k.appendChild(sr);
    if (it.date) {
      k.appendChild(document.createTextNode(it.date.getUTCDate() + " " + MON[it.date.getUTCMonth()] +
        (/dashboard/i.test(it.when) ? " \u00b7 the dashboard" : "")));
    } else k.classList.add("is-sr");
    it.li.insertBefore(k, it.li.firstChild);
    // the wide layout's date under the node
    var d = el("span", "tl-date");
    d.setAttribute("aria-hidden", "true");
    d.textContent = it.date ? it.date.getUTCDate() + " " + MON[it.date.getUTCMonth()].slice(0, 3) : "";
    it.li.appendChild(d);
    it.dateEl = d;
    byA.set(it.a, it);
    byLi.set(it.li, it);
  });

  /* ---- the wide layout's furniture ---- */
  var grid = el("div", "tl-grid"), axis = el("div", "tl-axis");
  grid.setAttribute("aria-hidden", "true");
  axis.setAttribute("aria-hidden", "true");
  stage.insertBefore(axis, stage.firstChild);
  stage.insertBefore(grid, stage.firstChild);
  tracks.forEach(function (tr) {
    var l = el("div", "tl-lines");
    l.setAttribute("aria-hidden", "true");
    tr.insertBefore(l, tr.firstChild);
    tr._lines = l;
  });
  // the narrow layout's list and rails
  var list = el("ol", "tl-list"), rails = el("div", "tl-rails");
  rails.setAttribute("aria-hidden", "true");
  list.setAttribute("aria-label", "Prototypes in date order");

  /* ---- the preview ---- */
  var peek = el("div", "tl-peek",
    '<div class="tl-pic"></div><div class="tl-tx">' +
    '<p class="tl-pk"></p><p class="tl-pt"></p><p class="tl-po"></p><p class="tl-ps"></p>' +
    '<div class="tl-pgo"><a class="xp-btn primary tl-go" href="#"></a><span class="tl-pnav">' +
    '<button type="button" class="xp-btn tl-prev" aria-label="Previous prototype"><span aria-hidden="true">&#8249;</span></button>' +
    '<button type="button" class="xp-btn tl-next" aria-label="Next prototype"><span aria-hidden="true">&#8250;</span></button>' +
    "</span></div></div>");
  var say = el("p", "tl-say");
  say.setAttribute("aria-live", "polite");
  stage.parentNode.insertBefore(say, stage.nextSibling);
  var pic = peek.querySelector(".tl-pic"), img = null;

  var mode = "", active = null, chosen = null;
  var how = nav.querySelector(".tl-how");

  function kicker(it) {
    return it.laneNum + " " + it.laneShort + " · Prototype " + it.n + " · " + (it.when || "no date on record");
  }
  function fill(it) {
    if (it.img) {
      if (!img) { img = el("img"); img.decoding = "async"; img.loading = "lazy"; }
      if (img.getAttribute("src") !== it.img) img.src = it.img;
      img.alt = it.alt;
      img.style.objectFit = it.fit;
      img.style.objectPosition = it.pos;
      pic.className = "tl-pic" + (it.fit === "contain" ? " sketch" : "");
      if (img.parentNode !== pic) { pic.innerHTML = ""; pic.appendChild(img); }
    } else {
      pic.className = "tl-pic none";
      pic.innerHTML = "<span>" + (it.todo ? "Not written yet" : "No photo yet") + "</span>";
    }
    peek.querySelector(".tl-pk").textContent = kicker(it);
    peek.querySelector(".tl-pt").innerHTML = it.name;
    peek.querySelector(".tl-po").innerHTML = it.out;
    var ps = peek.querySelector(".tl-ps");
    ps.innerHTML = it.story;
    ps.hidden = !it.story;
    var go = peek.querySelector(".tl-go");
    go.href = "#" + it.target;
    go.innerHTML = "Go to prototype " + it.n + ' <span aria-hidden="true">&darr;</span>';
    go.setAttribute("aria-label", "Go to " + it.laneName + ", prototype " + it.n);
    peek.querySelector(".tl-prev").disabled = it.idx === 0;
    peek.querySelector(".tl-next").disabled = it.idx === items.length - 1;
    peek.classList.toggle("is-todo", it.todo);
  }
  function show(it, o) {
    o = o || {};
    if (active && active !== it) active.li.classList.remove("is-on");
    if (mode === "v") items.forEach(function (x) { if (x !== it) x.li.classList.remove("is-open"); });
    active = it;
    it.li.classList.add("is-on");
    fill(it);
    if (mode === "v") {
      if (o.open) {
        it.li.classList.add("is-open");
        it.li.appendChild(peek);
        peek.hidden = false;
        placeV();
      }
    } else {
      peek.style.setProperty("--cx", (it.x || 0).toFixed(1) + "px");
    }
    if (o.user) chosen = it;
    if (o.say) say.textContent = it.laneNum + " " + it.laneName + ", prototype " + it.n + ", " + (it.when || "no date on record") +
      ". " + plain(it.out);
  }
  function plain(h) { var d = el("div", null, h); return d.textContent; }
  function closeRow(it) {
    it.li.classList.remove("is-open");
    if (peek.parentNode === it.li) { peek.hidden = true; nav.insertBefore(peek, say); }
    chosen = null;
    placeV();
  }

  /* ---- wide: lanes on the June → October axis ---- */
  function placeH() {
    var w = stage.clientWidth;
    var maxU = Math.max.apply(null, tracks.map(function (t) { return t._undated; }));
    var gw = maxU ? 2 * 21 + (maxU - 1) * STEP : 0;              // the "No date" column
    var gl = w - 8 - gw;
    var a0 = 18, a1 = gl - (gw ? 18 : 16);
    var X = function (t) { return a0 + t / SPAN * (a1 - a0); };
    var ah = "", gh = "";
    for (var m = M0; m <= M1; m++) {
      var s = (Date.UTC(Y, m, 1) - T0) / 864e5, e = (Date.UTC(Y, m + 1, 1) - T0) / 864e5;
      ah += '<span class="tl-month" style="left:' + X((s + e) / 2).toFixed(1) + 'px">' + MON[m % 12].slice(0, 3) + (M0 === M1 ? " " + Y : "") + "</span>";
      gh += '<i class="tl-gl" style="left:' + X(s).toFixed(1) + 'px"></i>';
    }
    gh += '<i class="tl-gl" style="left:' + X(SPAN).toFixed(1) + 'px"></i>';
    if (gw) {
      ah += '<span class="tl-month nd" style="left:' + (gl + gw / 2).toFixed(1) + 'px">No date</span>';
      gh += '<i class="tl-gut" style="left:' + gl.toFixed(1) + "px;width:" + gw.toFixed(1) + 'px"></i>';
    }
    axis.innerHTML = ah;
    grid.innerHTML = gh;

    items.forEach(function (it) {
      it.x = it.t != null ? X(it.t) : gl + 21 + it.u * STEP;
      it.li.style.setProperty("--x", it.x.toFixed(1) + "px");
    });
    // the rings are as large as the closest two dated prototypes on one lane allow (the culture lane's 6 and 14 June
    // were 8 days apart; with one dated prototype a lane, they keep the full size)
    var gap = Infinity;
    tracks.forEach(function (tr, lane) {
      var xs = items.filter(function (i) { return i.lane === lane && i.t != null; }).map(function (i) { return i.x; })
        .sort(function (a, b) { return a - b; });
      for (var k = 1; k < xs.length; k++) gap = Math.min(gap, xs[k] - xs[k - 1]);
    });
    nav.style.setProperty("--ring", Math.max(22, Math.min(28, Math.floor(gap - 2))) + "px");
    // each lane's line: solid between dated prototypes, dashed on to the undated ones
    tracks.forEach(function (tr, lane) {
      var its = items.filter(function (i) { return i.lane === lane; });
      var dated = its.filter(function (i) { return i.t != null; });
      var und = its.filter(function (i) { return i.t == null; });
      var h = "";
      var seg = function (x0, x1, cls) {
        return x1 - x0 > 1 ? '<i class="tl-seg ' + cls + '" style="left:' + x0.toFixed(1) + "px;width:" + (x1 - x0).toFixed(1) + 'px"></i>' : "";
      };
      if (dated.length > 1) h += seg(dated[0].x, dated[dated.length - 1].x, "solid");
      if (und.length) h += seg(dated.length ? dated[dated.length - 1].x : und[0].x, und[und.length - 1].x, "dash");
      tr._lines.innerHTML = h;
      var arc = tr.querySelector(":scope > .tl-arc");
      if (arc) {
        var after = items.filter(function (i) { return i.target === arc.getAttribute("data-after"); })[0];
        if (after) arc.style.left = (after.x + 24).toFixed(1) + "px";
      }
    });
    // two dates that would touch (as 6 and 14 June did) are pushed apart: the first ends at its node, the next starts at its
    tracks.forEach(function (tr, lane) {
      var ds = items.filter(function (i) { return i.lane === lane && i.t != null; });
      ds.forEach(function (i) { i.dateEl.classList.remove("to-l", "to-r"); });
      for (var k = 1; k < ds.length; k++) {
        var a = ds[k - 1].dateEl.getBoundingClientRect(), b = ds[k].dateEl.getBoundingClientRect();
        if (a.right + 6 > b.left) { ds[k - 1].dateEl.classList.add("to-l"); ds[k].dateEl.classList.add("to-r"); }
      }
    });
    if (active) peek.style.setProperty("--cx", active.x.toFixed(1) + "px");
  }

  /* ---- narrow: a vertical timeline, rails at the left ---- */
  var RX = [13, 31, 49];                                         // the rails, in px from the row's left
  function arrange(m) {
    if (m === "v") {
      var order = items.filter(function (i) { return i.t != null; }).sort(function (a, b) { return a.t - b.t; })
        .concat(items.filter(function (i) { return i.t == null; }));
      list.innerHTML = "";
      var last = "";
      var vias = {};
      tracks.forEach(function (tr) {
        var arc = tr.querySelector(":scope > .tl-arc");
        if (arc) vias[arc.getAttribute("data-after")] = arc.textContent;
      });
      order.forEach(function (it) {
        var key = it.date ? MON[it.date.getUTCMonth()] + " " + it.date.getUTCFullYear() : "No date on record";
        if (key !== last) {
          var mon = el("li", "tl-mon");
          mon.setAttribute("aria-hidden", "true");
          mon.textContent = key;
          list.appendChild(mon);
          last = key;
        }
        if (vias[it.target]) {
          var via = el("li", "tl-via");
          via.setAttribute("aria-hidden", "true");
          via.style.setProperty("--rx", RX[it.lane] + "px");
          via.textContent = vias[it.target];
          list.appendChild(via);
        }
        list.appendChild(it.li);
      });
      stage.appendChild(list);
      stage.appendChild(rails);
      tracks.forEach(function (tr, lane) { tr.style.setProperty("--rx", RX[lane] + "px"); });
      items.forEach(function (it) { it.li.style.setProperty("--rx", RX[it.lane] + "px"); });
    } else {
      items.forEach(function (it) { it.track.querySelector(":scope > ol").appendChild(it.li); it.li.classList.remove("is-open"); });
      if (list.parentNode) list.parentNode.removeChild(list);
      if (rails.parentNode) rails.parentNode.removeChild(rails);
    }
  }
  function placeV() {
    if (mode !== "v" || !list.parentNode) return;
    var box = stage.getBoundingClientRect();
    var rr = function (it) { return it.a.querySelector(".tl-ring").getBoundingClientRect(); };
    var cy = function (it) { var r = rr(it); return r.top + r.height / 2 - box.top; };
    var h = "";
    tracks.forEach(function (tr, lane) {
      var its = items.filter(function (i) { return i.lane === lane; });
      if (!its.length) return;
      var dated = its.filter(function (i) { return i.t != null; }).sort(function (a, b) { return a.t - b.t; });
      var und = its.filter(function (i) { return i.t == null; });
      var r0 = rr(its[0]), x = r0.left + r0.width / 2 - box.left;      // the rail runs through its rings' centres
      var seg = function (y0, y1, cls) {
        return y1 - y0 > 1 ? '<i class="tl-rail ' + cls + '" style="left:' + (x - 1).toFixed(1) + "px;top:" + y0.toFixed(1) +
          "px;height:" + (y1 - y0).toFixed(1) + 'px"></i>' : "";
      };
      if (dated.length > 1) h += seg(cy(dated[0]), cy(dated[dated.length - 1]), "solid");
      if (und.length) h += seg(cy(dated.length ? dated[dated.length - 1] : und[0]), cy(und[und.length - 1]), "dash");
    });
    rails.innerHTML = h;
  }

  function layout() {
    var m = nav.clientWidth >= (touchOnly ? WIDE_TOUCH : WIDE) ? "h" : "v";
    if (m !== mode) {
      mode = m;
      nav.classList.toggle("is-h", m === "h");
      nav.classList.toggle("is-v", m === "v");
      if (how) how.textContent = m === "h"
        ? "Point at one or tap it to see what it showed; click it to go there."
        : "Tap one for its photo or sketch and the way to it.";
      arrange(m);
      if (m === "h") {
        nav.insertBefore(peek, say);
        peek.hidden = false;
      } else {
        peek.hidden = true;
        nav.insertBefore(peek, say);
        items.forEach(function (i) { i.li.classList.remove("is-on"); });
        active = null; chosen = null;
      }
    }
    if (m === "h") {
      placeH();
      // the story starts at the earliest prototype on record (with the culture lane gone, the first in page order
      // is an outlined one, which has nothing to show yet)
      if (!active) show(items.filter(function (i) { return i.t != null; })
        .sort(function (a, b) { return a.t - b.t; })[0] || items[0]);
    } else placeV();
  }

  /* ---- reading it: hover, focus, tap ---- */
  var ptr = "mouse";
  nav.addEventListener("pointerdown", function (e) { ptr = e.pointerType || "mouse"; }, true);
  nav.addEventListener("keydown", function () { ptr = "key"; }, true);
  function itemOf(t) { var li = t && t.closest ? t.closest("li") : null; return li ? byLi.get(li) : null; }
  nav.addEventListener("pointerover", function (e) {
    if (mode !== "h" || e.pointerType !== "mouse") return;
    var it = itemOf(e.target);
    if (it && it !== active && e.target.closest("a.tl-node")) show(it, { user: true });
  });
  nav.addEventListener("focusin", function (e) {
    var it = itemOf(e.target);
    // a tap focuses the link on some phones; that is not yet the reader's choice, the click below decides
    if (it && e.target === it.a && it !== active) show(it, { user: ptr === "key", say: true });
  });
  // A tap previews before it goes. hwdoc.js follows #links from a capturing listener on document, so the first
  // tap is held here, on window, which hears the click before it does. A mouse click or Enter goes at once.
  window.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("#dbtl-map a.tl-node") : null;
    if (!a || ptr === "mouse" || ptr === "key") return;
    var it = byA.get(a);
    if (!it) return;
    var ready = mode === "h" ? chosen === it : it.li.classList.contains("is-open");
    if (ready) return;
    e.preventDefault();
    e.stopPropagation();
    show(it, { user: true, open: true, say: true });
  }, true);
  // narrow: a tap on a row (not its link) opens or closes it
  nav.addEventListener("click", function (e) {
    if (mode !== "v" || e.target.closest("a, button, .tl-peek")) return;
    var li = e.target.closest(".tl-list > li");
    var it = li ? byLi.get(li) : null;
    if (!it) return;
    if (li.classList.contains("is-open")) closeRow(it); else show(it, { user: true, open: true, say: true });
  });
  peek.querySelector(".tl-prev").addEventListener("click", function () {
    if (active && active.idx > 0) show(items[active.idx - 1], { user: true, say: true });
  });
  peek.querySelector(".tl-next").addEventListener("click", function () {
    if (active && active.idx < items.length - 1) show(items[active.idx + 1], { user: true, say: true });
  });

  /* ---- the photos load once the map is near, not with the page ---- */
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    items.forEach(function (it) { if (it.img) { var i = new Image(); i.decoding = "async"; i.src = it.img; } });
  }
  if (window.XP) XP.watch(nav, function (v) { if (v) warm(); }); else warm();

  try { layout(); } finally { nav.classList.add("is-ready"); }
  var t = null;
  function later() { clearTimeout(t); t = setTimeout(layout, 80); }
  if ("ResizeObserver" in window) new ResizeObserver(later).observe(nav);
  window.addEventListener("resize", later, { passive: true });
  // fonts arriving late move the narrow rows; measure again
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (mode === "v") placeV(); else placeH(); });
})();
