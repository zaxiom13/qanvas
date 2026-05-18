import { expect, test } from '@playwright/test';

test('autostart may use JS compiler while a later run can use Rust WASM', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('qanvas5:browserEngineMode', 'auto');
    localStorage.setItem('qanvas5:infoModalOpened', '1');
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.browserAPI));

  const autostartLine =
    (await page.locator('#console-output').innerText())
      .split('\n')
      .find((line) => line.includes('Sketch engine:')) ?? '';

  const second = await page.evaluate(async () => {
    await window.browserAPI.stopRuntime().catch(() => undefined);
    return window.browserAPI.startRuntime({
      runtimePath: 'browser://q-engine',
      files: [{ name: 'sketch.q', content: 'setup:{\`size\`bg!(800 600;0)}\ndraw:{[s;f;i;c] s}' }],
      backendMode: 'auto',
      compiled: null,
    });
  });

  // eslint-disable-next-line no-console
  console.log('autostart:', autostartLine, 'second:', second);
  expect(second.backend).toBe('rust-wasm');
});
