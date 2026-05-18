import { expect, test } from '@playwright/test';

test('first autostart may differ from second startRuntime', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('qanvas5:browserEngineMode', 'auto');
    localStorage.setItem('qanvas5:infoModalOpened', '1');
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.browserAPI));

  const firstLine = await page
    .locator('#console-output')
    .innerText()
    .then((text) => text.split('\n').find((l) => l.includes('Sketch engine:')) ?? '');

  const defaultSketch = await page.evaluate(() => {
    const el = document.querySelector('.cm-content');
    return el?.textContent ?? '';
  });

  const second = await page.evaluate(
    async (content) => {
      await window.browserAPI.stopRuntime().catch(() => undefined);
      return window.browserAPI.startRuntime({
        runtimePath: 'browser://q-engine',
        files: [{ name: 'sketch.q', content }],
        backendMode: 'auto',
        compiled: null,
      });
    },
    defaultSketch || 'setup:{\`size\`bg!(800 600;0)}\ndraw:{[s;f;i;c] s}'
  );

  // eslint-disable-next-line no-console
  console.log('autostart:', firstLine);
  // eslint-disable-next-line no-console
  console.log('second start:', second);
  expect(second.backend).toBe('rust-wasm');
});
