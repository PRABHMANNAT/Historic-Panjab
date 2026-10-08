import {Check,X,MapPinned,LocateFixed,EyeOff,Trees} from 'lucide-react';
import {toolGuides} from './map-tools';
import type {Area} from './map-model';
export function MapToolOptions({tool,action,onAction,onFinish,onCancel}:{tool:string;action:string;onAction:(action:string)=>void;onFinish:()=>void;onCancel:()=>void}){
 const shape=['rect','ellipse','polygon'].includes(tool);
 return <div className="map-tool-options" aria-label="Active tool options"><strong>{({paint:'Color',erase:'Erase',pick:'Pick color',pan:'Move',inspect:'Inspect area',measure:'Measure distance',rect:'Rectangle',ellipse:'Ellipse',polygon:'Polygon'} as Record<string,string>)[tool]}</strong><p>{toolGuides[tool]}</p>{shape&&<div className="selection-action"><label>Apply<select aria-label="Shape selection action" value={action} onChange={e=>onAction(e.target.value)}><option value="paint">Color areas</option><option value="erase">Clear colors</option><option value="hide">Hide areas</option></select></label>{tool==='polygon'&&<button aria-label="Finish polygon selection" title="Finish polygon (Enter)" onClick={onFinish}><Check size={16}/></button>}<button aria-label="Cancel selection" title="Cancel selection (Escape)" onClick={onCancel}><X size={16}/></button></div>}</div>;
}
export function AreaInspector({area,onClose,onFit,onIsolate,onHide,onNature}:{area:Area;onClose:()=>void;onFit:()=>void;onIsolate:()=>void;onHide:()=>void;onNature:()=>void}){
 return <aside className="area-inspector" aria-label="Inspected area"><button className="area-inspector-close" aria-label="Close inspected area" onClick={onClose}><X size={15}/></button><span className="eyebrow">{area.level}</span><h3>{area.name}</h3><p>{area.source}</p><div><button onClick={onFit}><LocateFixed size={14}/> Fit</button><button onClick={onIsolate}><MapPinned size={14}/> Show only</button><button onClick={onHide}><EyeOff size={14}/> Hide</button><button onClick={onNature}><Trees size={14}/> Add nature</button></div></aside>;
}
