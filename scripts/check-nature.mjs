import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolveObjectURL} from 'node:buffer';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const model=await loadMapModel(),scope=await loadLocalModule(new URL('app/scope-model.ts',root)),spatial=await loadLocalModule(new URL('app/spatial-overlays.ts',root)),nature=await loadLocalModule(new URL('app/nature-model.ts',root));
const {prepareNature}=await loadLocalModule(new URL('app/nature-data.ts',root));
globalThis.fetch=async path=>new Response(await fs.readFile(new URL('public'+path,root)),{headers:{'Content-Type':String(path).endsWith('.png')?'image/png':'application/json'}});
const selected=(ids,extra={})=>({...model.initial,...scope.scopePreset(model.initial,'selection',{scopeAreas:ids}),...extra});
const province=model.areas.find(a=>a.region==='pk-country'&&a.level==='province'&&a.name==='Sindh');assert.ok(province);
const provinceDoc=selected([province.id]);
assert.ok(model.areas.some(a=>a.level==='district'&&model.visible(a,provinceDoc)));
assert.ok(!model.visible(model.areaById.get('pk-country'),provinceDoc),'country backdrop must not appear outside the province');
for(const a of model.areas.filter(a=>model.visible(a,provinceDoc)))assert.ok(scope.areaBelongsTo(a,province.id));
const division=model.areas.find(a=>a.level==='division'&&a.region==='pk-country'&&a.name==='Lahore');assert.ok(division);
const divisionDoc=selected([division.id]);
const divisionSource=(await read('app/pakistan-division-areas.json')).find(d=>d.id===division.id);
assert.deepEqual(model.areas.filter(a=>a.level==='district'&&model.visible(a,divisionDoc)).map(a=>a.id).sort(),divisionSource.districtIds.sort());
assert.ok(model.visible(division,{...divisionDoc,regions:{...divisionDoc.regions,'pk-country':{...divisionDoc.regions['pk-country'],division:false}}}),'selected division remains a primary outline');
const mixed=selected([province.id,'lahore-division']);assert.ok(model.visible(model.areaById.get('PK617'),mixed),'full-country province must not suppress a separate local snapshot in the group');
assert.deepEqual(scope.selectionAreas(selected(['in-maharashtra','in-maharashtra-d-496'])).map(a=>a.id),['in-maharashtra']);
const saved=selected([province.id],{mountains:true,plateaus:true,forests:true,rivers:true,riverDetail:'tributaries',natureOpacity:.6,fills:{PK617:{color:'#123456',pattern:'dots'}}});
const restored=model.validate(JSON.parse(JSON.stringify(saved)));for(const key of ['scopeAreas','mountains','plateaus','forests','riverDetail','natureOpacity','fills'])assert.deepEqual(restored[key],saved[key]);
const invalid=model.validate({fills:{},scopeAreas:['missing',null,province.id,province.id],natureOpacity:99,forestColor:'url(bad)',riverDetail:'invented'});assert.deepEqual(invalid.scopeAreas,[province.id]);assert.equal(invalid.natureOpacity,.85);assert.equal(invalid.forestColor,model.initial.forestColor);
const old=model.validate({fills:{}});assert.equal(old.forests,false);assert.deepEqual(old.scopeAreas,[]);
const manifest=await read('app/river-network-sources.json'),unique=new Set();
for(const tile of manifest.tiles){const bytes=await fs.readFile(new URL('public/data/river-network/'+tile.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),tile.sha256);for(const f of JSON.parse(bytes).features){assert.ok(f.properties.order>=3);assert.ok(f.geometry.coordinates.every(line=>line.length>1));unique.add(f.id);}}
assert.equal(unique.size,manifest.count);
const natural=await read('app/nature-sources.json');assert.equal(createHash('sha256').update(await fs.readFile(new URL('public/data/tree-cover.png',root))).digest('hex'),natural.forest.sha256);
const metadata=await sharp(await fs.readFile(new URL('public/data/tree-cover.png',root))).metadata();assert.equal(metadata.width,natural.forest.width);assert.equal(metadata.height,natural.forest.height);
const landforms=await read('public/data/landforms.geojson');assert.equal(landforms.features.length,39);
const hole={id:'hole',bbox:[0,0,10,10],geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}};
const land={type:'FeatureCollection',features:[{type:'Feature',id:'test-land',properties:{kind:'mountain'},geometry:{type:'Polygon',coordinates:[[[-1,-1],[11,-1],[11,11],[-1,11],[-1,-1]]]}}]};
const clipped=nature.scopedLandforms(land,[hole]);assert.ok(spatial.containsPoint(clipped.features[0].geometry,[2,5]));assert.ok(!spatial.containsPoint(clipped.features[0].geometry,[5,5]));assert.ok(!spatial.containsPoint(clipped.features[0].geometry,[11,5]));
assert.ok(spatial.containsPoint(clipped.features[0].geometry,nature.interiorLabel(clipped.features[0].geometry)));
const line={type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:[[[1,1],[2,2]],[[7,7],[8,8]]]}};assert.deepEqual(spatial.clipRiver(line,[hole]).geometry,line.geometry);
assert.equal(spatial.clipRiver({...line,geometry:{type:'LineString',coordinates:[[4.5,4.5],[5.5,5.5]]}},[hole]),undefined);
const {distanceKm}=await loadLocalModule(new URL('app/map-tools.ts',root));assert.ok(Math.abs(distanceKm([[0,0],[1,0]])-111.195)<.01);assert.equal(distanceKm([]),0);
const cache={};async function masksFor(doc){await Promise.all(scope.scopeGeometryKeys(doc).map(async key=>{cache[key]??=await read('public/data/'+key+'.geojson');}));return spatial.overlayMasks(doc,cache);}
for(const [name,ids] of [['Delhi',['in-delhi']],['Maharashtra',['in-maharashtra']],['Andaman',['in-andaman-nicobar']],['Sindh',[province.id]],['Lahore division',[division.id]],['Grouped territories',['in-maharashtra',province.id]]]){
 const d=selected(ids),masks=await masksFor(d),start=performance.now();
 const data=await prepareNature({key:name,masks,network:true,landforms:true,detail:'tributaries'});assert.ok(data.rivers.features.length>0,name+' river coverage');
 // Test interior segment points, avoiding floating-point ambiguity on the mask edge.
 for(const f of data.rivers.features.filter((_,i)=>i%17===0))for(const line of f.geometry.coordinates){const a=line[0],b=line[1],mid=[a[0]*.49+b[0]*.51,a[1]*.49+b[1]*.51];assert.ok(spatial.pointInMasks(mid,masks),name+' clips rivers to selected polygons');}
 console.log(name+': '+data.rivers.features.length+' river reaches, '+data.landforms.features.length+' landforms; '+Math.round(performance.now()-start)+' ms');
}
// Run the actual SVG exporter with local assets; do not replace its rendering logic.
globalThis.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload();}).catch(e=>this.onerror(e));}};
let exported;globalThis.document={createElement:tag=>{assert.equal(tag,'a');return {click(){exported=resolveObjectURL(this.href);}};}};
const {exportMap}=await loadLocalModule(new URL('app/export-map.ts',root));
const doc=selected(['in-maharashtra'],{title:'Maharashtra · political + nature',rivers:true,riverDetail:'regional',mountains:true,plateaus:true,forests:true,names:false,natureOpacity:.45});
await exportMap(doc,{bounds:()=>scope.scopeFocusBounds(doc),getData:()=>cache},'svg',1400,false);
const svg=await exported.text();for(const feature of ['data-network-river','data-landform=','data-forest=','nature-scope','RiverATLAS','ESA WorldCover'])assert.ok(svg.includes(feature),feature+' exported');assert.ok(!svg.includes('data-area="in-punjab"'));
await fs.mkdir(new URL('outputs',root),{recursive:true});await fs.writeFile(new URL('outputs/maharashtra-nature.svg',root),svg);await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL('outputs/maharashtra-nature.png',root)));
console.log('Verified strict province/division/groups, migration, source hashes, hole-aware clipping, measurement, actual SVG export and rendered PNG.');
