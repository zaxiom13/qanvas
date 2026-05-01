import { expect, test } from '@playwright/test';

async function startDesktopUxTourFromAbout(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.localStorage.removeItem('qanvas5:infoModalOpened');
  });
  await page.reload();

  await expect(page.locator('.info-btn-nudge')).toBeVisible();
  await page.getByRole('button', { name: 'About Qanvas5', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Start UX tour' })).toBeVisible();
  await page.getByRole('button', { name: 'Start UX tour' }).click();

  await expect(page.locator('.ux-tour-card')).toContainText(/Guided tour/);
}

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

test('UX tour tooltip stays above a full-panel spotlight (Editor step)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startDesktopUxTourFromAbout(page);

  const next = page.locator('.ux-tour-next');
  for (let i = 0; i < 7; i += 1) {
    await next.click();
  }

  const card = page.locator('.ux-tour-card');
  await expect(card).toContainText('Editor');

  const box = await card.boundingBox();
  expect(box, 'tour card should have layout').toBeTruthy();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;

  const hitTour = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return Boolean(el?.closest('.ux-tour-card'));
  }, { x: cx, y: cy });

  expect(hitTour, 'tour card must paint above #editor-panel spotlight, not behind it').toBe(true);
});
