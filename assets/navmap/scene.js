/* ReLEAF navigation map, the page scenes.

   Jacquelyn's principle: one fixed world, and every thing keeps its place in
   it. A page's scene is that world with only the page's things present. They
   stand in world order, left to right (the village, the lab, the studio, the
   yard, the field, the town), each group on its own ground, and the things
   that belong together stay together: the farmers' table at the edge of the
   crop field, the Digital Twin's screen against the reactor, the photometer
   beside the reactor's tray of seedlings, the results board at the field, the
   notebook on the bench. The page's own thing stands larger and glows in its
   section's colour when the scene scrolls into view.

   Which pages appear in each scene is Jacquelyn's choice (navmap-data.js).
   The Description page uses the whole valley instead (art.js, data-art="all").

     <section class="navmap" data-art="scene"></section>
   Needs navmap-data.js and art.js (for the drawings). */
(function () {
  'use strict';
  var A = window.NavMapArt && window.NavMapArt.lib, D = window.NAVMAP_DATA;
  if (!A || !D) return;
  var C = A.C, PLACE = A.PLACE, SEC = A.SEC, PAGE = A.PAGE, h = A.h, esc = A.esc;
  var rect = A.rect, path = A.path, ell = A.ell, circ = A.circ, line = A.line;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- the world: zones in order, and each thing's place inside its zone ---- */
  var ZONES = [
    { id: 'village', ground: 'lawn',    things: ['milestones', 'team', 'attributions'] },
    { id: 'lab',     ground: 'lab',     things: ['experiments', 'notebook', 'parts', 'measurement', 'safety-and-security'] },
    { id: 'studio',  ground: 'studio',  things: ['model', 'software', 'protein-design', 'drylab-notebook'] },
    { id: 'yard',    ground: 'gravel',  things: ['description', 'contribution', 'engineering', 'hardware', 'biomanufacturing', 'development', 'results'] },
    { id: 'field',   ground: 'field',   things: ['plant', 'geospatial-analysis'] },
    { id: 'town',    ground: 'plaza',   things: ['data-physicalization', 'entrepreneurship', 'human-practices', 'education', 'laws-and-regulations', 'sustainability'] }
  ];
  // the pairings: when both are in the scene, the first moves next to the second (before it or after it), onto its ground
  var PAIR = [
    ['software', 'hardware', 'after'],                 // the twin's screen stands against the reactor
    ['measurement', 'hardware', 'before'],             // the photometer beside the reactor's tray of seedlings
    ['drylab-notebook', 'software', 'after'],          // the development log beside the twin
    ['human-practices', 'plant', 'after'],             // the farmers' table at the edge of the field
    ['results', 'plant', 'after'],                     // the results board at the field
    ['geospatial-analysis', 'plant', 'after'],         // the survey map at the field edge
    ['notebook', 'experiments', 'after'],              // the notebook on the bench
    ['safety-and-security', 'experiments', 'before'],  // the safety post at the lab door
    ['data-physicalization', 'education', 'before']    // the sculpture in front of the school
  ];
  var W = 2400, H = 780, GROUND = 226;

  /* arrange the page's things: world order, paired things pulled together, grouped by ground */
  function arrange(here) {
    var set = {}; set[here] = true;
    A.linksOf(here).forEach(function (l) { set[l.to] = true; });
    var seq = [];
    ZONES.forEach(function (z) { z.things.forEach(function (t) { if (set[t]) seq.push({ slug: t, ground: z.ground, zone: z.id }); }); });
    function idx(slug) { for (var i = 0; i < seq.length; i++) if (seq[i].slug === slug) return i; return -1; }
    PAIR.forEach(function (p) {
      var a = idx(p[0]), b = idx(p[1]);
      if (a < 0 || b < 0) return;
      var item = seq.splice(a, 1)[0];
      b = idx(p[1]);
      item.ground = seq[b].ground; item.zone = seq[b].zone;
      seq.splice(p[2] === 'before' ? b : b + 1, 0, item);
    });
    var groups = [];
    seq.forEach(function (e) {
      var g = groups[groups.length - 1];
      if (g && g.ground === e.ground) g.things.push(e.slug); else groups.push({ ground: e.ground, zone: e.zone, things: [e.slug] });
    });
    return groups;
  }

  /* ---- the grounds ---- */
  function soft(x0, y0, x1, y1, r, fill, edge) {
    var d = 'M' + (x0 + r) + ',' + y0 + ' H' + (x1 - r) + ' Q' + x1 + ',' + y0 + ' ' + x1 + ',' + (y0 + r) + ' V' + (y1 - r) + ' Q' + x1 + ',' + y1 + ' ' + (x1 - r) + ',' + y1 + ' H' + (x0 + r) + ' Q' + x0 + ',' + y1 + ' ' + x0 + ',' + (y1 - r) + ' V' + (y0 + r) + ' Q' + x0 + ',' + y0 + ' ' + (x0 + r) + ',' + y0 + ' Z';
    return path(d, edge, ' transform="translate(0,8)" opacity=".9"') + path(d, fill);
  }
  function ground(kind, x0, x1, fy0, fy1, seedv) {
    var s = '', i; A.setSeed(seedv);
    if (kind === 'lab' || kind === 'studio') {
      s += soft(x0, fy0, x1, fy1, 44, C.pave, C.pave2);
      for (i = 0; x0 + 40 + i * 150 < x1 - 20; i++) s += line([[x0 + 40 + i * 150, fy0 + 10], [x0 + 20 + i * 150, fy1 - 10]], 1, C.pave2, ' opacity=".6"');
      // a roof over the floor: taller and with more posts the wider the floor; a very small floor stands open
      if (x1 - x0 > 260) {
        var mids = []; if (x1 - x0 > 900) mids = [x0 + (x1 - x0) * .36, x0 + (x1 - x0) * .7]; else if (x1 - x0 > 520) mids = [(x0 + x1) / 2];
        var hh = Math.min(230, 120 + (x1 - x0) * .1);
        s += A.pavilion(x0 + 50, x1 - 50, fy0 + 40, hh, kind === 'lab' ? C.roofGreenShade : C.roofBlueShade, kind === 'lab' ? C.roofGreen : C.roofBlue, '', mids);
      }
    } else if (kind === 'gravel') {
      s += soft(x0, fy0, x1, fy1, 50, C.gravel, C.gravel2);
      for (i = 0; i < (x1 - x0) / 14; i++) s += circ(x0 + 16 + Math.random() * (x1 - x0 - 32), fy0 + 16 + Math.random() * (fy1 - fy0 - 32), 1.6 + Math.random() * 2.2, C.gravel2, ' opacity=".7"');
      s += A.fence(x0 + 14, fy0 + 30, Math.min(7, Math.floor((x1 - x0) / 40)), 12);
    } else if (kind === 'plaza') {
      s += soft(x0, fy0, x1, fy1, 50, C.pave, C.pave2);
      for (i = 0; x0 + 30 + i * 140 < x1; i++) s += line([[x0 + 30 + i * 140, fy0], [x0 + i * 150, fy1]], 1, C.pave2, ' opacity=".7"');
      for (i = 1; i < 6; i++) s += line([[x0 + 4, fy0 + i * 70], [x1 - 4, fy0 + i * 70]], 1, C.pave2, ' opacity=".7"');
      s += ell(x0 + 70, fy1 - 18, 54, 14, C.lawn) + A.flowers(x0 + 30, fy1 - 28, 80, 20, C.gold, 12);
    } else if (kind === 'lawn') {
      s += soft(x0, fy0, x1, fy1, 70, C.lawn, C.plainDeep) + A.flowers(x0 + 20, fy0 + 20, Math.max(80, x1 - x0 - 40), 50, C.white, Math.round((x1 - x0) / 20));
      if (x1 - x0 > 420) s += ell(x1 - 90, fy1 - 50, 70, 20, C.bank, ' opacity=".8"') + ell(x1 - 90, fy1 - 52, 62, 16, C.riverLight) + ell(x1 - 92, fy1 - 54, 50, 11, C.river) + ell(x1 - 108, fy1 - 58, 12, 3, C.white, ' opacity=".5"');
    } else {
      s += soft(x0, fy0, x1, fy1, 30, C.soil2, C.soil);
      for (i = 0; i < 7; i++) s += line([[x0 + 14, fy0 + 30 + i * 60], [x1 - 14, fy0 + 36 + i * 60]], 3, C.soil, ' opacity=".8"') + line([[x0 + 14, fy0 + 42 + i * 60], [x1 - 14, fy0 + 48 + i * 60]], 1.2, C.ochre, ' opacity=".35"');
      s += A.hay(x1 - 40, fy0 + 36, 1.1);
    }
    return s;
  }
  function setting(id) {
    var s = '';
    s += rect(0, 0, W, H, 'url(#' + id + '-sky)') + circ(1960, 96, 190, 'url(#' + id + '-sun)') + circ(1960, 96, 36, C.sun);
    s += ell(380, 92, 120, 12, C.white, ' opacity=".4"') + ell(1240, 70, 150, 12, C.white, ' opacity=".35"') + ell(2200, 150, 80, 9, C.white, ' opacity=".3"');
    s += '<g filter="url(#' + id + '-brushsoft)">' + A.mountains(W, 170, .6, 'url(#' + id + '-mist)') + '</g>';
    s += '<g filter="url(#' + id + '-brush)">' + rect(0, GROUND - 20, W, H - GROUND + 20, 'url(#' + id + '-ground)');
    s += A.farFields(GROUND - 30, GROUND + 60, W) + A.treeline(GROUND + 46, W, 66, .55);
    s += path('M0,' + (GROUND + 70) + ' C400,' + (GROUND + 50) + ' 900,' + (GROUND + 90) + ' 1300,' + (GROUND + 70) + ' S2000,' + (GROUND + 50) + ' 2400,' + (GROUND + 80) + ' V' + H + ' H0 Z', 'url(#' + id + '-ground)');
    s += rect(0, GROUND + 60, W, H - GROUND - 60, '#fff', ' filter="url(#' + id + '-strokes)" opacity=".9"');
    return s;
  }

  function mountScene(root) {
    var c = A.common(root), here = c.here, id = 'nms' + Math.floor(Math.random() * 1e6);
    if (!PAGE[here]) return;
    var sec = SEC[PAGE[here].section];
    root.classList.add('navmap', 'nma', 'nma-scene');
    root.innerHTML = '';
    root.style.setProperty('--s-ink', sec.ink); root.style.setProperty('--glow', sec.line);
    A.head(root, '', 'Explore around ' + PAGE[here].name, '');
    var stage = h('div', 'nma-stage'); root.appendChild(stage);
    var scroller = h('div', 'nma-scroll'); stage.appendChild(scroller);
    var inner = h('div', 'nma-inner nma-inner--scene'); scroller.appendChild(inner);

    var groups = arrange(here);
    var fy0 = GROUND + 130, fy1 = H - 34, ry = fy0 + (fy1 - fy0) * .62;
    function base(slug) { return (slug === here ? 1.9 : 1.45) * Math.min(1, Math.sqrt(72 / PLACE[slug].r)); }
    function width(slug, k) { return PLACE[slug].r * 2 * k * .92; }
    var GAP = 90, PADG = 70, natural = 0;
    groups.forEach(function (g) { g.w = PADG * 2; g.things.forEach(function (t, i) { g.w += width(t, base(t)) + (i ? 40 : 0); }); g.w = Math.max(g.w, 300); natural += g.w; });
    natural += GAP * (groups.length - 1);
    var k = Math.min(1.35, Math.max(.8, (W - 160) / natural));
    var x = (W - natural * k) / 2, POS = {}, slugs = [];
    var s = '<svg class="nma-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(PAGE[here].name) + ' and the pages around it, in their places in the valley. Arrow keys move between places.">' + A.defs(id);
    s += '<g class="nma-ground">' + setting(id);
    var grounds = '';
    groups.forEach(function (g, gi) {
      var gx0 = x, gx1 = x + g.w * k;
      grounds += ground(g.ground, gx0, gx1, fy0, fy1, 11 + gi);
      var inner0 = g.w * k - PADG * 2 * k, used = 0; g.things.forEach(function (t, i) { used += width(t, base(t) * k) + (i ? 40 * k : 0); });
      var cx = gx0 + PADG * k + (inner0 - used) / 2;
      g.things.forEach(function (t, i) {
        var kk = base(t) * k, w = width(t, kk);
        var far = (g.things.length > 2 && i % 2 === 1 && t !== here);
        POS[t] = [cx + w / 2, far ? ry - 14 : ry + 52, far ? kk * .9 : kk];
        slugs.push(t);
        cx += w + 40 * k;
      });
      x = gx1 + GAP * k;
    });
    s += A.roadPath('M-20,' + (ry + 20) + ' C400,' + (ry + 30) + ' 800,' + (ry - 10) + ' 1200,' + ry + ' S2000,' + (ry + 30) + ' 2420,' + (ry + 10), 44);
    s += grounds;
    s += A.tree(60, fy0 + 40, 1.15, 2) + A.tree(2350, fy0 + 60, 1.1) + A.bush(36, H - 30, 1.1) + A.bush(2372, H - 24, 1.0) + A.tuft(600, H - 12) + A.tuft(1500, H - 16) + A.tuft(2000, H - 10);
    s += '</g>';
    s += rect(0, 0, W, H, 'url(#' + id + '-vig)') + '</g>';

    var order = slugs.slice().sort(function (a, b) { return POS[a][1] - POS[b][1]; });
    var hp = POS[here];
    s += '<g class="nma-pools">' + ell(hp[0], hp[1] + 6, PLACE[here].r * hp[2] * 1.15, PLACE[here].r * hp[2] * .3, C.white, ' opacity=".28"') + ell(hp[0], hp[1] + 6, PLACE[here].r * hp[2] * .8, PLACE[here].r * hp[2] * .2, C.white, ' opacity=".22"') + '</g>';
    s += '<g class="nma-places" filter="url(#' + id + '-brush)">';
    order.forEach(function (slug) {
      var p = POS[slug];
      if (slug === here) s += '<a aria-current="page" tabindex="0" aria-label="' + esc(PAGE[slug].name) + '">' + A.placeGroup(slug, p[0], p[1], p[2], 'nma-is-here') + '</a>';
      else s += '<a href="' + c.href(slug) + '" aria-label="' + esc(PAGE[slug].name) + '">' + A.placeGroup(slug, p[0], p[1], p[2], '') + '</a>';
    });
    s += '</g>';
    s += '<rect class="nma-dusk" x="0" y="0" width="' + W + '" height="' + H + '"/>';
    s += '<g class="nma-litlayer" filter="url(#' + id + '-brush)"></g>';
    s += A.beacon(hp[0], hp[1] - PLACE[here].r * 1.3 * hp[2] - 6, sec.ink);
    s += '<rect class="nma-paper" x="0" y="0" width="' + W + '" height="' + H + '" filter="url(#' + id + '-grain)"/>';
    s += '<g class="nma-tags">'; slugs.forEach(function (slug) { s += A.tagFor(slug, here); }); s += '</g>';
    s += '</svg>';
    inner.innerHTML = s;
    var svg = inner.querySelector('svg');
    var places = {}; inner.querySelectorAll('.nma-place').forEach(function (gg) { places[gg.getAttribute('data-page')] = gg; });
    var light = A.lighting(svg, places, order, svg.querySelector('.nma-places'), svg.querySelector('.nma-litlayer'));
    A.layoutTags(svg, function (slug) { var p = POS[slug]; var up = slug === here ? 66 : 18; return [p[0], p[1] - PLACE[slug].r * 1.35 * p[2] - up, p[1] - PLACE[slug].r * 1.1 * p[2] - (slug === here ? 50 : 0)]; }, slugs);

    function tagOf(slug) { return svg.querySelector('.nma-tag[data-for="' + slug + '"]'); }
    function lit(slug, on) {
      if (on) {
        root.setAttribute('data-lit', slug);
        light.lift(slug === here ? [here] : [here, slug]);
        places[slug].parentNode.classList.add('nma-active');
        tagOf(slug).classList.add('nma-show'); tagOf(here).classList.add('nma-show');
      } else {
        root.removeAttribute('data-lit');
        light.drop();
        tagOf(slug).classList.remove('nma-show'); tagOf(here).classList.remove('nma-show');
      }
    }
    var touch = window.matchMedia('(hover: none)').matches, viaTouch = false, armed = null;
    svg.addEventListener('pointerdown', function (e) { viaTouch = e.pointerType !== 'mouse'; }, true);
    function placeOf(t) { var a = t && t.closest ? t.closest('a') : null; var gg = a && a.querySelector('.nma-place'); return gg ? gg.getAttribute('data-page') : null; }
    svg.addEventListener('pointerover', function (e) { if (touch || viaTouch) return; var kx = placeOf(e.target); if (kx) lit(kx, true); });
    svg.addEventListener('pointerout', function (e) { if (touch || viaTouch) return; var kx = placeOf(e.target); if (kx && !placeOf(e.relatedTarget)) lit(kx, false); });
    svg.addEventListener('focusin', function (e) { var kx = placeOf(e.target); if (kx) lit(kx, true); });
    svg.addEventListener('focusout', function (e) { var kx = placeOf(e.target); if (kx && !placeOf(e.relatedTarget)) lit(kx, false); });
    svg.addEventListener('click', function (e) {
      var kx = placeOf(e.target); if (!kx) return;
      if (kx === here) { e.preventDefault(); return; }
      if ((touch || viaTouch) && armed !== kx) { e.preventDefault(); if (armed) lit(armed, false); armed = kx; lit(kx, true); return; }
      if (c.local) { e.preventDefault(); root.dispatchEvent(new CustomEvent('navmap:go', { detail: kx, bubbles: true })); }
    });
    A.keyboard(svg, places, (function () { var o = {}; slugs.forEach(function (kx) { o[kx] = POS[kx][0]; }); return o; })(), function () { if (armed) { lit(armed, false); armed = null; } });
    document.addEventListener('click', function (e) { if (armed && !root.contains(e.target)) { lit(armed, false); armed = null; } });

    // the page's own thing lights up the first time the scene comes into view
    if (!REDUCED && 'IntersectionObserver' in window) {
      root.classList.add('nma-waiting');
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        root.classList.remove('nma-waiting'); root.classList.add('nma-arrive');
      }, { threshold: 0.45 });
      io.observe(scroller);
    }
    if (scroller.scrollWidth > scroller.clientWidth + 4) scroller.scrollLeft = hp[0] / W * scroller.scrollWidth - scroller.clientWidth / 2;
  }

  window.NavMapScene = { mount: mountScene, zones: ZONES, pairs: PAIR, arrange: arrange };
  function init() {
    var all = document.querySelectorAll('section.navmap[data-art="scene"]');
    for (var i = 0; i < all.length; i++) if (!all[i].hasAttribute('data-manual')) mountScene(all[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
