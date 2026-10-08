# Historic Panjab — regional map editor

Explore, color, save, and export real administrative-boundary geometries. Existing Punjab, Pakistan Punjab, selected KP, Islamabad, and Chandigarh layers are preserved.

## Run locally

Requires Node.js 22.13 or newer.

    npm ci
    npm run dev -- --port 4545 --host 127.0.0.1

Open [localhost:4545](http://localhost:4545/). Select a state from **More regions** to enable district and tehsil detail and fit its extent. Layers can also be toggled independently. The Tehsils tab groups source subdistrict units, including tehsils, mandals, taluks, talukas, circles, and other state-specific units. Andhra Pradesh's subdistricts are mandals. Area names appear at closer zooms. Tehsils inherit district colors unless painted individually.

## Indian boundary coverage

The additional Indian layers use the [LGD-derived 2024 snapshot published by Bharatlas](https://bharatlas.com/view/lgd_subdistricts), retrieved 8 October 2026. These counts describe available named source areas, **not a complete current administrative register**.

| Region | District polygons | Named subdistrict areas |
| --- | ---: | ---: |
| Haryana | 22 | 81 |
| Himachal Pradesh | 12 | 123 |
| Andhra Pradesh | 26 | 671 mandals |
| Rajasthan | 50 | 314 |
| Uttar Pradesh | 75 | 316 |
| Uttarakhand | 13 | 80 |
| Jammu & Kashmir | 20 | 75 |
| Ladakh | 2 | 6 |
| Arunachal Pradesh | 26 | 185 |
| Assam | 35 | 172 |
| Bihar | 38 | 533 |
| Chhattisgarh | 33 | 164 |
| Goa | 2 | 12 |
| Gujarat | 33 | 252 |
| Jharkhand | 24 | 270 |
| Karnataka | 31 | 234 |
| Kerala | 14 | 76 |
| Madhya Pradesh | 52 | 416 |
| Maharashtra | 36 | 360 |
| Manipur | 16 | 39 |
| Meghalaya | 12 | 39 |
| Mizoram | 11 | 26 |
| Nagaland | 16 | 112 |
| Odisha | 30 | 476 |
| Sikkim | 6 | 9 |
| Tamil Nadu | 38 | 300 taluks |
| Telangana | 33 | 587 mandals |
| Tripura | 8 | 23 |
| West Bengal | 23 | 368 |
| Andaman and Nicobar Islands | 3 | 9 |
| Dadra and Nagar Haveli and Daman and Diu | 3 | 3 |
| Delhi (NCT) | 11 | 34 |
| Lakshadweep | 1 | 10 |
| Puducherry | 4 | 8 |

Rajasthan's district edition and tehsil parent codes are not synchronized: 17 district polygons lack linked subdistrict records. Source parent links are retained, not guessed or spatially split. Arunachal Pradesh's Itanagar capital complex source district has no linked subdistrict records. One unnamed Maharashtra subdistrict record is excluded. These gaps appear in the region cards and Guide; named source records are not fabricated to fill them. Later reorganizations and new tehsils may be absent. Same-parent fragments of Loharu and Bhopalsagar are grouped as multipart areas. The two source Kanth records have different parent districts and remain separate. Named records without LGD codes retain stable source-object IDs; no codes are invented. Unnamed claimed-extent placeholders are excluded from district/tehsil listings.

Provenance, download URLs, coverage gaps, counts, and SHA-256 hashes are in app/indian-region-sources.json. Full source coordinates are retained; MapLibre tiles and generalizes them for interactive display.

## Delhi explorer, finer detail and metro

The **Delhi explorer** at the top of Layers offers Delhi NCT, Old Delhi / New Delhi city focuses, north/east/south/west source district contexts, NDMC, Cantonment, Noida, Gurugram and NCR. City-focus boxes only move the camera; they do not introduce a new boundary. The 2024 revenue source has 11 districts and 34 named subdivision records. [Delhi's government confirms reorganization into 13 districts in December 2025](https://dmnorthwest.delhi.gov.in/); this app does not invent polygons for that newer arrangement. Old Delhi city focus is not the 2026 Old Delhi district.

**Boundary detail → Fine municipal detail** adds 289 named historical areas: 272 MCD wards, 9 NDMC charges and 8 Cantonment charges, from [OpenCity via Bharatlas](https://bharatlas.com/view/wards_delhi), **CC BY-SA 4.0**. One unnamed polygon is excluded. This is not today's 250-ward MCD map, and municipal wards are not revenue subdivisions. Municipal filters, colors, visibility and save/load work independently of revenue layers. Retain the attribution and share-alike license when redistributing this derived layer.

**Delhi NCR** uses the [NCR Planning Board's constituent list and April 2018 map](https://ncrpb.nic.in/ncrconstituent.html): NCT Delhi, 14 Haryana districts, 8 Uttar Pradesh districts and legacy Alwar/Bharatpur in Rajasthan. The displayed extent is an exact union of the app's source polygons; legacy Rajasthan extent is reconstructed from retained subdistrict parent codes rather than guessing membership of newer split districts. **This is a mixed-edition source reconstruction, not a certified current NCR boundary.** NCR view scopes the visible atlas without deleting other regions' saved colors/preferences; choose Regional atlas or another region to leave the scope.

**Show metro lines** enables 11 source line groups (Delhi Metro, Rapid Metro Gurgaon and Noida's Aqua Line), with 293 consolidated station points. Each line has visibility and custom color controls; stations can be hidden. Tracks retain actual OpenStreetMap rail-way coordinates, not straight station-to-station links. Colors, line toggles, stations and the selected Delhi view survive save/load and undo/redo and appear in SVG/PNG/JPG exports. The metro legend is separate from administrative paint groups.

Metro data: [© OpenStreetMap contributors, ODbL-1.0](https://www.openstreetmap.org/copyright), retrieved 8 October 2026. See [Delhi Metro](https://wiki.openstreetmap.org/wiki/Delhi_Metro), [Noida Metro](https://wiki.openstreetmap.org/wiki/Noida_Metro) and the [official DMRC network map](https://delhimetrorail.com/network_map). This is an OSM snapshot, not a live timetable or a guarantee of complete current coverage. Proposed routes, RRTS and suburban rail are excluded. Same-name station points within 150m are consolidated for display, not certified interchanges. Retain OSM attribution and comply with ODbL when redistributing the database. Provenance, source IDs, licenses, processing notes and output hashes are in app/delhi-map-sources.json. Browser rendering uses bundled local GeoJSON; no live OSM request is required.

## Combined Kashmir view

Under **Layers → Kashmir boundary view**, choose **Combined J&K · Indian claimed extent**. This dissolves the published J&K and Ladakh UT outlines into one connected outer boundary. It includes Gilgit-Baltistan, Azad Jammu & Kashmir (PoK), Ladakh, Aksai Chin, and Shaksgam. Default detail is off for these two UTs; their district and tehsil controls can be re-enabled. The shared outline remains visible while Combined is selected; choose Separate to return to independent UT outlines.

This is India's claimed territorial extent. It is **not** an assertion of uncontested sovereignty or present administrative control, nor a survey-accurate cadastral reconstruction of the former princely state. Context labels use [Natural Earth's disputed-area dataset](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-breakaway-disputed-areas/) (public domain). No district or tehsil polygons are invented for territories missing source detail. The option, colors, and detail settings persist through auto-save, manual Save/Load, undo/redo, and exports. Combined exports carry the boundary-view qualification.

The derived outline and context-label provenance are recorded in app/kashmir-view-sources.json. The geometry test verifies an exact union: no source territory is omitted and no extra territory is added.

## Verification and data refresh

    npm run check:boundaries
    npx tsc --noEmit --incremental false
    npx oxlint app/map-model.ts app/map-view.tsx app/extended-editor.tsx app/export-map.ts scripts
    npm run build:vercel
    npm run check:browser
    npm run check:states-browser
    npm run check:delhi-browser

Browser checks require the app running on port 4545 and Chrome installed. The state-layer check isolates each LGD region and verifies district/subdistrict lists, six resources per region, coloring, visibility, persistence, undo/redo, exports, coverage notes and mobile layout; MAP_STATE_IDS can select a comma-separated subset. The Delhi check covers city/NCR presets, historical detail, metro colors/toggles/stations, actual canvas pixels, save/load, undo/redo, SVG/PNG exports and mobile layout. The Kashmir regression check verifies the six previously added regions, actual canvas painting, combined Kashmir rendering, SVG/PNG downloads, auto-save and manual Save/Load, undo/redo, and a mobile viewport. Screenshots and downloads are written to ignored outputs/. Set MAP_TEST_URL to test another server or MAP_BROWSER_CHANNEL for another supported installed browser. The dev watcher excludes generated outputs and source caches to avoid Windows file-lock crashes.

To refresh from upstream (network required):

    npm run data:indian-regions
    npm run data:kashmir-view
    npm run data:delhi
    npm run check:boundaries

The India importer streams large upstream files and caches only selected state features in ignored work/. Per-state cache shards keep a single-state refresh from reparsing the entire atlas. Passing --cache-only refreshes caches without changing application datasets. To reuse manually downloaded full files, pass --raw-dir=work/lgd-downloads with region.geojson, district.geojson and tehsil.geojson in that directory. Passing --regions=in-andhra,in-rajasthan limits generated outputs. Always regenerate the combined Kashmir view after changing either input outline, then review counts and source gaps before committing. Never treat a new download as proof of current completeness.

## Production build

The build:vercel command creates the static application in dist-vercel/, using vercel.json. The preview:vercel command with --port 4546 serves that build for verification. Political boundaries, fonts, and overlay datasets are bundled locally; satellite/terrain/street basemaps need external Esri services. Source and licensing details are also available in the app's **Guide & sources**.
