import { Builtin, Derived } from "./fns";
import { QAtom, QValue, QVec, atom, vec } from "./value";
import { join } from "./verbs";

const sumT = (t: number) => (t === 1 || t === 4 || t === 5 ? 6 : t);

/** Vectorised implementations of common derived verbs on simple numeric vectors. */
export function fastDerived(d: Derived, args: QValue[]): QValue | undefined {
  const f = d.f;
  if (!(f instanceof Builtin) || !f.glyph || args.length !== 1) return undefined;
  const x = args[0];
  if (d.adv === "/" && f.name === "," && x instanceof QVec && x.t === 0) {
    const its = x.d as QValue[];
    if (!its.length) return x;
    let acc = its[0];
    for (let i = 1; i < its.length; i++) acc = join(acc, its[i]);
    return acc;
  }
  if (!(x instanceof QVec) || x.t <= 0 || x.t === 10 || x.t === 11 || x.t === 2 || x.t >= 12) return undefined;
  const data = x.d as Float64Array;
  const n = data.length;
  const t = x.t;
  if (d.adv === "/") {
    if (!n) return undefined;
    switch (f.name) {
      case "+": {
        let s = 0;
        for (let i = 0; i < n; i++) s += data[i];
        return atom(-sumT(t), s);
      }
      case "*": {
        let s = 1;
        for (let i = 0; i < n; i++) s *= data[i];
        return atom(-sumT(t), s);
      }
      case "|": {
        let m = data[0];
        for (let i = 1; i < n; i++) if (data[i] > m || m !== m) m = data[i] !== data[i] ? m : data[i];
        return atom(-t, m);
      }
      case "&": {
        let m = data[0];
        for (let i = 1; i < n; i++) if (data[i] !== data[i] || data[i] < m) m = data[i];
        return atom(-t, m);
      }
    }
    return undefined;
  }
  if (d.adv === "\\") {
    const out = new Float64Array(n);
    switch (f.name) {
      case "+": {
        let s = 0;
        for (let i = 0; i < n; i++) out[i] = s += data[i];
        return vec(sumT(t), out);
      }
      case "*": {
        let s = 1;
        for (let i = 0; i < n; i++) out[i] = s *= data[i];
        return vec(sumT(t), out);
      }
      case "|": {
        let m = -Infinity;
        for (let i = 0; i < n; i++) out[i] = m = i === 0 ? data[0] : data[i] > m ? data[i] : m;
        return vec(t, out);
      }
      case "&": {
        let m = Infinity;
        for (let i = 0; i < n; i++) out[i] = m = i === 0 ? data[0] : data[i] < m ? data[i] : m;
        return vec(t, out);
      }
    }
  }
  return undefined;
}

export { QAtom };
