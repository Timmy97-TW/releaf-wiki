"""Build drylab-notebook/notebook-data.js, the data behind Felix's board.

Two sources, joined on (pipeline, week):

  * the students' 28 September notebook, as it stands in the page's own
    written record (drylab-notebook/index.html, <div class="nbmonths">):
    which pipelines ran each week, the stage each one was at, the
    deliverables, the results, who took part and the photographs;
  * Felix's board (git 797994b, the page as he delivered it on 25 August,
    carried to 29 August in e75d5da): the kind of each node, how heavy the
    week was, his one-line title and summary, the branches between lanes,
    the six wet lab handoffs and what came back from each, and which
    pipeline or handoff every photograph belongs to.

The written record is the source of truth for what ran when. Felix's board
only ever adds words and marks to a node the record already has.

Run from the repository root:  python3 build/drylab_notebook.py
Needs git and bs4.
"""
import datetime
import json
import re
import subprocess

from bs4 import BeautifulSoup

PAGE = 'drylab-notebook/index.html'
OUT = 'drylab-notebook/notebook-data.js'
FELIX = '797994b'   # the page as Felix delivered it
LATEST_BOARD = 'e75d5da'   # the same board, carried to 29 August

D0 = datetime.date(2026, 3, 28)


def week_of(iso):
    return (datetime.date.fromisoformat(iso) - D0).days // 7


# ---------------------------------------------------------------- pipelines
# Felix's thirteen lanes, in his order, with his groups and hues. The href is
# the page on this wiki where that pipeline's work is written up.
PIPES = [
    dict(id='dataphys', name='Data\nPhysicalization', short='Data Physicalization', abbr='Data phys.', g='comm', c='#db2777', href='../data-physicalization/'),
    dict(id='wiki', name='Wiki &\nNotebook', short='Wiki & Notebook', abbr='Wiki', g='comm', c='#64748b', href=''),
    dict(id='chamber', name='Plant Growth\nChamber', short='Plant Growth Chamber', abbr='Chamber', g='plant', c='#7ba81f', href=''),
    dict(id='hydro', name='Hydroponics\nSystem', short='Hydroponics System', abbr='Hydroponics', g='plant', c='#0f9d58', href='../hardware/hydroponics/'),
    dict(id='math', name='Math\nModelling', short='Math Modelling', abbr='Math model', g='model', c='#2f6fed', href='../model/'),
    dict(id='gis', name='GIS & Stress\nForecast', short='GIS & Stress Forecast', abbr='GIS', g='model', c='#0d94bf', href='../geospatial-analysis/'),
    dict(id='circuit', name='Genetic Circuit\nDesign', short='Genetic Circuit Design', abbr='Circuit', g='model', c='#5b4fd6', href=''),
    dict(id='reactor', name='Bioreactor', short='Bioreactor', abbr='Bioreactor', g='hw', c='#e06a12', href='../hardware/bioreactor/'),
    dict(id='photo', name='OD600\nPhotometer', short='OD600 Photometer', abbr='Photometer', g='hw', c='#c4432f', href='../hardware/photometer/'),
    dict(id='lpa', name='Light Plate\nApparatus', short='Light Plate Apparatus', abbr='LPA', g='hw', c='#b58900', href='../hardware/diopal/'),
    dict(id='fluor', name='Chlorophyll\nFluorometer', short='Chlorophyll Fluorometer', abbr='Fluorometer', g='hw', c='#8a6a4f', href=''),
    dict(id='protect', name='Protectant\nDesign', short='Protectant Design', abbr='Protectant', g='bio', c='#8b3fd4', href='../protein-design/'),
    dict(id='codon', name='Codon\nOptimization', short='Codon Optimization', abbr='Codon opt.', g='bio', c='#bc2fbf', href='../protein-design/'),
]

# The notebook's own pipeline names, mapped onto the lanes.
LANE_OF = {
    'Data Physicalization': 'dataphys', 'Wiki &amp; Notebook': 'wiki',
    'Plant Growth Chamber': 'chamber', 'Hydroponics': 'hydro',
    'Math Modeling': 'math', 'GIS &amp; Stress Forecast': 'gis',
    'Genetic Circuit Design': 'circuit', 'Bioreactor': 'reactor',
    'OD600 Photometer': 'photo', 'Light Plate Apparatus': 'lpa',
    'Chlorophyll Fluorometer': 'fluor', 'Protectant Design': 'protect',
    'Codon Optimization': 'codon', 'Wet Lab Handoff': 'wet',
}

# Deliverables are listed in the notebook in pipeline order, so each one
# belongs to the pipeline it follows. These are the ones where the order
# alone does not say (the week lists a pipeline twice, or a deliverable is
# filed under a neighbour).
DELIV_LANE = {
    ('2026-04-18', 'Stress Scoring Definition'): 'math',
    ('2026-08-08', 'Hardware Wiki Page'): 'reactor',
}
KW = {
    'dataphys': ['physicali', 'simulator', 'oobleck', 'thermochromic'],
    'wiki': ['wiki', 'notebook', 'homepage', 'regulation', 'reconstruction', 'review cycle', 'content', 'freeze', 'cadence'],
    'chamber': ['chamber', 'polycarbonate', 'material priority', 'shopping', 'sourcing', 'container', 'airflow', 'order list', 'media supplier'],
    'hydro': ['hydroponic', 'germination', 'phenotyp', 'stress assay', 'feedback plan', 'sap flow'],
    'math': ['model', 'figures', 'workbook', 'kinetics', 'weather', 'promoter', 'transport', 'amilcp', 'timeline figure', 'flow rate', 'delay', 'three-phase', 'dossier', 'dosing', 'invariant', 'scale-up', 'digital twin', 'stress forecast', 'irrigation', 'protectant decision', 'sim schematic', 'brophy', 'data source', 'scope', 'stress scoring'],
    'gis': ['gis', 'iso-stress', 'storyline', 'terrain', 'crop stress', 'fungal', 'variable selection'],
    'circuit': ['cello', 'circuit design', 'circuit background', 'closure rationale'],
    'reactor': ['bioreactor', 'reactor', 'hollow-fibre', 'lumen', 'obstacle', 'chang', 'professor', 'fluidics', 'optics', 'rack', 'driver', 'fibercell', 'filter', 'fit problem', 'prototype 2', 'printer', 'pinch', 'revised cad', 'pressure', 'tff', 'roadmap', 'hardware', 'safety net', 'servo', 'expert', 'pre-wetting', 'workstream', 'immobilized', 'carried forward', 'extract'],
    'photo': ['photometer', 'od600', 'optics bench', 'firmware'],
    'lpa': ['lpa', 'ppfd', 'led', 'calibration', 'per-bulb', 'pwm', 'first use'],
    'fluor': ['fluorometer', 'fv/fm', 'cost barrier', 'open-jip', 'core fluorometer'],
    'protect': ['protectant', 'accd', 'reporter', 'candidate', 'mutation', 'folding tool', 'bopep4', 'haddock', 'alanine', 'tandem', 'docking', 'order list v1', 'vendor', 'co-ip', 'collaboration', 'whiscy', 'md feasib', 'ordering strategy', 'tari', 'secretion efficiency', 'delivery question', 'acc deaminase'],
    'codon': ['codon', 'folding algorithm', 'tool decision'],
    'wet': ['wet lab handoff'],
}


def kw_score(title, lane):
    t = title.lower()
    return sum(len(k) for k in KW[lane] if k in t)


def assign_deliverables(date, lanes, deliv):
    """Monotone assignment: deliverables follow the pipeline order."""
    n, m = len(deliv), len(lanes)
    if not n:
        return []
    best = [[-1e9] * m for _ in range(n)]
    back = [[0] * m for _ in range(n)]
    for j in range(m):
        best[0][j] = kw_score(deliv[0]['t'], lanes[j]) - 0.01 * j
    for i in range(1, n):
        for j in range(m):
            k = max(range(j + 1), key=lambda k: best[i - 1][k])
            best[i][j] = best[i - 1][k] + kw_score(deliv[i]['t'], lanes[j])
            back[i][j] = k
    j = max(range(m), key=lambda j: best[n - 1][j])
    path = [0] * n
    for i in range(n - 1, -1, -1):
        path[i] = j
        j = back[i][j]
    out = [lanes[j] for j in path]
    for i, d in enumerate(deliv):
        forced = DELIV_LANE.get((date, re.sub('<[^>]+>', '', d['t'])))
        if forced:
            out[i] = forced
    return out


# ------------------------------------------------------- the written record
def inner(el):
    return el.decode_contents().strip() if el else ''


def read_record():
    soup = BeautifulSoup(open(PAGE, encoding='utf-8').read(), 'html.parser')
    weeks = []
    for a in soup.select('.nbmonths article.entry'):
        e = {'date': a['id'][2:], 'ai': 'entry--ai' in a.get('class', [])}
        e['pipes'] = []
        for li in a.select('ul.pipes > li'):
            e['pipes'].append({'lane': LANE_OF[inner(li.b)], 'stage': inner(li.span)})
        w = a.select_one('.entry__who')
        e['who'] = []
        if w:
            w = BeautifulSoup(str(w), 'html.parser')
            w.b.extract()
            e['who'] = [x.strip() for x in w.get_text().split(',') if x.strip()]
        note = a.select_one('.entry__note')
        e['note'] = inner(note)
        e['results'] = []
        for b in a.select('.entry__block'):
            ul = b.find('ul')
            if ul:
                e['results'] = [inner(li) for li in ul.find_all('li', recursive=False)]
        e['photos'] = [{'l': ph['href'], 't': ph.img['src'], 'c': ph.get('data-cap', ''),
                        'd': ph.get('data-date', ''), 'fig': 'ph--draft' in ph.get('class', [])}
                       for ph in a.select('.photos a.ph')]
        e['deliv'] = [{'t': inner(d.b), 'items': [inner(li) for li in d.select('ul > li')]}
                      for d in a.select('.deliv__item')]
        e['contrib'] = [{'who': inner(g.dt), 'html': inner(g.dd)} for g in a.select('dl.contrib > div')]
        links = a.select_one('.links')
        e['links'] = ''
        if links:
            links = BeautifulSoup(str(links), 'html.parser').select_one('.links')
            lbl = links.select_one('.lbl')
            if lbl:
                lbl.extract()
            e['links'] = inner(links)
        weeks.append(e)
    return weeks


# ---------------------------------------------------------- Felix's board
def git_show(rev, path):
    return subprocess.run(['git', 'show', f'{rev}:{path}'], capture_output=True,
                          text=True, check=True).stdout


def js_str(s):
    return s.replace("\\'", "'")


def undash(s):
    """No em or en dashes as punctuation on this wiki (ranges keep theirs)."""
    s = re.sub(r'\s+[—–]\s+', ', ', s)
    s = s.replace('—', ', ')
    return s


def read_board():
    src = git_show(LATEST_BOARD, PAGE)
    body = src[src.index('const ENTRIES'):src.index('const HANDOFFS')]
    rx = re.compile(r"\{p:'(\w+)',\s*w:(\d+),\s*k:'(\w+)',\s*h:(\d),\s*t:'((?:[^'\\]|\\.)*)',\s*s:'((?:[^'\\]|\\.)*)'")
    entries = {}
    for p, w, k, h, t, s in rx.findall(body):
        entries[(p, int(w))] = {'k': k, 'h': int(h), 't': undash(js_str(t)), 's': undash(js_str(s))}
    hsrc = src[src.index('const HANDOFFS'):src.index('const BRANCHES')]
    handoffs = []
    for blk in re.findall(r"\{p:'(\w+)',\s*w:(\d+),\s*t:'((?:[^'\\]|\\.)*)',(.*?back:'(?:[^'\\]|\\.)*')\}", hsrc, re.S):
        p, w, t, rest = blk
        get = lambda key: js_str(re.search(key + r":'((?:[^'\\]|\\.)*)'", rest).group(1))
        did = [js_str(x) for x in re.findall(r"'((?:[^'\\]|\\.)*)'", re.search(r"did:\[(.*?)\]", rest, re.S).group(1))]
        handoffs.append({'p': p, 'w': int(w), 't': undash(js_str(t)), 'd': undash(get('d')),
                         'sent': undash(get('sent')), 'did': [undash(x) for x in did], 'back': undash(get('back'))})
    m = re.search(r'^const PHOTOS=(.*?);\s*$', src, re.M)
    photos = {ph['t']: ph for ph in json.loads(m.group(1))}
    return entries, handoffs, photos


# -------------------------------------------------------------- the links
# Felix's four branches: a new pipeline growing out of an old one.
BRANCHES = [
    dict(kind='branch', frm='reactor', fw=7, to='lpa', tw=7, t='Optogenetics cannot wait for the reactor'),
    dict(kind='branch', frm='reactor', fw=7, to='photo', tw=8, t='In-line cell density is its own instrument'),
    dict(kind='branch', frm='math', fw=10, to='gis', tw=10, t='The spatial story splits from the kinetic model'),
    dict(kind='branch', frm='protect', fw=11, to='codon', tw=11, t='Design and expression are different problems'),
    # What one pipeline handed to another, where the notebook says so.
    dict(kind='feed', frm='chamber', fw=3, to='reactor', tw=3, t='Carried forward from the chamber: the RS485 soil sensor, and the airflow, lighting and enclosure learnings', ai=True),
    dict(kind='feed', frm='photo', fw=16, to='reactor', tw=16, t='The photometer goes in-line on the instrumented reactor', ai=True),
    dict(kind='feed', frm='protect', fw=18, to='math', tw=18, t='The protectant set is fixed, which closes the modelling uncertainty', ai=True),
]

# What came back from each handoff, as a state; and, where the notebook
# dates it, the week and pipeline the answer landed on.
RETURNS = [
    dict(state='Came back failed, and changed the design', to='reactor', w=11,
         t='Growth in the lumen fails, so Prototype 2 adds oxygenation'),
    dict(state='Still running at the end of the notebook'),
    dict(state='Partly back'),
    dict(state='Data back'),
    dict(state='Validated, with an error bar', to='photo', w=21,
         t='The four-fold error is chased against the BioDrop'),
    dict(state='Open until after the freeze'),
]


def main():
    record = read_record()
    felix, handoffs, fphotos = read_board()

    weeks = []           # one row per week, oldest first
    entries = []         # one node per pipeline per week
    by_key = {}
    photos = []
    for rec in record:
        w = week_of(rec['date'])
        while len(weeks) <= w:
            weeks.append({'date': (D0 + datetime.timedelta(days=7 * len(weeks))).isoformat(), 'days': []})
        week = weeks[w]
        lanes = []
        for p in rec['pipes']:
            if p['lane'] not in lanes:
                lanes.append(p['lane'])
        owner = assign_deliverables(rec['date'], lanes, rec['deliv'])
        day = {k: rec[k] for k in ('date', 'ai', 'who', 'note', 'results', 'contrib', 'links')}
        day['deliv'] = [dict(d, lane=o) for d, o in zip(rec['deliv'], owner)]
        week['days'].append(day)
        ai_titles = [re.match(r'<b>(.*?)</b>\s*(.*)', r, re.S) for r in rec['results']] if rec['ai'] else []
        for i, p in enumerate(rec['pipes']):
            if p['lane'] == 'wet':
                continue
            key = (p['lane'], w)
            if key in by_key:
                node = by_key[key]
                if p['stage'] and p['stage'] not in node['stage']:
                    node['stage'] = ', '.join(x for x in (node['stage'], p['stage']) if x)
            else:
                f = felix.get(key, {})
                node = {'p': p['lane'], 'w': w, 'k': f.get('k', 'work'), 'h': f.get('h', 1),
                        'stage': p['stage'], 't': f.get('t', p['stage']), 's': f.get('s', ''),
                        'ai': rec['ai'], 'deliv': [], 'dates': []}
                if rec['ai'] and i < len(ai_titles) and ai_titles[i]:
                    node['t'] = ai_titles[i].group(1)
                    node['s'] = ai_titles[i].group(2)
                entries.append(node)
                by_key[key] = node
            node['dates'].append(rec['date'])
        for d in day['deliv']:
            if d['lane'] != 'wet' and (d['lane'], w) in by_key:
                by_key[(d['lane'], w)]['deliv'].append({'t': d['t'], 'items': d['items']})
        for ph in rec['photos']:
            name = ph['t'].split('/')[-1]
            meta = fphotos.get(name, {})
            lane = meta.get('p')
            hf = meta.get('hf')
            if ph['fig']:
                lane = {'stress-matrix': 'math', 'reactor-designs': 'reactor', 'hydroponic-box': 'hydro',
                        'release-pattern': None, 'germination': 'hydro', 'sampling': 'reactor'}
                lane = next((v for k, v in lane.items() if k in name), None)
                hf = 0 if 'sampling' in name else None
            photos.append({'w': w, 'p': lane, 'hf': hf, 'c': ph['c'], 'd': ph['d'], 't': ph['t'], 'l': ph['l'],
                           's': meta.get('s', 0), 'k': 'figure' if ph['fig'] else meta.get('k', 'photo'),
                           'team': meta.get('team', 'Drylab')})

    # The notebook's own words for each handoff sit beside Felix's.
    for j, hf in enumerate(handoffs):
        day = next(d for d in weeks[hf['w']]['days'] for x in d['deliv'] if x['lane'] == 'wet')
        rec = next(x for d in weeks[hf['w']]['days'] for x in d['deliv'] if x['lane'] == 'wet')
        items = rec['items']
        hf['student_sent'] = next((re.sub(r'^Sent:\s*', '', x) for x in items if x.startswith('Sent:')), '')
        hf['student_did'] = [x for x in items if not x.startswith('Sent:')]
        hf['ret'] = RETURNS[j]
        hf['date'] = day['date']

    people = sorted({n for wk in weeks for d in wk['days'] for n in d['who']})
    data = {
        'pipes': PIPES, 'weeks': weeks, 'entries': entries, 'handoffs': handoffs,
        'links': BRANCHES, 'photos': photos, 'people': people,
    }
    js = ('/* Generated by build/drylab_notebook.py from the written record in\n'
          '   index.html and Felix\'s board. Edit the record, then re-run. */\n'
          'window.NB = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(OUT, 'w', encoding='utf-8').write(js)
    print(f'{len(weeks)} weeks, {len(entries)} nodes, {len(handoffs)} handoffs, '
          f'{len(photos)} photographs, {len(people)} people, {len(js)//1024} KB')
    orphans = [(p['p'], p['w']) for p in photos if p['p'] and (p['p'], p['w']) not in by_key]
    if orphans:
        print('photographs on a pipeline-week with no node:', orphans)


if __name__ == '__main__':
    main()
