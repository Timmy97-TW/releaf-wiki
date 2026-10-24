// The bioreactor record, 8.1 "Materials List & Cost": where the parts money goes (15 Oct 2026).
//
// MEASURED in the kit's sense: the numbers are the team's own component sheet, exactly as the table in 8.1 carries
// them. Nothing is typed in here. As the page loads, this reads that table (every row's name, quantity, cost and
// orange note, and the foot's totals), so the chart can never disagree with it; if the rows ever stop adding up to
// the foot, the console says so. Nothing is computed per unit, because the sheet does not say whether a price is per
// unit or per line (the fineprint under the table). A line without a cost, or a cost that covers fewer units than
// the build has ("sheet cost is for 3" against 4 sensors), shows an orange "not costed" stub, never a zero.
(function () {
  "use strict";
  const card = document.getElementById("xp-bom");
  const sec = card && card.closest("section");
  const table = sec && sec.querySelector("table.bom");
  const list = card && card.querySelector(".xp-bom-list");
  if (!card || !table || !list) return;
  const XP = window.XP;
  const reduced = function () { return !!(XP && XP.reduced); };
  const refBtn = card.querySelector("#xp-bom-ref");
  const read = card.querySelector(".xp-bom-read");
  // 17 Oct 2026, pass 3: the chart lives in a <dialog> (#bom-pop) that a button beside the table opens
  const pop = card.closest("dialog");

  /* ---------------------------------------------------------------- read the table */
  function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
  function num(s) { const t = (s || "").replace(/[^0-9.]/g, ""); return t ? parseFloat(t) : null; }
  function own(td) {                                   // the cell's own words, without its note and orange chip
    let t = "";
    td.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.textContent; });
    return clean(t);
  }
  // 17 Oct 2026: the materials list is in US dollars, to the cent
  function plain(v) { return (Math.round(v * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function money(v) { return "US$" + plain(v); }

  const lines = [];
  Array.prototype.forEach.call(table.tBodies, function (tb) {
    const ref = tb.classList.contains("bom-ref");
    Array.prototype.forEach.call(tb.rows, function (tr) {
      if (tr.cells.length < 3) return;
      const first = tr.cells[0];
      const note = first.querySelector(".ref-note"), todo = first.querySelector(".todo");
      const qtyText = clean(tr.cells[1].textContent);
      const line = {
        tr: tr, ref: ref,
        name: own(first) || clean(first.textContent),
        note: note ? clean(note.textContent).replace(/^\(|\)$/g, "") : "",
        todo: todo ? clean(todo.textContent) : "",
        qty: qtyText, cost: num(tr.cells[tr.cells.length - 1].textContent)
      };
      // A cost that the row's own orange chip says is incomplete ("sheet cost is for 3", qty 4): a stub for the rest.
      line.partial = line.cost != null && /cost/i.test(line.todo);
      if (line.partial) {
        const m = line.todo.match(/for\s+(\d+)/i), q = parseInt(qtyText, 10);
        line.stub = m && q > +m[1] ? "+" + (q - +m[1]) + " not costed" : "+ not costed";
      }
      lines.push(line);
    });
  });
  if (!lines.length) return;

  let partsTotal = null, sheetTotal = null;
  if (table.tFoot) Array.prototype.forEach.call(table.tFoot.rows, function (tr) {
    const v = num(tr.cells[tr.cells.length - 1].textContent);
    if (tr.classList.contains("bom-sheet")) sheetTotal = v;
    else if (partsTotal == null) partsTotal = v;
  });
  const sum = function (ref) {
    return lines.reduce(function (a, l) { return a + (l.ref === ref && l.cost != null ? l.cost : 0); }, 0);
  };
  const sumBuild = sum(false), sumRef = sum(true);
  if (partsTotal == null) partsTotal = sumBuild;
  if (sheetTotal == null) sheetTotal = sumBuild + sumRef;
  if (Math.abs(partsTotal - sumBuild) > 0.5 || Math.abs(sheetTotal - sumBuild - sumRef) > 0.5) {
    console.warn("xp-bom: the 8.1 rows add up to " + sumBuild + " (" + (sumBuild + sumRef) + " with the reference), " +
      "but the table's foot says " + partsTotal + " (" + sheetTotal + "). The chart shows shares of the foot's totals.");
  }
  const buildLines = lines.filter(function (l) { return !l.ref; });
  const costedCount = buildLines.filter(function (l) { return l.cost != null; }).length;

  /* ---------------------------------------------------------------- build the bars */
  // largest first; lines without a cost last, in the table's order; the reference on top when it is shown
  const order = lines.slice().sort(function (a, b) {
    if (a.ref !== b.ref) return a.ref ? -1 : 1;
    if ((a.cost == null) !== (b.cost == null)) return a.cost == null ? 1 : -1;
    return (b.cost || 0) - (a.cost || 0);
  });
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  order.forEach(function (l, i) {
    const li = el("li");
    const b = el("button", "xp-bom-row" + (l.ref ? " is-ref" : "") + (l.cost == null ? " is-missing" : ""));
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    // the row's own note rides under the name where the chart needs it: the reference, and the lines whose cost
    // the sheet lacks ("Filter" alone would not say which filters); every other note is in the readout
    const name = el("span", "xp-bom-name", l.name);
    if (l.note && (l.ref || l.todo)) name.appendChild(el("span", "xp-bom-tag", l.note));
    const line = el("span", "xp-bom-line");
    if (l.cost != null) {
      l.bar = el("span", "xp-bom-bar");
      l.bar.style.setProperty("--i", String(i));
      line.appendChild(l.bar);
      line.appendChild(el("span", "xp-bom-val", plain(l.cost)));
      l.shareEl = el("span", "xp-bom-share");
      line.appendChild(l.shareEl);
      if (l.partial) line.appendChild(el("span", "xp-bom-stub", l.stub));
    } else {
      line.appendChild(el("span", "xp-bom-stub", "not costed"));
    }
    b.appendChild(name); b.appendChild(line); li.appendChild(b); list.appendChild(li);
    l.li = li; l.btn = b;
    if (l.ref) li.hidden = true;
  });

  /* ---------------------------------------------------------------- state */
  let withRef = false, grown = false, selected = null, hot = null;
  const fine = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  function denom(l) { return withRef || (l && l.ref) ? sheetTotal : partsTotal; }
  function pct(l) { return (l.cost / denom(l) * 100).toFixed(1) + "%"; }
  function scale() {
    const shown = lines.filter(function (l) { return (withRef || !l.ref) && l.cost != null; });
    const max = Math.max.apply(null, shown.map(function (l) { return l.cost; }));
    lines.forEach(function (l) {
      if (!l.bar) return;
      l.bar.style.setProperty("--w", grown ? String(l.cost / max) : "0");
      l.shareEl.textContent = pct(l);
      l.btn.setAttribute("aria-label", label(l));
    });
  }
  function totalWords(l) {
    return withRef || (l && l.ref) ? "the " + money(sheetTotal) + " sheet total" : "the " + money(partsTotal) + " parts total";
  }
  function label(l) {
    const tail = pop ? "." : ". Show its row in the table.";
    if (l.cost == null) {
      return l.name + (l.note ? " (" + l.note + ")" : "") + ": not costed" + (l.todo ? ", " + l.todo : "") +
        ". Quantity " + l.qty + tail;
    }
    return l.name + (l.note ? " (" + l.note + ")" : "") + ": " + money(l.cost) + ", " + pct(l) + " of " + totalWords(l) +
      (l.partial ? "; " + l.todo : "") + ". Quantity " + l.qty + tail;
  }

  /* ---------------------------------------------------------------- the readout */
  function say(parts) {
    if (!read) return;
    const box = el("span");
    parts.forEach(function (p) {
      if (typeof p === "string") box.appendChild(document.createTextNode(p));
      else box.appendChild(el(p.miss ? "span" : "b", p.miss ? "miss" : "", p.t));
    });
    read.textContent = "";
    read.appendChild(box);
  }
  function sayLine(l) {
    const nm = l.name + (l.note && !l.ref ? " (" + l.note + ")" : "");
    if (l.cost == null) {
      say([{ t: nm }, ": ", { miss: true, t: "not costed" }, l.todo ? " (" + l.todo + ")" : "", ". Quantity " + l.qty + "."]);
    } else if (l.ref) {
      say([{ t: nm }, ": " + money(l.cost) + ", ", { t: pct(l) }, " of " + totalWords(l) +
        ". The reference instrument the photometer is checked against, not a part of the build."]);
    } else {
      say([{ t: nm }, ": " + money(l.cost) + ", ", { t: pct(l) }, " of " + totalWords(l) + ". Quantity " + l.qty +
        (l.partial ? "; " : "."), l.partial ? { miss: true, t: l.todo + "." } : ""]);
    }
  }
  function sayDefault() {
    if (withRef) {
      say(["Sheet total ", { t: money(sheetTotal) }, ": the parts' " + money(partsTotal) + " and the reference spectrophotometer's " +
        money(sumRef) + ", which is not part of the build."]);
    } else {
      say(["Parts total ", { t: money(partsTotal) }, ", from the " + costedCount + " of " + buildLines.length +
        " lines that carry a cost. ", { miss: true, t: "Dashed" }, ": what is not costed yet."]);
    }
  }
  function refresh() {
    const l = hot || selected;
    if (l) sayLine(l); else sayDefault();
  }

  function visible() { return order.filter(function (l) { return !l.li.hidden; }); }
  function rove(cur) { lines.forEach(function (l) { l.btn.tabIndex = l === cur ? 0 : -1; }); }

  /* ---------------------------------------------------------------- the table row a bar points at */
  function inView(e) {
    const r = e.getBoundingClientRect(), vh = window.innerHeight || document.documentElement.clientHeight;
    const top = 70;                                        // under the site menu
    return r.top >= top && r.bottom <= vh - 8;
  }
  function select(l) {
    selected = selected === l ? null : l;
    lines.forEach(function (o) {
      o.btn.setAttribute("aria-pressed", o === selected ? "true" : "false");
      o.tr.classList.toggle("xp-bom-hl", o === selected);
    });
    // With a mouse the table is a short reach, so the row is brought into view. On a phone the table is a long way
    // down and a tap is also how the share is read, so the page stays put; the row is lit for when the reader gets there.
    // In the dialog the page behind it never moves.
    if (selected && fine && !pop && selected.tr.offsetParent && !inView(selected.tr)) {
      selected.tr.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    }
    refresh();
  }
  lines.forEach(function (l) {
    l.btn.addEventListener("click", function () { rove(l); select(l); });
    l.btn.addEventListener("mouseenter", function () { hot = l; refresh(); });
    l.btn.addEventListener("mouseleave", function () { if (hot === l) { hot = null; refresh(); } });
    l.btn.addEventListener("focus", function () { hot = l; refresh(); });
    l.btn.addEventListener("blur", function () { if (hot === l) { hot = null; refresh(); } });
    l.btn.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && selected) { select(selected); return; }
      // one tab stop for the whole chart; the arrows walk the bars
      const vis = visible(), k = vis.indexOf(l);
      let to = -1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") to = Math.min(vis.length - 1, k + 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") to = Math.max(0, k - 1);
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = vis.length - 1;
      if (to < 0) return;
      e.preventDefault();
      rove(vis[to]); vis[to].btn.focus();
    });
    // and the other way: a row of the table lights its bar
    l.tr.addEventListener("mouseenter", function () {
      if (l.ref && !withRef) return;
      l.btn.classList.add("is-hot"); l.tr.classList.add("xp-bom-hot");
    });
    l.tr.addEventListener("mouseleave", function () { l.btn.classList.remove("is-hot"); l.tr.classList.remove("xp-bom-hot"); });
  });

  if (refBtn) refBtn.addEventListener("click", function () {
    withRef = !withRef;
    refBtn.setAttribute("aria-pressed", withRef ? "true" : "false");
    lines.forEach(function (l) {
      if (!l.ref) return;
      l.li.hidden = !withRef;
      l.li.classList.toggle("xp-bom-in", withRef && !reduced());
      if (!withRef && selected === l) select(l);
    });
    if (!visible().some(function (l) { return l.btn.tabIndex === 0; })) rove(visible()[0]);
    scale();
    refresh();
  });

  /* ---------------------------------------------------------------- grow in once seen */
  function grow() { if (grown) return; grown = true; scale(); }
  rove(visible()[0]);
  scale();
  sayDefault();
  if (reduced() || !("IntersectionObserver" in window)) grow();
  else {
    const io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); requestAnimationFrame(grow); } });
    }, { threshold: 0.3 });
    io.observe(list);
  }

  /* ---------------------------------------------------------------- the dialog (17 Oct 2026, pass 3) */
  // A button beside the table opens the chart; Esc (the dialog's own cancel), the close button or a click on the
  // backdrop closes it, and focus goes back to the button. The page behind does not scroll while it is open, as with
  // the photo lightbox (static/hardware/js/figures.js). The button joins the table's tool row (the filter, ../js/polish.js) when
  // there is one. A selection is let go on close, so no table row stays lit for a chart that is not showing.
  const opener = document.getElementById("bom-pop-open");
  if (!pop || !opener) return;
  const tools = sec.querySelector(".bom-tools");
  if (tools) tools.appendChild(opener);
  function shut() {
    if (!pop.open) return;
    if (typeof pop.close === "function") pop.close();
    else { pop.removeAttribute("open"); pop.dispatchEvent(new Event("close")); }
  }
  opener.addEventListener("click", function () {
    if (pop.open) return;
    if (typeof pop.showModal === "function") pop.showModal(); else pop.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    opener.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () { requestAnimationFrame(grow); });
  });
  pop.addEventListener("close", function () {
    document.body.style.overflow = "";
    opener.setAttribute("aria-expanded", "false");
    if (selected) select(selected);
    hot = null; refresh();
    if (document.activeElement === document.body || pop.contains(document.activeElement)) opener.focus();
  });
  pop.addEventListener("click", function (e) {
    if (e.target === pop || (e.target.closest && e.target.closest("[data-bom-close]"))) shut();
  });
  if (typeof pop.showModal !== "function") {               // no native dialog: Esc by hand
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") shut(); });
  }
  opener.setAttribute("aria-expanded", "false");
})();
