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

Moving over is mostly a copy, because there is no build step. The things that
have to change:

1. **Re-host every image and the typeface on `static.igem.wiki`.** The wiki
   blocks resources served from another server, so a page whose photographs
   live on GitHub will render blank. Upload through the team's image tool, then
   repoint:
   - `photo:` paths in `assets/data/roster.js`
   - `src` and `srcset` in `index.html`
   - the two `@font-face` rules, in `assets/css/tokens.css` and
     `assets/css/team.css`
2. **Put the real team number in the attributions iframe.** Replace `0000` in
   `attributions/index.html`.
3. **Check every slug survived.** `notes/structure.md` has the table. This is
   the step that costs awards if it is skipped.
4. **Delete every scaffold note.** Search for `class="scaffold"` and for
   `class="status"`; nothing carrying either should be on a published page.

## Before the freeze, in order

- [ ] Every page's Status reads Final, and Last updated is a real date
- [ ] No `scaffold` or `status` blocks left anywhere
- [ ] Every figure placeholder replaced or the figure removed
- [ ] Every image and font served from `static.igem.wiki`
- [ ] Attributions form filled in on teams.igem.org and embedding correctly
- [ ] Software repository on `gitlab.igem.org/2026/software-tools/` under an
      OSI-approved licence, if competing for Best Software
- [ ] Part documentation on the Registry, linked from `/parts` and
      `/contribution`
- [ ] Safety forms filed, and `/safety-and-security` says which and when
- [ ] Nothing loads from a server outside iGEM: open each page with the network
      panel open and check every request
- [ ] Nobody appears in a photograph without having agreed to it
