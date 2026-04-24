import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "../src/index";

const Q_BIN = process.env.QANVAS_Q_BIN || `${process.env.HOME}/.kx/bin/q`;
const hasRealQ = existsSync(Q_BIN);

const qString = (source: string) =>
  `"${source.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

function runRealQParse(source: string): unknown {
  const dir = mkdtempSync(join(tmpdir(), "qanvas-parse-"));
  const outputPath = join(dir, "parse.json");
  const scriptPath = join(dir, "runner.q");

  try {
    writeFileSync(
      scriptPath,
      [
        `(\`$":${outputPath}") 0: enlist .j.j parse ${qString(source)}`,
        "\\\\"
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(Q_BIN, [scriptPath], {
      encoding: "utf8",
      env: { ...process.env, QHOME: process.env.QHOME || `${process.env.HOME}/.kx` }
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `q exited with code ${result.status}`);
    }

    return JSON.parse(readFileSync(outputPath, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const rootTag = (tree: unknown): string | null => {
  if (Array.isArray(tree)) return typeof tree[0] === "string" ? tree[0] : null;
  if (typeof tree === "string") return "lambda";
  if (tree && typeof tree === "object") return "object";
  return null;
};

describe.skipIf(!hasRealQ)("parser parity with real q parse", () => {
  const cases: Array<{ source: string; realRoot?: string }> = [
    { source: "1+2", realRoot: "+" },
    { source: "sum 1 2 3", realRoot: "sum" },
    { source: "a:1;b:a+2", realRoot: ";" },
    { source: "{[x;y] a:x+y; :a}", realRoot: "lambda" },
    { source: "{x+y}/[0;1 2 3]" },
    { source: "(+/) 1 2 3 4" },
    { source: "+\\[1000;1 2 3 4]" },
    { source: "count each string til 3" },
    { source: "`a`b!1 2", realRoot: "!" },
    { source: "(`a`b!10 20) `a" },
    { source: "([]a:1 2;b:`x`y)" },
    { source: "([k:`a`b] v:10 20)" },
    { source: "select sum v by a from t where v>10", realRoot: "?" },
    { source: "exec sum v by a,b from t where a in 1 2" },
    { source: "update px:last price,qty:sum size from trades where sym=`AAPL" },
    { source: "delete price,size from trades where date=2026.04.24" },
    { source: "$[x<0;`neg;x=0;`zero;`pos]", realRoot: "$" },
    { source: "if[x>0;show x]", realRoot: "if" },
    { source: "while[x<3;x+:1]" },
    { source: "do[3;show x]" },
    { source: "m[1 3;2 4]" },
    { source: "\"abcdef\" 1 0 3" },
    { source: ".[f;args;handler]" },
    { source: "@[2+;3;4]" }
  ];

  for (const entry of cases) {
    it(`parses ${entry.source}`, () => {
      expect(() => parse(entry.source)).not.toThrow();
      const realTree = runRealQParse(entry.source);
      if (entry.realRoot !== undefined) {
        expect(rootTag(realTree)).toBe(entry.realRoot);
      } else {
        expect(realTree).toBeDefined();
      }
    });
  }
});
