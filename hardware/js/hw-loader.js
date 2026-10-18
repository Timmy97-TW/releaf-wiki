/* The move between Hardware pages (18 Oct 2026, owner: "Line").

   The homepage opening, carried onto the Hardware black: the students'
   ReLEAF wordmark drawn as linework, the mascot moonwalking under it, and
   each letter filling with its colours as he reaches it. The floor he walks
   on is a ruler that fills in the colour of the instrument you are going to,
   and the readout under it names that page.

   It plays only from one Hardware page to another, never on arrival from
   the rest of the wiki, and not at all with reduced motion.

   HOW ONE WALK SPANS TWO PAGES. A click on a link to another Hardware page
   closes the black over this page (0.32 s, the length of the old fade) and
   starts him walking, then navigates. This page keeps walking him until the
   browser swaps it out; at that moment (pagehide) it writes where he got to
   into sessionStorage. The next page reads that in its <head>, before
   anything paints, puts the same screen back at the same point, and walks
   him on until it has loaded. Where the browser crossfades the two pages
   itself (@view-transition in css/polish.css), it is crossfading one screen
   into the same screen.

   WHAT THE NEXT PAGE WAITS FOR: its load event (images, scripts, the
   hero's first files), the fonts, and the drawings. At least MIN from the
   click so the word is spelled and not a flicker. Past MAX he finishes
   briskly and the black lifts on whatever has arrived, but never before
   the page's HTML and scripts are in (DOMContentLoaded): at 1.6 Mbit the
   photometer page is still parsing at 7 s, and lifting then showed half a
   page. HARD is the only limit on that wait.
   The page is hidden under the black with visibility, never opacity, and a
   timer in this file always lifts it: a page cannot be left blank by it.

   The drawings: img/loader/. word.webp is the homepage wordmark with five
   faint specks under the R removed (white hid them, black shows them).
   moonwalk.webp and its still are the homepage walk on no ground at all.
   Their recipes are in Updates/homepage-loader-1018/build. The letter
   numbers below are build/loader-letters.py's output, as on the homepage. */
(function (d, w) {
  "use strict";
  if (!w.sessionStorage || !w.matchMedia || w.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var KEY = "releaf-hwl";
  var me = d.currentScript;
  if (!me) return;
  var BASE = me.src.replace(/js\/hw-loader\.js[^/]*$/, "");      // …/hardware/
  var IMG = BASE + "img/loader/";
  var basePath = new URL(BASE).pathname;

  var PAGES = {
    hub:         { n: "",   name: "Hardware",    c: "#d3dae3" },
    bioreactor:  { n: "01", name: "Bioreactor",  c: "#5aa9ff" },
    photometer:  { n: "02", name: "Photometer",  c: "#ffa23d" },
    diopal:      { n: "03", name: "LPA",         c: "#3ddc8b" },
    hydroponics: { n: "04", name: "Hydroponics", c: "#b18cff" },
    notebook:    { n: "",   name: "Notebook",    c: "#d3dae3" }
  };
  // which Hardware page a URL is, or null when it is not one
  function pageOf(u) {
    var p = u.pathname;
    if (p + "/" === basePath) return "hub";
    if (p.indexOf(basePath) !== 0) return null;
    var rest = p.slice(basePath.length);
    if (/^(index\.html)?$/.test(rest)) return "hub";
    var m = rest.match(/^([a-z]+)(?:\/(?:[\w-]+\.html)?)?$/);
    return m && PAGES[m[1]] ? m[1] : null;
  }
  var here = pageOf(location);
  if (!here) return;

  var MIN = 1400, MAX = 6000, HARD = 15000, LIFT = 700;
  var MW = 0.26;                                               // the mascot's width, a share of the row
  var LETTERS = [[.0032, .2024], [.2069, .3306], [.3363, .5148], [.5278, .6515], [.6564, .8292], [.8414, .9594]];
  var AT = LETTERS.map(function (lr) {                         // how far he must have walked to stand under each
    var c = (lr[0] + lr[1]) / 2;
    return Math.max(0, Math.min(1, (c - MW / 2) / (1 - MW)));
  });

  var CSS =
    "html.hwl{background:#05060a}html.hwl body{visibility:hidden}" +
    "#hwl{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;visibility:visible;" +
      "background:#05060a;opacity:0;transition:opacity .32s cubic-bezier(.22,.61,.36,1);--c:#d3dae3;" +
      "font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;-webkit-font-smoothing:antialiased}" +
    "#hwl.in{opacity:1}#hwl.at{opacity:1;transition:none}#hwl.out{opacity:0;transition:opacity .7s cubic-bezier(.22,.61,.36,1)}" +
    "#hwl::before{content:'';position:absolute;inset:0;opacity:.16;pointer-events:none;" +
      "background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px);" +
      "background-size:88px 88px;background-position:center;" +
      "-webkit-mask-image:radial-gradient(60% 52% at 50% 50%,#000 20%,transparent 100%);mask-image:radial-gradient(60% 52% at 50% 50%,#000 20%,transparent 100%)}" +
    "#hwl::after{content:'';position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay;pointer-events:none;" +
      "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")}" +
    ".hwl__box{position:relative;width:min(640px,84vw);padding:clamp(28px,5vw,48px) clamp(18px,4vw,40px);transition:opacity .45s ease,transform .7s cubic-bezier(.4,0,.2,1)}" +
    "#hwl.out .hwl__box{opacity:0;transform:translateY(1.5%) scale(.985)}" +
    ".hwl__k{position:absolute;width:14px;height:14px;border:0 solid rgba(255,255,255,.42)}" +
    ".hwl__k1{left:0;top:0;border-width:1px 0 0 1px}.hwl__k2{right:0;top:0;border-width:1px 1px 0 0}" +
    ".hwl__k3{left:0;bottom:0;border-width:0 0 1px 1px}.hwl__k4{right:0;bottom:0;border-width:0 1px 1px 0}" +
    ".hwl__eb{display:flex;align-items:center;gap:.9rem;margin:0 0 clamp(14px,2.4vw,22px);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#c5cdd7;white-space:nowrap}" +
    ".hwl__eb::before,.hwl__eb::after{content:'';flex:1;min-width:16px;height:9px;background:linear-gradient(rgba(255,255,255,.3),rgba(255,255,255,.3)) 0 50%/100% 1px no-repeat;border:0 solid rgba(255,255,255,.55);border-left-width:1px}" +
    ".hwl__eb::after{border-width:0 1px 0 0}" +
    /* the word: in the ground's own black, its outline drawn by a rim round the whole row */
    ".hwl__w{position:relative;aspect-ratio:2.5773;filter:drop-shadow(1px 0 0 rgba(220,230,240,.7)) drop-shadow(-1px 0 0 rgba(220,230,240,.7)) drop-shadow(0 1px 0 rgba(220,230,240,.7)) drop-shadow(0 -1px 0 rgba(220,230,240,.7))}" +
    ".hwl__base,.hwl__l{position:absolute;inset:0;background:url('" + IMG + "word.webp') 0 0/100% 100% no-repeat}" +
    ".hwl__base{filter:brightness(0)}" +
    ".hwl__l{clip-path:inset(0 calc(100% - var(--r) * 100%) 0 calc(var(--l) * 100%));opacity:0;transition:opacity .55s ease}" +
    ".hwl__l.on{opacity:1}#hwl.at .hwl__l.on{transition:none}" +
    ".hwl__track{position:relative;height:0;padding-bottom:26%;margin-top:.5%}" +
    ".hwl__m{position:absolute;left:0;top:0;width:26%;height:auto;opacity:0;transition:opacity .35s ease;" +
      "transform:translate3d(calc(var(--p,0) * 284.62%),0,0);" +
      "filter:drop-shadow(1px 0 0 rgba(220,230,240,.85)) drop-shadow(-1px 0 0 rgba(220,230,240,.85)) drop-shadow(0 1px 0 rgba(220,230,240,.85)) drop-shadow(0 -1px 0 rgba(220,230,240,.85)) drop-shadow(0 0 10px color-mix(in srgb,var(--c) 50%,transparent))}" +
    ".hwl__m.on{opacity:1}" +
    ".hwl__dot{position:absolute;left:calc(13% + var(--p,0) * 74%);bottom:14%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;" +
      "background:var(--c);box-shadow:0 0 16px 3px color-mix(in srgb,var(--c) 55%,transparent);animation:hwl-b 1.6s ease-in-out infinite;transition:opacity .3s ease}" +
    ".hwl__box.has-art .hwl__dot{opacity:0;animation:none}@keyframes hwl-b{50%{transform:scale(.6);opacity:.55}}" +
    /* the floor: a ruler, filled in the destination's colour */
    ".hwl__floor{position:relative;height:9px;margin-top:-1px}" +
    ".hwl__floor::before{content:'';position:absolute;inset:0;background:" +
      "linear-gradient(rgba(255,255,255,.22),rgba(255,255,255,.22)) 0 0/100% 1px no-repeat," +
      "repeating-linear-gradient(90deg,rgba(255,255,255,.3) 0 1px,transparent 1px 10%) 0 0/100% 5px no-repeat," +
      "repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 1px,transparent 1px 2%) 0 0/100% 3px no-repeat}" +
    ".hwl__floor::after{content:'';position:absolute;left:0;top:0;height:1px;width:calc(var(--p,0) * 100%);background:var(--c);box-shadow:0 0 10px var(--c)}" +
    ".hwl__ro{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-top:12px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a3adb9;white-space:nowrap}" +
    ".hwl__ro b{font-weight:400;color:var(--c)}.hwl__ro i{font-style:normal;margin-right:.55em}.hwl__pc{font-variant-numeric:tabular-nums;color:#c5cdd7}" +
    "@media (max-width:520px){.hwl__box{width:92vw;padding-left:14px;padding-right:14px}.hwl__eb{letter-spacing:.18em}.hwl__ro{font-size:10px;letter-spacing:.12em}}";

  var st = d.createElement("style");
  st.textContent = CSS;
  (d.head || d.documentElement).appendChild(st);

  var L = null, box, mascot, letters, pc, p = 0, lit = 0, art = false, t0 = 0, running = false;

  function build(to) {
    var P = PAGES[to];
    L = d.createElement("div");
    L.id = "hwl";
    L.setAttribute("aria-hidden", "true");
    L.style.setProperty("--c", P.c);
    L.innerHTML =
      '<div class="hwl__box"><i class="hwl__k hwl__k1"></i><i class="hwl__k hwl__k2"></i><i class="hwl__k hwl__k3"></i><i class="hwl__k hwl__k4"></i>' +
      '<p class="hwl__eb">ReLEAF &middot; Hardware</p><div class="hwl__w"><div class="hwl__base"></div>' +
      LETTERS.map(function (lr) { return '<i class="hwl__l" style="--l:' + lr[0] + ";--r:" + lr[1] + '"></i>'; }).join("") +
      '</div><div class="hwl__track"><span class="hwl__dot"></span><img class="hwl__m" width="299" height="299" alt="" decoding="async"></div>' +
      '<div class="hwl__floor"></div><div class="hwl__ro"><span>' + (P.n ? "<i>" + P.n + "</i>" : "") + "<b>" + P.name +
      '</b></span><span class="hwl__pc">000%</span></div></div>';
    box = L.querySelector(".hwl__box");
    mascot = L.querySelector(".hwl__m");
    letters = [].slice.call(L.querySelectorAll(".hwl__l"));
    pc = L.querySelector(".hwl__pc");
    return L;
  }

  // the still first (7 kB), then the walk takes its place once it is whole
  function drawings() {
    var still = new Image();
    still.onload = function () {
      mascot.src = still.src; mascot.classList.add("on"); box.classList.add("has-art"); art = true;
      var walk = new Image();
      walk.onload = function () { if (L) mascot.src = walk.src; };
      walk.src = IMG + "moonwalk.webp";
    };
    still.onerror = function () { art = true; };
    still.src = IMG + "moonwalk-still.webp";
  }

  function paint() {
    L.style.setProperty("--p", p.toFixed(4));
    pc.textContent = ("00" + Math.round(p * 100)).slice(-3) + "%";
    while (lit < letters.length && p >= AT[lit] - .01) { letters[lit].classList.add("on"); lit++; }
  }

  // how far he may have walked: never past 84% until the page is in, and
  // never faster than MIN allows; a slow curve keeps him moving meanwhile
  function goal(el, done) {
    if (!art) return p;
    return Math.min(el / MIN, done ? 1 : Math.max(p, .84 * (1 - Math.exp(-el / 2200))));
  }

  /* ───────── leaving: a click to another Hardware page ───────── */
  w.addEventListener("click", function (e) {
    if (running || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    var to = pageOf(u);
    if (!to) return;
    if (u.pathname === location.pathname && u.search === location.search) return;   // a #link on this page
    e.preventDefault();
    e.stopPropagation();                                       // the old fade (hub.js, chrome.js) is replaced, not stacked
    running = true;
    d.body.appendChild(build(to));
    drawings();
    t0 = performance.now();
    void L.offsetWidth;
    L.classList.add("in");
    (function tick(now) {
      if (!L) return;
      var g = goal(now - t0, false);
      p += (g - p) * .08;
      paint();
      w.requestAnimationFrame(tick);
    })(t0);
    w.addEventListener("pagehide", function () {
      try { sessionStorage.setItem(KEY, JSON.stringify({ to: to, p: p, at: Date.now() - (performance.now() - t0) })); } catch (err) { /* fine */ }
    }, { once: true });
    w.setTimeout(function () { location.href = u.href; }, 320);
  }, true);

  // back to this page from the browser's cache: it was left covered
  w.addEventListener("pageshow", function (ev) {
    if (ev.persisted && L) { L.remove(); L = null; running = false; d.documentElement.classList.remove("hwl"); }
  });

  /* ───────── arriving: the walk carries on here ───────── */
  var got = null;
  try { got = JSON.parse(sessionStorage.getItem(KEY) || "null"); sessionStorage.removeItem(KEY); } catch (err) { got = null; }
  if (!got || got.to !== here || !(Date.now() - got.at < 15000)) return;

  var root = d.documentElement;
  root.classList.add("hwl");
  build(here);
  L.classList.add("at");
  p = Math.max(0, Math.min(.84, +got.p || 0));
  paint();
  var since = Date.now() - got.at;                             // ms since the click, on the other page
  var start = performance.now() - since;
  var loaded = false, fonts = !d.fonts, parsed = d.readyState !== "loading";
  w.addEventListener("load", function () { loaded = true; });
  d.addEventListener("DOMContentLoaded", function () { parsed = true; });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { fonts = true; });

  // into <body> the moment there is one, before the page's first paint
  function mount() {
    if (!d.body) return false;
    d.body.insertBefore(L, d.body.firstChild);
    return true;
  }
  if (!mount()) {
    var mo = new MutationObserver(function () { if (mount()) mo.disconnect(); });
    mo.observe(root, { childList: true });
  }
  drawings();

  var left = false;
  function lift() {
    if (left) return;
    left = true;
    L.classList.remove("at");
    L.classList.add("out");
    root.classList.remove("hwl");
    w.setTimeout(function () { if (L) L.remove(); L = null; }, LIFT + 50);
  }
  (function tick(now) {
    if (left) return;
    var el = now - start;
    var late = el > MAX && (parsed || el > HARD);
    var done = (loaded && fonts) || late;
    var g = goal(el, done);
    p += (g - p) * (late ? .22 : .08);
    if (done && el >= MIN && 1 - p < .01) p = 1;
    paint();
    if (p >= 1) { w.setTimeout(lift, 380); return; }
    w.requestAnimationFrame(tick);
  })(performance.now());
  w.setTimeout(lift, Math.max(HARD - since, 0) + 1500);         // a hidden tab never ticks; never keep anyone out
})(document, window);
