import { describe, expect, it } from "vitest";
import { parse, type AstNode } from "../src/index";

const stripSource = (node: AstNode): unknown =>
  JSON.parse(
    JSON.stringify(node, (key, value) => (key === "source" && typeof value === "string" ? undefined : value))
  );

describe("q parser grammar corpus", () => {
  it("parses statement separators, comments, directives, and empty programs", () => {
    expect(stripSource(parse(" / only a comment"))).toEqual({
      kind: "program",
      statements: []
    });
    expect(stripSource(parse("\\l ignored-by-browser\n1;2"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "number", value: "1" }, { kind: "number", value: "2" }]
    });
    expect(stripSource(parse("a:1 / trailing\nb:2"))).toMatchObject({
      kind: "program",
      statements: [
        { kind: "assign", name: "a", value: { kind: "number", value: "1" } },
        { kind: "assign", name: "b", value: { kind: "number", value: "2" } }
      ]
    });
  });

  it("parses atom, vector, list, group, table, and keyed-table syntax", () => {
    expect(stripSource(parse("1 2 3i"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "vector", items: [{ kind: "number" }, { kind: "number" }, { kind: "number" }] }]
    });
    expect(stripSource(parse("(1;2 3;`a)"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "list", items: [{ kind: "number" }, { kind: "vector" }, { kind: "symbol" }] }]
    });
    expect(stripSource(parse("([] a:1 2;b:`x`y)"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "table", columns: [{ name: "a" }, { name: "b" }] }]
    });
    expect(stripSource(parse("([k:`a`b] v:10 20;w:30 40)"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "keyedTable", keys: [{ name: "k" }], values: [{ name: "v" }, { name: "w" }] }]
    });
  });

  it("parses assignment families and namespace names", () => {
    expect(stripSource(parse(".qv.state::42;.qv.state+:1;.qv.state"))).toMatchObject({
      kind: "program",
      statements: [
        { kind: "assignGlobal", name: ".qv.state" },
        {
          kind: "assign",
          name: ".qv.state",
          value: { kind: "binary", op: "+", left: { kind: "identifier", name: ".qv.state" } }
        },
        { kind: "identifier", name: ".qv.state" }
      ]
    });
  });

  it("parses lambda, return, control, conditional, and projection forms", () => {
    expect(stripSource(parse("{[x;y] a:x+y; :a}"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "lambda", params: ["x", "y"], body: [{ kind: "assign" }, { kind: "return" }] }]
    });
    expect(stripSource(parse("if[x>0;show x];while[x<3;x+:1];do[3;show x]"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "if" }, { kind: "while" }, { kind: "do" }]
    });
    expect(stripSource(parse("$[x<0;`neg;x=0;`zero;`pos]"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "cond", branches: [{}, {}], elseValue: { kind: "symbol", value: "pos" } }]
    });
    expect(stripSource(parse("{x+y}[;2];+[;1];@[2+;3;4]"))).toMatchObject({
      kind: "program",
      statements: [
        { kind: "call", args: [{ kind: "placeholder" }, { kind: "number", value: "2" }] },
        { kind: "call", args: [{ kind: "placeholder" }, { kind: "number", value: "1" }] },
        { kind: "call", callee: { kind: "identifier", name: "@" } }
      ]
    });
  });

  it("parses right-to-left application, indexing, and applicable values", () => {
    expect(stripSource(parse("palette (idx+t) mod count palette"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "call", callee: { kind: "identifier", name: "palette" } }]
    });
    expect(stripSource(parse("(`a`b!10 20) `a; (1 2 3)[0 2]; m[1 3;2 4]"))).toMatchObject({
      kind: "program",
      statements: [
        { kind: "call", callee: { kind: "group" } },
        { kind: "call", callee: { kind: "group" } },
        { kind: "call", callee: { kind: "identifier", name: "m" } }
      ]
    });
    expect(stripSource(parse("\"abcdef\" 1 0 3"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "call", callee: { kind: "string", value: "abcdef" } }]
    });
  });

  it("parses derived functions, iterators, and adverb call forms", () => {
    const ast = stripSource(
      parse("+/[1 2 3]; +\\[1000;1 2 3]; (+/) 1 2 3; {x+y}/[0;1 2 3]; -':[10;15 27 93]; count each string til 3")
    );
    expect(ast).toMatchObject({
      kind: "program",
      statements: [
        { kind: "call", callee: { kind: "identifier", name: "+/" } },
        { kind: "call", callee: { kind: "identifier", name: "+\\" } },
        { kind: "call", callee: { kind: "group" } },
        { kind: "call", callee: { kind: "identifier", name: "/" } },
        { kind: "call", callee: { kind: "identifier", name: "-':" } },
        { kind: "each", callee: { kind: "identifier", name: "count" } }
      ]
    });
    expect(() => parse("percent:1.2; i:0 1+\\:floor percent; i")).not.toThrow();
    expect(() => parse("flip each (enlist `a`b;enlist 1 2)")).not.toThrow();
  });

  it("parses Rosetta-style projections, continuations, and file-handle operators", () => {
    expect(() => parse("sd:sum s@")).not.toThrow();
    expect(() => parse("sn:{sum xexp[;-2] 1+til x}")).not.toThrow();
    expect(() => parse("text:(\n  \"a\";\n  \"b\" )")).not.toThrow();
    expect(() => parse("DAYS:\"first second\",\n  \" third fourth\"")).not.toThrow();
    expect(() => parse("(count'')s:\"$\"vs/:txt")).not.toThrow();
    expect(() => parse("1,[;\"\\n\\n\"]\"\\n\"sv raze each ps")).not.toThrow();
    expect(() => parse("t:(\"IIIII\";enlist \",\")0: `:input.csv")).not.toThrow();
    expect(() => parse("fn 1: 0x424d,\"x\"$1 2 255")).not.toThrow();
  });

  it("parses qSQL clause islands and comma-separated expressions", () => {
    expect(stripSource(parse("select sum v+a by a,b from ([]a:1 1 2;b:`x`x`y;v:10 20 30) where v>10"))).toMatchObject({
      kind: "program",
      statements: [
        {
          kind: "select",
          columns: [{ name: null }],
          by: [{ name: null }, { name: null }],
          source: { kind: "table" },
          where: { kind: "binary", op: ">" }
        }
      ]
    });
    expect(stripSource(parse("exec sum v by a,b from t where a in 1 2"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "exec", by: [{}, {}], where: { kind: "binary", op: "in" } }]
    });
    expect(stripSource(parse("update px:last price,qty:sum size from trades where sym=`AAPL"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "update", updates: [{ name: "px" }, { name: "qty" }] }]
    });
    expect(stripSource(parse("delete price,size from trades where date=2026.04.24"))).toMatchObject({
      kind: "program",
      statements: [{ kind: "delete", columns: ["price", "size"], where: { kind: "binary", op: "=" } }]
    });
  });
});
