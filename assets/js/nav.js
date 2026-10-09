/* =============================================================================
   ReLeaf site navigation renderer
   Reads NAV from assets/data/site-nav.js into <div id="site-nav">.
   No dependencies. Drop the two data files, nav.css and the div into any wiki page.
   ========================================================================== */
(function () {
  "use strict";

  /* Drafting marks off: window.AI_MARK = false in site-nav.js paints every
     .ai passage in the normal ink again (see the .ai rule in nav.css). */
  if (window.AI_MARK === false) document.documentElement.classList.add("ai-off");

  /* ---- icon set ------------------------------------------------------------
     Solid glyphs, one path each on a 24x24 grid, filled with currentColor.
     Paths from Material Design Icons (Pictogrammers, Apache-2.0); the mdi name
     is beside each so a glyph can be swapped for a sibling.                   */
  const ICONS = {
    /* Project */
    description: '<path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>', /* mdiLeaf */
    biomanufacturing: '<path d="M4,18V20H8V18H4M4,14V16H14V14H4M10,18V20H14V18H10M16,14V16H20V14H16M16,18V20H20V18H16M2,22V8L7,12V8L12,12V8L17,12L18,2H21L22,12V22H2Z"/>', /* mdiFactory */
    engineering: '<path d="M12,6V9L16,5L12,1V4A8,8 0 0,0 4,12C4,13.57 4.46,15.03 5.24,16.26L6.7,14.8C6.25,13.97 6,13 6,12A6,6 0 0,1 12,6M18.76,7.74L17.3,9.2C17.74,10.04 18,11 18,12A6,6 0 0,1 12,18V15L8,19L12,23V20A8,8 0 0,0 20,12C20,10.43 19.54,8.97 18.76,7.74Z"/>', /* mdiAutorenew */
    development: '<path d="M15 6H22V9H18V13H14V17H10V21H3V18H7V14H11V10H15V6M10.17 6.66L4.66 12.17L2.83 10.34L8.34 4.83L6.5 3H12V8.5L10.17 6.66Z"/>', /* mdiStairsUp */
    contribution: '<path d="M18 16H16V15H8V16H6V15H2V20H22V15H18V16M20 8H17V6C17 4.9 16.1 4 15 4H9C7.9 4 7 4.9 7 6V8H4C2.9 8 2 8.9 2 10V14H6V12H8V14H16V12H18V14H22V10C22 8.9 21.1 8 20 8M15 8H9V6H15V8Z"/>', /* mdiToolbox */
    results: '<path d="M3,22V8H7V22H3M10,22V2H14V22H10M17,22V14H21V22H17Z"/>', /* mdiPoll */
    /* Wet Lab */
    experiments: '<path d="M6,22A3,3 0 0,1 3,19C3,18.4 3.18,17.84 3.5,17.37L9,7.81V6A1,1 0 0,1 8,5V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V5A1,1 0 0,1 15,6V7.81L20.5,17.37C20.82,17.84 21,18.4 21,19A3,3 0 0,1 18,22H6M5,19A1,1 0 0,0 6,20H18A1,1 0 0,0 19,19C19,18.79 18.93,18.59 18.82,18.43L16.53,14.47L14,17L8.93,11.93L5.18,18.43C5.07,18.59 5,18.79 5,19M13,10A1,1 0 0,0 12,11A1,1 0 0,0 13,12A1,1 0 0,0 14,11A1,1 0 0,0 13,10Z"/>', /* mdiFlask */
    parts: '<path d="M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5,16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z"/>', /* mdiPuzzle */
    plants: '<path d="M2,22V20C2,20 7,18 12,18C17,18 22,20 22,20V22H2M11.3,9.1C10.1,5.2 4,6.1 4,6.1C4,6.1 4.2,13.9 9.9,12.7C9.5,9.8 8,9 8,9C10.8,9 11,12.4 11,12.4V17C11.3,17 11.7,17 12,17C12.3,17 12.7,17 13,17V12.8C13,12.8 13,8.9 16,7.9C16,7.9 14,10.9 14,12.9C21,13.6 21,4 21,4C21,4 12.1,3 11.3,9.1Z"/>', /* mdiSprout */
    measurement: '<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 19,16.5 17.3,18C15.9,16.7 14,16 12,16C10,16 8.2,16.7 6.7,18C5,16.5 4,14.4 4,12A8,8 0 0,1 12,4M14,5.89C13.62,5.9 13.26,6.15 13.1,6.54L11.81,9.77L11.71,10C11,10.13 10.41,10.6 10.14,11.26C9.73,12.29 10.23,13.45 11.26,13.86C12.29,14.27 13.45,13.77 13.86,12.74C14.12,12.08 14,11.32 13.57,10.76L13.67,10.5L14.96,7.29L14.97,7.26C15.17,6.75 14.92,6.17 14.41,5.96C14.28,5.91 14.15,5.89 14,5.89M10,6A1,1 0 0,0 9,7A1,1 0 0,0 10,8A1,1 0 0,0 11,7A1,1 0 0,0 10,6M7,9A1,1 0 0,0 6,10A1,1 0 0,0 7,11A1,1 0 0,0 8,10A1,1 0 0,0 7,9M17,9A1,1 0 0,0 16,10A1,1 0 0,0 17,11A1,1 0 0,0 18,10A1,1 0 0,0 17,9Z"/>', /* mdiGauge */
    safety: '<path d="M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z"/>', /* mdiShieldCheck */
    notebook: '<path d="M3,7V5H5V4C5,2.89 5.9,2 7,2H13V9L15.5,7.5L18,9V2H19C20.05,2 21,2.95 21,4V20C21,21.05 20.05,22 19,22H7C5.95,22 5,21.05 5,20V19H3V17H5V13H3V11H5V7H3M7,11H5V13H7V11M7,7V5H5V7H7M7,19V17H5V19H7Z"/>', /* mdiNotebook */
    /* Dry Lab */
    model: '<path d="M9.96,11.31C10.82,8.1 11.5,6 13,6C14.5,6 15.18,8.1 16.04,11.31C17,14.92 18.1,19 22,19V17C19.8,17 19,14.54 17.97,10.8C17.08,7.46 16.15,4 13,4C9.85,4 8.92,7.46 8.03,10.8C7.03,14.54 6.2,17 4,17V2H2V22H22V20H4V19C7.9,19 9,14.92 9.96,11.31Z"/>', /* mdiChartBellCurve */
    bioreactor: '<path d="M7,2V4H8V18A4,4 0 0,0 12,22A4,4 0 0,0 16,18V4H17V2H7M11,16C10.4,16 10,15.6 10,15C10,14.4 10.4,14 11,14C11.6,14 12,14.4 12,15C12,15.6 11.6,16 11,16M13,12C12.4,12 12,11.6 12,11C12,10.4 12.4,10 13,10C13.6,10 14,10.4 14,11C14,11.6 13.6,12 13,12M14,7H10V4H14V7Z"/>', /* mdiTestTube */
    hardware: '<path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>', /* mdiCog */
    software: '<path d="M8,3A2,2 0 0,0 6,5V9A2,2 0 0,1 4,11H3V13H4A2,2 0 0,1 6,15V19A2,2 0 0,0 8,21H10V19H8V14A2,2 0 0,0 6,12A2,2 0 0,0 8,10V5H10V3M16,3A2,2 0 0,1 18,5V9A2,2 0 0,0 20,11H21V13H20A2,2 0 0,0 18,15V19A2,2 0 0,1 16,21H14V19H16V14A2,2 0 0,1 18,12A2,2 0 0,1 16,10V5H14V3H16Z"/>', /* mdiCodeBraces */
    twin: '<path d="M21,16V4H3V16H21M21,2A2,2 0 0,1 23,4V16A2,2 0 0,1 21,18H14V20H16V22H8V20H10V18H3C1.89,18 1,17.1 1,16V4C1,2.89 1.89,2 3,2H21M5,6H14V11H5V6M15,6H19V8H15V6M19,9V14H15V9H19M5,12H9V14H5V12M10,12H14V14H10V12Z"/>', /* mdiMonitorDashboard */
    md: '<path d="M12,11A1,1 0 0,1 13,12A1,1 0 0,1 12,13A1,1 0 0,1 11,12A1,1 0 0,1 12,11M4.22,4.22C5.65,2.79 8.75,3.43 12,5.56C15.25,3.43 18.35,2.79 19.78,4.22C21.21,5.65 20.57,8.75 18.44,12C20.57,15.25 21.21,18.35 19.78,19.78C18.35,21.21 15.25,20.57 12,18.44C8.75,20.57 5.65,21.21 4.22,19.78C2.79,18.35 3.43,15.25 5.56,12C3.43,8.75 2.79,5.65 4.22,4.22M15.54,8.46C16.15,9.08 16.71,9.71 17.23,10.34C18.61,8.21 19.11,6.38 18.36,5.64C17.62,4.89 15.79,5.39 13.66,6.77C14.29,7.29 14.92,7.85 15.54,8.46M8.46,15.54C7.85,14.92 7.29,14.29 6.77,13.66C5.39,15.79 4.89,17.62 5.64,18.36C6.38,19.11 8.21,18.61 10.34,17.23C9.71,16.71 9.08,16.15 8.46,15.54M5.64,5.64C4.89,6.38 5.39,8.21 6.77,10.34C7.29,9.71 7.85,9.08 8.46,8.46C9.08,7.85 9.71,7.29 10.34,6.77C8.21,5.39 6.38,4.89 5.64,5.64M9.88,14.12C10.58,14.82 11.3,15.46 12,16.03C12.7,15.46 13.42,14.82 14.12,14.12C14.82,13.42 15.46,12.7 16.03,12C15.46,11.3 14.82,10.58 14.12,9.88C13.42,9.18 12.7,8.54 12,7.97C11.3,8.54 10.58,9.18 9.88,9.88C9.18,10.58 8.54,11.3 7.97,12C8.54,12.7 9.18,13.42 9.88,14.12M18.36,18.36C19.11,17.62 18.61,15.79 17.23,13.66C16.71,14.29 16.15,14.92 15.54,15.54C14.92,16.15 14.29,16.71 13.66,17.23C15.79,18.61 17.62,19.11 18.36,18.36Z"/>', /* mdiAtom */
    peptide: '<path d="M7.27,10L9,7H14.42L15.58,5L15.5,4.5A1.5,1.5 0 0,1 17,3A1.5,1.5 0 0,1 18.5,4.5C18.5,5.21 18,5.81 17.33,5.96L16.37,7.63L17.73,10L18.59,8.5L18.5,8A1.5,1.5 0 0,1 20,6.5A1.5,1.5 0 0,1 21.5,8C21.5,8.71 21,9.3 20.35,9.46L18.89,12L20.62,15C21.39,15.07 22,15.71 22,16.5A1.5,1.5 0 0,1 20.5,18A1.5,1.5 0 0,1 19,16.5V16.24L17.73,14L16.37,16.37L17.33,18.04C18,18.19 18.5,18.79 18.5,19.5A1.5,1.5 0 0,1 17,21A1.5,1.5 0 0,1 15.5,19.5L15.58,19L14.42,17H10.58L9.42,19L9.5,19.5A1.5,1.5 0 0,1 8,21A1.5,1.5 0 0,1 6.5,19.5C6.5,18.79 7,18.19 7.67,18.04L8.63,16.37L4.38,9C3.61,8.93 3,8.29 3,7.5A1.5,1.5 0 0,1 4.5,6A1.5,1.5 0 0,1 6,7.5C6,7.59 6,7.68 6,7.76L7.27,10M10.15,9L8.42,12L10.15,15H14.85L16.58,12L14.85,9H10.15Z"/>', /* mdiMolecule */
    /* Engagement */
    ihp: '<path d="M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z"/>', /* mdiAccountGroup */
    education: '<path d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z"/>', /* mdiSchool */
    sustainability: '<path d="M17.9,17.39C17.64,16.59 16.89,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A2,2 0 0,0 11,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>', /* mdiEarth */
    legal: '<path d="M12,3C10.73,3 9.6,3.8 9.18,5H3V7H4.95L2,14C1.53,16 3,17 5.5,17C8,17 9.56,16 9,14L6.05,7H9.17C9.5,7.85 10.15,8.5 11,8.83V20H2V22H22V20H13V8.82C13.85,8.5 14.5,7.85 14.82,7H17.95L15,14C14.53,16 16,17 18.5,17C21,17 22.56,16 22,14L19.05,7H21V5H14.83C14.4,3.8 13.27,3 12,3M12,5A1,1 0 0,1 13,6A1,1 0 0,1 12,7A1,1 0 0,1 11,6A1,1 0 0,1 12,5M5.5,10.25L7,14H4L5.5,10.25M18.5,10.25L20,14H17L18.5,10.25Z"/>', /* mdiScaleBalance */
    gis: '<path d="M15,19L9,16.89V5L15,7.11M20.5,3C20.44,3 20.39,3 20.34,3L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21C3.55,21 3.61,21 3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3Z"/>', /* mdiMap */
    physical: '<path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L6.04,7.5L12,10.85L17.96,7.5L12,4.15Z"/>', /* mdiCube */
    entrepreneurship: '<path d="M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V19A1,1 0 0,1 14,20H10A1,1 0 0,1 9,19V17.2C7.21,16.16 6,14.22 6,12A6,6 0 0,1 12,6M14,21V22A1,1 0 0,1 13,23H11A1,1 0 0,1 10,22V21H14M20,11H23V13H20V11M1,11H4V13H1V11M13,1V4H11V1H13M4.92,3.5L7.05,5.64L5.63,7.05L3.5,4.93L4.92,3.5M16.95,5.63L19.07,3.5L20.5,4.93L18.37,7.05L16.95,5.63Z"/>', /* mdiLightbulbOn */
    ai: '<path d="M6,4H18V5H21V7H18V9H21V11H18V13H21V15H18V17H21V19H18V20H6V19H3V17H6V15H3V13H6V11H3V9H6V7H3V5H6V4M11,15V18H12V15H11M13,15V18H14V15H13M15,15V18H16V15H15Z"/>', /* mdiChip */
    /* Team */
    members: '<path d="M16 17V19H2V17S2 13 9 13 16 17 16 17M12.5 7.5A3.5 3.5 0 1 0 9 11A3.5 3.5 0 0 0 12.5 7.5M15.94 13A5.32 5.32 0 0 1 18 17V19H22V17S22 13.37 15.94 13M15 4A3.39 3.39 0 0 0 13.07 4.59A5 5 0 0 1 13.07 10.41A3.39 3.39 0 0 0 15 11A3.5 3.5 0 0 0 15 4Z"/>', /* mdiAccountMultiple */
    attribution: '<path d="M11 6H14L17.29 2.7A1 1 0 0 1 18.71 2.7L21.29 5.29A1 1 0 0 1 21.29 6.7L19 9H11V11A1 1 0 0 1 10 12A1 1 0 0 1 9 11V8A2 2 0 0 1 11 6M5 11V15L2.71 17.29A1 1 0 0 0 2.71 18.7L5.29 21.29A1 1 0 0 0 6.71 21.29L11 17H15A1 1 0 0 0 16 16V15H17A1 1 0 0 0 18 14V13H19A1 1 0 0 0 20 12V11H13V12A2 2 0 0 1 11 14H9A2 2 0 0 1 7 12V9Z"/>', /* mdiHandshake */
    milestone: '<path d="M14.4,6L14,4H5V21H7V14H12.6L13,16H20V6H14.4Z"/>', /* mdiFlag */
  };

  const svg = (key) =>
    '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[key] || ICONS.description) + "</svg>";

  /* ---- addresses ----------------------------------------------------------
     Every page carries data-base on #site-nav: "" at the wiki root, "../" one
     folder down, "../../" two down. Slugs are written once, in site-nav.js,
     and resolved here, so the same nav file works at any depth and on any host
     prefix (GitHub Pages serves under /repo/, the iGEM wiki under /team/).   */
  let BASE = "";
  const href = (p) => {
    if (p.href) return p.href;                       /* explicit override wins */
    if (!p.slug) return "#";
    return BASE + p.slug + "/";
  };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ---- build --------------------------------------------------------------- */

  function build(root) {
    BASE = root.dataset.base != null ? root.dataset.base : "";
    const brandHref = root.dataset.home || BASE || "./";
    const logo = root.dataset.logo || BASE + "assets/img/logo.png";
    const currentTab = root.dataset.tab || "";
    const currentPage = root.dataset.page || "";

    root.classList.add("sitenav");
    /* a landmark, so screen readers can jump to it and nothing in it sits
       outside every landmark. The tabs are disclosure buttons (aria-expanded),
       not a menubar: a menubar promises menuitems and arrow-key menus. */
    root.setAttribute("role", "navigation");
    root.setAttribute("aria-label", "Site");
    root.innerHTML =
      '<div class="sitenav__bar">' +
        '<div class="sitenav__inner">' +
          '<a class="sitenav__brand" href="' + brandHref + '">' +
            '<img class="sitenav__logo" src="' + logo + '" alt="ReLeaf team logo" />' +
            '<span class="sitenav__word">ReLeaf</span>' +
          "</a>" +
          '<div class="sitenav__tabs"></div>' +
          '<button class="sitenav__burger" aria-expanded="false" aria-label="Open menu">' +
            "<span></span><span></span><span></span></button>" +
        "</div>" +
      "</div>" +
      '<div class="sitenav__panels"></div>' +
      '<div class="sitenav__drawer"></div>' +
      /* the page behind an open panel softens: a fixed, unclickable blur that
         sits under the panel and over the page. Decoration only, so it is
         hidden from assistive technology. */
      '<div class="sitenav__scrim" aria-hidden="true"></div>';

    const tabs   = root.querySelector(".sitenav__tabs");
    const panels = root.querySelector(".sitenav__panels");
    const drawer = root.querySelector(".sitenav__drawer");

    NAV.forEach((tab) => {
      /* ---- desktop tab button ---- */
      const btn = el("button", "sitenav__tab");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.appendChild(el("span", null, tab.name));
      btn.appendChild(el("i", "sitenav__chev"));
      if (tab.id === currentTab) btn.classList.add("is-section");
      btn.dataset.tab = tab.id;
      tabs.appendChild(btn);

      /* ---- desktop panel ---- */
      const panel = el("div", "sitenav__panel");
      panel.dataset.tab = tab.id;
      const inner = el("div", "sitenav__panelinner");

      /* No title rail. The tab the reader just opened is lit in the bar above,
         so repeating its name inside the panel said nothing, and the paragraph
         under it cost the links half the width. One grid of pages instead,
         lined up with the logo. `--i` is the entry's place in that grid; the
         stylesheet staggers the rise by 25ms a step. */
      const list = el("div", "sitenav__list");
      tab.pages.forEach((p, i) => {
        const a = entry(p, currentPage);
        a.style.setProperty("--i", i);
        list.appendChild(a);
      });
      inner.appendChild(list);

      panel.appendChild(inner);
      panels.appendChild(panel);

      /* ---- mobile accordion ---- */
      const group = el("div", "sitenav__group");
      const gbtn = el("button", "sitenav__grouptop");
      gbtn.type = "button";
      gbtn.setAttribute("aria-expanded", "false");
      gbtn.appendChild(el("span", null, tab.name));
      gbtn.appendChild(el("i", "sitenav__chev"));
      const gbody = el("div", "sitenav__groupbody");
      tab.pages.forEach((p, i) => {
        const a = entry(p, currentPage);
        a.style.setProperty("--i", i);
        gbody.appendChild(a);
      });
      gbtn.addEventListener("click", () => {
        const open = group.classList.toggle("is-open");
        gbtn.setAttribute("aria-expanded", String(open));
      });
      group.appendChild(gbtn);
      group.appendChild(gbody);
      drawer.appendChild(group);
    });

    wire(root);
  }

  function entry(p, currentPage) {
    const here = p.current || (currentPage && p.slug === currentPage);
    const a = el("a", "sitenav__entry" + (here ? " is-current" : "") + (p.prize ? " is-prize" : ""));
    a.href = href(p);
    if (here) a.setAttribute("aria-current", "page");
    const tile = el("span", "sitenav__tile");
    tile.innerHTML = svg(p.icon);
    tile.dataset.icon = p.icon;           /* per-icon touches in nav.css */
    a.appendChild(tile);
    const text = el("span", "sitenav__entrytext");
    text.appendChild(el("span", "sitenav__entrytitle", p.title));
    a.appendChild(text);
    return a;
  }

  /* ---- behaviour ----------------------------------------------------------- */

  function wire(root) {
    const btns   = [...root.querySelectorAll(".sitenav__tab")];
    const panels = [...root.querySelectorAll(".sitenav__panel")];
    const burger = root.querySelector(".sitenav__burger");
    let openId = null, closeTimer = null, shownAt = 0;

    const show = (id) => {
      clearTimeout(closeTimer);
      if (id !== openId) shownAt = performance.now();
      openId = id;
      btns.forEach((b) => {
        const on = b.dataset.tab === id;
        b.classList.toggle("is-open", on);
        b.setAttribute("aria-expanded", String(on));
      });
      panels.forEach((p) => p.classList.toggle("is-open", p.dataset.tab === id));
      root.classList.toggle("has-panel", !!id);
    };
    const hide = () => show(null);
    const hideSoon = () => { clearTimeout(closeTimer); closeTimer = setTimeout(hide, 160); };

    /* Hover opens a panel, and so does the click that usually follows the
       hover, or the tap on a touch screen (which fires mouseenter first). A
       click only closes a panel that has been open for a moment. Focus alone
       does not open anything: the panels sit after the whole tab bar, so
       opening on focus swapped the panel under every Tab press and left only
       Team's links reachable. Enter, Space or ArrowDown opens a panel and Tab
       then walks into it; tabbing out of its last link moves to the next tab. */
    const entries = (id) => {
      const p = panels.find((x) => x.dataset.tab === id);
      return p ? [...p.querySelectorAll("a[href]")] : [];
    };
    btns.forEach((b, i) => {
      b.addEventListener("mouseenter", () => show(b.dataset.tab));
      b.addEventListener("click", (e) => {
        e.preventDefault();
        openId === b.dataset.tab && performance.now() - shownAt > 400 ? hide() : show(b.dataset.tab);
      });
      b.addEventListener("keydown", (e) => {
        const id = b.dataset.tab;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          show(id);
          const first = entries(id)[0];
          if (first) first.focus();
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const next = btns[(i + (e.key === "ArrowRight" ? 1 : btns.length - 1)) % btns.length];
          if (openId) show(next.dataset.tab);
          next.focus();
        } else if (e.key === "Tab" && !e.shiftKey && openId === id) {
          const first = entries(id)[0];
          if (first) { e.preventDefault(); first.focus(); }
        }
      });
    });
    panels.forEach((p) => {
      p.addEventListener("mouseenter", () => clearTimeout(closeTimer));
      p.addEventListener("mouseleave", hideSoon);
      /* the light on the card follows the pointer (see "the light" in nav.css) */
      p.addEventListener("pointermove", (e) => {
        const r = p.getBoundingClientRect();
        p.style.setProperty("--mx", (e.clientX - r.left) + "px");
        p.style.setProperty("--my", (e.clientY - r.top) + "px");
        p.style.setProperty("--lit", "1");
      });
      p.addEventListener("pointerleave", () => p.style.setProperty("--lit", "0"));
      p.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const list = entries(p.dataset.tab);
        const i = btns.findIndex((b) => b.dataset.tab === p.dataset.tab);
        if (!e.shiftKey && document.activeElement === list[list.length - 1] && btns[i + 1]) {
          /* past the last link: on to the next tab. After Team the browser's own
             order already leads into the page, and focusout closes the panel. */
          e.preventDefault();
          hide();
          btns[i + 1].focus();
        } else if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          btns[i].focus();
        }
      });
    });
    root.querySelector(".sitenav__tabs").addEventListener("mouseleave", hideSoon);
    /* focus leaving the navigation closes whatever it left open */
    root.addEventListener("focusout", (e) => {
      if (e.relatedTarget && !root.contains(e.relatedTarget)) hide();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const inPanel = openId && root.contains(document.activeElement) &&
        !document.activeElement.classList.contains("sitenav__tab");
      const back = inPanel ? btns.find((b) => b.dataset.tab === openId) : null;
      hide();
      if (back) back.focus();
      if (root.classList.contains("drawer-open")) {
        root.classList.remove("drawer-open");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
        burger.focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (root.contains(e.target)) return;
      hide();
      if (root.classList.contains("drawer-open")) {
        root.classList.remove("drawer-open");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
      }
    });

    /* The dark bar over a hero is transparent until the page moves, so it needs
       to know. Cheap enough to run everywhere; only nav-dark.css styles it. */
    let ticking = false;
    const mark = () => {
      root.classList.toggle("is-scrolled", window.scrollY > 40);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(mark);
    }, { passive: true });
    mark();

    burger.addEventListener("click", () => {
      const open = root.classList.toggle("drawer-open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }


  /* A keyboard user's first Tab lands here, not on the links of the
     navigation. It points at the page's <main>, giving it an id if it has
     none; pages with their own skip link (hardware) or no <main> are left
     alone. Styled in nav.css, off-screen until focused. */
  function skipLink() {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".skip-link, .sitenav-skip")) return;
    if (!main.id) main.id = "main";
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    const a = document.createElement("a");
    a.className = "sitenav-skip";
    a.href = "#" + main.id;
    a.textContent = "Skip to content";
    document.body.prepend(a);
  }

  /* A box that scrolls on its own (a wide table on a phone, a wide figure)
     has to be reachable from the keyboard, or whatever sits past its edge can
     only be seen with a mouse or a finger. While, and only while, such a box
     overflows and holds nothing focusable, it gets a tab stop and a name
     (role="group", not "region", so thirty tables do not become thirty
     landmarks). The same function sits in nav-rail.js. */
  function scrollRegions() {
    const FOCUSABLE = 'a[href], button, input, select, textarea, summary, iframe, ' +
                      '[contenteditable], [tabindex]:not([tabindex="-1"])';
    const scrolls = (v) => v === "auto" || v === "scroll";
    const name = (el, sideways) => {
      const cap = el.querySelector("caption, figcaption");
      let t = cap ? cap.textContent.replace(/¶/g, "").replace(/\s+/g, " ").trim() : "";
      if (t.length > 90) t = t.slice(0, 88).replace(/\s\S*$/, "") + "…";
      return (t || (el.querySelector("table") ? "Table" : el.querySelector("svg, canvas, img") ? "Figure" : "Content")) +
             (sideways ? ", scrolls sideways" : ", scrolls");
    };
    const unmark = (el) => {
      (el.dataset.scrollstop || "").split(" ").forEach((a) => a && el.removeAttribute(a));
      delete el.dataset.scrollstop;
    };
    const check = () => {
      const keep = new Set();
      document.querySelectorAll("body *").forEach((el) => {
        const wide = el.scrollWidth > el.clientWidth + 1;
        const tall = el.scrollHeight > el.clientHeight + 1;
        if (!wide && !tall) return;
        const cs = getComputedStyle(el);
        const sideways = wide && scrolls(cs.overflowX);
        if (!sideways && !(tall && scrolls(cs.overflowY))) return;
        if (el.dataset.scrollstop != null) { keep.add(el); return; }   /* already ours */
        if (el.hasAttribute("tabindex")) return;       /* someone already chose */
        if (el.querySelector(FOCUSABLE) || el.closest('[aria-hidden="true"], [inert]')) return;
        const added = ["tabindex"];
        el.tabIndex = 0;
        if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
          if (!el.hasAttribute("role")) { el.setAttribute("role", "group"); added.push("role"); }
          el.setAttribute("aria-label", name(el, sideways)); added.push("aria-label");
        }
        el.dataset.scrollstop = added.join(" ");
        keep.add(el);
      });
      document.querySelectorAll("[data-scrollstop]").forEach((el) => { if (!keep.has(el)) unmark(el); });
    };
    let timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(check, 250); };
    if (document.readyState === "complete") soon();
    else window.addEventListener("load", soon);
    window.addEventListener("resize", soon);
    /* tabs, <details> and accordions change what overflows */
    document.addEventListener("click", soon);
    document.addEventListener("toggle", soon, true);
  }

  /* Demo wiki only: outline what breaks an iGEM rule (assets/js/rulecheck.js).
     Switched off with window.RULECHECK = false in assets/data/site-nav.js. */
  function ruleCheck(base) {
    if (window.RULECHECK === false) return;
    const s = document.createElement("script");
    s.src = base + "assets/js/rulecheck.js?v=5";   /* bump when rulecheck.js changes: Pages lets browsers cache it for 10 minutes */
    s.defer = true;
    document.body.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("site-nav");
    if (root) build(root);
    skipLink();
    scrollRegions();
    ruleCheck(root && root.dataset.base != null ? root.dataset.base : "");
  });
})();
