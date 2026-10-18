/* =============================================================================
   ReLeaf homepage: 01 THE THREAT, the map (was home.js piece 8).
   -----------------------------------------------------------------------------
   The island at night, drawn live and sharp at every zoom. One WebGL 2 pass
   draws the sea, the land and the farmland as light; one SVG on top draws the
   coast, the county borders and the focused place's outline as hairlines.
   Both read the same camera, so the scroll moves them together.

   THE DATA. assets/data/threat-counties.js (county outlines as vectors and
   their classes) and threat-farmland-hi.webp (farmland as a mask at three
   times the canvas), both made by build/threat-vector.py. The section names
   both in data-counties and data-mask; the county data is loaded only where
   the live map runs (phones and the resting version never fetch it).

   THE CANVAS is 840 x 1267 units, x right, y down,
   x = 336.3 lon - 40180, y = -358.3 lat + 9080. A view is a point on it
   (data-x, data-y, fractions) and a zoom (data-z, 1 shows the whole island
   92% of the screen tall); the point sits at (FX, FY) of the screen.

   THE LAYERS, one per stop (data-layer on each li.tm-stop):
     vol     volatility by county: each county tinted a deep shade of its
             class, its farmland lit in the class colour
     conv    farmland lit in its county's volatility class
     nights  farmland lit in its county's night-temperature class
     age     farmland lit in its county's farmer-age class
     small   all farmland, the site's green
   Each measure has its own colour family, darkest for the lowest class and
   brightest for the highest: volatility violet to gold, night temperature
   night blue to peach, farmer age slate to ice. The colours are the custom
   properties --tm-v*, --tm-n*, --tm-a* and --tm-farm in home-threat.css; this
   file reads them, so the keys and the map cannot drift apart. Dense
   farmland shows its class colour exactly (the key's swatch); the gaps
   between fields, roads and rivers stay dark.

   THE FOCUS (data-focus, data-mark on a stop): the counties named in
   data-focus keep full light while the rest of the island steps down to 78%
   (still its own colour), their outline is drawn, a soft pool of light lies
   under them, and a callout names the place (data-mark-name, data-mark-note).
   The callout picks the side of the place where its label sits on the sea or
   on unlit land, clear of the words. Outlines and callouts fade out early in
   each move and come back at the next stop.

   THE RESTING STATE IS COMPLETE. Without script, without WebGL 2, with
   reduced motion, while printing or on a small screen, nothing here runs and
   the stops stand one under the other with stills of this same renderer
   (threat-map-1..5.webp, made by build/threat-stills.html).
   ========================================================================== */

(function () {
  "use strict";

  var CW = 840, CH = 1267;   // the canvas, in units
  var PAD = 24;              // margin round the canvas in the textures built here
  var CS = 1.5;              // land distance field: texels per unit
  var KS = 1;                // classes and focus: texels per unit
  var BS = 0.5;              // glows and relief: texels per unit
  var HZ = 0.92;             // the island's height on screen at zoom 1
  var LAYERS = ["vol", "conv", "nights", "age", "small"];

  /* ------------------------------------------------------------ geometry --- */

  function ringsOf(d) {
    return d.split("M").filter(Boolean).map(function (r) { return r.replace(/Z/g, "").split("L"); });
  }

  // Shared borders in threat-counties.js share their vertices, so an edge
  // that two counties both have is a border and an edge only one has is
  // coast (or the outside of a group). The one-sided edges close into rings:
  // the longest is the coast, rings outside it are islands, and rings inside
  // it are slivers the county shapes leave between them (river beds on a
  // border, mostly), which are land and drawn as border.
  function edges(list) {
    var count = {};
    list.forEach(function (c) {
      ringsOf(c.d).forEach(function (r) {
        for (var i = 0; i < r.length; i++) {
          var a = r[i], b = r[(i + 1) % r.length];
          if (a === b) continue;
          var k = a < b ? a + "|" + b : b + "|" + a;
          count[k] = (count[k] || 0) + 1;
        }
      });
    });
    var once = [], twice = [];
    Object.keys(count).forEach(function (k) { (count[k] === 1 ? once : twice).push(k.split("|")); });
    var rings = chain(once), main = 0;
    rings.forEach(function (r, i) { if (r.length > rings[main].length) main = i; });
    var poly = rings.length ? rings[main].map(function (p) { return p.split(",").map(Number); }) : [];
    var outer = [], gaps = [];
    rings.forEach(function (r, i) {
      var mx = 0, my = 0;
      r.forEach(function (p) { var q = p.split(","); mx += +q[0]; my += +q[1]; });
      (i !== main && inside(mx / r.length, my / r.length, poly) ? gaps : outer).push(r);
    });
    return { outer: path(outer), inner: path(chain(twice)) + path(gaps), gaps: path(gaps) };
  }
  function inside(x, y, poly) {
    for (var c = false, i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function path(lines) { return lines.map(function (l) { return "M" + l.join("L"); }).join(""); }

  // segments [a, b] (vertex strings) into polylines, each a list of vertices
  function chain(segs) {
    var at = {}, used = new Array(segs.length), out = [];
    segs.forEach(function (s, i) { (at[s[0]] = at[s[0]] || []).push(i); (at[s[1]] = at[s[1]] || []).push(i); });
    function next(p) {
      var l = at[p] || [];
      for (var j = 0; j < l.length; j++) if (!used[l[j]]) return l[j];
      return -1;
    }
    for (var i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      var line = [segs[i][0], segs[i][1]];
      var e;
      while ((e = next(line[line.length - 1])) >= 0) { used[e] = true; line.push(segs[e][0] === line[line.length - 1] ? segs[e][1] : segs[e][0]); }
      while ((e = next(line[0])) >= 0) { used[e] = true; line.unshift(segs[e][0] === line[0] ? segs[e][1] : segs[e][0]); }
      out.push(line);
    }
    return out;
  }

  /* ------------------------------------------------- blur, distance field --- */

  // three box passes, about a Gaussian of sd s (texels), in place
  function blur(a, w, h, s) {
    if (s <= 0) return a;
    var r = Math.max(1, Math.round((Math.sqrt(4 * s * s + 1) - 1) / 2));
    var t = new Float32Array(a.length);
    for (var pass = 0; pass < 3; pass++) { box(a, t, w, h, r, 1, w); box(t, a, h, w, r, w, 1); }
    return a;
  }
  function box(src, dst, n, rows, r, st, ls) {
    var k = 1 / (2 * r + 1);
    for (var y = 0; y < rows; y++) {
      var o = y * ls, acc = 0, i;
      for (i = -r; i <= r; i++) acc += src[o + Math.min(n - 1, Math.max(0, i)) * st];
      for (i = 0; i < n; i++) {
        dst[o + i * st] = acc * k;
        acc += src[o + Math.min(n - 1, i + r + 1) * st] - src[o + Math.max(0, i - r) * st];
      }
    }
  }
  // squared distance transform along one line (Felzenszwalb and Huttenlocher),
  // f and d of length n, v and z scratch
  var INF = 1e20;
  function edt1(f, d, n, v, z) {
    var k = 0, q, s;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (q = 1; q < n; q++) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  // one pass of the 2D transform over lines [a, b): columns (dir 0) or rows (1)
  function edtPass(g, w, h, dir, a, b) {
    var n = dir ? w : h, f = new Float64Array(n), d = new Float64Array(n);
    var v = new Int32Array(n), z = new Float64Array(n + 1), i, j;
    for (j = a; j < b; j++) {
      if (dir) { for (i = 0; i < n; i++) f[i] = g[j * w + i]; }
      else { for (i = 0; i < n; i++) f[i] = g[i * w + j]; }
      edt1(f, d, n, v, z);
      if (dir) { for (i = 0; i < n; i++) g[j * w + i] = d[i]; }
      else { for (i = 0; i < n; i++) g[i * w + j] = d[i]; }
    }
  }

  /* ------------------------------------------------------------- colour --- */

  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function hexLin(h) {
    h = (h || "").trim().replace("#", "");
    if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
    var n = parseInt(h, 16);
    if (isNaN(n)) return [0.5, 0.5, 0.5];
    return [lin(n >> 16 & 255), lin(n >> 8 & 255), lin(n & 255)];
  }

  /* ------------------------------------------------------------ shaders --- */

  var VS = "#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}";

  var FS = [
    "#version 300 es",
    "precision highp float;",
    "uniform sampler2D uFarm, uCls, uSdf, uBlur, uFoc;",
    "uniform vec2 uRes, uOff;",
    "uniform float uDpr, uS, uFarmIn, uT, uWash, uTxt, uStill;",
    "uniform int uLA, uLB;",
    "uniform vec4 uFw;",
    "uniform vec3 uFp;",
    "uniform vec3 uWv;",
    "uniform vec3 uPal[14];",
    "out vec4 outC;",
    "const float PAD = " + PAD.toFixed(1) + ";",
    "const vec3 SEA = vec3(1.);",                            // white (18 Oct, owner; was #e4ebea)
    "const vec3 GROUND = vec3(.930, .921, .871);",           // #f7f6f0, paper
    "vec3 toOk(vec3 c){",
    "  vec3 l = vec3(dot(c, vec3(.4122214708, .5363325363, .0514459929)), dot(c, vec3(.2119034982, .6806995451, .1073969566)), dot(c, vec3(.0883024619, .2817188376, .6299787005)));",
    "  l = pow(max(l, 0.), vec3(1. / 3.));",
    "  return vec3(dot(l, vec3(.2104542553, .7936177850, -.0040720468)), dot(l, vec3(1.9779984951, -2.4285922050, .4505937099)), dot(l, vec3(.0259040371, .7827717662, -.8086757660)));",
    "}",
    "vec3 fromOk(vec3 o){",
    "  vec3 l = vec3(o.x + .3963377774 * o.y + .2158037573 * o.z, o.x - .1055613458 * o.y - .0638541728 * o.z, o.x - .0894841775 * o.y - 1.2914855480 * o.z);",
    "  l = l * l * l;",
    "  return max(vec3(4.0767416621 * l.x - 3.3077115913 * l.y + .2309699292 * l.z, -1.2684380046 * l.x + 2.6097574011 * l.y - .3413193965 * l.z, -.0041960863 * l.x - .7034186147 * l.y + 1.7076147010 * l.z), 0.);",
    "}",
    // a class colour: vol 0-4, night 5-9, age 10-12, farm 13 in uPal
    "vec3 pal(int L, vec3 c){",
    "  if (L >= 4) return uPal[13];",
    "  float v = L <= 1 ? c.r : L == 2 ? c.g : c.b;",
    "  int base = L <= 1 ? 0 : L == 2 ? 5 : 10;",
    "  float n = L == 3 ? 2. : 4.;",
    "  float f = clamp(v, 0., 1.) * n;",
    "  float i = min(floor(f), n - 1.);",
    "  return mix(uPal[base + int(i)], uPal[base + int(i) + 1], f - i);",
    "}",
    "float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "vec3 enc(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }",
    "void main(){",
    "  vec2 vw = uRes / uDpr;",
    "  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;",
    "  vec2 p = (px - uOff) / uS;",                                   // canvas units
    "  vec2 uv = p / vec2(840., 1267.);",
    "  vec2 tuv = (p + PAD) / vec2(840. + 2. * PAD, 1267. + 2. * PAD);",
    "  float inb = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);",
    "  float au = 1. / uS;",                                         // one css px, in units
    "  float sd = texture(uSdf, tuv).r;",                            // to the coast, + on land
    "  float land = smoothstep(-.55 * au, .55 * au, sd);",
    "  vec3 cls = texture(uCls, tuv).rgb;",
    "  vec4 bl = texture(uBlur, tuv);",
    "  vec4 fo = texture(uFoc, tuv);",
    // the sea: a soft grey-blue, a little deeper along the coast
    "  float off = max(-sd, 0.);",
    "  vec3 sea = SEA * (1. - .07 * exp(-off / (3.2 * au)) - .03 * exp(-off / 14.));",
    // a one-degree graticule, very faint, on the sea only
    "  vec2 g = vec2((p.x + 40180.) / 336.3, (9080. - p.y) / 358.3);",
    "  vec2 gd = abs(fract(g + .5) - .5) / max(fwidth(g), vec2(1e-6));",
    "  float gline = (1. - clamp(min(gd.x, gd.y) - .35, 0., 1.)) * smoothstep(3., 12., off);",
    // the land: paper, with a soft relief where there is no farmland (the
    // mountains), lit from the north-west
    "  vec3 nrm = normalize(vec3(-bl.ba * 26., 1.));",
    "  float sh = dot(nrm, normalize(vec3(-.55, -.62, .56))) - .56 / length(vec3(-.55, -.62, .56));",
    "  float shade = clamp(1. + 1.15 * sh, .8, 1.06);",
    "  vec3 ground = GROUND * shade;",
    // the focus: the focused counties keep their colour, the rest of the
    // island fades halfway towards the paper
    "  float fs = clamp(uFw.x + uFw.y + uFw.z + uFw.w, 0., 1.);",
    "  float fm = clamp(dot(fo, uFw) / max(fs, 1e-3), 0., 1.);",
    "  float dimF = mix(1., mix(.5, 1., fm), fs);",
    // the words sit on the left: the colours fall away under them
    "  float dimT = uTxt > 0. ? mix(.22, 1., smoothstep(uTxt + 4., uTxt + 150., px.x)) : 1.;",
    "  float k = dimF * dimT;",
    "  sea *= 1. - .0 * gline * dimT;",                       // 18 Oct: no graticule on the white
    // a move between two layers is a wave: the next layer's colours spread
    // out from the next place, so no two colourings mix for long
    "  float wr = length(px - (uOff + uWv.xy * uS)) / length(vw);",
    "  float tl = clamp((uT * 1.45 - wr) / .45, 0., 1.);",
    "  tl = tl * tl * (3. - 2. * tl);",
    "  float wash = mix(uWash, uWv.z, tl);",
    // stop 1: each county tinted with its volatility class
    "  vec3 landC = mix(ground, pal(0, cls) * mix(1., shade, .6), (.16 + .3 * cls.r) * wash * k);",
    // the farmland as ink, in its layer's colour; two layers meet in OKLab
    "  vec3 cA = pal(uLA, cls), cB = pal(uLB, cls);",
    "  vec3 fc = tl <= 0. ? cA : tl >= 1. ? cB : fromOk(mix(toOk(cA), toOk(cB), tl));",
    "  float clip = smoothstep(0., 1.1 * au, sd);",
    // the mask's own detail is lifted against its blur, so dense plains keep
    // their roads, rivers and field gaps; a faint tint of the colour round
    // the fields carries them on the paper
    "  float fr = texture(uFarm, uv).a;",
    "  float farm = clamp(fr + .9 * (fr - bl.r), 0., 1.) * inb * clip * uFarmIn;",
    "  float tint = (bl.r * .2 + bl.g * .22 * (1. - .7 * bl.r)) * uFarmIn * smoothstep(-1.5, .5, sd);",
    "  vec3 lc = mix(landC, fc, tint * k * (1. - farm));",
    "  vec3 c = mix(sea, mix(lc, fc, farm * k), land);",
    // develop: vignette, then sRGB and a little grain
    "  vec3 o = enc(c) + (h21(gl_FragCoord.xy + 13.) - .5) * (1.5 / 255.);",
    "  outC = vec4(o, 1.);",
    "}"
  ].join("\n");

  /* ----------------------------------------------------------- renderer --- */
  /* MapView(host, opt) puts a canvas and an SVG in host and returns
     { size(w, h, dpr), setCap(px), draw(view), ready, counties, coast, gaps,
     farmAt, landAt, focusAt, linesIn } or null without WebGL 2, the county
     data or a hardware renderer. view = { x, y, z, fx, fy, la, lb (layers),
     t (0..1 from la to lb), wash (stop 1's tint), wv: [x, y, wash] (where
     the next layer spreads from, and its tint), fw: [3] (focus weights),
     fp: [x, y, strength] (the pool of light), txt (the words' right edge,
     px), still }. opt.foci: up to three focus sets (county names, comma
     separated), in the order view.fw weighs them. opt.mask: the mask's URL.
     opt.pal: the palette (14 hexes). opt.keep keeps the drawing buffer and
     opt.allowSoft allows a software renderer (both for the stills). */

  function MapView(host, opt) {
    opt = opt || {};
    var all = window.THREAT_COUNTIES;
    if (!all || !all.length || !window.WebGL2RenderingContext) return null;
    var list = all.filter(function (c) { return !/Penghu/.test(c.name); });

    var cvs = document.createElement("canvas");
    cvs.className = "tm-gl";
    var gl = cvs.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false,
                                        preserveDrawingBuffer: !!opt.keep });
    if (!gl) return null;
    // a software renderer cannot draw this at scrolling speed: the section
    // keeps its resting stills instead
    var dbgr = gl.getExtension("WEBGL_debug_renderer_info");
    var soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(dbgr ? String(gl.getParameter(dbgr.UNMASKED_RENDERER_WEBGL)) : "");
    if (soft && !opt.allowSoft) return null;

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    var U = {};
    ["uFarm", "uCls", "uSdf", "uBlur", "uFoc", "uRes", "uOff", "uDpr", "uS", "uFarmIn", "uT", "uWash", "uTxt",
     "uStill", "uLA", "uLB", "uFw", "uFp", "uWv", "uPal"].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    gl.uniform1i(U.uFarm, 0); gl.uniform1i(U.uCls, 1); gl.uniform1i(U.uSdf, 2); gl.uniform1i(U.uBlur, 3); gl.uniform1i(U.uFoc, 4);
    var pal = [];
    (opt.pal || []).forEach(function (h) { pal.push.apply(pal, hexLin(h)); });
    while (pal.length < 42) pal.push(0.5);
    gl.uniform3fv(U.uPal, new Float32Array(pal));

    function tex(unit) {
      var t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    // five textures, empty until the build below fills them
    tex(0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 1, 1, 0, gl.ALPHA, gl.UNSIGNED_BYTE, new Uint8Array(1));
    tex(1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    tex(2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([-40]));
    tex(3); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(4));
    tex(4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));

    // THE BUILD runs as a queue of steps of a few to about fifteen
    // milliseconds each, in idle time, so it never holds up a frame of the
    // page's scroll. The driver starts it two screens before the map is seen.
    var steps = [], busy = false, lost = false;
    var idle = window.requestIdleCallback ? function (f) { window.requestIdleCallback(f, { timeout: 100 }); }
                                          : function (f) { window.setTimeout(f, 16); };
    function queue(fn) { steps.push(fn); pump(); }
    function pump() {
      if (busy || !steps.length) return;
      busy = true;
      idle(function () {
        busy = false;
        if (lost) { steps = []; return; }
        var t0 = performance.now();
        // run short steps back to back while there is time in this slot
        do { steps.shift()(); } while (steps.length && steps[0].quick && performance.now() - t0 < 8);
        if (last) draw(last);
        pump();
      });
    }
    function quick(fn) { fn.quick = true; return fn; }

    var ed = edges(list);
    var paths = list.map(function (c) { return new Path2D(c.d); });
    var landPath = new Path2D(list.map(function (c) { return c.d; }).join("") + (ed.gaps || ""));
    function grid(sc) { return [Math.round((CW + 2 * PAD) * sc), Math.round((CH + 2 * PAD) * sc)]; }
    function ctx2d(w, h, sc) {
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var x = c.getContext("2d", { willReadFrequently: true });
      x.setTransform(sc, 0, 0, sc, PAD * sc, PAD * sc);
      return x;
    }

    // classes (unit 1): r vol, g night, b age, as 0..1. The colours reach a
    // few units past the coast so farmland on the shore takes its county's.
    var KG = grid(KS);
    queue(function () {
      var x = ctx2d(KG[0], KG[1], KS);
      function rgb(c) {
        return "rgb(" + Math.round((c.vol - 1) / 4 * 255) + "," + Math.round((c.night - 1) / 4 * 255) + "," +
               Math.round((c.age - 1) / 2 * 255) + ")";
      }
      x.lineJoin = "round"; x.lineWidth = 8;
      list.forEach(function (c, i) { x.strokeStyle = rgb(c); x.stroke(paths[i]); });
      list.forEach(function (c, i) { x.fillStyle = rgb(c); x.fill(paths[i]); });
      var d = x.getImageData(0, 0, KG[0], KG[1]).data;
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, KG[0], KG[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(d.buffer));
    });
    // focus sets (unit 4): one channel each, 1 inside the set's counties
    var foci = (opt.foci || []).slice(0, 3), focusGrid = null;
    queue(function () {
      var x = ctx2d(KG[0], KG[1], KS);
      x.globalCompositeOperation = "lighter";
      x.lineJoin = "round"; x.lineWidth = 3;
      foci.forEach(function (key, j) {
        var names = key.split(","), col = ["#f00", "#0f0", "#00f"][j];
        list.forEach(function (c, i) {
          if (names.indexOf(c.name) < 0) return;
          x.fillStyle = col; x.strokeStyle = col;
          x.fill(paths[i]); x.stroke(paths[i]);
        });
      });
      var d = x.getImageData(0, 0, KG[0], KG[1]).data;
      focusGrid = new Uint8Array(KG[0] * KG[1]);
      for (var i = 0; i < focusGrid.length; i++) focusGrid[i] = (d[4 * i] > 127 ? 1 : 0) | (d[4 * i + 1] > 127 ? 2 : 0) | (d[4 * i + 2] > 127 ? 4 : 0);
      gl.activeTexture(gl.TEXTURE4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, KG[0], KG[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(d.buffer));
    });

    // the land's distance field (unit 2): signed distance to the coast in
    // units, positive on land, from an antialiased fill and an exact
    // distance transform, so the coast stays smooth at every zoom and the
    // farmland can be cut exactly at it. Built in strips.
    var SG = grid(CS), sw = SG[0], shh = SG[1], cov, gin, gout;
    queue(function () {
      var x = ctx2d(sw, shh, CS);
      x.fillStyle = "#fff"; x.fill(landPath);
      var d = x.getImageData(0, 0, sw, shh).data;
      cov = new Float32Array(sw * shh); gin = new Float32Array(sw * shh); gout = new Float32Array(sw * shh);
      for (var i = 0; i < sw * shh; i++) {
        var a = d[4 * i + 3] / 255;
        cov[i] = a;
        gin[i] = a >= 0.5 ? 0 : INF;    // squared distance to land
        gout[i] = a >= 0.5 ? INF : 0;   // squared distance to sea
      }
    });
    var STRIP = 60;
    [0, 1].forEach(function (dir) {
      var n = dir ? shh : sw;
      for (var a = 0; a < n; a += STRIP) (function (a0) {
        queue(quick(function () { var b = Math.min(n, a0 + STRIP); edtPass(gin, sw, shh, dir, a0, b); edtPass(gout, sw, shh, dir, a0, b); }));
      })(a);
    });
    var landGrid = null;
    queue(function () {
      var f = new Float32Array(sw * shh);
      landGrid = new Uint8Array(sw * shh);
      for (var i = 0; i < sw * shh; i++) {
        var a = cov[i], s;
        landGrid[i] = a >= 0.5 ? 1 : 0;
        if (a > 0.02 && a < 0.98) s = a - 0.5;
        else s = a >= 0.5 ? Math.sqrt(gout[i]) - 0.5 : 0.5 - Math.sqrt(gin[i]);
        f[i] = Math.max(-40, Math.min(40, s / CS));
      }
      gl.activeTexture(gl.TEXTURE2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, sw, shh, 0, gl.RED, gl.FLOAT, f);
      gin = gout = cov = null;
    });

    // glows and relief (unit 3): r, g the farmland blurred at two widths,
    // b, a the slope of a soft relief: land where there is no farmland,
    // which is mostly the mountains
    var BG = grid(BS), bw = BG[0], bh = BG[1], landB = null;
    queue(function () {
      landB = new Float32Array(bw * bh);
      var x = ctx2d(bw, bh, BS);
      x.fillStyle = "#fff"; x.fill(landPath);
      var d = x.getImageData(0, 0, bw, bh).data;
      for (var i = 0; i < bw * bh; i++) landB[i] = d[4 * i + 3] / 255;
    });
    function packGlow(F1, F2) {
      var H = new Float32Array(bw * bh), i;
      for (i = 0; i < bw * bh; i++) H[i] = landB[i] * (1 - Math.min(1, (F2 ? F2[i] : 0) * 2.2));
      blur(H, bw, bh, 4 * BS);
      var out = new Float32Array(bw * bh * 4);
      for (var y = 0; y < bh; y++) for (var xx = 0; xx < bw; xx++) {
        i = y * bw + xx;
        var xa = Math.max(0, xx - 1), xb = Math.min(bw - 1, xx + 1), ya = Math.max(0, y - 1), yb = Math.min(bh - 1, y + 1);
        out[4 * i] = F1 ? F1[i] : 0;
        out[4 * i + 1] = F2 ? F2[i] : 0;
        out[4 * i + 2] = (H[y * bw + xb] - H[y * bw + xa]) / ((xb - xa) / BS);   // per unit
        out[4 * i + 3] = (H[yb * bw + xx] - H[ya * bw + xx]) / ((yb - ya) / BS);
      }
      gl.activeTexture(gl.TEXTURE3);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, bw, bh, 0, gl.RGBA, gl.FLOAT, out);
    }
    var farmB = null;   // the farmland, blurred, kept for placing callouts
    function farmAt(x, y) {
      if (!farmB) return 0;
      var i = Math.round((x + PAD) * BS), j = Math.round((y + PAD) * BS);
      if (i < 0 || j < 0 || i >= bw || j >= bh) return 0;
      return farmB[j * bw + i];
    }

    /* the lines: coast and borders, and an outline for each focus */
    var NS = "http://www.w3.org/2000/svg";
    function el(name, attrs, parent) {
      var e = document.createElementNS(NS, name);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    }
    var svg = el("svg", { "class": "tm-vec", preserveAspectRatio: "none", viewBox: "0 0 840 1267", "aria-hidden": "true" });
    function line(d, cls, parent) { return el("path", { d: d, "class": cls, "vector-effect": "non-scaling-stroke" }, parent || svg); }
    line(ed.inner, "tm-v-border");
    line(ed.outer, "tm-v-coast");
    var outlines = foci.map(function (key) {
      var names = key.split(",");
      var g = el("g", { "class": "tm-v-focus", opacity: "0" }, svg);
      var d = edges(list.filter(function (c) { return names.indexOf(c.name) >= 0; })).outer;
      line(d, "tm-v-focus__wide", g); line(d, "tm-v-focus__thin", g);
      return g;
    });

    host.appendChild(cvs);
    host.appendChild(svg);

    var W = 1, H = 1, D = 1, cap = 5.2e6, dprWanted = 1, farmIn = 0, last = null;
    cvs.addEventListener("webglcontextlost", function (e) { e.preventDefault(); lost = true; if (opt.onlost) opt.onlost(); });

    function size(w, h, dpr) {
      W = Math.max(1, w); H = Math.max(1, h); dprWanted = dpr || 1;
      // at most about 5.2 million pixels drawn (1440 x 900 at 2x), less on a
      // slow GPU (setCap)
      D = Math.max(0.5, Math.min(dprWanted, 2, Math.sqrt(cap / (W * H))));
      cvs.width = Math.round(W * D); cvs.height = Math.round(H * D);
      gl.viewport(0, 0, cvs.width, cvs.height);
      if (last) draw(last);
    }
    function setCap(px) { cap = px; size(W, H, dprWanted); }

    function draw(v) {
      last = v;
      if (lost) return null;
      var s = HZ * H * v.z / CH;                       // px per unit
      var ox = v.fx * W - v.x * CW * s, oy = v.fy * H - v.y * CH * s;
      gl.uniform2f(U.uRes, cvs.width, cvs.height);
      gl.uniform1f(U.uDpr, cvs.width / W);
      gl.uniform2f(U.uOff, ox, oy);
      gl.uniform1f(U.uS, s);
      gl.uniform1f(U.uFarmIn, farmIn);
      gl.uniform1i(U.uLA, v.la); gl.uniform1i(U.uLB, v.lb);
      gl.uniform1f(U.uT, v.t); gl.uniform1f(U.uWash, v.wash);
      gl.uniform4f(U.uFw, v.fw[0] || 0, v.fw[1] || 0, v.fw[2] || 0, v.fw[3] || 0);
      gl.uniform3f(U.uFp, v.fp[0], v.fp[1], v.fp[2]);
      var wv = v.wv || [v.x * CW, v.y * CH, v.wash];
      gl.uniform3f(U.uWv, wv[0], wv[1], wv[2]);
      gl.uniform1f(U.uTxt, v.txt || 0);
      gl.uniform1f(U.uStill, v.still ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      svg.setAttribute("viewBox", (-ox / s).toFixed(3) + " " + (-oy / s).toFixed(3) + " " +
                       (W / s).toFixed(3) + " " + (H / s).toFixed(3));
      outlines.forEach(function (g, j) {
        var o = (v.fw[j] || 0).toFixed(3);
        if (g.getAttribute("opacity") !== o) g.setAttribute("opacity", o);
      });
      return { s: s, ox: ox, oy: oy };
    }

    // the farmland mask, and the glows made from it, once. The mask goes up
    // in four strips and its small copy is scaled off the main thread
    // (createImageBitmap), so no step holds a frame for long.
    var ready = new Promise(function (res) {
      var img = new Image();
      img.decoding = "async";
      img.onload = function () {
        var IW = img.naturalWidth, IH = img.naturalHeight, NSTRIP = 4, SH = Math.ceil(IH / NSTRIP), j;
        var jobs = [];
        if (window.createImageBitmap) {
          try {
            for (j = 0; j < NSTRIP; j++) {
              jobs.push(createImageBitmap(img, 0, j * SH, IW, Math.min(SH, IH - j * SH), { premultiplyAlpha: "none", colorSpaceConversion: "none" }));
            }
            jobs.push(createImageBitmap(img, { resizeWidth: Math.round(CW * BS), resizeHeight: Math.round(CH * BS), resizeQuality: "high",
                                               premultiplyAlpha: "none", colorSpaceConversion: "none" }));
          } catch (e) { jobs = []; }
        }
        Promise.all(jobs).catch(function () { return []; }).then(function (bm) {
          var ok = bm.length === NSTRIP + 1;
          if (ok) {
            queue(function () {
              gl.activeTexture(gl.TEXTURE0);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, IW, IH, 0, gl.ALPHA, gl.UNSIGNED_BYTE, null);
            });
            bm.slice(0, NSTRIP).forEach(function (b, k) {
              queue(function () {
                gl.activeTexture(gl.TEXTURE0);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, k * SH, gl.ALPHA, gl.UNSIGNED_BYTE, b);
                if (b.close) b.close();
              });
            });
          } else {
            queue(function () {
              gl.activeTexture(gl.TEXTURE0);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, gl.ALPHA, gl.UNSIGNED_BYTE, img);
            });
          }
          queue(function () {
            gl.activeTexture(gl.TEXTURE0);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          });
          var F1, F2;
          queue(function () {
            var x = ctx2d(bw, bh, 1);
            x.setTransform(1, 0, 0, 1, 0, 0);
            x.imageSmoothingQuality = "high";
            x.drawImage(ok ? bm[NSTRIP] : img, PAD * BS, PAD * BS, CW * BS, CH * BS);
            if (ok && bm[NSTRIP].close) bm[NSTRIP].close();
            var a = x.getImageData(0, 0, bw, bh).data;
            F1 = new Float32Array(bw * bh); F2 = new Float32Array(bw * bh);
            for (var i = 0; i < bw * bh; i++) F1[i] = F2[i] = a[4 * i + 3] / 255;
            blur(F1, bw, bh, 4 * BS);
          });
          queue(function () { blur(F2, bw, bh, 12 * BS); });
          queue(function () { farmB = F1; packGlow(F1, F2); F1 = F2 = null; res(true); });
        });
      };
      img.onerror = function () { res(false); };
      img.src = opt.mask;
    });
    // the farmland comes up over 0.7 s once it is in
    ready.then(function (ok) {
      if (!ok) return;
      if (opt.keep) { farmIn = 1; if (last) draw(last); return; }
      var t0 = performance.now();
      (function up(now) {
        farmIn = Math.min(1, (now - t0) / 700);
        farmIn = farmIn * farmIn * (3 - 2 * farmIn);
        if (last) draw(last);
        if (farmIn < 1) requestAnimationFrame(up);
      })(t0);
    });

    var hit = document.createElement("canvas").getContext("2d");
    var focusPaths = foci.map(function (key) {
      var names = key.split(",");
      return new Path2D(list.filter(function (c) { return names.indexOf(c.name) >= 0; }).map(function (c) { return c.d; }).join(""));
    });
    function landAt(x, y) {
      if (!landGrid) return hit.isPointInPath(landPath, x, y);
      var i = Math.round((x + PAD) * CS), j = Math.round((y + PAD) * CS);
      return i >= 0 && j >= 0 && i < sw && j < shh && landGrid[j * sw + i] === 1;
    }
    // the vertices of the coast and of the borders, to keep labels off them
    function pts(d) { var a = []; d.replace(/([-\d.]+),([-\d.]+)/g, function (m, x, y) { a.push(+x, +y); return m; }); return new Float32Array(a); }
    var coastPts = pts(ed.outer), borderPts = pts(ed.inner);
    function linesIn(x0, y0, x1, y1) {
      var n = 0, i;
      for (i = 0; i < coastPts.length; i += 2) if (coastPts[i] > x0 && coastPts[i] < x1 && coastPts[i + 1] > y0 && coastPts[i + 1] < y1) n += 2;
      for (i = 0; i < borderPts.length; i += 2) if (borderPts[i] > x0 && borderPts[i] < x1 && borderPts[i + 1] > y0 && borderPts[i + 1] < y1) n++;
      return n;
    }
    function focusAt(j, x, y) {
      if (!focusGrid) return !!focusPaths[j] && hit.isPointInPath(focusPaths[j], x, y);
      var i = Math.round((x + PAD) * KS), k = Math.round((y + PAD) * KS);
      return i >= 0 && k >= 0 && i < KG[0] && k < KG[1] && (focusGrid[k * KG[0] + i] & (1 << j)) !== 0;
    }

    return { size: size, setCap: setCap, draw: draw, ready: ready, counties: list, coast: ed.outer, gaps: ed.gaps,
             farmAt: farmAt, landAt: landAt, focusAt: focusAt, linesIn: linesIn, canvas: cvs, svg: svg };
  }
  // for build/threat-stills.html, which renders the resting stills
  window.__tmMap = MapView;

  // the palette, from the custom properties on .tm (home-threat.css)
  function palette(elm) {
    var cs = window.getComputedStyle(elm);
    return ["--tm-v1", "--tm-v2", "--tm-v3", "--tm-v4", "--tm-v5", "--tm-n1", "--tm-n2", "--tm-n3", "--tm-n4", "--tm-n5",
            "--tm-a1", "--tm-a2", "--tm-a3", "--tm-farm"].map(function (k) { return cs.getPropertyValue(k); });
  }
  window.__tmPalette = palette;
  window.__tmLayers = LAYERS;
  if (window.__tmNoDriver) return;

  /* ------------------------------------------------------------- driver --- */
  /* Where the screen is wide and tall enough, .is-live (home-threat.css)
     turns .tm-run into a runway and holds .tm-pin; the scroll then walks the
     five stops. Between two stops the camera moves straight from one place
     to the next (x and y in a line, the zoom on a log scale), the colours
     move from one layer to the next in OKLab and the words swap; at each
     stop it holds so the words can be read. Everything is written in
     home.js's one frame (window.__homeFrame). */

  var th = document.getElementById("threat");
  var homeFrame = window.__homeFrame;
  if (!th || !homeFrame) return;
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var span = function (v, a, b) { return clamp01((v - a) / (b - a)); };
  var ease = function (t) { return t * t * (3 - 2 * t); };

  // the site's bar (its height keeps the callouts clear of it). Until 17 Oct
  // it went dark over the map; the map is light now, so the bar is as anywhere
  var nav = document.getElementById("site-nav");
  window.addEventListener("scroll", homeFrame.request, { passive: true });

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var run = th.querySelector(".tm-run");
  var pin = th.querySelector(".tm-pin");
  var map = th.querySelector(".tm-map");
  var card = th.querySelector(".tm-card");
  var inner = th.querySelector(".tm-inner");
  var stops = [].slice.call(th.querySelectorAll(".tm-stop"));
  homeFrame.request();
  if (!run || !pin || !map || !card || stops.length < 2 || !window.matchMedia || reduced) return;
  if (!window.WebGL2RenderingContext) return;
  var MASK = th.getAttribute("data-mask"), DATA = th.getAttribute("data-counties");
  if (!MASK || (!DATA && !window.THREAT_COUNTIES)) return;

  var V = stops.map(function (s) {
    var m = (s.getAttribute("data-mark") || "").split(",").map(Number);
    return { x: +s.getAttribute("data-x"), y: +s.getAttribute("data-y"), z: +s.getAttribute("data-z"),
             layer: Math.max(0, LAYERS.indexOf(s.getAttribute("data-layer"))),
             mark: m.length === 2 && !isNaN(m[0]) ? m : null,
             focus: s.getAttribute("data-focus") || "" };
  });
  var FOCI = [];
  V.forEach(function (v) { if (v.focus && FOCI.indexOf(v.focus) < 0) FOCI.push(v.focus); v.fi = FOCI.indexOf(v.focus); });
  var n = V.length;

  // the words of each stop come in one by one (home-threat.css): each word
  // in a span carrying its index. Only text nodes are split, on plain
  // spaces, so a non-breaking space keeps "0.29 °C" together.
  stops.forEach(function (st) {
    var say = st.querySelector(".tm-say");
    if (!say || say.getAttribute("data-split")) return;
    var i = 0;
    [].slice.call(say.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) return;
      var frag = document.createDocumentFragment();
      node.textContent.split(/( +|\n\s*)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        var w = document.createElement("span");
        w.className = "tm-w";
        w.style.setProperty("--w", i++);
        w.textContent = part;
        frag.appendChild(w);
      });
      say.replaceChild(frag, node);
    });
    say.setAttribute("data-split", "");
  });

  var mp = null, broken = false, near = false, loading = false;
  var marks = [], loc = null, locBox = null;
  var fits = window.matchMedia("(min-width: 900px) and (min-height: 620px)");
  var FX = 0.64, FY = 0.54;   // where the view's point sits on the screen
  var live = false, printing = false, cur = -1, txtEdge = 0, markOn = -1;

  // the callouts: a ring on the place, a leader and a shelf, the place's
  // name above the shelf and its class below
  function buildMarks() {
    V.forEach(function (v, i) {
      if (!v.mark) { marks.push(null); return; }
      var st = stops[i];
      var m = document.createElement("div");
      m.className = "tm-mark";
      m.setAttribute("aria-hidden", "true");
      m.innerHTML = '<svg class="tm-mark__lead" width="1" height="1"><circle class="tm-mark__under" r="9"/>' +
        '<circle class="tm-mark__ring" r="4.5"/><circle class="tm-mark__core" r="1.6"/><path pathLength="1"/></svg>' +
        '<span class="tm-mark__label"><b></b><span></span></span>';
      m.querySelector("b").textContent = st.getAttribute("data-mark-name") || "";
      // the class line; "|" in data-mark-note breaks it
      var note = m.querySelector(".tm-mark__label > span");
      (st.getAttribute("data-mark-note") || "").split("|").forEach(function (t, k) {
        if (k) note.appendChild(document.createElement("br"));
        note.appendChild(document.createTextNode(t.trim()));
      });
      map.appendChild(m);
      marks.push(m);
    });
  }
  // place each callout at its own stop: of the sides, angles and reaches
  // tried, the one whose label lies on the sea or on unlit land, off the
  // focused place and clear of every coast and border, inside the screen
  // and clear of the words, the nav and the locator. Where none is clear
  // (a narrow screen), the label sits on a plate of ink.
  function placeMarks() {
    var w = map.clientWidth, h = map.clientHeight;
    var navH = (nav && nav.offsetHeight) || 68;
    var locR = loc ? loc.getBoundingClientRect() : null, mapR = map.getBoundingClientRect();
    marks.forEach(function (mk, i) {
      if (!mk) return;
      var v = V[i], s = HZ * h * v.z / CH;
      var ox = FX * w - v.x * CW * s, oy = FY * h - v.y * CH * s;
      var mx = ox + v.mark[0] * s, my = oy + v.mark[1] * s;
      var lab = mk.querySelector(".tm-mark__label");
      lab.style.width = "auto";
      var lw = lab.offsetWidth, nameH = lab.querySelector("b").offsetHeight, lh = lab.offsetHeight;
      var shelf = Math.max(lw + 10, 64), best = null;
      [1, -1].forEach(function (side) {
        [0, -35, 35, -60, 60].forEach(function (deg, order) {
          [34, 56, 84, 116, 150].forEach(function (D) {
            var a = deg * Math.PI / 180;
            var ex = mx + side * D * Math.cos(a), ey = my + D * Math.sin(a);    // the leader's elbow
            var x0 = side > 0 ? ex : ex - shelf, x1 = x0 + shelf;
            var y0 = ey - nameH - 6, y1 = ey + lh - nameH + 4;
            var score = order * 0.4 + D / 28, lit = 0;
            if (x0 < txtEdge + 20 || x1 > w - 28 || y0 < navH + 16 || y1 > h - 24) score += 1000;
            if (locR && x1 > locR.left - mapR.left - 16 && y1 > locR.top - mapR.top - 16) score += 1000;
            // samples over the label and a margin of 10 px round it
            for (var p = 0; p <= 12; p++) for (var q = 0; q <= 5; q++) {
              var ux = (x0 - 10 + (x1 - x0 + 20) * p / 12 - ox) / s, uy = (y0 - 10 + (y1 - y0 + 20) * q / 5 - oy) / s;
              var fa = mp.farmAt(ux, uy);
              if (mp.landAt(ux, uy)) { score += 2 + fa * 8 + (v.fi >= 0 && mp.focusAt(v.fi, ux, uy) ? 4 : 0); lit += fa; }
              else score += fa * 2;
            }
            // and no coast or border runs through it
            var ln = mp.linesIn((x0 - 8 - ox) / s, (y0 - 6 - oy) / s, (x1 + 8 - ox) / s, (y1 + 6 - oy) / s);
            score += Math.min(60, ln * 1.5);
            if (!best || score < best.score) best = { score: score, lit: lit, ln: ln, side: side, ex: ex - mx, ey: ey - my };
          });
        });
      });
      var side = best.side, svg = mk.querySelector(".tm-mark__lead"), plate = best.lit > 1.5 || best.ln > 4;
      var r0 = 6.5, len = Math.sqrt(best.ex * best.ex + best.ey * best.ey);
      var ax = best.ex * r0 / len, ay = best.ey * r0 / len;
      var fx = best.ex + side * shelf;
      var minx = Math.min(0, fx) - 12, miny = Math.min(0, best.ey) - 12;
      var ww = Math.max(Math.abs(fx), Math.abs(best.ex)) + 24, hh = Math.abs(best.ey) + 24;
      svg.setAttribute("width", ww); svg.setAttribute("height", hh);
      svg.setAttribute("viewBox", minx + " " + miny + " " + ww + " " + hh);
      svg.style.left = minx + "px"; svg.style.top = miny + "px";
      // on a plate the leader stops at the plate; otherwise it runs on as
      // the shelf under the name
      svg.querySelector("path").setAttribute("d", "M" + ax.toFixed(1) + " " + ay.toFixed(1) + "L" + best.ex.toFixed(1) + " " +
                                             best.ey.toFixed(1) + (plate ? "" : "H" + fx.toFixed(1)));
      lab.style.left = (side > 0 ? best.ex + 1 : fx + 1 - (plate ? 20 : 0)) + "px";
      lab.style.width = (shelf - 2) + "px";
      lab.style.top = (best.ey - nameH - 6) + "px";
      mk.classList.toggle("is-left", side < 0);
      mk.classList.toggle("has-plate", plate);
    });
  }
  // the locator: the whole island, small and dim, with the part in view lit
  function buildLoc() {
    var NS = "http://www.w3.org/2000/svg";
    function el(name, attrs, parent) {
      var e = document.createElementNS(NS, name);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      parent.appendChild(e);
      return e;
    }
    loc = document.createElement("div");
    loc.className = "tm-loc";
    loc.setAttribute("aria-hidden", "true");
    var s = el("svg", { viewBox: "0 0 840 1267" }, loc);
    var clip = el("clipPath", { id: "tm-loc-view" }, el("defs", {}, s));
    locBox = el("rect", {}, clip);
    var d = mp.counties.map(function (c) { return c.d; }).join("") + mp.gaps;
    el("path", { d: d, "class": "tm-loc__land" }, s);
    el("path", { d: d, "class": "tm-loc__seen", "clip-path": "url(#tm-loc-view)" }, s);
    el("path", { d: mp.coast, "class": "tm-loc__coast", "vector-effect": "non-scaling-stroke" }, s);
    map.appendChild(loc);
  }

  function measure() {
    var r = card.getBoundingClientRect(), m = map.getBoundingClientRect();
    txtEdge = r.right - m.left;
  }

  function load(cb) {
    if (window.THREAT_COUNTIES) { cb(); return; }
    if (loading) return;
    loading = true;
    var sc = document.createElement("script");
    sc.src = DATA; sc.async = true;
    sc.onload = function () { loading = false; cb(); };
    sc.onerror = function () { loading = false; broken = true; fail(); };
    document.head.appendChild(sc);
  }

  function start() {
    if (mp || broken) return;
    if (!window.THREAT_COUNTIES) { load(start); return; }
    try {
      mp = MapView(map, { onlost: fail, foci: FOCI, mask: MASK, pal: palette(th) });
    } catch (e) { mp = null; }
    if (!mp) { broken = true; fail(); return; }
    buildMarks();
    buildLoc();
    measure();
    mp.size(map.clientWidth, map.clientHeight, window.devicePixelRatio || 1);
    mp.ready.then(function (ok) {
      if (!ok) { broken = true; fail(); return; }
      if (live) { placeMarks(); write(read()); }
    });
    write(read());
  }

  function decide() {
    var on = fits.matches && !printing && !broken;
    if (on) {
      th.classList.add("is-live");
      // the card, with its longest stop, has to fit the held screen
      var tallest = 0;
      stops.forEach(function (st) {
        var was = st.classList.contains("is-on");
        st.classList.add("is-on");
        tallest = Math.max(tallest, card.offsetHeight);
        if (!was) st.classList.remove("is-on");
      });
      var cs = window.getComputedStyle(card.parentNode);
      on = tallest + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) <= pin.clientHeight;
    }
    if (!on) {
      exit(0);
      th.classList.remove("is-live");
      stops.forEach(function (s) { s.classList.remove("is-on"); });
      marks.forEach(function (m) { if (m) m.classList.remove("is-on"); });
      cur = -1; markOn = -1;
    }
    live = on;
    if (live && near) start();
    if (live) window.setTimeout(hashOnce, 60);
    if (live && mp) {
      measure();
      mp.size(map.clientWidth, map.clientHeight, window.devicePixelRatio || 1);
      placeMarks();
      write(read());
    }
  }

  /* THE EXIT (17 Oct, owner: the hand-off to the answer should be cleaner).
     The runway ends with EXIT screens after the last stop: its words drift up
     and fade, the camera eases back a little, and the map dissolves into the
     page's white, so the held screen lets go on white and the question that
     follows comes up on the same ground (home.js fades it in as it rises). */
  var EXIT = 0.8;
  function runway() {
    var all = Math.max(1, run.getBoundingClientRect().height - pin.offsetHeight);
    return { all: all, stops: Math.max(1, all - EXIT * pin.offsetHeight) };
  }
  function read() {
    if (!live) return;
    var r = run.getBoundingClientRect(), rw = runway();
    // the observer below normally starts the renderer; this is the fallback
    if (!mp && !broken && r.top < 3 * window.innerHeight && r.bottom > -window.innerHeight) near = true;
    return { p: clamp01(-r.top / rw.stops),
             x: clamp01((-r.top - rw.stops) / Math.max(1, rw.all - rw.stops)),
             seen: r.top < window.innerHeight && r.bottom > 0,
             w: map.clientWidth, h: map.clientHeight };
  }

  // a slow GPU draws fewer pixels, and a very slow one gives up for the stills
  var lastT = 0, slow = 0, fast = 0, caps = [5.2e6, 2.6e6, 1.3e6, 0.7e6], capI = 0;
  function pace() {
    var now = performance.now(), dt = now - lastT;
    lastT = now;
    if (dt > 200) return;                          // not a continuous scroll
    if (dt > 48) { slow++; fast = 0; } else if (++fast > 30) slow = 0;
    if (slow < 6) return;
    slow = 0;
    if (++capI < caps.length) mp.setCap(caps[capI]);
    else { broken = true; fail(); }
  }

  var exitWas = -1;
  function exit(x) {
    var e = Math.round(x * 1000) / 1000;
    if (e === exitWas) return;
    exitWas = e;
    var w = ease(span(e, 0, 0.45)), f = ease(span(e, 0.12, 0.85));
    inner.style.opacity = e > 0 ? (1 - w).toFixed(3) : "";
    inner.style.transform = e > 0 ? "translateY(" + (-18 * w).toFixed(1) + "px)" : "";
    map.style.opacity = e > 0 ? (1 - f).toFixed(3) : "";
  }
  function write(m) {
    if (!m) return;
    if (!mp && near && !broken) { start(); return; }
    exit(m.x);
    var u = m.p * (n - 1);
    var k = Math.min(n - 2, Math.floor(u));
    var s = u - k;
    var t = ease(span(s, 0.3, 0.85));             // hold, move, hold
    var A = V[k], B = V[k + 1];
    var x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
    var z = Math.exp(Math.log(A.z) + (Math.log(B.z) - Math.log(A.z)) * t);
    z *= 1 - 0.12 * ease(m.x);                      // the exit: the camera eases back
    var c = s < 0.6 ? k : k + 1;
    if (c !== cur) {
      cur = c;
      stops.forEach(function (st, i) { st.classList.toggle("is-on", i === c); });
      // a stop with its own heading (the hour, the protectants) takes the
      // section title's place
      card.classList.toggle("is-late", !!stops[c].querySelector(".tm-head"));
    }
    // a callout shows only while the camera holds at its stop
    var mo = s < 0.34 ? k : s > 0.86 ? k + 1 : -1;
    if (mo !== markOn) {
      markOn = mo;
      marks.forEach(function (mk, i) { if (mk) mk.classList.toggle("is-on", i === mo); });
    }
    if (!mp || !m.seen) return;
    pace();
    // outlines and the focus fade out early in a move and in late
    var fw = [0, 0, 0, 0];
    var fa = 1 - ease(span(s, 0.30, 0.42)), fb = ease(span(s, 0.80, 0.92));
    if (A.fi >= 0) fw[A.fi] += fa;
    if (B.fi >= 0) fw[B.fi] += fb;
    var fp = [0, 0, 0];
    if (A.mark && fa > 0) fp = [A.mark[0], A.mark[1], fa];
    else if (B.mark && fb > 0) fp = [B.mark[0], B.mark[1], fb];
    // the colours of the next layer spread out from the next place as the
    // camera goes there (the wave in the shader); the wash of the first
    // layer goes the same way
    var tc = span(s, 0.32, 0.86);
    var cam = mp.draw({ x: x, y: y, z: z, fx: FX, fy: FY, la: A.layer, lb: B.layer, t: tc,
                        wash: A.layer === 0 ? 1 : 0, wv: [B.x * CW, B.y * CH, B.layer === 0 ? 1 : 0],
                        fw: fw, fp: fp, txt: txtEdge });
    if (!cam) return;
    marks.forEach(function (mk, i) {
      if (!mk || (i !== k && i !== k + 1)) return;
      var v = V[i].mark;
      mk.style.transform = "translate3d(" + (cam.ox + v[0] * cam.s).toFixed(1) + "px," + (cam.oy + v[1] * cam.s).toFixed(1) + "px,0)";
    });
    // where the view is on the island
    if (locBox) {
      locBox.setAttribute("x", (-cam.ox / cam.s).toFixed(1));
      locBox.setAttribute("y", (-cam.oy / cam.s).toFixed(1));
      locBox.setAttribute("width", (m.w / cam.s).toFixed(1));
      locBox.setAttribute("height", (m.h / cam.s).toFixed(1));
      loc.style.opacity = clamp01((z - 1.15) / 0.35).toFixed(3);
    }
  }
  /* THE CHAPTERS RAIL points at two stops (#hour, #safe). On the live map
     every stop sits in the same held screen, so each such stop tells the rail
     (home.js reads el.__chapterTop) where on the runway it is, and a click on
     a link to it scrolls the runway there instead of to the held screen. */
  function runwayY(i) {
    return run.getBoundingClientRect().top + runway().stops * i / (n - 1);
  }
  stops.forEach(function (st, i) {
    if (!st.id) return;
    st.__chapterTop = function () {
      if (!live) return st.getBoundingClientRect().top;
      // the rail calls a chapter current once its top is a third down the
      // screen: here, once the camera is close to this stop
      return runwayY(i - 0.4) + window.innerHeight * 0.34;
    };
  });
  function goTo(id, smooth) {
    for (var i = 0; i < n; i++) if (stops[i].id === id) break;
    if (i === n || !live) return false;
    window.scrollTo({ top: window.scrollY + runwayY(i) + 2, behavior: smooth && !reduced ? "smooth" : "auto" });
    return true;
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (goTo(a.getAttribute("href").slice(1), true)) {
      e.preventDefault();
      if (history.pushState) history.pushState(null, "", a.getAttribute("href"));
    }
  });
  var hashDone = false;
  function hashOnce() {
    if (hashDone || !live || !location.hash) return;
    hashDone = true;
    goTo(location.hash.slice(1), false);
  }

  function fail() {
    broken = true; live = false;
    exit(0);
    th.classList.remove("is-live");
    stops.forEach(function (s) { s.classList.remove("is-on"); });
    if (mp) { try { mp.canvas.remove(); mp.svg.remove(); } catch (e) { /* gone already */ } }
  }

  homeFrame.add(read, write, fail);
  var sized = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(sized);
    sized = window.setTimeout(decide, 120);
  });
  if (fits.addEventListener) fits.addEventListener("change", decide);
  window.addEventListener("beforeprint", function () { printing = true; decide(); });
  window.addEventListener("afterprint", function () { printing = false; decide(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(decide);
  // the opening covers the page while it loads, and the layout is not final
  // under it: measure again once it has gone, and once everything is in
  Promise.resolve(window.__introDone).then(function () { window.setTimeout(decide, 50); });
  window.addEventListener("load", decide);
  if ("MutationObserver" in window) {
    var wasLd = document.documentElement.classList.contains("ld");
    new MutationObserver(function () {
      var ld = document.documentElement.classList.contains("ld");
      if (wasLd && !ld) window.setTimeout(decide, 30);
      wasLd = ld;
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  // the renderer, its data and the 1.1 MB mask wait until the map is two
  // screens away, and never load where the live map does not run
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es, io) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect(); near = true;
      if (live) start();
    }, { rootMargin: "200% 0px" }).observe(th);
  } else near = true;
  decide();
})();
