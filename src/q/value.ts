// Core q value model.
// Numeric and temporal types are stored in Float64Array (nulls = NaN, infinities = ±Infinity).
// Chars are JS strings, symbols and guids are string arrays, general lists are QValue arrays.

export const T = {
  list: 0, bool: 1, guid: 2, byte: 4, short: 5, int: 6, long: 7, real: 8, float: 9, char: 10, sym: 11,
  timestamp: 12, month: 13, date: 14, datetime: 15, timespan: 16, minute: 17, second: 18, time: 19,
  table: 98, dict: 99, lambda: 100, unary: 101, binary: 102, ternary: 103, projection: 104, composition: 105,
  each: 106, over: 107, scan: 108, prior: 109, eachRight: 110, eachLeft: 111, error: -128,
} as const;

// index = type number
export const TYPE_CHARS = " bg xhijefcspmdznuvt";
export const typeChar = (t: number) => TYPE_CHARS[Math.abs(t)] ?? " ";
export const typeOfChar = (c: string) => TYPE_CHARS.indexOf(c);

export const TYPE_NAMES: Record<number, string> = {
  0: "list", 1: "boolean", 2: "guid", 4: "byte", 5: "short", 6: "int", 7: "long", 8: "real", 9: "float",
  10: "char", 11: "symbol", 12: "timestamp", 13: "month", 14: "date", 15: "datetime", 16: "timespan",
  17: "minute", 18: "second", 19: "time", 98: "table", 99: "dictionary", 100: "lambda", 101: "unary primitive",
  102: "operator", 103: "iterator", 104: "projection", 105: "composition", 106: "each", 107: "over",
  108: "scan", 109: "each-prior", 110: "each-right", 111: "each-left",
};

export type NumData = Float64Array;
export type VecData = Float64Array | string | string[] | QValue[];

export class QAtom {
  constructor(public readonly t: number, public readonly v: any) {}
}

export class QVec {
  attr = "";
  constructor(public readonly t: number, public readonly d: any) {}
  get n(): number { return this.d.length; }
}

export class QDict {
  constructor(public readonly k: QValue, public readonly v: QValue) {}
}

export class QTable {
  constructor(public readonly cols: string[], public readonly data: QValue[]) {}
  get n(): number { return this.data.length ? count(this.data[0]) : 0; }
}

export abstract class QFn {
  abstract readonly t: number;
  abstract readonly rank: number;
}

export type QValue = QAtom | QVec | QDict | QTable | QFn;

// ---------- predicates ----------
export const isAtom = (x: QValue): x is QAtom => x instanceof QAtom;
export const isVec = (x: QValue): x is QVec => x instanceof QVec;
export const isDict = (x: QValue): x is QDict => x instanceof QDict;
export const isTable = (x: QValue): x is QTable => x instanceof QTable;
export const isFn = (x: QValue): x is QFn => x instanceof QFn;
export const isKeyed = (x: QValue): boolean => x instanceof QDict && x.k instanceof QTable && x.v instanceof QTable;
export const isList = (x: QValue): x is QVec => x instanceof QVec && x.t === 0;

export const typeOf = (x: QValue): number => {
  if (x instanceof QAtom) return x.t;
  if (x instanceof QVec) return x.t;
  if (x instanceof QTable) return 98;
  if (x instanceof QDict) return 99;
  return (x as QFn).t;
};

export const isNumT = (t: number) => {
  const a = Math.abs(t);
  return a === 1 || a === 4 || a === 5 || a === 6 || a === 7 || a === 8 || a === 9 || (a >= 12 && a <= 19);
};
export const isIntT = (t: number) => {
  const a = Math.abs(t);
  return a === 1 || a === 4 || a === 5 || a === 6 || a === 7;
};
export const isFloatT = (t: number) => Math.abs(t) === 8 || Math.abs(t) === 9;
export const isTemporalT = (t: number) => Math.abs(t) >= 12 && Math.abs(t) <= 19;

export function count(x: QValue): number {
  if (x instanceof QVec) return x.d.length;
  if (x instanceof QTable) return x.n;
  if (x instanceof QDict) return count(x.k);
  return 1;
}

// ---------- constructors ----------
export const atom = (t: number, v: any) => new QAtom(t, v);
export const long = (v: number) => new QAtom(-7, v);
export const int = (v: number) => new QAtom(-6, v);
export const float = (v: number) => new QAtom(-9, v);
export const bool = (v: boolean | number) => new QAtom(-1, v ? 1 : 0);
export const sym = (v: string) => new QAtom(-11, v);
export const char = (v: string) => new QAtom(-10, v);

export const vec = (t: number, d: any) => new QVec(t, d);
export const floats = (d: ArrayLike<number>) => new QVec(9, d instanceof Float64Array ? d : Float64Array.from(d));
export const longs = (d: ArrayLike<number>) => new QVec(7, d instanceof Float64Array ? d : Float64Array.from(d));
export const bools = (d: ArrayLike<number | boolean>) => new QVec(1, Float64Array.from(d as ArrayLike<number>, (v) => (v ? 1 : 0)));
export const syms = (d: string[]) => new QVec(11, d);
export const str = (s: string) => new QVec(10, s);
export const list = (items: QValue[]) => new QVec(0, items);
export const dict = (k: QValue, v: QValue) => new QDict(k, v);
export const table = (cols: string[], data: QValue[]) => new QTable(cols, data);

export const emptyList = () => new QVec(0, []);

/** A typed empty vector of type t. */
export function emptyOf(t: number): QVec {
  t = Math.abs(t);
  if (t === 10) return new QVec(10, "");
  if (t === 11 || t === 2) return new QVec(t, []);
  if (t === 0 || t > 19) return new QVec(0, []);
  return new QVec(t, new Float64Array(0));
}

/** Allocate a vector of type t with n slots. */
export function alloc(t: number, n: number): any {
  if (t === 10) return new Array<string>(n).fill(" ");
  if (t === 11 || t === 2) return new Array<string>(n).fill("");
  if (t === 0) return new Array<QValue>(n);
  return new Float64Array(n);
}

/** Wrap raw data (array form) into a vector; char arrays are joined to strings. */
export function mkvec(t: number, d: any): QVec {
  if (t === 10 && Array.isArray(d)) return new QVec(10, d.join(""));
  return new QVec(t, d);
}

// ---------- null / identity ----------
export class QIdentity extends QFn {
  readonly t = 101;
  readonly rank = 1;
}
export const NIL = new QIdentity();
export const isNil = (x: QValue) => x === NIL;

export function nullOf(t: number): QAtom {
  t = Math.abs(t);
  switch (t) {
    case 1: return atom(-1, 0);
    case 4: return atom(-4, 0);
    case 10: return atom(-10, " ");
    case 11: return atom(-11, "");
    case 2: return atom(-2, "00000000-0000-0000-0000-000000000000");
    case 0: return atom(-11, "") as QAtom;
    default: return atom(-t, NaN);
  }
}

export function isNullAtom(a: QAtom): boolean {
  const t = -a.t;
  if (t === 10) return a.v === " ";
  if (t === 11) return a.v === "";
  if (t === 2) return a.v === "00000000-0000-0000-0000-000000000000";
  if (t === 1 || t === 4) return false;
  return Number.isNaN(a.v);
}

// ---------- element access ----------
/** Item i of a vector as a q value. */
export function item(x: QVec, i: number): QValue {
  const t = x.t;
  if (t === 0) return (x.d as QValue[])[i];
  return new QAtom(-t, x.d[i]);
}

/** Item i of any list-like value (vec, table row, dict value index). */
export function at(x: QValue, i: number): QValue {
  if (x instanceof QVec) return i >= 0 && i < x.d.length ? item(x, i) : nullItem(x);
  if (x instanceof QTable) {
    return dict(syms(x.cols), list2vec(x.data.map((c) => at(c, i))));
  }
  return x;
}

/** The null item of a list (typed null for simple lists; for general lists, null of first item). */
export function nullItem(x: QVec): QValue {
  if (x.t !== 0) return nullOf(x.t);
  const d = x.d as QValue[];
  if (!d.length) return NIL;
  return nullLike(d[0]);
}

export function nullLike(x: QValue): QValue {
  if (x instanceof QAtom) return nullOf(x.t);
  if (x instanceof QVec) {
    if (x.t === 0) return list((x.d as QValue[]).map(nullLike));
    const n = x.d.length;
    const nv = nullOf(x.t).v;
    if (x.t === 10) return str(" ".repeat(n));
    if (x.t === 11 || x.t === 2) return vec(x.t, new Array(n).fill(nv));
    return vec(x.t, new Float64Array(n).fill(nv));
  }
  if (x instanceof QTable) return table(x.cols, x.data.map(nullLike));
  if (x instanceof QDict) return dict(x.k, nullLike(x.v));
  return NIL;
}

/** Build a q list from item values: uniform atoms collapse to a simple vector, conforming dicts to a table. */
export function fromItems(items: QValue[]): QValue {
  const n = items.length;
  const first = items[0];
  if (n && first instanceof QDict && first.k instanceof QVec && first.k.t === 11 && first.k.d.length) {
    const ks = first.k.d as string[];
    let ok = true;
    for (let i = 1; i < n && ok; i++) {
      const it = items[i];
      if (!(it instanceof QDict) || !(it.k instanceof QVec) || it.k.t !== 11 || !sameSyms(it.k.d, ks)) ok = false;
    }
    if (ok) {
      const cols = ks.map((_, j) => list2vec(items.map((r) => at((r as QDict).v, j))));
      return new QTable(ks.slice(), cols);
    }
  }
  return list2vec(items);
}

/** Collapse a list of q values into the tightest vector: atoms of one type -> simple vector. */
export function list2vec(items: QValue[]): QVec {
  const n = items.length;
  if (n === 0) return emptyList();
  const first = items[0];
  if (!(first instanceof QAtom)) return list(items);
  const t = first.t;
  if (t >= 0 || t < -19) return list(items);
  for (let i = 1; i < n; i++) {
    const it = items[i];
    if (!(it instanceof QAtom) || it.t !== t) return list(items);
  }
  const vt = -t;
  if (vt === 10) {
    let s = "";
    for (let i = 0; i < n; i++) s += (items[i] as QAtom).v;
    return str(s);
  }
  if (vt === 11 || vt === 2) return vec(vt, items.map((a) => (a as QAtom).v));
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = (items[i] as QAtom).v;
  return vec(vt, d);
}

const sameSyms = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);

/** Convert any list-like to an array of item values. */
export function items(x: QValue): QValue[] {
  if (x instanceof QVec) {
    if (x.t === 0) return x.d as QValue[];
    const out = new Array<QValue>(x.d.length);
    for (let i = 0; i < out.length; i++) out[i] = new QAtom(-x.t, x.d[i]);
    return out;
  }
  if (x instanceof QTable) {
    const n = x.n;
    const out = new Array<QValue>(n);
    for (let i = 0; i < n; i++) out[i] = at(x, i);
    return out;
  }
  if (x instanceof QDict) return items(x.v);
  return [x];
}

/** General-list view of a vector (never collapses). */
export function toGeneral(x: QVec): QValue[] {
  return x.t === 0 ? (x.d as QValue[]) : items(x);
}

export function isSimple(x: QValue): boolean {
  return x instanceof QVec && x.t > 0;
}

export function isStr(x: QValue): x is QVec {
  return x instanceof QVec && x.t === 10;
}

export function symList(x: QValue): string[] | null {
  if (x instanceof QAtom && x.t === -11) return [x.v];
  if (x instanceof QVec && x.t === 11) return x.d as string[];
  return null;
}

export function num(x: QValue): number {
  if (x instanceof QAtom && typeof x.v === "number") return x.v;
  throw new Error("num: not a numeric atom");
}
