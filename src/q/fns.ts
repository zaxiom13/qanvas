import type { NodeOf } from "./ast";
import { QFn, QValue } from "./value";

export type Impl1 = (x: QValue) => QValue;
export type Impl2 = (x: QValue, y: QValue) => QValue;
export type ImplN = (args: QValue[]) => QValue;

export class Lambda extends QFn {
  readonly t = 100;
  constructor(public readonly node: NodeOf<"lambda">, public readonly ns: string) {
    super();
  }
  get rank() {
    return this.node.params.length;
  }
  get src() {
    return this.node.src;
  }
}

/**
 * A built-in: primitive verb or keyword.
 * Primitive verbs are ambivalent (mono + dyad); keywords have a fixed rank.
 */
export class Builtin extends QFn {
  t: number;
  constructor(
    public readonly name: string,
    public readonly rank: number,
    public readonly m?: Impl1,
    public readonly d?: Impl2,
    public readonly n?: ImplN,
    /** true for operator glyphs like + - # */
    public readonly glyph = false,
  ) {
    super();
    this.t = glyph ? 102 : rank === 1 ? 101 : rank === 2 ? 102 : 103;
  }
}

export class Proj extends QFn {
  readonly t = 104;
  constructor(public readonly f: QValue, public readonly args: (QValue | undefined)[], public readonly rank: number) {
    super();
  }
}

export class Comp extends QFn {
  readonly t = 105;
  constructor(public readonly fs: QValue[]) {
    super();
  }
  get rank() {
    const last = this.fs[this.fs.length - 1];
    return last instanceof QFn ? last.rank : 1;
  }
}

export const ADV_TYPE: Record<string, number> = { "'": 106, "/": 107, "\\": 108, "':": 109, "/:": 110, "\\:": 111 };

export class Derived extends QFn {
  readonly t: number;
  constructor(public readonly f: QValue, public readonly adv: string, public readonly baseRank: number) {
    super();
    this.t = ADV_TYPE[adv];
  }
  get rank() {
    const r = this.baseRank;
    switch (this.adv) {
      case "'": return r;
      case "/": case "\\": return r === 1 ? 2 : r;
      case "':": return r === 1 ? 1 : 2;
      default: return 2;
    }
  }
}
