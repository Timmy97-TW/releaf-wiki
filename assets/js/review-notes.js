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
   them. Their look lives in assets/css/nav.css (loaded early, so there is
   no flash of an unstyled note), including the dark variant for the
   hardware section and print. This file only runs the switch in the
   demo-tools tray (bottom right, shared with the rule check), which hides
   and shows them; the choice is remembered in this browser only.
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

  const root = document.documentElement;

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
