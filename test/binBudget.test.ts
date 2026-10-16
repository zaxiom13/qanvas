import { afterEach, expect, test } from "vitest";
import { Session } from "../src/q/index";

const realNow = performance.now.bind(performance);
afterEach(() => {
  performance.now = realNow;
});

test("bin and binr of a short list are unchanged", () => {
  const s = new Session();
  expect(s.evaluate("1 3 5 7 bin 4").text).toBe("1");
  expect(s.evaluate("1 3 5 7 bin 0 4 8").text).toBe("-1 1 3");
  expect(s.evaluate("1 3 5 7 binr 4").text).toBe("2");
  expect(s.evaluate("1 3 5 7 binr 0 4 8").text).toBe("0 2 4");
});

test("bin of a long right argument stops when the run budget is already spent", () => {
  // Measured on 2026-10-16 before this fix, with the deadline already expired:
  // count (til 1000000) bin (1000000?1000000) ran for 1351ms and returned 1000000.
  const s = new Session();
  expect(s.evaluate("x:til 1000; y:til 1000").error).toBeUndefined();
  s.deadline = performance.now() - 1;
  s.budgetHint = "budget";
  const t0 = performance.now();
  const e = s.evaluate("x bin y").error;
  expect(e?.qname).toBe("stop");
  expect(e?.hint).toBe("budget");
  expect(performance.now() - t0).toBeLessThan(200);
});

test("bin notices a deadline that passes while the right argument is searched", () => {
  const s = new Session();
  expect(s.evaluate("x:til 200000; y:til 200000").error).toBeUndefined();
  let ticks = 0;
  performance.now = () => {
    ticks++;
    return ticks < 4 ? 1 : 1e12;
  };
  s.deadline = 100;
  s.budgetHint = "budget";
  const e = s.evaluate("x bin y").error;
  expect(e?.qname).toBe("stop");
  expect(e?.hint).toBe("budget");
  expect(ticks).toBeGreaterThanOrEqual(4);
});
