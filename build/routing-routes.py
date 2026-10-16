"""Precompute every road route the routing map can draw, so the page never calls OSRM.

geospatial-analysis/routing/index.html used to ask router.project-osrm.org for each
supplier -> farmland pair while the reader watched. iGEM's wiki may only load from
igem.org / igem.wiki, so this script makes every request the page could make, once,
and packs the answers into routes.json next to the page.

The pairs are exactly the page's two modes:
  1. every supplier -> the farmland node of its own township (nearest node in the
     same county when its township has none);
  2. every supplier -> every farmland node of at least 1 ha in its own county.

    python3 build/routing-routes.py fetch CACHE_DIR   # ~80 min: one request every 1.1 s
    python3 build/routing-routes.py pack  CACHE_DIR   # writes routes.json

fetch keeps each raw OSRM response in CACHE_DIR (outside the repo) and skips pairs it
already has, so it can be stopped and resumed. pack reads only the cache.

Pairs OSRM cannot route (Liuqiu island has no road link) are left out, and the page
reports them as "could not be routed", as it did with live OSRM.

routes.json: {"points": [[lng, lat], ...], "routes": {"i,j": [metres, seconds, polyline]}}
where i is the supplier's point and j the farmland node's, and polyline is the OSRM
geometry, Douglas-Peucker simplified to TOLERANCE and Google-polyline encoded at 5
decimals. Distance and time are OSRM's own figures for the full geometry.
"""
import json, math, os, re, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, '..', 'geospatial-analysis', 'routing', 'index.html')
OUT = os.path.join(HERE, '..', 'geospatial-analysis', 'routing', 'routes.json')
OSRM = 'https://router.project-osrm.org/route/v1/driving/'
INTERVAL = 1.1          # OSRM's public server allows one request a second
TOLERANCE = 0.00015     # degrees, about 15 m: a pixel or two at the map's closest zoom (14)


def page_data():
    data = {}
    for line in open(PAGE, encoding='utf-8'):
        m = re.match(r'const (ALL_FARMLAND_NODES|ALL_COMPANIES) = (.*);\s*$', line)
        if m:
            data[m.group(1)] = json.loads(m.group(2))
    return data['ALL_COMPANIES'], data['ALL_FARMLAND_NODES']


def haversine(a, b):
    r, rad = 6371, math.radians
    dlat, dlng = rad(b[1] - a[1]), rad(b[0] - a[0])
    x = math.sin(dlat / 2) ** 2 + math.cos(rad(a[1])) * math.cos(rad(b[1])) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def pairs():
    """(supplier lng/lat, node lng/lat) for every route either mode can draw."""
    companies, nodes = page_data()
    by_county, by_township = {}, {}
    for n in nodes:
        by_county.setdefault(n['county'], []).append(n)
        by_township[n['county'] + '|' + n['township']] = n
    out = set()
    for c in companies:
        cands = by_county.get(c['county'])
        if not cands:
            continue
        a = (c['lng'], c['lat'])
        t = by_township.get(c['county'] + '|' + c['township'])
        if not t:  # same tie-break as the page: first node with the smallest distance
            t = min(cands, key=lambda n: haversine(a, (n['centroid_lng'], n['centroid_lat'])))
        out.add((a, (t['centroid_lng'], t['centroid_lat'])))
        for n in cands:
            if n['total_area_ha'] >= 1:
                out.add((a, (n['centroid_lng'], n['centroid_lat'])))
    return sorted(out)


def cache_name(cache, a, b):
    return os.path.join(cache, '%r_%r_%r_%r.json' % (a[0], a[1], b[0], b[1]))


def fetch(cache):
    os.makedirs(cache, exist_ok=True)
    todo = [p for p in pairs() if not os.path.exists(cache_name(cache, *p))]
    print(len(todo), 'routes to fetch', flush=True)
    for k, (a, b) in enumerate(todo):
        url = OSRM + '%r,%r;%r,%r?overview=full&geometries=geojson' % (a[0], a[1], b[0], b[1])
        for attempt in range(5):
            t0 = time.time()
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'ReLEAF iGEM 2026 wiki build (one-off precompute)'})
                body = json.load(urllib.request.urlopen(req, timeout=30))
                break
            except urllib.error.HTTPError as e:
                if e.code == 400:  # OSRM's answer, e.g. NoRoute to Liuqiu island: keep it, don't retry
                    body = json.load(e)
                    break
                body = None
                print('retry', k, e, flush=True)
                time.sleep(5 * (attempt + 1))
            except Exception as e:
                body = None
                print('retry', k, e, flush=True)
                time.sleep(5 * (attempt + 1))
        if body is not None:
            with open(cache_name(cache, a, b), 'w') as f:
                json.dump(body, f)
        if k % 100 == 0:
            print(k, '/', len(todo), flush=True)
        time.sleep(max(0, INTERVAL - (time.time() - t0)))


def simplify(pts, tol):
    """Douglas-Peucker on [lng, lat] points (planar, fine at this scale)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        (x1, y1), (x2, y2) = pts[i], pts[j]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        best, idx = -1, -1
        for k in range(i + 1, j):
            x, y = pts[k]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L if L else math.hypot(x - x1, y - y1)
            if d > best:
                best, idx = d, k
        if best > tol:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(pts, keep) if k]


def encode(pts):
    """Google encoded polyline, lat first, 5 decimals."""
    out, plat, plng = [], 0, 0
    for lng, lat in pts:
        ilat, ilng = round(lat * 1e5), round(lng * 1e5)
        for v in (ilat - plat, ilng - plng):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1f)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        plat, plng = ilat, ilng
    return ''.join(out)


def pack(cache):
    points, index, routes, missing = [], {}, {}, 0
    def pid(p):
        if p not in index:
            index[p] = len(points)
            points.append(list(p))
        return index[p]
    for a, b in pairs():
        try:
            body = json.load(open(cache_name(cache, a, b)))
            r = body['routes'][0]
        except Exception:
            missing += 1  # the page reports these as "could not be routed"
            continue
        geom = simplify(r['geometry']['coordinates'], TOLERANCE)
        routes['%d,%d' % (pid(a), pid(b))] = [round(r['distance']), round(r['duration']), encode(geom)]
    with open(OUT, 'w') as f:
        json.dump({'source': 'OSRM (router.project-osrm.org, OpenStreetMap data), fetched %s' % time.strftime('%Y-%m-%d'),
                   'points': points, 'routes': routes}, f, separators=(',', ':'))
    print(len(routes), 'routes,', missing, 'missing,', os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    {'fetch': fetch, 'pack': pack}[sys.argv[1]](sys.argv[2])
