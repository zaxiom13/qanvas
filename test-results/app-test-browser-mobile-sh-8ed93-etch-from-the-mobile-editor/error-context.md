# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app/test/browser/mobile-shell.spec.ts >> edits the active sketch from the mobile editor
- Location: app/test/browser/mobile-shell.spec.ts:43:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test.use({
  4  |   viewport: { width: 390, height: 844 },
  5  |   isMobile: true,
  6  |   hasTouch: true,
  7  | });
  8  | 
  9  | test('shows the mobile workspace with bottom navigation', async ({ page }) => {
  10 |   await page.goto('/');
  11 | 
  12 |   await expect(page.getByRole('navigation', { name: 'Mobile workspace' })).toBeVisible();
  13 |   await expect(page.getByRole('button', { name: 'Editor' })).toBeVisible();
  14 |   await expect(page.getByRole('button', { name: 'Canvas' })).toBeVisible();
  15 |   await expect(page.getByRole('button', { name: 'Examples' })).toBeVisible();
  16 |   await expect(page.getByLabel('q sketch editor')).toBeVisible();
  17 | });
  18 | 
  19 | test('keeps the bottom navigation out of the active screen content', async ({ page }) => {
  20 |   await page.goto('/');
  21 | 
  22 |   const nav = page.getByRole('navigation', { name: 'Mobile workspace' });
  23 |   const main = page.locator('.mobile-main');
  24 | 
  25 |   await expect(nav).toBeVisible();
  26 |   await expect(nav).not.toHaveCSS('position', 'fixed');
  27 | 
  28 |   const boxes = await Promise.all([main.boundingBox(), nav.boundingBox()]);
  29 |   expect(boxes[0]).not.toBeNull();
  30 |   expect(boxes[1]).not.toBeNull();
  31 |   expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height - 1);
  32 | });
  33 | 
  34 | test('uses the real sketch canvas on the mobile canvas tab', async ({ page }) => {
  35 |   await page.goto('/');
  36 | 
  37 |   await page.getByRole('button', { name: 'Canvas' }).click();
  38 | 
  39 |   await expect(page.getByLabel('Sketch canvas')).toBeVisible();
  40 |   await expect(page.locator('.mobile-artboard')).toHaveCount(0);
  41 | });
  42 | 
  43 | test('edits the active sketch from the mobile editor', async ({ page }) => {
> 44 |   await page.goto('/');
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  45 | 
  46 |   const editor = page.getByLabel('q sketch editor');
  47 |   await editor.fill('setup:{`size`bg!(320 320;Color.CREAM)}\n');
  48 | 
  49 |   await page.getByRole('button', { name: 'Canvas' }).click();
  50 |   await page.getByRole('button', { name: 'Editor' }).click();
  51 | 
  52 |   await expect(editor).toHaveValue(/320 320/);
  53 | });
  54 | 
  55 | test('loads an example from the mobile examples tab', async ({ page }) => {
  56 |   await page.goto('/');
  57 | 
  58 |   await page.getByRole('button', { name: 'Examples' }).click();
  59 |   await page.getByRole('button', { name: /hello circle/i }).click();
  60 | 
  61 |   await expect(page.getByLabel('q sketch editor')).toHaveValue(/circle/);
  62 | });
  63 | 
```