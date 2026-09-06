/* =============================================================================
   ReLeaf: Software — the operator interface, sheet behaviour
   -----------------------------------------------------------------------------
   Everything here is additive. With JavaScript off the page is still a complete
   document: the models, the missing measurements and the build steps are
   <details> that open on click, the stack is a static drawing with its whole
   written register underneath it, the connectivity ledger shows both of its
   columns at once with both verdicts, and every heading, figure and reference is
   where it was. A judge on a locked-down machine still has to be able to read the
   argument, and on this page the argument is the thing being judged.

   Ten jobs:
     1. the stack: light what a layer carries, or what a channel touches
     2. the ledger: one switch, five tests, and the claim rewriting itself
     3. the registers: filter chips, open-everything, and deep links that open
        the row they point at
     4. the sheet-edge index, which follows the scroll
     5. the scroll gauge down the right edge
     6. figures open full-window
     7. [n] in the prose becomes a link to reference n, and back again
     8. a paragraph mark on every heading you can link to
     9. the 434-hour growth run, drawn from the run's own binned numbers
    10. reveal the controls that only make sense with scripts running
   ========================================================================== */
(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function prefersMotion() {
    return !window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---- 1. the stack ------------------------------------------------------ */

  /* Sheet 03 is a drawing of five layers and thirteen roads across them, and the
     thing a reader wants from it is never the whole drawing at once. It is one
     road: what is that number, and whose hands has it been through.

     So the plate answers per object. Pointing at one lights it and everything it
     connects to and dims the rest; choosing one keeps that lit and opens its
     written entry in the panel. Both states come from one lookup: data-lit on a
     channel names the layers it touches, and the reverse of that same list is
     what a layer carries. Nothing about the routes is written twice, and the
     panel prose is not written in here at all — it is the definition list already
     in the HTML, which is what a reader with scripts off gets.

     The chips are a shortcut to a provenance class, which is the one selection
     that cannot be made by eye, because the four in-line roads and the three soft
     ones are not adjacent on the drawing.                                      */

  function stack() {
    var fig = $(".stack");
    if (!fig) return;
    var svg    = $(".stack__svg", fig);
    var panel  = $(".stack__panel");
    var hint   = $(".stack__hint");
    var scroll = $(".stack__scroll", fig);
    var layers = $$(".stk-node", fig);
    var chans  = $$(".stk-ch", fig);
    var items  = $$(".stack__item");
    var chips  = $$(".stack__ctl .chip");
    if (!svg || !panel || !layers.length) return;

    var nodes = layers.concat(chans);
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });

    function lit(n) {
      var v = (n.getAttribute("data-lit") || "").trim();
      return v ? v.split(/\s+/) : [];
    }

    /* What a layer carries is just the reverse of what every channel names. */
    var carries = {};
    chans.forEach(function (c) {
      lit(c).forEach(function (t) { (carries[t] = carries[t] || []).push(c.id); });
    });

    function related(n) {
      var set = {};
      set[n.id] = true;
      lit(n).forEach(function (t) { set[t] = true; });
      (carries[n.id] || []).forEach(function (t) { set[t] = true; });
      return set;
    }

    function name(id) {
      var n = byId[id];
      return n ? (n.getAttribute("data-name") || "") : "";
    }

    function paint(set) {
      svg.classList.toggle("is-active", !!set);
      nodes.forEach(function (n) { n.classList.toggle("is-lit", !!set && !!set[n.id]); });
    }

    /* The route lines are read off the drawing, so the words and the picture
       cannot drift apart. */
    var routeEl = document.createElement("p");
    routeEl.className = "stack__route";
    routeEl.hidden = true;
    panel.appendChild(routeEl);

    function route(n) {
      var html = "";
      if (n) {
        var through = lit(n).map(name).filter(Boolean);
        var held    = (carries[n.id] || []).map(name).filter(Boolean);
        if (through.length) html += "<span><b>Passes through</b><i>" + esc(through.join(", ")) + "</i></span>";
        if (held.length)    html += "<span><b>Carries</b><i>" + esc(held.join(", ")) + "</i></span>";
      }
      routeEl.innerHTML = html;
      routeEl.hidden = !html;
    }

    function show(n) {
      var want = n ? n.getAttribute("aria-describedby") : null;
      items.forEach(function (it) { it.hidden = it.id !== want; });
      if (hint) hint.hidden = !!n;
      route(n);
    }

    var chosen = null, hover = null;

    function restore() {
      var n = hover || chosen;
      paint(n ? related(n) : null);
      show(n);
    }

    function choose(n) {
      chosen = n || null;
      nodes.forEach(function (x) { x.setAttribute("aria-pressed", String(x === chosen)); });
      chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      restore();
    }

    /* At 375px the plate is wider than its frame, so a chip press that lands on
       something off to the right has to bring it with it. */
    function centre(n) {
      if (!scroll || scroll.scrollWidth <= scroll.clientWidth + 1) return;
      var a = n.getBoundingClientRect(), b = scroll.getBoundingClientRect();
      var dx = (a.left + a.width / 2) - (b.left + b.width / 2);
      if (Math.abs(dx) < 8) return;
      if (scroll.scrollTo) {
        scroll.scrollTo({ left: scroll.scrollLeft + dx, behavior: prefersMotion() ? "smooth" : "auto" });
      } else { scroll.scrollLeft += dx; }
    }

    /* A pointer moving over the plate rewrites the panel with nothing else to
       announce it, so the panel is a live region for exactly as long as the
       pointer is on the plate. Keyboard use switches it off: focus and a press
       announce themselves through the node's own name and aria-pressed, and a
       second announcement of the same text on top of that is noise. */
    function live(on) {
      if (on && panel.getAttribute("aria-live") !== "polite") panel.setAttribute("aria-live", "polite");
      if (!on && panel.hasAttribute("aria-live")) panel.removeAttribute("aria-live");
    }

    function nodeFrom(el) {
      if (!el || !el.closest) return null;
      return el.closest(".stk-node, .stk-ch");
    }

    svg.addEventListener("pointerover", function (e) {
      live(true);
      var n = nodeFrom(e.target);
      if (!n || n === hover) return;
      hover = n; restore();
    });
    svg.addEventListener("pointerout", function (e) {
      var n = nodeFrom(e.target);
      if (!n || n !== hover) return;
      if (nodeFrom(e.relatedTarget) === n) return;
      hover = null; restore();
    });
    svg.addEventListener("pointerleave", function () { live(false); hover = null; restore(); });
    svg.addEventListener("focusin", function (e) {
      var n = nodeFrom(e.target);
      if (!n) return;
      hover = n; restore();
    });
    svg.addEventListener("focusout", function (e) {
      if (nodeFrom(e.target) !== hover) return;
      hover = null; restore();
    });

    nodes.forEach(function (n) {
      n.addEventListener("click", function () { choose(chosen === n ? null : n); });
      n.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        e.preventDefault();
        choose(chosen === n ? null : n);
      });
    });

    /* ---- the provenance chips ------------------------------------------- */
    /* A chip lights a whole class at once, which is not a single choice, so it
       paints directly rather than going through choose(). */

    var chipOn = null;
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var cls = c.getAttribute("data-class");
        if (chipOn === cls) { chipOn = null; choose(null); return; }
        chipOn = cls;
        chosen = null; hover = null;
        nodes.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        chips.forEach(function (x) { x.setAttribute("aria-pressed", String(x === c)); });
        var set = {};
        var first = null;
        chans.forEach(function (ch) {
          if (ch.getAttribute("data-class") !== cls) return;
          set[ch.id] = true;
          if (!first) first = ch;
          lit(ch).forEach(function (t) { set[t] = true; });
        });
        paint(set);
        show(null);
        if (first) centre(first);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Tab") live(false);
      if (e.key !== "Escape") return;
      if (!fig.contains(document.activeElement) && !chosen && !chipOn) return;
      chipOn = null;
      choose(null);
    });

    show(null);
  }

  /* ---- 2. the ledger ----------------------------------------------------- */

  /* The whole definition of a digital twin turns on whether the flow runs both
     ways automatically. Writing that in a paragraph asks a reader to hold two
     states in their head. Flipping it in front of them does not.

     So the switch is the argument, and what it cannot change is the point: T1
     and T2 pass either way, and T5 fails either way, because no cable validates
     a model. With scripts off both columns and both verdicts are on the page,
     each labelled, and the section still reads.                               */

  function ledger() {
    var host = $("#ledger");
    if (!host) return;
    var sw    = $("#ledger-switch", host);
    var state = $("#ledger-state", host);
    var cells = $$(".test__v", host);
    var verds = $$(".verdict", host);
    if (!sw) return;

    host.classList.add("is-live");

    function paint(on) {
      var col = on ? "in" : "out";
      cells.forEach(function (c) { c.classList.toggle("is-on", c.getAttribute("data-col") === col); });
      verds.forEach(function (v) { v.hidden = v.getAttribute("data-col") !== col; });
      sw.setAttribute("aria-pressed", String(on));
      if (state) {
        state.textContent = on
          ? "Board connected. T3 and T4 pass, and the two that matter have not moved: T1 and T2 passed anyway, and T5 fails, because no cable validates a model."
          : "Cable out. Throw the switch to see which tests the cable changes, and which two it cannot.";
      }
    }

    sw.addEventListener("click", function () {
      paint(sw.getAttribute("aria-pressed") !== "true");
    });

    paint(false);
  }

  /* ---- 3. the registers -------------------------------------------------- */

  /* Three runs of <details> on this page carry a long record: eleven models,
     eighteen missing measurements, nine build steps. They all fold the same way,
     and they are all deep-linkable, because a page that says "see E17" has to
     land on E17 open.                                                          */

  function registers() {
    /* open everything, per register */
    $$("[data-openall]").forEach(function (btn) {
      var host = document.getElementById(btn.getAttribute("data-openall"));
      if (!host) return;
      var rows = $$(".row", host);
      var label = btn.textContent;
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-pressed") === "true";
        rows.forEach(function (r) { if (!r.hidden) r.open = !open; });
        btn.setAttribute("aria-pressed", String(!open));
        btn.textContent = open ? label : label.replace(/^Open/, "Close");
      });
    });

    /* filter chips: one selection at a time, across both chip rows */
    var chips = $$(".chip[data-filter]");
    if (chips.length) {
      var host = $("#model-rows");
      var rows = host ? $$(".row", host) : [];
      var count = $("[data-count]");
      var on = null;

      var apply = function () {
        var shown = 0;
        rows.forEach(function (r) {
          var keep = !on || r.getAttribute("data-" + on.f) === on.v;
          r.hidden = !keep;
          if (keep) shown += 1; else r.open = false;
        });
        if (count) count.textContent = shown + " of " + rows.length + " shown";
      };

      chips.forEach(function (c) {
        c.addEventListener("click", function () {
          var f = c.getAttribute("data-filter"), v = c.getAttribute("data-value");
          var same = on && on.f === f && on.v === v;
          on = same ? null : { f: f, v: v };
          chips.forEach(function (x) { x.setAttribute("aria-pressed", String(!same && x === c)); });
          apply();
        });
      });
      apply();
    }

    /* a link to #e17 should show E17, not a shut box with E17 somewhere inside */
    function openFromHash() {
      var id = location.hash.replace("#", "");
      if (!id) return;
      var el;
      try { el = document.getElementById(decodeURIComponent(id)); } catch (e) { return; }
      if (!el) return;
      var owner = el.classList.contains("row") ? el : (el.closest ? el.closest(".row") : null);
      if (!owner) return;
      owner.hidden = false;
      owner.open = true;
      var land = function () { el.scrollIntoView({ block: "start" }); };
      requestAnimationFrame(land);
      setTimeout(land, 300);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href").slice(1);
      if (!id) return;
      var el = document.getElementById(id);
      if (!el) return;
      var owner = el.classList.contains("row") ? el : (el.closest ? el.closest(".row") : null);
      if (!owner) return;
      owner.hidden = false;
      owner.open = true;
    });
  }

  /* ---- 4. the sheet-edge index ------------------------------------------- */

  function edge() {
    var host = $("#edge-index");
    if (!host) return;
    /* Only a sheet that names itself gets a rail entry, which is how the cover
       stays out of the list. */
    var sheets = $$("main .sheet[id][data-rail]");
    var all    = $$("main .sheet[id]");
    if (!sheets.length) { host.parentNode.remove(); return; }

    sheets.forEach(function (s) {
      var label = s.getAttribute("data-rail");
      if (label.length > 22) label = label.slice(0, 20).trim() + "…";
      var ico = s.getAttribute("data-ico");
      var mark = '<span class="mark"><span class="tick"></span>' +
                 (ico ? '<svg class="edge__ico" aria-hidden="true" width="0" height="0"><use href="#ico-' +
                        esc(ico) + '"/></svg>' : "") + "</span>";
      var li = document.createElement("li");
      li.innerHTML = '<a href="#' + s.id + '">' + mark + '<span class="lbl">' + esc(label) + "</span></a>";
      host.appendChild(li);
    });

    var links = $$("a", host);
    var rail  = host.parentNode;

    /* Which sheet is being read is answered on scroll rather than by an
       IntersectionObserver. The observer is the tidier instrument and it is what
       the Engineering sheet uses, but it only reports when the browser gets
       round to a rendering update, and this page is four times taller than that
       one: on a long jump — a contents link, a deep link into the eighteen
       measurements — the rail can be left pointing at whatever sheet was on
       screen before the jump. A rail that stops following the scroll is worse
       than no rail, so this one reads the geometry itself, throttled to one
       frame, which is the same shape as the gauge below it.

       The trigger line sits a third of the way down the window, so a sheet
       becomes current once it has settled rather than the instant it clips the
       top edge. */
    var QUIET = { cover: 1, stack: 1 };   /* sheets the rail keeps off */
    var pending = false;

    function paint() {
      pending = false;
      var line = window.innerHeight * 0.3;
      var current = null, node = null;
      for (var i = 0; i < all.length; i++) {
        var r = all[i].getBoundingClientRect();
        if (r.top <= line && r.bottom > line) { current = all[i].id; node = all[i]; break; }
      }
      /* Above the first sheet or past the last one, hold the nearer end rather
         than blanking the rail. */
      if (!current && all.length) {
        node = all[0].getBoundingClientRect().top > line ? all[0] : all[all.length - 1];
        current = node.id;
      }
      links.forEach(function (a) {
        a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + current));
      });
      rail.classList.toggle("on-plate", !!node && node.classList.contains("sheet--plate"));
      rail.classList.toggle("is-hidden", !current || QUIET[current] === 1);
    }

    window.addEventListener("scroll", function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }

  /* ---- 5. the scroll gauge ----------------------------------------------- */

  function gauge() {
    var bar = $(".gauge i");
    if (!bar) return;
    var pending = false;
    function paint() {
      pending = false;
      var d = document.documentElement;
      var span = d.scrollHeight - d.clientHeight;
      bar.style.height = (span > 0 ? Math.min(1, d.scrollTop / span) * 100 : 0) + "%";
    }
    window.addEventListener("scroll", function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }

  /* ---- 6. figures open full-window ---------------------------------------- */

  function lightbox() {
    var imgs = $$(".fig img, .band img");
    if (!imgs.length) return;
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button class="lightbox__close" aria-label="Close">&times;</button>' +
      '<figure style="margin:0;text-align:center"><figcaption></figcaption></figure>';
    var big = document.createElement("img");
    big.alt = "";
    $("figure", box).insertBefore(big, $("figcaption", box));
    document.body.appendChild(box);
    var cap = $("figcaption", box), opener = null;

    function close() {
      box.classList.remove("is-open");
      document.body.style.overflow = "";
      if (opener) opener.focus();
    }
    imgs.forEach(function (img) {
      img.addEventListener("click", function () {
        opener = img;
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        var c = img.closest("figure") && img.closest("figure").querySelector("figcaption");
        cap.textContent = c ? c.textContent.trim() : "";
        box.classList.add("is-open");
        document.body.style.overflow = "hidden";
        $(".lightbox__close", box).focus();
      });
    });
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".lightbox__close")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("is-open")) close();
    });
  }

  /* ---- 7. citations ------------------------------------------------------ */
  /* Write [3] in the prose. This finds it, links it to the third item in the
     references list, and gives that item a link back to the first mention.     */

  function citations() {
    var list = $("ol.refs");
    var main = $("#main");
    if (!list || !main) return;
    var items = $$("li", list);
    items.forEach(function (li, i) { if (!li.id) li.id = "ref-" + (i + 1); });

    var first = {};
    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return n.parentElement.closest(".refs, a, code, pre")
          ? NodeFilter.FILTER_REJECT
          : /\[\d+(\s*,\s*\d+)*\]/.test(n.nodeValue)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
      }
    });

    var texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);

    texts.forEach(function (node) {
      var frag = document.createDocumentFragment();
      var last = 0;
      node.nodeValue.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, function (match, nums, at) {
        frag.appendChild(document.createTextNode(node.nodeValue.slice(last, at)));
        frag.appendChild(document.createTextNode("["));
        nums.split(",").map(function (n) { return n.trim(); }).forEach(function (n, i, arr) {
          var idx = parseInt(n, 10);
          if (items[idx - 1]) {
            var a = document.createElement("a");
            a.className = "cite";
            a.href = "#ref-" + idx;
            /* only the first mention gets an id; the reference links back to it,
               and a second [1] must not steal the anchor */
            if (!first[idx]) { first[idx] = "cite-" + idx; a.id = first[idx]; }
            a.textContent = n;
            frag.appendChild(a);
          } else {
            frag.appendChild(document.createTextNode(n));
          }
          if (i < arr.length - 1) frag.appendChild(document.createTextNode(", "));
        });
        frag.appendChild(document.createTextNode("]"));
        last = at + match.length;
        return match;
      });
      frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });

    items.forEach(function (li, i) {
      var back = first[i + 1];
      if (!back) return;
      var a = document.createElement("a");
      a.className = "back";
      a.href = "#" + back;
      a.textContent = " ↩";
      a.setAttribute("aria-label", "Back to where this was cited");
      li.appendChild(a);
    });
  }

  /* ---- 8. a paragraph mark on every linkable heading ---------------------- */

  function anchors() {
    $$("main .sheethead h2, main .sheet__inner > h3").forEach(function (h) {
      var sec = h.closest("section.sheet");
      var id = h.id || (h.tagName === "H2" && sec ? sec.id : "");
      if (!id) {
        id = h.textContent.toLowerCase().trim()
              .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
        h.id = id;
      }
      if (!id) return;
      var a = document.createElement("a");
      a.className = "anchor";
      a.href = "#" + id;
      a.textContent = "¶";
      a.setAttribute("aria-label", "Link to this section");
      h.appendChild(a);
    });
  }

  /* ---- 9. the 434-hour run ------------------------------------------------ */

  /* Drawn here rather than shipped as an image, from the binned file itself, so
     the figure and the data cannot drift apart. 221 points, elapsed hours then
     OD600, flat pairs, out of
     Bioreactor_UI/data/od600_growth_run_20260721.csv. Nothing is smoothed,
     resampled or invented, and the two marked windows are the two features the
     software argument rests on.                                               */

  var OD = [
  1,0.0875,3,0.0974,4.9,0.1151,6.9,0.1189,8.9,0.2026,10.9,0.2597,12.8,0.2573,14.8,0.2891,
  16.8,0.3243,18.8,0.3515,20.7,0.3726,22.7,0.3938,24.7,0.424,26.6,0.4411,28.6,0.4657,
  30.6,0.4824,32.6,0.5011,34.5,0.517,36.5,0.5384,38.5,0.5456,40.5,0.559,42.4,0.5746,44.4,0.5822,
  46.4,0.6014,48.4,0.6179,50.3,0.6251,52.3,0.6318,54.3,0.6377,56.2,0.6518,58.2,0.6658,
  60.2,0.676,62.2,0.6869,64.1,0.7139,66.1,0.7233,68.1,0.7151,70.1,0.7174,72,0.73,74,0.7511,
  76,0.7638,78,0.7755,79.9,0.7726,81.9,0.791,83.9,0.8087,85.9,0.8345,87.8,0.839,89.8,0.8508,
  91.8,0.8716,93.8,0.8571,95.7,0.8828,97.7,0.8946,99.7,0.9083,101.6,0.9097,103.6,0.9078,
  105.6,0.8939,107.6,0.93,109.5,0.9303,111.5,0.9366,113.5,0.9375,115.5,0.9319,117.4,0.9335,
  119.4,0.9469,121.4,0.9429,123.3,0.9276,125.3,0.9253,127.3,0.915,129.3,0.8979,131.2,0.8822,
  133.2,0.8804,135.2,0.8568,137.2,0.8493,139.1,0.8279,141.1,0.7806,143.1,0.7647,145.1,0.7342,
  147,0.7217,149,0.7055,151,0.6851,153,0.6737,154.9,0.6872,156.9,0.7049,158.9,0.714,
  160.8,0.7379,162.8,0.7541,164.8,0.7653,166.8,0.794,168.8,0.8014,170.7,0.8341,172.7,0.849,
  174.7,0.8683,176.6,0.8974,178.6,0.9387,180.6,1.0023,182.6,1.0494,184.5,1.0819,186.5,1.1183,
  188.5,1.151,190.5,1.1996,192.4,1.2442,194.4,1.2793,196.4,1.3087,198.3,1.3358,200.3,1.3618,
  202.3,1.3822,204.3,1.4045,206.2,1.4238,208.2,1.4356,210.2,1.4498,212.2,1.458,214.1,1.4743,
  216.1,1.4653,218.1,1.4449,220.1,1.467,222,1.4726,224,1.4739,226,1.4723,228,1.48,229.9,1.4729,
  231.9,1.4682,233.9,1.4775,235.8,1.4796,237.8,1.4676,239.8,1.4656,241.8,1.4643,243.8,1.4913,
  245.7,1.1772,247.7,1.4502,249.7,1.4681,251.6,1.457,253.6,1.4885,255.6,1.434,257.6,1.4576,
  259.5,1.4299,261.5,1.4643,263.5,1.4753,265.5,1.4798,267.4,1.4826,269.4,1.4738,271.4,1.4887,
  273.4,1.4868,275.3,1.4684,277.3,1.4676,279.3,1.4622,281.2,1.4327,283.2,1.2976,285.2,1.4583,
  287.2,1.3219,289.1,1.4956,291.1,1.4838,293.1,1.4557,295.1,1.46,297,1.4723,299,1.454,
  301,1.4657,303,1.4624,304.9,1.44,306.9,1.4631,308.9,1.4604,310.9,1.425,312.8,1.4451,
  314.8,1.4286,316.8,1.4358,318.8,1.4122,320.7,1.3845,322.7,1.3964,324.7,1.4128,326.6,1.3931,
  328.6,1.389,330.6,1.3988,332.6,1.3514,334.5,1.3584,336.5,1.3361,338.5,1.3533,340.5,1.3465,
  342.4,1.3194,344.4,1.3143,346.4,1.3036,348.4,1.3225,350.3,1.3024,352.3,1.3201,354.3,1.3004,
  356.2,1.2696,358.2,1.26,360.2,1.2546,362.2,1.2566,364.1,1.2335,366.1,1.2369,368.1,1.2503,
  370.1,1.2247,372,1.23,374,1.2081,376,1.2027,378,1.2025,379.9,1.191,381.9,1.178,383.9,1.1764,
  385.9,1.1586,387.8,1.1557,389.8,1.1253,391.8,1.152,393.8,1.1521,395.7,1.1557,397.7,1.1284,
  399.7,1.1414,401.6,1.1169,403.6,1.1395,405.6,1.1252,407.6,1.1217,409.5,1.1108,411.5,1.0908,
  413.5,1.0829,415.5,1.0839,417.4,1.0949,419.4,1.0922,421.4,1.0801,423.4,1.0847,425.3,1.0554,
  427.3,1.0562,429.3,1.0586,431.2,1.0798,433.2,1.0782,435.2,1.0556
  ];

  function growth() {
    var g = document.getElementById("growth-plot");
    if (!g) return;
    var W = 900, H = 340, L = 58, R = 22, T = 22, B = 44;
    var xw = W - L - R, yh = H - T - B;
    var xmax = 440, ymax = 1.6;
    function X(h) { return L + h / xmax * xw; }
    function Y(v) { return T + yh - v / ymax * yh; }
    var o = [];
    function txt(x, y, s, a) {
      a = a || {};
      return '<text x="' + x + '" y="' + y + '" font-size="' + (a.fs || 11) + '"' +
        ' fill="' + (a.fill || "#57665d") + '" text-anchor="' + (a.anchor || "start") + '"' +
        (a.weight ? ' font-weight="' + a.weight + '"' : "") + ">" + esc(s) + "</text>";
    }
    /* the two marked windows, drawn first so everything else sits on them */
    o.push('<rect x="' + X(120) + '" y="' + T + '" width="' + (X(160) - X(120)) + '" height="' + yh + '" fill="#f3e6d4"/>');
    o.push('<rect x="' + X(240) + '" y="' + T + '" width="' + (X(300) - X(240)) + '" height="' + yh + '" fill="#f6e2de"/>');
    for (var v = 0; v <= 1.6001; v += 0.4) {
      o.push('<line x1="' + L + '" y1="' + Y(v) + '" x2="' + (W - R) + '" y2="' + Y(v) + '" stroke="#dfe7e2" stroke-width="1"/>');
      o.push(txt(L - 9, Y(v) + 4, v.toFixed(1), { anchor: "end" }));
    }
    for (var h = 0; h <= 440; h += 80) {
      o.push('<line x1="' + X(h) + '" y1="' + T + '" x2="' + X(h) + '" y2="' + (T + yh) + '" stroke="#e9efec" stroke-width="1"/>');
      o.push(txt(X(h), T + yh + 18, String(h), { anchor: "middle" }));
    }
    var d = "";
    for (var i = 0; i < OD.length; i += 2) {
      d += (i ? "L" : "M") + X(OD[i]).toFixed(1) + " " + Y(OD[i + 1]).toFixed(1) + " ";
    }
    o.push('<path d="' + d + '" fill="none" stroke="#23684a" stroke-width="1.7" stroke-linejoin="round"/>');
    o.push(txt(L, T - 7, "OD600", { fs: 11, weight: 600, fill: "#14402b" }));
    o.push(txt(W - R, T + yh + 34, "elapsed hours", { anchor: "end", fs: 11 }));
    o.push(txt((X(120) + X(160)) / 2, T + 14, "120–160 h", { anchor: "middle", fs: 10.5, fill: "#8a5f10", weight: 600 }));
    o.push(txt((X(120) + X(160)) / 2, T + 27, "process event", { anchor: "middle", fs: 10, fill: "#8a5f10" }));
    o.push(txt((X(240) + X(300)) / 2, T + 14, "240–300 h", { anchor: "middle", fs: 10.5, fill: "#a33d21", weight: 600 }));
    o.push(txt((X(240) + X(300)) / 2, T + 27, "instrument event", { anchor: "middle", fs: 10, fill: "#a33d21" }));
    o.push('<line x1="' + L + '" y1="' + (T + yh) + '" x2="' + (W - R) + '" y2="' + (T + yh) + '" stroke="#b3bdb6" stroke-width="1"/>');
    o.push('<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (T + yh) + '" stroke="#b3bdb6" stroke-width="1"/>');
    g.innerHTML = o.join("");
    /* the with-scripts-off line inside the same <svg> has done its job */
    var fallback = g.parentNode.querySelector("[data-no-js]");
    if (fallback) fallback.remove();
  }

  /* ---- 10. start ---------------------------------------------------------- */

  function start() {
    document.documentElement.classList.add("js");
    /* controls that only make sense with scripts running */
    $$("[data-needs-js]").forEach(function (el) { el.hidden = false; });
    stack(); ledger(); registers(); edge(); gauge(); lightbox();
    citations(); anchors(); growth();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
