# Natural-feature data licenses

These data retain their own licenses. The application's MIT license does not
replace them. Administrative boundary files were not modified for this feature.

## River network — RiverATLAS v1.0

- Provider: HydroATLAS, https://www.hydrosheds.org/hydroatlas.
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- Citation: Linke, S., Lehner, B., Ouellet Dallaire, C., Ariwi, J., Grill, G.,
  Anand, M., Beames, P., Burchard-Levine, V., Maxwell, S., Moidu, H., Tan, F.,
  Thieme, M. (2019). Global hydro-environmental sub-basin and river reach
  characteristics at high spatial resolution. Scientific Data 6:283.
  https://doi.org/10.1038/s41597-019-0300-6.
- Original archive: https://ndownloader.figshare.com/files/20087486.
- Derived files: `public/data/river-network/*.geojson`.
- Changes: Asia and Europe/Middle East reaches intersecting 60°E–109°E,
  1°S–40°N; Strahler order ≥3; only map attributes retained; coordinates rounded
  to six decimal places; duplicated across intersecting 5° packaging tiles.
  Rendering deduplicates reaches and clips copies to the user's selected areas.
- Resolution: derived from HydroSHEDS at 15 arc-seconds (~500 m). No claim of
  surveyed river positions, complete small streams, canals or current flow.
  Reach names are not supplied; optional labels use separate Natural Earth data.
- Provenance, input geometry/attribute hashes and output hashes:
  [river-network-sources.json](app/river-network-sources.json).

These files were derived from the **CC BY 4.0 RiverATLAS archive**, rather than
redistributed from the separately licensed HydroRIVERS download.

## Mountains and plateaus — Natural Earth

- Source: [1:10m physical label areas](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/).
- License: [Public domain](https://www.naturalearthdata.com/about/terms-of-use/).
- Derived file: `public/data/landforms.geojson`; selected Range/mtn, Foothills and
  Plateau features intersecting the atlas extent, with original coordinates.
- Named physical regions have approximate boundaries. They are not elevation
  contours or suitable for quantitative landform boundary analysis.

## Forest / tree-cover overview — ESA WorldCover 2021

- Source: [ESA WorldCover 2021 v200](https://esa-worldcover.org/en/data-access),
  served by the published Terrascope WMS.
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- Required map attribution: **© ESA WorldCover project 2021 / Contains modified
  Copernicus Sentinel data (2021) processed by ESA WorldCover consortium**.
- Dataset citation: Zanaga, D., Van De Kerchove, R., Daems, D., et al. (2022).
  ESA WorldCover 10 m 2021 v200. https://doi.org/10.5281/zenodo.7254221.
- Derived file: `public/data/tree-cover.png`, a **cartographic RGB overview**
  derived from 16 published WMS images in Web Mercator. Green tree-cover pixels
  are retained as an alpha mask (R/B ≤15, G 35–130); other classes become
  transparent. The app recolors and clips this mask for display and export.
- Output: 4096×4096 pixels over 60°E–109°E, 1°S–40°N, approximately 1.3 km map
  pixels. **This is not the analytical 10 m classification grid.** Small woods
  and mixed overview pixels may be absent; tree cover can include plantations.
  Do not use this cartographic derivative for forest-area measurement.
- WMS request URLs, source image checksums, dimensions, extent and output hash:
  [nature-sources.json](app/nature-sources.json).

## Rebuilding

`node scripts/fetch-riveratlas.mjs` downloads only the two required regions from
the official global archive and streams down the attribute tables. Then run
`node scripts/build-river-network.mjs`.

For landforms, place `ne_10m_geography_regions_polys.geojson` from Natural Earth
revision `ca96624a56bd078437bca8184e78163e5039ad19` at
`work/ne-physical-regions.geojson`. Run `node scripts/build-nature-data.mjs`; it
also fetches/caches the ESA WMS overview inputs. Run `npm run check:nature` to
verify hashes, clipping, geographic selections and an actual export.

The README's `docs/images/maharashtra-nature.png` is rendered from an actual SVG
export. It includes the above natural-feature credits and the existing LGD/
Bharatlas administrative-boundary credits. Source licenses continue to apply.
