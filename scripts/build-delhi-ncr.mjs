import clipping from 'polygon-clipping';
import {collection, hash, read, record, write} from './delhi-source-utils.mjs';
import {extent, labelPoint} from './geojson-utils.mjs';

// NCRPB lists the legacy Alwar/Bharatpur constituents, not the later split
// districts. Use the source's retained legacy subdistrict links for these two.
const haryana = [60, 62, 604, 73, 75, 72, 64, 71, 619, 59, 701, 69, 65, 67].map(id => `in-haryana-d-${id}`);
const up = [169, 145, 144, 134, 124, 661, 660, 172].map(id => `in-uttar-pradesh-d-${id}`);
const rajasthan = [87, 91].map(id => `in-rajasthan-d-${id}`);
const selections = [
  ['in-delhi-region.geojson', f => f.id === 'in-delhi'],
  ['in-haryana-district.geojson', f => haryana.includes(f.id)],
  ['in-uttar-pradesh-district.geojson', f => up.includes(f.id)],
  ['in-rajasthan-tehsil.geojson', f => rajasthan.includes(f.properties.parent)],
];
const inputs = [], parts = [];
for (const [file, choose] of selections) {
  const features = (await read(`public/data/${file}`)).features.filter(choose);
  if (!features.length) throw Error(`No constituent geometry: ${file}`);
  inputs.push({file, ids: features.map(f => f.id), sha256: await hash(`public/data/${file}`)});
  parts.push(...features.map(f => f.geometry.coordinates));
}
if (inputs[1].ids.length !== 14 || inputs[2].ids.length !== 8) throw Error('NCR district coverage mismatch');
// Balanced pairwise union avoids a giant argument list and unnecessary intermediates.
let dissolved = parts;
while (dissolved.length > 1) {
  const next = [];
  for (let i = 0; i < dissolved.length; i += 2) next.push(i + 1 < dissolved.length ? clipping.union(dissolved[i], dissolved[i + 1]) : dissolved[i]);
  dissolved = next;
}
const geometry = {type: 'MultiPolygon', coordinates: dissolved[0]};
const properties = {id: 'delhi-ncr', name: 'Delhi NCR · source reconstruction', region: 'delhi-ncr', level: 'region', parent: '', center: labelPoint(geometry), bbox: extent(geometry), source: 'NCRPB constituent list / April 2018 map · reconstructed with LGD-derived 2024 polygons'};
const feature = {type: 'Feature', id: properties.id, properties, geometry};
await write('public/data/delhi-ncr-region.geojson', collection([feature]));
await write('public/data/delhi-ncr-region-labels.geojson', collection([{...feature, geometry: {type: 'Point', coordinates: properties.center}}]));
await write('app/catalog.json', [...(await read('app/catalog.json')).filter(a => a.id !== properties.id), properties]);
await record('ncr', {page: 'https://ncrpb.nic.in/ncrconstituent.html', license: 'CC0-1.0 (LGD-derived polygons)', inputs, districtIds: [...haryana, ...up], rajasthanParentIds: rajasthan, bbox: properties.bbox, processing: 'Exact union of NCT Delhi, 14 Haryana and 8 Uttar Pradesh district polygons, and source subdistricts linked to legacy Alwar/Bharatpur. No hand-drawn extent or guessed post-split district membership.', caveat: 'Source reconstruction, not a certified current NCR boundary. NCRPB publishes an April 2018 constituent map and says an updated map is yet to be prepared; mixed-edition source polygons may disagree at edges.'}, ['delhi-ncr-region.geojson', 'delhi-ncr-region-labels.geojson']);
console.log(`Built NCR reconstruction from ${parts.length} source areas.`);
