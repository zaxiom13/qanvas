import { compileSketch } from '$lib/compiler/compile';
import { CanvasSurface } from '$lib/runtime/canvas-surface';
import { createCompiledRuntimeHelpers } from '$lib/runtime/compiled-runtime-helpers';

/** Match sketch `setup` sizes in EXAMPLES (800×600) so draw math is correct; we scale down for JPEG. */
const RENDER_LOGICAL_W = 800;
const RENDER_LOGICAL_H = 600;
const THUMB_JPEG_W = 240;
const THUMB_JPEG_H = Math.round((THUMB_JPEG_W * RENDER_LOGICAL_H) / RENDER_LOGICAL_W);

type SketchModule = {
  setup: (rt: ReturnType<typeof createCompiledRuntimeHelpers>) => unknown;
  draw: (
    state: unknown,
    frameInfo: Record<string, unknown>,
    input: Record<string, unknown>,
    canvas: Record<string, unknown>,
    rt: ReturnType<typeof createCompiledRuntimeHelpers>,
  ) => unknown;
};

/**
 * Renders one compiled-js frame off-screen (same path as the browser worker)
 * and returns a JPEG data URL for mobile example thumbnails.
 *
 * Uses a blob `import()` instead of `new Function` so strict CSP (no unsafe-eval)
 * in production preview builds can still load compiled sketches.
 */
export async function captureExampleStillDataUrl(source: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const compiled = compileSketch(source);
  if (compiled.status !== 'compiled' || !compiled.code) return null;

  // `compiled.code` is an IIFE expression that evaluates to `{ setup, draw }`.
  const blobSource = `export default ${compiled.code};\n`;
  const blobUrl = URL.createObjectURL(new Blob([blobSource], { type: 'text/javascript' }));

  let module: SketchModule;
  try {
    const imported = (await import(/* @vite-ignore */ blobUrl)) as { default: SketchModule };
    module = imported.default;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  if (!module || typeof module.setup !== 'function' || typeof module.draw !== 'function') {
    return null;
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;left:0;top:0;width:${RENDER_LOGICAL_W}px;height:${RENDER_LOGICAL_H}px;overflow:hidden;pointer-events:none;opacity:0;z-index:-1;`;

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = `${RENDER_LOGICAL_W}px`;
  canvas.style.height = `${RENDER_LOGICAL_H}px`;
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);
  // Force layout so CanvasSurface.resize() sees non-zero dimensions (otherwise thumbnails are blank).
  void wrap.offsetWidth;

  try {
    const surface = new CanvasSurface();
    surface.attach(canvas);
    surface.resizeToLogicalSize(RENDER_LOGICAL_W, RENDER_LOGICAL_H);

    const helpers = createCompiledRuntimeHelpers();
    helpers.resetCommands();
    let state: unknown;
    try {
      state = module.setup(helpers);
    } catch {
      return null;
    }

    const startCommands = helpers.takeCommands();

    const center: [number, number] = [RENDER_LOGICAL_W * 0.5, RENDER_LOGICAL_H * 0.5];
    // Match examples-compiled-runtime.test.ts harness (some sketches use timeMs).
    const frameNum = 12;
    const frameInfo = { frameNum, timeMs: frameNum * 16.67 };
    const input = {
      mouse: center,
      mouseButtons: { left: false, right: false },
      scroll: [0, 0] as [number, number],
      key: '',
      keys: [] as string[],
    };
    const canvasPayload = {
      size: [RENDER_LOGICAL_W, RENDER_LOGICAL_H] as [number, number],
      pixelRatio: 1,
    };

    helpers.resetCommands();
    try {
      state = module.draw(state, frameInfo, input, canvasPayload, helpers);
    } catch {
      return null;
    }

    const frameCommands = helpers.takeCommands();
    surface.draw([...startCommands, ...frameCommands], { showFps: false, fps: 0 });

    const out = document.createElement('canvas');
    out.width = THUMB_JPEG_W;
    out.height = THUMB_JPEG_H;
    const octx = out.getContext('2d');
    if (!octx) return canvas.toDataURL('image/jpeg', 0.82);
    octx.drawImage(canvas, 0, 0, THUMB_JPEG_W, THUMB_JPEG_H);
    return out.toDataURL('image/jpeg', 0.82);
  } finally {
    wrap.remove();
  }
}
