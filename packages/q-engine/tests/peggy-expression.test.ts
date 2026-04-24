import { describe, expect, it } from "vitest";
import { parsePeggyExpressionForTests } from "../src/index";

describe("Peggy expression grammar", () => {
  it("parses atoms, vectors, and right-argument vectors", () => {
    expect(parsePeggyExpressionForTests("1 2 3")).toMatchObject({
      kind: "vector",
      items: [{ kind: "number", value: "1" }, { kind: "number", value: "2" }, { kind: "number", value: "3" }]
    });
    expect(parsePeggyExpressionForTests("sum 1 2 3")).toMatchObject({
      kind: "call",
      callee: { kind: "identifier", name: "sum" },
      args: [{ kind: "vector", items: [{ kind: "number" }, { kind: "number" }, { kind: "number" }] }]
    });
  });

  it("parses assignment, amend assignment, binaries, and dictionaries", () => {
    expect(parsePeggyExpressionForTests("a:1")).toMatchObject({
      kind: "assign",
      name: "a",
      value: { kind: "number", value: "1" }
    });
    expect(parsePeggyExpressionForTests("a+:2")).toMatchObject({
      kind: "assign",
      name: "a",
      value: { kind: "binary", op: "+", left: { kind: "identifier", name: "a" } }
    });
    expect(parsePeggyExpressionForTests("1+2")).toMatchObject({
      kind: "binary",
      op: "+",
      left: { kind: "number", value: "1" },
      right: { kind: "number", value: "2" }
    });
    expect(parsePeggyExpressionForTests("`a`b!1 2")).toMatchObject({
      kind: "binary",
      op: "!",
      left: { kind: "vector", items: [{ kind: "symbol", value: "a" }, { kind: "symbol", value: "b" }] },
      right: { kind: "vector", items: [{ kind: "number", value: "1" }, { kind: "number", value: "2" }] }
    });
  });

  it("parses bracket calls, projections, strings as applicable values, and tables", () => {
    expect(parsePeggyExpressionForTests("f[;2]")).toMatchObject({
      kind: "call",
      callee: { kind: "identifier", name: "f" },
      args: [{ kind: "placeholder" }, { kind: "number", value: "2" }]
    });
    expect(parsePeggyExpressionForTests("\"abc\" 1 0")).toMatchObject({
      kind: "call",
      callee: { kind: "string", value: "abc" },
      args: [{ kind: "vector", items: [{ kind: "number", value: "1" }, { kind: "number", value: "0" }] }]
    });
    expect(parsePeggyExpressionForTests("([]a:1 2;b:`x`y)")).toMatchObject({
      kind: "table",
      columns: [
        { name: "a", value: { kind: "vector" } },
        { name: "b", value: { kind: "vector" } }
      ]
    });
  });

  it("parses core control forms and adverb bracket calls", () => {
    expect(parsePeggyExpressionForTests("if[x>0;show x]")).toMatchObject({
      kind: "if",
      condition: { kind: "binary", op: ">" },
      body: [{ kind: "call", callee: { kind: "identifier", name: "show" } }]
    });
    expect(parsePeggyExpressionForTests("+/[1 2 3]")).toMatchObject({
      kind: "call",
      callee: { kind: "identifier", name: "+/" },
      args: [{ kind: "vector" }]
    });
    expect(parsePeggyExpressionForTests("(*/) n")).toMatchObject({
      kind: "call",
      callee: { kind: "group", value: { kind: "identifier", name: "*/" } },
      args: [{ kind: "identifier", name: "n" }]
    });
    expect(parsePeggyExpressionForTests("f/[0;1 2 3]")).toMatchObject({
      kind: "call",
      callee: { kind: "identifier", name: "/" },
      args: [{ kind: "identifier", name: "f" }, { kind: "number", value: "0" }, { kind: "vector" }]
    });
  });
});
