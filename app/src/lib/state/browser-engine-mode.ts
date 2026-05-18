export type BrowserEngineMode = RuntimeBackendMode;

export type BrowserEngineOption = {
  id: BrowserEngineMode;
  title: string;
  subtitle: string;
};

export const BROWSER_ENGINE_OPTIONS: BrowserEngineOption[] = [
  {
    id: 'auto',
    title: 'Auto',
    subtitle: 'Rust WASM, then JS compiler, then interpreter',
  },
  {
    id: 'rust-wasm',
    title: 'Rust WASM',
    subtitle: 'Rust sketch shell with jqport host',
  },
  {
    id: 'compiled-js',
    title: 'JS compiler',
    subtitle: 'Compile sketch to JavaScript when supported',
  },
  {
    id: 'interpreter',
    title: 'JS interpreter',
    subtitle: 'jqport in the Web Worker',
  },
];

const STORAGE_KEY = 'qanvas5:browserEngineMode';
const VALID: BrowserEngineMode[] = ['auto', 'rust-wasm', 'compiled-js', 'interpreter'];

export function isBrowserEngineMode(value: string): value is BrowserEngineMode {
  return (VALID as string[]).includes(value);
}

export function loadBrowserEngineMode(): BrowserEngineMode {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw && isBrowserEngineMode(raw)) return raw;
  } catch {
    // ignore
  }
  return 'auto';
}

export function saveBrowserEngineMode(mode: BrowserEngineMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function browserEngineModeLabel(mode: BrowserEngineMode): string {
  return BROWSER_ENGINE_OPTIONS.find((entry) => entry.id === mode)?.title ?? mode;
}

export function runtimeBackendLabel(backend: RuntimeBackend): string {
  switch (backend) {
    case 'rust-wasm':
      return 'Rust WASM';
    case 'compiled-js':
      return 'JS compiler';
    case 'interpreter':
      return 'JS interpreter';
    default:
      return backend;
  }
}
