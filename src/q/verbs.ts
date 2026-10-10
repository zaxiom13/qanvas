import { NumOp, atomic1, atomic2, nEq, nLt, nMax, nMin } from "./atomic";
import { QError, domainErr, lengthErr, rankErr, typeErr, indexErr } from "./errors";
import { Builtin, Comp, Derived, Lambda, Proj } from "./fns";
import { RT } from "./rt";
import { cast, castByName, stringOf } from "./cast";
import {
  NIL, QAtom, QDict, QFn, QTable, QValue, QVec, TYPE_NAMES, alloc, atom, bool, bools, count, dict, emptyList, emptyOf,
  fromItems, isKeyed, item, items, list, list2vec, long, longs, nullItem, nullLike, nullOf, str, sym, syms, table,
  typeOf, vec, isNullAtom, floats,
} from "./value";

// ================= matching & hashing =================

const TOL = 1.1368683772161603e-13; // 2^-43, q comparison tolerance

/** Biggest vector a single primitive may allocate. 8e6 floats is 64MB — past that a phone tab is liable to be killed. */
export const MAX_VECTOR_ITEMS = 8_000_000;

function guardVector(n: number) {
  if (n > MAX_VECTOR_ITEMS) {
    throw new QError(
      "limit",
      `This would create ${Math.floor(n).toLocaleString("en-US")} items. That's too large to run in the browser, so it was stopped.`,
    );
  }
  RT.checkpoint?.();
}

/** Deadline check every 65536 steps inside a primitive that would otherwise never return to the interpreter. */
function tickItems(i: number) {
  if ((i & 0xffff) === 0) RT.checkpoint?.();
}

export const tolEq = (a: number, b: number) =>
  a === b || (a !== a && b !== b) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= TOL * Math.max(Math.abs(a), Math.abs(b)));

export function matchValues(x: QValue, y: QValue): boolean {
  if (x === y) return true;
  if (x instanceof QAtom) {
    if (!(y instanceof QAtom) || x.t !== y.t) return false;
    if (typeof x.v === "number") return tolEq(x.v, y.v);
    return x.v === y.v;
  }
  if (x instanceof QVec) {
    if (!(y instanceof QVec) || x.t !== y.t) return false;
    const n = x.d.length;
    if (n !== y.d.length) return false;
    if (x.t === 10) return x.d === y.d;
    if (x.t === 0) {
      const a = x.d as QValue[], b = y.d as QValue[];
      for (let i = 0; i < n; i++) if (!matchValues(a[i], b[i])) return false;
      return true;
    }
    const a = x.d as any, b = y.d as any;
    if (x.t === 11 || x.t === 2) {
      for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
      return true;
    }
    for (let i = 0; i < n; i++) if (!tolEq(a[i], b[i])) return false;
    return true;
  }
  if (x instanceof QTable) {
    if (!(y instanceof QTable) || x.cols.length !== y.cols.length) return false;
    return x.cols.every((c, i) => c === y.cols[i] && matchValues(x.data[i], y.data[i]));
  }
  if (x instanceof QDict) {
    return y instanceof QDict && matchValues(x.k, y.k) && matchValues(x.v, y.v);
  }
  if (x instanceof QFn && y instanceof QFn) return RT.inline(x) === RT.inline(y);
  return false;
}

/** Canonical hash key for grouping/finding values. */
export function keyOf(x: QValue): string | number {
  if (x instanceof QAtom) {
    const v = x.v;
    if (typeof v === "number") return v !== v ? "N" + x.t : v;
    return x.t + ":" + v;
  }
  if (x instanceof QVec && x.t === 10) return "s:" + x.d;
  return "k:" + typeOf(x) + RT.inline(x);
}

/** Raw element keys of a list, fast for simple vectors. */
function elemKeys(x: QValue): (string | number)[] {
  if (x instanceof QVec) {
    const t = x.t;
    if (t === 0) return (x.d as QValue[]).map(keyOf);
    if (t === 10) return Array.from(x.d as string);
    if (t === 11 || t === 2) return x.d as string[];
    const d = x.d as Float64Array;
    const out = new Array(d.length);
    for (let i = 0; i < d.length; i++) out[i] = d[i] !== d[i] ? "N" : d[i];
    return out;
  }
  if (x instanceof QTable) return items(x).map(keyOf);
  if (x instanceof QDict) return elemKeys(x.v);
  return [keyOf(x)];
}

function atomKey(t: number, x: QAtom): string | number {
  if (typeof x.v === "number") return x.v !== x.v ? "N" : x.v;
  return x.v;
}

// ================= ordering =================

function cmpNum(a: number, b: number) {
  if (a !== a) return b !== b ? 0 : -1;
  if (b !== b) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
function cmpStr(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function cmpValues(a: QValue, b: QValue): number {
  if (a instanceof QAtom && b instanceof QAtom) {
    if (typeof a.v === "number" && typeof b.v === "number") return cmpNum(a.v, b.v);
    if (typeof a.v === "string" && typeof b.v === "string") return cmpStr(a.v, b.v);
    return a.t - b.t;
  }
  const ai = a instanceof QAtom ? [a] : items(a), bi = b instanceof QAtom ? [b] : items(b);
  const n = Math.min(ai.length, bi.length);
  for (let i = 0; i < n; i++) {
    const c = cmpValues(ai[i], bi[i]);
    if (c) return c;
  }
  return ai.length - bi.length;
}

export function gradeUp(x: QValue): number[] {
  if (x instanceof QDict) return gradeUp(x.v);
  if (x instanceof QTable) {
    const n = x.n;
    const idx = Array.from({ length: n }, (_, i) => i);
    const cols = x.data.map((c) => (c instanceof QVec && c.t > 0 ? c : null));
    return idx.sort((i, j) => {
      for (let k = 0; k < x.data.length; k++) {
        const c = cols[k];
        let r: number;
        if (c) r = c.t === 11 || c.t === 2 || c.t === 10 ? cmpStr((c.d as any)[i], (c.d as any)[j]) : cmpNum((c.d as any)[i], (c.d as any)[j]);
        else r = cmpValues(items(x.data[k])[i], items(x.data[k])[j]);
        if (r) return r;
      }
      return i - j;
    });
  }
  if (!(x instanceof QVec)) throw typeErr("Sorting needs a list.");
  const n = x.d.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const d = x.d as any;
  if (x.t === 0) {
    const its = d as QValue[];
    return idx.sort((i, j) => cmpValues(its[i], its[j]) || i - j);
  }
  if (x.t === 10 || x.t === 11 || x.t === 2) return idx.sort((i, j) => cmpStr(d[i], d[j]) || i - j);
  return idx.sort((i, j) => cmpNum(d[i], d[j]) || i - j);
}

export function gradeDown(x: QValue): number[] {
  const up = gradeUp(x);
  // stable descending: reverse runs of equal keys keep original order
  const keys = x instanceof QDict ? x.v : x;
  const its = keys instanceof QTable ? items(keys) : null;
  const eq = (i: number, j: number) => {
    if (its) return matchValues(its[i], its[j]);
    const v = keys as QVec;
    if (v.t === 0) return matchValues((v.d as QValue[])[i], (v.d as QValue[])[j]);
    const d = v.d as any;
    return d[i] === d[j] || (d[i] !== d[i] && d[j] !== d[j]);
  };
  const out: number[] = [];
  let end = up.length;
  while (end > 0) {
    let start = end - 1;
    while (start > 0 && eq(up[start - 1], up[end - 1])) start--;
    for (let k = start; k < end; k++) out.push(up[k]);
    end = start;
  }
  return out;
}

// ================= structural helpers =================

export function take(n: number, x: QValue): QValue {
  const m0 = Math.abs(n);
  if (m0 > MAX_VECTOR_ITEMS) guardVector(m0);
  if (x instanceof QTable) return table(x.cols, x.data.map((c) => take(n, c)));
  if (x instanceof QDict) {
    if (isKeyed(x)) return dict(take(n, x.k), take(n, x.v));
    return dict(take(n, x.k), take(n, x.v));
  }
  if (x instanceof QAtom) {
    const t = -x.t;
    const m = Math.abs(n);
    if (t === 10) return str(x.v.repeat(m));
    if (t === 11 || t === 2) return vec(t, new Array(m).fill(x.v));
    if (t > 0 && t < 20) return vec(t, new Float64Array(m).fill(x.v));
    return list(new Array(m).fill(x));
  }
  if (!(x instanceof QVec)) return list(new Array(Math.abs(n)).fill(x));
  const len = x.d.length;
  const m = Math.abs(n);
  const idx = new Float64Array(m);
  if (len === 0) {
    if (m === 0) return x;
    // taking from an empty list yields nulls
    const nul = x.t === 0 ? NIL : nullOf(x.t);
    return x.t === 0 ? list(new Array(m).fill(nul)) : take(m, nul);
  }
  if (n >= 0) for (let i = 0; i < m; i++) { tickItems(i); idx[i] = i % len; }
  else for (let i = 0; i < m; i++) { tickItems(i); idx[i] = (((len - m + i) % len) + len) % len; }
  return pick(x, idx);
}

/** Select items by (valid) positions. */
export function pick(x: QValue, idx: ArrayLike<number>): QValue {
  if (x instanceof QTable) return table(x.cols, x.data.map((c) => pick(c, idx)));
  if (x instanceof QDict) return dict(pick(x.k, idx), pick(x.v, idx));
  if (!(x instanceof QVec)) return x;
  const n = idx.length, t = x.t;
  if (t === 10) {
    const d = x.d as string;
    let s = "";
    for (let i = 0; i < n; i++) s += d[idx[i]];
    return str(s);
  }
  if (t === 0 || t === 11 || t === 2) {
    const d = x.d as any[];
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = d[idx[i]];
    return t === 0 ? fromItems(out) : vec(t, out);
  }
  const d = x.d as Float64Array;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = d[idx[i]];
  return vec(t, out);
}

export function drop(n: number, x: QValue): QValue {
  if (x instanceof QAtom) throw typeErr("Can't drop from an atom.");
  const len = count(x);
  const m = Math.min(Math.abs(n), len);
  const idx: number[] = [];
  if (n >= 0) for (let i = m; i < len; i++) idx.push(i);
  else for (let i = 0; i < len - m; i++) idx.push(i);
  return pick(x, idx);
}

export function join(x: QValue, y: QValue): QValue {
  if (x instanceof QTable && y instanceof QTable) {
    if (x.cols.length === y.cols.length && x.cols.every((c) => y.cols.includes(c))) {
      return table(x.cols, x.cols.map((c, i) => join(x.data[i], y.data[y.cols.indexOf(c)])));
    }
    throw new QError("mismatch", `Can't join tables with different columns: ${x.cols.join(",")} vs ${y.cols.join(",")}.`);
  }
  if (x instanceof QTable && y instanceof QDict && !isKeyed(y)) return join(x, enlist(y));
  if (x instanceof QDict && y instanceof QDict) {
    if (isKeyed(x) && isKeyed(y)) return upsertKeyed(x, y);
    const kx = items(x.k), vx = [...items(x.v)];
    const ky = items(y.k), vy = items(y.v);
    const keys = [...kx];
    ky.forEach((k, j) => {
      const p = keys.findIndex((e) => matchValues(e, k));
      if (p < 0) {
        keys.push(k);
        vx.push(vy[j]);
      } else vx[p] = vy[j];
    });
    return dict(fromItems(keys), fromItems(vx));
  }
  const xa = x instanceof QAtom, ya = y instanceof QAtom;
  const xv = x instanceof QVec ? x : null, yv = y instanceof QVec ? y : null;
  const tx = xa ? -(x as QAtom).t : xv ? xv.t : -1;
  const ty = ya ? -(y as QAtom).t : yv ? yv.t : -1;
  if (tx > 0 && tx === ty && (xa || xv) && (ya || yv)) {
    const t = tx;
    if (t === 10) return str((xa ? (x as QAtom).v : xv!.d) + (ya ? (y as QAtom).v : yv!.d));
    if (t === 11 || t === 2) return vec(t, [...(xa ? [(x as QAtom).v] : xv!.d), ...(ya ? [(y as QAtom).v] : yv!.d)]);
    const a = xa ? Float64Array.of((x as QAtom).v) : (xv!.d as Float64Array);
    const b = ya ? Float64Array.of((y as QAtom).v) : (yv!.d as Float64Array);
    const out = new Float64Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return vec(t, out);
  }
  const xi = x instanceof QAtom || x instanceof QFn ? [x] : x instanceof QDict ? [x] : items(x);
  const yi = y instanceof QAtom || y instanceof QFn ? [y] : y instanceof QDict ? [y] : items(y);
  if ((xv && xv.d.length === 0 && xv.t === 0) && yv) return yv.t === 0 ? y : list2vec(yi);
  if ((yv && yv.d.length === 0 && yv.t === 0) && xv) return x;
  return fromItemsKeepList([...xi, ...yi]);
}

function fromItemsKeepList(its: QValue[]): QValue {
  const r = fromItems(its);
  return r;
}

export function upsertKeyed(x: QDict, y: QDict): QValue {
  const kt = x.k as QTable, vt = x.v as QTable;
  const yk = y.k as QTable, yvt = y.v as QTable;
  const keyRows = items(kt);
  let kcols = kt.data.map((c) => [...items(c)]);
  let vcols = vt.cols.map((c, j) => [...items(vt.data[j])]);
  const ykRows = items(yk);
  ykRows.forEach((kr, r) => {
    const p = keyRows.findIndex((e) => matchValues(e, kr));
    if (p < 0) {
      keyRows.push(kr);
      kcols.forEach((col, j) => col.push(items(yk.data[j])[r]));
      vcols.forEach((col, j) => {
        const cj = yvt.cols.indexOf(vt.cols[j]);
        col.push(cj < 0 ? nullItem(vt.data[j] as QVec) : items(yvt.data[cj])[r]);
      });
    } else {
      vcols.forEach((col, j) => {
        const cj = yvt.cols.indexOf(vt.cols[j]);
        if (cj >= 0) col[p] = items(yvt.data[cj])[r];
      });
    }
  });
  return dict(table(kt.cols, kcols.map((c) => list2vec(c))), table(vt.cols, vcols.map((c) => list2vec(c))));
}

export function enlist(x: QValue): QValue {
  if (x instanceof QAtom) {
    const t = -x.t;
    if (t === 10) return str(x.v);
    if (t === 11 || t === 2) return vec(t, [x.v]);
    if (t > 0 && t < 20) return vec(t, Float64Array.of(x.v));
  }
  if (x instanceof QDict && x.k instanceof QVec && x.k.t === 11 && !isKeyed(x)) {
    return table(x.k.d as string[], items(x.v).map((v) => enlist(v)));
  }
  return list([x]);
}

export function flip(x: QValue): QValue {
  if (x instanceof QTable) return dict(syms(x.cols), list(x.data));
  if (x instanceof QDict) {
    if (isKeyed(x)) throw typeErr("flip of a keyed table isn't defined; unkey it first with 0!.");
    if (!(x.k instanceof QVec) || x.k.t !== 11) throw typeErr("flip needs a dictionary with symbol keys to make a table.");
    const vals = items(x.v);
    let n = -1;
    for (const v of vals) if (!(v instanceof QAtom)) {
      const c = count(v);
      if (n >= 0 && c !== n) throw lengthErr(`All columns must have the same length (${n} vs ${c}).`);
      n = c;
    }
    if (n < 0) n = 1;
    return table(x.k.d as string[], vals.map((v) => (v instanceof QAtom ? take(n, v) : v instanceof QDict || v instanceof QTable ? list(items(v)) : v)));
  }
  if (x instanceof QVec && x.t === 0) {
    const rows = x.d as QValue[];
    let n = -1;
    for (const r of rows) if (!(r instanceof QAtom)) {
      const c = count(r);
      if (n >= 0 && c !== n) throw lengthErr(`flip needs rows of equal length (found ${n} and ${c}).`);
      n = c;
    }
    if (n < 0) return x;
    const its = rows.map((r) => (r instanceof QAtom ? null : items(r)));
    const out = new Array<QValue>(n);
    for (let j = 0; j < n; j++) out[j] = fromItems(rows.map((r, i) => (its[i] ? its[i]![j] : r)));
    return list(out);
  }
  if (x instanceof QVec) return x; // flip of simple vector is itself (q: rank error) — be lenient
  throw rankErr("flip needs a list of lists, a dictionary or a table.");
}

export function where(x: QValue): QValue {
  if (x instanceof QDict) {
    const idx = where(x.v) as QVec;
    return pick(x.k, idx.d as Float64Array);
  }
  if (x instanceof QAtom) {
    if (typeof x.v !== "number" || x.t === -9) throw typeErr("where needs booleans or counts.");
    guardVector(x.v);
    return longs(new Array(x.v).fill(0));
  }
  if (!(x instanceof QVec) || x.t === 0 || x.t === 10 || x.t === 11 || x.t === 8 || x.t === 9) {
    throw typeErr("where needs a boolean list (like 0 1 1 0b) or a list of counts.");
  }
  const d = x.d as Float64Array;
  let total = 0;
  for (let i = 0; i < d.length; i++) {
    if (d[i] < 0) throw domainErr("where can't repeat an index a negative number of times.");
    total += d[i] | 0;
  }
  guardVector(total);
  const out = new Float64Array(total);
  let k = 0;
  for (let i = 0; i < d.length; i++) for (let j = 0; j < d[i]; j++) { tickItems(k); out[k++] = i; }
  return vec(7, out);
}

export function reverse(x: QValue): QValue {
  if (x instanceof QAtom) return x;
  if (x instanceof QVec) {
    if (x.t === 10) return str([...(x.d as string)].reverse().join(""));
    if (x.t === 0 || x.t === 11 || x.t === 2) return vec(x.t, [...(x.d as any[])].reverse());
    return vec(x.t, (x.d as Float64Array).slice().reverse());
  }
  const n = count(x);
  const idx = Array.from({ length: n }, (_, i) => n - 1 - i);
  return pick(x, idx);
}

export function distinct(x: QValue): QValue {
  if (x instanceof QAtom) throw typeErr("distinct needs a list.");
  const keys = elemKeys(x);
  const seen = new Set<string | number>();
  const idx: number[] = [];
  keys.forEach((k, i) => {
    if (!seen.has(k)) {
      seen.add(k);
      idx.push(i);
    }
  });
  if (x instanceof QDict && !isKeyed(x)) return pick(x.v, idx);
  return pick(x, idx);
}

export function group(x: QValue): QValue {
  if (x instanceof QAtom) throw typeErr("group needs a list.");
  const keys = elemKeys(x);
  const m = new Map<string | number, number[]>();
  keys.forEach((k, i) => {
    let g = m.get(k);
    if (!g) m.set(k, (g = []));
    g.push(i);
  });
  const firsts = [...m.values()].map((g) => g[0]);
  const k = x instanceof QDict ? pick(x.v, firsts) : pick(x, firsts);
  const baseKeys = x instanceof QDict ? x.k : null;
  const vals = [...m.values()].map((g) => (baseKeys ? pick(baseKeys, g) : longs(g)));
  return dict(k, list(vals));
}

/** x?y find: index of first occurrence (count if absent), atomic over y. */
export function find(x: QValue, y: QValue): QValue {
  if (x instanceof QDict && !isKeyed(x)) {
    // reverse lookup
    const pos = find(x.v, y);
    return RT.apply(x.k, [pos]);
  }
  if (x instanceof QDict) {
    return find(x.v, y);
  }
  if (x instanceof QTable) {
    const rows = items(x).map(keyOf);
    const probe = (r: QValue) => {
      const k = keyOf(r);
      const p = rows.indexOf(k);
      return p < 0 ? rows.length : p;
    };
    if (y instanceof QTable) return longs(items(y).map(probe));
    return long(probe(y));
  }
  if (!(x instanceof QVec)) throw typeErr("? (find) needs a list on the left.");
  const keys = elemKeys(x);
  const m = new Map<string | number, number>();
  for (let i = keys.length - 1; i >= 0; i--) m.set(keys[i], i);
  const n = keys.length;
  const one = (v: QValue): number => {
    const k = x.t > 0 && v instanceof QAtom ? (v.t === -x.t ? atomKey(x.t, v) : typeof v.v === "number" && x.t !== 10 && x.t !== 11 ? (v.v !== v.v ? "N" : v.v) : "\u0000nomatch") : keyOf(v);
    const p = m.get(k as any);
    return p === undefined ? n : p;
  };
  if (y instanceof QAtom) return long(one(y));
  if (x.t === 0) {
    // general list: y matched as an item first
    const direct = keys.indexOf(keyOf(y) as any);
    if (direct >= 0) return long(direct);
  }
  if (y instanceof QVec) {
    if (y.t === 0) return fromItems((y.d as QValue[]).map((e) => (e instanceof QAtom ? long(one(e)) : find(x, e))));
    const its = items(y);
    const out = new Float64Array(its.length);
    for (let i = 0; i < its.length; i++) out[i] = one(its[i]);
    return vec(7, out);
  }
  return long(one(y));
}

export function inList(x: QValue, y: QValue): QValue {
  const n = count(y);
  const f = find(y instanceof QAtom ? enlist(y) : y, x);
  if (f instanceof QAtom) return bool(f.v < n);
  return mapNum(f, (v) => (v < n ? 1 : 0), 1);
}

function mapNum(x: QValue, f: (v: number) => number, t: number): QValue {
  if (x instanceof QAtom) return atom(-t, f(x.v));
  if (x instanceof QVec && x.t > 0) return vec(t, (x.d as Float64Array).map(f));
  return fromItems(items(x).map((e) => mapNum(e, f, t)));
}

export function til(x: QValue): QValue {
  if (!(x instanceof QAtom) || typeof x.v !== "number" || x.t === -9 || x.t === -8) throw typeErr("til needs a whole number, like til 10.");
  const n = x.v;
  if (n < 0) throw domainErr("til needs a non-negative number.");
  guardVector(n);
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) { tickItems(i); d[i] = i; }
  return vec(7, d);
}

// ================= numeric kernels =================

export const OPS = {
  add: { name: "+", f: (a: number, b: number) => a + b } as NumOp,
  sub: { name: "-", f: (a: number, b: number) => a - b } as NumOp,
  mul: { name: "*", f: (a: number, b: number) => a * b } as NumOp,
  div: { name: "%", f: (a: number, b: number) => a / b } as NumOp,
  min: { name: "&", f: nMin, s: (a: string, b: string) => (a < b ? a : b), tt: "&" } as NumOp,
  max: { name: "|", f: nMax, s: (a: string, b: string) => (a > b ? a : b), tt: "&" } as NumOp,
  eq: { name: "=", f: (a: number, b: number) => (tolEq(a, b) ? 1 : 0), bool: true, s: (a: string, b: string) => (a === b ? 1 : 0) } as NumOp,
  lt: { name: "<", f: (a: number, b: number) => (nLt(a, b) && !tolEq(a, b) ? 1 : 0), bool: true, s: (a: string, b: string) => (a < b ? 1 : 0) } as NumOp,
  gt: { name: ">", f: (a: number, b: number) => (nLt(b, a) && !tolEq(a, b) ? 1 : 0), bool: true, s: (a: string, b: string) => (a > b ? 1 : 0) } as NumOp,
  mod: { name: "mod", f: (a: number, b: number) => (b === 0 ? NaN : a - b * Math.floor(a / b)) } as NumOp,
  idiv: { name: "div", f: (a: number, b: number) => (b === 0 ? NaN : Math.floor(a / b)) } as NumOp,
  xexp: { name: "xexp", f: (a: number, b: number) => Math.pow(a, b) } as NumOp,
};

export const add = (x: QValue, y: QValue) => atomic2(OPS.add, x, y);
export const sub = (x: QValue, y: QValue) => atomic2(OPS.sub, x, y);
export const mul = (x: QValue, y: QValue) => atomic2(OPS.mul, x, y);
export const fdiv = (x: QValue, y: QValue) => atomic2(OPS.div, x, y);
export const eq = (x: QValue, y: QValue) => atomic2(OPS.eq, x, y);
export const lt = (x: QValue, y: QValue) => atomic2(OPS.lt, x, y);
export const gt = (x: QValue, y: QValue) => atomic2(OPS.gt, x, y);
export const vmin = (x: QValue, y: QValue) => atomic2(OPS.min, x, y);
export const vmax = (x: QValue, y: QValue) => atomic2(OPS.max, x, y);

const keepNum = (t: number) => (t === 1 || t === 4 || t === 5 ? 6 : t);
export const neg = (x: QValue) => atomic1("neg", x, (v) => -v, (t) => (t === 1 || t === 4 ? 6 : t === 13 || t === 14 || t === 12 || t === 15 ? t : t));
export const not = (x: QValue) => {
  if (x instanceof QAtom && (x.t === -10)) return bool(x.v.charCodeAt(0) === 0);
  if (x instanceof QVec && x.t === 10) return bools(Array.from(x.d as string, (c) => (c.charCodeAt(0) === 0 ? 1 : 0)));
  return atomic1("not", x, (v) => (v === 0 ? 1 : 0), () => 1);
};
export const reciprocal = (x: QValue) => atomic1("reciprocal", x, (v) => 1 / v, () => 9);

export const nullMask = (x: QValue): QValue => {
  if (x instanceof QAtom) return bool(isNullAtom(x));
  if (x instanceof QVec) {
    const t = x.t;
    if (t === 0) return fromItems((x.d as QValue[]).map(nullMask));
    const d = x.d as any;
    const out = new Float64Array(d.length);
    if (t === 10) for (let i = 0; i < d.length; i++) out[i] = d[i] === " " ? 1 : 0;
    else if (t === 11) for (let i = 0; i < d.length; i++) out[i] = d[i] === "" ? 1 : 0;
    else if (t === 1 || t === 4) {}
    else for (let i = 0; i < d.length; i++) out[i] = d[i] !== d[i] ? 1 : 0;
    return vec(1, out);
  }
  if (x instanceof QDict) return dict(x.k, nullMask(x.v));
  if (x instanceof QTable) return table(x.cols, x.data.map(nullMask));
  throw typeErr("null needs data.");
};

/** x^y : fill nulls in y with x */
export function fill(x: QValue, y: QValue): QValue {
  if (y instanceof QTable) {
    if (x instanceof QTable) return table(y.cols, y.data.map((c, i) => fill(x.data[x.cols.indexOf(y.cols[i])] ?? c, c)));
    return table(y.cols, y.data.map((c) => fill(x, c)));
  }
  if (y instanceof QDict) {
    if (x instanceof QDict) {
      // coalesce dictionaries: y wins unless null
      const merged = join(x, y) as QDict;
      const kx = x.k;
      return dict(merged.k, fromItems(items(merged.k).map((k, i) => {
        const yv = items(merged.v)[i];
        const p = items(kx).findIndex((e) => matchValues(e, k));
        if (p >= 0 && yv instanceof QAtom && isNullAtom(yv)) return items(x.v)[p];
        return yv;
      })));
    }
    return dict(y.k, fill(x, y.v));
  }
  if (y instanceof QAtom) {
    if (isNullAtom(y)) {
      if (x instanceof QAtom && x.t !== y.t && typeof x.v === "number" && typeof y.v === "number") return atom(y.t, x.v);
      return x;
    }
    return y;
  }
  if (y instanceof QVec) {
    if (x instanceof QVec && x.t > 0 && y.t > 0) {
      if (x.d.length !== y.d.length) throw lengthErr();
      const d = (y.d as any).slice ? (y.d as any).slice() : y.d;
      const mask = nullMask(y) as QVec;
      const xd = x.d as any;
      if (y.t === 10) return str(Array.from(y.d as string, (c, i) => (c === " " ? xd[i] : c)).join(""));
      for (let i = 0; i < d.length; i++) if ((mask.d as Float64Array)[i]) d[i] = xd[i];
      return vec(y.t, d);
    }
    if (y.t === 0) return fromItems((y.d as QValue[]).map((e) => fill(x, e)));
    if (!(x instanceof QAtom)) throw typeErr("^ fill needs an atom (or same-length list) on the left.");
    const mask = (nullMask(y) as QVec).d as Float64Array;
    if (y.t === 10) return str(Array.from(y.d as string, (c) => (c === " " ? x.v : c)).join(""));
    if (y.t === 11) return vec(11, (y.d as string[]).map((s) => (s === "" ? x.v : s)));
    const d = (y.d as Float64Array).slice();
    for (let i = 0; i < d.length; i++) if (mask[i]) d[i] = x.v;
    // widen type if the fill value is wider (e.g. 0.5^0N 1 -> float)
    const rt = typeof x.v === "number" && -x.t === 9 && y.t !== 9 ? 9 : y.t;
    return vec(rt, d);
  }
  throw typeErr("^ fill needs data.");
}

// ================= take / drop / cut =================

const ATTRS = new Set(["s", "u", "p", "g", ""]);

function takeVerb(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && x.t === -11 && ATTRS.has(x.v) && !(y instanceof QTable) && !(y instanceof QDict)) {
    return (BUILTINS.get("attr#") as any).m(list([x, y]));
  }
  if (x instanceof QAtom && typeof x.v === "number" && x.t !== -9) {
    if (x.v !== x.v) throw domainErr("Can't take 0N items.");
    return take(x.v, y);
  }
  if (x instanceof QVec && x.t === 11) {
    // column/key selection
    if (y instanceof QTable) return table(x.d as string[], (x.d as string[]).map((c) => {
      const j = y.cols.indexOf(c);
      if (j < 0) throw new QError(c, `No column '${c}'.`);
      return y.data[j];
    }));
    if (y instanceof QDict && !isKeyed(y)) {
      const vals = (x.d as string[]).map((k) => RT.apply(y, [sym(k)]));
      return dict(x, fromItems(vals));
    }
    if (y instanceof QDict && isKeyed(y)) {
      return RT.apply(y, [x]);
    }
  }
  if (x instanceof QAtom && x.t === -11 && y instanceof QTable) return takeVerb(syms([x.v]), y);
  if (x instanceof QVec && x.t > 0 && x.t !== 11 && x.d.length === 2 && x.t !== 10) {
    // reshape
    let [r, c] = Array.from(x.d as Float64Array);
    const src = y instanceof QAtom ? enlist(y) : y;
    const n = count(src);
    if (r !== r && c !== c) throw domainErr();
    if (r !== r) r = Math.ceil(n / c);
    if (c !== c) c = Math.ceil(n / r);
    const flat = take(r * c, src);
    const rows: QValue[] = [];
    for (let i = 0; i < r; i++) rows.push(pick(flat, Array.from({ length: c }, (_, j) => i * c + j)));
    return list(rows);
  }
  if (x instanceof QTable && y instanceof QDict && isKeyed(y)) return RT.apply(y, [x]);
  throw typeErr("# (take) needs a count on the left, e.g. 3#x.");
}

function dropVerb(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && typeof x.v === "number" && x.t !== -9 && x.t !== -11) {
    if (y instanceof QDict && !isKeyed(y)) {
      // drop key x
      return dropKeys(y, enlist(x));
    }
    return drop(x.v, y);
  }
  if (x instanceof QVec && (x.t === 7 || x.t === 6 || x.t === 5) && !(y instanceof QDict)) return cutAt(x.d as Float64Array, y);
  if ((x instanceof QAtom && x.t === -11) || (x instanceof QVec && x.t === 11)) {
    const ks = x instanceof QAtom ? [x.v] : (x.d as string[]);
    if (y instanceof QTable) return table(y.cols.filter((c) => !ks.includes(c)), y.data.filter((_, i) => !ks.includes(y.cols[i])));
    if (y instanceof QDict) return dropKeys(y, x instanceof QAtom ? enlist(x) : x);
  }
  if (x instanceof QDict) {
    // dict _ key
    return dropKeys(x, y instanceof QAtom ? enlist(y) : y);
  }
  if (x instanceof QVec && y instanceof QAtom && typeof y.v === "number") {
    // list _ index : remove item
    const n = x.d.length;
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (i !== y.v) idx.push(i);
    return pick(x, idx);
  }
  throw typeErr("_ (drop) needs a count on the left, e.g. 2_x.");
}

function dropKeys(d: QDict, ks: QValue): QValue {
  const drop = new Set(elemKeys(ks));
  const keys = elemKeys(d.k);
  const idx: number[] = [];
  keys.forEach((k, i) => !drop.has(k) && idx.push(i));
  return dict(pick(d.k, idx), pick(d.v, idx));
}

function cutAt(ix: Float64Array, y: QValue): QValue {
  const n = count(y);
  const out: QValue[] = [];
  for (let i = 0; i < ix.length; i++) {
    const s = ix[i], e = i + 1 < ix.length ? ix[i + 1] : n;
    if (s > n || e < s) throw domainErr("cut positions must be ascending and within the list.");
    out.push(pick(y, Array.from({ length: e - s }, (_, k) => s + k)));
  }
  return list(out);
}

export function cut(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && typeof x.v === "number") {
    const k = x.v;
    if (k <= 0) throw domainErr("cut size must be positive.");
    const n = count(y);
    const starts: number[] = [];
    for (let i = 0; i < n; i += k) starts.push(i);
    return cutAt(Float64Array.from(starts), y);
  }
  return dropVerb(x, y);
}

// ================= dict / key / value =================

export function mkDict(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && typeof x.v === "number" && x.t !== -9) {
    // n!table -> keyed table; 0N!x debug print
    if (x.v !== x.v) {
      RT.stdout(RT.show(y));
      return y;
    }
    if (y instanceof QTable) {
      const k = x.v;
      if (k === 0) return y;
      return dict(table(y.cols.slice(0, k), y.data.slice(0, k)), table(y.cols.slice(k), y.data.slice(k)));
    }
    if (y instanceof QDict && isKeyed(y)) {
      const flat = unkey(y) as QTable;
      return mkDict(x, flat);
    }
    if (x.v === -1 || x.v === 1 || x.v === -2 || x.v === 2) return RT.apply(x, [y]);
  }
  if (x instanceof QTable && y instanceof QTable) return dict(x, y);
  if (!(x instanceof QAtom) && count(x) !== count(y) && !(y instanceof QAtom))
    throw lengthErr(`A dictionary needs as many keys (${count(x)}) as values (${count(y)}).`);
  if (x instanceof QAtom) {
    if (y instanceof QAtom) return dict(enlist(x), enlist(y));
    return dict(enlist(x), list([y]));
  }
  if (y instanceof QAtom) return dict(x, take(count(x), y));
  return dict(x, y);
}

export function unkey(x: QValue): QValue {
  if (x instanceof QDict && isKeyed(x)) {
    const k = x.k as QTable, v = x.v as QTable;
    return table([...k.cols, ...v.cols], [...k.data, ...v.data]);
  }
  return x;
}

export function keyOfValue(x: QValue): QValue {
  if (x instanceof QDict) return x.k;
  if (x instanceof QTable) return syms(x.cols);
  if (x instanceof QAtom && typeof x.v === "number" && x.t !== -9) return til(x);
  if (x instanceof QAtom && x.t === -11) {
    const v = RT.getGlobal(x.v[0] === "." ? x.v : x.v);
    if (v instanceof QDict) return v.k;
    if (v instanceof QTable) return syms(v.cols);
    if (v === undefined) return syms([]);
  }
  if (x instanceof QVec && x.t > 0) {
    // key of an enumerated/typed vector -> type name
    return sym(TYPE_NAMES[x.t] ?? "");
  }
  throw typeErr("key needs a dictionary, table or whole number.");
}

export function valueOf(x: QValue): QValue {
  if (x instanceof QDict) return x.v;
  if (x instanceof QVec && x.t === 10) return RT.evalStr(x.d);
  if (x instanceof QAtom && x.t === -10) return RT.evalStr(x.v);
  if (x instanceof QAtom && x.t === -11) {
    const v = RT.getGlobal(x.v);
    if (v === undefined) throw new QError(x.v, `'${x.v}' is not defined.`);
    return v;
  }
  if (x instanceof Lambda) {
    return list([syms(x.node.params), syms(x.node.locals), syms([]), str(x.src)]);
  }
  if (x instanceof Proj) return list([x.f, ...x.args.map((a) => a ?? NIL)]);
  if (x instanceof Derived) return x.f;
  if (x instanceof QVec && x.t === 0 && x.d.length) {
    // eval a parse tree
    const [f, ...args] = x.d as QValue[];
    const fn = f instanceof QAtom && f.t === -11 ? valueOf(f) : f;
    const av = args.map((a) => (a instanceof QVec && a.t === 0 ? valueOf(a) : a instanceof QAtom && a.t === -11 ? valueOf(a) : a));
    return RT.apply(fn, av);
  }
  if (x instanceof QTable) return x;
  return x;
}

// ================= apply / index verbs =================

function atVerb(x: QValue, y: QValue): QValue {
  return RT.apply(x, [y]);
}

function dotVerb(x: QValue, y: QValue): QValue {
  const args = y instanceof QAtom ? [y] : y instanceof QVec ? items(y) : [y];
  if (!args.length) return RT.apply(x, [NIL]);
  return RT.apply(x, args);
}

/** @[x;i;f;y] / @[x;i;f] / @[f;x;e] (trap) */
function atN(args: QValue[]): QValue {
  const [x, i, f, y] = args;
  if (args.length === 3 && x instanceof QFn) return trap(() => RT.apply(x, [i]), f);
  if (args.length === 2) return RT.apply(x, [i]);
  const amend = (RT as any).amend as (x: QValue, idx: (QValue | undefined)[], f: QValue | undefined, y: QValue | undefined) => QValue;
  const target = x instanceof QAtom && x.t === -11 ? RT.getGlobal(x.v) : x;
  if (target === undefined) throw new QError((x as QAtom).v, "No such global.");
  const r = amend(target, [i], f, args.length === 4 ? y : undefined);
  if (x instanceof QAtom && x.t === -11) {
    RT.setGlobal(x.v, r);
    return x;
  }
  return r;
}

function dotN(args: QValue[]): QValue {
  const [x, i, f, y] = args;
  if (args.length === 3 && x instanceof QFn) return trap(() => dotVerb(x, i), f);
  if (args.length === 2) return dotVerb(x, i);
  const amend = (RT as any).amend as (x: QValue, idx: (QValue | undefined)[], f: QValue | undefined, y: QValue | undefined) => QValue;
  const target = x instanceof QAtom && x.t === -11 ? RT.getGlobal(x.v) : x;
  if (target === undefined) throw new QError((x as QAtom).v, "No such global.");
  const path = i instanceof QAtom ? [i] : items(i).map((e) => (e === NIL ? undefined : e));
  const r = amend(target, path, f, args.length === 4 ? y : undefined);
  if (x instanceof QAtom && x.t === -11) {
    RT.setGlobal(x.v, r);
    return x;
  }
  return r;
}

export function trap(f: () => QValue, handler: QValue): QValue {
  try {
    return f();
  } catch (e) {
    if (!(e instanceof QError)) throw e;
    if (handler instanceof QFn) return RT.apply(handler, [str(e.qname)]);
    return handler;
  }
}

// ================= ? (find / roll / deal / vector-conditional) =================

function query(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && typeof x.v === "number" && x.t !== -9 && x.t !== -8 && !(y instanceof QTable)) {
    return roll(x.v, y);
  }
  if (x instanceof QVec && x.t === 10 && y instanceof QVec && y.t === 10) return find(x, y);
  return find(x, y);
}

export function roll(n: number, y: QValue): QValue {
  const deal = n < 0;
  const shuffle = n !== n;
  const r = RT.random;
  if (y instanceof QAtom && typeof y.v === "number") {
    const m = y.v;
    const t = -y.t;
    const k = shuffle ? m : Math.abs(n);
    if (t === 9 || t === 8) {
      guardVector(k);
      const out = new Float64Array(k);
      for (let i = 0; i < k; i++) { tickItems(i); out[i] = r() * m; }
      return vec(t, out);
    }
    if (deal || shuffle) {
      if (k > m) throw lengthErr(`Can't deal ${k} distinct numbers from ${m}.`);
      guardVector(m);
      const pool = Array.from({ length: m }, (_, i) => i);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(r() * (m - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return vec(t === 1 ? 7 : t, Float64Array.from(pool.slice(0, k)));
    }
    guardVector(k);
    const out = new Float64Array(k);
    for (let i = 0; i < k; i++) { tickItems(i); out[i] = Math.floor(r() * m); }
    return vec(t === 1 ? 1 : t, out);
  }
  if (y instanceof QVec || y instanceof QDict) {
    const src = y instanceof QDict ? y.v : y;
    const m = count(src);
    const k = shuffle ? m : Math.abs(n);
    if (deal || shuffle) {
      if (k > m) throw lengthErr(`Can't deal ${k} distinct items from ${m}.`);
      guardVector(Math.max(k, m));
    } else guardVector(k);
    if (deal || shuffle) {
      const pool = Array.from({ length: m }, (_, i) => i);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(r() * (m - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pick(src, pool.slice(0, k));
    }
    const idx = Array.from({ length: k }, () => Math.floor(r() * m));
    return pick(src, idx);
  }
  if (y instanceof QAtom && y.t === -11 && y.v === "") {
    // random symbols of 8 chars? (n?`) - produce 4-char names
    const letters = "abcdefghijklmnop";
    const k = Math.abs(n);
    guardVector(k);
    return syms(Array.from({ length: k }, () => Array.from({ length: 4 }, () => letters[Math.floor(r() * 16)]).join("")));
  }
  throw typeErr("n?y needs a number or a list on the right.");
}

function vcond(args: QValue[]): QValue {
  if (args.length === 3) {
    const [c, a, b] = args;
    if (c instanceof QVec && c.t === 1) {
      const n = c.d.length;
      const ai = a instanceof QAtom ? null : items(a), bi = b instanceof QAtom ? null : items(b);
      if ((ai && ai.length !== n) || (bi && bi.length !== n)) throw lengthErr("?[c;a;b]: lengths differ.");
      const out: QValue[] = [];
      const cd = c.d as Float64Array;
      for (let i = 0; i < n; i++) out.push(cd[i] ? (ai ? ai[i] : a) : bi ? bi[i] : b);
      return fromItems(out);
    }
    if (c instanceof QAtom && c.t === -1) return c.v ? a : b;
  }
  const sel = (RT as any).functionalSelect;
  if (sel) return sel(args);
  throw rankErr("?[...] takes 3 arguments (vector conditional) or 4+ (functional select).");
}

function bangN(args: QValue[]): QValue {
  const upd = (RT as any).functionalUpdate;
  if (upd && args.length >= 4) return upd(args);
  throw rankErr("![t;c;b;a] functional update needs 4 arguments.");
}

// ================= type & cast =================

export function typeVerb(x: QValue): QValue {
  return atom(-5, typeOf(x));
}

function dollar(x: QValue, y: QValue): QValue {
  if (x instanceof QAtom && typeof x.v === "number" && (x.t === -7 || x.t === -6 || x.t === -5) && y instanceof QVec && y.t === 10) {
    // pad
    const n = x.v;
    const s = y.d as string;
    if (n >= 0) return str(s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
    const m = -n;
    return str(s.length >= m ? s.slice(s.length - m) : " ".repeat(m - s.length) + s);
  }
  if (x instanceof QAtom && typeof x.v === "number" && (x.t === -7 || x.t === -6 || x.t === -5) && y instanceof QVec && y.t === 0 && (y.d as QValue[]).every((e) => e instanceof QVec && e.t === 10)) {
    return list((y.d as QValue[]).map((e) => dollar(x, e)));
  }
  if (x instanceof QVec && x.t !== 10 && x.t !== 11 && y instanceof QVec && y.t > 0 && y.t !== 10 && y.t !== 11 && x.t !== 0) {
    // vector dot product (q 4.0+: $ on numeric vectors)
    return RT.apply(BUILTINS.get("mmu")!, [x, y]);
  }
  return cast(x, y);
}

// ================= glyph table =================

const b = (name: string, m?: (x: QValue) => QValue, d?: (x: QValue, y: QValue) => QValue, n?: (a: QValue[]) => QValue) =>
  new Builtin(name, d ? 2 : 1, m, d, n, true);

export const GLYPHS = new Map<string, QValue>([
  ["+", b("+", flip, add)],
  ["-", b("-", neg, sub)],
  ["*", b("*", (x) => first(x), mul)],
  ["%", b("%", reciprocal, fdiv)],
  ["!", b("!", keyOfValue, mkDict, bangN)],
  ["&", b("&", where, vmin)],
  ["|", b("|", reverse, vmax)],
  ["<", b("<", (x) => iasc(x), lt)],
  [">", b(">", (x) => idesc(x), gt)],
  ["=", b("=", group, eq)],
  ["~", b("~", not, (x, y) => bool(matchValues(x, y)))],
  [",", b(",", enlist, join)],
  ["^", b("^", nullMask, fill)],
  ["#", b("#", (x) => countOf(x), takeVerb)],
  ["_", b("_", (x) => floorV(x), dropVerb)],
  ["$", b("$", stringOf, dollar)],
  ["?", b("?", distinct, query, vcond)],
  ["@", b("@", typeVerb, atVerb, atN)],
  [".", b(".", valueOf, dotVerb, dotN)],
  [":", b(":", (x) => x, (_x, y) => y)],
  ["<=", b("<=", undefined, (x, y) => not(gt(x, y)))],
  [">=", b(">=", undefined, (x, y) => not(lt(x, y)))],
  ["<>", b("<>", undefined, (x, y) => not(eq(x, y)))],
  ["'", new Builtin("'", 2, undefined, undefined, (fs) => new Comp(fs), true)],
  ["0:", b("0:", undefined, (x, y) => zeroColon(x, y))],
  ["1:", b("1:", undefined, () => { throw new QError("nyi", "1: binary files aren't available in the browser."); })],
  ["2:", b("2:", undefined, () => { throw new QError("nyi", "2: dynamic loading isn't available in the browser."); })],
]);

export function countOf(x: QValue): QValue {
  return long(count(x));
}

export function first(x: QValue): QValue {
  if (x instanceof QAtom || x instanceof QFn) return x;
  if (x instanceof QDict) {
    if (isKeyed(x)) return first(x.v);
    return count(x.v) ? items(x.v)[0] : NIL;
  }
  if (x instanceof QTable) return x.n ? RT.apply(x, [long(0)]) : nullLikeRow(x);
  const v = x as QVec;
  if (!v.d.length) return v.t === 0 ? NIL : nullOf(v.t);
  return item(v, 0);
}

function nullLikeRow(t: QTable): QValue {
  return dict(syms(t.cols), fromItems(t.data.map((c) => nullItem(c as QVec))));
}

export function last(x: QValue): QValue {
  if (x instanceof QAtom || x instanceof QFn) return x;
  if (x instanceof QDict) {
    if (isKeyed(x)) return last(x.v);
    const its = items(x.v);
    return its.length ? its[its.length - 1] : NIL;
  }
  if (x instanceof QTable) return x.n ? RT.apply(x, [long(x.n - 1)]) : nullLikeRow(x);
  const v = x as QVec;
  if (!v.d.length) return v.t === 0 ? NIL : nullOf(v.t);
  return item(v, v.d.length - 1);
}

export function iasc(x: QValue): QValue {
  if (x instanceof QAtom) throw typeErr("iasc needs a list.");
  const g = gradeUp(x);
  if (x instanceof QDict) return pick(x.k, g);
  return longs(g);
}
export function idesc(x: QValue): QValue {
  if (x instanceof QAtom) throw typeErr("idesc needs a list.");
  const g = gradeDown(x);
  if (x instanceof QDict) return pick(x.k, g);
  return longs(g);
}

export function floorV(x: QValue): QValue {
  if (x instanceof QVec && x.t === 10) return str((x.d as string).toLowerCase());
  if (x instanceof QAtom && x.t === -10) return atom(-10, x.v.toLowerCase());
  if (x instanceof QAtom && x.t === -11) return sym(x.v.toLowerCase());
  if (x instanceof QVec && x.t === 11) return syms((x.d as string[]).map((s) => s.toLowerCase()));
  return atomic1("floor", x, Math.floor, (t) => (t === 9 || t === 8 ? 7 : t === 1 || t === 4 ? -1 : t));
}

function zeroColon(x: QValue, y: QValue): QValue {
  // ("SJF";",") 0: lines  — parse delimited text
  if (x instanceof QVec && x.t === 0 && x.d.length === 2) {
    const [types, delim] = x.d as QValue[];
    const ts = (types as QVec).d as string;
    const dl = delim instanceof QAtom ? delim.v : (delim as QVec).d;
    const header = dl.length === 1 && delim instanceof QVec;
    const lines = y instanceof QVec && y.t === 0 ? (y.d as QValue[]).map((l) => (l as QVec).d as string) : [(y as QVec).d as string];
    const rows = lines.map((l) => l.split(dl as string));
    const body = header ? rows.slice(1) : rows;
    const cols = [...ts].map((t, j) => (t === " " ? null : castByName(t.toUpperCase(), list(body.map((r) => str(r[j] ?? ""))))));
    if (header) {
      const names = rows[0].filter((_, j) => ts[j] !== " ");
      return table(names, cols.filter((c) => c) as QValue[]);
    }
    return list(cols.filter((c) => c) as QValue[]);
  }
  throw new QError("nyi", "0: file I/O isn't available; use it to parse text: (\"SJ\";enlist\",\") 0: lines.");
}

// ================= reduction identities =================

export function identityFor(f: QValue, x: QValue): QValue | undefined {
  if (!(f instanceof Builtin)) return undefined;
  const t = x instanceof QVec ? x.t : 0;
  const num = (v: number) => (t === 9 || t === 8 ? atom(-9, v) : t && t < 10 ? atom(-(t === 1 || t === 4 || t === 5 ? 6 : t), v) : long(v));
  switch (f.name) {
    case "+": return num(0);
    case "*": return num(1);
    case "|": return t === 9 ? atom(-9, -Infinity) : t === 1 ? bool(0) : num(-Infinity);
    case "&": return t === 9 ? atom(-9, Infinity) : t === 1 ? bool(1) : num(Infinity);
    case ",": return x;
    case "-": return num(0);
    case "%": return atom(-9, 1);
  }
  return undefined;
}

// Filled in by keywords.ts
export const BUILTINS = new Map<string, Builtin>();

export { emptyList, emptyOf, alloc, floats, nullLike, list2vec };
