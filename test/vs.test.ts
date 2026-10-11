import { expect, test } from "vitest";
import { Session } from "../src/q/index";

const show = (src: string) => {
  const r = new Session().evaluate(src);
  if (r.error) return `'${r.error.qname}`;
  return r.text;
};

// Expected lines are the examples on code.kx.com/q/ref/vs/ (read 2026-10-11).
// They were not re-recorded from a KDB-X process.

test("an empty symbol splits a string on newlines and drops one trailing break", () => {
  expect(show('` vs "abc\\ndef\\nghi"')).toBe('"abc"\n"def"\n"ghi"');
  expect(show('` vs "abc\\ndef\\nghi\\n"')).toBe('"abc"\n"def"\n"ghi"');
  expect(show('` vs "abc\\r\\ndef\\r\\nghi"')).toBe('"abc"\n"def"\n"ghi"');
});

test("a newline separator keeps the empty piece a trailing break leaves", () => {
  expect(show('"\\n" vs "abc\\ndef\\nghi\\n"')).toBe('"abc"\n"def"\n"ghi"\n""');
});

test("an empty symbol splits a symbol on dots and a file handle on the last slash", () => {
  expect(show("` vs `mywork.dat")).toBe("`mywork`dat");
  expect(show("` vs `:/home/kdb/data/mywork.dat")).toBe("`:/home/kdb/data`mywork.dat");
});

test("0b vs is the bit pattern from the q reference", () => {
  expect(show("0b vs 23173h")).toBe("0101101010000101b");
  expect(show("0b vs 23173i")).toBe("00000000000000000101101010000101b");
});

test("a long's bits are 64 wide, an assumption from the q long type", () => {
  const bits = show("0b vs 3");
  expect(bits.endsWith("11b")).toBe(true);
  expect(bits.endsWith("b") ? bits.length - 1 : 0).toBe(64);
});

test("a base below 2 stops instead of looping", () => {
  expect(show("0 vs 5")).toBe("'domain");
  expect(show("1 vs 5")).toBe("'domain");
  expect(show("1b vs 5")).toBe("'domain");
});

test("ordinary base and separator splits are unchanged", () => {
  expect(show("2 vs 10")).toBe("1 0 1 0");
  expect(show("10 vs 1995")).toBe("1 9 9 5");
  expect(show("24 60 60 vs 3805")).toBe("1 3 25");
  expect(show('"," vs "a,b,c"')).toBe(',"a"\n,"b"\n,"c"');
});
