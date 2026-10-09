import { describe, expect, test } from "vitest";
import { decodeShare, encodeShare, findSharedCopy, shareKey, type Sketch } from "../src/lib/storage";

const sk = (id: string, code: string, share?: string): Sketch => ({ id, name: "s", code, created: 1, updated: 1, share });

describe("share links", () => {
  test("round-trip, including odd names", () => {
    const name = "Ünïcode “quotes” / #hash & 🌀";
    expect(decodeShare(encodeShare(name, "til 10\n"))).toEqual({ name, code: "til 10\n" });
  });

  test("damaged payloads decode to null instead of throwing", () => {
    const good = encodeShare("x", "circle[center;10;`red]");
    for (const bad of ["", "%%%", good.slice(0, 12) + "%%%garbage", "not-lz-at-all"]) expect(decodeShare(bad)).toBeNull();
  });

  test("shareKey is stable and separates name and code", () => {
    expect(shareKey("a", "b")).toBe(shareKey("a", "b"));
    expect(shareKey("a", "b")).not.toBe(shareKey("a", "c"));
    expect(shareKey("ab", "")).not.toBe(shareKey("a", "b"));
  });

  test("reopening a link finds the unedited copy it made", () => {
    const key = shareKey("s", "til 3");
    const list = [sk("other", "til 3"), sk("copy", "til 3", key)];
    expect(findSharedCopy(list, key, "til 3")?.id).toBe("copy");
  });

  test("an edited copy is left alone, so the link opens a fresh one", () => {
    const key = shareKey("s", "til 3");
    expect(findSharedCopy([sk("copy", "til 3 / mine", key)], key, "til 3")).toBeUndefined();
  });

  test("sketches saved before share keys existed never match", () => {
    expect(findSharedCopy([sk("old", "til 3")], shareKey("s", "til 3"), "til 3")).toBeUndefined();
  });
});
