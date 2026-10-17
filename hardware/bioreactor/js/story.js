// V4 "Follow the culture", rebuilt (9 Oct 2026), round 2. The binding storyboard is v4/STORYBOARD.md and the round-1
// decisions are in dev/night-logs/2026-10-09-v4/r1/COORDINATOR.md. In short:
//   one thing to watch (the culture parcel, held on screen, and leading the camera into the fibre); the case leaves
//   once, whole, and after that no part ever disappears (focus is by light); tubes never end in mid-air; the loop draws
//   itself: culture tubes ahead of the parcel are neutral, behind it amber, and one pulse runs round when the ring
//   closes; a smoothed, deterministic chase camera with three long behind-the-parcel runs; stations as pauses; the dive
//   into one fibre's wall, matched pore for pore, as the one scale jump; the case flies back on at the end.
//
// The camera is a pure function of p: at load (and on resize) the raw camera (chase rig + station shots) is sampled
// densely in p, low-pass filtered forward and backward (zero phase), and stored; a frame interpolates the samples.
// The aim is stored relative to the parcel, so the parcel stays put on screen while the camera itself is smoothed.
(function () {
  "use strict";
  const { sat, ss, lerp, band } = B2;
  // polish pass (9-10 Oct): everything the camera reads blends C2 (no acceleration jump at a blend's ends, so no jerk
  // spike where a rig or station weight starts or stops). qs is a smoothed linear ramp (trap below, r .34): C2 like the
  // quintic, but its peak rate is 1.5x the mean (the quintic's is 1.9x, which made every blend's middle faster)
  const quint = (t) => { t = sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const qs = (a, b, x) => trap((x - a) / (b - a), 0.34);
  const qband = (p, a, b, c, d) => qs(a, b, p) * (1 - qs(c, d, p));
  const V3 = THREE.Vector3;
  const AMBER = "#ff9a2e", GREEN = "#2ef09a";

  // ---- switches
  const KEEP_POSTS = false;                 // true: the four corner posts (case:PIPE_VERTICAL) stay, as "stands"
  const ROUTE_UI = true;                    // the route list with its progress dot, and the "-> next stop" label
  const KEY_END_ONLY = true;
  const DOF_MACRO = 0;                      // round 4b: depth of field in the macro scene (1: the polish pass's; beaded tubes)                // round 4b (visual 9, QA 7): the honesty line shows only at the end
  const KEEP = { "case:Part 1.006": 1 };    // the perforated shelf the bottles stand on
  if (KEEP_POSTS) KEEP["case:PIPE_VERTICAL"] = 1;
  const SHADOW = 0.6;                       // a part at rest: fade 0.6 = colour x ~0.2, opaque (never see-through)
  // ---- focus (owner, 10 Oct ~11:35: "everything but the parts we are focusing on SLIGHTLY dims so that it focuses on
  // that part instead, don't make it too weird tho, and not too obvious"). A version behind a switch: FOCUS_DIM is the
  // default, ?focus=1 / ?focus=0 overrides it (capture mode and the clip hooks read the same URL). Everything outside the
  // moment's focus set is drawn a little darker and a little less saturated: its final colour (light, specular, glass
  // rims, glow, all of it) x FOC_K in linear light, saturation x FOC_SAT. Never transparent, never hidden (rule 2).
  // The focus set (FOC_SETS, story time q): the station's parts, the parts a visible label points at, and the parcel's
  // own tube run near it (a soft gradient along the route, FOC_R). Wide shots dim nothing (focGate). Every weight is a
  // pure function of q with ramps of >= .02 q.
  const FOCUS_DIM = false;                  // (E0, owner 14:20: off for the final; the ?focus=1 code stays)
  const FLOW_K = 260;                       // E4: the flow packets' clock is the story time (x 260 s): scroll-driven only
  const FOCUS_ON = (() => { try { const v = new URLSearchParams(location.search).get("focus"); return v === null ? FOCUS_DIM : v === "1"; } catch (e) { return FOCUS_DIM; } })();
  // FOC_D: the display brightness of a part at rest, as a fraction of its lit self (after the composite's ACES and sRGB:
  // the shader inverts the tone curve, so bright glints and the amber trail dim as much as the dark plastics do);
  // FOC_SAT: its saturation
  const FOC_D = 0.8, FOC_SAT = 0.84;
  const FOC_R = [50, 330];                  // along the route (mm): full light within R0 of the parcel, at rest past R1

  // ---- the timeline (p). Story 2900vh. (3200vh was tried for pace: +10.7 % scroll moved the image-change median only
  // 18.9 -> 18.3 per 50 px; the measure is set by how busy the chase's frames are, not by its speed.)
  const STRIP = [0.012, 0.09], BACKON = [0.846, 0.918];
  const MICRO = [0.548, 0.645];             // the wall close-up (its own scene; matched hand-offs at both ends)
  // calm camera (rule 7, 9 Oct night): the dive enters from the home side. The one fibre is now in the bundle's outer
  // layer on the open (-x) side, and the camera pushes along +x into it (it was the +x side: a 160 deg swing round)
  // (22:55, the owner: "you still havent brought back the back view after the photometer, I liked that": the camera
  // stays on the far side after the photometer, follows the parcel down c3 from behind, and dives from +x as in a4)
  const DS = 1;                             // the side the camera dives from: +1 = +x (the far side), -1 = -x (open)
  const AX = [5, -144.5], FIBX = AX[0] + DS * 22;   // the one fibre: outer layer of the bundle, on the camera's side
  const FZ = 340;                           // where the camera meets it (between the two clamp straps)
  const FR = 1.6;                           // its radius (illustrative)
  const WALLX = FIBX - DS * FR;             // its far inner wall, seen from the camera's side
  const PARX = WALLX + DS * 0.16;           // the parcel climbs the fibre close to that wall
  const CAMW = 0.55, CAMWP = 0.77;          // the camera's distance from that wall at the hand-off (mm; portrait 1.4x)
  const H0 = 900;                           // the same distance in the close-up's units (100 = 1 um): sets the scale

  // ---- the holds (round 4, decision A): still camera bands in story time, and the still scroll each must get (px).
  // [q0, q1, px]. The camera is exactly still between q0 + .012 and q1 - .012 (no smoothing there: taper), and the warp
  // gives that interior at least px of scroll (buildWarp). The captions sit in them (CAPS below).
  // (round 4b: + the c3 back view as a hold, q .41-.472: the owner's composition frozen, the parcel crosses it)
  const HOLDS = [[0, 0.07, 950], [0.115, 0.152, 1250], [0.196, 0.29, 1250], [0.338, 0.388, 1550], [0.462, 0.51, 1400],   // (owner 10 Oct: the c3 hold is gone; the valve ⑤ demo holds)
                 [0.75, 0.85, 2900], [0.902, 1, 1300]];   // (round 4b: the machine's two captions share one hold, so the
                                                          // light's hand-off between them gets scroll too)
  // round 4b: windows that need scroll although the camera moves in them (px each): the "Into one fibre" caption
  // (on the line-up and push), and the move to the end, where the light and the case's return change (the light
  // jumped there when the move got only its motion's share)
  const MINPX = [[0.517, 0.536, 780], [0.85, 0.905, 900]];
  // the wall's section view (the close-up's own camera holds still over kM .3-.7: q .5771-.6158)
  const WALL_HOLD = [0.5771, 0.6158, 1250];
  const CAPS = [
    // (round 4: each caption's window is its hold, so it reads at full opacity on a still camera)
    { n: "<b>01</b>", role: "Grows it", name: "Culture vessel", body: "<b>300&nbsp;mL</b> of <i>B.&nbsp;subtilis</i>, stirred at <b>200&nbsp;rpm</b>.", win: [0.111, 0.156] },
    { n: "<b>02</b>", role: "Moves it", name: "Culture pump", body: "Rollers squeeze the tube. The culture never touches the pump.", win: [0.192, 0.294] },
    { n: "<b>03</b>", role: "Reads it", name: "Photometer", body: "Light through the line: the more cells, the less gets through. No sample taken.", win: [0.331, 0.392] },
    { n: "<b>04</b>", role: "Holds it", name: "Into one fibre", body: "The culture runs inside hollow fibres. Their walls have <b>0.2&nbsp;&micro;m</b> pores.", win: [0.506, 0.547] },
    { n: "<b>04</b>", role: "Holds it", name: "The wall", body: "<span class=\"lu\">Cells</span> stay in. <span class=\"sh\">Protectant</span> crosses.", win: [0.5731, 0.6198] },
    { n: "<b>05</b>", role: "Returns it", name: "One closed loop", body: "Back to the vessel, and round again.", win: [0.746, 0.8095] },
    { n: "<b>06</b>", loop: "g", role: "The harvest", name: "Protectant out", body: "<span class=\"sh\">Protectant</span> takes its own line out, to the field.", win: [0.8065, 0.854] },
  ];

  // trapezoid speed profile: accelerate over r, cruise, decelerate over r (a steady chase, not a smoothstep surge). Polish
  // pass: the speed ramps are smoothsteps, not straight lines, so the parcel's acceleration is continuous (C2 position):
  // the old linear ramps put a jerk spike at every start, stop and cruise, and the camera aims at the parcel
  function trap(t, r) {
    t = sat(t); const v = 1 / (1 - r);
    const I = (u) => u * u * u - 0.5 * u * u * u * u;          // integral of smoothstep, 0..1/2
    if (t < r) return v * r * I(t / r);
    if (t > 1 - r) return 1 - v * r * I((1 - t) / r);
    return 0.5 * v * r + v * (t - r);
  }
  function keyed(K, p) {
    if (p <= K[0][0]) return K[0][1];
    for (let i = 0; i < K.length - 1; i++) {
      const a = K[i], b = K[i + 1];
      if (p <= b[0]) return lerp(a[1], b[1], trap((p - a[0]) / (b[0] - a[0]), b[2] === undefined ? 0.24 : b[2]));
    }
    return K[K.length - 1][1];
  }
  function interp(K, s) {        // piecewise-linear table [[s, v], ...]
    if (s <= K[0][0]) return K[0][1];
    for (let i = 0; i < K.length - 1; i++) if (s <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], (s - K[i][0]) / Math.max(1e-6, K[i + 1][0] - K[i][0]));
    return K[K.length - 1][1];
  }

  // ---- a route: named point lists joined by straight runs, resampled every ~2 mm, with two smoothed copies:
  // sigma 30 mm (the follow direction) and sigma 100 mm (the camera's own glide path, so corners never swing it)
  function Route(named) {
    const P = [], S = [], marks = {};
    named.forEach(([nm, pts]) => {
      pts.forEach((q, i) => {
        if (P.length) {
          const d = P[P.length - 1].distanceTo(q);
          if (d < 0.01) { if (i === 0) marks[nm] = S[S.length - 1]; return; }
          S.push(S[S.length - 1] + d);
        } else S.push(0);
        P.push(q.clone());
        if (i === 0) marks[nm] = S[S.length - 1];
      });
      marks[nm + ">"] = S[S.length - 1];
    });
    const L = S[S.length - 1], N = Math.ceil(L / 2) + 1, U = [];
    let j = 0;
    for (let k = 0; k < N; k++) {
      const s = Math.min(L, k * L / (N - 1));
      while (j < S.length - 2 && S[j + 1] < s) j++;
      U.push(P[j].clone().lerp(P[j + 1], sat((s - S[j]) / Math.max(1e-9, S[j + 1] - S[j]))));
    }
    const ds = L / (N - 1);
    const smooth = (sigmm) => {
      const sig = sigmm / ds, R = Math.ceil(sig * 3), Wt = [];
      for (let i = -R; i <= R; i++) Wt.push(Math.exp(-0.5 * (i / sig) * (i / sig)));
      return U.map((_, k) => {
        const o = new V3(); let w = 0;
        for (let i = -R; i <= R; i++) { const ww = Wt[i + R]; o.addScaledVector(U[Math.max(0, Math.min(N - 1, k + i))], ww); w += ww; }
        return o.multiplyScalar(1 / w);
      });
    };
    const tangents = (A) => A.map((_, k) => A[Math.min(N - 1, k + 2)].clone().sub(A[Math.max(0, k - 2)]).normalize());
    const Sm = smooth(30), Tg = tangents(Sm), Sc = smooth(100), Tc = tangents(Sc);
    // the horizontal heading (sigma 150 mm): "behind" for the follow runs, level even where the tube climbs or drops
    const Hraw = Tc.map((t) => new V3(t.x, t.y, 0));
    const sigH = 150 / ds, RH = Math.ceil(sigH * 3), WH = [];
    for (let i = -RH; i <= RH; i++) WH.push(Math.exp(-0.5 * (i / sigH) * (i / sigH)));
    const Hd = Hraw.map((_, k) => { const o = new V3(); for (let i = -RH; i <= RH; i++) o.addScaledVector(Hraw[Math.max(0, Math.min(N - 1, k + i))], WH[i + RH]); return o.lengthSq() > 1e-8 ? o.normalize() : new V3(1, 0, 0); });
    const idx = (s) => { const f = sat(s / L) * (N - 1); const i = Math.min(N - 2, Math.floor(f)); return [i, f - i]; };
    return {
      L: L, marks: marks, U: U,
      at: (s, o) => { const [i, f] = idx(s); return (o || new V3()).copy(U[i]).lerp(U[i + 1], f); },
      tan: (s, o) => { const [i, f] = idx(s); return (o || new V3()).copy(Tg[i]).lerp(Tg[i + 1], f).normalize(); },
      smc: (s, o) => { const [i, f] = idx(s); return (o || new V3()).copy(Sc[i]).lerp(Sc[i + 1], f); },
      tanc: (s, o) => { const [i, f] = idx(s); return (o || new V3()).copy(Tc[i]).lerp(Tc[i + 1], f).normalize(); },
      head: (s, o) => { const [i, f] = idx(s); return (o || new V3()).copy(Hd[i]).lerp(Hd[i + 1], f).normalize(); },
    };
  }

  let RC = null, RG = null, KC = null, KG = null, STUB = null;
  // ---- servo valve 5 (owner, 10 Oct): its handle, the servo's coupler and horn turn about x through the plug's axis
  // (measured: the stem and the horn centred on y -144.5, z 174.85); the demo's timing in story time
  const V5_AX = new V3(0, -144.5, 174.85), V5_IN = 6;
  const SMALL_PUMPS = [["pump_k", 61.01, 483.7, 1], ["pump_p", 61.0, 372.7, -1]];
  const v5Turn = (q) => (Math.PI / 2) * (qs(0.476, 0.482, q) - qs(0.494, 0.499, q));
  const v5Fill = (q) => qs(0.481, 0.486, q) * (1 - qs(0.5, 0.505, q));          // the link down to stopcock 1
  const v5Out = (q) => qs(0.485, 0.493, q) * (1 - qs(0.496, 0.502, q));         // out along s1 / l1 a little, then back
  const v5Demo = (q) => qband(q, 0.47, 0.476, 0.5, 0.505);
  const sCul = (p) => keyed(KC, p), sGrn = (p) => keyed(KG, p);
  // the pump head: the tube's track round the rotor (y, z), and its radius. Round 4b (the owner, 23:10: "this is off
  // center"): the hub is the circumcentre of the three roller centres (4.15, 431.36), (-24.66, 412.11), (-26.92, 446.68),
  // all at 20.01 from it; the vertex mean agrees, and the pump box's housing ring (inner radius 32.96, fitted) is centred
  // 0.14 mm from it. The track: the rollers reach 31.0 (20.0 + their own radius 11.0) and the housing's bore is at
  // 32.96, so a track at reach + the tube's half-thickness (33.6, the owner's note) puts the tube's centre inside the
  // housing wall, hidden behind its lip. The tube rests on the bore instead (outer face 32.96, centre 30.4), and each
  // roller presses it flat against the bore (shader below: 38 % thickness, between 31.0 and 32.96): a visible pinch
  const ROT_C = [-15.81, 430.05], ROT_REACH = 31.0, ROT_BORE = 32.96, TUBE_R = 2.6, ROT_R = ROT_BORE - TUBE_R;
  // per-part axis overrides: b2-core pivots every part at its bounding-box centre, which for the 3-armed rotor is
  // (-11.38, 429.40), 4.5 mm off its axis (x stays: the rotor turns about x)
  const AXIS = { rotor: [null, ROT_C[0], ROT_C[1]] };

  function buildRoutes(c) {
    const T = c.model.tubes, tp = (id) => T[id].curve.p.map((q) => q.clone()), v = (x, y, z) => new V3(x, y, z);
    // the pump head: the tube runs round the rotor's lower half, pressed by its rollers (x -53.8, the rotor's plane)
    const circ = [];
    for (let i = 0; i <= 36; i++) { const a = Math.PI * (1 + i / 36); circ.push(v(-53.8, ROT_C[0] + ROT_R * Math.cos(a), ROT_C[1] + ROT_R * Math.sin(a))); }
    // the lumen: from the bottom header into the one fibre, up it close to its far wall, out to the top header
    const lumen = [v(AX[0], AX[1], 238), v(PARX, AX[1], 250), v(PARX, AX[1], 434), v(AX[0], AX[1], 444)];
    RC = Route([
      ["dip", [v(-46, 47, 166), v(-46, 47, 300)]], ["c1", tp("c1")],
      ["arcIn", [v(-53.8, -36, 466)]], ["arc", circ], ["arcOut", [v(-53.8, 4, 466)]], ["c2", tp("c2")],
      ["cell", [v(-36, 112, 335)]], ["c3", tp("c3")], ["v5", [v(5, -132, 182), v(5, -144.5, 200)]], ["c4", tp("c4")],
      ["lumen", lumen], ["c5", tp("c5")], ["v7", [v(5, -144.5, 492), v(5, -128, 503)]], ["c6", tp("c6")], ["ret", [v(-46, 33, 250)]],
    ]);
    // the green way out, and an illustrative stub on out of the output connector, past the edge of the frame
    STUB = outletPath(c);                     // (C2: out of the bulkhead, down the end panel to the floor; was a line into the air)
    RG = Route([
      // (D3: the parcel's route ends where the low line starts to fall, outside the fitting; the line draws on ahead of it
      // and the field's line carries the green on: on the soil the parcel sat on the hold frame's bottom edge)
      ["port", [v(5, -128, 431)]], ["p4", tp("p4")], ["p5", tp("p5")], ["bottle", [v(-46, -68, 236)]], ["o1", tp("o1")], ["stub", STUB.slice(1, Math.max(2, STUB.findIndex((q) => q.y < -228)))],
    ]);
    const m = RC.marks, g = RG.marks;
    const sFib = m.lumen + Math.hypot(PARX - AX[0], 12) + (FZ - 250);      // the parcel at the fibre's middle (FZ)
    const sTop = m.lumen + Math.hypot(PARX - AX[0], 12) + (434 - 250);     // and at its top
    KC = [
      [0, 0], [0.122, 0],                       // waiting at the dip tube's foot (a slow pulse from p .02)
      [0.232, m.arc + 2, 0.3],                  // up the dip tube and c1 to the pump head
      [0.27, m["arc>"] - 2, 0.5],               // round the rotor, pushed by a roller (the station)
      [0.342, m.cell - 4, 0.26],                // c2 to the V4's cell (a behind run on its top and down into the V4)
      [0.384, m.cell + 4, 0.5],                 // through the cell, read
      // (owner, 10 Oct: no waiting before the membrane; a demo of servo valve 5 on the way)
      [0.468, m.v5 + V5_IN, 0.22],              // c3 (a run along the shelf) into valve 5
      [0.504, m.v5 + V5_IN],                    // held in the valve while it switches to the sampler and back
      [0.53, sFib, 0.35],                      // up c4 into the one fibre, to its middle: the camera rises with it
      [0.672, sFib, 0.5],                       // held exactly there (the camera aims at it; 0.1 mm is most of the frame here)
      [0.688, sTop, 0.35],                      // up the fibre and out of its top (the camera follows it up)
      [0.738, m["c6>"], 0.2],                   // c5, valve 7, c6 back to the vessel, followed home: the ring closes
      [1, m["c6>"]],
    ];
    KG = [[0, 0], [0.807, 0], [0.848, g["stub>"], 0.18], [1, g["stub>"]]];   // (owner 10 Oct: after the membrane's green glow)      // (round 4: after the pulse)
    return { sFib: sFib, sTop: sTop };
  }
  // ---- camera poses: {pos, tgt, fov, ox, oy, roll}
  function shotPose(c, shot, asp) {
    const s = c.shotFor(shot, asp), y = s.yaw * Math.PI / 180, pz = s.pitch * Math.PI / 180;
    return { pos: new V3(s.t[0] + s.d * Math.cos(pz) * Math.cos(y), s.t[1] + s.d * Math.cos(pz) * Math.sin(y), s.t[2] + s.d * Math.sin(pz)),
             tgt: new V3(s.t[0], s.t[1], s.t[2]), fov: s.fov, ox: s.ox || 0, oy: s.oy || 0, roll: 0 };
  }
  function mix(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    return { pos: a.pos.clone().lerp(b.pos, t), tgt: a.tgt.clone().lerp(b.tgt, t), fov: lerp(a.fov, b.fov, t), ox: lerp(a.ox, b.ox, t), oy: lerp(a.oy, b.oy, t), roll: lerp(a.roll, b.roll, t) };
  }
  // a blend that orbits: azimuth, elevation and distance about C are interpolated, out first and round second, and
  // lifted over the top at mid-orbit (a crane over the machine, never a dolly through it or past the column's backplate)
  function orbitMix(a, b, t, C, tt, lift) {
    if (t <= 0) return a; if (t >= 1) return b;
    const tA = tt === undefined ? t : tt;                // the aim's own progress (it may lead the orbit)
    const da = a.pos.clone().sub(C), db = b.pos.clone().sub(C), ra = da.length(), rb = db.length();
    const aa = Math.atan2(da.y, da.x), ab = Math.atan2(db.y, db.x);
    let d = ab - aa; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const tr = 1 - (1 - t) * (1 - t), ta = t * t * (3 - 2 * t);
    const ea = Math.asin(da.z / ra), eb = Math.asin(db.z / rb), az = aa + d * ta, el = lerp(ea, eb, t) + (lift || 0) * Math.sin(Math.PI * t), r = Math.exp(lerp(Math.log(ra), Math.log(rb), tr));
    return { pos: new V3(C.x + r * Math.cos(el) * Math.cos(az), C.y + r * Math.cos(el) * Math.sin(az), C.z + r * Math.sin(el)),
             tgt: a.tgt.clone().lerp(b.tgt, tA), fov: lerp(a.fov, b.fov, t), ox: lerp(a.ox, b.ox, t), oy: lerp(a.oy, b.oy, t), roll: lerp(a.roll, b.roll, t) };
  }
  const OPEN = { t: [-10, -12, 372], yaw: -158, pitch: 15, fit: 345, fill: 0.86, ox: 0.22, oy: 0.03, fov: 30, p: { fit: 345, fill: 0.98, ox: 0, oy: 0.24 } };
  const RING_C = new V3(-20, -18, 345);
  // ---- the holds (rule 7 as revised by the owner, 22:25-22:30: "I still want the camera to rotate to back view for the
  // part ... the shell side following the camera moves too much when its still the same area" and "if the camera only
  // moves a little bit right now, just don't make it move, doesn't exactly need to follow"). The camera is a short
  // list of static framings, one per area of the machine; the parcel moves across each frame and the camera moves only
  // when the parcel leaves the area, in one calm C2 move. The two big moves are the rotation round to the photometer's
  // back view (the owner wants it) and the rotation back to the open side for the dive.
  const SHOTS = {
    // the vessel: the parcel gathers at the dip tube's foot and climbs out of the lid
    ves: { t: [-42, 42, 228], yaw: -168, pitch: 12, fit: 108, fill: 0.9, ox: 0.24, fov: 32, p: { fill: 1.0, ox: 0, oy: 0.2 } },
    // the pump area: c1's climb up the open side, the head, and c2's start (one framing for all of it)
    pump: { t: [-62, -12, 440], yaw: -174, pitch: 8, fit: 118, fill: 0.9, ox: 0.24, fov: 32, p: { fill: 1.0, ox: 0, oy: 0.16 } },
    // the photometer from its back end, cut along its light path (the owner's back view)
    // (round 4b, visual 2: pushed in 1.6x on the flow cell, which sits at ~45 % of the frame's height; still the back view)
    v4w: { t: [-34, 112, 418], yaw: 92, pitch: 6, fit: 118, fill: 0.9, ox: 0.24, fov: 32, p: { fill: 1.0, ox: 0, oy: 0.2 } },
    // (round 4b, visual 2: then a push in, 1.6x on desk and 1.25x on phone, onto the flow cell, which sits at ~45 % of the
    // frame's height; the same back view, so the push is straight in with a small tilt down)
    v4: { t: [-36, 112, 335], yaw: 92, pitch: 6, fit: 74, fill: 0.9, ox: 0.24, oy: 0.1, fov: 32, p: { fit: 94, fill: 1.0, ox: 0, oy: 0.2 } },
    // the whole machine: the ring closes, the pulse runs round it, and the protectant leaves by its own line
    ring: { t: [-30, -58, 375], yaw: -140, pitch: 20, fit: 320, fill: 0.88, ox: 0.2, fov: 30, p: { fill: 1.25, ox: -0.05, oy: 0.14 } },   // (round 4b: phone fill 1.0 -> 1.25, camera nit 7; the green parcel stays in)
  };
  function withYaw(s, dy, k) { return Object.assign({}, s, { yaw: s.yaw + dy * k }); }

  // the raw camera at p (before smoothing): holds and the moves between them, each move a C2 ramp (qs). The q ranges
  // (story time; the warp gives each move its share of the scroll):
  //   hold   opening        0    - .07    (the case flies off .012-.09 round a still camera)
  //   move   push in        .07  - .115
  //   hold   vessel         .115 - .152   (the parcel gathers, climbs the dip tube, leaves the lid)
  //   move   crane up       .152 - .196
  //   hold   pump area      .196 - .29    (c1's climb, round the rotor, out along c2)
  //   move   round to the back view   .29 - .335   (orbit, ~92 deg: the owner's back view of the photometer)
  //   hold   photometer     .335 - .388   (down c2, through the cell, the beam)
  //   move   crane down behind the parcel   .388 - .422   (the owner's back view of c3, as in a4)
  //   follow c3 from behind  .422 - .46   (a slow truck: the route smoothed over 100 mm, no re-aim at bends, no bank)
  //   move   onto the fibre from the far side .46 - .497 (orbit, ~50 deg), line up .49 - .515, push .515 - .545 (one axis)
  //   the wall close-up      .548 - .645   (its own camera)
  //   the dive out           .646 - .694   (the same axis back)
  //   move   crane out, over and round to the open side   .69 - .75
  //   hold   the machine    .75  - .85    (c6 home, the ring closes, the pulse; the protectant out to the field)
  //   move   to the end     .85  - .902   (the case flies back on)
  //   hold   the end        .902 - 1
  const C_PV = new V3(-32, 50, 430), C_DIVE = new V3(5, -130, 280);
  // the c3 follow: behind (+y) and above the parcel, on the route smoothed over 100 mm; the offset turns from a4's
  // view down the shelf run (q .43) to a4's view of the turn to valve 5 (q .455). Phone 1.2x further out.
  const C3_O1 = new V3(54, 251, 131), C3_O2 = new V3(203, 215, 47);
  function c3Follow(p, asp) {
    const port = asp < 0.8, s = sCul(p), P = RC.smc(s), k = qs(0.43, 0.458, p);
    const off = C3_O1.clone().lerp(C3_O2, k).multiplyScalar(port ? 1.2 : 1);
    return { pos: P.clone().add(off), tgt: P.clone().add(new V3(0, -14, -4)), fov: port ? 40 : 35, ox: 0, oy: 0.06, roll: 0 };
  }
  // (owner, 10 Oct) the c3 back view, lower: a4's composition at q .428 brought down 36 mm with its aim, so the tube
  // along the shelf is in shot; and the servo valve's demo view, on the way round to the fibre's side (+x)
  const C_V5 = new V3(8, -143, 175);
  function c3Low(asp) { const o = c3Follow(0.428, asp); o.pos.z -= 36; o.tgt.z -= 50; o.oy = 0.02; return o; }
  function valvePose(asp) {
    const port = asp < 0.8;
    return port ? { pos: new V3(128, 0, 222), tgt: new V3(7, -142, 166), fov: 38, ox: -0.08, oy: 0.06, roll: 0 }
                : { pos: new V3(95, -5, 205), tgt: new V3(7, -142, 170), fov: 30, ox: 0.12, oy: 0, roll: 0 };
  }
  // a steadier ramp than qs (cruise 60 % of the way): the swing to the valve reads as one constant turn
  const qs2 = (a, b, x) => trap((x - a) / (b - a), 0.2);
  function rawPose(c, p, asp) {
    const S = (k) => shotPose(c, k === "open" ? OPEN : SHOTS[k], asp);
    let pose = S("open");
    pose = mix(pose, S("ves"), qs(0.07, 0.115, p));
    pose = mix(pose, S("pump"), qs(0.152, 0.196, p));
    pose = orbitMix(pose, S("v4w"), qs(0.29, 0.335, p), C_PV);
    pose = mix(pose, S("v4"), qs(0.327, 0.35, p));        // (round 4b: the push in, overlapping the orbit's end: one move)
    // owner, 10 Oct ("remove the delay before the particle reaches the membrane, bring that camera movement earlier,
    // and maybe a little lower so that the tube is more on screen ... then gradually move up"; "a constant camera
    // rotation as we scroll ... without the vertical jerkiness"): the crane down lands on the back view of c3, lower
    // (the tube in shot), and runs straight on into one steady swing in to the servo valve as the parcel runs along c3
    // (no hold); the valve's demo holds; then the camera rises with the parcel up c4 and lines up on the fibre
    // (the aim comes down after the camera: the parcel leaves the cell high, then drops to the shelf)
    if (p > 0.38) pose = mix(pose, c3Low(asp), qs(0.388, 0.42, p));
    if (p > 0.41) pose = orbitMix(pose, valvePose(asp), qs2(0.414, 0.468, p), C_V5, undefined, 0);
    // (along c3 the aim leans toward the parcel, on the route smoothed over 100 mm: it leaves the cell high and drops to
    // the shelf, and the frame keeps it in without re-aiming at each bend)
    if (p > 0.385 && p < 0.47) { const w = 0.7 * qband(p, 0.39, 0.4, 0.44, 0.462), sc3 = sCul(p), Ps = RC.smc(sc3).lerp(RC.at(sc3), 0.5); pose = Object.assign({}, pose, { tgt: pose.tgt.clone().lerp(Ps, w) }); }
    if (p > 0.495) pose = orbitMix(pose, divePose(c, p, asp), qs(0.498, 0.53, p), C_DIVE, qs(0.497, 0.527, p), 0);   // (the aim leads: the parcel climbs c4)
    // out: up and over the machine, round to the open side for the whole loop. Round 4b (camera 3, 4): one move from
    // the pull-out's end (no near-stop between the line-up out and the crane), and a lower lift (0.3 -> 0.05 rad) so the
    // view stays at or under ~25 deg of pitch and the path is short enough for the way out's 11 % cap
    if (p > 0.675) pose = orbitMix(pose, S("ring"), qs(0.677, 0.75, p), RING_C, undefined, 0.05);
    pose = mix(pose, S("open"), qs(0.85, 0.902, p));
    return pose;
  }

  // the dive (raw, not smoothed: it must arrive exactly). From the +x side the camera aims at the parcel as it climbs
  // into the one fibre, lines up with it (p .478-.51), then pushes straight along -x in behind its glow, through the
  // fibre's near wall, to CAMW from the far wall, where the parcel's glow is the close-up's landing cell. Out: the same
  // in reverse, the camera still aimed at the parcel as it climbs out of the fibre.
  function divePose(c, p, asp) {
    const port = asp < 0.8;
    const sC = sCul(p), P = RC.at(sC);
    // C2 profiles with a cruise (peak speed 1.5x the mean; a quintic peaks at 1.9x): the push is the fastest image
    // change in the story, so its peak matters
    const tr = (a, b) => trap((p - a) / (b - a), 0.34);
    // (round 4b, camera 6: the line-up starts while the orbit slows, so the two read as one move)
    // (owner, 10 Oct: the line-up rises from the valve's demo with the parcel; the push starts as it ends)
    const kA = tr(0.5, 0.53) * (1 - tr(0.672, 0.694));
    const kP = tr(0.527, 0.546) * (1 - tr(0.646, 0.68));
    const far = port ? 110 : 90;
    const D = Math.exp(lerp(Math.log(far), Math.log(port ? CAMWP : CAMW), kP));   // from the far inner wall
    // calm camera: straight in from the open side, along +x, from outside the machine (the orbit that brings the camera
    // round from c3 keeps to this radius, clear of the bottles), pushing in log distance; no lateral offset to swing out of
    const START = p < 0.6 ? (port ? 260 : 200) : (port ? 520 : 440);   // (owner 10 Oct: in from the valve's side, nearer; out as before)
    const x = WALLX + DS * Math.exp(lerp(Math.log(START), Math.log(D), kA));
    const zc = lerp(P.z + 80, P.z, kA);
    return { pos: new V3(x, AX[1], zc), tgt: P.clone(), fov: lerp(port ? 40 : 32, 34, kA), ox: 0,
             oy: lerp(port ? -0.06 : -0.08, 0, kA), roll: 0, near: Math.max(0.02, Math.min(4, D * 0.04)) };
  }
  const wDive = (p) => qband(p, 0.488, 0.51, 0.68, 0.7);       // (lighting, the fibre, the near plane: the dive's weight)

  // ---- the smoothed camera, sampled in p (polish pass, 9-10 Oct)
  // The whole camera (the holds, the moves between them, the dive) is composed raw at NS points, then ONE zero-phase
  // Gaussian runs over the final path: position, aim, roll, fov and lens shift. Its width (SIG, in p) tapers to zero at
  // p 0 and 1 (the owner's opening frame, exact), over the dive, and at the two scale hand-offs (the close-up's matched
  // frames, exact). A draw evaluates the samples as a cubic B-spline (C2). Measured: tools/v4_polish.py cam + jerk;
  // shots/v4-polish-camera-{desk,phone}.png.
  const NS = 8000, SIG = 0.0068;
  const HANDS = [0, MICRO[0], MICRO[1], 1];
  let CAM = null, camKey = "";
  // the dive's push in and pull out are designed in log distance (90 mm to 0.55 mm) and are C2 already; a Gaussian in
  // linear space would bunch their last millimetres into a few frames, so they stay raw (p .512-.672)
  function taper(p) {
    let k = 1 - qband(p, 0.508, 0.522, 0.672, 0.69);
    HANDS.forEach((h) => { k = Math.min(k, qs(0.0012, 0.03, Math.abs(p - h))); });
    // round 4 (camera 1): none inside a hold, so a hold is exactly still; the moves' qs ramps are C2 without it
    HOLDS.forEach(([h0, h1]) => { k = Math.min(k, 1 - qband(p, h0 + 0.004, h0 + 0.012, h1 - 0.012, h1 - 0.004)); });
    return k;
  }
  // a variable-width Gaussian gather over uniform samples (width in samples per output sample); edges clamp
  function gaussVar(src, st, sig, n) {
    const out = new Float32Array(src.length), acc = new Float64Array(st);
    for (let i = 0; i < n; i++) {
      const sg = sig[i];
      if (sg < 0.35) { for (let ch = 0; ch < st; ch++) out[i * st + ch] = src[i * st + ch]; continue; }
      const R = Math.ceil(sg * 3), k2 = -0.5 / (sg * sg);
      acc.fill(0); let wsum = 0;
      for (let j = -R; j <= R; j++) {
        const w = Math.exp(j * j * k2), q = Math.max(0, Math.min(n - 1, i + j)) * st;
        for (let ch = 0; ch < st; ch++) acc[ch] += w * src[q + ch];
        wsum += w;
      }
      for (let ch = 0; ch < st; ch++) out[i * st + ch] = acc[ch] / wsum;
    }
    return out;
  }
  function buildCam(c) {
    const asp = c.aspect, key = (asp < 0.8 ? "p" : "l") + asp.toFixed(3);
    if (camKey === key) return;
    camKey = key;
    const t0 = performance.now();
    // (holds: the aim is a fixed point, so it is smoothed as it is, not relative to the parcel; that would re-aim a
    // still camera at every bend the parcel takes)
    const pos = new Float32Array(NS * 3), tg0 = new Float32Array(NS * 3), lens = new Float32Array(NS * 4);
    for (let i = 0; i < NS; i++) {
      const r0 = rawPose(c, i / (NS - 1), asp);
      pos[i * 3] = r0.pos.x; pos[i * 3 + 1] = r0.pos.y; pos[i * 3 + 2] = r0.pos.z;
      tg0[i * 3] = r0.tgt.x; tg0[i * 3 + 1] = r0.tgt.y; tg0[i * 3 + 2] = r0.tgt.z;
      lens[i * 4] = r0.fov; lens[i * 4 + 1] = r0.ox; lens[i * 4 + 2] = r0.oy; lens[i * 4 + 3] = r0.roll;
    }
    const sig = new Float32Array(NS);
    for (let i = 0; i < NS; i++) sig[i] = SIG * (NS - 1) * taper(i / (NS - 1));
    CAM = { pos: gaussVar(pos, 3, sig, NS), tgt: gaussVar(tg0, 3, sig, NS), lens: gaussVar(lens, 4, sig, NS), ms: Math.round(performance.now() - t0) };
  }
  // a uniform cubic B-spline over the samples (C2: Catmull-Rom is only C1, and once the warp stretched the samples
  // apart its knots showed as jerk). Off the ends the samples continue in a straight line, so p 0 and 1, and any held
  // stretch (the scale hand-offs), come out exactly
  function cr(arr, st, ch, i, t) {
    const n = arr.length / st, at = (k) => k < 0 ? 2 * arr[ch] - arr[st + ch] : k > n - 1 ? 2 * arr[(n - 1) * st + ch] - arr[(n - 2) * st + ch] : arr[k * st + ch];
    const a = at(i - 1), b = at(i), c2 = at(i + 1), d = at(i + 2), t2 = t * t, t3 = t2 * t;
    return ((1 - t) * (1 - t) * (1 - t) * a + (3 * t3 - 6 * t2 + 4) * b + (-3 * t3 + 3 * t2 + 3 * t + 1) * c2 + t3 * d) / 6;
  }
  // the camera at p, as numbers (a pure function of p and the aspect): what the frame draws with, and what the clip
  // player needs to place the DOM labels over a pre-rendered frame
  function camState(c, p, o) {
    buildCam(c);
    o = o || {};
    const f = sat(p) * (NS - 1), i = Math.min(NS - 2, Math.floor(f)), t = f - i;
    o.pos = (o.pos || new V3()).set(cr(CAM.pos, 3, 0, i, t), cr(CAM.pos, 3, 1, i, t), cr(CAM.pos, 3, 2, i, t));
    o.tgt = (o.tgt || new V3()).set(cr(CAM.tgt, 3, 0, i, t), cr(CAM.tgt, 3, 1, i, t), cr(CAM.tgt, 3, 2, i, t));
    o.fov = cr(CAM.lens, 4, 0, i, t); o.ox = cr(CAM.lens, 4, 1, i, t); o.oy = cr(CAM.lens, 4, 2, i, t); o.roll = cr(CAM.lens, 4, 3, i, t);
    const wd = wDive(p), dist = o.pos.distanceTo(o.tgt);
    let near = Math.max(2, dist * 0.02);
    if (wd > 0) near = lerp(near, divePose(c, p, c.aspect).near, wd);
    o.near = Math.max(0.015, Math.min(near, dist * 0.5)); o.far = Math.max(5000, dist * 10);
    return o;
  }
  const _cs = {};
  function applyCam(cam, s) {
    cam.position.copy(s.pos); cam.up.set(0, 0, 1); cam.lookAt(s.tgt);
    if (Math.abs(s.roll) > 1e-3) cam.rotateZ(s.roll * Math.PI / 180);
    cam.fov = s.fov; cam.near = s.near; cam.far = s.far;
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] -= s.ox; cam.projectionMatrix.elements[9] -= s.oy;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld();
  }
  function placeCam(c, p) { applyCam(c.cam, camState(c, p, _cs)); }

  // ---- the re-timing (STORYBOARD rule 7, "a calm camera"): a monotone warp from the scroll's p to the story's own time
  // q. The camera is sampled in q (macro camState, and the close-up's own camera in its window); the image motion of each
  // step (rotation, plus translation as the angle it sweeps at the subject's distance, plus fov and lens-shift changes,
  // in degrees; the two scale hand-offs excluded) gives a density w(q), lightly smoothed. The scroll then spends
  // dp/dq ~ w(q) + F on each stretch: where the camera moves it gets scroll in proportion, so its motion per scroll px is
  // nearly flat, and the floor F keeps stills and dwells drifting on. Everything (captions, labels, trail, pulse) runs
  // on q, so it all stays in sync. Built per aspect at load; a pure function of p. WARP_L: the flat level aimed at, in
  // degrees per scroll px (rule 7: <= 0.2 per px, <= 45 deg in any 300 px).
  // PUSH_K: how a push along the view counts. 1 would count it at the frame's RMS field angle (what actually moves on
  // screen: the centre of a push stays put); 10 (clamped to a factor of 1) counts it as if the whole picture slid by
  // the distance ratio, the measure rule 7's budget was set with. That is the stricter one, and it is what ships: the
  // dive's push and pull get about 2600 and 3700 px of scroll at 3250vh, and both measures pass at both sizes.
  // PARCEL_K: how much the parcel's own motion across a still frame counts toward the re-timing (0: the camera only)
  // (round 4: PUSH_K 10 -> 2, the coordinator's decision A4; rule 7 is measured at the frame's field angle)
  // (round 4b: PUSH_K 1, the camera judge's tested proto-C: a push counts at the frame's field angle, the official
  // rule 7 measure now; the way out also runs at a slightly higher flat level, WARP_LX, to fit its 11 % cap)
  const NW = 6000, WARP_L = 0.12, WARP_LX = 0.14, WARP_LO = 0.15, PUSH_K = 1, PARCEL_K = 1, WARP_BASE = 10000;
  let WARP = null;
  const _wc = new THREE.PerspectiveCamera(30, 1, 1, 10), _wd = new V3(), _wf = new V3();
  function motionTable(c) {
    // the camera at NW+1 points of q: rotation (quaternion), position (mm), subject distance, fov, lens shift, scene
    const R = [];
    for (let i = 0; i <= NW; i++) {
      const q = i / NW, kM = (q - MICRO[0]) / (MICRO[1] - MICRO[0]);
      if (kM >= 0 && kM < 1) {
        micro.camFor(kM, _wc); const r = micro.camAtK(kM);
        R.push({ q: _wc.quaternion.clone(), p: _wc.position.clone().multiplyScalar(micro.MM), d: r.focus * micro.MM, fov: 34, ox: 0, oy: 0, u: 1 });
      } else {
        const st = camState(c, q, {}); _wc.aspect = c.aspect; applyCam(_wc, st);
        // the parcel on screen (NDC), when it is the thing to watch: in a hold it crosses the frame, and that is motion too
        const sub = q < 0.806 ? RC.at(sCul(q)) : RG.at(sGrn(q)), on = (q > 0.115 && q < 0.74) || (q > 0.807 && q < 0.848);
        const nd = sub.clone().project(_wc);
        R.push({ q: _wc.quaternion.clone(), p: st.pos.clone(), d: Math.max(0.05, st.pos.distanceTo(st.tgt)), fov: st.fov, ox: st.ox, oy: st.oy, u: 0,
                 sx: on ? nd.x : null, sy: on ? nd.y : null });
      }
    }
    const m = new Float64Array(NW);
    for (let i = 0; i < NW; i++) {
      const a = R[i], b = R[i + 1];
      if (a.u !== b.u) { m[i] = 0; continue; }                     // the scale hand-off: a matched cut, not a move
      const rot = 2 * Math.acos(Math.min(1, Math.abs(a.q.dot(b.q)))) * 180 / Math.PI;
      // translation: sideways it moves the whole picture by its angle at the aim distance; along the view (a push) it
      // moves a point at field angle phi by phi * dd/d, so it counts at the frame's RMS field angle KAPPA (~0.3 rad desk)
      _wd.copy(b.p).sub(a.p); _wf.set(0, 0, -1).applyQuaternion(a.q);
      const ax = _wd.dot(_wf), lat = Math.sqrt(Math.max(0, _wd.lengthSq() - ax * ax));
      const hh = a.fov * Math.PI / 360, hw = Math.atan(Math.tan(hh) * c.aspect), KAPPA = Math.min(1, PUSH_K * Math.sqrt((hh * hh + hw * hw) / 3));
      const trn = (lat + KAPPA * Math.abs(ax)) / ((a.d + b.d) / 2) * 180 / Math.PI;
      const lens = Math.abs(b.fov - a.fov) * 0.5 + Math.hypot(b.ox - a.ox, b.oy - a.oy) * (a.fov / 2);
      // the parcel's own motion across the frame (deg; the frame's height spans fov): half weight, so a hold where it
      // crosses the frame keeps scroll in proportion (it is the camera's motion that rule 7 bounds)
      const par = (a.sx !== null && a.sx !== undefined && b.sx !== null && b.sx !== undefined && Math.abs(a.sx) < 1.2 && Math.abs(b.sx) < 1.2)
        ? 0.5 * Math.hypot((b.sx - a.sx) * c.aspect, b.sy - a.sy) * a.fov / 2 : 0;
      // (round 4b: only inside the holds, where the camera is still; in a move the parcel's motion is not the camera's,
      // and counting it gave the dive and the way out ~10 % more scroll than their camera motion needs)
      const qm = (i + 0.5) / NW, inHold = HOLDS.reduce((x, [h0, h1]) => Math.max(x, qband(qm, h0, h0 + 0.006, h1 - 0.006, h1)), 0);
      m[i] = rot + trn + lens + PARCEL_K * par * inHold;
    }
    return m;
  }
  function buildWarp(c) {
    const span = Math.max(1, c.track.offsetHeight - c.stage.offsetHeight);
    const key = camKey + "|" + span;
    if (WARP && WARP.key === key) return WARP;
    const t0 = performance.now(), m = motionTable(c);
    // density per unit q, smoothed (sigma 0.002 q: about 50 px), then the floor
    const w = new Float64Array(NW), sg = 0.0015 * NW, Rg = Math.ceil(sg * 3);
    for (let i = 0; i < NW; i++) { let a = 0, ws = 0; for (let j = -Rg; j <= Rg; j++) { const k = Math.max(0, Math.min(NW - 1, i + j)), g = Math.exp(-0.5 * j * j / (sg * sg)); a += g * m[k]; ws += g; } w[i] = a / ws * NW; }
    let W = 0; for (let i = 0; i < NW; i++) W += w[i] / NW;
    // round 4 (decision A): the scroll each stretch needs, in px per unit q: its motion at the flat level WARP_L
    // (deg/px), or a hold's minimum still scroll spread over the hold's still interior, whichever is more, plus a small
    // base so nothing is ever skipped. If that adds up to less than the story's scroll, all of it scales up evenly.
    const need = new Float64Array(NW), holdD = (q) => {
      let d = 0;
      HOLDS.concat([WALL_HOLD]).forEach(([h0, h1, px]) => { const a = h0 + 0.012, b = h1 - 0.012; d = Math.max(d, px / (b - a) * qband(q, a - 0.004, a, b, b + 0.004)); });
      return d;
    };
    let need0 = 0;
    const minD = (q) => MINPX.reduce((d, [a, b, px]) => Math.max(d, px / (b - a) * qband(q, a - 0.003, a, b, b + 0.003)), 0);
    // (round 4b: the dive in and the way out run at WARP_LX, so they fit the coordinator's caps of 9 % and 11 % of the
    // scroll; the limiter below keeps them inside rule 7. The base is a floor now, not added on top of a move)
    const levelAt = (q) => WARP_L + (WARP_LX - WARP_L) * qband(q, 0.495, 0.505, 0.545, 0.55) + (WARP_LO - WARP_L) * qband(q, 0.64, 0.65, 0.745, 0.755);
    for (let i = 0; i < NW; i++) { const q = (i + 0.5) / NW; need[i] = Math.max(w[i] / levelAt(q), holdD(q), minD(q), WARP_BASE); }
    // round 4b: rule 7's limiter. The smoothed density leaves peaks where the motion changes faster than its smoothing
    // (a move starting while another ends); here every 100 and 300 px window and every step is held under LIM100,
    // LIM300 and LIM1 by giving it more scroll, a few relaxation passes, then a light smoothing of the result
    { const LIM1 = 0.17, WINS = [[100, 18], [300, 43]], C = new Float64Array(NW + 1), M = new Float64Array(NW + 1), sc = new Float64Array(NW);
      for (let i = 0; i < NW; i++) M[i + 1] = M[i] + m[i];
      for (let it = 0; it < 8; it++) {
        for (let i = 0; i < NW; i++) need[i] = Math.max(need[i], m[i] * NW / LIM1);
        WINS.forEach(([win, lim]) => {
          for (let i = 0; i < NW; i++) C[i + 1] = C[i] + need[i] / NW;
          sc.fill(1);
          for (let i = 0, j = 0; i < NW; i++) {
            if (j < i) j = i;
            while (j < NW && C[j] - C[i] < win) j++;
            const mo = M[j] - M[i];
            if (mo > lim) { const fct = Math.min(1.5, mo / lim); for (let k = i; k < j; k++) if (sc[k] < fct) sc[k] = fct; }
          }
          for (let i = 0; i < NW; i++) need[i] *= sc[i];
        });
      }
      const sg2 = 0.0006 * NW, R2 = Math.ceil(sg2 * 3), tmp = Float64Array.from(need);
      for (let i = 0; i < NW; i++) { let a = 0, ws = 0; for (let j2 = -R2; j2 <= R2; j2++) { const k = Math.max(0, Math.min(NW - 1, i + j2)), g = Math.exp(-0.5 * j2 * j2 / (sg2 * sg2)); a += g * tmp[k]; ws += g; } need[i] = Math.max(a / ws, tmp[i] * 0.97); } }
    for (let i = 0; i < NW; i++) need0 += need[i] / NW;
    // round 4b (camera 1, the "dwell"): the scroll the story has beyond its need goes to the holds (their still
    // interiors, in proportion to their minimum), not evenly to everything: the moves keep their flat level, so the dive
    // and the way out stay short, and the stations get the time
    const spare = span - need0;
    if (spare > 0) {
      let dw = 0; const dwl = new Float64Array(NW);
      for (let i = 0; i < NW; i++) { dwl[i] = holdD((i + 0.5) / NW); dw += dwl[i] / NW; }
      if (dw > 0) for (let i = 0; i < NW; i++) need[i] += spare * dwl[i] / dw;
    }
    const P = new Float64Array(NW + 1); for (let i = 0; i < NW; i++) P[i + 1] = P[i] + need[i] / NW;
    const Z = P[NW]; for (let i = 0; i <= NW; i++) P[i] /= Z;
    const F = WARP_BASE;
    // invert: q at NW+1 uniform p, then a cubic B-spline between them (C2, and monotone: its control points are)
    const Q = new Float64Array(NW + 1); let j = 0;
    for (let i = 0; i <= NW; i++) { const pp = i / NW; while (j < NW - 1 && P[j + 1] < pp) j++; Q[i] = (j + (pp - P[j]) / Math.max(1e-12, P[j + 1] - P[j])) / NW; }
    Q[0] = 0; Q[NW] = 1;
    // level: the motion's deg/px once scaled to the real scroll; needPx: the scroll the story needs at WARP_L
    WARP = { key: key, Q: Q, W: W, F: F, level: WARP_L * Math.max(1, need0 / span), spare: Math.round(span - need0), needPx: Math.round(need0), span: span, ms: Math.round(performance.now() - t0) };
    return WARP;
  }
  // the scroll's p at which the story reaches q (bisection on the monotone warp): for frames of a given story moment
  function unwarpP(q) { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (warpP(m) < q) lo = m; else hi = m; } return (lo + hi) / 2; }
  function warpP(p) {
    const c = window.__b2;
    if (!c || !c.model || !micro || !RC) return p;
    buildCam(c); const Wp = buildWarp(c);
    const f = sat(p) * NW, i = Math.min(NW - 1, Math.floor(f)), t = f - i;
    return sat(cr(Wp.Q, 1, 0, i, t));
  }

  // ---- the case, split into pieces by connectivity (vertices welded by position): every panel, post, rail and
  // fastener leaves whole and on its own; specks under 16 triangles ride with their nearest piece
  let pieces = [], backPiece = null;
  function splitCase(c) {
    const box = c.model.box, C = box.getCenter(new V3()), H = box.getSize(new V3()).multiplyScalar(0.5);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    Object.values(c.model.parts).forEach((P) => {
      if (!FX.isCase(P.id) || KEEP[P.id]) return;
      // weld: one id per distinct position across the part's meshes
      const vid = new Map(), base = [];
      let nv = 0;
      P.meshes.forEach((m) => {
        const pos = m.geometry.attributes.position.array, n = pos.length / 3, ids = new Int32Array(n);
        for (let k = 0; k < n; k++) {
          const key = Math.round(pos[k * 3] * 50) + "," + Math.round(pos[k * 3 + 1] * 50) + "," + Math.round(pos[k * 3 + 2] * 50);
          let id = vid.get(key); if (id === undefined) { id = nv++; vid.set(key, id); }
          ids[k] = id;
        }
        base.push(ids);
      });
      const parent = new Int32Array(nv); for (let k = 0; k < nv; k++) parent[k] = k;
      const find = (k) => { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
      const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
      P.meshes.forEach((m, mi) => { const idx = m.geometry.index.array, ids = base[mi]; for (let t = 0; t < idx.length; t += 3) { join(ids[idx[t]], ids[idx[t + 1]]); join(ids[idx[t]], ids[idx[t + 2]]); } });
      // components: their triangles (per mesh) and boxes
      const comps = new Map();
      P.meshes.forEach((m, mi) => {
        const idx = m.geometry.index.array, ids = base[mi], pos = m.geometry.attributes.position.array;
        for (let t = 0; t < idx.length; t += 3) {
          const r = find(ids[idx[t]]);
          let q = comps.get(r); if (!q) { q = { tris: {}, n: 0, bb: new THREE.Box3() }; comps.set(r, q); }
          (q.tris[mi] = q.tris[mi] || []).push(t); q.n++;
          for (let e = 0; e < 3; e++) { const a = idx[t + e] * 3; q.bb.expandByPoint(_tv.set(pos[a], pos[a + 1], pos[a + 2])); }
        }
      });
      const list = Array.from(comps.values()), bigs = list.filter((q) => q.n >= 16);
      list.forEach((q) => {
        if (q.n >= 16 || !bigs.length) return;
        const cq = q.bb.getCenter(new V3());
        let best = bigs[0], bd = 1e9; bigs.forEach((b) => { const d = b.bb.distanceToPoint(cq); if (d < bd) { bd = d; best = b; } });
        Object.keys(q.tris).forEach((mi) => { (best.tris[mi] = best.tris[mi] || []).push(...q.tris[mi]); }); best.n += q.n; best.bb.union(q.bb);
      });
      (bigs.length ? bigs : list).forEach((q) => {
        const ctr = q.bb.getCenter(new V3()), size = q.bb.getSize(new V3()), big = Math.max(size.x, size.y, size.z);
        const piv = new THREE.Group(); piv.position.copy(ctr);
        const inner = new THREE.Group(); inner.position.copy(ctr).multiplyScalar(-1); piv.add(inner);
        Object.keys(q.tris).forEach((mi) => {
          const src = P.meshes[mi], sIdx = src.geometry.index.array, tl = q.tris[mi];
          const arr = new (sIdx.constructor)(tl.length * 3);
          tl.forEach((t, j) => { arr[j * 3] = sIdx[t]; arr[j * 3 + 1] = sIdx[t + 1]; arr[j * 3 + 2] = sIdx[t + 2]; });
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", src.geometry.attributes.position); g.setAttribute("normal", src.geometry.attributes.normal);
          g.setIndex(new THREE.BufferAttribute(arr, 1)); g.computeBoundingSphere();
          const m = new THREE.Mesh(g, src.material);
          m.castShadow = src.castShadow; m.receiveShadow = true; m.renderOrder = src.renderOrder;
          inner.add(m);
        });
        c.scene.add(piv);
        // out along the face it is nearest; the open side (-x) leaves up rather than into the lens; nothing goes down
        // (under the floor it showed through it); everything rises a little
        const d = ctr.clone().sub(C); d.x /= H.x; d.y /= H.y; d.z /= H.z;
        const e = new V3(Math.sign(d.x) * Math.pow(Math.abs(d.x), 3), Math.sign(d.y) * Math.pow(Math.abs(d.y), 3), Math.sign(d.z) * Math.pow(Math.abs(d.z), 3));
        if (e.x < 0) { e.x *= 0.35; e.z += 0.7; }
        e.z = Math.max(e.z, 0) + 0.3;
        if (e.lengthSq() < 1e-4) e.set(0.2, 0, 1);
        e.normalize();
        const small = big < 30 || /led strip/.test(P.id);
        const t0 = small ? rnd() * 0.06 : big < 160 ? 0.15 + rnd() * 0.24 : 0.25 + rnd() * 0.26;
        const dur = Math.min(small ? 0.4 : 0.48, 0.985 - t0);          // every piece finishes inside the beat
        const axis = new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        pieces.push({ piv: piv, dir: e, t0: t0, dur: dur, D: small ? 1600 : 2800, axis: axis, spin: small ? 9 + rnd() * 8 : (rnd() - 0.5) * 1.4, id: P.id, big: big, home: ctr.clone(), small: small, bb: q.bb.clone() });
        if (P.id === "case:RIGHT PANEL" && (!backPiece || big > backPiece.big)) backPiece = pieces[pieces.length - 1];
      });
      P.fade = 0;                // the original part is never drawn again; its pieces are
      P.hiddenForGood = true;
    });
    // round-2 visual 9: the fasteners no longer burst out like glitter. Each one unscrews (two turns about the axis it
    // backs out along, 8 mm out) and then rides with the panel or rail it held; the LED strips ride with their post.
    const hosts = pieces.filter((q) => !q.small && q.big >= 60);
    pieces.forEach((q) => {
      if (!q.small || !hosts.length) return;
      let best = hosts[0], bd = 1e9; hosts.forEach((h) => { const d = h.bb.distanceToPoint(q.home); if (d < bd) { bd = d; best = h; } });
      q.host = best; q.rel = q.home.clone().sub(best.home);
      // (owner, 10 Oct: "this light bar keeps on moving so crazily"): the LED strips are long bars, not fasteners; the
      // fasteners' unscrew (two turns about their exit axis) spun a 0.5 m strip round its middle. They ride rigidly
      // with their post or panel instead, out and back
      q.rigid = /led strip/.test(q.id);
      // the axis it backs out along: the host's nearest face normal, approximated by the host's own exit direction
      q.sax = best.dir.clone();
    });
  }
  const _tv = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  function flyCase(c, p) {
    // u: 0 home, 1 gone. Off along beat 1, back on (the reverse) along beat 9
    const u = p < 0.5 ? sat((p - STRIP[0]) / (STRIP[1] - STRIP[0])) : 1 - sat((p - BACKON[0]) / (BACKON[1] - BACKON[0]));
    pieces.forEach((q) => {
      if (q.host) return;
      const t = sat((u - q.t0) / q.dur);
      if (t >= 0.999) { q.piv.visible = false; q.t = 1; return; }
      q.piv.visible = true; q.t = t;
      const e = Math.pow(t, 2.4);
      q.piv.position.copy(q.home).addScaledVector(q.dir, q.D * e);
      _q.setFromAxisAngle(q.axis, q.spin * e); q.piv.quaternion.copy(_q);
    });
    pieces.forEach((q) => {
      if (!q.host) return;
      const h = q.host, us = q.rigid ? 0 : ss(q.t0, q.t0 + 0.08, u);   // unscrew over u .00-.14 (p .012-.023)
      q.piv.visible = h.piv.visible; q.t = h.t;
      if (!q.piv.visible) return;
      _q2.setFromAxisAngle(q.sax, 4 * Math.PI * us);
      _tv.copy(q.rel).addScaledVector(q.sax, 8 * us).applyQuaternion(h.piv.quaternion);
      q.piv.position.copy(h.piv.position).add(_tv);
      q.piv.quaternion.copy(h.piv.quaternion).multiply(_q2);
    });
    if (backPiece && c.backplate) {
      c.backplate.visible = backPiece.piv.visible;
      c.backplate.position.copy(c._bp0).add(backPiece.piv.position).sub(backPiece.home);
    }
    return u;
  }

  // ---- round 4b (QA 4, visual 14): the output bulkhead lost its panel and its two halves floated 26 mm apart. A small
  // black bracket that stays (illustrative: the proposed mount), fixed to the column backplate's top corner, takes the
  // panel's place between the nuts; as the panel flies, the outer half slides in onto it (and back out as the case
  // returns), so the fitting reads as one bulkhead clamped on a real mount
  const OUT_SLIDE = 23.1;
  let outSlide = null;
  // ---- a mesh split by connectivity (vertices welded by position): the triangles of the components that pick(bbox,
  // centre) chooses, and the rest. Used on stable part / material names, so the page's light model splits the same way
  function splitByComponent(me, pick) {
    const g = me.geometry, pos = g.attributes.position, idx = g.index.array, n = pos.count, vid = new Map(), ids = new Int32Array(n); let nv = 0;
    for (let k = 0; k < n; k++) { const key = Math.round(pos.getX(k) * 50) + "," + Math.round(pos.getY(k) * 50) + "," + Math.round(pos.getZ(k) * 50); let id = vid.get(key); if (id === undefined) { id = nv++; vid.set(key, id); } ids[k] = id; }
    const par = new Int32Array(nv); for (let k = 0; k < nv; k++) par[k] = k;
    const fnd = (k) => { while (par[k] !== k) { par[k] = par[par[k]]; k = par[k]; } return k; };
    for (let t = 0; t < idx.length; t += 3) { const a = fnd(ids[idx[t]]), b = fnd(ids[idx[t + 1]]), d = fnd(ids[idx[t + 2]]); par[a] = b; par[fnd(d)] = fnd(b); }
    const box = new Map();
    for (let k = 0; k < n; k++) { const r = fnd(ids[k]); let b = box.get(r); if (!b) { b = new THREE.Box3(); box.set(r, b); } b.expandByPoint(_tv.set(pos.getX(k), pos.getY(k), pos.getZ(k))); }
    const take = new Map(); box.forEach((b, r) => take.set(r, !!pick(b, b.getCenter(new V3()))));
    const A = [], B = [];
    for (let t = 0; t < idx.length; t += 3) (take.get(fnd(ids[idx[t]])) ? A : B).push(idx[t], idx[t + 1], idx[t + 2]);
    const mk = (list) => { const h = new THREE.BufferGeometry(); h.setAttribute("position", pos); h.setAttribute("normal", g.attributes.normal); h.setIndex(new THREE.BufferAttribute(new (idx.constructor)(list), 1)); h.computeBoundingSphere(); return h; };
    return { take: A.length ? mk(A) : null, rest: mk(B), nTake: A.length / 3 };
  }
  // ---- servo valve 5 (owner, 10 Oct: "a quick demonstration of this servo powered luer valve ... turn the attached
  // blue head ... after it turns have some culture go through the other tubes, but then once you turn back it either
  // retracts or dissipates"). The turning set: the stopcock's blue handle, the grey coupler that holds it (the #666666
  // component on the servo's side, x > 11) and the servo's horn (the small #4d4d4d component at x 20-27) with its
  // yellow marker. Their own meshes move into a group that turns about the plug's axis. And (owner: "the two valves
  // aren't connected to each other") a short clear link from the valve's lower port (x 5.0) down onto stopcock 1's
  // upper port (x 0.9, 4.1 mm off), with a culture core that fills during the demo
  let v5Grp = null, v5Link = null;
  function buildValve5(c) {
    const P = c.model.parts.valve5; if (!P) return;
    v5Grp = new THREE.Group(); P.inner.add(v5Grp);
    const moveIn = (me, geo) => { const m2 = new THREE.Mesh(geo, me.material); m2.castShadow = me.castShadow; m2.receiveShadow = true; m2.userData.matName = me.userData.matName; v5Grp.add(m2); P.meshes.push(m2); };
    P.meshes.slice().forEach((me) => {
      const n = me.userData.matName || "";
      if (/#3b61b4|#facb43/.test(n)) { me.parent.remove(me); P.meshes.splice(P.meshes.indexOf(me), 1); moveIn(me, me.geometry); return; }
      let pick = null;
      if (/#666666/.test(n)) pick = (b, ct) => ct.x > 11;
      else if (/#4d4d4d/.test(n)) pick = (b) => b.min.x > 19 && b.max.x < 28 && b.max.y - b.min.y < 20;
      if (!pick) return;
      const r = splitByComponent(me, pick); if (!r.take) return;
      me.geometry = r.rest; moveIn(me, r.take);
    });
    // the link (render pass, C1, the owner: "you also didn't fix this"): stopcock 1 now sits coaxially under the valve's
    // lower port (alignStopcock), so the two luer flanges stack into one 4 mm collar; the culture runs straight down
    // the fittings' own bore, with no extra tubing over them (the S-tube's wall drew a second, offset set of rings)
    const pts = [[SC1_PORT[0], SC1_PORT[1], 167], [SC1_PORT[0], SC1_PORT[1], 149]];
    const curve = new B2.Poly(pts), L = curve.L;
    const mat = B2.flowMat(B2.LOOPS.cul.col, B2.LOOPS.cul.hot); mat.uniforms.uLen.value = L; patchFlow(mat);
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, LINK_R, 10, false), mat); core.renderOrder = 1; c.scene.add(core);
    v5Link = { core: core, wall: null, L: L };
  }
  // C1: stopcock 1's upper luer flange (centre x 0.90, z 156.5-158.5) sat 4.11 mm beside valve 5's lower flange (x 5.01,
  // z 158.5-160.5; both r 4.0, y -144.5, measured): the stopcock and the first 10-60 mm of its two lines (s1 to the
  // sampler, l1 to PT1, both leaving along x) move by that offset, so the two flanges are coaxial and meet
  const SC1_PORT = [5.01, -144.5], SC1_DX = 4.11, LINK_R = 1.7;
  function alignStopcock(c) {
    const P = c.model.parts.sc1; if (!P) return;
    P.center.x += SC1_DX; P.box.translate(new V3(SC1_DX, 0, 0)); P.pivot.position.copy(P.center);
    ["s1", "l1"].forEach((id) => { const T = c.model.tubes[id]; if (!T) return;
      const p = T.curve.p; let d = 0;
      const pts = p.map((q, i) => { if (i) d += q.distanceTo(p[i - 1]); return [q.x + SC1_DX * (1 - ss(10, 60, d)), q.y, q.z]; });
      T.curve = new B2.Poly(pts); T.L = T.curve.L;
      if (T.u) T.u.uLen.value = T.curve.L; T.wu.uLen.value = T.curve.L; });
  }
  // D3 (owner, 10 Oct: "Is it possible to just move output tube lower then since it goes down anyways"): the output
  // connector (the bulkhead on the case's -y end panel) and its bracket move from z 545 down to 165, just above the
  // shelf; o1 from the protectant bottle's cap is re-routed to it (shorter: the bottle sits low), so the green route and
  // the green parcel follow; outside, the line leaves low and runs straight onto the soil. Illustrative (in the CAD it sits
  // high; the owner wants no honesty note for it). Measured clear: the sampler (x <= -84), the bottle (r 40.5 about
  // (-42, -67), top z 267), p5 (x -45.9, y -74.2), stopcock 1 and s1 (x >= -32), the shelf top (z 129)
  const OUT_DZ = 380, OUT_Z = 165;
  function moveOutputLow(c) {
    const P = c.model.parts.output; if (!P) return;
    const seen = new Set(); P.meshes.forEach((me) => { if (seen.has(me.geometry)) return; seen.add(me.geometry); me.geometry.translate(0, 0, -OUT_DZ); });
    P.box.translate(new V3(0, 0, -OUT_DZ)); P.center.z -= OUT_DZ; P.pivot.position.copy(P.center); P.inner.position.copy(P.center).multiplyScalar(-1);
    const T = c.model.tubes.o1; if (!T) return;
    const k = [[-45.89, -60.6, 262.15], [-45.89, -60.6, 276], [-50, -61, 286], [-60, -62, 290], [-70, -66, 288], [-77, -78, 278], [-78, -98, 252],
               [-77, -120, 214], [-75.5, -138, 184], [-75, -150, OUT_Z + 3.5], [-75, -156, OUT_Z + 0.3], [-75, -160, OUT_Z]];
    const cv = new THREE.CatmullRomCurve3(k.map((q) => new V3(q[0], q[1], q[2])), false, "centripetal"), n = Math.ceil(cv.getLength() / 2), pts = [];
    for (let i = 0; i <= n; i++) { const q = cv.getPointAt(i / n); pts.push([q.x, q.y, q.z]); }
    T.curve = new B2.Poly(pts); T.L = T.curve.L;
    const rW = T.wall.geometry.parameters.radius, rC = T.core ? T.core.geometry.parameters.radius : 0, segs = Math.max(8, pts.length - 1);
    T.wall.geometry.dispose(); T.wall.geometry = new THREE.TubeGeometry(T.curve, segs, rW, 14, false); T.wu.uLen.value = T.L;
    if (T.core) { T.core.geometry.dispose(); T.core.geometry = new THREE.TubeGeometry(T.curve, segs, rC, 10, false); T.u.uLen.value = T.L; }
  }
  function mountOutput(c) {
    const P = c.model.parts.output; if (!P || !P.meshes.length) return;
    const me = P.meshes[0], g = me.geometry, pos = g.attributes.position, idx = g.index.array, inner = [], outer = [];
    for (let t = 0; t < idx.length; t += 3) { const y = (pos.getY(idx[t]) + pos.getY(idx[t + 1]) + pos.getY(idx[t + 2])) / 3; (y < -190 ? outer : inner).push(idx[t], idx[t + 1], idx[t + 2]); }
    if (!outer.length) return;
    const mk = (list) => { const h = new THREE.BufferGeometry(); h.setAttribute("position", pos); h.setAttribute("normal", g.attributes.normal); h.setIndex(new THREE.BufferAttribute(new (idx.constructor)(list), 1)); h.computeBoundingSphere(); return h; };
    me.geometry = mk(inner);
    outSlide = new THREE.Group(); P.inner.add(outSlide);
    const mo = new THREE.Mesh(mk(outer), me.material); mo.castShadow = me.castShadow; mo.receiveShadow = true; mo.userData.matName = me.userData.matName; outSlide.add(mo); P.meshes.push(mo);
    // the bracket: a 3 mm plate from the fitting to the backplate's corner, and a 1 mm standoff onto its face
    const box = (x0, x1, y0, y1, z0, z1) => { const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b; };
    // (D3: low, with the connector: on the backplate's lower corner)
    [box(-86, -22, -178.2, -175.0, 534 - OUT_DZ, 556 - OUT_DZ), box(-28, -22, -175.0, -173.9, 536 - OUT_DZ, 554 - OUT_DZ)].forEach((bg) => {
      const bm = new THREE.Mesh(bg, me.material); bm.castShadow = true; bm.receiveShadow = true; bm.userData.matName = me.userData.matName; P.inner.add(bm); P.meshes.push(bm); });
  }

  // ---- the photometer's beam (illustrative): from its LED (the mast's top, CAD) to the flow cell. A soft amber
  // falloff with a thin core (only the core crosses the bloom threshold), faint scatter along its length
  const BEAM_VS = "varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }";
  // round 4b (visual 2): a thin beam that cannot be mistaken for culture: a white-hot core (~0.7 mm radius on a 2.4 mm
  // tube: r = the projected radial fraction) in a #ff5a1a halo, depth-tested (the V4's cut exposes its light path)
  const BEAM_FS = "uniform vec3 uCol; uniform vec3 uHot; uniform float uA; uniform float uHead; varying vec2 vU; varying vec3 vN; varying vec3 vV;\n" +
    "void main(){ if (vU.y > uHead) discard; float f = abs(dot(normalize(vN), normalize(vV + vec3(1e-6)))); float r2 = max(0.0, 1.0 - f * f);\n" +
    " float sc = 0.9 + 0.1 * sin(vU.y * 97.0) * sin(vU.y * 41.0 + 1.3);\n" +
    " gl_FragColor = vec4((uHot * exp(-r2 * 7.7) * 1.6 + uCol * exp(-r2 * 2.2) * 0.42) * sc * uA, 1.0); }";
  const BEAM_HOT = "#fff1dc", BEAM_HALO = "#ff5a1a", BEAM_R = 2.4, DET_L = 9;   // (DET_L: the cell to the detector board, mm)
  function v4Beam(c) {
    const a = new V3(-15, 112, 506.5), b = new V3(-36, 112, 335), L = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(BEAM_R, BEAM_R, L, 20, 1, true); g.translate(0, L / 2, 0);
    const m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: RQ.srgb(BEAM_HALO) }, uHot: { value: RQ.srgb(BEAM_HOT) }, uA: { value: 0 }, uHead: { value: 1 } },
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(g, m); mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
    mesh.renderOrder = 10; c.scene.add(mesh);
    const spot = c.glowSprite("#ffb070", 9); spot.material.depthTest = false; spot.material.color.multiplyScalar(1.4); spot.position.copy(b); c.scene.add(spot);
    const led = c.glowSprite("#ffb050", 12); led.material.depthTest = false; led.material.color.multiplyScalar(2.2); led.position.copy(a); c.scene.add(led);
    return { cell: b, led: a, set: function (k, head) {
      m.uniforms.uA.value = k; m.uniforms.uHead.value = head === undefined ? 1 : head; mesh.visible = k > 0.003;
      spot.material.opacity = k * 0.7 * (head === undefined ? 1 : ss(0.55, 1, head)); led.material.opacity = Math.min(1, k * 1.3); } };
  }

  // ---- the tubes: neutral ahead of the parcel, amber behind it (the loop draws itself), and one pulse round the ring
  function patchFlow(m) {
    m.uniforms.uTrail = { value: 0 }; m.uniforms.uTrailEnd = { value: -1 }; m.uniforms.uNeut = { value: 0 }; m.uniforms.uLit = { value: 1 };
    m.uniforms.uPulse = { value: -1e5 }; m.uniforms.uPulseA = { value: 0 };
    m.fragmentShader = m.fragmentShader
      .replace("uniform vec3 uCol, uHot;", "uniform vec3 uCol, uHot; uniform float uTrail, uTrailEnd, uNeut, uLit, uPulse, uPulseA;")
      .replace("vec3 c = uCol * (uBase * (0.35 + 0.65 * facing));",
        "float behind = 1.0 - smoothstep(uTrailEnd - 3.0, uTrailEnd + 1.0, s);\n" +
        "      float lit = max(behind, uLit);\n" +
        "      vec3 grey = vec3(dot(uCol, vec3(0.299, 0.587, 0.114))) * 0.9;\n" +
        "      vec3 nnV4 = normalize(vN), vvV4 = normalize(vV + vec3(1e-6));\n" +
        // polish pass: deeper toward the edges (more liquid to look through in the middle), and the key's streak along it
        "      vec3 c = mix(mix(uCol, grey, uNeut), uCol, lit) * (uBase * mix(1.0 - 0.5 * uNeut, 1.0, lit) * (0.2 + 0.8 * pow(facing, 0.75)));\n" +
        "      c += vec3(1.0, 0.96, 0.9) * pow(max(dot(nnV4, normalize(normalize(vec3(-0.35, 0.6, 0.72)) + vvV4)), 0.0), 64.0) * 0.3 * uBase;")
      .replace("c += uHot * bead;", "c += uHot * bead;\n" +
        // polish pass: the culture's trail a deeper amber (bright orange tone-maps to lemon); green unchanged
        "      vec3 ttV4 = uHot.r > 0.5 ? vec3(1.0, 0.8, 0.62) : vec3(1.0);\n" +
        "      c += uHot * ttV4 * uTrail * behind * (0.45 + 0.55 * facing);\n" +
        "      c += uHot * uPulseA * exp(-pow((s - uPulse) / 40.0, 2.0)) * (0.5 + 0.5 * facing);");
    m.needsUpdate = true;
  }
  function patchTubes(c) { Object.values(c.model.tubes).forEach((T) => { if (T.core) patchFlow(T.core.material); }); }

  // ---- focus (see FOCUS_DIM): the sets, the gate, and the shader patch
  // [[q0, q1, q2, q3]: a qband (ramps >= .02 q), part ids, tube ids ("pump": the pump head's tube, "link": the valves'
  // link, "id@0": that tube lit from its start along a soft gradient)]
  const FOC_SETS = [
    [[0.07, 0.095, 0.158, 0.18], ["vessel", "culture", "stand", "drip tray"]],                            // 01 the vessel
    [[0.146, 0.166, 0.29, 0.31], ["pumpbox", "rotor"], ["pump"]],                                        // next stop (.166), then 02 the pump
    [[0.674, 0.694, 0.736, 0.756], ["pt_pt1", "pt_pt2", "pt_pt3", "pt_pt4"]],                            // label: pressure sensors x4 (C3: .694-.736)
    [[0.225, 0.245, 0.295, 0.315], ["pump_k", "KOH pump saddle", "pump_p", "protectant pump saddle"]],   // labels: KOH / protectant pump (.245-.295)
    [[0.274, 0.294, 0.388, 0.41], ["v4", "photometer step"]],                                            // next stop (.294), then 03 + OD600
    [[0.374, 0.394, 0.462, 0.482], ["membrane"]],                                                         // label: next stop, the membrane (.394-.462)
    [[0.442, 0.462, 0.505, 0.525], ["valve5", "sc1"], ["link", "l1@0", "s1@0"]],                          // servo valve 5's demo (label .472-.504)
    [[0.478, 0.498, 0.70, 0.72], ["membrane", "fibres", "membrane clamp"]],                             // into one fibre, and out of it
    [[0.65, 0.67, 0.70, 0.72], ["valve7"]],                                                              // out of the column through valve 7
    [[0.67, 0.69, 0.734, 0.754], ["vessel", "culture", "stand"]],                                        // label: back to the culture vessel
  ];
  // nothing dims in the wide shots (the opening, the whole machine, the end), nor round the close-up's hand-offs (its
  // scene has no focus, so the matched frames stay matched)
  const focGate = (q) => qs(0.075, 0.105, q) * (1 - qband(q, 0.515, 0.54, 0.652, 0.677)) * (1 - qs(0.722, 0.752, q));
  // the tone curve (look-v4.js COMPOSITE_FRAG's ACES fit) and its inverse; a display ratio d is a ratio d^2.2 before sRGB
  const FOC_Y = Math.pow(FOC_D, 2.2);
  const FOC_FN = [
    "float focAcesV4(float x) { return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); }",
    "float focAcesInvV4(float y) { y = min(y, 1.0); float a = 2.51 - 2.43 * y, b = 0.03 - 0.59 * y, c = -0.14 * y; return (-b + sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a); }",
    "vec3 focApplyV4(vec3 c, float w) {",
    "  w = clamp(w, 0.0, 1.0); if (w <= 0.0) return c;",
    "  float l = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0);",
    "  float k = l > 1e-5 ? focAcesInvV4(" + FOC_Y.toFixed(4) + " * focAcesV4(l)) / l : " + FOC_Y.toFixed(4) + ";",
    "  return mix(c, mix(vec3(l), c, " + FOC_SAT.toFixed(3) + ") * k, w); }", ""].join("\n");
  function focInject(fs, decl, body) { const i = fs.lastIndexOf("}"); return decl + FOC_FN + fs.slice(0, i) + "\n  " + body + "\n" + fs.slice(i); }
  // a part's materials: one shared uniform per part (P.focU, its dim 0..1), applied after everything else in the shader
  function focPatchPart(P) {
    P.focU = P.focU || { value: 0 };
    P.meshes.forEach((me) => {
      const m = me.material; if (!m || m.userData.focU) return;          // (a material two parts share: the first one's)
      m.userData.focU = P.focU;
      const U = P.focU, prev = m.onBeforeCompile, k0 = m.customProgramCacheKey ? m.customProgramCacheKey() : "";
      m.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); sh.uniforms.uFocV4 = U;
        sh.fragmentShader = focInject(sh.fragmentShader, "uniform float uFocV4;\n", "gl_FragColor.rgb = focApplyV4(gl_FragColor.rgb, uFocV4);"); };
      m.customProgramCacheKey = () => k0 + "|focV4";
      m.needsUpdate = true;
    });
  }
  // a tube's core or wall (ShaderMaterials with vUv and uLen): the gate, a whole-tube weight, and a soft gradient along it
  // about uFocS (mm along this tube; weight uFocSW)
  function focPatchTube(m) {
    if (!m || m.fragmentShader.indexOf("focApplyV4") >= 0) return;
    Object.assign(m.uniforms, { uFocG: { value: 0 }, uFocW: { value: 0 }, uFocS: { value: 1e6 }, uFocSW: { value: 0 } });
    m.fragmentShader = focInject(m.fragmentShader, "uniform float uFocG, uFocW, uFocS, uFocSW;\n",
      "{ float fwV4 = max(uFocW, uFocSW * (1.0 - smoothstep(" + FOC_R[0].toFixed(1) + ", " + FOC_R[1].toFixed(1) + ", abs(vUv.x * uLen - uFocS))));" +
      " gl_FragColor.rgb = focApplyV4(gl_FragColor.rgb, uFocG * (1.0 - fwV4)); }");
    m.needsUpdate = true;
  }
  let focTubes = null;
  function focSetup(c) {
    partList.forEach((P) => { if (!P.hiddenForGood) focPatchPart(P); });
    focTubes = [];
    Object.values(c.model.tubes).forEach((T) => { [T.core, T.wall].forEach((me) => { if (me) { focPatchTube(me.material); focTubes.push({ id: T.id, u: me.material.uniforms, s0: RC.marks[T.id] }); } }); });
    [pumpTube].forEach((me) => { focPatchTube(me.material); focTubes.push({ id: "pump", u: me.material.uniforms, s0: pumpTube.s0 }); });
    if (v5Link) [v5Link.core, v5Link.wall].forEach((me) => { if (!me) return; focPatchTube(me.material); focTubes.push({ id: "link", u: me.material.uniforms }); });
  }
  // the focus at story time q: {g: the gate, parts: {id: weight 0..1}, tubes: {id: weight}, at0: {id: weight}}; pure in q
  function focusState(q) {
    const o = { g: focGate(q), parts: {}, tubes: {}, at0: {} };
    FOC_SETS.forEach(([b, ids, tids]) => {
      const w = qband(q, b[0], b[1], b[2], b[3]); if (w <= 0) return;
      ids.forEach((id) => { o.parts[id] = Math.max(o.parts[id] || 0, w); });
      (tids || []).forEach((t) => { const k = t.indexOf("@0"), key = k > 0 ? t.slice(0, k) : t, tab = k > 0 ? o.at0 : o.tubes; tab[key] = Math.max(tab[key] || 0, w); });
    });
    return o;
  }
  function focusApply(c, q, sC) {
    const F = focusState(q), g = F.g;
    partList.forEach((P) => { if (P.focU) P.focU.value = g * (1 - (F.parts[P.id] || 0)); });
    focTubes.forEach((t) => { const r = focTube(t, F, sC), u = t.u; u.uFocG.value = g; u.uFocW.value = r[0]; u.uFocS.value = r[1]; u.uFocSW.value = r[2]; });
    return F;
  }
  // a tube's [whole weight, gradient centre (mm along it), gradient weight]: the parcel's own route (the culture loop and
  // the pump head's tube) follows the parcel (sC is defined for every q: at the dip tube's foot before it sets off, home
  // in the vessel after); "id@0" tubes are lit from their start
  function focTube(t, F, sC) {
    const W = F.tubes[t.id] || 0;
    if (t.s0 !== undefined) return [W, sC - t.s0, 1];
    if (F.at0[t.id]) return [W, 0, F.at0[t.id]];
    return [W, 1e6, 0];
  }
  // for the checks: every part's dim and each tube's dim every 10 mm along it, at story time q (the shader's own maths)
  function focusDims(q) {
    const F = focusState(q), g = F.g, sC = sCul(q), out = { g: g, parts: {}, tubes: {} };
    partList.forEach((P) => { if (P.focU) out.parts[P.id] = g * (1 - (F.parts[P.id] || 0)); });
    (focTubes || []).forEach((t) => { if (out.tubes[t.id]) return;      // (core and wall share their numbers)
      const r = focTube(t, F, sC), L = t.u.uLen.value, a = [];
      for (let s = 0; s <= L; s += 10) { const d = Math.abs(s - r[1]), x = sat((d - FOC_R[0]) / (FOC_R[1] - FOC_R[0])); a.push(g * (1 - Math.max(r[0], r[2] * (1 - x * x * (3 - 2 * x))))); }
      out.tubes[t.id] = a; });
    return out;
  }
  // polish pass: the silicone wall. It was a broad white fresnel (f^2.2 up to 0.55) that made every clear line read as a
  // grey pipe; now a thin crisp edge, a soft key streak and a hard kicker, so the tubing reads as clear and glossy
  const WALL_FRAG_V4 = [
    "uniform vec3 uCol; uniform float uLen, uDraw, uA; uniform vec3 uL;",
    "varying vec2 vUv; varying vec3 vN; varying vec3 vV;",
    "void main() {",
    "  if (vUv.x * uLen > uDraw * uLen + 0.5) discard;",
    "  vec3 n = normalize(vN), v = normalize(vV + vec3(1e-6));",
    "  float f = 1.0 - abs(dot(n, v)), rim = pow(f, 3.0);",
    "  float s1 = pow(max(dot(n, normalize(normalize(uL) + v)), 0.0), 90.0);",
    "  float s2 = pow(max(dot(n, normalize(normalize(vec3(0.75, 0.35, 0.55)) + v)), 0.0), 240.0);",
    "  float a = (0.02 + 0.4 * rim) * uA;",
    "  vec3 c = uCol * (0.2 + 0.8 * rim) + vec3(1.0) * (s1 * 1.5 + s2 * 0.9) * uA;",
    "  gl_FragColor = vec4(c, clamp(a + (s1 * 0.55 + s2 * 0.45) * uA, 0.0, 1.0));",
    "}"].join("\n");
  const WARM_WHITE = new THREE.Color(1, 0.97, 0.93);
  function polishMaterials(c) {
    Object.values(c.model.tubes).forEach((T) => {
      T.wall.material.fragmentShader = WALL_FRAG_V4; T.wall.material.needsUpdate = true;
      // the clear liquids (protectant, KOH) read darker inside their tubing: clear, not grey rods
      if (T.u && (T.loop === "pro" || T.loop === "koh")) T.u.uCol.value.multiplyScalar(0.6);
    });
    // a soft contact shadow on the bench under the machine (it floated over the floor in the wide shots)
    const b = c.model.box, cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const x = cv.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256);
    x.filter = "blur(18px)"; x.fillStyle = "#fff"; x.fillRect(44, 44, 168, 168); x.filter = "none";
    const tex = new THREE.CanvasTexture(cv);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry((b.max.x - b.min.x) * 1.5, (b.max.y - b.min.y) * 1.5),
      new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity: 0.62, depthWrite: false }));
    sh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, c.floorZ + 0.25); sh.renderOrder = -0.8; c.scene.add(sh);   // (D2: after the soil)
    // the white lab parts read as flat white blocks (their albedo sat near the tone curve's shoulder): a step down, with
    // a satin coat so the key shapes them; the milky clear pump heads get a thinner face and rim
    Object.values(c.model.parts).forEach((P) => {
      if (P.id === "fibres" || FX.isCase(P.id)) return;
      P.meshes.forEach((me) => {
        const mt = me.material, n = me.userData.matName || "";
        if (mt.userData.glass) { if (/^clear #e6e6e6$/.test(n)) { mt.userData.glass.face = 0.022; mt.userData.glass.rim = 0.3; } return; }
        if (!mt.color || mt.isShaderMaterial || mt.transparent || mt.metalness > 0.5) return;
        const l = mt.color.r * 0.2126 + mt.color.g * 0.7152 + mt.color.b * 0.0722;
        if (l < 0.42) return;
        mt.color.multiplyScalar(0.66).multiply(WARM_WHITE); mt.roughness = Math.min(mt.roughness, 0.5);   // (round 4b, visual 7: not periwinkle)
        if (mt.clearcoat !== undefined) { mt.clearcoat = Math.max(mt.clearcoat, 0.28); mt.clearcoatRoughness = 0.32; }
        mt.userData.baseColor = undefined; mt.needsUpdate = true;
      });
    });
    // capture mode: a bigger shadow map
    const Q = window.V4Q;
    if (Q && Q.capture) { c.key.shadow.mapSize.set(Q.shadow, Q.shadow); if (c.key.shadow.map) { c.key.shadow.map.dispose(); c.key.shadow.map = null; } }
  }

  // ---- the tubes' render (10 Oct, the owner: "the render quality isnt the greatest either, especially for tubes").
  // Diagnosed on 1:1 crops (dev/night-logs/2026-10-10-edits/render/): the clear lines drew an opaque grey core in a
  // milky sleeve (grey rods); the amber core was a thin rod at 54 % of the tube's width inside a clear sleeve that
  // showed the dark background as a dark outline in the wide shots; the walls were double-sided (a second rim inside
  // each tube); 14-sided walls and 10-sided cores showed polygon silhouettes in the close shots, and the specular,
  // shaded on interpolated vertex normals, beaded along the facets; the amber silhouettes aliased.
  // Now, a thick-walled silicone tube (OD 8.2, ID 4.8, n 1.41) full of liquid (n 1.33), seen from outside:
  //   - the wall magnifies the bore: the liquid shows out to n_l x R_in = 0.78 of the tube's radius (the core is drawn
  //     at that radius); between it and the bore (n_w x R_in = 0.83) total internal reflection draws a thin bright line
  //     (the inner wall); the wall's own band out to the rim is a little darker (the background seen through 1.7 mm of
  //     silicone); a fresnel rim at the silhouette; two specular streaks (a soft one from the studio's top light, a
  //     sharp kicker), widened by the normal's screen-space change so thin far tubes do not sparkle;
  //   - per-pixel normals from the tube's own axis (aCtr) and its direction (aTan): no facets, no beads; 32 / 24 sides;
  //   - clear liquids (protectant, KOH, the culture line ahead of the parcel) are see-through, with their edges;
  //   - every silhouette fades over its last screen pixel (analytic edge anti-aliasing), the core's and the wall's.
  const TUBE_N = { wall: 1.41, liq: 1.33 }, WALL_RS = 32, CORE_RS = 24;
  // (no screen-space derivatives: fwidth() on this GPU, ANGLE on Metal, gave a different value at some silhouette pixels
  // on every draw of the same frame, so frames were not a pure function of p. The pixel footprint is computed instead:
  // vPx is the tube's radius in scene-buffer pixels, from its depth and the projection; uPxH the buffer's height)
  const TUBE_PXH = { value: 1000 };
  const TUBE_PX_VS = "vPx = uR * projectionMatrix[1][1] * uPxH * 0.5 / max(-mv.z, 1e-3);";
  const TUBE_VS = [
    "attribute vec3 aCtr; attribute vec3 aTan; uniform float uR, uPxH;",
    "varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vT; varying float vPx;",
    "void main() {",
    "  vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    "  vN = mv.xyz - (modelViewMatrix * vec4(aCtr, 1.0)).xyz; vT = normalMatrix * aTan; vV = -mv.xyz;",
    "  " + TUBE_PX_VS,
    "  gl_Position = projectionMatrix * mv;",
    "}"].join("\n");
  // the tube's frame at a fragment: n (radial, view space), the view direction across the tube, cos around (1 on the
  // tube's centre line on screen), b (0 centre .. 1 silhouette: linear in screen distance from the axis), fb (b per px)
  const TUBE_FRAME = [
    "  vec3 nT = normalize(vN), vT0 = normalize(vV + vec3(1e-6)), tT = normalize(vT + vec3(1e-6));",
    "  vec3 vpT = vT0 - dot(vT0, tT) * tT; vpT = length(vpT) > 1e-4 ? normalize(vpT) : vT0;",
    "  float cAT = clamp(dot(nT, vpT), 0.0, 1.0), bT = sqrt(max(0.0, 1.0 - cAT * cAT)), fbT = clamp(1.0 / max(vPx, 1e-3), 1e-3, 1.0);"].join("\n");
  const WALL_FRAG_V5 = [
    "uniform vec3 uCol; uniform float uLen, uDraw, uA, uBl, uBw; uniform vec3 uL;",
    "varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vT; varying float vPx;",
    "void main() {",
    "  if (vUv.x * uLen > uDraw * uLen + 0.5) discard;",
    TUBE_FRAME,
    "  float cosV = clamp(dot(nT, vT0), 0.0, 1.0), F = 0.03 + 0.97 * pow(1.0 - cosV, 5.0);",
    // specular anti-aliasing (Toksvig-style): the lobe widens where the normal changes fast across a pixel
    // (the normal turns by 1 / (radius in px x cos) per pixel across the tube: its variance over a pixel, as fwidth's)
    "  float vrT = min(1.0 / max(vPx * vPx * max(cAT * cAT, 0.04), 1e-4), 4.0);",
    "  vec3 rT = reflect(-vT0, nT);",
    // (Blinn lobes, camera-relative studio lights: a soft box upper left, a hard kicker right; peak 1 at the set width)
    "  float e1 = 36.0 / (1.0 + 36.0 * vrT), e2 = 420.0 / (1.0 + 420.0 * vrT);",
    "  float s1 = pow(max(dot(nT, normalize(normalize(vec3(-0.35, 0.55, 0.75)) + vT0)), 0.0), e1) * (e1 + 2.0) / 38.0;",
    "  float s2 = pow(max(dot(nT, normalize(normalize(vec3(0.75, 0.35, 0.55)) + vT0)), 0.0), e2) * (e2 + 2.0) / 422.0;",
    // the bands across the tube (soft over one pixel): the inner wall's TIR line, then the wall itself
    "  float tir = smoothstep(uBl - fbT, uBl + fbT, bT) * (1.0 - smoothstep(uBw - fbT, uBw + fbT, bT));",
    "  float wal = smoothstep(uBw - fbT, uBw + fbT, bT);",
    // a dark studio: the environment is a little brighter above (view space up)
    "  vec3 env = uCol * (0.22 + 0.5 * clamp(rT.y * 0.5 + 0.5, 0.0, 1.0));",
    "  vec3 em = env * (F * 0.85 + tir * 0.5 + wal * 0.06) + vec3(1.0, 0.98, 0.95) * (s1 * 2.0 + s2 * 2.2);",
    "  float a = clamp(F * 0.6 + tir * 0.55 + wal * 0.26 + s1 * 0.12 + s2 * 0.15, 0.0, 1.0);",
    "  float edge = 1.0 - smoothstep(1.0 - fbT, 1.0, bT);",          // the silhouette's last pixel
    "  gl_FragColor = vec4(em * uA * edge, a * uA * edge);",          // (premultiplied)
    "}"].join("\n");
  // a TubeGeometry with the per-vertex axis point and direction (for the per-pixel normal)
  function tubeGeo(curve, segs, r, radial) {
    const g = new THREE.TubeGeometry(curve, segs, r, radial, false);
    const fr = g.tangents ? g.tangents : curve.computeFrenetFrames(segs, false).tangents;
    const n = g.attributes.position.count, ctr = new Float32Array(n * 3), tan = new Float32Array(n * 3), P = new V3();
    for (let i = 0; i <= segs; i++) {
      curve.getPointAt(i / segs, P); const T = fr[i];
      for (let j = 0; j <= radial; j++) { const k = (i * (radial + 1) + j) * 3; ctr[k] = P.x; ctr[k + 1] = P.y; ctr[k + 2] = P.z; tan[k] = T.x; tan[k + 1] = T.y; tan[k + 2] = T.z; }
    }
    g.setAttribute("aCtr", new THREE.BufferAttribute(ctr, 3)); g.setAttribute("aTan", new THREE.BufferAttribute(tan, 3));
    return g;
  }
  // the core: the flow shader (patchFlow's trail, parcel, pulse) on the magnified liquid, with per-pixel facing, a
  // see-through clear liquid, and the edge pixel faded
  function coreFrag(fs) {
    return fs
      .replace("varying vec2 vUv; varying vec3 vN; varying vec3 vV;", "varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vT; varying float vPx; uniform float uClearL;")
      .replace("float facing = abs(dot(normalize(vN), normalize(vV)));", TUBE_FRAME + "\n      float facing = cAT;")
      // (the draw-on head glows in as the line starts to draw: it popped in at full strength, a 4x frame step on phone)
      .replace("float hd = exp(-pow((head - s) / 6.0, 2.0)) * step(uDraw, 0.999);", "float hd = exp(-pow((head - s) / 6.0, 2.0)) * step(uDraw, 0.999) * smoothstep(0.0, 24.0, head);")
      .replace("gl_FragColor = vec4(c, uAlpha);",
        // (the liquid is deeper toward its edges, on every term: the slug and the trail have volume too)
        "c *= mix(0.42, 1.0, smoothstep(0.0, 0.8, facing));\n" +
        "      float clearK = max(uClearL * (1.0 - behind * step(0.001, uTrail)), uNeut * (1.0 - lit)) * (1.0 - min(1.0, bead));\n" +
        "      float aLq = mix(1.0, 0.14 + 0.62 * bT * bT * bT, clearK) * (1.0 - smoothstep(1.0 - fbT, 1.0, bT));\n" +
        "      gl_FragColor = vec4(c * aLq * uAlpha, uAlpha * aLq);");
  }
  function upgradeTubeMats(core, wall, clearL, Rout, Rin, Rcore) {
    if (core) {
      const m = core.material;
      m.vertexShader = m.vertexShader.indexOf("aCtr") >= 0 ? m.vertexShader : TUBE_VS;
      m.fragmentShader = coreFrag(m.fragmentShader); m.uniforms.uClearL = { value: clearL };
      m.uniforms.uR = { value: Rcore === undefined ? Rout : Rcore }; m.uniforms.uPxH = TUBE_PXH;
      m.premultipliedAlpha = true; m.side = THREE.FrontSide; m.needsUpdate = true;
    }
    if (wall) {
      const m = wall.material;
      m.vertexShader = TUBE_VS; m.fragmentShader = WALL_FRAG_V5; m.uniforms.uR = { value: Rout }; m.uniforms.uPxH = TUBE_PXH;
      m.uniforms.uBl = { value: Math.min(0.9, TUBE_N.liq * Rin / Rout) }; m.uniforms.uBw = { value: Math.min(0.95, TUBE_N.wall * Rin / Rout) };
      m.premultipliedAlpha = true; m.side = THREE.FrontSide; m.needsUpdate = true;
    }
  }
  // every tube: the model's 20, then the pump head's, the valves' link and the line out of the output connector
  function upgradeTubes(c) {
    Object.values(c.model.tubes).forEach((T) => {
      const Rout = T.wall.geometry.parameters.radius, segs = T.wall.geometry.parameters.tubularSegments;
      const Rin = T.core ? T.core.geometry.parameters.radius / 0.92 : Rout * 0.585;
      const clearL = (T.loop === "pro" || T.loop === "koh") ? 1 : 0;
      T.wall.geometry.dispose(); T.wall.geometry = tubeGeo(T.curve, segs, Rout, WALL_RS);
      const Rc = Math.min(0.9 * Rout, TUBE_N.liq * Rin);
      if (T.core) { T.core.geometry.dispose(); T.core.geometry = tubeGeo(T.curve, segs, Rc, CORE_RS); }
      upgradeTubeMats(T.core, T.wall, clearL, Rout, Rin, Rc);
    });
    // the line out of the connector and the valves' link: the same build (their curves are B2.Poly)
    const re = (o, rOut, rIn, clearL) => { const cv = o.core.geometry.parameters.path, segs = o.core.geometry.parameters.tubularSegments;
      const Rc = o.wall ? Math.min(0.9 * rOut, TUBE_N.liq * rIn) : rOut;
      o.core.geometry.dispose(); o.core.geometry = tubeGeo(cv, segs, Rc, CORE_RS);
      if (o.wall) { o.wall.geometry.dispose(); o.wall.geometry = tubeGeo(cv, segs, rOut, WALL_RS); }
      upgradeTubeMats(o.core, o.wall, clearL, rOut, rIn, Rc); };
    if (v5Link) re(v5Link, LINK_R, LINK_R, 0);            // (C1: the culture in the fittings' bore, no wall of its own)
    if (stubTube) re({ core: stubTube, wall: stubTube.wall }, 3.4, 2.2 / 0.92, 1);
    if (field) field.tubes.forEach((t) => re(t, t.rOut, t.rIn, 1));
  }

  // the bottles in two passes: [back faces' render order, front faces'] (glass outside its liquid; all after the tubes)
  const BOTTLES = { vessel: [3.6, 4.3], culture: [3.7, 4.2], protectant: [3.6, 4.3], "protectant liquid": [3.7, 4.2], koh: [3.6, 4.3], "koh liquid": [3.7, 4.2] };
  const GLASS_RIM_FIX = true;
  function bottleTwins(c) {
    Object.keys(BOTTLES).forEach((id) => { const P = c.model.parts[id]; if (!P) return; const [ob, of] = BOTTLES[id];
      P.meshes.slice().forEach((me) => { const mt = me.material; if (!(mt.transparent || (mt.userData && mt.userData.glass))) return;
        me.renderOrder = of; if (mt.side !== THREE.DoubleSide) return;
        mt.side = THREE.FrontSide; mt.needsUpdate = true;
        const mb = mt.clone(); if (mt.onBeforeCompile) { mb.onBeforeCompile = mt.onBeforeCompile; mb.customProgramCacheKey = mt.customProgramCacheKey; }
        mb.userData = Object.assign({}, mt.userData); mb.side = THREE.BackSide;
        const tw = new THREE.Mesh(me.geometry, mb); tw.renderOrder = ob; tw.castShadow = false; tw.receiveShadow = me.receiveShadow;
        tw.userData.matName = me.userData.matName; tw.userData.backTwin = true; me.parent.add(tw); P.meshes.push(tw); }); });
  }

  // ---- C2 (owner, 10 Oct 12:10: the outlet "looks a little weird ... like a laser"; "last scene just make the
  // background kind of line farmland"; the coordinator: a restrained version). The outlet is a real tube: out of the
  // bulkhead, down the case's -y end to the floor, and out along the ground as a drip line; at the end a field of young
  // crop rows comes up on the floor behind the machine, fed by the line, and fades into the dark. Ported from the
  // retired unveil film's outro (dev/retired/2026-10-09/hardware/bioreactor/js/unveil.js, ~l.1405): painted canvas
  // textures on sprites and floor planes, no hard edges, clumps that come up outward as the liquid reaches them.
  // Every value is a function of q; nothing exists before q .84 (the opening frame is untouched).
  // D1 (owner, 13:50: the black panel beside the membrane "don't have this appear until when the box assembles"): the
  // column backplate leaves and returns with the case, so the outlet no longer runs down a panel in the stripped
  // machine: it hangs from the bulkhead fitting in a soft drape to the floor (outside the end panel, so once the case is
  // back it hangs beside it), and runs off along the ground at y OUT_YO
  const OUT_YO = -240, OUT_FX = -10;                         // the floor run: its y, and where it starts (x)
  // the outlet's centreline: out of the bulkhead level, sagging into a hang, down beside the end panel, onto the floor
  function outletPath(c) {
    // (D3: the connector is low now: out of it level, a short fall onto the soil, and off toward the header)
    // (one swoop: out of the fitting, falling and turning toward the header in the same bend, onto the soil)
    const fz = c.floorZ + 3.6, Z = OUT_Z, k = [[-75, -160, Z], [-75, -182, Z], [-75, -212, Z], [-74.5, -228, Z - 12], [-71, -240, Z - 45], [-63, -246, fz + 20],
      [-48, -246, fz + 3], [-30, -243, fz], [OUT_FX, OUT_YO, fz]];
    const cv = new THREE.CatmullRomCurve3(k.map((q) => new V3(q[0], q[1], q[2])), false, "centripetal");
    const n = Math.ceil(cv.getLength() / 3), P = []; for (let i = 0; i <= n; i++) P.push(cv.getPointAt(i / n));
    return P;
  }
  function outroRnd(seed) {                                  // (the unveil film's integer LCG)
    let s = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function feather(g, n, inner, outer) {
    const f = g.createRadialGradient(n / 2, n / 2, n * inner, n / 2, n / 2, n * outer);
    f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(0.65, "rgba(0,0,0,0.45)"); f.addColorStop(1, "rgba(0,0,0,1)");
    const prev = g.globalCompositeOperation; g.globalCompositeOperation = "destination-out"; g.fillStyle = f; g.fillRect(0, 0, n, n); g.globalCompositeOperation = prev;
  }
  const texOf = (cv) => { const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; };
  // a painted clump of young shoots (the unveil film's shootTexture, a little greener: these are young crop rows at
  // night, lit by nothing but the room)
  function shootTexture(seed, broad) {
    const w = 256, h = 256, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d"), rnd = outroRnd(seed * 1597 + 101), blades = (broad ? 5 : 7) + Math.floor(rnd() * 4);
    for (let b = 0; b < blades; b++) {
      const near = rnd(), x0 = w * (0.32 + rnd() * 0.36), lean = (rnd() - 0.5) * w * (broad ? 0.8 : 0.55);
      const top = h * ((broad ? 0.32 : 0.14) + rnd() * 0.36), wid = w * ((broad ? 0.03 : 0.02) + rnd() * 0.025), dim = 0.5 + near * 0.5;
      const grd = g.createLinearGradient(0, h, 0, top);
      grd.addColorStop(0, "rgba(22,52,26," + (0.95 * dim).toFixed(3) + ")"); grd.addColorStop(0.5, "rgba(58,122,56," + (0.9 * dim).toFixed(3) + ")"); grd.addColorStop(1, "rgba(132,186,96," + (0.8 * dim).toFixed(3) + ")");
      g.fillStyle = grd; g.beginPath(); g.moveTo(x0 - wid, h);
      g.quadraticCurveTo(x0 - wid * 0.4 + lean * 0.45, (h + top) * 0.5, x0 + lean, top);
      g.quadraticCurveTo(x0 + wid * 0.8 + lean * 0.45, (h + top) * 0.5, x0 + wid, h); g.closePath(); g.fill();
      if (rnd() < (broad ? 0.85 : 0.62)) {
        const ly = top + (h - top) * (0.28 + rnd() * 0.38), lx = x0 + lean * (1 - (ly - top) / (h - top)), dir = rnd() < 0.5 ? -1 : 1;
        const ll = w * ((broad ? 0.1 : 0.065) + rnd() * 0.095), droop = ll * (0.16 + rnd() * 0.3);
        g.beginPath(); g.moveTo(lx - wid * 0.55, ly - wid * 0.7);
        g.quadraticCurveTo(lx + dir * ll * 0.55, ly - ll * 0.34, lx + dir * ll, ly + droop);
        g.quadraticCurveTo(lx + dir * ll * 0.45, ly + ll * 0.1, lx + wid * 0.55, ly + wid * 0.7); g.closePath();
        g.fillStyle = "rgba(70,140,64," + (0.85 * dim).toFixed(3) + ")"; g.fill();
      }
    }
    return texOf(cv);
  }
  // D2: the soil, one 880 mm tile (four rows): tilled earth, a raised bed along each row with a furrow between, clods
  function soilTexture() {
    const n = 512, cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d"), rnd = outroRnd(77);
    g.fillStyle = "rgb(30,26,21)"; g.fillRect(0, 0, n, n);
    for (let r = 0; r < 4; r++) { const y = (r + 0.5) * n / 4;
      const gr = g.createLinearGradient(0, y - n / 8, 0, y + n / 8);                 // the bed light, the furrow dark
      gr.addColorStop(0, "rgba(14,12,10,0.85)"); gr.addColorStop(0.3, "rgba(36,31,25,0.5)"); gr.addColorStop(0.5, "rgba(42,36,29,0.45)");
      gr.addColorStop(0.72, "rgba(28,24,20,0.5)"); gr.addColorStop(1, "rgba(14,12,10,0.85)"); g.fillStyle = gr; g.fillRect(0, y - n / 8, n, n / 4); }
    for (let i = 0; i < 4200; i++) { const x = rnd() * n, y = rnd() * n, s2 = 1 + rnd() * 3.5;
      g.fillStyle = "rgba(" + (rnd() < 0.55 ? "12,10,8" : "52,45,36") + "," + (0.15 + rnd() * 0.3).toFixed(2) + ")"; g.beginPath(); g.ellipse(x, y, s2, s2 * (0.5 + rnd() * 0.5), rnd() * 3, 0, 6.283); g.fill(); }
    // (the tile repeats: draw the clods wrapped, so its edges carry no seam)
    g.drawImage(cv, n / 2, 0, n / 2, n, 0, 0, n / 2, n); 
    g.filter = "blur(1.5px)"; g.drawImage(cv, 0, 0); g.filter = "none";
    const t = texOf(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  }
  function blobTexture(rgb) {
    const n = 64, cv = document.createElement("canvas"); cv.width = cv.height = n; const g = cv.getContext("2d");
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, "rgba(" + rgb + ",0.9)"); r.addColorStop(0.3, "rgba(" + rgb + ",0.4)"); r.addColorStop(0.65, "rgba(" + rgb + ",0.08)"); r.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = r; g.fillRect(0, 0, n, n); return texOf(cv);
  }
  // D2 (owner, 13:50: "better, more like the whole thing is there, maybe the ground becomes soil"): in the last beat the
  // machine stands in a field. The studio floor turns to tilled soil; crop rows all round, along x, every FARM.dy,
  // receding into the dark; black drip tape along every row carries green droplets out from a header at x FARM.hx, fed
  // by the outlet's floor line; a faint night glow on the horizon. Plants: one billboard mesh (~2,000 painted clumps
  // from a 3x3 atlas); tape: one ribbon mesh; both masked (from the end frame's own camera, per aspect) clear of the end
  // line, the honesty key, the near foreground and the machine's front. A pure function of q; nothing before q .845.
  const FARM = { hx: 650, dy: 220, x: [-4200, 6000], y: [-4600, 4400], clear: [-470, 470, -560, 500], step: 150, fade: [1600, 5600] };
  const FARM_Q = { main: [0.846, 0.866], head: [0.862, 0.886], latT: 0.03, grow: 0.024, soil: [0.852, 0.9], glow: [0.872, 0.93], flow: [0.872, 0.905] };
  let field = null;
  const PLANT_VS = [
    "attribute vec3 aRoot; attribute vec2 aCorner; attribute float aH, aW, aT0, aArt, aFlip, aDim, aMask; attribute vec3 aTint;",
    "uniform float uQ, uGrow;",
    "varying vec2 vUv; varying vec3 vTint; varying float vA;",
    "void main() {",
    "  float g = clamp((uQ - aT0) / uGrow, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);",
    "  float h = aH * (0.12 + 0.88 * g);",
    "  vec4 r = modelViewMatrix * vec4(aRoot, 1.0);",
    "  r.xy += vec2(aCorner.x * aH * aW, aCorner.y * h);",
    "  float col = mod(aArt, 3.0), row = floor(aArt / 3.0), cx = aFlip > 0.5 ? 0.5 - aCorner.x : aCorner.x + 0.5;",
    "  vUv = vec2((col + cx) / 3.0, 1.0 - (row + 1.0 - aCorner.y) / 3.0);",
    "  vTint = aTint; vA = min(1.0, g * 1.6) * aDim * aMask;",
    "  gl_Position = projectionMatrix * r;",
    "}"].join("\n");
  const PLANT_FS = [
    "uniform sampler2D uAtlas; varying vec2 vUv; varying vec3 vTint; varying float vA;",
    "void main() { vec4 t = texture2D(uAtlas, vUv); float a = t.a * vA; if (a < 0.004) discard;",
    "  gl_FragColor = vec4(pow(t.rgb, vec3(2.2)) * vTint, a); }"].join("\n");
  // the drip tape: a flat ribbon on the soil, drawn on from its feed (aS: mm from the feed; aL: its length; aT: when the
  // liquid reaches its feed), with droplets travelling out along it
  const TAPE_VS = [
    "attribute float aS, aL, aT, aSide, aMask, aDim;",
    "uniform float uQ, uLatT;",
    "varying float vS, vHead, vSide, vA, vDim;",
    "void main() {",
    "  float k = clamp((uQ - aT) / uLatT, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);",
    "  vS = aS; vHead = k * aL + 0.001; vSide = aSide; vA = aMask; vDim = aDim;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"].join("\n");
  const TAPE_FS = [
    "uniform float uTime, uFlow; uniform vec3 uGreen;",
    "varying float vS, vHead, vSide, vA, vDim;",
    "void main() {",
    "  if (vS > vHead) discard;",
    "  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));",
    "  float ph = fract((vS - uTime * 60.0) / 120.0), drop = smoothstep(0.0, 0.04, ph) * (1.0 - smoothstep(0.07, 0.15, ph));",
    "  float hd = exp(-pow((vHead - vS) / 40.0, 2.0)) * step(vHead, 1e5);",
    // (black PE tape with a faint sheen down its middle; droplets travel out along it, brightest near the machine)
    "  float sheen = pow(1.0 - abs(vSide), 2.0);",
    "  vec3 c = vec3(0.014, 0.016, 0.015) + vec3(0.03, 0.036, 0.034) * sheen * vDim + uGreen * (drop * uFlow * 0.38 + hd * 0.35) * vDim * vDim * vDim;",
    "  gl_FragColor = vec4(c * edge * vA, 0.85 * edge * vA * mix(0.35, 1.0, vDim));",
    "}"].join("\n");
  function buildField(c) {
    const fz = c.floorZ, F = FARM, rnd = outroRnd(9001), Q = FARM_Q;
    // the clear main line: the outlet's floor run along y OUT_YO to the header (a real tube; the rest is tape)
    const mk = (pts, rOut, rIn) => {
      const curve = new B2.Poly(pts.map((q) => [q.x, q.y, q.z])), segs = Math.max(8, Math.ceil(curve.L / 12));
      const mat = B2.flowMat(B2.LOOPS.pro.col, B2.LOOPS.pro.hot); mat.uniforms.uLen.value = curve.L; patchFlow(mat); mat.uniforms.uPer.value = 70;
      const core = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, rIn, 8, false), mat); core.renderOrder = 1; c.scene.add(core);
      const wm = c.model.tubes.o1.wall.material.clone(); wm.uniforms = THREE.UniformsUtils.clone(c.model.tubes.o1.wall.material.uniforms); wm.uniforms.uLen.value = curve.L;
      const wall = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, rOut, 8, false), wm); wall.renderOrder = 3; c.scene.add(wall);
      core.visible = wall.visible = false;
      return { core: core, wall: wall, L: curve.L, rOut: rOut, rIn: rIn };
    };
    const tubes = [mk([new V3(OUT_FX, OUT_YO, fz + 3.6), new V3(F.hx - 4, OUT_YO, fz + 3.6)], 3.4, 2.2 / 0.92)];
    // rows: y = OUT_YO + k dy (the main line is the row at k 0); the header along x = hx from OUT_YO both ways
    const rows = []; for (let y = OUT_YO + Math.ceil((F.y[0] - OUT_YO) / F.dy) * F.dy; y <= F.y[1]; y += F.dy) rows.push(y);
    const headLen = Math.max(OUT_YO - F.y[0], F.y[1] - OUT_YO), qHead = (y) => Q.head[0] + (Q.head[1] - Q.head[0]) * Math.abs(y - OUT_YO) / headLen;
    const inClearY = (y) => y > F.clear[2] && y < F.clear[3];
    // tape geometry: quads every 120 mm, 7 mm wide, on the soil
    const tp = [], ta = { aS: [], aL: [], aT: [], aSide: [], aMask: [], aDim: [] }, tIdx = [];
    const tapeRun = (x0, y0, x1, y1, t0, L0) => {        // a straight run from (x0, y0), its feed reached at t0, s from L0
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 120)), dx = (x1 - x0) / L, dy = (y1 - y0) / L, w = 5;
      for (let i = 0; i <= n; i++) { const s = L * i / n, x = x0 + dx * s, y = y0 + dy * s, d = Math.hypot(x - 0, y - 0), dim = 1 - ss(F.fade[0], F.fade[1], d);
        [-1, 1].forEach((sd) => { tp.push(x - dy * w * sd, y + dx * w * sd, fz + 1.2); ta.aS.push(L0 + s); ta.aL.push(L0 + L); ta.aT.push(t0); ta.aSide.push(sd); ta.aMask.push(1); ta.aDim.push(dim); });
        if (i) { const b = tp.length / 3 - 4; tIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    };
    tapeRun(F.hx, OUT_YO, F.hx, F.y[0], Q.head[0], 0); tapeRun(F.hx, OUT_YO, F.hx, F.y[1], Q.head[0], 0);
    const plants = [];
    rows.forEach((y) => {
      const t0 = qHead(y), segs = inClearY(y) ? [[F.hx, F.x[1]], [F.hx, F.clear[1]]] : [[F.hx, F.x[1]], [F.hx, F.x[0]]];
      segs.forEach(([xa, xb]) => {
        if (Math.abs(xb - xa) < 50) return;
        tapeRun(xa, y, xb, y, t0, 0);
        const L = Math.abs(xb - xa), dir = Math.sign(xb - xa);
        for (let d = 50 + rnd() * 60; d < L; d += F.step * (0.75 + rnd() * 0.5)) {
          const x = xa + dir * d, py = y + 26 + (rnd() - 0.5) * 18, dist = Math.hypot(x, py);
          if (x > F.clear[0] && x < F.clear[1] && py > F.clear[2] && py < F.clear[3]) continue;
          const dim = (1 - ss(F.fade[0], F.fade[1], dist)) * (0.75 + 0.25 * rnd());
          if (dim < 0.03) continue;
          plants.push({ x: x, y: py, z: fz, h: (120 + rnd() * 80), w: 0.9 + rnd() * 0.25, t0: t0 + Q.latT * (d / L) * 0.95, art: Math.floor(rnd() * 9), flip: rnd() < 0.5 ? 1 : 0,
                        tint: [0.4 + rnd() * 0.1, 0.46, 0.36 + rnd() * 0.08], dim: dim });
        }
      });
    });
    // the plants: one mesh, four corners each
    const N = plants.length, A = (n) => new Float32Array(N * 4 * n), root = A(3), corner = A(2), aH = A(1), aW = A(1), aT0 = A(1), aArt = A(1), aFlip = A(1), aDim = A(1), aMask = A(1), aTint = A(3), idx = new Uint32Array(N * 6);
    const CR = [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]];
    plants.forEach((P, i) => { for (let k = 0; k < 4; k++) { const j = i * 4 + k; root.set([P.x, P.y, P.z], j * 3); corner.set(CR[k], j * 2); aH[j] = P.h; aW[j] = P.w; aT0[j] = P.t0; aArt[j] = P.art; aFlip[j] = P.flip; aDim[j] = P.dim; aMask[j] = 1; aTint.set(P.tint, j * 3); }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6); });
    const pg = new THREE.BufferGeometry();
    [["aRoot", root, 3], ["aCorner", corner, 2], ["aH", aH, 1], ["aW", aW, 1], ["aT0", aT0, 1], ["aArt", aArt, 1], ["aFlip", aFlip, 1], ["aDim", aDim, 1], ["aMask", aMask, 1], ["aTint", aTint, 3]].forEach(([n, a, k]) => pg.setAttribute(n, new THREE.BufferAttribute(a, k)));
    pg.setAttribute("position", new THREE.BufferAttribute(root, 3)); pg.setIndex(new THREE.BufferAttribute(idx, 1));
    // the atlas: nine painted clumps
    const at = document.createElement("canvas"); at.width = at.height = 768; const ag = at.getContext("2d");
    for (let k = 0; k < 9; k++) ag.drawImage(shootTexture(k + 1, k % 3 === 0).image, (k % 3) * 256, Math.floor(k / 3) * 256);
    const atlas = new THREE.CanvasTexture(at); atlas.anisotropy = 4;
    const pm = new THREE.ShaderMaterial({ uniforms: { uQ: { value: 0 }, uGrow: { value: Q.grow }, uAtlas: { value: atlas } }, vertexShader: PLANT_VS, fragmentShader: PLANT_FS,
      transparent: true, depthWrite: false });
    const pmesh = new THREE.Mesh(pg, pm); pmesh.frustumCulled = false; pmesh.renderOrder = 2; pmesh.visible = false; c.scene.add(pmesh);
    // the tape: one mesh
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tp), 3));
    Object.keys(ta).forEach((n) => tg.setAttribute(n, new THREE.BufferAttribute(new Float32Array(ta[n]), 1))); tg.setIndex(tIdx);
    const tm = new THREE.ShaderMaterial({ uniforms: { uQ: { value: 0 }, uLatT: { value: Q.latT }, uTime: { value: 0 }, uFlow: { value: 0 }, uGreen: { value: RQ.srgb(GREEN) } },
      vertexShader: TAPE_VS, fragmentShader: TAPE_FS, transparent: true, depthWrite: false, premultipliedAlpha: true, side: THREE.DoubleSide });   // (its quads wind clockwise from above)
    const tmesh = new THREE.Mesh(tg, tm); tmesh.frustumCulled = false; tmesh.renderOrder = 0; tmesh.visible = false; c.scene.add(tmesh);
    // the soil: lit by the studio (it takes the machine's shadow), darkening and fading with distance into the night
    const S = 12000, soilTex = soilTexture(); soilTex.repeat.set(S / 880, S / 880); soilTex.offset.set(0, (OUT_YO - F.dy * 0.5 + S / 2) / 880 % 1);
    const sm = new THREE.MeshLambertMaterial({ map: soilTex, transparent: true, opacity: 0, depthWrite: false });
    const sU = { uFar: { value: new THREE.Vector2(500, 4600) } };
    sm.onBeforeCompile = (sh) => { sh.uniforms.uFar = sU.uFar;
      sh.vertexShader = "varying vec2 vWXYs;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vWXYs = (modelMatrix * vec4(transformed, 1.0)).xy;");
      sh.fragmentShader = "uniform vec2 uFar; varying vec2 vWXYs;\n" + sh.fragmentShader.replace("#include <map_fragment>",
        "#include <map_fragment>\n float dS = length(vWXYs); diffuseColor.rgb *= mix(1.0, 0.08, smoothstep(uFar.x, uFar.y, dS)); diffuseColor.a *= 1.0 - smoothstep(uFar.y, uFar.y + 1800.0, dS);"); };
    sm.customProgramCacheKey = () => "v4soil";
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(S, S), sm); soil.position.set(0, 0, fz + 0.15); soil.receiveShadow = true; soil.renderOrder = -0.9; soil.visible = false; c.scene.add(soil);
    // the horizon: a faint night glow low on a far cylinder (additive)
    const hg = new THREE.Mesh(new THREE.CylinderGeometry(8200, 8200, 3000, 64, 1, true).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uCol: { value: RQ.srgb("#2c4a5e") }, uZ0: { value: fz } },
      vertexShader: "varying float vZ; void main(){ vZ = (modelMatrix * vec4(position, 1.0)).z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform float uA, uZ0; uniform vec3 uCol; varying float vZ; void main(){ float h = vZ - uZ0; float g = (exp(-pow((h - 260.0) / 420.0, 2.0)) * 0.8 + exp(-max(h, 0.0) / 1600.0) * 0.22) * smoothstep(-60.0, 240.0, h); gl_FragColor = vec4(uCol * g * uA, 1.0); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }));
    hg.position.set(0, 0, fz + 1450); hg.renderOrder = -2; hg.visible = false; c.scene.add(hg);
    field = { tubes: tubes, plants: plants, pmesh: pmesh, tmesh: tmesh, soil: soil, glow: hg, maskKey: "" };
  }
  // the masks, from the end frame's own camera (per aspect): no plant or tape behind the end line or the honesty key,
  // none in the near foreground, none in front of the machine
  const _fm = new THREE.PerspectiveCamera(30, 1, 1, 30000), _fv = new V3();
  function fieldMasks(c) {
    const st = camState(c, 1, {}); _fm.aspect = c.aspect; applyCam(_fm, st);
    const W = c.W, H = c.H, boxes = [];
    ["endline", "keynote"].forEach((id) => { const el = document.getElementById(id); if (!el) return; const r = el.getBoundingClientRect(), sr = c.canvas.getBoundingClientRect();
      if (r.width < 2) return; boxes.push([(r.left - sr.left - 36) / W * 2 - 1, (r.right - sr.left + 36) / W * 2 - 1, 1 - (r.bottom - sr.top + 30) / H * 2, 1 - (r.top - sr.top - 30) / H * 2]); });
    // the machine on screen, and how far it is
    const mb = c.model.box, mp = []; [0, 1].forEach((i) => [0, 1].forEach((j) => [0, 1].forEach((k) => { _fv.set(i ? mb.max.x : mb.min.x, j ? mb.max.y : mb.min.y, k ? mb.max.z : mb.min.z).project(_fm); mp.push([_fv.x, _fv.y]); })));
    const mx0 = Math.min(...mp.map((q) => q[0])) - 0.04, mx1 = Math.max(...mp.map((q) => q[0])) + 0.04, my0 = Math.min(...mp.map((q) => q[1])) - 0.04, my1 = Math.max(...mp.map((q) => q[1])) + 0.04;
    const mDist = _fm.position.distanceTo(mb.getCenter(new V3()));
    const softIn = (x, y, b, m) => Math.min(ss(b[0] - m, b[0], x), 1 - ss(b[1], b[1] + m, x), ss(b[2] - m, b[2], y), 1 - ss(b[3], b[3] + m, y));
    const maskAt = (x, y, z, h) => {
      _fv.set(x, y, z).project(_fm); const bx = _fv.x, by = _fv.y; _fv.set(x, y, z + h).project(_fm); const ty = _fv.y;
      let m = 1; const yy = (by + ty) / 2;
      boxes.forEach((b) => { m = Math.min(m, 1 - Math.max(softIn(bx, by, b, 0.06), softIn(bx, ty, b, 0.06), softIn(bx, yy, b, 0.06))); });
      const d = _fm.position.distanceTo(_fv.set(x, y, z));
      m *= ss(1000, 1400, d);                                                    // no giant plants in the near foreground
      if (d < mDist && bx > mx0 && bx < mx1 && Math.max(by, ty) > my0 && by < my1) m *= 0; // none in front of the machine
      return m; };
    const pa = field.pmesh.geometry.attributes.aMask;
    field.plants.forEach((P, i) => { const m = maskAt(P.x, P.y, P.z, P.h); for (let k = 0; k < 4; k++) pa.array[i * 4 + k] = m; }); pa.needsUpdate = true;
    const tpos = field.tmesh.geometry.attributes.position, tma = field.tmesh.geometry.attributes.aMask;
    for (let i = 0; i < tpos.count; i++) tma.array[i] = maskAt(tpos.getX(i), tpos.getY(i), tpos.getZ(i), 0); tma.needsUpdate = true;
  }
  function fieldAt(c, q, clock) {
    if (!field) return;
    const on = q > 0.845, Q = FARM_Q, flow = 0.9 * qs(Q.flow[0], Q.flow[1], q), tm = q * FLOW_K;   // (E4: scroll only)
    if (on && field.maskKey !== camKey + "|" + c.W + "x" + c.H) { field.maskKey = camKey + "|" + c.W + "x" + c.H; fieldMasks(c); }
    { const t = field.tubes[0], k = qs(Q.main[0], Q.main[1], q), u = t.core.material.uniforms, w = t.wall.material.uniforms;
      t.core.visible = t.wall.visible = on && k > 0.002;
      u.uDraw.value = w.uDraw.value = k; u.uTrail.value = 0.26; u.uTrailEnd.value = k * t.L + 2; u.uNeut.value = 0; u.uLit.value = 1;
      u.uParcel.value = -1e5; u.uPulseA.value = 0; u.uGlow.value = 0; u.uBase.value = 0.85; u.uFlow.value = flow; u.uTime.value = tm; u.uSpeed.value = 45; w.uA.value = 0.6; }
    field.pmesh.visible = field.tmesh.visible = on;
    field.pmesh.material.uniforms.uQ.value = q; field.tmesh.material.uniforms.uQ.value = q;
    field.tmesh.material.uniforms.uTime.value = tm; field.tmesh.material.uniforms.uFlow.value = flow;
    const sk = qs(Q.soil[0], Q.soil[1], q); field.soil.visible = on && sk > 0.002; field.soil.material.opacity = sk;
    // the studio floor gives way to the soil: its grid goes with it
    if (c.floor) c.floor.material.emissiveIntensity = 0.3 * (1 - sk);
    const gk = qs(Q.glow[0], Q.glow[1], q); field.glow.visible = on && gk > 0.002; field.glow.material.uniforms.uA.value = 0.32 * gk;
  }

  // ---- E1 (owner, 14:20: "remove that pole", owner/14-remove-pole.png): the thin grey rod in front of the protectant
  // bottle is the sampler's aluminium post (x -96, y -102, from the deck at z 131 to 285). Only the sampler's clip holds
  // on to it (a nylon ring round it at z 236-244); the sample tube stands in its own white holder on the deck. The post
  // and the clip's ring round it are removed at load; the rest of the clip stays on the tube
  function removeSamplerPost(c) {
    const P = c.model.parts.sampler; if (!P) return;
    P.meshes.slice().forEach((me) => { const n = me.userData.matName || "";
      if (/anodised aluminium/.test(n)) { me.parent.remove(me); P.meshes.splice(P.meshes.indexOf(me), 1); return; }
      if (/nylon/.test(n)) { const r = splitByComponent(me, (b) => b.max.x - b.min.x < 8); if (r.take) me.geometry = r.rest; } });
  }
  // ---- E2 (owner: "the very last part of scene before scrolling have cover pop back on"): the CAD has no cover on the
  // open (-x) side, and every case panel is back on by the end, so the cover is a smoked-glass side panel (illustrative,
  // the PC-tower case's own kind) that pops on over the open side once the end line is up: the last frame is the closed
  // product, with the loops still running inside. A short ease-out-back from the camera's side, its opacity coming up
  // over the first half (no one-frame appearance)
  const COVER_Q = [0.948, 0.968];
  let cover = null;
  function buildCover(c) {
    const g = new THREE.Group(), y0 = -205, y1 = 190, z0 = 76, z1 = 629, x = -113.5, W = y1 - y0, H = z1 - z0;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshPhysicalMaterial({ color: RQ.srgb("#0f141a"), roughness: 0.3, metalness: 0, reflectivity: 0.18,
      transparent: true, opacity: 0, clearcoat: 0, envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide }));   // (smoked glass with only a faint sheen: any real specular put the key light on it as one glowing dot)
    glass.rotation.set(Math.PI / 2, -Math.PI / 2, 0); glass.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); glass.renderOrder = 5; g.add(glass);
    const fm = new THREE.MeshStandardMaterial({ color: RQ.srgb("#0c0e11"), roughness: 0.45, metalness: 0.3, transparent: true, opacity: 0 }), w = 9;
    [[W, w, (y0 + y1) / 2, z1 - w / 2], [W, w, (y0 + y1) / 2, z0 + w / 2], [w, H, y0 + w / 2, (z0 + z1) / 2], [w, H, y1 - w / 2, (z0 + z1) / 2]].forEach(([a, b, yc, zc]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3, a, b), fm); m.position.set(x - 0.5, yc, zc); m.renderOrder = 5; g.add(m); });
    g.visible = false; c.scene.add(g);
    cover = { g: g, glass: glass, fm: fm };
  }
  function coverAt(q) {
    if (!cover) return;
    const t = sat((q - COVER_Q[0]) / (COVER_Q[1] - COVER_Q[0])), s = 1.4, u = t - 1, e = 1 + (s + 1) * u * u * u + s * u * u;   // ease-out-back
    cover.g.visible = t > 0.001; if (!cover.g.visible) return;
    cover.g.position.x = -120 * (1 - e);
    const a = ss(0, 0.5, t); cover.glass.material.opacity = 0.62 * a; cover.fm.opacity = a; cover.fm.transparent = a < 0.999; cover.fm.depthWrite = a >= 0.999;
  }
  // ---- E3 (owner: "when scrolling for the shell side have protectant bottle fill up"): the protectant bottle's liquid
  // rises from its level in the CAD (top z 225) to well filled (z 254) as the protectant crosses and comes in (q .786-.858),
  // with a meniscus ring at its surface; before .78 nothing changes (the opening is as approved)
  const FILL_Q = [0.786, 0.858], FILL_TOP = 254;
  let fillLiq = null;
  function buildFill(c) {
    const P = c.model.parts["protectant liquid"]; if (!P) return;
    const b = P.box, r = (b.max.x - b.min.x) / 2 - 0.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 1.1, 8, 64), new THREE.MeshBasicMaterial({ color: RQ.srgb("#dfe9ee"), transparent: true, opacity: 0, depthWrite: false }));
    ring.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z); ring.renderOrder = 4.25; ring.visible = false; c.scene.add(ring);
    fillLiq = { P: P, z0: b.min.z, z1: b.max.z, ring: ring };
  }
  function fillAt(q) {
    if (!fillLiq) return;
    const f = qs(FILL_Q[0], FILL_Q[1], q), top = lerp(fillLiq.z1, FILL_TOP, f), k = (top - fillLiq.z0) / (fillLiq.z1 - fillLiq.z0);
    fillLiq.P.meshes.forEach((me) => { me.scale.z = k; me.position.z = fillLiq.z0 * (1 - k); });
    const ra = 0.32 * qband(q, FILL_Q[0] - 0.008, FILL_Q[0] + 0.004, 2, 3);
    fillLiq.ring.visible = ra > 0.003; fillLiq.ring.material.opacity = ra; fillLiq.ring.position.z = top - 0.4;
  }

  // the tube round the pump's rotor (the route's own arc), pinched where each roller presses it
  let pumpTube = null, ROLL0 = 0;
  function buildPumpTube(c) {
    const m = RC.marks, pts = [];
    for (let s = m.arcIn - 6; s <= m["arcOut"] + 6; s += 1.5) pts.push(RC.at(s));
    const curve = new B2.Poly(pts.map((q) => [q.x, q.y, q.z]));
    const TS = 160, RS = CORE_RS, geo = new THREE.TubeGeometry(curve, TS, TUBE_R, RS, false);
    const ctr = new Float32Array((TS + 1) * (RS + 1) * 3), ang = new Float32Array((TS + 1) * (RS + 1));
    for (let i = 0; i <= TS; i++) {
      const q = curve.getPointAt(i / TS), a = Math.atan2(q.z - ROT_C[1], q.y - ROT_C[0]);
      for (let j = 0; j <= RS; j++) { const k = i * (RS + 1) + j; ctr[k * 3] = q.x; ctr[k * 3 + 1] = q.y; ctr[k * 3 + 2] = q.z; ang[k] = a; }
    }
    geo.setAttribute("aCtr", new THREE.BufferAttribute(ctr, 3)); geo.setAttribute("aAng", new THREE.BufferAttribute(ang, 1));
    const mat = B2.flowMat(B2.LOOPS.cul.col, B2.LOOPS.cul.hot);
    mat.uniforms.uLen.value = curve.L; mat.uniforms.uRot = { value: 0 }; mat.uniforms.uPinch = { value: 0.62 };
    mat.uniforms.uHub = { value: new THREE.Vector2(ROT_C[0], ROT_C[1]) }; mat.uniforms.uShift = { value: ROT_R - (ROT_REACH + TUBE_R * 0.38) };
    patchFlow(mat);
    mat.vertexShader = [
      "attribute vec3 aCtr; attribute float aAng; uniform float uRot, uPinch, uShift, uR, uPxH; uniform vec2 uHub;",
      "varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vT; varying float vPx;",
      "void main() {",
      "  float pin = 0.0;",
      "  for (int k = 0; k < 3; k++) { float d = aAng - (uRot + float(k) * 2.0943951); d = atan(sin(d), cos(d)); pin = max(pin, exp(-pow(d / 0.15, 2.0))); }",
      // round 4b: at a roller the tube is pressed flat between the roller and the housing: its radial thickness to 38 %,
      // a little wider along the axis, and its centre moved in so its inner face stays on the rollers' reach
      "  vec3 d = position - aCtr; vec2 er = normalize(aCtr.yz - uHub); float dr = dot(d.yz, er); vec3 dt = d - vec3(0.0, er * dr);",
      "  vec3 p = aCtr + vec3(0.0, er * (dr * (1.0 - uPinch * pin) - uShift * pin)) + dt * (1.0 + 0.3 * pin);",
      // (render pass: the per-pixel normal from the pinched centre, and the arc's direction, as the other tubes')
      "  vec3 cP = aCtr - vec3(0.0, er * uShift * pin);",
      "  vUv = uv; vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = mv.xyz - (modelViewMatrix * vec4(cP, 1.0)).xyz; vT = normalMatrix * vec3(0.0, -er.y, er.x); vV = -mv.xyz; " + TUBE_PX_VS + " gl_Position = projectionMatrix * mv;",
      "}"].join("\n");
    upgradeTubeMats({ material: mat }, null, 0, TUBE_R, TUBE_R);
    pumpTube = new THREE.Mesh(geo, mat); pumpTube.renderOrder = 1; c.scene.add(pumpTube);
    pumpTube.s0 = m.arcIn - 6; pumpTube.L = curve.L;
    // the rollers' angle at rest, read off the rotor's own geometry (its three outermost lobes)
    const R = c.model.parts.rotor;
    if (R) {
      let best = 0, bestA = 0;
      R.meshes.forEach((me) => { const a = me.geometry.attributes.position.array; for (let k = 0; k < a.length; k += 3) { const dy = a[k + 1] - ROT_C[0], dz = a[k + 2] - ROT_C[1], r = dy * dy + dz * dz; if (r > best) { best = r; bestA = Math.atan2(dz, dy); } } });
      ROLL0 = bestA;
    }
  }

  // ---- the one fibre (illustrative size), lit as the culture's. Its inner wall is the close-up's own skin shader, fed
  // macro positions mapped into micro units, so the scale jump is one material (the same pores, light and haze)
  let fibre = null;
  function poreTexture(spacing, rad, tint, bg) {
    const S = 2048, cv = document.createElement("canvas"); cv.width = cv.height = S; const x = cv.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, S, S);
    let sd = 17; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let gx = 0; gx < S; gx += spacing) for (let gy = 0; gy < S; gy += spacing) {
      const px = gx + spacing / 2 + (rr() - 0.5) * spacing * 0.42, py = gy + spacing / 2 + (rr() - 0.5) * spacing * 0.42;
      x.fillStyle = tint; x.beginPath(); x.arc(px, py, rad, 0, 6.2832); x.fill();
    }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }
  function buildFibre(c) {
    const len = 190, z0 = 246;
    const g = new THREE.Group(); g.position.set(FIBX, AX[1], z0 + len / 2);
    const geo = new THREE.CylinderGeometry(FR, FR, len, 64, 1, true).rotateX(Math.PI / 2);
    const texO = poreTexture(32, 2.6, "#4a4a47", "#e2e2dd"); texO.repeat.set(3, 53);       // (round 4b: off-white, not beige)
    // the fibre's outside: a glassy PES tube (bright at its edges, clear through its middle), so the culture inside and
    // the inner wall read through it (round-2 visual 4: it was a flat white stripe)
    const tubeVS = "varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }";
    const outer = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { uA: { value: 1 }, uCol: { value: RQ.srgb("#ecece8") } }, vertexShader: tubeVS,
      fragmentShader: "uniform float uA; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV + vec3(1e-6)))); float e = pow(clamp(f, 0.0, 1.0), 2.2); gl_FragColor = vec4(uCol * (0.25 + 1.1 * e), uA * (0.08 + 0.75 * e)); }",
      transparent: true, depthWrite: false, side: THREE.FrontSide }));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(FR, FR, len, 256, 1, true).rotateX(Math.PI / 2), micro.innerMaterial(z0 + len / 2));
    inner.frustumCulled = false;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(FR * 0.82, FR * 0.82, len - 1, 32, 1, true).rotateX(Math.PI / 2),
      // the culture in it: thickest (most colour) through the middle, thinning to the walls
      new THREE.ShaderMaterial({ uniforms: { uA: { value: 0.35 }, uCol: { value: RQ.srgb("#c98a34") } }, vertexShader: tubeVS,
        fragmentShader: "uniform float uA; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = abs(dot(normalize(vN), normalize(vV + vec3(1e-6)))); gl_FragColor = vec4(uCol * (0.55 + 0.6 * f), uA * (0.25 + 0.75 * pow(clamp(f, 0.0, 1.0), 0.6))); }",
        transparent: true, depthWrite: false, side: THREE.FrontSide }));
    inner.renderOrder = 2; core.renderOrder = 3; outer.renderOrder = 4;
    g.add(inner); g.add(core); g.add(outer);
    c.scene.add(g);
    // round 4b (QA 1, the snap at the near wall): the culture's core is drawn from outside by its front faces; once the
    // camera is inside it (r < its radius) those are behind the camera and the amber wash vanished in one step. A
    // back-face twin (the same uniforms) takes over inside, so the wash is one layer either way and continuous
    const coreB = new THREE.Mesh(core.geometry, new THREE.ShaderMaterial({ uniforms: core.material.uniforms, vertexShader: core.material.vertexShader,
      fragmentShader: core.material.fragmentShader, transparent: true, depthWrite: false, side: THREE.BackSide }));
    coreB.renderOrder = 3; coreB.visible = false; g.add(coreB);
    fibre = { g: g, outer: outer, inner: inner, core: core, coreB: coreB, rCore: FR * 0.82 };
    // the real fibres where the one fibre stands are cut out of the bundle (it replaces one of them)
    const F = c.model.parts.fibres;
    if (F) F.meshes.forEach((me) => {
      const m = me.material, prev = m.onBeforeCompile, k0 = m.customProgramCacheKey ? m.customProgramCacheKey() : "";
      m.onBeforeCompile = function (sh, r) {
        if (prev) prev.call(this, sh, r);
        sh.vertexShader = "varying vec2 vWXY;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vWXY = (modelMatrix * vec4(transformed, 1.0)).xy;");
        sh.fragmentShader = "varying vec2 vWXY;\n" + sh.fragmentShader.replace("void main() {", "void main() {\n if (length(vWXY - vec2(" + FIBX.toFixed(1) + ", " + AX[1].toFixed(1) + ")) < " + (FR + 1.1).toFixed(2) + ") discard;")
          // (round 4b, visual 1: the fibres deeper in the bundle are darker, so the gaps between the outer ones read deep)
          .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor.rgb *= mix(0.42, 1.0, smoothstep(10.0, 22.5, length(vWXY - vec2(" + AX[0].toFixed(1) + ", " + AX[1].toFixed(1) + "))));");
      };
      m.customProgramCacheKey = () => k0 + "|v4hole";
      m.needsUpdate = true;
    });
  }
  // ------------------------------------------------------------------------------------- the anchors of each tube
  const ANCHOR = [[/^vessel_/, "vessel"], [/^pc_/, "pumpbox"], [/^v4_/, "v4"], [/^v5_/, "valve5"], [/^mem_/, "membrane"], [/^v7_/, "valve7"],
    [/^sc1_/, "sc1"], [/^sc2_/, "sc2"], [/^sc4_/, "sc4"], [/^koh_/, "koh"], [/^pk_/, "pump_k"], [/^pp_/, "pump_p"], [/^pt_(pt\d)/, "pt_$1"],
    [/^prot_/, "protectant"], [/^output$/, "output"], [/^filter$/, "air_filter"], [/^sampler/, "sampler"]];
  function anchorPart(a) { for (const [re, id] of ANCHOR) { const mm = a.match(re); if (mm) return id.indexOf("$1") >= 0 ? id.replace("$1", mm[1]) : id; } return null; }

  // ------------------------------------------------------------------------------------------------- state
  let micro = null;
  // the parcel's head while it leads the camera into the fibre: capped on screen (about 210 px of sprite on desk, 170 on
  // phone, at the dive's 34 deg); the close-up draws its glow with the same factor, so the hand-off matches
  // (round 4b, visual 1: capped at 110 px desk, 90 px phone; it was a 220 px glow disc)
  const headK = (c) => Math.min(0.42, (c.aspect < 0.8 ? 90 : 110) * 2 * Math.tan(17 * Math.PI / 180) / Math.max(1, c.H));
  let parcel = null, parcelCore = null, parcelG = null, plight = null, beam = null, motes = null, marks = {}, frameEl, stats, endline, keynote;
  let V4CUT = null, aurora = null;
  let partList = [], v4Clip = null, rotor = null, info = null, trans = null, stubTube = null, scrim = null, glCanvas = null;
  let route = null, routeLi = [], routeDot = null, routeFill = null, routeM = null, routeMT = null, routeMBar = null;
  const _pp = new V3(), _pg = new V3();

  B2.boot({
    // (round 4b: the capture clock puts the parcel's slow pulse at its brightest: sin(2.4 x 11.127) = 1; 12.5 was its dimmest)
    model: "b2/", caps: CAPS, titleOut: 0.06, warp: warpP, captureClock: 11.127,
    ready: function (c) {
      c.rend.localClippingEnabled = true;
      moveOutputLow(c);                 // (D3: before the routes, so the green route follows the new o1)
      info = buildRoutes(c);
      patchTubes(c);
      polishMaterials(c);
      buildPumpTube(c);
      // the fibre bundle: matte Lambert instead of the physical model. It is one 14k-triangle mesh drawn in index order,
      // so when it fills the frame (the dive) each pixel was shaded through many fibre layers: 20-24 ms frames
      { const F = c.model.parts.fibres; if (F) F.meshes.forEach((me) => {
          // (round 4b, the owner: "make the membrane more white"; visual 3: smooth fibres with per-fibre vertical
          // highlights): Phong, a neutral off-white (a touch cool, so the warm key does not turn it beige in shadow);
          // the radial normals below make each fibre a lit cylinder with a highlight running along it
          const o = me.material, n = new THREE.MeshPhongMaterial({ color: RQ.srgb("#eceeec"), specular: RQ.srgb("#3a3a3a"), shininess: 34 });
          n.userData = Object.assign({}, o.userData, { baseColor: undefined, dk: undefined }); n.userData.baseOpacity = 1; n.userData.baseTransparent = false; n.userData.baseDepthWrite = true;
          me.material = n;
          const g = me.geometry, pa = g.attributes.position, nv = pa.count, vid = new Map(), ids = new Int32Array(nv); let nid = 0;
          for (let k = 0; k < nv; k++) { const key = Math.round(pa.getX(k) * 200) + "," + Math.round(pa.getY(k) * 200) + "," + Math.round(pa.getZ(k) * 200); let id = vid.get(key); if (id === undefined) { id = nid++; vid.set(key, id); } ids[k] = id; }
          const par = new Int32Array(nid); for (let k = 0; k < nid; k++) par[k] = k;
          const fnd = (k) => { while (par[k] !== k) { par[k] = par[par[k]]; k = par[k]; } return k; };
          const ix = g.index.array; for (let t = 0; t < ix.length; t += 3) { const a = fnd(ids[ix[t]]), b = fnd(ids[ix[t + 1]]), d = fnd(ids[ix[t + 2]]); par[a] = b; par[fnd(d)] = fnd(b); }
          const sx = new Float64Array(nid), sy = new Float64Array(nid), sn = new Float64Array(nid);
          for (let k = 0; k < nv; k++) { const r = fnd(ids[k]); sx[r] += pa.getX(k); sy[r] += pa.getY(k); sn[r]++; }
          const nrm = new Float32Array(nv * 3);
          for (let k = 0; k < nv; k++) { const r = fnd(ids[k]), dx = pa.getX(k) - sx[r] / sn[r], dy = pa.getY(k) - sy[r] / sn[r], l = Math.hypot(dx, dy) || 1; nrm[k * 3] = dx / l; nrm[k * 3 + 1] = dy / l; nrm[k * 3 + 2] = 0; }
          g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3)); }); }
      FX.membraneCut(c);
      // round 4b: below the dive's cut the bundle stays white (a pale warm white, its own faint light so the opened
      // bundle reads in the dark); the culture's amber is only in the one fibre's core
      FX.membraneCut(c).uAmb.value = RQ.srgb("#c9c3b6");
      FX.membraneCut(c).uFeather.value = 9;
      // (round 4b, visual 17: the case's LED strips glowed the protectant's green: neutral and dim)
      Object.values(c.model.parts).forEach((P) => { if (!/led strip/i.test(P.id)) return; P.meshes.forEach((me) => { const mt = me.material; if (mt.emissive && mt.userData.emitBase !== undefined) { mt.emissive.copy(RQ.srgb("#c9d3dc")); mt.userData.emitBase *= 0.55; } }); });           // (round 4b, visual 1: the shell's cut feathered over 9 mm)
      // the clear shell: its glass rim plus a faint face (visual 3)
      { const M = c.model.parts.membrane; if (M) M.meshes.forEach((me) => { const g = me.material.userData.glass; if (g) { g.face = 0.05; g.rim = 0.5; } }); }
      // the decks are matte here: in the c6 follow the camera rides just under deck 3 and its sheen flared white
      Object.values(c.model.parts).forEach((P) => { if (!/^deck/.test(P.id)) return;
        P.meshes.forEach((me) => { const mt = me.material; if (mt.roughness !== undefined) mt.roughness = Math.max(mt.roughness, 0.78);
          if (mt.clearcoat !== undefined) mt.clearcoat = 0; mt.envMapIntensity = (mt.envMapIntensity || 1) * 0.35; mt.userData.baseEnv = mt.envMapIntensity; mt.needsUpdate = true; }); });
      micro = V4Micro(c, { FR: FR, CAMW: CAMW, H0: H0, H0p: H0 * CAMWP / CAMW, FZ: FZ, FIBX: FIBX, AX: AX, PARX: PARX, DS: DS, AMBER: AMBER, headK: headK });
      buildFibre(c);
      splitCase(c);
      // round 4b pop fix (the clips, q .797 and .4455): b2-core lets a part cast only while its fade is over 0.6, so a
      // part crossing 0.6 under the light bands switched its shadow on or off in one frame. In V4 no part ever goes
      // see-through, so every visible opaque part casts, always: the caster set no longer depends on p
      Object.values(c.model.parts).forEach((P) => { if (P.hiddenForGood) return; const prev = P.onApply;
        P.onApply = function (dk) { if (prev) prev(dk); P.meshes.forEach((me) => { me.castShadow = me.visible && !me.material.userData.baseTransparent; }); }; });
      // (render pass: the phone's one-frame step at q .8217. The column backplate rests at fade .37 through the dive and the
      // machine's hold, where b2-core draws a part see-through and stops its depth writes, so the sense lines behind it
      // drew over it; at .8217 its fade crossed .45, it turned opaque and hid them in one frame. It keeps writing depth
      // now, so what it hides stays hidden either side of the switch)
      { const BP = c.model.parts["column backplate"]; if (BP) { const prev = BP.onApply; BP.onApply = function (dk) { if (prev) prev(dk); BP.meshes.forEach((me) => { me.material.depthWrite = true; }); }; } }
      c._bp0 = c.backplate.position.clone();
      mountOutput(c);
      alignStopcock(c);
      buildValve5(c);
      // (owner, 10 Oct: "this tube is too obvious it should be behind"): the KOH line runs behind the culture vessel, but
      // the glass and the culture write no depth and drew before the tubes (render order 0 < 1), so the tube drew over
      // them. The bottles' glass and liquids now draw after the tubes' cores and walls: a tube behind is seen through the
      // culture, tinted by it; a tube in front still occludes them (it writes depth)
      // (render pass, 10 Oct: the bottles' glass and liquids were double-sided transparent meshes, drawn in one pass, so
      // their own back faces sorted against their front faces triangle by triangle: dark blotches in the culture. Each
      // is two meshes now: a back-face twin drawn first, then the front faces, glass outside liquid; the twin is one of
      // the part's meshes, so its fade, colour and focus follow the part)
      removeSamplerPost(c);             // (E1)
      bottleTwins(c);
      // the glass at rest dropping its bright rims (round-2 visual 7) never ran: b2-core's glass shader keeps its uniforms
      // on the pack's material, not on each part's clone. Each clone keeps its own now (GLASS_RIM_FIX)
      if (GLASS_RIM_FIX) Object.values(c.model.parts).forEach((P) => P.meshes.forEach((me) => { const mt = me.material;
        if (!mt.userData || !mt.userData.glass || mt.userData.shWrapV4 || !mt.onBeforeCompile) return;
        const prev = mt.onBeforeCompile; mt.onBeforeCompile = function (sh, r) { prev.call(this, sh, r); mt.userData.shader = sh; }; mt.userData.shWrapV4 = 1; }));
      partList = Object.values(c.model.parts).filter((P) => !FX.isCase(P.id) || KEEP[P.id]);
      rotor = c.model.parts.rotor;
      Object.keys(AXIS).forEach((id) => { const P = c.model.parts[id], a = AXIS[id]; if (!P) return;
        P.center = new V3(a[0] === null ? P.center.x : a[0], a[1] === null ? P.center.y : a[1], a[2] === null ? P.center.z : a[2]);
        P.pivot.position.copy(P.center); P.inner.position.copy(P.center).multiplyScalar(-1); });
      // (owner, 10 Oct: "remove wtv that screw is doing in the pump"): the three rollers' axle bolts and their nuts are
      // in the pump box's CAD part, so they stood still while the rotor turned the rollers away from them, and sat in
      // its sweep. They are the rollers' axles: they move to the rotor (components 20 mm from the hub, in front of x -44)
      { const PB = c.model.parts.pumpbox; if (PB && rotor) PB.meshes.slice().forEach((me) => {
          if (!/caseSteel/.test(me.userData.matName || "")) return;
          const r = splitByComponent(me, (b, ct) => b.max.x < -43.9 && Math.abs(Math.hypot(ct.y - ROT_C[0], ct.z - ROT_C[1]) - 20) < 3);
          if (!r.take) return;
          me.geometry = r.rest;
          const m2 = new THREE.Mesh(r.take, me.material); m2.castShadow = me.castShadow; m2.receiveShadow = true; m2.userData.matName = me.userData.matName;
          rotor.inner.add(m2); rotor.meshes.push(m2); rotor._axles = r.nTake; }); }
      parcel = c.glowSprite(AMBER, 26); parcel.material.depthTest = false; parcel.material.color.multiplyScalar(2.2); c.scene.add(parcel);
      parcelCore = c.glowSprite("#ffffff", 8); parcelCore.material.depthTest = false; parcelCore.material.color.multiplyScalar(1.6); c.scene.add(parcelCore);
      parcelG = c.glowSprite(GREEN, 24); parcelG.material.depthTest = false; parcelG.material.color.multiplyScalar(2.0); c.scene.add(parcelG);
      plight = new THREE.PointLight(RQ.srgb("#ffb060"), 0, 50, 2); c.scene.add(plight);
      beam = v4Beam(c);
      // the light that gets through the cell, on to the detector: it dims while culture fills the cell (absorbance)
      // (round 4b: it ends at the detector board, DET_L past the cell, on a small lit spot: the drop across the cell reads)
      { const a = beam.cell.clone(), dir = beam.cell.clone().sub(beam.led).normalize(), L = DET_L;
        const g = new THREE.CylinderGeometry(BEAM_R, BEAM_R, L, 20, 1, true); g.translate(0, L / 2, 0);
        const m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: RQ.srgb(BEAM_HALO) }, uHot: { value: RQ.srgb(BEAM_HOT) }, uA: { value: 0 } },
          vertexShader: BEAM_VS, fragmentShader: BEAM_FS.replace("uniform float uHead;", "const float uHead = 1.0;"),
          transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
        trans = new THREE.Mesh(g, m); trans.position.copy(a); trans.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); trans.renderOrder = 10; c.scene.add(trans);
        trans.det = c.glowSprite(BEAM_HALO, 6); trans.det.material.depthTest = false; trans.det.position.copy(a).addScaledVector(dir, L); c.scene.add(trans.det); }
      // (round 4b: inside the shell, which is 25.5 mm inside; out of the bundle (24.2) and up the gap to the upper port)
      motes = FX.membraneMotes(c, AX, [5, -102, 433], { r0: 17, r1: 24.7, rp: 25.1, fade: true });
      { const g = new THREE.CylinderGeometry(33, 33, 236, 48, 1, true).rotateX(Math.PI / 2);
        aurora = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uPh: { value: 0 }, uCol: { value: RQ.srgb(GREEN).multiplyScalar(0.9) } },
          vertexShader: "varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }",
          fragmentShader: "uniform float uA, uPh; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec2 vU;\n" +
            "void main(){ float f = abs(dot(normalize(vN), normalize(vV + vec3(1e-6)))); float rim = pow(1.0 - f, 1.6);\n" +
            " float y = vU.y, b = 0.7 + 0.3 * sin(vU.x * 12.566 + y * 5.0 + uPh) * sin(vU.x * 18.85 - y * 3.0 + uPh * 0.7 + 1.3);\n" +
            " float v = smoothstep(0.0, 0.3, y) * (1.0 - smoothstep(0.65, 1.0, y));\n" +
            " gl_FragColor = vec4(uCol * uA * (0.3 + 0.7 * rim) * b * v, 1.0); }",
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        aurora.position.set(AX[0], AX[1], 343); aurora.renderOrder = 9; aurora.visible = false; c.scene.add(aurora);
        const F = c.model.parts.fibres; if (F) F.meshes.forEach((me) => { if (me.material.emissive) me.material.emissive.copy(RQ.srgb(GREEN)); }); }   // (fade: no jump at the wrap)
      // the illustrative line on out of the output connector (the green way out leaves the machine)
      { const SD = STUB.slice();                // (C2: the outlet ends on the floor; the drip line and the field take over)
        const curve = new B2.Poly(SD.map((q) => [q.x, q.y, q.z]));
        const mat = B2.flowMat(B2.LOOPS.pro.col, B2.LOOPS.pro.hot); mat.uniforms.uLen.value = curve.L; patchFlow(mat);
        stubTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 2.2, 10, false), mat); stubTube.renderOrder = 1; c.scene.add(stubTube);
        // (round 4b, visual 13: a tube, not a laser: the silicone wall round the green core, drawn on with it)
        const wm = c.model.tubes.o1.wall.material.clone(); wm.uniforms = THREE.UniformsUtils.clone(c.model.tubes.o1.wall.material.uniforms); wm.uniforms.uLen.value = curve.L;
        stubTube.wall = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 3.4, 14, false), wm); stubTube.wall.renderOrder = 3; c.scene.add(stubTube.wall);
        stubTube.s0 = RG.marks.o1 + (RG.marks["o1>"] - RG.marks.o1); }
      // the V4 is cut along its light path for its station, facing the camera (calm camera: the station is seen from the
      // open side now, so the cut is the plane through the beam whose normal points at the station camera, level part
      // only; it sweeps in from the camera's side). V4CUT.n: that normal; a point is cut when n.(x - cell) > the offset
      { const d = beam.cell.clone().sub(beam.led).normalize(), th = SHOTS.v4.yaw * Math.PI / 180;
        const cd = new V3(Math.cos(th), Math.sin(th), 0), n = cd.addScaledVector(d, -cd.dot(d)).normalize();
        V4CUT = { n: n, c0: n.dot(beam.cell) };
        v4Clip = new THREE.Plane(n.clone().negate(), V4CUT.c0 + 400); }
      const V = c.model.parts.v4;
      if (V) V.meshes.forEach((me) => { me.material.clippingPlanes = [v4Clip]; me.material.clipShadows = true; me.material.side = THREE.DoubleSide; me.material.needsUpdate = true; });
      c.extraScenes = [[micro.scene, micro.cam]].concat(micro.extra);
      initLabels(c);
      Array.from(document.querySelectorAll("#hud .cap")).forEach((el, i) => { if (CAPS[i] && CAPS[i].loop) el.classList.add(CAPS[i].loop); });
      frameEl = document.getElementById("frame"); stats = document.getElementById("stats");
      endline = document.getElementById("endline"); keynote = document.getElementById("keynote");
      scrim = document.getElementById("scrim"); glCanvas = document.getElementById("gl");
      route = document.getElementById("route"); routeLi = Array.from(route.querySelectorAll("li")); routeDot = document.getElementById("route-dot"); routeFill = document.getElementById("route-fill");
      routeM = document.getElementById("route-m"); routeMT = document.getElementById("route-m-t"); routeMBar = document.getElementById("route-m-bar");
      c.keyframes = [0, 0.05, 0.08, 0.12, 0.165, 0.2, 0.25, 0.3, 0.36, 0.42, 0.45, 0.49, 0.53, 0.546, 0.556, 0.6, 0.64, 0.655, 0.69, 0.725, 0.76, 0.795, 0.82, 0.86, 0.9, 0.97];
      c.warmPs = [0.003, 0.006, 0.012, 0.02, 0.045, 0.06, 0.09, 0.105, 0.13, 0.15, 0.17, 0.19, 0.2,   // (round 4b: real frames across 0-.2)
                  0.002, 0.01, 0.03, 0.07, 0.1, 0.14, 0.18, 0.23, 0.28, 0.33, 0.38, 0.41, 0.44, 0.47, 0.5, 0.52, 0.54, 0.53, 0.535, 0.54, 0.547, 0.549, 0.58, 0.62, 0.644, 0.646, 0.66, 0.67, 0.676, 0.684, 0.692, 0.7, 0.74, 0.78, 0.8, 0.84, 0.87, 0.94, 0.12, 0.16, 0.42, 0.43, 0.69, 0.71, 0.72, 0.73, 0.75, 0.76, 0.79, 0.81, 0.82, 0.83];
      // upload every texture now (a first sight inside the fibre cost a 67 ms frame)
      [fibre.outer.material.map].concat(micro.textures).forEach((t) => { if (t) c.rend.initTexture(t); });
      buildField(c);
      upgradeTubes(c);
      buildCover(c); buildFill(c);      // (E2, E3)
      if (FOCUS_ON) focSetup(c);
      window.__v4 = { focus: FOCUS_ON, focusState: (p) => focusState(warpP(p)), focusStateQ: focusState, focusDims: focusDims, FOC_R: FOC_R, fibre: fibre, parcel: parcel, parcelCore: parcelCore, c: c, RC: RC, RG: RG, sCul: sCul, sGrn: sGrn, pieces: pieces, check: check, info: info, anchorPart: anchorPart, micro: micro, STRIP: STRIP, BACKON: BACKON, MICRO: MICRO,
                     // (the clip player's hooks take the scroll's p, like renderAt; warp(p) gives the story's own time)
                     // (round 4b, r4 QA 8: inside the close-up's window the camera is the close-up's own, in its units)
                     camState: (p) => { const q = warpP(p), kM = (q - MICRO[0]) / (MICRO[1] - MICRO[0]);
                       if (kM >= 0 && kM < 1) { const r = micro.camAtK(kM); return { micro: true, q: q, pos: r.pos, tgt: r.tgt, up: r.up, fov: 34 }; }
                       return Object.assign(camState(c, q, {}), { micro: false, q: q }); },
                     labelsAt: labelsAt, camBuildMs: () => (CAM ? CAM.ms : null),
                     // round 4b (QA 6): the whole overlay at the scroll's p, without drawing a frame: the captions, the
                     // title and the cue (story-core), the frame, stats, end line, key and scrim, the labels and the route
                     drawDomAt: (p) => { const q = warpP(p), L = labelsAt(p); window.__story.dom(q); sceneDom(c, q); applyLabels(c, L.labels);
                       routeUI(c, q, sCul(q), sGrn(q)); return { p: p, q: q, labels: L.labels, cam: L.cam }; },
                     CAPTURE_CLOCK: 11.127, occ: () => (OCC ? { ms: OCC.ms, legs: OCC.tabs.map((t) => [t.p0, t.p1, t.raw.join("")]) } : null),
                     // the clip player: put every DOM label and the route where they belong at p, without drawing a frame
                     drawLabelsAt: (p) => { const L = labelsAt(p), q = warpP(p); applyLabels(c, L.labels); routeUI(c, q, sCul(q), sGrn(q)); return L; },
                     warp: warpP, unwarp: unwarpP, warpInfo: () => (WARP ? { W: WARP.W, F: WARP.F, level: WARP.level, span: WARP.span, ms: WARP.ms } : null) };
    },
    draw: function (p, clock, c) {
      buildCam(c);
      TUBE_PXH.value = c.comp.sceneRT.height;          // (the tubes' pixel footprint: the scene buffer's height)
      FX.reset(c);
      const port = c.aspect < 0.8;
      c.comp.uniforms.uAurora.value = 0.075;
      const m = RC.marks;
      const sC = sCul(p), sG = sGrn(p);
      RC.at(sC, _pp); RG.at(sG, _pg);

      // 1. the case: off along beat 1, back on along beat 9 (its original parts are never drawn; its pieces are)
      Object.values(c.model.parts).forEach((P) => { if (P.hiddenForGood) P.fade = 0; });
      const u = flyCase(c, p);
      if (outSlide) outSlide.position.y = OUT_SLIDE * ss(0.3, 0.62, u);
      // D1 (owner, 13:50: "don't have this appear until when the box assembles"): the column backplate, a tall plate that
      // read as a case panel beside the membrane, leaves with the case and comes back with it (out the -y end and up,
      // accelerating, a slight turn; drawn until it is far off screen)
      { const BP = c.model.parts["column backplate"]; if (BP) { const t = sat((u - 0.3) / 0.5), e = Math.pow(t, 2.4);
          BP.offset.set(0, -2600 * e, 1300 * e); BP.rot.set(0.5 * e, 0, 0.2 * e); BP.awayV4 = t >= 0.999; } }

      // 2. light, not deletion. allLit: the opening and the ending; otherwise the parcel's neighbourhood and the station
      const allLit = sat(1 - ss(0.07, 0.15, p) + ss(0.852, 0.905, p));
      const stationParts = [
        [band(p, 0.08, 0.11, 0.16, 0.19), ["vessel", "culture", "stand", "drip tray"]],
        [band(p, 0.21, 0.232, 0.266, 0.29), ["pumpbox", "rotor", "deck 2"]],
        [band(p, 0.298, 0.335, 0.38, 0.402), ["v4", "photometer step"]],
        [band(p, 0.46, 0.476, 0.672, 0.69), ["membrane", "valve5", "valve7", "membrane clamp", "sc1"]],
        [band(p, 0.724, 0.74, 0.795, 0.81), ["vessel", "culture", "pumpbox", "rotor", "v4", "valve5", "valve7", "membrane", "fibres"]],
        [band(p, 0.785, 0.8, 0.856, 0.874), ["protectant", "protectant liquid", "sc2", "output", "membrane"]],
      ];
      const lit = {};
      stationParts.forEach(([w, ids]) => ids.forEach((id) => { lit[id] = Math.max(lit[id] || 0, w); }));
      // (round 4b: the bundle is half lit through the dive, so it reads as a white cartridge, not a grey block)
      lit.fibres = Math.max(lit.fibres || 0, 0.6 * band(p, 0.49, 0.508, 0.672, 0.69));
      const wRef = ss(0.79, 0.806, p);            // the culture parcel hands the light to the green one
      partList.forEach((P) => {
        if (P.hiddenForGood) return;
        // (D3: the green parcel now passes low, close to the drip tray and the sampler, where the scroll is quick: its
        // neighbourhood light falls off over 25-260 mm, so no part's light changes by more than ~.03 a step)
        const nC = 1 - ss(25, 150, P.box.distanceToPoint(_pp)), nG = 1 - ss(25, 260, P.box.distanceToPoint(_pg));
        // the bundle the parcel climbs through, and the column's backplate, stay in shadow
        // (no neighbourhood light in the crane-out: the lap is fast there and the ring station lights the loop)
        // (calm camera: at the photometer, seen from the open side, the white pump heads beside it took the light: the
        // station alone is lit there)
        const near = (P.id === "fibres" || P.id === "column backplate") ? 0 : lerp(nC * (1 - ss(0.735, 0.745, p)), nG * ss(0.805, 0.814, p), wRef) * (1 - ss(0.84, 0.88, p)) * (1 - 0.85 * band(p, 0.33, 0.35, 0.38, 0.4));
        const l = Math.max(allLit, lit[P.id] || 0, near * 0.6);
        // far from the parcel the rest sinks deeper (still opaque, colour x ~0.09 at 0.55): a calmer frame round the one
        // thing to watch (round-2 visual 7, clutter)
        const dFar = lerp(P.box.distanceToPoint(_pp), P.box.distanceToPoint(_pg), wRef);
        const rest = lerp(SHADOW, 0.55, (1 - allLit) * ss(160, 480, dFar));
        P.fade = Math.min(P.fade, lerp(rest, 1, l));
      });
      { const bp = c.model.parts["column backplate"]; if (bp) { bp.fade = Math.min(bp.fade, lerp(SHADOW, 0.37, Math.max(band(p, 0.664, 0.696, 0.81, 0.84), wDive(p)))); if (bp.awayV4) bp.fade = 0; } }   // (round 4b: dark through the dive too: it was a beige smear)
      // glass at rest drops its bright rims (round-2 visual 7: every clear tube in shadow drew a white outline)
      partList.forEach((P) => {
        if (P.hiddenForGood) return;
        const lit = sat((P.fade - SHADOW) / (1 - SHADOW));
        P.meshes.forEach((me) => { const sh = me.material.userData.shader, g = me.material.userData.glass;
          if (sh && g && sh.uniforms.uGRim) { sh.uniforms.uGRim.value = lerp(Math.min(0.12, g.rim), g.rim, lit); sh.uniforms.uGRimLight.value = g.rimLight * lit; } });
      });

      // round 4b (B19, r4 B6): the c3 back view sits close behind the vessel's glass, which filled the retina frame twice
      // (double-sided): over q .40-.47 the vessel's glass and culture draw their front faces only (one switch each way,
      // while the camera moves; the programs are compiled under the loader)
      // (render pass: the front faces are their own meshes now, so this hides the back-face twins: no program switch)
      { const one = p > 0.4 && p < 0.505; if (c._glassFront !== one) { c._glassFront = one;
          ["vessel", "culture"].forEach((id) => { const P = c.model.parts[id]; if (P) P.meshes.forEach((me) => { if (me.userData.backTwin) me.material.visible = !one; }); }); } }
      // 3. the camera
      placeCam(c, p); c.cam.updateMatrixWorld();

      // 4. the tubes: never hidden. The loop draws itself: culture tubes ahead of the parcel are neutral, behind it
      // amber; when the ring closes one pulse runs once round it. The green path draws itself the same way.
      FX.run(c, clock, 0, {});
      const neut = ss(0.03, 0.09, p) * (1 - ss(0.86, 0.92, p));       // the owner's opening (and the end) stay amber
      // the ring closes as the parcel reaches the vessel (.738); one pulse runs once round it, slowly enough to follow
      // (round-2 follow finding 6: linear over .738-.786, wider and brighter)
      const ringK = ss(0.736, 0.74, p);
      // (round 4: the pulse runs once the camera is still: q .752-.795, at least 1,500 px of scroll)
      const pulseS = lerp(-80, RC.L + 80, sat((p - 0.752) / 0.043)), pulseA = 3.2 * band(p, 0.749, 0.754, 0.788, 0.796);
      const endGlow = ss(0.86, 0.92, p);
      Object.values(c.model.tubes).forEach((T) => {
        if (!T.u) return;
        T.u.uFlow.value = 0; T.u.uGlow.value = 0;
        T.u.uBase.value = lerp(0.42, 0.85, allLit);
        T.u.uTrail.value = 0; T.u.uTrailEnd.value = -1; T.u.uNeut.value = 0; T.u.uLit.value = 1; T.u.uPulseA.value = 0;
      });
      [pumpTube, stubTube].forEach((t) => { const uu = t.material.uniforms; uu.uBase.value = lerp(0.42, 0.85, allLit); uu.uFlow.value = 0; uu.uGlow.value = 0; uu.uPulseA.value = 0; });
      // E4: when each loop runs (story time; ramps over >= .02 q)
      const runC = qs(0.79, 0.815, p), runG = qs(0.812, 0.84, p);
      const culT = (T, s0) => {
        T.u.uNeut.value = neut; T.u.uLit.value = 0;
        T.u.uTrail.value = 0.5 + 0.3 * ringK; T.u.uTrailEnd.value = sC - s0;
        T.u.uParcel.value = sC - s0; T.u.uTail.value = 60;
        T.u.uBase.value = Math.max(T.u.uBase.value, 0.55);
        T.u.uPulse.value = pulseS - s0; T.u.uPulseA.value = pulseA;
        // (E4, owner 14:20: "have culture move with scroll for both loops": from the whole-machine hold on, after the ring's
        // pulse, the culture runs round its loop with the scroll only, no clock: pure in p, and still when the page is still)
        if (runC > 0) { T.u.uFlow.value = 0.7 * runC; T.u.uTime.value = p * FLOW_K; }
      };
      ["c1", "c2", "c3", "c4", "c5", "c6"].forEach((id) => culT(c.model.tubes[id], m[id]));
      // the culture's dead-end lines (sensor lines, sampler) are neutral like the loop ahead of the parcel, until the ring
      // closes (round-2 visual 8: amber stubs pointed nowhere)
      ["l1", "l2", "s1"].forEach((id) => { const T = c.model.tubes[id]; if (T && T.u) { T.u.uNeut.value = neut; T.u.uLit.value = Math.max(ringK, endGlow); } });
      // servo valve 5's demo (owner, 10 Oct): the handle turns 90 deg, culture runs down the link into stopcock 1 and a
      // little way out along s1 and l1, the handle turns back and the culture runs back up into the valve
      // (owner, 10 Oct: "make the pumps spin a little as well"): the two small pumps' rotors (their #4d4d4d meshes: the
      // carrier plates and three rollers) turn slowly about their own axes (circumcentres of the rollers, measured),
      // a pure function of the story's time
      SMALL_PUMPS.forEach(([id, ay, az, dir]) => { const P = c.model.parts[id]; if (!P) return; const th = dir * p * 70, cs = Math.cos(th), sn = Math.sin(th);
        P.meshes.forEach((me) => { if (!/#4d4d4d/.test(me.userData.matName || "")) return; me.rotation.set(th, 0, 0); me.position.set(0, ay - (cs * ay - sn * az), az - (sn * ay + cs * az)); }); });
      if (v5Grp) { const th = v5Turn(p), cs = Math.cos(th), sn = Math.sin(th);
        v5Grp.rotation.set(th, 0, 0); v5Grp.position.set(0, V5_AX.y - (cs * V5_AX.y - sn * V5_AX.z), V5_AX.z - (sn * V5_AX.y + cs * V5_AX.z)); }
      if (v5Link) { const u = v5Link.core.material.uniforms, fv = v5Fill(p);
        u.uBase.value = lerp(0.42, 0.85, allLit); u.uFlow.value = 0; u.uGlow.value = 0; u.uPulseA.value = 0; u.uParcel.value = -1e5;
        u.uNeut.value = neut; u.uLit.value = Math.max(ringK, endGlow); u.uTrail.value = 0.6; u.uTrailEnd.value = fv > 0.002 ? fv * (v5Link.L + 4) : -10; }
      { const fo = v5Out(p); [["s1", 34], ["l1", 22]].forEach(([id, len]) => { const T = c.model.tubes[id]; if (!T || !T.u) return;
          if (fo > 0.002) { T.u.uTrail.value = 0.6; T.u.uTrailEnd.value = fo * len; } }); }
      culT({ u: pumpTube.material.uniforms }, pumpTube.s0);
      const gm = RG.marks, gOn = ss(0.799, 0.807, p);
      const proT = (T, s0) => {
        T.u.uTrail.value = 0.72 * gOn; T.u.uTrailEnd.value = gOn > 0 ? sG - s0 : -1;
        T.u.uParcel.value = gOn > 0 ? sG - s0 : -1e5; T.u.uTail.value = 50;
        if (runG > 0) { T.u.uFlow.value = 0.9 * runG; T.u.uTime.value = p * FLOW_K; }
      };
      ["p4", "p5", "o1"].forEach((id) => proT(c.model.tubes[id], gm[id]));
      proT({ u: stubTube.material.uniforms }, gm.stub - (gm.stub - gm["o1>"]) - 0);
      stubTube.material.uniforms.uTrail.value *= 0.62;   // (C2: the outlet down the end panel, a tube of liquid, not a neon line)
      stubTube.material.uniforms.uNeut.value = 0; stubTube.material.uniforms.uLit.value = 1;
      // the illustrative line out of the connector draws on just ahead of the green parcel (it is not a machine part)
      // it shoots out ahead of the parcel, past the edge of the frame, and stays drawn to the end (both paths glow on)
      { const sd = sG - gm["o1>"], Lr = gm["stub>"] - gm["o1>"];
        stubTube.material.uniforms.uDraw.value = sat((sd + 30) / Lr); stubTube.visible = sd > -30;
        stubTube.wall.material.uniforms.uDraw.value = stubTube.material.uniforms.uDraw.value; stubTube.wall.visible = stubTube.visible; }
      // C2: the drip line and the field (a pure function of q; nothing before .84)
      fieldAt(c, p, clock);
      coverAt(p); fillAt(p);            // (E2, E3)
      // the culture vessel glows (illustrative) at its station, when the ring closes, and at the end
      const cu = c.model.parts.culture;
      if (cu) cu.meshes.forEach((me) => { me.material.emissiveIntensity = (me.material.userData.emitBase || 0.1) * (0.6 + 2.2 * Math.max(band(p, 0.09, 0.12, 0.17, 0.2), ringK * (1 - ss(0.75, 0.79, p)) * 0.6, endGlow)); });

      // focus (FOCUS_DIM / ?focus=1): the rest a little darker and less saturated, a pure function of q
      if (FOCUS_ON && focTubes) focusApply(c, p, sC);

      // 5. the parcel: a lit slug in its tube (shader), a soft head over everything, a white-hot core while it is in
      // the vessel's amber, and a little light of its own. From p .02 it pulses at the dip tube's foot.
      const pulse = (window.V4Q && window.V4Q.capture) ? 1 : 0.78 + 0.22 * Math.sin(clock * 2.4);   // (capture: no pulse phase)
      // (owner, 10 Oct: "I don't like how the bacteria we follow just appears out of nowhere. I want it to come from atop
      // the screen ... so that the bacteria seems like it lands almost when we get to that part, but don't stress it":
      // it drops in from 420 mm above the dip tube's foot over q .07-.117, slowing as it lands, while the camera pans in.
      // Only the glow travels; the light on the parts stays with the parcel's place)
      const dropT = sat((p - 0.07) / 0.047), drop = p < 0.12 ? 420 * (1 - dropT * dropT * (3 - 2 * dropT) * (2 - dropT * dropT * (3 - 2 * dropT))) : 0;
      const onC = Math.max(ss(0.07, 0.078, p) * lerp(1, pulse, 1 - ss(0.11, 0.13, p)), ss(0.12, 0.13, p)) * (1 - ss(0.734, 0.742, p));
      parcel.position.copy(_pp); parcel.position.z += drop; parcel.material.opacity = onC;
      // the head keeps one size on screen: a head when far, and the same head in the push into the fibre
      const camD = c.cam.position.distanceTo(_pp);
      parcel.scale.setScalar(Math.max(0.04, Math.min(26, camD * lerp(0.16, headK(c), wDive(p) * ss(0.52, 0.546, p) * (1 - ss(0.66, 0.68, p))))));
      const inVessel = 1 - ss(m["dip>"] - 30, m["dip>"] + 10, sC);
      parcelCore.position.copy(parcel.position); parcelCore.material.opacity = onC * inVessel; parcelCore.scale.setScalar(parcel.scale.x * 0.42);   // (round 4b: a clearer white core)
      parcelG.scale.setScalar(Math.max(1.2, Math.min(24, c.cam.position.distanceTo(_pg) * 0.15)));
      parcelG.position.copy(_pg); parcelG.material.opacity = gOn * (1 - ss(0.844, 0.852, p));
      plight.position.copy(_pp).lerp(_pg, wRef);
      plight.color.copy(RQ.srgb("#ffb060")).lerp(RQ.srgb("#7dffc0"), wRef);
      plight.intensity = 0.35 * Math.max(onC, parcelG.material.opacity) * (1 - wDive(p));

      // the pump: a roller presses the tube just behind the slug and turns with it (and on, with the culture, after)
      if (rotor) {
        const a0 = m.arc, a1 = m["arc>"], sa = Math.max(a0, Math.min(a1, sC));
        const phiSlug = Math.PI * (1 + (sa - a0) / (a1 - a0));
        const alpha = phiSlug - 0.42 - ROLL0 + (sC - sa) / ROT_R;
        rotor.rot.set(alpha, 0, 0);
        pumpTube.material.uniforms.uRot.value = alpha + ROLL0;
      }
      // the V4: cut along its light path for its station; the beam fires as the parcel crosses the cell; the light
      // through the cell dims as the culture fills it; the OD600 mark stays a label (no value: none is on record)
      const kv = band(p, 0.33, 0.348, 0.384, 0.4);
      v4Clip.constant = V4CUT.c0 + lerp(400, 0.5, ss(0, 1, kv));
      // (round 4b: the head travels down over .348-.358 and the cell's spot comes up over the last 45 % of it: >= .004 q)
      const kb = band(p, 0.348, 0.356, 0.377, 0.388);
      beam.set(kb, ss(0.348, 0.358, p), false);
      const kt = 0.7 * kb * ss(0.354, 0.36, p) * lerp(1, 0.45, ss(0.358, 0.37, p));
      trans.visible = kt > 0.003; trans.material.uniforms.uA.value = kt;
      trans.det.material.opacity = 1.4 * kt; trans.det.visible = kt > 0.003;
      parcel.material.opacity *= (1 - 0.6 * kb) * (1 - 0.75 * v5Demo(p));   // (and dimmed while the valve's handle turns)
      // (its label is laid out with the others: labelLayout)

      // 6. the membrane: the shell's cut climbs with the parcel (below it the shell is a faint sleeve and the fibres
      // carry the culture's colour), the fibres rest in shadow, the one fibre is lit as the culture's
      const inLumen = sC > m.lumen - 4;
      const zCut = Math.max(inLumen ? Math.min(460, _pp.z + 2) : 200, lerp(200, FZ + 34, ss(0.505, 0.528, p)) * (1 - ss(0.68, 0.7, p)));
      // (round 4b: the shell closes again after the dive, so the column is a white cartridge in clear glass, not an
      // amber log; the cut only opens it for the dive)
      const kCut = ss(0.49, 0.508, p) * (1 - ss(0.69, 0.72, p));
      FX.setCut(c, sC > m["lumen>"] ? 470 : zCut, kCut);
      FX.setWhite(c, 1 - 0.45 * kCut);
      const wd = wDive(p);
      fibre.g.visible = true;
      const fl = ss(0.505, 0.528, p) * (1 - ss(0.7, 0.72, p));
      fibre.outer.material.uniforms.uA.value = lerp(0.8, 0.55, fl);
      // as the camera nears the fibre (the push through its near wall) the culture thins to a tint, so the wall's pores
      // come up through it instead of a flat amber wash
      { const dn = c.cam.position.distanceTo(new V3(FIBX, AX[1], c.cam.position.z)) - FR;
        fibre.core.material.uniforms.uA.value = lerp(0.35, 0.85, fl) * lerp(0.12, 1, ss(1.5, 9, dn));
        // (+0.4: the near plane clips the front face before the camera is in)
        const inCore = dn + FR < fibre.rCore + 0.4; fibre.core.visible = !inCore; fibre.coreB.visible = inCore;
        // (pop fix: the wash thins out as the camera nears the far wall, during the push, so the hand-off frame is the
        // close-up's, which has no wash: the matched cut had become a 9-level step once the twin drew the wash inside)
        if (inCore) fibre.core.material.uniforms.uA.value *= ss(1.0, 2.4, DS * (c.cam.position.x - WALLX)); }
      // the inner wall, in the close-up's units: the camera, the parcel's light, and the medium's haze as the camera
      // nears the far wall (so the hand-off frame is the close-up's first frame)
      { const dw = DS * (c.cam.position.x - WALLX), inF = Math.hypot(c.cam.position.x - FIBX, c.cam.position.y - AX[1]) < FR;
        micro.updateInner(fibre.inner.material, c.cam, _pp, onC, inF ? 1 - ss(CAMW * 2.2, CAMW * 6, dw) : 0); }
      // the protectant leaves the fibres for the upper shell port, ahead of the green path
      motes.set(470, ss(0.76, 0.795, p) * (1 - ss(0.83, 0.854, p)), p * 90 + clock * 0.15);
      // (owner, 10 Oct: "Just as the shell side loop starts, make the membrane glow that green a little bit, then start
      // the rest ... don't make the light too unrealistic and make it an aurora glow"): a soft green aurora round the
      // cartridge, slow curtains that drift with the scroll, and a faint green in the bundle, q .784-.814; then the green
      // parcel sets off (.807)
      { const gl = qband(p, 0.784, 0.795, 0.801, 0.814); aurora.visible = gl > 0.003; aurora.material.uniforms.uA.value = 0.42 * gl; aurora.material.uniforms.uPh.value = p * 260;
        const F = c.model.parts.fibres; if (F) F.meshes.forEach((me) => { if (me.material.emissive) me.material.emissiveIntensity = 0.16 * gl; }); }

      // 7. the close-up (its own scene, matched at both ends), and a short focus pull across each hand-off
      const kM = (p - MICRO[0]) / (MICRO[1] - MICRO[0]);
      const showMicro = kM >= 0 && kM < 1;
      if (showMicro) micro.draw(kM, clock);
      c.comp.uniforms.uExposure.value = c.exposure0 * lerp(1, 0.9, wd);
      // while chasing, a deeper vignette keeps the eye on the parcel (round-2 visual 7)
      c.comp.uniforms.uVignette.value = lerp(0.38, 0.52, (1 - allLit) * (1 - wd));
      // (no focus pull across the hand-offs any more: the close-up's first and last frames are the macro frames, the
      // fibre's inner wall being the close-up's own skin shader; measured mean change at the switch 0.2/255)
      if (glCanvas.style.filter) glCanvas.style.filter = "";

      // the shadow map is frozen while nothing that casts a shadow moves (the dive, the wall, the crane: the case is gone)
      // round 4b (QA 2, r4 B5: a frame must be a pure function of p): in capture mode and in renderAt the shadow map is
      // drawn every frame. Live, it is frozen only while its casters' state key holds (the V4's cut, the shell's cut,
      // the rotor to 3 deg, which parts cast); when the key changes it is redrawn once
      const exact = !!((window.V4Q && window.V4Q.capture) || window.__storyExact);
      const freeze = !exact && ((p > STRIP[1] + 0.002 && p < 0.205) || (p > 0.3 && p < BACKON[0] - 0.002));
      if (freeze) {
        let nCast = 0; partList.forEach((P) => { if (!P.hiddenForGood && P.fade > 0.6) nCast++; });
        const key = [kv.toFixed(3), kCut.toFixed(3), Math.round(zCut), rotor ? Math.round(rotor.rot.x * 60 / Math.PI) : 0, nCast].join("|");
        if (key !== c._shKey) { c._shKey = key; c.rend.shadowMap.needsUpdate = true; }
      } else c._shKey = null;
      c.rend.shadowMap.autoUpdate = !freeze;
      // 8. the room: the strips with the case; the aurora away from close shots
      FX.strips(c, 1 - ss(0, 0.12, u));               // the LED strips go dark before they move
      c.inner.intensity *= lerp(1, 0.4, 1 - allLit);
      // polish pass: ambient occlusion (off while the camera pushes into the fibre: its near plane is 0.015 mm there) and
      // a depth of field focused on the parcel in the chase's close shots (not the wide shots: the ring, the way out, the
      // opening and the end stay sharp)
      { const PP = c.comp.post;
        if (PP) {
          // (round 4b, r4 C9: occlusion at 0.45, and off at the photometer, whose cut faces it darkened)
          // (and off over the c3 back view, q .40-.47: the retina frame there was 21 ms, QA 3; B19)
          PP.ao = (1 - qband(p, 0.51, 0.52, 0.672, 0.69)) * (1 - qband(p, 0.33, 0.345, 0.38, 0.395)) * (1 - qband(p, 0.392, 0.405, 0.505, 0.515)); PP.aoInt = 0.45;
          const fP = p > 0.77 ? _pg : _pp; _tv.copy(fP).applyMatrix4(c.cam.matrixWorldInverse);
          PP.focus = Math.max(1, -_tv.z);
          const stK2 = Math.max.apply(null, stationParts.slice(0, 3).map((x) => x[0]));
          // (round 4b, visual 4 / r4 C8: depth of field off in the macro scene. The clear tube walls and glass write no
          // depth, so they took the background's blur and came out as beaded, dotted halos. The close-up keeps its own)
          PP.ap = DOF_MACRO * 6.5 * (1 - allLit) * (1 - wd) * lerp(1, 0.5, stK2) * (1 - qband(p, 0.712, 0.735, 0.792, 0.81)) * (1 - qs(0.806, 0.83, p));
        } }
      // polish pass: the light per act. Deeper fill and ambient (the photometer hero's contrast), a stronger cool rim so
      // the parts separate from the dark, the key a little up at the stations
      { const chaseK = (1 - allLit) * (1 - wd), stK = Math.max.apply(null, stationParts.map((x) => x[0]));
        c.fill.intensity *= lerp(0.78, 0.55, chaseK); c.hemi.intensity *= lerp(0.8, 0.6, chaseK);
        c.rim.intensity *= lerp(1.22, 1.45, chaseK); c.key.intensity *= 1.04 * (1 + 0.1 * stK); }
      if (wd > 0) c.comp.uniforms.uAurora.value = 0.075 * (1 - ss(0.51, 0.53, p) * (1 - ss(0.67, 0.69, p)));

      // DOM ---------------------------------------------------------------------------------------------------
      sceneDom(c, p);
      // in the scene: the labels (polish pass), laid out from this frame's own cameras, then the route
      applyLabels(c, labelLayout(c, p, c.cam, showMicro ? micro.cam : null));
      // the route (ROUTE_UI): where the parcel is, and where it is going next
      routeUI(c, p, sC, sG);
    },
  });

  // ---- the route: Vessel . Pump . Photometer . Membrane . Loop . Out (polish pass: ringed stops on a hairline, the
  // visited stretch filled amber, a dot for the parcel's progress; a pure function of p). The "next stop" is a label.
  const STOPS = ["Vessel", "Pump", "Photometer", "Membrane", "Loop", "Out"];
  function routeProgress(p, sC, sG) {
    const m = RC.marks, g = RG.marks;
    // progress in stops: 0 vessel .. 1 pump .. 2 photometer .. 3 membrane .. 4 back at the vessel (loop) .. 5 out
    const K = [[0, 0], [m["dip>"], 0.15], [m.arc, 1], [m["arc>"], 1.1], [m.cell, 2], [m.cell + 8, 2.1], [m.lumen, 3], [m["lumen>"], 3.2], [m["c6>"], 4]];
    let prog = interp(K, sC);
    if (p > 0.806) prog = 4 + interp([[0, 0], [g["o1>"], 1]], sG);
    return prog;
  }
  function routeUI(c, p, sC, sG) {
    const on = ROUTE_UI ? ss(0.095, 0.115, p) * (1 - ss(0.852, 0.87, p)) : 0;
    route.style.opacity = on.toFixed(3); routeM.style.opacity = on.toFixed(3);
    route.style.visibility = routeM.style.visibility = on > 0.003 ? "visible" : "hidden";
    if (on <= 0.003) return;
    // the current stop is the one the parcel is at or nearly at (it switches 65 % of the way along a leg)
    const prog = routeProgress(p, sC, sG), cur = Math.min(5, Math.floor(prog + 0.35)), green = p > 0.806;
    if (route._cur !== cur + (green ? 10 : 0)) {
      route._cur = cur + (green ? 10 : 0);
      routeLi.forEach((li, i) => { li.className = (i === cur ? "on" : i < cur ? "done" : "") + (i === 5 ? " out" : ""); });
      route.classList.toggle("g", green); routeM.classList.toggle("g", green);
      routeMT.innerHTML = "<b>" + STOPS[cur] + "</b>" + (cur < 5 ? "<em>next</em>" + STOPS[cur + 1] : "");
    }
    if (!route._r0) { const a = routeLi[0], b = routeLi[5]; route._r0 = a.offsetTop + a.offsetHeight / 2; route._r5 = b.offsetTop + b.offsetHeight / 2;
      const rl = document.getElementById("route-line"); rl.style.top = route._r0 + "px"; rl.style.height = (route._r5 - route._r0) + "px"; }
    const y = lerp(route._r0, route._r5, Math.min(5, prog) / 5);
    routeDot.style.transform = "translateY(" + y.toFixed(1) + "px)";
    routeFill.style.top = route._r0.toFixed(1) + "px";
    routeFill.style.height = Math.max(0, y - route._r0).toFixed(1) + "px";
    routeMBar.style.width = (Math.min(5, prog) / 5 * 100).toFixed(1) + "%";
  }

  // ---- labels (polish pass, 9-10 Oct), in the labelled rack sheet's recipe (dev/lab-bioreactor/rack-model/renders/
  // rack-a-front-labelled.png): a mono kicker, a name, a short role; a hairline leader with a dark halo from a ringed
  // anchor dot to the label; amber for culture, green for protectant. Each label's place is a pure function of p: its
  // 3D anchor through the frame's camera (the macro camState, or the close-up's own camera), plus fixed offsets in
  // screen px, so nothing jitters, and labelsAt(p) gives the clip player the same layout without drawing a frame.
  // d: [dx, dy] from the anchor to where the leader meets the label (desk), dp: the same on phone.
  const PT_LBL = [0.694, 0.7, 0.728, 0.736];   // the pressure sensors' label (C3)
  const LDEF = {
    follow: { cls: "a", k: "Follow this", n: "One parcel of culture", side: 1, d: [86, -78], dp: [44, -96] },
    // (owner, 10 Oct) the two small pumps and the pressure sensors, at the pump area. PT plumbing checked in tubes.json:
    // PT1 lumen in (l1), PT3 lumen out (l2), PT4 shell in (l3), PT2 shell out (l4): either side of the membrane
    pumpk: { cls: "", k: "pH control", n: "KOH pump", side: -1, d: [70, -64], dp: [30, -70] },
    pumpp: { cls: "g", k: "Shell side", n: "Protectant pump", side: -1, d: [70, 60], dp: [30, 70] },
    // (owner, 10 Oct 12:15: "the presssure sensor labels should be here not earlier": the crane over the top after the
    // membrane, where the four stations are big and clear; upper left on desk, clear of "Back to · Culture vessel")
    pts: { cls: "", k: "Either side of the membrane", n: "Pressure sensors &times;4", side: -1, d: [110, -70], sideP: 1, dp: [36, -96] },
    next: { cls: "a", k: "Next stop", n: "", side: 1, d: [64, -58], dp: [40, -70], desk: true },
    // (round 4b, visual 11 / r4 18: role lines that repeat a caption are gone; "cell-free" on the field label stays)
    od: { cls: "a", k: "Photometer &middot; 600&nbsp;nm", n: "OD600 read here", side: 1, d: [112, 74], sideP: -1, dp: [30, 124] },
    fibre: { cls: "a", k: "Membrane", n: "One fibre", side: 1, d: [84, -82], dp: [40, -104] },
    lumen: { cls: "a", k: "Lumen side", n: "Culture", side: -1, d: [150, -150], dp: [40, -130] },
    valve: { cls: "a", k: "Servo valve", n: "Switches to the sampler", side: -1, d: [96, -96], sideP: 1, dp: [36, -120] },
    shell: { cls: "g", k: "Shell side", n: "Protectant", side: 1, d: [74, 70], sideP: -1, dp: [40, 96] },
    pore: { cls: "w", k: "Pore", n: "0.2&nbsp;&micro;m", side: -1, d: [96, -70], sideP: -1, dp: [44, -80] },
    field: { cls: "g", k: "Protectant loop", n: "To the field", r: "cell-free, out of the machine", side: 1, d: [56, -76], sideP: -1, dp: [24, -92] },
  };
  // where the parcel is going: the leg's p window, the stop's name, a 3D anchor on it (CAD mm), the label's side
  let LEGS = null;
  function legs(c) {
    if (LEGS) return LEGS;
    const P = c.model.parts, ctr = (id, dflt) => (P[id] ? P[id].center.clone() : dflt);
    LEGS = [[0.166, 0.214, "Culture pump", new V3(-58, ROT_C[0], ROT_C[1]), 1],
            [0.294, 0.334, "Photometer", ctr("v4", new V3(-34, 112, 420)), 1],   // (owner 10 Oct: after the two pump labels)
            [0.394, 0.462, "Membrane", new V3(5, -144.5, 246), -1],
            [0.69, 0.734, "Culture vessel", ctr("culture", new V3(-46, 40, 230)), 1, "Back to"],
            [0.81, 0.836, "Output", ctr("output", new V3(-75, -160, 545)), -1]];
    return LEGS;
  }
  // round 4b (camera 4, 5): a "next stop" / "back to" label fades while its anchor is hidden behind the machine (it sat
  // on the c3 tube with the membrane behind the V4, and on the column with the vessel behind it). A per-p occlusion
  // table, built once per aspect (under the loader: the warm frames draw the labels): rays from the camera to the
  // anchor against the opaque parts, except the stop's own, every 0.002 q, smoothed over 5 samples
  const LEG_EXCL = [["pumpbox", "rotor", "deck 2"], ["v4", "photometer step"], ["membrane", "fibres", "valve5", "membrane clamp", "sc1"], ["vessel", "culture", "stand"], ["output"]];
  let OCC = null;
  function occTable(c) {
    if (OCC && OCC.key === camKey) return OCC;
    const t0 = performance.now(), rc = new THREE.Raycaster(), cm = new THREE.PerspectiveCamera(30, c.aspect, 1, 10), tabs = [];
    legs(c).forEach(([p0, p1, name, A], li) => {
      const ex = {}; (LEG_EXCL[li] || []).forEach((id) => { ex[id] = 1; });
      const meshes = [];
      // (D1: the column backplate is away with the case through every leg)
      partList.forEach((P) => { if (P.hiddenForGood || ex[P.id] || P.id === "column backplate") return; P.meshes.forEach((me) => { const mt = me.material; if (!mt.visible || mt.transparent || (mt.userData && mt.userData.glass)) return; me.updateMatrixWorld(true); meshes.push(me); }); });
      const n = Math.max(2, Math.ceil((p1 - p0) / 0.002)), v = new Float32Array(n + 1), sm = new Float32Array(n + 1);
      for (let k = 0; k <= n; k++) {
        cm.aspect = c.aspect; applyCam(cm, camState(c, p0 + (p1 - p0) * k / n, {}));
        const d = A.clone().sub(cm.position), dist = d.length();
        rc.set(cm.position, d.normalize()); rc.near = 0; rc.far = Math.max(0, dist - 4);
        v[k] = rc.intersectObjects(meshes, false).length ? 0 : 1;
      }
      for (let k = 0; k <= n; k++) { let a = 0; for (let j = -2; j <= 2; j++) a += v[Math.max(0, Math.min(n, k + j))]; sm[k] = a / 5; }
      tabs.push({ p0: p0, p1: p1, n: n, v: sm, raw: Array.from(v) });
    });
    OCC = { key: camKey, tabs: tabs, ms: Math.round(performance.now() - t0) };
    return OCC;
  }
  function legVis(c, li, q) { const T = occTable(c).tabs[li]; if (!T) return 1; const f = sat((q - T.p0) / (T.p1 - T.p0)) * T.n, i = Math.min(T.n - 1, Math.floor(f)); return lerp(T.v[i], T.v[i + 1], f - i); }
  const LBL = {};
  let leaders = null, SHELL_A = null;
  const SVGNS = "http://www.w3.org/2000/svg";
  function initLabels(c) {
    const host = document.getElementById("marks");
    leaders = document.getElementById("leaders");
    Object.keys(LDEF).forEach((id) => {
      const D = LDEF[id], el = document.createElement("div");
      el.className = "lb " + (D.cls || "") + (D.desk ? " desk" : "");
      el.id = "lb-" + id;
      el.innerHTML = '<span class="k">' + D.k + '</span><span class="n">' + D.n + "</span>" + (D.r ? '<span class="r">' + D.r + "</span>" : "");
      host.appendChild(el);
      const g = document.createElementNS(SVGNS, "g"); g.setAttribute("class", "ld " + (D.cls || ""));
      g.innerHTML = '<path class="h"/><path class="l"/><circle class="rh" r="5.6"/><circle class="r" r="5"/><circle class="d" r="1.8"/><path class="cv" d="M-6,-8 L5,0 L-6,8"/>';
      leaders.appendChild(g);
      LBL[id] = { D: D, el: el, g: g, h: g.children[0], l: g.children[1], rh: g.children[2], r: g.children[3], dt: g.children[4], cv: g.children[5],
                  k: el.children[0], n: el.children[1], w: 0, hgt: 0, nMid: 0, txt: D.n };
    });
    const measure = () => Object.keys(LBL).forEach((id) => { const L = LBL[id]; L.w = L.el.offsetWidth; L.hgt = L.el.offsetHeight; L.nMid = L.n.offsetTop + L.n.offsetHeight / 2; });
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("resize", () => setTimeout(measure, 0));
  }
  const _lv = new V3();
  // a 3D point through a camera to screen px
  function proj(cam, P, W, H) {
    _lv.copy(P).applyMatrix4(cam.matrixWorldInverse);
    const front = _lv.z < -1e-3;
    _lv.copy(P).project(cam);
    return { x: (_lv.x * 0.5 + 0.5) * W, y: (-_lv.y * 0.5 + 0.5) * H, front: front && _lv.z < 1 };
  }
  // the layout at p: for each label {id, a (opacity), ax, ay (anchor px), lx, ly (where the leader meets the label),
  // side, ring (the anchor's opacity), chev {x, y, ang, a} (the edge pointer of an off-screen next stop), txt}
  function labelLayout(c, p, camM, camU) {
    const W = c.W, H = c.H, port = c.aspect < 0.8, out = [];
    const sC = sCul(p), Pp = RC.at(sC);
    const put = (id, P, a, cam) => {
      if (a <= 0.003) return;
      const D = LDEF[id], q = proj(cam, P, W, H);
      if (!q.front) return;
      const o = port ? D.dp : D.d, sd = port && D.sideP ? D.sideP : D.side;
      out.push({ id: id, a: a, ax: q.x, ay: q.y, lx: q.x + sd * o[0], ly: q.y + o[1], side: sd, ring: 1 });
    };
    // the one thing to watch, named once, before it moves
    // (round 4b, visual 5: once the parcel climbs the dip tube with its white core, not on the pale culture at its foot)
    put("follow", Pp, band(p, 0.126, 0.134, 0.168, 0.178), camM);
    // the next stop: on its part when that is in frame, else a pointer at the frame's edge toward it (desk only: the
    // phone has its route line)
    if (!port && ROUTE_UI) {
      legs(c).forEach(([p0, p1, name, A, side, kick], li) => {
        const a = band(p, p0, p0 + 0.008, p1 - 0.008, p1) * legVis(c, li, p);
        if (a <= 0.003) return;
        _lv.copy(A).applyMatrix4(camM.matrixWorldInverse);
        const vx = _lv.x, vy = _lv.y, behind = _lv.z > -1e-3;
        const q = proj(camM, A, W, H);
        const mx = 64, myT = 112, myB = 170;
        let x = q.x, y = q.y;
        if (behind) { const l = Math.hypot(vx, vy) || 1; x = W / 2 + vx / l * W * 2; y = H / 2 - vy / l * H * 2; }
        // how far inside the safe frame the stop is (px): the ring shows inside, the edge pointer outside
        const inside = Math.min(x - mx, W - mx - x, y - myT, H - myB - y);
        const cx = Math.max(mx, Math.min(W - mx, x)), cy = Math.max(myT, Math.min(H - myB, y));
        const ring = behind ? 0 : ss(-8, 30, inside);
        const o = LDEF.next.d;
        out.push({ id: "next", a: a, ax: cx, ay: cy, lx: cx + side * o[0], ly: cy + o[1], side: side, ring: ring, txt: name, kick: kick || "Next stop",
                   chev: { x: cx, y: cy, ang: Math.atan2(y - cy, x - cx), a: 1 - ring } });
      });
    }
    // the photometer: the flow cell
    put("od", beam.cell, band(p, 0.348, 0.356, 0.377, 0.388) * ss(0.356, 0.362, p), camM);
    // (owner, 10 Oct) the pressure sensors, then the two small pumps, at the pump area; the pumps' labels go as the
    // photometer's "next stop" comes up (now .294)
    { const PP2 = c.model.parts, front = (id, dz) => { const Q = PP2[id]; return Q ? new V3(Q.box.min.x + 6, Q.center.y, Q.center.z + (dz || 0)) : null; };
      const aPT = front("pt_pt2") && front("pt_pt3") ? front("pt_pt2").lerp(front("pt_pt3"), 0.5) : null;
      // (C3: the crane over the top, q .694-.736; the row is on screen and unoccluded from .692 desk / .696 phone, measured;
      // fully shown ~1,350 px desk)
      if (aPT) put("pts", aPT, band(p, PT_LBL[0], PT_LBL[1], PT_LBL[2], PT_LBL[3]), camM);
      const aK = front("pump_k"), aP = front("pump_p");
      if (aK) put("pumpk", aK, band(p, 0.245, 0.251, 0.288, 0.295), camM);
      if (aP) put("pumpp", aP, band(p, 0.245, 0.251, 0.288, 0.295), camM); }
    // servo valve 5, through its demo (owner, 10 Oct); the plumbing: its lower port -> stopcock 1 -> s1 -> the sampler
    put("valve", new V3(14, -144.5, 175), band(p, 0.472, 0.478, 0.498, 0.504), camM);
    // the one fibre, as the camera lines up with it
    put("fibre", Pp, (wDive(p) > 0 && p < MICRO[0]) ? band(p, 0.512, 0.518, 0.534, 0.54) : 0, camM);
    // the close-up's marks: lumen above the wall, shell side in the section, and the 0.2 um bracket
    if (camU) {
      const kM = (p - MICRO[0]) / (MICRO[1] - MICRO[0]), A = micro.anchors;
      const mA = ss(0.31, 0.37, kM) * (1 - ss(0.63, 0.69, kM));
      // the culture: on the held cell itself; the shell side: in the wall's section, below the skin (both in frame
      // at both aspects, measured)
      if (!SHELL_A) SHELL_A = { l: micro.onSkin(micro.IC * micro.SP, (micro.JH - 4) * micro.SP, -260).addScaledVector(micro.NF, 4),
                                p: micro.onSkin(micro.IC * micro.SP, (micro.JH - 2) * micro.SP, -260).addScaledVector(micro.NF, 4) };
      put("lumen", micro.landerPos(kM), mA, camU); put("shell", port ? SHELL_A.p : SHELL_A.l, mA, camU);
      put("pore", A.pore, band(kM, 0.4, 0.45, 0.66, 0.7), camU);     // (round 4b, QA 5: >= 600 px fully shown; it was ~200)
    }
    // the way out, at the illustrative outlet line's end
    // (on the line just out of the connector: the label then sits in the dark above the line, clear of the machine)
    put("field", STUB[2], band(p, 0.828, 0.838, 0.864, 0.874), camM);
    // keep every label inside the frame (the leader stretches; nothing flips side)
    out.forEach((o) => {
      const L = LBL[o.id], w = L.w || 160, x0 = o.side > 0 ? o.lx + 8 : o.lx - 8 - w;
      const xc = Math.max(16, Math.min(W - 16 - w, x0));
      o.lx += xc - x0;
      // (17 Oct 2026, wiki copy: labels start at 118 px on a desk (was 80) and 152 px in portrait (was 100), under the route line; see
      // css/record-edit.css. A re-sync from dev/bioreactor-hero/v4 must keep this.)
      const yTop = o.ly - (L.nMid || 20), yc = Math.max(port ? 152 : 118, Math.min(H - (L.hgt || 50) - 16, yTop));
      o.ly += yc - yTop;
    });
    return out;
  }
  function applyLabels(c, list) {
    const seen = {};
    list.forEach((o) => {
      const L = LBL[o.id]; seen[o.id] = 1;
      if (o.txt !== undefined && L.txt !== o.txt) { L.n.innerHTML = o.txt; L.txt = o.txt; L.k.innerHTML = o.kick || L.D.k; L.w = L.el.offsetWidth; }
      const e = ss(0, 1, o.a), te = e;     // (round 4b, QA 5 / visual 10: the text and its leader fade on one curve)
      // the label: its name's middle sits on the leader's end
      const x = o.side > 0 ? o.lx + 8 : o.lx - 8 - L.w, y = o.ly - L.nMid + (1 - te) * 5;
      L.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      L.el.style.opacity = te.toFixed(3); L.el.style.visibility = "visible";
      if (L.rt !== (o.side < 0)) { L.rt = o.side < 0; L.el.classList.toggle("rt", L.rt); }
      // the leader: from the anchor, 45 deg to the label's line, then level to the label; it draws on from the anchor
      const dy = o.ly - o.ay, dxs = o.lx - o.ax, sg = dxs === 0 ? o.side : Math.sign(dxs);
      const kx = o.ax + sg * Math.min(Math.abs(dy), Math.abs(dxs) * 0.7);
      const d = "M" + o.ax.toFixed(1) + "," + o.ay.toFixed(1) + "L" + kx.toFixed(1) + "," + o.ly.toFixed(1) + "L" + o.lx.toFixed(1) + "," + o.ly.toFixed(1);
      const len = Math.hypot(kx - o.ax, o.ly - o.ay) + Math.abs(o.lx - kx) + 1;
      const ring = o.ring === undefined ? 1 : o.ring;
      [L.h, L.l].forEach((pa) => { pa.setAttribute("d", d); pa.style.strokeDasharray = len.toFixed(1) + " " + (len + 10).toFixed(1); pa.style.strokeDashoffset = ((1 - e) * len).toFixed(1); pa.style.opacity = ring.toFixed(3); });
      [L.rh, L.r, L.dt].forEach((ci) => { ci.setAttribute("cx", o.ax.toFixed(1)); ci.setAttribute("cy", o.ay.toFixed(1)); ci.style.opacity = ring.toFixed(3); });
      const ch = o.chev;
      if (ch && ch.a > 0.003) { L.cv.style.opacity = ch.a.toFixed(3); L.cv.setAttribute("transform", "translate(" + ch.x.toFixed(1) + "," + ch.y.toFixed(1) + ") rotate(" + (ch.ang * 180 / Math.PI).toFixed(1) + ")"); }
      else L.cv.style.opacity = "0";
      L.g.style.opacity = e.toFixed(3); L.g.style.visibility = "visible";
    });
    Object.keys(LBL).forEach((id) => {
      if (seen[id]) return;
      const L = LBL[id];
      if (L.el.style.visibility !== "hidden") { L.el.style.visibility = "hidden"; L.el.style.opacity = "0"; L.g.style.visibility = "hidden"; L.g.style.opacity = "0"; }
    });
  }
  // for the clip player: the labels' layout at p (and the camera), computed without drawing a frame
  const _camM = new THREE.PerspectiveCamera(30, 1, 1, 10), _camU = new THREE.PerspectiveCamera(34, 1, 2, 30000);
  function labelsAt(p0) {
    const c = window.__b2, p = warpP(p0);
    _camM.aspect = c.aspect; applyCam(_camM, camState(c, p, {}));
    const kM = (p - MICRO[0]) / (MICRO[1] - MICRO[0]);
    const cu = (kM >= 0 && kM < 1) ? micro.camFor(kM, _camU) : null;
    return { p: p0, q: p, W: c.W, H: c.H, labels: labelLayout(c, p, _camM, cu),
             cam: { pos: _camM.position.toArray(), quat: _camM.quaternion.toArray(), fov: _camM.fov, proj: Array.from(_camM.projectionMatrix.elements) } };
  }

  // ---- the checks (STORYBOARD "Done means"): what is drawn and where, at p
  const _box = new THREE.Box3(), _v = new V3();
  function onScreen(cam, box) {
    const pts = [box.getCenter(new V3())];
    [0, 1].forEach((i) => [0, 1].forEach((j) => [0, 1].forEach((k) => pts.push(new V3(i ? box.max.x : box.min.x, j ? box.max.y : box.min.y, k ? box.max.z : box.min.z)))));
    return pts.some((q) => { _v.copy(q).project(cam); return _v.z < 1 && _v.z > -1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1; });
  }
  function check(p) {
    const c = window.__b2;
    window.__story.renderAt(p);
    const p0 = p; p = warpP(p0);
    const isMicro = !!(c.renderScene && c.renderScene !== c.scene);
    const parts = {}, tubes = {};
    Object.values(c.model.parts).forEach((P) => {
      if (P.hiddenForGood) return;
      const drawn = P.meshes.some((me) => me.visible);
      _box.copy(P.box).translate(P.offset);
      parts[P.id] = [drawn ? 1 : 0, onScreen(c.cam, _box) ? 1 : 0, +P.fade.toFixed(3)];
    });
    Object.values(c.model.tubes).forEach((T) => {
      const drawn = T.group.visible && T.wall.visible && T.wu.uA.value > 0.05;
      tubes[T.id] = [drawn ? 1 : 0, T.a, T.b];
    });
    // the parcel on screen; in the close-up, the camera's subject: the lander (the parcel's glow becomes it) on the way
    // in and while it is held, then the parcel's place, where its glow returns, as the camera pulls back out
    let pp;
    if (isMicro) pp = micro.subject().clone().project(micro.cam);
    else pp = RC.at(sCul(p)).project(c.cam);
    const pg = RG.at(sGrn(p)).project(c.cam);
    // case pieces on screen while they should all be gone
    let strays = 0;
    if (p > STRIP[1] + 0.001 && p < BACKON[0] - 0.001) pieces.forEach((q) => { if (q.piv.visible) strays++; });
    return { p: p0, q: +p.toFixed(6), micro: isMicro, parts: parts, tubes: tubes, parcel: [+pp.x.toFixed(4), +pp.y.toFixed(4), +pp.z.toFixed(4)], green: [+pg.x.toFixed(4), +pg.y.toFixed(4)],
             flying: pieces.filter((q) => q.piv.visible && q.t > 0 && q.t < 1).length, strays: strays };
  }

  function pin(el, x, y, a) { if (a > 0.003) x = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, x)); el.style.visibility = a > 0.003 ? "visible" : "hidden"; el.style.opacity = a.toFixed(3); el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)"; }
  // ---- the scene's own DOM, a pure function of q (round 4b, QA 6: the clip player's drawDomAt draws it too): the
  // title's frame and stats, the end line, the honesty key, and the caption scrim, which follows the visible caption
  // (r4 16), the title and the end line
  function capAlpha(q) {
    let m = 0;
    CAPS.forEach((cp) => { const w = cp.win, f = Math.min(0.03, Math.max(w[1] - w[0], 1e-4) * 0.26);
      if (q > w[0] && q < w[1]) { let a = Math.max(0, Math.min(1, (q - w[0]) / f, (w[1] - q) / f)); a = a * a * (3 - 2 * a); m = Math.max(m, a); } });
    return m;
  }
  function sceneDom(c, q) {
    const tA = 1 - ss(0.02, 0.06, q), sA = 1 - ss(0.012, 0.04, q);
    vis(frameEl, tA); vis(stats, sA);
    const eA = ss(0.912, 0.94, q); vis(endline, eA);
    vis(keynote, KEY_END_ONLY ? eA : Math.max(tA * 0.95, eA));
    scrim.style.opacity = Math.max(capAlpha(q), tA, eA).toFixed(3);
  }
  function vis(el, a) { el.style.opacity = a.toFixed(3); el.style.visibility = a > 0.003 ? "visible" : "hidden"; }
})();
