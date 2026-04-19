import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listBuiltins } from "../src/index";

const trackedGaps = new Set([
  "exec",
  "exit",
  "if",
  "ij",
  "lj",
  "mcount",
  "mdev",
  "med",
  "msum",
  "pj",
  "select",
  "setenv",
  "uj",
  "update",
  "while",
  "xkey"
]);

describe("syntax keyword coverage", () => {
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
      "each"
    ]);
    const uncovered = keywords.filter(
      (keyword) => !implemented.has(keyword) && !trackedGaps.has(keyword)
    );

    expect(uncovered).toEqual([]);
  });
});
