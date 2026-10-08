import {cached, collection, hash, read, record, write} from './delhi-source-utils.mjs';
import {extent, labelPoint} from './geojson-utils.mjs';

const url = 'https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/wards-delhi/wards_delhi.geojson';
const raw = await cached('work/delhi-wards-source.geojson', url);
const features = raw.features.filter(f => f.properties.Ward_Name && f.properties.Ward_No).map(f => {
  const number = String(f.properties.Ward_No);
  const municipality = number.startsWith('CANT_') ? 'cantt' : number.startsWith('NDMC_') ? 'ndmc' : 'mcd';
  const properties = {id: `in-delhi-ward-${number.toLowerCase()}`, name: String(f.properties.Ward_Name), region: 'in-delhi', level: 'uc', parent: 'in-delhi', municipality, center: labelPoint(f.geometry), bbox: extent(f.geometry), source: 'Historical municipal wards/charges · OpenCity via Bharatlas · CC BY-SA 4.0'};
  return {type: 'Feature', id: properties.id, properties, geometry: f.geometry};
});
if (features.length !== 289 || new Set(features.map(f => f.id)).size !== 289) throw Error('Unexpected historical ward source coverage');
await write('public/data/in-delhi-uc.geojson', collection(features));
await write('public/data/in-delhi-uc-labels.geojson', collection(features.map(f => ({...f, geometry: {type: 'Point', coordinates: f.properties.center}}))));
await write('app/catalog.json', [...(await read('app/catalog.json')).filter(a => !(a.region === 'in-delhi' && a.level === 'uc')), ...features.map(f => f.properties)]);
await record('wards', {url, page: 'https://bharatlas.com/view/wards_delhi', license: 'CC-BY-SA-4.0', sourceSha256: await hash('work/delhi-wards-source.geojson'), count: features.length, omittedUnnamedRecords: raw.features.length - features.length, municipalities: Object.fromEntries(['mcd', 'ndmc', 'cantt'].map(id => [id, features.filter(f => f.properties.municipality === id).length])), caveat: 'Historical 272 MCD wards, 9 named NDMC charges and 8 cantonment charges; one unnamed source polygon is excluded. Not the current 250-ward MCD map. Municipal areas are not revenue subdivisions and are not assigned invented district parents.'}, ['in-delhi-uc.geojson', 'in-delhi-uc-labels.geojson']);
console.log(`Built ${features.length} historical municipal areas with interior labels.`);
