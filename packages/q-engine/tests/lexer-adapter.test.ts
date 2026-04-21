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
      { kind: "identifier", value: "sum" },
      { kind: "boolvector", value: "101b" },
      { kind: "separator", value: ";" },
      { kind: "newline", value: "\n" },
      { kind: "lparen", value: "(" },
      { kind: "lbracket", value: "[" },
      { kind: "rbracket", value: "]" },
      { kind: "identifier", value: "x" },
      { kind: "operator", value: ":" },
      { kind: "identifier", value: "til" },
      { kind: "number", value: "2" },
      { kind: "rparen", value: ")" },
      { kind: "eof", value: "" }
    ]);
  });
});
