import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import {read,hash} from './delhi-source-utils.mjs';
import {extent,labelPoint,polygons} from './geojson-utils.mjs';
import {loadMapModel} from './load-map-model.mjs';

const manifest=await read('app/neighbour-country-sources.json'),catalog=await read('app/catalog.json');
const byId=new Map(catalog.map(a=>[a.id,a]));
assert.equal(byId.size,catalog.length,'No duplicate atlas IDs');
const expected={
 'np-nepal':{region:1,province:7,district:77,tehsil:775},
 'bd-bangladesh':{region:1,province:8,district:64,tehsil:507},
 'bt-bhutan':{region:1,district:20,tehsil:205},
 'lk-sri-lanka':{region:1,province:9,district:25,tehsil:339},
 'mv-maldives':{region:1,district:21,tehsil:1556},
 'mm-myanmar':{region:1,province:18,district:80,tehsil:330},
 'af-afghanistan':{region:1,province:34,district:401},
 'pk-country':{region:1,province:7,district:160,tehsil:577},
 'cn-tibet':{region:1,province:1,district:7,tehsil:78},
 'cn-qinghai':{region:1,province:1,district:8,tehsil:41},
 'cn-sichuan':{region:1,province:1,district:21,tehsil:158},
};
assert.deepEqual(new Set(manifest.countries.map(c=>c.id)),new Set(Object.keys(expected)));
const collections=new Map();
let verified=0;
for(const country of manifest.countries){
 assert.deepEqual(country.counts,expected[country.id],country.id+' counts');
 assert.ok(country.url.startsWith('https://')&&country.licenseUrl.startsWith('https://'));
 assert.ok(country.notes.length>30&&country.validOn.length);
 for(const [level,count] of Object.entries(expected[country.id])){
  const key=country.id+'-'+level,record=manifest.layers[key];
  assert.ok(record);assert.equal(record.count,count);
  assert.equal(await hash('public/data/'+key+'.geojson'),record.sha256,key+' geometry provenance');
  assert.equal(await hash('public/data/'+key+'-labels.geojson'),record.labelsSha256,key+' label provenance');
  const geometry=await read('public/data/'+key+'.geojson'),labels=await read('public/data/'+key+'-labels.geojson');
  collections.set(key,geometry);assert.equal(geometry.features.length,count);assert.equal(labels.features.length,count);
  assert.equal(new Set(geometry.features.map(f=>f.id)).size,count);
  for(let i=0;i<count;i++){
   const f=geometry.features[i],a=f.properties;verified++;
   assert.deepEqual(a,byId.get(f.id));assert.equal(a.id,f.id);assert.equal(a.level,level);assert.equal(a.region,country.id);assert.ok(a.name&&a.sourceCode);
   assert.deepEqual(a.bbox,extent(f.geometry));assert.deepEqual(a.center,labelPoint(f.geometry));
   assert.deepEqual(labels.features[i],{...f,geometry:{type:'Point',coordinates:a.center}});
   for(const p of polygons(f.geometry))for(const ring of p){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));}
   if(level==='region')assert.equal(a.parent,'');
   else{
    const parent=byId.get(a.parent);assert.ok(parent,'Known parent: '+a.id);assert.equal(parent.region,country.id);
    assert.equal(a.sourceParentCode,parent.sourceCode,'Source parent code: '+a.id);
    assert.ok(parent.level==='region'||parent.level==='province'||parent.level==='district');
    if(country.iso==='chn'&&level==='district')assert.equal(a.sourceCode.slice(0,2),parent.sourceCode.slice(0,2));
    if(country.iso==='chn'&&level==='tehsil')assert.match(a.parentMethod,/spatial association/);
   }
  }
  // When reviewed caches are present, also prove that every generated geometry
  // is an unchanged source polygon, not just a self-consistent output hash.
  if(country.iso!=='chn'){
   const input=country.inputs.find(x=>x.file.endsWith(record.sourceLevel.slice(3)+'.geojson'));
   const directory=country.iso==='pak'?'work/pakistan-admin-source':'work/country-sources/'+country.iso;
   let raw;
   try{raw=await read(directory+'/'+input.file);}catch(error){if(error.code!=='ENOENT')throw error;}
   if(raw){
    assert.equal(await hash(directory+'/'+input.file),input.sha256);
    const sourceLevel=Number(record.sourceLevel.slice(3));
    const codes=new Map(raw.features.map(f=>[f.properties['adm'+sourceLevel+'_pcode'],f]));
    for(const f of geometry.features){
     const source=codes.get(f.properties.sourceCode);assert.ok(source);
     assert.deepEqual(f.geometry,source.geometry);assert.equal(f.properties.name,source.properties['adm'+sourceLevel+'_name']);
    }
   }
  }
 }
}
const chinese=manifest.countries.filter(c=>c.iso==='chn');
try{
 const [provinceRaw,prefectureRaw,countyRaw]=await Promise.all(['work/cn-atlas-provinces.json','work/cn-atlas-prefectures.json','work/china-ADM2.geojson'].map(read));
 const sourceMaps={region:new Map(provinceRaw.features.map(f=>[f.properties.id,f])),province:new Map(provinceRaw.features.map(f=>[f.properties.id,f])),district:new Map(prefectureRaw.features.map(f=>[f.properties.id,f])),tehsil:new Map(countyRaw.features.map(f=>[f.properties.shapeID,f]))};
 for(const country of chinese){
  for(const input of country.inputs)assert.equal(await hash('work/'+input.file),input.sha256,'Reviewed Chinese source cache');
  for(const level of ['region','province','district','tehsil'])for(const f of collections.get(country.id+'-'+level).features){
   const source=sourceMaps[level].get(f.properties.sourceCode);assert.ok(source);assert.deepEqual(f.geometry,source.geometry,'Unchanged Chinese source geometry');
  }
  assert.deepEqual(country.unlinkedCountyAreas,[]);
 }
}catch(error){if(error.code!=='ENOENT')throw error;}
for(const view of manifest.views){
 const f=(await read('public/data/'+view.id+'-region.geojson')).features[0];
 assert.deepEqual(f.properties,byId.get(view.id));assert.deepEqual(f.properties.bbox,view.bbox);
 for(const input of view.inputs)assert.equal(await hash('public/data/'+input.file),input.sha256);
 for(const output of view.outputs)assert.equal(await hash('public/data/'+output.file),output.sha256);
 const union=clipping.union(...view.regionIds.map(id=>collections.get(id+'-region').features[0].geometry.coordinates));
 assert.deepEqual(f.geometry,{type:'MultiPolygon',coordinates:union},'Exact modern province union, no extra/omitted territory');
 assert.match(view.qualification,/not.*historical/);
}
const m=await loadMapModel(),old=m.validate({fills:{'in-haryana-d-58':{color:'#123456',pattern:'solid'}},regions:{}});
assert.equal(old.countryView,'');assert.equal(old.provinceBorders,true);
for(const country of manifest.countries)assert.equal(old.regions[country.id].show,false,'Old maps do not load new country geometry');
assert.equal(m.validate({fills:{},countryView:'invented'}).countryView,'');
for(const country of manifest.countries){
 const d={...old,...m.countryPreset(old,country.id)};
 assert.equal(d.countryView,country.id);assert.equal(d.delhiView,'none');
 assert.deepEqual(d.fills,old.fills);assert.deepEqual(d.regions['in-haryana'],old.regions['in-haryana']);
 assert.equal(m.visible(byId.get('in-haryana'),d),false);
 for(const [level,count] of Object.entries(country.counts)){
  if(level==='tehsil')d.regions[country.id]={...d.regions[country.id],tehsil:true};
  assert.equal(catalog.filter(a=>a.region===country.id&&a.level===level&&m.visible(a,d)).length,count,country.id+' '+level+' visibility');
 }
 assert.equal(m.validate(d).countryView,country.id);
 const parent=catalog.find(a=>a.region===country.id&&a.level===(country.counts.province?'province':'district'));
 const descendants=catalog.filter(a=>a.parent===parent.id),child=descendants[0];
 assert.ok(child);d.fills={...d.fills,[parent.id]:{color:'#2764d8',pattern:'solid'}};
 assert.deepEqual(m.effectivePaint(child,d),d.fills[parent.id]);
 const grandchild=catalog.find(a=>a.parent===child.id);
 if(grandchild)assert.deepEqual(m.effectivePaint(grandchild,d),d.fills[parent.id]);
 d.hidden=[parent.id];for(const a of [parent,...descendants,...(grandchild?[grandchild]:[])])assert.equal(m.visible(a,d),false,'Recursive parent hiding');
 d.hidden=[];d.fills[child.id]={color:'#df635b',pattern:'dots'};
 assert.deepEqual(m.effectivePaint(child,d),d.fills[child.id]);
 if(grandchild)assert.deepEqual(m.effectivePaint(grandchild,d),d.fills[child.id]);
 const after=m.validate(JSON.parse(JSON.stringify(d)));assert.deepEqual(after.fills,d.fills);
 const regional={...d,...m.countryPreset(d,'')};assert.equal(regional.countryView,'');assert.deepEqual(regional.fills,d.fills);
}
const pak={...old,...m.countryPreset(old,'pk-country'),countryView:''};
for(const id of ['pk-punjab','pk-kp','islamabad']){assert.equal(m.visible(byId.get(id),pak),false);assert.deepEqual(pak.regions[id],old.regions[id]);}
pak.regions['pk-country']={...pak.regions['pk-country'],show:false};
for(const id of ['pk-punjab','pk-kp','islamabad'])assert.equal(m.visible(byId.get(id),pak),true);
for(const view of manifest.views){
 const d={...old,...m.countryPreset(old,view.id)};
 assert.ok(m.visible(byId.get(view.id),d));
 for(const id of view.regionIds){assert.equal(m.visible(byId.get(id),d),false);assert.ok(d.regions[id].show);}
 assert.equal(catalog.filter(a=>a.level==='province'&&m.visible(a,d)).length,3);
 assert.equal(catalog.filter(a=>a.level==='district'&&m.visible(a,d)).length,36);
 assert.equal(m.validate(d).countryView,view.id);
}
console.log('Verified '+manifest.countries.length+' country/context hierarchies: '+verified+' source polygons, hashes, unchanged source geometry, labels, province inheritance, recursive hiding, scoped visibility, old-map migration, Pakistan precedence and exact three-province union.');
