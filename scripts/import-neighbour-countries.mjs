import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extent,labelPoint} from './geojson-utils.mjs';

const root=new URL('../',import.meta.url);
const read=async file=>JSON.parse(await fs.readFile(new URL(file,root),'utf8'));
const write=(file,value)=>fs.writeFile(new URL(file,root),JSON.stringify(value)+'\n');
const hash=async file=>createHash('sha256').update(await fs.readFile(new URL(file,root))).digest('hex');
const collection=features=>({type:'FeatureCollection',features});
const definitions=[
 {iso:'npl',id:'np-nepal',name:'Nepal',levels:{1:'province',2:'district',3:'tehsil'},labels:{province:'Provinces',district:'Districts',tehsil:'Local units'},notes:'775 named ADM3 source records. This snapshot count is not a count of current municipalities; source names and codes are retained without inventing unit classifications.'},
 {iso:'bgd',id:'bd-bangladesh',name:'Bangladesh',levels:{1:'province',2:'district',3:'tehsil'},labels:{province:'Divisions',district:'Districts',tehsil:'Upazilas / cities'},notes:'ADM3 includes 495 upazilas and 12 city corporations in this source.'},
 {iso:'btn',id:'bt-bhutan',name:'Bhutan',levels:{1:'district',2:'tehsil'},labels:{district:'Dzongkhags',tehsil:'Gewogs'},notes:'This source has no separate province tier. Dzongkhags and gewogs are the published administrative levels.'},
 {iso:'lka',id:'lk-sri-lanka',name:'Sri Lanka',levels:{1:'province',2:'district',3:'tehsil'},labels:{province:'Provinces',district:'Districts',tehsil:'DS divisions'},notes:'Divisional-secretariat boundaries from the 2022 source edition. Grama Niladhari detail is not included in this district/subdivision map.'},
 {iso:'mdv',id:'mv-maldives',name:'Maldives',levels:{1:'district',2:'tehsil'},labels:{district:'Atolls / city',tehsil:'Island areas'},notes:'No province tier is invented. Source island polygons include non-inhabited areas; their count is not a count of inhabited islands.'},
 {iso:'mmr',id:'mm-myanmar',name:'Myanmar',levels:{1:'province',2:'district',3:'tehsil'},labels:{province:'States / regions',district:'Districts',tehsil:'Townships'},notes:'18 source state/region or special-area records, 80 source districts and 330 townships. Later reorganizations and administrative control are not established by this snapshot.'},
 {iso:'afg',id:'af-afghanistan',name:'Afghanistan',levels:{1:'province',2:'district'},labels:{province:'Provinces',district:'Districts'},notes:'The humanitarian source supplies 401 district polygons. Its 2026 note lists 457 designated units, but complete boundary data for that arrangement is unavailable. No deeper subdivision polygons are supplied or invented.'},
 {iso:'pak',id:'pk-country',name:'Pakistan · full source coverage',levels:{1:'province',2:'district',3:'tehsil'},labels:{province:'Provinces / territories',district:'Districts',tehsil:'Tehsils'},notes:'Seven source provinces/territories, not seven constitutional provinces. Includes Pakistan-administered Azad Kashmir and Gilgit-Baltistan; disputed sovereignty is not asserted. The coherent 2022 source is separate from the existing Punjab/Lahore detail editions.'},
];
const chosen=process.argv.find(a=>a.startsWith('--countries='))?.split('=')[1]?.split(',');
let catalog=await read('app/catalog.json');
let manifest={countries:[],layers:{}};
try{manifest=await read('app/neighbour-country-sources.json');}catch(error){if(error.code!=='ENOENT')throw error;}
for(const def of definitions.filter(d=>!chosen||chosen.includes(d.iso))){
 const directory=def.iso==='pak'?'work/pakistan-admin-source':`work/country-sources/${def.iso}`;
 const metadata=(await read(`work/hdx-${def.iso}-metadata.json`)).result;
 if(!metadata.license_title.includes('CC BY-IGO'))throw Error(`Unreviewed license: ${def.iso}`);
 const generated=[],inputs=[],counts={},omitted={};
 const byCode=new Map();
 for(const sourceLevel of [0,...Object.keys(def.levels).map(Number)]){
  const file=`${directory}/${def.iso}_admin${sourceLevel}.geojson`,raw=await read(file);
  inputs.push({file:`${def.iso}_admin${sourceLevel}.geojson`,sha256:await hash(file),sourceCount:raw.features.length});
  const level=sourceLevel===0?'region':def.levels[sourceLevel];
  const features=[];
  for(const f of raw.features){
   const name=f.properties[`adm${sourceLevel}_name`],code=f.properties[`adm${sourceLevel}_pcode`];
   if(!name||!code){omitted[level]=(omitted[level]||0)+1;continue;}
   const id=sourceLevel===0?def.id:`${def.id}-${level[0]}-${code.toLowerCase()}`;
   if(byCode.has(`${sourceLevel}:${code}`))throw Error(`Duplicate source code at ADM${sourceLevel}: ${code}`);
   const sourceParent=sourceLevel===0?'':f.properties[`adm${sourceLevel-1}_pcode`];
   const parent=sourceLevel===0?'':byCode.get(`${sourceLevel-1}:${sourceParent}`);
   if(sourceLevel>0&&!parent)throw Error(`Unresolved source parent: ${code} -> ${sourceParent}`);
   const properties={id,name,region:def.id,level,parent,country:def.name,sourceCode:code,sourceParentCode:sourceParent,sourceLevel:`ADM${sourceLevel}`,sourceValidOn:f.properties.valid_on,center:labelPoint(f.geometry),bbox:extent(f.geometry),source:`${metadata.dataset_source} · OCHA/HDX ${f.properties.version} · valid ${f.properties.valid_on} · CC BY-IGO`,...(sourceLevel>=2&&def.levels[1]==='province'?{province:f.properties.adm1_name}:{}),...(level==='tehsil'?{district:f.properties[`adm${sourceLevel-1}_name`]}:{})};
   features.push({type:'Feature',id,properties,geometry:f.geometry});byCode.set(`${sourceLevel}:${code}`,id);
  }
  counts[level]=features.length;generated.push(...features.map(f=>f.properties));
  const key=`${def.id}-${level}`;
  await write(`public/data/${key}.geojson`,collection(features));
  await write(`public/data/${key}-labels.geojson`,collection(features.map(f=>({...f,geometry:{type:'Point',coordinates:f.properties.center}}))));
  manifest.layers[key]={count:features.length,sourceLevel:`ADM${sourceLevel}`,sha256:await hash(`public/data/${key}.geojson`),labelsSha256:await hash(`public/data/${key}-labels.geojson`)};
 }
 catalog=[...catalog.filter(a=>a.region!==def.id),...generated];
 const entry={...def,counts,omitted,inputs,url:`https://data.humdata.org/dataset/cod-ab-${def.iso}`,downloadUrl:metadata.resources.find(r=>r.name.endsWith('geojson.zip')).url,license:metadata.license_title,licenseUrl:'https://creativecommons.org/licenses/by/3.0/igo/',source:metadata.dataset_source,sourceNotes:metadata.notes,validOn:[...new Set(generated.map(a=>a.sourceValidOn))],retrieved:new Date().toISOString().slice(0,10)};
 manifest.countries=[...manifest.countries.filter(c=>c.id!==def.id),entry];
 console.log(`${def.name}: ${JSON.stringify(counts)}, omitted ${JSON.stringify(omitted)}`);
}
await write('app/catalog.json',catalog);await write('app/neighbour-country-sources.json',manifest);
