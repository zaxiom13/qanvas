import { expect, test } from "vitest";
import { sketchesFromBundle, sketchesToBundle, MAX_IMPORT } from "../src/lib/backup";
import type { Sketch } from "../src/lib/storage";

const sketch = (id: string, code = "til 3", name = "Rings"): Sketch => ({ id, name, code, created: 10, updated: 20, from: "hello" });

let n = 0;
const mint = () => "id" + ++n;

test("a backup round-trips name, code and the example it came from", () => {
  n = 0;
  const text = sketchesToBundle([sketch("a", "circle[center;10;`red]", "Dot")]);
  const plan = sketchesFromBundle(text, [], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add).toEqual([sketch("a", "circle[center;10;`red]", "Dot")]);
  expect(plan.skipped).toBe(0);
});

test("an id that is already on this device gets a new one", () => {
  n = 0;
  const text = sketchesToBundle([sketch("a", "keep me")]);
  const plan = sketchesFromBundle(text, ["a"], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add[0].id).toBe("id1");
  expect(plan.add[0].code).toBe("keep me");
});

test("a broken file is refused and a bad entry is skipped", () => {
  expect(sketchesFromBundle("{", [], mint)).toEqual({ error: "That file isn't JSON." });
  expect(sketchesFromBundle("[]", [], mint)).toEqual({ error: "That file isn't a Qanvas sketch backup." });
  const mixed = JSON.stringify({
    kind: "qanvas-sketches",
    version: 1,
    sketches: [{ name: "ok", code: "1+1" }, { name: "nope" }, { code: "1" }],
  });
  const plan = sketchesFromBundle(mixed, [], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add).toHaveLength(1);
  expect(plan.add[0].code).toBe("1+1");
  expect(plan.skipped).toBe(2);
});

test("a newer backup version is not guessed at", () => {
  const text = JSON.stringify({ kind: "qanvas-sketches", version: 2, sketches: [] });
  expect(sketchesFromBundle(text, [], mint)).toEqual({ error: "That backup was made by a newer Qanvas. This one can only read version 1." });
});

test("importing the same backup again does not add a second copy", () => {
  n = 0;
  const saved = sketch("a", "circle[center;10;`red]", "Dot");
  const text = sketchesToBundle([saved]);
  const plan = sketchesFromBundle(text, [saved], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add).toEqual([]);
  expect(plan.already).toBe(1);
  expect(plan.skipped).toBe(0);
});

test("the same name and code under a different id is still a new sketch", () => {
  n = 0;
  const text = sketchesToBundle([sketch("b", "til 3", "Rings")]);
  const plan = sketchesFromBundle(text, [sketch("a", "til 3", "Rings")], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add.map((s) => s.id)).toEqual(["b"]);
  expect(plan.already).toBe(0);
});

test("the same id with different code is copied, not overwritten", () => {
  n = 0;
  const text = sketchesToBundle([sketch("a", "keep me", "Rings")]);
  const plan = sketchesFromBundle(text, [sketch("a", "old code", "Rings")], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add[0].id).toBe("id1");
  expect(plan.add[0].code).toBe("keep me");
  expect(plan.already).toBe(0);
});

test("a long name matches the 200-character name stored on the device", () => {
  n = 0;
  const long = "n".repeat(300);
  const saved = sketch("a", "til 3", long.slice(0, 200));
  const text = sketchesToBundle([sketch("a", "til 3", long)]);
  const plan = sketchesFromBundle(text, [saved], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add).toEqual([]);
  expect(plan.already).toBe(1);
});

test("a second copy of the same sketch inside one file is not added twice", () => {
  n = 0;
  const text = sketchesToBundle([sketch("a", "til 3"), sketch("a", "til 3")]);
  const plan = sketchesFromBundle(text, [], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add).toHaveLength(1);
  expect(plan.already).toBe(1);
});

test("a huge file does not schedule more than the cap", () => {
  n = 0;
  const sketches = Array.from({ length: MAX_IMPORT + 3 }, (_, i) => sketch("s" + i, "c" + i));
  const plan = sketchesFromBundle(sketchesToBundle(sketches), [], mint);
  expect("error" in plan).toBe(false);
  if ("error" in plan) return;
  expect(plan.add).toHaveLength(MAX_IMPORT);
  expect(plan.skipped).toBe(3);
});
