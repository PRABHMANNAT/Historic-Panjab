import study from './case-study-data.json';
import {areas,areaById,paintKey,type MapDoc,type Paint} from './map-model';
import {areaBelongsTo,scopePreset} from './scope-model';

export const caseStudy=study;
export type CaseStudySettings={caseStudyId:'none'|'sikh-heritage-core'};
export const caseStudyDefaults:CaseStudySettings={caseStudyId:'none'};
export const caseStudyAreaIds=study.groups.flatMap(g=>g.areaIds);
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
