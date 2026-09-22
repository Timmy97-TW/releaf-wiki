#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bring the nine MD report pages into the ReLeaf wiki.

Five changes, all mechanical, none of them touching the science:

  1. Pin the page to light. The wiki has no dark mode, so the theme button is
     hidden rather than deleted -- its click handler is written as
     $('#theme').onclick and would throw on a null.
  2. Swap the light palette for the ReLeaf tokens, and load the wiki's Inter.
  3. Point the nav brand back at the ReLeaf page instead of at a standalone
     overview.
  4. Give the page the wiki's favicon and title suffix, and a meta description
     to the two reports that come without one.
  5. Add the wiki's licence and repository notice under the report's own
     provenance footer. iGEM requires it on every page, and these pages have no
     wiki footer of their own.

Run it once per copy. It is idempotent: every replacement is a no-op the
second time.
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "md-simulations")

FILES = ["atpep1-benchmark-vs-bopep4", "apo-PEPR1", "bopep4-wt-round1",
         "bopep4-7-23", "bopep4-9-23-vs-wt", "bopep4-15-23-vs-wt",
         "bopep4-chis-vs-wt", "bopep4-lowph-vs-wt", "bopep4-9-23-lowph"]

# variable -> ReLeaf value, applied inside the first :root{} block only, which
# is the light palette. The dark blocks below it are left alone; data-theme
# ="light" on <html> stops them matching anyway.
#
# Keyed on the variable name and matched with a regex over the whole hex, not on
# the old literal: "--card:#fff" is a prefix of "--card:#ffffff", so a literal
# swap grows the value by three characters every time the script is run.
PALETTE = {
    "bg": "#fafafa",
    "card": "#ffffff",
    "ink": "#171717",
    "mut": "#525252",
    "line": "#e5e5e5",
    "soft": "#f4f9f6",
    "rec": "#23684a",
    "pep": "#b8532b",
    "amb": "#92610c",
    "ok": "#23684a",
    "warn": "#92610c",
    "bad": "#9a3d22",
    "foot-lo": "#d4d4d4",
    "foot-hi": "#23684a",
    "stage": "#f4f9f6",
}

SKIN = """<style id="releaf-skin">
/* The wiki typeface, self-hosted, so these pages read as part of the site and
   nothing is fetched from outside iGEM. The Chinese faces stay in the stack:
   Inter has no CJK coverage and the reports are bilingual. */
@font-face{font-family:"Inter";font-style:normal;font-weight:100 900;
  font-display:swap;src:url("../assets/fonts/inter-variable.ttf") format("truetype")}
body{font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",
  "PingFang TC","Noto Sans TC",sans-serif}
/* One accent that the palette swap cannot reach: links inherit --rec, but the
   selected-tab underline was drawn in the old teal. */
::selection{background:#cfe4d8;color:#171717}
</style>
"""

BRAND_OLD = ('<a class="navbrand" href="index.html">'
             '<b data-en="BoPep4 &times; PEPR1" data-zh="BoPep4 &times; PEPR1">'
             'BoPep4 &times; PEPR1</b><span>MD</span></a>')
BRAND_NEW = ('<a class="navbrand" href="./" '
             'data-ten="Back to the MD Simulations page on the ReLeaf wiki" '
             'data-tzh="回到 ReLeaf wiki 的分子動力學模擬頁" '
             'title="Back to the MD Simulations page on the ReLeaf wiki">'
             '<b data-en="&larr; ReLeaf" data-zh="&larr; ReLeaf">&larr; ReLeaf</b>'
             '<span>MD</span></a>')

# Only for reports that ship without a meta description; the wording is the
# report's own title, h1 and system line, in the pattern the other seven use.
DESCRIPTIONS = {
    "atpep1-benchmark-vs-bopep4":
        "Molecular dynamics of the AtPep1 benchmark vs BoPep4 on the PEPR1 "
        "ectodomain, 30 ns. The ruler is calibrated.",
    "bopep4-wt-round1":
        "Molecular dynamics of BoPep4 Round 1: BoPep4 wild type on the PEPR1 "
        "ectodomain, 30 ns. Asn23 never let go.",
}

# The wording is the footer of every other wiki page (description/index.html).
# The marker comment is what makes a second run a no-op.
LEGAL_MARK = "<!-- releaf-legal: licence + repository notice, build/md_reskin_reports.py -->"
LEGAL_CSS = """<style id="releaf-legal">
.releaf-legal{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);
  font-size:12px;line-height:1.6;color:var(--mut)}
.releaf-legal p{margin:0 0 4px}
.releaf-legal a{font-weight:inherit}
</style>
"""
LEGAL_HTML = (LEGAL_MARK + "\n"
    '<footer class="releaf-legal">\n'
    '  <p>&copy; 2026 &middot; Content on this wiki is licensed under a '
    '<a href="https://creativecommons.org/licenses/by/4.0/" rel="license">'
    'Creative Commons Attribution 4.0 International license</a>.</p>\n'
    '  <p>The repository used to create this website is available at '
    '<a href="https://gitlab.igem.org/2026/gems-taiwan">'
    'gitlab.igem.org/2026/gems-taiwan</a>.</p>\n'
    '</footer>\n')
FOOT_ANCHOR = '<div class="foot" id="foot"></div>\n'

THEME_OLD = '<button id="theme" aria-label="Theme">&#9689;</button>'
THEME_NEW = ('<!-- the wiki is light only; the button stays in the DOM because '
             'the page script binds to it -->\n'
             '  <button id="theme" hidden aria-hidden="true" tabindex="-1"></button>')


def reskin(path, slug):
    src = io.open(path, encoding="utf-8").read()
    before = src

    # 1. light, pinned
    if 'data-theme="light"' not in src[:400]:
        if src.lstrip().lower().startswith("<!doctype"):
            src = src.replace('<html lang="en">',
                              '<html lang="en" data-theme="light">', 1)
        else:
            src = ('<!doctype html>\n<html lang="en" data-theme="light">\n' + src)

    # 2. palette, inside the first :root block
    i = src.find(":root{")
    j = src.find("}", i)
    if i == -1:
        raise SystemExit("no :root block in %s" % path)
    block = src[i:j]
    for name, value in PALETTE.items():
        block = re.sub(r"--%s\s*:\s*#[0-9a-fA-F]{3,12}" % re.escape(name),
                       "--%s:%s" % (name, value), block)
    src = src[:i] + block + src[j:]

    # 3. the wiki typeface, injected after the page's own stylesheet
    if 'id="releaf-skin"' not in src:
        k = src.find("</style>")
        src = src[:k + len("</style>")] + "\n" + SKIN + src[k + len("</style>"):]

    # 4. favicon and title suffix
    m = re.search(r"<title>(.*?)</title>", src, re.S)
    if m and "ReLeaf" not in m.group(1):
        src = (src[:m.start()]
               + "<title>%s | ReLeaf &middot; iGEM 2026</title>\n"
                 '<link rel="icon" href="../assets/img/logo.png">' % m.group(1)
               + src[m.end():])

    # 4b. meta description, only where the report has none
    head = src[:src.find("<style")]
    if slug in DESCRIPTIONS and '<meta name="description"' not in head:
        icon = '<link rel="icon" href="../assets/img/logo.png">'
        k = src.find(icon)
        if k == -1:
            raise SystemExit("no favicon link to anchor the description in %s" % path)
        k += len(icon)
        src = (src[:k] + '\n<meta name="description" content="%s">'
               % DESCRIPTIONS[slug] + src[k:])

    # 5. theme button hidden, brand pointed home
    src = src.replace(THEME_OLD, THEME_NEW, 1)
    src = src.replace(BRAND_OLD, BRAND_NEW, 1)

    # 6. licence + repository notice, below the report's provenance footer
    if LEGAL_MARK not in src:
        k = src.find(FOOT_ANCHOR)
        if k == -1:
            raise SystemExit("no provenance footer to anchor the notice in %s" % path)
        k += len(FOOT_ANCHOR)
        src = src[:k] + LEGAL_HTML + src[k:]
    if 'id="releaf-legal"' not in src:
        k = src.find('<style id="releaf-skin">')
        k = src.find("</style>", k) + len("</style>\n")
        src = src[:k] + LEGAL_CSS + src[k:]

    if src != before:
        io.open(path, "w", encoding="utf-8").write(src)
    return src != before


if __name__ == "__main__":
    for name in FILES:
        p = os.path.join(DIR, name + ".html")
        print(("changed " if reskin(p, name) else "no change ") + name)
