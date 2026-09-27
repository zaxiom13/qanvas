import { describe, expect, test } from "vitest";
import "./dom-shims";
import { PROBLEMS } from "../src/content/dojo";
import { checkCode } from "../src/lib/checker";
import { mockCtx } from "./helpers";

describe("dojo", () => {
  test("has problems", () => expect(PROBLEMS.length).toBeGreaterThan(20));
  for (const p of PROBLEMS) {
    test(`${p.id}: has a title and goal`, () => {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.goal.length).toBeGreaterThan(0);
    });
    test(`${p.id}: solution passes`, () => {
      const out = checkCode(p.solution, p.checks, mockCtx().ctx);
      const why = out.runError ? `run error '${out.runError.name}: ${out.runError.hint}` : out.results.filter((r) => !r.pass).map((r) => `${r.expr} ${r.error ?? ""}`).join("; ");
      expect(out.ok ? "ok" : why).toBe("ok");
    });
    test(`${p.id}: starter does not pass`, () => {
      expect(checkCode(p.starter, p.checks, mockCtx().ctx).ok).toBe(false);
    });
  }
});
