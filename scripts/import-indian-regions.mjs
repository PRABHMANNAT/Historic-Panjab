import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// The upstream GeoJSON has one feature per line. Stream it so the entire
// India-wide geometry collection never needs to be held in memory.
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.join(root, 'public/data');
const cacheDir = path.join(root, 'work/indian-region-sources');
const base = 'https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev';
const definitions = [
  {id: 'in-haryana', name: 'Haryana', code: 6, districts: 22},
  {id: 'in-himachal', name: 'Himachal Pradesh', code: 2, districts: 12},
];
const sourceFiles = {
  region: 'admin/states/LGD_States.geojson',
  district: 'admin/districts/LGD_Districts.geojson',
  tehsil: 'admin/subdistricts/LGD_Subdistricts.geojson',
};
const source = 'LGD via Bharatlas · 2024 snapshot';
const collection = features => ({type: 'FeatureCollection', features});
const writeJson = (file, value) => fs.writeFile(file, JSON.stringify(value) + '\n');
const polygons = geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

function ringArea(ring) {
  return Math.abs(ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2);
}

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function extent(geometry) {
  const bbox = [180, 90, -180, -90];
  for (const polygon of polygons(geometry)) for (const ring of polygon) for (const [x, y] of ring) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < -180 || x > 180 || y < -90 || y > 90) throw Error('Invalid coordinate');
    bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y);
    bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y);
  }
  return bbox;
}

// Put the label/selection point inside the largest polygon, including holes.
function labelPoint(geometry) {
  const polygon = [...polygons(geometry)].sort((a, b) => ringArea(b[0]) - ringArea(a[0]))[0];
  const ring = polygon[0];
  const inside = p => insideRing(p, ring) && !polygon.slice(1).some(hole => insideRing(p, hole));
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const p = ring[i], q = ring[i + 1], cross = p[0] * q[1] - q[0] * p[1];
    area += cross; x += (p[0] + q[0]) * cross; y += (p[1] + q[1]) * cross;
  }
  const center = [x / (3 * area), y / (3 * area)];
  if (inside(center)) return center;
  const bbox = extent({type: 'Polygon', coordinates: polygon});
  let widest = 0, best;
  for (const fraction of [.5, .4, .6, .3, .7, .2, .8, .1, .9]) {
    const latitude = bbox[1] + (bbox[3] - bbox[1]) * fraction;
    const crossings = [];
    for (const r of polygon) for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      if ((a[1] > latitude) !== (b[1] > latitude)) crossings.push(a[0] + (latitude - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length - 1; i++) {
      const point = [(crossings[i] + crossings[i + 1]) / 2, latitude];
      const width = crossings[i + 1] - crossings[i];
      if (width > widest && inside(point)) {widest = width; best = point;}
    }
  }
  if (!best) throw Error('Could not find an interior label point');
  return best;
}

async function readSource(level) {
  const cached = path.join(cacheDir, `${level}.geojson`);
  if (!process.argv.includes('--refresh')) {
    try {return JSON.parse(await fs.readFile(cached, 'utf8')).features;} catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  console.log(`Downloading ${sourceFiles[level]}…`);
  const response = await fetch(`${base}/${sourceFiles[level]}`, {signal: AbortSignal.timeout(300000)});
  if (!response.ok || !response.body) throw Error(`Source download failed: ${response.status}`);
  const lines = createInterface({input: Readable.fromWeb(response.body), crlfDelay: Infinity});
  const selected = [];
  let total = 0;
  for await (const line of lines) {
    const text = line.trim().replace(/,$/, '');
    if (!/^\{\s*"type"\s*:\s*"Feature"\s*,/.test(text)) continue;
    const feature = JSON.parse(text); total++;
    const code = Number(feature.properties.state_lgd ?? feature.properties.State_LGD);
    if (definitions.some(region => region.code === code)) selected.push(feature);
  }
  if (!selected.length) throw Error(`No selected features in ${level}; inspect the upstream format`);
  await writeJson(cached, collection(selected));
  console.log(`${level}: retained ${selected.length} of ${total} source features`);
  return selected;
}

await fs.mkdir(cacheDir, {recursive: true});
const [states, districts, rawTehsils] = await Promise.all(['region', 'district', 'tehsil'].map(readSource));
// Loharu has two source records with the same LGD code. Keep both geometries
// in one multipart area, so searching, coloring, and labels use one tehsil ID.
const tehsilGroups = new Map();
for (const feature of rawTehsils) {
  const p = feature.properties, key = `${p.state_lgd}-${p.subdt_lgd}`;
  const previous = tehsilGroups.get(key);
  if (!previous) {tehsilGroups.set(key, feature); continue;}
  if (previous.properties.sdtname !== p.sdtname || previous.properties.dist_lgd !== p.dist_lgd) throw Error(`Conflicting source identities for ${key}`);
  tehsilGroups.set(key, {...previous, geometry: {type: 'MultiPolygon', coordinates: [...polygons(previous.geometry), ...polygons(feature.geometry)]}});
}
const tehsils = [...tehsilGroups.values()];
const catalogPath = path.join(root, 'app/catalog.json');
const oldCatalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const additions = [], layers = {}, writes = [];
for (const region of definitions) {
  const stateCode = f => Number(f.properties.state_lgd ?? f.properties.State_LGD);
  const districtList = districts.filter(f => stateCode(f) === region.code);
  const tehsilList = tehsils.filter(f => stateCode(f) === region.code);
  if (districtList.length !== region.districts) throw Error(`${region.name}: expected ${region.districts} districts, got ${districtList.length}`);
  const names = new Map(districtList.map(f => [Number(f.properties.dist_lgd), f.properties.dtname]));
  for (const [level, raw] of [['region', states.filter(f => stateCode(f) === region.code)], ['district', districtList], ['tehsil', tehsilList]]) {
    if (level === 'region' && raw.length !== 1) throw Error(`Expected one state outline for ${region.name}`);
    const features = raw.map(f => {
      if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) throw Error('Missing polygon geometry');
      const districtCode = Number(f.properties.dist_lgd);
      const subdistrictCode = Number(f.properties.subdt_lgd);
      if (level === 'tehsil' && (!names.has(districtCode) || !subdistrictCode)) throw Error(`Missing parent/code for ${f.properties.sdtname}`);
      const id = level === 'region' ? region.id : `${region.id}-${level === 'district' ? 'd' : 't'}-${level === 'district' ? districtCode : subdistrictCode}`;
      const properties = {
        id, name: level === 'region' ? region.name : level === 'district' ? f.properties.dtname : f.properties.sdtname,
        region: region.id, level, parent: level === 'tehsil' ? `${region.id}-d-${districtCode}` : '',
        ...(level === 'tehsil' ? {district: names.get(districtCode)} : {}),
        source, state_lgd: region.code,
        ...(level !== 'region' ? {district_lgd: districtCode} : {}),
        ...(level === 'tehsil' ? {subdistrict_lgd: subdistrictCode} : {}),
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
await fs.writeFile(path.join(root, 'app/indian-region-sources.json'), JSON.stringify({
  retrieved: new Date().toISOString().slice(0, 10), snapshot: '2024', license: 'CC0-1.0 (Bharatlas catalogue)',
  attribution: source, catalogUrl: 'https://bharatlas.com/view/lgd_subdistricts',
  coverage: 'All district and subdistrict polygons supplied for Haryana and Himachal Pradesh by this LGD snapshot. Subdistricts include tehsils and sub-tehsils; later administrative changes may be absent.',
  coordinateProcessing: 'Original source coordinates retained; label points derived inside the largest polygon. Two Loharu records with the same LGD code are grouped into one multipart feature.',
  regions: definitions.map(r => ({id: r.id, name: r.name, state_lgd: r.code})), layers,
}, null, 2) + '\n');
