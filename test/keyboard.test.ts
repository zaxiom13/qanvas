import { expect, test } from "vitest";
import { shellFrame } from "../src/lib/keyboard";

test("a keyboard that shrinks the visual viewport shrinks the shell", () => {
  // Portrait phone, layout viewport still 844, keyboard covering the bottom.
  expect(shellFrame({ height: 430, offsetTop: 0, scale: 1 })).toEqual({ height: 430, offsetTop: 0 });
  // Some browsers scroll the visual viewport up instead of only shrinking it.
  expect(shellFrame({ height: 390, offsetTop: 280, scale: 1 })).toEqual({ height: 390, offsetTop: 280 });
});

test("a phone with no keyboard uses the visual height and no offset", () => {
  expect(shellFrame({ height: 844, offsetTop: 0, scale: 1 })).toEqual({ height: 844, offsetTop: 0 });
  expect(shellFrame({ height: 389.4, offsetTop: 0.2, scale: 1 })).toEqual({ height: 389, offsetTop: 0 });
});

test("pinch zoom leaves the shell on the CSS fallback", () => {
  expect(shellFrame({ height: 400, offsetTop: 80, scale: 1.5 })).toBeNull();
  expect(shellFrame({ height: 0, offsetTop: 0, scale: 1 })).toBeNull();
  expect(shellFrame({ height: 800, offsetTop: 0, scale: 0 })).toBeNull();
});
