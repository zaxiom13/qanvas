import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  browserEngineModeLabel,
  isBrowserEngineMode,
  loadBrowserEngineMode,
  saveBrowserEngineMode,
} from './browser-engine-mode';

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('browser-engine-mode', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to auto', () => {
    expect(loadBrowserEngineMode()).toBe('auto');
  });

  it('persists valid modes', () => {
    saveBrowserEngineMode('rust-wasm');
    expect(loadBrowserEngineMode()).toBe('rust-wasm');
    saveBrowserEngineMode('compiled-js');
    expect(loadBrowserEngineMode()).toBe('compiled-js');
  });

  it('rejects unknown stored values', () => {
    window.localStorage.setItem('qanvas5:browserEngineMode', 'not-a-mode');
    expect(loadBrowserEngineMode()).toBe('auto');
  });

  it('labels modes for UI', () => {
    expect(browserEngineModeLabel('interpreter')).toBe('JS interpreter');
    expect(isBrowserEngineMode('rust-wasm')).toBe(true);
  });
});
