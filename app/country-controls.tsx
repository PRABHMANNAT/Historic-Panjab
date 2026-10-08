'use client';
import {areasByLayer,countries,countryById,countryViews,countryViewById,countryPreset,countryFocusBounds,layerLabel,type MapDoc} from './map-model';

type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void};
export default function CountryControls({doc,onChange,onFit}:Props){
 const context=countryViewById.get(doc.countryView),source=countryById.get(doc.countryView);
 const ids=context?.regionIds||(source?[source.id]:[]);
 const provinceOptions=ids.flatMap(id=>areasByLayer.get(id+'-province')||areasByLayer.get(id+'-district')||[]);
 function choose(id:string){onChange(countryPreset(doc,id));onFit(countryFocusBounds(id));}
 return <section className="country-controls" aria-labelledby="country-heading">
  <h2 id="country-heading">Countries & Tibetan context</h2>
  <label className="field">Map scope<select aria-label="Country map view" value={doc.countryView} onChange={e=>choose(e.target.value)}><option value="">Regional atlas · leave country scope</option><optgroup label="Country / modern administrative maps">{countries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup><optgroup label="Combined source view">{countryViews.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</optgroup></select></label>
  {ids.length>0&&<>
   <label className="field">Focus a province / regional unit<select aria-label="Focus a province or regional unit" value="" onChange={e=>{const area=provinceOptions.find(a=>a.id===e.target.value);if(area)onFit(area.bbox);}}><option value="">Choose a source area…</option>{provinceOptions.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   <div className="country-detail-controls">{(['province','district','tehsil'] as const).map(level=>{const available=ids.filter(id=>areasByLayer.has(id+'-'+level));if(!available.length)return null;const checked=available.every(id=>doc.regions[id][level]);return <label key={level}><input type="checkbox" aria-label={'Country '+level+' layer'} checked={checked} onChange={e=>onChange({regions:{...doc.regions,...Object.fromEntries(available.map(id=>[id,{...doc.regions[id],[level]:e.target.checked}]))}})}/>{source?layerLabel(source.id,level):level==='province'?'Province / AR boundaries':level==='district'?'Prefectures / cities':'County source areas'}</label>;})}</div>
   <button onClick={()=>onFit(countryFocusBounds(doc.countryView))}>Fit selected country / context</button>
  </>}
  <p className="muted">Explore provinces, districts and local subdivisions with source-specific names. Newly added countries are off in the general atlas until enabled. Selecting a country scopes the map without deleting other regions’ colors or preferences.</p>
  {source&&<p className="coverage-warning">{source.notes}</p>}
  {context&&<p className="coverage-warning">{context.qualification}</p>}
  {doc.countryView==='pk-country'&&<p className="muted">Full-country 2022 coverage takes precedence over the separate Punjab/Lahore, selected-KP and Islamabad layers. Disable the full-country region to reveal those saved detail layers again.</p>}
 </section>;
}
