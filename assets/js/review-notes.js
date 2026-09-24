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

   A small switch in the bottom-left corner hides and shows the notes; the
   choice is remembered in this browser only.
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
.review-note { margin: 1.75rem 0 0.5rem; padding: 0.85rem 1.1rem 0.9rem; border: 1px dashed #92610c;
  background: #fffaf0; color: #3d3320; font: 400 0.9rem/1.55 var(--font-body, Inter, system-ui, sans-serif);
  max-width: var(--measure, 68ch); border-radius: 0; box-shadow: none; }
.review-note p { margin: 0 0 0.45rem; max-width: none; font-size: inherit; line-height: inherit; color: inherit; }
.review-note p:last-child { margin-bottom: 0; }
.review-note b { color: #6b4708; font-weight: 650; }
.review-note .review-note__head { font-size: 0.6875rem; font-weight: 650; letter-spacing: 0.12em;
  text-transform: uppercase; color: #92610c; margin-bottom: 0.5rem; }
.review-note .review-note__head span { text-transform: none; letter-spacing: 0; font-weight: 500; color: #6b5a3a; }
html.review-off .review-note { display: none; }
.review-toggle { position: fixed; left: 12px; bottom: 56px; z-index: 900; font: 600 11px/1 var(--font-body, Inter, system-ui, sans-serif);
  letter-spacing: 0.06em; padding: 7px 10px; background: #fffaf0; color: #6b4708; border: 1px dashed #92610c;
  cursor: pointer; border-radius: 0; }
.review-toggle:focus-visible { outline: 2px solid #4f9c6f; outline-offset: 2px; }
@media print { .review-note, .review-toggle { display: none !important; } }`;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);

  const KEY = "releaf-review-notes";
  let off = false;
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) {}
  const root = document.documentElement;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "review-toggle";
  const paint = () => {
    root.classList.toggle("review-off", off);
    btn.textContent = (off ? "Show" : "Hide") + " review notes (" + notes().length + ")";
    btn.setAttribute("aria-pressed", String(!off));
  };
  btn.addEventListener("click", () => {
    off = !off;
    try { localStorage.setItem(KEY, off ? "off" : "on"); } catch (e) {}
    paint();
  });
  paint();
  document.body.appendChild(btn);
})();
