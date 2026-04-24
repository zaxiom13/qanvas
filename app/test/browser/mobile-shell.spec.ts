import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('shows the mobile workspace with bottom navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Mobile workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Examples' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Files' })).toBeVisible();
  await expect(page.getByLabel('q sketch editor')).toBeVisible();
});

test('keeps the bottom navigation out of the active screen content', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Mobile workspace' });
  const main = page.locator('.mobile-main');

  await expect(nav).toBeVisible();
  await expect(nav).not.toHaveCSS('position', 'fixed');

  const boxes = await Promise.all([main.boundingBox(), nav.boundingBox()]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();
  expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height - 1);
});

test('uses the real sketch canvas on the mobile canvas tab', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Canvas' }).click();

  await expect(page.getByLabel('Sketch canvas')).toBeVisible();
  await expect(page.locator('.mobile-artboard')).toHaveCount(0);
});

test('runs the sketch from the mobile canvas playbar', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Canvas' }).click();
  await page.locator('.mobile-playbar').getByRole('button', { name: 'Run sketch' }).click();

  await expect(page.getByRole('button', { name: 'Canvas' })).toHaveClass(/active/);
  await expect(page.getByLabel('Sketch canvas')).toBeVisible();
  await expect(page.locator('.sketch-overlay--running')).toHaveCount(1);
});

test('edits the active sketch from the mobile editor', async ({ page }) => {
  await page.goto('/');

  const editor = page.getByLabel('q sketch editor');
  await editor.fill('setup:{`size`bg!(320 320;Color.CREAM)}\n');

  await page.getByRole('button', { name: 'Canvas' }).click();
  await page.getByRole('button', { name: 'Editor' }).click();

  await expect(editor).toHaveValue(/320 320/);
});

test('loads an example from the mobile examples tab', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Examples' }).click();
  await page.getByRole('button', { name: /hello circle/i }).click();

  await expect(page.getByLabel('q sketch editor')).toHaveValue(/circle/);
});

test('does not show Quick Tools on the mobile canvas tab', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Canvas' }).click();
  await expect(page.getByRole('heading', { name: 'Quick Tools' })).toHaveCount(0);
});

test('filters the mobile editor console by Data, Errors, and Info', async ({ page }) => {
  await page.goto('/');

  const consoleFilters = page.getByRole('tablist', { name: 'Console filter' });

  await consoleFilters.getByRole('button', { name: 'Info' }).click();
  await expect(page.getByText(/Qanvas5 ready/)).toBeVisible();

  await consoleFilters.getByRole('button', { name: 'Data' }).click();
  await expect(page.getByText('No lines for this filter.')).toBeVisible();

  await consoleFilters.getByRole('button', { name: 'Errors' }).click();
  await expect(page.getByText('No lines for this filter.')).toBeVisible();
});

test('collapses the mobile editor console output', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.mobile-console-output')).toBeVisible();
  await page.getByLabel('Console output').getByRole('button', { name: 'Collapse console' }).click();
  await expect(page.locator('.mobile-console-output')).toHaveCount(0);
  await page.getByLabel('Console output').getByRole('button', { name: 'Expand console' }).click();
  await expect(page.locator('.mobile-console-output')).toBeVisible();
});

test('opens a sketch file from the Files tab', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Files' }).click();
  await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible();
  await page.getByRole('button', { name: /^sketch\.q/ }).click();
  await expect(page.getByRole('button', { name: 'Editor' })).toHaveClass(/active/);
  await expect(page.getByLabel('q sketch editor')).toBeVisible();
});
