import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=async file=>JSON.parse(await fs.readFile(new URL(file,root),'utf8'));
const hash=async file=>createHash('sha256').update(await fs.readFile(new URL(file,root))).digest('hex');
const write=(file,value)=>fs.writeFile(new URL(file,root),JSON.stringify(value)+'\n');
const revision='ca96624a56bd078437bca8184e78163e5039ad19';
const catalog=await read('app/catalog.json');
const box=catalog.filter(a=>a.level==='region').reduce((b,a)=>[Math.min(b[0],a.bbox[0]),Math.min(b[1],a.bbox[1]),Math.max(b[2],a.bbox[2]),Math.max(b[3],a.bbox[3])],[180,90,-180,-90]);
const within=([x,y])=>x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3];
const rawCities=await read('work/ne-populated-places.geojson'),rawRivers=await read('work/ne-rivers.geojson');
const cityCountries=new Set(['IND','PAK','AFG','NPL','BGD','BTN','LKA','MDV','MMR','CHN']);
const cities=rawCities.features.filter(f=>f.geometry.type==='Point'&&within(f.geometry.coordinates)&&cityCountries.has(f.properties.ADM0_A3)).map(f=>{
 const p=f.properties,id='ne-city-'+p.NE_ID;
 return {type:'Feature',id,properties:{id,name:p.NAME_EN||p.NAME,population:p.POP_MAX||0,rank:p.SCALERANK,country:p.ADM0NAME,province:p.ADM1NAME||'',capital:!!p.ADM0CAP,major:(p.POP_MAX||0)>=100000||!!p.ADM0CAP,wikidata:p.WIKIDATAID||'',source:'Natural Earth 1:10m populated places · public domain',sourceId:p.NE_ID},geometry:f.geometry};
});
function points(geometry){return geometry.type==='LineString'?geometry.coordinates:geometry.coordinates.flat();}
const rivers=rawRivers.features.filter(f=>['LineString','MultiLineString'].includes(f.geometry.type)&&points(f.geometry).some(within)).map((f,i)=>({type:'Feature',id:'ne-river-'+(f.properties.rivernum??i)+'-'+i,properties:{id:'ne-river-'+(f.properties.rivernum??i)+'-'+i,name:f.properties.name_en||f.properties.name||'Unnamed source river',rank:f.properties.scalerank,source:'Natural Earth 1:10m rivers and lake centerlines · public domain',sourceRiverNumber:f.properties.rivernum,sourceIndex:rawRivers.features.indexOf(f)},geometry:f.geometry}));
await write('public/data/cities.geojson',{type:'FeatureCollection',features:cities});
await write('public/data/rivers.geojson',{type:'FeatureCollection',features:rivers});
await write('app/atlas-overlay-sources.json',{source:'Natural Earth',license:'Public domain',licenseUrl:'https://www.naturalearthdata.com/about/terms-of-use/',retrieved:'2026-10-08',revision,bbox:box,notes:'Regional 1:10m overview, not current population statistics, municipal extents or detailed river surveying. Major-city defaults select source population >=100,000 plus national capitals. Display clips overlays to the selected source outlines; original coordinates are retained in the bundled files.',inputs:await Promise.all([['work/ne-populated-places.geojson','ne_10m_populated_places.geojson'],['work/ne-rivers.geojson','ne_10m_rivers_lake_centerlines.geojson']].map(async([file,upstream])=>({file:file.split('/').at(-1),url:'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/'+revision+'/geojson/'+upstream,sha256:await hash(file)}))),outputs:await Promise.all(['cities','rivers'].map(async kind=>({kind,file:kind+'.geojson',count:(kind==='cities'?cities:rivers).length,sha256:await hash('public/data/'+kind+'.geojson')})))});
console.log('Built '+cities.length+' city points ('+cities.filter(f=>f.properties.major).length+' major/capital source points) and '+rivers.length+' river records for the expanded atlas.');
