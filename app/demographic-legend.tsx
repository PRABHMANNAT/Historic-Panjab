import type {MapDoc} from './map-model';
import {demographicTitles,demographicLegendRows,communityColors,scopeDemographics} from './demographic-model';
export default function DemographicLegend({doc}:{doc:MapDoc}){
 if(!doc.legend||(doc.demographicMode==='none'&&!doc.communityShrines))return null;
 const rows=demographicLegendRows(doc);
 return <details className="demographic-map-legend" open aria-label="Demographic legend"><summary>{doc.demographicMode==='none'?'Community shrines':demographicTitles[doc.demographicMode]}</summary>{doc.demographicMode!=='none'&&<><small>Census 2011 · whole regions</small>{rows.map(row=><div key={row.label}><i style={{background:row.color}}/>{row.label}</div>)}<small>{scopeDemographics(doc).length} covered regions · unshaded: no data</small></>}{doc.communityShrines&&<><strong>Major shrines</strong>{Object.entries(communityColors).filter(([name])=>doc.shrineCommunity==='all'||doc.shrineCommunity===name).map(([name,color])=><div key={name}><i style={{background:color,borderRadius:'50%'}}/>{name}</div>)}</>}</details>;
}
