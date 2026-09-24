#!/usr/bin/env python3
"""Write heading ids into the HTML, so links to a sub-section work without JS.

page.js gives every <h2>/<h3> in .pagebody an id at load time if it has none
(a slug of its words, with -2, -3 ... for repeats). Other pages link to those
ids, and a link like /plant/#hydroponics-with-prof-cheng then only resolves
once page.js has run, and breaks silently the day someone edits the heading.

This script writes the exact id page.js would have made into every such
heading that lacks one. Nothing else in the file changes: the attribute is
inserted into the start tag and every other byte is left as it was. Headings
that already carry an id are never touched, so running it twice changes
nothing the second time.

    python3 build/ids.py            # every page, write in place
    python3 build/ids.py --check    # list what would change, write nothing
    python3 build/ids.py plant/index.html engineering/index.html

Skipped, as page.js skips them: headings inside .refs, headings with
data-no-toc, and everything outside the first .pagebody. Also skipped: the
generated MD reports, education/website, hardware (its own system) and
software/ui/0906UI.html.

A heading whose enclosing <section> already carries the id it would get is
left without one, exactly as page.js leaves it: the section is the target.

The slug is page.js's own: lower case, trimmed, anything that is not an
ASCII letter or digit, _, a CJK ideograph (U+4E00-U+9FFF), whitespace or -
dropped, whitespace runs to -, and repeated - collapsed. If page.js's slug()
changes, change slug() here to match.
"""
import re, sys, pathlib
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = ("education/website/", "hardware/", "software/ui/", "node_modules/")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


def slug(t):
    t = t.lower().strip()
    t = re.sub(r"[^A-Za-z0-9_一-鿿\s-]", "", t)
    t = re.sub(r"\s+", "-", t)
    return re.sub(r"-+", "-", t)


class Scan(HTMLParser):
    """Records every element's id and ancestry, and each candidate heading's
    start-tag offset and text."""

    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.lines = [0]
        for m in re.finditer("\n", src):
            self.lines.append(m.end())
        self.stack = []          # open elements: dicts
        self.ids = {}            # id -> element dict (first wins, as getElementById)
        self.heads = []          # candidate headings, in document order
        self.pagebody = None     # the first .pagebody element
        self.n = 0

    def _abs(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.n += 1
        el = {"tag": tag, "id": a.get("id"), "cls": (a.get("class") or "").split(),
              "parent": self.stack[-1] if self.stack else None, "n": self.n,
              "pos": self._abs(), "raw": self.get_starttag_text(), "attrs": a, "text": []}
        if el["id"] and el["id"] not in self.ids:
            self.ids[el["id"]] = el
        if "pagebody" in el["cls"] and self.pagebody is None:
            self.pagebody = el
        if tag in ("h2", "h3"):
            self.heads.append(el)
        if tag not in VOID:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1]["tag"] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        for el in self.stack:
            if el["tag"] in ("h2", "h3"):
                el["text"].append(data)


def ancestors(el):
    p = el["parent"]
    while p:
        yield p
        p = p["parent"]


def plan(src):
    s = Scan(src)
    s.feed(src)
    s.close()
    if s.pagebody is None:
        return []
    taken = dict(s.ids)
    out = []
    for h in s.heads:
        anc = list(ancestors(h))
        if s.pagebody not in anc:
            continue
        if any("refs" in a["cls"] for a in anc) or "data-no-toc" in h["attrs"]:
            continue
        if h["id"]:
            continue
        base = slug("".join(h["text"])) or "section"
        new, k = base, 2
        while new in taken and taken[new] is not h and taken[new] not in anc:
            new = base + "-" + str(k)
            k += 1
        if new in taken:
            # the heading's own <section> already carries this id; page.js
            # links to the section and gives the heading no copy of it, and
            # neither does this script (a second element with the same id
            # would be a duplicate id)
            continue
        h["id"] = new
        taken.setdefault(new, h)
        out.append((h, new))
    return out


def apply(src, changes):
    # insert right after "<h2" / "<h3", back to front so offsets hold
    for h, new in sorted(changes, key=lambda c: -c[0]["pos"]):
        at = h["pos"] + 3
        assert src[h["pos"]:at].lower() in ("<h2", "<h3"), src[h["pos"]:h["pos"] + 20]
        src = src[:at] + ' id="' + new + '"' + src[at:]
    return src


def pages(args):
    if args:
        return [ROOT / a for a in args]
    found = []
    for f in sorted(ROOT.rglob("index.html")):
        r = f.relative_to(ROOT).as_posix()
        if r.startswith(SKIP) or "/.git/" in r:
            continue
        found.append(f)
    return found


def main(argv):
    check = "--check" in argv
    args = [a for a in argv if not a.startswith("--")]
    total = 0
    for f in pages(args):
        src = f.read_text(encoding="utf-8")
        changes = plan(src)
        if not changes:
            continue
        total += len(changes)
        rel = f.relative_to(ROOT).as_posix()
        print(f"{rel}: {len(changes)} heading id(s)")
        for h, new in changes:
            print(f"    #{new}")
        if not check:
            f.write_text(apply(src, changes), encoding="utf-8")
    print(("would add " if check else "added ") + str(total) + " id(s)")


if __name__ == "__main__":
    main(sys.argv[1:])
