import sources from './gurdwara-photo-sources.json';
import type {ShrineSymbolTier} from './gurdwara-icons';

export type ShrinePhoto = {id:string;file:string;title:string;author:string;license:string;licenseUrl:string;sourceUrl:string;sha256:string;captureDate?:string;captureYear?:number;checkedOn?:string};
export const shrinePhotos = sources.photos as ShrinePhoto[];
export const photoById = new Map(shrinePhotos.map(photo=>[photo.id,photo]));
export const photoCreditsUrl = 'https://github.com/PRABHMANNAT/OpenCarto/blob/main/app/gurdwara-photo-sources.json';
export const photoDateLabel=(photo:ShrinePhoto)=>photo.captureDate?'Photo taken '+photo.captureDate:'Photo date unverified';
const cache = new Map<string,Promise<string>>();

export function photoDataUrl(id:string):Promise<string> {
  const photo=photoById.get(id);
  if(!photo)return Promise.resolve('');
  const previous=cache.get(id);if(previous)return previous;
  const task=fetch(photo.file).then(async response=>{
    if(!response.ok)throw Error('Photograph unavailable');
    const blob=await response.blob();
    return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(Error('Invalid photograph'));reader.onerror=()=>reject(Error('Photograph could not be read'));reader.readAsDataURL(blob);});
  }).catch(()=>{cache.delete(id);return '';});
  cache.set(id,task);return task;
}

// Both the WebGL sprite and exported SVG use the same self-contained photo frame.
// A missing photograph is an honest neutral badge, never another shrine's photo.
export function photoMarkerSvg(tier:ShrineSymbolTier,color:string,dataUrl:string,id='shrine') {
  const accent=tier==='takht'?'#9b702b':tier==='featured'?'#be9551':/^#[0-9a-f]{6}$/i.test(color)?color:'#237e94';
  const picture=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl);
  const clip='photo-'+id.replace(/[^a-z0-9-]/gi,'');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><defs><clipPath id="${clip}"><rect x="4" y="4" width="48" height="44" rx="8"/></clipPath></defs><path d="M23 48L28 55L33 48" fill="${accent}"/><rect x="1.5" y="1.5" width="53" height="49" rx="10" fill="white" stroke="${accent}" stroke-width="2"/>${picture?`<image href="${dataUrl}" x="4" y="4" width="48" height="44" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`:'<rect x="4" y="4" width="48" height="44" rx="8" fill="#edf1e9"/><text x="28" y="23" text-anchor="middle" fill="#697967" font-family="Arial,sans-serif" font-size="7">PHOTO</text><text x="28" y="33" text-anchor="middle" fill="#697967" font-family="Arial,sans-serif" font-size="6">UNAVAILABLE</text>'}</svg>`;
}

export async function shrinePhotoMarker(id:string,tier:ShrineSymbolTier,color:string) {
  return photoMarkerSvg(tier,color,await photoDataUrl(id),id);
}
