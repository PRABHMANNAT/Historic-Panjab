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
| Gurdwara photographs | [Individual photo credits, licenses and source URLs](app/gurdwara-photo-sources.json). Each photograph retains its stated Creative Commons or public-domain terms. Rounded map-marker crops are display adaptations; source photographs are credited in the Guide and exports. |
| Basemap imagery | External provider terms and attributions shown by the map; these images are not relicensed under MIT. |
| Bundled font glyphs and software dependencies | Their upstream licenses continue to apply. Glyph files in `public/` are not relicensed under MIT. Dependency versions are recorded in `package-lock.json`; consult the license files in each upstream distribution. |

## Documentation images

- `docs/images/prabh-map-studio-banner.svg` and `public/brand/prabh-mark.svg`:
  original Prabh Map Studio artwork, Copyright © 2026 Prabhmannat Singh, MIT.
- `docs/images/research-map.png`: a raster preview of an actual application SVG
  export. Its geographic-source attribution is embedded in the image. Example
  colors are illustrative and do not encode a statistical measurement.

Keep the relevant data and photo credits when sharing exports or redistributing
assets. Research use is the project's focus; the MIT software license does not
impose a research-only restriction.
