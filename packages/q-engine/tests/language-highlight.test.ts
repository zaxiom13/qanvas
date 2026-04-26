import { describe, expect, it } from "vitest";
import { qMonarchSyntax } from "../../q-language/src/syntax";

describe("q language highlighting", () => {
  it("keeps dotted namespace identifiers intact", () => {
    const identifierRule = qMonarchSyntax.tokenizer.root[0]?.[0];
    expect(identifierRule).toBeInstanceOf(RegExp);
    const pattern = identifierRule as RegExp;

    expect(".cx.abs".match(pattern)?.[0]).toBe(".cx.abs");
    expect(".Q.id".match(pattern)?.[0]).toBe(".Q.id");
    expect(".z.K".match(pattern)?.[0]).toBe(".z.K");
  });

  it("treats slash as a comment only in comment positions", () => {
    const commentPatterns = qMonarchSyntax.tokenizer.whitespace
      .filter((rule) => rule[1] === "comment")
      .map((rule) => rule[0])
      .filter((rule): rule is RegExp => rule instanceof RegExp);
    const matchesAny = (input: string) => commentPatterns.some((pattern) => pattern.test(input));

    expect(matchesAny("/ note")).toBe(true);
    expect(matchesAny(";/ note")).toBe(true);
    expect(matchesAny("show 1 2 3 / note")).toBe(true);
    expect(matchesAny("({y+.cx.mul[x;x]}/)each")).toBe(false);
    expect(matchesAny("({y+.cx.mul[x;x]} /)each")).toBe(false);
    expect(matchesAny("(.cx.new/)each")).toBe(false);
    expect(matchesAny("(.cx.new /)each")).toBe(false);
    expect(matchesAny("/:")).toBe(false);
  });

  it("covers Rosetta literal and file-handle forms", () => {
    expect(qMonarchSyntax.operators).toEqual(expect.arrayContaining(["0:", "1:", "2:"]));

    const rootPatterns = (qMonarchSyntax.tokenizer.root as readonly unknown[])
      .filter(Array.isArray)
      .map((rule) => (rule as readonly unknown[])[0])
      .filter((rule): rule is RegExp => rule instanceof RegExp);
    const matchesAnyRoot = (input: string) => rootPatterns.some((pattern) => pattern.test(input));

    expect(matchesAnyRoot("0x424d")).toBe(true);
    expect(matchesAnyRoot("2010.01.25D14:17:46.962375000")).toBe(true);
    expect(matchesAnyRoot("0D14:17:45.519682000")).toBe(true);
    expect(matchesAnyRoot("1:")).toBe(true);
  });
});
