import {countries,countryViews,layerLabel,areasByLayer} from './map-model';

export default function CountryGuide(){
 return <section aria-label="Country boundary sources">
  <h3>Neighbouring countries: provinces, districts & local units</h3>
  <p>Choose a country under Layers → Countries & Tibetan context. Provinces, districts and subdivisions can be shown independently. Province colors flow to their districts and local units unless those areas have their own colors; hiding a parent also hides its descendants. Save/Load, auto-save and undo/redo retain these settings.</p>
  <p>These are published source snapshots, not complete current registers. Bhutan and Maldives have no invented province tier; Afghanistan has no invented layer below the supplied districts. The Tehsils list groups source-specific local units, not equivalent legal units across countries.</p>
  <ul>{countries.map(c=><li key={c.id}><b>{c.name}:</b> {(['province','district','tehsil'] as const).filter(level=>areasByLayer.has(c.id+'-'+level)).map(level=>areasByLayer.get(c.id+'-'+level)!.length+' '+layerLabel(c.id,level).toLowerCase()).join(' · ')}. Edition: {c.validOn.join(', ')}. {c.notes} <a href={c.url} target="_blank" rel="noreferrer">{c.source}</a> · <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a>. Retrieved {c.retrieved}.</li>)}</ul>
  <p>Full Pakistan source coverage takes precedence over the separate Punjab/Lahore, selected-KP and Islamabad layers while enabled. Their saved preferences and colors are preserved. Source extents may overlap disputed-area claims; they do not resolve sovereignty or certify present control.</p>
  <h3>Tibet & the modern three-province context</h3>
  {countryViews.map(v=><p key={v.id}><b>{v.name}:</b> {v.qualification}</p>)}
  <p>Chinese province/prefecture outlines retain the simplified 2023 cn-atlas / CTAmap source coordinates. County polygons retain the 2017 geoBoundaries source coordinates. County parents are derived using interior-label-point containment in newer prefectures, not authoritative code joins. This mixed-edition association may disagree with current administrative boundaries. All Tibet AR, Qinghai and Sichuan territory is included in the combined modern view, including areas outside traditional Tibetan regions.</p>
  <p>China context credits: Amll, cn-atlas (ISC); Rui Cheng, CTAmap (MIT); National Administration of Surveying, Mapping and Geoinformation / Revolutionary GIS via <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a> (PDDL-1.0 county data). The repository retains license notices. Retain source attribution and applicable licenses when redistributing derived datasets.</p>
 </section>;
}
