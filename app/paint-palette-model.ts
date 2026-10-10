export type PaletteColor={name:string;hex:string};
export const defaultPaintPalette:PaletteColor[]=[
 ['Sage','#AFC7B1'],['Sky','#A9C7DD'],['Apricot','#E5B48F'],['Lilac','#C4AED2'],['Rose','#D8A6AD'],['Olive','#C2C58F'],['Teal','#93C2BE'],['Sand','#DCC89F'],['Periwinkle','#ABB6D7'],['Moss','#9EBA9A'],['Powder Blue','#BDD5E3'],['Peach','#E8C3AA'],['Lavender','#D7C5E2'],['Blush','#E3BDC3'],['Butter','#E5D792'],['Seafoam','#B7D8C5'],['Clay','#CFA68C'],['Slate Blue','#91AEC8'],['Pistachio','#D1DAB2'],['Dusty Pink','#CA97A5'],['Turquoise','#A0D0D0'],['Honey','#DCC078'],['Violet','#B49FC4'],['Mint','#A5D2B5'],['Terracotta','#D69D88'],['Denim','#9AAED0'],['Celadon','#C3D5C5'],['Mauve','#C8B0BB'],['Oat','#E2D5B6'],['Dusk','#B2B8C9'],['Fern','#B3C392'],['Cornflower','#AFBDDD'],['Salmon','#E0AE9D'],['Orchid','#CEB3D5'],['Warm Rose','#DEBCC0'],['Lemon','#D8DCA1'],['Lagoon','#8FB9B3'],['Caramel','#D4B18A'],['Heather','#B7AFCB'],['Avocado','#A8BAA0'],['Ice Blue','#C5DBDC'],['Coral','#D79DA0'],['Amber','#E3C69A'],['Wisteria','#C2B5D9'],['Aqua','#AFCDD1'],
].map(([name,hex])=>({name,hex}));
export type PaintPaletteSettings={paintPalette:PaletteColor[];paintColor:string;paintAutoAdvance:boolean;paintPaletteIndex:number};
export const paintPaletteDefaults:PaintPaletteSettings={paintPalette:defaultPaintPalette,paintColor:defaultPaintPalette[0].hex,paintAutoAdvance:true,paintPaletteIndex:0};
export function normalizeHex(value:unknown){
 if(typeof value!=='string')return null;
 const text=value.trim().replace(/^#/,'');
 return /^[0-9a-f]{6}$/i.test(text)?'#'+text.toUpperCase():/^[0-9a-f]{3}$/i.test(text)?'#'+text.split('').map(c=>c+c).join('').toUpperCase():null;
}
// Accept ordinary named lists, Markdown, CSV and bare hex codes in text files.
export function parsePaintPalette(text:string):PaletteColor[]{
 const entries:PaletteColor[]=[];
 for(const line of text.split(/\r?\n/)){
  const matches=[...line.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|(?<![\w#])[0-9a-f]{6}(?!\w)/gi)];
  for(const match of matches){
   const hex=normalizeHex(match[0]);if(!hex)continue;
   const prefix=matches.length===1?line.slice(0,match.index).replace(/^\s*\d+[.)]\s*/,'').replace(/[*`"'\[\]—–:,;|\-]/g,' ').trim():'';
   entries.push({name:prefix.slice(0,60)||'Color '+(entries.length+1),hex});
   if(entries.length>=256)return entries;
  }
 }
 return entries;
}
export function validatePaintPalette(value:unknown):PaintPaletteSettings{
 const x=value&&typeof value==='object'?value as Partial<PaintPaletteSettings>:{};
 const colors=Array.isArray(x.paintPalette)?x.paintPalette.slice(0,256).flatMap((p,i)=>{const hex=normalizeHex(p?.hex);return hex?[{name:typeof p.name==='string'?p.name.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,60)||'Color '+(i+1):'Color '+(i+1),hex}]:[]}):[];
 const paintPalette=colors.length?colors:defaultPaintPalette.map(p=>({...p}));
 const paintPaletteIndex=Number.isInteger(x.paintPaletteIndex)&&x.paintPaletteIndex!>=0&&x.paintPaletteIndex!<paintPalette.length?x.paintPaletteIndex!:0;
 return {paintPalette,paintPaletteIndex,paintColor:normalizeHex(x.paintColor)||paintPalette[paintPaletteIndex].hex,paintAutoAdvance:typeof x.paintAutoAdvance==='boolean'?x.paintAutoAdvance:true};
}
export function choosePaintColor(doc:PaintPaletteSettings,value:string):Partial<PaintPaletteSettings>{
 const paintColor=normalizeHex(value);if(!paintColor)return {};
 const index=doc.paintPalette.findIndex(p=>p.hex===paintColor);
 return {paintColor,...(index>=0?{paintPaletteIndex:index}:{})};
}
export function advancePaintColor(doc:PaintPaletteSettings):Partial<PaintPaletteSettings>{
 if(!doc.paintAutoAdvance||!doc.paintPalette.length)return {};
 const selected=doc.paintPalette[doc.paintPaletteIndex]?.hex===doc.paintColor?doc.paintPaletteIndex:doc.paintPalette.findIndex(p=>p.hex===doc.paintColor);
 const paintPaletteIndex=(selected+1)%doc.paintPalette.length;
 return {paintPaletteIndex,paintColor:doc.paintPalette[paintPaletteIndex].hex};
}
