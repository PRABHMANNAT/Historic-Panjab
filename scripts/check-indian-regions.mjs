import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));
const catalog = await readJson('app/catalog.json');
const manifest = await readJson('app/indian-region-sources.json');
const byId = new Map(catalog.map(a => [a.id, a]));
assert.equal(byId.size, catalog.length, 'Catalog IDs must be unique');
const expected = {'in-haryana': {district: 22, tehsil: 81}, 'in-himachal': {district: 12, tehsil: 123}, 'in-andhra': {district: 26, tehsil: 671}, 'in-rajasthan': {district: 50, tehsil: 314}, 'in-uttar-pradesh': {district: 75, tehsil: 316}, 'in-uttarakhand': {district: 13, tehsil: 80}, 'in-jammu-kashmir': {district: 20, tehsil: 75}, 'in-ladakh': {district: 2, tehsil: 6}};
const ringContains = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
for (const [key, entry] of Object.entries(manifest.layers)) {
  const content = await fs.readFile(new URL(`public/data/${key}.geojson`, root), 'utf8');
  assert.equal(createHash('sha256').update(content).digest('hex'), entry.sha256, `${key}: provenance hash`);
  const geo = JSON.parse(content), labels = await readJson(`public/data/${key}-labels.geojson`);
  assert.equal(geo.type, 'FeatureCollection');
  assert.equal(geo.features.length, entry.count);
  assert.equal(labels.features.length, entry.count);
  const labelById = new Map(labels.features.map(f => [f.id, f]));
  assert.equal(labelById.size, entry.count);
  for (const feature of geo.features) {
    const a = byId.get(feature.id);
    assert.ok(a, `${key}: area exists in catalog`);
    assert.deepEqual(feature.properties, a);
    assert.equal(`${a.region}-${a.level}`, key);
    const label = labelById.get(a.id);
    assert.equal(label.geometry.type, 'Point');
    assert.deepEqual(label.geometry.coordinates, a.center);
    assert.deepEqual(label.properties, a);
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
    const bbox = [180, 90, -180, -90];
    for (const polygon of polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1), `${a.name}: closed ring`);
      for (const [x, y] of ring) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y);
        bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y);
      }
    }
    assert.deepEqual(a.bbox, bbox);
    assert.ok(polygons.some(p => ringContains(a.center, p[0]) && !p.slice(1).some(r => ringContains(a.center, r))), `${a.name}: label inside polygon`);
    if (a.level === 'tehsil') {
      const parent = byId.get(a.parent);
      assert.equal(parent?.level, 'district');
      assert.equal(parent.region, a.region);
      assert.equal(parent.name, a.district);
      assert.equal(parent.district_lgd, a.district_lgd);
    }
  }
}
for (const [region, counts] of Object.entries(expected)) {
  assert.equal(catalog.filter(a => a.region === region && a.level === 'region').length, 1);
  for (const [level, count] of Object.entries(counts)) assert.equal(catalog.filter(a => a.region === region && a.level === level).length, count);
  const gaps = manifest.regions.find(r => r.id === region)?.districtsWithoutLinkedTehsils || [];
  for (const district of catalog.filter(a => a.region === region && a.level === 'district')) assert.ok(catalog.some(a => a.parent === district.id) || gaps.includes(district.name), `${district.name}: missing subdistrict coverage is documented`);
}
assert.equal(catalog.filter(a => a.region === 'in-haryana' && a.name === 'Loharu').length, 1);

// Exercise the actual editor model, including migration of older saved maps.
const modelSource = (await fs.readFile(new URL('app/map-model.ts', root), 'utf8'))
  .replace("import raw from './catalog.json';", `const raw=${JSON.stringify(catalog)};`)
  .replace("import indianSources from './indian-region-sources.json';", `const indianSources=${JSON.stringify(manifest)};`);
const compiled = ts.transpileModule(modelSource, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
assert.deepEqual(model.layerKeys, [...model.areasByLayer.keys()]);
assert.equal([...model.areasByLayer.values()].flat().length, catalog.length);
for (const [key, list] of model.areasByLayer) assert.ok(list.every(a => a.region + '-' + a.level === key));
const older = structuredClone(model.initial);
for (const region of Object.keys(expected)) delete older.regions[region];
const restored = model.validate(older);
const legacyKashmir = structuredClone(older);
delete legacyKashmir.kashmirView;
assert.equal(model.validate(legacyKashmir).kashmirView, 'separate', 'Older saved files use separate UTs');
assert.equal(model.validate({...older, kashmirView: 'unknown'}).kashmirView, 'separate');
const combinedDoc = model.validate({...older, kashmirView: 'combined'});
assert.equal(combinedDoc.kashmirView, 'combined');
assert.ok(model.visible(byId.get('kashmir-united'), combinedDoc));
assert.equal(model.visible(byId.get('kashmir-united'), restored), false);
for (const region of ['in-jammu-kashmir', 'in-ladakh']) {
  assert.equal(model.visible(byId.get(region), combinedDoc), false, 'UT outline suppressed in combined view');
  assert.ok(model.visible(catalog.find(a => a.region === region && a.level === 'district'), combinedDoc), 'Optional district detail remains available');
}
for (const region of Object.keys(expected)) {
  assert.deepEqual(restored.regions[region], model.initial.regions[region]);
  restored.regions[region].tehsil = true;
  const tehsil = catalog.find(a => a.region === region && a.level === 'tehsil');
  assert.ok(model.visible(tehsil, restored));
  restored.fills[tehsil.parent] = {color: '#2764d8', pattern: 'solid'};
  assert.deepEqual(model.effectivePaint(tehsil, restored), restored.fills[tehsil.parent]);
  restored.fills[tehsil.id] = {color: '#df635b', pattern: 'dots'};
  assert.deepEqual(model.effectivePaint(tehsil, restored), restored.fills[tehsil.id]);
  assert.deepEqual(model.validate(restored).fills[tehsil.id], restored.fills[tehsil.id]);
  restored.hidden.push(tehsil.parent);
  assert.equal(model.visible(tehsil, restored), false);
  restored.hidden = [];
  restored.regions[region].tehsil = false;
  assert.equal(model.visible(tehsil, restored), false);
}
const outlines = catalog.filter(a => a.level === 'region');
assert.deepEqual(model.allBounds, model.bounds(outlines));
for (const region of Object.keys(expected)) {
  const a = byId.get(region);
  assert.ok(a.bbox[0] >= model.allBounds[0] && a.bbox[1] >= model.allBounds[1] && a.bbox[2] <= model.allBounds[2] && a.bbox[3] <= model.allBounds[3]);
}
console.log(`Verified ${Object.keys(expected).length} Indian regions: polygon rings, labels, parent links, documented source gaps, provenance, saved-map migration, visibility, and inherited colors.`);
