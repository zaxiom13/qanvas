import { afterEach, expect, test } from "vitest";
import { Session } from "../src/q/index";

const realNow = performance.now.bind(performance);
afterEach(() => {
  performance.now = realNow;
});

const err = (src: string, deadline?: number) => {
  const s = new Session();
  if (deadline !== undefined) {
    s.deadline = deadline;
    s.budgetHint = "budget";
  }
  return s.evaluate(src).error;
};

test("a list big enough to exhaust the tab is refused before it is allocated", () => {
  // count til 2000000000 previously SIGKILL'd the test worker (Float64Array of 16GB).
  for (const src of ["count til 2000000000", "count 100000000#1", "count 100000000?10", "count where 100000000", "count 100000000?`"]) {
    const e = err(src);
    expect(e?.qname, src).toBe("limit");
    expect(e?.hint, src).toMatch(/too large to run in the browser/);
  }
});

test("sizes the corpus already runs are unchanged", () => {
  const s = new Session();
  expect(s.evaluate("count til 1000000").text).toBe("1000000");
  expect(s.evaluate("count 5#1").text).toBe("5");
  expect(s.evaluate("count 5?10").text).toBe("5");
  expect(s.evaluate("where 2 0 1").text).toBe("0 0 2");
});

test("a deal that doesn't fit is still a length error, not a size limit", () => {
  expect(err("-100000000?10")?.qname).toBe("length");
});

test("an already-expired run budget stops til", () => {
  expect(err("count til 1000", performance.now() - 1)?.qname).toBe("stop");
});

test("til notices a deadline that passes while the list is being filled", () => {
  let ticks = 0;
  performance.now = () => {
    ticks++;
    return ticks < 4 ? 1 : 1e12;
  };
  const e = err("count til 200000", 100);
  expect(e?.qname).toBe("stop");
  expect(e?.hint).toBe("budget");
  expect(ticks).toBeGreaterThanOrEqual(4);
});
