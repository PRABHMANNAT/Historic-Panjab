'use client';
import {useState} from 'react';
import {findAreas,addArea,areaContext} from './area-search-model';
import {Search,Plus,MapPinned,X} from 'lucide-react';
import {areaById,areasByLayer,countries,layerLabel,type Area,type MapDoc} from './map-model';
import {scopeRegions,scopePreset,scopeFocusBounds,selectionAreas,areaBelongsTo,scopeGeometryAreas,scopeLabel} from './scope-model';

const india=scopeRegions.filter(r=>r.id.startsWith('in-')||r.id==='chandigarh').map(r=>r.id);
const china=scopeRegions.filter(r=>r.id.startsWith('cn-')).map(r=>r.id);
const countryGroups=[{id:'india',name:'India',regions:india},{id:'china',name:'China · available regions',regions:china},...countries.filter(c=>c.iso!=='chn').map(c=>({id:c.id,name:c.name,regions:[c.id]})),{id:'pakistan-local',name:'Pakistan · local detail snapshots',regions:['pk-punjab','pk-kp','islamabad']}];
type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void};
export default function GeographyPicker({doc,onChange,onFit}:Props){
 const initialArea=scopeGeometryAreas(doc)[0];
 const [country,setCountry]=useState(()=>countryGroups.find(c=>c.regions.includes(initialArea?.region))?.id||'india');
 const [region,setRegion]=useState(''),[province,setProvince]=useState(''),[division,setDivision]=useState(''),[district,setDistrict]=useState(''),[local,setLocal]=useState(''),[query,setQuery]=useState('');
 const group=countryGroups.find(c=>c.id===country)!;
 const regionId=group.regions.length===1?group.regions[0]:region;
 const byLevel=(level:string)=>areasByLayer.get(regionId+'-'+level)||[];
 const provinces=byLevel('province'),divisions=byLevel('division').filter(a=>!province||areaBelongsTo(a,province));
 const districts=byLevel('district').filter(a=>(!province||areaBelongsTo(a,province))&&(!division||areaBelongsTo(a,division)));
 const locals=district?byLevel('tehsil').filter(a=>areaBelongsTo(a,district)):[];
 const target=local||district||division||province||regionId;
 const targetIds=target?[target]:group.regions;
 const selected=doc.mapScope==='selection'?selectionAreas(doc):scopeGeometryAreas(doc);
 const results=query.trim().length>=2?findAreas(query).slice(0,35):[];
 function searchApply(a:Area,only=false){const patch=addArea(doc,a.id,only);onChange(patch);const b=scopeFocusBounds({...doc,...patch});if(b)onFit(b);}
 function apply(ids:string[],add=false){
  const requested=add?[...selected.map(a=>a.id),...ids]:ids;
  const patch=scopePreset(doc,'selection',{scopeAreas:requested});
  // Normalize ancestor + child selections so one area is not rendered twice.
  patch.scopeAreas=selectionAreas({...doc,...patch}).map(a=>a.id);
  onChange(patch);const b=scopeFocusBounds({...doc,...patch});if(b)onFit(b);
 }
 function selectField(label:string,value:string,options:Area[],onSelect:(id:string)=>void,empty:string){return options.length>0&&<label className="field">{label}<select aria-label={label} value={value} onChange={e=>onSelect(e.target.value)}><option value="">{empty}</option>{[...options].sort((a,b)=>a.name.localeCompare(b.name)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>;}
 return <div className="geography-picker">
  <p className="muted">Current view: <strong>{scopeLabel(doc)}</strong></p>
  <label className="field">Country / source coverage<select aria-label="Choose country" value={country} onChange={e=>{setCountry(e.target.value);setRegion('');setProvince('');setDivision('');setDistrict('');setLocal('');setQuery('');}}>{countryGroups.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  {group.regions.length>1&&selectField('State / territory',region,group.regions.map(id=>areaById.get(id)!).filter(Boolean),id=>{setRegion(id);setProvince('');setDivision('');setDistrict('');setLocal('');},'All available regions')}
  {selectField('Province / first-level unit',province,provinces,id=>{setProvince(id);setDivision('');setDistrict('');setLocal('');},'Whole country')}
  {selectField('Division',division,divisions,id=>{setDivision(id);setDistrict('');setLocal('');},'All divisions')}
  {selectField('District / second-level unit',district,districts,id=>{setDistrict(id);setLocal('');},'All districts')}
  {selectField('Local subdivision',local,locals,setLocal,'All subdivisions')}
  <div className="geography-actions"><button className="primary" onClick={()=>apply(targetIds)}><MapPinned size={14}/> Show only this</button><button onClick={()=>apply(targetIds,true)}><Plus size={14}/> Add to group</button></div>
  <div className="search"><Search size={14}/><input aria-label="Search geographic areas" placeholder="Search the whole atlas…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {query.trim().length>=2&&<div className="geography-results" aria-label="Geographic search results">{results.map(a=><div key={a.id}><button onClick={()=>searchApply(a,true)}><strong>{a.name}</strong><small>{a.level} · {areaContext(a)}</small></button><button aria-label={'Add '+a.name+' to group'} onClick={()=>searchApply(a)}><Plus size={14}/></button></div>)}{!results.length&&<p>No matching source areas.</p>}{results.length===35&&<p className="muted">Showing the first 35 matches. Refine your search.</p>}</div>}
  {doc.mapScope==='selection'&&<div className="geography-selection"><strong>On your map · {selected.length}</strong><div className="geography-chips">{selected.map(a=><span key={a.id}>{a.name}<button aria-label={'Remove '+a.name+' from selection'} onClick={()=>apply(selected.filter(v=>v.id!==a.id).map(v=>v.id))}><X size={12}/></button></span>)}</div>{!selected.length&&<p className="muted">Choose an area above to begin.</p>}
   <div className="scope-detail-levels">{(['province','division','district','tehsil','uc'] as const).map(level=>{const ids=[...new Set(selected.map(a=>a.region))].filter(id=>areasByLayer.has(id+'-'+level));if(!ids.length)return null;const on=ids.every(id=>doc.regions[id][level]);return <button key={level} aria-pressed={on} onClick={()=>onChange({regions:{...doc.regions,...Object.fromEntries(ids.map(id=>[id,{...doc.regions[id],[level]:!on}]))}})}>{level==='division'?'Divisions':level==='uc'?'Local wards':ids.length===1?layerLabel(ids[0],level):level==='province'?'Provinces':level==='district'?'Districts':'Subdivisions'}</button>;})}</div>
   <button onClick={()=>onChange({title:selected.length===1?selected[0].name:'Selected territories'})}>Use selection as map title</button>
  </div>}
  <p className="muted">“Show only this” isolates the selected boundaries. “Add to group” combines areas across countries. Detail follows the supplied source edition; a parent selection includes its children.</p>
 </div>;
}
