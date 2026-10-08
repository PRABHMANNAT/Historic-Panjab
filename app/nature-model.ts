import type {FeatureCollection,Polygon,MultiPolygon,Position} from 'geojson';
import polygonClipping from 'polygon-clipping';
import natureSources from './nature-sources.json';
import riverSources from './river-network-sources.json';
import type {MapDoc} from './map-model';
import {containsPoint,type Mask} from './geometry-clip';
export {natureSources,riverSources};
export const hasNature=(d:MapDoc)=>d.mountains||d.plateaus||d.forests;
export const natureLegendRows=(d:MapDoc)=>[
 ...(d.rivers||d.basemap==='rivers'?[{label:d.riverDetail==='major'?'Major rivers':'River network',color:d.riverColor}]:[]),
 ...(d.mountains?[{label:'Mountains / ranges',color:d.mountainColor}]:[]),
 ...(d.plateaus?[{label:'Plateaus',color:d.plateauColor}]:[]),
 ...(d.forests?[{label:'Tree cover · 2021',color:d.forestColor}]:[]),
];
export const overlaps=(a:number[],b:number[])=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
export const networkTiles=(masks:Mask[])=>riverSources.tiles.filter(t=>masks.some(m=>overlaps(t.bbox,m.bbox)));
export function riverNetwork(collections:FeatureCollection[],detail:MapDoc['riverDetail']):FeatureCollection{
 const seen=new Set<string|number>();return {type:'FeatureCollection',features:collections.flatMap(g=>g.features.filter(f=>{
  if(seen.has(f.id!)||Number(f.properties?.order)<(detail==='regional'?5:3))return false;seen.add(f.id!);return true;
 }))};
}
const asMulti=(g:Polygon|MultiPolygon)=>g.type==='Polygon'?[g.coordinates]:g.coordinates;
// Intersection retains holes and disconnected islands. Source geometries remain
// untouched; only the temporary display/export copy is clipped.
export function scopedLandforms(geo:FeatureCollection,masks:Mask[]):FeatureCollection{
 return {type:'FeatureCollection',features:geo.features.flatMap(f=>{
  if(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon')return [];
  const pieces=masks.filter(m=>!f.bbox||overlaps(f.bbox,m.bbox)).map(m=>polygonClipping.intersection(asMulti(f.geometry as Polygon|MultiPolygon) as polygonClipping.MultiPolygon,asMulti(m.geometry) as polygonClipping.MultiPolygon)).filter(p=>p.length);
  if(!pieces.length)return [];
  const coordinates=pieces.length===1?pieces[0]:polygonClipping.union(pieces[0],...pieces.slice(1));
  return [{...f,geometry:{type:'MultiPolygon' as const,coordinates}}];
 })};
}
export const landformShown=(kind:string,d:MapDoc)=>kind==='plateau'?d.plateaus:d.mountains;
export const landformColor=(kind:string,d:MapDoc)=>kind==='plateau'?d.plateauColor:d.mountainColor;
export function interiorLabel(g:Polygon|MultiPolygon):Position|undefined{
 const polygons=asMulti(g).map(coordinates=>({type:'Polygon' as const,coordinates}));
 for(const polygon of polygons.sort((a,b)=>Math.abs(ringArea(b.coordinates[0]))-Math.abs(ringArea(a.coordinates[0])))){
  const b=polygon.coordinates[0].reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[180,90,-180,-90]);
  const center=[(b[0]+b[2])/2,(b[1]+b[3])/2];if(containsPoint(polygon,center))return center;
  for(let n=1;n<10;n++)for(let x=-n;x<=n;x++)for(const y of [-n,n]){const p=[center[0]+x*(b[2]-b[0])/20,center[1]+y*(b[3]-b[1])/20];if(containsPoint(polygon,p))return p;}
 }
}
function ringArea(r:Position[]){return r.slice(1).reduce((sum,p,i)=>sum+r[i][0]*p[1]-p[0]*r[i][1],0)/2;}
export const mercatorY=(lat:number)=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
export const forestCoordinates=(()=>{const [w,s,e,n]=natureSources.forest.bbox;return [[w,n],[e,n],[e,s],[w,s]] as [[number,number],[number,number],[number,number],[number,number]];})();
export function natureCredits(d:MapDoc){return [d.rivers&&d.riverDetail!=='major'||d.basemap==='rivers'&&d.riverDetail!=='major'?'Rivers: RiverATLAS v1 · Linke et al. (2019) · CC BY 4.0 · hydrosheds.org/hydroatlas':'',d.mountains||d.plateaus?'Landforms: Natural Earth · public domain · approximate physical regions':'',d.forests?natureSources.forest.credit+' · CC BY 4.0 · cartographic overview (~1.3 km)':''].filter(Boolean).join(' | ');}
