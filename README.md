# Prabh Map Studio

![Prabh Map Studio — South Asia research atlas, developed and created by Prabhmannat Singh](docs/images/prabh-map-studio-banner.svg)

**Open-source mapping software for South Asia research.**
Developed and created by **Prabhmannat Singh (Prabh)**.

Explore real administrative boundaries, build regional comparisons, style maps,
and export your work for research, education, and geographic exploration. The
atlas includes Punjab, Indian states and union territories, neighbouring South
Asian countries, and documented Tibetan administrative context. Coverage and
source dates vary; the detailed notes below explain what each layer represents.

[Get started](#run-locally) · [Workspace](#workspace-controls) · [Coverage](#indian-boundary-coverage) · [Developer](#developer) · [License](#license)

## What you can do

- **Explore regions:** country, state, district, subdistrict and selected local layers.
- **Build research views:** individual regions, custom combinations, Tricity and editable Historic Punjab context.
- **Style your map:** colors, patterns, labels, borders, legends and map backgrounds.
- **Add context:** cities, rivers, Delhi metro lines and 100 curated gurdwaras, with 57 verified photographs.
- **Keep and share your work:** local autosave, undo/redo, settings files, and PNG, SVG or JPG exports.

## A map made with the studio

![Regional map of Punjab in India and Pakistan, Haryana, Himachal Pradesh and Chandigarh, exported by Prabh Map Studio with district boundaries and a legend](docs/images/research-map.png)

*An actual application export, rendered as a PNG for this README. Colors illustrate
regional groupings; they do not encode a statistical measurement. Source credits
are retained in the image. This is a regional example of the wider atlas.*

## Developer

**Developed and created by Prabhmannat Singh — Prabh.**

Prabh Map Studio is an independent open-source project for research, learning,
and exploring South Asia through maps.

- Developer: [Prabhmannat Singh on GitHub](https://github.com/PRABHMANNAT)
- Source code: [PRABHMANNAT/Historic-Panjab](https://github.com/PRABHMANNAT/Historic-Panjab)
- Feedback and contributions: [GitHub issues](https://github.com/PRABHMANNAT/Historic-Panjab/issues)

The repository keeps its existing `Historic-Panjab` URL. The application is named
**Prabh Map Studio**. Select the logo or open **Guide** in the app for developer
information, usage notes, and source attribution.

## License

Application code and original branding are released under the [MIT License](LICENSE),
Copyright © 2026 Prabhmannat Singh (Prabh). Research is the project's focus; the
software license also permits other uses under its terms.

Geographic datasets, photographs, basemap imagery, fonts, and dependencies retain
their own licenses. See [third-party notices](THIRD_PARTY_NOTICES.md),
[country data licenses](COUNTRY-DATA-LICENSES.txt), [overlay data licenses](OVERLAY-DATA-LICENSES.txt),
and [individual photograph credits](app/gurdwara-photo-sources.json).
Retain the relevant attribution when sharing maps or redistributing assets.

Maps reflect their documented source editions and geographic qualifications.
They are intended to support research and are not certified surveys or a complete
current administrative register.

## Run locally

Requires Node.js 22.13 or newer.

    npm ci
    npm run build:vercel
    npm run preview:vercel -- --port 4545 --strictPort --host 127.0.0.1

This serves the static application used by the local preview. For active
development with the Vinext runtime, use `npm run dev -- --port 4545 --host 127.0.0.1`.
The static build is also available when the Workers development runtime is
unavailable on your machine.

Open [localhost:4545](http://localhost:4545/). Select a state from **Explore a region** to enable district and tehsil detail and fit its extent. Layers can also be toggled independently. The Tehsils tab groups source subdistrict units, including tehsils, mandals, taluks, talukas, circles, and other state-specific units. Andhra Pradesh's subdistricts are mandals. Area names appear at closer zooms. Tehsils inherit district colors unless painted individually.

## Workspace controls

The map occupies the available screen height. Use the navigation rail to open:

- **Layers:** geographic views, countries, Delhi/NCR, region boundaries, Kashmir views, and border visibility. Expand a control group when needed. Search **Regions & boundaries** by name or filter to enabled regions.
- **Style:** paint colors and patterns, opacity, map appearance, and legend settings. The floating tool palette also includes a quick paint color picker.
- **Areas:** search and filter individual areas, then color, focus, or hide them.
- **Overlays:** cities, rivers, historic gurdwaras, and administrative labels.

Hide the inspector with the panel button for a wider map; selecting any rail section reopens it. On small screens, controls open below the map and can be closed to recover map space. **Quick views** contains the regional shortcuts, and the background selector at the upper right contains Political, Satellite, Physical, Rivers, Streets, and Cities.

**Export map** opens format, extent, and resolution settings. Choose PNG, SVG, or JPG, then Download. Save/Load, local auto-save, history, keyboard shortcuts, and the existing map editing behavior are retained. **Guide** contains coverage notes and source attribution.

Run `npm run check:workspace-browser` with the app on port 4545 for the workspace layout/navigation regression. The existing geographic browser checks also use the new navigation and export dialog.

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

The **Delhi explorer** in **Layers → Delhi & NCR** offers Delhi NCT, Old Delhi / New Delhi city focuses, north/east/south/west source district contexts, NDMC, Cantonment, Noida, Gurugram and NCR. City-focus boxes only move the camera; they do not introduce a new boundary. The 2024 revenue source has 11 districts and 34 named subdivision records. [Delhi's government confirms reorganization into 13 districts in December 2025](https://dmnorthwest.delhi.gov.in/); this app does not invent polygons for that newer arrangement. Old Delhi city focus is not the 2026 Old Delhi district.

**Boundary detail → Fine municipal detail** adds 289 named historical areas: 272 MCD wards, 9 NDMC charges and 8 Cantonment charges, from [OpenCity via Bharatlas](https://bharatlas.com/view/wards_delhi), **CC BY-SA 4.0**. One unnamed polygon is excluded. This is not today's 250-ward MCD map, and municipal wards are not revenue subdivisions. Municipal filters, colors, visibility and save/load work independently of revenue layers. Retain the attribution and share-alike license when redistributing this derived layer.

**Delhi NCR** uses the [NCR Planning Board's constituent list and April 2018 map](https://ncrpb.nic.in/ncrconstituent.html): NCT Delhi, 14 Haryana districts, 8 Uttar Pradesh districts and legacy Alwar/Bharatpur in Rajasthan. The displayed extent is an exact union of the app's source polygons; legacy Rajasthan extent is reconstructed from retained subdistrict parent codes rather than guessing membership of newer split districts. **This is a mixed-edition source reconstruction, not a certified current NCR boundary.** NCR view scopes the visible atlas without deleting other regions' saved colors/preferences; choose Regional atlas or another region to leave the scope.

**Show metro lines** enables 11 source line groups (Delhi Metro, Rapid Metro Gurgaon and Noida's Aqua Line), with 293 consolidated station points. Each line has visibility and custom color controls; stations can be hidden. Tracks retain actual OpenStreetMap rail-way coordinates, not straight station-to-station links. Colors, line toggles, stations and the selected Delhi view survive save/load and undo/redo and appear in SVG/PNG/JPG exports. The metro legend is separate from administrative paint groups.

Metro data: [© OpenStreetMap contributors, ODbL-1.0](https://www.openstreetmap.org/copyright), retrieved 8 October 2026. See [Delhi Metro](https://wiki.openstreetmap.org/wiki/Delhi_Metro), [Noida Metro](https://wiki.openstreetmap.org/wiki/Noida_Metro) and the [official DMRC network map](https://delhimetrorail.com/network_map). This is an OSM snapshot, not a live timetable or a guarantee of complete current coverage. Proposed routes, RRTS and suburban rail are excluded. Same-name station points within 150m are consolidated for display, not certified interchanges. Retain OSM attribution and comply with ODbL when redistributing the database. Provenance, source IDs, licenses, processing notes and output hashes are in app/delhi-map-sources.json. Browser rendering uses bundled local GeoJSON; no live OSM request is required.

## Neighbouring countries and Tibetan context

Under **Layers → Countries & Tibetan context**, select a country to scope and fit
the map. Province/regional, district and local-unit layers have independent
switches. Use the province selector to zoom, or the Areas tab to search, paint,
hide and focus individual polygons. Province colors flow to districts and local
units unless overridden; hiding a parent hides its descendants. These settings
survive auto-save, Save/Load and undo/redo. New countries start off in the regional
atlas to avoid loading all detailed datasets at once.

| Source country/context | Province / regional units | District / equivalent | Local-unit polygons |
| --- | ---: | ---: | ---: |
| Nepal (2024) | 7 provinces | 77 districts | 775 source local units |
| Bangladesh (2023) | 8 divisions | 64 districts | 507 upazila / city areas |
| Bhutan (2020) | No separate tier | 20 dzongkhags | 205 gewogs |
| Sri Lanka (2022) | 9 provinces | 25 districts | 339 DS divisions |
| Maldives (2024) | No separate tier | 21 atoll / city areas | 1,556 source island areas |
| Myanmar (2024) | 18 state / region / special areas | 80 districts | 330 townships |
| Afghanistan (2025) | 34 provinces | 401 mapped districts | Not supplied |
| Pakistan (2022) | 7 province / territory areas | 160 districts | 577 tehsils |
| Tibet AR (2023 / 2017) | 1 modern AR | 7 prefectures / cities | 78 county source areas |
| Qinghai (2023 / 2017) | 1 modern province | 8 prefectures / cities | 41 county source areas |
| Sichuan (2023 / 2017) | 1 modern province | 21 prefectures / cities | 158 county source areas |

Counts describe **published source records, not complete current registers**.
Nepal's 775 records are not a claim about its current municipality count.
Bangladesh includes 495 upazilas and 12 city corporations. Maldives island areas
include non-inhabited source areas, not 1,556 inhabited islands. Afghanistan's
humanitarian source notes 457 designated units but supplies only 401 mapped
districts; deeper subdivisions are not invented. Bhutan and Maldives do not
receive a fictional province tier.

Pakistan's seven records include four provinces, Islamabad, and
Pakistan-administered Azad Kashmir and Gilgit-Baltistan; seven constitutional
provinces or settled sovereignty are not asserted. While full-country coverage is
enabled, it takes precedence over the separately edited Punjab/Lahore, selected-KP
and Islamabad editions. Disabling it restores those saved layers and colors.

The **Tibet + Qinghai + Sichuan · modern administrative context** option is an exact
union of the three source provincial outlines. It is **not** a traditional
Ü-Tsang / Amdo / Kham reconstruction or an exact Greater Tibet boundary: all Qinghai
and Sichuan territory is included, including non-Tibetan areas. Source extents
do not resolve territorial disputes.

Chinese province/prefecture geometry uses the simplified 2023
[cn-atlas](https://github.com/BarbarossaWang/cn-atlas) source (Amll, ISC), derived from
[CTAmap](https://github.com/ruiduobao/shengshixian.com) (Rui Cheng, MIT). County
polygons use the 2017 [geoBoundaries](https://www.geoboundaries.org/) CHN ADM2 source
(National Administration of Surveying, Mapping and Geoinformation /
Revolutionary GIS, PDDL-1.0). County membership and prefecture parents are derived
from interior-label-point containment, **not official code joins**. County
geometry is retained without spatial splits; this mixed-edition association may
disagree with current administrative membership.

The eight country hierarchies use [OCHA/HDX COD-AB](https://data.humdata.org/dashboards/cod)
snapshots, **CC BY-IGO**, with explicit source parent codes. Attribution, dates,
download URLs, source hashes, notes and geometry/label output hashes are in
app/neighbour-country-sources.json. License notices are retained in
COUNTRY-DATA-LICENSES.txt. The app Guide and exports include source credits.
No live boundary service is needed for display.

Import scripts use reviewed local source caches under ignored work/:
work/hdx-ISO-metadata.json, work/country-sources/ISO/ISO_adminN.geojson
(Pakistan: work/pakistan-admin-source/), work/cn-atlas-provinces.json,
work/cn-atlas-prefectures.json, work/cn-atlas-package.json,
work/china-ADM2.geojson and work/geoboundaries-CHN-metadata.json.
Download URLs and expected source hashes are retained in the manifest.
Run npm run data:neighbour-countries (optionally -- --countries=npl,bgd), then
npm run data:tibet-context and npm run check:boundaries. Review changed licenses,
editions, counts and source gaps before using new downloads.

## Map scopes, Pakistan divisions and place overlays

**Layers → Map views & combinations** offers enabled-layer atlas, full available
map, individual state/territory/country, custom combinations, Chandigarh Tricity
and user-editable Historic Punjab context. Individual views draw only the selected
geography while preserving other regions' colors. Region controls still select
district, tehsil/subdivision and historical ward detail. Full map starts with 47
non-overlapping source-region outlines; **Include enabled detail layers** follows
saved detail preferences instead of downloading all subdivisions automatically.

Tricity uses Chandigarh, S A S Nagar (Mohali) district and Panchkula district, as
identified by [SAS Nagar Police](https://sasnagar.punjabpolice.gov.in/about_sas_nagar.php).
This is administrative district context, **not an exact urban or planning boundary**.
The initial custom Historic Punjab selection is Indian/Pakistani Punjab, Haryana,
Himachal Pradesh and Chandigarh. Edit its included regions freely; it is modern
context, **not a dated historical province or Sikh Empire reconstruction**.
Scope settings, paints and qualifications persist into saved files and exports.

The full Pakistan layer now includes **36 source-era division outlines**: Punjab 9,
Sindh 6, Balochistan 8, KP 7, Pakistan-administered AJK 3 and GB 3. Their geometries are
exact unions of 159 WFP/OCHA 2022 district polygons. Islamabad has no invented
division. Membership uses the [PBS list frozen 1 March 2023](https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf),
with documented Lehri/Sibi and GB edition reconciliations. West Karachi retains
the source's unsplit Keamari area. These are **not guaranteed current 2026 divisions**.
Sources, individual crosswalks, qualifications and hashes are in
app/pakistan-division-sources.json. Province, division, district and tehsil controls
are independent; the Areas tab exposes all 36 named division outlines.

**Overlays → Cities, rivers & Sikh heritage** adds 447 Natural Earth settlement points and 155
generalized river records (public domain). By default 353 source major/capital
points qualify before geographic filtering. Set a population threshold, show all
source settlements, use automatic city marker colors or a custom highlight.
**Auto-color major-city districts** changes only the containing visible districts;
it does not invent municipal city polygons. The most populous source city wins
when several fall in one district. This is undoable. Population estimates are
archival, not a current census. Rivers have color, width and name controls. Points
are filtered to selected source polygons and displayed/exported rivers are clipped
to their union, including holes; bundled original geometry remains unchanged.
Provenance and hashes are in app/atlas-overlay-sources.json.

**Show historic gurdwaras** displays 100 curated named shrines: the 5 Takhts,
15 additional editorial featured sites (including Harmandir/Golden Temple,
Fatehgarh Sahib and Jyoti Sarup Sahib), and 80 other historic/notable sites.
Filter tiers, change label visibility and photo marker size/frame color, or locate
a shrine with the 100-site picker. The 5 Takhts, all 15 featured sites, and additional
historic sites use photographs in rounded frames. Click a marker for its full photo
and source credits. Sites without a verified reusable photograph have an explicit
"Photo unavailable" badge. Photographs are stored locally and embedded in exports;
authors, individual licenses, source links and file hashes are recorded in
`app/gurdwara-photo-sources.json` and linked from the Guide. Run
`npm run check:gurdwara-photos` to verify the assets and photo marker rendering.
The collection is not an objective ranking or a complete global register.
Published OSM/Wikidata representative points are not surveyed entrances.
Geographic scope still applies to shrines. Identity references, coordinate evidence,
licenses and hashes are in app/gurdwara-sources.json; the location database is
distributed under ODbL 1.0 with OSM attribution and Wikidata CC0 provenance.

## Combined Kashmir view

Under **Layers → Kashmir boundary view**, choose **Combined J&K · Indian claimed extent**. This dissolves the published J&K and Ladakh UT outlines into one connected outer boundary. It includes Gilgit-Baltistan, Azad Jammu & Kashmir (PoK), Ladakh, Aksai Chin, and Shaksgam. Default detail is off for these two UTs; their district and tehsil controls can be re-enabled. The shared outline remains visible while Combined is selected; choose Separate to return to independent UT outlines.

This is India's claimed territorial extent. It is **not** an assertion of uncontested sovereignty or present administrative control, nor a survey-accurate cadastral reconstruction of the former princely state. Context labels use [Natural Earth's disputed-area dataset](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-breakaway-disputed-areas/) (public domain). No district or tehsil polygons are invented for territories missing source detail. The option, colors, and detail settings persist through auto-save, manual Save/Load, undo/redo, and exports. Combined exports carry the boundary-view qualification.

The derived outline and context-label provenance are recorded in app/kashmir-view-sources.json. The geometry test verifies an exact union: no source territory is omitted and no extra territory is added.

## Verification and data refresh

    npm run check:boundaries
    npm run check:atlas
    npx tsc --noEmit --incremental false
    npx oxlint app/map-model.ts app/map-view.tsx app/extended-editor.tsx app/export-map.ts scripts
    npm run build:vercel
    npm run check:browser
    npm run check:states-browser
    npm run check:delhi-browser
    npm run check:countries-browser
    npm run check:atlas-browser

The country check isolates all 11 country/modern-context entries and the combined
three-province view. It verifies available hierarchy levels, loaded resources,
inherited geometry colors on map-only canvas pixels, recursive hiding,
undo/redo, source-attributed SVG/PNG exports, Save/Load, reload and mobile layout.
Use MAP_COUNTRY_IDS for a comma-separated subset. Repeated place names are
distinguished by their source IDs.

Browser checks require the app running on port 4545 and Chrome installed. The state-layer check isolates each LGD region and verifies district/subdistrict lists, six resources per region, coloring, visibility, persistence, undo/redo, exports, coverage notes and mobile layout; MAP_STATE_IDS can select a comma-separated subset. The Delhi check covers city/NCR presets, historical detail, metro colors/toggles/stations, actual canvas pixels, save/load, undo/redo, SVG/PNG exports and mobile layout. The Kashmir regression check verifies the six previously added regions, actual canvas painting, combined Kashmir rendering, SVG/PNG downloads, auto-save and manual Save/Load, undo/redo, and a mobile viewport. Screenshots and downloads are written to ignored outputs/. Set MAP_TEST_URL to test another server or MAP_BROWSER_CHANNEL for another supported installed browser. The dev watcher excludes generated outputs and source caches to avoid Windows file-lock crashes.

To refresh from upstream (network required):

    npm run data:indian-regions
    npm run data:kashmir-view
    npm run data:delhi
    npm run check:boundaries

The India importer streams large upstream files and caches only selected state features in ignored work/. Per-state cache shards keep a single-state refresh from reparsing the entire atlas. Passing --cache-only refreshes caches without changing application datasets. To reuse manually downloaded full files, pass --raw-dir=work/lgd-downloads with region.geojson, district.geojson and tehsil.geojson in that directory. Passing --regions=in-andhra,in-rajasthan limits generated outputs. Always regenerate the combined Kashmir view after changing either input outline, then review counts and source gaps before committing. Never treat a new download as proof of current completeness.

## Production build

The build:vercel command creates the static application in dist-vercel/, using vercel.json. The preview:vercel command with --port 4546 serves that build for verification. Political boundaries, fonts, and overlay datasets are bundled locally; satellite/terrain/street basemaps need external Esri services. Source and licensing details are also available in the app's **Guide & sources**.
