/**
 * Qanvas runtime backend abstraction.
 *
 * Browser-first runtime backend abstraction. The default runtime runs entirely
 * client-side in a Web Worker.
 */

export type QanvasBackendKind = 'browser' | 'local-q' | 'cloud-q';

export type QanvasBackendConfig =
  | { kind: 'browser' }
  | { kind: 'local-q'; url?: string }   // default ws://127.0.0.1:5042
  | { kind: 'cloud-q'; url: string };

export type RuntimeBackendInfo = {
  kind: QanvasBackendKind;
  label: string;
  engine: 'jqport' | 'kdb+';
  url?: string;
  version?: string;
};

/**
 * The runtime API. Every backend exposes the same surface — it's a superset of the
 * existing BrowserRendererAPI (see app/src/global.d.ts) so the frontend needs no changes.
 */
export type QanvasRuntime = {
  info(): RuntimeBackendInfo;
  start(payload: RuntimeStartPayload): Promise<RuntimeStartResult>;
  startCommands(): Promise<RuntimeStartCommandsResult>;
  frame(payload: RuntimeFramePayload): Promise<Record<string, unknown>[]>;
  query(payload: RuntimeQueryPayload): Promise<RuntimeQueryResult>;
  stop(): Promise<void>;
  onStdout(cb: (s: string) => void): () => void;
  onStderr(cb: (s: string) => void): () => void;
  onExit(cb: (code: number) => void): () => void;
  onInfoChange(cb: (info: RuntimeBackendInfo) => void): () => void;
  dispose(): void;
};

export type PersistedBackendSettings = {
  kind: QanvasBackendKind;
  localUrl: string;
  cloudUrl: string;
};

const DEFAULTS: PersistedBackendSettings = {
  kind: 'browser',
  localUrl: 'ws://127.0.0.1:5042',
  cloudUrl: '',
};

const STORAGE_KEY = 'qanvas:backend:settings';
export const REMOTE_Q_BACKENDS_ENABLED = import.meta.env.VITE_QANVAS_ENABLE_REMOTE_Q === 'true';

export function loadBackendSettings(): PersistedBackendSettings {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PersistedBackendSettings>;
    const persistedKind = parsed.kind === 'local-q' || parsed.kind === 'cloud-q' ? parsed.kind : 'browser';
    return {
      kind: REMOTE_Q_BACKENDS_ENABLED ? persistedKind : 'browser',
      localUrl: typeof parsed.localUrl === 'string' && parsed.localUrl ? parsed.localUrl : DEFAULTS.localUrl,
      cloudUrl: typeof parsed.cloudUrl === 'string' ? parsed.cloudUrl : DEFAULTS.cloudUrl,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBackendSettings(next: PersistedBackendSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode errors */
  }
}

export function settingsToConfig(s: PersistedBackendSettings): QanvasBackendConfig {
  if (!REMOTE_Q_BACKENDS_ENABLED) return { kind: 'browser' };
  if (s.kind === 'local-q') return { kind: 'local-q', url: s.localUrl };
  if (s.kind === 'cloud-q') return { kind: 'cloud-q', url: s.cloudUrl };
  return { kind: 'browser' };
}
