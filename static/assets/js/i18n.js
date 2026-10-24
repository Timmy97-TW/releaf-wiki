/* =============================================================================
   ReLEAF: English / 中文
   -----------------------------------------------------------------------------
   The pages are written in English. A Chinese reading of each one lives beside
   it in static/i18n/<page>.zh.json, and this file swaps one for the other in
   place: no second copy of the page, no reload, no change to the English
   markup beyond the two tags that load this script and its stylesheet.

   HOW AN ENTRY FINDS ITS ELEMENT. Every entry is keyed by a hash of the
   NORMALISED TEXT the element holds, not by an id and not by its markup. The
   walk below is the same walk tools/i18n/extract.py makes over the source, in
   the same order, so the nth element holding a given string here is the nth
   one there. Nothing is written into the pages, a paragraph that moves keeps
   its translation, and an untranslated or changed paragraph simply stays in
   English.

   WHAT IS SWAPPED. The innerHTML of each prose unit (so a translation can
   carry its own <b>, <a> or <sup>), loose text nodes, the alt / title /
   aria-label attributes, <title>, and the meta description. The original
   English is kept in memory, so switching back is exact.

   The reader's choice is remembered in localStorage and applies across pages.
   Everything here is local: one fetch of one JSON file under static/.
   ========================================================================== */

(function () {
  "use strict";

  var STORE = "releaf-lang";
  var LANGS = { en: "English", zh: "中文" };

  /* ---- the shared normalisation (tools/i18n/extract.py: norm) ------------- */
  var SPACE = /[\s     ]+/g;
  function norm(s) { return String(s).replace(SPACE, " ").trim(); }

  /* FNV-1a, 64-bit, hex. The same sixteen characters Python produces. */
  var FNV_PRIME = BigInt("0x100000001b3");
  var FNV_MASK = BigInt("0xffffffffffffffff");
  function hash(s) {
    var h = BigInt("0xcbf29ce484222325");
    var bytes = new TextEncoder().encode(s);
    for (var i = 0; i < bytes.length; i++) {
      h = (h ^ BigInt(bytes[i])) * FNV_PRIME & FNV_MASK;
    }
    return h.toString(16).padStart(16, "0");
  }

  /* ---- the walk (tools/i18n/extract.py: collect) -------------------------- */
  var SKIP = { SCRIPT: 1, STYLE: 1, SVG: 1, NOSCRIPT: 1, TEMPLATE: 1,
               CANVAS: 1, IFRAME: 1, CODE: 1, PRE: 1, MATH: 1, SELECT: 1,
               HEAD: 1, TITLE: 1 };

  var CAND = { P: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
               FIGCAPTION: 1, CAPTION: 1, TH: 1, TD: 1, DT: 1, DD: 1,
               BLOCKQUOTE: 1, SUMMARY: 1, BUTTON: 1, LABEL: 1, LEGEND: 1,
               OPTION: 1, A: 1, SPAN: 1, STRONG: 1, EM: 1, B: 1, I: 1,
               SMALL: 1, ABBR: 1, TIME: 1, CITE: 1, Q: 1, DIV: 1,
               ADDRESS: 1, OUTPUT: 1, MARK: 1 };

  /* Block-level for our purpose: CONTAINER plus every prose candidate that is
     not inline. This is exactly BLOCK_LEVEL in tools/i18n/extract.py, and the
     two must stay in step or a key here will not match a key there. */
  var BLOCKY = { HTML: 1, BODY: 1, HEAD: 1, DIV: 1, SECTION: 1, ARTICLE: 1,
                 MAIN: 1, HEADER: 1, FOOTER: 1, ASIDE: 1, NAV: 1, UL: 1,
                 OL: 1, DL: 1, TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1,
                 TR: 1, FIGURE: 1, DETAILS: 1, FORM: 1, FIELDSET: 1,
                 PICTURE: 1, VIDEO: 1, AUDIO: 1, MAP: 1, COLGROUP: 1,
                 P: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
                 FIGCAPTION: 1, CAPTION: 1, TH: 1, TD: 1, DT: 1, DD: 1,
                 BLOCKQUOTE: 1, SUMMARY: 1, BUTTON: 1, LABEL: 1, LEGEND: 1,
                 OPTION: 1, ADDRESS: 1 };

  var ATTRS = ["alt", "title", "aria-label", "aria-description",
               "placeholder", "aria-roledescription",
               "data-toc", "data-label", "data-cap", "data-name",
               "data-title", "data-role", "data-en"];

  /* Regions JavaScript draws after the page is parsed: the nav card, the skip
     link, the contents rail and the lightbox. None of them exists in the
     source the extractor read, so counting their strings would shift every
     later occurrence index out of step. They are walked separately below and
     matched on the hash alone. */
  var DYN = "#site-nav, .sitenav-skip, .toc__list, .lightbox, section.navmap";

  /* Marks page.js puts INSIDE an element we key on: the section number it
     prepends to a heading, the number in a contents row, and the ↩ it appends
     to a reference. The extractor never saw them, so they are left out of the
     text a key is made from, and carried across untouched when the element is
     rewritten. */
  var ARTIFACT = ".sec__no, .toc__no, a[href^='#cite-']";

  /* assets/js/math.js has already turned every \( … \) and \[ … \] into
     KaTeX markup by the time we look, so the text an element holds is no
     longer the text the extractor read. A .math element is therefore read
     back as the TeX it was built from, and written back as TeX and rendered
     again. The wiki uses no $$ delimiters; display is \[ \], inline \( \). */
  var MATHSEL = ".math";

  function texOf(el) {
    var a = el.querySelector('annotation[encoding="application/x-tex"]');
    var tex = a ? a.textContent : el.textContent;
    return el.classList.contains("math--display")
      ? "\\[" + tex + "\\]"
      : "\\(" + tex + "\\)";
  }

  /* Re-render the formulas in an element we have just rewritten. Same regex
     and the same two element shapes as assets/js/math.js. */
  function renderMath(el) {
    if (!window.katex || !/\$\$|\\\[|\\\(/.test(el.textContent)) return;
    var re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return n.parentElement.closest(".katex, .math, code, pre")
          ? NodeFilter.FILTER_REJECT
          : /\$\$|\\\[|\\\(/.test(n.nodeValue)
            ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue, frag = document.createDocumentFragment();
      var last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var display = m[3] === undefined;
        var tex = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
        var box = document.createElement(display ? "div" : "span");
        box.className = display ? "math math--display" : "math";
        try { window.katex.render(tex, box, { displayMode: display, throwOnError: false }); }
        catch (e) { box.textContent = m[0]; }
        frag.appendChild(box);
        last = re.lastIndex;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* textContent, minus the marks above and minus anything we never read. */
  /* An SVG element reports its tagName in lower case; an HTML one in upper.
     Every lookup below goes through this, or an inline icon is missed and the
     element holding it stops matching its entry. */
  function tagOf(el) { return el.tagName.toUpperCase(); }

  function textOf(el) {
    var out = "";
    var kids = el.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.nodeType === 3) { out += k.nodeValue; continue; }
      if (k.nodeType !== 1) continue;
      if (SKIP[tagOf(k)]) continue;
      if (k.matches && k.matches(ARTIFACT)) continue;
      if (k.matches && k.matches(MATHSEL)) { out += texOf(k); continue; }
      out += textOf(k);
    }
    return out;
  }

  /* innerHTML, minus those marks: what we keep to put the English back. */
  function htmlOf(el) {
    var c = el.cloneNode(true);
    var marks = c.querySelectorAll(ARTIFACT);
    for (var i = 0; i < marks.length; i++) marks[i].remove();
    return c.innerHTML;
  }

  var HAS_LETTER = /[A-Za-z]/;
  var JINJA = /\{[{%]/;
  var URLISH = /^(?:https?:\/\/|\/|\.\/|\.\.\/|[\w./-]+\.(?:html|webp|png|jpe?g|svg|json|csv|css|js|pdf|mp4|glb|woff2?))$/;
  function prose(t) {
    return t.length > 1 && HAS_LETTER.test(t) && !JINJA.test(t) && !URLISH.test(t);
  }

  /* An element is one unit of prose when nothing block-level sits inside it:
     the same test as has_block_kid() on the Python side. */
  function blockInside(el) {
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i], t = tagOf(k);
      /* a rendered formula is inline for our purpose, whatever element
         KaTeX put it in */
      if (k.matches && k.matches(MATHSEL)) continue;
      if (SKIP[t] || BLOCKY[t]) return true;
      if (blockInside(k)) return true;
    }
    return false;
  }

  /* Everything under a prose unit that carries words in an attribute. */
  function attrsWithin(root, out) {
    var kids = root.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (SKIP[tagOf(k)]) continue;
      for (var a = 0; a < ATTRS.length; a++) {
        var name = ATTRS[a];
        if (k.hasAttribute(name)) {
          var v = norm(k.getAttribute(name));
          if (prose(v)) out.push({ kind: "attr", el: k, attr: name, text: v });
        }
      }
      attrsWithin(k, out);
    }
  }

  /* Collect the units in document order. Returns a flat list; `kind` says how
     to put a translation back. */
  /* leafOnly: in a region a script drew, take the innermost element that
     holds text. The nav's entry wraps a title and a caption in one <span>,
     and the wrapper's text is the two run together, which matches nothing. */
  function units(root, honourDyn, dynOut, leafOnly) {
    var out = [];
    (function walk(node) {
      var kids = node.childNodes;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k.nodeType === 3) {                       /* text node */
          var t = norm(k.nodeValue);
          if (prose(t)) out.push({ kind: "text", node: k, text: t });
          continue;
        }
        if (k.nodeType !== 1) continue;               /* comment, etc. */
        var T = tagOf(k);
        /* the attributes first: an <svg> carries aria-label and is skipped
           below, so reading them afterwards would miss every drawing's name */
        for (var a = 0; a < ATTRS.length; a++) {
          var nameA = ATTRS[a];
          if (k.hasAttribute(nameA)) {
            var vA = norm(k.getAttribute(nameA));
            if (prose(vA)) out.push({ kind: "attr", el: k, attr: nameA, text: vA });
          }
        }
        if (k.matches && k.matches(MATHSEL)) continue;
        if (SKIP[T]) {
          /* into a drawing for its labels, but never treat the element that
             holds it as a unit: see the note in tools/i18n/extract.py */
          if (T === "SVG") walk(k);
          continue;
        }
        if (k.matches && k.matches(ARTIFACT)) continue;
        if (honourDyn && k.matches && k.matches(DYN)) {
          if (dynOut) dynOut.push(k);
          continue;
        }
        for (var a = 0; a < ATTRS.length; a++) {
          var name = ATTRS[a];
          if (k.hasAttribute(name)) {
            var v = norm(k.getAttribute(name));
            if (prose(v)) out.push({ kind: "attr", el: k, attr: name, text: v });
          }
        }
        var unit = leafOnly ? k.children.length === 0
                            : (CAND[T] && !blockInside(k));
        if (unit) {
          var bt = norm(textOf(k));
          if (prose(bt)) {
            out.push({ kind: "block", el: k, text: bt });
            /* an element inside the unit can still carry words of its own:
               see the note in tools/i18n/extract.py */
            attrsWithin(k, out);
            continue;
          }
        }
        walk(k);
      }
    })(root);
    return out;
  }

  /* ---- the dictionary ----------------------------------------------------- */
  /* static/i18n/<page>.zh.json is written by tools/i18n/build.py:
     { "v": 1, "b": { "<hash>:<n>": "<zh html>" },
                "a": { "<attr>|<hash>:<n>": "<zh text>" },
                "t": "<zh title>", "d": "<zh meta description>" }        */

  var dict = null;       /* null until the fetch lands */
  var plan = null;       /* the units, with their English kept */
  var dynPlan = [];      /* the same for the JS-drawn regions */
  var subPlan = null;    /* units found inside an element nothing matched */
  var svgPlan = [];      /* the accessible names of the drawings */
  var lang = "en";
  var btn = null;
  var enTitle = document.title;

  function base() {
    /* this script is loaded as "static/assets/js/i18n.js" from the page, at
       whatever depth the page sits: read its own src rather than guessing. */
    var me = document.currentScript;
    if (!me) {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if ((all[i].src || "").indexOf("i18n.js") > -1) { me = all[i]; break; }
      }
    }
    var src = (me && me.getAttribute("src")) || "";
    return { dir: src.replace(/assets\/js\/i18n\.js.*$/, ""),
             page: (me && me.dataset.page) || "home" };
  }

  function dictionary(cb) {
    if (dict) { cb(dict); return; }
    var b = base();
    fetch(b.dir + "i18n/" + b.page + ".zh.json", { cache: "default" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { dict = j || { b: {}, a: {} }; cb(dict); })
      .catch(function () { dict = { b: {}, a: {} }; cb(dict); });
  }

  /* ---- applying ----------------------------------------------------------- */

  function index(list) {
    var seen = {}, aseen = {};
    for (var i = 0; i < list.length; i++) {
      var u = list[i], k = hash(u.text);
      if (u.kind === "attr") {
        var ai = u.attr + "|" + k;
        u.id = ai + ":" + (aseen[ai] = (aseen[ai] === undefined ? 0 : aseen[ai] + 1));
        u.en = u.el.getAttribute(u.attr);
      } else {
        u.id = k + ":" + (seen[k] = (seen[k] === undefined ? 0 : seen[k] + 1));
        u.en = u.kind === "block" ? htmlOf(u.el) : u.node.nodeValue;
      }
      u.key = k;
    }
    return list;
  }

  function build() {
    var dynRoots = [];
    var list = index(units(document.body, true, dynRoots));
    dynPlan = [];
    for (var i = 0; i < dynRoots.length; i++) {
      dynPlan = dynPlan.concat(index(units(dynRoots[i], false, null, true)));
    }
    /* A drawing's <title> and <desc> are what a screen reader reads out, and
       they are the one piece of prose the extractor cannot see: TITLE is in
       its SKIP set, because of the one in the document head. Collect them
       here, in a pass of their own, and match them on the hash alone -- doing
       it in the main walk would count strings the source never offered and
       put every later occurrence index out of step. */
    svgPlan = [];
    var names = document.querySelectorAll("svg title, svg desc");
    for (i = 0; i < names.length; i++) {
      var t = norm(names[i].textContent);
      if (prose(t)) svgPlan.push({ kind: "block", el: names[i], text: t });
    }
    svgPlan = index(svgPlan);
    return list;
  }

  var rewritten = [];

  function put(u, zh) {
    if (u.kind === "text") { u.node.nodeValue = zh; return; }
    if (u.kind === "attr") { u.el.setAttribute(u.attr, zh); return; }
    var el = u.el;
    /* lift page.js's marks out, write the new words, put the marks back where
       they were: a number stays at the head of its heading, a ↩ at the end of
       its reference. */
    var head = [], tail = [], kids = el.children, i;
    for (i = 0; i < kids.length; i++) {
      if (kids[i].matches && kids[i].matches(ARTIFACT)) {
        (i === 0 ? head : tail).push(kids[i]);
      }
    }
    for (i = 0; i < head.length; i++) head[i].remove();
    for (i = 0; i < tail.length; i++) tail[i].remove();
    el.innerHTML = zh;
    for (i = head.length - 1; i >= 0; i--) el.insertBefore(head[i], el.firstChild);
    for (i = 0; i < tail.length; i++) el.appendChild(tail[i]);
    renderMath(el);
    rewritten.push(el);
  }

  /* Rewriting a paragraph turns its [1] back into plain text, so link the
     markers again the way page.js does: only where a reference with that
     number exists, and only taking the cite-N anchor when it is free. */
  function citations(els) {
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.isConnected || el.closest(".refs, .toc")) continue;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          return n.parentElement.closest("a, code, pre")
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
          frag.append(node.nodeValue.slice(last, at));
          frag.append("[");
          nums.split(",").map(function (n) { return n.trim(); }).forEach(function (n, k, arr) {
            var idx = parseInt(n, 10);
            if (document.getElementById("ref-" + idx)) {
              var a = document.createElement("a");
              a.className = "cite";
              a.href = "#ref-" + idx;
              if (!document.getElementById("cite-" + idx)) a.id = "cite-" + idx;
              a.textContent = n;
              frag.append(a);
            } else {
              frag.append(n);
            }
            if (k < arr.length - 1) frag.append(", ");
          });
          frag.append("]");
          last = at + match.length;
          return match;
        });
        frag.append(node.nodeValue.slice(last));
        node.replaceWith(frag);
      });
    }
    els.length = 0;
  }

  function toZh() {
    if (!plan) plan = build();
    var b = dict.b || {}, a = dict.a || {};
    var missed = [];
    for (var i = 0; i < plan.length; i++) {
      var u = plan[i];
      var zh = u.kind === "attr" ? a[u.id] : b[u.id];
      /* a string that moved inside the page still matches on its hash alone */
      if (zh === undefined && u.kind !== "attr") zh = b[u.key + ":0"];
      if (zh === undefined && u.kind === "attr") zh = a[u.attr + "|" + u.key + ":0"];
      if (zh) { put(u, zh); continue; }
      /* Nothing answers to this element's text, and it has elements inside:
         very often a script has glued two strings into one. The hero label
         holds "Next stop" and "Output" in two spans, a caption chip holds a
         number and a role, a judging link holds a page name and a title --
         none of which the extractor ever saw as one string, because none of
         them exists in the source. Go in and match what IS in there. This is
         the same treatment the JS-drawn regions get, and it is safe here
         precisely because the element as a whole matched nothing, so nothing
         inside it has been written to. */
      if (u.kind === "block" && u.el.children.length) missed.push(u.el);
    }
    if (subPlan === null) {
      subPlan = [];
      for (i = 0; i < missed.length; i++) {
        subPlan = subPlan.concat(index(units(missed[i], false, null, true)));
      }
    }
    for (i = 0; i < subPlan.length; i++) {
      var sp = subPlan[i];
      var sz = sp.kind === "attr" ? (a[sp.attr + "|" + sp.key + ":0"] || a[sp.id])
                                  : (b[sp.key + ":0"] || b[sp.id]);
      if (sz) put(sp, sz);
    }
    /* the JS-drawn regions: nav labels, the contents rail, the skip link.
       A string there is a copy of one in the page or a label from the shared
       dictionary, so the first translation of that text is the right one. */
    for (var j = 0; j < dynPlan.length; j++) {
      var d = dynPlan[j];
      var dz = d.kind === "attr" ? (a[d.attr + "|" + d.key + ":0"] || a[d.id])
                                 : (b[d.key + ":0"] || b[d.id]);
      if (dz) put(d, dz);
    }
    for (var n = 0; n < svgPlan.length; n++) {
      var sv = svgPlan[n], svz = b[sv.key + ":0"] || b[sv.id];
      if (svz) put(sv, svz);
    }
    citations(rewritten);
    if (dict.t) document.title = dict.t;
    if (dict.d) {
      var m = document.querySelector('meta[name="description"]');
      if (m) { m.dataset.en = m.content; m.content = dict.d; }
    }
    document.documentElement.lang = "zh-Hant";
    document.documentElement.setAttribute("data-lang", "zh");
    announce("zh");
  }

  function toEn() {
    if (plan) {
      for (var i = 0; i < plan.length; i++) put(plan[i], plan[i].en);
      for (var j = 0; j < dynPlan.length; j++) put(dynPlan[j], dynPlan[j].en);
      if (subPlan) {
        for (var k = 0; k < subPlan.length; k++) put(subPlan[k], subPlan[k].en);
      }
      for (var n = 0; n < svgPlan.length; n++) put(svgPlan[n], svgPlan[n].en);
      citations(rewritten);
    }
    document.title = enTitle;
    var m = document.querySelector('meta[name="description"]');
    if (m && m.dataset.en) { m.content = m.dataset.en; delete m.dataset.en; }
    document.documentElement.lang = "en";
    document.documentElement.setAttribute("data-lang", "en");
    announce("en");
  }

  /* A page that writes its own text at runtime (a chart label, a counter)
     cannot be reached through the dictionary. It listens for this instead. */
  function announce(which) {
    try {
      document.dispatchEvent(new CustomEvent("releaf:lang", { detail: { lang: which } }));
    } catch (e) {}
  }

  function label() {
    if (!btn) return;
    var other = lang === "zh" ? "en" : "zh";
    btn.textContent = LANGS[other];
    btn.setAttribute("lang", other === "zh" ? "zh-Hant" : "en");
    btn.setAttribute("aria-label", other === "zh"
      ? "切換為中文 · Read this page in Chinese"
      : "Read this page in English · 切換為英文");
    btn.setAttribute("aria-pressed", lang === "zh" ? "true" : "false");
  }

  function set(next, remember) {
    if (next === "zh") {
      dictionary(function () { lang = "zh"; toZh(); label(); });
    } else {
      lang = "en"; toEn(); label();
    }
    if (remember) {
      try { localStorage.setItem(STORE, next); } catch (e) {}
    }
  }

  /* ---- the button --------------------------------------------------------- */

  function mount() {
    var host = document.querySelector("#site-nav .sitenav__inner");
    if (!host) return false;
    if (host.querySelector(".sitenav__lang")) return true;
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sitenav__lang";
    var burger = host.querySelector(".sitenav__burger");
    host.insertBefore(btn, burger || null);
    btn.addEventListener("click", function () {
      set(lang === "zh" ? "en" : "zh", true);
    });
    label();
    return true;
  }

  function start() {
    var saved = "en";
    try { saved = localStorage.getItem(STORE) || "en"; } catch (e) {}
    /* The nav draws itself on DOMContentLoaded too, and nav.js is loaded
       first, so its listener has already run by the time this one does. If a
       page carries no nav, the toggle has nowhere to go but the swap still
       works for anything that asks for it. */
    if (!mount()) {
      var tries = 0;
      var t = setInterval(function () {
        if (mount() || ++tries > 20) clearInterval(t);
      }, 50);
    }
    if (saved === "zh") set("zh", false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  /* For a script that builds a string of its own out of pieces the page
     already holds -- a photograph's name plus its date, a label with a count
     in it. Ask for each piece by its English and put the sentence together;
     off the English page, or for a string no dictionary knows, you get back
     what you passed in. Pair it with the releaf:lang event: that is when to
     write the sentence again. */
  function t(en) {
    if (lang !== "zh" || !dict) return en;
    var k = norm(en);
    var b = dict.b || {}, a = dict.a || {};
    var z = b[hash(k) + ":0"];
    if (z === undefined) {
      /* some of these only ever existed as an attribute */
      for (var i = 0; i < ATTRS.length; i++) {
        z = a[ATTRS[i] + "|" + hash(k) + ":0"];
        if (z !== undefined) break;
      }
    }
    return z === undefined ? en : z;
  }

  window.ReleafI18n = { set: set, get: function () { return lang; }, t: t };
})();
