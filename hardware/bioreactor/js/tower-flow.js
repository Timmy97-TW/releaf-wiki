// Flow centrelines for the TOWER build, ordered in flow direction.
//
// These are NOT the same routes as js/flow-paths.js. That file's coordinates
// belong to the flat bench layout of the first version — its points sit in a
// plane at z ~ 0 spanning 600 x 415 mm, which is a different machine in a
// different frame. Reusing them here would have drawn the old deck's plumbing
// through the middle of the tower.
//
// COORDINATES ARE ONSHAPE MM, the same frame every other position in unveil.js
// is written in (z is up). Anything parented under the model root is already
// inside the Z-up -> Y-up rotation, so these go in raw.
//
// WHAT THEY ARE: a flow *visualisation*, not the CAD's tubing. The assembly has
// no tubing bodies to trace, so these are authored centrelines between the real
// port positions of the real components. They are honest about the circuit —
// which vessel feeds which, in which direction — and they are not a claim about
// how the tubing is physically dressed.
//
// WHY THEY RUN FORWARD OF THE MACHINE: every route drops to a plane around
// x = -84 for its middle section, just behind the near panel (whose inner face
// is at x = -109.3, so there is ~21 mm of clearance) and in front of the
// vessels. Two reasons. It is the only place a line can cross the machine
// without passing through a bottle, and it is the face the camera is on, so the
// circuit reads as a diagram laid over the hardware instead of disappearing
// behind it.
//
// CLEARANCES ARE MEASURED, not eyeballed. Each curve was sampled at 600 points
// and tested against every non-case body — cylinders tested as cylinders, since
// a bottle's bounding box is mostly empty at the corners and reports collisions
// that are not there. Tightest real clearances: reservoir bottle 5.1 mm, cap
// port fittings 5.0 and 6.0 mm, radiator bracket 3.2 mm, pump housing 14.0 mm.
// shell-1 touches the membrane column at 0 mm on purpose — that is its port.
// The first draft of lumen-3 passed 13.9 mm THROUGH the reservoir bottle, and
// not at a control point: Catmull-Rom bulges between its knots, so the clash was
// on a stretch with no vertex anywhere near it. Sample the curve, not the
// control points.
const TOWER_FLOW = [
  { name: "lumen-1", loop: "lumen",
    label: "culture vessel -> pump",
    points: [
      [0, 0, 321],
      [-25, 8, 336],
      [-55, 30, 340],
      [-78, 60, 326],
      [-84, 92, 292],
      [-80, 110, 256],
      [-64, 114, 238]
    ] },
  { name: "lumen-2", loop: "lumen",
    label: "pump -> membrane top",
    points: [
      [-60, 120, 240],
      [-78, 122, 272],
      [-84, 112, 330],
      [-84, 70, 398],
      [-84, 10, 442],
      [-84, -55, 466],
      [-70, -100, 474],
      [-30, -121, 474],
      [15, -121, 470],
      [45, -121, 464],
      [58, -121, 458]
    ] },
  { name: "lumen-3", loop: "lumen",
    label: "membrane bottom -> culture vessel",
    points: [
      [58, -121, 232],
      [28, -130, 220],
      [-10, -145, 212],
      [-52, -148, 216],
      [-84, -140, 232],
      [-88, -112, 268],
      [-84, -70, 300],
      [-70, -26, 318],
      [-35, -4, 323],
      [0, 0, 321]
    ] },
  { name: "shell-1", loop: "shell",
    label: "membrane shell -> reservoir",
    points: [
      [58, -121, 300],
      [30, -131, 296],
      [-10, -137, 288],
      [-50, -139, 278],
      [-78, -133, 272],
      [-86, -113, 271],
      [-84, -100, 268],
      [-64, -99, 266],
      [-44, -99, 264],
      [-28, -99, 262]
    ] }
];
