import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { runSketch } from "./helpers";
import "./dom-shims";

// Every ```q block in the user guide must run cleanly, so the guide can't drift from the app.
const guide = readFileSync(new URL("../docs/guide/README.md", import.meta.url), "utf8");
const blocks = [...guide.matchAll(/```q\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("docs/guide snippets run", () => {
  test("the guide has q snippets", () => expect(blocks.length).toBeGreaterThanOrEqual(5));
  blocks.forEach((code, i) => {
    test(`snippet ${i + 1}: ${code.split("\n")[0]}`, () => {
      const r = runSketch(code, 3);
      expect(r.error).toBeNull();
      if (/circle/.test(code)) expect(r.calls.some((c) => c.startsWith("arc("))).toBe(true);
    });
  });
});
