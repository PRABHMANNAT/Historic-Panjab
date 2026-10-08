import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {openLayerGroup, configureExport, triggerExport} from './workspace-ui.mjs';

const browser = await chromium.launch({channel: process.env.MAP_BROWSER_CHANNEL || 'chrome', headless: true, args: ['--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, acceptDownloads: true});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));
await fs.mkdir('outputs/workspace', {recursive: true});
try {
  await page.goto(process.env.MAP_TEST_URL || 'http://localhost:4545/', {waitUntil: 'networkidle', timeout: 60000});
  await page.waitForFunction(() => document.querySelector('.gl-host')?.getAttribute('aria-busy') === 'false', null, {timeout: 120000});
  const original = await saved();
  const mapBefore = await page.locator('.regional-map-area').boundingBox();
  assert.ok(mapBefore.height > 720, 'Map uses most of the desktop height');
  assert.ok(mapBefore.width >= 1000, 'Map retains a broad desktop workspace');
  assert.equal(await page.locator('.export-panel').count(), 0, 'No permanent export footer');
  await page.screenshot({path: 'outputs/workspace/desktop.png'});

  for (const title of ['Countries & territories', 'Delhi & NCR', 'Regions & boundaries', 'Kashmir boundary view', 'Border visibility']) {
    await openLayerGroup(page, title);
  }
  await page.getByLabel('Search region layers').fill('Haryana');
  assert.equal(await page.locator('.region-card').count(), 1);
  await page.getByRole('tab', {name: 'Style', exact: true}).click();
  assert.ok(await page.getByLabel('Selected color', {exact: true}).isVisible());
  await page.getByRole('tab', {name: 'Areas', exact: true}).click();
  assert.ok(await page.getByLabel('Find an area').isVisible());
  await page.getByRole('tab', {name: 'Places', exact: true}).click();
  for (const name of ['Show major cities', 'Show gurdwaras', 'Show administrative area names']) {
    assert.ok(await page.getByRole('checkbox', {name, exact: true}).isVisible());
  }
  await page.getByRole('tab', {name: 'Nature', exact: true}).click();
  for (const name of ['Show rivers','Show mountains','Show plateaus','Show forests']) assert.ok(await page.getByRole('checkbox', {name, exact:true}).isVisible());
  await page.getByRole('tab', {name: 'Layers', exact: true}).click();
  assert.ok(await page.getByLabel('Search region layers').isVisible(), 'Open layer groups survive tab changes');
  await page.getByLabel('Search region layers').fill('');
  assert.deepEqual(await saved(), original, 'Navigating and filtering controls does not modify the map');

  await page.locator('.canvas-bar').getByRole('button', {name: 'Hide controls', exact: true}).click();
  const expanded = await page.locator('.regional-map-area').boundingBox();
  assert.ok(expanded.width - mapBefore.width >= 280, 'Hiding the inspector expands the map');
  assert.ok(!(await page.getByRole('complementary', {name: 'Map inspector'}).isVisible()));
  await page.screenshot({path: 'outputs/workspace/map-focus.png'});
  await page.getByRole('tab', {name: 'Style', exact: true}).click();
  assert.ok(await page.getByLabel('Selected color', {exact: true}).isVisible(), 'Rail reopens inspector');

  await configureExport(page, {format: 'svg', width: 1600});
  const download = page.waitForEvent('download', {timeout: 120000});
  await triggerExport(page);
  const file = 'outputs/workspace/map.svg';
  await (await download).saveAs(file);
  assert.ok((await fs.readFile(file, 'utf8')).includes('<svg'), 'Export dialog produces a map file');
  assert.deepEqual(await saved(), original, 'Workspace and export preferences leave the map document intact');

  for (const [width, height] of [[390, 844], [700, 800], [768, 1024]]) {
    await page.setViewportSize({width, height});
    await page.getByRole('tab', {name: 'Layers', exact: true}).click();
    assert.ok(await page.getByLabel('Geographic map scope').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow at ' + width);
    if (width <= 700) {
      await page.getByRole('button', {name: 'Hide controls', exact: true}).click();
      assert.ok(!(await page.getByRole('complementary', {name: 'Map inspector'}).isVisible()));
      assert.ok((await page.locator('.regional-map-area').boundingBox()).height > height * .6);
      await page.getByRole('tab', {name: 'Places', exact: true}).click();
      assert.ok(await page.getByRole('checkbox', {name: 'Show gurdwaras', exact: true}).isVisible());
    }
    await page.screenshot({path: `outputs/workspace/viewport-${width}.png`});
  }
  assert.deepEqual(errors, []);
  console.log('Verified map space, control discovery, inspector collapse, SVG download, responsive navigation, and unchanged map settings.');
} finally {
  await browser.close();
}
