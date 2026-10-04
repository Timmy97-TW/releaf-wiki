"""Wet Lab Notebook: the entry index, read out of the monthly PDFs.

    python3 build/wetlab_notebook.py            # rewrite notebook/index.html
    python3 build/wetlab_notebook.py --json     # print the index as JSON

Needs PyMuPDF (pip install pymupdf). Run it from the repository root after a
new month's PDF goes into notebook/pdf/ and its tab is copied in index.html.

Every entry in the team's notebooks opens on a "Date:" line followed by a
"Title:" (sometimes "Topic:") line. For each one this records the date, the
title exactly as typed, the page it starts on and the "Done by" names, and
writes them as table rows between the markers

    <!-- entries:<month>:start -->  ...  <!-- entries:<month>:end -->

in notebook/index.html. Titles and names are the team's own and are not
corrected; the only thing the script adds is a track tag, sorted from the
title by the keyword rules in TRACKS below, which the page marks as ours.
"""
import html
import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "notebook" / "index.html"
MONTHS = [("04", "april"), ("05", "may"), ("06", "june"), ("07", "july"), ("08", "august")]
MONTH_NAMES = {4: "April", 5: "May", 6: "June", 7: "July", 8: "August", 9: "September", 10: "October"}

# The team wrote dates four ways: 20260722, 2026/5/12, 2026.06.07 and 07/04.
DATE = re.compile(r"^Date\s*[:：]\s*(\d{8}|\d{4}[./]\d{1,2}[./]\d{1,2}|\d{1,2}/\d{1,2})\b")
TITLE = re.compile(r"^(title|topic)\s*[:：]\s*(.*)", re.I)

# First match wins, so the order matters: "acrylamide gel" is protein work
# before it is a gel, "agar in the hydroponic system" is hydroponics before
# it is plants, and an agarose gel is cloning before it is a preparation.
TRACKS = [
    ("protein", r"sds|western|coomassie|dialysis|protein|acrylamide|tb medium|supernatant"),
    ("reactor", r"bioreactor|bioreater|growth curve|growth rate|hay infusion"),
    ("hydro",   r"hydropon|box\b|box \d|boxes|box b"),
    ("plant",   r"arabidopsis|seed|vernali|salinity|chlorophyll|fresh weight|plant|soil|½ ?ms|1/2 ?ms|ms medium|ms agar|nacl|trehalose|protectant|正"),
    ("clone",   r"agarose|agarese|\bgel\b|electrophor|electrophro"),
    ("setup",   r"\blb\b|lba|lbe|lbc|medium|agar|soc\b|sanitiz|cleaning up|antibiotic|erythromycin|plate"),
    ("clone",   r"."),
]


def norm_date(raw, month):
    raw = raw.strip()
    if re.fullmatch(r"\d{8}", raw):
        m, d = int(raw[4:6]), int(raw[6:8])
    elif re.fullmatch(r"\d{1,2}/\d{1,2}", raw):
        m, d = (int(x) for x in raw.split("/"))
    else:
        _, m, d = (int(x) for x in re.split(r"[./]", raw))
    if m != month:          # 20200607 and its like: trust the file's month
        m = month
    return m, d


def track(title):
    t = title.lower()
    for key, rx in TRACKS:
        if re.search(rx, t):
            return key
    return "clone"


def read_month(mm, name):
    doc = pymupdf.open(ROOT / "notebook" / "pdf" / f"wetlab-notebook-2026-{mm}-{name}.pdf")
    lines = []
    for pno, page in enumerate(doc, 1):
        for line in page.get_text().splitlines():
            if line.strip():
                lines.append((pno, line.strip()))
    starts = [i for i, (_, t) in enumerate(lines) if DATE.match(t)]
    out = []
    for k, i in enumerate(starts):
        end = starts[k + 1] if k + 1 < len(starts) else len(lines)
        block = [t for _, t in lines[i:end]]
        m, d = norm_date(DATE.match(block[0]).group(1), int(mm))
        title = ""
        for j, t in enumerate(block[1:6], 1):
            mt = TITLE.match(t)
            if not mt:
                continue
            title = mt.group(2).strip()
            nxt = block[j + 1] if j + 1 < len(block) else ""
            if not title:
                title = nxt
            elif len(title) > 50 and nxt and not re.match(r"^(purpose|procedure|aim)", nxt, re.I):
                title += " " + nxt
            title = re.split(r"\s*Purpose\s*[:：]", title, flags=re.I)[0].strip()
            break
        full = "\n".join(block)
        done = re.search(r"Done\s+by\s*[:：]?\s*([^\n]*)", full, re.I)
        who = done.group(1) if done else ""
        who = re.split(r"[.,;]?\s*(recorded|record|ELN|documented|supervised)\b", who, flags=re.I)[0]
        who = who.strip(" .,:\\​")
        title = title.replace("​", "").strip()
        out.append({"m": m, "d": d, "title": title, "page": lines[i][0],
                    "who": who, "track": track(title)})
    return {"name": name, "file": f"pdf/wetlab-notebook-2026-{mm}-{name}.pdf",
            "pages": doc.page_count, "entries": out}


def rows(month):
    esc = html.escape
    lines = []
    for e in month["entries"]:
        title = esc(e["title"]) or "<i>untitled</i>"
        who = f'<small>{esc(e["who"])}</small>' if e["who"] else ""
        lines.append(
            f'                  <tr data-track="{e["track"]}">'
            f'<td class="ix__d"><time datetime="2026-{e["m"]:02d}-{e["d"]:02d}">{e["d"]} {MONTH_NAMES[e["m"]][:3]}</time></td>'
            f'<td class="ix__t"><svg class="tk" aria-hidden="true"><use href="#ico-{e["track"]}"/></svg><span>{title}</span>{who}</td>'
            f'<td class="ix__p"><a href="{month["file"]}#page={e["page"]}" target="_blank" rel="noopener">p.&nbsp;{e["page"]}</a></td>'
            f"</tr>")
    return "\n".join(lines)


def main():
    data = [read_month(mm, name) for mm, name in MONTHS]
    if "--json" in sys.argv:
        print(json.dumps(data, ensure_ascii=False, indent=1))
        return
    page = PAGE.read_text(encoding="utf-8")
    total = 0
    for month in data:
        n = month["name"]
        pat = re.compile(rf"(<!-- entries:{n}:start -->).*?([ \t]*<!-- entries:{n}:end -->)", re.S)
        if not pat.search(page):
            sys.exit(f"no entries:{n} markers in {PAGE}")
        page = pat.sub(lambda m: m.group(1) + "\n" + rows(month) + "\n" + m.group(2), page)
        page = re.sub(rf'(data-count="{n}">)\d+', rf"\g<1>{len(month['entries'])}", page)
        total += len(month["entries"])
        print(f"{n:>7}: {month['pages']:>3} pages, {len(month['entries']):>3} entries")
    page = re.sub(r"Search \d+ entries", f"Search {total} entries", page)
    PAGE.write_text(page, encoding="utf-8")


if __name__ == "__main__":
    main()
