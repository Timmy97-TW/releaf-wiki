// b2-compact.glb -> a web model: parts grouped under named nodes, decimated to an
// absolute error, quantised and meshopt-compressed.
//   node build.mjs <in.glb> <out.glb> <error mm> [fastener error mm]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, weld, flatten, join, prune, quantize, meshopt, reorder} from '@gltf-transform/functions';
import {MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';

const [src, out, errMM = '0.4', fastMM = '1.0'] = process.argv.slice(2);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(src);
const root = doc.getRoot(), scene = root.listScenes()[0];

// which named group a part belongs to (first match wins)
const RULES = [
  ['light',      n => /^led strip/.test(n)],
  ['fasteners',  (n, m) => /Screw|SCREW|screw|Hex Nut|Hex nut|torque nut|PANEL_PIN/.test(n) && !/^clip/.test(n)],
  ['case',       (n, m) => /^case /.test(m)],
  ['membrane',   n => /^Part 1\.001$|hollow fibre|membrane clamp|column backplate/.test(n)],
  ['reservoir',  n => /^Part 1\.009$|^liquid Part 1\|113$|^Part 1\.002$|^vessel |^Part 1$|^Part 2\.001$|^Part 3\.003$/.test(n)],
  ['vent',       n => /^air_filter$|^filter strap|^tube f1$/.test(n)],
  ['photometer', (n, m) => /photometer/.test(m) || /photometer/.test(n) ||
                   /^Part (4|11|12|14|15|16)$|^Board$|^SOD|^SOT|^JST|^CHIPLED|^RESPACK|^0805|^INDUCTOR|^LED Bulb$|^OLED_1/.test(n)],
  ['pump',       n => /^Casing$|^Box$|^Cut Box Lid$|^Cover$|Rotor$|^Knob$|^NEMA|^Bearing|^Pinion$|^OLED Display$|^Air Grill$|^Fan Fastener$|^Part 1\.008$|^Part 2\.003$/.test(n)],
  ['dosing',     n => /^pump_[kp]$|pump saddle|KOH pump bracket/.test(n)],
  ['harvest',    n => /^Part 1\.004$|^liquid Part 1\|66$|^Part 2\.002$|^Part 3\.002$|^protectant dip|^output bulkhead/.test(n)],
  ['koh',        n => /^Part 1\.003$|^KOH liquid$|^KOH dip tube$|^Part 3\.001$/.test(n)],
  ['line-product', n => /^(tube|liquid) [po]\d/.test(n) || /^(tube|liquid) l[34]$/.test(n)],
  ['line-koh',   n => /^(tube|liquid) k\d/.test(n)],
  ['line-culture', n => /^(tube|liquid) [cls]\d/.test(n)],
  ['sensors',    n => /^pt_pt|^PT cradle/.test(n)],
  ['valves',     n => /^valve|^sc\d$|^adapter |^stopcock/.test(n)],
  ['sampler',    n => /^sampler/.test(n)],
  ['fixtures',   () => true],
];
const ROUGH = /^$/;
// Rebuild a primitive from position-welded triangles: a corner's normal is the
// area-weighted sum of the faces round that point that lie within `deg` of its own.
function creased(prim, P, I0, deg) {
  // one id per distinct position
  const ids = new Map(), I = new Uint32Array(I0.length), F = new Uint32Array(P.buffer, P.byteOffset, P.length);
  for (let i = 0; i < I0.length; i++) { const v = I0[i], h = F[3*v] + ',' + F[3*v+1] + ',' + F[3*v+2]; let n = ids.get(h); if (n === undefined) ids.set(h, n = v); I[i] = n; }
  const nt = I.length / 3, cos = Math.cos(deg * Math.PI / 180);
  const fn = new Float32Array(nt * 3), fu = new Float32Array(nt * 3), ok = new Uint8Array(nt);
  const byVert = new Map();
  for (let t = 0; t < nt; t++) {
    const a = I[3*t]*3, b = I[3*t+1]*3, c = I[3*t+2]*3;
    const ux = P[b]-P[a], uy = P[b+1]-P[a+1], uz = P[b+2]-P[a+2], vx = P[c]-P[a], vy = P[c+1]-P[a+1], vz = P[c+2]-P[a+2];
    const x = uy*vz-uz*vy, y = uz*vx-ux*vz, z = ux*vy-uy*vx, l = Math.hypot(x, y, z);
    if (!(l > 0)) continue;
    ok[t] = 1; fn[3*t] = x; fn[3*t+1] = y; fn[3*t+2] = z; fu[3*t] = x/l; fu[3*t+1] = y/l; fu[3*t+2] = z/l;
    for (let j = 0; j < 3; j++) { const v = I[3*t+j]; let L = byVert.get(v); if (!L) byVert.set(v, L = []); L.push(t); }
  }
  const pos = [], nor = [], idx = [], key = new Map();
  for (let t = 0; t < nt; t++) {
    if (!ok[t]) continue;
    for (let j = 0; j < 3; j++) {
      const v = I[3*t+j]; let x = 0, y = 0, z = 0;
      for (const o of byVert.get(v)) if (fu[3*t]*fu[3*o] + fu[3*t+1]*fu[3*o+1] + fu[3*t+2]*fu[3*o+2] >= cos) { x += fn[3*o]; y += fn[3*o+1]; z += fn[3*o+2]; }
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      const k = v + ':' + Math.round(x*63) + ',' + Math.round(y*63) + ',' + Math.round(z*63);
      let n = key.get(k);
      if (n === undefined) { n = pos.length / 3; key.set(k, n); pos.push(P[3*v], P[3*v+1], P[3*v+2]); nor.push(x, y, z); }
      idx.push(n);
    }
  }
  for (const s of prim.listSemantics()) prim.setAttribute(s, null);
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)));
}
const LOOSE = JSON.parse(process.env.LOOSE || '{}');
const groups = new Map(), tally = {};
const groupNode = id => { if (!groups.has(id)) { const g = doc.createNode(id); scene.addChild(g); groups.set(id, g); } return groups.get(id); };
const tris = p => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;

// The CAD's glass and liquids are path-tracer materials (transmission 1 inside
// transmission 1). A rasteriser draws those as nothing, so they become plain
// alpha-blended glass and tinted liquid, which every three.js version draws alike.
for (const m of root.listMaterials()) {
  const n = m.getName(), c = m.getBaseColorFactor();
  if (!m.getExtension('KHR_materials_transmission')) continue;
  if (/LED/.test(n)) continue;
  const liquid = /liquid|protectant|medium/.test(n);
  if (process.env.MAT === 'still') {   // for a still drawn with a transmission pass: glass stays, liquid turns solid
    if (liquid) m.setExtension('KHR_materials_transmission', null).setRoughnessFactor(0.35);
    continue;
  }
  m.setExtension('KHR_materials_transmission', null);
  const a = liquid ? (/cul/.test(n) ? 0.82 : 0.5) : /frosted/.test(n) ? 0.55 : /tube/.test(n) ? 0.34 : 0.2;
  m.setBaseColorFactor([c[0], c[1], c[2], a]).setAlphaMode('BLEND').setDoubleSided(!liquid);
  if (liquid) m.setEmissiveFactor([c[0] * 0.3, c[1] * 0.3, c[2] * 0.3]).setRoughnessFactor(0.3);
}
if (process.env.MAT !== 'still') for (const m of root.listMaterials()) for (const x of ['KHR_materials_specular', 'KHR_materials_ior']) m.setExtension(x, null);
await doc.transform(dedup(), weld());

const seen = new Set();
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const name = node.getName(), mats = mesh.listPrimitives().map(p => p.getMaterial()?.getName() || '').join('+');
  const id = RULES.find(r => r[1](name, mats))[0];
  const abs = (id === 'fasteners' ? +fastMM : +errMM) / 1000;
  for (const prim of mesh.listPrimitives()) {
    if (seen.has(prim)) continue; seen.add(prim);
    for (const s of prim.listSemantics()) if (/^TEXCOORD|^COLOR|^TANGENT/.test(s)) prim.setAttribute(s, null);
    const before = tris(prim);
    if (before > 60) {
      const sc = node.getWorldScale(), k = Math.max(Math.abs(sc[0]), Math.abs(sc[1]), Math.abs(sc[2])) || 1;
      const pos = prim.getAttribute('POSITION').getArray(), P = pos instanceof Float32Array ? pos : new Float32Array(pos);
      const src = prim.getIndices().getArray();
      // CAD export splits every hard edge into two vertices with different normals,
      // and those seams stop an edge collapse on flat panels: Permissive lets it
      // cross them, and creased() puts the hard edges back afterwards.
      const I = src instanceof Uint32Array ? src : new Uint32Array(src);
      // fasteners are thousands of separate threaded solids, which an edge collapse
      // cannot merge: they take the grid simplifier
      const rough = id === 'fasteners' || ROUGH.test(name);
      const e = (rough ? +fastMM : +errMM * (LOOSE[id] || 1)) / 1000 / k;
      const res = rough
        ? MeshoptSimplifier.simplifySloppy(I, P, 3, null, 0, e / MeshoptSimplifier.getScale(P, 3))[0]
        : MeshoptSimplifier.simplify(I, P, 3, 0, e, ['ErrorAbsolute', 'Prune', 'Permissive'])[0];
      if (res.length >= 3) creased(prim, P, res, rough ? 60 : 38);
    }
    if (process.env.DBG && tris(prim) > 2500) console.log('  big', id, name, before, '->', tris(prim));
    (tally[id] ??= [0, 0])[0] += before; tally[id][1] += tris(prim);
  }
  groupNode(id).addChild(node);
}
await doc.transform(join({keepNamed: false}), prune({keepAttributes: false}));
// one tidy child per group
for (const [id, g] of groups) g.listChildren().forEach((c, i) => c.setName(id + '.' + i));
await doc.transform(
  reorder({encoder: MeshoptEncoder}),
  quantize({quantizePosition: 14, quantizeNormal: 8}),
  meshopt({encoder: MeshoptEncoder, level: 'high'}));
await io.write(out, doc);
let a = 0, b = 0;
for (const [id, [x, y]] of Object.entries(tally)) { a += x; b += y; console.log(id.padEnd(14), String(x).padStart(8), '->', String(y).padStart(7)); }
console.log('total'.padEnd(14), String(a).padStart(8), '->', String(b).padStart(7), ' meshes', root.listMeshes().length, 'materials', root.listMaterials().length);
