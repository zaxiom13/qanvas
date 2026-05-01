import { expect, test } from '@playwright/test';

test('shows try-me nudge until the info modal opens, then starts the UX tour', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    window.localStorage.removeItem('qanvas5:infoModalOpened');
  });
  await page.reload();

  await expect(page.locator('.info-btn-nudge')).toBeVisible();
  await page.getByRole('button', { name: 'About Qanvas5', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Start UX tour' })).toBeVisible();
  await page.getByRole('button', { name: 'Start UX tour' }).click();

  await expect(page.locator('.ux-tour-card')).toContainText(/Guided tour/);
});
