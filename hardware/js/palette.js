// Per-body appearance for the product model.
//
// Colours are measured, not chosen. The team's Onshape render was aligned to
// the model (an orthographic view along +X at 0.996 px/mm), a body-ID buffer
// rendered from that same view, and each body's colour read off the render at
// the pixels that body demonstrably owns. Bodies with too few clean pixels to
// measure fall back to the CAD's own material and say so in `source`.
//
// Anything reading this file should honour `source`: "measured" is a fact
// about the render, "inferred-cad" is the file's best guess.
(function (global) {
  "use strict";

  function hexToColor(h) {
    return new THREE.Color(
      parseInt(h.substr(1, 2), 16) / 255,
      parseInt(h.substr(3, 2), 16) / 255,
      parseInt(h.substr(5, 2), 16) / 255);
  }

  // Glass is the one thing a flat colour cannot carry: the reference shows
  // whatever is behind the vessel, so its sampled colour is the background,
  // not the vessel. Those bodies get low opacity and a near-neutral tint.
  // Two colours per body, and which one you want depends on whether you light
  // the scene yourself:
  //   entry.colour  -- the unshaded surface (80th percentile of the samples).
  //                    Right for flat compositing, where nothing else lightens it.
  //   entry.shaded  -- the colour the reference actually shows (median).
  //                    Right as an ALBEDO for a lit scene: the reference already
  //                    has light baked in, so feeding the unshaded value into a
  //                    renderer that lights it again comes out washed out.
  // A lit three.js scene is the second case, so that is the default here.
  function materialFor(entry, unlit) {
    const glass = entry.transparent || entry.opacity < 0.99;
    const m = new THREE.MeshStandardMaterial({
      color: hexToColor(unlit ? entry.colour : (entry.shaded || entry.colour)),
      roughness: glass ? 0.10 : 0.55,
      metalness: glass ? 0.00 : (entry.sat > 0.25 ? 0.25 : 0.12)
    });
    // The palette's colours were measured off a render that already had light
    // in it. An image-based environment at full strength lights them a second
    // time and the black case comes out grey, so the IBL is dialled back to a
    // sheen and the lambert terms carry the shading.
    m.envMapIntensity = glass ? 0.85 : 0.25;
    if (glass) {
      m.transparent = true;
      m.opacity = Math.max(0.18, Math.min(0.55, entry.opacity || 0.30));
      m.depthWrite = false;
    }
    m.userData.baseOpacity = m.transparent ? m.opacity : 1;
    m.userData.entry = entry;
    return m;
  }

  function load(dir) {
    const base = dir.charAt(dir.length - 1) === "/" ? dir : dir + "/";
    return fetch(base + "palette.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (list) {
        const by = {};
        list.forEach(function (e) { by[e.part] = e; });
        return { list: list, byPart: by };
      });
  }

  global.Palette = { load: load, materialFor: materialFor, hexToColor: hexToColor };
})(window);
