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
  await expect(page.getByRole('button', { name: 'Files' })).toHaveCount(0);
  await expect(page.getByLabel('q sketch editor')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Open files' })).toBeVisible();
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

  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel('Sketch canvas')).toBeVisible();
  await expect(page.locator('.sketch-overlay--running')).toHaveCount(1);
});

test('edits the active sketch from the mobile editor', async ({ page }) => {
  await page.goto('/');

  const editor = page.getByLabel('q sketch editor');
  await editor.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('setup:{`size`bg!(320 320;Color.CREAM)}\n');

  await page.getByRole('button', { name: 'Canvas' }).click();
  await page.getByRole('button', { name: 'Editor', exact: true }).click();

  await expect(editor).toContainText(/320 320/);
});

test('highlights q syntax in the mobile editor', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.mobile-code-editor .q-token-keyword').filter({ hasText: 'enlist' }).first()).toBeVisible();
  await expect(page.locator('.mobile-code-editor .q-token-number').filter({ hasText: '800' }).first()).toBeVisible();
  await expect(page.locator('.mobile-code-editor .q-token-symbol').filter({ hasText: '`size' }).first()).toBeVisible();
});

test('loads an example from the mobile examples tab', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Examples' }).click();
  await page.getByRole('button', { name: /hello circle/i }).click();

  await expect(page.getByLabel('q sketch editor')).toContainText(/circle/);
});

test('exposes working controls in the mobile settings tab', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Practice' }).click();
  await expect(page.getByLabel('Practice output')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check answer' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(page.getByLabel('q sketch editor')).toContainText(/answer:\(\[\] city:`symbol\$\(\); totalRevenue:`long\$\(\)\);/);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Backend' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Project actions' })).toHaveCount(0);
  await page.getByRole('button', { name: /FPS overlay/i }).click();
  await expect(page.locator('.mobile-toggle').filter({ hasText: 'On' }).first()).toBeVisible();
});

test('renders a canvas still on mobile example thumbnails', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Examples' }).click();
  const helloCard = page.getByRole('button', { name: /hello circle/i });
  await expect(helloCard.locator('.example-thumb img')).toBeVisible({ timeout: 20_000 });
  await expect(helloCard.locator('.example-thumb img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
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

  await expect(page.locator('.sheet-handle')).toHaveCount(0);
  await expect(page.locator('.mobile-console-output')).toBeVisible();
  await page.getByLabel('Console output').getByRole('button', { name: 'Collapse console' }).click();
  await expect(page.locator('.mobile-console-output')).toHaveCount(0);
  await page.getByLabel('Console output').getByRole('button', { name: 'Expand console' }).click();
  await expect(page.locator('.mobile-console-output')).toBeVisible();
});

test('opens and creates files from mobile editor tabs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('tab', { name: /sketch\.q/ })).toBeVisible();
  await page.getByRole('button', { name: 'New .cue file' }).click();
  await page.locator('#new-file-input').fill('helpers');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('tab', { name: /helpers\.cue/ })).toBeVisible();
  await expect(page.getByLabel('q sketch editor')).toContainText('/ helpers.cue');
});
