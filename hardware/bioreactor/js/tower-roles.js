// Role vocabulary for the product model — one source of truth.
//
// A role says what a body IS; the material and the subsystem it belongs to
// follow from that. The names continue the vocabulary js/product.js already
// uses for the previous version of this machine, so both models stay
// describable in the same words.
//
// Read by dev/labeller (which writes roles.json) and by js/tower.js (which
// renders it). Keep them in step by keeping them here.
(function (global) {
  "use strict";

  const ROLES = {
    hidden:              { hide: true,  sub: null,     name: "not shown" },

    // --- the PC case it is built into -------------------------------------
    // Assigned automatically; nobody names these. The tones are inverted from
    // what the CAD says: Onshape paints the outer panels #4d4d4d and the inner
    // rails near-black, and the real tower is the other way round — black
    // panels, bare aluminium frame. Albedo for the black runs lower than a
    // literal black because ACES over a bright studio env lifts it anyway.
    // env dialled right down: a near-black albedo under a bright studio IBL
    // reads as mid grey, because at metalness 0.16 the panel is mostly showing
    // you the environment rather than its own colour.
    caseShell:           { color: 0x121417, rough: 0.74, metal: 0.03, env: 0.30, sub: "case", name: "panel" },
    caseFrame:           { color: 0x767d86, rough: 0.42, metal: 0.62, sub: "case", name: "bracket" },
    caseRail:            { color: 0x848c95, rough: 0.38, metal: 0.70, sub: "case", name: "frame rail" },
    caseTrim:            { color: 0x9aa0a8, rough: 0.38, metal: 0.55, sub: "case", name: "trim" },
    caseSteel:           { color: 0x9aa5af, rough: 0.30, metal: 0.85, sub: "case", name: "fastener" },

    // --- generic fallbacks -------------------------------------------------
    box:                 { color: 0x121417, rough: 0.74, metal: 0.03, env: 0.30, sub: "case", name: "enclosure" },
    boxLid:              { color: 0x121417, rough: 0.74, metal: 0.03, env: 0.30, sub: "case", name: "cover" },
    boxFront:            { color: 0x8fa6bd, rough: 0.12, metal: 0.00, opacity: 0.22, sub: "case", name: "window" },
    charcoal:            { color: 0x3a3f47, rough: 0.62, metal: 0.20, sub: "structure", name: "structure" },
    mount:               { color: 0x4a5058, rough: 0.60, metal: 0.30, sub: "structure", name: "mounting plate" },

    reservoirCulture:    { color: 0xd8e6dc, rough: 0.10, metal: 0.00, opacity: 0.30, sub: "vessels", name: "culture vessel" },
    reservoirProtectant: { color: 0xe8dcc8, rough: 0.10, metal: 0.00, opacity: 0.30, sub: "vessels", name: "reservoir" },
    medium:              { color: 0xe0a95a, rough: 0.15, metal: 0.00, opacity: 0.55, sub: "vessels", name: "medium" },
    membrane:            { color: 0xf1f1ee, rough: 0.45, metal: 0.00, sub: "vessels", name: "membrane" },
    membraneHousing:     { color: 0xc6ccd3, rough: 0.35, metal: 0.10, sub: "vessels", name: "membrane housing" },

    pumpBody:            { color: 0x24272c, rough: 0.55, metal: 0.10, sub: "fluidics", name: "pump body" },
    pumpAccent:          { color: 0xff8a1e, rough: 0.35, metal: 0.05, sub: "fluidics", name: "pump rotor" },
    tubing:              { color: 0xd9dde2, rough: 0.25, metal: 0.00, opacity: 0.55, sub: "fluidics", name: "tubing" },

    motor:               { color: 0x1d1f23, rough: 0.60, metal: 0.25, sub: "drive", name: "motor" },
    steel:               { color: 0x9aa5af, rough: 0.30, metal: 0.85, sub: "structure", name: "hardware" },
    gear:                { color: 0xb6bec7, rough: 0.28, metal: 0.80, sub: "drive", name: "gear" },

    photoBody:           { color: 0x141519, rough: 0.78, metal: 0.02, sub: "optics", name: "optical housing" },
    led:                 { color: 0xffb648, rough: 0.30, metal: 0.00, emissive: 0xff8a1e, sub: "optics", name: "LED" },
    glass:               { color: 0xdfe8ee, rough: 0.06, metal: 0.00, opacity: 0.24, sub: "optics", name: "optic" },
    probe:               { color: 0x0e0f11, rough: 0.50, metal: 0.10, sub: "sensing", name: "probe" },

    pcb:                 { color: 0x1d6b3f, rough: 0.55, metal: 0.05, sub: "electronics", name: "board" },
    screen:              { color: 0x16233d, rough: 0.25, metal: 0.05, sub: "electronics", name: "display" },
    smd:                 { color: 0x5a5f66, rough: 0.55, metal: 0.30, sub: "electronics", name: "component" }
  };

  // Walkthrough units. Seventy-eight parts cannot each get a beat -- at the
  // house beat length that is 3285vh of scroll -- so the unit is a subsystem.
  // How far each flies on the explode is set here too: the shell has to clear
  // the internals before the internals are worth looking at.
  const SUBSYSTEMS = [
    { key: "case",        label: "PC case",     blurb: "the tower it is built into — shell, rails, brackets, fasteners", explode: 1.00, shell: true },
    { key: "structure",   label: "Mounting",    blurb: "the plate and hardware the machine is built on", explode: 0.35 },
    { key: "vessels",     label: "Vessels",     blurb: "culture vessel, reservoir and membrane",       explode: 0.30 },
    { key: "fluidics",    label: "Fluidics",    blurb: "peristaltic pump and tubing",                  explode: 0.45 },
    { key: "drive",       label: "Drive",       blurb: "stepper motor and gear train",                 explode: 0.45 },
    { key: "optics",      label: "Optics",      blurb: "in-line photometer and its LED",               explode: 0.55 },
    { key: "sensing",     label: "Sensing",     blurb: "probes in the culture",                        explode: 0.35 },
    { key: "electronics", label: "Electronics", blurb: "control board and display",                    explode: 0.60 }
  ];

  global.TOWER_ROLES = { ROLES: ROLES, SUBSYSTEMS: SUBSYSTEMS };
})(window);
