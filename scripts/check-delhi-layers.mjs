import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import clipping from 'polygon-clipping';
import {collection, hash, read, root} from './delhi-source-utils.mjs';
import {extent, labelPoint, polygons} from './geojson-utils.mjs';

const manifest = await read('app/delhi-map-sources.json'), catalog = await read('app/catalog.json');
const byId = new Map(catalog.map(a => [a.id, a]));
for (const entry of Object.values(manifest)) for (const output of entry.outputs) assert.equal(await hash(`public/data/${output.file}`), output.sha256, `${output.file}: provenance`);
const wards = await read('public/data/in-delhi-uc.geojson'), labels = await read('public/data/in-delhi-uc-labels.geojson');
assert.equal(wards.features.length, 289);assert.equal(labels.features.length, 289);
assert.deepEqual(manifest.wards.municipalities, {mcd: 272, ndmc: 9, cantt: 8});assert.equal(manifest.wards.omittedUnnamedRecords, 1);
for (let i = 0; i < wards.features.length; i++) {
  const f = wards.features[i], a = f.properties;
  assert.deepEqual(a, byId.get(f.id));assert.ok(a.name && a.name !== 'null');assert.equal(a.parent, 'in-delhi');
  assert.deepEqual(extent(f.geometry), a.bbox);assert.deepEqual(labelPoint(f.geometry), a.center);
  assert.deepEqual(labels.features[i], {...f, geometry: {type: 'Point', coordinates: a.center}});
  for (const polygon of polygons(f.geometry)) for (const ring of polygon) {assert.ok(ring.length >= 4);assert.deepEqual(ring[0], ring.at(-1));}
}
const ncr = (await read('public/data/delhi-ncr-region.geojson')).features[0];
let parts = [];
for (const input of manifest.ncr.inputs) {
  assert.equal(await hash(`public/data/${input.file}`), input.sha256);
  const selected = (await read(`public/data/${input.file}`)).features.filter(f => input.ids.includes(f.id));
  assert.equal(selected.length, input.ids.length);parts.push(...selected.map(f => f.geometry.coordinates));
}
while (parts.length > 1) {const next = [];for (let i = 0; i < parts.length; i += 2) next.push(i + 1 < parts.length ? clipping.union(parts[i], parts[i + 1]) : parts[i]);parts = next;}
assert.deepEqual(ncr.geometry, {type: 'MultiPolygon', coordinates: parts[0]}, 'NCR is the exact recorded source union');
assert.deepEqual(ncr.properties, byId.get('delhi-ncr'));assert.deepEqual(extent(ncr.geometry), manifest.ncr.bbox);
assert.deepEqual(await read('public/data/delhi-ncr-region-labels.geojson'), collection([{...ncr, geometry: {type: 'Point', coordinates: ncr.properties.center}}]));
const routes = await read('public/data/delhi-metro-routes.geojson'), stations = await read('public/data/delhi-metro-stations.geojson');
assert.equal(routes.features.length, 11);assert.equal(stations.features.length, manifest.metro.stations);
assert.equal(stations.features.length, 293);assert.equal(new Set(stations.features.map(f => f.id)).size, stations.features.length);
const lineIds = new Set(manifest.metro.lines.map(l => l.id));
for (const line of manifest.metro.lines) {
  const f = routes.features.find(f => f.id === line.id);assert.ok(f);assert.equal(f.geometry.type, 'MultiLineString');
  assert.equal(f.geometry.coordinates.length, line.wayIds.length);assert.equal(f.properties.color, line.color);assert.match(line.color, /^#[0-9a-f]{6}$/i);
  for (const track of f.geometry.coordinates) {assert.ok(track.length >= 2);for (const [x, y] of track) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x > 76 && x < 79 && y > 27 && y < 30);}
  // If refresh caches are available, prove each exported track is an actual OSM
  // way rather than a station-to-station interpolation. Offline checkout checks
  // still verify checked-in hashes, geometry, route membership and saved behavior.
  const rawWays = new Map();
  for (const routeId of line.routeIds) {
    let raw;try {raw = await read(`work/osm-route-${routeId}-full.json`);} catch (error) {if (error.code === 'ENOENT') continue;throw error;}
    const nodes = new Map(raw.elements.filter(e => e.type === 'node').map(e => [e.id, e]));
    for (const way of raw.elements.filter(e => e.type === 'way')) rawWays.set(way.id, way.nodes.map(id => [nodes.get(id).lon, nodes.get(id).lat]));
  }
  if (rawWays.size) for (let i = 0; i < line.wayIds.length; i++) assert.deepEqual(f.geometry.coordinates[i], rawWays.get(line.wayIds[i]), `${line.name}: actual source way`);
}
for (const f of stations.features) {assert.equal(f.geometry.type, 'Point');assert.ok(f.properties.name);assert.ok(f.properties.lineIds.every(id => lineIds.has(id)));assert.ok(f.properties.osmNodeIds.length);}
let source = await fs.readFile(new URL('app/map-model.ts', root), 'utf8');
for (const [binding, file] of [['raw', 'catalog.json'], ['indianSources', 'indian-region-sources.json'], ['delhiData', 'delhi-map-sources.json']]) source = source.replace(`import ${binding} from './${file}';`, `const ${binding}=${JSON.stringify(await read('app/' + file))};`);
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const m = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const old = m.validate({fills: {}, regions: {}});assert.equal(old.delhiView, 'none');assert.equal(old.delhiMetro, false);assert.equal(Object.keys(old.metroLines).length, 11);
const d = {...old, ...m.delhiPreset(old, 'ncr')};assert.ok(m.visible(byId.get('delhi-ncr'), d));assert.equal(m.visible(byId.get('in-haryana'), d), false);assert.equal(m.visible(byId.get('in-uttar-pradesh-d-120'), d), false);
assert.equal(catalog.filter(a => a.level === 'district' && a.region === 'in-haryana' && m.visible(a, d)).length, 14);
assert.equal(catalog.filter(a => a.level === 'district' && a.region === 'in-uttar-pradesh' && m.visible(a, d)).length, 8);
assert.deepEqual(d.fills, old.fills);assert.deepEqual(d.regions['in-sikkim'], old.regions['in-sikkim']);
const ndmc = {...old, ...m.delhiPreset(old, 'ndmc')};assert.equal(catalog.filter(a => a.level === 'uc' && a.region === 'in-delhi' && m.visible(a, ndmc)).length, 9);
const bad = m.validate({fills: {}, delhiView: 'invented', delhiMetro: true, metroLines: {[manifest.metro.lines[0].id]: {show: false, color: 'bad'}, unknown: {show: true, color: '#123456'}}});
assert.equal(bad.delhiView, 'none');assert.equal(Object.keys(bad.metroLines).length, 11);assert.equal(bad.metroLines[manifest.metro.lines[0].id].show, false);assert.match(bad.metroLines[manifest.metro.lines[0].id].color, /^#/);
assert.equal(m.activeMetroLines(bad).length, 10);assert.equal(m.metroStationVisible([manifest.metro.lines[0].id], bad), false);
assert.deepEqual(m.validate({...d, delhiMetro: true}).delhiView, 'ncr');
console.log('Verified Delhi: 289 named historical municipal areas, exact NCR union, 11 source metro tracks / 293 station points, backward-compatible settings and scoped visibility.');
