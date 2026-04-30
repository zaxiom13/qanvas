/**
 * Backend selection state (separate from the existing sketch app-state).
 * Persisted to localStorage and applied immediately on change.
 */
import {
  loadBackendSettings,
  REMOTE_Q_BACKENDS_ENABLED,
  saveBackendSettings,
  settingsToConfig,
  type PersistedBackendSettings,
  type QanvasBackendKind,
} from '$lib/runtime/backend';
import { subscribeRuntimeInfo, switchBackend } from '$lib/runtime/install';

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error';

class BackendStateHost {
  settings = $state<PersistedBackendSettings>(loadBackendSettings());
  draft = $state<PersistedBackendSettings>({ ...this.settings });
  activeLabel = $state('Browser (jqport)');
  status = $state<ConnectionStatus>('idle');
  statusMessage = $state('');
  remoteBackendsEnabled = REMOTE_Q_BACKENDS_ENABLED;

  constructor() {
    subscribeRuntimeInfo((label) => {
      this.activeLabel = label;
    });
  }

  resetDraft() {
    this.draft = { ...this.settings };
    this.status = 'idle';
    this.statusMessage = '';
  }

  setDraftKind(kind: QanvasBackendKind) {
    if (!this.remoteBackendsEnabled && kind !== 'browser') return;
    this.draft = { ...this.draft, kind };
  }
  setDraftLocal(url: string) {
    this.draft = { ...this.draft, localUrl: url };
  }
  setDraftCloud(url: string) {
    this.draft = { ...this.draft, cloudUrl: url };
  }

  apply() {
    if (!this.remoteBackendsEnabled && this.draft.kind !== 'browser') {
      this.draft = { ...this.draft, kind: 'browser' };
    }
    const next: PersistedBackendSettings = {
      kind: this.draft.kind,
      localUrl: this.draft.localUrl.trim() || 'ws://127.0.0.1:5042',
      cloudUrl: this.draft.cloudUrl.trim(),
    };
    if (next.kind === 'cloud-q' && !next.cloudUrl) {
      this.status = 'error';
      this.statusMessage = 'Cloud q URL is required (e.g. wss://example.com/qanvas).';
      return false;
    }
    this.settings = next;
    saveBackendSettings(next);
    try {
      const info = switchBackend(settingsToConfig(next));
      this.activeLabel = info.label;
      this.status = 'ok';
      this.statusMessage = `Active backend: ${info.label}`;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.status = 'error';
      this.statusMessage = message;
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    this.status = 'testing';
    this.statusMessage = 'Connecting…';
    const url = this.draft.kind === 'cloud-q' ? this.draft.cloudUrl : this.draft.localUrl;
    if (this.draft.kind === 'browser') {
      this.status = 'ok';
      this.statusMessage = 'Browser engine is always available.';
      return true;
    }
    if (!url) {
      this.status = 'error';
      this.statusMessage = 'Provide a WebSocket URL first.';
      return false;
    }
    return await new Promise((resolve) => {
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        this.status = 'error';
        this.statusMessage = err instanceof Error ? err.message : String(err);
        resolve(false);
        return;
      }
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* ignore */ }
        this.status = 'error';
        this.statusMessage = `Timed out connecting to ${url}.`;
        resolve(false);
      }, 5000);
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.status = 'ok';
        this.statusMessage = `Reachable: ${url}`;
        try { ws.close(); } catch { /* ignore */ }
        resolve(true);
      };
      ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.status = 'error';
        this.statusMessage = `Could not reach ${url}. Is q running?`;
        resolve(false);
      };
    });
  }
}

export const backendState = new BackendStateHost();
