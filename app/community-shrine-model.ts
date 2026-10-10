import raw from './community-shrines.json';
import {mappedGurdwaras,shrineRegion} from './gurdwara-catalog';
import {photoById} from './gurdwara-photos';
import {communityColors} from './demographic-model';
import type {MapDoc} from './map-model';
import type {FeatureCollection} from 'geojson';
import {pointInMasks,type Mask} from './geometry-clip';

export type CommunityShrine={id:string;name:string;community:string;city:string;country:string;regionId:string;coordinates:number[];sourceUrl:string;coordinateSource?:string;description:string;photo?:{file?:string;url?:string;author:string;license:string;licenseUrl:string;sourceUrl:string;captureDate?:string}};
const sikhShrines=mappedGurdwaras.filter(site=>site.tier==='takht'||site.tier==='featured').map(site=>({id:site.id,name:site.name,community:'Sikh',city:site.city,country:site.country,regionId:shrineRegion(site.id)||'',coordinates:site.coordinates,sourceUrl:site.sourceURL,coordinateSource:site.coordinateSource,description:site.significance,photo:photoById.get(site.id)})) as CommunityShrine[];
export const communityShrines=[...raw.sites as CommunityShrine[],...sikhShrines];
export const communityShrineById=new Map(communityShrines.map(site=>[site.id,site]));
export const shrineImageUrl=(site:CommunityShrine)=>site.photo?.file||site.photo?.url||'';
export const communityShrineAllowed=(site:CommunityShrine,doc:MapDoc)=>doc.shrineCommunity==='all'||site.community===doc.shrineCommunity;
export function communityShrineGeoJSON(doc:MapDoc,masks:Mask[]):FeatureCollection{return {type:'FeatureCollection',features:doc.communityShrines?communityShrines.filter(site=>communityShrineAllowed(site,doc)&&pointInMasks(site.coordinates,masks)).map(site=>({type:'Feature',id:site.id,geometry:{type:'Point',coordinates:site.coordinates},properties:{id:site.id,name:site.name,community:site.community,color:communityColors[site.community]||'#6b7c8a',displayName:doc.communityShrineLabels?site.name:''}})):[]};}
const photos=new Map<string,Promise<string>>();
export function communityPhotoData(site:CommunityShrine):Promise<string>{
 const url=shrineImageUrl(site);if(!url)return Promise.resolve('');const previous=photos.get(url);if(previous)return previous;
 const task=fetch(url).then(async r=>{if(!r.ok)throw Error('Photo unavailable');const blob=await r.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(Error('Photo unreadable'));reader.onerror=()=>reject(Error('Photo unreadable'));reader.readAsDataURL(blob);});}).catch(()=>{photos.delete(url);return '';});photos.set(url,task);return task;
}
