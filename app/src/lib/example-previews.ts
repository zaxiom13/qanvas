/**
 * Example grid thumbnails live under `public/example-previews/`. The app uses
 * `vite.config.ts` `base: './'` so builds work from subfolders and in Capacitor
 * (`capacitor://localhost/...`). Absolute `/example-previews/...` URLs break in
 * those cases (they resolve from the host root, not the app). Join with Vite's
 * `import.meta.env.BASE_URL` so previews load on mobile Safari and bundled WebViews.
 */
export function resolveExamplePreviewAssetBase(baseUrl: string | undefined): string {
  const base = baseUrl ?? '/';
  if (base === '/') return '/example-previews';
  const normalized = base.replace(/\/+$/, '');
  return `${normalized}/example-previews`;
}

const PREVIEW_ASSET_BASE = resolveExamplePreviewAssetBase(import.meta.env.BASE_URL);

export const examplePreviewSrc = {
  'hello-circle': `${PREVIEW_ASSET_BASE}/hello-circle.png`,
  'color-grid': `${PREVIEW_ASSET_BASE}/color-grid.png`,
  'sunset-horizon': `${PREVIEW_ASSET_BASE}/sunset-horizon.png`,
  'line-weave': `${PREVIEW_ASSET_BASE}/line-weave.png`,
  'text-poster': `${PREVIEW_ASSET_BASE}/text-poster.png`,
  'image-stamp': `${PREVIEW_ASSET_BASE}/image-stamp.png`,
  'breathing-ring': `${PREVIEW_ASSET_BASE}/breathing-ring.png`,
  'spiral-galaxy': `${PREVIEW_ASSET_BASE}/spiral-galaxy.png`,
  'lissajous-dots': `${PREVIEW_ASSET_BASE}/lissajous-dots.png`,
  'orbit-dance': `${PREVIEW_ASSET_BASE}/orbit-dance.png`,
  'particle-fountain': `${PREVIEW_ASSET_BASE}/particle-fountain.png`,
  'click-painter': `${PREVIEW_ASSET_BASE}/click-painter.png`,
  'drag-trail': `${PREVIEW_ASSET_BASE}/drag-trail.png`,
  'ripple-pool': `${PREVIEW_ASSET_BASE}/ripple-pool.png`,
  'pulse-grid': `${PREVIEW_ASSET_BASE}/pulse-grid.png`,
  'mandelbrot-static': `${PREVIEW_ASSET_BASE}/mandelbrot-static.png`,
} as const;

export function getExamplePreviewSrc(exampleId: string) {
  return examplePreviewSrc[exampleId as keyof typeof examplePreviewSrc] ?? null;
}

export function getAllExamplePreviewSrcs() {
  return Object.values(examplePreviewSrc);
}
