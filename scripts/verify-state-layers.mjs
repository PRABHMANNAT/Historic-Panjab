import {configureExport,triggerExport,openLayerGroup} from './workspace-ui.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.MAP_PLAYWRIGHT_PATH || 'playwright');
const manifest = JSON.parse(await fs.readFile(new URL('../app/indian-region-sources.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(await fs.readFile(new URL('../app/catalog.json', import.meta.url), 'utf8'));
const requested = process.env.MAP_STATE_IDS?.split(',').filter(Boolean) || manifest.regions.map(r => r.id);
assert.ok(requested.every(id => manifest.regions.some(r => r.id === id)), 'Known state IDs required');
const seed = {fills: {}, regions: Object.fromEntries([...manifest.regions.map(r => r.id), 'in-punjab', 'pk-punjab', 'pk-kp', 'islamabad', 'chandigarh'].map(id => [id, {show: false, district: false, tehsil: false, uc: false, division: false}]))};
const browser = await chromium.launch({channel: process.env.MAP_BROWSER_CHANNEL || 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
await fs.mkdir('outputs/state-layers', {recursive: true});
let verified = 0;
try {
  // Isolate each state so previous large boundary layers cannot accumulate in memory.
  for (const id of requested) {
    const context = await browser.newContext({viewport: {width: 1600, height: 1100}, acceptDownloads: true});
    await context.addInitScript(seed => {
      if (!localStorage.getItem('punjab-studio-regional-v2')) localStorage.setItem('punjab-studio-regional-v2', JSON.stringify(seed));
    }, seed);
    const page = await context.newPage(), errors = [], failures = [], loaded = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('response', response => {
      if (response.status() >= 400) failures.push(response.status() + ' ' + response.url());
      if (response.ok() && response.url().includes('/data/')) loaded.add(new URL(response.url()).pathname);
    });
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));
    const idle = () => page.waitForFunction(() => document.querySelector('.gl-host')?.getAttribute('aria-busy') === 'false', null, {timeout: 120000});
    const painted = (areaId, exists) => page.waitForFunction(([areaId, exists]) => !!JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).fills[areaId] === exists, [areaId, exists]);
    try {
      await page.goto(process.env.MAP_TEST_URL || 'http://localhost:4545/', {waitUntil: 'networkidle', timeout: 60000});
      await page.waitForFunction(() => !document.querySelector('.map-loading') && !document.querySelector('button.primary')?.disabled, {timeout: 60000});
      const response = page.waitForResponse(r => r.url().endsWith('/data/' + id + '-tehsil.geojson') && r.ok(), {timeout: 60000});
      await page.getByLabel('Jump to a region').selectOption(id);
      await response;
      await page.waitForLoadState('networkidle');
      await idle();
      for (const level of ['region', 'district', 'tehsil']) for (const suffix of ['', '-labels']) assert.ok(loaded.has('/data/' + id + '-' + level + suffix + '.geojson'), id + ' resource');
      const state = await saved();
      assert.ok(state.regions[id].show && state.regions[id].district && state.regions[id].tehsil, id + ' enabled');
      await page.getByRole('tab', {name: 'Areas', exact: true}).click();
      await page.getByLabel('Filter areas by region').selectOption(id);
      await page.locator('.area-levels').getByRole('button', {name: 'Districts', exact: true}).click();
      assert.equal(await page.locator('.area-row').count(), manifest.layers[id + '-district'].count, id + ' districts');
      await page.locator('.area-levels').getByRole('button', {name: 'Tehsils', exact: true}).click();
      assert.equal(await page.locator('.area-row').count(), manifest.layers[id + '-tehsil'].count, id + ' subdistricts');
      const area = catalog.find(a => a.region === id && a.level === 'tehsil');
      await page.locator('.area-name').first().click();
      await painted(area.id, true);
      await page.getByRole('button', {name: 'Undo', exact: true}).click();
      await painted(area.id, false);
      await page.getByRole('button', {name: 'Redo', exact: true}).click();
      await painted(area.id, true);
      const hide = page.getByRole('button', {name: 'Show/hide ' + area.name, exact: true});
      await hide.click();
      assert.ok((await saved()).hidden.includes(area.id));
      await hide.click();
      assert.ok(!(await saved()).hidden.includes(area.id));
      await idle();
      if (id === 'in-goa') {
        const screenshot = await page.locator('.maplibregl-canvas').screenshot();
        const bluePixels = await page.evaluate(async encoded => {
          const image = new Image();
          image.src = 'data:image/png;base64,' + encoded;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 39 && pixels[i + 1] === 100 && pixels[i + 2] === 216) count++;
          return count;
        }, screenshot.toString('base64'));
        assert.ok(bluePixels > 2000, 'Restored Sanguem geometry visibly renders its saved color, beyond toolbar/legend pixels');
      }
      await page.screenshot({path: 'outputs/state-layers/' + id + '.png'});
      // Small and large-state SVG exports exercise both ends of the added atlas.
      if (['in-goa', 'in-odisha', 'in-sikkim', 'in-tamil-nadu', 'in-puducherry'].includes(id)) {
        await configureExport(page,{format:'SVG'});
        const download = page.waitForEvent('download', {timeout: 120000});
        await triggerExport(page);
        const file = 'outputs/state-layers/' + id + '.svg';
        await (await download).saveAs(file);
        const svg = await fs.readFile(file, 'utf8');
        assert.ok(svg.includes('data-area="' + area.id + '"'), id + ' exported subdistrict');
        assert.ok(svg.includes('#2764d8'), id + ' exported color');
        assert.ok(/<path[^>]*fill="#2764d8"/.test(svg), id + ' exported geometry is colored, not only the legend');
      }
      const expectedFills = (await saved()).fills;
      await page.reload({waitUntil: 'networkidle'});
      await page.waitForFunction(() => !document.querySelector('button.primary')?.disabled, {timeout: 60000});
      await idle();
      assert.deepEqual((await saved()).fills, expectedFills, id + ' colors survive reload');
      assert.ok((await saved()).regions[id].tehsil, id + ' detail survives reload');
      await page.getByRole('tab', {name: 'Layers', exact: true}).click();
      await openLayerGroup(page,'Regions & boundaries');
      const card = page.locator('.region-card').filter({has: page.locator('label[for="reg-' + id + '"]')});
      const detail = card.locator('.region-buttons button').nth(1);
      await detail.click();
      assert.equal((await saved()).regions[id].tehsil, false);
      await detail.click();
      assert.equal((await saved()).regions[id].tehsil, true);
      if (['in-arunachal', 'in-maharashtra'].includes(id)) assert.ok((await card.locator('.coverage-warning').innerText()).length > 20);
      if (id === 'in-odisha' || id === 'in-puducherry') {
        await page.getByRole('button', {name: 'Guide & sources', exact: true}).click();
        const guide = page.getByRole('dialog');
        for (const region of manifest.regions) assert.ok((await guide.innerText()).includes(region.name), region.name + ' guide coverage');
        await page.keyboard.press('Escape');
        await page.setViewportSize({width: 390, height: 844});
        await page.screenshot({path: 'outputs/state-layers/mobile.png', fullPage: true});
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No mobile overflow');
      }
      assert.deepEqual(errors, [], id + ' browser exceptions');
      assert.deepEqual(failures, [], id + ' HTTP errors');
      verified++;
      console.log('Verified ' + id + ': districts, subdistricts, six resources, paint, hide, undo/redo, reload and layer toggles.');
    } catch (error) {
      await page.screenshot({path: 'outputs/state-layers/' + id + '-failure.png'}).catch(() => {});
      console.log(JSON.stringify({id, errors, failures, body: (await page.locator('body').innerText()).slice(0, 2500)}));
      throw error;
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify({result: 'passed', requestedStates: verified, boundaryResources: verified * 6, isolatedContexts: true, svgExports: requested.filter(id => ['in-goa', 'in-odisha', 'in-sikkim', 'in-tamil-nadu', 'in-puducherry'].includes(id))}));
} finally {
  await browser.close();
}

