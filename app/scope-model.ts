import raw from './catalog.json';
import type {Area,MapDoc} from './map-model';

export const scopeModes=['atlas','full','single','combination','tricity','historic-punjab'] as const;
export type ScopeMode=typeof scopeModes[number];
export type ScopeSettings={mapScope:ScopeMode;scopeRegion:string;scopeRegions:string[];historicRegions:string[];fullDetail:boolean};
export type ScopeDocument=Pick<MapDoc,'regions'|'countryView'|'delhiView'|'kashmirView'>&Partial<ScopeSettings>;
export const defaultHistoricRegions=['in-punjab','pk-punjab','in-haryana','in-himachal','chandigarh'];
export const scopeDefaults:ScopeSettings={mapScope:'atlas',scopeRegion:'in-delhi',scopeRegions:['in-punjab','pk-punjab'],historicRegions:[...defaultHistoricRegions],fullDetail:false};
const catalog=raw as Area[];
const byId=new Map(catalog.map(a=>[a.id,a]));
const syntheticRegions=new Set(['delhi-ncr','kashmir-united','tibet-modern-three']);
export const scopeRegions=catalog.filter(a=>a.level==='region'&&!syntheticRegions.has(a.region)).map(a=>({id:a.region,name:a.name,bbox:a.bbox}));
const regionIds=new Set(scopeRegions.map(r=>r.id));
export const tricityAreaIds=['chandigarh','in-d-608','in-haryana-d-70'];
const tricityParents=new Set(tricityAreaIds);
const tibetRegions=['cn-tibet','cn-qinghai','cn-sichuan'];
const pakistanLegacyRegions=['pk-punjab','pk-kp','islamabad'];
export const scopeQualifications={
 tricity:'Chandigarh + S A S Nagar (Mohali) district + Panchkula district. This is a union of the supplied administrative areas, not an exact urban, municipal or planning boundary of the Tricity.',
 historicPunjab:'User-editable modern administrative context. The initial selection uses Indian Punjab, Pakistani Punjab, Haryana, Himachal Pradesh and Chandigarh. It is not a surveyed historical Punjab boundary, a dated British province or the Sikh Empire.',
 full:'All available region outlines. Detail layers stay off until “Include enabled detail layers” is selected; their saved settings and colors are retained.',
};
export const scopeSources={tricity:{url:'https://sasnagar.punjabpolice.gov.in/about_sas_nagar.php',title:'SAS Nagar Police · Chandigarh Tricity',geometry:['Esri India IAB2024 · Chandigarh and S A S Nagar','LGD via Bharatlas · Panchkula · 2024']}};

// Unknown region IDs and malformed new fields are discarded. Older saved maps
// keep their existing atlas/country/NCR behavior and receive only safe defaults.
export function validateScopeSettings(value:unknown):ScopeSettings{
 const x=value&&typeof value==='object'?value as Partial<ScopeSettings>:{};
 const clean=(list:unknown,fallback:string[])=>Array.isArray(list)?[...new Set(list.filter((id):id is string=>typeof id==='string'&&regionIds.has(id)))]:[...fallback];
 return {mapScope:scopeModes.includes(x.mapScope as ScopeMode)?x.mapScope!:'atlas',scopeRegion:typeof x.scopeRegion==='string'&&regionIds.has(x.scopeRegion)?x.scopeRegion:scopeDefaults.scopeRegion,scopeRegions:clean(x.scopeRegions,scopeDefaults.scopeRegions),historicRegions:clean(x.historicRegions,defaultHistoricRegions),fullDetail:typeof x.fullDetail==='boolean'?x.fullDetail:false};
}
export function selectedScopeRegions(d:ScopeDocument){
 switch(d.mapScope||'atlas'){
  case 'full':return scopeRegions.map(r=>r.id);
  case 'single':return [d.scopeRegion||scopeDefaults.scopeRegion];
  case 'combination':return d.scopeRegions||scopeDefaults.scopeRegions;
  case 'historic-punjab':return d.historicRegions||defaultHistoricRegions;
  case 'tricity':return ['chandigarh','in-punjab','in-haryana'];
  default:return [];
 }
}
export function scopeRegionAllowed(id:string,d:ScopeDocument){
 const mode=d.mapScope||'atlas';
 if(mode==='atlas')return true;
 const ids=selectedScopeRegions(d);
 if(id==='kashmir-united')return ids.includes('in-jammu-kashmir')&&ids.includes('in-ladakh');
 if(id==='tibet-modern-three')return tibetRegions.every(region=>ids.includes(region));
 if(id==='delhi-ncr')return false;
 return ids.includes(id);
}
function inTricity(a:Area){
 if(a.region==='chandigarh')return true;
 const seen=new Set<string>();let current:Area|undefined=a;
 while(current&&!seen.has(current.id)){if(tricityParents.has(current.id))return true;seen.add(current.id);current=byId.get(current.parent);}
 return false;
}
// Geographic filtering is separate from layer visibility: overlay markers can
// use the same selected polygon union without depending on a detail checkbox.
export function scopeAreaAllowed(a:Area,d:ScopeDocument){return (d.mapScope==='tricity'?inTricity(a):scopeRegionAllowed(a.region,d));}
export function scopeLevelAllowed(a:Area,d:ScopeDocument){return d.mapScope!=='full'||!!d.fullDetail||a.level==='region';}
// The two district polygons serve as Tricity context outlines even when a
// previously saved district-detail checkbox was off. Child details still use
// the user's normal layer flags.
export function scopePrimaryArea(a:Area,d:ScopeDocument){return d.mapScope==='tricity'&&tricityParents.has(a.id);}
export function scopePreset(d:ScopeDocument,mode:ScopeMode,settings:Partial<ScopeSettings>={}):Partial<MapDoc>&ScopeSettings{
 const validated=validateScopeSettings({...d,...settings,mapScope:mode}),nextRegions={...d.regions};
 const selected=selectedScopeRegions({...d,...validated});
 for(const id of selected)if(nextRegions[id])nextRegions[id]={...nextRegions[id],show:true};
 return {...validated,regions:nextRegions,countryView:'',delhiView:'none',kashmirView:'separate'};
}

export function scopeGeometryAreas(d:ScopeDocument):Area[]{
 const mode=d.mapScope||'atlas';
 if(mode==='tricity')return tricityAreaIds.map(id=>byId.get(id)!).filter(Boolean);
 if(mode==='atlas'){
  if(d.delhiView==='ncr')return [byId.get('delhi-ncr')!].filter(Boolean);
  if(d.countryView==='tibet-modern-three')return [byId.get('tibet-modern-three')!].filter(Boolean);
  if(d.countryView)return [byId.get(d.countryView)!].filter(Boolean);
 }
 const ids=mode==='atlas'?scopeRegions.filter(r=>d.regions[r.id]?.show).map(r=>r.id):selectedScopeRegions(d);
 // Full Pakistan takes precedence only when it belongs to this geographic
 // scope. A previously enabled country must not hide standalone Punjab.
 const fullPakistan=ids.includes('pk-country')&&d.regions['pk-country']?.show;
 const areas=ids.filter(id=>!(fullPakistan&&pakistanLegacyRegions.includes(id))).map(id=>byId.get(id)!).filter(Boolean);
 if(d.kashmirView==='combined'&&ids.includes('in-jammu-kashmir')&&ids.includes('in-ladakh'))return [...areas.filter(a=>!['in-jammu-kashmir','in-ladakh'].includes(a.region)),byId.get('kashmir-united')!].filter(Boolean);
 return areas;
}
export const scopeGeometryKeys=(d:ScopeDocument)=>[...new Set(scopeGeometryAreas(d).map(a=>a.region+'-'+a.level))];
export function scopeFocusBounds(d:ScopeDocument){
 const areas=scopeGeometryAreas(d);
 if(!areas.length)return undefined;
 return areas.reduce((b,a)=>[Math.min(b[0],a.bbox[0]),Math.min(b[1],a.bbox[1]),Math.max(b[2],a.bbox[2]),Math.max(b[3],a.bbox[3])],[180,90,-180,-90]);
}
export function scopeQualification(d:ScopeDocument){return d.mapScope==='tricity'?scopeQualifications.tricity:d.mapScope==='historic-punjab'?scopeQualifications.historicPunjab:d.mapScope==='full'?scopeQualifications.full:'';}
export function scopeLabel(d:ScopeDocument){
 switch(d.mapScope||'atlas'){
  case 'full':return 'Full available map';
  case 'single':return scopeRegions.find(r=>r.id===(d.scopeRegion||scopeDefaults.scopeRegion))?.name||'Individual region';
  case 'combination':return 'Custom region combination';
  case 'tricity':return 'Chandigarh Tricity · district context';
  case 'historic-punjab':return 'Custom Historic Punjab · modern context';
  default:return 'Regional atlas';
 }
}
