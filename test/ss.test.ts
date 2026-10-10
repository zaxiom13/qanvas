import { expect, test } from "vitest";
import { Session } from "../src/q/index";

const show = (src: string) => {
  const r = new Session().evaluate(src);
  expect(r.error, src).toBeUndefined();
  return r.text;
};

test("ss reports overlapping matches", () => {
  // Assumption, cited from the public q reference for ss (code.kx.com/q/ref/ss/):
  // matches may overlap, so "aaa" ss "aa" is 0 1. Not re-recorded from KDB-X.
  expect(show('"aaa" ss "aa"')).toBe("0 1");
  expect(show('"aaaa" ss "aa"')).toBe("0 1 2");
});

test("ss still finds the non-overlapping banana matches from the corpus", () => {
  expect(show('"banana" ss "an"')).toBe("1 3");
  expect(show('"ababc" ss "ab"')).toBe("0 2");
});

test("an empty pattern does not loop", () => {
  expect(show('"abc" ss ""')).toBe("`long$()");
});
