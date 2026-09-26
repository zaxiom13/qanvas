import { QError, lengthErr, typeErr } from "./errors";
import { RESULT_TYPES, TYPE_ORDER } from "./typetables";
import { NS_PER_DAY } from "./temporal";
import {
  QAtom, QDict, QTable, QValue, QVec, QFn, TYPE_NAMES, atom, dict, fromItems, isKeyed, items, list, table, typeChar, vec,
} from "./value";

// ---------- type resolution ----------
const TI: Record<number, number> = {};
for (let i = 0; i < TYPE_ORDER.length; i++) TI["bxhijefcpmdznuvt".charCodeAt(i)] = i;
const typeIdx = (t: number): number => {
  const c = typeChar(t);
  const i = TYPE_ORDER.indexOf(c);
  return i;
};

export function resultType(op: string, ta: number, tb: number): number {
  const table = RESULT_TYPES[op];
  const i = typeIdx(ta), j = typeIdx(tb);
  if (i < 0 || j < 0) return -1;
  const c = table[i * 16 + j];
  if (c === ".") return -1;
  return " bg xhijefcspmdznuvt".indexOf(c);
}

// temporal units, in ns (month handled separately)
const UNIT: Record<number, number> = { 12: 1, 14: NS_PER_DAY, 15: NS_PER_DAY, 16: 1, 17: 60e9, 18: 1e9, 19: 1e6 };
const isTemporal = (t: number) => t >= 12 && t <= 19;

/** Converter for a raw value of type `from` to units of type `to` (both absolute type codes). */
function conv(from: number, to: number): ((v: number) => number) | null {
  if (from === to) return null;
  if (!isTemporal(from) || !isTemporal(to)) return null;
  const uf = UNIT[from], ut = UNIT[to];
  if (uf === undefined || ut === undefined) return null;
  const k = uf / ut;
  return (v) => v * k;
}

// ---------- null-aware scalar comparisons ----------
export const nEq = (a: number, b: number) => a === b || (a !== a && b !== b);
export const nLt = (a: number, b: number) => (a !== a ? b === b : b !== b ? false : a < b);
export const nMin = (a: number, b: number) => (a !== a || b !== b ? NaN : a < b ? a : b);
export const nMax = (a: number, b: number) => (a !== a ? b : b !== b ? a : a > b ? a : b);

const describe = (x: QValue): string => {
  if (x instanceof QAtom) return `${TYPE_NAMES[-x.t] ?? "value"} atom`;
  if (x instanceof QVec) return x.t === 0 ? `list of ${x.d.length}` : `${TYPE_NAMES[x.t]} vector (${x.d.length})`;
  if (x instanceof QTable) return "table";
  if (x instanceof QDict) return "dictionary";
  return "function";
};

// ---------- scalar kernel ----------
export type Kern = (a: number, b: number) => number;

export interface NumOp {
  name: string; // key in RESULT_TYPES (for typing) e.g. "+"
  f: Kern;
  /** result-type override (e.g. comparisons -> bool) */
  bool?: boolean;
  /** kernel for symbols/chars/guids (string operands) */
  s?: (a: string, b: string) => number | string;
  /** type table key when differing from name */
  tt?: string;
}

function numType(op: NumOp, ta: number, tb: number): number {
  const rt = resultType(op.tt ?? op.name, ta, tb);
  if (rt < 0) {
    throw typeErr(`${op.name} can't combine ${TYPE_NAMES[ta] ?? ta} with ${TYPE_NAMES[tb] ?? tb}.`);
  }
  return rt;
}

function isStrType(t: number) {
  return t === 10 || t === 11 || t === 2;
}

function strKern(op: NumOp, ta: number, tb: number): (a: any, b: any) => any {
  if (!op.s) throw typeErr(`${op.name} doesn't work on ${TYPE_NAMES[ta]} and ${TYPE_NAMES[tb]}.`);
  if (ta !== tb) {
    // chars compare with numbers by code
    if (ta === 10 && !isStrType(tb)) return (a: string, b: number) => op.f(a.charCodeAt(0), b);
    if (tb === 10 && !isStrType(ta)) return (a: number, b: string) => op.f(a, b.charCodeAt(0));
    throw typeErr(`${op.name} can't compare ${TYPE_NAMES[ta]} with ${TYPE_NAMES[tb]}.`);
  }
  return op.s;
}

/** Apply a scalar op to two q values with full atomic extension. */
export function atomic2(op: NumOp, x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && y instanceof QAtom) return scalar(op, x, y);
  if (x instanceof QVec && y instanceof QVec) {
    if (x.t > 0 && y.t > 0) return vv(op, x, y);
    const n = x.d.length;
    if (n !== y.d.length) throw lengthErr(`${op.name}: left has ${n} items, right has ${y.d.length}.`);
    const xi = items(x), yi = items(y);
    const out = new Array<QValue>(n);
    for (let i = 0; i < n; i++) out[i] = atomic2(op, xi[i], yi[i]);
    return fromItems(out);
  }
  if (x instanceof QVec && y instanceof QAtom) {
    if (x.t > 0) return va(op, x, y, false);
    return fromItems((x.d as QValue[]).map((e) => atomic2(op, e, y)));
  }
  if (x instanceof QAtom && y instanceof QVec) {
    if (y.t > 0) return va(op, y, x, true);
    return fromItems((y.d as QValue[]).map((e) => atomic2(op, x, e)));
  }
  // dictionaries & tables
  if (x instanceof QTable || y instanceof QTable) return tableOp(op, x, y);
  if (x instanceof QDict || y instanceof QDict) return dictOp(op, x, y);
  if (x instanceof QFn || y instanceof QFn) throw typeErr(`${op.name} can't be applied to a function.`);
  throw typeErr(`${op.name} can't combine ${describe(x)} with ${describe(y)}.`);
}

function scalar(op: NumOp, x: QAtom, y: QAtom): QAtom {
  const ta = -x.t, tb = -y.t;
  if (isStrType(ta) || isStrType(tb)) {
    if (ta === 10 && tb === 10 && !op.bool) {
      // char arithmetic: treat as codes per type table
      const rt = numType(op, ta, tb);
      return atom(-rt, op.f(x.v.charCodeAt(0), y.v.charCodeAt(0)));
    }
    if (!op.bool && !op.s) {
      const rt = numType(op, ta, tb);
      const a = ta === 10 ? x.v.charCodeAt(0) : x.v, b = tb === 10 ? y.v.charCodeAt(0) : y.v;
      return atom(-rt, fix(rt, op.f(a, b)));
    }
    const k = strKern(op, ta, tb);
    const r = k(x.v, y.v);
    if (op.bool) return atom(-1, r ? 1 : 0);
    return atom(x.t, r);
  }
  if (op.bool) {
    const [a, b] = cmpVals(ta, tb, x.v, y.v, op.name);
    return atom(-1, op.f(a, b) ? 1 : 0);
  }
  const rt = numType(op, ta, tb);
  const ca = conv(ta, rt), cb = conv(tb, rt);
  let a = x.v, b = y.v;
  if (ca) a = ca(a);
  if (cb) b = cb(b);
  return atom(-rt, fix(rt, op.f(a, b)));
}

/** Bring two numeric values into a comparable unit. */
function cmpVals(ta: number, tb: number, a: number, b: number, name: string): [number, number] {
  if (ta === tb) return [a, b];
  const tA = isTemporal(ta), tB = isTemporal(tb);
  if (tA && tB) {
    if ((ta === 13) !== (tb === 13)) throw typeErr(`${name} can't compare ${TYPE_NAMES[ta]} with ${TYPE_NAMES[tb]}.`);
    const ua = UNIT[ta], ub = UNIT[tb];
    if (ua && ub) return [a * ua, b * ub];
  }
  return [a, b];
}

function fix(rt: number, v: number): number {
  if (rt === 8) return Math.fround(v);
  if (rt === 6 || rt === 5) {
    if (v !== v || !Number.isFinite(v)) return v;
    // wrap to 32/16-bit like q
    if (rt === 6) { const w = v | 0; return w === -2147483648 ? NaN : w; }
    const w = (v << 16) >> 16;
    return w === -32768 ? NaN : w;
  }
  if (rt === 1) return v ? 1 : 0;
  if (rt === 4) return ((v % 256) + 256) % 256;
  return v;
}

function va(op: NumOp, v: QVec, a: QAtom, atomLeft: boolean): QValue {
  const tv = v.t, ta = -a.t;
  const n = v.d.length;
  if (isStrType(tv) || isStrType(ta)) {
    if (op.bool || op.s) {
      const k = atomLeft ? strKern(op, ta, tv) : strKern(op, tv, ta);
      const d = v.d as any;
      if (op.bool) {
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) out[i] = (atomLeft ? k(a.v, d[i]) : k(d[i], a.v)) ? 1 : 0;
        return vec(1, out);
      }
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = atomLeft ? k(a.v, d[i]) : k(d[i], a.v);
      return tv === 10 ? vec(10, out.join("")) : vec(tv, out);
    }
    // char arithmetic
    const rt = atomLeft ? numType(op, ta, tv) : numType(op, tv, ta);
    const av = ta === 10 ? a.v.charCodeAt(0) : a.v;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const e = tv === 10 ? (v.d as string).charCodeAt(i) : v.d[i];
      out[i] = fix(rt, atomLeft ? op.f(av, e) : op.f(e, av));
    }
    return vec(rt, out);
  }
  const d = v.d as Float64Array;
  const f = op.f;
  if (op.bool) {
    let av = a.v;
    let cv: ((x: number) => number) | null = null;
    if (tv !== ta && isTemporal(tv) && isTemporal(ta)) {
      const [ua, ub] = [UNIT[ta], UNIT[tv]];
      if ((ta === 13) !== (tv === 13)) throw typeErr(`${op.name} can't compare ${TYPE_NAMES[ta]} with ${TYPE_NAMES[tv]}.`);
      if (ua && ub) { av = av * ua; cv = (x) => x * ub; }
    }
    const out = new Float64Array(n);
    if (cv) for (let i = 0; i < n; i++) out[i] = (atomLeft ? f(av, cv(d[i])) : f(cv(d[i]), av)) ? 1 : 0;
    else if (atomLeft) for (let i = 0; i < n; i++) out[i] = f(av, d[i]) ? 1 : 0;
    else for (let i = 0; i < n; i++) out[i] = f(d[i], av) ? 1 : 0;
    return vec(1, out);
  }
  const rt = atomLeft ? numType(op, ta, tv) : numType(op, tv, ta);
  let av = a.v;
  const ca = conv(ta, rt);
  if (ca) av = ca(av);
  const cvv = conv(tv, rt);
  const out = new Float64Array(n);
  if (cvv) {
    for (let i = 0; i < n; i++) out[i] = atomLeft ? f(av, cvv(d[i])) : f(cvv(d[i]), av);
  } else if (atomLeft) {
    for (let i = 0; i < n; i++) out[i] = f(av, d[i]);
  } else {
    for (let i = 0; i < n; i++) out[i] = f(d[i], av);
  }
  if (rt === 8 || rt === 6 || rt === 5 || rt === 1 || rt === 4) for (let i = 0; i < n; i++) out[i] = fix(rt, out[i]);
  return vec(rt, out);
}

function vv(op: NumOp, x: QVec, y: QVec): QValue {
  const n = x.d.length;
  if (n !== y.d.length) throw lengthErr(`${op.name}: left has ${n} items, right has ${y.d.length}.`);
  const tx = x.t, ty = y.t;
  if (isStrType(tx) || isStrType(ty)) {
    if (op.bool || op.s) {
      const k = strKern(op, tx, ty);
      const a = x.d as any, b = y.d as any;
      if (op.bool) {
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) out[i] = k(a[i], b[i]) ? 1 : 0;
        return vec(1, out);
      }
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = k(a[i], b[i]);
      return tx === 10 ? vec(10, out.join("")) : vec(tx, out);
    }
    const rt = numType(op, tx, ty);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = tx === 10 ? (x.d as string).charCodeAt(i) : x.d[i];
      const b = ty === 10 ? (y.d as string).charCodeAt(i) : y.d[i];
      out[i] = fix(rt, op.f(a, b));
    }
    return vec(rt, out);
  }
  const a = x.d as Float64Array, b = y.d as Float64Array;
  const f = op.f;
  if (op.bool) {
    const out = new Float64Array(n);
    if (tx !== ty && isTemporal(tx) && isTemporal(ty) && UNIT[tx] && UNIT[ty]) {
      const ua = UNIT[tx], ub = UNIT[ty];
      for (let i = 0; i < n; i++) out[i] = f(a[i] * ua, b[i] * ub) ? 1 : 0;
    } else for (let i = 0; i < n; i++) out[i] = f(a[i], b[i]) ? 1 : 0;
    return vec(1, out);
  }
  const rt = numType(op, tx, ty);
  const ca = conv(tx, rt), cb = conv(ty, rt);
  const out = new Float64Array(n);
  if (ca || cb) {
    for (let i = 0; i < n; i++) out[i] = f(ca ? ca(a[i]) : a[i], cb ? cb(b[i]) : b[i]);
  } else {
    for (let i = 0; i < n; i++) out[i] = f(a[i], b[i]);
  }
  if (rt === 8 || rt === 6 || rt === 5 || rt === 1 || rt === 4) for (let i = 0; i < n; i++) out[i] = fix(rt, out[i]);
  return vec(rt, out);
}

function dictOp(op: NumOp, x: QValue, y: QValue): QValue {
  if (x instanceof QDict && y instanceof QDict) {
    if (isKeyed(x) || isKeyed(y)) return keyedOp(op, x, y);
    // align on keys: union of keys, missing side contributes as-is
    const kx = items(x.k), ky = items(y.k);
    const vx = items(x.v), vy = items(y.v);
    const keys: QValue[] = [...kx];
    const vals: QValue[] = [...vx];
    for (let j = 0; j < ky.length; j++) {
      const i = keys.findIndex((k) => matchScalar(k, ky[j]));
      if (i >= 0) vals[i] = atomic2(op, vals[i], vy[j]);
      else {
        keys.push(ky[j]);
        vals.push(vy[j]);
      }
    }
    return dict(fromItems(keys), fromItems(vals));
  }
  if (x instanceof QDict) return dict(x.k, atomic2(op, x.v, y));
  const yd = y as QDict;
  return dict(yd.k, atomic2(op, x, yd.v));
}

function keyedOp(op: NumOp, x: QValue, y: QValue): QValue {
  if (x instanceof QDict && isKeyed(x) && !(y instanceof QDict)) return dict(x.k, atomic2(op, x.v, y));
  if (y instanceof QDict && isKeyed(y) && !(x instanceof QDict)) return dict(y.k, atomic2(op, x, y.v));
  throw typeErr(`${op.name} on two keyed tables is not supported.`);
}

function tableOp(op: NumOp, x: QValue, y: QValue): QValue {
  if (x instanceof QTable && y instanceof QTable) {
    if (x.cols.length !== y.cols.length || x.cols.some((c, i) => c !== y.cols[i])) throw new QError("mismatch", "Tables have different columns.");
    return table(x.cols, x.data.map((c, i) => atomic2(op, c, y.data[i])));
  }
  if (x instanceof QTable) {
    if (y instanceof QVec && y.d.length !== x.n) throw lengthErr();
    return table(x.cols, x.data.map((c) => atomic2(op, c, y)));
  }
  const yt = y as QTable;
  return table(yt.cols, yt.data.map((c) => atomic2(op, x, c)));
}

function matchScalar(a: QValue, b: QValue): boolean {
  if (a instanceof QAtom && b instanceof QAtom) return a.t === b.t && (a.v === b.v || (a.v !== a.v && b.v !== b.v));
  return false;
}

// ---------- monadic atomic ----------
export function atomic1(name: string, x: QValue, f: (v: number) => number, rtype: (t: number) => number): QValue {
  if (x instanceof QAtom) {
    const t = -x.t;
    if (t === 10 || t === 11 || t === 2) throw typeErr(`${name} needs numbers, got a ${TYPE_NAMES[t]}.`);
    const rt = rtype(t);
    if (rt < 0) throw typeErr(`${name} doesn't accept a ${TYPE_NAMES[t]}.`);
    return atom(-rt, fix(rt, f(x.v)));
  }
  if (x instanceof QVec) {
    if (x.t === 0) return fromItems((x.d as QValue[]).map((e) => atomic1(name, e, f, rtype)));
    const t = x.t;
    if (t === 10 || t === 11 || t === 2) throw typeErr(`${name} needs numbers, got a ${TYPE_NAMES[t]} vector.`);
    const rt = rtype(t);
    if (rt < 0) throw typeErr(`${name} doesn't accept ${TYPE_NAMES[t]} values.`);
    const d = x.d as Float64Array;
    const out = new Float64Array(d.length);
    for (let i = 0; i < d.length; i++) out[i] = f(d[i]);
    if (rt === 8 || rt === 6 || rt === 5 || rt === 1 || rt === 4) for (let i = 0; i < d.length; i++) out[i] = fix(rt, out[i]);
    return vec(rt, out);
  }
  if (x instanceof QTable) return table(x.cols, x.data.map((c) => atomic1(name, c, f, rtype)));
  if (x instanceof QDict) return dict(x.k, atomic1(name, x.v, f, rtype));
  throw typeErr(`${name} can't be applied to a function.`);
}

export { list };
