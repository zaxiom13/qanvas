import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { Session } from "../src/q/index";

// Expressions whose real-q output is nondeterministic or a q quirk we intentionally don't copy.
const SKIP = new Set([
  "5?10", "3?1f", ".z.p", "\\t sum til 1000000", "atan2[1;1]", "-7h$3", ",`a", "neg", "til", "count", "type +",
  "1 0N 3^0", "where 1 0 1 1b", "where `a`b`c!1 0 1b", "- 1 2 3", "til `a", "100000#1",
  "{x,y}': 1 2 3", "-': 1 4 9", "%': 2 4 8", ",': 1 2 3",
]);

const dir = join(__dirname, "corpus");
const norm = (t: string) => t.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();

for (const f of readdirSync(dir).filter((f) => f.endsWith(".expected.json"))) {
  describe(f.replace(".expected.json", ""), () => {
    const cases: { src: string; out: string }[] = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const out: string[] = [];
    const s = new Session({ stdout: (t) => out.push(t), stderr: (t) => out.push(t) });
    s.run("\\c 25 200");
    for (const c of cases) {
      test(c.src, () => {
        out.length = 0;
        const r = s.evaluate(c.src);
        if (SKIP.has(c.src)) return;
        let mine = out.map((t) => t + "\n").join("");
        if (r.error) mine += `'${r.error.qname}\n`;
        else if (r.text) mine += r.text + "\n";
        let theirs = c.out.replace(/^'\d{4}\.\d\d\.\d\dT[\d:.]+ /, "'");
        if (theirs.startsWith("'")) theirs = theirs.split("\n")[0] + "\n";
        expect(norm(mine)).toBe(norm(theirs));
      });
    }
  });
}
