import { expect, test } from "vitest";
import { Session } from "../src/q/index";

const show = (src: string) => {
  const r = new Session().evaluate(src);
  expect(r.error, src + " " + (r.errorText ?? "")).toBeUndefined();
  return r.text;
};

test("ordinary .Q.fmt widths are unchanged", () => {
  expect(show(".Q.fmt[8;2;1.5]")).toBe('"    1.50"');
  expect(show(".Q.fmt[3;2;1.5]")).toBe('"***"');
  expect(show(".Q.fmt[4;1;1.5]")).toBe('" 1.5"');
  expect(show(".Q.fmt[8;2;1.5 2]")).toBe('"    1.50"\n"    2.00"');
  expect(show(".Q.fmt[0;0;1]")).toBe('""');
});

test("a .Q.fmt width past the vector cap is refused before the spaces are built", () => {
  // count .Q.fmt[9000000;0;1.2] previously returned 9000000. The string was built.
  const t0 = performance.now();
  for (const src of [".Q.fmt[8000001;0;1.2]", ".Q.fmt[100000000;2;1 2 3]"]) {
    const e = new Session().evaluate(src).error;
    expect(e?.qname, src).toBe("limit");
    expect(e?.hint, src).toMatch(/too large to run in the browser/);
  }
  expect(performance.now() - t0).toBeLessThan(500);
});

test("a negative .Q.fmt width is a domain error, not a crash", () => {
  const e = new Session().evaluate(".Q.fmt[-3;2;1.5]").error;
  expect(e?.qname).toBe("domain");
});
