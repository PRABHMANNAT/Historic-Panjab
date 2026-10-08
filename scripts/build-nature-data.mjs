import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const box=[60,-1,109,40],hash=b=>createHash('sha256').update(b).digest('hex');
const write=(file,data)=>fs.writeFile(file,JSON.stringify(data)+'\n');
const raw=JSON.parse(await fs.readFile('work/ne-physical-regions.geojson','utf8'));
const points=g=>g.type==='Polygon'?g.coordinates.flat():g.coordinates.flat(2);
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const bounds=g=>points(g).reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[180,90,-180,-90]);
const landforms=raw.features.filter(f=>['Range/mtn','Plateau','Foothills'].includes(f.properties.FEATURECLA)&&overlap(bounds(f.geometry),box)).map(f=>({type:'Feature',id:'ne-landform-'+f.properties.NE_ID,bbox:bounds(f.geometry),properties:{id:'ne-landform-'+f.properties.NE_ID,name:f.properties.NAME_EN||f.properties.NAME,kind:f.properties.FEATURECLA==='Plateau'?'plateau':'mountain',sourceClass:f.properties.FEATURECLA},geometry:f.geometry}));
await write('public/data/landforms.geojson',{type:'FeatureCollection',features:landforms});
// Reproducible cartographic tree-cover overview from ESA's published RGB WMS.
// This is an overview image, NOT a resampling of the analytical 10 m class grid.
const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*6378137;
const extent=[box[0]*Math.PI/180*6378137,merc(box[1]),box[2]*Math.PI/180*6378137,merc(box[3])];
const size=4096,tile=1024,inputs=[],composite=[];
await fs.mkdir('work/worldcover',{recursive:true});
for(let y=0;y<4;y++)await Promise.all(Array.from({length:4},async(_,x)=>{
 const b=[extent[0]+(extent[2]-extent[0])*x/4,extent[3]-(extent[3]-extent[1])*(y+1)/4,extent[0]+(extent[2]-extent[0])*(x+1)/4,extent[3]-(extent[3]-extent[1])*y/4];
 const url='https://mapproxy.terrascope.be/mapproxy/service?'+new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:'esa-worldcover-map-10m-2021-v2_map',STYLES:'',SRS:'EPSG:3857',BBOX:b.join(','),WIDTH:String(tile),HEIGHT:String(tile),FORMAT:'image/png'});
 const file=`work/worldcover/${x}-${y}.png`;let input;try{input=await fs.readFile(file);}catch{const r=await fetch(url);if(!r.ok)throw Error('WorldCover '+r.status);input=Buffer.from(await r.arrayBuffer());await fs.writeFile(file,input);}
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(info.width!==tile||info.height!==tile)throw Error('Unexpected WMS tile size');
 for(let i=0;i<data.length;i+=4){const tree=data[i]<=15&&data[i+1]>=35&&data[i+1]<=130&&data[i+2]<=15;data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=tree?255:0;}
 composite.push({input:await sharp(data,{raw:{width:tile,height:tile,channels:4}}).png().toBuffer(),left:x*tile,top:y*tile});inputs.push({tile:[x,y],url,sha256:hash(input)});
}));
const forest=await sharp({create:{width:size,height:size,channels:4,background:'#00000000'}}).composite(composite).png().toBuffer();
await fs.writeFile('public/data/tree-cover.png',forest);
await write('app/nature-sources.json',{retrieved:'2026-10-09',landforms:{source:'Natural Earth 1:10m physical label areas',url:'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/',revision:'ca96624a56bd078437bca8184e78163e5039ad19',license:'Public domain',count:landforms.length,note:'Approximate named mountain/foothill and plateau regions, not terrain contours or surveyed landform boundaries.',sha256:hash(await fs.readFile('public/data/landforms.geojson'))},forest:{source:'ESA WorldCover 2021 v200 · Terrascope WMS',url:'https://esa-worldcover.org/en/data-access',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',credit:'© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',bbox:box,projection:'EPSG:3857',width:size,height:size,pixelSizeMeters:(extent[2]-extent[0])/size,file:'/data/tree-cover.png',sha256:hash(forest),note:'Cartographic RGB overview at approximately 1.3 km map pixels, derived from the published 2021 WMS. Green tree-cover pixels (R/B ≤15, G 35–130) are retained as an alpha mask; other classes are transparent. Not a 10 m forest inventory or suitable for area measurement. Plantations/tree cover can be included; small woods and mixed overview pixels may be absent.',inputs:inputs.sort((a,b)=>a.tile[1]-b.tile[1]||a.tile[0]-b.tile[0])}});
console.log('Landforms:',landforms.length,'Tree-cover PNG:',forest.length,'bytes');
