#!/usr/bin/env node
// Probe jqport parity against known-good q outputs.
// Runs each case, compares to expected, prints PASS/FAIL summary.
import { createSession, formatValue } from "../packages/q-engine/src/index.ts";

// All outputs are what a real q 4.x session should produce (with a trailing \n for scalars).
const CASES = [
  // ---- Basics
  ["1+2", "3\n"],
  ["til 5", "0 1 2 3 4\n"],
  ["1 2 3+10", "11 12 13\n"],
  ["1 2 3*1 2 3", "1 4 9\n"],
  ["neg -3 2 1", "3 -2 -1\n"],
  ["reverse 1 2 3", "3 2 1\n"],

  // ---- Division vs divide: % is float divide, div is integer divide
  ["10%4", "2.5\n"],
  ["10 div 4", "2\n"],
  ["10 mod 4", "2\n"],

  // ---- Adverbs
  ["(+/) 1 2 3 4", "10\n"],
  ["(+\\) 1 2 3 4", "1 3 6 10\n"],
  ["2 +\\ 1 2 3", "3 5 8\n"],
  ["{x+y}/[1 2 3 4]", "10\n"],
  ["(*/) 1 2 3 4", "24\n"],

  // ---- Each and adverbs
  ["count each (\"ab\";\"cde\";\"f\")", "2 3 1\n"],
  ["{x*2} each 1 2 3", "2 4 6\n"],
  ["1 2 3 {x+y}' 10 20 30", "11 22 33\n"],

  // ---- Dictionaries
  ["`a`b`c!1 2 3", "a| 1\nb| 2\nc| 3\n"],
  ["(`a`b`c!1 2 3)[`b]", "2\n"],
  ["(`a`b!1 2)+`a`b!10 20", "a| 11\nb| 22\n"],

  // ---- Tables
  ["t:([]a:1 2 3;b:10 20 30);select from t where a>1", "a b\n---- \n2 20\n3 30\n"],
  ["count ([]a:1 2 3)", "3\n"],
  ["cols ([]a:1 2;b:3 4)", "`a`b\n"],

  // ---- Joins
  ["t1:([]a:1 2);t2:([]a:3 4);t1,t2", "a\n-\n1\n2\n3\n4\n"],
  ["([]a:1 2 3) lj ([k:1 2 3]b:10 20 30)", "a b \n----\n1 10\n2 20\n3 30\n"],

  // ---- Strings/symbols
  ["`abc", "`abc\n"],
  ["\"hello\"", "\"hello\"\n"],
  ["\"abc\",\"def\"", "\"abcdef\"\n"],
  ["upper \"abc\"", "\"ABC\"\n"],
  ["lower \"ABC\"", "\"abc\"\n"],

  // ---- Type information
  ["type 1", "-7h\n"],
  ["type 1i", "-6h\n"],
  ["type 1f", "-9h\n"],
  ["type 1.0", "-9h\n"],
  ["type `a", "-11h\n"],
  ["type \"abc\"", "10h\n"],
  ["type 2026.01.01", "-14h\n"],
  ["type 1 2 3", "7h\n"],
  ["type 1 2 3f", "9h\n"],
  ["type `a`b", "11h\n"],
  ["type (`a`b!1 2)", "99h\n"],
  ["type ([]a:1 2)", "98h\n"],

  // ---- Casts
  ["`int$1.5 2.7", "1 2\n"],
  ["`long$1.5 2.7", "1 2\n"],
  ["`float$1 2 3", "1 2 3f\n"],
  ["\"i\"$\"abc\"", "97 98 99i\n"],
  ["`$\"hello\"", "`hello\n"],
  ["string 42", "\"42\"\n"],
  ["string `abc", "\"abc\"\n"],

  // ---- Temporal
  ["2026.01.01+5", "2026.01.06\n"],
  ["2026.01.01 - 2026.01.10", "-9\n"],
  ["`date$0", "2000.01.01\n"],

  // ---- Boolean & conditions
  ["1 2 3>2", "010b\n"],
  ["not 1 0 1", "010b\n"],
  ["and[1b;0b]", "0b\n"],
  ["$[1b;\"a\";\"b\"]", "\"a\"\n"],
  ["$[0;\"a\";1;\"b\";\"c\"]", "\"b\"\n"],

  // ---- List indexing
  ["1 2 3 4 5[2]", "3\n"],
  ["1 2 3 4 5[1 3]", "2 4\n"],
  ["(1 2 3;4 5 6;7 8 9)[1;2]", "6\n"],

  // ---- Flip / matrix
  ["flip (1 2 3;4 5 6)", "1 4\n2 5\n3 6\n"],

  // ---- Functions
  ["{x+y}[3;4]", "7\n"],
  ["f:{x*2};f 5", "10\n"],
  ["({x+y+z}[;2;])[1;3]", "6\n"],

  // ---- Aggregations on float/int distinction
  ["avg 1 2 3", "2f\n"],
  ["sum 1 2 3", "6\n"],
  ["sum 1 2 3f", "6f\n"],
  ["max 1 2 3", "3\n"],
  ["min 1 2 3", "1\n"],
  ["med 1 2 3 4 5", "3f\n"],
  ["dev 1 2 3", "0.8164966\n"],
  ["var 1 2 3", "0.6666667\n"],

  // ---- Null handling
  ["0N", "0N\n"],
  ["0n", "0n\n"],
  ["null 0N 1 2", "100b\n"],
  ["0N + 5", "0N\n"],

  // ---- ss / ssr
  ["\"hello world\" ss \"o\"", "4 7\n"],
  ["ssr[\"hello\";\"l\";\"L\"]", "\"heLLo\"\n"],

  // ---- xkey / xasc
  ["`a xasc ([]a:3 1 2;b:10 20 30)", "a b \n----\n1 20\n2 30\n3 10\n"],
  ["1!([]a:1 2 3;b:10 20 30)", "a| b \n-| --\n1| 10\n2| 20\n3| 30\n"],

  // ---- Booleans printed
  ["1 0 1b", "101b\n"],
  ["0b", "0b\n"],
  ["1b and 0b", "0b\n"],
];

function runAll() {
  let pass = 0, fail = 0;
  const failures = [];
  for (const [expr, expected] of CASES) {
    const session = createSession({
      now: () => new Date("2026-04-16T12:00:00Z"),
      timezone: () => "UTC",
    });
    let actual, error;
    try {
      const res = session.evaluate(expr);
      actual = res.formatted ?? formatValue(res.value);
    } catch (e) {
      error = e?.message ?? String(e);
    }
    if (!error && actual === expected) {
      pass++;
      // console.log("PASS:", expr);
    } else {
      fail++;
      failures.push({ expr, expected, actual, error });
    }
  }
  console.log(`\n===== ${pass}/${CASES.length} PASS =====`);
  for (const f of failures) {
    console.log(`\n--- FAIL: ${f.expr}`);
    console.log(`  expected: ${JSON.stringify(f.expected)}`);
    if (f.error) console.log(`  error:    ${f.error}`);
    else console.log(`  actual:   ${JSON.stringify(f.actual)}`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

runAll();
