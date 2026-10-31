import { describe, expect, test } from "vitest";
import { EXAMPLES } from "../src/content/examples";
import { TOYS } from "../src/content/toys";
import { Lambda } from "../src/q/fns";
import { bool, float, floats, long } from "../src/q/index";
import { nils } from "../src/runtime/session";
import { runSketch, sketchSession } from "./helpers";
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

describe("play deck and new primitives", () => {
  test("every toy in the Play deck resolves to an example", () => {
    expect(TOYS.length).toBeGreaterThanOrEqual(8);
    for (const t of TOYS) {
      expect(t.example.code.length).toBeGreaterThan(10);
      expect(t.nudge.length).toBeGreaterThan(5);
    }
  });

  test("new drawing, palette, motion and sound primitives evaluate cleanly", () => {
    const { s } = sketchSession();
    for (const ex of [
      "glow 20",
      "glow 0",
      "fade 30",
      "palette `sunset",
      "count palette `metro",
      "ink palette `neon; circle[(til 5;5#100);10]",
      "ngon[300 300;100;6]",
      "star[300 300;120;5]",
      "wave 2",
      "note 60",
      "note 60 64 67",
      "buzz 20",
      "tilt",
      "shake",
      "background `night; fade 40",
    ]) {
      const r = s.evaluate(ex);
      expect([ex, r.error ? r.error.qname + " " + r.error.hint : "ok"]).toEqual([ex, "ok"]);
    }
    expect(s.evaluate("palette `nope").error?.hint).toMatch(/sunset/);
    expect(s.evaluate("type tilt").text.trim()).toBe("9h");
  });

  test("interactive examples handle taps, tilt and shake", () => {
    for (const t of TOYS) {
      const { s } = sketchSession();
      const ns = s.nsMap(".qv");
      s.run(t.example.code);
      const setup = s.get("setup");
      if (setup instanceof Lambda) s.call(setup, ...nils(setup));
      const draw = s.get("draw");
      if (!(draw instanceof Lambda)) continue;
      for (let i = 0; i < 6; i++) {
        ns.set("mouse", floats([120 + i * 60, 150 + i * 40]));
        ns.set("pmouse", floats([100 + i * 60, 140 + i * 40]));
        ns.set("mousedown", bool(i % 2 === 0));
        ns.set("clicked", bool(i === 1));
        ns.set("tilt", floats([0.3, -0.2]));
        ns.set("shake", float(i === 2 ? 1.1 : 0));
        ns.set("frame", long(i));
        ns.set("time", float(i / 60));
        s.call(draw, ...nils(draw));
      }
    }
  });
});
