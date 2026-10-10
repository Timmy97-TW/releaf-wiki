# Taiwan fertilizer supply routes: wiki package

Open `taiwan_fertilizer_routes.html` in a browser. It needs an internet connection for the Leaflet library, the CARTO basemap tiles and live OSRM road routing. The `raster_*.png` files must sit next to the HTML (or be re-pointed to their uploaded URLs).

## What changed from the previous package
- All county, township and supplier names are in English. `name_translations.csv` maps every original Chinese name to the English one used on the map, so any name can be checked.
- Supplier names use the established English trade name where one exists (for example Taiwan Fertilizer Co., Ltd., Taiwan Sugar Corporation, Sinon Corporation, Known-You Seed, BASF Taiwan, Bayer Taiwan, Syngenta Taiwan). Every other name is a rendering: the business type is translated and the trade name is romanized in Hanyu Pinyin. These renderings are not registered English names.
- Township names follow the Chunghwa Post English names (from the `twzipcode-data` package), with spelling errors corrected.
- Street addresses were removed from popups because they were in Chinese and added nothing at map scale.
- The editable cost and emission boxes are replaced by fixed, sourced parameters (below).
- Cost is now per truck round trip and emissions per tonne delivered. The old formula multiplied a round trip by a per-tonne-km factor and a payload, which also counted the empty return leg as loaded.

## Fixed parameters
| Parameter | Value | Source |
|---|---|---|
| Truck operating cost | US$1.45 per km (US$2.336 per mile) | American Transportation Research Institute, *An Analysis of the Operational Costs of Trucking: 2026 Update* (released July 2026, 2025 data). Industry-average cost per mile across fuel, driver wages and benefits, repair and maintenance, tires, tolls, insurance and truck payments. |
| CO₂e emission factor | 0.276 kg CO₂e per tonne-km | Ministry of Environment (Taiwan), carbon footprint emission factor database (碳足跡排放係數, dataset CFP_P_02): "7.5–16 t ambient-temperature truck freight service, 80% load factor, including depot emissions". Declared by the MOTC Institute of Transportation, 2017. |

Caveats: the cost figure is a US benchmark (Class 8 trucks, US wages) because no per-km truck operating cost is published for Taiwan, so it is likely an upper estimate for Taiwanese medium trucks. Other entries in the same MOENV database cover the large-truck category: commercial large diesel truck 0.235 kg CO₂e/tkm (2014) and 3.5–7.4 t truck service at an 82% load factor 0.316 kg CO₂e/tkm (2017).

## Files
| File | Purpose |
|---|---|
| `taiwan_fertilizer_routes.html` | The interactive map |
| `raster_<code>.png` + `.pgw` | Georeferenced farmland parcel raster per county (EPSG:3826) |
| `all_farmland_nodes.csv` / `.geojson` | 346 township farmland nodes, English names |
| `county_meta.json` | Per-county raster bounds, keyed by English county name |
| `name_translations.csv` | Chinese → English mapping for every supplier, township and county |

Raster letter codes: A Taipei City, B Taichung City, C Keelung City, D Tainan City, E Kaohsiung City, F New Taipei City, G Yilan County, H Taoyuan City, I Chiayi City, J Hsinchu County, K Miaoli County, M Nantou County, N Changhua County, O Hsinchu City, P Yunlin County, Q Chiayi County, T Pingtung County, U Hualien County, V Taitung County.
