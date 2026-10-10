import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import polygonClipping from 'polygon-clipping';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';

const model=await loadMapModel();
const seam=await loadLocalModule(new URL('../app/boundary-seam-model.ts',import.meta.url));
const spatial=await loadLocalModule(new URL('../app/spatial-overlays.ts',import.meta.url));
const visibility=await loadLocalModule(new URL('../app/visibility-geometry.ts',import.meta.url));
const scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url));
const manifest=seam.boundarySeamSources,raw={},aligned={};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const polygons=geometry=>geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
const owners=(collection,point)=>collection.features.filter(f=>spatial.containsPoint(f.geometry,point));
const ringArea=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
const area=coordinates=>coordinates.reduce((sum,p)=>sum+ringArea(p[0])-p.slice(1).reduce((n,r)=>n+ringArea(r),0),0);

for(const [key,expected]of Object.entries(manifest.inputs)){
 const bytes=await fs.readFile(new URL('../public/data/'+key+'.geojson',import.meta.url));
 assert.equal(hash(bytes),expected,'Original source is unchanged: '+key);
 raw[key]=JSON.parse(bytes);aligned[key]=raw[key];
}
for(const [key,layer]of Object.entries(manifest.layers)){
 const bytes=await fs.readFile(new URL('../public/data/boundary-seams/'+key+'.geojson',import.meta.url));
 assert.equal(hash(bytes),layer.sha256,'Display asset matches provenance: '+key);
 const override=JSON.parse(bytes);assert.equal(override.features.length,layer.count);
 assert.deepEqual(override.features.map(f=>String(f.id)),layer.ids);
 aligned[key]=seam.mergeBoundaryDisplay(raw[key],override);
 assert.deepEqual(aligned[key].features.map(f=>f.id),raw[key].features.map(f=>f.id));
 for(const [i,f]of aligned[key].features.entries()){
  assert.equal(f.properties,raw[key].features[i].properties,'Source identities and label data survive: '+f.id);
  if(layer.ids.includes(String(f.id))){
   assert.deepEqual(seam.boundaryDisplayBounds(String(f.id),model.areaById.get(String(f.id)).bbox),f.bbox);
   assert.ok(spatial.containsPoint(f.geometry,f.properties.center),'Original label remains in '+f.id);
  }
 }
}
const india=raw['in-punjab-region'].features[0].geometry;
const pakistan=raw['pk-punjab-region'].features[0].geometry;
const corrected=aligned['pk-punjab-region'].features[0].geometry;
const before=polygonClipping.union(polygons(india),polygons(pakistan));
const after=polygonClipping.union(polygons(india),polygons(corrected));
assert.equal(before.reduce((n,p)=>n+p.length-1,0),manifest.frontierGaps.count);
assert.equal(manifest.frontierGaps.count,59,'The regression fixture still represents the original 59 gaps');
assert.ok(after.every(p=>p.slice(1).every(r=>ringArea(r)<1e-10)),'No enclosed unassigned border gaps remain');
assert.ok(area(polygonClipping.intersection(polygons(india),polygons(corrected)))<1e-10,'Two sides have no duplicate overlap');
// Closing internal holes must not expand the combined external outline.
assert.ok(area(polygonClipping.xor(before.map(p=>[p[0]]),after.map(p=>[p[0]])))<1e-9);
const tehsilUnion=polygonClipping.union(...aligned['in-punjab-tehsil'].features.map(f=>polygons(f.geometry)));
assert.ok(area(polygonClipping.xor(tehsilUnion,polygons(india)))<1e-9,'Indian tehsils cover the canonical state outline');

for(const probe of manifest.frontierGaps.probes){
 assert.equal(spatial.containsPoint(india,probe),false);
 assert.equal(spatial.containsPoint(pakistan,probe),false);
 for(const key of ['pk-punjab-region','pk-punjab-district','pk-punjab-tehsil','pk-country-province','pk-country-district','pk-country-tehsil']){
  assert.equal(owners(aligned[key],probe).length,1,'Exactly one existing area owns the formerly white gap: '+key+' '+probe);
 }
}
for(const f of aligned['pk-country-district'].features){
 const counterpart=aligned['pk-punjab-district'].features.find(p=>p.id===f.properties.sourceCode);
 if(counterpart)assert.ok(area(polygonClipping.xor(polygons(f.geometry),polygons(counterpart.geometry)))<1e-9,'Full-country and regional district agree: '+f.id);
}
const probe=[74.64067038262698,31.439573915693014];
assert.equal(owners(aligned['pk-punjab-district'],probe)[0].id,'PK617','The Lahore gap belongs to the existing Lahore district');
const doc={...model.initial,...scope.scopePreset(model.initial,'combination',{scopeRegions:['in-punjab','pk-punjab']}),hidden:[]};
assert.ok(spatial.pointInMasks(probe,spatial.overlayMasks(doc,aligned)),'Overlays include the repaired frontier');
const hidden={...doc,hidden:['PK617']};
assert.ok(!spatial.pointInMasks(probe,spatial.overlayMasks(hidden,aligned)),'Hide Lahore also hides its repaired border sliver');
const shown=visibility.visibleBoundaries(aligned['pk-punjab-tehsil'],hidden,visibility.hiddenMasks(hidden,aligned));
assert.equal(owners(shown,probe).length,0,'Hidden district clips its tehsil display geometry');
assert.equal(aligned['pk-lahore-study-tehsil'].features.length,3,'Partial Lahore case-study selection stays partial');
assert.deepEqual(aligned['pk-lahore-study-tehsil'].features.map(f=>f.properties.name),raw['pk-lahore-study-tehsil'].features.map(f=>f.properties.name));
assert.throws(()=>seam.mergeBoundaryDisplay(raw['pk-punjab-district'],{type:'FeatureCollection',features:[{...aligned['pk-punjab-district'].features[0],id:'unknown-area'}]}),/Invalid/);
console.log('Verified 59 closed border gaps, unchanged outer outline and source hashes, no cross-border overlaps, unique district/tehsil owners, country aliases, overlay masks, Hide/Unhide and original area identities.');
