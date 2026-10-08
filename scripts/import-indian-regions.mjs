import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {polygons, extent, labelPoint} from './geojson-utils.mjs';

// The upstream GeoJSON has one feature per line. Stream it so the entire
// India-wide geometry collection never needs to be held in memory.
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.join(root, 'public/data');
const cacheDir = path.join(root, 'work/indian-region-sources');
const base = 'https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev';
const availableDefinitions = [
  {id: 'in-haryana', name: 'Haryana', code: 6, districts: 22},
  {id: 'in-himachal', name: 'Himachal Pradesh', code: 2, districts: 12},
  {id: 'in-andhra', name: 'Andhra Pradesh', code: 28, districts: 26},
  {id: 'in-rajasthan', name: 'Rajasthan', code: 8, districts: 50},
  {id: 'in-uttar-pradesh', name: 'Uttar Pradesh', code: 9, districts: 75},
  {id: 'in-uttarakhand', name: 'Uttarakhand', code: 5, districts: 13},
  {id: 'in-jammu-kashmir', name: 'Jammu & Kashmir', code: 1, districts: 20},
  {id: 'in-ladakh', name: 'Ladakh', code: 37, districts: 2},
  {id: 'in-arunachal', name: 'Arunachal Pradesh', code: 12, districts: 26},
  {id: 'in-assam', name: 'Assam', code: 18, districts: 35},
  {id: 'in-bihar', name: 'Bihar', code: 10, districts: 38},
  {id: 'in-chhattisgarh', name: 'Chhattisgarh', code: 22, districts: 33},
  {id: 'in-goa', name: 'Goa', code: 30, districts: 2},
  {id: 'in-gujarat', name: 'Gujarat', code: 24, districts: 33},
  {id: 'in-jharkhand', name: 'Jharkhand', code: 20, districts: 24},
  {id: 'in-karnataka', name: 'Karnataka', code: 29, districts: 31},
  {id: 'in-kerala', name: 'Kerala', code: 32, districts: 14},
  {id: 'in-madhya-pradesh', name: 'Madhya Pradesh', code: 23, districts: 52},
  {id: 'in-maharashtra', name: 'Maharashtra', code: 27, districts: 36},
  {id: 'in-manipur', name: 'Manipur', code: 14, districts: 16},
  {id: 'in-meghalaya', name: 'Meghalaya', code: 17, districts: 12},
  {id: 'in-mizoram', name: 'Mizoram', code: 15, districts: 11},
  {id: 'in-nagaland', name: 'Nagaland', code: 13, districts: 16},
  {id: 'in-odisha', name: 'Odisha', code: 21, districts: 30},
  {id: 'in-sikkim', name: 'Sikkim', code: 11, districts: 6},
  {id: 'in-tamil-nadu', name: 'Tamil Nadu', code: 33, districts: 38},
  {id: 'in-telangana', name: 'Telangana', code: 36, districts: 33},
  {id: 'in-tripura', name: 'Tripura', code: 16, districts: 8},
  {id: 'in-west-bengal', name: 'West Bengal', code: 19, districts: 23},
  {id: 'in-andaman-nicobar', name: 'Andaman and Nicobar Islands', code: 35, districts: 3},
  {id: 'in-dnh-dd', name: 'Dadra and Nagar Haveli and Daman and Diu', code: 38, districts: 3},
  {id: 'in-delhi', name: 'Delhi (National Capital Territory)', code: 7, districts: 11},
  {id: 'in-lakshadweep', name: 'Lakshadweep', code: 31, districts: 1},
  {id: 'in-puducherry', name: 'Puducherry', code: 34, districts: 4},
];
const requested = process.argv.find(arg => arg.startsWith('--regions='))?.slice('--regions='.length).split(',');
const definitions = requested ? availableDefinitions.filter(r => requested.includes(r.id)) : availableDefinitions;
if (requested?.some(id => !availableDefinitions.some(r => r.id === id))) throw Error('Unknown requested region');
const sourceFiles = {
  region: 'admin/states/LGD_States.geojson',
  district: 'admin/districts/LGD_Districts.geojson',
  tehsil: 'admin/subdistricts/LGD_Subdistricts.geojson',
};
const source = 'LGD via Bharatlas · 2024 snapshot';
const collection = features => ({type: 'FeatureCollection', features});
const writeJson = (file, value) => fs.writeFile(file, JSON.stringify(value) + '\n');

async function readSource(level) {
  const cached = path.join(cacheDir, `${level}.geojson`);
  const selectRequested = features => process.argv.includes('--cache-only') ? features : features.filter(f => definitions.some(r => r.code === Number(f.properties.state_lgd ?? f.properties.State_LGD)));
  // Avoid reparsing the whole 200 MB subdistrict cache for a single-state import.
  const shardPath = code => path.join(cacheDir, `${level}-${code}.geojson`);
  const cacheShards = async features => {
    const groups = new Map(availableDefinitions.map(r => [r.code, []]));
    for (const f of features) groups.get(Number(f.properties.state_lgd ?? f.properties.State_LGD))?.push(f);
    await Promise.all([...groups].map(([code, items]) => writeJson(shardPath(code), collection(items))));
  };
  if (!process.argv.includes('--refresh')) {
    if (!process.argv.includes('--cache-only')) {
      try {
        const shards = await Promise.all(definitions.map(async r => JSON.parse(await fs.readFile(shardPath(r.code), 'utf8')).features));
        if (shards.every((items, i) => items.length && items.every(f => Number(f.properties.state_lgd ?? f.properties.State_LGD) === definitions[i].code))) return shards.flat();
      } catch (error) {if (error.code !== 'ENOENT') throw error;}
    }
    try {
      const features = JSON.parse(await fs.readFile(cached, 'utf8')).features;
      if (definitions.every(r => features.some(f => Number(f.properties.state_lgd ?? f.properties.State_LGD) === r.code))) {
        await cacheShards(features);
        return selectRequested(features);
      }
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  const rawDir = process.argv.find(arg => arg.startsWith('--raw-dir='))?.slice('--raw-dir='.length);
  let input;
  if (rawDir) {
    console.log(`Reading downloaded ${level} source…`);
    input = createReadStream(path.resolve(root, rawDir, `${level}.geojson`));
  } else {
    console.log(`Downloading ${sourceFiles[level]}…`);
    const response = await fetch(`${base}/${sourceFiles[level]}`, {signal: AbortSignal.timeout(600000)});
    if (!response.ok || !response.body) throw Error(`Source download failed: ${response.status}`);
    input = Readable.fromWeb(response.body);
  }
  const lines = createInterface({input, crlfDelay: Infinity});
  const selected = [];
  let total = 0;
  for await (const line of lines) {
    const text = line.trim().replace(/,$/, '');
    if (!/^\{\s*"type"\s*:\s*"Feature"\s*,/.test(text)) continue;
    const feature = JSON.parse(text); total++;
    if (total % 1000 === 0) console.log(`${level}: processed ${total} features…`);
    const code = Number(feature.properties.state_lgd ?? feature.properties.State_LGD);
    if (availableDefinitions.some(region => region.code === code)) selected.push(feature);
  }
  if (!selected.length) throw Error(`No selected features in ${level}; inspect the upstream format`);
  await writeJson(cached, collection(selected));
  await cacheShards(selected);
  console.log(`${level}: retained ${selected.length} of ${total} source features`);
  return selectRequested(selected);
}

await fs.mkdir(cacheDir, {recursive: true});
const [states, districts, rawTehsils] = await Promise.all(['region', 'district', 'tehsil'].map(readSource));
if (process.argv.includes('--cache-only')) {
  for (const r of availableDefinitions) {
    const ds = districts.filter(f => Number(f.properties.state_lgd) === r.code && Number(f.properties.dist_lgd) > 0);
    const ts = rawTehsils.filter(f => Number(f.properties.state_lgd) === r.code && f.properties.sdtname?.trim());
    console.log(JSON.stringify({id: r.id, districts: ds.length, namedSubdistricts: ts.length, missingParents: ts.filter(t => !ds.some(d => Number(d.properties.dist_lgd) === Number(t.properties.dist_lgd))).map(t => ({name: t.properties.sdtname, parent: t.properties.dist_lgd}))}));
  }
  process.exit(0);
}
// Loharu has two source records with the same LGD code. Keep both geometries
// in one multipart area, so searching, coloring, and labels use one tehsil ID.
const tehsilGroups = new Map();
const codeParents = new Map();
for (const feature of rawTehsils) {
  const p = feature.properties;
  // Blank records represent claimed-extent fillers, not named tehsils.
  if (!p.sdtname?.trim() || !Number(p.dist_lgd)) continue;
  const sourceId = Number(p.subdt_lgd) || `source-${p.OBJECTID}`;
  const key = `${p.state_lgd}-${sourceId}-${p.dist_lgd}`;
  const codeKey = `${p.state_lgd}-${sourceId}`;
  const parents = codeParents.get(codeKey) || new Set();
  parents.add(p.dist_lgd); codeParents.set(codeKey, parents);
  const previous = tehsilGroups.get(key);
  if (!previous) {tehsilGroups.set(key, feature); continue;}
  if (previous.properties.sdtname !== p.sdtname || previous.properties.dist_lgd !== p.dist_lgd) throw Error(`Conflicting source identities for ${key}`);
  tehsilGroups.set(key, {...previous, geometry: {type: 'MultiPolygon', coordinates: [...polygons(previous.geometry), ...polygons(feature.geometry)]}});
}
const tehsils = [...tehsilGroups.values()];
const catalogPath = path.join(root, 'app/catalog.json');
const oldCatalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const manifestPath = path.join(root, 'app/indian-region-sources.json');
const previousManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const additions = [], layers = {}, writes = [];
for (const region of definitions) {
  const stateCode = f => Number(f.properties.state_lgd ?? f.properties.State_LGD);
  const districtList = districts.filter(f => stateCode(f) === region.code && Number(f.properties.dist_lgd) > 0);
  const tehsilList = tehsils.filter(f => stateCode(f) === region.code);
  if (!districtList.length || (region.districts !== undefined && districtList.length !== region.districts)) throw Error(`${region.name}: expected ${region.districts || 'nonempty'} districts, got ${districtList.length}`);
  const names = new Map(districtList.map(f => [Number(f.properties.dist_lgd), f.properties.dtname]));
  for (const [level, raw] of [['region', states.filter(f => stateCode(f) === region.code)], ['district', districtList], ['tehsil', tehsilList]]) {
    if (level === 'region' && raw.length !== 1) throw Error(`Expected one state outline for ${region.name}`);
    const features = raw.map(f => {
      if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) throw Error('Missing polygon geometry');
      const districtCode = Number(f.properties.dist_lgd);
      const subdistrictCode = Number(f.properties.subdt_lgd);
      if (level === 'tehsil' && !names.has(districtCode)) throw Error(`Missing parent for ${f.properties.sdtname}`);
      const sourceId = subdistrictCode || `source-${f.properties.OBJECTID}`;
      const duplicate = codeParents.get(`${region.code}-${sourceId}`)?.size > 1;
      const id = level === 'region' ? region.id : `${region.id}-${level === 'district' ? 'd' : 't'}-${level === 'district' ? districtCode : sourceId}${level === 'tehsil' && duplicate ? `-${districtCode}` : ''}`;
      const properties = {
        id, name: level === 'region' ? region.name : level === 'district' ? f.properties.dtname : f.properties.sdtname,
        region: region.id, level, parent: level === 'tehsil' ? `${region.id}-d-${districtCode}` : '',
        ...(level === 'tehsil' ? {district: names.get(districtCode)} : {}),
        source, state_lgd: region.code,
        ...(level !== 'region' ? {district_lgd: districtCode} : {}),
        ...(level === 'tehsil' ? {subdistrict_lgd: subdistrictCode || null, ...(subdistrictCode ? {} : {source_objectid: f.properties.OBJECTID})} : {}),
        center: labelPoint(f.geometry), bbox: extent(f.geometry),
      };
      if (!properties.name) throw Error(`Missing name for ${id}`);
      additions.push(properties);
      return {type: 'Feature', id, properties, geometry: f.geometry};
    }).sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    const key = `${region.id}-${level}`;
    const geometryJson = collection(features);
    const hash = createHash('sha256').update(JSON.stringify(geometryJson) + '\n').digest('hex');
    layers[key] = {count: features.length, sha256: hash, sourceUrl: `${base}/${sourceFiles[level]}`};
    writes.push([path.join(dataDir, `${key}.geojson`), geometryJson]);
    writes.push([path.join(dataDir, `${key}-labels.geojson`), collection(features.map(f => ({...f, geometry: {type: 'Point', coordinates: f.properties.center}})))]);
    console.log(`${region.name}: ${features.length} ${level} polygons`);
  }
}
const ids = additions.map(a => a.id);
if (new Set(ids).size !== ids.length) throw Error('Duplicate LGD IDs');
for (const [file, data] of writes) await writeJson(file, data);
await writeJson(catalogPath, [...oldCatalog.filter(a => !definitions.some(r => r.id === a.region)), ...additions]);
await fs.writeFile(manifestPath, JSON.stringify({
  retrieved: new Date().toISOString().slice(0, 10), snapshot: '2024', license: 'CC0-1.0 (Bharatlas catalogue)',
  attribution: source, catalogUrl: 'https://bharatlas.com/view/lgd_subdistricts',
  coverage: 'Named district and subdistrict polygons from the LGD 2024 snapshot. Subdistricts include tehsils, sub-tehsils, taluks, talukas, mandals, circles and other source units. Later administrative changes may be absent. Rajasthan has 50 district polygons but tehsil parent codes predate that reorganisation. Arunachal Pradesh has one source district without linked subdistrict detail. One unnamed Maharashtra subdistrict record is omitted. Jammu & Kashmir and Ladakh state outlines depict the Indian claimed extent, including disputed territories. Unnamed extent fillers and zero-LGD claimed districts are not presented as administrative tehsils or districts.',
  coordinateProcessing: 'Original source coordinates retained; interior label points derived. Same-code, same-parent fragments (Loharu and Bhopalsagar) are grouped as multipart areas. Kanth has conflicting source parent codes and is retained as two separate source records. Named records with missing LGD codes get stable source-object IDs, without inventing LGD codes.',
  regions: [...previousManifest.regions.filter(r => !definitions.some(d => d.id === r.id)), ...definitions.map(r => ({
    id: r.id, name: r.name, state_lgd: r.code,
    districtsWithoutLinkedTehsils: districts.filter(f => Number(f.properties.state_lgd) === r.code && Number(f.properties.dist_lgd) > 0 && !tehsils.some(t => Number(t.properties.state_lgd) === r.code && Number(t.properties.dist_lgd) === Number(f.properties.dist_lgd))).map(f => f.properties.dtname),
    omittedUnnamedTehsilRecords: rawTehsils.filter(f => Number(f.properties.state_lgd) === r.code && !f.properties.sdtname?.trim()).length,
  }))],
  layers: {...previousManifest.layers, ...layers},
}, null, 2) + '\n');
