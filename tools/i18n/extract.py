#!/usr/bin/env python3
"""Pull the translatable strings out of the wiki pages.

One JSON file per page in static/i18n/<page>.json:

    {"page": "measurement",
     "blocks": [{"k": "<key>", "n": 0, "tag": "p", "en": "<innerHTML>",
                 "text": "<normalised textContent>", "zh": ""}, ...],
     "attrs":  [{"k": "<key>", "n": 0, "attr": "alt", "en": "...", "zh": ""}, ...]}

The key is a hash of the NORMALISED TEXT CONTENT, never of the markup: a
browser does not hand back the innerHTML we wrote (it drops the slash in
<br />, decodes &middot;, reorders nothing but quotes differently), while
textContent is the same string on both sides. So i18n.js can find the element
this entry belongs to without us writing a single id into the pages, and a
later edit that changes only markup keeps its translation.

`n` disambiguates repeated text inside one page ("Figure 1." twice, say) by
document order.

Re-running the script keeps every zh string whose English text is unchanged
and reports what moved, so a page can be re-extracted after an edit without
losing work.

    python3 -I tools/i18n/extract.py            # every page
    python3 -I tools/i18n/extract.py measurement home
"""

from __future__ import annotations

import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGES = ROOT / "wiki" / "pages"
OUT = ROOT / "tools" / "i18n" / "src"

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}

# Nothing inside these is prose we translate.
SKIP = {"script", "style", "svg", "noscript", "template", "canvas", "iframe",
        "code", "pre", "math", "select",
        # the head is handled by head_bits(); <title> would otherwise be taken
        # twice, once as itself and once as a loose text node
        "head", "title"}

# Tags that mean "this element is a container, not one unit of prose".
CONTAINER = {"html", "body", "head", "div", "section", "article", "main",
             "header", "footer", "aside", "nav", "ul", "ol", "dl", "table",
             "thead", "tbody", "tfoot", "tr", "figure", "details", "form",
             "fieldset", "picture", "video", "audio", "map", "colgroup"}

# A unit of prose is the outermost of these with no block-level descendant.
CAND = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "figcaption", "caption",
        "th", "td", "dt", "dd", "blockquote", "summary", "button", "label",
        "legend", "option", "a", "span", "strong", "em", "b", "i", "small",
        "abbr", "time", "cite", "q", "div", "address", "output", "mark"}

BLOCK_LEVEL = CONTAINER | (CAND - {"a", "span", "strong", "em", "b", "i",
                                   "small", "abbr", "time", "cite", "q",
                                   "mark", "output"})

ATTRS = ("alt", "title", "aria-label", "aria-description", "placeholder",
         "aria-roledescription",
         # data-* a page's own script renders as visible text: a short label
         # for the contents rail, a photo caption, a column head, a person's
         # role. build.py mirrors these into the text dictionary as well, so
         # the words the script has already written are matched too.
         "data-toc", "data-label", "data-cap", "data-name", "data-title",
         "data-role", "data-en")

SPACE = re.compile(r"[\s     ]+")
HAS_LETTER = re.compile(r"[A-Za-z]")

# Jinja survives in the ported pages (the footer's url_for loop, {{ tab }});
# a bare URL or file name is not prose either.
JINJA = re.compile(r"\{[{%]")
URLISH = re.compile(
    r"^(?:https?://|/|\./|\.\./|[\w./-]+\.(?:html|webp|png|jpe?g|svg|json|csv|css|js|pdf|mp4|glb|woff2?))$")


def prose(t):
    """Is this string a piece of prose a translator should see?"""
    return (len(t) > 1 and bool(HAS_LETTER.search(t))
            and not JINJA.search(t) and not URLISH.match(t))



def norm(s: str) -> str:
    """The one normalisation. i18n.js has the same four lines."""
    return SPACE.sub(" ", s).strip()


def key(s: str) -> str:
    """FNV-1a, 64-bit, hex. Short, stable, and trivial to redo in JS."""
    h = 0xCBF29CE484222325
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return format(h, "016x")


class Node:
    __slots__ = ("tag", "attrs", "kids", "data", "parent")

    def __init__(self, tag, attrs=None, data=None, parent=None):
        self.tag = tag              # None marks a text node
        self.attrs = attrs or []
        self.kids = []
        self.data = data
        self.parent = parent


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, parent=self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, attrs, parent=self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root:
            if n.tag == tag:
                self.cur = n.parent
                return
            n = n.parent
        # stray close tag: the pages have a few; ignore it rather than reparent

    def handle_data(self, data):
        if data:
            self.cur.kids.append(Node(None, data=data, parent=self.cur))


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inner_html(n: Node) -> str:
    out = []
    for k in n.kids:
        if k.tag is None:
            out.append(esc(k.data))
        else:
            out.append(outer_html(k))
    return "".join(out)


def outer_html(n: Node) -> str:
    a = "".join(
        " " + k + ('="' + html.escape(v, quote=True) + '"' if v is not None else "")
        for k, v in n.attrs
    )
    if n.tag in VOID:
        return "<" + n.tag + a + " />"
    return "<" + n.tag + a + ">" + inner_html(n) + "</" + n.tag + ">"


def text_of(n: Node) -> str:
    if n.tag in SKIP:
        return ""
    if n.tag is None:
        return n.data
    return "".join(text_of(k) for k in n.kids)


def has_block_kid(n: Node) -> bool:
    for k in n.kids:
        if k.tag is None:
            continue
        if k.tag in BLOCK_LEVEL or k.tag in SKIP or has_block_kid(k):
            return True
    return False


def collect(n: Node, blocks: list, attrs: list, seen: dict, aseen: dict):
    """Walk the tree; take the outermost prose unit on each branch."""
    for k in n.kids:
        if k.tag is None:
            # loose text in a container: its own unit, replaced as a text node
            t = norm(k.data)
            if prose(t):
                add(blocks, seen, "#text", t, esc(k.data.strip()))
            continue
        # attributes first: an <svg> is skipped below but carries the
        # aria-label that names the drawing
        for name, val in k.attrs:
            if name in ATTRS and val:
                t = norm(val)
                if prose(t):
                    aadd(attrs, aseen, name, t)
        if k.tag in SKIP:
            # A diagram's own labels are translated, but an element holding an
            # <svg> is never itself a unit: a paragraph with an inline icon
            # would otherwise have to carry the icon's paths in its
            # translation. So walk into the drawing, and leave the ancestors
            # to has_block_kid(), which counts svg as block-level.
            if k.tag == "svg":
                collect(k, blocks, attrs, seen, aseen)
            continue
        if k.tag in CAND and not has_block_kid(k):
            t = norm(text_of(k))
            if prose(t):
                add(blocks, seen, k.tag, t, norm(inner_html(k)))
                # The unit's own words are now accounted for, but an element
                # INSIDE it can still carry words of its own: the alt on an
                # image in a paragraph, a data-* a script prints. Read those
                # before moving on, and do not look for more blocks in here.
                attrs_within(k, attrs, aseen)
                continue
        collect(k, blocks, attrs, seen, aseen)


def attrs_within(n, attrs, aseen):
    """Collect translatable attributes from everything under a prose unit."""
    for k in n.kids:
        if k.tag is None or k.tag in SKIP:
            continue
        for name, val in k.attrs:
            if name in ATTRS and val:
                t = norm(val)
                if prose(t):
                    aadd(attrs, aseen, name, t)
        attrs_within(k, attrs, aseen)


def add(blocks, seen, tag, text, en_html):
    kk = key(text)
    n = seen.get(kk, 0)
    seen[kk] = n + 1
    blocks.append({"k": kk, "n": n, "tag": tag, "en": en_html, "text": text,
                   "zh": ""})


def aadd(attrs, aseen, name, text):
    kk = key(text)
    ident = (name, kk)
    n = aseen.get(ident, 0)
    aseen[ident] = n + 1
    attrs.append({"k": kk, "n": n, "attr": name, "en": text, "zh": ""})


def head_bits(src: str, blocks: list, seen: dict):
    """<title> and the meta description: swapped by their own rules."""
    m = re.search(r"<title>(.*?)</title>", src, re.S)
    if m:
        t = norm(html.unescape(m.group(1)))
        if t:
            add(blocks, seen, "#title", t, esc(t))
    m = re.search(r'<meta\s+name="description"\s+content="(.*?)"', src, re.S)
    if m:
        t = norm(html.unescape(m.group(1)))
        if t:
            add(blocks, seen, "#description", t, esc(t))


def extract(path: Path) -> dict:
    src = path.read_text(encoding="utf-8")
    p = Tree()
    p.feed(src)
    p.close()
    blocks, attrs, seen, aseen = [], [], {}, {}
    head_bits(src, blocks, seen)
    collect(p.root, blocks, attrs, seen, aseen)
    return {"page": path.stem, "blocks": blocks, "attrs": attrs}


def merge(fresh: dict, old_path: Path) -> tuple[dict, int, int]:
    """Carry over every zh string whose English is unchanged."""
    if not old_path.exists():
        return fresh, 0, len(fresh["blocks"]) + len(fresh["attrs"])
    old = json.loads(old_path.read_text(encoding="utf-8"))
    kept = new = 0
    have = {(b["k"], b["n"]): b.get("zh", "") for b in old.get("blocks", [])}
    # a string that moved but did not change still matches on k alone
    loose = {}
    for b in old.get("blocks", []):
        loose.setdefault(b["k"], b.get("zh", ""))
    for b in fresh["blocks"]:
        zh = have.get((b["k"], b["n"])) or loose.get(b["k"]) or ""
        b["zh"] = zh
        kept += 1 if zh else 0
        new += 0 if zh else 1
    ahave = {}
    for a in old.get("attrs", []):
        ahave.setdefault((a["attr"], a["k"]), a.get("zh", ""))
    for a in fresh["attrs"]:
        zh = ahave.get((a["attr"], a["k"]), "")
        a["zh"] = zh
        kept += 1 if zh else 0
        new += 0 if zh else 1
    return fresh, kept, new


def main(argv):
    OUT.mkdir(parents=True, exist_ok=True)
    names = argv or sorted(p.stem for p in PAGES.glob("*.html"))
    tw = tb = ta = 0
    for name in names:
        src = PAGES / (name + ".html")
        if not src.exists():
            print("no such page:", name)
            continue
        data = extract(src)
        out = OUT / (name + ".json")
        data, kept, new = merge(data, out)
        out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n",
                       encoding="utf-8")
        words = sum(len(re.findall(r"[A-Za-z][\w'’-]*", b["text"]))
                    for b in data["blocks"])
        words += sum(len(re.findall(r"[A-Za-z][\w'’-]*", a["en"]))
                     for a in data["attrs"])
        tw += words
        tb += len(data["blocks"])
        ta += len(data["attrs"])
        print(f"{name:46s} {len(data['blocks']):5d} blocks "
              f"{len(data['attrs']):4d} attrs {words:6d} words "
              f"kept {kept:5d} new {new:5d}")
    print(f"\n{'TOTAL':46s} {tb:5d} blocks {ta:4d} attrs {tw:6d} words")


if __name__ == "__main__":
    main(sys.argv[1:])
