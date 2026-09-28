import { describe, expect, test } from "vitest";
import { formatError } from "../src/q/errors";
import { runSketch, sketchSession } from "./helpers";
import { Lambda } from "../src/q/fns";
import { nils } from "../src/qanvas/headless";
import "./dom-shims";

const shapes = (calls: string[]) => calls.filter((c) => /^(arc|rect)\(/.test(c)).map((c) => c.split("(")[0]);

describe("a newline ends a statement", () => {
  test("indented lines in draw run top to bottom, each shape taking the ink above it (no ; needed)", () => {
    // the sketch that used to draw the circle red: line 4 has no ';'
    const src = "draw:{\n  background 250;\n  ink hsb[0.5;0.6;1];\n  circle[300 300;40]\n  ink `red\n  rect[(100 200);(280 200)]\n }";
    const { s, calls, fills } = sketchSession();
    s.run(src);
    const draw = s.get("draw") as Lambda;
    s.call(draw, ...nils(draw));
    expect(shapes(calls)).toEqual(["arc", "rect"]);
    expect(fills[0]).not.toEqual("red");
    expect(fills[1]).toBe("red");
    expect(runSketch(src, 2).error).toBeNull();
  });

  test("same result with explicit ; and with newlines", () => {
    const run = (src: string) => {
      const { s, calls, fills } = sketchSession();
      s.run(src);
      return { shapes: shapes(calls), fills };
    };
    expect(run("ink `blue\ncircle[300 300;40]\nink `red\nrect[(100 200);(280 200)]")).toEqual(
      run("ink `blue; circle[300 300;40]; ink `red; rect[(100 200);(280 200)]"),
    );
  });

  test("brackets and parens still span lines", () => {
    const { s, out } = sketchSession();
    s.run("x:(1;\n  2;\n  3)\nf:{[a;\n  b] a+b}\nshow sum x\nshow f[1;\n 2]\nif[1b;\n  show `yes;\n  show `also]");
    expect(out.join("")).toMatch(/6[\s\S]*3[\s\S]*yes[\s\S]*also/);
  });

  test("multi-line lambdas with a params line and blank lines", () => {
    const { s, out } = sketchSession();
    s.run("f:{[a]\n\n  b:a+1\n\n  b*2\n }\nshow f 4");
    expect(out.join("")).toContain("10");
  });

  test("a missing ; on the same line is still an error, not a silent reordering", () => {
    const src = "f:{\n  circle[300 300;40] ink `red\n}\nf[]";
    const { s } = sketchSession();
    let err: any;
    try { s.run(src); } catch (e) { err = e; }
    expect(err.qname).toBe("type");
    expect(err.hint).toContain("Missing a ;");
    const caret = formatError(err, src).split("\n");
    expect(caret[1]).toContain("circle[300 300;40]");
    expect(caret[2].trim()).toBe("^".repeat("circle[300 300;40]".length));
  });

  test("applying a real function result by juxtaposition still works", () => {
    const { s, out } = sketchSession();
    s.run("add:{x+y}\nshow add[1] 2");
    expect(out.join("")).toContain("3");
  });
});
