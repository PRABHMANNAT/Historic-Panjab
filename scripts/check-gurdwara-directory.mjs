import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {loadLocalModule,loadMapModel} from './load-map-model.mjs';
const root=new URL('../',import.meta.url),read=async file=>JSON.parse(await fs.readFile(new URL(file,root),'utf8'));
const directory=await read('app/gurdwara-directory.json'),links=(await read('app/gurdwara-directory-links.json')).links;
const additions=await read('app/gurdwara-additions.json'),evidence=(await read('app/gurdwara-addition-sources.json')).coordinateEvidence;
const base=await read('app/gurdwara-data.json'),geo=await read('public/data/gurdwaras.geojson');
const catalog=await loadLocalModule(new URL('app/gurdwara-catalog.ts',root));
const overlay=await loadLocalModule(new URL('app/overlay-model.ts',root));
const scope=await loadLocalModule(new URL('app/scope-model.ts',root));
const spatial=await loadLocalModule(new URL('app/spatial-overlays.ts',root));
const model=await loadMapModel();
assert.equal(directory.gurdwaras.length,300);assert.equal(catalog.directoryEntries.length,300);
assert.equal(new Set(directory.gurdwaras.map(site=>site.id)).size,300);
assert.ok(!Object.hasOwn(directory,'codex_instructions'),'source instructions are not application data');
assert.deepEqual(Object.fromEntries(Object.keys(directory.statistics.by_country).map(country=>[country,directory.gurdwaras.filter(site=>site.country===country).length])),directory.statistics.by_country);
for(const site of directory.gurdwaras){assert.equal(site.latitude,null);assert.equal(site.longitude,null);assert.ok(site.source_ids.length);for(const id of site.source_ids)assert.ok(directory.sources.some(source=>source.id===id&&source.url.startsWith('https://')));}
for(const [name,count]of [['five_takhts',5],['top_20_famous',20],['top_50_important_historic',50]]){const ids=directory.curated_lists[name];assert.equal(new Set(ids).size,count);for(const id of ids)assert.ok(directory.gurdwaras.some(site=>site.id===id));}
assert.equal(new Set(links.map(link=>link.directoryId)).size,links.length);
assert.equal(new Set(links.map(link=>link.mapId)).size,links.length);
assert.equal(catalog.locatedDirectoryCount,108);assert.equal(catalog.legacyOnlyGurdwaras.length,15);
assert.equal(catalog.mappedGurdwaras.length,123);assert.equal(additions.length,23);
assert.equal(geo.features.length,123);assert.equal(new Set(geo.features.map(f=>f.id)).size,123);
for(const entry of catalog.directoryEntries){assert.equal(!!entry.mapSite,links.some(link=>link.directoryId===entry.id));if(entry.mapSite)assert.ok(geo.features.some(f=>f.id===entry.mapSite.id));}
for(const site of base)assert.deepEqual(geo.features.find(f=>f.id===site.id).properties,site,'original sourced sites are unchanged');
for(const site of additions){
 const proof=evidence.find(e=>e.id===site.id);assert.ok(proof);assert.deepEqual(site.coordinates,proof.coordinates);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(proof.raw)).digest('hex'),proof.rawSha256);
 const raw=proof.sourceIdentity.startsWith('osm:')?(proof.raw.center||proof.raw):proof.raw.claim.mainsnak.datavalue.value;
 assert.deepEqual(site.coordinates,proof.sourceIdentity.startsWith('osm:')?[raw.lon,raw.lat]:[raw.longitude,raw.latitude]);
 assert.deepEqual(geo.features.find(f=>f.id===site.id).geometry.coordinates,site.coordinates);
}
for(const [filter,count]of [['directory-famous',20],['directory-historic',45]]){
 const doc=model.validate({...model.initial,gurdwaraFilter:filter});assert.equal(doc.gurdwaraFilter,filter);
 assert.equal(catalog.mappedGurdwaras.filter(site=>overlay.shrineAllowed(site,doc)).length,count);
 assert.deepEqual(model.validate(JSON.parse(JSON.stringify(doc))).gurdwaraFilter,filter);
}
// Showing a directory site must select a region that actually contains its pin.
const cache={};
for(const site of catalog.mappedGurdwaras){
 const region=catalog.shrineRegion(site.id);assert.ok(region,'region for '+site.id);
 const doc={...model.initial,...scope.scopePreset(model.initial,'single',{scopeRegion:region})};
 for(const key of scope.scopeGeometryKeys(doc))cache[key]??=await read('public/data/'+key+'.geojson');
 assert.ok(spatial.pointInMasks(site.coordinates,spatial.overlayMasks(doc,cache)),site.id+' is in its Show-on-map region');
}
console.log('Verified 300 directory records, 108 identity links, 23 new coordinate proofs, 123 unchanged/published map points, curated filters, saved settings and geographic Show-on-map targets.');
