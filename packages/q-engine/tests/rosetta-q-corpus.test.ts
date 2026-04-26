import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lexKdbLex } from "../../q-language/src/index";
import { parse } from "../src/index";
import { ROSETTA_Q_CORPUS } from "./fixtures/rosetta-q-corpus";

const Q_BIN = process.env.QANVAS_Q_BIN || `${process.env.HOME}/.kx/bin/q`;
const hasRealQ = existsSync(Q_BIN);

const exampleName = (example: (typeof ROSETTA_Q_CORPUS)[number]) =>
  `${example.task} #${example.block}`;

const qString = (source: string) =>
  `"${source.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;

function runRealQParseOk(source: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), "qanvas-rosetta-test-"));
  const outputPath = join(dir, "parse-ok.txt");
  const scriptPath = join(dir, "runner.q");

  try {
    writeFileSync(
      scriptPath,
      [
        `ok:@[{parse x;1b};${qString(source)};{0b}]`,
        `(\`$":${outputPath}") 0: enlist string ok`,
        "\\\\"
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(Q_BIN, [scriptPath], {
      encoding: "utf8",
      env: { ...process.env, QHOME: process.env.QHOME || `${process.env.HOME}/.kx` },
      timeout: 10000
    });
    if (result.status !== 0) return false;
    return readFileSync(outputPath, "utf8").trim() === "1";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("Rosetta Code q corpus", () => {
  it("tracks the scraped Category:Q examples", () => {
    expect(ROSETTA_Q_CORPUS.length).toBeGreaterThanOrEqual(65);
    expect(new Set(ROSETTA_Q_CORPUS.map((example) => example.task)).size).toBeGreaterThanOrEqual(40);
  });

  it("lexes and parses every checked-in q block", () => {
    const failures: string[] = [];

    for (const example of ROSETTA_Q_CORPUS) {
      try {
        lexKdbLex(example.source);
        parse(example.source);
      } catch (error) {
        failures.push(`${exampleName(example)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("documents raw wiki blocks that are transcript/directive blocks rather than parseable source", () => {
    expect(ROSETTA_Q_CORPUS.filter((example) => !example.realQParse).map(exampleName)).toEqual([
      "Death Star #2",
      "FizzBuzz #3"
    ]);
  });
});

describe.skipIf(!hasRealQ)("Rosetta Code q corpus against real q parse", () => {
  it("keeps local parse coverage aligned with real q for source blocks", () => {
    const failures = ROSETTA_Q_CORPUS
      .filter((example) => example.realQParse)
      .filter((example) => !runRealQParseOk(example.source))
      .map(exampleName);

    expect(failures).toEqual([]);
  });
});
