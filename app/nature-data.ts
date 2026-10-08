import type {FeatureCollection} from 'geojson';
import {scopedRivers,type Mask} from './geometry-clip';
import {networkTiles,riverNetwork,scopedLandforms} from './nature-model';
import type {MapDoc} from './map-model';
export type NatureRequest={key:string;masks:Mask[];network:boolean;landforms:boolean;detail:MapDoc['riverDetail']};
export type NatureResult={key:string;rivers:FeatureCollection;landforms:FeatureCollection;error?:string};
const cache=new Map<string,Promise<FeatureCollection>>();
export async function loadNatureGeo(file:string){
 let promise=cache.get(file);if(!promise){promise=fetch('/data/'+file).then(async r=>{if(!r.ok)throw Error('Natural layer unavailable: '+file);return r.json() as Promise<FeatureCollection>;}).catch(error=>{cache.delete(file);throw error;});cache.set(file,promise);}
 return promise;
}
export async function prepareNature(request:NatureRequest):Promise<NatureResult>{
 const empty:FeatureCollection={type:'FeatureCollection',features:[]};
 if(!request.masks.length)return {key:request.key,rivers:empty,landforms:empty};
 const landforms=request.landforms?scopedLandforms(await loadNatureGeo('landforms.geojson'),request.masks):empty;
 const collections:FeatureCollection[]=[];
 if(request.network){const tiles=networkTiles(request.masks);for(let i=0;i<tiles.length;i+=4)collections.push(...await Promise.all(tiles.slice(i,i+4).map(t=>loadNatureGeo('river-network/'+t.file))));}
 const rivers=request.network?scopedRivers(riverNetwork(collections,request.detail),request.masks):empty;
 return {key:request.key,rivers,landforms};
}
