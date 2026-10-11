// V4-local composer and quality modes (polish pass, 9-10 Oct 2026). Loaded after hardware/js/look.js, which V4 must not
// edit; it replaces LOOK.Composer for this page only (the same API: setSize, render, uniforms, sceneRT, bright).
//
// What changed against look.js's composer, and why (measured on V4's frames, tools/v4_polish.py crops):
//   - The resolve. look.js renders the scene supersampled (1.5x) and the composite read it back with ONE bilinear tap
//     per screen pixel, which covers only part of the pixel's footprint: thin tubes and the bench grid crawled. Here the
//     composite gathers 5 taps over the whole footprint (a small tent), so edges are averaged, not sampled.
//   - The bloom. look.js took the bright pass at a quarter of the screen with one tap from the 1.5x buffer (1 sample per
//     6x6 pixels), then blurred with taps 1.4 texels apart: a bright tube 1-2 px wide fell between samples from frame to
//     frame, so the glow shimmered as the camera moved. Here: a 4-tap bright pass at half size, then a 4x4-box
//     downsample chain (1/4 .. 1/32) with a blur at each level: every bright pixel always lands in the bloom.
//   - NaN and overflow are scrubbed before the bloom (one NaN pixel used to spread into a black block).
//   - Grading after the tone curve: a little more contrast, cool shadows, warm highlights, saturation held, so the
//     amber and the green separate from the neutral machine (the house look: ACES, the same exposure and vignette).
//   - Quality modes. ?capture=1 (for the scroll-scrubbed clips): pixel ratio 2 (?pr=), supersampling 1.5x (?ss=) with no
//     pixel budget, a 4096 shadow map, a bigger close-up buffer, no grain (?grain= to override; the page's CSS grain
//     overlay stays live over the video). window.V4Q holds the mode; the scene reads it.
(function () {
  "use strict";
  const L = window.LOOK, srgb = RQ.srgb;
  const Q = new URLSearchParams(location.search);
  const CAP = Q.get("capture") === "1";
  const num = (k, d) => (Q.get(k) !== null && !isNaN(+Q.get(k)) ? +Q.get(k) : d);
  const V4Q = window.V4Q = {
    capture: CAP,
    // canvas pixel ratio (live: look.js's min(dpr, 1.75)). Capture: ?pr= exactly, else max(2, the page's DSF), so a
    // clip rendered at its own DSF (phone 1080/390 = 2.77) gets a canvas of exactly the clip's pixels (round 4b)
    pr: CAP ? num("pr", Math.max(2, window.devicePixelRatio || 1)) : null,
    ss: CAP ? num("ss", 1.5) : num("ss", 1.5),      // supersampling of the scene buffer (capture: on top of pr 2)
    // the supersampled buffer's pixel budget. Live: 4.4 M px, so a 1440x900 desk at DPR 1 gets the full 1.5x (2.9 M px)
    // and a retina desk (DPR 1.75: 4.0 M px before supersampling) about 1.05x; its pixels are already dense, and the
    // occlusion and depth of field passes scale with this buffer (measured: 5.6 M px cost a retina desk 60 fps)
    // (render pass, 10 Oct: 4.0 M px. A retina desk's canvas is already 3.97 M px, so 4.4 got it 1.05x supersampling,
    // which bought nothing visible and cost ~10 % of its fill; desk at DPR 1 (2.9 M px at 1.5x) and phone keep theirs)
    budget: CAP ? 64e6 : 4.0e6,
    shadow: CAP ? 4096 : 2048,
    microBudget: CAP ? 16e6 : 2.0e6,
    grain: Q.get("grain") !== null ? num("grain", 0.01) : (CAP ? 0 : null),
  };
  if (V4Q.pr) {
    const R0 = L.renderer;
    L.renderer = function (canvas) { const r = R0(canvas); r.setPixelRatio(V4Q.pr); return r; };
  }

  const QUAD_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const SAFE = "vec3 safe(vec3 c) { return (c.r == c.r && c.g == c.g && c.b == c.b) ? clamp(c, 0.0, 64.0) : vec3(0.0); }\n";
  // bright pass at half size: 4 taps over the footprint, soft knee
  const BRIGHT_FRAG = "uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uThreshold, uKnee; varying vec2 vUv;\n" + SAFE +
    "vec3 kn(vec3 c) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float k = clamp((l - uThreshold + uKnee) / max(2.0 * uKnee, 1e-4), 0.0, 1.0);\n" +
    "  k = k * k * (l > uThreshold - uKnee ? 1.0 : 0.0); return c * k; }\n" +
    "void main() { vec2 o = uTexel * 0.3;\n" +
    "  vec3 c = kn(safe(texture2D(tDiffuse, vUv + vec2(o.x, o.y)).rgb)) + kn(safe(texture2D(tDiffuse, vUv + vec2(-o.x, o.y)).rgb))\n" +
    "         + kn(safe(texture2D(tDiffuse, vUv + vec2(o.x, -o.y)).rgb)) + kn(safe(texture2D(tDiffuse, vUv - o).rgb));\n" +
    "  gl_FragColor = vec4(c * 0.25, 1.0); }";
  // a 4x4 box downsample (4 bilinear taps at the corners of the 2x2 source block)
  const DOWN_FRAG = "uniform sampler2D tDiffuse; uniform vec2 uSrc; varying vec2 vUv;\n" +
    "void main() { vec2 o = uSrc;\n" +
    "  vec3 c = texture2D(tDiffuse, vUv + vec2(o.x, o.y)).rgb + texture2D(tDiffuse, vUv + vec2(-o.x, o.y)).rgb\n" +
    "         + texture2D(tDiffuse, vUv + vec2(o.x, -o.y)).rgb + texture2D(tDiffuse, vUv - o).rgb;\n" +
    "  gl_FragColor = vec4(c * 0.25, 1.0); }";
  const BLUR_FRAG = "uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;\n" +
    "void main() { float w[5]; w[0] = 0.2270; w[1] = 0.1946; w[2] = 0.1216; w[3] = 0.0540; w[4] = 0.0162;\n" +
    "  vec3 c = texture2D(tDiffuse, vUv).rgb * w[0];\n" +
    "  for (int i = 1; i < 5; i++) { vec2 o = uDir * float(i); c += (texture2D(tDiffuse, vUv + o).rgb + texture2D(tDiffuse, vUv - o).rgb) * w[i]; }\n" +
    "  gl_FragColor = vec4(c, 1.0); }";
  // ambient occlusion (screen space, Alchemy-style, at half the scene buffer): positions from the depth buffer through the
  // camera's own inverse projection (lens shift included), normals from the nearer neighbour on each axis, 12 taps on a
  // golden-angle spiral rotated per pixel, a world radius in mm, occluders beyond the radius ignored (no halos)
  const AO_FRAG = [
    "uniform sampler2D tDepth; uniform vec2 uTexel; uniform mat4 uPInv; uniform vec2 uPS; uniform float uR, uInt, uBias;",
    "varying vec2 vUv;",
    "vec3 vpos(vec2 uv) { float d = texture2D(tDepth, uv).r; vec4 v = uPInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }",
    "void main() {",
    "  float d0 = texture2D(tDepth, vUv).r;",
    "  if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }",
    "  vec3 P = vpos(vUv);",
    "  vec3 a = vpos(vUv + vec2(uTexel.x, 0.0)) - P, b = P - vpos(vUv - vec2(uTexel.x, 0.0));",
    "  vec3 c = vpos(vUv + vec2(0.0, uTexel.y)) - P, e = P - vpos(vUv - vec2(0.0, uTexel.y));",
    "  vec3 dx = abs(a.z) < abs(b.z) ? a : b, dy = abs(c.z) < abs(e.z) ? c : e;",
    "  vec3 N = normalize(cross(dx, dy)); if (dot(N, -P) < 0.0) N = -N;",
    "  vec2 rad = uPS * uR * 0.5 / max(-P.z, 1e-3);",
    "  float ang = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));",
    "  float ao = 0.0, R2 = uR * uR;",
    "  for (int i = 0; i < 12; i++) {",
    "    float t = (float(i) + 0.5) / 12.0;",
    "    vec2 o = vec2(cos(ang), sin(ang)) * rad * t; ang += 2.3999632;",
    "    vec3 v = vpos(vUv + o) - P; float vv = dot(v, v);",
    "    ao += max(0.0, dot(v, N) - uBias * -P.z) / (vv + 0.01 * R2) * (1.0 - smoothstep(0.6 * R2, R2, vv));",
    "  }",
    "  ao = clamp(1.0 - uInt * 2.0 * ao * uR / 12.0, 0.0, 1.0);",
    "  gl_FragColor = vec4(vec3(ao), 1.0);",
    "}"].join("\n");
  // depth of field at half the scene buffer (polish pass: full-size gathers with few taps read as grain over the thin
  // clear tubes). 1) prep: a 2x2 box of the scene (with the occlusion applied) and the circle of confusion in alpha;
  // 2) a golden-angle gather of that (after D. Gustafsson's single-pass bokeh), up to uTaps taps; 3) the post pass, at
  // the scene buffer's size, keeps the sharp pixel where it is in focus and the gathered one where it is not.
  const COC = "float lin(float d) { float zn = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - zn * (uFar - uNear)); }\n" +
              "float coc(float z) { return clamp(uAp * abs(z - uFocus) / max(z, 1e-3), 0.0, uMax); }\n";
  const AOAT = "float aoAt(vec2 uv) { vec2 o = uAOTexel * 0.75; return 0.25 * (texture2D(tAO, uv + o).r + texture2D(tAO, uv - o).r + texture2D(tAO, uv + vec2(o.x, -o.y)).r + texture2D(tAO, uv + vec2(-o.x, o.y)).r); }\n";
  const PREP_FRAG = ["uniform sampler2D tCol, tDep, tAO; uniform vec2 uSrc, uAOTexel; uniform float uNear, uFar, uFocus, uAp, uMax, uAOK;",
    "varying vec2 vUv;", SAFE, COC, AOAT,
    "void main() {",
    "  vec2 o = uSrc * 0.5;",
    "  vec3 c = safe(texture2D(tCol, vUv + o).rgb) + safe(texture2D(tCol, vUv - o).rgb) + safe(texture2D(tCol, vUv + vec2(o.x, -o.y)).rgb) + safe(texture2D(tCol, vUv + vec2(-o.x, o.y)).rgb);",
    "  float z = min(min(lin(texture2D(tDep, vUv + o).r), lin(texture2D(tDep, vUv - o).r)), min(lin(texture2D(tDep, vUv + vec2(o.x, -o.y)).r), lin(texture2D(tDep, vUv + vec2(-o.x, o.y)).r)));",
    "  gl_FragColor = vec4(c * 0.25 * mix(1.0, aoAt(vUv), uAOK), sign(z - uFocus) * coc(z));",   // signed: + behind focus
    "}"].join("\n");
  const GATHER_FRAG = ["uniform sampler2D tPre; uniform vec2 uTexel; uniform float uMax, uTaps;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec4 c0 = texture2D(tPre, vUv); vec3 col = c0.rgb; float cz = c0.a, cs = abs(cz);",
    "  float tot = 1.0, rs = max(uMax * uMax / max(uTaps * 2.0, 1.0), 0.25), radius = rs;",
    "  float ang = 6.2832 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));",
    "  for (int i = 0; i < 96; i++) {",
    "    if (radius >= uMax || float(i) >= uTaps) break;",
    "    vec4 t = texture2D(tPre, vUv + vec2(cos(ang), sin(ang)) * uTexel * radius);",
    "    float sss = abs(t.a); if (t.a > cz) sss = min(sss, cs * 2.0);",   // behind the centre: it cannot spill far over it
    "    float m = smoothstep(radius - 0.5, radius + 0.5, sss);",
    "    col += mix(col / tot, t.rgb, m); tot += 1.0;",
    "    ang += 2.39996; radius += rs / radius;",
    "  }",
    "  gl_FragColor = vec4(col / tot, cs);",
    "}"].join("\n");
  const POST_FRAG = [
    "uniform sampler2D tCol, tDep, tAO, tDof; uniform vec2 uAOTexel, uDofTexel; uniform float uNear, uFar, uFocus, uAp, uMax, uAOK, uDof;",
    "varying vec2 vUv;", SAFE, COC, AOAT,
    "void main() {",
    "  vec3 col = safe(texture2D(tCol, vUv).rgb) * mix(1.0, aoAt(vUv), uAOK);",
    "  if (uDof > 0.5) {",
    "    vec2 q = uDofTexel * 0.75;",                                                 // a small tent over the gather's grain
    "    vec4 b = 0.25 * (texture2D(tDof, vUv + q) + texture2D(tDof, vUv - q) + texture2D(tDof, vUv + vec2(q.x, -q.y)) + texture2D(tDof, vUv + vec2(-q.x, q.y)));",
    "    float cf = coc(lin(texture2D(tDep, vUv).r)) * 0.5;",                     // in half-buffer px, as the gather's
    "    col = mix(col, b.rgb, smoothstep(0.35, 1.6, max(cf, abs(b.a) * 0.6)));",
    "  }",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"].join("\n");
  const COMPOSITE_FRAG = [
    "uniform sampler2D tScene, tB0, tB1, tB2, tB3; uniform vec2 uOut;",
    "uniform float uStrength, uExposure, uVignette, uGrain, uSeed, uAurora, uTime, uAurGamma, uSat, uContrast, uSplit;",
    "uniform vec3 uAurCol; varying vec2 vUv;",
    SAFE,
    "vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }",
    "vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }",
    "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float aur(vec2 uv, float t) {",
    "  float a = 0.0;",
    "  a += 0.55 * exp(-pow((uv.y - 0.30 - 0.10 * sin(uv.x * 2.1 + t * 0.21)) * 3.1, 2.0));",
    "  a += 0.35 * exp(-pow((uv.y - 0.52 - 0.13 * sin(uv.x * 1.4 - t * 0.17 + 1.7)) * 2.4, 2.0));",
    "  a += 0.22 * exp(-pow((uv.y - 0.72 - 0.08 * sin(uv.x * 3.0 + t * 0.13 + 3.1)) * 4.0, 2.0));",
    "  a *= 0.45 + 0.55 * sin(uv.x * 1.9 + t * 0.11);",
    "  float side = smoothstep(0.08, 0.42, abs(uv.x - 0.52));",
    "  float edge = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x) * smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.78, uv.y);",
    "  return max(a, 0.0) * (0.25 + 0.75 * side) * edge; }",
    "void main() {",
    // the resolve: a small tent over the screen pixel's whole footprint in the supersampled buffer
    "  vec2 o = uOut * 0.42;",
    "  vec3 col = safe(texture2D(tScene, vUv).rgb) * 0.36",
    "    + (safe(texture2D(tScene, vUv + vec2(o.x, o.y)).rgb) + safe(texture2D(tScene, vUv + vec2(-o.x, o.y)).rgb)",
    "     + safe(texture2D(tScene, vUv + vec2(o.x, -o.y)).rgb) + safe(texture2D(tScene, vUv - o).rgb)) * 0.16;",
    "  if (uAurora > 0.001) {",
    "    float a = pow(clamp(aur(vUv, uTime), 0.0, 1.0), uAurGamma) * uAurora;",
    "    float dark = 1.0 - smoothstep(0.004, 0.06, dot(col, vec3(0.2126, 0.7152, 0.0722)));",
    "    col += uAurCol * a * dark; }",
    "  vec3 bloom = texture2D(tB0, vUv).rgb * 0.5 + texture2D(tB1, vUv).rgb * 0.32 + texture2D(tB2, vUv).rgb * 0.22 + texture2D(tB3, vUv).rgb * 0.14;",
    "  col += bloom * uStrength;",
    "  col *= uExposure;",
    "  col = aces(col);",
    // grade, display-referred: saturation held through the shoulder, cool shadows / warm highlights
    "  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));",
    "  col = max(mix(vec3(l), col, uSat), 0.0);",
    "  col *= mix(mix(vec3(1.0), vec3(0.94, 0.985, 1.08), uSplit), vec3(1.0), smoothstep(0.0, 0.22, l)) * mix(vec3(1.0), vec3(1.035, 1.0, 0.955), smoothstep(0.3, 0.95, l) * uSplit);",
    "  col = toSRGB(clamp(col, 0.0, 1.0));",
    // contrast: a gentle S about mid-grey in display space
    "  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);",
    "  vec2 q = vUv - 0.5; col *= 1.0 - uVignette * dot(q, q) * 1.4;",
    "  float n = hash(vUv * vec2(1920.0, 1080.0) + uSeed) - 0.5;",
    "  col += n * (uGrain + 1.5 / 255.0);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"].join("\n");

  function quad(material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const sc = new THREE.Scene(), m = new THREE.Mesh(geo, material); m.frustumCulled = false; sc.add(m);
    return { scene: sc, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material: material };
  }

  L.Composer = function (rend, opt) {
    opt = opt || {};
    // stencil: true keeps a 24-bit depth buffer in r128 (see look.js); no multisampled target (black tile on ANGLE/Metal)
    const rtOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType,
                    encoding: THREE.LinearEncoding, depthBuffer: true, stencilBuffer: true };
    const sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpt);
    // the depth buffer as a texture (24-bit + stencil), for the occlusion and the depth of field
    const newDepth = () => { const t = new THREE.DepthTexture(2, 2); t.format = THREE.DepthStencilFormat; t.type = THREE.UnsignedInt248Type;
      t.minFilter = t.magFilter = THREE.NearestFilter; return t; };
    sceneRT.depthTexture = newDepth();
    const postRT = new THREE.WebGLRenderTarget(2, 2, Object.assign({}, rtOpt, { depthBuffer: false, stencilBuffer: false }));
    const aoRT = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false });
    // the scene sets these per frame (V4 scene.js): occlusion amount and radius (mm), depth of field (focus mm, aperture
    // in px at a 900 px tall frame; 0 = off)
    const post = { ao: 0, aoR: 26, aoInt: 0.9, focus: 300, ap: 0, max: 10, taps: CAP ? 64 : 28 };
    const small = () => new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
                                                            type: THREE.HalfFloatType, encoding: THREE.LinearEncoding, depthBuffer: false, stencilBuffer: false });
    const bright = small();
    const levels = [4, 8, 16, 32].map((div) => ({ d: small(), b: small(), div: div }));
    const brightPass = quad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: opt.threshold === undefined ? 1.0 : opt.threshold }, uKnee: { value: opt.knee === undefined ? 0.55 : opt.knee } },
      vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false }));
    const downPass = quad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uSrc: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT, fragmentShader: DOWN_FRAG, depthTest: false, depthWrite: false }));
    const blurPass = quad(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false }));
    const aoPass = quad(new THREE.ShaderMaterial({ uniforms: { tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uPInv: { value: new THREE.Matrix4() },
      uPS: { value: new THREE.Vector2(1, 1) }, uR: { value: 26 }, uInt: { value: 0.9 }, uBias: { value: 0.002 } },
      vertexShader: QUAD_VERT, fragmentShader: AO_FRAG, depthTest: false, depthWrite: false }));
    const halfOpt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    const preRT = new THREE.WebGLRenderTarget(2, 2, halfOpt), dofRT = new THREE.WebGLRenderTarget(2, 2, halfOpt);
    const cocU = () => ({ uNear: { value: 1 }, uFar: { value: 1000 }, uFocus: { value: 300 }, uAp: { value: 0 }, uMax: { value: 0 } });
    const prepPass = quad(new THREE.ShaderMaterial({ uniforms: Object.assign(cocU(), { tCol: { value: sceneRT.texture }, tDep: { value: null }, tAO: { value: aoRT.texture },
      uSrc: { value: new THREE.Vector2() }, uAOTexel: { value: new THREE.Vector2() }, uAOK: { value: 0 } }),
      vertexShader: QUAD_VERT, fragmentShader: PREP_FRAG, depthTest: false, depthWrite: false }));
    const gatherPass = quad(new THREE.ShaderMaterial({ uniforms: { tPre: { value: preRT.texture }, uTexel: { value: new THREE.Vector2() }, uMax: { value: 0 }, uTaps: { value: 24 } },
      vertexShader: QUAD_VERT, fragmentShader: GATHER_FRAG, depthTest: false, depthWrite: false }));
    const postPass = quad(new THREE.ShaderMaterial({ uniforms: Object.assign(cocU(), { tCol: { value: sceneRT.texture }, tDep: { value: null }, tAO: { value: aoRT.texture },
      tDof: { value: dofRT.texture }, uAOTexel: { value: new THREE.Vector2() }, uDofTexel: { value: new THREE.Vector2() }, uAOK: { value: 0 }, uDof: { value: 0 } }),
      vertexShader: QUAD_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false }));
    const compPass = quad(new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: sceneRT.texture }, tB0: { value: levels[0].d.texture }, tB1: { value: levels[1].d.texture }, tB2: { value: levels[2].d.texture }, tB3: { value: levels[3].d.texture },
        uOut: { value: new THREE.Vector2(1, 1) },
        uStrength: { value: opt.strength === undefined ? 0.62 : opt.strength }, uExposure: { value: opt.exposure === undefined ? 1.0 : opt.exposure },
        uVignette: { value: opt.vignette === undefined ? 0.34 : opt.vignette },
        uGrain: { value: V4Q.grain !== null ? V4Q.grain : (opt.grain === undefined ? 0.01 : opt.grain) }, uSeed: { value: 0 },
        uAurora: { value: 0 }, uAurGamma: { value: 1.0 }, uTime: { value: 0 }, uAurCol: { value: srgb("#ff9a3c") },
        uSat: { value: opt.sat === undefined ? 1.06 : opt.sat }, uContrast: { value: opt.contrast === undefined ? 0.16 : opt.contrast },
        uSplit: { value: opt.split === undefined ? 1.0 : opt.split },
      },
      vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false }));
    // the grain setter keeps the capture mode's override
    if (V4Q.grain !== null) Object.defineProperty(compPass.material.uniforms.uGrain, "value", { get: () => V4Q.grain, set: () => {} });

    let W = 2, H = 2;
    function setSize(w, h, pr) {
      W = Math.max(2, Math.floor(w * pr)); H = Math.max(2, Math.floor(h * pr));
      const ss = Math.max(1.0, Math.min(V4Q.ss, Math.sqrt(V4Q.budget / Math.max(1, W * H))));
      const sw = Math.floor(W * ss), sh = Math.floor(H * ss);
      if (sw !== sceneRT.width || sh !== sceneRT.height) { sceneRT.dispose(); sceneRT.depthTexture.dispose(); sceneRT.depthTexture = newDepth(); }
      sceneRT.setSize(sw, sh); postRT.setSize(sw, sh);
      aoRT.setSize(Math.max(2, sw >> 1), Math.max(2, sh >> 1));
      aoPass.material.uniforms.uTexel.value.set(1 / aoRT.width, 1 / aoRT.height);
      preRT.setSize(Math.max(2, sw >> 1), Math.max(2, sh >> 1)); dofRT.setSize(Math.max(2, sw >> 1), Math.max(2, sh >> 1));
      prepPass.material.uniforms.uSrc.value.set(1 / sw, 1 / sh); gatherPass.material.uniforms.uTexel.value.set(1 / preRT.width, 1 / preRT.height);
      postPass.material.uniforms.uDofTexel.value.set(1 / preRT.width, 1 / preRT.height);
      [prepPass, postPass].forEach((q) => q.material.uniforms.uAOTexel.value.set(1 / aoRT.width, 1 / aoRT.height));
      bright.setSize(Math.max(2, W >> 1), Math.max(2, H >> 1));
      levels.forEach((Lv) => { const lw = Math.max(2, Math.floor(W / Lv.div)), lh = Math.max(2, Math.floor(H / Lv.div)); Lv.d.setSize(lw, lh); Lv.b.setSize(lw, lh); });
      compPass.material.uniforms.uOut.value.set(1 / W, 1 / H);
      brightPass.material.uniforms.uTexel.value.set(1 / bright.width, 1 / bright.height);
    }
    function draw(pass, target) { rend.setRenderTarget(target); rend.render(pass.scene, pass.camera); }
    function render(scene3, camera, seed) {
      const old = rend.getRenderTarget();
      rend.setRenderTarget(sceneRT); rend.clear(true, true, true); rend.render(scene3, camera);
      // occlusion and depth of field: only for a perspective camera on the main scene (the close-up arrives as a quad)
      const persp = !!camera.isPerspectiveCamera, aoK = persp ? post.ao : 0, dofOn = persp && post.ap > 0.05;
      let colTex = sceneRT.texture;
      if (aoK > 0.003 || dofOn) {
        if (aoK > 0.003) {
          const u = aoPass.material.uniforms; u.tDepth.value = sceneRT.depthTexture; u.uPInv.value.copy(camera.projectionMatrixInverse);
          u.uPS.value.set(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]); u.uR.value = post.aoR; u.uInt.value = post.aoInt;
          draw(aoPass, aoRT);
        }
        // circle of confusion in half-buffer px (the gather's units); the frame height sets the scale
        const hs = preRT.height / 900;
        [prepPass, postPass].forEach((q) => { const v = q.material.uniforms; v.tDep.value = sceneRT.depthTexture; v.uAOK.value = aoK; v.uNear.value = camera.near;
          v.uFar.value = camera.far; v.uFocus.value = post.focus; v.uAp.value = dofOn ? post.ap * hs : 0; v.uMax.value = dofOn ? post.max * hs : 0; });
        postPass.material.uniforms.uDof.value = dofOn ? 1 : 0;
        if (dofOn) {
          // the post pass reads coc in half-buffer px: its own depth is full-size, so it halves (POST_FRAG)
          postPass.material.uniforms.uAp.value = post.ap * hs * 2; postPass.material.uniforms.uMax.value = post.max * hs * 2;
          draw(prepPass, preRT);
          const g = gatherPass.material.uniforms; g.uMax.value = post.max * hs; g.uTaps.value = post.taps; draw(gatherPass, dofRT);
        }
        draw(postPass, postRT); colTex = postRT.texture;
      }
      compPass.material.uniforms.tScene.value = colTex;
      brightPass.material.uniforms.tDiffuse.value = sceneRT.texture; draw(brightPass, bright);
      let src = bright;
      levels.forEach((Lv) => {
        downPass.material.uniforms.tDiffuse.value = src.texture; downPass.material.uniforms.uSrc.value.set(1 / src.width, 1 / src.height);
        draw(downPass, Lv.d);
        blurPass.material.uniforms.tDiffuse.value = Lv.d.texture; blurPass.material.uniforms.uDir.value.set(1 / Lv.d.width, 0); draw(blurPass, Lv.b);
        blurPass.material.uniforms.tDiffuse.value = Lv.b.texture; blurPass.material.uniforms.uDir.value.set(0, 1 / Lv.d.height); draw(blurPass, Lv.d);
        src = Lv.d;
      });
      compPass.material.uniforms.uSeed.value = seed || 0;
      rend.setRenderTarget(null); rend.render(compPass.scene, compPass.camera);
      rend.setRenderTarget(old);
    }
    return { setSize: setSize, render: render, sceneRT: sceneRT, uniforms: compPass.material.uniforms, bright: brightPass.material.uniforms, quality: V4Q, post: post };
  };
})();
