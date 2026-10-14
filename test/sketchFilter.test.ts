import { expect, test } from "vitest";
import { filterByName } from "../src/lib/sketchFilter";

const mine = [{ name: "Rings" }, { name: "Orbits" }, { name: "ring study" }, { name: "Checkerboard" }];

test("an empty filter keeps every sketch", () => {
  expect(filterByName(mine, "   ")).toBe(mine);
});

test("the filter matches any part of the name, in any case", () => {
  expect(filterByName(mine, "ring").map((s) => s.name)).toEqual(["Rings", "ring study"]);
  expect(filterByName(mine, "  ORB ").map((s) => s.name)).toEqual(["Orbits"]);
});

test("a name that is not there yields an empty list", () => {
  expect(filterByName(mine, "spiral")).toEqual([]);
});
