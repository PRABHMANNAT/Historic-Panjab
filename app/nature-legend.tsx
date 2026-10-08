import {natureLegendRows} from './nature-model';
import type {MapDoc} from './map-model';
export default function NatureLegend({doc}:{doc:MapDoc}){
 const rows=natureLegendRows(doc);if(!doc.legend||!rows.length)return null;
 return <details className="nature-map-legend" open><summary>Natural features</summary>{rows.map(row=><div key={row.label}><i style={{background:row.color}}/><span>{row.label}</span></div>)}</details>;
}
