'use client';
import {useState} from 'react';
import {Map as MapIcon,Globe2,MapPinned,LocateFixed} from 'lucide-react';
import {Popover,PopoverTrigger,PopoverContent,PopoverTitle} from '@/components/ui/popover';
import type {MapDoc,Area} from './map-model';
import {historyActive} from './map-navigation-model';
import {areaDisplayName} from './area-name-model';

type Props={doc:MapDoc;area?:Area;onNormal:()=>void;onComplete:()=>void;onSelected:()=>void;onFocus:()=>void};
export default function MapNavigation({doc,area,onNormal,onComplete,onSelected,onFocus}:Props){
 const [open,setOpen]=useState(false),[portalContainer,setPortalContainer]=useState<HTMLElement|null>(null),active=historyActive(doc);
 const toggle=(value:boolean)=>{setPortalContainer(document.fullscreenElement instanceof HTMLElement?document.fullscreenElement:null);setOpen(value)};
 const choose=(action:()=>void)=>{setOpen(false);action()};
 return <>
  <button type="button" className={'map-return-button'+(active?' active':'')} aria-label="Normal map" title={active?'Return to your normal map':'Normal map is already active'} disabled={!active} onClick={onNormal}><MapIcon size={17}/><span className="toolbar-caption">Normal</span></button>
  <Popover open={open} onOpenChange={toggle}>
   <PopoverTrigger className={'map-view-trigger'+(open?' active':'')} aria-label="Map views" title="Complete map, selected map or edited area"><Globe2 size={17}/><span className="toolbar-caption">View</span></PopoverTrigger>
   <PopoverContent side="right" align="start" sideOffset={10} portalContainer={portalContainer} className="map-view-popup" aria-label="Map views">
    <PopoverTitle>Map view</PopoverTitle>
    <button type="button" onClick={()=>choose(onComplete)}><Globe2 size={18}/><span>Complete map<small>Show all available regions</small></span></button>
    <button type="button" onClick={()=>choose(onSelected)}><MapPinned size={18}/><span>Selected map<small>Your area group or region combination</small></span></button>
    <button type="button" disabled={!area} onClick={()=>choose(onFocus)}><LocateFixed size={18}/><span>Focus edited area<small>{area?areaDisplayName(area,doc):'Select an area on the map first'}</small></span></button>
   </PopoverContent>
  </Popover>
  <span className="tool-divider"/>
 </>;
}
