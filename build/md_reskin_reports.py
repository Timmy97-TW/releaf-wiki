#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bring the nine MD report pages into the ReLeaf wiki.

Four changes, all mechanical, none of them touching the science:

  1. Pin the page to light. The wiki has no dark mode, so the theme button is
     hidden rather than deleted -- its click handler is written as
     $('#theme').onclick and would throw on a null.
  2. Swap the light palette for the ReLeaf tokens, and load the wiki's Inter.
  3. Point the nav brand back at the ReLeaf page instead of at a standalone
     overview.
  4. Give the page the wiki's favicon and title suffix.

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

THEME_OLD = '<button id="theme" aria-label="Theme">&#9689;</button>'
THEME_NEW = ('<!-- the wiki is light only; the button stays in the DOM because '
             'the page script binds to it -->\n'
             '  <button id="theme" hidden aria-hidden="true" tabindex="-1"></button>')


def reskin(path):
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

    # 5. theme button hidden, brand pointed home
    src = src.replace(THEME_OLD, THEME_NEW, 1)
    src = src.replace(BRAND_OLD, BRAND_NEW, 1)

    if src != before:
        io.open(path, "w", encoding="utf-8").write(src)
    return src != before


if __name__ == "__main__":
    for name in FILES:
        p = os.path.join(DIR, name + ".html")
        print(("changed " if reskin(p) else "no change ") + name)
