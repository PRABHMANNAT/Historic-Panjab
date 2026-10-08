import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import {read, hash} from './delhi-source-utils.mjs';
import {extent, polygons} from './geojson-utils.mjs';

const manifest = await read('app/pakistan-division-sources.json');
const areas = await read('app/pakistan-division-areas.json');
const divisions = (await read('public/data/pk-country-division.geojson')).features;
const labels = (await read('public/data/pk-country-division-labels.geojson')).features;
const districts = (await read('public/data/pk-country-district.geojson')).features;
const provinces = (await read('public/data/pk-country-province.geojson')).features;
const districtById = new Map(districts.map(f => [f.properties.id, f]));
const provinceById = new Map(provinces.map(f => [f.properties.id, f]));
const labelsById = new Map(labels.map(f => [f.properties.id, f]));
const seen = new Set();
const tally = {};
const withinRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const insideGeometry = (point, geometry) => polygons(geometry).some(polygon => withinRing(point, polygon[0]) && !polygon.slice(1).some(ring => withinRing(point, ring)));

assert.equal(manifest.count, 36);
assert.equal(divisions.length, 36);
assert.equal(labels.length, divisions.length);
assert.deepEqual(areas, divisions.map(f => f.properties));
assert.equal(new Set(divisions.map(f => f.properties.id)).size, divisions.length);
for (const input of manifest.inputs) assert.equal(await hash(`public/data/${input.file}`), input.sha256, `Source hash ${input.file}`);
for (const output of manifest.outputs) assert.equal(await hash(`public/data/${output.file}`), output.sha256, `Output hash ${output.file}`);

for (const feature of divisions) {
  const p = feature.properties;
  assert.equal(p.region, 'pk-country'); assert.equal(p.level, 'division');
  assert.equal(p.membershipValidOn, '2023-03-01'); assert.equal(p.sourceValidOn, '2022-09-09');
  assert.ok(p.qualification.includes('not a current legal division survey'));
  assert.ok(p.membershipSource.startsWith('https://www.pbs.gov.pk/'));
  const province = provinceById.get(p.parent);
  assert.ok(province, `${p.name} has a real province/source regional unit`);
  tally[province.properties.sourceCode] = (tally[province.properties.sourceCode] || 0) + 1;
  assert.equal(p.province, province.properties.name);
  assert.equal(p.districtIds.length, p.sourceDistrictCodes.length);
  const members = p.districtIds.map((id, index) => {
    const member = districtById.get(id);
    assert.ok(member, `Source district ${id}`);
    assert.equal(member.properties.parent, p.parent, `No cross-province membership ${id}`);
    assert.equal(member.properties.sourceCode, p.sourceDistrictCodes[index]);
    assert.ok(!seen.has(id), `Assigned once: ${id}`); seen.add(id);
    assert.equal(manifest.districtDivision[id], p.id);
    return member;
  });
  assert.deepEqual(p.bbox, extent(feature.geometry));
  assert.ok(insideGeometry(p.center, feature.geometry), `Interior label: ${p.name}`);
  assert.deepEqual(labelsById.get(p.id).geometry, {type: 'Point', coordinates: p.center});
  assert.deepEqual(labelsById.get(p.id).properties, p);
  for (const polygon of polygons(feature.geometry)) for (const ring of polygon) {
    assert.ok(ring.length >= 4); assert.deepEqual(ring[0], ring.at(-1), `Closed ring: ${p.name}`);
    assert.ok(ring.every(point => point.length >= 2 && point.every(Number.isFinite)));
  }
  const union = clipping.union(...members.map(member => member.geometry.coordinates));
  assert.deepEqual(clipping.difference(feature.geometry.coordinates, union), [], `No invented division territory: ${p.name}`);
  assert.deepEqual(clipping.difference(union, feature.geometry.coordinates), [], `No omitted source district territory: ${p.name}`);
}
assert.deepEqual(tally, {PK1: 3, PK2: 8, PK3: 3, PK5: 7, PK6: 9, PK7: 6});
assert.equal(seen.size, 159);
assert.deepEqual(districts.filter(f => !seen.has(f.properties.id)).map(f => f.properties.sourceCode), ['PK401']);
assert.deepEqual(manifest.noDivision.map(item => item.sourceCode), ['PK401']);
assert.equal(divisions.filter(f => f.properties.parent === 'pk-country-p-pk4').length, 0, 'No fictional Islamabad division');
assert.equal(manifest.sourceGeometryGaps[0].name, 'Keamari');
assert.equal(manifest.supplementalAssignments.length, 5);
for (const extra of manifest.supplementalAssignments) {
  const district = districts.find(f => f.properties.sourceCode === extra.district);
  const division = divisions.find(f => f.properties.id === manifest.districtDivision[district.properties.id]);
  assert.equal(division.properties.name, extra.division);
  assert.ok(extra.evidence.startsWith('https://'));
  if (extra.district.startsWith('PK3')) assert.ok(extra.kind.startsWith('Press reports'), 'Do not mislabel GB supplemental reporting as primary official geometry');
}
console.log('Verified 36 exact Pakistan division unions, 159 unique district assignments, interior labels, source/output hashes, dated crosswalks and explicit Islamabad/Keamari qualifications.');
