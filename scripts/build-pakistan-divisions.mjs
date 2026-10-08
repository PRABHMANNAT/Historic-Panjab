import clipping from 'polygon-clipping';
import {extent, labelPoint} from './geojson-utils.mjs';
import {read, write, hash, collection} from './delhi-source-utils.mjs';

// Division membership is a dated table join, not a spatial guess. Source codes
// below refer to the unchanged WFP/OCHA ADM2 snapshot already used by the app.
const pbs = 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf';
const units = 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/Administrative-Units-2023.pdf';
const agriculture = 'https://agriculture.balochistan.gov.pk/wp-content/uploads/2023/09/BOOK-2021-22.pdf';
const archaeology = 'https://doam.gov.pk/public/sites/9028';
const gbReport = 'https://www.dawn.com/news/1488851/four-new-districts-set-up-in-gb';
const gbPamir = 'https://pamirtimes.net/2019/06/18/administrative-reforms-gilgit-baltistan-govt-issues-notification-of-four-new-districts/';
const defs = [
  ['PK1', 'Muzaffarabad', '103 107 108'],
  ['PK1', 'Rawalakot', '101 104 109 110'],
  ['PK1', 'Mirpur', '102 105 106'],
  ['PK2', 'Kalat', '201 210 213 217 220 233'],
  ['PK2', 'Loralai', '202 219 221 234'],
  ['PK2', 'Mekran', '205 211 224'],
  ['PK2', 'Nasirabad', '207 208 209 222 229'],
  ['PK2', 'Quetta', '214 225 226 235'],
  ['PK2', 'Rakhshan', '203 212 223 230'],
  ['PK2', 'Sibi', '204 206 216 218 228 232'],
  ['PK2', 'Zhob', '215 227 231'],
  ['PK3', 'Gilgit', '304 305 306 308 313'],
  ['PK3', 'Baltistan', '303 307 309 310 314'],
  ['PK3', 'Astore / Diamer', '301 302 311 312'],
  ['PK5', 'Malakand', '502 505 507 508 520 521 529 532 535'],
  ['PK5', 'Hazara', '501 504 511 515 516 517 522 534'],
  ['PK5', 'Mardan', '523 531'],
  ['PK5', 'Peshawar', '506 513 524 526 528'],
  ['PK5', 'Kohat', '510 512 514 518 527'],
  ['PK5', 'Bannu', '503 519 525'],
  ['PK5', 'Dera Ismail Khan', '509 530 533'],
  ['PK6', 'Rawalpindi', '601 605 613 630'],
  ['PK6', 'Sargodha', '604 616 621 632'],
  ['PK6', 'Faisalabad', '606 608 612 635'],
  ['PK6', 'Gujranwala', '609 610 611 620 625 634'],
  ['PK6', 'Lahore', '614 617 624 633'],
  ['PK6', 'Sahiwal', '626 627 631'],
  ['PK6', 'Multan', '615 619 622 636'],
  ['PK6', 'Dera Ghazi Khan', '607 618 623 629'],
  ['PK6', 'Bahawalpur', '602 603 628'],
  ['PK7', 'Larkana', '707 709 710 713 720'],
  ['PK7', 'Sukkur', '705 711 723'],
  ['PK7', 'Shaheed Benazirabad', '717 718 719'],
  ['PK7', 'Hyderabad', '701 703 706 708 715 722 724 725 727'],
  ['PK7', 'Mirpur Khas', '716 726 728'],
  ['PK7', 'Karachi', '702 704 712 714 721 729'],
];
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const provinceCollection = await read('public/data/pk-country-province.geojson');
const districtCollection = await read('public/data/pk-country-district.geojson');
const provinces = new Map(provinceCollection.features.map(f => [f.properties.sourceCode, f]));
const districts = new Map(districtCollection.features.map(f => [f.properties.sourceCode, f]));
const assigned = new Set();
const sourceNameAliases = {
  PK103: {sourceName: 'Jhelum Valley', tableName: 'Hattian Bala', evidence: pbs},
  PK233: {sourceName: 'Shaheed Sikandarabad', tableName: 'Surab', evidence: archaeology},
};
const supplementalAssignments = [
  {district: 'PK218', division: 'Sibi', evidence: agriculture, kind: 'Primary provincial agriculture administrative table, 2021-22', note: 'Lehri remains a separate polygon in WFP ADM2 even though PBS 2023 no longer lists it separately.'},
  {district: 'PK311', division: 'Astore / Diamer', evidence: gbReport, corroboratingEvidence: gbPamir, kind: 'Press reports of Government of Gilgit-Baltistan notification, 2019-06-17', note: 'Darel: notification reported under Diamer; PBS 2023 names this two-district division Astore.'},
  {district: 'PK312', division: 'Astore / Diamer', evidence: gbReport, corroboratingEvidence: gbPamir, kind: 'Press reports of Government of Gilgit-Baltistan notification, 2019-06-17', note: 'Tangir: notification reported under Diamer; PBS 2023 names this two-district division Astore.'},
  {district: 'PK313', division: 'Gilgit', evidence: gbReport, corroboratingEvidence: gbPamir, kind: 'Press reports of Government of Gilgit-Baltistan notification, 2019-06-17', note: 'Gupis-Yasin is an additional named WFP source polygon; PBS 2023 lists ten GB districts.'},
  {district: 'PK314', division: 'Baltistan', evidence: gbReport, corroboratingEvidence: gbPamir, kind: 'Press reports of Government of Gilgit-Baltistan notification, 2019-06-17', note: 'Rondu is an additional named WFP source polygon; PBS 2023 lists ten GB districts.'},
];

const features = defs.map(([provinceCode, name, numbers]) => {
  const province = provinces.get(provinceCode);
  if (!province) throw Error(`Missing source province ${provinceCode}`);
  const codes = numbers.split(' ').map(number => `PK${number}`);
  const members = codes.map(code => {
    const district = districts.get(code);
    if (!district || district.properties.sourceParentCode !== provinceCode) throw Error(`Invalid source district/province join ${code}`);
    if (assigned.has(code)) throw Error(`District assigned more than once: ${code}`);
    assigned.add(code); return district;
  });
  const id = `pk-country-div-${slug(provinceCode)}-${slug(name)}`;
  // Use a balanced dissolve to avoid unnecessarily complex intermediate unions.
  let parts = members.map(f => f.geometry.coordinates);
  while (parts.length > 1) {
    const next = [];
    for (let i = 0; i < parts.length; i += 2) next.push(i + 1 < parts.length ? clipping.union(parts[i], parts[i + 1]) : parts[i]);
    parts = next;
  }
  const geometry = {type: 'MultiPolygon', coordinates: members.length === 1 && members[0].geometry.type === 'Polygon' ? [parts[0]] : parts[0]};
  const supplementary = supplementalAssignments.filter(item => codes.includes(item.district));
  const qualification = 'Derived exact union of WFP/OCHA 2022 district polygons using PBS frozen 01-03-2023 division membership. Source-era view, not a current legal division survey.' + (supplementary.length ? ' Additional source districts use the specifically cited supplemental assignments.' : '') + (provinceCode === 'PK7' && name === 'Karachi' ? ' WFP has no separate Keamari district: its source-era area remains inside West Karachi; no unsupported split was drawn.' : '');
  const properties = {id, name, region: 'pk-country', level: 'division', parent: province.properties.id, province: province.properties.name, country: 'Pakistan · full source coverage', sourceLevel: 'derived division', sourceValidOn: '2022-09-09', membershipValidOn: '2023-03-01', center: labelPoint(geometry), bbox: extent(geometry), districtIds: members.map(f => f.properties.id), sourceDistrictCodes: codes, source: 'WFP SDI / OCHA-HDX 2022 district geometry · CC BY-IGO; PBS 2023 frozen membership; exact district dissolve', membershipSource: pbs, qualification};
  return {type: 'Feature', id, properties, geometry};
});
const unmatched = districtCollection.features.filter(f => !assigned.has(f.properties.sourceCode));
if (unmatched.length !== 1 || unmatched[0].properties.sourceCode !== 'PK401') throw Error(`Unassigned districts: ${unmatched.map(f => f.properties.sourceCode)}`);

await write('public/data/pk-country-division.geojson', collection(features));
await write('public/data/pk-country-division-labels.geojson', collection(features.map(f => ({...f, geometry: {type: 'Point', coordinates: f.properties.center}}))));
// Separate integration file intentionally avoids modifying app/catalog.json.
await write('app/pakistan-division-areas.json', features.map(f => f.properties));
const manifest = {
  region: 'pk-country', layer: 'division', label: 'Divisions · source-era district unions', count: features.length,
  membershipValidOn: '2023-03-01', geometryValidOn: '2022-09-09',
  geometrySource: {name: 'World Food Programme SDI / OCHA Common Operational Dataset', url: 'https://data.humdata.org/dataset/cod-ab-pak', license: 'CC BY-IGO', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/igo/'},
  membershipSource: {name: 'Pakistan Bureau of Statistics, frozen administrative districts by division as on 01-03-2023', url: pbs, administrativeUnitsUrl: units},
  sources: [
    {url: pbs, title: 'PBS administrative districts by division, 01-03-2023', kind: 'primary government'},
    {url: units, title: 'PBS number of administrative units, 01-03-2023', kind: 'primary government'},
    {url: agriculture, title: 'Balochistan agricultural statistics 2021-22 administrative table', kind: 'primary government'},
    {url: archaeology, title: 'Department of Archaeology: Surab in Shaheed Sikandarabad', kind: 'primary government'},
    {url: gbReport, title: 'Dawn reporting GB Government four-district notification, 2019-06-18', kind: 'secondary reporting of government notification'},
    {url: gbPamir, title: 'Pamir Times corroborating the four-district notification, 2019-06-18', kind: 'secondary reporting of government notification'},
  ],
  notes: [
    '36 exact source-district unions: Punjab 9, Sindh 6, Balochistan 8, Khyber Pakhtunkhwa 7, Pakistan-administered AJK 3, Gilgit-Baltistan 3. All 159 non-Islamabad WFP source districts are assigned once.',
    'Islamabad Capital Territory has no division in the PBS table; its district and territory remain selectable without inventing a division.',
    'This is a source-era view, not an assertion of current district or division counts. Later changes such as Gujrat division, newer district splits, and current GB legal implementation are not retroactively invented in older polygons.',
    'The GB name Astore / Diamer cross-references PBS 2023 Astore and the 2019 notification reports Diamer. Four extra GB source polygons use those explicitly identified secondary reports, not an official geometry download.',
    'Pakistan-administered AJK and GB are retained as source administrative areas; the layer does not settle disputed sovereignty.',
    'Division membership is joined by an explicitly recorded WFP source-code crosswalk. Geometry is dissolved without simplification, clipping, gap filling, or unsupported district splits.',
  ],
  aliases: sourceNameAliases,
  supplementalAssignments,
  noDivision: [{districtId: 'pk-country-d-pk401', sourceCode: 'PK401', name: 'Islamabad', reason: 'PBS explicitly supplies no division for Islamabad Capital Territory.'}],
  sourceGeometryGaps: [{name: 'Keamari', province: 'Sindh', reason: 'PBS 2023 lists Keamari; WFP 2022 has no separate polygon. Retain its area inside source-era West Karachi without inventing a boundary.'}],
  districtDivision: Object.fromEntries(features.flatMap(f => f.properties.districtIds.map(id => [id, f.properties.id]))),
  divisions: features.map(f => ({id: f.properties.id, name: f.properties.name, province: f.properties.province, provinceId: f.properties.parent, districtIds: f.properties.districtIds, sourceDistrictCodes: f.properties.sourceDistrictCodes, sources: [pbs, ...supplementalAssignments.filter(item => f.properties.sourceDistrictCodes.includes(item.district)).map(item => item.evidence)], qualification: f.properties.qualification})),
  inputs: [{file: 'pk-country-district.geojson', sha256: await hash('public/data/pk-country-district.geojson')}, {file: 'pk-country-province.geojson', sha256: await hash('public/data/pk-country-province.geojson')}],
  outputs: await Promise.all(['pk-country-division.geojson', 'pk-country-division-labels.geojson'].map(async file => ({file, sha256: await hash(`public/data/${file}`)}))),
};
await write('app/pakistan-division-sources.json', manifest);
console.log(`Built ${features.length} exact Pakistan division unions from ${assigned.size} source districts; Islamabad has no fictional division.`);
