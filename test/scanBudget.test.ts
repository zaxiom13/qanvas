import { afterEach, expect, test } from "vitest";
import { Session } from "../src/q/index";

const realNow = performance.now.bind(performance);
afterEach(() => {
  performance.now = realNow;
});

test("ordinary scans and sorts are unchanged", () => {
  const s = new Session();
  expect(s.evaluate("sums 1 2 3").text).toBe("1 3 6");
  expect(s.evaluate("prds 1 2 3 4").text).toBe("1 2 6 24");
  expect(s.evaluate("avgs 1 2 3").text).toBe("1 1.5 2");
  expect(s.evaluate("deltas 1 2 4").text).toBe("1 1 2");
  expect(s.evaluate("maxs 1 3 2").text).toBe("1 3 3");
  expect(s.evaluate("asc 3 1 2").text).toBe("`s#1 2 3");
  expect(s.evaluate("desc 3 1 2").text).toBe("3 2 1");
  expect(s.evaluate("distinct 1 2 1 3").text).toBe("1 2 3");
  expect(s.evaluate('group "abba"').text).toBe("a| 0 3\nb| 1 2");
  expect(s.evaluate("iasc 3 1 2").text).toBe("1 2 0");
});

test("a scan keeps going after the run budget is already spent", () => {
  // Measured on 2026-10-15 before this fix, with the deadline already expired:
  // group of til 1500000 ran for 1508ms, distinct 715ms, avgs 669ms, asc 307ms, sums 295ms.
  const s = new Session();
  expect(s.evaluate("a:til 1000").error).toBeUndefined();
  s.budgetHint = "budget";
  for (const src of ["sums a", "avgs a", "deltas a", "prds a", "group a", "distinct a", "asc a", "iasc a", "desc a"]) {
    s.deadline = performance.now() - 1;
    const e = s.evaluate(src).error;
    expect(e?.qname, src).toBe("stop");
    expect(e?.hint, src).toBe("budget");
  }
});

test("sums notices a deadline that passes while the list is scanned", () => {
  const s = new Session();
  expect(s.evaluate("a:til 200000").error).toBeUndefined();
  let ticks = 0;
  performance.now = () => {
    ticks++;
    return ticks < 3 ? 1 : 1e12;
  };
  s.deadline = 100;
  s.budgetHint = "budget";
  const e = s.evaluate("sums a").error;
  expect(e?.qname).toBe("stop");
  expect(e?.hint).toBe("budget");
  expect(ticks).toBeGreaterThanOrEqual(3);
});
