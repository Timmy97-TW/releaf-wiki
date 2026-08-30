# Taiwan-wide Fertilizer Companies → Farmland — Routing Package

## Open this first
**`taiwan_all_counties.html`** — double-click to open in a browser (needs internet: map tiles + live OSRM routing calls).

- **County dropdown** (top of side panel) — zooms/pans into any of the 19 counties. Leave on "All Taiwan" for the national view.
- **"Load: every company → its own township's farmland"** — loads the default network: every one of the 613 companies that has local farmland data routes to its own township's farmland node, real OSRM road distance/time. ~613 live routing calls, throttled — takes a couple of minutes, progress bar shown.
- **"Explore one company"** dropdown — pick any single company (labeled `[county] name`) and route it to every farmland node in **its own county only**.

## The county-scoping rule you asked for
Every route — in both modes — is restricted to farmland nodes inside the **same county** as the company. A Changhua company will never link to Yilan farmland, even if some Yilan node happens to be geographically closer as the crow flies. The fallback logic (used when a company's own township has no farmland data) searches only within `nodesByCounty[company's county]` — there is no cross-county fallback path in the code.

## Scale — what actually went into this
| | |
|---|---|
| Counties processed | 19 (all uploaded; missing only outlying islands — 金門縣, 澎湖縣, 連江縣 — not part of this upload) |
| Total farmland parcels | **2,792,536** (every parcel from every uploaded shapefile — none sampled) |
| Total farmland area | **743,529 ha** |
| Farmland demand nodes | 346 (township-level, same aggregation method as the Taichung pilot — see `methods_farmland_aggregation.md` from earlier) |
| Fertilizer companies | 616 (613 have in-county farmland data; 2 in 金門縣 + 1 in 澎湖縣 don't, since those counties weren't in this upload) |

Sanity check: 743,529 ha is in the right range for Taiwan's total farmland/arable area — a good sign the pipeline held up at national scale, not just for the Taichung pilot.

## What's real vs. still an assumption (same standard as before)
**Real:** every parcel's centroid (computed from its own polygon), the township spatial join (point-in-polygon against official MOI boundaries), the area-weighted aggregation, and every route's distance/time (live OSRM road-network routing, not straight-line).

**Still an assumption, left editable in the UI:** NT$/km freight cost, kg CO₂/tonne-km emission factor, truck payload tonnage. No sourced Taiwan freight/emission rate was available, so these are exposed as input boxes rather than presented as fact.

## Files in this package
| File | Purpose |
|---|---|
| `taiwan_all_counties.html` | The interactive map (open this) |
| `raster_<code>.png` + `.pgw` (19 pairs) | Georeferenced parcel raster per county (EPSG:3826) — drag matching pairs into QGIS for the exact same visual as your original screenshots, at national scale |
| `all_farmland_nodes.csv` / `.geojson` | All 346 township farmland nodes (county, township, hectares, parcel count, weighted centroid) |
| `county_meta.json` | Per-county raster bounds/file references (used internally by the HTML; also useful if you want to script your own map) |

County → letter code mapping for the raster filenames: A=臺北市, B=臺中市, C=基隆市, D=臺南市, E=高雄市, F=新北市, G=宜蘭縣, H=桃園市, I=嘉義市, J=新竹縣, K=苗栗縣, M=南投縣, N=彰化縣, O=新竹市, P=雲林縣, Q=嘉義縣, T=屏東縣, U=花蓮縣, V=臺東縣.

## If you add the missing counties later
Send the 金門縣/連江縣/澎湖縣 (or any other) 農田坵塊圖 shapefiles and I'll run them through the identical pipeline and merge them in — no rework needed on the counties already done.
