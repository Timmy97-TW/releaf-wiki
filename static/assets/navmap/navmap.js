/* ReLEAF navigation picture, prototype 2: the whole wiki in one valley.

   Markup, at the foot of a page, just before the footer:
     <link rel="stylesheet" href="static/assets/navmap/navmap.css">
     <section class="navmap"></section>
     <script src="static/assets/navmap/layout-world.js"></script>
     <script src="static/assets/navmap/navmap.js"></script>

   Paths are relative like the rest of the wiki. The wiki root, the page the
   reader is on, and where the pictures are all follow from this script's own
   address, so the same lines work at /, at /releaf-wiki/ and at /gems-taiwan/.

   Page names and their short lines come from assets/data/site-nav.js (NAV)
   when the page has loaded it, so the picture never disagrees with the menu.

   Options on the section:
     data-here         force the "you are here" page
     data-root         where the links point, if not the wiki this script sits in
     data-img          where the pictures live, if not next to this script
     data-keep-pagenav keep the page's Previous / Next row
     data-no-follow    the mascot stays put instead of walking to what you point at */
(function () {
  'use strict';

  // fallback when site-nav.js is not on the page (the review page, a test)
  var FALLBACK = [
    ['project', 'Project', [['description', 'Description', 'The problem and our answer'], ['biomanufacturing', 'Biomanufacturing', 'Protectant made on the farm'], ['engineering', 'Engineering', 'Every build and test cycle'], ['development', 'Development', 'Success criteria, stage by stage'], ['contribution', 'Contribution', 'Tools future teams can reuse'], ['results', 'Results', 'What worked on the bench']]],
    ['wetlab', 'Wet Lab', [['experiments', 'Experiments', 'Every protocol we ran'], ['parts', 'Parts', 'Our BioBricks and constructs'], ['plant', 'Plants', 'Salt and heat stress trials'], ['measurement', 'Measurement', 'Calibrated, repeatable readouts'], ['safety-and-security', 'Safety', 'Containment and lab safety'], ['notebook', 'Notebook', 'Wet lab records by month']]],
    ['drylab', 'Dry Lab', [['model', 'Math Model', 'From plant stress to light'], ['hardware', 'Hardware', 'Photometer, LEDs and bioreactor'], ['software', 'Digital Twin', 'Software that watches each batch'], ['protein-design', 'Protein Design', 'Designing the BoPep4 peptide'], ['drylab-notebook', 'Dry Lab Notebook', 'Computational work, week by week']]],
    ['engagement', 'Engagement', [['human-practices', 'Integrated Human Practices', 'Voices that reshaped ReLEAF'], ['education', 'Education', 'Lessons across three school levels'], ['entrepreneurship', 'Entrepreneurship', 'From prototype to farm business'], ['sustainability', 'Sustainability', 'Our impact on the SDGs'], ['laws-and-regulations', 'Laws and Regulations', 'Approval routes, Taiwan and beyond'], ['geospatial-analysis', 'Geospatial Analysis', 'Mapping stress across Taiwan'], ['data-physicalization', 'Data Physicalization', 'Stress data you can touch']]],
    ['team', 'Team', [['team', 'Members', 'The people behind ReLEAF'], ['attributions', 'Attribution', 'Who did what'], ['milestones', 'Milestones', 'Our season, month by month']]]
  ];
  // shorter names for the little signs in the picture (the caption uses the full one)
  var SIGN = { 'human-practices': 'Human Practices', 'laws-and-regulations': 'Laws & Regulations',
               'data-physicalization': 'Data Physicalization', 'geospatial-analysis': 'Geospatial', 'team': 'Team Members' };
  // the art's file names that differ from the page's address
  var SPRITE_PAGE = { milestone: 'milestones' };

  function pages() {
    var src = (typeof NAV !== 'undefined' && NAV && NAV.length) ? NAV.map(function (g) {
      return [g.id, g.name, g.pages.map(function (p) { return [p.slug, p.title, p.caption]; })];
    }) : FALLBACK;
    var out = {};
    src.forEach(function (g) { g[2].forEach(function (p) { out[p[0]] = { id: p[0], group: g[0], groupName: g[1], name: p[1], line: p[2] || '' }; }); });
    return out;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/[^/]*$/, '') : '';
  var ROOT = BASE.replace(/static\/assets\/navmap\/$/, '');   /* iGEM: scripts sit under static/ */
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function pct(v, of) { return (v / of * 100) + '%'; }

  function mount(root) {
    var here = root.getAttribute('data-here');
    if (here === null) {
      var at = location.href.split(/[?#]/)[0];
      here = at.indexOf(ROOT) === 0 ? at.slice(ROOT.length).split('/')[0] : '';
    }
    // each page has its own small scene (only it and the pages it links to); the whole valley is the fallback
    var L = (window.NAVMAP_WORLDS && window.NAVMAP_WORLDS[here]) || window.NAVMAP_WORLD;
    if (!L) return;
    var PAGES = pages();
    var img = 'assets/navmap/img/';   /* iGEM: a repository path, answered by __cdn() */
    var linkRoot = root.getAttribute('data-root') || ROOT;
    if (!root.hasAttribute('data-keep-pagenav')) {
      var pn = document.querySelectorAll('.pagenav');
      for (var q = 0; q < pn.length; q++) pn[q].parentNode.removeChild(pn[q]);
    }
    var W = L.w, H = L.h, Y0 = L.top || 0;   // Y0: how much empty sky is cut off the top
    function px(x) { return pct(x, W); }
    function py(y) { return pct(y - Y0, H - Y0); }
    var pageOf = function (k) { return SPRITE_PAGE[k] || k; };
    var attach = L.attach || {};
    var focal = L.focal || [];
    // a page can name the pages it points its readers to: only those become stickers,
    // the rest stay in the painting, faded and not clickable
    var links = (L.links && L.links[here]) || null;

    root.classList.add('navmap');
    root.innerHTML = '';
    var title = h('h2', 'nm-title', 'Explore ReLEAF');
    title.setAttribute('data-no-toc', '');
    root.appendChild(title);
    var cap = h('p', 'nm-caption');
    cap.setAttribute('aria-live', 'polite');
    root.appendChild(cap);
    // on a phone the valley is wider than the screen: swipe along it
    var scroller = h('div', 'nm-scroll');
    root.appendChild(scroller);
    var stage = h('div', 'nm-stage');
    scroller.appendChild(stage);

    var svg = el('svg', { viewBox: '0 ' + Y0 + ' ' + W + ' ' + (H - Y0), role: 'group', 'aria-label': 'Every page of ReLEAF' }, stage);
    // what can be clicked is drawn like a sticker on the painting: a white edge and a
    // soft shadow. Pointed at, the edge thickens and a ReLEAF-green ring goes round it.
    var defs = el('defs', {}, svg);
    function sticker(id, edge, ring, shadow) {
      var f = el('filter', { id: id, x: '-25%', y: '-25%', width: '150%', height: '150%' }, defs);
      // the drawing's own soft fringe and painted ground shadow are not part of its shape
      var ct = el('feComponentTransfer', { in: 'SourceAlpha', result: 'a' }, f);
      el('feFuncA', { type: 'discrete', tableValues: '0 0 1 1' }, ct);
      var nodes = [];
      el('feMorphology', { in: 'a', operator: 'dilate', radius: String(edge + 4), result: 'sd' }, f);
      el('feGaussianBlur', { in: 'sd', stdDeviation: '5', result: 'sb' }, f);
      el('feOffset', { in: 'sb', dy: '5', result: 'so' }, f);
      el('feFlood', { 'flood-color': '#14281c', 'flood-opacity': String(shadow) }, f);
      el('feComposite', { in2: 'so', operator: 'in', result: 'shadow' }, f);
      nodes.push('shadow');
      if (ring) {
        el('feMorphology', { in: 'a', operator: 'dilate', radius: String(edge + ring), result: 'rd' }, f);
        el('feFlood', { 'flood-color': '#9bd14b' }, f);
        el('feComposite', { in2: 'rd', operator: 'in', result: 'ring' }, f);
        nodes.push('ring');
      }
      el('feMorphology', { in: 'a', operator: 'dilate', radius: String(edge), result: 'ed' }, f);
      el('feFlood', { 'flood-color': '#ffffff' }, f);
      el('feComposite', { in2: 'ed', operator: 'in', result: 'edge' }, f);
      nodes.push('edge', 'SourceGraphic');
      var mg = el('feMerge', {}, f);
      nodes.forEach(function (n) { el('feMergeNode', { in: n }, mg); });
    }
    // the main things in the middle get a bold sticker edge, the rest a lighter one
    sticker('nm-rest', 2, 0, 0.18);
    sticker('nm-focal', 5, 0, 0.36);
    sticker('nm-hover', 5, 5, 0.38);
    el('image', { href: __cdn(img + 'w/' + (L.plate || 'plate') + '.webp'), x: 0, y: 0, width: W, height: H }, svg);
    // the painting steps back a little so the things on it stand forward
    el('rect', { class: 'nm-veil', x: 0, y: 0, width: W, height: H }, svg);

    var things = {};   // page id -> { a, sprite, label }
    L.order.forEach(function (k) {
      var s = L.sprites[k], pid = pageOf(k), p = PAGES[pid];
      if (!p) return;
      if (links && links.indexOf(pid) < 0) {
        var off = el('g', { class: 'nm-off', 'aria-hidden': 'true' }, svg);
        el('image', { href: __cdn(img + 'w/' + (s.img || k) + '.webp'), x: s.x, y: s.y, width: s.w, height: s.h }, off);
        return;
      }
      var a = el('a', { class: 'nm-spot', 'data-page': pid, 'aria-label': p.name }, svg);
      if (links || focal.indexOf(k) >= 0) a.classList.add('nm-focal');
      if (pid === here) { a.classList.add('nm-is-here'); a.setAttribute('aria-current', 'page'); }
      else a.setAttribute('href', linkRoot + String(pid).replace(/\//g, '-'));   /* iGEM: /<page>, nested pages flat */
      var g = el('g', { class: 'nm-art' }, a);
      el('image', { href: __cdn(img + 'w/' + (s.img || k) + '.webp'), x: s.x, y: s.y, width: s.w, height: s.h }, g);
      el('polygon', { points: s.hit, class: 'nm-hit' }, a);
      things[pid] = { a: a, s: s, key: k };
    });
    // a thing drawn as part of another page's thing lights with it
    for (var ak in attach) if (things[pageOf(ak)] && things[pageOf(attach[ak])]) things[pageOf(attach[ak])].also = things[pageOf(ak)].a;

    // one name tag, over whatever is pointed at
    var tag = h('span', 'nm-tag');
    tag.setAttribute('aria-hidden', 'true');
    stage.appendChild(tag);
    function placeTag(pid) {
      var t = things[pid], s = t.s, spec = (L.labels && L.labels[t.key]) || {};
      tag.textContent = (SIGN[pid] || PAGES[pid].name) + (pid === here ? ' \u00b7 you are here' : '');
      var x = spec.x !== undefined ? spec.x : s.x + s.w / 2;
      var below = spec.side === 'below' || s.y - Y0 < 90;   // no room above: hang it underneath
      tag.classList.toggle('nm-below', below);
      tag.style.top = py(below ? s.y + s.h + 8 : s.y - 8);
      tag.style.left = px(x);
      // keep it inside the picture at the sides
      var sw = stage.clientWidth, tw = tag.offsetWidth, cx = x / W * sw;
      var shift = Math.max(tw / 2 + 6 - cx, Math.min(0, sw - 6 - tw / 2 - cx));
      tag.style.marginLeft = shift + 'px';
    }

    // the mascot: he stands by the page you are on
    var guy = h('img', 'nm-guy');
    guy.alt = '';
    guy.src = __cdn(img + 'mascot-still.webp');
    guy.setAttribute('aria-hidden', 'true');
    stage.appendChild(guy);
    var walkSrc = __cdn(img + 'mascot-walk.webp');
    new Image().src = walkSrc;
    function standOf(pid) {
      var t = things[pid];
      if (!t) { var d = L.home || [1000, 1110]; return { x: d[0], y: d[1], face: 1 }; }
      var spec = (L.stand && L.stand[t.key]);
      if (spec) return { x: spec[0], y: spec[1], face: spec[2] || (spec[0] < t.s.x + t.s.w / 2 ? 1 : -1) };
      var x = Math.max(90, t.s.x - 60), y = t.s.y + t.s.h;
      return { x: x, y: Math.min(H - 10, y), face: 1 };
    }
    var SIZE = 125;   // the mascot's height in picture units, at the front of the picture
    var pos = null, walkT = 0;
    function place(p, instant) {
      var scale = 0.62 + 0.38 * (p.y / H);   // smaller further back
      var size = SIZE * scale;
      var dx = pos ? p.x - pos.x : 0, dy = pos ? p.y - pos.y : 0;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var ms = instant || REDUCED ? 0 : Math.max(350, Math.min(1600, dist * 1.4));
      guy.style.transitionDuration = ms + 'ms';
      guy.style.width = px(size);
      guy.style.left = px(p.x);
      guy.style.top = py(p.y);
      clearTimeout(walkT);
      if (ms > 0 && dist > 4) {
        // he faces left in the drawing: walking right he moonwalks, walking left he turns round
        guy.classList.toggle('nm-turn', dx < 0);
        guy.src = walkSrc;
        walkT = setTimeout(function () { guy.src = __cdn(img + 'mascot-still.webp'); guy.classList.toggle('nm-turn', p.face > 0); }, ms);
      } else {
        guy.classList.toggle('nm-turn', p.face > 0);
      }
      pos = p;
      root._nmPos = p;
    }
    var home = standOf(here);

    var touch = window.matchMedia('(hover: none)').matches;
    // At rest the line is empty: the picture says what it is, and the caption
    // speaks only for the place the reader is pointing at.
    function setCaption(pid) {
      cap.innerHTML = '';
      if (!pid) return;
      var p = PAGES[pid];
      cap.appendChild(h('strong', null, p.name));
      cap.appendChild(h('span', null, pid === here ? 'You are here.' : p.line));
    }

    var current = null, hideT = 0, followT = 0;
    var follow = !root.hasAttribute('data-no-follow') && !REDUCED;
    var viaTouch = false, armed = null;   // a finger, not a mouse: first tap names, second goes
    stage.addEventListener('pointerdown', function (e) { viaTouch = e.pointerType !== 'mouse'; }, true);
    function show(pid) {
      clearTimeout(hideT);
      current = pid;
      if (!pid) armed = null;
      var lit = [];
      if (pid && things[pid]) { lit.push(things[pid].a); if (things[pid].also) lit.push(things[pid].also); }
      Object.keys(things).forEach(function (k) {
        things[k].a.classList.toggle('nm-on', lit.indexOf(things[k].a) >= 0);
      });
      if (pid && things[pid]) { placeTag(pid); tag.classList.add('nm-show'); } else tag.classList.remove('nm-show');
      setCaption(pid);
      // he only sets off once the pointer has settled, and goes home after a pause
      clearTimeout(followT);
      if (follow) followT = setTimeout(function () { place(pid ? standOf(pid) : home); }, pid ? 450 : 1100);
    }
    function hideSoon() { hideT = setTimeout(function () { show(null); }, 140); }
    Object.keys(things).forEach(function (pid) {
      var a = things[pid].a;
      a.addEventListener('mouseenter', function () { if (!touch && !viaTouch) show(pid); });
      a.addEventListener('mouseleave', function () { if (!touch && !viaTouch) hideSoon(); });
      a.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && viaTouch) { viaTouch = false; show(pid); } });
      a.addEventListener('focus', function () { show(pid); });
      a.addEventListener('blur', hideSoon);
      a.addEventListener('click', function (e) {
        // on a phone the first tap names it, the second goes there
        if ((touch || viaTouch) && armed !== pid) { e.preventDefault(); armed = pid; show(pid); }
        else if (root.hasAttribute('data-local')) {
          e.preventDefault();
          root.dispatchEvent(new CustomEvent('navmap:go', { detail: pid }));
        }
      });
    });
    if (!root._nmDoc) { root._nmDoc = true; document.addEventListener('click', function (e) { if (root._nmShow && !root.contains(e.target)) root._nmShow(null); }); }
    root._nmShow = function (p) { if (current) show(p); };
    setCaption(null);
    // start the phone's view where the reader is
    if (scroller.scrollWidth > scroller.clientWidth + 4) {
      scroller.scrollLeft = home.x / W * scroller.scrollWidth - scroller.clientWidth / 2;
    }

    // mounted again (the page it stands for changed): he walks over from where he was
    if (root._nmPos && !REDUCED) {
      place(root._nmPos, true);
      setTimeout(function () { place(home); }, 60);
    // he walks in from the edge the first time the valley comes into view
    } else if (!REDUCED && 'IntersectionObserver' in window) {
      place({ x: home.x < W / 2 ? -120 : W + 120, y: home.y, face: home.face }, true);
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        setTimeout(function () { if (!current) place(home); }, 300);
      }, { threshold: 0.35 });
      io.observe(scroller);
    } else {
      place(home, true);
    }
  }

  window.NavMap = { mount: mount };
  function init() {
    var all = document.querySelectorAll('section.navmap');
    for (var i = 0; i < all.length; i++) if (!all[i].hasAttribute('data-manual')) mount(all[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
