#!/usr/bin/env python3
"""Freeze-readiness audit for the ReLeaf wiki.

Reads every HTML and CSS file in the repository and reports what would break,
or be blocked, once the wiki moves to 2026.igem.wiki. It changes nothing.

    python3 build/audit.py              # the summary, then every finding
    python3 build/audit.py --md out.md  # the same, written as Markdown

Checks, in the order they cost the most:

  external   a resource (script, stylesheet, image, font, iframe, media, CSS
             url()) that loads from a host outside iGEM. iGEM blocks these, so
             the thing renders blank. Plain <a href> links to other sites are fine
             and are not reported.
  missing    a local href/src that points at a file that does not exist
  case       a local path that exists only because macOS ignores case. GitLab
             Pages does not, so it 404s after the move
  nav        a slug in site-nav.js with no page, or a standard iGEM address
             missing from the repository or from the navigation
  anchor     a link to #id where no element carries that id
  dupid      the same id on two elements in one page
  cite       [n] in the prose with no nth reference behind it
  alt        an <img> with no alt attribute at all (alt="" is fine: decorative)
  leftover   scaffold notes, status boxes, pending chips, figure placeholders
  size       any single file over 5 MB

Only the Python standard library is used.
"""

import argparse
import html
import os
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules", "__pycache__", "build", ".claude"}
IGEM_HOSTS = ("igem.wiki", "igem.org")
BIG = 5 * 1024 * 1024
# the addresses iGEM judges medals and special awards from (notes/structure.md)
STANDARD = ("attributions", "contribution", "description", "education", "engineering",
            "entrepreneurship", "hardware", "human-practices", "inclusivity",
            "measurement", "model", "parts", "plant", "results", "safety-and-security",
            "software", "sustainability", "team")

# attributes that make the browser fetch something, per tag
FETCH = {
    "script": ("src",),
    "img": ("src", "srcset"),
    "source": ("src", "srcset"),
    "video": ("src", "poster"),
    "audio": ("src",),
    "iframe": ("src",),
    "embed": ("src",),
    "object": ("data",),
    "track": ("src",),
    "input": ("src",),
}
CSS_URL = re.compile(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""")
CSS_IMPORT = re.compile(r"""@import\s+(?:url\()?\s*['"]([^'"]+)['"]""")
CITE = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []          # (kind, url, line)  kind: fetch | link
        self.ids = []           # (id, line)
        self.imgs_no_alt = []   # (src, line)
        self.styles = []        # (css text, line)
        self.in_style = False
        self.skip = 0           # depth inside script/style/code/pre/a/.refs/.toc
        self.stack = []
        self.in_refs_ol = 0
        self.ref_items = 0
        self.text_cites = []    # (numbers, line)
        self.classes = Counter()
        self.probe_depth = 0    # inside an element carrying data-art (home.js)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        cls = (a.get("class") or "").split()
        for c in cls:
            self.classes[c] += 1
        if a.get("id"):
            self.ids.append((a["id"], line))
        probe = "data-art" in a
        for k in FETCH.get(tag, ()):
            if a.get(k):
                vals = [a[k]]
                if k == "srcset":
                    vals = [p.strip().split()[0] for p in a[k].split(",") if p.strip()]
                for v in vals:
                    self.refs.append(("probe" if self.probe_depth else "fetch", v, line))
        if tag == "link" and a.get("href"):
            rel = (a.get("rel") or "").lower()
            kind = "link" if rel in ("canonical", "alternate", "author", "license") else "fetch"
            self.refs.append((kind, a["href"], line))
        if tag == "a" and a.get("href"):
            self.refs.append(("link", a["href"], line))
        if tag == "img" and "alt" not in a:
            self.imgs_no_alt.append((a.get("src", "?"), line))
        if a.get("style"):
            self.styles.append((a["style"], line))
        if tag == "style":
            self.in_style = True
        # citation scanning follows page.js: skip .refs, a, code, pre, .toc
        skipping = tag in ("script", "style", "code", "pre", "a") or \
            {"refs", "toc"} & set(cls)
        if tag not in ("img", "br", "hr", "input", "meta", "link", "source",
                       "wbr", "area", "base", "col", "embed", "track", "param"):
            self.stack.append((tag, skipping, "refs" in cls, probe))
            if probe:
                self.probe_depth += 1
            if skipping:
                self.skip += 1
            if "refs" in cls:
                self.in_refs_ol += 1
        if tag == "li" and self.in_refs_ol and any(e[0] == "ol" for e in self.stack):
            self.ref_items += 1

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False
        # pop to the matching tag, tolerating sloppy nesting
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for t, sk, rf, pr in self.stack[i:]:
                    if sk:
                        self.skip -= 1
                    if rf:
                        self.in_refs_ol -= 1
                    if pr:
                        self.probe_depth -= 1
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.in_style:
            self.styles.append((data, self.getpos()[0]))
            return
        if self.skip == 0:
            for m in CITE.finditer(data):
                nums = [int(x) for x in m.group(1).split(",")]
                self.text_cites.append((nums, self.getpos()[0]))


def files(exts):
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS and not d.startswith(".")]
        for f in fn:
            if f.lower().endswith(exts):
                yield Path(dp) / f


def exact_case(path: Path) -> bool:
    """True if every component of path exists with exactly this spelling."""
    try:
        rel = path.relative_to(ROOT)
    except ValueError:
        return path.exists()
    cur = ROOT
    for part in rel.parts:
        if part in ("", "."):
            continue
        if part == "..":
            cur = cur.parent
            continue
        try:
            names = os.listdir(cur)
        except (NotADirectoryError, FileNotFoundError):
            return False
        if part not in names:
            return False
        cur = cur / part
    return True


def resolve(base: Path, url: str):
    """Local target for url as seen from file base, or None if not local."""
    u = urlsplit(url)
    if u.scheme or u.netloc or url.startswith(("mailto:", "tel:", "javascript:", "data:", "blob:")):
        return None, u.fragment
    if not u.path:
        return base, u.fragment
    p = unquote(u.path)
    target = (ROOT / p.lstrip("/")) if p.startswith("/") else (base.parent / p)
    target = Path(os.path.normpath(target))
    if target.is_dir() or p.endswith("/"):
        target = target / "index.html"
    return target, u.fragment


def is_external(url: str) -> bool:
    u = urlsplit(url.strip())
    if url.strip().startswith("//"):
        u = urlsplit("https:" + url.strip())
    if u.scheme not in ("http", "https") or not u.netloc:
        return False
    host = u.hostname or ""
    return not any(host == h or host.endswith("." + h) for h in IGEM_HOSTS)


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--md", help="also write the report as Markdown to this path")
    args = ap.parse_args()

    findings = defaultdict(list)   # check -> [(file, line, detail)]
    pages = {}
    ids_by_file = {}

    html_files = sorted(files((".html", ".htm")))
    for f in html_files:
        text = f.read_text(encoding="utf-8", errors="replace")
        p = Page()
        try:
            p.feed(text)
        except Exception as e:  # noqa: BLE001 - report and keep going
            findings["parse"].append((rel(f), 0, str(e)))
            continue
        pages[f] = p
        ids_by_file[f] = {i for i, _ in p.ids}

    # CSS files and inline styles
    css_refs = []  # (file, line, url)
    DATA_URI = re.compile(r"""url\(\s*(['"]?)data:.*?\1\s*\)""")
    for f in sorted(files((".css",))):
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            line = DATA_URI.sub("", line)
            for m in CSS_URL.finditer(line):
                css_refs.append((f, n, m.group(2)))
            for m in CSS_IMPORT.finditer(line):
                css_refs.append((f, n, m.group(1)))
    for f, p in pages.items():
        for css, line in p.styles:
            css = DATA_URI.sub("", css)
            for m in CSS_URL.finditer(css):
                css_refs.append((f, line, m.group(2)))
            for m in CSS_IMPORT.finditer(css):
                css_refs.append((f, line, m.group(1)))

    # JavaScript that fetches from outside: fetch(), import, tile/API templates
    js_ext = re.compile(r"""['"`](https?:)?//([a-z0-9.-]+\.[a-z]{2,})[^'"`]*['"`]""", re.I)
    for f in sorted(files((".js",))):
        if "vendor" in f.parts:
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            for m in js_ext.finditer(line):
                url = m.group(0)[1:-1]
                if url.startswith("//"):
                    url = "https:" + url
                if is_external(url) and "w3.org" not in url:
                    findings["external-js"].append((rel(f), n, url))
    for f, p in pages.items():
        text = f.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", text, re.S | re.I):
            start = text.count("\n", 0, m.start(1)) + 1
            body = m.group(1)
            if len(body) > 2_000_000:
                continue
            for mm in js_ext.finditer(body):
                url = mm.group(0)[1:-1]
                if url.startswith("//"):
                    url = "https:" + url
                if is_external(url) and "w3.org" not in url:
                    findings["external-js"].append(
                        (rel(f), start + body.count("\n", 0, mm.start()), url))

    def check_local(src_file, line, url, kind):
        url = html.unescape(url.strip())
        if not url or url.startswith("#") and kind in ("fetch", "probe"):
            return
        if "${" in url or "{{" in url:
            return
        if is_external(url):
            if kind in ("fetch", "probe"):
                findings["external"].append((rel(src_file), line, url))
            return
        target, frag = resolve(src_file, url)
        if target is None:
            return
        if not target.exists():
            findings["art-pending" if kind == "probe" else "missing"].append((rel(src_file), line, url))
            return
        if not exact_case(target):
            findings["case"].append((rel(src_file), line, url))
        if frag and kind == "link" and target.suffix in (".html", ".htm"):
            ids = ids_by_file.get(target)
            if ids is not None and frag not in ids and frag != "top":
                findings["anchor"].append((rel(src_file), line, url))

    for f, p in pages.items():
        for kind, url, line in p.refs:
            check_local(f, line, url, kind)
        dup = Counter(i for i, _ in p.ids)
        for i, c in dup.items():
            if c > 1:
                line = next(l for x, l in p.ids if x == i)
                findings["dupid"].append((rel(f), line, f'id="{i}" x{c}'))
        for src, line in p.imgs_no_alt:
            findings["alt"].append((rel(f), line, src[:80]))
        if p.ref_items:
            for nums, line in p.text_cites:
                bad = [n for n in nums if n < 1 or n > p.ref_items]
                if bad:
                    findings["cite"].append(
                        (rel(f), line, f"[{','.join(map(str, bad))}] but only {p.ref_items} references"))

    for f, line, url in css_refs:
        if url.startswith("data:"):
            continue
        if is_external(url):
            findings["external"].append((rel(f), line, url))
            continue
        target, _ = resolve(f, url)
        if target is None:
            continue
        if not target.exists():
            findings["missing"].append((rel(f), line, url))
        elif not exact_case(target):
            findings["case"].append((rel(f), line, url))

    # leftovers the team has to clear before the freeze
    leftover_pats = {
        "scaffold note": r'class="[^"]*\bscaffold\b',
        "status box": r'class="status"',
        "pending chip": r'class="[^"]*\bpending\b',
        "figure placeholder": r'class="[^"]*\bfig--pending\b',
        "empty photo frame": r'class="[^"]*\bframe\b[^"]*\bempty\b',
        "open item": r'class="[^"]*\bopenitem\b',
        "TODO/TBD/XXX": r"\b(TODO|TBD|FIXME|XXX)\b",
        "lorem ipsum": r"(?i)lorem ipsum",
    }
    leftovers = defaultdict(Counter)
    for f in html_files:
        text = f.read_text(encoding="utf-8", errors="replace")
        if len(text) > 3_000_000:
            text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.S)
        for name, pat in leftover_pats.items():
            c = len(re.findall(pat, text))
            if c:
                leftovers[rel(f)][name] = c

    nav_js = (ROOT / "assets/data/site-nav.js").read_text(encoding="utf-8")
    nav_slugs = set(re.findall(r'slug:\s*"([^"]+)"', nav_js))
    for slug in sorted(nav_slugs):
        if not (ROOT / slug / "index.html").exists():
            findings["nav"].append(("assets/data/site-nav.js", 0, f"slug '{slug}' has no {slug}/index.html"))
    for slug in STANDARD:
        if not (ROOT / slug / "index.html").exists():
            findings["nav"].append((slug, 0, "standard iGEM address has no index.html"))
        elif slug not in nav_slugs and slug != "inclusivity":
            findings["nav"].append(("assets/data/site-nav.js", 0, f"standard page '{slug}' is not in the navigation"))

    sizes = []
    total = 0
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in (".git",)]
        for x in fn:
            fp = Path(dp) / x
            s = fp.stat().st_size
            total += s
            if s > BIG:
                sizes.append((s, rel(fp)))
            if re.search(r"[^\w.\-]", x):
                findings["filename"].append((rel(fp), 0, "space or non-ASCII in file name"))
    sizes.sort(reverse=True)

    # ---- report ---------------------------------------------------------------
    out = []
    order = ["external", "external-js", "missing", "case", "nav", "anchor", "cite",
             "dupid", "alt", "filename", "parse", "art-pending"]
    blurb = {
        "external": "resources loaded from outside iGEM (blocked on the iGEM wiki)",
        "external-js": "URLs outside iGEM inside JavaScript (check whether they are fetched)",
        "missing": "local links or resources that point at nothing",
        "case": "paths that only work on a case-insensitive disk",
        "anchor": "links to an #id that does not exist",
        "cite": "[n] citations with no reference behind them",
        "dupid": "ids used more than once in a page",
        "alt": "images with no alt attribute",
        "filename": "file names with spaces or non-ASCII characters",
        "parse": "files the parser could not read",
        "nav": "navigation slugs and standard iGEM addresses without a page",
        "art-pending": "art a [data-art] figure is waiting for (hidden until the file exists; expected)",
    }
    out.append("# ReLeaf wiki audit\n")
    out.append(f"{len(html_files)} HTML files, total repository size "
               f"{total / 1e6:.0f} MB (excluding .git).\n")
    out.append("| Check | Findings | What it means |\n|---|---:|---|")
    for k in order:
        out.append(f"| {k} | {len(findings[k])} | {blurb[k]} |")
    out.append("")
    for k in order:
        if not findings[k]:
            continue
        out.append(f"\n## {k}: {blurb[k]}\n")
        seen = set()
        for f, line, d in sorted(findings[k]):
            key = (f, line, d)
            if key in seen:
                continue
            seen.add(key)
            loc = f"{f}:{line}" if line else f
            out.append(f"- `{loc}` {d}")
    out.append("\n## Leftovers to clear before the freeze\n")
    out.append("| File | Leftovers |\n|---|---|")
    for f in sorted(leftovers):
        out.append(f"| `{f}` | " + ", ".join(f"{n} {k}" for k, n in leftovers[f].most_common()) + " |")
    out.append(f"\n## Files over {BIG // 2**20} MB\n")
    for s, f in sizes:
        out.append(f"- {s / 2**20:.1f} MB `{f}`")
    report = "\n".join(out) + "\n"

    sys.stdout.write(report)
    if args.md:
        Path(args.md).write_text(report, encoding="utf-8")
    return 1 if findings["missing"] or findings["external"] or findings["case"] or findings["nav"] else 0


if __name__ == "__main__":
    sys.exit(main())
