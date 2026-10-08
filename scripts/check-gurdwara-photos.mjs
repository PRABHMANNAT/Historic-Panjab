import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {resolveObjectURL} from 'node:buffer';
import {loadLocalModule,loadMapModel} from './load-map-model.mjs';
const read=async file=>JSON.parse(await fs.readFile(new URL('../'+file,import.meta.url),'utf8'));
const catalog=[...await read('app/gurdwara-data.json'),...await read('app/gurdwara-additions.json')],manifest=await read('app/gurdwara-photo-sources.json');
const {photoMarkerSvg}=await loadLocalModule(new URL('../app/gurdwara-photos.ts',import.meta.url));
const ids=new Set();
for(const photo of manifest.photos){
 assert.ok(catalog.some(g=>g.id===photo.id));assert.ok(!ids.has(photo.id));ids.add(photo.id);
 assert.match(photo.file,new RegExp('^/photos/gurdwaras/'+photo.id+'\\.(jpg|png)$'));
 assert.match(photo.sourceUrl,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
 assert.ok(photo.author&&photo.title&&photo.identityEvidence);
 if(photo.captureYear===2026){assert.match(photo.captureDateEvidence.value,/2026/);assert.equal(photo.captureDateEvidence.field,'DateTimeOriginal');assert.ok(!/upload/i.test(photo.captureDateEvidence.value));}
 assert.match(photo.license,/CC BY|CC0|Public domain/i);
 const bytes=await fs.readFile(new URL('../public'+photo.file,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),photo.sha256);
 assert.ok(bytes.length>3000&&bytes.length<2500000,'Reasonable local photo asset size');
 assert.ok(bytes.subarray(0,2).toString('hex')==='ffd8'||bytes.subarray(1,4).toString()==='PNG','Real JPEG/PNG, not an error page');
 const svg=photoMarkerSvg('featured','#237e94','data:image/jpeg;base64,'+bytes.toString('base64'),photo.id);
 assert.ok(svg.includes('<image href="data:image/'));assert.ok(svg.includes('id="photo-'+photo.id+'"'));
 assert.ok(!svg.includes('PHOTO</text>'),'Real photo replaces the fallback badge');
}
for(const site of catalog.filter(g=>g.tier!=='historic'))assert.ok(ids.has(site.id),'Five Takhts and all featured shrines have photographs: '+site.id);
assert.ok(photoMarkerSvg('historic','#237e94','').includes('UNAVAILABLE'),'Missing photo has a neutral, explicit placeholder');
assert.ok(!photoMarkerSvg('historic','red" onload="alert(1)','https://example.com/wrong-shrine.jpg','" onload="alert(1)').includes('onload='),'Photo marker inputs cannot inject SVG');
console.log(`Verified ${ids.size} local photographs, site associations, licenses, capture-date evidence, hashes, embedded SVG photos, all featured/Takht sites, and safe missing-photo handling.`);

// Exercise the real export path with local assets, without a server or a browser.
// Only the browser's file-reading/download boundary is replaced for this test.
const {initial}=await loadMapModel();
const {scopePreset}=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url));
const {exportMap}=await loadLocalModule(new URL('../app/export-map.ts',import.meta.url));
const previous={fetch:globalThis.fetch,FileReader:globalThis.FileReader,document:globalThis.document};
let exported;
try{
 globalThis.fetch=async input=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;try{return new Response(await fs.readFile(new URL('../public'+url,import.meta.url)),{headers:{'Content-Type':url.endsWith('.jpg')?'image/jpeg':url.endsWith('.png')?'image/png':'application/json'}});}catch{return new Response('',{status:404});}};
 globalThis.FileReader=class {readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onload();}).catch(()=>this.onerror());}};
 // oxlint-disable-next-line typescript/no-deprecated -- Intentional browser download mock; the project's Worker DOM types mark this property deprecated.
 globalThis.document={createElement:tag=>{assert.equal(tag,'a');return {click(){exported=resolveObjectURL(this.href);}};}};
 const doc={...structuredClone(initial),mapScope:'single',scopeRegion:'in-punjab',gurdwaras:true,gurdwaraFilter:'all',names:false,gurdwaraLabels:false,regions:Object.fromEntries(Object.entries(initial.regions).map(([id,r])=>[id,{...r,show:id==='in-punjab',district:false,tehsil:false,province:false,uc:false}]))};
 await exportMap(doc,{getData:()=>({})},'svg',1400,false);
 const svg=await exported.text();
 assert.ok(svg.includes('data-gurdwara="gs-harmandir-sahib"'),'Expected site remains in geographic export');
 assert.ok(svg.includes('<image href="data:image/jpeg;base64,'),'Photo bytes are embedded');
 assert.ok(svg.includes('gurdwara-photo-sources.json')&&svg.includes('&quot;photographs&quot;'),'Credits survive export');
 assert.ok(!svg.includes('<image href="http'),'No remote image dependencies');
 for(const [region,expectedId]of [['in-himachal','gs-gsa014'],['bd-bangladesh','gs-gsa050']]){
  const grouped={...doc,...scopePreset(doc,'single',{scopeRegion:region}),gurdwaraFilter:'directory-famous'};
  if(region==='bd-bangladesh')grouped.gurdwaraFilter='directory-historic';
  await exportMap(grouped,{getData:()=>({})},'svg',1000,false);
  const addedSvg=await exported.text();
  assert.ok(addedSvg.includes('data-gurdwara="'+expectedId+'"'),'New directory shrine is exported in its region: '+expectedId);
  assert.ok(addedSvg.includes('<image href="data:image/jpeg;base64,'),'New site photo is embedded');
  assert.ok(!addedSvg.includes('data-gurdwara="gs-harmandir-sahib"'),'Unselected region shrine is excluded');
 }
 console.log('Verified real SVG exports with embedded photographs, new directory sites, curated filters, geographic selection and attribution metadata.');
}finally{Object.assign(globalThis,previous);}
