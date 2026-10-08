'use client';
import type {MapDoc} from './map-model';
import gurdwaras from './gurdwara-data.json';
import {gurdwaraIcon} from './gurdwara-icons';
import {shrineTierAllowed} from './overlay-model';
type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void;onFit:(bounds:number[])=>void;onAutoColor:()=>void;busy:boolean};
const around=([x,y]:number[])=>[x-.018,y-.014,x+.018,y+.014];
export default function OverlayControls({doc,onChange,onFit,onAutoColor,busy}:Props){
 const selected=gurdwaras.filter(g=>shrineTierAllowed(g.tier,doc));
 function fitShrines(){if(!selected.length)return;const b=selected.reduce((b,g)=>[Math.min(b[0],g.coordinates[0]),Math.min(b[1],g.coordinates[1]),Math.max(b[2],g.coordinates[0]),Math.max(b[3],g.coordinates[1])],[180,90,-180,-90]);onFit(b);}
 return <section className="overlay-controls" aria-labelledby="overlay-heading">
  <h2 id="overlay-heading">Cities, rivers & Sikh heritage</h2>
  <label className="overlay-toggle"><input type="checkbox" aria-label="Show major cities" checked={doc.cities} onChange={e=>onChange({cities:e.target.checked})}/> Show major cities</label>
  {doc.cities&&<>
   <label className="field">City selection<select aria-label="City selection" value={doc.cityMode} onChange={e=>onChange({cityMode:e.target.value as MapDoc['cityMode']})}><option value="major">Major cities & national capitals</option><option value="all">All source settlement points</option></select></label>
   {doc.cityMode==='major'&&<label className="field">Minimum source population<input type="number" aria-label="Major city population threshold" min={0} max={5000000} step={50000} value={doc.cityMinPopulation} onChange={e=>onChange({cityMinPopulation:Math.max(0,Math.min(5000000,+e.target.value||0))})}/></label>}
   <label className="overlay-toggle"><input type="checkbox" aria-label="Auto-color city markers" checked={doc.cityAutoColors} onChange={e=>onChange({cityAutoColors:e.target.checked})}/> Auto-color city markers</label>
   {!doc.cityAutoColors&&<label className="overlay-color"><input type="color" aria-label="City highlight color" value={doc.cityColor} onChange={e=>onChange({cityColor:e.target.value})}/> City highlight color</label>}
   <button disabled={busy} onClick={onAutoColor}>{busy?'Finding city districts…':'Auto-color major-city districts'}</button>
   <p className="muted">Markers highlight approximate Natural Earth city centers. Red: national capitals; orange: source population ≥1 million; teal: other selected cities. Population is an archival source estimate, not a current census. Auto-color applies to containing visible districts, not municipal city limits; existing colors are replaced only in those districts and can be undone.</p>
  </>}
  <label className="overlay-toggle"><input type="checkbox" aria-label="Show rivers" checked={doc.rivers} onChange={e=>onChange({rivers:e.target.checked})}/> Show rivers</label>
  {doc.rivers&&<><label className="overlay-color"><input type="color" aria-label="River color" value={doc.riverColor} onChange={e=>onChange({riverColor:e.target.value})}/> River color</label><label className="overlay-toggle"><input type="checkbox" checked={doc.riverLabels} onChange={e=>onChange({riverLabels:e.target.checked})}/> Show river names</label><label className="field">River width<input type="number" aria-label="River width" min={.5} max={6} step={.5} value={doc.riverWidth} onChange={e=>onChange({riverWidth:Math.max(.5,Math.min(6,+e.target.value||.5))})}/></label><p className="muted">Generalized major rivers from Natural Earth, not detailed channel surveying. Rivers and place markers follow the selected source geography.</p></>}
  <label className="overlay-toggle"><input type="checkbox" aria-label="Show gurdwaras" checked={doc.gurdwaras} onChange={e=>onChange({gurdwaras:e.target.checked})}/> Show historic gurdwaras</label>
  {doc.gurdwaras&&<>
   <label className="field">Heritage selection<select aria-label="Gurdwara selection" value={doc.gurdwaraFilter} onChange={e=>onChange({gurdwaraFilter:e.target.value as MapDoc['gurdwaraFilter']})}><option value="all">100 curated historic / important shrines</option><option value="takht">Five Takhts</option><option value="featured">15 featured important shrines</option><option value="special">Five Takhts + 15 featured shrines</option></select></label>
   <label className="overlay-toggle"><input type="checkbox" aria-label="Show gurdwara names" checked={doc.gurdwaraLabels} onChange={e=>onChange({gurdwaraLabels:e.target.checked})}/> Show gurdwara names</label>
   <label className="overlay-color"><input type="color" aria-label="Historic gurdwara color" value={doc.gurdwaraColor} onChange={e=>onChange({gurdwaraColor:e.target.value})}/> Other historic shrine color</label>
   <label className="field">Symbol size<input type="number" aria-label="Gurdwara symbol size" min={.6} max={2} step={.1} value={doc.gurdwaraScale} onChange={e=>onChange({gurdwaraScale:Math.max(.6,Math.min(2,+e.target.value||1))})}/></label>
   <label className="field">Find a shrine<select aria-label="Find a gurdwara" value="" onChange={e=>{const site=gurdwaras.find(g=>g.id===e.target.value);if(site)onFit(around(site.coordinates));}}><option value="">Choose a sourced shrine…</option>{gurdwaras.map(g=><option key={g.id} value={g.id}>{g.name} · {g.city}</option>)}</select></label>
   <button onClick={fitShrines}>Fit shown gurdwaras</button>
   <div className="shrine-symbol-key">{(['takht','featured','historic'] as const).map(t=><span key={t}><span aria-hidden="true" dangerouslySetInnerHTML={{__html:gurdwaraIcon(t,0,doc.gurdwaraColor)}}/>{t==='takht'?'Five Takhts':t==='featured'?'15 featured':'80 other historic'}</span>)}</div>
   <p className="coverage-warning">100 curated sites, not every gurdwara or an objective worldwide ranking. Five Takhts and 15 editorial featured shrines have distinct stylized building symbols, not exact architectural replicas. Published coordinate accuracy varies; these are not surveyed entrances. The current geographic scope still applies—choose Full map or a relevant region for shrines elsewhere.</p>
  </>}
  <label className="overlay-toggle"><input type="checkbox" aria-label="Show administrative area names" checked={doc.names} onChange={e=>onChange({names:e.target.checked})}/> Show administrative area names</label>
 </section>;
}
