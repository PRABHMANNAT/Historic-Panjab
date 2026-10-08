import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import clipping from 'polygon-clipping';
import {extent} from './geojson-utils.mjs';

const root = new URL('../', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));
const manifest = await read('app/kashmir-view-sources.json');
for (const entry of [...manifest.inputs, ...manifest.outputs]) {
  const data = await fs.readFile(new URL(`public/data/${entry.file}`, root));
  assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256, `${entry.file}: provenance`);
}
const feature = (await read('public/data/kashmir-united-region.geojson')).features[0];
const inputs = await Promise.all(manifest.inputs.map(async i => (await read(`public/data/${i.file}`)).features[0]));
assert.equal(feature.geometry.coordinates.length, 1, 'One connected combined outline');
assert.deepEqual(extent(feature.geometry), feature.properties.bbox);
assert.deepEqual(clipping.difference(feature.geometry.coordinates, clipping.union(...inputs.map(f => f.geometry.coordinates))), [], 'No invented territory');
for (const f of inputs) assert.deepEqual(clipping.difference(f.geometry.coordinates, feature.geometry.coordinates), [], 'No source territory omitted');
assert.deepEqual((await read('app/catalog.json')).find(a => a.id === 'kashmir-united'), feature.properties);
const contains = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const labels = (await read('public/data/kashmir-context-labels.geojson')).features;
assert.equal(labels.length, 6);
for (const label of labels) {
  const p = label.geometry.coordinates;
  assert.ok(feature.geometry.coordinates.some(poly => contains(p, poly[0]) && !poly.slice(1).some(r => contains(p, r))), `${label.properties.name}: inside claimed extent`);
  assert.ok(label.properties.note && label.properties.source, 'Context is attributed');
}
console.log('Verified combined Kashmir: exact source union, complete claimed extent, provenance, and six interior context labels.');
