import census from './demographic-data.json';
import {areaDisplayName} from './area-name-model';
import localReligion from './religion-area-runtime.json';
import type {FeatureCollection} from 'geojson';
import type {MapDoc,Area} from './map-model';
import {scopeGeometryAreas} from './scope-model';
import {visible,areaById,areas} from './map-model';
import {hiddenMasks,subtractHidden} from './visibility-geometry';

export const demographicModes=['none','language','religion','religion-share','population','literacy','urban'] as const;
export type DemographicMode=typeof demographicModes[number];
export const communityColors:Record<string,string>={Sikh:'#237e94',Hindu:'#d77931',Muslim:'#38845b',Buddhist:'#b59125',Jain:'#9f6592',Christian:'#647cc2'};
export const religionColors:Record<string,string>={...communityColors,'Other religions and persuasions':'#9a795d','Religion not stated':'#8a8996','Hindu Jati':'#d77931','Qadiani / Ahmadi':'#ae6472','Scheduled Castes':'#8d75af',Parsi:'#bb8247',Others:'#7d908e'};
export type DemographicSettings={demographicMode:DemographicMode;demographicLevel:'region'|'district'|'tehsil';demographicReligion:string;religionPalette:Record<string,string>;demographicOpacity:number;demographicLabels:boolean;communityShrines:boolean;shrineCommunity:string;communityShrineLabels:boolean};
export const demographicDefaults:DemographicSettings={demographicMode:'none',demographicLevel:'region',demographicReligion:'Sikh',religionPalette:{...religionColors},demographicOpacity:.72,demographicLabels:true,communityShrines:false,shrineCommunity:'all',communityShrineLabels:true};
export const demographicTitles:Record<DemographicMode,string>={none:'Off',language:'Largest mother-tongue group',religion:'Largest religious group','religion-share':'Religion population share',population:'Population',literacy:'Literacy rate (age 7+)',urban:'Urban population share'};
export type DemographicRecord={areaId?:string;regionId:string;level?:'region'|'district'|'tehsil';year:number;population?:number;literacy?:number;urbanShare?:number;languages?:{name:string;share:number;isRemainder?:boolean}[];religions:{name:string;share:number;population?:number}[];sourceIds:string[];note:string;censusName?:string};
export const demographicRecords=census.records as DemographicRecord[];
type ReligionTuple=[string,string,'district'|'tehsil',number,number[],string,string,string,number?];
const categoriesBySource=(localReligion as typeof localReligion&{religionNamesBySource?:Record<string,string[]>}).religionNamesBySource||{};
export const religionAreaRecords:DemographicRecord[]=(localReligion.records as unknown as ReligionTuple[]).map(([areaId,regionId,level,population,counts,sourceId,censusName,,year])=>({areaId,regionId,level,year:year||localReligion.year,population,religions:(categoriesBySource[sourceId]||localReligion.religionNames).map((name,i)=>({name,population:counts[i],share:counts[i]/population*100})),sourceIds:[sourceId],censusName,note:(year&&year!==2011?'Statistics describe Census '+year+' units and the religion table’s population denominator. Reported categories are retained separately; the map uses other published boundary editions. Name joins do not prove unchanged boundaries.':localReligion.geographyNote)}));
export const demographicSources=[...census.sources,...localReligion.sources];
export const religionCoverage=localReligion.coverage;
export const allDemographicRecords=[...demographicRecords,...religionAreaRecords];
export const recordAreaId=(r:DemographicRecord)=>r.areaId||r.regionId;
export const demographicById=new Map(allDemographicRecords.map(r=>[recordAreaId(r),r]));
export const religionMode=(mode:DemographicMode)=>mode==='religion'||mode==='religion-share';
export const demographicLevelNames={region:'States / territories',district:'Districts',tehsil:'Tehsils / subdivisions'};
export const activeDemographicLevel=(doc:MapDoc)=>religionMode(doc.demographicMode)?doc.demographicLevel:'region';
export const demographicTitle=(doc:MapDoc)=>doc.demographicMode==='religion-share'?doc.demographicReligion+' population share':demographicTitles[doc.demographicMode];
const languageColors:Record<string,string>={Punjabi:'#398b7b',Hindi:'#cb8e48',Bengali:'#ae6587',Marathi:'#8572b4',Tamil:'#c5655e',Telugu:'#5a91b0',Gujarati:'#9b8c44',Kannada:'#6f97a0',Malayalam:'#67936a',Odia:'#a97956',Assamese:'#719858',Urdu:'#4975a0',Kashmiri:'#b78da8',Nepali:'#7586a6',Konkani:'#b08c68',English:'#7d8398'};
const fallbackColors=['#6c9d89','#9180b6','#c29b59','#7896b6','#b67888','#73966d'];
export function demographicValue(r:DemographicRecord,mode:DemographicMode,religion='Sikh'){
 if(mode==='religion-share'){const v=r.religions.find(v=>v.name===religion);return v?{label:religion,value:v.share,text:religion+' · '+v.share.toFixed(2)+'%'}:undefined;}
 if(mode==='language'||mode==='religion'){const values=mode==='language'?(r.languages||[]).filter(v=>!v.isRemainder&&v.name!=='Other reported mother tongues'):r.religions;const top=[...values].sort((a,b)=>b.share-a.share)[0];return top?{label:top.name,value:top.share,text:top.name+' · '+top.share.toFixed(2)+'%'}:undefined;}
 const value=mode==='population'?r.population:mode==='literacy'?r.literacy:mode==='urban'?r.urbanShare:undefined;
 return value===undefined?undefined:{label:demographicTitles[mode],value,text:mode==='population'?value.toLocaleString('en-IN'):value.toFixed(2)+'%'};
}
const scales={population:{breaks:[1000000,10000000,50000000,100000000],labels:['Under 1 million','1–10 million','10–50 million','50–100 million','100 million or more']},literacy:{breaks:[65,75,85,95],labels:['Below 65%','65–75%','75–85%','85–95%','95% or more']},urban:{breaks:[20,35,50,75],labels:['Below 20%','20–35%','35–50%','50–75%','75% or more']}};
const scaleColors=['#d7e8ed','#a3c8d3','#6da4b7','#3f7c96','#22536f'];
const religionBreaks=[1,10,25,50,75],religionLabels=['Below 1%','1–10%','10–25%','25–50%','50–75%','75% or more'];
export function religionScale(color:string){const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));return [.08,.22,.4,.6,.8,1].map(t=>'#'+rgb.map(c=>Math.round(255+(c-255)*t).toString(16).padStart(2,'0')).join(''));}
export function demographicColor(r:DemographicRecord,mode:DemographicMode,doc?:MapDoc){
 const entry=demographicValue(r,mode,doc?.demographicReligion);if(!entry)return '#e1e5e3';
 if(mode==='religion')return doc?.religionPalette[entry.label]||religionColors[entry.label]||'#8a8996';
 if(mode==='religion-share'){const palette=religionScale(doc?.religionPalette[entry.label]||religionColors[entry.label]||'#8a8996'),index=religionBreaks.findIndex(b=>entry.value<b);return palette[index<0?5:index];}
 if(mode==='language'){let hash=0;for(const c of entry.label)hash=(hash*31+c.charCodeAt(0))>>>0;return languageColors[entry.label]||fallbackColors[hash%fallbackColors.length];}
 if(mode==='none')return '#e1e5e3';const scale=scales[mode];const index=scale.breaks.findIndex(b=>entry.value<b);return scaleColors[index<0?4:index];
}
// Census overlays have independent geometry levels. Hidden areas and geographic
// scopes still apply, while border/detail switches remain display preferences.
const areaCache=new WeakMap<MapDoc,Area[]>(),recordCache=new WeakMap<MapDoc,DemographicRecord[]>();
export function demographicAreas(doc:MapDoc){if(!areaCache.has(doc)){const level=activeDemographicLevel(doc),display={...doc,fullDetail:true,regions:Object.fromEntries(Object.entries(doc.regions).map(([id,r])=>[id,{...r,[level]:true}]))};areaCache.set(doc,level==='region'?scopeGeometryAreas(doc).filter(a=>a.level==='region'&&visible(a,doc)):areas.filter(a=>a.level===level&&visible(a,display)));}return areaCache.get(doc)!;}
export function scopeDemographics(doc:MapDoc){if(!recordCache.has(doc))recordCache.set(doc,demographicAreas(doc).flatMap(a=>{const r=demographicById.get(a.id);return r&&(r.level||'region')===activeDemographicLevel(doc)&&(!religionMode(doc.demographicMode)||r.religions.length)&&(doc.demographicMode!=='religion-share'||r.religions.some(v=>v.name===doc.demographicReligion))?[r]:[];}));return recordCache.get(doc)!;}
export function demographicYears(doc:MapDoc){return [...new Set(scopeDemographics(doc).map(r=>r.year))].sort();}
export function demographicYearLabel(doc:MapDoc){const years=demographicYears(doc);return years.length?'Census '+years.join(' / '):'Census data';}
export function demographicGeometryKeys(doc:MapDoc){return doc.demographicMode==='none'?[]:[...new Set(scopeDemographics(doc).map(r=>{const a=areaById.get(recordAreaId(r))!;return a.region+'-'+a.level;}))];}
export function demographicLegendRows(doc:MapDoc){
 const mode=doc.demographicMode;if(mode==='none')return [];
 if(mode==='religion-share'){const palette=religionScale(doc.religionPalette[doc.demographicReligion]||religionColors[doc.demographicReligion]);return religionLabels.map((label,i)=>({label,color:palette[i]}));}
 if(mode==='language'||mode==='religion')return [...new Map(scopeDemographics(doc).flatMap(r=>{const v=demographicValue(r,mode);return v?[[v.label,{label:v.label,color:demographicColor(r,mode,doc)}] as const]:[];})).values()].sort((a,b)=>a.label.localeCompare(b.label));
 return scales[mode].labels.map((label,i)=>({label,color:scaleColors[i]}));
}
export function demographicGeoJSON(doc:MapDoc,data:Record<string,FeatureCollection>):FeatureCollection{
 const hidden=hiddenMasks(doc,data);
 return {type:'FeatureCollection',features:doc.demographicMode==='none'?[]:scopeDemographics(doc).flatMap(r=>{
  const value=demographicValue(r,doc.demographicMode,doc.demographicReligion);if(!value)return [];
  const area=areaById.get(recordAreaId(r))!;
  const f=data[area.region+'-'+area.level]?.features.find(f=>String(f.id)===area.id);
  if(!f||(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon'))return [];
  const geometry=subtractHidden(f.geometry,area.bbox,hidden);return geometry?[{...f,geometry,properties:{id:area.id,name:areaDisplayName(area,doc),displayColor:demographicColor(r,doc.demographicMode,doc),displayValue:value.text,year:r.year}}]:[];
 })};
}
export function validateDemographicSettings(value:unknown):DemographicSettings{
 const x=value&&typeof value==='object'?value as Partial<DemographicSettings>:{},next={...demographicDefaults,religionPalette:{...religionColors}};
 if(demographicModes.includes(x.demographicMode!))next.demographicMode=x.demographicMode!;
 if(x.demographicLevel==='region'||x.demographicLevel==='district'||x.demographicLevel==='tehsil')next.demographicLevel=x.demographicLevel;
 if(Object.hasOwn(religionColors,x.demographicReligion||''))next.demographicReligion=x.demographicReligion!;
 for(const name of Object.keys(religionColors)){const c=x.religionPalette?.[name];if(typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))next.religionPalette[name]=c;}
 if(Number.isFinite(x.demographicOpacity))next.demographicOpacity=Math.max(.2,Math.min(1,x.demographicOpacity!));
 for(const k of ['demographicLabels','communityShrines','communityShrineLabels'] as const)if(typeof x[k]==='boolean')next[k]=x[k]!;
 if(x.shrineCommunity==='all'||Object.hasOwn(communityColors,x.shrineCommunity||''))next.shrineCommunity=x.shrineCommunity!;
 return next;
}
export const demographicNotice=(doc:MapDoc)=>doc.demographicMode==='none'?'':'Demographics: '+demographicYearLabel(doc)+' · '+demographicTitle(doc)+' · '+demographicLevelNames[activeDemographicLevel(doc)]+'. Matched census areas only; boundary editions and reported categories differ. Missing records remain unshaded, never state averages. Religion/language categories describe groups, not individuals.';
