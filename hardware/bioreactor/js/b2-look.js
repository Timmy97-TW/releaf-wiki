// B2 look: material overrides by Blender material name, tuned against the r5 renders
// (dev/lab-bioreactor/b2-model/renders/b2-hero_io.jpg, b2-hero_back.jpg). First match wins.
// Anything not listed is mapped from its own Principled numbers in b2-core.js.
(function () {
  "use strict";
  const O = B2.override;
  O(/hidden core/i, { kind: "hide" });
  // the culture: the film's amber medium (the renders' bottle), a touch of its own light (illustrative)
  // round 1 (judges): honey amber, see-through, no light of its own: the renders' culture, not a lamp
  O(/reservoir medium/i, { kind: "liquid", color: "#9a7232", glow: "#9a7232", gi: 0.0, opacity: 0.74 });
  // protectant and KOH: nearly water-clear. A liquid you can see through is drawn as glass with a faint tint.
  O(/^protectant$/i, { kind: "glass", tint: "#f3efe0", face: 0.06, rim: 0.3 });
  O(/liquid koh/i, { kind: "glass", tint: "#eef1f6", face: 0.05, rim: 0.3 });
  O(/reservoir glass|clear glass|^glass /i, { kind: "glass", face: 0.025, rim: 0.42 });
  O(/amber LED/i, { kind: "emit", color: "#ff8a1e", i: 3 });
  O(/^display$/i, { kind: "emit", color: "#2f9c82", i: 0.55 });
  // the film's LED strips: mint, bright enough to bloom a little, never a flood
  // round 1: a thin, dim line, as in the renders (it was the brightest thing in most close frames)
  O(/led|strip/i, { kind: "emit", color: "#6fe8ad", i: 0.9 });
  // the V4: the film's all-black reads as a hole on this stage; graphite keeps it black-ish with form (round 1)
  O(/photometer black PLA/i, { color: "#17191c", rough: 0.42, coat: 0.12, metal: 0 });
  // white lab bodies (luer bodies, PT end fittings, pump rollers): matte, so they do not bloom chalk-white
  O(/^lab #(e6e6e6|eaeaea)$/i, { color: "#d9d9d6", rough: 0.62, coat: 0, metal: 0 });
  // the pump box's rotor and screws: rougher steel, so the rotor does not flare to a white hotspot (round 1)
  O(/^steel$/i, { color: "#9ea2a6", rough: 0.42, metal: 1, env: 0.9 });
  // proposed parts (mats.py)
  O(/black acrylic/i, { color: "#0d0e10", rough: 0.24, coat: 0.15, metal: 0 });
  O(/anodised aluminium/i, { color: "#b4b9bf", rough: 0.34, metal: 1 });
  O(/stainless/i, { color: "#a8acb0", rough: 0.3, metal: 1 });
  O(/proposed nylon natural/i, { color: "#e8e4da", rough: 0.5, metal: 0 });
  O(/proposed nylon/i, { color: "#1a1b1e", rough: 0.55, metal: 0 });
  O(/grommet/i, { color: "#141414", rough: 0.7, metal: 0 });
  // clear lab parts (stopcock bodies, luer fittings, V2 heads, syringe barrel): thin tinted glass
  O(/^frosted/i, { kind: "glass", face: 0.1, rim: 0.45, rough: 0.2 });
  O(/^clear /i, { kind: "glass", face: 0.05, rim: 0.5 });
})();
