import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listBuiltins } from "../src/index";
import { isPrimitiveName, primitiveNamesBy, PRIMITIVES } from "../src/runtime/primitive-manifest";
import { SIMPLE_DYAD_HANDLERS, SIMPLE_MONAD_HANDLERS } from "../src/runtime/primitive-handlers";

const trackedGaps = new Set([
  "exec",
  "exit",
  "if",
  "select",
  "update",
  "while"
]);

const implementedConstants = new Set([
  "csv"
]);

describe("syntax keyword coverage", () => {
  it("keeps the Kona-style primitive table as the builtin source of truth", () => {
    const builtins = listBuiltins();

    expect(builtins.monads).toEqual(primitiveNamesBy("monad"));
    expect(builtins.diads).toEqual(primitiveNamesBy("dyad"));
    expect(builtins.triads).toEqual(primitiveNamesBy("triad"));
    expect(builtins.quads).toEqual(primitiveNamesBy("quad"));
    expect(primitiveNamesBy("primitiveAdverbs")).toContain("+");
    expect(primitiveNamesBy("primitiveAdverbs")).toContain("-");
    expect(primitiveNamesBy("overKernel")).toEqual(["+", "*", "|", "&"]);
    expect(primitiveNamesBy("scanKernel")).toEqual(["+", "*", "|", "&"]);
    expect(primitiveNamesBy("eachPairKernel")).toEqual(["-"]);
    expect(PRIMITIVES.every((primitive) => isPrimitiveName(primitive.name))).toBe(true);
    expect(SIMPLE_MONAD_HANDLERS.every(([name]) => isPrimitiveName(name))).toBe(true);
    expect(SIMPLE_DYAD_HANDLERS.every(([name]) => isPrimitiveName(name))).toBe(true);
  });

  it("tracks every highlighted keyword as implemented or explicitly pending", () => {
    const syntaxPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../q-language/src/syntax.ts"
    );
    const source = fs.readFileSync(syntaxPath, "utf8");
    const match = source.match(/keywords:\s*\[((?:.|\n)*?)\]/m);
    const keywords = [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);

    const builtins = listBuiltins();
    const implemented = new Set([
      ...builtins.monads,
      ...builtins.diads,
      ...(builtins.triads ?? []),
      ...(builtins.quads ?? []),
      ...implementedConstants,
      "each"
    ]);
    const uncovered = keywords.filter(
      (keyword) => !implemented.has(keyword) && !trackedGaps.has(keyword)
    );

    expect(uncovered).toEqual([]);
  });

  it("highlights every identifier-shaped implemented builtin", () => {
    const syntaxPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../q-language/src/syntax.ts"
    );
    const source = fs.readFileSync(syntaxPath, "utf8");
    const match = source.match(/keywords:\s*\[((?:.|\n)*?)\]/m);
    const keywords = new Set([...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((entry) => entry[1]));
    const builtins = listBuiltins();
    const implemented = [
      ...builtins.monads,
      ...builtins.diads,
      ...(builtins.triads ?? []),
      ...(builtins.quads ?? [])
    ].filter((name) => /^[a-zA-Z.][a-zA-Z0-9_.]*$/.test(name));

    expect(implemented.filter((name) => !keywords.has(name)).sort()).toEqual([]);
  });
});
