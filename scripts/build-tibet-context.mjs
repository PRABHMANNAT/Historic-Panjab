import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extent,labelPoint,polygons} from './geojson-utils.mjs';

const root=new URL('../',import.meta.url);
const read=async file=>JSON.parse(await fs.readFile(new URL(file,root),'utf8'));
const write=(file,value)=>fs.writeFile(new URL(file,root),JSON.stringify(value)+'\n');
const hash=async file=>createHash('sha256').update(await fs.readFile(new URL(file,root))).digest('hex');
const collection=features=>({type:'FeatureCollection',features});
const provinces=await read('work/cn-atlas-provinces.json'),prefectures=await read('work/cn-atlas-prefectures.json'),counties=await read('work/china-ADM2.geojson');
const metadata=(await read('work/geoboundaries-CHN-metadata.json')).find(m=>m.boundaryType==='ADM2');
if((await read('work/cn-atlas-package.json')).license!=='ISC')throw Error('Unreviewed China atlas license');
const definitions=[{id:'cn-tibet',code:'540000',name:'Tibet Autonomous Region · China'},{id:'cn-qinghai',code:'630000',name:'Qinghai · China'},{id:'cn-sichuan',code:'510000',name:'Sichuan · China'}];
function insideRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const contains=(geometry,point)=>polygons(geometry).some(p=>insideRing(point,p[0])&&!p.slice(1).some(r=>insideRing(point,r)));
const countyPoints=counties.features.map(f=>({f,point:labelPoint(f.geometry)}));
let catalog=await read('app/catalog.json');
const manifest=await read('app/neighbour-country-sources.json');
for(const def of definitions){
 const province=provinces.features.find(f=>f.properties.id===def.code);if(!province)throw Error('Missing '+def.name);
 const pref=prefectures.features.filter(f=>f.properties.id.startsWith(def.code.slice(0,2)));
 const parentCode=def.code,pid=`${def.id}-p-${parentCode}`;
 const common={region:def.id,country:def.name,sourceValidOn:'2023',source:'cn-atlas / Amll (ISC), derived from CTAmap / Rui Cheng (MIT) · 2023 · simplified source geometry'};
 const properties={...common,id:def.id,name:def.name,level:'region',parent:'',sourceCode:def.code,sourceLevel:'ADM1 context outline',center:labelPoint(province.geometry),bbox:extent(province.geometry)};
 const groups={region:[{type:'Feature',id:def.id,properties,geometry:province.geometry}],province:[{type:'Feature',id:pid,properties:{...properties,id:pid,level:'province',parent:def.id,sourceParentCode:def.code,sourceLevel:'ADM1'},geometry:province.geometry}],district:[],tehsil:[]};
 for(const f of pref){const id=`${def.id}-d-${f.properties.id}`;groups.district.push({type:'Feature',id,properties:{...common,id,name:f.properties.name,nativeName:f.properties['地名'],level:'district',parent:pid,province:def.name,sourceCode:f.properties.id,sourceParentCode:def.code,sourceLevel:'Prefecture-level',center:labelPoint(f.geometry),bbox:extent(f.geometry)},geometry:f.geometry});}
 const unlinked=[];
 for(const {f,point} of countyPoints){
  if(!contains(province.geometry,point))continue;
  const matches=groups.district.filter(p=>contains(p.geometry,point));
  const parent=matches.length===1?matches[0]:undefined;
  const id=`${def.id}-t-${f.properties.shapeID}`;
  if(!parent)unlinked.push(f.properties.shapeName);
  groups.tehsil.push({type:'Feature',id,properties:{id,name:f.properties.shapeName,region:def.id,country:def.name,province:def.name,level:'tehsil',parent:parent?.id||pid,...(parent?{district:parent.properties.name}:{}),sourceCode:f.properties.shapeID,sourceParentCode:parent?.properties.sourceCode||def.code,sourceLevel:'County-level (geoBoundaries ADM2)',sourceValidOn:'2017',parentMethod:parent?'Derived interior-label spatial association; not an authoritative administrative code join':'No unique prefecture association; linked to the context province only',center:point,bbox:extent(f.geometry),source:'National Administration of Surveying, Mapping and Geoinformation / Revolutionary GIS via geoBoundaries · 2017 · PDDL 1.0'},geometry:f.geometry});
 }
 const counts={};
 for(const [level,features] of Object.entries(groups)){const key=`${def.id}-${level}`;counts[level]=features.length;await write(`public/data/${key}.geojson`,collection(features));await write(`public/data/${key}-labels.geojson`,collection(features.map(f=>({...f,geometry:{type:'Point',coordinates:f.properties.center}}))));manifest.layers[key]={count:features.length,sourceLevel:features[0]?.properties.sourceLevel,sha256:await hash(`public/data/${key}.geojson`),labelsSha256:await hash(`public/data/${key}-labels.geojson`)};}
 catalog=[...catalog.filter(a=>a.region!==def.id),...Object.values(groups).flat().map(f=>f.properties)];
 const entry={...def,iso:'chn',kind:'Chinese administrative context',labels:{province:'Province / AR',district:'Prefectures / cities',tehsil:'County source areas'},counts,validOn:['2023 prefectures','2017 counties'],retrieved:new Date().toISOString().slice(0,10),url:'https://github.com/BarbarossaWang/cn-atlas',downloadUrl:'https://raw.githubusercontent.com/BarbarossaWang/cn-atlas/6e83a19923e39f2c0e58a0a7ad29b349b2a71b9f/prefectures.json',license:'ISC (cn-atlas) / MIT (CTAmap); PDDL-1.0 (county data)',licenseUrl:'https://github.com/ruiduobao/shengshixian.com/blob/master/LICENSE',source:'cn-atlas / Amll; CTAmap / Rui Cheng; geoBoundaries / National Administration of Surveying, Mapping and Geoinformation / Revolutionary GIS',sourceNotes:'Modern provincial/prefecture context only, not traditional Ü-Tsang, Amdo or Kham. Source geometry can differ at shared edges and does not settle disputed territorial claims.',notes:'2023 simplified province/prefecture source and 2017 county source. County membership/parents are derived from interior-label spatial association, not official hierarchy codes; no county geometry is split or invented. Not a complete current register or an exact historical Greater Tibet boundary.',unlinkedCountyAreas:unlinked,countySource:metadata,inputs:await Promise.all(['work/cn-atlas-provinces.json','work/cn-atlas-prefectures.json','work/china-ADM2.geojson'].map(async file=>({file:file.split('/').at(-1),sha256:await hash(file)})))};
 manifest.countries=[...manifest.countries.filter(c=>c.id!==def.id),entry];
 console.log(`${def.name}: ${JSON.stringify(counts)}, ${unlinked.length} county areas without a unique prefecture link`);
}
await write('app/catalog.json',catalog);await write('app/neighbour-country-sources.json',manifest);
