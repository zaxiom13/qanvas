import { describe, expect, test } from "vitest";
import "./dom-shims";
import { DOJO, PROBLEMS } from "../src/content/dojo";
import { checkCode } from "../src/lib/checker";
import { mockCtx } from "./helpers";

describe("dojo", () => {
  test("has problems", () => expect(PROBLEMS.length).toBeGreaterThan(20));
  test("dictionaries has the four cited problems", () => {
    // Lookups and a missing key: code.kx.com/q/basics/dictsandtables/ (Indexing), read 2026-10-14.
    // Dict + dict upsert: code.kx.com/q/ref/add/ "It applies to dictionaries and tables", read 2026-10-14.
    // count each group "mississippi": code.kx.com/q/ref/group/, read 2026-10-14.
    // Not a fresh KDB-X recording. The checks are those published results.
    const set = DOJO.find((s) => s.id === "dictionaries");
    expect(set?.problems.map((p) => p.title)).toEqual([
      "Look up a name",
      "A missing colour",
      "Add two price lists",
      "Letter counts",
    ]);
  });
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
