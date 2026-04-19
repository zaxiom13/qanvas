import { describe, expect, it } from "vitest";
import { createSession, formatValue } from "../src/index";

const cases = [
  { program: "abs -2 3 -4", expected: "2 3 4\n" },
  { program: "all 110b", expected: "0b\n" },
  { program: "any 001b", expected: "1b\n" },
  { program: "ceiling 1.2 3.0 -1.2", expected: "2 3 -1\n" },
  { program: "cols ([]a:1 2;b:3 4)", expected: "`a`b\n" },
  { program: "cut[2;1 2 3 4 5]", expected: "1 2\n3 4\n,5\n" },
  { program: "cut[0 2 3;1 2 3 4 5]", expected: "1 2\n,3\n4 5\n" },
  { program: "cut[2;\"abcde\"]", expected: "\"ab\"\n\"cd\"\n,\"e\"\n" },
  { program: "desc 3 1 2", expected: "3 2 1\n" },
  { program: "div[-7;2]", expected: "-4\n" },
  { program: "exp 0 1", expected: "1 2.718282\n" },
  { program: "1 2 3 except 2", expected: "1 3\n" },
  { program: "log 1 10", expected: "0 2.302585\n" },
  { program: "\"abc\" like \"a*\"", expected: "1b\n" },
  { program: "1 2 3 inter 2 3 4", expected: "2 3\n" },
  { program: "mod[7;-2]", expected: "-1\n" },
  { program: "10h$.Q.atob \"aGVsbG8=\"", expected: "\"hello\"\n" },
  { program: "@[|:;\"zero\"]", expected: "\"orez\"\n" },
  { program: "1 2 3 in 2 3", expected: "011b\n" },
  { program: "null 0N 2 0N", expected: "101b\n" },
  { program: "prev 1 2 3", expected: "0N 1 2\n" },
  { program: "reciprocal 2 4", expected: "0.5 0.25\n" },
  { program: "reverse 1 2 3", expected: "3 2 1\n" },
  { program: "2 rotate 1 2 3 4", expected: "3 4 1 2\n" },
  { program: "reverse \"abc\"", expected: "\"cba\"\n" },
  { program: "signum -3 0 5", expected: "-1 0 1i\n" },
  { program: "sublist[1 2;10 20 30 40]", expected: "20 30\n" },
  { program: "sums 1 2 3", expected: "1 3 6\n" },
  { program: "1 2 3 within 0 2", expected: "110b\n" },
  { program: "sqrt 9 2", expected: "3 1.414214\n" },
  { program: "1 2 2 3 union 2 3 4", expected: "1 2 3 4\n" },
  { program: "upper \"abC\"", expected: "\"ABC\"\n" },
  { program: ".Q.x10 12345", expected: "\"AAAAAAADA5\"\n" },
  { program: "cols .Q.id(`$(\"count+\";\"count*\";\"count1\"))xcol([]1 2;3 4;5 6)", expected: "`count1`count11`count12\n" },
  { program: "xlog[10;0Wj-1]", expected: "18.96489\n" },
  { program: "first (1 2 3f;4 5 6f) mmu (7 8f;9 10f;11 12f)", expected: "58 64f\n" },
  { program: "1 2 3 wsum 4 5 6", expected: "32\n" },
  { program: "1 2 3 wavg 10 20 30", expected: "23.33333\n" },
  { program: "1 3 5 7 bin 4", expected: "1\n" },
  { program: "1 3 5 7 binr 4", expected: "2\n" },
  { program: "rank 3 1 4 1 5", expected: "2 0 3 1 4\n" },
  { program: "hsym `foo", expected: "`:foo\n" },
  { program: "inv (1 0 0f;0 2 0f;0 0 4f)", expected: "1 0 0f\n0 0.5 0\n0 0 0.25\n" },
  { program: "{x*2} peach 1 2 3", expected: "2 4 6\n" },
  { program: "1 in 1 2 3", expected: "1b\n" },
  { program: "x:0; while[x<5; x+:1]; x", expected: "5\n" },
  { program: "y:0; do[4; y+:3]; y", expected: "12\n" },
  { program: "`a`b xcols ([]b:3 4;a:1 2;c:5 6)", expected: "a b c\n-----\n1 3 5\n2 4 6\n" },
  { program: "`x set 42; x", expected: "42\n" },
  { program: "x:7; get `x", expected: "7\n" },
  { program: "1j*(til 4)=/:til 4", expected: "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1\n" },
  { program: "1 2 3+/:10 20", expected: "11 12 13\n21 22 23\n" },
  { program: "1 2 3+\\:10 20", expected: "11 21\n12 22\n13 23\n" },
  { program: "1 2+/:\\:10 20", expected: "11 21\n12 22\n" },
  { program: "(1 2 3)+'10 20 30", expected: "11 22 33\n" }
] as const;

describe("highlighted builtin regressions", () => {
  it("covers a batch of highlighted verbs with stable outputs", () => {
    const session = createSession();
    for (const testCase of cases) {
      expect(formatValue(session.evaluate(testCase.program).value)).toBe(testCase.expected);
    }
  });
});
