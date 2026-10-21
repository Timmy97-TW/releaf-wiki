#!/usr/bin/env python3
"""Right-align the numeric columns of every table on a page.

The students' 21 October formatting note asks for numbers right-aligned and
text categories left-aligned. Doing that by hand across fifty-odd tables is
how typos get in, so it is done here instead: for each <table class="data">
this walks the body column by column and, where every non-empty cell in a
column is a number, puts class="n" on that column's header cell and on each of
its body cells. measurement.css gives .n text-align:right and tabular figures.

A column that mixes a number with a word is left alone. A table that uses
colspan or rowspan is skipped whole, because its columns do not line up by
position and guessing would misalign a cell. Nothing but class attributes is
ever written, so the text, the numbers and the markup are untouched.

Usage: python3 build/tag_numeric.py measurement/index.html [...]
Idempotent: running it twice changes nothing the second time.
"""
import re, sys
from html.parser import HTMLParser

NUMERIC = re.compile(r'^[−-]?\d[\d,]*(?:\.\d+)?$')
BLANK = ('', ' ', '-', '–', '—', '−')


class Tables(HTMLParser):
    """Collect, per table, the grid of cells with each cell's tag offsets."""

    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.lines = [0]
        for ln in src.splitlines(keepends=True):
            self.lines.append(self.lines[-1] + len(ln))
        self.tables = []
        self.t = None
        self.row = None
        self.cell = None
        self.in_head = False

    def off(self):
        ln, col = self.getpos()
        return self.lines[ln - 1] + col

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'table':
            self.t = {'rows': [], 'bad': 'data' not in (d.get('class') or '').split()}
            self.depth = 0
        elif self.t is None:
            return
        elif tag == 'thead':
            self.in_head = True
        elif tag == 'tr':
            self.row = []
        elif tag in ('th', 'td'):
            try:
                cs = int(d.get('colspan', 1))
                rs = int(d.get('rowspan', 1))
            except ValueError:
                cs = rs = 1
                self.t['bad'] = True
            self.cell = {'colspan': cs, 'rowspan': rs,
                         'start': self.off(), 'end': None, 'text': [],
                         'cls': d.get('class'), 'head': self.in_head,
                         'tag': tag}
            # offset just past the tag name, where a class= can be inserted
            self.cell['insert'] = self.off() + 1 + len(tag)

    def handle_endtag(self, tag):
        if self.t is None:
            return
        if tag == 'table':
            self.tables.append(self.t)
            self.t = None
        elif tag == 'thead':
            self.in_head = False
        elif tag in ('th', 'td') and self.cell is not None:
            self.cell['text'] = ' '.join(''.join(self.cell['text']).split())
            if self.row is not None:
                self.row.append(self.cell)
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.t['rows'].append(self.row)
            self.row = None

    def handle_data(self, d):
        if self.cell is not None:
            self.cell['text'].append(d)


def tag(src):
    p = Tables(src)
    p.feed(src)
    edits = []
    stats = {'tables': 0, 'skipped': 0, 'cols': 0, 'cells': 0}
    for t in p.tables:
        rows = t['rows']
        if t['bad'] or len(rows) < 2:
            stats['skipped'] += 1
            continue
        stats['tables'] += 1
        head = [r for r in rows if r and r[0]['head']]
        body = [r for r in rows if r and not r[0]['head']]
        if not head or not body:
            stats['skipped'] += 1
            stats['tables'] -= 1
            continue
        def grid(rows):
            """Lay rows onto a column grid, honouring rowspan and colspan.
            A spanning cell occupies every column it covers, so a column index
            means the same thing in every row. Returns a list of row dicts
            {col: cell}; a cell that spans columns is recorded once, under
            each column it covers, and skipped when a column is scanned."""
            g, pending = [], {}
            for r in rows:
                row, c, it = {}, 0, iter(r)
                while True:
                    while c in pending:
                        cell, left = pending[c]
                        row[c] = (cell, True)       # carried down, not its own
                        if left - 1 <= 0:
                            del pending[c]
                        else:
                            pending[c] = (cell, left - 1)
                        c += 1
                    cell = next(it, None)
                    if cell is None:
                        break
                    for k in range(cell['colspan']):
                        row[c + k] = (cell, cell['colspan'] > 1)
                        if cell['rowspan'] > 1:
                            pending[c + k] = (cell, cell['rowspan'] - 1)
                    c += cell['colspan']
                g.append(row)
            return g
        hgrid, bgrid = grid(head), grid(body)
        hdr = hgrid[-1]
        width = max([max(r) + 1 for r in (hgrid + bgrid) if r] or [0])
        if any(len(r) != width for r in bgrid):
            stats['skipped'] += 1
            stats['tables'] -= 1
            continue
        for c in range(1, width):          # column 0 is the row label
            got = [r.get(c) for r in bgrid]
            if any(g is None or g[1] for g in got):
                continue                    # column is spanned, not its own
            cells = [g[0] for g in got]
            vals = [x for x in cells if x['text'] not in BLANK]
            if len(vals) < 2 or not all(NUMERIC.match(v['text']) for v in vals):
                continue
            stats['cols'] += 1
            hc = hdr.get(c)
            for x in ([hc[0]] if hc and not hc[1] else []) + cells:
                cls = (x['cls'] or '').split()
                if 'n' in cls:
                    continue
                stats['cells'] += 1
                if x['cls'] is None:
                    edits.append((x['insert'], ' class="n"'))
                else:
                    # append to the existing class list
                    m = re.compile(r'class="([^"]*)"').search(src, x['start'])
                    edits.append((m.start(1), '' if not m.group(1) else ''))
                    edits.append((m.end(1), ' n'))
    out = src
    for pos, text in sorted(edits, key=lambda e: -e[0]):
        if text:
            out = out[:pos] + text + out[pos:]
    return out, stats


if __name__ == '__main__':
    for path in sys.argv[1:]:
        src = open(path, encoding='utf-8').read()
        out, st = tag(src)
        if out != src:
            open(path, 'w', encoding='utf-8').write(out)
        print(f"{path}: {st['tables']} tables scanned, {st['skipped']} skipped, "
              f"{st['cols']} numeric columns, {st['cells']} cells tagged")
