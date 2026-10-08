export type ShrineSymbolTier='takht'|'featured'|'historic';
// Original symbolic building icons, not photographs or exact architectural
// reconstructions. Featured sites get 15 roof/badge variations; each Takht gets
// a five-point crown, double Nishan Sahib flags and its own numbered accent.
export function gurdwaraIcon(tier:ShrineSymbolTier,index=0,color='#237e94'){
 const takht=tier==='takht',featured=tier==='featured',golden=featured&&index===0;
 const accent=takht?['#6847ab','#a7455b','#28736a','#8a5c25','#415ba8'][index%5]:featured?'#c49728':color;
 const roofs=1+index%3,windows=2+index%4;
 const dome=(x:number,y:number,size:number)=>`<path d="M${x-size} ${y}Q${x-size} ${y-size} ${x} ${y-size*1.5}Q${x+size} ${y-size} ${x+size} ${y}Z" fill="${golden?'#f4c553':accent}" stroke="#ffffff" stroke-width="1"/><path d="M${x} ${y-size*1.5-3}v3" stroke="${accent}" stroke-width="1.5"/>`;
 const crown=takht?'<path d="M17 12L18 5L23 9L28 3L33 9L38 5L39 12Z" fill="#f2c550" stroke="#ffffff" stroke-width="1"/>':'';
 const floor=golden?'<path d="M11 40H45M9 44H47" stroke="#76bed6" stroke-width="2"/>':'';
 const top=golden?dome(28,24,8):Array.from({length:roofs},(_,i)=>dome(28+(i-(roofs-1)/2)*12,25,roofs===1?8:5)).join('');
 const apertures=Array.from({length:windows},(_,i)=>`<path d="M${18+i*20/(windows-1)} 38v-7q2-4 4 0v7Z" fill="#ffffff" opacity=".92"/>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="25" fill="#ffffff" stroke="${accent}" stroke-width="${takht?3:2}"/>${crown}<path d="M14 40V26H42V40Z" fill="${accent}"/>${top}${apertures}<path d="M9 41H47" stroke="${accent}" stroke-width="3"/><path d="M8 39V16L14 19L8 22M48 39V16L42 19L48 22" fill="#edb947" stroke="#a97821" stroke-width="1.4"/>${floor}${takht||featured?`<circle cx="43" cy="45" r="8" fill="${accent}" stroke="white" stroke-width="1.5"/><text x="43" y="48" font-family="Arial,sans-serif" font-size="8" font-weight="bold" text-anchor="middle" fill="white">${index+1}</text>`:''}</svg>`;
}
