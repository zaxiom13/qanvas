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
