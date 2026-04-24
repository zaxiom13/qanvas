import { expect, test } from '@playwright/test';

test('exposes installable PWA metadata', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest$/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#EDE6DA');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');

  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toEqual(
    expect.objectContaining({
      name: 'qanvas5',
      display: 'standalone',
      start_url: '/',
    }),
  );
});

test('serves the service worker for the Netlify static build', async ({ page }) => {
  await page.goto('/');

  const response = await page.request.get('/sw.js');
  expect(response.ok()).toBe(true);
  await expect(response.text()).resolves.toContain('qanvas5-pwa');
});
