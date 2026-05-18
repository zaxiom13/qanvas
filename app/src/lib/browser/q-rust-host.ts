/// <reference lib="webworker" />

import { createSession, type HostFileSystem } from '@qpad/engine';

type EvalPayload = {
  value: unknown;
  formatted: string;
};

let session: ReturnType<typeof createSession> | null = null;
let fileSystem: HostFileSystem | null = null;

function convertValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(convertValue);
  if (typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  switch (record.kind) {
    case 'null':
      return null;
    case 'boolean':
      return Boolean(record.value);
    case 'number':
      if (record.special === 'null' || record.special === 'intNull') return null;
      return record.value;
    case 'symbol':
    case 'string':
    case 'temporal':
      return record.value;
    case 'list':
      return ((record.items as unknown[]) ?? []).map(convertValue);
    case 'dictionary': {
      const keys = (record.keys as unknown[]) ?? [];
      const values = (record.values as unknown[]) ?? [];
      const out: Record<string, unknown> = {};
      for (let index = 0; index < keys.length; index += 1) {
        const key = convertValue(keys[index]);
        out[String(key)] = convertValue(values[index]);
      }
      return out;
    }
    case 'table': {
      const columns = (record.columns as Record<string, unknown>) ?? {};
      const out: Record<string, unknown> = {};
      for (const name of Object.keys(columns)) {
        out[name] = convertValue(columns[name]);
      }
      return out;
    }
    default:
      return value;
  }
}

export function installQrustHost(fs?: HostFileSystem) {
  fileSystem = fs ?? null;
  session = createSession(fileSystem ? { fs: fileSystem } : {});

  const host = {
    evaluate(source: string): string {
      if (!session) {
        throw new Error('q-rust host session is not initialized');
      }
      const result = session.evaluate(source);
      const payload: EvalPayload = {
        value: convertValue(result.value),
        formatted: result.formatted,
      };
      return JSON.stringify(payload);
    },
    reset() {
      session = createSession(fileSystem ? { fs: fileSystem } : {});
    },
  };

  (globalThis as typeof globalThis & { __q_rust_host__?: typeof host }).__q_rust_host__ = host;
}

export function uninstallQrustHost() {
  delete (globalThis as typeof globalThis & { __q_rust_host__?: unknown }).__q_rust_host__;
  session = null;
  fileSystem = null;
}
