"""Give every frozen page a .html name, for GitHub Pages.

Frozen-Flask writes /description as a file called `description`, with no
extension. GitLab Pages serves that as HTML; GitHub Pages serves a file it
cannot name a type for as a download, so the wiki arrives as source text.

Renaming it to description.html fixes it without touching one link: asked for
/description, GitHub Pages looks for description.html too. The links in the
pages, in the nav's data file and in the translations all stay as they are.
"""
import pathlib
import sys

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public")

done = 0
for p in sorted(OUT.iterdir()):
    if not p.is_file() or p.suffix:
        continue
    head = p.open("rb").read(400).lstrip().lower()
    if not (head.startswith(b"<!doctype html") or head.startswith(b"<html")):
        continue
    p.rename(p.with_suffix(".html"))
    done += 1

# and keep Jekyll's hands off the build
(OUT / ".nojekyll").write_text("")
print(f"{done} pages named .html, .nojekyll written")
