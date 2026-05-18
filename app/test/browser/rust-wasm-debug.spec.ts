import { expect, test } from '@playwright/test';
import { EXAMPLES } from '../../src/lib/examples';

test('startRuntime reports rust or fallback reason', async ({ page }) => {
  const hello = EXAMPLES.find((e) => e.id === 'hello-circle')!;
  await page.addInitScript(() => {
    localStorage.setItem('qanvas5:browserEngineMode', 'rust-wasm');
    localStorage.setItem('qanvas5:infoModalOpened', '1');
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.browserAPI));

  const result = await page.evaluate(
    async ({ code, name }) => {
      await window.browserAPI.stopRuntime().catch(() => undefined);
      return window.browserAPI.startRuntime({
        runtimePath: 'browser://q-engine',
        files: [{ name, content: code }],
        backendMode: 'rust-wasm',
        compiled: null,
      });
    },
    { code: hello.code, name: 'sketch.q' }
  );

  // eslint-disable-next-line no-console
  console.log('rust-wasm result:', result);
  expect(result.backend).toBe('rust-wasm');

  const autoResult = await page.evaluate(
    async ({ code, name }) => {
      await window.browserAPI.stopRuntime().catch(() => undefined);
      return window.browserAPI.startRuntime({
        runtimePath: 'browser://q-engine',
        files: [{ name, content: code }],
        backendMode: 'auto',
        compiled: { status: 'compiled', backend: 'compiled-js', code: '(()=>({setup(){return{}},draw(){return {}}}))()', diagnostics: [], unsupported: [] },
      });
    },
    { code: hello.code, name: 'sketch.q' }
  );

  // eslint-disable-next-line no-console
  console.log('auto result:', autoResult);
  expect(autoResult.backend).toBe('rust-wasm');
});
