/// <reference lib="webworker" />

import { createSession, type HostFileSystem } from '@qpad/engine';
import { normalizeQScript } from './q-script-normalize';
import { rewriteQanvasCompat, toQLiteral } from './sketch-q-literals';

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

function evaluateStatements(statements: string[]): EvalPayload {
  if (!session) {
    throw new Error('q-rust host session is not initialized');
  }
  if (!statements.length) {
    throw new Error('No q statements to evaluate.');
  }

  let last = session.evaluate(statements[0]!);
  for (const statement of statements.slice(1)) {
    last = session.evaluate(statement);
  }

  return {
    value: convertValue(last.value),
    formatted: last.formatted,
  };
}

function statementsForSource(source: string): string[] {
  const trimmed = source.trim();
  if (!trimmed) return [];

  // Lifecycle/query expressions must stay a single evaluate() call.
  if (/^\.qv\.(frame|result)\b/.test(trimmed)) {
    return [trimmed];
  }

  const hasSketchDefinitions = /(?:^|\n)\s*(?:setup|draw|[A-Za-z][\w.]*)\s*:/m.test(trimmed);
  if (!hasSketchDefinitions && /^\.[A-Za-z]/.test(trimmed)) {
    return [trimmed];
  }

  return normalizeQScript(rewriteQanvasCompat(trimmed));
}

export function installQrustHost(fs?: HostFileSystem) {
  fileSystem = fs ?? null;
  session = createSession(fileSystem ? { fs: fileSystem } : {});

  const host = {
    evaluate(source: string): string {
      return JSON.stringify(evaluateStatements(statementsForSource(source)));
    },
    toQLiteralJson(json: string): string {
      return toQLiteral(JSON.parse(json) as unknown);
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
