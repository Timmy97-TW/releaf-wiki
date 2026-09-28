# Overnight, 29 September 2026

Everything below is merged into `main` and pushed. The wiki's own checker,
`python3 build/audit.py`, now exits clean for the first time: every row reads 0.

The night began with eight read-only audits of the whole wiki, then five
parallel agents, each in its own worktree with strict file ownership.

## What landed

### The top navigation was rebuilt
The five drop panels no longer carry a section title and a paragraph of blurb.
Every page now has a caption of three to five words on one line, written to
orient someone who has never seen the project: "Salt and heat stress trials",
"Software that watches each batch", "Approval routes, Taiwan and beyond".

The look follows Apple's global navigation and stays ReLeaf: a frosted
translucent panel that reveals downward, entries rising in one after another,
the page behind softened while a panel is open, and the leaf-green tiles, the
green bar on an entry's left edge and Inter all kept.

A real accessibility bug went with it. The bright orange used for AI-drafted
text was being painted over the *light* sections of the hardware pages, where
it measured 2.26:1 against white and failed the readable minimum. Those
sections now use the darker orange, checked by counting computed colours rather
than by eye: 144 failing passages before, 0 after.

### Parts became a collection index
The page was a full lab report: five wide tables, the whole build record, the
protectant series and seventeen fix boxes, and on a phone it collapsed into
roughly 167,000 px of nearly empty cells.

It is now what the award is actually judged from. Five module tiles with part
counts, a status key, and thirty-five cards, one per part, each ending in
either its `parts.igem.org` link or a plain "No registry number yet" in the
same slot. Every build record, the protectant series, the references and all
seventeen fix boxes are still on the page, folded away.

- phone height 166,980 px to 29,345 px
- desktop height 38,016 px to 15,999 px
- 23 Registry links, every one well formed
- all 35 parts keep their name, type, status word and function text, checked
  row by row against the old page

The redesign makes one thing impossible to miss: **thirty of the thirty-five
cards say "No registry number yet"**. Filling those Registry entries is the
largest single Parts win left, and only the team can do it.

### Every judged page now maps the judge's questions
On 25 September each judged page gained a "ballot map": inside its award box,
the questions a judge is actually handed for that award, each linked to the
section of that page that answers it, and where the page does not answer, the
item says so. A revert plus the 28 September rebuild destroyed all twelve.

All thirteen are back, and three pages that had no award box at all now have
one: Digital Twin, Hardware and Safety and Security. Engineering gained its
Silver criterion box.

They will not be lost again. The questions live in one file,
`assets/data/ballot.js`, and `build/ballot.py` writes them into each page
between markers:

```
python3 build/ballot.py          # rewrite every page
python3 build/ballot.py model    # one page
python3 build/ballot.py --check  # exit 1 if a page is out of date
```

The list is written into the page markup, not rendered by script, so it is
there with JavaScript off and it prints. All 141 links inside the maps were
walked: none broken.

The maps are honest. They name 24 places where a page does not answer its own
ballot question, including four out of four on Inclusivity, which is still a
scaffold.

### Eleven mechanical fixes
- **Plants stopped hiding itself.** Five of six pipeline stages and three of
  four growth systems vanished when the page was printed or read without
  JavaScript. The 25 September fix was traced, the revert that undid it
  identified, and the fix re-applied.
- **The deleted page can no longer come back.** `build/pages.py` still held the
  full spec for Bioreactor Calculations, so a bare run of the generator would
  have recreated it. Removed, along with an outline note telling future writers
  to link to it.
- **The checker stopped under-reporting.** It counted 2 status boxes where
  there are 5, and double-counted an open item. Nothing was deleted: those are
  the owner's call.
- **40 phantom missing files gone.** The vendored KaTeX stylesheet listed font
  formats that were never shipped. Confirmed harmless and stripped, with
  before and after screenshots of six font families, sums, integrals and
  matrices byte-identical.
- **Two pages stopped scrolling sideways on a phone**: the photometer at 461 px
  and the wet lab notebook at 610 px, both now 390 px.
- Licence and repository footers added where missing, previous and next links
  filled in on Engineering and Members, a favicon, the hero's own dimensions,
  a root `404.html`, and the stale notes corrected.

### 8.3 MB out of the images, no markup touched
Every image was recompressed in place, keeping its name, extension and format,
so nothing in the HTML, CSS or JavaScript changed and no layout could shift.

The honest finding: **these images had already been optimised well.**
Re-encoding at the same size makes most of them larger. The whole saving came
from two places, cutting pixels that were never displayed and palette-reducing
flat cartoon graphics. The 2026 logo went from 1,010 KB to 99 KB with no
visible difference.

Deliberately left alone, with reasons recorded: the 196 Human Practices photos
(already good; the page's 16 MB is simply 196 photographs, which is a content
decision), 18 PNGs that are really photographs or renders and would band badly,
and every large JPEG.

## Still open, and waiting on you

Six decisions. Nothing tonight depended on them.

1. **The long photometer run has four lengths** across the wiki: 336 h, 400 h,
   434 h and "nineteen days". *Recommendation: 434 h, about 18 days, the full
   logged run, and say what it is a duration of wherever a shorter figure
   appears.*
2. **The GIS routing map loads map tiles and routes from outside iGEM**, which
   iGEM blocks, so it would come up blank on the judged wiki. *Recommendation:
   drop the tile layer, since the township outlines already draw Taiwan, and
   use straight line distance times a stated detour factor.*
3. **Is the team 46 or 47?** The roster lists 46; four places say forty-seven.
4. **Do the "Draft" status lines and the fix boxes stay** past the internal
   freeze? They are honest and they are also the first thing a judge reads.
5. **The membrane module is described two ways**, 8 fibres and 150 cm2 against
   11 fibres and 200 cm2, both labelled the vendor specification.
6. **Which three awards are elected?** Gold needs three, and they are chosen on
   the Judging Form. *Recommendation, unchanged from 25 September: Measurement,
   Integrated Human Practices, Education.*

One smaller question: Members was given the full sitemap footer like the other
31 pages, but its stylesheet carried a comment suggesting the short footer was
deliberate. Say the word and that piece is reverted.

## Not touched, on purpose

The homepage, which belongs to somebody else. The Dry Lab Notebook, which
another session was rewriting (it landed its own licence footer and previous
and next links). Student prose anywhere. The 117 blank hardware chips, which
need real bill-of-materials values. The Inclusivity page. Anything off the
wiki: the Attributions form, the Judging form, the Safety form, the iGEM
GitLab repositories and the Registry entries.

## Biggest things still ahead

1. **Nothing has been pushed to iGEM yet.** The GitLab repository still holds
   the template, no media is on `static.igem.wiki`, and a packaging build comes
   to about 11.87 MiB against a 10 MiB limit, so it cannot deploy. Two inline
   data blocks on the GIS pages carry most of the excess.
2. **The Attributions form is empty.** No member has their tasks filled in and
   it lists 31 of 46 people. That alone fails Bronze, and only the team can fix
   it. The Project Safety Form is due 7 October.
3. **Best Software cannot be judged** until the code is on iGEM's GitLab under
   an open licence.
