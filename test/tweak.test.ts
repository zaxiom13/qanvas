import { describe, expect, test } from "vitest";
import { applyTweak, formatNum, scan, stepFor } from "../src/drawing/tweak";
import { EXAMPLES } from "../src/content/examples";
import { LESSONS } from "../src/content/lessons";

const nums = (src: string) => scan(src).tweaks.filter((t) => t.kind === "num").map((t) => src.slice(t.from, t.to));

describe("tweak scanner", () => {
  test("finds plain numbers", () => {
    expect(nums("circle[300 300;100]")).toEqual(["300", "300", "100"]);
    expect(nums("hsb[0.55;0.6;1]")).toEqual(["0.55", "0.6", "1"]);
    expect(nums("x:3f; y:10j")).toEqual(["3f", "10j"]);
  });
  test("skips dates, times, nulls, booleans, hex, names, comments, strings", () => {
    expect(nums("d:2026.10.31; t:12:30; n:0N; w:0w; b:101b; h:0x1f; x1:5; / 99 bottles\n\"7 up\"")).toEqual(["5"]);
    expect(nums("a / comment 3\nb:4")).toEqual(["4"]);
    expect(nums("x/y 2")).toEqual(["2"]);
  });
  test("negative literals only where q reads a sign", () => {
    const s = "a:-5; b:x-1; c:(-2 3)";
    const ts = scan(s).tweaks.filter((t) => t.kind === "num");
    expect(ts.map((t) => s.slice(t.from, t.to))).toEqual(["-5", "1", "-2", "3"]);
    const sub = ts[1];
    expect(sub.kind === "num" && sub.signed).toBe(false);
    if (sub.kind === "num") expect(formatNum(sub, -3)).toBe("0");
  });
  test("colours and palettes", () => {
    const s = "ink `coral; ink palette `sunset; x:`notacolour";
    const ts = scan(s).tweaks;
    expect(ts.map((t) => t.kind)).toEqual(["color", "palette"]);
  });
  test("pieces reassemble into the source exactly", () => {
    for (const src of [
      ...EXAMPLES.map((e) => e.code),
      ...LESSONS.flatMap((l) => l.blocks.map((b) => (b.kind === "cell" ? b.code : b.kind === "challenge" ? b.solution : ""))),
    ]) {
      expect(scan(src).pieces.map((p) => p.text).join("")).toBe(src);
    }
  });
  test("stepping keeps format", () => {
    const s = "r:0.25; n:300; m:7; f:2.5f";
    const ts = scan(s).tweaks.filter((t) => t.kind === "num");
    expect(ts.map(stepFor)).toEqual([0.01, 10, 1, 0.1]);
    expect(applyTweak(s, ts[0], formatNum(ts[0], 0.25 + 0.01))).toBe("r:0.26; n:300; m:7; f:2.5f");
    expect(applyTweak(s, ts[3], formatNum(ts[3], 2.6))).toBe("r:0.25; n:300; m:7; f:2.6f");
  });
  test("every tweak of every example still parses", async () => {
    const { parse } = await import("../src/q/parser");
    for (const e of EXAMPLES) {
      const { tweaks } = scan(e.code);
      for (const t of tweaks) {
        if (t.kind !== "num") continue;
        for (const v of [t.value + stepFor(t) * 10, t.value - stepFor(t) * 10]) {
          const next = applyTweak(e.code, t, formatNum(t, v));
          expect(() => parse(next), `${e.id}: ${next.slice(Math.max(0, t.from - 10), t.from + 15)}`).not.toThrow();
        }
      }
    }
  });
});
