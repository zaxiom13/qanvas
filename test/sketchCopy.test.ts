import { expect, test } from "vitest";
import { copySketch } from "../src/lib/sketchCopy";
import type { Sketch } from "../src/lib/storage";

const rings: Sketch = {
  id: "rings",
  name: "Rings",
  code: "circle[center;40;`coral]",
  created: 10,
  updated: 20,
  thumb: "data:image/png;base64,abc",
  from: "hello",
  share: "abc123",
};

test("a copy gets a new id and name and keeps the code", () => {
  const copy = copySketch(rings, 50, "copy1");
  expect(copy).toEqual({
    id: "copy1",
    name: "Copy of Rings",
    code: rings.code,
    created: 50,
    updated: 50,
    thumb: rings.thumb,
    from: "hello",
  });
  expect(copy).not.toHaveProperty("share");
});

test("a very long name is cut so it still fits the backup limit", () => {
  const copy = copySketch({ ...rings, name: "n".repeat(300) }, 1, "c");
  expect(copy.name.length).toBe(200);
  expect(copy.name.startsWith("Copy of ")).toBe(true);
});
