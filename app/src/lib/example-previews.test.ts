import { describe, expect, it } from 'vitest';
import { resolveExamplePreviewAssetBase } from './example-previews';

describe('resolveExamplePreviewAssetBase', () => {
  it('uses a root path when the Vite base is default', () => {
    expect(resolveExamplePreviewAssetBase('/')).toBe('/example-previews');
  });

  it('prefixes a subpath deployment base', () => {
    expect(resolveExamplePreviewAssetBase('/app/')).toBe('/app/example-previews');
  });

  it('joins relative portable bases used by this project', () => {
    expect(resolveExamplePreviewAssetBase('./')).toBe('./example-previews');
  });

  it('treats missing base like root', () => {
    expect(resolveExamplePreviewAssetBase(undefined)).toBe('/example-previews');
  });
});
