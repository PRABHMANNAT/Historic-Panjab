import study from './case-study-data.json';
import {areas,areaById,areasByLayer,paintKey,type MapDoc,type Paint} from './map-model';
import {areaBelongsTo,scopePreset,scopeNavigation,scopeRegions} from './scope-model';

export const caseStudy=study;
export type CaseStudySettings={caseStudyId:'none'|'sikh-heritage-core'};
export const caseStudyDefaults:CaseStudySettings={caseStudyId:'none'};
export const caseStudyAreaIds=study.groups.flatMap(g=>g.areaIds);
export const isCaseStudyMap=(doc:Partial<MapDoc>)=>doc.empireId!=='none'?doc.caseStudyId==='sikh-heritage-core':doc.caseStudyId==='sikh-heritage-core'||doc.title==='United Punjab · Sikh military & heritage core'&&doc.legendTitle==='Case study key'||doc.mapScope==='selection'&&caseStudyAreaIds.every(id=>doc.scopeAreas?.includes(id));
export const caseStudyIncludes=(area:Parameters<typeof areaBelongsTo>[0])=>caseStudyAreaIds.some(id=>areaBelongsTo(area,id));
// Show the retained core over all available state/province outlines. Keep full
// Pakistan's province coverage, while the legacy core units remain editable.
export function caseStudyCompleteView(doc:MapDoc):Partial<MapDoc>{
 const coreRegions=new Set(caseStudyAreaIds.map(id=>areaById.get(id)?.region));
 const patch=scopePreset(doc,'full',{fullDetail:true}),regions={...patch.regions};
 for(const region of scopeRegions){const detail=coreRegions.has(region.id);regions[region.id]={...regions[region.id],show:true,province:areasByLayer.has(region.id+'-province'),district:detail,tehsil:detail,division:false,uc:false};}
 regions['pk-lahore-study']={...regions['pk-lahore-study'],show:true,district:false,tehsil:true,division:false,uc:false};
 return {...patch,regions,hidden:[],areaDetails:{}};
}
export function caseStudyLoadPreset(doc:MapDoc):Partial<MapDoc>{
 const core={...doc,...caseStudyPreset(doc)};
 return {...core,...caseStudyCompleteView(core),viewReturn:scopeNavigation(core),historyReturn:null};
}
export function caseStudyPreset(doc:MapDoc):Partial<MapDoc>{
 const belongs=(id:string)=>{const a=areaById.get(id);return !!a&&caseStudyAreaIds.some(root=>areaBelongsTo(a,root));};
 const fills:Record<string,Paint>=Object.fromEntries(Object.entries(doc.fills).filter(([id])=>!belongs(id)));
 const groups={...doc.groups};for(const group of study.groups){const paint={color:group.color,pattern:'solid'};groups[paintKey(paint)]=group.label;for(const id of group.areaIds)fills[id]=paint;
  // Some source districts have no parent ID. Paint these roots so their linked tehsils inherit the regional template color.
  for(const area of areas)if(group.areaIds.includes(area.region)&&(!area.parent||!areaById.has(area.parent)))fills[area.id]=paint;
 }
 const selectedRegions=new Set(caseStudyAreaIds.map(id=>areaById.get(id)?.region));
 const areaDetails=Object.fromEntries(Object.entries(doc.areaDetails).filter(([id])=>!selectedRegions.has(areaById.get(id)?.region)));
 const patch=scopePreset(doc,'selection',{scopeAreas:caseStudyAreaIds}),regions={...patch.regions};
 for(const id of new Set(caseStudyAreaIds.map(id=>areaById.get(id)?.region).filter((id):id is string=>!!id)))regions[id]={...regions[id],show:true,province:false,division:false,district:true,tehsil:true,uc:false};
 return {...patch,regions,areaDetails,fills,groups,areaNames:{...study.areaNames,...doc.areaNames},hidden:doc.hidden.filter(id=>!belongs(id)&&!caseStudyAreaIds.some(root=>{const a=areaById.get(root);return !!a&&areaBelongsTo(a,id);})),caseStudyId:study.id as CaseStudySettings['caseStudyId'],empireId:'none',demographicMode:'none',basemap:'political',rivers:true,riverDetail:'major',riverColor:'#89bfd1',gurdwaras:false,communityShrines:false,cities:false,title:'United Punjab · Sikh military & heritage core',legendTitle:'Case study key',bg:'#f7f5f0',uncolored:'#f7f5f0',border:'#526477',width:.8,labelSize:11,names:true,legend:true,legendX:73,legendY:27};
}
export const caseStudyNotice=(doc:MapDoc)=>doc.caseStudyId==='sikh-heritage-core'?study.qualification+' '+study.boundaryNote:'';
export const validateCaseStudySettings=(value:unknown):CaseStudySettings=>({caseStudyId:value&&typeof value==='object'&&(value as Partial<CaseStudySettings>).caseStudyId===study.id?'sikh-heritage-core':'none'});
