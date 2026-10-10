import type {FeatureCollection,Feature,Polygon,MultiPolygon} from 'geojson';
import sources from './punjab-seam-sources.json';

export const boundarySeamSources=sources;
const alignedKeys=new Set(Object.keys(sources.layers));
const displayBounds=new Map(Object.values(sources.layers).flatMap(layer=>Object.entries(layer.bounds)));
export const boundaryDisplayBounds=(id:string,sourceBounds:number[])=>displayBounds.get(id)||sourceBounds;
export const alignedBoundaryKey=(key:string)=>alignedKeys.has(key)||key==='in-punjab-region'||key==='in-punjab-district';
const requests=new Map<string,Promise<FeatureCollection>>();

// Sparse overrides change display geometry only. Source properties, area IDs,
// label points, census joins and saved document settings stay intact.
export function mergeBoundaryDisplay(raw:FeatureCollection,overrides:FeatureCollection):FeatureCollection{
 const originals=new Set(raw.features.map(f=>String(f.id))),replacement=new Map<string,Feature<Polygon|MultiPolygon>>();
 for(const feature of overrides.features){
  const id=String(feature.id);
  if(!originals.has(id)||replacement.has(id)||!['Polygon','MultiPolygon'].includes(feature.geometry.type)||!feature.bbox||feature.bbox.length!==4)throw Error('Invalid boundary alignment data');
  replacement.set(id,feature as Feature<Polygon|MultiPolygon>);
 }
 return {...raw,features:raw.features.map(feature=>{const corrected=replacement.get(String(feature.id));return corrected?{...feature,geometry:corrected.geometry,bbox:corrected.bbox}:feature})};
}
export async function loadBoundaryDisplay(key:string,raw:FeatureCollection){
 if(!alignedKeys.has(key))return raw;
 if(!requests.has(key))requests.set(key,fetch('/data/boundary-seams/'+key+'.geojson').then(response=>{if(!response.ok)throw Error('Boundary alignment unavailable: '+key);return response.json() as Promise<FeatureCollection>}).catch(error=>{requests.delete(key);throw error}));
 return mergeBoundaryDisplay(raw,await requests.get(key)!);
}
export const boundarySeamNotice=(keys:string[])=>keys.some(alignedBoundaryKey)?'Punjab frontier · source editions aligned for display; originals retained':'';
