/**
 * Browser adapter: wraps the existing jqport Web Worker (q-runtime-worker.ts).
 * Zero-install, fully offline. Great for demos and teaching.
 */
import type { QanvasRuntime, RuntimeBackendInfo } from '../backend';

type Request =
  | { id: number; type: 'start'; payload: RuntimeStartPayload }
  | { id: number; type: 'start-commands' }
  | { id: number; type: 'frame'; payload: RuntimeFramePayload }
  | { id: number; type: 'query'; payload: RuntimeQueryPayload }
  | { id: number; type: 'stop' };

type Response =
  | { id: number; ok: true; type: string; value: unknown }
  | { id: number; ok: false; error: string }
  | { type: 'stdout'; value: string }
  | { type: 'stderr'; value: string }
  | { type: 'exit'; code: number };

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  type: string;
};

export function createBrowserAdapter(): QanvasRuntime {
  const worker = new Worker(
    new URL('../../browser/q-runtime-worker.ts', import.meta.url),
    { type: 'module' }
  );

  const pending = new Map<number, Pending>();
  let nextId = 1;

  const listeners = {
    stdout: new Set<(v: string) => void>(),
    stderr: new Set<(v: string) => void>(),
    exit: new Set<(n: number) => void>(),
    info: new Set<(info: RuntimeBackendInfo) => void>(),
  };

  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    const m = event.data as Response;
    if ('type' in m && m.type === 'stdout') {
      listeners.stdout.forEach((cb) => cb(String(m.value)));
      return;
    }
    if ('type' in m && m.type === 'stderr') {
      listeners.stderr.forEach((cb) => cb(String(m.value)));
      return;
    }
    if ('type' in m && m.type === 'exit' && 'code' in m) {
      listeners.exit.forEach((cb) => cb(m.code as number));
      return;
    }
    if (!('id' in m)) return;

    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);

    if ('ok' in m && m.ok) {
      p.resolve(m.value);
    } else if ('ok' in m && !m.ok) {
      p.reject(new Error(m.error));
    }
  });

  worker.addEventListener('error', (e) => {
    const err = new Error(e.message || 'Browser q runtime crashed');
    for (const [, p] of pending) p.reject(err);
    pending.clear();
    listeners.stderr.forEach((cb) => cb(err.message));
  });

  function send<T>(type: Request['type'], payload?: unknown): Promise<T> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, type });
      const req = type === 'stop' || type === 'start-commands'
        ? { id, type }
        : { id, type, payload };
      worker.postMessage(req);
    });
  }

  const info: RuntimeBackendInfo = {
    kind: 'browser',
    label: 'Browser (jqport)',
    engine: 'jqport',
    version: 'in-browser',
  };

  return {
    info: () => info,
    start: (payload) => send('start', payload),
    startCommands: () => send('start-commands'),
    frame: (payload) => send('frame', payload),
    query: (payload) => send('query', payload),
    stop: async () => { await send('stop'); },
    onStdout: (cb) => { listeners.stdout.add(cb); return () => listeners.stdout.delete(cb); },
    onStderr: (cb) => { listeners.stderr.add(cb); return () => listeners.stderr.delete(cb); },
    onExit: (cb) => { listeners.exit.add(cb); return () => listeners.exit.delete(cb); },
    onInfoChange: (cb) => { listeners.info.add(cb); return () => listeners.info.delete(cb); },
    dispose: () => {
      worker.terminate();
      pending.clear();
    },
  };
}
