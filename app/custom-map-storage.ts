import {validate,type MapDoc} from './map-model';

export const customMapDatabase='opencarto-custom-maps';
export const activeCustomMapKey='opencarto-active-custom-map-v1';
export type CustomMap={id:string;name:string;doc:MapDoc;viewBounds:number[]|null;createdAt:number;updatedAt:number};
type StoredMap=CustomMap&{nameKey:string};
type SaveInput={id?:string;name:string;doc:MapDoc;viewBounds?:number[]|null;expectedUpdatedAt?:number};

export function mapName(value:string){
 const name=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,100).trim();
 if(!name)throw Error('Enter a name for your map.');
 return name;
}
const nameKey=(name:string)=>mapName(name).normalize('NFKC').toLowerCase();
export function suggestMapName(base:string,maps:CustomMap[]){
 const name=mapName(base||'Untitled map'),used=new Set(maps.map(m=>nameKey(m.name)));
 if(!used.has(nameKey(name)))return name;
 for(let i=2;;i++){const suffix=' ('+i+')',next=name.slice(0,100-suffix.length)+suffix;if(!used.has(nameKey(next)))return next;}
}
export function validViewBounds(value:unknown):number[]|null{
 if(!Array.isArray(value)||value.length!==4||!value.every(n=>typeof n==='number'&&Number.isFinite(n)))return null;
 const [w,s,e,n]=value;
 return w>=-180&&e<=180&&s>=-90&&n<=90&&w<e&&s<n?[...value]:null;
}
export function mapSnapshot(doc:MapDoc){return validate(structuredClone(doc));}
export function decodeCustomMap(value:unknown):CustomMap{
 if(!value||typeof value!=='object')throw Error('A saved map could not be read. Download your current settings and try again.');
 const v=value as Partial<CustomMap>;
 if(typeof v.id!=='string'||!v.id||typeof v.name!=='string'||!v.doc||typeof v.doc!=='object'||typeof v.createdAt!=='number'||typeof v.updatedAt!=='number'||!Number.isFinite(v.createdAt)||!Number.isFinite(v.updatedAt)||v.createdAt<0||v.updatedAt<v.createdAt||v.updatedAt>8640000000000000)throw Error('A saved map could not be read. Download your current settings and try again.');
 return {id:v.id,name:mapName(v.name),doc:mapSnapshot(v.doc),viewBounds:validViewBounds(v.viewBounds),createdAt:v.createdAt,updatedAt:v.updatedAt};
}

let database:Promise<IDBDatabase>|null=null;
function openDatabase(){
 if(database)return database;
 database=new Promise<IDBDatabase>((resolve,reject)=>{
  let request:IDBOpenDBRequest;
  try{request=indexedDB.open(customMapDatabase,1)}catch{reject(Error('Saved maps are unavailable in this browser. Download settings to keep a copy.'));return;}
  let blocked=false;
  request.onupgradeneeded=()=>{const store=request.result.createObjectStore('maps',{keyPath:'id'});store.createIndex('nameKey','nameKey',{unique:true});};
  request.onblocked=()=>{blocked=true;reject(Error('Close other map tabs and try opening My maps again.'));};
  request.onerror=()=>reject(Error('Saved maps are unavailable in this browser. Download settings to keep a copy.'));
  request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>{db.close();database=null;};resolve(db);};
 }).catch(error=>{database=null;throw error;});
 return database;
}
function storageError(error:DOMException|null){
 if(error?.name==='ConstraintError')return Error('A map already has this name. Choose a different name.');
 if(error?.name==='QuotaExceededError')return Error('Browser storage is full. Download settings to keep a copy.');
 return Error('Your map could not be saved. Try again or download settings to keep a copy.');
}
export async function listCustomMaps(){
 const db=await openDatabase();
 return new Promise<CustomMap[]>((resolve,reject)=>{
  const tx=db.transaction('maps','readonly'),request=tx.objectStore('maps').getAll();
  tx.onabort=()=>reject(storageError(tx.error));
  tx.oncomplete=()=>{try{resolve(request.result.map(decodeCustomMap).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id)))}catch(error){reject(error)}};
 });
}
export async function saveCustomMap(input:SaveInput){
 // Capture the working document before waiting for storage; later edits remain a draft.
 const name=mapName(input.name),doc=mapSnapshot(input.doc),viewBounds=validViewBounds(input.viewBounds),db=await openDatabase();
 return new Promise<CustomMap>((resolve,reject)=>{
  const tx=db.transaction('maps','readwrite'),store=tx.objectStore('maps');
  let saved:StoredMap,reason:unknown;
  tx.onabort=()=>reject(reason||storageError(tx.error));
  tx.oncomplete=()=>resolve(decodeCustomMap(saved));
  function write(existing?:StoredMap){
   try{
    if(input.id&&(!existing||input.expectedUpdatedAt!==existing.updatedAt))throw Error('This map changed in another tab. Open its saved version or save a new copy.');
    const now=Math.max(Date.now(),(existing?.updatedAt||0)+1);
    saved={id:existing?.id||crypto.randomUUID(),name,nameKey:nameKey(name),doc,viewBounds,createdAt:existing?.createdAt||now,updatedAt:now};
    store.put(saved);
   }catch(error){reason=error;tx.abort();}
  }
  // IndexedDB transactions must keep their work in request callbacks, without awaits.
  if(input.id){const request=store.get(input.id);request.onsuccess=()=>write(request.result)}else write();
 });
}
