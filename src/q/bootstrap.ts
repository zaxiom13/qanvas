import type { Session } from "./interp";
import { Builtin } from "./fns";
import { RT } from "./rt";
import { QAtom, QValue, QVec, atom, float, list, str, sym } from "./value";
import { typeErr } from "./errors";

const MS_2000 = 946684800000;

export function nowParts(local: boolean) {
  const ms = RT.now() + (local ? RT.tzOffsetMin() * 60000 : 0) - MS_2000;
  const ns = ms * 1e6;
  const days = Math.floor(ms / 86400000);
  const tod = ms - days * 86400000;
  return { ns, days, tod, ms };
}

export const DYNAMIC: Record<string, () => QValue> = {
  ".z.p": () => atom(-12, nowParts(false).ns),
  ".z.P": () => atom(-12, nowParts(true).ns),
  ".z.n": () => atom(-16, (nowParts(false).tod) * 1e6),
  ".z.N": () => atom(-16, (nowParts(true).tod) * 1e6),
  ".z.t": () => atom(-19, nowParts(false).tod),
  ".z.T": () => atom(-19, nowParts(true).tod),
  ".z.d": () => atom(-14, nowParts(false).days),
  ".z.D": () => atom(-14, nowParts(true).days),
  ".z.z": () => atom(-15, nowParts(false).ms / 86400000),
  ".z.Z": () => atom(-15, nowParts(true).ms / 86400000),
  ".z.K": () => float(5),
  ".z.k": () => atom(-14, 9400),
  ".z.o": () => sym("js"),
  ".z.h": () => sym("browser"),
  ".z.u": () => sym("you"),
  ".z.i": () => atom(-6, 1),
  ".z.a": () => atom(-6, 0),
  ".z.x": () => list([]),
  ".z.f": () => sym(""),
};

export function installBootstrap(s: Session) {
  const Q = s.nsMap(".Q");
  Q.set("n", str("0123456789"));
  Q.set("a", str("abcdefghijklmnopqrstuvwxyz"));
  Q.set("A", str("ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  Q.set("an", str("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789"));
  Q.set("t", str(" bg xhijefcspmdznuvt"));
  Q.set("s", new Builtin(".Q.s", 1, (x) => str(RT.show(x) + "\n")));
  Q.set("s1", new Builtin(".Q.s1", 1, (x) => str(RT.inline(x))));
  Q.set(
    "f",
    new Builtin(".Q.f", 2, undefined, (n, x) => {
      const d = (n as QAtom).v as number;
      const one = (v: number) => str(v.toFixed(d));
      if (x instanceof QAtom) return one(x.v);
      if (x instanceof QVec) return list(Array.from(x.d as Float64Array, one));
      throw typeErr(".Q.f needs numbers.");
    }),
  );
  Q.set(
    "fmt",
    new Builtin(".Q.fmt", 3, undefined, undefined, ([w, d, x]) => {
      const one = (v: number) => {
        const s = v.toFixed((d as QAtom).v);
        const width = (w as QAtom).v;
        return str(s.length > width ? "*".repeat(width) : s.padStart(width));
      };
      if (x instanceof QAtom) return one(x.v);
      return list(Array.from((x as QVec).d as Float64Array, one));
    }),
  );
  s.nsMap(".z");
  s.run(Q_BOOT);
}

const Q_BOOT = `
.Q.addmonths:{("d"$(\`month$x)+y)+x-"d"$\`month$x}
`;
