import { QError, lengthErr, typeErr } from "./errors";
import { RT } from "./rt";
import { gradeDown, gradeUp, join, keyOf, matchValues, pick, unkey, upsertKeyed, flip, enlist, take, cmpValues, add, mkDict } from "./verbs";
import {
  QAtom, QDict, QTable, QValue, QVec, count, dict, fromItems, isKeyed, items, list, list2vec, long, nullItem, sym, syms,
  table, typeChar, str, char, NIL,
} from "./value";

const asTable = (x: QValue, name: string): QTable => {
  if (x instanceof QTable) return x;
  if (x instanceof QDict && isKeyed(x)) return unkey(x) as QTable;
  throw typeErr(`${name} needs a table.`);
};

const symsOf = (x: QValue): string[] => {
  if (x instanceof QAtom && x.t === -11) return [x.v];
  if (x instanceof QVec && x.t === 11) return x.d as string[];
  throw typeErr("Expected column name(s) as symbols, like `a`b.");
};

function col(t: QTable, c: string): QValue {
  const j = t.cols.indexOf(c);
  if (j < 0) throw new QError(c, `No column '${c}' — columns are ${t.cols.join(", ")}.`);
  return t.data[j];
}

export function colsOf(x: QValue): QValue {
  if (x instanceof QTable) return syms(x.cols);
  if (x instanceof QDict && isKeyed(x)) return syms([...(x.k as QTable).cols, ...(x.v as QTable).cols]);
  if (x instanceof QAtom && x.t === -11) return colsOf(RT.getGlobal(x.v) ?? NIL);
  throw typeErr("cols needs a table.");
}

export function keysOf(x: QValue): QValue {
  if (x instanceof QDict && isKeyed(x)) return syms((x.k as QTable).cols);
  if (x instanceof QTable) return syms([]);
  if (x instanceof QAtom && x.t === -11) return keysOf(RT.getGlobal(x.v) ?? NIL);
  throw typeErr("keys needs a table.");
}

export function meta(x: QValue): QValue {
  const t = asTable(x instanceof QAtom && x.t === -11 ? RT.getGlobal(x.v)! : x, "meta");
  const types = t.data.map((c) => {
    if (c instanceof QVec) {
      if (c.t === 0) {
        const its = c.d as QValue[];
        const f = its[0];
        if (f instanceof QVec && its.every((e) => e instanceof QVec && e.t === f.t)) return typeChar(f.t).toUpperCase();
        return " ";
      }
      return typeChar(c.t);
    }
    return " ";
  });
  const kt = table(["c"], [syms(t.cols)]);
  const vt = table(["t", "f", "a"], [str(types.join("")), syms(t.cols.map(() => "")), syms(t.data.map((c) => (c instanceof QVec ? c.attr : "")))]);
  return dict(kt, vt);
}

export function xkey(k: QValue, x: QValue): QValue {
  const ks = symsOf(k);
  const byName = x instanceof QAtom && x.t === -11;
  const t = asTable(byName ? RT.getGlobal((x as QAtom).v)! : x, "xkey");
  if (!ks.length) return t;
  const vcols = t.cols.filter((c) => !ks.includes(c));
  const r = dict(table(ks, ks.map((c) => col(t, c))), table(vcols, vcols.map((c) => col(t, c))));
  if (byName) {
    RT.setGlobal((x as QAtom).v, r);
    return x;
  }
  return r;
}

export function xcol(names: QValue, x: QValue): QValue {
  const keyed = x instanceof QDict && isKeyed(x);
  const t = asTable(x, "xcol");
  let cols = [...t.cols];
  if (names instanceof QDict) {
    const from = symsOf(names.k), to = symsOf(names.v);
    cols = cols.map((c) => (from.includes(c) ? to[from.indexOf(c)] : c));
  } else {
    const ns = symsOf(names);
    ns.forEach((n, i) => (cols[i] = n));
  }
  const r = table(cols, t.data);
  if (keyed) return mkDict(long(((x as QDict).k as QTable).cols.length), r);
  return r;
}

export function xcols(names: QValue, x: QValue): QValue {
  const t = asTable(x, "xcols");
  const front = symsOf(names);
  const order = [...front, ...t.cols.filter((c) => !front.includes(c))];
  return table(order, order.map((c) => col(t, c)));
}

function sortBy(names: QValue, x: QValue, down: boolean): QValue {
  const byName = x instanceof QAtom && x.t === -11;
  const src = byName ? RT.getGlobal((x as QAtom).v)! : x;
  const keyed = src instanceof QDict && isKeyed(src);
  const t = asTable(src, down ? "xdesc" : "xasc");
  const ks = symsOf(names);
  const g = (down ? gradeDown : gradeUp)(table(ks, ks.map((c) => col(t, c))));
  let r: QValue = pick(t, g);
  if (!down && ks.length === 1) {
    const j = (r as QTable).cols.indexOf(ks[0]);
    const c = (r as QTable).data[j];
    if (c instanceof QVec && c.t > 0) {
      const s = new QVec(c.t, c.d);
      s.attr = "s";
      (r as QTable).data[j] = s;
    }
  }
  if (keyed) r = dict(pick((src as QDict).k, g), pick((src as QDict).v, g));
  if (byName) {
    RT.setGlobal((x as QAtom).v, r);
    return x;
  }
  return r;
}
export const xasc = (n: QValue, x: QValue) => sortBy(n, x, false);
export const xdesc = (n: QValue, x: QValue) => sortBy(n, x, true);

export function ungroup(x: QValue): QValue {
  const t = asTable(x, "ungroup");
  const n = t.n;
  const nested = t.data.map((c) => c instanceof QVec && c.t === 0 && (c.d as QValue[]).every((e) => !(e instanceof QAtom)));
  const rowIdx: number[] = [], sub: number[] = [];
  for (let i = 0; i < n; i++) {
    const len = nested.findIndex((b) => b) >= 0 ? count((t.data[nested.findIndex((b) => b)] as QVec).d[i] as QValue) : 1;
    for (let j = 0; j < len; j++) {
      rowIdx.push(i);
      sub.push(j);
    }
  }
  return table(t.cols, t.data.map((c, k) => {
    if (!nested[k]) return pick(c, rowIdx);
    const its = (c as QVec).d as QValue[];
    return list2vec(rowIdx.map((r, j) => items(its[r])[sub[j]]));
  }));
}

export function xgroup(k: QValue, x: QValue): QValue {
  const t = asTable(x, "xgroup");
  const ks = symsOf(k);
  const keyT = table(ks, ks.map((c) => col(t, c)));
  const keysRows = items(keyT).map(keyOf);
  const m = new Map<string | number, number[]>();
  keysRows.forEach((kk, i) => {
    let g = m.get(kk);
    if (!g) m.set(kk, (g = []));
    g.push(i);
  });
  const groups = [...m.values()];
  const vcols = t.cols.filter((c) => !ks.includes(c));
  return dict(
    table(ks, ks.map((c) => pick(col(t, c), groups.map((g) => g[0])))),
    table(vcols, vcols.map((c) => list(groups.map((g) => pick(col(t, c), g))))),
  );
}

// ---------- joins ----------
function keyIndex(kt: QTable): Map<string | number, number> {
  const m = new Map<string | number, number>();
  items(kt).forEach((r, i) => {
    const k = keyOf(r);
    if (!m.has(k)) m.set(k, i);
  });
  return m;
}

export function lj(x: QValue, y: QValue): QValue {
  if (!(y instanceof QDict) || !isKeyed(y)) throw typeErr("lj needs a keyed table on the right, like t lj ([k:..] v:..).");
  const keyedLeft = x instanceof QDict && isKeyed(x);
  const t = asTable(x, "lj");
  const kt = y.k as QTable, vt = y.v as QTable;
  const idx = keyIndex(kt);
  const probe = table(kt.cols, kt.cols.map((c) => col(t, c)));
  const rows = items(probe).map((r) => idx.get(keyOf(r)) ?? -1);
  const cols = [...t.cols], data = [...t.data];
  vt.cols.forEach((c, j) => {
    const src = vt.data[j];
    const srcItems = items(src);
    const nul = nullItem(src as QVec);
    const existing = cols.indexOf(c);
    const oldItems = existing >= 0 ? items(data[existing]) : null;
    const colv = list2vec(rows.map((r, i) => (r < 0 ? (oldItems ? oldItems[i] : nul) : srcItems[r])));
    if (existing >= 0) data[existing] = colv;
    else {
      cols.push(c);
      data.push(colv);
    }
  });
  const r = table(cols, data);
  if (keyedLeft) return xkey(syms(((x as QDict).k as QTable).cols), r);
  return r;
}

export function ij(x: QValue, y: QValue): QValue {
  if (!(y instanceof QDict) || !isKeyed(y)) throw typeErr("ij needs a keyed table on the right.");
  const t = asTable(x, "ij");
  const kt = y.k as QTable;
  const idx = keyIndex(kt);
  const probe = table(kt.cols, kt.cols.map((c) => col(t, c)));
  const keep: number[] = [];
  items(probe).forEach((r, i) => idx.has(keyOf(r)) && keep.push(i));
  return lj(pick(t, keep), y);
}

export function pj(x: QValue, y: QValue): QValue {
  if (!(y instanceof QDict) || !isKeyed(y)) throw typeErr("pj needs a keyed table on the right.");
  const t = asTable(x, "pj");
  const kt = y.k as QTable, vt = y.v as QTable;
  const idx = keyIndex(kt);
  const probe = table(kt.cols, kt.cols.map((c) => col(t, c)));
  const rows = items(probe).map((r) => idx.get(keyOf(r)) ?? -1);
  const cols = [...t.cols], data = [...t.data];
  vt.cols.forEach((c, j) => {
    const srcItems = items(vt.data[j]);
    const addv = list2vec(rows.map((r) => (r < 0 ? zeroLike(srcItems[0]) : srcItems[r])));
    const e = cols.indexOf(c);
    if (e >= 0) data[e] = add(data[e], addv);
    else {
      cols.push(c);
      data.push(addv);
    }
  });
  return table(cols, data);
}

const zeroLike = (v: QValue | undefined): QValue => (v instanceof QAtom ? new QAtom(v.t, 0) : long(0));

export function uj(x: QValue, y: QValue): QValue {
  if (x instanceof QDict && isKeyed(x) && y instanceof QDict && isKeyed(y)) {
    const xv = x.v as QTable, yv = y.v as QTable;
    const allCols = [...xv.cols, ...yv.cols.filter((c) => !xv.cols.includes(c))];
    const widen = (t: QTable, n: number) => table(allCols, allCols.map((c) => (t.cols.includes(c) ? col(t, c) : nullCol(xv.cols.includes(c) ? col(xv, c) : col(yv, c), n))));
    return upsertKeyed(dict(x.k, widen(xv, xv.n)), dict(y.k, widen(yv, yv.n)) as QDict) as QValue;
  }
  const a = asTable(x, "uj"), b = asTable(y, "uj");
  const allCols = [...a.cols, ...b.cols.filter((c) => !a.cols.includes(c))];
  const widen = (t: QTable, other: QTable) => table(allCols, allCols.map((c) => (t.cols.includes(c) ? col(t, c) : nullCol(col(other, c), t.n))));
  return join(widen(a, b), widen(b, a));
}

function nullCol(like: QValue, n: number): QValue {
  const nul = like instanceof QVec ? nullItem(like) : NIL;
  if (nul instanceof QAtom) return take(n, nul);
  return list(new Array(n).fill(nul));
}

export function aj(c: QValue, x: QValue, y: QValue): QValue {
  const ks = symsOf(c);
  const t = asTable(x, "aj"), q = asTable(y, "aj");
  const eqCols = ks.slice(0, -1), tcol = ks[ks.length - 1];
  // group right table by equality columns
  const groups = new Map<string | number, number[]>();
  const rk = eqCols.length ? items(table(eqCols, eqCols.map((k) => col(q, k)))).map(keyOf) : items(col(q, tcol)).map(() => 0 as string | number);
  rk.forEach((k, i) => {
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(i);
  });
  const qt = items(col(q, tcol));
  const lk = eqCols.length ? items(table(eqCols, eqCols.map((k) => col(t, k)))).map(keyOf) : items(col(t, tcol)).map(() => 0 as string | number);
  const lt = items(col(t, tcol));
  const match = lk.map((k, i) => {
    const g = groups.get(k);
    if (!g) return -1;
    let best = -1;
    for (const r of g) {
      if (cmpValues(qt[r], lt[i]) <= 0 && (best < 0 || cmpValues(qt[r], qt[best]) >= 0)) best = r;
    }
    return best;
  });
  const cols = [...t.cols], data = [...t.data];
  q.cols.forEach((cname, j) => {
    if (eqCols.includes(cname)) return;
    const src = items(q.data[j]);
    const nul = nullItem(q.data[j] as QVec);
    const existing = cols.indexOf(cname);
    const old = existing >= 0 ? items(data[existing]) : null;
    const v = list2vec(match.map((r, i) => (r < 0 ? (old ? old[i] : nul) : src[r])));
    if (existing >= 0) data[existing] = cname === tcol ? data[existing] : v;
    else {
      cols.push(cname);
      data.push(v);
    }
  });
  return table(cols, data);
}

export function ej(c: QValue, x: QValue, y: QValue): QValue {
  const ks = symsOf(c);
  const a = asTable(x, "ej"), b = asTable(y, "ej");
  const bk = items(table(ks, ks.map((k) => col(b, k)))).map(keyOf);
  const ak = items(table(ks, ks.map((k) => col(a, k)))).map(keyOf);
  const li: number[] = [], ri: number[] = [];
  ak.forEach((k, i) => bk.forEach((k2, j) => { if (k === k2) { li.push(i); ri.push(j); } }));
  const bcols = b.cols.filter((cn) => !a.cols.includes(cn));
  return table([...a.cols, ...bcols], [...a.data.map((d) => pick(d, li)), ...bcols.map((cn) => pick(col(b, cn), ri))]);
}

// ---------- insert / upsert ----------
function rowsAsTable(cols: string[], y: QValue): QTable {
  if (y instanceof QTable) return y;
  if (y instanceof QDict && !isKeyed(y)) return enlist(y) as QTable;
  // list of column values (one row or several)
  const vals = items(y);
  if (vals.length !== cols.length) throw lengthErr(`Insert needs ${cols.length} values (one per column: ${cols.join(", ")}), got ${vals.length}.`);
  return table(cols, vals.map((v) => (v instanceof QAtom ? enlist(v) : v)));
}

export function insert(name: QValue, y: QValue): QValue {
  if (!(name instanceof QAtom) || name.t !== -11) throw typeErr("insert needs a table name on the left, like `t insert (1;`a).");
  const cur = RT.getGlobal(name.v);
  if (cur === undefined) {
    const t = rowsAsTable([], y);
    RT.setGlobal(name.v, t);
    return long(0);
  }
  const t = asTable(cur, "insert");
  const add = rowsAsTable(t.cols, y);
  const start = t.n;
  let r: QValue = join(t, table(t.cols, t.cols.map((c) => col(add, c))));
  if (cur instanceof QDict && isKeyed(cur)) r = xkey(syms((cur.k as QTable).cols), r);
  RT.setGlobal(name.v, r);
  return RT.apply(RT.getGlobal("til")!, [long(add.n)]) instanceof QVec ? add2(start, add.n) : long(start);
}

export function upsert(x: QValue, y: QValue): QValue {
  const byName = x instanceof QAtom && x.t === -11;
  const cur = byName ? RT.getGlobal((x as QAtom).v) : x;
  if (cur === undefined) throw new QError((x as QAtom).v, "No such table.");
  let r: QValue;
  if (cur instanceof QDict && isKeyed(cur)) {
    const allCols = [...(cur.k as QTable).cols, ...(cur.v as QTable).cols];
    const add = rowsAsTable(allCols, y);
    const k = (cur.k as QTable).cols;
    r = upsertKeyed(cur, xkey(syms(k), add) as QDict);
  } else {
    const t = asTable(cur, "upsert");
    const add = rowsAsTable(t.cols, y);
    r = join(t, table(t.cols, t.cols.map((c) => col(add, c))));
  }
  if (byName) {
    RT.setGlobal((x as QAtom).v, r);
    return x;
  }
  return r;
}

function add2(start: number, n: number): QValue {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = start + i;
  return new QVec(7, d);
}

export { flip, str, char, sym, fromItems, matchValues };
