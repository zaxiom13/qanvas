// Converting q values into the flat JS arrays the renderer needs.
// Convention: one point is `x y`; many points are two rows `(xs;ys)` (structure of arrays).
import { QError } from "../q/errors";
import { QAtom, QDict, QTable, QValue, QVec, TYPE_NAMES, count, items } from "../q/index";

export class ApiError extends QError {
  constructor(name: string, hint: string) {
    super(name, hint);
  }
}

export const typeErr = (hint: string) => new ApiError("type", hint);
export const lengthErr = (hint: string) => new ApiError("length", hint);

const describe = (x: QValue) => {
  if (x instanceof QAtom) return `a ${TYPE_NAMES[-x.t]} atom`;
  if (x instanceof QVec) return x.t === 0 ? `a list of ${x.d.length}` : `a ${TYPE_NAMES[x.t]} list of ${x.d.length}`;
  if (x instanceof QTable) return "a table";
  if (x instanceof QDict) return "a dictionary";
  return "a function";
};

export function isNumeric(x: QValue): boolean {
  if (x instanceof QAtom) return typeof x.v === "number";
  return x instanceof QVec && x.t > 0 && x.t !== 10 && x.t !== 11 && x.t !== 2;
}

export function num(x: QValue, what: string): number {
  if (x instanceof QAtom && typeof x.v === "number") return x.v;
  if (x instanceof QVec && x.t > 0 && x.t !== 10 && x.t !== 11 && x.d.length === 1) return x.d[0];
  throw typeErr(`${what} should be a number, but got ${describe(x)}.`);
}

/** A numeric atom or vector as a Float64Array (atoms give length-1). */
export function nums(x: QValue, what: string): Float64Array {
  if (x instanceof QAtom && typeof x.v === "number") return Float64Array.of(x.v);
  if (x instanceof QVec) {
    if (x.t > 0 && x.t !== 10 && x.t !== 11 && x.t !== 2) return x.d as Float64Array;
    if (x.t === 0) {
      const its = x.d as QValue[];
      const out = new Float64Array(its.length);
      for (let i = 0; i < its.length; i++) out[i] = num(its[i], what);
      return out;
    }
  }
  throw typeErr(`${what} should be numbers, but got ${describe(x)}.`);
}

export interface Pts {
  xs: Float64Array;
  ys: Float64Array;
  n: number;
  /** true when a single point (2-vector) was given */
  single: boolean;
}

/** Points: `x y` (one point) or `(xs;ys)` (many). Also accepts `(x;ys)` with broadcasting. */
export function points(x: QValue, what = "p"): Pts {
  if (x instanceof QVec && x.t > 0 && x.t !== 10 && x.t !== 11) {
    const d = x.d as Float64Array;
    if (d.length === 2) return { xs: Float64Array.of(d[0]), ys: Float64Array.of(d[1]), n: 1, single: true };
    if (d.length === 3) return { xs: Float64Array.of(d[0]), ys: Float64Array.of(d[1]), n: 1, single: true };
    throw lengthErr(
      `${what} should be a point like 100 200, or two rows (xs;ys) for many points — got ${d.length} numbers.` +
        (d.length > 3 ? " If these are x positions, pair them with y positions: (xs;ys)." : ""),
    );
  }
  if (x instanceof QVec && x.t === 0) {
    const rows = x.d as QValue[];
    if (rows.length === 2 || rows.length === 3) {
      const [rx, ry] = rows;
      const ax = rx instanceof QAtom, ay = ry instanceof QAtom;
      if (!ax || !ay) {
        const n = ax ? count(ry) : count(rx);
        const xs = ax ? new Float64Array(n).fill(num(rx, what + " x")) : nums(rx, what + " x");
        const ys = ay ? new Float64Array(n).fill(num(ry, what + " y")) : nums(ry, what + " y");
        if (xs.length !== ys.length) throw lengthErr(`${what}: xs has ${xs.length} items but ys has ${ys.length}.`);
        return { xs, ys, n: xs.length, single: false };
      }
      return { xs: Float64Array.of(num(rx, what)), ys: Float64Array.of(num(ry, what)), n: 1, single: true };
    }
    // a list of pairs: flip it for the learner, but only when unambiguous
    if (rows.length > 3 && rows.every((r) => r instanceof QVec && count(r) === 2)) {
      throw lengthErr(
        `${what} is a list of ${rows.length} pairs. Qanvas wants points as two rows (xs;ys) — try flip ${what}.`,
      );
    }
    throw lengthErr(`${what} should be a point like 100 200, or two rows (xs;ys) — got a list of ${rows.length}.`);
  }
  if (x instanceof QTable) {
    throw typeErr(`${what}: pass the table to the shape directly, e.g. circle t, with columns p and r.`);
  }
  throw typeErr(`${what} should be a point like 100 200 or two rows (xs;ys), but got ${describe(x)}.`);
}

/** Broadcast a numeric arg to n items. */
export function spread(x: QValue, n: number, what: string): Float64Array {
  const a = nums(x, what);
  if (a.length === n) return a;
  if (a.length === 1) return new Float64Array(n).fill(a[0]);
  throw lengthErr(`${what} has ${a.length} values but there are ${n} shapes. Give one value, or one per shape.`);
}

export function text(x: QValue): string {
  if (x instanceof QVec && x.t === 10) return x.d as string;
  if (x instanceof QAtom && (x.t === -10 || x.t === -11)) return x.v;
  return null as unknown as string;
}

export function texts(x: QValue, fmt: (v: QValue) => string): string[] {
  const s = text(x);
  if (s !== null) return [s];
  if (x instanceof QVec && x.t === 11) return x.d as string[];
  if (x instanceof QVec && x.t === 0) return (x.d as QValue[]).map((e) => text(e) ?? fmt(e));
  if (x instanceof QVec) return items(x).map(fmt);
  return [fmt(x)];
}
