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

test('runs the sketch from the mobile canvas controls sheet', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Canvas' }).click();
  await expect(page.locator('.mobile-playbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run sketch' }).click();

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
  await expect(page.locator('.example-thumb').first()).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await page.getByRole('button', { name: /hello circle/i }).click();

  await expect(page.getByLabel('q sketch editor')).toHaveValue(/circle/);
});

test('exposes working controls in the mobile settings tab', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Practice' }).click();
  await expect(page.getByLabel('q sketch editor')).toHaveValue(/Fill in the expression/);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /FPS overlay/i }).click();
  await expect(page.locator('.mobile-toggle').filter({ hasText: 'On' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Local q ws:// listener' }).click();
  await page.getByLabel('Local q WebSocket').fill('ws://127.0.0.1:5042');
  await page.getByRole('button', { name: 'Apply backend' }).click();
  await expect(page.getByText(/Active backend:/)).toBeVisible();
});
