import { NIL, QAtom, QDict, QFn, QTable, QValue, QVec, TYPE_NAMES, count, isKeyed, items } from "../q/index";
import { bare, fmtAtom, inline } from "../q/format";

export const typeColor = (t: number): string => {
  const a = Math.abs(t);
  if (a === 1) return "var(--type-bool)";
  if (a === 4 || a === 5 || a === 6 || a === 7) return "var(--type-num)";
  if (a === 8 || a === 9) return "var(--type-float)";
  if (a === 10) return "var(--type-char)";
  if (a === 11) return "var(--type-sym)";
  if (a >= 12 && a <= 19) return "var(--type-time)";
  if (a >= 100) return "var(--type-fn)";
  return "var(--type-list)";
};

const PLURAL: Record<number, string> = {
  1: "booleans", 4: "bytes", 5: "shorts", 6: "ints", 7: "longs", 8: "reals", 9: "floats", 10: "chars", 11: "symbols",
  12: "timestamps", 13: "months", 14: "dates", 15: "datetimes", 16: "timespans", 17: "minutes", 18: "seconds", 19: "times",
};

export function isNumVec(v: QValue): v is QVec {
  return v instanceof QVec && v.t > 0 && v.t !== 10 && v.t !== 11 && v.t !== 2 && v.t !== 1;
}

/** rows of equal-length numeric vectors */
export function numRows(v: QValue): Float64Array[] | null {
  if (!(v instanceof QVec) || v.t !== 0 || !v.d.length) return null;
  const rows = v.d as QValue[];
  let n = -1;
  for (const r of rows) {
    if (!isNumVec(r)) return null;
    if (n >= 0 && r.d.length !== n) return null;
    n = r.d.length;
  }
  return rows.map((r) => (r as QVec).d as Float64Array);
}

export function shapeLabel(v: QValue): string {
  if (v === NIL) return "nothing (::)";
  if (v instanceof QAtom) return `${TYPE_NAMES[-v.t]} atom`;
  if (v instanceof QVec) {
    if (v.t === 10) return `string · ${v.d.length} char${v.d.length === 1 ? "" : "s"}`;
    if (v.t > 0) return `${v.d.length} ${PLURAL[v.t] ?? TYPE_NAMES[v.t]}`;
    const rows = numRows(v);
    if (rows) return `${rows.length} × ${rows[0].length} ${rows.length === 2 ? "· rows (xs;ys)" : "matrix"}`;
    const its = v.d as QValue[];
    if (its.length && its.every((e) => e instanceof QVec && e.t === 10)) return `${its.length} strings`;
    return `list · ${its.length} item${its.length === 1 ? "" : "s"}`;
  }
  if (v instanceof QTable) return `table · ${v.n} row${v.n === 1 ? "" : "s"} × ${v.cols.length} col${v.cols.length === 1 ? "" : "s"}`;
  if (v instanceof QDict) {
    if (isKeyed(v)) return `keyed table · ${count(v)} rows`;
    return `dictionary · ${count(v)} key${count(v) === 1 ? "" : "s"}`;
  }
  if (v instanceof QFn) return TYPE_NAMES[v.t] ?? "function";
  return "value";
}

export const cellText = (t: number, x: unknown, p = 7): string => {
  if (t === 1) return (x as number) ? "1" : "0";
  if (t === 11) return "`" + (x as string);
  if (t === 10) return x as string;
  return bare(t, x, p);
};

export const atomText = (a: QAtom) => fmtAtom(a, 7);
export const inlineText = (v: QValue) => inline(v, 7);

export { items, count };
