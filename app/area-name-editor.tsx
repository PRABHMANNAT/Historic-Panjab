'use client';
import {useState} from 'react';
import {PencilLine,RotateCcw} from 'lucide-react';
import type {Area,MapDoc} from './map-model';
import {areaDisplayName,renamedArea} from './area-name-model';

export default function AreaNameEditor({area,doc,onChange}:{area:Area;doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void}){
 const [name,setName]=useState(()=>areaDisplayName(area,doc));
 return <form className="area-name-editor" onSubmit={e=>{e.preventDefault();onChange({areaNames:renamedArea(doc,area,name)});}}><label className="field">Name on your map<input aria-label="Area display name" value={name} maxLength={100} placeholder={area.name} onChange={e=>setName(e.target.value)}/></label><small>Source name: {area.name}. Leave blank to restore it.</small><div><button type="submit"><PencilLine size={13}/> Save name</button><button type="button" disabled={!doc.areaNames[area.id]} onClick={()=>{setName(area.name);onChange({areaNames:renamedArea(doc,area,'')});}}><RotateCcw size={13}/> Reset name</button></div><p>Labels change on this map, its saved settings and exports. Source geography and census records keep their original identities.</p></form>;
}
