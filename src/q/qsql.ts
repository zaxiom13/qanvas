import type { Node, NodeOf } from "./ast";
import { QError, lengthErr, typeErr } from "./errors";
import type { Frame, Session } from "./interp";
import { inferName } from "./parser";
import { RT } from "./rt";
import { enlist, gradeUp, keyOf, pick, take, unkey, where } from "./verbs";
import {
  NIL, QAtom, QDict, QTable, QValue, QVec, count, dict, fromItems, isKeyed, items, list, list2vec, longs, nullItem, sym, syms, table,
} from "./value";

function resolveTable(s: Session, from: QValue): { t: QTable; keyCols: string[] | null; name: string | null } {
  let name: string | null = null;
  let v = from;
  if (from instanceof QAtom && from.t === -11) {
    name = from.v;
    const g = s.lookupGlobal(from.v, s.cur);
    if (g === undefined) throw new QError(from.v, `No table named '${from.v}'.`);
    v = g;
  }
  if (v instanceof QTable) return { t: v, keyCols: null, name };
  if (v instanceof QDict && isKeyed(v)) return { t: unkey(v) as QTable, keyCols: (v.k as QTable).cols, name };
  throw typeErr("qSQL needs a table after 'from'.");
}

function colFrame(fr: Frame, t: QTable, rows: number[] | null): Frame {
  const locals = new Map<string, QValue>();
  t.cols.forEach((c, j) => locals.set(c, rows ? pick(t.data[j], rows) : t.data[j]));
  locals.set("i", longs(rows ?? Array.from({ length: t.n }, (_, i) => i)));
  return { lam: null, locals, ns: fr.ns, parent: fr };
}

function filterRows(s: Session, fr: Frame, t: QTable, conds: Node[]): number[] {
  let rows = Array.from({ length: t.n }, (_, i) => i);
  for (const c of conds) {
    const env = colFrame(fr, t, rows);
    const r = s.ev(c, env);
    let keep: number[];
    if (r instanceof QVec && r.t === 1) {
      if (r.d.length !== rows.length) throw lengthErr(`where clause produced ${r.d.length} booleans for ${rows.length} rows.`);
      const idx = (where(r) as QVec).d as Float64Array;
      keep = Array.from(idx, (k) => rows[k]);
    } else if (r instanceof QAtom && r.t === -1) {
      keep = r.v ? rows : [];
    } else if (r instanceof QVec && (r.t === 7 || r.t === 6)) {
      keep = Array.from(r.d as Float64Array, (k) => rows[k]);
    } else throw typeErr("A where clause must produce booleans, e.g. where price>10.");
    rows = keep;
  }
  return rows;
}

function colName(def: [string | null, Node], used: Set<string>): string {
  let n = def[0] ?? inferName(def[1]) ?? "x";
  if (used.has(n) && !def[0]) {
    let k = 1;
    while (used.has(n + k)) k++;
    n = n + k;
  }
  used.add(n);
  return n;
}

function groups(s: Session, fr: Frame, t: QTable, rows: number[], by: [string | null, Node][]): { names: string[]; keyVals: QValue[][]; idx: number[][] } {
  const env = colFrame(fr, t, rows);
  const used = new Set<string>();
  const names = by.map((b) => colName(b, used));
  const vals = by.map((b) => {
    const v = s.ev(b[1], env);
    if (v instanceof QAtom) return take(rows.length, v);
    if (count(v) !== rows.length) throw lengthErr("by clause must produce one value per row.");
    return v;
  });
  const keyItems = vals.map((v) => items(v));
  const m = new Map<string, number[]>();
  const order: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const k = keyItems.map((ki) => String(keyOf(ki[r]))).join("\u0001");
    let g = m.get(k);
    if (!g) {
      m.set(k, (g = []));
      order.push(k);
    }
    g.push(r);
  }
  let idx = order.map((k) => m.get(k)!);
  // q returns groups sorted by key
  const firstRows = idx.map((g) => g[0]);
  const keyTable = table(names, vals.map((v) => pick(v, firstRows)));
  const g = gradeUp(keyTable);
  idx = g.map((i) => idx[i]);
  const keyVals = vals.map((v) => idx.map((grp) => items(v)[grp[0]]));
  return { names, keyVals, idx: idx.map((grp) => grp.map((r) => rows[r])) };
}

function broadcast(vals: QValue[], n: number | null): QValue[] {
  let len = n ?? -1;
  if (len < 0) for (const v of vals) if (!(v instanceof QAtom)) { len = count(v); break; }
  if (len < 0) return vals.map((v) => enlist(v));
  return vals.map((v) => {
    if (v instanceof QAtom) return take(len, v);
    if (count(v) !== len) throw lengthErr(`Columns have different lengths (${len} and ${count(v)}).`);
    return v instanceof QDict ? list(items(v)) : v;
  });
}

export function runSql(s: Session, n: NodeOf<"sql">, fr: Frame): QValue {
  const src = s.ev(n.from, fr);
  const { t, keyCols, name } = resolveTable(s, src);
  const rows = filterRows(s, fr, t, n.where);
  const used = new Set<string>();

  if (n.kind === "delete") {
    let r: QValue;
    if (n.delCols && n.delCols.length) {
      const keep = t.cols.filter((c) => !n.delCols!.includes(c));
      r = table(keep, keep.map((c) => t.data[t.cols.indexOf(c)]));
    } else {
      const drop = new Set(rows);
      const keep = Array.from({ length: t.n }, (_, i) => i).filter((i) => !drop.has(i));
      r = pick(t, keep);
    }
    r = rekey(r as QTable, keyCols);
    return writeBack(s, name, r);
  }

  if (n.kind === "update") {
    const cols = [...t.cols];
    const data = [...t.data];
    const assign = (cname: string, full: QValue[] | null, sel: number[], vals: QValue) => {
      const j = cols.indexOf(cname);
      const base = j >= 0 ? [...items(data[j])] : null;
      const its = vals instanceof QAtom ? sel.map(() => vals) : items(vals);
      if (its.length !== sel.length) throw lengthErr(`update: ${cname} produced ${its.length} values for ${sel.length} rows.`);
      const nul = base ? null : nullItem(its[0] instanceof QAtom ? list2vec([its[0]]) : list([]));
      const out = base ?? new Array<QValue>(t.n).fill(nul ?? NIL);
      sel.forEach((r, k) => (out[r] = its[k]));
      const colv = list2vec(out);
      if (j >= 0) {
        const old = data[j];
        if (old instanceof QVec && old.t > 0 && colv instanceof QVec && colv.t !== old.t && sel.length !== t.n) {
          throw typeErr(`update can't put ${cname} values of a different type into only some rows.`);
        }
        data[j] = colv;
      } else {
        cols.push(cname);
        data.push(colv);
      }
    };
    if (n.by) {
      const g = groups(s, fr, t, rows, n.by);
      for (const def of n.cols) {
        const cname = colName(def, used);
        const outVals: QValue[] = new Array(t.n);
        for (const grp of g.idx) {
          const v = s.ev(def[1], colFrame(fr, t, grp));
          const its = v instanceof QAtom ? grp.map(() => v) : items(v);
          grp.forEach((r, k) => (outVals[r] = its[k]));
        }
        const sel = g.idx.flat();
        assign(cname, null, sel, fromItems(sel.map((r) => outVals[r])));
      }
    } else {
      const env = colFrame(fr, t, rows);
      const results = n.cols.map((def) => [colName(def, used), s.ev(def[1], env)] as const);
      for (const [cname, v] of results) assign(cname, null, rows, v);
    }
    return writeBack(s, name, rekey(table(cols, data), keyCols));
  }

  // select / exec
  if (n.by) {
    const g = groups(s, fr, t, rows, n.by);
    let cols: string[], data: QValue[];
    if (!n.cols.length) {
      const vc = t.cols.filter((c) => !g.names.includes(c));
      cols = vc;
      data = vc.map((c) => fromItems(g.idx.map((grp) => items(t.data[t.cols.indexOf(c)])[grp[grp.length - 1]])));
    } else {
      cols = n.cols.map((d) => colName(d, used));
      data = n.cols.map((def) => fromItems(g.idx.map((grp) => s.ev(def[1], colFrame(fr, t, grp)))));
    }
    const keyT = table(g.names, g.keyVals.map((kv) => list2vec(kv)));
    if (n.kind === "exec") {
      const key = g.names.length === 1 ? list2vec(g.keyVals[0]) : keyT;
      if (cols.length === 1 && !n.cols[0][0]) return dict(key, data[0]);
      return dict(key, table(cols, data));
    }
    return dict(keyT, table(cols, data));
  }

  const env = colFrame(fr, t, rows);
  if (n.kind === "exec") {
    if (!n.cols.length) return pick(t, rows);
    const vals = n.cols.map((def) => s.ev(def[1], env));
    if (n.cols.length === 1 && !n.cols[0][0]) return vals[0];
    const names = n.cols.map((d) => colName(d, used));
    return dict(syms(names), list(vals));
  }
  let result: QValue;
  if (!n.cols.length) {
    result = pick(t, rows);
    result = rekey(result as QTable, keyCols);
  } else {
    const names = n.cols.map((d) => colName(d, used));
    const vals = n.cols.map((def) => s.ev(def[1], env));
    const allAtoms = vals.every((v) => v instanceof QAtom || (v instanceof QVec && v.t === 0 && false));
    result = table(names, allAtoms ? vals.map((v) => enlist(v)) : broadcast(vals, null));
    if (keyCols && keyCols.every((k) => names.includes(k))) result = rekey(result as QTable, keyCols);
  }
  if (n.limit) {
    const lim = s.ev(n.limit, fr);
    if (lim instanceof QAtom && typeof lim.v === "number") result = take(lim.v, result);
  }
  return result;
}

function rekey(t: QTable, keyCols: string[] | null): QValue {
  if (!keyCols) return t;
  const vc = t.cols.filter((c) => !keyCols.includes(c));
  return dict(table(keyCols, keyCols.map((c) => t.data[t.cols.indexOf(c)])), table(vc, vc.map((c) => t.data[t.cols.indexOf(c)])));
}

function writeBack(s: Session, name: string | null, r: QValue): QValue {
  if (name) {
    s.setGlobal(name, r, s.cur);
    return sym(name);
  }
  return r;
}

export { gradeUp };
