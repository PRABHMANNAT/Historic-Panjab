import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const root = new URL('../', import.meta.url);
export const read = async file => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));
export const write = (file, value) => fs.writeFile(new URL(file, root), JSON.stringify(value) + '\n');
export const hash = async file => createHash('sha256').update(await fs.readFile(new URL(file, root))).digest('hex');
export const collection = features => ({type: 'FeatureCollection', features});
export async function cached(file, url) {
  await fs.mkdir(new URL('work/', root), {recursive: true});
  try {return await read(file);} catch (error) {if (error.code !== 'ENOENT') throw error;}
  const response = await fetch(url, {headers: {'User-Agent': 'Historic-Panjab boundary importer (https://github.com/PRABHMANNAT/Historic-Panjab)'}, signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  const value = await response.json();
  await write(file, value);
  return value;
}
export async function record(section, metadata, files) {
  let manifest = {};
  try {manifest = await read('app/delhi-map-sources.json');} catch (error) {if (error.code !== 'ENOENT') throw error;}
  manifest[section] = {...metadata, retrieved: new Date().toISOString().slice(0, 10), outputs: await Promise.all(files.map(async file => ({file, sha256: await hash(`public/data/${file}`)})))};
  await write('app/delhi-map-sources.json', manifest);
}
