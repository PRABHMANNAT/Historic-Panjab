// Shared navigation for the workspace UI. Geographic assertions stay in each test.
export async function openLayerGroup(page, title) {
  await page.getByRole('tab', {name: 'Layers', exact: true}).click();
  const group = page.locator('.control-group').filter({has: page.locator('summary strong', {hasText: title})});
  if (await group.getAttribute('open') === null) {
    await group.locator('summary').click();
  }
}

async function openExport(page) {
  const dialog = page.getByRole('dialog').filter({has: page.getByText('Ready to share your map?', {exact: true})});
  if (!(await dialog.isVisible())) await page.getByRole('button', {name: 'Export map', exact: true}).click();
  return dialog;
}

export async function configureExport(page, {format, extent, width} = {}) {
  const dialog = await openExport(page);
  if (format) await dialog.getByRole('button', {name: format.toUpperCase(), exact: true}).click();
  if (extent) await dialog.getByRole('button', {name: extent, exact: true}).click();
  if (width) await dialog.getByLabel('Export width in pixels', {exact: true}).fill(String(width));
  await dialog.getByRole('button', {name: 'Close', exact: true}).click();
}

export async function triggerExport(page) {
  const dialog = await openExport(page);
  await dialog.getByRole('button', {name: /^Download (PNG|SVG|JPG)$/}).click();
  await dialog.getByRole('button', {name: /^Download (PNG|SVG|JPG)$/}).waitFor({timeout: 120000});
  await dialog.getByRole('button', {name: 'Close', exact: true}).click();
}
