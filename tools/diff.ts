// Compare our engine with real q on a corpus file (one expression per line, stateful).
// Usage: npx tsx tools/diff.ts test/corpus/basics.q [--all]
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { Session } from "../src/q/index";
// @ts-ignore
import { runOracle } from "./oracle.mjs";

const file = process.argv[2];
const showAll = process.argv.includes("--all");
const refresh = process.argv.includes("--refresh");
const lines = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("//"));
const cache = file.replace(/\.q$/, ".expected.json");
let expected: { src: string; out: string }[];
if (!refresh && existsSync(cache)) {
  expected = JSON.parse(readFileSync(cache, "utf8"));
  if (expected.length !== lines.length || expected.some((e, i) => e.src !== lines[i])) expected = runOracle(lines);
} else expected = runOracle(lines);
writeFileSync(cache, JSON.stringify(expected, null, 1));

const s = new Session({ stdout: (t) => out.push(t), stderr: (t) => out.push(t) });
let out: string[] = [];
let pass = 0, fail = 0;
for (let i = 0; i < lines.length; i++) {
  out = [];
  const r = s.evaluate(lines[i]);
  let mine = out.map((t) => t + "\n").join("");
  if (r.error) mine += `'${r.error.qname}\n`;
  else if (r.text) mine += r.text + "\n";
  let theirs = expected[i].out;
  // compare only the first line of errors (caret layouts differ)
  theirs = theirs.replace(/^'\d{4}\.\d\d\.\d\dT[\d:.]+ /, "'");
  if (theirs.startsWith("'")) theirs = theirs.split("\n")[0] + "\n";
  const norm = (t: string) => t.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();
  const ok = norm(mine) === norm(theirs);
  if (ok) pass++;
  else fail++;
  if (!ok || showAll) {
    console.log(`${ok ? "ok  " : "FAIL"} q)${lines[i]}`);
    if (!ok) {
      console.log("  q:    " + JSON.stringify(theirs));
      console.log("  ours: " + JSON.stringify(mine) + (r.error?.hint ? "   (" + r.error.hint + ")" : ""));
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed (${file})`);
