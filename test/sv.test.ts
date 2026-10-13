import { expect, test } from "vitest";
import { Session } from "../src/q/index";

const show = (src: string) => {
  const r = new Session().evaluate(src);
  expect(r.error, `${src} ${r.error?.hint ?? ""}`).toBeUndefined();
  return r.text;
};
const err = (src: string) => new Session().evaluate(src).error;

test("empty symbol sv joins lines the way the q reference shows", () => {
  // Cited from code.kx.com/q/ref/sv/ read 2026-10-12. Not a KDB-X recording.
  // Assumption: the separator is "\n" (the Unix example). The browser has no q host OS.
  expect(show('` sv ("one";"two";"three")')).toBe('"one\\ntwo\\nthree\\n"');
  expect(show('` sv enlist "one"')).toBe('"one\\n"');
});

test("0b sv turns 8, 16, 32 and 64 bits into the documented integers", () => {
  // Cited from code.kx.com/q/ref/sv/ "Bits to integer", read 2026-10-12. Not a KDB-X recording.
  expect(show("0b sv 8#1b")).toBe("0xff");
  expect(show("0b sv 16#1b")).toBe("-1h");
  expect(show("0b sv 32#1b")).toBe("-1i");
  expect(show("0b sv 64#1b")).toBe("-1");
  expect(show("0b sv 10000000b")).toBe("0x80");
  expect(show("0b sv 00000001b")).toBe("0x01");
  expect(show("0b sv 1000000000000000b")).toBe("-32768h");
});

test("0b sv of any other length is a length error", () => {
  // Assumption: the reference names lengths 8, 16, 32 and 64 only, so another length is 'length.
  const e = err("0b sv 1011b");
  expect(e?.qname).toBe("length");
  expect(e?.hint).toMatch(/8, 16, 32 or 64/);
});

test("0b sv of a non-boolean list is a type error", () => {
  expect(err("0b sv 1 0 1 1")?.qname).toBe("type");
});

test("ordinary sv is unchanged", () => {
  expect(show('"," sv ("one";"two";"three")')).toBe('"one,two,three"');
  expect(show('", " sv ("one";"two";"three")')).toBe('"one, two, three"');
  expect(show("10 sv 2 3 5 7")).toBe("2357");
  expect(show("100 sv 2010 3 17")).toBe("20100317");
  expect(show("0 24 60 60 sv 2 3 5 7")).toBe("183907");
  expect(show("` sv `quick`brown`fox")).toBe("`quick.brown.fox");
  expect(show("` sv `mywork`dat")).toBe("`mywork.dat");
  expect(show("` sv `:/home/kdb/q`data`2010.03.22`trade")).toBe("`:/home/kdb/q/data/2010.03.22/trade");
  expect(show("2 sv 1 0 1 0")).toBe("10");
});
