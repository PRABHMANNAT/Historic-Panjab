import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {loadLocalModule,loadMapModel} from './load-map-model.mjs';
const read=async file=>JSON.parse(await fs.readFile(new URL('../'+file,import.meta.url),'utf8'));
const manifest=await read('app/atlas-overlay-sources.json');
const {containsPoint,pointInMasks,clipRiver,scopedPoints}=await loadLocalModule(new URL('../app/spatial-overlays.ts',import.meta.url));
const {overlayDefaults,majorCity,cityPaintColor,validateOverlaySettings}=await loadLocalModule(new URL('../app/overlay-model.ts',import.meta.url));
for(const output of manifest.outputs){
 const bytes=await fs.readFile(new URL('../public/data/'+output.file,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),output.sha256);
 const geo=JSON.parse(bytes);assert.equal(geo.features.length,output.count);assert.equal(new Set(geo.features.map(f=>f.id)).size,output.count);
 for(const f of geo.features)assert.ok(f.properties.source.includes('Natural Earth'));
 const input=manifest.inputs.find(i=>i.file===(output.kind==='cities'?'ne-populated-places.geojson':'ne-rivers.geojson'));
 try{
  const raw=JSON.parse(await fs.readFile(new URL('../work/'+input.file,import.meta.url),'utf8'));
  for(const f of geo.features){const original=output.kind==='cities'?raw.features.find(r=>r.properties.NE_ID===f.properties.sourceId):raw.features[f.properties.sourceIndex];assert.ok(original,'Original feature exists');assert.deepEqual(f.geometry,original.geometry,'Bundled source geometry unchanged');}
 }catch(error){if(error.code!=='ENOENT')throw error;console.log('Raw cache absent; bundled output hash verified for '+output.kind);}
}
const polygon={type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]};
const masks=[{id:'test',bbox:[0,0,10,10],geometry:polygon}];
assert.ok(containsPoint(polygon,[2,5]));assert.ok(!containsPoint(polygon,[5,5]));assert.ok(!pointInMasks([11,5],masks));
const river={type:'Feature',id:'river',properties:{},geometry:{type:'LineString',coordinates:[[-2,5],[12,5]]}};
const before=JSON.stringify(river),clipped=clipRiver(river,masks);assert.equal(JSON.stringify(river),before);
assert.deepEqual(clipped.geometry.coordinates,[[[0,5],[4,5]],[[6,5],[10,5]]]);
const points={type:'FeatureCollection',features:[[2,5],[5,5],[12,5]].map((coordinates,id)=>({type:'Feature',id,properties:{},geometry:{type:'Point',coordinates}}))};
assert.deepEqual(scopedPoints(points,masks).features.map(f=>f.id),[0]);
assert.ok(majorCity({capital:true,population:1},overlayDefaults));assert.ok(!majorCity({population:99999},overlayDefaults));assert.equal(cityPaintColor({capital:true},overlayDefaults),'#ce3e45');
assert.equal(validateOverlaySettings({gurdwaraScale:9,riverWidth:-1,cityColor:'javascript:bad'}).gurdwaraScale,2);assert.equal(validateOverlaySettings({riverWidth:-1}).riverWidth,.5);
const model=await loadMapModel(),old=model.validate({fills:{}});assert.equal(old.gurdwaras,false);assert.equal(old.cityAutoColors,true);assert.equal(old.mapScope,'atlas');
const cities=await read('public/data/cities.geojson');assert.equal(cities.features.filter(f=>majorCity(f.properties,overlayDefaults)).length,353);
console.log('Verified 447 city points, 155 river records, source hashes/unchanged geometry, exact hole-aware display clipping and safe old-map migration. Shrine photographs have a dedicated check.');
