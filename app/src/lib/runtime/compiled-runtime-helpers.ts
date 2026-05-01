import { formatDisplayValue } from '../formatting/value-format';

export type CompiledRuntimeHelpers = ReturnType<typeof createCompiledRuntimeHelpers>;

type CompiledRuntimeHelperOptions = {
  onStdout?: (text: string) => void;
};

export const QANVAS_COLORS = {
  INK: 0x0D0D1F,
  NIGHT: 0x05060C,
  MIDNIGHT: 0x0B0D1A,
  DEEP: 0x081028,
  BLUE: 0x5B6FE8,
  SKY: 0x7CA6FF,
  GOLD: 0xC4956E,
  CORAL: 0xE07A52,
  RED: 0xD1694E,
  PURPLE: 0x8C6BC9,
  GREEN: 0x4E9F92,
  CREAM: 0xF4ECD8,
  YELLOW: 0xFFE2A0,
  SOFT_YELLOW: 0xFFE2B8,
  LAVENDER: 0xE4B7FF,
  ORBIT: 0x26294A,
} as const;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const COMPILED_BUILTIN_CALLS = new Set([
  'background',
  'circle',
  'rect',
  'triangle',
  'line',
  'pixel',
  'text',
  'image',
  'generic',
  'push',
  'pop',
  'translate',
  'scale',
  'cursor',
  'show',
  'first',
  'last',
  'count',
  'til',
  'floor',
  'ceiling',
  'flip',
  'enlist',
  'raze',
  'reverse',
  'sum',
  'prd',
  'sums',
  'prds',
  'mins',
  'maxs',
  'avgs',
  'avg',
  'min',
  'max',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'abs',
  'exp',
  'log',
  'neg',
  'reciprocal',
  'signum',
]);

export function createCompiledRuntimeHelpers(options: CompiledRuntimeHelperOptions = {}) {
  let commands: Record<string, unknown>[] = [];

  function mapBinary(left: unknown, right: unknown, fn: (leftValue: unknown, rightValue: unknown) => unknown): unknown {
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length === right.length) {
        return left.map((entry, index) => mapBinary(entry, right[index], fn));
      }
      if (left.length === 1) {
        return right.map((entry) => mapBinary(left[0], entry, fn));
      }
      if (right.length === 1) {
        return left.map((entry) => mapBinary(entry, right[0], fn));
      }
      return left.map((entry, index) => mapBinary(entry, right[index], fn));
    }
    if (Array.isArray(left)) {
      return left.map((entry) => mapBinary(entry, right, fn));
    }
    if (Array.isArray(right)) {
      return right.map((entry) => mapBinary(left, entry, fn));
    }
    return fn(left, right);
  }

  const helpers = {
    colors: QANVAS_COLORS,
    resetCommands() {
      commands = [];
    },
    takeCommands() {
      return commands.map((entry) => ({ ...entry }));
    },
    table(columns: Record<string, unknown>) {
      const rowCount = Math.max(
        1,
        ...Object.values(columns).map((value) => (Array.isArray(value) ? value.length : 1))
      );
      return Array.from({ length: rowCount }, (_, rowIndex) => {
        const row: Record<string, unknown> = {};
        for (const [name, value] of Object.entries(columns)) {
          row[name] = Array.isArray(value) ? value[Math.min(rowIndex, value.length - 1)] : value;
        }
        return row;
      });
    },
    callBuiltin(name: string, args: unknown[]) {
      const derived = parseDerivedPrimitiveAdverb(name);
      if (derived) {
        return applyDerivedPrimitiveAdverb(derived.op, derived.adverb, args);
      }

      switch (name) {
        case 'background':
          commands.push({ kind: 'background', fill: args[0] });
          return args[0];
        case 'circle':
        case 'rect':
        case 'triangle':
        case 'pixel':
        case 'line':
        case 'text':
        case 'image':
          commands.push({ kind: name, data: args[0] });
          return args[0];
        case 'generic': {
          const cmds = args[0];
          const rows = normalizeGenericCommandRows(cmds);
          for (const row of rows) {
            commands.push({ ...row });
          }
          return cmds;
        }
        case 'push':
          commands.push({ kind: 'push' });
          return null;
        case 'pop':
          commands.push({ kind: 'pop' });
          return null;
        case 'translate': {
          const xy = toArray(args[0]);
          const x = xy[0];
          const y = xy.length ? xy[xy.length - 1] : x;
          commands.push({ kind: 'translate', x, y });
          return args[0];
        }
        case 'scale': {
          let xy = toArray(args[0]);
          if (xy.length === 1) {
            xy = [xy[0], xy[0]];
          }
          commands.push({ kind: 'scale', x: xy[0], y: xy.length ? xy[xy.length - 1] : xy[0] });
          return args[0];
        }
        case 'cursor':
          commands.push({ kind: 'cursor', cursor: args[0] });
          return args[0];
        case 'show':
          options.onStdout?.(formatDisplayValue(args[0]));
          return args[0];
        case 'first':
          return Array.isArray(args[0]) ? args[0][0] : null;
        case 'last':
          return Array.isArray(args[0]) ? args[0][args[0].length - 1] : null;
        case 'count':
          return Array.isArray(args[0]) ? args[0].length : isPlainObject(args[0]) ? Object.keys(args[0] as Record<string, unknown>).length : 0;
        case 'til':
          return Array.from({ length: Number(args[0] ?? 0) }, (_, index) => index);
        case 'floor':
          return vectorizeUnary(args[0], (value) => Math.floor(Number(value ?? 0)));
        case 'ceiling':
          return vectorizeUnary(args[0], (value) => Math.ceil(Number(value ?? 0)));
        case 'enlist':
          return [args[0]];
        case 'flip':
          return flipColumns(args[0]);
        case 'raze':
          return razeOnce(args[0]);
        case 'reverse':
          return Array.isArray(args[0]) ? [...(args[0] as unknown[])].reverse() : args[0];
        case 'sum':
          return reduceNumeric(args[0], (a, b) => a + b, 0);
        case 'prd':
          return reduceNumeric(args[0], (a, b) => a * b, 1);
        case 'sums':
          return scanNumeric(args[0], (a, b) => a + b, 0);
        case 'prds':
          return scanNumeric(args[0], (a, b) => a * b, 1);
        case 'mins':
          return scanNumeric(args[0], (a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
        case 'maxs':
          return scanNumeric(args[0], (a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
        case 'avgs':
          return runningAverage(args[0]);
        case 'avg': {
          const arr = toNumericArray(args[0]);
          if (arr.length === 0) return null;
          return arr.reduce((a, b) => a + b, 0) / arr.length;
        }
        case 'min':
          return reduceNumeric(args[0], (a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
        case 'max':
          return reduceNumeric(args[0], (a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
        case 'sin':
          return vectorizeUnary(args[0], (value) => Math.sin(Number(value ?? 0)));
        case 'cos':
          return vectorizeUnary(args[0], (value) => Math.cos(Number(value ?? 0)));
        case 'tan':
          return vectorizeUnary(args[0], (value) => Math.tan(Number(value ?? 0)));
        case 'asin':
          return vectorizeUnary(args[0], (value) => Math.asin(Number(value ?? 0)));
        case 'acos':
          return vectorizeUnary(args[0], (value) => Math.acos(Number(value ?? 0)));
        case 'atan':
          return vectorizeUnary(args[0], (value) => Math.atan(Number(value ?? 0)));
        case 'sqrt':
          return vectorizeUnary(args[0], (value) => Math.sqrt(Number(value ?? 0)));
        case 'abs':
          return vectorizeUnary(args[0], (value) => Math.abs(Number(value ?? 0)));
        case 'exp':
          return vectorizeUnary(args[0], (value) => Math.exp(Number(value ?? 0)));
        case 'log':
          return vectorizeUnary(args[0], (value) => Math.log(Number(value ?? 0)));
        case 'neg':
          return vectorizeUnary(args[0], (value) => -Number(value ?? 0));
        case 'reciprocal':
          return vectorizeUnary(args[0], (value) => 1 / Number(value ?? 0));
        case 'signum':
          return vectorizeUnary(args[0], (value) => {
            const numeric = Number(value ?? 0);
            return numeric > 0 ? 1 : numeric < 0 ? -1 : 0;
          });
        default:
          throw new Error(`Unsupported builtin \`${name}\`.`);
      }
    },
    call(callee: unknown, name: string | null, args: unknown[]) {
      if (typeof callee === 'function') {
        return callee(...args);
      }

      if (Array.isArray(callee) && args.length === 1) {
        const indexValue = args[0];
        if (Array.isArray(indexValue)) {
          return indexValue.map((entry) => callee[normalizeIndex(entry, callee.length)]);
        }
        return callee[normalizeIndex(indexValue, callee.length)];
      }

      if (isPlainObject(callee) && args.length === 1 && typeof args[0] === 'string') {
        return (callee as Record<string, unknown>)[args[0]];
      }

      throw new Error(name ? `Unsupported q call target \`${name}\`.` : 'Unsupported q call target.');
    },
    each(name: string, value: unknown) {
      return vectorizeUnary(value, (entry) => helpers.callBuiltin(name, [entry]));
    },
    cond(branches: Array<{ condition: unknown; value: unknown }>, elseValue: unknown) {
      for (const branch of branches) {
        if (isTruthy(branch.condition)) {
          return branch.value;
        }
      }
      return elseValue;
    },
    op(op: string, left: unknown, right: unknown) {
      switch (op) {
        case '!':
          return dictionaryFrom(left, right);
        case '#':
          return replicate(left, right);
        case '~':
          return deepEqual(left, right);
        case ',':
          return [...toArray(left), ...toArray(right)];
        case '+':
          return mapBinary(left, right, (a, b) => Number(a ?? 0) + Number(b ?? 0));
        case '-':
          return mapBinary(left, right, (a, b) => Number(a ?? 0) - Number(b ?? 0));
        case '*':
          return mapBinary(left, right, (a, b) => Number(a ?? 0) * Number(b ?? 0));
        case '%':
          return mapBinary(left, right, (a, b) => Number(a ?? 0) / Number(b ?? 1));
        case 'div':
          return mapBinary(left, right, (a, b) => Math.floor(Number(a ?? 0) / Number(b ?? 1)));
        case 'mod':
          return mapBinary(left, right, (a, b) => {
            const divisor = Number(b ?? 1) || 1;
            const dividend = Number(a ?? 0);
            return ((dividend % divisor) + divisor) % divisor;
          });
        default:
          throw new Error(`Unsupported q operator \`${op}\`.`);
      }
    },
  };

  return helpers;
}

function vectorizeUnary(value: unknown, fn: (entry: unknown) => unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => fn(entry));
  }
  return fn(value);
}

function razeOnce(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const result: unknown[] = [];
  for (const entry of value) {
    if (Array.isArray(entry)) {
      result.push(...entry);
    } else {
      result.push(entry);
    }
  }
  return result;
}

function toNumericArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((entry) => Number(entry ?? 0));
  }
  return value == null ? [] : [Number(value)];
}

function reduceNumeric(value: unknown, fn: (a: number, b: number) => number, seed: number) {
  const arr = toNumericArray(value);
  if (arr.length === 0) return seed === Number.POSITIVE_INFINITY || seed === Number.NEGATIVE_INFINITY ? null : seed;
  return arr.reduce((acc, entry) => fn(acc, entry), seed);
}

function scanNumeric(value: unknown, fn: (a: number, b: number) => number, seed: number) {
  const arr = toNumericArray(value);
  let acc = seed;
  return arr.map((entry) => {
    acc = fn(acc, entry);
    return acc;
  });
}

function runningAverage(value: unknown) {
  const arr = toNumericArray(value);
  let total = 0;
  return arr.map((entry, index) => {
    total += entry;
    return total / (index + 1);
  });
}

function parseDerivedPrimitiveAdverb(name: string) {
  const match = name.match(/^([+\-*%&|,])([/\\])$/);
  return match ? { op: match[1]!, adverb: match[2]! as '/' | '\\' } : null;
}

function applyDerivedPrimitiveAdverb(op: string, adverb: '/' | '\\', args: unknown[]) {
  const values = args.length > 1 && Array.isArray(args[1]) ? [args[0], ...(args[1] as unknown[])] : toArray(args[0]);
  if (values.length === 0) return adverb === '\\' ? [] : null;

  let acc = values[0];
  const outputs = [acc];
  for (const entry of values.slice(1)) {
    acc = applyPrimitiveBinary(op, acc, entry);
    outputs.push(acc);
  }
  return adverb === '\\' ? outputs : acc;
}

function applyPrimitiveBinary(op: string, left: unknown, right: unknown) {
  switch (op) {
    case '+':
      return mapBinaryValue(left, right, (a, b) => Number(a ?? 0) + Number(b ?? 0));
    case '-':
      return mapBinaryValue(left, right, (a, b) => Number(a ?? 0) - Number(b ?? 0));
    case '*':
      return mapBinaryValue(left, right, (a, b) => Number(a ?? 0) * Number(b ?? 0));
    case '%':
      return mapBinaryValue(left, right, (a, b) => Number(a ?? 0) / Number(b ?? 1));
    case '&':
      return mapBinaryValue(left, right, (a, b) => Math.min(Number(a ?? 0), Number(b ?? 0)));
    case '|':
      return mapBinaryValue(left, right, (a, b) => Math.max(Number(a ?? 0), Number(b ?? 0)));
    case ',':
      return [...toArray(left), ...toArray(right)];
    default:
      throw new Error(`Unsupported q derived adverb \`${op}/\`.`);
  }
}

function mapBinaryValue(left: unknown, right: unknown, fn: (a: unknown, b: unknown) => unknown): unknown {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length === right.length) return left.map((entry, index) => mapBinaryValue(entry, right[index], fn));
    if (left.length === 1) return right.map((entry) => mapBinaryValue(left[0], entry, fn));
    if (right.length === 1) return left.map((entry) => mapBinaryValue(entry, right[0], fn));
    return left.map((entry, index) => mapBinaryValue(entry, right[index], fn));
  }
  if (Array.isArray(left)) return left.map((entry) => mapBinaryValue(entry, right, fn));
  if (Array.isArray(right)) return right.map((entry) => mapBinaryValue(left, entry, fn));
  return fn(left, right);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function dictionaryFrom(left: unknown, right: unknown) {
  const keys = Array.isArray(left) ? left : [left];
  const values = Array.isArray(right) ? right : [right];
  const entries = keys.map((key, index) => [String(key), values[index]]);
  return Object.fromEntries(entries);
}

function replicate(left: unknown, right: unknown) {
  const count = Math.max(0, Math.floor(Number(left ?? 0)));
  if (Array.isArray(right)) {
    if (right.length === 0) {
      return [];
    }
    if (right.length === 1) {
      return Array.from({ length: count }, () => right[0]);
    }
    return Array.from({ length: count }, (_, index) => right[index % right.length]);
  }
  return Array.from({ length: count }, () => right);
}

function flipColumns(value: unknown) {
  const columns = Array.isArray(value) ? value : [];
  const rowCount = columns.length > 0 && Array.isArray(columns[0]) ? columns[0].length : 0;
  return Array.from({ length: rowCount }, (_, rowIndex) => columns.map((column) => Array.isArray(column) ? column[rowIndex] : column));
}

function normalizeIndex(value: unknown, length: number) {
  const numeric = Math.floor(Number(value ?? 0));
  if (!Number.isFinite(numeric) || length <= 0) return 0;
  return ((numeric % length) + length) % length;
}

function deepEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isTruthy(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value);
}

/** Matches q `generic:{[cmds].qv.cmds,:$[0h=type cmds;cmds;enlist cmds];:cmds}` — append inner command dicts directly. */
function normalizeGenericCommandRows(cmds: unknown): Record<string, unknown>[] {
  if (Array.isArray(cmds)) {
    const rows: Record<string, unknown>[] = [];
    for (const entry of cmds) {
      if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
        rows.push(entry as Record<string, unknown>);
      }
    }
    return rows;
  }
  if (cmds != null && typeof cmds === 'object') {
    return [cmds as Record<string, unknown>];
  }
  return [];
}
