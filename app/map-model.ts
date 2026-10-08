import raw from './catalog.json';
import indianSources from './indian-region-sources.json';
export type Level='region'|'division'|'district'|'tehsil'|'uc';
export type Area={id:string;name:string;region:string;level:Level;parent:string;center:number[];bbox:number[];source:string;district?:string;town?:string};
export const areas=raw as Area[];
export const areaById=new Map(areas.map(a=>[a.id,a]));
// Static indexes keep layer updates linear in the loaded areas, not the full atlas per layer.
export const areasByLayer=new Map<string,Area[]>();
for(const a of areas){const key=a.region+'-'+a.level;const list=areasByLayer.get(key);if(list)list.push(a);else areasByLayer.set(key,[a])}
export const ucParents=new Set(areas.filter(a=>a.level==='uc').map(a=>a.parent));
export const divisionRegions=new Set(areas.filter(a=>a.level==='division').map(a=>a.region));
const tehsilRegions=new Set(['in-haryana','in-himachal','in-rajasthan','in-uttar-pradesh','in-uttarakhand','in-jammu-kashmir','in-ladakh','in-punjab','pk-punjab','pk-kp']);
export const subdistrictLabel=(id:string)=>id==='in-andhra'?'Mandals':tehsilRegions.has(id)?'Tehsils':'Subdistricts';
export const coverageNotes=new Map(indianSources.regions.map(r=>{
 const source=r as {districtsWithoutLinkedTehsils?:string[];omittedUnnamedTehsilRecords?:number};
 const gaps=source.districtsWithoutLinkedTehsils||[],unnamed=source.omittedUnnamedTehsilRecords||0;
 return [r.id,[gaps.length?`${gaps.length} source district${gaps.length===1?' has':'s have'} no linked subdistrict detail: ${gaps.join(', ')}. Source parent links are retained.`:'',unnamed?`${unnamed} unnamed source subdistrict record${unnamed===1?' is':'s are'} excluded from administrative listings.`:''].filter(Boolean).join(' ')];
}));
const snapshotCoverage=(id:string)=>`${areasByLayer.get(id+'-district')?.length||0} districts · ${areasByLayer.get(id+'-tehsil')?.length||0} named ${id==='in-andhra'?'mandal':'subdistrict'} areas · LGD 2024`;
export const regions=[{id:'in-punjab',name:'Punjab · India',date:'23 districts · 79 tehsil polygons'},...indianSources.regions.map(r=>({id:r.id,name:r.name,date:snapshotCoverage(r.id)})),{id:'pk-punjab',name:'Punjab · Pakistan',date:'36 districts · 147 tehsil polygons'},{id:'pk-kp',name:'Selected KP divisions',date:'20 districts · 72 tehsil polygons'},{id:'islamabad',name:'Islamabad',date:'Capital territory · 1 source subdivision'},{id:'chandigarh',name:'Chandigarh',date:'Union territory · 28 historical wards'}];
export const regionById=new Map(regions.map(r=>[r.id,r]));
export const levels:Level[]=['region','district','tehsil','uc','division'];
export const layerKeys=[...areasByLayer.keys()];
export type Paint={color:string;pattern:string};
export type RegionState={show:boolean;district:boolean;tehsil:boolean;uc:boolean;division:boolean};
export type MapDoc={kashmirView:'separate'|'combined';basemap:string;cities:boolean;rivers:boolean;opacity:number;fills:Record<string,Paint>;groups:Record<string,string>;regions:Record<string,RegionState>;hidden:string[];title:string;legendTitle:string;bg:string;uncolored:string;border:string;names:boolean;borders:boolean;districtBorders:boolean;tehsilBorders:boolean;divisionBorders:boolean;detailBorders:boolean;width:number;labelSize:number;legend:boolean;legendX:number;legendY:number};
export const initial:MapDoc={kashmirView:'separate',basemap:"political",cities:false,rivers:false,opacity:0.22,fills:{},groups:{},regions:Object.fromEntries(regions.map(r=>[r.id,{show:true,district:true,tehsil:r.id==='in-haryana'||r.id==='in-himachal',uc:false,division:true}])),hidden:[],title:'The Punjab & neighbouring regions',legendTitle:'Legend',bg:'#ffffff',uncolored:'#e7edf2',border:'#526477',names:true,borders:true,districtBorders:true,tehsilBorders:true,divisionBorders:true,detailBorders:true,width:1,labelSize:12,legend:true,legendX:76,legendY:66};
export const paintKey=(p:Paint)=>p.color+'|'+p.pattern;
export const isKashmirPart=(id:string)=>id==='in-jammu-kashmir'||id==='in-ladakh';
export function visible(a:Area,d:MapDoc){if(a.region==='kashmir-united')return d.kashmirView==='combined'&&!d.hidden.includes(a.id);if(a.level==='region'&&isKashmirPart(a.region)&&d.kashmirView==='combined')return false;const r=d.regions[a.region];return !!r?.show&&(a.level==='region'||r[a.level])&&!d.hidden.includes(a.id)&&!d.hidden.includes(a.parent)}
export function effectivePaint(a:Area,d:MapDoc){return d.fills[a.id]||d.fills[a.parent]}
export function bounds(list:Area[]){return list.reduce((b,a)=>[Math.min(b[0],a.bbox[0]),Math.min(b[1],a.bbox[1]),Math.max(b[2],a.bbox[2]),Math.max(b[3],a.bbox[3])],[180,90,-180,-90])}
export const allBounds=bounds(areas.filter(a=>a.level==='region'));
export function validate(v:unknown):MapDoc{const x=v as MapDoc;if(!x||typeof x!=='object'||!x.fills||Array.isArray(x.fills))throw Error('Invalid map');const hex=(s:unknown)=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);const fills:Record<string,Paint>={};for(const [id,p]of Object.entries(x.fills)){const migrated=areaById.has(id)?id:'in-d-'+id;if(!areaById.has(migrated)||!p||!hex(p.color)||!['solid','stripes','dots','cross'].includes(p.pattern))throw Error('Invalid map color');fills[migrated]=p}const r:MapDoc={...initial,fills,regions:structuredClone(initial.regions),groups:{},hidden:[]};for(const k of ['title','legendTitle'] as const)if(typeof x[k]==='string')r[k]=x[k].slice(0,100);for(const k of ['bg','border','uncolored'] as const)if(hex(x[k]))r[k]=x[k];for(const k of ['names','borders','legend','districtBorders','tehsilBorders','divisionBorders','detailBorders'] as const)if(typeof x[k]==='boolean')r[k]=x[k];for(const [k,min,max]of [['width',.2,4],['labelSize',9,20],['legendX',0,80],['legendY',0,90]] as const)if(Number.isFinite(x[k]))r[k]=Math.min(max,Math.max(min,x[k]));if(x.groups&&typeof x.groups==='object')r.groups=Object.fromEntries(Object.entries(x.groups).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v.slice(0,80)]));if(Array.isArray(x.hidden))r.hidden=x.hidden.filter(id=>typeof id==='string'&&areaById.has(id));for(const region of regions)for(const k of ['show','district','tehsil','division','uc'] as const)if(typeof x.regions?.[region.id]?.[k]==='boolean')r.regions[region.id][k]=x.regions[region.id][k];if(['political','satellite','physical','rivers','streets'].includes(x.basemap))r.basemap=x.basemap;if(x.kashmirView==='combined')r.kashmirView='combined';if(typeof x.cities==='boolean')r.cities=x.cities;if(typeof x.rivers==='boolean')r.rivers=x.rivers;if(Number.isFinite(x.opacity))r.opacity=Math.min(1,Math.max(0,x.opacity));return r}
export function download(blob:Blob,name:string){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)}

