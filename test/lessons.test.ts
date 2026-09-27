import { describe, expect, test } from "vitest";
import "./dom-shims";
import { LESSONS } from "../src/content/lessons";
import { checkCode } from "../src/lib/checker";
import { runHeadless } from "../src/qanvas/headless";
import { mockCtx } from "./helpers";

describe("lessons", () => {
  test("there are lessons", () => expect(LESSONS.length).toBeGreaterThan(0));
  for (const lesson of LESSONS) {
    describe(lesson.id, () => {
      // q cells share one session, like the lesson page
      const base = runHeadless("", { ctx: mockCtx().ctx });
      for (const b of lesson.blocks) {
        if (b.kind === "cell") {
          test(`cell ${b.id}${b.sketch ? " (sketch)" : ""}`, () => {
            if (b.sketch) {
              const r = runHeadless(b.code, { ctx: mockCtx().ctx, frames: 3 });
              expect(r.error ? `'${r.error.qname}: ${r.error.hint ?? ""}\n${b.code}` : "ok").toBe("ok");
            } else {
              const r = base.session.evaluate(b.code);
              expect(r.error ? `'${r.error.qname}: ${r.error.hint ?? ""}\n${b.code}` : "ok").toBe("ok");
            }
          });
        } else if (b.kind === "challenge") {
          test(`challenge ${b.id}: solution passes`, () => {
            expect(b.solution.trim().length).toBeGreaterThan(0);
            const out = checkCode(b.solution, b.checks, mockCtx().ctx);
            const why = out.runError ? `run error '${out.runError.name}: ${out.runError.hint}` : out.results.filter((r) => !r.pass).map((r) => `${r.expr} ${r.error ?? ""}`).join("; ");
            expect(out.ok ? "ok" : why).toBe("ok");
          });
          test(`challenge ${b.id}: starter does not pass yet`, () => {
            const out = checkCode(b.starter, b.checks, mockCtx().ctx);
            expect(out.ok).toBe(false);
          });
        }
      }
    });
  }
});
