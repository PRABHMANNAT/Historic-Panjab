'use client';
import {delhiViews,delhiSources,delhiPreset,delhiFocusBounds,defaultMetroLines,type MapDoc,type DelhiView} from './map-model';

type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void};
export default function DelhiControls({doc,onChange,onFit}:Props){
 const state=doc.regions['in-delhi'];
 const detail=state.uc?'wards':state.tehsil?'subdivisions':state.district?'districts':'outline';
 function chooseView(view:DelhiView){onChange(delhiPreset(doc,view));onFit(delhiFocusBounds(view));}
 function chooseDetail(value:string){onChange({regions:{...doc.regions,'in-delhi':{...state,show:true,district:value==='districts'||value==='subdivisions',tehsil:value==='subdivisions',uc:value==='wards'}}});}
 return <section className="delhi-controls" aria-labelledby="delhi-heading">
  <h2 id="delhi-heading">Delhi explorer</h2>
  <label className="field">Area view<select aria-label="Delhi area view" value={doc.delhiView} onChange={e=>chooseView(e.target.value as DelhiView)}>{delhiViews.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
  <label className="field">Boundary detail<select aria-label="Delhi detail level" value={detail} onChange={e=>chooseDetail(e.target.value)}><option value="outline">NCT outline only</option><option value="districts">Districts · 2024 snapshot</option><option value="subdivisions">Revenue subdivisions · 2024 snapshot</option><option value="wards">Fine municipal detail · historical wards</option></select></label>
  {state.uc&&<label className="field">Municipal detail<select aria-label="Delhi municipal detail" value={doc.delhiMunicipality} onChange={e=>onChange({delhiMunicipality:e.target.value as MapDoc['delhiMunicipality']})}><option value="all">All 289 named source areas</option><option value="mcd">MCD · 272 historical wards</option><option value="ndmc">NDMC · 9 named historical charges</option><option value="cantt">Cantonment · 8 historical charges</option></select></label>}
  <p className="coverage-warning">11 source districts / 34 subdivision areas (2024), not Delhi’s post-2025 revenue map. Fine detail is historical municipal geography, not current revenue subdivisions.</p>
  {state.uc&&<p className="muted">{delhiSources.wards.caveat}</p>}
  {(doc.delhiView==='old-delhi'||doc.delhiView==='new-delhi')&&<p className="muted">City camera focus only—not a district boundary or a reconstruction of the 2026 Old Delhi district.</p>}
  {doc.delhiView==='ncr'&&<p className="coverage-warning">{delhiSources.ncr.caveat} Rajasthan detail uses legacy Alwar/Bharatpur subdistrict links.</p>}
  <div className="toggle-row"><label><input type="checkbox" checked={doc.delhiMetro} onChange={e=>onChange({delhiMetro:e.target.checked})}/> Show metro lines</label><button onClick={()=>onFit(delhiSources.metro.bbox)}>Fit metro</button></div>
  {doc.delhiMetro&&<>
   <label className="metro-stations"><input type="checkbox" checked={doc.metroStations} onChange={e=>onChange({metroStations:e.target.checked})}/> Show metro stations</label>
   <div className="metro-line-list">{delhiSources.metro.lines.map(line=><div className="metro-line-control" key={line.id}><label><input type="checkbox" aria-label={'Show '+line.name} checked={doc.metroLines[line.id].show} onChange={e=>onChange({metroLines:{...doc.metroLines,[line.id]:{...doc.metroLines[line.id],show:e.target.checked}}})}/><span>{line.name}<small>{line.network}</small></span></label><input type="color" aria-label={line.name+' color'} value={doc.metroLines[line.id].color} onChange={e=>onChange({metroLines:{...doc.metroLines,[line.id]:{...doc.metroLines[line.id],color:e.target.value}}})}/></div>)}</div>
   <button onClick={()=>onChange({metroLines:defaultMetroLines()})}>Reset metro colors & visibility</button>
   <p className="muted">{delhiSources.metro.caveat} {delhiSources.metro.stations} source station points. <a href={delhiSources.metro.licenseUrl} target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a></p>
  </>}
 </section>;
}
