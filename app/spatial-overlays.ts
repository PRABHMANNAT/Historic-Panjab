import type {FeatureCollection} from 'geojson';
import type {MapDoc} from './map-model';
import {visible} from './map-model';
import {scopeGeometryAreas} from './scope-model';
import type {Mask} from './geometry-clip';
export {containsPoint,pointInMasks,clipRiver,scopedPoints,scopedRivers,type Mask} from './geometry-clip';
export function overlayMasks(doc:MapDoc,data:Record<string,FeatureCollection>):Mask[]{
 return scopeGeometryAreas(doc).filter(a=>visible(a,doc)).flatMap(a=>{
  const f=data[a.region+'-'+a.level]?.features.find(f=>String(f.id)===a.id);
  return f&&(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon')?[{id:a.id,bbox:a.bbox,geometry:f.geometry}]:[];
 });
}
