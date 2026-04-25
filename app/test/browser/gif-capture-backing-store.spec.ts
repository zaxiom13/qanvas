import { expect, test } from '@playwright/test';

/**
 * GIF snapshots must use canvas backing-store dimensions with `getImageData`.
 * Using CSS logical sizes with DPR > 1 reads only part of the bitmap (regression).
 */
test('getImageData must use backing-store size when canvas is DPR-scaled', async ({ page }) => {
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100px';
    canvas.style.height = '80px';
    const ratio = 2;
    canvas.width = Math.round(100 * ratio);
    canvas.height = Math.round(80 * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'no ctx' };

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = 'rgb(200, 40, 40)';
    ctx.fillRect(0, 0, 100, 80);

    const logicalW = 100;
    const logicalH = 80;
    const wrong = ctx.getImageData(0, 0, logicalW, logicalH);
    const right = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const sumR = (data: Uint8ClampedArray) => {
      let s = 0;
      for (let i = 0; i < data.length; i += 4) s += data[i]!;
      return s;
    };

    const wrongPixels = wrong.width * wrong.height;
    const rightPixels = right.width * right.height;

    return {
      ok: wrongPixels !== rightPixels && sumR(right.data) > sumR(wrong.data) * 1.5,
      canvasW: canvas.width,
      canvasH: canvas.height,
      wrongPixels,
      rightPixels,
      sumWrong: sumR(wrong.data),
      sumRight: sumR(right.data),
    };
  });

  expect(result.ok, JSON.stringify(result)).toBe(true);
});
