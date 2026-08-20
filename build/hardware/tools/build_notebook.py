#!/usr/bin/env python3
"""Build the hardware notebook reader and the hub band that leads to it.

The notebook is shown as the pages the team actually designed — cream stock,
dark green header, gold annotations — rendered from their deck. It is NOT
re-typeset into the site's dark theme: the layout is the record, and rebuilding
it would quietly change what the record says.

What the site adds is the reading experience. A PDF viewer paginates: you click,
a page replaces the one before it, and you lose your place. Here the pages are
stacked and scroll continuously, with an index rail that stays put so you can
jump by week and see where you are in five months of work.

Inputs
  tools/notebook.json       parsed entry metadata (tools/parse_notebook.py)
  tools/slide_to_page.json  deck slide number -> rendered page number
  hardware/notebook/pages/  p01.png ... pNN.png

Run from the repo root:  python3 tools/build_notebook.py
"""
import glob, html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "tools", "notebook.json")
MAP = os.path.join(ROOT, "tools", "slide_to_page.json")
PAGEDIR = os.path.join(ROOT, "hardware", "notebook", "pages")
OUT = os.path.join(ROOT, "hardware", "notebook", "index.html")
BAND = os.path.join(ROOT, "tools", "_hub-band.html")

PAGE_W, PAGE_H = 1020, 1320

MARKS = {
    "BR": ("Bioreactor",      "../bioreactor/index.html"),
    "PH": ("Photometer",      "../photometer/index.html"),
    "LP": ("DiOPAL",          "../diopal/index.html"),
    "HB": ("Humidity box",    None),
    "IS": ("Imaging station", None),
    "FP": ("Floating plate",  None),
    "--": ("Pre-pivot",       None),
}
ORDER = ["BR", "PH", "LP", "HB", "IS", "FP", "--"]
PICKS = ["Told to drop soil sensing",
         "The cells barely grow in the reactor",
         "The photometer catches the pump failing"]


def esc(s):
    return html.escape(s or "", quote=True)


def load():
    entries = json.load(open(DATA))
    smap = {int(k): v for k, v in json.load(open(MAP)).items()}
    for e in entries:
        e["pages"] = sorted(smap[s] for s in e["slides"] if s in smap)
    return entries


def rail_html(entries):
    o = ['<nav class="nbr-rail" id="nbr-rail" aria-label="Jump to a week">',
         '  <div class="nbr-rail-h">Weeks</div>', '  <ol>']
    for i, e in enumerate(entries):
        mark = e["mark"] or "--"
        o.append(
            f'    <li data-mark="{esc(mark)}"><a href="#w{e["weekno"]:02d}-{i}" '
            f'data-page="{e["pages"][0]}"><b>{esc(e["week"].replace("WEEK ", "W"))}</b>'
            f'<span>{esc(e["title"])}</span></a></li>')
    o += ['  </ol>', '</nav>']
    return "\n".join(o)


def pages_html(entries, npages):
    # first page of each entry carries the entry anchor, so hub links land on it
    anchor, meta = {}, {}
    for i, e in enumerate(entries):
        anchor[e["pages"][0]] = f'w{e["weekno"]:02d}-{i}'
        meta[e["pages"][0]] = e
    o = ['<div class="nbr-pages" id="nbr-pages">']
    for n in range(1, npages + 1):
        ids = f' id="{anchor[n]}"' if n in anchor else ""
        e = meta.get(n)
        lbl = (f'{e["week"]} — {e["title"]}' if e else f'Notebook page {n}')
        mark = (e["mark"] or "--") if e else ""
        dm = f' data-mark="{esc(mark)}"' if mark else ""
        o.append(f'  <figure class="nbr-page" data-page="{n}"{dm}>')
        o.append(f'    <span class="nbr-anchor"{ids}></span>')
        o.append(f'    <img src="pages/p{n:02d}.png" alt="{esc(lbl)}" '
                 f'width="{PAGE_W}" height="{PAGE_H}" '
                 f'loading="{"eager" if n <= 2 else "lazy"}" decoding="async">')
        o.append(f'    <figcaption>Page {n} of {npages}</figcaption>')
        o.append('  </figure>')
    o.append('</div>')
    return "\n".join(o)


def strip_html(entries, href_base="notebook/index.html"):
    lo = min(e["weekno"] for e in entries)
    hi = max(e["weekno"] for e in entries)
    out = ['  <div class="nb-strip" role="list" aria-label="Every week of the record">']
    for w in range(lo, hi + 1):
        wk = [(i, e) for i, e in enumerate(entries) if e["weekno"] == w]
        out.append(f'    <div class="nb-wk{"" if wk else " empty"}" role="listitem">')
        if wk:
            for i, e in wk:
                mark = e["mark"] or "--"
                out.append(
                    f'      <a class="nb-cell" data-mark="{esc(mark)}" '
                    f'href="{href_base}#w{e["weekno"]:02d}-{i}" '
                    f'title="W{w:02d} — {esc(e["title"])}"><span>{esc(mark)}</span></a>')
        else:
            out.append('      <span class="nb-cell" aria-hidden="true"></span>')
        out.append(f'      <div class="nb-wk-n">{w:02d}</div>')
        out.append('    </div>')
    out.append('  </div>')
    return "\n".join(out)


def band_html(entries, npages):
    weeks = sorted({e["weekno"] for e in entries})
    used = [m for m in ORDER if any((e["mark"] or "--") == m for e in entries)]
    picks = [(i, e) for t in PICKS for i, e in enumerate(entries) if e["title"] == t]

    o = ['<!-- ─────────── hardware notebook ─────────── -->',
         '<section class="nb-band" id="notebook">',
         '  <div class="nb-band-head">',
         '    <div>',
         '      <div class="eyebrow">The record behind all three</div>',
         '      <h2>Every week we built,<br /><em>including the ones we got wrong</em></h2>',
         '    </div>',
         '    <div>',
         f'      <p class="nb-lede">The hardware notebook, kept as the work happened rather than '
         f'written up afterwards. <b>{len(entries)} entries</b> over <b>{len(weeks)} weeks</b>, each '
         'carrying the decision we made, the option we turned down, and what was still broken when '
         'the week closed. Weeks 1&ndash;3 are missing because nothing happened, and we would rather '
         'say so than invent them.</p>',
         '      <div class="nb-figures">',
         f'        <div><span class="nb-fig-n">{len(entries)}</span><span class="nb-fig-l">Entries</span></div>',
         f'        <div><span class="nb-fig-n">{len(weeks)}</span><span class="nb-fig-l">Weeks</span></div>',
         f'        <div><span class="nb-fig-n">{npages}</span><span class="nb-fig-l">Pages</span></div>',
         '        <div><span class="nb-fig-n nb-fig-span">23 Mar &ndash; 13 Aug</span>'
         '<span class="nb-fig-l">2026</span></div>',
         '      </div>',
         '    </div>',
         '  </div>',
         strip_html(entries),
         '  <div class="nb-legend">']
    for m in used:
        o.append(f'    <span data-mark="{m}"><i></i>{esc(MARKS[m][0])}</span>')
    o.append('  </div>')

    o.append('  <div class="nb-picks">')
    for i, e in picks:
        mark = e["mark"] or "--"
        o.append(f'    <a class="nb-pick" data-mark="{esc(mark)}" '
                 f'href="notebook/index.html#w{e["weekno"]:02d}-{i}">')
        o.append(f'      <span class="nb-pick-w">{esc(e["week"])} &middot; {esc(MARKS[mark][0])}</span>')
        o.append(f'      <b>{esc(e["title"])}</b>')
        # the context paragraph, not the first bullet: bullets carry the
        # notebook's inline blanks ("Prof. Chen of   institution  ,") which read
        # as broken grammar once flattened out of their styling
        teaser = re.sub(r"\s{2,}", " ", (e["context"] or "")).strip()
        cut = teaser[:150].rsplit(" ", 1)[0] if len(teaser) > 150 else teaser
        o.append(f'      <p>{esc(cut)}{"&hellip;" if len(teaser) > 150 else ""}</p>')
        o.append('    </a>')
    o.append('  </div>')

    o += ['  <div class="nb-cta">',
          '    <a class="nb-go" href="notebook/index.html">Read the notebook <i>&rarr;</i></a>',
          f'    <span class="nb-alt-note">{npages} pages, scrolls straight through</span>',
          '  </div>',
          '</section>']
    return "\n".join(o)


def page_html(entries, npages):
    weeks = sorted({e["weekno"] for e in entries})
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Hardware Notebook — GEMS-Taiwan</title>
<meta name="description" content="The GEMS-Taiwan hardware notebook: {len(entries)} weekly entries across {npages} pages, 23 March to 13 August 2026, covering the photometer, DiOPAL, the perfusion bioreactor and five earlier builds." />
<link rel="stylesheet" href="../css/hub.css" />
<link rel="stylesheet" href="../css/polish.css" />
<link rel="stylesheet" href="../css/notebook.css" />
<script>document.documentElement.className+=' js'</script>
</head>
<body data-instrument="notebook">
<a class="skip-link" href="#main">Skip to content</a>

<div class="bg-glow"></div>
<div class="grid-lines"></div>
<div class="grain"></div>
<div class="vignette"></div>

<div class="nbr-progress" aria-hidden="true"><div id="nbr-bar"></div></div>

<header class="topbar">
  <a class="brand back" href="../index.html"><i>&#8592;</i> GEMS<span>&#8209;</span>Taiwan</a>
  <div class="topbar-meta"><a href="../index.html">Hardware</a> <span>/</span> Notebook</div>
</header>

<main id="main">
  <header class="nbr-head">
    <div class="eyebrow">Hardware notebook</div>
    <h1>Week by week,<br />23 March to 13 August 2026</h1>
    <p class="standfirst">
      The pages below are the notebook itself, exactly as the team laid it out &mdash;
      {npages} pages covering {len(weeks)} weeks. They run top to bottom in one
      continuous scroll rather than a page at a time, so you can read straight
      through or jump by week from the index on the left.
    </p>
  </header>

  <div class="nbr-wrap">
{rail_html(entries)}
{pages_html(entries, npages)}
  </div>
</main>

<footer class="doc-foot">
  <div class="outro-meta">GEMS-Taiwan &middot; iGEM 2026 &middot; Biomanufacturing</div>
  <!-- Required on every page for judging: license notice + repository link. -->
  <div class="legal">
    <p>&copy; 2026 &middot; Content on this site is licensed under a
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="license">Creative
      Commons Attribution 4.0 International license</a>.</p>
    <p>The repository used to create this website is available at
      <a href="https://gitlab.igem.org/2026/gems-taiwan">gitlab.igem.org/2026/gems-taiwan</a>.</p>
  </div>
</footer>

<script src="../js/notebook.js"></script>
</body>
</html>
"""


if __name__ == "__main__":
    entries = load()
    npages = len(glob.glob(os.path.join(PAGEDIR, "p*.png")))
    if not npages:
        raise SystemExit("no rendered pages in hardware/notebook/pages/")
    open(OUT, "w").write(page_html(entries, npages))
    open(BAND, "w").write(band_html(entries, npages))
    print(f"{len(entries)} entries over {npages} pages")
    print("wrote", os.path.relpath(OUT, ROOT))
    print("wrote", os.path.relpath(BAND, ROOT))
