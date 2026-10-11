// V4's wall close-up, rebuilt (Phase A, 9 Oct 2026, after the owner: "the zoom in pores scene ... looks too simple").
//
// One fibre's wall at the micro scale, as its own scene, matched at both ends to the macro fibre's inner wall.
//   - The wall is a cutaway of the curved fibre wall: a smooth skin facing the lumen, carrying the 0.2 um pores, and a
//     graded sponge behind it (raymarched in the cut face: a warped gyroid, fine under the skin and coarser deeper, as
//     in an SEM of a PES hollow fibre). The cut is radial, so the skin's thickness and the pore channels read in section.
//   - The macro fibre's inner wall uses the SAME skin shader, fed macro positions mapped into micro units, so the
//     hand-off is one material: the same pores in the same places, the same light, the same haze.
//   - The lumen: translucent rods (fresnel envelope, wrap-lit body, darker nucleoid, some mid-division), drifting with
//     the crossflow at layered speeds (slower near the wall), tumbling a little and bumping the skin; contact shadows.
//   - The beat: the parcel's glow resolves into one cell, which drifts down with the flow, bumps the skin and is held
//     on a pore one row in from the cut; protectant motes (far smaller than the pores) stream through the pores, down
//     the channels in section and out into the shell side; a "0.2 um" bracket shows for a moment.
//   - The look: the medium's haze (in-scatter from the parcel's light, closed form), depth of field (a gather pass on
//     the micro buffer, focused on the subject), bokeh debris for parallax, a warm key and a cool rim.
// Everything is a function of k (0..1 across the close-up) plus the clock for sub-micron jitter only.
//
// Units: 100 = 1 um. Micro frame: the skin is the cylinder |(x, y) - (0, RC)| = RC (the lumen is inside it, +y is "up"
// into the lumen at the trough), z runs along the fibre. The arrival pore Q is at the origin. Mapping from the macro
// fibre (mm): micro = ((y - AX1)/MM, RC + (x - FIBX)/MM, -(z - FZ)/MM), MM = mm per unit.
(function () {
  "use strict";
  const V3 = THREE.Vector3;
  const { sat, ss, lerp } = B2;

  // ---- the numbers. Sizes from hardware/bioreactor/index.html: pore 0.2 um; B. subtilis cell diameter 0.25-1.0 um.
  // Cell length, wall thickness, skin thickness, the fibre's curvature at this zoom and the motes' drawn size are
  // illustrative (none is on record).
  const U = 100;
  const SP = 64, JM = 16, RP = 10, TS = 36, NP = 64;     // pore grid spacing, jitter, radius (0.2 um across), skin thickness
  // calm camera (rule 7): the held pore is nearer the arrival (it was 1800 units away, so the camera trucked two frame
  // widths each way); the cut column stays clear of the desk hand-off frame (+-440 units at 16:10)
  const IC = 11, IH = 10, JH = -9;
  const UNIFORM_PORES = true;                            // owner, 10 Oct: a regular grid of equal pores                       // the cut's pore column; the held pore (one column in), its row
  const DEEP = 2600;                                     // how far the section is drawn below the skin (into fog)

  function rngf(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // ------------------------------------------------------------------------------------------------ GLSL
  const COMMON = `
uniform vec3 uCamM;
uniform vec3 uKeyDir, uKeyCol, uRimDir, uRimCol, uSky, uGnd, uHaze, uHazeHi, uShell, uTeal;
uniform vec4 uL1, uL2; uniform vec3 uL1Col, uL2Col;
uniform float uFogDen, uFogMix, uScat, uKeyR, uNeutral;
uniform vec3 uFocusP;
// the key is a pool on the subject (focus by light): full at the subject, a third of it far away
float keyAt(vec3 p) { vec3 d = p - uFocusP; return mix(0.2, 1.0, exp(-dot(d, d) / (uKeyR * uKeyR))); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), u.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), u.x), u.y); }
vec3 hazeCol(vec3 rd) {
  vec3 c = mix(uHaze, uHazeHi, smoothstep(-0.15, 0.8, rd.y));  // (rd is unit)
  c = mix(uShell, c, smoothstep(-0.6, -0.12, rd.y));
  return c + uKeyCol * 0.035 * pow(max(dot(rd, uKeyDir), 0.), 6.);
}
// light scattered toward the eye by the medium from a point light, along a ray of length tmax (closed form of 1/r^2)
float scat(vec3 ro, vec3 rd, float tmax, vec3 L) {
  vec3 q = ro - L; float b = dot(rd, q); float h = sqrt(max(dot(q, q) - b * b, 900.));
  return (atan((tmax + b) / h) - atan(b / h)) / h;
}
vec3 medium(vec3 col, vec3 p) {
  vec3 d = p - uCamM; float dist = length(d); vec3 rd = d / max(dist, 1e-3);
  float f = (1. - exp(-dist * uFogDen)) * uFogMix;
  col = mix(col, hazeCol(rd), f);
  col += (uL1Col * uL1.w * scat(uCamM, rd, dist, uL1.xyz) + uL2Col * uL2.w * scat(uCamM, rd, dist, uL2.xyz)) * uScat * uFogMix;
  return col;
}
vec3 pointL(vec3 p, vec3 n, vec4 L, vec3 col) {
  vec3 d = L.xyz - p; float r2 = dot(d, d);
  return col * L.w * max(dot(n, d * inversesqrt(r2)) * 0.8 + 0.2, 0.) * 90000. / (r2 + 90000.);
}
`;
  const PORES = `
uniform sampler2D uPores;
vec4 poreAt(vec2 sz) {
  vec2 ci = floor(sz / ${SP.toFixed(1)} + .5);
  vec4 d = texture2D(uPores, (mod(ci, ${NP.toFixed(1)}) + .5) / ${NP.toFixed(1)});
  vec2 c = ci * ${SP.toFixed(1)} + (d.rg * 255. - 128.) / 127. * ${JM.toFixed(1)};
  return vec4(c, ${RP.toFixed(1)} * (0.86 + 0.14 * d.b), step(.5, d.a));
}
`;

  // the skin (the lumen face of the wall). Also used, with a macro->micro matrix, on the macro fibre's inner wall.
  const SKIN_VERT = `
uniform mat4 uToM;
varying vec3 vM;
void main() { vM = (uToM * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
  const skinFrag = (RC, NSH) => `
#define RC ${RC.toFixed(3)}
#define TS ${TS.toFixed(1)}
${COMMON}
${PORES}
uniform vec4 uSh[${NSH}]; uniform vec3 uShAx[${NSH}];
uniform vec4 uSeat; uniform vec3 uSeatAx;
uniform float uThMin, uThC;
varying vec3 vM;
void main() {
  vec3 p = vM;
  vec2 cp = vec2(p.x, RC - p.y);
  float th = atan(cp.x, cp.y);
  vec2 sz = vec2(RC * th, p.z);
  vec3 N = normalize(vec3(-p.x, RC - p.y, 0.));
  vec3 Ts = vec3(N.y, -N.x, 0.), Tz = vec3(0., 0., 1.);
  vec3 V = normalize(uCamM - p);
  float px = max(length(fwidth(sz)), 1e-4);            // micro units per pixel
  float det = 1. - smoothstep(2.5, 9., px);              // fine detail resolves
  float detP = 1. - smoothstep(6., 16., px);             // pores resolve
  // the skin's nodular grain (bump through screen derivatives)
  float h = vnoise(sz / 7.5) * 0.55 + vnoise(sz / 2.8 + 7.1) * 0.25 + vnoise(sz / 40. + 3.3) * 0.2;
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float fd = dot(dpx, r1);
  vec2 dh = vec2(dFdx(h), dFdy(h)) * 0.75 * det;
  vec3 n = abs(fd) > 1e-12 ? normalize(abs(fd) * N - sign(fd) * (dh.x * r1 + dh.y * r2)) : N;
  // the pore, its rounded lip
  vec4 pr = poreAt(sz);
  vec2 dv = sz - pr.xy; float dist = length(dv), r = pr.z;
  vec2 rad = dv / max(dist, 1e-3);
  float lw = r * 0.42, lx = (dist - r * 1.28) / lw;
  float slope = pr.w * 3.2 * exp(-lx * lx) * (-2. * lx / lw) * detP;
  n = normalize(n - (rad.x * Ts + rad.y * Tz) * slope);
  vec3 alb = vec3(0.79, 0.77, 0.73) * (0.93 + 0.14 * vnoise(sz / 34.));   // (round 4b: #e9e6e0, an off-white polymer)
  alb *= 1. - 0.3 * pr.w * exp(-max(dist - r, 0.) / (r * 0.7)) * detP;   // the lip darkens toward the hole
  alb *= 1. - 0.05 * (1. - detP);                                          // unresolved pores: the average
  // light
  float wrapK = max((dot(n, uKeyDir) + 0.25) / 1.25, 0.);
  vec3 Hh = normalize(uKeyDir + V);
  float spec = pow(max(dot(n, Hh), 0.), 40.) * 0.14;
  float fres = pow(1. - max(dot(n, V), 0.), 4.);
  vec3 hemi = mix(uGnd, uSky, n.y * 0.5 + 0.5);
  float kp = keyAt(p);
  vec3 col = alb * (uKeyCol * wrapK * kp + hemi + uRimCol * max(dot(n, uRimDir), 0.) * 0.45);
  col += uKeyCol * spec * kp + uRimCol * fres * 0.1;
  col += alb * (pointL(p, n, uL1, uL1Col) + pointL(p, n, uL2, uL2Col));
  // contact shadows of the cells nearest the skin
  float sh = 1.;
  for (int i = 0; i < ${NSH}; i++) {
    vec4 s = uSh[i]; if (s.w <= 0.) continue;
    vec3 A = s.xyz - uShAx[i], ba = 2. * uShAx[i], pa = p - A;
    float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0., 1.);
    float d = length(pa - ba * t);
    sh *= 1. - 0.5 * exp(-max(d - s.w * 0.55, 0.) / (s.w * 0.7));
  }
  col *= sh;
  // the seat: a thin line of light where the held cell presses on the skin (illustrative), brief, then faint
  if (uSeat.w > 0.) {
    vec3 A = uSeat.xyz - uSeatAx, ba = 2. * uSeatAx, pa = p - A;
    float d = length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0., 1.));
    col += vec3(1.0, 0.66, 0.3) * uSeat.w * exp(-pow((d - 32.) / 3.2, 2.));
  }
  // into the hole: the channel wall (parallax, with depth), then the faint teal of the shell side
  float aa = max(px * 0.75, 0.25);
  float hole = pr.w * (1. - smoothstep(r - aa, r + aa, dist)) * detP;
  if (hole > 0.) {
    vec3 Vt = vec3(dot(V, Ts), dot(V, Tz), max(dot(V, N), 0.1));
    vec2 vt = Vt.xy / Vt.z;
    float a2 = dot(vt, vt), b = 2. * dot(dv, vt), cc = min(dist * dist - r * r, 0.);
    float dhit = a2 > 1e-5 ? (b + sqrt(max(b * b - 4. * a2 * cc, 0.))) / (2. * a2) : 1e4;
    dhit = clamp(dhit, 0., 1e4);
    vec3 holeCol;
    if (dhit < TS) {
      vec2 wp = dv - vt * dhit; vec2 wn = -wp / r;
      vec3 wN = (wn.x * Ts + wn.y * Tz) / max(length(wn), 1e-4);
      holeCol = alb * (uKeyCol * kp * (max(dot(wN, uKeyDir), 0.) * 0.45 + 0.08) + hemi * 0.5) * exp(-dhit / 10.);
    } else holeCol = uTeal * 0.6;
    holeCol += uTeal * smoothstep(TS * 0.35, TS * 1.1, dhit);
    col = mix(col, holeCol, hole);
  }
  col = medium(col, p);
  // the far edge of the patch (beyond the trough's far side) dissolves into the haze
  col = mix(col, hazeCol(-V), smoothstep(uThMin + 0.35, uThMin, th) * uFogMix);
  // (round 4b: the wall stays white; the warmth is in the cells. Not inside the pores: their teal is the shell side)
  col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), uNeutral * (1. - hole));
  if (!(col.r == col.r && col.g == col.g && col.b == col.b)) col = vec3(0.);
  gl_FragColor = vec4(min(col, vec3(32.)), 1.);
}
`;

  // the cut face: the wall in section (skin, pore channels, graded sponge), raymarched from the cut plane inward
  const CUT_FRAG = (RC) => `
#define RC ${RC.toFixed(3)}
#define TS ${TS.toFixed(1)}
${COMMON}
${PORES}
uniform vec3 uNF;
varying vec3 vM;
float gyr(vec3 p) { return sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x); }
float field(vec3 q) {
  vec2 cp = vec2(q.x, RC - q.y); float u = length(cp) - RC;
  if (u < 0.) return -u + 1.;
  float res = 1e4;
  if (u < TS + 3.) {
    float th = atan(cp.x, cp.y); vec2 sz = vec2(RC * th, q.z);
    vec4 pr = poreAt(sz);
    float hole = pr.w > .5 ? pr.z - length(sz - pr.xy) : -1e4;
    res = max(max(-u, u - TS), hole);
  }
  if (u > TS - 3.) {
    float k = smoothstep(TS + 40., TS + 700., u);
    vec3 w = q + vec3(sin(q.y * .021 + 1.3) + 0.5 * sin(q.z * .057), sin(q.z * .019 + .4) + 0.5 * sin(q.x * .061), sin(q.x * .023 + 2.1) + 0.5 * sin(q.y * .053)) * 16.;
    float f1 = 6.2832 / 54., f2 = 6.2832 / 240.;
    float g = 0.;
    if (k < .98) g += (1. - k) * gyr(w * f1);
    if (k > .02) g += k * gyr(w * f2 + 1.7);
    float sp = (mix(0.42, 0.66, k) - g) / (mix(f1, f2, k) * 2.);
    res = min(res, max(TS - u, sp));
  }
  return res;
}
void main() {
  vec3 p0 = vM;
  vec3 rd = normalize(p0 - uCamM);
  float t = 0., d = 0.; bool hit = false;
  for (int i = 0; i < 28; i++) {
    d = field(p0 + rd * t);
    if (d < 0.5) { hit = true; break; }
    t += max(d * 0.8, 1.); if (t > 560.) break;
  }
  vec3 q = p0 + rd * t;
  float u = length(vec2(q.x, RC - q.y)) - RC;
  vec3 n = uNF;
  if (t > 0.6) {
    vec2 e = vec2(1., -1.) * 1.3;
    vec3 gN = e.xyy * field(q + e.xyy) + e.yyx * field(q + e.yyx) + e.yxy * field(q + e.yxy) + e.xxx * field(q + e.xxx);
    n = length(gN) > 1e-6 ? normalize(gN) : uNF;
  }
  vec3 V = -rd;
  // the fracture face catches a little more light than the struts behind it
  vec3 alb = vec3(0.72, 0.70, 0.67) * (t < 0.6 ? 1.0 + 0.2 * (vnoise(q.zy / 2.2) - 0.5) : 0.85);
  float wrapK = max((dot(n, uKeyDir) + 0.3) / 1.3, 0.);
  vec3 hemi = mix(uGnd, uSky, n.y * 0.5 + 0.5);
  vec3 col = alb * (uKeyCol * wrapK * keyAt(q) + hemi + uRimCol * max(dot(n, uRimDir), 0.) * 0.35);
  col += alb * (pointL(q, n, uL1, uL1Col) + pointL(q, n, uL2, uL2Col));
  col += uKeyCol * pow(max(dot(n, normalize(uKeyDir + V)), 0.), 30.) * 0.08;
  // inside the voids the light dies off; deep in the wall the shell side's teal takes over
  col *= exp(-t / 38.) * mix(1., 0.3, smoothstep(TS, 700., u));
  col += uTeal * (1. - exp(-t / 60.)) * 0.4;
  if (!hit) col = uShell * 1.2 + uTeal * 0.5;
  col = mix(col, uShell * 1.6 + uTeal * 0.25, smoothstep(250., ${DEEP.toFixed(1)}, u));
  col = medium(col, q);
  col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), uNeutral * (1. - smoothstep(60., 500., u)));   // (the deep teal stays)
  if (!(col.r == col.r && col.g == col.g && col.b == col.b)) col = vec3(0.);
  gl_FragColor = vec4(min(col, vec3(32.)), 1.);
}
`;

  const CELL_VERT = `
attribute vec4 aInfo;     // x tint, y glow, z seed, w alpha
attribute float aDiv;     // mid-division: the septum's pinch
varying vec3 vW, vN, vL; varying vec4 vI;
void main() {
  vec3 pos = position;
  pos.xz *= 1. - aDiv * 0.3 * exp(-pow(pos.y / 0.2, 2.));
  mat4 im = instanceMatrix;
  vec3 sc = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
  vec4 wp = modelMatrix * im * vec4(pos, 1.);
  vN = normalize(mat3(im) * (normal / (sc * sc)));
  vW = wp.xyz; vL = pos; vI = aInfo;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
  const CELL_FRAG = `
${COMMON}
uniform float uDesat;
varying vec3 vW, vN, vL; varying vec4 vI;
void main() {
  vec3 n = normalize(vN + vec3(0., 1e-6, 0.)), V = normalize(uCamM - vW + vec3(1e-4));
  if (dot(n, V) < 0.) n = -n;
  float ndv = clamp(dot(n, V), 0., 1.);
  float fr = pow(1. - ndv, 3.);
  vec3 core = mix(vec3(0.30, 0.12, 0.02), vec3(0.46, 0.22, 0.05), vI.x);
  vec3 env = vec3(1.0, 0.72, 0.4);
  float kd = dot(n, uKeyDir);
  // the body: wrap-lit (light passes into a translucent body), darker on the far side
  float kp = keyAt(vW);
  vec3 body = core * (uKeyCol * (smoothstep(-0.35, 1.0, kd) * 1.9) * kp + uSky * 0.8 + uGnd * 0.5);
  body += core * 0.6 * uKeyCol * kp * exp(-pow((kd + 0.1) / 0.25, 2.));        // warm light bleeding at the terminator
  // the nucleoid: a darker, mottled lobe seen through the middle of the rod
  float nuc = smoothstep(0.35, 0.95, ndv) * smoothstep(1.05, 0.25, abs(vL.y)) * (0.75 + 0.5 * vnoise(vec2(vL.y * 3., vI.z * 13.)));
  body *= 1. - 0.3 * nuc;
  body *= 0.92 + 0.16 * vnoise(vL.yz * 14. + vI.z * 7.);
  // light through the body from behind (the rim light): transmission is strongest toward the silhouette
  float back = pow(max(dot(-V, uRimDir), 0.), 1.5);
  body += core * uRimCol * back * (0.5 + 1.2 * (1. - ndv)) * 1.6;
  // the envelope: a thin bright fresnel, lifted where the rim and key light it
  vec3 col = body + env * fr * (0.18 + 0.9 * max(dot(n, uRimDir), 0.) + 0.5 * max(kd, 0.));
  col += uKeyCol * pow(max(dot(n, normalize(uKeyDir + V)), 0.), 160.) * 0.5;       // the membrane's highlight
  col += core * (pointL(vW, n, uL1, uL1Col) + pointL(vW, n, uL2, uL2Col)) * 2.6;
  col += vec3(1.0, 0.42, 0.07) * vI.y * (0.6 + 1.4 * ndv);                       // the parcel's glow, as it resolves
  float gray = dot(col, vec3(0.3, 0.55, 0.15));
  col = mix(col, vec3(gray) * 0.85, uDesat * smoothstep(110., 520., distance(vW, uFocusP)));
  col = medium(col, vW);
  if (!(col.r == col.r && col.g == col.g && col.b == col.b)) col = vec3(0.);
  gl_FragColor = vec4(min(col, vec3(32.)), (0.76 + 0.22 * fr) * vI.w);
}
`;

  const MOTE_VERT = (RC) => `
#define RC ${RC.toFixed(3)}
#define TS ${TS.toFixed(1)}
attribute vec4 aA;   // pore s, pore z, edge (in the section), seed
attribute vec4 aB;   // phase, trips per k, start height, lateral start
uniform float uK, uClock, uPx, uA, uAp, uFocus; uniform vec3 uNF;
varying float vA, vR;
void main() {
  float t = fract(aB.x + uK * aB.y + uClock * 0.01);
  float sd = aA.w, s = aA.x, z = aA.y, hgt, a = 1.;
  vec3 j = vec3(sin(t * 29. + sd * 7.) + 0.6 * sin(t * 53. + sd * 3.) + 0.3 * sin(uClock * 0.9 + sd * 11.),
                sin(t * 31. + sd * 5.) + 0.6 * sin(t * 47. + sd * 2.) + 0.3 * sin(uClock * 0.8 + sd * 13.),
                sin(t * 37. + sd * 9.) + 0.6 * sin(t * 59. + sd * 4.) + 0.3 * sin(uClock * 0.7 + sd * 17.)) * 3.;
  vec3 off = vec3(0.);
  if (t < 0.55) {                       // in the lumen: carried along, then drawn to the pore (faster as it nears)
    float u = t / 0.55, e = u * u * u;
    hgt = mix(aB.z, 0.5, e); s += aB.w * (1. - e); z += 300. * (1. - u);
    off = j * (1. - e); a = smoothstep(0., 0.12, u);
  } else if (t < 0.63) {                // through the skin's channel
    float u = (t - 0.55) / 0.08; hgt = -u * TS;
  } else {                              // out through the sponge, fanning with the shell side's flow, into the fog
    float u = (t - 0.63) / 0.37;
    hgt = -TS - u * (aA.z > .5 ? 760. : 1500.);
    z += -u * 520. + sin(u * 5. + sd * 7.) * 80. * u;
    if (aA.z < .5) s += sin(u * 4. + sd * 9.) * 110. * u;
    off = j * 2. * u; a = 1. - smoothstep(0.45, 1., u);
  }
  float th = s / RC, rr = RC - hgt;
  vec3 pos = vec3(rr * sin(th), RC - rr * cos(th), z) + off;
  if (aA.z > .5 && t >= 0.5) pos += uNF * 2.;       // in the section: just in front of the cut face
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  gl_Position = projectionMatrix * mv;
  float vz = max(-mv.z, 1.);
  float core = 2.2 * uPx / vz, coc = uAp * abs(vz - uFocus) / vz;
  float cr = max(core, coc * 1.6);
  float ps = clamp(cr * 4., 2., 64.);
  gl_PointSize = ps; vR = max(cr, 0.7) / ps; vA = a * uA * clamp((core + 0.8) * (core + 0.8) / (cr + 0.8) / (cr + 0.8), 0.05, 1.);
}
`;
  const MOTE_FRAG = `
varying float vA, vR;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.;
  float core = 1. - smoothstep(vR * 0.6, vR * 1.2, r);
  float halo = exp(-r * r * 6.) * 0.22;
  gl_FragColor = vec4(vec3(0.16, 0.94, 0.56) * (core * 2.3 + halo) * vA, 1.);
}
`;
  // debris in the medium (bokeh: sized by its own circle of confusion)
  const DEB_VERT = `
attribute vec4 aD;   // x, y, z0, size
attribute vec4 aE;   // seed, tint, speed, -
uniform float uK, uClock, uPx, uA, uAp, uFocus, uZlo, uZspan;
varying float vA; varying vec3 vC;
void main() {
  float z = aD.z - uK * 3600. * aE.z - uClock * 2.5 * aE.z;
  z = uZlo + mod(z - uZlo, uZspan);
  float edge = smoothstep(0., 0.08, (z - uZlo) / uZspan) * smoothstep(1., 0.92, (z - uZlo) / uZspan);
  vec3 pos = vec3(aD.x + sin(uK * 6. + aE.x * 9.) * 20., aD.y + sin(uK * 5. + aE.x * 4.) * 14., z);
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  gl_Position = projectionMatrix * mv;
  float vz = max(-mv.z, 1.);
  float core = aD.w * uPx / vz;
  float coc = uAp * abs(vz - uFocus) / vz;
  float ps = clamp(max(core, coc * 2.) + 1.5, 1.5, 90.);
  gl_PointSize = ps;
  vA = uA * edge * clamp((core + 1.5) * (core + 1.5) / (ps * ps), 0.04, 1.) * smoothstep(40., 160., vz);
  vC = mix(vec3(0.55, 0.36, 0.2), vec3(0.75, 0.62, 0.45), aE.y);
}
`;
  const DEB_FRAG = `
varying float vA; varying vec3 vC;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.;
  float disc = 1. - smoothstep(0.82, 1., r);
  float ring = smoothstep(0.55, 0.92, r) * disc * 0.5;
  gl_FragColor = vec4(vC * (disc * 0.55 + ring) * vA, 1.);
}
`;
  const BG_FRAG = `
${COMMON}
varying vec3 vW;
void main() {
  vec3 rd = normalize(vW - uCamM);
  vec3 col = hazeCol(rd);
  col += (uL1Col * uL1.w * scat(uCamM, rd, 1e5, uL1.xyz) + uL2Col * uL2.w * scat(uCamM, rd, 1e5, uL2.xyz)) * uScat;
  gl_FragColor = vec4(col, 1.);
}
`;
  const QUAD_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
  // depth of field: a golden-angle gather (after D. Gustafsson's single-pass bokeh), ~32 taps whatever the radius
  const DOF_FRAG = `
uniform sampler2D tCol, tDep; uniform vec2 uTexel; uniform float uNear, uFar, uFocus, uAp, uMax;
varying vec2 vUv;
float lin(float d) { float zn = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - zn * (uFar - uNear)); }
float coc(float z) { return clamp(uAp * abs(z - uFocus) / z, 0., uMax); }
void main() {
  vec3 col = texture2D(tCol, vUv).rgb;
  if (uMax < 0.6) { gl_FragColor = vec4(col, 1.); return; }
  float cz = lin(texture2D(tDep, vUv).r), cs = coc(cz);
  float tot = 1., rs = max(uMax * uMax / 64., 0.25), radius = rs;
  float ang = 6.2832 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  for (int i = 0; i < 48; i++) {
    if (radius >= uMax) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
    vec3 sc = texture2D(tCol, tc).rgb;
    float sz = lin(texture2D(tDep, tc).r), sss = coc(sz);
    if (sz > cz) sss = clamp(sss, 0., cs * 2.);
    float m = smoothstep(radius - 0.5, radius + 0.5, sss);
    col += mix(col / tot, sc, m); tot += 1.;
    ang += 2.39996; radius += rs / radius;
  }
  gl_FragColor = vec4(col / tot, 1.);
}
`;
  const COPY_FRAG = `uniform sampler2D tCol; varying vec2 vUv; void main() { vec3 c = texture2D(tCol, vUv).rgb; if (!(c.r == c.r && c.g == c.g && c.b == c.b)) c = vec3(0.); gl_FragColor = vec4(clamp(c, 0., 64.), 1.); }`;

  // ------------------------------------------------------------------------------------------------ build
  window.V4Micro = function (c, cfg) {
    const MM = cfg.CAMW / cfg.H0;           // mm per micro unit (the hand-off scale)
    const RC = cfg.FR / MM;                 // the fibre's inner radius in micro units
    const DS = cfg.DS || 1;                 // the side the macro camera dives from (+1: +x, -1: -x)
    const LIFT = DS * (cfg.PARX - (cfg.FIBX - DS * cfg.FR)) / MM;   // the parcel's height over the far wall
    const THC = IC * SP / RC, THMIN = -1.95;
    const NF = new V3(Math.cos(THC), Math.sin(THC), 0);
    const srgb = RQ.srgb;

    // ---- the pores: a jittered grid, one record per cell, the same table in JS and GLSL
    const pdat = new Uint8Array(NP * NP * 4);
    { const r = rngf(9173);
      for (let j = 0; j < NP; j++) for (let i = 0; i < NP; i++) {
        const o = (j * NP + i) * 4;
        pdat[o] = Math.round(128 + (r() * 2 - 1) * 127); pdat[o + 1] = Math.round(128 + (r() * 2 - 1) * 127);
        pdat[o + 2] = Math.round(r() * 255); pdat[o + 3] = r() < 0.86 ? 255 : 0;
        if (i === IC % NP) { pdat[o] = 128; pdat[o + 2] = 255; pdat[o + 3] = r() < 0.9 ? 255 : 0; }   // the cut runs through this column
        // (owner, 10 Oct: "for the top layer of the zoom in membrane can the holes be uniform I am feeling grossed out"):
        // every pore open, the same size, on a regular square grid (no jitter, no gaps). The draws above stay, so the
        // random sequence for anything after is unchanged
        if (UNIFORM_PORES) { pdat[o] = 128; pdat[o + 1] = 128; pdat[o + 2] = 255; pdat[o + 3] = 255; }
      }
      const set0 = (i, j) => { const o = ((((j % NP) + NP) % NP) * NP + (((i % NP) + NP) % NP)) * 4; pdat[o] = 128; pdat[o + 1] = 128; pdat[o + 2] = 255; pdat[o + 3] = 255; };
      set0(0, 0); set0(IH, JH); }
    const poreTex = new THREE.DataTexture(pdat, NP, NP, THREE.RGBAFormat);
    poreTex.minFilter = poreTex.magFilter = THREE.NearestFilter; poreTex.generateMipmaps = false; poreTex.needsUpdate = true;
    function poreAt(s, z) {
      const ci = Math.floor(s / SP + 0.5), cj = Math.floor(z / SP + 0.5);
      const o = ((((cj % NP) + NP) % NP) * NP + (((ci % NP) + NP) % NP)) * 4;
      return { s: ci * SP + (pdat[o] - 128) / 127 * JM, z: cj * SP + (pdat[o + 1] - 128) / 127 * JM, r: RP * (0.86 + 0.14 * pdat[o + 2] / 255), on: pdat[o + 3] > 127, i: ci, j: cj };
    }
    // a point on the skin at (arc s, z), lifted h into the lumen; the local frame there
    const onSkin = (s, z, h, o) => { const th = s / RC, rr = RC - h; return (o || new V3()).set(rr * Math.sin(th), RC - rr * Math.cos(th), z); };
    const nrm = (s) => new V3(-Math.sin(s / RC), Math.cos(s / RC), 0);
    const tan = (s) => new V3(Math.cos(s / RC), Math.sin(s / RC), 0);

    // ---- shared uniforms (lights and medium); per-material camera and fog
    const L = {
      uKeyDir: { value: new V3(0.66, 0.42, 0.62).normalize() }, uKeyCol: { value: srgb("#fbfaf7").multiplyScalar(0.8) },
      uRimDir: { value: new V3(-0.34, 0.3, -0.89).normalize() }, uRimCol: { value: srgb("#a7bad8").multiplyScalar(0.6) },
      uSky: { value: srgb("#363636").multiplyScalar(0.3) }, uGnd: { value: srgb("#161616").multiplyScalar(0.3) },   // (round 4b: neutral)
      uNeutral: { value: 0.6 },   // (round 4b: the wall's own colour is neutralised by this much after the light and haze)
      uHaze: { value: srgb("#0f0a06") }, uHazeHi: { value: srgb("#1b1209") }, uShell: { value: srgb("#06140f") }, uTeal: { value: srgb("#0f5a44").multiplyScalar(0.55) },
      uL1: { value: new THREE.Vector4(0, LIFT, 0, 0) }, uL2: { value: new THREE.Vector4(0, 0, 0, 0) },
      uL1Col: { value: srgb("#ff9a3a").multiplyScalar(0.8) }, uL2Col: { value: srgb("#ffb35c").multiplyScalar(0.8) },
      uFogDen: { value: 1 / 6000 }, uScat: { value: 5 }, uPores: { value: poreTex }, uFocusP: { value: new V3(0, LIFT, 0) }, uKeyR: { value: 520 },
    };
    const mk = (extra) => Object.assign({}, L, { uCamM: { value: new V3() }, uFogMix: { value: 1 } }, extra || {});
    const NSH = 16;
    const shArr = () => { const a = [], b = []; for (let i = 0; i < NSH; i++) { a.push(new THREE.Vector4(0, 0, 0, 0)); b.push(new V3()); } return [a, b]; };

    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(34, 1, 2, 30000);

    // ---- the skin: the curved patch from far up the trough's far side to the cut
    const Z0 = -17000, Z1 = 3200;
    function skinGeo(th0, th1, nT) {
      const pos = [], idx = [];
      for (let i = 0; i <= nT; i++) { const th = lerp(th0, th1, i / nT); const x = RC * Math.sin(th), y = RC * (1 - Math.cos(th)); pos.push(x, y, Z0, x, y, Z1); }
      for (let i = 0; i < nT; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
    }
    const [shA, shB] = shArr();
    const skinU = mk({ uToM: { value: new THREE.Matrix4() }, uSh: { value: shA }, uShAx: { value: shB }, uThMin: { value: THMIN }, uThC: { value: THC }, uSeat: { value: new THREE.Vector4(0, 0, 0, 0) }, uSeatAx: { value: new V3() } });
    const skinMat = new THREE.ShaderMaterial({ uniforms: skinU, vertexShader: SKIN_VERT, fragmentShader: skinFrag(RC, NSH), side: THREE.DoubleSide, extensions: { derivatives: true } });
    const skin = new THREE.Mesh(skinGeo(THMIN, THC, 220), skinMat); skin.frustumCulled = false; sc.add(skin);
    // ---- the cut face: radial, from the skin down into the fog
    const cutU = mk({ uNF: { value: NF } });
    const cutMat = new THREE.ShaderMaterial({ uniforms: cutU, vertexShader: SKIN_VERT.replace("uniform mat4 uToM;", "").replace("(uToM * vec4(position, 1.)).xyz", "position"), fragmentShader: CUT_FRAG(RC), side: THREE.DoubleSide });
    { const d = new V3(Math.sin(THC), -Math.cos(THC), 0), C0 = new V3(0, RC, 0);
      const pA = (r, z) => C0.clone().addScaledVector(d, r).setZ(z);
      const g = new THREE.BufferGeometry();
      const P = [pA(RC, Z0), pA(RC + DEEP, Z0), pA(RC + DEEP, Z1), pA(RC, Z1)];
      g.setAttribute("position", new THREE.Float32BufferAttribute([].concat(...P.map((q) => [q.x, q.y, q.z])), 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, cutMat); m.frustumCulled = false; sc.add(m); }
    // ---- the medium behind everything
    const bgU = mk();
    const bg = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), new THREE.ShaderMaterial({ uniforms: bgU, side: THREE.BackSide, depthWrite: false,
      vertexShader: "varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }", fragmentShader: BG_FRAG }));
    bg.renderOrder = -10; bg.frustumCulled = false; sc.add(bg);

    // ---- the cells
    const held = { s: 0, z: 0 };
    { const q = poreAt(IH * SP, JH * SP); held.s = q.s; held.z = q.z; held.r = q.r; }
    const D_L = 0.6 * U, L_L = 1.7 * U;                 // the lander (the held cell): 0.6 um across
    const cellGeo = (() => {
      const pts = [], R = 0.5, Lh = 1.4, n = 12;
      for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / n; pts.push(new THREE.Vector2(Math.cos(a) * R + 1e-4, -Lh + R + Math.sin(a) * R)); }
      for (let i = 1; i <= 6; i++) pts.push(new THREE.Vector2(R, -Lh + R + (2 * Lh - 2 * R) * i / 7));
      for (let i = 0; i <= n; i++) { const a = Math.PI / 2 * i / n; pts.push(new THREE.Vector2(Math.cos(a) * R + 1e-4, Lh - R + Math.sin(a) * R)); }
      return new THREE.LatheGeometry(pts, 22);
    })();
    // the camera path is needed to place the cells (none may cross the lens or sit in the hand-off frame)
    const P0 = new V3(0, LIFT, 0);
    const Hc = onSkin(held.s, held.z, D_L / 2 + 0.5);
    const nH = nrm(held.s), tH = tan(held.s), ZZ = new V3(0, 0, 1);
    const DB = { l: NF.clone().multiplyScalar(0.66).addScaledVector(nH, 0.5).addScaledVector(ZZ, 0.56).normalize(),
                 p: NF.clone().multiplyScalar(0.5).addScaledVector(nH, 0.66).addScaledVector(ZZ, 0.56).normalize() };
    const DBEAT = { l: 860, p: 1250 }, TILT = 0.7, ROLLK = 0.3;

    // the lander's path: down from the parcel's place with the flow, a bump on the skin, then held on its pore
    const NA = 240, zTab = new Float32Array(NA + 1);
    { let acc = 0; const v = (a) => ss(0, 0.16, a) * (1 - 0.72 * a) * (1 - ss(0.82, 1, a));
      for (let i = 0; i <= NA; i++) { zTab[i] = acc; acc += v((i + 0.5) / NA) / NA; }
      for (let i = 0; i <= NA; i++) zTab[i] /= acc; }
    const zOf = (a) => { const f = sat(a) * NA, i = Math.min(NA - 1, Math.floor(f)); return lerp(zTab[i], zTab[i + 1], f - i); };
    const q0 = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(0.55, 0.42, -0.72).normalize());
    const axH = ZZ.clone().multiplyScalar(-Math.cos(0.42)).addScaledVector(tH, Math.sin(0.42)).normalize();
    const qH = basisQuat(axH, nH);
    function basisQuat(ax, up) {
      const y = ax.clone().normalize(), zl = up.clone().addScaledVector(y, -up.dot(y)).normalize(), x = new V3().crossVectors(y, zl);
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, zl));
    }
    // (round 4: the cell lands by k .3, so the section view holds still over k .3-.7)
    const ka = (k) => sat((k - 0.03) / 0.27);
    function landerAt(k, clock, o) {
      const a = ka(k);
      const s = held.s * ss(0.08, 0.96, a), z = held.z * zOf(a);
      const hDown = lerp(LIFT, D_L / 2 + 0.5, ss(0, 0.62, a));
      const h = hDown + 22 * Math.sin(Math.PI * sat((a - 0.62) / 0.3)) * (a > 0.62 ? 1 : 0);
      const pos = onSkin(s, z, h, o && o.pos);
      const tum = Math.sin(Math.PI * ss(0.05, 0.85, a)) * 0.5;
      const q = (o && o.q) || new THREE.Quaternion();
      q.copy(q0).slerp(qH, ss(0.06, 0.9, a));
      q.premultiply(_qq.setFromAxisAngle(nrm(s), tum));
      // held: pressed onto its pore, a tremor from the flow over it (clock, sub-micron)
      const press = ss(0.9, 1, a);
      if (press > 0) pos.addScaledVector(ZZ, Math.sin(clock * 1.7) * 0.9 * press);
      return { pos: pos, q: q, press: press, a: a };
    }
    const _qq = new THREE.Quaternion();
    const portOf = (asp) => asp < 0.8;
    // the camera: a pure function of k. Out: it follows the lander down with the flow, tilting from face-on to a low
    // view along the skin from beyond the cut; the settle; back: the same way, to face-on over the arrival pore.
    // polish pass: C2 blends (quintic) for every weight the camera reads, then a smoothed sampled table (camAt below)
    const q5 = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
    function camAtRaw(k, port, out) {
      // round 4 (camera 4): tilt in over k .02-.3, hold the section view with no drift over .3-.7, tilt back over .7-.98
      const gin = q5(0.02, 0.3, k), back = q5(0.7, 0.98, k), g = gin * (1 - back);
      const T = k < 0.7 ? landerAt(k, 0).pos : Hc.clone().lerp(P0, back * back * (3 - 2 * back));
      const DBp = port ? DB.p : DB.l;
      const D = slerpV(new V3(0, 1, 0), DBp, TILT * g);     // calm camera: part of the old tilt
      // the settle drifts a few degrees round the held cell (never fully still); zero at both ends
      const H0 = port ? cfg.H0p : cfg.H0;
      const d = Math.exp(lerp(Math.log(H0 - LIFT), Math.log(port ? DBEAT.p : DBEAT.l), g));
      const aim = T.clone().addScaledVector(nH, -(port ? 120 : 60) * g).addScaledVector(NF, (port ? 0 : 30) * g);
      const pos = aim.clone().addScaledVector(D, d);
      // calm camera: the fibre stays upright on screen, as in the macro dive (the old full roll to make the wall a floor
      // was ~63 deg each way); a slight lean only
      const up = new V3(0, 0, -1).lerp(nH, ROLLK * q5(0, 0.6, g)).normalize();
      const r = out || {};
      r.pos = pos; r.tgt = aim; r.up = up; r.focus = T.distanceTo(pos); r.g = g; r.subject = T;
      return r;
    }
    // the smoothed camera: sampled in k for each aspect, one zero-phase Gaussian (sigma KSIG in k) over position, the
    // aim's offset from the subject and up, tapering to zero at k 0 and 1 so both hand-off frames stay exactly the macro
    // fibre's; the subject itself is smoothed lightly (KSIG_T), so it keeps its place on screen. Catmull-Rom between.
    const KN = 3000, KSIG = 0.012, KSIG_T = 0.006, ktab = {};   // (round 4: the raw camera is C2 already; a light touch)
    function kTable(port) {
      const key = port ? "p" : "l";
      if (ktab[key]) return ktab[key];
      const raw = new Float32Array(KN * 12), o = {};
      for (let i = 0; i < KN; i++) { camAtRaw(i / (KN - 1), port, o); const T = o.subject;
        raw.set([o.pos.x, o.pos.y, o.pos.z, o.tgt.x - T.x, o.tgt.y - T.y, o.tgt.z - T.z, o.up.x, o.up.y, o.up.z, T.x, T.y, T.z], i * 12); }
      const sm = new Float32Array(KN * 9), acc = new Float64Array(12);
      for (let i = 0; i < KN; i++) {
        const k = i / (KN - 1), tp = q5(0.002, 0.1, Math.min(k, 1 - k)) * (1 - band(k, 0.3, 0.33, 0.67, 0.7)), sg = KSIG * (KN - 1) * tp, sgT = KSIG_T * (KN - 1) * tp;
        const gather = (s0, ch0, ch1) => {
          if (s0 < 0.35) { for (let ch = ch0; ch < ch1; ch++) acc[ch] = raw[i * 12 + ch]; return; }
          const R = Math.ceil(s0 * 3), k2 = -0.5 / (s0 * s0); let ws = 0;
          for (let ch = ch0; ch < ch1; ch++) acc[ch] = 0;
          for (let j = -R; j <= R; j++) { const w = Math.exp(j * j * k2), q = Math.max(0, Math.min(KN - 1, i + j)) * 12; for (let ch = ch0; ch < ch1; ch++) acc[ch] += w * raw[q + ch]; ws += w; }
          for (let ch = ch0; ch < ch1; ch++) acc[ch] /= ws;
        };
        gather(sg, 0, 9); gather(sgT, 9, 12);
        sm.set([acc[0], acc[1], acc[2], acc[9] + acc[3], acc[10] + acc[4], acc[11] + acc[5], acc[6], acc[7], acc[8]], i * 9);
      }
      return (ktab[key] = sm);
    }
    function camAt(k, port, out) {
      const r = camAtRaw(k, port, out), T = kTable(port);
      const f = sat(k) * (KN - 1), i = Math.min(KN - 2, Math.floor(f)), t = f - i;
      // a uniform cubic B-spline (C2), the samples continued in a straight line off the ends (so k 0 and 1 are exact)
      const at = (k, ch) => k < 0 ? 2 * T[ch] - T[9 + ch] : k > KN - 1 ? 2 * T[(KN - 1) * 9 + ch] - T[(KN - 2) * 9 + ch] : T[k * 9 + ch];
      const t2 = t * t, t3 = t2 * t;
      const cr = (ch) => ((1 - t) * (1 - t) * (1 - t) * at(i - 1, ch) + (3 * t3 - 6 * t2 + 4) * at(i, ch) + (-3 * t3 + 3 * t2 + 3 * t + 1) * at(i + 1, ch) + t3 * at(i + 2, ch)) / 6;
      r.pos = new V3(cr(0), cr(1), cr(2)); r.tgt = new V3(cr(3), cr(4), cr(5)); r.up = new V3(cr(6), cr(7), cr(8)).normalize();
      r.focus = r.subject.distanceTo(r.pos);
      return r;
    }
    function slerpV(a, b, t) { const q = new THREE.Quaternion().setFromUnitVectors(a, b); const q2 = new THREE.Quaternion().slerp(q, t); return a.clone().applyQuaternion(q2); }

    // sample the camera for both aspects (for placing cells)
    const camS = { l: [], p: [] };
    for (let i = 0; i <= 80; i++) { const k = i / 80; camS.l.push([k, camAt(k, false).pos]); camS.p.push([k, camAt(k, true).pos]); }

    const FLOW = 3400;
    const vFlow = (h) => 0.16 + 0.84 * Math.pow(sat(h / 420), 0.8);     // slower near the wall (no slip)
    const cells = [];
    const rr = rngf(4242);
    // a few cells already held on pores (the wall's work, seen along the glide), some mid-division
    const parked = [[IH - 2, JH - 5], [IH - 4, JH + 6], [IH - 1, JH - 13], [IH - 6, JH - 2], [IH - 3, JH - 22], [IH - 9, JH - 9], [IH - 1, JH + 9]];
    function cellPos(cl, k, clock, o) {
      if (cl.parked) { const p = onSkin(cl.s, cl.z, cl.d / 2 + 0.5, o); p.z += Math.sin(clock * 1.3 + cl.ph) * 0.6; return p; }
      const z = cl.z0 - FLOW * k * vFlow(cl.h0);
      let h = cl.h0;
      if (cl.bump) h = cl.d / 2 + 1 + cl.bA * Math.abs(Math.sin(Math.PI * (k * cl.bf + cl.ph)));
      else h += 10 * Math.sin(k * 7 + cl.ph);
      const p = onSkin(cl.s + 14 * Math.sin(k * 3 + cl.ph * 2), z, h, o);
      p.x += Math.sin(clock * 0.5 + cl.ph) * 1.5; p.y += Math.sin(clock * 0.43 + cl.ph * 3) * 1.2;
      return p;
    }
    function cellQuat(cl, k, clock, s, o) {
      const yaw = cl.yaw + (cl.parked ? 0 : k * cl.spin) + 0.03 * Math.sin(clock * 0.37 + cl.ph);
      const pitch = cl.pitch * (cl.bump || cl.parked ? 0.15 : 1) + (cl.parked ? 0 : 0.09 * Math.sin(k * 5 + cl.ph));
      const n = nrm(s), t = tan(s);
      const ax = ZZ.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(t, Math.sin(yaw)).multiplyScalar(Math.cos(pitch)).addScaledVector(n, Math.sin(pitch));
      return o.copy(basisQuat(ax, n));
    }
    // the hand-off cameras (both aspects, at and just inside each end): no cell may be in their frames
    const HK = [0, 0.035, 0.07, 0.93, 0.965, 1], hcams = [];
    HK.forEach((k) => [false, true].forEach((port) => {
      const cp = camAt(k, port), pcm = new THREE.PerspectiveCamera(34, port ? 0.42 : 2.1, 2, 30000);
      pcm.position.copy(cp.pos); pcm.up.copy(cp.up); pcm.lookAt(cp.tgt); pcm.updateProjectionMatrix(); pcm.updateMatrixWorld(); hcams.push([k, pcm]);
    }));
    // the shortest distance between two segments P +- a and Q +- b
    function segDist(P, a, Q, b) {
      const p1 = P.clone().sub(a), d1 = a.clone().multiplyScalar(2), p2 = Q.clone().sub(b), d2 = b.clone().multiplyScalar(2), r = p1.clone().sub(p2);
      const A = d1.dot(d1), E = d2.dot(d2), F = d2.dot(r);
      let s1, t1;
      if (A < 1e-6 && E < 1e-6) return r.length();
      if (A < 1e-6) { s1 = 0; t1 = sat(F / E); }
      else { const C = d1.dot(r); if (E < 1e-6) { t1 = 0; s1 = sat(-C / A); } else { const B = d1.dot(d2), den = A * E - B * B; s1 = den > 1e-9 ? sat((B * F - C * E) / den) : 0; t1 = (B * s1 + F) / E; if (t1 < 0) { t1 = 0; s1 = sat(-C / A); } else if (t1 > 1) { t1 = 1; s1 = sat((B - C) / A); } } }
      return p1.addScaledVector(d1, s1).sub(p2.addScaledVector(d2, t1)).length();
    }
    const NK = 40, lanS = [];
    for (let i = 0; i <= NK; i++) lanS.push(landerAt(i / NK, 0).pos.clone());
    const why = { hand: 0, cam: 0, lander: 0, held: 0, cells: 0 };
    const tryCell = (cl) => {
      for (const [k, pcm] of hcams) {
        const v = cellPos(cl, k, 0).project(pcm), m = 1.06 + cl.L / 420;
        if (v.z < 1 && Math.abs(v.x) < m && Math.abs(v.y) < m) { why.hand++; return false; }
      }
      const tr = [], ax = [];
      for (let i = 0; i <= NK; i++) {
        const P = cellPos(cl, i / NK, 0); tr.push(P);
        const sN = cl.parked ? cl.s : cl.s + 14 * Math.sin(i / NK * 3 + cl.ph * 2);
        const A = new V3(0, 1, 0).applyQuaternion(cellQuat(cl, i / NK, 0, sN, new THREE.Quaternion())).multiplyScalar(Math.max(0, cl.L / 2 - cl.d / 2)); ax.push(A);
        for (const pk of ["l", "p"]) { const cp = camS[pk][i * 2][1]; if (cp.distanceTo(P) < cl.L / 2 + (i / NK > 0.42 && i / NK < 0.72 ? 200 : 480)) { why.cam++; return false; } }
        if (lanS[i].distanceTo(P) < cl.L / 2 + L_L / 2 + 6) { why.lander++; return false; }
        if (!cl.parked && Hc.distanceTo(P) < cl.L / 2 + L_L / 2 + 30 && i / NK > 0.4) { why.held++; return false; }
        for (const o of cells) { const Q = o.tr[i]; if (Q.distanceTo(P) < (cl.L + o.L) / 2 + 8 && segDist(P, ax[i], Q, o.ax[i]) < (cl.d + o.d) / 2 + 8) { why.cells++; return false; } }
      }
      cl.tr = tr; cl.ax = ax;
      return true;
    };
    const newCell = (d, s, z0, h0, parked) => {
      const cl = { d: d, L: d * (2.4 + 1.5 * rr()), s: s, z0: z0, z: z0, h0: h0, parked: parked, ph: rr() * 6.28, yaw: (rr() - 0.5) * 1.2, pitch: (rr() - 0.5) * 0.5,
                   spin: (rr() - 0.5) * 0.8, bump: false, bA: 0, bf: 0, tint: rr(), div: rr() < 0.15 ? 0.6 + 0.4 * rr() : 0, seed: rr() };
      return cl;
    };
    parked.forEach(([i, j]) => {
      const q = poreAt(i * SP, j * SP); if (!q.on) return;
      const cl = newCell((0.55 + 0.4 * rr()) * U, q.s, q.z, 0, true); cl.z = q.z;
      if (tryCell(cl)) cells.push(cl);
    });
    // two populations: cells around the held cell during the settle (slow, near the wall: they bump it and creep), and
    // the wider culture along the glide
    const t0 = performance.now();
    function place(nWant, budget, local) {
      for (let n = 0, tries = 0; n < nWant && tries < budget; tries++) {
        const d = (0.25 + 0.75 * Math.pow(rr(), 0.45)) * U;                  // 0.25-1.0 um, most of them large
        const near = local ? rr() < 0.8 : rr() < 0.66;
        const h0 = near ? d / 2 + 1 + rr() * 40 : d / 2 + 60 + Math.pow(rr(), 1.6) * (local ? 110 : 520);
        const s = local ? lerp(380, IC * SP - 60, rr()) : lerp(-2300, IC * SP - 70, Math.pow(rr(), 0.7));
        const z0 = local ? held.z + lerp(-650, 600, rr()) + FLOW * 0.57 * vFlow(h0) : lerp(-12500, 4200, rr());
        const cl = newCell(d, s, z0, h0, false);
        if (near && rr() < 0.7) { cl.bump = true; cl.bA = 10 + rr() * 26; cl.bf = 1 + rr() * 2.5; }
        if (s > IC * SP - cl.L * 0.5 - 20) continue;
        if (tryCell(cl)) { cells.push(cl); n++; }
      }
    }
    place(18, 14000, true);
    place(58, 6000, false);
    const placeMs = Math.round(performance.now() - t0);
    const lander = { d: D_L, L: L_L, lander: true, tint: 0.55, div: 0, seed: 0.37 };
    cells.push(lander);
    const NC = cells.length;
    const iGeo = cellGeo.clone();
    const aInfo = new THREE.InstancedBufferAttribute(new Float32Array(NC * 4), 4), aDiv = new THREE.InstancedBufferAttribute(new Float32Array(NC), 1);
    iGeo.setAttribute("aInfo", aInfo); iGeo.setAttribute("aDiv", aDiv);
    const cellU = mk({ uDesat: { value: 0 } });
    const cellMat = new THREE.ShaderMaterial({ uniforms: cellU, vertexShader: CELL_VERT, fragmentShader: CELL_FRAG, transparent: true, depthWrite: true });
    const cellMesh = new THREE.InstancedMesh(iGeo, cellMat, NC); cellMesh.frustumCulled = false; cellMesh.renderOrder = 2;
    cellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); aInfo.setUsage(THREE.DynamicDrawUsage); aDiv.setUsage(THREE.DynamicDrawUsage);
    sc.add(cellMesh);
    const landerObj = new THREE.Object3D();

    // ---- the protectant motes: through pores near the held cell, along the glide, and down the section's channels
    const NM = 820;
    const mA = new Float32Array(NM * 4), mB = new Float32Array(NM * 4);
    { const r = rngf(777); const nearP = [], edgeP = [], glideP = [];
      for (let i = IH - 6; i <= IH; i++) for (let j = JH - 9; j <= JH + 8; j++) { const q = poreAt(i * SP, j * SP); if (q.on && !(i === IH && j === JH)) nearP.push(q); }
      for (let j = JH - 9; j <= JH + 9; j++) { const q = poreAt(IC * SP, j * SP); if (q.on) edgeP.push(q); }
      for (let n = 0; n < 60; n++) { const q = poreAt(lerp(-700, IC * SP - SP, r()), lerp(-1300, 300, r())); if (q.on && !(q.i === IH && q.j === JH)) glideP.push(q); }
      for (let n = 0; n < NM; n++) {
        const u = r(); const list = u < 0.36 ? nearP : u < 0.78 ? edgeP : glideP; const q = list[Math.floor(r() * list.length)];
        const edge = list === edgeP ? 1 : 0;
        mA.set([q.s, q.z, edge, r() * 10], n * 4);
        mB.set([r(), 3 + r() * 2.5, 30 + Math.pow(r(), 1.5) * 300, (r() - 0.5) * (edge ? 40 : 160)], n * 4);
      } }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NM * 3), 3));
    mg.setAttribute("aA", new THREE.BufferAttribute(mA, 4)); mg.setAttribute("aB", new THREE.BufferAttribute(mB, 4));
    const moteU = { uK: { value: 0 }, uClock: { value: 0 }, uPx: { value: 500 }, uA: { value: 0 }, uNF: { value: NF }, uAp: { value: 0 }, uFocus: { value: 600 } };
    const motes = new THREE.Points(mg, new THREE.ShaderMaterial({ uniforms: moteU, vertexShader: MOTE_VERT(RC), fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    motes.frustumCulled = false; motes.renderOrder = 4; sc.add(motes);

    // ---- debris in the medium (parallax; bokeh when out of focus)
    const ND = 150, dD = new Float32Array(ND * 4), dE = new Float32Array(ND * 4);
    { const r = rngf(31337);
      for (let n = 0; n < ND; n++) {
        const s = lerp(-2400, 2400, r()), h = 30 + Math.pow(r(), 1.3) * 1100, th = s / RC, rr2 = RC - h;
        dD.set([rr2 * Math.sin(th), RC - rr2 * Math.cos(th), lerp(-12000, 4000, r()), 2 + Math.pow(r(), 3) * 9], n * 4);
        dE.set([r() * 10, r(), 0.4 + r() * 0.8, 0], n * 4);
      } }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
    dg.setAttribute("aD", new THREE.BufferAttribute(dD, 4)); dg.setAttribute("aE", new THREE.BufferAttribute(dE, 4));
    const debU = { uK: { value: 0 }, uClock: { value: 0 }, uPx: { value: 500 }, uA: { value: 0 }, uAp: { value: 0 }, uFocus: { value: 600 }, uZlo: { value: -12000 }, uZspan: { value: 16000 } };
    const debris = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: debU, vertexShader: DEB_VERT, fragmentShader: DEB_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    debris.frustumCulled = false; debris.renderOrder = 5; sc.add(debris);

    // ---- the parcel's glow (the macro scene's own sprite, drawn the same here), and the scale bracket
    const glow = c.glowSprite(cfg.AMBER, 1); glow.material.depthTest = false; glow.material.color.multiplyScalar(2.2); glow.position.copy(P0); sc.add(glow);
    let brP = null;
    // (calm camera: the camera stays upright, so a pore above the held cell sits in frame; one below fell off its foot)
    for (const [i, j] of [[IH, JH - 3], [IH - 1, JH - 3], [IH, JH - 4], [IH + 1, JH - 3], [IH, JH + 2]]) { const q = poreAt(i * SP, j * SP); if (q.on) { brP = q; break; } }
    const bracket = (() => {
      const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.45), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const n = nrm(brP.s), t = tan(brP.s), w = 1.3, lift = 4;
      // across the pore along the fibre (z): a bar the pore's width, with end ticks; it sits just over the skin
      const c0 = onSkin(brP.s, brP.z, lift), half = brP.r;
      const bar = (a, b) => { const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.5, len), mat); m.position.copy(a).lerp(b, 0.5); m.lookAt(b); return m; };
      const A = c0.clone().addScaledVector(ZZ, -half), B = c0.clone().addScaledVector(ZZ, half);
      // (it spans the hole itself, rim to rim)
      g.add(bar(A, B));
      g.add(bar(A.clone().addScaledVector(t, -5), A.clone().addScaledVector(t, 5)));
      g.add(bar(B.clone().addScaledVector(t, -5), B.clone().addScaledVector(t, 5)));
      g.renderOrder = 9; g.children.forEach((m) => { m.renderOrder = 9; });
      sc.add(g); g.material = mat; g.mid = A.clone().lerp(B, 0.5).addScaledVector(n, 6); return g;
    })();

    // ---- render targets: the micro buffer (colour + 24-bit depth), the depth-of-field result, and the copy into LOOK
    let rtW = 0, rtH = 0, rtA = null, rtB = null;
    function ensureRT(w, h) {
      if (w === rtW && h === rtH && rtA) return;
      if (rtA) { rtA.dispose(); rtB.dispose(); }
      rtW = w; rtH = h;
      const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false };
      rtA = new THREE.WebGLRenderTarget(w, h, o);
      rtA.depthTexture = new THREE.DepthTexture(w, h); rtA.depthTexture.type = THREE.UnsignedIntType;
      rtA.depthTexture.minFilter = rtA.depthTexture.magFilter = THREE.NearestFilter;
      rtB = new THREE.WebGLRenderTarget(w, h, Object.assign({}, o, { depthBuffer: false }));
      dofU.tCol.value = rtA.texture; dofU.tDep.value = rtA.depthTexture; dofU.uTexel.value.set(1 / w, 1 / h);
      copyU.tCol.value = rtB.texture;
    }
    const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const dofU = { tCol: { value: null }, tDep: { value: null }, uTexel: { value: new THREE.Vector2() }, uNear: { value: 2 }, uFar: { value: 30000 }, uFocus: { value: 600 }, uAp: { value: 0 }, uMax: { value: 0 } };
    const dofScene = new THREE.Scene(); dofScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: QUAD_VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false })));
    const copyU = { tCol: { value: null } };
    const copyScene = new THREE.Scene(); copyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: copyU, vertexShader: QUAD_VERT, fragmentShader: COPY_FRAG, depthTest: false, depthWrite: false })));
    dofScene.children[0].frustumCulled = false; copyScene.children[0].frustumCulled = false;

    // ---- the macro fibre's inner wall: the same skin shader, with a macro->micro matrix (local fibre coordinates)
    function innerMaterial(zc) {
      // (DS -1: the camera dives along +x, so micro x = -world y and micro y = RC - world x: still a rotation, det > 0)
      const toM = new THREE.Matrix4().set(
        0, DS / MM, 0, 0,
        DS / MM, 0, 0, RC,
        0, 0, -1 / MM, -(zc - cfg.FZ) / MM,
        0, 0, 0, 1);
      const [a, b] = shArr();
      const u = mk({ uToM: { value: toM }, uSh: { value: a }, uShAx: { value: b }, uThMin: { value: -10 }, uThC: { value: 10 }, uL1: { value: new THREE.Vector4(0, 0, 0, 0) }, uSeat: { value: new THREE.Vector4(0, 0, 0, 0) }, uSeatAx: { value: new V3() },
                     uFocusP: { value: new V3(0, LIFT, 0) }, uKeyR: { value: 520 } });
      u.uFogMix.value = 0;
      const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKIN_VERT, fragmentShader: skinFrag(RC, NSH), side: THREE.BackSide, extensions: { derivatives: true } });
      m.toMicro = (w, o) => (o || new V3()).set(DS * (w.y - cfg.AX[1]) / MM, RC + DS * (w.x - cfg.FIBX) / MM, -(w.z - cfg.FZ) / MM);
      return m;
    }

    // ---- per frame
    const _c = {}, _p = new V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new V3();
    const order = [];
    const fadeIn = (k) => ss(0.02, 0.13, k);
    function lightsAt(k) {
      // L1: the parcel's light at the arrival point (both hand-offs); L2: the light on the held cell (focus by light)
      L.uL1.value.set(P0.x, P0.y, P0.z, 1.0 * (1 - ss(0.0, 0.16, k)) + 1.0 * ss(0.84, 1, k));
      return L;
    }
    function draw(k, clock) {
      const port = portOf(c.aspect);
      cam.aspect = c.aspect;
      camAt(k, port, _c);
      cam.position.copy(_c.pos); cam.up.copy(_c.up); cam.lookAt(_c.tgt);
      cam.fov = 34; cam.near = 2; cam.far = 30000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      bg.position.copy(cam.position);
      // lights: L1 is the parcel's light; on the way in it goes with the lander as it fades, on the way out it returns
      // at the arrival point (the macro parcel's place)
      lightsAt(k);
      const lp = landerAt(k, clock);
      const gp = k < 0.5 ? lp.pos : P0;
      L.uL1.value.x = gp.x; L.uL1.value.y = gp.y; L.uL1.value.z = gp.z;
      const hl = band(k, 0.1, 0.36, 0.74, 0.9);
      L.uL2.value.set(lp.pos.x + nH.x * 90 + NF.x * 40, lp.pos.y + nH.y * 90 + NF.y * 40, lp.pos.z + 40, 0.6 * hl);
      [skinU, cutU, cellU, bgU].forEach((u) => { u.uCamM.value.copy(cam.position); });
      // the cells: positions, then sorted far to near
      order.length = 0;
      const glowK = 1 - fadeIn(k);
      cells.forEach((cl, i) => {
        if (cl.lander) { cl.pos = lp.pos; cl.q = lp.q; cl.s = held.s * ss(0.08, 0.96, lp.a); }
        else { cl.pos = cellPos(cl, k, clock, cl.pos); const s = cl.parked ? cl.s : cl.s + 14 * Math.sin(k * 3 + cl.ph * 2); cl.q = cellQuat(cl, k, clock, s, cl.q || new THREE.Quaternion()); }
        cl.dc = cl.pos.distanceToSquared(cam.position);
        order.push(cl);
      });
      order.sort((a, b) => b.dc - a.dc);
      order.forEach((cl, i) => {
        let sx = cl.d, sy = cl.L / 2.8, sz = cl.d;
        if (cl.lander) { const pr = lp.press; sx *= 1 + 0.06 * pr; sz *= 1 - 0.15 * pr; }
        else if (cl.parked) { sx *= 1.04; sz *= 0.9; }
        _m.compose(cl.pos, cl.q, _s.set(sx, sy, sz));
        cellMesh.setMatrixAt(i, _m);
        const a = cl.lander ? ss(0.03, 0.15, k) : 1;
        aInfo.setXYZW(i, cl.tint, cl.lander ? 0.9 * band(k, 0.0, 0.03, 0.06, 0.2) : 0, cl.seed * 10, a);
        aDiv.setX(i, cl.div);
      });
      cellMesh.instanceMatrix.needsUpdate = true; aInfo.needsUpdate = true; aDiv.needsUpdate = true;
      landerObj.position.copy(lp.pos); landerObj.updateMatrixWorld();
      { const sw = 0.45 * ss(0.26, 0.3, k) * (1 - ss(0.34, 0.48, k)) + 0.1 * band(k, 0.32, 0.38, 0.62, 0.7);
        skinU.uSeat.value.set(lp.pos.x, lp.pos.y, lp.pos.z, sw);
        skinU.uSeatAx.value.set(0, 1, 0).applyQuaternion(lp.q).multiplyScalar(L_L / 2 - D_L / 2); }
      // contact shadows: the cells nearest the subject that touch (or nearly touch) the skin, faded by distance
      const cand = cells.map((cl) => {
        const ax = new V3(0, 1, 0).applyQuaternion(cl.q).multiplyScalar(cl.L / 2 - cl.d / 2);
        const hh = RC - Math.hypot(cl.pos.x, RC - cl.pos.y);
        return { cl: cl, ax: ax, gap: hh - cl.d / 2, dd: cl.pos.distanceTo(_c.subject) };
      }).filter((o) => o.gap < 90).sort((a, b) => a.dd - b.dd);
      for (let i = 0; i < NSH; i++) {
        const o = cand[i];
        if (!o) { shA[i].w = 0; continue; }
        const w = (1 - ss(1300, 1900, o.dd)) * (1 - ss(20, 90, o.gap)) * ss(0.02, 0.12, k) * (1 - ss(0.9, 0.98, k)) * (o.cl.lander ? ss(0.03, 0.15, k) : 1);
        shA[i].set(o.cl.pos.x, o.cl.pos.y, o.cl.pos.z, w > 0.01 ? o.cl.d / 2 * w + 1e-3 : 0); shB[i].copy(o.ax);
      }
      // focus, depth of field, debris, motes
      const ap = ss(0.05, 0.3, k) * (1 - ss(0.72, 0.95, k));
      L.uFocusP.value.copy(_c.subject); L.uKeyR.value = lerp(520, 470, _c.g); cellU.uDesat.value = 0.5 * ap;
      // the close-up's buffer is capped at a pixel budget (a retina desk is 4 M px: 18 ms; most of this frame is out of
      // focus anyway, and the LOOK composer upsamples it)
      const pr0 = c.rend.getPixelRatio(), pb = Math.min(1, Math.sqrt(((window.V4Q && window.V4Q.microBudget) || 2.0e6) / Math.max(1, c.W * c.H * pr0 * pr0)));
      const pr = pr0 * pb, bw = Math.max(2, Math.floor(c.W * pr)), bh = Math.max(2, Math.floor(c.H * pr));
      ensureRT(bw, bh);
      const pxScale = bh / (2 * Math.tan(cam.fov * Math.PI / 360));
      const apPx = 26 * (bh / 900) * ap, maxPx = 18 * (bh / 900) * ap;
      dofU.uFocus.value = _c.focus; dofU.uAp.value = apPx * 1.0; dofU.uMax.value = maxPx; dofU.uNear.value = cam.near; dofU.uFar.value = cam.far;
      debU.uK.value = k; debU.uClock.value = clock; debU.uPx.value = pxScale; debU.uAp.value = apPx; debU.uFocus.value = _c.focus;
      debU.uA.value = 0.9 * fadeIn(k) * (1 - ss(0.86, 0.96, k));
      moteU.uK.value = k; moteU.uClock.value = clock; moteU.uPx.value = pxScale; moteU.uAp.value = apPx; moteU.uFocus.value = _c.focus;
      moteU.uA.value = 0.85 * ss(0.12, 0.26, k) * (1 - ss(0.8, 0.92, k));
      // the parcel's glow at the arrival point, the macro head's size: it fades as the cell resolves, and returns
      glow.material.opacity = Math.max(glowK, ss(0.86, 1, k)); glow.position.copy(gp);
      glow.scale.setScalar(cam.position.distanceTo(gp) * (cfg.headK ? cfg.headK(c) : 0.42));
      bracket.material.opacity = band(k, 0.4, 0.45, 0.66, 0.7);   // (round 4b: with its label)
      // render: micro buffer -> depth of field -> (LOOK composer draws the copy)
      const rend = c.rend, old = rend.getRenderTarget();
      rend.setRenderTarget(rtA); rend.clear(true, true, false); rend.render(sc, cam);
      rend.setRenderTarget(rtB); rend.render(dofScene, qCam);
      rend.setRenderTarget(old);
      c.renderScene = copyScene; c.renderCam = qCam;
      return { k: k, cam: cam };
    }
    function band(x, a, b, cc, d) { return ss(a, b, x) * (1 - ss(cc, d, x)); }

    // the macro side: each macro frame updates the inner wall's camera, light and fog in micro units
    const _w = new V3();
    function updateInner(mat, macroCam, parcelW, k1, fogMix) {
      mat.toMicro(macroCam.position, mat.uniforms.uCamM.value);
      mat.uniforms.uFogMix.value = fogMix;
      mat.toMicro(parcelW, _w);
      mat.uniforms.uL1.value.set(_w.x, _w.y, _w.z, k1);
    }

    return {
      scene: sc, cam: cam, draw: draw, innerMaterial: innerMaterial, updateInner: updateInner,
      onSkin: onSkin, nrm: nrm, IC: IC, SP: SP, JH: JH, NF: NF, landerPos: (k) => landerAt(k, 0).pos, camAtK: (k) => camAt(k, portOf(c.aspect)),
      // the close-up's camera at k on a scratch camera, without drawing (the clip player's label layout)
      camFor: (k, cm) => { const r = camAt(k, portOf(c.aspect)); cm.aspect = c.aspect; cm.position.copy(r.pos); cm.up.copy(r.up); cm.lookAt(r.tgt);
        cm.fov = 34; cm.near = 2; cm.far = 30000; cm.updateProjectionMatrix(); cm.updateMatrixWorld(); return cm; },
      subject: () => _c.subject, lander: { m: landerObj }, cells: cells, why: why, placeMs: () => placeMs, MM: MM, RC: RC, LIFT: LIFT, Q: [0, 0], held: held, Hc: Hc,
      // anchors for the marks (micro coordinates)
      anchors: { lumen: onSkin(-200, -2600, 520), shell: onSkin(IC * SP, (JH - 6) * SP, -700).addScaledVector(NF, 4), pore: bracket.mid, bracket: bracket },
      extra: [[dofScene, qCam], [copyScene, qCam]],
      textures: [poreTex],
    };
  };
})();
