import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
const model=await loadMapModel(),history=await loadLocalModule(new URL('../app/empire-model.ts',import.meta.url)),people=await loadLocalModule(new URL('../app/demographic-model.ts',import.meta.url)),scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url)),spatial=await loadLocalModule(new URL('../app/spatial-overlays.ts',import.meta.url));
const empireData=JSON.parse(await fs.readFile(new URL('../app/empire-data.json',import.meta.url),'utf8'));
for(const empire of empireData.empires){
 assert.ok(empire.sourceUrls.length>=2&&empire.method&&empire.license&&empire.note);
 for(const point of empire.sanityChecks.inside)assert.ok(spatial.containsPoint(empire.geometry,point.coordinates),empire.id+' includes '+point.name);
 for(const point of empire.sanityChecks.outside)assert.ok(!spatial.containsPoint(empire.geometry,point.coordinates),empire.id+' excludes '+point.name);
 const preset={...model.initial,...history.empirePreset(model.initial,empire.id)};
 assert.equal(preset.mapScope,'full');assert.ok(preset.fullDetail);
 assert.ok(history.empireCount(preset,'district')>10);
 assert.deepEqual(preset.fills,model.initial.fills);
 assert.equal(model.validate(JSON.parse(JSON.stringify(preset))).empireId,empire.id);
}
const amritsar=model.areas.find(a=>a.name==='Amritsar'&&a.level==='district'&&a.region==='in-punjab');
const tehsil=model.areas.find(a=>a.name==='Amritsar-I'&&a.level==='tehsil')||model.areas.find(a=>a.parent===amritsar.id&&a.level==='tehsil'&&people.demographicById.has(a.id));
const custom={...model.initial,fills:{[amritsar.id]:{color:'#123456',pattern:'dots'}}};
const sikh={...custom,...history.empirePreset(custom,'sikh-1839','tehsil')};
assert.equal(history.displayedPaint(amritsar,sikh).color,sikh.empireColor);
assert.equal(history.displayedPaint(amritsar,{...sikh,empireId:'none'}).color,'#123456','Turning off history restores user paint');
assert.ok(history.empireCount(sikh,'tehsil')>10);
assert.equal(history.empirePreset({...sikh,empireColor:'#765432'},'sikh-1839','district').empireColor,'#765432');
const outside=model.areas.find(a=>a.level==='district'&&!history.empireAreas('sikh-1839').has(a.id));
assert.equal(history.displayedPaint(outside,{...sikh,fills:{[outside.id]:{color:'#123456',pattern:'solid'}}}),undefined,'Outside historical extent stays unshaded');
assert.ok(!model.visible(amritsar,{...sikh,hidden:[amritsar.id]}));
const audit=JSON.parse(await fs.readFile(new URL('../app/religion-area-data.json',import.meta.url),'utf8'));
assert.equal(people.religionAreaRecords.length,audit.records.length);
assert.ok(audit.records.length>5900);
assert.equal(new Set(audit.records.map(r=>r.areaId)).size,audit.records.length);
const sources=new Set(audit.sources.map(s=>s.id));
for(const record of audit.records){
 const area=model.areaById.get(record.areaId);assert.ok(area);assert.equal(record.level,area.level);assert.equal(record.regionId,area.region);assert.ok([2011,2023].includes(record.year));
 assert.equal(record.religions.length,8);assert.equal(record.religions.reduce((sum,v)=>sum+v.population,0),record.population);
 assert.ok(record.sourceIds.every(id=>sources.has(id)));assert.ok(record.censusName&&record.matchMethod);
 if(record.year===2011)assert.ok(record.censusCode);else {assert.equal(record.censusCode,'');assert.ok(record.sourceAreaKey,'Pakistan source name paths are retained without invented official codes');}
 const runtime=people.demographicById.get(record.areaId);assert.equal(runtime.population,record.population);assert.equal(runtime.year,record.year);
 assert.deepEqual(runtime.religions.map(v=>v.name).sort(),record.religions.map(v=>v.name).sort());
 for(const v of runtime.religions){const original=record.religions.find(x=>x.name===v.name);assert.equal(v.population,original.population);assert.equal(v.share,v.population/record.population*100);}
}
for(const missing of audit.omittedAreas)assert.ok(!people.demographicById.has(missing.areaId));
for(const record of people.religionAreaRecords.filter(r=>r.year===2023))assert.ok(record.sourceIds.some(id=>id.startsWith('pbs-2023-')),'Pakistan records retain official sources');
const pakistanDistrict=model.areas.find(a=>a.region==='pk-punjab'&&a.level==='district'&&people.demographicById.has(a.id));
const pakistanDoc={...model.initial,...scope.scopePreset(model.initial,'selection',{scopeAreas:[pakistanDistrict.id]}),demographicMode:'religion-share',demographicLevel:'district',demographicReligion:'Hindu Jati'};
assert.equal(people.scopeDemographics(pakistanDoc).length,1);
assert.equal(people.demographicYearLabel(pakistanDoc),'Census 2023');
assert.equal(people.scopeDemographics({...pakistanDoc,demographicReligion:'Hindu'}).length,0,'Absent source categories are unavailable rather than zero');
assert.ok(people.demographicLegendRows({...pakistanDoc,demographicReligion:'Qadiani / Ahmadi'}).every(row=>/^#[0-9a-f]{6}$/.test(row.color)));
const districtDoc={...custom,...scope.scopePreset(custom,'single',{scopeRegion:'in-punjab'}),demographicMode:'religion',demographicLevel:'district'};
assert.ok(people.scopeDemographics(districtDoc).some(r=>r.areaId===amritsar.id));
assert.ok(people.scopeDemographics({...districtDoc,demographicLevel:'tehsil'}).some(r=>r.areaId===tehsil.id));
assert.ok(!people.scopeDemographics({...districtDoc,hidden:[amritsar.id]}).some(r=>r.areaId===amritsar.id));
const areaDoc={...districtDoc,...scope.scopePreset(districtDoc,'selection',{scopeAreas:[amritsar.id]})};
const geo=JSON.parse(await fs.readFile(new URL('../public/data/in-punjab-district.geojson',import.meta.url),'utf8'));
const result=people.demographicGeoJSON(areaDoc,{'in-punjab-district':geo});assert.equal(result.features.length,1);assert.equal(result.features[0].properties.id,amritsar.id);
const changed={...areaDoc,religionPalette:{...areaDoc.religionPalette,Sikh:'#ff00aa'}};
assert.equal(people.demographicGeoJSON(changed,{'in-punjab-district':geo}).features[0].properties.displayColor,'#ff00aa');
const share={...changed,demographicMode:'religion-share',demographicReligion:'Sikh'};
assert.equal(people.demographicLegendRows(share).length,6);
assert.ok(people.demographicValue(people.demographicById.get(amritsar.id),'religion-share','Sikh').value>60);
const restored=model.validate(JSON.parse(JSON.stringify(share)));assert.equal(restored.demographicLevel,'district');assert.equal(restored.religionPalette.Sikh,'#ff00aa');
assert.equal(model.validate({...custom,empireId:'bogus',demographicReligion:'bogus',religionPalette:{Sikh:'bad'}}).religionPalette.Sikh,people.religionColors.Sikh);
console.log(`Verified three dated empire presets, geographic sanity checks, reversible paints, ${audit.records.length} exact religion count records, missing-data exclusions, district/tehsil overlays, custom palettes, and saved settings.`);
