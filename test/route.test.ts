import { describe, expect, test } from "vitest";
import { parseHash } from "../src/lib/route";

describe("hash routes", () => {
  test("the stable routes parse as before", () => {
    expect(parseHash("")).toEqual({ tab: "learn", parts: [] });
    expect(parseHash("#/learn/03-motion")).toEqual({ tab: "learn", parts: ["03-motion"] });
    expect(parseHash("#/sketch/abc123")).toEqual({ tab: "sketch", parts: ["abc123"] });
    expect(parseHash("#/sketch/example/rings")).toEqual({ tab: "sketch", parts: ["example", "rings"] });
    expect(parseHash("#/s/N4Igdg")).toEqual({ tab: "sketch", parts: ["shared", "N4Igdg"] });
    expect(parseHash("#/dojo/dot")).toEqual({ tab: "dojo", parts: ["dot"] });
    expect(parseHash("#/ref/til")).toEqual({ tab: "ref", parts: ["til"] });
    expect(parseHash("#/nowhere")).toEqual({ tab: "learn", parts: [] });
  });

  test("percent-escapes are decoded", () => {
    expect(parseHash("#/ref/%2B")).toEqual({ tab: "ref", parts: ["+"] });
  });

  test("a malformed escape keeps the raw segment instead of throwing", () => {
    expect(parseHash("#/s/abc%E0%A4%A")).toEqual({ tab: "sketch", parts: ["shared", "abc%E0%A4%A"] });
    expect(parseHash("#/sketch/%zz")).toEqual({ tab: "sketch", parts: ["%zz"] });
    expect(parseHash("#/ref/%")).toEqual({ tab: "ref", parts: ["%"] });
  });
});
