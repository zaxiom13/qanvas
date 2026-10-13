import { expect, test } from "vitest";
import { nudgeInto } from "../src/lib/pip";

const bounds = { left: 0, top: 100, right: 390, bottom: 780 };

test("a mini canvas already on screen does not move", () => {
  expect(nudgeInto({ left: 260, top: 606, width: 118, height: 118 }, bounds)).toEqual([0, 0]);
});

test("a mini canvas dragged off the top-left is pulled back", () => {
  // Phone 390×844, after a drag toward (8, 8): the card was at x -51, y -12.
  const [dx, dy] = nudgeInto({ left: -51, top: -12, width: 118, height: 118 }, bounds);
  expect(dx).toBe(59);
  expect(dy).toBe(120);
  expect(-51 + dx).toBe(bounds.left + 8);
  expect(-12 + dy).toBe(bounds.top + 8);
});

test("a mini canvas dragged past the bottom-right stops at the margin", () => {
  const [dx, dy] = nudgeInto({ left: 400, top: 900, width: 118, height: 118 }, { left: 0, top: 0, right: 390, bottom: 844 });
  expect(400 + dx).toBe(390 - 8 - 118);
  expect(900 + dy).toBe(844 - 8 - 118);
});
