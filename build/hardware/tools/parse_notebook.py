#!/usr/bin/env python3
"""Parse the RELEAF hardware notebook deck into structured JSON.

The deck has no semantic shape names, but its layout is strict: an 8.5x11
portrait page with a fixed header band, a body whose x-indent encodes bullet
depth, labelled DECISION / PROBLEMS / NEXT WEEK blocks, and a footer.

Two things the layout does that a naive reader gets wrong:

* A block label and its first line sit on the same visual row but can differ by
  a hundredth of an inch in y, and the content is sometimes the higher of the
  two. Sorting on raw y therefore reads the content before the label that gives
  it meaning. Fixed-width buckets do not help either -- two runs 0.01in apart
  can still straddle a boundary -- so runs are clustered into rows by proximity
  and ordered by x within a row.
* A photo caption (x 0.49) and the left column of the PROBLEMS table (x 0.50)
  are indistinguishable by position. Which one a run is depends on whether the
  PROBLEMS label has been passed, so classification tracks the current section
  rather than looking at geometry alone.

An entry starts on a slide carrying the "ON THE BENCH" kicker and continues
onto any following slides that do not.
"""
import json, re, glob, sys
from xml.etree import ElementTree as ET

P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
EMU = 914400.0
ROW_TOL = 0.06                               # inches; runs this close share a row

COUNTER = {"REJECTED", "NOT ACTED ON", "CONFIDENCE"}


def runs(path):
    """Ordered text runs with geometry, rows bucketed so labels lead content."""
    root = ET.parse(path).getroot()
    out = []
    for sp in root.iter(P + 'sp'):
        off, ext = sp.find(f'.//{A}off'), sp.find(f'.//{A}ext')
        if off is None or ext is None:
            continue
        x, y = int(off.get('x')) / EMU, int(off.get('y')) / EMU
        w = int(ext.get('cx')) / EMU
        for p in sp.iter(A + 'p'):
            t = ''.join(n.text or '' for n in p.iter(A + 't')).strip()
            if t:
                out.append({'x': x, 'y': y, 'w': w, 'text': t})
    out.sort(key=lambda r: r['y'])
    rows, cur = [], []
    for r in out:                                # cluster into visual rows
        if cur and r['y'] - cur[0]['y'] > ROW_TOL:
            rows.append(cur); cur = []
        cur.append(r)
    if cur: rows.append(cur)
    flat = []
    for row in rows:
        row.sort(key=lambda r: r['x'])
        for i, r in enumerate(row):
            r['row'] = len(flat) if i == 0 else flat[-1]['row']
            flat.append(r)
    return flat


def parse_slide(path):
    hdr, items, foot = {}, [], {}
    section = 'body'
    for r in runs(path):
        x, y, txt = r['x'], r['y'], r['text']
        up = txt.upper().rstrip(':')

        if y < 1.05:                                        # header band
            if x > 6.5 and y < 0.45:   hdr['kicker'] = txt
            elif x > 6.5:
                # the name box can be one paragraph of "A · B · C" or several
                # lines of "A   B"; both have to accumulate, not overwrite
                part = re.sub(r'\s*·\s*|\s{2,}', ', ', txt).strip(', ')
                hdr['names'] = (hdr.get('names', '') + ', ' + part).strip(', ') if hdr.get('names') else part
            elif x < 0.5 and y < 0.62: hdr['mark'] = txt
            elif x < 0.5:              hdr['tag'] = txt
            elif y < 0.6:              hdr['week'] = txt
            else:                      hdr['dates'] = txt
            continue
        if y > 10.4:                                        # footer band
            if x < 3:   foot['instrument'] = txt
            elif x < 7:  foot['date'] = txt
            else:        foot['page'] = txt
            continue
        if 1.2 < y < 1.45 and x < 0.5:  hdr['subtitle'] = txt; continue
        if 1.45 < y < 1.9 and x < 0.5:  hdr['title'] = txt;    continue
        if 1.9 <= y < 2.9 and x < 0.5 and r['w'] > 7:
            hdr['context'] = (hdr.get('context', '') + ' ' + txt).strip(); continue

        if up == 'DECISION':      section = 'decision'; continue
        if up in COUNTER:         section = 'counter'; hdr['counter_label'] = up.title(); continue
        if up.startswith('PROBLEMS'):  section = 'problems'; continue
        if up.startswith("HOW WE"):    continue
        if up == 'NEXT WEEK':     section = 'next'; continue
        if up == 'SINCE THIS WEEK':    continue

        if section == 'body':
            if 0.45 <= x < 0.55 or 4.3 <= x < 4.6:
                items.append(('photo', txt, r['row']))
            elif 0.55 <= x < 0.72:
                items.append(('bullet', txt, r['row']))
            elif 0.72 <= x < 1.0:
                items.append(('sub', txt, r['row']))
            else:
                items.append(('note', txt, r['row']))
        elif section == 'problems':
            # two columns: what is broken on the left, the fix on the right.
            # Carry the row id so the two halves can be paired by row rather
            # than by arrival order -- a row can be missing either side.
            items.append((('problem_fix' if x >= 3.8 else 'problem'),
                          txt.lstrip('→ ').strip(), r['row']))
        else:
            items.append((section, txt, r['row']))
    return hdr, items, foot


def collect(files):
    entries = []
    for f in files:
        hdr, items, foot = parse_slide(f)
        if hdr.get('kicker') == 'ON THE BENCH' or not entries:
            entries.append({'slides': [], 'hdr': {}, 'items': [], 'foot': {}})
        e = entries[-1]
        e['slides'].append(int(re.search(r'slide(\d+)\.xml', f).group(1)))
        e['items'] += items
        e['foot'].update({k: v for k, v in foot.items() if v})
        for k, v in hdr.items():
            e['hdr'].setdefault(k, v)
    return entries


def shape(e):
    out = {'body': [], 'photos': [], 'decision': [], 'counter': [],
           'problems': [], 'next': ''}
    rowmap = {}
    for it in e['items']:
        kind, v = it[0], it[1]
        if kind in ('problem', 'problem_fix'):
            slot = rowmap.setdefault(it[2], {'what': '', 'fix': ''})
            slot['fix' if kind == 'problem_fix' else 'what'] = v
            continue
        if kind in ('bullet', 'sub', 'note'):
            out['body'].append({'t': kind, 'v': v})
        elif kind == 'photo':    out['photos'].append(v)
        elif kind == 'decision': out['decision'].append(v)
        elif kind == 'counter':  out['counter'].append(v)
        elif kind == 'next':     out['next'] = (out['next'] + ' ' + v).strip()
    out['problems'] = [rowmap[k] for k in sorted(rowmap)]
    return out


if __name__ == '__main__':
    d = sys.argv[1]
    files = sorted(glob.glob(d + '/ppt/slides/slide*.xml'),
                   key=lambda p: int(re.search(r'slide(\d+)\.xml', p).group(1)))
    files = [f for f in files if int(re.search(r'slide(\d+)\.xml', f).group(1)) > 2]
    entries = []
    for e in collect(files):
        h = e['hdr']
        entries.append({
            'week': h.get('week', ''), 'weekno': int(re.sub(r'\D', '', h.get('week', '0')) or 0),
            'dates': h.get('dates', ''), 'mark': h.get('mark', ''),
            'tag': h.get('tag', ''), 'names': h.get('names', ''),
            'subtitle': h.get('subtitle', ''), 'title': h.get('title', ''),
            'context': h.get('context', ''),
            'counter_label': h.get('counter_label', ''),
            'instrument': e['foot'].get('instrument', ''),
            'date': e['foot'].get('date', ''), 'page': e['foot'].get('page', ''),
            'slides': e['slides'], **shape(e),
        })
    json.dump(entries, open('/tmp/_nb/notebook.json', 'w'), indent=1, ensure_ascii=False)
    print(f"{len(entries)} entries")
    miss = [e['title'] for e in entries if not e['next']]
    print("entries with no NEXT WEEK:", len(miss))
    print("entries with no decision :", sum(1 for e in entries if not e['decision']))
    print("problem rows missing a fix:",
          sum(1 for e in entries for p in e['problems'] if not p['fix']))
