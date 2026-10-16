import { afterEach, expect, test } from "vitest";
import { Session } from "../src/q/index";

const realNow = performance.now.bind(performance);
afterEach(() => {
  performance.now = realNow;
});

test("each, each-left, each-right and each-prior of a short list are unchanged", () => {
  const s = new Session();
  expect(s.evaluate("neg each 1 -2 3").text).toBe("-1 2 -3");
  expect(s.evaluate("1 2+/:10 20").text).toBe("11 12\n21 22");
  expect(s.evaluate("1 2+\\:10 20").text).toBe("11 21\n12 22");
  expect(s.evaluate("-':[1 4 9]").text).toBe("1 3 5");
  expect(s.evaluate("(+/)1 2 3 4").text).toBe("10");
  expect(s.evaluate("(+\\)1 2 3 4").text).toBe("1 3 6 10");
});

test("each of a builtin stops when the run budget is already spent", () => {
  // Measured on 2026-10-16 before this fix, with the deadline already expired:
  // neg each til 1500000 ran for 413ms and returned a count.
  const s = new Session();
  expect(s.evaluate("a:til 5000").error).toBeUndefined();
  s.deadline = performance.now() - 1;
  s.budgetHint = "budget";
  for (const src of ["neg each a", "1+/:a", "a+\\:1", "-':[a]"]) {
    s.deadline = performance.now() - 1;
    const e = s.evaluate(src).error;
    expect(e?.qname, src).toBe("stop");
    expect(e?.hint, src).toBe("budget");
  }
});

test("each notices a deadline that passes while the list is walked", () => {
  const s = new Session();
  expect(s.evaluate("a:til 200000").error).toBeUndefined();
  let ticks = 0;
  performance.now = () => {
    ticks++;
    return ticks < 5 ? 1 : 1e12;
  };
  s.deadline = 100;
  s.budgetHint = "budget";
  const e = s.evaluate("neg each a").error;
  expect(e?.qname).toBe("stop");
  expect(e?.hint).toBe("budget");
  expect(ticks).toBeGreaterThanOrEqual(5);
});
