import { describe, expect, it } from "vitest";
import { tokenize } from "../src/index";
import { lexKdbLex } from "../../q-language/src/index";

describe("KDBLex adapter", () => {
  it("emits lexer tokens with spans and adapts them into engine tokens", () => {
    const source = "sum 1 0 1b; / note\n([] x: til 2)";
    const lexed = lexKdbLex(source);

    expect(lexed.some((token) => token.kind === "comment")).toBe(true);
    expect(lexed.some((token) => token.kind === "newline")).toBe(true);
    expect(lexed.find((token) => token.kind === "identifier")?.start).toBe(0);
    expect(lexed.find((token) => token.kind === "boolvector")?.value).toBe("1 0 1b");

    expect(tokenize(source)).toEqual([
      { kind: "identifier", value: "sum", start: 0, end: 3 },
      { kind: "boolvector", value: "101b", start: 4, end: 10 },
      { kind: "separator", value: ";", start: 10, end: 11 },
      { kind: "newline", value: "\n", start: 18, end: 19 },
      { kind: "lparen", value: "(", start: 19, end: 20 },
      { kind: "lbracket", value: "[", start: 20, end: 21 },
      { kind: "rbracket", value: "]", start: 21, end: 22 },
      { kind: "identifier", value: "x", start: 23, end: 24 },
      { kind: "operator", value: ":", start: 24, end: 25 },
      { kind: "identifier", value: "til", start: 26, end: 29 },
      { kind: "number", value: "2", start: 30, end: 31 },
      { kind: "rparen", value: ")", start: 31, end: 32 },
      { kind: "eof", value: "", start: 32, end: 32 }
    ]);
  });

  it("recognizes q byte, timestamp, timespan, and file-handle operator tokens", () => {
    expect(tokenize("0x424d;2010.01.25D14:17:46.962375000;0D14:17:45.519682000;fn 1: 0x00"))
      .toMatchObject([
        { kind: "number", value: "0x424d" },
        { kind: "separator" },
        { kind: "date", value: "2010.01.25D14:17:46.962375000" },
        { kind: "separator" },
        { kind: "date", value: "0D14:17:45.519682000" },
        { kind: "separator" },
        { kind: "identifier", value: "fn" },
        { kind: "operator", value: "1:" },
        { kind: "number", value: "0x00" },
        { kind: "eof" }
      ]);
  });

  it("keeps adverb slashes before closing delimiters as operators, not comments", () => {
    expect(lexKdbLex("({y+.cx.mul[x;x]}/)each").some((token) => token.kind === "comment")).toBe(false);
    expect(lexKdbLex("({y+.cx.mul[x;x]} /)each").some((token) => token.kind === "comment")).toBe(false);
    expect(lexKdbLex("(.cx.new/)each").some((token) => token.kind === "comment")).toBe(false);
    expect(lexKdbLex("(.cx.new /)each").some((token) => token.kind === "comment")).toBe(false);
    expect(tokenize("(.cx.new /)each").filter((token) => token.kind === "operator").map((token) => token.value))
      .toContain("/");
  });
});
