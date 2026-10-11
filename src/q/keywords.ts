import { atomic1, atomic2, NumOp } from "./atomic";
import { QError, domainErr, lengthErr, rankErr, typeErr } from "./errors";
import { Builtin, Derived } from "./fns";
import { RT } from "./rt";
import { stringOf } from "./cast";
import {
  BUILTINS, GLYPHS, OPS, add, cmpValues, countOf, cut, distinct, drop, enlist, eq, fill, find, first, flip, gradeDown,
  gradeUp, group, iasc, idesc, inList, join, keyOf, keyOfValue, last, matchValues, mkDict, mul, neg, not, nullMask, pick,
  reciprocal, reverse, roll, sub, take, til, trap, typeVerb, unkey, upsertKeyed, valueOf, vmax, vmin, where, floorV, fdiv,
  identityFor,
} from "./verbs";
import {
  NIL, QAtom, QDict, QFn, QTable, QValue, QVec, TYPE_NAMES, atom, bool, bools, count, dict, emptyList, floats, fromItems,
  isKeyed, item, items, list, list2vec, long, longs, nullItem, nullLike, nullOf, str, sym, syms, table, typeOf, vec, isNullAtom,
} from "./value";
import { nowTimestamp, NS_PER_DAY } from "./temporal";
import { lj, ij, uj, pj, aj, ej, xkey, xcol, xcols, xasc, xdesc, ungroup, xgroup, meta, insert, upsert, colsOf, keysOf } from "./tables";

const def = (name: string, rank: number, impl: (...a: QValue[]) => QValue) => {
  const b =
    rank === 1
      ? new Builtin(name, 1, impl as (x: QValue) => QValue)
      : rank === 2
        ? new Builtin(name, 2, undefined, impl as (x: QValue, y: QValue) => QValue)
        : new Builtin(name, rank, undefined, undefined, (a) => impl(...a));
  BUILTINS.set(name, b);
  return b;
};

// ---------- numeric vector helpers ----------
const numVec = (x: QValue): Float64Array | null => (x instanceof QVec && x.t > 0 && x.t !== 10 && x.t !== 11 && x.t !== 2 ? (x.d as Float64Array) : null);

const sumType = (t: number) => (t === 1 || t === 4 || t === 5 || t === 6 ? 6 : t);

function aggregate(name: string, x: QValue, simple: (d: Float64Array, t: number) => QValue, general: (its: QValue[]) => QValue): QValue {
  if (x instanceof QAtom) return simple(Float64Array.of(x.v), -x.t);
  if (x instanceof QDict) {
    if (isKeyed(x)) return aggregate(name, x.v, simple, general);
    return aggregate(name, x.v, simple, general);
  }
  if (x instanceof QTable) return dict(syms(x.cols), fromItems(x.data.map((c) => aggregate(name, c, simple, general))));
  const d = numVec(x);
  if (d) return simple(d, (x as QVec).t);
  if (x instanceof QVec && x.t === 0) return general(x.d as QValue[]);
  if (x instanceof QVec && (x.t === 11 || x.t === 10)) {
    if (name === "max" || name === "min") {
      const s = x.t === 10 ? Array.from(x.d as string) : (x.d as string[]);
      if (!s.length) return x.t === 10 ? atom(-10, " ") : sym("");
      const r = s.reduce((a, b) => (name === "max" ? (b > a ? b : a) : b < a ? b : a));
      return atom(-x.t, r);
    }
  }
  throw typeErr(`${name} needs numbers, got ${TYPE_NAMES[typeOf(x)] ?? "data"}.`);
}

const sum = (x: QValue) =>
  aggregate("sum", x, (d, t) => {
    let s = 0;
    for (let i = 0; i < d.length; i++) if (d[i] === d[i]) s += d[i];
    const rt = sumType(t);
    return atom(-rt, rt === 8 ? Math.fround(s) : s);
  }, (its) => (its.length ? its.reduce((a, b) => add(a, b)) : emptyList()));

const prd = (x: QValue) =>
  aggregate("prd", x, (d, t) => {
    let s = 1;
    for (let i = 0; i < d.length; i++) if (d[i] === d[i]) s *= d[i];
    return atom(-sumType(t), s);
  }, (its) => (its.length ? its.reduce((a, b) => mul(a, b)) : emptyList()));

const max = (x: QValue) =>
  aggregate("max", x, (d, t) => {
    let m = -Infinity;
    for (let i = 0; i < d.length; i++) if (d[i] > m) m = d[i];
    if (t === 1) return atom(-1, m === -Infinity ? 0 : m);
    return atom(-t, m);
  }, (its) => (its.length ? its.reduce((a, b) => vmax(a, b)) : atom(-7, -Infinity)));

const min = (x: QValue) =>
  aggregate("min", x, (d, t) => {
    let m = Infinity;
    for (let i = 0; i < d.length; i++) if (d[i] < m) m = d[i];
    if (t === 1) return atom(-1, m === Infinity ? 1 : m);
    return atom(-t, m);
  }, (its) => (its.length ? its.reduce((a, b) => vmin(a, b)) : atom(-7, Infinity)));

const avg = (x: QValue) =>
  aggregate("avg", x, (d) => {
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i++) if (d[i] === d[i]) { s += d[i]; n++; }
    return atom(-9, n ? s / n : NaN);
  }, (its) => (its.length ? fdiv(its.reduce((a, b) => add(a, b)), long(its.length)) : atom(-9, NaN)));

function running(name: string, x: QValue, f: (acc: number, v: number, i: number) => number, rtype: (t: number) => number, gen: (a: QValue, b: QValue) => QValue): QValue {
  if (x instanceof QAtom) return x;
  if (x instanceof QDict) return dict(x.k, running(name, x.v, f, rtype, gen));
  if (x instanceof QTable) return table(x.cols, x.data.map((c) => running(name, c, f, rtype, gen)));
  const d = numVec(x);
  if (d) {
    const out = new Float64Array(d.length);
    let acc = NaN;
    for (let i = 0; i < d.length; i++) out[i] = acc = i === 0 ? f(NaN, d[0], 0) : f(acc, d[i], i);
    return vec(rtype((x as QVec).t), out);
  }
  if (x instanceof QVec && x.t === 0) {
    const its = x.d as QValue[];
    const out: QValue[] = [];
    let acc: QValue | null = null;
    for (const e of its) out.push((acc = acc === null ? e : gen(acc, e)));
    return fromItems(out);
  }
  throw typeErr(`${name} needs numbers.`);
}

const z = (v: number) => (v !== v ? 0 : v);

const sums = (x: QValue) => running("sums", x, (a, v, i) => (i === 0 ? z(v) : a + z(v)), sumType, add);
const prds = (x: QValue) => running("prds", x, (a, v, i) => (i === 0 ? (v !== v ? 1 : v) : a * (v !== v ? 1 : v)), sumType, mul);
const maxs = (x: QValue) => running("maxs", x, (a, v, i) => (i === 0 ? v : v !== v ? a : a !== a || v > a ? v : a), (t) => t, vmax);
const mins = (x: QValue) => running("mins", x, (a, v, i) => (i === 0 ? v : a !== a ? a : v !== v ? v : v < a ? v : a), (t) => t, vmin);

function avgs(x: QValue): QValue {
  if (x instanceof QTable) return table(x.cols, x.data.map(avgs));
  if (x instanceof QDict) return dict(x.k, avgs(x.v));
  const d = numVec(x);
  if (!d) throw typeErr("avgs needs numbers.");
  const out = new Float64Array(d.length);
  let s = 0, n = 0;
  for (let i = 0; i < d.length; i++) {
    if (d[i] === d[i]) { s += d[i]; n++; }
    out[i] = n ? s / n : NaN;
  }
  return vec(9, out);
}

function priorOp(x: QValue, f: (cur: QValue, prev: QValue) => QValue, firstItem: (v: QValue) => QValue): QValue {
  if (x instanceof QAtom) return firstItem(x);
  if (x instanceof QDict) return dict(x.k, priorOp(x.v, f, firstItem));
  if (x instanceof QTable) return table(x.cols, x.data.map((c) => priorOp(c, f, firstItem)));
  const n = count(x);
  if (!n) return x;
  const prev = pick(x, [0, ...Array.from({ length: n - 1 }, (_, i) => i)]);
  const r = f(x, prev);
  // replace first item
  return RT.apply(GLYPHS.get("@")!, [r, long(0), GLYPHS.get(":")!, firstItem(items(x)[0])] as any) ?? r;
}

function deltas(x: QValue): QValue {
  if (x instanceof QAtom) return x;
  if (x instanceof QDict) return dict(x.k, deltas(x.v));
  if (x instanceof QTable) return table(x.cols, x.data.map(deltas));
  const d = numVec(x);
  if (d) {
    const t = (x as QVec).t;
    const rt = t >= 12 ? (t === 14 || t === 13 ? 6 : t === 12 ? 16 : t === 15 ? 9 : t) : sumType(t);
    const out = new Float64Array(d.length);
    for (let i = 0; i < d.length; i++) out[i] = i === 0 ? d[0] : d[i] - d[i - 1];
    return vec(rt, out);
  }
  const its = items(x);
  return fromItems(its.map((e, i) => (i === 0 ? e : sub(e, its[i - 1]))));
}

function ratios(x: QValue): QValue {
  const d = numVec(x);
  if (d) {
    const out = new Float64Array(d.length);
    for (let i = 0; i < d.length; i++) out[i] = i === 0 ? d[0] : d[i] / d[i - 1];
    return vec(9, out);
  }
  const its = items(x);
  return fromItems(its.map((e, i) => (i === 0 ? e : fdiv(e, its[i - 1]))));
}

function differ(x: QValue): QValue {
  const its = items(x);
  return bools(its.map((e, i) => (i === 0 ? 1 : matchValues(e, its[i - 1]) ? 0 : 1)));
}

function shift(n: number, x: QValue): QValue {
  if (x instanceof QTable) return table(x.cols, x.data.map((c) => shift(n, c)));
  if (x instanceof QDict) return dict(x.k, shift(n, x.v));
  const len = count(x);
  const idx = new Float64Array(len);
  for (let i = 0; i < len; i++) idx[i] = i - n;
  return RT.apply(x, [vec(7, idx)]);
}

function fills(x: QValue): QValue {
  if (x instanceof QTable) return table(x.cols, x.data.map(fills));
  if (x instanceof QDict) return dict(x.k, fills(x.v));
  if (x instanceof QVec && x.t > 0) {
    const mask = (nullMask(x) as QVec).d as Float64Array;
    const d = x.t === 10 ? Array.from(x.d as string) : (x.d as any).slice();
    for (let i = 1; i < d.length; i++) if (mask[i]) d[i] = d[i - 1];
    return x.t === 10 ? str(d.join("")) : vec(x.t, d);
  }
  const its = [...items(x)];
  for (let i = 1; i < its.length; i++) if (its[i] instanceof QAtom && isNullAtom(its[i] as QAtom)) its[i] = its[i - 1];
  return fromItems(its);
}

// statistics
function toNums(x: QValue, name: string): Float64Array {
  const d = numVec(x);
  if (!d) throw typeErr(`${name} needs a numeric list.`);
  return d;
}
function variance(x: QValue, sample: boolean): number {
  const d = [...toNums(x, "var")].filter((v) => v === v);
  const n = d.length;
  if (n - (sample ? 1 : 0) <= 0) return NaN;
  const m = d.reduce((a, b) => a + b, 0) / n;
  return d.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - (sample ? 1 : 0));
}
function covariance(x: QValue, y: QValue, sample: boolean): number {
  const a = toNums(x, "cov"), b = toNums(y, "cov");
  if (a.length !== b.length) throw lengthErr();
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (n - (sample ? 1 : 0));
}
function med(x: QValue): QValue {
  if (x instanceof QTable) return dict(syms(x.cols), fromItems(x.data.map(med)));
  const d = [...toNums(x, "med")].filter((v) => v === v).sort((a, b) => a - b);
  if (!d.length) return atom(-9, NaN);
  const m = d.length >> 1;
  return atom(-9, d.length % 2 ? d[m] : (d[m - 1] + d[m]) / 2);
}

function moving(name: string, nv: QValue, x: QValue, f: (w: number[]) => number, rt: (t: number) => number): QValue {
  if (!(nv instanceof QAtom) || typeof nv.v !== "number") throw typeErr(`${name} needs a window size on the left.`);
  const n = nv.v;
  if (x instanceof QTable) return table(x.cols, x.data.map((c) => moving(name, nv, c, f, rt)));
  const d = toNums(x, name);
  const out = new Float64Array(d.length);
  for (let i = 0; i < d.length; i++) {
    const w: number[] = [];
    for (let j = Math.max(0, i - n + 1); j <= i; j++) w.push(d[j]);
    out[i] = f(w);
  }
  return vec(rt((x as QVec).t), out);
}
const nn = (w: number[]) => w.filter((v) => v === v);

// ---------- matrices ----------
function toMatrix(x: QValue, name: string): number[][] {
  if (x instanceof QVec && x.t === 0) return (x.d as QValue[]).map((r) => Array.from(toNums(r, name)));
  if (x instanceof QVec && x.t > 0) return [Array.from(toNums(x, name))];
  throw typeErr(`${name} needs a matrix (a list of numeric rows).`);
}
const fromMatrix = (m: number[][]): QValue => list(m.map((r) => floats(r)));

function mmu(x: QValue, y: QValue): QValue {
  const xv = x instanceof QVec && x.t > 0, yv = y instanceof QVec && y.t > 0;
  if (xv && yv) {
    const a = toNums(x, "mmu"), b = toNums(y, "mmu");
    if (a.length !== b.length) throw lengthErr(`mmu: vector lengths differ (${a.length} vs ${b.length}).`);
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return atom(-9, s);
  }
  if (xv) {
    // vector x matrix
    const a = toNums(x, "mmu");
    const B = toMatrix(y, "mmu");
    if (B.length !== a.length) throw lengthErr(`mmu: vector has ${a.length} items but matrix has ${B.length} rows.`);
    const out = new Float64Array(B[0]?.length ?? 0);
    for (let i = 0; i < B.length; i++) for (let j = 0; j < out.length; j++) out[j] += a[i] * B[i][j];
    return floats(out);
  }
  const A = toMatrix(x, "mmu");
  if (yv) {
    const b = toNums(y, "mmu");
    return floats(A.map((r) => {
      if (r.length !== b.length) throw lengthErr(`mmu: matrix rows have ${r.length} columns but vector has ${b.length} items.`);
      let s = 0;
      for (let i = 0; i < r.length; i++) s += r[i] * b[i];
      return s;
    }));
  }
  const B = toMatrix(y, "mmu");
  const k = B.length;
  if (A.some((r) => r.length !== k)) throw lengthErr(`mmu: left matrix has ${A[0]?.length} columns but right has ${k} rows.`);
  const m = B[0]?.length ?? 0;
  return fromMatrix(A.map((r) => {
    const out = new Array(m).fill(0);
    for (let i = 0; i < k; i++) {
      const ri = r[i], Bi = B[i];
      for (let j = 0; j < m; j++) out[j] += ri * Bi[j];
    }
    return out;
  }));
}

function inv(x: QValue): QValue {
  const A = toMatrix(x, "inv").map((r) => [...r]);
  const n = A.length;
  if (A.some((r) => r.length !== n)) throw lengthErr("inv needs a square matrix.");
  const I = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-14) return fromMatrix(A.map((r) => r.map(() => NaN)));
    [A[c], A[p]] = [A[p], A[c]];
    [I[c], I[p]] = [I[p], I[c]];
    const pv = A[c][c];
    for (let j = 0; j < n; j++) { A[c][j] /= pv; I[c][j] /= pv; }
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = A[r][c];
      for (let j = 0; j < n; j++) { A[r][j] -= f * A[c][j]; I[r][j] -= f * I[c][j]; }
    }
  }
  return fromMatrix(I);
}

// ---------- strings ----------
function likeMatch(s: string, pat: string): boolean {
  let re = "^";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else if (c === "[") {
      const j = pat.indexOf("]", i);
      if (j < 0) { re += "\\["; continue; }
      let body = pat.slice(i + 1, j);
      if (body[0] === "^") body = "^" + body.slice(1).replace(/[\\\]]/g, "\\$&");
      else body = body.replace(/[\\\]]/g, "\\$&");
      re += "[" + body + "]";
      i = j;
    } else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(re + "$", "s").test(s);
}

const asText = (x: QValue): string | null => {
  if (x instanceof QVec && x.t === 10) return x.d;
  if (x instanceof QAtom && (x.t === -10 || x.t === -11)) return x.v;
  return null;
};

function like(x: QValue, p: QValue): QValue {
  const pat = asText(p);
  if (pat === null) throw typeErr("like needs a pattern string on the right, like \"a*\".");
  const s = asText(x);
  if (s !== null && !(x instanceof QVec && x.t === 11)) return bool(likeMatch(s, pat));
  if (x instanceof QVec && x.t === 11) return bools((x.d as string[]).map((e) => (likeMatch(e, pat) ? 1 : 0)));
  if (x instanceof QVec && x.t === 0) return fromItems((x.d as QValue[]).map((e) => like(e, p)));
  if (x instanceof QDict) return dict(x.k, like(x.v, p));
  throw typeErr("like needs strings or symbols on the left.");
}

function ss(x: QValue, y: QValue): QValue {
  const s = asText(x), p = asText(y);
  if (s === null || p === null) throw typeErr("ss needs two strings.");
  const out: number[] = [];
  if (p.includes("*") || p.includes("?") || p.includes("[")) {
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j <= s.length; j++) if (likeMatch(s.slice(i, j), p)) { out.push(i); break; }
  } else {
    let i = s.indexOf(p);
    // q reports overlapping matches: "aaa" ss "aa" is 0 1, not just 0.
    // Assumption from the public q reference for ss (code.kx.com/q/ref/ss/), not a fresh KDB-X run.
    while (i >= 0 && p.length) {
      out.push(i);
      i = s.indexOf(p, i + 1);
    }
  }
  return longs(out);
}

function ssr(x: QValue, y: QValue, z: QValue): QValue {
  const s = asText(x), p = asText(y);
  if (s === null || p === null) throw typeErr("ssr needs strings.");
  if (z instanceof QFn) {
    return str(s.split(p).reduce((acc, part, i) => (i === 0 ? part : acc + asText(RT.apply(z, [str(p)])) + part), ""));
  }
  const r = asText(z);
  if (r === null) throw typeErr("ssr replacement must be a string.");
  return str(s.split(p).join(r));
}

// Short (16) and int (32) match the examples on code.kx.com/q/ref/vs/.
// Long (64) and byte (8) are the widths of those q types. Not re-recorded from KDB-X.
const BIT_WIDTH: Record<number, number> = { 4: 8, 5: 16, 6: 32, 7: 64 };

function bitsOf(v: number, width: number): Float64Array {
  const mask = (1n << BigInt(width)) - 1n;
  let n = BigInt(Math.trunc(v)) & mask;
  const out = new Float64Array(width);
  for (let i = width - 1; i >= 0; i--) {
    out[i] = Number(n & 1n);
    n >>= 1n;
  }
  return out;
}

function vs(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && typeof x.v === "number" && x.t !== -9) {
    // 0b vs n is the bit pattern, not base 0. A base below 2 never finishes
    // (n % 1 stays 0 and n / 1 does not shrink), which used to freeze the tab.
    if (x.t === -1 && x.v === 0) {
      if (!(y instanceof QAtom) || typeof y.v !== "number") throw typeErr("0b vs needs an integer on the right.");
      const width = BIT_WIDTH[-y.t];
      if (!width) throw typeErr("0b vs needs a byte, short, int or long.");
      return vec(1, bitsOf(y.v, width));
    }
    const base = x.v;
    if (!Number.isInteger(base) || base < 2) throw domainErr("vs needs a base of 2 or more. 0b vs n is the bits of an integer.");
    const enc = (v: number) => {
      const digits: number[] = [];
      if (v === 0) return [0];
      while (v > 0) { digits.unshift(v % base); v = Math.floor(v / base); }
      return digits;
    };
    if (y instanceof QAtom) return vec(-y.t === 1 ? 1 : 7, Float64Array.from(enc(y.v)));
    throw typeErr();
  }
  if (x instanceof QVec && x.t > 0 && x.t !== 10 && x.t !== 11) {
    // mixed radix
    const radix = Array.from(x.d as Float64Array);
    const enc = (v: number) => {
      const out = new Array(radix.length).fill(0);
      for (let i = radix.length - 1; i >= 0; i--) { out[i] = v % radix[i]; v = Math.floor(v / radix[i]); }
      return out;
    };
    if (y instanceof QAtom) return longs(enc(y.v));
    return flip(list(items(y).map((e) => longs(enc((e as QAtom).v)))));
  }
  if (x instanceof QAtom && x.t === -11 && x.v === "") {
    // Empty symbol. Cited from code.kx.com/q/ref/vs/, not a fresh KDB-X run:
    // a string splits on newlines (a trailing break is dropped); a symbol
    // splits on "."; a file handle splits into directory and file.
    if (y instanceof QAtom && y.t === -11) {
      const s = String(y.v);
      if (s.startsWith(":")) {
        const i = s.lastIndexOf("/");
        return i >= 0 ? syms([s.slice(0, i), s.slice(i + 1)]) : syms([s]);
      }
      return syms(s.length ? s.split(".") : [""]);
    }
    const s = asText(y);
    if (s === null) throw typeErr("` vs needs a string or a symbol on the right.");
    const parts = s.split(/\r\n|\n/);
    if (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
    return list(parts.map((p) => str(p)));
  }
  const sep = asText(x), s = asText(y);
  if (sep === null) throw typeErr("vs needs a separator on the left, like \",\" vs \"a,b\".");
  if (s === null) {
    if (y instanceof QVec && y.t === 0) return list((y.d as QValue[]).map((e) => vs(x, e)));
    throw typeErr("vs needs a string on the right.");
  }
  return list(s.split(sep).map((p) => str(p)));
}

function sv(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && typeof x.v === "number" && x.t !== -9) {
    const base = x.v;
    const d = y instanceof QVec ? Array.from((y.d as Float64Array)) : [];
    return long(d.reduce((a, b) => a * base + b, 0));
  }
  if (x instanceof QVec && x.t > 0 && x.t !== 10 && x.t !== 11) {
    const radix = Array.from(x.d as Float64Array);
    const d = Array.from(((y as QVec).d as Float64Array));
    let v = 0;
    for (let i = 0; i < radix.length; i++) v = v * radix[i] + d[i];
    return long(v);
  }
  if (x instanceof QAtom && x.t === -11) {
    if (x.v === "" && y instanceof QVec && y.t === 11) {
      const parts = y.d as string[];
      if (parts[0]?.startsWith(":")) return sym(parts.join("/"));
      return sym(parts.join("."));
    }
  }
  const sep = asText(x);
  if (sep === null) throw typeErr("sv needs a separator on the left, like \",\" sv (\"a\";\"b\").");
  if (y instanceof QVec && y.t === 0) return str((y.d as QValue[]).map((e) => asText(e) ?? "").join(sep));
  if (y instanceof QVec && y.t === 11) return str((y.d as string[]).join(sep));
  throw typeErr("sv needs a list of strings on the right.");
}

const mapStr = (name: string, f: (s: string) => string) => (x: QValue): QValue => {
  if (x instanceof QVec && x.t === 10) return str(f(x.d as string));
  if (x instanceof QAtom && x.t === -10) return atom(-10, f(x.v));
  if (x instanceof QAtom && x.t === -11) return sym(f(x.v));
  if (x instanceof QVec && x.t === 11) return syms((x.d as string[]).map(f));
  if (x instanceof QVec && x.t === 0) return list((x.d as QValue[]).map(mapStr(name, f)));
  if (x instanceof QDict) return dict(x.k, mapStr(name, f)(x.v));
  if (x instanceof QTable) return table(x.cols, x.data.map(mapStr(name, f)));
  throw typeErr(`${name} needs strings or symbols.`);
};

// ---------- set ops ----------
function except(x: QValue, y: QValue): QValue {
  const drop = new Set((y instanceof QAtom ? [y] : items(y)).map(keyOf));
  const its = items(x);
  const idx: number[] = [];
  its.forEach((e, i) => !drop.has(keyOf(e)) && idx.push(i));
  return pick(x, idx);
}
function inter(x: QValue, y: QValue): QValue {
  const keep = new Set(items(y).map(keyOf));
  const idx: number[] = [];
  items(x).forEach((e, i) => keep.has(keyOf(e)) && idx.push(i));
  return pick(x, idx);
}
function union(x: QValue, y: QValue): QValue {
  return distinct(join(x, y));
}

function cross(x: QValue, y: QValue): QValue {
  if (x instanceof QTable && y instanceof QTable) {
    const nx = x.n, ny = y.n;
    const ix: number[] = [], iy: number[] = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { ix.push(i); iy.push(j); }
    return table([...x.cols, ...y.cols], [...x.data.map((c) => pick(c, ix)), ...y.data.map((c) => pick(c, iy))]);
  }
  const a = x instanceof QAtom ? [x] : items(x), b = y instanceof QAtom ? [y] : items(y);
  const out: QValue[] = [];
  for (const e of a) for (const f of b) out.push(join(e, f));
  return fromItems(out);
}

// ---------- search ----------
function bin(x: QValue, y: QValue, right: boolean): QValue {
  if (x instanceof QAtom) throw typeErr("bin needs a sorted list on the left, e.g. 1 3 5 bin 4.");
  const its = items(x);
  const one = (v: QValue) => {
    let lo = 0, hi = its.length - 1, r = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = cmpValues(its[mid], v);
      if (right ? c < 0 : c <= 0) { r = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return right ? r + 1 : r;
  };
  if (y instanceof QAtom) return long(one(y));
  if (x instanceof QVec && x.t > 0 && y instanceof QVec && y.t === x.t) return longs(items(y).map(one));
  return longs(items(y).map(one));
}

function within(x: QValue, y: QValue): QValue {
  const [lo, hi] = items(y);
  if (lo === undefined || hi === undefined) throw lengthErr("within needs a (low;high) pair on the right.");
  const ge = not(atomic2(OPS.lt, x, lo));
  const le = not(atomic2(OPS.gt, x, hi));
  return atomic2(OPS.min, ge, le);
}

function xbar(x: QValue, y: QValue): QValue {
  const bucket = (b: number, v: number) => b * Math.floor(v / b + 1e-12);
  return atomic2({ name: "xbar", f: bucket, tt: "*" } as NumOp, x, y) as QValue;
}

function rotate(x: QValue, y: QValue): QValue {
  if (!(x instanceof QAtom) || typeof x.v !== "number") throw typeErr("rotate needs a count on the left.");
  if (y instanceof QAtom) return y;
  const n = count(y);
  if (!n) return y;
  const k = ((x.v % n) + n) % n;
  return pick(y, Array.from({ length: n }, (_, i) => (i + k) % n));
}

function sublist(x: QValue, y: QValue): QValue {
  const n = count(y);
  if (x instanceof QAtom) return x.v >= 0 ? take(Math.min(x.v, n), y) : take(-Math.min(-x.v, n), y);
  const [s, l] = Array.from((x as QVec).d as Float64Array);
  const start = Math.min(s, n);
  const len = Math.min(l, n - start);
  return pick(y, Array.from({ length: len }, (_, i) => start + i));
}

function rank(x: QValue): QValue {
  const g = gradeUp(x);
  const out = new Float64Array(g.length);
  g.forEach((idx, r) => (out[idx] = r));
  return vec(7, out);
}

function xrank(x: QValue, y: QValue): QValue {
  const n = (x as QAtom).v;
  const r = rank(y) as QVec;
  const c = count(y);
  return vec(7, (r.d as Float64Array).map((v) => Math.floor((v * n) / c)));
}

// ---------- misc ----------
function raze(x: QValue): QValue {
  if (x instanceof QAtom) return enlist(x);
  if (x instanceof QDict) return raze(x.v);
  if (x instanceof QVec && x.t === 0) {
    const its = x.d as QValue[];
    if (!its.length) return x;
    return its.reduce((a, b) => join(a, b));
  }
  return x;
}

function attr(x: QValue): QValue {
  return sym(x instanceof QVec ? x.attr : "");
}

function applyAttr(a: string, x: QValue): QValue {
  if (!(x instanceof QVec)) {
    if (x instanceof QTable) return x;
    throw typeErr("Attributes apply to lists.");
  }
  if (a === "s") {
    const g = gradeUp(x);
    for (let i = 0; i < g.length; i++) if (g[i] !== i) throw new QError("s-fail", "`s# needs the list to be sorted already.");
  }
  if (a === "u") {
    if (count(distinct(x)) !== x.d.length) throw new QError("u-fail", "`u# needs every item to be unique.");
  }
  const v = new QVec(x.t, x.d);
  v.attr = a === "" ? "" : a;
  return v;
}

function asc(x: QValue): QValue {
  if (x instanceof QDict && !isKeyed(x)) {
    const g = gradeUp(x.v);
    return dict(pick(x.k, g), applyAttr("s", pick(x.v, g)));
  }
  if (x instanceof QTable) return xasc(syms(x.cols), x);
  const r = pick(x, gradeUp(x));
  return r instanceof QVec ? applyAttr("s", r) : r;
}
function desc(x: QValue): QValue {
  if (x instanceof QDict && !isKeyed(x)) {
    const g = gradeDown(x.v);
    return dict(pick(x.k, g), pick(x.v, g));
  }
  if (x instanceof QTable) return xdesc(syms(x.cols), x);
  return pick(x, gradeDown(x));
}

function all(x: QValue): QValue {
  if (x instanceof QAtom) return bool(x.v !== 0);
  if (x instanceof QDict) return all(x.v);
  const d = numVec(x);
  if (d) { for (let i = 0; i < d.length; i++) if (d[i] === 0) return bool(0); return bool(1); }
  if (x instanceof QVec && x.t === 0) return bool((x.d as QValue[]).every((e) => (all(e) as QAtom).v));
  throw typeErr("all needs booleans or numbers.");
}
function any(x: QValue): QValue {
  if (x instanceof QAtom) return bool(x.v !== 0);
  if (x instanceof QDict) return any(x.v);
  const d = numVec(x);
  if (d) { for (let i = 0; i < d.length; i++) if (d[i] !== 0 && d[i] === d[i]) return bool(1); return bool(0); }
  if (x instanceof QVec && x.t === 0) return bool((x.d as QValue[]).some((e) => (any(e) as QAtom).v));
  throw typeErr("any needs booleans or numbers.");
}

function show(x: QValue): QValue {
  RT.stdout(RT.show(x));
  return NIL;
}

function fby(x: QValue, g: QValue): QValue {
  const [f, vals] = items(x);
  const grp = group(g) as QDict;
  const out = new Array<QValue>(count(g));
  const gi = items(grp.v);
  for (const idx of gi) {
    const ix = Array.from((idx as QVec).d as Float64Array);
    const r = RT.apply(f, [pick(vals, ix)]);
    ix.forEach((i, j) => (out[i] = r instanceof QAtom ? r : items(r)[j]));
  }
  return fromItems(out);
}

function ema(a: QValue, x: QValue): QValue {
  const d = toNums(x, "ema");
  const al = a instanceof QAtom ? () => a.v : (i: number) => ((a as QVec).d as Float64Array)[i];
  const out = new Float64Array(d.length);
  for (let i = 0; i < d.length; i++) out[i] = i === 0 ? d[0] : al(i) * d[i] + (1 - al(i)) * out[i - 1];
  return vec(9, out);
}

function lsq(x: QValue, y: QValue): QValue {
  // solve x = w mmu y for w (least squares): w = x mmu flip[y] mmu inv y mmu flip y
  const yt = flip(y);
  return mmu(mmu(x, yt), inv(mmu(y, yt)));
}

function getenv(x: QValue): QValue {
  return str("");
}

function system(x: QValue): QValue {
  const s = asText(x);
  if (s === null) throw typeErr("system needs a string, like system \"P 3\".");
  return RT.evalStr("\\" + s);
}

function tables(x: QValue): QValue {
  const ns = x instanceof QAtom && x.t === -11 ? x.v : "";
  return syms(RT.tables(ns));
}

function hsym(x: QValue): QValue {
  if (x instanceof QAtom && x.t === -11) return sym(x.v.startsWith(":") ? x.v : ":" + x.v);
  if (x instanceof QVec && x.t === 11) return syms((x.d as string[]).map((s) => (s.startsWith(":") ? s : ":" + s)));
  throw typeErr();
}

function getv(x: QValue): QValue {
  if (x instanceof QAtom && x.t === -11) return valueOf(x);
  return valueOf(x);
}
function setv(x: QValue, y: QValue): QValue {
  if (!(x instanceof QAtom) || x.t !== -11) throw typeErr("set needs a symbol name on the left, like `a set 5.");
  RT.setGlobal(x.v, y);
  return x;
}

function evalQ(x: QValue): QValue {
  if (x instanceof QVec && x.t === 10) return RT.evalStr(x.d);
  return valueOf(x);
}

function differFn(x: QValue) { return differ(x); }

function signum(x: QValue) {
  return atomic1("signum", x, (v) => (v !== v ? NaN : v > 0 ? 1 : v < 0 ? -1 : 0), () => 6);
}

const math = (name: string, f: (v: number) => number) => def(name, 1, (x) => atomic1(name, x, f, () => 9));

// ================= registration =================

def("abs", 1, (x) => atomic1("abs", x, Math.abs, (t) => (t === 1 || t === 4 ? 6 : t)));
math("sqrt", Math.sqrt);
math("exp", Math.exp);
math("log", Math.log);
math("sin", Math.sin);
math("cos", Math.cos);
math("tan", Math.tan);
math("asin", Math.asin);
math("acos", Math.acos);
math("atan", Math.atan);
def("floor", 1, floorV);
def("ceiling", 1, (x) => atomic1("ceiling", x, Math.ceil, (t) => (t === 9 || t === 8 ? 7 : t === 1 ? 6 : t)));
def("signum", 1, signum);
def("reciprocal", 1, reciprocal);
def("neg", 1, neg);
def("not", 1, not);
def("null", 1, nullMask);
def("xexp", 2, (x, y) => atomic2(OPS.xexp, x, y));
def("xlog", 2, (x, y) => atomic2({ name: "xexp", f: (a: number, b: number) => Math.log(b) / Math.log(a) }, x, y));
def("mod", 2, (x, y) => atomic2(OPS.mod, x, y));
def("div", 2, (x, y) => atomic2(OPS.idiv, x, y));
def("and", 2, vmin);
def("or", 2, vmax);

def("sum", 1, sum);
def("prd", 1, prd);
def("max", 1, max);
def("min", 1, min);
def("avg", 1, avg);
def("sums", 1, sums);
def("prds", 1, prds);
def("maxs", 1, maxs);
def("mins", 1, mins);
def("avgs", 1, avgs);
def("deltas", 1, deltas);
def("ratios", 1, ratios);
def("differ", 1, differFn);
def("prev", 1, (x) => shift(1, x));
def("next", 1, (x) => shift(-1, x));
def("xprev", 2, (n, x) => shift((n as QAtom).v, x));
def("fills", 1, fills);
def("var", 1, (x) => atom(-9, variance(x, false)));
def("svar", 1, (x) => atom(-9, variance(x, true)));
def("dev", 1, (x) => atom(-9, Math.sqrt(variance(x, false))));
def("sdev", 1, (x) => atom(-9, Math.sqrt(variance(x, true))));
def("med", 1, med);
def("cov", 2, (x, y) => atom(-9, covariance(x, y, false)));
def("scov", 2, (x, y) => atom(-9, covariance(x, y, true)));
def("cor", 2, (x, y) => atom(-9, covariance(x, y, false) / Math.sqrt(variance(x, false) * variance(y, false))));
def("wavg", 2, (w, x) => fdiv(sum(mul(w, x)), sum(w)));
def("wsum", 2, (w, x) => sum(mul(w, x)));
def("mavg", 2, (n, x) => moving("mavg", n, x, (w) => { const v = nn(w); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }, () => 9));
def("msum", 2, (n, x) => moving("msum", n, x, (w) => nn(w).reduce((a, b) => a + b, 0), (t) => (t === 9 ? 9 : 7)));
def("mmax", 2, (n, x) => moving("mmax", n, x, (w) => Math.max(...nn(w)), (t) => t));
def("mmin", 2, (n, x) => moving("mmin", n, x, (w) => Math.min(...nn(w)), (t) => t));
def("mcount", 2, (n, x) => moving("mcount", n, x, (w) => nn(w).length, () => 6));
def("mdev", 2, (n, x) => moving("mdev", n, x, (w) => { const v = nn(w); const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); }, () => 9));
def("ema", 2, ema);
def("all", 1, all);
def("any", 1, any);

def("til", 1, til);
def("count", 1, countOf);
def("first", 1, first);
def("last", 1, last);
def("reverse", 1, reverse);
def("enlist", 99, (...a) => (a.length === 1 ? enlist(a[0]) : fromItems(a)));
def("distinct", 1, distinct);
def("group", 1, group);
def("where", 1, where);
def("flip", 1, flip);
def("key", 1, keyOfValue);
def("value", 1, valueOf);
def("get", 1, getv);
def("set", 2, setv);
def("type", 1, typeVerb);
def("iasc", 1, iasc);
def("idesc", 1, idesc);
def("asc", 1, asc);
def("desc", 1, desc);
def("rank", 1, rank);
def("xrank", 2, xrank);
def("raze", 1, raze);
def("string", 1, stringOf);
def("show", 1, show);
def("attr", 1, attr);
def("in", 2, inList);
def("within", 2, within);
def("except", 2, except);
def("inter", 2, inter);
def("union", 2, union);
def("cross", 2, cross);
def("bin", 2, (x, y) => bin(x, y, false));
def("binr", 2, (x, y) => bin(x, y, true));
def("xbar", 2, xbar);
def("rotate", 2, rotate);
def("sublist", 2, sublist);
def("cut", 2, cut);
def("like", 2, like);
def("ss", 2, ss);
def("ssr", 3, ssr);
def("sv", 2, sv);
def("vs", 2, vs);
def("upper", 1, mapStr("upper", (s) => s.toUpperCase()));
def("lower", 1, mapStr("lower", (s) => s.toLowerCase()));
def("trim", 1, mapStr("trim", (s) => s.trim()));
def("ltrim", 1, mapStr("ltrim", (s) => s.replace(/^\s+/, "")));
def("rtrim", 1, mapStr("rtrim", (s) => s.replace(/\s+$/, "")));
def("mmu", 2, mmu);
def("inv", 1, inv);
def("lsq", 2, lsq);
def("fby", 2, fby);
def("rand", 1, (x) => {
  if (x instanceof QAtom) return first(roll(1, x));
  return first(roll(1, x));
});
def("getenv", 1, getenv);
def("system", 1, system);
def("tables", 1, tables);
def("hsym", 1, hsym);
def("eval", 1, evalQ);
def("reval", 1, evalQ);
def("parse", 1, (x) => {
  const s = asText(x);
  if (s === null) throw typeErr("parse needs a string.");
  return RT.parseStr(s);
});
def("exit", 1, () => NIL);
def("cols", 1, colsOf);
def("keys", 1, keysOf);
def("meta", 1, meta);
def("xkey", 2, xkey);
def("xcol", 2, xcol);
def("xcols", 2, xcols);
def("xasc", 2, xasc);
def("xdesc", 2, xdesc);
def("ungroup", 1, ungroup);
def("xgroup", 2, xgroup);
def("lj", 2, lj);
def("ljf", 2, lj);
def("ij", 2, ij);
def("ijf", 2, ij);
def("uj", 2, uj);
def("ujf", 2, uj);
def("pj", 2, pj);
def("aj", 3, aj);
def("aj0", 3, aj);
def("ej", 3, ej);
def("insert", 2, insert);
def("upsert", 2, upsert);
def("ltime", 1, (x) => x);
def("gtime", 1, (x) => x);

BUILTINS.set("attr#", new Builtin("attr#", 1, (xy) => {
  const [a, v] = (xy as QVec).d as QValue[];
  return applyAttr((a as QAtom).v, v);
}));

// iterator keywords
def("each", 2, (f, x) => RT.applyDerived(f, "'", [x]));
def("peach", 2, (f, x) => RT.applyDerived(f, "'", [x]));
def("over", 99, (f, ...a) => RT.applyDerived(f, "/", a));
def("scan", 99, (f, ...a) => RT.applyDerived(f, "\\", a));
def("prior", 2, (f, x) => RT.applyDerived(f, "':", [x]));

// fixed ranks for variadic definitions
(BUILTINS.get("over") as any).rank = 2;
(BUILTINS.get("scan") as any).rank = 2;
(BUILTINS.get("enlist") as any).rank = 1;
(BUILTINS.get("enlist") as any).t = 101;

export { BUILTINS, trap, identityFor };
