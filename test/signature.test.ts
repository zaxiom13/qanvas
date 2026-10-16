import { expect, test } from "vitest";
import { callHint, hintParts } from "../src/editor/signature";

const at = (src: string, needle: string) => {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error("missing " + needle);
  return i + needle.length;
};

test("the hint names the draw call and the argument under the cursor", () => {
  const src = "circle[300 300;100]";
  const radius = callHint(src, at(src, "300 300;"));
  expect(radius?.name).toBe("circle");
  expect(radius?.arg).toBe(1);
  expect(hintParts(radius!)).toEqual({ lead: "circle[p;", active: "r", tail: "]" });

  const point = callHint(src, at(src, "circle["));
  expect(point?.arg).toBe(0);
  expect(hintParts(point!).active).toBe("p");
});

test("a nested call hints the inner name", () => {
  const src = "circle[hsb[0.2;1;1];40]";
  const hue = callHint(src, at(src, "hsb["));
  expect(hue?.name).toBe("hsb");
  expect(hue?.arg).toBe(0);
  const radius = callHint(src, at(src, "1];"));
  expect(radius?.name).toBe("circle");
  expect(radius?.arg).toBe(1);
});

test("a semicolon inside a string does not start the next argument", () => {
  const src = 'text[100 100;"a;b"]';
  const h = callHint(src, at(src, ';"a'));
  expect(h?.name).toBe("text");
  expect(h?.arg).toBe(1);
});

test("no hint outside a call, or for a name that is not in the reference", () => {
  expect(callHint("circle[1]", 0)).toBeNull();
  expect(callHint("foo[1;2]", 5)).toBeNull();
  expect(callHint("background 20", 12)).toBeNull();
});

test("an empty bracket call still shows its signature", () => {
  const src = "push[]";
  const h = callHint(src, at(src, "push["));
  expect(h?.name).toBe("push");
  expect(h?.params).toEqual([]);
  expect(hintParts(h!)).toEqual({ lead: "push[]", active: null, tail: "" });
});
