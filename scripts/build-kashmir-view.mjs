import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import clipping from 'polygon-clipping';
import {extent, labelPoint} from './geojson-utils.mjs';

const root = new URL('../', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));
const write = (file, value) => fs.writeFile(new URL(file, root), JSON.stringify(value) + '\n');
const hash = async file => createHash('sha256').update(await fs.readFile(new URL(file, root))).digest('hex');
const sourceUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_disputed_areas.geojson';
const cache = new URL('work/natural-earth-disputed.geojson', root);
await fs.mkdir(new URL('work/', root), {recursive: true});
try {await fs.access(cache);} catch {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw Error(`Natural Earth: ${response.status}`);
  await fs.writeFile(cache, await response.text());
}
const inputs = ['in-jammu-kashmir', 'in-ladakh'];
const sourceFeatures = await Promise.all(inputs.map(async id => (await read(`public/data/${id}-region.geojson`)).features[0]));
// Dissolve the shared UT seam without extending or hand-drawing either source.
const geometry = {type: 'MultiPolygon', coordinates: clipping.union(...sourceFeatures.map(f => f.geometry.coordinates))};
const properties = {id: 'kashmir-united', name: 'Combined Jammu & Kashmir · Indian claimed extent', region: 'kashmir-united', level: 'region', parent: '', source: 'Union of LGD/Bharatlas J&K and Ladakh outlines · 2024', center: labelPoint(geometry), bbox: extent(geometry)};
const feature = {type: 'Feature', id: properties.id, properties, geometry};
const collection = features => ({type: 'FeatureCollection', features});
await write('public/data/kashmir-united-region.geojson', collection([feature]));
await write('public/data/kashmir-united-region-labels.geojson', collection([{...feature, geometry: {type: 'Point', coordinates: properties.center}}]));
const catalog = (await read('app/catalog.json')).filter(a => a.id !== properties.id);
catalog.push(properties);
await write('app/catalog.json', catalog);

const naturalEarth = await read('work/natural-earth-disputed.geojson');
const definitions = [['Gilgit-Baltistan', 'Gilgit-Baltistan'], ['Azad Kashmir', 'Azad Jammu & Kashmir (PoK)'], ['Aksai Chin', 'Aksai Chin'], ['Shaksam Valley', 'Shaksgam Valley']];
const labels = definitions.map(([key, name]) => {
  const f = naturalEarth.features.find(f => f.properties.BRK_NAME === key);
  if (!f) throw Error(`Missing Natural Earth context: ${key}`);
  return {type: 'Feature', properties: {name, note: f.properties.NOTE_BRK, source: 'Natural Earth · disputed areas · public domain'}, geometry: {type: 'Point', coordinates: [f.properties.LABEL_X, f.properties.LABEL_Y]}};
});
for (const [id, name] of [['in-jammu-kashmir', 'Jammu & Kashmir'], ['in-ladakh', 'Ladakh']]) {
  const a = id === 'in-ladakh' ? catalog.find(a => a.region === id && a.level === 'tehsil' && a.name === 'Leh') : catalog.find(a => a.id === id);
  if (!a) throw Error(`Missing local label: ${id}`);
  labels.push({type: 'Feature', properties: {name, note: 'Administered by India', source: a.source}, geometry: {type: 'Point', coordinates: a.center}});
}
await write('public/data/kashmir-context-labels.geojson', collection(labels));
const outputs = ['kashmir-united-region.geojson', 'kashmir-united-region-labels.geojson', 'kashmir-context-labels.geojson'];
await write('app/kashmir-view-sources.json', {
  retrieved: new Date().toISOString().slice(0, 10),
  depiction: 'Indian claimed extent, not a depiction of uncontested sovereignty or present administrative control. Not a cadastral reconstruction of the former princely state.',
  processing: 'Exact polygon union of the two published LGD-derived UT outlines. No hand-drawn boundary or invented district/tehsil polygons. Context labels do not delimit administrative areas.',
  inputs: await Promise.all(inputs.map(async id => ({file: `${id}-region.geojson`, sha256: await hash(`public/data/${id}-region.geojson`)}))),
  contextSource: {url: sourceUrl, license: 'Public domain', sha256: await hash('work/natural-earth-disputed.geojson')},
  outputs: await Promise.all(outputs.map(async file => ({file, sha256: await hash(`public/data/${file}`)}))),
});
console.log(`Built combined outline (${geometry.coordinates.length} polygon parts) and ${labels.length} sourced context labels.`);
