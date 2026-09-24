/* =============================================================================
   ReLeaf: review notes  (demo wiki only)
   -----------------------------------------------------------------------------
   A writing review, left at the end of the section it is about, so whoever
   edits that section finds the note where the fix goes. Written from the
   seat of an iGEM judge reading the page against the rubric.

   Markup, placed as the last child of the section it reviews:

     <aside class="review-note" data-review="2026-09-25">
       <p class="review-note__head">Review · <span>short title of the section</span></p>
       <p><b>Works.</b> What a judge will credit, and why.</p>
       <p><b>Fix.</b> The concrete change, one per sentence.</p>
     </aside>

   Either paragraph may be left out. nav.js loads this file on every page
   unless window.REVIEW_NOTES === false (set in assets/data/site-nav.js).
   With it off, every note is removed from the page. The copy that goes to
   gitlab.igem.org must ship with it off, or with the <aside>s deleted:

     grep -rl 'class="review-note"' --include=*.html .

   The notes are <aside>, never headings, so page.js leaves them out of the
   contents rail and the section numbering, and does not link [n] inside
   them. A switch in the demo-tools tray (bottom right, shared with the rule
   check; styled in nav.css) hides and shows them; the choice is remembered
   in this browser only.

   Three grounds are handled: the white reading column (default), the dark
   hardware section (html.review-dark, set when the nav is .sitenav--dark),
   and print, where the notes are dropped.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__reviewNotes) return;
  window.__reviewNotes = true;

  const notes = () => document.querySelectorAll(".review-note");

  if (window.REVIEW_NOTES === false) {
    notes().forEach(n => n.remove());
    return;
  }
  if (!notes().length) return;

  const css = `
.review-note { box-sizing: border-box; margin: 1.75rem 0 0.5rem; padding: 0.85rem 1.1rem 0.9rem;
  border: 1px dashed #92610c; background: #fffaf0; color: #3d3320;
  font: 400 0.9rem/1.55 var(--font-body, Inter, system-ui, sans-serif); font-style: normal;
  max-width: min(100%, var(--measure, 68ch)); border-radius: 0; box-shadow: none; text-align: left;
  overflow-wrap: break-word; clear: both; }
.review-note p { margin: 0 0 0.45rem; padding: 0; max-width: none; font-size: inherit; line-height: inherit; color: inherit; }
.review-note p:last-child { margin-bottom: 0; }
.review-note b { color: #6b4708; font-weight: 650; }
.review-note a { color: #6b4708; text-decoration: underline; text-underline-offset: 2px; }
.review-note code { font-size: 0.92em; }
.review-note .review-note__head { font-size: 0.6875rem; font-weight: 650; letter-spacing: 0.12em;
  text-transform: uppercase; color: #92610c; margin-bottom: 0.5rem; }
.review-note .review-note__head span { text-transform: none; letter-spacing: 0; font-weight: 500; color: #6b5a3a; }
/* inside a grid or flex parent the note takes a whole row, not one cell */
.review-note { grid-column: 1 / -1; flex: 0 0 100%; }
html.review-off .review-note { display: none; }

/* the hardware section: same note, drawn for a near-black ground */
html.review-dark .review-note { background: rgba(20, 16, 6, .88); border-color: #d4a03a; color: #e9e1cf; }
html.review-dark .review-note b,
html.review-dark .review-note a { color: #f0c46a; }
html.review-dark .review-note .review-note__head { color: #d4a03a; }
html.review-dark .review-note .review-note__head span { color: #cdbf9f; }

.review-toggle { font: 600 11px/1 var(--font-body, Inter, system-ui, sans-serif);
  letter-spacing: 0.06em; padding: 8px 10px; background: #fffaf0; color: #6b4708; border: 1px dashed #92610c;
  cursor: pointer; border-radius: 0; white-space: nowrap; }
.review-toggle:hover { background: #fff3d9; }
.review-toggle:focus-visible { outline: 2px solid #4f9c6f; outline-offset: 2px; }
.review-toggle .rt-long { display: none; }
@media (min-width: 640px) { .review-toggle .rt-long { display: inline; } .review-toggle .rt-short { display: none; } }
html.review-dark .review-toggle { background: #1a1408; color: #f0c46a; border-color: #d4a03a; }
@media print { .review-note, .review-toggle { display: none !important; } }`;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);

  const root = document.documentElement;
  if (document.querySelector(".sitenav--dark")) root.classList.add("review-dark");

  const KEY = "releaf-review-notes";
  let off = false;
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) {}

  let tray = document.querySelector(".demo-tools");
  if (!tray) {
    tray = document.createElement("div");
    tray.className = "demo-tools";
    document.body.appendChild(tray);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "review-toggle";
  const paint = () => {
    const n = notes().length;
    root.classList.toggle("review-off", off);
    /* the words say what a press will do; aria-pressed says the current state */
    btn.innerHTML = '<span class="rt-long">' + (off ? "Show" : "Hide") + " review notes (" + n + ")</span>" +
                    '<span class="rt-short">Notes ' + (off ? "off" : "on") + " (" + n + ")</span>";
    btn.setAttribute("aria-label", "Review notes: " + n + " on this page");
    btn.setAttribute("aria-pressed", String(!off));
  };
  btn.addEventListener("click", () => {
    off = !off;
    try { localStorage.setItem(KEY, off ? "off" : "on"); } catch (e) {}
    paint();
  });
  paint();
  tray.appendChild(btn);
})();
