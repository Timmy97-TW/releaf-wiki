# Publishing

## Now: GitHub Pages

This repository is served from its `main` branch. Every path in the wiki is
relative, so serving it from `/releaf-wiki/` rather than `/` needs no edit.

```bash
git add -A && git commit -m "Update the wiki" && git push
```

Pages rebuilds within a minute or so.

## Later: the iGEM wiki

The competition wiki is a separate repository on iGEM's GitLab, and it is the
only copy that gets judged. Content on any other host is outside the
competition and cannot be scored, which includes this GitHub repository once
the season is running.

Moving over is not just a copy. iGEM's GitLab limits (checked on
gitlab.igem.org/help/instance_configuration, 23 September 2026): a push can be at
most **11 MiB** and a CI job artifact, which is what GitLab Pages deploys, at most
**10 MiB**. This repository is about 264 MB (the figure `build/audit.py` prints
at the top of its report, excluding `.git`), nearly all of it images, video,
PDFs and 3D models, so every one of those files has to move to
`static.igem.wiki` (video to `video.igem.org`) and only the code goes into the
GitLab repository, pushed in pieces under 11 MiB. The official template builds
into `public/` with its own `.gitlab-ci.yml`, so a job that copies this site into
`public/` is needed too. The Releaf-Actual repository is a worked draft of that
packaging. The things that have to change:

1. **Re-host every image and the typeface on `static.igem.wiki`.** The wiki
   blocks resources served from another server, so a page whose photographs
   live on GitHub will render blank. Upload through the team's image tool, then
   repoint:
   - `photo:` paths in `assets/data/roster.js`
   - `src` and `srcset` in `index.html`
   - the two `@font-face` rules, in `assets/css/tokens.css` and
     `assets/css/team.css`
2. ~~**Put the real team number in the attributions iframe.**~~ Done:
   `attributions/index.html` embeds `teams.igem.org/wiki/6072/attributions`,
   which is GEMS Taiwan's 2026 team ID. The 2026 template also shows
   attributions on the team page itself; that is still unchecked.
3. **Check every slug survived.** `notes/structure.md` has the table. This is
   the step that costs awards if it is skipped.
4. **Delete every scaffold note.** Run `python3 build/audit.py` and read the
   leftovers table rather than grepping: a status box is written `class="status"`
   on two pages and `class="status ai"` on three, and a bare search for the first
   spelling misses the others. Nothing carrying either should be on a published
   page.

## Before the freeze, in order

The dates, from competition.igem.org/calendar (read 23 September 2026), all at
23:00 Taipei time (GMT+8):

| Date | What freezes or is due |
|---|---|
| 7 October | Project Safety Form, final version, submitted by a PI. Teams that miss it may be disqualified |
| 21 October | Wiki, Attributions Form, Judging Form, Registry contributions, Software. No extensions; no Judging Form means no medals or awards |


Run `python3 build/audit.py` first, and again after every batch of changes. It
reads every page and lists what would break or be blocked on the iGEM wiki:
resources from outside iGEM, links to files or anchors that do not exist, paths
that only work on a case-insensitive disk, standard addresses without a page,
and every scaffold, status, pending and placeholder marker still on a page. It
changes nothing, needs only Python, and exits non-zero while anything blocking
remains.

- [ ] Every page's Status reads Final, and Last updated is a real date
- [ ] No `scaffold` or `status` blocks left anywhere
- [ ] Every figure placeholder replaced or the figure removed
- [ ] Every image and font served from `static.igem.wiki`
- [ ] Attributions form filled in on teams.igem.org and embedding correctly
- [ ] Software repository on `gitlab.igem.org/2026/software/<team>/` (the
      2026 group; `2026/software-tools` does not exist) under an OSI-approved
      licence, with a README and pinned dependencies, under 50 MB, if competing
      for Best Software
- [ ] The iGEM rule check (bottom-right button on every page of the demo wiki)
      reads "clear" on every page, then `window.RULECHECK = false` in
      `assets/data/site-nav.js` for the copy that goes to GitLab
- [ ] Claude Code / AI use disclosed in the Attributions Form's AI section
- [ ] Part documentation on the Registry, linked from `/parts` and
      `/contribution`
- [ ] Safety forms filed, and `/safety-and-security` says which and when
- [ ] Nothing loads from a server outside iGEM: open each page with the network
      panel open and check every request
- [ ] Nobody appears in a photograph without having agreed to it

## The hardware section, before the freeze

Its own list, because it is the largest single body of content on the wiki and
none of it is covered by the generator's scaffold markers.

- [ ] **117 pending chips filled or removed.** 69 DiOPAL, 35 photometer, 13
      hydroponics; the bioreactor page has none left. Counted by
      `python3 build/audit.py`, whose leftovers table lists them per page. A bare
      `grep -rno 'pending' hardware/*/index.html | wc -l` answers 118, because
      one of them is the word in a sentence on the bioreactor page
- [x] **Empty photo slots** all filled or removed:
      `grep -rn 'frame[a-z ]*empty' hardware/*/index.html` finds none
- [ ] **1 open item** resolved, on the photometer page:
      `grep -rn 'openitem' hardware/*/index.html`
- [x] **Unwritten sections** all written: `grep -n 'blank-slot'
      hardware/photometer/index.html` finds none, and no heading on the page is
      empty
- [ ] The open contradictions settled: 8% against 7.7% accuracy, 10° against
      8.1° tilt, and the run-duration figures in `notes/structure.md`
- [ ] Every photograph under `hardware/*/photos/` and `hardware/img/` re-hosted
      on `static.igem.wiki` and its `src` swapped. They are already JPEG at
      1400px long edge, so they are sized for the upload tool
- [ ] The 62 notebook page scans re-hosted the same way
- [ ] three.js still vendored at `hardware/js/vendor/`, not a CDN
- [ ] The licence notice and repository link still on every page. They are
      required for judging, and the shared footer now carries them too
- [ ] STL downloads still reachable. They are the section's strongest
      differentiator and nothing else in the survey publishes per-part CAD
