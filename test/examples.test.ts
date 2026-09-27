import { describe, expect, test } from "vitest";
import { EXAMPLES } from "../src/content/examples";
import { Lambda } from "../src/q/fns";
import { NIL, float, long } from "../src/q/index";
import { sketchSession } from "./helpers";
import { nils } from "../src/qanvas/headless";
import "./dom-shims";

/** Run a sketch like the runtime does: top level, setup, then a few frames of draw. */
export function runSketch(code: string, frames = 3) {
  const { s, calls, out } = sketchSession();
  const fail = (stage: string, e: unknown) => {
    const err = e as { qname?: string; hint?: string; message?: string };
    return `${stage}: '${err.qname ?? err.message} ${err.hint ?? ""}`;
  };
  try {
    s.run(code);
  } catch (e) {
    return { error: fail("top level", e), calls, out };
  }
  for (const name of ["setup", "draw"]) {
    const f = s.get(name);
    if (!(f instanceof Lambda)) continue;
    const times = name === "draw" ? frames : 1;
    for (let i = 0; i < times; i++) {
      s.nsMap(".qv").set("frame", long(i));
      s.nsMap(".qv").set("time", float(i / 60));
      try {
        s.call(f, ...nils(f as Lambda));
      } catch (e) {
        return { error: fail(`${name} (frame ${i})`, e), calls, out };
      }
    }
  }
  return { error: null, calls, out };
}

describe("examples run without errors", () => {
  for (const ex of EXAMPLES) {
    test(ex.id, () => {
      const r = runSketch(ex.code);
      expect(r.error).toBeNull();
      expect(r.calls.length).toBeGreaterThan(0);
    });
  }
});
