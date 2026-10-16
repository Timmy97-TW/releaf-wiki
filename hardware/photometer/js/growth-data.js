// The growth curves in part 3, Bacterial Growth (5.1 until the 15 Oct reorder; prototypes 2 and 3; 1 is a placeholder), for js/growth-charts.js. 15 Oct 2026.
// This file is hardware/photometer/js/growth-data.js. Until 15 Oct it was the bioreactor page's
// js/growth-data.js (its 4.1); it moved here with the bacteria-growth prototypes and their charts.
//
// ─── THE ONE PLACE THE RAW DATA GOES ──────────────────────────────────────────────────────────────
// The owner, 15 Oct: "ill give data later". Until then each `csv` below is null, and the two charts draw
// the series TRACED from the team's chart images (GROWTH_TRACED in js/growth-charts.js; every value about
// ±0.01–0.02 OD600), with a line under each chart that says so. When the spreadsheet arrives:
//
//   1. Export each run as CSV (or copy the cells: tabs work as well as commas).
//   2. Paste it between the backticks of that run's `csv`, unchanged, like this:
//
//        growth_c2: { unit: "min", csv: `
//      time,bioreactor,flask
//      0,0.162,0.121
//      15,0.148,0.130
//      42,0.136,
//      …
//      ` },
//
//   3. Set `unit` to the unit of the time column ("min" or "h"). Nothing else changes: the chart redraws from
//      the paste, its line reads "the team's raw data" instead of "traced", and readings show three decimals.
//
// The format
//   - One header row, then one row per reading time.
//   - First column: time since inoculation, a number in `unit` ("90", "1.5"), or elapsed h:mm ("1:30").
//   - Then one column per arm. The header names the arm: a header containing "reactor" is the bioreactor,
//     one containing "flask" is the flask control (case does not matter). Any other column is ignored.
//   - An empty cell means no reading at that time; that arm simply has no point there.
//   - Decimals with a point (0.304), not a comma.
//
// What stays fixed whatever the data: prototype 2 is plotted in hours and prototype 3 in minutes, as in the
// team's own charts (a paste in the other unit is converted), and the notes drawn on each chart come from the
// record, not from the numbers: prototype 2's run ended early when medium leaked at the pump (3.2,
// Test); prototype 3's plateau was OD600 ~0.8–0.9 for the reactor after ~2 h and ~0.6–0.8 for the flask after
// ~4.5 h (3.3, Test). If the raw data disagrees with those, the record's text needs a look as well.
window.BIO_GROWTH = {
  growth_c1: { unit: "h", csv: null },     // prototype 2, 22 °C (room temperature), 6 June 2026
  growth_c2: { unit: "min", csv: null }    // prototype 3, 37 °C, 14 June 2026
};
