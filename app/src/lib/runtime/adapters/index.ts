import type { QanvasBackendConfig, QanvasRuntime } from '../backend';
import { createBrowserAdapter } from './browser';
import { createWebSocketAdapter } from './websocket';

export function createRuntime(config: QanvasBackendConfig): QanvasRuntime {
  if (config.kind === 'browser') {
    return createBrowserAdapter();
  }
  if (config.kind === 'local-q') {
    return createWebSocketAdapter({
      url: config.url || 'ws://127.0.0.1:5042',
      kind: 'local-q',
      label: 'Local q',
    });
  }
  if (config.kind === 'cloud-q') {
    if (!config.url) {
      throw new Error('cloud-q backend requires a url');
    }
    return createWebSocketAdapter({
      url: config.url,
      kind: 'cloud-q',
      label: 'Cloud q',
    });
  }
  throw new Error(`Unknown backend kind: ${(config as { kind: string }).kind}`);
}

export { createBrowserAdapter, createWebSocketAdapter };
