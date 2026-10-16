import { expect, test } from "vitest";
import { ERROR_HELP, QError } from "../src/q/errors";
import { errorCardText, explainError } from "../src/lib/explain";
import { Session } from "../src/q/index";

test("every engine error name has a plain-English line", () => {
  for (const name of ["type", "length", "rank", "domain", "nyi", "value", "parse", "index", "limit", "stack", "mismatch", "wsfull", "assign", "cond", "stop", "params", "return", "s-fail", "u-fail", "internal"]) {
    expect(ERROR_HELP[name], name).toMatch(/\w/);
  }
});

test("a stop with no hint still says it was stopped", () => {
  const e = explainError(new QError("stop"), "x");
  expect(e.help).toBeUndefined();
  expect(e.hint).toBe("Stopped.");
});

test("a budget stop keeps its own sentence", () => {
  const hint = "Your code ran for more than 8s, so it was stopped. Is there a loop that never ends?";
  const e = explainError(new QError("stop", hint), "while[1;]");
  expect(e.hint).toBe(hint);
  expect(e.help).toBeUndefined();
});

test("a type error with no specific hint still has a sentence on a compact card", () => {
  // 10 vs 1 2 is a base encode of a list. The engine raises 'type with no hint.
  const s = new Session();
  const err = s.evaluate("10 vs 1 2").error;
  expect(err?.qname).toBe("type");
  expect(err?.hint).toBeUndefined();
  const explained = explainError(err!, "10 vs 1 2");
  expect(explained.help).toBe(ERROR_HELP.type);
  expect(errorCardText(explained, true)).toEqual({ beside: null, body: ERROR_HELP.type });
  expect(errorCardText(explained, false)).toEqual({ beside: null, body: ERROR_HELP.type });
});

test("a specific hint stays the card body, and the short line stays beside the name only when there is room", () => {
  const e = explainError(new QError("type", "til needs a whole number, like til 10."), "til 1.5");
  expect(errorCardText(e, true)).toEqual({ beside: null, body: "til needs a whole number, like til 10." });
  expect(errorCardText(e, false).beside).toBe(ERROR_HELP.type);
  expect(errorCardText(e, false).body).toBe("til needs a whole number, like til 10.");
});
