'use client';
import {useEffect,useRef,useState} from 'react';
import {Palette,Upload,RotateCcw} from 'lucide-react';
import {Popover,PopoverTrigger,PopoverContent,PopoverTitle} from '@/components/ui/popover';
import {normalizeHex,parsePaintPalette,choosePaintColor,defaultPaintPalette} from './paint-palette-model';
import type {MapDoc} from './map-model';

type Props={doc:MapDoc;onChange:(patch:Partial<MapDoc>)=>void};
export function PaintHexField({color,onColor,label='Paint hex code',swatchLabel='Selected color'}:{color:string;onColor:(color:string)=>void;label?:string;swatchLabel?:string}){
 const [text,setText]=useState(color),[touched,setTouched]=useState(false);
 useEffect(()=>{setText(color.toUpperCase());setTouched(false)},[color]);
 const valid=normalizeHex(text);
 return <div className="paint-hex-field"><label><span>Hex color</span><input aria-label={label} spellCheck={false} autoComplete="off" value={text} aria-invalid={touched&&!valid} onFocus={e=>e.target.select()} onChange={e=>{setText(e.target.value);const hex=normalizeHex(e.target.value);if(hex&&e.target.value.trim().replace(/^#/,'').length===6)onColor(hex)}} onBlur={()=>{setTouched(true);if(valid){setText(valid);onColor(valid)}}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setTouched(true);if(valid)onColor(valid)}}}/></label><input type="color" aria-label={swatchLabel} title="Choose color visually" value={color} onChange={e=>onColor(e.target.value)}/>{touched&&!valid&&<small role="alert">Use a hex code such as #AFC7B1.</small>}</div>;
}
export function PaintPaletteControls({doc,onChange}:Props){
 const [text,setText]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),file=useRef<HTMLInputElement>(null);
 const select=(hex:string)=>onChange(choosePaintColor(doc,hex));
 function apply(text:string){const colors=parsePaintPalette(text);if(!colors.length){setError('No hex colors found. Paste codes like #AFC7B1.');setNotice('');return;}onChange({paintPalette:colors,paintPaletteIndex:0,paintColor:colors[0].hex,paintAutoAdvance:true});setError('');setNotice('Loaded '+colors.length+' colors. They will repeat in order.');}
 async function upload(event:React.ChangeEvent<HTMLInputElement>){const input=event.currentTarget,selected=input.files?.[0];input.value='';if(!selected)return;if(selected.size>1_000_000){setError('Choose a text file smaller than 1 MB.');return;}try{const content=await selected.text();setText(content);apply(content)}catch{setError('Could not read this file. Paste the list below.')}}
 return <div className="paint-palette-controls">
  <PaintHexField color={doc.paintColor} onColor={select}/>
  <label className="paint-auto-toggle"><input type="checkbox" checked={doc.paintAutoAdvance} onChange={e=>onChange({paintAutoAdvance:e.target.checked})}/> Next color after painting</label>
  <p className="paint-next">{doc.paintPalette[doc.paintPaletteIndex]?.hex===doc.paintColor?doc.paintPalette[doc.paintPaletteIndex].name:'Custom color'} · {doc.paintPaletteIndex+1} / {doc.paintPalette.length}{doc.paintAutoAdvance?' · repeats at the end':''}</p>
  <div className="paint-swatches" aria-label="Paint palette">{doc.paintPalette.map((p,i)=><button type="button" key={i} title={p.name+' · '+p.hex} aria-label={'Choose '+p.name+' '+p.hex} aria-pressed={doc.paintColor===p.hex&&doc.paintPaletteIndex===i} style={{background:p.hex}} onClick={()=>onChange({paintColor:p.hex,paintPaletteIndex:i})}/>)}</div>
  <details className="paint-palette-import"><summary>Paste or upload colors</summary><label>Hex color list<textarea aria-label="Hex color list" value={text} onChange={e=>setText(e.target.value)} placeholder={'Sage — #AFC7B1\nSky — #A9C7DD'} maxLength={1_000_000}/></label><div className="paint-import-actions"><button type="button" onClick={()=>apply(text)}>Use pasted colors</button><button type="button" onClick={()=>file.current?.click()}><Upload size={14}/> Upload text</button></div><input ref={file} aria-label="Upload hex color list" type="file" accept=".txt,.csv,.md,.json,text/plain,text/csv,application/json" hidden onChange={upload}/><p className="muted">Names are optional. Codes may include #. A selection of several areas uses one color, then advances once.</p></details>
  {error&&<p className="paint-import-error" role="alert">{error}</p>}{notice&&<p className="paint-import-notice" role="status">{notice}</p>}
  <button type="button" className="paint-reset" onClick={()=>{onChange({paintPalette:defaultPaintPalette.map(p=>({...p})),paintColor:defaultPaintPalette[0].hex,paintPaletteIndex:0,paintAutoAdvance:true});setError('');setNotice('Restored the 45 default colors, starting with Sage.')}}><RotateCcw size={13}/> Default palette</button>
 </div>;
}
export default function ToolbarPaintPalette({doc,onChange}:Props){
 const [open,setOpen]=useState(false),[portalContainer,setPortalContainer]=useState<HTMLElement|null>(null);
 return <Popover open={open} onOpenChange={value=>{setPortalContainer(document.fullscreenElement instanceof HTMLElement?document.fullscreenElement:null);setOpen(value)}}><PopoverTrigger className="toolbar-palette-trigger" aria-label="Paint color and palette" title={doc.paintColor+' · paste a hex code or color list'}><Palette size={16}/><i style={{background:doc.paintColor}}/><span className="toolbar-caption">Hex</span></PopoverTrigger><PopoverContent side="right" align="start" sideOffset={10} portalContainer={portalContainer} className="paint-palette-popup" aria-label="Paint color and palette"><PopoverTitle>Paint color</PopoverTitle><PaintPaletteControls doc={doc} onChange={onChange}/></PopoverContent></Popover>;
}
