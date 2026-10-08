'use client';
/* oxlint-disable next/no-img-element -- Local photos are shared with the static map and SVG exporter. */
import {useState} from 'react';
import {Search,MapPinned,ImageOff,ExternalLink,BookOpen} from 'lucide-react';
import {directoryEntries,gurdwaraDirectory,locatedDirectoryCount,legacyOnlyGurdwaras} from './gurdwara-catalog';
import {photoById,photoDateLabel} from './gurdwara-photos';

const countries=[...new Set(directoryEntries.map(site=>site.country))].sort();
const famous=new Set(gurdwaraDirectory.curated_lists.top_20_famous);
const historic=new Set(gurdwaraDirectory.curated_lists.top_50_important_historic);
export default function GurdwaraDirectoryPanel({onShow}:{onShow:(id:string)=>void}){
 const [query,setQuery]=useState(''),[country,setCountry]=useState('all'),[collection,setCollection]=useState('all'),[limit,setLimit]=useState(12);
 const term=query.trim().toLocaleLowerCase();
 const entries=directoryEntries.filter(site=>(country==='all'||site.country===country)&&[site.name,...site.aliases,site.locality,site.state_province,site.country].join(' ').toLocaleLowerCase().includes(term)&&(collection==='all'||collection==='takht'&&site.is_takht||collection==='famous'&&famous.has(site.id)||collection==='historic'&&historic.has(site.id)||collection==='pending'&&!site.mapSite||collection==='photos-2026'&&photoById.get(site.mapSite?.id||'')?.captureYear===2026));
 return <details className="shrine-directory">
  <summary><BookOpen size={16}/><span>Browse all 300 gurdwaras<small>Six countries · names, photos & sources</small></span></summary>
  <div className="shrine-directory-content">
   <p className="muted">{locatedDirectoryCount} directory entries have sourced map locations. The remaining {directoryEntries.length-locatedDirectoryCount} show their listed locality while coordinates await verification.</p>
   <div className="search"><Search size={14}/><input aria-label="Search gurdwara directory" placeholder="Name, alternate spelling or town…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(12);}}/></div>
   <label className="field">Country<select aria-label="Gurdwara directory country" value={country} onChange={e=>{setCountry(e.target.value);setLimit(12);}}><option value="all">All six countries</option>{countries.map(name=><option key={name}>{name}</option>)}</select></label>
   <label className="field">Directory collection<select aria-label="Gurdwara directory collection" value={collection} onChange={e=>{setCollection(e.target.value);setLimit(12);}}><option value="all">All 300 entries</option><option value="takht">Five Takhts</option><option value="famous">Famous 20 · curated selection</option><option value="historic">Important historic 50 · curated selection</option><option value="photos-2026">Photos taken in 2026</option><option value="pending">Awaiting map coordinates</option></select></label>
   <p className="shrine-directory-count" aria-live="polite">{entries.length} results · showing {Math.min(limit,entries.length)}</p>
   <div className="shrine-directory-results">{entries.slice(0,limit).map(site=>{
    const photo=photoById.get(site.mapSite?.id||'');
    return <article key={site.id} className="shrine-directory-card">
     {photo?<a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="shrine-directory-image"><img src={photo.file} alt={site.name} loading="lazy" width={260} height={146}/><span>{photoDateLabel(photo)}</span></a>:<div className="shrine-directory-no-photo"><ImageOff size={18}/><span>Photograph awaiting verification</span></div>}
     <div className="shrine-directory-card-body"><h3>{site.name}</h3><p>{site.locality} · {site.state_province} · {site.country}</p>
      {site.aliases.length>0&&<p className="shrine-directory-aliases">Also known as {site.aliases.join(', ')}</p>}
      {site.data_quality_note&&<p className="shrine-directory-note">{site.data_quality_note}</p>}
      {photo&&<small>Photo: {photo.author} · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></small>}
      <div className="shrine-directory-card-actions">{site.mapSite?<button onClick={()=>onShow(site.mapSite!.id)}><MapPinned size={13}/> Show on map</button>:<span>Location not yet verified</span>}
       {site.sources[0]&&<a href={site.sources[0].url} target="_blank" rel="noreferrer" title={site.sources[0].title}>Source <ExternalLink size={11}/></a>}
      </div>
      <details className="shrine-directory-notes"><summary>About this entry</summary>{site.historical_note&&<p>{site.historical_note}</p>}<p>Directory ID: {site.id}. Operating status and access are unverified.</p>{site.sources.map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</details>
     </div>
    </article>;
   })}</div>
   {!entries.length&&<p className="muted">No matching entries. Try another name or country.</p>}
   {entries.length>limit&&<button className="shrine-directory-more" onClick={()=>setLimit(value=>value+12)}>Show {Math.min(12,entries.length-limit)} more</button>}
   <p className="muted">Compiled {gurdwaraDirectory.compiled_on}. Famous and historic selections are editorial. The map also retains {legacyOnlyGurdwaras.length} previously sourced sites outside this supplied list. Photos retain their recorded capture dates; a 2026 review does not make an older photograph a 2026 image.</p>
  </div>
 </details>;
}
