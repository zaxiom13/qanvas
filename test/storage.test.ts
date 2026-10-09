import { beforeEach, describe, expect, test } from "vitest";
import { clearPending, readPending, recoverPending, stashPending, type Sketch } from "../src/lib/storage";

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const stored: Sketch = { id: "a1", name: "Rings", code: "circle[center;50;`red]", created: 1, updated: 100 };

describe("unsaved-edit stash", () => {
  beforeEach(() => mem.clear());

  test("round-trips through localStorage", () => {
    stashPending({ ...stored, code: "new", updated: 200 });
    expect(readPending()).toEqual({ id: "a1", name: "Rings", code: "new", updated: 200 });
  });

  test("a newer stashed edit wins over the stored sketch and keeps its other fields", () => {
    stashPending({ ...stored, code: "new", updated: 200 });
    expect(recoverPending("a1", stored)).toEqual({ ...stored, code: "new", updated: 200 });
  });

  test("an older or equal stash is ignored", () => {
    expect(recoverPending("a1", stored, { id: "a1", name: "Rings", code: "old", updated: 100 })).toBeNull();
    expect(recoverPending("a1", stored, { id: "a1", name: "Rings", code: "old", updated: 50 })).toBeNull();
  });

  test("a stash for another sketch is ignored", () => {
    expect(recoverPending("b2", stored, { id: "a1", name: "Rings", code: "x", updated: 999 })).toBeNull();
  });

  test("a sketch that never reached IndexedDB is rebuilt from the stash", () => {
    expect(recoverPending("a1", undefined, { id: "a1", name: "Lost", code: "x", updated: 300 })).toEqual({ id: "a1", name: "Lost", code: "x", created: 300, updated: 300 });
  });

  test("clearPending only clears the matching sketch", () => {
    stashPending({ ...stored, updated: 200 });
    clearPending("zz");
    expect(readPending()?.id).toBe("a1");
    clearPending("a1");
    expect(readPending()).toBeNull();
  });

  test("garbage in the stash is treated as nothing", () => {
    mem.set("qanvas:pendingSketch", "{not json");
    expect(readPending()).toBeNull();
    mem.set("qanvas:pendingSketch", JSON.stringify({ id: 1, code: 2 }));
    expect(readPending()).toBeNull();
  });
});
