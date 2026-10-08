import base from './gurdwara-data.json';
import additions from './gurdwara-additions.json';
import directory from './gurdwara-directory.json';
import associations from './gurdwara-directory-links.json';

export const mappedGurdwaras=[...base,...additions];
export const gurdwaraDirectory=directory;
const mappedById=new Map(mappedGurdwaras.map(site=>[site.id,site]));
const linksByDirectoryId=new Map(associations.links.map(link=>[link.directoryId,link.mapId]));
const linkedMapIds=new Set(associations.links.map(link=>link.mapId));
const sourcesById=new Map(directory.sources.map(source=>[source.id,source]));
export const directoryEntries=directory.gurdwaras.map(site=>({
 ...site,
 mapSite:mappedById.get(linksByDirectoryId.get(site.id)||''),
 sources:site.source_ids.flatMap(id=>sourcesById.has(id)?[sourcesById.get(id)!]:[]),
}));
export const legacyOnlyGurdwaras=base.filter(site=>!linkedMapIds.has(site.id));
export const locatedDirectoryCount=directoryEntries.filter(site=>site.mapSite).length;

const indiaRegions:Record<string,string>={'Punjab':'in-punjab','Haryana':'in-haryana','Delhi':'in-delhi','Bihar':'in-bihar','Maharashtra':'in-maharashtra','Uttarakhand':'in-uttarakhand','Himachal Pradesh':'in-himachal','Karnataka':'in-karnataka','Gujarat':'in-gujarat','Madhya Pradesh':'in-madhya-pradesh','Uttar Pradesh':'in-uttar-pradesh','Ladakh':'in-ladakh','Jammu and Kashmir':'in-jammu-kashmir','Rajasthan':'in-rajasthan','Sikkim':'in-sikkim','Chandigarh':'chandigarh'};
const countryRegions:Record<string,string>={'Pakistan':'pk-country','Bangladesh':'bd-bangladesh','Nepal':'np-nepal','Afghanistan':'af-afghanistan','Sri Lanka':'lk-sri-lanka'};
export function shrineRegion(id:string){
 const entry=directoryEntries.find(site=>site.mapSite?.id===id);
 const site=mappedById.get(id);
 if(!site)return undefined;
 if(site.country!=='India')return countryRegions[site.country];
 return entry?indiaRegions[entry.state_province]:site.country==='India'?'in-punjab':undefined;
}
