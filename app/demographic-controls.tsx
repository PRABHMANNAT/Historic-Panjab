'use client';
/* oxlint-disable next/no-img-element -- Bundled licensed photos are shared with the static map and SVG exporter. */
import {useMemo,useState} from 'react';
import {Users,Landmark,LocateFixed} from 'lucide-react';
import {areaById,regionById,type MapDoc} from './map-model';
import {scopePreset,scopeFocusBounds} from './scope-model';
import {demographicModes,demographicTitles,demographicRecords,demographicSources,scopeDemographics,demographicValue,communityColors,type DemographicMode} from './demographic-model';
import {communityShrines,communityShrineAllowed,shrineImageUrl,type CommunityShrine} from './community-shrine-model';

type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void};
export default function DemographicControls({doc,onChange,onFit}:Props){
 const [region,setRegion]=useState(''),[query,setQuery]=useState(''),[photoFailed,setPhotoFailed]=useState<Record<string,boolean>>({});
 const scoped=scopeDemographics(doc),selected=demographicRecords.find(r=>r.regionId===(region||scoped[0]?.regionId));
 const sites=useMemo(()=>communityShrines.filter(site=>communityShrineAllowed(site,doc)&&(site.name+' '+site.city+' '+site.community+' '+site.country).toLowerCase().includes(query.toLowerCase())),[doc,query]);
 function showShrine(site:CommunityShrine){const patch=scopePreset(doc,'single',{scopeRegion:site.regionId});onChange({...patch,hidden:doc.hidden.filter(id=>{const a=areaById.get(id);return !a||a.region!==site.regionId;}),communityShrines:true});const b=scopeFocusBounds({...doc,...patch});if(b)onFit(b);}
 return <>
  <section className="demographic-controls"><h2><Users size={17}/> Demographic layers</h2>
   <label className="field">Display over map<select aria-label="Demographic map layer" value={doc.demographicMode} onChange={e=>onChange({demographicMode:e.target.value as DemographicMode})}>{demographicModes.map(mode=><option key={mode} value={mode}>{demographicTitles[mode]}</option>)}</select></label>
   <label className="field">Overlay opacity · {Math.round(doc.demographicOpacity*100)}%<input aria-label="Demographic opacity" type="range" min={.2} max={1} step={.05} value={doc.demographicOpacity} onChange={e=>onChange({demographicOpacity:Number(e.target.value)})}/></label>
   <label><input type="checkbox" aria-label="Show demographic labels" checked={doc.demographicLabels} onChange={e=>onChange({demographicLabels:e.target.checked})}/> Show demographic labels</label>
   <div className="demographic-coverage"><strong>Census 2011 · {scoped.length} covered regions in this view</strong><p>State / territory totals. Boundary editions differ from the census. District and tehsil selections remain unshaded unless matching records exist. Missing data is not zero.</p><p>Language and religion show the largest reported group, which can be below 50%. They do not describe every resident.</p></div>
   {doc.demographicMode!=='none'&&!scoped.some(r=>demographicValue(r,doc.demographicMode))&&<output className="coverage-warning">No matching {demographicTitles[doc.demographicMode].toLowerCase()} records in this selection. Choose a covered whole region below.</output>}
   <label className="field">Inspect a census profile<select aria-label="Census profile" value={selected?.regionId||''} onChange={e=>setRegion(e.target.value)}><option value="">Choose a covered region…</option>{demographicRecords.map(r=><option key={r.regionId} value={r.regionId}>{regionById.get(r.regionId)?.name||r.regionId} · {r.year}</option>)}</select></label>
   {selected&&<div className="census-profile"><h3>{regionById.get(selected.regionId)?.name} · {selected.year}</h3><dl>{(['population','literacy','urban','language','religion'] as const).map(mode=>{const v=demographicValue(selected,mode);return v?<div key={mode}><dt>{demographicTitles[mode]}</dt><dd>{v.text}</dd></div>:null;})}</dl><details><summary>Reported language & religion shares</summary>{([{title:'Mother tongue',values:selected.languages},{title:'Religion',values:selected.religions}]).map(({title,values})=><div key={title}><h4>{title}</h4>{values.map(v=><div className="census-share" key={v.name}><span>{v.name}</span><span>{v.share.toFixed(2)}%</span></div>)}</div>)}</details><p className="muted">{selected.note}</p>{demographicSources.filter(s=>selected.sourceIds.includes(s.id)).map(s=><a className="data-source-link" key={s.id} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}<button onClick={()=>{const patch=scopePreset(doc,'single',{scopeRegion:selected.regionId});onChange(patch);const b=scopeFocusBounds({...doc,...patch});if(b)onFit(b);}}><LocateFixed size={13}/> Show this census region</button></div>}
  </section>
  <section className="community-shrine-controls"><h2><Landmark size={17}/> Community shrines</h2>
   <label><input type="checkbox" aria-label="Show community shrines" checked={doc.communityShrines} onChange={e=>onChange({communityShrines:e.target.checked})}/> Show major shrines on map</label>
   <label className="field">Community<select aria-label="Shrine community" value={doc.shrineCommunity} onChange={e=>onChange({shrineCommunity:e.target.value})}><option value="all">All communities</option>{Object.keys(communityColors).map(c=><option key={c}>{c}</option>)}</select></label>
   <label><input type="checkbox" aria-label="Show community shrine labels" checked={doc.communityShrineLabels} onChange={e=>onChange({communityShrineLabels:e.target.checked})}/> Shrine labels</label>
   <label className="field">Find a shrine<input type="search" aria-label="Search community shrines" value={query} placeholder="Name, city or community…" onChange={e=>setQuery(e.target.value)}/></label>
   <p className="muted">Selected major sites across six communities. Pins follow your geographic selection. Photographs retain their authors and licenses.</p>
   <div className="community-shrine-list">{sites.map(site=><article key={site.id}><div className="community-shrine-photo">{shrineImageUrl(site)&&!photoFailed[site.id]?<img src={shrineImageUrl(site)} alt={site.name} loading="lazy" onError={()=>setPhotoFailed(current=>({...current,[site.id]:true}))}/>:<span>Photo unavailable</span>}</div><h3>{site.name}</h3><span className="community-badge" style={{color:communityColors[site.community]}}>{site.community} · {site.city}, {site.country}</span><p>{site.description}</p>{site.photo&&<a href={site.photo.sourceUrl} target="_blank" rel="noreferrer" className="shrine-photo-credit">Photo: {site.photo.author} · {site.photo.license}</a>}<div className="geography-actions"><button onClick={()=>showShrine(site)}><LocateFixed size={13}/> Show on map</button><a href={site.sourceUrl} target="_blank" rel="noreferrer">Site source</a></div></article>)}{!sites.length&&<p>No matching shrines.</p>}</div>
  </section>
 </>;
}
