// Late-bound runtime hooks so primitive modules can call back into the interpreter
// (e.g. `each` needs to apply arbitrary functions) without import cycles.
import type { QValue } from "./value";

export interface Runtime {
  apply(f: QValue, args: (QValue | undefined)[]): QValue;
  applyDerived(f: QValue, adv: string, args: QValue[]): QValue;
  /** evaluate q source in the current session */
  evalStr(src: string): QValue;
  parseStr(src: string): QValue;
  getGlobal(name: string): QValue | undefined;
  setGlobal(name: string, v: QValue): void;
  stdout(text: string): void;
  stderr(text: string): void;
  random(): number;
  seed(n: number): void;
  show(x: QValue): string;
  inline(x: QValue): string;
  now(): number; // ms since unix epoch (host clock)
  tzOffsetMin(): number;
  tables(ns: string): string[];
  names(ns: string, kind: "v" | "f" | "a"): string[];
}

export const RT: Runtime = {} as Runtime;
