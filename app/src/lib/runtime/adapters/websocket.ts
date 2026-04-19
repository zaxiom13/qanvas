/**
 * WebSocket adapter for a real q process (local or cloud).
 *
 * Wire protocol (JSON text frames):
 *   C -> S  {id, op: "start" | "start-commands" | "frame" | "query" | "stop", payload?}
 *   S -> C  {id, ok: true,  value} | {id, ok: false, error} | {evt: "stdout" | "stderr" | "exit", value}
 *
 * The q side (server/qanvas-boot.q) exposes exactly this over .z.ws.
 * The Node bridge in server/q-bridge.js exposes the same over a bridged q process.
 */
import type { QanvasRuntime, RuntimeBackendInfo } from '../backend';

type ServerMessage =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string }
  | { evt: 'stdout' | 'stderr'; value: string }
  | { evt: 'exit'; code: number }
  | { evt: 'hello'; info: Partial<RuntimeBackendInfo> };

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

export type WebSocketAdapterOptions = {
  url: string;
  kind: 'local-q' | 'cloud-q';
  label: string;
  reconnect?: boolean;
  timeoutMs?: number;
};

export function createWebSocketAdapter(opts: WebSocketAdapterOptions): QanvasRuntime {
  const listeners = {
    stdout: new Set<(v: string) => void>(),
    stderr: new Set<(v: string) => void>(),
    exit: new Set<(n: number) => void>(),
    info: new Set<(info: RuntimeBackendInfo) => void>(),
  };

  const pending = new Map<number, Pending>();
  let nextId = 1;
  let socket: WebSocket | null = null;
  let connectPromise: Promise<void> | null = null;
  let disposed = false;

  let info: RuntimeBackendInfo = {
    kind: opts.kind,
    label: opts.label,
    engine: 'kdb+',
    url: opts.url,
  };

  function setInfo(patch: Partial<RuntimeBackendInfo>) {
    info = { ...info, ...patch };
    listeners.info.forEach((cb) => cb(info));
  }

  function connect(): Promise<void> {
    if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve();
    if (connectPromise) return connectPromise;

    connectPromise = new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(opts.url);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      ws.onopen = () => {
        socket = ws;
        connectPromise = null;
        resolve();
      };
      ws.onerror = () => {
        const err = new Error(`Failed to connect to ${opts.url}`);
        listeners.stderr.forEach((cb) => cb(err.message));
        if (socket !== ws) reject(err);
      };
      ws.onclose = (event) => {
        const wasOpen = socket === ws;
        socket = null;
        connectPromise = null;
        if (wasOpen) {
          for (const [, p] of pending) p.reject(new Error('q runtime connection closed'));
          pending.clear();
          listeners.exit.forEach((cb) => cb(event.code ?? 0));
        } else {
          reject(new Error(`Failed to open ${opts.url}`));
        }
      };
      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data));
        } catch (err) {
          listeners.stderr.forEach((cb) => cb(`Could not parse runtime message: ${String(err)}`));
          return;
        }
        if ('evt' in msg) {
          if (msg.evt === 'stdout') listeners.stdout.forEach((cb) => cb(msg.value));
          else if (msg.evt === 'stderr') listeners.stderr.forEach((cb) => cb(msg.value));
          else if (msg.evt === 'exit') listeners.exit.forEach((cb) => cb(msg.code));
          else if (msg.evt === 'hello') setInfo(msg.info);
          return;
        }
        if (!('id' in msg)) return;
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.value);
        else p.reject(new Error(msg.error));
      };
    });

    return connectPromise;
  }

  async function send<T>(op: string, payload?: unknown): Promise<T> {
    if (disposed) throw new Error('Runtime adapter disposed');
    await connect();
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot send '${op}': socket is not open`);
    }
    const id = nextId++;
    const timeout = opts.timeoutMs ?? 30_000;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`q runtime '${op}' timed out after ${timeout}ms`));
      }, timeout);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v as T); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      socket!.send(JSON.stringify({ id, op, payload }));
    });
  }

  return {
    info: () => info,
    start: (payload) => send('start', payload),
    startCommands: () => send('start-commands'),
    frame: (payload) => send('frame', payload),
    query: (payload) => send('query', payload),
    stop: async () => { try { await send('stop'); } catch { /* ignore */ } },
    onStdout: (cb) => { listeners.stdout.add(cb); return () => listeners.stdout.delete(cb); },
    onStderr: (cb) => { listeners.stderr.add(cb); return () => listeners.stderr.delete(cb); },
    onExit: (cb) => { listeners.exit.add(cb); return () => listeners.exit.delete(cb); },
    onInfoChange: (cb) => { listeners.info.add(cb); return () => listeners.info.delete(cb); },
    dispose: () => {
      disposed = true;
      try { socket?.close(); } catch { /* ignore */ }
      for (const [, p] of pending) p.reject(new Error('disposed'));
      pending.clear();
    },
  };
}
