export type OverlaySettings={
 cityMode:'major'|'all';cityAutoColors:boolean;cityColor:string;cityMinPopulation:number;
 riverColor:string;riverLabels:boolean;riverWidth:number;
 gurdwaras:boolean;gurdwaraFilter:'all'|'takht'|'featured'|'special';gurdwaraLabels:boolean;gurdwaraColor:string;gurdwaraScale:number;
};
export const overlayDefaults:OverlaySettings={cityMode:'major',cityAutoColors:true,cityColor:'#e76b35',cityMinPopulation:100000,riverColor:'#148bd1',riverLabels:true,riverWidth:2,gurdwaras:false,gurdwaraFilter:'all',gurdwaraLabels:true,gurdwaraColor:'#237e94',gurdwaraScale:1};
export function validateOverlaySettings(value:unknown):OverlaySettings{
 const x=value&&typeof value==='object'?value as Partial<OverlaySettings>:{},next={...overlayDefaults};
 for(const key of ['cityAutoColors','riverLabels','gurdwaras','gurdwaraLabels'] as const)if(typeof x[key]==='boolean')next[key]=x[key]!;
 for(const key of ['cityColor','riverColor','gurdwaraColor'] as const)if(typeof x[key]==='string'&&/^#[0-9a-f]{6}$/i.test(x[key]!))next[key]=x[key]!;
 if(x.cityMode==='all')next.cityMode='all';
 if(['all','takht','featured','special'].includes(x.gurdwaraFilter||''))next.gurdwaraFilter=x.gurdwaraFilter!;
 for(const [key,min,max] of [['cityMinPopulation',0,5000000],['riverWidth',.5,6],['gurdwaraScale',.6,2]] as const)if(Number.isFinite(x[key]))next[key]=Math.max(min,Math.min(max,x[key]!));
 return next;
}
export type CityProperties={id?:string;name?:string;population?:number;capital?:boolean};
export const majorCity=(p:CityProperties,d:OverlaySettings)=>d.cityMode==='all'||!!p.capital||(p.population||0)>=d.cityMinPopulation;
export const cityPaintColor=(p:CityProperties,d:OverlaySettings)=>!d.cityAutoColors?d.cityColor:p.capital?'#ce3e45':(p.population||0)>=1000000?'#e8792f':'#2b9b89';
export const shrineTierAllowed=(tier:string,d:OverlaySettings)=>d.gurdwaraFilter==='all'||d.gurdwaraFilter===tier||d.gurdwaraFilter==='special'&&(tier==='takht'||tier==='featured');
