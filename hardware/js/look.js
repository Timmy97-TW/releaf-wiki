// Look — the rendering half of the two function stories.
//
// The instrument pages render straight to the canvas with the renderer's own
// tone mapping. That is fine for a part turning on a plinth, but these stories
// are about light: an LED, a beam, a split, a lit well. Without a real bloom
// pass an emissive surface is just a bright patch of plastic, and with the
// renderer's sRGB output there is nowhere for a highlight to be brighter than
// white.
//
// So the scene is rendered into a half-float linear buffer, the highlights are
// separated and blurred at three scales, and one composite pass adds them back,
// tone maps with ACES, encodes to sRGB and dithers. Everything the eye reads as
// "photograph" rather than "viewport" happens in that last pass.
//
// r128 notes that bite here:
//   - no ColorManagement, so every colour goes through RQ.srgb()
//   - MeshPhysicalMaterial has transmission and ior but no thickness or
//     attenuation, so coloured glass is faked with a tint on the surface
//   - WebGLMultisampleRenderTarget exists (WebGL2 only) and is the only way to
//     keep MSAA once we render off screen
window.LOOK = (function () {
  "use strict";

  const srgb = RQ.srgb;

  /* ------------------------------------------------------------------ renderer */
  function renderer(canvas) {
    const r = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,          // MSAA happens in the off-screen target instead
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
      // the offline frame rig screenshots the page after calling renderAt, and
      // without this the buffer it grabs has already been swapped away
      preserveDrawingBuffer: true,
    });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    // The composite pass tone maps and encodes. If the renderer did either as
    // well, the scene buffer would be sRGB-encoded before the bloom saw it and
    // every highlight would bloom off its encoded value, which is not a
    // physical quantity.
    r.outputEncoding = THREE.LinearEncoding;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0x000000, 1);
    return r;
  }

  /* --------------------------------------------------------------- environment */
  // RQ.studioEnv paints softboxes into an equirect canvas and PMREMs it. These
  // stories sit on a near-black stage, so the room is dimmer and cooler than the
  // instrument pages' — the key light does the work, the room only fills.
  function env(rend, opt) {
    opt = opt || {};
    return RQ.studioEnv(rend, { top: opt.top || "#6b7787", floor: opt.floor || "#181c22" });
  }

  /* ----------------------------------------------------------------- materials */
  // Printed parts are measured filament colours; the finish is a thin clearcoat
  // over a matte body, which is what a 0.2 mm FDM surface does to a highlight.
  function printed(hex, rough, opt) {
    opt = opt || {};
    return new THREE.MeshPhysicalMaterial({
      color: srgb(hex),
      roughness: rough === undefined ? 0.62 : rough,
      metalness: 0,
      clearcoat: opt.clearcoat === undefined ? 0.16 : opt.clearcoat,
      clearcoatRoughness: 0.55,
      envMapIntensity: opt.env === undefined ? 1.0 : opt.env,
      side: THREE.FrontSide,
    });
  }

  function glass(hex, opt) {
    opt = opt || {};
    return new THREE.MeshPhysicalMaterial({
      color: srgb(hex || "#eef4f7"),
      roughness: opt.roughness === undefined ? 0.06 : opt.roughness,
      metalness: 0,
      transmission: opt.transmission === undefined ? 0.94 : opt.transmission,
      transparent: true,
      opacity: 1,
      ior: opt.ior || 1.48,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    });
  }

  function metal(hex, rough) {
    return new THREE.MeshStandardMaterial({
      color: srgb(hex), roughness: rough === undefined ? 0.34 : rough,
      metalness: 1, envMapIntensity: 1.2,
    });
  }

  // An emitter's albedo barely matters — what sells it is emissive above 1 so
  // the bloom pass has something to find.
  function emitter(hex, intensity) {
    const m = new THREE.MeshStandardMaterial({
      color: srgb(hex), emissive: srgb(hex),
      emissiveIntensity: intensity === undefined ? 4 : intensity,
      roughness: 0.35, metalness: 0,
    });
    m.toneMapped = true;
    return m;
  }

  // Thin glass — a test tube wall, a cuvette wall. r128's `transmission` is both
  // expensive in bulk and needs a scene re-render; what actually sells thin
  // glass on a dark stage is the Fresnel rim, so that is all this draws:
  // nearly clear face-on, bright at the silhouette, with an environment
  // reflection on top.
  const GLASS_VERT = `
    varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main() {
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = -mv.xyz;
      vW = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * mv;
    }`;
  const GLASS_FRAG = `
    uniform vec3 uTint; uniform float uMin; uniform float uMax; uniform float uPow;
    uniform vec3 uKey; uniform float uSpec;
    varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main() {
      vec3 N = normalize(vN), V = normalize(vV);
      float f = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), uPow);
      float a = mix(uMin, uMax, f);
      // one specular lobe so the wall catches the key the way a tube does
      vec3 L = normalize(uKey);
      float s = pow(max(dot(reflect(-V, N), L), 0.0), 90.0) * uSpec;
      vec3 c = uTint * (0.35 + 0.9 * f) + vec3(s);
      gl_FragColor = vec4(c, clamp(a + s, 0.0, 1.0));
    }`;
  function thinGlass(opt) {
    opt = opt || {};
    return new THREE.ShaderMaterial({
      uniforms: {
        uTint: { value: srgb(opt.tint || "#cfe0ee") },
        uMin: { value: opt.min === undefined ? 0.035 : opt.min },
        uMax: { value: opt.max === undefined ? 0.78 : opt.max },
        uPow: { value: opt.power === undefined ? 2.6 : opt.power },
        uKey: { value: new THREE.Vector3(0.5, 0.75, 0.45).normalize() },
        uSpec: { value: opt.spec === undefined ? 0.9 : opt.spec },
      },
      vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: true,
    });
  }

  /* --------------------------------------------------------------------- beams */
  // A light shaft, drawn as a quad that spins about the beam's own axis to face
  // the camera. The first version was a cone shell whose shader measured the
  // distance from the axis — but every fragment of a shell sits AT the shell
  // radius, so the falloff it computed was a constant and the beam vanished.
  // A camera-facing quad has the radial coordinate the shader actually wants,
  // and from any angle it reads as a round column of light.
  const BEAM_VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const BEAM_FRAG = `
    uniform vec3  uColor;
    uniform float uIntensity;
    uniform float uGrow;      // 0..1 head of the beam, measured from the source
    uniform float uTail;      // 0..1 tail; lets the beam travel rather than appear
    uniform float uEdge;      // radial softness
    uniform float uCore;      // how much brighter the axis is than the body
    uniform float uTaper;     // width at the SOURCE as a fraction of the far end
    varying vec2 vUv;
    void main() {
      float t = vUv.y;                       // 0 at the source, 1 at the far end
      float w = mix(uTaper, 1.0, t);         // narrow at the source, full at the end
      float u = (vUv.x - 0.5) * 2.0 / w;
      float radial = pow(clamp(1.0 - abs(u), 0.0, 1.0), uEdge);
      radial += uCore * pow(clamp(1.0 - abs(u) * 3.2, 0.0, 1.0), 3.0);

      float head = smoothstep(uGrow + 0.02, uGrow - 0.14, t);
      float tail = smoothstep(uTail - 0.10, uTail + 0.04, t);
      float along = mix(1.0, 0.42, t * t);   // inverse-square-ish along the run
      float a = radial * head * tail * along * uIntensity;
      if (a <= 0.0008) discard;
      gl_FragColor = vec4(uColor * a, a);
    }`;

  function beam(opt) {
    opt = opt || {};
    const len = opt.length || 100;
    // `radius` is the half-width of the WIDEST end; `taper` is how narrow the
    // source end is as a fraction of it. The quad is built at the widest width,
    // because the shader can only ever narrow what the geometry gives it.
    const r = opt.radius || 3.2;
    const geo = new THREE.PlaneGeometry(r * 2, len, 1, 24);
    geo.translate(0, len * 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: srgb(opt.color || "#ffb861") },
        uIntensity: { value: opt.intensity === undefined ? 0.5 : opt.intensity },
        uGrow: { value: 1 },
        uTail: { value: 0 },
        uEdge: { value: opt.edge === undefined ? 1.9 : opt.edge },
        uCore: { value: opt.core === undefined ? 0.55 : opt.core },
        uTaper: { value: opt.taper === undefined ? 1.0 : opt.taper },
      },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    mesh.userData.len = len;
    return mesh;
  }

  // Point a beam from a to b (both in the parent's space) and keep its quad
  // turned edge-on to the camera. Call face() after the camera has moved.
  const _ax = new THREE.Vector3(), _to = new THREE.Vector3(), _ri = new THREE.Vector3(),
        _no = new THREE.Vector3(), _mx = new THREE.Matrix4(), _wp = new THREE.Vector3();
  function aim(mesh, a, b) {
    mesh.position.copy(a);
    mesh.userData.a = a.clone(); mesh.userData.b = b.clone();
    mesh.userData.axis = new THREE.Vector3().subVectors(b, a).normalize();
    return mesh;
  }
  function face(mesh, camera) {
    if (!mesh.userData.axis || !mesh.parent) return;
    mesh.parent.updateMatrixWorld();
    _ax.copy(mesh.userData.axis).transformDirection(mesh.parent.matrixWorld).normalize();
    mesh.getWorldPosition(_wp);
    _to.subVectors(camera.position, _wp).normalize();
    _ri.crossVectors(_ax, _to);
    if (_ri.lengthSq() < 1e-8) _ri.set(1, 0, 0); else _ri.normalize();
    _no.crossVectors(_ri, _ax).normalize();
    _mx.makeBasis(_ri, _ax, _no);
    mesh.quaternion.setFromRotationMatrix(_mx);
    // the basis is in world space; undo the parent's rotation
    if (mesh.parent) {
      const pq = new THREE.Quaternion();
      mesh.parent.getWorldQuaternion(pq);
      mesh.quaternion.premultiply(pq.invert());
    }
  }

  // A rim that says "this one, the one the words are about".
  //
  // The usual trick is a scaled copy of the part with its back faces showing,
  // and it falls apart on anything thin: the focusing lens and the sensor dies
  // in these stories are well under a millimetre, and an outline thick enough
  // to see swallows them whole. A fresnel term needs no scaling at all -- it
  // lights the part's own silhouette from the inside, so it hugs whatever shape
  // the part actually is, at any size.
  //
  // The glow is a CHILD of the part, sharing its geometry at identity. That
  // means it inherits the part's matrix and its visibility for free: whatever
  // an act does to a part -- lifts it, spins it, hides it -- the rim goes with
  // it, and there is no per-frame bookkeeping to get wrong.
  function rimGlow(mesh, hex, opt) {
    opt = opt || {};
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: srgb(hex || "#ffffff") },
        uAmt: { value: 0 },
        // 3.6, not 2.6. At the lower exponent a large flat part seen close to
        // edge-on -- the perf board in the assembly act -- passed the fresnel
        // test across its whole face and lit up as a green sheet instead of
        // showing an edge. Tighter, it stays on the silhouette where it belongs.
        uPow: { value: opt.pow === undefined ? 3.6 : opt.pow },
      },
      vertexShader: [
        "varying vec3 vN; varying vec3 vV;",
        "void main() {",
        "  vN = normalize(normalMatrix * normal);",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  vV = normalize(-mv.xyz);",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor; uniform float uAmt, uPow;",
        "varying vec3 vN; varying vec3 vV;",
        "void main() {",
        "  if (uAmt <= 0.001) discard;",
        "  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);",
        "  gl_FragColor = vec4(uColor * f * uAmt, f * uAmt);",
        "}",
      ].join("\n"),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      side: THREE.FrontSide,
    });
    const g = new THREE.Mesh(mesh.geometry, mat);
    g.renderOrder = (mesh.renderOrder || 0) + 30;
    g.castShadow = false; g.receiveShadow = false;
    g.frustumCulled = false;
    mesh.add(g);
    mesh.userData._rim = mat;
    return mat;
  }

  // A technical grid for the bench. Both stories stand their instrument on a
  // dark disc that fades out at the rim, and with nothing on it the frame reads
  // as a render floating in a void rather than a thing standing on a bench.
  //
  // It goes in as an emissive map, not an albedo one: on a near-black floor an
  // albedo grid is invisible until the key happens to fall on it, and the key
  // moves every act. Emissive holds at a fixed, low level wherever the camera
  // goes. The lines are faded by the same radial falloff the disc's alpha
  // already uses, so the grid dies at the rim with the floor instead of ending
  // on a hard circle.
  function benchGrid(opt) {
    opt = opt || {};
    const S = 1024, half = S / 2;
    const cells = opt.cells || 16;              // major divisions across the disc
    const sub = opt.sub || 4;                   // minor lines inside each major
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");

    function lines(count, alpha, width) {
      g.strokeStyle = "rgba(255,255,255," + alpha + ")";
      g.lineWidth = width;
      const step = S / count;
      for (let i = 0; i <= count; i++) {
        const p = Math.round(i * step) + 0.5;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
      }
    }
    lines(cells * sub, opt.minor === undefined ? 0.16 : opt.minor, 1);
    lines(cells, opt.major === undefined ? 0.42 : opt.major, 1.5);

    // Two rings and a centre cross. The disc is round and a square grid alone
    // reads as a floor tile cut to a circle; the rings say bench.
    g.strokeStyle = "rgba(255,255,255," + (opt.ring === undefined ? 0.5 : opt.ring) + ")";
    g.lineWidth = 2;
    [0.22, 0.40].forEach(function (r) {
      g.beginPath(); g.arc(half, half, S * r, 0, 6.2832); g.stroke();
    });

    // Fade everything by the disc's own falloff, then put black behind it so
    // the map is a true emissive: lit lines, black floor.
    g.globalCompositeOperation = "destination-in";
    const fall = g.createRadialGradient(half, half, S * 0.02, half, half, S * 0.485);
    fall.addColorStop(0.00, "rgba(0,0,0,1)");
    fall.addColorStop(0.55, "rgba(0,0,0,.72)");
    fall.addColorStop(1.00, "rgba(0,0,0,0)");
    g.fillStyle = fall; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "destination-over";
    g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "source-over";

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  // Dust in the beam. Without it a shaft reads as a solid object; with it the
  // eye accepts it as air. Motes are a function of a seed, not of a clock, so a
  // captured frame is reproducible.
  function motes(count, box, opt) {
    opt = opt || {};
    const n = count || 240;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * box.x;
      pos[i * 3 + 1] = (Math.random() - 0.5) * box.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * box.z;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: srgb(opt.color || "#ffd9ab") },
        uSize: { value: opt.size || 2.2 },
        uT: { value: 0 },
        uOpacity: { value: opt.opacity === undefined ? 0.5 : opt.opacity },
        uDrift: { value: opt.drift || 6 },
      },
      vertexShader: `
        attribute float aSeed;
        uniform float uSize, uT, uDrift;
        varying float vFade;
        void main() {
          vec3 p = position;
          p.y += sin(uT * 0.35 + aSeed * 6.2831) * uDrift;
          p.x += cos(uT * 0.27 + aSeed * 12.566) * uDrift * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vFade = 0.35 + 0.65 * abs(sin(aSeed * 9.0 + uT * 0.5));
          gl_PointSize = min(uSize * (300.0 / max(-mv.z, 1.0)), uSize * 4.0) * (0.6 + aSeed * 0.8);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vFade;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(d)) * uOpacity * vFade;
          if (a <= 0.002) discard;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    });
    return new THREE.Points(geo, mat);
  }

  /* ------------------------------------------------------------------- compose */
  const QUAD_VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const BRIGHT_FRAG = `
    uniform sampler2D tDiffuse; uniform float uThreshold, uKnee;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // soft knee so a highlight enters the bloom gradually instead of popping
      float k = clamp((l - uThreshold + uKnee) / max(2.0 * uKnee, 1e-4), 0.0, 1.0);
      k = k * k * (l > uThreshold - uKnee ? 1.0 : 0.0);
      gl_FragColor = vec4(c * k, 1.0);
    }`;

  const BLUR_FRAG = `
    uniform sampler2D tDiffuse; uniform vec2 uDir;
    varying vec2 vUv;
    void main() {
      // 9-tap gaussian, sigma ~2.2
      float w[5];
      w[0] = 0.2270; w[1] = 0.1946; w[2] = 0.1216; w[3] = 0.0540; w[4] = 0.0162;
      vec3 c = texture2D(tDiffuse, vUv).rgb * w[0];
      for (int i = 1; i < 5; i++) {
        vec2 o = uDir * float(i);
        c += texture2D(tDiffuse, vUv + o).rgb * w[i];
        c += texture2D(tDiffuse, vUv - o).rgb * w[i];
      }
      gl_FragColor = vec4(c, 1.0);
    }`;

  const COMPOSITE_FRAG = `
    uniform sampler2D tScene, tB0, tB1, tB2;
    uniform float uStrength, uExposure, uVignette, uGrain, uSeed;
    uniform float uAurora, uTime, uAurGamma;
    uniform vec3 uAurCol;
    varying vec2 vUv;

    // ACES filmic, Narkowicz fit — the same curve the renderer's
    // ACESFilmicToneMapping applies, done here because tone mapping has to
    // happen after the bloom is added, not before.
    vec3 aces(vec3 x) {
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
                 step(vec3(0.0031308), c));
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    // A slow aurora behind the subject. It is added before tone mapping, so it
    // behaves like light in the room rather than a graphic pasted on top, and
    // it is masked to where the frame is dark so it never sits over the model.
    float aur(vec2 uv, float t) {
      float a = 0.0;
      a += 0.55 * exp(-pow((uv.y - 0.30 - 0.10 * sin(uv.x * 2.1 + t * 0.21)) * 3.1, 2.0));
      a += 0.35 * exp(-pow((uv.y - 0.52 - 0.13 * sin(uv.x * 1.4 - t * 0.17 + 1.7)) * 2.4, 2.0));
      a += 0.22 * exp(-pow((uv.y - 0.72 - 0.08 * sin(uv.x * 3.0 + t * 0.13 + 3.1)) * 4.0, 2.0));
      a *= 0.45 + 0.55 * sin(uv.x * 1.9 + t * 0.11);
      // hold it away from the middle of the frame, where the subject lives, and
      // fade it at every edge so it never reads as a band
      float side = smoothstep(0.08, 0.42, abs(uv.x - 0.52));
      float edge = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x)
                 * smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.78, uv.y);
      return max(a, 0.0) * (0.25 + 0.75 * side) * edge;
    }

    void main() {
      vec3 col = texture2D(tScene, vUv).rgb;
      if (uAurora > 0.001) {
        // uAurGamma > 1 pulls the glow into its bright bands and lets the frame
        // between them stay black; at 1 (the default) it is the old broad wash.
        float a = pow(clamp(aur(vUv, uTime), 0.0, 1.0), uAurGamma) * uAurora;
        float dark = 1.0 - smoothstep(0.004, 0.06, dot(col, vec3(0.2126, 0.7152, 0.0722)));
        col += uAurCol * a * dark;
      }
      vec3 bloom = texture2D(tB0, vUv).rgb * 0.55
                 + texture2D(tB1, vUv).rgb * 0.33
                 + texture2D(tB2, vUv).rgb * 0.22;
      col += bloom * uStrength;
      col *= uExposure;
      col = aces(col);
      col = toSRGB(col);

      // a lens, not a poster: corners fall off a little
      vec2 q = vUv - 0.5;
      col *= 1.0 - uVignette * dot(q, q) * 1.4;

      // grain and dither. The stage is near black over most of its area and 8-bit
      // banding is plainly visible there; a little noise is cheaper than a wider
      // buffer and reads as film.
      float n = hash(vUv * vec2(1920.0, 1080.0) + uSeed) - 0.5;
      col += n * (uGrain + 1.5 / 255.0);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function quad(material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      -1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sc = new THREE.Scene();
    sc.add(new THREE.Mesh(geo, material));
    return { scene: sc, camera: cam, material: material };
  }

  function Composer(rend, opt) {
    opt = opt || {};
    const gl2 = rend.capabilities.isWebGL2;
    const rtOpt = {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      // stencilBuffer TRUE, deliberately: in r128 a render target with depth
      // but no stencil gets a 16-bit depth renderbuffer, and with stencil it
      // gets DEPTH24_STENCIL8. Measured on DiOPAL's wide shots (near 0.5, a
      // metre away): 16 bits is a ~30 mm depth quantum, and a tube 30 mm
      // behind a solid wall drew straight through it.
      encoding: THREE.LinearEncoding, depthBuffer: true, stencilBuffer: true,
    };
    // No multisampled target. On this machine (ANGLE/Metal) a
    // WebGLMultisampleRenderTarget resolved with a pure black square — a whole
    // tile — sitting over the middle of the frame, reproducible across p values
    // and gone the moment the plain target was used. Anti-aliasing comes from
    // supersampling instead: the scene is rendered above display resolution and
    // the composite samples it back down, which costs fill rate but no tiles.
    const SS = opt.ss === undefined ? 1.5 : opt.ss;
    const sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpt);

    const small = function () {
      return new THREE.WebGLRenderTarget(2, 2, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType,
        encoding: THREE.LinearEncoding, depthBuffer: false, stencilBuffer: false,
      });
    };
    const bright = small();
    // The bloom chain starts at a quarter, not a half. Bloom is blurry by
    // definition and nothing in it survives at full resolution, but at half it
    // was a third of the frame's fill cost on the acts where the camera is
    // inside the instrument.
    const levels = [
      { a: small(), b: small(), div: 4 },
      { a: small(), b: small(), div: 8 },
      { a: small(), b: small(), div: 16 },
    ];

    const brightPass = quad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: opt.threshold === undefined ? 1.0 : opt.threshold },
                  uKnee: { value: opt.knee === undefined ? 0.55 : opt.knee } },
      vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false,
    }));
    const blurPass = quad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
    }));
    const compPass = quad(new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: sceneRT.texture }, tB0: { value: levels[0].a.texture },
        tB1: { value: levels[1].a.texture }, tB2: { value: levels[2].a.texture },
        uStrength: { value: opt.strength === undefined ? 0.62 : opt.strength },
        uExposure: { value: opt.exposure === undefined ? 1.0 : opt.exposure },
        uVignette: { value: opt.vignette === undefined ? 0.34 : opt.vignette },
        uGrain: { value: opt.grain === undefined ? 0.010 : opt.grain },
        uSeed: { value: 0 },
        uAurora: { value: 0 },
        uAurGamma: { value: 1.0 },
        uTime: { value: 0 },
        uAurCol: { value: srgb("#ff9a3c") },
      },
      vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false,
    }));

    let W = 2, H = 2;
    function setSize(w, h, pr) {
      W = Math.max(2, Math.floor(w * pr)); H = Math.max(2, Math.floor(h * pr));
      // Supersampling is capped by a pixel budget rather than being a fixed
      // multiplier: at 1440x900 with a 1.75 device ratio, a flat 1.5x asks for
      // 8.5 M shaded pixels and the transparent acts fell to 20 fps. A phone
      // stays at the full 1.5x because its buffer is small.
      // 5.6M, not 3.2M. At a 1994x1301 window the old budget gave a 1.11x
      // supersample — barely more than none, and the bore edges in DiOPAL's
      // close-ups came out visibly stepped. Measured after: still 16.7 ms.
      const budget = 5.6e6;
      const ss = Math.max(1.0, Math.min(SS, Math.sqrt(budget / Math.max(1, W * H))));
      sceneRT.setSize(Math.floor(W * ss), Math.floor(H * ss));
      bright.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2));
      levels.forEach(function (L) {
        const lw = Math.max(2, Math.floor(W / L.div)), lh = Math.max(2, Math.floor(H / L.div));
        L.a.setSize(lw, lh); L.b.setSize(lw, lh);
      });
    }

    function drawQuad(pass, target) {
      rend.setRenderTarget(target);
      rend.render(pass.scene, pass.camera);
    }

    function render(scene3, camera, seed) {
      const old = rend.getRenderTarget();
      rend.setRenderTarget(sceneRT);
      rend.clear(true, true, true);
      rend.render(scene3, camera);

      brightPass.material.uniforms.tDiffuse.value = sceneRT.texture;
      drawQuad(brightPass, bright);

      let src = bright;
      levels.forEach(function (L) {
        const lw = L.a.width, lh = L.a.height;
        blurPass.material.uniforms.tDiffuse.value = src.texture;
        blurPass.material.uniforms.uDir.value.set(1.4 / lw, 0);
        drawQuad(blurPass, L.b);
        blurPass.material.uniforms.tDiffuse.value = L.b.texture;
        blurPass.material.uniforms.uDir.value.set(0, 1.4 / lh);
        drawQuad(blurPass, L.a);
        src = L.a;
      });

      compPass.material.uniforms.uSeed.value = seed || 0;
      rend.setRenderTarget(null);
      rend.render(compPass.scene, compPass.camera);
      rend.setRenderTarget(old);
    }

    return {
      setSize: setSize, render: render,
      sceneRT: sceneRT,   // dev: the frame rig shrinks it to test tile drops
      uniforms: compPass.material.uniforms,
      bright: brightPass.material.uniforms,
    };
  }

  return {
    renderer: renderer, env: env, Composer: Composer,
    printed: printed, glass: glass, thinGlass: thinGlass, metal: metal, emitter: emitter,
    beam: beam, aim: aim, face: face, motes: motes, srgb: srgb,
    benchGrid: benchGrid, rimGlow: rimGlow,
  };
})();
