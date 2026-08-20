// Promo bioreactor — every baked part and the material it renders with.
//
// All meshes share one world frame (baked by the assembly script): the scene
// assembles by simply loading everything. Colors follow the team's Onshape
// promo render. The two probes are deliberately BLACK, not grey — they sit
// behind the main bottle's glass, and transmission tints anything behind it,
// so grey would render as a muddy nothing.
const BIO_PARTS = [
  // — photometer, in situ on its wedge (black print per the promo) —
  { file: "led-emitter-holder", mat: "blackPrint" },
  { file: "lens-fin",           mat: "blackPrint" },
  { file: "optical-head",       mat: "blackPrint" },
  { file: "head-shell",         mat: "blackPrint" },
  { file: "rail",               mat: "blackPrint" },
  { file: "wedge-base",         mat: "blackPrint" },
  { file: "shield-a",           mat: "blackPrint" },
  { file: "shield-b",           mat: "blackPrint" },
  { file: "strap-a",            mat: "blackPrint" },
  { file: "strap-b",            mat: "blackPrint" },
  { file: "slit",               mat: "blackPrint" },
  { file: "led-holder",         mat: "blackPrint" },
  { file: "cuvette",            mat: "glass" },
  { file: "lens",               mat: "glass" },
  { file: "beamsplitter",       mat: "glass" },
  { file: "led-bulb",           mat: "amber" },
  { file: "sensor-board-a",     mat: "pcb" },
  { file: "light-path",         mat: "beam" },
  { file: "sensor-board-b",     mat: "pcb" },
  { file: "sensor-electronics", mat: "charcoal" },

  // — hollow-fiber membrane column —
  { file: "membrane-shell", mat: "bottleGlass" },
  { file: "membrane-fiber", mat: "white" },

  // — media bottle (milkier than the main vessel) —
  { file: "media-bottle", mat: "frostBottle" },
  { file: "media-cap",    mat: "navy" },
  { file: "media-vent",   mat: "greyLight" },
  { file: "media-feed",   mat: "tube" },

  // — main vessel with the two submerged probes —
  { file: "main-bottle",    mat: "bottleGlass" },
  { file: "main-cap",       mat: "navy" },
  { file: "main-cap-plate", mat: "navy" },
  { file: "probe-a",        mat: "probeBlack" },
  { file: "probe-b",        mat: "probeBlack" },

  // — plumbing and wiring —
  { file: "tube-photometer", mat: "tube" },
  { file: "tube-return",     mat: "tube" },
  { file: "tube-service-a",  mat: "tube" },
  { file: "tube-service-b",  mat: "tube" },
  { file: "tube-pump",       mat: "tube" },
  { file: "sensor-cable",    mat: "cable" },

  // — peristaltic pump (assembled by the bake) —
  { file: "pump-box",         mat: "blackPrint" },
  { file: "pump-lid",         mat: "blackPrint" },
  { file: "pump-casing",      mat: "skyBlue" },
  { file: "pump-rotor-back",  mat: "rotorBlue" },
  { file: "pump-rotor-front", mat: "rotorBlue" },
  { file: "pump-panel",       mat: "skyBlue" },
  { file: "pump-oled",        mat: "charcoal" },
  { file: "pump-knob",        mat: "knobBlue" },
  { file: "pump-motor",       mat: "charcoal" },
  { file: "pump-pinion",      mat: "charcoal" },
  { file: "pump-bearing",     mat: "charcoal" },
  { file: "pump-grill",       mat: "charcoal" },
  { file: "pump-fan-plate",   mat: "charcoal" },
  { file: "pump-barb-a",      mat: "steel" },
  { file: "pump-barb-b",      mat: "steel" },
];
