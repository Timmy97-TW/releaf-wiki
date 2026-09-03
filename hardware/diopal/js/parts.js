// DiOPAL — part data.
//
// `pose` is a presentation tilt, eased in only as a part lifts out, so the
// assembled pose is untouched and the part still turns at the rig's rate once
// on show. Display size is derived from each part's silhouette, not set here.
//
// A part is either a single `file`, a list of `layers` (one per material), or
// `procedural` — geometry built in code, used for the LED array.
//
// Materials are defined in scene.js: black · grey · white · pcb · ledGreen · ledRed

// ---------------------------------------------------------------------------
// The array. 6 columns × 4 rows on an 18 mm pitch, measured off the CAD.
// Columns run: green low, red low, green mid, red mid, green high, red high.
// The lux figures are the real matched-LED measurements at 5 V — greens in
// kLux, reds in Lux — so on-screen brightness is driven by measured output.
// ---------------------------------------------------------------------------
const GRID = {
  cols: [-45, -27, -9, 9, 27, 45],
  rows: [27, 9, -9, -27],
  pitch: 18,
};

const CHANNELS = [
  { x: -45, hue: "green", tier: "Low",  nm: 520, lux: [2.33, 2.33, 2.33, 2.34], unit: "kLux" },
  { x: -27, hue: "red",   tier: "Low",  nm: 660, lux: [390, 393, 397, 397],     unit: "Lux"  },
  { x:  -9, hue: "green", tier: "Mid",  nm: 520, lux: [2.35, 2.36, 2.37, 2.37], unit: "kLux" },
  { x:   9, hue: "red",   tier: "Mid",  nm: 660, lux: [410, 410, 411, 416],     unit: "Lux"  },
  { x:  27, hue: "green", tier: "High", nm: 520, lux: [2.38, 2.40, 2.40, 2.42], unit: "kLux" },
  { x:  45, hue: "red",   tier: "High", nm: 660, lux: [424, 428, 430, 431],     unit: "Lux"  },
];

// Every LED that was bought and measured at 5 V, before matching. Twelve of each
// twenty were selected; the other eight are the ones that did not match closely
// enough to any group. Greens in kLux, reds in Lux.
const LED_STOCK = {
  green: [2.54, 2.19, 2.33, 2.40, 2.40, 2.37, 2.11, 2.34, 2.48, 2.33,
          2.01, 2.37, 2.38, 2.42, 2.36, 2.33, 2.05, 2.35, 2.45, 2.20],
  red:   [431, 371, 424, 393, 438, 400, 380, 430, 397, 360,
          410, 410, 360, 416, 397, 411, 390, 360, 388, 428],
};

const ALL_PARTS = [
  {
    id: "tube-holder",
    layers: [{ file: "models/tube-holder.stl", mat: "white" }],
    cad: "models/tube-holder.stl",
    name: "Tube Holder",
    role: "Sample rack",
    desc:
      "The tall white block that seats 24 test tubes directly over the array, one " +
      "per LED. Each tube sits in its own bore, so every culture receives only the " +
      "channel beneath it.",
    specs: [
      ["Holds", "24 test tubes"],
      ["Grid", "6 × 4, 18 mm pitch"],
      ["Bore", "⌀16.8 mm"],
      ["Material", "White PLA"],
      ["Envelope", "134 × 111 × 80 mm"],
    ],
    pose: 1.2,
    build: { step: 4, from: [0, 1, 0] },
  },
  {
    id: "led-array",
    procedural: "ledArray",
    name: "The Array",
    role: "24 LEDs · 6 channels",
    desc:
      "Twenty-four LEDs in six columns: green and red at low, medium and high " +
      "intensity, four resistance-matched LEDs to a column. One run compares every " +
      "condition at once, under identical surroundings.",
    specs: [
      ["Layout", "6 columns × 4 rows"],
      ["Green", "~535 nm — induces"],
      ["Red", "~670 nm — halts"],
      ["Tiers", "Low · Mid · High"],
      ["Replicates", "4 per condition"],
    ],
    pose: 0,
    legend: true,
    // A 6 x 4 pattern only reads face-on; spinning it edge-on twice a
    // revolution would destroy the very thing this part exists to show.
    hold: true,
    build: { step: 1, from: [0, -1, 0] },
  },
  {
    id: "led-holder",
    layers: [{ file: "models/led-holder.stl", mat: "black" }],
    cad: "models/led-holder.stl",
    name: "LED Holder",
    role: "Array registration",
    desc:
      "A black plate carrying all 24 LEDs on the same 18 mm grid as the tubes above. " +
      "Printing it black keeps light from bleeding between neighbouring channels, so " +
      "a low-intensity well is not contaminated by a high-intensity one beside it.",
    specs: [
      ["Positions", "24, ⌀15.5 mm"],
      ["Grid", "6 × 4, 18 mm pitch"],
      ["Material", "Black PLA"],
      ["Envelope", "132 × 111 × 20 mm"],
    ],
    pose: 1.2,
    build: { step: 1, from: [0, -1, 0] },
  },
  {
    id: "perf-board",
    layers: [{ file: "models/perf-board.stl", mat: "pcb" }],
    name: "Perf Board",
    role: "Wiring plane",
    desc:
      "The only bought-in structural part. Every LED is soldered here and grouped " +
      "into its column, with each group switched by a MOSFET under Arduino PWM.",
    specs: [
      ["Type", "Perforated prototype board"],
      ["Carries", "24 LEDs in 6 groups"],
      ["Switching", "MOSFET per group"],
      ["Envelope", "160 × 100 × 1.5 mm"],
    ],
    pose: 1.2,
    build: { step: 1, from: [0, -1, 0] },
  },
  {
    id: "left-c",
    layers: [{ file: "models/left-c.stl", mat: "grey" }],
    cad: "models/left-c.stl",
    name: "Left Slider",
    role: "Tool-free assembly",
    desc:
      "One of a mirrored pair of sliding brackets. They let the stack be opened and " +
      "closed without tools, which is what turned the array from a bench breadboard " +
      "into something serviceable.",
    specs: [
      ["Function", "Slide-in retention"],
      ["Pair", "Mirrored with right"],
      ["Material", "Grey PLA"],
      ["Envelope", "71 × 139 × 14 mm"],
    ],
    pose: 0.9,
    build: { step: 3, from: [-1, 0, 0] },
  },
  {
    id: "right-c",
    layers: [{ file: "models/right-c.stl", mat: "grey" }],
    cad: "models/right-c.stl",
    name: "Right Slider",
    role: "Tool-free assembly",
    desc:
      "The mirror of the left slider, on the opposite face of the housing. Together " +
      "they carry the internal stack and allow disassembly for rewiring.",
    specs: [
      ["Function", "Slide-in retention"],
      ["Pair", "Mirrored with left"],
      ["Material", "Grey PLA"],
      ["Envelope", "71 × 139 × 14 mm"],
    ],
    pose: 0.9,
    build: { step: 3, from: [1, 0, 0] },
  },
  {
    id: "housing",
    layers: [{ file: "models/housing.stl", mat: "black" }],
    cad: "models/housing.stl",
    name: "Housing",
    role: "Light shield · enclosure",
    desc:
      "The black outer frame. It encloses the wiring and the Arduino, and — more " +
      "importantly — blocks ambient light from reaching the cultures. Without it the " +
      "low-intensity conditions would be confounded by room light.",
    specs: [
      ["Function", "Shields from ambient light"],
      ["Houses", "Wiring and Arduino"],
      ["Material", "Black PLA"],
      ["Envelope", "211 × 164 × 102 mm"],
    ],
    pose: 1.2,
    // goes to glass while the internals slide in
    ghost: true,
    build: { step: 0, from: [0, 0, 0] },
  },
  {
    id: "base-plate",
    layers: [{ file: "models/base-plate.stl", mat: "grey" }],
    cad: "models/base-plate.stl",
    name: "Base Plate",
    role: "Foundation",
    desc:
      "The grey floor of the instrument, with standoff posts that set the height of " +
      "the perf board above it and give the whole stack something flat to sit on.",
    specs: [
      ["Function", "Foundation and standoffs"],
      ["Material", "Grey PLA"],
      ["Envelope", "211 × 164 × 41 mm"],
    ],
    pose: 1.2,
    build: { step: 2, from: [0, -1, 0] },
  },
];

// --- order of disassembly: top down, the way you would actually take it apart ---
const ORDER = [
  "tube-holder", "led-array", "led-holder", "perf-board",
  "left-c", "right-c", "housing", "base-plate",
];

const PARTS = ORDER.map(function (id) {
  return ALL_PARTS.filter(function (p) { return p.id === id; })[0];
}).filter(Boolean);

PARTS.forEach(function (p, i) {
  p.tag = (i + 1 < 10 ? "0" : "") + (i + 1);
});
