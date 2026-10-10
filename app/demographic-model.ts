import census from './demographic-data.json';
import type {FeatureCollection} from 'geojson';
import type {MapDoc} from './map-model';
import {scopeGeometryAreas} from './scope-model';
import {visible} from './map-model';
import {hiddenMasks,subtractHidden} from './visibility-geometry';

export const demographicModes=['none','language','religion','population','literacy','urban'] as const;
export type DemographicMode=typeof demographicModes[number];
export type DemographicSettings={demographicMode:DemographicMode;demographicOpacity:number;demographicLabels:boolean;communityShrines:boolean;shrineCommunity:string;communityShrineLabels:boolean};
export const demographicDefaults:DemographicSettings={demographicMode:'none',demographicOpacity:.72,demographicLabels:true,communityShrines:false,shrineCommunity:'all',communityShrineLabels:true};
export const demographicTitles:Record<DemographicMode,string>={none:'Off',language:'Largest mother-tongue group',religion:'Largest religious group',population:'Population',literacy:'Literacy rate (age 7+)',urban:'Urban population share'};
export type DemographicRecord={regionId:string;year:number;population?:number;literacy?:number;urbanShare?:number;languages:{name:string;share:number;isRemainder?:boolean}[];religions:{name:string;share:number}[];sourceIds:string[];note:string};
export const demographicRecords=census.records as DemographicRecord[];
export const demographicSources=census.sources;
export const demographicById=new Map(demographicRecords.map(r=>[r.regionId,r]));
export const communityColors:Record<string,string>={Sikh:'#237e94',Hindu:'#d77931',Muslim:'#38845b',Buddhist:'#b59125',Jain:'#9f6592',Christian:'#647cc2'};
const languageColors:Record<string,string>={Punjabi:'#398b7b',Hindi:'#cb8e48',Bengali:'#ae6587',Marathi:'#8572b4',Tamil:'#c5655e',Telugu:'#5a91b0',Gujarati:'#9b8c44',Kannada:'#6f97a0',Malayalam:'#67936a',Odia:'#a97956',Assamese:'#719858',Urdu:'#4975a0',Kashmiri:'#b78da8',Nepali:'#7586a6',Konkani:'#b08c68',English:'#7d8398'};
const fallbackColors=['#6c9d89','#9180b6','#c29b59','#7896b6','#b67888','#73966d'];
export function demographicValue(r:DemographicRecord,mode:DemographicMode){
 if(mode==='language'||mode==='religion'){const values=mode==='language'?r.languages.filter(v=>!v.isRemainder&&v.name!=='Other reported mother tongues'):r.religions;const top=[...values].sort((a,b)=>b.share-a.share)[0];return top?{label:top.name,value:top.share,text:top.name+' · '+top.share.toFixed(2)+'%'}:undefined;}
 const value=mode==='population'?r.population:mode==='literacy'?r.literacy:mode==='urban'?r.urbanShare:undefined;
 return value===undefined?undefined:{label:demographicTitles[mode],value,text:mode==='population'?value.toLocaleString('en-IN'):value.toFixed(2)+'%'};
}
const scales={population:{breaks:[1000000,10000000,50000000,100000000],labels:['Under 1 million','1–10 million','10–50 million','50–100 million','100 million or more']},literacy:{breaks:[65,75,85,95],labels:['Below 65%','65–75%','75–85%','85–95%','95% or more']},urban:{breaks:[20,35,50,75],labels:['Below 20%','20–35%','35–50%','50–75%','75% or more']}};
const scaleColors=['#d7e8ed','#a3c8d3','#6da4b7','#3f7c96','#22536f'];
export function demographicColor(r:DemographicRecord,mode:DemographicMode){
 const entry=demographicValue(r,mode);if(!entry)return '#e1e5e3';
 if(mode==='religion')return communityColors[entry.label]||'#8a8996';
 if(mode==='language'){let hash=0;for(const c of entry.label)hash=(hash*31+c.charCodeAt(0))>>>0;return languageColors[entry.label]||fallbackColors[hash%fallbackColors.length];}
 if(mode==='none')return '#e1e5e3';const scale=scales[mode];const index=scale.breaks.findIndex(b=>entry.value<b);return scaleColors[index<0?4:index];
}
export function scopeDemographics(doc:MapDoc){return scopeGeometryAreas(doc).filter(a=>visible(a,doc)).flatMap(a=>{const r=demographicById.get(a.id);return r?[r]:[];});}
export function demographicLegendRows(doc:MapDoc){
 const mode=doc.demographicMode;if(mode==='none')return [];
 if(mode==='language'||mode==='religion')return [...new Map(scopeDemographics(doc).flatMap(r=>{const v=demographicValue(r,mode);return v?[[v.label,{label:v.label,color:demographicColor(r,mode)}] as const]:[];})).values()].sort((a,b)=>a.label.localeCompare(b.label));
 return scales[mode].labels.map((label,i)=>({label,color:scaleColors[i]}));
}
export function demographicGeoJSON(doc:MapDoc,data:Record<string,FeatureCollection>):FeatureCollection{
 const hidden=hiddenMasks(doc,data);
 return {type:'FeatureCollection',features:doc.demographicMode==='none'?[]:scopeDemographics(doc).flatMap(r=>{
  const value=demographicValue(r,doc.demographicMode);if(!value)return [];
  const area=scopeGeometryAreas(doc).find(a=>a.id===r.regionId)!;
  const f=data[area.region+'-'+area.level]?.features.find(f=>String(f.id)===area.id);
  if(!f||(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon'))return [];
  const geometry=subtractHidden(f.geometry,area.bbox,hidden);return geometry?[{...f,geometry,properties:{id:r.regionId,name:area.name,displayColor:demographicColor(r,doc.demographicMode),displayValue:value.text,year:r.year}}]:[];
 })};
}
export function validateDemographicSettings(value:unknown):DemographicSettings{
 const x=value&&typeof value==='object'?value as Partial<DemographicSettings>:{},next={...demographicDefaults};
 if(demographicModes.includes(x.demographicMode!))next.demographicMode=x.demographicMode!;
 if(Number.isFinite(x.demographicOpacity))next.demographicOpacity=Math.max(.2,Math.min(1,x.demographicOpacity!));
 for(const k of ['demographicLabels','communityShrines','communityShrineLabels'] as const)if(typeof x[k]==='boolean')next[k]=x[k]!;
 if(x.shrineCommunity==='all'||Object.hasOwn(communityColors,x.shrineCommunity||''))next.shrineCommunity=x.shrineCommunity!;
 return next;
}
export const demographicNotice=(doc:MapDoc)=>doc.demographicMode==='none'?'':'Demographics: Census 2011 · '+demographicTitles[doc.demographicMode]+' · whole source regions only; later boundary editions differ. Missing records remain unshaded. Religion/language categories describe groups, not individuals.';
