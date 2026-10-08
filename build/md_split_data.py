#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Move each MD report's data out of its page and into its own JSON file.

    python3 build/md_split_data.py

The nine report pages arrive from the MD repo with everything inline: the
trajectory (uint16 coordinates, base64), the per-residue tables and the chart
series all sit in one <script id="D" type="application/json"> block, 0.2-3.8 MB
per page. That made every report a 3-4 MB HTML file which showed nothing until
the last byte arrived, and put 27 MB of data into the code repository.

For each report this:
  1. writes the block's text, unchanged, to md-simulations/data/<name>.json;
  2. leaves the <script id="D"> element in place but empty, with data-src
     naming that file, and preloads the file from <head>;
  3. turns the report's own script into type="text/x-report" so it does not run
     on parse, and adds a loader that fetches the JSON, puts it back into the D
     element, then runs the report's script exactly as written.

The report code is not edited: it still reads document.getElementById('D'),
and its top-level names are still globals, so nothing in it can tell the
difference. On iGEM the JSON goes to the CDN like any other upload (JSON is an
allowed type, and the CDN sends Access-Control-Allow-Origin: *).

Safe to run again: a page whose D block is already empty is skipped. When a
fresh report comes over from the MD repo, run md_reskin_reports.py first, then
this. md_banner.py, md_hero_frames.py and md_traces.py read the JSON files.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "md-simulations")

FILES = ["atpep1-benchmark-vs-bopep4", "apo-PEPR1", "bopep4-wt-round1",
         "bopep4-7-23", "bopep4-9-23-vs-wt", "bopep4-15-23-vs-wt",
         "bopep4-chis-vs-wt", "bopep4-lowph-vs-wt", "bopep4-9-23-lowph"]

D_BLOCK = re.compile(r'<script id="D" type="application/json"[^>]*>(.*?)</script>', re.S)

LOADER = """<script id="report-load">
/* The data this report draws is in its own file, so the page arrives first.
   Put it back where the report expects it, then run the report as written. */
(function(){
 var holder=document.getElementById('D'), code=document.getElementById('report-main');
 fetch(holder.getAttribute('data-src')).then(function(r){
   if(!r.ok)throw new Error(r.status+' '+r.url);return r.text()})
 .then(function(txt){
   holder.textContent=txt;
   var s=document.createElement('script');s.text=code.textContent;
   code.parentNode.insertBefore(s,code.nextSibling)})
 .catch(function(e){console.error('report data did not load:',e)});
})();
</script>
"""


def split(name):
    path = os.path.join(DIR, name + ".html")
    page = open(path, encoding="utf-8").read()
    m = D_BLOCK.search(page)
    if not m:
        sys.exit(f"{name}: no <script id=\"D\"> block")
    data = m.group(1)
    if not data.strip():
        return None
    rel = f"data/{name}.json"
    with open(os.path.join(DIR, rel), "w", encoding="utf-8") as f:
        f.write(data)

    # The report's script is the first bare <script> after the data block.
    i = page.find("<script>", m.end())
    if i < 0:
        sys.exit(f"{name}: no report script after the data block")
    end = page.find("</script>", i) + len("</script>")
    main = page[i:end].replace("<script>", '<script type="text/x-report" id="report-main">', 1)

    page = (page[:m.start()]
            + f'<script id="D" type="application/json" data-src="{rel}"></script>'
            + page[m.end():i] + main + "\n" + LOADER + page[end:])
    preload = f'<link rel="preload" href="{rel}" as="fetch" crossorigin="anonymous">\n'
    page = page.replace("</head>", preload + "</head>", 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)
    return len(data)


def main():
    for name in FILES:
        n = split(name)
        print(f"{name:28} " + ("already split" if n is None else f"{n / 1e6:.2f} MB -> data/{name}.json"))


if __name__ == "__main__":
    main()
