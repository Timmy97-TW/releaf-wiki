"""Draw Taiwan for the routing map: land, county borders and township borders as one small GeoJSON.

The routing map (geospatial-analysis/routing/) used OpenStreetMap tiles, which iGEM's
wiki may not load. It now draws Taiwan itself from basemap.json, written here from the
Ministry of the Interior's township boundaries (鄉鎮市區界線, TWD97 lon/lat,
https://data.gov.tw/dataset/7441, Open Government Data License) as redistributed in
TopoJSON by the taiwan-atlas package (towns-10t.json, MIT):

    npm pack taiwan-atlas && tar xzf taiwan-atlas-*.tgz
    python3 build/routing-basemap.py package/towns-10t.json

Because the topology is shared, each border is stored once:
  land      the nation polygon, filled under the farmland rasters
  county    arcs between two townships of different counties
  township  arcs between two townships of the same county
The coast is the land polygon's own outline. Every arc is Douglas-Peucker simplified
with TOLERANCE (both neighbours get the same line, so no slivers) and rounded to 4
decimals (about 11 m).
"""
import json, math, os, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'geospatial-analysis', 'routing', 'basemap.json')
TOLERANCE = 0.0008   # degrees, about 80 m: under a pixel up to zoom 10
DROP_RING_KM2 = 0.3  # islets smaller than this vanish at the zoom levels the page opens at


def simplify(pts, tol):
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


def ring_km2(ring):
    a = 0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        a += x1 * y2 - x2 * y1
    lat = math.radians(sum(p[1] for p in ring) / len(ring))
    return abs(a) / 2 * 111.32 ** 2 * math.cos(lat)


def main(src):
    topo = json.load(open(src, encoding='utf-8'))
    (sx, sy), (tx, ty) = topo['transform']['scale'], topo['transform']['translate']
    arcs = []
    for arc in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append([[round(a, 4), round(b, 4)] for a, b in simplify(pts, TOLERANCE)])

    def arc(i):
        return arcs[i] if i >= 0 else arcs[~i][::-1]

    def rings(geom):
        polys = geom['arcs'] if geom['type'] == 'MultiPolygon' else [geom['arcs']]
        return [[r for r in poly] for poly in polys]

    # which counties use each arc
    users = {}
    for g in topo['objects']['towns']['geometries']:
        county = g['properties']['COUNTYID']
        for poly in rings(g):
            for ring in poly:
                for i in ring:
                    users.setdefault(i if i >= 0 else ~i, []).append(county)
    county_lines, town_lines = [], []
    for i, who in sorted(users.items()):
        if len(who) == 2 and len(arcs[i]) >= 2:
            (county_lines if who[0] != who[1] else town_lines).append(arcs[i])

    land = []
    for g in topo['objects']['nation']['geometries']:
        for poly in rings(g):
            out = []
            for ring in poly:
                pts = []
                for i in ring:
                    a = arc(i)
                    pts += a if not pts else a[1:]
                if len(pts) >= 4 and ring_km2(pts) >= DROP_RING_KM2:
                    out.append(pts)
                elif not out:
                    break  # outer ring gone: drop the whole islet
            if out:
                land.append(out)

    fc = {'type': 'FeatureCollection',
          'source': "Ministry of the Interior township boundaries (data.gov.tw/dataset/7441), via taiwan-atlas towns-10t.json",
          'features': [
              {'type': 'Feature', 'properties': {'kind': 'land'}, 'geometry': {'type': 'MultiPolygon', 'coordinates': land}},
              {'type': 'Feature', 'properties': {'kind': 'township'}, 'geometry': {'type': 'MultiLineString', 'coordinates': town_lines}},
              {'type': 'Feature', 'properties': {'kind': 'county'}, 'geometry': {'type': 'MultiLineString', 'coordinates': county_lines}},
          ]}
    with open(OUT, 'w') as f:
        json.dump(fc, f, separators=(',', ':'))
    print(len(land), 'land polygons,', len(county_lines), 'county arcs,', len(town_lines), 'township arcs,',
          os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main(sys.argv[1])
