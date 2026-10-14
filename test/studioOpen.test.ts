import { beforeEach, describe, expect, test } from "vitest";
import { chooseStudioSketch, forgetSketchPointer, rememberSketch, replaceDeletedSketch } from "../src/lib/studioOpen";
import { readPending, stashPending, type Sketch } from "../src/lib/storage";

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const sketch = (id: string, code = "circle[center;10;`red]", name = id): Sketch => ({
  id, name, code, created: 1, updated: 2,
});

describe("chooseStudioSketch", () => {
  const fresh = sketch("fresh", "background 20", "Untitled sketch");
  const rings = sketch("rings");
  const orbits = sketch("orbits", "background 30", "Orbits");

  test("an existing route id opens that sketch and leaves the hash alone", () => {
    const choice = chooseStudioSketch({ routeId: "rings", lastId: "orbits", stored: rings, pending: null, newest: orbits, fresh });
    expect(choice.sketch).toBe(rings);
    expect(choice.persist).toBe(false);
    expect(choice.replaceWithId).toBeNull();
    expect(choice.clearRoute).toBe(false);
  });

  test("a bare #/sketch opens the last sketch", () => {
    const choice = chooseStudioSketch({ routeId: "", lastId: "rings", stored: rings, pending: null, newest: orbits, fresh });
    expect(choice.sketch.id).toBe("rings");
    expect(choice.replaceWithId).toBeNull();
    expect(choice.rememberId).toBeUndefined();
  });

  test("a deleted route id opens the newest remaining sketch and replaces the hash", () => {
    const choice = chooseStudioSketch({ routeId: "gone", lastId: "gone", stored: undefined, pending: null, newest: orbits, fresh });
    expect(choice.sketch.id).toBe("orbits");
    expect(choice.replaceWithId).toBe("orbits");
    expect(choice.rememberId).toBe("orbits");
    expect(choice.persist).toBe(false);
  });

  test("a deleted lastSketch with no route id opens the newest sketch without changing the hash", () => {
    const choice = chooseStudioSketch({ routeId: "", lastId: "gone", stored: undefined, pending: null, newest: orbits, fresh });
    expect(choice.sketch.id).toBe("orbits");
    expect(choice.replaceWithId).toBeNull();
    expect(choice.rememberId).toBe("orbits");
  });

  test("a deleted id with nothing else saved shows a fresh canvas and clears a dead route", () => {
    const choice = chooseStudioSketch({ routeId: "gone", lastId: "gone", stored: undefined, pending: null, newest: undefined, fresh });
    expect(choice.sketch).toBe(fresh);
    expect(choice.persist).toBe(false);
    expect(choice.clearRoute).toBe(true);
    expect(choice.rememberId).toBeNull();
  });

  test("a stashed edit for a sketch that never reached the database is recovered", () => {
    const pending = { id: "rings", name: "Rings", code: "new", updated: 50 };
    const choice = chooseStudioSketch({ routeId: "rings", lastId: null, stored: undefined, pending, newest: orbits, fresh });
    expect(choice.sketch.code).toBe("new");
    expect(choice.persist).toBe(true);
    expect(choice.replaceWithId).toBeNull();
  });
});

describe("forgetSketchPointer", () => {
  beforeEach(() => mem.clear());

  test("clears lastSketch and the stash only when they name this sketch", () => {
    rememberSketch("rings");
    stashPending({ ...sketch("rings"), updated: 9 });
    forgetSketchPointer("other");
    expect(localStorage.getItem("qanvas:lastSketch")).toBe("rings");
    expect(readPending()?.id).toBe("rings");
    forgetSketchPointer("rings");
    expect(localStorage.getItem("qanvas:lastSketch")).toBeNull();
    expect(readPending()).toBeNull();
  });
});

describe("replaceDeletedSketch", () => {
  test("leaves a different open sketch alone and falls back to a fresh one", () => {
    const open = sketch("rings");
    const other = sketch("orbits");
    const fresh = sketch("fresh");
    expect(replaceDeletedSketch("rings", "orbits", [open], fresh)).toBeNull();
    expect(replaceDeletedSketch("rings", "rings", [other], fresh)?.id).toBe("orbits");
    expect(replaceDeletedSketch("rings", "rings", [], fresh)?.id).toBe("fresh");
  });
});
