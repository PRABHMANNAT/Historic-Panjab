import {configureExport,triggerExport,openLayerGroup} from './workspace-ui.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const read = async path => JSON.parse(await fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
const sources = await read('app/delhi-map-sources.json'), indian = await read('app/indian-region-sources.json');
const seed = {fills: {}, regions: Object.fromEntries([...indian.regions.map(r => r.id), 'in-punjab', 'chandigarh', 'pk-punjab', 'pk-kp', 'islamabad'].map(id => [id, {show: id === 'in-delhi', district: id === 'in-delhi', tehsil: false, uc: false, division: false}]))};
const browser = await chromium.launch({channel: process.env.MAP_BROWSER_CHANNEL || 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1600, height: 1100}, acceptDownloads: true});
await context.addInitScript(seed => {if (!localStorage.getItem('punjab-studio-regional-v2')) localStorage.setItem('punjab-studio-regional-v2', JSON.stringify(seed));}, seed);
const page = await context.newPage(), errors = [], failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
page.on('response', response => {if (response.status() >= 400) failures.push(response.status() + ' ' + response.url());});
await fs.mkdir('outputs/delhi', {recursive: true});
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));
const idle = async () => {await page.waitForLoadState('networkidle');await page.waitForFunction(() => document.querySelector('.gl-host')?.getAttribute('aria-busy') === 'false', null, {timeout: 60000});};
const setting = async (key, value) => page.waitForFunction(([key, value]) => JSON.parse(localStorage.getItem('punjab-studio-regional-v2'))[key] === value, [key, value]);
const areaView = page.getByLabel('Delhi area view'), detail = page.getByLabel('Delhi detail level');
const exportFile = async (format, name) => {await configureExport(page,{format:format.toUpperCase()});const event = page.waitForEvent('download', {timeout: 120000});await triggerExport(page);const file = 'outputs/delhi/' + name + '.' + format;await (await event).saveAs(file);return file;};
try {
  await page.goto(process.env.MAP_TEST_URL || 'http://localhost:4545/', {waitUntil: 'networkidle', timeout: 60000});
  await page.waitForFunction(() => !document.querySelector('button.primary')?.disabled, null, {timeout: 60000});await idle();
  await openLayerGroup(page,'Delhi & NCR');await areaView.selectOption('nct');await openLayerGroup(page,'Delhi & NCR');await detail.selectOption('subdivisions');await idle();
  assert.ok((await saved()).regions['in-delhi'].tehsil);
  await page.getByRole('tab', {name: 'Areas', exact: true}).click();await page.getByLabel('Filter areas by region').selectOption('in-delhi');await page.locator('.area-levels').getByRole('button', {name: 'Tehsils', exact: true}).click();assert.equal(await page.locator('.area-row').count(), 34);
  await page.locator('.area-name').first().click();const paints = (await saved()).fills;assert.equal(Object.keys(paints).length, 1);
  await page.getByRole('tab', {name: 'Layers', exact: true}).click();await openLayerGroup(page,'Delhi & NCR');await detail.selectOption('wards');await idle();
  await page.getByRole('tab', {name: 'Areas', exact: true}).click();await page.locator('.area-levels').getByRole('button', {name: 'UCs / wards', exact: true}).click();assert.equal(await page.locator('.area-row').count(), 289);
  await page.getByRole('tab', {name: 'Layers', exact: true}).click();
  for (const [mode, count] of [['ndmc', 9], ['cantt', 8]]) {await openLayerGroup(page,'Delhi & NCR');await areaView.selectOption(mode);await idle();await page.getByRole('tab', {name: 'Areas', exact: true}).click();assert.equal(await page.locator('.area-row').count(), count);await page.getByRole('tab', {name: 'Layers', exact: true}).click();}
  for (const mode of ['old-delhi', 'new-delhi', 'north', 'east', 'south', 'west', 'noida', 'gurugram', 'nct']) {await openLayerGroup(page,'Delhi & NCR');await areaView.selectOption(mode);await setting('delhiView', mode);await idle();}
  await openLayerGroup(page,'Delhi & NCR');await detail.selectOption('subdivisions');await page.getByRole('checkbox', {name: 'Show metro lines', exact: true}).check();await setting('delhiMetro', true);await page.getByRole('button', {name: 'Fit metro', exact: true}).click();await idle();
  assert.equal(await page.locator('.metro-line-control').count(), 11);assert.equal(await page.locator('.metro-map-key div').count(), 11);
  const red = sources.metro.lines.find(l => l.name === 'Red Line'), blue = sources.metro.lines.find(l => l.name === 'Blue Line');
  await page.getByLabel('Red Line color', {exact: true}).evaluate(input => {Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '#ff2200');input.dispatchEvent(new Event('input', {bubbles: true}));input.dispatchEvent(new Event('change', {bubbles: true}));});
  await page.waitForFunction(id => JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).metroLines[id].color === '#ff2200', red.id);
  await page.getByRole('button', {name: 'Undo', exact: true}).click();assert.equal((await saved()).metroLines[red.id].color, red.color);
  await page.getByRole('button', {name: 'Redo', exact: true}).click();assert.equal((await saved()).metroLines[red.id].color, '#ff2200');
  await page.getByLabel('Show Blue Line', {exact: true}).uncheck();assert.equal((await saved()).metroLines[blue.id].show, false);assert.equal(await page.locator('.metro-map-key div').count(), 10);await idle();
  // Canvas-only pixels exclude the UI color picker and line legend.
  await page.locator('.maplibregl-canvas').screenshot();
  const pixels = await page.locator('.maplibregl-canvas').screenshot({path: 'outputs/delhi/metro-canvas.png'});
  const colored = await page.evaluate(async encoded => {const image = new Image();image.src = 'data:image/png;base64,' + encoded;await image.decode();const c = document.createElement('canvas');c.width = image.width;c.height = image.height;const ctx = c.getContext('2d');ctx.drawImage(image, 0, 0);const p = ctx.getImageData(0, 0, c.width, c.height).data;let n = 0;for (let i = 0; i < p.length; i += 4) if (p[i] === 255 && p[i + 1] === 34 && p[i + 2] === 0) n++;return n;}, pixels.toString('base64'));
  assert.ok(colored > 200, 'Custom Red Line color is actually rendered on the canvas');
  const svg = await fs.readFile(await exportFile('svg', 'metro'), 'utf8');assert.ok(svg.includes('data-metro-line="' + red.id + '"'));assert.ok(!svg.includes('data-metro-line="' + blue.id + '"'));assert.ok(svg.includes('stroke="#ff2200"'));assert.ok(svg.includes('data-metro-station='));assert.ok(svg.includes('OpenStreetMap contributors'));assert.ok(svg.includes('ODbL-1.0'));
  await page.getByRole('checkbox', {name: 'Show metro stations', exact: true}).uncheck();const noStations = await fs.readFile(await exportFile('svg', 'no-stations'), 'utf8');assert.ok(!noStations.includes('data-metro-station='));
  await exportFile('png', 'metro');
  const saveEvent = page.waitForEvent('download');await page.getByRole('button', {name: 'Save', exact: true}).click();const file = 'outputs/delhi/settings.json';await (await saveEvent).saveAs(file);const expected = await saved();
  await page.getByRole('checkbox', {name: 'Show metro lines', exact: true}).uncheck();await page.locator('input[type=file]').setInputFiles(file);await setting('delhiMetro', true);assert.deepEqual((await saved()).metroLines, expected.metroLines);
  await page.reload({waitUntil: 'networkidle'});await idle();assert.equal((await saved()).delhiMetro, true);assert.deepEqual((await saved()).metroLines, expected.metroLines);assert.equal((await saved()).metroStations, false);
  await openLayerGroup(page,'Delhi & NCR');await areaView.selectOption('ncr');await idle();assert.equal((await saved()).delhiView, 'ncr');assert.deepEqual((await saved()).fills, paints);
  const ncrSvg = await fs.readFile(await exportFile('svg', 'ncr'), 'utf8');assert.ok(ncrSvg.includes('data-area="delhi-ncr"'));assert.ok(ncrSvg.includes('NCR · source reconstruction'));assert.ok(!ncrSvg.includes('data-area="in-haryana-d-58"'));
  await page.reload({waitUntil: 'networkidle'});await idle();assert.equal((await saved()).delhiView, 'ncr');assert.ok(Number((await page.locator('.zoom-controls span').innerText()).replace('z ', '')) > 6, 'Saved NCR view restores its camera focus');
  await page.locator('.quick-view-menu > summary').click();await page.getByRole('button', {name: 'All regions', exact: true}).click();await setting('delhiView', 'none');assert.deepEqual((await saved()).fills, paints);await idle();
  await openLayerGroup(page,'Delhi & NCR');await areaView.selectOption('old-delhi');await idle();await page.screenshot({path: 'outputs/delhi/desktop.png'});
  await page.setViewportSize({width: 390, height: 844});await page.screenshot({path: 'outputs/delhi/mobile.png', fullPage: true});assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No mobile horizontal overflow');
  await page.getByRole('button', {name: 'Guide & sources', exact: true}).click();const guide = await page.getByRole('dialog').innerText();assert.ok(guide.includes('December 2025'));assert.ok(guide.includes('289') || guide.includes('272 MCD'));assert.ok(guide.includes('ODbL-1.0'));
  assert.ok(!(await page.locator('.statusbar output').innerText()).includes('Map resource:'), 'No renderer resource error');
  assert.deepEqual(errors, []);assert.deepEqual(failures, []);
  console.log(JSON.stringify({result: 'passed', metroLines: 11, stations: 293, customLinePixels: colored, cityPresets: true, ncr: true, wards: 289, svgPng: true, manualSaveLoad: true, reload: true, undoRedo: true, mobile: true}));
} catch (error) {await page.screenshot({path: 'outputs/delhi/failure.png', fullPage: true}).catch(() => {});console.log(JSON.stringify({errors, failures, body: (await page.locator('body').innerText()).slice(0, 2200)}));throw error;}
finally {await browser.close();}
