/* ReLEAF navigation map, the painted version.

   One valley, painted in the manner of the homepage's vision painting: flat
   shapes in two or three tones, a dry-brush edge, the olive / ochre / lime /
   blue-grey palette, one sun high on the right so every thing has a lit side
   and a shadow falling to the lower left. Every page of the wiki is a place in
   it, and the valley reads left to right as the project does:

     the village (Team) · the lab (Wet Lab) · the studio (Dry Lab) ·
     the yard where the machine is built (Project) · the field (Plants) ·
     the town (Engagement)

   Each zone is a real place: the lab and the studio are open pavilions with
   their benches under one roof, the yard is a gravelled square, the town has a
   paved plaza. One road joins them; the river crosses between the yard and the
   field. Pointing at a place turns the valley to dusk and lights that place and
   the places it links to, the way the reactors light the fields on the
   homepage.

   Two pictures share the same place drawings:
     <section class="navmap" data-art="all"></section>    the whole valley
     <section class="navmap" data-art="page"></section>   the page you are on,
         large in the middle of a road, the places it builds on down the road to
         the left, the places it leads to down the road to the right, each with
         a signpost saying why.

   Needs navmap-data.js. Everything here is vector, drawn in code, AI-assisted
   after the student painting; nothing is fetched. */
(function () {
  'use strict';
  var D = window.NAVMAP_DATA;
  if (!D) return;
  var SEC = {}, PAGE = {}, ORDER = [];
  D.sections.forEach(function (s) { SEC[s.id] = s; });
  D.pages.forEach(function (p) { PAGE[p.slug] = p; ORDER.push(p.slug); });

  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/[^/]*$/, '') : '';
  var ROOT = BASE.replace(/assets\/navmap\/$/, '');

  /* ---- the palette, sampled from her painting ---- */
  var C = {
    skyTop: '#cfdfe3', skyMid: '#e9ecd9', skyLow: '#f6ecc9', sunHaze: '#fbe9b0', sun: '#fff8e1',
    mtFar: '#8ea3ab', mtFar2: '#7b929b', mtMid: '#55707a', mtMid2: '#46606b', mtNear: '#2f5347', mtNearLit: '#4f8358', mtNearLit2: '#79a86c', mist: '#dfe6dc',
    ridge: '#4e7a4f', ridgeLit: '#6d9a5e', ridgeDark: '#365c3e',
    plain: '#a9b06c', plain2: '#9ca85f', plainDeep: '#8f9c56', plainLight: '#bcc07f', grass: '#8fa857',
    lime: '#95ab42', lime2: '#adbf57', yellow: '#dccc48', olive: '#93a35c', olive2: '#a6b46e', ochre: '#c2aa6d', ochre2: '#cfbb84', soil: '#7d5c2c', soil2: '#946f3a', paddy: '#c7d1c1', paddy2: '#b3c4b8', hedge: '#4c7a46',
    road: '#cdb784', road2: '#bea775', roadEdge: '#ad9566', gravel: '#c9c0a3', gravel2: '#b9b094', pave: '#d8d2bd', pave2: '#c8c1aa', lawn: '#9fb85c',
    river: '#7ea7b2', riverLight: '#b3cfd2', riverDeep: '#6a93a0', bank: '#b9b480',
    wall: '#efe6cc', wallShade: '#d8cdaa', wallDeep: '#c4b893', roof: '#b5583b', roofShade: '#8e4230', roofLit: '#c9705a', roofBlue: '#4d6d9e', roofBlueShade: '#3a5680', roofGreen: '#3f6b4e', roofGreenShade: '#2f5340', roofGreenLit: '#52825e',
    tree: '#3f7f4a', treeLit: '#62a05a', treeDeep: '#2d6239', trunk: '#6b4a2a', trunk2: '#55391f',
    skin: '#e9c39a', skinShade: '#d2a67c', hair: '#3a2a1e', hat: '#dcc67f', hatShade: '#bfa75f', shirtB: '#4b6aa0', shirtR: '#c84b3a', shirtW: '#f3efe3', shirtG: '#3f7f4a', shirtY: '#d9b24a', pants: '#3a4a6a', pants2: '#5c5c66',
    glass: '#d6e8df', glassShade: '#b9d1c6', glassLit: '#eef7f1', liquid: '#7fd05a', liquidDeep: '#55a93d', metal: '#9aa2a8', metalShade: '#6f777e', metalLit: '#c6ccd0', steel: '#7d868d',
    wood: '#8e6d3c', woodShade: '#6f5330', woodLit: '#b68d50', paper: '#f7f3e6', paperShade: '#e6dfc9', ink: '#2b2b2b', ink2: '#4c4c4c', slate: '#2f3d44',
    green: '#4a8a4a', greenDeep: '#376f3a', leaf: '#6fb352', leafLit: '#9bd36e', red: '#c84b3a', blue: '#4b6aa0', gold: '#dcab3b', goldShade: '#b58a2a', white: '#f7f4ea', cream: '#f2e9c9',
    shadow: '#28351f', signal: '#8ddc5a'
  };

  /* ---- a tiny string-building vector kit ---- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pts(a) { return a.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' '); }
  function poly(a, fill, extra) { return '<polygon points="' + pts(a) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function ell(cx, cy, rx, ry, fill, extra) { return '<ellipse cx="' + r1(cx) + '" cy="' + r1(cy) + '" rx="' + r1(rx) + '" ry="' + r1(ry) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function circ(cx, cy, r, fill, extra) { return '<circle cx="' + r1(cx) + '" cy="' + r1(cy) + '" r="' + r1(r) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function rect(x, y, w, h, fill, r, extra) { if (typeof r === 'string') { extra = r; r = 0; } return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '"' + (r ? ' rx="' + r + '"' : '') + ' fill="' + fill + '"' + (extra || '') + '/>'; }
  function line(a, w, col, extra) { return '<polyline points="' + pts(a) + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>'; }
  function stroke(d, w, col, extra) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>'; }
  function mul(extra) { return ' style="mix-blend-mode:multiply"' + (extra || ''); }
  // the shadow a thing casts on the ground: the sun is high on the right, so it lies to the lower left
  function cast(w, h, a) { return poly([[-w * .55, 2], [w * .5, 2], [w * .15 - w * .9, 2 + h * .3], [-w * .55 - w * .8, 2 + h * .3]], C.shadow, ' opacity="' + (a || .2) + '"' + mul()); }
  function pool(cx, cy, rx, ry, a) { return ell(cx, cy, rx, ry, C.shadow, ' opacity="' + (a || .16) + '"' + mul()); }
  function at(x, y, s, inner) { return '<g transform="translate(' + r1(x) + ',' + r1(y) + ')' + (s && s !== 1 ? ' scale(' + s + ')' : '') + '">' + inner + '</g>'; }
  var seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  function jitter(a, k) { return a.map(function (p) { return [p[0] + (rnd() - 0.5) * k, p[1] + (rnd() - 0.5) * k]; }); }
  // a closed shape whose top edge runs smoothly through the points (Catmull-Rom as cubics); the first and last points are the base corners
  function ridge(a, fill, extra) {
    var d = 'M' + r1(a[0][0]) + ',' + r1(a[0][1]) + ' L' + r1(a[1][0]) + ',' + r1(a[1][1]);
    for (var i = 1; i < a.length - 2; i++) {
      var p0 = a[i - 1], p1 = a[i], p2 = a[i + 1], p3 = a[i + 2];
      d += ' C' + r1(p1[0] + (p2[0] - p0[0]) / 6) + ',' + r1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + r1(p2[0] - (p3[0] - p1[0]) / 6) + ',' + r1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + r1(p2[0]) + ',' + r1(p2[1]);
    }
    d += ' L' + r1(a[a.length - 1][0]) + ',' + r1(a[a.length - 1][1]) + ' Z';
    return path(d, fill, extra);
  }
  // a box seen from the front and a little from the right, the lit side on the right
  function prism(x, y, w, h, d, front, side, top) {
    return poly([[x, y], [x + w, y], [x + w, y - h], [x, y - h]], front) +
      poly([[x + w, y], [x + w + d, y - d * .6], [x + w + d, y - h - d * .6], [x + w, y - h]], side) +
      (top ? poly([[x, y - h], [x + w, y - h], [x + w + d, y - h - d * .6], [x + d, y - h - d * .6]], top) : '');
  }
  function gable(x, y, w, h, d, col, shade, lit) {
    return poly([[x - 4, y], [x + w / 2, y - h], [x + w + 4, y]], shade) +
      poly([[x + w / 2, y - h], [x + w / 2 + d, y - h - d * .6], [x + w + d + 4, y - d * .6], [x + w + 4, y]], lit) +
      poly([[x - 4, y], [x + w / 2, y - h], [x + w / 2 + d, y - h - d * .6], [x + d - 4, y - d * .6]], col);
  }
  function win(x, y, w, h, lit) { return rect(x, y, w, h, lit ? C.cream : C.riverLight, 1) + rect(x, y, w, 2, C.wallDeep) + rect(x + w / 2 - .6, y, 1.2, h, C.wallDeep); }

  /* ---- shared small things ---- */
  function tree(x, y, s, tone) {
    s = s || 1; var a = tone === 2 ? C.treeDeep : C.tree, b = tone === 2 ? C.tree : C.treeLit;
    return at(x, y, s, pool(-6, 2, 16, 5) + rect(-2.5, -15, 5, 16, C.trunk, 1) + circ(-6, -22, 11, a) + circ(6, -20, 11, a) + circ(0, -29, 11, a) + circ(4, -26, 8, b) + circ(9, -18, 5, b));
  }
  function pine(x, y, s) {
    s = s || 1;
    return at(x, y, s, pool(-4, 2, 9, 3) + rect(-2, -10, 4, 11, C.trunk2) + poly([[0, -44], [-11, -22], [11, -22]], C.treeDeep) + poly([[0, -36], [-13, -12], [13, -12]], C.tree) + poly([[0, -36], [13, -12], [2, -12]], C.treeLit, ' opacity=".55"'));
  }
  function bush(x, y, s) { s = s || 1; return at(x, y, s, pool(-3, 1, 12, 3) + circ(-6, -6, 7, C.tree) + circ(6, -6, 7, C.tree) + circ(0, -10, 7, C.treeLit)); }
  function person(x, y, s, shirt, hat, flip, pants) {
    s = s || 1; var sh = shirt || C.shirtB, pa = pants || C.pants;
    var b = pool(-3, 1, 8, 2.5) +
      rect(-6, -14, 5, 14, pa, 1) + rect(1, -14, 5, 14, pa, 1) + rect(-6, -2, 5, 3, C.ink2, 1) + rect(1, -2, 5, 3, C.ink2, 1) +
      path('M-7,-30 h14 v17 h-14 z', sh) + rect(-7, -30, 4, 17, C.ink, 1, ' opacity=".14"') + rect(-10, -29, 4, 13, sh, 2) + rect(6, -29, 4, 13, sh, 2) + circ(-8, -16, 2, C.skin) + circ(8, -16, 2, C.skin) +
      circ(0, -36, 6, C.skin) + path('M-6,-37 a6,6 0 0 1 12,0 v1 h-12 z', C.hair);
    if (hat) b += path('M-12,-39 L0,-50 L12,-39 Z', C.hat) + path('M0,-50 L12,-39 L4,-39 Z', C.hatShade) + rect(-13, -40, 26, 3, C.hatShade, 1);
    return at(x, y, s, (flip ? '<g transform="scale(-1,1)">' + b + '</g>' : b));
  }
  function house(x, y, s, roof, shade, blue) {
    s = s || 1; roof = roof || C.roof; shade = shade || C.roofShade;
    return at(x, y, s, cast(60, 50, .18) +
      prism(-26, 0, 52, 28, 14, C.wall, C.wallShade) +
      gable(-26, -28, 52, 20, 14, roof, shade, blue ? C.roofBlue : C.roofLit) +
      rect(-7, -16, 14, 16, C.woodShade, 1) + rect(-5, -14, 10, 14, C.wood, 1) + win(-21, -22, 9, 8) + win(12, -22, 9, 8) +
      rect(10, -48, 5, 12, C.wallDeep));
  }
  function flask(x, y, s, col) {
    s = s || 1; col = col || C.liquid;
    return at(x, y, s, path('M-4,-26 h8 v10 l9,16 h-26 l9,-16 z', C.glass) + path('M-9,-6 h18 l4,6 h-26 z', col) + path('M4,-26 v10 l9,16 h-6 l-7,-14 v-12 z', C.glassLit, ' opacity=".7"') + rect(-5, -28, 10, 3, C.glassShade, 1));
  }
  function beaker(x, y, s, col) {
    s = s || 1; col = col || C.blue;
    return at(x, y, s, rect(-8, -22, 16, 22, C.glass, 2) + rect(-8, -11, 16, 11, col, 1) + rect(4, -21, 3, 20, C.glassLit, 1, ' opacity=".7"') + rect(-9, -23, 18, 3, C.glassShade, 1));
  }
  function pot(x, y, s) { s = s || 1; return at(x, y, s, path('M-7,0 l-2,-12 h18 l-2,12 z', C.roof) + rect(-10, -14, 20, 3, C.roofLit, 1) + path('M0,-13 c-6,-6 -10,-14 -4,-20 c4,6 4,12 4,20 c0,-10 2,-18 8,-20 c2,8 -2,16 -8,20 z', C.leaf)); }
  function fence(x, y, n, gap) { var s = ''; for (var i = 0; i < n; i++) s += rect(x + i * gap, y - 16, 4, 16, C.wood, 1) + rect(x + i * gap, y - 16, 1.5, 16, C.woodLit); s += rect(x - 2, y - 12, (n - 1) * gap + 8, 2.5, C.woodShade) + rect(x - 2, y - 6, (n - 1) * gap + 8, 2.5, C.woodShade); return s; }
  function hay(x, y, s) { s = s || 1; return at(x, y, s, pool(-4, 1, 14, 4) + ell(0, -8, 13, 9, C.ochre) + ell(2, -10, 9, 6, C.ochre2) + stroke('M-10,-6 q10,-3 20,0', 1.5, C.goldShade)); }

  /* ---- the 27 places. Each stands on (0,0) facing the reader; r = reach, for the hit area and the tag ---- */
  var PLACE = {};
  PLACE.team = { r: 80, draw: function () {
    return house(-52, -6, .82, C.roof, C.roofShade) + house(44, -12, .74, C.roofBlue, C.roofBlueShade, true) + house(-2, 8, .9, C.roof, C.roofShade) +
      tree(-92, 0, .85, 2) + tree(86, 8, .75) + bush(26, 20, .7) +
      person(-22, 40, .85, C.shirtG) + person(10, 44, .85, C.shirtW, false, true) + person(38, 38, .8, C.shirtB) + person(-50, 36, .75, C.shirtY, false, true);
  } };
  PLACE.milestones = { r: 50, draw: function () {
    var f = pool(-6, 2, 22, 6) + circ(0, -2, 15, C.gravel2) + circ(-1, -4, 11, C.gravel) + rect(-2.5, -96, 5, 94, C.woodShade) + rect(-2.5, -96, 2, 94, C.woodLit);
    [[-92, C.red], [-76, C.gold], [-60, C.blue], [-44, C.leaf]].forEach(function (p) { f += poly([[2.5, p[0]], [28, p[0] + 6], [2.5, p[0] + 13]], p[1]) + poly([[2.5, p[0] + 6], [28, p[0] + 6], [2.5, p[0] + 13]], C.ink, ' opacity=".12"'); });
    return f + circ(0, -98, 4.5, C.gold) + rect(-14, -8, 28, 6, C.paper, 1) + line([[-10, -5], [10, -5]], 1, C.ink2);
  } };
  PLACE.attributions = { r: 50, draw: function () {
    var f = cast(70, 60, .16) + rect(-31, -64, 5, 64, C.woodShade) + rect(-31, -64, 2, 64, C.woodLit) + rect(26, -64, 5, 64, C.woodShade) + rect(26, -64, 2, 64, C.woodLit) +
      rect(-38, -68, 76, 46, C.woodShade, 3) + rect(-35, -65, 70, 40, C.ochre2, 2) + rect(-35, -65, 70, 3, C.ochre, 1);
    [[-30, -60, 18, 14], [-9, -60, 14, 20], [8, -60, 18, 12], [-30, -43, 22, 13], [6, -45, 20, 15]].forEach(function (p) { f += rect(p[0] + 1, p[1] + 1, p[2], p[3], C.ink, 1, ' opacity=".12"') + rect(p[0], p[1], p[2], p[3], C.paper, 1) + line([[p[0] + 3, p[1] + 4], [p[0] + p[2] - 3, p[1] + 4]], 1, C.ink2, ' opacity=".5"') + line([[p[0] + 3, p[1] + 7], [p[0] + p[2] - 5, p[1] + 7]], 1, C.ink2, ' opacity=".35"'); });
    f += circ(-21, -59, 2, C.red) + circ(-2, -59, 2, C.blue) + circ(17, -59, 2, C.gold) + circ(-19, -42, 2, C.gold) + circ(16, -44, 2, C.red);
    return f + poly([[-40, -68], [0, -82], [40, -68]], C.roofGreenShade) + poly([[0, -82], [40, -68], [28, -68], [0, -78]], C.roofGreenLit);
  } };
  PLACE.description = { r: 74, draw: function () {
    return cast(120, 70, .16) + rect(-52, -72, 7, 72, C.woodShade) + rect(-52, -72, 3, 72, C.woodLit) + rect(45, -72, 7, 72, C.woodShade) + rect(45, -72, 3, 72, C.woodLit) +
      rect(-64, -82, 128, 50, C.greenDeep, 7) + rect(-60, -78, 120, 42, C.green, 5) + rect(-60, -78, 120, 4, C.leaf, 2, ' opacity=".5"') +
      path('M-18,-44 c8,-28 34,-34 52,-30 c-6,22 -26,36 -52,30 z', C.leafLit) + path('M-18,-44 c8,-28 34,-34 52,-30 c-20,2 -36,12 -52,30 z', C.leaf) + stroke('M-14,-46 L30,-70', 2.5, C.greenDeep) +
      stroke('M-46,-62 h18 M-46,-52 h14', 3, C.leaf, ' opacity=".55"') +
      pot(-72, 0, 1) + pot(72, 0, 1) + bush(-90, 8, .8) + tree(92, 2, .7, 1);
  } };
  PLACE.biomanufacturing = { r: 92, draw: function () {
    var f = cast(180, 90, .2) + prism(-86, 0, 172, 56, 22, C.wallShade, C.wallDeep) + rect(-86, -56, 172, 56, C.wall) + rect(-86, -14, 172, 14, C.wallShade);
    f += poly([[-90, -56], [-46, -86], [-2, -56]], C.roofGreen) + poly([[-46, -86], [-2, -56], [-14, -56], [-46, -78]], C.roofGreenLit) + poly([[-2, -56], [42, -86], [86, -56]], C.roofGreen) + poly([[42, -86], [86, -56], [74, -56], [42, -78]], C.roofGreenLit) +
      poly([[86, -56], [108, -69], [64, -99], [42, -86]], C.roofGreenShade) +
      rect(52, -112, 11, 56, C.metalShade) + rect(52, -112, 4, 56, C.metal) + rect(49, -114, 17, 4, C.metalLit);
    [-62, -16, 30].forEach(function (x) { f += rect(x, -46, 30, 44, C.greenDeep, 4) + rect(x + 3, -43, 24, 38, C.green, 3) + rect(x + 6, -39, 18, 26, C.glass, 2) + rect(x + 6, -26, 18, 13, C.liquid, 1) + rect(x + 19, -38, 4, 24, C.glassLit, 1, ' opacity=".6"') + rect(x + 4, -50, 22, 5, C.metal, 1) + circ(x + 15, -8, 1.8, C.signal); });
    return f + ell(58, -122, 10, 5, C.white, ' opacity=".85"') + ell(68, -131, 8, 4, C.white, ' opacity=".6"') + ell(80, -138, 6, 3, C.white, ' opacity=".4"') + fence(-100, 6, 3, 10) + fence(100, 6, 3, 10);
  } };
  PLACE.engineering = { r: 64, draw: function () {
    var gear = function (cx, cy, R, col, dark) {
      var s = ''; for (var i = 0; i < 8; i++) s += rect(-5, -R - 6, 10, 10, col, 2, ' transform="translate(' + cx + ',' + cy + ') rotate(' + (i * 45) + ')"');
      return s + circ(cx, cy, R, col) + circ(cx, cy, R * .62, dark) + circ(cx, cy, R * .3, C.wallShade);
    };
    return cast(110, 70, .18) + prism(-52, 0, 104, 10, 12, C.wood, C.woodShade, C.woodLit) + rect(-48, -4, 96, 4, C.woodShade) +
      rect(-50, -34, 10, 24, C.woodShade) + rect(42, -34, 10, 24, C.woodShade) + rect(-48, -34, 4, 24, C.wood) + rect(44, -34, 4, 24, C.wood) +
      gear(-16, -62, 17, C.metal, C.metalShade) + gear(16, -50, 11, C.metalLit, C.metal) +
      line([[28, -40], [46, -78]], 6, C.metalShade) + circ(47, -81, 7, C.metalShade) + circ(47, -81, 3, C.wallShade) + line([[29, -40], [45, -76]], 2, C.metalLit) +
      stroke('M-46,-90 a18,18 0 1 1 8,14', 4.5, C.green) + poly([[-42, -68], [-30, -76], [-28, -62]], C.green) +
      rect(-36, -22, 12, 12, C.red, 2) + rect(-20, -22, 10, 12, C.blue, 2) + rect(-6, -20, 16, 10, C.gold, 2);
  } };
  PLACE.development = { r: 68, draw: function () {
    var f = cast(130, 80, .18);
    [[-60, 0, 32, 16], [-30, -16, 32, 34], [0, -34, 32, 52], [30, -52, 32, 70]].forEach(function (s, i) {
      f += prism(s[0], s[1], s[2], s[3], 10, i % 2 ? C.ochre : C.ochre2, C.goldShade, C.cream) + rect(s[0], s[1] - s[3], s[2], 3, C.white, 1, ' opacity=".5"');
      for (var d = 0; d <= i; d++) f += circ(s[0] + 16 + (d - i / 2) * 7, s[1] - 7, 2.2, C.goldShade);
    });
    f += rect(44, -126, 3.5, 56, C.woodShade) + rect(44, -126, 1.5, 56, C.woodLit) + poly([[47.5, -126], [74, -117], [47.5, -108]], C.leaf) + poly([[47.5, -117], [74, -117], [47.5, -108]], C.green);
    return f + person(-44, 0, .8, C.shirtB) + person(16, -34, .8, C.shirtR, false, true) + bush(-78, 6, .7);
  } };
  PLACE.contribution = { r: 52, draw: function () {
    return cast(90, 50, .18) + prism(-36, 0, 72, 28, 10, C.roof, C.roofShade) + rect(-38, -32, 76, 8, C.roofLit, 2) + rect(-38, -32, 76, 2, C.cream, 1, ' opacity=".5"') +
      path('M-34,-32 l6,-18 h56 l6,18 z', C.roofShade) + path('M-30,-33 l5,-15 h50 l5,15 z', C.roof) + rect(-9, -39, 18, 6, C.woodShade, 2) + rect(-9, -39, 18, 2, C.woodLit, 1) +
      line([[-18, -33], [-18, -58]], 4.5, C.metalShade) + rect(-25, -66, 14, 10, C.metalShade, 2) + rect(-25, -66, 14, 3, C.metalLit, 1) +
      line([[2, -33], [11, -56]], 4.5, C.woodShade) + poly([[7, -54], [20, -62], [18, -52]], C.metal) +
      circ(24, -42, 7.5, C.gold) + circ(24, -42, 3.2, C.roofShade) + rect(-30, -22, 20, 8, C.gold, 1) + rect(8, -20, 24, 6, C.leaf, 1) + rect(-28, -12, 14, 5, C.blue, 1) + circ(14, -10, 3.5, C.cream) + circ(24, -10, 3.5, C.cream);
  } };
  PLACE.results = { r: 56, draw: function () {
    var f = cast(84, 90, .16) + rect(-31, -62, 5, 62, C.woodShade) + rect(-31, -62, 2, 62, C.woodLit) + rect(26, -62, 5, 62, C.woodShade) + rect(26, -62, 2, 62, C.woodLit) +
      rect(-42, -100, 84, 46, C.woodShade, 3) + rect(-39, -97, 78, 40, C.paper, 2) + rect(-39, -97, 78, 3, C.paperShade, 1);
    [[-30, 14, C.ochre], [-18, 24, C.lime], [-6, 32, C.leaf], [6, 22, C.lime], [18, 36, C.green]].forEach(function (b) { f += rect(b[0], -64 - b[1], 10, b[1], b[2], 1) + rect(b[0] + 7, -64 - b[1], 3, b[1], C.ink, 1, ' opacity=".12"'); });
    return f + line([[-35, -64], [35, -64]], 1.5, C.ink2) + stroke('M-30,-80 L-16,-86 L-4,-92 L10,-86 L24,-96', 1.5, C.red, ' stroke-dasharray="3 2"') + pot(-46, 2, .8);
  } };
  PLACE.experiments = { r: 64, draw: function () {
    return cast(120, 70, .18) + prism(-58, -26, 116, 10, 12, C.wallShade, C.wallDeep, C.wall) + rect(-54, -26, 7, 26, C.metalShade) + rect(-54, -26, 3, 26, C.metal) + rect(47, -26, 7, 26, C.metalShade) + rect(47, -26, 3, 26, C.metal) +
      rect(-50, -20, 100, 3, C.metalShade) +
      flask(-36, -36, 1, C.liquid) + beaker(-6, -36, 1, C.blue) + flask(24, -36, .8, C.gold) +
      rect(36, -54, 16, 18, C.metal, 2) + rect(36, -54, 16, 4, C.metalLit, 1) + rect(39, -48, 10, 6, C.liquid, 1) + circ(44, -39, 1.5, C.red) +
      rect(-22, -74, 60, 4, C.metalShade, 1) + rect(-22, -74, 4, 38, C.metalShade) + rect(-22, -74, 60, 1.5, C.metalLit) + ell(10, -66, 10, 4, C.white, ' opacity=".6"') + ell(16, -60, 6, 3, C.white, ' opacity=".4"') +
      rect(-54, -30, 12, 4, C.paper, 1) + rect(-12, -30, 20, 3, C.red, 1);
  } };
  PLACE.parts = { r: 56, draw: function () {
    var f = cast(90, 60, .18) + prism(-44, -22, 88, 8, 10, C.wood, C.woodShade, C.woodLit) + rect(-40, -22, 7, 22, C.woodShade) + rect(33, -22, 7, 22, C.woodShade) +
      rect(-42, -48, 54, 18, C.metalShade, 3) + rect(-42, -48, 54, 4, C.metal, 1);
    for (var i = 0; i < 7; i++) f += rect(-38 + i * 7.4, -60, 5, 16, [C.liquid, C.blue, C.gold, C.red][i % 4], 2) + rect(-38 + i * 7.4, -61, 5, 3, C.glassShade, 1);
    f += circ(28, -64, 18, C.paper) + circ(28, -64, 14, 'none', ' stroke="' + C.greenDeep + '" stroke-width="3.5" stroke-dasharray="8 4"') + circ(28, -64, 6, C.leaf) + rect(12, -46, 32, 4, C.woodShade, 1) + stroke('M28,-78 l0,-6', 2, C.red);
    return f + rect(-30, -28, 10, 6, C.paper, 1) + rect(-16, -28, 14, 6, C.paper, 1);
  } };
  PLACE.plant = { r: 116, draw: function () {
    var f = pool(-10, 8, 128, 22, .14) + poly([[-120, 0], [120, 0], [98, -64], [-98, -64]], C.soil) + poly([[-112, -4], [112, -4], [94, -60], [-94, -60]], C.soil2, ' opacity=".55"');
    for (var r = 0; r < 4; r++) {
      var y = -10 - r * 14, w = 110 - r * 7;
      f += line([[-w, y], [w, y]], 2.5, C.soil, ' opacity=".9"') + line([[-w, y + 4], [w, y + 4]], 1, C.ochre, ' opacity=".35"');
      for (var i = -5; i <= 5; i++) { var x = i * (w / 5.4); f += line([[x, y], [x, y - 10]], 1.8, C.greenDeep) + path('M' + x + ',' + (y - 4) + ' c-8,-2 -12,-8 -10,-12 c6,2 9,6 10,12 z', C.leaf) + path('M' + x + ',' + (y - 4) + ' c8,-2 12,-8 10,-12 c-6,2 -9,6 -10,12 z', C.leafLit) + path('M' + x + ',' + (y - 8) + ' c-4,-4 -4,-10 0,-12 c4,2 4,8 0,12 z', C.leaf); }
    }
    f += rect(-2, -84, 3, 46, C.woodShade) + rect(-30, -70, 56, 4, C.woodShade) + poly([[-6, -80], [8, -80], [12, -60], [-10, -60]], C.shirtR) + circ(1, -86, 6, C.hat) + path('M-10,-86 L1,-96 L12,-86 Z', C.hat);
    return f + person(-100, 6, .95, C.shirtB, true) + person(104, -4, .9, C.shirtR, true, true) + pine(-134, -40, .85) + tree(140, -34, .85, 1) + hay(-126, 6, .9);
  } };
  PLACE.measurement = { r: 74, draw: function () {
    // the bench: photometer with its dial, the LED on an arm throwing a cone of light through the cuvette, a rack of cuvettes, the calibration card
    return cast(140, 80, .18) + prism(-66, -22, 132, 9, 12, C.wallShade, C.wallDeep, C.wall) + rect(-62, -22, 8, 22, C.metalShade) + rect(-62, -22, 3, 22, C.metal) + rect(54, -22, 8, 22, C.metalShade) + rect(54, -22, 3, 22, C.metal) + rect(-60, -16, 120, 3, C.metalShade) +
      // the photometer
      prism(-58, -31, 48, 40, 9, C.metal, C.metalShade, C.metalLit) + rect(-54, -66, 40, 24, C.slate, 3) + stroke('M-47,-47 a13,13 0 0 1 26,0', 2.5, C.signal) + line([[-34, -47], [-27, -58]], 2, C.red) + circ(-34, -47, 2, C.white) +
      circ(-46, -36, 2.6, C.red) + circ(-38, -36, 2.6, C.leaf) + circ(-30, -36, 2.6, C.gold) + rect(-22, -39, 8, 5, C.metalLit, 1) +
      // the LED on its arm, and the cone of light through the cuvette
      rect(26, -92, 4, 60, C.metalShade) + rect(26, -92, 1.5, 60, C.metalLit) + line([[28, -90], [4, -90]], 4, C.metalShade) + rect(-4, -96, 12, 9, C.metal, 2) + rect(-2, -88, 8, 3, C.gold, 1) +
      path('M-2,-85 L-14,-33 L18,-33 Z', C.gold, ' opacity=".22"') + path('M-1,-85 L-8,-33 L10,-33 Z', C.cream, ' opacity=".28"') +
      rect(-5, -58, 12, 26, C.glass, 1.5) + rect(-5, -44, 12, 12, C.blue, 1) + rect(4, -57, 2.5, 24, C.glassLit, 1, ' opacity=".7"') + prism(-9, -31, 20, 4, 3, C.metal, C.metalShade) +
      // the rack of cuvettes and the calibration card
      prism(14, -30, 34, 14, 5, C.wall, C.wallShade, C.cream) + rect(18, -50, 6, 20, C.glass, 1) + rect(18, -40, 6, 10, C.liquid, 1) + rect(27, -50, 6, 20, C.glass, 1) + rect(27, -42, 6, 12, C.gold, 1) + rect(36, -50, 6, 20, C.glass, 1) + rect(36, -38, 6, 8, C.blue, 1) +
      rect(52, -56, 26, 30, C.paper, 2) + stroke('M56,-34 L62,-40 L68,-44 L74,-50', 2, C.greenDeep) + circ(62, -40, 1.8, C.red) + circ(68, -44, 1.8, C.red) + circ(74, -50, 1.8, C.red) + line([[56, -34], [76, -34]], 1, C.ink2) + line([[56, -34], [56, -52]], 1, C.ink2) +
      rect(-30, -27, 14, 3, C.paper, 1) + pot(-78, 2, .8);
  } };
  PLACE['safety-and-security'] = { r: 48, draw: function () {
    return cast(56, 90, .16) + rect(-3.5, -72, 7, 72, C.woodShade) + rect(-3.5, -72, 3, 72, C.woodLit) +
      rect(-30, -96, 60, 42, C.goldShade, 6) + rect(-28, -94, 56, 38, C.gold, 5) + rect(-24, -90, 48, 30, C.white, 3) +
      path('M0,-86 l16,6 v10 c0,10 -8,16 -16,20 c-8,-4 -16,-10 -16,-20 v-10 z', C.green) + path('M0,-86 l16,6 v10 c0,10 -8,16 -16,20 z', C.greenDeep, ' opacity=".35"') + stroke('M-7,-71 l5,5 l10,-11', 3, C.white) +
      prism(-16, -2, 10, 24, 3, C.red, C.roofShade) + rect(-14, -30, 6, 4, C.metalShade, 1) + rect(-13, -22, 4, 10, C.white, 1, ' opacity=".6"') +
      prism(4, 0, 11, 22, 3, C.white, C.paperShade) + rect(6, -16, 7, 7, C.red, 1) + rect(8.5, -15, 2, 5, C.white) + rect(6, -12.5, 7, 2, C.white) +
      bush(-30, 4, .6);
  } };
  PLACE.notebook = { r: 54, draw: function () {
    return cast(90, 50, .18) + prism(-42, -22, 84, 8, 10, C.wood, C.woodShade, C.woodLit) + rect(-38, -22, 7, 22, C.woodShade) + rect(31, -22, 7, 22, C.woodShade) +
      path('M-32,-25 l0,-28 q16,-7 30,0 l0,28 q-14,-7 -30,0 z', C.paperShade) + path('M-2,-25 l0,-28 q16,-7 30,0 l0,28 q-14,-7 -30,0 z', C.paper) + path('M-32,-25 l0,-28 q16,-7 30,0 l0,28 q-14,-7 -30,0 z', C.paper, ' transform="translate(-1,-1)"') + rect(-3, -53, 2, 28, C.wallDeep) +
      line([[-26, -44], [-10, -45]], 1.5, C.ink2) + line([[-26, -39], [-8, -40]], 1.5, C.ink2) + line([[-26, -34], [-12, -35]], 1.5, C.ink2) + line([[6, -44], [22, -45]], 1.5, C.ink2) + line([[6, -39], [20, -40]], 1.5, C.ink2) + rect(8, -34, 14, 6, C.lime2, 1) +
      line([[30, -60], [40, -38]], 3.5, C.gold) + circ(30, -61, 2.2, C.ink) + rect(-44, -30, 8, 8, C.blue, 1) + rect(-44, -34, 8, 3, C.blue, 1) + circ(38, -30, 5, C.white) + circ(38, -30, 3, C.riverLight);
  } };
  PLACE.model = { r: 58, draw: function () {
    return cast(80, 100, .14) + line([[-22, 0], [-7, -72]], 4.5, C.woodShade) + line([[22, 0], [7, -72]], 4.5, C.wood) + line([[0, 0], [0, -76]], 4.5, C.woodShade) + line([[-14, -26], [14, -26]], 3, C.wood) +
      rect(-42, -104, 84, 58, C.woodShade, 3) + rect(-39, -101, 78, 52, C.paper, 2) + rect(-39, -101, 78, 3, C.paperShade, 1) +
      stroke('M-34,-54 C-18,-54 -14,-94 0,-94 C14,-94 18,-54 34,-54', 3.5, C.greenDeep) + line([[-34, -54], [34, -54]], 1.5, C.ink2) + line([[0, -94], [0, -54]], 1, C.ink2, ' stroke-dasharray="3 3"') +
      stroke('M-34,-72 C-18,-72 -14,-84 0,-78 C14,-72 20,-60 34,-64', 2.5, C.gold) + circ(-14, -86, 2.2, C.red) + circ(14, -86, 2.2, C.red) + circ(0, -94, 2.6, C.red) +
      pot(-40, 2, .8);
  } };
  PLACE.hardware = { r: 92, draw: function () {
    // the three instruments: the bioreactor in its green cabinet, the photometer on a side table, the LED rig over a tray of seedlings
    var f = cast(160, 120, .2);
    // the side table with the photometer
    f += prism(-108, -24, 52, 7, 8, C.wood, C.woodShade, C.woodLit) + rect(-104, -24, 6, 24, C.woodShade) + rect(-62, -24, 6, 24, C.woodShade) +
      prism(-100, -31, 36, 30, 7, C.metal, C.metalShade, C.metalLit) + rect(-97, -58, 30, 20, C.slate, 2) + stroke('M-92,-43 a10,10 0 0 1 20,0', 2.2, C.signal) + line([[-82, -43], [-77, -52]], 1.8, C.red) + circ(-91, -34, 2.2, C.red) + circ(-84, -34, 2.2, C.leaf) + circ(-77, -34, 2.2, C.gold);
    // the reactor
    f += prism(-34, 0, 68, 92, 12, C.greenDeep, '#2b5a2e', C.green) + rect(-30, -88, 60, 84, C.green, 4) + rect(-30, -88, 60, 3, C.leaf, 1, ' opacity=".3"') +
      rect(-22, -80, 44, 58, C.glassShade, 5) + rect(-21, -79, 42, 56, C.glass, 5) + rect(-21, -50, 42, 27, C.liquid, 3) + rect(-21, -36, 42, 13, C.liquidDeep, 2, ' opacity=".5"') + rect(12, -78, 6, 54, C.glassLit, 2, ' opacity=".7"') +
      circ(-8, -36, 3, C.white, ' opacity=".7"') + circ(6, -44, 2.5, C.white, ' opacity=".6"') + circ(1, -30, 2, C.white, ' opacity=".7"') + circ(-12, -46, 1.6, C.white, ' opacity=".6"') +
      rect(-26, -98, 52, 10, C.metal, 3) + rect(-26, -98, 52, 3, C.metalLit, 1) + rect(-7, -106, 14, 8, C.metalShade, 2) + line([[0, -80], [0, -36]], 3, C.metalShade) + rect(-9, -38, 18, 4, C.metalShade, 1) + rect(-9, -56, 18, 4, C.metalShade, 1) +
      rect(-12, -18, 24, 10, C.slate, 2) + circ(-6, -13, 2, C.signal) + circ(0, -13, 2, C.gold) + circ(6, -13, 2, C.red) + stroke('M-24,-60 l-6,0 l0,20 l6,0', 3, C.metalShade) +
      line([[30, -70], [50, -70], [50, -20]], 3.5, C.metalShade) + line([[31, -69], [49, -69]], 1, C.metalLit) + rect(45, -22, 10, 16, C.metal, 1) + rect(45, -22, 10, 3, C.metalLit) +
      rect(-30, -120, 26, 18, C.gold, 2) + rect(-30, -120, 26, 2, C.cream, 1, ' opacity=".6"') + circ(-17, -111, 5.5, 'none', ' stroke="' + C.ink + '" stroke-width="2"') + circ(-17, -111, 1.5, C.ink);
    // the LED rig over a tray of seedlings, its light falling on them
    f += rect(104, -96, 4, 92, C.metalShade) + rect(104, -96, 1.5, 92, C.metalLit) + line([[104, -94], [66, -94]], 4, C.metalShade) + rect(62, -100, 44, 8, C.metal, 2) + rect(64, -92, 40, 3, C.gold, 1) +
      path('M64,-89 L52,-26 L116,-26 Z', C.gold, ' opacity=".18"') + path('M66,-89 L60,-26 L108,-26 Z', C.cream, ' opacity=".2"') +
      prism(58, -22, 50, 8, 8, C.wood, C.woodShade, C.woodLit) + rect(62, -22, 6, 22, C.woodShade) + rect(100, -22, 6, 22, C.woodShade) + prism(60, -30, 46, 7, 6, C.soil2, C.soil, C.soil) ;
    [66, 76, 86, 96].forEach(function (x) { f += line([[x, -30], [x, -38]], 1.6, C.greenDeep) + path('M' + x + ',-35 c-5,-1 -8,-5 -7,-8 c4,1 6,4 7,8 z', C.leaf) + path('M' + x + ',-35 c5,-1 8,-5 7,-8 c-4,1 -6,4 -7,8 z', C.leafLit); });
    return f + pot(-122, 2, .7) + rect(-30, -27, 0, 0, C.paper);
  } };
  PLACE.software = { r: 56, draw: function () {
    return cast(80, 90, .14) + rect(-16, -22, 32, 7, C.metalShade, 2) + rect(-16, -22, 32, 2, C.metalLit, 1) + rect(-3.5, -42, 7, 20, C.metalShade) +
      rect(-46, -92, 92, 54, C.metalShade, 6) + rect(-44, -90, 88, 50, C.metal, 5) + rect(-41, -87, 82, 44, C.slate, 3) +
      rect(-36, -82, 22, 8, C.ink2, 1) + rect(-10, -82, 16, 8, C.ink2, 1) + rect(10, -82, 26, 8, C.greenDeep, 1) + circ(31, -78, 2, C.signal) +
      stroke('M-35,-54 l10,-8 l10,4 l12,-14 l10,6 l12,-12', 2.8, C.signal) + stroke('M-35,-60 l12,-2 l10,-6 l12,2 l10,-8 l12,-4', 1.6, C.gold, ' opacity=".8"') + line([[-35, -50], [35, -50]], 1, C.ink2) +
      circ(29, -62, 3, C.signal) + circ(29, -62, 7, 'none', ' stroke="' + C.signal + '" stroke-width="1" opacity=".5"') + rect(-41, -46, 82, 3, C.ink2, ' opacity=".6"') +
      rect(-20, -30, 40, 5, C.paper, 1) + rect(-18, -29, 36, 1.5, C.ink2, ' opacity=".4"');
  } };
  PLACE['protein-design'] = { r: 48, draw: function () {
    var f = cast(44, 110, .14) + ell(0, -4, 22, 8, C.woodShade) + ell(-1, -6, 19, 6, C.wood) + rect(-3.5, -72, 7, 66, C.woodShade) + rect(-3.5, -72, 3, 66, C.woodLit);
    var beads = [[-20, -98, C.red], [-6, -112, C.blue], [10, -106, C.gold], [20, -90, C.leaf], [10, -74, C.blue], [-5, -66, C.red], [-18, -82, C.gold]];
    for (var i = 0; i < beads.length - 1; i++) f += line([beads[i].slice(0, 2), beads[i + 1].slice(0, 2)], 3.5, C.metalShade) + line([beads[i].slice(0, 2), beads[i + 1].slice(0, 2)], 1.2, C.metalLit);
    beads.forEach(function (b) { f += circ(b[0], b[1], 6.5, b[2]) + circ(b[0] + 2, b[1] - 2, 2.2, C.white, ' opacity=".55"'); });
    return f + rect(-14, -2, 28, 4, C.paper, 1);
  } };
  PLACE['drylab-notebook'] = { r: 54, draw: function () {
    return cast(90, 50, .18) + prism(-42, -22, 84, 8, 10, C.wood, C.woodShade, C.woodLit) + rect(-38, -22, 7, 22, C.woodShade) + rect(31, -22, 7, 22, C.woodShade) +
      path('M-30,-26 l6,-32 h50 l-6,32 z', C.metalShade) + path('M-25,-29 l5,-26 h42 l-5,26 z', C.slate) + stroke('M-18,-44 l6,-4 l6,3 l8,-7 l8,3 l6,-5', 2, C.signal) + rect(-19, -52, 14, 3, C.ink2, 1) +
      rect(-36, -26, 64, 5, C.metal, 1) + rect(-36, -26, 64, 1.5, C.metalLit) + rect(-30, -24, 46, 1, C.ink2, ' opacity=".5"') +
      circ(32, -56, 9, C.paper) + circ(32, -56, 2, C.ink2) + stroke('M32,-56 l0,-5 M32,-56 l4,2', 1.5, C.ink) + rect(-44, -31, 8, 9, C.red, 1) + rect(-44, -35, 8, 3, C.roofShade, 1) + pot(42, -24, .6);
  } };
  PLACE['human-practices'] = { r: 92, draw: function () {
    // the round table under the parasol: a farmer, a student, an official and a teacher, the map and the notes on the table, chairs
    var chair = function (x, y, flip) { return at(x, y, 1, rect(-7, -14, 14, 3, C.woodShade) + rect(-6, -11, 2, 11, C.woodShade) + rect(4, -11, 2, 11, C.woodShade) + rect(flip ? 4 : -7, -30, 3, 17, C.wood)); };
    return pool(-10, 8, 92, 18, .14) + ell(0, -2, 56, 20, C.woodShade) + ell(-1, -7, 52, 17, C.woodLit) + ell(-1, -7, 52, 17, C.wood, ' opacity=".3"') + ell(-1, -9, 44, 13, C.woodLit, ' opacity=".5"') +
      // the parasol
      line([[-80, -2], [-80, -124]], 6, C.woodShade) + line([[-80, -2], [-80, -124]], 2.5, C.woodLit) +
      path('M-134,-118 q54,-46 108,0 z', C.red) + path('M-134,-118 q54,-14 108,0 z', C.roofShade) + path('M-80,-150 q36,10 54,32 l-54,0 z', C.roofLit) + path('M-80,-150 q-36,10 -54,32 l54,0 z', C.red) + circ(-80, -152, 4, C.roofShade) +
      // what is on the table: the map, two sheets, a cup, a seed tray
      rect(-30, -14, 30, 18, C.lime2, 2, ' transform="skewX(-14)"') + path('M-28,-6 c8,-4 14,-10 24,-6', 'none', ' stroke="' + C.river + '" stroke-width="2"') + circ(-14, -8, 2.2, C.red) +
      rect(6, -12, 16, 11, C.paper, 1, ' transform="skewX(-14)"') + line([[8, -9], [18, -9]], 1, C.ink2, ' opacity=".5"') + line([[8, -6], [16, -6]], 1, C.ink2, ' opacity=".4"') +
      circ(28, -8, 4, C.white) + circ(28, -8, 2.2, C.roofShade) + rect(-6, -1, 18, 6, C.soil2, 1) + line([[-3, -1], [-3, -6]], 1.4, C.leaf) + line([[2, -1], [2, -7]], 1.4, C.leaf) + line([[7, -1], [7, -6]], 1.4, C.leaf) +
      // the people and their chairs
      chair(-44, 22) + chair(44, 22, true) +
      person(-40, 18, .95, C.shirtB, true) + person(40, 18, .95, C.shirtW, false, true) + person(-10, -24, .85, C.shirtG) + person(24, -26, .82, C.pants2, false, true, C.ink2) + person(60, -8, .8, C.shirtY, false, true) +
      // a notice board at the back with the farmers' map, and a tree
      rect(96, -74, 4, 74, C.woodShade) + rect(96, -74, 1.5, 74, C.woodLit) + rect(74, -112, 48, 40, C.woodShade, 3) + rect(77, -109, 42, 34, C.paper, 2) + path('M80,-92 c8,-6 14,-14 22,-10 c6,4 10,6 16,2 v22 h-38 z', C.lime2) + circ(94, -96, 2.5, C.red) + circ(104, -88, 2.5, C.red) + circ(86, -84, 2.5, C.red) +
      tree(132, -4, 1.0) + bush(-124, 10, .8);
  } };
  PLACE.education = { r: 78, draw: function () {
    var f = cast(160, 100, .2) + prism(-72, 0, 144, 54, 18, C.wall, C.wallShade, C.wallDeep) + rect(-72, -54, 144, 5, C.wallDeep) + rect(-72, -8, 144, 8, C.wallShade) +
      poly([[-80, -54], [0, -90], [80, -54]], C.roof) + poly([[0, -90], [80, -54], [62, -54], [0, -82]], C.roofLit) + poly([[80, -54], [98, -65], [18, -101], [0, -90]], C.roofShade) +
      prism(-18, -84, 36, 24, 8, C.wall, C.wallShade) + poly([[-23, -108], [0, -122], [23, -108]], C.roofShade) + poly([[0, -122], [23, -108], [16, -108], [0, -117]], C.roofLit) +
      circ(0, -96, 7.5, C.gold) + stroke('M0,-100 v8 M-4,-96 h8', 1.5, C.goldShade) + rect(-10, -26, 20, 26, C.woodShade, 2) + rect(-8, -24, 16, 24, C.wood, 1) + rect(-20, -30, 40, 4, C.wallDeep);
    [-60, -38, 22, 44].forEach(function (x) { f += win(x, -44, 16, 14, x < 0); });
    f += rect(62, -134, 3.5, 80, C.metalShade) + rect(62, -134, 1.2, 80, C.metalLit) + poly([[65.5, -134], [90, -127], [65.5, -120]], C.red) + poly([[65.5, -127], [90, -127], [65.5, -120]], C.roofShade);
    return f + person(-34, 8, .72, C.shirtW) + person(34, 8, .72, C.shirtB, false, true) + person(50, 12, .62, C.shirtY, false, true) + tree(-96, 6, .9, 2);
  } };
  PLACE.entrepreneurship = { r: 64, draw: function () {
    var f = cast(110, 100, .18) + prism(-48, 0, 96, 40, 10, C.wood, C.woodShade, C.woodLit) + rect(-44, -36, 88, 8, C.woodLit, 1) + rect(-44, -28, 88, 2, C.woodShade) +
      rect(-54, -98, 6, 62, C.woodShade) + rect(-54, -98, 2.5, 62, C.woodLit) + rect(48, -98, 6, 62, C.woodShade) + rect(48, -98, 2.5, 62, C.woodLit) + path('M-60,-98 h120 l-6,-16 h-108 z', C.roofShade) + path('M-58,-100 h116 l-5,-12 h-106 z', C.red);
    for (var i = 0; i < 6; i++) f += path('M' + (-60 + i * 20) + ',-98 h20 q-10,11 -20,0 z', i % 2 ? C.white : C.red);
    f += rect(-42, -60, 14, 22, C.liquid, 2) + rect(-24, -62, 14, 24, C.liquid, 2) + rect(-6, -60, 14, 22, C.liquid, 2) + rect(-38, -59, 3, 20, C.glassLit, 1, ' opacity=".6"') + rect(-20, -61, 3, 22, C.glassLit, 1, ' opacity=".6"') + rect(-2, -59, 3, 20, C.glassLit, 1, ' opacity=".6"') +
      rect(12, -54, 28, 16, C.ochre, 2) + rect(12, -54, 28, 3, C.ochre2, 1) + circ(26, -60, 7, C.leaf) + circ(22, -62, 3, C.leafLit) +
      rect(-58, -72, 24, 15, C.paper, 2) + circ(-50, -64, 4, C.gold) + stroke('M-42,-62 h6', 2, C.ink2) + person(70, 6, .82, C.shirtB, true, true) + person(-74, 8, .78, C.shirtR, true);
    return f;
  } };
  PLACE.sustainability = { r: 66, draw: function () {
    var blade = function (a) { return path('M0,0 c7,-14 7,-40 0,-60 c-7,-18 -7,-44 0,-60', C.white, ' transform="rotate(' + a + ')"') + path('M0,0 c3,-14 3,-40 0,-60 c-3,-18 -3,-44 0,-60', C.paperShade, ' transform="rotate(' + a + ')"'); };
    return cast(40, 130, .12) + path('M-7,0 l3,-126 h8 l3,126 z', C.white) + path('M-7,0 l3,-126 h4 l0,126 z', C.paperShade) + ell(0, 2, 12, 4, C.metalShade) +
      at(0, -128, 1, blade(0) + blade(120) + blade(240) + circ(0, 0, 6, C.metalShade) + circ(-1, -1, 3, C.metalLit)) +
      tree(-46, 4, .95, 1) + tree(50, 8, .85) + bush(-20, 12, .6) +
      poly([[-96, -4], [-62, -4], [-56, -22], [-90, -22]], C.blue) + poly([[-96, -4], [-62, -4], [-60, -10], [-94, -10]], C.roofBlueShade) + line([[-85, -22], [-79, -4], [-74, -22], [-68, -4]], 1, C.riverLight) + line([[-93, -13], [-59, -13]], 1, C.riverLight) + rect(-78, -4, 4, 8, C.metalShade) +
      circ(-30, -96, 9, C.white, ' opacity=".55"') + circ(-22, -100, 12, C.white, ' opacity=".5"') + circ(-12, -96, 8, C.white, ' opacity=".5"');
  } };
  PLACE['laws-and-regulations'] = { r: 74, draw: function () {
    var f = cast(150, 100, .2) + prism(-68, -8, 136, 6, 16, C.wallShade, C.wallDeep, C.pave) + rect(-66, -2, 132, 2, C.wallDeep) + prism(-60, -14, 120, 48, 14, C.wallShade, C.wallDeep) + rect(-60, -62, 120, 48, C.wall);
    [-48, -24, 0, 24, 48].forEach(function (x) { f += rect(x - 6, -62, 12, 48, C.paper) + rect(x + 3, -62, 3, 48, C.paperShade) + rect(x - 8, -64, 16, 4, C.paperShade, 1) + rect(x - 8, -17, 16, 3, C.paperShade, 1); });
    f += rect(-64, -68, 128, 6, C.wallDeep) + poly([[-72, -68], [0, -98], [72, -68]], C.wallShade) + poly([[-64, -70], [0, -94], [64, -70]], C.paper) + poly([[0, -94], [64, -70], [48, -70], [0, -88]], C.cream) +
      poly([[72, -68], [86, -76], [14, -106], [0, -98]], C.wallDeep) +
      circ(0, -79, 7.5, C.gold) + path('M-3,-82 h6 v6 h-6 z', C.white) + rect(-9, -34, 18, 20, C.woodShade, 1) + rect(-7, -32, 14, 18, C.wood, 1) +
      rect(-80, -40, 3, 40, C.metalShade) + poly([[-77, -40], [-58, -34], [-77, -28]], C.blue) + person(84, 2, .75, C.shirtW, false, true, C.pants2) + person(-90, 2, .72, C.pants2, false, false, C.ink2);
    return f;
  } };
  PLACE['geospatial-analysis'] = { r: 58, draw: function () {
    return cast(70, 100, .14) + line([[-18, 0], [-5, -62]], 4.5, C.metalShade) + line([[18, 0], [5, -62]], 4.5, C.metal) + line([[0, 0], [0, -64]], 4.5, C.metalShade) + line([[-10, -26], [10, -26]], 2.5, C.metalShade) +
      rect(-42, -102, 84, 48, C.woodShade, 3) + rect(-40, -100, 80, 44, C.paper, 2) + rect(-37, -97, 74, 38, C.lime2, 2) +
      path('M-37,-72 c10,-6 18,-18 30,-14 c10,4 14,10 24,4 c6,-4 10,-8 20,-8 v31 h-74 z', C.olive) + path('M-37,-64 c12,-2 20,6 34,2 c12,-4 22,-10 40,-6 v9 h-74 z', C.lime) +
      stroke('M-37,-82 c14,2 20,10 30,8 c14,-2 22,-12 44,-10', 3, C.river) + stroke('M-37,-83 c14,2 20,10 30,8 c14,-2 22,-12 44,-10', 1, C.riverLight) +
      circ(6, -80, 5.5, C.red) + stroke('M6,-80 l0,11', 2.2, C.red) + circ(6, -80, 2, C.white) + circ(-18, -68, 3, C.gold) + circ(22, -66, 3, C.gold) + circ(-6, -62, 2.4, C.gold) +
      '<circle cx="-24" cy="-110" r="9" fill="none" stroke="' + C.ink2 + '" stroke-width="2"/><path d="M-24,-119 v18 M-33,-110 h18" stroke="' + C.ink2 + '" stroke-width="1.5"/><path d="M-24,-119 l0,-4" stroke="' + C.red + '" stroke-width="2"/>' +
      rect(26, -52, 10, 8, C.paper, 1) + bush(34, 6, .6);
  } };
  PLACE['data-physicalization'] = { r: 60, draw: function () {
    var f = cast(100, 70, .18) + prism(-46, 0, 92, 14, 10, C.pave2, C.gravel2, C.pave) + rect(-44, -16, 88, 4, C.white, 1, ' opacity=".5"');
    [[-36, 22, C.ochre, C.goldShade], [-20, 40, C.lime, C.olive], [-4, 58, C.leaf, C.green], [12, 36, C.gold, C.goldShade], [24, 50, C.green, C.greenDeep]].forEach(function (b) {
      f += prism(b[0], -16, 12, b[1], 6, b[2], b[3], C.cream);
    });
    return f + person(-66, 4, .8, C.shirtR, false) + person(62, 2, .76, C.shirtW, false, true) + stroke('M-30,-10 h60', 1, C.ink2, ' opacity=".4"') + rect(-14, -8, 28, 5, C.paper, 1);
  } };

  /* ---- the valley: where every place stands, in a 2400 x 1200 picture ---- */
  var W = 2400, H = 1200;
  var POS = {
    milestones: [96, 650, 1.35], attributions: [300, 630, 1.35], team: [206, 960, 1.5],
    notebook: [530, 596, 1.3], parts: [730, 596, 1.3], experiments: [520, 846, 1.42], measurement: [752, 822, 1.34], 'safety-and-security': [876, 1030, 1.4],
    model: [1000, 586, 1.3], 'protein-design': [1176, 586, 1.3], software: [1026, 800, 1.34], 'drylab-notebook': [1196, 838, 1.3],
    description: [966, 1096, 1.46], contribution: [1166, 1058, 1.36], engineering: [1326, 712, 1.34], biomanufacturing: [1500, 606, 1.3], hardware: [1356, 962, 1.46], development: [1556, 944, 1.34], results: [1656, 712, 1.3],
    plant: [1846, 1096, 1.44], 'geospatial-analysis': [1908, 766, 1.34],
    sustainability: [2300, 566, 1.26], education: [2262, 770, 1.26], entrepreneurship: [2072, 912, 1.28], 'data-physicalization': [1992, 1090, 1.3], 'human-practices': [2154, 1096, 1.3], 'laws-and-regulations': [2302, 984, 1.26]
  };
  var ZONES = [
    ['team', 'The village', 50, 390], ['wetlab', 'The lab', 400, 880], ['drylab', 'The studio', 890, 1240],
    ['project', 'The yard', 1250, 1700], ['wetlab', 'The field', 1760, 1960], ['engagement', 'The town', 1970, 2360]
  ];

  function defs(id) {
    return '<defs>' +
      '<linearGradient id="' + id + '-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.skyTop + '"/><stop offset=".55" stop-color="' + C.skyMid + '"/><stop offset=".85" stop-color="' + C.skyLow + '"/><stop offset="1" stop-color="' + C.sunHaze + '"/></linearGradient>' +
      '<radialGradient id="' + id + '-sun"><stop offset="0" stop-color="' + C.sun + '" stop-opacity=".95"/><stop offset=".35" stop-color="' + C.sunHaze + '" stop-opacity=".6"/><stop offset="1" stop-color="' + C.sunHaze + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + '-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.plainLight + '"/><stop offset=".5" stop-color="' + C.plain + '"/><stop offset="1" stop-color="' + C.plainDeep + '"/></linearGradient>' +
      '<linearGradient id="' + id + '-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.mist + '" stop-opacity="0"/><stop offset="1" stop-color="' + C.mist + '" stop-opacity=".75"/></linearGradient>' +
      '<radialGradient id="' + id + '-vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1c2416" stop-opacity=".22"/></radialGradient>' +
      '<filter id="' + id + '-brush" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<filter id="' + id + '-brushsoft" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<filter id="' + id + '-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer></filter>' +
      '<filter id="' + id + '-strokes" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".002 .06" numOctaves="1" seed="5" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".12" intercept="-.02"/></feComponentTransfer></filter>' +
      '<filter id="' + id + '-route" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>';
  }

  function mountains(w, horizon, amp, mist) {
    amp = amp || 1;
    var s = '', x, i, a, b;
    var far = [[0, horizon + 20]]; for (x = 0; x <= w; x += 160) far.push([x, horizon - amp * (70 + 70 * Math.abs(Math.sin(x / 230 + 1)) + 30 * Math.sin(x / 90))]); far.push([w, horizon + 20]);
    s += ridge(far, C.mtFar);
    var far2 = [[0, horizon + 20]]; for (x = 0; x <= w; x += 140) far2.push([x, horizon - amp * (50 + 60 * Math.abs(Math.sin(x / 260 + 2.6)) + 24 * Math.sin(x / 110 + 1))]); far2.push([w, horizon + 20]);
    s += ridge(far2, C.mtFar2);
    s += rect(0, horizon - amp * 120, w, amp * 140, mist);
    var mid = [[0, horizon + 20]]; for (x = 0; x <= w; x += 120) mid.push([x, horizon - amp * (30 + 120 * Math.abs(Math.sin(x / 310 + 2.4)) + 40 * Math.abs(Math.sin(x / 130)))]); mid.push([w, horizon + 20]);
    s += ridge(mid, C.mtMid);
    for (i = 1; i < mid.length - 2; i += 2) { a = mid[i]; b = mid[i + 1]; if (b[1] < a[1]) s += path('M' + a[0] + ',' + (a[1] + 40) + ' Q' + (b[0] - 20) + ',' + (b[1] + 10) + ' ' + b[0] + ',' + b[1] + ' Q' + (b[0] + 30) + ',' + (b[1] + 30) + ' ' + (b[0] + 40) + ',' + (b[1] + 50) + ' Z', C.mtMid2, ' opacity=".85"'); }
    s += rect(0, horizon - amp * 60, w, amp * 80, mist);
    var near = [[0, horizon + 40]]; for (x = 0; x <= w; x += 100) near.push([x, horizon - amp * (90 * Math.abs(Math.sin(x / 420 + 0.6)) + 50 * Math.abs(Math.sin(x / 170 + 1)))]); near.push([w, horizon + 40]);
    s += ridge(near, C.mtNear);
    for (i = 1; i < near.length - 2; i += 2) {
      a = near[i]; b = near[i + 1];
      if (b[1] < a[1]) s += path('M' + (a[0] - 10) + ',' + (a[1] + 30) + ' Q' + (b[0] - 30) + ',' + (b[1] + 10) + ' ' + b[0] + ',' + b[1] + ' Q' + (b[0] + 30) + ',' + (b[1] + 40) + ' ' + (b[0] + 36) + ',' + (b[1] + 60) + ' L' + (b[0] + 10) + ',' + (b[1] + 70) + ' Z', C.mtNearLit, ' opacity=".8"') + path('M' + b[0] + ',' + b[1] + ' Q' + (b[0] + 24) + ',' + (b[1] + 30) + ' ' + (b[0] + 36) + ',' + (b[1] + 60) + ' L' + (b[0] + 22) + ',' + (b[1] + 40) + ' Z', C.mtNearLit2, ' opacity=".55"');
    }
    s += path('M0,' + (horizon + 20) + ' C300,' + (horizon - 40 * amp) + ' 700,' + (horizon + 10) + ' 1000,' + (horizon + 30) + ' S1800,' + (horizon - 20 * amp) + ' 2400,' + (horizon + 30) + ' V' + (horizon + 60) + ' H0 Z', C.ridge);
    s += path('M0,' + (horizon + 20) + ' C300,' + (horizon - 40 * amp) + ' 700,' + (horizon + 10) + ' 1000,' + (horizon + 30) + ' V' + (horizon + 60) + ' H0 Z', C.ridgeLit, ' opacity=".5"');
    s += path('M0,' + (horizon + 40) + ' C400,' + (horizon + 10) + ' 900,' + (horizon + 60) + ' 1300,' + (horizon + 40) + ' S2000,' + (horizon + 20) + ' 2400,' + (horizon + 56) + ' V' + (horizon + 80) + ' H0 Z', C.ridgeDark);
    return s;
  }

  function farFields(y0, y1, w) {
    var cols = [C.lime, C.olive, C.yellow, C.ochre, C.soil, C.lime2, C.paddy, C.olive2, C.ochre2, C.lime, C.soil2, C.olive];
    var s = '', i = 0, y = y0, rh = 24, row = 0;
    while (y < y1) {
      var skew = (y - y0) * .22, step = 110 + row * 30;
      for (var x = -80 - row * 20; x < w + 80; x += step + (i % 3) * 30) {
        var ww = step - 10 + (i * 37) % 40, col = cols[(i + row) % cols.length];
        s += poly(jitter([[x + skew, y], [x + ww + skew, y], [x + ww + skew + rh * .6, y + rh], [x + skew + rh * .6, y + rh]], 3), col, ' opacity=".95"');
        if (col === C.soil || col === C.soil2) for (var k = 1; k < 4; k++) s += line([[x + skew + 6 + k * 2, y + k * rh / 4], [x + ww + skew - 6 + k * 2, y + k * rh / 4]], 1, C.ochre, ' opacity=".35"');
        if (col === C.paddy) s += line([[x + skew + 8, y + rh * .5], [x + ww + skew - 8, y + rh * .5]], 1.5, C.riverLight, ' opacity=".6"');
        i++;
      }
      s += line([[0, y + rh], [w, y + rh + 4]], 1.6, C.hedge, ' opacity=".35"');
      y += rh; rh += 7; row++;
    }
    return s;
  }
  function treeline(y, w, gap, s0) { var s = ''; for (var x = 20; x < w; x += gap) { var k = (x * 7) % 3; s += (k === 1 ? pine : tree)(x, y + ((x * 13) % 26), s0 + ((x >> 3) % 4) * .06, k); } return s; }
  function flowers(x, y, w, h, col, n) { var s = ''; for (var i = 0; i < n; i++) s += circ(x + rnd() * w, y + rnd() * h, 2.2 + rnd() * 1.6, col, ' opacity=".85"'); return s; }
  function tuft(x, y) { return stroke('M' + x + ',' + y + ' l-3,-7 M' + (x + 3) + ',' + y + ' l0,-9 M' + (x + 6) + ',' + y + ' l3,-7', 1.4, C.grass, ' opacity=".8"'); }
  function roadPath(d, w) {
    return stroke(d, w + 10, C.roadEdge, ' opacity=".85"') + stroke(d, w, C.road) + stroke(d, w - 16, C.road2, ' opacity=".35" stroke-dasharray="26 40"') + stroke(d, 1.5, C.roadEdge, ' opacity=".35" stroke-dasharray="4 30"');
  }
  function slab(ptsArr, fill, edge) { return poly(ptsArr, edge, ' transform="translate(0,6)" opacity=".9"') + poly(ptsArr, fill); }
  function pavilion(x0, x1, y, hh, roof, roofLit, label, mids) {
    var p = '';
    p += poly([[x0 - 20, y - hh], [x1 + 20, y - hh], [x1 + 40, y - hh - 60], [x0, y - hh - 60]], roofLit) + poly([[x0 - 20, y - hh], [x1 + 20, y - hh], [x1 + 20, y - hh + 12], [x0 - 20, y - hh + 12]], roof);
    p += poly([[x0 - 20, y - hh + 12], [x1 + 20, y - hh + 12], [x1 + 20, y - hh + 20], [x0 - 20, y - hh + 20]], C.shadow, ' opacity=".12"' + mul());
    [x0 - 10].concat(mids || [(x0 + x1) / 2]).concat([x1 + 10]).forEach(function (px) { p += rect(px - 5, y - hh + 10, 10, hh - 10, C.wallShade) + rect(px - 5, y - hh + 10, 4, hh - 10, C.wall) + pool(px - 6, y + 2, 14, 4); });
    p += at(x0 + 4, y - hh + 6, 1, path('M0,0 c3,-9 12,-11 18,-10 c-2,8 -9,12 -18,10 z', C.cream, ' opacity=".85"'));
    return p;
  }

  function valley(id) {
    var horizon = 230, i;
    var s = rect(0, 0, W, H, 'url(#' + id + '-sky)') + circ(1900, 118, 220, 'url(#' + id + '-sun)') + circ(1900, 118, 46, C.sun) +
      ell(420, 110, 120, 16, C.white, ' opacity=".45"') + ell(520, 96, 70, 12, C.white, ' opacity=".4"') + ell(1300, 80, 160, 14, C.white, ' opacity=".35"') + ell(2180, 160, 90, 10, C.white, ' opacity=".3"');
    s += stroke('M700,150 q6,-6 12,0 q6,-6 12,0 M740,166 q5,-5 10,0 q5,-5 10,0', 1.6, C.mtMid2, ' opacity=".7"');
    s += '<g filter="url(#' + id + '-brushsoft)">' + mountains(W, horizon, .8, 'url(#' + id + '-mist)') + '</g>';
    s += '<g filter="url(#' + id + '-brush)">';
    s += rect(0, horizon + 60, W, H - horizon - 60, 'url(#' + id + '-ground)');
    s += farFields(horizon + 46, 410, W);
    s += treeline(392, W, 54, .55);
    s += path('M0,420 C400,400 900,440 1300,420 S2000,400 2400,430 V1200 H0 Z', 'url(#' + id + '-ground)');
    s += path('M0,740 C500,720 1000,760 1500,740 S2100,730 2400,750 V1200 H0 Z', C.plain2, ' opacity=".55"');
    s += path('M1960,600 C2100,560 2300,560 2400,590 V1200 H1930 C1900,900 1900,700 1960,600 Z', C.plainLight, ' opacity=".5"');
    s += rect(0, 430, W, H - 430, '#fff', ' filter="url(#' + id + '-strokes)" opacity=".9"');
    // the zone grounds: the village green, the lab and studio floors, the gravel yard, the town plaza
    s += slab(jitter([[70, 560], [360, 560], [380, 1040], [40, 1040]], 10), C.lawn, C.plainDeep);
    s += slab([[430, 560], [860, 560], [880, 900], [410, 900]], C.pave, C.pave2) + slab([[930, 548], [1230, 548], [1250, 880], [910, 880]], C.pave, C.pave2);
    s += slab(jitter([[1250, 560], [1690, 560], [1710, 1000], [1230, 1000]], 10), C.gravel, C.gravel2);
    for (i = 0; i < 90; i++) s += circ(1250 + rnd() * 440, 580 + rnd() * 400, 1.5 + rnd() * 2, C.gravel2, ' opacity=".7"');
    s += slab(jitter([[1990, 760], [2370, 760], [2380, 1100], [1960, 1100]], 10), C.pave, C.pave2);
    for (i = 0; i < 7; i++) s += line([[1990 + i * 54, 760], [1960 + i * 60, 1100]], 1, C.pave2, ' opacity=".7"');
    for (i = 0; i < 7; i++) s += line([[1994, 760 + i * 52], [2374, 760 + i * 52]], 1, C.pave2, ' opacity=".7"');
    s += pavilion(470, 820, 560, 112, C.roofGreenShade, C.roofGreen, 'LAB') + pavilion(970, 1190, 548, 112, C.roofBlueShade, C.roofBlue, 'STUDIO');
    // the river, between the yard and the field
    s += path('M1700,290 C1760,420 1690,520 1740,660 S1780,900 1720,1000 S1660,1150 1700,1200 h64 C1716,1120 1766,1020 1776,960 S1806,760 1766,660 S1746,420 1746,290 Z', C.bank, ' opacity=".7"');
    s += path('M1704,290 C1764,420 1694,520 1744,660 S1784,900 1724,1000 S1664,1150 1704,1200 h56 C1716,1120 1762,1020 1772,960 S1802,760 1762,660 S1742,420 1742,290 Z', C.riverLight);
    s += path('M1714,290 C1770,420 1702,520 1752,660 S1790,900 1732,1000 S1674,1150 1712,1200 h36 C1720,1120 1760,1020 1766,960 S1794,760 1754,660 S1736,420 1734,290 Z', C.river);
    s += stroke('M1724,300 C1774,420 1714,520 1760,660 S1794,900 1742,1000 S1688,1140 1720,1195', 5, C.riverDeep, ' opacity=".45"') + stroke('M1738,420 c4,30 -6,60 2,90 M1752,760 c6,30 -4,50 -2,80', 1.5, C.white, ' opacity=".5"');
    for (i = 0; i < 12; i++) s += circ(1735 + Math.sin(i) * 20, 330 + i * 72, 2.5, C.white, ' opacity=".5"');
    s += stroke('M1690,640 l0,-14 M1696,646 l0,-18 M1702,642 l0,-12 M1790,880 l0,-14 M1796,884 l0,-18 M1802,878 l0,-12', 1.5, C.hedge);
    // the road, from the village through the lab and the yard, over the bridge, past the field, into the town
    s += roadPath('M-20,1010 C200,990 300,960 420,920 S700,900 900,960 S1200,1000 1400,930 S1650,900 1755,918 S2000,960 2160,940 S2350,920 2420,950', 40);
    s += roadPath('M960,950 C980,860 1000,800 1060,740', 18) + roadPath('M2060,935 C2100,1000 2150,1060 2240,1100', 18) + roadPath('M250,960 C230,900 200,800 230,700', 14);
    s += rect(1700, 904, 112, 28, C.woodShade, 3) + rect(1700, 904, 112, 20, C.wood, 3) + line([[1700, 898], [1812, 898]], 4, C.woodShade) + line([[1700, 938], [1812, 938]], 4, C.woodShade);
    [1706, 1730, 1754, 1778, 1802].forEach(function (bx) { s += rect(bx, 890, 4, 12, C.woodShade) + rect(bx, 930, 4, 12, C.woodShade); });
    // the field's plots and the pond by the village
    s += poly(jitter([[1790, 980], [1960, 980], [1944, 1060], [1774, 1060]], 4), C.lime2, ' opacity=".9"') + poly(jitter([[1964, 1000], [2040, 1000], [2030, 1058], [1954, 1058]], 4), C.yellow, ' opacity=".85"') + poly(jitter([[1780, 1140], [1960, 1140], [1950, 1200], [1770, 1200]], 4), C.ochre, ' opacity=".85"');
    for (i = 0; i < 5; i++) s += line([[1794 + i * 2, 992 + i * 14], [1956 - i * 2, 992 + i * 14]], 1.2, C.olive, ' opacity=".5"');
    s += ell(120, 1120, 70, 22, C.bank, ' opacity=".8"') + ell(120, 1118, 62, 18, C.riverLight) + ell(118, 1116, 50, 13, C.river) + ell(100, 1112, 12, 3, C.white, ' opacity=".5"') + ell(140, 1120, 8, 2.5, C.white, ' opacity=".5"');
    s += flowers(1980, 1120, 400, 60, C.gold, 40) + flowers(60, 440, 300, 60, C.white, 30) + flowers(2000, 640, 360, 90, C.gold, 30);
    [[60, 1000], [330, 1150], [700, 1150], [1240, 1180], [1560, 1180], [2420, 860], [1700, 560], [900, 480], [1500, 470]].forEach(function (p) { s += tuft(p[0], p[1]); });
    s += tree(420, 1150, 1.05) + tree(1565, 1160, .95, 2) + tree(2384, 1130, 1.0, 1) + tree(66, 1150, .95) + tree(1240, 1168, 1.0, 1) + pine(1702, 560, .9) + tree(2420, 860, .95) + tree(930, 1160, 1.0, 2) + bush(1620, 1120, .9) + bush(2300, 1150, .9) + hay(1620, 1070, 1.1) + hay(1648, 1082, .9);
    s += at(610, 955, 1, pool(-6, 2, 22, 5) + rect(-20, -16, 32, 14, C.roofBlue, 2) + rect(10, -22, 14, 20, C.roofBlue, 2) + rect(12, -20, 8, 7, C.riverLight, 1) + rect(-20, -16, 32, 3, C.ochre2) + circ(-12, -1, 4, C.ink) + circ(16, -1, 4, C.ink));
    s += '</g>';
    s += rect(0, 0, W, H, 'url(#' + id + '-vig)');
    return s;
  }

  function placeGroup(slug, x, y, k, cls) {
    var p = PLACE[slug]; if (!p) return '';
    seed = 7 + slug.length;
    return '<g class="nma-place ' + (cls || '') + '" data-page="' + slug + '" transform="translate(' + x + ',' + y + ') scale(' + k + ')">' +
      '<ellipse class="nma-hit" cx="0" cy="-' + (p.r * .5) + '" rx="' + (p.r + 8) + '" ry="' + (p.r * .75 + 8) + '"/>' +
      '<g class="nma-art">' + p.draw() + '</g></g>';
  }

  function linksOf(slug) { return (D.links[slug] || []).filter(function (l) { return PAGE[l.to]; }); }
  /* The three connections the data marks as this page's key ones. Hovering a
     place lights those and nothing else: the full set, in and out, lit up to
     sixteen other places at once and said nothing. */
  function keyLinks(slug) {
    var ls = linksOf(slug), k = ls.filter(function (l) { return l.key; });
    return (k.length ? k : ls.slice(0, 3)).map(function (l) { return l.to; });
  }
  function neighbours(slug) {
    var set = {};
    linksOf(slug).forEach(function (l) { set[l.to] = true; });
    ORDER.forEach(function (o) { linksOf(o).forEach(function (l) { if (l.to === slug) set[o] = true; }); });
    return set;
  }
  function common(root) {
    var here = root.getAttribute('data-here');
    if (here === null || !PAGE[here]) {
      var at0 = location.href.split(/[?#]/)[0];
      here = (ROOT && at0.indexOf(ROOT) === 0) ? at0.slice(ROOT.length).split('/')[0] : '';
      if (!PAGE[here]) here = '';
    }
    var linkRoot = root.getAttribute('data-root') || ROOT;
    return { here: here, href: function (s) { return linkRoot + s + '/'; }, local: root.hasAttribute('data-local') };
  }
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function head(root, eyebrow, title, sub) {
    var hd = h('header', 'nm-head'), ht = h('div');
    if (eyebrow) ht.appendChild(h('p', 'nm-eyebrow', eyebrow));
    var t = h('h2', 'nm-title', title); t.setAttribute('data-no-toc', ''); ht.appendChild(t);
    hd.appendChild(ht); if (sub) hd.appendChild(h('p', 'nm-sub', sub));
    root.appendChild(hd);
  }
  function tagFor(slug, here) {
    var p = PAGE[slug], s = SEC[p.section];
    return '<g class="nma-tag" data-for="' + slug + '" style="--s-ink:' + s.ink + '"><path class="nma-tag__notch"/><rect class="nma-tag__bg" rx="14"/><circle class="nma-tag__dot" r="4"/><text class="nma-tag__t">' + esc(p.name) + '</text></g>';
  }
  // place every tag above its place, then push any that overlap upwards until none do
  function layoutTags(svg, posOf, slugs) {
    var boxes = [];
    slugs.forEach(function (slug) {
      var t = svg.querySelector('.nma-tag[data-for="' + slug + '"]'); if (!t) return;
      var p = posOf(slug), txt = t.querySelector('text'), bg = t.querySelector('rect'), pin = t.querySelector('path'), dot = t.querySelector('circle');
      txt.setAttribute('x', p[0] + 7); txt.setAttribute('y', p[1]);
      var bb = txt.getBBox();
      boxes.push({ x: bb.x - 28, y: bb.y - 8, w: bb.width + 42, h: bb.height + 16, ax: p[0], ay: p[2], txt: txt, bg: bg, pin: pin, dot: dot });
    });
    boxes.sort(function (a, b) { return a.y - b.y; });
    for (var pass = 0; pass < 14; pass++) {
      var moved = false;
      for (var i = 0; i < boxes.length; i++) for (var j = 0; j < i; j++) {
        var a = boxes[i], b = boxes[j];
        if (a.x < b.x + b.w + 6 && b.x < a.x + a.w + 6 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4) {
          var up = (a.y <= b.y) ? a : b; up.y -= (up.h + 6); moved = true;
        }
      }
      if (!moved) break;
    }
    boxes.forEach(function (b) {
      b.txt.setAttribute('y', b.y + b.h / 2 + 1);
      b.bg.setAttribute('x', b.x); b.bg.setAttribute('y', b.y); b.bg.setAttribute('width', b.w); b.bg.setAttribute('height', b.h);
      b.dot.setAttribute('cx', b.x + 16); b.dot.setAttribute('cy', b.y + b.h / 2);
      b.pin.setAttribute('d', 'M' + (b.ax - 8) + ',' + (b.y + b.h - 1) + ' L' + b.ax + ',' + (b.y + b.h + 8) + ' L' + (b.ax + 8) + ',' + (b.y + b.h - 1) + ' Z');
    });
  }

  /* ---- what both pictures share: the light, the beacon, the keyboard ---- */
  function beacon(x, y, ink) {
    // the "you are here" mark: a pin in the page's colour above the place, a ring breathing on the ground under it
    return '<g class="nma-beacon" transform="translate(' + r1(x) + ',' + r1(y) + ')">' +
      '<ellipse class="nma-beacon__ring" cx="0" cy="0" rx="26" ry="9"/>' +
      '<g class="nma-beacon__pin"><path d="M0,-6 C-14,-24 -16,-34 -16,-42 a16,16 0 0 1 32,0 c0,8 -2,18 -16,36 z" fill="' + ink + '"/><circle cx="0" cy="-42" r="6" fill="#fff"/></g></g>';
  }
  // the light: the dusk lies over the whole scene; whatever is lit is lifted above it
  function lighting(svg, places, order, placesG, litG) {
    var home = {}; order.forEach(function (slug, i) { home[slug] = i; });
    return {
      lift: function (slugs) {
        var set = {}; slugs.forEach(function (k) { set[k] = true; });
        order.forEach(function (k) { var a = places[k].parentNode; if (set[k]) { litG.appendChild(a); a.classList.add('nma-lit'); } });
      },
      drop: function () {
        order.forEach(function (k) { var a = places[k].parentNode; a.classList.remove('nma-lit', 'nma-active'); placesG.appendChild(a); });
      }
    };
  }
  function keyboard(svg, places, xs, onEscape) {
    var sorted = Object.keys(places).sort(function (a, b) { return xs[a] - xs[b]; });
    svg.addEventListener('keydown', function (e) {
      var a = e.target.closest && e.target.closest('a[data-page], a'); if (!a) return;
      var g = a.querySelector('.nma-place'); if (!g) return;
      var i = sorted.indexOf(g.getAttribute('data-page'));
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var j = (i + (e.key === 'ArrowRight' ? 1 : -1) + sorted.length) % sorted.length;
        places[sorted[j]].parentNode.focus();
      } else if (e.key === 'Escape') { a.blur(); onEscape(); }
    });
  }
  function note(root) {
    root.appendChild(h('p', 'nma-note', 'Drawn in code after the team’s vision painting, with AI assistance. Every place opens its page.'));
  }

  /* ---------------------------------------------------------------- the whole valley */
  function mountAll(root) {
    var c = common(root), here = c.here, id = 'nma' + Math.floor(Math.random() * 1e6);
    root.classList.add('navmap', 'nma', 'nma-all');
    root.innerHTML = '';
    var hereSec = PAGE[here] ? SEC[PAGE[here].section] : null;
    if (hereSec) { root.style.setProperty('--s-ink', hereSec.ink); root.style.setProperty('--glow', hereSec.line); }
    head(root, '', 'Explore ReLEAF', '');
    var stage = h('div', 'nma-stage'); root.appendChild(stage);
    var scroller = h('div', 'nma-scroll'); stage.appendChild(scroller);
    var inner = h('div', 'nma-inner'); scroller.appendChild(inner);

    var order = ORDER.slice().sort(function (a, b) { return POS[a][1] - POS[b][1]; });
    var s = '<svg class="nma-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Every page of ReLEAF as a place in one valley. Arrow keys move between places.">' + defs(id);
    s += '<g class="nma-ground">' + valley(id) + '</g>';
    s += '<g class="nma-zones">';
    ZONES.forEach(function (z) {
      var sec = SEC[z[0]];
      s += '<line x1="' + (z[2] + 10) + '" y1="1180" x2="' + (z[3] - 10) + '" y2="1180" stroke="' + sec.line + '" stroke-width="4" stroke-linecap="round" opacity=".7"/>';
    });
    s += '</g>';
    s += '<g class="nma-places" filter="url(#' + id + '-brush)">';
    order.forEach(function (slug) {
      var p = POS[slug];
      s += '<a href="' + c.href(slug) + '" aria-label="' + esc(PAGE[slug].name) + (slug === here ? ', you are here' : '') + '"' + (slug === here ? ' aria-current="page"' : '') + '>' + placeGroup(slug, p[0], p[1], p[2], slug === here ? 'nma-is-here' : '') + '</a>';
    });
    s += '</g>';
    s += '<rect class="nma-dusk" x="0" y="0" width="' + W + '" height="' + H + '"/>';
    s += '<g class="nma-litlayer" filter="url(#' + id + '-brush)"></g>';
    if (POS[here]) { var hp = POS[here]; s += beacon(hp[0], hp[1] - PLACE[here].r * 1.3 * hp[2] - 6, hereSec.ink); }
    s += '<rect class="nma-paper" x="0" y="0" width="' + W + '" height="' + H + '" filter="url(#' + id + '-grain)"/>';
    s += '<g class="nma-tags">'; ORDER.forEach(function (slug) { s += tagFor(slug, here); }); s += '</g>';
    s += '</svg>';
    inner.innerHTML = s;
    var svg = inner.querySelector('svg');
    var places = {}; inner.querySelectorAll('.nma-place').forEach(function (gg) { places[gg.getAttribute('data-page')] = gg; });
    var light = lighting(svg, places, order, svg.querySelector('.nma-places'), svg.querySelector('.nma-litlayer'));
    function tagPos(slug) { var p = POS[slug]; return [p[0], p[1] - PLACE[slug].r * 1.35 * p[2] - (slug === here ? 64 : 20), p[1] - PLACE[slug].r * 1.1 * p[2] - (slug === here ? 50 : 0)]; }

    var legend = h('ul', 'nma-legend'); root.appendChild(legend);
    ZONES.forEach(function (z) { var li = h('li', null, z[1]); li.style.setProperty('--s-line', SEC[z[0]].line); li.style.setProperty('--s-ink', SEC[z[0]].ink); legend.appendChild(li); });
    var cap = h('div', 'nma-cap'); root.appendChild(cap);
    function fillCap(slug) {
      cap.innerHTML = '';
      if (!PAGE[slug]) return;
      var p = PAGE[slug], sec = SEC[p.section];
      cap.style.setProperty('--s-ink', sec.ink); cap.style.setProperty('--s-pill', sec.pill);
      var hd = h('div', 'nma-cap__head');
      hd.appendChild(h('span', 'nma-cap__eyebrow', sec.name));
      var nm = h('a', 'nma-cap__name', p.name); nm.href = c.href(slug); if (c.local) nm.addEventListener('click', function (e) { e.preventDefault(); root.dispatchEvent(new CustomEvent('navmap:go', { detail: slug, bubbles: true })); }); hd.appendChild(nm);
      hd.appendChild(h('span', 'nma-cap__line', p.caption));
      cap.appendChild(hd);
      var ul = h('ul', 'nma-cap__links');
      linksOf(slug).forEach(function (l) {
        var li = h('li'); var a = h('a'); a.href = c.href(l.to);
        var ls = SEC[PAGE[l.to].section]; a.style.setProperty('--s-ink', ls.ink); a.style.setProperty('--s-pill', ls.pill);
        a.appendChild(h('b', null, PAGE[l.to].name));
        a.appendChild(h('span', null, (l.lane === 'in' ? 'builds on · ' : 'leads to · ') + l.why));
        if (l.next) a.appendChild(h('i', 'nm-next', 'Read next'));
        a.addEventListener('mouseenter', function () { places[l.to].parentNode.classList.add('nma-active'); });
        a.addEventListener('mouseleave', function () { places[l.to].parentNode.classList.remove('nma-active'); });
        if (c.local) a.addEventListener('click', function (e) { e.preventDefault(); root.dispatchEvent(new CustomEvent('navmap:go', { detail: l.to, bubbles: true })); });
        li.appendChild(a); ul.appendChild(li);
      });
      cap.appendChild(ul);
    }
    var current = null;
    function clear() {
      current = null;
      root.removeAttribute('data-lit');
      light.drop();
      svg.querySelectorAll('.nma-tag.nma-show').forEach(function (t) { t.classList.remove('nma-show'); });
    }
    function lightUp(slug) {
      if (current === slug) return;
      clear();
      current = slug;
      root.setAttribute('data-lit', slug);
      var shown = [slug].concat(keyLinks(slug));
      light.lift(shown);
      places[slug].parentNode.classList.add('nma-active');
      layoutTags(svg, tagPos, shown);
      shown.forEach(function (k) { svg.querySelector('.nma-tag[data-for="' + k + '"]').classList.add('nma-show'); });
      fillCap(slug);
    }
    function settle() {
      clear();
      fillCap(here);
    }

    var touch = window.matchMedia('(hover: none)').matches, viaTouch = false, armed = null, hideT = 0;
    svg.addEventListener('pointerdown', function (e) { viaTouch = e.pointerType !== 'mouse'; }, true);
    function placeOf(t) { var a = t && t.closest ? t.closest('a') : null; var gg = a && a.querySelector('.nma-place'); return gg ? gg.getAttribute('data-page') : null; }
    svg.addEventListener('pointerover', function (e) { if (touch || viaTouch) return; var k = placeOf(e.target); if (k) { clearTimeout(hideT); lightUp(k); } });
    svg.addEventListener('pointerout', function (e) { if (touch || viaTouch) return; if (placeOf(e.target) && !placeOf(e.relatedTarget)) { clearTimeout(hideT); hideT = setTimeout(settle, 180); } });
    svg.addEventListener('focusin', function (e) { var k = placeOf(e.target); if (k) { clearTimeout(hideT); lightUp(k); } });
    svg.addEventListener('focusout', function (e) { if (placeOf(e.target) && !placeOf(e.relatedTarget)) hideT = setTimeout(settle, 180); });
    svg.addEventListener('click', function (e) {
      var k = placeOf(e.target); if (!k) return;
      if ((touch || viaTouch) && armed !== k) { e.preventDefault(); armed = k; lightUp(k); return; }
      if (c.local) { e.preventDefault(); root.dispatchEvent(new CustomEvent('navmap:go', { detail: k, bubbles: true })); }
    });
    keyboard(svg, places, (function () { var o = {}; ORDER.forEach(function (k) { o[k] = POS[k][0]; }); return o; })(), settle);
    document.addEventListener('click', function (e) { if (armed && !root.contains(e.target)) { armed = null; settle(); } });
    settle();
    if (scroller.scrollWidth > scroller.clientWidth + 4 && POS[here]) scroller.scrollLeft = POS[here][0] / W * scroller.scrollWidth - scroller.clientWidth / 2;
  }

  /* ---------------------------------------------------------------- the page you are on */
  function mountPage(root) {
    var c = common(root), here = c.here, id = 'nmp' + Math.floor(Math.random() * 1e6);
    if (!PAGE[here]) return;
    root.classList.add('navmap', 'nma', 'nma-page');
    root.innerHTML = '';
    var hereSec = SEC[PAGE[here].section];
    root.style.setProperty('--s-ink', hereSec.ink); root.style.setProperty('--glow', hereSec.line);
    head(root, '', 'Explore ReLEAF', '');
    var stage = h('div', 'nma-stage'); root.appendChild(stage);
    var scroller = h('div', 'nma-scroll'); stage.appendChild(scroller);
    var inner = h('div', 'nma-inner nma-inner--page'); scroller.appendChild(inner);

    var links = linksOf(here);
    var ins = links.filter(function (l) { return l.lane === 'in'; }), outs = links.filter(function (l) { return l.lane !== 'in'; });
    var PW = 2400, PH = 720, GY = 440;
    var s = '<svg class="nma-svg" viewBox="0 0 ' + PW + ' ' + PH + '" role="group" aria-label="' + esc(PAGE[here].name) + ' and the pages it links to. Arrow keys move between places.">' + defs(id);
    s += '<g class="nma-ground"><rect x="0" y="0" width="' + PW + '" height="' + PH + '" fill="url(#' + id + '-sky)"/>' + circ(1900, 70, 180, 'url(#' + id + '-sun)') + circ(1900, 70, 34, C.sun) + ell(420, 70, 110, 12, C.white, ' opacity=".4"') + ell(1300, 50, 140, 12, C.white, ' opacity=".35"');
    s += '<g filter="url(#' + id + '-brushsoft)">' + mountains(PW, 150, .62, 'url(#' + id + '-mist)') + '</g>';
    s += '<g filter="url(#' + id + '-brush)">' + rect(0, 210, PW, PH - 210, 'url(#' + id + '-ground)') + farFields(200, 292, PW) + treeline(280, PW, 70, .5);
    s += path('M0,300 C400,280 900,320 1300,300 S2000,280 2400,310 V720 H0 Z', 'url(#' + id + '-ground)') + path('M0,540 C500,520 1000,560 1500,540 S2100,530 2400,550 V720 H0 Z', C.plain2, ' opacity=".5"') + rect(0, 300, PW, PH - 300, '#fff', ' filter="url(#' + id + '-strokes)" opacity=".9"');
    s += roadPath('M-20,' + (GY + 50) + ' C400,' + (GY + 70) + ' 800,' + GY + ' 1200,' + (GY + 20) + ' S2000,' + (GY + 70) + ' 2420,' + (GY + 40), 40);
    s += ell(1200, GY + 96, 250, 40, C.pave2, ' opacity=".9"') + ell(1200, GY + 92, 240, 34, C.pave);
    for (var cx = 860; cx > 120; cx -= 160) s += stroke('M' + (cx + 14) + ',' + (GY + 44) + ' l-14,10 l14,10', 4, C.white, ' opacity=".55"');
    for (cx = 1540; cx < 2300; cx += 160) s += stroke('M' + (cx - 14) + ',' + (GY + 44) + ' l14,10 l-14,10', 4, C.white, ' opacity=".55"');
    s += flowers(40, 600, 500, 90, C.gold, 30) + flowers(1860, 600, 500, 90, C.white, 30);
    [[60, 690], [2340, 700], [1200, 350], [700, 700], [1700, 706]].forEach(function (p) { s += tree(p[0], p[1], 1.05 + (p[0] % 3) * .1, (p[0] >> 4) % 3); });
    s += bush(300, 680, .9) + bush(2080, 690, .9) + hay(2260, 640, 1) + tuft(500, 700) + tuft(1900, 710);
    s += '</g></g>';
    var POSP = {}; POSP[here] = [1200, GY + 96, 2.0 * Math.min(1, Math.sqrt(72 / PLACE[here].r))];
    function lane(list, dir) {
      var n = list.length; if (!n) return;
      list.forEach(function (l, i) {
        var t = (i + 1) / (n + 1);
        POSP[l.to] = [1200 + dir * (360 + t * 780), GY - 16 + (i % 2) * 86, 1.42 * Math.min(1, Math.sqrt(72 / PLACE[l.to].r))];
      });
    }
    lane(ins, -1); lane(outs, 1);
    var order = Object.keys(POSP).sort(function (a, b) { return POSP[a][1] - POSP[b][1]; });
    s += '<g class="nma-places" filter="url(#' + id + '-brush)">';
    order.forEach(function (slug) {
      var p = POSP[slug];
      if (slug === here) s += '<a aria-current="page" tabindex="0" aria-label="' + esc(PAGE[slug].name) + ', you are here">' + placeGroup(slug, p[0], p[1], p[2], 'nma-is-here') + '</a>';
      else s += '<a href="' + c.href(slug) + '" aria-label="' + esc(PAGE[slug].name) + '">' + placeGroup(slug, p[0], p[1], p[2], '') + '</a>';
    });
    s += '</g>';
    s += '<rect class="nma-dusk" x="0" y="0" width="' + PW + '" height="' + PH + '"/>';
    s += '<g class="nma-litlayer" filter="url(#' + id + '-brush)"></g>';
    var hp = POSP[here]; s += beacon(hp[0], hp[1] - PLACE[here].r * 1.3 * hp[2] - 6, hereSec.ink);
    s += '<rect class="nma-paper" x="0" y="0" width="' + PW + '" height="' + PH + '" filter="url(#' + id + '-grain)"/>';
    s += '<g class="nma-tags">'; Object.keys(POSP).forEach(function (slug) { s += tagFor(slug, here); }); s += '</g>';
    s += '</svg>';
    inner.innerHTML = s;
    var svg = inner.querySelector('svg');
    var places = {}; inner.querySelectorAll('.nma-place').forEach(function (gg) { places[gg.getAttribute('data-page')] = gg; });
    var light = lighting(svg, places, order, svg.querySelector('.nma-places'), svg.querySelector('.nma-litlayer'));
    layoutTags(svg, function (slug) { var p = POSP[slug]; return [p[0], p[1] - PLACE[slug].r * 1.35 * p[2] - (slug === here ? 66 : 18), p[1] - PLACE[slug].r * 1.1 * p[2] - (slug === here ? 50 : 0)]; }, Object.keys(POSP));
    var rows = {};
    function tagOf(slug) { return svg.querySelector('.nma-tag[data-for="' + slug + '"]'); }
    function lit(slug, on) {
      if (on) {
        root.setAttribute('data-lit', slug);
        light.lift(slug === here ? [here] : [here, slug]);
        places[slug].parentNode.classList.add('nma-active');
        tagOf(slug).classList.add('nma-show');
        if (rows[slug]) rows[slug].classList.add('nma-lit');
      } else {
        root.removeAttribute('data-lit');
        light.drop();
        tagOf(slug).classList.remove('nma-show');
        if (rows[slug]) rows[slug].classList.remove('nma-lit');
          }
    }
    var touch = window.matchMedia('(hover: none)').matches, viaTouch = false, armed = null;
    svg.addEventListener('pointerdown', function (e) { viaTouch = e.pointerType !== 'mouse'; }, true);
    function placeOf(t) { var a = t && t.closest ? t.closest('a') : null; var gg = a && a.querySelector('.nma-place'); return gg ? gg.getAttribute('data-page') : null; }
    svg.addEventListener('pointerover', function (e) { if (touch || viaTouch) return; var k = placeOf(e.target); if (k) lit(k, true); });
    svg.addEventListener('pointerout', function (e) { if (touch || viaTouch) return; var k = placeOf(e.target); if (k && !placeOf(e.relatedTarget)) lit(k, false); });
    svg.addEventListener('focusin', function (e) { var k = placeOf(e.target); if (k) lit(k, true); });
    svg.addEventListener('focusout', function (e) { var k = placeOf(e.target); if (k && !placeOf(e.relatedTarget)) lit(k, false); });
    svg.addEventListener('click', function (e) {
      var k = placeOf(e.target); if (!k) return;
      if (k === here) { e.preventDefault(); return; }
      if ((touch || viaTouch) && armed !== k) { e.preventDefault(); if (armed) lit(armed, false); armed = k; lit(k, true); return; }
      if (c.local) { e.preventDefault(); root.dispatchEvent(new CustomEvent('navmap:go', { detail: k, bubbles: true })); }
    });
    keyboard(svg, places, (function () { var o = {}; Object.keys(POSP).forEach(function (k) { o[k] = POSP[k][0]; }); return o; })(), function () { if (armed) { lit(armed, false); armed = null; } });
    document.addEventListener('click', function (e) { if (armed && !root.contains(e.target)) { lit(armed, false); armed = null; } });

    var cap = h('div', 'nma-cap nma-cap--page'); root.appendChild(cap);
    var hd = h('div', 'nma-cap__head');
    hd.appendChild(h('span', 'nma-cap__eyebrow', 'You are here · ' + hereSec.name));
    hd.appendChild(h('span', 'nma-cap__name', PAGE[here].name));
    hd.appendChild(h('span', 'nma-cap__line', PAGE[here].caption));
    cap.appendChild(hd);
    var lanesEl = h('div', 'nma-lanes');
    [['in', 'Builds on', ins], ['out', 'Leads to', outs]].forEach(function (L) {
      var col = h('div', 'nma-lanecol nma-lanecol--' + L[0]);
      var hh = h('h4', null, L[1]); hh.setAttribute('data-no-toc', ''); col.appendChild(hh);
      var ul = h('ul', 'nma-cap__links');
      L[2].forEach(function (l) {
        var li = h('li'); var a = h('a'); a.href = c.href(l.to);
        var ls = SEC[PAGE[l.to].section]; a.style.setProperty('--s-ink', ls.ink); a.style.setProperty('--s-pill', ls.pill);
        a.appendChild(h('b', null, PAGE[l.to].name));
        a.appendChild(h('span', null, l.why));
        if (l.next) a.appendChild(h('i', 'nm-next', 'Read next'));
        a.addEventListener('mouseenter', function () { lit(l.to, true); });
        a.addEventListener('mouseleave', function () { lit(l.to, false); });
        if (c.local) a.addEventListener('click', function (e) { e.preventDefault(); root.dispatchEvent(new CustomEvent('navmap:go', { detail: l.to, bubbles: true })); });
        rows[l.to] = a;
        li.appendChild(a); ul.appendChild(li);
      });
      col.appendChild(ul); lanesEl.appendChild(col);
    });
    cap.appendChild(lanesEl);
    if (scroller.scrollWidth > scroller.clientWidth + 4) scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
  }

  function mount(root) { if (root.getAttribute('data-art') === 'all') mountAll(root); else mountPage(root); }
  window.NavMapArt = { mount: mount, places: PLACE, positions: POS,
    // the drawing library, for the page scenes (scene.js)
    lib: { C: C, PLACE: PLACE, SEC: SEC, PAGE: PAGE, ORDER: ORDER, ZONES: ZONES, W: W, H: H,
      poly: poly, path: path, ell: ell, circ: circ, rect: rect, line: line, stroke: stroke, at: at, pool: pool, cast: cast, prism: prism, gable: gable, jitter: jitter, ridge: ridge, r1: r1, esc: esc, mul: mul,
      tree: tree, pine: pine, bush: bush, person: person, house: house, hay: hay, fence: fence, pot: pot, flowers: flowers, tuft: tuft,
      roadPath: roadPath, slab: slab, pavilion: pavilion, mountains: mountains, treeline: treeline, farFields: farFields, defs: defs,
      beacon: beacon, lighting: lighting, keyboard: keyboard, layoutTags: layoutTags, tagFor: tagFor, placeGroup: placeGroup,
      linksOf: linksOf, keyLinks: keyLinks, neighbours: neighbours, common: common, head: head, h: h, note: note, setSeed: function (v) { seed = v; } } };
  function init() {
    // data-art="scene" belongs to scene.js; mounting it here would draw the page
    // road first and have the scene replace it a moment later.
    var all = document.querySelectorAll('section.navmap[data-art]');
    for (var i = 0; i < all.length; i++) {
      if (all[i].hasAttribute('data-manual')) continue;
      if (all[i].getAttribute('data-art') === 'scene') continue;
      mount(all[i]);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
