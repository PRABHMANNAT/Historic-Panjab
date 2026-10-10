'use client';

import {useRef,useState} from 'react';
import {Layers,MapPinned,Search,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {regions,regionById,type MapDoc} from './map-model';
import {scopeRegions,scopeGeometryAreas,scopePreset,scopeFocusBounds} from './scope-model';

const groups=['India · states & territories','Pakistan · country & local snapshots','China · available regions','Other countries'];
const options=scopeRegions.map(region=>({
 ...region,
 name:regionById.get(region.id)?.name||region.name,
 group:region.id.startsWith('in-')||region.id==='chandigarh'?groups[0]:region.id.startsWith('pk-')||region.id==='islamabad'?groups[1]:region.id.startsWith('cn-')?groups[2]:groups[3],
})).sort((a,b)=>a.name.localeCompare(b.name));
const punjabHaryanaDelhi=['in-punjab','in-haryana','in-delhi'];

type Props={doc:MapDoc;onExplore:(id:string)=>void;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void};

export default function RegionExplorer({doc,onExplore,onChange,onFit}:Props){
 const [open,setOpen]=useState(false);
 const selectRef=useRef<HTMLSelectElement>(null);
 function apply(ids:string[]){
  const patch=scopePreset(doc,'combination',{scopeRegions:ids});
  onChange(patch);
  const bounds=scopeFocusBounds({...doc,...patch});
  if(bounds)onFit(bounds);
  setOpen(false);
 }
 return <>
  <select ref={selectRef} aria-label="Jump to a region" value="" onChange={event=>{
   if(event.target.value==='custom-combination')setOpen(true);
   else if(event.target.value)onExplore(event.target.value);
  }}>
   <option value="">{doc.mapScope==='combination'?`Explore · ${doc.scopeRegions.length} regions`:'Explore a region…'}</option>
   <option value="custom-combination">Combine states & territories…</option>
   <optgroup label="Explore one region">{regions.filter(region=>scopeRegions.some(source=>source.id===region.id)).map(region=><option key={region.id} value={region.id}>{region.name}</option>)}</optgroup>
  </select>
  <Dialog open={open} onOpenChange={setOpen}>
   <DialogContent className="region-composer" finalFocus={()=>{selectRef.current?.focus();return false;}}>
    <header className="region-composer-heading">
     <span className="region-composer-icon"><Layers size={21}/></span>
     <div><DialogTitle>Combine states & territories</DialogTitle><DialogDescription>Choose any combination, then fit them together on one map.</DialogDescription></div>
    </header>
    {open&&<RegionCombinationForm doc={doc} onApply={apply} onCancel={()=>setOpen(false)}/>}
   </DialogContent>
  </Dialog>
 </>;
}

export function RegionCombinationForm({doc,onApply,onCancel}:{doc:MapDoc;onApply:(ids:string[])=>void;onCancel:()=>void}){
 const [selectedIds,setSelectedIds]=useState<string[]>(()=>{
  if(doc.mapScope==='combination')return [...doc.scopeRegions];
  if(doc.mapScope==='atlas'&&!doc.countryView)return [];
  return scopeGeometryAreas(doc).filter(area=>area.level==='region'&&options.some(option=>option.id===area.id)).map(area=>area.id);
 });
 const [query,setQuery]=useState('');
 const search=query.trim().toLocaleLowerCase();
 const matches=options.filter(option=>(option.name+' '+option.group).toLocaleLowerCase().includes(search));
 const selected=options.filter(option=>selectedIds.includes(option.id));
 function toggle(id:string){setSelectedIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);}
 return <form className="region-composer-form" onSubmit={event=>{event.preventDefault();if(selected.length)onApply(selected.map(region=>region.id));}}>
  <div className="region-composer-preset"><span>Start with a familiar group</span><button type="button" onClick={()=>setSelectedIds([...punjabHaryanaDelhi])}><MapPinned size={14}/> Punjab + Haryana + Delhi</button></div>
  <section className="region-composer-selection" aria-label="Selected regions">
   <div className="region-composer-selection-heading"><strong aria-live="polite">{selected.length} {selected.length===1?'region':'regions'} selected</strong><button type="button" disabled={!selected.length} onClick={()=>setSelectedIds([])}>Clear selection</button></div>
   {selected.length?<div className="region-composer-chips">{selected.map(region=><span key={region.id}>{region.name}<button type="button" aria-label={'Remove '+region.name} onClick={()=>toggle(region.id)}><X size={12}/></button></span>)}</div>:<p>Select regions below to build your map.</p>}
  </section>
  <label className="region-composer-search"><Search size={17}/><input aria-label="Search states and territories" type="search" placeholder="Search states, territories or countries…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
  <div className="region-composer-results" aria-label="Available regions">
   {groups.map(group=>{
    const items=matches.filter(option=>option.group===group);
    return items.length?<fieldset key={group}><legend>{group}</legend><div className="region-composer-grid">{items.map(region=><label className="region-composer-option" key={region.id}>
     <input type="checkbox" checked={selectedIds.includes(region.id)} onChange={()=>toggle(region.id)}/><span>{region.name}</span>
    </label>)}</div></fieldset>:null;
   })}
   {!matches.length&&<p className="region-composer-empty">No matching regions. Try another name.</p>}
  </div>
  <p className="region-composer-hint">Colors, natural layers and saved detail settings carry over. Adjust divisions and districts in Layers.</p>
  <footer className="region-composer-footer"><button type="button" onClick={onCancel}>Cancel</button><button type="submit" className="region-composer-apply" disabled={!selected.length}><MapPinned size={16}/> Show {selected.length||'selected'} {selected.length===1?'region':'regions'} together</button></footer>
 </form>;
}
