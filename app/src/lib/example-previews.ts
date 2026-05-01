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
  'hello-circle': `${PREVIEW_ASSET_BASE}/hello-circle.svg`,
  'color-grid': `${PREVIEW_ASSET_BASE}/color-grid.svg`,
  'sunset-horizon': `${PREVIEW_ASSET_BASE}/sunset-horizon.svg`,
  'line-weave': `${PREVIEW_ASSET_BASE}/line-weave.svg`,
  'text-poster': `${PREVIEW_ASSET_BASE}/text-poster.svg`,
  'image-stamp': `${PREVIEW_ASSET_BASE}/image-stamp.svg`,
  'breathing-ring': `${PREVIEW_ASSET_BASE}/breathing-ring.svg`,
  'spiral-galaxy': `${PREVIEW_ASSET_BASE}/spiral-galaxy.svg`,
  'lissajous-dots': `${PREVIEW_ASSET_BASE}/lissajous-dots.svg`,
  'orbit-dance': `${PREVIEW_ASSET_BASE}/orbit-dance.svg`,
  'particle-fountain': `${PREVIEW_ASSET_BASE}/particle-fountain.svg`,
  'click-painter': `${PREVIEW_ASSET_BASE}/click-painter.svg`,
  'drag-trail': `${PREVIEW_ASSET_BASE}/drag-trail.svg`,
  'ripple-pool': `${PREVIEW_ASSET_BASE}/ripple-pool.svg`,
  'pulse-grid': `${PREVIEW_ASSET_BASE}/pulse-grid.svg`,
  'mandelbrot-static': `${PREVIEW_ASSET_BASE}/mandelbrot-static.svg`,
} as const;

export function getExamplePreviewSrc(exampleId: string) {
  return examplePreviewSrc[exampleId as keyof typeof examplePreviewSrc] ?? null;
}

export function getAllExamplePreviewSrcs() {
  return Object.values(examplePreviewSrc);
}
