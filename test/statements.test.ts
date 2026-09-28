import { describe, expect, test } from "vitest";
import { runSketch } from "./examples.test";
import { formatError } from "../src/q/errors";
import { sketchSession } from "./helpers";

const draw = (body: string) => `draw:{\n${body}\n }`;

describe("statements in a draw body", () => {
  test("separated by ; they run top to bottom, each shape taking the ink set above it", () => {
    const { s, calls, fills } = sketchSession();
    s.run(`ink \`blue; circle[300 300;40]; ink \`red; rect[(100 200);(280 200)]`);
    expect(calls.filter((c) => /^(arc|rect)\(/.test(c)).map((c) => c.split("(")[0])).toEqual(["arc", "rect"]);
    expect(fills).toHaveLength(2);
    expect(fills[0]).not.toEqual(fills[1]);
  });

  test("a missing ; after a shape call is an error, not a silent reordering", () => {
    // Line 3 has no `;`, so q reads lines 3-5 as one expression and evaluates it right to left:
    // rect first, then ink `red, then circle -- which is how the circle ended up red.
    const src = draw(`  ink hsb[0.5;0.6;1];\n  circle[300 300;40]\n  ink \`red\n  rect[(100 200);(280 200)]`);
    const r = runSketch(src, 1);
    expect(r.error).toMatch(/^draw \(frame 0\): 'type circle\[\.\.\.\] gives back nothing/);
    expect(r.error).toContain("Missing a ;");
  });

  test("the error points at the circle call", () => {
    const { s } = sketchSession();
    const src = "f:{\n  circle[300 300;40]\n  ink `red\n}\nf[]";
    let err: any;
    try { s.run(src); } catch (e) { err = e; }
    expect(err.qname).toBe("type");
    const caret = formatError(err, src).split("\n");
    expect(caret[1]).toContain("circle[300 300;40]");
    expect(caret[2].trim()).toBe("^".repeat("circle[300 300;40]".length));
  });

  test("applying a real function result by juxtaposition still works", () => {
    const { s, out } = sketchSession();
    s.run(`add:{x+y}; show add[1] 2`);
    expect(out.join("")).toContain("3");
  });
});
