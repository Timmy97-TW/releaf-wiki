// Pickable components — shared by the record page (picker) and the promo
// scene (guided tour). Kept in one file so the two cannot drift apart.

// A "component" is what a reader points at — the photometer, the pump — which
// is usually several meshes. `bom` matches the first cell of a bill-of-materials
// row so the diagram and the table can highlight each other. `flow` says which
// circuit the part belongs to, and drives the accent colour.
const BIO_COMPONENTS = [
  {
    id: "membrane",
    label: "Hollow-fiber membrane",
    role: "Separates culture from product",
    note: "PES fibers, ~200 mL lumen volume. Protectant crosses the fiber wall into the shell space; B. subtilis cannot.",
    flow: "both",
    bom: "PES hollow fiber membrane",
    meshes: ["membrane-shell", "membrane-fiber"],
  },
  {
    id: "photometer",
    label: "In-line photometer",
    role: "Reads OD600 without sampling",
    note: "The V4 instrument, sitting in the return leg. Dual-sensor ratiometric, 0.2 mm optical path.",
    flow: "lumen",
    bom: "In-line photometer",
    href: "../photometer/index.html",
    // the sensor harness spans the whole rig; excluded from tour framing
    frameSkip: ["sensor-electronics"],
    meshes: ["head-shell", "optical-head", "rail", "wedge-base", "shield-a", "shield-b",
             "led-emitter-holder", "lens-fin", "strap-a", "strap-b", "slit", "led-holder",
             "cuvette", "lens", "beamsplitter", "led-bulb", "sensor-board-a",
             "sensor-board-b", "sensor-electronics", "light-path"],
  },
  {
    id: "reservoir",
    label: "Medium reservoir",
    role: "Where the culture grows",
    note: "500 mL vessel, 300 mL working volume, stirred at 200 rpm to stop the cells settling out.",
    flow: "lumen",
    bom: "Medium reservoir",
    meshes: ["media-bottle", "media-cap"],
  },
  {
    id: "vent",
    label: "Sterile O₂ vent",
    role: "Gas exchange, sealed to cells",
    note: "A membrane air filter: the culture breathes without the vessel being opened.",
    flow: "lumen",
    meshes: ["media-vent"],
  },
  {
    id: "pump",
    label: "Peristaltic pump",
    role: "Drives the loop at 94 mL/min",
    note: "Non-contact pumping — the fluid only ever touches tubing, so the path stays sterile.",
    flow: "lumen",
    bom: "Peristaltic pump",
    meshes: ["pump-box", "pump-lid", "pump-casing", "pump-panel", "pump-knob",
             "pump-rotor-back", "pump-rotor-front", "pump-oled", "pump-motor",
             "pump-pinion", "pump-bearing", "pump-grill", "pump-fan-plate",
             "pump-barb-a", "pump-barb-b"],
  },
  {
    id: "harvest",
    label: "Harvest vessel",
    role: "Collects cell-free protectant",
    note: "Shell-side fluid ends here. Medium drawn from this side and plated produced no colonies.",
    flow: "shell",
    bom: "Harvest vessel",
    meshes: ["main-bottle", "main-cap", "main-cap-plate"],
  },
  {
    id: "probes",
    label: "Sensor probes",
    role: "pH and optical monitoring",
    note: "Submerged in the harvest vessel. Black rather than grey so they read through the glass.",
    flow: "shell",
    bom: "pH sensor + regulator",
    meshes: ["probe-a", "probe-b"],
  },
];
