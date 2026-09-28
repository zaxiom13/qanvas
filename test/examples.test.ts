import { describe, expect, test } from "vitest";
import { EXAMPLES } from "../src/content/examples";
import { runSketch } from "./helpers";
import "./dom-shims";

describe("examples run without errors", () => {
  for (const ex of EXAMPLES) {
    test(ex.id, () => {
      const r = runSketch(ex.code);
      expect(r.error).toBeNull();
      expect(r.calls.length).toBeGreaterThan(0);
    });
  }
});
