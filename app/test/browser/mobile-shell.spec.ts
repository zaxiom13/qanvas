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

test('sketch canvas disables native touch gestures so drag sketches receive moves', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Canvas' }).click();

  const touchAction = await page.getByLabel('Sketch canvas').evaluate((el) => getComputedStyle(el).touchAction);
  expect(touchAction).toBe('none');
});

test('runs the sketch from the mobile canvas controls sheet', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Canvas' }).click();
  await expect(page.locator('.mobile-playbar')).toHaveCount(0);

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

test('does not cancel default touch handling on editor tap (soft keyboard)', async ({ page }) => {
  await page.goto('/');

  const defaultPrevented = await page.locator('.mobile-code-editor .cm-content').evaluate((content) => {
    const box = content.getBoundingClientRect();
    const x = box.left + Math.min(80, box.width / 2);
    const y = box.top + box.height / 2;
    const touch = new Touch({
      identifier: 42,
      target: content,
      clientX: x,
      clientY: y,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 0.5,
    });
    const event = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch],
    });
    content.dispatchEvent(event);
    return event.defaultPrevented;
  });

  expect(defaultPrevented).toBe(false);
});

test('selects code with a touch drag instead of panning the mobile editor', async ({ page }) => {
  await page.goto('/');

  const line = page.locator('.mobile-code-editor .cm-line').first();
  await expect(line).toBeVisible();
  const box = await line.boundingBox();
  expect(box).not.toBeNull();

  const start = { x: box!.x + 24, y: box!.y + box!.height / 2 };
  const end = { x: box!.x + 160, y: box!.y + box!.height / 2 };
  await line.evaluate((node, points) => {
    const fire = (type: 'touchstart' | 'touchmove' | 'touchend', point: { x: number; y: number }) => {
      const touch = new Touch({
        identifier: 1,
        target: node,
        clientX: point.x,
        clientY: point.y,
      });
      node.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === 'touchend' ? [] : [touch],
          targetTouches: type === 'touchend' ? [] : [touch],
          changedTouches: [touch],
        })
      );
    };

    fire('touchstart', points.start);
    fire('touchmove', points.end);
    fire('touchend', points.end);
  }, { start, end });

  await expect(page.locator('.mobile-code-editor')).not.toHaveAttribute('data-selection-length', '0');
});

test('scrolls the mobile editor with two-finger pan on the code surface', async ({ page }) => {
  await page.goto('/');

  const editor = page.getByLabel('q sketch editor');
  await editor.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.type(`${'\n'.repeat(120)}// tail marker\n`);

  const scroller = page.locator('.mobile-code-editor .cm-scroller');
  await expect(scroller).toBeVisible();

  const scrollBefore = await scroller.evaluate((el) => el.scrollTop);

  const scrollDelta = await page.evaluate(() => {
    const content = document.querySelector('.mobile-code-editor .cm-content');
    if (!content) return null;
    const box = content.getBoundingClientRect();
    const midX = box.left + box.width / 2;
    const y0 = box.top + Math.min(120, box.height / 3);
    const y1 = y0 + 140;
    const delta = 22;

    const mk = (id: number, x: number, y: number) =>
      new Touch({
        identifier: id,
        target: content,
        clientX: x,
        clientY: y,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: 0.5,
      });
    const fire = (type: 'touchstart' | 'touchmove' | 'touchend', touches: Touch[]) => {
      content.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches,
          targetTouches: touches,
          changedTouches: touches,
        })
      );
    };

    const t0a = mk(201, midX - delta, y0);
    const t1a = mk(202, midX + delta, y0);
    fire('touchstart', [t0a, t1a]);

    const t0b = mk(201, midX - delta, y1);
    const t1b = mk(202, midX + delta, y1);
    fire('touchmove', [t0b, t1b]);

    fire('touchend', []);

    const scrollerEl = document.querySelector('.mobile-code-editor .cm-scroller');
    if (!scrollerEl) return null;
    return scrollerEl.scrollTop;
  });

  expect(scrollDelta).not.toBeNull();
  expect(scrollDelta!).toBeLessThan(scrollBefore - 40);
});

test('highlights q syntax in the mobile editor', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.mobile-code-editor .q-token-keyword').filter({ hasText: 'enlist' }).first()).toBeVisible();
  await expect(page.locator('.mobile-code-editor .q-token-number').filter({ hasText: '800' }).first()).toBeVisible();
  await expect(page.locator('.mobile-code-editor .q-token-symbol').filter({ hasText: '`size' }).first()).toBeVisible();
  await expect(page.locator('.mobile-code-editor .q-token-qanvas').filter({ hasText: 'background' }).first()).toBeVisible();
  await expect(page.locator('.mobile-code-editor .q-token-qanvas').filter({ hasText: 'circle' }).first()).toBeVisible();
});

test('highlights q syntax in guided-tour lesson snippets on mobile canvas', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Examples' }).click();
  await page.getByRole('button', { name: /hello circle/i }).click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.getByRole('button', { name: 'Canvas' }).click();
  await page.getByRole('button', { name: 'Guide' }).click();

  const snippet = page.locator('.tour-lesson-highlight-code');
  await expect(snippet).toBeVisible({ timeout: 15_000 });
  await expect(snippet.locator('.q-token-keyword').filter({ hasText: 'enlist' }).first()).toBeVisible();
  await expect(snippet.locator('.q-token-number').filter({ hasText: '20' }).first()).toBeVisible();
  await expect(snippet.locator('.q-token-qanvas').filter({ hasText: 'circle' }).first()).toBeVisible();
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
  const nav = page.getByRole('navigation', { name: 'Mobile workspace' });
  await expect(nav.getByRole('button', { name: 'Output' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Lessons' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editor', exact: true })).toHaveClass(/active/);
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
  await expect(helloCard.locator('.example-thumb img')).toHaveAttribute('src', /example-previews\/hello-circle\.svg$/);
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
  await expect(page.locator('.console-line--info').first()).toBeVisible();

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
  await expect(page.getByRole('button', { name: /^(Run|Stop) sketch$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step through setup and frames' })).toBeVisible();
  await page.getByRole('button', { name: 'New .q file' }).click();
  await page.locator('#new-file-input').fill('helpers');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('tab', { name: /helpers\.q/ })).toBeVisible();
  await expect(page.getByLabel('q sketch editor')).toContainText('/ helpers.q');
  await expect(page.getByRole('button', { name: /^(Run|Stop) sketch$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Step through setup and frames' })).toHaveCount(0);
});
