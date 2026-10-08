# Third-party data and assets

Prabh Map Studio's [MIT license](LICENSE) covers the application code and original
branding. It does not replace the licenses or attribution requirements of the
following third-party materials. Existing copyright notices remain applicable.

| Material | License / terms and provenance |
| --- | --- |
| Country boundaries and regional context | [Country data notices](COUNTRY-DATA-LICENSES.txt) and [source manifest](app/neighbour-country-sources.json); includes CC BY-IGO, ISC, MIT and PDDL sources. |
| Indian administrative boundaries | [Indian source manifest](app/indian-region-sources.json), plus the Esri India and Punjab source links documented in the [README](README.md#indian-boundary-coverage) and app Guide. Retain each provider's terms. |
| Delhi wards and metro | [Delhi source manifest](app/delhi-map-sources.json); ward data CC BY-SA 4.0, OpenStreetMap metro data ODbL 1.0. |
| Cities, rivers and gurdwara locations | [Overlay notices](OVERLAY-DATA-LICENSES.txt); Natural Earth public-domain data and the ODbL gurdwara location database with Wikidata CC0 contributions. |
| Expanded river network, mountains, plateaus and tree cover | [Nature data notices](NATURE-DATA-LICENSES.md); RiverATLAS and ESA WorldCover 2021 under CC BY 4.0, Natural Earth landforms in the public domain. The tree-cover layer is a cartographic overview, not an analytical forest inventory. |
| Gurdwara photographs | [Individual photo credits, licenses and source URLs](app/gurdwara-photo-sources.json). Each photograph retains its stated Creative Commons or public-domain terms. Rounded map-marker crops are display adaptations; source photographs are credited in the Guide and exports. |
| Supplied 300-entry gurdwara directory | [Imported directory](app/gurdwara-directory.json) and [original Markdown](docs/data/south-asia-gurdwaras-300.md), supplied by the project owner, compiled 8 October 2026. Source references and uncertainty notes are retained; cited source material retains its own terms. The application's MIT license does not relicense third-party source material. Null coordinates are preserved; [additional OSM/Wikidata coordinate evidence](app/gurdwara-addition-sources.json) is separately documented under the location database terms. |
| Basemap imagery | External provider terms and attributions shown by the map; these images are not relicensed under MIT. |
| Bundled font glyphs and software dependencies | Their upstream licenses continue to apply. Glyph files in `public/` are not relicensed under MIT. Dependency versions are recorded in `package-lock.json`; consult the license files in each upstream distribution. |

## Documentation images

- `docs/images/prabh-map-studio-banner.svg` and `public/brand/prabh-mark.svg`:
  original Prabh Map Studio artwork, Copyright © 2026 Prabhmannat Singh, MIT.
- `docs/images/research-map.png`: a raster preview of an actual application SVG
  export. Its geographic-source attribution is embedded in the image. Example
  colors are illustrative and do not encode a statistical measurement.
- The six regional gallery PNGs in `docs/images/` are also actual application
  exports. [Gallery provenance](docs/images/gallery-provenance.json) records their
  coverage and source-edition notes. Geographic-source credits remain embedded.
  `delhi-municipal.png` uses OpenCity/Bharatlas historical ward data under
  **CC BY-SA 4.0**; that license and attribution continue to apply to this preview.
- `docs/images/delhi-satellite.jpg`: a static documentation map composed from
  Esri World Imagery and the app's LGD 2024 Delhi boundary files. Imagery credit:
  **Esri, Vantor, Earthstar Geographics, and the GIS User Community**. Imagery
  remains subject to the [provider's terms](https://goto.arcgisonline.com/maps/World_Imagery)
  and is not relicensed under MIT. The image includes visible attribution;
  service URL, returned extent and retrieval date are in the gallery provenance.

Keep the relevant data and photo credits when sharing exports or redistributing
assets. Research use is the project's focus; the MIT software license does not
impose a research-only restriction.
