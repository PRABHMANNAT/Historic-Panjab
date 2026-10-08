import type {Feature,FeatureCollection,Geometry,Position,Polygon,MultiPolygon} from 'geojson';
export type Mask={id:string;bbox:number[];geometry:Polygon|MultiPolygon};
const rings=(g:Polygon|MultiPolygon)=>g.type==='Polygon'?[g.coordinates]:g.coordinates;
const inBox=([x,y]:Position,b:number[])=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3];
function inRing([x,y]:Position,ring:Position[]){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function containsPoint(g:Geometry,p:Position){return (g.type==='Polygon'||g.type==='MultiPolygon')&&rings(g).some(r=>inRing(p,r[0])&&!r.slice(1).some(hole=>inRing(p,hole)));}
export const pointInMasks=(p:Position,masks:Mask[])=>masks.some(m=>inBox(p,m.bbox)&&containsPoint(m.geometry,p));
type Edge={a:Position;b:Position;bbox:number[]};
type Prepared={rows:Edge[][];south:number;height:number};
const prepared=new WeakMap<Geometry,Prepared>();
function maskIndex(mask:Mask){
 const cached=prepared.get(mask.geometry);if(cached)return cached;
 const south=mask.bbox[1],height=Math.max(1e-8,mask.bbox[3]-south),rows=Array.from({length:128},()=>[] as Edge[]);
 for(const polygon of rings(mask.geometry))for(const ring of polygon)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],bbox=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])],edge={a,b,bbox};
  for(let j=Math.max(0,Math.floor((bbox[1]-south)/height*128));j<=Math.min(127,Math.floor((bbox[3]-south)/height*128));j++)rows[j].push(edge);
 }
 const index={rows,south,height};prepared.set(mask.geometry,index);return index;
}
function nearEdges(mask:Mask,b:number[]){
 const index=maskIndex(mask),edges=new Set<Edge>();
 for(let j=Math.max(0,Math.floor((b[1]-index.south)/index.height*128));j<=Math.min(127,Math.floor((b[3]-index.south)/index.height*128));j++)for(const e of index.rows[j])if(e.bbox[0]<=b[2]&&e.bbox[2]>=b[0]&&e.bbox[1]<=b[3]&&e.bbox[3]>=b[1])edges.add(e);
 return [...edges];
}
function fastInside(p:Position,mask:Mask){
 if(!inBox(p,mask.bbox))return false;const index=maskIndex(mask),row=Math.max(0,Math.min(127,Math.floor((p[1]-index.south)/index.height*128)));let inside=false;
 for(const {a,b}of index.rows[row])if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 return inside;
}
export const scopedPoints=(geo:FeatureCollection,masks:Mask[])=>({...geo,features:geo.features.filter(f=>f.geometry.type==='Point'&&pointInMasks(f.geometry.coordinates,masks))});
function crossing(a:Position,b:Position,c:Position,d:Position){
 const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],cross=rx*sy-ry*sx;
 if(Math.abs(cross)<1e-13)return undefined;
 const qx=c[0]-a[0],qy=c[1]-a[1],t=(qx*sy-qy*sx)/cross,u=(qx*ry-qy*rx)/cross;
 return t>1e-10&&t<1-1e-10&&u>=-1e-10&&u<=1+1e-10?t:undefined;
}
// Clip only the rendered/exported line, retaining the original source geometry
// in public/data. Midpoint tests between exact ring intersections handle holes
// and disjoint selected regions, not just a rectangular camera crop.
export function clipRiver(f:Feature,masks:Mask[]):Feature|undefined{
 if(f.geometry.type!=='LineString'&&f.geometry.type!=='MultiLineString')return;
 const input=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates,output:Position[][]=[];
 const box=f.bbox||input.flat().reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[180,90,-180,-90]);
 const candidates=masks.filter(m=>box[0]<=m.bbox[2]&&box[2]>=m.bbox[0]&&box[1]<=m.bbox[3]&&box[3]>=m.bbox[1]);
 if(!candidates.length)return;
 const edges=candidates.flatMap(m=>nearEdges(m,box));
 // Most network reaches are entirely inside/outside a region. Their envelope
 // has no boundary intersections, so one point determines the whole reach.
 if(!edges.length)return input[0]?.[0]&&candidates.some(m=>fastInside(input[0][0],m))?{...f,geometry:{type:'MultiLineString',coordinates:input}}:undefined;
 for(const line of input){
  let current:Position[]=[];
  const flush=()=>{if(current.length>1)output.push(current);current=[];};
  for(let i=1;i<line.length;i++){
   const a=line[i-1],b=line[i],sx=Math.min(a[0],b[0]),sy=Math.min(a[1],b[1]),ex=Math.max(a[0],b[0]),ey=Math.max(a[1],b[1]);
   const nearby=candidates.filter(m=>sx<=m.bbox[2]&&ex>=m.bbox[0]&&sy<=m.bbox[3]&&ey>=m.bbox[1]);
   if(!nearby.length){flush();continue;}
   const cuts=[0,1];
   for(const {a:c,b:d}of edges){
    if(Math.min(c[0],d[0])>ex||Math.max(c[0],d[0])<sx||Math.min(c[1],d[1])>ey||Math.max(c[1],d[1])<sy)continue;
    const t=crossing(a,b,c,d);if(t!==undefined)cuts.push(t);
   }
   cuts.sort((a,b)=>a-b);const unique=cuts.filter((v,j)=>!j||v-cuts[j-1]>1e-9);
   const point=(t:number)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   for(let j=1;j<unique.length;j++){
    const start=point(unique[j-1]),end=point(unique[j]);
    if(!nearby.some(m=>fastInside(point((unique[j-1]+unique[j])/2),m))){flush();continue;}
    if(current.length&&Math.abs(current.at(-1)![0]-start[0])+Math.abs(current.at(-1)![1]-start[1])<1e-8)current.push(end);
    else{flush();current=[start,end];}
   }
  }
  flush();
 }
 return output.length?{...f,geometry:{type:'MultiLineString',coordinates:output}}:undefined;
}
export const scopedRivers=(geo:FeatureCollection,masks:Mask[]):FeatureCollection=>({type:'FeatureCollection',features:geo.features.flatMap(f=>{const clipped=clipRiver(f,masks);return clipped?[clipped]:[];})});
