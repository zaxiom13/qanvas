import { expect, test } from '@playwright/test';

test('examples modal shows the grid after opening', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Browse examples' }).click();
  await expect(page.getByRole('heading', { name: 'Examples' })).toBeVisible();
  await expect(page.locator('#examples-grid .example-card').first()).toBeVisible();
});

test('collapses and expands the desktop console', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#console-output')).toBeVisible();

  await page.getByRole('button', { name: 'Collapse console' }).click();
  await expect(page.locator('#console-output')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Expand console' })).toHaveAttribute('aria-expanded', 'false');

  await page.getByRole('button', { name: 'Expand console' }).click();
  await expect(page.locator('#console-output')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse console' })).toHaveAttribute('aria-expanded', 'true');
});

test('resizes the desktop console down to the default height floor', async ({ page }) => {
  await page.goto('/');

  const panel = page.locator('#console-panel');
  const handle = page.getByRole('button', { name: 'Resize console' });
  await expect(handle).toBeVisible();

  const initialHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y - 80);
  await page.mouse.up();

  const tallerHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
  expect(tallerHeight).toBeGreaterThan(initialHeight + 40);

  const tallerHandleBox = await handle.boundingBox();
  expect(tallerHandleBox).not.toBeNull();

  await page.mouse.move(tallerHandleBox!.x + tallerHandleBox!.width / 2, tallerHandleBox!.y + tallerHandleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(tallerHandleBox!.x + tallerHandleBox!.width / 2, tallerHandleBox!.y + 80);
  await page.mouse.up();

  const afterDownwardDragHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
  expect(afterDownwardDragHeight).toBeLessThan(tallerHeight - 40);
  expect(afterDownwardDragHeight).toBeGreaterThanOrEqual(initialHeight - 1);

  const finalHandleBox = await handle.boundingBox();
  expect(finalHandleBox).not.toBeNull();

  await page.mouse.move(finalHandleBox!.x + finalHandleBox!.width / 2, finalHandleBox!.y + finalHandleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(finalHandleBox!.x + finalHandleBox!.width / 2, finalHandleBox!.y + 200);
  await page.mouse.up();

  const floorHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);
  expect(floorHeight).toBeGreaterThanOrEqual(initialHeight - 1);
});
