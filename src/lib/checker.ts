import { runHeadless } from "../qanvas/headless";
import { QAtom, dict, list, longs, syms } from "../q/index";
import { explainError, type Explained } from "./explain";

export interface CheckResult {
  expr: string;
  msg: string;
  pass: boolean;
  error?: string;
}

export interface CheckOutcome {
  ok: boolean;
  session?: import("../q/index").Session;
  runError?: Explained;
  results: CheckResult[];
}

/** Run code off-screen, then evaluate each check (a q boolean expression) in its session. */
export function checkCode(code: string, checks: { expr: string; msg: string }[], ctx: CanvasRenderingContext2D): CheckOutcome {
  const r = runHeadless(code, { ctx, frames: 3, budgetMs: 3000, record: true, mouse: [380, 260] });
  if (r.error) return { ok: false, runError: explainError(r.error, code), results: [] };
  const s = r.session;
  const kinds = Object.keys(r.api.drawn);
  const ns = s.nsMap(".qv");
  ns.set("drawn", dict(syms(kinds), longs(kinds.map((k) => r.api.drawn[k]))));
  const called = Object.keys(r.calls);
  ns.set("drew", dict(syms(called), list(called.map((k) => list(r.calls[k].map((args) => list(args)))))));
  s.run(".qv.arg:{[k;i] (last drew k) i}");
  s.run(".qv.same:{$[(type x) in 98 99h;x~y;(count x)<>count y;0b;all raze x=y]}");
  const results = checks.map((c): CheckResult => {
    const res = s.evaluate(c.expr);
    if (res.error) return { ...c, pass: false, error: `'${res.error.qname}${res.error.hint ? " — " + res.error.hint : ""}` };
    const v = res.value;
    const pass = v instanceof QAtom && typeof v.v === "number" && v.v !== 0 && v.v === v.v;
    return { ...c, pass };
  });
  return { ok: results.every((x) => x.pass), results, session: s };
}

export function offscreenCtx(): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 600;
  return c.getContext("2d")!;
}
