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

test("padding a string past the vector cap is refused before the spaces are built", () => {
  // last 100000000$"ab" previously returned a space in 61ms (the string is built, not refused).
  const t0 = performance.now();
  for (const src of [`count 100000000$"ab"`, `count -100000000$"hi"`, `count 100000000$("ab";"cd")`]) {
    const e = err(src);
    expect(e?.qname, src).toBe("limit");
    expect(e?.hint, src).toMatch(/too large to run in the browser/);
  }
  expect(performance.now() - t0).toBeLessThan(500);
});

test("ordinary string pads are unchanged", () => {
  const s = new Session();
  expect(s.evaluate(`10$"ab"`).text).toBe(`"ab        "`);
  expect(s.evaluate(`-3$"hello"`).text).toBe(`"llo"`);
  expect(s.evaluate(`0$"hello"`).text).toBe(`""`);
  expect(s.evaluate(`5$"abcdef"`).text).toBe(`"abcde"`);
  expect(s.evaluate(`3$"ab"`).text).toBe(`"ab "`);
  expect(s.evaluate(`-10$"hi"`).text).toBe(`"        hi"`);
  expect(s.evaluate(`5$("ab";"cdef")`).text).toBe(`"ab   "\n"cdef "`);
  // A single character is a char atom, so this is a cast, not a pad.
  expect(s.evaluate(`10$"a"`).text).toBe(`"a"`);
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

test("a cross product too big to allocate is refused", () => {
  // 4000×4000 is 16,000,000 pairs. 1500×1500 (2,250,000 pairs) used about 650MB and 1.1s here.
  const e = err("count (til 4000) cross til 4000");
  expect(e?.qname).toBe("limit");
  expect(e?.hint).toMatch(/too large to run in the browser/);
});

test("a small cross product is unchanged", () => {
  const s = new Session();
  expect(s.evaluate("count 1 2 cross 10 20").text).toBe("4");
  expect(s.evaluate("1 2 cross 10 20").text).toBe("1 10\n1 20\n2 10\n2 20");
});

test("an already-expired run budget stops cross", () => {
  expect(err("count 1 2 cross 10 20", performance.now() - 1)?.qname).toBe("stop");
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
