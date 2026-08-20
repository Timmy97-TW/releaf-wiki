// V4 Photometer — part data.
//
// `pose` is a presentation tilt, eased in only as a part lifts out, so the
// assembled pose is untouched and the part still turns at exactly the rig's
// rate once on show. Values were chosen by measuring each part's smallest
// silhouette across a full revolution and picking the tilt that keeps it
// from ever going edge-on.
// Display size is not set here — it is derived from each part's silhouette.
//
// A part is either a single `file` (printed, grey) or a list of `layers`, each
// with its own material — used where one component needs more than one colour,
// such as the sensor boards and the LED. Layers share an origin and are centred
// together, so they stay assembled.
//
// Materials are defined in scene.js: printed · black · amber · clear · glass
// · pcb · chipGrey · chipBlack

const ALL_PARTS = [
  {
    id: "part1",
    notes: [[0, 0, 0, "LED through-hole"], [-26, 10, 0, "Rail wing"], [26, 10, 0, "Rail wing"]],
    file: "models/part1.stl",
    cad: "models/part1.stl",
    tag: "01",
    name: "LED Emitter Holder",
    role: "Light source mount",
    desc:
      "A winged cross-clamp that rides the tip of the mast. The amber LED seats " +
      "in the central square hole and fires a collimated beam straight down the " +
      "optical axis toward the cuvette and sensors below.",
    specs: [
      ["Beam source", "Amber LED (≈590 nm)"],
      ["Mount", "Square LED through-hole"],
      ["Fixing", "Two M-screw wings to rail"],
      ["Envelope", "60.5 × 38.0 × 33.8 mm"],
    ],
    pose: 0.35,
  },
  {
    id: "part2",
    notes: [[0, 0, 0, "Lens bore"], [-17, 0, 0, "Thin fin"]],
    file: "models/part2.stl",
    cad: "models/part2.stl",
    tag: "02",
    name: "Focus-Lens Fin",
    role: "Beam conditioning",
    desc:
      "A thin printed fin whose vertical bore seats the focusing lens, tightening " +
      "the amber beam before it reaches the beamsplitter.",
    specs: [
      ["Optic", "Focusing lens"],
      ["Wall", "5.5 mm thin fin"],
      ["Envelope", "42.0 × 5.5 × 33.2 mm"],
    ],
    pose: 0.75,
  },
  {
    id: "part3",
    notes: [[0, 6, 0, "45° beamsplitter slot"], [0, -20, 14, "Cuvette rest"], [30, -8, 0, "GY-302 bore"]],
    file: "models/part3.stl",
    cad: "models/part3.stl",
    tag: "03",
    name: "Optical Head",
    role: "Beamsplitter · cuvette · sensor",
    desc:
      "The functional core. A 45° angled slot holds the beamsplitter, which taps a " +
      "reference beam to one GY-302 sensor while the rest passes through the flow " +
      "cuvette — cradled in the twin U-rests at the back — to the sample GY-302.",
    specs: [
      ["Splitter", "45° beamsplitter slot"],
      ["Cuvette", "Twin U-rests (rear)"],
      ["Sensors", "2× GY-302 (BH1750)"],
      ["Envelope", "82.8 × 62.2 × 39.7 mm"],
    ],
    pose: 0.35,
  },
  {
    id: "part5",
    notes: [[0, 105, 0, "Mast top"], [0, -105, 0, "Foot"], [14, 0, 0, "Slot rail"]],
    file: "models/part5.stl",
    cad: "models/part5.stl",
    tag: "04",
    name: "Vertical Rail",
    role: "Structural backbone",
    desc:
      "The slotted mast that carries every optical stage in a fixed line, from the " +
      "LED at the tip down to the optical head at the base.",
    specs: [
      ["Type", "Slotted rail / mast"],
      ["Length", "250.8 mm"],
      ["Envelope", "38.1 × 250.8 × 25.4 mm"],
    ],
    pose: 0.5,
  },
  {
    id: "part6",
    notes: [[0, 14, 0, "8.1° stand face"], [-48, -12, -48, "Contact pad"], [48, -12, 48, "Contact pad"]],
    file: "models/part6.stl",
    cad: "models/part6.stl",
    tag: "05",
    name: "Angled Wedge Base",
    role: "Tilt stand",
    desc:
      "An open square frame that tilts the whole column — the trick that lets air " +
      "bubbles rise out of the flow cuvette instead of scattering the beam.",
    specs: [
      ["Function", "Tilts column, sheds bubbles"],
      ["Form", "Open square frame"],
      ["Envelope", "127 × 41.5 × 127 mm"],
    ],
    pose: 0.5,
  },
  {
    id: "part7",
    notes: [[0, 26, 0, "Snap-in cover"], [0, -24, 12, "Light seal"]],
    file: "models/part7.stl",
    cad: "models/part7.stl",
    tag: "06",
    name: "Optical-Head Shell",
    role: "Light-tight cover",
    desc:
      "The hollow cover that caps the optical head. Its aperture lines up with the " +
      "sensor bore; the top slots route sensor wiring out.",
    specs: [
      ["Role", "Cover for Part 03"],
      ["Aperture", "Sensor-aligned bore"],
      ["Envelope", "90.1 × 71.0 × 33.3 mm"],
    ],
    pose: 0.35,
  },
  {
    id: "part8",
    file: "models/part8.stl",
    cad: "models/part8.stl",
    tag: "07",
    name: "Light Shield · Long",
    role: "Stray-light baffle",
    desc:
      "A snap-in cover that follows the beam path, sealing out ambient light so only " +
      "the LED reaches the sensors.",
    specs: [
      ["Function", "Blocks stray light"],
      ["Fit", "Snap-in, follows path"],
      ["Envelope", "51.1 × 91.9 × 37.5 mm"],
    ],
    pose: 0.5,
  },
  {
    id: "part9",
    file: "models/part9.stl",
    cad: "models/part9.stl",
    tag: "08",
    name: "Light Shield · Short",
    role: "Stray-light baffle",
    desc:
      "The shorter snap-in cover completing the light-tight tunnel along the beam.",
    specs: [
      ["Function", "Blocks stray light"],
      ["Fit", "Snap-in, follows path"],
      ["Envelope", "51.1 × 41.9 × 37.5 mm"],
    ],
    pose: 0.5,
  },
];

// ---------- bought-in optical + electronic components ----------

ALL_PARTS.push(
  {
    id: "led-bulb",
    notes: [[0, 4, 0, "~590 nm emitter"]],
    layers: [
      { file: "models/led-bulb-body.stl", mat: "amber" },
      { file: "models/led-bulb-pin.stl", mat: "clear" },
    ],
    name: "Amber LED",
    role: "Light source",
    desc:
      "A 5 mm amber LED, roughly 590 nm — close enough to the 600 nm absorbance " +
      "peak to track cell density. It fires straight down the optical axis from " +
      "the top of the mast.",
    specs: [
      ["Type", "5 mm through-hole LED"],
      ["Wavelength", "Amber, ≈590 nm"],
      ["Body", "Amber epoxy, clear pin"],
      ["Envelope", "5.4 × 14.7 × 5.8 mm"],
    ],
    pose: 0.25,
  },
  {
    id: "led-holder",
    layers: [{ file: "models/led-holder.stl", mat: "black" }],
    name: "LED Bezel",
    role: "Light-tight collar",
    desc:
      "A black collar that grips the LED and masks everything but the forward " +
      "beam, so no light leaks sideways into the housing.",
    specs: [
      ["Function", "Grips and masks the LED"],
      ["Finish", "Matte black"],
      ["Envelope", "8.2 × 7.1 × 8.3 mm"],
    ],
    pose: 0.5,
  },
  {
    id: "lens",
    notes: [[0, 0, 0, "Focusing lens"]],
    layers: [{ file: "models/lens.stl", mat: "glass" }],
    name: "Focusing Lens",
    role: "Beam conditioning",
    desc:
      "A 13 mm lens seated in the printed fin. It tightens the LED's spread into " +
      "a narrow beam before the split, so both sensors see a clean, even spot.",
    specs: [
      ["Optic", "Plano-convex lens"],
      ["Diameter", "13.1 mm"],
      ["Material", "Transparent"],
      ["Envelope", "13.1 × 3.3 × 13.1 mm"],
    ],
    pose: 0.75,
  },
  {
    id: "beamsplitter",
    notes: [[0, 0, 0, "Splits the beam"]],
    layers: [{ file: "models/beamsplitter.stl", mat: "glass" }],
    name: "Beamsplitter",
    role: "Splits the beam 45°",
    desc:
      "Held at 45° in the optical head. It passes most of the beam down through " +
      "the cuvette and reflects the rest sideways to the reference sensor — the " +
      "trick that lets the instrument cancel LED drift.",
    specs: [
      ["Angle", "45° to the beam"],
      ["Passes", "→ sample sensor"],
      ["Reflects", "→ reference sensor"],
      ["Envelope", "12.0 × 12.0 × 14.5 mm"],
    ],
    pose: 0.5,
  },
  {
    id: "cuvette",
    notes: [[0, 0, 0, "0.2 mm path"], [-30, 0, 0, "Inlet"], [30, 0, 0, "Outlet"]],
    layers: [{ file: "models/cuvette.stl", mat: "glass" }],
    name: "Flow Cuvette",
    role: "The sample path",
    desc:
      "Culture flows continuously through this cuvette while the beam crosses it. " +
      "Tilting the whole column is what keeps air bubbles rising out of the light " +
      "path instead of scattering the reading.",
    specs: [
      ["Type", "Inline flow cuvette"],
      ["Length", "76 mm"],
      ["Contents", "Live culture"],
      ["Envelope", "76.0 × 4.0 × 10.0 mm"],
    ],
    pose: 0.75,
  },
  {
    id: "sensor-sample",
    notes: [[0, 0, 0, "BH1750 die"], [0, 0, -7, "I²C header"]],
    layers: [
      { file: "models/sensor-sample-pcb.stl", mat: "pcb" },
      { file: "models/sensor-sample-grey.stl", mat: "chipGrey" },
      { file: "models/sensor-sample-black.stl", mat: "chipBlack" },
    ],
    name: "Sample Sensor",
    role: "GY-302 · measures",
    desc:
      "A GY-302 (BH1750) lux sensor reading the beam after it has crossed the " +
      "culture. Dividing this by the reference gives optical density.",
    specs: [
      ["Sensor", "GY-302 (BH1750)"],
      ["Reads", "Beam after the cuvette"],
      ["Output", "Lux, over I²C"],
      ["Envelope", "14.7 × 2.3 × 19.4 mm"],
    ],
    pose: 0.75,
  },
  {
    id: "sensor-reference",
    notes: [[0, 0, 0, "Reference die"]],
    layers: [
      { file: "models/sensor-reference-pcb.stl", mat: "pcb" },
      { file: "models/sensor-reference-grey.stl", mat: "chipGrey" },
      { file: "models/sensor-reference-black.stl", mat: "chipBlack" },
    ],
    name: "Reference Sensor",
    role: "GY-302 · cancels drift",
    desc:
      "An identical GY-302 mounted to one side, catching the beamsplitter's " +
      "reflection before it ever reaches the sample. If the LED dims, both " +
      "readings fall together and their ratio holds — so the OD stays honest.",
    specs: [
      ["Sensor", "GY-302 (BH1750)"],
      ["Reads", "Reflected reference beam"],
      ["Purpose", "Cancels LED drift"],
      ["Envelope", "2.3 × 14.7 × 19.4 mm"],
    ],
    pose: 0.75,
    // faces inward in the assembly, so turn it around to show the components
    flip: true,
  }
);

// --- order of disassembly ---
// Follows the beam from source to sensors, which is also roughly top-to-bottom
// on the real instrument — so the assembly comes apart from the top down, and
// each optic appears next to the printed part that holds it.
const ORDER = [
  "led-bulb", "led-holder", "part1",   // source
  "lens", "part2",                      // conditioning
  "part9", "part8",                     // light shields
  "beamsplitter", "part7", "part3",     // the split + optical head
  "cuvette",                            // the sample
  "sensor-sample", "sensor-reference",  // the two readings
  "part5", "part6",                     // structure
];

const PARTS = ORDER.map(function (id) {
  return ALL_PARTS.filter(function (p) { return p.id === id; })[0];
}).filter(Boolean);

// number the tags by position in the walkthrough, not by STL filename
PARTS.forEach(function (p, i) {
  p.tag = (i + 1 < 10 ? "0" : "") + (i + 1);
});
