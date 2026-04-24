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
});
