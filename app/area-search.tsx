'use client';
import {useDeferredValue,useMemo,useState} from 'react';
import {Search,Plus,LocateFixed,Eye,EyeOff,MapPinned,X} from 'lucide-react';
import {regions,effectivePaint,type MapDoc,type Area} from './map-model';
import {selectionAreas,scopeFocusBounds} from './scope-model';
import {findAreas,areaContext,areaLevelNames,hiddenArea,revealArea,addArea} from './area-search-model';

type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void;onPaint:(id:string)=>void};
export default function AreaSearch({doc,onChange,onFit,onPaint}:Props){
 const [query,setQuery]=useState(''),[level,setLevel]=useState('all'),[region,setRegion]=useState('all'),[hiddenOnly,setHiddenOnly]=useState(false),[limit,setLimit]=useState(60);
 const deferred=useDeferredValue(query);
 const matches=useMemo(()=>findAreas(deferred,level,region).filter(a=>!hiddenOnly||hiddenArea(a,doc)),[deferred,level,region,hiddenOnly,doc]);
 const selected=doc.mapScope==='selection'?selectionAreas(doc):[];
 function add(a:Area,only=false){const patch=addArea(doc,a.id,only);onChange(patch);const b=scopeFocusBounds({...doc,...patch});if(b)onFit(b);}
 return <section className="atlas-area-search">
  <p className="muted">Search every existing country, state, district, division, tehsil, subdivision and ward. Add results to your current map or show one by itself.</p>
  <label className="search"><Search size={16}/><input type="search" aria-label="Find an area" placeholder="Search the whole atlas…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(60);}}/></label>
  <div className="area-search-filters"><label className="field">Area type<select aria-label="Filter area type" value={level} onChange={e=>{setLevel(e.target.value);setLimit(60);}}><option value="all">All types</option>{Object.entries(areaLevelNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
  <label className="field">Region<select aria-label="Filter areas by region" value={region} onChange={e=>{setRegion(e.target.value);setLimit(60);}}><option value="all">Whole atlas</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
  <label className="enabled-filter"><input type="checkbox" checked={hiddenOnly} onChange={e=>{setHiddenOnly(e.target.checked);setLimit(60);}}/> Hidden areas only</label>
  {doc.hidden.length>0&&<div className="hidden-area-summary"><strong>{doc.hidden.length} hidden selections</strong><button onClick={()=>onChange({hidden:[]})}>Unhide all areas</button><p className="muted">Hiding a parent hides its children. Unhiding a child also unhides its parent.</p></div>}
  {selected.length>0&&<details className="area-current-selection"><summary>On your map · {selected.length} selections</summary><div className="geography-chips">{selected.map(a=><span key={a.id}>{a.name}<button aria-label={'Remove '+a.name+' from selection'} onClick={()=>onChange({scopeAreas:doc.scopeAreas.filter(id=>id!==a.id)})}><X size={12}/></button></span>)}</div></details>}
  <output className="muted">{matches.length.toLocaleString()} matching areas{matches.length>limit?' · showing '+limit:''}</output>
  <div className="district-list">{matches.slice(0,limit).map(a=>{const hidden=hiddenArea(a,doc);return <div className={'area-search-card'+(hidden?' is-hidden':'')} data-area={a.id} key={a.id}>
   <div className="area-row"><button className="area-name" onClick={()=>onPaint(a.id)} title={'Color '+a.name}><i style={{background:effectivePaint(a,doc)?.color||doc.uncolored}}/><span>{a.name}<small>{areaLevelNames[a.level]} · {areaContext(a)}</small></span></button><button aria-label={'Zoom to '+a.name} title={'Zoom to '+a.name} onClick={()=>onFit(a.bbox)}><LocateFixed size={14}/></button></div>
   <div className="area-result-actions"><button aria-label={'Add '+a.name+' to map'} onClick={()=>add(a)}><Plus size={13}/> Add</button><button aria-label={'Show only '+a.name} onClick={()=>add(a,true)}><MapPinned size={13}/> Only this</button><button aria-label={(hidden?'Unhide ':'Hide ')+a.name} aria-pressed={hidden} onClick={()=>onChange({hidden:hidden?revealArea(a,doc):[...new Set([...doc.hidden,a.id])]})}>{hidden?<EyeOff size={13}/>:<Eye size={13}/>} {hidden?'Unhide':'Hide'}</button></div>
  </div>;})}{!matches.length&&<p className="empty-state">No matching source areas. Try another spelling or clear the filters.</p>}</div>
  {matches.length>limit&&<button className="area-load-more" onClick={()=>setLimit(v=>v+60)}>Show 60 more results</button>}
 </section>;
}
