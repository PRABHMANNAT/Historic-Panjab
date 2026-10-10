import type {FeatureCollection} from 'geojson';
import type {MapDoc} from './map-model';
import {visible} from './map-model';
import {hiddenMasks,subtractHidden} from './visibility-geometry';
import {scopeGeometryAreas} from './scope-model';
import type {Mask} from './geometry-clip';
export {containsPoint,pointInMasks,clipRiver,scopedPoints,scopedRivers,type Mask} from './geometry-clip';
export function overlayMasks(doc:MapDoc,data:Record<string,FeatureCollection>):Mask[]{
 const hidden=hiddenMasks(doc,data);
 return scopeGeometryAreas(doc).filter(a=>visible(a,doc)).flatMap(a=>{
  const f=data[a.region+'-'+a.level]?.features.find(f=>String(f.id)===a.id);
  if(!f||(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon'))return [];
  const geometry=subtractHidden(f.geometry,a.bbox,hidden);return geometry?[{id:a.id+(hidden.length?':hidden='+hidden.map(m=>m.id).join(','):''),bbox:a.bbox,geometry}]:[];
 });
}
