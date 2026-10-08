import {natureSources,mercatorY} from './nature-model';
import type {Mask} from './geometry-clip';
let sourceImage:Promise<HTMLImageElement>|undefined;
export async function forestRaster(masks:Mask[],color:string){
 sourceImage??=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{sourceImage=undefined;reject(Error('Tree-cover image unavailable. Toggle Forests to retry.'));};image.src=natureSources.forest.file;});
 const image=await sourceImage,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;
 const [w,s,e,n]=natureSources.forest.bbox,top=mercatorY(n),bottom=mercatorY(s);
 const project=([x,y]:number[])=>[(x-w)/(e-w)*canvas.width,(top-mercatorY(y))/(top-bottom)*canvas.height];
 for(const m of masks){
  ctx.save();ctx.beginPath();
  for(const polygon of m.geometry.type==='Polygon'?[m.geometry.coordinates]:m.geometry.coordinates)for(const ring of polygon){ring.forEach((point,i)=>{const [x,y]=project(point);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();}
  ctx.clip('evenodd');ctx.drawImage(image,0,0);ctx.restore();
 }
 ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/png');
}
