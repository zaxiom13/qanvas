/// <reference lib="webworker" />

import { createSession, type HostFileSystem } from '@qpad/engine';
import { createCompiledRuntimeHelpers, isPlainObject, type CompiledRuntimeHelpers } from '../runtime/compiled-runtime-helpers';

const FS_STORAGE_PREFIX = 'qanvas5:browser:fs:';

const normalizeFsPath = (path: string) => path.replace(/^:+/, '').replace(/^\/+/, '');

function createWorkerFileSystem(seedFiles: SketchFile[]): HostFileSystem {
  const mem = new Map<string, string>();
  const bins = new Map<string, Uint8Array>();

  for (const file of seedFiles) {
    mem.set(normalizeFsPath(file.name), file.content ?? '');
  }

  const fsKey = (path: string) => `${FS_STORAGE_PREFIX}${normalizeFsPath(path)}`;
  const readPersisted = (path: string): string | null => {
    try {
      return self.localStorage?.getItem(fsKey(path)) ?? null;
    } catch {
      return null;
    }
  };
  const writePersisted = (path: string, contents: string) => {
    try {
      self.localStorage?.setItem(fsKey(path), contents);
    } catch {
      // best-effort only
    }
  };
  const deletePersisted = (path: string) => {
    try {
      self.localStorage?.removeItem(fsKey(path));
    } catch {
      // noop
    }
  };
  const listPersisted = (): string[] => {
    const out: string[] = [];
    try {
      const storage = self.localStorage;
      if (!storage) return out;
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith(FS_STORAGE_PREFIX)) continue;
        out.push(key.slice(FS_STORAGE_PREFIX.length));
      }
    } catch {
      // ignore
    }
    return out;
  };

  return {
    readText(path) {
      const key = normalizeFsPath(path);
      if (mem.has(key)) return mem.get(key)!;
      return readPersisted(key);
    },
    writeText(path, contents) {
      const key = normalizeFsPath(path);
      mem.set(key, contents);
      bins.delete(key);
      writePersisted(key, contents);
    },
    readBinary(path) {
      return bins.get(normalizeFsPath(path)) ?? null;
    },
    writeBinary(path, bytes) {
      const key = normalizeFsPath(path);
      bins.set(key, bytes);
      mem.delete(key);
      // stored encoded as base64 for persistence
      try {
        const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
        writePersisted(key, `__BINARY__:${self.btoa?.(binaryString) ?? ''}`);
      } catch {
        // ignore persistence failure
      }
    },
    deletePath(path) {
      const key = normalizeFsPath(path);
      const had = mem.delete(key) || bins.delete(key);
      deletePersisted(key);
      return had;
    },
    list(directory) {
      const prefix = normalizeFsPath(directory);
      const entries = new Set<string>();
      const collect = (name: string) => {
        if (!prefix) {
          entries.add(name.split('/')[0] ?? name);
          return;
        }
        if (name === prefix) entries.add(name);
        else if (name.startsWith(`${prefix}/`)) {
          const tail = name.slice(prefix.length + 1).split('/')[0]!;
          entries.add(tail);
        }
      };
      for (const name of mem.keys()) collect(name);
      for (const name of bins.keys()) collect(name);
      for (const name of listPersisted()) collect(name);
      return [...entries].sort();
    },
    exists(path) {
      const key = normalizeFsPath(path);
      return mem.has(key) || bins.has(key) || readPersisted(key) !== null;
    },
    size(path) {
      const key = normalizeFsPath(path);
      if (mem.has(key)) return mem.get(key)!.length;
      if (bins.has(key)) return bins.get(key)!.byteLength;
      const persisted = readPersisted(key);
      return persisted === null ? -1 : persisted.length;
    }
  };
}

type InterpreterRuntimeSession = {
  mode: 'interpreter';
  session: ReturnType<typeof createSession>;
  files: SketchFile[];
};

type CompiledRuntimeSession = {
  mode: 'compiled-js';
  files: SketchFile[];
  code: string;
  module: {
    setup: (rt: CompiledRuntimeHelpers) => unknown;
    draw: (state: unknown, frameInfo: Record<string, unknown>, input: Record<string, unknown>, canvas: Record<string, unknown>, rt: CompiledRuntimeHelpers) => unknown;
  };
  state: unknown;
  config: Record<string, unknown>;
  startCommands: Record<string, unknown>[];
  helpers: CompiledRuntimeHelpers;
};

type RuntimeSession = InterpreterRuntimeSession | CompiledRuntimeSession;

type RuntimeRequest =
  | { id: number; type: 'start'; payload: RuntimeStartPayload }
  | { id: number; type: 'start-commands' }
  | { id: number; type: 'frame'; payload: RuntimeFramePayload }
  | { id: number; type: 'query'; payload: RuntimeQueryPayload }
  | { id: number; type: 'stop' };

type RuntimeResponse =
  | { id: number; ok: true; type: 'start'; value: RuntimeStartResult }
  | { id: number; ok: true; type: 'start-commands'; value: RuntimeStartCommandsResult }
  | { id: number; ok: true; type: 'frame'; value: Record<string, unknown>[] }
  | { id: number; ok: true; type: 'query'; value: RuntimeQueryResult }
  | { id: number; ok: true; type: 'stop'; value: null }
  | { type: 'stdout'; value: string }
  | { id: number; ok: false; error: string };

const BOOT_SOURCE = [
  '.qv.cmds:enlist 0N',
  '.qv.state:()',
  '.qv.config:()',
  'Color.INK:855327',
  'Color.NIGHT:329228',
  'Color.MIDNIGHT:724250',
  'Color.DEEP:528424',
  'Color.BLUE:5992424',
  'Color.SKY:8169215',
  'Color.GOLD:12883310',
  'Color.CORAL:14711378',
  'Color.RED:13723982',
  'Color.PURPLE:9202633',
  'Color.GREEN:5152658',
  'Color.CREAM:16051416',
  'Color.YELLOW:16769696',
  'Color.SOFT_YELLOW:16769720',
  'Color.LAVENDER:14989311',
  'Color.ORBIT:2500938',
  '',
  '.qv.append:{[cmd]',
  '  .qv.cmds,:enlist cmd;',
  '  :cmd;',
  '}',
  '',
  'background:{[fill]',
  '  .qv.append[`kind`fill!(`background;fill)];',
  '}',
  '',
  'circle:{[data]',
  '  .qv.append[`kind`data!(`circle;data)];',
  '}',
  '',
  'rect:{[data]',
  '  .qv.append[`kind`data!(`rect;data)];',
  '}',
  '',
  'pixel:{[data]',
  '  .qv.append[`kind`data!(`pixel;data)];',
  '}',
  '',
  'line:{[data]',
  '  .qv.append[`kind`data!(`line;data)];',
  '}',
  '',
  'text:{[data]',
  '  .qv.append[`kind`data!(`text;data)];',
  '}',
  '',
  'image:{[data]',
  '  .qv.append[`kind`data!(`image;data)];',
  '}',
  '',
  'generic:{[cmds]',
  '  .qv.cmds,:$[0h=type cmds;cmds;enlist cmds];',
  '  :cmds;',
  '}',
  '',
  'push:{[]',
  '  .qv.append[enlist[`kind]!enlist `push];',
  '}',
  '',
  'pop:{[]',
  '  .qv.append[enlist[`kind]!enlist `pop];',
  '}',
  '',
  'translate:{[xy]',
  '  .qv.append[`kind`x`y!(`translate;first xy;last xy)];',
  '}',
  '',
  'scale:{[xy]',
  '  if[1=count xy;xy:xy,xy];',
  '  .qv.append[`kind`x`y!(`scale;first xy;last xy)];',
  '}',
  '',
  'cursor:{[name]',
  '  .qv.append[`kind`cursor!(`cursor;name)];',
  '}',
  '',
  '.qv.init:{',
  '  .qv.cmds:enlist 0N;',
  '  result:setup[];',
  '  .qv.state:result;',
  '  .qv.config:result;',
  '  :result;',
  '}',
  '',
  '.qv.frame:{[frameJson;inputJson;canvasJson]',
  '  .qv.cmds:enlist 0N;',
  '  state1:draw[.qv.state;frameJson;inputJson;canvasJson];',
  '  .qv.state:state1;',
  '  :1_ .qv.cmds;',
  '}',
].join('\n');

let runtime: RuntimeSession | null = null;

self.onmessage = (event: MessageEvent<RuntimeRequest>) => {
  const message = event.data;

  try {
    if (message.type === 'start') {
      const nextRuntime = createRuntimeSession(message.payload);
      runtime = nextRuntime.runtime;
      emitStdout(nextRuntime.stdout);
      postMessage({
        id: message.id,
        ok: true,
        type: 'start',
        value: {
          config: nextRuntime.config,
          backend: nextRuntime.backend,
          fallbackReason: nextRuntime.fallbackReason ?? null,
        },
      } satisfies RuntimeResponse);
      return;
    }

    if (message.type === 'start-commands') {
      const activeRuntime = getRuntime();
      const commands = activeRuntime.mode === 'compiled-js'
        ? activeRuntime.startCommands
        : convertValue(activeRuntime.session.evaluate('.qv.result:1_ .qv.cmds').value, 'rows') as Record<string, unknown>[];
      postMessage({
        id: message.id,
        ok: true,
        type: 'start-commands',
        value: commands,
      } satisfies RuntimeResponse);
      return;
    }

    if (message.type === 'frame') {
      const activeRuntime = getRuntime();
      const commands = activeRuntime.mode === 'compiled-js'
        ? runCompiledFrame(activeRuntime, message.payload)
        : runInterpreterFrame(activeRuntime, message.payload);
      postMessage({
        id: message.id,
        ok: true,
        type: 'frame',
        value: commands,
      } satisfies RuntimeResponse);
      return;
    }

    if (message.type === 'query') {
      try {
        const session = createInterpreterRuntimeSession(message.payload.files);
        const result = session.session.evaluate(message.payload.expression);
        if (message.payload.debugConsole || isExplicitShowStatement(message.payload.expression)) {
          emitStdout(result.formatted);
        }
        postMessage({
          id: message.id,
          ok: true,
          type: 'query',
          value: {
            ok: true,
            value: convertValue(result.value, 'columns'),
          },
        } satisfies RuntimeResponse);
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        postMessage({
          id: message.id,
          ok: true,
          type: 'query',
          value: {
            ok: false,
            error: messageText,
          },
        } satisfies RuntimeResponse);
      }
      return;
    }

    if (message.type === 'stop') {
      runtime = null;
      postMessage({
        id: message.id,
        ok: true,
        type: 'stop',
        value: null,
      } satisfies RuntimeResponse);
    }
  } catch (error) {
    const activeRuntime = runtime;
    const messageText = activeRuntime?.mode === 'compiled-js'
      ? formatCompiledRuntimeError(error, activeRuntime.code)
      : error instanceof Error
        ? error.message
        : String(error);
    postMessage({
      id: message.id,
      ok: false,
      error: messageText,
    } satisfies RuntimeResponse);
  }
};

function ensureRuntime() {
  if (!runtime) {
    throw new Error('q runtime is not running.');
  }
}

function getRuntime() {
  ensureRuntime();
  return runtime as RuntimeSession;
}

function createRuntimeSession(payload: RuntimeStartPayload) {
  if (payload.backendMode !== 'interpreter' && payload.compiled?.status === 'compiled' && payload.compiled.code) {
    try {
      const compiled = createCompiledRuntimeSession(payload.files, payload.compiled.code);
      return {
        runtime: compiled as RuntimeSession,
        config: compiled.config,
        backend: 'compiled-js' as const,
        stdout: '',
      };
    } catch (error) {
      const fallbackReason = formatCompiledRuntimeError(error, payload.compiled.code);
      const interpreted = createInterpreterRuntimeSession(payload.files);
      const initResult = interpreted.session.evaluate('.qv.result:.qv.init[]');
      return {
        runtime: interpreted as RuntimeSession,
        config: convertValue(initResult.value, 'columns') as Record<string, unknown>,
        backend: 'interpreter' as const,
        fallbackReason,
        stdout: initResult.formatted,
      };
    }
  }

  const interpreted = createInterpreterRuntimeSession(payload.files);
  const initResult = interpreted.session.evaluate('.qv.result:.qv.init[]');
  return {
    runtime: interpreted as RuntimeSession,
    config: convertValue(initResult.value, 'columns') as Record<string, unknown>,
    backend: 'interpreter' as const,
    stdout: initResult.formatted,
  };
}

function createInterpreterRuntimeSession(files: SketchFile[]) {
  const session = createSession({ fs: createWorkerFileSystem(files) });
  loadSource(session, BOOT_SOURCE);

  const runtimeFiles = files
    .filter((file) => file.name.endsWith('.q'))
    .sort((left, right) => {
      if (left.name === 'practice.q') return 1;
      if (right.name === 'practice.q') return -1;
      if (left.name === 'sketch.q') return 1;
      if (right.name === 'sketch.q') return -1;
      return left.name.localeCompare(right.name);
    });

  if (!runtimeFiles.length) {
    throw new Error('No q source files were provided.');
  }

  for (const file of runtimeFiles) {
    loadSource(session, file.content, file.name);
  }

  return {
    mode: 'interpreter' as const,
    session,
    files: runtimeFiles.map((file) => ({ ...file })),
  };
}

function createCompiledRuntimeSession(files: SketchFile[], code: string): CompiledRuntimeSession {
  const wrappedCode = `return (\n${code}\n);\n//# sourceURL=qanvas-compiled-sketch.js`;
  const factory = new Function(wrappedCode);
  const module = factory() as CompiledRuntimeSession['module'];

  if (!module || typeof module.setup !== 'function' || typeof module.draw !== 'function') {
    throw new Error('Generated JS did not expose setup(rt) and draw(state, frameInfo, input, canvas, rt).');
  }

  const helpers = createCompiledRuntimeHelpers({ onStdout: emitStdout });
  helpers.resetCommands();
  const state = module.setup(helpers);
  const commands = helpers.takeCommands();
  const config = isPlainObject(state) ? { ...state } : {};

  return {
    mode: 'compiled-js',
    files: files.map((file) => ({ ...file })),
    code,
    module,
    state,
    config,
    startCommands: commands,
    helpers,
  };
}

function runInterpreterFrame(session: InterpreterRuntimeSession, payload: RuntimeFramePayload) {
  const result = session.session.evaluate(`.qv.result:${buildFrameExpression(payload)}`);
  emitStdout(result.formatted);
  return convertValue(result.value, 'rows') as Record<string, unknown>[];
}

function runCompiledFrame(session: CompiledRuntimeSession, payload: RuntimeFramePayload) {
  session.helpers.resetCommands();
  session.state = session.module.draw(
    session.state,
    payload.frameInfo,
    payload.input,
    payload.canvas,
    session.helpers
  );
  return session.helpers.takeCommands();
}

function formatCompiledRuntimeError(error: unknown, code: string) {
  const baseMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? '' : '';
  const location = extractCompiledLocation(stack);

  if (!location) {
    return baseMessage;
  }

  const line = location.line - 1;
  const column = location.column;
  const snippet = getCompiledSnippet(code, line);
  return `${baseMessage} at compiled JS line ${line}, char ${column}${snippet ? ` near \`${snippet}\`` : ''}`;
}

function extractCompiledLocation(stack: string) {
  const sourceMatch = stack.match(/qanvas-compiled-sketch\.js:(\d+):(\d+)/);
  if (sourceMatch) {
    return {
      line: Number.parseInt(sourceMatch[1] ?? '0', 10),
      column: Number.parseInt(sourceMatch[2] ?? '0', 10),
    };
  }

  const anonymousMatch = stack.match(/<anonymous>:(\d+):(\d+)/);
  if (anonymousMatch) {
    return {
      line: Number.parseInt(anonymousMatch[1] ?? '0', 10),
      column: Number.parseInt(anonymousMatch[2] ?? '0', 10),
    };
  }

  return null;
}

function getCompiledSnippet(code: string, lineNumber: number) {
  if (lineNumber < 1) return '';
  const line = code.split('\n')[lineNumber - 1] ?? '';
  return line.trim().slice(0, 120);
}

function loadSource(session: ReturnType<typeof createSession>, source: string, fileName?: string) {
  for (const statement of normalizeQScript(rewriteQanvasCompat(source))) {
    try {
      const result = session.evaluate(statement);
      if (isExplicitShowStatement(statement)) {
        emitStdout(result.formatted);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(fileName ? `${fileName}: ${message}` : message);
    }
  }
}

function rewriteQanvasCompat(source: string) {
  return source.replace(/\b0x([0-9a-fA-F]{1,8})\b/g, (_match, hex: string) => `${Number.parseInt(hex, 16)}`);
}

function buildFrameExpression(payload: RuntimeFramePayload) {
  return `.qv.frame[${toQLiteral(payload.frameInfo)};${toQLiteral(payload.input)};${toQLiteral(payload.canvas)}]`;
}

function emitStdout(text: string) {
  const value = text.trimEnd();
  if (!value) return;

  postMessage({
    type: 'stdout',
    value,
  } satisfies RuntimeResponse);
}

function isExplicitShowStatement(statement: string) {
  return /^show(?:\s|\[|\()/.test(statement.trim());
}

function convertValue(value: any, mode: 'columns' | 'rows' = 'columns'): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => convertValue(entry, mode));
  }

  if (typeof value !== 'object') {
    return value;
  }

  switch (value.kind) {
    case 'null':
      return null;
    case 'boolean':
      return Boolean(value.value);
    case 'number':
      if (value.special === 'null' || value.special === 'intNull') {
        return null;
      }
      return Number.isFinite(value.value) ? value.value : String(value.value);
    case 'symbol':
    case 'string':
    case 'temporal':
      return value.value;
    case 'list':
      return (value.items ?? []).map((entry: unknown) => convertValue(entry, mode));
    case 'dictionary':
      return convertDictionary(value, mode);
    case 'table':
      return convertTable(value, mode);
    case 'keyedTable':
      return {
        keys: convertValue(value.keys, mode),
        values: convertValue(value.values, mode),
      };
    case 'namespace':
      return convertNamespace(value, mode);
    case 'error':
      return { name: value.name, message: value.message };
    case 'lambda':
      return { kind: 'lambda', params: value.params ?? null, source: value.source };
    case 'projection':
      return {
        kind: 'projection',
        target: convertValue(value.target, mode),
        args: (value.args ?? []).map((entry: unknown) => (entry === null ? null : convertValue(entry, mode))),
        arity: value.arity,
      };
    case 'builtin':
      return { kind: 'builtin', name: value.name, arity: value.arity };
    default:
      return value;
  }
}

function convertDictionary(value: any, mode: 'columns' | 'rows') {
  const keys = Array.isArray(value.keys) ? value.keys : [];
  const entries: Array<[string, unknown]> = [];

  for (let index = 0; index < keys.length; index += 1) {
    const key = normalizeKey(keys[index]);
    const nextValue = convertValue(value.values?.[index], mode);
    entries.push([key, nextValue]);
  }

  return Object.fromEntries(entries);
}

function convertTable(value: any, mode: 'columns' | 'rows') {
  const columns = value.columns ?? {};
  const columnNames = Object.keys(columns);

  if (mode === 'columns') {
    return Object.fromEntries(
      columnNames.map((name) => [name, convertValue(columns[name], 'columns')])
    );
  }

  const rowCount = columnNames.length > 0 ? getColumnLength(columns[columnNames[0]]) : 0;
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, unknown> = {};
    for (const name of columnNames) {
      row[name] = getColumnItem(columns[name], rowIndex);
    }
    return row;
  });
}

function convertNamespace(value: any, mode: 'columns' | 'rows') {
  const entries = value.entries instanceof Map
    ? [...value.entries.entries()]
    : Object.entries(value.entries ?? {});

  return Object.fromEntries(
    entries.map(([name, entry]) => [name, convertValue(entry, mode)])
  );
}

function normalizeKey(value: unknown) {
  const converted = convertValue(value, 'columns');
  if (typeof converted === 'string') return converted;
  if (typeof converted === 'number' || typeof converted === 'boolean') return String(converted);
  return JSON.stringify(converted);
}

function getColumnLength(value: any) {
  if (value?.kind === 'list' && Array.isArray(value.items)) {
    return value.items.length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  return 0;
}

function getColumnItem(value: any, index: number) {
  if (value?.kind === 'list' && Array.isArray(value.items)) {
    return convertValue(value.items[index], 'columns');
  }

  if (Array.isArray(value)) {
    return convertValue(value[index], 'columns');
  }

  return convertValue(value, 'columns');
}

function toQLiteral(value: unknown): string {
  if (value === null || value === undefined) return '()';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0n';
    return Number.isInteger(value) ? `${value}` : `${value}`;
  }

  if (typeof value === 'boolean') {
    return value ? '1b' : '0b';
  }

  if (typeof value === 'string') {
    return qString(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '()';
    return `(${value.map((entry) => toQLiteral(entry)).join(';')})`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '()!()';
    }

    const keys = entries.map(([key]) => `\`${sanitizeSymbol(key)}`).join('');
    const values = `(${entries.map(([, entry]) => toQLiteral(entry)).join(';')})`;
    return `${keys}!${values}`;
  }

  return '()';
}

function sanitizeSymbol(value: string) {
  return value.replace(/[^\w]/g, '_');
}

function qString(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function normalizeQScript(source: string) {
  const statements: string[] = [];
  let buffer = '';
  let delimiterDepth = 0;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (delimiterDepth === 0 && line.startsWith('/'))) {
      continue;
    }

    buffer = buffer ? `${buffer} ${line}` : line;
    delimiterDepth += countChar(line, '{');
    delimiterDepth -= countChar(line, '}');
    delimiterDepth += countChar(line, '(');
    delimiterDepth -= countChar(line, ')');
    delimiterDepth += countChar(line, '[');
    delimiterDepth -= countChar(line, ']');

    if (delimiterDepth <= 0) {
      statements.push(buffer.replace(/;\s*([\)\]])/g, '$1'));
      buffer = '';
      delimiterDepth = 0;
    }
  }

  if (buffer) {
    statements.push(buffer.replace(/;\s*([\)\]])/g, '$1'));
  }

  return statements;
}

function countChar(value: string, target: string) {
  return [...value].filter((char) => char === target).length;
}
