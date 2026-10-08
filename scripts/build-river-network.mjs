import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const box=[60,-1,109,40],tiles=new Map(),ids=new Set(),sources=[];
await fs.mkdir('public/data/river-network',{recursive:true});
for(const region of ['as','eu']){
 const shp=await fs.readFile(`work/riveratlas/RiverATLAS_v10_${region}.shp`),attrs=await fs.readFile(`work/riveratlas/RiverATLAS_v10_${region}.attrs`);
 sources.push({region,geometrySha256:createHash('sha256').update(shp).digest('hex'),attributesSha256:createHash('sha256').update(attrs).digest('hex')});
 let row=0;
 for(let i=100;i<shp.length;row++){
  const size=shp.readInt32BE(i+4)*2,start=i+8;i=start+size;
  const order=attrs.readUInt32LE(row*16+4);if(order<3)continue;
  if(shp.readInt32LE(start)!==3)throw Error('Expected PolyLine');
  const b=Array.from({length:4},(_,j)=>shp.readDoubleLE(start+4+j*8));
  if(b[0]>box[2]||b[2]<box[0]||b[1]>box[3]||b[3]<box[1])continue;
  const id=attrs.readUInt32LE(row*16);if(ids.has(id))throw Error('Duplicate RiverATLAS ID');ids.add(id);
  const numParts=shp.readInt32LE(start+36),numPoints=shp.readInt32LE(start+40),offset=start+44+numParts*4;
  const parts=Array.from({length:numParts},(_,j)=>shp.readInt32LE(start+44+j*4));parts.push(numPoints);
  const coordinates=parts.slice(0,-1).map((first,j)=>Array.from({length:parts[j+1]-first},(_,k)=>[+shp.readDoubleLE(offset+(first+k)*16).toFixed(6),+shp.readDoubleLE(offset+(first+k)*16+8).toFixed(6)]));
  const f={type:'Feature',id:'riveratlas-'+id,bbox:b,properties:{id:'riveratlas-'+id,order,discharge:attrs.readFloatLE(row*16+8)},geometry:{type:'MultiLineString',coordinates}};
  for(let x=Math.max(60,Math.floor(b[0]/5)*5);x<=Math.min(105,Math.floor(b[2]/5)*5);x+=5)for(let y=Math.max(-5,Math.floor(b[1]/5)*5);y<=Math.min(40,Math.floor(b[3]/5)*5);y+=5){const key=x+'_'+y;if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(f);}
 }
 if(row*16!==attrs.length)throw Error('Geometry/attribute record mismatch');
}
const output=[];
for(const [key,features] of [...tiles].sort(([a],[b])=>a.localeCompare(b))){const text=JSON.stringify({type:'FeatureCollection',features})+'\n',file=key+'.geojson';await fs.writeFile('public/data/river-network/'+file,text);const [x,y]=key.split('_').map(Number);output.push({file,bbox:[x,y,x+5,y+5],count:features.length,sha256:createHash('sha256').update(text).digest('hex')});}
await fs.writeFile('app/river-network-sources.json',JSON.stringify({source:'RiverATLAS v1.0 (HydroATLAS)',url:'https://www.hydrosheds.org/hydroatlas',download:'https://ndownloader.figshare.com/files/20087486',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',citation:'Linke et al. (2019). Global hydro-environmental sub-basin and river reach characteristics at high spatial resolution. Scientific Data 6:283. https://doi.org/10.1038/s41597-019-0300-6',retrieved:'2026-10-09',bbox:box,count:ids.size,minOrder:3,notes:'Asia and Europe/Middle East source reaches intersecting the atlas extent; Strahler order >=3. Derived from HydroSHEDS at 15 arc-seconds (~500 m). Coordinates rounded to six decimals for packaging; no smoothing. Tributaries below order 3, canals and some small island streams are absent. Reaches have no names; optional names use the separate generalized Natural Earth layer. Discharge is a historical modeled estimate, not live flow. Tiling duplicates border-crossing reaches; clients deduplicate IDs before rendering.',sources,tiles:output})+'\n');
console.log(ids.size,'unique reaches;',tiles.size,'tiles');
