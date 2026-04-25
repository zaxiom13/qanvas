import { expect, test } from '@playwright/test';

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
