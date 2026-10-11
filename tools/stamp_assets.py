#!/usr/bin/env python3
"""Refresh the ?v= cache-busting stamps on local assets.

Every <link>/<script>/<img> reference to a file inside the repo may carry a
`?v=` query. The stamp is the first eight hex characters of the file's SHA-256,
so changing a stylesheet changes its URL and a returning reader is never served
yesterday's CSS against today's markup.

hardware/README.md has referenced this script for a long time, but the file was
never committed, so the stamps silently went stale whenever anyone edited CSS or
JS. Rewritten and committed 12 Oct 2026. Run it from the repository root after
changing any stamped asset:

    python3 tools/stamp_assets.py                 # the hardware section
    python3 tools/stamp_assets.py --check         # report only, exit 1 if stale
    python3 tools/stamp_assets.py some/other/dir  # somewhere else, deliberately

It defaults to `hardware/` on purpose. **Only the hardware section uses content
hashes.** The rest of the wiki stamps by hand with a release date, like
`?v=202610091` or `?v=1009a`, and running this over those pages would silently
convert a convention their authors maintain by hand. Point it at another
directory only if you mean to do that.

Only references that already carry a `?v=` are touched: adding stamps to URLs
that never had one is a separate decision, not a side effect of running this.
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "_archive", "dist"}
REF = re.compile(r'((?:href|src)=")([^"?#]+)\?v=([0-9a-f]{4,40})(")')

_cache = {}
def stamp(path):
    if path not in _cache:
        with open(path, "rb") as fh:
            _cache[path] = hashlib.sha256(fh.read()).hexdigest()[:8]
    return _cache[path]

def html_files(scope):
    for base, dirs, files in os.walk(scope):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for f in files:
            if f.endswith((".html", ".htm")):
                yield os.path.join(base, f)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    check = "--check" in sys.argv
    scope = os.path.join(ROOT, args[0]) if args else os.path.join(ROOT, "hardware")
    if not os.path.isdir(scope):
        print(f"no such directory: {scope}")
        return 2
    print(f"scope: {os.path.relpath(scope, ROOT)}\n")
    changed = missing = 0
    for page in sorted(html_files(scope)):
        src = open(page, encoding="utf-8").read()
        here = os.path.dirname(page)
        hits = []

        def sub(m):
            nonlocal missing
            pre, url, old, post = m.groups()
            target = os.path.normpath(os.path.join(here, url))
            if not os.path.isfile(target):
                missing += 1
                hits.append(("missing", url, old, ""))
                return m.group(0)
            new = stamp(target)
            if new != old:
                hits.append(("stale", url, old, new))
            return f"{pre}{url}?v={new}{post}"

        out = REF.sub(sub, src)
        stale = [h for h in hits if h[0] == "stale"]
        rel = os.path.relpath(page, ROOT)
        for kind, url, old, new in hits:
            if kind == "missing":
                print(f"  ! {rel}: {url} has a stamp but no file")
        if stale:
            changed += len(stale)
            print(f"{rel}: {len(stale)} stamp(s) refreshed")
            for _, url, old, new in stale:
                print(f"    {url}  {old} -> {new}")
            if not check:
                open(page, "w", encoding="utf-8").write(out)

    print(f"\n{changed} stamp(s) {'stale' if check else 'refreshed'}"
          + (f", {missing} reference(s) point at no file" if missing else ""))
    return 1 if (check and changed) else 0

if __name__ == "__main__":
    sys.exit(main())
