#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thread the new MD Simulations page into the footers and the prev/next rail.

generate.py owns those links, but it refuses to rewrite a page a human has
started, which by now is most of them. So the one-off edit is done here:

  * every footer's Dry Lab column gains an MD Simulations entry, after Peptide
    Design, at whatever depth that page sits;
  * peptide-design's "next" and drylab-notebook's "previous" point at it.
"""
import glob
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def depth_prefix(path):
    """../ for a page one folder down, ../../ for two, "" at the root."""
    rel = os.path.relpath(os.path.dirname(path), ROOT)
    return "" if rel == "." else "../" * len(rel.split(os.sep))


def main():
    files = sorted(glob.glob(os.path.join(ROOT, "*.html")) +
                   glob.glob(os.path.join(ROOT, "*", "*.html")) +
                   glob.glob(os.path.join(ROOT, "*", "*", "*.html")))
    footers = prevnext = 0

    for path in files:
        if "/md-simulations/" in path:
            continue
        src = io.open(path, encoding="utf-8").read()
        if "md-simulations/" in src:
            continue
        before = src
        p = depth_prefix(path)

        pep = '<li><a href="%speptide-design/">Peptide Design</a></li>' % p
        md  = '<li><a href="%smd-simulations/">MD Simulations</a></li>' % p
        if pep in src:
            src = src.replace(pep, pep + "\n          " + md, 1)
            footers += 1

        # peptide-design used to hand straight over to the notebook
        nxt = '<a class="is-next" href="%sdrylab-notebook/"><b>Next</b><span>Dry Lab Notebook</span></a>' % p
        if "peptide-design" in path and nxt in src:
            src = src.replace(nxt,
                '<a class="is-next" href="%smd-simulations/"><b>Next</b>'
                '<span>MD Simulations</span></a>' % p, 1)
            prevnext += 1
        prv = '<a class="is-prev" href="%speptide-design/"><b>Previous</b><span>Peptide Design</span></a>' % p
        if "drylab-notebook" in path and prv in src:
            src = src.replace(prv,
                '<a class="is-prev" href="%smd-simulations/"><b>Previous</b>'
                '<span>MD Simulations</span></a>' % p, 1)
            prevnext += 1

        if src != before:
            io.open(path, "w", encoding="utf-8").write(src)

    print("footers patched: %d,  prev/next patched: %d" % (footers, prevnext))


if __name__ == "__main__":
    main()
