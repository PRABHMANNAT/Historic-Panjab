import {cached, collection, hash, record, write} from './delhi-source-utils.mjs';

const endpoint = id => `https://www.openstreetmap.org/api/0.6/relation/${id}.json`;
const network = await cached('work/delhi-metro-network.json', endpoint(2536305));
const sourceIds = [...new Set([...network.elements[0].members.filter(m => m.type === 'relation').map(m => m.ref), 9256785])];
const inputs = [], lines = [], features = [], stations = [];
const inactive = tags => ['proposed', 'construction', 'disused', 'abandoned'].includes(tags?.state) || !!tags?.['proposed:route'] || !!tags?.['construction:route'];
const hex = color => /^#[0-9a-f]{6}$/i.test(color || '') ? color.toUpperCase() : ({gray: '#808080', aqua: '#00FFFF'}[color] || null);
for (const id of sourceIds) {
  const masterFile = `work/osm-relation-${id}.json`;
  const raw = await cached(masterFile, endpoint(id));
  const master = raw.elements.find(e => e.type === 'relation' && e.id === id);
  if (inactive(master.tags) || !['Delhi Metro', 'Rapid Metro Gurgaon', 'Noida Metro'].includes(master.tags.network)) continue;
  if (master.tags.route_master !== 'subway' && master.tags.route !== 'subway') continue;
  const color = hex(master.tags.colour);
  if (!color) throw Error(`No source line color: ${id}`);
  inputs.push({relation: id, url: endpoint(id), sha256: await hash(masterFile)});
  const lineId = `osm-${id}`, routeIds = master.tags.type === 'route_master' ? master.members.filter(m => m.type === 'relation').map(m => m.ref) : [id];
  const ways = new Map(), lineStations = [];
  for (const routeId of routeIds) {
    const file = `work/osm-route-${routeId}-full.json`, url = `https://www.openstreetmap.org/api/0.6/relation/${routeId}/full.json`;
    const full = await cached(file, url);
    const route = full.elements.find(e => e.type === 'relation' && e.id === routeId);
    if (!route || route.tags.route !== 'subway' || inactive(route.tags)) continue;
    inputs.push({relation: routeId, url, sha256: await hash(file)});
    const nodes = new Map(full.elements.filter(e => e.type === 'node').map(e => [e.id, e]));
    const memberWays = new Set(route.members.filter(m => m.type === 'way' && !/platform|depot/.test(m.role)).map(m => m.ref));
    for (const way of full.elements.filter(e => e.type === 'way' && memberWays.has(e.id))) {
      if (!['subway', 'light_rail', 'rail'].includes(way.tags?.railway)) continue;
      const coordinates = way.nodes.map(id => {const node = nodes.get(id); if (!node) throw Error(`Unresolved OSM node ${id}`); return [node.lon, node.lat];});
      if (coordinates.length < 2) throw Error('Empty track way');
      ways.set(way.id, coordinates);
    }
    const stationIds = new Set(route.members.filter(m => m.type === 'node' && /stop|platform/.test(m.role)).map(m => m.ref));
    for (const node of nodes.values()) {
      const name = node.tags?.['name:en'] || node.tags?.name;
      if (!name || (!stationIds.has(node.id) && node.tags?.railway !== 'station' && node.tags?.public_transport !== 'station')) continue;
      lineStations.push({name, coordinates: [node.lon, node.lat], osmNodeId: node.id});
    }
  }
  if (!ways.size) throw Error(`No rail geometry for ${master.tags.name}`);
  const name = master.tags['name:en'] || master.tags.name;
  const line = {id: lineId, name, color, network: master.tags.network, ref: master.tags.ref || '', masterRelation: id, routeIds, wayIds: [...ways.keys()]};
  lines.push(line);
  features.push({type: 'Feature', id: lineId, properties: {id: lineId, name, color, network: line.network}, geometry: {type: 'MultiLineString', coordinates: [...ways.values()]}});
  for (const node of lineStations) {
    // Only consolidate same-name platform/stop points within ~150m. This is
    // cartographic decluttering, not a claim that stations share an interchange.
    const match = stations.find(s => s.name.toLowerCase() === node.name.toLowerCase() && Math.hypot((s.coordinates[0] - node.coordinates[0]) * 98000, (s.coordinates[1] - node.coordinates[1]) * 111000) < 150);
    if (match) {if (!match.lineIds.includes(lineId)) match.lineIds.push(lineId); if (!match.osmNodeIds.includes(node.osmNodeId)) match.osmNodeIds.push(node.osmNodeId);}
    else stations.push({name: node.name, coordinates: node.coordinates, lineIds: [lineId], osmNodeIds: [node.osmNodeId]});
  }
  console.log(`${name}: ${ways.size} mapped ways`);
}
if (lines.length < 10 || stations.length < 200) throw Error('Unexpectedly incomplete metro snapshot');
lines.sort((a, b) => a.name.localeCompare(b.name));
const stationFeatures = stations.map(s => ({type: 'Feature', id: `osm-node-${s.osmNodeIds[0]}`, properties: {id: `osm-node-${s.osmNodeIds[0]}`, name: s.name, lineIds: s.lineIds, osmNodeIds: s.osmNodeIds}, geometry: {type: 'Point', coordinates: s.coordinates}}));
const coordinates = features.flatMap(f => f.geometry.coordinates.flat());
const bbox = [Math.min(...coordinates.map(p => p[0])), Math.min(...coordinates.map(p => p[1])), Math.max(...coordinates.map(p => p[0])), Math.max(...coordinates.map(p => p[1]))];
await write('public/data/delhi-metro-routes.geojson', collection(features));
await write('public/data/delhi-metro-stations.geojson', collection(stationFeatures));
await record('metro', {page: 'https://wiki.openstreetmap.org/wiki/Delhi_Metro', noidaPage: 'https://wiki.openstreetmap.org/wiki/Noida_Metro', officialNetwork: 'https://delhimetrorail.com/network_map', attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0', licenseUrl: 'https://www.openstreetmap.org/copyright', lines, stations: stations.length, bbox, inputs, excluded: 'Non-subway suburban railway, proposed routes and RRTS networks are excluded. Only mapped rail ways from route members are included; depots and platform polygons are excluded.', processing: 'Actual source way/node coordinates retained. Both route directions are deduplicated by way ID. Same-name station points within 150m are consolidated; original node IDs retained. Contributor user/uid fields are not published.', caveat: 'OpenStreetMap route snapshot, not a live service/timetable or a guarantee of complete current coverage. Source colors can be customized; routes may contain mapping gaps.'}, ['delhi-metro-routes.geojson', 'delhi-metro-stations.geojson']);
console.log(`Built ${lines.length} colored metro lines and ${stations.length} station points.`);
