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

Since 30 September 2026 the file also carries what neither source has: the
Digital Twin lane, the September nodes' kinds and weights (NODES), the two
September handoffs (EXTRA_HANDOFFS), the plan to the wiki freeze as three
pencilled-in weeks (PLAN), the September photographs' lanes (SEPT_PHOTOS),
and the wet lab's own tracks for the Season timeline, read from
build/drylab_notebook_wet.json.

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
WET = 'build/drylab_notebook_wet.json'   # the wet lab's own tracks, for the timeline


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
    # Added 30 September: the rig software, the operator interface and the
    # twin's models, which the September pages treat as their own track.
    dict(id='twin', name='Digital\nTwin', short='Digital Twin', abbr='Twin', g='model', c='#0e7c66', href='../software/'),
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
    'Codon Optimization': 'codon', 'Digital Twin': 'twin', 'Wet Lab Handoff': 'wet',
}

# Deliverables are listed in the notebook in pipeline order, so each one
# belongs to the pipeline it follows. These are the ones where the order
# alone does not say (the week lists a pipeline twice, or a deliverable is
# filed under a neighbour).
DELIV_LANE = {
    ('2026-04-18', 'Stress Scoring Definition'): 'math',
    ('2026-08-08', 'Hardware Wiki Page'): 'reactor',
    # 30 September: the drafted deliverables from 29 August to 26 September.
    ('2026-09-05', 'Field Dialogue Booth'): 'dataphys',
    ('2026-09-05', 'Reactor at the Forum'): 'reactor',
    ('2026-09-05', 'Long-Run Monitoring'): 'reactor',
    ('2026-09-05', 'Operator Interface 0906'): 'twin',
    ('2026-09-05', 'Rig Firmware v1'): 'twin',
    ('2026-09-05', 'Project Poster, Second Version'): 'wiki',
    ('2026-09-12', 'Solute Dispersion Model'): 'math',
    ('2026-09-12', 'Protectant Uptake Curve'): 'math',
    ('2026-09-12', 'Cartridge, Mounted Upright'): 'reactor',
    ('2026-09-12', 'BoPEP4 Level 0 Screen'): 'protect',
    ('2026-09-19', 'Light-Control Run 1'): 'lpa',
    ('2026-09-19', 'Growth Prior'): 'twin',
    ('2026-09-19', 'Operator Interface 0924'): 'twin',
    ('2026-09-19', 'Rig Firmware v2'): 'twin',
    ('2026-09-19', 'Salt Ladder, Per Seedling'): 'math',
    ('2026-09-19', 'Dry Lab Progress Check'): 'wiki',
    ('2026-09-19', 'Wet Lab Handoff: DiOPAL'): 'wet',
    ('2026-09-26', 'Student Drafts, 25 to 28 September'): 'wiki',
    ('2026-09-26', 'Floating Plate, Written Up'): 'hydro',
    ('2026-09-26', 'Township Soil Map'): 'gis',
    ('2026-09-26', 'Farm Calculator'): 'gis',
    ('2026-09-26', 'Booth Survey Results'): 'dataphys',
    ('2026-09-26', 'Digital Twin Page'): 'twin',
    ('2026-09-26', 'Bioreactor Record'): 'reactor',
    ('2026-09-26', 'Simplified Photometer'): 'photo',
    ('2026-09-26', 'Protein Design Section'): 'protect',
    ('2026-08-29', 'Whole-Rig Run, 2 to 4 September'): 'reactor',
    ('2026-08-29', 'Second Review with Prof. Chang'): 'reactor',
    ('2026-08-29', 'MD Batch 3'): 'protect',
    ('2026-08-29', 'Rig Firmware v0.3'): 'twin',
    ('2026-08-29', 'Wet Lab Handoff: The Whole Rig'): 'wet',
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
    'twin': ['firmware', 'interface', 'growth prior', 'twin', 'repository'],
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
        e = {'date': a['id'][2:], 'ai': 'entry--ai' in a.get('class', []), 'event': a.get('data-event', '')}
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
# ------------------------------------------------ added 30 September 2026
# The September weeks were drafted from the wiki pages as they stood on 28
# and 29 September (the team has not written them up), so their nodes carry
# the orange drafting mark like the late-August ones. What follows is what
# the record alone cannot say: the kind and weight of each September node,
# the handoffs after Felix's six, and the plan to the wiki freeze.
TODAY = '2026-10-07'
FREEZE = '2026-10-21'
LAST_PLAN_WEEK = '2026-10-17'   # the last weekend before the freeze

# (lane, week Saturday) -> kind and weight, where a week is more than a
# working week.
NODES = {
    ('reactor', '2026-08-29'): dict(k='milestone', h=3),
    ('protect', '2026-08-29'): dict(k='work', h=2),
    ('twin', '2026-08-29'): dict(k='start', h=2),
    ('dataphys', '2026-09-05'): dict(k='milestone', h=3),
    ('reactor', '2026-09-05'): dict(k='work', h=2),
    ('twin', '2026-09-05'): dict(k='work', h=2),
    ('math', '2026-09-12'): dict(k='work', h=2),
    ('protect', '2026-09-12'): dict(k='milestone', h=3),
    ('lpa', '2026-09-19'): dict(k='milestone', h=3),
    ('twin', '2026-09-19'): dict(k='work', h=3),
    ('math', '2026-09-19'): dict(k='work', h=2),
    ('wiki', '2026-09-26'): dict(k='milestone', h=3),
    ('twin', '2026-09-26'): dict(k='work', h=2),
    ('gis', '2026-09-26'): dict(k='work', h=2),
    ('protect', '2026-09-26'): dict(k='work', h=2),
    # 7 October: lanes the Discord record adds to September.
    ('photo', '2026-09-05'): dict(k='work', h=2),
    ('photo', '2026-09-12'): dict(k='work', h=2),
    ('chamber', '2026-09-26'): dict(k='work', h=2),
    # 7 October: the week of 3 October, from the Discord record.
    ('protect', '2026-10-03'): dict(k='work', h=2),
    ('lpa', '2026-10-03'): dict(k='work', h=2),
    ('chamber', '2026-10-03'): dict(k='milestone', h=3),
    ('wiki', '2026-10-03'): dict(k='work', h=1),
}

# Handoffs after Felix's board, in his shape.
EXTRA_HANDOFFS = [
    dict(p='reactor', w=22, t='the whole rig, with cells in it',
         d='The first time every subsystem ran at once on engineered cells: the reactor in its case, the photometer in line, pressure logged, in the 37 °C incubator.',
         sent='The instrumented reactor with the constitutive Csn:ACCD strain in the loop.',
         did=['Ran it from 2 to 4 September in the 37 °C incubator',
              'Sampled lumen lysate, lumen medium and shell medium at nine time points to 44 h',
              'Ran a Western blot on the samples'],
         back='OD600 rose from 0.1738 to 2.4474 over 53 h 22 min and 6,387 logged samples, with transmembrane pressure flat at -0.0005 bar after 1,132 L. The team\'s own documents read the 44 h blot three ways (not detectable, low but present, a faint band near 42 kDa), so the run counts as proof that the rig works with cells in it until the blot is read once, properly.'),
    dict(p='lpa', w=25, t='DiOPAL, for a light-control run',
         d='The light plate apparatus went to the wet lab for its first culture run under defined light.',
         sent='DiOPAL, six light conditions with four matched LEDs each.',
         did=['Pipetted the cultures under a safelight on 19 September',
              'Ran them on DiOPAL on a shaker in the incubator, lit green and red',
              'Read OD600 on the plate reader'],
         back='Growth came back: a logistic fit gives r = 0.299 per hour and K = 1.005 with 1.9 % error, the same growth rate in all six light arms. It was a growth readout: nothing measured the circuit\'s output, which is the next run.'),
]
# September photographs: lane, star, team, kind, and m = 1 for the frames
# that go into the DRY LAB mosaic although another subteam took them.
SEPT_PHOTOS = {
    '200-t.webp': dict(p='dataphys', s=0, team='HP', k='photo', m=0),
    '201-t.webp': dict(p='dataphys', s=0, team='HP', k='photo', m=0),
    '202-t.webp': dict(p='dataphys', s=0, team='HP', k='photo', m=0),
    '203-t.webp': dict(p='reactor', s=0, team='HP', k='photo', m=1),
    '204-t.webp': dict(p=None, s=0, team='HP', k='photo', m=0),
    '205-t.webp': dict(p='reactor', s=0, team='HP', k='photo', m=0),
    '206-t.webp': dict(p='reactor', s=0, team='HP', k='photo', m=0),
    '207-t.webp': dict(p='dataphys', s=1, team='HP', k='photo', m=1),
    '208-t.webp': dict(p='reactor', s=0, team='HP', k='photo', m=1),
    '209-t.webp': dict(p='reactor', s=1, team='HP', k='photo', m=1),
    '210-t.webp': dict(p='reactor', s=0, team='HP', k='photo', m=1),
    '211-t.webp': dict(p='dataphys', s=0, team='HP', k='photo', m=1),
    '212-t.webp': dict(p='reactor', s=1, team='Wetlab', k='photo', m=1),
    '213-t.webp': dict(p='math', s=0, team='Drylab', k='figure', m=0),
    '214-t.webp': dict(p='math', s=0, team='Drylab', k='figure', m=0),
    '215-t.webp': dict(p=None, s=0, team='Drylab', k='photo', m=1),
    '216-t.webp': dict(p=None, s=1, team='Drylab', k='photo', m=1),
    '217-t.webp': dict(p=None, s=0, team='Drylab', k='photo', m=0),
    '218-t.webp': dict(p=None, s=0, team='Drylab', k='photo', m=1),
    '219-t.webp': dict(p='lpa', s=1, team='Wetlab', k='photo', m=1, hf=7),
    '220-t.webp': dict(p=None, s=0, team='Wetlab', k='photo', m=0, hf=7),
    '221-t.webp': dict(p=None, s=0, team='Wetlab', k='photo', m=0),
    '222-t.webp': dict(p='reactor', s=1, team='HP', k='photo', m=1),
    '230-t.webp': dict(p='reactor', s=0, team='Drylab', k='photo', m=1, hf=6),
    '231-t.webp': dict(p='reactor', s=0, team='Drylab', k='figure', m=0, hf=6),
    '232-t.webp': dict(p='protect', s=0, team='Wetlab', k='figure', m=0),
    '233-t.webp': dict(p='math', s=0, team='Drylab', k='figure', m=0),
    '234-t.webp': dict(p='reactor', s=0, team='Drylab', k='photo', m=1),
    '235-t.webp': dict(p='reactor', s=0, team='Wetlab', k='photo', m=0),
    '236-t.webp': dict(p='wiki', s=0, team='General', k='photo', m=0),
    '237-t.webp': dict(p='gis', s=0, team='Drylab', k='figure', m=0),
    '238-t.webp': dict(p='gis', s=0, team='Drylab', k='figure', m=0),
    '239-t.webp': dict(p='dataphys', s=0, team='Drylab', k='figure', m=0),
    '240-t.webp': dict(p='protect', s=0, team='Drylab', k='figure', m=0),
    '241-t.webp': dict(p='twin', s=0, team='Drylab', k='figure', m=0),
    '243-t.webp': dict(p='hydro', s=0, team='Drylab', k='photo', m=1),
    '244-t.webp': dict(p='hydro', s=0, team='Wetlab', k='figure', m=0),
    '245-t.webp': dict(p=None, s=0, team='HP', k='photo', m=0),
    '246-t.webp': dict(p=None, s=1, team='HP', k='photo', m=0),
    '247-t.webp': dict(p=None, s=0, team='HP', k='photo', m=0),
    '248-t.webp': dict(p=None, s=0, team='HP', k='photo', m=0),
    '242-t.webp': dict(p='protect', s=0, team='Drylab', k='figure', m=0),
    # October, from the team gallery.
    '223-t.webp': dict(p='chamber', s=1, team='Drylab', k='photo', m=1),
    '224-t.webp': dict(p='chamber', s=0, team='Drylab', k='photo', m=1),
    '225-t.webp': dict(p='chamber', s=0, team='Drylab', k='photo', m=0),
    '226-t.webp': dict(p=None, s=0, team='Drylab', k='photo', m=0),
}

# What came back later, added to Felix's own account of a handoff.
BACK_MORE = {
    1: ('Later: the dry lab\'s printed floating plate (first printed 25 June) went into the wet lab\'s tip boxes '
        'on 20 July and carried three runs with the CH Biotech peptide given before, with or after the stress: '
        'salinity set 1 (100 mM NaCl on 28 July, harvested 4 August) and two heat runs at a measured 33 °C '
        '(14 to 16 August) and 35 °C (19 to 21 August). Heat set 2 read 0.359, 0.289, 0.223 and 0.252 mg '
        'chlorophyll per g fresh weight (control, before, with, after), three reads of one tube per box. Every arm '
        'was one box, and in set 1 the per-gram and per-plant figures rank the boxes in opposite order, so the '
        'runs show the plate works as a carrier and cannot rank the treatments. On 22 July one board sank when '
        'medium got into it; buoyancy with a full set of plants is still unverified.'),
    5: ('Later: on 18 September the three BoPEP4 Level 0 variants reordered on 16 August screened at 548 bp, '
        'twenty of twenty-one colonies banded. No expression, purification or assay behind them yet.'),
}

# The plan to the freeze, pencilled in by week. The pages say what is left;
# the week each item sits in is our proposal, so every one is drafted.
PLAN = [
    ('2026-10-03', 'twin', 'Mirror the software repository to iGEM\'s GitLab',
     'The Judge Handbook only accepts software hosted on gitlab.igem.org for the Best Software award.'),
    ('2026-10-03', 'reactor', 'Repeat the 22 °C growth test and check plasmid stability',
     'Prof. Chang\'s first two asks from 4 September, before the reactor is shown again.'),
    ('2026-10-03', 'math', 'Close the six open questions in the model\'s section 12',
     'Publish the yield fit, record the nine unrecorded constants and the salt-ladder to index conversion, and settle the two disputed Hill constants.'),
    ('2026-10-10', 'lpa', 'Measure photon flux and well-to-well uniformity',
     'Lux readings do not give the dose the circuit sees; the next culture run needs flux per well. '
     'Pencilled in for 3 October and still open on 7 October.'),
    ('2026-10-10', 'lpa', 'Green against dark on the Level 2 strain, reading the output',
     'The run the Engineering page waits on: the first time the apparatus would test whether the switch switches.'),
    ('2026-10-10', 'photo', 'Write up cycles 7 and 8 and upload the STEP files',
     'The silicon dioxide calibration and the simplified optics, both built, neither written.'),
    ('2026-10-10', 'gis', 'Take the routing map off OpenStreetMap and OSRM',
     'Cache or replace both, so nothing on the wiki is fetched from a server outside iGEM.'),
    ('2026-10-10', 'protect', 'Scope or drop the unspecified engineering-direction runs',
     'The layout document lists them without saying what they are; the page asks for a decision before the freeze.'),
    ('2026-10-10', 'hydro', 'Assembly section, drawings and print settings for the four STLs',
     'So the plate can be printed by someone who has not seen it.'),
    ('2026-10-17', 'reactor', 'Write the proof-of-concept run and the assembly guide',
     'Section 4.2 links stress, sensor, green light, protectant and the hydroponics plate in one run.'),
    ('2026-10-17', 'twin', 'Move the pressure ceiling and the command watchdog into the rig firmware',
     'The page names this as the precondition for any automation above tier 0.'),
    ('2026-10-17', 'math', 'Publish the stress index as the contingency',
     'If the plant replicates do not arrive, the index goes up without a thin dose-response fit.'),
    ('2026-10-17', 'wiki', 'Close the Engineering and Results fix lists; freeze on 21 October',
     'Every page finished and every file moved onto iGEM\'s servers.'),
]

RETURNS = [
    dict(state='Came back failed, and changed the design', to='reactor', w=11,
         t='Growth in the lumen fails, so Prototype 2 adds oxygenation'),
    dict(state='Came back as three plant runs, one box per arm', to='hydro', w=26,
         t='The printed plate\'s three runs are written up'),
    dict(state='Partly back: four designs at sequenced Level 1'),
    dict(state='Data back'),
    dict(state='Validated, with an error bar', to='photo', w=21,
         t='The four-fold error is chased against the BioDrop'),
    dict(state='Back as DNA, not yet expressed', to='protect', w=24,
         t='Twenty of twenty-one BoPEP4 Level 0 clones carry the 548 bp band'),
    dict(state='Data back, blot disputed', to='twin', w=23,
         t='The run\'s record becomes what the twin is checked against'),
    dict(state='Growth data back', to='twin', w=25,
         t='The growth fit becomes the twin\'s prior'),
]


def main():
    record = read_record()
    felix, handoffs, fphotos = read_board()

    weeks = []           # one row per week, oldest first
    entries = []         # one node per pipeline per week
    by_key = {}
    photos = []
    events = []
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
        day = {k: rec[k] for k in ('date', 'ai', 'who', 'note', 'results', 'contrib', 'links', 'event')}
        if rec['event']:
            events.append({'date': rec['date'], 'w': w, 't': rec['event'], 'id': 'e-' + rec['date']})
        day['deliv'] = [dict(d, lane=o) for d, o in zip(rec['deliv'], owner)]
        week['days'].append(day)
        ai_titles = [re.match(r'<b>(.*?)</b>\s*(.*)', r, re.S) for r in rec['results']] if rec['ai'] else []
        for i, p in enumerate(rec['pipes']):
            # An event (a symposium, a forum) is its own entry in the record
            # and a flag on the timeline; it does not add marks to the board.
            if p['lane'] == 'wet' or rec['event']:
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
            sm = SEPT_PHOTOS.get(name)
            if sm:
                lane, hf = sm.get('p'), sm.get('hf')
                meta = sm
            photos.append({'w': w, 'p': lane, 'hf': hf, 'c': ph['c'], 'd': ph['d'], 't': ph['t'], 'l': ph['l'],
                           's': meta.get('s', 0), 'k': 'figure' if ph['fig'] else meta.get('k', 'photo'),
                           'team': meta.get('team', 'Drylab'), 'm': meta.get('m', 0)})

    # September: kinds and weights the record cannot give.
    for (lane, date), o in NODES.items():
        node = by_key.get((lane, week_of(date)))
        if node:
            node.update(o)
    # The plan to the freeze: empty weeks, pencilled-in nodes.
    while weeks[-1]['date'] < LAST_PLAN_WEEK:
        weeks.append({'date': (D0 + datetime.timedelta(days=7 * len(weeks))).isoformat(), 'days': [], 'plan': True})
    for date, lane, t, sm in PLAN:
        entries.append({'p': lane, 'w': week_of(date), 'k': 'plan', 'h': 1, 'stage': 'Planned', 't': t, 's': sm,
                        'ai': True, 'deliv': [], 'dates': []})

    handoffs = handoffs + [dict(h) for h in EXTRA_HANDOFFS]
    for j, more in BACK_MORE.items():
        handoffs[j]['back'] += ' ' + more
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
        'today': TODAY, 'freeze': FREEZE, 'events': events,
        'wet': json.load(open(WET, encoding='utf-8'))['tracks'],
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
